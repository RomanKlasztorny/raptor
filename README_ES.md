![RAPTOR v1.1.1](https://github.com/user-attachments/assets/6ac2d4f1-be78-4d66-9aa0-601ec8934be6)

**🌐 Idioma:** [🇬🇧 English](README.md) · [🇷🇺 Русский](README_RU.md) · [🇺🇦 Українська](README_UA.md) · [🇩🇪 Deutsch](README_DE.md) · [🇫🇷 Français](README_FR.md) · [🇵🇱 Polski](README_PL.md) · [🇨🇳 中文](README_ZH.md) · [🇯🇵 日本語](README_JA.md)

# RAPTOR — Constructor de Arquitectura

> Herramienta basada en navegador para diseñar sistemas de microservicios, simular tráfico y generar documentación. Sin paso de compilación, sin npm — abre `index.html` y empieza.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-1e4a90?style=for-the-badge)](https://romanklasztorny.github.io/raptor/)
[![Release](https://img.shields.io/github/v/release/RomanKlasztorny/raptor?style=for-the-badge&color=2a6010)](https://github.com/RomanKlasztorny/raptor/releases/latest)

![RAPTOR demo](https://github.com/RomanKlasztorny/raptor/assets/232060178/28fc476b-8a9a-49ee-9e74-c893a6720924)

---

## Inicio rápido

```bash
npx serve .     # → http://localhost:5500
```

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
- Kafka → flecha punteada `-)` sin respuesta síncrona
- Botón **📋 PlantUML** — copiar para Confluence

### RAPTOR AI
- Botón `🤖 AI` → panel de chat a la derecha
- Impulsado por **Groq** (llama-3.3-70b, plan gratuito) — pega tu clave API desde [console.groq.com](https://console.groq.com)
- Modos: **gen** (generación completa), **chat** (planificación), **patch** (actualizaciones incrementales)

### Exportación
- **Word (.docx)**, **draw.io**, **Swagger/OpenAPI YAML**

---

## Estado

Todo en el objeto global `S`. Guardar → archivo JSON. Cargar → arrastrar JSON al canvas.
