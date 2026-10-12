import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const src = 'public/icon.svg';
const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
];

await mkdir('public/icons', { recursive: true });
for (const [name, size] of targets) {
  await sharp(src, { density: 384 }).resize(size, size).png().toFile(`public/icons/${name}`);
}
console.log('icons generated');
