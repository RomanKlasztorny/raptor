# RAPTOR — Architektur-Designer

Browser-basiertes Tool für den Entwurf von Microservice-Architekturen, Verkehrssimulation und Dokumentationsgenerierung. Kein Build-Schritt, kein npm.

[🇬🇧 English](README.md) · [🇷🇺 Русский](README.ru.md) · [🇺🇦 Українська](README.ua.md) · [🇵🇱 Polski](README.pl.md) · [🇪🇸 Español](README.es.md) · 🇩🇪 Deutsch

![RAPTOR demo](demo.gif)

[![Live Demo](https://img.shields.io/badge/▶_Live_Demo-romanklasztorny.github.io%2Fraptor-1e4a90?style=flat-square)](https://romanklasztorny.github.io/raptor/)
[![Version](https://img.shields.io/badge/version-v1.1.0-2a6010?style=flat-square)](https://github.com/RomanKlasztorny/raptor/releases/tag/v1.1.0)
[![No build](https://img.shields.io/badge/no_build-pure_HTML%2FJS-7a6e5a?style=flat-square)](#)

---

## Schnellstart

### Ohne AI (nur Diagramm und Simulation)

```
npx serve . -p 5500
```
Oder öffne die **[Live Demo →](https://romanklasztorny.github.io/raptor/)** direkt im Browser.

### Mit AI (RAPTOR AI über GitHub Copilot)

**Schritt 1.** Stelle sicher, dass du [GitHub Copilot](https://github.com/features/copilot) hast — der kostenlose Plan reicht.

**Schritt 2.** Installiere [Node.js](https://nodejs.org) falls noch nicht vorhanden.

**Schritt 3.** Installiere und starte [anti-api](https://github.com/ink1ing/anti-api):
```
npm install -g anti-api
anti-api
```
Ein Browser-Fenster öffnet sich → bei GitHub anmelden → anti-api startet auf `localhost:8964`.

**Schritt 4.** Starte RAPTOR:
```
npx serve . -p 5500
```
Öffne `http://localhost:5500` → Schaltfläche `🤖 AI` ist bereit.

---

## Funktionen

### Diagramm
- Blöcke: Clients, Gateway, Services, BFF, Auth, PostgreSQL, Redis, MongoDB, Kafka, RabbitMQ, NATS, Queue, Elasticsearch, S3, CDN, LB, Extern
- Drag & Drop, Kollisionserkennung, bidirektionale Pfeile
- Automatische Schichtanordnung — Schaltfläche `Auto`
- Ebenen **C1 / C2 / C3 / Seq** in der Werkzeugleiste

### Simulation
- Kugeln folgen Szenario-Pfaden, **Chaos**-Modus: Knotenausfälle, Degradation
- Kafka/RabbitMQ/NATS/Queue — Live-Inspektor mit Topologie, Consumer Groups, DLQ

### UML Sequence
- Aus dem Szenario nach PlantUML-Standard generiert
- Kafka → gestrichelter Pfeil `-)`, **«📋 PlantUML»**-Schaltfläche für Confluence

### Datenbank
- PostgreSQL-Schema-Editor, visuelles ERD (Krähenfuß-Notation), SQL-Import, 23 Vorlagen

### RAPTOR AI
- Schaltfläche `🤖 AI` → Chat-Panel, 13 Werkzeuge
- Läuft über [anti-api](https://github.com/ink1ing/anti-api) (GitHub Copilot, kostenloser Plan)

---

## Versionen

| Version | Neuigkeiten |
|---------|-------------|
| **[v1.1.0](https://github.com/RomanKlasztorny/raptor/releases/tag/v1.1.0)** | RAPTOR AI (13 Werkzeuge), Kafka-Simulations-Fix, sim-trace |
| [v1.0.0](https://github.com/RomanKlasztorny/raptor/releases/tag/v1.0.0) | Erste öffentliche Version |

Vollständiges Änderungsprotokoll → [CHANGELOG.md](CHANGELOG.md)
