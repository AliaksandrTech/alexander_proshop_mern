# 2. Same-origin frontend ↔ backend через CRA proxy и Express static

- Status: Accepted
- Confidence: **HIGH** (явно в коде)
- Date: 2026-04-29 (документировано постфактум)

## Context

Backend (Express) и frontend (CRA dev server) — два отдельных процесса на разных портах
(`:5000` и `:3000` локально, `:5000` и `:3000` в Docker). По умолчанию запросы из CRA на
backend будут cross-origin → нужен либо CORS, либо унификация origin. JWT хранится в
`localStorage` (см. [ADR-0001](0001-jwt-bearer-with-localstorage.md)) и шлётся через
`Authorization` header — ничего не мешает выбрать CORS, но решение пошло другим путём.

## Decision

Frontend всегда обращается к backend по относительным путям `/api/*` и `/uploads/*`,
а маршрутизация на реальный backend разрешается на уровне инфраструктуры:

- **Dev (host):** `frontend/package.json` содержит `"proxy": "http://127.0.0.1:5000"`
  ([frontend/package.json:3](frontend/package.json:3)) — CRA dev server проксирует
  `/api/*` на backend.
- **Dev (Docker):** `frontend/Dockerfile` на этапе сборки переписывает то же поле на
  `http://backend:5000`, чтобы CRA внутри контейнера ходил в backend по DNS-имени
  сервиса compose ([frontend/Dockerfile:10](frontend/Dockerfile:10)).
- **Production:** Express сам отдаёт собранный bundle и SPA-fallback из
  `frontend/build/` ([backend/server.js:38-43](backend/server.js:38)), плюс отдаёт
  пользовательские картинки статикой по `/uploads/*`
  ([backend/server.js:36](backend/server.js:36)). Frontend и backend становятся одним
  origin — CORS физически не нужен.

CORS-middleware **никогда не подключается**: в [package.json:18-28](package.json:18)
нет пакета `cors`, в `server.js` — никакого `app.use(cors(...))`.

## Alternatives

Инферится из отсутствия артефактов в коде:

- **CORS с whitelist** (`npm i cors`, `app.use(cors({ origin: ... }))`) — отвергнуто:
  пакет не установлен, никаких упоминаний `Access-Control-*` заголовков в кодовой
  базе нет.
- **Раздельные домены `api.proshop.com` + `proshop.com`** — отвергнуто: фронт
  обращается по относительному пути и в actions не хардкодит хост
  (например, [frontend/src/actions/userActions.js](frontend/src/actions/userActions.js)
  и т.п. — все вызовы вида `axios.get('/api/...')`).
- **Nginx reverse-proxy** — отвергнуто: в проде эту роль выполняет сам Express
  (`express.static` + catch-all `app.get('*')`), а в Docker нет сервиса `nginx` в
  [docker-compose.yaml](docker-compose.yaml).
- **CDN для `/uploads/*`** (S3 + CloudFront) — отвергнуто: multer пишет на локальный
  диск ([backend/routes/uploadRoutes.js:7-17](backend/routes/uploadRoutes.js:7)),
  директория `./uploads` bind-mount'ится в контейнер
  ([docker-compose.yaml:47](docker-compose.yaml:47)).

## Consequences

**Плюсы:**
- Один и тот же относительный URL работает в dev, Docker и проде — frontend-код
  не знает ни про порты, ни про домены.
- Не нужно поддерживать список allowed origins, конфигурировать preflight,
  обрабатывать `OPTIONS` — меньше площадь атаки и конфигурации.
- Cookies (если бы появились) автоматически попадали бы под same-origin policy —
  никаких `SameSite=None; Secure` танцев.

**Минусы (видны прямо в коде):**
- Express в проде вынужден совмещать роли API-сервера, файлового хранилища и
  static-host'а ([server.js:36-43](backend/server.js:36)) — горизонтальное
  масштабирование требует, чтобы `./uploads` был на shared volume / S3, иначе
  файлы окажутся только на одной ноде.
- Невозможно вынести фронт на CDN/Vercel без слома контракта — он жёстко связан
  с тем, что backend проксирует `/api/*` на тот же origin.
- Docker-схема требует **хака во время сборки** (`node -e ...` патчит `package.json`),
  чтобы переписать proxy на `http://backend:5000` — это нестандартно и легко
  сломать апгрейдом CRA или переходом на Vite (где `proxy` живёт в другом конфиге).
- В dev фронт-разработчик не может работать против удалённого backend'а простой
  переменной окружения — нужно править proxy руками.
