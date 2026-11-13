import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Fonts ship with the project (from Fontsource) so renders never depend on a font CDN.
const files: [string, string, string][] = [
  ["Playfair Display", "700", "playfair-display-latin-700-normal.woff2"],
  ["Playfair Display", "900", "playfair-display-latin-900-normal.woff2"],
  ["Inter", "500", "inter-latin-500-normal.woff2"],
  ["Inter", "700", "inter-latin-700-normal.woff2"],
  ["Inter", "800", "inter-latin-800-normal.woff2"],
  ["IBM Plex Mono", "500", "ibm-plex-mono-latin-500-normal.woff2"],
  ["IBM Plex Mono", "600", "ibm-plex-mono-latin-600-normal.woff2"],
];
for (const [family, weight, file] of files) loadFont({ family, url: staticFile(`fonts/${file}`), weight, format: "woff2" });

export const serif = "'Playfair Display', Georgia, serif";
export const sans = "Inter, system-ui, sans-serif";
export const mono = "'IBM Plex Mono', ui-monospace, monospace";
