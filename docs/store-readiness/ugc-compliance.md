# Conformidade de UGC — as 4 salvaguardas da Apple

**Data:** 2026-08-06. Base: `policy-baseline.md` (VERIFICADO em
developer.apple.com e no Google Play Policy Center, consultado em 2026-08-06).

## UGC é aplicável ao Lumen+ — confirmado no código

| Pergunta | Resposta | Evidência |
|---|---|---|
| Usuários criam conteúdo? | **Sim** | `POST /channel/{id}/posts` exige apenas `_require_active_member` — **qualquer membro ativo**, não só coordenador |
| Outros usuários veem? | **Sim** | `GET /channel/{id}/posts` lista para todos os membros da unidade |
| Há respostas entre usuários? | **Sim** | `ChannelReply` |
| Risco de abuso? | **Sim** | texto livre, sem moderação prévia antes desta entrega |

Portanto Apple **Guideline 1.2** e a política de UGC do Google Play se aplicam.

## As 4 salvaguardas exigidas pela Apple

| # | Exigência (texto oficial) | Estado | Onde |
|---|---|---|---|
| 1 | *"A method for filtering objectionable material from being posted to the app"* | ✅ | `app/services/content_filter.py` + gate no `create_post` |
| 2 | *"A mechanism to report offensive content and timely responses to concerns"* | ✅ (UI + fila) | `POST /moderation/reports`; fila para coordenador/admin |
| 3 | *"The ability to block abusive users from the service"* | ✅ | `POST /moderation/blocks`, simétrico, com efeito real no feed |
| 4 | *"Published contact information so users can easily reach you"* | ⚠️ **humano** | falta definir o canal oficial de suporte |

> A salvaguarda 2 exige **duas** coisas: o fluxo no app **e** um processo
> operacional de resposta. O fluxo está pronto; **quem responde e em que prazo
> é decisão da comunidade** — registrado em `human-blockers.md`.

## Filtro pré-publicação — decisões de projeto

Deliberadamente **conservador**:

- **BLOQUEIA (422)** só o inequívoco: ameaça direta, incitação à violência
  contra grupo protegido, conteúdo sexual envolvendo menor.
- **SINALIZA** o duvidoso — publica e abre denúncia automática para revisão
  humana: ofensa leve, propaganda, caixa alta, repetição, excesso de links.
- **Nunca reescreve** o texto do usuário.

**Por que conservador:** num app de comunidade católica, um filtro agressivo
produziria falso positivo em conversa legítima sobre **luto, vício, doença ou
conflito** — exatamente o assunto do acompanhamento pastoral. Há teste
garantindo que uma partilha sobre "a morte do meu pai e o vício que enfrentei"
**passa**.

**Anti-evasão:** além de remover acentuação, o texto é comparado também contra
uma variante **colapsada** (só letras e números), que desmonta tentativas como
`v.o.u t.e m.a.t.a.r`.

## Bloqueio — semântica escolhida

**Simétrico**: se A bloqueia B, **A não vê B e B não vê A**.

- Evita que o bloqueado perceba o bloqueio pela ausência unilateral.
- Corta o contato dos dois lados.
- `GET /moderation/blocks` devolve **só quem eu bloqueei** — não vaza quem me bloqueou.
- O filtro se aplica ao feed **e à contagem `total`**, senão a paginação
  mostraria buracos.

## Testes — 23

| Grupo | Cobertura |
|---|---|
| Denúncia | válida · duplicada (idempotente) · próprio conteúdo (400) · inexistente (404) · sem auth (401) |
| Fila | membro comum negado (403) · admin vê tudo · coordenador só a sua unidade · **IDOR** (coordenador de X não resolve denúncia de Y) · remoção do conteúdo ao resolver |
| Bloqueio | bloquear/desbloquear · idempotentes · não bloquear a si mesmo · usuário inexistente (404) · sem auth · lista não vaza quem me bloqueou · simetria |
| **Efeito real** | **bloquear esconde o post no feed, `total` acompanha, desbloquear restaura** |
| Filtro | bloqueia abusivo e não persiste · **permite partilha pastoral** · sinaliza propaganda e abre denúncia automática |

## Pendente

| Item | Responsável |
|---|---|
| Canal de contato público (salvaguarda 4) | **humano** |
| Política de conteúdo redigida | **humano/jurídico** |
| Prazo de resposta a denúncias | **humano** |
| UI da fila de moderação para coordenador | técnico — endpoints prontos, falta tela |
