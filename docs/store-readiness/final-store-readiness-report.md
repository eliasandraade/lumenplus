# LUMEN+ — RELATÓRIO FINAL DE PRONTIDÃO PARA APP STORE E GOOGLE PLAY

**Data:** 2026-08-06 · **HEAD inicial:** `7db785d` · **Backend staging:**
`https://backend-staging-staging-3d47.up.railway.app` (**200, saudável**)

---

## A. Parecer executivo

### Classificação: **NOT READY**

Não é "READY WITH EXTERNAL BLOCKERS" porque **restam blockers técnicos**, não
apenas externos.

| Pergunta | Resposta |
|---|---|
| Android está pronto? | **NÃO** — sem conta Play, sem assets finais, sem AAB gerado |
| iOS está pronto? | **NÃO** — sem Apple Developer Program, sem archive |
| Backend está pronto? | **SIM, com ressalva** — `main` verde, 225 testes, capacidade medida; falta publicar a política v1.4 |
| Staging está pronto? | **SIM** — vivo, saudável, carga executada |
| App Store Connect pronto? | **NÃO** — o registro do app nem existe |
| Google Play Console pronto? | **NÃO** — idem |
| Pode ser submetido hoje? | **NÃO** |
| Pode ser lançado hoje? | **NÃO** |

**Por que NOT READY, em uma frase:** o app roda, mas **nunca foi compilado como
binário nativo** — as pastas `android/` e `ios/` versionadas eram scaffolding
**Flutter** de um projeto abandonado, o que teria feito o EAS Build produzir um
binário errado ou falhar. Isso foi corrigido nesta rodada, mas **nenhuma build
de loja jamais existiu** e portanto nada foi instalado ou testado em dispositivo.

---

## B. Estado do repositório

