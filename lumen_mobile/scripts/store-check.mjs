#!/usr/bin/env node
/**
 * Verificador único de prontidão para as lojas.
 *
 *   npm run store:check
 *
 * Regra que orienta o arquivo inteiro: **não confundir BLOQUEIO HUMANO com
 * BLOQUEIO TÉCNICO**. Falta de chave de assinatura institucional é decisão de
 * quem opera a conta; `targetSdkVersion` errado é bug. Misturar os dois faz o
 * relatório mentir nas duas direções — some com trabalho de engenharia que
 * ainda falta, e transforma decisão de terceiro em "pendência do time".
 *
 * Sai com código 1 se algum gate TÉCNICO falhar. Gates humanos são reportados
 * como BLOCKED e não derrubam o comando — não há o que codar para resolvê-los.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO = path.dirname(RAIZ);

const PASS = 'PASS';
const FAIL = 'FAIL';
const BLOCKED = 'BLOCKED BY HUMAN';

const resultados = [];
function registrar(area, status, detalhe) {
  resultados.push({ area, status, detalhe });
}

function lerJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 1. Identidade do app
// ---------------------------------------------------------------------------
const appJson = lerJson(path.join(RAIZ, 'app.json'));
const expo = appJson?.expo ?? {};
const pacote = expo.android?.package;
const bundle = expo.ios?.bundleIdentifier;

if (!pacote || !bundle) {
  registrar('Identidade', FAIL, 'android.package ou ios.bundleIdentifier ausente');
} else if (/example|placeholder|changeme|com\.anonymous/i.test(`${pacote}${bundle}`)) {
  registrar('Identidade', FAIL, `identificador placeholder: ${pacote} / ${bundle}`);
} else if (pacote !== bundle) {
  registrar('Identidade', FAIL, `package (${pacote}) != bundle (${bundle})`);
} else {
  registrar('Identidade', PASS, pacote);
}

// ---------------------------------------------------------------------------
// 2. Target SDK — prazo do Google Play
// ---------------------------------------------------------------------------
const alvoEsperado = 36;
// `expo.plugins` mistura strings e tuplas [nome, config]. Nada de .flat() aqui:
// achatar destrói exatamente a estrutura que precisamos ler.
const props = (expo.plugins ?? []).find(
  (p) => Array.isArray(p) && p[0] === 'expo-build-properties'
);
const targetSdk = props?.[1]?.android?.targetSdkVersion;
if (targetSdk === alvoEsperado) {
  registrar('Target SDK', PASS, `targetSdkVersion=${targetSdk} (configurado)`);
} else {
  registrar('Target SDK', FAIL, `esperado ${alvoEsperado}, encontrado ${targetSdk ?? 'ausente'}`);
}

// ---------------------------------------------------------------------------
// 3. Privacy Manifest (iOS)
// ---------------------------------------------------------------------------
const manifests = expo.ios?.privacyManifests;
const categorias = manifests?.NSPrivacyAccessedAPITypes?.length ?? 0;
if (categorias > 0 && manifests?.NSPrivacyTracking === false) {
  registrar('Privacy Manifest', PASS, `${categorias} categorias, tracking=false`);
} else if (categorias > 0) {
  registrar('Privacy Manifest', FAIL, 'NSPrivacyTracking precisa ser declarado explicitamente');
} else {
  registrar('Privacy Manifest', FAIL, 'ios.privacyManifests ausente ou vazio');
}

// ---------------------------------------------------------------------------
// 4. Assinatura — o gate que separa humano de técnico
// ---------------------------------------------------------------------------
try {
  execFileSync(process.execPath, [path.join(RAIZ, 'scripts', 'validate-signing.mjs')], {
    stdio: 'pipe',
  });
  const temCredencial =
    process.env.LUMEN_ANDROID_KEYSTORE_PATH && process.env.LUMEN_ANDROID_KEY_ALIAS;
  if (temCredencial) {
    registrar('Signing', PASS, 'mecanismo OK e credenciais presentes no ambiente');
  } else {
    // O MECANISMO está pronto e testado; o que falta é a chave institucional,
    // que engenharia não pode nem deve gerar.
    registrar('Signing', BLOCKED, 'mecanismo fail-closed OK; falta a chave institucional');
  }
} catch {
  registrar('Signing', FAIL, 'validate-signing.mjs falhou — mecanismo quebrado');
}

// ---------------------------------------------------------------------------
// 5. Metro — a config que impede o crash de inicialização
// ---------------------------------------------------------------------------
const metro = path.join(RAIZ, 'metro.config.js');
if (existsSync(metro) && readFileSync(metro, 'utf8').includes('firebase')) {
  registrar('Metro/Firebase', PASS, 'desvio de resolução do firebase presente');
} else {
  registrar(
    'Metro/Firebase',
    FAIL,
    'sem o desvio, o release crasha com "Component auth has not been registered yet"'
  );
}

// ---------------------------------------------------------------------------
// 6. SDKs proibidos / removidos
// ---------------------------------------------------------------------------
const pkg = lerJson(path.join(RAIZ, 'package.json')) ?? {};
const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
const proibidos = ['@vercel/analytics', 'expo-auth-session', 'expo-web-browser'];
const presentes = proibidos.filter((d) => deps[d]);
if (presentes.length === 0) {
  registrar('SDKs', PASS, 'nenhum SDK removido reintroduzido');
} else {
  registrar('SDKs', FAIL, `reintroduzidos: ${presentes.join(', ')}`);
}

// ---------------------------------------------------------------------------
// 7. Declarações de privacidade — coerência com o que o app coleta
// ---------------------------------------------------------------------------
const decl = path.join(REPO, 'docs', 'store-readiness', 'store-privacy-declarations.md');
if (existsSync(decl)) {
  const txt = readFileSync(decl, 'utf8');
  // As duas categorias sensíveis precisam aparecer declaradas como COLETADAS,
  // nas duas taxonomias. Sub-declarar dado sensível derruba app publicado.
  const declaraReligiao = /religious beliefs|Sensitive Info/i.test(txt);
  const declaraSaude = /Health & Fitness|Health info/i.test(txt);
  // E não pode declarar SDK que foi removido do bundle.
  const citaSdkRemovido = /\|\s*`?@vercel\/analytics`?\s*\|/i.test(txt);

  if (declaraReligiao && declaraSaude && !citaSdkRemovido) {
    registrar('Privacy/Data Safety', PASS, 'crença religiosa e saúde declaradas nas duas lojas');
  } else {
    const faltas = [
      !declaraReligiao && 'crença religiosa',
      !declaraSaude && 'saúde',
      citaSdkRemovido && 'cita SDK removido',
    ].filter(Boolean);
    registrar('Privacy/Data Safety', FAIL, `pendências: ${faltas.join(', ')}`);
  }
} else {
  registrar('Privacy/Data Safety', FAIL, 'store-privacy-declarations.md ausente');
}

// ---------------------------------------------------------------------------
// 8. Artefatos — precisam corresponder a um commit conhecido
// ---------------------------------------------------------------------------
const artDir = path.join(RAIZ, 'build-artifacts');
const apk = path.join(artDir, 'app-release.apk');
const aab = path.join(artDir, 'app-release.aab');
if (existsSync(apk) && existsSync(aab)) {
  const meta = lerJson(path.join(artDir, 'build-info.json'));
  let commitAtual = null;
  try {
    commitAtual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO })
      .toString()
      .trim();
  } catch {
    /* sem git */
  }
  if (meta?.commit && commitAtual && !commitAtual.startsWith(meta.commit)) {
    registrar(
      'Artefatos',
      FAIL,
      `artefatos sao do commit ${meta.commit}, HEAD e ${commitAtual.slice(0, 7)}`
    );
  } else {
    const mb = (p) => (statSync(p).size / 1048576).toFixed(1);
    registrar('Artefatos', PASS, `APK ${mb(apk)} MB · AAB ${mb(aab)} MB`);
  }
} else {
  registrar('Artefatos', FAIL, 'app-release.apk/.aab ausentes em build-artifacts/');
}

