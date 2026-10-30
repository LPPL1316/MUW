# API — Contratti REST

> Scritto con TASK-022, richieste in due tempi con TASK-025, lettura delle
> parole della forma con TASK-030. Le scelte e i loro motivi stanno in
> ADR-0030, ADR-0032 e ADR-0012.

## Cosa è deciso

- FastAPI + Pydantic, in `services/api/` (pacchetto `shaperoute_api`).
- L'API orchestra, non calcola: il percorso viene da `plan_route` del
  route-engine, che l'API importa (ARCHITECTURE §4).
- `RouteRequest` e `RouteResult` come in `ARCHITECTURE.md` §3, con gli
  stessi campi di `packages/shared-types`: il contratto non cambia.
- Nessun prefisso di versione, nessun CORS (l'app è nativa). Fuori casa
  l'API può chiedere una chiave (`X-API-Key`, TASK-081); gli account, da
  TASK-114, hanno un token di sessione a parte (`Authorization: Bearer`).
  I percorsi restano aperti a tutti: si disegna anche senza account.
- Da TASK-288 (ADR-0249) le risposte da 1 KB in su arrivano con gzip a
  chi manda `Accept-Encoding: gzip` (il `fetch` di React Native lo fa da
  sé); JPEG e file `application/gzip` restano come sono.

## Avvio

Dalla radice del repository, con il venv dell'API (`SETUP.md`, passo 10):

```
python -m shaperoute_api            # solo da questo PC, porta 8000
python -m shaperoute_api --lan      # anche dal telefono, sulla stessa Wi-Fi
```

Con `--lan` stampa l'indirizzo da scrivere sul telefono. `--port` cambia
la porta, `--cache-dir` la cartella dei grafi (default `data/cache`, come
la CLI). `--ai-model` e `--ai-url` scelgono il modello di Ollama che legge
le parole della forma e dove risponde (`AI.md`); senza, valgono quelli del
codice. La documentazione interattiva è su `/docs`.

Da fuori casa (TASK-081, ADR-0076, `DEPLOY.md`): se la variabile
d'ambiente `SHAPEROUTE_API_KEY` è impostata (almeno 16 caratteri), ogni
richiesta tranne `GET /health` deve avere l'intestazione `X-API-Key` con
quel valore; senza, l'API è aperta come prima. Passa senza chiave anche
`GET /strava/callback`, la pagina a cui Strava rimanda il browser («Send
to Strava», più sotto): un browser non ha la chiave. I POST sono limitati a
`SHAPEROUTE_RATE_LIMIT` al minuto per client (default 30, 0 = nessun
limite); il polling dei job è GET e non conta. La chiave non si passa mai
da riga di comando.

Con `SHAPEROUTE_DATABASE_URL` (un indirizzo `postgresql://…`) l'API usa il
database degli account (TASK-114, `DATABASE.md`): all'avvio applica le
migrazioni che mancano e lo scrive; se il database non risponde, non
parte. Senza, gli account rispondono `503 accounts_unavailable` e il resto
funziona come prima. Con tutte le connessioni del database occupate per
10 s (TASK-288 B), `503 accounts_unavailable` con `Retry-After`. Come
accenderne uno sul PC: `SETUP.md`, 10.4.

Con `STRAVA_CLIENT_ID` e `STRAVA_CLIENT_SECRET` (l'app Strava di questo
server, `DEPLOY.md`, «Strava») le corse salvate si possono mandare a Strava
(TASK-187): «Send to Strava», più sotto. Senza anche una sola delle due,
Strava è spento e il resto funziona come prima. Il secret non si passa mai
da riga di comando.

Con `--request-log`, o con `SHAPEROUTE_REQUEST_LOG=1`, l'API scrive ogni
richiesta di percorso in un file, per poterla rifare: «Registro delle
richieste», più sotto. Senza, non scrive niente (è il default).

Gli esempi di una città restano sul disco una volta disegnati, in
`routes/` dentro la cartella dei grafi: «Gli esempi di una città, tenuti»,
più sotto. `--no-route-store` li fa disegnare ogni volta.

## Endpoint

### `GET /health`

`200 {"status": "ok"}`. Serve a controllare che l'API risponda.

### Richieste in due tempi: `/route-jobs`

È la strada dell'app (ADR-0032). Un percorso da 15 km o una zona da
scaricare durano più di quanto il telefono aspetta una risposta, quindi la
richiesta risponde subito e il percorso si chiede dopo.

- `POST /route-jobs` con un `RouteRequest` (come sotto) risponde subito
  `202` con un `RouteJob`: `{"job_id", "status", "result": null, "error": null}`.
  Una richiesta non valida risponde `422 invalid_request` senza diventare
  un job.
- `GET /route-jobs/{job_id}` restituisce il `RouteJob` di adesso. `status`
  è uno di:

  | `status` | Vuol dire |
  |---|---|
  | `queued` | in coda: i due thread di lavoro sono occupati |
  | `downloading_map` | la zona non è in cache e si scarica da Overpass |
  | `computing` | grafo pronto (o in lettura dal disco), il motore calcola |
  | `done` | `result` è il `RouteResult` |
  | `failed` | `error` è `{code, message}`, come negli errori sotto |

- `DELETE /route-jobs/{job_id}` annulla: `204`. Una richiesta in coda non
  parte; una che sta caricando il grafo si ferma prima di calcolare; una
  che sta già calcolando finisce nel suo thread e il risultato si butta.
  L'annullamento è un evento delle ricerche (`cancelled`, TASK-142).
- Un `job_id` sconosciuto (annullato, finito da più di 10 minuti, o API
  riavviata) risponde `404 http_error`.

Il `RouteResult` di una richiesta in due tempi porta anche le
**indicazioni di svolta** (`directions`, TASK-048, ADR-0045 e ADR-0047): la
prima è la partenza (`"turn": "depart"`, la via da cui si parte), poi una
per ogni incrocio dove si gira, si cambia strada o si sceglie a un bivio.

```json
{"node": 2, "point": [46.0671, 11.1344], "distance_m": 1003.6, "turn": "left",
 "angle_deg": -90.0, "street": "Via Manci", "road_type": "residential",
 "branches": 4, "joined": false}
```

`turn` è uno di `depart`, `left`, `right`, `sharp-left`, `sharp-right`,
`straight`, `u-turn`. `street` è il nome della via in cui si entra, o il
suo `ref`, o `null` se OSM non ha né l'uno né l'altro: allora dice
qualcosa solo `road_type`. `joined` è vero quando l'indicazione arriva
meno di 15 m dopo la precedente, da leggere insieme («sinistra, poi
destra»): nessuna si toglie. Le calcola il motore sul grafo su cui ha
tracciato il percorso, in circa 0,1 s.

`along` (TASK-060, ADR-0057) è la via lungo cui corre una strada senza
nome, di solito un marciapiede disegnato a parte: una **deduzione** del
motore (ADR-0054), mai un nome della strada stessa. C'è solo quando
`street` è `null`, altrimenti è `null`; resta `null` anche quando non c'è
una via con nome entro 15 m e parallela (piazze, parchi, viali larghi).

```json
{"node": 3, "point": [46.0761, 11.1344], "distance_m": 2004.4, "turn": "left",
 "angle_deg": -88.5, "street": null, "road_type": "footway",
 "branches": 3, "joined": false, "along": "Via Rosmini"}
```

Le vie accanto vengono dal grafo e dal file dei nomi della zona in cache
(`MAPS.md`, «Cache»); l'API non lo scarica mai durante una richiesta: una
zona senza il file dà solo le vie del grafo. Il campo è opzionale nei tipi
condivisi: un'API precedente non lo manda, e un `GpxRequest` può ometterlo.
Sul cuore da 15 km di Trento le indicazioni senza nome né via passano da
118 a 57, e `along` costa circa 0,3 s.

Le richieste vivono nella memoria dell'API: un riavvio le perde. Lavorano
due alla volta, così un 15 km annullato non ferma la richiesta dopo; le due
però si dividono il processore, quindi la seconda va più piano finché la
prima non finisce.

### Gli esempi di una città, tenuti (TASK-168, ADR-0136)

In «Explore» ogni telefono chiede a una città le stesse tre cose: un
cuore, un cerchio e una stella da 5 km dal suo centro. Il motore le
disegna uguali ogni volta, una dopo l'altra. Dal TASK-168 un percorso
disegnato **dal centro di una città** resta in un file
(`shaperoute_api/route_store.py`), e la stessa richiesta riceve il job già
`done`, con il `result`, **nella risposta al `POST /route-jobs`**: nessun
thread di lavoro, nessun calcolo, niente da chiedere dopo. Il contratto non
cambia: `202` e un `RouteJob`, che si legge e si annulla come gli altri.
Aspetta solo il primo telefono in una città.

Dal TASK-176 (ADR-0144) l'app chiede il **cerchio per primo**, poi
cuore e stella, e dopo altre cinque forme da 5 km dallo stesso centro:
luna, cavallo, lumaca, testa di cane, testa di coniglio. Sono richieste
come le altre, una alla volta, e restano allo stesso modo. Il cerchio va
per primo perché la sua zona contiene quella di tutte le altre forme: una
città senza zona ne scarica una sola. `draw_examples` chiede le prime tre
nello stesso ordine (`EXAMPLE_SHAPES` in `prefetch_zones.py`); le altre
cinque non le disegna, e restano dal primo telefono che le chiede.

- **Solo dal centro di una città.** Una richiesta porta la posizione di
  chi la fa, e l'API non tiene la posizione di nessuno (ADR-0085,
  ADR-0092): salvare tutti i percorsi è ADR-0086, nel database, con
  TASK-092. I centri sono quelli che l'API stessa ha dato con `GET
  /cities` e, per le sole città, con `GET /city-suggestions`; una partenza
  è un centro quando cade nello stesso quadrato di circa 10 m (4 decimali,
  come `cityKey` dell'app). Un percorso da qualsiasi altra partenza non
  viene mai scritto, e il contorno di un'immagine nemmeno. Dal TASK-246
  parte B anche i punti dei laghi e delle spiagge dell'app (sotto).
- **La stessa richiesta**: stessa forma o parola, stile, distanza,
  attività, la penna alzata o no (TASK-197), stesso centro, **stesso
  motore**. Il nome del file viene da
  un'impronta del codice del motore (`engine_fingerprint`: i `.py` e i
  `.json` di `route_engine`): un motore cambiato ridisegna, senza
  cancellare niente a mano.
- **Dove**: `routes/` nella cartella dei grafi (`data/cache/routes/`), che
  sul server è già una cartella tenuta fuori dal contenitore. Un file JSON
  per percorso, circa 90 kB con le alternative e le indicazioni, e
  `city-centres.txt` con i centri imparati. Al massimo 3000 percorsi (i
  più vecchi escono) e 30 giorni: poi si ridisegna, perché la zona può
  essere più nuova.
- **Errori**: un percorso non riuscito non si tiene. Un file che non si
  legge vale come non tenuto e si ridisegna; una cartella che non si può
  scrivere lascia l'API com'era prima.
- **Nel registro delle richieste e negli eventi** una risposta tenuta
  compare come le altre, con 0 secondi.

Per non far aspettare nemmeno il primo telefono, gli esempi si disegnano
prima, chiedendo a un'API accesa quello che chiede l'app:

```
python -m shaperoute_api.draw_examples --api http://127.0.0.1:8000 Rovereto
python -m shaperoute_api.draw_examples --api https://… --preset italy --preset featured
```

Una riga per città (`circle drawn, heart drawn, star kept`), una forma
alla volta; la chiave dell'API, se serve, da `SHAPEROUTE_API_KEY`. Rifatto,
passa in un attimo sulle città già tenute. Una città senza la zona sul
disco dell'API la fa scaricare, come un telefono: per le zone di molte
città c'è `prefetch_zones` (ADR-0119).

#### Le figure «Paddle» dei laghi e delle spiagge (TASK-246 parte B)

Ogni telefono, dopo le mappe della zona, chiede le otto forme «Paddle» dei
tre posti più vicini (ADR-0211): dal **punto stesso** delle liste
dell'app, `lakes.json` e `beaches.json` (`apps/mobile/src/paddle/`), alla
distanza del punto (2 km, meno su un lago piccolo), le forme a pezzi con
la penna alzata. Dalla parte B l'API tiene anche questi percorsi, come
quelli dal centro di una città: il secondo telefono che chiede la stessa
forma dallo stesso punto riceve il job già `done`. L'app non cambia.

- **I punti** li legge l'API all'avvio (`water_spots.py`) dai due file
  dell'app, che il `Dockerfile` copia nell'immagine allo stesso posto. Non
  si imparano e non si scrivono in `city-centres.txt`: valgono finché
  sono nelle liste. Un punto delle liste non è la posizione di nessuno,
  come il centro di una città. Una partenza a 10 m dal punto, o la forma
  spostata dall'utente (`near`, TASK-238), non si tiene mai.
- **Dove**: `routes/water/`, a parte, con un limite suo di 10 000
  percorsi (circa 8 kB l'uno, senza alternative né indicazioni: 80 MB al
  massimo). Le otto forme di circa 800 punti sono 6 400 percorsi:
  insieme a quelli delle città, con un limite solo, spingerebbero fuori
  gli esempi delle città.
- La stessa richiesta, i 30 giorni e l'impronta del motore come sopra:
  ogni cambio di `route_engine` le fa ridisegnare.
- All'avvio una riga dice quanti punti e quanti percorsi tenuti:
  `Paddle shapes kept from 787 points on the water: 24`.

Per disegnarle prima di ogni telefono, `draw_examples --water` (tutti i
punti, uno per quadrato di 10 m) o `--water-name` (solo i punti di un lago
o di una spiaggia, ripetibile):

```
python -m shaperoute_api.draw_examples --api http://127.0.0.1:8000 --water
python -m shaperoute_api.draw_examples --api … --water-name "Lago di Levico"
```

Le forme nell'ordine dell'app (cerchio, cuore, stella, poi le altre);
un punto senza acqua sul disco dell'API si salta alla prima forma
(`map_data_unavailable`), come fa il telefono. Una forma che non ci sta
(`shape_not_drawable`) resta scritta nella riga e non ferma il punto.

**Tempi** (2026-10-09, Mac scarico, motore di `main` a `89287a0a`, acqua
dei laghi d'Italia in cache): le 24 forme di un telefono nuovo a Levico
Terme (Lago di Levico, Lago di Caldonazzo, Lago della Serraia) costano
**11 s di motore** la prima volta e **0 s** la seconda, tutte tenute. Su
15 punti a caso (12 laghi, 3 spiagge) 5 s di motore a punto, 16 s di
`draw_examples` con le attese fra una domanda e l'altra. Il giro di tutti
i punti sul server: `tasks/TASK-246.md`, «Esito parte B».

Misurato sul Mac il 2026-10-02 (Trento, zona in cache, il Mac occupato da
altri lavori): i tre esempi 10–14 s la prima volta, **0,0 s** la seconda,
tutti e tre nella risposta al `POST`.

### L'archivio dei percorsi (TASK-297 parte A, ADR-0256)

Tenere **tutti** i percorsi è la scelta dell'utente di ADR-0086. Dal
TASK-297 ogni percorso finito, e ogni sua alternativa, resta in una riga
della tabella `drawn_routes` del database (`shaperoute_api/route_archive.py`,
`DATABASE.md`), **senza chi l'ha chiesto**: un percorso disegnato è di
tutti. L'archivio sta davanti ai file degli esempi: `RouteJobs` chiede
prima a lui, poi ai file; scrive a tutti e due (i file tengono da soli ciò
che parte da un centro o da un punto dell'acqua).

La stessa richiesta (forma o parola, stile, distanza, attività, la penna
alzata o no), lo stesso motore (l'impronta di `route_store`), meno di 30
giorni:

- **dallo stesso punto** (entro 10 m): la riga risponde subito, job `done`
  nella risposta al `POST /route-jobs`, come un esempio tenuto;
- **entro 100 m** (`NEARBY_MAX_M`, la distanza delle partenze vicine di
  ADR-0071): il percorso tenuto si raggiunge **lungo le strade** dalla
  partenza dell'utente e si lascia allo stesso modo, come `with_approach`
  fa per un'alternativa, se la via è entro 150 m (`APPROACH_MAX_M`). La
  zona si carica (0,3–2 s), il motore non parte: succede nel thread del
  job (`RouteJobs._nearby`, `FindsNearby`), non nel `POST`, e il job passa
  da `queued` a `done` come gli altri. Le indicazioni sono quelle della
  linea intera; i `walks` si spostano con i punti. Non sull'acqua: non ci
  sono strade;
- più righe che vanno bene: per prima quella con più **corse salvate e
  preferiti** lungo la sua linea (`runs`, `favorites`, contati per
  `line_key` da `PUT /me/activities/{key}` e dai preferiti, mai per chi),
  poi la più somigliante, poi la più vicina; le altre, fino a tre, sono le
  alternative;
- **dopo un cambio del motore, o dopo 30 giorni** (TASK-297 parte A2):
  nessuna riga di questo motore entro 100 m, ma una di prima, buona
  (somiglianza ≥ 0,90) e con il suo piazzamento. Si ridisegna **dalla sua
  partenza**, come il pianificatore dell'API (partenze vicine e
  alternative comprese), con la ricerca che prova per primo quel
  piazzamento (`first` di `optimizer.search`, `ROUTE_ENGINE.md` §5): lo
  stesso piazzamento dalla stessa partenza rifà lo stesso percorso in un
  tracciamento o due (ADR-0257). Se non è più buono, la ricerca continua
  come senza. Il percorso entra nell'archivio e si raggiunge dalla
  partenza dell'utente come al punto sopra; nel log `kept route drawn
  again from 0 m away`, nella riga dei tempi (TASK-289) i tracciamenti
  della partenza. Se il motore nuovo lì non lo disegna, calcola il
  pianificatore dalla partenza dell'utente;
- niente che vada bene: il motore calcola come oggi, e il risultato entra
  nell'archivio con il piazzamento della ricerca vicino alla partenza
  (`jobs.KeepsPlacements`, `put_plan`; `DATABASE.md`, la 0035).

Il contratto non cambia. Nel log: `job …: kept route reached along the
roads` e `kept route reached from 62 m away`; negli eventi la risposta
compare come le altre, con i secondi della zona. Mai in archivio: il
contorno di un'immagine (è dell'utente), una forma spostata a mano
sull'acqua (`near`). Tetto di 50 000 righe (circa 50 kB l'una con le
indicazioni): oltre, a ogni scrittura vanno via le più vecchie mai corse né
preferite. Un archivio che non risponde (database fermo) lascia il motore
fare come prima: avviso nel log, nessun errore all'app.

### Registro delle richieste (TASK-090, ADR-0085)

Serve a rifare uguale un percorso visto nell'app, per capire un difetto:
in TASK-075 non si è potuto, perché la partenza era il GPS del telefono e
25–100 m cambiano il cuore. **Spento per default**; si accende all'avvio:

```
python -m shaperoute_api --lan --request-log
```

oppure con la variabile d'ambiente `SHAPEROUTE_REQUEST_LOG=1`. All'avvio
l'API dice se registra e dove. Il file è `data/requests/requests.jsonl`
(`--request-log-dir` cambia la cartella), fuori dal repository
(`.gitignore`) e leggibile solo da chi ha avviato l'API. Una riga JSON per
ogni richiesta di percorso finita (`/route-jobs`, `/image-route-jobs`,
`/routes`), scritta dopo che il job ha la sua risposta:

```json
{"time": "2026-09-30T13:18:08+00:00", "kind": "shape", "job_id": "d44ecaff13cc",
 "request": {"start": [45.9934, 11.258], "shape": "heart", "word": null,
             "distance_m": 10000, "activity": "running", "style": "round"},
 "outcome": {"status": "done", "distance_m": 11841.8, "similarity": 0.8568,
             "points": 467, "route": "19a2ca915124baf7", "elapsed_s": 7.3}}
