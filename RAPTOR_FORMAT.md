# RAPTOR JSON Format — Reference for AI Models

> **Устаревшая инструкция.** Для генерации JSON в любом AI-чате используй
> [RAPTOR_AI_JSON_GUIDE.md](RAPTOR_AI_JSON_GUIDE.md): это самодостаточная спецификация
> с каталогом настроек и полным примером. Ниже сохранён старый текст; в нём есть
> противоречия текущему коду (число шагов, C4 Code, поведение разных импортёров).
> При расхождении приоритет у новой инструкции. Богатый проект загружай импортом JSON-файла.

Этот документ описывает формат JSON для инструмента **RAPTOR** (браузерный конструктор микросервисной архитектуры).
Используй его как спецификацию когда тебя просят описать систему или сгенерировать схему для RAPTOR.

---

## Корневая структура

```json
{
  "blocks": [...],
  "conns": [...],
  "scenarios": [...],
  "meta": { "systemName": "Название", "description": "...", "domain": "e-commerce" }
}
```

---

## BLOCKS — блоки системы

Каждый блок:
```json
{
  "id": "b1",
  "type": "<тип>",
  "customLabel": "Название на русском",
  "x": 100, "y": 60,
  "patterns": [],
  "settings": {}
}
```

**Правила id:** строки `"b1"`, `"b2"`, ... — не числа. Связи: `"c1"`, `"c2"`. Сценарии: `"sc1"`, `"sc2"`.

### Типы блоков

| Тип | Категория | Назначение |
|-----|-----------|------------|
| `actor` | WHO | Роль пользователя (Покупатель, Менеджер) |
| `web_client` | CLIENT | Веб-приложение (SPA, браузер) |
| `mob_client` | CLIENT | Мобильное приложение |
| `api_gw` | GATEWAY | API Gateway — единая точка входа |
| `websocket_gw` | GATEWAY | WebSocket Gateway для realtime |
| `lb` | GATEWAY | Load Balancer |
| `cdn` | GATEWAY | CDN |
| `bff` | GATEWAY | Backend for Frontend |
| `service` | SERVICE | Микросервис |
| `auth` | SERVICE | Сервис авторизации |
| `external` | EXTERNAL | Внешний сервис (Stripe, SMTP, SMS) |
| `postgresql` | STORAGE | PostgreSQL база данных |
| `mysql` | STORAGE | MySQL |
| `mongodb` | STORAGE | MongoDB |
| `redis` | STORAGE | Redis (кэш, сессии) |
| `elasticsearch` | STORAGE | Elasticsearch (поиск) |
| `s3` | STORAGE | S3 объектное хранилище (файлы, медиа) |
| `cassandra` | STORAGE | Cassandra |
| `clickhouse` | STORAGE | ClickHouse (аналитика) |
| `kafka` | BROKER | Apache Kafka |
| `rabbitmq` | BROKER | RabbitMQ |
| `nats` | BROKER | NATS |
| `queue` | BROKER | Очередь задач |

### Координаты (рекомендуемые)
```
actor: x=-100   web_client: x=100   api_gw: x=320
service: x=540  kafka: x=760        db: x=980
external: x=1200
y: первый=60, каждый следующий в той же колонке +160
```

### `components` — компоненты сервиса (C3, необязательно)
Для блоков-сервисов (`service`, `bff`, `auth`) можно задать «что под капотом».
Если поля нет — компоненты строятся автоматически из связей и сценариев
(входящие → Controller/Consumer, логика → Service, исходящие → Repository/Adapter/Producer/Client).
```json
"components": [
  { "id": "c1", "name": "TransfersController", "kind": "ctrl", "funcs": ["createTransfer(req)"], "uses": ["c2"] },
  { "id": "c2", "name": "TransfersService",    "kind": "uc",   "uses": ["c3"] },
  { "id": "c3", "name": "LedgerRepository",    "kind": "repo" }
]
```
- `kind`: `ctrl` (контроллер), `cons` (consumer), `uc` (сервис / use-case), `repo`, `cache`, `prod` (producer), `cli` (клиент внешней системы); иначе → `uc`.
- `funcs` — строки-сигнатуры для уровня C4 (Code); `uses` — id компонентов, которые вызываются.
- Внешние связи блока привязываются к компонентам по имени, затем по виду; старые файлы без поля загружаются как раньше.

---

## CONNS — связи между блоками

```json
{ "id": "c1", "from": "b1", "to": "b2" }
```

### Правила направления (КРИТИЧНО)

- Связи ВСЕГДА слева направо: `actor → web_client → api_gw → service → db`
- НИКОГДА `db → service`. Только `service → db`
- КАЖДАЯ БД принадлежит РОВНО ОДНОМУ сервису. Нельзя подключать сервис А к БД сервиса Б
- Для связи между сервисами: `service_A → service_B` или через Kafka, не через чужую БД
- Kafka добавляй только если пользователь явно просит async/события/брокер

---

## DB SCHEMA — схема базы данных (PostgreSQL)

Поле `dbSchema` добавляется к блокам типа `postgresql`, `mysql`, `mongodb`:

```json
{
  "id": "b8",
  "type": "postgresql",
  "customLabel": "Orders DB",
  "x": 980, "y": 60,
  "patterns": [], "settings": {},
  "dbSchema": {
    "tables": [
      {
        "name": "orders",
        "fields": [
          { "name": "id",               "type": "UUID",           "constraints": "PK",      "desc": "ID заказа",       "example": "550e8400", "default": "gen_random_uuid()" },
          { "name": "user_id",          "type": "UUID",           "constraints": "NN",      "desc": "ID пользователя (cross-service UUID)", "example": "661f9511" },
          { "name": "status",           "type": "VARCHAR(20)",    "constraints": "NN",      "desc": "Статус заказа",   "example": "pending",  "default": "'pending'" },
          { "name": "total_amount",     "type": "DECIMAL(12,2)",  "constraints": "NN",      "desc": "Сумма заказа",    "example": "1500.00" },
          { "name": "delivery_address", "type": "TEXT",           "constraints": "NN",      "desc": "Адрес доставки",  "example": "ул. Ленина 1" },
          { "name": "idempotency_key",  "type": "VARCHAR(64)",    "constraints": "NN, UQ",  "desc": "Ключ идемпотентности", "example": "order-uuid-v4" },
          { "name": "deleted_at",       "type": "TIMESTAMPTZ",    "constraints": "",        "desc": "Soft delete (NULL = активен)", "example": null },
          { "name": "created_at",       "type": "TIMESTAMPTZ",    "constraints": "NN",      "desc": "Создан",          "default": "NOW()" },
          { "name": "updated_at",       "type": "TIMESTAMPTZ",    "constraints": "NN",      "desc": "Обновлён",        "default": "NOW()" }
        ],
        "indexes": [
          "CREATE INDEX idx_orders_user ON orders(user_id)",
          "CREATE INDEX idx_orders_status ON orders(status)",
          "CREATE INDEX idx_orders_active ON orders(user_id) WHERE deleted_at IS NULL"
        ]
      },
      {
        "name": "order_items",
        "fields": [
          { "name": "id",         "type": "UUID",          "constraints": "PK",      "desc": "ID позиции", "default": "gen_random_uuid()" },
          { "name": "order_id",   "type": "UUID",          "constraints": "NN, FK",  "desc": "ID заказа",  "fk": { "table": "orders", "field": "id" } },
          { "name": "product_id", "type": "UUID",          "constraints": "NN",      "desc": "ID товара (cross-service UUID)" },
          { "name": "quantity",   "type": "INTEGER",       "constraints": "NN",      "desc": "Количество", "example": "2" },
          { "name": "unit_price", "type": "DECIMAL(10,2)", "constraints": "NN",      "desc": "Цена за штуку на момент заказа", "example": "750.00" },
          { "name": "created_at", "type": "TIMESTAMPTZ",   "constraints": "NN",      "default": "NOW()" },
          { "name": "updated_at", "type": "TIMESTAMPTZ",   "constraints": "NN",      "default": "NOW()" }
        ],
        "indexes": [
          "CREATE INDEX idx_items_order ON order_items(order_id)"
        ]
      }
    ]
  }
}
```

