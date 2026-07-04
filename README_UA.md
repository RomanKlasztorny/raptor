![RAPTOR v1.1.1](https://github.com/user-attachments/assets/6ac2d4f1-be78-4d66-9aa0-601ec8934be6)

**🌐 Мова:** [🇬🇧 English](README.md) · [🇷🇺 Русский](README_RU.md) · [🇩🇪 Deutsch](README_DE.md) · [🇫🇷 Français](README_FR.md) · [🇪🇸 Español](README_ES.md) · [🇵🇱 Polski](README_PL.md) · [🇨🇳 中文](README_ZH.md) · [🇯🇵 日本語](README_JA.md)

# РАПТОР — конструктор архітектури

> Браузерний інструмент для проєктування мікросервісних систем, симуляції трафіку та генерації документації. Без збірки, без npm — відкрий `index.html` і працюй.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-1e4a90?style=for-the-badge)](https://romanklasztorny.github.io/raptor/)
[![Release](https://img.shields.io/github/v/release/RomanKlasztorny/raptor?style=for-the-badge&color=2a6010)](https://github.com/RomanKlasztorny/raptor/releases/latest)

![RAPTOR demo](https://github.com/RomanKlasztorny/raptor/assets/232060178/28fc476b-8a9a-49ee-9e74-c893a6720924)

---

## Швидкий старт

```bash
npx serve .     # → http://localhost:5500
```

---

## Можливості

### Схема
- Блоки: Актор, Клієнт, API Gateway, Load Balancer, CDN, WebSocket GW, BFF, Сервіс, Auth, PostgreSQL, MySQL, MongoDB, Redis, Cassandra, ClickHouse, Elasticsearch, S3, Kafka, RabbitMQ, NATS, Queue, Зовнішній сервіс
- Drag & drop, визначення колізій, двоспрямовані стрілки
- Авторозміщення по шарах — кнопка **Авто**
- Рівні **C1 / C2 / C3 / Seq** в тулбарі

### Шаблони
- **18 Систем**: Банк, Месенджер, Маркетплейс, YouTube, Пошук, Таксі, Соцмережа, Доставка їжі, Каршеринг, Spotify, Netflix, Тіндер, Криптобіржа, EdTech, Фітнес, Букінг, Хмара, Туду
- **44 Елементи** за 10 темами
- **61 DB-шаблон**: PostgreSQL, MongoDB, Cassandra, Redis, ClickHouse
- 3-рівневе flyout меню

### Симуляція
- Кульки летять шляхами сценаріїв
- Клік по кульці → деталі hop-трейсу із затримками
- **Режим Хаос**: збої вузлів, деградація, скидання кешу

### UML Sequence
- Генерується зі сценарію за стандартом PlantUML
- Kafka → пунктирна стрілка `-)` без синхронної відповіді
- Кнопка **📋 PlantUML** — копіює для Confluence

### RAPTOR AI
- Кнопка `🤖 AI` → панель чату праворуч
- Працює через **Groq** (llama-3.3-70b, безкоштовний план) — вставте ключ з [console.groq.com](https://console.groq.com)
- Режими: **gen** (генерація з нуля), **chat** (план), **patch** (доопрацювання)

### Експорт
- **Word (.docx)**, **draw.io**, **Swagger/OpenAPI YAML**

---

## Стан

Все в глобальному об'єкті `S`. Збереження → JSON-файл. Завантаження → перетягни JSON на канвас.
