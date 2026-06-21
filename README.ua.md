# RAPTOR — конструктор архітектури

Браузерний інструмент для проектування мікросервісних систем, симуляції трафіку та генерації документації. Без збірки, без npm.

[🇬🇧 English](README.md) · [🇷🇺 Русский](README.ru.md) · 🇺🇦 Українська · [🇵🇱 Polski](README.pl.md) · [🇪🇸 Español](README.es.md) · [🇩🇪 Deutsch](README.de.md)

![RAPTOR demo](demo.gif)

[![Live Demo](https://img.shields.io/badge/▶_Live_Demo-romanklasztorny.github.io%2Fraptor-1e4a90?style=flat-square)](https://romanklasztorny.github.io/raptor/)
[![Version](https://img.shields.io/badge/version-v1.1.0-2a6010?style=flat-square)](https://github.com/RomanKlasztorny/raptor/releases/tag/v1.1.0)
[![No build](https://img.shields.io/badge/no_build-pure_HTML%2FJS-7a6e5a?style=flat-square)](#)

---

## Швидкий старт

### Без AI (тільки схема та симуляція)

```
npx serve . -p 5500
```
Або одразу відкрити **[Live Demo →](https://romanklasztorny.github.io/raptor/)** (без AI, прямо у браузері).

### З AI (RAPTOR AI через GitHub Copilot)

**Крок 1.** Переконайся, що є [GitHub Copilot](https://github.com/features/copilot) — безкоштовний план підходить.

**Крок 2.** Встанови [Node.js](https://nodejs.org) якщо ще немає.

**Крок 3.** Встанови та запусти [anti-api](https://github.com/ink1ing/anti-api):
```
npm install -g anti-api
anti-api
```
Відкриється браузер → увійди в GitHub → anti-api запуститься на `localhost:8964`.

**Крок 4.** Запусти RAPTOR:
```
npx serve . -p 5500
```
Відкрити `http://localhost:5500` → кнопка `🤖 AI` готова до роботи.

---

## Можливості

### Схема
- Блоки: клієнти, Gateway, сервіси, BFF, Auth, PostgreSQL, Redis, MongoDB, Kafka, RabbitMQ, NATS, Queue, Elasticsearch, S3, CDN, LB, External
- Drag & drop, визначення колізій, двонаправлені стрілки
- Авторозстановка по шарах — кнопка `Авто`
- Рівні **C1 / C2 / C3 / Seq** перемикаються в тулбарі

### Симуляція
- Кульки летять по шляхах сценаріїв, режим **Хаос**: падіння вузлів, деградація
- Kafka/RabbitMQ/NATS/Queue — live інспектор з топологією, consumer groups, DLQ

### UML Sequence
- Генерується зі сценарію за PlantUML-стандартом
- Kafka → пунктирна стрілка `-)`, кнопка **«📋 PlantUML»** для Confluence

### База даних
- Редактор схеми PostgreSQL, візуальний ERD (crow's foot), імпорт SQL, 23 шаблони

### RAPTOR AI
- Кнопка `🤖 AI` → панель чату, 13 інструментів
- Працює через [anti-api](https://github.com/ink1ing/anti-api) (GitHub Copilot, безкоштовний план)

---

## Релізи

| Версія | Що нового |
|--------|-----------|
| **[v1.1.0](https://github.com/RomanKlasztorny/raptor/releases/tag/v1.1.0)** | RAPTOR AI (13 інструментів), виправлена симуляція Kafka, sim-trace |
| [v1.0.0](https://github.com/RomanKlasztorny/raptor/releases/tag/v1.0.0) | Перший публічний реліз |

Повний список змін → [CHANGELOG.md](CHANGELOG.md)
