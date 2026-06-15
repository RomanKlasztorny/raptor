// ╔═══════════════════════════════════════════════════════════╗
// ║  ТРЕНАЖЁР: 100 задач (Junior + Middle) с автопроверкой      ║
// ╚═══════════════════════════════════════════════════════════╝

// ── HELPER-API для проверок (короткие, надёжные) ──────────────
function TH(){
  computeFlow(S.blocks,S.conns,S.load);
  const B=S.blocks,C=S.conns;
  const tp=id=>gb(id)?.type;
  const ct=id=>EL[gb(id)?.type]?.cat;
  return {
    n:B.length, nc:C.length, load:S.load, B,C,
    has:t=>B.some(b=>b.type===t),
    hasCat:c=>B.some(b=>EL[b.type].cat===c),
    count:t=>B.filter(b=>b.type===t).length,
    countCat:c=>B.filter(b=>EL[b.type].cat===c).length,
    // прямая связь по типам
    link:(ft,tt)=>C.some(c=>tp(c.from)===ft&&tp(c.to)===tt),
    // прямая связь по категориям
    linkC:(fc,tc)=>C.some(c=>ct(c.from)===fc&&ct(c.to)===tc),
    noLinkC:(fc,tc)=>!C.some(c=>ct(c.from)===fc&&ct(c.to)===tc),
    // сколько связей кат→кат
    cntLinkC:(fc,tc)=>C.filter(c=>ct(c.from)===fc&&ct(c.to)===tc).length,
    // у каждого блока категории cat есть исходящая связь к tc
    eachCatLinksTo:(fc,tc)=>{const src=B.filter(b=>EL[b.type].cat===fc);return src.length>0&&src.every(s=>C.some(c=>c.from===s.id&&ct(c.to)===tc));},
    pattern:p=>B.some(b=>(b.patterns||[]).includes(p)),
    patternOn:(t,p)=>B.some(b=>b.type===t&&(b.patterns||[]).includes(p)),
    patternOnCat:(cat,p)=>B.some(b=>EL[b.type].cat===cat&&(b.patterns||[]).includes(p)),
    setEq:(t,k,v)=>B.some(b=>b.type===t&&(b.settings?.[k]===v)),
    setGTE:(t,k,v)=>B.some(b=>b.type===t&&((b.settings?.[k]??0)>=v)),
    setGTEcat:(cat,k,v)=>B.some(b=>EL[b.type].cat===cat&&((b.settings?.[k]??0)>=v)),
    // путь от источника до типа toType проходящий через каждую кат из mid (по порядку)
    pathTo:(toCat)=>{const hasInc=new Set(C.map(c=>c.to));const src=B.filter(b=>!hasInc.has(b.id));const adj={};B.forEach(b=>adj[b.id]=[]);C.forEach(c=>adj[c.from]?.push(c.to));const seen=new Set();const st=[...src.map(s=>s.id)];while(st.length){const id=st.pop();if(seen.has(id))continue;seen.add(id);if(EL[gb(id)?.type]?.cat===toCat)return true;(adj[id]||[]).forEach(n=>st.push(n));}return false;},
    // здоровье
    noErr:()=>B.length>0&&B.every(b=>b.rt.health!=='error'),
    noCascade:()=>B.every(b=>!b.rt.cascade),
    allOk:()=>B.length>0&&B.every(b=>b.rt.health==='ok'),
    typeNoErr:t=>{const f=B.filter(b=>b.type===t);return f.length>0&&f.every(b=>b.rt.health!=='error');},
    catNoErr:c=>{const f=B.filter(b=>EL[b.type].cat===c);return f.length>0&&f.every(b=>b.rt.health!=='error');},
    overloaded:()=>B.filter(b=>b.rt.health==='error').map(b=>b.customLabel||EL[b.type].lbl),
    cascading:()=>B.filter(b=>b.rt.cascade).map(b=>b.customLabel||EL[b.type].lbl),
    // нет критических антипаттернов
    noBad:()=>!C.some(c=>{const r=badConn(EL[gb(c.from)?.type],EL[gb(c.to)?.type]);return r&&r.sev==='error';}),
  };
}
const OK=m=>({ok:true,msg:m||'Готово! ✅'});
const NO=m=>({ok:false,msg:m});

