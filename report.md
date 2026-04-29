# M2 — Report

## IDE
- Primary Claude Code

## Шаг 1 - Rules diff (что добавил руками поверх auto-generated)

- В процессе работы я несколько раз обновлял через агента rules указывая что ему стоит добавить кроме auto-generated по документации
- При запуске проекта был добавлен docker-compose для запуска приложения
- Добавлен дополнительно Jest для задания связанного с написанием тестов

## Артефакты

- **Rules-файл** — `CLAUDE.md` дополнен: команды Jest под ESM-флагом, индекс `docs/` (ADR / architecture / m2-char-tests / FINDINGS), напоминание про характеризационный контракт «не чини ассерт — меняй код и тест вместе».
- **FINDINGS** (`FINDINGS.md`) — таблица из 9 находок (🔴 5 / 🟡 3 / 🟢 1), **2 фикса**:
  - `bf9ea70` — `uploadRoutes` закрыт `protect`+`admin`, добавлен `limits.fileSize` и 400 на отсутствие файла.
  - `1690bce` — патч CVE: `jsonwebtoken` 8 → 9, `multer` 1 → 2, `mongoose` 5 → 8.
- **NH-1 Mermaid** — `docs/architecture.md`: Identity Card (LOC, возраст, active periods), C4-container диаграмма (4 subgraph'а: Frontend / Backend / Data Layer / External; реальные пути в нодах, без line numbers), Health Report (churn, deps, test gaps, поведенческие баги), 2-абзацная Codebase Story из `git log`.
- **NH-2 ADR × 3** — в `docs/adr/`:
  - `0001-jwt-bearer-with-localstorage.md` — stateless JWT + `localStorage` (vs cookies/sessions).
  - `0002-same-origin-via-cra-proxy.md` — same-origin через CRA proxy → Express static, без `cors`.
  - `0003-redux-reducer-per-use-case.md` — 21 reducer по операциям, не по ресурсам.
- **NH-3 Characterization tests на `createProductReview`** — `backend/__tests__/createProductReview.test.js`: 13 тестов под Jest+ESM (`jest.unstable_mockModule`), 3 помечены `BUGGY BEHAVIOR` (NaN-cascade, `"abc"` принимается, range не проверяется). После того как тесты стали зелёными — рефактор контроллера на pure helper'ы (`findUserReview`, `buildReview`, `computeRatingStats`, `httpError`); все 13 тестов остались green. Снапшот-бандл в `docs/m2-char-tests/` (original.js / refactored.js / characterization.test.js / reflection.md).

## Зависимости, добавленные в проект

| Пакет | Где | Когда | Зачем |
|---|---|---|---|
| `jest@^29.7.0` | root `devDependencies` | сессия M2 (NH-3) | для характеризационных тестов; запуск под `NODE_OPTIONS=--experimental-vm-modules` |
| `jsonwebtoken` 8 → **9.0.2** | root `dependencies` | коммит `1690bce` | CVE-2022-23529 (RCE) |
| `multer` 1 → **2.0.0** | root `dependencies` | коммит `1690bce` | CVE-2022-24434 (DoS) + admin-gate в `bf9ea70` |
| `mongoose` 5 → **8.0.0** | root `dependencies` | коммит `1690bce` | EOL → актуальный major |

Frontend-deps (`react@16`, `react-scripts@3.4.3`, `axios@0.20`) намеренно не трогал.

## 3 вопроса
- Сколько заняло бы вручную: ~14-16 часов (только findings + рефакторинг + README)
- Самая магическая функция IDE: для меня это создание FINDINGS.md не до конца понимаю логику как он расставлял приоритеты
- Где AI сломал и как пофиксил: после миграции mongoose сгенерил `await User.findOneAndUpdate(…)` без `{ new: true }` — старое значение возвращалось. Нашёл через characterization tests, добавил флаг, тесты снова зелёные.
