/** Convertit un texte en slug ASCII (accents retirés, séparateurs en tirets). */
export function slugify(text: string, fallback = 'item'): string {
  const slug = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug.length > 0 ? slug : fallback;
}
