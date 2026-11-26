"use client";

/**
 * The interactive venue map for De Schorre and DreamVille.
 *
 * ## What this renders
 *
 * Three things, in this order, and the first one always works:
 *
 * 1. **Controls and a zone list**, in ordinary HTML. Search, category filters,
 *    favourites and an A→B planner. A keyboard user, a screen-reader user, a
 *    visitor with WebGL disabled and a visitor with no network can each plan any
 *    walk from here alone.
 * 2. **A MapLibre GL canvas**, mounted only when WebGL is available and the
 *    library has loaded. It draws OpenStreetMap vector tiles from OpenFreeMap
 *    under the guide's own ground overlays and the same Dijkstra route the list
 *    quotes, so the map and the figures cannot disagree.
 * 3. **The route as figures**: miles, normal minutes, peak minutes, and the
 *    bottleneck notes for the legs actually walked.
 *
 * The map is the enhancement; the list is the tool. That ordering is why a WebGL
 * failure costs the reader nothing.
 *
 * ## Why the library is imported inside an effect
 *
 * `maplibre-gl` is about a megabyte of JavaScript and touches `window` as it
 * evaluates. A static import would put it into the server render and into the
 * first payload of every page that shows this tool. The dynamic import inside the
 * mount effect keeps it client-only, out of the initial bundle, and inside a
 * `try` — so a browser that refuses to evaluate it shows the fallback instead of
 * a blank panel.
 *
 * ## Data
 *
 * Node positions, footpaths and ground overlays come from
 * `src/lib/maps/geo-data.ts`; the walk comes from `routeBetween` in
 * `src/lib/maps/geo-routing.ts`, which uses one venue's own graph when both ends
 * are on it and the combined site graph when they are not. Nothing is duplicated
 * here.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useSyncExternalStore } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";

import { GEO_DATA_DISCLAIMER, ALL_VENUE_MAP, VENUE_MAPS, physicalVenueOfNode } from "@/lib/maps/geo-data";
import { filterNodes, nodeById, routeBetween } from "@/lib/maps/geo-routing";
import {
  MAP_NODE_CATEGORIES,
  VENUE_MAP_IDS,
  type GeoJsonPosition,
  type GeoMapNode,
  type GeoRoute,
  type MapNodeCategory,
  type PhysicalVenueId,
  type VenueMapId,
} from "@/lib/maps/geo-types";

import { formatMiles } from "./maps-logic";
import {
  prefersReducedMotion,
  subscribeWebglSupport,
  webglSupport,
  webglSupportServerSnapshot,
} from "./map-support";
import { buildMapStyle } from "./map-style";
import { INTERACTIVE_NODE_LAYERS, buildMapLayers } from "./map-layer-specs";
/*
  MapLibre's own stylesheet carries the layout of the controls and canvas, which
  cannot sensibly be reimplemented. It is imported statically rather than beside
  the dynamic `import("maplibre-gl")` so it is present before the canvas is
  created: a canvas inserted into an unstyled container measures zero and the map
  renders blank. `maps.css` restyles that chrome to the Dusk Programme palette.
*/
import "maplibre-gl/dist/maplibre-gl.css";
import "./maps.css";
import {
  CATEGORY_COLOURS,
  CATEGORY_LABELS,
  CATEGORY_LETTERS,
  GROUND_COLOUR,
  SOURCE_IDS,
  buildEndpointCollection,
  buildInspectedCollection,
  buildLocateCollection,
  buildNodeCollection,
  buildOverlayCollection,
  buildRouteCollection,
  nodeFocus,
  venueBoundsPair,
  type FeatureCollectionLike,
} from "./map-layers";
import {
  GEOLOCATION_BLOCKED_MESSAGE,
  GEOLOCATION_UNAVAILABLE_MESSAGE,
  describeGeoError,
  describePosition,
  positionFromCoords,
} from "./map-locate";
import { useMapFavourites } from "./use-map-favourites";
import { configureMapWorker } from "./map-worker";

/** The venue name, used in the heading and on the switcher. */
const VENUE_LABELS: Readonly<Record<VenueMapId, string>> = {
  "de-schorre": "De Schorre (Festival Grounds)",
  dreamville: "DreamVille (Camping & Accommodation)",
  all: "Full site: De Schorre + DreamVille",
};

/** The same names, for the switcher's own visible text. */
const VENUE_SHORT_LABELS: Readonly<Record<VenueMapId, string>> = VENUE_LABELS;

/**
 * The walk each view opens with.
 *
 * The two single-venue views open with the pair a visitor most often needs: the
 * day gate to the headline stage, and the campsite gate through to the festival
 * gate. The combined view opens with the walk that only it can plan: a boutique
 * camp across the shared crossing to the Mainstage, which is a camper's whole
 * journey to the headline set in one set of figures.
 */
const DEFAULT_ROUTE: Readonly<Record<VenueMapId, { readonly from: string; readonly to: string }>> = {
  "de-schorre": { from: "ds-main-entrance", to: "ds-mainstage" },
  dreamville: { from: "dv-main-entrance", to: "dv-festival-gate" },
  all: { from: "dv-montagoe", to: "ds-mainstage" },
};

/** How the canvas is doing. `pending` is the moment between mount and the map's `load`. */
type MapStatus = "pending" | "ready" | "unsupported";

/**
 * How long to wait for `navigator.permissions.query` before asking anyway.
 *
 * The query is a fast local check, not a network call, so anything beyond this is
 * a browser bug or a blocked API. Falling through after two seconds keeps the
 * button usable instead of leaving it on "Finding you…" indefinitely.
 */
const PERMISSION_QUERY_TIMEOUT_MS = 2_000;

/** Which end of the route a marker press sets. */
type PickTarget = "from" | "to";

/** A request to move the camera, with a counter so the same node can be asked for twice. */
interface FocusRequest {
  readonly nodeId: string;
  readonly nonce: number;
}

/** The collections pushed into the map's sources. */
interface MapCollections {
  readonly overlay: FeatureCollectionLike<unknown>;
  readonly route: FeatureCollectionLike<unknown>;
  readonly nodes: FeatureCollectionLike<unknown>;
  readonly endpoints: FeatureCollectionLike<unknown>;
  readonly inspected: FeatureCollectionLike<unknown>;
  readonly locate: FeatureCollectionLike<unknown>;
}

