#!/bin/sh
# Generate Data/tr.conf from environment variables
mkdir -p /app/Data/temp

cat > /app/Data/tr.conf <<EOF
kinozalCookie = ${KINOZAL_COOKIE:-}
selezenCookie = ${SELEZEN_COOKIE:-}
lostfilmCookie = ${LOSTFILM_COOKIE:-}
tolokaLogin = ${TOLOKA_LOGIN:-}
tolokaPassword = ${TOLOKA_PASSWORD:-}
baibakoLogin = ${BAIBAKO_LOGIN:-}
baibakoPassword = ${BAIBAKO_PASSWORD:-}
hamsterLogin = ${HAMSTER_LOGIN:-}
hamsterPassword = ${HAMSTER_PASSWORD:-}
animelayerLogin = ${ANIMELAYER_LOGIN:-}
animelayerPassword = ${ANIMELAYER_PASSWORD:-}
EOF

exec dotnet JacRed.dll
