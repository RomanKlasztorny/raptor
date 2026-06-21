# RAPTOR — projektant architektury

Przeglądarkowe narzędzie do projektowania systemów mikroserwisowych, symulacji ruchu i generowania dokumentacji. Bez budowania, bez npm.

[🇬🇧 English](README.md) · [🇷🇺 Русский](README.ru.md) · [🇺🇦 Українська](README.ua.md) · 🇵🇱 Polski · [🇪🇸 Español](README.es.md) · [🇩🇪 Deutsch](README.de.md)

![RAPTOR demo](demo.gif)

[![Live Demo](https://img.shields.io/badge/▶_Live_Demo-romanklasztorny.github.io%2Fraptor-1e4a90?style=flat-square)](https://romanklasztorny.github.io/raptor/)
[![Version](https://img.shields.io/badge/version-v1.1.0-2a6010?style=flat-square)](https://github.com/RomanKlasztorny/raptor/releases/tag/v1.1.0)
[![No build](https://img.shields.io/badge/no_build-pure_HTML%2FJS-7a6e5a?style=flat-square)](#)

---

## Szybki start

### Bez AI (tylko diagram i symulacja)

```
npx serve . -p 5500
```
Lub otwórz **[Live Demo →](https://romanklasztorny.github.io/raptor/)** bezpośrednio w przeglądarce.

### Z AI (RAPTOR AI przez GitHub Copilot)

**Krok 1.** Upewnij się, że masz [GitHub Copilot](https://github.com/features/copilot) — darmowy plan wystarczy.

**Krok 2.** Zainstaluj [Node.js](https://nodejs.org) jeśli jeszcze nie masz.

**Krok 3.** Zainstaluj i uruchom [anti-api](https://github.com/ink1ing/anti-api):
```
npm install -g anti-api
anti-api
```
Otworzy się przeglądarka → zaloguj się do GitHub → anti-api uruchomi się na `localhost:8964`.

**Krok 4.** Uruchom RAPTOR:
```
npx serve . -p 5500
```
Otwórz `http://localhost:5500` → przycisk `🤖 AI` gotowy do działania.

---

## Funkcje

### Diagram
- Bloki: klienci, Gateway, serwisy, BFF, Auth, PostgreSQL, Redis, MongoDB, Kafka, RabbitMQ, NATS, Queue, Elasticsearch, S3, CDN, LB, External
- Przeciąganie i upuszczanie, wykrywanie kolizji, strzałki dwukierunkowe
- Automatyczne układanie warstwowe — przycisk `Auto`
- Poziomy **C1 / C2 / C3 / Seq** w pasku narzędzi

### Symulacja
- Kulki podążają ścieżkami scenariuszy, tryb **Chaos**: awarie węzłów, degradacja
- Kafka/RabbitMQ/NATS/Queue — inspektor na żywo z topologią, consumer groups, DLQ

### UML Sequence
- Generowany ze scenariusza według standardu PlantUML
- Kafka → strzałka przerywana `-)`, przycisk **«📋 PlantUML»** dla Confluence

### Baza danych
- Edytor schematu PostgreSQL, wizualny ERD (crow's foot), import SQL, 23 szablony

### RAPTOR AI
- Przycisk `🤖 AI` → panel czatu, 13 narzędzi
- Działa przez [anti-api](https://github.com/ink1ing/anti-api) (GitHub Copilot, darmowy plan)

---

## Wydania

| Wersja | Co nowego |
|--------|-----------|
| **[v1.1.0](https://github.com/RomanKlasztorny/raptor/releases/tag/v1.1.0)** | RAPTOR AI (13 narzędzi), poprawiona symulacja Kafka, sim-trace |
| [v1.0.0](https://github.com/RomanKlasztorny/raptor/releases/tag/v1.0.0) | Pierwsze publiczne wydanie |

Pełna lista zmian → [CHANGELOG.md](CHANGELOG.md)
