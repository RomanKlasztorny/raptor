// SEQ ENGINE TESTS — запускать в консоли браузера: seqTests.run()
// Проверяет корректность generateSeqFromScenario для разных паттернов

const seqTests = (() => {

  // ── mock-данные для тестов ────────────────────────────────
  function mkBlock(id, type, label) {
    return { id, type, x: 0, y: 0, customLabel: label || null };
  }
  const TEST_BLOCKS = [
    mkBlock('t_actor',  'web_client', 'Клиент'),
    mkBlock('t_gw',     'api_gw',     'API Gateway'),
    mkBlock('t_svc',    'service',    'Оплата'),
    mkBlock('t_db',     'postgresql', 'Payment DB'),
    mkBlock('t_ext',    'external',   'Платёжный шлюз'),
    mkBlock('t_kafka',  'kafka',      'Kafka'),
    mkBlock('t_notify', 'service',    'Уведомления'),
    mkBlock('t_smtp',   'external',   'SMTP'),
  ];

  function withBlocks(fn) {
    const orig = S.blocks.slice();
    S.blocks = [...orig, ...TEST_BLOCKS];
    const origScen = (S.scenarios||[]).slice();
    try { return fn(); }
    finally { S.blocks = orig; S.scenarios = origScen; }
  }

  function addScenario(id, name, path, steps) {
    S.scenarios = S.scenarios || [];
    S.scenarios.push({ id, name, color: '#fff', path, steps: steps || [], volume: 0, visible: true });
    return id;
  }

  // ── Утилита проверки ─────────────────────────────────────
  let pass = 0, fail = 0;
  function assert(desc, condition, detail) {
    if (condition) {
      console.log(`%c ✓ ${desc}`, 'color:#9ece6a');
      pass++;
    } else {
      console.error(`✗ ${desc}`, detail || '');
      fail++;
    }
  }

  // ════════════════════════════════════════════════════════
  // TEST 1: Базовый sync без брокера
  // Путь: Клиент → GW → Сервис → DB
  // ════════════════════════════════════════════════════════
  function test1_basicSync() {
    return withBlocks(() => {
      const sid = addScenario('t1', 'Базовый GET', ['t_actor','t_gw','t_svc','t_db'], [
        { name:'Запрашивает данные', verb:'GET', uri:'/api/v1/payments', resp:'200 OK' },
        { name:'Проверяет токен и маршрутизирует', verb:'GET', uri:'/api/v1/payments', resp:'200 OK' },
        { name:'Читает платёж', verb:'GET', uri:'SELECT * FROM payments WHERE id=$1', resp:'Отдаёт данные' },
      ]);
      const uml = generateSeqFromScenario(sid);
      assert('T1: участники объявлены', uml.includes('participant') || uml.includes('actor'));
      assert('T1: forward стрелка есть', uml.includes('->'));
      assert('T1: return есть (200 OK)', uml.includes('-->'));
      assert('T1: NO async divider', !uml.includes('== Асинхронная ==') && !uml.includes('== Async'));
      // Порядок: forward ДО return
      const fwdIdx  = uml.indexOf('Запрашивает данные');
      const retIdx  = uml.indexOf('200 OK');
      assert('T1: forward идёт ДО return', fwdIdx < retIdx, `fwd=${fwdIdx} ret=${retIdx}`);
    });
  }

  // ════════════════════════════════════════════════════════
  // TEST 2: Async с брокером — КРИТИЧЕСКИЙ тест
  // Путь: Клиент → GW → Оплата → DB → Kafka → Уведомления → SMTP
  // Ожидаем: sync returns ПЕРЕД == Асинхронная ==
  // ════════════════════════════════════════════════════════
  function test2_asyncBroker() {
    return withBlocks(() => {
      const sid = addScenario('t2', 'Оплата + уведомление',
        ['t_actor','t_gw','t_svc','t_db','t_kafka','t_notify','t_smtp'], [
        { name:'Оплачивает', verb:'POST', uri:'/api/v1/payments', resp:'201 Created' },
        { name:'Маршрутизирует', verb:'POST', uri:'/api/v1/payments', resp:'201 Created' },
        { name:'Сохраняет платёж', verb:'POST', uri:'INSERT INTO payments (...) RETURNING *', resp:'Подтверждает сохранение' },
        { name:'Публикует событие', verb:'POST', uri:'publish: payments.created', resp:'' },
        { name:'Доставляет событие', verb:'GET', uri:'consume: payments.created', resp:'' },
        { name:'Отправляет email', verb:'POST', uri:'POST /email', resp:'ok' },
      ]);
      const uml = generateSeqFromScenario(sid);

      // Брокер
      assert('T2: publish стрелка -)', uml.includes('-)'));
      assert('T2: async divider есть', uml.includes('== Асинхронная обработка =='));
      assert('T2: note о хранении', uml.includes('хранит событие'));

      // КРИТИЧЕСКИЙ: 201 Created (sync return) должен быть ДО divider
      const ret201    = uml.indexOf('201 Created');
      const divider   = uml.indexOf('== Асинхронная обработка ==');
      assert('T2: ★ sync return ПЕРЕД async divider', ret201 < divider && ret201 >= 0,
        `201=${ret201} divider=${divider}`);

      // Consumer chain ПОСЛЕ divider
      const consumeIdx = uml.indexOf('consume:');
      assert('T2: consumer chain ПОСЛЕ divider', consumeIdx > divider, `consume=${consumeIdx} div=${divider}`);

      // Notify → Kafka НЕТ (не должно быть return к брокеру)
      const umlLines = uml.split('\n');
      const badLine = umlLines.find(l => l.includes('-->') && l.includes('Kafka'));
      assert('T2: нет return TO Kafka', !badLine, badLine);

      // SMTP → Notify есть (внутри async)
      assert('T2: SMTP → Notify return есть', uml.includes('SMTP') && uml.includes('ok'));
    });
  }

  // ════════════════════════════════════════════════════════
  // TEST 3: External system → boundary, последний участник
  // ════════════════════════════════════════════════════════
  function test3_external() {
    return withBlocks(() => {
      const sid = addScenario('t3', 'С платёжным шлюзом',
        ['t_actor','t_gw','t_svc','t_ext'], [
        { name:'Оплачивает', verb:'POST', uri:'/api/v1/payments', resp:'201 Created' },
        { name:'Маршрутизирует', verb:'POST', uri:'/api/v1/payments', resp:'201 Created' },
        { name:'Инициирует оплату', verb:'POST', uri:'POST /external/charge', resp:'Подтверждает оплату' },
      ]);
      const uml = generateSeqFromScenario(sid);

      // External показан как boundary
      assert('T3: external = boundary', uml.includes('boundary'));

      // boundary объявлен ПОСЛЕДНИМ среди участников
      const lines = uml.split('\n').filter(l => l.match(/^(actor|participant|database|queue|boundary)/));
      const lastParticipant = lines[lines.length-1];
      assert('T3: boundary последний в объявлении', lastParticipant?.startsWith('boundary'), lastParticipant);

      // Ответ от External есть (resp задан)
      assert('T3: return от external', uml.includes('Подтверждает оплату'));
    });
  }

  // ════════════════════════════════════════════════════════
  // TEST 4: Auth JWT-only — скрытые шаги не попадают в UML
  // ════════════════════════════════════════════════════════
  function test4_hiddenSteps() {
    return withBlocks(() => {
      const authDb = mkBlock('t_authdb', 'postgresql', 'Auth DB');
      S.blocks.push(authDb);
      const authSvc = mkBlock('t_auth', 'auth', 'Auth Service');
      authSvc.auth = { type: 'jwt_only' };
      S.blocks.push(authSvc);

      const sid = addScenario('t4', 'JWT auth hidden',
        ['t_actor','t_gw','t_auth','t_authdb','t_svc','t_db'], [
        { name:'Запрашивает', verb:'GET', uri:'/api/v1/data', resp:'200 OK' },
        { name:'Маршрутизирует к Auth', verb:'GET', uri:'/api/v1/auth/*', resp:'OK' },
        { _hidden:true, name:'JWT локально', verb:'GET', uri:'JWT validation', resp:'' },
        { _hidden:true, name:'(gap)', verb:'GET', uri:'', resp:'' },
        { name:'Запрашивает данные', verb:'GET', uri:'/api/v1/data/{id}', resp:'200 OK' },
        { name:'Читает', verb:'GET', uri:'SELECT * WHERE id=$1', resp:'Отдаёт данные' },
      ]);
      const uml = generateSeqFromScenario(sid);

      // Скрытые шаги НЕ в UML
      assert('T4: "JWT локально" не в UML', !uml.includes('JWT локально'));
      assert('T4: "(gap)" не в UML', !uml.includes('(gap)'));
      // Обычные шаги есть
      assert('T4: "Запрашивает данные" в UML', uml.includes('Запрашивает данные'));

      S.blocks = S.blocks.filter(b => b.id !== 't_authdb' && b.id !== 't_auth');
    });
  }

  // ════════════════════════════════════════════════════════
  // TEST 5: apiFor — правильный SQL по глаголу
  // ════════════════════════════════════════════════════════
  function test5_apiFor() {
    const dbBlock = { type: 'postgresql', customLabel: 'Users DB' };
    const svcBlock = { type: 'service', customLabel: 'Users Service' };

    assert('T5: GET  → SELECT',  apiFor(svcBlock, dbBlock, 'GET')   .includes('SELECT'));
    assert('T5: POST → INSERT',  apiFor(svcBlock, dbBlock, 'POST')  .includes('INSERT'));
    assert('T5: PUT  → UPDATE',  apiFor(svcBlock, dbBlock, 'PUT')   .includes('UPDATE'));
    assert('T5: PATCH → UPDATE', apiFor(svcBlock, dbBlock, 'PATCH') .includes('UPDATE'));
    assert('T5: DELETE→ DELETE', apiFor(svcBlock, dbBlock, 'DELETE').includes('DELETE'));

    // Сервис → Сервис: POST → /api/v1/resource (без {id})
    const svc2 = { type: 'service', customLabel: 'Orders Service' };
    const postUri = apiFor(svcBlock, svc2, 'POST');
    assert('T5: POST /svc → нет {id}', !postUri.includes('{id}'), postUri);
    const getUri = apiFor(svcBlock, svc2, 'GET');
    assert('T5: GET /svc → с {id}', getUri.includes('{id}'), getUri);
  }

  // ════════════════════════════════════════════════════════
  // TEST 6: Alt error block — verb-aware
  // ════════════════════════════════════════════════════════
  function test6_altBlock() {
    return withBlocks(() => {
      const sid = addScenario('t6', 'Alt test',
        ['t_actor','t_gw','t_svc'], [
        { name:'Создаёт заказ', verb:'POST', uri:'/api/v1/orders', resp:'201 Created' },
        { name:'Маршрутизирует', verb:'POST', uri:'/api/v1/orders', resp:'201 Created' },
      ]);
      const uml = generateSeqFromScenario(sid);
      assert('T6: alt для POST не 404', !uml.includes('404 Not Found')); // 404 не для POST
      assert('T6: ветка Успех есть', uml.includes('alt Успех'));
      assert('T6: else Ошибка есть (alt всегда с else)', uml.includes('else Ошибка:'));
      assert('T6: alt закрыт', uml.includes('\nend'));
      assert('T6: детерминизм — повторная генерация идентична', uml === generateSeqFromScenario(sid));
      assert('T6: autonumber включён', uml.includes('autonumber'));
    });
  }

  // ════════════════════════════════════════════════════════
  // ЗАПУСК ВСЕХ ТЕСТОВ
  // ════════════════════════════════════════════════════════
  function run() {
    pass = 0; fail = 0;
    console.group('%c🧪 SEQ ENGINE TESTS', 'font-weight:bold;font-size:14px');
    console.group('T1: Базовый sync');    test1_basicSync();  console.groupEnd();
    console.group('T2: Async broker ★'); test2_asyncBroker(); console.groupEnd();
    console.group('T3: External');       test3_external();    console.groupEnd();
    console.group('T4: Hidden steps');   test4_hiddenSteps(); console.groupEnd();
    console.group('T5: apiFor SQL');     test5_apiFor();      console.groupEnd();
    console.group('T6: Alt block');      test6_altBlock();    console.groupEnd();
    console.groupEnd();

    const total = pass+fail;
    const color = fail===0?'#9ece6a':'#f7768e';
    console.log(`%c ИТОГО: ${pass}/${total} passed${fail>0?' — '+fail+' FAILED':''}`,
      `font-weight:bold;color:${color};font-size:13px`);
    return { pass, fail, total };
  }

  return { run };
})();

console.log('%c 📋 SEQ Tests loaded. Run: seqTests.run()', 'color:#7aa2f7');

// RAPTOR v1.1.0
