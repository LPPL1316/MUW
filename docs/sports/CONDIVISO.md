# Sport — quello che si è scoperto, per tutti

Lo tiene solo il Coordinatore Sport (ADR-0320). Ogni voce ha la data, chi
l'ha scoperta e dove sono i dettagli. Prima di cominciare uno sport si legge
tutto: è corto apposta.

## Le reti

- **2026-11-04, TASK-372 — le piste da fondo di OSM non bastano per le
  forme.** `piste:type=nordic` più le relazioni `route=piste`, 20 × 20 km
  attorno a Fiemme (Lago di Tesero), Asiago, Dobbiaco: 81–178 km di pista,
  ma 0 forme buone su 45 (al massimo 0,81, cerchio mai sopra 0,49). Le piste
  seguono la valle e hanno pochi incroci vicini. Lo sci di fondo è
  «Record only». Una zona di sola rete nordic pesa 0,2–0,4 MB.
  `tasks/TASK-372.md`.
- **2026-11-04, TASK-373 — piste da discesa e impianti: nessuna forma.**
  Paganella, Campiglio, Sella Ronda: 19 richieste, somiglianza 0,22–0,58,
  27–43% del percorso sugli impianti. Lo sci alpino è «Record only».
  `tasks/TASK-373.md`.
- **Rete foot** (corsa, camminata): il filtro `walk` di OSMnx senza
  l'esclusione delle ciclabili (ADR-0022); i marciapiedi disegnati a parte
  restano fuori e servono solo a dare i nomi (ADR-0054).
- **Rete bike**: strade e ciclabili, sensi unici rispettati, i tratti a
  piedi con la bici a 6 volte il costo (ADR-0153, ADR-0167). Una zona bike
  per 30 km è circa 26 × 26 km: una sola in memoria sul server.

## Le quote (dislivello)

- **La fonte già usata**: le Terrain Tiles di AWS (codifica «terrarium»),
  gratuite e senza chiave, per le colline della mappa 3D dell'app
  (`apps/mobile/src/map/mapKindStyle.ts`, TASK-351) e per lo studio dello
  sci alpino (`out/TASK-373/dem` sul Mac, zoom 13). **Prima di aggiungere
  un'altra fonte, si usa questa.**
- **ADR-0300, parte G di TASK-347** ha già deciso dislivello e profilo dal
  server, da queste tegole (circa 30 m), in cache sul Volume, con
  `RouteResult.elevation` e `POST /elevations` opzionali, senza quote
  offline. Non è ancora codice. Il calcolo del dislivello va fatto **una
  volta sola**, in un modulo condiviso: la prima sessione sport che ne ha
  bisogno (escursionismo probabilmente) si accorda con TASK-347 G tramite il
  Coordinatore, invece di farne uno suo.

## Il motore

- **L'impronta del motore** è l'hash di ogni `.py` e `.json` di
  `route_engine/` (`route_store.engine_fingerprint`): anche un file nuovo la
  cambia, e con lei tutti gli esempi (8–16 ore di `draw_examples`) e
  l'archivio. Un file che non disegna percorsi tenuti si può tenere fuori
  (come `ANCHORED_ONLY`, `DRAWN_WATER_ONLY`). ADR-0320, punto 3.
- Un grafo di rete sbagliata viene rifiutato (`network.check_network`):
  una rete nuova ha il suo nome nel grafo (`graph.graph["network"]`).
- **2026-11-04, TASK-376 B1 — i registri del motore.** Una rete è un
  modulo di `route_engine/networks/` (nome, filtro Overpass, come si scarica:
  `networks/base.py` `Network`), un'attività un modulo di
  `route_engine/activities/` (nome, distanze, rete o acqua); una riga in
  ciascun `__init__.py`. `network.py` e `models.py` ne ricavano le tabelle.
  I moduli dei registri non importano nulla che disegna.
- **2026-11-04, TASK-376 B1 — `SAME_ROUTES_AS`** (`route_store.py`): un
  motore che sposta solo codice tiene l'impronta di prima, se
  `services/api/tests/test_same_routes.py` registra per la nuova impronta
  gli stessi hash di nove percorsi fissi (`python tests/test_same_routes.py`
  da `services/api`, poi una riga per impronta). Mai per un cambiamento di
  comportamento. Il banco lo conferma con `compare --same`.
- **2026-11-04, TASK-371 — un modulo che nessun file di disegno importa**
  si tiene fuori dall'impronta (`WALK_ONLY`, come `ANCHORED_ONLY`,
  `DRAWN_WATER_ONLY`): la camminata è entrata senza ridisegnare nulla.

## Il contratto e l'API

