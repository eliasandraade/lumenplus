// Configuração por ambiente + TRAVA DE PRODUÇÃO.
// Carregado por main.js. Não contém segredos.

const RAW_BASE = __ENV.BASE_URL || '';
export const ENV_NAME = __ENV.ENV_NAME || 'local';
export const OVERRIDE = __ENV.I_UNDERSTAND_THIS_HITS_PRODUCTION === 'yes-really';

// ---------------------------------------------------------------------------
// TRAVA DE PRODUÇÃO
// ---------------------------------------------------------------------------
// Qualquer alvo que case com um destes padrões é recusado. O override existe
// apenas para não deixar a trava indefensável em uma emergência operacional
// futura — NÃO deve ser usado. Carga em produção não é permitida nesta missão.
const PRODUCTION_PATTERNS = [
  /backend-production/i,
  /lumenplus\.vercel\.app/i,
  /(^|\.)lumenplus\.app/i,
  /(^|\/\/)api\.lumenserfeliz/i,
  /lumenserfeliz\.org/i,
];

export function assertNotProduction(url) {
  if (!url) {
    throw new Error('BASE_URL não definida. Ex.: BASE_URL=https://backend-staging.up.railway.app');
  }
  const hit = PRODUCTION_PATTERNS.find((re) => re.test(url));
  if (hit && !OVERRIDE) {
    throw new Error(
      `RECUSADO: "${url}" casa com padrão de PRODUÇÃO (${hit}).\n` +
        'Esta suíte não roda carga em produção. Use o backend de staging.\n' +
        'Se você é operador e sabe exatamente o que está fazendo, defina\n' +
        'I_UNDERSTAND_THIS_HITS_PRODUCTION=yes-really — não use nesta missão.'
    );
  }
  if (hit && OVERRIDE) {
    console.warn(`AVISO GRAVE: executando contra alvo de produção "${url}" por override explícito.`);
  }
  return url;
}

export const BASE_URL = assertNotProduction(RAW_BASE);

// ---------------------------------------------------------------------------
// Thresholds e critérios de aborto
// ---------------------------------------------------------------------------
// Alinhados com o critério de certificação: >2% de erro aborta o estágio.
export const THRESHOLDS = {
  http_req_failed: [{ threshold: 'rate<0.02', abortOnFail: true, delayAbortEval: '20s' }],
  http_req_duration: ['p(95)<2000', 'p(99)<5000'],
  'http_req_duration{journey:open_app}': ['p(95)<1500'],
  checks: ['rate>0.98'],
};

// Tokens sintéticos gerados por seed_synthetic_users.py.
// Em AUTH_MODE=DEV o formato é dev:<uid>:<email> — nenhum usuário real.
export function tokensFromEnv() {
  const raw = __ENV.TOKENS || '';
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) {
    throw new Error('TOKENS vazio. Rode seed_synthetic_users.py e exporte TOKENS=...');
  }
  return list;
}
