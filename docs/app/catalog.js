// CATALOG — данные: типы блоков (EL), настройки по типам (SETTINGS_DEF), примеры и шаблоны

// ═══════════════════════════════════════════════════════════════
// UI-МЕТАДАННЫЕ: названия, цвета, описания, ГДЕ СТАВИТЬ
// ═══════════════════════════════════════════════════════════════
const EL = {
  web_client:{lbl:'Web Client',clr:'#9399b2',
    role:'Браузер пользователя — точка входа в систему',
    place:'Ставится В НАЧАЛЕ. Соединяй ТОЛЬКО с Gateway или CDN.',
    never:'Никогда не соединяй напрямую с сервисом или БД',
    tip:'Это то, что открывает пользователь в браузере'},
  mob_client:{lbl:'Mobile',clr:'#7287fd',
    role:'Мобильное приложение iOS/Android',
    place:'Ставится В НАЧАЛЕ. Соединяй с Gateway или BFF.',
    never:'Никогда не подключай напрямую к БД',
    tip:'Часто имеет свой BFF — отдельный бэкенд под мобилку'},
  api_gw:{lbl:'API Gateway',clr:'#e0af68',
    role:'Единая дверь в систему. Встроенная аутентификация (JWT/OAuth2/Session/API Key), rate limiting, роутинг.',
    place:'СРАЗУ после клиента, ПЕРЕД сервисами. Клиент → Gateway → Сервис.',
    never:'Не соединяй Gateway напрямую с БД — это работа сервиса.',
    tip:'Режим JWT: Gateway сам проверяет подпись токена локально — Auth Service НЕ вызывается на каждый запрос (stateless). Режим Session/OAuth2 Introspection: Gateway вызывает Auth Service на каждый запрос. Настрой режим в ⚙ Настройки.'},
  websocket_gw:{lbl:'WS Gateway',clr:'#7dcfff',
    role:'WebSocket Gateway — двунаправленный real-time канал',
    place:'После клиента. Клиент → WS Gateway → сервис/брокер.',
    never:'Не используй для REST-запросов — только для real-time push',
    tip:'Держит постоянное соединение. Сервер сам пушит данные клиенту без запроса'},
  lb:{lbl:'Load Balancer',clr:'#ff9e64',
    role:'Распределяет нагрузку между копиями (репликами) одного сервиса',
    place:'ПЕРЕД группой одинаковых сервисов. После LB — реплики.',
    never:'НЕ ставь после Kafka/RabbitMQ — у брокеров своя балансировка',
    tip:'Делит запросы поровну. 3 реплики за LB = тройная ёмкость'},
  cdn:{lbl:'CDN',clr:'#9ece6a',
    role:'Кэш статики (картинки, JS, видео) близко к пользователю',
    place:'ПЕРВЫМ, до Gateway. Клиент → CDN для статики.',
    never:'Не для динамических данных и не для записи',
    tip:'Самый высокий лимит (10М). Снимает нагрузку с серверов'},
  service:{lbl:'Сервис',clr:'#7aa2f7',
    role:'Микросервис с бизнес-логикой — ядро системы',
    place:'После Gateway/LB. Соединяй с БД, кэшем, брокером.',
    never:'Вызов другого сервиса синхронно — только с Circuit Breaker!',
    tip:'Реплики (настройки) умножают ёмкость. 1 сервис = 10К rps. Сервис может быть и продюсером и консьюмером одновременно'},
  bff:{lbl:'BFF',clr:'#74c7ec',
    role:'Backend for Frontend — бэкенд под конкретный клиент',
    place:'Между клиентом и сервисами. Web BFF и Mobile BFF отдельно.',
    never:'Не делай один BFF на всех — смысл в специализации',
    tip:'Собирает данные из нескольких сервисов в удобный формат'},
  auth:{lbl:'Auth Provider',clr:'#bb9af7',
    role:'Сервис аутентификации — обрабатывает /login, /register, /refresh. Тип (JWT/OAuth2/Session) влияет на схему БД и на то, вызывает ли Gateway этот сервис при каждом запросе.',
    place:'После Gateway. Две роли: (1) всегда обрабатывает auth-эндпоинты (login/register/refresh). (2) вызывается Gateway при OAuth2 Introspection / Session режиме на каждый запрос. При JWT — Gateway валидирует токен локально, Auth Service на обычных запросах НЕ вызывается.',
    never:'Не подключай напрямую к бизнес-сервисам — только Gateway знает об Auth. При JWT режиме не жди вызовов к Auth на каждый запрос — это stateless.',
    tip:'JWT = stateless (Auth вызывается только на /login и /refresh, потом молчит). Session = stateful (Auth вызывается Gateway на КАЖДЫЙ запрос — bottleneck). Тип меняется в сайдбаре → схема БД перестраивается автоматически.'},
  postgresql:{lbl:'PostgreSQL',clr:'#4a90d9',
    role:'Реляционная БД с ACID — для транзакций, финансов, заказов',
    place:'В КОНЦЕ цепочки, подключай к сервису.',
    never:'Никогда напрямую к клиенту или Gateway',
    tip:'Слабый лимит 10К. Настройки: PgBouncer (×5), реплики, изоляция'},
  mysql:{lbl:'MySQL',clr:'#4479A1',
    role:'Реляционная БД, популярна в вебе',
    place:'В конце, к сервису. Read Replica для чтения.',
    never:'Не напрямую к клиенту',
    tip:'В новых проектах лучше PostgreSQL — он мощнее'},
  mongodb:{lbl:'MongoDB',clr:'#47A248',
    role:'Документная NoSQL — для гибких данных без жёсткой схемы',
    place:'К сервису. Шардирование для масштаба.',
    never:'Не для финансовых транзакций (нет нормального ACID)',
    tip:'Хороша для каталогов, профилей, контента'},
  redis:{lbl:'Redis',clr:'#f7768e',
    role:'In-memory кэш — данные в RAM, очень быстро (0.1мс)',
    place:'ПЕРЕД БД. Сервис → Redis, при промахе → БД.',
    never:'Не единственное хранилище (RAM теряется при рестарте)',
    tip:'Cache Aside на сервисе + Redis = до БД доходит лишь 20% запросов'},
  cassandra:{lbl:'Cassandra',clr:'#2ac3de',
    role:'Wide-column NoSQL — для огромных объёмов записи (логи, события)',
    place:'К сервису для time-series данных.',
    never:'Не для транзакций и сложных JOIN',
    tip:'Лимит 100К, масштабируется нодами. Для трекинга идеальна'},
  clickhouse:{lbl:'ClickHouse',clr:'#e0af68',
    role:'Колоночная OLAP — для аналитики по миллиардам строк',
    place:'В конце аналитического пути. Часто после Kafka.',
    never:'Не для частых UPDATE/DELETE и не для транзакций',
    tip:'Аналитика в 100× быстрее PostgreSQL'},
  elasticsearch:{lbl:'Elasticsearch',clr:'#f0c674',
    role:'Поисковый движок — полнотекстовый поиск, фильтры, агрегации',
    place:'К сервису поиска. Индекс наполняется из БД-источника (часто через Kafka).',
    never:'Не основное хранилище — индекс можно перестроить, данные-источник нельзя',
    tip:'Поиск «как в Google» по каталогу/документам. Шарды ×ёмкость'},
  s3:{lbl:'S3 / Objects',clr:'#f5a97f',
    role:'Объектное хранилище — файлы, картинки, видео, бэкапы',
    place:'К сервису файлов/медиа. Клиент качает по presigned URL мимо сервиса.',
    never:'Не для транзакционных данных и поиска по содержимому',
    tip:'Хранит блобы дёшево. Метаданные файлов — в PostgreSQL рядом'},
  kafka:{lbl:'Kafka',clr:'#bb9af7',
    role:'Распределённый лог событий — асинхронная доставка миллионов сообщений',
    place:'МЕЖДУ сервисами для асинхронной связи. Producer → Kafka → Consumer.',
    never:'Не нужен Load Balancer рядом — балансирует сам через партиции',
    tip:'Producer не ждёт ответа. Сервис может быть и продюсером (пишет), и консьюмером (читает) одновременно'},
  rabbitmq:{lbl:'RabbitMQ',clr:'#ff9e64',
    role:'Брокер сообщений — для задач и уведомлений',
    place:'Между сервисами для асинхронных задач.',
    never:'При >50К msg/s переходи на Kafka',
    tip:'Хорош для email, уведомлений, фоновых задач'},
  nats:{lbl:'NATS',clr:'#7dcfff',
    role:'Лёгкий быстрый брокер — для IoT и real-time',
    place:'Между сервисами/устройствами для быстрых сообщений.',
    never:'Меньше гарантий доставки чем Kafka',
    tip:'0.5мс latency, идеален для IoT. Pub/Sub: каждый подписчик получает копию'},
  queue:{lbl:'Queue',clr:'#89dceb',
    role:'FIFO очередь для фоновых задач',
    place:'Между сервисом и worker-ом.',
    never:'При >100К msg/s нужен Kafka',
    tip:'Один worker = одна задача за раз'},
  actor:{lbl:'Актор / Роль',clr:'#7aa2f7',shape:'person',sub:'Person',
    role:'Пользователь или роль, инициирующая действия (C4 Person)',
    place:'В начале схемы, как источник запросов.',
    never:'Не сток данных — актор только инициирует',
    tip:'Студент, Ментор, Кассир, Админ — переименуй через ПКМ'},
  external:{lbl:'Внешний сервис',clr:'#9399b2',shape:'ext',sub:'External',
    role:'Сторонняя система вне нашего контроля',
    place:'На границе системы.',
    never:'Мы не управляем её внутренностями',
    tip:'Платёжный шлюз, SMTP/Email, внешнее API'},
};

// Проброс cat/cap/lat из движка в EL для UI
Object.keys(EL).forEach(t=>{
  if(BASE[t]){
    EL[t].cat=BASE[t].cat;
    EL[t].maxRps=BASE[t].cap;
    EL[t].lat=BASE[t].lat;
  }
});

const CATS=[
  {emoji:'👤', key:'cat_who',      els:['actor']},
  {emoji:'🌐', key:'cat_clients',  els:['web_client','mob_client']},
  {emoji:'🚪', key:'cat_gateways', els:['api_gw','lb','cdn']},
  {emoji:'⚡', key:'cat_realtime', els:['websocket_gw']},
  {emoji:'⚙', key:'cat_services', els:['service','bff','auth']},
  {emoji:'🗄', key:'cat_storage',  els:['postgresql','mysql','mongodb','cassandra','clickhouse','elasticsearch','s3','redis']},
  {emoji:'📡', key:'cat_brokers',  els:['kafka','rabbitmq','nats','queue']},
  {emoji:'🌍', key:'cat_external', els:['external']},
];

