# TASK-371 — La camminata, «Walk»

**Stato**: In lavorazione — parti A (#741) e B (#747) Done il 2026-11-04;
restano l'accensione di «Walk» e la parte C
**Fase**: 4 · **Branch**: `docs/TASK-371-walk` (documenti),
`feat/TASK-371-a-walk-engine-api` (parte A), `feat/TASK-371-b-walk-app`
(parte B), `feat/TASK-371-c-walk-game` (parte C) · **ADR**: ADR-0315 ·
numeri dal Coordinatore (2026-11-04)

## Obiettivo

Chi sceglie «Walk» 🚶 riceve un percorso a piedi che disegna la forma, sulla
**stessa rete pedonale della corsa** («foot»), e lo cammina con ritmo, voce,
salvataggio, Feed, Apple Salute e Strava da camminata.

## Contesto

Richiesta dell'utente del 2026-11-04: lo sport «Walk» in MuW, con la rete
«foot» di `route_engine/network.py` riusata, senza costruirne una nuova;
activity `walking` in shared-types, motore e API (distanze, GPX col tipo
giusto); nell'app lo sport in Settings e nel menu di Draw, ritmo e velocità
da camminata nella schermata di corsa, nella voce, nelle attività e nel Feed;
testi in tutte le lingue.

Il nuoto (TASK-323 B, #709) ha aperto la strada: `API_ACTIVITIES` in
shared-types per le attività dell'API, `Activity` dell'app che si allarga
solo con la parte dell'app, la migrazione che estende i vincoli `activity` di
`favorites`, `runs` e `group_runs`.

Da leggere: `ROUTE_ENGINE.md` (le reti), `API.md` («Routes», «Activities»),
`DATABASE.md` (i vincoli `activity`), ADR-0153 (la bici), ADR-0281 (Apple
Salute), ADR-0283 (il nuoto), ADR-0255 (il gioco delle forme).

## Condizioni del Coordinatore (2026-11-04)

1. **Motore e API piccoli e separati (parte A)**: toccare `models.py` cambia
   l'impronta del motore, come per il nuoto. La parte A entra **prima della
   notte in cui si rifanno gli esempi** dopo #709, così si rifanno una volta
   sola.
2. **Migrazione 0043** (la 0042 è di TASK-368 A), come la 0040 del nuoto.
3. **L'app dopo TASK-367 A** (nella #717), con la **lista dei file al
   Coordinatore prima del codice**.
4. Impronta iOS attesa: **6f8bba4c** (la parte B resta solo JavaScript).
5. «#NNN pronta» con la testa, al Coordinatore.

## Scelte dell'utente (2026-11-04)

1. **Distanze: 1–30 km** («1–30 km»; la proposta era 1–20).
2. **Ordine: si aspetta #709** in `main` prima del codice («Aspetto #709»;
   scartati: partire subito e riallineare, il motore invariato).
3. **Ritmo in min/km** nella schermata di corsa e nella voce, come la corsa
   («Ritmo min/km»); il tempo previsto prima di partire su un ritmo usuale di
   **12:00 /km** finché non ci sono camminate salvate.
4. **Le camminate contano nel gioco delle forme** («Sì, nel gioco»), con
   regole nuove; **non** nei record personali di TASK-368, che restano della
   corsa.
5. **Calorie stimate** in Apple Salute e Health Connect, come la corsa ma con
   la stima della camminata («Sì, stimate»).
6. Restano dell'utente, quando arriva la parte che li usa: i **testi** nuovi
   in tutte le lingue (B) e i dettagli delle regole del gioco (C). Una domanda
   per volta, con la proposta.

## Cosa fare

### Parte A — motore, contratto, API, database

Dopo #709 in `main`, col via del Coordinatore, prima della notte degli esempi.

1. `shared-types`: `walking` in `API_ACTIVITIES` (non ancora in `ACTIVITIES`
   dell'app), `DISTANCE_LIMITS_M.walking = [1_000, 30_000]`; fixture
   `route-request-walking.json` e il contratto.
2. Motore: `walking` in `SUPPORTED_ACTIVITIES` e `DISTANCE_LIMITS_M` di
   `models.py`; in `network.py` la camminata usa la rete **foot** della corsa
   (stessa rete, stessi file di cache, nessuna rete nuova); `--activity
   walking` da riga di comando.
3. GPX col tipo, **solo per la camminata**: `<type>walking</type>` nella
   traccia, nel GPX del percorso (`POST /gpx`) e in quello della corsa
   salvata (`run_gpx.py`); gli altri sport restano identici byte per byte,
   con un test (condizione del Coordinatore). `imports/gpx.ts` legge già
   `<type>`.
4. API: validazione delle distanze da `DISTANCE_LIMITS_M`; `RunActivity` di
   `activities.py`; Strava `walking: "Walk"`; `activity_graphs.py` dà alla
   camminata il grafo **già in memoria** della corsa, senza zone in più.
5. Migrazione `0043_walking.sql`: i vincoli `activity` di `favorites`, `runs`,
   `group_runs` con `walking`.
6. `engine.zip` dell'app rifatto (il motore sul telefono, TASK-214); gli esempi
   della canoa si rifanno nella stessa notte di #709.
7. Test deterministici: limiti 1–30 km, `walking` sulla rete foot (lo stesso
   grafo della corsa), il `<type>` dei due GPX, Strava «Walk», la migrazione.

#### Com'è venuta la parte A (2026-11-04)

Il Coordinatore ha chiesto l'impronta del motore invariata: gli esempi si
ridisegnano una volta sola, la notte del nuoto. I punti 2, 3 e 6 qui sopra
sono cambiati così:

- **Il motore non conosce la camminata**: `models.py`, `network.py`,
  `__main__.py` ed `export_gpx.py` restano come sono. Un file nuovo,
  `route_engine/walking.py`, ha `API_ACTIVITIES`, i limiti 1–30 km,
  `engine_activity` (la camminata chiesta come corsa) e la riga di comando
  `python -m route_engine.walking`. `route_store.WALK_ONLY` lo lascia fuori
  dall'impronta (`test_walk_fingerprint.py`: 5b5e026cea9b e b9d00c37d28d).
- **L'API** chiede la corsa in `images.route_request_of` (e quindi anche
  `on_phone`) e in `app.to_request`. Dà alla camminata il grafo foot
  (`activity_graphs`), la prende in `/stroke-matches` e `/way-back`, e
  suggerisce distanze da camminata anche nei job (`errors`, `jobs`).
- **Il GPX**: `<type>walking</type>` solo per la camminata
  (`run_gpx.gpx_type`, `with_type`); gli altri sport restano identici byte
  per byte, con un test.
- `engine.zip` rifatto con lo strumento, perché `walking.py` sta nel
  pacchetto del motore. L'impronta iOS resta 6f8bba4c.
- File in più rispetto all'elenco previsto: `route_engine/walking.py`,
  `images.py`, `errors.py`, `jobs.py`, `route_store.py`, `stroke_matches.py`,
  `tests/test_walk_fingerprint.py`, `docs/GPX.md`, e quattro test vecchi
  che avevano l'elenco delle attività senza la camminata:
  `tests/test_cycling.py`, `test_strava.py`, `test_favorites.py`
  (`ACTIVITY_MIGRATIONS` con la 0043), `test_drawing_search.py` (il filtro
  sbagliato ora è `hiking`). File in meno:
  `models.py`, `network.py`, `__main__.py`, `export_gpx.py`. La lista è
  stata approvata dal Coordinatore prima della PR.

### Parte B — l'app

Dopo TASK-367 A in `main`; lista dei file al Coordinatore prima del codice;
il server con la parte A prima che lo sport diventi `ready`.

1. `ACTIVITIES` dell'app con `walking`; lo sport `walk` 🚶 in `ALL_SPORTS`,
   in Settings e nel menu sport di Draw; `activityOf("walk") = "walking"`;
   «Walk without a route».
2. Le distanze di Draw da `DISTANCE_LIMITS_M.walking`, anche in miglia.
3. Schermata di corsa e voce: ritmo min/km come la corsa; tempo previsto su
   12:00 /km o sul ritmo delle proprie camminate.
4. Apple Salute `.walking` (52) con `DistanceWalkingRunning`; Health Connect
   `EXERCISE_TYPE_WALKING` (79); calorie stimate con un coefficiente da
   camminata (proposta: 0,53 kcal per kg e km, la metà circa della corsa).
5. Le attività salvate, il Feed (`FeedPost`, `MuwPost`, `muwLabel`,
   `PublicParts`) e l'importazione (GPX `walking`, Strava «Walk», FIT sport
   11) riconoscono la camminata.
