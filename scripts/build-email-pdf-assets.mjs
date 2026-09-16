import { readFile, writeFile } from "node:fs/promises";

// Source: https://github.com/vercel/geist-font/tree/main/fonts/Geist/ttf
// The bundled fonts use the SIL Open Font License in src/server/email/fonts/OFL.txt.
const directory = new URL("../src/server/email/", import.meta.url);
const assets = {};
for (const [key, name] of [
  ["regular", "Regular"],
  ["medium", "Medium"],
  ["bold", "Bold"],
]) {
  assets[key] = (
    await readFile(new URL(`fonts/Geist-${name}.ttf`, directory))
  ).toString("base64");
}
const logo = await readFile(
  new URL("../public/assets/nnco-logo-group-97.svg", import.meta.url),
  "utf8",
);
assets.logoPaths = [...logo.matchAll(/\sd="([^"]+)"/g)].map(
  (match) => match[1],
);
await writeFile(
  new URL("pdf-assets.json", directory),
  JSON.stringify(assets) + "\n",
);