### Правила БД

- Каждая таблица: минимум **8 полей**, всегда `id UUID PK`, `created_at`, `updated_at`
- **FK внутри одной БД** → объект `"fk": { "table": "имя_таблицы", "field": "id" }`, constraints = `"NN, FK"`
- **Ссылка на другой сервис** → только UUID NN, без `fk` объекта, пояснение в `desc`.  
  **Почему:** в MSA каждый сервис — отдельная физическая БД. СУБД не может создать FOREIGN KEY на таблицу в другой базе данных. Целостность обеспечивается бизнес-логикой (проверка через API) или событиями (слушать `entity.deleted`).  
  ❌ НЕЛЬЗЯ: `"fk": { "table": "users", "field": "id" }` если `users` в другой БД  
  ✅ НАДО: `{ "name": "user_id", "type": "UUID", "constraints": "NN", "desc": "ID пользователя (cross-service UUID, FK в Users Service)" }`
- **Soft delete**: `deleted_at TIMESTAMPTZ NULL` (NULL = активен)
- **Idempotency** для payments/orders: `idempotency_key VARCHAR(64) UNIQUE`
- **Optimistic locking**: `version INTEGER NN DEFAULT 1`
- Индексы на все FK-колонки и на фильтруемые (status, type, date)
- Доменные поля, не шаблонные: `goals→deadline/target_value`, `payments→gateway_tx_id`, `users→password_hash/salt/last_login_at`

---

## REDIS SCHEMA

```json
{
  "id": "b6",
  "type": "redis",
  "customLabel": "Cache",
  "redisSchema": {
    "patterns": [
      {
        "key": "product:{id}",
        "type": "String",
        "ttl": 300,
        "desc": "Кэш карточки товара",
        "writer": "Сервис товаров",
        "reader": "Сервис товаров",
        "keyVars": { "id": "b2::products.id" }
      },
      {
        "key": "session:{token}",
        "type": "Hash",
        "ttl": 3600,
        "desc": "Сессия пользователя",
        "writer": "Auth сервис",
        "reader": "API Gateway",
        "fields": [
          { "name": "user_id",  "desc": "ID пользователя" },
          { "name": "role",     "desc": "Роль" },
          { "name": "expires",  "desc": "Время истечения" }
        ]
      },
      {
        "key": "rate:{userId}:{minute}",
        "type": "String",
        "ttl": 60,
        "desc": "Счётчик rate limiting",
        "writer": "API Gateway",
        "reader": "API Gateway"
      }
    ]
  }
}
```

**Типы ключей Redis:** `String` | `Hash` | `List` | `Set` | `ZSet`

### JSON-структура для каждого типа

```json
// String — кэш объекта или счётчик
{ "key": "product:{id}", "type": "String", "ttl": 300,
  "desc": "Кэш карточки товара", "writer": "Товары", "reader": "Товары",
  "keyVars": { "id": "b2::products.id" },
  "valuePg": "b2::products.id" }

// Hash — объект с полями (частичные обновления через HSET)
{ "key": "session:{token}", "type": "Hash", "ttl": 3600,
  "desc": "Сессия пользователя", "writer": "Auth", "reader": "API Gateway",
  "fields": [
    { "name": "user_id", "desc": "ID пользователя" },
    { "name": "role",    "desc": "Роль: admin/user" },
    { "name": "expires", "desc": "Unix timestamp истечения" }
  ] }

// List — очередь или лента (LPUSH / RPOP)
{ "key": "queue:emails", "type": "List", "ttl": null,
  "desc": "Очередь писем на отправку", "writer": "Orders", "reader": "Notifications" }

// Set — уникальные значения (SADD / SISMEMBER)
{ "key": "online_users", "type": "Set", "ttl": 300,
  "desc": "Множество id онлайн-пользователей", "writer": "Auth", "reader": "Chat" }

// ZSet — сортированное множество по score (ZADD / ZRANGE)
{ "key": "leaderboard:{courseId}", "type": "ZSet", "ttl": null,
  "desc": "Рейтинг студентов по баллам (score = баллы)", "writer": "Progress", "reader": "Course",
  "keyVars": { "courseId": "b5::courses.id" } }
```

### Правила Redis

**Когда использовать какой тип:**

| Тип | Когда | Пример ключа |
|-----|-------|-------------|
| `String` | Кэш одного объекта, счётчик, флаг | `product:{id}`, `rate:{userId}:{min}` |
| `Hash` | Сессия, профиль (много полей, нужны частичные обновления) | `session:{token}`, `user:{id}:profile` |
| `List` | Очередь задач, лента событий (порядок важен) | `queue:emails`, `feed:{userId}` |
| `Set` | Уникальные значения, теги, подписки | `online_users`, `product:{id}:tags` |
| `ZSet` | Рейтинг, сортировка по score (timestamp, рейтинг) | `leaderboard`, `delayed_jobs` |

**TTL — обязательно для кэша:**
- Кэш объектов: 60–600 сек (зависит от частоты обновления)
- Сессии: 3600–86400 сек
- Rate limit счётчик: 60 сек (окно = 1 минута)
- Без TTL (`ttl: null`) — только постоянные данные: очереди, множества подписчиков

