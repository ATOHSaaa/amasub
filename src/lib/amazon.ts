import { affiliate } from '@/config/site';

const AMAZON_BASE = 'https://www.amazon.co.jp';

/**
 * Amazonアソシエイト付きURLを生成する。
 * tag が未設定の場合は公式URLのみ返す（開発時用）。
 */
export function affiliateUrl(url: string, tag?: string): string {
  const associateTag = tag ?? affiliate.tag;
  if (!associateTag) return url;

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('amazon.co.jp')) {
      return url;
    }
    parsed.searchParams.set('tag', associateTag);
    return parsed.toString();
  } catch {
    return url;
  }
}

/** ASIN から商品ページのアフィリエイトURL */
export function productUrl(asin: string, tag?: string): string {
  return affiliateUrl(`${AMAZON_BASE}/dp/${asin}`, tag);
}

/** Kindle Unlimited / Audible などサービス紹介用の検索URL */
export function searchUrl(keywords: string, tag?: string): string {
  const q = encodeURIComponent(keywords);
  return affiliateUrl(`${AMAZON_BASE}/s?k=${q}`, tag);
}

/**
 * Creators API レスポンスの型（PA-API 後継）。
 * 実際の API 呼び出しは src/lib/creators-api.ts を参照。
 */
export interface CreatorsProduct {
  asin: string;
  title: string;
  detailPageUrl: string;
  imageUrl?: string;
  price?: string;
}
