import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const browser = process.argv[2];

if (!browser) {
    throw new Error("Missing browser argument.");
}

const manifest = (
    await import(`../manifests/${browser}.ts`)
).default;

const outputDirectory = path.resolve("dist", browser);

await mkdir(outputDirectory, {
    recursive: true
});

await writeFile(
    path.join(outputDirectory, "manifest.json"),
    JSON.stringify(manifest, null, 4),
    "utf8"
);

console.log(`✔ Generated ${browser} manifest`);