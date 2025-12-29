# HDRezka Android App 2.2.5 – Reverse Notes

Цей файл — короткий конспект по тому, що вдалося витягнути зі встановленого APK **hdrezka_app_2_2_5** (com.falcofemoralis.hdrezkaapp): домени, AJAX-ендпоінти, заголовки, JS-бридж, логіка прогресу і т.п.

---

## 1. Загальна структура застосунку

- Пакет: `com.falcofemoralis.hdrezkaapp`
- Є сутності:
  - `objects/Film`, `Actor`, `Voice`, `Playlist`, `PlaylistItem`, `DatabaseSaveItem` і т.д.
  - `presenters/*` — `FilmPresenter`, `FilmsListPresenter`, `SearchPresenter`, `NewestFilmsPresenter` тощо.
  - `views/*` — різні екрани для телефону та ТВ.
- Відео відтворюється через **ExoPlayer**:
  - Класи: `HlsMediaPlaylist`, `HlsPlaylist`, `HlsPlaylistParser`, `HlsPlaylistTracker`, `DefaultHlsPlaylistTracker` і т.д.
  - Є згадки `.m3u8`, `APPLICATION_M3U8`, `format=m3u8-aapl` — HLS стріми.

Загалом: це **гібрид WebView + нативних моделей + ExoPlayer**. Сайт HDRezka вантажиться у WebView, поверх нього інжектиться JS, а відео віддається ExoPlayer’у.

---

## 2. Домени, які використовує застосунок

### 2.1. Основні домени HDRezka / Rezka

У рядках `classes*.dex` присутні такі домени та назви:

- `hdrezka.ag`
- `hdrezka.ac`
- `hdrezka.org`
- `hdrezka.tech`

- `rezka.ag`
- `rezka.ac`
- `rezka.org`
- `rezka.tech`

Статичні ресурси:

- `static.hdrezka.ac`
- `statichdrezka.ac`

(У JS видно префікси `https://static.hdrezka.ac/i/` і `https://statichdrezka.ac/i/` для картинок.)

### 2.2. CDN / банерні / рекламні домени

Витягнуто з `assets/script.js`, `script6_7.js` і `advert.js`:

**CDN і банерні домени (часто ховаються через JS):**

- `s.cummerata.link`
- `s2517.com`
- `cdn77.s2517.com`
- `cdn1.ufouxbwn.com`
- `vast2.ufouxbwn.com`
- `biocdn.net`

**Чисто рекламні/трекінгові (блокуються через хук на `XMLHttpRequest.open`):**

- `franecki.net`
- `franeski.net`
- `strosin.biz`
- `serv01001.xyz`
- `reichelcormier.bid`
- `track.adpod.in.bid`
- `biocdn.net` (фігурує і як CDN/реклама)

### 2.3. Інші явні URL

- `https://t.me/hdrezka` — вшитий Telegram-канал/чат.
- Системні/SDK домени (Firebase, ExoPlayer, Google тощо) — для логіки сайту не важливі.

---

## 3. AJAX / backend-ендпоінти

Нижче — усі знайдені шляхи типу `ajax/...` та `engine/ajax/...` у `classes*.dex` (без домену). В рантаймі вони перетворюються на щось на кшталт:

`https://hdrezka.ag/engine/ajax/search.php`
`https://rezka.ag/ajax/get_cdn_series`

### 3.1. Авторизація / реєстрація

- `/ajax/login/`
- `/engine/ajax/quick_register.php`
- `/ajax/quick_register.php`

### 3.2. Пошук / контент

- `/engine/ajax/search.php`
- `/ajax/search.php`
- `/engine/ajax/quick_content.php`
- `/ajax/quick_content.php`

### 3.3. Серії / CDN / прогрес / історія

- `ajax/get_cdn_series`
- `ajax/get_cdn_series/?t=`
- `ajax/send_save`
- `ajax/send_save/?t=`
- `engine/ajax/cdn_saves_remove.php`
- `ajax/cdn_saves_remove.php`
- `engine/ajax/schedule_watched.php`
- `ajax/schedule_watched.php`
- `engine/ajax/get_newest_slider_content.php`
- `ajax/get_newest_slider_content.php`

Сюди відноситься логіка:
- отримання плейлистів/серій;
- збереження прогресу перегляду;
- видалення збережених позицій;
- історія/новинки.

### 3.4. Коментарі / лайки / фаворити

- `ajax/add_comment/`
- `/ajax/get_comments/`
- `/ajax/get_comments/?t=`
- `/ajax/comments_like.php`
- `/ajax/comments_like.php?id=`
- `/ajax/deletecomments.php`
- `/ajax/deletecomments.php?id=`
- `/ajax/favorites/`

З дублями через `engine/ajax`:

- `engine/ajax/comments_like.php`
- `engine/ajax/comments_like.php?id=`
- `engine/ajax/deletecomments.php`
- `engine/ajax/deletecomments.php?id=`

### 3.5. Рейтинг

