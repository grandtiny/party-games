import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourceDirectory = resolve(process.argv[2] ?? "apps/web/public/vendor/ruffle");
const files = (await readdir(sourceDirectory))
  .filter((fileName) => fileName.endsWith(".wasm"))
  .sort();

if (files.length === 0) {
  throw new Error(`No Ruffle WASM files found in ${sourceDirectory}`);
}

for (const fileName of files) {
  const sourcePath = resolve(sourceDirectory, fileName);
  const outputPath = `${sourcePath}.br`;
  const source = await readFile(sourcePath);
  const compressed = brotliCompressSync(source, {
    params: {
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_GENERIC,
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_SIZE_HINT]: source.length
    }
  });
  if (compressed.length >= source.length) {
    throw new Error(`${fileName} did not benefit from Brotli compression`);
  }
  if (!brotliDecompressSync(compressed).equals(source)) {
    throw new Error(`${fileName} failed Brotli round-trip validation`);
  }
  await writeFile(outputPath, compressed);
  console.log(`${fileName}: ${source.length} -> ${compressed.length}`);
}
