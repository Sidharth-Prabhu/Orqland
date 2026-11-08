import { MAX_ATTACHMENT_SIZE_BYTES } from './constants';

export interface CompressionResult {
  file: File;
  wasCompressed: boolean;
  originalSize: number;
  compressedSize: number;
}

/**
 * Check if the given file is an image supported by the browser Canvas API
 */
function isCompressibleImage(file: File): boolean {
  const mime = file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return (
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff'].includes(ext)
  );
}

/**
 * Detects whether a canvas contains any transparent pixels
 */
function canvasHasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    // Sample pixels across canvas (skip by step to maintain high performance)
    const imgData = ctx.getImageData(0, 0, width, height).data;
    const step = Math.max(1, Math.floor(imgData.length / 4000)); // Sample ~1000 points
    for (let i = 3; i < imgData.length; i += 4 * step) {
      if (imgData[i] < 250) {
        return true;
      }
    }
  } catch {
    // If getImageData fails due to security or memory, assume false
    return false;
  }
  return false;
}

/**
 * Compresses an image file if it exceeds the maximum size limit (5MB),
 * maintaining high resolution (up to 2880px) and progressive quality
 * to guarantee that visual sharpness and clarity remain pristine.
 *
 * If the file is already within the 5MB limit, it is returned untouched
 * to preserve 100% of the original source bytes.
 */
export async function compressImageIfNeeded(
  file: File,
  maxSizeBytes = MAX_ATTACHMENT_SIZE_BYTES
): Promise<CompressionResult> {
  // If not in a browser environment or not an image, return untouched
  if (typeof window === 'undefined' || !isCompressibleImage(file)) {
    return {
      file,
      wasCompressed: false,
      originalSize: file.size,
      compressedSize: file.size,
    };
  }

  // If already under or equal to maxSizeBytes (5MB), preserve original file with zero re-encoding
  if (file.size <= maxSizeBytes) {
    return {
      file,
      wasCompressed: false,
      originalSize: file.size,
      compressedSize: file.size,
    };
  }

  // Load the image into an HTMLImageElement
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = (e) => reject(new Error('Failed to load image for compression'));
      el.src = objectUrl;
    });

    let { naturalWidth: width, naturalHeight: height } = img;

    // Preserve high resolution: up to 2880px on the longest edge (sharp 3K / 4K retina detail)
    const MAX_DIMENSION = 2880;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      if (width > height) {
        height = Math.round((height * MAX_DIMENSION) / width);
        width = MAX_DIMENSION;
      } else {
        width = Math.round((width * MAX_DIMENSION) / height);
        height = MAX_DIMENSION;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: true });

    if (!ctx) {
      return {
        file,
        wasCompressed: false,
        originalSize: file.size,
        compressedSize: file.size,
      };
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    // Determine output format
    const isPng = file.type.toLowerCase() === 'image/png';
    const hasTransparency = isPng && canvasHasTransparency(ctx, width, height);

    // If transparent PNG, use webp or png with alpha; otherwise JPEG or WebP
    let outputMime = hasTransparency ? 'image/webp' : 'image/jpeg';
    
    // Check if browser supports WebP canvas export
    if (hasTransparency) {
      const testData = canvas.toDataURL('image/webp');
      if (!testData.startsWith('data:image/webp')) {
        outputMime = 'image/png';
      }
    }

    // If opaque, fill background with white before JPEG conversion (prevents black background on transparent inputs)
    if (outputMime === 'image/jpeg') {
      const bgCanvas = document.createElement('canvas');
      bgCanvas.width = width;
      bgCanvas.height = height;
      const bgCtx = bgCanvas.getContext('2d');
      if (bgCtx) {
        bgCtx.fillStyle = '#ffffff';
        bgCtx.fillRect(0, 0, width, height);
        bgCtx.imageSmoothingEnabled = true;
        bgCtx.imageSmoothingQuality = 'high';
        bgCtx.drawImage(canvas, 0, 0);
        // Replace canvas with opaque version
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(bgCanvas, 0, 0);
      }
    }

    // Helper to export canvas to Blob
    const toBlob = (q: number): Promise<Blob | null> => {
      return new Promise((resolve) => canvas.toBlob(resolve, outputMime, q));
    };

    // Progressive high-quality compression scale:
    // Starts at 0.92 (visually lossless) down to 0.78 (still exceptionally crisp on 2880px canvas)
    const qualitySteps = [0.92, 0.88, 0.84, 0.80, 0.76];
    let bestBlob: Blob | null = null;

    for (const q of qualitySteps) {
      const blob = await toBlob(q);
      if (blob) {
        bestBlob = blob;
        if (blob.size <= maxSizeBytes) {
          break;
        }
      }
    }

    // If still over 5MB after quality scale (e.g. extremely detailed 48MP raw texture),
    // scale dimension by 0.8x and encode at quality 0.82
    if (bestBlob && bestBlob.size > maxSizeBytes && (width > 1920 || height > 1920)) {
      const scaledWidth = Math.round(width * 0.8);
      const scaledHeight = Math.round(height * 0.8);
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
      const scaledBlob = await toBlob(0.82);
      if (scaledBlob && scaledBlob.size < bestBlob.size) {
        bestBlob = scaledBlob;
      }
    }

    if (!bestBlob || bestBlob.size >= file.size) {
      // If compression somehow didn't reduce size, keep original
      return {
        file,
        wasCompressed: false,
        originalSize: file.size,
        compressedSize: file.size,
      };
    }

    // Generate output file extension matching output mime
    let ext = '.jpg';
    if (outputMime === 'image/webp') ext = '.webp';
    else if (outputMime === 'image/png') ext = '.png';

    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const newFileName = `${cleanBaseName}${ext}`;

    const compressedFile = new File([bestBlob], newFileName, {
      type: outputMime,
      lastModified: Date.now(),
    });

    return {
      file: compressedFile,
      wasCompressed: true,
      originalSize: file.size,
      compressedSize: compressedFile.size,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
