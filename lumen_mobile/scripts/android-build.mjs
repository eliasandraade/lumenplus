/**
 * Build Android local — contorna a limitação de caminho do Windows.
 *
 * PROBLEMA REAL (medido): o CMake/ninja do Android NDK quebra quando o caminho
 * do projeto contém espaço ou "+". Com o repo em
 *   C:\Users\...\Projeto Lumen+\lumenplus-main\lumen_mobile
 * o build falha em react-native-reanimated com:
 *   ninja: error: mkdir(.../worklets.dir/C_/Users/.../Projeto_Lumen+/...)
 * (o espaço vira "_" e o caminho derivado deixa de existir).
 *
 * Este script detecta o caminho incompatível, espelha o projeto para um
 * diretório limpo, compila lá e traz os artefatos de volta — sem processo
 * manual. Em Linux/macOS (e no CI) compila direto, sem cópia.
 *
 * Uso:
 *   node scripts/android-build.mjs            # debug APK
 *   node scripts/android-build.mjs --release  # release APK + AAB
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE = process.argv.includes('--release');
const IS_WIN = process.platform === 'win32';

/** Caminho incompatível com CMake/ninja: espaço ou caracteres especiais. */
function pathIsHostile(p) {
  return /[ +&()!,;=]/.test(p);
}

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: IS_WIN });
  if (r.status !== 0) {
    console.error(`\nFALHOU: ${cmd} ${args.join(' ')} (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
}

function findAndroidSdk() {
  const env = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (env && existsSync(env)) return env;
  const guesses = IS_WIN
    ? [join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')]
    : [join(os.homedir(), 'Library/Android/sdk'), join(os.homedir(), 'Android/Sdk')];
  for (const g of guesses) if (g && existsSync(g)) return g;
  console.error('ERRO: Android SDK não encontrado. Defina ANDROID_HOME.');
  process.exit(1);
}

const SDK = findAndroidSdk();
process.env.ANDROID_HOME = SDK;
process.env.ANDROID_SDK_ROOT = SDK;

// ---------------------------------------------------------------------------
// 1. Decide onde compilar
// ---------------------------------------------------------------------------
let buildDir = PROJECT;
const hostile = pathIsHostile(PROJECT);

if (hostile) {
  buildDir = IS_WIN ? 'C:\\lumen-build' : join(os.tmpdir(), 'lumen-build');
  console.log(
    `\nAVISO: o caminho do projeto contém espaço/caractere especial:\n  ${PROJECT}\n` +
      `O CMake/ninja do Android NDK falha nesse caso. Espelhando para:\n  ${buildDir}\n`
  );
  mkdirSync(buildDir, { recursive: true });
  if (IS_WIN) {
    // robocopy: 8 = "alguns arquivos copiados" (sucesso); >= 8 é erro real.
    // shell:true no Windows NAO cita argumentos automaticamente — o caminho
    // do projeto tem espaco, entao citamos explicitamente.
    const r = spawnSync(
      'robocopy',
      // /XD com nome simples excluiria QUALQUER pasta com esse nome, inclusive
      // node_modules/@expo/config-plugins/build/ios — o que quebra o prebuild.
      // Por isso excluimos pelo CAMINHO COMPLETO da raiz do projeto.
      [`"${PROJECT}"`, `"${buildDir}"`, '/E', '/MT:16', '/NFL', '/NDL', '/NP',
       '/XD', `"${join(PROJECT, '.git')}"`, `"${join(PROJECT, '.expo')}"`,
       `"${join(PROJECT, 'android')}"`, `"${join(PROJECT, 'ios')}"`,
       `"${join(PROJECT, 'build-artifacts')}"`],
      { stdio: 'inherit', shell: true }
    );
    if ((r.status ?? 0) >= 8) {
      console.error('ERRO ao espelhar o projeto.');
      process.exit(1);
    }
  } else {
    // barra inicial = ancora na raiz (nao afeta pastas homonimas em node_modules)
    run('rsync', ['-a', '--delete', '--exclude=/.git', '--exclude=/.expo',
                  '--exclude=/android', '--exclude=/ios', '--exclude=/build-artifacts',
                  `${PROJECT}/`, `${buildDir}/`]);
  }
} else {
  console.log(`Caminho limpo — compilando no próprio projeto:\n  ${PROJECT}\n`);
}

// ---------------------------------------------------------------------------
// 2. Prebuild + Gradle
// ---------------------------------------------------------------------------
// O portao fail-closed de plugins/withReleaseSigning.js recusa qualquer tarefa
// de release sem perfil declarado. Este script produz artefato de TESTE LOCAL,
// entao declara `releaseTest` — nunca `production`. Um store build de verdade
// sai da esteira institucional, com as credenciais no ambiente, e nao daqui.
if (RELEASE && !process.env.LUMEN_SIGNING_PROFILE) {
  process.env.LUMEN_SIGNING_PROFILE = 'releaseTest';
}
if (RELEASE) {
  console.log(`== perfil de assinatura: ${process.env.LUMEN_SIGNING_PROFILE} ==`);
  if (process.env.LUMEN_SIGNING_PROFILE === 'production') {
    // Deixa o plugin validar e abortar cedo, com mensagem legivel, em vez de
    // descobrir a ausencia de credencial 15 minutos depois, no empacotamento.
    const { validarPerfil } = await import('../plugins/withReleaseSigning.js').then(
      (m) => m.default ?? m
    );
    validarPerfil(process.env);
  }
}

console.log('== prebuild ==');
run('npx', ['expo', 'prebuild', '--platform', 'android', '--clean', '--no-install'], buildDir);

const androidDir = join(buildDir, 'android');
const tasks = RELEASE ? ['assembleRelease', 'bundleRelease'] : ['assembleDebug'];
console.log(`\n== gradle ${tasks.join(' ')} ==`);
const gradlew = join(androidDir, IS_WIN ? 'gradlew.bat' : 'gradlew');
run(gradlew, [...tasks, '--no-daemon'], androidDir);

// ---------------------------------------------------------------------------
// 3. Coleta os artefatos
// ---------------------------------------------------------------------------
const outDir = join(PROJECT, 'build-artifacts');
mkdirSync(outDir, { recursive: true });

function collect(dir, exts) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...collect(full, exts));
    else if (exts.some((e) => entry.endsWith(e))) found.push(full);
  }
  return found;
}

const artifacts = collect(join(androidDir, 'app/build/outputs'), ['.apk', '.aab']);
if (artifacts.length === 0) {
  console.error('\nERRO: nenhum APK/AAB gerado.');
  process.exit(1);
}

console.log('\n== artefatos ==');
let commit = 'desconhecido';
try {
  commit = execSync('git rev-parse --short HEAD', { cwd: PROJECT }).toString().trim();
} catch { /* fora de um repo git */ }

for (const a of artifacts) {
  const dest = join(outDir, a.split(/[\\/]/).pop());
  copyFileSync(a, dest);
  const mb = (statSync(dest).size / 1024 / 1024).toFixed(1);
  console.log(`  ${dest}  (${mb} MB)  commit=${commit}`);
}
console.log('\nOK.');
