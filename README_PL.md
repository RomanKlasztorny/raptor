![RAPTOR v1.1.1](https://github.com/user-attachments/assets/6ac2d4f1-be78-4d66-9aa0-601ec8934be6)

**🌐 Język:** [🇬🇧 English](README.md) · [🇷🇺 Русский](README_RU.md) · [🇺🇦 Українська](README_UA.md) · [🇩🇪 Deutsch](README_DE.md) · [🇫🇷 Français](README_FR.md) · [🇪🇸 Español](README_ES.md) · [🇨🇳 中文](README_ZH.md) · [🇯🇵 日本語](README_JA.md)

# RAPTOR — Konstruktor Architektury

> Narzędzie przeglądarkowe do projektowania systemów mikroserwisowych, symulowania ruchu i generowania dokumentacji. Bez kroku budowania, bez npm — otwórz `index.html` i zacznij pracę.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-1e4a90?style=for-the-badge)](https://romanklasztorny.github.io/raptor/)
[![Release](https://img.shields.io/github/v/release/RomanKlasztorny/raptor?style=for-the-badge&color=2a6010)](https://github.com/RomanKlasztorny/raptor/releases/latest)

![RAPTOR demo](https://github.com/RomanKlasztorny/raptor/assets/232060178/28fc476b-8a9a-49ee-9e74-c893a6720924)

---

## Szybki start

```bash
npx serve .     # → http://localhost:5500
```

---

## ⚡ Konfiguracja — RAPTOR AI

> Bezpłatnie · Bez karty · 30 sekund

```
① console.groq.com → Zarejestruj się → API Keys → Create API Key
② Skopiuj klucz  →  gsk_••••••••••••••••••••••••
③ RAPTOR  →  🤖 AI  →  wklej klucz  →  Enter  ✓
```

Klucz zapisywany w `localStorage` — wprowadzany raz na przeglądarkę.

---

## 🔌 Użycie z dowolnym LLM (ChatGPT, Claude, Gemini…)

Bez Groq? Wygeneruj JSON **dowolnym modelem** i załaduj:

```
① Otwórz  RAPTOR_FORMAT.md  ← pełny schemat JSON + przykłady
②   ↓
   Wklej do ChatGPT / Claude / Gemini:
   „Wygeneruj RAPTOR JSON dla [twój system]. Schemat: …"
③   ↓
   Skopiuj JSON z odpowiedzi
④ RAPTOR  →  przeciągnij .json na canvas   (lub Plik → Załaduj JSON)
   ↓
   ✦ Canvas wypełnia się natychmiast: bloki, połączenia, schematy BD, scenariusze
```

> **Wskazówka:** załącz `RAPTOR_FORMAT.md` jako plik — większość modeli odczytuje go w całości.

---

## Funkcje

### Diagram
- Bloki: Aktor, Klient, API Gateway, Load Balancer, CDN, WebSocket GW, BFF, Serwis, Auth, PostgreSQL, MySQL, MongoDB, Redis, Cassandra, ClickHouse, Elasticsearch, S3, Kafka, RabbitMQ, NATS, Queue, Zewnętrzny
- Drag & drop z wykrywaniem kolizji, dwukierunkowe strzałki
- Automatyczny układ warstwowy — przycisk **Auto**
- Poziomy **C1 / C2 / C3 / Seq** w pasku narzędzi

### Szablony
- **18 Systemów**: Bank, Komunikator, Marketplace, YouTube, Wyszukiwarka, Taxi, Social Feed, Dostawa jedzenia, Carsharing, Spotify, Netflix, Tinder, Giełda krypto, EdTech, Fitness, Rezerwacje, Chmura, Todo
- **44 Elementy** w 10 kategoriach
- **61 szablonów DB**: PostgreSQL, MongoDB, Cassandra, Redis, ClickHouse
- 3-poziomowe menu flyout

### Symulacja
- Kulki poruszają się po ścieżkach scenariuszy
- Klik na kulkę → szczegóły hop-trace z opóźnieniami
- **Tryb Chaos**: awarie węzłów, degradacja, reset cache

### Sekwencja UML
- Generowana ze scenariusza zgodnie ze standardem PlantUML
- Kafka → przerywana strzałka `-)` bez synchronicznej odpowiedzi
- Przycisk **📋 PlantUML** — kopiuj do Confluence

### RAPTOR AI
- Przycisk `🤖 AI` → panel czatu po prawej
- Zasilany przez **Groq** (llama-3.3-70b, darmowy plan) — wklej klucz API z [console.groq.com](https://console.groq.com)
- Tryby: **gen** (pełna generacja), **chat** (planowanie), **patch** (przyrostowe aktualizacje)

### Eksport
- **Word (.docx)**, **draw.io**, **Swagger/OpenAPI YAML**

---

## Stan

Wszystko w globalnym obiekcie `S`. Zapisz → plik JSON. Wczytaj → przeciągnij JSON na canvas.