// ── 100 ЗАДАЧ ─────────────────────────────────────────────────
const TASKS=[
// ═══════════ JUNIOR (1-50): основы с нуля ═══════════
{lv:'junior',t:'Что такое клиент',goal:'Поставь один Web Client на холст',
 theory:'Клиент — это то, через что пользователь заходит в систему: браузер или приложение. Он НИЧЕГО не хранит и не считает сам — только шлёт запросы серверу и показывает ответ.',
 tip:'В палитре слева: 🌐 Клиент → Web Client. Кликни, потом кликни на холст.',load:1,
 check:H=>H.has('web_client')?OK('Это точка входа пользователя. Дальше он будет слать запросы.'):NO('Добавь блок Web Client из палитры')},

{lv:'junior',t:'Что такое сервис',goal:'Добавь один Сервис',
 theory:'Сервис (сервер) — программа, которая принимает запросы и выполняет логику: считает, проверяет, готовит ответ. Это "мозг" системы.',
 tip:'⚙ Сервисы → Сервис',load:1,
 check:H=>H.has('service')?OK('Сервис — где живёт бизнес-логика.'):NO('Добавь блок Сервис')},

{lv:'junior',t:'Первая связь',goal:'Соедини Web Client → Сервис',
 theory:'Связь = поток запросов. Клиент отправляет запрос сервису, сервис отвечает. Чтобы соединить: наведи на блок, потяни от белого кружка ○ справа к другому блоку.',
 tip:'Наведи на Web Client → потяни от ○ к Сервису',load:1,
 check:H=>H.link('web_client','service')?OK('Запрос пошёл от клиента к сервису!'):NO('Протяни связь от Web Client к Сервису')},

{lv:'junior',t:'Что такое база данных',goal:'Добавь PostgreSQL',
 theory:'БД хранит данные навсегда (в отличие от сервиса, который ничего не помнит между запросами). PostgreSQL — самая популярная реляционная БД.',
 tip:'🗄 БД → PostgreSQL',load:1,
 check:H=>H.has('postgresql')?OK('Теперь есть где хранить данные.'):NO('Добавь PostgreSQL')},

{lv:'junior',t:'Сервис и его БД',goal:'Соедини Сервис → PostgreSQL',
 theory:'Сервис сам не хранит данные — он читает и пишет их в БД. Это нормальная связь: сервис владеет своей базой.',
 tip:'Потяни от Сервиса к PostgreSQL',load:1,
 check:H=>H.link('service','postgresql')?OK('Сервис теперь умеет сохранять данные.'):NO('Соедини Сервис с PostgreSQL')},

{lv:'junior',t:'Первая цепочка',goal:'Собери: Web Client → Сервис → PostgreSQL',
 theory:'Это базовая схема почти любого приложения: клиент шлёт запрос → сервис обрабатывает → БД хранит. Запусти симуляцию (▶) и увидишь как полетят шарики-запросы.',
 tip:'Должны быть обе связи: клиент→сервис и сервис→БД',load:1,
 check:H=>H.link('web_client','service')&&H.link('service','postgresql')?OK('Это фундамент. Нажми ▶ и посмотри на запросы!'):NO('Нужны связи: Web Client→Сервис И Сервис→PostgreSQL')},

{lv:'junior',t:'Зачем нужен Gateway',goal:'Добавь API Gateway',
 theory:'Когда сервисов много, клиенту неудобно знать адрес каждого. API Gateway — единая дверь: клиент стучится туда, а Gateway направляет запрос нужному сервису. Ещё он проверяет авторизацию.',
 tip:'🔗 Сеть → API Gateway',load:1,
 check:H=>H.has('api_gw')?OK('Gateway — охранник и регулировщик на входе.'):NO('Добавь API Gateway')},

{lv:'junior',t:'Gateway на входе',goal:'Собери: Client → Gateway → Сервис (без прямой связи клиент→сервис)',
 theory:'Правильно: клиент общается ТОЛЬКО с Gateway, а тот уже с сервисами. Так сервисы спрятаны за дверью с охраной.',
 tip:'Client→Gateway, Gateway→Сервис. Прямую связь клиент→сервис убери (2× клик по стрелке удаляет)',load:1,
 check:H=>H.linkC('client','gw')&&H.linkC('gw','svc')&&H.noLinkC('client','svc')?OK('Теперь вход защищён единой дверью.'):!H.linkC('client','gw')?NO('Соедини клиента с Gateway'):!H.linkC('gw','svc')?NO('Соедини Gateway с Сервисом'):NO('Убери прямую связь Клиент→Сервис (она лишняя)')},

{lv:'junior',t:'Антипаттерн: клиент и БД',goal:'Собери Client→Gateway→Сервис→БД без прямых связей клиента с БД',
 theory:'⛔ Клиент НИКОГДА не должен лезть в БД напрямую — это дыра в безопасности (любой получит доступ к данным). Между ними всегда Gateway и сервис.',
 tip:'Полная цепочка через Gateway и сервис, без client→db',load:1,
 check:H=>H.linkC('client','gw')&&H.linkC('gw','svc')&&H.linkC('svc','db')&&H.noLinkC('client','db')&&H.noLinkC('client','cache')?OK('Безопасно: данные спрятаны за сервисом.'):H.linkC('client','db')?NO('⛔ Убери связь Клиент→БД, это опасно'):NO('Собери полную цепочку Client→Gateway→Сервис→БД')},

{lv:'junior',t:'Мобильный клиент',goal:'Добавь Mobile и подключи его тоже к Gateway',
 theory:'У одной системы много клиентов: сайт, мобилка. Все они ходят через один Gateway. Это удобно — логика входа в одном месте.',
 tip:'Добавь Mobile, соедини с Gateway',load:1,
 check:H=>H.has('mob_client')&&H.cntLinkC('client','gw')>=2?OK('Оба клиента ходят через общую дверь.'):!H.has('mob_client')?NO('Добавь Mobile'):NO('Соедини Mobile с Gateway')},

{lv:'junior',t:'Несколько сервисов',goal:'Сделай 2 сервиса, оба подключены к Gateway',
 theory:'Микросервисы: вместо одного огромного сервиса — несколько маленьких, каждый за своё. Например: сервис заказов, сервис оплаты. Gateway направляет запрос нужному.',
 tip:'2 блока Сервис, оба от Gateway. Переименуй их 2× кликом... хотя нет — 2× клик это настройки. ПКМ → Переименовать',load:1,
 check:H=>H.count('service')>=2&&H.cntLinkC('gw','svc')>=2?OK('Gateway роутит запросы между сервисами.'):H.count('service')<2?NO('Нужно 2 сервиса'):NO('Подключи оба сервиса к Gateway')},

{lv:'junior',t:'Своя БД каждому',goal:'2 сервиса, у каждого СВОЯ PostgreSQL',
 theory:'Правило микросервисов: у каждого сервиса своя БД. Сервисы не лезут в чужие базы — только через API друг друга. Это "Database per Service".',
 tip:'2 сервиса + 2 БД, каждый сервис→своя БД',load:1,
 check:H=>H.count('service')>=2&&H.countCat('db')>=2&&H.cntLinkC('svc','db')>=2?OK('Каждый владеет своими данными — это изоляция.'):H.countCat('db')<2?NO('Нужно 2 БД (по одной на сервис)'):NO('Соедини каждый сервис со своей БД')},

{lv:'junior',t:'Что такое кэш',goal:'Добавь Redis и соедини Сервис → Redis',
 theory:'Redis хранит данные в оперативной памяти — это в 10 раз быстрее БД (0.1мс против 1мс). Используется как кэш: часто запрашиваемые данные держим в Redis, чтобы не дёргать БД.',
 tip:'🗄 БД → Redis, соедини с сервисом',load:1,
 check:H=>H.has('redis')&&H.link('service','redis')?OK('Redis ускорит ответы и разгрузит БД.'):!H.has('redis')?NO('Добавь Redis'):NO('Соедини Сервис с Redis')},

{lv:'junior',t:'Cache Aside',goal:'Сервис с Redis И PostgreSQL, включи паттерн Cache Aside на сервисе',
 theory:'Cache Aside: сервис сначала смотрит в Redis. Есть данные (попадание) — отдаёт сразу. Нет (промах) — берёт из БД и кладёт в Redis. До БД доходит лишь ~20% запросов!',
 tip:'Сервис→Redis, Сервис→PostgreSQL. 2× клик на сервис → включи Cache Aside',load:1,
 check:H=>H.link('service','redis')&&H.link('service','postgresql')&&H.patternOn('service','cache_aside')?OK('80% запросов теперь не доходят до БД — огромная экономия.'):!H.link('service','redis')?NO('Соедини сервис с Redis'):!H.link('service','postgresql')?NO('Соедини сервис с PostgreSQL'):NO('Включи Cache Aside в настройках сервиса (2× клик)')},

{lv:'junior',t:'БД для транзакций',goal:'Для денег/заказов выбери PostgreSQL: Client→Gateway→Сервис→PostgreSQL',
 theory:'Для финансов и заказов нужны ACID-транзакции (либо всё прошло, либо ничего). Это умеет PostgreSQL. NoSQL вроде MongoDB тут не подходит.',
 tip:'Полная цепочка с PostgreSQL на конце',load:1,
 check:H=>H.linkC('client','gw')&&H.linkC('gw','svc')&&H.link('service','postgresql')?OK('PostgreSQL — правильный выбор для транзакций.'):NO('Собери Client→Gateway→Сервис→PostgreSQL')},

{lv:'junior',t:'БД для аналитики',goal:'Для отчётов/аналитики добавь ClickHouse и соедини с сервисом',
 theory:'Для аналитики (суммы, графики по миллионам строк) PostgreSQL медленный. ClickHouse — колоночная БД, считает агрегаты в 100 раз быстрее.',
 tip:'🗄 БД → ClickHouse',load:1,
 check:H=>H.has('clickhouse')&&H.link('service','clickhouse')?OK('ClickHouse — для аналитики и отчётов.'):!H.has('clickhouse')?NO('Добавь ClickHouse'):NO('Соедини сервис с ClickHouse')},

{lv:'junior',t:'БД для событий/логов',goal:'Добавь Cassandra и соедини с сервисом',
 theory:'Для огромного потока записи (логи, события, метрики, история) — Cassandra. Она пишет 100К+ в секунду и легко масштабируется. Но JOIN и транзакций нет.',
 tip:'🗄 БД → Cassandra',load:1,
 check:H=>H.has('cassandra')&&H.link('service','cassandra')?OK('Cassandra — для time-series и логов.'):!H.has('cassandra')?NO('Добавь Cassandra'):NO('Соедини сервис с Cassandra')},

{lv:'junior',t:'CDN для статики',goal:'Добавь CDN и соедини Web Client → CDN',
 theory:'Картинки, видео, JS-файлы не нужно гонять с сервера каждый раз. CDN держит их копии по всему миру, близко к пользователю. Очень быстро и разгружает сервер.',
 tip:'🔗 Сеть → CDN, соедини с Web Client',load:1,
 check:H=>H.has('cdn')&&H.link('web_client','cdn')?OK('Статика теперь летит из ближайшей точки.'):!H.has('cdn')?NO('Добавь CDN'):NO('Соедини Web Client с CDN')},

{lv:'junior',t:'Что такое Load Balancer',goal:'Добавь Load Balancer',
 theory:'Когда одного сервиса мало, запускают несколько копий (реплик). Load Balancer распределяет запросы между ними поровну — чтобы ни одна не перегрузилась.',
 tip:'🔗 Сеть → Load Balancer',load:1,
 check:H=>H.has('lb')?OK('LB будет делить нагрузку между репликами.'):NO('Добавь Load Balancer')},

{lv:'junior',t:'LB перед сервисами',goal:'Собери Gateway → Load Balancer → 2 Сервиса',
 theory:'LB ставится ПЕРЕД группой одинаковых сервисов. Gateway → LB → [Сервис1, Сервис2]. LB раскидывает запросы между ними.',
 tip:'Gateway→LB, LB→каждый из 2 сервисов',load:1,
 check:H=>H.linkC('gw','net')&&H.cntLinkC('net','svc')>=2?OK('LB делит нагрузку на 2 сервиса.'):!H.linkC('gw','net')?NO('Соедини Gateway с Load Balancer'):NO('Соедини LB с двумя сервисами')},

{lv:'junior',t:'Реплики сервиса',goal:'Поставь сервису 3 реплики (в настройках)',
 theory:'Реплика — копия сервиса. 3 реплики = тройная ёмкость. Это главный способ масштабирования. Открой настройки сервиса (2× клик) и увеличь "Реплики".',
 tip:'2× клик на сервис → Реплики → 3',load:1,
 check:H=>H.setGTE('service','replicas',3)?OK('Теперь сервис держит в 3 раза больше нагрузки.'):NO('В настройках сервиса (2× клик) поставь Реплики = 3')},

{lv:'junior',t:'PgBouncer',goal:'Включи PgBouncer на PostgreSQL',
 theory:'PgBouncer — пул соединений. PostgreSQL плохо держит много одновременных подключений. PgBouncer их переиспользует → ёмкость ×5. Обязателен на проде.',
 tip:'2× клик на PostgreSQL → включи PgBouncer',load:1,
 check:H=>H.setEq('postgresql','pgbouncer',true)?OK('Ёмкость БД выросла с 10К до 50К rps.'):NO('Включи PgBouncer в настройках PostgreSQL')},

{lv:'junior',t:'Read Replica',goal:'Добавь PostgreSQL хотя бы 1 Read Replica (настройка)',
 theory:'Реплика чтения — копия БД только для чтения. Запись идёт в мастер, чтение — с реплик. Снимает 70%+ нагрузки, ведь чтений обычно намного больше.',
 tip:'2× клик на PostgreSQL → Read Replicas → 1+',load:1,
 check:H=>H.setGTE('postgresql','replicas',1)?OK('Чтения теперь разгружают мастер.'):NO('В настройках PostgreSQL поставь Read Replicas ≥ 1')},

{lv:'junior',t:'Здоровая мини-система',goal:'Client→Gateway→Сервис→{Redis, PostgreSQL}, всё зелёное при ×1',
 theory:'Соберём законченную базовую систему. При нагрузке ×1 (1 запрос/сек) всё должно быть зелёным — никто не перегружен.',
 tip:'Сервис связан и с Redis, и с PostgreSQL. Запас огромный.',load:1,
 check:H=>H.linkC('client','gw')&&H.linkC('gw','svc')&&H.link('service','redis')&&H.link('service','postgresql')&&H.noErr()?OK('Полноценная базовая архитектура готова!'):!H.link('service','redis')?NO('Добавь Redis к сервису'):!H.link('service','postgresql')?NO('Добавь PostgreSQL к сервису'):NO('Собери всю цепочку через Gateway')},

{lv:'junior',t:'Что такое BFF',goal:'Добавь BFF между клиентом и сервисом: Client→BFF→Сервис',
 theory:'BFF (Backend For Frontend) — бэкенд под конкретный клиент. Он собирает данные из нескольких сервисов в удобный для клиента формат. Один запрос вместо пяти.',
 tip:'⚙ Сервисы → BFF',load:1,
 check:H=>H.has('bff')&&H.linkC('client','svc')&&H.link('bff','service')?OK('BFF готовит данные специально под клиента.'):!H.has('bff')?NO('Добавь BFF'):NO('Собери Client→BFF→Сервис')},

{lv:'junior',t:'Брокер сообщений',goal:'Добавь Kafka и соедини Сервис → Kafka',
 theory:'Kafka — брокер для асинхронной связи. Сервис кидает событие в Kafka и НЕ ждёт — продолжает работать. Связь становится пунктирной (асинхронной).',
 tip:'📡 Брокеры → Kafka, соедини с сервисом. Стрелка станет пунктирной.',load:1,
 check:H=>H.has('kafka')&&H.link('service','kafka')?OK('Теперь сервис может слать события не ожидая ответа.'):!H.has('kafka')?NO('Добавь Kafka'):NO('Соедини Сервис с Kafka')},

{lv:'junior',t:'Producer и Consumer',goal:'Собери: Сервис(producer) → Kafka → Сервис(consumer)',
 theory:'Producer кладёт события в Kafka. Consumer их читает и обрабатывает в своём темпе. Они развязаны: если consumer тормозит, producer не страдает.',
 tip:'Сервис1→Kafka, Kafka→Сервис2',load:1,
 check:H=>H.link('service','kafka')&&H.linkC('broker','svc')?OK('Классическая событийная связь: producer → брокер → consumer.'):!H.link('service','kafka')?NO('Соедини сервис-producer с Kafka'):NO('Соедини Kafka с сервисом-consumer')},

{lv:'junior',t:'Уведомления через RabbitMQ',goal:'Сервис → RabbitMQ → Сервис уведомлений',
 theory:'RabbitMQ — брокер попроще, для задач: отправить email, push, SMS. Сервис кидает задачу, worker её разбирает. Для умеренных объёмов (до 50К/с).',
 tip:'📡 Брокеры → RabbitMQ',load:1,
 check:H=>H.has('rabbitmq')&&H.link('service','rabbitmq')&&H.linkC('broker','svc')?OK('Уведомления уйдут асинхронно, не тормозя основной поток.'):!H.has('rabbitmq')?NO('Добавь RabbitMQ'):NO('Собери Сервис→RabbitMQ→Сервис')},

{lv:'junior',t:'Документная БД',goal:'Добавь MongoDB и соедини с сервисом',
 theory:'MongoDB хранит JSON-документы без жёсткой схемы. Хороша для каталогов, профилей, контента — где структура данных гибкая. Но не для транзакций.',
 tip:'🗄 БД → MongoDB',load:1,
 check:H=>H.has('mongodb')&&H.link('service','mongodb')?OK('MongoDB — для гибких данных.'):!H.has('mongodb')?NO('Добавь MongoDB'):NO('Соедини сервис с MongoDB')},

{lv:'junior',t:'Не оставляй тупик',goal:'Убедись: ни один сервис не висит без связи с хранилищем (собери Client→GW→Сервис→БД)',
 theory:'Сервис без выхода к БД/брокеру — "тупик": запросу некуда идти дальше. Каждый сервис должен куда-то вести.',
 tip:'Сервис обязательно соедини с БД или брокером',load:1,
 check:H=>{const svc=H.B.filter(b=>EL[b.type].cat==='svc');const ok=svc.length>0&&svc.every(s=>S.conns.some(c=>c.from===s.id));return ok&&H.linkC('client','gw')?OK('Все сервисы ведут дальше — тупиков нет.'):NO('Каждый сервис должен иметь исходящую связь (к БД/брокеру), и собери цепочку от клиента')}},

{lv:'junior',t:'Синхронно или асинхронно',goal:'Сделай ОДНУ синхронную связь (Сервис→БД) и ОДНУ асинхронную (Сервис→Kafka)',
 theory:'Синхронно (сплошная стрелка): отправитель ждёт ответ. Асинхронно (пунктир, через брокер): отправил и забыл. Kafka делает связь асинхронной.',
 tip:'Сервис→PostgreSQL (сплошная) и Сервис→Kafka (пунктир)',load:1,
 check:H=>H.linkC('svc','db')&&H.link('service','kafka')?OK('Видишь разницу: к БД ждём (сплошная), в Kafka — нет (пунктир).'):!H.linkC('svc','db')?NO('Добавь синхронную связь Сервис→БД'):NO('Добавь асинхронную Сервис→Kafka')},

{lv:'junior',t:'Защити сервис: Gateway',goal:'Не оставляй сервис открытым: убери Client→Сервис, поставь Gateway',
 theory:'Сервис напрямую к клиенту — без авторизации и лимитов, открыт всему интернету. Всегда прячь сервисы за Gateway.',
 tip:'Client→Gateway→Сервис, без прямой client→service',load:1,
 check:H=>H.linkC('client','gw')&&H.linkC('gw','svc')&&H.noLinkC('client','svc')?OK('Сервис защищён за Gateway.'):H.linkC('client','svc')?NO('Убери прямую связь Клиент→Сервис'):NO('Поставь Gateway между клиентом и сервисом')},

{lv:'junior',t:'NATS для real-time',goal:'Добавь NATS и собери Сервис→NATS→Сервис',
 theory:'NATS — сверхлёгкий быстрый брокер (0.5мс). Идеален для IoT и real-time сообщений, где важна скорость, а не хранение истории как у Kafka.',
 tip:'📡 Брокеры → NATS',load:1,
 check:H=>H.has('nats')&&H.link('service','nats')&&H.linkC('broker','svc')?OK('NATS — для быстрых real-time сообщений.'):!H.has('nats')?NO('Добавь NATS'):NO('Собери Сервис→NATS→Сервис')},

{lv:'junior',t:'Очередь задач',goal:'Добавь Queue и собери Сервис→Queue→Сервис(worker)',
 theory:'Очередь (Queue) — для фоновых задач: генерация PDF, обработка картинок. Сервис кладёт задачу, worker берёт по одной и выполняет. Не тормозит пользователя.',
 tip:'📡 Брокеры → Queue',load:1,
 check:H=>H.has('queue')&&H.link('service','queue')&&H.linkC('queue','svc')?OK('Тяжёлые задачи уйдут в фон.'):!H.has('queue')?NO('Добавь Queue'):NO('Собери Сервис→Queue→Сервис')},

{lv:'junior',t:'Кэш разгружает БД',goal:'Поставь Redis перед PostgreSQL у сервиса с Cache Aside, проверь при ×1000',
 theory:'При ×1000 без кэша PostgreSQL (лимит 10К) ещё держит. Но кэш — хорошая привычка. Cache Aside + Redis = до БД доходит 20%.',
 tip:'Сервис→Redis, Сервис→PostgreSQL, Cache Aside вкл, нагрузка ×1000',load:1000,
 check:H=>H.patternOn('service','cache_aside')&&H.link('service','redis')&&H.link('service','postgresql')&&H.typeNoErr('postgresql')?OK('Кэш бережёт БД даже при росте нагрузки.'):NO('Сервис: Redis + PostgreSQL + Cache Aside включён')},

{lv:'junior',t:'Изоляция транзакций',goal:'Поставь PostgreSQL уровень изоляции SERIALIZABLE',
 theory:'Уровень изоляции — насколько транзакции защищены друг от друга. SERIALIZABLE — максимум (как будто по очереди), но медленнее. READ COMMITTED — быстрее, но возможны аномалии.',
 tip:'2× клик на PostgreSQL → Уровень изоляции → SERIALIZABLE',load:1,
 check:H=>H.setEq('postgresql','isolation','SERIALIZABLE')?OK('Транзакции максимально защищены (но ёмкость −40%).'):NO('Поставь изоляцию SERIALIZABLE в настройках PostgreSQL')},

{lv:'junior',t:'Redis: персистентность',goal:'Включи у Redis персистентность AOF',
 theory:'Redis хранит данные в RAM — при рестарте они пропадут. AOF записывает каждую операцию на диск, чтобы пережить перезапуск. Но это −30% скорости.',
 tip:'2× клик на Redis → Персистентность → AOF',load:1,
 check:H=>H.setEq('redis','persistence','AOF')?OK('Теперь Redis переживёт перезапуск.'):NO('Поставь Redis persistence = AOF')},

{lv:'junior',t:'Два клиента, один Gateway',goal:'Web + Mobile → Gateway → Сервис → БД, всё зелёное',
 theory:'Закрепим: разные клиенты, общий вход, сервис, БД. Полная типовая схема.',
 tip:'Оба клиента к Gateway, дальше сервис и БД',load:1,
 check:H=>H.cntLinkC('client','gw')>=2&&H.linkC('gw','svc')&&H.linkC('svc','db')&&H.noErr()?OK('Аккуратная многоклиентская система.'):NO('Web и Mobile → Gateway → Сервис → БД')},

{lv:'junior',t:'CDN + Gateway вместе',goal:'Web Client → CDN (статика) и Web Client → Gateway (API) → Сервис',
 theory:'Реальная схема: статика идёт через CDN, а запросы к данным (API) — через Gateway. Клиент использует оба пути.',
 tip:'Две связи от клиента: к CDN и к Gateway',load:1,
 check:H=>H.link('web_client','cdn')&&H.linkC('client','gw')&&H.linkC('gw','svc')?OK('Статика — через CDN, API — через Gateway. Грамотно.'):!H.link('web_client','cdn')?NO('Соедини клиента с CDN'):NO('И с Gateway, а Gateway с сервисом')},

{lv:'junior',t:'Сервис заказов и оплаты',goal:'Gateway → 2 сервиса (Заказы, Оплата), оплата связана через Kafka',
 theory:'Заказ создаётся синхронно, а оплата — асинхронно через Kafka (она долгая, внешняя). Order Service → Kafka → Payment Service.',
 tip:'GW→Order, Order→Kafka, Kafka→Payment. Переименуй через ПКМ.',load:1,
 check:H=>H.count('service')>=2&&H.cntLinkC('gw','svc')>=1&&H.link('service','kafka')&&H.linkC('broker','svc')?OK('Оплата развязана через Kafka — надёжно.'):H.count('service')<2?NO('Нужно 2 сервиса'):!H.link('service','kafka')?NO('Соедини сервис с Kafka'):NO('Kafka→второй сервис (оплата)')},

{lv:'junior',t:'MongoDB для каталога',goal:'Сервис каталога → MongoDB, сервис заказов → PostgreSQL',
 theory:'Разным сервисам — разные БД под их задачи. Каталог (гибкие карточки товаров) → MongoDB. Заказы (транзакции) → PostgreSQL. Это polyglot persistence.',
 tip:'2 сервиса, один→MongoDB, другой→PostgreSQL',load:1,
 check:H=>H.link('service','mongodb')&&H.link('service','postgresql')&&H.count('service')>=2?OK('Каждому сервису — подходящая БД.'):NO('Сервис→MongoDB и другой Сервис→PostgreSQL')},

{lv:'junior',t:'Elasticsearch для поиска',goal:'Сервис поиска → подключи хранилище для поиска',
 theory:'Для полнотекстового поиска (искать по словам в товарах) обычные БД медленные. Тут добавили бы Elasticsearch. В нашем наборе для поиска подойдёт и отдельная БД — главное отделить поиск от основной базы.',
 tip:'Отдельный сервис поиска со своей БД',load:1,
 check:H=>H.count('service')>=1&&H.linkC('svc','db')?OK('Поиск вынесен в отдельный сервис — правильно.'):NO('Сделай сервис поиска со своей БД')},

{lv:'junior',t:'Здоровье при ×10',goal:'Любая твоя схема Client→GW→Сервис→БД, всё зелёное при ×10',
 theory:'×10 = 10 запросов/сек. Для лимитов в тысячи это пустяк. Убедись что всё зелёное.',
 tip:'Просто собери базовую цепочку, переключи нагрузку на ×10',load:10,
 check:H=>H.linkC('client','gw')&&H.linkC('gw','svc')&&H.linkC('svc','db')&&H.noErr()?OK('Запас по нагрузке огромный.'):NO('Собери Client→Gateway→Сервис→БД (нагрузка ×10)')},

{lv:'junior',t:'Понимание лимитов',goal:'Поставь только Сервис и PostgreSQL, нагрузка ×1000. Сделай так чтобы БД НЕ горела',
 theory:'PostgreSQL держит 10К rps. При ×1000 это 1000 — всего 10% от лимита. Должно быть зелёным. Кликни на БД — увидишь загрузку %.',
 tip:'Client→Сервис→PostgreSQL, ×1000. Кликни на БД посмотри %',load:1000,
 check:H=>H.has('postgresql')&&H.typeNoErr('postgresql')&&H.linkC('svc','db')?OK('1000 из 10000 = 10%. Запас есть.'):NO('Собери цепочку до PostgreSQL, проверь что она зелёная при ×1000')},

{lv:'junior',t:'Первый перегруз',goal:'Сервис(1 реплика)→PostgreSQL при ×1000. Увидь жёлтый/красный и пойми почему',
 theory:'Сервис держит 10К. При ×1000... стоп, 1000<10000, зелёный. А вот добавь нагрузку — на следующих задачах увидим перегруз. Сейчас просто собери и посмотри загрузку.',
 tip:'Собери, кликни на сервис, посмотри загрузку %',load:1000,
 check:H=>H.has('service')&&H.linkC('svc','db')?OK('Кликай на блоки и смотри загрузку — это главный навык.'):NO('Собери Сервис→БД, кликни на блоки')},

{lv:'junior',t:'Масштаб репликами',goal:'Сервис при ×1000 здоров. Поставь столько реплик, чтобы загрузка была <60%',
 theory:'1000 rps на сервис (лимит 10К) = 10%, и так зелёный. Реплики нужны когда нагрузка реально высокая. Привыкай открывать настройки.',
 tip:'2× клик на сервис, поиграй с репликами, смотри загрузку',load:1000,
 check:H=>H.typeNoErr('service')&&H.has('service')?OK('Реплики — твой главный инструмент масштабирования.'):NO('Добавь сервис и убедись что он не перегружен')},

{lv:'junior',t:'Итог Junior',goal:'Собери полную систему: 2 клиента→GW→LB→2 сервиса→{Redis,PostgreSQL}, Cache Aside, всё зелёное ×1000',
 theory:'Финал Junior! Собери всё что выучил: клиенты, Gateway, балансировщик, реплики сервисов, кэш, БД. Должно держать ×1000 зелёным.',
 tip:'Используй всё: GW, LB, 2 сервиса, Redis с Cache Aside, PostgreSQL',load:1000,
 check:H=>H.cntLinkC('client','gw')>=2&&H.linkC('gw','net')&&H.cntLinkC('net','svc')>=2&&H.has('redis')&&H.has('postgresql')&&H.patternOnCat('svc','cache_aside')&&H.noErr()?OK('🎓 Junior пройден! Ты понимаешь основы. Дальше — масштаб и отказоустойчивость.'):NO('Нужно: 2 клиента→GW→LB→2 сервиса, Redis+Cache Aside, PostgreSQL, всё зелёное')},

// ═══════════ MIDDLE (51-100): масштаб, паттерны, отказоустойчивость ═══════════
{lv:'middle',t:'Перегрузи сервис',goal:'Один Сервис (1 реплика) при ×1М. Он ДОЛЖЕН гореть красным',
 theory:'Сервис держит 10К rps. При ×1М (миллион) это 100× лимит → 100% отказов. Цель — увидеть и понять перегруз. Кликни на сервис: загрузка ~10000%.',
 tip:'Client→Сервис, ×1М. Не чини — просто увидь красное',load:1000000,
 check:H=>H.has('service')&&H.B.some(b=>b.type==='service'&&b.rt.health==='error')?OK('Вот так выглядит перегрузка. Дальше научимся чинить.'):NO('Поставь один сервис под ×1М — он должен покраснеть')},

{lv:'middle',t:'Почини репликами',goal:'Тот же сервис при ×1М сделай зелёным (нужно ≥100 реплик при λ=1М... но без LB нагрузка вся на него)',
 theory:'Сервис лимит 10К. Чтобы держать 1М нужно 100 реплик (100×10К=1М, но это 100% — мало запаса). Поставь ~170 реплик для запаса <60%.',
 tip:'2× клик → Реплики. Нужно много! Смотри как падает %',load:1000000,
 check:H=>H.typeNoErr('service')&&H.has('service')?OK('Реплики масштабируют горизонтально. В реале это Kubernetes-поды.'):NO('Увеличивай реплики пока сервис не позеленеет (нужно ~100+)')},

{lv:'middle',t:'LB + реплики правильно',goal:'GW→LB→2 сервиса. Каждому дай реплик чтобы держать ×1М зелёным',
 theory:'LB делит 1М на 2 сервиса = по 500К каждому. Значит каждому нужно ~50-85 реплик. LB + реплики — стандартный способ масштабирования.',
 tip:'GW→LB→Сервис1, Сервис2. Репликами добей до зелёного',load:1000000,
 check:H=>H.linkC('gw','net')&&H.cntLinkC('net','svc')>=2&&H.catNoErr('svc')?OK('LB поделил нагрузку, реплики вытянули. Классика highload.'):!H.linkC('gw','net')||H.cntLinkC('net','svc')<2?NO('Собери GW→LB→2 сервиса'):NO('Добавь репликами ёмкости каждому сервису')},

{lv:'middle',t:'Перегрузи БД',goal:'Сервис→PostgreSQL при ×1М. Дай сервису реплик, но БД пусть горит',
 theory:'Даже если сервис масштабирован, БД (10К) утонет под 1М. PostgreSQL — почти всегда узкое горло, потому что её сложно масштабировать.',
 tip:'Сервис с репликами здоров, а PostgreSQL красная',load:1000000,
 check:H=>H.typeNoErr('service')&&H.B.some(b=>b.type==='postgresql'&&b.rt.health==='error')?OK('Узкое горло найдено — это БД. Дальше чиним её.'):NO('Сервис должен быть зелёным (реплики), а PostgreSQL красной')},

{lv:'middle',t:'Спаси БД кэшем',goal:'Добавь Redis + Cache Aside. До БД дойдёт 20% — поможет ли при ×1М?',
 theory:'Cache Aside срежет нагрузку на БД до 20% = 200К. Но PostgreSQL держит 10К даже с PgBouncer (50К). 200К всё равно много! Кэша мало — нужно ещё.',
 tip:'Redis+Cache Aside, потом PgBouncer и реплики БД',load:1000000,
 check:H=>H.patternOnCat('svc','cache_aside')&&H.has('redis')?(H.typeNoErr('postgresql')?OK('Кэш + масштаб БД спасли ситуацию!'):NO('Кэш помог, но БД ещё горит. Добавь PgBouncer + Read Replicas')):NO('Сначала добавь Redis и включи Cache Aside на сервисе')},

{lv:'middle',t:'PgBouncer + реплики БД',goal:'Доведи PostgreSQL до зелёного при ×1М (кэш + PgBouncer + Read Replicas)',
 theory:'Комбо: Cache Aside (÷5 нагрузки) + PgBouncer (×5 ёмкости) + Read Replicas (×каждая +70%). Вместе вытягивают огромную нагрузку.',
 tip:'Cache Aside + PgBouncer + несколько Read Replicas',load:1000000,
 check:H=>H.typeNoErr('postgresql')&&H.patternOnCat('svc','cache_aside')?OK('БД спасена комбо приёмов. Так и делают на проде.'):NO('Нужно: Cache Aside + PgBouncer + Read Replicas, пока БД не позеленеет')},

{lv:'middle',t:'Cassandra вместо PostgreSQL',goal:'Для потока записи замени БД на Cassandra при ×1М',
 theory:'Если нагрузка — в основном запись (логи, события), PostgreSQL не масштабируется. Cassandra держит 100К на ноду и растёт нодами. Поставь Cassandra с нодами.',
 tip:'Сервис→Cassandra, в настройках добавь нод',load:1000000,
 check:H=>H.has('cassandra')&&H.link('service','cassandra')&&H.typeNoErr('cassandra')?OK('Cassandra масштабируется нодами — для write-heavy идеально.'):!H.has('cassandra')?NO('Добавь Cassandra и соедини с сервисом'):NO('Добавь нод Cassandra пока не позеленеет (×1М)')},

{lv:'middle',t:'Асинхрон гасит спайк',goal:'Сервис→Kafka→Consumer. Producer не должен зависеть от медленного consumer',
 theory:'Если consumer медленный, при СИНХРОННОЙ связи producer бы завис. Через Kafka — нет: producer кинул событие и свободен. Kafka буферит, consumer разгребает в своём темпе.',
 tip:'Сервис→Kafka→медленный Consumer. Кликни на producer — он здоров',load:1000,
 check:H=>H.link('service','kafka')&&H.linkC('broker','svc')?OK('Брокер развязал сервисы — спайк трафика впитается в буфер.'):NO('Собери Сервис→Kafka→Consumer')},

{lv:'middle',t:'Каскадный отказ',goal:'Сервис A (много реплик) → Сервис B (1 реплика) при ×1М. A должен попасть в КАСКАД',
 theory:'A здоров сам по себе, но синхронно зовёт перегруженный B и ЖДЁТ его. A зависает из-за B — это каскадный отказ. У A появится жёлтая пунктирная рамка.',
 tip:'A с репликами→B без реплик, ×1М. Кликни на A — увидишь "каскад"',load:1000000,
 check:H=>{const a=H.B.find(b=>b.rt.cascade);return a?OK('Каскад! Здоровый A тормозит из-за B. Это самый коварный тип отказа.'):NO('Нужен сервис A (с репликами) → сервис B (перегружен). A должен попасть в каскад')}},

{lv:'middle',t:'Circuit Breaker спасает',goal:'Включи Circuit Breaker на A — каскад должен исчезнуть',
 theory:'Circuit Breaker: когда B сыпет ошибками, breaker размыкается и A мгновенно отвечает ошибкой вместо ожидания. A перестаёт зависать — каскад остановлен.',
 tip:'2× клик на A → включи Circuit Breaker. Жёлтая рамка уйдёт',load:1000000,
 check:H=>H.patternOnCat('svc','circuit_breaker')&&H.noCascade()?OK('CB разорвал цепь отказа! A больше не ждёт мёртвого B.'):!H.patternOnCat('svc','circuit_breaker')?NO('Включи Circuit Breaker на сервисе A'):NO('Каскад ещё есть — убедись что CB на том сервисе, что зовёт перегруженный')},

{lv:'middle',t:'Retry: палка о двух концах',goal:'Включи Retry на сервисе (осторожно при перегрузе!)',
 theory:'Retry повторяет упавший запрос 3 раза. Помогает при КРАТКИХ сбоях. Но при перегрузе ретраи добавляют нагрузку → делают хуже (retry storm). Включай вместе с Circuit Breaker.',
 tip:'2× клик → Retry. Понимай риск: без CB при перегрузе — опасно',load:1000,
 check:H=>H.patternOnCat('svc','retry')?OK('Retry хорош при кратких сбоях. На проде — всегда с Circuit Breaker и backoff.'):NO('Включи Retry на сервисе')},

{lv:'middle',t:'Timeout от зависаний',goal:'Включи Timeout на сервисе который зовёт другой сервис',
 theory:'Без таймаута зависший вызов держит ресурс вечно. Timeout обрывает запрос через N секунд (504), освобождая поток. Базовая гигиена синхронных вызовов.',
 tip:'2× клик → Timeout',load:1000,
 check:H=>H.patternOnCat('svc','timeout')?OK('Зависшие запросы теперь обрываются, ресурсы освобождаются.'):NO('Включи Timeout на сервисе')},

{lv:'middle',t:'Redis Cluster',goal:'При ×1М на Redis включи Cluster',
 theory:'Один Redis держит 1М. При ×1М это впритык. Redis Cluster шардит данные по нодам → ×10 ёмкости. Для больших объёмов и нагрузок.',
 tip:'2× клик на Redis → Redis Cluster ВКЛ',load:1000000,
 check:H=>H.setEq('redis','cluster',true)?OK('Redis теперь шардирован — держит 10М.'):NO('Включи Redis Cluster')},

{lv:'middle',t:'Kafka: партиции',goal:'Подними партиции Kafka чтобы держать ×4М',
 theory:'Пропускная способность Kafka растёт с партициями. 3 партиции = 2М, нужно больше для 4М+. Партиции = параллелизм: больше consumers могут читать одновременно.',
 tip:'2× клик на Kafka → Партиции → больше',load:4000000,
 check:H=>H.has('kafka')&&H.typeNoErr('kafka')&&H.setGTE('kafka','partitions',6)?OK('Больше партиций — выше пропускная способность и параллелизм.'):!H.has('kafka')?NO('Добавь Kafka под нагрузку ×4М'):NO('Увеличь партиции Kafka чтобы держать ×4М')},

{lv:'middle',t:'Gateway-кластер',goal:'При ×1М увеличь инстансы Gateway чтобы он не горел',
 theory:'Gateway держит 100К. При ×1М — 10× лимита. Увеличь инстансы Gateway (это тоже горизонтальное масштабирование, обычно за облачным LB).',
 tip:'2× клик на Gateway → Инстансы → 10+',load:1000000,
 check:H=>H.has('api_gw')&&H.typeNoErr('api_gw')&&H.setGTE('api_gw','instances',10)?OK('Gateway теперь кластер — держит нагрузку.'):NO('Подними инстансы Gateway пока не позеленеет при ×1М')},

{lv:'middle',t:'Выбор: Kafka или RabbitMQ',goal:'Для потока >50К/с используй Kafka, не RabbitMQ (поставь Kafka под ×1М)',
 theory:'RabbitMQ лимит 50К msg/s. При ×1М он утонет. Kafka держит 2М+. Правило: большой поток/стриминг → Kafka, умеренные задачи → RabbitMQ.',
 tip:'Сервис→Kafka под ×1М, Kafka зелёная',load:1000000,
 check:H=>H.has('kafka')&&H.typeNoErr('kafka')&&!H.B.some(b=>b.type==='rabbitmq'&&b.rt.health==='error')?OK('Для highload-потока Kafka — правильный выбор.'):NO('Используй Kafka (не RabbitMQ) для потока ×1М')},

{lv:'middle',t:'BFF под два клиента',goal:'Web→Web BFF, Mobile→Mobile BFF, оба BFF→общий Сервис',
 theory:'Web и мобилка хотят разные данные. Web BFF отдаёт полные данные, Mobile BFF — урезанные (экономия трафика). Оба берут из общих сервисов.',
 tip:'2 BFF, каждый от своего клиента, оба к сервису',load:1000,
 check:H=>H.count('bff')>=2&&H.cntLinkC('client','svc')>=2&&H.linkC('svc','svc')?OK('Каждый клиент получает данные в своём формате.'):H.count('bff')<2?NO('Нужно 2 BFF'):NO('Каждый клиент→свой BFF→общий сервис')},

{lv:'middle',t:'Многоуровневый кэш',goal:'CDN (статика) + Redis (данные) + PostgreSQL. Удержи ×4М',
 theory:'Слои кэша: CDN снимает статику (огромный лимит 10М), Redis — горячие данные, БД — источник правды. Каждый слой защищает следующий.',
 tip:'Client→CDN, Client→GW→Сервис(Cache Aside)→Redis+PostgreSQL, масштабируй',load:4000000,
 check:H=>H.has('cdn')&&H.has('redis')&&H.patternOnCat('svc','cache_aside')&&H.noErr()?OK('Многослойное кэширование держит огромную нагрузку.'):NO('Нужны CDN + Redis + Cache Aside, и всё зелёное при ×4М')},

{lv:'middle',t:'Saga: распределённая транзакция',goal:'Order→Kafka→Payment→Kafka→Inventory (цепочка событий)',
 theory:'Транзакция через несколько сервисов = Saga. Каждый шаг публикует событие, следующий реагирует. Order создан→событие→Payment→событие→Inventory. Без общей БД-транзакции.',
 tip:'3 сервиса, связанные через Kafka по цепочке',load:1000,
 check:H=>H.cntLinkC('svc','broker')>=2&&H.cntLinkC('broker','svc')>=2&&H.count('service')>=3?OK('Saga: согласованность через цепочку событий, без распределённой блокировки.'):NO('Собери цепочку из 3 сервисов через Kafka (Saga)')},

{lv:'middle',t:'CQRS',goal:'Сервис пишет в PostgreSQL, отдельный путь чтения через Redis/ClickHouse',
 theory:'CQRS: разделяем запись (Command) и чтение (Query). Пишем в PostgreSQL, а читаем из оптимизированного под чтение хранилища (Redis/ClickHouse). Масштабируются независимо.',
 tip:'Сервис записи→PostgreSQL, сервис чтения→Redis или ClickHouse',load:1000,
 check:H=>H.linkC('svc','db')&&(H.has('redis')||H.has('clickhouse'))&&H.count('service')>=2?OK('Чтение и запись разделены — каждое масштабируется отдельно.'):NO('Нужны раздельные пути: запись→PostgreSQL, чтение→Redis/ClickHouse')},

{lv:'middle',t:'Аналитика не мешает проду',goal:'Основной сервис→PostgreSQL, аналитика отдельно через Kafka→ClickHouse',
 theory:'Тяжёлые аналитические запросы убьют боевую БД. Решение: события идут в Kafka→ClickHouse, аналитика считается там, не трогая PostgreSQL.',
 tip:'Сервис→PostgreSQL (прод) и Сервис→Kafka→ClickHouse (аналитика)',load:1000,
 check:H=>H.linkC('svc','db')&&H.link('service','kafka')&&H.has('clickhouse')&&H.pathTo('db')?OK('Аналитика изолирована — прод-БД в безопасности.'):NO('Прод→PostgreSQL, отдельно Сервис→Kafka→ClickHouse')},

{lv:'middle',t:'Backpressure',goal:'Поставь Queue с воркерами между быстрым источником и медленным сервисом',
 theory:'Если producer быстрее consumer, очередь копится. Queue (буфер) сглаживает: принимает всплеск, worker разбирает в своём темпе. Без буфера — потеря или перегруз.',
 tip:'Сервис→Queue→Worker. Увеличь workers',load:1000,
 check:H=>H.has('queue')&&H.link('service','queue')&&H.linkC('queue','svc')?OK('Очередь сглаживает всплески — это backpressure.'):NO('Собери Сервис→Queue→Worker')},

{lv:'middle',t:'Идемпотентность через exactly-once',goal:'Для платежей поставь Kafka delivery = exactly-once',
 theory:'В платежах дубль = беда (списали дважды). Kafka exactly-once гарантирует ровно одну доставку. Цена — −50% пропускной способности. Для денег оправдано.',
 tip:'2× клик на Kafka → Гарантия доставки → exactly-once',load:1000,
 check:H=>H.setEq('kafka','delivery','exactly-once')?OK('Платёж обработается ровно один раз — без дублей.'):NO('Поставь Kafka delivery = exactly-once')},

{lv:'middle',t:'Cassandra consistency',goal:'Поставь Cassandra consistency = QUORUM',
 theory:'Cassandra: ONE — быстро, но можешь прочитать устаревшее. ALL — свежо, но падает при отказе ноды. QUORUM (большинство) — золотая середина: и надёжно, и отказоустойчиво.',
 tip:'2× клик на Cassandra → Consistency → QUORUM',load:1000,
 check:H=>H.setEq('cassandra','consistency','QUORUM')?OK('QUORUM — баланс надёжности и доступности.'):!H.has('cassandra')?NO('Сначала добавь Cassandra'):NO('Поставь consistency = QUORUM')},

{lv:'middle',t:'Здоровье под ×1М целиком',goal:'Полная система держит ×1М зелёной: GW-кластер, LB, реплики, кэш, масштаб БД',
 theory:'Собери всё вместе для миллиона rps. Каждый слой масштабирован: Gateway-инстансы, LB, реплики сервисов, Cache Aside + Redis Cluster, PgBouncer + Read Replicas.',
 tip:'Масштабируй КАЖДЫЙ узел пока вся схема не позеленеет при ×1М',load:1000000,
 check:H=>H.n>=5&&H.noErr()&&H.noCascade()&&H.pathTo('db')?OK('🔥 Миллион rps на зелёном! Ты умеешь масштабировать систему.'):H.overloaded().length?NO('Ещё горят: '+H.overloaded().join(', ')+'. Масштабируй их'):H.cascading().length?NO('Каскад на: '+H.cascading().join(', ')+'. Добавь Circuit Breaker'):NO('Собери полную систему до БД')},

{lv:'middle',t:'Убери лишний LB',goal:'НЕ ставь Load Balancer перед/после Kafka — у неё своя балансировка',
 theory:'Частая ошибка: LB рядом с Kafka. Kafka балансирует сама через партиции и consumer groups. LB тут лишний. Собери Сервис→Kafka→Consumer без LB у брокера.',
 tip:'Никаких net-блоков вокруг Kafka',load:1000,
 check:H=>H.link('service','kafka')&&H.linkC('broker','svc')&&H.noLinkC('net','broker')&&H.noLinkC('broker','net')?OK('Правильно: Kafka балансирует сама, LB не нужен.'):H.linkC('net','broker')||H.linkC('broker','net')?NO('Убери Load Balancer от Kafka — он лишний'):NO('Собери Сервис→Kafka→Consumer (без LB у брокера)')},

{lv:'middle',t:'Fan-out: усиление нагрузки',goal:'Сервис зовёт 3 БД. Пойми: 1 запрос превращается в 3',
 theory:'Когда сервис синхронно зовёт несколько зависимостей — нагрузка УМНОЖАЕТСЯ. 1 входящий запрос → 3 запроса к трём БД. Поэтому глубокие цепочки опасны.',
 tip:'Сервис→3 БД. Кликни на каждую БД — у всех полная нагрузка',load:1000,
 check:H=>{const svc=H.B.find(b=>EL[b.type].cat==='svc');const outs=svc?S.conns.filter(c=>c.from===svc.id&&EL[gb(c.to)?.type]?.cat==='db').length:0;return outs>=3?OK('Фан-аут: 1 запрос стал 3. Каждая БД получает полную нагрузку.'):NO('Сделай сервис, который зовёт 3 БД')}},

{lv:'middle',t:'Изоляция через Bulkhead',goal:'Включи Bulkhead на сервисе',
 theory:'Bulkhead (переборка, как на корабле) — ограничивает параллельные вызовы к зависимости. Если одна зависимость тупит, она не съест все потоки сервиса — остальные функции работают.',
 tip:'2× клик → Bulkhead',load:1000,
 check:H=>H.patternOnCat('svc','bulkhead')?OK('Проблема в одной зависимости теперь не топит весь сервис.'):NO('Включи Bulkhead на сервисе')},

{lv:'middle',t:'Полный e-commerce',goal:'Каталог(Mongo), Корзина(Redis), Заказы(PostgreSQL), Оплата(через Kafka). ×1М зелёный',
 theory:'Реалистичный магазин: каждый сервис со своим хранилищем под задачу, оплата асинхронно через Kafka. Масштабируй под ×1М.',
 tip:'Несколько сервисов, разные БД, Kafka для оплаты, всё масштабировано',load:1000000,
 check:H=>H.count('service')>=3&&H.has('mongodb')&&H.has('redis')&&H.has('postgresql')&&H.has('kafka')&&H.noErr()&&H.noCascade()?OK('🛒 Полноценный масштабируемый магазин. Сильно!'):NO('Нужны: ≥3 сервиса, MongoDB+Redis+PostgreSQL+Kafka, всё зелёное при ×1М')},

{lv:'middle',t:'Соцсеть: лента',goal:'Posts→Kafka→Fanout→Redis, Feed читает из Redis. ×1М',
 theory:'Лента соцсети: при посте событие летит в Kafka, Fanout-сервис разносит его подписчикам в Redis (предрасчёт лент). Feed-сервис мгновенно читает готовую ленту из Redis.',
 tip:'Posts→Kafka→Fanout→Redis, Feed→Redis',load:1000000,
 check:H=>H.link('service','kafka')&&H.linkC('broker','svc')&&H.has('redis')&&H.cntLinkC('svc','cache')>=1&&H.noErr()?OK('📱 Лента на предрасчёте — мгновенная выдача миллионам.'):NO('Posts→Kafka→Fanout→Redis, Feed→Redis, всё зелёное ×1М')},

{lv:'middle',t:'IoT: поток телеметрии',goal:'Devices→NATS→Kafka→Stream Processor→Cassandra. ×4М',
 theory:'Миллионы устройств шлют телеметрию. NATS принимает (быстрый), Kafka буферит, Stream Processor обрабатывает, Cassandra хранит time-series. Масштабируй под ×4М.',
 tip:'Цепочка через NATS, Kafka, сервис, Cassandra',load:4000000,
 check:H=>H.has('nats')&&H.has('kafka')&&H.has('cassandra')&&H.noErr()&&H.pathTo('db')?OK('📡 IoT-пайплайн держит миллионы устройств.'):NO('Devices→NATS→Kafka→Processor→Cassandra, зелёное при ×4М')},

{lv:'middle',t:'Грозовая защита БД',goal:'Перед PostgreSQL поставь ВСЁ: Cache Aside+Redis Cluster, PgBouncer, 5+ Read Replicas. Держи ×10М',
 theory:'Экстрим: 10 миллионов rps. Защити БД всеми способами сразу. Даже так PostgreSQL — предел; в реальности тут перешли бы на Cassandra/шардинг.',
 tip:'Cache Aside + Redis Cluster + PgBouncer + много Read Replicas',load:10000000,
 check:H=>H.patternOnCat('svc','cache_aside')&&H.setEq('redis','cluster',true)&&H.setEq('postgresql','pgbouncer',true)&&H.setGTE('postgresql','replicas',5)?(H.typeNoErr('postgresql')?OK('🛡 БД выжила под 10М! Хотя в реале тут уже Cassandra.'):NO('Все приёмы включены, но 10М — предел PostgreSQL. Попробуй ещё реплик или прими что тут нужна другая БД')):NO('Включи ВСЁ: Cache Aside, Redis Cluster, PgBouncer, 5+ Read Replicas')},

{lv:'middle',t:'Видеосервис',goal:'CDN(видео)+метаданные(MySQL)+рекомендации(Redis)+аналитика(ClickHouse). ×4М',
 theory:'Стриминг: видео раздаёт CDN (не трогает бэкенд!), метаданные в MySQL, рекомендации из Redis, просмотры в ClickHouse. Каждое — свой оптимальный слой.',
 tip:'CDN + 3 сервиса с разными хранилищами',load:4000000,
 check:H=>H.has('cdn')&&H.has('redis')&&H.has('clickhouse')&&H.count('service')>=2&&H.noErr()?OK('🎬 Стриминг-платформа на зелёном.'):NO('Нужны CDN + Redis + ClickHouse + сервисы, зелёное ×4М')},

{lv:'middle',t:'Банкинг: надёжность',goal:'Транзакции: PostgreSQL SERIALIZABLE + Circuit Breaker + Kafka exactly-once + Fraud',
 theory:'Банк жертвует скоростью ради надёжности: SERIALIZABLE изоляция, exactly-once доставка, Circuit Breaker, антифрод через Kafka. Безопасность важнее throughput.',
 tip:'PostgreSQL SERIALIZABLE, Kafka exactly-once, CB на сервисах, Fraud-сервис',load:1000,
 check:H=>H.setEq('postgresql','isolation','SERIALIZABLE')&&H.setEq('kafka','delivery','exactly-once')&&H.patternOnCat('svc','circuit_breaker')?OK('🏦 Надёжность банковского уровня. Медленнее, но без потерь и дублей.'):NO('Нужно: SERIALIZABLE + Kafka exactly-once + Circuit Breaker')},

{lv:'middle',t:'Найди узкое горло',goal:'В любой перегруженной схеме при ×1М найди и почини ВСЕ красные узлы',
 theory:'Навык диагностики: запусти ×1М, открой анализ справа — он покажет что горит. Чини по одному: реплики, кэш, масштаб БД. Цель — ноль красных.',
 tip:'Смотри список проблем справа, чини каждый красный узел',load:1000000,
 check:H=>H.n>=4&&H.noErr()?OK('Диагностика и устранение узких мест — ключевой навык инженера.'):H.overloaded().length?NO('Ещё горят: '+H.overloaded().join(', ')):NO('Собери схему ≥4 блоков и устрани все перегрузы при ×1М')},

{lv:'middle',t:'Дёшево или надёжно',goal:'Собери минимальную схему, держащую ×1000 зелёной БЕЗ лишних блоков (≤4 блока)',
 theory:'Не всегда нужен highload. ×1000 (1000 rps) легко держит client→service→postgresql без всяких кластеров. Не переусложняй — это тоже навык. Минимум блоков.',
 tip:'4 блока максимум, ×1000, всё зелёное',load:1000,
 check:H=>H.n<=4&&H.n>=3&&H.noErr()&&H.pathTo('db')?OK('Простота — тоже инженерное решение. Не строй highload там, где не нужно.'):H.n>4?NO('Слишком много блоков — упрости до ≤4'):NO('Собери минимум (3-4 блока) до БД, зелёное при ×1000')},

{lv:'middle',t:'Read/Write split',goal:'Сервис записи→PostgreSQL мастер, сервис чтения→PostgreSQL с Read Replicas',
 theory:'Разделение чтения и записи: 90% запросов обычно чтение. Пишем в мастер, читаем с реплик. Read Replicas масштабируют чтение почти бесконечно.',
 tip:'Сервис записи→PostgreSQL, второй сервис чтения→другая PostgreSQL с репликами',load:1000000,
 check:H=>H.count('postgresql')>=1&&H.setGTE('postgresql','replicas',2)&&H.typeNoErr('postgresql')?OK('Чтение масштабируется репликами — главный приём для read-heavy.'):NO('Добавь PostgreSQL с Read Replicas ≥2, держи нагрузку зелёной')},

{lv:'middle',t:'Деградация, а не падение',goal:'Сервис рекомендаций с Circuit Breaker: если упадёт, основной поток выживет',
 theory:'Graceful degradation: некритичный сервис (рекомендации) защищён Circuit Breaker. Если он упадёт — CB отрежет его, пользователь увидит страницу без рекомендаций, но СИСТЕМА РАБОТАЕТ.',
 tip:'Главный сервис→сервис рекомендаций (с CB)→своя БД',load:1000000,
 check:H=>H.count('service')>=2&&H.linkC('svc','svc')&&H.patternOnCat('svc','circuit_breaker')&&H.noCascade()?OK('Система деградирует мягко: теряет фичу, но не падает целиком.'):NO('Главный→Рекомендации(CB)→БД. CB не даст рекомендациям утопить главный сервис')},

{lv:'middle',t:'Маркетплейс с поиском',goal:'Товары(PostgreSQL+Redis), Поиск(отдельно), Заказы→Kafka→Доставка. ×1М',
 theory:'Маркетплейс: товары кэшируются в Redis, поиск вынесен отдельно, заказы порождают события доставки через Kafka. Каждая подсистема масштабируется сама.',
 tip:'Несколько сервисов, Redis-кэш, Kafka для доставки',load:1000000,
 check:H=>H.count('service')>=3&&H.has('redis')&&H.has('kafka')&&H.patternOnCat('svc','cache_aside')&&H.noErr()&&H.noCascade()?OK('🏪 Маркетплейс держит миллион. Отличная работа!'):NO('≥3 сервиса, Redis+Cache Aside, Kafka для доставки, зелёное ×1М')},

{lv:'middle',t:'Чат real-time',goal:'Клиенты→Gateway→Chat Service→NATS→доставка, история в Cassandra. ×4М',
 theory:'Чат: сообщения летят через NATS (быстрый real-time брокер), история пишется в Cassandra (write-heavy). Gateway держит WebSocket-соединения.',
 tip:'Gateway→Chat→NATS, Chat→Cassandra',load:4000000,
 check:H=>H.has('nats')&&H.has('cassandra')&&H.linkC('gw','svc')&&H.noErr()?OK('💬 Real-time чат на миллионы пользователей.'):NO('Gateway→Chat→NATS + Cassandra для истории, зелёное ×4М')},

{lv:'middle',t:'Защити цепочку CB',goal:'Цепочка A→B→C при ×1М. Защити Circuit Breaker-ами так, чтобы каскада не было',
 theory:'Длинная синхронная цепочка опасна: падение C роняет B, потом A. Circuit Breaker на каждом звене локализует отказ. Чем глубже цепь — тем важнее CB.',
 tip:'3 сервиса цепочкой, CB на тех, кто зовёт следующего',load:1000000,
 check:H=>H.count('service')>=3&&H.cntLinkC('svc','svc')>=2&&H.noCascade()?OK('Цепочка защищена — отказ не распространится.'):H.cascading().length?NO('Каскад на: '+H.cascading().join(', ')+'. Добавь им Circuit Breaker'):NO('Собери цепочку A→B→C из 3 сервисов и защити CB')},

{lv:'middle',t:'Аналитический пайплайн',goal:'Loggers→Kafka→Stream Processor→ClickHouse, BI-клиент→Query→ClickHouse. ×10М',
 theory:'Big Data пайплайн: события (10М/с!) идут в Kafka, обрабатываются стримом, ложатся в ClickHouse. Аналитики запрашивают через отдельный сервис. Масштабируй партиции и шарды.',
 tip:'Kafka с партициями, Stream Processor с репликами, ClickHouse с шардами',load:10000000,
 check:H=>H.has('kafka')&&H.has('clickhouse')&&H.setGTE('kafka','partitions',15)&&H.noErr()?OK('📊 10 миллионов событий в секунду на зелёном. CTO-уровень близко!'):NO('Kafka(много партиций)→Processor→ClickHouse(шарды), зелёное ×10М')},

{lv:'middle',t:'Финал Middle',goal:'Спроектируй highload-систему на твой вкус: ≥6 блоков, ≥2 паттерна, держит ×4М без красного и без каскадов',
 theory:'Выпускной Middle! Собери осмысленную систему любой предметной области. Условия: минимум 6 блоков, минимум 2 разных паттерна, путь до хранилища, и при ×4М — ноль красных, ноль каскадов.',
 tip:'Прояви всё что знаешь: масштаб, кэш, async, паттерны, правильные БД',load:4000000,
 check:H=>{const pats=new Set();H.B.forEach(b=>(b.patterns||[]).forEach(p=>pats.add(p)));return H.n>=6&&pats.size>=2&&H.noErr()&&H.noCascade()&&H.pathTo('db')&&H.noBad()?OK('🎓🔵 MIDDLE ПРОЙДЕН! Ты проектируешь масштабируемые отказоустойчивые системы. Дальше — Senior и CTO.'):H.n<6?NO('Нужно ≥6 блоков'):pats.size<2?NO('Используй ≥2 разных паттерна (CB, Retry, Cache Aside...)'):H.overloaded().length?NO('Горят: '+H.overloaded().join(', ')):H.cascading().length?NO('Каскады: '+H.cascading().join(', ')):NO('Доведи до хранилища и убери антипаттерны')}},

// ═══════════ SENIOR (101-130): концепции, trade-offs, отказоустойчивость ═══════════
{lv:'senior',t:'Прикидка нагрузки (back-of-the-envelope)',goal:'Собери систему, держащую вычисленную нагрузку без красного. Путь до БД.',
 theory:'Первое, что спросят на сеньор-собесе — посчитай нагрузку САМ. Дано: 1 млрд DAU, в среднем 100 запросов/день. 1e9 × 100 = 1e11 запросов/день. Делим на 86400 сек ≈ 1.16М rps в среднем. Пик обычно ×3-4 → ~4М rps. Но read/write ~ 100:1, поэтому запись ~40К, чтение ~4М. Storage: 1e9 × 2КБ профиль = 2ТБ только профилей. Это и есть язык, на котором говорит сеньор: всегда сводишь к rps, storage, bandwidth.',
 tip:'Нагрузка выставлена в ~2М. Масштабируй Gateway (инстансы), LB, реплики сервисов, кэш+Cache Aside перед БД. Цель — ни одного красного.',load:2000000,
 check:H=>H.n>=5&&H.noErr()&&H.pathTo('db')?OK('Ты перевёл бизнес-метрику в rps и заложил ёмкость с запасом. Так начинается КАЖДЫЙ сеньор-дизайн.'):H.overloaded().length?NO('Горят: '+H.overloaded().join(', ')+'. Добавь ёмкости'):NO('Собери полную цепочку до БД, держащую ~2М rps без красного')},

{lv:'senior',t:'Read-heavy: CQRS + реплики',goal:'Раздели запись и чтение: запись→мастер, чтение→Read Replicas + Redis. ≥3 реплики.',
 theory:'В 95% систем чтений в разы больше записей. Сеньор-приём: CQRS — отдельный путь записи (Command, в мастер PostgreSQL) и чтения (Query, с Read Replicas + кэш). Они масштабируются НЕЗАВИСИМО: добавляешь реплики чтения, не трогая запись. Цена — eventual consistency: реплика отстаёт на десятки мс (replication lag), читатель может увидеть чуть устаревшее. Это нормально для лент/каталогов, НЕ ок для баланса счёта.',
 tip:'2 сервиса (запись и чтение), PostgreSQL с Read Replicas ≥3, Redis для чтения, Cache Aside на читающем',load:1000000,
 check:H=>H.count('service')>=2&&H.setGTE('postgresql','replicas',3)&&H.has('redis')&&H.linkC('svc','cache')&&H.noErr()?OK('Чтение масштабируется почти бесконечно репликами и кэшем. Запись изолирована. Это CQRS.'):!H.setGTE('postgresql','replicas',3)?NO('Дай PostgreSQL ≥3 Read Replicas'):!H.linkC('svc','cache')?NO('Подключи Redis к читающему сервису'):NO('Нужны: 2 сервиса, реплики чтения, Redis, всё зелёное')},

{lv:'senior',t:'Write-heavy: горизонтальная БД',goal:'Поток записи ×2М: используй Cassandra с ≥12 нодами, без красного.',
 theory:'PostgreSQL масштабирует ЧТЕНИЕ репликами, но не ЗАПИСЬ — мастер один. Для write-heavy (логи, метрики, события, лента активности) берут шардируемую БД: Cassandra/ScyllaDB. Запись распределяется по нодам через partition key, линейный рост ёмкости с числом нод. Нет JOIN и транзакций между партициями — это плата за масштаб записи.',
 tip:'Сервис→Cassandra, 2× клик → добавь нод (≥12). Нагрузка ×2М',load:2000000,
 check:H=>H.has('cassandra')&&H.link('service','cassandra')&&H.setGTE('cassandra','nodes',12)&&H.typeNoErr('cassandra')?OK('Запись шардируется по нодам — линейное масштабирование. Для write-heavy это правильный выбор.'):!H.has('cassandra')?NO('Добавь Cassandra'):NO('Добавь нод Cassandra (≥12) пока не позеленеет при ×2М')},

{lv:'senior',t:'Hot partition (горячий ключ)',goal:'Подними партиции Kafka (≥12) и держи ×2М. Пойми проблему горячего ключа.',
 theory:'Шардирование спасает, только если ключ распределён РАВНОМЕРНО. Классический провал: партиционируешь по user_id, а один блогер с 50М подписчиков создаёт hot partition — одна нода в огне, остальные простаивают. Решения: составной ключ (user_id+timestamp), хеширование, отдельная обработка китов. Больше партиций = больше параллелизма, но только при хорошем ключе.',
 tip:'2× клик на Kafka → Партиции ≥12. Думай: как распределить нагрузку равномерно',load:2000000,
 check:H=>H.has('kafka')&&H.setGTE('kafka','partitions',12)&&H.typeNoErr('kafka')?OK('Партиции дают параллелизм. Но помни: они бесполезны при плохом ключе — это любимая ловушка на собесе.'):NO('Подними партиции Kafka до ≥12 под ×2М')},

{lv:'senior',t:'Стратегия шардирования',goal:'Зашардируй хранилище: MongoDB sharding ВКЛ или ClickHouse ≥4 шарда.',
 theory:'Два способа шардить: HASH (hash(key) % N) — равномерно, но диапазонные запросы бьют по всем шардам; RANGE (A-M на шард1, N-Z на шард2) — диапазоны быстры, но риск перекоса и hot shard. Ресрардинг (добавление шарда) — боль: при hash % N меняется N и переезжают почти все ключи. Поэтому используют consistent hashing или заранее много логических шардов.',
 tip:'2× клик → MongoDB Шардирование ВКЛ, либо ClickHouse Шарды ≥4',load:2000000,
 check:H=>(H.setEq('mongodb','sharding',true)||H.setGTE('clickhouse','shards',4))?OK('Данные распределены по шардам. На собесе обязательно проговори: hash vs range и боль ресрардинга.'):NO('Включи sharding у MongoDB или подними шарды ClickHouse ≥4')},

{lv:'senior',t:'Multi-region (геораспределение)',goal:'≥2 Gateway (регионы), ≥2 БД (реплики по регионам), CDN на входе.',
 theory:'Юзер в Токио не должен ходить в дата-центр в Вирджинии — это +150мс RTT на каждый запрос. Multi-region: Gateway в каждом регионе, GeoDNS направляет в ближайший, данные реплицируются. Дилемма: active-active (пишут все регионы → конфликты, нужен CRDT/LWW) vs active-passive (пишет один, проще, но failover-задержка). Плюс data residency — GDPR требует хранить данные ЕС в ЕС.',
 tip:'2+ Gateway, 2+ БД (как регионы), CDN. Это про латентность и отказ целого региона',load:1000000,
 check:H=>H.count('api_gw')>=2&&H.countCat('db')>=2&&H.has('cdn')&&H.noErr()?OK('Геораспределение: низкая латентность + переживёт падение целого региона. Проговори active-active vs active-passive.'):H.count('api_gw')<2?NO('Поставь ≥2 Gateway (регионы)'):H.countCat('db')<2?NO('Нужно ≥2 БД (реплики по регионам)'):!H.has('cdn')?NO('Добавь CDN на входе'):NO('Доведи до зелёного')},

{lv:'senior',t:'Кворум: W + R > N',goal:'Cassandra consistency = QUORUM, нод ≥5.',
 theory:'Tunable consistency. N — число реплик данных. W — сколько должны подтвердить запись, R — сколько прочитать. Если W+R>N — гарантированно прочитаешь свежее (read-your-writes). QUORUM = большинство и для W, и для R (W=R=N/2+1), значит W+R>N всегда. ONE — быстро, но рискуешь stale read. ALL — максимум консистентности, но падает при отказе одной ноды (нет доступности). QUORUM — баланс CAP в пользу обоих.',
 tip:'2× клик на Cassandra → Consistency QUORUM, ноды ≥5',load:1000000,
 check:H=>H.has('cassandra')&&H.setEq('cassandra','consistency','QUORUM')&&H.setGTE('cassandra','nodes',5)?OK('W+R>N гарантирует чтение своих записей при сохранении доступности. Это сердце tunable consistency.'):!H.has('cassandra')?NO('Добавь Cassandra'):NO('Consistency=QUORUM и ноды ≥5')},

{lv:'senior',t:'Идемпотентность',goal:'Платёжный поток: Kafka delivery = exactly-once.',
 theory:'Сеть ненадёжна: клиент не получил ответ и повторил запрос — списали дважды. Защита: идемпотентность. Клиент шлёт idempotency-key (UUID), сервис хранит обработанные ключи и при повторе возвращает прежний результат, не выполняя операцию снова. На уровне брокера — exactly-once. Правило: ЛЮБАЯ операция записи в распределённой системе должна быть идемпотентной, потому что ретраи неизбежны.',
 tip:'2× клик на Kafka → exactly-once. И помни про idempotency-key на уровне API',load:1000,
 check:H=>H.setEq('kafka','delivery','exactly-once')?OK('Операция выполнится ровно один раз. На собесе добавь: idempotency-key + дедупликация на стороне сервиса.'):NO('Поставь Kafka delivery = exactly-once')},

{lv:'senior',t:'Rate limiting (защита от абуза)',goal:'Gateway-кластер (≥15 инстансов) держит ×2М, не падая.',
 theory:'Без лимитов один клиент (или DDoS) положит систему. Rate limiting на Gateway: token bucket (ведро токенов пополняется со скоростью R, запрос берёт токен, нет токенов → 429 Too Many Requests) или sliding window. В распределённом Gateway счётчики держат в Redis (общие на все инстансы). Возвращай 429 + Retry-After. Это и защита, и справедливое распределение ёмкости между клиентами.',
 tip:'2× клик на Gateway → Инстансы ≥15. Под ×2М. Думай про token bucket + Redis-счётчики',load:2000000,
 check:H=>H.has('api_gw')&&H.setGTE('api_gw','instances',15)&&H.typeNoErr('api_gw')?OK('Gateway-кластер выдержал. Проговори: token bucket, общий счётчик в Redis, ответ 429 + Retry-After.'):NO('Подними инстансы Gateway (≥15) чтобы держать ×2М')},

{lv:'senior',t:'Cache stampede (thundering herd)',goal:'Cache Aside + Redis на сервисе. Пойми проблему лавины при протухании.',
 theory:'Популярный ключ протух → 10000 запросов ОДНОВРЕМЕННО не нашли его в кэше и все ринулись в БД → она падает. Это thundering herd / cache stampede. Лечение: (1) TTL с джиттером, чтобы ключи не протухали разом; (2) request coalescing — только один поток идёт в БД, остальные ждут его результат; (3) распределённый лок на перестроение; (4) stale-while-revalidate — отдаём старое, пока фоном обновляем.',
 tip:'Cache Aside + Redis. На собесе обязательно упомяни джиттер TTL и coalescing',load:1000000,
 check:H=>H.patternOnCat('svc','cache_aside')&&H.has('redis')&&H.link('service','redis')?OK('Кэш есть. Но сам кэш — источник нового класса отказов: проговори стампед и его лечение.'):NO('Включи Cache Aside и подключи Redis к сервису')},

{lv:'senior',t:'Outbox / CDC (надёжная публикация)',goal:'Сервис→PostgreSQL И Сервис→Kafka. БЕЗ прямой связи БД→брокер.',
 theory:'Проблема dual-write: записал в БД, потом упал ДО публикации в Kafka — событие потеряно, системы рассинхронились. Нельзя надёжно писать в два места без распределённой транзакции. Паттерн Outbox: пишешь данные И событие в ОДНУ транзакцию БД (таблица outbox), затем отдельный процесс (CDC, напр. Debezium) читает лог БД и публикует в Kafka. Гарантия at-least-once без 2PC. Анти-паттерн — БД сама пишет в брокер.',
 tip:'Сервис→PostgreSQL (с outbox) и Сервис→Kafka. Не соединяй БД напрямую с Kafka',load:1000,
 check:H=>H.linkC('svc','db')&&H.linkC('svc','broker')&&H.noLinkC('db','broker')?OK('Outbox: атомарная запись данных+события, CDC публикует из лога. Решает dual-write без распределённых транзакций.'):H.linkC('db','broker')?NO('Убери связь БД→брокер — это анти-паттерн (нужен CDC/Debezium)'):NO('Сервис должен писать и в БД, и в Kafka')},

{lv:'senior',t:'Backpressure и буферизация',goal:'Сервис→Queue (≥4 workers)→Worker. Сгладь всплеск.',
 theory:'Producer быстрее consumer → что делать с лавиной? Без буфера — отказы или OOM. Backpressure: очередь принимает всплеск, workers разгребают в своём темпе. Ключевые решения: ограниченная очередь (bounded) против неограниченной (риск OOM); что делать при переполнении — drop/reject/блокировать producer; масштабирование workers по длине очереди (KEDA). Очередь превращает спайк трафика в ровную нагрузку на БД.',
 tip:'Сервис→Queue→Worker, workers ≥4. Думай: bounded queue + автоскейл воркеров',load:1000000,
 check:H=>H.has('queue')&&H.link('service','queue')&&H.linkC('queue','svc')&&H.setGTE('queue','workers',4)?OK('Очередь сглаживает всплески, защищая БД. Проговори bounded vs unbounded и политику переполнения.'):!H.has('queue')?NO('Добавь Queue'):!H.setGTE('queue','workers',4)?NO('Подними workers ≥4'):NO('Собери Сервис→Queue→Worker')},

{lv:'senior',t:'Bulkhead (изоляция отказов)',goal:'Включи Bulkhead на сервисе с несколькими зависимостями.',
 theory:'Bulkhead (переборки на корабле): отдельные пулы потоков/соединений на каждую зависимость. Если медленный сервис рекомендаций съест все 200 потоков общего пула — упадёт ВЕСЬ сервис, включая критичные функции. С переборками рекомендации ограничены своими 20 потоками, остальные 180 обслуживают важное. Изолируешь сбой в одном отсеке, корабль не тонет.',
 tip:'2× клик → Bulkhead. Применяй когда сервис зовёт несколько зависимостей',load:1000000,
 check:H=>H.patternOnCat('svc','bulkhead')?OK('Сбой одной зависимости больше не топит весь сервис. Bulkhead + Circuit Breaker — база изоляции отказов.'):NO('Включи Bulkhead на сервисе')},

{lv:'senior',t:'Graceful degradation',goal:'Главный→некритичный сервис(с Circuit Breaker)→БД. Без каскада при ×2М.',
 theory:'Зрелая система при сбое теряет ФИЧУ, а не падает целиком. Главный сервис зовёт некритичные (рекомендации, баннеры) через Circuit Breaker. Упали — CB размыкается, отдаём fallback (пустой блок, кэш, дефолт), пользователь видит страницу без рекомендаций, но ЗАКАЗ оформить может. Различай критичный путь (оформление заказа) и некритичный (советы) — деградируй второе, защищай первое.',
 tip:'2 сервиса, главный→рекомендации(CB)→БД. Под ×2М рекомендации перегрузи, но каскада быть не должно',load:2000000,
 check:H=>H.count('service')>=2&&H.linkC('svc','svc')&&H.patternOnCat('svc','circuit_breaker')&&H.noCascade()?OK('Система деградирует мягко: теряет некритичную фичу, но основной путь жив. Это зрелость.'):H.cascading().length?NO('Каскад на: '+H.cascading().join(', ')+'. Поставь CB на зовущий сервис'):NO('Главный→Рекомендации(CB)→БД, без каскада')},

{lv:'senior',t:'Хвостовые задержки (p99 и fan-out)',goal:'Сократи синхронный fan-out: добавь кэш (Cache Aside) ИЛИ асинхрон (брокер).',
 theory:'Среднее ВРЁТ. Если сервис синхронно зовёт 10 зависимостей и ждёт всех, ответ = МАКСИМУМ из 10, а не среднее. При p99 каждой = 100мс, шанс что хотя бы одна попадёт в свой хвост = 1-(0.99^10) ≈ 9.6% — почти каждый 10-й запрос медленный. Чем шире fan-out, тем хуже p99 общего ответа. Лечение: кэшировать, распараллеливать с таймаутом, hedged requests (дублируешь запрос, берёшь первый ответ), сокращать глубину цепочек.',
 tip:'Cache Aside перед БД, либо вынеси часть в брокер. Цель — меньше синхронных ожиданий',load:1000000,
 check:H=>(H.patternOnCat('svc','cache_aside')||H.hasCat('broker'))&&H.noErr()?OK('Меньше синхронных зависимостей = лучше p99. На собесе посчитай: p99 fan-out = 1-(p^N). Это отличает сеньора.'):NO('Сократи синхронные ожидания: добавь Cache Aside или брокер, и убери красное')},

{lv:'senior',t:'Saga с компенсацией',goal:'Цепочка ≥3 сервисов через Kafka (Order→Payment→Inventory).',
 theory:'Распределённая транзакция без 2PC = Saga. Каждый шаг — локальная транзакция + событие следующему. Главное, что спросят: что если шаг 3 упал? КОМПЕНСИРУЮЩИЕ транзакции — Payment.refund(), Inventory.release() в обратном порядке. Два стиля: хореография (сервисы реагируют на события друг друга, нет центра, но трудно отследить) vs оркестрация (центральный оркестратор дирижирует шагами, виднее, но единая точка логики). Saga даёт eventual consistency, не ACID.',
 tip:'3 сервиса связаны цепочкой через Kafka. Проговори компенсации и хореография vs оркестрация',load:1000,
 check:H=>H.count('service')>=3&&H.cntLinkC('svc','broker')>=2&&H.cntLinkC('broker','svc')>=2?OK('Saga: согласованность через события + компенсации при сбое. Различай хореографию и оркестрацию.'):NO('Собери цепочку из ≥3 сервисов через Kafka')},

{lv:'senior',t:'Event Sourcing',goal:'Kafka как источник истины: Сервис→Kafka→проекции (consumer-сервисы).',
 theory:'Вместо хранения текущего состояния храним НЕИЗМЕНЯЕМЫЙ лог всех событий (Kafka). Состояние = свёртка событий. Плюсы: полный аудит, time-travel (состояние на любой момент), легко строить новые проекции (read models) переигрывая лог. Минусы: сложность, версионирование событий, eventual consistency проекций. Часто идёт в паре с CQRS: события — запись, проекции в Redis/ClickHouse — чтение.',
 tip:'Сервис→Kafka (лог событий), Kafka→несколько consumer-сервисов (проекции)',load:1000,
 check:H=>H.has('kafka')&&H.link('service','kafka')&&H.cntLinkC('broker','svc')>=1?OK('Лог событий — источник истины, состояние выводится свёрткой. Аудит и переигрывание из коробки.'):NO('Сервис→Kafka и Kafka→consumer-проекция')},

{lv:'senior',t:'Real-time на миллионы (WebSocket)',goal:'Gateway-кластер (≥10) + NATS для real-time доставки. ×2М.',
 theory:'Чаты, нотификации, котировки — это долгоживущие WebSocket-соединения, не короткие HTTP. Проблема: 10М соединений = память на connection state, и нужен sticky routing. Архитектура: слой connection-серверов держит сокеты, NATS/Redis Pub-Sub разносит сообщения между ними (юзер на сервере A, отправитель на сервере B). Масштабируешь connection-слой горизонтально, брокер развязывает.',
 tip:'Gateway ≥10 инстансов, NATS для разноса сообщений. ×2М',load:2000000,
 check:H=>H.has('nats')&&H.setGTE('api_gw','instances',10)&&H.linkC('gw','svc')&&H.typeNoErr('api_gw')?OK('Connection-слой масштабируется, NATS разносит между нодами. Так держат миллионы живых сокетов.'):!H.has('nats')?NO('Добавь NATS для разноса сообщений'):NO('Gateway ≥10 инстансов под ×2М')},

{lv:'senior',t:'Троица устойчивости: Timeout+Retry+CB',goal:'На одном сервисе включи Timeout, Retry И Circuit Breaker.',
 theory:'Три паттерна работают только ВМЕСТЕ. Timeout — не ждём вечно (без него поток висит навсегда). Retry — повтор при кратком сбое, но ОБЯЗАТЕЛЬНО с exponential backoff + jitter, иначе ретраи синхронизируются и устраивают retry storm. Circuit Breaker — после N ошибок размыкаемся, чтобы ретраи не добивали уже лежащую зависимость. Retry без CB при перегрузе делает только хуже. Это must-have комбо для любого сетевого вызова.',
 tip:'2× клик на сервис → включи все три: Timeout, Retry, Circuit Breaker',load:1000,
 check:H=>H.patternOnCat('svc','timeout')&&H.patternOnCat('svc','retry')&&H.patternOnCat('svc','circuit_breaker')?OK('Полная защита синхронного вызова. Ключевое: retry с backoff+jitter, и CB чтобы ретраи не добивали зависимость.'):NO('Включи на сервисе ВСЕ три: Timeout, Retry, Circuit Breaker')},

// ═══════════ STAFF / CTO (131-138): проектирование систем целиком ═══════════
{lv:'staff',t:'Дизайн: сокращатель ссылок',goal:'Read-heavy 100:1. Gateway→Сервис(Cache Aside)→Redis+БД. Зелёный при ×2М.',
 theory:'Классика собеса. Запись (создать short→long) редка, чтение (редирект) огромно — 100:1. Ключевые решения: генерация ключа (счётчик+base62 vs hash с проверкой коллизий), кэш горячих ссылок в Redis (99% попаданий), БД — key-value (хватит и Redis с персистентностью, или Cassandra). Редирект 301 vs 302 (301 кэшируется браузером — снимает нагрузку, но нет аналитики кликов). Storage оцени: 100М ссылок/мес × 500Б.',
 tip:'Gateway→Сервис с Cache Aside→Redis+БД. Чтений много — упор на кэш. ×2М',load:2000000,
 check:H=>H.has('redis')&&H.patternOnCat('svc','cache_aside')&&H.pathTo('db')&&H.noErr()?OK('Read-heavy решается кэшем. Проговори генерацию ключа, 301 vs 302, оценку storage.'):NO('Gateway→Сервис(Cache Aside)→Redis+БД, зелёное при ×2М')},

{lv:'staff',t:'Дизайн: лента Twitter',goal:'Posts→Kafka→Fan-out→Redis (предрасчёт лент), Feed читает из Redis. ×2М.',
 theory:'Главный trade-off: fan-out on WRITE vs on READ. On write: при посте сразу разносим его в Redis-ленты всех подписчиков — чтение мгновенное, но звезда с 50М фолловеров = 50М записей на один твит. On read: собираем ленту в момент запроса — дёшево на запись, дорого на чтение. Гибрид (так делает Twitter): обычным юзерам fan-out on write, звёздам on read (их твиты подмешиваем при чтении). Hot key звезды решается этим гибридом.',
 tip:'Posts→Kafka→Fanout-сервис→Redis, отдельный Feed→Redis. ×2М',load:2000000,
 check:H=>H.link('service','kafka')&&H.linkC('broker','svc')&&H.has('redis')&&H.cntLinkC('svc','cache')>=1&&H.noErr()?OK('Предрасчёт лент = мгновенная выдача. На собесе разбери гибрид fan-out и проблему звёзд.'):NO('Posts→Kafka→Fanout→Redis, Feed→Redis, зелёное ×2М')},

{lv:'staff',t:'Дизайн: Uber (геопоиск)',goal:'Клиенты→Gateway→Сервис→NATS (локации real-time) + Cassandra (история). ×2М.',
 theory:'Сердце — поиск ближайших водителей. Координаты дробят геохешем/H3/QuadTree (соседние точки = близкие индексы, ищешь в своей ячейке + соседних). Локации обновляются раз в секунду от миллионов машин — гигантский write поток в Cassandra/Redis Geo. Матчинг и трекинг — real-time через NATS/WebSocket. Разделяй: горячие данные (текущие позиции, в памяти) и холодные (история поездок, Cassandra). Это про write-heavy + гео + real-time одновременно.',
 tip:'Gateway→Сервис→NATS (позиции) и →Cassandra (история). Cassandra с нодами. ×2М',load:2000000,
 check:H=>H.has('nats')&&H.has('cassandra')&&H.linkC('gw','svc')&&H.noErr()?OK('Гео+real-time+write-heavy. Проговори геохеш/H3, разделение горячих/холодных данных.'):NO('Gateway→Сервис→NATS + Cassandra, зелёное ×2М')},

{lv:'staff',t:'Дизайн: платёжная система',goal:'PostgreSQL SERIALIZABLE + Kafka exactly-once + Circuit Breaker + сервис антифрода.',
 theory:'Деньги = надёжность важнее скорости. ACID-транзакции (PostgreSQL SERIALIZABLE — никаких аномалий), идемпотентность (exactly-once + idempotency-key — никаких двойных списаний), Saga для распределённых платежей с компенсациями (возврат при сбое). Double-entry bookkeeping (каждая операция = дебет+кредит, всегда сходится). Антифрод асинхронно через Kafka, чтобы не тормозить платёж. Аудит-лог неизменяемый. Reconciliation — ночная сверка.',
 tip:'PostgreSQL SERIALIZABLE, Kafka exactly-once, CB на сервисах, отдельный Fraud-сервис',load:10000,
 check:H=>H.setEq('postgresql','isolation','SERIALIZABLE')&&H.setEq('kafka','delivery','exactly-once')&&H.patternOnCat('svc','circuit_breaker')&&H.count('service')>=2?OK('Банковский уровень: ACID + идемпотентность + Saga + аудит. Медленнее, но без потерь и дублей.'):NO('Нужно: SERIALIZABLE + Kafka exactly-once + Circuit Breaker + ≥2 сервиса')},

{lv:'staff',t:'Дизайн: Netflix (стриминг)',goal:'CDN(видео) + сервисы + Redis(рекомендации) + ClickHouse(аналитика). ×2М.',
 theory:'90% трафика — само видео, и оно НЕ идёт через бэкенд: CDN с edge-серверами у провайдеров (Netflix Open Connect ставит железки прямо в дата-центрах ISP). Бэкенд обслуживает только метаданные, профили, рекомендации (предрассчитаны в Redis), биллинг. Просмотры/события → ClickHouse для аналитики и обучения рекомендаций. Адаптивный битрейт (ABR) — клиент сам переключает качество. Разделение тяжёлого медиа-трафика и лёгкого API — главная идея.',
 tip:'CDN для видео, сервисы метаданных, Redis рекомендации, ClickHouse аналитика. ×2М',load:2000000,
 check:H=>H.has('cdn')&&H.has('redis')&&H.has('clickhouse')&&H.count('service')>=2&&H.noErr()?OK('Видео через CDN (не трогает бэкенд!), API лёгкий, аналитика отдельно. Так устроен стриминг.'):NO('CDN + Redis + ClickHouse + сервисы, зелёное ×2М')},

{lv:'staff',t:'Дизайн: глобальная система на 100М',goal:'Multi-region: ≥2 Gateway, CDN, LB, кэш, шардированная/масштабированная БД. Зелёное ×2М.',
 theory:'Собери всё вместе под глобальный масштаб. Уровни: CDN (статика у юзера) → GeoDNS → региональные Gateway-кластеры → LB → реплики сервисов → многослойный кэш (CDN/Redis) → шардированное хранилище с репликами по регионам. Думай про: failover региона, replication lag, data residency, стоимость (трафик между регионами дорог). Это не про один приём, а про слаженность всех уровней и осознанные trade-offs на каждом.',
 tip:'≥2 Gateway, CDN, LB, Redis+Cache Aside, масштабированная БД, путь до хранилища. ×2М',load:2000000,
 check:H=>H.count('api_gw')>=2&&H.has('cdn')&&H.hasCat('net')&&H.patternOnCat('svc','cache_aside')&&H.pathTo('db')&&H.noErr()&&H.noCascade()?OK('Глобальная многоуровневая система. Каждый слой масштабирован и осознанно выбран.'):H.count('api_gw')<2?NO('≥2 Gateway (регионы)'):!H.has('cdn')?NO('Добавь CDN'):!H.patternOnCat('svc','cache_aside')?NO('Включи Cache Aside'):H.overloaded().length?NO('Горят: '+H.overloaded().join(', ')):NO('Доведи до зелёного без каскадов')},

{lv:'staff',t:'Дешевле или надёжнее (trade-off)',goal:'Удержи ×2М МИНИМУМОМ блоков (≤7), без красного и каскадов, путь до БД.',
 theory:'Сеньор/стафф ценят не за нагромождение технологий, а за СОРАЗМЕРНОСТЬ. Каждый компонент — это деньги, сложность, точка отказа и человек на дежурстве. Лучший дизайн решает задачу минимумом частей. На собесе всегда явно проговаривай trade-offs: что выиграл и чем заплатил. Over-engineering (Kafka там, где хватит вызова функции) — красный флаг. Умей сказать: для этой нагрузки это избыточно.',
 tip:'≤7 блоков, держи ×2М зелёным. Ничего лишнего',load:2000000,
 check:H=>H.n<=7&&H.n>=4&&H.noErr()&&H.noCascade()&&H.pathTo('db')?OK('Соразмерность — признак зрелости. Решил задачу минимумом, не раздувая. Это ценят выше всего.'):H.n>7?NO('Слишком много блоков — упрости до ≤7'):H.overloaded().length?NO('Горят: '+H.overloaded().join(', ')):NO('Собери компактную (≤7) систему до БД, зелёную при ×2М')},

{lv:'staff',t:'Капстоун: спроектируй и защити',goal:'Своя highload-система: ≥10 блоков, ≥3 паттерна, путь до БД, ×2М без красного и каскадов, без анти-паттернов.',
 theory:'Финал. Спроектируй осмысленную систему любой предметной области как на реальном собесе. Требования: ≥10 блоков, ≥3 разных паттерна устойчивости, многослойность (кэш, async, правильные БД под задачу), и под ×2М — ноль красных, ноль каскадов, ноль анти-паттернов. И главное, чего тренажёр не проверит, но проверит интервьюер: умей вслух обосновать КАЖДОЕ решение и назвать его цену. Архитектура без проговоренных trade-offs — это не сеньор-ответ.',
 tip:'Прояви всё: оценка нагрузки, масштаб, кэш, async, паттерны, правильные БД, multi-region',load:2000000,
 check:H=>{const pats=new Set();H.B.forEach(b=>(b.patterns||[]).forEach(p=>pats.add(p)));return H.n>=10&&pats.size>=3&&H.noErr()&&H.noCascade()&&H.pathTo('db')&&H.noBad()?OK('🎓🔴 STAFF ПРОЙДЕН! Ты проектируешь масштабируемые отказоустойчивые системы и понимаешь trade-offs. Иди и забери свой оффер.'):H.n<10?NO('Нужно ≥10 блоков'):pats.size<3?NO('Используй ≥3 разных паттерна'):H.overloaded().length?NO('Горят: '+H.overloaded().join(', ')):H.cascading().length?NO('Каскады: '+H.cascading().join(', ')):!H.noBad()?NO('Есть анти-паттерны — убери красные связи'):NO('Доведи путь до хранилища')}},
];

