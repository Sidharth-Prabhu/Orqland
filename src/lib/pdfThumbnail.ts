'use client';

// Types for dynamically loaded pdfjsLib
interface PdfPageViewport {
  width: number;
  height: number;
}

interface PdfPage {
  getViewport(params: { scale: number }): PdfPageViewport;
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfPageViewport;
  }): { promise: Promise<void> };
}

interface PdfDocument {
  getPage(pageNumber: number): Promise<PdfPage>;
}

interface PdfJsLib {
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument(params: {
    data: ArrayBuffer;
    cMapUrl?: string;
    cMapPacked?: boolean;
  }): { promise: Promise<PdfDocument> };
}

declare global {
  interface Window {
    pdfjsLib?: PdfJsLib;
  }
}

let pdfjsScriptPromise: Promise<PdfJsLib> | null = null;

function loadPdfJsScript(): Promise<PdfJsLib> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window not available'));
  }

  if (window.pdfjsLib) {
    return Promise.resolve(window.pdfjsLib);
  }

  if (pdfjsScriptPromise) {
    return pdfjsScriptPromise;
  }

  pdfjsScriptPromise = new Promise<PdfJsLib>((resolve, reject) => {
    const existing = document.querySelector('script[src*="pdf.min.js"]');
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.pdfjsLib) resolve(window.pdfjsLib);
        else reject(new Error('PDF.js script loaded but window.pdfjsLib not found'));
      });
      existing.addEventListener('error', () => reject(new Error('Failed to load PDF.js script')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } else {
        reject(new Error('PDF.js loaded but pdfjsLib missing'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js from CDN'));
    document.head.appendChild(script);
  });

  return pdfjsScriptPromise;
}

/**
 * Render the first page of a PDF File or Data URL to a JPEG Data URL.
 */
export async function generatePdfThumbnail(pdfSource: File | string): Promise<string> {
  try {
    const pdfjsLib = await loadPdfJsScript();

    let arrayBuffer: ArrayBuffer;

    if (typeof pdfSource === 'string') {
      if (pdfSource.startsWith('data:')) {
        const base64Data = pdfSource.split(',')[1] || pdfSource;
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
      } else {
        const resp = await fetch(pdfSource);
        arrayBuffer = await resp.arrayBuffer();
      }
    } else {
      arrayBuffer = await pdfSource.arrayBuffer();
    }

    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
      cMapPacked: true,
    });

    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    // Render at viewport suitable for crisp thumbnail (~320px wide)
    const baseViewport = page.getViewport({ scale: 1.0 });
    const targetWidth = 320;
    const scale = targetWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    return canvas.toDataURL('image/jpeg', 0.85);
  } catch (err) {
    console.error('Failed to generate PDF thumbnail:', err);
    return '';
  }
}
