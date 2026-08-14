/**
 * Gera TODOS os assets do app a partir da identidade visual existente
 * (assets/icon.svg). Não cria identidade nova — apenas rasteriza e enquadra
 * a arte aprovada nos tamanhos exigidos por cada plataforma.
 *
 * Por que existe: os PNGs versionados eram placeholders de 192x192 e 1.328
 * bytes — e além de reprovarem nos requisitos das lojas, eram PNGs INVÁLIDOS:
 * o `expo prebuild` quebrava com
 *   [android.dangerous] Unrecognised filter type - 48
 * ao tentar lê-los com jimp. Ou seja, sem assets válidos o app nem compila.
 *
 * Uso:  node scripts/generate-assets.mjs
 * Requer: sharp (dev). Instale com `npm i -D sharp` se necessário.
 */

import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'assets/icon.svg');

// Cor de fundo institucional já usada em app.json (adaptiveIcon.backgroundColor)
const BRAND_BG = '#1a365d';

if (!existsSync(SRC)) {
  console.error(`ERRO: arte de origem não encontrada em ${SRC}`);
  process.exit(1);
}

const out = (p) => {
  const full = resolve(ROOT, p);
  mkdirSync(dirname(full), { recursive: true });
  return full;
};

/** Ícone quadrado, SEM canal alpha (App Store rejeita ícone com transparência). */
async function opaqueIcon(size, dest) {
  await sharp(SRC, { density: 400 })
    .resize(size, size, { fit: 'contain', background: BRAND_BG })
    .flatten({ background: BRAND_BG })
    .removeAlpha() // App Store rejeita icone com canal alpha
    .png({ compressionLevel: 9 })
    .toFile(out(dest));
}

/** Ícone COM alpha (Android adaptive foreground e notificação). */
async function alphaIcon(size, dest, padRatio = 0) {
  // pad primeiro, depois derive o inner — garante largura final EXATA.
  const pad = Math.round(size * padRatio);
  const inner = size - pad * 2;
  await sharp(SRC, { density: 400 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: pad, bottom: pad, left: pad, right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(out(dest));
}

/** Arte centralizada sobre fundo sólido, em canvas retangular. */
async function onCanvas(w, h, artRatio, dest, { alpha = false } = {}) {
  const art = Math.round(Math.min(w, h) * artRatio);
  const layer = await sharp(SRC, { density: 400 })
    .resize(art, art, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  let img = sharp({
    create: {
      width: w, height: h, channels: 4,
      background: alpha ? { r: 0, g: 0, b: 0, alpha: 0 } : BRAND_BG,
    },
  }).composite([{ input: layer, gravity: 'center' }]);
  if (!alpha) img = img.flatten({ background: BRAND_BG }).removeAlpha();
  await img.png({ compressionLevel: 9 }).toFile(out(dest));
}

/** Ícone monocromático (Android 13+ themed icon): silhueta branca sobre alpha. */
async function monochrome(size, dest) {
  const inner = Math.round(size * 0.62);
  const pad = Math.round((size - inner) / 2);
  const art = await sharp(SRC, { density: 400 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .greyscale()
    .normalise()
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: art, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(out(dest));
}

const TASKS = [
  // --- app (consumidos por app.json / prebuild) ---
  ['icon.png (1024, sem alpha — App Store)', () => opaqueIcon(1024, 'assets/icon.png')],
  ['adaptive-icon.png (1024, foreground c/ safe zone)', () => alphaIcon(1024, 'assets/adaptive-icon.png', 0.18)],
  ['monochrome-icon.png (1024, Android 13+)', () => monochrome(1024, 'assets/monochrome-icon.png')],
  ['notification-icon.png (256, silhueta)', () => monochrome(256, 'assets/notification-icon.png')],
  ['splash.png (2048x2048)', () => onCanvas(2048, 2048, 0.42, 'assets/splash.png')],
  ['favicon.png (48)', () => opaqueIcon(48, 'assets/favicon.png')],

  // --- lojas ---
  ['store: apple icon 1024 (sem alpha)', () => opaqueIcon(1024, '../store-assets/apple/icon-1024.png')],
  ['store: play icon 512 (sem alpha)', () => opaqueIcon(512, '../store-assets/google-play/icon-512.png')],
  ['store: play feature graphic 1024x500', () => onCanvas(1024, 500, 0.62, '../store-assets/google-play/feature-graphic-1024x500.png')],
  ['store: social preview 1200x630', () => onCanvas(1200, 630, 0.5, '../store-assets/social-preview-1200x630.png')],
];

console.log(`Gerando assets a partir de ${SRC}\n`);
let failed = 0;
for (const [label, fn] of TASKS) {
  try {
    await fn();
    console.log(`  OK  ${label}`);
  } catch (e) {
    failed++;
    console.error(`  ERRO ${label}: ${e.message}`);
  }
}
console.log(failed ? `\n${failed} falha(s)` : '\nTodos os assets gerados.');
process.exit(failed ? 1 : 0);