- `/engine/ajax/rating.php`
- `/engine/ajax/rating.php?news_id=`
- `/ajax/rating.php`
- `/ajax/rating.php?news_id=`

### 3.6. Трейлери

- `/engine/ajax/gettrailervideo.php`
- `/ajax/gettrailervideo.php`

---

## 4. Спеціальні HTTP-заголовки

У коді є кастомні хедери, які явно маркують запит як “з андроїд-апки”:

```http
X-Hdrezka-Android-App: 1
X-Hdrezka-Android-App-Version: 2.2.5
```

У JS це виглядає приблизно так:

```js
xhr.setRequestHeader('X-Hdrezka-Android-App', '1');
xhr.setRequestHeader('X-Hdrezka-Android-App-Version', '2.2.5');
```

Будь-який скрипт/клієнт, який хоче прикинутися цією апкою, може додати ці заголовки до запиту.

### Приклад HEADERS у Python

```python
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Linux; Android 9; SM-G960F Build/PPR1.180610.011; wv) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Version/4.0 Chrome/80.0.3987.162 Mobile Safari/537.36"
    ),
    "X-Hdrezka-Android-App": "1",
    "X-Hdrezka-Android-App-Version": "2.2.5",
    # "Cookie": "PHPSESSID=....; other=...",
}
```

UA тут стилізований під Android WebView (`; wv`), що виглядає правдоподібно.

---

## 5. JS-ін’єкції з assets/ (script.js, script6_7.js, advert.js)

### 5.1. advert.js — блокування XHR на рекламні домени

```js
XMLHttpRequest.prototype.open = (function (open) {
    return function (method, url, async) {
        if (url.match(/franecki.net/g) ||
            url.match(/strosin.biz/g) ||
            url.match(/serv01001.xyz/g) ||
            url.match(/biocdn.net/g) ||
            url.match(/franeski.net/g) ||
            url.match(/reichelcormier.bid/g) ||
            url.match(/track.adpod.in.bid/g)) {
            console.log('blocked');
        } else {
            open.apply(this, arguments);
        }
    };
})(XMLHttpRequest.prototype.open);
```

Тобто будь-який XHR до цих доменів навіть не відправляється.

### 5.2. script.js / script6_7.js — чистка DOM + зв’язок із Java

Основні задачі цих скриптів:

1. **Змінити верстку HDRezka-сторінки**:
   - сховати хедер, футер, сайдбар, блоки з описом, рейтингом, соцмережами, коментарями, банерами, блоки VK тощо;
   - сховати `<img>` і `<iframe>` із рекламних/сторонніх доменів:  
     `static.hdrezka.ac`, `statichdrezka.ac`, `s.cummerata.link`, `s2517.com`, `cdn77.s2517.com`, `cdn1.ufouxbwn.com`, `vast2.ufouxbwn.com`;
   - розтягнути плеєр (`#cdnplayer`, `#videoplayer`) на всю ширину;
   - чорний фон, відключена мінімальна ширина `<body>`/`<html>`.

2. **Прокинути події відтворення у Java (`JSOUT`)**:

   ```js
   var mediaElement;
   function mediaCheck() {
       var i;
       for (i = 0; i < document.getElementsByTagName('video').length; i++) {
           (function(media) {
               media.onplay = function () {
                   mediaElement = media;
                   JSOUT.mediaAction('true');
               };
               media.onpause = function () {
                   mediaElement = media;
                   JSOUT.mediaAction('false');
               };
           })(document.getElementsByTagName('video')[i]);
       }
       for (i = 0; i < document.getElementsByTagName('audio').length; i++) {
           (function(media) {
               media.onplay = function () {
                   mediaElement = media;
                   JSOUT.mediaAction('true');
               };
               media.onpause = function () {
                   mediaElement = media;
                   JSOUT.mediaAction('false');
               };
           })(document.getElementsByTagName('audio')[i]);
       }
   }
   ```

   `JSOUT` — це Java-інтерфейс, доданий через `addJavascriptInterface("JSOUT", ...)` у WebView. При `play/pause` йому передається стан.