// ═══════════════════════════════════════════════════════════════
// UI ТРЕНАЖЁРА
// ═══════════════════════════════════════════════════════════════
let TR={open:false,lv:'junior',idx:0};
function trProgress(){try{return JSON.parse(localStorage.getItem('arch4_progress')||'{}');}catch{return{};}}
function trSaveProgress(p){localStorage.setItem('arch4_progress',JSON.stringify(p));}
function trList(lv){return TASKS.filter(t=>t.lv===lv);}

function openTrainer(){TR.open=true;if(typeof setLoadMode==='function')setLoadMode('sandbox');const p=trProgress();TR.idx=p[TR.lv]||0;$('trainer').style.display='flex';renderTrainer();}
function closeTrainer(){TR.open=false;$('trainer').style.display='none';}
function trSetLevel(lv){TR.lv=lv;const p=trProgress();TR.idx=p[TR.lv]||0;renderTrainer();}
function trGo(d){const list=trList(TR.lv);TR.idx=Math.max(0,Math.min(list.length-1,TR.idx+d));renderTrainer();}
function trClearCanvas(){S.blocks=[];S.conns=[];S.selected=null;pushHist();analyze();}

function renderTrainer(){
  const list=trList(TR.lv);const task=list[TR.idx];if(!task)return;
  const p=trProgress();const done=p[TR.lv+'_done']||[];
  if(task.load!==undefined&&task.load!==S.load)setLoad(task.load);
  const lvName={junior:'🟢 Junior',middle:'🔵 Middle',senior:'🟣 Senior',staff:'🔴 Staff/CTO'}[TR.lv];
  const doneCount=done.length;
  $('tr-body').innerHTML=`
    <div class="tr-lvtabs">
      <div class="tr-lvtab ${TR.lv==='junior'?'on':''}" onclick="trSetLevel('junior')">🟢 Jun</div>
      <div class="tr-lvtab ${TR.lv==='middle'?'on':''}" onclick="trSetLevel('middle')">🔵 Mid</div>
      <div class="tr-lvtab ${TR.lv==='senior'?'on':''}" onclick="trSetLevel('senior')">🟣 Sen</div>
      <div class="tr-lvtab ${TR.lv==='staff'?'on':''}" onclick="trSetLevel('staff')">🔴 Staff</div>
    </div>
    <div class="tr-progress"><div class="tr-progress-bar" style="width:${doneCount/list.length*100}%"></div></div>
    <div class="tr-meta">${lvName} · Задача ${TR.idx+1}/${list.length} · решено ${doneCount} ${done.includes(TR.idx)?'· ✅ эта решена':''}</div>
    <div class="tr-title">${task.t}</div>
    <div class="tr-goal">🎯 ${task.goal}</div>
    <details class="tr-theory" open><summary>📖 Теория</summary><div>${task.theory}</div></details>
    <div class="tr-tip">💡 ${task.tip}</div>
    <div id="tr-result"></div>
    <div class="tr-actions">
      <button class="tr-btn check" onclick="trCheck()">✓ Проверить</button>
      <button class="tr-btn" onclick="trClearCanvas()">Очистить холст</button>
    </div>
    <div class="tr-nav">
      <button class="tr-btn" onclick="trGo(-1)" ${TR.idx===0?'disabled':''}>◀ Назад</button>
      <button class="tr-btn" onclick="trGo(1)" ${TR.idx===list.length-1?'disabled':''}>Дальше ▶</button>
    </div>`;
}

function trCheck(){
  const list=trList(TR.lv);const task=list[TR.idx];if(!task)return;
  if(task.load!==undefined)setLoad(task.load);
  const res=task.check(TH());
  const el=$('tr-result');
  if(res.ok){
    el.className='tr-result ok';el.innerHTML=`✅ <b>Верно!</b> ${res.msg}`;
    const p=trProgress();const done=p[TR.lv+'_done']||[];
    if(!done.includes(TR.idx)){done.push(TR.idx);p[TR.lv+'_done']=done;}
    p[TR.lv]=Math.min(list.length-1,TR.idx+1);trSaveProgress(p);
    toast('✅ Задача решена!');
    setTimeout(()=>{if(TR.idx<list.length-1){trGo(1);}else{el.innerHTML='🎓 Уровень пройден полностью!';}},1400);
  } else {
    el.className='tr-result no';el.innerHTML=`❌ ${res.msg}`;
  }
}
