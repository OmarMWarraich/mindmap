import { toBlob } from 'html-to-image';

const defaultMaxExportEdge = 4096;
const defaultMaxExportPixels = 16_777_216;

export interface PngExportDimensions {
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
  scale: number;
  wasClamped: boolean;
}

export interface DownloadNodeAsPngOptions {
  fileNameBase: string;
  sourceWidth: number;
  sourceHeight: number;
  backgroundColor?: string;
  maxEdge?: number;
  maxPixels?: number;
}

export function calculatePngExportDimensions(
  sourceWidth: number,
  sourceHeight: number,
  options: {
    maxEdge?: number;
    maxPixels?: number;
  } = {},
): PngExportDimensions {
  const normalizedWidth = Math.max(1, Math.round(sourceWidth));
  const normalizedHeight = Math.max(1, Math.round(sourceHeight));
  const maxEdge = options.maxEdge ?? defaultMaxExportEdge;
  const maxPixels = options.maxPixels ?? defaultMaxExportPixels;
  const edgeScale = Math.min(1, maxEdge / Math.max(normalizedWidth, normalizedHeight));
  const pixelScale = Math.min(1, Math.sqrt(maxPixels / (normalizedWidth * normalizedHeight)));
  const scale = Math.min(edgeScale, pixelScale);

  return {
    sourceWidth: normalizedWidth,
    sourceHeight: normalizedHeight,
    outputWidth: Math.max(1, Math.round(normalizedWidth * scale)),
    outputHeight: Math.max(1, Math.round(normalizedHeight * scale)),
    scale,
    wasClamped: scale < 1,
  };
}

export function createPngFileName(fileNameBase: string): string {
  const slug = fileNameBase
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${slug || 'mindmap'}.png`;
}

export async function downloadNodeAsPng(
  node: HTMLElement | SVGSVGElement,
  options: DownloadNodeAsPngOptions,
): Promise<PngExportDimensions> {
  const dimensions = calculatePngExportDimensions(options.sourceWidth, options.sourceHeight, {
    maxEdge: options.maxEdge,
    maxPixels: options.maxPixels,
  });
  const blob = await toBlob(node as unknown as HTMLElement, {
    backgroundColor: options.backgroundColor ?? '#ffffff',
    cacheBust: true,
    canvasWidth: dimensions.outputWidth,
    canvasHeight: dimensions.outputHeight,
    height: dimensions.sourceHeight,
    pixelRatio: 1,
    width: dimensions.sourceWidth,
  });

  if (!blob) {
    throw new Error('PNG export returned an empty image blob.');
  }

  const downloadUrl = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.download = createPngFileName(options.fileNameBase);
    link.href = downloadUrl;
    link.click();
  } finally {
    URL.revokeObjectURL(downloadUrl);
  }

  return dimensions;
}