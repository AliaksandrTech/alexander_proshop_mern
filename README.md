# ProShop eCommerce Platform

> eCommerce platform built with the MERN stack & Redux.

### THIS PROJECT IS DEPRECATED UPSTREAM
The original project is no longer supported by Traversy Media — the
successor lives at [proshop-v2](https://github.com/bradtraversy/proshop-v2)
(Redux Toolkit). **This fork is kept alive as a learning / audit copy**:
classic Redux + thunks, hardened deps, written-down architectural
decisions, characterization tests around legacy controllers.

![screenshot](https://github.com/bradtraversy/proshop_mern/blob/master/uploads/Screen%20Shot%202020-09-29%20at%205.50.52%20PM.png)

## How the project is wired

MERN stack, two processes:

- **Backend** (`backend/`, Node + Express, ESM `"type": "module"`) on `:5000`.
  Mongoose against MongoDB, JWT auth via `Authorization: Bearer` header,
  uploads via `multer` to `./uploads/` (served back by `express.static`).
  Routes mount under `/api/products`, `/api/users`, `/api/orders`,
  `/api/upload`, plus an unauthenticated `/api/config/paypal`.
- **Frontend** (`frontend/`, React 16 + classic Redux + redux-thunk,
  CRA-based) on `:3000`. Talks to the backend exclusively via relative
  `/api/*` — in dev through CRA's `proxy`, in Docker through a
  build-time-rewritten `proxy`, in prod served as static by the same
  Express app. JWT is persisted in `localStorage`.
- **PayPal** Smart Buttons are loaded client-side via
  `react-paypal-button-v2`; the backend exposes only the public client ID.

Full map (C4-container Mermaid diagram, file-path nodes, churn hotspots,
test gaps): [`docs/architecture.md`](docs/architecture.md). Implicit
decisions captured in [`docs/adr/`](docs/adr/).

## Features

- Shopping cart, product reviews & ratings, top-products carousel
- Search + pagination
- Checkout flow (shipping → payment → place order)
- PayPal / credit-card integration (Smart Buttons)
- Admin: product CRUD, user management, mark orders as delivered
- Database seeder (sample users + products)

## Quick start

### Option A — Docker Compose (recommended)

```bash
cp .env.example .env          # edit JWT_SECRET and PAYPAL_CLIENT_ID
docker compose up --build
```

Compose brings up four services in order:

| Service | Port (host → container) | Notes |
|---|---|---|
| `mongo` (Mongo 7) | `27017:27017` | healthchecked via `mongosh ping` |
| `seeder` | — | runs once after mongo is healthy, then exits |
| `backend` | `5001:5000` | bind-mounts `./backend` and `./uploads` (hot reload) |
| `frontend` | `3000:3000` | bind-mounts `./frontend/src` and `./frontend/public` |

The frontend Dockerfile rewrites `frontend/package.json`'s `proxy` to
`http://backend:5000` at build time so the CRA dev server inside the
container talks to the `backend` service rather than the host.

### Option B — Local Node (no Docker)

Requires Node ≥ 16.20 (Mongoose 8 floor) and a running MongoDB at
`MONGO_URI`.

```bash
npm install
npm install --prefix frontend
cp .env.example .env
npm run dev          # backend (:5000) + frontend (:3000) concurrently
# or, separately:
npm run server       # backend only (nodemon)
npm run client       # frontend only
```

## Environment

Root `.env` (see [`.env.example`](.env.example)):

```
NODE_ENV         development | production
PORT             5000
MONGO_URI        mongodb://localhost:27017/proshop  (or Atlas URI)
JWT_SECRET       any non-trivial secret
PAYPAL_CLIENT_ID PayPal sandbox / live client ID
```

In Docker `JWT_SECRET` and `PAYPAL_CLIENT_ID` come from the host shell;
the placeholders in `docker-compose.yaml` are dev-only defaults — set
real values before any non-local use.

## Database seed

```bash
npm run data:import    # wipes + seeds sample users and products
npm run data:destroy   # wipes only
```

In Docker the `seeder` service runs `data:import` once at compose up.
Sample logins after seeding:

| Email | Password | Role |
|---|---|---|
| `admin@example.com` | `123456` | Admin |
| `john@example.com`  | `123456` | Customer |
| `jane@example.com`  | `123456` | Customer |

## Tests

Backend (Jest, ESM — needs the experimental VM modules flag):

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest
NODE_OPTIONS=--experimental-vm-modules npx jest backend/__tests__/createProductReview.test.js
```

Backend tests are *characterization* tests — they reproduce current
behavior including known bugs (marked `BUGGY BEHAVIOR` in comments).
Don't "fix" the assertions when they look wrong; change the code and
the test together, deliberately. See
[`docs/m2-char-tests/reflection.md`](docs/m2-char-tests/reflection.md)
for the rationale.

Frontend (`react-scripts test`, jest watch mode):

```bash
npm test --prefix frontend
npm test --prefix frontend -- --watchAll=false MyFile.test.js
```

## Production build

```bash
npm install --prefix frontend && npm run build --prefix frontend
NODE_ENV=production node backend/server
```

In `production` mode Express serves the built `frontend/build/` for any
non-API path, so backend and frontend collapse to a single origin.
A Heroku `postbuild` script and `Procfile` are included (legacy — not
the active deployment target).

## Project layout

```
backend/                  # Express API (ESM)
  config/db.js            # Mongoose connect
  controllers/            # 3 controllers (product, user, order)
  middleware/             # auth (protect/admin) + error
  models/                 # 3 Mongoose schemas
  routes/                 # 4 routers + inline /api/config/paypal
  utils/generateToken.js  # JWT 30d
  __tests__/              # Jest characterization tests
  seeder.js               # data:import / data:destroy
frontend/src/             # CRA + React 16 + classic Redux
  store.js                # 21 reducers (one per use-case)
  reducers/  actions/  constants/
  screens/                # 15 screens, 4 admin
  components/
docs/
  architecture.md         # C4-container Mermaid + Identity / Health / Story
  adr/                    # 3 ADRs (auth, same-origin, redux shape)
  m2-char-tests/          # snapshot of the createProductReview refactor
uploads/                  # multer disk storage (bind-mounted in Docker)
FINDINGS.md               # open audit table (risks, bugs, fixes)
CLAUDE.md                 # working notes for AI agents
```

## Notes / gotchas

- Backend ESM — relative imports must include `.js`
  (`import x from './foo.js'`); omitting breaks at runtime.
- Frontend deps (`react@16`, `react-scripts@3.4.3`, `axios@0.20`) are
  ~5 years old. Backend deps were bumped to patch CVEs
  (`jsonwebtoken@9`, `multer@2`, `mongoose@8`); frontend bumps are
  out of scope here — see [`FINDINGS.md`](FINDINGS.md) row 1.
- The frontend talks to the backend exclusively through `/api/*`.
  Don't hardcode `http://localhost:5000` — rely on the CRA proxy
  (or the Docker-rewritten proxy) so dev and prod behave the same.

## License

MIT © Traversy Media — see the [License](#license) section below for full text.

Copyright (c) 2020 Traversy Media https://traversymedia.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
