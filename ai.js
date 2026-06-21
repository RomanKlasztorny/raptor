// RAPTOR AI — подключается к copilot-proxy.js (localhost:8965)
// Прокси обменивает GitHub PAT на Copilot API токен и форвардит запросы
var RAPTOR_KEY = 'no-auth';

var AI = (function () {
  var msgs, input, sendBtn, statusEl, typingEl;
  var chatHistory = []; // OpenAI format: [{role, content, tool_calls?, tool_call_id?}]
  var isOpen = false;
  var apiKey = null;

  var MODEL = 'gpt-4o';
  var API_URL = 'http://localhost:8964/v1/chat/completions';

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

  // ── OpenRouter API с agentic loop ───────────────────────────────
  function callAPI(userText, cb) {
    chatHistory.push({ role: 'user', content: userText });
    doLoop(0, cb);
  }

  function doLoop(depth, cb) {
    if (depth > 12) { cb(null, 'Превышен лимит итераций'); return; }

    var messages = [{ role: 'system', content: buildSystem() }].concat(chatHistory);

    fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages,
        tools: TOOLS,
        tool_choice: 'auto'
      })
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (data.error) { cb(null, data.error.message || JSON.stringify(data.error)); return; }

      var choice = data.choices && data.choices[0];
      if (!choice) { cb(null, 'Пустой ответ от API'); return; }

      var message = choice.message;
      chatHistory.push(message);

      var toolCalls = message.tool_calls;
      if (!toolCalls || !toolCalls.length) {
        cb(message.content || '✓ Готово', null);
        return;
      }

      // Исполняем инструменты
      toolCalls.forEach(function(tc) {
        setTypingText('⚙ ' + toolLabel(tc.function.name) + '...');
        var args = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch(e) {}
        var result = executeTool(tc.function.name, args);
        chatHistory.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result
        });
      });

      doLoop(depth + 1, cb);
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
    return 'Ты архитектурный ассистент в инструменте RAPTOR — браузерном конструкторе MSA-архитектур.\n\n' +
      'ТЕКУЩАЯ СХЕМА:\n' + JSON.stringify(ctx, null, 2) + '\n\n' +
      'ТИПЫ БЛОКОВ:\n' +
      '  Клиенты: web_client, mob_client, actor\n' +
      '  Сети/шлюзы: api_gw, websocket_gw, lb, cdn\n' +
      '  Сервисы: service, bff, auth, external\n' +
      '  БД: postgresql, mysql, mongodb, redis, cassandra, clickhouse, elasticsearch, s3\n' +
      '  Брокеры: kafka, rabbitmq, nats, queue\n\n' +
      'ЧТО ТАКОЕ СЦЕНАРИЙ:\n' +
      'Сценарий — «линия» во вкладке «Линии», генерирует UML Sequence.\n' +
      'path — массив имён блоков: [актор → шлюз → сервис → БД]\n' +
      'steps — шаги [{name, verb, uri, resp}], длина = path.length - 1.\n' +
      'Первый элемент path ВСЕГДА актор (web_client/mob_client/actor).\n\n' +
      'ПРАВИЛА ГЕНЕРАЦИИ UML SEQUENCE (соблюдай при open_seq/insert_ref/set_seq_text):\n' +
      '1. SYNC/ASYNC: синхронные хопы идут сначала (→ с ответом 200), Kafka-publish ТОЛЬКО после всех sync\n' +
      '2. После Kafka-publish нет возврата 200 к клиенту (consumer сам обработает)\n' +
      '3. SELECT в БД только если он нужен по логике; не дублировать INSERT→SELECT\n' +
      '4. HTTP метод (GET/POST) только на REST; Kafka→consume(event), SMTP→без метода\n' +
      '5. Возврат ответа клиенту минует Kafka (прямо сервис→клиент)\n\n' +
      'REF-БЛОКИ (UML 2.0 interaction use):\n' +
      '  Однострочный: ref over Участник1, Участник2 : Название sub-flow\n' +
      '  Многострочный: ref over A, B \\n текст \\n end ref\n' +
      '  Назначение: декомпозиция — вынести повторяющийся sub-flow в отдельную диаграмму.\n' +
      '  over задаёт каких участников охватывает блок (используй реальные имена из диаграммы).\n' +
      '  Примеры: «Проверка JWT», «Обновление токена», «Обработка ошибки».\n\n' +
      'РЕЖИМ РАБОТЫ — ДВА ЭТАПА:\n\n' +
      'ЭТАП 1 — АНАЛИЗ (всегда первый шаг, без инструментов):\n' +
      'Когда пользователь описывает задачу или спрашивает как реализовать что-то — НЕ запускай инструменты сразу.\n' +
      'Сначала дай структурированный анализ:\n' +
      '  • Суть задачи одной фразой\n' +
      '  • 2-3 варианта реализации с реальными паттернами MSA (CQRS, Saga, BFF, Event-driven и т.д.)\n' +
      '  • Для каждого варианта: плюсы, минусы, когда применять\n' +
      '  • Твоя рекомендация с обоснованием\n' +
      '  • Что именно создашь: список блоков, связей, сценариев\n' +
      'Заверши фразой: "Создаю? Напиши «да» или скажи что изменить."\n\n' +
      'ЭТАП 2 — РЕАЛИЗАЦИЯ (только после подтверждения «да» / «запускай» / «делай»):\n' +
      '  • Запускай инструменты: add_service → add_connection → create_scenario → auto_layout\n' +
      '  • НИКОГДА не передавай x/y в add_service\n' +
      '  • Если нужен блок которого нет в схеме — создай его сам\n' +
      '  • НИКОГДА не ссылайся на блоки которых нет в ТЕКУЩАЯ СХЕМА выше\n' +
      '  • После инструментов — краткий итог: что создал\n\n' +
      'ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА:\n' +
      '  • Минимум 2 сценария на фичу (happy path + edge case или разные акторы)\n' +
      '  • В конце реализации ВСЕГДА auto_layout\n' +
      '  • Для seq: open_seq → get_seq_text → insert_ref / set_seq_text\n' +
      '  • После add_service для БД — ВСЕГДА вызывай set_db_schema с полным PostgreSQL DDL\n' +
      '  • Для существующих БД — ТОЛЬКО alter_db_schema (add_table/add_column/add_index), НЕ set_db_schema\n' +
      '  • НИКОГДА не пиши SQL в чат — только через set_db_schema / alter_db_schema\n' +
      'ПРАВИЛА DDL-КАЧЕСТВА (обязательно):\n' +
      '  • Каждая FK-колонка ДОЛЖНА иметь REFERENCES table(id) — без этого связь не отображается на ERD\n' +
      '  • Используй ON DELETE CASCADE для «владелец удалён → дочерние удаляются» (заказы, сессии, токены)\n' +
      '  • Используй ON DELETE SET NULL если запись должна остаться без хозяина (логи, аудит)\n' +
      '  • Суррогатный PK: UUID + DEFAULT gen_random_uuid() для новых таблиц, SERIAL только если явно нужен\n' +
      '  • created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ — в каждой бизнес-таблице\n' +
      '  • Индексы: CREATE INDEX ON table(fk_col) — всегда на FK-колонки; CREATE UNIQUE INDEX для уникальных бизнес-ключей\n' +
      '  • Используй реальные паттерны: называй их (Strangler Fig, Outbox, Saga Orchestration...)\n' +
      '  • Отвечай на русском языке.\n\n' +
      'КАК ЧИТАТЬ БИЗНЕС-КОНТЕКСТ:\n' +
      'В ТЕКУЩАЯ СХЕМА выше есть project.userRoles и project.requirements — это бизнес-требования системы.\n' +
      'Когда пользователь описывает функцию на бизнес-языке ("отслеживать прогресс", "найти ментора", "заполнить профиль") —\n' +
      'сопоставь её с существующими блоками по смыслу, не по буквальному совпадению имён.\n' +
      'Примеры мэппинга (читай из ТЕКУЩАЯ СХЕМА, не выдумывай):\n' +
      '  • "поиск менторов / фильтр по навыкам" → блок типа service с users/profiles/mentors\n' +
      '  • "прогресс студента / сессии" → блок типа service с progress/sessions\n' +
      '  • "заявка / подтверждение ментором" → блок типа service с bookings/requests\n' +
      '  • "профиль / кабинет" → блок типа service с profile/users\n' +
      'Если пользователь говорит "доработай", "добавь маршруты", "система должна уметь X" — найди нужный блок в схеме и создай сценарий через него.\n\n' +
      'ГЛАВНОЕ ПРАВИЛО — НЕ ДУБЛИРОВАТЬ СЕРВИСЫ:\n' +
      'Перед каждым add_service ОБЯЗАТЕЛЬНО проверь ТЕКУЩАЯ СХЕМА выше.\n' +
      'Если блок с похожей функцией УЖЕ ЕСТЬ — используй его в create_scenario, НЕ создавай новый.\n' +
      'Примеры что НЕ надо создавать если уже есть похожее:\n' +
      '  • "Сервис поиска" если есть сервис с users/profiles/mentors\n' +
      '  • "Сервис экспорта" если есть сервис прогресса с endpoint /export\n' +
      '  • "Профили DB" если есть User DB или аналогичная БД\n' +
      '  • Любой сервис, функция которого покрывается существующим блоком\n' +
      'Если пользователь просит "добавить сценарии", "проложить маршруты", "доработать" — используй ТОЛЬКО create_scenario с существующими блоками.\n' +
      'add_service допустим ТОЛЬКО если функционал реально отсутствует в схеме (нет ни одного похожего блока).';
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
    apiKey = RAPTOR_KEY || localStorage.getItem('raptor_ai_key');
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
    addMsg('user',text);
    if(input) input.value='';
    setDisabled(true); setStatus('думает...'); showTyping(true);
    callAPI(text, function(resp,err){
      showTyping(false); setDisabled(false); setStatus('готов');
      addMsg('assistant', err?('Ошибка: '+err):resp);
    });
  }

  function addMsg(role, text) {
    if(!msgs) return;
    var wrap=document.createElement('div'); wrap.className='ai-msg ai-msg-'+role;
    var inner=document.createElement('div');
    var bubble=document.createElement('div'); bubble.className='ai-bubble';
    bubble.innerHTML=md(text);
    var time=document.createElement('div'); time.className='ai-time'; time.textContent=getTime();
    inner.appendChild(bubble); inner.appendChild(time); wrap.appendChild(inner); msgs.appendChild(wrap);
    msgs.scrollTop=msgs.scrollHeight;
  }

  function showTyping(show) {
    if(typingEl){ typingEl.style.display=show?'block':'none'; if(!show) setTypingText('✦ думает...'); }
    if(show&&msgs) msgs.scrollTop=msgs.scrollHeight;
  }
  function setTypingText(t){ if(typingEl) typingEl.querySelector('span').textContent=t; }
  function setDisabled(v){ if(input) input.disabled=v; if(sendBtn) sendBtn.disabled=v; }
  function setStatus(s){ if(!statusEl)return; statusEl.textContent='● '+s; statusEl.style.color=s==='готов'?'#2a6010':'#7a5008'; }

  function promptKey(cb) {
    var key=prompt('OpenRouter API ключ (sk-or-...):\n\nБесплатно на openrouter.ai → Keys');
    if (key && key.trim().startsWith('sk-or-')) {
      apiKey=key.trim(); localStorage.setItem('raptor_ai_key',apiKey);
      addMsg('assistant','Ключ сохранён ✓ Опишите систему — создам схему.');
      if(cb) cb();
    } else if(key!==null) {
      addMsg('assistant','Ключ должен начинаться с sk-or-... Получи бесплатно на openrouter.ai');
    }
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
  return {toggle:toggle,open:open,close:close,send:send,promptKey:promptKey};
})();

function toggleAI(){ AI.toggle(); }
