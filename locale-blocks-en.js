// RAPTOR — English block descriptions (role / place / never / tip)
// Parallel to EL in catalog.js — used when CURR_LANG === 'en'

var EL_EN = {
  actor: {
    role: 'A person or external system that triggers actions in the system.',
    place: 'Outside the system boundary — represents who uses or calls the system.',
    never: 'Never model internal services as actors.',
    tip:   'Each actor gets their own scenario. Double-click the actor to edit it.'
  },
  web_client: {
    role: 'User\'s browser — the entry point into the system.',
    place: 'Always FIRST before API Gateway. Actor → Web Client → Gateway → Services.',
    never: 'Never connect directly to a service or DB — always go through Gateway.',
    tip:   'This is what the user opens in their browser. It only renders UI and sends requests.'
  },
  mob_client: {
    role: 'iOS/Android mobile application.',
    place: 'Same as Web Client — before Gateway. Often has its own BFF.',
    never: 'Never connect directly to a DB or internal services.',
    tip:   'Often needs a separate BFF (Backend for Frontend) optimized for mobile.'
  },
  api_gw: {
    role: 'Single entry door to the system. Handles auth (JWT/OAuth2/Session/API Key), rate limiting, and routing.',
    place: 'RIGHT AFTER the client, BEFORE services. Client → Gateway → Service.',
    never: 'Do NOT connect Gateway directly to a DB — that is the service\'s job.',
    tip:   'JWT mode: Gateway verifies the token signature locally — Auth Service is NOT called on every request (stateless). Session/OAuth2 Introspection mode: Gateway calls Auth Service on every request. Set the mode in ⚙ Settings.'
  },
  websocket_gw: {
    role: 'WebSocket Gateway — bidirectional real-time channel.',
    place: 'Between real-time clients and backend services that push live data.',
    never: 'Do not use for REST requests — only for real-time push.',
    tip:   'Keeps a persistent connection open. The server pushes data to the client without waiting for a request.'
  },
  lb: {
    role: 'Distributes load across replicas (copies) of a single service.',
    place: 'Between Gateway and a group of replicated services.',
    never: 'Do NOT place after Kafka/RabbitMQ — brokers have their own balancing.',
    tip:   'Splits requests evenly. 3 replicas behind LB = triple the capacity.'
  },
  cdn: {
    role: 'Static asset cache (images, JS, video) close to the user.',
    place: 'In front of the system for static files. Parallel to Gateway.',
    never: 'Not for dynamic data and not for write operations.',
    tip:   'Highest limit (10M rps). Offloads servers. Not suitable for authenticated content.'
  },
  service: {
    role: 'Microservice with business logic — the core of the system.',
    place: 'After Gateway. Each service owns its own DB — no shared databases.',
    never: 'Synchronous call to another service — only with Circuit Breaker!',
    tip:   'Replicas (in settings) multiply capacity. 1 service = 10K rps. A service can be both a producer and a consumer simultaneously.'
  },
  bff: {
    role: 'Backend for Frontend — a backend tailored for a specific client.',
    place: 'Between Gateway and mobile/web client when they need different data shapes.',
    never: 'Do not make one BFF for all clients — the whole point is specialization.',
    tip:   'Aggregates data from multiple services into a convenient format for one client type.'
  },
  auth: {
    role: 'Authentication service — handles /login, /register, /refresh. The type (JWT/OAuth2/Session) affects the DB schema and whether Gateway calls this service on every request.',
    place: 'Called by Gateway, not by business services. Place it parallel to other services.',
    never: 'Do not connect directly to business services — only Gateway knows about Auth. In JWT mode, do not expect Auth to be called on every request — it\'s stateless.',
    tip:   'JWT = stateless (Auth is only called on /login and /refresh, then silent). Session = stateful (Auth is called by Gateway on EVERY request — a potential bottleneck). The type can be changed in the sidebar — the DB schema rebuilds automatically.'
  },
  external: {
    role: 'External third-party service: payment gateway, SMTP, SMS provider, external API.',
    place: 'At the edge of the diagram, after services that call it.',
    never: 'Never call external services directly from Gateway — always through a service.',
    tip:   'Always add retry + timeout patterns on the connection to an external service — it can fail or be slow.'
  },
  postgresql: {
    role: 'Relational DB with ACID — for transactions, finance, orders.',
    place: 'After its owning service. One service = one DB, no sharing.',
    never: 'Never connect directly to a client or Gateway.',
    tip:   'Low limit (10K rps). Options: PgBouncer (×5), read replicas, connection pooling.'
  },
  mysql: {
    role: 'Relational DB, popular in web projects.',
    place: 'After its owning service.',
    never: 'Do not connect directly to a client.',
    tip:   'For new projects PostgreSQL is generally more powerful — prefer it over MySQL.'
  },
  mongodb: {
    role: 'Document NoSQL — for flexible data without a rigid schema.',
    place: 'After its owning service, when data has variable structure.',
    never: 'Not for financial transactions (no proper ACID).',
    tip:   'Great for catalogs, user profiles, content with variable fields.'
  },
  redis: {
    role: 'In-memory cache — data in RAM, extremely fast (0.1ms).',
    place: 'After a service as a caching layer in front of the main DB.',
    never: 'Not as the sole storage (RAM is lost on restart).',
    tip:   'Cache-Aside pattern on service + Redis = only ~20% of requests reach the DB.'
  },
  cassandra: {
    role: 'Wide-column NoSQL — for massive write volumes (logs, events, time-series).',
    place: 'After a service that writes high-frequency events.',
    never: 'Not for transactions and complex JOINs.',
    tip:   'Limit 100K rps, scales horizontally by nodes. Ideal for tracking and event logs.'
  },
  clickhouse: {
    role: 'Columnar OLAP DB — for analytics on billions of rows.',
    place: 'After an analytics or reporting service.',
    never: 'Not for frequent UPDATE/DELETE and not for transactions.',
    tip:   'Analytics 100× faster than PostgreSQL. Reads columns, not rows.'
  },
  elasticsearch: {
    role: 'Search engine — full-text search, filters, aggregations.',
    place: 'After a service that indexes data for search.',
    never: 'Not the primary storage — the index can be rebuilt, the source data cannot.',
    tip:   '"Google-like" search across a catalog or documents. Shards multiply capacity.'
  },
  s3: {
    role: 'Object storage — files, images, video, backups.',
    place: 'After a service that uploads or serves large binary files.',
    never: 'Not for transactional data or content-based search.',
    tip:   'Unlimited capacity. Accessed via HTTP (pre-signed URLs). CDN in front of S3 = fast delivery.'
  },
  kafka: {
    role: 'Distributed message broker — durable, ordered, replay-able event log.',
    place: 'Between producer services and consumer services for async communication.',
    never: 'Not for request/response (RPC) patterns — use sync connections for that.',
    tip:   'Per-topic offsets, consumer groups, DLQ. Producer publishes → consumer processes independently. Decouples services completely.'
  },
  rabbitmq: {
    role: 'Message broker with flexible routing (direct/fanout/topic exchanges).',
    place: 'Between services that need async task queues or pub/sub.',
    never: 'Not for massive event streams — use Kafka for that.',
    tip:   'Good for task queues and work distribution. Messages are deleted after consumption (unlike Kafka).'
  },
  nats: {
    role: 'Lightweight messaging system — ultra-low latency, at-most-once delivery.',
    place: 'Between services for fast fire-and-forget messaging.',
    never: 'Not when you need guaranteed delivery — messages can be lost.',
    tip:   'Fastest broker option. JetStream mode adds persistence. Good for microservice internal comms.'
  },
  queue: {
    role: 'Generic task queue — background jobs, delayed processing.',
    place: 'Between a service that enqueues tasks and a worker that processes them.',
    never: 'Not for real-time responses — only for async background work.',
    tip:   'Workers pull tasks one at a time. Scale workers horizontally for more throughput.'
  }
};
