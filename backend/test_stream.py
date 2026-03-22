"""
Тест получения ссылок на фильм через HdRezkaApi
Запуск: venv/Scripts/python test_stream.py
"""

import sys

sys.stdout.reconfigure(encoding="utf-8")

from HdRezkaApi import HdRezkaSession

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# НАСТРОЙКИ
MIRROR = "https://hdrezka-home.tv/"
URL = "https://hdrezka-home.tv/films/comedy/87902-toy-lyuboy-cenoy-2018.html"
SEASON = None  # None для фильма, число для сериала
EPISODE = None  # None для фильма, число для сериала
TRANSLATOR_ID = 110  # None = автовыбор, или "56" например

LOGIN_EMAIL = "ilendaacs@gmail.com"
LOGIN_PASS = "7091844295"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

with HdRezkaSession(MIRROR) as session:
    print(f"Логинимся как {LOGIN_EMAIL}...")
    session.login(LOGIN_EMAIL, LOGIN_PASS)
    print("Логин OK\n")

    print(f"Загружаем: {URL}\n")
    rezka = session.get(URL)

    if not rezka.ok:
        print("ОШИБКА:", rezka.exception)
        sys.exit(1)

    print(f"Название:    {rezka.name}")
    print(f"Тип:         {rezka.type}")
    print(f"Переводы:    {rezka.translators}\n")

    if SEASON is not None and EPISODE is not None:
        stream = rezka.getStream(str(SEASON), str(EPISODE), translation=TRANSLATOR_ID)
        print(f"Сезон {SEASON}, Эпизод {EPISODE}")
    else:
        stream = rezka.getStream(translation=TRANSLATOR_ID)

    print(f"Переводчик:  {stream.translator_id}")
    print(f"Качества:    {list(stream.videos.keys())}\n")

    for quality, urls in stream.videos.items():
        print(f"[{quality}]")
        for u in urls:
            print(f"  {u}")

    if stream.subtitles and stream.subtitles.keys:
        print(f"\nСубтитры: {stream.subtitles.keys}")
