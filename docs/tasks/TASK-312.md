# TASK-312 — Importare nel Feed attività fatte con altre app, e post di sole foto

**Stato**: In lavorazione · documenti in `main` (#600) · **A in `main`** (API, PR #613) · **B in `main`** (app, file, PR #622, `5d7a5eda`) · poi C (post di sole foto), D (studio Apple Salute), E (studio collegamenti diretti)
**Fase**: 4 · **Branch**: `docs/TASK-312-import-activities` (documenti),
`feat/TASK-312-a-imported-runs-api` (A), `feat/TASK-312-b-import-file-app`
(B), `feat/TASK-312-c-photo-posts` (C), `docs/TASK-312-d-health-study`
(D), `docs/TASK-312-e-direct-links-study` (E)
**Dipende da**: TASK-172 (My activities), TASK-117 e TASK-208 (il disegno
e il modulo del post), TASK-118 (il Feed), TASK-296 (il gioco), TASK-299
(il concorso), TASK-262 C (la strada di `expo.autolinking.exclude`)
**ADR**: ADR-0272

## Obiettivo

Un iscritto aggiunge a «My activities» un'attività fatta con un'altra app,
da un file GPX, TCX o FIT, e la pubblica nel Feed come una corsa; oppure
pubblica un post di sole foto. Tutti e due portano la scritta «Imported» e
non contano per il gioco né per il concorso. Le regole sono in
`docs/IMPORTAZIONI.md`.

## Contesto

La richiesta dell'utente, il 2026-10-27: «Possibilità di caricare anche
attività che hanno già fatto in precedenza con altre app o instagram sul
nostro feed». Le sue risposte, una domanda per volta, con una proposta
già pronta:

1. Da dove: «Tutti e due, file prima. Il file GPX/FIT in un primo task,
   Apple Salute in un secondo task dopo. + strava + tutti i siti ed app
   più famose tipo garmin».
2. Un post da Instagram senza traccia: «Anche post solo foto».
3. `expo-document-picker`: «Sì, come i contatti» (il pacchetto escluso
   dall'autolinking, la funzione nascosta senza il modulo nativo, accesa
   con la build nativa dopo).
4. Gioco e concorso: «No, solo il feed» (con la scritta «Imported»).

Sui collegamenti diretti, prima di ogni codice: l'accordo API di Strava,
dal novembre 2024, lascia mostrare i dati di un utente solo a lui. Per
questo Strava e gli altri passano prima da uno studio (parte E). Il file
esportato dall'utente da Strava resta la strada di oggi. Instagram come
collegamento resta fuori (§1 di `IMPORTAZIONI.md`). I post di sole foto
sono dentro, per la scelta 2.

## Condizioni (dal Coordinatore, 2026-10-27)

1. **`expo-document-picker`** in `expo.autolinking.exclude` di
   `apps/mobile/package.json`, senza plugin in `app.json`; caricato con
   `requireOptionalNativeModule` e nascosto quando manca, come
   `expo-contacts` (TASK-262 C, #461). Impronta iOS
   `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3` misurata su una copia pulita
   di ogni testa della parte B. Una riga di promemoria in
   `tasks/TASK-152.md` per accenderlo con la build 1.0.1.
2. **Contro i trucchi**: «importata» nei dati (`runs.source`) e nel post.
   Gioco e concorso la lasciano fuori, con un test ciascuno. `clean_track`
   e `game_rules` valgono comunque.
3. **Strava**: il file dell'utente va bene; un collegamento diretto deve
   rispettare l'accordo, e lo studio lo verifica prima, per iscritto.
4. **Apple Salute / Health Connect**: libreria nativa, permessi, regole
   di Apple sui dati di salute (mai per la pubblicità, privacy da
   aggiornare): solo con la build nativa, prima lo studio.
5. **Privacy**: la stessa traccia tagliata di 200 m; gli orari veri del
   file come quelli di una corsa salvata; la riga nuova la approva
   l'utente.
6. Migrazione al **primo numero libero al merge**. Server dopo Apple e
   con il sì dell'utente. «File toccati» di ogni parte al Coordinatore
   prima del codice; per ogni PR «#NNN pronta».

## Contesto da leggere

- `docs/IMPORTAZIONI.md`, tutto; ADR-0272;
- `docs/API.md`: «My activities» (il corpo del `PUT`, `started_at`,
  `clean_track`), «Drawings» e «Feed»; `docs/DATABASE.md`, «Com'è oggi»:
  `runs`, `drawings`, `drawing_photos`;
- `docs/GIOCO.md` (dove una corsa entra nel gioco), `docs/CONCORSI.md`
  (chi partecipa);
- `tasks/TASK-262.md`, «Alla prossima build nativa» (la strada
  dell'esclusione);
- per B e C: `apps/mobile/src/activities/` (`RunEnd.tsx`,
  `activitiesDoor.ts`, `activityKey.ts`), `apps/mobile/src/social/`
  (`drawingsDoor.ts`, `drawingPhotos.ts`, `pickDrawingPhoto.ts`).

## Parte A — L'API delle corse importate

1. Migrazione: `runs.source` (`text NOT NULL DEFAULT 'muw'`, `CHECK` fra
   `muw` e `file`; `health` e i provider li aggiungono D ed E). Le corse
   di prima restano `muw`.
2. `PUT /me/activities/{key}` accetta `"source"` (per difetto `muw`).
   Conta solo al primo `PUT`, come il resto del corpo.
3. Con `source` diverso da `muw`: niente `after_run_saved`, e
   `game_backfill` le salta; `contests.py` prende solo i disegni di corse
   `muw`.
4. `source` nelle risposte: corsa dell'elenco e intera, disegno (mio e
   degli altri), post del Feed, griglia del profilo. Nei tipi di
   `packages/shared-types`, con fixture nuove (`*-imported.json`): le
   vecchie restano com'erano.
5. «Send to Strava» di una corsa importata: `409` con un codice nuovo,
   se l'utente conferma la proposta di §3.7.
6. Test: il `PUT` con `source: "file"` e orari di un anno fa; la seconda
   volta non cambia niente; il gioco non la conta (nessuna riga nuova
   nelle sue tabelle); il concorso non la conta; le risposte la dicono.

```
services/api/migrations/00NN_run_source.sql   (nuovo)
services/api/shaperoute_api/schemas.py
services/api/shaperoute_api/activities.py
services/api/shaperoute_api/game_backfill.py
services/api/shaperoute_api/contests.py
services/api/shaperoute_api/drawings.py
services/api/shaperoute_api/feed.py
services/api/shaperoute_api/profiles.py
services/api/shaperoute_api/strava.py         (solo con il sì su §3.7)
services/api/tests/test_imported_runs.py      (nuovo)
packages/shared-types/src/index.ts
packages/shared-types/fixtures/*-imported.json (nuovi)
docs/API.md
docs/DATABASE.md
docs/GIOCO.md
docs/CONCORSI.md
docs/STATUS.md
docs/tasks/TASK-312.md
```

### Parte A — com'è fatta (2026-10-28, PR #613)

«File toccati» approvati dall'utente il 2026-10-28 («OK, go ahead»; il
Coordinatore era archiviato). Rispetto alla lista sopra:

- la migrazione è **`0034_run_source.sql`**: la 0033 è dei messaggi
  (TASK-319);
- **`feed.py` e `profiles.py` non cambiano**: il Feed, la griglia del
  profilo (`GET /users/{id}/drawings`) e il concorso leggono le colonne e
  `_seen` di `drawings.py`, e `source` arriva da lì;
- in più `schemas.py` e `fixtures/api-error-codes.json` (il codice
  `imported_run`), `packages/shared-types/test/imported.test.ts` (nuovo) e
  tre test che confrontano le risposte con le fixture di prima
  (`test_activities.py`, `test_drawings.py`, `test_feed.py`: solo `source`
  fra i campi nuovi, come `rotation_deg`);
- in più `apps/mobile/assets/engine/engine.zip`, ricostruito con
  `python tools/phone_engine/phone_engine.py engine`: il telefono porta una
  copia di `schemas.py`, e il codice d'errore nuovo la cambia (dentro lo
  zip cambia solo quel file, come per `no_contest` in TASK-299). Sì
  dell'utente il 2026-10-28: «Yes, add and merge».

