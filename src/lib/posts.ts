import { statSync } from 'node:fs';
import path from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

const POSTS_DIR = path.join(process.cwd(), 'src/content/posts');

/** 一覧・RSS用の並び順（新しい順） */
export function getPostSortTime(post: Post): number {
  const pub = post.data.pubDate.valueOf();
  const updated = post.data.updatedDate?.valueOf();
  if (updated != null && updated > pub) return updated;
  return pub;
}

function getPostMtimeMs(post: Post): number {
  try {
    return statSync(path.join(POSTS_DIR, `${post.id}.md`)).mtimeMs;
  } catch {
    return 0;
  }
}

export function comparePostsNewestFirst(a: Post, b: Post): number {
  const byDate = getPostSortTime(b) - getPostSortTime(a);
  if (byDate !== 0) return byDate;
  return getPostMtimeMs(b) - getPostMtimeMs(a);
}

export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort(comparePostsNewestFirst);
}

export async function getPostBySlug(slug: string): Promise<Post | undefined> {
  const posts = await getPublishedPosts();
  return posts.find((p) => p.id === slug);
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tokyo',
  });
}

export function formatDateISO(date: Date): string {
  return date.toISOString();
}

/** 同じ services / tags で関連記事をスコアリング */
export function getRelatedPosts(
  current: Post,
  allPosts: Post[],
  limit = 4,
): Post[] {
  const others = allPosts.filter((p) => p.id !== current.id);

  const scored = others.map((post) => {
    let score = 0;
    for (const s of current.data.services) {
      if (post.data.services.includes(s)) score += 3;
    }
    for (const t of current.data.tags) {
      if (post.data.tags.includes(t)) score += 2;
    }
    return { post, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || comparePostsNewestFirst(a.post, b.post),
    )
    .slice(0, limit)
    .map((s) => s.post);
}
