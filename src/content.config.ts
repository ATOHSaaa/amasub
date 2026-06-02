import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('アマサブ編集部'),
    /** audible | kindle-unlimited — CTA・関連記事のマッチングに使用 */
    services: z
      .array(z.enum(['audible', 'kindle-unlimited']))
      .default([]),
    /** 作品名など（読み放題記事向け） */
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    /** OGP用。未指定時はデフォルト画像 */
    ogImage: z.string().optional(),
    /** 記事末尾CTAを上書き（未指定時は services から自動選択） */
    cta: z.enum(['audible', 'kindle-unlimited', 'both', 'none']).optional(),
    /** Creators API でビルド時に取得する商品（ASIN） */
    products: z
      .array(
        z.object({
          asin: z.string().regex(/^[A-Z0-9]{10}$/i),
          label: z.string().optional(),
        }),
      )
      .optional(),
  }),
});

export const collections = { posts };