6. Le zone del motore sul telefono: la camminata usa le zone foot della corsa.
7. Testi in `i18n` (en, it, de, fr, es) e nella voce, col sì dell'utente.

#### Com'è venuta la parte B (2026-11-04)

- `ACTIVITIES` dell'app ha `walking`. `API_ACTIVITIES` è `ACTIVITIES`.
- In `sport.ts` c'è «Walk» 🚶 dopo il nuoto, con `ready: false` finché il
  server non ha la parte A e la 0043: accenderla è una riga, dopo il server.
- `runTime.averagePace` dà anche `walking`: il ritmo delle camminate fra
  6:00 e 25:00 al km, 12:00 di base. `RoutePanel` lo mostra sotto la
  distanza, e `App.tsx` non cambia.
- Le calorie della camminata sono in `body/energy.ts` (ACSM a piedi).
- Apple Salute (52), Health Connect (79), le zone del telefono
  (`zones.NETWORKS`) e l'importazione (GPX `walking`, Strava «10», FIT 11).
- Feed «Walk ·», `activityName`, l'icona 🚶 del pulsante «senza
  percorso». La scelta «Walk» nel modulo per pubblicare e il filtro «Walk»
  della ricerca compaiono solo con lo sport pronto (`activityOffered`), così
  un filtro mostrato non riceve mai un 422.
