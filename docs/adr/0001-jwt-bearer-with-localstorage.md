# 1. JWT в `Authorization: Bearer` + хранение в `localStorage`

- Status: Accepted
- Confidence: **HIGH** (явно в коде)
- Date: 2026-04-29 (документировано постфактум)

## Context

Приложению нужна авторизация для защищённых API (`/api/users/profile`, `/api/orders`,
admin-маршруты, `/api/upload`) и для отличия обычного пользователя от админа.
Frontend и backend деплоятся как отдельные процессы (Express на `:5000`, CRA dev server на
`:3000`), при этом backend не держит состояния сессий — нужен механизм, который позволяет
любому процессу backend'а валидировать запрос без обращения к общему session store.

## Decision

Stateless JWT-аутентификация:

- Backend подписывает JWT с payload `{ id }` и `expiresIn: '30d'` секретом из
  `process.env.JWT_SECRET` ([backend/utils/generateToken.js:4](backend/utils/generateToken.js:4)).
- Токен возвращается в JSON-теле ответа на `POST /api/users/login` и `POST /api/users`
  ([backend/controllers/userController.js:19](backend/controllers/userController.js:19),
  [backend/controllers/userController.js:52](backend/controllers/userController.js:52)).
- Frontend кладёт весь объект `userInfo` (включая `token`) в `localStorage` и при загрузке
  store'а гидратирует его обратно в Redux
  ([frontend/src/store.js:60](frontend/src/store.js:60),
  [frontend/src/store.js:73](frontend/src/store.js:73)).
- Каждый защищённый запрос отправляет токен в заголовке `Authorization: Bearer <jwt>`,
  который парсит middleware `protect`
  ([backend/middleware/authMiddleware.js:8-19](backend/middleware/authMiddleware.js:8)).
- Роль (`isAdmin`) определяется не по содержимому токена, а повторным запросом в Mongo
  по `decoded.id` — middleware `admin` читает `req.user.isAdmin`
  ([backend/middleware/authMiddleware.js:33-40](backend/middleware/authMiddleware.js:33)).

## Alternatives

Инферится из *отсутствующих* зависимостей и middleware:

- **Сессии на cookies** (`express-session` + Mongo session store / Redis) — отвергнуто:
  ни `express-session`, ни `cookie-parser`, ни `connect-mongo` не подключены в
  [package.json:18-28](package.json:18).
- **HttpOnly cookie + CSRF-токен** — отвергнуто: cookie-парсер не подключён, CSRF-защиты
  (`csurf`) нет, в `server.js` нет `app.use(cookieParser())`.
- **OAuth/SSO через провайдер** (Passport, Auth0) — отвергнуто: `passport*` не в deps,
  логин/регистрация реализованы вручную через bcrypt в
  [backend/models/userModel.js:30-41](backend/models/userModel.js:30).
- **Refresh-token pattern** — отвергнуто: один долгоживущий токен на 30 дней, отдельной
  ручки `/refresh` нет.

## Consequences

**Плюсы:**
- Backend полностью stateless — горизонтально масштабируется без shared session store.
- Простой контракт: один заголовок, одна проверка подписи, никакого CSRF-протокола.
- Тот же механизм работает в dev (через CRA proxy) и в Docker (через rewrite proxy)
  без изменений — заголовки прозрачно прокидываются.

**Минусы (видны прямо в коде):**
- JWT в `localStorage` доступен любому JS на той же origin → **уязвим к XSS-краже токена**.
  Этот риск принимается неявно, alternativ httpOnly cookie не реализован.
- Невозможно отозвать токен до истечения 30 дней без введения серверного blacklist'а
  (которого нет) — `expiresIn: '30d'` в [generateToken.js:5](backend/utils/generateToken.js:5)
  жёстко зашит.
- Каждый защищённый запрос всё равно делает `User.findById` в Mongo
  ([authMiddleware.js:17](backend/middleware/authMiddleware.js:17)) — выигрыш
  «statelessности» частично нивелируется обращением к БД на каждый hit.
- `JWT_SECRET` обязателен в env; в [docker-compose.yaml:41](docker-compose.yaml:41)
  стоит дефолт `replace_with_local_dev_secret` — опасно при случайном проде.