// ═══════════════════════════════════════════════════════════════
// НАСТРОЙКИ ПОД КАЖДЫЙ ТИП (реально влияют на симуляцию)
// ═══════════════════════════════════════════════════════════════
const SETTINGS_DEF = {
  service:[
    {k:'replicas',lbl:'Реплики',type:'num',def:1,min:1,max:200,hint:'Копии сервиса за балансировщиком. Каждая ×ёмкость.'},
    {k:'_pat_circuit_breaker',lbl:'⚡ Circuit Breaker',type:'pat',hint:'Размыкается при отказах зависимости → быстрый отказ вместо ожидания.'},
    {k:'_pat_retry',lbl:'🔄 Retry x3',type:'pat',hint:'Повтор при ошибке. ОСТОРОЖНО: при перегрузе усиливает нагрузку.'},
    {k:'_pat_cache_aside',lbl:'💾 Cache Aside',type:'pat',hint:'Нужен Redis в схеме. До БД доходит лишь 20% запросов.'},
    {k:'_pat_timeout',lbl:'⏱ Timeout 2с',type:'pat',hint:'Обрывает зависшие запросы, освобождает ресурсы.'},
  ],
  bff:[
    {k:'replicas',lbl:'Реплики',type:'num',def:1,min:1,max:100,hint:'Копии BFF за балансировщиком.'},
    {k:'_pat_circuit_breaker',lbl:'⚡ Circuit Breaker',type:'pat',hint:'Защита от каскадных отказов.'},
    {k:'_pat_cache_aside',lbl:'💾 Cache Aside',type:'pat',hint:'Кэширование ответов.'},
  ],
  auth:[
    {k:'replicas',lbl:'Реплики',type:'num',def:1,min:1,max:100,hint:'Копии Auth-сервиса за балансировщиком.'},
    {k:'_pat_timeout',lbl:'⏱ Timeout',type:'pat',hint:'Обрывает зависшие запросы к БД токенов/сессий.'},
  ],
  api_gw:[
    {k:'instances',lbl:'Инстансы',type:'num',def:1,min:1,max:50,hint:'Копии Gateway. Каждая добавляет 100К rps ёмкости.'},
    {k:'auth_mode',lbl:'Режим аутентификации',type:'sel',
     opts:['Нет (публичное API)','JWT (встроенный)','OAuth2 Introspection','Session Cookie','API Key'],
     def:'JWT (встроенный)',
     hint:'JWT — Gateway проверяет подпись токена локально, Auth Service НЕ вызывается на каждый запрос (stateless, быстро). OAuth2 Introspection / Session — Gateway вызывает Auth Service на каждый запрос (нужен отдельный Auth Service на схеме). API Key — простая проверка ключа в заголовке.'},
    {k:'token_location',lbl:'Токен передаётся в',type:'sel',
     opts:['Authorization: Bearer','Cookie (HttpOnly)','X-API-Key (header)','?token= (query)'],
     def:'Authorization: Bearer',
     hint:'Authorization: Bearer — стандарт REST/SPA. Cookie — SSR-приложения (Next.js, Rails). X-API-Key — для B2B интеграций и машинных клиентов.'},
    {k:'_pat_circuit_breaker',lbl:'⚡ Circuit Breaker',type:'pat',hint:'Защищает от падающих сервисов.'},
    {k:'_pat_timeout',lbl:'⏱ Timeout',type:'pat',hint:'Обрывает зависшие запросы к сервисам.'},
  ],
  websocket_gw:[
    {k:'instances',lbl:'Инстансы',type:'num',def:1,min:1,max:50,hint:'Копии WS Gateway.'},
    {k:'maxConn',lbl:'Макс. соединений',type:'num',def:10000,min:1000,max:1000000,hint:'Максимум одновременных WebSocket-соединений.'},
  ],
  lb:[
    {k:'instances',lbl:'Инстансы LB',type:'num',def:1,min:1,max:10,hint:'Обычно хватает 1-2 (лимит 1М каждый).'},
    {k:'algo',lbl:'Алгоритм',type:'sel',opts:['round-robin','least-conn','ip-hash'],def:'round-robin',hint:'round-robin — по кругу. least-conn — наименее загруженному. ip-hash — привязка по IP.'},
  ],
  postgresql:[
    {k:'isolation',lbl:'Уровень изоляции',type:'sel',opts:['READ COMMITTED','REPEATABLE READ','SERIALIZABLE'],def:'READ COMMITTED',hint:'SERIALIZABLE безопаснее но медленнее на 40%.'},
    {k:'pgbouncer',lbl:'PgBouncer (пулинг)',type:'tog',hint:'Connection pooler. ×5 к ёмкости. ОБЯЗАТЕЛЕН при >500 соединений.'},
    {k:'replicas',lbl:'Read Replicas',type:'num',def:0,min:0,max:10,hint:'Реплики для чтения. Каждая +70% ёмкости.'},
  ],
  mysql:[
    {k:'isolation',lbl:'Изоляция',type:'sel',opts:['READ COMMITTED','REPEATABLE READ','SERIALIZABLE'],def:'REPEATABLE READ',hint:'У MySQL по умолчанию REPEATABLE READ.'},
    {k:'pgbouncer',lbl:'Connection Pool',type:'tog',hint:'Пул соединений ×5 к ёмкости.'},
    {k:'replicas',lbl:'Read Replicas',type:'num',def:0,min:0,max:10,hint:'Реплики чтения.'},
  ],
  redis:[
    {k:'persistence',lbl:'Персистентность',type:'sel',opts:['none','RDB','AOF'],def:'RDB',hint:'none — быстро, данные теряются при рестарте. RDB — снимки. AOF — каждая операция на диск.'},
    {k:'eviction',lbl:'Вытеснение',type:'sel',opts:['noeviction','allkeys-LRU','allkeys-LFU','volatile-TTL'],def:'allkeys-LRU',hint:'Что удалять при заполнении RAM.'},
    {k:'cluster',lbl:'Redis Cluster',type:'tog',hint:'Шардирование по нодам. ×10 к ёмкости.'},
  ],
  kafka:[
    {k:'topic_name',lbl:'Имя топика',type:'txt',def:'events',hint:'Название топика (order.created, payment.processed). Отображается в инспекторе.'},
    {k:'delivery',lbl:'Гарантия доставки',type:'sel',opts:['at-most-once','at-least-once','exactly-once'],def:'at-least-once',hint:'at-most-once — быстро, возможны потери. at-least-once — без потерь, возможны дубли. exactly-once — ровно один раз, но −50% скорости.'},
    {k:'partitions',lbl:'Партиции',type:'num',def:3,min:1,max:200,hint:'Параллелизм. Больше партиций = выше пропускная способность.'},
    {k:'replication',lbl:'Replication Factor',type:'num',def:3,min:1,max:5,hint:'Сколько копий данных на разных нодах. 3 — стандарт.'},
  ],
  cassandra:[
    {k:'consistency',lbl:'Consistency Level',type:'sel',opts:['ONE','QUORUM','ALL'],def:'QUORUM',hint:'ONE — быстро. QUORUM — большинство (баланс). ALL — все ноды.'},
    {k:'nodes',lbl:'Ноды кластера',type:'num',def:3,min:1,max:50,hint:'Больше нод = больше ёмкость и отказоустойчивость.'},
  ],
  clickhouse:[
    {k:'shards',lbl:'Шарды',type:'num',def:1,min:1,max:20,hint:'Распределение данных. Каждый шард ×ёмкость.'},
  ],
  elasticsearch:[
    {k:'shards',lbl:'Шарды',type:'num',def:1,min:1,max:30,hint:'Каждый шард ×ёмкость индекса.'},
  ],
  mongodb:[
    {k:'sharding',lbl:'Шардирование',type:'tog',hint:'Распределение коллекций по шардам. ×4 к ёмкости.'},
    {k:'replicas',lbl:'Replica Set',type:'num',def:1,min:1,max:7,hint:'Копии для отказоустойчивости и чтения.'},
  ],
  rabbitmq:[
    {k:'exchange',lbl:'Тип Exchange',type:'sel',opts:['direct','fanout','topic'],def:'direct',
     hint:'direct — сообщение в одну очередь по routing key. fanout — КОПИЯ в очередь каждого консьюмера (broadcast). topic — маршрутизация по паттерну (order.*).'},
    {k:'ack',lbl:'Подтверждения',type:'sel',opts:['none','manual','auto'],def:'manual',hint:'manual — consumer подтверждает обработку. none — fire and forget.'},
    {k:'mirrored',lbl:'Mirrored Queues',type:'tog',hint:'Зеркалирование очередей на ноды. Надёжнее, но −30% скорости.'},
  ],
  nats:[
    {k:'jetstream',lbl:'JetStream',type:'tog',hint:'Персистентность (как у Kafka). БЕЗ JetStream: NATS core = at-most-once, сообщение без подписчика ТЕРЯЕТСЯ — увидишь в инспекторе.'},
  ],
  cdn:[
    {k:'ttl',lbl:'Cache TTL',type:'sel',opts:['1m','1h','1d','7d'],def:'1h',hint:'Сколько хранить кэш.'},
  ],
  queue:[
    {k:'workers',lbl:'Workers',type:'num',def:1,min:1,max:50,hint:'Сколько worker-ов разбирают очередь параллельно.'},
    {k:'ack',lbl:'Подтверждения',type:'sel',opts:['auto','manual'],def:'manual',hint:'manual — явное подтверждение. auto — после получения.'},
  ],
};

const PAT={
  circuit_breaker:{lbl:'Circuit Breaker',icon:'⚡'},
  retry:{lbl:'Retry',icon:'🔄'},
  cache_aside:{lbl:'Cache Aside',icon:'💾'},
  bulkhead:{lbl:'Bulkhead',icon:'🛡'},
  timeout:{lbl:'Timeout',icon:'⏱'},
};

