import { toBlob } from 'html-to-image';

const defaultMaxExportEdge = 8192;
const defaultMaxExportPixels = 67_108_864;

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
  const blob = node instanceof SVGSVGElement
    ? await renderSvgNodeToBlob(node, dimensions, options.backgroundColor)
    : await toBlob(node as unknown as HTMLElement, {
      backgroundColor: options.backgroundColor ?? '#ffffff',
      cacheBust: true,
      canvasWidth: dimensions.outputWidth,
      canvasHeight: dimensions.outputHeight,
      height: dimensions.sourceHeight,
      pixelRatio: 1,
      skipFonts: true,
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

async function renderSvgNodeToBlob(
  node: SVGSVGElement,
  dimensions: PngExportDimensions,
  backgroundColor = '#ffffff',
): Promise<Blob | null> {  const serializedSvg = serializeSvgForExport(node, dimensions.sourceWidth, dimensions.sourceHeight);
  const svgBlob = new Blob([serializedSvg], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.outputWidth;
    canvas.height = dimensions.outputHeight;

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('PNG export could not acquire a 2D canvas context.');
    }

    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function serializeSvgForExport(
  node: SVGSVGElement,
  width: number,
  height: number,
): string {
  const clone = node.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  if (!clone.hasAttribute('viewBox')) {
    clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }

  return new XMLSerializer().serializeToString(clone);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error('PNG export could not decode the SVG preview.'));
    };
    image.src = src;
  });
}

export async function renderSvgNodeToPngDataUrl(
  node: SVGSVGElement,
  options: {
    sourceWidth: number;
    sourceHeight: number;
    maxEdge?: number;
    backgroundColor?: string;
  },
): Promise<string> {
  const dimensions = calculatePngExportDimensions(options.sourceWidth, options.sourceHeight, {
    maxEdge: options.maxEdge,
  });
  const blob = await renderSvgNodeToBlob(node, dimensions, options.backgroundColor);

  if (!blob) {
    throw new Error('PNG rasterization returned an empty image blob.');
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(String(reader.result));
    };
    reader.onerror = () => {
      reject(new Error('PNG rasterization could not encode the image.'));
    };
    reader.readAsDataURL(blob);
  });
}

export function downloadImageDataUrl(dataUrl: string, fileNameBase: string): void {
  const link = document.createElement('a');
  link.download = createPngFileName(fileNameBase);
  link.href = dataUrl;
  link.click();
}