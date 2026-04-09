# JacRed — Деплой на Dokploy

## 1. Створи новий сервіс

Dokploy → **Create Service → Application**

| Поле | Значення |
|---|---|
| Name | `jacred` |
| Source | GitHub repo |
| Branch | `main` |
| Build Path | `/jacred` |
| Build Type | `Dockerfile` |
| Dockerfile path | `jacred/Dockerfile` |

---

## 2. Додай змінні середовища

Dokploy → сервіс → **Environment**

```
KINOZAL_COOKIE=uid=21246355; pass=1DxSglmbb6
SELEZEN_COOKIE=PHPSESSID=8gba7av3dhsdnrstrhtill20bo; dle_user_id=42630; dle_password=b5142271cd6bb83636a3bb9450897b1b
LOSTFILM_COOKIE=PHPSESSID=1re75glj8j3vk2nsu1lne8ljt0; lf_session=5d87d6f87fbd1679abe47511fa388762.7436470
TOLOKA_LOGIN=nestify
TOLOKA_PASSWORD=Afynjv228
BAIBAKO_LOGIN=nestify
BAIBAKO_PASSWORD=Afynjv228
ANIMELAYER_LOGIN=nestify
ANIMELAYER_PASSWORD=Afynjv228
```

---

## 3. Додай Volume (щоб база не зникала після рестарту)

Dokploy → сервіс → **Mounts → Add Mount**

| Поле | Значення |
|---|---|
| Type | `Bind` |
| Host Path | `/dokploy-data/jacred` |
| Container Path | `/app/Data` |

---

## 4. Додай домен

Dokploy → сервіс → **Domains → Add Domain**

| Поле | Значення |
|---|---|
| Host | `jacred.opencine.cloud` |
| Port | `9117` |
| HTTPS | увімкни |

---

## 5. Deploy

Натисни **Deploy** і чекай поки збереться образ.

Перевір що працює:
```
https://jacred.opencine.cloud/stats/torrents
```

---

## 6. Запусти індексування

Відкрий в браузері по черзі (кожен наступний — після того як попередній повернув `ok`):

### Rutor (публічний, найшвидший)
```
https://jacred.opencine.cloud/cron/rutor/updateTasksParse
https://jacred.opencine.cloud/cron/rutor/parseAllTask
```

### Kinozal
```
https://jacred.opencine.cloud/cron/kinozal/updateTasksParse
https://jacred.opencine.cloud/cron/kinozal/parseAllTask
```

### Rutracker
```
https://jacred.opencine.cloud/cron/rutracker/updateTasksParse
https://jacred.opencine.cloud/cron/rutracker/parseAllTask
```

### Toloka
```
https://jacred.opencine.cloud/cron/toloka/updateTasksParse
https://jacred.opencine.cloud/cron/toloka/parseAllTask
```

> `parseAllTask` може працювати **годинами** — це нормально.  
> Прогрес перевіряй тут: `https://jacred.opencine.cloud/stats/torrents`

---

## 7. Підключи до Nestify

Після того як база заповниться — в `backend/app/core/config.py`:

```python
JACRED_URL: str = "https://jacred.opencine.cloud"
JACRED_ENABLED: bool = True
```

---

## Перевірка пошуку

```
https://jacred.opencine.cloud/api/v1.0/torrents?search=дюна&apikey=null&exact=false
```
