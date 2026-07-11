![RAPTOR v1.1.1](https://raw.githubusercontent.com/RomanKlasztorny/raptor/main/docs/release-notes.jpg)

**рџЊђ JД™zyk:** [рџ‡¬рџ‡§ English](README.md) В· [рџ‡·рџ‡є Р СѓСЃСЃРєРёР№](README_RU.md) В· [рџ‡єрџ‡¦ РЈРєСЂР°С—РЅСЃСЊРєР°](README_UA.md) В· [рџ‡©рџ‡Є Deutsch](README_DE.md) В· [рџ‡«рџ‡· FranГ§ais](README_FR.md) В· [рџ‡Єрџ‡ё EspaГ±ol](README_ES.md) В· [рџ‡Ёрџ‡і дё­ж–‡](README_ZH.md) В· [рџ‡Їрџ‡µ ж—Ґжњ¬иЄћ](README_JA.md)

# RAPTOR вЂ” Konstruktor Architektury

> NarzД™dzie przeglД…darkowe do projektowania systemГіw mikroserwisowych, symulowania ruchu i generowania dokumentacji. Bez kroku budowania, bez npm вЂ” otwГіrz `index.html` i zacznij pracД™.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-1e4a90?style=for-the-badge)](https://romanklasztorny.github.io/raptor/)
[![Release](https://img.shields.io/github/v/release/RomanKlasztorny/raptor?style=for-the-badge&color=2a6010)](https://github.com/RomanKlasztorny/raptor/releases/latest)

![RAPTOR demo](https://raw.githubusercontent.com/RomanKlasztorny/raptor/main/docs/demo.gif)

---

## Szybki start

```bash
npx serve .     # в†’ http://localhost:5500
```

---

## вљЎ Konfiguracja вЂ” RAPTOR AI

> BezpЕ‚atnie В· Bez karty В· 30 sekund

```
в‘  console.groq.com в†’ Zarejestruj siД™ в†’ API Keys в†’ Create API Key
в‘Ў Skopiuj klucz  в†’  gsk_вЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂў
в‘ў RAPTOR  в†’  рџ¤– AI  в†’  wklej klucz  в†’  Enter  вњ“
```

Klucz zapisywany w `localStorage` вЂ” wprowadzany raz na przeglД…darkД™.

---

## рџ”Њ UЕјycie z dowolnym LLM (ChatGPT, Claude, GeminiвЂ¦)

Bez Groq? Wygeneruj JSON **dowolnym modelem** i zaЕ‚aduj:

```
в‘  OtwГіrz  RAPTOR_FORMAT.md  в†ђ peЕ‚ny schemat JSON + przykЕ‚ady
в‘Ў   в†“
   Wklej do ChatGPT / Claude / Gemini:
   вЂћWygeneruj RAPTOR JSON dla [twГіj system]. Schemat: вЂ¦"
в‘ў   в†“
   Skopiuj JSON z odpowiedzi
в‘Ј RAPTOR  в†’  Plik в†’ Importuj JSON  в†’  wklej tekst  в†’  OK
   в†“
   вњ¦ Canvas wypeЕ‚nia siД™ natychmiast: bloki, poЕ‚Д…czenia, schematy BD, scenariusze
```

> **WskazГіwka:** zaЕ‚Д…cz `RAPTOR_FORMAT.md` jako plik вЂ” wiД™kszoЕ›Д‡ modeli odczytuje go w caЕ‚oЕ›ci.

---

## Funkcje

### Diagram
- Bloki: Aktor, Klient, API Gateway, Load Balancer, CDN, WebSocket GW, BFF, Serwis, Auth, PostgreSQL, MySQL, MongoDB, Redis, Cassandra, ClickHouse, Elasticsearch, S3, Kafka, RabbitMQ, NATS, Queue, ZewnД™trzny
- Drag & drop z wykrywaniem kolizji, dwukierunkowe strzaЕ‚ki
- Automatyczny ukЕ‚ad warstwowy вЂ” przycisk **Auto**
- Poziomy **C1 / C2 / C3 / Seq** w pasku narzД™dzi

### Szablony
- **18 SystemГіw**: Bank, Komunikator, Marketplace, YouTube, Wyszukiwarka, Taxi, Social Feed, Dostawa jedzenia, Carsharing, Spotify, Netflix, Tinder, GieЕ‚da krypto, EdTech, Fitness, Rezerwacje, Chmura, Todo
- **44 Elementy** w 10 kategoriach
- **61 szablonГіw DB**: PostgreSQL, MongoDB, Cassandra, Redis, ClickHouse
- 3-poziomowe menu flyout

### Symulacja
- Kulki poruszajД… siД™ po Е›cieЕјkach scenariuszy
- Klik na kulkД™ в†’ szczegГіЕ‚y hop-trace z opГіЕєnieniami
- **Tryb Chaos**: awarie wД™zЕ‚Гіw, degradacja, reset cache

### Sekwencja UML
- Generowana ze scenariusza zgodnie ze standardem PlantUML
- Kafka в†’ `-)` В· synchroniczne zwroty В· `group alt/else`
- Przycisk **рџ“‹ PlantUML** вЂ” kopiuj do Confluence
- ~~Code-to-diagram~~ в†’ **Click-to-diagram**: klikasz bloki na canvasie вЂ” RAPTOR automatycznie wyznacza Е›cieЕјkД™ przez poЕ‚Д…czenia, podЕ›wietlajД…c dostД™pne wД™zЕ‚y. Po kaЕјdym klikniД™ciu pojawia siД™ popup do opisania kroku (metoda, URI, odpowiedЕє). Enter вЂ” diagram sekwencji gotowy
- W aktywnym rozwoju; proste operacje CRUD dziaЕ‚ajД… juЕј w dwГіch klikniД™ciach вЂ” edytuj proces na wysokim i niskim poziomie bezpoЕ›rednio na canvasie

### RAPTOR AI
- Przycisk `рџ¤– AI` в†’ panel czatu po prawej
- Zasilany przez **Groq** (llama-3.3-70b, darmowy plan) вЂ” wklej klucz API z [console.groq.com](https://console.groq.com)
- Tryby: **gen** (peЕ‚na generacja), **chat** (planowanie), **patch** (przyrostowe aktualizacje)

### Eksport
- **Word (.docx)**, **draw.io**, **Swagger/OpenAPI YAML**

---

## Stan

Wszystko w globalnym obiekcie `S`. Zapisz в†’ plik JSON. Wczytaj в†’ Plik в†’ Importuj JSON в†’ wklej tekst в†’ OK.
