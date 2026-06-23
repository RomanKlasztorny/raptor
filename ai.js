// DeepSeek API — прямой вызов из браузера (ключ хранится в localStorage)
var RAPTOR_KEY = null;

var AI = (function () {
  var msgs, input, sendBtn, statusEl, typingEl;
  var chatHistory = []; // OpenAI format: [{role, content, tool_calls?, tool_call_id?}]
  var isOpen = false;
  var apiKey = null;

  var MODEL = 'llama-3.3-70b-versatile';
  var API_URL = 'https://api.groq.com/openai/v1/chat/completions';

  // ── Инструменты (OpenAI function calling format) ────────────────
  var TOOLS = [
    {
      type: 'function',
      function: {
        name: 'add_service',
        description: 'Добавить блок на схему (сервис, БД, клиент, брокер, шлюз).',
        parameters: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['service','bff','auth','api_gw','websocket_gw','lb','cdn',
                     'web_client','mob_client','actor','external',
                     'postgresql','mysql','mongodb','redis','cassandra',
                     'clickhouse','elasticsearch','s3',
                     'kafka','rabbitmq','nats','queue'],
              description: 'Тип блока'
            },
            name: { type: 'string', description: 'Название блока' },
            x: { type: 'number', description: 'Позиция X (необязательно)' },
            y: { type: 'number', description: 'Позиция Y (необязательно)' }
          },
          required: ['type', 'name']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'add_connection',
        description: 'Добавить стрелку между двумя блоками. Имена должны точно совпадать с add_service.',
        parameters: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Имя блока-источника' },
            to:   { type: 'string', description: 'Имя блока-получателя' }
          },
          required: ['from', 'to']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'create_scenario',
        description: 'Создать сценарий (линию/полосу) — главный артефакт RAPTOR, генерирует UML Sequence. Создавай для каждого use-case и КАЖДОГО актора.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Название сценария (use-case), например "Авторизация пользователя"' },
            path: {
              type: 'array',
              items: { type: 'string' },
              description: 'Имена блоков в порядке запроса. ПЕРВЫЙ элемент — обязательно актор/клиент (web_client, mob_client, actor). Пример: ["Пользователь","API Gateway","Auth","PostgreSQL"]'
            },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Бизнес-описание шага' },
                  verb: { type: 'string', description: 'GET/POST/PUT/DELETE' },
                  uri:  { type: 'string', description: 'URL эндпоинта' },
                  resp: { type: 'string', description: 'Описание ответа' }
                }
              },
              description: 'Детали шагов (длина = path.length - 1)'
            }
          },
          required: ['name', 'path']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'delete_service',
        description: 'Удалить блок и все его связи.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Имя блока' }
          },
          required: ['name']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'auto_layout',
        description: 'Авторасстановка блоков по слоям. Вызывай в конце генерации схемы.',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'clear_canvas',
        description: 'Полностью очистить холст. Только если пользователь явно попросил.',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'open_seq',
        description: 'Открыть редактор UML Sequence для сценария. Автоматически генерирует диаграмму из шагов сценария.',
        parameters: {
          type: 'object',
          properties: {
            scenario_name: { type: 'string', description: 'Точное название сценария' }
          },
          required: ['scenario_name']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_seq_text',
        description: 'Получить текущий PlantUML текст из открытого seq-редактора. Вызывай перед правками чтобы знать что внутри.',
        parameters: { type: 'object', properties: {} }
      }
    },
    {
      type: 'function',
      function: {
        name: 'set_seq_text',
        description: 'Полностью заменить текст в seq-редакторе. Используй для точного контроля над UML.',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Полный PlantUML текст (@startuml ... @enduml)' }
          },
          required: ['text']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'insert_ref',
        description: 'Вставить ref-блок (UML 2.0 interaction use) в seq-диаграмму. ref = ссылка на другую диаграмму / декомпозиция sub-flow. Seq-редактор должен быть открыт.',
        parameters: {
          type: 'object',
          properties: {
            over: {
              type: 'string',
              description: 'Участники через запятую. Пример: "API Gateway, Auth Service" — блок охватит именно эти лейны'
            },
            label: {
              type: 'string',
              description: 'Имя sub-flow (название другой диаграммы), например "Проверка JWT токена"'
            },
            body: {
              type: 'string',
              description: 'Дополнительный текст внутри блока (для многострочного ref). Оставь пустым для однострочного «ref over A, B : label»'
            },
            position: {
              type: 'string',
              enum: ['start', 'before_async', 'end'],
              description: 'Куда вставить: start=начало диаграммы, before_async=перед async-секцией, end=конец (по умолчанию)'
            }
          },
          required: ['over', 'label']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'set_db_schema',
        description: 'Создать схему таблиц в НОВОЙ пустой БД (CREATE TABLE). Для существующих БД используй alter_db_schema — он не уничтожает данные.',
        parameters: {
          type: 'object',
          properties: {
            db_name: { type: 'string', description: 'Имя БД-блока (должно совпадать с add_service)' },
            sql: { type: 'string', description: 'SQL с CREATE TABLE операторами. Включай PK, FK, NOT NULL, UNIQUE, индексы. Пиши нормальный PostgreSQL.' },
            replace: { type: 'boolean', description: 'true = заменить ВСЕ таблицы (ТОЛЬКО для пустых БД!), false = добавить (по умолчанию false)' }
          },
          required: ['db_name', 'sql']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'alter_db_schema',
        description: 'Хирургически изменить схему существующей БД: добавить колонку, таблицу или индекс. НЕ удаляет существующие данные. Используй вместо set_db_schema когда БД уже имеет таблицы.',
        parameters: {
          type: 'object',
          properties: {
            db_name: { type: 'string', description: 'Имя БД-блока' },
            operation: {
              type: 'string',
              enum: ['add_column', 'add_table', 'add_index', 'drop_column'],
              description: 'add_column — добавить колонку в таблицу; add_table — новая таблица (если не существует); add_index — добавить индекс; drop_column — удалить колонку (осторожно)'
            },
            table: { type: 'string', description: 'Имя таблицы (для add_column, add_index, drop_column)' },
            sql: { type: 'string', description: 'SQL-фрагмент. Для add_column: "colname TYPE CONSTRAINTS", для add_table: полный CREATE TABLE, для add_index: полный CREATE INDEX, для drop_column: имя колонки' }
          },
          required: ['db_name', 'operation', 'sql']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'update_step',
        description: 'Обновить шаг сценария (бизнес-описание, HTTP-метод, URI, ответ). Все поля необязательны — укажи только изменяемые.',
        parameters: {
          type: 'object',
          properties: {
            scenario_name: { type: 'string', description: 'Название сценария' },
            step_index: { type: 'number', description: 'Индекс шага (0-based). Шаг 0 = первый переход в path.' },
            name: { type: 'string', description: 'Новое бизнес-описание шага' },
            verb: { type: 'string', enum: ['GET','POST','PUT','DELETE','PATCH'], description: 'HTTP метод (только для REST; для Kafka/SMTP не указывай)' },
            uri:  { type: 'string', description: 'URI эндпоинта, например /api/v1/users' },
            resp: { type: 'string', description: 'Описание ответа, например "200 {token}"' }
          },
          required: ['scenario_name', 'step_index']
        }
      }
    }
  ];

  // ── Исполнение инструментов ─────────────────────────────────────
  function executeTool(name, inp) {
    try {
      switch (name) {
        case 'add_service': {
          var id = 'b' + (S.nid++);
          S.blocks.push({
            id: id, type: inp.type || 'service',
            x: inp.x != null ? inp.x : 150 + Math.floor(Math.random() * 280),
            y: inp.y != null ? inp.y : 80  + Math.floor(Math.random() * 220),
            customLabel: inp.name || '', patterns: [], settings: {}
          });
          pushHist(); analyze();
          return 'OK: добавлен «' + inp.name + '» type=' + inp.type;
        }
        case 'add_connection': {
          var f = findBlock(inp.from), t = findBlock(inp.to);
          if (!f) return 'ОШИБКА: «' + inp.from + '» не найден. Есть: ' + blockNames();
          if (!t) return 'ОШИБКА: «' + inp.to   + '» не найден. Есть: ' + blockNames();
          if (S.conns.find(function(c){ return c.from===f.id && c.to===t.id; }))
            return 'OK: связь уже есть';
          S.conns.push({ id:'c'+(S.nid++), from:f.id, to:t.id });
          pushHist(); analyze();
          return 'OK: ' + inp.from + ' → ' + inp.to;
        }
        case 'create_scenario': {
          var pathIds = (inp.path||[]).map(function(n){ var b=findBlock(n); return b?b.id:null; });
          var bad = (inp.path||[]).filter(function(_,i){ return !pathIds[i]; });
          if (bad.length) return 'ОШИБКА: не найдены: ' + bad.join(', ') + '. Есть: ' + blockNames();
          var sc = { id:'sc'+(S.nid++), name:inp.name, path:pathIds,
            steps:(inp.steps||[]).map(function(s){ return {name:s.name||'',verb:s.verb||'GET',uri:s.uri||'',resp:s.resp||''}; }) };
          if (!S.scenarios) S.scenarios = [];
          S.scenarios.push(sc);
          pushHist();
          if (typeof renderRoutesPanel==='function') renderRoutesPanel();
          return 'OK: сценарий «' + inp.name + '» создан';
        }
        case 'delete_service': {
          var idx = S.blocks.findIndex(function(b){ return blockName(b)===inp.name; });
          if (idx<0) return 'ОШИБКА: «' + inp.name + '» не найден';
          var blk = S.blocks[idx];
          if (blk.dbSchema && blk.dbSchema.tables && blk.dbSchema.tables.length)
            return 'ЗАПРЕЩЕНО: блок «'+inp.name+'» содержит схему БД ('+blk.dbSchema.tables.length+' таблиц). Удаление уничтожит данные. Не удаляй — используй существующий блок в сценарии.';
          var bid = blk.id;
          S.blocks.splice(idx,1);
          S.conns = S.conns.filter(function(c){ return c.from!==bid && c.to!==bid; });
          pushHist(); analyze();
          return 'OK: удалён «' + inp.name + '»';
        }
        case 'auto_layout':
          if (typeof autoLayout==='function') autoLayout();
          return 'OK: авторасстановка выполнена';
        case 'clear_canvas':
          S.blocks=[]; S.conns=[]; S.scenarios=[]; S.nid=1;
          pushHist(); analyze();
          return 'OK: холст очищен';

        case 'open_seq': {
          var sc2 = (S.scenarios||[]).find(function(s){ return s.name===inp.scenario_name; });
          if (!sc2) return 'ОШИБКА: сценарий «'+inp.scenario_name+'» не найден. Есть: '+(S.scenarios||[]).map(function(s){return s.name;}).join(', ')||'(нет)';
          if (typeof openSeqForScenario==='function') openSeqForScenario(sc2.id);
          return 'OK: открыт seq для «'+sc2.name+'»';
        }

        case 'get_seq_text': {
          var ta = document.getElementById('seq-input');
          if (!ta || document.getElementById('seq-modal').style.display==='none')
            return 'seq-редактор закрыт. Сначала вызови open_seq.';
          return ta.value || '(пусто)';
        }

        case 'set_seq_text': {
          var ta = document.getElementById('seq-input');
          if (!ta || document.getElementById('seq-modal').style.display==='none')
            return 'ОШИБКА: seq-редактор не открыт. Сначала вызови open_seq.';
          ta.value = inp.text || '';
          if (typeof renderSeq==='function') renderSeq(true);
          return 'OK: текст установлен (' + (inp.text||'').split('\n').length + ' строк)';
        }

        case 'insert_ref': {
          var ta = document.getElementById('seq-input');
          if (!ta || document.getElementById('seq-modal').style.display==='none')
            return 'ОШИБКА: seq-редактор не открыт. Сначала вызови open_seq.';
          var refText;
          if (inp.body && inp.body.trim()) {
            refText = 'ref over ' + inp.over + '\n' + inp.body.trim() + '\nend ref';
          } else {
            refText = 'ref over ' + inp.over + ' : ' + inp.label;
          }
          var lines = ta.value.split('\n');
          var insertAt = lines.length - (lines[lines.length-1]==='@enduml' ? 1 : 0);
          if (inp.position === 'start') {
            insertAt = lines.findIndex(function(l){ return /^participant|^actor|^database|^autonumber/i.test(l.trim()); });
            if (insertAt < 0) insertAt = 1;
          } else if (inp.position === 'before_async') {
            var asyncIdx = lines.findIndex(function(l){ return /^==\s*(async|асинхрон)/i.test(l.trim()); });
            insertAt = asyncIdx >= 0 ? asyncIdx : lines.length - (lines[lines.length-1]==='@enduml' ? 1 : 0);
          }
          lines.splice(insertAt, 0, refText);
          ta.value = lines.join('\n');
          if (typeof renderSeq==='function') renderSeq(true);
          return 'OK: вставлен «' + inp.label + '» over ' + inp.over;
        }

        case 'alter_db_schema': {
          var db = findBlock(inp.db_name);
          if (!db) return 'ОШИБКА: «'+inp.db_name+'» не найден. Есть: '+blockNames();
          var dbTypes = ['postgresql','mysql','mongodb','redis','cassandra','clickhouse','elasticsearch','s3'];
          if (dbTypes.indexOf(db.type) < 0) return 'ОШИБКА: «'+inp.db_name+'» не БД (тип: '+db.type+')';
          if (!db.dbSchema) db.dbSchema = {tables:[]};
          if (!db.dbSchema.tables) db.dbSchema.tables = [];
          var op = inp.operation, tbl = inp.table, sql = (inp.sql||'').trim();

          if (op === 'add_table') {
            if (typeof parseSQLToSchema !== 'function') return 'ОШИБКА: parseSQLToSchema недоступна';
            var parsed = parseSQLToSchema(sql);
            if (!parsed.tables || !parsed.tables.length) return 'ОШИБКА: не нашёл CREATE TABLE в sql';
            var added = [];
            parsed.tables.forEach(function(newT){
              if (!db.dbSchema.tables.find(function(t){return t.name===newT.name;})) {
                db.dbSchema.tables.push(newT); added.push(newT.name);
              }
            });
            if (!added.length) return 'Пропущено: таблицы уже существуют ('+parsed.tables.map(function(t){return t.name;}).join(', ')+')';
            pushHist();
            return 'OK: добавлены таблицы: '+added.join(', ');
          }

          if (op === 'add_column') {
            if (!tbl) return 'ОШИБКА: укажи table';
            var t = db.dbSchema.tables.find(function(t){return t.name===tbl;});
            if (!t) return 'ОШИБКА: таблица «'+tbl+'» не найдена. Есть: '+db.dbSchema.tables.map(function(t){return t.name;}).join(', ');
            // parse "colname TYPE [constraints...]" — TYPE может быть VARCHAR(255), BIGINT и т.д.
            var m = sql.match(/^(\w+)\s+([A-Z][A-Z0-9_]*(?:\([^)]+\))?)(.*)/i);
            if (!m) return 'ОШИБКА: не распознал формат "colname TYPE [CONSTRAINTS]", получил: «'+sql+'»';
            var colName = m[1], colType = m[2].trim(), rest = (m[3]||'').trim();
            if (t.fields.find(function(f){return f.name===colName;}))
              return 'Пропущено: колонка «'+colName+'» уже есть в '+tbl;
            var cons = [];
            if (/\bPRIMARY KEY\b/i.test(rest)) cons.push('PK');
            if (/\bNOT NULL\b/i.test(rest)) cons.push('NN');
            if (/\bUNIQUE\b/i.test(rest)) cons.push('UNIQUE');
            var newField = {name:colName, type:colType, constraints:cons.join(', '), desc:'', example:''};
            var defMatch = rest.match(/\bDEFAULT\s+(.+?)(?:\s+NOT NULL|\s+PRIMARY|\s+UNIQUE|\s+REFERENCES|$)/i);
            if (defMatch) newField.default = defMatch[1].trim();
            var refMatch = rest.match(/\bREFERENCES\s+(\w+)\s*\(\s*(\w+)\s*\)/i);
            if (refMatch) {
              newField.fk = {table:refMatch[1], field:refMatch[2], card:'N:1'};
              if (/ON DELETE CASCADE/i.test(rest)) newField.fk.onDelete = 'CASCADE';
              else if (/ON DELETE SET NULL/i.test(rest)) newField.fk.onDelete = 'SET NULL';
              if (!cons.includes('FK')) cons.push('FK');
              newField.constraints = cons.join(', ');
            }
            t.fields.push(newField);
            pushHist();
            return 'OK: «'+tbl+'» + колонка «'+colName+' '+colType+(newField.fk?' → '+newField.fk.table+'.'+newField.fk.field:'')+'»';
          }

          if (op === 'add_index') {
            if (!tbl) return 'ОШИБКА: укажи table';
            var t = db.dbSchema.tables.find(function(t){return t.name===tbl;});
            if (!t) return 'ОШИБКА: таблица «'+tbl+'» не найдена';
            if (!t.indexes) t.indexes = [];
            if (t.indexes.indexOf(sql) < 0) t.indexes.push(sql);
            pushHist();
            return 'OK: индекс добавлен в «'+tbl+'»';
          }

          if (op === 'drop_column') {
            if (!tbl) return 'ОШИБКА: укажи table';
            var t = db.dbSchema.tables.find(function(t){return t.name===tbl;});
            if (!t) return 'ОШИБКА: таблица «'+tbl+'» не найдена';
            var before = t.fields.length;
            t.fields = t.fields.filter(function(f){return f.name!==sql;});
            if (t.fields.length === before) return 'Колонка «'+sql+'» не найдена в «'+tbl+'»';
            pushHist();
            return 'OK: удалена колонка «'+sql+'» из «'+tbl+'». Это необратимо в рамках истории.';
          }

          return 'ОШИБКА: неизвестная operation «'+op+'»';
        }

        case 'set_db_schema': {
          var db = findBlock(inp.db_name);
          if (!db) return 'ОШИБКА: «'+inp.db_name+'» не найден. Есть: '+blockNames();
          var dbTypes = ['postgresql','mysql','mongodb','redis','cassandra','clickhouse','elasticsearch','s3'];
          if (dbTypes.indexOf(db.type) < 0) return 'ОШИБКА: «'+inp.db_name+'» не является БД-блоком (тип: '+db.type+')';
          if (!inp.sql || !inp.sql.trim()) return 'ОШИБКА: sql пустой';
          if (typeof parseSQLToSchema !== 'function') return 'ОШИБКА: parseSQLToSchema не доступна';
          var parsed = parseSQLToSchema(inp.sql);
          if (!parsed.tables || !parsed.tables.length) return 'ОШИБКА: не нашёл ни одной CREATE TABLE в sql';
          if (!db.dbSchema) db.dbSchema = {tables:[]};
          if (!db.dbSchema.tables) db.dbSchema.tables = [];
          if (inp.replace !== false) {
            db.dbSchema.tables = parsed.tables;
          } else {
            db.dbSchema.tables = db.dbSchema.tables.concat(parsed.tables);
          }
          pushHist();
          if (typeof renderDBEditor === 'function' && typeof _dbEditId !== 'undefined' && _dbEditId === db.id) renderDBEditor();
          return 'OK: «'+inp.db_name+'» — добавлено таблиц: '+parsed.tables.length+' ('+parsed.tables.map(function(t){return t.name;}).join(', ')+')';
        }
        case 'update_step': {
          var sc3 = (S.scenarios||[]).find(function(s){ return s.name===inp.scenario_name; });
          if (!sc3) return 'ОШИБКА: сценарий «'+inp.scenario_name+'» не найден';
          if (!sc3.steps || sc3.steps.length <= inp.step_index)
            return 'ОШИБКА: шаг '+inp.step_index+' не существует (шагов: '+(sc3.steps||[]).length+')';
          var step = sc3.steps[inp.step_index];
          if (inp.name != null) step.name = inp.name;
          if (inp.verb != null) step.verb = inp.verb;
          if (inp.uri  != null) step.uri  = inp.uri;
          if (inp.resp != null) step.resp = inp.resp;
          pushHist();
          return 'OK: шаг '+inp.step_index+' сценария «'+inp.scenario_name+'» обновлён';
        }

        default: return 'ОШИБКА: неизвестный инструмент ' + name;
      }
    } catch(e) { return 'ОШИБКА: ' + e.message; }
  }

  function findBlock(name) {
    return S.blocks.find(function(b){ return blockName(b)===name; });
  }
  function blockName(b) { return b.customLabel||(EL[b.type]&&EL[b.type].lbl)||b.type; }
  function blockNames() { return S.blocks.map(blockName).join(', ')||'(пусто)'; }

  // ── JSON-режим: AI генерирует RAPTOR JSON, без tool calling ────
  function callAPI(userText, cb) {
    chatHistory.push({ role: 'user', content: userText });
    var messages = [{ role: 'system', content: buildSystem() }].concat(chatHistory);
    fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: MODEL, messages: messages, max_tokens: 4096 })
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (data.error) { cb(null, data.error.message || JSON.stringify(data.error)); return; }
      var choice = data.choices && data.choices[0];
      if (!choice) { cb(null, 'Пустой ответ от API'); return; }
      var content = choice.message.content || '';
      chatHistory.push({ role: 'assistant', content: content });
      cb(content, null);
    })
    .catch(function(e){ cb(null, e.message); });
  }

  function toolLabel(name) {
    return {
      add_service:   'добавляю блок',
      add_connection:'добавляю связь',
      create_scenario:'создаю сценарий',
      delete_service:'удаляю блок',
      auto_layout:   'расставляю блоки',
      clear_canvas:  'очищаю холст',
      open_seq:      'открываю seq',
      get_seq_text:  'читаю seq',
      set_seq_text:  'обновляю seq',
      insert_ref:    'вставляю ref-блок',
      update_step:    'обновляю шаг',
      set_db_schema:  'создаю схему БД',
      alter_db_schema:'изменяю схему БД'
    }[name] || name;
  }

  function buildSystem() {
    var ctx = getContext();
    return 'Ты — архитектурный ассистент RAPTOR. Помогаешь проектировать системы и генерируешь схемы в JSON-формате RAPTOR.\n\n' +
      '## ТЕКУЩАЯ СХЕМА\n' + JSON.stringify(ctx, null, 2) + '\n\n' +
      '## ТИПЫ БЛОКОВ (поле "type") — ТОЛЬКО ЭТИ ЗНАЧЕНИЯ, НИКАКИХ ДРУГИХ\n' +
      'Клиенты: web_client, mob_client, actor\n' +
      'Шлюзы: api_gw, websocket_gw, lb, cdn, bff\n' +
      'Сервисы: service, auth, external\n' +
      'БД: postgresql, mysql, mongodb, redis, cassandra, clickhouse, elasticsearch, s3\n' +
      'Брокеры: kafka, rabbitmq, nats, queue\n' +
      'ЗАПРЕЩЕНО использовать типы: celery, worker, task, cron, scheduler, processor — их НЕТ в RAPTOR!\n' +
      'Async Processor, Worker, Celery Task — всё это тип "service". Ничего другого.\n\n' +
      '## ФОРМАТ RAPTOR JSON\n' +
      'Когда пользователь подтверждает генерацию — верни ТОЛЬКО валидный JSON в блоке ```json ... ``` без лишнего текста до/после.\n' +
      'Структура:\n' +
      '{\n' +
      '  "blocks": [\n' +
      '    {"id":"b1","type":"actor","x":0,"y":100,"customLabel":"Пользователь","patterns":[],"settings":{}},\n' +
      '    {"id":"b2","type":"api_gw","x":200,"y":100,"customLabel":"API Gateway","patterns":[],"settings":{}},\n' +
      '    {"id":"b3","type":"service","x":400,"y":100,"customLabel":"User Service","patterns":[],"settings":{}},\n' +
      '    {"id":"b4","type":"postgresql","x":600,"y":100,"customLabel":"UserDB","patterns":[],"settings":{},\n' +
      '      "dbSchema":{"tables":[{"name":"users","fields":[\n' +
      '        {"name":"id","type":"UUID","constraints":"PK","desc":"","example":"","default":"gen_random_uuid()"},\n' +
      '        {"name":"email","type":"TEXT","constraints":"NN, UNIQUE","desc":"","example":""},\n' +
      '        {"name":"created_at","type":"TIMESTAMPTZ","constraints":"NN","desc":"","example":"","default":"NOW()"}\n' +
      '      ],"indexes":[{"name":"idx_users_email","fields":["email"]}]}]}}\n' +
      '  ],\n' +
      '  "conns": [\n' +
      '    {"id":"c1","from":"b1","to":"b2"},\n' +
      '    {"id":"c2","from":"b2","to":"b3"},\n' +
      '    {"id":"c3","from":"b3","to":"b4"}\n' +
      '  ],\n' +
      '  "scenarios": [\n' +
      '    {"id":"sc1","name":"Регистрация","path":["b1","b2","b3","b4"],\n' +
      '     "steps":[\n' +
      '       {"name":"Открывает форму регистрации","verb":"POST","uri":"/api/v1/auth/register","resp":"201 Created"},\n' +
      '       {"name":"Валидирует и создаёт пользователя","verb":"POST","uri":"/api/v1/users","resp":"201 {user_id}"},\n' +
      '       {"name":"Сохраняет в БД","verb":"INSERT","uri":"users","resp":"OK"}\n' +
      '    ]}\n' +
      '  ],\n' +
      '  "meta":{"systemName":"Название системы","version":"v1","description":"Описание","userRoles":[],"requirements":[]}\n' +
      '}\n\n' +
      '## ПРАВИЛА ПОЗИЦИОНИРОВАНИЯ БЛОКОВ (x/y)\n' +
      'Расставляй блоки слоями слева направо:\n' +
      '  Слой 0 (x=0):   actor, web_client, mob_client\n' +
      '  Слой 1 (x=200): api_gw, lb, cdn\n' +
      '  Слой 2 (x=420): service, bff, auth\n' +
      '  Слой 3 (x=650): kafka, rabbitmq, nats, queue\n' +
      '  Слой 4 (x=870): postgresql, mysql, mongodb, redis, s3, elasticsearch\n' +
      '  Слой 5 (x=1090): external\n' +
      'По вертикали y: первый блок y=60, каждый следующий +140.\n\n' +
      '## ПРАВИЛА СЦЕНАРИЕВ\n' +
      '• path — массив ID блоков в порядке вызова. Первый — actor. ПОСЛЕДНИЙ — обязательно БД.\n' +
      '• steps.length == path.length - 1 (шаг = переход между блоками)\n' +
      '• ЗАПРЕЩЕНО: "path":["b1","b2","b3"] если b3 — сервис. ОБЯЗАТЕЛЬНО: ["b1","b2","b3","b4"] где b4 — БД.\n' +
      '• Минимум 3 сценария для каждой системы.\n' +
      '• Kafka в path: actor → client → gw → producer_service → kafka → consumer_service → external\n\n' +
      '## ПРАВИЛА СХЕМ БД — ОБЯЗАТЕЛЬНО МИНИМУМ 5 ПОЛЕЙ НА ТАБЛИЦУ\n' +
      'Каждая таблица ОБЯЗАНА содержать: id UUID PK, бизнес-поля (минимум 3!), created_at, updated_at.\n' +
      'Пример хорошей таблицы orders:\n' +
      '  id UUID PK, user_id UUID NN FK, status VARCHAR(20) NN DEFAULT "pending",\n' +
      '  total_amount DECIMAL(12,2) NN, delivery_address TEXT NN,\n' +
      '  created_at TIMESTAMPTZ NN DEFAULT NOW(), updated_at TIMESTAMPTZ NN DEFAULT NOW()\n' +
      'Пример плохой таблицы (ЗАПРЕЩЕНО): id, name, created_at — только 3 поля, нет бизнес-данных!\n' +
      'FK-поля: constraints "NN, FK", добавляй fk: {"table":"ref_table","field":"id","card":"N:1"}\n' +
      'Индексы на все FK-поля и уникальные бизнес-ключи.\n\n' +
      '## ЖЕЛЕЗНЫЕ ПРАВИЛА БЛОКОВ\n' +
      'ОБЯЗАТЕЛЬНО добавлять actor-блоки для КАЖДОЙ роли пользователя (Покупатель, Администратор и т.д.).\n' +
      'actor — это человечек (роль), web_client/mob_client — это приложение. Они РАЗНЫЕ блоки!\n' +
      'Цепочка: actor → mob_client/web_client → api_gw → service → DB\n' +
      'actor соединяется с клиентом, клиент — с api_gw. Без actor сценарий НЕПОЛНЫЙ.\n' +
      'Сценарий ВСЕГДА: actor_id → client_id → gw_id → service_id → db_id\n' +
      'НИКОГДА не обрывай на сервисе. path ДОЛЖЕН содержать ID БД последним элементом.\n\n' +
      '## ЖЕЛЕЗНЫЕ ПРАВИЛА МИКРОСЕРВИСНОЙ АРХИТЕКТУРЫ\n' +
      'ЗАПРЕЩЕНО: одна общая БД на несколько сервисов — это монолит, позор архитектора.\n' +
      'КАЖДЫЙ сервис имеет СВОЮ отдельную БД. Пример для магазина:\n' +
      '  • Auth Service → AuthDB (postgresql): users, sessions, refresh_tokens\n' +
      '  • Catalog Service → CatalogDB (postgresql): products, categories, images, prices\n' +
      '  • Cart Service → CartDB (redis): cart_items (TTL 24h)\n' +
      '  • Order Service → OrderDB (postgresql): orders, order_items, order_status_history\n' +
      '  • Payment Service → PaymentDB (postgresql): payments, payment_methods, transactions\n' +
      '  • Notification Service → потребляет из kafka → external SMTP/Push\n' +
      'ЗАПРЕЩЕНО называть БД "База данных" — только конкретно: AuthDB, OrderDB, CatalogDB.\n' +
      'ЗАПРЕЩЕНО: один сервис делает всё — только SRP (Single Responsibility).\n' +
      'ОБЯЗАТЕЛЬНО для интернет-магазина: минимум 5 сервисов (Auth, Catalog, Cart, Order, Payment).\n' +
      'ОБЯЗАТЕЛЬНО: kafka если есть уведомления или async-операции.\n' +
      'ОБЯЗАТЕЛЬНО: каждая БД минимум 2 таблицы, каждая таблица минимум 5 полей.\n' +
      'ОБЯЗАТЕЛЬНО: минимум 3 сценария (регистрация, покупка, оформление заказа).\n\n' +
      '## РЕЖИМ РАБОТЫ\n' +
      'Если пользователь описывает систему — дай КРАТКИЙ план (список сервисов + их БД, 5-8 строк) и спроси подтверждение.\n' +
      'После «да» / «давай» / «генерируй» / «го» — верни ТОЛЬКО ```json блок с ПОЛНОЙ схемой. Никакого текста вокруг.\n' +
      'Если спрашивают про архитектуру, паттерны — отвечай текстом без JSON.\n' +
      'Отвечай на русском языке.';
  }

  function getContext() {
    if (typeof S==='undefined') return {};
    var meta = S.meta || {};
    return {
      project: {
        name: meta.systemName || meta.name || '',
        description: meta.description || '',
        domain: meta.domain || '',
        userRoles: (meta.userRoles||[]).map(function(r){ return {role:r.name, can:r.can}; }),
        requirements: (meta.requirements||[]).map(function(r){ return r.text; })
      },
      blocks: S.blocks.map(function(b){
        var extra = {};
        if (b.dbSchema && b.dbSchema.tables && b.dbSchema.tables.length)
          extra.tables = b.dbSchema.tables.map(function(t){ return t.name; });
        if (b.auth && b.auth.type) extra.authType = b.auth.type;
        return {id:b.id,type:b.type,name:blockName(b),extra:extra};
      }),
      connections: S.conns.map(function(c){
        var f=gb(c.from),t=gb(c.to);
        return {from:f?blockName(f):'?',to:t?blockName(t):'?'};
      }),
      scenarios:(S.scenarios||[]).map(function(sc){
        return {
          name: sc.name,
          path: (sc.path||[]).map(function(id){ var b=gb(id); return b?blockName(b):id; }),
          steps: (sc.steps||[]).map(function(s,i){ return {i:i,name:s.name,verb:s.verb,uri:s.uri,resp:s.resp}; })
        };
      })
    };
  }

  // ── UI ──────────────────────────────────────────────────────────
  function init() {
    msgs=document.getElementById('ai-msgs');
    input=document.getElementById('ai-input');
    sendBtn=document.getElementById('ai-send');
    statusEl=document.getElementById('ai-status');
    typingEl=document.getElementById('ai-typing');
    apiKey = localStorage.getItem('raptor_ai_key');
    if (input) {
      input.addEventListener('keydown', function(e){
        if (e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send(); }
      });
    }
    document.addEventListener('keydown', function(e){
      if (e.key==='Escape'&&isOpen) close();
    });
  }

  function toggle() { if (isOpen) close(); else open(); }

  function open() {
    var p=document.getElementById('ai-panel'); if(p) p.style.display='flex';
    isOpen=true;
    var btn=document.getElementById('ai-btn');
    if(btn){ btn.style.background='#1a3868'; btn.style.boxShadow='inset 1px 1px 0 #0a1838,inset -1px -1px 0 #4870b0,inset 2px 2px 0 #102040,inset -2px -2px 0 #3860a0'; }
    setTimeout(function(){ if(input) input.focus(); },50);
  }

  function close() {
    var p=document.getElementById('ai-panel'); if(p) p.style.display='none';
    isOpen=false;
    var btn=document.getElementById('ai-btn');
    if(btn){ btn.style.background='#1e4a90'; btn.style.boxShadow='inset 1px 1px 0 #6090d0,inset -1px -1px 0 #08183c,inset 2px 2px 0 #4070b8,inset -2px -2px 0 #122858'; }
  }

  function send() {
    var text=(input?input.value:'').trim();
    if (!text) return;
    if (!apiKey) { promptKey(function(){ if(text) send(); }); return; }
    addMsg('user',text);
    if(input) input.value='';
    setDisabled(true); setStatus('думает...'); showTyping(true);
    callAPI(text, function(resp,err){
      showTyping(false); setStatus('готов');
      addMsg('assistant', err?('Ошибка: '+err):resp);
      if (!err) {
        var jsonData = extractJSON(resp);
        if (jsonData) {
          var problems = checkSchemas(jsonData);
          if (problems.length) {
            autoEnrichSchemas(problems);
            return;
          }
        }
      }
      setDisabled(false);
    });
  }

  function checkSchemas(jsonData) {
    var dbTypes = ['postgresql','mysql','mongodb','redis','cassandra','clickhouse','elasticsearch','s3'];
    var problems = [];
    (jsonData.blocks||[]).forEach(function(b){
      if (dbTypes.indexOf(b.type) < 0) return;
      if (!b.dbSchema || !b.dbSchema.tables || !b.dbSchema.tables.length) return;
      b.dbSchema.tables.forEach(function(t){
        if (!t.fields || t.fields.length < 5) {
          problems.push('**' + b.customLabel + '.' + t.name + '** — ' + (t.fields||[]).length + ' полей: ' + (t.fields||[]).map(function(f){return f.name;}).join(', '));
        }
      });
    });
    return problems;
  }

  function autoEnrichSchemas(problems) {
    var followUp = 'Схемы БД слишком бедные — верни полный обновлённый JSON с исправлениями:\n' +
      problems.join('\n') +
      '\n\nДля каждой таблицы добавь минимум 5 полей: бизнес-поля (статус, суммы, FK, флаги), updated_at. ' +
      'Верни ТОЛЬКО полный ```json блок со всей схемой целиком.';
    addMsg('user', '🔄 Авто-улучшение схем БД...');
    setDisabled(true); setStatus('обогащаю схемы...'); showTyping(true);
    setTypingText('✦ обогащаю схемы БД...');
    callAPI(followUp, function(resp2, err2){
      showTyping(false); setDisabled(false); setStatus('готов');
      addMsg('assistant', err2 ? ('Ошибка: ' + err2) : resp2);
    });
  }

  function addMsg(role, text) {
    if(!msgs) return;
    var wrap=document.createElement('div'); wrap.className='ai-msg ai-msg-'+role;
    var inner=document.createElement('div');
    var bubble=document.createElement('div'); bubble.className='ai-bubble';
    // Скрываем сырой JSON из текста, показываем кнопку
    var jsonData = extractJSON(text);
    var displayText = jsonData ? text.replace(/```json[\s\S]*?```/,'').trim() || '✓ Схема сгенерирована' : text;
    bubble.innerHTML=md(displayText);
    if(jsonData){
      var btn=document.createElement('button');
      btn.textContent='📥 Загрузить в РАПТОР';
      btn.style.cssText='margin-top:8px;width:100%;padding:7px;background:#2a6010;color:#fff;border:none;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;';
      btn.onclick=(function(d){ return function(){ loadRaptorJSON(d); }; })(jsonData);
      bubble.appendChild(btn);
    }
    var time=document.createElement('div'); time.className='ai-time'; time.textContent=getTime();
    inner.appendChild(bubble); inner.appendChild(time); wrap.appendChild(inner); msgs.appendChild(wrap);
    msgs.scrollTop=msgs.scrollHeight;
  }

  function extractJSON(text) {
    var m = text.match(/```json\s*([\s\S]*?)```/);
    if(!m) return null;
    try { return JSON.parse(m[1].trim()); } catch(e){ return null; }
  }

  function loadRaptorJSON(data) {
    if(!data || !data.blocks) return;
    if(!confirm('Загрузить схему от AI? Текущий холст будет заменён.')) return;
    S.blocks=(data.blocks||[]).map(function(b){ return Object.assign({patterns:[],settings:{}},b); });
    S.conns=data.conns||[];
    S.scenarios=data.scenarios||[];
    S.nid=3000;
    S.meta=data.meta||defaultMeta();
    S.selected=null;
    pushHist(); analyze();
    if(typeof renderRoutesPanel==='function') renderRoutesPanel();
    toast('🤖 Схема от AI загружена');
  }

  function showTyping(show) {
    if(typingEl){ typingEl.style.display=show?'block':'none'; if(!show) setTypingText('✦ думает...'); }
    if(show&&msgs) msgs.scrollTop=msgs.scrollHeight;
  }
  function setTypingText(t){ if(typingEl) typingEl.querySelector('span').textContent=t; }
  function setDisabled(v){ if(input) input.disabled=v; if(sendBtn) sendBtn.disabled=v; }
  function setStatus(s){ if(!statusEl)return; statusEl.textContent='● '+s; statusEl.style.color=s==='готов'?'#2a6010':'#7a5008'; }

  var _keyCb = null;
  function promptKey(cb) {
    _keyCb = cb || null;
    var f = document.getElementById('ai-key-form');
    var inp = document.getElementById('ai-key-input');
    if (f) f.style.display = 'block';
    if (inp) { inp.value = apiKey || ''; setTimeout(function(){ inp.focus(); inp.select(); }, 50); }
    var ki = document.getElementById('ai-key-input');
    if (ki) ki.onkeydown = function(e){ if(e.key==='Enter') AI.saveKey(); };
  }
  function saveKey() {
    var inp = document.getElementById('ai-key-input');
    var key = inp ? inp.value.trim() : '';
    if (key.length < 10) { addMsg('assistant','Ключ слишком короткий — вставь полный gsk_...'); return; }
    apiKey = key;
    localStorage.setItem('raptor_ai_key', apiKey);
    hideKeyForm();
    addMsg('assistant','Ключ сохранён ✓ Опишите систему — создам схему.');
    if (_keyCb) { var cb = _keyCb; _keyCb = null; cb(); }
  }
  function hideKeyForm() {
    var f = document.getElementById('ai-key-form');
    if (f) f.style.display = 'none';
  }

  function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function md(s){
    s=s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    s=s.replace(/^#### (.+)$/gm,'<span style="font-weight:700;color:var(--txt)">$1</span>');
    s=s.replace(/^### (.+)$/gm,'<span style="font-weight:700;font-size:12px;color:var(--blue);display:block;margin-top:6px">$1</span>');
    s=s.replace(/^## (.+)$/gm,'<span style="font-weight:700;font-size:13px;color:var(--txt);display:block;margin-top:8px">$1</span>');
    s=s.replace(/\*\*([^\n*]+)\*\*/g,'<b>$1</b>');
    s=s.replace(/`([^`\n]+)`/g,'<code style="background:var(--bg3);padding:1px 4px;border-radius:3px;font-family:Consolas,monospace;font-size:10.5px">$1</code>');
    s=s.replace(/^[•\-\*] (.+)$/gm,'&nbsp;• $1');
    s=s.replace(/\n/g,'<br>');
    return s;
  }
  function getTime(){ var d=new Date(); return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); }

  document.addEventListener('DOMContentLoaded',init);
  return {toggle:toggle,open:open,close:close,send:send,promptKey:promptKey,saveKey:saveKey,hideKeyForm:hideKeyForm};
})();

function toggleAI(){ AI.toggle(); }
