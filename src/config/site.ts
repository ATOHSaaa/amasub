export const site = {
  name: 'アマサブ',
  /** 構造化データ・OG用の英字表記 */
  alternateName: 'Amasub',
  tagline: 'Amazonサブスクの選び方・活用法',
  description:
    'Kindle UnlimitedとAudibleを中心に、Amazonの読書・聴書サブスクの比較・活用法・作品の読み放題状況を解説するメディアです。',
  url: 'https://amasub.tadeku.net',
  author: 'アマサブ編集部',
  locale: 'ja_JP',
  language: 'ja',
  email: 'contact@tadeku.net',
  social: {
    x: '',
  },
} as const;

/** サイドバーに表示する編集部プロフィール */
export const editor = {
  name: 'アマサブ編集部',
  role: '編集・運営',
  bio: 'Kindle UnlimitedとAudibleを日常的に利用し、サブスクの比較・活用法や作品の読み放題・聴き放題の状況を調べて発信しています。読む・聴く、どちらも好きな編集チームです。',
  aboutUrl: '/about/',
} as const;

export const affiliate = {
  /** Amazon.co.jp アソシエイトのトラッキングID */
  tag: import.meta.env.PUBLIC_AMAZON_ASSOCIATE_TAG ?? '',
  disclosure:
    '当サイトは、Amazon.co.jpを宣伝しリンクすることによってサイト運営者が紹介料を得られる仕組みを利用しています。',
} as const;

/**
 * CTA・サイト内表示用。料金・手順の詳細は docs/amazon-official-reference.md を正とする。
 */
export const services = {
  'kindle-unlimited': {
    id: 'kindle-unlimited' as const,
    name: 'Kindle Unlimited',
    shortName: 'Kindle Unlimited',
    description: '月額980円で電子書籍が読み放題',
    officialUrl: 'https://www.amazon.co.jp/kindle-dbs/hz/signup',
    /** Creators API / 手動リンク用の検索キーワード */
    asinHint: 'Kindle Unlimited',
  },
  audible: {
    id: 'audible' as const,
    name: 'Audible',
    shortName: 'Audible',
    description: '月額1,500円でオーディオブックが聴き放題',
    officialUrl: 'https://www.amazon.co.jp/hz/audible/mlp',
    asinHint: 'Audible',
  },
} as const;

export type ServiceId = keyof typeof services;
