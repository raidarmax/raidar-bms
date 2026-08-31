import Tesseract from 'tesseract.js';
import { isPdfFile, extractPdfContent, dataUrlToFile } from './pdfReader';

export type ExtractedIdData = {
  fullName: string;
  idNumber: string;
  dateOfBirth: string;
  confidence: number;
  rawText: string;
};

export type OcrResult = {
  success: boolean;
  data: ExtractedIdData | null;
  error?: string;
};

const preprocessImage = (image: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          const threshold = avg > 128 ? 255 : 0;
          data[i] = threshold;
          data[i + 1] = threshold;
          data[i + 2] = threshold;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL());
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(image);
  });
};

const parseKenyanId = (text: string): Partial<ExtractedIdData> => {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const result: Partial<ExtractedIdData> = {
    fullName: '',
    idNumber: '',
    dateOfBirth: '',
  };

  const idNumberPattern = /\b\d{5,8}\b/;
  const datePattern = /\b\d{2}[\/\-\.]\d{2}[\/\-\.]\d{2,4}\b/;

  const nameKeywords = ['full name', 'names', 'surname', 'holder'];
  const idKeywords = ['id', 'number', 'no', 'identity'];
  const dobKeywords = ['date of birth', 'dob', 'born', 'birth'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    const nextLine = i + 1 < lines.length ? lines[i + 1] : '';

    if (!result.fullName) {
      const hasNameKeyword = nameKeywords.some(keyword => line.includes(keyword));
      if (hasNameKeyword && nextLine) {
        const cleanName = nextLine
          .replace(/[^a-zA-Z\s]/g, '')
          .trim()
          .split(/\s+/)
          .filter(word => word.length > 1)
          .join(' ');
        if (cleanName.length > 3) {
          result.fullName = cleanName;
        }
      } else if (!line.match(/\d/) && line.length > 10 && line.split(' ').length >= 2) {
        const cleanName = lines[i]
          .replace(/[^a-zA-Z\s]/g, '')
          .trim()
          .split(/\s+/)
          .filter(word => word.length > 1)
          .join(' ');
        if (cleanName.length > 5) {
          result.fullName = cleanName;
        }
      }
    }

    if (!result.idNumber) {
      const hasIdKeyword = idKeywords.some(keyword => line.includes(keyword));
      if (hasIdKeyword) {
        const match = (line + ' ' + nextLine).match(idNumberPattern);
        if (match) {
          result.idNumber = match[0];
        }
      } else {
        const match = lines[i].match(idNumberPattern);
        if (match && match[0].length >= 7) {
          result.idNumber = match[0];
        }
      }
    }

    if (!result.dateOfBirth) {
      const hasDobKeyword = dobKeywords.some(keyword => line.includes(keyword));
      if (hasDobKeyword) {
        const match = (line + ' ' + nextLine).match(datePattern);
        if (match) {
          result.dateOfBirth = match[0];
        }
      } else {
        const match = lines[i].match(datePattern);
        if (match) {
          result.dateOfBirth = match[0];
        }
      }
    }
  }

  const fallbackIdMatch = text.match(idNumberPattern);
  if (!result.idNumber && fallbackIdMatch) {
    result.idNumber = fallbackIdMatch[0];
  }

  return result;
};

export const extractIdData = async (
  imageFile: File,
  onProgress?: (progress: number) => void
): Promise<OcrResult> => {
  try {
    if (isPdfFile(imageFile)) {
      const pdfResult = await extractPdfContent(imageFile, (p) => onProgress?.(Math.round(p * 0.4)));

      let combinedText = pdfResult.text;
      let confidence = pdfResult.hasTextLayer ? 92 : 0;

      if (!pdfResult.hasTextLayer && pdfResult.pageImages.length > 0) {
        const pageResults: { text: string; confidence: number }[] = [];
        for (let i = 0; i < pdfResult.pageImages.length; i++) {
          const pageFile = dataUrlToFile(pdfResult.pageImages[i], `page-${i + 1}.png`);
          const processed = await preprocessImage(pageFile);
          const { data } = await Tesseract.recognize(processed, 'eng', {
            logger: (m) => {
              if (m.status === 'recognizing text' && onProgress) {
                const base = 40 + (i / pdfResult.pageImages.length) * 60;
                const inc = (m.progress / pdfResult.pageImages.length) * 60;
                onProgress(Math.round(base + inc));
              }
            },
          });
          pageResults.push({ text: data.text, confidence: data.confidence });
        }
        combinedText = pageResults.map(r => r.text).join('\n');
        confidence = pageResults.length
          ? pageResults.reduce((a, b) => a + b.confidence, 0) / pageResults.length
          : 0;
      }

      const parsedData = parseKenyanId(combinedText);
      onProgress?.(100);

      return {
        success: true,
        data: {
          fullName: parsedData.fullName || '',
          idNumber: parsedData.idNumber || '',
          dateOfBirth: parsedData.dateOfBirth || '',
          confidence,
          rawText: combinedText,
        },
      };
    }

    const processedImage = await preprocessImage(imageFile);

    const { data } = await Tesseract.recognize(processedImage, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });

    const parsedData = parseKenyanId(data.text);

    const extractedData: ExtractedIdData = {
      fullName: parsedData.fullName || '',
      idNumber: parsedData.idNumber || '',
      dateOfBirth: parsedData.dateOfBirth || '',
      confidence: data.confidence,
      rawText: data.text,
    };

    return {
      success: true,
      data: extractedData,
    };
  } catch (error) {
    console.error('OCR Error:', error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown OCR error',
    };
  }
};

export const compareFields = (
  manualValue: string,
  ocrValue: string
): { match: boolean; similarity: number } => {
  const normalize = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

  const manual = normalize(manualValue);
  const ocr = normalize(ocrValue);

  if (manual === ocr) {
    return { match: true, similarity: 100 };
  }

  if (!manual || !ocr) {
    return { match: false, similarity: 0 };
  }

  const longer = manual.length > ocr.length ? manual : ocr;
  const shorter = manual.length > ocr.length ? ocr : manual;

  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) {
      matches++;
    }
  }

  const similarity = Math.round((matches / longer.length) * 100);
  const match = similarity >= 80;

  return { match, similarity };
};