- Testi approvati dall'utente: «Walk» (Camminata, Gehen, Marche, Caminata) e
  «Walk without a route» (Cammina senza percorso, Ohne Route gehen, Marcher
  sans parcours, Caminar sin ruta).
- File in più rispetto alla lista: `search/FilterSheet.tsx` (di TASK-344,
  chiuso; via del Coordinatore), `screens/RunNoRouteButton.tsx` (l'icona),
  i test che contano le righe «Soon» (`SportButton`, `SportSetting`,
  `SportVoiceItalian`, `SettingsPage`) e `docs/UI.md`.
- Resta fuori: «NEAR YOU» per la camminata (l'utente: «Solo corsa, per
  ora»), il gioco delle forme (parte C).

### Parte C — il gioco delle forme

Server, col sì dell'utente sulle regole e sul deploy.

1. `game_rules.py`: una camminata conta come una corsa (oggi `not_running`);
   nuova `RULES_VERSION` e il ricalcolo (`game_backfill.py`).
2. Le velocità da veicolo restano le stesse; i tempi migliori (`best_s`) e i
   record di TASK-368 restano della corsa.
3. Da chiedere all'utente prima: se le camminate contano anche nei concorsi
   (TASK-299, TASK-343).

## Criteri di accettazione

- [ ] A: `POST /routes` con `activity: "walking"` accetta 1–30 km e rifiuta
      fuori con `invalid_request`; il percorso è disegnato sulla rete foot.
- [ ] A: il motore non costruisce né carica una rete nuova per la camminata
      (test sul nome della rete e sul grafo in memoria).
- [ ] A: i GPX del percorso e della corsa salvata di una camminata hanno
      `<type>walking</type>`; quelli degli altri sport non cambiano.
- [ ] A: una camminata salvata va su Strava come «Walk».
- [ ] A: la migrazione 0043 accetta `walking` nelle tre tabelle.
- [ ] B: «Walk» si sceglie in Settings e in Draw, il percorso arriva, la
      schermata mostra il ritmo in min/km, la voce lo dice.
- [ ] B: in Apple Salute l'allenamento è una camminata, con calorie.
- [ ] B: impronta iOS 6f8bba4c invariata.
- [ ] C: una camminata conta nel gioco delle forme.
- [ ] Test deterministici verdi in ogni parte.

## File toccati

Documenti (questa PR):

```
docs/tasks/TASK-371.md
docs/DECISIONS.md
docs/STATUS.md
docs/INDEX.md
```

Parte A (previsti; la lista definitiva al Coordinatore prima del codice):

```
packages/shared-types/src/index.ts
packages/shared-types/fixtures/contract.json
packages/shared-types/fixtures/route-request-walking.json
packages/shared-types/test/contract.test.ts
services/route-engine/route_engine/models.py
services/route-engine/route_engine/network.py
services/route-engine/route_engine/__main__.py
services/route-engine/route_engine/export_gpx.py
services/route-engine/tests/test_walking.py
services/api/shaperoute_api/schemas.py
services/api/shaperoute_api/activities.py
services/api/shaperoute_api/activity_graphs.py
services/api/shaperoute_api/strava.py
services/api/shaperoute_api/run_gpx.py
services/api/shaperoute_api/app.py
services/api/migrations/0043_walking.sql
services/api/tests/test_walking_api.py
apps/mobile/assets/engine/engine.zip
docs/API.md
docs/DATABASE.md
docs/ROUTE_ENGINE.md
```

Parte B: la lista va al Coordinatore prima del codice (Settings, Draw,
schermata di corsa, voce, health, imports, Feed, i18n).

Parte C: `services/api/shaperoute_api/game_rules.py`, `game_backfill.py`, i
loro test, `docs/API.md`.

## Fuori scope

- Una rete pedonale nuova, sentieri da escursionismo, dislivello come scelta:
  la camminata usa la rete della corsa così com'è.
- Record personali della camminata (TASK-368 resta della corsa).
- Esempi di camminata in «Explore» o nel Feed di MuW.
- Rifare gli esempi della canoa sul server: è la notte di #709, col sì
  dell'utente.

## Esito

**Parti A e B, 2026-11-04.** Documenti #726, A #741 (`f5897cf7`), B #747
(`224a023d`, dopo la 375 B0 #749).

- **Cosa funziona**: l'API e il motore sul telefono disegnano la camminata
  come una corsa sulla rete a piedi, 1–30 km, e l'impronta del motore non è
  cambiata. Il GPX di una camminata dice `walking` e Strava la riceve come
  «Walk». L'app conosce la camminata: distanze, tempo previsto, calorie,
  Apple Salute, Health Connect, importazione, Feed. L'impronta iOS è sempre
  6f8bba4c.
- **Cosa è emerso**: le app già pubblicate facevano cadere l'intera pagina
  del Feed per un'attività che non conoscevano. Lo ha corretto TASK-375 B0
  (#749), prima che una camminata si possa salvare. Quattro test vecchi
  avevano l'elenco delle attività scritto a mano: aggiornati.
- **Cosa resta, e dove**:
  1. **Accendere «Walk»** (`ready: true` in `apps/mobile/src/settings/
     sport.ts`, una riga, con i suoi test «Soon»). Servono tre cose:
     l'OTA della 375 B0 in produzione da qualche giorno, il server con la
     parte A e la migrazione 0043, il sì dell'utente.
  2. **Parte C**, il gioco delle forme (sopra, «Parte C»): prima va chiesto
     all'utente se le camminate contano anche nei concorsi.
  3. «NEAR YOU» per la camminata: l'utente ha detto «Solo corsa, per ora».
