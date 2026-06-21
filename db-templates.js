// DB-TEMPLATES — 20 шаблонов баз данных с полными схемами

const DB_TEMPLATES = [
  {
    id:'auth_postgres',name:'Аутентификация и пользователи',type:'postgresql',
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
    id:'ecommerce_orders',name:'E-commerce: Заказы',type:'postgresql',
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
    id:'catalog_mongodb',name:'Каталог товаров',type:'mongodb',
    schema:{collections:[
      {name:'products',fields:[
        {name:'_id',type:'ObjectId',pk:true},
        {name:'sku',type:'String',unique:true},
        {name:'name',type:'String',notNull:true},
        {name:'description',type:'String'},
        {name:'price',type:'Decimal128'},
        {name:'category_id',type:'ObjectId'},
        {name:'attributes',type:'Object'},
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
    id:'cart_redis',name:'Корзина (Redis)',type:'redis',
    schema:{keys:[
      {pattern:'cart:{user_id}',type:'HASH',fields:['product_id → {qty, price}'],ttl:'7 days'},
      {pattern:'cart:{user_id}:count',type:'STRING',fields:['integer'],ttl:'7 days'},
      {pattern:'session:{session_id}',type:'HASH',fields:['user_id, cart_id, expires_at'],ttl:'30 days'},
    ]}
  },
  {
    id:'payment_postgres',name:'Финансы и платежи',type:'postgresql',
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
    id:'chat_mongodb',name:'Чат и сообщения',type:'mongodb',
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
    id:'booking_postgres',name:'Бронирование',type:'postgresql',
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
    id:'logs_cassandra',name:'Логи и события (Cassandra)',type:'cassandra',
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
    id:'analytics_clickhouse',name:'Аналитика (ClickHouse)',type:'clickhouse',
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
    id:'profile_postgres',name:'Профили пользователей',type:'postgresql',
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
    id:'notifications_postgres',name:'Уведомления',type:'postgresql',
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
    id:'geodata_postgres',name:'Геоданные и локации',type:'postgresql',
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
    id:'files_postgres',name:'Файлы и медиа',type:'postgresql',
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
    id:'audit_postgres',name:'Аудит и история изменений',type:'postgresql',
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
    id:'ratelimit_redis',name:'Rate Limiting (Redis)',type:'redis',
    schema:{keys:[
      {pattern:'rl:{ip}:{endpoint}:{minute}',type:'STRING',fields:['integer counter'],ttl:'60 sec',note:'INCR + EXPIRE'},
      {pattern:'rl:user:{user_id}:{hour}',type:'STRING',fields:['integer counter'],ttl:'3600 sec'},
      {pattern:'rl:token:{api_key}:{day}',type:'STRING',fields:['integer counter'],ttl:'86400 sec'},
      {pattern:'blocked:{ip}',type:'STRING',fields:['1'],ttl:'vary',note:'SET с коротким TTL'},
    ]}
  },
  {
    id:'sessions_redis',name:'Сессии (Redis)',type:'redis',
    schema:{keys:[
      {pattern:'sess:{session_id}',type:'HASH',fields:['user_id','roles','email','locale','created_at','ip'],ttl:'30 days'},
      {pattern:'user:sessions:{user_id}',type:'SET',fields:['session_id1','session_id2','...'],ttl:'never',note:'Список сессий пользователя'},
    ]}
  },
  {
    id:'iot_cassandra',name:'IoT / Временные ряды (Cassandra)',type:'cassandra',
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
    id:'mentorship_postgres',name:'Менторство: Цели и Привычки',type:'postgresql',
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
    id:'warehouse_postgres',name:'Склад и инвентарь',type:'postgresql',
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
    id:'subscriptions_postgres',name:'Подписки и биллинг',type:'postgresql',
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
    id:'reviews_postgres',name:'Отзывы и рейтинги',type:'postgresql',
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
    id:'promo_postgres',name:'Промокоды и скидки',type:'postgresql',
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
    id:'medical_postgres',name:'Медицина: Пациенты',type:'postgresql',
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
];

// RAPTOR v1.1.0
