# TASK-297 — Ricerche dall'archivio dei percorsi (A) e loghi con la penna alzata (C); il piazzamento imparato, misurato e scartato (B)

**Stato**: In lavorazione · documenti in `main` (#538, `9391893c`) · parte A in `main` (#539, `0c4ada00`, su `preview` e0e4e126) · **C, motore: PR #547 aperta (2026-10-25)** · TASK-298 nella sua sessione · **A2: in `main` di `LPPL1316/MUW` con la #7 (`e789e9c`, 2026-10-29)** · poi C2
**Fase**: 4 · **Branch**: `docs/TASK-297-proposal` (documenti),
`feat/TASK-297-a-route-archive` (A), `feat/TASK-297-a2-first-placement`
(A2, dopo la #497), `feat/TASK-297-c-image-pieces` (C, motore),
`feat/TASK-297-c2-image-pieces-api-app` (C, API e app)
**Dipende da**: TASK-168 (`route_store`), TASK-092 (`line_key`), TASK-093
(le alternative e `with_approach`), TASK-197 e TASK-223 (la penna alzata,
le forme in pezzi), TASK-072 e TASK-084 (il contorno di un'immagine)
**ADR**: ADR-0256 (A), ADR-0257 (B, misurata e scartata), ADR-0258 (C)

## Obiettivo

Una richiesta già fatta vicino riceve il percorso pronto invece di
aspettare il motore (A); le immagini con parti staccate e con fori — i
loghi — si disegnano con la penna alzata, un pezzo alla volta (C). Il
motore che «riparte da ciò che ha imparato» è stato misurato e non regge:
resta scritto perché nessuno lo riprovi (B).

## Contesto

L'utente, il 2026-10-24: «rendi l'app più veloce nella ricerca tenendo in
archivio tutte le ricerche, aiutati con quelle più selezionate dagli utenti
per estrapolare il disegno velocemente; trova un modo per far sì che l'app
impari da sola a disegnare; fai prove con immagini complesse, loghi
aziendali e di run club, gioca con il fatto di alzare la penna». La
proposta, con le misure, è in `out/archivio-apprendimento/proposta.md`
del Mac (`out/` è ignorato da git): `warm.md` e `warm.json` per la parte
B, `logos/all-logos.png` e un foglio per logo per la parte C. Il sì
dell'utente: «sì grazie», lo stesso giorno, con «imparato» inteso come
l'ordine dell'archivio e il ridisegno rapido dopo un cambio del motore.

**I numeri del server** (eventi di ottobre, 20 giorni, celle di ~1 km,
nessuna posizione): 3 006 percorsi calcolati, mediana 6,6 s, p75 9,7 s,
p90 14,4 s; 2 574 da 5 km; cuore, cerchio e stella 2 667 su 3 006.
2 404 richieste su 3 006 (80 %) ripetevano una richiesta già fatta nella
stessa cella, stessa forma e distanza (il cuore da 5 km a Trento
calcolato 14 volte, a Verona 16). Oggi l'API tiene un percorso solo dal
centro di una città o da un punto dei laghi e delle spiagge (ADR-0136).
`route_chosen` (A · B · C): 36 eventi, 32 A.

**La prova B** (Mac, zone di Trento in cache, 36 richieste: cuore,
stella, gatto, lumaca, luna da 5 km e cuore da 2 km, sei partenze a
300–700 m): la ricerca di oggi 736 tracciamenti, 17 percorsi buoni; lo
stesso piazzamento alla stessa partenza rifà lo stesso percorso 36 volte
su 36 con 54 tracciamenti; il piazzamento imparato alla partenza più
vicina (500–680 m) 90 tracciamenti, 5 buoni, nettamente peggiore in 28
casi su 36. In 19 casi su 36 la ricerca di oggi spende tutti i 30
tracciamenti senza un percorso buono (gatto 6 su 6, lumaca 5 su 6, cuore
da 2 km 6 su 6).

**La prova C** (sette loghi sintetici e il logo MuW, 5 km da Trento):
oggi le lettere «RC» diventano una macchia (somiglianza 0,98), la ruota
un cerchio, le tre barre un pettine, M u W appese al cuore con gambi; con
i pezzi e le camminate si legge «RC», si vede la ruota coi raggi, le tre
barre, «MuW» sotto il cuore. L'anello con la stella da 5 km non viene
(0,58), da 8 km sì. La somiglianza della penna alzata è un'altra misura,
più severa: non si confronta, si guarda.

## Condizioni (dal Coordinatore, 2026-10-24)

1. **Principio**: l'«imparare» viene solo dai risultati del motore
   (piazzamenti riusciti, percorsi scelti e corsi). L'AI non produce mai
   coordinate né hint geometrici.
2. **Contratto del motore**: niente di tolto né cambiato; ogni parametro
   nuovo è facoltativo e senza di lui il risultato è quello di oggi, con
   un test. Il motore gira anche sul telefono (`engine.zip`, TASK-214) e
   resta puro: nessun import da `api/` o `ai/`, eseguibile da riga di
   comando senza rete.
3. **Privacy dell'archivio (A)**: una partenza spesso è la casa di
   qualcuno. Nell'archivio niente `user_id`; un percorso dato a un altro
   non dice chi l'ha chiesto o corso. Un limite di spazio e una pulizia:
   il server ha un Volume da 70 GB che tiene già la cache delle zone. Il
   testo della privacy lo approva l'utente ed entra nell'aggiornamento
   della privacy che il Coordinatore raccoglie (#461, 284 B, 291, 294,
   296).
4. **Motore (A2, C)**: misurare prima e dopo sul catalogo e sugli esempi
   tenuti, con i tempi di TASK-289; nessuna forma esistente peggiora. Ogni
   cambio del motore vuol dire rifare `draw_examples` (anche `--water`),
   `engine.zip`, `paddleExamples.json` e `catalogueShapes.json`
   (`tools/catalogue_shapes.py` ha il suo test): scritto nella PR.
5. **Loghi (C)**: nel repository solo loghi sintetici e il logo MuW.
   Niente loghi di aziende né di run club (marchi e diritti); un club si
   prova in locale, fuori dal repository, con il suo permesso.
6. **Impronta iOS**: le parti che toccano l'app lasciano
   `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3`. Nessuna dipendenza nuova.
7. **Ordine**: il server aspetta Apple. A ci va con l'ok dell'utente dopo
   la #502 e la #525; A2 e C dopo la #489 e la #497. Ogni parte: «#NNN
   pronta» al Coordinatore, che mergia al verde; le «File toccati» di ogni
   parte al Coordinatore prima di partire.
8. **File occupati il 2026-10-24** dalle PR ferme: motore `directions.py`
   (#489); `errors.py`, `network.py`, `optimizer.py`, `pen_up.py`
   (#497); API `__main__.py` e `access.py` (#502, #525), `app.py` (#461),
   `push.py` (#525). `route_store.py` è libero. Migrazioni: 0023 della
   #502, 0024 della #525, 0025 in `main`: A da 0026 in su, il numero al
   merge.

## Contesto da leggere

- `docs/API.md`, «Gli esempi di una città, tenuti» e «Tempi»;
  `docs/DATABASE.md`, «Com'è oggi» (`runs`, `favorites`) e «Privacy dei
  dati di posizione»;
- `services/api/shaperoute_api/route_store.py` (tutto), `jobs.py`
  (`KeepsRoutes`, `submit`, `_run`), `best_routes.py` (`line_key`),
  `activities.py` (il salvataggio di una corsa), `favorites.py`;
- `services/route-engine/route_engine/nearby_starts.py`
  (`with_approach`, `NEARBY_MAX_M`, `APPROACH_MAX_M`), `route_nodes.py`
  (`nodes_along`), `directions.py` (`guidance`);
- per C: `docs/ROUTE_ENGINE.md` §2 (contorni, pezzi) e
  `route_engine/image_outline.py`, `pieces.py`, `pen_up.py`,
  `shapes/outline.py` (`pieces`, `pen_up_lines`), `__main__.py`
  (`--image`, `--pen-up`); nell'API `images.py` e `schemas.py`
  (`ImageRouteRequestBody`); nell'app la schermata della foto e
  l'interruttore «Pen up» delle parole (TASK-198).

## Parte A — API e database: l'archivio di tutti i percorsi (ADR-0256)

1. **Migrazione** `00NN_drawn_routes.sql` (numero al merge, ≥ 0026): la
   tabella `drawn_routes` — `id`, `drawn_at`, `engine` (impronta),
   `shape`, `word`, `style`, `distance_m`, `activity`, `pen_up`, `start`
   (`geography(Point, 4326)`, indice GiST), `route` (`geometry(LineString,
   4326)`), `result` (`jsonb`: il `RouteResult` senza indicazioni né
   alternative), `line_key`, `runs`, `favorites`, e le quattro colonne del
   piazzamento (`rotation_deg`, `phase`, `scale_m`, `offset_m`, usate da
   A2). **Niente `user_id`.** Indice sulla chiave della richiesta.
2. **`route_archive.py`** (nuovo): `RouteArchive`, un `KeepsRoutes` sul
   database.
   - `put(request, result)`: una riga per il percorso e una per ogni
     alternativa (la partenza di ognuna è il suo primo punto); mai per
     un'immagine né con `near`; un percorso già in archivio con la stessa
     `line_key` e la stessa richiesta non si ripete. Oltre il tetto (in
     una costante, circa 200 000 righe ≈ 2 GB) si cancellano le righe più
     vecchie senza corse né preferiti.
   - `get(request)`: stesso motore, stessa richiesta (`_same` di
     `route_store`), meno di 30 giorni. Entro 10 m: la riga, subito.
     Entro 100 m (`NEARBY_MAX_M`): la zona si carica, si cerca la via dal
     nodo più vicino alla partenza dell'utente al primo punto del percorso
     (`step_cost`), e se è entro 150 m (`APPROACH_MAX_M`) il percorso si
     restituisce con l'avvicinamento e il ritorno, come `with_approach`
     fa per una partenza vicina (una copia sui soli punti, perché la riga
     non ha i nodi: `route_nodes.nodes_along` li ritrova). Le indicazioni
     dai punti (`guidance`, come «Explore», ADR-0117).
   - Più righe che vanno bene: la prima per `runs + favorites`, poi
     somiglianza, poi distanza della partenza; le altre, fino a tre,
     come alternative.
   - Il `RouteStore` dei file resta dietro: `get` chiede prima
     all'archivio, poi ai file; `put` scrive a tutti e due (i file
     scartano da soli ciò che non parte da un centro).
3. **Dove si monta**: dove oggi nasce il `RouteStore` (`__main__.py`:
   della #502/#525, **una riga sola**), con il `Database` degli account
   quando c'è; senza database resta tutto com'è.
4. **I contatori**: `activities.py`, dopo il salvataggio di una corsa con
   un percorso, `runs + 1` sulla riga con quella `line_key` (una chiamata);
   `favorites.py` allo stesso modo (`+1` / `−1`). Niente di chi.
5. **Log ed eventi**: `job …: from the archive, 85 m away` e l'evento
   `route` con `ms` 0 e `by: "archive"`, come per i file.
6. **Test**: `tests/test_route_archive.py` con il database (come
   `test_strava.py`: saltano senza Docker, girano nella CI): stesso
   quadrato, entro 100 m con avvicinamento, oltre 100 m no, motore
   diverso no, 31 giorni no, l'ordine per corse e preferiti, le
   alternative, il tetto, un'immagine mai, `near` mai, la riga non ha
   chi; un test di `RouteJobs` con un archivio finto.
7. **Documenti**: `API.md` («L'archivio dei percorsi»), `DATABASE.md`
   (la tabella, la privacy), `STATUS.md`, questo file. Il testo privacy,
   da approvare: «I percorsi che il motore disegna restano sull'API senza
   chi li ha chiesti, per rispondere più in fretta a chi chiede lo stesso
   disegno vicino e per consigliarli».

**Parte A2** (dopo la #497, PR sua): il ridisegno rapido dal piazzamento.
`optimizer.search` prende un `first: Placement | None` e `first_scale`
facoltativi e li prova per primi, poi continua come oggi se il risultato
non è buono; senza `first` il risultato è quello di oggi (test con le
impronte dei percorsi, come `test_kept_per_graph.py`). L'API, quando la
riga ha un motore diverso o è vecchia, ridisegna da lì. Cambia il motore:
valgono le condizioni 2 e 4.

## Parte B — scartata (ADR-0257)

Niente codice. ADR-0257 tiene i numeri della prova perché la via non si
riprovi.

## Parte C — Le immagini con la penna alzata (ADR-0258)

**C, motore** (`feat/TASK-297-c-image-pieces`):

1. `image_outline.outline_data(…, pen_up=True)`: i soggetti dopo il
   primo e i **fori** che valgono almeno il 3 % del loro soggetto
   (`HOLE_SHARE`) diventano `pieces`, i più esterni prima (un foro prima
   di ciò che sta dentro); niente gambi (`_hung`). Un soggetto dentro un
   altro è un pezzo suo. Con `pen_up=False` tutto come oggi, byte per
   byte (test sulle immagini di `tools/sample_pictures.py`).
2. `parse_outline` non cambia: i pezzi passano gli stessi controlli delle
   forme in pezzi del catalogo (non si toccano, non si incrociano).
3. `ImageRequest.pen_up` accettato: il contorno a pezzi si compone come
   una forma in pezzi (`pieces.compose`) e la ricerca è quella delle
   parole con la penna alzata; senza pezzi, `pen_up` dà il contorno di
   oggi. CLI: `--image` con `--pen-up`.
4. Sette immagini sintetiche «da logo» disegnate in codice
   (`tools/sample_logos.py`, come `sample_pictures.py`: anello con stella,
   scudo a bande, montagne e sole, lettere RC, tre barre, scarpa con
   baffo, ruota a raggi) e il logo MuW già nel repository: test
   deterministici sul numero di pezzi, sui fori tenuti e scartati, e
   sull'ordine.
5. Misura prima e dopo (condizione 4): con `pen_up=False` niente cambia;
   per le forme del catalogo e gli esempi, niente da rifare se
   `route_engine` cambia solo in `image_outline.py` e `models.py`
   (l'impronta cambia comunque: `draw_examples` e gli altri si rifanno).

**C2, API e app** (`feat/TASK-297-c2-image-pieces-api-app`):

6. `POST /image-outlines` risponde anche `pieces` e `image_pieces` (vuoti
   senza); `POST /image-route-jobs` accetta `pen_up: true` con `pieces`
   nel corpo (rifiutato con `pen_up` e senza pezzi: `invalid_request` con
   il motivo); `walks` nel risultato come per le parole. `shared-types`
   in coda ai file.
7. App: l'interruttore «Pen up» delle parole anche sulla foto, proposto
   acceso quando il contorno ha pezzi; i pezzi disegnati sulla foto come
   i tratti; i tratti a piedi tratteggiati sulla mappa come oggi; la
   registrazione in pausa sui tratti a piedi come per le parole. Testi
   nuovi (se servono) nelle cinque lingue, da approvare.

## Criteri di accettazione

Documenti (questa PR):
- [ ] Questo file, ADR-0256, ADR-0257 e ADR-0258, le righe in
      `STATUS.md`.

Parte A (PR #539; i test sono in `tests/test_route_archive.py`, con
PostgreSQL, e in `tests/test_jobs.py`):
- [x] La stessa richiesta dallo stesso quadrato di 10 m riceve il job
      `done` nella risposta al `POST`
      (`test_the_same_start_answers_at_once_with_the_alternatives`,
      `test_a_second_phone_nearby_gets_the_route_through_the_api`).
- [x] Una richiesta a 50 m da un percorso tenuto riceve quel percorso con
      l'avvicinamento e il ritorno, i `walks` spostati, la distanza
      aggiornata; a 300 m no
      (`test_within_a_hundred_metres_the_route_is_reached_along_the_roads`,
      `test_beyond_a_hundred_metres_the_engine_draws`, sulla fixture di
      Levico).
- [x] Un motore diverso o 31 giorni: si ridisegna
      (`test_another_request_engine_or_an_old_route_is_drawn_again`).
- [x] Con due righe buone, la prima è quella con più corse e preferiti;
      la seconda è un'alternativa (`test_the_most_run_and_kept_goes_first`).
- [x] Nessuna riga ha chi l'ha chiesta; un'immagine e `near` non si
      tengono (`test_a_row_names_no_one`,
      `test_an_image_and_a_shape_moved_by_hand_are_not_kept`).
- [x] Oltre il tetto si cancellano prima le righe senza corse né
      preferiti (`test_over_the_cap_the_oldest_never_run_go_first`).
- [x] Il salvataggio di una corsa e un preferito aggiornano i contatori
      (`test_a_favorite_and_a_run_saved_count_on_the_archived_line`, dal
      `PUT` dell'app).
- [x] Senza database l'API si comporta come oggi: `__main__` monta
      l'archivio solo con il database; le suite senza database
      (`test_route_jobs`, `test_jobs`, `test_route_store`, `test_main`)
      girano come prima; uno store senza `nearby` non cambia `RouteJobs`
      (`test_jobs.py`).
- [x] Il motore sul telefono (`engine.zip`, TASK-214) disegna come prima:
      `jobs.py` viaggia con lui, rifatto; senza archivio e senza `nearby`
      (`test_on_phone.py::test_the_phone_draws_without_the_archive`), e
      lo zip non porta `route_archive` né psycopg
      (`tools/phone_engine/test_phone_engine.py`). L'impronta iOS la
      rimisura il Coordinatore su una copia pulita.
- [x] pytest, ruff e black verdi (in locale il 2026-10-24: i test
      dell'archivio, `test_jobs`, `test_route_jobs`, `test_route_store`,
      `test_main`, `test_favorites` e `test_activities`).
- [ ] **Dopo il merge**: il server dopo Apple con l'ok dell'utente, la
      migrazione (0026, o il numero libero al merge) e il testo della
      privacy approvato dall'utente.

Parte A2 (PR #7 su `LPPL1316/MUW`; i test sono in `tests/test_first_placement.py` del
motore e `tests/test_route_archive_redraw.py` dell'API, con PostgreSQL):
- [x] Senza `first` la ricerca è quella di oggi, tracciamento per
      tracciamento: impronte prese su `main` 5abf78d prima del cambio,
      sette ricerche fra griglia, città finta, Levico e «ciao»
      (`test_without_first_the_search_is_that_of_before`), e
      `test_kept_per_graph.py` invariato.
- [x] Con `first` buono la ricerca finisce al primo tracciamento con lo
      stesso percorso: dritto, inclinato di 30° (salta la fase dritta), da
      una partenza spostata di 500 m, le parole tonde e squadrate con e
      senza penna alzata, `plan_route` intero
      (`test_a_good_placement_draws_the_same_route_at_once`, …).
- [x] Con `first` non più buono la ricerca è quella di oggi, impronta
      per impronta, con 1–4 tracciamenti in più messi da parte
      (`test_a_placement_not_good_leaves_the_search_as_it_was`,
      `test_a_trace_set_aside_never_refuses_the_plan`).
- [x] L'API tiene il piazzamento della ricerca vicino alla partenza (non
      quello di una partenza vicina, né della ricerca lontana, né
      sull'acqua) e, con un motore diverso o una riga di più di 30 giorni,
      ridisegna da lì dalla partenza della riga e raggiunge il percorso
      dalla partenza dell'utente; non una riga senza piazzamento o non
      buona; il motore che non lo disegna lascia fare al pianificatore;
      attraverso l'API il pianificatore del job non parte
      (`test_through_the_api_the_route_of_before_is_drawn_again`).
- [x] Misura prima e dopo (condizione 4): `tests/measure_first_placement.py`
      sulle 17 forme del catalogo in quattro luoghi finti; i 68 piani senza
      `first` uguali a `main` impronta per impronta. Gli esempi tenuti e le
      città vere vogliono le zone del Mac (rete): nella PR.
- [x] Motore puro, contratto invariato; `engine.zip` rifatto (cambiano
      `optimizer.py` e `jobs.py`); pytest, ruff e black verdi.

Parte C (motore):
- [x] Con `pen_up=False` le sedici immagini di `sample_pictures` danno
      lo stesso contorno di oggi (test): `tools/test_sample_logos.py`,
      impronte sha256 calcolate su `main` 9391893c prima del cambio.
- [x] L'anello con la stella dà un contorno, due pezzi (il cerchio
      interno, la stella) nell'ordine esterno→interno; la ruota quattro
      pezzi; le lettere RC un contorno e due pezzi (la C, l'occhio
      della R); un foro sotto il 3 % non c'è (test):
      `tools/test_sample_logos.py`, `tests/test_image_pieces.py` (2 % no,
      4 % sì).
- [x] `--image … --pen-up` dalla CLI produce un percorso con `walks`,
      senza rete (test): `tests/test_image_pieces.py`, sulla griglia di
      `test_cli._GridSource` come `test_cli_image.py`, non sulla fixture
      di Levico: lì un'immagine a pezzi da 1–2 km manda la ricerca
      lontano, che su un grafo che ignora l'area cade in
      `optimizer.next_scale` (`ZeroDivisionError`; seguito, con la #497).
- [x] Catalogo ed esempi tenuti misurati prima e dopo: nessuna forma
      peggiora (`tests/test_kept_per_graph.py` invariato: il catalogo non
      passa da `image_outline.py`); nella PR #547 l'elenco di cosa
      rifare (condizione 4).

Parte C2 (API e app):
- [ ] `POST /image-outlines` e `POST /image-route-jobs` con i pezzi
      (test); `pen_up` senza pezzi rifiutato con il motivo.
- [ ] L'interruttore sulla foto, i pezzi disegnati, i tratti a piedi
      sulla mappa (test jest); impronta iOS invariata; lint, typecheck,
      test e format:check verdi.

## File toccati

Documenti (questa PR):
```
docs/tasks/TASK-297.md        (nuovo)
docs/DECISIONS.md             (ADR-0256, ADR-0257, ADR-0258 in fondo)
docs/STATUS.md                (righe nuove)
```

Parte A:
```
services/api/migrations/00NN_drawn_routes.sql             (nuovo, numero al merge)
services/api/shaperoute_api/route_archive.py              (nuovo)
services/api/shaperoute_api/jobs.py                       (il protocollo FindsNearby e RouteJobs._nearby)
services/api/shaperoute_api/__main__.py                   (l'archivio davanti al RouteStore quando c'è il database: import, un'istruzione, l'argomento di create_app; file della #502/#525)
services/api/shaperoute_api/activities.py                 (una chiamata dopo il salvataggio)
services/api/shaperoute_api/favorites.py                  (una chiamata)
services/api/tests/test_route_archive.py                  (nuovo)
services/api/tests/test_jobs.py                           (un test con un archivio finto, in coda)
services/api/tests/test_on_phone.py                       (un test: il telefono senza archivio, in coda)
apps/mobile/assets/engine/engine.zip                      (rifatto: jobs.py va anche sul telefono, TASK-214; da pubblicare su preview)
tools/phone_engine/test_phone_engine.py                   (un test: il telefono non porta l'archivio né psycopg)
docs/API.md, docs/DATABASE.md, docs/STATUS.md, docs/tasks/TASK-297.md
```

Parte A2 (dopo la #497):
```
services/route-engine/route_engine/optimizer.py           (`first` e `first_scale` facoltativi in `search`)
services/route-engine/tests/test_first_placement.py       (nuovo)
services/api/shaperoute_api/route_archive.py              (il ridisegno da lì)
docs/ROUTE_ENGINE.md §5, docs/DECISIONS.md (aggiunta ad ADR-0256), docs/STATUS.md, docs/tasks/TASK-297.md
```
Come fatta nella PR #7, con i file **fuori elenco** segnati (la 0026
non ha le colonne del piazzamento, e il `RouteResult` non lo porta: lo
porta il `Plan`, che `RouteJobs` passa all'archivio):
```
services/route-engine/route_engine/optimizer.py           (`first` e `first_scale_m` in `search`, `plan_shape`, `plan_route`)
services/route-engine/tests/test_first_placement.py       (nuovo)
services/route-engine/tests/measure_first_placement.py    (nuovo: la misura prima e dopo)
services/api/shaperoute_api/route_archive.py              (`put_plan`, il ridisegno da lì, la riga rinfrescata)
services/api/migrations/0035_drawn_routes_placement.sql   (nuovo, fuori elenco: le colonne del piazzamento; numero al merge)
services/api/shaperoute_api/jobs.py                       (fuori elenco: `KeepsPlacements`, il piano allo store, i grafi dell'archivio dimenticati)
services/api/tests/test_route_archive_redraw.py           (nuovo)
apps/mobile/assets/engine/engine.zip                      (fuori elenco: rifatto, `test_phone_engine.py` lo vuole al passo)
docs/API.md, docs/DATABASE.md                             (fuori elenco: l'archivio e la 0035)
docs/ROUTE_ENGINE.md §5, docs/DECISIONS.md (aggiunta ad ADR-0256), docs/STATUS.md, docs/tasks/TASK-297.md
```

Parte C (motore), come fatta nella #547 (`models.py` non serve:
`ImageRequest` vive in `images.py` dell'API):
```
services/route-engine/route_engine/image_outline.py       (`pen_up`, i pezzi e i fori)
services/route-engine/route_engine/__main__.py            (`--image` con `--pen-up`)
services/api/shaperoute_api/images.py                     (`ImageRequest.pen_up`, `image_job` con i pezzi; contratto HTTP invariato)
services/route-engine/tests/test_image_pieces.py          (nuovo)
services/api/tests/test_image_pen_up.py                   (nuovo; `test_images.py` resta a C2)
services/route-engine/tests/test_pen_up.py                (il vecchio test che rifiutava `--pen-up` con `--image`)
tools/sample_logos.py, tools/test_sample_logos.py         (nuovi)
apps/mobile/assets/engine/engine.zip                      (rifatto: `test_phone_engine.py` lo vuole al passo col motore)
docs/ROUTE_ENGINE.md §2, docs/DECISIONS.md (aggiunta ad ADR-0258), docs/STATUS.md, docs/tasks/TASK-297.md
```

Parte C2 (API e app):
```
services/api/shaperoute_api/images.py, schemas.py
services/api/tests/test_images.py
packages/shared-types/src/index.ts                        (in coda)
apps/mobile/src/… (la schermata della foto, il contorno sulla foto, i18n in coda)
docs/API.md, docs/UI.md, docs/STATUS.md, docs/tasks/TASK-297.md
```

## Fuori scope

- L'AI che disegna o suggerisce geometrie: mai.
- I consigli di «Explore» dall'archivio (TASK-092 può leggerlo in un
  task suo).
- Il punteggio (TASK-241).
- `route_chosen` come contatore dell'archivio: vuole la `line_key` nel
  segnale dell'app; da aprire quando le scelte saranno più di qualche
  decina.
- Più di quattro soggetti in un'immagine (`MAX_SUBJECTS`, ADR-0079): da
  rivedere con una prova a parte.
- Lettere lette come testo: una foto di una scritta resta un disegno.

## Seguiti

- **TASK-298 — Fermarsi prima nella ricerca** (ADR-0259; sì dell'utente
  al Coordinatore, «sì, apri anche quello per fermarsi prima», 2026-10-24):
  in 19 casi su 36 la ricerca spende tutti i 30 tracciamenti senza un
  percorso buono (gatto 6 su 6, lumaca 5 su 6, cuore da 2 km 6 su 6), e
  sono i 6–14 s per un disegno mediocre. Per esempio: dopo N tracciamenti
  senza miglioramento, o quando il conteggio delle strade dice che nessun
  piazzamento copre abbastanza. Condizioni del Coordinatore: non si perde
  nessun percorso buono (misurare su quale tracciamento si trova il primo
  percorso buono, nelle 36 richieste e in più città; la regola tiene tutti
  i 17 buoni di Trento o dice quale perde e perché, in una tabella
  prima/dopo con buoni, tracciamenti e secondi); quando si ferma la
  risposta resta quella di oggi per «nessun percorso» (TASK-256); la
  regola sta nel motore, puro, così vale anche sul telefono; server dopo
  Apple con l'ok dell'utente; riallineo su #489 e #497; `draw_examples`,
  `engine.zip`, `paddleExamples.json` e `catalogueShapes.json` rifatti.
  Il task file `TASK-298.md` lo crea chi lo fa, in un contesto nuovo, dopo
  la parte C (o prima, se le misure lo dicono: `optimizer.py` è suo,
  `image_outline.py` è di C).

## Esito

**Parte A** (2026-10-25, #539 in `main` a `0c4ada00`): ogni percorso
finito e ogni alternativa restano in `drawn_routes` senza chi li ha
chiesti; la stessa richiesta dallo stesso punto riceve il job `done` nel
`POST`, entro 100 m il percorso raggiunto lungo le strade nel thread del
job, i più corsi e preferiti davanti. Contratto invariato; `engine.zip`
rifatto perché `jobs.py` va sul telefono (impronta iOS invariata); su
`preview` (gruppo `e0e4e126`). Emerso: la riga va chiave sulla partenza
chiesta, non sul primo punto del percorso (il motore parte dal nodo più
vicino, 20 m più in là); un job è `done` prima che `put` scriva la riga.
Rimandato: il server dopo Apple con l'ok dell'utente e il paragrafo della
privacy (lo raccoglie TASK-284 B); A2 (il ridisegno rapido dal
piazzamento) dopo la #497. Il resto si compila a fine task.

**Parte C, motore** (2026-10-25, PR #547 aperta): `outline_data(…,
pen_up=True)` mette in `pieces` i soggetti dopo il primo e i fori che
valgono almeno il 3 % del loro soggetto (`HOLE_SHARE`), dal più grande al
più piccolo, senza gambi; un soggetto dentro un foro è un pezzo suo; i
pezzi passano `parse_outline` e `pieces.compose`; con `pen_up=False` le
sedici immagini di «Draw» danno lo stesso contorno byte per byte.
`ImageRequest.pen_up` e `--image … --pen-up` cercano come una forma a
pezzi; senza pezzi il contorno di oggi (dalla CLI con un avviso). Sette
loghi sintetici e il marchio MuW del lancio in `tools/sample_logos.py`:
anello con stella 2 pezzi (il cerchio interno, poi la stella), scudo 1,
montagne e sole 1, «RC» 2 (la C, l'occhio della R), tre barre 2, scarpa
1, ruota 4, MuW 2. `engine.zip` rifatto dopo l'allineamento alla #489; da
rifare ancora dopo la #497. Emerso: la ricerca lontana su un grafo
piccolo che ignora l'area (`FileSource`) cade in `optimizer.next_scale`
con `ZeroDivisionError`; il test della CLI usa la griglia. Rimandato: C2
(API e app), `draw_examples` e gli altri file derivati dopo Apple.

**Parte A2** (2026-10-26, in `main` di `LPPL1316/MUW` con la #7, `e789e9c`, 2026-10-29, mergiata
con il sì dell'utente a CI verde; sessione cloud): `search` prova
per primo il piazzamento di prima (`first`, `first_scale_m`); buono, si
ferma lì, altrimenti i suoi tracciamenti vanno da parte e la ricerca è
quella di oggi. L'archivio tiene il piazzamento della ricerca vicino alla
partenza e, con un motore diverso o una riga vecchia, ridisegna la riga
buona dalla sua partenza e la raggiunge dalla partenza dell'utente.
Misura (`tests/measure_first_placement.py`, 17 forme del catalogo su
griglia, città finta, griglia girata di 30° e Levico, pianificatore
dell'API senza processi): senza `first` 68 piani su 68 identici a `main`;
con il piazzamento di prima, i 19 piani buoni stesso percorso con 19
tracciamenti della partenza invece di 56 (la luna sulla griglia girata 26
→ 1), i 23 non buoni stesso percorso con 714 invece di 657. Emerso: la
0026 non aveva le colonne del piazzamento e il `RouteResult` non lo porta
(migrazione nuova, `jobs.KeepsPlacements`); scegliere fra i tracciamenti
di `first` non buono faceva rifiutare un piano (il cerchio della città
finta), quindi vanno da parte; una riga di più di 30 giorni ridisegnata
uguale non si rinfrescava; le indicazioni del motore si leggevano sul
grafo dell'archivio quando questo non rispondeva. Rimandato: le città vere
e gli esempi tenuti (zone del Mac, `--cache-dir`), il server dopo Apple,
`draw_examples`, `paddleExamples.json`, `catalogueShapes.json`.
