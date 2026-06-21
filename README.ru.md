# РАПТОР — конструктор архитектуры

Браузерный инструмент для проектирования микросервисных систем, симуляции трафика и генерации документации. Без сборки, без npm.

[🇬🇧 English](README.md) · [🇷🇺 Русский](README.ru.md) · [🇺🇦 Українська](README.ua.md) · [🇵🇱 Polski](README.pl.md) · [🇪🇸 Español](README.es.md) · [🇩🇪 Deutsch](README.de.md)

![RAPTOR demo](demo.gif)

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

**Шаг 3.** Установи и запусти [anti-api](https://github.com/ink1ing/anti-api):
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

### Симуляция
- Шарики летят по путям сценариев, режим **Хаос**: падения узлов, деградация
- Kafka/RabbitMQ/NATS/Queue — live инспектор с топологией, consumer groups, DLQ

### UML Sequence
- Генерируется из сценария по PlantUML-стандарту
- Kafka → пунктирная стрелка `-)`, кнопка **«📋 PlantUML»** для Confluence

### База данных
- Редактор схемы PostgreSQL, визуальный ERD (crow's foot), импорт SQL, 23 шаблона

### RAPTOR AI
- Кнопка `🤖 AI` → панель чата, 13 инструментов, отвечает на русском
- Работает через [anti-api](https://github.com/ink1ing/anti-api) (GitHub Copilot, бесплатный план)

---

## Релизы

| Версия | Что нового |
|--------|-----------|
| **[v1.1.0](https://github.com/RomanKlasztorny/raptor/releases/tag/v1.1.0)** | RAPTOR AI (13 инструментов), исправлена Kafka симуляция, sim-trace |
| [v1.0.0](https://github.com/RomanKlasztorny/raptor/releases/tag/v1.0.0) | Первый публичный релиз |

Полный список изменений → [CHANGELOG.md](CHANGELOG.md)
