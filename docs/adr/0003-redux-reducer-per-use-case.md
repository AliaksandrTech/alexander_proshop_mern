# 3. Redux: один reducer на use-case, а не на ресурс

- Status: Accepted
- Confidence: **HIGH** (явно в коде)
- Date: 2026-04-29 (документировано постфактум)

## Context

Frontend на React 16 + classic Redux + redux-thunk
([frontend/package.json:20-22](frontend/package.json:20)). По мере роста админки на
один ресурс (`product`) приходится много независимых операций: листинг с пагинацией,
загрузка деталей, создание, обновление, удаление, добавление отзыва, top-rated
карусель. Каждая операция имеет собственный жизненный цикл `loading → success/fail`
и в части случаев требует `reset` после ухода со страницы.

Если хранить всё в одном `productReducer`, то любой `*_REQUEST` обнуляет `loading`
и затирает данные, нужные другому экрану (например, открытие формы редактирования
ломает список товаров). Нужен способ изолировать жизненные циклы операций.

## Decision

Каждой операции — свой reducer и свой ключ в `combineReducers`:

- В [frontend/src/store.js:32-54](frontend/src/store.js:32) зарегистрирован **21
  reducer**: `productList`, `productDetails`, `productDelete`, `productCreate`,
  `productUpdate`, `productReviewCreate`, `productTopRated`, `cart`, `userLogin`,
  `userRegister`, `userDetails`, `userUpdateProfile`, `userList`, `userDelete`,
  `userUpdate`, `orderCreate`, `orderDetails`, `orderPay`, `orderDeliver`,
  `orderListMy`, `orderList`.
- Каждый reducer обрабатывает строго свой набор констант
  `*_REQUEST / *_SUCCESS / *_FAIL` (+ `*_RESET` там, где это write-операция),
  пример — [frontend/src/reducers/productReducers.js:28-131](frontend/src/reducers/productReducers.js:28).
- Действия (thunks) тоже шардируются по операциям, а не по ресурсу
  (`listProducts`, `listProductDetails`, `createProduct`, ...).
- Константы лежат в `frontend/src/constants/*Constants.js` группами по операции.

Такая нарезка применяется **последовательно ко всем ресурсам** (products, users,
orders) — это конвенция, а не случайность.

## Alternatives

Инферится из того, что **не выбрано** в коде:

- **Один reducer на ресурс** (`productReducer` с полями `list`, `details`, `creating`,
  ...) — отвергнуто: в [store.js:33-39](frontend/src/store.js:33) явно семь отдельных
  product-reducer'ов, общего нет.
- **Redux Toolkit + `createSlice` + RTK Query** — отвергнуто: пакет `@reduxjs/toolkit`
  не подключён ([frontend/package.json:6-23](frontend/package.json:6)),
  `redux-toolkit`/`@reduxjs/toolkit` нет даже как peer. README прямо говорит:
  *"This project is no longer supported. The new project ... now uses Redux Toolkit"*
  ([README.md:6](README.md:6)) — то есть RTK был сознательно отложен на следующий
  major (`proshop-v2`), а здесь оставлены classic actions/reducers/constants.
- **React Query / SWR** для серверного кеша — отвергнуто: ни `react-query`, ни `swr`
  в deps нет; статус загрузок ведётся вручную через `loading`/`error` поля в каждом
  reducer'е.
- **Один большой `appReducer`** (без `combineReducers`) — отвергнуто:
  [store.js:32](frontend/src/store.js:32) использует `combineReducers`.

## Consequences

**Плюсы:**
- Полная изоляция между операциями: `PRODUCT_DETAILS_REQUEST` не сбрасывает список,
  `PRODUCT_CREATE_RESET` после успешного создания не трогает страницу деталей.
- Каждый reducer тривиально мал и читается за 30 секунд — паттерн
  REQUEST/SUCCESS/FAIL/RESET виден глазами без мысленной декомпозиции.
- Селекторы в screen-компонентах сводятся к
  `useSelector(state => state.productCreate)` — без вложенной навигации.

**Минусы (видны прямо в коде):**
- **Гигантский store-shape**: 21 ключ верхнего уровня
  ([store.js:32-54](frontend/src/store.js:32)), и при добавлении новой операции
  придётся менять 4 файла (constants, reducer, actions, store).
- **Сильная дубликация**: в [productReducers.js](frontend/src/reducers/productReducers.js)
  семь почти идентичных switch'ей по `_REQUEST/_SUCCESS/_FAIL` — никакого хелпера
  типа `createAsyncReducer` нет, всё руками.
- **Расщепление состояния одного ресурса**: данные о продукте могут жить
  одновременно в `productDetails`, `productCreate.product`, `productUpdate.product` —
  легко получить рассинхрон между экранами после успешного `update`.
- Миграция на RTK Query (как в `proshop-v2`) переписывает весь этот слой целиком —
  decision слабо обратим инкрементально.
- Гидратация из `localStorage` ([store.js:56-66](frontend/src/store.js:56)) знает
  про конкретные ключи (`cart`, `userLogin.userInfo`); добавление persistence для
  ещё одного reducer'а потребует руками править initialState — нет общего слоя
  типа `redux-persist`.
