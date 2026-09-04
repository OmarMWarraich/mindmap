// Client-safe mirror of the adapter extension lists; must not import adapters
// (image-adapter pulls sharp, which cannot be bundled for the browser).
export const acceptedIngestionExtensions: string[] = [
  'txt', 'md', 'markdown', 'text',
  'pdf',
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tif', 'tiff', 'heic', 'heif',
];
