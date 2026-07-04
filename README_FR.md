![RAPTOR v1.1.1](https://github.com/user-attachments/assets/6ac2d4f1-be78-4d66-9aa0-601ec8934be6)

**🌐 Langue:** [🇬🇧 English](README.md) · [🇷🇺 Русский](README_RU.md) · [🇺🇦 Українська](README_UA.md) · [🇩🇪 Deutsch](README_DE.md) · [🇪🇸 Español](README_ES.md) · [🇵🇱 Polski](README_PL.md) · [🇨🇳 中文](README_ZH.md) · [🇯🇵 日本語](README_JA.md)

# RAPTOR — Constructeur d'Architecture

> Outil basé sur navigateur pour concevoir des systèmes microservices, simuler le trafic et générer de la documentation. Sans étape de build, sans npm — ouvrez `index.html` et commencez.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-1e4a90?style=for-the-badge)](https://romanklasztorny.github.io/raptor/)
[![Release](https://img.shields.io/github/v/release/RomanKlasztorny/raptor?style=for-the-badge&color=2a6010)](https://github.com/RomanKlasztorny/raptor/releases/latest)

![RAPTOR demo](https://github.com/RomanKlasztorny/raptor/assets/232060178/28fc476b-8a9a-49ee-9e74-c893a6720924)

---

## Démarrage rapide

```bash
npx serve .     # → http://localhost:5500
```

---

## Fonctionnalités

### Diagramme
- Blocs : Actor, Client, API Gateway, Load Balancer, CDN, WebSocket GW, BFF, Service, Auth, PostgreSQL, MySQL, MongoDB, Redis, Cassandra, ClickHouse, Elasticsearch, S3, Kafka, RabbitMQ, NATS, Queue, External
- Drag & drop avec détection de collisions, flèches bidirectionnelles
- Disposition automatique par couches — bouton **Auto**
- Niveaux **C1 / C2 / C3 / Seq** dans la barre d'outils

### Modèles
- **18 Systèmes** : Banque, Messagerie, Marketplace, YouTube, Moteur de recherche, Taxi, Réseau social, Livraison de repas, Covoiturage, Spotify, Netflix, Tinder, Bourse crypto, EdTech, Fitness, Réservation, Stockage cloud, Todo
- **44 Éléments** en 10 thèmes
- **61 modèles DB** : PostgreSQL, MongoDB, Cassandra, Redis, ClickHouse
- Menu flyout à 3 niveaux

### Simulation
- Les balles suivent les chemins des scénarios
- Clic sur une balle → détails du hop-trace avec latences
- **Mode Chaos** : pannes de nœuds, dégradation, réinitialisation du cache

### Séquence UML
- Générée depuis le scénario selon le standard PlantUML
- Kafka → flèche en pointillés `-)` sans réponse synchrone
- Bouton **📋 PlantUML** — copier pour Confluence

### RAPTOR AI
- Bouton `🤖 AI` → panneau de chat à droite
- Alimenté par **Groq** (llama-3.3-70b, plan gratuit) — collez votre clé API depuis [console.groq.com](https://console.groq.com)
- Modes : **gen** (génération complète), **chat** (planification), **patch** (mises à jour incrémentielles)

### Export
- **Word (.docx)**, **draw.io**, **Swagger/OpenAPI YAML**

---

## État

Tout dans l'objet global `S`. Sauvegarde → fichier JSON. Chargement → glisser le JSON sur le canvas.
