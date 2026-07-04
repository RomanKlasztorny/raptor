![RAPTOR v1.1.1](https://github.com/user-attachments/assets/6ac2d4f1-be78-4d66-9aa0-601ec8934be6)

**🌐 Sprache:** [🇬🇧 English](README.md) · [🇷🇺 Русский](README_RU.md) · [🇺🇦 Українська](README_UA.md) · [🇫🇷 Français](README_FR.md) · [🇪🇸 Español](README_ES.md) · [🇵🇱 Polski](README_PL.md) · [🇨🇳 中文](README_ZH.md) · [🇯🇵 日本語](README_JA.md)

# RAPTOR — Architektur-Konstruktor

> Browser-basiertes Tool zum Entwerfen von Microservice-Systemen, Simulieren von Traffic und Generieren von Dokumentation. Kein Build-Schritt, kein npm — `index.html` öffnen und loslegen.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-1e4a90?style=for-the-badge)](https://romanklasztorny.github.io/raptor/)
[![Release](https://img.shields.io/github/v/release/RomanKlasztorny/raptor?style=for-the-badge&color=2a6010)](https://github.com/RomanKlasztorny/raptor/releases/latest)

![RAPTOR demo](https://github.com/RomanKlasztorny/raptor/assets/232060178/28fc476b-8a9a-49ee-9e74-c893a6720924)

---

## Die Idee

Beschreibe dein System in einer Nachricht — RAPTOR AI generiert die vollständige Architektur: Blöcke, Verbindungen, DB-Schemas und Szenarien. Die Aufgabe des Analysten ist es, zu **bearbeiten und verfeinern**, nicht Pfeile von Grund auf zu zeichnen.

---

## Schnellstart

```bash
npx serve .     # → http://localhost:5500
```

---

## ⚡ Einrichtung — RAPTOR AI

> Kostenlos · Keine Kreditkarte · 30 Sekunden

```
① console.groq.com → Registrieren → API Keys → Create API Key
② Schlüssel kopieren  →  gsk_••••••••••••••••••••••••
③ RAPTOR  →  🤖 AI  →  Schlüssel einfügen  →  Enter  ✓
```

Schlüssel wird in `localStorage` gespeichert — einmalige Eingabe pro Browser.

---

## 🔌 Mit jedem LLM verwenden (ChatGPT, Claude, Gemini…)

Kein Groq? JSON mit **beliebigem Modell** generieren und laden:

```
① Öffne  RAPTOR_FORMAT.md  ← vollständiges JSON-Schema + Beispiele
②   ↓
   In ChatGPT / Claude / Gemini einfügen:
   „Generiere RAPTOR JSON für [dein System]. Schema: …"
③   ↓
   JSON aus der Antwort kopieren
④ RAPTOR  →  Datei → JSON importieren  →  Text einfügen  →  OK
   ↓
   ✦ Canvas füllt sich sofort mit Blöcken, Verbindungen, DB-Schemas, Szenarien
```

> **Tipp:** `RAPTOR_FORMAT.md` als Datei anhängen — die meisten Modelle lesen sie komplett.

---

## Funktionen

### RAPTOR AI
- Eine Nachricht → vollständiges Microservice-System: Blöcke, Verbindungen, DB-Schemas, Szenarien
- Drei Modi: **gen** (von Grund auf generieren), **chat** (Planung + Q&A), **patch** (inkrementelle Updates)
- 18 Architekturmuster im Prompt: Saga, Outbox, CQRS, Cache-aside, Circuit Breaker u.a.
- Auto-Fix: Verbindungsrichtung, cross-DB FK, Deduplizierung
- Betrieben von **Groq** (llama-3.3-70b, kostenloser Plan) — API-Key von [console.groq.com](https://console.groq.com)

### Diagramm (C4)
- Blöcke: Actor, Client, API Gateway, Load Balancer, CDN, WebSocket GW, BFF, Service, Auth, PostgreSQL, MySQL, MongoDB, Redis, Cassandra, ClickHouse, Elasticsearch, S3, Kafka, RabbitMQ, NATS, Queue, External
- Drag & Drop mit Kollisionserkennung, bidirektionale Pfeile
- Automatisches Layer-Layout, C4-Ebenen in der Toolbar

### Vorlagen
- **18 Systeme**: Bank, Messenger, Marktplatz, YouTube, Suchmaschine, Taxi, Social Feed, Essenslieferung, Carsharing, Spotify, Netflix, Tinder, Kryptobörse, EdTech, Fitness, Buchung, Cloud-Speicher, Todo
- **44 Elemente** in 10 Themen · **61 DB-Vorlagen**
- 3-stufiges Flyout-Menü

### Szenarien
- Anfragepfade durch das System mit `verb + uri + resp` pro Schritt
- Autofill berücksichtigt Gateway `auth_mode`

### Simulation
- Animierte Kugeln auf Szenariopfaden
- Kafka / RabbitMQ / NATS / Queue erhalten Live-Traffic
- Klick auf Kugel → Hop-Trace mit Latenzen · **Chaos-Modus**

### UML-Sequenz
- Aus Szenario nach PlantUML-Standard generiert
- Kafka → `-)` · **📋 PlantUML** für Confluence

### Datenbank
- PostgreSQL-Schema-Editor mit visuellem ERD (Crow's Foot)
- Redis-Editor: Schlüsselmuster mit Typ und TTL
- SQL DDL-Import, 61 fertige Vorlagen

### Export
- **Word (.docx)** — universelles Format, das jeder Stakeholder hat. Vor dem Export wählst du was enthalten sein soll: C4-Diagramm, API-Tabellen, DB-Schema, ERD — nimm was du brauchst, lass den Rest weg
- **draw.io** XML · **Swagger / OpenAPI YAML** · Vollständig offline

---

## Zustand

Alles im globalen Objekt `S`. Speichern → JSON-Datei. Laden → Datei → JSON importieren → Text einfügen → OK.
