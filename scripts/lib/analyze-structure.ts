import type { PageOutline } from './fetch-page-outline.js';

export interface HeadingFrequency {
  text: string;
  count: number;
}

export interface SerpAnalysis {
  query: string;
  analyzedAt: string;
  pages: PageOutline[];
  commonHeadings: HeadingFrequency[];
  recommendedOutline: string[];
  topicsToCover: string[];
  uniqueAngles: string[];
  searchIntentNotes: string;
}

/** アマサブ向けに競合が薄い／差別化しやすい見出し候補 */
const AMASUB_ANGLE_TEMPLATES = [
  'Kindle Unlimitedでの確認手順（公式ページの見方）',
  '読み放題対象が変わる理由と、見るべきタイミング',
  'Kindle UnlimitedとAudibleの使い分け（このテーマに関連する場合）',
  '対象外だったときの代替（単品購入・無料サンプル・関連作品）',
  '編集部のチェックリスト（公開前に確認すること）',
];

const NOISE_HEADING =
  /^(目次|もくじ|関連記事|コメント|シェア|おすすめ|人気記事|カテゴリ|タグ|breadcrumb|パンくず|sidebar|footer|menu|navigation|広告|sns|follow|subscribe|newsletter)$/i;

export function buildSerpReport(query: string, pages: PageOutline[]): SerpAnalysis {
  const successful = pages.filter((p) => !p.fetchError);
  const h2Frequency = countHeadingFrequency(successful, 'h2');
  const h3Frequency = countHeadingFrequency(successful, 'h3');

  const recommendedOutline = buildRecommendedOutline(h2Frequency, h3Frequency, query);
  const topicsToCover = buildTopicsList(h2Frequency, h3Frequency, recommendedOutline);
  const uniqueAngles = buildUniqueAngles(
    query,
    successful,
    h2Frequency,
    recommendedOutline,
  );
  const searchIntentNotes = inferSearchIntent(query, successful);

  return {
    query,
    analyzedAt: new Date().toISOString(),
    pages,
    commonHeadings: h2Frequency.slice(0, 20),
    recommendedOutline,
    topicsToCover,
    uniqueAngles,
    searchIntentNotes,
  };
}

function normalizeHeading(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[【】\[\]「」『』]/g, '')
    .toLowerCase();
}

function countHeadingFrequency(
  pages: PageOutline[],
  level: 'h2' | 'h3',
): HeadingFrequency[] {
  const map = new Map<string, { display: string; count: number }>();

  for (const page of pages) {
    const headings = level === 'h2' ? page.headings.h2 : page.headings.h3;
    const seenOnPage = new Set<string>();

    for (const raw of headings) {
      const norm = normalizeHeading(raw);
      if (!norm || norm.length < 2 || NOISE_HEADING.test(norm)) continue;
      if (seenOnPage.has(norm)) continue;
      seenOnPage.add(norm);

      const existing = map.get(norm);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(norm, { display: raw.trim(), count: 1 });
      }
    }
  }

  return [...map.values()]
    .map(({ display, count }) => ({ text: display, count }))
    .sort((a, b) => b.count - a.count);
}

function buildRecommendedOutline(
  h2Freq: HeadingFrequency[],
  h3Freq: HeadingFrequency[],
  query: string,
): string[] {
  const outline: string[] = [];
  const used = new Set<string>();

  const add = (heading: string) => {
    const key = normalizeHeading(heading);
    if (!key || used.has(key)) return;
    used.add(key);
    outline.push(heading);
  };

  // 頻出 H2（2サイト以上）
  for (const { text, count } of h2Freq) {
    if (count >= 2 && outline.length < 8) {
      add(text);
    }
  }

  // 頻出 H3 を H2 候補として昇格（まだ少ない場合）
  if (outline.length < 5) {
    for (const { text, count } of h3Freq) {
      if (count >= 2 && outline.length < 8) {
        add(text);
      }
    }
  }

  // クエリに応じた定番セクション
  if (/kindle unlimited|読み放題|ku/i.test(query)) {
    add('Kindle Unlimitedで読み放題かどうかの確認方法');
    add('読み放題対象外のときの楽しみ方・代替');
  }
  if (/audible|オーディオブック|聴き放題/i.test(query)) {
    add('Audibleで聴き放題かどうかの確認方法');
    add('オーディオブックで聴くメリット・向いている人');
  }
  if (/違い|比較|どっち|おすすめ/i.test(query)) {
    add('料金・プランの比較');
    add('向いている人の違い');
    add('まとめ');
  }

  add('まとめ');

  return outline.slice(0, 10);
}