// ---------------------------------------------------------------------------
// 9. Contatos e URLs — humanos por natureza
// ---------------------------------------------------------------------------
const extra = expo.extra ?? {};
for (const [rotulo, chave] of [
  ['Contato de suporte', 'supportContactEmail'],
  ['Contato de moderação', 'moderationContactEmail'],
  ['URL de exclusão', 'accountDeletionUrl'],
  ['URL de privacidade', 'privacyPolicyUrl'],
]) {
  const v = extra[chave];
  if (v && !/example\.com|changeme|TODO/i.test(v)) {
    registrar(rotulo, PASS, String(v));
  } else {
    registrar(rotulo, BLOCKED, `expo.extra.${chave} — precisa do valor institucional`);
  }
}

// ---------------------------------------------------------------------------
// 10. Workflows do CI precisam ser YAML válido
// ---------------------------------------------------------------------------
// Um workflow inválido é recusado pelo GitHub ANTES de rodar qualquer passo, e
// o resultado aparece como "falha" sem log — já custou um ciclo inteiro aqui.
const wfDir = path.join(REPO, '.github', 'workflows');
if (existsSync(wfDir)) {
  const { readdirSync } = await import('node:fs');
  const arquivos = readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f));
  const quebrados = arquivos.filter((f) => {
    const txt = readFileSync(path.join(wfDir, f), 'utf8');
    // Heurística barata e específica: linha não-vazia na coluna 0 depois do
    // cabeçalho é o erro que eu cometi (bloco `run: |` com conteúdo desalinhado).
    const linhas = txt.split('\n');
    return linhas.some(
      (l, i) => i > 3 && /^[^\s#-]/.test(l) && !/^(name|on|jobs|env|permissions|concurrency|defaults):/.test(l)
    );
  });
  if (quebrados.length === 0) {
    registrar('Workflows CI', PASS, `${arquivos.length} arquivos com indentação sã`);
  } else {
    registrar('Workflows CI', FAIL, `indentação suspeita: ${quebrados.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------
const larguraArea = Math.max(...resultados.map((r) => r.area.length));
console.log('\nLumen+ — prontidão para submissão\n');
for (const r of resultados) {
  const pontos = '.'.repeat(Math.max(2, larguraArea + 2 - r.area.length));
  console.log(`  ${r.area} ${pontos} ${r.status}`);
  if (r.detalhe) console.log(`      ${r.detalhe}`);
}

const falhas = resultados.filter((r) => r.status === FAIL);
const humanos = resultados.filter((r) => r.status === BLOCKED);

console.log('');
console.log(`  técnicos falhando ... ${falhas.length}`);
console.log(`  aguardando humano ... ${humanos.length}`);
console.log('');

if (falhas.length > 0) {
  console.error('BLOQUEADO POR ENGENHARIA — há trabalho técnico pendente.\n');
  process.exit(1);
}
if (humanos.length > 0) {
  console.log('Sem pendência de engenharia. Aguardando decisões/valores humanos.\n');
  process.exit(0);
}
console.log('Pronto para submissão.\n');
