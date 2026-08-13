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
# IDEMPOTENTE
# -----------
# Tenta criar; se o e-mail já existe, apenas autentica para confirmar que a
# senha do secret continua correta. Rodar dez vezes seguidas tem o mesmo efeito
# de rodar uma.
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

  corpo=$(printf '{"email":"%s","password":"%s","returnSecureToken":true}' "$email" "$senha")

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
  local http
  http=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${E2E_API_URL%/}/auth/ensure-e2e-profile" \
    -H "Authorization: Bearer ${token}" -H 'Content-Type: application/json' \
    --data '{"source":"e2e-ci"}' 2>/dev/null)

  case "$http" in
    200|201|204|409) echo "  ${rotulo}: perfil no backend OK (HTTP ${http})" ;;
    404)
      # Endpoint ainda nao existe no backend de staging. Nao e fatal para o
      # login, mas os fluxos que dependem de canal vao falhar — melhor dizer.
      echo "::warning::${rotulo}: endpoint de perfil ausente (HTTP 404); fluxos de canal podem falhar"
      ;;
    *) echo "::warning::${rotulo}: perfil no backend respondeu HTTP ${http}" ;;
  esac
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
