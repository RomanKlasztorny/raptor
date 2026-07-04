![RAPTOR v1.1.1](https://github.com/user-attachments/assets/6ac2d4f1-be78-4d66-9aa0-601ec8934be6)

**🌐 Langue:** [🇬🇧 English](README.md) · [🇷🇺 Русский](README_RU.md) · [🇺🇦 Українська](README_UA.md) · [🇩🇪 Deutsch](README_DE.md) · [🇪🇸 Español](README_ES.md) · [🇵🇱 Polski](README_PL.md) · [🇨🇳 中文](README_ZH.md) · [🇯🇵 日本語](README_JA.md)

# RAPTOR — Constructeur d'Architecture

> Outil basé sur navigateur pour concevoir des systèmes microservices, simuler le trafic et générer de la documentation. Sans étape de build, sans npm — ouvrez `index.html` et commencez.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-1e4a90?style=for-the-badge)](https://romanklasztorny.github.io/raptor/)
[![Release](https://img.shields.io/github/v/release/RomanKlasztorny/raptor?style=for-the-badge&color=2a6010)](https://github.com/RomanKlasztorny/raptor/releases/latest)

![RAPTOR demo](https://github.com/RomanKlasztorny/raptor/assets/232060178/28fc476b-8a9a-49ee-9e74-c893a6720924)

---

## L'idée

Décrivez votre système en un message — RAPTOR AI génère l'architecture complète : blocs, connexions, schémas de BD et scénarios. Le rôle de l'analyste est d'**éditer et affiner**, pas de dessiner des flèches depuis zéro.

---

## Démarrage rapide

```bash
npx serve .     # → http://localhost:5500
```

---

## ⚡ Configuration — RAPTOR AI

> Gratuit · Sans carte bancaire · 30 secondes

```
① console.groq.com → S'inscrire → API Keys → Create API Key
② Copier la clé  →  gsk_••••••••••••••••••••••••
③ RAPTOR  →  🤖 AI  →  coller la clé  →  Entrée  ✓
```

La clé est sauvegardée dans `localStorage` — à saisir une seule fois par navigateur.

---

## 🔌 Utiliser avec n'importe quel LLM (ChatGPT, Claude, Gemini…)

Pas de Groq ? Générez le JSON avec **n'importe quel modèle** et importez-le :

```
① Ouvrez  RAPTOR_FORMAT.md  ← schéma JSON complet + exemples
②   ↓
   Collez dans ChatGPT / Claude / Gemini :
   « Génère un JSON RAPTOR pour [ton système]. Schéma : … »
③   ↓
   Copiez le JSON de la réponse
④ RAPTOR  →  Fichier → Importer JSON  →  coller le texte  →  OK
   ↓
   ✦ Le canvas se remplit instantanément : blocs, connexions, schémas BD, scénarios
```

> **Astuce :** joignez `RAPTOR_FORMAT.md` en fichier — la plupart des modèles le lisent en entier.

---

## Fonctionnalités

### RAPTOR AI
- Un message → système microservices complet : blocs, connexions, schémas BD, scénarios
- Trois modes : **gen** (génération complète), **chat** (planification + Q&R), **patch** (mises à jour incrémentielles)
- 18 patrons architecturaux dans le prompt : Saga, Outbox, CQRS, Cache-aside, Circuit Breaker et plus
- Correction automatique : direction des connexions, FK cross-DB, déduplication
- Alimenté par **Groq** (llama-3.3-70b, plan gratuit) — clé API sur [console.groq.com](https://console.groq.com)

### Diagramme (C4)
- Blocs : Actor, Client, API Gateway, Load Balancer, CDN, WebSocket GW, BFF, Service, Auth, PostgreSQL, MySQL, MongoDB, Redis, Cassandra, ClickHouse, Elasticsearch, S3, Kafka, RabbitMQ, NATS, Queue, External
- Drag & drop avec détection de collisions, flèches bidirectionnelles
- Disposition automatique par couches, niveaux C4 dans la barre d'outils

### Modèles
- **18 Systèmes** : Banque, Messagerie, Marketplace, YouTube, Moteur de recherche, Taxi, Réseau social, Livraison, Covoiturage, Spotify, Netflix, Tinder, Bourse crypto, EdTech, Fitness, Réservation, Cloud, Todo
- **44 Éléments** en 10 thèmes · **61 modèles DB**
- Menu flyout à 3 niveaux

### Scénarios
- Chemins de requêtes avec `verb + uri + resp` par étape
- Remplissage automatique respectant le `auth_mode` du Gateway

### Simulation
- Balles animées sur les chemins de scénarios
- Kafka / RabbitMQ / NATS / Queue reçoivent du trafic en direct
- Clic sur une balle → hop-trace avec latences · **Mode Chaos**

### Séquence UML
- Générée depuis le scénario selon PlantUML
- Kafka → `-)` · bouton **📋 PlantUML** pour Confluence

### Base de données
- Éditeur de schéma PostgreSQL avec ERD visuel (patte de corbeau)
- Éditeur Redis : patterns de clés avec type et TTL
- Import SQL DDL, 61 modèles prêts à l'emploi

### Export
- **Word (.docx)** — format universel que chaque partie prenante possède déjà. Avant l'export vous choisissez ce qui est inclus : diagramme C4, tables API, schéma BD, ERD — prenez ce dont vous avez besoin, ignorez le reste
- **draw.io** XML · **Swagger / OpenAPI YAML** · Entièrement hors ligne

---

## État

Tout dans l'objet global `S`. Sauvegarder → fichier JSON. Charger → glisser le JSON sur le canvas.
