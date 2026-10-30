# TASK-323 — Nuoto in acque libere («Open water swim»)

**Stato**: In lavorazione · A1 scritta, in bozza (2026-10-29, «A1, dove si
è» più sotto); i documenti in `main` con la #609. L'utente il 2026-10-28:
«parti proprio con il progetto secondo me funziona»; le parti partono una
alla volta, ognuna nella sua sessione
**Fase**: 5 · **Branch**: `docs/TASK-323-open-water-swim` (documenti); le
parti `feat/TASK-323-a1-swim-band` e così via
**Dipende da**: TASK-191 (l'acqua della canoa, in `main`). La parte C dopo
TASK-318 (le build dello store nascondono gli sport non pronti, tocca
`sport.ts`); la parte D dopo TASK-312 (l'importazione); la parte E con
TASK-321 (Apple Salute, sessione local_f4599f22) nella build 1.0.1.
**ADR**: ADR-0283 (proposto). Numeri dal Coordinatore il 2026-10-28

## Condizioni del Coordinatore (2026-10-28)

1. **La canoa non cambia**: se il nuoto riusa l'acqua della canoa, i
   percorsi della canoa restano gli stessi, e l'impronta del motore con cui
   `route_store` tiene gli esempi (`engine_fingerprint`) resta la stessa,
   con un test. Se non si può, la PR dice perché e quali esempi tenuti si
   ridisegnano.
2. **Sono scelte di prodotto, dell'utente**: l'avviso di sicurezza, le
   distanze dalla riva, cosa si promette e i testi in cinque lingue.
3. **D ed E sono nativi**: vanno con una build nuova per l'App Store,
   insieme alla 1.0.1 e ad Apple Salute di TASK-321. Nessuna parte tocca i
   file di TASK-321, né il contrario.
4. **La riga dello sport** entra con `ready: false` finché il motore non
   c'è: con TASK-318 le build dello store non la mostrano.
5. **«File toccati» al Coordinatore prima di ogni parte.**

## Obiettivo

Chi sceglie «Open water swim» riceve un giro a nuoto che disegna una forma
del catalogo nell'acqua del mare o di un lago, **dentro la fascia dei
bagnanti**, con partenza e arrivo dalla stessa spiaggia. Prima di entrare
vede le curve, ognuna col posto a riva davanti a cui girare. Nuota con il
telefono nella boa di sicurezza o con il suo orologio, e la traccia diventa
il disegno nel Feed. Dopo (parte E, col sì dell'utente su dipendenze e
build) l'Apple Watch guida in acqua con le vibrazioni.

## Contesto

L'utente il 2026-10-28: «Anche nuoto acque libere potresti mettere dentro
come sport, poi per le indicazioni di dove nuotare dimmi te come fare se
hai suggerimenti, tutto con l'orologio deve fare presumo». La proposta
della sessione (in chat): l'acqua della canoa con la fascia rovesciata, le
curve con i nomi a riva, la guida con l'orologio in due fasi. Risposta:
«parti proprio con il progetto secondo me funziona».

Quello che c'è già (`ROUTE_ENGINE.md` §8): per la canoa la forma piazzata
**è** il percorso se sta tutta nella fascia; `water.py` tiene l'acqua
entro 1000 m dalla riva **meno 200 m al mare e 50 m sui laghi** (fuori dai
bagnanti, scelta dell'utente per TASK-191) e trova i punti della riva
raggiungibili a piedi; `water_fit.py` cerca scala, angolo e centro;
il percorso è riva → forma → riva. L'acqua di 67 posti di mare e di lago è
sul server (TASK-225, TASK-245 C); sul Mac ci sono solo due riquadri di
laghi vicino a Trento, Caldonazzo e Levico e i laghi di Piné
(`data/cache/water/`).

## Scelte dell'utente (2026-10-28)

- **Il nuoto in acque libere è uno sport di MuW**, con il progetto come
  proposto: la fascia dei bagnanti, le curve con i nomi a riva, prima senza
  codice per l'orologio (telefono nella boa o file dell'orologio), poi
  l'app per Apple Watch.
- Restano dell'utente, quando arriva la parte che li usa (una domanda per
  volta, con la proposta qui sotto): la fascia e le distanze dopo i
  campioni (A1), nome, testi e avviso di sicurezza (C), le dipendenze e la
  build dell'orologio (E).

## Il punto, in breve

- **Il modello**: quello della canoa, con la fascia rovesciata. La canoa
  sta *oltre* i 200 m al mare; il nuoto sta **fra 20 e 150 m dalla riva**,
  al mare e sui laghi (proposta), cioè dentro la zona dove di solito le
  barche a motore non entrano (le ordinanze locali dicono di solito 200 m
  dalle spiagge e 100 m dalle coste a picco, ma cambiano da posto a posto:
  il motore non le conosce). Partenza e arrivo sulla stessa spiaggia; si
  entra solo da una spiaggia o da una via pedonabile, non da uno scivolo né
  da un molo. Porti, marine e foci di fiumi a 200 m (proposta; la canoa ne
  tiene 30). **Il motore decide dove e quanto grande; l'AI interpreta
  soltanto.**
- **Il rischio da misurare prima di tutto** (A1): una fascia larga 130 m su
  una costa dritta tiene solo forme piccole (un cerchio di 130 m è circa
  0,4 km) o la forma va in una baia o in un lago. A1 misura la forma più
  grande che ci sta nei posti dell'acqua già scaricata, e l'utente giudica i
  campioni come per la canoa.
- **Le distanze**: 0,5–3 km (proposta). Fuori da ciò che ci sta, l'errore
  dice a quanti km la forma ci sta, come per la canoa.
- **Le curve con un nome a riva** (A2): in acqua ci si orienta alzando la
  testa verso un punto a terra. Per ogni curva il motore cerca il posto con
  un nome più vicino sulla riva di fronte, da OpenStreetMap (stabilimenti
  balneari, pontili, fari, alberghi, chiese, bar sulla spiaggia): «Turn
  opposite Bagno 54». È un dato, non un testo dell'AI. Serve un estratto
  nuovo dei posti con nome lungo la riva: lo scarica il server, col sì
  dell'utente.
- **La guida, fase 1 (A–D)**: niente codice per l'orologio. Prima di
  entrare l'app mostra la forma e le curve. In acqua il telefono non si
  guarda e la voce non si sente: nessuna guida. La traccia si registra con
  il telefono nella boa di sicurezza (sta a galla, il GPS prende meglio che
  al polso) o con la modalità nuoto dell'orologio, poi il file si importa
  (TASK-312).
- **La guida, fase 2 (E)**: un'app per Apple Watch. Riceve il giro, avvia un
  allenamento di nuoto in acque libere, vibra prima di ogni curva (destra e
  sinistra diverse) e quando si esce di rotta, mostra una freccia grande con
  i metri alla prossima curva per chi alza la testa, e rimanda la traccia
  al telefono. È codice nativo: una dipendenza nuova, una build nuova per
  l'App Store (l'impronta iOS 83793e26 cambia) e una prova in acqua prima di
  pubblicarla. Se le vibrazioni si sentono mentre si nuota non lo sa
  nessuno finché non si prova.
