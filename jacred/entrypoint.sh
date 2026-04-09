#!/bin/sh
mkdir -p /app/Data/temp

# Generate tr.conf from environment variables
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

# Start cron with the project crontab
crontab /app/Data/crontab
service cron start

# Initial parse trigger in background (after app starts)
(
  sleep 30
  echo "[init] Triggering initial updateTasksParse..."
  for tracker in rutor rutracker kinozal nnmclub toloka selezen bitru torrentby underverse; do
    curl -s "http://127.0.0.1:9118/cron/${tracker}/updateTasksParse" > /dev/null
    echo "[init] ${tracker} updateTasksParse done"
  done
) &

exec dotnet JacRed.dll
