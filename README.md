# RAPTOR — Architecture Designer

Browser-based tool for designing microservice architectures, simulating traffic, and generating documentation. No build step, no npm.

🇬🇧 English · [🇷🇺 Русский](README.ru.md) · [🇺🇦 Українська](README.ua.md) · [🇵🇱 Polski](README.pl.md) · [🇪🇸 Español](README.es.md) · [🇩🇪 Deutsch](README.de.md)

![RAPTOR demo](demo.gif)

[![Live Demo](https://img.shields.io/badge/▶_Live_Demo-romanklasztorny.github.io%2Fraptor-1e4a90?style=flat-square)](https://romanklasztorny.github.io/raptor/)
[![Version](https://img.shields.io/badge/version-v1.1.0-2a6010?style=flat-square)](https://github.com/RomanKlasztorny/raptor/releases/tag/v1.1.0)
[![No build](https://img.shields.io/badge/no_build-pure_HTML%2FJS-7a6e5a?style=flat-square)](#)

---

## Quick Start

### Without AI (diagram + simulation only)

```
npx serve . -p 5500
```
Or open the **[Live Demo →](https://romanklasztorny.github.io/raptor/)** directly in your browser (no AI, no install).

### With AI (RAPTOR AI via GitHub Copilot)

**Step 1.** Make sure you have [GitHub Copilot](https://github.com/features/copilot) — free plan works.

**Step 2.** Install [Node.js](https://nodejs.org) if you haven't already.

**Step 3.** Install and run [anti-api](https://github.com/ink1ing/anti-api) — it handles GitHub OAuth for you:
```
npm install -g anti-api
anti-api
```
A browser window opens → sign in to GitHub → anti-api starts on `localhost:8964`.

**Step 4.** Run RAPTOR:
```
npx serve . -p 5500
```
Open `http://localhost:5500` → click `🤖 AI` — ready to go.

---

## Features

### Diagram
- Blocks: clients, Gateway, services, BFF, Auth, PostgreSQL, Redis, MongoDB, Kafka, RabbitMQ, NATS, Queue, Elasticsearch, S3, CDN, LB, External
- Drag & drop, collision detection, bidirectional arrows
- Auto-layout by layers — `Auto` button
- **C1 / C2 / C3 / Seq** levels in toolbar

### Scenarios ("Lines")
- Routes of requests through the system
- Each scenario: path of blocks, volume (rps), color, steps with `verb + uri + resp`
- `Autofill` builds steps from the diagram based on Gateway `auth_mode`

### Simulation
- Balls travel along scenario paths, color = scenario color
- Kafka/RabbitMQ/NATS/Queue receive traffic when a ball passes through a producer service
- Consumption: periodic tick every ~500 ms independent of ball physics
- Click a ball → hop trace details with latencies
- **Chaos mode**: node failures, degradation, cache flush, overload

### Broker Inspector
- Click Kafka/RabbitMQ/NATS/Queue during simulation → live panel
- SVG topology: producers → partitions → consumers
- Live counters: published / consumed / lag / DLQ, 500ms update
- Consumer groups with per-partition offsets, Replay button
- Business analyst justification: partitions, RF, delivery guarantees
- Broker settings without stopping simulation

### UML Sequence
- Generated from scenario: business meaning above arrow, `verb uri` below `//`
- PlantUML standard: `autonumber`, `++/--` activations, `group alt/else`, `...pause...`
- Kafka → dashed arrow `-)` without synchronous response
- **"📋 PlantUML"** button — copies for Confluence
- `ref over` blocks with horizontal drag (changes participants) and vertical (order)

### Database
- PostgreSQL schema editor per service
- Visual ERD in crow's foot notation
- SQL-DDL import
- 23 ready-made templates (users, sessions, bookings, products, etc.)
- FK with `REFERENCES + ON DELETE CASCADE`, UUID, `created_at`

### Auth Service
- Types: `jwt_only` / `oauth2_jwt` / `session_based` / `api_key` / `oidc_sso`
- Type changes the DB schema and Auth load in simulation
- Gateway reads `auth_mode` → automatically builds hop to Auth or skips

### Templates
**Services (9):** search, media, chat\_ws, cqrs, b2b\_api, sso, scheduler, reports, saga\_step  
**Groups (10):** shop, fullmsa, eventdriven, mentorship, cqrs, b2b\_api, sso, multibff, fintech, saga

### Word Export
- MS-1 structure: description, C4 diagram, API per service, DB tables
- Offline via built-in `docx.min.js`

### RAPTOR AI

`🤖 AI` button → chat panel on the right. Builds diagrams, writes UML, creates DB schemas — in natural language.

**13 tools:** add/remove block, add connection, create scenario, auto-layout, edit UML Sequence, change DB schema, clear canvas.

> AI works via **[anti-api](https://github.com/ink1ing/anti-api)** — an open-source proxy that handles GitHub Copilot OAuth for you. Thanks to [ink1ing](https://github.com/ink1ing) for the tool: without it you'd need to manually obtain a `gho_` token via OAuth flow. Each user authenticates with their own account, no shared tokens.

---

## State

Everything in the global `S` object (blocks, connections, scenarios, meta).  
Save → JSON file. Load → drag JSON onto the canvas.

---

## Releases

| Version | What's new |
|---------|-----------|
| **[v1.1.0](https://github.com/RomanKlasztorny/raptor/releases/tag/v1.1.0)** | RAPTOR AI (13 tools), Kafka simulation fix, sim-trace |
| [v1.0.0](https://github.com/RomanKlasztorny/raptor/releases/tag/v1.0.0) | First public release — diagram, simulation, UML, ERD, Word export |

Full changelog → [CHANGELOG.md](CHANGELOG.md)