- **Garmin**: dal manuale la modalità nuoto in acque libere non segue un
  percorso. Chi ha un Garmin registra col suo orologio e importa il file
  (TASK-312). Un'app Connect IQ è fuori da questo task.
- **La stagione**: in Italia è finita. Le prove in acqua (D ed E) sono fra
  primavera ed estate 2027; A–C si possono fare prima.

## Cosa fare

Parti piccole, una sessione per parte, nell'ordine. Ogni parte è un branch
e una PR, e chiede al Coordinatore i suoi «File toccati» prima del codice.
Dove si può, file **nuovi**: la canoa non deve cambiare di un metro.

### A1 — Motore: la fascia del nuoto

0. **Prima del codice, l'impronta** (condizione 1): `engine_fingerprint`
   (`services/api/shaperoute_api/route_store.py`) legge ogni `.py` e
   `.json` del motore tranne `NOT_ROUTES`, quindi toccare `models.py` o
   `water.py` cambia l'impronta e fa ridisegnare tutti gli esempi tenuti
   (`draw_examples` sul server, lo zip del motore sul telefono). A1 sceglie
   e scrive al Coordinatore, prima del codice, una delle due strade: il
   nuoto tutto in file nuovi che i moduli della corsa, della bici e della
   canoa non importano, con un'impronta sua per i giri a nuoto e un test
   che l'impronta di prima non cambia; oppure la fascia per attività dentro
   `water.py`, dicendo quali esempi tenuti si ridisegnano e quando.
1. `swimming` in `DISTANCE_LIMITS_M` (500–3000 m) e in `WATER_ACTIVITIES`
   (`models.py`).
2. La fascia per attività: `water.py` prende i limiti (distanza minima e
   massima dalla riva, margine dagli ostacoli, tipi di accesso) da un
   profilo per attività; quello della canoa ha i valori di oggi, quello del
   nuoto 20–150 m, 200 m da porti, marine e foci, accesso `beach` e
   `path`.
3. `swimming.py` (nuovo), come `paddling.py`: `plan_swimming` disegna la
   forma del catalogo, la piazza con `water_fit` nella fascia del nuoto, la
   controlla e dà un `RouteResult`. `--activity swimming` nella CLI.
4. `validation.check_on_water` controlla anche la distanza **minima** e
   **massima** dalla riva del profilo.
5. I campioni: cerchio, cuore e stella a 0,5, 1 e 1,5 km a Levico e
   Caldonazzo (acqua sul Mac) e in quattro posti di mare (Riccione, Jesolo
   e due fra i 67). L'acqua del mare la scarica Overpass dal Mac; se non
   risponde, si chiede all'utente di copiarla dal server. Più la tabella
   della forma più grande che ci sta per posto. Pagina a griglia
   `out/TASK-323/swim-samples-grid.html` per l'utente.

Criteri: dalla CLI, senza rete né chiavi, sull'acqua in cache, un giro a
nuoto di 1 km a Levico sta tutto fra 20 e 150 m dalla riva e parte e torna
alla stessa spiaggia; i test della canoa passano **senza cambiare un
valore** e `paddleExamples.json` resta uguale; l'impronta degli esempi
tenuti resta la stessa, con un test, o la PR dice cosa si ridisegna; la
pagina dei campioni c'è.

