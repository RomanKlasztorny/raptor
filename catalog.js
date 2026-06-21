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
  {lbl:'👤 Кто',          els:['actor']},
  {lbl:'🌐 Клиенты',      els:['web_client','mob_client']},
  {lbl:'🚪 Шлюзы / Сеть', els:['api_gw','lb','cdn']},
  {lbl:'⚡ Real-time',     els:['websocket_gw']},
  {lbl:'⚙ Сервисы',      els:['service','bff','auth']},
  {lbl:'🗄 Хранилища',    els:['postgresql','mysql','mongodb','cassandra','clickhouse','elasticsearch','s3','redis']},
  {lbl:'📡 Брокеры',      els:['kafka','rabbitmq','nats','queue']},
  {lbl:'🌍 Внешние',      els:['external']},
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
  account:{lbl:'Личный кабинет',g:'Сервисы',bls:[{t:'service',dx:0,dy:0,cl:'Личный кабинет'},{t:'postgresql',dx:0,dy:110,cl:'User DB',db:'profile_postgres'}],cs:[[0,1]]},
  auth:{lbl:'Авторизация',g:'Сервисы',bls:[{t:'api_gw',dx:0,dy:55},{t:'auth',dx:180,dy:55,cl:'Auth Provider',pat:['timeout'],auth:{type:'jwt_only'}},{t:'postgresql',dx:360,dy:55,cl:'Auth DB',db:'auth_postgres'}],cs:[[0,1],[1,2]]},
  search:{lbl:'Поиск (Elasticsearch)',g:'Сервисы',bls:[{t:'service',dx:0,dy:0,cl:'Поиск'},{t:'elasticsearch',dx:185,dy:0,cl:'Search Index'}],cs:[[0,1]]},
  media:{lbl:'Файлы / Медиа',g:'Сервисы',bls:[{t:'service',dx:0,dy:0,cl:'Файлы',pat:['timeout']},{t:'s3',dx:185,dy:-20,cl:'S3 Storage'},{t:'postgresql',dx:185,dy:90,cl:'Files Meta',db:'files_postgres'}],cs:[[0,1],[0,2]]},
  chat_ws:{lbl:'Чат (WebSocket)',g:'Сервисы',bls:[{t:'websocket_gw',dx:0,dy:0},{t:'service',dx:185,dy:0,cl:'Чат'},{t:'mongodb',dx:370,dy:-20,cl:'Chat DB',db:'chat_mongodb'},{t:'redis',dx:370,dy:90,cl:'Pub/Sub'}],cs:[[0,1],[1,2],[1,3]]},
  catalog:{lbl:'Каталог',g:'Сервисы',bls:[{t:'service',dx:0,dy:0,cl:'Каталог',pat:['cache_aside']},{t:'redis',dx:180,dy:-20},{t:'mongodb',dx:180,dy:90,cl:'Catalog DB',db:'catalog_mongodb'}],cs:[[0,1],[0,2]]},
  cart:{lbl:'Корзина',g:'Сервисы',bls:[{t:'service',dx:0,dy:0,cl:'Корзина'},{t:'redis',dx:180,dy:-20,cl:'Cart Cache',db:'cart_redis'},{t:'postgresql',dx:180,dy:90,cl:'Cart DB',db:'ecommerce_orders'}],cs:[[0,1],[0,2]]},
  payment:{lbl:'Оплата',g:'Сервисы',bls:[{t:'service',dx:0,dy:0,cl:'Оплата',pat:['retry','timeout']},{t:'postgresql',dx:0,dy:110,cl:'Payment DB',db:'payment_postgres'},{t:'external',dx:190,dy:0,cl:'Платёжный шлюз'}],cs:[[0,1],[0,2]]},
  notify:{lbl:'Уведомления',g:'Сервисы',bls:[{t:'service',dx:0,dy:30,cl:'Сервис-источник'},{t:'kafka',dx:185,dy:30},{t:'service',dx:360,dy:30,cl:'Уведомления'},{t:'external',dx:545,dy:30,cl:'SMTP / Email'}],cs:[[0,1],[1,2],[2,3]]},
  crud:{lbl:'CRUD-сервис',g:'Сервисы',bls:[{t:'service',dx:0,dy:0,cl:'CRUD-сервис',pat:['cache_aside']},{t:'redis',dx:180,dy:-20},{t:'postgresql',dx:180,dy:90,db:'profile_postgres'}],cs:[[0,1],[0,2]]},
  analytics:{lbl:'Аналитика',g:'Сервисы',bls:[{t:'service',dx:0,dy:0,cl:'Сборщик'},{t:'kafka',dx:175,dy:0},{t:'service',dx:350,dy:0,cl:'ETL'},{t:'clickhouse',dx:350,dy:110,db:'analytics_clickhouse'}],cs:[[0,1],[1,2],[2,3]]},

  // ── Группы сервисов ──
  shop:{lbl:'Интернет-магазин',g:'Группы',bls:[
    {t:'api_gw',dx:0,dy:150},{t:'lb',dx:160,dy:150},
    {t:'service',dx:330,dy:0,cl:'Каталог',pat:['cache_aside']},{t:'mongodb',dx:510,dy:0,cl:'Catalog DB',db:'catalog_mongodb'},
    {t:'service',dx:330,dy:120,cl:'Корзина'},{t:'redis',dx:510,dy:120,cl:'Cart Cache',db:'cart_redis'},
    {t:'service',dx:330,dy:240,cl:'Заказы'},{t:'postgresql',dx:510,dy:240,cl:'Orders DB',db:'ecommerce_orders'},
    {t:'kafka',dx:330,dy:360},{t:'service',dx:520,dy:360,cl:'Оплата',pat:['retry']},{t:'postgresql',dx:700,dy:360,cl:'Payment DB',db:'payment_postgres'}
  ],cs:[[0,1],[1,2],[1,4],[1,6],[2,3],[4,5],[6,7],[6,8],[8,9],[9,10]]},
  fullmsa:{lbl:'Полная MSA',g:'Группы',bls:[
    {t:'web_client',dx:0,dy:0},{t:'mob_client',dx:0,dy:120},{t:'api_gw',dx:180,dy:60},
    {t:'service',dx:360,dy:0,cl:'Users'},{t:'service',dx:360,dy:120,cl:'Goals'},{t:'service',dx:360,dy:240,cl:'Habits'},
    {t:'postgresql',dx:540,dy:0},{t:'postgresql',dx:540,dy:120},{t:'postgresql',dx:540,dy:240}
  ],cs:[[0,2],[1,2],[2,3],[2,4],[2,5],[3,6],[4,7],[5,8]]},
  eventdriven:{lbl:'Event-Driven',g:'Группы',bls:[
    {t:'service',dx:0,dy:120,cl:'Producer'},{t:'kafka',dx:180,dy:120},
    {t:'service',dx:360,dy:40,cl:'Consumer A'},{t:'postgresql',dx:540,dy:40},
    {t:'service',dx:360,dy:200,cl:'Consumer B'},{t:'postgresql',dx:540,dy:200}
  ],cs:[[0,1],[1,2],[1,4],[2,3],[4,5]]},
  mentorship:{lbl:'Платформа менторства',g:'Группы',bls:[
    {t:'web_client',dx:0,dy:0},{t:'mob_client',dx:0,dy:110},{t:'api_gw',dx:180,dy:55},
    {t:'service',dx:360,dy:-40,cl:'Пользователи'},{t:'postgresql',dx:540,dy:-40},
    {t:'service',dx:360,dy:70,cl:'Курсы',pat:['cache_aside']},{t:'postgresql',dx:540,dy:70},
    {t:'service',dx:360,dy:180,cl:'Запись'},{t:'postgresql',dx:540,dy:180},
    {t:'service',dx:360,dy:290,cl:'Диалоги'},{t:'mongodb',dx:540,dy:290},
    {t:'kafka',dx:360,dy:400},{t:'service',dx:560,dy:400,cl:'Уведомления'},{t:'external',dx:745,dy:400,cl:'SMTP / Email'}
  ],cs:[[0,2],[1,2],[2,3],[2,5],[2,7],[2,9],[3,4],[5,6],[7,8],[9,10],[7,11],[11,12],[12,13]]},
  cqrs:{lbl:'CQRS (write/read)',g:'Группы',bls:[
    {t:'api_gw',dx:0,dy:90},
    {t:'service',dx:180,dy:20,cl:'Команды (write)'},{t:'postgresql',dx:380,dy:-30,cl:'Write DB',db:'ecommerce_orders'},
    {t:'kafka',dx:380,dy:70},
    {t:'service',dx:565,dy:70,cl:'Проектор'},{t:'mongodb',dx:750,dy:70,cl:'Read Model',db:'catalog_mongodb'},
    {t:'service',dx:180,dy:180,cl:'Запросы (read)'}
  ],cs:[[0,1],[1,2],[1,3],[3,4],[4,5],[0,6],[6,5]]},
  b2b_api:{lbl:'B2B API (API Key)',g:'Группы',bls:[
    {t:'external',dx:0,dy:60,cl:'Партнёр (B2B)'},
    {t:'api_gw',dx:185,dy:60,set:{auth_mode:'API Key',token_location:'X-API-Key (header)'}},
    {t:'auth',dx:370,dy:-10,cl:'Auth Provider',pat:['timeout'],auth:{type:'api_key'}},
    {t:'postgresql',dx:560,dy:-10,cl:'API Keys DB',db:'auth_postgres'},
    {t:'redis',dx:370,dy:80,cl:'Rate Limit',db:'ratelimit_redis'},
    {t:'service',dx:370,dy:170,cl:'Интеграции'},{t:'postgresql',dx:560,dy:170,db:'profile_postgres'}
  ],cs:[[0,1],[1,2],[2,3],[1,4],[1,5],[5,6]]},
  sso:{lbl:'SSO (OIDC, корп. вход)',g:'Группы',bls:[
    {t:'web_client',dx:0,dy:60},
    {t:'api_gw',dx:175,dy:60},
    {t:'auth',dx:350,dy:0,cl:'Auth (OIDC)',pat:['timeout'],auth:{type:'oidc_sso'}},
    {t:'external',dx:535,dy:0,cl:'Keycloak / IdP'},
    {t:'postgresql',dx:535,dy:100,cl:'Identity DB',db:'auth_postgres'},
    {t:'service',dx:350,dy:170,cl:'Портал'},{t:'postgresql',dx:535,dy:200,db:'profile_postgres'}
  ],cs:[[0,1],[1,2],[2,3],[2,4],[1,5],[5,6]]},

  // ── Новые сервисные блоки ──
  scheduler:{lbl:'Планировщик / Воркер',g:'Сервисы',bls:[
    {t:'service',dx:0,dy:30,cl:'Планировщик',pat:['timeout']},
    {t:'queue',dx:185,dy:30},
    {t:'service',dx:370,dy:30,cl:'Воркер',pat:['timeout']},
    {t:'postgresql',dx:185,dy:140,cl:'Job Log',db:'profile_postgres'}
  ],cs:[[0,1],[1,2],[0,3],[2,3]]},

  reports:{lbl:'Отчёты (async)',g:'Сервисы',bls:[
    {t:'service',dx:0,dy:50,cl:'API отчётов'},
    {t:'queue',dx:185,dy:50,cl:'Report Queue'},
    {t:'service',dx:370,dy:50,cl:'Генератор',pat:['timeout']},
    {t:'clickhouse',dx:185,dy:165,cl:'Analytics'},
    {t:'s3',dx:370,dy:165,cl:'PDF / Excel'}
  ],cs:[[0,1],[1,2],[2,3],[2,4]]},

  saga_step:{lbl:'Сага-шаг (команда+компенсация)',g:'Сервисы',bls:[
    {t:'kafka',dx:0,dy:0,cl:'Команды'},
    {t:'service',dx:185,dy:40,cl:'Обработчик',pat:['retry']},
    {t:'kafka',dx:370,dy:0,cl:'События'},
    {t:'postgresql',dx:370,dy:120}
  ],cs:[[0,1],[1,2],[1,3]]},

  // ── Новые группы ──
  multibff:{lbl:'Multi-BFF (Web + Mobile)',g:'Группы',bls:[
    {t:'web_client',dx:0,dy:0},
    {t:'mob_client',dx:0,dy:120},
    {t:'bff',dx:190,dy:0,cl:'Web BFF',pat:['cache_aside']},
    {t:'bff',dx:190,dy:120,cl:'Mobile BFF'},
    {t:'service',dx:390,dy:50,cl:'Users'},{t:'postgresql',dx:580,dy:50},
    {t:'service',dx:390,dy:180,cl:'Каталог',pat:['cache_aside']},
    {t:'redis',dx:580,dy:155,cl:'Cache'},
    {t:'postgresql',dx:580,dy:250,cl:'Catalog DB',db:'catalog_mongodb'}
  ],cs:[[0,2],[1,3],[2,4],[3,4],[4,5],[2,6],[3,6],[6,7],[6,8]]},

  fintech:{lbl:'Финтех платформа',g:'Группы',bls:[
    {t:'mob_client',dx:0,dy:90},
    {t:'api_gw',dx:180,dy:90},
    {t:'service',dx:360,dy:0,cl:'Счета',pat:['cache_aside']},
    {t:'redis',dx:550,dy:0,cl:'Balance Cache'},
    {t:'postgresql',dx:550,dy:80,cl:'Accounts DB',db:'payment_postgres'},
    {t:'service',dx:360,dy:130,cl:'Транзакции',pat:['circuit_breaker','retry']},
    {t:'postgresql',dx:550,dy:170,cl:'TX DB',db:'payment_postgres'},
    {t:'kafka',dx:360,dy:260},
    {t:'service',dx:550,dy:230,cl:'Антифрод',pat:['timeout']},
    {t:'service',dx:550,dy:320,cl:'Уведомления'},
    {t:'external',dx:730,dy:230,cl:'ML Fraud API'},
    {t:'external',dx:730,dy:320,cl:'SMTP / Email'}
  ],cs:[[0,1],[1,2],[2,3],[2,4],[1,5],[5,6],[5,7],[7,8],[7,9],[8,10],[9,11]]},

  saga:{lbl:'Сага (заказ + оплата + склад)',g:'Группы',bls:[
    {t:'api_gw',dx:0,dy:120},
    {t:'service',dx:180,dy:120,cl:'Заказы',pat:['circuit_breaker']},
    {t:'postgresql',dx:180,dy:240,cl:'Orders DB',db:'ecommerce_orders'},
    {t:'kafka',dx:360,dy:120,cl:'order-events'},
    {t:'service',dx:540,dy:60,cl:'Оплата',pat:['retry','timeout']},
    {t:'postgresql',dx:720,dy:60,cl:'Payment DB',db:'payment_postgres'},
    {t:'kafka',dx:720,dy:160,cl:'payment-events'},
    {t:'service',dx:540,dy:200,cl:'Склад'},
    {t:'postgresql',dx:720,dy:260,cl:'Inventory DB',db:'profile_postgres'},
    {t:'service',dx:540,dy:320,cl:'Уведомления'},
    {t:'external',dx:720,dy:320,cl:'SMTP / Email'}
  ],cs:[[0,1],[1,2],[1,3],[3,4],[4,5],[4,6],[6,7],[6,9],[7,8],[9,10]]},
};