function buildTopicsList(
  h2Freq: HeadingFrequency[],
  h3Freq: HeadingFrequency[],
  outline: string[],
): string[] {
  const topics = new Set<string>();

  for (const h of outline) {
    topics.add(h);
  }

  for (const { text, count } of [...h2Freq, ...h3Freq]) {
    if (count >= 1) {
      topics.add(text);
    }
  }

  return [...topics].slice(0, 25);
}

function buildUniqueAngles(
  query: string,
  pages: PageOutline[],
  h2Freq: HeadingFrequency[],
  outline: string[],
): string[] {
  const angles: string[] = [];
  const outlineNorm = new Set(outline.map(normalizeHeading));

  // 競合にあまり出てこない H2（1サイトのみだが有用そうなもの）
  for (const { text, count } of h2Freq) {
    if (count === 1 && !outlineNorm.has(normalizeHeading(text))) {
      if (text.length >= 4 && text.length <= 50) {
        angles.push(`競合少数派の切り口: 「${text}」を深掘りする`);
      }
    }
  }

  // アマサブ定番の差別化
  for (const template of AMASUB_ANGLE_TEMPLATES) {
    if (angles.length >= 6) break;
    const relevant =
      /kindle|読み|unlimited/i.test(query)
        ? template.includes('Kindle') || template.includes('読み放題')
        : /audible|聴|オーディオ/i.test(query)
          ? template.includes('Audible')
          : true;
    if (relevant) {
      angles.push(template);
    }
  }

  // 平均文字数より短い競合が多い → 網羅性で勝てる
  const counts = pages.map((p) => p.wordCountEstimate).filter((n) => n > 200);
  if (counts.length > 0) {
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    if (avg < 2500) {
      angles.push(
        `競合の平均文字数は約${Math.round(avg)}字。表・手順・FAQを増やし、${Math.max(3000, Math.round(avg * 1.3))}字前後を目標に網羅性で差別化`,
      );
    }
  }

  return [...new Set(angles)].slice(0, 8);
}

function inferSearchIntent(query: string, pages: PageOutline[]): string {
  const titles = pages.map((p) => p.title).join(' ');
  const descs = pages.map((p) => p.metaDescription).join(' ');

  const blob = `${query} ${titles} ${descs}`;

  if (/読み放題|読める|対象|入って|含ま/i.test(blob)) {
    return (
      '**Know（情報収集）** が中心と推測されます。読者は「今読めるか／聴けるか」「確認方法」を知りたい可能性が高いです。' +
      '結論を先に書き、手順・注意点・代替案まで一通り答える構成が有効です。'
    );
  }
  if (/比較|違い|どっち|おすすめ|選び方/i.test(blob)) {
    return (
      '**Compare（比較）** が中心と推測されます。料金・向いている人・メリットデメリットを表形式で整理し、' +
      '読者の状況別におすすめを提示すると満足度が上がります。'
    );
  }
  if (/使い方|活用法|始め方|お得|無料体験/i.test(blob)) {
    return (
      '**Do（実行）** が中心と推測されます。ステップ形式と注意点を明確にし、' +
      '公式リンクへの誘導（アフィリエイト）を自然に組み込みます。'
    );
  }

  return (
    '検索意図は複合的な可能性があります。上位記事のタイトル・見出しを踏まえ、' +
    '「結論 → 根拠・手順 → 代替・まとめ」の順で網羅してください。'
  );
}