Cosa fa:

- `PUT /me/activities/{key}` accetta `source` (`muw` per difetto, `file`),
  solo al primo `PUT`; una corsa `file` con `points` è `422`;
- con `source` `file` niente `after_run_saved` né push delle forme;
  `game_backfill` legge solo le corse `muw` (così un account con una corsa
  da file non torna a ogni lancio); `PARTICIPATES_SQL` del concorso vuole
  `r.source = 'muw'`;
- «Send to Strava» di una corsa `file`: `409 imported_run`, prima del
  token;
- `source` nell'elenco e nella corsa intera, in `MyDrawing`, nel disegno
  degli altri (elenco, intero, Feed, concorso); nei tipi `RunSource`,
  `RUN_SOURCES` e `source?` (mancante da un'API di prima: `muw`);
- fixture nuove `activity-request-imported.json`,
  `activities-imported.json`, `activity-imported.json`,
  `my-drawing-imported.json`, `drawing-details-imported.json`,
  `feed-imported.json`, fatte dalle risposte vere dell'API; le vecchie
  invariate;
- 15 test in `services/api/tests/test_imported_runs.py`.

Per B: i tipi di «My activities» stanno nell'app
(`apps/mobile/src/api/activities.ts`); `source` lì va aggiunto da B, con
`muw` quando manca. Un'API senza la 0034 rifiuta `source` con `422`.
Server: la migrazione dopo il merge, con il sì dell'utente.

## Parte B — L'app: «Add past activity» da un file

1. `expo-document-picker` come nella condizione 1; `npm install` con il
   sì già dato dall'utente (2026-10-28).
2. Lettori scritti da noi, senza altre dipendenze, in
   `apps/mobile/src/imports/`: `gpx.ts` e `tcx.ts` (XML: i punti con
   posizione e orario, lo sport), `fit.ts` (binario: i messaggi `record`
   con `timestamp`, `position_lat`, `position_long`, e `sport`; anche le
   intestazioni con l'orario compresso). Test su file veri, piccoli, in
   `__tests__/fixtures/imports/`.
3. `importFile.ts`: dal file ai punti del `PUT` (`time_ms` dall'orario
   del file, `accuracy_m` `null`), i buchi oltre 60 s come pause `auto`, il
   diradamento a 20 000 punti, il limite di 25 MB, gli errori di §3.
4. «Add past activity» in «My activities» → «From a file» / «Photos only»
   (questa seconda la riempie C). Poi il modulo di `RunEnd`, con
   «Imported» e la riga sul gioco e il concorso.
5. «Imported» nella scheda di «My activities», nella scheda del Feed e
   nel post aperto.
6. La riga della privacy (§6 di `IMPORTAZIONI.md`) nelle cinque lingue,
   `site/privacy/*` rifatto con `node site/tools/make_privacy.mjs`, la data
   del giorno del merge (e il sì dell'utente su quella data).
7. Prova in Expo Go con un GPX di Strava, un TCX e un FIT di Garmin.

File toccati (da confermare al Coordinatore prima del codice):

```
apps/mobile/package.json                      (dipendenza + exclude)
package-lock.json
apps/mobile/src/imports/*                     (nuovi)
apps/mobile/src/activities/ActivitiesList.tsx
apps/mobile/src/activities/ActivityCard.tsx
apps/mobile/src/activities/RunEnd.tsx
apps/mobile/src/activities/activitiesDoor.ts
apps/mobile/src/api/activities.ts
apps/mobile/src/feed/feedPosts.ts
apps/mobile/src/social/DrawingCard.tsx
apps/mobile/src/i18n/*                        (le righe nuove)
apps/mobile/__tests__/fixtures/imports/*      (nuovi)
site/privacy/*
docs/UI.md
docs/tasks/TASK-152.md                        (una riga di promemoria)
docs/STATUS.md
docs/tasks/TASK-312.md
```

### Parte B — com'è fatta (2026-10-29, branch `feat/TASK-312-b-import-file-app`)

«File toccati» mandati al Coordinatore prima del codice e approvati il
2026-10-29, con le sue condizioni: il selettore fuori dalle build dello
store fino alla 1.0.1 (impronta invariata), il file letto sul telefono e
niente che parte prima di «Save», testi e privacy all'utente. Rispetto
alla lista sopra, in più: `apps/mobile/src/feed/FeedPost.tsx` («Imported»
nella riga dei fatti della scheda del Feed) e
`apps/mobile/src/about/content/*.ts` (la riga della privacy sta lì:
`make_privacy.mjs` legge da lì).

Cosa fa:

- `expo-document-picker` `~57.0.2` (57.0.3 nel lock), la versione di Expo
  SDK 57; il sì dell'utente è del 2026-10-28, «Sì, come i contatti» (scelta
  3 in «Contesto»). In `expo.autolinking.exclude`, nessun plugin in
  `app.json`, così le build dello store restano senza e l'impronta iOS resta
  `83793e26…` (misurata su copia pulita, con il `package-lock.json`
  cambiato);
  `pickActivityFile.ts` lo carica solo con `require` dietro
  `requireOptionalNativeModule("ExpoDocumentPicker")`: senza il modulo
  nativo (la 1.0, e le build fino alla 1.0.1) «Add past activity» non c'è;
  Expo Go lo mostra. Il file scelto si copia nella cache, si legge e la
  copia si cancella; un file oltre 25 MB non si legge;
- `src/imports/`: `gpx.ts` e `tcx.ts` (XML letto con poche espressioni
  regolari, `xml.ts`: solo numeri e orari, con o senza prefisso dei nomi),
  `fit.ts` (binario dal protocollo FIT: definizioni little e big endian,
  campi dello sviluppatore saltati per la loro misura, intestazioni con
  l'orario compresso, file concatenati, file tagliato letto fino al
  taglio; `record` 20, `sport` 12, `session` 18). Il formato si riconosce
  dal contenuto, non dal nome;
- `importFile.ts`: tiene i punti con posizione e orario, in ordine di
  tempo (un punto non più tardi di quello prima si lascia), i buchi oltre
  60 s come pause `auto` (al più 1 000, le più lunghe), al più 20 000
  punti a passo uguale, `accuracy_m` `null`, `source: "file"`, la chiave di
  sempre (`activityKey`). Errori: non GPX/TCX/FIT, nessuna posizione (anche
  meno di due punti), posizioni senza orari (un percorso), prima del 2020,
  oltre 25 MB; «Something went wrong.» (testo già approvato) per un file
  che il telefono non legge;
- **già in «My activities»**: prima del modulo, la corsa si cerca fra
  quelle in attesa sul telefono, nell'elenco e poi sull'API con
  `GET /me/activities/{key}`: parte **solo la chiave**, niente del file.
  Serve perché «Save» su una corsa già salvata riscriverebbe il suo
  disegno (titolo, chi la vede). Senza rete si va avanti: il `PUT` la
  tiene una volta comunque. *Deciso dall'agente su delega dell'utente.*
- «Add past activity» in cima a «My activities» (`AddPastActivity.tsx`):
  «From a file» con la riga sotto e l'aiuto; poi il disegno della traccia
  (al più 200 punti, ognuno è una View) e il modulo di `RunEnd` con
  `imported`: «Imported», la riga sul gioco e i concorsi, lo sport del file
  (altrimenti «Settings»), «Only me» all'inizio, niente «Send to Strava» né
  Apple Salute (l'altra app l'ha già scritta lì). «Save» passa da
  `recordImported` della porta: la stessa coda, le stesse scelte e foto di
  una corsa registrata; una corsa `file` non chiede niente al gioco
  (`tellUnlocked` saltato). Mai rimandata senza `source`: un'API senza la
  0034 la rifiuta (`422`) e resta fra quelle rifiutate, con «Try again»;
- «Imported» sulla riga e sulla scheda di «My activities» (sulla scheda
  niente «Send to Strava», la proposta confermata), nella riga dei fatti
  della scheda del Feed («Imported · 4.9 km · 27 min») e sul disegno
  aperto (`DrawingCard.tsx`, dopo il merge di #619); `source?` e
  `isImported` in `api/activities.ts`, mancante = `muw`;
- test su file piccoli in `apps/mobile/__tests__/fixtures/imports/`, fatti
  da `make_fixtures.mjs` nello stesso posto (sempre uguali): una corsa di
  Strava (GPX), un giro in bici di Garmin Connect (TCX), una corsa di un
  orologio Garmin (FIT con campo dello sviluppatore, definizione big endian
  e orari compressi), un percorso di Komoot (GPX senza orari), un tapis
  roulant (TCX senza posizioni). Le tracce sono inventate, per formula:
  nessuna attività di una persona nel repository. La struttura è quella
  dei file veri; la prova con file veri è il punto 7.

## Parte C — I post di sole foto

1. API: un disegno senza corsa. `drawings.user_id` (riempito da `runs`
   per le righe di oggi), `run_id` facoltativo, un vincolo: senza corsa
   niente traccia, e pubblico solo con almeno una foto. Dove oggi
   l'autore si legge con `JOIN runs` (`drawing_seen_sql`, `shown_sql`,
   Feed, commenti, reazioni, segnalazioni, push, email), si legge da
   `drawings.user_id`. *Proposta tecnica di partenza*: C la verifica sul
   codice e la scrive in ADR-0272 prima di cominciare. È la parte più
   larga: i file si contano allora.
2. Un endpoint per crearlo (`POST /me/photo-posts`, o il disegno con un
   corpo senza corsa: lo sceglie C), le foto con gli endpoint di oggi,
   poi «Everyone» o «Followers».
3. App: «Photos only» apre il modulo senza mappa; le foto con
   `pickDrawingPhoto.ts`. La scheda del Feed mostra le foto al posto del
   disegno (ADR-0275), con «Imported».
4. Test: un post solo foto si vede come un post (blocchi, nascosti,
   «Followers»); non entra nel concorso; senza foto non diventa pubblico.

Non usa `expo-document-picker`: funziona anche nella 1.0, con il server
aggiornato. File toccati: si dicono al Coordinatore prima del codice.

## Parte D — Apple Salute e Health Connect (studio)

Lo studio di §7 di `IMPORTAZIONI.md`, scritto in
`docs/tasks/TASK-312.md`, sezione «Studio D». Nessun codice. Poi una scelta
dell'utente (la libreria, i permessi, la privacy) e il codice con la
build nativa.

## Parte E — Collegamenti diretti (studio)

Lo studio di §8 di `IMPORTAZIONI.md`, scritto nella sezione «Studio E»:
una tabella per provider (Strava, Garmin, Polar, Suunto, Coros, Wahoo,
Komoot), con le fonti. Nessun codice, nessun account aperto a nome
dell'utente. Poi l'utente sceglie quali.

## Testi da approvare (parti B e C)

| Dove | Testo |
|---|---|
| «My activities», il pulsante | «Add past activity» |
| Le due scelte | «From a file» · «GPX, TCX or FIT from Strava, Garmin, Komoot…» |
|  | «Photos only» · «Up to 3 photos, also from Instagram» |
| Aiuto sotto «From a file» | «Export the activity as a file from the other app or its website, save it in Files, then pick it here.» |
| La scritta | «Imported» |
| Sotto il titolo del modulo | «Imported activities don't count for Play or contests.» |
| Errori | «This file has no times: it is a route, not an activity.» |
|  | «This file has no positions.» |
|  | «This file is not GPX, TCX or FIT.» |
|  | «This file is too big (over 25 MB).» |
|  | «Activities before 2020 cannot be added.» |
|  | «Already in My activities.» |
| Post di sole foto | «Add at least one photo.» |
| Privacy | «If you add a past activity from a file, we keep its track and times like a run recorded with MuW. We do not keep the file.» |

**Parte B approvata dall'utente il 2026-10-29** («Approvo tutto»): i testi
della parte B (le righe sopra senza «Photos only» e «Add at least one
photo.», che sono di C) con le traduzioni in italiano, tedesco, francese e
spagnolo della PR, la riga della privacy nelle cinque lingue e la data
della privacy **29 ottobre 2026**.

## Proposte da confermare con l'utente

- Il pulsante in «My activities», con le due scelte (§2).
- «Send to Strava» nascosto per una corsa importata (§3.7).
- Un post solo foto senza «Only me» (§4.1).

**Confermate dall'utente il 2026-10-28**: «Sì, le tre proposte vanno
bene: pulsante «Add past activity» in My activities, niente «Send to
Strava» per le corse importate, niente «Only me» per i post solo foto.»
Il punto 5 della parte A (`409` su «Send to Strava») è quindi dentro A.

Il Coordinatore chiede alla parte C una sua riga della privacy, approvata
dall'utente nella PR di C, e le regole di segnalazione e blocco di
TASK-121.

## Criteri di accettazione

- [x] **A**: una corsa con `source: "file"` si salva con i suoi orari, si
      pubblica, e il Feed, il disegno e «My activities» dicono
      `source`; il gioco e il concorso non la contano (test).
- [ ] **B**: in Expo Go un GPX di Strava, un TCX e un FIT di Garmin
      diventano corse di «My activities» con «Imported»; lo stesso file
      due volte resta una corsa; i file sbagliati danno i loro errori.
      *Scelta dell'utente del 2026-10-29 («Merge, provo sulla preview»):
      merge al verde, e la prova con i suoi file sulla preview di `main`
      dopo l'aggiornamento del server. Si spunta quando l'utente la
      conferma su quella preview.*
- [x] **B**: impronta iOS `83793e26…` invariata; senza il modulo nativo
      «From a file» non c'è. *Misurata dal Coordinatore su una copia
      pulita di `72af7335`; i test in `AddPastActivity.test.tsx` e
      `pickActivityFile.test.ts`.*
- [ ] **C**: un post di sole foto si pubblica a «Everyone» o
      «Followers», si vede nel Feed con le foto e «Imported», e non entra
      nel concorso.
- [ ] **D** ed **E**: gli studi scritti, con le fonti, e la scelta
      dell'utente registrata.
- [ ] I testi e la privacy approvati dall'utente prima del merge di B e C.

## File toccati (documenti, questa PR)

```
docs/IMPORTAZIONI.md        (nuovo)
docs/tasks/TASK-312.md      (nuovo)
docs/DECISIONS.md           (ADR-0272, in fondo)
docs/INDEX.md               (una riga)
docs/STATUS.md              (una voce in «In lavorazione»)
```

## Fuori scope

- Instagram come collegamento all'account (§1 di `IMPORTAZIONI.md`).
- Leggere gli zip; altitudine, battito, cadenza.
- «Open in MuW» dal foglio di condivisione: con la build nativa dopo.
- Caricare più file insieme, o l'archivio intero di Strava.
- Una corsa importata che conta per il gioco o il concorso: l'utente ha
  scelto di no.

## Esito

*(si compila a fine task)*
