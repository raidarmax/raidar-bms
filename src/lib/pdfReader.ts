export type PdfExtractionResult = {
  text: string;
  hasTextLayer: boolean;
  pageCount: number;
  pageImages: string[];
};

const MAX_PAGES_TO_RENDER = 3;
const RENDER_SCALE = 2;

const PDFJS_VERSION = '4.10.38';
const PDFJS_CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
const PDFJS_WORKER_CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

let pdfjsPromise: Promise<any> | null = null;

const loadPdfjs = (): Promise<any> => {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = (async () => {
    const mod = await import(/* @vite-ignore */ PDFJS_CDN);
    const lib = (mod as any).default ?? mod;
    if (lib?.GlobalWorkerOptions) {
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
    }
    return lib;
  })();
  return pdfjsPromise;
};

export const isPdfFile = (file: File | { type?: string; name?: string }): boolean => {
  if (!file) return false;
  const type = (file as any).type as string | undefined;
  const name = (file as any).name as string | undefined;
  if (type === 'application/pdf') return true;
  if (name && name.toLowerCase().endsWith('.pdf')) return true;
  return false;
};

export const isPdfUrl = (url: string): boolean => {
  if (!url) return false;
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  return clean.endsWith('.pdf');
};

export const extractPdfContent = async (
  source: File | ArrayBuffer,
  onProgress?: (progress: number) => void,
): Promise<PdfExtractionResult> => {
  const pdfjsLib = await loadPdfjs();
  const buffer = source instanceof File ? await source.arrayBuffer() : source;
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const pageCount = pdf.numPages;
  const textParts: string[] = [];
  const pageImages: string[] = [];

  const pagesToProcess = Math.min(pageCount, MAX_PAGES_TO_RENDER);

  for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
      .join(' ');
    textParts.push(pageText);

    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
      pageImages.push(canvas.toDataURL('image/png'));
    }

    onProgress?.(Math.round((pageNum / pagesToProcess) * 100));
  }

  const combinedText = textParts.join('\n').trim();
  const hasTextLayer = combinedText.replace(/\s+/g, '').length > 40;

  return {
    text: combinedText,
    hasTextLayer,
    pageCount,
    pageImages,
  };
};

export const dataUrlToFile = (dataUrl: string, fileName: string): File => {
  const [meta, base64] = dataUrl.split(',');
  const mimeMatch = meta.match(/data:([^;]+);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new File([arr], fileName, { type: mime });
};
