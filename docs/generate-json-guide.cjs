// Regenerate the source-derived settings catalog and a consistent full example.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const ctx = vm.createContext({console});
vm.runInContext(read('engine.js'), ctx);
vm.runInContext(read('catalog.js').split('const TMPLS=')[0], ctx);
const defs = vm.runInContext('SETTINGS_DEF', ctx);
const types = vm.runInContext('Object.keys(EL)', ctx);
let catalog = '';
const cell = x => String(x).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
for (const [type, settings] of Object.entries(defs)) {
  catalog += `\n### 20.${Object.keys(defs).indexOf(type) + 1}. \`${type}\`\n\n`;
  catalog += '| Ключ | Тип | Дефолт UI | Значения / диапазон | Назначение |\n|---|---|---|---|---|\n';
  for (const s of settings) {
    if (s.type === 'pat') continue;
    const kind = {num:'number',tog:'boolean',sel:'string enum',txt:'string'}[s.type] || s.type;
    const range = s.opts ? s.opts.map(x => '`' + x + '`').join(', ') : s.type === 'tog' ? '`true`, `false`' : s.min != null ? `${s.min}…${s.max}` : 'строка';
    catalog += `| \`${s.k}\` | ${kind} | ${s.def === undefined ? 'не задано' : '`' + JSON.stringify(s.def) + '`'} | ${cell(range)} | ${cell(s.hint || s.lbl)} |\n`;
  }
}
const uuid = '550e8400-e29b-41d4-a716-446655440000';
const itemId = '550e8400-e29b-41d4-a716-446655440001';
const time = '2026-11-05T09:00:00Z';
const block = (id,type,name,x,y,extra={}) => ({id,type,customLabel:name,x,y,w:200,h:64,patterns:[],settings:{},...extra});
const field = (name,type,constraints,extra={}) => ({name,type,constraints,...(/\bPK\b/.test(constraints)?{pk:true}:{}),...(/\bNN\b/.test(constraints)?{notNull:true}:{}),...(/\bUQ\b/.test(constraints)?{unique:true}:{}),...extra});
const params = [{name:'product_id',label:'Товар',type:'string',required:true,in:'body',desc:'UUID товара'}, {name:'quantity',label:'Количество',type:'integer',required:true,in:'body',desc:'Положительное число'}];
const api = {name:'Создать заказ',desc:'Регистрирует заказ',verb:'POST',uri:'/api/v1/orders',resp:'201 {id,status}',success:'201 Created',params,codes:['400 Некорректный запрос','409 Конфликт идемпотентности']};
const getApi = {name:'Получить заказ',verb:'GET',uri:'/api/v1/orders/{id}',resp:'200 {id,status,total_amount}',params:[{name:'id',label:'ID заказа',type:'string',required:true,in:'path',desc:'UUID заказа'}],codes:['404 Заказ не найден']};
const step = (name,verb='',uri='',resp='',extra={}) => ({name,verb,uri,resp,...extra});
const conn = (id,from,to,method) => ({id,from,to,...(method?{method}: {})});
const scenario = (id,name,color,path,steps,volume=50,actorId='b1') => ({id,name,color,actorId,volume,visible:true,path,steps});
const example = {
  meta:{systemName:'Заказы и уведомления',version:'v1',author:'',domain:'e-commerce',description:'Демонстрация формата: создание заказа, чтение, кэш, событие и уведомление. Публикация и обработка показаны отдельными маршрутами. Это учебная модель; интенсивность демонстрационных маршрутов суммируется в режиме Реализм.',problem:'Принимать заказы и отправлять уведомления без ожидания внешнего почтового провайдера.',solution:'REST-сервис с PostgreSQL и Redis, асинхронный consumer Kafka.',userRoles:[{name:'Покупатель',can:['Создать заказ','Просмотреть заказ']}],requirements:[{text:'Пример нагрузки: 100 операций создания заказа в секунду в режиме Реализм.',card:'NFR-1'},{text:'Повторы сообщений обрабатываются идемпотентно.',card:'NFR-2'}]},
  blocks:[
    block('b1','actor','Покупатель',40,160),
    block('b2','web_client','Веб-приложение',300,160,{tech:'Browser SPA'}),
    block('b3','api_gw','API Gateway',560,160,{tech:'HTTP Gateway',patterns:['timeout','rate_limit'],settings:{instances:2,auth_mode:'Нет (публичное API)',rate_limit_rps:1000}}),
    block('b4','service','Сервис заказов',820,160,{tech:'Node.js',desc:'Создаёт и читает заказы, использует кэш и публикует события.',patterns:['timeout','circuit_breaker','cache_aside'],settings:{replicas:3,conn_pool:10,write_share:20},components:[
      {id:'cmp_orders_controller',name:'OrdersController',kind:'ctrl',funcs:['createOrder(request)','getOrder(id)'],uses:['cmp_orders_service']},
      {id:'cmp_orders_service',name:'OrdersService',kind:'uc',funcs:['createOrder(command)','getOrder(id)'],uses:['cmp_orders_repository','cmp_orders_cache','cmp_orders_producer']},
      {id:'cmp_orders_repository',name:'OrdersRepository',kind:'repo',funcs:['insert(order)','findById(id)']},
      {id:'cmp_orders_cache',name:'OrdersCache',kind:'cache',funcs:['get(id)','invalidate(id)']},
      {id:'cmp_orders_producer',name:'OrderEventsProducer',kind:'prod',funcs:['publishOrderCreated(event)']}
    ]}),
    block('b5','postgresql','Orders DB',1100,160,{settings:{pgbouncer:true,max_connections:100,replicas:2,write_share:20,isolation:'READ COMMITTED'},dbSchema:{tables:[
      {name:'orders',fields:[field('id','UUID','PK',{default:'gen_random_uuid()',desc:'ID заказа',example:uuid}),field('customer_id','UUID','NN',{desc:'Идентификатор покупателя из внешнего контекста'}),field('status','VARCHAR(24)','NN',{default:"'pending'",example:'pending'}),field('total_amount','DECIMAL(12,2)','NN',{desc:'Итоговая сумма',example:'1500.00'}),field('idempotency_key','VARCHAR(64)','NN, UQ'),field('version','INTEGER','NN',{default:'1'}),field('created_at','TIMESTAMPTZ','NN',{default:'NOW()'}),field('updated_at','TIMESTAMPTZ','NN',{default:'NOW()'})],indexes:['CREATE UNIQUE INDEX uq_orders_idempotency ON orders(idempotency_key)','CREATE INDEX idx_orders_customer ON orders(customer_id)']},
      {name:'order_items',fields:[field('id','UUID','PK'),field('order_id','UUID','NN, FK',{fk:{table:'orders',field:'id'}}),field('product_id','UUID','NN',{desc:'ID товара внешнего каталога, без локального FK'}),field('quantity','INTEGER','NN'),field('unit_price','DECIMAL(12,2)','NN')],indexes:['CREATE INDEX idx_order_items_order ON order_items(order_id)']}
    ]},dbRows:{orders:[{id:uuid,customer_id:'550e8400-e29b-41d4-a716-446655440010',status:'pending',total_amount:'1500.00',idempotency_key:'demo-order-001',version:1,created_at:time,updated_at:time}],order_items:[{id:itemId,order_id:uuid,product_id:'550e8400-e29b-41d4-a716-446655440020',quantity:2,unit_price:'750.00'}]}}),
    block('b6','redis','Orders Cache',1100,340,{settings:{persistence:'RDB',eviction:'allkeys-LFU',hit_rate:95,maxmemory:'1gb',dataset:'512mb'},redisSchema:{patterns:[{key:'order:{id}',type:'Hash',ttl:300,desc:'Краткая карточка заказа',writer:'Сервис заказов',reader:'Сервис заказов',keyVars:{id:'b5::orders.id'},fields:[{name:'status',desc:'Статус',fromPg:'b5::orders.status'},{name:'total_amount',desc:'Сумма',fromPg:'b5::orders.total_amount'}]}]},dbRows:{__redis__:[{key:'order:'+uuid,type:'Hash',value:'{"status":"pending","total_amount":"1500.00"}',ttl:300}]}}),
    block('b7','kafka','orders.created',1100,520,{settings:{topic_name:'orders.created',partitions:6,replication:3,brokers:3,min_insync:2,acks:'all',delivery:'at-least-once',key_strategy:'by-entity',assignor:'cooperative-sticky',poll_rate:6,cleanup:'delete',retention_msgs:300,retry_dlq:true,max_retries:3}}),
    block('b8','service','Уведомления',1380,520,{tech:'Go',desc:'Идемпотентно обрабатывает orders.created и отправляет письмо.',patterns:['timeout','retry','circuit_breaker'],settings:{replicas:2},components:[{id:'cmp_notify_consumer',name:'OrderEventsConsumer',kind:'cons',funcs:['consumeOrderCreated(event)'],uses:['cmp_notify_service']},{id:'cmp_notify_service',name:'NotificationService',kind:'uc',funcs:['sendOrderEmail(event)'],uses:['cmp_notify_repository','cmp_notify_email']},{id:'cmp_notify_repository',name:'NotificationsRepository',kind:'repo',funcs:['save(notification)']},{id:'cmp_notify_email',name:'EmailClient',kind:'cli',funcs:['send(message)']}]}),
    block('b9','postgresql','Notifications DB',1660,520,{settings:{pgbouncer:true,max_connections:100,replicas:0},dbSchema:{tables:[{name:'notifications',fields:[field('id','UUID','PK'),field('event_id','UUID','NN, UQ',{desc:'Ключ дедупликации события'}),field('order_id','UUID','NN',{desc:'ID заказа из другой сервисной БД, без локального FK'}),field('status','VARCHAR(24)','NN'),field('created_at','TIMESTAMPTZ','NN',{default:'NOW()'})],indexes:['CREATE UNIQUE INDEX uq_notifications_event ON notifications(event_id)']}]},dbRows:{notifications:[{id:'550e8400-e29b-41d4-a716-446655440030',event_id:'550e8400-e29b-41d4-a716-446655440040',order_id:uuid,status:'sent',created_at:time}]}}),
    block('b10','external','Email Provider',1660,700,{tech:'HTTPS API',desc:'Внешняя отправка почты'})
  ],
  conns:[conn('c1','b1','b2'),conn('c2','b2','b3',api),conn('c3','b3','b4',api),conn('c4','b4','b5'),conn('c5','b4','b6'),conn('c6','b4','b7'),conn('c7','b7','b8'),conn('c8','b8','b9'),conn('c9','b8','b10',{name:'Отправить письмо',verb:'POST',uri:'/messages',resp:'202 {messageId}',codes:['429 Лимит провайдера','503 Недоступен']})],
  scenarios:[
    scenario('sc1','Создать заказ','#7aa2f7',['b1','b2','b3','b4','b5'],[step('Оформить заказ'),step(api.name,api.verb,api.uri,api.resp,{params,codes:api.codes}),step(api.name,api.verb,api.uri,api.resp,{params,codes:api.codes}),step('Сохранить заказ','INSERT','orders','id заказа')],100),
    scenario('sc2','Прочитать заказ из БД','#e0af68',['b1','b2','b3','b4','b5'],[step('Открыть заказ'),step(getApi.name,'GET',getApi.uri,getApi.resp,{params:getApi.params,codes:getApi.codes}),step(getApi.name,'GET',getApi.uri,getApi.resp,{params:getApi.params,codes:getApi.codes}),step('Найти заказ','SELECT','orders','row|null')]),
    scenario('sc3','Прочитать заказ: cache HIT','#9ece6a',['b1','b2','b3','b4','b6'],[step('Открыть заказ'),step('Получить карточку','GET',getApi.uri,getApi.resp),step('Передать чтение','GET',getApi.uri,getApi.resp),step('Прочитать кэш','HGETALL','order:{id}','{status,total_amount}')]),
    scenario('sc4','Опубликовать созданный заказ','#bb9af7',['b4','b7'],[step('Опубликовать событие','PUBLISH','orders.created','')],100,null),
    scenario('sc5','Обработать событие: сохранить уведомление','#2ac3de',['b7','b8','b9'],[step('Принять событие','CONSUME','orders.created',''),step('Зафиксировать уведомление','INSERT','notifications','id уведомления')],100,null),
    scenario('sc6','Отправить письмо через провайдера','#ff9e64',['b8','b10'],[step('Отправить письмо','POST','/messages','202 {messageId}',{codes:['429 Лимит провайдера','503 Недоступен']})],100,null)
  ],
  notationMode:'c4',
  bpmn:{diagrams:[{id:'bp1',name:'Оформление заказа',elements:[
    {id:'be1',type:'pool',label:'Интернет-магазин',x:40,y:40,w:1120,h:400},
    {id:'be2',type:'lane',label:'Покупатель',x:70,y:80,w:1070,h:140},
    {id:'be3',type:'lane',label:'Обработка заказов',x:70,y:220,w:1070,h:190},
    {id:'be4',type:'start',label:'Начало',x:110,y:125,w:44,h:44},
    {id:'be5',type:'task_user',label:'Оформить заказ',x:220,y:115,w:150,h:64},
    {id:'be6',type:'task_service',label:'Проверить данные',x:430,y:255,w:150,h:64},
    {id:'be7',type:'gateway_xor',label:'Корректны?',x:640,y:262,w:50,h:50},
    {id:'be8',type:'task_service',label:'Зарегистрировать заказ',x:770,y:245,w:170,h:64},
    {id:'be9',type:'end',label:'Заказ принят',x:1040,y:255,w:44,h:44},
    {id:'be10',type:'end',label:'Исправить данные',x:650,y:345,w:44,h:44}
  ],flows:[{id:'bf1',from:'be4',to:'be5'},{id:'bf2',from:'be5',to:'be6'},{id:'bf3',from:'be6',to:'be7'},{id:'bf4',from:'be7',to:'be8',label:'Да'},{id:'bf5',from:'be7',to:'be10',label:'Нет'},{id:'bf6',from:'be8',to:'be9'}]}],currentDiagramId:'bp1'}
};

