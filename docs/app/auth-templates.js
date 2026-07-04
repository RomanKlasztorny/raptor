// AUTH-TEMPLATES — шаблоны авторизации: OAuth2+JWT, JWT-only, Session-based, API Key, OIDC/SSO

const AUTH_TEMPLATES = [
  {
    id:'oauth2_jwt',
    name:'OAuth 2.0 + JWT',
    desc:'Полноценный OAuth 2.0 с JWT access token и refresh token. Для сложных систем с внешними провайдерами.',
    flows:['/register','/login','/oauth/authorize','/oauth/token','/oauth/refresh','/oauth/revoke','/logout'],
    dbTemplate:{
      tables:[
        {name:'users',fields:[
          {name:'id',label:'ID',type:'UUID',constraints:'PK',default:'gen_random_uuid()',desc:'Идентификатор'},
          {name:'email',label:'Email',type:'VARCHAR(255)',constraints:'NN, UNIQUE',desc:'Почта из профиля провайдера',example:'user@gmail.com'},
          {name:'full_name',label:'Имя',type:'VARCHAR(150)',desc:'Из профиля провайдера'},
          {name:'avatar_url',label:'Аватар',type:'TEXT',desc:'Ссылка на аватар'},
          {name:'provider',label:'Провайдер',type:'VARCHAR(50)',constraints:'NN',desc:'google / github / vk — пароль НЕ хранится (делегирован)',example:'google'},
          {name:'provider_account_id',label:'ID у провайдера',type:'VARCHAR(255)',constraints:'NN',desc:'Идентификатор аккаунта на стороне провайдера'},
          {name:'created_at',label:'Создан',type:'TIMESTAMP',default:'NOW()'},
        ],indexes:['CREATE UNIQUE INDEX idx_users_provider ON users(provider, provider_account_id)']},
        {name:'oauth_clients',fields:[
          {name:'id',type:'UUID',pk:true},
          {name:'name',type:'VARCHAR(255)',notNull:true},
          {name:'client_id',type:'VARCHAR(100)',unique:true,notNull:true},
          {name:'client_secret_hash',type:'VARCHAR(255)',notNull:true},
          {name:'redirect_uris',type:'TEXT[]'},
          {name:'scopes',type:'TEXT[]'},
          {name:'is_active',type:'BOOLEAN',default:'true'},
        ],indexes:['CREATE INDEX idx_oauth_client_id ON oauth_clients(client_id)']},
        {name:'oauth_tokens',fields:[
          {name:'id',type:'UUID',pk:true},
          {name:'user_id',type:'UUID',fk:{table:'users',field:'id',onDelete:'CASCADE'}},
          {name:'client_id',type:'VARCHAR(100)',notNull:true},
          {name:'access_token_hash',type:'VARCHAR(255)',notNull:true},
          {name:'scope',type:'TEXT'},
          {name:'expires_at',type:'TIMESTAMP',notNull:true},
          {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
        ],indexes:['CREATE INDEX idx_oauth_token ON oauth_tokens(access_token_hash)']},
        {name:'refresh_tokens',fields:[
          {name:'id',type:'UUID',pk:true},
          {name:'user_id',type:'UUID',fk:{table:'users',field:'id',onDelete:'CASCADE'}},
          {name:'token_hash',type:'VARCHAR(255)',unique:true,notNull:true},
          {name:'scope',type:'TEXT'},
          {name:'expires_at',type:'TIMESTAMP',notNull:true},
          {name:'rotated_at',type:'TIMESTAMP'},
        ],indexes:['CREATE INDEX idx_refresh_token ON refresh_tokens(token_hash)','CREATE INDEX idx_refresh_user ON refresh_tokens(user_id)']},
      ]
    },
    seqExample:`actor Пользователь
participant Web
participant "API Gateway" as GW
participant "Auth Service" as Auth
participant PostgreSQL

Пользователь -> Web: Нажимает «Войти»
Web -> GW: // POST /api/v1/auth/login
GW -> Auth: Проверяет и маршрутизирует
Auth -> PostgreSQL: Запрашивает пользователя по email
PostgreSQL --> Auth: Отдаёт хэш пароля
alt Пароль неверный
  Auth --> GW: 401 Unauthorized
  GW --> Web: 401
  Web --> Пользователь: Показывает «Неверный пароль»
else Пароль верный
  Auth -> Auth: Генерирует JWT access_token (15мин) и refresh_token
  Auth -> PostgreSQL: Сохраняет refresh_token
  PostgreSQL --> Auth: OK
  Auth --> GW: 200 OK (access_token, refresh_token)
  GW --> Web: 200 OK
  Web --> Пользователь: Открывает личный кабинет
end`,
  },
  {
    id:'jwt_only',
    name:'JWT-only (без OAuth)',
    desc:'Простая JWT-аутентификация без OAuth. Для внутренних API и небольших систем.',
    flows:['/register','/login','/refresh','/logout','/me'],
    dbTemplate:{
      tables:[
        {name:'users',fields:[
          {name:'id',label:'ID',type:'UUID',constraints:'PK',default:'gen_random_uuid()',desc:'Идентификатор'},
          {name:'email',label:'Email',type:'VARCHAR(255)',constraints:'NN, UNIQUE',desc:'Логин пользователя',example:'user@mail.ru'},
          {name:'password_hash',label:'Хэш пароля',type:'VARCHAR(255)',constraints:'NN',desc:'hash(password + salt) — локальная аутентификация',example:'f5ab13043c1d...'},
          {name:'salt',label:'Соль',type:'VARCHAR(32)',constraints:'NN',desc:'Случайная строка к паролю (защита от радужных таблиц)',example:'dsg1x9q2'},
          {name:'role',label:'Роль',type:'VARCHAR(50)',default:"'user'",desc:'Роль доступа'},
          {name:'is_active',label:'Активен',type:'BOOLEAN',default:'true'},
          {name:'created_at',label:'Создан',type:'TIMESTAMP',default:'NOW()'},
          {name:'updated_at',label:'Обновлён',type:'TIMESTAMP',default:'NOW()'},
        ],indexes:['CREATE INDEX idx_users_email ON users(email)']},
        {name:'refresh_tokens',fields:[
          {name:'id',label:'ID',type:'UUID',constraints:'PK',default:'gen_random_uuid()'},
          {name:'user_id',label:'Пользователь',type:'UUID',constraints:'FK, NN',fk:{table:'users',field:'id',onDelete:'CASCADE'}},
          {name:'token_hash',label:'Хэш токена',type:'VARCHAR(255)',constraints:'NN, UNIQUE',desc:'Хэш refresh-токена'},
          {name:'user_agent',label:'Устройство',type:'TEXT',desc:'С какого устройства'},
          {name:'ip_address',label:'IP',type:'VARCHAR(45)'},
          {name:'expires_at',label:'Истекает',type:'TIMESTAMP',constraints:'NN'},
          {name:'created_at',label:'Создан',type:'TIMESTAMP',default:'NOW()'},
        ],indexes:['CREATE INDEX idx_rt_user ON refresh_tokens(user_id)','CREATE INDEX idx_rt_hash ON refresh_tokens(token_hash)']},
      ]
    },
    seqExample:`actor Пользователь
participant Web
participant "API Gateway" as GW
participant "Auth Service" as Auth
participant PostgreSQL

Пользователь -> Web: Регистрируется
Web -> GW: // POST /api/v1/auth/register
GW -> Auth: Проверяет и маршрутизирует
Auth -> PostgreSQL: Запрашивает существующего пользователя
alt Email уже занят
  PostgreSQL --> Auth: Отдаёт профиль
  Auth --> GW: 409 Conflict
  GW --> Web: 409
  Web --> Пользователь: Показывает «Email занят»
else Email свободен
  PostgreSQL --> Auth: Ничего нет
  Auth -> Auth: Хэширует пароль (bcrypt)
  Auth -> PostgreSQL: Сохраняет нового пользователя
  PostgreSQL --> Auth: OK
  Auth --> GW: 201 Created (access_token, refresh_token)
  GW --> Web: 201 Created
  Web --> Пользователь: Открывает онбординг
end`,
  },
  {
    id:'session_based',
    name:'Session-based (Cookie)',
    desc:'Классические сессии с куки. Для SSR-приложений (Next.js, Django, Rails).',
    flows:['/register','/login','/logout','/session/refresh'],
    dbTemplate:{
      tables:[
        {name:'users',fields:[
          {name:'id',label:'ID',type:'UUID',constraints:'PK',default:'gen_random_uuid()',desc:'Идентификатор'},
          {name:'email',label:'Email',type:'VARCHAR(255)',constraints:'NN, UNIQUE',desc:'Логин',example:'user@mail.ru'},
          {name:'password_hash',label:'Хэш пароля',type:'VARCHAR(255)',constraints:'NN',desc:'hash(password + salt)'},
          {name:'salt',label:'Соль',type:'VARCHAR(32)',constraints:'NN',desc:'Случайная строка к паролю'},
          {name:'created_at',label:'Создан',type:'TIMESTAMP',default:'NOW()'},
        ]},
        {name:'sessions',fields:[
          {name:'id',type:'UUID',pk:true,default:'gen_random_uuid()'},
          {name:'user_id',type:'UUID',fk:{table:'users',field:'id',onDelete:'CASCADE'}},
          {name:'session_token',type:'VARCHAR(255)',unique:true,notNull:true},
          {name:'ip_address',type:'VARCHAR(45)'},
          {name:'user_agent',type:'TEXT'},
          {name:'expires_at',type:'TIMESTAMP',notNull:true},
          {name:'created_at',type:'TIMESTAMP',default:'NOW()'},
          {name:'last_active_at',type:'TIMESTAMP',default:'NOW()'},
        ],indexes:['CREATE INDEX idx_sess_token ON sessions(session_token)','CREATE INDEX idx_sess_user ON sessions(user_id)','CREATE INDEX idx_sess_expires ON sessions(expires_at)']},
      ]
    },
    seqExample:`actor Пользователь
participant Browser
participant "Nginx / SSR" as SSR
participant "Auth Service" as Auth
participant PostgreSQL
participant Redis

Пользователь -> Browser: Заполняет форму входа
Browser -> SSR: // POST /login
SSR -> Auth: Проверяет учётные данные
Auth -> PostgreSQL: Запрашивает пользователя по email
PostgreSQL --> Auth: Отдаёт хэш пароля
Auth -> Auth: Сравнивает пароли
Auth -> PostgreSQL: Сохраняет сессию
PostgreSQL --> Auth: OK
Auth -> Redis: Кэширует сессию
Redis --> Auth: OK
Auth --> SSR: 200 OK (session_id)
SSR --> Browser: Set-Cookie: session=...; HttpOnly; Secure
Browser --> Пользователь: Открывает главную страницу`,
  },
  {
    id:'api_key',
    name:'API Key (B2B / машины)',
    desc:'Доступ по ключу для партнёров и сервис-интеграций (B2B). Ключ в заголовке X-API-Key, в БД хранится только хэш, проверка кэшируется.',
    flows:['/keys (выпуск)','/keys (список)','/keys/{id}/revoke'],
    dbTemplate:{
      tables:[
        {name:'api_clients',fields:[
          {name:'id',label:'ID',type:'UUID',constraints:'PK',default:'gen_random_uuid()',desc:'Идентификатор'},
          {name:'name',label:'Партнёр',type:'VARCHAR(255)',constraints:'NN',desc:'Компания-интегратор',example:'ООО «Интегратор»'},
          {name:'contact_email',label:'Email',type:'VARCHAR(255)',desc:'Контакт для уведомлений об истечении ключа'},
          {name:'is_active',label:'Активен',type:'BOOLEAN',default:'true',desc:'Блокировка партнёра целиком'},
          {name:'created_at',label:'Создан',type:'TIMESTAMP',default:'NOW()'},
        ]},
        {name:'api_keys',fields:[
          {name:'id',label:'ID',type:'UUID',constraints:'PK',default:'gen_random_uuid()'},
          {name:'client_id',label:'Клиент',type:'UUID',constraints:'FK, NN',fk:{table:'api_clients',field:'id',onDelete:'CASCADE'},desc:'Чей ключ'},
          {name:'key_hash',label:'Хэш ключа',type:'VARCHAR(255)',constraints:'NN, UNIQUE',desc:'Сам ключ показывается ОДИН раз при выпуске',example:'sha256:9f86d081...'},
          {name:'scopes',label:'Права',type:'TEXT[]',desc:'Какие API доступны ключу',example:'{orders:read, orders:write}'},
          {name:'rate_limit',label:'Лимит rps',type:'INT',default:'1000',desc:'Запросов в минуту на ключ'},
          {name:'expires_at',label:'Истекает',type:'TIMESTAMP',desc:'NULL = бессрочный'},
          {name:'last_used_at',label:'Последний вызов',type:'TIMESTAMP',desc:'Для аудита неиспользуемых ключей'},
        ],indexes:['CREATE INDEX idx_keys_hash ON api_keys(key_hash)','CREATE INDEX idx_keys_client ON api_keys(client_id)']},
      ]
    },
    seqExample:`participant "Партнёр (B2B)" as Client
participant "API Gateway" as GW
participant "Auth Service" as Auth
participant PostgreSQL
participant Redis
autonumber

Client -> GW: Вызывает API с ключом // GET /api/v1/orders + X-API-Key
GW -> Redis: Ключ в кэше?
alt Ключ в кэше (горячий путь)
  Redis --> GW: scopes + лимит OK
else Промах кэша
  Redis --> GW: MISS
  GW -> Auth: Проверяет ключ // POST /auth/keys/verify
  Auth -> PostgreSQL: Ищет по хэшу // SELECT * FROM api_keys WHERE key_hash = $1
  PostgreSQL --> Auth: Ключ активен, scopes
  Auth --> GW: 200 OK (scopes, rate_limit)
  GW -> Redis: Кэширует на 60 сек
end
GW --> Client: 200 OK (данные)`,
  },
  {
    id:'oidc_sso',
    name:'OIDC / SSO (корпоративный вход)',
    desc:'Вход через внешний Identity Provider (Keycloak, Azure AD, Google Workspace). Пароли НЕ хранятся — только связка identity↔IdP. Подписи токенов проверяются по JWKS-кэшу.',
    flows:['/auth/login (redirect)','/auth/callback','/logout','/userinfo'],
    dbTemplate:{
      tables:[
        {name:'identities',fields:[
          {name:'id',label:'ID',type:'UUID',constraints:'PK',default:'gen_random_uuid()',desc:'Идентификатор'},
          {name:'issuer',label:'IdP',type:'VARCHAR(255)',constraints:'NN',desc:'URL провайдера идентификации',example:'https://keycloak.corp/realms/main'},
          {name:'subject',label:'ID в IdP',type:'VARCHAR(255)',constraints:'NN',desc:'sub из id_token — пароль живёт у IdP'},
          {name:'email',label:'Email',type:'VARCHAR(255)',constraints:'NN',example:'ivanov@corp.ru'},
          {name:'display_name',label:'Имя',type:'VARCHAR(150)',desc:'Из профиля IdP'},
          {name:'groups',label:'Группы',type:'TEXT[]',desc:'Роли из IdP — маппятся в права системы',example:'{managers, analysts}'},
          {name:'first_login_at',label:'Первый вход',type:'TIMESTAMP',default:'NOW()',desc:'JIT-провижининг: запись создаётся при первом входе'},
          {name:'last_login_at',label:'Последний вход',type:'TIMESTAMP'},
        ],indexes:['CREATE UNIQUE INDEX idx_identity ON identities(issuer, subject)','CREATE INDEX idx_identity_email ON identities(email)']},
      ]
    },
    seqExample:`actor Сотрудник
participant Web
participant "Auth (OIDC)" as Auth
boundary "Keycloak / IdP" as IdP
participant PostgreSQL
autonumber

Сотрудник -> Web: Нажимает «Войти через SSO»
Web -> Auth: // GET /auth/login
Auth --> Web: 302 Redirect на IdP
Web -> IdP: Открывает корпоративную форму входа
Сотрудник -> IdP: Вводит доменные логин/пароль
IdP --> Web: 302 на /auth/callback?code=...
Web -> Auth: // GET /auth/callback?code=...
Auth -> IdP: Обменивает code на токены // POST /token
IdP --> Auth: id_token + access_token
Auth -> PostgreSQL: JIT: создаёт/обновляет identity // INSERT ... ON CONFLICT DO UPDATE
PostgreSQL --> Auth: OK
Auth --> Web: Выдаёт сессию/JWT — вход выполнен
Web --> Сотрудник: Открывает портал`,
  },
];

// ── Панель шаблонов авторизации ───────────────────────────────
function openAuthTemplates(){
  const existing=document.getElementById('auth-tmpl-modal');
  if(existing){existing.style.display='flex';return;}
  const ov=document.createElement('div');ov.id='auth-tmpl-modal';ov.className='modal-ov';
  ov.style.display='flex';
  ov.onclick=e=>{if(e.target===ov)ov.style.display='none';};
  ov.innerHTML=`
    <div class="modal-box" style="max-width:700px;width:96%">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h2 style="color:#bb9af7">🔐 Шаблоны авторизации</h2>
        <button class="modal-btn" onclick="document.getElementById('auth-tmpl-modal').style.display='none'">✕</button>
      </div>
      ${AUTH_TEMPLATES.map(t=>`
        <div style="border:1px solid #3d3f52;border-radius:9px;padding:12px;margin-bottom:10px;background:#1a1b26">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-size:13px;font-weight:700;color:#bb9af7">${t.name}</span>
          </div>
          <div style="font-size:11px;color:#787c99;margin-bottom:6px">${t.desc}</div>
          <div style="font-size:10px;color:#4a90d9;margin-bottom:8px">Эндпоинты: ${t.flows.join(' · ')}</div>
          <div style="display:flex;gap:6px">
            <button class="btn run" onclick="applyAuthTemplate('${t.id}')" style="font-size:10.5px">+ Добавить на схему</button>
            <button class="btn" onclick="showAuthSeq('${t.id}')" style="font-size:10.5px">📜 UML sequence</button>
            <button class="btn" onclick="showAuthSQL('${t.id}')" style="font-size:10.5px">📋 SQL схема</button>
          </div>
        </div>`).join('')}
    </div>`;
  document.body.appendChild(ov);
}

function applyAuthTemplate(id){
  const tmpl=AUTH_TEMPLATES.find(t=>t.id===id);if(!tmpl)return;
  const r=svgRct();
  const cx=Math.max(100,Math.round(r.width/2-S.panX));
  const cy=Math.max(60,Math.round(r.height/3-S.panY));
  // Auth Provider — отдельная сущность (type:'auth'), с типом и флагами поведения
  const authSvc={id:'b'+(S.nid++),type:'auth',x:cx,y:cy,customLabel:'Auth Provider',
    patterns:['timeout'],settings:{authType:id},
    auth:{type:id,flows:tmpl.flows.slice()}};
  S.blocks.push(authSvc);
  // БД со схемой ИМЕННО под этот тип авторизации
  const dbLabel=id==='session_based'?'Session Store':'Auth DB';
  const authDB={id:'b'+(S.nid++),type:'postgresql',x:cx+200,y:cy,customLabel:dbLabel,
    patterns:[],settings:{},dbSchema:JSON.parse(JSON.stringify(tmpl.dbTemplate))};
  S.blocks.push(authDB);
  S.conns.push({id:'c'+(S.nid++),from:authSvc.id,to:authDB.id});
  // Session-based — подсказать Redis для масштабирования
  pushHist();analyze();
  toast('🔐 '+tmpl.name+' добавлен'+(id==='session_based'?' · совет: добавь Redis для сессий':''));
  const am=document.getElementById('auth-tmpl-modal');if(am)am.style.display='none';
}

// Сменить тип авторизации существующего блока → переприкрепить схему БД под новый тип
function setAuthType(blockId,type){
  const b=gb(blockId);if(!b)return;
  const tmpl=AUTH_TEMPLATES.find(t=>t.id===type);if(!tmpl)return;
  if(!b.auth)b.auth={};
  b.auth.type=type;b.auth.flows=tmpl.flows.slice();
  b.settings=b.settings||{};b.settings.authType=type;
  // переприкрепить схему к подключённой PostgreSQL (или создать новую)
  let db=S.conns.filter(c=>c.from===blockId).map(c=>gb(c.to)).find(x=>x&&x.type==='postgresql');
  if(db){
    db.dbSchema=JSON.parse(JSON.stringify(tmpl.dbTemplate));
    db.customLabel=type==='session_based'?'Session Store':'Auth DB';
    delete db.dbTemplate;
  }
  pushHist();analyze();
  toast('🔐 Тип: '+tmpl.name+' · схема БД обновлена');
}

function showAuthSeq(id){
  const tmpl=AUTH_TEMPLATES.find(t=>t.id===id);if(!tmpl||!tmpl.seqExample)return;
  SEQ_ACTOR=null;SEQ_SCEN=null;
  document.getElementById('seq-modal').style.display='flex';
  document.getElementById('seq-title').textContent='🔐 '+tmpl.name+' — Sequence';
  document.getElementById('seq-input').value=tmpl.seqExample;
  renderSeq();
  document.getElementById('auth-tmpl-modal').style.display='none';
}

function showAuthSQL(id){
  const tmpl=AUTH_TEMPLATES.find(t=>t.id===id);if(!tmpl)return;
  const fakeTmpl={name:tmpl.name,type:'postgresql',schema:tmpl.dbTemplate};
  const sql=schemaToSQL(fakeTmpl);
  const existing=document.getElementById('db-view-modal');
  _dbViewId=null;_dbViewMode='sql';
  const content=`<pre style="font-size:11px;line-height:1.5;white-space:pre-wrap;font-family:Consolas,monospace;color:#c0caf5;max-height:50vh;overflow-y:auto;background:#11121a;padding:12px;border-radius:7px">${typeof escHtml==='function'?escHtml(sql):sql}</pre>`;
  if(existing){
    existing.innerHTML=`<div class="modal-box" style="max-width:700px;width:96%">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <h2 style="color:#bb9af7">${tmpl.name} — SQL</h2>
        <button class="modal-btn" onclick="document.getElementById('db-view-modal').style.display='none'">✕</button>
      </div>
      ${content}
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="modal-btn primary" onclick="navigator.clipboard.writeText(document.querySelector('#db-view-modal pre').textContent).then(()=>toast('Скопировано'))">📋 Копировать</button>
        <button class="modal-btn" onclick="document.getElementById('db-view-modal').style.display='none'">Закрыть</button>
      </div>
    </div>`;
    existing.style.display='flex';
    return;
  }
  const ov=document.createElement('div');ov.id='db-view-modal';ov.className='modal-ov';
  ov.innerHTML=`<div class="modal-box" style="max-width:700px;width:96%">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <h2 style="color:#bb9af7">${tmpl.name} — SQL</h2>
      <button class="modal-btn" onclick="document.getElementById('db-view-modal').style.display='none'">✕</button>
    </div>
    ${content}
    <div style="margin-top:10px"><button class="modal-btn" onclick="document.getElementById('db-view-modal').style.display='none'">Закрыть</button></div>
  </div>`;
  ov.style.display='flex';ov.onclick=e=>{if(e.target===ov)ov.style.display='none';};
  document.body.appendChild(ov);
}