**Правила именования ключей:**
- Всегда через `:` как разделитель: `{сущность}:{id}:{суффикс}`
- Переменные в `{}`: `product:{id}`, `rate:{userId}:{minute}`
- Нижний регистр, без пробелов: `user_profile:{id}` — ОК, `UserProfile:{id}` — нет

**Кто пишет, кто читает (`writer` / `reader`):**
- Один writer на ключ — иначе гонки при записи
- Читать могут несколько сервисов (API Gateway читает сессии, Auth пишет)
- Если пишут двое — нужен `INCR`/`SETNX`/Lua-скрипт для атомарности

**Паттерны использования:**
- **Cache-aside**: сервис читает Redis → miss → читает PG → пишет в Redis → возвращает
- **Session store**: Auth пишет `Hash` при логине, API Gateway читает при каждом запросе
- **Rate limiting**: `INCR rate:{userId}:{minute}` + `EXPIRE 60` — атомарно
- **Pub/Sub**: не хранит данные, только каналы — не описывается в `redisSchema`

### redisData — примеры данных (строки для редактора)

`redisData` — опциональное поле, содержит **конкретные примеры ключ/значение** для наполнения редактора данных РАПТОРА. Это симуляционные данные, не схема. Хранятся в `b.dbRows['__redis__']` внутри инструмента.

```json
{
  "id": "b7",
  "type": "redis",
  "customLabel": "Auth Cache",
  "redisSchema": { "patterns": [...] },
  "redisData": [
    {
      "key": "session:eyJhbGciOiJIUzI1NiJ9.abc123",
      "type": "Hash",
      "value": "{\"user_id\": \"uuid-hr-001\", \"role\": \"hr\", \"expires\": 1719999999}",
      "ttl": 3600
    },
    {
      "key": "rate:uuid-hr-001:28620",
      "type": "String",
      "value": "3",
      "ttl": 60
    }
  ]
}
```

**Правила `redisData`:**
- Каждая строка: `{ "key": "...", "type": "String|Hash|...", "value": "...", "ttl": N }`
- `key` — конкретный ключ с подставленными значениями (без `{}`), например `candidate:uuid-cand-001`
- `value` — строка. Для Hash и JSON-массивов передавать как JSON-строку
- `ttl` — число секунд или `null` если без TTL
- Один пример на паттерн из `redisSchema.patterns` — достаточно
- При загрузке JSON в РАПТОР `redisData` автоматически становится строками в редакторе «Данные»

### Откуда берётся значение — поля привязки к PG

РАПТОР отображает привязку Redis → PostgreSQL в редакторе паттернов через три поля:

**`keyVars`** — откуда берётся переменная в шаблоне ключа `{var}`:
```json
"key": "candidate:{id}",
"keyVars": { "id": "b9::candidates.id" }
```
Формат значения: `"blockId::table.field"`, например `"b9::candidates.id"`.

**`fields[i].fromPg`** — для Hash: откуда берётся каждое поле:
```json
{
  "key": "candidate:{id}",
  "type": "Hash",
  "ttl": 600,
  "desc": "Профиль кандидата",
  "writer": "Candidate Service",
  "reader": "Candidate Service",
  "keyVars": { "id": "b9::candidates.id" },
  "fields": [
    { "name": "user_id",   "desc": "ID пользователя", "fromPg": "b9::candidates.user_id" },
    { "name": "full_name", "desc": "Полное имя",       "fromPg": "b9::candidates.full_name" },
    { "name": "phone",     "desc": "Телефон",           "fromPg": "b9::candidates.phone" }
  ]
}
```

**`valuePg`** — для String: откуда берётся значение целиком:
```json
{
  "key": "vacancies:open:page:{page}",
  "type": "String",
  "ttl": 120,
  "desc": "Список открытых вакансий постранично",
  "writer": "Vacancy Service",
  "reader": "Vacancy Service",
  "valueField": "JSON-массив [{id, title, department, status}]",
  "valuePg": "b12::vacancies.id"
}
```

**Когда заполнять:**

| Тип | `keyVars` | `fields[i].fromPg` | `valuePg` |
|-----|-----------|---------------------|-----------|
| Hash с полями из PG | ✅ обязательно | ✅ на каждое поле | — |
| String = кэш объекта из PG | ✅ обязательно | — | ✅ ссылка на PK |
| String = счётчик (INCR, rate limit) | ✅ если есть `{var}` | — | ❌ не нужен |
| List / Set / ZSet | ✅ если есть `{var}` | — | — |

**Формат значения всегда:** `"blockId::table.field"` → например `"b9::candidates.id"`.

**Если переменная НЕ из PG** (номер страницы, временная метка, вычисляемое) — `keyVars` для неё **не указывать**. Дропдаун останется пустым — это нормально.

```json
// ❌ Неправильно
"keyVars": { "page": "page", "minute": "unix_timestamp/60" }

// ✅ Правильно — page и minute не из PG, просто не указываем
"keyVars": {}   // или вообще убрать поле
```

---

## SCENARIOS — сценарии (маршруты)

```json
{
  "id": "sc1",
  "name": "Оформить заказ",
  "color": "#7aa2f7",
  "actorId": "b1",
  "volume": 100,
  "visible": true,
  "path": ["b1", "b2", "b3", "b6", "b10"],
  "steps": [
    { "name": "Открывает корзину",    "verb": "",       "uri": "",                    "resp": "",             "cache": null, "dbTarget": null },
    { "name": "Оформить заказ",       "verb": "POST",   "uri": "/api/v1/orders",      "resp": "201 {orderId}","cache": null, "dbTarget": null },
    { "name": "Маршрутизирует",       "verb": "POST",   "uri": "/orders",             "resp": "201",          "cache": null, "dbTarget": null },
    { "name": "Создать заказ",        "verb": "POST",   "uri": "/orders",             "resp": "201 {orderId}","cache": null, "dbTarget": null },
    { "name": "Сохранить заказ",      "verb": "INSERT", "uri": "orders",              "resp": "uuid заказа",  "cache": null, "dbTarget": "b10" }
  ]
}
```

### ДВА РАВНОПРАВНЫХ ФОРМАТА ШАГОВ

RAPTOR поддерживает оба формата. Выбирай тот, что удобнее для генерации.

---

#### Формат A: "AT node" — шаг описывает действие В узле (традиционный)

`steps[i]` = что делает/принимает блок `path[i]`.
`steps.length === path.length` (N блоков → N шагов).

```
path:  [actor,   web_client,         api_gw,           service,            postgresql]
steps: [step[0], step[1],            step[2],          step[3],            step[4]   ]
смысл:  актор    клиент отправляет   GW маршрутизирует сервис обрабатывает БД сохраняет
```