// ═══════════════════════════════════════════════════════════════
// ПРИМЕРЫ + ШАБЛОНЫ
// ═══════════════════════════════════════════════════════════════
const TMPLS={
  // ── Готовые сервисы ──
  account:{lbl:'Личный кабинет',lbl_en:'User Account',g:'Элементы',theme:'Базовые сервисы',bls:[{t:'service',dx:0,dy:0,cl:'Личный кабинет'},{t:'postgresql',dx:0,dy:110,cl:'User DB',db:'profile_postgres'}],cs:[[0,1]]},
  auth:{lbl:'Авторизация',lbl_en:'Authorization',g:'Элементы',theme:'Безопасность',bls:[{t:'api_gw',dx:0,dy:55},{t:'auth',dx:180,dy:55,cl:'Auth Provider',pat:['timeout'],auth:{type:'jwt_only'}},{t:'postgresql',dx:360,dy:55,cl:'Auth DB',db:'auth_postgres'}],cs:[[0,1],[1,2]]},
  search:{lbl:'Поиск (Elasticsearch)',lbl_en:'Search (Elasticsearch)',g:'Элементы',theme:'Поиск и рекомендации',bls:[{t:'service',dx:0,dy:0,cl:'Поиск'},{t:'elasticsearch',dx:185,dy:0,cl:'Search Index'}],cs:[[0,1]]},
  media:{lbl:'Файлы / Медиа',lbl_en:'Files / Media',g:'Элементы',theme:'Хранение и файлы',bls:[{t:'service',dx:0,dy:0,cl:'Файлы',pat:['timeout']},{t:'s3',dx:185,dy:-20,cl:'S3 Storage'},{t:'postgresql',dx:185,dy:90,cl:'Files Meta',db:'files_postgres'}],cs:[[0,1],[0,2]]},
  chat_ws:{lbl:'Чат (WebSocket)',lbl_en:'Chat (WebSocket)',g:'Элементы',theme:'Коммуникации',bls:[{t:'websocket_gw',dx:0,dy:0},{t:'service',dx:185,dy:0,cl:'Чат'},{t:'mongodb',dx:370,dy:-20,cl:'Chat DB',db:'chat_mongodb'},{t:'redis',dx:370,dy:90,cl:'Pub/Sub'}],cs:[[0,1],[1,2],[1,3]]},
  catalog:{lbl:'Каталог',lbl_en:'Catalog',g:'Элементы',theme:'Базовые сервисы',bls:[{t:'service',dx:0,dy:0,cl:'Каталог',pat:['cache_aside']},{t:'redis',dx:180,dy:-20},{t:'mongodb',dx:180,dy:90,cl:'Catalog DB',db:'catalog_mongodb'}],cs:[[0,1],[0,2]]},
  cart:{lbl:'Корзина',lbl_en:'Cart',g:'Элементы',theme:'Базовые сервисы',bls:[{t:'service',dx:0,dy:0,cl:'Корзина'},{t:'redis',dx:180,dy:-20,cl:'Cart Cache',db:'cart_redis'},{t:'postgresql',dx:180,dy:90,cl:'Cart DB',db:'ecommerce_orders'}],cs:[[0,1],[0,2]]},
  payment:{lbl:'Оплата',lbl_en:'Payment',g:'Элементы',theme:'Платежи и биллинг',bls:[{t:'service',dx:0,dy:0,cl:'Оплата',pat:['retry','timeout']},{t:'postgresql',dx:0,dy:110,cl:'Payment DB',db:'payment_postgres'},{t:'external',dx:190,dy:0,cl:'Платёжный шлюз'}],cs:[[0,1],[0,2]]},
  notify:{lbl:'Уведомления',lbl_en:'Notifications',g:'Элементы',theme:'Коммуникации',bls:[{t:'service',dx:0,dy:30,cl:'Сервис-источник'},{t:'kafka',dx:185,dy:30},{t:'service',dx:360,dy:30,cl:'Уведомления'},{t:'external',dx:545,dy:30,cl:'SMTP / Email'}],cs:[[0,1],[1,2],[2,3]]},
  crud:{lbl:'CRUD-сервис',lbl_en:'CRUD Service',g:'Элементы',theme:'Базовые сервисы',bls:[{t:'service',dx:0,dy:0,cl:'CRUD-сервис',pat:['cache_aside']},{t:'redis',dx:180,dy:-20},{t:'postgresql',dx:180,dy:90,db:'profile_postgres'}],cs:[[0,1],[0,2]]},
  analytics:{lbl:'Аналитика',lbl_en:'Analytics',g:'Элементы',theme:'Аналитика',bls:[{t:'service',dx:0,dy:0,cl:'Сборщик'},{t:'kafka',dx:175,dy:0},{t:'service',dx:350,dy:0,cl:'ETL'},{t:'clickhouse',dx:350,dy:110,db:'analytics_clickhouse'}],cs:[[0,1],[1,2],[2,3]]},

  // ── Новые сервисные блоки ──
  scheduler:{lbl:'Планировщик / Воркер',lbl_en:'Scheduler / Worker',g:'Элементы',theme:'Асинхронность и джобы',bls:[
    {t:'service',dx:0,dy:30,cl:'Планировщик',pat:['timeout']},
    {t:'queue',dx:185,dy:30},
    {t:'service',dx:370,dy:30,cl:'Воркер',pat:['timeout']},
    {t:'postgresql',dx:185,dy:140,cl:'Job Log',db:'profile_postgres'}
  ],cs:[[0,1],[1,2],[0,3],[2,3]]},

  reports:{lbl:'Отчёты (async)',lbl_en:'Reports (async)',g:'Элементы',theme:'Асинхронность и джобы',bls:[
    {t:'service',dx:0,dy:50,cl:'API отчётов'},
    {t:'queue',dx:185,dy:50,cl:'Report Queue'},
    {t:'service',dx:370,dy:50,cl:'Генератор',pat:['timeout']},
    {t:'clickhouse',dx:185,dy:165,cl:'Analytics'},
    {t:'s3',dx:370,dy:165,cl:'PDF / Excel'}
  ],cs:[[0,1],[1,2],[2,3],[2,4]]},

  saga_step:{lbl:'Сага-шаг (команда+компенсация)',lbl_en:'Saga Step (command+compensation)',g:'Элементы',theme:'Асинхронность и джобы',bls:[
    {t:'kafka',dx:0,dy:0,cl:'Команды'},
    {t:'service',dx:185,dy:40,cl:'Обработчик',pat:['retry']},
    {t:'kafka',dx:370,dy:0,cl:'События'},
    {t:'postgresql',dx:370,dy:120}
  ],cs:[[0,1],[1,2],[1,3]]},

  // ── Платежи и биллинг ──
  refunds:{lbl:'Возвраты и рефанды',lbl_en:'Refunds',g:'Элементы',theme:'Платежи и биллинг',bls:[
    {t:'service',dx:0,dy:0,cl:'Возвраты'},{t:'postgresql',dx:185,dy:0,cl:'Refunds DB',db:'refunds_postgres'}
  ],cs:[[0,1]]},
  invoicing:{lbl:'Инвойсы / счета',lbl_en:'Invoicing',g:'Элементы',theme:'Платежи и биллинг',bls:[
    {t:'service',dx:0,dy:0,cl:'Инвойсы'},{t:'postgresql',dx:185,dy:0,cl:'Invoices DB',db:'invoicing_postgres'}
  ],cs:[[0,1]]},
  billing_sub:{lbl:'Подписки и биллинг',lbl_en:'Subscriptions & Billing',g:'Элементы',theme:'Платежи и биллинг',bls:[
    {t:'service',dx:0,dy:0,cl:'Подписки',pat:['retry']},{t:'postgresql',dx:185,dy:0,cl:'Subscriptions DB',db:'subscriptions_postgres'},{t:'external',dx:370,dy:0,cl:'Платёжный шлюз'}
  ],cs:[[0,1],[0,2]]},
  wallet:{lbl:'Кошелёк пользователя',lbl_en:'User Wallet',g:'Элементы',theme:'Платежи и биллинг',bls:[
    {t:'service',dx:0,dy:0,cl:'Кошелёк',pat:['cache_aside']},{t:'redis',dx:185,dy:-20,cl:'Balance Cache'},{t:'postgresql',dx:185,dy:90,cl:'Wallets DB',db:'wallets_postgres'}
  ],cs:[[0,1],[0,2]]},

  // ── Логирование и мониторинг ──
  central_logs:{lbl:'Централизованные логи (ELK)',lbl_en:'Centralized Logging (ELK)',g:'Элементы',theme:'Логирование и мониторинг',bls:[
    {t:'kafka',dx:0,dy:0,cl:'logs'},{t:'service',dx:185,dy:0,cl:'Log Collector'},{t:'elasticsearch',dx:370,dy:0,cl:'Log Index'}
  ],cs:[[0,1],[1,2]]},
  audit_log:{lbl:'Аудит-лог действий',lbl_en:'Audit Log',g:'Элементы',theme:'Логирование и мониторинг',bls:[
    {t:'service',dx:0,dy:0,cl:'Аудит'},{t:'postgresql',dx:185,dy:0,cl:'Audit DB',db:'audit_postgres'}
  ],cs:[[0,1]]},
  metrics:{lbl:'Метрики (Prometheus-style)',lbl_en:'Metrics (Prometheus-style)',g:'Элементы',theme:'Логирование и мониторинг',bls:[
    {t:'service',dx:0,dy:0,cl:'Сборщик метрик'},{t:'clickhouse',dx:185,dy:0,cl:'Metrics DB',db:'metrics_clickhouse'}
  ],cs:[[0,1]]},
  tracing:{lbl:'Трейсинг запросов (Jaeger-style)',lbl_en:'Distributed Tracing (Jaeger-style)',g:'Элементы',theme:'Логирование и мониторинг',bls:[
    {t:'service',dx:0,dy:0,cl:'Коллектор трейсов'},{t:'cassandra',dx:185,dy:0,cl:'Traces DB',db:'tracing_cassandra'}
  ],cs:[[0,1]]},
  healthcheck:{lbl:'Health-check / Heartbeat',lbl_en:'Health Check / Heartbeat',g:'Элементы',theme:'Логирование и мониторинг',bls:[
    {t:'service',dx:0,dy:0,cl:'Health Check'},{t:'redis',dx:185,dy:0,cl:'Heartbeats'}
  ],cs:[[0,1]]},
  iot_telemetry:{lbl:'IoT-телеметрия',lbl_en:'IoT Telemetry',g:'Элементы',theme:'Логирование и мониторинг',bls:[
    {t:'kafka',dx:0,dy:0,cl:'sensor-data'},{t:'service',dx:185,dy:0,cl:'Приём телеметрии',pat:['timeout']},{t:'cassandra',dx:370,dy:0,cl:'Sensor DB',db:'iot_cassandra'}
  ],cs:[[0,1],[1,2]]},

  // ── Хранение и файлы ──
  versioned_files:{lbl:'Файлы с версионированием',lbl_en:'Versioned Files',g:'Элементы',theme:'Хранение и файлы',bls:[
    {t:'service',dx:0,dy:0,cl:'Файлы',pat:['timeout']},{t:'s3',dx:185,dy:-20,cl:'Blob Storage'},{t:'postgresql',dx:185,dy:90,cl:'Files DB',db:'cloud_files_postgres'}
  ],cs:[[0,1],[0,2]]},
  cold_archive:{lbl:'Холодный архив',lbl_en:'Cold Archive Storage',g:'Элементы',theme:'Хранение и файлы',bls:[
    {t:'service',dx:0,dy:0,cl:'Архивация'},{t:'s3',dx:185,dy:0,cl:'Cold Storage'}
  ],cs:[[0,1]]},
  session_store:{lbl:'Session Store',lbl_en:'Session Store',g:'Элементы',theme:'Хранение и файлы',bls:[
    {t:'service',dx:0,dy:0,cl:'Сессии'},{t:'redis',dx:185,dy:0,cl:'Sessions',db:'sessions_redis'}
  ],cs:[[0,1]]},
  bulk_import:{lbl:'Импорт/экспорт (CSV bulk)',lbl_en:'Bulk Import/Export (CSV)',g:'Элементы',theme:'Хранение и файлы',bls:[
    {t:'service',dx:0,dy:0,cl:'Импорт/экспорт',pat:['timeout']},{t:'queue',dx:185,dy:-40,cl:'Import Queue'},{t:'s3',dx:185,dy:40,cl:'Files'},{t:'postgresql',dx:370,dy:0,cl:'Import Jobs DB',db:'imports_postgres'}
  ],cs:[[0,1],[0,2],[0,3]]},

  // ── Коммуникации ──
  email_campaign:{lbl:'Email-рассылки',lbl_en:'Email Campaigns',g:'Элементы',theme:'Коммуникации',bls:[
    {t:'service',dx:0,dy:0,cl:'Email-рассылки',pat:['retry']},{t:'kafka',dx:185,dy:0,cl:'email-queue'},{t:'external',dx:370,dy:0,cl:'SMTP'}
  ],cs:[[0,1],[1,2]]},
  sms_gateway:{lbl:'SMS-шлюз',lbl_en:'SMS Gateway',g:'Элементы',theme:'Коммуникации',bls:[
    {t:'service',dx:0,dy:0,cl:'SMS-шлюз',pat:['retry']},{t:'external',dx:185,dy:-20,cl:'SMS-провайдер'},{t:'postgresql',dx:185,dy:60,cl:'Delivery Log'}
  ],cs:[[0,1],[0,2]]},
  push_notify:{lbl:'Push-уведомления',lbl_en:'Push Notifications',g:'Элементы',theme:'Коммуникации',bls:[
    {t:'service',dx:0,dy:0,cl:'Push'},{t:'postgresql',dx:185,dy:-20,cl:'Push Tokens DB',db:'notifications_postgres'},{t:'external',dx:185,dy:60,cl:'APNs / FCM'}
  ],cs:[[0,1],[0,2]]},
  webhook_in:{lbl:'Вебхуки: приём',lbl_en:'Webhooks: Inbound',g:'Элементы',theme:'Коммуникации',bls:[
    {t:'service',dx:0,dy:0,cl:'Приём вебхуков',pat:['timeout']},{t:'postgresql',dx:185,dy:-20,cl:'Webhooks DB',db:'webhooks_postgres'},{t:'kafka',dx:185,dy:60,cl:'webhook-events'}
  ],cs:[[0,1],[0,2]]},
  webhook_out:{lbl:'Вебхуки: отправка (ретраи)',lbl_en:'Webhooks: Outbound (retries)',g:'Элементы',theme:'Коммуникации',bls:[
    {t:'service',dx:0,dy:0,cl:'Отправка вебхуков',pat:['retry']},{t:'queue',dx:185,dy:0,cl:'Retry Queue'},{t:'external',dx:370,dy:0,cl:'Получатель'}
  ],cs:[[0,1],[1,2]]},

  // ── Поиск и рекомендации ──
  autocomplete_el:{lbl:'Автодополнение',lbl_en:'Autocomplete',g:'Элементы',theme:'Поиск и рекомендации',bls:[
    {t:'service',dx:0,dy:0,cl:'Автодополнение'},{t:'redis',dx:185,dy:0,cl:'Autocomplete (Sorted Set)'}
  ],cs:[[0,1]]},
  faceted_search:{lbl:'Фасетный поиск',lbl_en:'Faceted Search',g:'Элементы',theme:'Поиск и рекомендации',bls:[
    {t:'service',dx:0,dy:0,cl:'Фасетный поиск'},{t:'elasticsearch',dx:185,dy:0,cl:'Facets Index'}
  ],cs:[[0,1]]},
  recsys_el:{lbl:'Рекомендательная система',lbl_en:'Recommendation System',g:'Элементы',theme:'Поиск и рекомендации',bls:[
    {t:'service',dx:0,dy:0,cl:'Рекомендации'},{t:'clickhouse',dx:185,dy:-20,cl:'Behavior DB',db:'analytics_clickhouse'},{t:'redis',dx:185,dy:60,cl:'Rec Cache'}
  ],cs:[[0,1],[0,2]]},

  // ── Аналитика ──
  event_tracking:{lbl:'Трекинг событий',lbl_en:'Event Tracking',g:'Элементы',theme:'Аналитика',bls:[
    {t:'service',dx:0,dy:0,cl:'Трекер событий'},{t:'kafka',dx:185,dy:0,cl:'client-events'},{t:'service',dx:370,dy:0,cl:'ETL',pat:['timeout']},{t:'clickhouse',dx:555,dy:0,cl:'Events DB',db:'analytics_clickhouse'}
  ],cs:[[0,1],[1,2],[2,3]]},
  ab_testing:{lbl:'A/B тестирование',lbl_en:'A/B Testing',g:'Элементы',theme:'Аналитика',bls:[
    {t:'service',dx:0,dy:0,cl:'A/B тесты'},{t:'postgresql',dx:185,dy:-20,cl:'Experiments DB',db:'experiments_postgres'},{t:'redis',dx:185,dy:60,cl:'Assignment Cache'}
  ],cs:[[0,1],[0,2]]},
  funnel:{lbl:'Воронка конверсии',lbl_en:'Conversion Funnel',g:'Элементы',theme:'Аналитика',bls:[
    {t:'service',dx:0,dy:0,cl:'Воронка'},{t:'clickhouse',dx:185,dy:0,cl:'Funnel DB',db:'analytics_clickhouse'}
  ],cs:[[0,1]]},

  // ── Медиа-обработка ──
  image_processing:{lbl:'Обработка изображений',lbl_en:'Image Processing',g:'Элементы',theme:'Медиа-обработка',bls:[
    {t:'kafka',dx:0,dy:0,cl:'image-uploaded'},{t:'service',dx:185,dy:0,cl:'Ресайзер (worker)',pat:['timeout']},{t:'s3',dx:370,dy:0,cl:'Thumbnails'}
  ],cs:[[0,1],[1,2]]},
  video_transcoder_el:{lbl:'Видео-транскодер',lbl_en:'Video Transcoder',g:'Элементы',theme:'Медиа-обработка',bls:[
    {t:'kafka',dx:0,dy:0,cl:'video-uploaded'},{t:'service',dx:185,dy:0,cl:'Транскодер',pat:['timeout']},{t:'s3',dx:370,dy:0,cl:'HLS/DASH Storage'}
  ],cs:[[0,1],[1,2]]},

  // ── Безопасность ──
  rate_limiter:{lbl:'Rate Limiter',lbl_en:'Rate Limiter',g:'Элементы',theme:'Безопасность',bls:[
    {t:'service',dx:0,dy:0,cl:'Rate Limiter'},{t:'redis',dx:185,dy:0,cl:'Rate Limit Store',db:'ratelimit_redis'}
  ],cs:[[0,1]]},
  api_keys_el:{lbl:'API-ключи',lbl_en:'API Keys',g:'Элементы',theme:'Безопасность',bls:[
    {t:'service',dx:0,dy:0,cl:'API-ключи'},{t:'postgresql',dx:185,dy:0,cl:'API Keys DB',db:'apikeys_postgres'}
  ],cs:[[0,1]]},
  otp_2fa:{lbl:'OTP / 2FA',lbl_en:'OTP / 2FA',g:'Элементы',theme:'Безопасность',bls:[
    {t:'service',dx:0,dy:0,cl:'OTP / 2FA'},{t:'redis',dx:185,dy:-20,cl:'OTP Codes',db:'otp_redis'},{t:'external',dx:185,dy:60,cl:'SMS / Email'}
  ],cs:[[0,1],[0,2]]},

  // ── Новые группы (максимально подробные, на основе реальных архитектур) ──
  bank:{lbl:'Банк (необанк)',lbl_en:'Bank (Neobank)',g:'Системы',bls:[
    {t:'actor',dx:-170,dy:70,cl:'Клиент'},
    {t:'mob_client',dx:0,dy:120},
    {t:'web_client',dx:0,dy:20},
    {t:'api_gw',dx:180,dy:70,set:{auth_mode:'OAuth2 Introspection'}},
    {t:'auth',dx:360,dy:-10,cl:'Auth (OAuth2)',pat:['timeout'],auth:{type:'oauth2_jwt'}},
    {t:'postgresql',dx:550,dy:-10,cl:'Auth DB',db:'auth_postgres'},
    {t:'service',dx:360,dy:100,cl:'Счета',pat:['cache_aside']},
    {t:'redis',dx:550,dy:80,cl:'Balance Cache'},
    {t:'postgresql',dx:550,dy:160,cl:'Ledger DB',db:'bank_ledger_postgres'},
    {t:'service',dx:360,dy:220,cl:'Переводы',pat:['circuit_breaker','retry']},
    {t:'external',dx:550,dy:220,cl:'SWIFT / Платёжный шлюз'},
    {t:'kafka',dx:360,dy:320,cl:'transfer-events'},
    {t:'service',dx:550,dy:300,cl:'Антифрод',pat:['timeout']},
    {t:'external',dx:730,dy:300,cl:'ML Fraud API'},
    {t:'service',dx:550,dy:380,cl:'Карты'},
    {t:'postgresql',dx:730,dy:380,cl:'Cards DB',db:'cards_postgres'},
    {t:'service',dx:360,dy:440,cl:'Уведомления'},
    {t:'external',dx:550,dy:440,cl:'SMS / Push'},
    {t:'kafka',dx:360,dy:540,cl:'audit-log'},
    {t:'service',dx:550,dy:540,cl:'Аудит-логгер'},
    {t:'cassandra',dx:730,dy:540,cl:'Audit Log',db:'logs_cassandra'},
    {t:'service',dx:360,dy:640,cl:'Отчётность',pat:['timeout']},
    {t:'clickhouse',dx:550,dy:640,cl:'Analytics DB',db:'analytics_clickhouse'},
    {t:'s3',dx:730,dy:640,cl:'Выписки (PDF)'}
  ],cs:[[0,1],[0,2],[1,3],[2,3],[3,4],[4,5],[3,6],[6,7],[6,8],[3,9],[9,8],[9,10],[9,11],[11,12],[12,13],[3,14],[14,15],[11,16],[16,17],[6,18],[9,18],[14,18],[18,19],[19,20],[11,21],[21,22],[21,23]],scenarios:[
    {name:'Перевод денег',path:[0,1,3,9,8],steps:[{name:'Открывает приложение и вводит перевод'},{verb:'POST',uri:'/api/v1/transfers',name:'Отправляет перевод',resp:'202{transferId}'},{verb:'POST',uri:'/transfers',name:'Маршрутизирует',resp:'202{transferId}'},{verb:'INSERT',uri:'ledger_entries',name:'Записывает двойную проводку (debit+credit)',resp:'ok'}]},
    {name:'Проверка баланса (кэш)',path:[0,1,3,6,7],steps:[{name:'Открывает счёт'},{verb:'GET',uri:'/api/v1/accounts/balance',name:'Запрашивает баланс',resp:'200{balance}'},{verb:'GET',uri:'/accounts/balance',name:'Маршрутизирует',resp:'200{balance}'},{verb:'GET',uri:'balance:{accountId}',name:'Проверяет кэш',resp:'hit:{balance}'}]},
    {name:'Антифрод-проверка перевода',path:[9,11,12,13],steps:[{verb:'PUBLISH',uri:'transfer-events',name:'Публикует событие перевода',resp:''},{verb:'CONSUME',uri:'transfer-events',name:'Забирает событие на проверку',resp:''},{verb:'POST',uri:'/predict',name:'Запрашивает скоринг риска',resp:'200{risk_score}'}]}
  ]},
  messenger:{lbl:'Мессенджер (Telegram-like)',lbl_en:'Messenger (Telegram-like)',g:'Системы',bls:[
    {t:'actor',dx:-170,dy:110,cl:'Пользователь'},
    {t:'mob_client',dx:0,dy:60},
    {t:'web_client',dx:0,dy:160},
    {t:'websocket_gw',dx:180,dy:60,cl:'Realtime Gateway',set:{maxConn:5000000}},
    {t:'api_gw',dx:180,dy:160,set:{auth_mode:'JWT (встроенный)'}},
    {t:'auth',dx:360,dy:160,cl:'Auth (Phone + OTP)',auth:{type:'jwt_only'}},
    {t:'postgresql',dx:540,dy:160,cl:'Auth DB',db:'auth_postgres'},
    {t:'service',dx:360,dy:60,cl:'Сообщения'},
    {t:'mongodb',dx:540,dy:40,cl:'Chat DB',db:'chat_mongodb'},
    {t:'redis',dx:540,dy:120,cl:'Presence / Online'},
    {t:'service',dx:360,dy:280,cl:'Профили / Контакты'},
    {t:'postgresql',dx:540,dy:280,cl:'Users DB',db:'profile_postgres'},
    {t:'service',dx:360,dy:380,cl:'Медиа / Файлы',pat:['timeout']},
    {t:'s3',dx:540,dy:360,cl:'Media Storage'},
    {t:'postgresql',dx:540,dy:420,cl:'Files Meta',db:'files_postgres'},
    {t:'kafka',dx:180,dy:480,cl:'message-events'},
    {t:'service',dx:360,dy:480,cl:'Push-уведомления'},
    {t:'external',dx:540,dy:480,cl:'APNs / FCM'},
    {t:'service',dx:360,dy:580,cl:'Поиск по сообщениям'},
    {t:'elasticsearch',dx:540,dy:580,cl:'Message Index'},
    {t:'kafka',dx:180,dy:680,cl:'logs'},
    {t:'service',dx:360,dy:680,cl:'Логгер'},
    {t:'cassandra',dx:540,dy:680,cl:'Logs',db:'logs_cassandra'}
  ],cs:[[0,1],[0,2],[1,3],[2,3],[1,4],[2,4],[4,5],[5,6],[3,7],[4,7],[7,8],[7,9],[4,10],[10,11],[4,12],[12,13],[12,14],[7,15],[15,16],[16,17],[15,18],[4,18],[18,19],[7,20],[10,20],[12,20],[20,21],[21,22]],scenarios:[
    {name:'Отправка сообщения',path:[0,1,3,7,8],steps:[{name:'Набирает и отправляет сообщение'},{verb:'SEND',uri:'ws:message.send',name:'Отправляет по WebSocket',resp:'ack'},{name:'Передаёт сообщение сервису'},{verb:'INSERT',uri:'messages',name:'Сохраняет сообщение',resp:'ok'}]},
    {name:'Офлайн-доставка (push)',path:[7,15,16,17],steps:[{verb:'PUBLISH',uri:'message-events',name:'Публикует событие нового сообщения',resp:''},{verb:'CONSUME',uri:'message-events',name:'Забирает событие для офлайн-получателя',resp:''},{verb:'POST',uri:'/send',name:'Отправляет push-уведомление',resp:'200{delivered}'}]},
    {name:'Поиск по переписке',path:[0,1,4,18,19],steps:[{name:'Открывает поиск по чату'},{verb:'GET',uri:'/api/v1/messages/search',name:'Ищет сообщения',resp:'200{results}'},{verb:'GET',uri:'/messages/search',name:'Маршрутизирует',resp:'200{results}'},{verb:'GET',uri:'/index/_search',name:'Ищет по индексу',resp:'[{_source}]'}]}
  ]},
  marketplace:{lbl:'Маркетплейс (Wildberries/Ozon-like)',lbl_en:'Marketplace (Wildberries/Ozon-like)',g:'Системы',bls:[
    {t:'actor',dx:-170,dy:30,cl:'Покупатель'},
    {t:'actor',dx:-170,dy:260,cl:'Продавец'},
    {t:'web_client',dx:0,dy:0},
    {t:'mob_client',dx:0,dy:100},
    {t:'cdn',dx:160,dy:50,cl:'CDN (картинки)'},
    {t:'api_gw',dx:320,dy:100,set:{auth_mode:'JWT (встроенный)'}},
    {t:'lb',dx:480,dy:100},
    {t:'auth',dx:480,dy:0,cl:'Auth',auth:{type:'jwt_only'}},
    {t:'postgresql',dx:660,dy:0,cl:'Auth DB',db:'auth_postgres'},
    {t:'service',dx:640,dy:90,cl:'Каталог',pat:['cache_aside']},
    {t:'redis',dx:820,dy:60,cl:'Catalog Cache'},
    {t:'mongodb',dx:820,dy:120,cl:'Catalog DB',db:'catalog_mongodb'},
    {t:'elasticsearch',dx:820,dy:180,cl:'Поиск / Фильтры'},
    {t:'service',dx:640,dy:260,cl:'Продавцы (ЛК)'},
    {t:'postgresql',dx:820,dy:260,cl:'Sellers DB',db:'sellers_postgres'},
    {t:'service',dx:640,dy:340,cl:'Корзина'},
    {t:'redis',dx:820,dy:340,cl:'Cart Cache',db:'cart_redis'},
    {t:'service',dx:640,dy:420,cl:'Заказы',pat:['circuit_breaker']},
    {t:'postgresql',dx:820,dy:420,cl:'Orders DB',db:'ecommerce_orders'},
    {t:'kafka',dx:640,dy:520,cl:'order-events'},
    {t:'service',dx:820,dy:480,cl:'Склад'},
    {t:'postgresql',dx:1000,dy:480,cl:'Inventory DB',db:'warehouse_postgres'},
    {t:'service',dx:820,dy:560,cl:'Оплата',pat:['retry','timeout']},
    {t:'postgresql',dx:1000,dy:560,cl:'Payment DB',db:'payment_postgres'},
    {t:'external',dx:1180,dy:560,cl:'Платёжный шлюз'},
    {t:'service',dx:820,dy:640,cl:'Доставка / Логистика'},
    {t:'external',dx:1000,dy:640,cl:'Служба доставки'},
    {t:'service',dx:640,dy:720,cl:'Промокоды'},
    {t:'postgresql',dx:820,dy:720,cl:'Promo DB',db:'promo_postgres'},
    {t:'service',dx:640,dy:800,cl:'Отзывы'},
    {t:'postgresql',dx:820,dy:800,cl:'Reviews DB',db:'reviews_postgres'},
    {t:'service',dx:640,dy:880,cl:'Уведомления'},
    {t:'external',dx:820,dy:880,cl:'SMS / Push / Email'},
    {t:'kafka',dx:320,dy:960,cl:'analytics-events'},
    {t:'service',dx:480,dy:960,cl:'Рекомендации'},
    {t:'clickhouse',dx:640,dy:960,cl:'User Behavior DB',db:'analytics_clickhouse'}
  ],cs:[[0,2],[0,3],[1,2],[2,4],[3,4],[2,5],[3,5],[5,6],[5,7],[7,8],[6,9],[9,10],[9,11],[9,12],[6,13],[13,14],[6,15],[15,16],[6,17],[17,18],[17,19],[19,20],[20,21],[19,22],[22,23],[22,24],[19,25],[25,26],[6,27],[27,28],[6,29],[29,30],[19,31],[31,32],[9,33],[17,33],[22,33],[33,34],[34,35]],scenarios:[
    {name:'Оформление заказа',path:[0,3,5,6,17,18],steps:[{name:'Оформляет заказ из корзины'},{verb:'POST',uri:'/api/v1/orders',name:'Отправляет заказ',resp:'201{orderId}'},{verb:'POST',uri:'/orders',name:'Балансирует нагрузку',resp:'201{orderId}'},{verb:'POST',uri:'/orders',name:'Маршрутизирует на сервис Заказов',resp:'201{orderId}'},{verb:'INSERT',uri:'orders',name:'Создаёт заказ',resp:'ok'}]},
    {name:'Сага: резервирование и оплата',path:[17,19,22,24],steps:[{verb:'PUBLISH',uri:'order.created',name:'Публикует событие заказа',resp:''},{verb:'CONSUME',uri:'order.created',name:'Забирает событие для оплаты',resp:''},{verb:'POST',uri:'/charge',name:'Списывает оплату',resp:'200{transactionId}'}]},
    {name:'Просмотр каталога (кэш)',path:[0,3,5,6,9,10],steps:[{name:'Открывает карточку товара'},{verb:'GET',uri:'/api/v1/products/{id}',name:'Запрашивает товар',resp:'200{product}'},{verb:'GET',uri:'/products/{id}',name:'Балансирует нагрузку',resp:'200{product}'},{verb:'GET',uri:'/products/{id}',name:'Маршрутизирует',resp:'200{product}'},{verb:'GET',uri:'product:{id}',name:'Проверяет кэш',resp:'hit:{product}'}]}
  ]},
  youtube:{lbl:'Видеохостинг (YouTube-like)',lbl_en:'Video Platform (YouTube-like)',g:'Системы',bls:[
    {t:'actor',dx:-170,dy:60,cl:'Зритель'},
    {t:'actor',dx:-170,dy:280,cl:'Автор'},
    {t:'web_client',dx:0,dy:0},
    {t:'mob_client',dx:0,dy:110},
    {t:'cdn',dx:160,dy:55,cl:'CDN (видео edge)'},
    {t:'api_gw',dx:340,dy:110,set:{auth_mode:'JWT (встроенный)'}},
    {t:'auth',dx:520,dy:20,cl:'Auth (OAuth2)',auth:{type:'oauth2_jwt'}},
    {t:'postgresql',dx:700,dy:20,cl:'Auth DB',db:'auth_postgres'},
    {t:'service',dx:520,dy:110,cl:'Загрузка видео',pat:['timeout']},
    {t:'s3',dx:700,dy:90,cl:'Raw Video Storage'},
    {t:'postgresql',dx:700,dy:150,cl:'Video Meta DB',db:'video_postgres'},
    {t:'kafka',dx:520,dy:210,cl:'video-uploaded'},
    {t:'service',dx:700,dy:210,cl:'Транскодер'},
    {t:'s3',dx:880,dy:210,cl:'Transcoded (HLS/DASH)'},
    {t:'service',dx:340,dy:280,cl:'Каналы / Пользователи'},
    {t:'postgresql',dx:520,dy:280,cl:'Channels DB',db:'profile_postgres'},
    {t:'service',dx:340,dy:360,cl:'Комментарии'},
    {t:'mongodb',dx:520,dy:360,cl:'Comments DB',db:'comments_mongodb'},
    {t:'service',dx:340,dy:440,cl:'Поиск',pat:['cache_aside']},
    {t:'elasticsearch',dx:520,dy:420,cl:'Video Search Index'},
    {t:'redis',dx:520,dy:480,cl:'Trending Cache'},
    {t:'kafka',dx:160,dy:540,cl:'view-events'},
    {t:'service',dx:340,dy:540,cl:'Счётчик просмотров'},
    {t:'clickhouse',dx:520,dy:540,cl:'Watch Analytics DB',db:'analytics_clickhouse'},
    {t:'service',dx:340,dy:620,cl:'Рекомендации'},
    {t:'service',dx:160,dy:620,cl:'Подписки / Уведомления'},
    {t:'external',dx:340,dy:700,cl:'Push / Email'}
  ],cs:[[0,2],[0,3],[1,2],[2,4],[3,4],[2,5],[3,5],[5,6],[6,7],[5,8],[8,9],[8,10],[8,11],[11,12],[12,13],[13,4],[5,14],[14,15],[5,16],[16,17],[5,18],[18,19],[18,20],[5,21],[21,22],[22,23],[23,24],[21,24],[11,25],[25,26]],scenarios:[
    {name:'Загрузка видео',path:[1,2,5,8,10],steps:[{name:'Загружает видеофайл'},{verb:'POST',uri:'/api/v1/videos',name:'Отправляет файл',resp:'201{videoId}'},{verb:'POST',uri:'/videos',name:'Маршрутизирует',resp:'201{videoId}'},{verb:'INSERT',uri:'videos',name:'Сохраняет метаданные (status=processing)',resp:'ok'}]},
    {name:'Транскодирование',path:[8,11,12,13],steps:[{verb:'PUBLISH',uri:'video-uploaded',name:'Публикует событие загрузки',resp:''},{verb:'CONSUME',uri:'video-uploaded',name:'Забирает видео на обработку',resp:''},{verb:'PUT',uri:'/{videoId}/master.m3u8',name:'Сохраняет HLS/DASH-рендеры',resp:'200'}]},
    {name:'Поиск видео',path:[0,3,5,18,19],steps:[{name:'Ищет видео по запросу'},{verb:'GET',uri:'/api/v1/search?q=',name:'Отправляет поисковый запрос',resp:'200{results}'},{verb:'GET',uri:'/search',name:'Маршрутизирует',resp:'200{results}'},{verb:'GET',uri:'/index/_search',name:'Ищет по индексу',resp:'[{_source}]'}]},
    {name:'Учёт просмотра',path:[0,3,5,21,22,23],steps:[{name:'Смотрит видео'},{verb:'POST',uri:'/api/v1/videos/{id}/view',name:'Отправляет событие просмотра',resp:'202'},{verb:'PUBLISH',uri:'view-events',name:'Публикует событие',resp:''},{verb:'CONSUME',uri:'view-events',name:'Забирает событие на подсчёт',resp:''},{verb:'INSERT',uri:'events',name:'Записывает просмотр',resp:'ok'}]}
  ]},
  search_engine:{lbl:'Поисковая система',lbl_en:'Search Engine',g:'Системы',bls:[
    {t:'actor',dx:-170,dy:460,cl:'Пользователь'},
    {t:'external',dx:0,dy:100,cl:'Интернет (сайты)'},
    {t:'service',dx:180,dy:100,cl:'Краулер',pat:['timeout']},
    {t:'postgresql',dx:360,dy:60,cl:'Crawl Queue / State',db:'crawler_postgres'},
    {t:'s3',dx:360,dy:160,cl:'Raw HTML Storage'},
    {t:'kafka',dx:180,dy:220,cl:'pages-crawled'},
    {t:'service',dx:360,dy:220,cl:'Индексатор'},
    {t:'elasticsearch',dx:540,dy:220,cl:'Inverted Index'},
    {t:'service',dx:360,dy:320,cl:'Ранжирование',pat:['cache_aside']},
    {t:'redis',dx:540,dy:320,cl:'Rank Cache'},
    {t:'clickhouse',dx:540,dy:380,cl:'Click Log / Ranking Signals',db:'analytics_clickhouse'},
    {t:'web_client',dx:0,dy:420},
    {t:'mob_client',dx:0,dy:500},
    {t:'api_gw',dx:180,dy:460},
    {t:'service',dx:360,dy:460,cl:'Поисковое API',pat:['cache_aside']},
    {t:'redis',dx:540,dy:460,cl:'Query Cache'},
    {t:'service',dx:360,dy:540,cl:'Автодополнение'},
    {t:'redis',dx:540,dy:540,cl:'Autocomplete (Sorted Set)'},
    {t:'kafka',dx:180,dy:620,cl:'search-clicks'},
    {t:'service',dx:360,dy:620,cl:'Клик-трекер'}
  ],cs:[[0,11],[0,12],[1,2],[2,3],[2,4],[2,5],[5,6],[6,7],[7,8],[8,9],[8,10],[11,13],[12,13],[13,14],[14,7],[14,8],[14,15],[13,16],[16,17],[13,18],[18,19],[19,10]],scenarios:[
    {name:'Индексация страниц',path:[1,2,5,6,7],steps:[{verb:'GET',uri:'/page.html',name:'Скачивает страницу',resp:'200{html}'},{verb:'PUBLISH',uri:'pages-crawled',name:'Публикует событие',resp:''},{verb:'CONSUME',uri:'pages-crawled',name:'Забирает страницу на индексацию',resp:''},{verb:'POST',uri:'/index/_doc',name:'Индексирует документ',resp:'{_id}'}]},
    {name:'Поиск (кэш HIT)',path:[0,11,13,14,15],steps:[{name:'Вводит поисковый запрос'},{verb:'GET',uri:'/api/v1/search?q=',name:'Отправляет запрос',resp:'200{results}'},{verb:'GET',uri:'/search',name:'Маршрутизирует',resp:'200{results}'},{verb:'GET',uri:'query:{hash}',name:'Проверяет кэш запроса',resp:'hit:{results}'}]},
    {name:'Поиск и ранжирование',path:[0,11,13,14,7,8],steps:[{name:'Вводит поисковый запрос'},{verb:'GET',uri:'/api/v1/search?q=',name:'Отправляет запрос',resp:'200{results}'},{verb:'GET',uri:'/search',name:'Маршрутизирует',resp:'200{results}'},{verb:'GET',uri:'/index/_search',name:'Ищет по инвертированному индексу',resp:'[{_id,score}]'},{name:'Передаёт результаты на ранжирование',resp:'[{ranked}]'}]},
    {name:'Автодополнение',path:[0,11,13,16,17],steps:[{name:'Начинает вводить запрос'},{verb:'GET',uri:'/api/v1/autocomplete?prefix=',name:'Запрашивает подсказки',resp:'200{suggestions}'},{verb:'GET',uri:'/autocomplete',name:'Маршрутизирует',resp:'200{suggestions}'},{verb:'ZRANGEBYSCORE',uri:'autocomplete:{prefix}',name:'Читает подсказки',resp:'[{suggestions}]'}]}
  ]},
  todo:{lbl:'Ту-ду лист (Todoist-like)',lbl_en:'Todo List (Todoist-like)',g:'Системы',bls:[
    {t:'actor',dx:-170,dy:50,cl:'Пользователь'},
    {t:'web_client',dx:0,dy:0},
    {t:'mob_client',dx:0,dy:100},
    {t:'api_gw',dx:180,dy:50,set:{auth_mode:'JWT (встроенный)'}},
    {t:'auth',dx:360,dy:-20,cl:'Auth (JWT)',auth:{type:'jwt_only'}},
    {t:'postgresql',dx:540,dy:-20,cl:'Auth DB',db:'auth_postgres'},
    {t:'websocket_gw',dx:180,dy:150,cl:'Realtime Sync'},
    {t:'service',dx:360,dy:100,cl:'Задачи / Списки',pat:['cache_aside']},
    {t:'redis',dx:540,dy:80,cl:'Tasks Cache'},
    {t:'postgresql',dx:540,dy:160,cl:'Tasks DB',db:'todo_postgres'},
    {t:'service',dx:360,dy:240,cl:'Совместный доступ'},
    {t:'kafka',dx:540,dy:260,cl:'task-events'},
    {t:'service',dx:720,dy:260,cl:'Уведомления / Напоминания'},
    {t:'external',dx:900,dy:260,cl:'Push / Email'},
    {t:'service',dx:360,dy:360,cl:'История изменений'},
    {t:'postgresql',dx:540,dy:360,cl:'Audit / History DB',db:'audit_postgres'}
  ],cs:[[0,1],[0,2],[1,3],[2,3],[1,6],[2,6],[3,4],[4,5],[3,7],[6,7],[7,8],[7,9],[3,10],[10,9],[7,11],[11,12],[12,13],[11,14],[14,15]],scenarios:[
    {name:'Создание задачи',path:[0,2,3,7,9],steps:[{name:'Добавляет задачу'},{verb:'POST',uri:'/api/v1/tasks',name:'Создаёт задачу',resp:'201{taskId}'},{verb:'POST',uri:'/tasks',name:'Маршрутизирует',resp:'201{taskId}'},{verb:'INSERT',uri:'tasks',name:'Сохраняет задачу',resp:'ok'}]},
    {name:'Напоминание о задаче',path:[7,11,12,13],steps:[{verb:'PUBLISH',uri:'task.due_soon',name:'Публикует событие о сроке',resp:''},{verb:'CONSUME',uri:'task.due_soon',name:'Забирает событие для напоминания',resp:''},{verb:'POST',uri:'/notify',name:'Отправляет push-напоминание',resp:'200'}]},
    {name:'Совместный доступ к списку',path:[0,1,3,10,9],steps:[{name:'Делится списком с другим пользователем'},{verb:'POST',uri:'/api/v1/lists/{id}/share',name:'Отправляет приглашение',resp:'200{memberId}'},{verb:'POST',uri:'/lists/{id}/share',name:'Маршрутизирует',resp:'200{memberId}'},{verb:'INSERT',uri:'list_members',name:'Добавляет участника списка',resp:'ok'}]},
    {name:'Синхронизация между устройствами',path:[0,2,6,7],steps:[{name:'Отмечает задачу выполненной на одном устройстве'},{verb:'SEND',uri:'ws:task.update',name:'Отправляет изменение по WebSocket',resp:'ack'},{name:'Синхронизирует изменение на все устройства',resp:''}]}
  ]},
  taxi:{lbl:'Такси-агрегатор (Uber-like)',lbl_en:'Ride-Hailing (Uber-like)',g:'Системы',bls:[
    {t:'actor',dx:-170,dy:0,cl:'Пассажир'},
    {t:'actor',dx:-170,dy:120,cl:'Водитель'},
    {t:'mob_client',dx:0,dy:0,cl:'Rider App'},
    {t:'mob_client',dx:0,dy:120,cl:'Driver App'},
    {t:'websocket_gw',dx:180,dy:60,cl:'Realtime GW (геолокация)'},
    {t:'api_gw',dx:180,dy:160},
    {t:'auth',dx:360,dy:160,cl:'Auth',auth:{type:'jwt_only'}},
    {t:'postgresql',dx:540,dy:160,cl:'Auth DB',db:'auth_postgres'},
    {t:'service',dx:360,dy:0,cl:'Геолокация / Трекинг'},
    {t:'redis',dx:540,dy:-20,cl:'Live Locations (Geo)'},
    {t:'postgresql',dx:540,dy:40,cl:'Geo History',db:'geodata_postgres'},
    {t:'service',dx:360,dy:260,cl:'Матчинг (поиск водителя)',pat:['circuit_breaker','timeout']},
    {t:'service',dx:540,dy:260,cl:'Ценообразование (surge)'},
    {t:'redis',dx:720,dy:260,cl:'Surge Cache'},
    {t:'service',dx:360,dy:360,cl:'Поездки'},
    {t:'postgresql',dx:540,dy:360,cl:'Trips DB',db:'trips_postgres'},
    {t:'kafka',dx:360,dy:460,cl:'trip-events'},
    {t:'service',dx:540,dy:440,cl:'Оплата',pat:['retry']},
    {t:'postgresql',dx:720,dy:440,cl:'Payment DB',db:'payment_postgres'},
    {t:'external',dx:900,dy:440,cl:'Платёжный шлюз'},
    {t:'service',dx:540,dy:520,cl:'Рейтинги / Отзывы'},
    {t:'postgresql',dx:720,dy:520,cl:'Reviews DB',db:'reviews_postgres'},
    {t:'service',dx:540,dy:600,cl:'Уведомления'},
    {t:'external',dx:720,dy:600,cl:'Push / SMS'},
    {t:'kafka',dx:180,dy:680,cl:'analytics-events'},
    {t:'service',dx:270,dy:760,cl:'ETL аналитики'},
    {t:'clickhouse',dx:450,dy:760,cl:'Аналитика поездок',db:'analytics_clickhouse'}
  ],cs:[[0,2],[1,3],[2,4],[3,4],[2,5],[3,5],[5,6],[6,7],[4,8],[8,9],[8,10],[5,11],[8,11],[11,12],[12,13],[11,14],[14,15],[14,16],[16,17],[17,18],[17,19],[5,20],[16,20],[20,21],[16,22],[22,23],[14,24],[17,24],[24,25],[25,26]],scenarios:[
    {name:'Заказ поездки',path:[0,2,5,11,14,15],steps:[{name:'Заказывает поездку'},{verb:'POST',uri:'/api/v1/trips',name:'Отправляет запрос на поездку',resp:'202{requestId}'},{verb:'POST',uri:'/trips',name:'Запускает матчинг',resp:'202{requestId}'},{name:'Находит водителя и создаёт поездку',resp:'201{tripId}'},{verb:'INSERT',uri:'trips',name:'Сохраняет поездку',resp:'ok'}]},
    {name:'Оплата поездки',path:[14,16,17,19],steps:[{verb:'PUBLISH',uri:'trip.completed',name:'Публикует событие завершения поездки',resp:''},{verb:'CONSUME',uri:'trip.completed',name:'Забирает событие на оплату',resp:''},{verb:'POST',uri:'/charge',name:'Списывает оплату за поездку',resp:'200{transactionId}'}]},
    {name:'Трекинг геолокации водителя',path:[1,3,4,8,9],steps:[{name:'Едет к пассажиру'},{verb:'SEND',uri:'ws:location.update',name:'Отправляет координаты',resp:'ack'},{name:'Передаёт координаты сервису трекинга',resp:''},{verb:'SET',uri:'geo:{driverId}',name:'Обновляет текущее местоположение',resp:'OK'}]},
    {name:'Оценка поездки',path:[0,2,5,20,21],steps:[{name:'Оценивает поездку'},{verb:'POST',uri:'/api/v1/trips/{id}/rating',name:'Отправляет оценку',resp:'201{ratingId}'},{verb:'POST',uri:'/trips/{id}/rating',name:'Маршрутизирует',resp:'201{ratingId}'},{verb:'INSERT',uri:'reviews',name:'Сохраняет оценку',resp:'ok'}]}
  ]},
  social_feed:{lbl:'Соцсеть / лента (Instagram-like)',lbl_en:'Social Feed (Instagram-like)',g:'Системы',bls:[
    {t:'actor',dx:-170,dy:50,cl:'Пользователь'},
    {t:'web_client',dx:0,dy:0},
    {t:'mob_client',dx:0,dy:100},
    {t:'cdn',dx:160,dy:50,cl:'CDN (фото / видео)'},
    {t:'api_gw',dx:340,dy:100,set:{auth_mode:'JWT (встроенный)'}},
    {t:'auth',dx:520,dy:20,cl:'Auth (OAuth2)',auth:{type:'oauth2_jwt'}},
    {t:'postgresql',dx:700,dy:20,cl:'Auth DB',db:'auth_postgres'},
    {t:'service',dx:520,dy:110,cl:'Профиль / Подписки (Follow Graph)'},
    {t:'postgresql',dx:700,dy:110,cl:'Social Graph DB',db:'social_graph_postgres'},
    {t:'service',dx:340,dy:200,cl:'Публикации',pat:['timeout']},
    {t:'s3',dx:520,dy:180,cl:'Media Storage'},
    {t:'mongodb',dx:520,dy:240,cl:'Posts DB',db:'posts_mongodb'},
    {t:'kafka',dx:340,dy:320,cl:'post-created'},
    {t:'service',dx:520,dy:320,cl:'Генератор ленты (Fan-out)',pat:['bulkhead']},
    {t:'redis',dx:700,dy:300,cl:'Feed Cache (per user)'},
    {t:'cassandra',dx:700,dy:360,cl:'Feed Store',db:'feed_cassandra'},
    {t:'service',dx:340,dy:420,cl:'Лайки / Комментарии'},
    {t:'mongodb',dx:520,dy:420,cl:'Comments DB',db:'comments_mongodb'},
    {t:'service',dx:340,dy:500,cl:'Поиск / Хэштеги'},
    {t:'elasticsearch',dx:520,dy:500,cl:'Search Index'},
    {t:'service',dx:340,dy:580,cl:'Уведомления'},
    {t:'external',dx:520,dy:580,cl:'Push / Email'},
    {t:'kafka',dx:160,dy:660,cl:'analytics-events'},
    {t:'service',dx:250,dy:740,cl:'ETL аналитики'},
    {t:'clickhouse',dx:430,dy:740,cl:'Engagement Analytics',db:'analytics_clickhouse'}
  ],cs:[[0,1],[0,2],[1,3],[2,3],[1,4],[2,4],[4,5],[5,6],[4,7],[7,8],[4,9],[9,10],[9,11],[9,12],[12,13],[7,13],[13,14],[13,15],[4,16],[16,17],[4,18],[18,19],[12,20],[16,20],[20,21],[9,22],[16,22],[22,23],[23,24]],scenarios:[
    {name:'Публикация поста',path:[0,2,4,9,11],steps:[{name:'Публикует пост с фото'},{verb:'POST',uri:'/api/v1/posts',name:'Отправляет пост',resp:'201{postId}'},{verb:'POST',uri:'/posts',name:'Маршрутизирует',resp:'201{postId}'},{verb:'INSERT',uri:'posts',name:'Сохраняет публикацию',resp:'ok'}]},
    {name:'Формирование ленты (fan-out)',path:[9,12,13,15],steps:[{verb:'PUBLISH',uri:'post.created',name:'Публикует событие о новом посте',resp:''},{verb:'CONSUME',uri:'post.created',name:'Забирает событие для рассылки подписчикам',resp:''},{verb:'INSERT',uri:'user_feed',name:'Раскладывает пост в ленты подписчиков',resp:'ok'}]},
    {name:'Комментирование поста',path:[0,2,4,16,17],steps:[{name:'Оставляет комментарий'},{verb:'POST',uri:'/api/v1/posts/{id}/comments',name:'Отправляет комментарий',resp:'201{commentId}'},{verb:'POST',uri:'/posts/{id}/comments',name:'Маршрутизирует',resp:'201{commentId}'},{verb:'INSERT',uri:'comments',name:'Сохраняет комментарий',resp:'ok'}]},
    {name:'Поиск по хэштегам',path:[0,1,4,18,19],steps:[{name:'Ищет посты по хэштегу'},{verb:'GET',uri:'/api/v1/search?tag=',name:'Отправляет поисковый запрос',resp:'200{results}'},{verb:'GET',uri:'/search',name:'Маршрутизирует',resp:'200{results}'},{verb:'GET',uri:'/index/_search',name:'Ищет по индексу',resp:'[{_source}]'}]}
  ]},
  food_delivery:{lbl:'Доставка еды (Wolt/Delivery Club-like)',lbl_en:'Food Delivery (Wolt-like)',g:'Системы',bls:[
    {t:'actor',dx:-170,dy:0,cl:'Клиент'},
    {t:'actor',dx:-170,dy:220,cl:'Курьер'},
    {t:'mob_client',dx:0,dy:0,cl:'Client App'},
    {t:'mob_client',dx:0,dy:220,cl:'Courier App'},
    {t:'api_gw',dx:180,dy:110,set:{auth_mode:'JWT (встроенный)'}},
    {t:'auth',dx:360,dy:20,cl:'Auth',auth:{type:'jwt_only'}},
    {t:'postgresql',dx:540,dy:20,cl:'Auth DB',db:'auth_postgres'},
    {t:'service',dx:360,dy:110,cl:'Рестораны / Меню',pat:['cache_aside']},
    {t:'redis',dx:540,dy:90,cl:'Menu Cache'},
    {t:'postgresql',dx:540,dy:150,cl:'Restaurants DB',db:'restaurants_postgres'},
    {t:'service',dx:360,dy:240,cl:'Заказы',pat:['circuit_breaker']},
    {t:'postgresql',dx:540,dy:240,cl:'Orders DB',db:'food_orders_postgres'},
    {t:'kafka',dx:360,dy:340,cl:'order-events'},
    {t:'service',dx:540,dy:320,cl:'Диспетчер курьеров',pat:['timeout']},
    {t:'redis',dx:720,dy:300,cl:'Live Courier Locations'},
    {t:'websocket_gw',dx:180,dy:400,cl:'Realtime GW (трекинг)'},
    {t:'service',dx:360,dy:440,cl:'Оплата',pat:['retry','timeout']},
    {t:'postgresql',dx:540,dy:440,cl:'Payment DB',db:'payment_postgres'},
    {t:'external',dx:720,dy:440,cl:'Платёжный шлюз'},
    {t:'service',dx:360,dy:520,cl:'Уведомления'},
    {t:'external',dx:540,dy:520,cl:'Push / SMS'},
    {t:'kafka',dx:180,dy:600,cl:'analytics-events'},
    {t:'service',dx:270,dy:680,cl:'ETL аналитики'},
    {t:'clickhouse',dx:450,dy:680,cl:'Delivery Analytics',db:'analytics_clickhouse'}
  ],cs:[[0,2],[1,3],[2,4],[3,4],[2,15],[3,15],[4,5],[5,6],[4,7],[7,8],[7,9],[4,10],[10,11],[10,12],[12,13],[13,14],[15,13],[12,16],[16,17],[16,18],[12,19],[19,20],[10,21],[16,21],[21,22],[22,23]],scenarios:[
    {name:'Оформление заказа',path:[0,2,4,10,11],steps:[{name:'Собирает заказ из меню ресторана'},{verb:'POST',uri:'/api/v1/orders',name:'Отправляет заказ',resp:'201{orderId}'},{verb:'POST',uri:'/orders',name:'Маршрутизирует',resp:'201{orderId}'},{verb:'INSERT',uri:'orders',name:'Создаёт заказ (status=placed)',resp:'ok'}]},
    {name:'Назначение курьера',path:[10,12,13,14],steps:[{verb:'PUBLISH',uri:'order.created',name:'Публикует событие заказа',resp:''},{verb:'CONSUME',uri:'order.created',name:'Забирает заказ на диспетчеризацию',resp:''},{verb:'GEORADIUS',uri:'couriers:online',name:'Ищет ближайшего свободного курьера',resp:'[{courierId}]'}]},
    {name:'Оплата заказа',path:[12,16,18],steps:[{verb:'CONSUME',uri:'order.created',name:'Забирает заказ на оплату',resp:''},{verb:'POST',uri:'/charge',name:'Списывает оплату',resp:'200{transactionId}'}]},
    {name:'Трекинг доставки',path:[1,3,15,13],steps:[{name:'Везёт заказ клиенту'},{verb:'SEND',uri:'ws:location.update',name:'Отправляет координаты',resp:'ack'},{name:'Обновляет позицию курьера для клиента',resp:''}]}
  ]},
  carsharing:{lbl:'Каршеринг (Delimobil-like)',lbl_en:'Car Sharing (Delimobil-like)',g:'Системы',bls:[
    {t:'actor',dx:-170,dy:60,cl:'Пользователь'},
    {t:'mob_client',dx:0,dy:60},
    {t:'api_gw',dx:180,dy:60,set:{auth_mode:'JWT (встроенный)'}},
    {t:'auth',dx:360,dy:-30,cl:'Auth',auth:{type:'jwt_only'}},
    {t:'postgresql',dx:540,dy:-30,cl:'Auth DB',db:'auth_postgres'},
    {t:'service',dx:360,dy:60,cl:'Карта авто',pat:['cache_aside']},
    {t:'redis',dx:540,dy:40,cl:'Live Car Locations'},
    {t:'postgresql',dx:540,dy:100,cl:'Cars DB',db:'carsharing_postgres'},
    {t:'kafka',dx:360,dy:160,cl:'car-telemetry'},
    {t:'service',dx:540,dy:160,cl:'Телеметрия авто',pat:['timeout']},
    {t:'service',dx:360,dy:260,cl:'Аренда',pat:['circuit_breaker']},
    {t:'postgresql',dx:540,dy:260,cl:'Rentals DB',db:'carsharing_postgres'},
    {t:'external',dx:720,dy:260,cl:'Блокиратор авто (IoT)'},
    {t:'service',dx:360,dy:360,cl:'Биллинг (по минутам)',pat:['retry']},
    {t:'postgresql',dx:540,dy:360,cl:'Payment DB',db:'payment_postgres'},
    {t:'external',dx:720,dy:360,cl:'Платёжный шлюз'},
    {t:'service',dx:360,dy:440,cl:'Уведомления'},
    {t:'external',dx:540,dy:440,cl:'Push / SMS'},
    {t:'kafka',dx:180,dy:520,cl:'analytics-events'},
    {t:'service',dx:270,dy:600,cl:'ETL аналитики'},
    {t:'clickhouse',dx:450,dy:600,cl:'Fleet Analytics',db:'analytics_clickhouse'}
  ],cs:[[0,1],[1,2],[2,3],[3,4],[2,5],[5,6],[5,7],[8,9],[9,6],[9,7],[2,10],[10,11],[10,12],[10,13],[13,14],[13,15],[10,16],[16,17],[10,18],[13,18],[18,19],[19,20]],scenarios:[
    {name:'Поиск свободного авто',path:[0,1,2,5,6],steps:[{name:'Открывает карту с машинами'},{verb:'GET',uri:'/api/v1/cars/nearby',name:'Запрашивает авто рядом',resp:'200{cars}'},{verb:'GET',uri:'/cars/nearby',name:'Маршрутизирует',resp:'200{cars}'},{verb:'GEORADIUS',uri:'cars:online',name:'Ищет машины поблизости',resp:'[{carId,lat,lng}]'}]},
    {name:'Аренда и разблокировка',path:[0,1,2,10,12],steps:[{name:'Начинает аренду'},{verb:'POST',uri:'/api/v1/rentals',name:'Открывает машину',resp:'201{rentalId}'},{verb:'POST',uri:'/rentals',name:'Маршрутизирует',resp:'201{rentalId}'},{verb:'POST',uri:'/unlock',name:'Отправляет команду разблокировки',resp:'200{unlocked:true}'}]},
    {name:'Телеметрия автомобиля',path:[8,9,7],steps:[{verb:'CONSUME',uri:'car.telemetry',name:'Забирает данные с борткомпьютера',resp:''},{verb:'UPDATE',uri:'cars',name:'Обновляет уровень топлива и координаты',resp:'ok'}]},
    {name:'Завершение аренды и оплата',path:[0,1,2,10,13,15],steps:[{name:'Завершает поездку'},{verb:'POST',uri:'/api/v1/rentals/{id}/finish',name:'Завершает аренду',resp:'200{cost}'},{verb:'POST',uri:'/rentals/{id}/finish',name:'Маршрутизирует',resp:'200{cost}'},{name:'Передаёт аренду на биллинг',resp:''},{verb:'POST',uri:'/charge',name:'Списывает оплату за минуты аренды',resp:'200{transactionId}'}]}
  ]},
  music_streaming:{lbl:'Музыкальный стриминг (Spotify-like)',lbl_en:'Music Streaming (Spotify-like)',g:'Системы',bls:[
    {t:'actor',dx:-170,dy:50,cl:'Слушатель'},
    {t:'web_client',dx:0,dy:0},
    {t:'mob_client',dx:0,dy:100},
    {t:'cdn',dx:160,dy:50,cl:'CDN (аудио-чанки)'},
    {t:'api_gw',dx:320,dy:100,set:{auth_mode:'JWT (встроенный)'}},
    {t:'auth',dx:500,dy:10,cl:'Auth (OAuth2)',auth:{type:'oauth2_jwt'}},
    {t:'postgresql',dx:680,dy:10,cl:'Auth DB',db:'auth_postgres'},
    {t:'service',dx:500,dy:100,cl:'Каталог треков',pat:['cache_aside']},
    {t:'redis',dx:680,dy:80,cl:'Catalog Cache'},
    {t:'postgresql',dx:680,dy:140,cl:'Music Catalog DB',db:'music_catalog_postgres'},
    {t:'service',dx:500,dy:200,cl:'Плейлисты'},
    {t:'mongodb',dx:680,dy:200,cl:'Playlists DB',db:'playlists_mongodb'},
    {t:'service',dx:320,dy:280,cl:'Стриминг аудио',pat:['timeout']},
    {t:'s3',dx:500,dy:280,cl:'Audio Storage'},
    {t:'service',dx:320,dy:360,cl:'Поиск'},
    {t:'elasticsearch',dx:500,dy:360,cl:'Search Index'},
    {t:'kafka',dx:160,dy:440,cl:'play-events'},
    {t:'service',dx:320,dy:440,cl:'Счётчик прослушиваний'},
    {t:'clickhouse',dx:500,dy:440,cl:'Listening Analytics',db:'analytics_clickhouse'},
    {t:'service',dx:320,dy:520,cl:'Рекомендации'}
  ],cs:[[0,1],[0,2],[1,3],[2,3],[1,4],[2,4],[4,5],[5,6],[4,7],[7,8],[7,9],[4,10],[10,11],[4,12],[12,13],[13,3],[4,14],[14,15],[4,16],[16,17],[17,18],[18,19],[16,19]],scenarios:[
    {name:'Прослушивание трека',path:[0,2,4,12,13],steps:[{name:'Запускает трек'},{verb:'GET',uri:'/api/v1/tracks/{id}/stream',name:'Запрашивает поток',resp:'200{streamUrl}'},{verb:'GET',uri:'/tracks/{id}/stream',name:'Маршрутизирует',resp:'200{streamUrl}'},{verb:'GET',uri:'/{trackId}.m4a',name:'Отдаёт аудио-чанки',resp:'200'}]},
    {name:'Учёт прослушивания',path:[0,2,4,16,17,18],steps:[{name:'Дослушивает трек до конца'},{verb:'POST',uri:'/api/v1/tracks/{id}/play',name:'Отправляет событие прослушивания',resp:'202'},{verb:'PUBLISH',uri:'play-events',name:'Публикует событие',resp:''},{verb:'CONSUME',uri:'play-events',name:'Забирает событие на подсчёт',resp:''},{verb:'INSERT',uri:'events',name:'Записывает прослушивание',resp:'ok'}]},
    {name:'Создание плейлиста',path:[0,1,4,10,11],steps:[{name:'Создаёт плейлист'},{verb:'POST',uri:'/api/v1/playlists',name:'Создаёт плейлист',resp:'201{playlistId}'},{verb:'POST',uri:'/playlists',name:'Маршрутизирует',resp:'201{playlistId}'},{verb:'INSERT',uri:'playlists',name:'Сохраняет плейлист',resp:'ok'}]},
    {name:'Поиск трека',path:[0,1,4,14,15],steps:[{name:'Ищет трек или исполнителя'},{verb:'GET',uri:'/api/v1/search?q=',name:'Отправляет запрос',resp:'200{results}'},{verb:'GET',uri:'/search',name:'Маршрутизирует',resp:'200{results}'},{verb:'GET',uri:'/index/_search',name:'Ищет по индексу',resp:'[{_source}]'}]}
  ]},
  vod_streaming:{lbl:'Онлайн-кинотеатр (Netflix-like)',lbl_en:'VOD Streaming (Netflix-like)',g:'Системы',bls:[
    {t:'actor',dx:-170,dy:50,cl:'Зритель'},
    {t:'web_client',dx:0,dy:0},
    {t:'mob_client',dx:0,dy:100},
    {t:'cdn',dx:160,dy:50,cl:'CDN (видео edge)'},
    {t:'api_gw',dx:320,dy:100,set:{auth_mode:'JWT (встроенный)'}},
    {t:'auth',dx:500,dy:10,cl:'Auth (OAuth2)',auth:{type:'oauth2_jwt'}},
    {t:'postgresql',dx:680,dy:10,cl:'Auth DB',db:'auth_postgres'},
    {t:'service',dx:680,dy:100,cl:'Подписка / Биллинг',pat:['retry']},
    {t:'postgresql',dx:860,dy:100,cl:'Subscriptions DB',db:'subscriptions_postgres'},
    {t:'external',dx:1040,dy:100,cl:'Платёжный шлюз'},
    {t:'service',dx:500,dy:190,cl:'Каталог',pat:['cache_aside']},
    {t:'redis',dx:680,dy:170,cl:'Catalog Cache'},
    {t:'postgresql',dx:680,dy:230,cl:'Titles DB',db:'vod_postgres'},
    {t:'service',dx:320,dy:280,cl:'Плеер / Стриминг',pat:['timeout']},
    {t:'s3',dx:500,dy:280,cl:'Transcoded Video Storage'},
    {t:'service',dx:320,dy:360,cl:'Продолжить просмотр'},
    {t:'redis',dx:500,dy:360,cl:'Watch Progress',db:'watch_progress_redis'},
    {t:'service',dx:320,dy:440,cl:'Поиск'},
    {t:'elasticsearch',dx:500,dy:440,cl:'Search Index'},
    {t:'kafka',dx:160,dy:520,cl:'view-events'},
    {t:'service',dx:320,dy:520,cl:'Счётчик просмотров'},
    {t:'clickhouse',dx:500,dy:520,cl:'Watch Analytics',db:'analytics_clickhouse'},
    {t:'service',dx:320,dy:600,cl:'Рекомендации'}
  ],cs:[[0,1],[0,2],[1,3],[2,3],[1,4],[2,4],[4,5],[5,6],[4,7],[7,8],[7,9],[4,10],[10,11],[10,12],[4,13],[13,14],[14,3],[4,15],[15,16],[4,17],[17,18],[4,19],[19,20],[20,21],[21,22],[19,22]],scenarios:[
    {name:'Оформление подписки',path:[0,1,4,7,9],steps:[{name:'Оформляет подписку'},{verb:'POST',uri:'/api/v1/subscriptions',name:'Оформляет подписку',resp:'201{subscriptionId}'},{verb:'POST',uri:'/subscriptions',name:'Маршрутизирует',resp:'201{subscriptionId}'},{verb:'POST',uri:'/charge',name:'Списывает оплату подписки',resp:'200{transactionId}'}]},
    {name:'Просмотр с продолжением',path:[0,2,4,15,16],steps:[{name:'Продолжает смотреть фильм'},{verb:'GET',uri:'/api/v1/titles/{id}/progress',name:'Запрашивает позицию просмотра',resp:'200{positionSec}'},{verb:'GET',uri:'/titles/{id}/progress',name:'Маршрутизирует',resp:'200{positionSec}'},{verb:'GET',uri:'progress:{userId}:{titleId}',name:'Читает сохранённую позицию',resp:'{positionSec}'}]},
    {name:'Учёт просмотра',path:[0,2,4,19,20,21],steps:[{name:'Смотрит эпизод'},{verb:'POST',uri:'/api/v1/titles/{id}/view',name:'Отправляет событие просмотра',resp:'202'},{verb:'PUBLISH',uri:'view-events',name:'Публикует событие',resp:''},{verb:'CONSUME',uri:'view-events',name:'Забирает событие на подсчёт',resp:''},{verb:'INSERT',uri:'events',name:'Записывает просмотр',resp:'ok'}]},
    {name:'Поиск тайтла',path:[0,1,4,17,18],steps:[{name:'Ищет фильм или сериал'},{verb:'GET',uri:'/api/v1/search?q=',name:'Отправляет запрос',resp:'200{results}'},{verb:'GET',uri:'/search',name:'Маршрутизирует',resp:'200{results}'},{verb:'GET',uri:'/index/_search',name:'Ищет по индексу',resp:'[{_source}]'}]}
  ]},
  dating:{lbl:'Дейтинг-приложение (Tinder-like)',lbl_en:'Dating App (Tinder-like)',g:'Системы',bls:[
    {t:'actor',dx:-170,dy:60,cl:'Пользователь'},
    {t:'mob_client',dx:0,dy:60},
    {t:'api_gw',dx:180,dy:60,set:{auth_mode:'JWT (встроенный)'}},
    {t:'auth',dx:360,dy:-30,cl:'Auth (Phone + OTP)',auth:{type:'jwt_only'}},
    {t:'postgresql',dx:540,dy:-30,cl:'Auth DB',db:'auth_postgres'},
    {t:'service',dx:360,dy:60,cl:'Анкеты',pat:['cache_aside']},
    {t:'redis',dx:540,dy:40,cl:'Profile Cache'},
    {t:'postgresql',dx:540,dy:100,cl:'Profiles DB',db:'dating_profiles_postgres'},
    {t:'service',dx:360,dy:180,cl:'Подбор анкет (Discovery)',pat:['timeout']},
    {t:'kafka',dx:540,dy:200,cl:'swipe-events'},
    {t:'service',dx:720,dy:200,cl:'Хранение свайпов'},
    {t:'cassandra',dx:900,dy:200,cl:'Swipes DB',db:'swipes_cassandra'},
    {t:'service',dx:720,dy:280,cl:'Детектор взаимных лайков'},
    {t:'postgresql',dx:900,dy:280,cl:'Matches DB',db:'dating_profiles_postgres'},
    {t:'service',dx:360,dy:360,cl:'Чат совпадений'},
    {t:'mongodb',dx:540,dy:360,cl:'Chat DB',db:'chat_mongodb'},
    {t:'service',dx:360,dy:440,cl:'Уведомления'},
    {t:'external',dx:540,dy:440,cl:'Push'},
    {t:'kafka',dx:180,dy:520,cl:'analytics-events'},
    {t:'service',dx:270,dy:600,cl:'ETL аналитики'},
    {t:'clickhouse',dx:450,dy:600,cl:'Engagement Analytics',db:'analytics_clickhouse'}
  ],cs:[[0,1],[1,2],[2,3],[3,4],[2,5],[5,6],[5,7],[2,8],[8,6],[2,9],[9,10],[10,11],[9,12],[12,13],[12,16],[16,17],[2,14],[14,15],[5,18],[10,18],[18,19],[19,20]],scenarios:[
    {name:'Подбор анкет',path:[0,1,2,8,6],steps:[{name:'Открывает ленту анкет'},{verb:'GET',uri:'/api/v1/discovery',name:'Запрашивает анкеты рядом',resp:'200{profiles}'},{verb:'GET',uri:'/discovery',name:'Маршрутизирует',resp:'200{profiles}'},{verb:'GET',uri:'nearby:{geohash}',name:'Читает закэшированные анкеты',resp:'hit:{profiles}'}]},
    {name:'Свайп и мэтч',path:[0,1,2,9,12,13],steps:[{name:'Свайпает анкету вправо'},{verb:'POST',uri:'/api/v1/swipes',name:'Отправляет свайп',resp:'202'},{verb:'PUBLISH',uri:'swipe.created',name:'Публикует событие свайпа',resp:''},{verb:'CONSUME',uri:'swipe.created',name:'Проверяет взаимный лайк',resp:''},{verb:'INSERT',uri:'matches',name:'Создаёт мэтч',resp:'ok'}]},
    {name:'Чат после мэтча',path:[0,1,2,14,15],steps:[{name:'Пишет сообщение мэтчу'},{verb:'POST',uri:'/api/v1/chats/{id}/messages',name:'Отправляет сообщение',resp:'201{messageId}'},{verb:'POST',uri:'/chats/{id}/messages',name:'Маршрутизирует',resp:'201{messageId}'},{verb:'INSERT',uri:'messages',name:'Сохраняет сообщение',resp:'ok'}]}
  ]},
  crypto_exchange:{lbl:'Криптобиржа (Binance-like)',lbl_en:'Crypto Exchange (Binance-like)',g:'Системы',bls:[
    {t:'actor',dx:-170,dy:60,cl:'Трейдер'},
    {t:'web_client',dx:0,dy:0},
    {t:'mob_client',dx:0,dy:120},
    {t:'api_gw',dx:180,dy:60,set:{auth_mode:'OAuth2 Introspection'}},
    {t:'auth',dx:360,dy:-30,cl:'Auth (OAuth2 + 2FA)',pat:['timeout'],auth:{type:'oauth2_jwt'}},
    {t:'postgresql',dx:540,dy:-30,cl:'Auth DB',db:'auth_postgres'},
    {t:'service',dx:360,dy:60,cl:'Кошельки',pat:['cache_aside']},
    {t:'postgresql',dx:540,dy:60,cl:'Wallets DB',db:'wallets_postgres'},
    {t:'service',dx:360,dy:160,cl:'Ордера',pat:['circuit_breaker']},
    {t:'redis',dx:540,dy:140,cl:'Order Book'},
    {t:'service',dx:540,dy:220,cl:'Matching Engine',pat:['timeout']},
    {t:'postgresql',dx:720,dy:220,cl:'Orders/Trades DB',db:'trading_postgres'},
    {t:'kafka',dx:360,dy:300,cl:'trade-events'},
    {t:'service',dx:540,dy:300,cl:'Клиринг (settlement)',pat:['retry']},
    {t:'postgresql',dx:720,dy:300,cl:'Ledger DB',db:'bank_ledger_postgres'},
    {t:'service',dx:360,dy:400,cl:'Уведомления'},
    {t:'external',dx:540,dy:400,cl:'Push / Email'},
    {t:'kafka',dx:180,dy:480,cl:'analytics-events'},
    {t:'service',dx:270,dy:560,cl:'ETL аналитики'},
    {t:'clickhouse',dx:450,dy:560,cl:'Market Analytics',db:'analytics_clickhouse'}
  ],cs:[[0,1],[0,2],[1,3],[2,3],[3,4],[4,5],[3,6],[6,7],[3,8],[8,9],[8,10],[10,11],[10,12],[12,13],[13,14],[13,7],[12,15],[15,16],[8,17],[13,17],[17,18],[18,19]],scenarios:[
    {name:'Выставление ордера',path:[0,1,3,8,9],steps:[{name:'Выставляет заявку на покупку'},{verb:'POST',uri:'/api/v1/orders',name:'Отправляет ордер',resp:'201{orderId}'},{verb:'POST',uri:'/orders',name:'Маршрутизирует',resp:'201{orderId}'},{verb:'ZADD',uri:'orderbook:{pair}:bids',name:'Добавляет заявку в стакан',resp:'OK'}]},
    {name:'Исполнение сделки (matching)',path:[8,10,11],steps:[{name:'Ищет встречную заявку в стакане',resp:''},{verb:'INSERT',uri:'trades',name:'Фиксирует исполненную сделку',resp:'ok'}]},
    {name:'Клиринг и зачисление',path:[10,12,13,14],steps:[{verb:'PUBLISH',uri:'trade.executed',name:'Публикует событие сделки',resp:''},{verb:'CONSUME',uri:'trade.executed',name:'Забирает сделку на клиринг',resp:''},{verb:'INSERT',uri:'ledger_entries',name:'Проводит зачисление/списание по кошелькам',resp:'ok'}]}
  ]},
  online_education:{lbl:'Онлайн-образование (Coursera-like)',lbl_en:'Online Education (Coursera-like)',g:'Системы',bls:[
    {t:'actor',dx:-170,dy:0,cl:'Студент'},
    {t:'actor',dx:-170,dy:220,cl:'Преподаватель'},
    {t:'web_client',dx:0,dy:0},
    {t:'mob_client',dx:0,dy:100},
    {t:'api_gw',dx:180,dy:100,set:{auth_mode:'JWT (встроенный)'}},
    {t:'auth',dx:360,dy:10,cl:'Auth',auth:{type:'jwt_only'}},
    {t:'postgresql',dx:540,dy:10,cl:'Auth DB',db:'auth_postgres'},
    {t:'service',dx:360,dy:100,cl:'Курсы',pat:['cache_aside']},
    {t:'redis',dx:540,dy:80,cl:'Course Cache'},
    {t:'postgresql',dx:540,dy:140,cl:'Courses DB',db:'courses_postgres'},
    {t:'service',dx:360,dy:220,cl:'Уроки / Видео',pat:['timeout']},
    {t:'s3',dx:540,dy:220,cl:'Video Storage'},
    {t:'service',dx:360,dy:300,cl:'Прогресс / Тесты'},
    {t:'mongodb',dx:540,dy:300,cl:'Progress DB',db:'lesson_progress_mongodb'},
    {t:'kafka',dx:360,dy:380,cl:'course-completed'},
    {t:'service',dx:540,dy:380,cl:'Генератор сертификатов',pat:['timeout']},
    {t:'s3',dx:720,dy:380,cl:'Certificates Storage'},
    {t:'service',dx:360,dy:460,cl:'Поиск курсов'},
    {t:'elasticsearch',dx:540,dy:460,cl:'Search Index'},
    {t:'kafka',dx:180,dy:540,cl:'analytics-events'},
    {t:'service',dx:270,dy:620,cl:'ETL аналитики'},
    {t:'clickhouse',dx:450,dy:620,cl:'Learning Analytics',db:'analytics_clickhouse'}
  ],cs:[[0,2],[0,3],[1,2],[2,4],[3,4],[4,5],[5,6],[4,7],[7,8],[7,9],[4,10],[10,11],[4,12],[12,13],[12,14],[14,15],[15,16],[4,17],[17,18],[7,19],[12,19],[19,20],[20,21]],scenarios:[
    {name:'Запись на курс',path:[0,2,4,7,9],steps:[{name:'Записывается на курс'},{verb:'POST',uri:'/api/v1/courses/{id}/enroll',name:'Записывается на курс',resp:'201{enrollmentId}'},{verb:'POST',uri:'/courses/{id}/enroll',name:'Маршрутизирует',resp:'201{enrollmentId}'},{verb:'INSERT',uri:'enrollments',name:'Создаёт зачисление',resp:'ok'}]},
    {name:'Прохождение урока и теста',path:[0,3,4,12,13],steps:[{name:'Смотрит урок и проходит тест'},{verb:'POST',uri:'/api/v1/lessons/{id}/complete',name:'Отправляет результат теста',resp:'200{score}'},{verb:'POST',uri:'/lessons/{id}/complete',name:'Маршрутизирует',resp:'200{score}'},{verb:'INSERT',uri:'lesson_progress',name:'Сохраняет прогресс и оценку',resp:'ok'}]},
    {name:'Выдача сертификата',path:[12,14,15,16],steps:[{verb:'PUBLISH',uri:'course.completed',name:'Публикует событие завершения курса',resp:''},{verb:'CONSUME',uri:'course.completed',name:'Забирает событие на генерацию сертификата',resp:''},{verb:'PUT',uri:'/{certId}.pdf',name:'Сохраняет PDF-сертификат',resp:'200'}]}
  ]},
  fitness_tracker:{lbl:'Фитнес-трекер (Strava-like)',lbl_en:'Fitness Tracker (Strava-like)',g:'Системы',bls:[
    {t:'actor',dx:-170,dy:60,cl:'Спортсмен'},
    {t:'mob_client',dx:0,dy:60},
    {t:'api_gw',dx:180,dy:60,set:{auth_mode:'JWT (встроенный)'}},
    {t:'auth',dx:360,dy:-30,cl:'Auth',auth:{type:'jwt_only'}},
    {t:'postgresql',dx:540,dy:-30,cl:'Auth DB',db:'auth_postgres'},
    {t:'service',dx:360,dy:60,cl:'Тренировки',pat:['timeout']},
    {t:'postgresql',dx:540,dy:60,cl:'Workouts DB',db:'workouts_postgres'},
    {t:'service',dx:360,dy:140,cl:'GPS-трек'},
    {t:'cassandra',dx:540,dy:140,cl:'Routes DB',db:'workout_routes_cassandra'},
    {t:'service',dx:360,dy:220,cl:'Лента / Подписки'},
    {t:'postgresql',dx:540,dy:220,cl:'Social Graph DB',db:'social_graph_postgres'},
    {t:'kafka',dx:180,dy:300,cl:'workout-events'},
    {t:'service',dx:360,dy:300,cl:'Лидерборд'},
    {t:'redis',dx:540,dy:300,cl:'Leaderboard (ZSET)'},
    {t:'service',dx:360,dy:380,cl:'Уведомления (кубки/рекорды)'},
    {t:'external',dx:540,dy:380,cl:'Push'},
    {t:'kafka',dx:180,dy:460,cl:'analytics-events'},
    {t:'service',dx:270,dy:540,cl:'ETL аналитики'},
    {t:'clickhouse',dx:450,dy:540,cl:'Training Analytics',db:'analytics_clickhouse'}
  ],cs:[[0,1],[1,2],[2,3],[3,4],[2,5],[5,6],[5,7],[7,8],[2,9],[9,10],[5,11],[11,12],[12,13],[11,14],[14,15],[5,16],[16,17],[17,18]],scenarios:[
    {name:'Запись тренировки',path:[0,1,2,5,6],steps:[{name:'Завершает пробежку'},{verb:'POST',uri:'/api/v1/workouts',name:'Отправляет итог тренировки',resp:'201{workoutId}'},{verb:'POST',uri:'/workouts',name:'Маршрутизирует',resp:'201{workoutId}'},{verb:'INSERT',uri:'workouts',name:'Сохраняет тренировку',resp:'ok'}]},
    {name:'Сохранение GPS-трека',path:[5,7,8],steps:[{name:'Передаёт точки маршрута',resp:''},{verb:'INSERT',uri:'route_points',name:'Сохраняет GPS-точки',resp:'ok'}]},
    {name:'Обновление лидерборда',path:[5,11,12,13],steps:[{verb:'PUBLISH',uri:'workout.completed',name:'Публикует событие тренировки',resp:''},{verb:'CONSUME',uri:'workout.completed',name:'Забирает результат для рейтинга',resp:''},{verb:'ZADD',uri:'leaderboard:weekly',name:'Обновляет позицию в рейтинге',resp:'OK'}]}
  ]},
  hotel_booking:{lbl:'Букинг отелей (Booking.com-like)',lbl_en:'Hotel Booking (Booking.com-like)',g:'Системы',bls:[
    {t:'actor',dx:-170,dy:60,cl:'Гость'},
    {t:'web_client',dx:0,dy:0},
    {t:'mob_client',dx:0,dy:120},
    {t:'api_gw',dx:180,dy:60,set:{auth_mode:'JWT (встроенный)'}},
    {t:'auth',dx:360,dy:-30,cl:'Auth',auth:{type:'jwt_only'}},
    {t:'postgresql',dx:540,dy:-30,cl:'Auth DB',db:'auth_postgres'},
    {t:'service',dx:360,dy:60,cl:'Поиск отелей',pat:['cache_aside']},
    {t:'redis',dx:540,dy:40,cl:'Search Cache'},
    {t:'elasticsearch',dx:540,dy:100,cl:'Hotels Search Index'},
    {t:'postgresql',dx:720,dy:60,cl:'Hotels DB',db:'hotels_postgres'},
    {t:'service',dx:360,dy:180,cl:'Бронирование',pat:['circuit_breaker']},
    {t:'postgresql',dx:540,dy:180,cl:'Bookings DB',db:'booking_postgres'},
    {t:'kafka',dx:360,dy:280,cl:'booking-events'},
    {t:'service',dx:540,dy:260,cl:'Оплата',pat:['retry','timeout']},
    {t:'postgresql',dx:720,dy:260,cl:'Payment DB',db:'payment_postgres'},
    {t:'external',dx:900,dy:260,cl:'Платёжный шлюз'},
    {t:'service',dx:540,dy:340,cl:'Отзывы'},
    {t:'postgresql',dx:720,dy:340,cl:'Reviews DB',db:'reviews_postgres'},
    {t:'service',dx:360,dy:420,cl:'Уведомления'},
    {t:'external',dx:540,dy:420,cl:'Email / SMS'},
    {t:'kafka',dx:180,dy:500,cl:'analytics-events'},
    {t:'service',dx:270,dy:580,cl:'ETL аналитики'},
    {t:'clickhouse',dx:450,dy:580,cl:'Booking Analytics',db:'analytics_clickhouse'}
  ],cs:[[0,1],[0,2],[1,3],[2,3],[3,4],[4,5],[3,6],[6,7],[6,8],[6,9],[3,10],[10,11],[10,12],[12,13],[13,14],[13,15],[3,16],[16,17],[12,18],[18,19],[10,20],[13,20],[20,21],[21,22]],scenarios:[
    {name:'Поиск отеля',path:[0,1,3,6,8],steps:[{name:'Ищет отель по городу и датам'},{verb:'GET',uri:'/api/v1/hotels/search?city=&dates=',name:'Отправляет запрос поиска',resp:'200{hotels}'},{verb:'GET',uri:'/hotels/search',name:'Маршрутизирует',resp:'200{hotels}'},{verb:'GET',uri:'/index/_search',name:'Ищет доступные отели',resp:'[{_source}]'}]},
    {name:'Бронирование номера',path:[0,2,3,10,11],steps:[{name:'Бронирует номер'},{verb:'POST',uri:'/api/v1/bookings',name:'Отправляет бронирование',resp:'201{bookingId}'},{verb:'POST',uri:'/bookings',name:'Маршрутизирует',resp:'201{bookingId}'},{verb:'INSERT',uri:'bookings',name:'Создаёт бронь (status=pending)',resp:'ok'}]},
    {name:'Оплата бронирования',path:[10,12,13,15],steps:[{verb:'PUBLISH',uri:'booking.created',name:'Публикует событие брони',resp:''},{verb:'CONSUME',uri:'booking.created',name:'Забирает бронь на оплату',resp:''},{verb:'POST',uri:'/charge',name:'Списывает оплату за проживание',resp:'200{transactionId}'}]},
    {name:'Отзыв после проживания',path:[0,1,3,16,17],steps:[{name:'Оставляет отзыв об отеле'},{verb:'POST',uri:'/api/v1/hotels/{id}/reviews',name:'Отправляет отзыв',resp:'201{reviewId}'},{verb:'POST',uri:'/hotels/{id}/reviews',name:'Маршрутизирует',resp:'201{reviewId}'},{verb:'INSERT',uri:'reviews',name:'Сохраняет отзыв',resp:'ok'}]}
  ]},
  cloud_storage:{lbl:'Облачное хранилище (Dropbox-like)',lbl_en:'Cloud Storage (Dropbox-like)',g:'Системы',bls:[
    {t:'actor',dx:-170,dy:60,cl:'Пользователь'},
    {t:'web_client',dx:0,dy:0},
    {t:'mob_client',dx:0,dy:120,cl:'Desktop-клиент (sync)'},
    {t:'api_gw',dx:180,dy:60,set:{auth_mode:'JWT (встроенный)'}},
    {t:'auth',dx:360,dy:-30,cl:'Auth',auth:{type:'jwt_only'}},
    {t:'postgresql',dx:540,dy:-30,cl:'Auth DB',db:'auth_postgres'},
    {t:'service',dx:360,dy:60,cl:'Файлы / Папки',pat:['timeout']},
    {t:'postgresql',dx:540,dy:60,cl:'Files DB',db:'cloud_files_postgres'},
    {t:'s3',dx:360,dy:140,cl:'Blob Storage'},
    {t:'websocket_gw',dx:180,dy:220,cl:'Realtime Sync GW'},
    {t:'service',dx:360,dy:220,cl:'Синхронизация'},
    {t:'service',dx:360,dy:300,cl:'Общий доступ'},
    {t:'kafka',dx:540,dy:320,cl:'file-events'},
    {t:'service',dx:720,dy:320,cl:'Уведомления'},
    {t:'external',dx:900,dy:320,cl:'Email / Push'},
    {t:'service',dx:360,dy:400,cl:'Поиск по файлам'},
    {t:'elasticsearch',dx:540,dy:400,cl:'Search Index'},
    {t:'kafka',dx:180,dy:480,cl:'analytics-events'},
    {t:'service',dx:270,dy:560,cl:'ETL аналитики'},
    {t:'clickhouse',dx:450,dy:560,cl:'Usage Analytics',db:'analytics_clickhouse'}
  ],cs:[[0,1],[0,2],[1,3],[2,3],[1,9],[2,9],[3,4],[4,5],[3,6],[6,7],[6,8],[9,10],[10,7],[10,12],[3,11],[11,7],[11,12],[12,13],[13,14],[3,15],[15,16],[6,17],[17,18],[18,19]],scenarios:[
    {name:'Загрузка файла',path:[0,1,3,6,8],steps:[{name:'Загружает файл в облако'},{verb:'POST',uri:'/api/v1/files',name:'Отправляет файл',resp:'201{fileId}'},{verb:'POST',uri:'/files',name:'Маршрутизирует',resp:'201{fileId}'},{verb:'PUT',uri:'/{fileId}',name:'Сохраняет содержимое файла',resp:'200'}]},
    {name:'Синхронизация между устройствами',path:[0,2,9,10,12],steps:[{name:'Изменяет файл локально'},{verb:'SEND',uri:'ws:file.changed',name:'Отправляет изменение',resp:'ack'},{name:'Принимает изменение файла',resp:''},{verb:'PUBLISH',uri:'file.changed',name:'Публикует событие для других устройств',resp:''}]},
    {name:'Общий доступ к файлу',path:[0,1,3,11,7],steps:[{name:'Делится файлом по ссылке'},{verb:'POST',uri:'/api/v1/files/{id}/share',name:'Открывает доступ',resp:'200{shareId}'},{verb:'POST',uri:'/files/{id}/share',name:'Маршрутизирует',resp:'200{shareId}'},{verb:'INSERT',uri:'shares',name:'Сохраняет право доступа',resp:'ok'}]},
    {name:'Поиск по файлам',path:[0,1,3,15,16],steps:[{name:'Ищет файл по названию'},{verb:'GET',uri:'/api/v1/search?q=',name:'Отправляет запрос',resp:'200{results}'},{verb:'GET',uri:'/search',name:'Маршрутизирует',resp:'200{results}'},{verb:'GET',uri:'/index/_search',name:'Ищет по индексу',resp:'[{_source}]'}]}
  ]},
};

const EXAMPLES=[
];
