import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const MIME: Record<string, string> = {
  '.js': 'application/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.css': 'text/css',
  '.html': 'text/html; charset=utf-8',
};

/** `astro dev` 時に、直近の `npm run build` で生成した Pagefind を配信する */
export function pagefindDev(): Plugin {
  const root = fileURLToPath(new URL('../../dist/pagefind', import.meta.url));

  return {
    name: 'amasub-pagefind-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/pagefind', (req, res, next) => {
        if (!existsSync(root)) {
          return next();
        }

        const rawPath = (req.url ?? '/').split('?')[0] ?? '/';
        const rel = normalize(decodeURIComponent(rawPath)).replace(/^(\.\.(\/|\\|$))+/, '');
        const filePath = join(root, rel.startsWith('/') ? rel.slice(1) : rel);

        if (!filePath.startsWith(root)) {
          return next();
        }
        if (!existsSync(filePath) || !statSync(filePath).isFile()) {
          return next();
        }

        const type = MIME[extname(filePath)] ?? 'application/octet-stream';
        res.setHeader('Content-Type', type);
        createReadStream(filePath).pipe(res);
      });
    },
  };
}