const EXAMPLES=[
  {name:'E-commerce',blocks:[{id:'b1',type:'web_client',x:40,y:50},{id:'b2',type:'mob_client',x:40,y:150},{id:'b3',type:'api_gw',x:210,y:100},{id:'b4',type:'lb',x:380,y:100},{id:'b5',type:'service',x:540,y:20,customLabel:'Catalog'},{id:'b6',type:'service',x:540,y:120,customLabel:'Cart'},{id:'b7',type:'service',x:540,y:220,customLabel:'Orders'},{id:'b8',type:'redis',x:700,y:20},{id:'b9',type:'postgresql',x:700,y:120},{id:'b10',type:'kafka',x:700,y:220},{id:'b11',type:'service',x:700,y:320,customLabel:'Payment'}],conns:[{id:'c1',from:'b1',to:'b3'},{id:'c2',from:'b2',to:'b3'},{id:'c3',from:'b3',to:'b4'},{id:'c4',from:'b4',to:'b5'},{id:'c5',from:'b4',to:'b6'},{id:'c6',from:'b4',to:'b7'},{id:'c7',from:'b5',to:'b8'},{id:'c8',from:'b6',to:'b8'},{id:'c9',from:'b7',to:'b9'},{id:'c10',from:'b7',to:'b10'},{id:'c11',from:'b10',to:'b11'}]},
  {name:'Fintech',blocks:[{id:'b1',type:'mob_client',x:40,y:100},{id:'b2',type:'api_gw',x:210,y:100},{id:'b3',type:'service',x:380,y:30,customLabel:'Balance',patterns:['circuit_breaker']},{id:'b4',type:'service',x:380,y:130,customLabel:'Transaction',patterns:['circuit_breaker','retry']},{id:'b5',type:'redis',x:540,y:30},{id:'b6',type:'postgresql',x:540,y:130},{id:'b7',type:'kafka',x:540,y:240},{id:'b8',type:'service',x:700,y:240,customLabel:'Fraud'}],conns:[{id:'c1',from:'b1',to:'b2'},{id:'c2',from:'b2',to:'b3'},{id:'c3',from:'b2',to:'b4'},{id:'c4',from:'b3',to:'b5'},{id:'c5',from:'b3',to:'b6'},{id:'c6',from:'b4',to:'b6'},{id:'c7',from:'b4',to:'b7'},{id:'c8',from:'b7',to:'b8'}]},
  {name:'MS-3: Цели/Привычки',blocks:[{id:'e1',type:'web_client',x:60,y:30},{id:'e2',type:'mob_client',x:60,y:130},{id:'e3',type:'api_gw',x:240,y:80},{id:'e4',type:'service',x:420,y:0,customLabel:'User'},{id:'e5',type:'service',x:420,y:100,customLabel:'Goal'},{id:'e6',type:'service',x:420,y:200,customLabel:'Habit'},{id:'e7',type:'service',x:420,y:300,customLabel:'Tracking'},{id:'e8',type:'postgresql',x:620,y:0,customLabel:'User DB'},{id:'e9',type:'postgresql',x:620,y:100,customLabel:'Goal DB'},{id:'e10',type:'postgresql',x:620,y:200,customLabel:'Habit DB'},{id:'e11',type:'postgresql',x:620,y:300,customLabel:'Track DB'},{id:'e12',type:'kafka',x:420,y:420}],conns:[{id:'f1',from:'e1',to:'e3'},{id:'f2',from:'e2',to:'e3'},{id:'f3',from:'e3',to:'e4'},{id:'f4',from:'e3',to:'e5'},{id:'f5',from:'e3',to:'e6'},{id:'f6',from:'e3',to:'e7'},{id:'f7',from:'e4',to:'e8'},{id:'f8',from:'e5',to:'e9'},{id:'f9',from:'e6',to:'e10'},{id:'f10',from:'e7',to:'e11'},{id:'f11',from:'e6',to:'e12'},{id:'f12',from:'e12',to:'e7'}]},
];