Пример — 5 узлов, 5 шагов:
```json
"path": ["b1","b2","b3","b4","b8"],
"steps": [
  { "name": "Нажимает «Оформить»", "verb": "",       "uri": "",               "resp": "" },
  { "name": "Создать заказ",       "verb": "POST",   "uri": "/api/v1/orders", "resp": "201 {orderId}" },
  { "name": "Маршрутизирует",      "verb": "POST",   "uri": "/orders",        "resp": "201" },
  { "name": "Обработать заказ",    "verb": "POST",   "uri": "/orders",        "resp": "201 {orderId}" },
  { "name": "Сохранить заказ",     "verb": "INSERT", "uri": "orders",         "resp": "uuid заказа" }
]
```

---

#### Формат B: "Edge message" — шаг описывает сообщение ПО РЕБРУ (канонический UML 2.x)

`steps[i]` = сообщение FROM `path[i]` TO `path[i+1]`.
`steps.length === path.length - 1` (N блоков → N-1 стрелок).

```
path:  [actor,       web_client,      api_gw,          service,         postgresql]
        |-- step[0]--|  step[1]  ------|  step[2]  ------|  step[3]  ---------------
        actor→web      web→gw           gw→svc            svc→db
```

Пример — 5 узлов, 4 шага (нет шага для actor — он всегда инициатор):
```json
"path": ["b1","b2","b3","b4","b8"],
"steps": [
  { "name": "Нажимает «Оформить»", "verb": "",       "uri": "",               "resp": "Показывает результат" },
  { "name": "Создать заказ",       "verb": "POST",   "uri": "/api/v1/orders", "resp": "201 {orderId}" },
  { "name": "Маршрутизирует",      "verb": "POST",   "uri": "/orders",        "resp": "201" },
  { "name": "Сохранить заказ",     "verb": "INSERT", "uri": "orders",         "resp": "uuid заказа" }
]
```

В формате B поле `resp` — ответная стрелка НАЗАД (FROM `path[i+1]` TO `path[i]`).

---

#### Общее для обоих форматов

- **НИКОГДА не добавляй поле `"uml"`** — RAPTOR генерирует UML сам
- Нельзя дублировать шаги чтобы добить число — лучше убрать лишний блок из path
- RAPTOR автоматически нормализует длину steps при загрузке

### Verbs по типу узла

| Узел | verb | uri | resp |
|------|------|-----|------|
| actor (path[0]) | `""` | `""` | `""` |
| web_client / mob_client | `GET/POST/PUT/DELETE` | `/api/v1/resource` | `200 {data}` / `201 {id}` / `204` |
| api_gw | то же что клиент | `/resource` (без /api/v1) | тот же код |
| → postgresql (чтение) | `SELECT` | `table_name` | `rows` / `row\|null` |
| → postgresql (запись) | `INSERT/UPDATE/DELETE` | `table_name` | `uuid X` |
| → redis (проверка кэша) | `GET` | `key:{id}` | `hit:{data}\|miss:null` |
| → redis (запись в кэш) | `SET` | `key:{id}` | `OK` |
| → redis (инвалидация) | `DEL` | `key:{id}` | `OK` |
| → redis (rate limit) | `INCR` | `rate:{userId}:{minute}` | `count` |
| → kafka (публикация) | `PUBLISH` | `topic.event_name` | `""` |
| → kafka (потребление) | `CONSUME` | `topic.event_name` | `""` |
| → rabbitmq | `PUBLISH` | `exchange/routing_key` | `""` |
| → queue | `ENQUEUE` | `queue_name` | `job_id` |
| → elasticsearch | `GET` | `/index/_search` | `[{_source}]` |
| → external | `POST` | `/endpoint` | `200 {result}` |

### Структура сценариев

- 3–5 сценариев: happy path, list/search, async publish, consumer, cache HIT/MISS
- **Async = 2 сценария**: (1) путь заканчивается на kafka; (2) отдельный сценарий начинается с kafka, `actorId: null`
- **Cache MISS путь**: `[..., service, redis, postgresql, redis]` — redis посещается дважды (проверка + запись)
- **Cache HIT путь**: `[..., service, redis]` — путь заканчивается на redis
- Цвета: `#7aa2f7` `#9ece6a` `#e0af68` `#f7768e` `#bb9af7` `#2ac3de` `#ff9e64`

---

## Пример: Async Kafka сценарий (два сценария в паре)

```json
// Сценарий 1: публикация (path заканчивается на kafka)
{
  "id": "sc2",
  "name": "Создать заказ → уведомить",
  "color": "#e0af68",
  "actorId": "b1",
  "volume": 80,
  "visible": true,
  "path": ["b1", "b2", "b3", "b6", "b10", "b5"],
  "steps": [
    { "name": "Оформляет заказ",         "verb": "",        "uri": "",                 "resp": "" },
    { "name": "Запрос создания заказа",  "verb": "POST",    "uri": "/api/v1/orders",   "resp": "201 {orderId}" },
    { "name": "Маршрутизирует",          "verb": "POST",    "uri": "/orders",          "resp": "201" },
    { "name": "Создать заказ",           "verb": "POST",    "uri": "/orders",          "resp": "201 {orderId}" },
    { "name": "Сохранить заказ",         "verb": "INSERT",  "uri": "orders",           "resp": "uuid заказа" },
    { "name": "Опубликовать событие",    "verb": "PUBLISH", "uri": "orders.created",   "resp": "" }
  ]
}

// Сценарий 2: потребление (начинается с kafka, actorId=null)
{
  "id": "sc3",
  "name": "Обработка события заказа",
  "color": "#9ece6a",
  "actorId": null,
  "volume": 80,
  "visible": true,
  "path": ["b5", "b7", "b11"],
  "steps": [
    { "name": "Получить событие",        "verb": "CONSUME", "uri": "orders.created",   "resp": "" },
    { "name": "Отправить уведомление",   "verb": "POST",    "uri": "/notifications",   "resp": "200 {msgId}" },
    { "name": "Сохранить уведомление",   "verb": "INSERT",  "uri": "notifications",    "resp": "uuid" }
  ]
}
```

---

## Архитектурные правила МСА

1. **Каждый сервис — своя БД.** Никогда не подключай два сервиса к одной БД
2. **Нет прямых запросов в чужую БД.** Только через API или брокер
3. **FK между сервисами** — копия UUID без объекта `fk`, только `"constraints": "NN"`
4. **Payments/Orders** — обязательно `idempotency_key UUID UNIQUE` в таблице
5. **Kafka** — только при явном запросе пользователя на async/события
6. **Outbox**: при платежах и заказах добавляй таблицу `outbox(id, event_type, payload, sent_at, processed_at)`

