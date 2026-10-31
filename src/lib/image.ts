export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export async function shrinkImage(blob: Blob, maxEdge: number, quality: number, type = 'image/jpeg'): Promise<Blob> {
  const image = await decodeImage(blob);
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the photo');
  context.drawImage(image, 0, 0, width, height);
  const output = await canvasToBlob(canvas, type, quality);
  if ('close' in image) image.close();
  return output;
}

/** Grayscale and a contrast bump. Business-card type is usually small and gray. */
export async function preprocessForOcr(blob: Blob): Promise<Blob> {
  const image = await decodeImage(blob);
  const longest = Math.max(image.width, image.height);
  const scale = longest < 1400 ? 1400 / longest : Math.min(1, 2000 / longest);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not prepare the scan');
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const data = pixels.data;
  for (let index = 0; index < data.length; index += 4) {
    let gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    gray = (gray - 128) * 1.4 + 128;
    const value = Math.max(0, Math.min(255, gray));
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }
  context.putImageData(pixels, 0, 0);
  const output = await canvasToBlob(canvas, 'image/png');
  if ('close' in image) image.close();
  return output;
}

export async function photoForVCard(blob: Blob): Promise<string> {
  let quality = 0.62;
  let edge = 640;
  let small = await shrinkImage(blob, edge, quality);
  while (small.size > 70_000 && quality > 0.35) {
    quality -= 0.1;
    edge -= 80;
    small = await shrinkImage(blob, Math.max(edge, 320), quality);
  }
  return blobToBase64(small);
}

async function decodeImage(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(blob);
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode the photo'));
    }, type, quality);
  });
}
