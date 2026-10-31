import Tesseract from 'tesseract.js';

type Worker = Awaited<ReturnType<typeof Tesseract.createWorker>>;

let workerPromise: Promise<Worker> | null = null;
let progressListener: (message: string) => void = () => {};

export function setOcrProgress(listener: (message: string) => void): void {
  progressListener = listener;
}

function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
        workerPath: asset('tesseract/worker.min.js'),
        corePath: asset('tesseract/core'),
        langPath: asset('tessdata'),
        workerBlobURL: false,
        logger: (message) => {
          if (message.status === 'recognizing text') {
            progressListener(`Reading the card… ${Math.round(message.progress * 100)}%`);
          } else if (message.status) {
            progressListener('Preparing text recognition…');
          }
        },
      });
      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        preserve_interword_spaces: '1',
      });
      return worker;
    })().catch((error: unknown) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

export async function recognizeCard(image: Blob): Promise<string> {
  const worker = await getWorker();
  const result = await worker.recognize(image);
  return result.data.text ?? '';
}