---

## Минимальный полный пример (зоомагазин)

```json
{
  "blocks": [
    { "id": "b1", "type": "actor",      "customLabel": "Покупатель",   "x": -100, "y": 60,  "patterns": [], "settings": {} },
    { "id": "b2", "type": "web_client", "customLabel": "Веб-приложение","x": 100,  "y": 60,  "patterns": [], "settings": {} },
    { "id": "b3", "type": "api_gw",     "customLabel": "API Gateway",  "x": 320,  "y": 60,  "patterns": [], "settings": {} },
    { "id": "b4", "type": "service",    "customLabel": "Товары",        "x": 540,  "y": 60,  "patterns": [], "settings": {} },
    { "id": "b5", "type": "postgresql", "customLabel": "Products DB",  "x": 980,  "y": 60,  "patterns": [], "settings": {},
      "dbSchema": { "tables": [
        { "name": "products", "fields": [
          { "name": "id",           "type": "UUID",          "constraints": "PK", "desc": "ID товара",    "default": "gen_random_uuid()" },
          { "name": "name",         "type": "VARCHAR(255)",  "constraints": "NN", "desc": "Название",     "example": "Корм для кошек" },
          { "name": "description",  "type": "TEXT",          "constraints": "",   "desc": "Описание" },
          { "name": "price",        "type": "DECIMAL(10,2)", "constraints": "NN", "desc": "Цена",         "example": "500.00" },
          { "name": "category_id",  "type": "UUID",          "constraints": "NN, FK", "desc": "Категория", "fk": { "table": "categories", "field": "id" } },
          { "name": "stock_qty",    "type": "INTEGER",       "constraints": "NN", "desc": "Остаток",      "example": "100", "default": "0" },
          { "name": "deleted_at",   "type": "TIMESTAMPTZ",   "constraints": "",   "desc": "Soft delete"  },
          { "name": "created_at",   "type": "TIMESTAMPTZ",   "constraints": "NN", "default": "NOW()"     },
          { "name": "updated_at",   "type": "TIMESTAMPTZ",   "constraints": "NN", "default": "NOW()"     }
        ], "indexes": ["CREATE INDEX idx_products_category ON products(category_id)"] }
      ]}
    }
  ],
  "conns": [
    { "id": "c1", "from": "b1", "to": "b2" },
    { "id": "c2", "from": "b2", "to": "b3" },
    { "id": "c3", "from": "b3", "to": "b4" },
    { "id": "c4", "from": "b4", "to": "b5" }
  ],
  "scenarios": [
    {
      "id": "sc1", "name": "Просмотр товаров", "color": "#7aa2f7",
      "actorId": "b1", "volume": 200, "visible": true,
      "path": ["b1", "b2", "b3", "b4", "b5"],
      "steps": [
        { "name": "Открывает каталог",    "verb": "",       "uri": "",                   "resp": "",             "cache": null, "dbTarget": null },
        { "name": "Запрос списка товаров","verb": "GET",    "uri": "/api/v1/products",   "resp": "200 [{...}]",  "cache": null, "dbTarget": null },
        { "name": "Маршрутизирует",       "verb": "GET",    "uri": "/products",          "resp": "200",          "cache": null, "dbTarget": null },
        { "name": "Получить товары",      "verb": "GET",    "uri": "/products",          "resp": "200 [{...}]",  "cache": null, "dbTarget": null },
        { "name": "Выбрать товары",       "verb": "SELECT", "uri": "products",           "resp": "rows",         "cache": null, "dbTarget": "b5" }
      ]
    }
  ],
  "meta": {
    "systemName": "Зоомагазин",
    "description": "Микросервисная система интернет-магазина",
    "domain": "e-commerce",
    "problem": "",
    "solution": ""
  }
}
```

---

## SEQUENCE RULES — ЖЁСТКИЕ ПРАВИЛА (нарушение = невалидный JSON)

### 1. Длина steps — зависит от формата

**Формат A ("AT node"):** `steps.length === path.length`
```
path: ["b1","b2","b3","b4","b8"]  → 5 элементов → 5 шагов
path: ["b5","b7","b9"]            → 3 элемента  → 3 шага
```

**Формат B ("Edge"):** `steps.length === path.length - 1`
```
path: ["b1","b2","b3","b4","b8"]  → 5 элементов → 4 шага (N-1 стрелок)
path: ["b5","b7","b9"]            → 3 элемента  → 2 шага
```

**Запрещено в обоих форматах:**
- Дублировать шаги чтобы "добить" число
- Повторять INSERT/SELECT дважды
- Оставлять значительно меньше шагов чем требуется

**Если не сходится — исправляй path, не steps.**

---

### 2. Смысл step[i] — зависит от формата

**Формат A** (`steps.length = N`): step[i] = что делает/принимает узел `path[i]`
```
path[0] = actor      → step[0]: что актор ДЕЛАЕТ (открывает, нажимает)
path[1] = web_client → step[1]: что клиент ДЕЛАЕТ (отправляет запрос)
path[2] = api_gw     → step[2]: что GW ДЕЛАЕТ (маршрутизирует)
path[3] = service    → step[3]: что сервис ДЕЛАЕТ (обрабатывает)
path[4] = postgresql → step[4]: что БД ДЕЛАЕТ (INSERT, SELECT)
```

**Формат B** (`steps.length = N-1`): step[i] = сообщение ПО РЕБРУ от `path[i]` к `path[i+1]`
```
step[0] = actor → web_client:  что актор инициирует (переход к следующему)
step[1] = web_client → api_gw: что клиент отправляет в GW
step[2] = api_gw → service:    что GW передаёт сервису
step[3] = service → db:        что сервис делает с БД
(нет step[4] — возврат описывается через поле resp предыдущих шагов)
```

**verb/uri/resp:** одинаковые поля в обоих форматах. В формате B `resp` = ответная стрелка НАЗАД.

---

### 3. Запрещённые verbs по типу узла

| Узел | НЕЛЬЗЯ | НАДО |
|------|--------|------|
| actor | любой verb | `""` (пустая строка) |
| api_gw | `INSERT`, `SELECT`, `PUBLISH` | `GET/POST/PUT/DELETE` |
| service → db | `POST`, `GET` | `INSERT/SELECT/UPDATE/DELETE` |
| service → kafka | `GET`, `POST`, `INSERT` | `PUBLISH` |
| kafka → service | `POST`, `GET` | `CONSUME` |
| service → redis | `POST`, `INSERT` | `GET/SET/DEL/INCR` |
| service → elasticsearch | `INSERT` | `GET` (поиск) или `POST` (индексация) |
| service → external | `INSERT`, `SELECT` | `POST` |

