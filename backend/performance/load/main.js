// Suíte de carga Lumen+ — perfis A/B/C/D.
//
// SEGURANÇA: nenhum cenário dispara e-mail real, push real, integração paga ou
// escrita em dado real. As escritas do Perfil D são idempotentes e usam apenas
// usuários sintéticos criados por seed_synthetic_users.py.
//
// Uso:
//   k6 run -e BASE_URL=https://backend-staging.up.railway.app -e TOKENS=... \
//          -e PROFILE=A -e VUS=50 -e DURATION=2m main.js

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { BASE_URL, THRESHOLDS, tokensFromEnv, ENV_NAME } from './config.js';

const TOKENS = tokensFromEnv();
const PROFILE = (__ENV.PROFILE || 'A').toUpperCase();
const VUS = parseInt(__ENV.VUS || '10', 10);
const DURATION = __ENV.DURATION || '1m';

export const journeyDuration = new Trend('journey_duration', true);
export const journeyErrors = new Rate('journey_errors');

export const options = {
  scenarios: {
    main: {
      executor: __ENV.RAMP === '1' ? 'ramping-vus' : 'constant-vus',
      ...(__ENV.RAMP === '1'
        ? {
            startVUs: 0,
            // Ramp da certificação: 10 -> 25 -> 50 -> 100 -> 150 -> 200 -> 250
            stages: [
              { duration: '30s', target: 10 },
              { duration: '1m', target: 25 },
              { duration: '1m', target: 50 },
              { duration: '1m', target: 100 },
              { duration: '1m', target: 150 },
              { duration: '2m', target: 200 },
              { duration: '3m', target: 250 },
              { duration: '2m', target: 250 }, // sustentado
              { duration: '30s', target: 0 },  // recuperação
            ],
          }
        : { vus: VUS, duration: DURATION }),
    },
  },
  thresholds: THRESHOLDS,
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function authHeaders() {
  const t = TOKENS[Math.floor(Math.random() * TOKENS.length)];
  return { headers: { Authorization: `Bearer ${t}` } };
}

function hit(name, path, params, tags) {
  const res = http.get(`${BASE_URL}${path}`, { ...params, tags: { ...tags, endpoint: name } });
  const ok = check(res, { [`${name} 2xx`]: (r) => r.status >= 200 && r.status < 300 });
  journeyErrors.add(!ok);
  return res;
}

// --- Perfil A: abertura do aplicativo -------------------------------------
function profileA() {
  const t0 = Date.now();
  group('open_app', () => {
    const a = authHeaders();
    hit('health', '/health', {}, { journey: 'open_app' });
    hit('auth_me', '/auth/me', a, { journey: 'open_app' });
    hit('legal_latest', '/legal/latest', a, { journey: 'open_app' });
    hit('inbox_unread', '/inbox/unread', a, { journey: 'open_app' });
  });
  journeyDuration.add(Date.now() - t0, { journey: 'open_app' });
}

// --- Perfil B: navegação ---------------------------------------------------
function profileB() {
  const t0 = Date.now();
  group('browse', () => {
    const a = authHeaders();
    hit('auth_me', '/auth/me', a, { journey: 'browse' });
    hit('retreats', '/retreats', a, { journey: 'browse' });
    hit('profile', '/profile', a, { journey: 'browse' });
    hit('inbox', '/inbox', a, { journey: 'browse' });
  });
  journeyDuration.add(Date.now() - t0, { journey: 'browse' });
}

// --- Perfil C: rajada pós-Push --------------------------------------------
// Todos abrem o app quase ao mesmo tempo. Sem sleep entre requests.
function profileC() {
  const t0 = Date.now();
  group('push_burst', () => {
    const a = authHeaders();
    hit('auth_me', '/auth/me', a, { journey: 'push_burst' });
    hit('inbox_unread', '/inbox/unread', a, { journey: 'push_burst' });
    hit('inbox', '/inbox', a, { journey: 'push_burst' });
  });
  journeyDuration.add(Date.now() - t0, { journey: 'push_burst' });
}

// --- Perfil D: escritas controladas ---------------------------------------
// Apenas operações IDEMPOTENTES em usuários sintéticos.
// Push NÃO é inscrito aqui: evitaríamos qualquer chance de envio real.
function profileD() {
  const t0 = Date.now();
  group('writes', () => {
    const a = authHeaders();
    const latest = hit('legal_latest', '/legal/latest', a, { journey: 'writes' });
    let terms = null, privacy = null;
    try {
      const body = latest.json();
      terms = body && body.terms ? body.terms.version : null;
      privacy = body && body.privacy ? body.privacy.version : null;
    } catch (e) { /* resposta não-JSON já contabilizada como erro acima */ }

    if (terms && privacy) {
      // Aceite legal é idempotente: reaceitar não duplica consentimento.
      const res = http.post(
        `${BASE_URL}/legal/accept`,
        JSON.stringify({ terms_version: terms, privacy_version: privacy,
                         analytics_opt_in: false, push_opt_in: false }),
        { headers: { ...a.headers, 'Content-Type': 'application/json' },
          tags: { journey: 'writes', endpoint: 'legal_accept' } }
      );
      const ok = check(res, { 'legal_accept 2xx': (r) => r.status >= 200 && r.status < 300 });
      journeyErrors.add(!ok);
    }
  });
  journeyDuration.add(Date.now() - t0, { journey: 'writes' });
}

const PROFILES = { A: profileA, B: profileB, C: profileC, D: profileD };

export default function () {
  (PROFILES[PROFILE] || profileA)();
  if (PROFILE !== 'C') sleep(Math.random() * 2 + 0.5); // C é rajada: sem pausa
}

export function setup() {
  console.log(`Lumen+ load | env=${ENV_NAME} | alvo=${BASE_URL} | perfil=${PROFILE} ` +
              `| tokens=${TOKENS.length} | ramp=${__ENV.RAMP === '1' ? 'sim' : 'não'}`);
  const r = http.get(`${BASE_URL}/health`);
  if (r.status !== 200) {
    throw new Error(`Alvo não está saudável: /health devolveu ${r.status}. Abortando.`);
  }
  return {};
}
