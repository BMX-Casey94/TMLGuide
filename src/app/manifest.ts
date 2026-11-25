import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TMLGuide",
    short_name: "TMLGuide",
    description:
      "An independent, fan-made guide to Tomorrowland: tickets, sale dates, DreamVille, travel, add-ons and Pearls, with every fact sourced and dated.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0e0b0a",
    theme_color: "#0e0b0a",
    lang: "en-GB",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