---

### 4. URI — формат по типу узла

```
web_client:  /api/v1/resource        ← с префиксом /api/v1
api_gw:      /resource               ← БЕЗ /api/v1 (gateway его снимает)
service:     /resource               ← внутренний путь
→ postgresql: table_name             ← только имя таблицы, без / и без SQL
→ redis:      key:{var}              ← паттерн ключа с переменными в {}
→ kafka:      topic.event_name       ← через точку, без /
→ elasticsearch: /index/_search      ← с /
→ external:   /external/endpoint     ← полный путь
```

**Запрещено для БД:** `/orders`, `INSERT INTO orders`, `SELECT * FROM` — только `orders`

---

### 5. resp — формат ответа

```
POST создание:   "201 {orderId}"  или  "201 {id}"
GET список:      "200 [{...}]"
GET один:        "200 {object}"
PUT обновление:  "200 {ok}"
DELETE:          "204"
api_gw:          "201"  или  "200"  (только код, без тела)
→ postgresql INSERT:  "uuid заказа"  или  "1 row"
→ postgresql SELECT:  "rows"  или  "row | null"
→ redis GET:     "hit: {data} | miss: null"
→ redis SET:     "OK"
→ redis DEL:     "OK"
→ kafka PUBLISH: ""  (пустая строка, нет ответа)
→ kafka CONSUME: ""  (пустая строка)
```

---

### 6. Actor — всегда первый, всегда пустой verb

```json
{ "name": "Открывает корзину", "verb": "", "uri": "", "resp": "", "cache": null, "dbTarget": null }
```

- actor ВСЕГДА path[0]
- verb, uri, resp — пустые строки `""`
- name — что пользователь делает физически: "Нажимает кнопку оплаты", "Открывает страницу товара"

---

### 7. API Gateway — всегда "Маршрутизирует"

```json
{ "name": "Маршрутизирует", "verb": "POST", "uri": "/orders", "resp": "201", "cache": null, "dbTarget": null }
```

- verb = тот же что у web_client
- uri = тот же путь НО без `/api/v1`
- resp = только HTTP код, без тела
- name = всегда "Маршрутизирует"

---

### 8. Kafka — строгие правила пути

**Publish (путь заканчивается на kafka):**
```
path: ["b1","b2","b3","b4","b10","b5"]
                                  ↑ kafka — последний элемент
step последний: { "verb": "PUBLISH", "uri": "orders.created", "resp": "" }
```

**Consume (ОТДЕЛЬНЫЙ сценарий, actorId: null, путь НАЧИНАЕТСЯ с kafka):**
```json
{
  "actorId": null,
  "path": ["b5", "b7", "b11"],
  "steps": [
    { "name": "Получить событие",   "verb": "CONSUME", "uri": "orders.created", "resp": "" },
    { "name": "Обработать событие", "verb": "POST",    "uri": "/notify",        "resp": "200" },
    { "name": "Сохранить лог",      "verb": "INSERT",  "uri": "notifications",  "resp": "uuid" }
  ]
}
```

**Запрещено:** путь `[..., kafka, db]` без промежуточного сервиса-консьюмера.

---

### 9. Cache-aside — два отдельных сценария

**HIT (путь заканчивается на redis, БД не нужна):**
```
path: ["b1","b2","b3","b4","b6"]
step[4]: { "verb": "GET", "uri": "product:{id}", "resp": "hit: {product}" }
```

**MISS (redis → postgresql → redis, redis посещается ДВАЖДЫ):**
```
path: ["b1","b2","b3","b4","b6","b8","b6"]
                              ↑redis  ↑db  ↑redis снова
steps[4]: { "verb": "GET",    "uri": "product:{id}",  "resp": "miss: null" }
steps[5]: { "verb": "SELECT", "uri": "products",       "resp": "row" }
steps[6]: { "verb": "SET",    "uri": "product:{id}",   "resp": "OK" }
```

**Запрещено:** путь `[..., service, redis, db]` без возврата в redis (кэш не записан).

---

### 10. Что КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО в scenarios

```
❌ "uml": "..."                          — поле uml, RAPTOR генерирует сам
❌ steps.length ≠ path.length            — несовпадение длин
❌ дублирование шага (два INSERT подряд) — дубли
❌ пустой шаг в середине пути            — { "name": "", "verb": "", ... } не в конце
❌ path содержит несуществующий id        — только реальные id из blocks
❌ actorId ссылается не на actor-блок    — только блоки с type="actor"
❌ один сценарий и publish и consume     — это два разных сценария
❌ verb="POST" на БД                     — только INSERT/SELECT/UPDATE/DELETE
❌ verb="INSERT" на api_gw               — только GET/POST/PUT/DELETE
❌ uri="orders" на web_client            — нужен /api/v1/orders
❌ resp="201 {id}" на api_gw             — только код "201"
```

---

### 11. Полный правильный пример сценария (5 узлов)

**Формат A (5 шагов — step AT node):**
```json
{
  "id": "sc1",
  "name": "Оформить заказ",
  "color": "#7aa2f7",
  "actorId": "b1",
  "volume": 100,
  "visible": true,
  "path": ["b1", "b2", "b3", "b4", "b8"],
  "steps": [
    { "name": "Нажимает «Оформить заказ»", "verb": "",       "uri": "",               "resp": "",             "cache": null, "dbTarget": null },
    { "name": "Создать заказ",             "verb": "POST",   "uri": "/api/v1/orders", "resp": "201 {orderId}","cache": null, "dbTarget": null },
    { "name": "Маршрутизирует",            "verb": "POST",   "uri": "/orders",        "resp": "201",          "cache": null, "dbTarget": null },
    { "name": "Обработать заказ",          "verb": "POST",   "uri": "/orders",        "resp": "201 {orderId}","cache": null, "dbTarget": null },
    { "name": "Сохранить заказ",           "verb": "INSERT", "uri": "orders",         "resp": "uuid заказа",  "cache": null, "dbTarget": "b8" }
  ]
}
```
Проверка: path.length=5, steps.length=5 ✓ | actor verb="" ✓ | web_client POST /api/v1 ✓ | db INSERT ✓

