// RAPTOR → OpenAPI 3.0 YAML export

(function(){

  var HTTP_VERBS = ['GET','POST','PUT','DELETE','PATCH','HEAD','OPTIONS'];
  var DB_TYPES   = ['postgresql','mysql','mongodb','redis','cassandra','clickhouse','elasticsearch','s3'];
  // Поля которые генерирует сервер — не включаем в request body
  var SERVER_FIELDS = ['id','created_at','updated_at','deleted_at'];

  function isHttpVerb(v){ return HTTP_VERBS.indexOf((v||'').toUpperCase()) >= 0; }

  // Маппинг SQL-типов → OpenAPI типы
  function sqlToOAS(sqlType){
    var t = (sqlType||'').toUpperCase();
    if (/^UUID/.test(t))                          return {type:'string', format:'uuid'};
    if (/^BOOLEAN|^BOOL/.test(t))                 return {type:'boolean'};
    if (/^SMALLINT|^TINYINT/.test(t))             return {type:'integer', format:'int32'};
    if (/^BIGINT/.test(t))                        return {type:'integer', format:'int64'};
    if (/^INTEGER|^INT/.test(t))                  return {type:'integer', format:'int32'};
    if (/^DECIMAL|^NUMERIC|^FLOAT|^DOUBLE/.test(t)) return {type:'number'};
    if (/^TIMESTAMPTZ|^TIMESTAMP/.test(t))        return {type:'string', format:'date-time'};
    if (/^DATE/.test(t))                          return {type:'string', format:'date'};
    if (/^TIME/.test(t))                          return {type:'string', format:'time'};
    if (/^CHAR\(/.test(t)){
      var cm = t.match(/CHAR\((\d+)\)/);
      return {type:'string', maxLength: cm ? +cm[1] : 1};
    }
    if (/^VARCHAR\(/.test(t)){
      var vm = t.match(/VARCHAR\((\d+)\)/);
      return {type:'string', maxLength: vm ? +vm[1] : 255};
    }
    if (/^TEXT|^CLOB/.test(t))                   return {type:'string'};
    if (/^JSONB?/.test(t))                        return {type:'object'};
    return {type:'string'};
  }

  // Найти БД блок подключённый к сервису
  function findServiceDB(serviceId, conns, idx){
    var dbId = null;
    conns.forEach(function(c){
      if (c.from === serviceId && idx[c.to] && DB_TYPES.indexOf(idx[c.to].type) >= 0)
        dbId = c.to;
    });
    return dbId ? idx[dbId] : null;
  }

  // Построить OpenAPI schema из dbSchema.tables[0] (основная таблица)
  function buildSchemaFromDB(dbBlock, verb){
    if (!dbBlock || !dbBlock.dbSchema || !dbBlock.dbSchema.tables || !dbBlock.dbSchema.tables.length)
      return null;

    // Для PUT/PATCH берём первую таблицу, для POST тоже
    var table = dbBlock.dbSchema.tables[0];
    var fields = (table.fields || []).filter(function(f){
      // Исключаем серверные поля и FK (они передаются через URL path обычно)
      if (SERVER_FIELDS.indexOf(f.name) >= 0) return false;
      if (verb === 'GET' || verb === 'DELETE') return false;
      // Для PATCH — только non-required поля (все необязательные)
      return true;
    });

    if (!fields.length) return null;

    var props = {};
    var required = [];

    fields.forEach(function(f){
      var oasType = sqlToOAS(f.type);
      var prop = Object.assign({}, oasType);
      if (f.desc)    prop.description = f.desc;
      if (f.example) prop.example     = f.example;
      props[f.name] = prop;

      // Обязательное если NN в constraints и нет DEFAULT
      var isNN      = /\bNN\b/.test(f.constraints || '');
      var hasDefault = !!f.default;
      var isFk      = !!f.fk;
      if (isNN && !hasDefault && !isFk && verb !== 'PATCH')
        required.push(f.name);
    });

    var schema = {type:'object', properties: props};
    if (required.length) schema.required = required;
    return schema;
  }

  // "201 {orderId}" → {code:"201", desc:"{orderId}"}
  function parseResp(resp){
    var s = (resp||'').trim();
    var m = s.match(/^(\d{3})\s*(.*)/);
    if (m) return {code: m[1], desc: m[2]||''};
    if (/^\d{3}$/.test(s)) return {code: s, desc: ''};
    return {code: '200', desc: s};
  }

  // Безопасное имя тега из label
  function tagName(b){
    return (b.customLabel || b.type || 'Service').replace(/[^\w\s\-]/g,'').trim();
  }

  // Сериализация OpenAPI schema-объекта в YAML с заданным отступом
  function schemaToYaml(schema, indent){
    var pad = indent || '              ';
    var lines = [];
    lines.push(pad + 'type: ' + schema.type);
    if (schema.format)      lines.push(pad + 'format: ' + schema.format);
    if (schema.maxLength)   lines.push(pad + 'maxLength: ' + schema.maxLength);
    if (schema.description) lines.push(pad + 'description: "' + esc(schema.description) + '"');
    if (schema.example !== undefined) lines.push(pad + 'example: "' + esc(String(schema.example)) + '"');
    if (schema.required && schema.required.length){
      lines.push(pad + 'required:');
      schema.required.forEach(function(r){ lines.push(pad + '  - ' + r); });
    }
    if (schema.properties){
      lines.push(pad + 'properties:');
      Object.keys(schema.properties).forEach(function(k){
        var prop = schema.properties[k];
        lines.push(pad + '  ' + k + ':');
        lines.push(pad + '    type: ' + prop.type);
        if (prop.format)      lines.push(pad + '    format: ' + prop.format);
        if (prop.maxLength)   lines.push(pad + '    maxLength: ' + prop.maxLength);
        if (prop.description) lines.push(pad + '    description: "' + esc(prop.description) + '"');
        if (prop.example !== undefined) lines.push(pad + '    example: "' + esc(String(prop.example)) + '"');
      });
    }
    return lines.join('\n');
  }

  function buildOpenAPI(){
    var blocks    = (typeof S !== 'undefined' && S.blocks)    ? S.blocks    : [];
    var conns     = (typeof S !== 'undefined' && S.conns)     ? S.conns     : [];
    var scenarios = (typeof S !== 'undefined' && S.scenarios) ? S.scenarios : [];
    var meta      = (typeof S !== 'undefined' && S.meta)      ? S.meta      : {};

    if (!scenarios.length){ toast('❌ Нет сценариев — добавь сценарии со шагами'); return null; }

    // Индекс блоков
    var idx = {};
    blocks.forEach(function(b){ idx[b.id] = b; });

    // Определяем auth_mode из API GW
    var gw = blocks.find(function(b){ return b.type === 'api_gw' || b.type === 'websocket_gw'; });
    var authMode = gw && gw.settings && gw.settings.auth_mode ? gw.settings.auth_mode : null;

    // Собираем paths: uri → verb → {summary, tags, responses[]}
    // Ключ дедупликации: uri+verb+serviceId
    var paths = {};   // uri → {verb → endpoint}
    var tags  = {};   // tagName → description

    scenarios.forEach(function(sc){
      var path = sc.path || [];
      var steps = sc.steps || [];

      steps.forEach(function(step, i){
        var verb = (step.verb || '').toUpperCase();
        if (!isHttpVerb(verb)) return;

        var uri = (step.uri || '').trim();
        if (!uri || uri === '/') return;

        // Нормализуем uri: убираем дубль слеша, добавляем /
        if (uri[0] !== '/') uri = '/' + uri;

        var blockId = path[i];
        var block   = blockId ? idx[blockId] : null;
        var tag     = block ? tagName(block) : 'General';
        if (block) tags[tag] = block.type;

        var resp = parseResp(step.resp);
        var key  = uri + '::' + verb + '::' + (blockId||'');

        if (!paths[uri]) paths[uri] = {};
        if (!paths[uri][verb]) {
          paths[uri][verb] = {
            summary:     step.name || (verb + ' ' + uri),
            description: sc.name || '',
            tags:        [tag],
            operationId: (verb.toLowerCase() + '_' + uri.replace(/[^a-zA-Zа-яА-Я0-9]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'')),
            responses:   {},
            _blockId:    blockId  // для поиска БД
          };
        }
        // Добавляем статус-код если ещё нет
        var ep = paths[uri][verb];
        if (!ep.responses[resp.code]) {
          ep.responses[resp.code] = resp.desc
            ? {description: resp.desc}
            : {description: 'OK'};
        }
        // Добавляем тег если ещё нет
        if (ep.tags.indexOf(tag) < 0) ep.tags.push(tag);
      });
    });

    if (!Object.keys(paths).length){
      toast('❌ Нет HTTP-шагов в сценариях (нужны шаги с verb=POST/GET/…)');
      return null;
    }

    // Собираем security schemes
    var secSchemes = {};
    var security   = [];
    if (authMode === 'jwt' || authMode === 'jwt_builtin' || !authMode) {
      secSchemes['BearerAuth'] = {type:'http', scheme:'bearer', bearerFormat:'JWT'};
      security = [{BearerAuth:[]}];
    } else if (authMode === 'oauth2') {
      secSchemes['OAuth2'] = {type:'oauth2', flows:{authorizationCode:{authorizationUrl:'/oauth/authorize', tokenUrl:'/oauth/token', scopes:{}}}};
      security = [{OAuth2:[]}];
    } else if (authMode === 'api_key') {
      secSchemes['ApiKeyAuth'] = {type:'apiKey', 'in':'header', name:'X-API-Key'};
      security = [{ApiKeyAuth:[]}];
    }

    // Генерируем YAML вручную (без зависимостей)
    var lines = [];
    var p = function(s){ lines.push(s); };

    p('openapi: "3.0.3"');
    p('info:');
    p('  title: "' + esc(meta.systemName || 'RAPTOR Export') + '"');
    if (meta.description) p('  description: "' + esc(meta.description) + '"');
    p('  version: "' + esc(meta.version || '1.0.0') + '"');
    if (meta.domain) p('  x-domain: "' + esc(meta.domain) + '"');
    p('');

    // Servers
    p('servers:');
    p('  - url: /api/v1');
    p('    description: Production');
    p('');

    // Tags
    var tagKeys = Object.keys(tags);
    if (tagKeys.length) {
      p('tags:');
      tagKeys.forEach(function(t){
        p('  - name: "' + esc(t) + '"');
        p('    description: "' + esc(tags[t]) + '"');
      });
      p('');
    }

    // Security schemes
    if (Object.keys(secSchemes).length) {
      p('components:');
      p('  securitySchemes:');
      Object.keys(secSchemes).forEach(function(k){
        var sc = secSchemes[k];
        p('    ' + k + ':');
        p('      type: "' + sc.type + '"');
        if (sc.scheme)      p('      scheme: "' + sc.scheme + '"');
        if (sc.bearerFormat) p('      bearerFormat: "' + sc.bearerFormat + '"');
        if (sc.in)          p('      in: "' + sc.in + '"');
        if (sc.name)        p('      name: "' + sc.name + '"');
      });
      p('');
    }

    // Global security
    if (security.length) {
      p('security:');
      security.forEach(function(s){
        Object.keys(s).forEach(function(k){
          p('  - ' + k + ': []');
        });
      });
      p('');
    }

    // Paths
    p('paths:');
    Object.keys(paths).sort().forEach(function(uri){
      p('  ' + uri + ':');
      var verbs = paths[uri];
      Object.keys(verbs).sort().forEach(function(verb){
        var ep = verbs[verb];
        p('    ' + verb.toLowerCase() + ':');
        p('      summary: "' + esc(ep.summary) + '"');
        if (ep.description && ep.description !== ep.summary)
          p('      description: "' + esc(ep.description) + '"');
        p('      operationId: "' + esc(ep.operationId) + '"');
        if (ep.tags.length) {
          p('      tags:');
          ep.tags.forEach(function(t){ p('        - "' + esc(t) + '"'); });
        }
        // Request body для POST/PUT/PATCH — берём из БД сервиса
        if (['POST','PUT','PATCH'].indexOf(verb) >= 0) {
          var dbBlock = ep._blockId ? findServiceDB(ep._blockId, conns, idx) : null;
          var schema  = dbBlock ? buildSchemaFromDB(dbBlock, verb) : null;
          p('      requestBody:');
          p('        required: true');
          p('        content:');
          p('          application/json:');
          p('            schema:');
          if (schema) {
            p(schemaToYaml(schema, '              '));
          } else {
            p('              type: object');
            p('              description: "TODO: заполни поля запроса"');
          }
        }
        p('      responses:');
        var codes = Object.keys(ep.responses);
        if (!codes.length) codes = ['200'];
        codes.forEach(function(code){
          p('        "' + code + '":');
          p('          description: "' + esc(ep.responses[code].description || 'OK') + '"');
        });
        // 401 если есть auth
        if (Object.keys(secSchemes).length && !ep.responses['401']) {
          p('        "401":');
          p('          description: "Не авторизован"');
        }
      });
    });

    return lines.join('\n');
  }

  function esc(s){
    return String(s||'').replace(/"/g,'\\"').replace(/\n/g,' ');
  }

  function downloadSwagger(){
    var yaml = buildOpenAPI();
    if (!yaml) return;

    var meta = (typeof S !== 'undefined' && S.meta) ? S.meta : {};
    var name = (meta.systemName || 'raptor-api').replace(/[^a-zA-ZА-Яа-я0-9_\- ]/g,'').trim() || 'raptor-api';

    var blob = new Blob([yaml], {type:'text/yaml'});
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = name + '.yaml';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 1000);

    if (typeof toast === 'function')
      toast('✅ OpenAPI 3.0 → ' + name + '.yaml');
  }

  window.exportSwagger = downloadSwagger;

})();
