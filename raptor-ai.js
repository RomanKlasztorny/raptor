// RAPTOR AI — Groq llama-3.3-70b-versatile (бесплатный план)
// Режимы: чат (план) → gen (полный JSON) / patch (доработка без перегенерации)
// Формат RAPTOR: строковые id "b1", блоки/связи/сценарии, dbSchema на блоках БД.

var AI = {};

(function () {
  'use strict';

  // ═══ ПРОВАЙДЕРЫ LLM ═══
  // Enter your own API key in the AI panel.
  // Enter your own API key in the AI panel.
  // apinet.cloud — реселлер с OpenAI-совместимым API, отдаёт claude-sonnet-5, доступен из РФ напрямую (CORS: *).
  // Enter your own API key in the AI panel.
  // anthropic/groq оставлены на случай прямого ключа — идут через llm-proxy.js (:8966, start-proxy.bat).
  var PXY = 'http://localhost:8966';
  var PROVIDERS = {
    apinet: {
      url: 'https://apinet.cloud/v1/chat/completions',
      model: 'claude-sonnet-5',
      needKey: true, kind: 'openai', label: 'Claude (apinet)',
      key: ''
    },
    anthropic: {
      url: PXY + '/anthropic/v1/messages',
      model: 'claude-haiku-4-5-20251001',   // прямой ключ Anthropic (sk-ant-…); нужен start-proxy.bat
      needKey: true, kind: 'anthropic', label: 'Claude'
    },
    groq: {
      url: PXY + '/groq/openai/v1/chat/completions',
      model: 'llama-3.3-70b-versatile',
      needKey: true, kind: 'openai', label: 'Groq'
    },
    ollama: {
      url: 'http://localhost:11434/api/chat',
      // 7b (~5.6 ГБ VRAM) — оставляет ~5 ГБ карты дисплею, система не виснет.
      // 14b (~10 ГБ) забивает всю память 1080ti и морозит рабочий стол — НЕ ставить дефолтом.
      model: 'qwen2.5:7b',
      needKey: false, kind: 'ollama', label: 'Ollama',
      num_ctx: 8192
    }
  };
  var PROVIDER = localStorage.getItem('raptor_ai_provider') || 'apinet';
  function P(){ return PROVIDERS[PROVIDER] || PROVIDERS.apinet; }
  function keyStoreName(){ return 'raptor_ai_key_' + PROVIDER; }
  function resolveKey(){ return localStorage.getItem(keyStoreName()) || P().key || localStorage.getItem('raptor_ai_key') || null; }

  function syncLabel(){
    var el = document.getElementById('ai-model-label');
    if (!el) return;
    el.textContent = (P().label || PROVIDER) + ' / ' + P().model;
    el.style.cursor = 'pointer';
    el.title = 'Клик — сменить провайдера (apinet / Claude / Groq / Ollama)';
    el.onclick = function(){
      var order = ['apinet','anthropic','groq','ollama'];
      AI.setProvider(order[(order.indexOf(PROVIDER)+1) % order.length]);
      if (P().needKey && !apiKey) AI.promptKey(function(){});
    };
  }
  AI.setProvider = function(name){
    if (!PROVIDERS[name]) return;
    PROVIDER = name; localStorage.setItem('raptor_ai_provider', name);
    var sm = localStorage.getItem('raptor_ai_model_'+PROVIDER); if (sm) P().model = sm;
    apiKey = resolveKey();
    syncLabel();
    if (typeof toast === 'function') toast('AI: ' + name + ' (' + P().model + ')');
  };
  AI.setModel = function(m){ P().model = m; localStorage.setItem('raptor_ai_model_'+PROVIDER, m); syncLabel(); };
  AI.getProvider = function(){ return { provider: PROVIDER, model: P().model, hasKey: !!apiKey }; };
  AI.providers = function(){ return Object.keys(PROVIDERS); };

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

  // Короткое подтверждение ЦЕЛИКОМ ("да", "давай", "го", "давай генерируй") —
  // НЕ срабатывает на "давай попробуем обсудить...", "давай без оркестратора..."
  var CONFIRM_RE = /^(да|ага|давай(те)?|ок(ей)?|го|yes|ok|погнали|впер[её]д|жги|поехали|конечно|делай|плюс)([\s,!.\-—]+(генери(руй)?|сгенерируй|json|схему?|погнали|давай|го|делай|можно))*[\s,!.\-—]*$/i;
  function isConfirmMsg(t){ t=(t||'').trim(); return t.length <= 40 && CONFIRM_RE.test(t); }
  // Начинается с «да/давай/го…», короткое и без слов-обсуждений → согласие на генерацию
  function startsConfirm(t){
    t = (t||'').trim();
    if (t.length > 80) return false;
    if (/обсуд|поговор|расскаж|сравни|подума|а что если|в чём разниц|вопрос|почему|зачем|как\s/i.test(t)) return false;
    return /^(да|ага|ок(ей)?|давай(те)?|го|yes|ok|погнали|поехали|конечно|делай|жги|впер[её]д)\b/i.test(t);
  }
  // Есть ли незакрытый план (последний ответ AI звал «Генерировать JSON?»)
  function planPending(){
    for (var i=chatHistory.length-1;i>=0;i--){
      if (chatHistory[i].role==='assistant')
        return /генерир\w*\s+json|generate\s+json|генерировать\s+json\??/i.test(chatHistory[i].content||'');
    }
    return false;
  }

  function detectGen(t){
    if (detectPatch(t)) return false;
    // Подтверждение плана: «да», «давай», «да, оркестратор» — но только если план ждёт ответа
    if (startsConfirm(t) && planPending()) return true;
    // Явная просьба обсудить — не генерируем, даже если есть название домена
    if (/обсуд|поговор|давай\s+подума|а\s+что\s+если|сравни|в\s+чём\s+разниц|стоит\s+ли|посовет|как\s+лучше|что\s+думаешь/i.test(t)) return false;
    // Явные команды генерации
    if (/сгенерируй|генерируй|generate|создай систему|разработай|спроектируй/i.test(t)) return true;
    if (/сделай.{0,20}(систем|всё|все|сразу|json|схем)|всю систем|пришли.{0,10}(json|схем)|сделай всё/i.test(t)) return true;
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

  function buildGen(skipDb){
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
      (skipDb
        ? '═══ NO DB SCHEMAS HERE ═══\nOutput db blocks WITHOUT the "dbSchema" field — schemas are generated in a separate step. Focus on: all blocks, all conns, all scenarios.\n\n'
        : DB_RULES + '\n') +
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
      (skipDb
        ? '```json\n{"blocks":[' +
          '{"id":"b1","type":"actor","customLabel":"Покупатель","x":-100,"y":60,"patterns":[],"settings":{}},' +
          '{"id":"b2","type":"web_client","customLabel":"Веб-приложение","x":100,"y":60,"patterns":[],"settings":{}},' +
          '{"id":"b3","type":"api_gw","customLabel":"API Gateway","x":320,"y":60,"patterns":[],"settings":{}},' +
          '{"id":"b4","type":"service","customLabel":"Заказы","x":540,"y":60,"patterns":[],"settings":{}},' +
          '{"id":"b8","type":"postgresql","customLabel":"Orders DB","x":980,"y":60,"patterns":[],"settings":{}}],' +
          '"conns":[{"id":"c1","from":"b1","to":"b2"},{"id":"c2","from":"b2","to":"b3"},{"id":"c3","from":"b3","to":"b4"},{"id":"c4","from":"b4","to":"b8"}],' +
          '"scenarios":[{"id":"sc1","name":"Оформить заказ","color":"#7aa2f7","actorId":"b1","volume":100,"visible":true,' +
          '"path":["b1","b2","b3","b4","b8"],"steps":[' +
          '{"name":"Открывает корзину","verb":"","uri":"","resp":"","cache":null,"dbTarget":null},' +
          '{"name":"Оформить заказ","verb":"POST","uri":"/api/v1/orders","resp":"201 {orderId}","cache":null,"dbTarget":null},' +
          '{"name":"Маршрутизирует","verb":"POST","uri":"/orders","resp":"201","cache":null,"dbTarget":null},' +
          '{"name":"Создать заказ","verb":"POST","uri":"/orders","resp":"201 {orderId}","cache":null,"dbTarget":null},' +
          '{"name":"Сохранить заказ","verb":"INSERT","uri":"orders","resp":"uuid","cache":null,"dbTarget":"b8"}]}],' +
          '"meta":{"systemName":"Зоомагазин","description":"...","domain":"e-commerce"}}\n```\n\n' +
          'Now output the FULL topology (blocks + conns + scenarios, NO dbSchema). Scale to the number of services needed.'
        : (
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
      'Now generate the FULL schema for the user request. Scale to the number of services needed.'
      ));
  }

  // Компактный stage-1 промпт для локальных моделей: топология без dbSchema (её добирает stage-2).
  // Цель — уложиться в 4k контекста вместе с ответом.
  function buildGenLite(){
    var ctx = getContext();
    return 'You are a JSON generator for the RAPTOR architecture tool.\n' +
      'OUTPUT ONLY one ```json block. Keys English, customLabel/name/desc Russian. ids are strings "b1","c1","sc1".\n' +
      (ctx ? 'Current canvas: '+JSON.stringify(ctx)+'\n' : '') +
      '\nBLOCK TYPES: actor web_client mob_client api_gw lb bff service auth external postgresql mysql mongodb redis elasticsearch s3 kafka rabbitmq queue\n' +
      '\nRULES:\n' +
      '1. Always: 1 actor + 1 web_client + 1 api_gw.\n' +
      '2. One service per business capability. EACH service gets its OWN postgresql block (NO dbSchema here — schemas added later).\n' +
      '3. conns flow client→server: actor→web_client→api_gw→service→db. NEVER db→service. Never service A → db of service B.\n' +
      '4. kafka only if user wants async/events/saga. Consumer = its own service block, conn kafka→consumer→its db.\n' +
      '5. redis (cache) / elasticsearch (search) / external (payment,SMS,email) only when relevant. conn service→redis, service→elasticsearch.\n' +
      '6. Coords: actor x=-100, web_client x=100, api_gw x=320, service x=540, kafka x=760, db x=980, external x=1200; y starts 60, +160 per block in a column.\n' +
      '\nSCENARIOS: 3-5 items. CRITICAL steps.length === path.length (step[i] happens at path[i]).\n' +
      ' actor step: verb="" uri="" name="Открывает/Нажимает…". client/api_gw: POST|GET|PUT|DELETE + /path + "201/200".\n' +
      ' db step: SELECT|INSERT|UPDATE + table_name + result. kafka step: PUBLISH + topic.event + "".\n' +
      ' async = 2 scenarios: publisher (path ends at kafka) + consumer (path starts at kafka, no actor).\n' +
      '\nEXAMPLE:\n```json\n' +
      '{"blocks":[' +
      '{"id":"b1","type":"actor","customLabel":"Покупатель","x":-100,"y":60,"patterns":[],"settings":{}},' +
      '{"id":"b2","type":"web_client","customLabel":"Веб-приложение","x":100,"y":60,"patterns":[],"settings":{}},' +
      '{"id":"b3","type":"api_gw","customLabel":"API Gateway","x":320,"y":60,"patterns":[],"settings":{}},' +
      '{"id":"b4","type":"service","customLabel":"Заказы","x":540,"y":60,"patterns":[],"settings":{}},' +
      '{"id":"b5","type":"postgresql","customLabel":"Orders DB","x":980,"y":60,"patterns":[],"settings":{}}],' +
      '"conns":[{"id":"c1","from":"b1","to":"b2"},{"id":"c2","from":"b2","to":"b3"},{"id":"c3","from":"b3","to":"b4"},{"id":"c4","from":"b4","to":"b5"}],' +
      '"scenarios":[{"id":"sc1","name":"Оформить заказ","color":"#7aa2f7","actorId":"b1","volume":100,"visible":true,' +
      '"path":["b1","b2","b3","b4","b5"],"steps":[' +
      '{"name":"Открывает корзину","verb":"","uri":"","resp":""},' +
      '{"name":"Оформить заказ","verb":"POST","uri":"/api/v1/orders","resp":"201 {orderId}"},' +
      '{"name":"Маршрутизирует","verb":"POST","uri":"/orders","resp":"201"},' +
      '{"name":"Создать заказ","verb":"POST","uri":"/orders","resp":"201 {orderId}"},' +
      '{"name":"Сохранить заказ","verb":"INSERT","uri":"orders","resp":"uuid"}]}],' +
      '"meta":{"systemName":"Зоомагазин","domain":"e-commerce"}}\n```\n' +
      '\nNow output the full topology JSON for the user request. Scale services to the domain. NO dbSchema.';
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
  function wrapJSON(c, jsonMode){
    if (jsonMode && c && c.trim().charAt(0)==='{') return '```json\n'+c.trim()+'\n```';
    return c;
  }

  // messages, maxTok, jsonMode, onDelta(textSoFar)
  function rawCall(messages, maxTok, jsonMode, onDelta){
    var p = P();

    if (p.kind === 'ollama'){
      return fetch(p.url, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          model: p.model, messages: messages, stream: true,
          format: jsonMode ? 'json' : undefined,
          options: { temperature: jsonMode ? 0.15 : 0.4, num_ctx: p.num_ctx || 16384, num_predict: maxTok }
        })
      }).catch(function(err){
        throw new Error('Ollama не отвечает на ' + p.url + '.\nПроверь что запущен `ollama serve` и модель `' + p.model + '` установлена (`ollama list`).');
      }).then(function(r){
        if (!r.ok) return r.text().then(function(x){ throw new Error('Ollama HTTP '+r.status+': '+String(x).slice(0,300)); });
        var reader = r.body.getReader(), dec = new TextDecoder(), buf = '', full = '';
        function pump(){
          return reader.read().then(function(res){
            if (res.done){
              if (buf.trim()) try { var j0=JSON.parse(buf); if(j0.message&&j0.message.content) full+=j0.message.content; } catch(e){}
              return wrapJSON(full, jsonMode);
            }
            buf += dec.decode(res.value, {stream:true});
            var lines = buf.split('\n'); buf = lines.pop();
            for (var i=0;i<lines.length;i++){
              var ln = lines[i].trim(); if (!ln) continue;
              var j; try { j = JSON.parse(ln); } catch(e){ continue; }
              if (j.error) throw new Error(typeof j.error==='string'?j.error:JSON.stringify(j.error));
              if (j.message && j.message.content){
                full += j.message.content;
                if (onDelta) try { onDelta(full); } catch(e){}
              }
            }
            return pump();
          });
        }
        return pump();
      });
    }

    if (p.kind === 'anthropic'){
      // RAPTOR шлёт messages c role:'system' — у Anthropic system это top-level строка,
      // а messages только user/assistant, начинаются с user и чередуются.
      var sysParts = [], msgs2 = [];
      messages.forEach(function(m){
        if (m.role === 'system'){ sysParts.push(m.content); return; }
        var role = m.role === 'assistant' ? 'assistant' : 'user';
        if (msgs2.length && msgs2[msgs2.length-1].role === role)
          msgs2[msgs2.length-1].content += '\n\n' + m.content;
        else msgs2.push({ role: role, content: m.content });
      });
      if (!msgs2.length || msgs2[0].role !== 'user') msgs2.unshift({ role:'user', content: 'Продолжай.' });
      var maxOut = Math.min(maxTok || 8000, /sonnet|opus/i.test(p.model) ? 32000 : 8192);
      var sysStr = sysParts.join('\n\n');
      // prompt caching: статичный префикс (правила) кешируется на 5 мин → дешевле и быстрее
      // на параллельных/повторных запросах. Разделитель ставит buildGenDB.
      var sysField, cut = sysStr.indexOf('\n════════════════════════════════════════\n');
      if (cut > 1500){
        sysField = [
          { type:'text', text: sysStr.slice(0, cut), cache_control:{ type:'ephemeral' } },
          { type:'text', text: sysStr.slice(cut) }
        ];
      } else if (sysStr.length > 2000){
        sysField = [{ type:'text', text: sysStr, cache_control:{ type:'ephemeral' } }];
      } else {
        sysField = sysStr;
      }
      return fetch(p.url, {
        method:'POST',
        headers:{
          'content-type':'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: p.model, max_tokens: maxOut,
          temperature: jsonMode ? 0.2 : 0.5,
          system: sysField,
          messages: msgs2, stream: true
        })
      }).catch(function(err){
        throw new Error('Claude API недоступен (' + (err && err.message || err) + ').\nЗапущен ли прокси? → start-proxy.bat');
      }).then(function(r){
        if (!r.ok) return r.text().then(function(x){
          var msg = x; try { var jj = JSON.parse(x); msg = (jj.error && jj.error.message) || x; } catch(e){}
          throw new Error('Claude API HTTP ' + r.status + ': ' + String(msg).slice(0,400));
        });
        var reader = r.body.getReader(), dec = new TextDecoder(), buf = '', full = '';
        function pump(){
          return reader.read().then(function(res){
            if (res.done) return wrapJSON(full, jsonMode);
            buf += dec.decode(res.value, {stream:true});
            var lines = buf.split('\n'); buf = lines.pop();
            for (var i=0;i<lines.length;i++){
              var ln = lines[i];
              if (ln.indexOf('data:') !== 0) continue;
              var payload = ln.slice(5).trim();
              if (!payload || payload === '[DONE]') continue;
              var j; try { j = JSON.parse(payload); } catch(e){ continue; }
              if (j.type === 'error') throw new Error((j.error && j.error.message) || 'ошибка стрима Claude');
              if (j.type === 'content_block_delta' && j.delta && j.delta.text){
                full += j.delta.text;
                if (onDelta) try { onDelta(full); } catch(e){}
              }
            }
            return pump();
          });
        }
        return pump();
      });
    }

    // openai-совместимый (OpenAI, Groq, apinet) — стриминг SSE
    // потолок вывода: llama/groq ~8k, gpt-4o ~16k, claude/остальное — как просят
    var cap = /llama|mixtral|gemma|groq/i.test(p.model) ? 8000 : (/gpt-4o|gpt-4\.1/i.test(p.model) ? 16000 : 32000);
    var mt = Math.min(maxTok || 8000, cap);
    var oaBody = { model:p.model, messages:messages, stream:true };
    if (/^o[0-9]/.test(p.model)) oaBody.max_completion_tokens = mt; else oaBody.max_tokens = mt;
    if (!/^o[0-9]/.test(p.model)) oaBody.temperature = jsonMode ? 0.2 : 0.5;
    return fetch(p.url, {
      method:'POST',
      headers:{'content-type':'application/json','authorization':'Bearer '+apiKey},
      body:JSON.stringify(oaBody)
    }).catch(function(err){
      throw new Error((p.label||'API') + ' недоступен (' + (err && err.message || err) + ').\nЗапущен ли прокси? → start-proxy.bat');
    }).then(function(r){
      if (!r.ok) return r.text().then(function(x){
        var msg = x; try { var jj = JSON.parse(x); msg = (jj.error && jj.error.message) || x; } catch(e){}
        throw new Error((p.label||'API') + ' HTTP ' + r.status + ': ' + String(msg).slice(0,400));
      });
      var reader = r.body.getReader(), dec = new TextDecoder(), buf = '', full = '';
      function pump(){
        return reader.read().then(function(res){
          if (res.done) return wrapJSON(full, jsonMode);
          buf += dec.decode(res.value, {stream:true});
          var lines = buf.split('\n'); buf = lines.pop();
          for (var i=0;i<lines.length;i++){
            var ln = lines[i];
            if (ln.indexOf('data:') !== 0) continue;
            var payload = ln.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            var j; try { j = JSON.parse(payload); } catch(e){ continue; }
            if (j.error) throw new Error((j.error.message) || 'ошибка стрима');
            var d = j.choices && j.choices[0] && j.choices[0].delta;
            if (d && d.content){ full += d.content; if (onDelta) try { onDelta(full); } catch(e){} }
          }
          return pump();
        });
      }
      return pump();
    });
  }

  // ════════════════ JSON: извлечь / распаковать ════════════════
  // Достроить оборванный JSON (локальная модель упёрлась в num_ctx): закрыть строку и скобки
  function repairJSON(str){
    var inStr=false, esc=false, stack=[];
    for (var i=0;i<str.length;i++){
      var ch=str[i];
      if (esc){ esc=false; continue; }
      if (ch==='\\'){ esc=true; continue; }
      if (ch==='"'){ inStr=!inStr; continue; }
      if (inStr) continue;
      if (ch==='{'||ch==='[') stack.push(ch);
      else if (ch==='}'||ch===']') stack.pop();
    }
    var out = str.replace(/,\s*$/,'');
    if (inStr) out += '"';
    for (var k=stack.length-1;k>=0;k--) out += stack[k]==='{' ? '}' : ']';
    try { return JSON.parse(out); } catch(e){ return null; }
  }
  function extractJSON(text){
    var m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m){ try { return JSON.parse(m[1].trim()); } catch(e){} }
    // Голый JSON без ограждения (локальные модели в format:json)
    var s = text.indexOf('{'), e2 = text.lastIndexOf('}');
    if (s >= 0 && e2 > s){ try { return JSON.parse(text.slice(s, e2+1)); } catch(e){} }
    // Обрыв по лимиту токенов — пробуем достроить
    if (s >= 0){ var r = repairJSON(text.slice(s)); if (r) return r; }
    return null;
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
    if (!data){ toast(t('ai_no_json')); return; }
    if (data.blocks) data.blocks = data.blocks.map(function(b,i){ return normBlock(b,i,60); });
    if (!data.blocks || !data.blocks.length){
      toast(t('ai_no_blocks_found')+Object.keys(_lastJSON||{}).join(', ')); return;
    }
    coerceTypes(data);
    data.blocks = fixCrossDbFk(data.blocks);
    S.blocks    = data.blocks.map(function(b){ return Object.assign({patterns:[],settings:{}}, b); });
    var rawConns = normConns(data.conns||data.connections||data.edges||data.links, data.blocks, 'c');
    rawConns = fixConns(rawConns, S.blocks);
    S.conns  = fixSharedDbConns(rawConns, S.blocks);
    var scs     = fixScenarios(data.scenarios||[]);
    S.scenarios = typeof normalizeScenarios==='function' ? normalizeScenarios(scs) : scs;
    S.meta      = data.meta || (typeof defaultMeta==='function'?defaultMeta():{});
    // BPMN из JSON (раньше молча терялся): принимаем объект/массив/одиночную диаграмму
    if (data.bpmn && typeof normalizeBpmn==='function'){ S.bpmn = normalizeBpmn(data.bpmn); }
    if (data.notationMode) S.notationMode = data.notationMode;
    S.selected  = null;
    recomputeNid();
    if (typeof autoLayout==='function' && S.blocks.length){ try { autoLayout(); } catch(e){} }
    pushHist(); analyze();
    if (typeof renderRoutesPanel==='function') renderRoutesPanel();
    fitView();
    var _bpmnN=(S.bpmn&&S.bpmn.diagrams)?S.bpmn.diagrams.length:0;
    toast(t('ai_loaded_prefix')+S.blocks.length+' '+t('sb_blocks')+', '+S.conns.length+' '+t('sb_connections')+', '+S.scenarios.length+' '+t('sb_scenarios')+(_bpmnN?', BPMN: '+_bpmnN:''));
  };

  // Вписать всю схему в видимую область канвы
  function fitView(){
    try {
      if (typeof S === 'undefined' || !S.blocks || !S.blocks.length) return;
      var svg = document.getElementById('canvas'); if (!svg) return;
      var vpW = svg.clientWidth || 800, vpH = svg.clientHeight || 700;
      var minX=1e9, minY=1e9, maxX=-1e9, maxY=-1e9;
      S.blocks.forEach(function(b){
        var w = (typeof bw==='function'?bw(b):120), h = (typeof bh==='function'?bh(b):48);
        if (b.x<minX) minX=b.x; if (b.y<minY) minY=b.y;
        if (b.x+w>maxX) maxX=b.x+w; if (b.y+h>maxY) maxY=b.y+h;
      });
      var W = Math.max(1, maxX-minX), H = Math.max(1, maxY-minY), pad = 50;
      var z = Math.min((vpW-pad*2)/W, (vpH-pad*2)/H, 1);
      z = Math.max(0.1, z);
      S.zoom = z;
      S.panX = Math.round((vpW - W*z)/2 - minX*z);
      S.panY = Math.round((vpH - H*z)/2 - minY*z);
      if (typeof render==='function') render();
    } catch(e){}
  }
  AI.fitView = fitView;

  AI.mergeJSON = function(data){
    data = unwrapData(data || _lastJSON);
    if (!data || !data.blocks || !data.blocks.length){ toast(t('ai_no_blocks_to_add')); return; }
    data.blocks = data.blocks.map(function(b,i){ return normBlock(b,i,300); });
    coerceTypes(data);
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
    fitView();
    toast(t('ai_added_prefix')+added+' '+t('sb_blocks')+', '+t('ai_updated_word')+': '+updated+', +'+fresh.length+' '+t('sb_connections'));
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

  // SQL-БД без схемы (локальные модели часто пропускают dbSchema при one-shot генерации).
  // redis/s3/elasticsearch не трогаем — у них своя структура.
  var SQL_DB_TYPES = ['postgresql','mysql','mongodb','cassandra','clickhouse'];
  function dbBlocksNoSchema(data){
    return (data.blocks||[]).filter(function(b){
      return SQL_DB_TYPES.indexOf(b.type)>=0 &&
             (!b.dbSchema || !b.dbSchema.tables || !b.dbSchema.tables.length);
    });
  }

  // Известные типы блоков — чужие (consumer_svc и т.п. от слабых моделей) сводим к service
  var KNOWN_TYPES = ('actor web_client mob_client api_gw websocket_gw lb cdn bff service auth external ' +
    'postgresql mysql mongodb redis cassandra clickhouse elasticsearch s3 kafka rabbitmq nats queue').split(' ');
  function coerceTypes(data){
    (data.blocks||[]).forEach(function(b){
      if (b.type && KNOWN_TYPES.indexOf(b.type)<0) b.type = 'service';
    });
    return data;
  }

  // Stage-2 промпт: заполнить dbSchema для конкретных DB-блоков уже сгенерённой топологии
  function buildGenDB(data, dbs){
    var svcByDb = {};
    (data.conns||[]).forEach(function(c){
      var to = (data.blocks||[]).find(function(b){ return b.id===c.to; });
      var fr = (data.blocks||[]).find(function(b){ return b.id===c.from; });
      if (to && fr && DB_TYPES.indexOf(to.type)>=0) svcByDb[to.id] = fr.customLabel||fr.type;
    });
    var targets = dbs.map(function(b){
      return {id:b.id, type:b.type, customLabel:b.customLabel, x:b.x, y:b.y, service:svcByDb[b.id]||''};
    });
    var domain = (data.meta && (data.meta.systemName||data.meta.domain)) || '';
    // Облегчённые правила без доменных примеров — слабые модели копируют примеры дословно
    var DB_RULES_LITE =
      '═══ DB SCHEMA RULES ═══\n' +
      '- EACH db block: EXACTLY 2 tables (main entity + its items/log/history table).\n' +
      '- EACH table: 6-9 fields, specific to THIS service domain (real business columns, not generic name/status).\n' +
      '- EACH table starts with: id UUID PK (default "gen_random_uuid()"), and ends with created_at + updated_at TIMESTAMPTZ NN (default "NOW()").\n' +
      '- FK inside the SAME db block → {"name":"x_id","type":"UUID","constraints":"NN, FK","fk":{"table":"<t>","field":"id"}}.\n' +
      '- Reference to another service → plain UUID NN, no fk object.\n' +
      '- Field shape: {"name","type","constraints","desc"} (+ "default" or "fk" where needed). Keep desc short (2-4 words). NO "example" field.\n' +
      '- Optional per table: "indexes": ["CREATE INDEX ..."] on FK / status / date columns.\n';
    // Для сильных моделей (Claude/Groq) — полные правила из основного промпта.
    // Порядок: статичные правила ПЕРВЫМИ (кешируются на повторных/параллельных запросах),
    // динамика (домен, targets, требования) — В КОНЦЕ.
    var rules = (P().kind === 'ollama') ? DB_RULES_LITE : DB_RULES;
    return 'You are a DB schema generator for the RAPTOR tool.\n' +
      'OUTPUT ONLY one raw ```json block: {"blocks":[ ... ]}. Keys English, labels/desc Russian.\n' +
      'Return each block as: {"id":"<same>","type":"<same>","customLabel":"<same>","x":<same>,"y":<same>,"patterns":[],"settings":{},"dbSchema":{"tables":[...]}}\n' +
      'NO conns, NO scenarios, NO service blocks — only the requested DB blocks, each with full dbSchema.\n\n' +
      rules + '\n' +
      '════════════════════════════════════════\n' +
      (domain ? 'SYSTEM DOMAIN: '+domain+'. Every table must fit this domain.\n' : '') +
      (data.meta && data.meta.description ? 'REQUIREMENTS:\n'+String(data.meta.description).slice(0,1500)+'\n' : '') +
      '\nGenerate dbSchema for EXACTLY these DB blocks (derive tables/columns from "service" + domain + requirements):\n' +
      JSON.stringify(targets);
  }

  // Разбираем ответ stage-2 в любой форме и вклеиваем dbSchema в _lastJSON.
  // Модель может вернуть: {blocks:[...]}, [{...}], {id,dbSchema}, {tables:[...]}, {dbSchema:{...}}
  function mergeDbSchemas(res, batch){
    if (!res) return 0;
    var arr = res.blocks || res.services || (Array.isArray(res) ? res : null) || [res];
    var got = 0;
    arr.forEach(function(nb){
      if (!nb || typeof nb !== 'object') return;
      var schema = nb.dbSchema || (nb.tables ? {tables:nb.tables} : null);
      if (!schema || !schema.tables || !schema.tables.length) return;
      var tgt = (nb.id && _lastJSON.blocks.find(function(b){ return b.id===nb.id; }))
             || (batch.length === 1 && _lastJSON.blocks.find(function(b){ return b.id===batch[0].id; }));
      if (tgt){ tgt.dbSchema = schema; got++; }
    });
    return got;
  }

  // Stage-2: заполняем dbSchema. Сначала пачками по 3 (быстро), при промахах падаем на по 1 (надёжно).
  function fillSchemasStaged(allDbs, opts){
    opts = opts || {};
    var autoload = opts.autoload, total = opts.total || allDbs.length;
    // Claude/Groq тянут все БД одним запросом; ollama — пачками по 3
    var bs = opts.batchSize || (P().kind === 'ollama' ? 3 : 50), stuck = opts.stuck || 0;

    var pendingOf = function(){
      return allDbs.filter(function(d){
        var b = _lastJSON.blocks.find(function(x){ return x.id===d.id; });
        return b && (!b.dbSchema || !b.dbSchema.tables || !b.dbSchema.tables.length);
      });
    };
    var pending = pendingOf(), done = total - pending.length;

    var finish = function(){
      busy(false);
      if (autoload){
        AI.loadJSON(_lastJSON);
        addMsg('assistant', '✓ '+t('ai_filling_db')+': ' + done + '/' + total +
          (done<total ? ' — по остальным модель не справилась, повтори «опиши БД»' : ', применено к схеме'));
      } else {
        addMsg('assistant', (done ? '✓ '+t('ai_filling_db')+' ('+done+'/'+total+')\n' : '') +
          '```json\n'+JSON.stringify(_lastJSON)+'\n```');
      }
    };

    if (!pending.length) return finish();
    if (bs === 1 && stuck >= 2) return finish();   // и по одному не идёт

    var batch = pending.slice(0, bs);
    busy(true, '✦ '+t('ai_filling_db')+' '+done+'/'+total + (bs===1?' (добор)':''));
    rawCall([{role:'system',content:buildGenDB(_lastJSON, batch)},
             {role:'user',content:'Заполни схемы БД для этих блоков.'}], bs>3?8000:(bs>1?4000:2600), true, busyProgress)
      .then(function(c2){
        var before = pending.length;
        mergeDbSchemas(extractJSON(c2), batch);
        var progressed = pendingOf().length < before;
        var nbs = bs, ns = stuck;
        if (progressed) ns = 0;
        else { ns++; if (bs > 1){ nbs = 1; ns = 0; } }
        fillSchemasStaged(allDbs, {autoload:autoload, total:total, batchSize:nbs, stuck:ns});
      })
      .catch(function(){
        fillSchemasStaged(allDbs, {autoload:autoload, total:total, batchSize:1, stuck:stuck+1});
      });
  }

  var _pendingDbs = function(list){
    return list.filter(function(d){
      var b = _lastJSON.blocks.find(function(x){ return x.id===d.id; });
      return b && (!b.dbSchema || !b.dbSchema.tables || !b.dbSchema.tables.length);
    });
  };

  // Claude/Groq — параллельное заполнение: по 1 БД на запрос, пул на 5 одновременных → быстро.
  function fillSchemasConcurrent(allDbs, autoload){
    var total = allDbs.length, t0 = Date.now(), CONC = 5;
    var tick = function(){
      busy(true, '✦ '+t('ai_filling_db')+' '+(total-_pendingDbs(allDbs).length)+'/'+total);
    };
    tick();
    var one = function(g){
      return rawCall([{role:'system',content:buildGenDB(_lastJSON, g)},
                      {role:'user',content:'Заполни схему БД для этого блока.'}], 5000, true)
        .then(function(c2){ mergeDbSchemas(extractJSON(c2), g); }, function(){})
        .then(tick);
    };
    // пул: обрабатываем список с ограничением параллелизма
    var runPool = function(list){
      var idx = 0;
      var worker = function(){
        if (idx >= list.length) return Promise.resolve();
        var item = list[idx++];
        return one([item]).then(worker);
      };
      var n = Math.min(CONC, list.length), ws = [];
      for (var i=0;i<n;i++) ws.push(worker());
      return Promise.all(ws);
    };
    runPool(allDbs.slice())
      .then(function(){ var miss = _pendingDbs(allDbs); return miss.length ? runPool(miss) : null; })
      .then(function(){
        var filled = total - _pendingDbs(allDbs).length;
        busy(false);
        if (autoload){
          AI.loadJSON(_lastJSON);
          addMsg('assistant', '✓ '+t('ai_filling_db')+': '+filled+'/'+total+' за '+Math.round((Date.now()-t0)/1000)+'с, применено');
        } else {
          addMsg('assistant', (filled?'✓ '+t('ai_filling_db')+' ('+filled+'/'+total+')\n':'') +
            '```json\n'+JSON.stringify(_lastJSON)+'\n```');
        }
      });
  }

  function fillDbStage(noSchema, autoload){
    if (P().kind === 'ollama') fillSchemasStaged(noSchema, {autoload:autoload});
    else fillSchemasConcurrent(noSchema, autoload);
  }

  // Заполнить схемы всех пустых SQL-БД в текущей схеме (с применением на канву)
  AI.fillDB = function(){
    var ctx = getContext();
    if (!ctx || typeof S === 'undefined' || !S.blocks) { toast(t('ai_no_json')); return; }
    _lastJSON = {
      blocks: S.blocks.map(function(b){ return JSON.parse(JSON.stringify(b)); }),
      conns: S.conns.slice(), scenarios: (S.scenarios||[]).slice(), meta: S.meta || {}
    };
    var noSchema = dbBlocksNoSchema(_lastJSON);
    if (!noSchema.length){ addMsg('assistant', 'Все БД уже описаны.'); return; }
    addMsg('assistant', 'Заполняю схемы БД: ' + noSchema.length + ' шт…');
    fillDbStage(noSchema, true);
  };

  // ════════════════ ИМПОРТ DRAW.IO ════════════════
  function isDrawioXML(t){ return /<mxGraphModel[\s>]|<mxfile[\s>]/.test(t); }

  function stripHtml(s){
    return String(s||'')
      .replace(/<\/(div|p|li)>/gi,'\n').replace(/<(div|p)[^>]*>/gi,'\n').replace(/<br\s*\/?>/gi,'\n').replace(/<li[^>]*>/gi,'\n• ')
      .replace(/<[^>]+>/g,'')
      .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
      .replace(/[ \t]+\n/g,'\n').replace(/\n{2,}/g,'\n').trim();
  }

  // C4-тип + стиль/имя → тип блока RAPTOR
  function c4ToType(c4type, style, name){
    var s = (style||'').toLowerCase(), n = (name||'').toLowerCase();
    if (/person/.test(c4type) || /person2|umlactor/.test(s)) return 'actor';
    if (/software system/i.test(c4type)) return 'external';
    // очередь/шина — проверяем ПЕРЕД цилиндром (Kafka часто рисуют цилиндром)
    if (/kafka|rabbit\w*mq|\bnats\b|message bus|очеред|брокер|шина событ|event bus/.test(n)) return 'kafka';
    if (/\bredis\b|\bcache\b|кэш|кеш/.test(n)) return 'redis';
    if (/elastic|\bsearch\b|поиск/.test(n)) return 'elasticsearch';
    if (/cylinder|mxgraph\.flowchart\.database|shape=datastore/.test(s) || /\b(db|database|бд|oracle|postgres\w*|mysql|mongo\w*|хранилищ|база данных)\b/.test(n)) return 'postgresql';
    if (/webbrowsercontainer|shape=mxgraph\.c4\.web/.test(s) || /\b(браузер|web app|веб-прилож|spa|frontend|фронтенд)\b/.test(n)) return 'web_client';
    if (/hexagon/.test(s) || /\b(api\s*gateway|gateway|шлюз|ingress|bff)\b/.test(n)) return 'api_gw';
    if (/\bauth\b|авторизац|identity|iam\b/.test(n)) return 'auth';
    return 'service';
  }

  // draw.io C4 XML → ГОТОВАЯ схема RAPTOR (детерминированно, без LLM). Ничего не теряем, мгновенно.
  function drawioToRaptor(xml){
    var doc;
    try { doc = new DOMParser().parseFromString(xml, 'application/xml'); }
    catch(e){ return null; }
    if (!doc || doc.querySelector('parsererror')) return null;

    var byXid = {};      // xmlId → node
    var notes = [], rawEdges = [];
    var uniq = function(a){ return a.filter(function(v,i){ return a.indexOf(v)===i; }); };

    // 1. C4-объекты
    Array.prototype.forEach.call(doc.querySelectorAll('object'), function(o){
      var id = o.getAttribute('id'); if (!id) return;
      var name = o.getAttribute('c4Name') || o.getAttribute('label') || '';
      var c4type = o.getAttribute('c4Type') || '';
      var tech = o.getAttribute('c4Technology') || '';
      var desc = o.getAttribute('c4Description') || '';
      var cell = o.querySelector('mxCell');
      var style = cell ? (cell.getAttribute('style')||'') : '';
      if (!name || /^%c4Name%$/.test(name) || /placeholder|e\.g\./i.test(name)) return;
      byXid[id] = { name:name, type:c4ToType(c4type, style, name+' '+tech),
                    tech:/e\.g\.|%c4/i.test(tech)?'':tech, desc:/description of|%c4/i.test(desc)?'':desc };
    });

    // 2. Простые фигуры и заметки
    Array.prototype.forEach.call(doc.querySelectorAll('mxCell[vertex="1"]'), function(c){
      var id = c.getAttribute('id');
      var val = stripHtml(c.getAttribute('value'));
      var style = (c.getAttribute('style')||'').toLowerCase();
      if (!val || byXid[id]) return;
      if (/(^|;)text;|strokecolor=none;\s*fillcolor=none/.test(style)){
        if (val.length > 2) notes.push(val);
      } else if (id) {
        var first = val.split('\n')[0].slice(0,48);
        byXid[id] = { name:first, type:c4ToType('', style, val), tech:'', desc: val.length>48?val:'' };
      }
    });

    // 3. Рёбра
    Array.prototype.forEach.call(doc.querySelectorAll('mxCell[edge="1"]'), function(c){
      var s = c.getAttribute('source'), t2 = c.getAttribute('target');
      if (s && t2 && byXid[s] && byXid[t2]) rawEdges.push([s, t2]);
    });

    var nodesArr = Object.keys(byXid).map(function(k){ return { xid:k, n:byXid[k] }; });
    if (!nodesArr.length) return null;

    // 4. Раскладываем по колонкам, назначаем b-id
    var COL = { actor:-120, web_client:120, api_gw:340, auth:340, service:600, kafka:840, external:1240,
                postgresql:1060, redis:1060, elasticsearch:1060, mysql:1060, mongodb:1060 };
    var yCol = {}, blocks = [], bidByXid = {}, n = 1;
    function place(type, name, extra){
      var id = 'b'+(n++), x = COL[type]!=null?COL[type]:600;
      yCol[x] = (yCol[x]||0) + 1;
      var b = { id:id, type:type, customLabel:name, x:x, y:60+(yCol[x]-1)*150, patterns:[], settings:{} };
      if (extra) Object.assign(b, extra);
      blocks.push(b); return b;
    }

    nodesArr.forEach(function(o){
      // db из диаграммы обработаем отдельно
      if (/postgresql|mysql|mongodb|redis|elasticsearch/.test(o.n.type)) return;
      var b = place(o.n.type, o.n.name, o.n.desc ? {settings:{note:o.n.desc.slice(0,200)}} : null);
      bidByXid[o.xid] = b.id;
    });

    // 5. Гарантируем инфраструктуру
    var byType = function(tp){ return blocks.filter(function(b){ return b.type===tp; }); };
    var web = byType('web_client')[0] || place('web_client', 'Веб-приложение');
    var gw  = byType('api_gw')[0]     || place('api_gw', 'API Gateway');
    var actors = byType('actor');
    if (!actors.length) actors = [ place('actor', 'Пользователь') ];
    var services = byType('service');
    var auth = byType('auth')[0] || null;
    var kafka = byType('kafka')[0] || null;

    // 6. Связи
    var conns = [], seen = {}, cn = 1;
    function link(from, to){
      if (!from || !to || from===to) return;
      var k = from+'>'+to; if (seen[k]) return; seen[k]=1;
      conns.push({ id:'c'+(cn++), from:from, to:to });
    }
    actors.forEach(function(a){ link(a.id, web.id); });
    link(web.id, gw.id);
    if (auth) link(gw.id, auth.id);
    services.forEach(function(s){ link(gw.id, s.id); });

    // рёбра диаграммы между сервисами / к внешним / к kafka
    rawEdges.forEach(function(e){
      var f = bidByXid[e[0]], tb = bidByXid[e[1]];
      if (!f || !tb) return;
      var bf = blocks.find(function(b){ return b.id===f; }), bt = blocks.find(function(b){ return b.id===tb; });
      if (!bf || !bt) return;
      if (bf.type==='actor' || bt.type==='actor') return;      // актор-связи уже сделаны через web
      if (bt.type==='web_client' || bt.type==='api_gw') return; // входящие в инфру уже есть
      link(f, tb);
    });

    // 7. Каждому сервису — своя БД
    var svcDb = {};
    services.forEach(function(s){
      var db = place('postgresql', s.customLabel.replace(/\s*(service|сервис)\s*$/i,'').trim() + ' DB');
      link(s.id, db.id);
      svcDb[s.id] = db.id;
    });

    // 8. Сценарии — happy-path на первые сервисы
    var colors = ['#7aa2f7','#9ece6a','#e0af68','#f7768e','#bb9af7'];
    var scenarios = services.slice(0, 4).map(function(s, i){
      var db = svcDb[s.id];
      var path = [actors[0].id, web.id, gw.id, s.id].concat(db ? [db] : []);
      var short = s.customLabel.replace(/\s*(service|сервис)\s*$/i,'').trim();
      var steps = [
        { name:'Открывает '+short, verb:'', uri:'', resp:'', cache:null, dbTarget:null },
        { name:short, verb:'GET', uri:'/api/v1/'+(short.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'res'), resp:'200 {data}', cache:null, dbTarget:null },
        { name:'Маршрутизирует', verb:'GET', uri:'/'+(short.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'res'), resp:'200', cache:null, dbTarget:null },
        { name:'Обрабатывает', verb:'GET', uri:'/'+(short.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'res'), resp:'200 {data}', cache:null, dbTarget:null }
      ];
      if (db) steps.push({ name:'Читать данные', verb:'SELECT', uri:short.toLowerCase().replace(/[^a-z0-9]+/g,'_')||'rows', resp:'rows', cache:null, dbTarget:null });
      return { id:'sc'+(i+1), name:short, color:colors[i%colors.length], actorId:actors[0].id, volume:50, visible:true, path:path, steps:steps };
    });

    // 9. meta
    var title = notes.find(function(x){ return x.length<70 && /систем|платформ|сервис|приложен/i.test(x) && !/\n/.test(x); });
    var meta = {
      systemName: (title || 'Импорт из draw.io').slice(0,80),
      version: 'v1', author:'', domain:'',
      description: uniq(notes).join('\n').slice(0,2000),
      problem:'', solution:'',
      userRoles: actors.map(function(a){ return a.customLabel; }),
      requirements: uniq(notes)
    };

    return { blocks:blocks, conns:conns, scenarios:scenarios, meta:meta,
             _summary: { actors:actors.length, services:services.length, dbs:byType('postgresql').length,
                         ext:byType('external').length, conns:conns.length, notes:uniq(notes).length,
                         kafka:!!kafka, auth:!!auth } };
  }

  // ════════════════ ОТПРАВКА ════════════════
  function send(){
    var text = (input?input.value:'').trim();
    if (!text) return;
    if (P().needKey && !apiKey){ AI.promptKey(function(){ send(); }); return; }

    // draw.io XML → детерминированный импорт БЕЗ LLM (мгновенно, без потерь)
    if (isDrawioXML(text)){
      if (input) input.value='';
      addMsg('user', '📥 Импорт схемы из draw.io');
      var imp = drawioToRaptor(text);
      if (imp && imp.blocks && imp.blocks.length){
        _lastJSON = { blocks:imp.blocks, conns:imp.conns, scenarios:imp.scenarios, meta:imp.meta };
        var sm = imp._summary;
        AI.loadJSON(_lastJSON);
        _patchNext = false;
        addMsg('assistant',
          '✅ Импортировано из draw.io (без потерь, мгновенно):\n' +
          '• акторы: ' + sm.actors + '\n• сервисы: ' + sm.services + ' (каждому создана БД)\n' +
          '• связи: ' + sm.conns + (sm.auth?'\n• auth-сервис':'') + (sm.kafka?'\n• kafka':'') + '\n' +
          '• требования с диаграммы → в описание проекта (' + sm.notes + ' пунктов)\n\n' +
          'Схемы БД пустые. Нажми «Заполнить БД» или напиши: **опиши БД всех сервисов**.\n' +
          '```json\n' + JSON.stringify(_lastJSON) + '\n```');
      } else {
        addMsg('assistant', 'Не смог разобрать draw.io XML — нет C4-объектов. Опиши систему словами.');
      }
      return;
    }
    addMsg('user', text);
    if (input) input.value='';

    // PATCH
    if (detectPatch(text)){
      var isAdd = detectPatchAdd(text) && !detectPatchDB(text);
      // «опиши БД» + много пустых БД на канве → пакетное заполнение по одной
      if (!isAdd && detectPatchDB(text)){
        var ctxNow = getContext();
        var emptyDbs = ctxNow ? (ctxNow.blocks||[]).filter(function(b){
          return SQL_DB_TYPES.indexOf(b.type)>=0 && !(b.existing_tables && b.existing_tables.length);
        }) : [];
        if (emptyDbs.length >= 2){ chatHistory.push({role:'user',content:text}); AI.fillDB(); return; }
      }
      var sys   = isAdd ? buildPatchAdd() : buildPatchDB();
      if (sys){
        busy(true, isAdd?'✦ '+t('ai_adding'):'✦ '+t('ai_filling_db'));
        rawCall([{role:'system',content:sys},{role:'user',content:text}], P().kind==='ollama'?3500:6000, true, busyProgress)
          .then(function(content){ busy(false); _patchNext=true; addMsg('assistant', content); })
          .catch(function(e){ busy(false); addMsg('assistant',t('ai_error_prefix')+e.message); });
        return;
      }
    }

    // GEN / CHAT
    var isGen = detectGen(text);
    var isConfirm = startsConfirm(text) && planPending();
    chatHistory.push({role:'user', content:text});
    busy(true, isGen?'✦ '+t('ai_generating'):'✦ '+t('ai_thinking'));
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
    var local = P().kind === 'ollama';
    // Всегда 2 стадии: топология (быстро) → схемы БД (для Claude — параллельно). Ускоряет в 2-3 раза.
    var sysPrompt = isGen ? (local ? buildGenLite() : buildGen(true)) : buildChat();
    var messages = [{role:'system', content:sysPrompt}].concat(history);

    // В режиме обсуждения (не JSON) — стримим текст живьём в отдельный пузырь
    var lb = (!isGen) ? liveBubble() : null;
    var onDelta = function(f){ busyProgress(f); if (lb) lb.set(f); };

    rawCall(messages, isGen ? (local?4000:16000) : 2500, isGen, onDelta)
      .then(function(content){
        if (lb) lb.remove();
        chatHistory.push({role:'assistant', content:content});
        busy(false);
        addMsg('assistant', content);
        if (isGen && _lastJSON){
          chatHistory = [];
          var noSchema = dbBlocksNoSchema(_lastJSON);
          if (noSchema.length){
            if (P().kind !== 'ollama'){
              // Claude: показываем топологию сразу, схемы БД добираем параллельно с применением
              AI.loadJSON(_lastJSON);
              fillDbStage(noSchema, true);
            } else {
              fillSchemasStaged(noSchema, {});
            }
          } else {
            var bad = poorSchemas(_lastJSON);
            if (bad.length){
              addMsg('assistant',t('ai_enriching_msg'));
              busy(true,t('ai_enriching_status'));
              rawCall([{role:'system',content:buildGen()},{role:'user',content:
                'Схемы БД бедные:\n'+bad.join('\n')+'\nДобавь минимум 8 полей в каждую таблицу. Верни ТОЛЬКО полный ```json блок со всей схемой.'}], 6000, true, busyProgress)
                .then(function(c2){ busy(false); addMsg('assistant', c2); })
                .catch(function(e){ busy(false); addMsg('assistant',t('ai_error_prefix')+e.message); });
            }
          }
        }
      })
      .catch(function(e){ if (lb) lb.remove(); busy(false); addMsg('assistant',t('ai_error_prefix')+e.message); });
  }

  // Живой пузырь для стриминга ответа (обсуждение)
  function liveBubble(){
    if (!msgs) return null;
    var wrap = document.createElement('div'); wrap.className = 'ai-msg ai-msg-assistant';
    var inner = document.createElement('div');
    var bubble = document.createElement('div'); bubble.className = 'ai-bubble';
    bubble.innerHTML = '<span style="opacity:.5">▋</span>';
    inner.appendChild(bubble); wrap.appendChild(inner); msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
    return {
      set: function(txt){
        // во время стрима закрываем незавершённый ``` блок, чтобы md() отрендерил его
        if (((txt.match(/```/g)||[]).length % 2)) txt += '\n```';
        bubble.innerHTML = md(txt) + '<span style="opacity:.5">▋</span>'; msgs.scrollTop = msgs.scrollHeight;
      },
      remove: function(){ wrap.remove(); }
    };
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

    var display = jd ? (text.replace(/```(?:json)?[\s\S]*?```/g,'').trim() || t('ai_schema_generated')) : text;
    bubble.innerHTML = md(display);

    if (jd){
      var isPatch = _patchNext; _patchNext = false;
      var bw = document.createElement('div'); bw.style.cssText='margin-top:8px;display:flex;gap:4px';
      var bMerge = document.createElement('button');
      bMerge.textContent = isPatch?t('ai_merge'):t('ai_add');
      bMerge.style.cssText='flex:1;padding:7px 4px;background:#2a6010;color:#fff;border:none;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;border-radius:4px';
      bMerge.onclick = (function(j){ return function(){ AI.mergeJSON(j); }; })(jd);
      bw.appendChild(bMerge);
      if (!isPatch){
        var bRepl = document.createElement('button');
        bRepl.textContent=t('ai_replace');
        bRepl.style.cssText='flex:0 0 80px;padding:7px 4px;background:#7a3010;color:#fff;border:none;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;border-radius:4px';
        bRepl.onclick = (function(j){ return function(){ AI.loadJSON(j); }; })(jd);
        bw.appendChild(bRepl);
      }
      bubble.appendChild(bw);
    }

    var time = document.createElement('div'); time.className='ai-time';
    var d=new Date(); time.textContent=('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
    if (role==='assistant'){
      var cp = document.createElement('button'); cp.textContent='⎘'; cp.title=t('ai_copy_title');
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
  var KEY_HINT = { apinet:'sk-… (apinet.cloud) — вшит, можно оставить пустым', anthropic:'sk-ant-… (console.anthropic.com)', groq:'gsk_… (console.groq.com)', ollama:'ключ не нужен' };
  AI.promptKey = function(cb){
    _keyCb = cb||null;
    var f=document.getElementById('ai-key-form'), ki=document.getElementById('ai-key-input');
    var lbl=document.querySelector('#ai-key-form [data-i18n="ai_key_label"], #ai-key-form span');
    if(lbl) lbl.textContent = (P().label||PROVIDER) + ' API ключ: ' + (KEY_HINT[PROVIDER]||'');
    if(f) f.style.display='block';
    if(ki){ ki.placeholder = (KEY_HINT[PROVIDER]||''); ki.value=apiKey||''; setTimeout(function(){ ki.focus(); ki.select(); },50); ki.onkeydown=function(e){ if(e.key==='Enter') AI.saveKey(); }; }
  };
  AI.saveKey = function(){
    var ki=document.getElementById('ai-key-input'), key=ki?ki.value.trim():'';
    if(key.length<10){ addMsg('assistant',t('ai_key_too_short')); return; }
    apiKey=key;
    localStorage.setItem(keyStoreName(), apiKey);      // ключ per-провайдер
    localStorage.setItem('raptor_ai_key', apiKey);     // совместимость
    AI.hideKeyForm();
    addMsg('assistant', t('ai_key_saved') + ' (' + (P().label||PROVIDER) + ')');
    if(_keyCb){ var cb=_keyCb; _keyCb=null; cb(); }
  };
  AI.hideKeyForm = function(){ var f=document.getElementById('ai-key-form'); if(f) f.style.display='none'; };

  // ════════════════ УТИЛИТЫ ════════════════
  var _busyBase = '', _busyT0 = 0, _busyTimer = null, _busyChars = 0;
  function _busyRender(){
    var sec = Math.round((Date.now()-_busyT0)/1000);
    setTypingText(_busyBase + ' · ' + sec + 'с' + (_busyChars ? ' · ' + _busyChars + ' симв.' : ''));
  }
  function busy(v, txt){
    setDisabled(v); setStatus(v?t('ai_thinking'):t('ai_status_ready')); showTyping(v);
    if (_busyTimer){ clearInterval(_busyTimer); _busyTimer = null; }
    if (v){
      _busyBase = txt || ('✦ '+t('ai_thinking'));
      _busyT0 = Date.now(); _busyChars = 0;
      _busyRender();
      _busyTimer = setInterval(_busyRender, 1000);
    }
  }
  // прогресс стрима — вызывается из rawCall onDelta
  function busyProgress(fullText){
    _busyChars = (fullText || '').length;
    _busyRender();
  }
  function setDisabled(v){ if(input) input.disabled=v; if(sendBtn) sendBtn.disabled=v; }
  function setStatus(s){ if(!statusEl) return; statusEl.textContent='● '+s; statusEl.style.color=s===t('ai_status_ready')?'#2a6010':'#7a5008'; }
  function showTyping(v){ if(typingEl){ typingEl.style.display=v?'block':'none'; if(!v) setTypingText('✦ '+t('ai_thinking')); } if(v&&msgs) msgs.scrollTop=msgs.scrollHeight; }
  function setTypingText(t){ if(typingEl){ var s=typingEl.querySelector('span'); if(s) s.textContent=t; } }

  function esc(x){ return x.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function mdCodeToken(i){ return 'ZxCODEBLOCKz' + i + 'zZ'; }
  function md(s){
    var codes = [];
    s = s.replace(/```([^\n`]*)\n?([\s\S]*?)```/g, function(_, lang, code){
      codes.push(code.replace(/\s+$/,''));
      return mdCodeToken(codes.length - 1);
    });
    s = esc(s);
    s = s.replace(/(?:^\|.*\|[ \t]*\n?)+/gm, function(block){
      var rows = block.trim().split('\n').filter(function(r){ return !/^\|[\s:|-]+\|$/.test(r.trim()); });
      if (rows.length < 2) return block;
      var html = rows.map(function(r,i){
        var tag = i===0?'th':'td';
        return '<tr>' + r.trim().replace(/^\||\|$/g,'').split('|').map(function(c){
          return '<'+tag+' style="border:1px solid var(--brd2);padding:2px 6px;text-align:left">'+c.trim()+'</'+tag+'>';
        }).join('') + '</tr>';
      }).join('');
      return '<table style="border-collapse:collapse;margin:4px 0;font-size:10px">'+html+'</table>';
    });
    s = s.replace(/^\s{0,3}#{4,}\s+(.+)$/gm,'<div style="font-weight:700;font-size:11.5px;color:var(--blue);margin-top:6px">$1</div>');
    s = s.replace(/^\s{0,3}###\s+(.+)$/gm,'<div style="font-weight:700;font-size:12px;color:var(--blue);margin-top:8px">$1</div>');
    s = s.replace(/^\s{0,3}##\s+(.+)$/gm,'<div style="font-weight:700;font-size:13px;color:var(--txt);margin-top:10px">$1</div>');
    s = s.replace(/^\s{0,3}#\s+(.+)$/gm,'<div style="font-weight:700;font-size:14px;color:var(--txt);margin-top:10px">$1</div>');
    s = s.replace(/^\s*([-*_]\s?){3,}\s*$/gm,'<hr style="border:none;border-top:1px solid var(--brd2);margin:8px 0">');
    s = s.replace(/\*\*([^\n*]+)\*\*/g,'<b>$1</b>');
    s = s.replace(/`([^`\n]+)`/g,'<code style="background:var(--bg3);padding:1px 4px;border-radius:3px;font-family:Consolas,monospace;font-size:10.5px">$1</code>');
    s = s.replace(/^([ \t]*)([•‣◦\-\*]|\d+[.)])[ \t]+(.+)$/gm, function(_, ind, mark, txt){
      var lvl = Math.min(3, Math.floor(ind.replace(/\t/g,'  ').length / 2));
      var bullet = /\d/.test(mark) ? mark.replace(')','.') + ' ' : '•&nbsp;';
      return '<div style="margin-left:'+(6+lvl*16)+'px;text-indent:-12px;padding-left:12px">'+bullet+txt+'</div>';
    });
    s = s.replace(/ZxCODEBLOCKz(\d+)zZ/g, function(_, i){
      return '<pre style="background:var(--bg1);border:1px solid var(--brd2);border-radius:4px;padding:6px 8px;margin:4px 0;overflow-x:auto;font-family:Consolas,monospace;font-size:10px;line-height:1.5;white-space:pre">'+esc(codes[i])+'</pre>';
    });
    s = s.replace(/\n{2,}/g,'<div style="height:7px"></div>');
    s = s.replace(/\n/g,'<br>');
    s = s.replace(/<br>\s*(<(?:div|pre|table|hr))/g,'$1').replace(/(<\/(?:div|pre|table)>|<hr[^>]*>)\s*<br>/g,'$1');
    return s;
  }
  function _mdOLD(s){ return md(s);
    var codes = [];
    s = s.replace(/```([^\n`]*)\n?([\s\S]*?)```/g, function(_, lang, code){
      codes.push(code.replace(/\s+$/,''));
      return 'C'+(codes.length-1)+'';
    });
    s = esc(s);
    // 2. таблицы  | a | b |
    s = s.replace(/(?:^\|.*\|[ \t]*\n?)+/gm, function(block){
      var rows = block.trim().split('\n').filter(function(r){ return !/^\|[\s:|-]+\|$/.test(r.trim()); });
      if (rows.length < 2) return block;
      var html = rows.map(function(r,i){
        var tag = i===0?'th':'td';
        var tds = r.trim().replace(/^\||\|$/g,'').split('|').map(function(c){
          return '<'+tag+' style="border:1px solid var(--brd2);padding:2px 6px;text-align:left">'+c.trim()+'</'+tag+'>';
        }).join('');
        return '<tr>'+tds+'</tr>';
      }).join('');
      return '<table style="border-collapse:collapse;margin:4px 0;font-size:10px">'+html+'</table>';
    });
    // 3. заголовки и разделители
    s = s.replace(/^\s{0,3}#{4,}\s+(.+)$/gm,'<div style="font-weight:700;font-size:11.5px;color:var(--blue);margin-top:6px">$1</div>');
    s = s.replace(/^\s{0,3}###\s+(.+)$/gm,'<div style="font-weight:700;font-size:12px;color:var(--blue);margin-top:8px">$1</div>');
    s = s.replace(/^\s{0,3}##\s+(.+)$/gm,'<div style="font-weight:700;font-size:13px;color:var(--txt);margin-top:10px">$1</div>');
    s = s.replace(/^\s{0,3}#\s+(.+)$/gm,'<div style="font-weight:700;font-size:14px;color:var(--txt);margin-top:10px">$1</div>');
    s = s.replace(/^\s*([-*_]){3,}\s*$/gm,'<hr style="border:none;border-top:1px solid var(--brd2);margin:8px 0">');
    // 4. инлайн: bold, `code`
    s = s.replace(/\*\*([^\n*]+)\*\*/g,'<b>$1</b>');
    s = s.replace(/`([^`\n]+)`/g,'<code style="background:var(--bg3);padding:1px 4px;border-radius:3px;font-family:Consolas,monospace;font-size:10.5px">$1</code>');
    // 5. списки с учётом вложенности; нумерованные — сохраняем номер
    s = s.replace(/^(\s*)([••\-\*]|\d+[.)])\s+(.+)$/gm, function(_, ind, mark, txt){
      var lvl = Math.min(3, Math.floor((ind||'').replace(/\t/g,'  ').length/2));
      var b = /\d/.test(mark) ? mark.replace(/\)/,'.')+' ' : '•&nbsp;';
      return '<div style="margin-left:'+(6+lvl*16)+'px;text-indent:-12px;padding-left:12px">'+b+txt+'</div>';
    });
    // 6. возвращаем код
    s = s.replace(/C(\d+)/g, function(_, i){
      return '<pre style="background:var(--bg1);border:1px solid var(--brd2);border-radius:4px;padding:6px 8px;margin:4px 0;overflow-x:auto;font-family:Consolas,monospace;font-size:10px;line-height:1.5;white-space:pre">'+esc(codes[i])+'</pre>';
    });
    // 7. переносы строк (не приклеиваем <br> к блочным тегам)
    s = s.replace(/\n{2,}/g,'<div style="height:7px"></div>');
    s = s.replace(/\n/g,'<br>');
    s = s.replace(/<br>\s*(<(?:div|pre|table|hr))/g,'$1').replace(/(<\/(?:div|pre|table)>|<hr[^>]*>)\s*<br>/g,'$1');
    return s;
  }

  function init(){
    msgs    =document.getElementById('ai-msgs');
    input   =document.getElementById('ai-input');
    sendBtn =document.getElementById('ai-send');
    statusEl=document.getElementById('ai-status');
    typingEl=document.getElementById('ai-typing');
    apiKey  = resolveKey();
    var savedModel = localStorage.getItem('raptor_ai_model_'+PROVIDER);
    if (savedModel) P().model = savedModel;
    syncLabel();
    if(input) input.addEventListener('keydown',function(e){ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send(); } });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&isOpen) AI.close(); });
  }
  document.addEventListener('DOMContentLoaded', init);
})();

function toggleAI(){ AI.toggle(); }