**Формат B (4 шага — step AS edge message):**
```json
{
  "id": "sc1",
  "name": "Оформить заказ",
  "color": "#7aa2f7",
  "actorId": "b1",
  "volume": 100,
  "visible": true,
  "path": ["b1", "b2", "b3", "b4", "b8"],
  "steps": [
    { "name": "Нажимает «Оформить заказ»", "verb": "",       "uri": "",               "resp": "Показывает результат" },
    { "name": "Создать заказ",             "verb": "POST",   "uri": "/api/v1/orders", "resp": "201 {orderId}" },
    { "name": "Маршрутизирует",            "verb": "POST",   "uri": "/orders",        "resp": "201" },
    { "name": "Сохранить заказ",           "verb": "INSERT", "uri": "orders",         "resp": "uuid заказа" }
  ]
}
```
Проверка: path.length=5, steps.length=4 (N-1) ✓ | step[0]=actor→web ✓ | step[3]=svc→db ✓

---

## Чеклист перед выводом JSON

- [ ] Каждый сервис имеет собственный отдельный блок БД
- [ ] Каждая БД: 2+ таблицы, 8+ полей каждая, FK-объекты присутствуют
- [ ] FK ссылается только на таблицы ВНУТРИ той же БД — не на чужие
- [ ] Направление связей: service→db, никогда db→service
- [ ] Каждый сценарий: steps.length === path.length (формат A) или path.length-1 (формат B), нет дубликатов
- [ ] Нет поля `"uml"` в сценариях
- [ ] Все id строки: `"b1"`, `"c1"`, `"sc1"` — не числа
- [ ] Связи ссылаются на id, не на customLabel

---

## BPMN — формат бизнес-процессов

Отдельный режим (`notationMode: "bpmn"`), отдельная структура данных — **не** blocks/conns. Один процесс = один объект-диаграмма:

```json
{
  "id": "bp1",
  "name": "Оформление заказа",
  "elements": [ /* узлы: пулы, дорожки, события, задачи, шлюзы, артефакты */ ],
  "flows":    [ /* связи между elements */ ]
}
```

### Элементы (`elements`)

Общая форма любого элемента (кроме boundary-событий):
```json
{ "id": "be1", "type": "start", "label": "Заказ получен", "x": 70, "y": 108, "w": 44, "h": 44 }
```

**ВАЖНО — принадлежность пулу/дорожке считается ГЕОМЕТРИЧЕСКИ, поля `poolId`/`laneId` не существует.** Элемент принадлежит пулу/дорожке, если его центр (x+w/2, y+h/2) физически попадает внутрь прямоугольника пула/дорожки. Значит: **сначала расставь пулы и дорожки с их x/y/w/h, потом координаты каждой задачи/события/шлюза считай ВНУТРИ соответствующей дорожки** — иначе элемент "повиснет" вне процесса и `bpmnValidate` даст warning.

Типы `type` (полный список):

| type | категория | размер по умолчанию | форма |
|---|---|---|---|
| `pool` | контейнер | 560×260 | пул (внешняя рамка) |
| `lane` | контейнер | 480×140, обычно `w = pool.w-16`, стек по y внутри пула | дорожка |
| `start` | событие | 44×44 | круг, тонкая рамка |
| `end` | событие | 44×44 | круг, толстая рамка |
| `event_message` / `event_timer` / `event_error` / `event_signal` | событие | 44×44 | круг с иконкой |
| `task` / `task_user` / `task_service` / `task_script` | задача | 110×64 | прямоугольник |
| `subprocess` | задача | 130×74 | прямоугольник (вложенный процесс) |
| `gateway_xor` | шлюз | 50×50 | ромб — Exclusive (ИЛИ, одна ветка) |
| `gateway_and` | шлюз | 50×50 | ромб — Parallel (И, все ветки) |
| `gateway_or` | шлюз | 50×50 | ромб — Inclusive (одна+ ветка) |
| `gateway_event_based` | шлюз | 50×50 | ромб, ветвление по событию |
| `boundary_timer` / `boundary_error` / `boundary_message` | boundary-событие | 32×32 | круг на границе задачи, нужен `attachedTo` |
| `data_object` | артефакт | 36×46 | документ |
| `data_store` | артефакт | 52×44 | цилиндр |
| `annotation` | артефакт | 150×44 | текстовая заметка |

Boundary-событие дополнительно требует `attachedTo` — id задачи, на границе которой оно сидит:
```json
{ "id": "be9", "type": "boundary_timer", "label": "Таймаут 30мин", "attachedTo": "be5", "x": 0, "y": 0, "w": 32, "h": 32 }
```
(x/y можно ставить `0` — они пересчитаются автоматически по позиции задачи-хоста).

### Связи (`flows`)

```json
{ "id": "bf1", "from": "be4", "to": "be5" }
{ "id": "bf3", "from": "be6", "to": "be7", "label": "Да" }
```
- `label` на связи, выходящей из `gateway_*` — это условие ветвления. **У шлюза с 2+ исходящими связями labelКАЖДОЙ исходящей связи обязателен** (иначе `bpmnValidate` даст warning — непонятно, при каком условии идёт какая ветка).
- Отдельного поля `type` у связи нет — тип линии (Sequence/Message/Association) выводится автоматически: если оба конца в одном пуле → Sequence (сплошная), если в разных пулах → Message Flow (пунктир), если один конец — артефакт (`data_object`/`data_store`/`annotation`) → Association (точки, без стрелки).

### Пулы, дорожки и роли — маппинг по бизнес-смыслу (обязательно)

Пул = **организация или система целиком** (например: "Интернет-магазин", "Банк-эквайер", "Служба доставки" — отдельный пул на каждого внешнего участника процесса, если процесс межорганизационный).

Дорожка = **конкретная роль/подразделение/сервис внутри этого пула**, которая реально выполняет действия — не техническая абстракция, а бизнес-роль: "Менеджер по продажам", "Склад", "Служба поддержки", "Робот-скоринг" и т.п.

Правила маппинга при генерации:
1. Каждая задача (`task*`) кладётся в дорожку той роли, которая её **реально выполняет** по смыслу — не туда, где было место. "Проверить остаток на складе" → дорожка "Склад", а не "Менеджер".
2. Если в процессе участвует внешняя система/контрагент (банк, курьер, поставщик) — это отдельный **пул**, а не дорожка внутри основного пула. Между пулами — только Message Flow, никогда обычный Sequence Flow.
3. Не создавай дорожку "Система" на всё подряд — если задачи явно относятся к разным ролям (продажи vs логистика vs финансы), у них должны быть разные дорожки.
4. Start-событие — в дорожке той роли, которая инициирует процесс (обычно клиент/менеджер, не бэкенд-сервис).
5. Названия пулов/дорожек — бизнес-термины на языке домена, не технические (не "auth-service", а "Служба авторизации" / "Отдел безопасности" — смотря что по смыслу).

### Обязательные правила валидности (проверяет `bpmnValidate`)

