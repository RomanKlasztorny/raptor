// RAPTOR AI — Groq llama-3.3-70b-versatile (бесплатный план)
// Режимы: чат (план) → gen (полный JSON) / patch (доработка без перегенерации)
// Формат RAPTOR: строковые id "b1", блоки/связи/сценарии, dbSchema на блоках БД.

var AI = {};

(function () {
  'use strict';

  var MODEL   = 'llama-3.3-70b-versatile';
  var API_URL = 'https://api.groq.com/openai/v1/chat/completions';

  var apiKey      = null;
  var chatHistory = [];
  var isOpen      = false;
  var _lastJSON   = null;
  var _patchNext  = false; // следующий ответ — patch (скрыть «Заменить»)

  var msgs, input, sendBtn, statusEl, typingEl;

  var DB_TYPES = ['postgresql','mysql','mongodb','redis','cassandra','clickhouse','elasticsearch','s3'];

  // ════════════════ ДЕТЕКТ РЕЖИМА ════════════════
  function detectPatchDB(t){
    return /опиши.{0,15}бд|заполни.{0,15}бд|опиши.{0,15}(таблиц|поля|структур|схем)|заполни.{0,15}(таблиц|схем)|описать.{0,10}бд/i.test(t);
  }
  function detectPatchAdd(t){
    return /добавь.{0,20}(сервис|блок|kafka|кафку|auth|базу|бд|связь|связи|очеред|брокер|redis|кэш|кеш|s3|хранилищ|elastic|шлюз|gateway|клиент|актор|внешн|external)/i.test(t)
        || /подключи|присоедини|свяжи|соедини/i.test(t);
  }
  function detectPatch(t){ return detectPatchDB(t) || detectPatchAdd(t); }

  function detectGen(t){
    if (detectPatch(t)) return false;
    // Явные команды генерации
    if (/сгенерируй|генерируй|generate|создай систему|разработай|спроектируй/i.test(t)) return true;
    if (/сделай.{0,20}(систем|всё|все|сразу|json|схем)|всю систем|пришли.{0,10}(json|схем)|сделай всё/i.test(t)) return true;
    // Подтверждение
    if (/^(да|давай|ок|го|yes|ok|погнали|вперёд|вперед|жги|поехали|конечно|делай)(\s|$)/i.test(t)) return true;
    // Описание домена — даже короткое ("создадим зоомагазин", "хочу платформу менторства")
    var hasDomain = /магазин|платформ|маркетплейс|marketplace|интернет.магазин|соцсет|банк|финтех|доставк|курьер|такси|медицин|клиник|образован|учебн|школ|crm|erp|booking|бронирован|аренд|стриминг|чат|мессенджер|форум|блог|портал|склад|логистик/i.test(t);
    if (hasDomain) return true;
    // Структурированное описание системы
    var hasRoles = /роли|покупатель|пользовател|администратор|клиент|менеджер/i.test(t);
    var hasSvc   = /сервис|микросервис|service|api\s*[—:\-]/i.test(t);
    var hasDb    = /бд|базы|таблиц|postgresql|mysql|монго|redis/i.test(t);
    if (t.length > 300 && hasRoles && hasSvc) return true;
    if (t.length > 300 && hasSvc && hasDb)    return true;
    return false;
  }

  // ════════════════ ОБЩИЕ КУСКИ ПРОМПТА ════════════════
  var BLOCK_TYPES =
    '═══ BLOCK TYPES ═══\n' +
    'actor | web_client | mob_client | api_gw | websocket_gw | lb | cdn | bff | service | auth | external\n' +
    'postgresql | mysql | mongodb | redis | cassandra | clickhouse | elasticsearch | s3\n' +
    'kafka | rabbitmq | nats | queue\n';

  // Правила сценариев — единый источник правды, чтобы не расходились
  var SCENARIO_RULES =
    '═══ SCENARIO STEPS — STRICT 1:1 WITH PATH ═══\n' +
    'CRITICAL: steps.length MUST EQUAL path.length. step[i] = action AT path[i].\n' +
    'NEVER pad with duplicate steps. If counts differ — fix path, not steps.\n' +
    'Verbs by node type (verb | uri | resp):\n' +
    '  actor: verb="" uri="" resp="" name="Открывает/Нажимает...".\n' +
    '  web_client/mob_client: POST/GET/PUT/DELETE | /api/v1/resource | 201{id}/200{data}/204.\n' +
    '  api_gw: same verb | /resource (no /api/v1) | same code. name="Маршрутизирует".\n' +
    '  →postgresql read: SELECT | table_name | rows.\n' +
    '  →postgresql write: INSERT/UPDATE/DELETE | table_name | uuid X.\n' +
    '  →redis cache-check: GET | key:{id} | hit:{data}|miss:null. Path ENDS at redis on hit.\n' +
    '  →redis cache-store: SET | key:{id} | OK. name="Кешировать X (TTL 5min)".\n' +
    '  →redis invalidate: DEL | key:{id} | OK. Call after write to postgresql.\n' +
    '  →kafka publish: PUBLISH | topic.event | "". Path ENDS at kafka. topics: orders.created, payment.requested.\n' +
    '  →kafka consume (SEPARATE scenario, no actor): CONSUME | topic.event | "". path=[kafka,consumer_svc,its_db].\n' +
    '  →rabbitmq: PUBLISH | exchange/key | "". →queue: ENQUEUE | queue_name | job_id.\n' +
    '  →elasticsearch: GET | /index/_search | [{_source}]. Index sync: POST | /index/_doc | {_id}.\n' +
    '  →external: POST | /endpoint | 200{result}. \n' +
    'Structure: 3-5 scenarios: happy path, list/search, async publish+consumer pair, cache HIT, cache MISS.\n' +
    'Async = 2 scenarios: publisher (ends at kafka) + consumer (starts at kafka).\n' +
    'Cache MISS path: [...,svc,redis,postgresql,redis] — redis visited twice (check then store).\n' +
    'Colors: #7aa2f7 #9ece6a #e0af68 #f7768e #bb9af7 #2ac3de #ff9e64.\n' +
    'NEVER add "uml" field to scenarios.\n';

  var DB_RULES =
    '═══ DB SCHEMA — MANDATORY ═══\n' +
    '- EVERY db block has dbSchema with 2+ tables (main + detail/log/history).\n' +
    '- EVERY table has 8+ fields. NO generic name/description/status — use DOMAIN-SPECIFIC fields.\n' +
    '- Required in each table: id UUID PK (default gen_random_uuid()), created_at + updated_at TIMESTAMPTZ NN (default NOW()).\n' +
    '- FK within SAME db block → use fk object: {"name":"order_id","type":"UUID","constraints":"NN, FK","fk":{"table":"orders","field":"id"}}.\n' +
    '- FORBIDDEN: FK.table pointing to a table in a DIFFERENT db block. Cross-service reference = UUID NN, NO fk object, add comment in desc.\n' +
    '- Indexes on every FK column and on status/type/date filter columns.\n' +
    '- Domain examples: goals→deadline/target_value/category; habits→frequency/current_streak/reminder_time;\n' +
    '  tracking→tracked_date/completion_pct/mood; payments→amount/currency/gateway_tx_id/idempotency_key; users→email/password_hash/salt/last_login_at.\n' +
    '- Each service schema reflects its OWN domain. NEVER copy the same fields across services.\n' +
    '- Soft delete: use deleted_at TIMESTAMPTZ (NULL = active). Optimistic lock: version INTEGER NN default 1.\n' +
    '- Idempotency: payments/orders must have idempotency_key VARCHAR(64) UNIQUE.\n';

  // ════════════════ БАЗА ЗНАНИЙ АРХИТЕКТУРЫ ════════════════
  var ARCH_KNOWLEDGE =
    '═══ ARCHITECTURE PATTERNS (apply where relevant) ═══\n' +

    // Транзакционность и надёжность
    'OUTBOX PATTERN: after INSERT into main table, also INSERT into outbox table (id,event_type,payload,sent_at). ' +
    'A separate publisher polls outbox and sends to Kafka. Guarantees at-least-once delivery. Use for orders/payments.\n' +

    'SAGA (choreography): each service listens to Kafka, does its work, emits next event. No central orchestrator. ' +
    'Topic chain: order.created → payment.requested → payment.completed → order.confirmed. Rollback via compensating events.\n' +

    'IDEMPOTENCY: all POST endpoints that create money/orders must accept idempotency_key header. ' +
    'Store in DB with UNIQUE constraint. On duplicate key → return original response, skip processing.\n' +

    // Производительность
    'CQRS: separate read model (for lists/search) from write model. ' +
    'Write → postgresql. Read → elasticsearch or redis or read-replica. Sync via Kafka event. Use for catalog, feeds, search.\n' +

    'CACHE-ASIDE: service checks redis first. On miss → query postgresql → store in redis with TTL. ' +
    'On write → DEL cache key (invalidate). Use for product catalog, user profile, session.\n' +

    'CURSOR PAGINATION: for large tables use WHERE id > :cursor ORDER BY id LIMIT N instead of OFFSET. ' +
    'Return next_cursor in response. OFFSET scans all rows — unusable at scale.\n' +

    // БД и индексы
    'PARTIAL INDEX: CREATE INDEX idx_orders_pending ON orders(user_id) WHERE status=\'pending\'. ' +
    'Dramatically faster than full index when filtering by status.\n' +

    'SOFT DELETE: deleted_at TIMESTAMPTZ NULL. Active rows have NULL. ' +
    'Partial index WHERE deleted_at IS NULL. Hard delete only for GDPR/compliance.\n' +

    'READ REPLICA: add a second postgresql block labeled "DB Read Replica", connect it with dashed conn from primary. ' +
    'Read-heavy endpoints (GET /products) go to replica. Writes go to primary.\n' +

    // Устойчивость
    'CIRCUIT BREAKER: after N failures, service stops calling dependency for T seconds (open state). ' +
    'Then tries one request (half-open). If ok → closed. Prevents cascade failure. Apply on external calls and inter-service sync calls.\n' +

    'BULKHEAD: each downstream dependency gets its own connection pool / thread pool. ' +
    'Payment slowdown cannot consume all threads and block catalog requests.\n' +

    'DLQ (Dead Letter Queue): Kafka consumer after 3 retries → sends message to topic.DLQ. ' +
    'Separate consumer processes DLQ for alerting/manual review. Prevents poison pill blocking entire topic.\n' +

    // API
    'API VERSIONING: /api/v1/resource. Breaking changes → /api/v2/. Keep v1 running for 6 months.\n' +

    'BFF (Backend for Frontend): separate bff block for mobile vs web when responses differ drastically. ' +
    'Mobile BFF returns compact JSON. Web BFF returns full data. Both call same downstream services.\n' +

    'RATE LIMITING TIERS: api_gw applies different limits per plan: free=10rps, pro=100rps, enterprise=1000rps. ' +
    'Store limits in redis with sliding window (key: rate:{userId}:{minute}).\n' +

    // Данные
    'EVENT SOURCING: store every state change as immutable event in events table (id, aggregate_id, event_type, payload, occurred_at). ' +
    'Current state = replay of all events. Use for audit-critical domains: banking, healthcare, legal.\n' +

    'MATERIALIZED VIEW: for complex reports (daily stats, user summaries) create postgresql MATERIALIZED VIEW. ' +
    'REFRESH MATERIALIZED VIEW CONCURRENTLY via cron. Avoids heavy JOIN on every request.\n' +

    'STRANGLER FIG: migrating monolith → new microservice handles one domain, legacy handles rest. ' +
    'API GW routes /orders to new service, everything else to legacy. Gradual migration.\n';


  // ════════════════ КОНТЕКСТ ТЕКУЩЕЙ СХЕМЫ ════════════════
  function getContext(){
    if (typeof S === 'undefined' || !S.blocks || !S.blocks.length) return null;
    var bName = function(b){ return b.customLabel||(EL[b.type]&&EL[b.type].lbl)||b.type; };
    var meta  = S.meta || {};

    var nb = {};
    S.conns.forEach(function(c){
      var fn = bName(gb(c.from)||{}), tn = bName(gb(c.to)||{});
      (nb[c.from] = nb[c.from] || {sends:[],receives:[]}).sends.push(tn);
      (nb[c.to]   = nb[c.to]   || {sends:[],receives:[]}).receives.push(fn);
    });

    return {
      project: {name: meta.systemName||'', description: meta.description||''},
      blocks: S.blocks.map(function(b){
        var o = {id:b.id, type:b.type, name:bName(b)}, n = nb[b.id]||{};
        if (n.sends    && n.sends.length)    o.sends_to      = n.sends;
        if (n.receives && n.receives.length) o.receives_from = n.receives;
        if (b.dbSchema && b.dbSchema.tables && b.dbSchema.tables.length)
          o.existing_tables = b.dbSchema.tables.map(function(t){ return t.name; });
        return o;
      }),
      scenarios: (S.scenarios||[]).map(function(s){
        var path = (s.path||[]).map(function(id){ var b=gb(id); return b?bName(b):id; });
        return {name: s.name, steps: (s.steps||[]).map(function(st,i){
          var r = {block: path[i]||'?'};
          if (st.verb) r.verb = st.verb;
          if (st.uri)  r.uri  = st.uri;
          if (st.name) r.action = st.name;
          return r;
        })};
      })
    };
  }

  function nextId(){
    var max = 0;
    (S.blocks||[]).forEach(function(b){ var m=/^b(\d+)$/.exec(b.id); if(m) max=Math.max(max,+m[1]); });
    return max + 1;
  }

  // ════════════════ ПРОМПТЫ ════════════════
  function buildChat(){
    var ctx = getContext();
    return 'Ты — архитектурный ассистент RAPTOR. Проектируешь микросервисные системы.\n' +
      (ctx ? 'ТЕКУЩАЯ СХЕМА: '+JSON.stringify(ctx)+'\n\n' : '') +
      'Если пользователь описывает систему → сразу дай ПОЛНЫЙ ПЛАН без уточняющих вопросов:\n\n' +
      '1. РОЛИ — выведи сам из описания. Формат: Роль — что может делать.\n' +
      '2. МИКРОСЕРВИСЫ + API. Формат: Сервис — POST /path (создать X), GET /path/:id, ...\n' +
      '3. БД каждого сервиса (законы МСА): своя БД у каждого, PK=UUID, FK=копия UUID без JOIN,\n' +
      '   created_at/updated_at в каждой таблице, 2+ таблицы на сервис.\n' +
      '4. Kafka-топики для async-связи между сервисами.\n' +
      '5. Предложи уместные паттерны: если платежи → Outbox + Idempotency Key; если читается чаще чем пишется → Cache-aside + Read Replica; если большой список → Cursor Pagination; если сложные транзакции → Saga; если нужен поиск → CQRS с Elasticsearch.\n' +
      '6. Закончи строкой: "Генерировать JSON?"\n\n' +
      ARCH_KNOWLEDGE + '\n' +
      'ЗАПРЕЩЕНО: уточняющие вопросы про роли/БД/методы — выводи сам.\n' +
      'ЗАПРЕЩЕНО: JSON в этом режиме. Язык: русский, кратко.';
  }

  function buildGen(){
    var ctx = getContext();
    return 'You are a JSON generator for the RAPTOR architecture tool.\n' +
      'OUTPUT ONLY one raw ```json code block. NO text before/after, NO markdown outside it.\n' +
      'ALL JSON keys in English. Labels/desc in Russian. Block ids are STRINGS "b1","b2",... conn ids "c1",... scenario ids "sc1",...\n\n' +
      (ctx ? 'Current canvas: '+JSON.stringify(ctx)+'\n\n' : '') +
      BLOCK_TYPES + '\n' +
      '═══ ARCHITECTURE RULES (MANDATORY) ═══\n' +
      '1. ALWAYS include 3 separate blocks: actor + web_client + api_gw.\n' +
      '2. EVERY service has its OWN separate DB block. NEVER share one DB id between services.\n' +
      '3. Use kafka for ALL cross-service async events. Consumers are separate service blocks (conn kafka→service).\n' +
      '4. External payment/SMTP/SMS = type "external".\n' +
      '5. Coords: actor x=-100, web_client x=100, api_gw x=320, services x=540, kafka x=760, db x=980, external x=1200. y: first=60, each next in same column +160.\n\n' +
      DB_RULES + '\n' +
      SCENARIO_RULES + '\n' +
      '═══ CONN DIRECTION — MANDATORY ═══\n' +
      'conns ALWAYS flow client-side → server-side: actor→web_client→api_gw→service→db.\n' +
      'NEVER generate a conn FROM db/postgresql/redis TO a service. ALWAYS service→db.\n' +
      'EACH db block belongs to EXACTLY ONE service. NEVER connect service A to db of service B.\n' +
      'To cross services: service A → api_gw or service A → service B (via conn). NEVER A → B_db.\n' +
      'FORBIDDEN: service→kafka (auto). Add kafka ONLY when user explicitly asks for async/events/kafka.\n\n' +
      '═══ SMART PATTERNS (apply where appropriate) ═══\n' +
      '- Payments/Orders → add idempotency_key VARCHAR(64) UNIQUE + outbox table in same DB.\n' +
      '- Cross-service async → kafka with DLQ (topic.DLQ consumer block).\n' +
      '- High-read data (catalog/profile) → add redis block (cache-aside), conn service→redis.\n' +
      '- Search → add elasticsearch block, conn service→elasticsearch, sync via kafka.\n' +
      '- Soft delete: deleted_at TIMESTAMPTZ. Optimistic lock: version INTEGER NN default 1.\n' +
      '- Large lists → use cursor pagination (WHERE id > :cursor), NOT OFFSET.\n\n' +
      '═══ MINIMAL FORMAT EXAMPLE (note steps.length === path.length) ═══\n' +
      '```json\n' +
      '{"blocks":[\n' +
      '  {"id":"b1","type":"actor","customLabel":"Покупатель","x":-100,"y":60,"patterns":[],"settings":{}},\n' +
      '  {"id":"b2","type":"web_client","customLabel":"Веб-приложение","x":100,"y":60,"patterns":[],"settings":{}},\n' +
      '  {"id":"b3","type":"api_gw","customLabel":"API Gateway","x":320,"y":60,"patterns":[],"settings":{}},\n' +
      '  {"id":"b4","type":"service","customLabel":"Заказы","x":540,"y":60,"patterns":[],"settings":{}},\n' +
      '  {"id":"b8","type":"postgresql","customLabel":"Orders DB","x":980,"y":60,"patterns":[],"settings":{},"dbSchema":{"tables":[\n' +
      '    {"name":"orders","fields":[\n' +
      '      {"name":"id","type":"UUID","constraints":"PK","desc":"ID заказа","example":"550e8400","default":"gen_random_uuid()"},\n' +
      '      {"name":"user_id","type":"UUID","constraints":"NN","desc":"ID пользователя","example":"661f9511"},\n' +
      '      {"name":"status","type":"VARCHAR(20)","constraints":"NN","desc":"Статус","example":"pending","default":"\'pending\'"},\n' +
      '      {"name":"total_amount","type":"DECIMAL(12,2)","constraints":"NN","desc":"Сумма","example":"1500.00"},\n' +
      '      {"name":"delivery_address","type":"TEXT","constraints":"NN","desc":"Адрес","example":"ул. Ленина 1"},\n' +
      '      {"name":"promo_code","type":"VARCHAR(50)","constraints":"","desc":"Промокод","example":"SALE10"},\n' +
      '      {"name":"created_at","type":"TIMESTAMPTZ","constraints":"NN","desc":"Создан","default":"NOW()"},\n' +
      '      {"name":"updated_at","type":"TIMESTAMPTZ","constraints":"NN","desc":"Обновлён","default":"NOW()"}\n' +
      '    ],"indexes":["CREATE INDEX idx_orders_user ON orders(user_id)","CREATE INDEX idx_orders_status ON orders(status)"]},\n' +
      '    {"name":"order_items","fields":[\n' +
      '      {"name":"id","type":"UUID","constraints":"PK","desc":"ID позиции","example":"772a1234","default":"gen_random_uuid()"},\n' +
      '      {"name":"order_id","type":"UUID","constraints":"NN, FK","desc":"ID заказа","example":"550e8400","fk":{"table":"orders","field":"id"}},\n' +
      '      {"name":"product_id","type":"UUID","constraints":"NN","desc":"ID товара","example":"883b5678"},\n' +
      '      {"name":"product_name","type":"VARCHAR(255)","constraints":"NN","desc":"Товар","example":"Корм"},\n' +
      '      {"name":"quantity","type":"INTEGER","constraints":"NN","desc":"Кол-во","example":"2"},\n' +
      '      {"name":"price","type":"DECIMAL(10,2)","constraints":"NN","desc":"Цена","example":"750.00"},\n' +
      '      {"name":"created_at","type":"TIMESTAMPTZ","constraints":"NN","desc":"Создан","default":"NOW()"},\n' +
      '      {"name":"updated_at","type":"TIMESTAMPTZ","constraints":"NN","desc":"Обновлён","default":"NOW()"}\n' +
      '    ],"indexes":["CREATE INDEX idx_items_order ON order_items(order_id)"]}\n' +
      '  ]}}\n' +
      '],\n' +
      '"conns":[\n' +
      '  {"id":"c1","from":"b1","to":"b2"},{"id":"c2","from":"b2","to":"b3"},{"id":"c3","from":"b3","to":"b4"},{"id":"c4","from":"b4","to":"b8"}\n' +
      '],\n' +
      '"scenarios":[\n' +
      '  {"id":"sc1","name":"Оформить заказ","color":"#7aa2f7","actorId":"b1","volume":100,"visible":true,\n' +
      '   "path":["b1","b2","b3","b4","b8"],\n' +
      '   "steps":[\n' +
      '    {"name":"Открывает корзину","verb":"","uri":"","resp":"","cache":null,"dbTarget":null},\n' +
      '    {"name":"Оформить заказ","verb":"POST","uri":"/api/v1/orders","resp":"201 {orderId}","cache":null,"dbTarget":null},\n' +
      '    {"name":"Маршрутизирует","verb":"POST","uri":"/orders","resp":"201","cache":null,"dbTarget":null},\n' +
      '    {"name":"Создать заказ","verb":"POST","uri":"/orders","resp":"201 {orderId}","cache":null,"dbTarget":null},\n' +
      '    {"name":"Сохранить заказ","verb":"INSERT","uri":"orders","resp":"uuid заказа","cache":null,"dbTarget":null}\n' +
      '  ]}\n' +
      '],\n' +
      '"meta":{"systemName":"Зоомагазин","description":"Микросервисная система","domain":"e-commerce","problem":"","solution":""}}\n' +
      '```\n\n' +


      'CHECKLIST before output:\n' +
      '[ ] every service has its own DB block\n' +
      '[ ] every DB has 2+ tables, 8+ fields each, FK objects present\n' +
      '[ ] FK.table only references tables WITHIN THE SAME db block — never cross-DB\n' +
      '[ ] conns direction: service→db, NEVER db→service\n' +
      '[ ] EVERY scenario: steps.length === path.length, no duplicate steps\n' +
      '[ ] no "uml" field in scenarios\n' +
      '[ ] all ids are strings, conns reference ids not names\n\n' +
      'Now generate the FULL schema for the user request. Scale to the number of services needed.';
  }

  function buildPatchAdd(){
    var ctx = getContext(); if (!ctx) return null;
    var n = nextId();
    return 'You are an incremental editor for the RAPTOR tool.\n' +
      'OUTPUT ONLY one raw ```json block. NO text around it. Keys in English, labels in Russian.\n\n' +
      'CURRENT SYSTEM: '+JSON.stringify(ctx)+'\n\n' +
      'TASK: ADD what the user asks. Return ONLY NEW blocks and NEW conns — do NOT repeat existing blocks.\n\n' +
      'RULES:\n' +
      '- New ids continue from "b'+n+'". NEVER reuse existing ids.\n' +
      '- conns wire new blocks using EXISTING ids from CURRENT SYSTEM.\n' +
      '- Adding a service → also add its OWN postgresql block + conn service→db with full dbSchema (2+ tables, 8+ fields, FK objects).\n' +
      '- Adding kafka → wire producers (service→kafka) and consumers (kafka→service).\n' +
      '- Free coords: services x=540, db x=980, kafka x=760, external x=1200; y = max existing y + 160.\n' +
      BLOCK_TYPES + '\n' +
      'FORMAT (new items only):\n' +
      '```json\n{"blocks":[{"id":"b'+n+'","type":"service","customLabel":"Имя","x":540,"y":380,"patterns":[],"settings":{}}],"conns":[{"id":"cn1","from":"b3","to":"b'+n+'"}]}\n```';
  }

  function buildPatchDB(){
    var ctx = getContext(); if (!ctx) return null;
    var dbs = ctx.blocks.filter(function(b){ return DB_TYPES.indexOf(b.type)>=0; });
    if (!dbs.length) return null;
    return 'You are a DB schema generator for the RAPTOR tool.\n' +
      'OUTPUT ONLY one raw ```json block. NO text around it. Keys in English, labels in Russian.\n\n' +
      'CURRENT SYSTEM: '+JSON.stringify(ctx)+'\n\n' +
      'TASK: generate dbSchema for ONLY these DB blocks: '+JSON.stringify(dbs.map(function(b){ return {id:b.id,name:b.name,connected_service:b.receives_from}; }))+'\n' +
      'Infer stored data from the connected service name and the scenario steps passing through it.\n\n' +
      'RULES:\n' +
      '- Return ONLY a blocks array with these DB blocks — no services, no conns, no scenarios.\n' +
      '- Each: {"id":"<same>","type":"<same>","customLabel":"<same>","x":<same>,"y":<same>,"patterns":[],"settings":{},"dbSchema":{...}}\n' +
      DB_RULES + '\n' +
      'FORMAT:\n```json\n{"blocks":[{"id":"b9","type":"postgresql","customLabel":"Цели DB","x":980,"y":60,"patterns":[],"settings":{},"dbSchema":{"tables":[]}}]}\n```';
  }

  // ════════════════ ВЫЗОВ API ════════════════
  function rawCall(messages, maxTok){
    return fetch(API_URL, {
      method:'POST',
      headers:{'content-type':'application/json','authorization':'Bearer '+apiKey},
      body:JSON.stringify({model:MODEL, messages:messages, max_tokens:maxTok})
    }).then(function(r){ return r.json(); }).then(function(d){
      if (d.error) throw new Error(d.error.message||JSON.stringify(d.error));
      return (d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content)||'';
    });
  }

  // ════════════════ JSON: извлечь / распаковать ════════════════
  function extractJSON(text){
    var m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (!m) return null;
    try { return JSON.parse(m[1].trim()); } catch(e){ return null; }
  }
  function findBlocks(o){ return o.blocks||o.services||o.nodes||o.components||o.elements||o.microservices||null; }
  function unwrapData(data){
    if (!data || typeof data !== 'object') return data;
    if (findBlocks(data)){
      if (!data.blocks) data.blocks = findBlocks(data);
      data.conns     = data.conns||data.connections||data.edges||data.links||[];
      data.scenarios = data.scenarios||data.flows||data.sequences||data.routes||[];
      return data;
    }
    var wrap = ['project','schema','architecture','system','result','data'];
    for (var i=0;i<wrap.length;i++){
      var inner = data[wrap[i]];
      if (inner && typeof inner==='object' && findBlocks(inner)) return unwrapData(inner);
    }
    return data;
  }
  function normBlock(b, i, baseY){
    var r = {
      id:b.id||('b'+(i+1)), type:b.type||'service',
      customLabel:b.customLabel||b.name||b.label||'',
      x:b.x!=null?b.x:200+i*180, y:b.y!=null?b.y:baseY+(i%4)*160,
      patterns:b.patterns||[], settings:b.settings||{}
    };
    if (b.dbSchema) r.dbSchema = b.dbSchema;
    if (b.redisSchema) r.redisSchema = b.redisSchema;
    // redisData → dbRows['__redis__'] (формат для редактора данных)
    if (b.dbRows) r.dbRows = b.dbRows;
    else if (b.redisData && b.redisData.length) r.dbRows = {'__redis__': b.redisData};
    return r;
  }
  function normConns(raw, blocks, prefix){
    raw = raw||[];
    if (raw.length && typeof raw[0]==='string'){
      var idx = {}; blocks.forEach(function(b){ idx[b.customLabel]=b.id; });
      return raw.map(function(s,i){ var p=s.split('>>'); return {id:prefix+i, from:idx[p[0]&&p[0].trim()]||p[0], to:idx[p[1]&&p[1].trim()]||p[1]}; });
    }
    var result = raw.map(function(c,i){ return {id:c.id||(prefix+i), from:c.from||c.source||c.src, to:c.to||c.target||c.dst}; });
    // Дедуп по id — берём последний с таким id
    var seen = {}; result.forEach(function(c){ seen[c.id]=c; });
    return result.filter(function(c){ return seen[c.id]===c; });
  }
  // Гарантия steps.length === path.length + дедуп по id (keep last)
  function fixScenarios(scs){
    // Дедуп по id — если AI сгенерил один сценарий дважды, берём последний (обычно без uml)
    var seen = {}, deduped = [];
    (scs||[]).forEach(function(s){ seen[s.id] = s; });
    (scs||[]).forEach(function(s){ if (!deduped.find(function(x){return x.id===s.id;})) deduped.push(seen[s.id]); });
    return deduped.map(function(s){
      delete s.uml;
      if (Array.isArray(s.path) && Array.isArray(s.steps) && s.steps.length !== s.path.length){
        var out = [];
        for (var i=0;i<s.path.length;i++) out.push(s.steps[i] || {name:'',verb:'',uri:'',resp:'',cache:null,dbTarget:null});
        s.steps = out;
      }
      return s;
    });
  }
  function recomputeNid(){
    var max = 2000;
    (S.blocks||[]).forEach(function(b){ var m=/^b(\d+)$/.exec(b.id); if(m) max=Math.max(max,+m[1]); });
    S.nid = max + 1;
  }

  var DB_CATS = ['db','cache'];
  var SVC_CATS = ['svc','gw','net'];
  function bcat(id, blocks){ var b=(blocks||S.blocks||[]).find(function(x){return x.id===id;}); return b ? (BASE[b.type]&&BASE[b.type].cat||'') : ''; }

  // Удаляем связи сервис→чужая_БД (нарушение МСА: каждый сервис только своя БД)
  function fixSharedDbConns(conns, blocks){
    // Строим карту: dbId → set serviceIds которые к ней подключены
    var dbOwners = {};
    conns.forEach(function(c){
      var fc = bcat(c.from, blocks), tc = bcat(c.to, blocks);
      if (SVC_CATS.indexOf(fc)>=0 && DB_CATS.indexOf(tc)>=0){
        (dbOwners[c.to] = dbOwners[c.to]||[]).push(c.from);
      }
    });
    // Если к БД подключено несколько сервисов — оставляем только первого владельца, остальные связи удаляем
    var remove = {};
    Object.keys(dbOwners).forEach(function(dbId){
      var owners = dbOwners[dbId];
      if (owners.length > 1){
        owners.slice(1).forEach(function(svcId){ remove[svcId+'>>'+dbId] = true; });
      }
    });
    return conns.filter(function(c){ return !remove[c.from+'>>'+c.to]; });
  }

  // Фикс неправильных направлений связей (db→service → переворачиваем в service→db)
  function fixConns(conns, blocks){
    return (conns||[]).map(function(c){
      var fc = bcat(c.from, blocks), tc = bcat(c.to, blocks);
      if (DB_CATS.indexOf(fc)>=0 && SVC_CATS.indexOf(tc)>=0){
        return Object.assign({}, c, {from: c.to, to: c.from});
      }
      return c;
    });
  }

  // Убираем fk-ссылки на таблицы из других DB-блоков
  function fixCrossDbFk(blocks){
    // Строим карту: tableName → dbBlockId
    var tableDb = {};
    blocks.forEach(function(b){
      var dbCat = BASE[b.type]&&BASE[b.type].cat;
      if (dbCat!=='db' && dbCat!=='cache') return;
      ((b.dbSchema&&b.dbSchema.tables)||[]).forEach(function(t){ tableDb[t.name] = b.id; });
    });
    blocks.forEach(function(b){
      ((b.dbSchema&&b.dbSchema.tables)||[]).forEach(function(t){
        (t.fields||[]).forEach(function(f){
          if (f.fk && f.fk.table && tableDb[f.fk.table] && tableDb[f.fk.table] !== b.id){
            // Это кросс-DB FK — удаляем fk объект, оставляем UUID NN
            delete f.fk;
            f.constraints = (f.constraints||'').replace(/,?\s*FK/i,'').trim();
            f.desc = (f.desc ? f.desc+'. ' : '') + 'Ссылка на '+f.name.replace(/_id$/,'')+' из другого сервиса (cross-service UUID)';
          }
        });
      });
    });
    return blocks;
  }

  // ════════════════ ЗАГРУЗКА / МЁРЖ ════════════════
  AI.loadJSON = function(data){
    data = unwrapData(data || _lastJSON);
    if (!data){ toast('❌ Нет JSON — сначала сгенерируй схему'); return; }
    if (data.blocks) data.blocks = data.blocks.map(function(b,i){ return normBlock(b,i,60); });
    if (!data.blocks || !data.blocks.length){
      toast('❌ Не найдены блоки. Ключи: '+Object.keys(_lastJSON||{}).join(', ')); return;
    }
    data.blocks = fixCrossDbFk(data.blocks);
    S.blocks    = data.blocks.map(function(b){ return Object.assign({patterns:[],settings:{}}, b); });
    var rawConns = normConns(data.conns||data.connections||data.edges||data.links, data.blocks, 'c');
    rawConns = fixConns(rawConns, S.blocks);
    S.conns  = fixSharedDbConns(rawConns, S.blocks);
    var scs     = fixScenarios(data.scenarios||[]);
    S.scenarios = typeof normalizeScenarios==='function' ? normalizeScenarios(scs) : scs;
    S.meta      = data.meta || (typeof defaultMeta==='function'?defaultMeta():{});
    S.selected  = null;
    recomputeNid();
    pushHist(); analyze();
    if (typeof renderRoutesPanel==='function') renderRoutesPanel();
    toast('🤖 Загружено: '+S.blocks.length+' блоков, '+S.conns.length+' связей, '+S.scenarios.length+' сценариев');
  };

  AI.mergeJSON = function(data){
    data = unwrapData(data || _lastJSON);
    if (!data || !data.blocks || !data.blocks.length){ toast('❌ Нет блоков для добавления'); return; }
    data.blocks = data.blocks.map(function(b,i){ return normBlock(b,i,300); });
    data.blocks = fixCrossDbFk(data.blocks);

    var added=0, updated=0;
    data.blocks.forEach(function(nb){
      var idx = S.blocks.findIndex(function(sb){ return sb.id===nb.id; });
      if (idx>=0){ S.blocks[idx] = Object.assign({patterns:[],settings:{}}, nb); updated++; }
      else        { S.blocks.push(Object.assign({patterns:[],settings:{}}, nb)); added++; }
    });

    var raw = normConns(data.conns||data.connections||data.edges||data.links, S.blocks, 'cm'+Date.now()+'_');
    raw = fixConns(raw, S.blocks);
    raw = fixSharedDbConns(raw, S.blocks);
    var have = S.conns.map(function(c){ return c.from+'>>'+c.to; });
    var fresh = raw.filter(function(c){ return c.from && c.to && have.indexOf(c.from+'>>'+c.to)<0; });
    S.conns = S.conns.concat(fresh);

    if (data.scenarios && data.scenarios.length){
      var scs = fixScenarios(data.scenarios);
      scs = typeof normalizeScenarios==='function' ? normalizeScenarios(scs) : scs;
      S.scenarios = (S.scenarios||[]).concat(scs);
    }
    recomputeNid();
    pushHist(); analyze();
    if (typeof renderRoutesPanel==='function') renderRoutesPanel();
    toast('🤖 Добавлено: +'+added+' блоков, обновлено: '+updated+', +'+fresh.length+' связей');
  };

  AI.getLastJSON = function(){ return _lastJSON; };

  // Проверка бедных схем БД (для автообогащения)
  function poorSchemas(data){
    var bad = [];
    (data.blocks||[]).forEach(function(b){
      if (DB_TYPES.indexOf(b.type)<0 || !b.dbSchema || !b.dbSchema.tables) return;
      b.dbSchema.tables.forEach(function(t){
        if (!t.fields || t.fields.length < 8) bad.push((b.customLabel||b.type)+'.'+t.name+' ('+((t.fields||[]).length)+' полей)');
      });
    });
    return bad;
  }

  // ════════════════ ОТПРАВКА ════════════════
  function send(){
    var text = (input?input.value:'').trim();
    if (!text) return;
    if (!apiKey){ AI.promptKey(function(){ send(); }); return; }
    addMsg('user', text);
    if (input) input.value='';

    // PATCH
    if (detectPatch(text)){
      var isAdd = detectPatchAdd(text) && !detectPatchDB(text);
      var sys   = isAdd ? buildPatchAdd() : buildPatchDB();
      if (sys){
        busy(true, isAdd?'✦ добавляю в схему...':'✦ заполняю схемы БД...');
        rawCall([{role:'system',content:sys},{role:'user',content:text}], 6000)
          .then(function(content){ busy(false); _patchNext=true; addMsg('assistant', content); })
          .catch(function(e){ busy(false); addMsg('assistant','Ошибка: '+e.message); });
        return;
      }
    }

    // GEN / CHAT
    var isGen = detectGen(text);
    var isConfirm = /^(да|давай|ок|го|yes|ok|погнали|вперёд|вперед|жги|поехали|конечно|делай)(\s|$)/i.test(text.trim());
    chatHistory.push({role:'user', content:text});
    busy(true, isGen?'✦ генерирую схему...':'✦ думает...');
    var history;
    if (!isGen) {
      history = chatHistory.slice(-10);
    } else if (isConfirm) {
      // "Да" после плана — берём последние 3 сообщения (описание + AI-план + "да")
      history = chatHistory.slice(-3);
    } else {
      // Длинное структурированное описание — оно само является контекстом, AI-план не нужен
      history = chatHistory.filter(function(m){ return m.role==='user'; }).slice(-2);
    }
    var messages = [{role:'system', content:isGen?buildGen():buildChat()}].concat(history);

    rawCall(messages, isGen?7000:2000)
      .then(function(content){
        chatHistory.push({role:'assistant', content:content});
        busy(false);
        addMsg('assistant', content);
        if (isGen && _lastJSON){
          chatHistory = [];
          var bad = poorSchemas(_lastJSON);
          if (bad.length){
            addMsg('assistant','🔄 Обогащаю схемы БД...');
            busy(true,'обогащаю...');
            rawCall([{role:'system',content:buildGen()},{role:'user',content:
              'Схемы БД бедные:\n'+bad.join('\n')+'\nДобавь минимум 8 полей в каждую таблицу. Верни ТОЛЬКО полный ```json блок со всей схемой.'}], 6000)
              .then(function(c2){ busy(false); addMsg('assistant', c2); })
              .catch(function(e){ busy(false); addMsg('assistant','Ошибка: '+e.message); });
          }
        }
      })
      .catch(function(e){ busy(false); addMsg('assistant','Ошибка: '+e.message); });
  }

  // ════════════════ РЕНДЕР СООБЩЕНИЯ ════════════════
  function addMsg(role, text){
    if (!msgs) return;
    var wrap = document.createElement('div');
    wrap.className = 'ai-msg ai-msg-'+(role==='user'?'user':'assistant');
    var inner  = document.createElement('div');
    var bubble = document.createElement('div'); bubble.className='ai-bubble';

    var jd = extractJSON(text);
    if (jd) _lastJSON = jd;

    var display = jd ? (text.replace(/```(?:json)?[\s\S]*?```/g,'').trim() || '✓ Схема сгенерирована') : text;
    bubble.innerHTML = md(display);

    if (jd){
      var isPatch = _patchNext; _patchNext = false;
      var bw = document.createElement('div'); bw.style.cssText='margin-top:8px;display:flex;gap:4px';
      var bMerge = document.createElement('button');
      bMerge.textContent = isPatch?'➕ Применить к схеме':'➕ Добавить к схеме';
      bMerge.style.cssText='flex:1;padding:7px 4px;background:#2a6010;color:#fff;border:none;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;border-radius:4px';
      bMerge.onclick = (function(j){ return function(){ AI.mergeJSON(j); }; })(jd);
      bw.appendChild(bMerge);
      if (!isPatch){
        var bRepl = document.createElement('button');
        bRepl.textContent='🔄 Заменить';
        bRepl.style.cssText='flex:0 0 80px;padding:7px 4px;background:#7a3010;color:#fff;border:none;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;border-radius:4px';
        bRepl.onclick = (function(j){ return function(){ AI.loadJSON(j); }; })(jd);
        bw.appendChild(bRepl);
      }
      bubble.appendChild(bw);
    }

    var time = document.createElement('div'); time.className='ai-time';
    var d=new Date(); time.textContent=('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
    if (role==='assistant'){
      var cp = document.createElement('button'); cp.textContent='⎘'; cp.title='Копировать';
      cp.style.cssText='float:right;margin-left:4px;padding:1px 5px;font-size:10px;background:#b8b0a0;border:1px solid #7a6e5a;cursor:pointer;font-family:inherit;line-height:1.4;user-select:none';
      cp.onclick=function(){ navigator.clipboard.writeText(text).then(function(){ cp.textContent='✓'; setTimeout(function(){ cp.textContent='⎘'; },1500); }); };
      time.appendChild(cp);
    }
    inner.appendChild(bubble); inner.appendChild(time);
    wrap.appendChild(inner); msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
  }

  // ════════════════ ПАНЕЛЬ / КЛЮЧ ════════════════
  AI.toggle = function(){ isOpen?AI.close():AI.open(); };
  AI.open = function(){
    var p=document.getElementById('ai-panel'); if(p) p.style.display='flex'; isOpen=true;
    var b=document.getElementById('ai-btn');
    if(b){ b.style.background='#1a3868'; b.style.boxShadow='inset 1px 1px 0 #0a1838,inset -1px -1px 0 #4870b0,inset 2px 2px 0 #102040,inset -2px -2px 0 #3860a0'; }
    setTimeout(function(){ if(input) input.focus(); }, 50);
  };
  AI.close = function(){
    var p=document.getElementById('ai-panel'); if(p) p.style.display='none'; isOpen=false;
    var b=document.getElementById('ai-btn');
    if(b){ b.style.background='#1e4a90'; b.style.boxShadow='inset 1px 1px 0 #6090d0,inset -1px -1px 0 #08183c,inset 2px 2px 0 #4070b8,inset -2px -2px 0 #122858'; }
  };
  AI.send = function(){ send(); };

  var _keyCb = null;
  AI.promptKey = function(cb){
    _keyCb = cb||null;
    var f=document.getElementById('ai-key-form'), ki=document.getElementById('ai-key-input');
    if(f) f.style.display='block';
    if(ki){ ki.value=apiKey||''; setTimeout(function(){ ki.focus(); ki.select(); },50); ki.onkeydown=function(e){ if(e.key==='Enter') AI.saveKey(); }; }
  };
  AI.saveKey = function(){
    var ki=document.getElementById('ai-key-input'), key=ki?ki.value.trim():'';
    if(key.length<10){ addMsg('assistant','Ключ слишком короткий — вставь полный gsk_...'); return; }
    apiKey=key; localStorage.setItem('raptor_ai_key',apiKey);
    AI.hideKeyForm();
    addMsg('assistant','Ключ сохранён ✓ Опишите систему — создам схему.');
    if(_keyCb){ var cb=_keyCb; _keyCb=null; cb(); }
  };
  AI.hideKeyForm = function(){ var f=document.getElementById('ai-key-form'); if(f) f.style.display='none'; };

  // ════════════════ УТИЛИТЫ ════════════════
  function busy(v, txt){
    setDisabled(v); setStatus(v?'думает...':'готов'); showTyping(v);
    if (v && txt) setTypingText(txt);
  }
  function setDisabled(v){ if(input) input.disabled=v; if(sendBtn) sendBtn.disabled=v; }
  function setStatus(s){ if(!statusEl) return; statusEl.textContent='● '+s; statusEl.style.color=s==='готов'?'#2a6010':'#7a5008'; }
  function showTyping(v){ if(typingEl){ typingEl.style.display=v?'block':'none'; if(!v) setTypingText('✦ думает...'); } if(v&&msgs) msgs.scrollTop=msgs.scrollHeight; }
  function setTypingText(t){ if(typingEl){ var s=typingEl.querySelector('span'); if(s) s.textContent=t; } }

  function md(s){
    s=s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    s=s.replace(/^### (.+)$/gm,'<span style="font-weight:700;font-size:12px;color:var(--blue);display:block;margin-top:6px">$1</span>');
    s=s.replace(/^## (.+)$/gm,'<span style="font-weight:700;font-size:13px;color:var(--txt);display:block;margin-top:8px">$1</span>');
    s=s.replace(/\*\*([^\n*]+)\*\*/g,'<b>$1</b>');
    s=s.replace(/`([^`\n]+)`/g,'<code style="background:var(--bg3);padding:1px 4px;border-radius:3px;font-family:Consolas,monospace;font-size:10.5px">$1</code>');
    s=s.replace(/^[•\-\*] (.+)$/gm,'&nbsp;• $1');
    s=s.replace(/\n/g,'<br>');
    return s;
  }

  function init(){
    msgs    =document.getElementById('ai-msgs');
    input   =document.getElementById('ai-input');
    sendBtn =document.getElementById('ai-send');
    statusEl=document.getElementById('ai-status');
    typingEl=document.getElementById('ai-typing');
    apiKey  =localStorage.getItem('raptor_ai_key');
    if(input) input.addEventListener('keydown',function(e){ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send(); } });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&isOpen) AI.close(); });
  }
  document.addEventListener('DOMContentLoaded', init);
})();

function toggleAI(){ AI.toggle(); }
