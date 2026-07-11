![RAPTOR v1.1.1](https://raw.githubusercontent.com/RomanKlasztorny/raptor/main/docs/release-notes.jpg)

**рџЊђ Sprache:** [рџ‡¬рџ‡§ English](README.md) В· [рџ‡·рџ‡є Р СѓСЃСЃРєРёР№](README_RU.md) В· [рџ‡єрџ‡¦ РЈРєСЂР°С—РЅСЃСЊРєР°](README_UA.md) В· [рџ‡«рџ‡· FranГ§ais](README_FR.md) В· [рџ‡Єрџ‡ё EspaГ±ol](README_ES.md) В· [рџ‡µрџ‡± Polski](README_PL.md) В· [рџ‡Ёрџ‡і дё­ж–‡](README_ZH.md) В· [рџ‡Їрџ‡µ ж—Ґжњ¬иЄћ](README_JA.md)

# RAPTOR вЂ” Architektur-Konstruktor

> Browser-basiertes Tool zum Entwerfen von Microservice-Systemen, Simulieren von Traffic und Generieren von Dokumentation. Kein Build-Schritt, kein npm вЂ” `index.html` Г¶ffnen und loslegen.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-1e4a90?style=for-the-badge)](https://romanklasztorny.github.io/raptor/)
[![Release](https://img.shields.io/github/v/release/RomanKlasztorny/raptor?style=for-the-badge&color=2a6010)](https://github.com/RomanKlasztorny/raptor/releases/latest)

![RAPTOR demo](https://raw.githubusercontent.com/RomanKlasztorny/raptor/main/docs/demo.gif)

---

## Die Idee

Beschreibe dein System in einer Nachricht вЂ” RAPTOR AI generiert die vollstГ¤ndige Architektur: BlГ¶cke, Verbindungen, DB-Schemas und Szenarien. Die Aufgabe des Analysten ist es, zu **bearbeiten und verfeinern**, nicht Pfeile von Grund auf zu zeichnen.

---

## Schnellstart

```bash
npx serve .     # в†’ http://localhost:5500
```

---

## вљЎ Einrichtung вЂ” RAPTOR AI

> Kostenlos В· Keine Kreditkarte В· 30 Sekunden

```
в‘  console.groq.com в†’ Registrieren в†’ API Keys в†’ Create API Key
в‘Ў SchlГјssel kopieren  в†’  gsk_вЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂў
в‘ў RAPTOR  в†’  рџ¤– AI  в†’  SchlГјssel einfГјgen  в†’  Enter  вњ“
```

SchlГјssel wird in `localStorage` gespeichert вЂ” einmalige Eingabe pro Browser.

---

## рџ”Њ Mit jedem LLM verwenden (ChatGPT, Claude, GeminiвЂ¦)

Kein Groq? JSON mit **beliebigem Modell** generieren und laden:

```
в‘  Г–ffne  RAPTOR_FORMAT.md  в†ђ vollstГ¤ndiges JSON-Schema + Beispiele
в‘Ў   в†“
   In ChatGPT / Claude / Gemini einfГјgen:
   вЂћGeneriere RAPTOR JSON fГјr [dein System]. Schema: вЂ¦"
в‘ў   в†“
   JSON aus der Antwort kopieren
в‘Ј RAPTOR  в†’  Datei в†’ JSON importieren  в†’  Text einfГјgen  в†’  OK
   в†“
   вњ¦ Canvas fГјllt sich sofort mit BlГ¶cken, Verbindungen, DB-Schemas, Szenarien
```

> **Tipp:** `RAPTOR_FORMAT.md` als Datei anhГ¤ngen вЂ” die meisten Modelle lesen sie komplett.

---

## Funktionen

### RAPTOR AI
- Eine Nachricht в†’ vollstГ¤ndiges Microservice-System: BlГ¶cke, Verbindungen, DB-Schemas, Szenarien
- Drei Modi: **gen** (von Grund auf generieren), **chat** (Planung + Q&A), **patch** (inkrementelle Updates)
- 18 Architekturmuster im Prompt: Saga, Outbox, CQRS, Cache-aside, Circuit Breaker u.a.
- Auto-Fix: Verbindungsrichtung, cross-DB FK, Deduplizierung
- Betrieben von **Groq** (llama-3.3-70b, kostenloser Plan) вЂ” API-Key von [console.groq.com](https://console.groq.com)

### Diagramm (C4)
- BlГ¶cke: Actor, Client, API Gateway, Load Balancer, CDN, WebSocket GW, BFF, Service, Auth, PostgreSQL, MySQL, MongoDB, Redis, Cassandra, ClickHouse, Elasticsearch, S3, Kafka, RabbitMQ, NATS, Queue, External
- Drag & Drop mit Kollisionserkennung, bidirektionale Pfeile
- Automatisches Layer-Layout, C4-Ebenen in der Toolbar

### Vorlagen
- **18 Systeme**: Bank, Messenger, Marktplatz, YouTube, Suchmaschine, Taxi, Social Feed, Essenslieferung, Carsharing, Spotify, Netflix, Tinder, KryptobГ¶rse, EdTech, Fitness, Buchung, Cloud-Speicher, Todo
- **44 Elemente** in 10 Themen В· **61 DB-Vorlagen**
- 3-stufiges Flyout-MenГј

### Szenarien
- Anfragepfade durch das System mit `verb + uri + resp` pro Schritt
- Autofill berГјcksichtigt Gateway `auth_mode`

### Simulation
- Animierte Kugeln auf Szenariopfaden
- Kafka / RabbitMQ / NATS / Queue erhalten Live-Traffic
- Klick auf Kugel в†’ Hop-Trace mit Latenzen В· **Chaos-Modus**

### UML-Sequenz
- Aus Szenario nach PlantUML-Standard generiert
- Kafka в†’ `-)` В· synchrone RГјckgaben В· `group alt/else`
- **рџ“‹ PlantUML** fГјr Confluence
- ~~Code-to-diagram~~ в†’ **Click-to-diagram**: BlГ¶cke auf dem Canvas anklicken вЂ” RAPTOR findet den Pfad durch die Verbindungen automatisch und hebt verfГјgbare nГ¤chste Knoten hervor. Nach jedem Klick erscheint ein Popup zum Beschreiben des Schritts (Methode, URI, Antwort). Enter вЂ” Sequenzdiagramm fertig
- In aktiver Entwicklung; einfache CRUD-AblГ¤ufe funktionieren bereits in zwei Klicks вЂ” Prozesse auf hoher und niedriger Ebene direkt auf dem Canvas bearbeiten

### Datenbank
- PostgreSQL-Schema-Editor mit visuellem ERD (Crow's Foot)
- Redis-Editor: SchlГјsselmuster mit Typ und TTL
- SQL DDL-Import, 61 fertige Vorlagen

### Export
- **Word (.docx)** вЂ” universelles Format, das jeder Stakeholder hat. Vor dem Export wГ¤hlst du was enthalten sein soll: C4-Diagramm, API-Tabellen, DB-Schema, ERD вЂ” nimm was du brauchst, lass den Rest weg
- **draw.io** XML В· **Swagger / OpenAPI YAML** В· VollstГ¤ndig offline

---

## Zustand

Alles im globalen Objekt `S`. Speichern в†’ JSON-Datei. Laden в†’ Datei в†’ JSON importieren в†’ Text einfГјgen в†’ OK.
