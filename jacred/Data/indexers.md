# JacRed — Індексатори та посилання

## Потрібен Cookie (після логіну копіюєш з браузера DevTools → Application → Cookies)

| Індексатор     | Сайт                        | Поле в tr.conf    |
|----------------|-----------------------------|-------------------|
| Kinozal        | http://kinozal.tv           | kinozalCookie     |
| Selezen        | https://selezen.net         | selezenCookie     |
| Lostfilm       | https://www.lostfilm.tv     | lostfilmCookie    |

## Потрібен Логін + Пароль

| Індексатор     | Сайт                        | Поля в tr.conf                        |
|----------------|-----------------------------|---------------------------------------|
| Toloka         | https://toloka.to           | tolokaLogin / tolokaPassword          |
| Baibako        | http://baibako.tv           | baibakoLogin / baibakoPassword        |
| Hamster Studio | http://hamsterstudio.org    | hamsterLogin / hamsterPassword        |
| AnimeLayer     | http://animelayer.ru        | animelayerLogin / animelayerPassword  |

## Публічні (без авторизації)

| Індексатор | Сайт                     |
|------------|--------------------------|
| Rutor      | http://rutor.info        |
| Rutracker  | http://rutracker.net     |
| NNMClub    | https://nnmclub.to       |
| Bitru      | https://bitru.org        |
| TorrentBy  | http://torrent.by        |
| Underverse | https://underver.se      |
| AniLibria  | https://www.anilibria.tv |
| Anidub     | https://tr.anidub.com    |
| Anifilm    | https://anifilm.tv       |
| Animedia   | https://tt.animedia.tv   |
| HDRezka    | https://rezka.cc         |

---

## Як отримати Cookie

1. Заходиш на сайт і логінишся
2. Відкриваєш DevTools (F12) → вкладка **Application** → **Cookies** → вибираєш сайт
3. Копіюєш всі cookies у форматі: `name=value; name2=value2; ...`
4. Вставляєш в `Data/tr.conf`
