![RAPTOR v1.1.1](https://github.com/user-attachments/assets/6ac2d4f1-be78-4d66-9aa0-601ec8934be6)

**🌐 Sprache:** [🇬🇧 English](README.md) · [🇷🇺 Русский](README_RU.md) · [🇺🇦 Українська](README_UA.md) · [🇫🇷 Français](README_FR.md) · [🇪🇸 Español](README_ES.md) · [🇵🇱 Polski](README_PL.md) · [🇨🇳 中文](README_ZH.md) · [🇯🇵 日本語](README_JA.md)

# RAPTOR — Architektur-Konstruktor

> Browser-basiertes Tool zum Entwerfen von Microservice-Systemen, Simulieren von Traffic und Generieren von Dokumentation. Kein Build-Schritt, kein npm — `index.html` öffnen und loslegen.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-1e4a90?style=for-the-badge)](https://romanklasztorny.github.io/raptor/)
[![Release](https://img.shields.io/github/v/release/RomanKlasztorny/raptor?style=for-the-badge&color=2a6010)](https://github.com/RomanKlasztorny/raptor/releases/latest)

![RAPTOR demo](https://github.com/RomanKlasztorny/raptor/assets/232060178/28fc476b-8a9a-49ee-9e74-c893a6720924)

---

## Schnellstart

```bash
npx serve .     # → http://localhost:5500
```

---

## Funktionen

### Diagramm
- Blöcke: Actor, Client, API Gateway, Load Balancer, CDN, WebSocket GW, BFF, Service, Auth, PostgreSQL, MySQL, MongoDB, Redis, Cassandra, ClickHouse, Elasticsearch, S3, Kafka, RabbitMQ, NATS, Queue, External
- Drag & Drop mit Kollisionserkennung, bidirektionale Pfeile
- Automatisches Layer-Layout — Schaltfläche **Auto**
- **C1 / C2 / C3 / Seq** Ebenen in der Toolbar

### Vorlagen
- **18 Systeme**: Bank, Messenger, Marktplatz, YouTube, Suchmaschine, Taxi, Social Feed, Essenslieferung, Carsharing, Spotify, Netflix, Tinder, Kryptobörse, EdTech, Fitness, Buchung, Cloud-Speicher, Todo
- **44 Elemente** in 10 Themen
- **61 DB-Vorlagen**: PostgreSQL, MongoDB, Cassandra, Redis, ClickHouse
- 3-stufiges Flyout-Menü

### Simulation
- Kugeln bewegen sich auf Szenariopfaden
- Klick auf Kugel → Hop-Trace-Details mit Latenzen
- **Chaos-Modus**: Knotenausfälle, Degradierung, Cache-Reset

### UML-Sequenz
- Aus Szenario generiert nach PlantUML-Standard
- Kafka → gestrichelte Pfeile `-)` ohne synchrone Antwort
- **📋 PlantUML** Schaltfläche — kopieren für Confluence

### RAPTOR AI
- `🤖 AI` Schaltfläche → Chat-Panel rechts
- Betrieben von **Groq** (llama-3.3-70b, kostenloser Plan) — API-Key von [console.groq.com](https://console.groq.com) einfügen
- Modi: **gen** (vollständige Generierung), **chat** (Planung), **patch** (inkrementelle Updates)

### Export
- **Word (.docx)**, **draw.io**, **Swagger/OpenAPI YAML**

---

## Zustand

Alles im globalen Objekt `S`. Speichern → JSON-Datei. Laden → JSON auf Canvas ziehen.