/**
 * The visitor's plotted position, exactly as the browser reported it, or null.
 *
 * Held in React state for the life of the page and nowhere else: passed straight
 * into a GeoJSON point, never written to storage, never put in a URL, never sent
 * to this site's server.
 */
type LocatedPosition = GeoJsonPosition | null;

/**
 * The status note under the "Locate me" button.
 *
 * `tone` selects the styling: a drawn marker, a friendly "you are elsewhere", a
 * refusal, an unusable coordinate or a browser with no location services. The
 * message is announced as well as printed, so the note is never visual only.
 */
interface LocateNote {
  readonly tone: "inside" | "outside" | "denied" | "invalid" | "unsupported" | "blocked" | "cleared";
  readonly message: string;
}

/**
 * Presents a read-only GeoJSON collection as the mutable one MapLibre declares.
 *
 * The narrowing is legitimate: MapLibre serialises the object rather than writing
 * to it, but the GeoJSON typings use mutable arrays, which a `readonly` one is not
 * assignable to. Confining the cast here is the alternative to making every shape
 * in `geo-types` mutable for the sake of one consumer.
 */
function asGeoJson(collection: FeatureCollectionLike<unknown>): GeoJSON.GeoJSON {
  return collection as unknown as GeoJSON.GeoJSON;
}

export interface VenueMapsToolProps {
  /** Which venue the tool opens on. */
  readonly initialVenueId?: VenueMapId;
}

