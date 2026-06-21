# RAPTOR — diseñador de arquitectura

Herramienta basada en navegador para diseñar sistemas de microservicios, simular tráfico y generar documentación. Sin compilación, sin npm.

[🇬🇧 English](README.md) · [🇷🇺 Русский](README.ru.md) · [🇺🇦 Українська](README.ua.md) · [🇵🇱 Polski](README.pl.md) · 🇪🇸 Español · [🇩🇪 Deutsch](README.de.md)

![RAPTOR demo](demo.gif)

[![Live Demo](https://img.shields.io/badge/▶_Live_Demo-romanklasztorny.github.io%2Fraptor-1e4a90?style=flat-square)](https://romanklasztorny.github.io/raptor/)
[![Version](https://img.shields.io/badge/version-v1.1.0-2a6010?style=flat-square)](https://github.com/RomanKlasztorny/raptor/releases/tag/v1.1.0)
[![No build](https://img.shields.io/badge/no_build-pure_HTML%2FJS-7a6e5a?style=flat-square)](#)

---

## Inicio rápido

### Sin AI (solo diagrama y simulación)

```
npx serve . -p 5500
```
O abre el **[Live Demo →](https://romanklasztorny.github.io/raptor/)** directamente en tu navegador.

### Con AI (RAPTOR AI vía GitHub Copilot)

**Paso 1.** Asegúrate de tener [GitHub Copilot](https://github.com/features/copilot) — el plan gratuito funciona.

**Paso 2.** Instala [Node.js](https://nodejs.org) si aún no lo tienes.

**Paso 3.** Instala y ejecuta [anti-api](https://github.com/ink1ing/anti-api):
```
npm install -g anti-api
anti-api
```
Se abrirá el navegador → inicia sesión en GitHub → anti-api arranca en `localhost:8964`.

**Paso 4.** Ejecuta RAPTOR:
```
npx serve . -p 5500
```
Abre `http://localhost:5500` → el botón `🤖 AI` está listo.

---

## Características

### Diagrama
- Bloques: clientes, Gateway, servicios, BFF, Auth, PostgreSQL, Redis, MongoDB, Kafka, RabbitMQ, NATS, Queue, Elasticsearch, S3, CDN, LB, Externo
- Arrastrar y soltar, detección de colisiones, flechas bidireccionales
- Disposición automática por capas — botón `Auto`
- Niveles **C1 / C2 / C3 / Seq** en la barra de herramientas

### Simulación
- Las bolas siguen los caminos de los escenarios, modo **Caos**: fallos de nodos, degradación
- Kafka/RabbitMQ/NATS/Queue — inspector en vivo con topología, consumer groups, DLQ

### UML Sequence
- Generado desde el escenario según el estándar PlantUML
- Kafka → flecha discontinua `-)`, botón **«📋 PlantUML»** para Confluence

### Base de datos
- Editor de esquema PostgreSQL, ERD visual (crow's foot), importación SQL, 23 plantillas

### RAPTOR AI
- Botón `🤖 AI` → panel de chat, 13 herramientas
- Funciona a través de [anti-api](https://github.com/ink1ing/anti-api) (GitHub Copilot, plan gratuito)

---

## Versiones

| Versión | Novedades |
|---------|-----------|
| **[v1.1.0](https://github.com/RomanKlasztorny/raptor/releases/tag/v1.1.0)** | RAPTOR AI (13 herramientas), corrección de simulación Kafka, sim-trace |
| [v1.0.0](https://github.com/RomanKlasztorny/raptor/releases/tag/v1.0.0) | Primera versión pública |

Registro completo de cambios → [CHANGELOG.md](CHANGELOG.md)
