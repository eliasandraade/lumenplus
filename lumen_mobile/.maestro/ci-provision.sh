#!/usr/bin/env bash
#
# Provisiona os usuários sintéticos do E2E no Firebase Auth de STAGING.
#
# POR QUE ISTO EXISTE
# -------------------
# O fluxo 01-excluir-conta APAGA a conta que usa. Sem provisionamento
# automático, alguém teria que recriá-la à mão antes de cada execução — e o
# pipeline passaria a falhar por manutenção esquecida, não por regressão. Isso
# transformaria o E2E em cerimônia manual, que é o oposto do objetivo.
#
# COMO, SEM SERVICE ACCOUNT
# -------------------------
# Usa o endpoint REST público do Identity Toolkit, autenticado pela mesma
# API key do cliente que já vai embutida no app. Nenhuma chave privada, nenhum
# token administrativo, nenhum privilégio além do de um usuário comum se
# cadastrando. É deliberado: se este script vazasse por inteiro, não daria a
# ninguém mais poder do que abrir o app e criar uma conta.
#
# IDEMPOTENTE E AUTO-REPARADOR
# ----------------------------
# Tenta criar; se o e-mail já existe, apenas autentica para confirmar que a
# senha do secret continua correta. Rodar dez vezes seguidas tem o mesmo efeito
# de rodar uma.
#
# Os dois estados inconsistentes possíveis se reparam sozinhos, e vale
# explicar por quê em vez de escrever código para algo que a arquitetura já
# resolve:
#
#   existe no Firebase, falta no backend
#     A chamada autenticada a /profile/me cria User + UserProfile +
#     UserIdentity no primeiro acesso (app/api/deps.py).
#
#   existe no backend, falta no Firebase
#     Acontece depois que o fluxo de exclusão apaga a conta. O signUp gera um
#     UID novo, e o backend religa pelo e-mail — ele procura a identity por
#     provider_uid e, não achando, cai no match por e-mail (deps.py). Ou seja,
#     a conta descartável é recriada e reconectada ao registro existente sem
#     intervenção.
#
# Nenhum dos dois caminhos precisa de privilégio administrativo.
#
# Variáveis esperadas (todas do ambiente, nunca argumentos — argumentos
# aparecem em `ps` e em log de processo):
#   FIREBASE_API_KEY
#   E2E_ENVIRONMENT           precisa ser exatamente "staging"
#   E2E_FIREBASE_PROJECT_ID   projeto esperado, para conferência
#   E2E_API_URL               backend de staging
#   E2E_USER_EMAIL / E2E_USER_PASSWORD
#   E2E_USER2_EMAIL / E2E_USER2_PASSWORD
#   E2E_THROWAWAY_EMAIL / E2E_THROWAWAY_PASSWORD

set -uo pipefail

: "${FIREBASE_API_KEY:?FIREBASE_API_KEY ausente}"
: "${E2E_ENVIRONMENT:?E2E_ENVIRONMENT ausente}"
: "${E2E_API_URL:?E2E_API_URL ausente}"

# Portão duro: este script CRIA e prepara contas. Se por qualquer motivo
# apontasse para produção, criaria lixo em dado real.
if [ "${E2E_ENVIRONMENT}" != "staging" ]; then
  echo "::error::provisionamento recusado: E2E_ENVIRONMENT='${E2E_ENVIRONMENT}', esperado 'staging'"
  exit 1
fi

IDENTITY="https://identitytoolkit.googleapis.com/v1/accounts"

