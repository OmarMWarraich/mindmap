export const MAX_FILES_PER_UPLOAD = 12;
export const MAX_TOTAL_UPLOAD_BYTES = 12 * 1024 * 1024;

const imageExtensionPattern = /\.(png|jpe?g|gif|bmp|webp|tif|tiff|heic|heif)$/i;

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || imageExtensionPattern.test(file.name);
}

export function approximateBatchBytes(files: File[]): number {
  return files.reduce((total, file) => total + file.size, 0);
}

export async function prepareFilesForUpload(
  files: File[],
  options: { maxFiles?: number; maxTotalBytes?: number } = {},
): Promise<File[]> {
  const maxFiles = options.maxFiles ?? MAX_FILES_PER_UPLOAD;
  const maxTotalBytes = options.maxTotalBytes ?? MAX_TOTAL_UPLOAD_BYTES;

  const selected = files.slice(0, maxFiles);
  if (selected.length === 0) {
    return [];
  }

  const prepared: File[] = [];
  let runningTotal = 0;

  for (const file of selected) {
    const optimized = await optimizeUploadFile(file, maxTotalBytes - runningTotal);

    if (optimized.size === 0) {
      continue;
    }

    if (runningTotal + optimized.size > maxTotalBytes) {
      continue;
    }

    prepared.push(optimized);
    runningTotal += optimized.size;
  }

  return prepared;
}

async function optimizeUploadFile(file: File, remainingBudget: number): Promise<File> {
  if (remainingBudget <= 0) {
    return new File([], file.name, { type: file.type });
  }

  if (!isImageFile(file)) {
    return file.size > remainingBudget ? file : file;
  }

  if (file.size <= Math.min(remainingBudget, 2 * 1024 * 1024)) {
    return file;
  }

  if (typeof document === 'undefined' || typeof HTMLCanvasElement === 'undefined') {
    return file;
  }

  const originalType = file.type || 'image/jpeg';
  const targetType = originalType.includes('png') || originalType.includes('webp') ? 'image/jpeg' : 'image/jpeg';

  const image = await loadImageFromFile(file);
  if (!image) {
    return file;
  }

  const maxDimension = 1800;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext('2d');
  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let quality = 0.82;
  let upperBound = 2 * 1024 * 1024;

  while (quality >= 0.42) {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), targetType, quality);
    });

    if (blob) {
      if (blob.size <= Math.min(remainingBudget, upperBound)) {
        const compressedName = file.name.includes('.')
          ? file.name.replace(/\.[^/.]+$/, '.jpg')
          : `${file.name}.jpg`;
        return new File([blob], compressedName, { type: 'image/jpeg' });
      }
    }

    quality -= 0.12;
    upperBound = Math.max(upperBound * 0.8, 600 * 1024);
  }

  return file;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    image.src = objectUrl;
  });
}
