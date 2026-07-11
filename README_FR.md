![RAPTOR v1.1.1](https://raw.githubusercontent.com/RomanKlasztorny/raptor/main/docs/release-notes.jpg)

**рџЊђ Langue:** [рџ‡¬рџ‡§ English](README.md) В· [рџ‡·рџ‡є Р СѓСЃСЃРєРёР№](README_RU.md) В· [рџ‡єрџ‡¦ РЈРєСЂР°С—РЅСЃСЊРєР°](README_UA.md) В· [рџ‡©рџ‡Є Deutsch](README_DE.md) В· [рџ‡Єрџ‡ё EspaГ±ol](README_ES.md) В· [рџ‡µрџ‡± Polski](README_PL.md) В· [рџ‡Ёрџ‡і дё­ж–‡](README_ZH.md) В· [рџ‡Їрџ‡µ ж—Ґжњ¬иЄћ](README_JA.md)

# RAPTOR вЂ” Constructeur d'Architecture

> Outil basГ© sur navigateur pour concevoir des systГЁmes microservices, simuler le trafic et gГ©nГ©rer de la documentation. Sans Г©tape de build, sans npm вЂ” ouvrez `index.html` et commencez.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-1e4a90?style=for-the-badge)](https://romanklasztorny.github.io/raptor/)
[![Release](https://img.shields.io/github/v/release/RomanKlasztorny/raptor?style=for-the-badge&color=2a6010)](https://github.com/RomanKlasztorny/raptor/releases/latest)

![RAPTOR demo](https://raw.githubusercontent.com/RomanKlasztorny/raptor/main/docs/demo.gif)

---

## L'idГ©e

DГ©crivez votre systГЁme en un message вЂ” RAPTOR AI gГ©nГЁre l'architecture complГЁte : blocs, connexions, schГ©mas de BD et scГ©narios. Le rГґle de l'analyste est d'**Г©diter et affiner**, pas de dessiner des flГЁches depuis zГ©ro.

---

## DГ©marrage rapide

```bash
npx serve .     # в†’ http://localhost:5500
```

---

## вљЎ Configuration вЂ” RAPTOR AI

> Gratuit В· Sans carte bancaire В· 30 secondes

```
в‘  console.groq.com в†’ S'inscrire в†’ API Keys в†’ Create API Key
в‘Ў Copier la clГ©  в†’  gsk_вЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂў
в‘ў RAPTOR  в†’  рџ¤– AI  в†’  coller la clГ©  в†’  EntrГ©e  вњ“
```

La clГ© est sauvegardГ©e dans `localStorage` вЂ” Г  saisir une seule fois par navigateur.

---

## рџ”Њ Utiliser avec n'importe quel LLM (ChatGPT, Claude, GeminiвЂ¦)

Pas de Groq ? GГ©nГ©rez le JSON avec **n'importe quel modГЁle** et importez-le :

```
в‘  Ouvrez  RAPTOR_FORMAT.md  в†ђ schГ©ma JSON complet + exemples
в‘Ў   в†“
   Collez dans ChatGPT / Claude / Gemini :
   В« GГ©nГЁre un JSON RAPTOR pour [ton systГЁme]. SchГ©ma : вЂ¦ В»
в‘ў   в†“
   Copiez le JSON de la rГ©ponse
в‘Ј RAPTOR  в†’  Fichier в†’ Importer JSON  в†’  coller le texte  в†’  OK
   в†“
   вњ¦ Le canvas se remplit instantanГ©ment : blocs, connexions, schГ©mas BD, scГ©narios
```

> **Astuce :** joignez `RAPTOR_FORMAT.md` en fichier вЂ” la plupart des modГЁles le lisent en entier.

---

## FonctionnalitГ©s

### RAPTOR AI
- Un message в†’ systГЁme microservices complet : blocs, connexions, schГ©mas BD, scГ©narios
- Trois modes : **gen** (gГ©nГ©ration complГЁte), **chat** (planification + Q&R), **patch** (mises Г  jour incrГ©mentielles)
- 18 patrons architecturaux dans le prompt : Saga, Outbox, CQRS, Cache-aside, Circuit Breaker et plus
- Correction automatique : direction des connexions, FK cross-DB, dГ©duplication
- AlimentГ© par **Groq** (llama-3.3-70b, plan gratuit) вЂ” clГ© API sur [console.groq.com](https://console.groq.com)

### Diagramme (C4)
- Blocs : Actor, Client, API Gateway, Load Balancer, CDN, WebSocket GW, BFF, Service, Auth, PostgreSQL, MySQL, MongoDB, Redis, Cassandra, ClickHouse, Elasticsearch, S3, Kafka, RabbitMQ, NATS, Queue, External
- Drag & drop avec dГ©tection de collisions, flГЁches bidirectionnelles
- Disposition automatique par couches, niveaux C4 dans la barre d'outils

### ModГЁles
- **18 SystГЁmes** : Banque, Messagerie, Marketplace, YouTube, Moteur de recherche, Taxi, RГ©seau social, Livraison, Covoiturage, Spotify, Netflix, Tinder, Bourse crypto, EdTech, Fitness, RГ©servation, Cloud, Todo
- **44 Г‰lГ©ments** en 10 thГЁmes В· **61 modГЁles DB**
- Menu flyout Г  3 niveaux

### ScГ©narios
- Chemins de requГЄtes avec `verb + uri + resp` par Г©tape
- Remplissage automatique respectant le `auth_mode` du Gateway

### Simulation
- Balles animГ©es sur les chemins de scГ©narios
- Kafka / RabbitMQ / NATS / Queue reГ§oivent du trafic en direct
- Clic sur une balle в†’ hop-trace avec latences В· **Mode Chaos**

### SГ©quence UML
- GГ©nГ©rГ©e depuis le scГ©nario selon le standard PlantUML
- Kafka в†’ `-)` В· retours synchrones В· `group alt/else`
- Bouton **рџ“‹ PlantUML** вЂ” copier pour Confluence
- ~~Code-to-diagram~~ в†’ **Click-to-diagram**: cliquez sur les blocs du canvas вЂ” RAPTOR trace automatiquement le chemin Г  travers les connexions en surlignant les nЕ“uds disponibles. AprГЁs chaque clic, un popup permet de dГ©crire l'Г©tape (mГ©thode, URI, rГ©ponse). EntrГ©e вЂ” le diagramme de sГ©quence est prГЄt
- En dГ©veloppement actif ; les flux CRUD simples fonctionnent dГ©jГ  en deux clics вЂ” Г©ditez votre processus au niveau haut et bas directement sur le canvas

### Base de donnГ©es
- Г‰diteur de schГ©ma PostgreSQL avec ERD visuel (patte de corbeau)
- Г‰diteur Redis : patterns de clГ©s avec type et TTL
- Import SQL DDL, 61 modГЁles prГЄts Г  l'emploi

### Export
- **Word (.docx)** вЂ” format universel que chaque partie prenante possГЁde dГ©jГ . Avant l'export vous choisissez ce qui est inclus : diagramme C4, tables API, schГ©ma BD, ERD вЂ” prenez ce dont vous avez besoin, ignorez le reste
- **draw.io** XML В· **Swagger / OpenAPI YAML** В· EntiГЁrement hors ligne

---

## Г‰tat

Tout dans l'objet global `S`. Sauvegarder в†’ fichier JSON. Charger в†’ glisser le JSON sur le canvas.
