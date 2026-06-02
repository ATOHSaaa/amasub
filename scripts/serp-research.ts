/**
 * DuckDuckGo 検索上位ページの構成を分析し、記事執筆用レポートを出力する。
 *
 * 用法: npm run research -- "検索クエリ"
 * 例:   npm run research -- "三体 Kindle Unlimited"
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchSearchResults } from './lib/ddg-search.js';
import { fetchPageOutline, type PageOutline } from './lib/fetch-page-outline.js';
import { buildSerpReport, type SerpAnalysis } from './lib/analyze-structure.js';

const DEFAULT_LIMIT = 10;
const FETCH_DELAY_MS = 1200;

interface CliOptions {
  query: string;
  limit: number;
  outDir: string;
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.filter((a) => a !== '--');
  if (args.length === 0) {
    console.error('用法: npm run research -- "<検索クエリ>" [--limit=10]');
    process.exit(1);
  }

  let limit = DEFAULT_LIMIT;
  const queryParts: string[] = [];

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = Math.min(20, Math.max(1, Number.parseInt(arg.slice(8), 10) || DEFAULT_LIMIT));
    } else {
      queryParts.push(arg);
    }
  }

  const query = queryParts.join(' ').trim();
  if (!query) {
    console.error('検索クエリを指定してください。');
    process.exit(1);
  }

  return { query, limit, outDir: join(process.cwd(), 'research') };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u3040-\u30ff\u4e00-\u9fff]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const { query, limit, outDir } = parseArgs(process.argv.slice(2));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  console.log(`\n検索: "${query}"（上位 ${limit} 件を分析）\n`);

  const searchResults = await fetchSearchResults(query, limit);
  if (searchResults.length === 0) {
    console.error('検索結果が取得できませんでした。しばらく待って再試行してください。');
    process.exit(1);
  }

  const pages: PageOutline[] = [];

  for (let i = 0; i < searchResults.length; i++) {
    const item = searchResults[i]!;
    const rank = i + 1;
    console.log(`[${rank}/${searchResults.length}] ${item.title}`);
    console.log(`    ${item.url}`);

    try {
      const outline = await fetchPageOutline(item.url, {
        rank,
        title: item.title,
        description: item.description,
      });
      pages.push(outline);
      console.log(
        `    → H2×${outline.headings.h2.length} / 約${outline.wordCountEstimate}字`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`    スキップ: ${message}`);
      pages.push({
        rank,
        url: item.url,
        title: item.title,
        metaDescription: item.description ?? '',
        fetchError: message,
        headings: { h1: [], h2: [], h3: [] },
        wordCountEstimate: 0,
      });
    }

    if (i < searchResults.length - 1) {
      await sleep(FETCH_DELAY_MS);
    }
  }

  const analysis: SerpAnalysis = buildSerpReport(query, pages);
  const markdown = formatReportMarkdown(analysis);
  const json = JSON.stringify(analysis, null, 2);

  await mkdir(outDir, { recursive: true });
  const baseName = `${timestamp}_${slugify(query) || 'query'}`;
  const mdPath = join(outDir, `${baseName}.md`);
  const jsonPath = join(outDir, `${baseName}.json`);

  await writeFile(mdPath, markdown, 'utf8');
  await writeFile(jsonPath, json, 'utf8');

  console.log(`\nレポート保存:\n   ${mdPath}\n   ${jsonPath}\n`);
  console.log('--- 推奨見出し（案）---');
  for (const h of analysis.recommendedOutline) {
    console.log(`  ## ${h}`);
  }
  if (analysis.uniqueAngles.length > 0) {
    console.log('\n--- 独自視点の候補 ---');
    for (const a of analysis.uniqueAngles) {
      console.log(`  • ${a}`);
    }
  }
  console.log(
    '\n次のステップ: レポートを確認し、docs/seo-article-guide.md に沿って記事を執筆してください。\n',
  );
}

function formatReportMarkdown(analysis: SerpAnalysis): string {
  const lines: string[] = [
    `# SERP分析レポート`,
    ``,
    `- **クエリ:** ${analysis.query}`,
    `- **分析日時:** ${analysis.analyzedAt}`,
    `- **取得ページ数:** ${analysis.pages.length}`,
    ``,
    `> 自動取得のため見出し・文字数は近似値です。執筆前に上位記事を目視確認してください。`,
    ``,
    `## 検索意図の整理（案）`,
    ``,
    analysis.searchIntentNotes,
    ``,
    `## 推奨記事構成（H2案）`,
    ``,
    `競合で頻出する見出し＋アマサブ向けの補強項目を統合した案です。`,
    ``,
    ...analysis.recommendedOutline.map((h) => `- ${h}`),
    ``,
    `## 網羅すべきトピック`,
    ``,
    ...analysis.topicsToCover.map((t) => `- ${t}`),
    ``,
    `## 独自視点の候補`,
    ``,
    ...analysis.uniqueAngles.map((a) => `- ${a}`),
    ``,
    `## 競合に多い見出し（出現回数）`,
    ``,
    `| 見出し（正規化） | 出現 |`,
    `|-----------------|------|`,
    ...analysis.commonHeadings.map((h) => `| ${h.text} | ${h.count} |`),
    ``,
    `## 各ページの詳細`,
    ``,
  ];

  for (const page of analysis.pages) {
    lines.push(`### ${page.rank}. ${page.title || page.url}`);
    lines.push(``);
    lines.push(`- URL: ${page.url}`);
    if (page.metaDescription) {
      lines.push(`- 概要: ${page.metaDescription}`);
    }
    if (page.fetchError) {
      lines.push(`- ⚠ 取得エラー: ${page.fetchError}`);
    } else {
      lines.push(`- 推定文字数: 約${page.wordCountEstimate}字`);
    }
    lines.push(``);
    if (page.headings.h2.length > 0) {
      lines.push(`**H2:**`);
      for (const h of page.headings.h2) {
        lines.push(`- ${h}`);
      }
      lines.push(``);
    }
    if (page.headings.h3.length > 0 && page.headings.h3.length <= 15) {
      lines.push(`**H3（抜粋）:**`);
      for (const h of page.headings.h3.slice(0, 15)) {
        lines.push(`- ${h}`);
      }
      lines.push(``);
    }
  }

  lines.push(`## 記事執筆時の参照`);
  lines.push(``);
  lines.push(`- [docs/seo-article-guide.md](../docs/seo-article-guide.md)`);
  lines.push(`- [docs/amazon-official-reference.md](../docs/amazon-official-reference.md)`);
  lines.push(`- 本レポートの「推奨記事構成」「独自視点」を反映すること`);

  return lines.join('\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