3. **Генерація `documentId` для прогресу перегляду**:

   ```js
   function getDocumentId() {
       var voiceId = null;
       $('.b-translator__item').each(function(i, el) {
           if (el.classList.contains('active')) {
               voiceId = el.getAttribute('data-translator_id');
           }
       });

       var season = null;
       $('.b-simple_season__item').each(function(i, el) {
           if (el.classList.contains('active')) {
               season = el.getAttribute('data-tab_id');
           }
       });

       var episode = null;
       $('.b-simple_episode__item').each(function(i, el) {
           if (el.classList.contains('active')) {
               episode = el.getAttribute('data-episode_id');
           }
       });

       var titleId = $('.b-userset__fav_holder_data')[0].getAttribute('data-post_id');
       var userId = $('#member_user_id')[0].getAttribute('value');
       if (!userId || userId == '0') {
           throw Error('unauthorized');
       }
       return userId + '-' + titleId + '-' + voiceId + '-' + season + '-' + episode;
   }
   ```

   Далі цей `documentId` використовується для ініціалізації/оновлення часу перегляду через Java:

   ```js
   Android.initTime(getDocumentId());
   var UPDATE_TIMEOUT = 30000;
   function updateTime(timer) {
       if (CDNPlayer.api('playing')) {
           Android.updateTime(getDocumentId(), CDNPlayer.api('time'));
       }
       if (timer) {
           setTimeout(function() {
               updateTime(true);
           }, UPDATE_TIMEOUT);
       }
   }
   setTimeout(function() {
       updateTime(true);
   }, UPDATE_TIMEOUT);
   ```

   Тобто:
   - `documentId = userId-titleId-voiceId-season-episode`;
   - раз на 30 секунд апка отримує поточний час із плеєра та передає його в нативний код;
   - нативний код уже може зберігати це локально, у БД, або відсилати через відповідні AJAX-ендпоінти (`send_save`, `cdn_saves_remove`, `schedule_watched` тощо).

---

## 6. Плейлисти, HLS, ExoPlayer

По строках у `dex` видно:

- Використовується HLS (.m3u8):
  - `.m3u8`
  - `APPLICATION_M3U8`
  - `format=m3u8-aapl`
- ExoPlayer-класи:
  - `HlsMediaPlaylist`, `HlsPlaylist`, `HlsPlaylistParser`, `HlsPlaylistTracker`, `DefaultHlsPlaylistParserFactory`, `DefaultHlsPlaylistTracker`
- Моделі в app:
  - `com.falcofemoralis.hdrezkaapp.objects.Playlist`
  - `PlaylistItem`
  - константи типу `ACTION_PLAYLIST_PLAY`, `MEDIA_ATTRIBUTE_PLAYLIST`

Логіка в цілому:
1. Через `/ajax/get_cdn_series` (та інші ajax) сторінка віддає інфу про серіали/сезони/серії та джерела (iframe/лінки на CDN).
2. JS/Java збирають це в об’єкт `Playlist`/`PlaylistItem`.
3. ExoPlayer відтворює `.m3u8`-стрім із відповідного CDN (типу `cdn1.ufouxbwn.com`, `s2517.com`, `vast2.ufouxbwn.com` тощо).

Конкретні лінки `.m3u8` у `dex` жорстко не зашиті — вони прилітають у відповідях сервера в рантаймі.

---

## 7. IMDb / TMDB / зв’язка ідентифікаторів

Явний пошук по всьому вмісту APK (рядки) по ключових словах:

- `imdb`
- `imdb_id`, `imdb-id`, `imdbId`
- `themoviedb`, `tmdb`
- `kinopoisk`

Результат:

- Є згадки тільки для **CSS-класів**, типу `span.imdb b`, `span.imdb i` — тобто стилізація IMDb-рейтингів, що вже відображаються в HTML від HDRezka.
- Немає жодних рядків виду:
  - `imdb_id=...`
  - `tt1234567`
  - `api.themoviedb.org/3/movie/...`
  - `imdb.com/title/`

Висновок:

> **Всередині цієї апки немає вбудованої мапи "post_id → imdb_id / tmdb_id".**  
> Вона просто відображає те, що вже приходить із сайту (назви, описи, рейтинги і т.п.), але не робить власного зіставлення з зовнішніми базами (IMDb/TMDB).

Якщо треба побудувати таку мапу, це доведеться робити стороннім кодом — наприклад, за назвою + роком фільму звертатись до TMDB/OMDb API і зберігати відповідність у своїй БД.

---

## 8. Висновок та як це можна використати

Ключові штуки, які можна юзати далі:

1. **Список доменів** — дозволяє:
   - розуміти, звідки реально йде відео (CDN);
   - одразу відфільтровувати рекламні/трекінгові домени.

2. **AJAX-ендпоінти** — це фактичний API HDRezka, яким користується офіційна апка:
   - логін/реєстрація;
   - пошук;
   - отримання даних по серіях/перекладачах (`get_cdn_series`);
   - коментарі, лайки, рейтинг;
   - історія та прогрес перегляду (`send_save`, `cdn_saves_remove`, `schedule_watched`, `get_newest_slider_content`).

3. **Спец-заголовки `X-Hdrezka-Android-App*`** — маркер того, що клієнт поводиться як їх Android-апка.

4. **JS ↔ Java бридж і `documentId`** — готовий патерн для побудови системи прогресу перегляду:
   - `documentId = userId + postId + voiceId + season + episode`;
   - періодичне оновлення часу відтворення через нативний/бекенд;
   - можливість організувати “Продовжити з місця, де зупинився” з урахуванням озвучки/серії.

5. **Відсутність IMDb/TMDB-зв’язки в APK** — означає, що свій маппінг до IMDb/TMDB доведеться будувати самостійно (це плюс: повний контроль над тим, як це робиться).

