export function netlifyImage(src, { width, height, quality = 75, fit = 'cover', position = 'center' } = {}) {
  if (!src || src.startsWith('http')) return src;

  const params = new URLSearchParams({ url: src });
  if (width) params.set('w', String(width));
  if (height) params.set('h', String(height));
  if (quality) params.set('q', String(quality));
  if (fit) params.set('fit', fit);
  if (position) params.set('position', position);

  return `/.netlify/images?${params.toString()}`;
}