// Check the example against the real file importer and component normalizer.
vm.runInContext('var S={},HIST=[],HI=-1; function defaultMeta(){return {}}; function pushHist(){}; function analyze(){}; function tTask(o){return o.en}',ctx);
const zoom = read('c4-zoom.js');
vm.runInContext("const ZS_KINDS=['ctrl','cons','uc','repo','cache','prod','cli'];\n" + zoom.slice(zoom.indexOf('function normalizeComponents('), zoom.indexOf('// ── правая панель')),ctx);
const boot = read('bootstrap.js');
vm.runInContext(boot.slice(boot.indexOf('function normalizeScenarios('),boot.indexOf('function openPasteJSON(')),ctx);
vm.runInContext(boot.slice(boot.indexOf('function normalizeBpmn('),boot.indexOf("$('fi').onchange")),ctx);
ctx.input = JSON.parse(JSON.stringify(example));
const report = vm.runInContext("importProjectData(input,'guide',{quiet:true})",ctx);
assert.equal(report.droppedBlocks,0);assert.equal(report.unknown.length,0);assert.equal(report.droppedConns.length,0);assert.equal(report.dupIds,0);
const imported = vm.runInContext('S',ctx);
assert.deepEqual(JSON.parse(JSON.stringify(imported.blocks)),example.blocks);
assert.deepEqual(JSON.parse(JSON.stringify(imported.conns)),example.conns);
for (const b of example.blocks) {
  assert(types.includes(b.type));
  const tables=b.dbSchema?.tables||[];
  for(const t of tables) for(const f of t.fields) if(f.fk) assert(tables.some(x=>x.name===f.fk.table&&x.fields.some(y=>y.name===f.fk.field)));
}
const ids = new Set(example.blocks.map(b=>b.id));
for (const s of example.scenarios) {
  assert.equal(s.steps.length,s.path.length-1);
  s.path.forEach(id=>assert(ids.has(id)));
  for(let i=0;i<s.path.length-1;i++)assert(example.conns.some(c=>c.from===s.path[i]&&c.to===s.path[i+1]));
}
for(const b of example.blocks)for(const o of example.blocks)if(b.id<o.id)assert(!(b.x<o.x+o.w&&b.x+b.w>o.x&&b.y<o.y+o.h&&b.y+b.h>o.y),'Block overlap');
const bp=example.bpmn.diagrams[0],pool=bp.elements.find(e=>e.type==='pool');
for(const e of bp.elements.filter(e=>!['pool','lane'].includes(e.type))){assert(e.x>=pool.x&&e.x+e.w<=pool.x+pool.w&&e.y>=pool.y&&e.y+e.h<=pool.y+pool.h);assert(bp.elements.some(l=>l.type==='lane'&&e.x>=l.x&&e.x+e.w<=l.x+l.w&&e.y>=l.y&&e.y+e.h<=l.y+l.h));}
vm.runInContext(read('bpmn.js'),ctx);
ctx.processExample=bp;
const bpmnIssues=vm.runInContext('bpmnValidate(processExample)',ctx);
assert.equal(bpmnIssues.length,0,JSON.stringify(bpmnIssues));
fs.writeFileSync(path.join(__dirname,'raptor-full-example.json'),JSON.stringify(example,null,2)+'\n');
let guide=read('RAPTOR_AI_JSON_GUIDE.md');
guide=guide.replace(/<!-- GENERATED_SETTINGS -->[\s\S]*?(?=\n## 21\.)/,'<!-- GENERATED_SETTINGS -->\n'+catalog+'\n');
guide=guide.replace(/<!-- GENERATED_EXAMPLE -->[\s\S]*$/,'<!-- GENERATED_EXAMPLE -->\n\n```json\n'+JSON.stringify(example,null,2)+'\n```\n');
fs.writeFileSync(path.join(root,'RAPTOR_AI_JSON_GUIDE.md'),guide);
console.log(`Guide generated. Real importer preserved ${report.blocks} blocks and ${report.conns} connections; ${example.scenarios.length} scenarios checked; actual BPMN validator: ${bpmnIssues.length} issues.`);