```

- `kind`: `shape`, `word` o `image`. `request` è il corpo com'è arrivato,
  con i default scritti; per un'immagine, `outline` e `strokes`.
- `outcome`: `done` con distanza, somiglianza, numero di punti, secondi e
  `route`, un'impronta dei punti (uguale solo se il percorso è lo stesso
  punto per punto); `failed` con il solo `code` dell'errore; `cancelled`
  per un job annullato prima del calcolo. `job_id` è `null` per `/routes`.
- **Mai nel file**: la chiave dell'API, le intestazioni, l'indirizzo del
  telefono, la foto (`/image-outlines` e `/image-outline-edits` non sono
  registrati), i punti del percorso, le parole di `/shape-readings`. Una
  richiesta non valida (422 prima del job) non è registrata.
- **Grandezza**: a 5 MB il file diventa `requests.old.jsonl` (quello di
  prima è sostituito) e ne comincia uno nuovo: mai più di 10 MB sul disco,
  alcune migliaia di richieste.
- Se il file non si può scrivere, la richiesta va avanti lo stesso e nel
  log dell'API c'è un avviso, senza il corpo della richiesta.

**Rifare una richiesta**, senza server e senza telefono, dalla radice del
repository:

```
python -m shaperoute_api.replay --list          # le righe, numerate
python -m shaperoute_api.replay                 # rifà l'ultima
python -m shaperoute_api.replay --job d44ecaff13cc --gpx out/again.gpx
python -m shaperoute_api.replay --line 3
```

Ricostruisce la richiesta dal corpo, con gli stessi controlli di quando è
arrivata, e la dà allo stesso motore sui grafi in cache (`--cache-dir`,
`--file` per un altro registro). Stampa distanza e somiglianza di adesso e
dice se il percorso è quello registrato, punto per punto; se non lo è
(motore cambiato, o altri dati della mappa) esce con codice 1. Provato con
un cuore da 10 km a Caldonazzo e «CIAO» squadrato a Levico: 467 e 626
punti, identici. Il registro contiene le partenze degli utenti: vedi
`UI.md`, «Cosa esce dal telefono», e `DEPLOY.md`.

### `POST /gpx`

Riceve un `GpxRequest`, cioè `{"request": RouteRequest, "result":
RouteResult}`, e risponde `200` con il percorso in GPX 1.1
(`application/gpx+xml`), scritto da `export_gpx.py` del motore come fa la
CLI (`GPX.md`). Il nome del file è nell'intestazione:
`Content-Disposition: attachment; filename="sgrava-heart-5km-2026-09-23.gpx"`.
L'API non ricorda niente, quindi l'export funziona anche dopo i 10 minuti
di vita di una richiesta in due tempi. Un corpo non valido risponde
`422 invalid_request` (ADR-0033). Con i `walks` di una parola con la penna
alzata (TASK-197) il GPX ha un waypoint «Pause» e uno «Resume» per ogni
tratto a piedi (`GPX.md`); dei `walks` che non stanno nei `points` sono
`422 invalid_request`. Un'app che non li manda riceve il GPX di prima.

### `GET /places`

I luoghi della partenza, suggeriti mentre si scrive (TASK-123, ADR-0095).
`?q=via bel&lat=46.07&lon=11.12`: `q` da 1 a 200 caratteri, `lat` e `lon`
facoltativi, insieme, per mettere prima i luoghi attorno. Risponde `200`
con al più 5 luoghi (`packages/shared-types/fixtures/places.json`):

```json
{ "places": [{ "label": "Via Rodolfo Belenzani, Trento", "point": [46.0692621, 11.1211947] }] }
```

I luoghi vengono dall'autocompletamento di Geoapify (dati OpenStreetMap),
con la chiave `GEOAPIFY_API_KEY` dell'API: l'app non la vede. Le risposte
restano in memoria un'ora (500 ricerche): le stesse lettere non si chiedono
due volte. Senza chiave, o se Geoapify non risponde, `503 http_error`;
l'app allora chiede a Photon, come prima. È un `GET`: non conta nel limite
dei POST al minuto.

### `GET /recommended-routes` (TASK-126, ADR-0098)

I percorsi migliori già pianificati vicino a un punto, per «Explore»:
`?lat=…&lon=…`, facoltativi `radius_m` (100–50 000, default 5000),
`shape` (una forma, o una parola in maiuscolo) e `distance_m`. Prima la
somiglianza più alta; a parità, il più vicino. Tutti, anche se equivalenti
(TASK-092, punto 3). Ogni percorso ha `id`, `city`, `shape` o `word` (con
`style`), `distance_m`, `route_m`, `similarity`, `start`, `away_m` e
`preview`, al più 64 punti della linea per la miniatura. Corpo in
`packages/shared-types/fixtures/recommended-routes.json`. Il punto sta
nella query: il log di accesso non la scrive (ADR-0096).

`GET /recommended-routes/{id}` dà il percorso intero (`points`, `license`;
`recommended-route.json`), 404 per un id che non c'è.

**`rotation_deg`** (TASK-232, parte C, ADR-0195), nell'elenco e nel
percorso intero: di quanti gradi il motore ha girato la forma, come
`RouteResult.rotation_deg`; l'app gira la scheda e la mappa dall'altra
parte. `0` per un percorso dritto e per ogni percorso di un file di città
che non lo dice (il catalogo di oggi è di prima della parte A: tutti `0`);
lo scrive `seed_catalog` del motore quando il motore inclina, e un valore
che non è un numero fra −180 e 180 si legge `0`.

I percorsi vengono da `catalog/seed/` (ADR-0097), letti all'avvio:
`--catalog-dir` per un'altra cartella; senza file la lista è vuota. Un file
nuovo vuole un riavvio dell'API.

### `GET /recommended` (TASK-092, ADR-0229)

La riga «Recommended» di «Explore»: gli stessi percorsi del catalogo di
`/recommended-routes`, nello stesso corpo (`recommended-routes.json`), ma
in un altro ordine e al più `limit` (1–20, default 10). `?lat=…&lon=…`,
facoltativo `radius_m` (100–50 000, default 5000). **Vuole il token**
(`Authorization: Bearer …`), come `/feed`: senza, `401 not_signed_in`;
senza database `503`.

L'ordine: prima la somiglianza **come la scheda la scrive** (il percento
intero); a pari percento le **reazioni** sui disegni pubblicati delle
corse fatte su quel percorso; poi le **corse salvate** più i **preferiti**
di quel percorso; a parità di tutto il più vicino, poi l'`id`. Nessuno è
tolto perché passa dalle stesse strade di un altro (ADR-0086). Una corsa o
un preferito è di un percorso quando la sua linea è quella del percorso:
la stessa chiave di `favoriteKey` nell'app (`best_routes.line_key`). I
conteggi non sono nella risposta. Dieci percorsi con l'anteprima pesano
circa 15 kB (il test vuole meno di 100 kB).

### `GET /cities` (TASK-129, ADR-0099)

Le città di tutto il mondo per nome, `?q=…`, al più 5, ognuna col suo
centro: la geocodifica di Geoapify per sole città (`type=city`), con la
chiave di `/places`. Non l'autocompletamento, che per una città dà il
centro dell'area del comune (Milano: Baggio, 6 km dal Duomo). Corpo come
`/places` (`places.json`); 503 senza chiave. Cache di un giorno. Parole
imparate dal vocabolario (`city_names`, TASK-142) cercano il nome imparato:
«levic» cerca «Levico Terme», non Levič.

**Il punto è quello del luogo** (TASK-249, ADR-0213): per certi comuni la
geocodifica dà il confine (`category: administrative`) col punto al centro
dell'area, a 650 m dal paese per Tenna. Per ogni risultato così l'API
chiede al Places i luoghi con quel nome dentro il `bbox` e prende il punto
di quello con la stessa etichetta: lo stesso punto di `/city-suggestions` e
di `/nearby-cities`. Senza un luogo con quell'etichetta resta il punto
della geocodifica. Se il Places non risponde la ricerca risponde lo
stesso, coi punti della geocodifica, e quella risposta non è tenuta: la
ricerca dopo richiede. Una ricerca nuova costa così una richiesta in più
per ogni area fra i risultati (meno di 2 s in tutto, misurato).

### `GET /nearby-cities` (TASK-236, ADR-0200)

I posti intorno a un punto, `?lat=…&lon=…`, al più 6, dal più vicino, da
OpenStreetMap col Places di Geoapify e la chiave di `/places`. Quattro sono
città e paesi (`place=city`, `place=town`): quelli entro 20 km, i più
grandi per abitanti; se sono meno di quattro, i più vicini oltre i 20, fino
a 50 km. Due sono i più vicini di tutti entro 20 km, anche villaggi
(`place=village`), che non siano già fra i quattro. Mai il posto in cui si
è: il più vicino, se ha il centro entro 1,5 km dal punto. Etichetta e punto come `/cities`, anche per i villaggi (TASK-249). Al servizio va il centro
di un quadrato di circa 1 km, e la risposta è tenuta un giorno. I centri
sono centri di città per gli esempi tenuti (ADR-0136). 503 senza chiave o
se il servizio non risponde; 422 per un punto fuori dalla Terra.

```json
{"places": [
  {"label": "Levico Terme, Trentino – Alto Adige/Südtirol, Italy",
   "point": [46.0091259, 11.3017774], "away_m": 2929, "photo": null},
  {"label": "Moreda de Álava / Moreda Araba, Autonomous Community of the Basque Country, Spain",
   "point": [42.5246992, -2.4085108], "away_m": 1886,
   "photo": {"url": "/city-photos/Q1442886.jpg", "credit": "© LBM1948 · CC BY-SA 4.0"}}
]}
```

**`photo`** (TASK-283, ADR-0243): la foto del posto, quando il suo
elemento Wikidata (che Geoapify dà da OpenStreetMap) ha un'immagine (P18)
su Wikimedia Commons con una licenza che ne permette l'uso a chiunque (CC
BY, CC BY-SA, CC0, pubblico dominio); altrimenti `null`. `url` è un
percorso su questa API; `credit` è ciò che la licenza chiede di scrivere
accanto alla foto, «© autore · licenza» o «Wikimedia Commons · licenza»
senza autore, sempre con la licenza in fondo; `null` quando la licenza
non chiede niente. A Wikidata e Commons vanno solo l'elemento e il nome
del file, mai il punto. La risposta aspetta al più 2 s le foto di un posto
nuovo per l'API: quelle che arrivano dopo sono tenute per la richiesta
successiva. Un'API prima di TASK-283 non ha il campo: l'app mostra le
schede di prima.

### `GET /city-photos/{item}.jpg` (TASK-283, ADR-0243)

La foto di un posto di `/nearby-cities`, di un percorso a tema o di
`/place-photos`, `item` il suo elemento Wikidata (`Q1442886`): JPEG larga
al più 500 pixel, presa da Commons la prima volta e tenuta nella cartella
`city_photos/` della cache, senza i metadati del file. Cosa si sa di ogni
elemento (la foto, o nessuna) è tenuto lì e richiesto di nuovo dopo 30
giorni. 404 per un elemento senza foto o mai nominato da una di quelle tre
(non è un proxy di Commons); 503 se Commons non dà la foto.
`Cache-Control: private, max-age=86400`.

### `GET /place-photos` (TASK-329, ADR-0287)

Le foto dei posti delle idee di «Ask for a route», che lo strumento
`tools/themed_ideas.py` ha calcolato una volta e l'app tiene in un file:
`?items=Q34921,Q152341`, al più 15 elementi Wikidata separati da virgole.
Risponde solo per gli elementi della lista che lo strumento scrive accanto
all'API (`shaperoute_api/data/idea_items.json`, letta all'avvio): un altro
non ha foto qui e non è chiesto a Wikimedia. Le foto sono quelle di
`/nearby-cities`, con le stesse regole (licenze libere, credito, attesa al
più 2 s, solo l'elemento e il nome del file a Wikimedia); un elemento
senza foto manca dalla risposta (`place-photos.json`). 422 per una lista
vuota, più lunga di 15 o con qualcosa che non è un elemento. Un'API prima
di TASK-329 risponde 404: l'app mostra i posti col solo nome.

```json
{"photos": {
  "Q1442886": {"url": "/city-photos/Q1442886.jpg", "credit": "© LBM1948 · CC BY-SA 4.0"},
  "Q581589": {"url": "/city-photos/Q581589.jpg", "credit": null}
}}
```

### `GET /city-suggestions` (TASK-134, TASK-138, ADR-0110)

Città e luoghi mentre si scrive, `?q=Par` → Paris, Parma; `?q=arena di
ver` → Verona Arena: l'autocompletamento di Geoapify senza `type`, nel suo
ordine. Si tengono le città (`result_type` `city`, col punto della città
come `/cities`) e i luoghi (`amenity`, `building`, `street`, `suburb`,
`district`, solo con un nome); contee, regioni, stati e CAP no (la contea
di Milano ha il punto a Baggio). Due luoghi a meno di 150 m sono lo stesso:
resta il primo. Da 2 lettere (prima: lista vuota), al più 6, un'etichetta
una volta sola; cache di un giorno. 503 senza chiave.

```json
{"places": [
  {"label": "Verona, Veneto, Italy", "point": [45.4385, 10.9924], "kind": "city"},
  {"label": "Verona Arena, Verona, Italy", "point": [45.439, 10.9949], "kind": "place"}
]}
```

`kind` dice all'app se nominare il posto nelle parole di una richiesta
(una città) o mandarne solo il punto (un luogo). Prima di TASK-138 il campo
non c'era: l'app tratta come città una voce senza `kind`.

### `POST /themed-route-jobs` (TASK-129, ADR-0099)

Una forma che passa dai luoghi veri di un tema: `{"text": "voglio un
percorso romantico a Parigi", "centre": [lat, lon] | null, "city": … |
null}`. Risponde 202 con un job, letto con `GET /themed-route-jobs/{id}`
(`queued`, `running`, `done`, `failed`; i corpi in
`themed-route-job-done.json` e `-failed.json`).

- **Le parole**: tema, forma, km e città da tabelle in italiano, inglese
  e francese (`themes.py`); l'AI solo per un tema che le tabelle non
  trovano, e solo fra i temi elencati (`theme_reading.py`). Temi:
  `romantic`, `food`, `famous`, `tourist`, `panoramic`, `nature`,
  `culture`, e da TASK-134 le categorie dell'app: `shopping`, `nightlife`,
  `hidden`, `photography`, `family`, `running`, `walking`, `local`; la forma, se non è detta, quella del tema (cuore per
  `romantic`, stella per i luoghi famosi, cerchio per gli altri); 10 km se
  i km non sono detti, da 3 a 21.
- **La città**: quella nominata nelle parole, cercata come `/cities`;
  altrimenti `centre` dell'app (la città scelta o la partenza).
- **I luoghi**: Geoapify Places, dati OpenStreetMap, con un nome; prima
  quelli con una voce Wikidata, e per i temi «notevoli» solo quelli se
  sono almeno 3. Al più 15, entro un quarto della distanza (0,8–5 km).
  Cache di un giorno per città e tema.
- **Il percorso**: il motore (`route_engine/stops.py`) pianifica la forma
  dal centro e da 3 luoghi dove ce ne sono di più attorno; tiene, fra
  quelle da 0,85 di somiglianza in su, quella che passa a 80 m dal maggior
  numero di luoghi.
- **Il risultato**: `points`, `distance_m`, `similarity`, `shape`,
  `theme`, `city`, `centre` e **tutti** i luoghi trovati con `passed`.
- **Le foto dei luoghi** (TASK-329, ADR-0287): ogni luogo ha `wikidata`,
  il suo elemento quando OpenStreetMap ne nomina uno, altrimenti `null`; un
  luogo toccato ha `photo` come i posti di `/nearby-cities` (stesse regole,
  attesa al più 2 s, solo gli elementi a Wikimedia), `null` senza una foto
  libera e per i luoghi non toccati. Un'API prima di TASK-329 non ha i due
  campi: l'app mostra i posti col solo nome.
- **Errori del job** (`error.code`): `theme_unknown`, `city_unknown`,
  `no_places` (meno di 2 luoghi verificati: lo dice, non inventa),
  `places_unavailable`, e quelli dei percorsi (`shape_not_drawable`,
  `map_data_unavailable`). 503 se l'API non ha i percorsi a tema.

### `POST /track-scores`

Il punteggio di una corsa (TASK-113, ADR-0093). Riceve un
`TrackScoreRequest`:

```json
{
  "points": [[46.0671, 11.1214], [46.0671, 11.1344]],
  "similarity": 0.91,
  "track": [
    { "point": [46.0671, 11.1214], "time_ms": 1790000000000, "accuracy_m": 6.0 }
  ]
}
```

`points` e `similarity` sono quelli del `RouteResult` del percorso seguito
(e i suoi `walks`, sotto);
`track` sono le posizioni registrate dall'app, in ordine (`accuracy_m` può
mancare o essere `null`). Risponde `200` con un `TrackScoreResult`:
`score` da 0 a 100, `fidelity`, `covered` (quota del percorso corsa),
`on_route` (quota della corsa sul percorso) e `distance_m`, calcolati da
`track_score.py` del motore (`ROUTE_ENGINE.md` §5, ADR-0090). Niente grafo,
niente rete, e l'API non ricorda niente. Una corsa con meno di 2 posizioni
buone o più corta del 10% del percorso risponde `422 invalid_request`, con
il motivo del motore nel messaggio («This run cannot be scored: …»). Al più
20 000 posizioni e 50 000 punti di percorso.

**`walks`** (TASK-197, facoltativo): quelli del `RouteResult` di una parola
con la penna alzata. La corsa si confronta allora con le sole lettere: le
posizioni su un tratto a piedi, o sulla linea dritta che una registrazione
in pausa traccia fra il suo inizio e la sua fine, non contano
(`ROUTE_ENGINE.md` §5, «Il punteggio di una traccia corsa»). Senza, o
vuoto, il punteggio di prima; dei `walks` che non stanno nei `points` sono
`422 invalid_request`.

### `POST /signals` (TASK-142, ADR-0112)

Cosa ha fatto l'app con una ricerca, per gli eventi delle ricerche
(`docs/INSIGHTS.md`). Tre corpi, distinti da `kind` (in
`packages/shared-types/fixtures/signals.json`, tipi in
`packages/shared-types/src/signals.ts`):

| `kind` | Campi | Quando |
|---|---|---|
| `city_chosen` | `label`, `point`, `place` (facoltativo), `via`: `suggestion`, `recent`, `featured`, `typed` | una città o un luogo scelto in «Explore» |
| `route_chosen` | `shape` (o `"image"`) o `word`; `index` (0 è A), `of` (1–3), `via`: `start`, `gpx` | il primo uso di un percorso fra quelli offerti |
| `hint_taken` | `shape` o `word`; `hint`: `try_distance` (con `to_m`), `catalog_shape` o `better_distance` (con `to_m`, TASK-234 C); `distance_m` | «Try N km», o una forma del catalogo dopo un percorso fallito; `better_distance`: «Try N km» della riga sotto un percorso riuscito |

Risponde sempre `204` a un corpo valido, anche con gli eventi spenti; un
campo in più, una forma fuori catalogo, un indice fuori dai percorsi offerti
o una posizione fuori dalla Terra: `422 invalid_request` (un'app più nuova
dell'API riceve 422 per un `hint` che l'API non conosce ancora, e lo
ignora). Oltre 60 segnali
al minuto, tutti i client insieme, il segnale non si registra (avviso nel
log). Il `point` si registra come cella di ~1 km; la partenza non c'è mai.

### `POST /route-directions` (TASK-145, ADR-0117)

Le indicazioni di svolta di un percorso che l'app ha solo come punti: uno
di «Explore» (consigliato, esempio di una città o a tema), prima di
«Start». Riceve `{"points": [[lat, lon], …]}`, da 2 a 50 000 punti, la
linea come l'ha disegnata il motore
(`packages/shared-types/fixtures/route-directions-request.json`). Risponde
`200` con `{"directions": [...]}`, le stesse `Direction` di
`RouteResult.directions`, partenza compresa, con gli `along` (ADR-0057)
(`route-directions.json`).

Il grafo è quello della zona, come per i percorsi: in memoria, dalla
cache, o scaricato; si ritaglia 250 m attorno alla linea. I nodi della
linea li ritrova `route_nodes.py` del motore (`ROUTE_ENGINE.md` §4). Una
linea che non segue le strade della mappa risponde `422 invalid_request`
(«The route does not follow the roads of this map.»: anche una sull'acqua,
TASK-191), una zona che non si scarica `503 map_data_unavailable`. Niente si salva. Misurato il
2026-10-01 sul Mac, zone in cache: 0,1–0,5 s per percorsi di 5–23 km.

### `POST /way-back` (TASK-314, ADR-0274)

La strada per tornare sul percorso, sulle vie, per chi ne è uscito.
Riceve `{"activity", "here", "ahead"}`
(`packages/shared-types/fixtures/way-back-request.json`): l'attività della
corsa (`running` o `cycling`), dove si trova il runner e il tratto del
percorso dove può rientrare, da 2 a 10 000 punti nell'ordine del percorso.
Il tratto lo taglia l'app (ADR-0263, punto 2). Risponde `200` con
`{"points", "distance_m", "rejoin", "rejoin_m", "directions"}`
(`way-back.json`):

- `points`: la strada dal runner lungo le vie fino al percorso;
- `rejoin`: il nodo del percorso dove arriva; `rejoin_m`: dove cade lungo
  `ahead`, dal suo primo punto;
- `directions`: le stesse `Direction` dei percorsi, con gli `along`, con
  `distance_m` lungo `points`. La prima è la via da cui si parte, l'ultima
  la svolta sul percorso.

Coordinate a 7 decimali e metri al decimetro: la stessa risposta su ogni
macchina. La calcola `route_engine/way_back.py`. Parte dal punto della via
più vicina al runner e arriva al nodo del tratto più vicino per strada
(ADR-0274). Se quella via è già un pezzo del tratto, la strada va solo
fino a lei: due punti, nessuna indicazione. Il grafo è la zona già in
cache, ritagliata 500 m attorno al runner e al tratto: questa richiesta
non scarica mai una zona.

Risposte d'errore:

- nessuna zona in cache per l'area: `503 map_data_unavailable`;
- nessuna strada entro 3 km, il runner a più di 200 m da ogni strada, o un
  tratto che non segue le strade della mappa: `422 invalid_request`;
- sull'acqua: `422 invalid_request`;
- oltre 6 richieste al minuto dallo stesso telefono (`X-Phone-Id`,
  altrimenti l'indirizzo) o 60 dallo stesso indirizzo:
  `429 too_many_requests` con `Retry-After`.

Niente si salva, e il log non tiene posizioni. Il telefono calcola la
stessa risposta col suo motore (`on_phone.way_back_json`) e chiede al
server solo quando non ha la zona. Un'API più vecchia di TASK-314 risponde
`404`, e l'app tiene la linea dritta di ADR-0263.

### `POST /shape-readings`

Le parole del riquadro della forma che la tabella dell'app non conosce
(ADR-0012, `AI.md`). Riceve uno `ShapeReadingRequest`:

```json
{ "text": "stemma della Ferrari" }
```

e risponde `200` con uno `ShapeReading`: le parole come lette (spazi
singoli, nessuno ai lati) e una forma del catalogo, o `null` se nessuna va
bene.

```json
{ "text": "stemma della Ferrari", "shape": "horse" }
```

Il testo va da 1 a 60 caratteri: fuori da lì, `422 invalid_request`. Se
Ollama è spento, non ha il modello o non risponde entro 90 s, `503
ai_unavailable`, con il motivo nel messaggio. Le stesse parole, a meno di
maiuscole e spazi, si chiedono al modello una volta sola: l'API le ricorda
finché non si riavvia.

### `POST /routes`

Riceve un `RouteRequest`:

```json
{ "start": [46.0671, 11.1214], "shape": "heart", "distance_m": 5000, "activity": "running" }
```

`start` è `[lat, lon]`; `activity` si può omettere (`running`), oppure è
`cycling`, un percorso in bici, o `paddling`, in canoa sull'acqua (sotto).
Un campo in più o scritto male è un errore, non si ignora.

Risponde `200` con un `RouteResult`:

```json
{
  "points": [[46.0671, 11.1214], "…", [46.0671, 11.1214]],
  "distance_m": 5230.4,
  "similarity": 0.91,
  "shape": "heart",
  "warnings": ["start moved 250 m south of the requested point, …"],
  "directions": []
}
```

Qui `directions` resta vuoto: le indicazioni arrivano solo con le
richieste in due tempi (sopra). Nel `GpxRequest` si può omettere.

**`alternatives`** (TASK-093, ADR-0087): altri percorsi per la stessa
richiesta, dal migliore, al più 2 (`MAX_ALTERNATIVES`). Ognuno è un
`RouteResult` intero, con i suoi `points`, `distance_m`, `similarity`,
avvisi e, nei job, le sue `directions`; il suo `alternatives` è vuoto. Si
sceglie nell'app: il `GpxRequest` manda poi il risultato scelto, con o
senza il campo. Un'API precedente non lo manda, e l'app mostra il percorso
da solo. Quali entrano: `ROUTE_ENGINE.md`, «Altri percorsi fra cui
scegliere». Il registro delle richieste scrive anche le loro impronte
(`outcome.alternatives`), e il replay le confronta.

**`better_distance_m`** (TASK-234, ADR-0197): una distanza, in metri al
km intero, dove la ricerca ha visto la forma venire chiaramente meglio,
per «This heart comes out better at about 12 km» con «Try 12 km»
nell'app. Viene dai tentativi che la ricerca ha già tracciato (nessun
calcolo in più, `ROUTE_ENGINE.md`, «Dove la forma viene meglio»); il
percorso scelto è quello di sempre. È `null` senza un consiglio, nelle
alternative e sull'acqua; mai la distanza chiesta, né una fuori dai limiti
dell'attività (bici 10–30 km) o sotto i 3 km a lettera di una parola. Come
`suggested_distance_m` di un errore, non è garantita: un nuovo disegno
rifà la ricerca. Un'API precedente non lo manda (in `shared-types` è
facoltativo), le app installate lo ignorano, e il `GpxRequest` lo accetta
con o senza. Esempio: `fixtures/route-result-better-distance.json`.

**`rotation_deg`** (TASK-232, ADR-0195): di quanti gradi è girata la
forma, in senso antiorario come nel motore (ADR-0018), fra −180 e 180. Il
motore inclina una forma fino a 45° quando così segue meglio le strade
(`ROUTE_ENGINE.md` §5, «Forme inclinate»), e l'app gira la mappa di
`−rotation_deg` (il `bearing` di MapLibre è in senso orario) perché il
disegno si veda dritto. Vale 0 per una forma dritta e per quelle che
girano libere, come il cerchio: lì la mappa resta col nord in alto. Ogni
alternativa ha il suo. Il GPX non cambia: ha le coordinate vere. Un'API
precedente non lo manda (in `shared-types` è facoltativo: senza, nord in
alto), le app installate lo ignorano, e il `GpxRequest` lo accetta con o
senza; fuori da [−180, 180] è un `422`. Esempio:
`fixtures/route-result-tilted.json`.

La richiesta è sincrona: la risposta arriva quando il percorso è pronto
(tempi sotto). Resta per `/docs`, `curl` e le misure; l'app usa
`/route-jobs`.

### In bici: `"activity": "cycling"` (TASK-190, ADR-0153)

```json
{ "start": [46.0671, 11.1214], "shape": "circle", "distance_m": 20000, "activity": "cycling" }
```

- **La rete della bici**: ciclabili e strade fino alle `primary`, i sensi
  unici rispettati, mai scale, `trunk`, autostrade o vie vietate alle bici
  (`ROUTE_ENGINE.md`, `MAPS.md`). Vale per `/routes`, `/route-jobs` e
  `/image-route-jobs`: forma, parola o foto. Il `RouteResult` è lo stesso
  di una corsa; fra gli avvisi c'è in più lo sterrato («… m of the route on
  unpaved roads»).
- **La bici a mano** (TASK-206, ADR-0167): dove la bici non si guida il
  percorso la porta a mano per brevi tratti (`ROUTE_ENGINE.md`, «La bici a
  mano»), e il `RouteResult` dice dove con **`on_foot`**: una coppia `[da,
  a]` di indici in `points` per ogni tratto, compresi tutti e due, in
  ordine, come i `walks` della penna alzata (ma non si mette in pausa
  niente: la corsa continua a registrare). Un tratto è una fila di archi a
  piedi; dove ricomincia la sella finisce. Ogni alternativa ha i suoi, e
  da una partenza vicina contano anche l'avvicinamento e il ritorno.
  L'avviso dice i metri («… m of the route with the bike on foot»).
  Esempio: `fixtures/route-result-cycling.json`.

```json
{
  "points": [[46.0671, 11.1214], "…", [46.0671, 11.1214]],
  "distance_m": 10068.1,
  "shape": "circle",
  "warnings": ["923 m of the route with the bike on foot"],
  "walks": [],
  "on_foot": [[2, 3]],
  "…": "…"
}
```

- **`on_foot` c'è sempre nelle risposte**, vuoto per la corsa, la canoa e
  una zona della bici fatta prima di TASK-206 (senza archi a piedi). Un'API
  precedente non lo manda: in `shared-types` è facoltativo, e le app
  installate ignorano il campo. Nel `GpxRequest` si può rimandare com'è
  arrivato o lasciare fuori; se c'è si controlla come i `walks` (fuori dai
  punti, all'indietro o sovrapposti: `422 invalid_request`). Il GPX non
  cambia: i tratti a mano sono pezzi della traccia come gli altri.
- **Da 10 a 30 km** (`DISTANCE_LIMITS_M` in `shared-types`): fuori è `422
  invalid_request`, `distance must be between 10000 and 30000 metres for
  cycling, got 5000`. La corsa resta 1–50 km, con il messaggio di prima.
  La distanza suggerita di `shape_not_drawable` resta in quei limiti.
- **Solo le attività del contratto**, `running`, `cycling` e, dalla parte
  B di TASK-191, `paddling` (`SUPPORTED_ACTIVITIES`): un'altra è `422
  invalid_request`, `unsupported activity 'swimming'; choose one of:
  running, cycling, paddling`.
- **Le zone**: l'API ha le zone della bici accanto a quelle a piedi,
  `bike_*` in `data/cache/` (`MAPS.md`, «Cache»), e ne tiene in memoria una
  sola (sotto, «Grafi»). Le città con la zona della bici già fatta
  (`prefetch_zones --activity cycling`, 26 × 26 km attorno al centro)
  rispondono senza scaricare; altrove la prima richiesta scarica la zona da
  Overpass (`downloading_map`), due richieste grandi che Overpass può
  rifiutare (`503 map_data_unavailable`).
- **Gli esempi tenuti** distinguono l'attività: la stessa forma dallo
  stesso centro in bici è un altro percorso. `draw_examples` disegna solo
  quelli a piedi: cosa mostra «Explore» con la bici lo decide l'utente
  (TASK-190, parte C).
- Le indicazioni di un percorso di «Explore» (`/route-directions`) e i
  percorsi a tema restano a piedi. Un preferito in bici ricorda la sua
  attività (TASK-200, «Favorites»): la sua esportazione GPX la manda; le
  sue indicazioni, chieste a `/route-directions` con i soli punti, restano
  a piedi.
- **Tempi**: non ancora misurati su una zona vera della bici (task file
  di TASK-190).

### Sull'acqua: `"activity": "paddling"` (TASK-191, ADR-0161, ADR-0164)

```json
{ "start": [44.0007, 12.6513], "shape": "heart", "distance_m": 2000, "activity": "paddling" }
```

(`fixtures/route-request-paddling.json`, sulla costa delle fixture del
motore.)

- **La forma è il percorso**: il motore la mette su un lago o sul mare,
  entro 1 km dalla riva, al mare oltre 200 m dalla riva e sui laghi oltre
  50 m, e la unisce a una partenza sulla riva dove si arriva a piedi, con
  un tratto dritto all'andata e lo stesso al ritorno (`ROUTE_ENGINE.md`
  §8, ADR-0154). Vale per `/routes` e `/route-jobs`.
- **Il `RouteResult`** è quello di sempre: `points` chiuso, che parte e
  arriva sulla riva (il primo punto **non** è `start`), tratti compresi
  in `distance_m`; `similarity` 1 (la forma è sé stessa: quanto si è
  rimpicciolita lo dice la distanza); `warnings`, `directions`,
  `alternatives` e `walks` vuoti. **Niente indicazioni di svolta**: si
  leggono sul grafo delle strade, e sull'acqua non c'è. **Niente
  alternative A · B · C**: il motore piazza la forma una volta. Il GPX
  (`POST /gpx`) è quello di ogni percorso, tratti dalla riva compresi.
- **Da 1 a 5 km** (`DISTANCE_LIMITS_M.paddling`, scelta dell'utente):
  fuori è `422 invalid_request`, `distance must be between 1000 and 5000
  metres for paddling, got 5001`.
- **Solo una forma del catalogo**: una parola è `422 invalid_request`, `on
  the water only a shape of the catalogue is drawn, not a word` (dal
  motore); un'immagine (`/image-route-jobs`, anche dentro `/gpx`) `… not an
  image`, prima di guardare la distanza.
- **Lontano dall'acqua**: `422 shape_not_drawable`, `there is no lake or
  sea to paddle on within 2 km of here`, `suggested_distance_m` `null`.
- **La forma non ci sta** (al mare oltre circa 3 km): `422
  shape_not_drawable`, `the heart does not fit at 5 km on the water within
  1 km of the shore here: it fits at 3.1 km`, e `suggested_distance_m` è
  quella distanza **per difetto al mezzo km** (3000), mai sotto 1 km
  (allora `null`) né sopra 5: chiesta, il percorso c'è (ADR-0164; corsa e
  bici restano al km più vicino). Se la forma ci sta ma nessuna riva a
  300 m si raggiunge a piedi, lo dice il messaggio, senza distanza.
- **L'acqua** sta in `data/cache/water/` (`--cache-dir`, accanto alle
  zone; `MAPS.md`, «Cache»): un file che contiene l'area della richiesta
  (la partenza ± 4–5 km) la serve; altrimenti **una** richiesta Overpass,
  che il job mostra come `downloading_map` e che si salva per la prossima.
  Un download alla volta; uno che non riesce è `503
  map_data_unavailable`. Un job annullato durante il download non piazza
  la forma. Nessuna zona da scaricare prima: `prefetch_zones --activity`
  è solo per `running` e `cycling`.
- **`/route-directions`** con i punti di un percorso sull'acqua: la
  richiesta non dice l'attività, quindi l'API carica la zona a piedi
  attorno alla linea (la scarica, se manca) e risponde `422
  invalid_request`, `The route does not follow the roads of this map.`.
  L'app non le deve chiedere: il percorso sull'acqua ha già `directions`
  vuoto.
- **I preferiti** tengono `paddling` (migrazione `0010`, «Favorites»); gli
  **esempi tenuti** distinguono l'attività, come la bici. Dalla parte B di
  TASK-246 l'API tiene anche le figure dai punti dei laghi e delle
  spiagge dell'app, e `draw_examples --water` le disegna prima (sopra,
  «Le figure «Paddle» dei laghi e delle spiagge»).
- **Tempi** sulle fixture del motore: 0,1–1 s un piano, l'acqua letta
  dalla cache in un attimo; un download Overpass non è mai stato misurato
  (task file).
- **La forma spostata dall'utente** (TASK-238, ADR-0202): il risultato di
  un percorso sull'acqua ha `centre`, `[lat, lon]`, il centro della forma
  come è stata messa (su strada `null`). La richiesta può avere `near`,
  `[lat, lon]`: dove l'utente vuole quel centro, cioè il `centre` di prima
  spostato. Il motore mette la forma **nel posto più vicino a `near` in cui
  ci sta**: nella fascia, con una riva raggiungibile a piedi entro 300 m,
  entro 2 km dalla `start`, che resta quella della prima richiesta. Può
  quindi rispondere con un `centre` diverso da `near`, e con una forma un
  po' più piccola o inclinata. `near` uguale al `centre` ricevuto dà lo
  stesso percorso.

  ```json
  { "start": [44.0007, 12.6513], "shape": "heart", "distance_m": 2000,
    "activity": "paddling", "near": [44.0041, 12.6569] }
  ```

  (`fixtures/route-request-paddling-near.json`,
  `fixtures/route-result-paddling.json`.) Con un'altra attività `near` è
  `422 invalid_request`, `a shape is placed near a point only on the
  water`; così una latitudine o una longitudine impossibili. Gli errori
  sono quelli di ogni richiesta sull'acqua. Un percorso spostato **non si
  tiene** fra gli esempi (`route_store`): è di chi l'ha spostato. I due
  campi sono facoltativi: un'app di prima non manda `near` e ignora
  `centre`; un'API di prima rifiuta `near` (`extra="forbid"`), quindi l'app
  offre lo spostamento solo quando il risultato ha `centre`. Tempi
  sull'acqua vera (Garda, Como, Jesolo, Riccione, 2 km): 1–6 s.

### Una parola invece di una forma (TASK-056)

Un `RouteRequest` ha `shape` **oppure** `word`: l'altro manca o è `null`.
Con `word` il motore scrive la parola una lettera alla volta, come la CLI
con `--word` (ADR-0044):

```json
{ "start": [46.0671, 11.1214], "word": "ciao", "distance_m": 15000, "activity": "running" }
```

- Maiuscole o minuscole, solo le lettere dell'alfabeto del motore
  (`route_engine/letters.json`, dalla A alla Z dal TASK-059: niente
  accenti, cifre o spazi), al più 8, e almeno 3 km di percorso per
  lettera: «CIAO» vuole almeno 12 km. Sono `LETTERS`, `MAX_WORD_LETTERS` e
  `LETTER_DISTANCE_M` in `shared-types`, così l'app può controllare prima
  di chiedere. Per «città» il messaggio è `no letter À: a word can use
  only the letters A to Z`.
- Il `RouteResult` ha `"shape": null` e `"word": "CIAO"`, la parola in
  maiuscole; per una forma è il contrario, con `"word": null`.
- Il nome del file GPX usa la parola: `sgrava-CIAO-15km-2026-09-24.gpx`.
- `style` sceglie le lettere (TASK-080, ADR-0075): `"round"`, il
  predefinito, oppure `"block"`, le lettere squadrate girate sulla griglia
  delle vie (ADR-0072). Solo con una parola: `"block"` con una forma, o uno
  stile che non c'è, è `invalid_request` (`a style is for the letters of a
  word`, `unknown style 'italic'`). Gli stili sono `LETTER_STYLES` in
  `shared-types`; una richiesta d'immagine non ha `style`.
- Una parola chiede più tempo di una forma: 40–140 s per «CIAO» a 15 km,
  quasi sempre con la ricerca fino a 2 km (ADR-0044); con le lettere di
  più tratti di più, fino a 258 s per «BELLO» (ADR-0056).

### La penna alzata (TASK-197, ADR-0157)

Una parola si può chiedere con **`"pen_up": true`**: ogni lettera si
disegna da sola, e fra una e l'altra si cammina senza disegnare
(`ROUTE_ENGINE.md` §2 e §5, «La penna alzata»):

```json
{ "start": [46.0671, 11.1214], "word": "ciao", "distance_m": 15000, "activity": "running", "pen_up": true }
```

- **Facoltativo**, `false` se manca: le app già installate non lo mandano
  e ricevono il percorso di sempre. Con `word`, o con una **forma a pezzi**
  (TASK-223, sotto). Con un'altra forma è `invalid_request` (`pen_up is for
  the letters of a word, or the pieces of a shape; heart has none`), in una
  richiesta d'immagine anche (`pen_up is for the letters of a word`).
- La distanza chiesta vale per le **lettere**, la parte che la corsa
  registra; `distance_m` del risultato resta la lunghezza di tutti i
  `points`, tratti a piedi compresi (a Trento, «CIAO» da 15 km: 15,4 km di
  lettere, 19,6 in tutto).
- Il `RouteResult` ha **`walks`**: una coppia `[da, a]` di indici in
  `points` per ogni tratto a piedi, compresi tutti e due, in ordine; dove
  finisce un tratto comincia la lettera successiva. Con n lettere n − 1
  coppie. I `points` restano una linea sola, da seguire (navigazione,
  indicazioni, GPX), ma **non è chiusa**: va dalla prima lettera all'ultima.
  `similarity` è delle sole lettere. Ogni alternativa ha i suoi `walks`.

```json
{
  "points": [[46.0671, 11.1214], "…", [46.0671, 11.1253], "…", [46.0671, 11.1253]],
  "distance_m": 5506.5,
  "similarity": 0.9,
  "shape": null,
  "word": "IO",
  "walks": [[2, 5]],
  "…": "…"
}
```

  Qui i punti da 2 a 5 si camminano: la I finisce al punto 2, la O
  comincia al 5.
- **Una forma a pezzi** (TASK-223, ADR-0185, `ROUTE_ENGINE.md` §2, «Pezzi
  staccati dal contorno»): con `"shape": "smiley", "pen_up": true` si
  disegna prima il contorno, poi ogni pezzo da solo, a piedi fra l'uno e
  l'altro come fra le lettere. Le forme che lo accettano sono
  `PEN_UP_SHAPES` in `shared-types`: `smiley`, `ghost`, `donut`, `sun`, e
  `cat`, `fish`, `dog_head`, `rabbit_head`, `pumpkin`, che staccano gli
  occhi. Il risultato ha `shape` e `word: null`, con i `walks` (su strada
  fino a 8, i raggi del sole).
- **Una forma a pezzi sull'acqua** (TASK-226, ADR-0188): `pen_up` vale
  anche con `"activity": "paddling"`. Il percorso lascia il contorno
  vicino ai pezzi, li disegna uno per volta e torna: i `walks` sono i
  tratti pagaiati senza disegnare, uno per pezzo più il ritorno al
  contorno (fino a 9, per il sole). La distanza chiesta è quella di tutto
  il percorso, tratti a penna alzata compresi. Una forma senza pezzi resta
  `invalid_request`. Senza `pen_up` la risposta è quella di prima.
- **`walks` c'è sempre nelle risposte**, vuoto per una forma senza
  `pen_up`, un'immagine e una parola senza. Un'API precedente non lo manda: in
  `shared-types` è facoltativo, e un'app nuova legge anche un'API vecchia
  come una linea sola. Le app installate ignorano il campo.
- Nel `GpxRequest` e nel `TrackScoreRequest` i `walks` si rimandano come
  sono arrivati (`POST /gpx`, `POST /track-scores`); da TASK-199 anche con
  una corsa salvata e con un preferito («My activities», «Favorites»).

### Un'immagine invece di una forma (TASK-073)

Due richieste, e il contorno si vede prima del percorso (ADR-0069).

**`POST /image-outlines`** — il motore ricava il contorno dell'immagine
(`route_engine/image_outline.py`, ADR-0068):

```json
{ "image": "/9j/4AAQSkZJRgABAQ…" }
```

`image` è il file PNG o JPEG in base64, dentro il JSON: al più 10 MB prima
della codifica (`MAX_IMAGE_BYTES`), cioè 13 333 336 caratteri. Nessun upload
multipart, che vorrebbe `python-multipart`. La risposta, in meno di 2 s:

```json
{ "points": [[-1.0, -0.8], [1.0, -0.8], [0.0, 0.9], [-1.0, -0.8]],
  "image_points": [[0.1, 0.9], [0.9, 0.9], [0.5, 0.05], [0.1, 0.9]],
  "aspect": 1.0 }
