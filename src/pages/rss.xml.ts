import rss from '@astrojs/rss';
import { getPublishedPosts } from '@/lib/posts';
import { site } from '@/config/site';

export async function GET(context: { site: string | undefined }) {
  const posts = await getPublishedPosts();

  return rss({
    title: site.name,
    description: site.description,
    site: context.site ?? site.url,
    xmlns: {
      atom: 'http://www.w3.org/2005/Atom',
    },
    customData: `<language>${site.language}</language>`,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/posts/${post.id}/`,
      author: post.data.author,
    })),
  });
}
