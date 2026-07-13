![RAPTOR v1.1.1](https://raw.githubusercontent.com/RomanKlasztorny/raptor/main/docs/release-notes.jpg)

**🌐 Мова:** [🇬🇧 English](README.md) · [🇷🇺 Русский](README_RU.md) · [🇩🇪 Deutsch](README_DE.md) · [🇫🇷 Français](README_FR.md) · [🇪🇸 Español](README_ES.md) · [🇵🇱 Polski](README_PL.md) · [🇨🇳 中文](README_ZH.md) · [🇯🇵 日本語](README_JA.md)

# РАПТОР — конструктор архітектури

> Браузерний інструмент для проєктування мікросервісних систем, симуляції трафіку та генерації документації. Без збірки, без npm — відкрий `index.html` і працюй.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-1e4a90?style=for-the-badge)](https://romanklasztorny.github.io/raptor/)
[![Release](https://img.shields.io/github/v/release/RomanKlasztorny/raptor?style=for-the-badge&color=2a6010)](https://github.com/RomanKlasztorny/raptor/releases/latest)

![RAPTOR demo](https://raw.githubusercontent.com/RomanKlasztorny/raptor/main/docs/demo.gif)

---

## Ідея

Опиши систему одним повідомленням — РАПТОР AI генерує повну архітектуру: блоки, зв'язки, схеми БД і сценарії. Завдання аналітика — **редагувати і уточнювати**, а не малювати стрілочки з нуля.

---

## Швидкий старт

```bash
npx serve .     # → http://localhost:5500
```

---

## ⚡ Налаштування — RAPTOR AI

> Безкоштовно · Без картки · 30 секунд

```
① console.groq.com → Sign up → API Keys → Create API Key
② Скопіюй ключ  →  gsk_••••••••••••••••••••••••
③ РАПТОР  →  🤖 AI  →  встав ключ  →  Enter  ✓
```

Ключ зберігається в `localStorage` — вводиться один раз на браузер.

---

## 🔌 Використання з будь-якою LLM (ChatGPT, Claude, Gemini…)

Не хочеш Groq? Згенеруй JSON через **будь-яку модель** і завантаж:

```
① Відкрий  RAPTOR_FORMAT.md  ← повна схема JSON + приклади
②   ↓
   Вставте в ChatGPT / Claude / Gemini:
   «Згенеруй RAPTOR JSON для [опис системи]. Схема: …»
③   ↓
   Скопіюй JSON з відповіді
④ РАПТОР  →  Файл → Імпорт JSON  →  вставте текст  →  ОК
   ↓
   ✦ Канвас миттєво заповниться блоками, зв'язками, схемами БД і сценаріями
```

> **Порада:** прикріпи `RAPTOR_FORMAT.md` як файл — більшість моделей читають його цілком.

---

## Можливості

### RAPTOR AI
- Одне повідомлення → повна мікросервісна система: блоки, зв'язки, схеми БД, сценарії
- Три режими: **gen** (генерація з нуля), **chat** (план + питання), **patch** (доопрацювання без перегенерації)
- 18 архітектурних патернів у промпті: Saga, Outbox, CQRS, Cache-aside, Circuit Breaker та ін.
- Автофікс: напрямок зв'язків, cross-DB FK, дедуплікація
- Працює через **Groq** (llama-3.3-70b, безкоштовний план) — ключ на [console.groq.com](https://console.groq.com)

### Схема (C4)
- Блоки: Актор, Клієнт, API Gateway, Load Balancer, CDN, WebSocket GW, BFF, Сервіс, Auth, PostgreSQL, MySQL, MongoDB, Redis, Cassandra, ClickHouse, Elasticsearch, S3, Kafka, RabbitMQ, NATS, Queue, Зовнішній
- Drag & drop, визначення колізій, двоспрямовані стрілки
- Авторозміщення по шарах, рівні C4 у тулбарі

### Шаблони
- **18 Систем**: Банк, Месенджер, Маркетплейс, YouTube, Пошук, Таксі, Соцмережа, Доставка їжі, Каршеринг, Spotify, Netflix, Тіндер, Криптобіржа, EdTech, Фітнес, Букінг, Хмара, Туду
- **44 Елементи** за 10 темами · **61 DB-шаблон**
- 3-рівневе flyout меню

### Сценарії
- Шляхи запитів через систему з `verb + uri + resp` на кожному кроці
- Автозаповнення враховує `auth_mode` Gateway

### Симуляція
- Кульки летять шляхами сценаріїв
- Kafka / RabbitMQ / NATS / Queue отримують живий трафік
- Клік по кульці → hop-трейс із затримками · **Режим Хаос**

### UML Sequence
- Автогенерація зі сценарію за стандартом PlantUML
- Kafka → `-)` · синхронні повернення · `group alt/else`
- Кнопка **📋 PlantUML** — скопіювати в Confluence
- ~~Code-to-diagram~~ → **Click-to-diagram**: клікаєш по блоках на схемі — РАПТОР сам прокладає шлях по зв'язках, підсвічуючи доступні вузли. Після кожного кліку — попап для опису кроку (метод, URI, відповідь). Enter — і sequence-діаграма готова
- Функціональність в активній розробці; прості CRUD-операції вже в два кліки — редагуй процес на високому і низькому рівні прямо на схемі

### База даних
- Редактор схеми PostgreSQL з візуальним ERD (crow's foot)
- Redis-редактор: патерни ключів з типом і TTL
- Імпорт SQL DDL, 61 готовий шаблон

### Експорт
- **Word (.docx)** — універсальний формат, який є у кожного стейкхолдера. Перед експортом обираєш що включити: C4-діаграма, таблиці API, схема БД, ERD — береш що потрібно, решту пропускаєш
- **draw.io** XML · **Swagger / OpenAPI YAML** · Повністю офлайн

---

## Стан

Все в глобальному об'єкті `S`. Збереження → JSON-файл. Завантаження → Файл → Імпорт JSON → вставити текст → ОК.
