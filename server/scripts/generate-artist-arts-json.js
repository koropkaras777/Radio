import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const METADATA = path.resolve(ROOT, "data", "json", "metadata_cache.json");
const ARTS_DIR = path.resolve(ROOT, "media", "arts");
const OUTPUT = path.resolve(ROOT, "data", "json", "artist_arts.json");

function getArtistFromFilename(filename) {
  if (!filename.includes(" - ")) return null;
  return filename.split(" - ")[0].trim().toLowerCase();
}

function run() {
  const metadata = JSON.parse(fs.readFileSync(METADATA, "utf-8"));

  const existingArts = new Set(
    fs.existsSync(ARTS_DIR)
      ? fs.readdirSync(ARTS_DIR).map(f => f.toLowerCase())
      : []
  );

  const artists = new Map();

  for (const filename of Object.keys(metadata.day || {})) {
    const artist = getArtistFromFilename(filename);
    if (!artist) continue;

    if (!artists.has(artist)) {
      const file = `${artist}.jpg`;
      const hasArt = existingArts.has(file);

      artists.set(artist, {
        artist,
        hasArt,
        artFile: hasArt ? file : null
      });
    }
  }

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify([...artists.values()], null, 2),
    "utf-8"
  );

  console.log(`[ArtistArts JSON] Done. Artists: ${artists.size}`);
}

run();
