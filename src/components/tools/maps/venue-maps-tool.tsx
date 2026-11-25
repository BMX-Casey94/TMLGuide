"use client";

import { useMemo, useState } from "react";
import {
  MAP_SCHEMATIC_DISCLAIMER,
  VENUE_MAPS,
  VENUE_MAP_ORDER,
  type SchematicMapConfig,
  type SchematicMapNode,
  type VenueMapId,
} from "./maps-data";
import { estimateWalkRoute, formatMiles, isEdgeInPath } from "./maps-logic";
import "./maps.css";

type PickTarget = "from" | "to";

export interface VenueMapsToolProps {
  readonly initialMapId?: VenueMapId;
}

function nodeLabelWidth(label: string): number {
  return Math.max(82, label.length * 7.6 + 18);
}

function getNodeRoleTag(nodeId: string, fromId: string, toId: string): string | null {
  if (nodeId === fromId && nodeId === toId) return "A/B";
  if (nodeId === fromId) return "A";
  if (nodeId === toId) return "B";
  return null;
}

export function VenueMapsTool({ initialMapId = "de-schorre" }: VenueMapsToolProps) {
  const [mapId, setMapId] = useState<VenueMapId>(initialMapId);
  const [pickTarget, setPickTarget] = useState<PickTarget>("to");
  const [selectionByMap, setSelectionByMap] = useState<
    Record<VenueMapId, { from: string; to: string }>
  >({
    "de-schorre": {
      from: VENUE_MAPS["de-schorre"].defaultFrom,
      to: VENUE_MAPS["de-schorre"].defaultTo,
    },
    dreamville: {
      from: VENUE_MAPS.dreamville.defaultFrom,
      to: VENUE_MAPS.dreamville.defaultTo,
    },
  });

  const activeMap: SchematicMapConfig = VENUE_MAPS[mapId];
  const { from: fromId, to: toId } = selectionByMap[mapId];

  const estimate = useMemo(
    () => estimateWalkRoute(activeMap, fromId, toId),
    [activeMap, fromId, toId],
  );

  const nodeMap = useMemo(
    () => new Map(activeMap.nodes.map((node) => [node.id, node])),
    [activeMap.nodes],
  );

  const pathNodeSet = useMemo(
    () => new Set(estimate?.pathNodeIds ?? []),
    [estimate?.pathNodeIds],
  );

  function setFrom(nextFrom: string) {
    setSelectionByMap((prev) => ({
      ...prev,
      [mapId]: { ...prev[mapId], from: nextFrom },
    }));
  }

  function setTo(nextTo: string) {
    setSelectionByMap((prev) => ({
      ...prev,
      [mapId]: { ...prev[mapId], to: nextTo },
    }));
  }

  function handleSwap() {
    setSelectionByMap((prev) => ({
      ...prev,
      [mapId]: { from: prev[mapId].to, to: prev[mapId].from },
    }));
  }

  function handleNodeSelect(node: SchematicMapNode) {
    if (pickTarget === "from") {
      setFrom(node.id);
      setPickTarget("to");
    } else {
      setTo(node.id);
    }
  }

  return (
    <div className="tml-map-tool">
      <div className="tml-map-disclaimer" role="note" aria-label="Schematic map disclaimer">
        <span className="tml-map-disclaimer__label">Schematic planning estimate</span>
        <p>{MAP_SCHEMATIC_DISCLAIMER}</p>
      </div>

      <section className="tool-panel" aria-labelledby="tml-map-heading">
        <div className="tool-panel__head">
          <p className="label text-accent">Belgium schematic</p>
          <h2 id="tml-map-heading" className="tool-panel__title">
            {activeMap.title}
          </h2>
          <p className="tool-panel__hint">{activeMap.subtitle}</p>
        </div>

        <div className="tml-map-toolbar">
          <div className="tool-segmented" role="group" aria-label="Choose schematic map">
            {VENUE_MAP_ORDER.map((id) => {
              const cfg = VENUE_MAPS[id];
              const isSelected = id === mapId;
              return (
                <button
                  key={id}
                  type="button"
                  className="tool-segmented__option"
                  aria-pressed={isSelected}
                  onClick={() => setMapId(id)}
                >
                  {isSelected ? (
                    <span className="tool-segmented__tick" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                  {id === "de-schorre" ? "De Schorre (Festival)" : "DreamVille (Camping)"}
                </button>
              );
            })}
          </div>
        </div>

        <div className="tml-map-controls">
          <div className="tool-field">
            <label className="tool-field__label" htmlFor="tml-map-from">
              Starting zone (A)
            </label>
            <select
              id="tml-map-from"
              className="tool-select"
              value={fromId}
              onChange={(event) => setFrom(event.target.value)}
            >
              {activeMap.nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="tool-btn tml-map-swap"
            onClick={handleSwap}
            aria-label="Swap starting zone and destination zone"
          >
            Swap A ⇄ B
          </button>

          <div className="tool-field">
            <label className="tool-field__label" htmlFor="tml-map-to">
              Destination zone (B)
            </label>
            <select
              id="tml-map-to"
              className="tool-select"
              value={toId}
              onChange={(event) => setTo(event.target.value)}
            >
              {activeMap.nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="tool-panel" aria-labelledby="tml-map-diagram-heading">
        <div className="tml-map-pick-bar">
          <div>
            <h3 id="tml-map-diagram-heading" className="tool-panel__title">
              Interactive schematic
            </h3>
            <p className="tml-map-pick-bar__hint">
              Select any zone on the diagram or from the buttons below. Currently setting:{" "}
              <strong>{pickTarget === "from" ? "Starting zone (A)" : "Destination zone (B)"}</strong>.
            </p>
          </div>
          <div className="tool-segmented" role="group" aria-label="Map click target">
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

        <div className="tml-map-canvas-wrap">
          <svg
            className="tml-map-svg"
            viewBox="0 0 800 500"
            role="img"
            aria-label={activeMap.canvasLabel}
          >
            {/* Subtle schematic coordinate grid */}
            <g aria-hidden="true">
              {[100, 200, 300, 400, 500, 600, 700].map((x) => (
                <line key={`vx-${x}`} className="tml-map-grid-line" x1={x} y1={0} x2={x} y2={500} />
              ))}
              {[100, 200, 300, 400].map((y) => (
                <line key={`hy-${y}`} className="tml-map-grid-line" x1={0} y1={y} x2={800} y2={y} />
              ))}
            </g>

            {/* Schematic terrain hints */}
            <g aria-hidden="true">
              {activeMap.backdrop.map((shape) => (
                <g key={shape.id}>
                  <path
                    d={shape.path}
                    className={`tml-map-backdrop--${shape.kind}`}
                  />
                  {shape.label && shape.labelX !== undefined && shape.labelY !== undefined ? (
                    <text
                      x={shape.labelX}
                      y={shape.labelY}
                      textAnchor="middle"
                      className="tml-map-backdrop-label"
                    >
                      {shape.label}
                    </text>
                  ) : null}
                </g>
              ))}
            </g>

            {/* Footpath edges */}
            <g aria-hidden="true">
              {activeMap.edges.map((edge) => {
                const start = nodeMap.get(edge.from);
                const end = nodeMap.get(edge.to);
                if (!start || !end) return null;
                const active = estimate ? isEdgeInPath(edge, estimate.pathNodeIds) : false;
                const midX = (start.x + end.x) / 2;
                const midY = (start.y + end.y) / 2;
                return (
                  <g key={`${edge.from}-${edge.to}`}>
                    <line
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                      className={active ? "tml-map-edge tml-map-edge--active" : "tml-map-edge"}
                    />
                    <text
                      x={midX}
                      y={midY - 6}
                      textAnchor="middle"
                      className={
                        active ? "tml-map-edge-mid tml-map-edge-mid--active" : "tml-map-edge-mid"
                      }
                    >
                      {edge.walkMinutes}m
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Interactive keyboard-focusable nodes */}
            <g>
              {activeMap.nodes.map((node) => {
                const isStart = node.id === fromId;
                const isEnd = node.id === toId;
                const isOnPath = pathNodeSet.has(node.id);
                const roleTag = getNodeRoleTag(node.id, fromId, toId);
                const labelWidth = nodeLabelWidth(node.shortLabel);
                const labelY = node.y > 410 ? node.y - 36 : node.y + 24;

                const nodeClasses = [
                  "tml-map-node",
                  isOnPath ? "tml-map-node--on-path" : "",
                  isStart ? "tml-map-node--start" : "",
                  isEnd ? "tml-map-node--end" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                const stateDescription = isStart && isEnd
                  ? "currently both start and destination"
                  : isStart
                    ? "currently starting zone"
                    : isEnd
                      ? "currently destination zone"
                      : "select zone";

                return (
                  <g
                    key={node.id}
                    className={nodeClasses}
                    role="button"
                    tabIndex={0}
                    aria-label={`${node.name} (${stateDescription})`}
                    aria-pressed={isStart || isEnd}
                    onClick={() => handleNodeSelect(node)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleNodeSelect(node);
                      }
                    }}
                  >
                    <circle className="tml-map-node__halo" cx={node.x} cy={node.y} r={22} />
                    <circle className="tml-map-node__dot" cx={node.x} cy={node.y} r={13} />
                    {roleTag ? (
                      <text
                        x={node.x}
                        y={node.y + 3.5}
                        textAnchor="middle"
                        className="tml-map-node__tag"
                      >
                        {roleTag}
                      </text>
                    ) : null}
                    <rect
                      x={node.x - labelWidth / 2}
                      y={labelY - 12}
                      width={labelWidth}
                      height={22}
                      rx={11}
                      className="tml-map-node__label-bg"
                    />
                    <text
                      x={node.x}
                      y={labelY + 3}
                      textAnchor="middle"
                      className="tml-map-node__label"
                    >
                      {node.shortLabel}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <div className="tml-map-legend" aria-hidden="true">
          <span className="tml-map-legend__item">
            <span className="tml-map-legend__swatch tml-map-legend__swatch--start" />
            Start (A)
          </span>
          <span className="tml-map-legend__item">
            <span className="tml-map-legend__swatch tml-map-legend__swatch--end" />
            Destination (B)
          </span>
          <span className="tml-map-legend__item">
            <span className="tml-map-legend__swatch tml-map-legend__swatch--route" />
            Estimated shortest footpath
          </span>
        </div>

        <div className="tml-map-node-chips" role="group" aria-label="Quick zone selector">
          {activeMap.nodes.map((node) => {
            const isStart = node.id === fromId;
            const isEnd = node.id === toId;
            const chipClass = [
              "tml-map-chip",
              isStart ? "tml-map-chip--start" : "",
              isEnd ? "tml-map-chip--end" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={node.id}
                type="button"
                className={chipClass}
                aria-pressed={isStart || isEnd}
                onClick={() => handleNodeSelect(node)}
              >
                <span>{node.name}</span>
                {isStart ? <span className="tml-map-chip__badge">A</span> : null}
                {isEnd ? <span className="tml-map-chip__badge">B</span> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section
        className="tool-panel"
        aria-labelledby="tml-map-estimate-heading"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="tool-panel__head">
          <p className="label text-accent">Walking-time estimate</p>
          <h3 id="tml-map-estimate-heading" className="tool-panel__title">
            {estimate
              ? `${estimate.from.name} to ${estimate.to.name}`
              : "Select two zones to estimate"}
          </h3>
        </div>

        {estimate ? (
          <>
            <div className="tml-map-readout">
              <div className="tml-map-stat tml-map-stat--primary">
                <p className="tml-map-stat__label">Normal flow</p>
                <span className="tml-map-stat__value">
                  {estimate.isSameZone ? "0 min" : `${estimate.normalMinutes} min`}
                </span>
                <p className="tml-map-stat__sub">
                  Steady walking pace outside major stage changeovers.
                </p>
              </div>

              <div className="tml-map-stat">
                <p className="tml-map-stat__label">Peak changeover</p>
                <span className="tml-map-stat__value">
                  {estimate.isSameZone
                    ? "0 min"
                    : `${estimate.peakMinutesMin}–${estimate.peakMinutesMax} min`}
                </span>
                <p className="tml-map-stat__sub">
                  Busy headliner transitions, bridges, or closing exodus.
                </p>
              </div>

              <div className="tml-map-stat">
                <p className="tml-map-stat__label">Approximate distance</p>
                <span className="tml-map-stat__value">
                  {formatMiles(estimate.distanceMiles)}
                </span>
                <p className="tml-map-stat__sub">
                  Schematic footpath estimate across {estimate.edges.length}{" "}
                  {estimate.edges.length === 1 ? "leg" : "legs"}.
                </p>
              </div>
            </div>

            {!estimate.isSameZone ? (
              <ol className="tml-map-route-trail" aria-label="Estimated route waypoints">
                {estimate.pathNodeIds.map((id, index) => {
                  const waypoint = nodeMap.get(id);
                  if (!waypoint) return null;
                  return (
                    <li key={id}>
                      {index > 0 ? (
                        <span className="tml-map-route-trail__sep" aria-hidden="true">
                          {" → "}
                        </span>
                      ) : null}
                      <span>{waypoint.name}</span>
                    </li>
                  );
                })}
              </ol>
            ) : null}

            <div className="tool-note tool-note--warning">
              <span className="tool-note__label">Crowd-surge note</span>
              <p>{estimate.crowdNote}</p>
            </div>

            <div className="tool-note tool-note--info">
              <span className="tool-note__label">Schematic scope</span>
              <p>{activeMap.stageNote}</p>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
