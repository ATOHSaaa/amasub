import { site } from '@/config/site';

export function canonicalUrl(pathname: string): string {
  const base = site.url.replace(/\/$/, '');
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${path}`;
}

export function absoluteImageUrl(imagePath?: string): string {
  if (!imagePath) return `${site.url}/og-default.png`;
  if (imagePath.startsWith('http')) return imagePath;
  return `${site.url}${imagePath.startsWith('/') ? imagePath : `/${imagePath}`}`;
}
