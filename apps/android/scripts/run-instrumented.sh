#!/usr/bin/env bash
# Roda os testes instrumentados num aparelho/emulador conectado.
#
# NAO use `./gradlew connectedDebugAndroidTest` direto: o AGP DESINSTALA o
# app ao fim, e a permissao de overlay concedida por appops morre junto —
# na execucao seguinte o OverlayService se encerra sozinho e os testes falham
# por um motivo que nao e o codigo. Aqui a ordem e: instalar, conceder, rodar.
set -euo pipefail
cd "$(dirname "$0")/.."

APP=app.meioorc.rolai
./gradlew assembleDebug assembleDebugAndroidTest -q

adb install -r app/build/outputs/apk/debug/app-debug.apk >/dev/null
adb install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk >/dev/null

# SYSTEM_ALERT_WINDOW: sem ela o service faz stopSelf e nada monta.
adb shell appops set "$APP" SYSTEM_ALERT_WINDOW allow
adb shell pm grant "$APP" android.permission.POST_NOTIFICATIONS 2>/dev/null || true

adb shell am instrument -w "$APP.test/androidx.test.runner.AndroidJUnitRunner"

echo
echo "O aparelho ficou com o APK de DEBUG (assinatura diferente do release)."
echo "Pra voltar ao oficial: adb uninstall $APP e instalar o APK da Release."