```

- `points`: il contorno chiuso, centrato e scalato in [-1, 1], y in alto,
  al più 100 angoli (`MAX_OUTLINE_POINTS`): è quello che torna indietro
  con la richiesta del percorso.
- `image_points`: gli stessi angoli sopra l'immagine, come frazioni di
  larghezza e altezza dall'angolo in alto a sinistra: l'app ci disegna la
  linea sopra la foto.
- `aspect`: larghezza su altezza dell'immagine, dritta (EXIF).
- `strokes` e `image_strokes` (dal TASK-084 anche per una foto appena
  letta): con più soggetti, fino a 4, ogni soggetto dopo il più grande è
  un tratto, nei due sistemi di `points` e `image_points`. Il primo lato è
  il collegamento, dalla linea già disegnata al soggetto; il resto è il
  contorno del soggetto, che si chiude sul secondo punto. Vuoti con un
  soggetto solo. L'app li disegna e li rimanda senza cambiarli.

Un'immagine che non dà un contorno è rifiutata con `422`
`image_not_usable` e il motivo del motore in `reason`: `format`,
`unreadable`, `background`, `no_subject`, `scattered`, `edge`, `small`,
`jagged` (`IMAGE_REASONS` in `shared-types`). Dal TASK-084 `scattered`
vuol dire più di 4 soggetti: fino a 4 si disegnano. Base64 non valido o
un'immagine oltre il limite sono `invalid_request`.

**`POST /image-route-jobs`** — il percorso del contorno, come `/route-jobs`:

```json
{ "start": [46.0671, 11.1214], "outline": [[-1.0, -0.8], [1.0, -0.8], [0.0, 0.9], [-1.0, -0.8]], "distance_m": 15000, "activity": "running" }
```

- `outline` sono i `points` di `/image-outlines`, senza cambiarli.
  L'immagine non viaggia una seconda volta.
- Il contorno arriva dal telefono e si controlla come ogni input: da 4 a
  101 punti, numeri finiti, dentro [-1, 1], e poi il controllo del motore
  (`parse_outline`: chiuso, almeno 3 punti distinti, senza incroci).
  Altrimenti `422` `invalid_request` con quello che non va
  (`outline: the outline crosses itself: …`).
- Partenza, distanza e attività si controllano come per una forma.
- La risposta è un `RouteJob`: si legge e si annulla su
  `/route-jobs/{job_id}`, come gli altri. Il motore lo disegna come
  `--image` dalla CLI, dritto (ADR-0038); il `RouteResult` ha `"shape":
  null` e `"word": null`. Con la mela di TASK-072 a Trento, 10 km:
  9,2 km, somiglianza 0,94, in 27 s.
- Il GPX si chiede a `POST /gpx` con questa richiesta al posto del
  `RouteRequest`; il file si chiama `sgrava-image-15km-2026-09-26.gpx`.
- `strokes` (dal TASK-079, facoltativo): gli altri soggetti della foto
  (TASK-084) e i dettagli disegnati a mano, gli `strokes` di un
  `ImageOutline`, senza cambiarli. Si controllano come il contorno: numeri
  finiti, dentro [-1, 1], al più 200 punti **percorsi** in tutto
  (`MAX_DETAIL_POINTS`): un anello conta una volta, un tratto andata e
  ritorno due, quindi circa 100 punti di dettagli senza anello; poi `parse_outline` con i
  dettagli (ognuno parte dalla linea o da un dettaglio prima; possono
  incrociarsi e incrociare il contorno). Il percorso segue ogni dettaglio e torna indietro.

### Modificare il contorno (TASK-079)

**`POST /image-outline-edits`** — una parte o un dettaglio disegnati col
dito sull'anteprima (ADR-0074). L'API non tiene niente fra due modifiche:
l'app manda il contorno che mostra e la linea disegnata.

```json
{ "image_points": [[0.1, 0.9], [0.9, 0.9], [0.5, 0.05], [0.1, 0.9]],
  "image_strokes": [],
  "aspect": 1.0,
  "kind": "detail",
  "line": [[0.5, 0.88], [0.5, 0.7], [0.5, 0.5]] }
