# Changelog

## v1.1.0 — RAPTOR AI + Kafka fix

### Новое
- **RAPTOR AI** — панель чата `🤖 AI`, работает через GitHub Copilot (anti-api)
  - 13 инструментов: добавить блок/связь/сценарий, авторасстановка, редактор UML Sequence, схема БД
  - Agentic loop (до 12 итераций), видит текущую схему и сценарии, отвечает на русском
- **sim-trace.js** — детальный трейс симуляции по hop-ам

### Исправлено
- **Kafka симуляция** — счётчики produced/consumed больше не показывают нули
  - Корень: `EL[x.type]?.cat` → `BASE[x.type]?.cat` (EL не содержит `.cat`)
  - `tickBrokerConsumers()` — периодическое потребление каждые ~500 мс, независимо от шариков
- **`spawnScenario(sc)`** — шарики следуют точно по пути сценария с его цветом
- **seq.js** — накопленные фиксы стрелок и phase-логики
- **routes.js / ui.js** — мелкие правки редактора шагов

---

## v1.0.0 — первый публичный релиз *(15 июня 2026)*

Базовая версия без AI.

### Включает
- Схема: блоки (22 типа), drag & drop, авторасстановка, C1/C2/C3/Seq
- Сценарии («Линии»): путь + шаги verb/uri/resp, автозаполнение по auth_mode
- Симуляция: шарики по сценариям, хаос-режим
- Брокер-инспектор: Kafka/RabbitMQ/NATS/Queue — live топология, consumer groups, DLQ
- UML Sequence: PlantUML, autonumber, активации, alt/else, ref-блоки, export
- БД: ERD crow's foot, импорт SQL, 23 шаблона PostgreSQL, FK/UUID/created_at
- Auth-сервис: 5 типов (jwt/oauth2/session/api_key/oidc)
- Шаблоны сервисов (9) и групп (10)
- Word-экспорт: структура MS-1, C4-картинка, API, таблицы БД