File (da confermare col punto 0; con la prima strada si aggiungono
`route_store.py` e il suo test): `services/route-engine/route_engine/models.py`,
`services/route-engine/route_engine/water.py`,
`services/route-engine/route_engine/water_fit.py`,
`services/route-engine/route_engine/swimming.py`,
`services/route-engine/route_engine/validation.py`,
`services/route-engine/route_engine/__main__.py`,
`services/route-engine/tests/test_swimming.py`, `docs/ROUTE_ENGINE.md` §8
(una sottosezione nuova).

#### A1, dove si è (2026-10-29)

Scritta in una sessione cloud, branch `claude/inspiring-lovelace-rcadwd`
(il nome lo impone la sessione), PR in bozza
[LPPL1316/MUW#10](https://github.com/LPPL1316/MUW/pull/10). Il Coordinatore
non era raggiungibile: la strada del punto 0 è scelta su delega dell'utente
e scritta nell'aggiunta ad ADR-0283; va confermata con i «File toccati» qui
sotto prima del merge.

**Il push dal cloud** (2026-10-29): su `rockydalbianco/shaperoute` la
sessione cloud riceve 403, sia col push sia con lo strumento GitHub (l'app
Claude non ci può scrivere). Funziona così, col sì dell'utente: `add_repo`
di `LPPL1316/MUW` con accesso `push`, un remote `muw` nel checkout, `git
fetch muw main`, poi `git push -u muw <branch>`. Lo specchio
(`TEAM_WORKFLOW.md`) copia il branch su `shaperoute` in pochi secondi. La PR
su `shaperoute` resta da aprire a mano (anche quella dà 403 dal cloud);
dal cloud si apre in bozza su MUW. L'utente ha chiesto di dirlo al
Coordinatore, perché valga per tutte le sessioni cloud.

- **Punto 0, la prima strada**: tutto in file nuovi; `models.py`,
  `water.py`, `water_fit.py`, `validation.py`, `paddling.py` e
  `__main__.py` non cambiano. `route_store` lascia fuori i file del nuoto
  (`SWIM_ONLY`), con il test. Impronte come in `main`: `route_store`
  `abaea5bb82b3`, esempi della canoa `1b6759cb3cc4`. I punti 1 e 4 e
  `--activity swimming` passano a B (con `models.py`); al loro posto
  `SwimRequest` (0,5–3 km), `check_in_band` e
  `python -m route_engine.swimming`.
- **I campioni**: solo sulle due acque di prova del motore (la sessione
  cloud non raggiunge Overpass né il server). Pagina per l'utente:
  https://claude.ai/artifact/UYiPvDiPaiJetF9z5ntoEX. Levico, Caldonazzo,
  Riccione e Jesolo si misurano sul Mac con `tests/measure_swim.py`
  (comando in `ROUTE_ENGINE.md` §8).
- **Il rischio c'è**: con 20–150 m un giro ci sta da 0,4–0,5 km lungo una
  costa dritta e la riva di un lago grande.
- **Domanda 1, risposta dell'utente (2026-10-29)**: «Giri ripetuti». La
  fascia resta 20–150 m, le distanze 0,5–3 km; un nuoto più lungo della
  forma la ripassa a giri, al massimo 5 (`MAX_LAPS`). I campioni del task
  ci stanno tutti, in 1–4 giri; 5 giri arrivano a 1,7–2,1 km lungo una
  costa dritta, 3 km solo dove un giro è di 0,6 km.
- **Richiesta dell'utente dello stesso giorno**: «dai la possibilità di
  disegnare anche sull'acqua e di modificare la forma più grande e più
  piccola». Nel motore del nuoto, in A1: `SwimRequest.outline` (un disegno
  come «Freehand») e `SwimRequest.laps` (meno giri, forma più grande; la
  distanza resta). Per la canoa va con B (tocca `models.py`), lo schermo
  con C. Aggiunta ad ADR-0283.
- **Prossimo**: i posti veri sul Mac con `tests/measure_swim.py`; la
  conferma dei «File toccati» e della canoa disegnata in B al
  Coordinatore; poi B.

File toccati da A1:

```
services/route-engine/route_engine/swim_water.py        (nuovo)
services/route-engine/route_engine/swimming.py          (nuovo)
services/route-engine/tests/test_swimming.py            (nuovo)
services/route-engine/tests/measure_swim.py             (nuovo)
services/api/shaperoute_api/route_store.py              (SWIM_ONLY)
services/api/tests/test_swim_fingerprint.py             (nuovo)
apps/mobile/assets/engine/engine.zip                    (rifatto)
docs/ROUTE_ENGINE.md                                    (§8, sottosezione)
docs/tasks/TASK-323.md
docs/DECISIONS.md                                       (aggiunta ad ADR-0283)
docs/STATUS.md                                          (le righe di TASK-323)
```

### A2 — Motore: le curve e i nomi a riva

1. `swim_turns.py` (nuovo): le curve del giro (dove la direzione cambia più
   di 45°), ognuna con la distanza dalla partenza, il verso (destra o
   sinistra) e l'angolo.
2. `shore_names.py` (nuovo): per ogni curva il posto con un nome più vicino
   sulla riva di fronte, entro 300 m, con il tipo e la direzione in cui
   guardarlo. I posti arrivano come file in una cartella nuova della cache
   (`<cache>/shore_names/`); senza file, le curve non hanno nome.
3. `RouteResult.turns` per il nuoto; le curve come waypoint nel GPX.

Criteri: su una fixture con tre posti con nome, ogni curva ha il nome
giusto; senza file, nessun nome e nessun errore; tutto senza rete.

File: `services/route-engine/route_engine/swim_turns.py`,
`services/route-engine/route_engine/shore_names.py`,
`services/route-engine/route_engine/models.py`,
`services/route-engine/route_engine/export_gpx.py`,
`services/route-engine/tests/test_swim_turns.py`,
`services/route-engine/tests/fixtures/shore_names_*.json`.

#### A2, dove si è (2026-10-29)

Scritta nella stessa sessione cloud di A1, su richiesta dell'utente («Prima
A2», alla domanda su B), branch `feat/TASK-323-a2-swim-turns` partito da
A1, poi allineato a `main` dopo che A1 c'è entrata (rockydalbianco/shaperoute#640).
«File toccati» mandati al Coordinatore prima del codice. Aggiunta ad
ADR-0283.