```

- `image_points`, `image_strokes`, `aspect`: quelli dell'`ImageOutline`
  mostrato; `line`: la linea disegnata, come frazioni della foto
  dall'angolo in alto a sinistra, da 2 a 2000 punti.
- `kind`: `part`, una linea chiusa: a cavallo del contorno si unisce alla
  sagoma, altrove (dentro o fuori) resta un anello appeso alla linea più
  vicina; `detail`, una linea che il percorso fa andata e ritorno: parte
  dal contorno (o da un dettaglio) se comincia lì vicino, altrimenti il
  motore la collega alla linea più vicina. Dove si incrocia da sola chiude
  un anello, come un occhio.
- La risposta è un `ImageOutline`, con in più `strokes` (nella cornice di
  `points`) e `image_strokes` (sopra la foto). `/image-outlines` li dà
  vuoti.
- Un disegno che non dà una linea sola è `422` `outline_edit_rejected`, con
  il motivo del motore in `reason`: `short`, `covers_detail`, `too_many_corners`
  (`EDIT_REASONS` in `shared-types`). Punti fuori da [0, 1], un contorno
  non valido o `aspect` fuori da 1/20–20 sono `invalid_request`.
- «Undo» è dell'app: torna al contorno di prima, senza chiamare l'API.

### Account (TASK-114, ADR-0120)

Email e password (ADR-0114), nel database di `DATABASE.md` (ADR-0115).
Tipi e esempi in `shared-types` (`SignUpRequest`, `SignInRequest`,
`Session`, `User`; `fixtures/sign-up-request.json`, `fixtures/session.json`).

| Endpoint | Cosa | Risposta |
|---|---|---|
| `POST /accounts` | iscriversi: `email`, `password`, `username`, `at_least_16`; facoltativi `away_email` e `language` (TASK-284) | `201` `Session`: iscriversi fa anche entrare |
| `POST /session` | entrare: `email`, `password` | `200` `Session` |
| `DELETE /session` | uscire, solo da questo telefono | `204` |
| `GET /me` | chi sono | `200` `User` |
| `DELETE /me` | cancellare l'account e tutto ciò che è suo, subito | `204` |

- `Session` è `{ "token": "…", "user": User }`; `User` è `id`, `email`,
  `username`, `role` (`user` o `admin`) e `created_at`, più `bio` e
  `public_id` da TASK-116 («Profile», sotto), `phone` da TASK-183
  («Email and phone number», sotto), `notifications` da TASK-185
  («Notifications», sotto) ed `email_confirmed` e `pending_email` da
  TASK-300 («Confirmed email and forgotten password», sotto). Il token è
  l'unica
  cosa segreta che l'API dà, e solo qui: l'app lo tiene in
  `expo-secure-store` e lo rimanda come `Authorization: Bearer <token>` a
  `GET /me`, `DELETE /session`, `DELETE /me`, ai preferiti e alle corse
  (sotto) e agli endpoint che verranno (la dipendenza `current_user` di
  `accounts.py`).
- L'email si salva in minuscolo; la password da 8 a 128 caratteri; il nome
  da 3 a 20 fra lettere, cifre, `_` e `.`, unico senza badare alle
  maiuscole. `at_least_16` falso è `422 invalid_request` (ADR-0114, punto
  6). Campi in più, come `role`, sono `invalid_request`.
- `away_email` (TASK-284) è la casella «Don't send me these emails»:
  `false` quando è spuntata spegne «Email when I'm away»; senza, resta
  acceso. Solo `true` o `false`. `language` (`en`, `de`, `it`, `es`, `fr`,
  o `null`) è la lingua dell'app, per i testi delle email; un'altra è
  `422 invalid_request`. L'app di prima non li manda: vale com'è senza.
- La password resta solo come hash Argon2id; del token il database tiene
  solo lo SHA-256. Né l'una né l'altro finiscono nei log.
- Una sessione finisce 90 giorni dopo l'ultimo uso (`session_expired`, una
  volta, poi `not_signed_in`) o con `DELETE /session`. Ogni telefono ha la
  sua: uscire da uno non fa uscire gli altri.
- Password sbagliata ed email sconosciuta danno lo stesso
  `401 wrong_credentials`, nello stesso tempo. Dopo 5 password sbagliate in
  15 minuti per la stessa email, `429 too_many_requests` con `Retry-After`,
  anche con quella giusta. Il limite dei POST di `SHAPEROUTE_RATE_LIMIT`
  vale in più.

### Sign in with Apple and Google (TASK-322, ADR-0282)

«Continue with Apple» (solo iPhone) e «Continue with Google» in «Sign up» e
in «Log in»: lo stesso tasto iscrive o fa entrare. Codice in
`sign_in_providers.py`, tabella `user_identities` in `DATABASE.md`. Tipi e
esempi in `shared-types` (`SignInProviders`, `ProviderSignInRequest`,
`NewAccountError`; `fixtures/sign-in-providers.json`,
`fixtures/provider-sign-in-request.json`, `fixtures/new-account-error.json`).

| Endpoint | Cosa | Risposta |
|---|---|---|
| `GET /session/providers` | quali provider sono accesi su questo server | `200` `{ "providers": ["apple", "google"] }` |
| `POST /session/{provider}` | entrare o iscriversi con `apple` o `google`: `id_token`; per Apple anche `authorization_code` e `nonce`; la seconda volta `username`, `at_least_16`, facoltativi `away_email` e `language` | `200` `Session` (account già suo), `201` `Session` (account nuovo), `404 new_account` |

- **`GET /session/providers`**: un provider è acceso quando l'API ha le sue
  chiavi in `.env` (`SHAPEROUTE_APPLE_TEAM_ID`, `SHAPEROUTE_APPLE_KEY_ID`,
  `SHAPEROUTE_APPLE_KEY_P8` per Apple; `SHAPEROUTE_GOOGLE_CLIENT_IDS` per
  Google); vuoto senza database. L'app mostra solo quei tasti. Un provider
  spento risponde `503 provider_unavailable`.
- **Il token si legge sul server**, con le chiavi pubbliche del provider
  (`appleid.apple.com/auth/keys`, `www.googleapis.com/oauth2/v3/certs`)
  tenute in memoria quanto dice il loro `Cache-Control` (da 1 minuto a un
  giorno; una chiave nuova si richiede al massimo una volta al minuto).
  Valgono: firma `RS256`, `iss` del provider, `aud` dell'app (Apple: il
  bundle `com.lppl1316.sgrava`; Google: uno dei client ID), scadenza e
  `iat` con un minuto di tolleranza, `email` con `email_verified` vero, e
  per Apple il `nonce`: l'app ne fa uno, lo manda qui com'è e ad Apple il
  suo SHA-256 in esadecimale. Altrimenti `401 wrong_credentials`, e non si
  scrive niente. Chiavi del provider irraggiungibili e nessuna in memoria:
  `503 provider_unavailable`.
- **Chi è già noto** (stesso provider, stesso `sub`) entra nel suo account,
  `200`, anche se l'email del provider è cambiata (per esempio «Hide My
  Email» acceso dopo): conta l'identità, e l'account tiene la sua email.
- **Un'email già iscritta** (scelta 4 dell'utente): l'identità si lega a
  quell'account, `200`, e da allora lo aprono tutti e due i modi. Se
  l'account non aveva confermato l'email (TASK-300), la password di prima
  diventa una a caso e le sue sessioni finiscono; l'email diventa
  confermata. Con l'email confermata, password e sessioni restano.
- **Né l'una né l'altra**: senza `username` la risposta è
  `404 new_account`, con l'email da mostrare:
  `{ "error": { "code": "new_account", "message": "…", "email": "…",
  "suggested_distance_m": null, "reason": null } }`; non si scrive niente.
  L'app chiede il nome e rimanda la stessa richiesta con `username`,
  `at_least_16`, `away_email` e `language`, come in `POST /accounts`
  (stesse regole e stessi errori: `422`, `409 username_taken`): `201`
  `Session`. L'account nuovo ha l'email del provider già confermata, quindi
  nessuna email di conferma, e una password a caso che nessuno conosce:
  «Forgot password» resta un modo di averne una. Il nome e la foto di
  Google non si tengono.
- I token durano poco (Apple 10 minuti, Google un'ora): scaduto fra il
  `404` e il nome, è `401`, e l'app ne chiede un altro.
- **Apple**: alla prima entrata `authorization_code` diventa un refresh
  token (`appleid.apple.com/auth/token`, con un client secret `ES256`
  firmato con il `.p8`), tenuto solo per la revoca. Se Apple non lo dà,
  l'entrata va avanti lo stesso e ci riprova la volta dopo.
- **`DELETE /me`** di un account con Apple revoca l'accesso
  (`appleid.apple.com/auth/revoke`), come chiede Apple (App Review
  5.1.1(v)); una revoca che non riesce finisce nel log e non ferma la
  cancellazione. Per Google non si tiene nessun token: niente da revocare.
- Nei log non finiscono token, codici, nonce né il `.p8`. Il limite dei
  POST di `SHAPEROUTE_RATE_LIMIT` vale anche qui.

### Favorites (TASK-171, ADR-0139)

I percorsi che un account tiene. Tutti gli endpoint vogliono il token
(`Authorization: Bearer <token>`): senza, `401 not_signed_in`; senza
database, `503 accounts_unavailable`. Esempi in `shared-types`
(`fixtures/favorites.json`, `favorite.json`, `favorite-request.json`); i
tipi dell'app in `apps/mobile/src/api/favorites.ts`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `GET /me/favorites` | l'elenco, dal più recente | `200` `{ "favorites": [...] }` |
| `GET /me/favorites/{key}` | un preferito intero, con la linea | `200`, o `404 http_error` |
| `PUT /me/favorites/{key}` | tenere un percorso | `201` la prima volta, poi `200` |
| `DELETE /me/favorites/{key}` | toglierlo | `204`, anche se non c'era |

- **`key`** la fa l'app dalla linea del percorso (`favoriteKey`: 16 cifre
  esadecimali; l'API accetta da 8 a 40 fra minuscole e cifre): lo stesso
  percorso ha la stessa chiave su ogni telefono, e tenerlo due volte lo
  tiene una volta, com'era la prima (il secondo `PUT` non cambia niente).
- **Il corpo del `PUT`**: `city` (una città del catalogo, il luogo cercato,
  o vuota; al più 80 caratteri), `shape`, `word`, `style` (`round` o
  `block`), `title` (il tema di un percorso a tema, «Image» per una foto; al
  più 60), `distance_m` (chiesta), `route_m` (sulle strade), `similarity`
  (0–1), `points` come `[lat, lon]`, da 2 a 20 000. Campi in più, punti
  fuori dalla Terra o misure fuori scala: `422 invalid_request`.
- **Un preferito dell'elenco** ha `id` (la chiave), gli stessi campi senza
  `points`, `start`, `preview` (al più 64 punti, come i percorsi
  consigliati) e `created_at`. Quello intero ha `points`, cifra per cifra
  come sono stati mandati.
- **Al massimo 200 per account**: oltre, `422 invalid_request` con un
  messaggio che l'app mostra così com'è.
- Ognuno vede solo i suoi: la chiave di un altro dà `404`. `DELETE /me`
  cancella anche i preferiti.
- **Una parola con la penna alzata** (TASK-199, ADR-0158), o una forma a
  pezzi (TASK-223; al più 9 tratti da TASK-226, per l'acqua): il corpo del `PUT` può avere `walks`, quelli del `RouteResult` (coppie `[da, a]` di
  indici in `points`, «La penna alzata»), facoltativo. Si controllano come
  in `POST /track-scores`: fuori dai punti, all'indietro o sovrapposti,
  `422 invalid_request`. Il preferito intero ha **sempre** `walks`, vuoto
  per ogni altro percorso e per quelli tenuti prima; l'elenco non cambia.
  Esempi: `favorite-request-walks.json`, `favorite-walks.json`. Un'API
  precedente rifiuta il campo: l'app lo manda solo per una parola con la
  penna alzata, e se il `PUT` torna `422 invalid_request` lo rimanda una
  volta senza `walks`.
- **L'attività** (TASK-200, ADR-0160): il corpo del `PUT` può avere
  `activity`, quella di `RouteRequest` (`running`, `cycling`, «In bici», o
  `paddling`, «Sull'acqua», dalla migrazione `0010`), facoltativa: senza,
  `running`. Un'attività che l'API non offre è `422 invalid_request`, con
  le parole di `POST /routes` (`unsupported activity 'swimming'; choose
  one of: running, cycling, paddling`). L'elenco e il preferito
  intero hanno **sempre** `activity`: `running` per quelli tenuti prima. La
  chiave resta quella della linea: la stessa linea tenuta come corsa e poi
  in bici è un preferito solo, com'era la prima volta. Esempi:
  `favorite-request-cycling.json`, `favorites-cycling.json`,
  `favorite-cycling.json`. Un'API precedente rifiuta il campo: l'app lo
  manda solo quando non è `running` (la richiesta di una corsa resta byte
  per byte quella di prima), e se il `PUT` torna `422 invalid_request` lo
  rimanda una volta come un'app precedente a TASK-199, senza `activity` né
  `walks`: il preferito si tiene come una corsa.
- **La bici a mano** (TASK-206, ADR-0167, migrazione `0012`): il corpo del
  `PUT` può avere `on_foot`, quello del `RouteResult` (coppie `[da, a]` di
  indici in `points`, «In bici»), facoltativo, al più 1000 coppie; si
  controlla come `walks`. Il preferito intero ha **sempre** `on_foot`,
  vuoto per ogni altro percorso e per quelli tenuti prima; l'elenco non
  cambia. Esempi: `favorite-request-on-foot.json`, `favorite-on-foot.json`.
  Un'API precedente rifiuta il campo: l'app lo manda solo quando non è
  vuoto, e se il `PUT` torna `422 invalid_request` lo rimanda senza (parte
  C).
- **L'inclinazione della forma** (TASK-232, parte C, ADR-0195, migrazione
  `0018`): il corpo del `PUT` può avere `rotation_deg`, quello del
  `RouteResult` (gradi, antiorario, fra −180 e 180), facoltativo; l'app lo
  manda solo quando la forma è girata. Il preferito dell'elenco e quello
  intero hanno **sempre** `rotation_deg`: `null` per un percorso dritto e
  per quelli tenuti prima; la scheda e la mappa li girano dall'altra parte.
  Esempi: `favorite-request-turned.json`, `favorite-turned.json`. Un'API
  precedente rifiuta il campo: se il `PUT` torna `422 invalid_request`
  l'app lo rimanda senza, prima di provare come un'app precedente.

### My activities (TASK-172, ADR-0140)

Le corse che un account ha registrato, con un percorso o senza. Tutti gli
endpoint vogliono il token: senza, `401 not_signed_in`; senza database,
`503 accounts_unavailable`. Esempi in `shared-types`
(`fixtures/activities.json`, `activity.json`, `activity-request.json`); i
tipi dell'app in `apps/mobile/src/api/activities.ts`; il codice in
`activities.py`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `GET /me/activities` | una pagina dell'elenco, dalla corsa più recente | `200` `{ "activities": [...], "next": …, "total": … }` |
| `GET /me/activities/{key}` | una corsa intera, con le due linee | `200`, o `404 http_error` |
| `PUT /me/activities/{key}` | salvare una corsa | `201` la prima volta, poi `200` |
| `PUT /me/activities/{key}/post` | il post della corsa, come condiviso (TASK-258) | `200` con `shared_at`, o `404 http_error` |
| `DELETE /me/activities/{key}` | cancellarla | `204`, anche se non c'era |

- **`key`** la fa l'app dall'inizio della traccia (`activityKey`: 16 cifre
  esadecimali dall'orario e dal punto della prima posizione; l'API accetta
  da 8 a 40 fra minuscole e cifre): la stessa corsa mandata due volte è
  salvata una volta, com'era la prima (il secondo `PUT` risponde `200` e
  non cambia niente, nemmeno se il corpo è diverso). Il primo `PUT` di una
  corsa che ha un punteggio registra l'evento `run_scored` degli
  `insights`, con la sola `quality` (TASK-247, `INSIGHTS.md`).
- **Il corpo del `PUT`** è la corsa come il telefono l'ha registrata:
  `track`, le posizioni in ordine come per `POST /track-scores` (`point`,
  `time_ms` sull'orologio del telefono, `accuracy_m`), da 2 a 20 000;
  `pauses`, i tratti che non sono della corsa (`from_ms`, `to_ms`, `auto`:
  vero se l'app si è fermata da sola perché il corridore era fermo, falso
  se l'ha chiesto lui), al più 1 000, anche nessuna; `points` e
  `similarity`, il percorso seguito e la sua somiglianza (`RouteResult`),
  tutti e due o tutti e due `null` per una corsa senza percorso; `shape`,
  `word`, `style`, `title`: cosa disegna il percorso, come nei preferiti;
  `activity` (TASK-208), `running`, `cycling` o `paddling`, cosa era la
  corsa, per difetto `running` (un'app di prima non lo manda: ogni sua
  corsa era a piedi). Esempio: `activity-request-cycling.json`. Come il
  resto, conta solo al primo `PUT`; dopo si cambia dal disegno
  («Drawings», sotto), e lì si legge (`MyDrawing.activity`): l'elenco e la
  corsa intera di questa sezione non lo hanno.
- **L'altezza** (TASK-324, ADR-0284): ogni posizione può avere
  `altitude_m` (metri sul mare, fra −1000 e 10 000, altrimenti `422`;
  `POST /track-scores` non la prende). Assente da un'app di prima: la
  corsa non ha dislivello. Rifiutata, l'app rimanda la corsa senza.
- **Km, tempo, dislivello e punteggio li conta l'API**, e l'app non li
  può mandare (`distance_m`, `duration_s`, `score` nel corpo sono `422`):
  - la traccia tenuta è quella **pulita dal motore** (`clean_track`,
    ADR-0090): senza le posizioni troppo incerte, ripetute o che nessun
    corridore raggiunge. Con meno di 2 posizioni buone la corsa non si
    salva: `422 invalid_request`, «This run cannot be saved: …»;
  - `distance_m` è la lunghezza di quella traccia, in metri interi, senza
    il passo a cavallo di una pausa chiesta dal corridore (dove sia stato
    nella pausa non è corsa); una pausa `auto` non toglie metri;
  - `duration_s` è il tempo dalla prima all'ultima posizione tenuta, meno
    le pause (una volta sola dove due si sovrappongono), in secondi interi;
  - `score` e `fidelity` sono quelli di `track_score.py` contro `points`,
    come `POST /track-scores`; `null` senza percorso, e `null` anche quando
    la corsa è troppo corta per essere giudicata (si salva lo stesso);
  - `started_at` è l'orario della prima posizione tenuta. Un orario prima
    del 2020 o oltre domani non è un orologio: `422 invalid_request`;
  - il dislivello (`runs.climb_m`, per i totali del profilo; l'elenco non
    lo manda) è la somma delle salite di almeno 3 m dall'ultima altezza
    contata, sulle posizioni tenute, niente a cavallo di una pausa chiesta
    dal corridore (`run_climb.py`, la regola di `runMetrics.climbM`);
    `null` senza altezze.
- **`place`** è il nome del paese da cui la corsa parte («Trento»), o
  `null`. L'API lo chiede al geocoding inverso di Geoapify, con la chiave
  della ricerca dei luoghi (`GEOAPIFY_API_KEY`), per la partenza
  **arrotondata a due decimali** (circa un chilometre): il servizio non
  riceve mai il punto vero. Senza chiave, se il servizio non risponde o se
  lì non c'è un paese, `null`, e la corsa si salva lo stesso. Le risposte
  restano in memoria: due corse dallo stesso chilometro chiedono una volta.
- **Il post della corsa** (TASK-258, ADR-0222): `PUT
  /me/activities/{key}/post` riceve il post come l'app l'ha condiviso,
  `shared-types/fixtures/run-post-request.json`: `title` (quello scritto
  sul disegno, o `null`, al più 120 caratteri), `results` (fra
  `distance`, `time`, `pace`, ognuno al più una volta, nell'ordine del
  post) ed `emoji` (al più 5, ognuno con `emoji` e il centro `x`, `y` come
  frazioni della larghezza e dell'altezza dell'immagine, fra 0 e 1). Un
  campo in più, un'immagine per esempio, è `422 invalid_request`. Risponde
  il post con `shared_at` (`run-post.json`); scritto intero a ogni
  condivisione, l'ultimo vince. `404` per una corsa che l'account non ha.
  **Mai l'immagine**: si rifà dal post e dalla corsa. La corsa intera ha
  `post` (`null` per una corsa mai condivisa, e per ogni corsa salvata
  prima); l'elenco no.
- **Una corsa dell'elenco** ha `id` (la chiave), `started_at`, `place`,
  `shape`, `word`, `style`, `title`, `distance_m`, `duration_s`, `score`,
  `fidelity`, `activity` (`running`, `cycling` o `paddling`, com'è stata
  salvata; dal TASK-251: sull'acqua l'app scrive il passo ogni 500 m) e
  due anteprime leggere, al più 64 punti l'una:
  `route_preview` (`null` senza percorso) e `track_preview`. Quella intera
  ha al loro posto `points` (o `null`), `track` (la traccia pulita, come
  `[lat, lon]`) e `similarity`, e in più `walks` (sotto) e `pauses`.
- **Le pause della corsa intera** (TASK-200, ADR-0160): `pauses` c'è
  **sempre**, `[]` per una corsa senza. Ognuna è `{"from_s", "to_s",
  "auto"}`, più `"pen": true` solo per una pausa della penna, come le
  tiene la riga (`DATABASE.md`): in secondi dal primo punto di `track`,
  lo stesso orologio della traccia, e solo quello che di ogni pausa sta
  dentro la corsa; nell'ordine in cui l'app le ha mandate, due che si
  sovrappongono restano due. Una pausa tutta fuori dalla corsa non c'è.
  L'elenco non le ha. Esempio: `activity-pauses.json`, la corsa di
  `activity-walks.json` con la sua pausa della penna. Un'API precedente non
  le manda: l'app legge il dettaglio anche senza, e oggi non le mostra.
- **L'inclinazione del percorso** (TASK-232, parte C, ADR-0195, migrazione
  `0018`): il corpo del `PUT` può avere `rotation_deg`, quello del
  `RouteResult` del percorso seguito (gradi, antiorario, fra −180 e 180),
  facoltativo e solo con `points` (senza percorso: `422`); l'app lo manda
  solo quando la forma è girata. La corsa dell'elenco e quella intera hanno
  **sempre** `rotation_deg`: `null` senza percorso, per un percorso dritto
  e per le corse salvate prima; «My activities» e il post le disegnano
  girate dall'altra parte, così la forma si legge dritta. Esempi:
  `activity-request-turned.json`, `activity-turned.json`. Un'API precedente
  rifiuta il campo: se il `PUT` torna `422 invalid_request` l'app lo rimanda
  senza, prima di provare come un'app precedente a TASK-199.
- **Le pagine**: `GET /me/activities?limit=20&cursor=…`, `limit` da 1 a
  50. `next` è il `cursor` della pagina dopo, `null` all'ultima; `total` è
  il numero di tutte le corse dell'account, su ogni pagina. L'ordine è
  l'inizio della corsa, dalla più recente, non il momento in cui è stata
  mandata: una corsa rimasta sul telefono senza rete va al suo posto. Il
  cursore è un punto in quell'ordine, non una riga: due pagine di seguito
  non ripetono e non saltano corse nemmeno se nel frattempo una è stata
  cancellata o salvata. Un cursore o un `limit` che non lo sono: `422`.
- **Al massimo 2 000 per account**: oltre, `422 invalid_request` con un
  messaggio che dice di cancellarne una.
- Ognuno vede, apre e cancella solo le sue: la chiave di un altro dà `404`.
  `DELETE /me` cancella anche le corse. Una corsa è privata finché il suo
  iscritto non la pubblica come disegno («Drawings», sotto; TASK-117).
- **Una corsa su una parola con la penna alzata** (TASK-199, ADR-0158), o
  su una forma a pezzi (TASK-223):
  - il corpo del `PUT` può avere `walks`, quelli del percorso seguito
    (`RouteResult.walks`), facoltativo e solo con `points`: `walks` senza
    `points`, o che non stanno nei `points` (fuori, all'indietro,
    sovrapposti, controllati come in `POST /track-scores`), sono `422
    invalid_request`;
  - con i `walks` **il punteggio è delle sole lettere**: `score` e
    `fidelity` sono quelli di `POST /track-scores` con gli stessi `points`,
    `similarity`, `track` e `walks`, cioè quelli visti a fine corsa. Senza,
    come prima;
  - una pausa può avere **`pen`**, vero se l'app l'ha messa da sola fra due
    lettere, falso se manca. Per km e tempo conta come una pausa chiesta dal
    corridore (`auto` falso): il tratto a piedi non è corsa. Si tiene nella
    riga (`DATABASE.md`), e da TASK-200 torna nelle `pauses` del dettaglio;
  - la corsa intera ha **sempre** `walks`, vuoto per ogni altra corsa e per
    quelle salvate prima; l'elenco non cambia.

  Esempi: `activity-request-walks.json` (la corsa su «II», con la pausa
  della penna fra le due lettere) e `activity-walks.json`. Un'API
  precedente rifiuta `walks` e `pen`: l'app li manda solo per una parola
  con la penna alzata, e se il `PUT` torna `422 invalid_request` lo
  rimanda una volta senza, come prima di TASK-199 (la corsa si salva con
  il punteggio su tutto il percorso, invece di perdersi).
- **Una corsa da un file** (TASK-312, parte A, ADR-0272, migrazione
  `0034`; le regole in `IMPORTAZIONI.md`): il corpo del `PUT` può avere
  `source`, da dove viene la corsa: `muw`, registrata dall'app (per
  difetto: un'app di prima non lo manda), o `file`, un'attività di
  un'altra app che il telefono ha letto da un file GPX, TCX o FIT. Come il
  resto del corpo, conta solo al primo `PUT`. Una corsa `file` non ha un
  percorso di MuW: con `points` è `422 invalid_request`. I suoi orari sono
  quelli del file (`started_at` dal 2020, come per ogni corsa), e un buco
  del file arriva come pausa `auto`: il suo tempo non conta, i metri sì.
  `clean_track` la pulisce come ogni corsa. La corsa dell'elenco e quella
  intera hanno **sempre** `source`; gli esempi scritti prima non lo hanno
  (sono corse `muw`). Una corsa `file` **non conta per il gioco** né per le
  sfide delle squadre (`GIOCO.md`: `GET /game/runs/{key}` risponde `404`),
  **né per il concorso** (`CONCORSI.md`), e **non va su Strava** (`409
  imported_run`, «Send to Strava», sotto). Esempi:
  `activity-request-imported.json`, `activities-imported.json`,
  `activity-imported.json`. Un'API di prima rifiuta il campo: `422
  invalid_request`.

### Profile picture (TASK-178, ADR-0146)

La foto del profilo di un account. Tutti gli endpoint vogliono il token:
senza, `401 not_signed_in`; senza database, `503 accounts_unavailable`.
Esempio in `shared-types` (`fixtures/profile-photo.json`); il tipo dell'app
in `apps/mobile/src/api/profilePhoto.ts`; il codice in `profile_photos.py`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `GET /me/photo` | la foto | `200` `{ "image": "…", "updated_at": "…" }`, o `404 http_error` senza foto |
| `PUT /me/photo` | mettere la foto, al posto di quella di prima | `200`, la foto come l'API l'ha tenuta |
| `DELETE /me/photo` | toglierla | `204`, anche se non c'era |

- **Il corpo del `PUT`** è `{ "image": "…" }`: un file JPEG o PNG in
  base64, al più 10 MB prima della codifica, come per `POST
  /image-outlines`. Campi in più, base64 rotto, un file che non è
  un'immagine, un altro formato (GIF, HEIC…) o più di 50 megapixel:
  `422 invalid_request`, con il motivo nel messaggio; la foto di prima
  resta.
- **Cosa si tiene** (ADR-0115): l'API raddrizza la foto con il suo EXIF,
  ne prende il quadrato in mezzo, lo riduce a **256 × 256 px** e lo salva
  come JPEG nuovo (qualità 85, pochi KB). Il file del telefono non si
  tiene, quindi nemmeno il suo EXIF (dove e quando è stata scattata). Una
  foto trasparente ha il fondo bianco.
- **`image`** nelle risposte è quel JPEG in base64: l'app lo mostra così
  com'è (`data:image/jpeg;base64,…`), senza un'altra richiesta.
- Al più **10 `PUT` al minuto per account** (`429 too_many_requests` con
  `Retry-After`): ridurre una foto costa un momento di CPU. Il limite dei
  POST di `SHAPEROUTE_RATE_LIMIT` non conta i `PUT`. Leggere non ha limiti.
- Ognuno legge, cambia e toglie solo la sua; gli altri iscritti la vedono
  nel profilo (`GET /users/{public_id}`, «Profile», sotto; TASK-116).
  `DELETE /me` cancella anche la foto.

### Profile (TASK-116, ADR-0128)

Nome utente e bio di un account, e il suo profilo come lo vedono gli altri
iscritti. Tutti e due gli endpoint vogliono il token: senza, `401
not_signed_in`; senza database, `503 accounts_unavailable`. Tipi in
`shared-types` (`User`, `EditProfileRequest`, `PublicProfile`,
`BIO_MAX_LENGTH`), esempi in `fixtures/edit-profile-request.json` e
`fixtures/public-profile.json`; il codice in `profiles.py`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `PATCH /me` | cambiare nome utente e bio | `200` `User`, com'è adesso |
| `GET /users/{public_id}` | il profilo di un iscritto | `200` `PublicProfile`, o `404 http_error` |
| `GET /users/{public_id}/photos` | le foto dei suoi disegni (TASK-324) | `200` `UserPhotosPage`, o `404 http_error` |

- **`User`** (anche in `Session` e `GET /me`) ha in più `bio` (`""` senza)
  e `public_id`, un UUID casuale dato a ogni account dalla migrazione
  `0007`: è il `{public_id}` del profilo. L'`id` numerico resta dell'API:
  in sequenza, direbbe quanti account ci sono e farebbe aprire tutti i
  profili uno dopo l'altro. Un `public_id` non cambia con il nome.
- **Il corpo del `PATCH`** ha solo quello che cambia: `username`, `bio`, o
  tutti e due; un campo assente o `null` resta com'è, `{}` non cambia
  niente. Il nome segue la regola dell'iscrizione (da 3 a 20 fra lettere,
  cifre, `_` e `.`), unico senza badare alle maiuscole: il proprio con altre
  maiuscole si può. La bio perde gli spazi in testa e in coda, gli a capo
  diventano `\n`; `""` la toglie.
- **Errori del `PATCH`**, con un messaggio in parole che l'app mostra così
  com'è: nome fuori regola, `422 invalid_request` «A username is 3 to 20
  letters, digits, _ or . (no spaces).»; bio oltre 160 caratteri (contati
  come caratteri: un'emoji è uno), «A bio is at most 160 characters.»; bio
  con caratteri di controllo (tranne l'a capo), «A bio is words and new
  lines: it cannot hold control characters.»; nome di un altro account,
  `409 username_taken`. Campi in più (`email`, `role`, `public_id`…) o di
  un altro tipo: `422 invalid_request`. Con un errore non cambia niente.
- **`PublicProfile`** è `public_id`, `username`, `bio`, `photo` (il JPEG
  della foto in base64, come `GET /me/photo`, o `null`) e `drawings`, il
  numero dei disegni **pubblicati** (le corse private non contano,
  ADR-0114 punto 4; i disegni sono in «Drawings», sotto); da TASK-208
  quelli che chi guarda può vedere, così il numero è quello della griglia
  (un disegno «followers» conta per chi segue e per il proprietario). Da TASK-211
  anche `followers` e `following`, contate solo le richieste accettate, e
  `follow`, dove sta chi guarda verso quel profilo: `none`, `requested` o
  `following` (il proprio profilo: `none`; «Follow», sotto). **Mai
  l'email**, né `role`, `id` o la data d'iscrizione (un test lo prova).
- **I totali** (TASK-324, ADR-0284): `distance_m`, i metri di **tutte** le
  corse dell'account, private comprese (scelta dell'utente); `climb_m`, i
  metri saliti delle corse che lo sanno (salvate da un'app con le altezze,
  «My activities»); `reactions`, le reazioni lasciate dagli altri sui
  disegni che chi guarda vede: mai quelle del proprietario, mai di chi un
  blocco tiene lontano da chi guarda. Solo le somme, mai una corsa.
  `profile_totals.py`; un'API precedente non li ha.
- **I badge** (TASK-341, ADR-0294): `badges`, le chiavi dei badge presi
  in ordine fisso: `first_drawing` (almeno un disegno), `ten_drawings`
  (almeno dieci), `long_drawing` (un disegno di almeno 30 000 m). Contano
  i disegni che chi guarda vede (la regola di `drawings`), mai quelli
  nascosti dalla moderazione, solo di corse registrate dall'app
  (`source = 'muw'`). «Winner» resta `contest_wins`. `badges.py`; un'API
  precedente non li ha.
- **`GET /users/{public_id}/photos`** (TASK-324): le foto dei disegni che
  chi guarda vede sul profilo, dalla corsa più recente e nello stesso
  disegno per posto; `limit` da 1 a 60 (30), `cursor` dalla pagina prima
  (`next`, `null` sull'ultima). Ogni `UserPhoto` è una `DrawingPhoto`
  (`n`, `url`, `width`, `height`, letta da `url` con il token come le
  altre) con `drawing_id`, `title` e `started_at` del suo disegno, che
  l'app apre. Esempio `fixtures/user-photos.json`; `404` come i disegni
  del profilo (che non c'è, non un UUID, bloccato); `cursor` fuori forma
  `422`. `user_photos.py`.
- Un `public_id` che non c'è, di un account cancellato, o che non è un
  UUID (un `id` numerico, un nome): `404 http_error` «No profile with this
  id.». Il proprio profilo si legge come gli altri.
- **Un'API precedente** non ha `PATCH /me` (`405 http_error`) né `GET
  /users/…` (`404 http_error`), e il suo `User` non ha `bio` né
  `public_id`: l'app nuova lo legge lo stesso e dice «Editing the profile
  is not available on this API yet.». L'app pubblicata ignora i campi in
  più.

### Email and phone number (TASK-183, ADR-0150)

L'email e il numero di telefono di un account, cambiati dal proprietario.
Tutti e due vogliono il token: senza, `401 not_signed_in`; senza database,
`503 accounts_unavailable`. Tipi in `shared-types` (`ChangeEmailRequest`,
`ChangePhoneRequest`, `User.phone`), esempi in
`fixtures/change-email-request.json` e `fixtures/change-phone-request.json`;
il codice in `contact.py`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `PUT /me/email` | cambiare email: `email`, `password` | `200` `User`, com'è adesso |
| `PUT /me/phone` | tenere un numero di telefono, o toglierlo: `phone` | `200` `User`, com'è adesso |

- **`User`** (anche in `Session` e `GET /me`) ha in più `phone`: il numero
  in E.164 (`"+393331234567"`) o `null`. Solo il proprietario lo legge:
  non è in `PublicProfile`, nella ricerca né negli elenchi (un test lo
  prova).
- **`PUT /me/email`**: il nuovo indirizzo (stessa regola dell'iscrizione,
  salvato in minuscolo) e la **password dell'account**. Su un server che
  manda le email (TASK-300, sotto) **aspetta il suo link** in
  `pending_email`: `email` resta quello di adesso, con cui si entra, finché
  il link non è aperto; al vecchio indirizzo arriva un avviso. Senza email
  vale subito, come con ADR-0150, e il nuovo indirizzo non è confermato. Il
  telefono resta dentro, le altre sessioni anche. La propria email di
  adesso è accettata e non cambia niente (toglie quella in attesa).
- **Errori di `PUT /me/email`**: password sbagliata, `403
  wrong_credentials` «Wrong password.» (non `401`: la sessione vale
  ancora); le password sbagliate contano con quelle di `POST /session`
  per l'email di adesso, e dopo 5 in 15 minuti è `429 too_many_requests`
  con `Retry-After`, qui e all'accesso; l'email di un altro account, `409
  email_taken` «Another account has this email.»; con le email accese,
  dopo 3 email chieste in un'ora dall'account, `429 too_many_requests`
  «Too many emails asked: wait a few minutes and try again.» con
  `Retry-After`; un indirizzo fuori regola, un campo mancante o in più,
  `422 invalid_request`. Con un errore non cambia niente. La password non torna mai in una risposta né nei log.
- **`PUT /me/phone`**: `phone` è il numero **con il prefisso del paese**,
  comunque sia spaziato (`"+39 333 123 4567"`, `"0039 333-123-4567"`,
  `"+39 (333) 123.4567"`): spazi, trattini, punti, barre e parentesi si
  tolgono, «00» davanti vale «+», e resta «+» con 8–15 cifre, la prima non
  zero. `null`, o un testo vuoto, toglie il numero. `phone` è
  obbligatorio: `{}` è `422`.
- **Errori di `PUT /me/phone`**: un numero fuori regola (senza prefisso,
  con lettere, troppo corto o lungo), `422 invalid_request` «Write the
  number with its country code, like +39 333 123 4567.», che l'app mostra
  così com'è; un testo oltre 40 caratteri, un tipo diverso o campi in più,
  `422 invalid_request`.
- Il numero **non è provato** (nessun SMS) e quindi **non è unico**: due
  account possono avere lo stesso, e l'API non dice se un numero è già di
  qualcuno.
- **Un'API precedente** non ha i due `PUT` (`404 http_error`) e il suo
  `User` non ha `phone`: l'app nuova lo legge lo stesso e dice «Changing
  the email is not available on this API yet.» / «The phone number is not
  available on this API yet.». L'app pubblicata ignora il campo in più.

### Notifications (TASK-185, ADR-0206)

I due interruttori delle notifiche di un account, «Email notifications» e
«Push notifications», cambiati dal proprietario. Con «Push notifications»
acceso l'API manda le push ai telefoni dell'account (TASK-262, sotto,
«Push notifications»); con «Email notifications» acceso, **una email al
giorno al massimo** con le stesse notizie (TASK-262 parte B, sotto,
«Notice emails»), spenta finché il server non ha Resend.
Vuole il token: senza, `401 not_signed_in`; senza database, `503
accounts_unavailable`. Tipi in `shared-types` (`Notifications`,
`NotificationsRequest`, `User.notifications`), esempio in
`fixtures/notifications-request.json`; il codice in `notifications.py`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `PUT /me/notifications` | accendere o spegnere uno o più interruttori: `email`, `push`, `away` | `200` `User`, com'è adesso |

- **`User`** (anche in `Session` e `GET /me`) ha in più `notifications`:
  `{ "email": false, "push": false, "away": true }`. **`email` e `push`
  spenti** finché il proprietario non li accende, anche per gli account di
  prima (scelta dell'utente). **`away`**, «Email when I'm away» (TASK-284,
  sotto), è **acceso** finché il proprietario non lo spegne, anche per gli
  account di prima (scelta dell'utente del 2026-10-11); un'API più vecchia
  non lo manda, e l'app lo legge acceso. Solo il proprietario li legge: non sono in
  `PublicProfile`, nella ricerca né negli elenchi (un test lo prova).
  `DELETE /me` li cancella con l'account.
- **`PUT /me/notifications`** porta **solo quello che cambia**: `{ "push":
  true }` accende le push e lascia l'email com'è. Un campo non mandato, o
  mandato `null`, resta com'è; `{}` non cambia niente e risponde l'account
  com'è. Lo stesso valore di prima è accettato.
- **Errori**: un valore che non è `true` o `false` (`"true"`, `"yes"`,
  `1`, una lista) o un campo in più, `422 invalid_request`; non cambia
  niente.
- **Un'API precedente** non ha il `PUT` (`404 http_error`) e il suo `User`
  non ha `notifications`: l'app nuova lo legge come «tutti e due spenti» e
  al tocco dice «Notifications are not available on this API yet.». L'app
  pubblicata ignora il campo in più.

### Push notifications (TASK-262, ADR-0226)

I telefoni di un account e le notifiche push che ricevono, attraverso il
servizio push di Expo. Tutti e due gli endpoint vogliono il token: senza,
`401 not_signed_in`; senza database, `503 accounts_unavailable`. Tipi in
`shared-types` (`PushTokenRequest`, `PushData`, `PushKind`), esempi in
`fixtures/push-token-request.json` e `push-data.json`; il codice in
`push.py` (cosa e a chi) ed `expo_push.py` (il filo verso Expo).

| Endpoint | Cosa | Risposta |
|---|---|---|
| `PUT /me/push-token` | il token Expo di questo telefono: `token`, `platform` (`ios`, `android`), `language` (`en`, `de`, `it`, `es`, `fr`, facoltativa) | `204` |
| `DELETE /me/push-token/{token}` | questo telefono non riceve più | `204` |

- **Il token** è `ExponentPushToken[…]` (o `ExpoPushToken[…]`), al più 200
  caratteri; un altro testo, una piattaforma o una lingua fuori elenco o
  un campo in più: `422 invalid_request`. **Un token è di un account alla
  volta**: mandato da un altro account (il telefono ha cambiato mano)
  passa a lui. Rimandato, la riga resta una, con piattaforma, lingua e
  data di adesso. Il `DELETE` toglie solo un token dell'account che lo
  chiede, ed è `204` anche quando non c'era. `DELETE /me` cancella i
  token con l'account.
- **Cosa si notifica** (scelta dell'utente, la stessa lista per ogni
  canale), una notifica per ogni telefono del destinatario:

  | `kind` | Quando | A chi | Apre |
  |---|---|---|---|
  | `follow_request` | qualcuno chiede di seguire | chi è chiesto | il profilo di chi chiede |
  | `follow_accepted` | una richiesta è accettata | chi aveva chiesto | il profilo di chi accetta |
  | `reaction` | una reazione a un disegno (il super like con l'inizio del suo commento) | il proprietario | il disegno |
  | `comment` | un commento a un disegno, con il suo inizio | il proprietario | il disegno |
  | `tag` | un tag in un disegno | chi è taggato | il disegno |
  | `shape_unlocked` | una corsa salvata sblocca una forma del gioco (TASK-296) | chi ha corso | il proprio profilo; l'app di TASK-296 B apre «Play» |
  | `piece_done` | un compagno ha finito un pezzo della sfida (TASK-296 C) | gli altri iscritti | la sfida |
  | `challenge_done` | la squadra ha completato la forma (TASK-296 C) | tutti gli iscritti, anche chi ha corso | la sfida |
  | `challenge_ending` | manca un giorno alla scadenza e manca almeno un pezzo (TASK-296 C) | tutti gli iscritti | la sfida |
  | `contest_won` | il comando `close` ha proclamato il suo post vincitore del concorso (TASK-299) | chi ha vinto | il disegno |
  | `group_run_soon`, `group_run_changed`, `group_run_cancelled` | una corsa di gruppo comincia entro un'ora, cambia ora o luogo, è annullata (TASK-309, «Group runs») | chi va; il promemoria anche all'organizzatore | la corsa di gruppo |
  | `message` | un messaggio privato, fuori da una richiesta (TASK-319): «{name}: {text}», con l'inizio | chi lo riceve | la conversazione, dal profilo di chi scrive |
  | `message_request` | una richiesta di messaggio, al più una al giorno per chi scrive (TASK-319), senza il testo | chi la riceve | la conversazione, dal profilo di chi scrive |

  «Un nuovo follower» è `follow_accepted`: ogni follow passa da una
  richiesta (TASK-211), e chi accetta lo sa già.
- **Si manda solo se** il destinatario ha «Push notifications» acceso,
  non è chi ha agito (tranne `shape_unlocked`, che è per chi ha corso:
  `OWN_KINDS`), nessuno dei due ha bloccato l'altro (TASK-121) e,
  per un disegno, il destinatario lo vede (`drawing_seen_sql`). **Lo
  stesso evento** (stesso tipo, stesse due persone, stesso disegno; un
  commento è sempre nuovo) **al più una volta al giorno**: una richiesta
  rifatta o una reazione cambiata non notificano di nuovo. Tenuto in
  memoria: un riavvio lo dimentica.
- **I testi** sono nella lingua mandata con il token, in inglese senza:
  «ada asked to follow you.», «ada accepted your follow request.», «ada
  reacted 🔥 to your post.», «ada gave your post a MuW heart: …», «ada
  commented on your post: …», «ada tagged you in a post.», «You unlocked a
  new shape! Find it in your collection, in Play.», «You won the MuW
  contest! Your post got the most reactions.» (`contest_won`, TASK-299, in
  `OWN_KINDS`, mandata dal comando `close` di `contests.py`). Un commento
  entra su una riga, al più 100 caratteri. Nessun titolo (iOS mostra il
  nome dell'app), suono quello del telefono.
- **`data`** (`PushData`) dice all'app cosa aprire: `{ kind, drawing_id }`
  per un disegno, `{ kind, public_id, username }` per un profilo.
- **Fuori dalla richiesta**: la richiesta che scrive l'evento legge con
  una query a chi mandare cosa; la rete la fa un thread, e la risposta non
  aspetta Expo. Qualunque errore delle notifiche va nel log e non cambia
  la risposta. **I token morti** (`DeviceNotRegistered`, nel biglietto
  subito o nella ricevuta letta 15 minuti dopo) si cancellano. Un invio
  che Expo non prende (rete, `5xx`) non si ritenta.
- **Un'API precedente** non ha questi endpoint (`404 http_error`): l'app
  non manda il token e non dice niente.
- **I ganci** sono in fondo ai moduli che scrivono gli eventi e
  partono dopo la scrittura: `POST /users/{public_id}/follow` (solo quando
  la risposta è `requested`), `POST /me/follow-requests/{public_id}/accept`,
  `PUT /drawings/{id}/reaction`, `POST /drawings/{id}/comments`, `PUT
  /me/activities/{key}/drawing` (solo i taggati nuovi rispetto a prima del
  salvataggio), `PUT /me/activities/{key}` (`shape_unlocked`, una per forma,
  solo la prima volta che la corsa si salva: `game.notify_unlocked`). Un
  blocco (TASK-121, `follows.apart_sql`) in uno dei due versi ferma ogni
  notifica fra i due.
- **Le push delle sfide** (TASK-296 C) portano in `data` `{ kind,
  challenge_id }`; il testo comincia con il nome della forma nella lingua
  del telefono («Heart: ada finished piece 2.», «Heart: the shape is
  complete! Your team drew it together.», «Heart: 1 day left. Pieces
  missing: 3.»). `challenge_done` e `challenge_ending` sono in `OWN_KINDS`.
  `piece_done` e `challenge_done` partono dopo il salvataggio della corsa
  (`game_challenges.notify_pieces`); `challenge_ending` la trova
  `ChallengeClock` ogni 15 minuti, una volta per sfida, solo per le sfide
  più lunghe di un giorno.

### Email when I'm away (TASK-284, ADR-0244)

Una email a chi non apre l'app da 14 giorni, con quello che c'è di nuovo,
attraverso Resend. Scelte dell'utente del 2026-10-11: **a tutti gli
iscritti**, con un interruttore suo acceso di default (`notifications.away`,
sopra), una casella non spuntata all'iscrizione (`away_email` di `POST
/accounts`) e il link per disiscriversi in ogni email. Il codice in
`away_email.py` (chi, quando, la pagina), `away_texts.py` (le parole) e
`resend_email.py` (il filo verso Resend).

| Endpoint | Cosa | Risposta |
|---|---|---|
| `GET /away-email/stop?t=…` | la pagina del link «Don't send me these emails»: la domanda e il pulsante | `200` HTML; `404` HTML con un link che non è nostro |
| `POST /away-email/stop?t=…` | il pulsante della pagina, e il «disiscriviti» del programma di posta (RFC 8058): spegne `away` | `200` HTML; `404` HTML come sopra |

- **Chi la riceve**, in un giro al giorno alle `AWAY_EMAIL_AT` UTC (17:00
  di default): `away` acceso; l'ultimo uso dell'app (il `last_used_at`
  più recente delle sue sessioni) più vecchio di 14 giorni; nessuna email
  di ritorno dopo quell'ultimo uso. **Una email per assenza**: la
  seguente solo se torna e poi sta via altri 14 giorni. Uscito da ogni
  telefono (`DELETE /session` dappertutto), un account non ha un ultimo
  uso e non la riceve.
- **Solo se c'è qualcosa di nuovo**: i disegni pubblicati dopo l'ultimo
  uso che il Feed gli mostrerebbe (`shown_sql`: mai «only me», «followers»
  solo se segue, mai attraverso un blocco), i suoi esclusi. Senza niente
  di nuovo, niente email: il giro del giorno dopo richiede.
- **Cosa dice**: con disegni nuovi di chi segue, quanti e fino a tre nomi
  («ada, bea, cleo +2»): «2 new drawings from people you follow»; senza,
  quanti nel Feed: «3 new drawings on MuW». Il pulsante «Open MuW» porta
  alla pagina App Store dell'app (su un iPhone che l'ha, dice «Apri»). In
  fondo perché la riceve, il link e dove spegnerla in «Settings». Testo e
  HTML; nella lingua dell'iscrizione, poi in quella del telefono con le
  push, poi in inglese.
- **Il link** porta un token: l'HMAC del `public_id` con
  `SHAPEROUTE_EMAIL_SECRET`, niente nel database. Il `GET` non spegne
  niente (i filtri antispam aprono i link): solo il `POST`. La pagina non
  vuole `X-API-Key` (`access.py`), è `no-store` e senza referrer; il
  token non va nel log degli accessi. Le email portano anche
  `List-Unsubscribe` e `List-Unsubscribe-Post`.
- **L'invio**: ogni account è preso (`away_emailed_at`) prima di mandare,
  solo se niente è cambiato da quando è stato letto, e restituito se
  Resend rifiuta: due giri insieme non mandano mai due email, e una
  rifiutata si riprova il giorno dopo. Al più 500 per giro, mezzo secondo
  fra due; dopo 3 rifiuti di fila il giro si ferma. Resend riceve una
  `Idempotency-Key` per assenza. La chiave e l'indirizzo non vanno mai nel
  log.
- **Spenta** senza `RESEND_API_KEY`, `SHAPEROUTE_EMAIL_SECRET` (almeno 32
  caratteri) e `SHAPEROUTE_DOMAIN`: niente giro e niente pagina, e l'API
  lo dice all'avvio (`docs/DEPLOY.md`, «Email di ritorno»). A mano:
  `python -m shaperoute_api.away_email` conta chi la riceverebbe adesso,
  `--send` fa un giro.

### Notice emails (TASK-262 parte B, ADR-0226)

Con «Email notifications» acceso (`notifications.email`, sopra), **una
email al giorno al massimo**, solo nei giorni con qualcosa: le cinque
notizie delle push (una richiesta di follow, una richiesta accettata, una
reazione, un commento, un tag). Scelte dell'utente del 2026-10-25: un
riassunto al giorno, non un'email per evento (le push restano l'avviso
subito); la lingua come l'email di ritorno. Il codice in
`notice_email.py` (cosa si tiene, il giro, la pagina) e `notice_texts.py`
(le parole); invia con `resend_email.py`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `GET /notice-email/stop?t=…` | la pagina del link «Don't send me these emails»: la domanda e il pulsante | `200` HTML; `404` HTML con un link che non è nostro |
| `POST /notice-email/stop?t=…` | il pulsante, e il «disiscriviti» del programma di posta (RFC 8058): spegne `email` e toglie le notizie tenute | `200` HTML; `404` HTML come sopra |

- **Cosa si tiene**: ogni evento che `push.py` lascia passare (non il
  proprio, una volta al giorno) arriva a `notice_email.py` (i
  «listener» del `Pusher`), che lo scrive in `email_notices` solo se il
  destinatario ha `email` acceso. Per gli altri non si tiene niente.
- **Il giro**, ogni giorno alle `NOTICE_EMAIL_AT` UTC (18:00 di default,
  un'ora dopo quello dell'email di ritorno): a ogni account con notizie
  tenute e `email` acceso, una email con quelle **ancora vere** quando si
  scrive (la richiesta ancora in attesa, il follow ancora lì, la reazione,
  il commento o il tag ancora lì), mai attraverso un blocco, un disegno
  solo se lo vede ancora. Senza niente di vero, nessuna email.
- **Cosa dice**: le righe sono le push, nella lingua dell'iscrizione, poi
  del telefono, poi in inglese; le più recenti prima, al più 10, poi
  «…and 3 more in the app.». Oggetto: la riga, se è una; se no «5 new
  notifications on MuW». Poi «Open MuW» (la pagina App Store), perché la
  riceve, il link e dove spegnerla («Settings › Email notifications»).
- **Una al giorno**: l'account è preso (`notices_emailed_at`) prima di
  mandare, solo se niente è cambiato da quando è stato letto e non è già
  stato preso oggi (UTC): due giri insieme o un giro dopo un riavvio non
  mandano mai la seconda. Resend che rifiuta restituisce il giorno e le
  notizie: si riprova al giro dopo. Mandata, le sue notizie si cancellano;
  le altre dopo 7 giorni, o quando `email` si spegne. `Idempotency-Key`
  per account e giorno; al più 500 per giro, mezzo secondo fra due, il
  giro si ferma dopo 3 rifiuti di fila.
- **Il link** ha un token come quello dell'email di ritorno, con uno scopo
  suo nell'HMAC: il link di un'email non spegne l'altra. Stesse regole
  della pagina (`no-store`, senza `X-API-Key`).
- **Il thread** del giro parte con l'app e si ferma, anche a metà giro fra
  due email, prima che la fine dell'app chiuda il pool del database
  (TASK-288 B).
- **Spenta** quando è spenta l'email di ritorno (`RESEND_API_KEY`,
  `SHAPEROUTE_EMAIL_SECRET`, `SHAPEROUTE_DOMAIN`). A mano: `python -m
  shaperoute_api.notice_email` conta chi la riceverebbe adesso, `--send`
  fa un giro.

### Confirmed email and forgotten password (TASK-300, ADR-0261)

La email che conferma l'indirizzo, all'iscrizione e al cambio in
«Settings», l'avviso al vecchio indirizzo, e la email con il link per
scegliere una nuova password. Scelte dell'utente del 2026-10-25: un
indirizzo non confermato **non blocca niente**; gli account di prima
restano non confermati e non ricevono niente da soli. Il codice in
`account_email.py`, le parole in `account_email_texts.py`; Resend con
`resend_email.py`. Tipi in `shared-types` (`AccountEmailService`,
`PasswordResetRequest`, `User.email_confirmed`, `User.pending_email`),
esempio in `fixtures/password-reset-request.json`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `GET /account-email` | il server manda queste email? | `200` `{"on": true}`; `404` da un server senza email o di prima |
| `POST /password-reset` | una nuova password, senza account: `email`, facoltativo `language` | `202`, vuota, chiunque abbia l'indirizzo |
| `POST /me/email/confirmation` | il link di conferma, di nuovo | `202`; `204` con niente da confermare |
| `DELETE /me/email/pending` | annullare il cambio d'indirizzo in attesa | `200` `User` |
| `GET /email/confirm?t=…` | la pagina del link di conferma: la domanda e il pulsante | `200` HTML; `404` HTML con un link che non vale |
| `POST /email/confirm?t=…` | il pulsante: l'indirizzo è dell'account, confermato | `200` HTML; `409` HTML se un altro account l'ha preso nel frattempo; `404` |
| `GET /password/reset?t=…` | la pagina del link di reset: due campi per la password | `200` HTML; `404` |
| `POST /password/reset?t=…` | il modulo (`password`, `repeat`, form-urlencoded) | `200` HTML; `422` HTML con il problema; `404` |

- **`User`** ha in più `email_confirmed` (vero quando il proprietario ha
  aperto il link mandato a `email`) e `pending_email` (l'indirizzo chiesto
  in «Settings» che aspetta il suo link, o `null`). Solo al proprietario.
- **Iscriversi** (`POST /accounts`) manda il link a `email` nella lingua
  dell'app (`language`, se no inglese); l'account è subito usabile.
- **Il cambio** (`PUT /me/email`, sopra) mette il nuovo indirizzo in
  `pending_email`, manda il link al nuovo e al vecchio l'avviso con il
  nuovo coperto (`r•••@example.com`), senza link: «se non sei stato tu»
  rimanda a «Forgot password?». Aperto il link, `email` è il nuovo,
  confermato, e `pending_email` torna `null`; si entra con il nuovo. Un
  altro cambio sostituisce quello in attesa e spegne il suo link.
- **Il reset**: `POST /password-reset` risponde `202` vuoto sia che
  l'indirizzo sia di un account sia di no; l'account si cerca e l'email
  parte dopo la risposta, così neppure il tempo dice chi è iscritto. La
  email va solo a un account con quell'`email` (non a un indirizzo in
  attesa), nella lingua `language`, poi in quella dell'account. La pagina
  chiede la password due volte, con le regole dell'iscrizione (8–128
  caratteri; «A password is at least 8 characters.», «The two passwords
  are not the same.»; niente torna nei campi). Salvata: hash nuovo, **tutte
  le sessioni chiuse** (`401` su ogni telefono), il cambio in attesa
  annullato, il conto delle password sbagliate azzerato, l'indirizzo
  confermato.
- **Il token** dei link è `public_id.scadenza.tag`: il tag è un HMAC con
  `SHAPEROUTE_EMAIL_SECRET` dell'uso (conferma o reset), dell'account,
  della scadenza e dello stato che il link cambia: l'indirizzo per la
  conferma, indirizzo e hash della password per il reset. Così un link
  **vale una volta** (dopo l'indirizzo è confermato, o la password è
  un'altra) e muore se l'indirizzo cambia; niente nel database. Conferma:
  7 giorni; reset: 1 ora. Una conferma già usata mostra «Done» senza
  pulsante.
- **Le pagine** non vogliono `X-API-Key` (`access.py`), sono `no-store`,
  senza referrer, fuori dai frame (`X-Frame-Options: DENY`, CSP), nella
  lingua dell'account; un link che non è nostro, in inglese. Il `GET` non
  cambia niente (i filtri antispam aprono i link): solo il `POST`.
- **Limiti** (in memoria): 3 `POST /password-reset` all'ora per indirizzo,
  di un account o no, poi `429 too_many_requests` «Too many emails asked:
  wait a few minutes and try again.»; 3 email all'ora per account fra
  `POST /me/email/confirmation` e `PUT /me/email`, poi `429` con
  `Retry-After`; 300 email all'ora in tutto, oltre le quali non parte
  niente (nel log). Il limite dei `POST` di `SHAPEROUTE_RATE_LIMIT` vale
  in più.
- **Spente** senza le tre variabili dell'email di ritorno (sopra): nessuna
  di queste strade c'è (`404 http_error`), l'iscrizione non manda niente e
  il cambio vale subito. Indirizzi, token e chiave mai nei log.
- **L'app** mostra «Forgot password?» e «Email not confirmed» solo se
  `GET /account-email` risponde `200` (parte B). L'app di prima ignora i
  campi nuovi; a un cambio in attesa chiude il modulo e mostra ancora
  l'indirizzo di adesso.

### Drawings (TASK-117, ADR-0159; TASK-208, ADR-0170)

Una corsa salvata in «My activities» è privata. Chi l'ha corsa le può dare
un titolo, una descrizione, gli iscritti taggati, fino a tre foto e dire
chi la vede: allora diventa un **disegno**, nel suo profilo e dal suo id.
Tutti gli endpoint vogliono il token: senza, `401 not_signed_in`; senza
database, `503 accounts_unavailable` (il feed non si legge senza account,
ADR-0114). Tipi in `shared-types` (`DrawingRequest`, `DrawingPhotoRequest`,
`MyDrawing`, `MyDrawings`, `Drawing`, `DrawingsPage`, `DrawingDetail`,
`DrawingTag`, `DrawingPhoto`, `Visibility`/`VISIBILITIES`,
`DRAWING_TITLE_MAX_LENGTH`, `DRAWING_DESCRIPTION_MAX_LENGTH`,
`DRAWING_MAX_TAGS`, `DRAWING_MAX_PHOTOS`, `DRAWING_CUT_M`), esempi in
`fixtures/drawing-request-details.json`, `my-drawing-details.json`,
`drawings-details.json`, `drawing-details.json`, `drawing-photo-request.json`;
quelli di prima di TASK-208 (`drawing-request.json`, `my-drawing.json`,
`drawings.json`, `drawing.json`) sono ancora corpi buoni, senza i campi
nuovi. Il codice in `drawings.py` e `drawing_photos.py`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `GET /me/activities/{key}/drawing` | cosa ha scelto il proprietario per una sua corsa | `200` `MyDrawing`, o `404 http_error` |
| `PUT /me/activities/{key}/drawing` | titolo, chi lo vede, descrizione, attività, tag | `200` `MyDrawing`, o `404 http_error` |
| `PUT /me/activities/{key}/drawing/photos/{n}` | la foto nel posto `n` (1–3) | `200` `MyDrawing`, o `404 http_error` |
| `DELETE /me/activities/{key}/drawing/photos/{n}` | svuotare il posto `n` | `204`, anche se era vuoto; `404` senza la corsa |
| `GET /me/drawings` | le proprie corse con un disegno, dalla più recente | `200` `{ "drawings": [MyDrawing, …] }` |
| `GET /users/{public_id}/drawings` | una pagina dei disegni di un profilo che chi chiede può vedere | `200` `DrawingsPage`, o `404 http_error` |
| `GET /drawings/{id}` | un disegno intero | `200` `DrawingDetail`, o `404 http_error` |
| `GET /drawings/{id}/photos/{n}` | una foto del disegno | `200` `image/jpeg`, o `404 http_error` |

- **Chi lo vede** (`visibility`, ADR-0170, scelta dell'utente):
  - `everyone`: ogni iscritto;
  - `followers`: chi segue il proprietario **con la richiesta accettata**
    («Follow», sotto); una richiesta in attesa non basta;
  - `only_me`: nessun altro.

  Il proprietario lo vede sempre. A chi non lo può vedere, `404
  http_error` «No drawing with this id.», identico a un id che non c'è o
  che non è un UUID. Smettere di seguire, o essere tolti dai follower,
  toglie subito i disegni `followers`. Chi è taggato non ha diritti in
  più: vede il disegno se la visibilità glielo dà. Nel codice la domanda
  è una sola, `drawings.drawing_seen_sql(viewer)` (`DATABASE.md`,
  migrazione `0014`): foto e commenti (TASK-120) la seguono.
- **Il corpo del `PUT`** è `{ "title", "visibility", "description",
  "activity", "tags" }`:
  - `title` perde gli spazi in testa e in coda; `null`, `""` o assente lo
    tolgono; al più 60 caratteri, «A title is at most 60 characters.»;
    una riga sola, senza caratteri di controllo, «A title is one line of
    words: it cannot hold control characters.»;
  - `visibility` è obbligatoria, oppure **`public`** di un'app prima di
    TASK-208 (`true` è `everyone`, `false` `only_me`): mai tutti e due,
    «Say who can see it once: visibility, or public, not both.»; nessuno
    dei due, «Say who can see it: visibility.»;
  - `description` («How did it go?»): gli a capo restano (`\r\n` diventa
    `\n`), gli spazi in testa e in coda no; al più 500 caratteri, «A
    description is at most 500 characters.»; nessun altro carattere di
    controllo, «A description is lines of words: it cannot hold other
    control characters.»; `null` o `""` la tolgono. **Non passa dal filtro
    dei commenti negativi** (ADR-0176): è il racconto della propria corsa
    (scelta dell'utente, 2026-10-03);
  - `activity`: `running`, `cycling` o `paddling`, l'attività della corsa
    (`runs.activity`); cambia anche il tipo su Strava, non il punteggio;
  - `tags`: i `public_id` degli iscritti taggati, in ordine, al più 10
    (un undicesimo è `422`); `[]` li toglie. Un id che non è un iscritto,
    «Only Sgrava members can be tagged: one of these is not.»; sé stessi,
    «You cannot tag yourself.»; due volte lo stesso, «Each person is
    tagged once.».

  Tutti gli errori sono `422 invalid_request`, e non cambiano niente.
  Campi in più (`score`, `track`, `photos`…): `422 invalid_request`.
  **`description`, `activity` e `tags` assenti restano come sono**: un'app
  prima di TASK-208 manda solo `title` e `public`, e non cancella quello
  che un'app nuova ha scelto. L'app nuova manda tutto ogni volta, così il
  `PUT` rimandato dopo un telefono senza rete non cambia niente la seconda
  volta.
- **`MyDrawing`** è `key` (la chiave della corsa), `id` (con cui gli altri
  la aprono: un UUID casuale, come `public_id`; `null` per una corsa senza
  disegno: mai titolata, pubblicata o con una foto), `title`,
  `visibility`, `public` (`visibility` è `everyone`: per l'app di prima),
  `published_at` (da quando gli altri lo vedono, cioè dall'ultima volta
  che era `only_me`; `null` se lo è), `description`, `activity`, `tags` e
  `photos`. Passare da `everyone` a `followers` o indietro, o cambiare il
  titolo, non lo ripubblica; tornato `only_me` e riaperto, `published_at`
  è il momento nuovo. L'`id` non cambia mai. Una corsa senza disegno ha
  `visibility` `only_me`, `tags` e `photos` vuoti, e l'`activity` della
  corsa.
- **L'inclinazione** (TASK-232, parte C): il disegno dell'elenco e quello
  intero hanno **sempre** `rotation_deg`, quello della corsa in «My
  activities» (`runs.route_rotation_deg`): `null` senza percorso, per un
  percorso dritto e per le corse salvate prima. Chi lo vede lo disegna
  girato dall'altra parte. `MyDrawing` non ce l'ha: è della corsa, non del
  disegno.
- **Da dove viene la corsa** (TASK-312, parte A, ADR-0272): `MyDrawing`, il
  disegno dell'elenco, quello intero, il post del Feed e la griglia del
  profilo hanno **sempre** `source`, quello della corsa (`runs.source`):
  `muw`, o `file` per un'attività di un'altra app, che l'app mostra con
  «Imported». Nel Feed un post da file sta al posto della sua
  pubblicazione, come ogni post; nella griglia del profilo e in «My
  activities» al posto del suo inizio, anche un anno prima. Esempi:
  `my-drawing-imported.json`, `drawing-details-imported.json`,
  `feed-imported.json`; quelli scritti prima non hanno `source` (corse
  `muw`).
- **Le foto**, fino a tre oltre alla mappa, ognuna nel suo **posto** `n`
  (da 1 a 3; `0` o `4` sono `422`): il `PUT` mette la foto nel posto (`{
  "image": … }`, un JPEG o PNG in base64 fino a 10 MB, come la foto del
  profilo) e prende il posto di quella che c'era; il `DELETE` svuota il
  posto, e le altre restano dove sono. Così rifatti non cambiano niente.
  L'API **raddrizza** la foto con l'EXIF, la riduce a **1080 px sul lato
  lungo** (mai ingrandita) e la salva come JPEG nuovo: il file del
  telefono non si tiene, e con lui l'EXIF (dove è stata scattata). Un file
  che non è una foto, o un GIF: `422 invalid_request` con il motivo, e la
  foto di prima resta. Al più 20 `PUT` di foto al minuto per account
  (`429 too_many_requests` con `Retry-After`).
- **Le foto stanno sul server solo mentre altri vedono il disegno**
  (`everyone` o `followers`; scelta dell'utente, 2026-10-03): mentre lo
  vede solo il proprietario restano sul telefono. Su una corsa senza
  disegno, o `only_me`, il `PUT` di una foto è `409 http_error`, «Photos
  stay on the phone while only you see this run: choose Everyone or
  Followers first.»; il `PUT` del disegno con `only_me` cancella le sue
  foto dal server (`photos` vuoto nella risposta). L'app manda prima il
  disegno, poi le foto, e le rimanda quando lo riapre agli altri.
- **Ogni foto del disegno** è `{ "n", "url", "width", "height" }`, in
  ordine di posto; `url` è `/drawings/{id}/photos/{n}?v=…`, sull'API, da
  leggere con il token come ogni altra chiamata: risponde il JPEG
  (`image/jpeg`, `Cache-Control: private, max-age=86400`). Il `v` cambia
  con la foto, così un telefono non mostra quella di prima dalla sua
  cache. A chi non vede il disegno, `404` «No drawing with this id.»; a
  chi lo vede, un posto vuoto è `404` «This drawing has no photo here.».
- **Cosa vedono gli altri** (ADR-0114, punto 4): la traccia pulita della
  corsa **senza i primi e gli ultimi 200 m lungo la traccia**
  (`DRAWING_CUT_M`), tagliata dall'API e tenuta così nel database; senza
  orari, senza pause, senza `walks` e **senza il percorso pianificato**,
  che parte dalla porta di chi corre. Con meno di un metro rimasto la
  corsa non si mostra agli altri (`everyone` o `followers`): `422
  invalid_request`, «This run is too short to publish: its first and last
  200 m are never shown, and nothing would be left.»; `only_me` si tiene
  lo stesso.
- **Un disegno** ha `id`, `title`, `started_at`, `published_at`, `place`,
  `shape`, `word`, `style`, `route_title` (cosa disegna il percorso quando
  forma e parola non lo dicono: il `title` della corsa in «My
  activities»), `distance_m`, `duration_s`, `score`, `fidelity`: i numeri
  sono quelli della corsa, contati dall'API al salvataggio e mai presi
  dall'app. **Il punteggio lo vedono tutti** (scelta dell'utente); una
  corsa senza percorso si pubblica anche lei, con `score` e `fidelity`
  `null` (scelta dell'utente). Da TASK-208 anche `visibility`,
  `description`, `activity`, `tags` (`public_id` e `username` di ognuno,
  mai l'email; cancellato l'account taggato, il suo nome sparisce) e
  `photos` (gli indirizzi, mai i byte). Nell'elenco c'è `track_preview`,
  al più 64 punti della traccia tagliata; intero (`GET /drawings/{id}`) ha
  `track`, tutta la traccia tagliata, `author` (`public_id` e `username`,
  mai l'email) e `public`.
- **Le pagine di un profilo**: `GET /users/{public_id}/drawings?limit=20&cursor=…`,
  `limit` da 1 a 50, dalla corsa più recente (l'inizio della corsa, non
  la pubblicazione); `next`, `total` e il cursore come in «My activities»,
  ma il cursore porta l'id casuale del disegno, non quello della riga. Un
  profilo che non c'è: `404 http_error` «No profile with this id.». Solo
  quelli pubblicati che chi chiede può vedere: `everyone`, e `followers`
  per chi segue; il proprietario vede i suoi `everyone` e `followers`, mai
  gli `only_me` (ADR-0159, punto 8). `total` e `PublicProfile.drawings`
  contano gli stessi.
- **Cancellare** la corsa (`DELETE /me/activities/{key}`) o l'account
  (`DELETE /me`) cancella il disegno, le sue foto e i suoi tag: non
  compare più in nessun elenco né dal suo id. Per toglierlo agli altri
  tenendo la corsa basta `only_me`.
- **Un'API precedente** non ha questi endpoint (`404 http_error`) e il suo
  `PublicProfile.drawings` è sempre 0. Un'API prima di TASK-208 rifiuta
  `visibility`, `description`, `activity` e `tags` (`422`, campi in più)
  e non ha le foto (`404`): l'app di prima continua con `public`.

### Follow (TASK-211, ADR-0173)

Un iscritto ne cerca un altro per nome e gli chiede di seguirlo; l'altro
accetta o rifiuta. **Conta solo una richiesta accettata**: nei numeri del
profilo, negli elenchi e per chi vedrà i disegni «Followers» (TASK-208).
Tutti gli endpoint vogliono il token: senza, `401 not_signed_in`; senza
database, `503 accounts_unavailable`. Tipi in `shared-types` (`Person`,
`PeopleFound`, `PeoplePage`, `Follow`, `FollowState`,
`PEOPLE_QUERY_MIN_LENGTH`, `PEOPLE_FOUND_MAX`, `PERSON_PHOTO_SIDE`), esempi
in `fixtures/people.json`, `people-page.json`, `follow.json`; il codice in
`follows.py`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `GET /users?q=…` | gli iscritti con quel pezzo nel nome | `200` `{ "people": [Person, …] }` |
| `POST /users/{public_id}/follow` | chiedere di seguire | `200` `{ "follow": "requested" \| "following" }` |
| `DELETE /users/{public_id}/follow` | ritirare la richiesta, o smettere di seguire | `204` |
| `GET /me/follow-requests` | chi chiede di seguirmi | `200` `PeoplePage` |
| `POST /me/follow-requests/{public_id}/accept` | accettare | `204`, o `404 http_error` senza richiesta |
| `POST /me/follow-requests/{public_id}/decline` | rifiutare | `204` |
| `GET /me/followers` | chi mi segue | `200` `PeoplePage` |
| `DELETE /me/followers/{public_id}` | togliere qualcuno da chi mi segue | `204` |
| `GET /me/following` | chi seguo | `200` `PeoplePage` |

- **`Person`** è solo `public_id`, `username` e `photo`: la foto del
  profilo a **128 px** di lato (`PERSON_PHOTO_SIDE`, metà di quella di
  `PublicProfile`), JPEG in base64, rifatta dall'API, o `null`. **Mai
  l'email**, la bio o altro (un test lo prova). Il profilo intero si apre
  con `GET /users/{public_id}`.
- **La ricerca**: `q` senza gli spazi in testa e in coda, **almeno 2
  caratteri** (meno, o senza `q`: `422 invalid_request` «Type at least 2
  characters of a name.»), cercato **dentro** il nome senza badare alle
  maiuscole; `_` e `%` sono caratteri come gli altri. **Al più 20**
  risultati, **mai chi cerca**: prima i nomi che cominciano con `q`, poi i
  più corti, poi in ordine alfabetico, sempre uguale. Un `q` più lungo di
  un nome (20) non trova nessuno. Cerca solo il nome, mai l'email.
- **Ogni azione porta a uno stato, e rifatta non cambia niente**: chiedere
  di nuovo lascia una richiesta sola, con la sua data (la risposta dice
  `requested`, o `following` se è già accettata); ritirare, smettere,
  rifiutare e togliere rispondono `204` anche quando non c'era niente.
  Accettare di nuovo è `204`; accettare senza nessuna richiesta di
  quell'account è `404 http_error` «No follow request from this account.».
- **Rifiutare cancella la richiesta**: chi aveva chiesto vede il profilo
  come prima di chiedere (`follow` `none`), e può chiedere di nuovo.
  Nessuna risposta dice che è stata rifiutata. Rifiutare chi segue già non
  lo toglie: per quello c'è `DELETE /me/followers/{public_id}`, che toglie
  anche una richiesta in attesa.
- **Sé stessi** non si seguono: `422 invalid_request` «You cannot follow
  yourself.». Un `public_id` che non c'è, di un account cancellato o che
  non è un UUID: `404 http_error` «No profile with this id.», in tutti gli
  endpoint con `{public_id}`.
- **Gli elenchi sono solo propri** (degli altri si vedono i due numeri del
  profilo): `?limit=20&cursor=…`, `limit` da 1 a 50, dal più recente
  (l'accettazione per `followers` e `following`, la richiesta per
  `follow-requests`); `next` è il `cursor` della pagina dopo, `null`
  all'ultima; `total` quanti sono in tutto. Il cursore porta il momento e
  il `public_id` dell'ultimo della pagina.
- **Cancellare un account** (`DELETE /me`) lo toglie da ogni elenco e da
  ogni numero, nei due versi.
- **Un'API precedente** non ha questi endpoint (`404 http_error`; `GET
  /users` senza id è `404` anche lui) e il suo `PublicProfile` non ha
  `followers`, `following` né `follow`.

### People from the contacts (TASK-262 C, ADR-0226)

Gli iscritti il cui numero di telefono (`users.phone`, TASK-183, sempre in
E.164) è nella rubrica di chi chiede. Vuole il token: senza, `401
not_signed_in`. Tipi in `shared-types` (`ContactsPeopleRequest`,
`ContactsPeople`, `ContactPerson`, `CONTACT_HASHES_MAX`), esempi in
`fixtures/contacts-people-request.json` e `contacts-people.json`; il codice
in `contact_people.py`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `POST /people/from-contacts` | gli iscritti con uno di quei numeri | `200` `{ "people": [ContactPerson, …] }` |

- **La richiesta** è `{ "hashes": [...] }`: da 1 a **500** hash
  (`CONTACT_HASHES_MAX`), ognuno lo **SHA-256 del numero in E.164**
  (`+393331234567`) in UTF-8, in esadecimale minuscolo (64 cifre). Il
  numero lo normalizza **il telefono**, con il prefisso del paese della
  regione del telefono per chi è scritto senza; l'API non riceve mai un
  numero in chiaro, né un nome. Altro, di più, di meno o un hash scritto
  male: `422 invalid_request`, e il messaggio non ripete ciò che è
  arrivato.
- **Il confronto**: con `encode(sha256(convert_to(phone, 'UTF8')), 'hex')`
  di ogni account che ha salvato un numero, in una query sola. **Mai chi
  chiede**; **mai chi ha bloccato chi chiede né chi è bloccato da lui**
  (TASK-121, nei due versi); un account senza numero non si trova mai. Un
  numero non è unico (TASK-183): si trovano tutti gli account che l'hanno
  salvato. In ordine di nome, senza limite oltre a quello degli hash.
- **`ContactPerson`** è `Person` (`public_id`, `username`, `photo`) più
  `follow`, dove sta chi chiede verso di lui (`none`, `requested`,
  `following`): l'app ci mette il tasto «Follow». Mai il numero, mai
  l'email.
- **Niente di ciò che arriva si tiene**: gli hash sono solo un parametro
  della query, non si scrivono in nessuna tabella, in nessuna riga di log,
  nel registro delle richieste (che tiene solo le richieste di percorso) né
  in un messaggio di errore. Un test lo prova sul database vero e sui log.
  **L'hash non protegge da solo**: un numero ha al più 15 cifre, quindi lo
  SHA-256 di un numero si inverte provando tutti i numeri. La protezione
  vera è che il server non tiene nulla, e che gli hash viaggiano solo in
  HTTPS.
- **Limiti**: **30 richieste all'ora per account** (`429
  too_many_requests` «Too many looks in the contacts. Try again later.»,
  con `Retry-After`), contate solo in memoria, oltre al limite di tutti i
  `POST` (`SHAPEROUTE_RATE_LIMIT`). L'app ne fa al più 10 per volta
  (5000 numeri). Rallentano chi provasse i numeri uno a uno per sapere chi
  ha un account, non lo impediscono: la risposta è un nome, già visibile
  nella ricerca per nome.
- **Un'API precedente** non ha l'endpoint: `404 http_error`, e l'app dice
  «This server cannot look in your contacts yet.».

### Comments (TASK-120, ADR-0175)

Sotto un disegno gli iscritti scrivono commenti. Li legge e li scrive **chi
vede il disegno** («Drawings», sopra, «Chi lo vede»): il suo proprietario
sempre, gli altri come dice `visibility`, `everyone` o `followers` per chi
segue (TASK-208, `drawing_seen_sql`). Tutti gli endpoint vogliono il token:
senza, `401 not_signed_in`; senza database, `503 accounts_unavailable`.
Tipi in `shared-types` (`CommentRequest`, `Comment`, `CommentsPage`,
`COMMENT_MAX_LENGTH`), esempi in `fixtures/comment-request.json`,
`comment.json`, `comments.json`; il codice in `comments.py`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `GET /drawings/{id}/comments` | una pagina dei commenti, dal più vecchio | `200` `CommentsPage`, o `404 http_error` |
| `POST /drawings/{id}/comments` | un commento nuovo | `201` `Comment`, o `404 http_error` |
| `DELETE /comments/{id}` | cancella un commento | `204`, o `403` / `404 http_error` |

- **Il corpo del `POST`** è `{ "text": "…" }`: testo semplice, che perde
  gli spazi in testa e in coda; da 1 a 500 caratteri (`COMMENT_MAX_LENGTH`),
  a capo compresi. Vuoto o solo spazi, «A comment needs some words.»;
  oltre 500, «A comment is at most 500 characters.»; con caratteri di
  controllo diversi dall'a capo, «A comment is words and new lines: it
  cannot hold control characters.» (`422 invalid_request`, e non si tiene
  niente). Campi in più: `422 invalid_request`. L'API tiene il testo com'è
  scritto: niente HTML, niente link; l'app lo mostra come testo.
- **Al più 10 commenti al minuto per account**: oltre, `429
  too_many_requests` «Too many comments in a minute: wait a moment and try
  again.» con `Retry-After` in secondi. Il limite è dell'account, non
  dell'indirizzo, e vale per processo come quello delle foto.
- **Un commento** ha `id` (UUID casuale), `author` (`public_id` e
  `username`, come l'autore di un disegno: mai l'email; la foto si chiede
  a `GET /users/{public_id}`), `text`, `created_at` e `deletable`: vero
  quando chi chiede lo può cancellare.
- **Le pagine**: `GET /drawings/{id}/comments?limit=20&cursor=…`, `limit`
  da 1 a 50, **dal più vecchio**; `next` (il cursore della pagina dopo,
  `null` sull'ultima) e `total` (quanti ne ha il disegno) come nelle
  pagine di un profilo. Un commento scritto fra due pagine arriva in fondo,
  mai due volte.
- **Chi cancella**: chi l'ha scritto, o il proprietario del disegno, anche
  i commenti degli altri sotto il suo. Chi vede il commento ma non è né
  l'uno né l'altro: `403 http_error` «Only who wrote a comment, or the
  owner of the drawing, deletes it.». Un commento che non c'è, o sotto un
  disegno che chi chiede non vede: `404 http_error` «No comment with this
  id.». Chi l'ha scritto lo cancella anche sotto un disegno tornato privato.
- **Un disegno che non si vede** (non proprio e non per chi chiede, o un
  id che non c'è o che non è un UUID): `404 http_error` «No drawing with
  this id.», sia per leggere sia per scrivere. **Visto da meno persone**
  (`only_me`, o `followers` per chi non segue più), i commenti restano e
  li vede solo chi vede ancora il disegno; riaperto, tornano.
- **Cancellare** la corsa (e quindi il disegno) o l'account del
  proprietario cancella tutti i commenti del disegno; cancellare l'account
  di chi ha scritto cancella i suoi commenti, ovunque.
- **Un'API precedente** non ha questi endpoint: `404 http_error`, e l'app
  non mostra i commenti.

### Reactions (TASK-119, ADR-0193)

Sotto un disegno gli iscritti lasciano una reazione fra sei, **una a
testa**: il cuore di Sgrava, che è il **super like**, e 🔥 👏 💪 😂 😮.
Reagisce, e legge quante ce ne sono, **chi vede il disegno**, come per i
commenti («Comments», sopra; `drawing_seen_sql`): mai chi le ha lasciate.
Tutti gli endpoint vogliono il token: senza, `401 not_signed_in`; senza
database, `503 accounts_unavailable`. Tipi in `shared-types`
(`REACTION_KINDS`, `ReactionKind`, `SUPER_LIKE_MIN_COMMENT`,
`ReactionRequest`, `ReactionsSummary`, `ReactionResult`), esempi in
`fixtures/reaction-request.json`, `super-like-request.json`,
`reactions.json`, `reaction-result.json`; il codice in `reactions.py`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `GET /drawings/{id}/reactions` | quante di ogni tipo, e la propria | `200` `ReactionsSummary`, o `404 http_error` |
| `PUT /drawings/{id}/reaction` | lascia o cambia la propria | `200` `ReactionResult`, o `404 http_error` |
| `DELETE /drawings/{id}/reaction` | toglie la propria | `200` `ReactionsSummary`, o `404 http_error` |

- **I tipi** sono codici, nell'ordine in cui l'app li mostra:
  `super_like` (il cuore di Sgrava), `fire`, `clap`, `strong`, `laugh`,
  `wow`. Un altro valore: `422 invalid_request`.
- **`ReactionsSummary`**: `counts` con tutti e sei i tipi, anche a zero;
  `total`; `mine`, il tipo di chi chiede o `null`.
- **Il corpo del `PUT`** è `{ "kind": "fire" }`. Lo stesso tipo di nuovo
  non cambia niente (idempotente); un altro prende il posto del proprio.
  Campi in più: `422 invalid_request`.
- **Il super like** vuole anche il commento: `{ "kind": "super_like",
  "comment": "…" }`, da **2** (`SUPER_LIKE_MIN_COMMENT`) a 500 caratteri
  senza gli spazi in testa e in coda. Senza, o più corto: `422
  invalid_request` «A super like needs a comment of at least 2
  characters.»; il resto come un commento (troppo lungo, caratteri di
  controllo: gli stessi messaggi), e uno negativo `422 comment_rejected`
  con `reason`, l'avviso di ADR-0176. Un commento con un altro tipo: `422
  invalid_request` «Only a super like comes with a comment.». In ogni
  rifiuto non si tiene niente, e la reazione di prima resta.
- **Super like e commento si tengono insieme**, nella stessa transazione:
  la risposta porta in `comment` il `Comment` nuovo, che compare anche in
  `GET /drawings/{id}/comments`. Un super like chiesto quando c'è già (un
  nuovo tentativo dopo una risposta persa) non cambia niente: `comment`
  è `null`, e il commento resta uno. **Dopo sono separati**: cambiare o
  togliere il super like lascia il commento; cancellare il commento
  (`DELETE /comments/{id}`) lascia il super like.
- **Il `DELETE`** toglie la propria reazione; senza, non cambia niente.
- **Limiti per account**: al più 30 cambi al minuto (`PUT` e `DELETE`),
  oltre `429 too_many_requests` «Too many reactions in a minute: wait a
  moment and try again.»; un super like conta anche nei 10 commenti al
  minuto («Too many comments in a minute: …»). Con `Retry-After` in
  secondi, per processo come gli altri limiti.
- **Un disegno che non si vede** (non proprio e non per chi chiede, o un
  id che non c'è o che non è un UUID): `404 http_error` «No drawing with
  this id.», per leggere, lasciare e togliere. Visto da meno persone, le
  reazioni restano e le vede solo chi vede ancora il disegno.
- **Cancellare** la corsa (e quindi il disegno) cancella le sue reazioni;
  cancellare un account cancella quelle che ha lasciato, ovunque.
- **Un'API precedente** non ha questi endpoint: `404 http_error`, e l'app
  non mostra le reazioni.

### Feed (TASK-118, ADR-0227)

Il feed dei disegni pubblicati, letto da chi ha un account: una pagina
alla volta, dei disegni che chi chiede **può vedere** (la stessa domanda
del profilo, `drawings.shown_sql`). Vuole il token: senza, `401
not_signed_in`; senza database, `503 accounts_unavailable`. Tipi in
`shared-types` (`FeedPost`, `FeedPage`, `FEED_PAGE_SIZE`, `FEED_NEAR_M`),
esempio in `fixtures/feed.json`; il codice in `feed.py`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `GET /feed?limit=20&cursor=…&lat=…&lon=…` | una pagina dei disegni che chi chiede può vedere | `200` `FeedPage` |

- **L'ordine** (scelta dell'utente del 2026-10-07: «ok va bene questo
  semplice»): tre gruppi, uno dopo l'altro: **i propri**, poi quelli di
  **chi si segue** con la richiesta accettata («Follow», sopra), poi
  **gli altri**; dentro ogni gruppo dal più recente per `published_at`
  (l'ultima pubblicazione, non l'inizio della corsa), a parità l'id.
  Nessun filtro e nessun'altra classifica.
- **Chi vede cosa**: `everyone` lo vedono tutti; `followers` chi segue il
  proprietario con la richiesta accettata, e il proprietario; `only_me`
  **nessuno, nemmeno il proprietario**: il feed è ciò che è pubblicato.
  Una corsa senza disegno non c'è. Tornato `only_me`, o cancellata la
  corsa, il disegno sparisce subito; smettere di seguire toglie subito i
  `followers`.
- **Un post** è il `Drawing` dell'elenco del profilo («Drawings», sopra:
  `track_preview` di al più 64 punti della traccia tagliata, mai la
  traccia intera, mai il percorso pianificato) più **`author`**
  (`public_id` e `username`, mai l'email). Per aprirlo intero, con le sue
  reazioni e i suoi commenti, `GET /drawings/{id}`.
- **I vicini**: con `lat` e `lon`, dove sta il telefono, il terzo gruppo
  tiene solo i disegni la cui traccia tagliata passa entro **50 km**
  (`FEED_NEAR_M`; `ST_DWithin` in geografia) dal punto; i propri e quelli
  di chi si segue ci sono ovunque siano. **Senza il punto, niente è
  lontano**: il terzo gruppo è di tutti. Uno solo dei due: `422
  invalid_request` «Say where the phone is with both lat and lon, or
  with neither.»; fuori dalla terra, `422`.
- **Le pagine**: `limit` da 1 a 50, 20 se non detto; `next` è il
  `cursor` della pagina dopo, `null` all'ultima. Il cursore è
  `gruppo-microsecondi-id` (`^[0-2]-\d{1,17}-[0-9a-f]{32}$`; un altro,
  `422`): la pagina dopo riparte da lì, nel gruppo e sotto il momento. Un
  disegno pubblicato **fra due pagine** va in cima al suo gruppo, sopra il
  cursore: la pagina dopo **non ripete e non salta** nessuno; il nuovo si
  vede alla lettura dopo, dall'alto. L'app manda lo stesso punto a ogni
  pagina di una lettura. Chi comincia a seguire qualcuno fra due pagine
  sposta i suoi disegni di gruppo, e può rivederli o perderli fino alla
  lettura dopo: accettato, è il prezzo del cursore semplice.
- **Il peso**: una pagina di 20 disegni da 21 km, ognuno con una
  descrizione di 500 caratteri e due tag, sta sotto i 200 kB
  (`tests/test_feed.py`): nell'elenco viaggia l'anteprima, non la traccia.
- **Un'API precedente** non ha l'endpoint (`404 http_error`): l'app
  mostra i disegni d'esempio.

### Block and report (TASK-121, ADR-0228)

Bloccare tiene **due iscritti lontani, nei due sensi**; segnalare lascia
una riga per chi gestisce l'app. Tutti gli endpoint vogliono il token:
senza, `401 not_signed_in`; senza database, `503 accounts_unavailable`.
Tipi in `shared-types` (`ReportRequest`, `ReportKind`, `REPORT_KINDS`,
`ReportReason`, `REPORT_REASONS`; l'elenco dei bloccati è un
`PeoplePage`), esempio in `fixtures/report-request.json`; il codice in
`moderation.py`, la condizione SQL in `follows.apart_sql`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `PUT /users/{public_id}/block` | blocca l'iscritto, e chiude ogni follow fra i due | `204` |
| `DELETE /users/{public_id}/block` | lo sblocca | `204` |
| `GET /me/blocked?limit=20&cursor=…` | gli iscritti bloccati, l'ultimo per primo | `200` `PeoplePage` |
| `POST /reports` | segnala un disegno, un commento o un iscritto | `204` |

- **Cosa nasconde un blocco**, fatto da uno dei due, a tutti e due: il
  feed (`feed.py`), i commenti di uno sotto qualsiasi disegno (né letti,
  né contati in `total`), le reazioni (non contate), la ricerca per nome
  (`GET /users?q=`), il profilo e i suoi disegni (`GET /users/{id}` e
  `GET /users/{id}/drawings`: `404` come per nessuno). Il disegno
  dell'altro non si apre più in nessun modo: `GET /drawings/{id}`, le sue
  foto, `GET`/`POST /drawings/{id}/comments`, `GET`/`PUT`/`DELETE
  /drawings/{id}/reaction(s)` rispondono `404`, come per un id che non
  c'è (`drawings.drawing_seen_sql` e `shown_sql`). Nessuno dei due viene
  avvisato.
- **I follow**: bloccare cancella ogni riga di `follows` fra i due, nei
  due sensi, richieste in attesa comprese; chiedere di seguire attraverso
  un blocco è `404` «No profile with this id.». Sbloccare non rimette
  niente.
- **Fatto due volte non cambia niente**: un secondo blocco tiene la riga
  com'è; sbloccare chi non è bloccato è `204`. Sbloccare toglie solo il
  proprio blocco: se anche l'altro ha bloccato, restano lontani.
  Bloccare se stessi: `422 invalid_request`; un id che non c'è, o non è
  un id: `404 http_error`.
- **`GET /me/blocked`**: pagine come gli elenchi di «Follow» (`limit` da 1
  a 50, cursore `microsecondi-public_id`), con `total`; ogni iscritto con
  nome e foto piccola, mai l'email.
- **`POST /reports`**: `{"kind", "id", "reason"}`. `kind` è `drawing`
  (un post del feed), `comment`, `user`, `group_run` (TASK-309) o
  `message` (un messaggio privato, TASK-319, «Messages» sotto); `id` è
  l'id del disegno, del commento, il `public_id` dell'iscritto, l'id della
  corsa di gruppo o del messaggio; `reason` è uno di `spam`,
  `offensive`, `harassment`, `sexual`, `other`, in quest'ordine (l'app
  li mostra così). **Una riga per chi segnala e per cosa**: segnalato di
  nuovo, la riga prende il motivo e l'ora nuovi. Niente con quell'id:
  `404` «Nothing to report with this id.»; se stessi, il proprio disegno o
  il proprio commento: `422` «You cannot report yourself or what you
  wrote.»; un `kind` o un `reason` fuori elenco: `422`. Si può segnalare
  anche chi si è già bloccato.
- **Nessun endpoint legge le segnalazioni**: restano nella tabella
  `reports` per chi gestisce l'app (ADR-0228: niente pannello e niente
  endpoint `/admin` per ora). Una segnalazione **nuova** arriva anche per
  email a chi gestisce MuW, con un link che nasconde (TASK-291, sotto);
  la stessa persona che cambia il motivo non manda un'altra email.
- **`DELETE /me`** cancella i blocchi dell'account, fatti e ricevuti, e le
  sue segnalazioni (`ON DELETE CASCADE`); le segnalazioni degli altri su
  di lui restano.
- **Un'API precedente** non ha questi endpoint (`404 http_error`): l'app
  dice «This is not available any more.».

#### Report emails (TASK-291, ADR-0251)

A ogni segnalazione nuova l'API manda, fuori dalla richiesta e con
Resend, un'email in inglese a `SHAPEROUTE_REPORTS_TO`: cosa (disegno,
commento, profilo), il motivo, chi segnala, chi l'ha scritto, il testo
(titolo e descrizione, commento, nome e bio), quante segnalazioni ha
quella cosa, se è già nascosta, gli id, e il link «Hide it from everyone
else». Il codice in `report_email.py`, l'invio in `send_email.py`. Spenta
senza le quattro variabili di `DEPLOY.md`, «Email delle segnalazioni»:
allora la segnalazione si salva come prima e non parte niente. Un errore
di Resend non cambia mai la risposta di `POST /reports`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `GET /report-link?t=…` | cosa farà il link, con un pulsante; **non cambia niente** | `200` una pagina HTML |
| `POST /report-link?t=…` | il pulsante: nasconde o rimostra, una volta sola | `200` una pagina con «Undo» |

- **Senza chiave né token**: come `/strava/callback`, il link si apre da
  un browser (`access.OPEN_PATHS`). Lo protegge la firma.
- **Il link** è firmato con `SHAPEROUTE_EMAIL_SECRET` e dice un'azione
  (`hide` o `show`), una cosa (`drawing`, `comment`, `user`), il suo id,
  la scadenza (**7 giorni**) e un numero a caso. Fa solo quella cosa, e
  **una volta**: il numero va in `report_links_used`. Un link alterato o
  di un altro segreto: `404` «This link does nothing»; scaduto: `404`;
  già usato: `410`; la cosa non c'è più: `404`. Tutte le pagine hanno
  `Cache-Control: no-store` e `Referrer-Policy: no-referrer`; il token
  non va nei log (la query string non entra nel log, ADR-0096).
- **Dopo «Hide»** la pagina ha «Undo», un link nuovo dello stesso tipo
  (`show`, 7 giorni, una volta); dopo «Show again», «Hide again».
- **Nascosto agli altri, non all'autore**, e niente si cancella:
  - un **disegno** nascosto (`drawings.hidden_at`) non lo vede più
    nessuno tranne chi l'ha fatto: feed, profilo e il suo conteggio,
    `GET /drawings/{id}`, foto, commenti e reazioni rispondono come per
    un id che non c'è (`drawing_seen_sql`, `shown_sql`);
  - un **commento** nascosto (`comments.hidden_at`) lo legge solo chi
    l'ha scritto, e non entra in `total` per gli altri
    (`comments.NOT_APART`);
  - un **iscritto** nascosto (`users.hidden_at`) è lontano da tutti come
    dietro un blocco (`follows.apart_sql`): profilo, ricerca, disegni,
    commenti, reazioni, follow, e niente notifiche push agli altri per
    quello che fa. Lui vede tutto come prima.
  Nessuno viene avvisato.

### Messages (TASK-319, ADR-0279)

Due iscritti si scrivono **messaggi privati**, con le **richieste** come
su Instagram (scelte dell'utente del 2026-10-26). Si scrive a chiunque non
sia lontano per un blocco o nascosto (`follows.apart_sql`); una
conversazione per coppia, chiesta con il `public_id` dell'altro. Tutti gli
endpoint vogliono il token: senza, `401 not_signed_in`; senza database,
`503 accounts_unavailable`. Tipi in `shared-types` (`MessageRequest`,
`Message`, `MessagesPage`, `Conversation`, `ConversationsPage`,
`ConversationsUnread`, `ConversationState`, `MESSAGE_MAX_LENGTH`,
`MessagePushKind`), esempi in `fixtures/message-request.json`,
`message.json`, `messages.json`, `conversations.json`,
`conversations-unread.json`; il codice in `messages.py`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `GET /me/conversations?box=inbox\|requests` | le conversazioni di «Messages» o le richieste, l'ultimo messaggio per primo | `200` `ConversationsPage` |
| `GET /me/conversations/unread` | quante conversazioni hanno novità, quante richieste aspettano | `200` `ConversationsUnread` |
| `GET /conversations/{public_id}/messages` | una pagina dei messaggi, l'ultimo per primo, e `state` | `200` `MessagesPage`, o `404` / `422` |
| `POST /conversations/{public_id}/messages` | un messaggio nuovo | `201` `Message`, o `404` / `409` / `422` / `429` |
| `PUT /conversations/{public_id}/accept` | accetta la richiesta | `204`, o `404 http_error` |
| `PUT /conversations/{public_id}/read` | la conversazione letta fino ad ora | `204` |
| `DELETE /conversations/{public_id}` | toglie la conversazione (o la richiesta) dalla propria vista | `204` |
| `DELETE /messages/{id}` | cancella un proprio messaggio, per tutti e due | `204`, o `403` / `404 http_error` |

- **Dove arriva un messaggio**: dritto in «Messages» (`box=inbox`) se chi
  lo riceve **segue chi scrive**, o se ha già accettato, risposto o
  scritto per primo; altrimenti è una **richiesta** (`box=requests`). Per
  chi scrive la conversazione è sempre in «Messages».
- **`state`**, da chi chiede: `open` scrive liberamente; `first` scrive un
  messaggio, che all'altro arriva come richiesta; `waiting` ha scritto
  quello e aspetta (`POST` risponde `409 http_error` «Your message request
  is waiting: write again once it is accepted.»); `request` l'altro gli ha
  scritto una richiesta: «Accept», «Delete», «Block». **Rispondere accetta**,
  come «Accept». Seguire l'altro non basta per scrivergli liberamente:
  conta che sia l'altro a seguire chi scrive.
- **Il messaggio di una richiesta passa dal filtro dei commenti**
  (`comment_filter.py`, ADR-0176): negativo, `422 comment_rejected` con
  `reason` `negative` e «You can't send negative messages in this app.»;
  non si tiene niente, nemmeno la conversazione. Fra due che si scrivono
  liberamente il filtro non c'è.
- **Il corpo del `POST`** è `{ "text": "…" }`: testo semplice, che perde
  gli spazi in testa e in coda; da 1 a 1000 caratteri
  (`MESSAGE_MAX_LENGTH`), a capo compresi. Vuoto, troppo lungo o con
  caratteri di controllo: `422 invalid_request` con il motivo in parole,
  come per i commenti. **Al più 20 messaggi al minuto per account**: oltre,
  `429 too_many_requests` con `Retry-After`. Scrivere a se stessi: `422`
  «You cannot write to yourself.»; a nessuno, o attraverso un blocco:
  `404` «No profile with this id.», anche per leggere.
- **Un messaggio** ha `id`, `text`, `created_at` e `mine` (l'ha scritto
  chi chiede, che lo può cancellare). **Nessuna conferma di lettura**:
  `read_at` serve solo al pallino di chi riceve (`unread` nella lista,
  `GET /me/conversations/unread`); scrivere segna letto.
- **Le pagine**: i messaggi **dall'ultimo**, `limit` da 1 a 50, `next`
  porta ai più vecchi; le conversazioni dall'ultimo messaggio, con `next` e
  `total`. Cursore `microsecondi-uuid`, come gli elenchi di «Follow». Prima
  del primo messaggio la pagina ha `messages: []` e `state`, così l'app
  apre una conversazione vuota dal profilo.
- **«Delete»** (`DELETE /conversations/{public_id}`) toglie i messaggi
  fino ad ora dalla propria vista, e la conversazione dalla lista finché
  non ne arriva un altro; chi può scrivere liberamente non cambia. Per una
  richiesta: niente lo dice a chi ha scritto, che la vede ancora, e può
  scrivere **di nuovo un messaggio**, che è una richiesta nuova (come un
  follow rifiutato, ADR-0173). Un messaggio che nessuno dei due vede più si
  cancella. Fatto due volte, `204`.
- **Un blocco** cancella la conversazione dei due (`messages.on_block`,
  nella transazione del blocco), come chiude i follow; sbloccare non rimette
  niente, e il primo messaggio dopo è di nuovo una richiesta.
- **Segnalare un messaggio**: `POST /reports` con `kind` `message` e l'id
  del messaggio, **solo da chi l'ha ricevuto**: chi l'ha scritto `422`,
  chi non è nella conversazione `404` «Nothing to report with this id.».
  L'email della segnalazione porta **quel messaggio soltanto**, mai il
  resto della conversazione; «Hide» lo nasconde a chi l'ha ricevuto
  (`messages.hidden_at`), chi l'ha scritto lo vede ancora. Un iscritto
  nascosto scrive a tutti come prima, ma nessuno vede i suoi messaggi.
- **Le push**: `message` per ogni messaggio, con l'inizio del testo;
  `message_request` per una richiesta, senza il testo, al più una al
  giorno per chi scrive («Push notifications», sopra). Nessuna email.
- **`DELETE /me`** cancella ogni conversazione dell'account, con i
  messaggi di tutti e due (`ON DELETE CASCADE`).
- **Un'API precedente** non ha questi endpoint (`404 http_error`), e
  l'app non mostra «Messages».

#### Gli allegati: una foto, un video, un disegno (TASK-333, ADR-0289)

Un messaggio porta **un allegato**, con un testo facoltativo (vuoto
ammesso solo con l'allegato), **solo in una conversazione `open`** per chi
scrive: in una richiesta è `409 http_error` «Photos, videos and drawings
can be sent once they accept your message.» (scelta dell'utente del
2026-10-29). Foto e video si caricano prima, poi si mandano col loro id;
il disegno viaggia nel messaggio, copia del percorso. Codice in
`message_media.py` (i file) e `media_files.py` (comune con i video dei
post, ADR-0292); tipi `MessageAttachmentRequest`, `MessageDrawing`,
`MessageMedia`, `MessageAttachment`, `MessageDrawingCard`,
`AttachmentsAllowed`, `MESSAGE_VIDEO_MAX_S`, `MESSAGE_VIDEO_MAX_BYTES`,
`MESSAGE_VIDEO_DAYS`; esempi `message-media.json`,
`message-attachment-request.json`, `message-attachments.json`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `POST /me/message-media` | il file nudo come corpo, `Content-Type` `image/jpeg`, `image/png`, `video/mp4` o `video/quicktime` | `201` `MessageMedia`, o `422` / `429` / `507` |
| `PUT /me/message-media/{id}/poster` | il primo fotogramma di un proprio video, JPEG o PNG nudo | `204`, o `404` / `422` |
| `GET /message-media/{id}` | il file; risponde anche a `Range` | `200`/`206`, o `404` / `410` |
| `GET /message-media/{id}/poster` | il primo fotogramma | `200 image/jpeg`, o `404` / `410` |
| `GET /messages/{id}/drawing` | il disegno di un messaggio intero, come `PUT /me/favorites/{key}` lo prende | `200 MessageDrawing`, o `404` |

- **Mandare**: `POST /conversations/{public_id}/messages?with=attachments`
  con `{"text": "…", "attachment": {"media_id": "…"}}` o
  `{"attachment": {"drawing": {…}}}`, uno dei due (`422` per tutti e due
  o nessuno). Un `media_id` non caricato da chi scrive, o già mandato, o
  di più di un'ora fa, è `404` «No photo or video with this id to send:
  upload it again.».
- **Cosa resta di una foto**: rifatta come le foto dei disegni
  (`fitted_jpeg`: dritta, al più 1080 px, JPEG, **senza EXIF**), al più
  10 MB prima. **Di un video**: com'è, se le scatole MP4 dicono `ftyp`,
  `moov` con `mvhd` e `mdat`, al più **60 s** (letti da `mvhd`) e **40 MB**;
  le scatole `udta`, `meta` e `uuid` (il luogo `©xyz` e gli altri
  metadati) diventano `free` piene di zeri, della stessa lunghezza. Il
  video lo riduce il telefono (`videoExportPreset` 960 × 540
  sull'iPhone); il server non lo ricomprime. Le misure di un video sono
  quelle mostrate: la matrice della traccia che lo gira le scambia.
- **I limiti**: 10 video e 100 foto al giorno per account, poi `429
  too_many_requests` «Too many videos today: try again tomorrow.» con
  `Retry-After`; il server tiene al più `SHAPEROUTE_MESSAGE_MEDIA_MAX_GB`
  (10) di foto e video. **Pieno**, un caricamento nuovo fa posto togliendo
  i video dei messaggi più vecchi (`free_videos`, scelta dell'utente del
  2026-10-29, ADR-0289 aggiunta della parte D), che da lì sono `expired`
  (`410`); le foto vanno fino a un decimo in più. `507 http_error`
  «Videos can't be sent right now: try again later.» solo quando non resta
  un video di un messaggio da togliere. Mai una foto, un caricamento non
  mandato o un video di un post.
- **Chi legge un file**: chi l'ha caricato, e l'altro della conversazione
  del suo messaggio finché vede quel messaggio (non tolto dalla sua vista,
  non nascosto da una segnalazione) e nessun blocco li separa; per tutti
  gli altri `404`, come per un id che non c'è. Con la chiave e il token di
  sempre: nessun indirizzo firmato. Un video **30 giorni** dopo il suo
  messaggio è `410` «This video has expired.».
- **Nelle pagine** (`GET …/messages`, `GET /me/conversations`, la risposta
  del `POST`) ogni messaggio ha `attachment` (`null` se è solo testo): il
  tipo, il `media_id`, le misure, la durata, `poster`, `expired`, o la
  scheda del disegno (`drawing`: nomi, metri, sport, rotazione e al più 64
  punti). `MessagesPage.attachments` dice cosa si può allegare adesso:
  `null` fuori da `open`; i `kinds` (`video` sparisce col server pieno, e
  senza la cartella dei file resta solo `drawing`) e i limiti.
- **L'app di prima** non chiede `?with=attachments`: il testo di un
  messaggio con un allegato le arriva con davanti «[Photo]», «[Video]» o
  «[Drawing]», mai vuoto.
- **Cancellare**: il messaggio (chi l'ha scritto), la conversazione con un
  blocco, l'account con `DELETE /me` tolgono la riga del file subito; il
  giro di ogni ora (`MessageMedia.sweep`) toglie dal disco i file senza
  riga, i caricamenti mai mandati dopo un'ora e i video scaduti.
- **Segnalare** un messaggio con un allegato: l'email lo dice («With a
  photo…», «With a video of 24 s…», «With a drawing: star, 5.0 km…») e la
  pagina del link lo mostra (la foto, il video, la linea del disegno); il
  file viene dallo stesso indirizzo, `/report-link?t=…&part=media`, senza
  account. «Hide» nasconde messaggio e allegato a chi l'ha ricevuto.
- **Le push**: «{name}: 📷 Photo», «{name}: 🎬 Video», «{name}: 🗺️
  Drawing», nelle cinque lingue; con un testo, «{name}: 📷 {text}». Il file
  non va mai a Expo, Apple o Google.
- **Un'API senza gli allegati** non ha `attachments` né `attachment`:
  l'app non mostra il «+». Un server senza la cartella (`--media-dir`, di
  solito `data/media`) risponde `404` agli endpoint dei file e offre solo
  i disegni.

### Shape game (TASK-296, ADR-0255)

Il gioco delle forme, parte A: che cosa vale una corsa salvata e le forme
della collezione. Le regole sono in `GIOCO.md`; il codice in
`game_rules.py` (puro), `game_catalog.py`, `game.py` e `game_backfill.py`.

| Endpoint | Account | Cosa | Risposta |
|---|---|---|---|
| `GET /game/catalog` | no | le forme del gioco: `rules_version` e `shapes`, ognuna con `id`, `names` (`en`, `de`, `it`, `es`, `fr`), `goal` e `outline` | `200` |
| `GET /game/me` | sì | `counted_m`, `longest_m`, `best_s` (`{"1000": 287.4}`) e ogni forma del catalogo con `unlocked_at` e `progress` | `200` |
| `GET /game/runs/{key}` | sì | che cosa ha valso la corsa `key`: `counted`, `reason`, `counted_m`, `best_s`, `unlocked` (gli id sbloccati da lei) | `200`, `404` |

- **`goal`**: `{kind: "distance", total_m}` oppure `{kind: "pace",
  distance_m, pace_s}` (secondi al km); i campi dell'altro tipo sono
  `null`. **`outline`**: chiuso (l'ultimo punto è il primo), da 0 a 1, y
  verso il basso come sullo schermo.
- **`GET /game/catalog` accende «Play»** (ADR-0255): l'app mostra la
  pagina solo se risponde `200`; un'API precedente risponde `404`. Non
  vuole l'account ma, come ogni percorso, la chiave dell'app.
- **Il gioco si calcola al salvataggio**: `PUT /me/activities/{key}`,
  la prima volta, scrive la riga di `game_runs` nella stessa transazione
  della corsa e sblocca le forme raggiunte; la sua risposta non cambia.
  L'app chiede `GET /game/runs/{key}` dopo «Save»: risponde anche alle
  volte dopo, con le stesse `unlocked`.
- **`reason`**: `not_running` (bici, pagaia), `vehicle` (velocità da
  veicolo), `overlap` (un'altra corsa salvata prima copre lo stesso
  tempo), `daily_cap` (la corsa conta solo fino a 120 km nel giorno UTC;
  `counted` resta `true`). Le soglie sono in `GIOCO.md` §4.
- **`progress`**: `1` per una forma sbloccata, prima al più `0.99`.
  `unlocked_at` resta anche se la corsa che l'ha sbloccata si cancella.
- **`404`** su `GET /game/runs/{key}` per una corsa che l'account non ha,
  o non ancora calcolata (salvata prima del gioco, prima del backfill).
- Senza token, `401 not_signed_in`; senza database, `503
  accounts_unavailable` (il catalogo risponde lo stesso).
- **Le corse salvate prima**: `python -m shaperoute_api.game_backfill`,
  una volta dopo il deploy e a ogni `RULES_VERSION` nuova; non manda push.

**Parte C — squadre e sfide** (`game_teams.py`, `game_challenges.py`;
regole in `GIOCO.md` §6). Tutti con l'account; i compagni vedono di un
iscritto solo nome, foto, pezzi e metri: mai tracce, orari o luoghi.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `POST /game/teams` | una squadra: `{name}`, da 1 a 40 caratteri su una riga, dal filtro delle parole di TASK-213 | `201` `Team`; `422 invalid_request` (vuoto, lungo, caratteri di controllo, già in 10 squadre), `422 comment_rejected` (negativo) |
| `POST /game/teams/join` | entrare: `{code}`, 6 caratteri in qualunque maiuscola | `200` `Team` (anche se già dentro); `404` codice sconosciuto; `403 http_error` «You can't join this team.» con un blocco in mezzo, 20 iscritti o 10 squadre |
| `GET /game/teams` | le mie squadre, nell'ordine in cui sono entrato, ognuna con la sfida più recente | `200` `{teams: [Team]}` |
| `DELETE /game/teams/{id}/members/{public_id}` | esco (il mio `public_id`), o chi ha creato la squadra toglie un iscritto | `204`; `404` squadra o iscritto che non c'è; `422` se non sono il proprietario |
| `POST /game/teams/{id}/challenges` | una sfida: `{shape_id, pieces (2–12), piece, days (1–14, default 7)}`; `piece` è `{kind: "distance", total_m}` (1 000–50 000) o `{kind: "pace", distance_m (1000 o 5000), pace_s (150–900)}` | `201` `Challenge`; `409` se ce n'è una in corso; `422` fuori dai limiti o forma non in catalogo |
| `GET /game/challenges/{id}` | la sfida: pezzi, titolari, metri, contributi, tempo che resta | `200` `Challenge`; `404` se non sono della squadra |
| `POST /game/challenges/{id}/pieces/{idx}/hold` | prendo il pezzo `idx` | `200` `Challenge`; `409` pezzo preso, fatto, un altro già in mano, o sfida finita |
| `DELETE /game/challenges/{id}/pieces/{idx}/hold` | lascio il pezzo, che resta libero con i suoi metri | `200` `Challenge`; `409` se non è mio o è fatto |

- **`Team`**: `id`, `name`, `code` (lo vedono tutti gli iscritti, per
  condividerlo), `owner` (il `public_id` di chi toglie gli iscritti),
  `members` (`public_id`, `username`, `photo`, nell'ordine d'ingresso),
  `challenge` (la più recente, in qualunque stato, o `null`).
- **`Challenge`**: `id`, `team_id`, `shape_id`, `status` (`active`,
  `completed`, `expired`: finita quando sono passate 3 ore dalla
  scadenza), `starts_at`, `ends_at`, `completed_at`, `seconds_left` (alla
  scadenza; `0` dopo), `pieces` e `contributions`. Ogni pezzo ha `idx`,
  `goal` (con le parole dei requisiti del catalogo), `holder`
  (`public_id`, `username`, o `null`), `done_m`, `done` e `outline`, il
  suo tratto del contorno da 0 a 1 (`game_rules.pieces_of`: N tratti di
  lunghezza uguale, gli stessi che può calcolare il telefono). Le
  `contributions` sommano i metri di ogni persona su ogni pezzo:
  `public_id`, `username`, `idx`, `metres`.
- **Le corse riempiono i pezzi**: `PUT /me/activities/{key}`, nella stessa
  transazione del gioco, mette la corsa che conta nel pezzo che il
  corridore tiene in ogni sfida in corso, se è iniziata dopo la presa e
  prima della scadenza ed è salvata entro 3 ore dalla scadenza. I km in
  avanzo passano al prossimo pezzo libero di distanza, che diventa suo;
  senza, si perdono. Un pezzo veloce è fatto da una corsa con il miglior
  tempo richiesto. L'ultimo pezzo completa la sfida e dà la forma in
  **edizione squadra** a chi ha contribuito.
- **`GET /game/runs/{key}`** ha in più `pieces_done`: i pezzi che la corsa
  ha finito (`challenge_id`, `team_id`, `team_name`, `shape_id`, `idx`,
  `pieces`, `challenge_completed`). **`GET /game/me`** ha in più, per ogni
  forma, `team_unlocked_at` (`null` senza l'edizione squadra).
- **Chi esce o viene tolto** lascia liberi i pezzi che teneva, con i
  metri; la squadra passa all'iscritto più vecchio se se ne va il
  proprietario, e sparisce senza iscritti. Con `DELETE /me` succede lo
  stesso; sfide e pezzi restano alla squadra, i contributi dell'account
  spariscono.
- Chi ha bloccato un iscritto, o ne è bloccato, non entra. Un blocco nato
  fra due iscritti della stessa squadra ne fa uscire uno, nella
  transazione del blocco (`moderation.py`, `app.state.on_block`): la
  regola è nel task file, parte C.

### Contest (TASK-299, ADR-0260)

Il primo concorso: per un periodo i post pubblicati per tutti gareggiano,
e vince quello con più reazioni. Il premio non ha valore in denaro: il
badge «Winner» sul profilo, il post in cima al Feed per una settimana, una
push a chi ha vinto. Le regole sono in `CONCORSI.md`; il codice in
`contests.py`, con i comandi `open`, `standings` e `close` (`CONCORSI.md`
§11). Tipi in `shared-types` (`Contest`, `ContestEntry`, `ContestMine`,
`ContestWinner`), esempi in `fixtures/contest.json` e `contest-closed.json`.

| Endpoint | Account | Cosa | Risposta |
|---|---|---|---|
| `GET /contests/current` | no (il token aggiunge `mine`) | il concorso aperto, o chiuso da meno di 7 giorni | `200` `Contest`, o `404 no_contest` |

- **Senza token** risponde a chiunque abbia la chiave dell'API: `id`,
  `starts_at`, `ends_at`, `closed_at` (`null` finché aperto), `top` e
  `winner`; `mine` **non c'è**. Un token di una sessione che non esiste:
  `401 not_signed_in`, come ovunque. Senza database, `503
  accounts_unavailable`.
- **`top`**: al più **tre** post, ognuno con `rank`, `reactions` e
  `drawing` (un `FeedPost`: il disegno come lo elenca il Feed, con
  `author` e `track_preview`, mai la traccia intera). L'ordine è quello
  di `CONCORSI.md` §4: più reazioni, poi più cuori MuW, poi il post
  pubblicato prima. Con un token, un post attraverso un blocco con chi
  chiede **non c'è**, e gli altri tengono il loro `rank`: la lista può
  avere due voci.
- **`mine`**, solo con un token: `{ drawing_id, rank, reactions }` del
  miglior post di chi chiede fra quelli che partecipano, o `null` se non
  ne ha.
- **`winner`**: `null` finché aperto; dopo la chiusura `{ reactions,
  drawing }`, con `drawing` `null` se la corsa è stata cancellata o nessuno
  ha partecipato.
- **Che cosa partecipa e che cosa conta** (`CONCORSI.md` §3): un disegno
  `everyone` con `published_at` nel periodo, non nascosto e di un account
  non nascosto (TASK-291); una reazione per account, di qualunque tipo,
  mai la propria, non attraverso un blocco con l'autore (né di un account
  nascosto), lasciata entro `ends_at`. Il Feed, le reazioni e i profili
  non cambiano.
- **`404 no_contest`** «There is no contest right now.» senza un concorso
  aperto né uno chiuso da meno di 7 giorni (`SHOWN_AFTER_CLOSE`): l'app
  non mostra la scheda.
- **I profili**: `contest_wins` in `GET /users/{public_id}` e in `User`
  (`GET /me`, `Session`, ogni risposta che riporta l'account): quanti
  concorsi ha vinto; il badge «Winner» da 1 in su. Resta anche se la
  corsa vincitrice è cancellata; un account cancellato lascia il concorso
  senza vincitore.
- **La push** `contest_won` al solo vincitore, mandata dal comando `close`
  dopo il commit, con gli interruttori di «Push notifications»; `data` è
  `{ kind, drawing_id }`.
- **I comandi**, sul server (`python -m shaperoute_api.contests …`):
  `open --from … --to …` (momenti ISO 8601 con l'offset; rifiuta un
  secondo concorso aperto e `to ≤ from`), `standings` (i primi dieci con
  posto, autore, titolo, reazioni, di cui da account nati dopo l'inizio,
  cuori MuW, id del disegno), `close [--exclude <drawing_id> …]
  [--dry-run]` (proclama una volta sola; rifiuta prima di `ends_at`;
  `--dry-run` dice chi vincerebbe e non scrive). Escono con 0 (fatto), 1
  (niente da fare) o 2 (rifiuto).
- **Un'API precedente** non ha l'endpoint (`404 http_error`): l'app non
  mostra la scheda, come con `no_contest`.

### Group runs (TASK-309, ADR-0269)

Le corse di gruppo: un iscritto pubblica un percorso con giorno, ora e
«Where exactly» alla partenza; gli altri dicono «I'm going» e la corrono
insieme. Le regole sono in `EVENTI.md`; il codice in `group_runs.py`
(regole, endpoint, `GroupRunClock`, push). Tutti gli endpoint vogliono il
token: senza, `401 not_signed_in`; senza database, `503
accounts_unavailable`. Tipi in `shared-types` (`GroupRunRequest`,
`GroupRunChange`, `GroupRun`, `GroupRunDetail`, `GroupRunsPage`,
`ProfileGroupRuns`, `GroupRunPushKind`, `GroupRunPushData` e i limiti
`GROUP_RUN_*`), esempi in `fixtures/group-run-request.json`,
`group-run-change.json`, `group-run.json`, `group-runs.json`,
`group-runs-of-profile.json`, `group-run-push-data.json`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `POST /group-runs` | crea una corsa di gruppo da un percorso | `201` `GroupRunDetail` |
| `GET /group-runs?lat=…&lon=…` | la fila del Feed | `200` `GroupRunsPage` |
| `GET /group-runs/{id}` | la corsa di gruppo intera, anche annullata o finita | `200` `GroupRunDetail` |
| `PUT /group-runs/{id}` | l'organizzatore cambia titolo, ora, «Where exactly», note | `200` `GroupRunDetail` |
| `DELETE /group-runs/{id}` | l'organizzatore la annulla | `204` |
| `PUT /group-runs/{id}/going` | «I'm going» | `204` |
| `DELETE /group-runs/{id}/going` | «Not going» | `204` |
| `GET /group-runs/{id}/going?limit=20&cursor=…` | chi va, l'organizzatore per primo | `200` `PeoplePage` |
| `GET /users/{public_id}/group-runs` | quelle di un profilo: in arrivo e le ultime 20 finite | `200` `ProfileGroupRuns` |

- **Il corpo di `POST`** è quello di `PUT /me/favorites/{key}` (il
  percorso intero: `points`, `walks`, `on_foot`, `activity`,
  `rotation_deg`…, `FavoriteRequestBody`), con `title` obbligatorio e in
  più `starts_at` (ISO 8601 con l'offset), `meeting_note`, `description` e
  `visibility` (`everyone` o `followers`; non cambia più). Il ritrovo
  (`start`) è il primo punto. Il percorso non cambia dopo la creazione.
- **I limiti** (`EVENTI.md` §3), `422 invalid_request` con un messaggio da
  mostrare: titolo 1–60 caratteri su una riga («A title is 1 to 60
  characters, on one line.»), «Where exactly» una riga di al più 80
  (««Where exactly» is one line of 80 characters at most.»), note al più
  500 con gli a capo («The notes are 500 characters at most.»); spazi in
  testa e in coda tolti, un testo vuoto è `null`. `starts_at` da **30
  minuti** a **60 giorni** da adesso, sull'orologio del server («A group
  run starts from 30 minutes to 60 days from now.»): l'app ricontrolla
  prima di mandare. Un'ora senza offset o un `visibility` fuori elenco:
  `422` di Pydantic. **Al più 10 in arrivo** (non finite, non annullate)
  per account: «You can have 10 upcoming group runs at most.».
- **Il filtro dei commenti negativi** (TASK-213) su titolo, «Where
  exactly» e note: `422 comment_rejected` con `reason`, come un commento.
- **Chi la vede**: l'organizzatore sempre; gli altri se non è nascosta
  (TASK-291), se nessun blocco sta fra loro e l'organizzatore
  (`follows.apart_sql`, nei due sensi, un iscritto nascosto compreso) e
  se è `everyone` o seguono l'organizzatore con la richiesta accettata.
  **Chi non la vede** riceve `404` «No group run with this id.» su ogni
  endpoint con l'id, come per un id che non c'è.
- **`status`**: `upcoming` fino all'inizio, `started` per le 3 ore dopo,
  poi `over`; `cancelled` quando l'organizzatore l'ha annullata.
  L'organizzatore cambia e annulla solo da `upcoming` (dopo: `422` «The
  group run has started: it cannot change any more.»); «I'm going» e «Not
  going» valgono da `upcoming` e `started` (dopo: `422` «The group run is
  over.» o «The group run was cancelled.»). Un altro iscritto che prova a
  cambiare o annullare: `404`.
- **Chi va**: `going` è il numero (organizzatore compreso), `faces` i
  primi tre, `people` nella pagina i primi 20, `i_am_going` se chi chiede
  va. **L'ordine**: l'organizzatore, poi gli altri nell'ordine in cui
  hanno detto «I'm going»; il cursore è `rango-microsecondi-public_id`.
  Conta solo chi vede ancora la corsa di gruppo e non è lontano da chi
  chiede (blocco o nascosto, `counted_sql`): chi è bloccato
  dall'organizzatore, o lo blocca, non è contato per nessuno. Nome e foto
  piccola, mai l'email.
- **«I'm going»** due volte lascia una riga; «Not going» di chi non va è
  `204`. **L'organizzatore va sempre**: il suo `PUT` non cambia niente,
  il suo `DELETE` è `422` «The organiser always goes.». **Nessuna
  notifica** quando qualcuno si aggiunge (`EVENTI.md` §6.4).
- **`PUT /group-runs/{id}`** (`GroupRunChange`) manda i quattro campi; una
  nota o una descrizione lasciata fuori si toglie. Un `starts_at` nuovo
  ha i limiti della creazione; uno uguale, no. **Ora o «Where exactly»
  cambiati**: `reminded_at` torna vuoto e chi va (non l'organizzatore)
  riceve `group_run_changed`.
- **`DELETE /group-runs/{id}`** mette `cancelled_at`; chi va riceve
  `group_run_cancelled`. Già annullata: `204` e nessuna push. Annullata,
  esce dalla fila e dal profilo, e `GET /group-runs/{id}` la mostra con
  `cancelled`.
- **La fila del Feed** (`EVENTI.md` §5): al più 20, dalla più vicina nel
  tempo (a parità, l'id), non finite, non annullate, viste: le proprie e
  quelle di chi si segue ovunque, quelle a cui si va ovunque, le altre con
  il ritrovo entro 50 km dal telefono (`feed.NEAR_M`); senza `lat` e
  `lon`, tutte. Mezzo punto: `422` come il Feed.
- **Il profilo**: `upcoming` (non finite, la più vicina prima) e `past`
  (le ultime 20 finite, l'ultima prima), mai le annullate, solo quelle
  che chi chiede vede; un profilo lontano (blocco, nascosto) o che non
  c'è: `404` «No profile with this id.».
- **Le push** (`push.py`), con gli interruttori e i blocchi di sempre,
  `data` `{ kind, group_run_id }`, senza orari (il server non sa il fuso
  del telefono):

  | `kind` | Quando | A chi | Testo |
  |---|---|---|---|
  | `group_run_soon` | un'ora prima, una volta | chi va, organizzatore compreso (`OWN_KINDS`) | «{title} starts soon: see you at the start!» |
  | `group_run_changed` | ora o luogo cambiati | chi va | «{name} changed the time or place of {title}.» |
  | `group_run_cancelled` | annullata, o account dell'organizzatore cancellato prima dell'inizio | chi va | «{name} cancelled {title}.» |

  Non entrano nell'email del giorno (`notice_email.EMAIL_KINDS`).
- **`GroupRunClock`**, ogni 5 minuti mentre l'app gira, cerca le corse di
  gruppo che cominciano entro un'ora, non annullate e non avvisate, e le
  segna con `UPDATE … WHERE reminded_at IS NULL … RETURNING` prima di
  avvisare: due giri insieme, o due processi, la avvisano una volta. Una
  creata meno di un'ora prima avvisa al primo giro; una già cominciata,
  mai. Si ferma prima che si chiuda il database.
- **Segnalare**: `POST /reports` con `kind` `group_run` e l'id della corsa
  di gruppo («Block and report»). L'email lo chiama «group run», con
  titolo, «Where exactly», note e ora; il link nasconde
  (`group_runs.hidden_at`): la vede solo l'organizzatore, e chi andava non
  conta più né riceve il promemoria.
- **`DELETE /me`**: prima della cancellazione chi va alle sue corse di
  gruppo non ancora cominciate riceve `group_run_cancelled`
  (`app.state.before_account_delete`); poi le corse di gruppo e le
  risposte se ne vanno con l'account (`ON DELETE CASCADE`).
- **Un'API precedente** non ha questi endpoint (`404 http_error`): l'app
  non mostra la fila né il bottone.

### Feedback (TASK-308, ADR-0268)

«Send feedback» in «Settings»: un iscritto scrive a chi gestisce MuW
(idee, problemi, qualunque cosa). `POST` vuole il token: senza, `401
not_signed_in`; senza database, `503 accounts_unavailable` (anche `GET`). Tipi in
`shared-types` (`FeedbackRequest`, `MAX_FEEDBACK_LENGTH`), esempio in
`fixtures/feedback-request.json`; il codice in `feedback.py`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `GET /feedback` | la sonda dell'app: questo server prende il feedback | `204` |
| `POST /feedback` | tiene il messaggio e lo manda per email a chi gestisce MuW | `204` |

- **Il corpo**: `{"text", "app_version", "platform"}`. `text` da 1 a
  2000 caratteri tolti gli spazi ai due capi (gli a capo restano; niente
  caratteri di controllo): vuoto, troppo lungo o con un carattere di
  controllo è `422 invalid_request`. `app_version` (facoltativo, al più
  40 caratteri fra lettere, cifre, `.`, `(`, `)`, `+`, `-` e spazi) è
  come l'app scrive versione e build, «1.0.0 (7)»; `platform`
  (facoltativo) è `ios` o `android`. Un campo in più: `422`.
- **Al più 5 in 24 ore per account**, contati nel database: il sesto è
  `429 too_many_requests` con `Retry-After`, i secondi finché il più
  vecchio dei cinque compie un giorno. Gli altri account non contano.
  **E al più 20 in 24 ore da un indirizzo di rete** (un club sullo
  stesso Wi-Fi), contati in memoria: si azzerano a un riavvio.
- **`GET /feedback`**, senza token, risponde `204`: l'app mostra «Send
  feedback» solo dopo questa risposta, così un'app più nuova del suo
  server non fa mai scrivere un messaggio che nessuno prende (un'API
  precedente risponde `404`).
- **Nessun endpoint li legge**: restano nella tabella `feedback`, e ogni
  messaggio parte, fuori dalla richiesta e con Resend, per email in
  inglese a `SHAPEROUTE_FEEDBACK_TO`, o a `SHAPEROUTE_REPORTS_TO` senza
  quella (`DEPLOY.md`, «Email del feedback»). Oggetto «MuW feedback from
  {username}»; il testo, poi nome utente ed email, versione dell'app e
  sistema, l'ora (UTC), gli id. **Reply-To è l'email dell'iscritto**:
  rispondere all'email risponde a lui. Senza `RESEND_API_KEY` o senza
  indirizzo il messaggio si tiene e non parte niente; un errore di Resend
  non cambia mai la risposta. La chiave, l'indirizzo e il testo non sono
  mai nei log.
- **`DELETE /me`** cancella i messaggi dell'account (`ON DELETE CASCADE`).
- **Un'API precedente** non ha l'endpoint (`404 http_error`): l'app non
  mostra la sezione «FEEDBACK». Se il server torna indietro dopo che la
  sezione si è vista, «Send» dice «This is not available any more.».

### Send to Strava (TASK-187, ADR-0156)

Una corsa salvata va sul profilo Strava di chi ha collegato il suo atleta,
come attività, con la traccia e i tempi veri. Gli endpoint `/me/…` vogliono
il token dell'account: senza, `401 not_signed_in`; senza database, `503
accounts_unavailable`. Esempi in `shared-types` (`fixtures/strava-status.json`,
`strava-connect.json`, `strava-activity.json`); il codice in `strava.py`
(gli atleti e le corse) e `strava_client.py` (le chiamate a Strava, l'unico
posto con i suoi indirizzi).

| Endpoint | Cosa | Risposta |
|---|---|---|
| `GET /me/strava` | Strava c'è su questo server? L'account è collegato? | `200` `{ "available", "connected", "athlete" }` |
| `POST /me/strava/connect` | cominciare il collegamento | `200` `{ "url": … }`: la pagina di Strava da aprire nel browser |
| `GET /strava/callback` | dove Strava rimanda il browser; senza chiave e senza token | una pagina HTML |
| `DELETE /me/strava` | scollegare | `204`, anche se non era collegato |
| `GET /me/activities/{key}/strava` | cosa ha Strava di una corsa | `200` `{ "status", "url" }`, o `404 http_error` |
| `POST /me/activities/{key}/strava` | mandare la corsa; corpo facoltativo `{ "name": …, "description": …, "post": … }`; con `post`, su una corsa già mandata, cambiare il testo su Strava | `200` è un'attività; `202` Strava la sta ancora leggendo |

- **Spento o acceso**: senza `STRAVA_CLIENT_ID` e `STRAVA_CLIENT_SECRET`
  nell'ambiente dell'API, `GET /me/strava` risponde `available: false`
  (l'app non mostra niente di Strava) e gli altri `503 http_error`;
  `DELETE /me/strava` funziona lo stesso. `athlete` è il nome dell'atleta
  su Strava («Ada Lovelace»), per «Connected as …», o `null`.
- **Il collegamento** passa dal browser e dal server: l'app non vede mai
  il secret né un token di Strava. `POST /me/strava/connect` crea uno
  `state` casuale e risponde con l'indirizzo di Strava
  (`/oauth/mobile/authorize`: sul telefono apre l'app Strava, se c'è) con
  `scope=activity:write`, il solo permesso chiesto: aggiungere attività,
  niente in lettura. Strava rimanda il browser a
  `https://<dominio dell'API>/strava/callback` (`SHAPEROUTE_DOMAIN`; se è
  vuota, l'indirizzo a cui è arrivata la richiesta dell'app).
