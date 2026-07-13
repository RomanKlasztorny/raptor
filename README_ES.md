![RAPTOR v1.1.1](https://raw.githubusercontent.com/RomanKlasztorny/raptor/main/docs/release-notes.jpg)

**🌐 Idioma:** [🇬🇧 English](README.md) · [🇷🇺 Русский](README_RU.md) · [🇺🇦 Українська](README_UA.md) · [🇩🇪 Deutsch](README_DE.md) · [🇫🇷 Français](README_FR.md) · [🇵🇱 Polski](README_PL.md) · [🇨🇳 中文](README_ZH.md) · [🇯🇵 日本語](README_JA.md)

# RAPTOR — Constructor de Arquitectura

> Herramienta basada en navegador para diseñar sistemas de microservicios, simular tráfico y generar documentación. Sin paso de compilación, sin npm — abre `index.html` y empieza.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-1e4a90?style=for-the-badge)](https://romanklasztorny.github.io/raptor/)
[![Release](https://img.shields.io/github/v/release/RomanKlasztorny/raptor?style=for-the-badge&color=2a6010)](https://github.com/RomanKlasztorny/raptor/releases/latest)

![RAPTOR demo](https://raw.githubusercontent.com/RomanKlasztorny/raptor/main/docs/demo.gif)

---

## Inicio rápido

```bash
npx serve .     # → http://localhost:5500
```

---

## ⚡ Configuración — RAPTOR AI

> Gratis · Sin tarjeta · 30 segundos

```
① console.groq.com → Registrarse → API Keys → Create API Key
② Copiar la clave  →  gsk_••••••••••••••••••••••••
③ RAPTOR  →  🤖 AI  →  pegar la clave  →  Enter  ✓
```

La clave se guarda en `localStorage` — se introduce una sola vez por navegador.

---

## 🔌 Usar con cualquier LLM (ChatGPT, Claude, Gemini…)

¿Sin Groq? Genera el JSON con **cualquier modelo** e impórtalo:

```
① Abre  RAPTOR_FORMAT.md  ← esquema JSON completo + ejemplos
②   ↓
   Pega en ChatGPT / Claude / Gemini:
   «Genera un JSON RAPTOR para [tu sistema]. Esquema: …»
③   ↓
   Copia el JSON de la respuesta
④ RAPTOR  →  Archivo → Importar JSON  →  pegar texto  →  OK
   ↓
   ✦ El canvas se llena al instante: bloques, conexiones, esquemas BD, escenarios
```

> **Consejo:** adjunta `RAPTOR_FORMAT.md` como archivo — la mayoría de los modelos lo leen completo.

---

## Características

### Diagrama
- Bloques: Actor, Cliente, API Gateway, Load Balancer, CDN, WebSocket GW, BFF, Servicio, Auth, PostgreSQL, MySQL, MongoDB, Redis, Cassandra, ClickHouse, Elasticsearch, S3, Kafka, RabbitMQ, NATS, Queue, Externo
- Drag & drop con detección de colisiones, flechas bidireccionales
- Disposición automática por capas — botón **Auto**
- Niveles **C1 / C2 / C3 / Seq** en la barra de herramientas

### Plantillas
- **18 Sistemas**: Banco, Mensajería, Marketplace, YouTube, Motor de búsqueda, Taxi, Red social, Entrega de comida, Carsharing, Spotify, Netflix, Tinder, Bolsa de criptomonedas, EdTech, Fitness, Reservas, Almacenamiento en la nube, Todo
- **44 Elementos** en 10 temas
- **61 plantillas DB**: PostgreSQL, MongoDB, Cassandra, Redis, ClickHouse
- Menú flyout de 3 niveles

### Simulación
- Las bolas siguen los caminos de los escenarios
- Clic en una bola → detalles de hop-trace con latencias
- **Modo Caos**: fallos de nodos, degradación, reinicio de caché

### Secuencia UML
- Generada desde el escenario según el estándar PlantUML
- Kafka → `-)` · retornos síncronos · `group alt/else`
- Botón **📋 PlantUML** — copiar para Confluence
- ~~Code-to-diagram~~ → **Click-to-diagram**: haz clic en los bloques del canvas — RAPTOR encuentra el camino a través de las conexiones automáticamente, resaltando los nodos disponibles. Tras cada clic aparece un popup para describir el paso (método, URI, respuesta). Enter — el diagrama de secuencia está listo
- En desarrollo activo; los flujos CRUD simples ya funcionan en dos clics — edita tu proceso a alto y bajo nivel directamente en el canvas

### RAPTOR AI
- Botón `🤖 AI` → panel de chat a la derecha
- Impulsado por **Groq** (llama-3.3-70b, plan gratuito) — pega tu clave API desde [console.groq.com](https://console.groq.com)
- Modos: **gen** (generación completa), **chat** (planificación), **patch** (actualizaciones incrementales)

### Exportación
- **Word (.docx)**, **draw.io**, **Swagger/OpenAPI YAML**

---

## Estado

Todo en el objeto global `S`. Guardar → archivo JSON. Cargar → Archivo → Importar JSON → pegar texto → OK.