- `swim_turns.py`: le curve (oltre 45°, guardate 15 m prima e dopo), con
  punto, metri dalla partenza, verso, angolo e giro; `with_turns` mette nel
  GPX un waypoint per ogni curva del primo giro.
- `shore_names.py`: il posto con un nome più vicino entro 300 m, col tipo e
  la direzione in cui guardarlo, dai file di `<cache>/shore_names/` (il
  formato che B deve scrivere è in `ROUTE_ENGINE.md` §8). Senza file,
  nessun nome e nessun errore.
- `SwimPlan.turns` al posto di `RouteResult.turns`, e niente
  `export_gpx.py`: tutti e due vanno con B, insieme a `models.py`, perché
  cambiano le impronte. Impronte come in `main`.
- Criteri: sulla fixture `shore_names_coast.json` (tre posti) ogni curva ha
  il nome giusto, il faro oltre 300 m nessuna; senza file nessun nome e
  nessun errore; tutto senza rete (`tests/test_swim_turns.py`).

File toccati da A2:

```
services/route-engine/route_engine/swim_turns.py         (nuovo)
services/route-engine/route_engine/shore_names.py        (nuovo)
services/route-engine/route_engine/swimming.py           (di A1: le curve)
services/route-engine/tests/test_swim_turns.py           (nuovo)
services/route-engine/tests/fixtures/shore_names_coast.json (nuovo)
services/api/shaperoute_api/route_store.py               (SWIM_ONLY)
apps/mobile/assets/engine/engine.zip                     (rifatto)
docs/ROUTE_ENGINE.md, docs/tasks/TASK-323.md, docs/DECISIONS.md,
docs/STATUS.md
```

### B — API e server

1. `swimming` nel contratto (`packages/shared-types`, `SUPPORTED_ACTIVITIES`
   dell'API), con `turns` nella risposta.
2. Una migrazione che apre i vincoli sull'attività (preferiti, disegni,
   gioco, corse di gruppo) a `swimming`: numero dal Coordinatore quando
   parte.
3. Il comando che taglia i posti con nome lungo la riva dall'estratto
   dell'Italia, come `water_extract.py`.
4. Sul server, **col sì dell'utente**: l'estratto dei nomi e, per
   «Explore», un `draw_examples --water` per il nuoto.

#### B, dove si è (2026-10-30)

Scritta nella stessa sessione cloud, su richiesta dell'utente («passa alla
parte B»), branch `feat/TASK-323-b-swim-api` allineato a `main` dopo A2
(rockydalbianco/shaperoute#640 e LPPL1316/MUW#11). «File toccati» mandati
al Coordinatore prima del codice. Aggiunta ad ADR-0283.

- Punto 1: `swimming` nel contratto del motore e dell'API, coi giri
  (`laps`) nella richiesta e giri e curve (`laps`, `turns`) nella risposta;
  in `shared-types` `API_ACTIVITIES` e le fixture del nuoto. `Activity`
  dell'app resta a tre fino alla parte C (decisione 2 dell'aggiunta).
- Punto 2: `0039_swimming.sql` (preferiti, corse, corse di gruppo); il
  gioco e i disegni leggono `runs.activity` e non hanno un elenco loro.
- Punto 3: `shore_extract.py`, i posti con nome lungo la riva da un
  estratto, nei file che il motore legge.
- In più: un disegno a nuoto da `/image-route-jobs`; i nuoti tenuti con
  un'impronta loro; il GPX di `POST /gpx` con le curve; Strava `Swim`;
  `--activity swimming --laps N` nel comando del motore.
