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

mkdir -p diagnostico

echo "::group::Emulador"
adb wait-for-device
for _ in $(seq 1 90); do
  [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
  sleep 5
done

estado=$(adb get-state 2>&1 | tr -d '\r')
booted=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
echo "get-state: ${estado} | boot_completed: ${booted}"
adb devices | tee diagnostico/adb-devices.txt

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
  adb logcat -d -t 400 > diagnostico/logcat-install.txt 2>&1
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
  adb logcat -d -t 500 > diagnostico/logcat-crash.txt 2>&1
  adb exec-out screencap -p > diagnostico/tela-crash.png 2>/dev/null
  grep -iE "FATAL|AndroidRuntime|ReactNativeJS" diagnostico/logcat-crash.txt | tail -40
  exit 1
fi
echo "app abriu e permaneceu vivo"
adb exec-out screencap -p > diagnostico/tela-inicial.png 2>/dev/null
echo "::endgroup::"

echo "::group::Fluxos Maestro"
if [ -n "${FLOW:-}" ]; then
  maestro test "e2e/maestro-flows/${FLOW}"
else
  maestro test e2e/maestro-flows/
fi
codigo=$?
echo "::endgroup::"

if [ "${codigo}" -ne 0 ]; then
  echo "::error::fluxos Maestro falharam (exit ${codigo})"
  adb logcat -d -t 600 > diagnostico/logcat-fluxos.txt 2>&1
  adb exec-out screencap -p > diagnostico/tela-final.png 2>/dev/null
fi

exit "${codigo}"
