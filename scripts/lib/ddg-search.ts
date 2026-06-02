import * as cheerio from 'cheerio';
import { search, SafeSearchType, type SearchResult } from 'duck-duck-scrape';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface SerpItem {
  title: string;
  url: string;
  description: string;
}

/** duck-duck-scrape → 失敗時は HTML 版 DuckDuckGo にフォールバック */
export async function fetchSearchResults(
  query: string,
  limit: number,
): Promise<SerpItem[]> {
  try {
    const fromApi = await searchViaLibrary(query, limit);
    if (fromApi.length > 0) return fromApi;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`  ライブラリ検索失敗: ${message}`);
    console.warn('  HTML版 DuckDuckGo にフォールバックします...');
  }

  return searchViaHtml(query, limit);
}

async function searchViaLibrary(
  query: string,
  limit: number,
): Promise<SerpItem[]> {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { results, noResults } = await search(query, {
        safeSearch: SafeSearchType.MODERATE,
        locale: 'jp-jp',
        region: 'jp-jp',
        marketRegion: 'JP',
      });

      if (noResults || !results?.length) return [];

      return results.slice(0, limit).map(mapLibraryResult);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (
        attempt < maxAttempts &&
        (message.includes('anomaly') || message.includes('too quickly'))
      ) {
        await sleep(5000 * attempt);
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

function mapLibraryResult(r: SearchResult): SerpItem {
  return {
    title: stripHtml(r.title),
    url: r.url,
    description: stripHtml(r.description ?? r.rawDescription ?? ''),
  };
}

async function searchViaHtml(query: string, limit: number): Promise<SerpItem[]> {
  const body = new URLSearchParams({ q: query, kl: 'jp-jp' });
  const response = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`HTML検索 HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const items: SerpItem[] = [];

  $('.result').each((_, el) => {
    if (items.length >= limit) return false;

    const row = $(el);
    if (row.hasClass('result--ad') || row.find('.result__badge').text().includes('Ad')) {
      return;
    }

    const link = row.find('a.result__a').first();
    const href = link.attr('href');
    const title = link.text().trim();
    const snippet = row.find('.result__snippet').text().trim();

    if (!href || !title) return;

    const url = normalizeDuckDuckGoUrl(href);
    if (!url.startsWith('http')) return;
    if (/duckduckgo\.com/i.test(url)) return;

    items.push({ title, url, description: snippet });
  });

  if (items.length === 0) {
    throw new Error('HTML検索でも結果を取得できませんでした');
  }

  return items;
}

function normalizeDuckDuckGoUrl(href: string): string {
  if (href.startsWith('//')) return `https:${href}`;

  try {
    const parsed = new URL(href, 'https://duckduckgo.com');

    const uddg = parsed.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);

    const u3 = parsed.searchParams.get('u3');
    if (u3) return decodeURIComponent(u3);

    const rut = parsed.searchParams.get('rut');
    if (rut && rut.startsWith('http')) return rut;
  } catch {
    /* ignore */
  }

  return href;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, '').trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
