![RAPTOR v1.1.1](https://github.com/user-attachments/assets/6ac2d4f1-be78-4d66-9aa0-601ec8934be6)

**🌐 Язык:** [🇬🇧 English](README.md) · [🇺🇦 Українська](README_UA.md) · [🇩🇪 Deutsch](README_DE.md) · [🇫🇷 Français](README_FR.md) · [🇪🇸 Español](README_ES.md) · [🇵🇱 Polski](README_PL.md) · [🇨🇳 中文](README_ZH.md) · [🇯🇵 日本語](README_JA.md)

# РАПТОР — конструктор архитектуры

> Браузерный инструмент для проектирования микросервисных систем, симуляции трафика и генерации документации. Без сборки, без npm — открываешь `index.html` и работаешь.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-1e4a90?style=for-the-badge)](https://romanklasztorny.github.io/raptor/)
[![Release](https://img.shields.io/github/v/release/RomanKlasztorny/raptor?style=for-the-badge&color=2a6010)](https://github.com/RomanKlasztorny/raptor/releases/latest)

![RAPTOR demo](https://github.com/RomanKlasztorny/raptor/assets/232060178/28fc476b-8a9a-49ee-9e74-c893a6720924)

---

## Быстрый старт

```bash
npx serve .     # → http://localhost:5500
```

---

## Возможности

### Схема
- Блоки: Актор, Клиент, API Gateway, Load Balancer, CDN, WebSocket GW, BFF, Сервис, Auth, PostgreSQL, MySQL, MongoDB, Redis, Cassandra, ClickHouse, Elasticsearch, S3, Kafka, RabbitMQ, NATS, Queue, Внешний сервис
- Drag & drop, детект коллизий, двунаправленные стрелки
- Авторасстановка по слоям — кнопка **Авто**
- Уровни **C1 / C2 / C3 / Seq** в тулбаре

### Шаблоны
- **18 Систем**: Банк, Мессенджер, Маркетплейс, YouTube, Поисковик, Такси, Соцсеть, Доставка еды, Каршеринг, Spotify, Netflix, Тиндер, Криптобиржа, EdTech, Фитнес, Букинг, Облако, Туду
- **44 Элемента** по 10 темам: платежи, логирование, хранение, коммуникации, поиск, аналитика, медиа, безопасность и др.
- **61 DB-шаблон**: PostgreSQL, MongoDB, Cassandra, Redis, ClickHouse
- 3-уровневое flyout меню

### Симуляция
- Шарики летят по путям сценариев
- Клик по шарику → детали hop-трейса с задержками
- **Режим Хаос**: падения узлов, деградация, сброс кэша

### UML Sequence
- Генерируется из сценария по стандарту PlantUML
- Kafka → пунктирная стрелка `-)` без синхронного ответа
- Кнопка **📋 PlantUML** — копирует для Confluence

### RAPTOR AI
- Кнопка `🤖 AI` → панель чата справа
- Работает через **Groq** (llama-3.3-70b, бесплатный план) — вставь ключ с [console.groq.com](https://console.groq.com)
- Режимы: **gen** (генерация с нуля), **chat** (план), **patch** (доработка)
- 18 архитектурных паттернов в промпте

### Экспорт
- **Word (.docx)** — структура MS-1 с C4-диаграммой, API, таблицами БД, ERD
- **draw.io**, **Swagger/OpenAPI YAML**

---

## Состояние

Всё в глобальном объекте `S`. Сохранение → JSON-файл. Загрузка → перетащить JSON на канвас.
