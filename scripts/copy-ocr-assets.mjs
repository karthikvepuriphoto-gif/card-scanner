import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const coreSrc = path.join(root, 'node_modules', 'tesseract.js-core');
const coreFiles = [
  'tesseract-core-relaxedsimd-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-lstm.wasm.js',
];

const coreOut = path.join(root, 'public', 'tesseract', 'core');
const tessOut = path.join(root, 'public', 'tessdata');
await mkdir(coreOut, { recursive: true });
await mkdir(tessOut, { recursive: true });

await copyFile(
  path.join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'),
  path.join(root, 'public', 'tesseract', 'worker.min.js'),
);

for (const file of coreFiles) {
  await copyFile(path.join(coreSrc, file), path.join(coreOut, file));
}

const trained = path.join(tessOut, 'eng.traineddata.gz');
try {
  const info = await stat(trained);
  if (info.size > 1_000_000) {
    console.log('OCR assets ready');
    process.exit(0);
  }
} catch {
  // download below
}

const url = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz';
const response = await fetch(url);
if (!response.ok) {
  throw new Error(`Failed to download English OCR data (${response.status})`);
}
const bytes = Buffer.from(await response.arrayBuffer());
const { writeFile } = await import('node:fs/promises');
await writeFile(trained, bytes);
console.log(`OCR assets ready (${bytes.length} byte language file)`);
