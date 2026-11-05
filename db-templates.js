// DB-TEMPLATES — 20 шаблонов баз данных с полными схемами

const DB_TEMPLATES = [
  {
    id:'auth_postgres',name:{ru:'Аутентификация и пользователи',en:'Authentication & users'},type:'postgresql',
    schema:{tables:[
      {name:'users',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'email',type:'VARCHAR(255)',unique:true,notNull:true},
        {name:'password_hash',type:'VARCHAR(255)',notNull:true},
        {name:'is_active',type:'BOOLEAN',default:'true'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
        {name:'updated_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_users_email ON users(email)']},
      {name:'refresh_tokens',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'user_id',type:'UUID',notNull:true,fk:{table:'users',field:'id',onDelete:'CASCADE'}},
        {name:'token_hash',type:'VARCHAR(255)',notNull:true},
        {name:'expires_at',type:'TIMESTAMP',notNull:true},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id)','CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at)']},
      {name:'sessions',fields:[
        {name:'id',type:'UUID',pk:true},
        {name:'user_id',type:'UUID',fk:{table:'users',field:'id',onDelete:'CASCADE'}},
        {name:'ip_address',type:'VARCHAR(45)'},
        {name:'user_agent',type:'TEXT'},
        {name:'expires_at',type:'TIMESTAMP',notNull:true},
      ]},
    ]}
  },
  {
    id:'ecommerce_orders',name:{ru:'E-commerce: Заказы',en:'E-commerce: Orders'},type:'postgresql',
    schema:{tables:[
      {name:'orders',fields:[
        {name:'id',label:'ID заказа',type:'UUID',constraints:'PK',default:'gen_random_uuid()',desc:'Идентификатор заказа',example:'a1b2c3d4-...'},
        {name:'user_id',label:'Пользователь',type:'UUID',constraints:'FK, NN',fk:{table:'users',field:'id'},desc:'Кто оформил заказ',example:'5913400c-...'},
        {name:'number',label:'Номер заказа',type:'VARCHAR(20)',constraints:'NN, UNIQUE',desc:'Человекочитаемый номер',example:'ORD-2026-0042'},
        {name:'status',label:'Статус',type:'VARCHAR(50)',constraints:"NN, CHECK (pending|paid|shipped|delivered|cancelled)",default:"'pending'",desc:'Состояние заказа',example:'paid'},
        {name:'total_amount',label:'Сумма',type:'DECIMAL(12,2)',constraints:'NN',desc:'Итоговая сумма',example:'4990.00'},
        {name:'currency',label:'Валюта',type:'CHAR(3)',default:"'RUB'",desc:'Валюта заказа',example:'RUB'},
        {name:'shipping_address_id',label:'Адрес доставки',type:'UUID',constraints:'FK',fk:{table:'addresses',field:'id'},desc:'Куда доставить'},
        {name:'comment',label:'Комментарий',type:'TEXT',desc:'Примечание покупателя'},
        {name:'created_at',label:'Создан',type:'TIMESTAMP',default:'NOW()',desc:'Дата оформления',example:'2026-05-25 14:34'},
        {name:'updated_at',label:'Обновлён',type:'TIMESTAMP',default:'NOW()',desc:'Дата изменения'},
      ],indexes:['CREATE INDEX idx_orders_user ON orders(user_id)','CREATE INDEX idx_orders_status ON orders(status)','CREATE INDEX idx_orders_created ON orders(created_at DESC)','CREATE UNIQUE INDEX idx_orders_number ON orders(number)']},
      {name:'order_items',fields:[
        {name:'id',label:'ID позиции',type:'UUID',constraints:'PK',default:'gen_random_uuid()',desc:'Идентификатор позиции'},
        {name:'order_id',label:'Заказ',type:'UUID',constraints:'FK, NN',fk:{table:'orders',field:'id',onDelete:'CASCADE'},desc:'К какому заказу'},
        {name:'product_id',label:'Товар',type:'UUID',constraints:'FK, NN',fk:{table:'products',field:'id'},desc:'Какой товар'},
        {name:'quantity',label:'Количество',type:'INTEGER',constraints:'NN, CHECK (quantity > 0)',desc:'Сколько штук',example:'2'},
        {name:'unit_price',label:'Цена за ед.',type:'DECIMAL(10,2)',constraints:'NN',desc:'Цена на момент заказа',example:'2495.00'},
        {name:'total_price',label:'Сумма позиции',type:'DECIMAL(10,2)',constraints:'NN',desc:'quantity × unit_price',example:'4990.00'},
      ],indexes:['CREATE INDEX idx_order_items_order ON order_items(order_id)','CREATE INDEX idx_order_items_product ON order_items(product_id)']},
      {name:'addresses',fields:[
        {name:'id',label:'ID адреса',type:'UUID',constraints:'PK',default:'gen_random_uuid()'},
        {name:'user_id',label:'Пользователь',type:'UUID',constraints:'FK, NN',fk:{table:'users',field:'id',onDelete:'CASCADE'}},
        {name:'city',label:'Город',type:'VARCHAR(100)',constraints:'NN',example:'Москва'},
        {name:'street',label:'Улица',type:'VARCHAR(255)',constraints:'NN'},
        {name:'postal_code',label:'Индекс',type:'VARCHAR(20)'},
        {name:'is_default',label:'По умолчанию',type:'BOOLEAN',default:'false'},
      ],indexes:['CREATE INDEX idx_addresses_user ON addresses(user_id)']},
    ]}
  },
  {
    id:'catalog_mongodb',name:{ru:'Каталог товаров',en:'Product catalog'},type:'mongodb',
    schema:{collections:[
      {name:'products',fields:[
        {name:'_id',type:'ObjectId',pk:true},
        {name:'sku',type:'String',unique:true},
        {name:'name',type:'String',notNull:true},
        {name:'description',type:'String'},
        {name:'price',type:'Decimal128'},
        {name:'category_id',type:'ObjectId'},
        {name:'attributes',type:'Object',fields:[
          {name:'color',type:'String'},
          {name:'size',type:'String'},
          {name:'specs',type:'Object',fields:[{name:'weight_g',type:'Number'},{name:'material',type:'String'}]},
        ]},
        {name:'images',type:'Array<String>'},
        {name:'stock',type:'Number'},
        {name:'is_active',type:'Boolean',default:'true'},
        {name:'created_at',type:'Date'},
      ],indexes:['db.products.createIndex({sku:1},{unique:true})','db.products.createIndex({category_id:1})','db.products.createIndex({name:"text",description:"text"})']},
      {name:'categories',fields:[
        {name:'_id',type:'ObjectId',pk:true},
        {name:'name',type:'String'},
        {name:'slug',type:'String',unique:true},
        {name:'parent_id',type:'ObjectId'},
        {name:'path',type:'String'},
      ]},
    ]}
  },
  {
    id:'cart_redis',name:{ru:'Корзина (Redis)',en:'Cart (Redis)'},type:'redis',
    schema:{keys:[
      {pattern:'cart:{user_id}',type:'HASH',fields:['product_id → {qty, price}'],ttl:'7 days'},
      {pattern:'cart:{user_id}:count',type:'STRING',fields:['integer'],ttl:'7 days'},
      {pattern:'session:{session_id}',type:'HASH',fields:['user_id, cart_id, expires_at'],ttl:'30 days'},
    ]}
  },
  {
    id:'payment_postgres',name:{ru:'Финансы и платежи',en:'Finance & payments'},type:'postgresql',
    schema:{tables:[
      {name:'payments',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'order_id',type:'UUID',notNull:true},
        {name:'amount',type:'DECIMAL(12,2)',notNull:true},
        {name:'currency',type:'CHAR(3)',default:"'RUB'"},
        {name:'status',type:'VARCHAR(50)',notNull:true},
        {name:'gateway',type:'VARCHAR(50)'},
        {name:'gateway_transaction_id',type:'VARCHAR(255)'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
        {name:'updated_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_payments_order ON payments(order_id)','CREATE INDEX idx_payments_status ON payments(status)','CREATE UNIQUE INDEX idx_payments_gateway_tx ON payments(gateway_transaction_id) WHERE gateway_transaction_id IS NOT NULL']},
      {name:'transactions',fields:[
        {name:'id',type:'UUID',pk:true},
        {name:'payment_id',type:'UUID',fk:{table:'payments',field:'id'}},
        {name:'type',type:'VARCHAR(50)'},
        {name:'amount',type:'DECIMAL(12,2)'},
        {name:'balance_before',type:'DECIMAL(12,2)'},
        {name:'balance_after',type:'DECIMAL(12,2)'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ]},
    ]}
  },
  {
    id:'chat_mongodb',name:{ru:'Чат и сообщения',en:'Chat & messages'},type:'mongodb',
    schema:{collections:[
      {name:'messages',fields:[
        {name:'_id',type:'ObjectId',pk:true},
        {name:'chat_id',type:'ObjectId'},
        {name:'sender_id',type:'ObjectId'},
        {name:'content',type:'String'},
        {name:'type',type:'String',default:"'text'"},
        {name:'attachments',type:'Array'},
        {name:'read_by',type:'Array<ObjectId>'},
        {name:'created_at',type:'Date'},
        {name:'edited_at',type:'Date'},
      ],indexes:['db.messages.createIndex({chat_id:1,created_at:-1})','db.messages.createIndex({sender_id:1})']},
      {name:'chats',fields:[
        {name:'_id',type:'ObjectId',pk:true},
        {name:'type',type:'String'},
        {name:'participants',type:'Array<ObjectId>'},
        {name:'last_message_at',type:'Date'},
        {name:'created_at',type:'Date'},
      ],indexes:['db.chats.createIndex({participants:1})','db.chats.createIndex({last_message_at:-1})']},
    ]}
  },
  {
    id:'booking_postgres',name:{ru:'Бронирование',en:'Booking'},type:'postgresql',
    schema:{tables:[
      {name:'slots',fields:[
        {name:'id',type:'UUID',pk:true},
        {name:'resource_id',type:'UUID',notNull:true},
        {name:'starts_at',type:'TIMESTAMPTZ',notNull:true},
        {name:'ends_at',type:'TIMESTAMPTZ',notNull:true},
        {name:'is_available',type:'BOOLEAN',default:'true'},
        {name:'capacity',type:'INTEGER',default:'1'},
      ],indexes:['CREATE INDEX idx_slots_resource ON slots(resource_id)','CREATE INDEX idx_slots_time ON slots(starts_at,ends_at)']},
      {name:'bookings',fields:[
        {name:'id',type:'UUID',pk:true},
        {name:'slot_id',type:'UUID',fk:{table:'slots',field:'id'}},
        {name:'user_id',type:'UUID',notNull:true},
        {name:'status',type:'VARCHAR(50)',default:"'pending'"},
        {name:'notes',type:'TEXT'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_bookings_user ON bookings(user_id)','CREATE INDEX idx_bookings_slot ON bookings(slot_id)','CREATE INDEX idx_bookings_status ON bookings(status)']},
    ]}
  },
  {
    id:'logs_cassandra',name:{ru:'Логи и события (Cassandra)',en:'Logs & events (Cassandra)'},type:'cassandra',
    schema:{tables:[
      {name:'events',fields:[
        {name:'service',type:'TEXT',pk:true},
        {name:'event_time',type:'TIMEUUID',pk:'clustering'},
        {name:'level',type:'TEXT'},
        {name:'message',type:'TEXT'},
        {name:'trace_id',type:'UUID'},
        {name:'user_id',type:'UUID'},
        {name:'payload',type:'TEXT'},
      ],clusteringOrder:'ORDER BY (event_time DESC)',
      cqlExtra:'WITH CLUSTERING ORDER BY (event_time DESC) AND default_time_to_live = 604800'},
      {name:'metrics',fields:[
        {name:'metric_name',type:'TEXT',pk:true},
        {name:'bucket',type:'TIMESTAMP',pk:'clustering'},
        {name:'value',type:'DOUBLE'},
        {name:'tags',type:'MAP<TEXT,TEXT>'},
      ]},
    ]}
  },
  {
    id:'analytics_clickhouse',name:{ru:'Аналитика (ClickHouse)',en:'Analytics (ClickHouse)'},type:'clickhouse',
    schema:{tables:[
      {name:'events',fields:[
        {name:'event_date',type:'Date'},
        {name:'event_time',type:'DateTime'},
        {name:'user_id',type:'UInt64'},
        {name:'session_id',type:'String'},
        {name:'event_type',type:'LowCardinality(String)'},
        {name:'properties',type:'String'},
        {name:'page',type:'String'},
        {name:'referrer',type:'String'},
      ],engine:'ENGINE = MergeTree() PARTITION BY toYYYYMM(event_date) ORDER BY (event_date, user_id, event_time)'},
      {name:'sessions',fields:[
        {name:'session_id',type:'String'},
        {name:'user_id',type:'UInt64'},
        {name:'started_at',type:'DateTime'},
        {name:'duration_sec',type:'UInt32'},
        {name:'pages_viewed',type:'UInt16'},
        {name:'country',type:'LowCardinality(String)'},
        {name:'device',type:'LowCardinality(String)'},
      ],engine:'ENGINE = MergeTree() ORDER BY (started_at, user_id)'},
    ]}
  },
  {
    id:'profile_postgres',name:{ru:'Профили пользователей',en:'User profiles'},type:'postgresql',
    schema:{tables:[
      {name:'profiles',fields:[
        {name:'user_id',type:'UUID',pk:true},
        {name:'first_name',type:'VARCHAR(100)'},
        {name:'last_name',type:'VARCHAR(100)'},
        {name:'bio',type:'TEXT'},
        {name:'avatar_url',type:'TEXT'},
        {name:'timezone',type:'VARCHAR(50)',default:"'Europe/Moscow'"},
        {name:'locale',type:'VARCHAR(10)',default:"'ru'"},
        {name:'phone',type:'VARCHAR(20)'},
        {name:'birth_date',type:'DATE'},
        {name:'updated_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_profiles_name ON profiles(last_name, first_name)']},
      {name:'social_links',fields:[
        {name:'id',type:'UUID',pk:true},
        {name:'user_id',type:'UUID',fk:{table:'profiles',field:'user_id',onDelete:'CASCADE'}},
        {name:'platform',type:'VARCHAR(50)'},
        {name:'url',type:'TEXT'},
      ]},
    ]}
  },
  {
    id:'notifications_postgres',name:{ru:'Уведомления',en:'Notifications'},type:'postgresql',
    schema:{tables:[
      {name:'notifications',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'user_id',type:'UUID',notNull:true},
        {name:'type',type:'VARCHAR(50)',notNull:true},
        {name:'title',type:'VARCHAR(255)',notNull:true},
        {name:'body',type:'TEXT'},
        {name:'data',type:'JSONB'},
        {name:'is_read',type:'BOOLEAN',default:'false'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
        {name:'read_at',type:'TIMESTAMP'},
      ],indexes:['CREATE INDEX idx_notif_user ON notifications(user_id)','CREATE INDEX idx_notif_unread ON notifications(user_id) WHERE NOT is_read']},
      {name:'push_tokens',fields:[
        {name:'id',type:'UUID',pk:true},
        {name:'user_id',type:'UUID',notNull:true},
        {name:'token',type:'TEXT',notNull:true},
        {name:'platform',type:'VARCHAR(20)'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE UNIQUE INDEX idx_push_token ON push_tokens(token)']},
    ]}
  },
  {
    id:'geodata_postgres',name:{ru:'Геоданные и локации',en:'Geodata & locations'},type:'postgresql',
    schema:{tables:[
      {name:'locations',fields:[
        {name:'id',type:'UUID',pk:true},
        {name:'name',type:'VARCHAR(255)',notNull:true},
        {name:'address',type:'TEXT'},
        {name:'city',type:'VARCHAR(100)'},
        {name:'country',type:'CHAR(2)'},
        {name:'lat',type:'DOUBLE PRECISION'},
        {name:'lng',type:'DOUBLE PRECISION'},
        {name:'point',type:'GEOGRAPHY(Point,4326)'},
      ],indexes:['CREATE INDEX idx_locations_geo ON locations USING GIST(point)','CREATE INDEX idx_locations_city ON locations(city)'],
      pgExtension:'CREATE EXTENSION IF NOT EXISTS postgis;'},
      {name:'geo_zones',fields:[
        {name:'id',type:'UUID',pk:true},
        {name:'name',type:'VARCHAR(100)'},
        {name:'polygon',type:'GEOGRAPHY(Polygon,4326)'},
        {name:'type',type:'VARCHAR(50)'},
      ],indexes:['CREATE INDEX idx_zones_geo ON geo_zones USING GIST(polygon)']},
    ]}
  },
  {
    id:'files_postgres',name:{ru:'Файлы и медиа',en:'Files & media'},type:'postgresql',
    schema:{tables:[
      {name:'files',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'owner_id',type:'UUID',notNull:true},
        {name:'original_name',type:'VARCHAR(500)',notNull:true},
        {name:'storage_key',type:'TEXT',notNull:true,unique:true},
        {name:'mime_type',type:'VARCHAR(100)'},
        {name:'size_bytes',type:'BIGINT'},
        {name:'checksum',type:'VARCHAR(64)'},
        {name:'is_public',type:'BOOLEAN',default:'false'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
        {name:'deleted_at',type:'TIMESTAMP'},
      ],indexes:['CREATE INDEX idx_files_owner ON files(owner_id)','CREATE INDEX idx_files_key ON files(storage_key)']},
    ]}
  },
  {
    id:'audit_postgres',name:{ru:'Аудит и история изменений',en:'Audit & change history'},type:'postgresql',
    schema:{tables:[
      {name:'audit_log',fields:[
        {name:'id',type:'BIGSERIAL',pk:true},
        {name:'entity_type',type:'VARCHAR(100)',notNull:true},
        {name:'entity_id',type:'UUID',notNull:true},
        {name:'action',type:'VARCHAR(50)',notNull:true},
        {name:'actor_id',type:'UUID'},
        {name:'actor_type',type:'VARCHAR(50)'},
        {name:'old_value',type:'JSONB'},
        {name:'new_value',type:'JSONB'},
        {name:'ip_address',type:'VARCHAR(45)'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_audit_entity ON audit_log(entity_type,entity_id)','CREATE INDEX idx_audit_actor ON audit_log(actor_id)','CREATE INDEX idx_audit_time ON audit_log(created_at DESC)']},
    ]}
  },
  {
    id:'ratelimit_redis',name:{ru:'Rate Limiting (Redis)',en:'Rate limiting (Redis)'},type:'redis',
    schema:{keys:[
      {pattern:'rl:{ip}:{endpoint}:{minute}',type:'STRING',fields:['integer counter'],ttl:'60 sec',note:'INCR + EXPIRE'},
      {pattern:'rl:user:{user_id}:{hour}',type:'STRING',fields:['integer counter'],ttl:'3600 sec'},
      {pattern:'rl:token:{api_key}:{day}',type:'STRING',fields:['integer counter'],ttl:'86400 sec'},
      {pattern:'blocked:{ip}',type:'STRING',fields:['1'],ttl:'vary',note:'SET с коротким TTL'},
    ]}
  },
  {
    id:'sessions_redis',name:{ru:'Сессии (Redis)',en:'Sessions (Redis)'},type:'redis',
    schema:{keys:[
      {pattern:'sess:{session_id}',type:'HASH',fields:['user_id','roles','email','locale','created_at','ip'],ttl:'30 days'},
      {pattern:'user:sessions:{user_id}',type:'SET',fields:['session_id1','session_id2','...'],ttl:'never',note:'Список сессий пользователя'},
    ]}
  },
  {
    id:'iot_cassandra',name:{ru:'IoT / Временные ряды (Cassandra)',en:'IoT / time series (Cassandra)'},type:'cassandra',
    schema:{tables:[
      {name:'sensor_data',fields:[
        {name:'device_id',type:'UUID',pk:true},
        {name:'measured_at',type:'TIMEUUID',pk:'clustering'},
        {name:'temperature',type:'FLOAT'},
        {name:'humidity',type:'FLOAT'},
        {name:'pressure',type:'FLOAT'},
        {name:'battery',type:'FLOAT'},
        {name:'signal',type:'FLOAT'},
      ],cqlExtra:'WITH CLUSTERING ORDER BY (measured_at DESC) AND default_time_to_live = 2592000'},
      {name:'devices',fields:[
        {name:'id',type:'UUID',pk:true},
        {name:'owner_id',type:'UUID'},
        {name:'name',type:'TEXT'},
        {name:'model',type:'TEXT'},
        {name:'location',type:'TEXT'},
        {name:'is_active',type:'BOOLEAN'},
        {name:'last_seen',type:'TIMESTAMP'},
      ]},
    ]}
  },
  {
    id:'mentorship_postgres',name:{ru:'Менторство: Цели и Привычки',en:'Mentorship: Goals & Habits'},type:'postgresql',
    schema:{tables:[
      {name:'goals',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'user_id',type:'UUID',notNull:true},
        {name:'mentor_id',type:'UUID'},
        {name:'title',type:'VARCHAR(255)',notNull:true},
        {name:'description',type:'TEXT'},
        {name:'target_date',type:'DATE'},
        {name:'status',type:'VARCHAR(50)',default:"'active'"},
        {name:'progress',type:'INTEGER',default:'0'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_goals_user ON goals(user_id)','CREATE INDEX idx_goals_mentor ON goals(mentor_id)']},
      {name:'habits',fields:[
        {name:'id',type:'UUID',pk:true},
        {name:'goal_id',type:'UUID',fk:{table:'goals',field:'id',onDelete:'CASCADE'}},
        {name:'title',type:'VARCHAR(255)',notNull:true},
        {name:'frequency',type:'VARCHAR(20)',default:"'daily'"},
        {name:'target_count',type:'INTEGER',default:'1'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ]},
      {name:'habit_logs',fields:[
        {name:'id',type:'UUID',pk:true},
        {name:'habit_id',type:'UUID',fk:{table:'habits',field:'id',onDelete:'CASCADE'}},
        {name:'logged_at',type:'DATE',notNull:true},
        {name:'count',type:'INTEGER',default:'1'},
        {name:'note',type:'TEXT'},
      ],indexes:['CREATE INDEX idx_hlog_habit ON habit_logs(habit_id,logged_at)']},
    ]}
  },
  {
    id:'warehouse_postgres',name:{ru:'Склад и инвентарь',en:'Warehouse & inventory'},type:'postgresql',
    schema:{tables:[
      {name:'warehouses',fields:[
        {name:'id',type:'UUID',pk:true},
        {name:'name',type:'VARCHAR(100)',notNull:true},
        {name:'address',type:'TEXT'},
        {name:'is_active',type:'BOOLEAN',default:'true'},
      ]},
      {name:'inventory',fields:[
        {name:'id',type:'UUID',pk:true},
        {name:'warehouse_id',type:'UUID',fk:{table:'warehouses',field:'id'}},
        {name:'product_id',type:'UUID',notNull:true},
        {name:'quantity',type:'INTEGER',default:'0'},
        {name:'reserved',type:'INTEGER',default:'0'},
        {name:'updated_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE UNIQUE INDEX idx_inv_wh_prod ON inventory(warehouse_id,product_id)','CREATE INDEX idx_inv_product ON inventory(product_id)']},
      {name:'stock_movements',fields:[
        {name:'id',type:'UUID',pk:true},
        {name:'inventory_id',type:'UUID',fk:{table:'inventory',field:'id'}},
        {name:'type',type:'VARCHAR(50)'},
        {name:'quantity',type:'INTEGER'},
        {name:'reason',type:'TEXT'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ]},
    ]}
  },
  {
    id:'subscriptions_postgres',name:{ru:'Подписки и биллинг',en:'Subscriptions & billing'},type:'postgresql',
    schema:{tables:[
      {name:'plans',fields:[
        {name:'id',label:'ID тарифа',type:'UUID',constraints:'PK',default:'gen_random_uuid()',desc:'Идентификатор тарифа'},
        {name:'code',label:'Код',type:'VARCHAR(50)',constraints:'NN, UNIQUE',desc:'Машинный код',example:'pro_monthly'},
        {name:'name',label:'Название',type:'VARCHAR(100)',constraints:'NN',example:'Pro (месяц)'},
        {name:'price',label:'Цена',type:'DECIMAL(10,2)',constraints:'NN',example:'990.00'},
        {name:'interval',label:'Период',type:'VARCHAR(20)',constraints:"NN, CHECK (month|year)",default:"'month'"},
        {name:'is_active',label:'Активен',type:'BOOLEAN',default:'true'},
      ]},
      {name:'subscriptions',fields:[
        {name:'id',label:'ID подписки',type:'UUID',constraints:'PK',default:'gen_random_uuid()'},
        {name:'user_id',label:'Пользователь',type:'UUID',constraints:'FK, NN',fk:{table:'users',field:'id'}},
        {name:'plan_id',label:'Тариф',type:'UUID',constraints:'FK, NN',fk:{table:'plans',field:'id'}},
        {name:'status',label:'Статус',type:'VARCHAR(30)',constraints:"NN, CHECK (active|trialing|past_due|canceled)",default:"'trialing'"},
        {name:'current_period_end',label:'Оплачено до',type:'TIMESTAMPTZ',constraints:'NN',desc:'Конец оплаченного периода'},
        {name:'cancel_at_period_end',label:'Отмена в конце',type:'BOOLEAN',default:'false'},
        {name:'created_at',label:'Создана',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_subs_user ON subscriptions(user_id)','CREATE INDEX idx_subs_status ON subscriptions(status)']},
      {name:'invoices',fields:[
        {name:'id',label:'ID счёта',type:'UUID',constraints:'PK',default:'gen_random_uuid()'},
        {name:'subscription_id',label:'Подписка',type:'UUID',constraints:'FK, NN',fk:{table:'subscriptions',field:'id'}},
        {name:'amount',label:'Сумма',type:'DECIMAL(10,2)',constraints:'NN'},
        {name:'status',label:'Статус',type:'VARCHAR(20)',constraints:"NN, CHECK (paid|open|void)",default:"'open'"},
        {name:'paid_at',label:'Оплачен',type:'TIMESTAMP'},
      ],indexes:['CREATE INDEX idx_invoices_sub ON invoices(subscription_id)']},
    ]}
  },
  {
    id:'reviews_postgres',name:{ru:'Отзывы и рейтинги',en:'Reviews & ratings'},type:'postgresql',
    schema:{tables:[
      {name:'reviews',fields:[
        {name:'id',label:'ID отзыва',type:'UUID',constraints:'PK',default:'gen_random_uuid()'},
        {name:'author_id',label:'Автор',type:'UUID',constraints:'FK, NN',fk:{table:'users',field:'id'},desc:'Кто оставил'},
        {name:'target_id',label:'Объект',type:'UUID',constraints:'NN',desc:'На кого/что отзыв (ментор, товар)'},
        {name:'target_type',label:'Тип объекта',type:'VARCHAR(50)',constraints:'NN',example:'mentor'},
        {name:'rating',label:'Оценка',type:'SMALLINT',constraints:'NN, CHECK (rating BETWEEN 1 AND 5)',example:'5'},
        {name:'text',label:'Текст',type:'TEXT',desc:'Содержание отзыва'},
        {name:'is_anonymous',label:'Анонимно',type:'BOOLEAN',default:'false'},
        {name:'created_at',label:'Создан',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_reviews_target ON reviews(target_type,target_id)','CREATE INDEX idx_reviews_author ON reviews(author_id)']},
    ]}
  },
  {
    id:'promo_postgres',name:{ru:'Промокоды и скидки',en:'Promo codes & discounts'},type:'postgresql',
    schema:{tables:[
      {name:'promo_codes',fields:[
        {name:'id',label:'ID',type:'UUID',constraints:'PK',default:'gen_random_uuid()'},
        {name:'code',label:'Код',type:'VARCHAR(50)',constraints:'NN, UNIQUE',example:'SALE2026'},
        {name:'discount_type',label:'Тип скидки',type:'VARCHAR(20)',constraints:"NN, CHECK (percent|fixed)",default:"'percent'"},
        {name:'discount_value',label:'Размер',type:'DECIMAL(10,2)',constraints:'NN',example:'15.00'},
        {name:'max_uses',label:'Лимит использований',type:'INTEGER',desc:'NULL = без лимита'},
        {name:'used_count',label:'Использовано',type:'INTEGER',default:'0'},
        {name:'expires_at',label:'Действует до',type:'TIMESTAMPTZ'},
        {name:'is_active',label:'Активен',type:'BOOLEAN',default:'true'},
      ],indexes:['CREATE UNIQUE INDEX idx_promo_code ON promo_codes(code)']},
      {name:'promo_redemptions',fields:[
        {name:'id',label:'ID',type:'UUID',constraints:'PK',default:'gen_random_uuid()'},
        {name:'promo_id',label:'Промокод',type:'UUID',constraints:'FK, NN',fk:{table:'promo_codes',field:'id'}},
        {name:'user_id',label:'Пользователь',type:'UUID',constraints:'FK, NN',fk:{table:'users',field:'id'}},
        {name:'order_id',label:'Заказ',type:'UUID',constraints:'FK',fk:{table:'orders',field:'id'}},
        {name:'redeemed_at',label:'Применён',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_redempt_user ON promo_redemptions(user_id)']},
    ]}
  },
  {
    id:'medical_postgres',name:{ru:'Медицина: Пациенты',en:'Medical: Patients'},type:'postgresql',
    schema:{tables:[
      {name:'patients',fields:[
        {name:'id',type:'UUID',pk:true},
        {name:'full_name',type:'VARCHAR(255)',notNull:true},
        {name:'birth_date',type:'DATE'},
        {name:'gender',type:'CHAR(1)'},
        {name:'phone',type:'VARCHAR(20)'},
        {name:'email',type:'VARCHAR(255)'},
        {name:'insurance_number',type:'VARCHAR(50)',unique:true},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ]},
      {name:'appointments',fields:[
        {name:'id',type:'UUID',pk:true},
        {name:'patient_id',type:'UUID',fk:{table:'patients',field:'id'}},
        {name:'doctor_id',type:'UUID',notNull:true},
        {name:'scheduled_at',type:'TIMESTAMPTZ',notNull:true},
        {name:'status',type:'VARCHAR(50)',default:"'scheduled'"},
        {name:'diagnosis',type:'TEXT'},
        {name:'notes',type:'TEXT'},
      ],indexes:['CREATE INDEX idx_appt_patient ON appointments(patient_id)','CREATE INDEX idx_appt_doctor ON appointments(doctor_id,scheduled_at)']},
    ]}
  },
  {
    id:'bank_ledger_postgres',name:{ru:'Банковский леджер (double-entry)',en:'Bank ledger (double-entry)'},type:'postgresql',
    schema:{tables:[
      {name:'accounts',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'user_id',type:'UUID',notNull:true},
        {name:'account_number',type:'VARCHAR(34)',unique:true,notNull:true},
        {name:'currency',type:'CHAR(3)',default:"'RUB'"},
        {name:'balance',type:'DECIMAL(18,2)',default:'0',notNull:true},
        {name:'type',type:'VARCHAR(20)',default:"'checking'"},
        {name:'status',type:'VARCHAR(20)',default:"'active'"},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_accounts_user ON accounts(user_id)','CREATE UNIQUE INDEX idx_accounts_number ON accounts(account_number)']},
      {name:'ledger_entries',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'account_id',type:'UUID',notNull:true,fk:{table:'accounts',field:'id'}},
        {name:'transfer_id',type:'UUID',notNull:true},
        {name:'direction',type:'VARCHAR(6)',notNull:true},
        {name:'amount',type:'DECIMAL(18,2)',notNull:true},
        {name:'balance_after',type:'DECIMAL(18,2)',notNull:true},
        {name:'created_at',type:'TIMESTAMPTZ',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_ledger_account ON ledger_entries(account_id,created_at DESC)','CREATE UNIQUE INDEX idx_ledger_dedup ON ledger_entries(transfer_id,account_id,direction)']},
      {name:'transfers',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'from_account_id',type:'UUID',fk:{table:'accounts',field:'id'}},
        {name:'to_account_id',type:'UUID',fk:{table:'accounts',field:'id'}},
        {name:'amount',type:'DECIMAL(18,2)',notNull:true},
        {name:'currency',type:'CHAR(3)',default:"'RUB'"},
        {name:'status',type:'VARCHAR(20)',default:"'pending'"},
        {name:'idempotency_key',type:'VARCHAR(64)',unique:true},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE UNIQUE INDEX idx_transfers_idem ON transfers(idempotency_key)']},
    ]}
  },
  {
    id:'cards_postgres',name:{ru:'Банковские карты',en:'Bank cards'},type:'postgresql',
    schema:{tables:[
      {name:'cards',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'account_id',type:'UUID',notNull:true,fk:{table:'accounts',field:'id'}},
        {name:'pan_last4',type:'CHAR(4)',notNull:true},
        {name:'card_token',type:'VARCHAR(255)',unique:true,notNull:true},
        {name:'expiry_month',type:'SMALLINT',notNull:true},
        {name:'expiry_year',type:'SMALLINT',notNull:true},
        {name:'status',type:'VARCHAR(20)',default:"'active'"},
        {name:'issued_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_cards_account ON cards(account_id)']},
      {name:'card_transactions',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'card_id',type:'UUID',notNull:true,fk:{table:'cards',field:'id'}},
        {name:'merchant_name',type:'VARCHAR(255)'},
        {name:'mcc_code',type:'VARCHAR(4)'},
        {name:'amount',type:'DECIMAL(12,2)',notNull:true},
        {name:'currency',type:'CHAR(3)',default:"'RUB'"},
        {name:'status',type:'VARCHAR(20)',default:"'approved'"},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_cardtx_card ON card_transactions(card_id,created_at DESC)']},
    ]}
  },
  {
    id:'sellers_postgres',name:{ru:'Продавцы маркетплейса',en:'Marketplace sellers'},type:'postgresql',
    schema:{tables:[
      {name:'sellers',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'user_id',type:'UUID',notNull:true},
        {name:'company_name',type:'VARCHAR(255)',notNull:true},
        {name:'inn',type:'VARCHAR(12)',unique:true},
        {name:'commission_rate',type:'DECIMAL(5,2)',default:'10.00'},
        {name:'rating',type:'DECIMAL(3,2)',default:'0'},
        {name:'status',type:'VARCHAR(20)',default:"'pending'"},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_sellers_user ON sellers(user_id)','CREATE UNIQUE INDEX idx_sellers_inn ON sellers(inn)']},
      {name:'seller_documents',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'seller_id',type:'UUID',notNull:true,fk:{table:'sellers',field:'id',onDelete:'CASCADE'}},
        {name:'doc_type',type:'VARCHAR(50)'},
        {name:'file_url',type:'TEXT'},
        {name:'verified',type:'BOOLEAN',default:'false'},
      ]},
      {name:'seller_ratings',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'seller_id',type:'UUID',notNull:true,fk:{table:'sellers',field:'id'}},
        {name:'order_id',type:'UUID'},
        {name:'rating',type:'SMALLINT',notNull:true},
        {name:'comment',type:'TEXT'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_sellerrating_seller ON seller_ratings(seller_id)']},
    ]}
  },
  {
    id:'video_postgres',name:{ru:'Видео и каналы',en:'Video & channels'},type:'postgresql',
    schema:{tables:[
      {name:'channels',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'user_id',type:'UUID',unique:true,notNull:true},
        {name:'name',type:'VARCHAR(100)',notNull:true},
        {name:'description',type:'TEXT'},
        {name:'subscribers_count',type:'BIGINT',default:'0'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ]},
      {name:'videos',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'channel_id',type:'UUID',notNull:true,fk:{table:'channels',field:'id'}},
        {name:'title',type:'VARCHAR(255)',notNull:true},
        {name:'description',type:'TEXT'},
        {name:'duration_sec',type:'INTEGER'},
        {name:'status',type:'VARCHAR(20)',default:"'processing'"},
        {name:'views_count',type:'BIGINT',default:'0'},
        {name:'likes_count',type:'BIGINT',default:'0'},
        {name:'published_at',type:'TIMESTAMP'},
      ],indexes:['CREATE INDEX idx_videos_channel ON videos(channel_id)','CREATE INDEX idx_videos_status ON videos(status)']},
    ]}
  },
  {
    id:'comments_mongodb',name:{ru:'Комментарии (видео/посты)',en:'Comments (video/posts)'},type:'mongodb',
    schema:{collections:[
      {name:'comments',fields:[
        {name:'_id',type:'ObjectId',pk:true},
        {name:'target_id',type:'ObjectId'},
        {name:'target_type',type:'String'},
        {name:'author_id',type:'ObjectId'},
        {name:'text',type:'String'},
        {name:'likes_count',type:'Number',default:'0'},
        {name:'parent_id',type:'ObjectId'},
        {name:'created_at',type:'Date'},
      ],indexes:['db.comments.createIndex({target_id:1,created_at:-1})','db.comments.createIndex({author_id:1})']},
    ]}
  },
  {
    id:'crawler_postgres',name:{ru:'Краулер: очередь и статус URL',en:'Crawler: URL queue & status'},type:'postgresql',
    schema:{tables:[
      {name:'urls',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'url',type:'TEXT',unique:true,notNull:true},
        {name:'domain',type:'VARCHAR(255)'},
        {name:'last_crawled_at',type:'TIMESTAMP'},
        {name:'status',type:'VARCHAR(20)',default:"'new'"},
        {name:'content_hash',type:'VARCHAR(64)'},
        {name:'priority',type:'SMALLINT',default:'0'},
      ],indexes:['CREATE INDEX idx_urls_domain ON urls(domain)','CREATE INDEX idx_urls_status ON urls(status)']},
      {name:'crawl_queue',fields:[
        {name:'id',type:'BIGSERIAL',pk:true},
        {name:'url_id',type:'UUID',notNull:true,fk:{table:'urls',field:'id'}},
        {name:'scheduled_at',type:'TIMESTAMP',default:'NOW()'},
        {name:'attempts',type:'INTEGER',default:'0'},
        {name:'locked_by',type:'VARCHAR(100)'},
      ],indexes:['CREATE INDEX idx_queue_scheduled ON crawl_queue(scheduled_at)']},
    ]}
  },
  {
    id:'todo_postgres',name:{ru:'Задачи и списки',en:'Tasks & lists'},type:'postgresql',
    schema:{tables:[
      {name:'task_lists',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'owner_id',type:'UUID',notNull:true},
        {name:'name',type:'VARCHAR(255)',notNull:true},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ]},
      {name:'tasks',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'list_id',type:'UUID',notNull:true,fk:{table:'task_lists',field:'id',onDelete:'CASCADE'}},
        {name:'title',type:'VARCHAR(500)',notNull:true},
        {name:'description',type:'TEXT'},
        {name:'is_done',type:'BOOLEAN',default:'false'},
        {name:'due_date',type:'TIMESTAMP'},
        {name:'priority',type:'SMALLINT',default:'0'},
        {name:'assignee_id',type:'UUID'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
        {name:'completed_at',type:'TIMESTAMP'},
      ],indexes:['CREATE INDEX idx_tasks_list ON tasks(list_id)','CREATE INDEX idx_tasks_due ON tasks(due_date) WHERE NOT is_done']},
      {name:'list_members',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'list_id',type:'UUID',notNull:true,fk:{table:'task_lists',field:'id',onDelete:'CASCADE'}},
        {name:'user_id',type:'UUID',notNull:true},
        {name:'role',type:'VARCHAR(20)',default:"'editor'"},
      ],indexes:['CREATE UNIQUE INDEX idx_listmembers ON list_members(list_id,user_id)']},
    ]}
  },
  {
    id:'trips_postgres',name:{ru:'Поездки (такси)',en:'Trips (taxi)'},type:'postgresql',
    schema:{tables:[
      {name:'trips',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'rider_id',type:'UUID',notNull:true},
        {name:'driver_id',type:'UUID'},
        {name:'pickup_lat',type:'DOUBLE PRECISION'},
        {name:'pickup_lng',type:'DOUBLE PRECISION'},
        {name:'dropoff_lat',type:'DOUBLE PRECISION'},
        {name:'dropoff_lng',type:'DOUBLE PRECISION'},
        {name:'status',type:'VARCHAR(20)',default:"'requested'"},
        {name:'fare_amount',type:'DECIMAL(10,2)'},
        {name:'distance_km',type:'DECIMAL(6,2)'},
        {name:'requested_at',type:'TIMESTAMP',default:'NOW()'},
        {name:'completed_at',type:'TIMESTAMP'},
      ],indexes:['CREATE INDEX idx_trips_rider ON trips(rider_id)','CREATE INDEX idx_trips_driver ON trips(driver_id)','CREATE INDEX idx_trips_status ON trips(status)']},
      {name:'trip_status_history',fields:[
        {name:'id',type:'BIGSERIAL',pk:true},
        {name:'trip_id',type:'UUID',notNull:true,fk:{table:'trips',field:'id',onDelete:'CASCADE'}},
        {name:'status',type:'VARCHAR(20)',notNull:true},
        {name:'changed_at',type:'TIMESTAMP',default:'NOW()'},
      ]},
    ]}
  },
  {
    id:'social_graph_postgres',name:{ru:'Соцграф (подписки)',en:'Social graph (follows)'},type:'postgresql',
    schema:{tables:[
      {name:'users',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'username',type:'VARCHAR(50)',unique:true,notNull:true},
        {name:'display_name',type:'VARCHAR(100)'},
        {name:'bio',type:'TEXT'},
        {name:'followers_count',type:'BIGINT',default:'0'},
        {name:'following_count',type:'BIGINT',default:'0'},
        {name:'is_private',type:'BOOLEAN',default:'false'},
      ]},
      {name:'follows',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'follower_id',type:'UUID',notNull:true,fk:{table:'users',field:'id'}},
        {name:'followee_id',type:'UUID',notNull:true,fk:{table:'users',field:'id'}},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE UNIQUE INDEX idx_follows_pair ON follows(follower_id,followee_id)','CREATE INDEX idx_follows_followee ON follows(followee_id)']},
    ]}
  },
  {
    id:'posts_mongodb',name:{ru:'Публикации (соцсеть)',en:'Posts (social network)'},type:'mongodb',
    schema:{collections:[
      {name:'posts',fields:[
        {name:'_id',type:'ObjectId',pk:true},
        {name:'author_id',type:'ObjectId'},
        {name:'caption',type:'String'},
        {name:'media',type:'Array<String>'},
        {name:'likes_count',type:'Number',default:'0'},
        {name:'comments_count',type:'Number',default:'0'},
        {name:'hashtags',type:'Array<String>'},
        {name:'created_at',type:'Date'},
      ],indexes:['db.posts.createIndex({author_id:1,created_at:-1})','db.posts.createIndex({hashtags:1})']},
    ]}
  },
  {
    id:'feed_cassandra',name:{ru:'Лента (fan-out on write)',en:'Feed (fan-out on write)'},type:'cassandra',
    schema:{tables:[
      {name:'user_feed',fields:[
        {name:'user_id',type:'UUID',pk:true},
        {name:'post_id',type:'TIMEUUID',pk:'clustering'},
        {name:'author_id',type:'UUID'},
        {name:'cached_caption',type:'TEXT'},
        {name:'media_url',type:'TEXT'},
      ],cqlExtra:'WITH CLUSTERING ORDER BY (post_id DESC)'},
    ]}
  },
  {
    id:'restaurants_postgres',name:{ru:'Рестораны и меню',en:'Restaurants & menus'},type:'postgresql',
    schema:{tables:[
      {name:'restaurants',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'name',type:'VARCHAR(255)',notNull:true},
        {name:'cuisine_type',type:'VARCHAR(50)'},
        {name:'address',type:'TEXT'},
        {name:'rating',type:'DECIMAL(3,2)',default:'0'},
        {name:'is_open',type:'BOOLEAN',default:'true'},
        {name:'avg_cook_time_min',type:'INTEGER',default:'20'},
      ],indexes:['CREATE INDEX idx_restaurants_cuisine ON restaurants(cuisine_type)']},
      {name:'menu_items',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'restaurant_id',type:'UUID',notNull:true,fk:{table:'restaurants',field:'id',onDelete:'CASCADE'}},
        {name:'name',type:'VARCHAR(255)',notNull:true},
        {name:'price',type:'DECIMAL(10,2)',notNull:true},
        {name:'category',type:'VARCHAR(50)'},
        {name:'is_available',type:'BOOLEAN',default:'true'},
      ],indexes:['CREATE INDEX idx_menu_restaurant ON menu_items(restaurant_id)']},
    ]}
  },
  {
    id:'food_orders_postgres',name:{ru:'Заказы еды и доставка',en:'Food orders & delivery'},type:'postgresql',
    schema:{tables:[
      {name:'orders',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'customer_id',type:'UUID',notNull:true},
        {name:'restaurant_id',type:'UUID',notNull:true},
        {name:'courier_id',type:'UUID'},
        {name:'status',type:'VARCHAR(20)',default:"'placed'"},
        {name:'total_amount',type:'DECIMAL(10,2)',notNull:true},
        {name:'delivery_address',type:'TEXT',notNull:true},
        {name:'eta_minutes',type:'INTEGER'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_forders_customer ON orders(customer_id)','CREATE INDEX idx_forders_courier ON orders(courier_id)','CREATE INDEX idx_forders_status ON orders(status)']},
      {name:'order_items',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'order_id',type:'UUID',notNull:true,fk:{table:'orders',field:'id',onDelete:'CASCADE'}},
        {name:'menu_item_id',type:'UUID',notNull:true},
        {name:'quantity',type:'INTEGER',default:'1'},
        {name:'price',type:'DECIMAL(10,2)',notNull:true},
      ]},
    ]}
  },
  {
    id:'carsharing_postgres',name:{ru:'Каршеринг: автомобили и аренды',en:'Carsharing: cars & rentals'},type:'postgresql',
    schema:{tables:[
      {name:'cars',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'plate_number',type:'VARCHAR(20)',unique:true,notNull:true},
        {name:'model',type:'VARCHAR(100)'},
        {name:'status',type:'VARCHAR(20)',default:"'available'"},
        {name:'fuel_level',type:'SMALLINT',default:'100'},
        {name:'lat',type:'DOUBLE PRECISION'},
        {name:'lng',type:'DOUBLE PRECISION'},
        {name:'price_per_min',type:'DECIMAL(6,2)',default:'9.00'},
      ],indexes:['CREATE INDEX idx_cars_status ON cars(status)']},
      {name:'rentals',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'user_id',type:'UUID',notNull:true},
        {name:'car_id',type:'UUID',notNull:true,fk:{table:'cars',field:'id'}},
        {name:'started_at',type:'TIMESTAMP',default:'NOW()'},
        {name:'ended_at',type:'TIMESTAMP'},
        {name:'distance_km',type:'DECIMAL(8,2)'},
        {name:'total_cost',type:'DECIMAL(10,2)'},
        {name:'status',type:'VARCHAR(20)',default:"'active'"},
      ],indexes:['CREATE INDEX idx_rentals_user ON rentals(user_id)','CREATE INDEX idx_rentals_car ON rentals(car_id)']},
    ]}
  },
  {
    id:'music_catalog_postgres',name:{ru:'Музыкальный каталог',en:'Music catalog'},type:'postgresql',
    schema:{tables:[
      {name:'artists',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'name',type:'VARCHAR(255)',notNull:true},
        {name:'monthly_listeners',type:'BIGINT',default:'0'},
      ]},
      {name:'albums',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'artist_id',type:'UUID',notNull:true,fk:{table:'artists',field:'id'}},
        {name:'title',type:'VARCHAR(255)',notNull:true},
        {name:'released_at',type:'DATE'},
      ]},
      {name:'tracks',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'album_id',type:'UUID',notNull:true,fk:{table:'albums',field:'id',onDelete:'CASCADE'}},
        {name:'title',type:'VARCHAR(255)',notNull:true},
        {name:'duration_sec',type:'INTEGER'},
        {name:'plays_count',type:'BIGINT',default:'0'},
        {name:'audio_url',type:'TEXT'},
      ],indexes:['CREATE INDEX idx_tracks_album ON tracks(album_id)']},
    ]}
  },
  {
    id:'playlists_mongodb',name:{ru:'Плейлисты',en:'Playlists'},type:'mongodb',
    schema:{collections:[
      {name:'playlists',fields:[
        {name:'_id',type:'ObjectId',pk:true},
        {name:'owner_id',type:'ObjectId'},
        {name:'name',type:'String'},
        {name:'track_ids',type:'Array<ObjectId>'},
        {name:'is_public',type:'Boolean',default:'true'},
        {name:'followers_count',type:'Number',default:'0'},
        {name:'created_at',type:'Date'},
      ],indexes:['db.playlists.createIndex({owner_id:1})']},
    ]}
  },
  {
    id:'vod_postgres',name:{ru:'Видео по запросу (фильмы/сериалы)',en:'Video on demand (movies/series)'},type:'postgresql',
    schema:{tables:[
      {name:'titles',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'name',type:'VARCHAR(255)',notNull:true},
        {name:'type',type:'VARCHAR(20)',default:"'movie'"},
        {name:'genre',type:'VARCHAR(50)'},
        {name:'release_year',type:'SMALLINT'},
        {name:'rating',type:'DECIMAL(3,1)'},
        {name:'duration_min',type:'INTEGER'},
      ],indexes:['CREATE INDEX idx_titles_genre ON titles(genre)']},
      {name:'episodes',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'title_id',type:'UUID',notNull:true,fk:{table:'titles',field:'id',onDelete:'CASCADE'}},
        {name:'season',type:'SMALLINT'},
        {name:'episode_number',type:'SMALLINT'},
        {name:'duration_min',type:'INTEGER'},
        {name:'video_url',type:'TEXT'},
      ],indexes:['CREATE INDEX idx_episodes_title ON episodes(title_id)']},
    ]}
  },
  {
    id:'watch_progress_redis',name:{ru:'Продолжить просмотр (Redis)',en:'Continue watching (Redis)'},type:'redis',
    schema:{keys:[
      {pattern:'progress:{user_id}:{titleId}',type:'STRING',fields:['position_sec'],ttl:'90 days',note:'Обновляется каждые ~10 сек плеера'},
      {pattern:'continue_watching:{user_id}',type:'ZSET',fields:['titleId → last_watched_at'],ttl:'90 days'},
    ]}
  },
  {
    id:'dating_profiles_postgres',name:{ru:'Анкеты знакомств',en:'Dating profiles'},type:'postgresql',
    schema:{tables:[
      {name:'profiles',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'user_id',type:'UUID',unique:true,notNull:true},
        {name:'display_name',type:'VARCHAR(100)'},
        {name:'age',type:'SMALLINT'},
        {name:'bio',type:'TEXT'},
        {name:'photos',type:'TEXT[]'},
        {name:'lat',type:'DOUBLE PRECISION'},
        {name:'lng',type:'DOUBLE PRECISION'},
        {name:'gender',type:'VARCHAR(20)'},
        {name:'looking_for',type:'VARCHAR(20)'},
      ],indexes:['CREATE INDEX idx_dating_geo ON profiles(lat,lng)']},
      {name:'matches',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'user1_id',type:'UUID',notNull:true},
        {name:'user2_id',type:'UUID',notNull:true},
        {name:'matched_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE UNIQUE INDEX idx_matches_pair ON matches(user1_id,user2_id)']},
    ]}
  },
  {
    id:'swipes_cassandra',name:{ru:'Свайпы (Cassandra)',en:'Swipes (Cassandra)'},type:'cassandra',
    schema:{tables:[
      {name:'swipes',fields:[
        {name:'user_id',type:'UUID',pk:true},
        {name:'swiped_at',type:'TIMEUUID',pk:'clustering'},
        {name:'target_id',type:'UUID'},
        {name:'direction',type:'TEXT'},
      ],cqlExtra:'WITH CLUSTERING ORDER BY (swiped_at DESC)'},
    ]}
  },
  {
    id:'wallets_postgres',name:{ru:'Криптокошельки',en:'Crypto wallets'},type:'postgresql',
    schema:{tables:[
      {name:'wallets',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'user_id',type:'UUID',notNull:true},
        {name:'currency',type:'VARCHAR(10)',notNull:true},
        {name:'balance',type:'DECIMAL(24,8)',default:'0'},
        {name:'address',type:'VARCHAR(128)',unique:true},
      ],indexes:['CREATE INDEX idx_wallets_user ON wallets(user_id)']},
      {name:'wallet_transactions',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'wallet_id',type:'UUID',notNull:true,fk:{table:'wallets',field:'id'}},
        {name:'type',type:'VARCHAR(20)'},
        {name:'amount',type:'DECIMAL(24,8)',notNull:true},
        {name:'tx_hash',type:'VARCHAR(128)'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_wtx_wallet ON wallet_transactions(wallet_id)']},
    ]}
  },
  {
    id:'trading_postgres',name:{ru:'Биржевые ордера и сделки',en:'Exchange orders & trades'},type:'postgresql',
    schema:{tables:[
      {name:'orders',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'user_id',type:'UUID',notNull:true},
        {name:'pair',type:'VARCHAR(20)',notNull:true},
        {name:'side',type:'VARCHAR(4)',notNull:true},
        {name:'price',type:'DECIMAL(24,8)',notNull:true},
        {name:'quantity',type:'DECIMAL(24,8)',notNull:true},
        {name:'filled_quantity',type:'DECIMAL(24,8)',default:'0'},
        {name:'status',type:'VARCHAR(20)',default:"'open'"},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_torders_pair ON orders(pair,status)','CREATE INDEX idx_torders_user ON orders(user_id)']},
      {name:'trades',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'buy_order_id',type:'UUID',notNull:true,fk:{table:'orders',field:'id'}},
        {name:'sell_order_id',type:'UUID',notNull:true,fk:{table:'orders',field:'id'}},
        {name:'price',type:'DECIMAL(24,8)',notNull:true},
        {name:'quantity',type:'DECIMAL(24,8)',notNull:true},
        {name:'executed_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_trades_time ON trades(executed_at DESC)']},
    ]}
  },
  {
    id:'orderbook_redis',name:{ru:'Стакан заявок (Redis)',en:'Order book (Redis)'},type:'redis',
    schema:{keys:[
      {pattern:'orderbook:{pair}:bids',type:'ZSET',fields:['orderId → price'],ttl:'never',note:'Отсортированные заявки на покупку'},
      {pattern:'orderbook:{pair}:asks',type:'ZSET',fields:['orderId → price'],ttl:'never',note:'Отсортированные заявки на продажу'},
      {pattern:'ticker:{pair}',type:'HASH',fields:['last_price','24h_volume','24h_change'],ttl:'never'},
    ]}
  },
  {
    id:'courses_postgres',name:{ru:'Курсы и зачисления',en:'Courses & enrollments'},type:'postgresql',
    schema:{tables:[
      {name:'courses',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'title',type:'VARCHAR(255)',notNull:true},
        {name:'instructor_id',type:'UUID',notNull:true},
        {name:'description',type:'TEXT'},
        {name:'price',type:'DECIMAL(10,2)',default:'0'},
        {name:'category',type:'VARCHAR(50)'},
      ],indexes:['CREATE INDEX idx_courses_category ON courses(category)']},
      {name:'lessons',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'course_id',type:'UUID',notNull:true,fk:{table:'courses',field:'id',onDelete:'CASCADE'}},
        {name:'title',type:'VARCHAR(255)',notNull:true},
        {name:'order_index',type:'SMALLINT'},
        {name:'video_url',type:'TEXT'},
      ],indexes:['CREATE INDEX idx_lessons_course ON lessons(course_id)']},
      {name:'enrollments',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'user_id',type:'UUID',notNull:true},
        {name:'course_id',type:'UUID',notNull:true,fk:{table:'courses',field:'id'}},
        {name:'progress_pct',type:'SMALLINT',default:'0'},
        {name:'completed_at',type:'TIMESTAMP'},
        {name:'certificate_url',type:'TEXT'},
      ],indexes:['CREATE UNIQUE INDEX idx_enroll_pair ON enrollments(user_id,course_id)']},
    ]}
  },
  {
    id:'lesson_progress_mongodb',name:{ru:'Прогресс по урокам/тестам',en:'Lesson/quiz progress'},type:'mongodb',
    schema:{collections:[
      {name:'lesson_progress',fields:[
        {name:'_id',type:'ObjectId',pk:true},
        {name:'user_id',type:'ObjectId'},
        {name:'lesson_id',type:'ObjectId'},
        {name:'watched_sec',type:'Number'},
        {name:'quiz_answers',type:'Object'},
        {name:'quiz_score',type:'Number'},
        {name:'completed',type:'Boolean',default:'false'},
        {name:'updated_at',type:'Date'},
      ],indexes:['db.lesson_progress.createIndex({user_id:1,lesson_id:1},{unique:true})']},
    ]}
  },
  {
    id:'workouts_postgres',name:{ru:'Тренировки',en:'Workouts'},type:'postgresql',
    schema:{tables:[
      {name:'workouts',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'user_id',type:'UUID',notNull:true},
        {name:'type',type:'VARCHAR(30)'},
        {name:'distance_km',type:'DECIMAL(6,2)'},
        {name:'duration_sec',type:'INTEGER'},
        {name:'calories',type:'INTEGER'},
        {name:'avg_pace',type:'DECIMAL(5,2)'},
        {name:'started_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_workouts_user ON workouts(user_id,started_at DESC)']},
    ]}
  },
  {
    id:'workout_routes_cassandra',name:{ru:'GPS-трек тренировки (Cassandra)',en:'GPS workout track (Cassandra)'},type:'cassandra',
    schema:{tables:[
      {name:'route_points',fields:[
        {name:'workout_id',type:'UUID',pk:true},
        {name:'recorded_at',type:'TIMEUUID',pk:'clustering'},
        {name:'lat',type:'DOUBLE'},
        {name:'lng',type:'DOUBLE'},
        {name:'elevation',type:'FLOAT'},
        {name:'pace',type:'FLOAT'},
      ],cqlExtra:'WITH CLUSTERING ORDER BY (recorded_at ASC)'},
    ]}
  },
  {
    id:'hotels_postgres',name:{ru:'Отели и номера',en:'Hotels & rooms'},type:'postgresql',
    schema:{tables:[
      {name:'hotels',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'name',type:'VARCHAR(255)',notNull:true},
        {name:'city',type:'VARCHAR(100)'},
        {name:'star_rating',type:'SMALLINT'},
        {name:'amenities',type:'TEXT[]'},
      ],indexes:['CREATE INDEX idx_hotels_city ON hotels(city)']},
      {name:'rooms',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'hotel_id',type:'UUID',notNull:true,fk:{table:'hotels',field:'id',onDelete:'CASCADE'}},
        {name:'room_type',type:'VARCHAR(50)'},
        {name:'price_per_night',type:'DECIMAL(10,2)',notNull:true},
        {name:'capacity',type:'SMALLINT',default:'2'},
      ],indexes:['CREATE INDEX idx_rooms_hotel ON rooms(hotel_id)']},
    ]}
  },
  {
    id:'cloud_files_postgres',name:{ru:'Облачное хранилище: файлы и доступ',en:'Cloud storage: files & access'},type:'postgresql',
    schema:{tables:[
      {name:'files',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'owner_id',type:'UUID',notNull:true},
        {name:'parent_id',type:'UUID'},
        {name:'name',type:'VARCHAR(500)',notNull:true},
        {name:'is_folder',type:'BOOLEAN',default:'false'},
        {name:'size_bytes',type:'BIGINT',default:'0'},
        {name:'mime_type',type:'VARCHAR(100)'},
        {name:'version',type:'INTEGER',default:'1'},
        {name:'storage_key',type:'TEXT'},
        {name:'updated_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_cfiles_owner ON files(owner_id)','CREATE INDEX idx_cfiles_parent ON files(parent_id)']},
      {name:'shares',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'file_id',type:'UUID',notNull:true,fk:{table:'files',field:'id',onDelete:'CASCADE'}},
        {name:'shared_with_user_id',type:'UUID',notNull:true},
        {name:'permission',type:'VARCHAR(20)',default:"'view'"},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_shares_file ON shares(file_id)','CREATE INDEX idx_shares_user ON shares(shared_with_user_id)']},
    ]}
  },
  {
    id:'refunds_postgres',name:{ru:'Возвраты и рефанды',en:'Refunds'},type:'postgresql',
    schema:{tables:[
      {name:'refunds',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'payment_id',type:'UUID',notNull:true},
        {name:'amount',type:'DECIMAL(12,2)',notNull:true},
        {name:'reason',type:'VARCHAR(255)'},
        {name:'status',type:'VARCHAR(20)',default:"'pending'"},
        {name:'refunded_at',type:'TIMESTAMP'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_refunds_payment ON refunds(payment_id)','CREATE INDEX idx_refunds_status ON refunds(status)']},
    ]}
  },
  {
    id:'invoicing_postgres',name:{ru:'Инвойсы и счета',en:'Invoicing'},type:'postgresql',
    schema:{tables:[
      {name:'invoices',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'customer_id',type:'UUID',notNull:true},
        {name:'number',type:'VARCHAR(30)',unique:true},
        {name:'amount',type:'DECIMAL(12,2)',notNull:true},
        {name:'currency',type:'CHAR(3)',default:"'RUB'"},
        {name:'status',type:'VARCHAR(20)',default:"'draft'"},
        {name:'due_date',type:'DATE'},
        {name:'paid_at',type:'TIMESTAMP'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_invoices_customer ON invoices(customer_id)','CREATE UNIQUE INDEX idx_invoices_number ON invoices(number)']},
      {name:'invoice_items',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'invoice_id',type:'UUID',notNull:true,fk:{table:'invoices',field:'id',onDelete:'CASCADE'}},
        {name:'description',type:'TEXT'},
        {name:'quantity',type:'INTEGER',default:'1'},
        {name:'unit_price',type:'DECIMAL(10,2)',notNull:true},
      ]},
    ]}
  },
  {
    id:'metrics_clickhouse',name:{ru:'Метрики (ClickHouse)',en:'Metrics (ClickHouse)'},type:'clickhouse',
    schema:{tables:[
      {name:'metrics',fields:[
        {name:'metric_name',type:'LowCardinality(String)'},
        {name:'ts',type:'DateTime'},
        {name:'value',type:'Float64'},
        {name:'tags',type:'String'},
      ],engine:'ENGINE = MergeTree() ORDER BY (metric_name, ts)'},
    ]}
  },
  {
    id:'tracing_cassandra',name:{ru:'Трейсинг запросов (Cassandra)',en:'Request tracing (Cassandra)'},type:'cassandra',
    schema:{tables:[
      {name:'spans',fields:[
        {name:'trace_id',type:'UUID',pk:true},
        {name:'span_id',type:'TIMEUUID',pk:'clustering'},
        {name:'parent_span_id',type:'UUID'},
        {name:'service',type:'TEXT'},
        {name:'operation',type:'TEXT'},
        {name:'duration_ms',type:'INT'},
        {name:'start_time',type:'TIMESTAMP'},
      ],cqlExtra:'WITH CLUSTERING ORDER BY (span_id ASC)'},
    ]}
  },
  {
    id:'webhooks_postgres',name:{ru:'Вебхуки (подписки и доставки)',en:'Webhooks (subscriptions & deliveries)'},type:'postgresql',
    schema:{tables:[
      {name:'webhook_subscriptions',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'url',type:'TEXT',notNull:true},
        {name:'event_types',type:'TEXT[]'},
        {name:'secret',type:'VARCHAR(64)'},
        {name:'is_active',type:'BOOLEAN',default:'true'},
      ]},
      {name:'webhook_deliveries',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'subscription_id',type:'UUID',notNull:true,fk:{table:'webhook_subscriptions',field:'id',onDelete:'CASCADE'}},
        {name:'payload',type:'JSONB'},
        {name:'status',type:'VARCHAR(20)',default:"'pending'"},
        {name:'attempts',type:'INTEGER',default:'0'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_wdeliveries_sub ON webhook_deliveries(subscription_id)']},
    ]}
  },
  {
    id:'apikeys_postgres',name:{ru:'API-ключи',en:'API keys'},type:'postgresql',
    schema:{tables:[
      {name:'api_keys',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'key_hash',type:'VARCHAR(255)',unique:true,notNull:true},
        {name:'owner_id',type:'UUID',notNull:true},
        {name:'scopes',type:'TEXT[]'},
        {name:'rate_limit',type:'INTEGER',default:'1000'},
        {name:'expires_at',type:'TIMESTAMP'},
        {name:'revoked_at',type:'TIMESTAMP'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE INDEX idx_apikeys_owner ON api_keys(owner_id)']},
    ]}
  },
  {
    id:'experiments_postgres',name:{ru:'A/B-эксперименты',en:'A/B experiments'},type:'postgresql',
    schema:{tables:[
      {name:'experiments',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'name',type:'VARCHAR(100)',unique:true},
        {name:'variants',type:'TEXT[]'},
        {name:'status',type:'VARCHAR(20)',default:"'running'"},
        {name:'started_at',type:'TIMESTAMP',default:'NOW()'},
      ]},
      {name:'assignments',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'experiment_id',type:'UUID',notNull:true,fk:{table:'experiments',field:'id'}},
        {name:'user_id',type:'UUID',notNull:true},
        {name:'variant',type:'VARCHAR(50)'},
        {name:'assigned_at',type:'TIMESTAMP',default:'NOW()'},
      ],indexes:['CREATE UNIQUE INDEX idx_assignments_pair ON assignments(experiment_id,user_id)']},
    ]}
  },
  {
    id:'imports_postgres',name:{ru:'Импорт/экспорт: задачи',en:'Import/export jobs'},type:'postgresql',
    schema:{tables:[
      {name:'import_jobs',fields:[
        {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
        {name:'file_url',type:'TEXT',notNull:true},
        {name:'status',type:'VARCHAR(20)',default:"'pending'"},
        {name:'rows_total',type:'INTEGER'},
        {name:'rows_processed',type:'INTEGER',default:'0'},
        {name:'errors_count',type:'INTEGER',default:'0'},
        {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
        {name:'finished_at',type:'TIMESTAMP'},
      ],indexes:['CREATE INDEX idx_importjobs_status ON import_jobs(status)']},
    ]}
  },
  {
    id:'otp_redis',name:{ru:'Коды OTP (Redis)',en:'OTP codes (Redis)'},type:'redis',
    schema:{keys:[
      {pattern:'otp:{phone}:{purpose}',type:'STRING',fields:['6-значный код'],ttl:'5 min'},
      {pattern:'otp_attempts:{phone}',type:'STRING',fields:['integer counter'],ttl:'15 min',note:'Защита от подбора'},
    ]}
  },
  {
    id:'revenue_clickhouse',name:{ru:'Выручка по дням (ClickHouse, SummingMergeTree)',en:'Daily revenue (ClickHouse, SummingMergeTree)'},type:'clickhouse',
    schema:{tables:[
      {name:'revenue_daily',fields:[
        {name:'day',type:'Date'},
        {name:'shop_id',type:'UInt32'},
        {name:'currency',type:'LowCardinality(String)'},
        {name:'orders',type:'UInt64'},
        {name:'amount',type:'Decimal(18,2)'},
      ],engine:'ENGINE = SummingMergeTree((orders, amount)) PARTITION BY toYYYYMM(day) ORDER BY (shop_id, day, currency)'},
    ]}
  },
  // ── MySQL ──────────────────────────────────────────────────
  {
    id:'shop_mysql',name:{ru:'Интернет-магазин (MySQL)',en:'Web shop (MySQL)'},type:'mysql',
    desc:{ru:'InnoDB: кластерный индекс по PK, вторичные индексы, внешние ключи',en:'InnoDB: clustered PK index, secondary indexes, foreign keys'},
    schema:{tables:[
      {name:'customers',fields:[
        {name:'id',type:'BIGINT UNSIGNED',pk:true},
        {name:'email',type:'VARCHAR(255)',unique:true,notNull:true},
        {name:'full_name',type:'VARCHAR(200)'},
        {name:'created_at',type:'DATETIME',default:'CURRENT_TIMESTAMP'},
      ]},
      {name:'products',fields:[
        {name:'id',type:'BIGINT UNSIGNED',pk:true},
        {name:'sku',type:'VARCHAR(64)',unique:true,notNull:true},
        {name:'title',type:'VARCHAR(255)',notNull:true},
        {name:'price',type:'DECIMAL(10,2)',notNull:true},
        {name:'stock',type:'INT',default:'0'},
      ],indexes:['CREATE INDEX idx_products_title ON products(title)']},
      {name:'orders',fields:[
        {name:'id',type:'BIGINT UNSIGNED',pk:true},
        {name:'customer_id',type:'BIGINT UNSIGNED',notNull:true,fk:{table:'customers',field:'id',onDelete:'RESTRICT'}},
        {name:'status',type:"ENUM('new','paid','shipped')",default:"'new'"},
        {name:'total',type:'DECIMAL(12,2)'},
        {name:'created_at',type:'DATETIME',default:'CURRENT_TIMESTAMP'},
      ],indexes:['CREATE INDEX idx_orders_customer ON orders(customer_id, created_at)']},
      {name:'order_items',fields:[
        {name:'id',type:'BIGINT UNSIGNED',pk:true},
        {name:'order_id',type:'BIGINT UNSIGNED',notNull:true,fk:{table:'orders',field:'id',onDelete:'CASCADE'}},
        {name:'product_id',type:'BIGINT UNSIGNED',notNull:true,fk:{table:'products',field:'id'}},
        {name:'qty',type:'INT',default:'1'},
        {name:'price',type:'DECIMAL(10,2)'},
      ],indexes:['CREATE INDEX idx_items_order ON order_items(order_id)']},
    ]}
  },
  // ── Redis: структуры ZSET / STREAM / LIST ─────────────────
  {
    id:'leaderboard_redis',name:{ru:'Рейтинг игроков (Redis)',en:'Leaderboard (Redis)'},type:'redis',
    schema:{keys:[
      {pattern:'lb:{season}',type:'ZSET',fields:['member=user_id','score=points'],ttl:'90 days',note:'ZADD / ZREVRANGE 0 9 WITHSCORES'},
      {pattern:'player:{user_id}',type:'HASH',fields:['nick','avatar','level'],ttl:''},
      {pattern:'lb:{season}:online',type:'SET',fields:['user_id'],ttl:'1 hour'},
    ]}
  },
  {
    id:'events_stream_redis',name:{ru:'Поток событий и очередь (Redis)',en:'Event stream & queue (Redis)'},type:'redis',
    schema:{keys:[
      {pattern:'events:{tenant}',type:'STREAM',fields:['type','order_id','ts'],ttl:'',note:'XADD MAXLEN ~ 100000; consumer group «billing»'},
      {pattern:'jobs:email',type:'LIST',fields:['job json'],ttl:'',note:'LPUSH / BRPOP — простая очередь'},
      {pattern:'dedup:{event_id}',type:'STRING',fields:['1'],ttl:'24 hours',note:'SET NX EX — идемпотентность'},
    ]}
  },
  // ── Elasticsearch ──────────────────────────────────────────
  {
    id:'products_search_elasticsearch',name:{ru:'Поиск товаров (Elasticsearch)',en:'Product search (Elasticsearch)'},type:'elasticsearch',
    desc:{ru:'Полнотекстовый поиск: text-поля с анализатором, keyword-фасеты',en:'Full-text search: analyzed text fields, keyword facets'},
    schema:{tables:[
      {name:'products',kind:'index',fields:[
        {name:'sku',type:'keyword',pk:true},
        {name:'title',type:'text',analyzer:'standard'},
        {name:'description',type:'text',analyzer:'standard'},
        {name:'brand',type:'keyword'},
        {name:'category',type:'keyword'},
        {name:'price',type:'scaled_float'},
        {name:'in_stock',type:'boolean'},
        {name:'created_at',type:'date'},
      ],docs:[
        {sku:'A-1',title:'Red running shoes',brand:'Nike',category:'shoes',price:89},
        {sku:'A-2',title:'Blue running jacket',brand:'Adidas',category:'apparel',price:120},
        {sku:'A-3',title:'Red wool jacket',brand:'Nike',category:'apparel',price:150},
        {sku:'A-4',title:'Trail shoes waterproof',brand:'Salomon',category:'shoes',price:140},
      ]},
    ]}
  },
  {
    id:'logs_elasticsearch',name:{ru:'Логи сервисов (Elasticsearch)',en:'Service logs (Elasticsearch)'},type:'elasticsearch',
    desc:{ru:'Индекс на день (logs-YYYY.MM.DD), ILM: hot → warm → delete',en:'Daily index (logs-YYYY.MM.DD), ILM: hot → warm → delete'},
    schema:{tables:[
      {name:'logs-2026.11.04',kind:'index',fields:[
        {name:'@timestamp',type:'date'},
        {name:'service',type:'keyword'},
        {name:'level',type:'keyword'},
        {name:'message',type:'text',analyzer:'standard'},
        {name:'trace_id',type:'keyword'},
        {name:'latency_ms',type:'integer'},
      ],docs:[
        {service:'orders',level:'ERROR',message:'Payment timeout for order'},
        {service:'payments',level:'WARN',message:'Retry payment gateway'},
        {service:'orders',level:'INFO',message:'Order created'},
      ]},
    ]}
  },
  // ── S3 / объектное хранилище ───────────────────────────────
  {
    id:'media_s3',name:{ru:'Медиафайлы (S3)',en:'Media files (S3)'},type:'s3',
    desc:{ru:'Плоское пространство ключей: «папки» — это префиксы',en:'Flat keyspace: "folders" are just key prefixes'},
    schema:{tables:[
      {name:'media-uploads',kind:'bucket',fields:[
        {name:'avatars/{user_id}/orig.jpg',type:'image/jpeg',size:'~2 MB'},
        {name:'avatars/{user_id}/200x200.webp',type:'image/webp',size:'~20 KB'},
        {name:'videos/{video_id}/source.mp4',type:'video/mp4',size:'~1 GB'},
        {name:'videos/{video_id}/hls/720p/seg_{n}.ts',type:'video/mp2t',size:'~2 MB'},
      ],lifecycle:[{prefix:'videos/',after:'30d',to:'STANDARD_IA'},{prefix:'videos/',after:'180d',to:'GLACIER'}]},
      {name:'db-backups',kind:'bucket',fields:[
        {name:'pg/{date}/base.tar.gz',type:'application/gzip',size:'~50 GB'},
        {name:'pg/{date}/wal/{segment}',type:'application/octet-stream',size:'16 MB'},
      ],lifecycle:[{prefix:'pg/',after:'7d',to:'GLACIER'},{prefix:'pg/',after:'90d',to:'EXPIRE'}]},
    ]}
  },
];