- **2026-11-05, TASK-376 B2 — i registri del contratto e dell'API.** Uno
  sport è un file di `packages/shared-types/src/sports/` (nome e distanze,
  o `recordOnly`) e uno di `services/api/shaperoute_api/sports/` (`ApiSport`:
  tipo Strava, frase della descrizione, zone in memoria e box di prefetch se
  va su strada, record personali, `<type>` del GPX); una riga in ciascun
  `index.ts` / `__init__.py`. `index.ts`, `strava.py`, `activity_graphs.py`,
  `personal_bests.py`, `activities.py`, `prefetch_zones.py`, `run_gpx.py` e
  `schemas.py` ne ricavano le tabelle di prima, nello stesso ordine.
- **Il contratto importa valori con l'estensione `.ts`** (lo vuole `node
  --test`): l'app compila solo con `allowImportingTsExtensions` nel suo
  tsconfig (B2). Metro e jest risolvono il percorso esatto.
- **I moduli `shaperoute_api/sports/` vanno sul telefono** (li importano
  `activity_graphs.py` e `schemas.py`, dentro `engine.zip`): niente
  database, niente fastapi, e lo zip si rifà quando cambiano
  (`python tools/phone_engine/phone_engine.py engine`).
- **I `Literal` restano scritti a mano** (`RunActivity`, `personal_bests.Sport`):
  un tipo non si ricava da una tupla in Python. Uno sport nuovo li allunga di
  un nome; `test_sport_registry_api.py` dice quando non coincidono.

## L'app

- **2026-11-05, TASK-376 B3a — il profilo di ogni sport.** Uno sport è un
  file di `apps/mobile/src/sports/` con il suo `SportProfile`:
  - il nome;
  - le distanze di «Disegna», con passo e partenza;
  - i numeri di Apple Salute e Health Connect;
  - la rete del motore sul telefono;
  - come si contano le calorie;
  - cosa diventa una corsa senza percorso;
  - la scritta delle rotte MuW.

  Poi serve una riga in `index.ts`. Le tabelle di prima si ricavano con
  `tableOf`, uguali e nello stesso ordine: `route/distance.ts`,
  `health/appleWorkout.ts`, `health/healthConnectWorkout.ts`,
  `search/searchFilters.ts`, `engine/zones.ts`, `body/energy.ts`,
  `navigation/freeSport.ts`, `feed/muwLabel.ts`.
- **Un file di sport importa solo** il contratto, `../i18n` (`tLater`), il
  tipo `Limits` e `./base`, mai una schermata: lo prova
  `sportProfiles.test.ts`. I testi restano nelle tabelle `i18n` di oggi; il
  file dello sport ne tiene la chiave inglese.

## Il banco e Overpass

- **2026-11-04, TASK-376 — Overpass rifiuta spesso** (502 «pieno», 429
  «troppe richieste», timeout). Il banco riprova solo gli errori di rete,
  dopo 60, 120 e 240 s, e se la zona non arriva la lascia fuori dicendolo.
  Sull'acqua il motore scarica l'acqua dentro il calcolo di ogni percorso:
  il banco la scarica **una volta per zona**, prima dei percorsi. Un primo
  giro che riprovava subito ha preso una serie di 429 ed è stato fermato:
  dopo un 429, almeno 10 minuti di pausa.
- I tempi del banco sono del solo motore, con la zona già in cache: corsa
  0,6 s di mediana, bici 1,6 s (Milano fino a 12,7 s a 30 km), canoa sotto
  0,3 s. Servono a confrontare prima e dopo, non a promettere tempi.

## Gli sport senza traccia («Record only», Palestra)

- **2026-11-04, TASK-385 (Palestra, ADR-0327) — un'attività senza linea
  rompe le app di oggi.** `runs.track` è NOT NULL (migrazione 0003) e un
  disegno visibile deve avere la traccia (0014). Nell'app `isDrawing` vuole
  `track_preview` e `isDrawingsPage` usa `every`: **un solo post senza linea
  fa scartare l'intera pagina** di Feed, profilo e ricerca (la B0 di
  TASK-375 non lo copre). ADR-0327: traccia facoltativa solo per le
  attività `TRACKLESS_ACTIVITIES`, e i post senza traccia solo alle app che
  mandano l'header `X-MuW-Reads: trackless`. `docs/sports/gym.md`.
- **Salute: il tipo di allenamento non è un permesso.** Un allenamento di
  forza (HealthKit `.traditionalStrengthTraining`, Health Connect
  `EXERCISE_TYPE_STRENGTH_TRAINING`; i numeri vanno verificati sulle
  librerie) non chiede permessi nuovi né codice nativo.
- **Già nella 1.0.1**: notifiche locali (`expo-notifications`), vibrazione,
  keep-awake e audio. Un timer che avvisa a schermo bloccato è solo JS.

## Le misure

Le misure di base di corsa, bici e canoa stanno in `run.md`, `bike.md`,
`paddle.md`.