- Ровно один явный путь от Start до End — на диаграмме обязателен хотя бы один `start` и хотя бы один `end`.
- У `start` не может быть входящих связей, у `end` — исходящих.
- У любого элемента (кроме `start`) должна быть хотя бы одна входящая связь.
- У любого элемента (кроме `end` и boundary-событий) должна быть хотя бы одна исходящая связь — тупиков быть не должно.
- Каждый элемент должен быть достижим от какого-нибудь `start` (без учёта связей-артефактов).
- Если на диаграмме есть пулы — каждый обычный элемент (не пул/не дорожка) должен физически лежать внутри какого-то пула.
- У шлюза с 2+ исходящими ветками — у каждой ветки обязателен `label`.

### Пример: межорганизационный процесс, 1 пул, 2 дорожки

```json
{
  "id": "bp1",
  "name": "Оформление заказа",
  "elements": [
    { "id": "be1", "type": "pool", "label": "Интернет-магазин", "x": 40, "y": 40, "w": 560, "h": 260 },
    { "id": "be2", "type": "lane", "label": "Отдел продаж", "x": 48, "y": 68, "w": 544, "h": 120 },
    { "id": "be3", "type": "lane", "label": "Склад",        "x": 48, "y": 188, "w": 544, "h": 120 },

    { "id": "be4", "type": "start",        "label": "Заказ получен",   "x": 70,  "y": 108, "w": 44,  "h": 44 },
    { "id": "be5", "type": "task_user",    "label": "Проверить оплату","x": 150, "y": 96,  "w": 110, "h": 64 },
    { "id": "be6", "type": "gateway_xor",  "label": "Оплата прошла?",  "x": 300, "y": 103, "w": 50,  "h": 50 },
    { "id": "be7", "type": "task_service", "label": "Собрать заказ",   "x": 400, "y": 216, "w": 110, "h": 64 },
    { "id": "be8", "type": "end",          "label": "Заказ выполнен",  "x": 550, "y": 108, "w": 44,  "h": 44 },
    { "id": "be9", "type": "end",          "label": "Заказ отменён",   "x": 300, "y": 20,  "w": 44,  "h": 44 }
  ],
  "flows": [
    { "id": "bf1", "from": "be4", "to": "be5" },
    { "id": "bf2", "from": "be5", "to": "be6" },
    { "id": "bf3", "from": "be6", "to": "be7", "label": "Да" },
    { "id": "bf4", "from": "be6", "to": "be9", "label": "Нет" },
    { "id": "bf5", "from": "be7", "to": "be8" }
  ]
}
```

---

## C2 / C4 — уровни архитектуры (Context / Container / Component)

**Важно: C1–C3 — это НЕ отдельная структура данных.** Это фильтр поверх обычных `blocks`/`conns` (тех же, что описаны в начале документа). Отдельного JSON-формата для C4 нет — просто рисуешь обычную схему blocks/conns, а уровень определяется автоматически по `cat` каждого типа блока (см. каталог типов блоков выше в этом документе):

- **C1 Context** — видны только: акторы (`cat:"actor"`), клиенты (`cat:"client"`), внешние системы (`cat:"external"`), шлюзы (`cat:"gw"`). Показывает где система стоит в общей картине — кто ей пользуется и с кем она граничит.
- **C2 Container** — видно всё, КРОМЕ сетевых элементов (`cat:"net"`, например CDN/LB). Это основной уровень "из чего состоит система" — сервисы, БД, брокеры, кэши, шлюзы.
- **C3 Component** — видны только внутренние компоненты: сервисы, БД, кэш, брокеры, очереди (`cat` ∈ `svc/db/cache/broker/queue`). Показывает архитектуру ОДНОГО сервиса — обычно применяется вместе с фильтром по конкретному сервису.
- **C4 Dynamic** — это не фильтр блоков, а Sequence-диаграмма конкретного сценария (см. раздел SCENARIOS выше) — открывается отдельным редактором.

Единственные поля, влияющие на подпись блока на C2/C3 (не на его видимость):
- `customLabel` — переопределяет имя блока.
- `tech` — технология контейнера, показывается подписью `[Container: <tech>]` (например `"tech": "Node.js"`, `"tech": "Go"`). Задавай `tech`, когда явно известен стек — это стандартная часть C4 Container-диаграммы.
- `S.meta.systemName` (не поле блока, а общий meta проекта) — подпись рамки системной границы на C1/C2.

### Пример: тот же набор blocks/conns, но с полями под C2

```json
{
  "meta": { "systemName": "Платформа заказов" },
  "blocks": [
    { "id": "b1", "type": "web_client", "x": 40,  "y": 200, "customLabel": "Веб-приложение" },
    { "id": "b2", "type": "api_gw",     "x": 220, "y": 200 },
    { "id": "b3", "type": "service",    "x": 400, "y": 120, "customLabel": "Сервис заказов",  "tech": "Node.js" },
    { "id": "b4", "type": "service",    "x": 400, "y": 280, "customLabel": "Сервис платежей", "tech": "Go" },
    { "id": "b5", "type": "postgresql", "x": 600, "y": 120 },
    { "id": "b6", "type": "redis",      "x": 600, "y": 280 }
  ],
  "conns": [
    { "from": "b1", "to": "b2" },
    { "from": "b2", "to": "b3" },
    { "from": "b2", "to": "b4" },
    { "from": "b3", "to": "b5" },
    { "from": "b4", "to": "b6" }
  ]
}
```
Это ОДНА и та же схема на всех уровнях C1–C3 — просто на каждом уровне приложение прячет часть блоков по `cat`. Отдельно генерировать "C2-версию" не нужно — она получается автоматически из основной схемы, если типы блоков и `tech` расставлены осмысленно.

---

## Чеклист BPMN перед выводом JSON

- [ ] Есть хотя бы один `start` и хотя бы один `end`
- [ ] У каждого элемента (кроме end/boundary) есть исходящая связь — нет тупиков
- [ ] У каждого элемента (кроме start) есть входящая связь
- [ ] У каждой исходящей связи шлюза (`gateway_*`) заполнен `label` с условием
- [ ] Пулы = организации/системы (внешние по отношению друг к другу), дорожки = роли/подразделения ВНУТРИ одной организации
- [ ] Каждая задача лежит в дорожке той роли, которая её реально выполняет по бизнес-смыслу — не как попало
- [ ] Координаты задач/событий/шлюзов физически попадают внутрь прямоугольника своей дорожки (проверка геометрическая, поля laneId нет)
- [ ] Между разными пулами — только Message Flow (это получается автоматически, если элементы физически в разных пулах)
- [ ] Названия пулов/дорожек — бизнес-термины домена, не технические ("Служба поддержки", а не "support-svc")
