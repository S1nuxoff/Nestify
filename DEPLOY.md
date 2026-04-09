# Деплой Nestify на Dokploy

## Структура сервісів

| Сервіс | Dockerfile | Порт |
|---|---|---|
| `backend` | `backend/Dockerfile` | 8000 |
| `frontend-vite` | `frontend-vite/Dockerfile` | 80 |
| `postgres` | офіційний образ | 5432 |
| `torrserve` | `ghcr.io/yourok/torrserver` | 8090 |
| `jacred` | `jacred/Dockerfile` | 9118 |

---

## 1. Backend

### Docker Build Context
- **Build context:** корінь репозиторію (`.`)
- **Dockerfile:** `backend/Dockerfile`

### Environment Variables (Dokploy → Environment)
```env
DATABASE_URL=postgresql+asyncpg://user:password@postgres:5432/nestify
AUTH_SECRET_KEY=<random-secret-32-chars>
FRONTEND_BASE_URL=https://your-domain.com
API_BASE_URL=https://api.your-domain.com

JACKETT_URL=https://your-jackett.domain.com
JACKETT_KEY=your_jackett_api_key
JACKETT_INDEXERS=1337x,rutor,toloka,lostfilm
JACKETT_ENABLED=false

JACKETT_EN_INDEXERS=yts,eztv,therarb,torrentgalaxy,thepiratebay,limetorrents,knaben
JACKETT_EN_ENABLED=true

JACKETT_PL_INDEXER=polskie-torrenty
JACKETT_PL_ENABLED=true

JACRED_URL=https://jac.red
JACRED_ENABLED=true
JACRED_OWN_URL=https://your-jacred.domain.com
JACRED_OWN_ENABLED=true

TORRSERVE_URL=https://your-torrserve.domain.com

REZKA_MIRROR=hdrezka-home.tv
REZKA_REPLACE_FROM=rezka.ag,hdrezka.ag,rezka.fi,rezka.me,rezka.uno
REZKA_PROXY=
```

### Volumes (Mounts)
```
/app/hls_cache   →   volume або host path (напр. /data/nestify/hls_cache)
```
> **Важливо:** `hls_cache` — це директорія де зберігаються HLS-сегменти для стримінгу.
> Без маунту дані зникнуть при рестарті контейнера. Рекомендується volume.

### Після першого запуску — міграції
```bash
docker exec -it <backend-container> alembic upgrade head
```

---

## 2. Frontend (Vite)

### Docker Build Context
- **Build context:** `frontend-vite/`
- **Dockerfile:** `frontend-vite/Dockerfile`

### Build Arguments (Dokploy → Build Args)
> VITE_ змінні вбудовуються в JS під час білду, тому передаються як Build Args, а не env.

```
VITE_BACKEND_URL=https://api.your-domain.com
VITE_TMDB_KEY=your_tmdb_api_key
VITE_TMDB_BASE=https://api.themoviedb.org/3
VITE_TMDB_IMG=https://image.tmdb.org/t/p
VITE_HDREZKA_URL=https://rezka.fi
```

### Volumes
Не потрібні — статичний nginx.

---

## 3. PostgreSQL

Використовуй офіційний образ `postgres:16-alpine`.

```env
POSTGRES_USER=user
POSTGRES_PASSWORD=password
POSTGRES_DB=nestify
```

**Volume:**
```
/var/lib/postgresql/data   →   volume (обов'язково!)
```

---

## 4. TorrServe

```yaml
image: ghcr.io/yourok/torrserver:latest
ports:
  - 8090:8090
volumes:
  - /data/torrserve:/root/.config/TorrServer
```

---

## 5. JacRed (власний)

- **Build context:** `jacred/`
- Порт: `9118`

**Volume:**
```
/app/Data   →   /data/jacred/Data
```
> Зберігає `torrents.json` та `tr.conf` між рестартами.

**Після запуску** ініціалізація парсингу відбувається автоматично через cron (кожні 30 хв).

---

## Порядок запуску

1. `postgres` — перший, бекенд залежить від нього
2. `backend` — після postgres
3. `jacred`, `torrserve` — незалежні, можна паралельно
4. `frontend-vite` — останній (або паралельно з п.3)

---

## Домени / Reverse Proxy (Dokploy)

| Сервіс | Домен |
|---|---|
| frontend | `nestify.your-domain.com` |
| backend | `api.your-domain.com` |
| torrserve | `ts.your-domain.com` |
| jacred | `jacred.your-domain.com` (опційно) |

---

## Checklist першого деплою

- [ ] Всі env vars заповнені в Dokploy
- [ ] Build Args для frontend заповнені
- [ ] Volume для `postgres` налаштований
- [ ] Volume для `hls_cache` налаштований
- [ ] Volume для JacRed `/app/Data` налаштований
- [ ] `alembic upgrade head` виконаний після запуску backend
- [ ] Перший юзер зареєстрований, роль `admin` встановлена вручну:
  ```sql
  UPDATE users SET role = 'admin' WHERE id = 1;
  -- або якщо profiles окремо:
  UPDATE users SET role = 'admin' WHERE id = <твій профіль id>;
  ```
