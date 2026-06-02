import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';
import { pagefindDev } from './src/integrations/vite-pagefind-dev.ts';
import { rehypeAffiliateFirstMention } from './src/plugins/rehype-affiliate-first-mention.ts';

/** XMLサイトマップから除外するパス */
function isExcludedFromSitemap(pathname) {
  if (pathname.includes('404')) return true;
  if (pathname === '/rss.xml' || pathname === '/rss.xml/') return true;
  return false;
}

export default defineConfig({
  site: 'https://amasub.tadeku.net',
  trailingSlash: 'always',
  redirects: {
    '/search': '/',
    '/search/': '/',
  },
  integrations: [
    sitemap({
      filter: (page) => !isExcludedFromSitemap(new URL(page).pathname),
      serialize(item) {
        const pathname = new URL(item.url).pathname;
        if (pathname === '/') {
          return { ...item, changefreq: 'weekly', priority: 1 };
        }
        if (pathname === '/posts/') {
          return { ...item, changefreq: 'weekly', priority: 0.9 };
        }
        if (pathname.startsWith('/posts/') && pathname !== '/posts/') {
          return { ...item, changefreq: 'monthly', priority: 0.8 };
        }
        return item;
      },
    }),
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
    rehypePlugins: [rehypeAffiliateFirstMention],
  },
  vite: {
    plugins: [pagefindDev()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      cssMinify: true,
    },
  },
});