export function VenueMapsTool({ initialVenueId = "de-schorre" }: VenueMapsToolProps) {
  const uid = useId();

  const [venueId, setVenueId] = useState<VenueMapId>(initialVenueId);
  const [routeEnds, setRouteEnds] = useState<Record<VenueMapId, { from: string; to: string }>>(
    () => ({
      "de-schorre": { ...DEFAULT_ROUTE["de-schorre"] },
      dreamville: { ...DEFAULT_ROUTE.dreamville },
      all: { ...DEFAULT_ROUTE.all },
    }),
  );
  const [pickTarget, setPickTarget] = useState<PickTarget>("to");
  const [query, setQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<readonly MapNodeCategory[]>(() => [
    ...MAP_NODE_CATEGORIES,
  ]);
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [announcement, setAnnouncement] = useState("");

  /*
    The visitor's own position, and nothing else about them.

    `located` starts null: the browser is never asked for a position until the
    button is pressed, because a prompt on load trains readers to refuse prompts
    and would be a privacy decision taken on their behalf. `locateNote` is the
    sentence shown in the status note, and `locatePending` stops a second press
    starting a second request while the first is outstanding.
  */
  const [located, setLocated] = useState<LocatedPosition>(null);
  const [locateNote, setLocateNote] = useState<LocateNote | null>(null);
  const [locatePending, setLocatePending] = useState(false);

  /*
    WebGL support is fixed for the life of the document, so it is read as an
    external store rather than written into state from an effect. The server
    snapshot says "supported", which keeps the prerendered markup showing the map
    stage; a browser without WebGL switches to the fallback on its first render.
  */
  const webgl = useSyncExternalStore(subscribeWebglSupport, webglSupport, webglSupportServerSnapshot);

  /** Favourites live in one module-level store, shared with the browser's storage. */
  const {
    favourites,
    writable: favouritesWritable,
    isFavourite,
    toggle: toggleFavouriteFor,
  } = useMapFavourites();

  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [tilesDegraded, setTilesDegraded] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const map = VENUE_MAPS[venueId];
  const { from: fromId, to: toId } = routeEnds[venueId];

  /**
   * Which favourite bucket a starred zone belongs in.
   *
   * The combined view holds zones from both venues, so a star there has to be
   * written to the venue the zone actually belongs to. Starring Montagoe while
   * the whole site is on screen must produce the same stored value as starring it
   * on the DreamVille view, or the two views would disagree about the visitor's
   * own choices.
   *
   * The `?? "de-schorre"` arm is unreachable: `geo-routing.test.ts` asserts that
   * every node of every view belongs to one of the two venues. It exists so this
   * function has no `undefined` to leak into `localStorage`, and it picks the
   * festival side only because a stray id would be a data mistake worth noticing
   * rather than a campsite favourite quietly appearing in the wrong list.
   */
  const favouriteVenueFor = useCallback(
    (nodeId: string): PhysicalVenueId => physicalVenueOfNode(nodeId) ?? "de-schorre",
    [],
  );

  /**
   * The favourite ids this view should filter by.
   *
   * The combined view is the union of both venues', because a filter that hid
   * half the starred zones would be wrong on the one view that shows them all.
   */
  const viewFavouriteIds = useMemo(
    () =>
      venueId === "all"
        ? [...favourites["de-schorre"], ...favourites.dreamville]
        : favourites[venueId],
    [favourites, venueId],
  );

  /** What the map area is doing, derived rather than stored. */
  const status: MapStatus = !webgl || mapFailed ? "unsupported" : mapReady ? "ready" : "pending";

  /* ------------------------------------------------------------------ */
  /* Derived data                                                        */
  /* ------------------------------------------------------------------ */

  const filteredNodes = useMemo(
    () =>
      filterNodes(map, {
        query,
        categories: activeCategories,
        favouritesOnly,
        favouriteIds: viewFavouriteIds,
      }),
    [map, query, activeCategories, favouritesOnly, viewFavouriteIds],
  );

  /**
   * The walk between the two ends.
   *
   * `routeBetween` tries `[map, ALL_VENUE_MAP]` in that order, so a walk wholly
   * inside one venue still comes from that venue's own graph and keeps exactly
   * the figures it has always quoted. The combined map answers only when the
   * current view cannot — which happens through `initialVenueId` or a future
   * deep link, because each single-venue view's selects list only its own zones.
   */
  const route: GeoRoute | null = useMemo(
    () => routeBetween([map, ALL_VENUE_MAP], fromId, toId),
    [map, fromId, toId],
  );

  const inspectedNode = useMemo(
    () => (inspectedId === null ? null : nodeById(map, inspectedId)),
    [map, inspectedId],
  );

  /**
   * The nodes the map marks: everything the filters allow, plus both route ends
   * even when a filter has hidden them. A route whose ends are invisible cannot be
   * read, and those two ends are the two places the reader is being told about.
   *
   * A route end may come from the other venue when the walk spans both, so the
   * fallback here searches the combined map for a node the current view does not
   * hold. Without that, a cross-venue walk would draw its line to a gate but
   * label only one end.
   */
  const markedNodes = useMemo(() => {
    const out: GeoMapNode[] = [...filteredNodes];
    for (const endId of [fromId, toId]) {
      if (out.some((node) => node.id === endId)) continue;
      const end = nodeById(map, endId) ?? nodeById(ALL_VENUE_MAP, endId);
      if (end !== null) out.push(end);
    }
    return out;
  }, [filteredNodes, map, fromId, toId]);

  const collections: MapCollections = useMemo(
    () => ({
      overlay: buildOverlayCollection(map),
      route: buildRouteCollection(route),
      nodes: buildNodeCollection(markedNodes, fromId, toId),
      endpoints: buildEndpointCollection(route),
      inspected: buildInspectedCollection(inspectedNode),
      locate: buildLocateCollection(located),
    }),
    [map, route, markedNodes, fromId, toId, inspectedNode, located],
  );

  /**
   * The zone options for the two route selects.
   *
   * On the combined view the list is grouped by venue, because "Entrance 1" and
   * "Main Gate" would otherwise sit in one undifferentiated column with no hint
   * of which side of the brook each belongs to. A route end the current map does
   * not hold is appended rather than dropped: a `<select>` whose value matches no
   * `<option>` renders blank, which would look like the reader had chosen nothing.
   */
  const routeOptions = useMemo(() => {
    const groups: { label: string | null; nodes: readonly GeoMapNode[] }[] = [];

    if (venueId === "all") {
      for (const [id, label] of [
        ["de-schorre", "De Schorre (festival grounds)"],
        ["dreamville", "DreamVille (campsite)"],
      ] as const) {
        groups.push({
          label,
          nodes: map.nodes.filter((node) => physicalVenueOfNode(node.id) === id),
        });
      }
    } else {
      groups.push({ label: null, nodes: map.nodes });
    }

    const known = new Set(groups.flatMap((group) => group.nodes.map((node) => node.id)));
    const strays: GeoMapNode[] = [];
    for (const endId of [fromId, toId]) {
      if (known.has(endId)) continue;
      const end = nodeById(ALL_VENUE_MAP, endId);
      if (end === null) continue;
      known.add(endId);
      strays.push(end);
    }
    if (strays.length > 0) groups.push({ label: "Selected elsewhere", nodes: strays });

    return groups;
  }, [map, venueId, fromId, toId]);

  /* ------------------------------------------------------------------ */
  /* Favourites                                                          */
  /* ------------------------------------------------------------------ */

  const handleToggleFavourite = useCallback(
    (node: GeoMapNode) => {
      const bucket = favouriteVenueFor(node.id);
      const wasFavourite = isFavourite(bucket, node.id);
      toggleFavouriteFor(bucket, node.id);
      setAnnouncement(
        `${node.name} ${wasFavourite ? "removed from" : "added to"} your favourites.`,
      );
    },
    [favouriteVenueFor, isFavourite, toggleFavouriteFor],
  );

  /* ------------------------------------------------------------------ */
  /* Locate me                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * Asks the browser where the visitor is, once, because they pressed the button.
   *
   * What this deliberately does not do: it never runs on mount, so no prompt
   * appears until the reader asks for one, and it never sends the coordinate
   * anywhere — it goes into React state, becomes a GeoJSON point, and dies with
   * the page. The camera only moves on a successful fix inside the festival
   * area; an outside position, a refusal and an unusable coordinate all leave the
   * view exactly where the reader left it.
   */
  const handleLocate = useCallback(() => {
    if (locatePending) return;
    setLocateNote(null);

    const geolocation =
      typeof navigator === "undefined" ? undefined : navigator.geolocation;
    if (geolocation === undefined || geolocation === null) {
      setLocated(null);
      setLocateNote({ tone: "unsupported", message: GEOLOCATION_UNAVAILABLE_MESSAGE });
      return;
    }

    setLocatePending(true);

    const request = (): void => {
      geolocation.getCurrentPosition(
        (result) => {
          setLocatePending(false);
          const outcome = describePosition(
            positionFromCoords(result.coords),
            ALL_VENUE_MAP,
            /*
              The site's own extent, not `VENUE_BOUNDS`. That constant is a padded
              search window used for guard tests, so measuring from it would put
              the five-mile boundary further out than the message claims.
            */
            ALL_VENUE_MAP.bounds,
          );

          if (outcome.kind === "inside") {
            setLocated(outcome.position);
            setLocateNote({ tone: "inside", message: outcome.message });
            return;
          }

          /*
            Outside the area, or an unusable coordinate: no marker, and the camera
            stays exactly where the reader left it. A dot dropped somewhere off the
            edge would be a lie about where they are.
          */
          setLocated(null);
          setLocateNote({
            tone: outcome.kind === "outside" ? "outside" : "invalid",
            message: outcome.message,
          });
        },
        (error) => {
          setLocatePending(false);
          setLocated(null);
          setLocateNote({ tone: "denied", message: describeGeoError(error?.code) });
        },
        /*
          A ten-second ceiling and no cached fix. A festival site is exactly where
          a stale position is worst: a phone that answers with where it was an hour
          ago would put the marker in the wrong camping field.
        */
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
      );
    };

    /*
      Ask the Permissions API first, when the browser has it.

      A state of "denied" means no prompt will appear: the reader has refused this
      site before, or a `Permissions-Policy` header has switched the feature off
      for the whole document. Calling `getCurrentPosition` in that state produces
      an error the reader cannot act on, so the honest message is given straight
      away and no doomed request is made.

      This is best effort, so every failure path leads to the ordinary request:
      the API is missing in some browsers, can reject for `geolocation` on older
      Safari, and — the case a plain `.then` would miss — can leave the promise
      unsettled. A hung query would otherwise strand the button on "Finding you…"
      for ever, so a short timer falls through as well.
    */
    const permissions = typeof navigator === "undefined" ? undefined : navigator.permissions;
    if (permissions === undefined || permissions === null || typeof permissions.query !== "function") {
      request();
      return;
    }

    let settled = false;
    const settle = (run: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      run();
    };

    const timer = setTimeout(() => {
      settle(request);
    }, PERMISSION_QUERY_TIMEOUT_MS);

    try {
      void permissions.query({ name: "geolocation" }).then(
        (status) => {
          if (status.state === "denied") {
            settle(() => {
              setLocatePending(false);
              setLocated(null);
              setLocateNote({ tone: "blocked", message: GEOLOCATION_BLOCKED_MESSAGE });
            });
            return;
          }
          settle(request);
        },
        () => {
          settle(request);
        },
      );
    } catch {
      settle(request);
    }
  }, [locatePending]);

  /** Forgets the marker, at the visitor's request, and says so. */
  const handleClearLocate = useCallback(() => {
    setLocated(null);
    setLocateNote({ tone: "cleared", message: "Your location has been cleared from the map." });
  }, []);

  /* ------------------------------------------------------------------ */
  /* Selection                                                           */
  /* ------------------------------------------------------------------ */

  const applyPick = useCallback(
    (node: GeoMapNode) => {
      setInspectedId(node.id);
      if (pickTarget === "from") {
        setRouteEnds((previous) => ({
          ...previous,
          [venueId]: { ...previous[venueId], from: node.id },
        }));
        setPickTarget("to");
        setAnnouncement(`${node.name} is the starting zone, A. Now choose the destination.`);
        return;
      }
      setRouteEnds((previous) => ({
        ...previous,
        [venueId]: { ...previous[venueId], to: node.id },
      }));
      setAnnouncement(`${node.name} is the destination, B.`);
    },
    [pickTarget, venueId],
  );

  const handleSwap = useCallback(() => {
    setRouteEnds((previous) => ({
      ...previous,
      [venueId]: { from: previous[venueId].to, to: previous[venueId].from },
    }));
    setAnnouncement("Starting zone and destination swapped.");
  }, [venueId]);

  const handleCategoryToggle = useCallback((category: MapNodeCategory) => {
    setActiveCategories((previous) => {
      const wasOn = previous.includes(category);
      setAnnouncement(`${CATEGORY_LABELS[category]} ${wasOn ? "hidden" : "shown"}.`);
      return wasOn ? previous.filter((entry) => entry !== category) : [...previous, category];
    });
  }, []);

  const focusNode = useCallback((node: GeoMapNode) => {
    setInspectedId(node.id);
    setFocusRequest({ nodeId: node.id, nonce: Date.now() });
  }, []);

  /* ------------------------------------------------------------------ */
  /* The map                                                             */
  /* ------------------------------------------------------------------ */

  /*
    Mounts MapLibre once. Every later change is pushed into the live map by the
    effects below rather than by re-running this one, so the canvas is never torn
    down and rebuilt because a selection changed.

    Three failure paths all land on `unsupported`: no WebGL, a rejected import,
    and a constructor that throws. Each leaves the list and the figures untouched,
    which is the whole reason the controls are plain HTML.
  */
  useEffect(() => {
    if (!webgl) return;

    let cancelled = false;
    let created: MapLibreMap | null = null;

    const start = async (): Promise<void> => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled) return;

        /*
          Point MapLibre at the worker copy in `public/` before the map exists.
          Its own guess is derived from the bundle's URL and 404s under Turbopack,
          which leaves the canvas mounted and permanently blank.
        */
        configureMapWorker(maplibre);

        const container = containerRef.current;
        if (container === null) return;

        const openingVenue = VENUE_MAPS["de-schorre"];
        created = new maplibre.Map({
          container,
          style: buildMapStyle(),
          // Spread into a mutable pair: `centre` in `geo-types` is a readonly
          // tuple, which MapLibre's `LngLatLike` will not accept.
          center: [openingVenue.centre[0], openingVenue.centre[1]],
          zoom: 15,
          minZoom: 13,
          maxZoom: 17.6,
          /*
            Keeps the camera over Boom and Rumst, so a stray drag cannot leave the
            reader looking at the North Sea with no way back.

            The box is wider than the two venues on purpose: the "Locate me"
            button will mark a visitor anywhere within five miles of the site, and
            a `maxBounds` tight to the festival fence would clamp the camera away
            from their own marker. This spans roughly the five-mile area around
            Boom and Rumst and nothing beyond it.
          */
          maxBounds: [
            [4.19, 50.97],
            [4.59, 51.22],
          ],
          attributionControl: false,
          /*
            A map inside a long page must not swallow the page scroll. Cooperative
            gestures keep a one-finger drag scrolling the document and require two
            fingers to move the map; the panel also offers a "show the whole venue"
            button, so a one-finger or keyboard user is never stuck.
          */
          cooperativeGestures: true,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
        });

        const instance = created;
        mapRef.current = instance;

        instance.on("load", () => {
          if (cancelled) return;
          addSourcesAndLayers(instance);
          setMapReady(true);
        });

        /*
          A failed tile or glyph request is not fatal: the overlays and the route
          are local GeoJSON and still draw. The note under the canvas says so,
          rather than letting the reader mistake a blank patch for open ground.

          The message is matched because MapLibre fires `error` for style and
          rendering faults too, and only the network cases belong to this note.
        */
        instance.on("error", (event) => {
          if (cancelled) return;
          const message = event?.error?.message ?? "";
          if (/fetch|network|failed to load|ajaxerror|4\d\d|5\d\d/i.test(message)) {
            setTilesDegraded(true);
          }
        });
      } catch {
        if (cancelled) return;
        setMapFailed(true);
      }
    };

    void start();

    return () => {
      cancelled = true;
      mapRef.current = null;
      created?.remove();
    };
  }, [webgl]);

  /* Points a press on a marker at the zone behind it. */
  const handleMarkerClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const instance = mapRef.current;
      if (instance === null) return;

      const hit = instance.queryRenderedFeatures(event.point, {
        layers: [...INTERACTIVE_NODE_LAYERS],
      });
      const nodeId = hit[0]?.properties?.id;
      if (typeof nodeId !== "string") return;

      /*
        A cross-venue walk draws an end marker for a zone the current view does
        not hold, so the combined map is searched after the view. Without that
        fallback, pressing the far end of such a walk would do nothing.
      */
      const node = nodeById(VENUE_MAPS[venueId], nodeId) ?? nodeById(ALL_VENUE_MAP, nodeId);
      if (node === null) return;
      applyPick(node);
    },
    [venueId, applyPick],
  );

  /* Re-registers the pointer handlers when the venue or the pick target changes. */
  useEffect(() => {
    const instance = mapRef.current;
    if (instance === null || status !== "ready") return;

    const showPointer = () => {
      instance.getCanvas().style.cursor = "pointer";
    };
    const hidePointer = () => {
      instance.getCanvas().style.cursor = "";
    };

    instance.on("click", handleMarkerClick);
    instance.on("mousemove", showPointer);
    instance.on("mouseout", hidePointer);

    return () => {
      instance.off("click", handleMarkerClick);
      instance.off("mousemove", showPointer);
      instance.off("mouseout", hidePointer);
    };
  }, [handleMarkerClick, status]);

  /* Pushes fresh data in whenever anything the map draws has changed. */
  useEffect(() => {
    if (status !== "ready") return;
    const instance = mapRef.current;
    if (instance === null) return;
    pushCollections(instance, collections);
  }, [status, collections]);

  /* Fits the venue when the switcher changes, and once when the map first loads. */
  useEffect(() => {
    if (status !== "ready") return;
    const instance = mapRef.current;
    if (instance === null) return;

    instance.fitBounds(venueBoundsPair(VENUE_MAPS[venueId]), {
      padding: { top: 48, bottom: 48, left: 32, right: 32 },
      duration: prefersReducedMotion() ? 0 : 900,
      maxZoom: 16.6,
    });
  }, [status, venueId]);

  /* Flies to a zone the reader asked for, from search or from the list. */
  useEffect(() => {
    if (focusRequest === null || status !== "ready") return;
    const instance = mapRef.current;
    if (instance === null) return;

    // A search result on the combined view may be a zone the single-venue map
    // does not hold, so the view is tried first and the combined map second.
    const node = nodeById(VENUE_MAPS[venueId], focusRequest.nodeId) ?? nodeById(ALL_VENUE_MAP, focusRequest.nodeId);
    if (node === null) return;

    const { center, zoom } = nodeFocus(node);
    instance.flyTo({ center, zoom, duration: prefersReducedMotion() ? 0 : 1100 });
  }, [focusRequest, status, venueId]);

  /*
    Brings a freshly plotted position into view.

    The camera settles on the visitor's own dot rather than being fitted to both
    the dot and the nearest zone. Fitting both looks helpful until the reader is
    four miles out: the frame then has to span four miles, which drags the camera
    well outside the site and shrinks the markers to nothing. Centring on the dot
    keeps their position unambiguous, and the note names the nearest zone with
    its distance, so nothing is lost.

    Only a successful inside-area fix sets `located`, so an outside area, a
    refusal or an unusable coordinate leaves the camera exactly where the reader
    left it — which is what stops the button hijacking their view.
  */
  useEffect(() => {
    if (located === null || status !== "ready") return;
    const instance = mapRef.current;
    if (instance === null) return;

    instance.easeTo({
      center: [located[0], located[1]],
      zoom: Math.max(instance.getZoom(), 15.4),
      duration: prefersReducedMotion() ? 0 : 800,
    });
  }, [located, status]);

  /* ------------------------------------------------------------------ */
  /* Handlers                                                            */
  /* ------------------------------------------------------------------ */

  const handleSearch = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const first = filteredNodes[0];
      if (first === undefined) {
        setAnnouncement("No zone matches that search with the categories you have shown.");
        return;
      }
      focusNode(first);
      setAnnouncement(
        filteredNodes.length === 1
          ? `Showing ${first.name}.`
          : `${filteredNodes.length} zones match. Showing ${first.name} first.`,
      );
    },
    [filteredNodes, focusNode],
  );

  const handleResetView = useCallback(() => {
    const instance = mapRef.current;
    if (instance === null) return;
    instance.fitBounds(venueBoundsPair(VENUE_MAPS[venueId]), {
      padding: { top: 48, bottom: 48, left: 32, right: 32 },
      duration: prefersReducedMotion() ? 0 : 700,
      maxZoom: 16.6,
    });
  }, [venueId]);

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  const fromLabel =
    route?.from.name ?? nodeById(map, fromId)?.name ?? nodeById(ALL_VENUE_MAP, fromId)?.name ?? "Not selected";
  const toLabel =
    route?.to.name ?? nodeById(map, toId)?.name ?? nodeById(ALL_VENUE_MAP, toId)?.name ?? "Not selected";
  const sameEnd = fromId === toId;

  return (
    <div className="tml-map-tool">
      <div className="tml-map-disclaimer" role="note" aria-label="Map data disclaimer">
        <span className="tml-map-disclaimer__label">Planning aid, not an official map</span>
        <p>{GEO_DATA_DISCLAIMER}</p>
      </div>

      {/* Changes that are spoken but are already visible elsewhere on the page. */}
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <section className="tool-panel" aria-labelledby={`${uid}-heading`}>
        <div className="tool-panel__head">
          <p className="label text-accent">Venue map</p>
          <h2 id={`${uid}-heading`} className="tool-panel__title">
            {VENUE_LABELS[venueId]}
          </h2>
          <p className="tool-panel__hint">
            {map.name}. Real ground beneath this guide&rsquo;s own zone outlines, with every walk
            measured in miles and minutes.
          </p>
        </div>

        <div className="tml-map-toolbar">
          <div className="tool-segmented" role="group" aria-label="Choose a venue">
            {VENUE_MAP_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className="tool-segmented__option"
                aria-pressed={id === venueId}
                onClick={() => {
                  setVenueId(id);
                  setInspectedId(null);
                  setAnnouncement(`Switched to ${VENUE_LABELS[id]}.`);
                }}
              >
                {id === venueId ? (
                  <span className="tool-segmented__tick" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
                {VENUE_SHORT_LABELS[id]}
              </button>
            ))}
          </div>
        </div>

        <form className="tml-map-search" role="search" onSubmit={handleSearch}>
          <div className="tool-field tml-map-search__field">
            <label className="tool-field__label" htmlFor={`${uid}-search`}>
              Search zones
            </label>
            <input
              id={`${uid}-search`}
              className="tool-input"
              type="search"
              value={query}
              placeholder="Mainstage, lockers, Montagoe…"
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <button type="submit" className="tool-btn tml-map-search__submit">
            Find on map
          </button>
        </form>

        <div className="tml-map-filters">
          <p className="tml-map-filters__label" id={`${uid}-categories-label`}>
            Show categories
          </p>
          <div
            className="tml-map-chips"
            role="group"
            aria-labelledby={`${uid}-categories-label`}
          >
            {MAP_NODE_CATEGORIES.map((category) => {
              const on = activeCategories.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  className="tml-map-chip tml-map-chip--category"
                  aria-pressed={on}
                  onClick={() => handleCategoryToggle(category)}
                >
                  <span
                    className="tml-map-chip__dot"
                    style={{ backgroundColor: CATEGORY_COLOURS[category] }}
                    aria-hidden="true"
                  />
                  {CATEGORY_LABELS[category]}
                </button>
              );
            })}

            <button
              type="button"
              className="tml-map-chip tml-map-chip--category"
              aria-pressed={favouritesOnly}
              onClick={() => {
                const next = !favouritesOnly;
                setFavouritesOnly(next);
                setAnnouncement(next ? "Showing your favourites only." : "Showing every zone.");
              }}
            >
              <span className="tml-map-chip__star" aria-hidden="true">
                ★
              </span>
              Favourites only
            </button>
          </div>
        </div>

        {favouritesWritable ? null : (
          <div className="tool-note tool-note--warning">
            <span className="tool-note__label">Favourites are not being saved</span>
            <p>
              This browser is refusing to store site data, so a favourite will last only until you
              close the page. Everything else here still works.
            </p>
          </div>
        )}
      </section>

      <section className="tool-panel" aria-labelledby={`${uid}-map-heading`}>
        <div className="tml-map-pick-bar">
          <div>
            <h3 id={`${uid}-map-heading`} className="tool-panel__title">
              Map
            </h3>
            <p className="tml-map-pick-bar__hint">
              Tap or click a zone to set it. Currently setting{" "}
              <strong>
                {pickTarget === "from" ? "the starting zone (A)" : "the destination (B)"}
              </strong>
              , and the same choice can be made from the zone list below.
            </p>
          </div>
          <div className="tool-segmented" role="group" aria-label="Which end a tap sets">
            <button
              type="button"
              className="tool-segmented__option"
              aria-pressed={pickTarget === "from"}
              onClick={() => setPickTarget("from")}
            >
              Pick start (A)
            </button>
            <button
              type="button"
              className="tool-segmented__option"
              aria-pressed={pickTarget === "to"}
              onClick={() => setPickTarget("to")}
            >
              Pick destination (B)
            </button>
          </div>
        </div>

        <div className="tml-map-stage">
          <div
            ref={containerRef}
            className="tml-map-canvas"
            /*
              MapLibre puts `role="region"`, a tabindex and its own label on the
              canvas it creates inside this box. The box is a layout element only,
              so it must not claim a role of its own: a labelled region wrapping
              another labelled region reads as a duplicate to a screen reader.
            */
            data-map-ready={status === "ready" ? "true" : "false"}
          />

          {status === "ready" ? null : (
            <div className="tml-map-placeholder">
              <p className="tml-map-placeholder__title">
                {status === "pending" ? "Loading the map…" : "The map cannot run in this browser"}
              </p>
              <p>
                {status === "pending"
                  ? "The zone list below works already, so you can start planning while the tiles arrive."
                  : "This browser has no WebGL, or has it switched off, so the map canvas is unavailable. Everything below still works: search, category filters, favourites, and the walking estimate for any two zones."}
              </p>
            </div>
          )}
        </div>

        {/*
          The locate controls sit outside the "map is ready" branch on purpose.
          A reader without WebGL still benefits from being told which zone they
          are standing nearest, and the note is a sentence rather than a drawn
          dot, so nothing here needs a canvas.
        */}
        <div className="tml-map-locate">
          <div className="tml-map-locate__actions">
            {/*
              `aria-disabled` rather than `disabled`: a genuinely disabled button
              loses keyboard focus the moment it is pressed, which would drop a
              keyboard reader back to the top of the page mid-request. The handler
              already ignores a second press while one is outstanding.
            */}
            <button
              type="button"
              className="tool-btn tml-map-locate__button"
              onClick={handleLocate}
              aria-disabled={locatePending}
              aria-describedby={`${uid}-locate-privacy`}
            >
              <span className="tml-map-locate__icon" aria-hidden="true">
                ◎
              </span>
              {locatePending ? "Finding you…" : "Locate me"}
            </button>

            {located === null ? null : (
              <button type="button" className="tool-btn tool-btn--quiet" onClick={handleClearLocate}>
                Clear my location
              </button>
            )}
          </div>

          <p className="tml-map-locate__privacy" id={`${uid}-locate-privacy`}>
            Your position is worked out by your browser only when you press this button. It is
            never sent to this guide or to anyone else, it is not saved, and it disappears when you
            close the page.
          </p>

          {/*
            One polite live region for the outcome. `aria-atomic` makes the whole
            sentence read rather than just the changed word, and the region is
            always present so the first result is announced too — a live region
            inserted at the same moment as its text is often not read out.
          */}
          <p
            className="tml-map-locate__status"
            data-tone={locateNote?.tone ?? "idle"}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {locateNote?.message ?? ""}
          </p>
        </div>

        {status === "ready" ? (
          <div className="tml-map-stage-controls">
            <button type="button" className="tool-btn tool-btn--quiet" onClick={handleResetView}>
              Show the whole venue
            </button>
            <p className="tml-map-attribution">
              Map data ©{" "}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
              >
                OpenStreetMap
              </a>{" "}
              contributors, via{" "}
              <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">
                OpenFreeMap
              </a>
              . Zone outlines and footpaths are this guide&rsquo;s own estimates.
            </p>
          </div>
        ) : null}

        {tilesDegraded && status === "ready" ? (
          <div className="tool-note tool-note--warning">
            <span className="tool-note__label">Map tiles did not load</span>
            <p>
              You are probably offline, or a network is blocking the tile host. The zone outlines
              and the route are drawn from this guide&rsquo;s own data, so they are still on the
              map, and every figure below is unaffected.
            </p>
          </div>
        ) : null}

        {/*
          The legend repeats the marker badge letter, not just its colour. A
          reader with a colour vision deficiency, or anyone reading a dark phone
          screen at arm's length, can match the letter on the map to the letter
          here without having to judge a shade.
        */}
        <ul className="tml-map-legend" aria-label="Map legend">
          {MAP_NODE_CATEGORIES.map((category) => (
            <li key={category} className="tml-map-legend__item">
              <span
                className="tml-map-legend__badge"
                style={{
                  backgroundColor: CATEGORY_COLOURS[category],
                  color: GROUND_COLOUR,
                }}
                aria-hidden="true"
              >
                {CATEGORY_LETTERS[category]}
              </span>
              {CATEGORY_LABELS[category]}
            </li>
          ))}
          <li className="tml-map-legend__item">
            <span className="tml-map-legend__badge tml-map-legend__badge--end" aria-hidden="true">
              A
            </span>
            Start
          </li>
          <li className="tml-map-legend__item">
            <span className="tml-map-legend__badge tml-map-legend__badge--end" aria-hidden="true">
              B
            </span>
            Destination
          </li>
          <li className="tml-map-legend__item">
            <span
              className="tml-map-legend__swatch tml-map-legend__swatch--route"
              aria-hidden="true"
            />
            Your walk, A to B
          </li>
          <li className="tml-map-legend__item">
            <span className="tml-map-legend__swatch tml-map-legend__swatch--locate" aria-hidden="true" />
            Your location, when you ask for it
          </li>
        </ul>

        {/*
          The key, in words as well as marks. Every list row also names its
          category, so a reader who cannot separate the five colours, or who is
          reading a printed copy, has two independent routes to the same answer.
        */}
        <p className="tml-map-legend__note">
          Markers are colour-coded by category and carry a letter: S stage, E entrance, C camp, F
          facility, T transport. Where two markers are too close for both letters, one letter is
          left off rather than printed twice, and the category is still named in every row of the
          zone list below.
        </p>
      </section>

      <section className="tool-panel" aria-labelledby={`${uid}-route-heading`}>
        <div className="tool-panel__head">
          <p className="label text-accent">A to B route planner</p>
          <h3 id={`${uid}-route-heading`} className="tool-panel__title">
            {route === null ? "Choose two zones" : `${fromLabel} to ${toLabel}`}
          </h3>
          {venueId === "all" ? null : (
            <p className="tool-panel__hint">
              Planning a walk from a campsite field to a stage? Switch to Full site above, where
              both layouts are on one map, joined at the shared DreamVille Gate.
            </p>
          )}
        </div>

        <div className="tml-map-controls">
          <div className="tool-field">
            <label className="tool-field__label" htmlFor={`${uid}-from`}>
              Starting zone (A)
            </label>
            <select
              id={`${uid}-from`}
              className="tool-select"
              value={fromId}
              onChange={(event) => {
                const next = event.target.value;
                setRouteEnds((previous) => ({
                  ...previous,
                  [venueId]: { ...previous[venueId], from: next },
                }));
              }}
            >
              {routeOptions.map((group) =>
                group.label === null ? (
                  group.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name}
                    </option>
                  ))
                ) : (
                  <optgroup key={group.label} label={group.label}>
                    {group.nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name}
                      </option>
                    ))}
                  </optgroup>
                ),
              )}
            </select>
          </div>

          <button type="button" className="tool-btn tml-map-swap" onClick={handleSwap}>
            Swap A ⇄ B
            <span className="sr-only">, the starting zone and the destination zone</span>
          </button>

          <div className="tool-field">
            <label className="tool-field__label" htmlFor={`${uid}-to`}>
              Destination zone (B)
            </label>
            <select
              id={`${uid}-to`}
              className="tool-select"
              value={toId}
              onChange={(event) => {
                const next = event.target.value;
                setRouteEnds((previous) => ({
                  ...previous,
                  [venueId]: { ...previous[venueId], to: next },
                }));
              }}
            >
              {routeOptions.map((group) =>
                group.label === null ? (
                  group.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name}
                    </option>
                  ))
                ) : (
                  <optgroup key={group.label} label={group.label}>
                    {group.nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name}
                      </option>
                    ))}
                  </optgroup>
                ),
              )}
            </select>
          </div>
        </div>

        {route === null ? (
          <p className="tml-map-empty">
            This venue&rsquo;s footpaths do not connect those two zones. Choose another pair.
          </p>
        ) : (
          <>
            <div className="tml-map-readout" aria-live="polite" aria-atomic="true">
              <div className="tml-map-stat tml-map-stat--primary">
                <p className="tml-map-stat__label">Walking time, normal</p>
                <span className="tml-map-stat__value">{route.normalWalkMinutes} min</span>
                <p className="tml-map-stat__sub">
                  At an unhurried festival pace, before any crowd builds.
                </p>
              </div>

              <div className="tml-map-stat">
                <p className="tml-map-stat__label">Walking time, peak</p>
                <span className="tml-map-stat__value">{route.peakWalkMinutes} min</span>
                <p className="tml-map-stat__sub">
                  Headliner changeovers, bridge queues and the closing exodus.
                </p>
              </div>

              <div className="tml-map-stat">
                <p className="tml-map-stat__label">Distance</p>
                <span className="tml-map-stat__value">
                  {formatMiles(route.totalDistanceMiles)}
                </span>
                <p className="tml-map-stat__sub">
                  Along the signed footpaths, across {route.edges.length}{" "}
                  {route.edges.length === 1 ? "leg" : "legs"}.
                </p>
              </div>
            </div>

            {sameEnd ? (
              <p className="tml-map-empty">
                Both ends are the same zone. Choose two different zones to see a walk.
              </p>
            ) : (
              <ol className="tml-map-route-trail" aria-label="Route waypoints">
                {route.nodes.map((node, index) => (
                  <li key={node.id}>
                    {index > 0 ? (
                      <span className="tml-map-route-trail__sep" aria-hidden="true">
                        {" → "}
                      </span>
                    ) : null}
                    <span>{node.name}</span>
                  </li>
                ))}
              </ol>
            )}

            <div className="tml-map-notes" aria-live="polite">
              {route.bottleneckNotes.length > 0 ? (
                <div className="tool-note tool-note--warning">
                  <span className="tool-note__label">Bottlenecks on this walk</span>
                  <ul className="tml-map-note-list">
                    {route.bottleneckNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="tool-note tool-note--info">
                  <span className="tool-note__label">No recorded pinch point</span>
                  <p>
                    No leg of this walk has a recorded bottleneck. Crowd control can still change
                    that on the night.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <section className="tool-panel" aria-labelledby={`${uid}-list-heading`}>
        <div className="tool-panel__head">
          <p className="label text-accent">Zones</p>
          <h3 id={`${uid}-list-heading`} className="tool-panel__title">
            {filteredNodes.length === 0
              ? "No zone matches those filters"
              : `${filteredNodes.length} ${filteredNodes.length === 1 ? "zone" : "zones"}`}
          </h3>
          <p className="tool-panel__hint">
            Every walk on this page can be planned from this list alone, with or without the map.
          </p>
        </div>

        {filteredNodes.length === 0 ? (
          <p className="tml-map-empty">
            Nothing matches that search with the categories you have shown. Clear the search, or
            turn a category back on.
          </p>
        ) : (
          <ul className="tml-map-list">
            {filteredNodes.map((node) => {
              const isStart = node.id === fromId;
              const isEnd = node.id === toId;
              const roleTag = isStart && isEnd ? "A/B" : isStart ? "A" : isEnd ? "B" : "";
              // The star shows the zone's own venue, not the current view, so a
              // zone starred on the combined map and on its own map agree.
              const isFavouriteHere = isFavourite(favouriteVenueFor(node.id), node.id);
              const action =
                pickTarget === "from" ? "set as the starting zone A" : "set as the destination B";

              /*
                WCAG 2.5.3 (Label in Name) is met here by construction rather than
                by a hand-built string.

                This button's visible text is the zone's short label, its A/B
                badge and the "Category · summary" line. An `aria-label` used to
                name only the first two, which axe reports as
                `label-content-name-mismatch` — the control visibly says more than
                its accessible name admits. Rather than duplicating the visible
                text inside a label and hoping the two stay in step, the name is
                now computed straight from the content, with the action appended
                as visually hidden text in the order a reader needs it.
              */
              const alias = node.name === node.shortLabel ? "" : `, also known as ${node.name}`;

              return (
                <li key={node.id} className="tml-map-list__row">
                  <button
                    type="button"
                    className="tml-map-list__select"
                    aria-pressed={isStart || isEnd}
                    onClick={() => {
                      applyPick(node);
                      focusNode(node);
                    }}
                  >
                    <span
                      className="tml-map-list__dot"
                      style={{ backgroundColor: CATEGORY_COLOURS[node.category] }}
                      aria-hidden="true"
                    />
                    <span className="tml-map-list__text">
                      <span className="tml-map-list__name">
                        {node.shortLabel}
                        {/*
                          A real space before the badge, not only CSS padding: the
                          accessible name is built from this text, and "MainstageB"
                          would be read as one word.
                        */}
                        {roleTag === "" ? null : (
                          <>
                            {" "}
                            <span className="tml-map-list__badge">{roleTag}</span>
                          </>
                        )}
                      </span>
                      {/*
                        The action, as visually hidden text.

                        There is deliberately no trailing space. An accessible
                        name is assembled from these separate text nodes and each
                        is whitespace-trimmed first, so a joining space cannot
                        survive — it is gone by the time the name is read. The
                        full stop ending `alias` (or the action) is the boundary
                        instead, which a screen reader treats as the end of a
                        sentence and pauses on.
                      */}
                      <span className="sr-only">{`, ${action}${alias}.`}</span>
                      <span className="tml-map-list__meta">
                        {CATEGORY_LABELS[node.category]} · {node.summary}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="tml-map-list__favourite"
                    aria-label={`${isFavouriteHere ? "Remove" : "Add"} ${node.name} ${
                      isFavouriteHere ? "from" : "to"
                    } favourites`}
                    aria-pressed={isFavouriteHere}
                    onClick={() => handleToggleFavourite(node)}
                  >
                    <span className="tml-map-list__star" aria-hidden="true">
                      {isFavouriteHere ? "★" : "☆"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {inspectedNode === null ? null : (
          <div className="tml-map-inspected">
            <p className="tml-map-inspected__label">Selected zone</p>
            <h4 className="tml-map-inspected__name">{inspectedNode.name}</h4>
            <p>{inspectedNode.summary}</p>
            <p className="tml-map-inspected__note">{inspectedNode.typicalZoneNote}</p>
          </div>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Map plumbing                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Adds the five sources and the layers that read them.
 *
 * Split from the map's construction so the drawing can be described without a
 * WebGL context, and so the layer order is decided in one readable place. Called
 * once, from the map's `load` event, which is the first moment a source may be
 * added.
 */
function addSourcesAndLayers(instance: MapLibreMap): void {
  const empty = asGeoJson({ type: "FeatureCollection", features: [] });

  for (const sourceId of Object.values(SOURCE_IDS)) {
    instance.addSource(sourceId, { type: "geojson", data: empty });
  }

  for (const layer of buildMapLayers()) {
    instance.addLayer(layer);
  }
}

/** Replaces every source's data. Cheap at this size, and keeps the map in step. */
function pushCollections(instance: MapLibreMap, collections: MapCollections): void {
  const write = (sourceId: string, collection: FeatureCollectionLike<unknown>): void => {
    const source = instance.getSource<GeoJSONSource>(sourceId);
    if (source === undefined) return;
    source.setData(asGeoJson(collection));
  };

  write(SOURCE_IDS.overlay, collections.overlay);
  write(SOURCE_IDS.route, collections.route);
  write(SOURCE_IDS.nodes, collections.nodes);
  write(SOURCE_IDS.endpoints, collections.endpoints);
  write(SOURCE_IDS.inspected, collections.inspected);
  write(SOURCE_IDS.locate, collections.locate);
}

export default VenueMapsTool;
