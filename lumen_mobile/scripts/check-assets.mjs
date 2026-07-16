#!/usr/bin/env node
/**
 * check-assets.mjs — valida as dimensões dos assets de loja (sem dependências).
 * Lê o cabeçalho IHDR do PNG diretamente (largura/altura big-endian).
 * Uso: node scripts/check-assets.mjs   (em lumen_mobile/)
 * Sai com código 1 se algum asset estiver fora de especificação.
 */
import { readFileSync, existsSync } from 'node:fs';

const REQS = [
  { file: 'assets/icon.png', w: 1024, h: 1024, note: 'iOS/geral — quadrado, sem alpha para iOS' },
  { file: 'assets/adaptive-icon.png', w: 1024, h: 1024, note: 'Android adaptive foreground' },
  { file: 'assets/splash.png', minW: 1024, minH: 1024, note: 'splash — grande, centralizado' },
  { file: 'assets/favicon.png', w: 48, h: 48, note: 'web favicon (opcional)' },
];

function pngSize(path) {
  const b = readFileSync(path);
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null; // assinatura PNG
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; // IHDR width/height
}

let fail = 0;
for (const r of REQS) {
  if (!existsSync(r.file)) { console.log(`FALTA     ${r.file} — ${r.note}`); fail++; continue; }
  const s = pngSize(r.file);
  if (!s) { console.log(`INVALIDO  ${r.file} (nao e PNG)`); fail++; continue; }
  const okW = r.w ? s.w === r.w : s.w >= r.minW;
  const okH = r.h ? s.h === r.h : s.h >= r.minH;
  const ok = okW && okH;
  const want = r.w ? `${r.w}x${r.h}` : `>=${r.minW}x${r.minH}`;
  console.log(`${ok ? 'OK   ' : 'FALHA'}     ${r.file}: ${s.w}x${s.h} (requerido ${want}) — ${r.note}`);
  if (!ok) fail++;
}
console.log(`\n${fail === 0 ? 'OK — todos os assets conformes' : fail + ' asset(s) fora de especificacao'}`);
process.exit(fail === 0 ? 0 : 1);
