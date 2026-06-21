# РАПТОР — конструктор архитектуры

Браузерный инструмент для проектирования микросервисных систем, симуляции трафика и генерации документации. Без сборки, без npm.

[![Live Demo](https://img.shields.io/badge/▶_Live_Demo-romanklasztorny.github.io%2Fraptor-1e4a90?style=flat-square)](https://romanklasztorny.github.io/raptor/)
[![Version](https://img.shields.io/badge/version-v1.1.0-2a6010?style=flat-square)](https://github.com/RomanKlasztorny/raptor/releases/tag/v1.1.0)
[![No build](https://img.shields.io/badge/no_build-pure_HTML%2FJS-7a6e5a?style=flat-square)](#)

---

## Быстрый старт

### Без AI (только схема и симуляция)

```
npx serve . -p 5500
```
Или сразу открыть **[Live Demo →](https://romanklasztorny.github.io/raptor/)** (без AI, прямо в браузере).

### С AI (RAPTOR AI через GitHub Copilot)

**Шаг 1.** Убедись, что у тебя есть [GitHub Copilot](https://github.com/features/copilot) — бесплатный план подходит.

**Шаг 2.** Установи [Node.js](https://nodejs.org) если ещё нет.

**Шаг 3.** Установи и запусти [anti-api](https://github.com/ink1ing/anti-api) — он сделает авторизацию через GitHub за тебя:
```
npm install -g anti-api
anti-api
```
Откроется браузер → войди в GitHub → anti-api запустится на `localhost:8964`.

**Шаг 4.** Запусти RAPTOR:
```
npx serve . -p 5500
```
Открыть `http://localhost:5500` → кнопка `🤖 AI` готова к работе.

---

## Что умеет

### Схема
- Блоки: клиенты, Gateway, сервисы, BFF, Auth, PostgreSQL, Redis, MongoDB, Kafka, RabbitMQ, NATS, Queue, Elasticsearch, S3, CDN, LB, External
- Drag & drop, детект коллизий, двунаправленные стрелки
- Авторасстановка по слоям — кнопка `Авто`
- Уровни **C1 / C2 / C3 / Seq** переключаются в тулбаре

### Сценарии («Линии»)
- Вкладка «Линии» — маршруты запросов через систему
- Каждый сценарий: путь блоков, объём (rps), цвет, шаги с `verb + uri + resp`
- `Автозаполнение` строит шаги по схеме с учётом `auth_mode` Gateway

### Симуляция
- Шарики летят по путям сценариев, цвет = цвет сценария
- Kafka/RabbitMQ/NATS/Queue получают трафик когда шарик проходит через сервис-продюсер
- Потребление: периодический тик каждые ~500 мс независимо от физики шариков
- Клик по шарику → детали hop-трейса с задержками
- Режим **Хаос**: падения узлов, деградация, сброс кэша, перегрузка

### Брокер-инспектор
- Клик на Kafka/RabbitMQ/NATS/Queue во время симуляции → живая панель
- SVG-топология: продюсеры → партиции → консьюмеры
- Счётчики live: опубликовано / обработано / lag / DLQ, обновление 500 мс
- Consumer groups с офсетами по партициям, кнопка Replay
- Обоснование для БА: партиции, RF, гарантии доставки
- Настройки брокера без остановки симуляции

### UML Sequence
- Генерируется из сценария: бизнес-смысл над стрелкой, `verb uri` под `//`
- Стандарт PlantUML: `autonumber`, активации `++/--`, `group alt/else`, `...пауза...`
- Kafka → пунктирная стрелка `-)` без синхронного ответа
- Кнопка **«📋 PlantUML»** — копирует для Confluence
- `ref over` блоки с горизонтальным drag (меняет участников) и вертикальным (порядок)

### База данных
- Редактор схемы PostgreSQL для каждого сервиса
- Визуальный ERD в нотации crow's foot
- Импорт SQL-DDL
- 23 готовых шаблона (users, sessions, bookings, products и др.)
- FK с `REFERENCES + ON DELETE CASCADE`, UUID, `created_at`

### Auth-сервис
- Типы: `jwt_only` / `oauth2_jwt` / `session_based` / `api_key` / `oidc_sso`
- Тип меняет схему БД и нагрузку Auth в симуляции
- Gateway читает `auth_mode` → автоматически строит хоп к Auth или пропускает

### Шаблоны
**Сервисы (9):** search, media, chat\_ws, cqrs, b2b\_api, sso, scheduler, reports, saga\_step  
**Группы (10):** shop, fullmsa, eventdriven, mentorship, cqrs, b2b\_api, sso, multibff, fintech, saga

### Word-экспорт
- Структура MS-1: описание, C4-диаграмма, API по сервисам, таблицы БД
- Офлайн через встроенный `docx.min.js`

### RAPTOR AI

Кнопка `🤖 AI` → панель чата справа. Строит схему, пишет UML, создаёт таблицы БД — голосом на русском.

**13 инструментов:** добавить/удалить блок, добавить связь, создать сценарий, авторасстановка, редактировать UML Sequence, менять схему БД, очистить холст.

> AI работает через **[anti-api](https://github.com/ink1ing/anti-api)** — открытый прокси, который делает OAuth-авторизацию GitHub Copilot за тебя. Спасибо [ink1ing](https://github.com/ink1ing) за инструмент: без него пришлось бы вручную получать `gho_`-токен через OAuth flow — это нетривиально. Каждый пользователь авторизуется своим аккаунтом, чужих токенов нет.

---

## Состояние

Всё в глобальном объекте `S` (блоки, связи, сценарии, мета).  
Сохранение → JSON-файл. Загрузка → перетащить JSON на канвас.

---

## Релизы

| Версия | Что нового |
|--------|-----------|
| **[v1.1.0](https://github.com/RomanKlasztorny/raptor/releases/tag/v1.1.0)** | RAPTOR AI (13 инструментов), исправлена Kafka симуляция, sim-trace |
| [v1.0.0](https://github.com/RomanKlasztorny/raptor/releases/tag/v1.0.0) | Первый публичный релиз — схема, симуляция, UML, ERD, Word-экспорт |

Полный список изменений → [CHANGELOG.md](CHANGELOG.md)
