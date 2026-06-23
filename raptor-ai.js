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
    if (/^(да|давай|ок|го|генерируй|yes|ok|погнали|вперёд|вперед|generate|жги|поехали|конечно|делай)\b/i.test(t)){
      var last = chatHistory.slice().reverse().find(function(m){ return m.role==='assistant'; });
      if (last && last.content && last.content.length > 80) return true;
    }
    if (/сгенерируй|генерируй|generate|создай систему|разработай|спроектируй/i.test(t)) return true;
    if (/сделай.{0,20}(систем|всё|все|сразу|json|схем)|всю систем|пришли.{0,10}(json|схем)|сделай всё/i.test(t)) return true;
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
    'CRITICAL: steps.length MUST EQUAL path.length. One step describes the action AT path[i].\n' +
    'path = ["b1","b2","b3","b4","b8"]  → steps has EXACTLY 5 items, step[i] is what happens when arriving at path[i].\n' +
    'NEVER pad with duplicate steps to match the count. NEVER repeat the same INSERT twice. If counts would differ, FIX the path, not the steps.\n' +
    'Per-node verbs:\n' +
    '- actor (path[0]): verb="", uri="", name="Открывает ...".\n' +
    '- web_client→api_gw: verb=POST/GET/PUT/DELETE, uri="/api/v1/resource", resp="201 {id}" | "200 {data}" | "204".\n' +
    '- api_gw→service: same verb, short uri="/resource".\n' +
    '- service→postgresql: verb=INSERT/SELECT/UPDATE/DELETE, uri="table_name", resp="uuid X" | "rows".\n' +
    '- service→kafka: verb="PUBLISH", uri="topic.event_name", resp="".\n' +
    '- kafka→service (consumer): verb="CONSUME", uri="topic.event_name", resp="".\n' +
    '- service→external: verb=POST, uri="/external/endpoint", resp="200".\n' +
    'NEVER add a "uml" field to scenarios — RAPTOR generates UML itself.\n';

  var DB_RULES =
    '═══ DB SCHEMA — MANDATORY ═══\n' +
    '- EVERY db block has dbSchema with 2+ tables (main + detail/log/history).\n' +
    '- EVERY table has 8+ fields. NO generic name/description/status — use DOMAIN-SPECIFIC fields.\n' +
    '- Required in each table: id UUID PK (default gen_random_uuid()), created_at + updated_at TIMESTAMPTZ NN (default NOW()).\n' +
    '- FK field MUST carry the fk object: {"name":"order_id","type":"UUID","constraints":"NN, FK","desc":"...","example":"550e8400","fk":{"table":"orders","field":"id"}}.\n' +
    '- Indexes on every FK column and on status/type/date filter columns.\n' +
    '- Domain examples: goals→deadline/target_value/category; habits→frequency/current_streak/reminder_time;\n' +
    '  tracking→tracked_date/completion_pct/mood; payments→amount/currency/gateway_tx_id; users→email/password_hash/salt/last_login_at.\n' +
    '- Each service schema reflects its OWN domain. NEVER copy the same fields across services.\n';

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
      '5. Закончи строкой: "Генерировать JSON?"\n\n' +
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
      '═══ PATTERNS ═══\n' +
      'service with external calls: ["retry","timeout"]; high load: ["circuit_breaker"]; api_gw: ["rate_limit"]; kafka consumers: ["retry"].\n\n' +
      '═══ MINIMAL FORMAT EXAMPLE (note steps.length === path.length) ═══\n' +
      '```json\n' +
      '{"blocks":[\n' +
      '  {"id":"b1","type":"actor","customLabel":"Покупатель","x":-100,"y":60,"patterns":[],"settings":{}},\n' +
      '  {"id":"b2","type":"web_client","customLabel":"Веб-приложение","x":100,"y":60,"patterns":[],"settings":{}},\n' +
      '  {"id":"b3","type":"api_gw","customLabel":"API Gateway","x":320,"y":60,"patterns":["rate_limit"],"settings":{}},\n' +
      '  {"id":"b4","type":"service","customLabel":"Заказы","x":540,"y":60,"patterns":["retry","timeout"],"settings":{}},\n' +
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
      '"conns":[{"id":"c1","from":"b1","to":"b2"},{"id":"c2","from":"b2","to":"b3"},{"id":"c3","from":"b3","to":"b4"},{"id":"c4","from":"b4","to":"b8"}],\n' +
      '"scenarios":[{"id":"sc1","name":"Оформить заказ","color":"#7aa2f7","actorId":"b1","volume":100,"visible":true,\n' +
      '  "path":["b1","b2","b3","b4","b8"],\n' +
      '  "steps":[\n' +
      '    {"name":"Открывает корзину","verb":"","uri":"","resp":"","cache":null,"dbTarget":null},\n' +
      '    {"name":"Оформить заказ","verb":"POST","uri":"/api/v1/orders","resp":"201 {orderId}","cache":null,"dbTarget":null},\n' +
      '    {"name":"Маршрутизирует","verb":"POST","uri":"/orders","resp":"201","cache":null,"dbTarget":null},\n' +
      '    {"name":"Создать заказ","verb":"POST","uri":"/orders","resp":"201 {orderId}","cache":null,"dbTarget":null},\n' +
      '    {"name":"Сохранить заказ","verb":"INSERT","uri":"orders","resp":"uuid заказа","cache":null,"dbTarget":null}\n' +
      '  ]}],\n' +
      '"meta":{"systemName":"Зоомагазин","description":"Микросервисная система","domain":"e-commerce","problem":"","solution":""}}\n' +
      '```\n\n' +
      'CHECKLIST before output:\n' +
      '[ ] every service has its own DB block\n' +
      '[ ] every DB has 2+ tables, 8+ fields each, FK objects present\n' +
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
      '```json\n{"blocks":[{"id":"b'+n+'","type":"service","customLabel":"Имя","x":540,"y":380,"patterns":["retry"],"settings":{}}],"conns":[{"id":"cn1","from":"b3","to":"b'+n+'"}]}\n```';
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
    return r;
  }
  function normConns(raw, blocks, prefix){
    raw = raw||[];
    if (raw.length && typeof raw[0]==='string'){
      var idx = {}; blocks.forEach(function(b){ idx[b.customLabel]=b.id; });
      return raw.map(function(s,i){ var p=s.split('>>'); return {id:prefix+i, from:idx[p[0]&&p[0].trim()]||p[0], to:idx[p[1]&&p[1].trim()]||p[1]}; });
    }
    return raw.map(function(c,i){ return {id:c.id||(prefix+i), from:c.from||c.source||c.src, to:c.to||c.target||c.dst}; });
  }
  // Гарантия steps.length === path.length (на случай если AI всё же ошибся)
  function fixScenarios(scs){
    return (scs||[]).map(function(s){
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

  // ════════════════ ЗАГРУЗКА / МЁРЖ ════════════════
  AI.loadJSON = function(data){
    data = unwrapData(data || _lastJSON);
    if (!data){ toast('❌ Нет JSON — сначала сгенерируй схему'); return; }
    if (data.blocks) data.blocks = data.blocks.map(function(b,i){ return normBlock(b,i,60); });
    if (!data.blocks || !data.blocks.length){
      toast('❌ Не найдены блоки. Ключи: '+Object.keys(_lastJSON||{}).join(', ')); return;
    }
    S.blocks    = data.blocks.map(function(b){ return Object.assign({patterns:[],settings:{}}, b); });
    S.conns     = normConns(data.conns||data.connections||data.edges||data.links, data.blocks, 'c');
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

    var added=0, updated=0;
    data.blocks.forEach(function(nb){
      var idx = S.blocks.findIndex(function(sb){ return sb.id===nb.id; });
      if (idx>=0){ S.blocks[idx] = Object.assign({patterns:[],settings:{}}, nb); updated++; }
      else        { S.blocks.push(Object.assign({patterns:[],settings:{}}, nb)); added++; }
    });

    var raw = normConns(data.conns||data.connections||data.edges||data.links, S.blocks, 'cm'+Date.now()+'_');
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
        rawCall([{role:'system',content:sys},{role:'user',content:text}], 7000)
          .then(function(content){ busy(false); _patchNext=true; addMsg('assistant', content); })
          .catch(function(e){ busy(false); addMsg('assistant','Ошибка: '+e.message); });
        return;
      }
    }

    // GEN / CHAT
    var isGen = detectGen(text);
    chatHistory.push({role:'user', content:text});
    busy(true, isGen?'✦ генерирую схему...':'✦ думает...');
    var history  = isGen ? chatHistory.slice(-3) : chatHistory.slice(-10);
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
              'Схемы БД бедные:\n'+bad.join('\n')+'\nДобавь минимум 8 полей в каждую таблицу. Верни ТОЛЬКО полный ```json блок со всей схемой.'}], 7000)
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
