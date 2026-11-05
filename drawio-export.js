// RAPTOR → draw.io XML export

(function(){

  // Маппинг типов блоков в стили draw.io
  var STYLES = {
    actor:        'shape=mxgraph.c4.person2;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;fontSize=11;',
    web_client:   'rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontSize=11;',
    mob_client:   'shape=mxgraph.android.phone2;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontSize=10;',
    api_gw:       'shape=mxgraph.network.firewall;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontStyle=1;fontSize=11;',
    websocket_gw: 'shape=mxgraph.network.firewall;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;fontStyle=1;fontSize=11;',
    lb:           'shape=mxgraph.network.load_balancer;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=10;',
    cdn:          'shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.cloudfront;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=10;',
    bff:          'rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;fontSize=11;',
    service:      'rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=11;',
    auth:         'rounded=1;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;fontStyle=1;fontSize=11;',
    external:     'rounded=0;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;dashed=1;dashPattern=8 4;fontStyle=2;fontSize=11;',
    postgresql:   'shape=mxgraph.flowchart.database;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=10;',
    mysql:        'shape=mxgraph.flowchart.database;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=10;',
    mongodb:      'shape=mxgraph.flowchart.database;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontSize=10;',
    redis:        'shape=mxgraph.flowchart.database;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=10;',
    cassandra:    'shape=mxgraph.flowchart.database;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;fontSize=10;',
    clickhouse:   'shape=mxgraph.flowchart.database;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;fontSize=10;',
    elasticsearch:'shape=mxgraph.flowchart.database;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=10;',
    s3:           'shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.s3;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=10;',
    kafka:        'shape=mxgraph.network.server;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;fontStyle=1;fontSize=10;',
    rabbitmq:     'shape=mxgraph.network.server;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;fontStyle=1;fontSize=10;',
    nats:         'shape=mxgraph.network.server;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontStyle=1;fontSize=10;',
    queue:        'shape=mxgraph.flowchart.start_2;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;fontSize=10;',
  };

  // Размеры блоков по типу
  var SIZES = {
    actor:        {w:60,  h:80},
    web_client:   {w:100, h:50},
    mob_client:   {w:60,  h:90},
    api_gw:       {w:120, h:60},
    websocket_gw: {w:120, h:60},
    lb:           {w:80,  h:60},
    cdn:          {w:80,  h:60},
    bff:          {w:110, h:50},
    service:      {w:120, h:50},
    auth:         {w:120, h:50},
    external:     {w:120, h:50},
    postgresql:   {w:100, h:70},
    mysql:        {w:100, h:70},
    mongodb:      {w:100, h:70},
    redis:        {w:90,  h:60},
    cassandra:    {w:100, h:70},
    clickhouse:   {w:100, h:70},
    elasticsearch:{w:100, h:70},
    s3:           {w:90,  h:60},
    kafka:        {w:100, h:60},
    rabbitmq:     {w:100, h:60},
    nats:         {w:100, h:60},
    queue:        {w:90,  h:55},
  };

  var DEFAULT_STYLE = 'rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=11;';
  var DEFAULT_SIZE  = {w:120, h:50};

  // Тип связи: async (kafka/rabbitmq/nats/queue) — пунктир
  var ASYNC_TYPES = ['kafka','rabbitmq','nats','queue'];

  function esc(s){
    return String(s||'')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function blockLabel(b){
    var el = (typeof EL !== 'undefined') && EL[b.type];
    var sub = el ? el.sub : b.type;
    var name = b.customLabel || (el && el.lbl) || b.type;
    return esc(name) + (sub ? '\n[' + esc(sub) + ']' : '');
  }

  function connStyle(b_from, b_to){
    var isAsync = (b_from && ASYNC_TYPES.indexOf(b_from.type) >= 0)
               || (b_to   && ASYNC_TYPES.indexOf(b_to.type)   >= 0);
    if (isAsync)
      return 'edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;dashed=1;dashPattern=6 3;endArrow=open;endFill=0;strokeColor=#9673a6;';
    return 'edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;endFill=1;strokeColor=#6c8ebf;';
  }

  function buildXML(){
    var blocks = (typeof S !== 'undefined' && S.blocks) ? S.blocks : [];
    var conns  = (typeof S !== 'undefined' && S.conns)  ? S.conns  : [];
    var meta   = (typeof S !== 'undefined' && S.meta)   ? S.meta   : {};

    if (!blocks.length){ toast('❌ ' + tTask({ru:'Нет блоков для экспорта',en:'No blocks to export'})); return null; }

    // Индекс id→block
    var idx = {};
    blocks.forEach(function(b){ idx[b.id] = b; });

    var cells = [];
    var cellId = 2; // 0 и 1 зарезервированы draw.io

    // Карта RAPTOR id → draw.io cell id
    var idMap = {};

    // Блоки
    blocks.forEach(function(b){
      var cid = cellId++;
      idMap[b.id] = cid;
      var style = STYLES[b.type] || DEFAULT_STYLE;
      var sz    = SIZES[b.type]  || DEFAULT_SIZE;
      var label = blockLabel(b);
      // Смещение координат: RAPTOR может иметь отрицательные x (actor x=-100)
      cells.push(
        '<mxCell id="' + cid + '" value="' + label + '" style="' + style + '" vertex="1" parent="1">\n' +
        '  <mxGeometry x="' + (b.x + 200) + '" y="' + (b.y + 60) + '" width="' + sz.w + '" height="' + sz.h + '" as="geometry"/>\n' +
        '</mxCell>'
      );
    });

    // Связи
    conns.forEach(function(c, i){
      var cid  = cellId++;
      var src  = idMap[c.from];
      var tgt  = idMap[c.to];
      if (!src || !tgt) return;
      var bf   = idx[c.from];
      var bt   = idx[c.to];
      var style = connStyle(bf, bt);
      cells.push(
        '<mxCell id="' + cid + '" value="" style="' + style + '" edge="1" source="' + src + '" target="' + tgt + '" parent="1">\n' +
        '  <mxGeometry relative="1" as="geometry"/>\n' +
        '</mxCell>'
      );
    });

    var systemName = esc(meta.systemName || 'RAPTOR Export');

    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">\n' +
      '  <root>\n' +
      '    <mxCell id="0"/>\n' +
      '    <mxCell id="1" parent="0"/>\n' +
      '    <!-- ' + systemName + ' — exported from RAPTOR -->\n' +
      cells.map(function(c){ return '    ' + c.replace(/\n/g,'\n    '); }).join('\n') + '\n' +
      '  </root>\n' +
      '</mxGraphModel>';
  }

  function downloadDrawio(){
    var xml = buildXML();
    if (!xml) return;

    var meta = (typeof S !== 'undefined' && S.meta) ? S.meta : {};
    var name = (meta.systemName || 'raptor-export').replace(/[^a-zA-ZА-Яа-я0-9_\- ]/g,'').trim() || 'raptor-export';

    var blob = new Blob([xml], {type:'application/xml'});
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = name + '.drawio';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 1000);

    if (typeof toast === 'function')
      toast('✅ ' + tTask({ru:'Экспортировано в ',en:'Exported to '}) + name + '.drawio');
  }

  window.exportDrawio = downloadDrawio;

})();