- Punto 4 e **il blocco**: col sì dell'utente, sul server l'estratto dei
  nomi, `draw_examples` (l'impronta degli esempi cambia) e
  `paddleExamples.json` rifatto con l'acqua del server. Dalla sessione
  cloud non si raggiunge: `test_paddle_examples` resta rosso finché il
  Mac non lo rifà. `draw_examples --water` per il nuoto serve a «Explore»,
  quindi va con la parte C.
- `lap_m` nella risposta (2026-10-30, per la parte C: «3 laps of 320 m»
  sotto il nuoto, scelta dell'utente): quanto è lungo un giro, senza i
  tratti dalla riva.
- Impronte dopo B: esempi tenuti `5b5e026cea9b` (i nuoti `b9d00c37d28d`),
  esempi della canoa `574fbfba41eb` (il file dell'app dice ancora
  `1b6759cb3cc4`). Il codice che disegna la canoa non cambia: rifatti,
  gli esempi dovrebbero cambiare solo nel campo `engine`.

File toccati da B:

```
services/route-engine/route_engine/models.py, __main__.py, swimming.py,
  swim_turns.py, shore_names.py
services/route-engine/tests/test_swimming.py, test_contract.py,
  test_better_distance.py, test_bike_network.py, test_cli.py,
  test_paddling.py (il nuoto non è più «un'attività che non c'è»)
services/api/shaperoute_api/paddling.py, jobs.py, images.py, schemas.py,
  app.py, activities.py, strava.py, route_store.py, shore_extract.py (nuovo)
services/api/migrations/0039_swimming.sql (nuovo)
services/api/tests/test_swimming_api.py, test_shore_extract.py (nuovi),
  test_contract.py, test_cycling.py, test_route_store.py,
  test_swim_fingerprint.py, test_better_distance.py, test_rotation.py,
  test_request_log.py (i campi nuovi `laps` e `turns`)
packages/shared-types/src/index.ts, test/contract.test.ts,
  fixtures/contract.json, fixtures/route-request-swimming.json (nuovo),
  fixtures/route-result-swimming.json (nuovo)
apps/mobile/assets/engine/engine.zip (rifatto)
docs/API.md, docs/DATABASE.md, docs/ROUTE_ENGINE.md, docs/DECISIONS.md,
docs/STATUS.md, docs/tasks/TASK-323.md
```

### C — App: lo sport

1. «Open water swim» 🏊 in «Settings» e nel menu degli sport di «Draw»
   (dopo TASK-318), con la sua attività. La riga entra con `ready: false`
   (condizione 4: le build dello store non la mostrano) e si accende quando
   A1, A2 e B sono in `main` e sul server.
2. L'avviso di sicurezza la prima volta e la riga fissa sotto ogni giro
   (testi da far approvare, proposta nell'ADR).
3. Sul risultato, prima di «Start», l'elenco delle curve con i nomi a riva.
4. I posti d'acqua in «Explore» con gli esempi a nuoto.
5. Testi in cinque lingue, col sì dell'utente.

#### C, dove si è (2026-10-30)

Scritta nella stessa sessione cloud, su richiesta dell'utente («passa alla
parte C»), branch `feat/TASK-323-c-swim-app` partito da quello di B
(MUW#12, non ancora in `main`): a C serve il contratto del nuoto. Quando B
entra, si fa il merge di `main` dentro C. Il Coordinatore («Coordinatore
automatico 23 ore») era archiviato: i «File toccati» sono qui e nella PR.
Aggiunta ad ADR-0283.

- **Testi inglesi approvati dall'utente** il 2026-10-30 («Sì, così»): 🏊
  «Open water swim», l'avviso «Before you swim» com'era proposto in
  ADR-0283, la riga «Within 150 m of the shore. Never swim alone.».
- **C1, fatta**: la riga dello sport con `ready: false` dopo «Paddle»
  (in Expo Go e `preview` con «Soon», nascosta nello store da TASK-318;
  finché è «Soon» va come una corsa, come il parapendio); in `src/swim/`
  l'avviso col suo file `swim-notice.json` e `useSwimNotice`, la riga sotto
  il giro (`SwimRouteNote`), l'elenco delle curve del primo giro
  (`SwimTurns`, `swimTurns.ts`). Test con la fixture del contratto.
- **Approvati dall'utente** il 2026-10-30 («Sì, così», seconda domanda):
  i testi delle curve («TURNS», «Turn left · {place}», «{distance} from the
  start», «The same turns every lap, {laps} laps, then back to the
  shore.») e le traduzioni di tutti i testi nuovi in italiano, tedesco,
  spagnolo e francese.
- **C2, dopo B in `main`**: `Activity` dell'app con `swimming`, che tocca
  `src/health/appleWorkout.ts` e `healthConnectWorkout.ts` di TASK-321
  (condizione 3: col via del Coordinatore, il tipo di allenamento del nuoto
  in Salute e in Health Connect); `activityOf("swim")` = `"swimming"`; in
  `App.tsx` l'avviso al «Start» di un nuoto, e nel pannello del percorso la
  riga e l'elenco; `ready: true` quando il server nuota.
- **Punto 4 («Explore» a nuoto)**: aspetta gli esempi disegnati
  sull'acqua del server (`draw_examples --water`), col sì dell'utente.

File toccati da C1:

```
apps/mobile/src/swim/safetyNotice.ts, SwimNotice.tsx, SwimRouteNote.tsx,
  swimTurns.ts, SwimTurns.tsx, safetyNotice.test.tsx, SwimTurns.test.tsx
  (nuovi)
apps/mobile/src/settings/sport.ts, sport.test.ts, SportSetting.test.tsx,
  SportButton.test.tsx, SportStoreBuild.test.tsx,
  SportVoiceItalian.test.tsx
apps/mobile/src/profile/SettingsPage.test.tsx (conta le righe «Soon»)
apps/mobile/src/i18n/de.ts, es.ts, fr.ts, it.ts
docs/DECISIONS.md, docs/STATUS.md, docs/tasks/TASK-323.md
```

#### C2, dove si è (2026-10-30)

Scritta nella stessa sessione, su richiesta dell'utente («passa alla parte
C2»), branch `feat/TASK-323-c2-swim-on` partito da C1. Aggiunta ad
ADR-0283. Le scelte dell'utente, una domanda per volta: le righe del nuoto
nei file di Apple Salute di TASK-321 («Add the entries»), le distanze a
mezzo km («Half-km steps»), i pulsanti sul risultato («Buttons on the
result»), i testi e le traduzioni («Yes, like this»).

- `Activity` con `swimming`; `activityOf("swim")` = `"swimming"`, la riga
  ancora `ready: false`.
- Le distanze: 0,5–3 km di mezzo km da 1 km, 0,5–1,5 mi di mezzo miglio
  (`distanceStep`, `SWIMMING_START_KM`).
- Sul risultato (`SwimResult`): «3 laps of 320 m», «Bigger shape» e
  «Smaller shape», la riga sotto il giro, le curve. `lap_m` aggiunto alla
  risposta in B (`ec03204`).
- Sull'acqua come la canoa (`isOnWater`): niente indicazioni, gli errori
  dell'acqua, la ricerca delle spiagge, le forme a pezzi; «Word» no,
  «Image» e «Draw on the map» sì.
- L'avviso del nuoto a ogni «Start» di un nuoto (risultato, «Explore», un
  disegno aperto).
- **Prima di `ready: true`**: B in `main` e sul server col sì dell'utente,
  C4 («Explore» a nuoto: oggi con lo sport del nuoto mostrerebbe gli esempi
  della corsa). La corsa a nuoto (niente voce, passo per 100 m) è D.

File toccati da C2:

```
packages/shared-types/src/index.ts, test/contract.test.ts
apps/mobile/App.tsx (l'avviso, i giri, la ricerca sull'acqua)
apps/mobile/src/swim/water.ts, SwimResult.tsx e i loro test (nuovi)
apps/mobile/src/settings/sport.ts, sport.test.ts
apps/mobile/src/route/RoutePanel.tsx, distance.ts, problems.ts,
  WhileRouting.tsx, drawAgain.ts, penUpShapes.ts, distanceMiles.test.ts,
  swimDistance.test.ts (nuovo)
apps/mobile/src/health/appleWorkout.ts, healthConnectWorkout.ts,
  appleHealth.test.ts (TASK-321, col sì dell'utente), swimWorkout.test.ts
  (nuovo)
apps/mobile/src/social/PublicParts.tsx
apps/mobile/src/api/favorites.test.ts, src/favorites/favoriteRoute.test.ts
  (il nuoto non è più «un'attività che non c'è»)
apps/mobile/src/i18n/de.ts, es.ts, fr.ts, it.ts
apps/mobile/__tests__/AppSwim.test.tsx (nuovo)
docs/DECISIONS.md, docs/STATUS.md, docs/tasks/TASK-323.md
```

#### C4, dove si è (2026-10-30)

Scritta nella stessa sessione, su richiesta dell'utente («passa alla parte
C4»), branch `feat/TASK-323-c4-swim-explore` partito da C2. Aggiunta ad
ADR-0283. Il sottotitolo e le traduzioni approvati dall'utente («Yes, like
this»).

