![RAPTOR v1.1.1](https://github.com/user-attachments/assets/6ac2d4f1-be78-4d66-9aa0-601ec8934be6)

**🌐 Язык:** [🇬🇧 English](README.md) · [🇺🇦 Українська](README_UA.md) · [🇩🇪 Deutsch](README_DE.md) · [🇫🇷 Français](README_FR.md) · [🇪🇸 Español](README_ES.md) · [🇵🇱 Polski](README_PL.md) · [🇨🇳 中文](README_ZH.md) · [🇯🇵 日本語](README_JA.md)

# РАПТОР — конструктор архитектуры

> Браузерный инструмент для проектирования микросервисных систем, симуляции трафика и генерации документации. Без сборки, без npm — открываешь `index.html` и работаешь.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-1e4a90?style=for-the-badge)](https://romanklasztorny.github.io/raptor/)
[![Release](https://img.shields.io/github/v/release/RomanKlasztorny/raptor?style=for-the-badge&color=2a6010)](https://github.com/RomanKlasztorny/raptor/releases/latest)

![RAPTOR demo](https://github.com/RomanKlasztorny/raptor/assets/232060178/28fc476b-8a9a-49ee-9e74-c893a6720924)

---

## Идея

Опиши систему одним сообщением — РАПТОР AI генерирует полную архитектуру: блоки, связи, схемы БД и сценарии. Задача аналитика — **редактировать и уточнять**, а не рисовать стрелочки с нуля.

---

## Быстрый старт

```bash
npx serve .     # → http://localhost:5500
```

---

## ⚡ Настройка — RAPTOR AI

> Бесплатно · Без карты · 30 секунд

```
① console.groq.com → Sign up → API Keys → Create API Key
② Скопируй ключ  →  gsk_••••••••••••••••••••••••
③ РАПТОР  →  🤖 AI  →  вставь ключ  →  Enter  ✓
```

Ключ хранится в `localStorage` — вводится один раз на браузер.

---

## 🔌 Использование с любой LLM (ChatGPT, Claude, Gemini…)

Не хочешь Groq? Сгенерируй JSON через **любую модель** и загрузи:

```
① Открой  RAPTOR_FORMAT.md  ← полная схема JSON + примеры
②   ↓
   Вставь в ChatGPT / Claude / Gemini:
   «Сгенерируй RAPTOR JSON для [описание системы]. Схема: …»
③   ↓
   Скопируй JSON из ответа
④ РАПТОР  →  Файл → Импорт JSON  →  вставь текст  →  ОК
   ↓
   ✦ Канвас мгновенно заполнится блоками, связями, схемами БД и сценариями
```

> **Совет:** прикрепи `RAPTOR_FORMAT.md` как файл — большинство моделей читают его целиком.

---

## Возможности

### RAPTOR AI
- Одно сообщение → полная микросервисная система: блоки, связи, схемы БД, сценарии
- Три режима: **gen** (генерация с нуля), **chat** (план + вопросы), **patch** (доработка без перегенерации)
- 18 архитектурных паттернов в промпте: Saga, Outbox, CQRS, Cache-aside, Circuit Breaker и др.
- Автофикс: направление связей, cross-DB FK, дедупликация
- Работает через **Groq** (llama-3.3-70b, бесплатный план) — ключ на [console.groq.com](https://console.groq.com)

### Схема (C4)
- Блоки: Актор, Клиент, API Gateway, Load Balancer, CDN, WebSocket GW, BFF, Сервис, Auth, PostgreSQL, MySQL, MongoDB, Redis, Cassandra, ClickHouse, Elasticsearch, S3, Kafka, RabbitMQ, NATS, Queue, Внешний
- Drag & drop, детект коллизий, двунаправленные стрелки
- Авторасстановка по слоям
- Уровни C4 в тулбаре

### Шаблоны
- **18 Систем**: Банк, Мессенджер, Маркетплейс, YouTube, Поисковик, Такси, Соцсеть, Доставка еды, Каршеринг, Spotify, Netflix, Тиндер, Криптобиржа, EdTech, Фитнес, Букинг, Облако, Туду
- **44 Элемента** по 10 темам: платежи, логирование, хранение, коммуникации, поиск, аналитика, медиа, безопасность и др.
- **61 DB-шаблон**: PostgreSQL, MongoDB, Cassandra, Redis, ClickHouse
- 3-уровневое flyout меню

### Сценарии
- Пути запросов через систему с `verb + uri + resp` на каждом шаге
- Автозаполнение учитывает `auth_mode` Gateway
- У каждого сценария: объём (rps), цвет, актор

### Симуляция
- Шарики летят по путям сценариев
- Kafka / RabbitMQ / NATS / Queue получают живой трафик
- Клик по шарику → hop-трейс с задержками
- **Режим Хаос**: падения узлов, деградация, сброс кэша

### Брокер-инспектор
- Живая панель: SVG-топология, счётчики produced / processed / lag / DLQ (500мс)
- Consumer groups с офсетами, кнопка Replay

### UML Sequence
- Автогенерация из сценария по стандарту PlantUML
- Kafka → `-)`, синхронные возвраты, `group alt/else`
- Кнопка **📋 PlantUML** — скопировать в Confluence

### База данных
- Редактор схемы PostgreSQL с визуальным ERD (нотация crow's foot)
- Redis-редактор: паттерны ключей с типом и TTL, «подтянуть из PG» для Hash
- Импорт SQL DDL, 61 готовый шаблон

### Auth-сервис
- Типы: `jwt_only` / `oauth2_jwt` / `session_based` / `api_key` / `oidc_sso`
- Тип меняет схему БД и нагрузку Auth в симуляции

### Экспорт
- **Word (.docx)** — структура MS-1: описание, C4-диаграмма, API, таблицы БД, ERD, Redis-схема
- **draw.io** XML, **Swagger / OpenAPI YAML**
- Полностью офлайн через встроенный `docx.min.js`

### Локализация
- Русский и английский интерфейс, переключение без перезагрузки

---

## Состояние

Всё в глобальном объекте `S`. Сохранение → JSON-файл. Загрузка → Файл → Импорт JSON → вставить текст → ОК.