- **Lo `state`** dice alla callback di quale account è il collegamento:
  vale una volta, per 10 minuti, e un account ne ha uno solo (chiedere di
  nuovo il collegamento spegne quello di prima). Il database ne tiene solo
  lo SHA-256. Uno `state` sconosciuto, usato o scaduto non collega niente:
  pagina «This link has expired.», `400`.
- **La callback risponde sempre una pagina**, perché la legge una persona:
  «Strava is connected. Go back to Sgrava.» (`200`); «Strava is not
  connected.» (`200`) se l'atleta ha detto di no o ha tolto la spunta al
  permesso di caricare (allora non si chiede nemmeno il token); «Strava
  did not answer.» (`502`); «Strava is not set up here.» (`503`); «Sgrava's
  Strava app takes only its owner for now.» (`403`) quando un atleta
  diverso da chi ha creato l'app Strava prova a collegarsi prima che
  Strava l'abbia rivista. La pagina
  non si tiene in cache e non passa il suo indirizzo ad altri.
- **Un atleta è di un account solo**, l'ultimo che l'ha collegato: Strava
  ha un'autorizzazione sola per atleta, quindi una sola serie di token.
  Collegare un altro atleta allo stesso account revoca quello di prima.
- **I token** stanno nel database, mai in una risposta né nei log. Quello
  d'accesso dura sei ore: l'API lo rinnova da sola quando mancano meno di
  cinque minuti alla scadenza, e tiene il refresh token nuovo che Strava
  può dare a ogni rinnovo. Se Strava rifiuta il refresh token (l'atleta ha
  tolto Sgrava dalle impostazioni di Strava) l'atleta si dimentica e
  l'invio risponde `409 http_error`, «Strava is not connected: connect it
  first.»: l'app torna a «Connect with Strava».