- «Explore» con «Open water swim» è `PaddleExplore` con `swim`: gli stessi
  laghi e spiagge, «Near me», i filtri; «Shapes to swim, within 150 m of
  the shore».
- `SWIM_EXAMPLES` (`src/swim/swimExamples.ts`): le otto forme a 1 km da
  ogni punto, `swimming`, a pezzi quelle a pezzi, nessuna con l'app.
- `draw_examples --swim` (con `--water-name` per pochi punti): i nuoti
  dei punti prima di ogni telefono; una forma che non ci sta è una
  risposta.
- **Per accendere il nuoto** (`ready: true` in `sport.ts`, una riga): B,
  C1, C2 e C4 in `main`, poi col sì dell'utente il server (migrazione
  0039), l'estratto dei nomi a riva e `draw_examples --swim`.

File toccati da C4:

```
apps/mobile/src/swim/swimExamples.ts, SwimExplore.test.tsx (nuovi)
apps/mobile/src/paddle/PaddleExplore.tsx (il nuoto con `swim`)
apps/mobile/src/explore/exampleRoutes.ts (le forme a pezzi anche a nuoto)
apps/mobile/App.tsx (la pagina «Explore» col nuoto)
apps/mobile/__tests__/AppSwim.test.tsx
apps/mobile/src/i18n/de.ts, es.ts, fr.ts, it.ts
services/api/shaperoute_api/draw_examples.py, tests/test_draw_swims.py (nuovo)
docs/API.md, docs/DECISIONS.md, docs/STATUS.md, docs/tasks/TASK-323.md
```

