#!/usr/bin/env node
/**
 * Validador do portão de assinatura.
 *
 * Prova, sem rodar Gradle, que o plugin `withReleaseSigning` se comporta como
 * declarado — em particular que **produção sem credencial FALHA**, que é a
 * propriedade que impede um artefato assinado com chave de debug de chegar à
 * loja.
 *
 * Nenhum valor de credencial é lido ou impresso: os casos usam valores
 * sintéticos, e a saída cita apenas NOMES de variáveis.
 *
 *   node scripts/validate-signing.mjs
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const plugin = require(path.join(raiz, 'plugins', 'withReleaseSigning.js'));

const { validarPerfil, MSG_PRODUCAO_SEM_CREDENCIAL, ENV_VARS, PERFIL_VAR } = plugin;

// Valores sintéticos — nunca credenciais reais.
const CREDENCIAIS_COMPLETAS = Object.fromEntries(
  ENV_VARS.map((v) => [v, `sintetico-${v.toLowerCase()}`])
);

const CASOS = [
  {
    nome: 'production SEM credencial nenhuma → DEVE FALHAR',
    env: { [PERFIL_VAR]: 'production' },
    esperaErro: true,
  },
  {
    nome: 'production com credencial PARCIAL → DEVE FALHAR',
    env: {
      [PERFIL_VAR]: 'production',
      LUMEN_ANDROID_KEYSTORE_PATH: 'sintetico',
      LUMEN_ANDROID_KEY_ALIAS: 'sintetico',
    },
    esperaErro: true,
  },
  {
    nome: 'production com TODAS as credenciais → permitido, sem debug',
    env: { [PERFIL_VAR]: 'production', ...CREDENCIAIS_COMPLETAS },
    esperaErro: false,
    verifica: (r) => r.modo === 'PRODUCTION' && r.usaDebug === false,
  },
  {
    nome: 'releaseTest sem credencial institucional → permitido (mecanismo de teste)',
    env: { [PERFIL_VAR]: 'releaseTest' },
    esperaErro: false,
    verifica: (r) => r.modo === 'LOCAL TEST RELEASE' && r.usaDebug === true,
  },
  {
    nome: 'releaseTest com keystore efêmero → permitido, sem debug',
    env: { [PERFIL_VAR]: 'releaseTest', ...CREDENCIAIS_COMPLETAS },
    esperaErro: false,
    verifica: (r) => r.modo === 'LOCAL TEST RELEASE' && r.usaDebug === false,
  },
  {
    nome: 'development (sem perfil) → normal',
    env: {},
    esperaErro: false,
    verifica: (r) => r.modo === 'DEVELOPMENT' && r.perfil === null,
  },
];

let falhas = 0;
console.log('\nValidador do portão de assinatura Android\n');

for (const caso of CASOS) {
  let resultado = null;
  let erro = null;
  try {
    resultado = validarPerfil(caso.env);
  } catch (e) {
    erro = e;
  }

  let ok;
  let detalhe;

  if (caso.esperaErro) {
    ok = erro !== null && erro.message.includes(MSG_PRODUCAO_SEM_CREDENCIAL);
    detalhe = erro
      ? `falhou com a mensagem exigida`
      : `NAO falhou (modo=${resultado?.modo})`;
  } else if (erro) {
    ok = false;
    detalhe = `lancou erro inesperado: ${erro.message.split('\n')[0]}`;
  } else {
    ok = caso.verifica ? caso.verifica(resultado) : true;
    detalhe = `modo=${resultado.modo} usaDebug=${resultado.usaDebug}`;
  }

  if (!ok) falhas += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${caso.nome}`);
  console.log(`        ${detalhe}`);
}

// O portão do Gradle é a barreira real; aqui conferimos que ele foi de fato
// injetado no template, com a mensagem exigida.
const fonte = require('node:fs').readFileSync(
  path.join(raiz, 'plugins', 'withReleaseSigning.js'),
  'utf8'
);
const portaoPresente =
  fonte.includes('gradle.taskGraph.whenReady') &&
  fonte.includes('SIGNING MODE: LOCAL TEST RELEASE') &&
  fonte.includes(MSG_PRODUCAO_SEM_CREDENCIAL);
if (!portaoPresente) falhas += 1;
console.log(`  ${portaoPresente ? 'PASS' : 'FAIL'}  portao Gradle injetado com as mensagens exigidas`);

// Nenhuma credencial pode estar escrita no plugin.
const semSegredo = !/(storePassword|keyPassword)\s+["'][^"']+["']/.test(fonte);
if (!semSegredo) falhas += 1;
console.log(`  ${semSegredo ? 'PASS' : 'FAIL'}  nenhuma credencial embutida no plugin`);

console.log('');
if (falhas > 0) {
  console.error(`FALHOU: ${falhas} verificacao(oes) de assinatura.\n`);
  process.exit(1);
}
console.log('Portao de assinatura OK — producao sem credencial recusa build.\n');