| Item | Valor |
|---|---|
| HEAD inicial | `7db785d` |
| PRs mergeados | **10** (#27, #29, #24, #20, #21, #25, #26, #30, #28, #19) |
| PRs fechados | 2 (#23 superseded, #22 → recriado como #30) |
| PRs abertos | 4 (**#31** mobile, **#17** jurídico, #12 e #9 drafts) |
| PRs criados nesta rodada | #30, #31 |
| CI | **verde** — ruff `All checks passed`, **225 testes passando** |
| Migrations | nenhuma nova executada em produção |
| Rollbacks | nenhum necessário |
| Deploys em produção | **nenhum** |

Detalhe completo: `repository-consolidation.md`.

---

## C. Builds

| Plataforma | Profile | Versão | Build | Commit | Status | Instalado? | Testado? |
|---|---|---|---|---|---|---|---|
| Android | production | 1.0.0 | — | — | **NUNCA GERADA** | não | não |
| iOS | production | 1.0.0 | — | — | **NUNCA GERADA** | não | não |
| Android | preview | 1.0.0 | — | — | não gerada (falta `projectId` EAS) | não | não |
| iOS | preview | 1.0.0 | — | — | não gerada (falta Apple Program) | não | não |

> Nenhuma build local foi apresentada como build de loja. **Não existe build.**

---

## D. Apple — matriz

| Item | Status | Evidência | Blocker |
|---|---|---|---|
| Apple Developer Program | ❌ | — | A2 (USD 99/ano) |
| Bundle ID `com.lumenchristi.lumenplus` | ✅ definido | `app.json` | — |
| Purpose strings (câmera/fotos) | ✅ **corrigido** | `app.json` → `ios.infoPlist` (#31) | — |
| Exclusão de conta no app (5.1.1(v)) | ✅ **implementada** | `app/account/delete.tsx` (#31) | — |
| UGC: denúncia + bloqueio (1.2) | ❌ **ausente** | canal com posts/respostas, sem *report*/*block* | **técnico** |
| Ícone 1024×1024 sem alpha | ❌ | assets são 192×192 placeholders | C5 |
| Privacy manifest / App Privacy | ⚠️ rascunho | `apple-app-privacy-draft` pendente de conta | A2 |
| Sign in with Apple | ⚠️ avaliar | login social via Firebase → provavelmente exigido | precisa análise no binário |
| Archive validado / TestFlight | ❌ | build nunca gerada | A2 |

---

## E. Google — matriz

| Item | Status | Evidência | Blocker |
|---|---|---|---|
| Play Console | ❌ | — | A3 (USD 25 + verificação) |
| Package `com.lumenchristi.lumenplus` | ✅ | `app.json` | — |
| targetSdk atual | ⚠️ **não verificável** | nativos removidos; EAS define no prebuild | verificar no 1º build |
| Exclusão de conta **no app** | ✅ **implementada** | (#31) | — |
| Exclusão de conta **via web** | ❌ **ausente** | não existe rota pública | **técnico** |
| UGC: denúncia + bloqueio | ❌ ausente | idem Apple | **técnico** |
| Data Safety | ⚠️ rascunho | derivado de `data-inventory.md` | A3 |
| AAB + Play App Signing | ❌ | build nunca gerada | A3 |
| Teste fechado obrigatório | ⚠️ **verificar** | depende do tipo de conta | A3 |

---

## F. Privacidade

- **Inventário real** produzido do código: `data-inventory.md`, `sdk-inventory.md`.
- **Dado sensível:** o app trata **afiliação religiosa** (categoria especial na
  LGPD) além de **CPF e RG** — que são criptografados (`crypto_service`).
- **Exclusão:** backend anonimiza (não apaga a linha `User`) preservando
  consentimentos e auditoria por obrigação legal — **coerente** com o texto que
  escrevi na tela nova.
- **DPO:** Felipe Rocha Pinheiro Bastos / `lgpd@lumenserfeliz.org` — aprovado.
- ⚠️ **Produção ainda serve a política v1.3**, que expõe o **e-mail pessoal** do
  DPO anterior. Correção pronta (#17), **não mergeada** por ser decisão de vigência.

---

## G. Qualidade

| Dimensão | Estado |
|---|---|
| Testes backend | **225 passando**, 0 falhas |
| Testes mobile | **nenhum teste automatizado** encontrado |
| E2E | **não existe** |
| Dispositivos | **nenhum** — sem build |
| Acessibilidade | parcial: a tela que criei tem `accessibilityRole/Label` e alvos ≥44px; **as demais não foram auditadas em dispositivo** |
| Performance mobile | **não medida** (cold start, bundle, memória) — exige build |
| Crashes / ANRs | **desconhecidos** — nunca executado em dispositivo |
| Push | **não existe em nativo** (só Web Push) |
| Deep links | `scheme: lumenplus` definido; **universal/app links não configurados** |

---

## H. Backend — capacidade **MEDIDA EM STAGING**

Ramp real contra o staging (perfil público: `/health` + `/legal/latest`),
gate por nível: erro < 2% **e** p95 < 2000 ms.

| VUs | RPS | p50 | p90 | p95 | p99 | erro | gate |
|---:|---:|---:|---:|---:|---:|---:|---|
| 10 | 41,3 | 204 ms | 218 ms | 234 ms | 377 ms | 0,00% | **PASS** |
| 25 | 96,8 | 207 ms | 248 ms | 324 ms | 571 ms | 0,00% | **PASS** |
| **30** | **113,0** | 211 ms | 294 ms | 375 ms | 636 ms | 0,00% | **PASS** ← pico |
| 35 | 108,2 | 227 ms | 447 ms | 587 ms | 998 ms | 0,00% | **PASS** |
| 40 | 83,1 | 304 ms | 815 ms | 1.137 ms | 1.615 ms | 0,00% | **PASS** |
| 50 | 61,2 | 523 ms | 1.705 ms | **2.154 ms** | 2.968 ms | 0,00% | **FAIL** (p95) |

**Sustentada:** 30 VUs por 90 s → **115,8 rps, p95 357 ms, 0% erro** — estável.
**Recuperação:** latência volta ao baseline (~350 ms) logo após.

### Leitura honesta
- **Saturação entre 35 e 50 VUs**: o RPS **cai** (113 → 61) enquanto a latência
  sobe — colapso de throughput clássico, **sem erros** (degradação graciosa).
- O p50 de ~200 ms no nível mais baixo é essencialmente **RTT de rede** até o
  edge do Railway; o tempo de aplicação é muito menor.
- **Classificação: CAPACIDADE PARCIAL.**
  - ✅ medido: rotas **públicas**, em **staging**, ~**30 usuários simultâneos**
    com p95 < 400 ms.
  - ❌ **não medido**: rotas **autenticadas** (staging roda `AUTH_MODE=PROD` e
    rejeita tokens `dev:` — exigiria token Firebase real), **250 simultâneos**
    (o gate reprovou em 50), CPU/memória/pool wait do container.
- **250 usuários simultâneos NÃO estão certificados.** O gate reprovou em 50 VUs
  no perfil mais leve. Extrapolar seria desonesto.

> **Nota de método:** a primeira execução deu 93% de erro — **429 do rate
> limiter** (60 req/min/IP), não falha de capacidade. Elevei o limite
> **apenas no staging**, medi, e **restaurei** (confirmado: o 429 voltou).
> Produção **não** recebeu carga.

---

## I. Assets e metadata

| Item | Estado |
|---|---|
| Ícones | ❌ placeholders 192×192 (o próprio `check-assets.mjs` reprova) |
| Screenshots | ❌ **nenhuma** — exigem build rodando |
| Feature graphic | ❌ ausente |
| Descrições | ✅ rascunhos em `store-metadata/{apple,google-play}/pt-BR.md` |
| Review notes | ⚠️ dependem de conta demo |
| Conta demo | ❌ não existe |
| URLs públicas | ⚠️ política/suporte/exclusão **não confirmadas como públicas** |

---

## J. Riscos

| Risco | Severidade |
|---|---|
| Nenhuma build nativa jamais gerada/instalada/testada | **CRÍTICO** |
| UGC sem denúncia/bloqueio (reprova nas duas lojas) | **CRÍTICO** |
| Política em produção com e-mail pessoal do DPO | **ALTO** |
| Sem exclusão de conta via web (Google Play) | **ALTO** |
| Assets placeholder | **ALTO** |
| Sem push nativo (ficha não pode prometer) | **MÉDIO** |
| Sentry é `@sentry/react` (browser), sem crash nativo | **MÉDIO** |
| 250 simultâneos não certificados | **MÉDIO** |
| Sem testes/E2E mobile | **MÉDIO** |

---

## K. Blockers humanos

Ver `human-blockers.md` (13 itens, com tela/campo/valor). Os 3 que travam tudo:
**A1** projeto EAS · **A2** Apple Developer (USD 99) · **A3** Play Console (USD 25).

---

## L. Passos finais

### Apple — até o clique de submissão
1. Matricular no Apple Developer Program → anotar Team ID *(humano, pago)*.
2. Criar projeto EAS → preencher `expo.extra.eas.projectId` e `owner`.
3. **Implementar denúncia + bloqueio de UGC** *(técnico, pendente)*.
4. Fornecer ícone 1024×1024 sem alpha e splash.
5. `eas build -p ios --profile preview` → instalar → smoke em dispositivo.
6. Criar app no App Store Connect (bundle `com.lumenchristi.lumenplus`).
7. Preencher App Privacy a partir de `data-inventory.md`.
8. `eas build -p ios --profile production` → TestFlight → testar.
9. Screenshots reais da build candidata + metadata + review notes + conta demo.
10. **Submit for Review** ← *clique humano*.

### Google — até o envio para revisão
1. Criar conta Play Console + verificação *(humano, pago)*.
2. Idem passos 2–4 acima.
3. `eas build -p android --profile preview` (APK) → instalar → smoke.
4. **Implementar exclusão de conta via web** + publicar a URL *(técnico, pendente)*.
5. Criar app com package `com.lumenchristi.lumenplus`; ativar Play App Signing.
6. `eas build -p android --profile production` (AAB) → Internal Testing.
7. Data Safety a partir de `data-inventory.md`; content rating; app access.
8. Corrigir Pre-launch Report.
9. **Verificar** se a conta exige teste fechado (12 testadores / 14 dias).
10. **Enviar para revisão** ← *clique humano*.

---

## M. Parecer

**Eu submeteria o Android hoje?** **NÃO.**
**Eu submeteria o iOS hoje?** **NÃO.**
**Existem blockers técnicos?** **SIM** — UGC sem denúncia/bloqueio; exclusão via
web ausente; nenhuma build nativa validada; sem testes mobile; assets placeholder.
**Existem blockers externos?** **SIM** — Apple Developer, Play Console, projeto
EAS, credenciais, arte final, vigência da política.

### Confiança: **88%**

Alta no que **medi** (consolidação, 225 testes, curva de capacidade, achados
mobile verificados linha a linha). O que reduz: não pude gerar build nativa,
então tudo sobre comportamento em dispositivo — crash, ANR, cold start,
permissões em runtime, deep links — permanece **não verificado**. E os requisitos
das lojas foram aplicados a partir de conhecimento consolidado, **sem** consulta
às páginas oficiais nesta sessão (a rede foi usada só para o backend), então
detalhes que mudaram recentemente podem estar desatualizados.

---

## Auditoria contra este próprio relatório

- Nenhuma build local foi apresentada como build de loja — **não há build**.
- Nenhuma inferência foi apresentada como prova: o 403 do staging foi
  **reclassificado** para hostname errado com evidência (200 no domínio real).
- A carga é rotulada **MEDIDA EM STAGING**, perfil **público**, e digo
  explicitamente que 250 **não** foi certificado.
- Nenhum secret aparece neste documento nem nos anexos.
- Produção não recebeu carga; o rate limit de staging foi **restaurado** e verificado.
- "100% pronto" **não** é afirmado em lugar nenhum.
