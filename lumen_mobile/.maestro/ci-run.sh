#!/usr/bin/env bash
#
# Executa os fluxos Maestro contra o emulador do CI.
#
# POR QUE ISTO É UM ARQUIVO E NÃO O BLOCO `script:` DO WORKFLOW
# -------------------------------------------------------------
# O `script:` do reactivecircus/android-emulator-runner NÃO é um script: a
# action executa **cada linha num `sh -c` separado**. Isso derrubou sete
# execuções seguidas de formas que pareciam problema de emulador:
#
#   - `set +e` não valia para as linhas seguintes;
#   - variáveis não sobreviviam de uma linha para a outra;
#   - todo `for`/`if` multilinha estourava com
#       /usr/bin/sh: 1: Syntax error: end of file unexpected (expecting "done")
#   - e, como a primeira linha de controle já falhava, NENHUM `echo` aparecia —
#     o que me fez procurar a causa no emulador, no runner, no KVM e no Ubuntu.
#
# Num arquivo, o shell é um só, do começo ao fim. O workflow chama uma linha.
#
# Variáveis de ambiente esperadas:
#   APP_ID  — applicationId do app (com.lumenchristi.lumenplus)
#   FLOW    — opcional; nome de um fluxo específico dentro de maestro-flows/

set -uo pipefail

: "${APP_ID:?APP_ID nao definido}"
: "${E2E_EMAIL:?E2E_EMAIL nao definido}"
: "${E2E_SENHA:?E2E_SENHA nao definido}"

# Caminho ABSOLUTO, nao relativo. A primeira versao usava `diagnostico/` e o
# artefato subiu vazio: o script roda com CWD proprio dentro da action, e o
# passo de upload procurava no workspace. Justamente os logs de falha se
# perdiam — que era o oposto do objetivo.
DIAG="${GITHUB_WORKSPACE:-$PWD}/diagnostico"
mkdir -p "$DIAG"

echo "::group::Emulador"
adb wait-for-device
for _ in $(seq 1 90); do
  [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
  sleep 5
done

estado=$(adb get-state 2>&1 | tr -d '\r')
booted=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
echo "get-state: ${estado} | boot_completed: ${booted}"
adb devices -l | tee "$DIAG/adb-devices.txt"

if [ "${estado}" != "device" ] || [ "${booted}" != "1" ]; then
  echo "::error::emulador nao ficou pronto (state=${estado} boot=${booted})"
  exit 1
fi

adb shell input keyevent 82 || true
echo "API: $(adb shell getprop ro.build.version.sdk | tr -d '\r')"
echo "::endgroup::"

echo "::group::Instalando APK"
if ! adb install -r e2e/app-releaseTest.apk; then
  echo "::error::adb install falhou"
  adb logcat -d -t 400 > "$DIAG/logcat-install.txt" 2>&1
  exit 1
fi
adb shell pm list packages | grep "${APP_ID}"
echo "::endgroup::"

# O app precisa ABRIR antes de qualquer fluxo. Um crash de inicialização já
# aconteceu neste projeto (Firebase Auth não registrava) e faria os três fluxos
# falharem com erro de seletor, escondendo a causa atrás de "elemento não
# encontrado". Este bloco isola isso.
echo "::group::Lancamento"
adb shell am start -W -n "${APP_ID}/.MainActivity"
sleep 20
if ! adb shell pidof "${APP_ID}" >/dev/null 2>&1; then
  echo "::error::o app nao sobreviveu ao lancamento"
  adb logcat -d -t 500 > "$DIAG/logcat-crash.txt" 2>&1
  adb exec-out screencap -p > "$DIAG/tela-crash.png" 2>/dev/null
  grep -iE "FATAL|AndroidRuntime|ReactNativeJS" "$DIAG/logcat-crash.txt" | tail -40
  exit 1
fi
echo "app abriu e permaneceu vivo"
adb exec-out screencap -p > "$DIAG/tela-inicial.png" 2>/dev/null
echo "::endgroup::"

# As credenciais vao por EXPORT, nao por `-e` na linha de comando.
#
# Com `-e E2E_SENHA="$SENHA"` o picocli do Maestro tentou reprocessar aspas
# dentro do valor e falhou:
#   [picocli WARN] Unbalanced quotes in [Nq`[G%4_Oz]
#   Flow path does not exist: .../n
# A senha tem crase e aspas; o parsing transbordou e comeu o caminho do fluxo.
# Senha secreta nao pode ser saneada nem impressa para depurar — o caminho
# certo e nao expo-la a um parser de linha de comando.
export E2E_EMAIL E2E_SENHA

echo "::group::Fluxos Maestro"
if [ -n "${FLOW:-}" ]; then
  maestro test "e2e/maestro-flows/${FLOW}"
else
  # 00-login.yaml e subfluxo: entra via runFlow, nao no glob.
  maestro test \
    e2e/maestro-flows/01-excluir-conta.yaml \
    e2e/maestro-flows/02-denunciar-conteudo.yaml \
    e2e/maestro-flows/03-bloquear-usuario.yaml
fi
codigo=$?
echo "::endgroup::"

if [ "${codigo}" -ne 0 ]; then
  echo "::error::fluxos Maestro falharam (exit ${codigo})"
  adb logcat -d -t 600 > "$DIAG/logcat-fluxos.txt" 2>&1
  adb exec-out screencap -p > "$DIAG/tela-final.png" 2>/dev/null
fi

# Evidencia completa SEMPRE, nao so em falha: uma execucao verde tambem
# precisa provar contra qual APK e qual commit passou.
{
  echo "commit: ${GITHUB_SHA:-<local>}"
  echo "run:    ${GITHUB_RUN_ID:-<local>}"
  echo "app:    ${APP_ID}"
  echo "exit:   ${codigo}"
} > "$DIAG/resumo.txt"
cp e2e/metadata.json "$DIAG/apk-metadata.json" 2>/dev/null || true
adb devices -l > "$DIAG/adb-devices-final.txt" 2>&1
adb shell getprop > "$DIAG/emulador-props.txt" 2>&1
cp -r "${HOME}/.maestro/tests" "$DIAG/maestro-tests" 2>/dev/null || true

exit "${codigo}"
