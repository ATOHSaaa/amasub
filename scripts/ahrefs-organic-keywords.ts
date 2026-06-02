/**
 * Ahrefs Site Explorer: organic keywords をボリューム順で取得し research/ に保存する。
 *
 * 用法:
 *   AHREFS_API_KEY=xxx npm run ahrefs:keywords
 *   npm run ahrefs:keywords -- --target=unlimilab.com/ --limit=1000 --max-pages=40
 *   npm run ahrefs:keywords -- --target=amasub.tateku.net --order-by=volume_merged:desc
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';

const BASE = 'https://api.ahrefs.com/v3/site-explorer/organic-keywords';

const DEFAULT_SELECT = [
  'keyword_merged',
  'keyword_country',
  'keyword_language',
  'entities',
  'is_branded',
  'is_local',
  'is_navigational',
  'is_informational',
  'is_commercial',
  'is_transactional',
  'serp_features_merged',
  'volume_merged',
  'keyword_difficulty_merged',
  'cpc_merged',
  'sum_traffic',
  'sum_traffic_prev',
  'best_position',
  'best_position_prev',
  'best_position_diff',
  'best_position_url',
  'best_position_url_prev',
  'last_update',
  'language',
].join(',');

interface CliOptions {
  target: string;
  date: string;
  dateCompared: string;
  limit: number;
  maxPages: number;
  country: string;
  orderBy: string;
  select: string;
}

interface KeywordRow {
  keyword_merged?: string;
  volume_merged?: number | null;
  keyword_difficulty_merged?: number | null;
  sum_traffic?: number | null;
  best_position?: number | null;
  best_position_url?: string | null;
  is_informational?: boolean;
  is_commercial?: boolean;
  is_transactional?: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const defaults: CliOptions = {
    target: 'unlimilab.com/',
    date: new Date().toISOString().slice(0, 10),
    dateCompared: '',
    limit: 1000,
    maxPages: 50,
    country: 'jp',
    orderBy: 'volume_merged:desc',
    select: DEFAULT_SELECT,
  };

  for (const arg of argv) {
    if (arg.startsWith('--target=')) defaults.target = arg.slice(9);
    if (arg.startsWith('--date=')) defaults.date = arg.slice(7);
    if (arg.startsWith('--date-compared=')) defaults.dateCompared = arg.slice(16);
    if (arg.startsWith('--limit=')) defaults.limit = Number.parseInt(arg.slice(8), 10) || 1000;
    if (arg.startsWith('--max-pages=')) defaults.maxPages = Number.parseInt(arg.slice(12), 10) || 50;
    if (arg.startsWith('--country=')) defaults.country = arg.slice(10);
    if (arg.startsWith('--order-by=')) defaults.orderBy = arg.slice(11);
    if (arg.startsWith('--select=')) defaults.select = arg.slice(9);
  }

  if (!defaults.dateCompared) {
    const d = new Date(defaults.date);
    d.setDate(d.getDate() - 7);
    defaults.dateCompared = d.toISOString().slice(0, 10);
  }

  return defaults;
}

function orderField(orderBy: string): string {
  return orderBy.split(':')[0] ?? 'volume_merged';
}

async function fetchPage(
  apiKey: string,
  opts: CliOptions,
  where?: string,
): Promise<KeywordRow[]> {
  const params = new URLSearchParams({
    target: opts.target,
    date: opts.date,
    date_compared: opts.dateCompared,
    limit: String(opts.limit),
    order_by: opts.orderBy,
    select: opts.select,
    country: opts.country,
  });
  if (where) params.set('where', where);

  const url = `${BASE}?${params}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const text = await res.text();
  if (!res.ok) {
    if (res.status === 403 && text.includes('Insufficient plan')) {
      throw new Error(
        'HTTP 403: Ahrefs API のプランに Site Explorer / organic-keywords が含まれていません。\n' +
          '  UI から CSV エクスポートするか、API 利用可能なプランへアップグレードしてください。\n' +
          `  詳細: ${text.slice(0, 200)}`,
      );
    }
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 800)}`);
  }

  const data = JSON.parse(text) as { keywords?: KeywordRow[] };
  return data.keywords ?? [];
}

async function fetchAllKeywords(apiKey: string, opts: CliOptions): Promise<KeywordRow[]> {
  const field = orderField(opts.orderBy);
  const all: KeywordRow[] = [];
  const seen = new Set<string>();
  let where: string | undefined;
  let page = 0;

  while (page < opts.maxPages) {
    page += 1;
    const batch = await fetchPage(apiKey, opts, where);
    if (batch.length === 0) break;

    for (const row of batch) {
      const kw = row.keyword_merged?.trim();
      if (!kw || seen.has(kw)) continue;
      seen.add(kw);
      all.push(row);
    }

    const last = batch[batch.length - 1];
    const lastVal = last?.[field as keyof KeywordRow];
    if (batch.length < opts.limit || lastVal == null) break;

    where = JSON.stringify({ field, is: ['lt', lastVal] });
    console.log(`  page ${page}: +${batch.length} (total ${all.length}), next where ${field} < ${lastVal}`);
  }

  return all;
}

type PostMeta = { slug: string; title: string; text: string };

async function loadPosts(): Promise<PostMeta[]> {
  const dir = join(process.cwd(), 'src/content/posts');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
  const posts: PostMeta[] = [];
  for (const file of files) {
    const raw = await readFile(join(dir, file), 'utf8');
    const slug = file.replace(/\.md$/, '');
    const titleMatch = raw.match(/^title:\s*['"](.+?)['"]/m);
    posts.push({
      slug,
      title: titleMatch?.[1] ?? slug,
      text: raw.toLowerCase(),
    });
  }
  return posts;
}

function suggestAction(keyword: string, posts: PostMeta[]): { action: string; match?: string } {
  const k = keyword.toLowerCase();
  const rules: Array<{ test: RegExp; slug: string; action: 'update' | 'skip' }> = [
    { test: /kindle unlimited.*料金|料金.*kindle unlimited/, slug: 'kindle-unlimited-pricing', action: 'update' },
    { test: /kindle unlimited.*解約|解約.*kindle unlimited/, slug: 'kindle-unlimited-cancel', action: 'update' },
    { test: /kindle unlimited.*おすすめ/, slug: 'kindle-unlimited-recommended', action: 'update' },
    { test: /kindle unlimited.*(漫画|マンガ)/, slug: 'manga-subscription-comparison', action: 'update' },
    { test: /(漫画|マンガ).*読み放題|読み放題.*(漫画|マンガ)/, slug: 'manga-subscription-comparison', action: 'update' },
    { test: /電子書籍.*読み放題|読み放題.*電子書籍|本.*サブスク/, slug: 'ebook-subscription-guide', action: 'update' },
    { test: /kindle unlimited.*(小説|ライトノベル|ラノベ)/, slug: 'kindle-unlimited-fiction', action: 'update' },
    { test: /audible.*料金|料金.*audible/, slug: 'audible-pricing', action: 'update' },
    { test: /audible.*解約|解約.*audible/, slug: 'audible-cancel', action: 'update' },
    { test: /オーディオブック.*(無料|おすすめ)/, slug: 'audiobook-recommendations', action: 'update' },
    { test: /audible.*kindle unlimited|kindle unlimited.*audible|違い/, slug: 'ku-vs-audible', action: 'skip' },
    { test: /やめとけ|おすすめしない/, slug: 'kindle-unlimited-not-recommended', action: 'skip' },
    { test: /kindle unlimited.*(対象|探し|検索)/, slug: 'kindle-unlimited-search-books', action: 'update' },
    { test: /kindle unlimited.*ビジネス/, slug: 'kindle-unlimited-business-books', action: 'skip' },
    { test: /kindle scribe|scribe/, slug: 'kindle-scribe-guide', action: 'skip' },
    { test: /audible.*声優|ナレーター/, slug: 'audible-seiyu', action: 'skip' },
  ];

  for (const rule of rules) {
    if (rule.test.test(k)) {
      return { action: rule.action === 'skip' ? '済/維持' : '既存更新', match: rule.slug };
    }
  }

  const hit = posts.find((p) => p.text.includes(k) || k.split(/\s+/).every((w) => w.length > 1 && p.text.includes(w)));
  if (hit) return { action: '既存（要確認）', match: hit.slug };

  if (/kindle unlimited|audible|オーディオブック|電子書籍|読み放題|漫画|マンガ/.test(k)) {
    return { action: '新規候補' };
  }
  return { action: '対象外' };
}

function buildMarkdownPlan(
  opts: CliOptions,
  rows: KeywordRow[],
  posts: PostMeta[],
): string {
  const lines: string[] = [
    `# Ahrefs オーガニックキーワード（ボリューム順）`,
    ``,
    `| 項目 | 値 |`,
    `|------|-----|`,
    `| target | ${opts.target} |`,
    `| date | ${opts.date} |`,
    `| date_compared | ${opts.dateCompared} |`,
    `| order_by | ${opts.orderBy} |`,
    `| 件数 | ${rows.length} |`,
    ``,
    `| # | keyword | volume | KD | traffic | pos | 対応 | 記事 |`,
    `|---|---------|--------|----|---------|-----|------|------|`,
  ];

  rows.forEach((row, i) => {
    const kw = row.keyword_merged ?? '-';
    const { action, match } = suggestAction(kw, posts);
    lines.push(
      `| ${i + 1} | ${kw} | ${row.volume_merged ?? '-'} | ${row.keyword_difficulty_merged ?? '-'} | ${row.sum_traffic ?? '-'} | ${row.best_position ?? '-'} | ${action} | ${match ?? '-'} |`,
    );
  });

  const newCandidates = rows
    .map((r) => ({ kw: r.keyword_merged ?? '', vol: r.volume_merged ?? 0 }))
    .filter(({ kw }) => suggestAction(kw, posts).action === '新規候補')
    .slice(0, 15);

  if (newCandidates.length > 0) {
    lines.push('', '## 新規記事候補（上位）', '');
    for (const { kw, vol } of newCandidates) {
      lines.push(`- **${kw}**（volume: ${vol}）`);
    }
  }

  return lines.join('\n');
}

async function main(): Promise<void> {
  const apiKey = process.env.AHREFS_API_KEY?.trim();
  if (!apiKey) {
    console.error('AHREFS_API_KEY を .env または環境変数に設定してください。');
    process.exit(1);
  }

  const opts = parseArgs(process.argv.slice(2));
  console.log(`target=${opts.target} order_by=${opts.orderBy} limit=${opts.limit}/page max_pages=${opts.maxPages}\n`);

  const rows = await fetchAllKeywords(apiKey, opts);
  const posts = await loadPosts();

  const outDir = join(process.cwd(), 'research');
  await mkdir(outDir, { recursive: true });
  const slug = opts.target.replace(/[^\w.-]+/g, '_').replace(/_+$/, '');
  const baseName = `ahrefs-organic-${slug}-${opts.date}`;

  const jsonPath = join(outDir, `${baseName}.json`);
  const mdPath = join(outDir, `${baseName}.md`);
  const planMd = buildMarkdownPlan(opts, rows, posts);

  await writeFile(jsonPath, JSON.stringify({ keywords: rows }, null, 2), 'utf8');
  await writeFile(mdPath, planMd, 'utf8');

  console.log(`\n保存: ${jsonPath}`);
  console.log(`保存: ${mdPath}\n`);
  console.log(planMd.split('\n').slice(0, 25).join('\n'));
  if (rows.length > 20) console.log(`\n... 他 ${rows.length - 20} 件は ${mdPath} を参照`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
