![RAPTOR v1.1.1](https://github.com/user-attachments/assets/6ac2d4f1-be78-4d66-9aa0-601ec8934be6)

**🌐 Language:** [🇷🇺 Русский](README_RU.md) · [🇺🇦 Українська](README_UA.md) · [🇩🇪 Deutsch](README_DE.md) · [🇫🇷 Français](README_FR.md) · [🇪🇸 Español](README_ES.md) · [🇵🇱 Polski](README_PL.md) · [🇨🇳 中文](README_ZH.md) · [🇯🇵 日本語](README_JA.md)

# RAPTOR — Architecture Constructor

> Browser-based tool for designing microservice systems, simulating traffic, and generating documentation. No build step, no npm — open `index.html` and start.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-1e4a90?style=for-the-badge)](https://romanklasztorny.github.io/raptor/)
[![Release](https://img.shields.io/github/v/release/RomanKlasztorny/raptor?style=for-the-badge&color=2a6010)](https://github.com/RomanKlasztorny/raptor/releases/latest)

![RAPTOR demo](https://github.com/RomanKlasztorny/raptor/assets/232060178/28fc476b-8a9a-49ee-9e74-c893a6720924)

---

## The idea

Describe your system in one message — RAPTOR AI generates the full architecture: blocks, connections, DB schemas, and scenarios. The analyst's job is to **edit and refine**, not draw arrows from scratch.

---

## Quick Start

```bash
npx serve .     # → http://localhost:5500
```

Open `index.html` directly in your browser — or use `npx serve` for full functionality.

---

## ⚡ Setup — RAPTOR AI

> Free · No credit card · 30 seconds

```
① console.groq.com → Sign up → API Keys → Create API Key
② Copy the key  →  gsk_••••••••••••••••••••••••
③ RAPTOR  →  🤖 AI  →  paste key  →  Enter  ✓
```

Key is saved in `localStorage` — enter once per browser. Done.

---

## 🔌 Use with any LLM (ChatGPT, Claude, Gemini…)

Don't use Groq? Generate the JSON with **any model** and drop it in:

```
① Open  RAPTOR_FORMAT.md  ← full JSON schema + examples
②   ↓
   Paste into ChatGPT / Claude / Gemini:
   "Generate RAPTOR JSON for [your system]. Schema: …"
③   ↓
   Copy JSON from response
④ RAPTOR  →  File → Import JSON  →  paste  →  OK
   ↓
   ✦ Canvas fills instantly with blocks, connections, DB schemas, scenarios
```

> **Tip:** attach `RAPTOR_FORMAT.md` as a file — most models read it in one shot.

---

## Features

### RAPTOR AI
- One message → full microservice system: blocks, connections, DB schemas, scenarios
- Three modes: **gen** (generate from scratch), **chat** (plan + Q&A), **patch** (add/edit without full regeneration)
- 18 architectural patterns in prompt: Saga, Outbox, CQRS, Cache-aside, Circuit Breaker and more
- Auto-fix: connection direction, cross-DB FK, deduplication
- Powered by **Groq** (llama-3.3-70b, free plan) — get your key at [console.groq.com](https://console.groq.com)

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
- Click a ball → hop-trace with latencies
- **Chaos mode**: node failures, degradation, cache reset, overload

### Broker Inspector
- Live panel: SVG topology, published / processed / lag / DLQ counters (500ms)
- Consumer groups with per-partition offsets, Replay button

### UML Sequence
- Auto-generated from scenario in PlantUML standard
- Kafka → dashed arrow `-)`, sync returns, `group alt/else`
- **📋 PlantUML** button — copy for Confluence

### Database
- PostgreSQL schema editor with visual ERD (crow's foot notation)
- Redis editor: key patterns with type, TTL, "Pull from PG" for Hash fields
- SQL DDL import, 61 ready-made templates

### Auth Service
- Types: `jwt_only` / `oauth2_jwt` / `session_based` / `api_key` / `oidc_sso`
- Type affects DB schema and Auth load in simulation

### Export
- **Word (.docx)** — MS-1 structure: description, C4 diagram, API per service, DB tables, ERD, Redis schema
- **draw.io** XML, **Swagger / OpenAPI YAML**
- Fully offline via built-in `docx.min.js`

### Localization
- Russian and English UI, switch without page reload

---

## State

Everything lives in global `S` (blocks, connections, scenarios, metadata).
Save → JSON file. Load → File → Import JSON → paste text → OK.
