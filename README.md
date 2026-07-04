![RAPTOR v1.1.1 Release Notes](https://github.com/user-attachments/assets/6ac2d4f1-be78-4d66-9aa0-601ec8934be6)

# RAPTOR — Architecture Constructor

> Browser-based tool for designing microservice systems, simulating traffic, and generating documentation. No build step, no npm — open `index.html` and start.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-1e4a90?style=for-the-badge)](https://romanklasztorny.github.io/raptor/)
[![Release](https://img.shields.io/github/v/release/RomanKlasztorny/raptor?style=for-the-badge&color=2a6010)](https://github.com/RomanKlasztorny/raptor/releases/latest)

![RAPTOR demo](https://github.com/RomanKlasztorny/raptor/assets/232060178/28fc476b-8a9a-49ee-9e74-c893a6720924)

---

## Quick Start

```bash
npx serve .     # → http://localhost:5500
```

Open `index.html` directly in your browser — or use `npx serve` for full functionality.

---

## Features

### Diagram
- Blocks: Actor, Client, API Gateway, Load Balancer, CDN, WebSocket GW, BFF, Service, Auth, PostgreSQL, MySQL, MongoDB, Redis, Cassandra, ClickHouse, Elasticsearch, S3, Kafka, RabbitMQ, NATS, Queue, External
- Drag & drop with collision detection, bidirectional arrows
- Auto-layout by layers — **Auto** button
- **C1 / C2 / C3 / Seq** level toggle in toolbar

### Templates
- **18 Systems**: Bank, Messenger, Marketplace, YouTube, Search Engine, Taxi, Social Feed, Food Delivery, Carsharing, Spotify, Netflix, Tinder, Crypto Exchange, EdTech, Fitness, Booking, Cloud Storage, Todo
- **44 Elements** across 10 themes: payments, logging, storage, communications, search, analytics, media, security and more
- **61 DB templates**: PostgreSQL, MongoDB, Cassandra, Redis, ClickHouse
- 3-level flyout menu

### Scenarios ("Lines")
- Routes tab — request paths through the system
- Each scenario: block path, volume (rps), color, steps with `verb + uri + resp`
- Autofill builds steps from schema respecting Gateway `auth_mode`

### Simulation
- Balls travel scenario paths, color = scenario color
- Kafka / RabbitMQ / NATS / Queue receive traffic when a ball passes through a producer service
- Click a ball → hop-trace details with latencies
- **Chaos mode**: node failures, degradation, cache reset, overload

### Broker Inspector
- Click Kafka / RabbitMQ / NATS / Queue during simulation → live panel
- SVG topology: producers → partitions → consumers
- Live counters: published / processed / lag / DLQ, updated every 500ms
- Consumer groups with per-partition offsets, Replay button

### UML Sequence
- Generated from scenario: business meaning above arrow, `verb uri` under `//`
- PlantUML standard: `autonumber`, `++/--` activations, `group alt/else`, `...pause...`
- Kafka → dashed arrow `-)` without synchronous response
- **📋 PlantUML** button — copy for Confluence

### Database
- PostgreSQL schema editor per service
- Visual ERD in crow's foot notation
- SQL DDL import
- 61 ready-made templates
- FK with `REFERENCES + ON DELETE CASCADE`, UUID, `created_at`
- **Redis editor**: key patterns with type and TTL, "Pull from PG" for Hash fields

### Auth Service
- Types: `jwt_only` / `oauth2_jwt` / `session_based` / `api_key` / `oidc_sso`
- Type changes DB schema and Auth load in simulation

### Export
- **Word (.docx)** — MS-1 structure: description, C4 diagram, API per service, DB tables, ERD diagram, Redis schema
- **draw.io** — XML for diagrams.net
- **Swagger / OpenAPI YAML**
- Offline via built-in `docx.min.js`

### RAPTOR AI
- `🤖 AI` button → chat panel on the right
- Powered by **Groq** (llama-3.3-70b, free plan) — paste your API key from [console.groq.com](https://console.groq.com)
- Three modes: **gen** (generate full system from description), **chat** (plan + Q&A), **patch** (incremental updates)
- 18 architectural patterns in prompt: Saga, Outbox, CQRS, Cache-aside, Circuit Breaker and more
- Auto-fix: connection direction, cross-DB FK, deduplication
- "Add to canvas" and "Replace" buttons on JSON responses

### Localization
- Russian and English UI
- Language switch without page reload

---

## State

Everything lives in global `S` (blocks, connections, scenarios, metadata).  
Save → JSON file. Load → drag JSON onto canvas.