# Cria a conta se não existir; devolve o idToken em qualquer um dos casos.
# Nada de e-mail, senha ou token é impresso — só o desfecho.
provisionar() {
  local rotulo="$1" email="$2" senha="$3"
  local corpo resposta erro token

  # JSON montado por json.dumps, NAO por printf. A primeira versao usava
  # printf e quebrava com "Invalid JSON payload" — qualquer aspas, barra
  # invertida ou caractere especial na senha corrompe o payload, e o erro do
  # Google nao diz qual campo. Escapar a mao e exatamente o tipo de coisa que
  # a biblioteca faz certo e a gente faz errado.
  corpo=$(EMAIL="$email" SENHA="$senha" python3 -c 'import json,os;print(json.dumps({"email":os.environ["EMAIL"],"password":os.environ["SENHA"],"returnSecureToken":True}))')

  resposta=$(curl -sS -X POST "${IDENTITY}:signUp?key=${FIREBASE_API_KEY}" \
    -H 'Content-Type: application/json' --data "$corpo" 2>/dev/null)

  erro=$(printf '%s' "$resposta" | python3 -c \
    'import sys,json;print((json.load(sys.stdin).get("error") or {}).get("message",""))' 2>/dev/null)

  if [ "$erro" = "EMAIL_EXISTS" ]; then
    # Já existe: autentica para provar que a senha do secret confere. Se a
    # senha estiver errada, é melhor descobrir aqui do que no meio do fluxo,
    # onde apareceria como "elemento não encontrado".
    resposta=$(curl -sS -X POST "${IDENTITY}:signInWithPassword?key=${FIREBASE_API_KEY}" \
      -H 'Content-Type: application/json' --data "$corpo" 2>/dev/null)
    erro=$(printf '%s' "$resposta" | python3 -c \
      'import sys,json;print((json.load(sys.stdin).get("error") or {}).get("message",""))' 2>/dev/null)
    if [ -n "$erro" ]; then
      echo "::error::${rotulo}: conta existe mas o login falhou (${erro})"
      return 1
    fi
    echo "  ${rotulo}: ja existia, credencial confere"
  elif [ -n "$erro" ]; then
    echo "::error::${rotulo}: falha ao criar (${erro})"
    return 1
  else
    echo "  ${rotulo}: criada"
  fi

  token=$(printf '%s' "$resposta" | python3 -c \
    'import sys,json;print(json.load(sys.stdin).get("idToken",""))' 2>/dev/null)
  [ -n "$token" ] || { echo "::error::${rotulo}: sem idToken"; return 1; }

  # Perfil mínimo no backend. Sem ele o app abre na tela de onboarding em vez
  # do feed, e todo fluxo que dependa de canal falha por motivo errado.
  # Nao existe endpoint especial de provisionamento, nem precisa: o backend
  # AUTO-CRIA user + profile + identity no primeiro request autenticado
  # (app/api/deps.py). Qualquer chamada autenticada serve.
  #
  # Esta chamada tambem e o teste de isolamento mais importante do pipeline: se
  # o backend de staging validar tokens contra outro projeto Firebase, aqui
  # volta 401 e descobrimos agora, nao no meio dos fluxos.
  local http
  http=$(curl -sS -o /dev/null -w '%{http_code}' "${E2E_API_URL%/}/profile/me" \
    -H "Authorization: Bearer ${token}" 2>/dev/null)

  case "$http" in
    200|201|204)
      echo "  ${rotulo}: backend aceitou o token (HTTP ${http})"
      ;;
    401|403)
      echo "::error::${rotulo}: backend RECUSOU o token (HTTP ${http})."
      echo "  Causa provavel: FIREBASE_PROJECT_ID do backend de staging aponta"
      echo "  para outro projeto. aud e iss saem dessa unica variavel."
      return 1
      ;;
    *) echo "::warning::${rotulo}: backend respondeu HTTP ${http}" ;;
  esac

  # ── Pre-aceite legal ──────────────────────────────────────────────────────
  # Decisao de projeto: pre-gravar o consentimento APENAS nas contas que nao
  # exercitam esse gate. O fluxo 04-aceite-legal percorre a tela de verdade com
  # a conta descartavel, entao ela fica de fora aqui.
  #
  # Motivo: a tela tem dois documentos completos inline, e ensinar o teste a
  # rolar ate as checkboxes produziu falha NAO-DETERMINISTICA — o mesmo passo
  # passava numa execucao e falhava na seguinte. Colocar a conta no estado
  # certo antes de comecar e mais confiavel que navegar a tela tres vezes.
  if [ "$rotulo" = "descartavel" ]; then
    echo "  ${rotulo}: aceite NAO pre-gravado — 04-aceite-legal exercita a tela"
    return 0
  fi

  local corpo_aceite
  corpo_aceite=$(curl -sS "${E2E_API_URL%/}/legal/latest" \
    -H "Authorization: Bearer ${token}" 2>/dev/null | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    raise SystemExit
t = ((d.get("terms") or {}).get("version")) or ""
p = ((d.get("privacy") or {}).get("version")) or ""
if t and p:
    print(json.dumps({"terms_version": t, "privacy_version": p,
                      "analytics_opt_in": False, "push_opt_in": False}))
')

  if [ -z "$corpo_aceite" ]; then
    echo "::warning::${rotulo}: nao li /legal/latest; a tela de aceite vai aparecer"
    return 0
  fi

  local ac
  ac=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${E2E_API_URL%/}/legal/accept" \
    -H "Authorization: Bearer ${token}" -H 'Content-Type: application/json' \
    --data "$corpo_aceite" 2>/dev/null)
  echo "  ${rotulo}: aceite legal pre-gravado (HTTP ${ac})"
  return 0
}

echo "::group::Provisionando usuarios sinteticos (staging)"
echo "  projeto esperado: ${E2E_FIREBASE_PROJECT_ID:-<nao informado>}"
echo "  ambiente: ${E2E_ENVIRONMENT}"

falhas=0
provisionar "principal"   "${E2E_USER_EMAIL:?}"      "${E2E_USER_PASSWORD:?}"      || falhas=$((falhas+1))
provisionar "secundario"  "${E2E_USER2_EMAIL:?}"     "${E2E_USER2_PASSWORD:?}"     || falhas=$((falhas+1))

# A descartável é recriada TODA execução, porque o fluxo de exclusão a apaga.
# É exatamente por isso que este script existe.
provisionar "descartavel" "${E2E_THROWAWAY_EMAIL:?}" "${E2E_THROWAWAY_PASSWORD:?}" || falhas=$((falhas+1))

echo "::endgroup::"

if [ "$falhas" -ne 0 ]; then
  echo "::error::provisionamento falhou em ${falhas} conta(s)"
  exit 1
fi
echo "provisionamento OK — 3 contas prontas"