### D — App: nuotare con il telefono nella boa

1. La schermata della corsa per il nuoto: niente voce, il passo per 100 m,
   le soglie di pausa e di assenza adatte al nuoto (TASK-304).
2. Il giro diventa il disegno nel Feed come per la canoa; l'importazione di
   un file dell'orologio con lo sport «nuoto» (TASK-312).
3. Prova in acqua con il telefono in una boa (primavera 2027).
4. Il codice nativo che serve (condizione 3) va nella build 1.0.1 con E e
   con Apple Salute di TASK-321; quello solo JavaScript può uscire prima,
   con l'impronta iOS misurata su una copia pulita.

#### D, dove si è (2026-10-30)

Scritta nella stessa sessione, su richiesta dell'utente («passa alla parte
D»), branch `feat/TASK-323-d-swim-run` partito da C4. Aggiunta ad
ADR-0283. La proposta e le traduzioni approvate dall'utente («Yes, like
this», due volte). TASK-312 B è in `main` e la sua parte C non tocca
`src/imports/`.

- **In acqua**: niente voce né vibrazioni (le indicazioni, i chilometri,
  «pausa»), niente interruttore «Voice»; la pausa da fermi dopo 30 s
  (`stillMs` di `controlRun`); fermo sotto 1 km/h.
- **La schermata**: quella della canoa col passo di 100 m: «Avg /100 m»,
  «Last 100 m», i parziali ogni 100 m (`navigation/swim.ts`).
- **Dopo**: Feed, «My activities», la scheda da condividere con «Open water
  swim» e il passo di 100 m; il gioco non conta un nuoto.
- **I file dell'orologio**: GPX e TCX con «swim», FIT `sport` 5; la
  piscina non ha traccia.
- **Resta**: la prova in acqua col telefono nella boa (primavera 2027); il
  codice nativo non serve.

File toccati da D:

```
apps/mobile/src/navigation/swim.ts, swim.test.ts, swimRun.test.ts (nuovi)
apps/mobile/src/navigation/runControl.ts, runStats.ts, useNavigation.ts,
  useFreeRun.ts
apps/mobile/src/screens/RunPanel.tsx, RunDashboard.tsx, RunSwim.test.tsx
  (nuovo)
apps/mobile/src/feed/FeedPost.tsx, src/activities/activityText.ts,
  src/share/postRun.ts, src/game/RunGameStrip.tsx, RunGameStrip.test.tsx
apps/mobile/src/imports/fit.ts, fileTrack.ts, swimImport.test.ts (nuovo)
apps/mobile/src/i18n/de.ts, es.ts, fr.ts, it.ts
docs/IMPORTAZIONI.md, docs/DECISIONS.md, docs/STATUS.md,
  docs/tasks/TASK-323.md
```

### E — Apple Watch (solo col sì dell'utente su dipendenze e build)

1. Un target watchOS nell'app: la dipendenza per aggiungerlo (un plugin di
   configurazione di Expo) si chiede all'utente prima.
2. L'app dell'orologio: allenamento di nuoto in acque libere, il giro e le
   curve dal telefono, le vibrazioni (curva a destra, curva a sinistra, fuori
   rotta oltre 25 m), la freccia con i metri, la traccia rimandata al
   telefono.
3. Esce solo con una build nuova per l'App Store, la 1.0.1 insieme ad Apple
   Salute di TASK-321 (condizione 3), dopo una prova in acqua.
4. La lettura dei nuoti dell'Apple Watch da Apple Salute, per chi non usa
   la nostra app dell'orologio: è di TASK-321 e dello studio D di TASK-312;
   qui si usa quello che decidono, senza toccare i loro file.

#### E, il piano (2026-10-30)

L'utente, alla richiesta «passa alla parte E», ha scelto «Wait for B, then
the Mac»: **sì alle due dipendenze**, ma il codice parte dopo. Dalla
sessione cloud non si può: non c'è Xcode per compilare e provare lo Swift
dell'orologio, e `app.json`, `package.json` e `react-native.config.js` sono
della parte B di TASK-321 (la build 1.0.1, branch
`feat/TASK-321-b-health-ios`), che li sta cambiando adesso. Questo è il
piano per la sessione che lo farà.

**Quando parte**: TASK-321 B in `main` (HealthKit acceso, gli entitlements,
il testo del permesso), le parti B, C1, C2, C4 e D di questo task in
`main`, una sessione sul Mac con Xcode e un Apple Watch per provare. Il
nuoto acceso (`ready: true`) non serve per scrivere il codice, serve per
la prova.

**Le dipendenze** (sì dell'utente del 2026-10-30; versioni da ricontrollare
quando si parte, una sola riga in `package.json` ciascuna):