- **L'invio** (`POST /me/activities/{key}/strava`): l'API scrive il GPX
  della corsa salvata, con l'orario di ogni punto (`GPX.md`, «La corsa
  fatta»), e lo dà a `POST /uploads` di Strava con `sport_type` dalla sua
  attività (TASK-208: `Run` a piedi, `Ride` in bici, `StandUpPaddling`
  in canoa, scelta dell'utente),
  `external_id` = la chiave della corsa, il nome e la descrizione. Poi
  guarda l'upload ogni secondo, al più 5 volte: `200` con `status: "sent"`
  e `url` (la pagina dell'attività) appena Strava l'ha letto; se ci mette
  di più, `202` con `status: "processing"`, e la stessa chiamata rifatta
  riprende a guardare senza caricare un'altra volta.
- **Il nome** dell'attività è quello scritto nell'app prima di «Save»
  (scelta dell'utente, 2026-10-02): il corpo facoltativo `{ "name": "Sunday
  heart" }` (`fixtures/strava-send.json`), messo su una riga e tagliato a
  100 caratteri, non rifiutato. Vuoto, `null` o senza corpo (come prima
  della parte app), il nome di Sgrava: cosa è stato disegnato e dove,
  «Heart in Trento», «CIAO in Trento», il tema di un percorso a tema; senza
  il luogo solo cosa. Una corsa senza percorso e senza nome scritto non
  manda un nome e Strava le dà il suo («Morning Run»). Il nome conta solo
  per il primo invio: una corsa già mandata, o che Strava sta leggendo,
  resta com'è. Lo stesso nome va nel `<name>` del GPX.
- **La descrizione** è «Drawn with Sgrava» per una corsa che ha seguito un
  percorso, «Recorded with Sgrava» per una corsa libera (scelta
  dell'utente: su ogni corsa). Da TASK-208 sopra quella riga, dopo una riga
  vuota, va «How did it go?»: il `description` del corpo, scritto prima di
  «Save» (`fixtures/strava-send-description.json`), con gli a capo,
  tagliato a 500 caratteri e non rifiutato; vuoto o assente, la
  descrizione del disegno, se la corsa ne ha uno. Come il nome, conta solo
  per il primo invio. Le foto non vanno a Strava.
- **Il testo del post** (TASK-231, ADR-0194): `post` nel corpo
  (`fixtures/strava-send-post.json`), le emoji e i risultati scelti sul
  post, tagliato a 500 caratteri come la descrizione. Va **in cima**,
  sopra le parole di chi corre e la riga di Sgrava, separato da una riga
  vuota: «🔥❤️ 5.20 km · Score 87», «Legs heavy.», «Drawn with Sgrava».
  Su una corsa **già mandata** l'API rifà quel testo e lo mette
  sull'attività con `PUT /api/v3/activities/{id}` di Strava (il permesso
  `activity:write` basta); il nome non cambia, e risponde `200` com'era.
  Se Strava non lo lascia fare (l'attività è stata cancellata là, o la
  vede solo l'atleta, che vorrebbe anche `activity:read_all`): `422
  invalid_request`, «Strava did not let Sgrava change this activity:
  change its text on Strava.», e la corsa resta mandata. Senza `post`,
  una corsa già mandata risponde com'era, senza chiedere a Strava.
- **Una corsa mandata due volte è un'attività sola**: la corsa tiene cosa
  ne è stato (`status`: `not_sent`, `processing`, `sent`), e una già
  mandata risponde `200` com'era, senza chiedere a Strava. Due invii
  insieme aspettano uno l'altro. Se il server l'ha dimenticato e Strava
  no, Strava rifiuta il doppione dicendo quale attività è: l'API risponde
  `sent` con quella. `url` è `null` solo se Strava ha la corsa e non dice
  dove.
- **Gli errori di Strava**: non risponde, `502 http_error` (riprovare); ha
  raggiunto il suo limite di richieste, `429 too_many_requests` con
  `Retry-After` (i secondi al prossimo quarto d'ora, o a mezzanotte UTC
  se è finito il limite del giorno); non riesce a leggere la corsa, `422
  invalid_request`, «Strava could not read this run.», e la corsa torna
  `not_sent`. Se Strava rifiuta il Client Secret del server, `502`, e
  nessuno viene scollegato.
- **Una corsa da un file non si manda** (TASK-312, parte A, ADR-0272):
  viene da un'altra app, spesso da Strava stessa. `POST
  /me/activities/{key}/strava` di una corsa con `source` `file` risponde
  `409 imported_run`, «This activity was added from another app: it is
  not sent to Strava.», prima di guardare il collegamento: anche senza
  atleta collegato. Strava non riceve niente, e `GET` dice `not_sent`.
- **Scollegare** (`DELETE /me/strava`) cancella i token dal database
  comunque, poi revoca l'accesso su Strava (`POST /oauth/revoke`). Se
  Strava non risponde i token sono già cancellati, e Sgrava resta
  nell'elenco delle app dell'atleta su Strava finché non la toglie lui.
  `DELETE /me` fa lo stesso prima di cancellare l'account. Le corse già
  mandate restano su Strava.
- Ognuno manda solo le sue corse: la chiave di un altro dà `404`.

### Zone per il telefono (TASK-214, ADR-0177)

La zona in cache intorno a un punto, perché il telefono disegni da sé. Il
codice è in `phone_zone_api.py` e `phone_zones.py`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `GET /phone-zones/{network}?lat=&lon=` | la zona della rete `foot` o `bike` che contiene 3 km intorno al punto; con `&margin_m=` (3000–10 000) la più piccola che ne contiene tanti, se il suo file pesa al massimo 12 MB, se no quella di 3 km (parte E); con `&prefetch=1` è una zona scaricata in anticipo, contata nel tetto del giorno | `200` `application/gzip`, il file della zona; `304` quando l'`ETag` della zona scelta è in `If-None-Match` (anche fra altri, separati da virgole) o in `X-Zone-ETags`; `404 http_error` senza zona o con un'altra rete; `422 invalid_request` con `lat`, `lon` o `margin_m` fuori dai limiti; `429 too_many_requests` con `Retry-After`, solo con `prefetch=1`, oltre il tetto |

- **Il file** si chiama come la zona, `foot_<s>_<w>_<n>_<e>.zone.json.gz`
  (`Content-Disposition`). È JSON con gzip: `format` `"sgrava-zone"`,
  `version` `1`, `network`, `bbox`, gli attributi del grafo, i nodi, gli
  archi e i nomi delle strade (`names`). Il telefono lo tiene così com'è
  arriva.
- **L'`ETag`** cambia quando la zona sul server cambia; il telefono lo
  rimanda in `If-None-Match` e, se ce l'ha già, riceve `304` senza corpo.
  L'app della parte E chiede `margin_m=6000` per la zona intorno a sé e
  manda l'`ETag` della sua zona più piccola lì in `If-None-Match`, come
  prima, e quelli delle altre in `X-Zone-ETags`: il `304` porta l'`ETag`
  della zona che il server ha scelto. Un server di prima ignora i due
  campi nuovi e risponde come prima.
- **Nessun download**: senza una zona in cache intorno al punto la
  risposta è `404`, e il percorso lo disegna il server, che scarica la
  zona alla prima richiesta lì.
- Come per gli altri endpoint vale la chiave `X-API-Key`, se il server ne
  ha una (ADR-0076).
- **Il tetto del traffico** (parte A2, `phone_zone_cap.py`): la zona
  intorno al telefono si dà sempre. Le zone in più, cioè città vicine e
  più cercate, arrivano con `prefetch=1` e con l'id anonimo del telefono
  in `X-Phone-Id` (32 cifre esadecimali; senza un id valido conta
  l'indirizzo). Ne vanno al massimo 300 MB al giorno per telefono e 300
  GB al giorno in tutto il server (scelta dell'utente). Una zona che
  passerebbe uno dei due tetti dà `429 too_many_requests`, «Enough maps
  downloaded ahead today: try again tomorrow.», con `Retry-After` in
  secondi fino alla mezzanotte UTC. Un `304` non si conta. Il conteggio
  sta in memoria: un riavvio dell'API lo rimette a zero.
- **Prima dei telefoni**: `python -m shaperoute_api.phone_zone_api` scrive
  il file di ogni zona in cache, così nessun telefono aspetta che si scriva
  (stime di spazio e tempo in `tasks/TASK-214.md`).

#### I posti tenuti sul telefono (TASK-334, ADR-0290)

Un posto scelto dall'utente in «Settings» → «Offline maps» → «Add a
place». Il codice è in `phone_zone_places.py`, installato con
`install_phone_zones`.

| Endpoint | Cosa | Risposta |
|---|---|---|
| `POST /phone-zones/{network}/places` | corpo `{"lat": …, "lon": …}`; la zona della rete `foot` o `bike` con 6 km intorno al posto: se il server ce l'ha è pronta, se no la prepara | `200 {"state": "ready"}`: il telefono la scarica da `GET /phone-zones/{network}?lat=&lon=&margin_m=6000`; `202 {"state": "preparing"}`: in coda o in download, da richiedere; `404 http_error` con un'altra rete; `422 invalid_request` con `lat` o `lon` fuori dai limiti; `429 too_many_requests` con `Retry-After` oltre i posti nuovi del giorno; `503 map_data_unavailable` con `Retry-After` dopo un download fallito |

- **La preparazione**: un posto alla volta, il più vecchio prima, in un
  thread dell'API. La zona si scarica da Overpass come per un percorso
  (`OsmnxSource.load`), a piedi anche con i nomi delle strade; poi si
  scrive il file del telefono. Una zona che contiene già il posto (portata
  intanto da un percorso) non si scarica di nuovo.
- **I tetti**: 3 posti nuovi al giorno per telefono (scelta dell'utente;
  l'id in `X-Phone-Id`, come per il tetto del traffico) e 20 in tutto il
  server; oltre, `429` con `Retry-After` fino alla mezzanotte UTC. Un posto
  già pronto o già in coda non si conta.
- **Un download fallito** (Overpass che rifiuta, nessuna strada lì) dà
  `503` con `Retry-After: 3600`; dopo, il posto si può chiedere di nuovo.
- **Mai mentre si disegnano percorsi**: un middleware dell'API annota ogni
  richiesta a `/route-jobs` (`RouteWork`); un posto parte solo dopo 120 s
  senza nessuna. Il giro di notte di `draw_examples` chiede e segue i suoi
  lavori uno dopo l'altro, quindi finché gira nessun posto parte; lo
  stesso mentre un telefono aspetta il suo percorso. Il file
  `places.pause` nella cartella della cache (`data/cache/places.pause`)
  ferma tutti i posti finché c'è, per un lavoro pesante fuori dall'API
  (`prefetch_zones`, `phone_zone_api`). Nel frattempo la risposta è
  `202 preparing`.
- **In memoria**: coda, tetti e fallimenti. Un riavvio li dimentica, e il
  telefono, chiedendo di nuovo, rimette in coda il suo posto.

## Eventi delle ricerche (TASK-130, ADR-0101)

Ogni ricerca e ogni segnale d'uso lascia un evento in `data/insights/`
(spento con `--no-insights`); `--insights-dir` e `--vocabulary` cambiano
cartella e vocabolario. Il funzionamento, i comandi e la privacy sono in
`docs/INSIGHTS.md`. Le risposte degli endpoint non cambiano, tranne
`/cities` corretto dal vocabolario; i segnali dell'app arrivano da
`POST /signals` (TASK-142).

## Errori

Ogni errore ha la stessa forma, con un messaggio in inglese come quelli
del motore:

```json
{ "error": { "code": "shape_not_drawable", "message": "a 7 km heart cannot be drawn here: …", "suggested_distance_m": 4000, "reason": null } }
```

`suggested_distance_m` c'è in ogni errore ed è `null` tranne con
`shape_not_drawable`, quando il percorso migliore seguiva la forma ma
mancava la distanza: è la sua lunghezza, al km intero, fra 1 e 50 km
(ADR-0041); in bici fra 10 e 30 km (TASK-190); sull'acqua per difetto al
mezzo km, fra 1 e 5 km, o `null` se ci sta solo sotto 1 km (TASK-191,
ADR-0164). Se il motivo è la somiglianza bassa resta `null`.
`reason` c'è in ogni errore dal TASK-073 ed è `null` tranne con
`image_not_usable` e `outline_edit_rejected` (TASK-079): il motivo del
motore, in una parola.

| Caso | HTTP | `code` |
|---|---|---|
| JSON malformato, campo mancante, in più o fuori limite | 422 | `invalid_request` |
| `activity` che il contratto non offre (`running`, `cycling`, `paddling`); in bici una distanza fuori da 10–30 km (TASK-190); in canoa fuori da 1–5 km, una parola o un'immagine (TASK-191) | 422 | `invalid_request` |
| `shape` e `word` insieme o nessuno; una lettera che l'alfabeto non ha; più di 8 lettere; meno di 3 km a lettera; `style` sconosciuto o `"block"` con una forma | 422 | `invalid_request` |
| `/track-scores`: corsa troppo corta per un punteggio, `similarity` fuori da 0–1, troppe posizioni | 422 | `invalid_request` |
| Forma non disponibile in quella zona (ADR-0025); nessuna strada attorno alla partenza (ADR-0148: prima era `engine_error`); in canoa, nessun'acqua vicino o la forma che non ci sta (TASK-191) | 422 | `shape_not_drawable` |
| Zona, o acqua della canoa, non in cache e dati OSM non scaricabili | 503 | `map_data_unavailable` |
| Il modello che legge le parole della forma non risponde (`AI.md`) | 503 | `ai_unavailable` |
| Un'immagine senza un contorno chiaro (TASK-073) | 422 | `image_not_usable` |
| Una linea disegnata che non dà un contorno solo (TASK-079) | 422 | `outline_edit_rejected` |
| Immagine non in base64 o oltre 10 MB; contorno di `/image-route-jobs` non valido | 422 | `invalid_request` |
| Il motore viola le sue regole (ADR-0026) o altro imprevisto | 500 | `engine_error` |
| Indirizzo o metodo sbagliato | 404, 405 | `http_error` |
| Con `SHAPEROUTE_API_KEY` impostata: `X-API-Key` mancante o sbagliata (TASK-081) | 401 | `unauthorized` |
| Più di `SHAPEROUTE_RATE_LIMIT` POST in un minuto dallo stesso client (default 30; `Retry-After` in secondi) | 429 | `too_many_requests` |
| Account: 5 password sbagliate in 15 minuti per la stessa email (`Retry-After` in secondi) | 429 | `too_many_requests` |
| Account: iscrizione con un'email già usata | 409 | `email_taken` |
| Account: iscrizione con un nome già usato, anche con altre maiuscole | 409 | `username_taken` |
| Profilo: `PATCH /me` con il nome di un altro account, anche con altre maiuscole (TASK-116) | 409 | `username_taken` |
| Profilo: `PATCH /me` con un nome fuori regola o una bio troppo lunga, in parole (TASK-116) | 422 | `invalid_request` |
| Profilo: `GET /users/{public_id}` di un profilo che non c'è (TASK-116) | 404 | `http_error` |
| Account: email o password sbagliate | 401 | `wrong_credentials` |
| Account: nessun token, o uno di una sessione chiusa | 401 | `not_signed_in` |
| Account: sessione non usata da 90 giorni | 401 | `session_expired` |
| Account: l'API non ha un database (`SHAPEROUTE_DATABASE_URL`) | 503 | `accounts_unavailable` |
| Concorso: nessun concorso aperto né chiuso da meno di 7 giorni (TASK-299) | 404 | `no_contest` |
| Strava: il server non ha la sua app Strava (`STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`) | 503 | `http_error` |
| Strava: l'account non ha un atleta collegato, o l'atleta ha tolto l'accesso | 409 | `http_error` |
| Strava: la corsa viene da un file di un'altra app (`source` `file`, TASK-312) | 409 | `imported_run` |
| Strava: non risponde | 502 | `http_error` |
| Strava: il suo limite di richieste è raggiunto (`Retry-After` in secondi) | 429 | `too_many_requests` |
| Strava: non riesce a leggere la corsa | 422 | `invalid_request` |

Forma e codici sono anche nel contratto condiviso con l'app: `ApiError` e
`API_ERROR_CODES` in `shared-types` (ADR-0031). Un codice nuovo va aggiunto
in tutti e due i posti, e i test lo controllano.

I limiti di distanza, forme, parole e attività stanno solo in
`models.py` del route-engine: Pydantic controlla i tipi, il `RouteRequest` del motore i
valori. L'API accetta solo le attività del contratto
(`SUPPORTED_ACTIVITIES`), anche se il motore ne disegna altre. Per `engine_error` il messaggio è generico e il dettaglio va nel
log dell'API, non al telefono.

## Grafi

L'API non salva i ritagli dei grafi, come invece fa la CLI (ADR-0023): da
3 a 110 MB per ogni partenza nuova avrebbero riempito il disco. Tiene in
memoria gli ultimi 2 grafi di zona e ne ritaglia uno nuovo per ogni
richiesta. **La bici ha le sue zone** (TASK-190, ADR-0153): un'altra cache
(`bike_*`) e un altro insieme in memoria, di **una** zona sola, perché una
zona della bici di 26 km pesa 0,15–0,6 GB (stima nel task file); una
richiesta in bici in un'altra città la rilegge dal disco. Ogni richiesta
va sulle zone della sua attività (`activity_graphs.py`); una in canoa
non ha zone, va sull'acqua di `data/cache/water/` (TASK-191, sopra «Sull'acqua»). Una zona non in cache si scarica e si salva come con la CLI,
anche se la richiesta viene annullata durante il download: una zona pesa
circa 40 MB fra GraphML e pickle, e OSMnx tiene le risposte di Overpass
in `data/cache/http/` (244 MB il 2026-09-23).

C'è un lucchetto per zona (ADR-0032): mentre si scarica una zona, le
richieste per le altre zone non aspettano.

Il log dell'API dice per ogni richiesta da dove veniva il grafo (memoria,
disco o rete), quanto è durata e com'è andata. La posizione di partenza
non entra nel log.

## Tempi

Misurati il 2026-09-23 sul PC di sviluppo, da `curl` su `127.0.0.1`, con i
grafi già in cache; ogni caso chiesto due volte di seguito.

| Caso (5 km) | 1ª richiesta | 2ª richiesta | Risultato |
|---|---|---|---|
| Trento, cuore | 32,4 s | 24,7 s | 3866 m, somiglianza 0,89 |
| Trento, cerchio | 14,8 s | 12,6 s | 5152 m, 0,94 |
| Levico, cuore | 7,9 s | 7,7 s | 6570 m, 0,87 |
| Levico, cerchio | 7,5 s | 7,2 s | 4242 m, 0,74 |
| Trento, cerchio da una partenza nuova (46.0702, 11.1263) | 28,6 s | 20,2 s | 4725 m, 0,90 |

Quasi tutto il tempo è il calcolo del motore: il grafo pesa da 0,1 a 1,4 s
quando è in memoria. Pesa di più la prima volta: fino a 5 s per un ritaglio
già su disco, 10 s per leggere il GraphML di una zona senza pickle. I
quattro casi di riferimento trovano su disco il ritaglio esatto salvato
dalla CLI; una partenza nuova usa il grafo della zona, com'è per l'app.

La prima lettura di una zona senza pickle lo scrive accanto al GraphML
(11 MB per Trento), una volta sola, come fa la CLI. Nessun altro file
compare in `data/cache/`.

Tutti i casi stanno sotto i 60 s dopo i quali iOS tende a chiudere una
richiesta ferma; il cuore di Trento sfiora i 30 s dell'MVP (`PRODUCT.md`).

Con la ricerca del posto (TASK-038, ADR-0040), misurati il 2026-09-24 dal
motore, zone in cache, ogni caso due volte: gatto e pesce da 15 km a Levico
12–14 s, stella da 10 km a Levico 7–10 s, tutti spostati di 1 km; cuore da
15 km a Trento 47–52 s, perché prima finisce la ricerca vicina. Il primo
secondo tempo che non trova la zona la scarica (Levico: 42 s in più); lo
stato del job passa da `computing` a `downloading_map` e torna `computing`.

Dal telefono (TASK-023, PC sull'hotspot dell'iPhone) i casi fino a 10 km
nelle zone in cache hanno risposto in 5–25 s. Non stanno nei 60 s:
- **15 km**, sempre: circa 14 s per ritagliare la zona, anche dalla
  memoria, e circa 50 s di calcolo;
- **una zona nuova**: 72–100 s solo per scaricarla da Overpass sui dati
  mobili; una volta è fallita dopo 22 s (503).

Con le richieste in due tempi (TASK-025), sul PC di sviluppo:
- cerchio da 15 km a Trento, zona già in cache: accettato subito, finito
  in **31 s** (3,8 s di grafo, 26 s di calcolo; 15,9 km, somiglianza
  0,82). Nella prova sull'iPhone lo stesso caso era arrivato a 50 s di
  calcolo perché due 15 km giravano insieme;
- un 5 km chiesto subito dopo aver annullato un 15 km ancora in download:
  pronto in 18 s, senza aspettare l'altro.

### Oltre 15 km (TASK-026)

Misurati il 2026-09-23 sul PC di sviluppo, dalla partenza di Trento, con
`/route-jobs` su `127.0.0.1`, una richiesta alla volta. Le zone le ha
scaricate uno script usa-e-getta, con l'indirizzo di Overpass che risponde
(`MAPS.md`); ogni zona serve sia al cuore sia al cerchio.

| Zona | Area | Download | Su disco |
|---|---|---|---|
| 21 km | 16,7 × 16,7 km = 280 km² | 105 s | 55 MB (38 GraphML, 17 pickle), più 21 MB di risposta di Overpass |
| 30 km | 23 × 23 km = 530 km² | 279 s | 82 MB (57 GraphML, 25 pickle), più 33 MB di risposta di Overpass |

| Caso | 1ª richiesta | 2ª richiesta | Risultato |
|---|---|---|---|
| 21 km, cuore | 42 s | 47 s | 20,7 km, somiglianza 0,86 |
| 21 km, cerchio | 44 s | 36 s | 21,0 km, 0,82 |
| 30 km, cuore | 31 s | 28 s | `shape_not_drawable`: il migliore è 2,7 km più corto |
| 30 km, cerchio | 42 s | 41 s | 30,2 km, 0,90 |

Il grafo pesa 6–7 s dal disco e 2,5–4 s dalla memoria; il resto è il
calcolo, che cresce poco con la distanza. L'API con le due zone in memoria
occupa circa 400 MB. Quello che cresce è il **download** di una zona
nuova: 105 s a 21 km, 279 s a 30 km, già quasi i 5 minuti che l'app
aspetta prima del calcolo. Per questo l'app arriva a 21 km (ADR-0034):
anche in una zona nuova il percorso arriva in circa due minuti e mezzo. Sui
dati mobili il download è più lento (72–100 s per un 15 km, TASK-023).

### Dove va il tempo (TASK-063)

Misurato il 2026-09-25 dal motore, zone in cache, cuore e cerchio a 10, 15
e 21 km (numeri per fase in `tasks/TASK-063.md`). Quel giorno il PC era più
carico che nelle misure sopra: i totali assoluti vengono più alti, il
confronto prima/dopo vale. Più di metà del tempo era il **corridoio**, il
costo di ogni strada ricalcolato a ogni tracciato: reso da 1,3 a 4,5 volte
più veloce a percorsi identici (ADR-0059), Trento da 15 a 21 km è passata
da 80–97 s a 35–64 s. Sopra i 30 s restano la **seconda ricerca** fino a
2 km (ADR-0040), che a Trento corre quasi sempre, e a Milano il
**ritaglio** della zona dalla memoria, 6–13 s a richiesta.

### Il ritaglio (TASK-087)

Dal 2026-09-30 il ritaglio lo fa `ZoneCrop` (`route_engine/zone_crop.py`,
ADR-0082): lo stesso grafo di `network.crop`, nello stesso ordine, senza
passare dalle viste di NetworkX e col garbage collector sospeso. Ogni
richiesta ha ancora il suo grafo. Misurato su un Mac (non il PC delle
misure sopra), zona di Milano già in memoria: da 1,7–5,6 s a 0,3–1,0 s a
richiesta fra 10 e 21 km, percorsi identici punto per punto
(`tasks/TASK-087.md`). A Levico era già sotto il mezzo secondo.

## Domande ancora aperte

- Motore lento sulle distanze lunghe: 30–45 s da 15 a 30 km, più se lavora
  insieme a un'altra richiesta (`STATUS.md`).
- Zone oltre i 21 km: il download da Overpass supera i minuti che l'app
  aspetta; si ripensa con ADR-0009.
- Autenticazione, limiti di richieste, versione, HTTPS, deploy: fase 4.
- Motore di routing di produzione: ADR-0009, rinviata alla fase 4.

## Gli esempi preparati prima (TASK-316, ADR-0276)

### `draw_examples --all` e `--around`

`--all` chiede a ogni città **tutti** i suoi esempi, come l'app quando la
si tocca: le otto forme e poi le sei parole con la penna alzata, stile
`round`, 3 km a lettera, la più lunga per prima (`city_examples.py`; la
lista è `packages/shared-types/fixtures/city-examples.json`, letta da un
test qui e da uno dell'app). `--around CITTÀ` disegna i paesi che `GET
/nearby-cities` dà attorno alla città e poi quelli attorno a ognuno, un
giro dopo l'altro, ognuno **dal suo punto di `/nearby-cities`** (per un
paesino non è quello di `/cities`, TASK-236), al massimo `--towns` paesi
(20 di base). La città stessa si disegna per nome, se la si scrive.

```
python -m shaperoute_api.draw_examples --api https://… --all Trento Caldonazzo \
  --around Trento --around Caldonazzo
```

### `POST /kept-routes`: solo ciò che è tenuto

All'apertura l'app prepara gli esempi dei paesi vicini e della regione.
Con `POST /route-jobs` ogni telefono farebbe disegnare al server ciò che
non è tenuto, e scaricare le zone dei paesi; qui chiede in un colpo gli
esempi di un paese e riceve **solo quelli tenuti**, `null` per gli altri.
Nessun job, nessuna zona, nessun motore, niente scritto.

```json
{"requests": [{"start": [46.0671, 11.1214], "shape": "heart", "distance_m": 5000, "activity": "running"},
              {"start": [46.0671, 11.1214], "word": "CIAO", "style": "round", "pen_up": true, "distance_m": 12000, "activity": "running"}]}
```

```json
{"routes": [{"points": [...], "distance_m": 4004.5, "...": "come il result di un job"}, null]}
```

- Da 1 a **16** richieste (gli esempi di una città sono 14), di forma o di
  parola, con i campi di `POST /route-jobs`: un'immagine è un `422`, e una
  forma spostata (`near`) non è mai tenuta, quindi `null`.
- Una risposta per richiesta, nello stesso ordine: il `RouteResult` tenuto
  o `null`. Una richiesta che il motore rifiuterebbe è un `422` come da
  `/route-jobs`.
- **Solo i file dei centri** (`route_store.py`: i centri delle città e i
  punti sull'acqua, che non sono la posizione di nessuno), **mai
  l'archivio** di ADR-0256, che tiene anche i percorsi disegnati da dove
  erano gli utenti, senza chi: con una risposta «tenuto» o «no», un punto
  direbbe se qualcuno ci ha disegnato. Nessun account, nessun post.
- È un POST: conta uno nel limite al minuto, come gli altri (`access.py`).
- Tipi in `packages/shared-types/src/keptRoutes.ts`, fixture
  `kept-routes-request.json` e `kept-routes.json`.
