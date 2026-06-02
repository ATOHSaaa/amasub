import * as cheerio from 'cheerio';

export interface PageOutline {
  rank: number;
  url: string;
  title: string;
  metaDescription: string;
  fetchError?: string;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
  };
  wordCountEstimate: number;
}

const USER_AGENT =
  'Mozilla/5.0 (compatible; AmasubResearchBot/1.0; +https://amasub.tateku.net)';

const FETCH_TIMEOUT_MS = 15_000;

export async function fetchPageOutline(
  url: string,
  meta: { rank: number; title: string; description?: string },
): Promise<PageOutline> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error(`HTML以外: ${contentType}`);
    }

    const html = await response.text();
    return parseHtml(html, url, meta);
  } finally {
    clearTimeout(timeout);
  }
}

function parseHtml(
  html: string,
  url: string,
  meta: { rank: number; title: string; description?: string },
): PageOutline {
  const $ = cheerio.load(html);

  $('script, style, noscript, iframe, nav, footer, header').remove();

  const title =
    $('title').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    meta.title;

  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    meta.description?.trim() ||
    '';

  const h1 = extractHeadings($, 'h1');
  const h2 = extractHeadings($, 'h2');
  const h3 = extractHeadings($, 'h3');

  const bodyText = $('article').length
    ? $('article').text()
    : $('main').length
      ? $('main').text()
      : $('body').text();

  const wordCountEstimate = estimateJapaneseLength(bodyText);

  return {
    rank: meta.rank,
    url,
    title,
    metaDescription,
    headings: { h1, h2, h3 },
    wordCountEstimate,
  };
}

function extractHeadings(
  $: cheerio.CheerioAPI,
  tag: 'h1' | 'h2' | 'h3',
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  $(tag).each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (!text || text.length > 120) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(text);
  });

  return result;
}

/** 日本語・英数字混在テキストのおおよその文字数 */
function estimateJapaneseLength(text: string): number {
  const normalized = text.replace(/\s+/g, '').trim();
  return normalized.length;
}