- `@bacons/apple-targets` 5.0.0: il plugin di Expo che aggiunge il target
  dell'orologio da una cartella `targets/watch/` (il suo
  `expo-target.config.js` e i sorgenti Swift) a ogni `prebuild`;
- `react-native-watch-connectivity` 2.0.0: `WCSession` dal JavaScript, per
  mandare il giro all'orologio e ricevere la traccia.

**Come è fatto**:

1. **Il telefono** (`src/watch/`, file nuovi): `watchSwim.ts`, puro, fa il
   pacchetto per l'orologio dal risultato del nuoto: i punti (diradati
   come le anteprime, entro il limite di un messaggio di `WCSession`), le
   curve del primo giro con il lato, i metri dalla partenza e il nome a
   riva, i giri, `lap_m`, la distanza. `useWatch.ts`: se c'è un orologio
   con l'app, al «Start» di un nuoto (dopo l'avviso) manda il pacchetto e
   dice sul telefono «On your watch» (testo da approvare); alla fine riceve
   la traccia e la mette nella corsa come quella del telefono, con «Save»
   e il modulo di sempre.
2. **L'orologio** (`targets/watch/`, Swift e SwiftUI): un
   `HKWorkoutSession` `.swimming` con `swimmingLocationType` `.openWater`
   (l'orologio salva l'allenamento in Salute: «un'attività, un
   allenamento», il telefono non lo riscrive, regola di TASK-321); il GPS
   dell'orologio; il blocco dell'acqua all'avvio. `SwimGuide.swift`, puro:
   dove si è lungo il giro, i metri alla prossima curva, fuori rotta oltre
   25 m. Le vibrazioni: prima di una curva a destra e a sinistra con due
   schemi diversi, fuori rotta un terzo (da provare in acqua e da far
   scegliere all'utente). Lo schermo: una freccia grande e i metri alla
   prossima curva, per chi alza la testa. Alla fine la traccia al
   telefono (`transferFile`, anche se il telefono non c'è subito).
3. **I test**: `jest` per `src/watch/`; XCTest per `SwimGuide` (la
   posizione lungo il giro, la curva che viene, il fuori rotta), sul Mac.
4. **La prova in acqua** (primavera 2027) dice se le vibrazioni si sentono
   nuotando e se i 25 m vanno bene; poi la build 1.0.1 con TASK-321 B e
   l'invio ad Apple, col sì dell'utente.

**Da chiedere all'utente quando si parte** (una domanda per volta): gli
schemi delle vibrazioni, i pochi testi dell'orologio e del telefono nelle
cinque lingue, la riga della privacy (la posizione dell'orologio durante il
nuoto).

File toccati da E (previsti, da confermare quando parte):

```
apps/mobile/targets/watch/ (nuova: il target, lo Swift, i test XCTest)
apps/mobile/src/watch/ (nuova: watchSwim.ts, useWatch.ts e i test)
apps/mobile/package.json (le due dipendenze), app.json (il plugin), con
  TASK-321 B già in main
apps/mobile/App.tsx (il «Start» di un nuoto con l'orologio)
apps/mobile/src/i18n/*.ts, site/privacy/ (testi e privacy, col sì)
docs/DECISIONS.md, docs/STATUS.md, docs/tasks/TASK-323.md
```

## Criteri di accettazione (del task intero)

- [ ] Dalla CLI, senza rete né chiavi, un giro a nuoto sta tutto fra la
      distanza minima e massima dalla riva scelte e parte e torna alla
      stessa spiaggia.
- [ ] La canoa dà gli stessi percorsi di prima, punto per punto.
- [ ] Ogni curva ha un nome a riva dove l'estratto ne ha uno entro 300 m.
- [ ] «Open water swim» si sceglie nell'app, con l'avviso di sicurezza
      approvato dall'utente.
- [ ] Un nuoto registrato (telefono nella boa o file dell'orologio) diventa
      un disegno nel Feed.
- [ ] (E) L'Apple Watch vibra alle curve e fuori rotta in una prova in
      acqua.

## File toccati

Questa PR, solo documenti:

```
docs/tasks/TASK-323.md
docs/DECISIONS.md
docs/STATUS.md
docs/INDEX.md
```

Le parti hanno i loro elenchi qui sopra, da confermare col Coordinatore
quando partono.

## Fuori scope

- Un'app per Garmin (Connect IQ) o per Wear OS; occhialini con lo schermo.
- La piscina.
- Parole, immagini e disegni nell'acqua: come per la canoa, solo forme del
  catalogo.
- La qualità dell'acqua (dati europei sulle acque di balneazione: licenza da
  verificare), le ordinanze, le bandiere, le boe dei campi di regata.
- I fiumi; il nuoto oltre la fascia.

## Domande aperte per l'utente

Una per volta, quando serve la parte:

1. (A1, dopo i campioni) La fascia: 20–150 m dalla riva? Le distanze:
   0,5–3 km?
2. (C) Il nome, l'avviso di sicurezza, la riga sotto il giro.
3. (E) La dipendenza per il target watchOS e la build nuova.

## Esito

*(si compila a fine task)*
