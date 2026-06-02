import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, '../assets/og-logo-source.png');
const out = join(root, '../public/og-default.png');

const width = 1200;
const height = 630;
const padding = 96;
const maxLogoW = width - padding * 2;
const maxLogoH = height - padding * 2;

// 透明余白を除いてからリサイズしないと、見た目が中央からずれる
const trimmed = await sharp(src).trim().toBuffer();

const { data: logoPng, info } = await sharp(trimmed)
  .resize(maxLogoW, maxLogoH, { fit: 'inside' })
  .png()
  .toBuffer({ resolveWithObject: true });

const logoW = info.width;
const logoH = info.height;

await sharp({
  create: {
    width,
    height,
    channels: 3,
    background: { r: 255, g: 255, b: 255 },
  },
})
  .composite([
    {
      input: logoPng,
      left: Math.round((width - logoW) / 2),
      top: Math.round((height - logoH) / 2),
    },
  ])
  .png()
  .toFile(out);

console.log(`Wrote ${out} (${width}x${height}, logo ${logoW}x${logoH})`);
