![RAPTOR v1.1.1](https://raw.githubusercontent.com/RomanKlasztorny/raptor/main/docs/release-notes.jpg)

**рџЊђ Language:** [рџ‡·рџ‡є Р СѓСЃСЃРєРёР№](README_RU.md) В· [рџ‡єрџ‡¦ РЈРєСЂР°С—РЅСЃСЊРєР°](README_UA.md) В· [рџ‡©рџ‡Є Deutsch](README_DE.md) В· [рџ‡«рџ‡· FranГ§ais](README_FR.md) В· [рџ‡Єрџ‡ё EspaГ±ol](README_ES.md) В· [рџ‡µрџ‡± Polski](README_PL.md) В· [рџ‡Ёрџ‡і дё­ж–‡](README_ZH.md) В· [рџ‡Їрџ‡µ ж—Ґжњ¬иЄћ](README_JA.md)

# RAPTOR вЂ” Architecture Constructor

> Browser-based tool for designing microservice systems, simulating traffic, and generating documentation. No build step, no npm вЂ” open `index.html` and start.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-1e4a90?style=for-the-badge)](https://romanklasztorny.github.io/raptor/)
[![Release](https://img.shields.io/github/v/release/RomanKlasztorny/raptor?style=for-the-badge&color=2a6010)](https://github.com/RomanKlasztorny/raptor/releases/latest)

![RAPTOR demo](https://raw.githubusercontent.com/RomanKlasztorny/raptor/main/docs/demo.gif)

---

## Why I built this

Working as a systems analyst, I came to a clear conclusion: a significant portion of the time goes not into designing the system, but into preparing and maintaining its documentation.

A single task required juggling multiple tools at once вЂ” designing the architecture in one place, describing databases in another, building Sequence diagrams in a third, and then assembling everything into a final document. More often than not, preparing the documentation took longer than designing the system itself.

The rise of large language models sped up the creation of individual artifacts, but didn't solve the problem of combining them or keeping them in sync manually.

So I started building RAPTOR.

RAPTOR is a tool that lets you design a system in one place and derive consistent artifacts from that single model: scenarios, diagrams, and documentation. Instead of manually transferring information between tools, the analyst works with one unified system model.

I built RAPTOR as the tool I wished I had on my first day as a systems analyst.

---

## The idea

Describe your system in one message вЂ” RAPTOR AI generates the full architecture: blocks, connections, DB schemas, and scenarios. The analyst's job is to **edit and refine**, not draw arrows from scratch.

---

## Quick Start

```bash
npx serve .     # в†’ http://localhost:5500
```

Open `index.html` directly in your browser вЂ” or use `npx serve` for full functionality.

---

## вљЎ Setup вЂ” RAPTOR AI

> Free В· No credit card В· 30 seconds

```
в‘  console.groq.com в†’ Sign up в†’ API Keys в†’ Create API Key
в‘Ў Copy the key  в†’  gsk_вЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂў
в‘ў RAPTOR  в†’  рџ¤– AI  в†’  paste key  в†’  Enter  вњ“
```

Key is saved in `localStorage` вЂ” enter once per browser. Done.

---

## рџ”Њ Use with any LLM (ChatGPT, Claude, GeminiвЂ¦)

Don't use Groq? Generate the JSON with **any model** and drop it in:

```
в‘  Open  RAPTOR_FORMAT.md  в†ђ full JSON schema + examples
в‘Ў   в†“
   Paste into ChatGPT / Claude / Gemini:
   "Generate RAPTOR JSON for [your system]. Schema: вЂ¦"
в‘ў   в†“
   Copy JSON from response
в‘Ј RAPTOR  в†’  File в†’ Import JSON  в†’  paste  в†’  OK
   в†“
   вњ¦ Canvas fills instantly with blocks, connections, DB schemas, scenarios
```

> **Tip:** attach `RAPTOR_FORMAT.md` as a file вЂ” most models read it in one shot.

---

## Features

### RAPTOR AI
- One message в†’ full microservice system: blocks, connections, DB schemas, scenarios
- Three modes: **gen** (generate from scratch), **chat** (plan + Q&A), **patch** (add/edit without full regeneration)
- 18 architectural patterns in prompt: Saga, Outbox, CQRS, Cache-aside, Circuit Breaker and more
- Auto-fix: connection direction, cross-DB FK, deduplication
- Powered by **Groq** (llama-3.3-70b, free plan) вЂ” get your key at [console.groq.com](https://console.groq.com)

### Diagram (C4)
- Blocks: Actor, Client, API Gateway, Load Balancer, CDN, WebSocket GW, BFF, Service, Auth, PostgreSQL, MySQL, MongoDB, Redis, Cassandra, ClickHouse, Elasticsearch, S3, Kafka, RabbitMQ, NATS, Queue, External
- Drag & drop with collision detection, bidirectional arrows
- Auto-layout by layers
- C4 notation levels in toolbar

### Templates
- **18 Systems**: Bank, Messenger, Marketplace, YouTube, Search Engine, Taxi, Social Feed, Food Delivery, Carsharing, Spotify, Netflix, Tinder, Crypto Exchange, EdTech, Fitness, Booking, Cloud Storage, Todo
- **44 Elements** across 10 themes: payments, logging, storage, communications, search, analytics, media, security and more
- **61 DB templates**: PostgreSQL, MongoDB, Cassandra, Redis, ClickHouse
- 3-level flyout menu

### Scenarios
- Request paths through the system with `verb + uri + resp` per step
- Autofill builds steps from schema respecting Gateway `auth_mode`
- Each scenario has volume (rps), color, and actor

### Simulation
- Animated balls travel scenario paths
- Kafka / RabbitMQ / NATS / Queue receive live traffic
- Click a ball в†’ hop-trace with latencies
- **Chaos mode**: node failures, degradation, cache reset, overload

### Broker Inspector
- Live panel: SVG topology, published / processed / lag / DLQ counters (500ms)
- Consumer groups with per-partition offsets, Replay button

### UML Sequence
- Auto-generated from scenario in PlantUML standard
- Kafka в†’ `-)` В· sync returns В· `group alt/else`
- **рџ“‹ PlantUML** button вЂ” copy for Confluence
- ~~Code-to-diagram~~ в†’ **Click-to-diagram**: click blocks on the canvas вЂ” RAPTOR finds the path through connections automatically, highlighting available next nodes. After each click a popup appears to describe the step (method, URI, response). Press Enter вЂ” sequence diagram is ready
- Actively in development; simple CRUD flows already work in two clicks вЂ” edit your process at high and low level directly on the canvas

### Database
- PostgreSQL schema editor with visual ERD (crow's foot notation)
- Redis editor: key patterns with type, TTL, "Pull from PG" for Hash fields
- SQL DDL import, 61 ready-made templates

### Auth Service
- Types: `jwt_only` / `oauth2_jwt` / `session_based` / `api_key` / `oidc_sso`
- Type affects DB schema and Auth load in simulation

### Export
- **Word (.docx)** вЂ” universal format every stakeholder already has. Before export you choose what to include: C4 diagram, API tables, DB schema, ERD вЂ” take what you need, skip the rest
- **draw.io** XML, **Swagger / OpenAPI YAML**
- Fully offline via built-in `docx.min.js`

### Localization
- Russian and English UI, switch without page reload

---

## State

Everything lives in global `S` (blocks, connections, scenarios, metadata).
Save в†’ JSON file. Load в†’ File в†’ Import JSON в†’ paste text в†’ OK.
