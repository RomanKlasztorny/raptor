![RAPTOR v1.1.1](https://raw.githubusercontent.com/RomanKlasztorny/raptor/main/docs/release-notes.jpg)

**рџЊђ Idioma:** [рџ‡¬рџ‡§ English](README.md) В· [рџ‡·рџ‡є Р СѓСЃСЃРєРёР№](README_RU.md) В· [рџ‡єрџ‡¦ РЈРєСЂР°С—РЅСЃСЊРєР°](README_UA.md) В· [рџ‡©рџ‡Є Deutsch](README_DE.md) В· [рџ‡«рџ‡· FranГ§ais](README_FR.md) В· [рџ‡µрџ‡± Polski](README_PL.md) В· [рџ‡Ёрџ‡і дё­ж–‡](README_ZH.md) В· [рџ‡Їрџ‡µ ж—Ґжњ¬иЄћ](README_JA.md)

# RAPTOR вЂ” Constructor de Arquitectura

> Herramienta basada en navegador para diseГ±ar sistemas de microservicios, simular trГЎfico y generar documentaciГіn. Sin paso de compilaciГіn, sin npm вЂ” abre `index.html` y empieza.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-1e4a90?style=for-the-badge)](https://romanklasztorny.github.io/raptor/)
[![Release](https://img.shields.io/github/v/release/RomanKlasztorny/raptor?style=for-the-badge&color=2a6010)](https://github.com/RomanKlasztorny/raptor/releases/latest)

![RAPTOR demo](https://raw.githubusercontent.com/RomanKlasztorny/raptor/main/docs/demo.gif)

---

## Inicio rГЎpido

```bash
npx serve .     # в†’ http://localhost:5500
```

---

## вљЎ ConfiguraciГіn вЂ” RAPTOR AI

> Gratis В· Sin tarjeta В· 30 segundos

```
в‘  console.groq.com в†’ Registrarse в†’ API Keys в†’ Create API Key
в‘Ў Copiar la clave  в†’  gsk_вЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂў
в‘ў RAPTOR  в†’  рџ¤– AI  в†’  pegar la clave  в†’  Enter  вњ“
```

La clave se guarda en `localStorage` вЂ” se introduce una sola vez por navegador.

---

## рџ”Њ Usar con cualquier LLM (ChatGPT, Claude, GeminiвЂ¦)

ВїSin Groq? Genera el JSON con **cualquier modelo** e impГіrtalo:

```
в‘  Abre  RAPTOR_FORMAT.md  в†ђ esquema JSON completo + ejemplos
в‘Ў   в†“
   Pega en ChatGPT / Claude / Gemini:
   В«Genera un JSON RAPTOR para [tu sistema]. Esquema: вЂ¦В»
в‘ў   в†“
   Copia el JSON de la respuesta
в‘Ј RAPTOR  в†’  Archivo в†’ Importar JSON  в†’  pegar texto  в†’  OK
   в†“
   вњ¦ El canvas se llena al instante: bloques, conexiones, esquemas BD, escenarios
```

> **Consejo:** adjunta `RAPTOR_FORMAT.md` como archivo вЂ” la mayorГ­a de los modelos lo leen completo.

---

## CaracterГ­sticas

### Diagrama
- Bloques: Actor, Cliente, API Gateway, Load Balancer, CDN, WebSocket GW, BFF, Servicio, Auth, PostgreSQL, MySQL, MongoDB, Redis, Cassandra, ClickHouse, Elasticsearch, S3, Kafka, RabbitMQ, NATS, Queue, Externo
- Drag & drop con detecciГіn de colisiones, flechas bidireccionales
- DisposiciГіn automГЎtica por capas вЂ” botГіn **Auto**
- Niveles **C1 / C2 / C3 / Seq** en la barra de herramientas

### Plantillas
- **18 Sistemas**: Banco, MensajerГ­a, Marketplace, YouTube, Motor de bГєsqueda, Taxi, Red social, Entrega de comida, Carsharing, Spotify, Netflix, Tinder, Bolsa de criptomonedas, EdTech, Fitness, Reservas, Almacenamiento en la nube, Todo
- **44 Elementos** en 10 temas
- **61 plantillas DB**: PostgreSQL, MongoDB, Cassandra, Redis, ClickHouse
- MenГє flyout de 3 niveles

### SimulaciГіn
- Las bolas siguen los caminos de los escenarios
- Clic en una bola в†’ detalles de hop-trace con latencias
- **Modo Caos**: fallos de nodos, degradaciГіn, reinicio de cachГ©

### Secuencia UML
- Generada desde el escenario segГєn el estГЎndar PlantUML
- Kafka в†’ `-)` В· retornos sГ­ncronos В· `group alt/else`
- BotГіn **рџ“‹ PlantUML** вЂ” copiar para Confluence
- ~~Code-to-diagram~~ в†’ **Click-to-diagram**: haz clic en los bloques del canvas вЂ” RAPTOR encuentra el camino a travГ©s de las conexiones automГЎticamente, resaltando los nodos disponibles. Tras cada clic aparece un popup para describir el paso (mГ©todo, URI, respuesta). Enter вЂ” el diagrama de secuencia estГЎ listo
- En desarrollo activo; los flujos CRUD simples ya funcionan en dos clics вЂ” edita tu proceso a alto y bajo nivel directamente en el canvas

### RAPTOR AI
- BotГіn `рџ¤– AI` в†’ panel de chat a la derecha
- Impulsado por **Groq** (llama-3.3-70b, plan gratuito) вЂ” pega tu clave API desde [console.groq.com](https://console.groq.com)
- Modos: **gen** (generaciГіn completa), **chat** (planificaciГіn), **patch** (actualizaciones incrementales)

### ExportaciГіn
- **Word (.docx)**, **draw.io**, **Swagger/OpenAPI YAML**

---

## Estado

Todo en el objeto global `S`. Guardar в†’ archivo JSON. Cargar в†’ Archivo в†’ Importar JSON в†’ pegar texto в†’ OK.
