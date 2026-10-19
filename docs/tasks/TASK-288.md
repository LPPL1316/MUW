# TASK-288 — Le ricerche dell'API più veloci

**Stato**: Done · in `main` con la #518 (`2d8b4562`, 2026-10-16), mergiata
su richiesta dell'utente col via del Coordinatore. **Non ancora sul
server**: la migrazione va con il prossimo aggiornamento, dopo Apple e con
l'ok dell'utente
**Fase**: 4 · **Branch**: `feat/TASK-288-faster-api-searches` (cancellato
al merge)
**ADR**: ADR-0249 · **Migrazione**: `0022_faster_searches.sql`, entrata
prima della #502 (che prende la 0023)
**Parte B** (il pool di connessioni): Done, in `main` con la #524
(`42699af4`, 2026-10-18), **non ancora sul server**; vedi «Parte B»

## Obiettivo

Le ricerche dell'API diverse dal percorso (`/cities`, `/nearby-cities`,
`/users?q=`, `/feed`, i disegni di un profilo) rispondono prima, con le
stesse risposte, senza dipendenze nuove e senza lavoro sul server.

## Contesto

Dall'analisi del 2026-10-16 della sessione «MUW app performance e
ricerca»: Geoapify chiesto in serie e senza un secondo tentativo (causa
probabile dei «not found by the city search» saltuari di
`draw_examples`), nessun indice per «Find friends», la foto piccola
rifatta per ogni riga a ogni lettera, il feed che legge le tracce intere,
nessuna compressione, una scrittura nel database a ogni richiesta con un
token. L'API gira in un solo processo sul server Hetzner CX33, insieme al
calcolo dei percorsi. Numero dal Coordinatore; il Coordinatore ha detto sì
a toccare `app.py` (anche in #461) e `accounts.py` (anche in #502) per le
poche righe di questo task.

## Contesto da leggere

- `docs/API.md` («Cosa è deciso», `GET /cities`, `GET /nearby-cities`)
- `docs/DATABASE.md` («Com'è oggi», `sessions`, `drawings`)
- `docs/DECISIONS.md`: ADR-0213 (il punto di un paese), ADR-0227 (il
  feed), ADR-0243 (le foto delle città)

## Cosa fare

1. gzip nell'API da 1 KB in su (`app.py`).
2. Geoapify (`places.py`, `cities.py`, `nearby_cities.py`): richieste
   insieme, timeout 3 s, un secondo tentativo su timeout, 429 e 5xx, il
   codice nel log e mai l'URL; niente cache per una risposta senza città.
   `draw_examples` distingue un 5xx da «non trovata» e lo richiede.
   `city_photos.py`: un pool per Wikimedia, uno per i download.
3. «Find friends»: `pg_trgm` e un indice GIN su `lower(username)`; la foto
   piccola fatta una volta per foto (`follows.py`).
4. Il feed: indice parziale sui disegni pubblicati; l'anteprima di 64 punti
   tenuta dal database al posto della traccia intera (`feed.py`,
   `drawings.py`).
5. `last_used_at` scritto solo se ha più di un'ora (`accounts.py`). Il pool
   di connessioni vuole `psycopg_pool`, una dipendenza nuova: **non qui**,
   da chiedere all'utente.

## Criteri di accettazione

- [x] Le risposte da 1 KB in su arrivano con gzip a chi lo chiede, con la
      loro lunghezza; le più piccole, i JPEG e i `.gz` no
      (`test_compression.py`).
- [x] Le aree di `/cities` e le tre categorie di `/nearby-cities` si
      chiedono insieme; un'area che non risponde non ferma le altre; una
      risposta vuota non resta in cache (`test_geoapify_requests.py`).
- [x] `fetch_json` richiede una volta su timeout, connessione caduta, 429
      e 5xx, mai su 4xx, e il log non ha la chiave.
- [x] `draw_examples` richiede un 503 tre volte e scrive «did not answer»,
      non «not found» (`test_draw_examples.py`).
- [x] Un download lento delle foto delle città non toglie le foto alla
      lista seguente (`test_city_photos.py`).
- [x] La ricerca dei nomi usa `users_username_trgm_idx`; la foto piccola
      si fa una volta, e di nuovo per una foto nuova
      (`test_faster_database.py`).
- [x] `drawings.preview` dà gli stessi punti di `recommended.preview` sulla
      traccia intera, per lunghezze da 2 a 3 333 punti; feed e profilo
      mostrano lo stesso `track_preview` di prima.
- [x] Un uso si scrive una volta l'ora, e una sessione non finisce mai
      prima di 90 giorni dall'ultimo uso vero.
- [x] Tempi prima e dopo misurati in locale su `/users?q=`, `/cities` e
      `/feed` (sotto).
- [x] CI verde (5/5 sulla head `20d87af2`).

## File toccati

```
services/api/shaperoute_api/app.py
services/api/shaperoute_api/places.py
services/api/shaperoute_api/cities.py
services/api/shaperoute_api/nearby_cities.py
services/api/shaperoute_api/city_photos.py
services/api/shaperoute_api/draw_examples.py
services/api/shaperoute_api/follows.py
services/api/shaperoute_api/feed.py
services/api/shaperoute_api/drawings.py
services/api/shaperoute_api/accounts.py
services/api/migrations/0022_faster_searches.sql          (nuovo)
services/api/tests/test_geoapify_requests.py              (nuovo)
services/api/tests/test_faster_database.py                (nuovo)
services/api/tests/test_compression.py                    (nuovo)
services/api/tests/test_city_points.py
services/api/tests/test_nearby_cities.py
services/api/tests/test_draw_examples.py
services/api/tests/test_city_photos.py
services/api/tests/test_accounts.py
docs/API.md
docs/DATABASE.md
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-288.md                                    (nuovo)
```

## Prima dell'aggiornamento del server (per il Coordinatore)

1. **Caddy non comprime già il blocco dell'API: controllato il
   2026-10-16.** Il Coordinatore ha letto `/etc/caddy/Caddyfile` sul
   server, solo in lettura: il blocco dell'API (`188-245-9-220.sslip.io,
   api.getmuw.app`) è solo `reverse_proxy 127.0.0.1:8000`, senza `encode`,
   come dice `DEPLOY.md` F.14. Il gzip nell'API serve davvero: oggi il
   telefono riceve tutto in chiaro. Se un giorno quel blocco avesse un
   `encode`, non si comprimerebbe due volte: Caddy lascia com'è una
   risposta che ha già `Content-Encoding`. Lo stesso vale per il
   `deploy/Caddyfile` del repository (profilo `public` di `compose.yaml`,
   non usato sul server), che ha `encode gzip`.
2. **Domanda per l'utente: il pool di connessioni** (la porta il
   Coordinatore all'utente, con questa misura). Oggi ogni chiamata a
   `Database.connect()` apre una connessione nuova a PostgreSQL, con la
   stretta di mano della password. Una richiesta con un token ne apre due:
   una per il token, una per l'endpoint. In locale `GET /me`, che è solo il
   token, costa 66 ms, e `GET /users?q=` 144–189 ms. Quasi tutta la
   differenza fra i due sono le due connessioni, non la ricerca: la
   ricerca di «mar» nel database costa 7,8 ms. Sono tempi del database
   emulato del Mac; sul server il rapporto dovrebbe essere simile, i tempi
   più bassi. Il pool tiene aperte poche connessioni e le riusa. Vuole
   `psycopg_pool`, il pool ufficiale di psycopg 3, una **dipendenza nuova**
   (`psycopg[binary,pool]` in `services/api/pyproject.toml`). Va bene
   aggiungerla? Con un sì è un task a sé (la sessione «API connection pool
   with psycopg_pool», proposta e ferma), da misurare con lo stesso script.

## Parte B — Il pool di connessioni

**Stato**: Done · in `main` con la #524 (`42699af4`, 2026-10-18),
mergiata dal Coordinatore su richiesta dell'utente. **Non ancora sul
server**: la dipendenza nuova va con l'aggiornamento dopo l'approvazione di
Apple, con l'ok dell'utente
**Branch**: `feat/TASK-288-b-connection-pool` (mergiato) · **ADR**: aggiunta ad
ADR-0249 · **Migrazione**: nessuna · **Dipendenza nuova**:
`psycopg[binary,pool]` (`psycopg_pool` 3.3)

Il sì dell'utente, scritto al Coordinatore il 2026-10-16: «sì, aggiungi il
pool di connessioni». Le cinque condizioni del Coordinatore: dimensione
scelta da RAM e processi del server, chiusura pulita, nessuno stato da una
richiesta all'altra (con un test), lo stesso dopo un errore, test
deterministici. In più: una richiesta che aspetta oltre i 10 s riceve un
errore pulito, non resta appesa.

### Cosa fa

- `Database.pooled()` (`db.py`) apre un `ConnectionPool` e
  `Database.connect()` presta una sua connessione invece di aprirne una
  nuova. Il contratto è lo stesso: un blocco è una transazione, confermata
  se finisce, annullata se solleva. Senza pool (test, strumenti)
  `connect()` apre la sua connessione come prima. `__main__.py` usa il
  pool dopo le migrazioni.
- **Ogni connessione torna come una sessione nuova**: il blocco chiude la
  sua transazione (commit o rollback); il pool annulla una transazione
  lasciata aperta; poi `DISCARD ALL` toglie SET, tabelle temporanee, lock
  consultivi, cursori, prepared statement e LISTEN. Lo stesso dopo un
  errore: l'eccezione esce, la connessione torna.
- **Niente prepared statement** (`prepare_threshold=None`): psycopg
  prepara una query eseguita cinque volte, e dopo un secondo `DISCARD ALL`
  continuerebbe a usare un'istruzione che PostgreSQL ha già tolto
  («prepared statement does not exist»: provato in locale). Una richiesta
  di oggi esegue ogni query una o due volte: non perde niente.
- **Controllo al prestito** (`ConnectionPool.check_connection`, una query
  vuota): una connessione chiusa da PostgreSQL (un riavvio del servizio
  `db`) si sostituisce, e la richiesta non fallisce.
- **Un blocco aperto dentro un altro, nello stesso thread, ha una
  connessione sua** fuori dal pool, come prima. Trovato con una sonda su
  tutti i 610 test del database (ogni `connect()` aperto mentre lo stesso
  thread ne tiene un altro): nel codice dell'API succede solo in
  `strava.py`, che tiene la corsa bloccata (`FOR UPDATE`) mentre legge il
  token e mentre manda la corsa a Strava, e chiama `disconnect` dopo un
  rifiuto. Dal pool, dieci invii a Strava insieme aspetterebbero ognuno una
  seconda connessione che nessuno restituisce, fino all'errore dopo 10 s.
  Gli altri annidamenti trovati sono dei test stessi.
- **Tutte occupate per 10 s**: `503 accounts_unavailable`, «The server is
  busy: try again in a moment.», `Retry-After: 10`, e nel log una riga
  `WARNING: database: couldn't get a connection after 10.00 sec`. Senza il
  gestore sarebbe stato un 500 `engine_error` («The engine failed»).
  Verificato nell'app, senza toccarla: per quel codice le schermate degli
  account mostrano il loro testo tradotto («Accounts are not available
  right now. Try again later.», in tutte le lingue), quelle dei percorsi
  «Something went wrong on our side» (le parole del server solo nella build
  di sviluppo), il feed lascia quel che c'era. Le parole del server
  arrivano a chi usa l'app solo con `invalid_request`: **nessun seguito**.
- **Chiusura**: nel `lifespan` dell'app (`app.py`), prima che uvicorn
  restituisca il SIGTERM al processo; e nel `finally` di `main`, per
  quando l'app non è mai partita. Dopo, nessuna connessione aperta.
- Il pool scrive a INFO ogni connessione prestata, due righe a richiesta:
  il suo logger (`psycopg.pool`) è portato a WARNING.

### I numeri, e perché

Il server: Hetzner CX33, 4 vCPU e 8 GB, PostgreSQL 16 nello stesso
`compose.yaml` con la configurazione dell'immagine (`max_connections` 100,
`shared_buffers` 128 MB). L'API è **un solo processo** (`python -m
shaperoute_api`, `uvicorn.run` senza worker); gli endpoint girano nei
thread di AnyIO, **al più 40 richieste insieme**, e le 4 vCPU le divide col
motore dei percorsi. Una richiesta con un token usa due connessioni, ma
**una dopo l'altra**: quella del token torna prima che l'endpoint prenda la
sua (lo conferma la sonda; l'eccezione è Strava, sopra). Quindi 10
connessioni servono 10 richieste nello stesso istante; l'undicesima aspetta
che una torni, cioè i millisecondi di una query.

| Valore | Scelto | Perché |
|---|---|---|
| `min_size` | 2 | Aperte sempre: bastano ai pochi telefoni di oggi, che chiedono una cosa alla volta. Due backend fermi sono ~10–20 MB. |
| `max_size` | 10 | Oltre circa 2 × core + 1 = 9 query insieme PostgreSQL le mette solo in fila sulla CPU, che qui è anche del motore. 10 backend sono ~100 MB al più (~5–10 MB l'uno con PostGIS), l'1,2% degli 8 GB, e un decimo dei 100 di `max_connections`. |
| `timeout` (attesa) | 10 s | Le query durano millisecondi: dieci secondi senza una connessione libera vogliono dire qualcosa di bloccato. Poi il 503, non un'attesa senza fine. |
| `max_idle` | 10 min | Il valore di psycopg_pool: dopo un'ora di punta, le connessioni oltre le 2 si chiudono. |
| `max_lifetime` | 1 h | Il valore di psycopg_pool: ogni connessione si rinnova, la memoria di un backend non cresce per giorni. |

**PostgreSQL resta sotto `max_connections` anche con `draw_examples`**:
`draw_examples` non apre connessioni, chiede i percorsi all'API in HTTP, e
passa quindi dal suo pool. Gli altri client sono `backup` (un `pg_dump` alla
notte, 1 connessione), le migrazioni all'avvio (1, chiusa prima che il pool
apra), un `psql` a mano, e gli invii a Strava (1 in più ciascuno, fuori dal
pool, rari). In tutto ~10 + 1 + 1 + pochi, sotto 20 contro 100: nessun
cambio a PostgreSQL, a `compose.yaml` né a `DEPLOY.md`. Anche durante un
aggiornamento: `docker compose up -d` ferma la vecchia API prima di
avviare la nuova.

### Cosa guardare sul server (per il Coordinatore)

Dopo l'aggiornamento, con l'ok dell'utente:

1. **Il numero da guardare**: le righe `couldn't get a connection` nel log
   dell'API, `docker compose logs api | grep -c "couldn't get a
   connection"`. Deve restare **0**: anche una sola vuol dire 10
   connessioni occupate per 10 s e un telefono che ha ricevuto il 503.
2. Le connessioni aperte: `docker compose exec db psql -U shaperoute -d
   shaperoute -c "SELECT state, count(*) FROM pg_stat_activity WHERE
   datname = 'shaperoute' AND pid <> pg_backend_pid() GROUP BY state"`.
   A riposo 2 `idle`; mai più di 10 dell'API; mai `idle in transaction`.
3. `GET /me` e `GET /users?q=` prima e dopo, con lo stesso script di
   TASK-288 (sotto, i tempi in locale).

### Tempi (parte B)

Il 2026-10-17, con lo script della parte A («Come si è misurato», sotto):
lo stesso database con gli stessi dati, un giro senza pool e uno col pool
dell'API (2–10), mediane di 30 richieste (5 per il feed), dal codice di
questo branch. Il database è l'immagine x86 emulata del Mac: sul server i
tempi sono più bassi, il guadagno simile.

| Richiesta | Senza pool | Col pool |
|---|---|---|
| `GET /me` (solo il token) | 63 ms | 4 ms |
| `GET /users?q=ma` | 184 ms | 54 ms |
| `GET /users?q=ro` | 185 ms | 53 ms |
| `GET /users?q=mar` | 149 ms | 14 ms |
| `GET /users?q=lia` | 184 ms | 28 ms |
| `GET /users?q=an_1` | 146 ms | 10 ms |
| `GET /users?q=zzz` (nessuno) | 141 ms | 8 ms |
| `GET /feed` | 205 ms | 38 ms |

Col pool, 445 richieste di connessione servite da 2 connessioni, nessuna
in attesa. Quel che resta di `/users?q=` è la ricerca e le foto piccole.

### Test

`services/api/tests/test_connection_pool.py`, con PostgreSQL vero:

- le richieste si danno il turno su poche connessioni (21 richieste, al
  più 2 connessioni aperte);
- una connessione torna come una sessione nuova: lo stesso processo di
  PostgreSQL, senza SET, tabella temporanea, prepared statement, cursore,
  LISTEN né lock;
- una transazione lasciata aperta si annulla;
- un blocco fallito (un'eccezione nostra, un errore di SQL) restituisce la
  sua connessione, e quel che aveva scritto non resta;
- una richiesta fallita (un 409 e un 500) restituisce la sua connessione;
- tutte le connessioni occupate per 10 s: `503 accounts_unavailable` con
  `Retry-After: 10` dopo i 10 s, la riga nel log, e la richiesta dopo
  risponde 200 (questo test dura i suoi 10 s);
- un blocco dentro un altro ha una connessione sua, subito;
- una connessione chiusa da PostgreSQL si sostituisce;
- la stessa query molte volte non si prepara mai;
- senza pool, ogni blocco la sua connessione, come prima;
- `main` apre il pool con 2, 10 e 10 s, e l'app lo chiude quando si ferma:
  nessuna connessione resta; lo chiude anche se il server non parte.

Ognuno di questi è stato provato contro il codice senza la sua difesa
(senza `DISCARD ALL`, con i prepared statement, senza il gestore del 503,
senza la chiusura nel `lifespan` o in `main`, senza la regola del blocco
annidato): fallisce.

### Seguiti

- **`strava.py` senza un blocco dentro l'altro**, in un task a parte
  (numero dal Coordinatore, che l'ha chiesto il 2026-10-17). Oggi `send`
  tiene la corsa bloccata (`SELECT … FOR UPDATE`) per tutto l'invio, e
  dentro quel blocco `_access_token` ne apre un secondo per leggere il
  token, con un altro `FOR UPDATE`, e `disconnect` un terzo dopo un
  rifiuto. Col pool funziona per la regola del blocco annidato (una
  connessione fuori dal pool), ma ogni invio paga una connessione nuova,
  e tiene una connessione del pool per tutta la chiamata a Strava. Da
  togliere: il `FOR UPDATE` durante la lettura del token, con il token
  letto prima del lock sulla corsa o nella stessa connessione, senza
  perdere «un invio della stessa corsa alla volta». Poi la regola del
  blocco annidato in `db.py` resta solo come difesa.

### File toccati (parte B)

```
services/api/pyproject.toml
services/api/shaperoute_api/db.py
services/api/shaperoute_api/__main__.py
services/api/shaperoute_api/app.py
services/api/tests/test_connection_pool.py                (nuovo)
docs/API.md
docs/DATABASE.md
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-288.md
```

### Esito (parte B)

In `main` con la #524 (`42699af4`, 2026-10-18), sulla testa `6aed7b30` con
la CI 5/5 verde. L'ha mergiata il Coordinatore su richiesta dell'utente.
L'API presta da 2 a 10 connessioni tenute aperte; ognuna torna come una
sessione nuova, anche dopo un errore. Tutte occupate per 10 s danno un 503
pulito con `Retry-After`. Il pool si chiude quando l'API si ferma. Un blocco
annidato (`strava.py`) ha una connessione sua. In locale `/me` passa da
63 a 4 ms, `/users?q=` da 141–185 a 8–54 ms, `/feed` da 205 a 38 ms. In
locale la suite intera dell'API, con PostgreSQL, è verde (1525). Ogni
criterio del Coordinatore ha il suo test. **Non ancora sul server**: serve
un'immagine nuova con la dipendenza, all'aggiornamento dopo Apple e con
l'ok dell'utente; poi va guardato quel che dice «Cosa guardare sul
server». Seguito aperto: `strava.py` senza blocco annidato, già nella
sessione «strava.py: send a run without a nested DB block».

## Fuori scope

- Il pool di connessioni (`psycopg_pool`): dipendenza nuova, da chiedere
  all'utente. In locale `/me` da solo, cioè aprire la connessione e
  leggere il token, costa 40–70 ms; ogni richiesta con un token ne apre
  due.
- Le corse di «My activities» (`activities.py`) leggono ancora traccia e
  percorso interi per l'anteprima: la stessa cura, in un task suo.
- Un filtro a riquadro prima di `ST_DWithin` nel feed (utile quando i
  disegni saranno sparsi per il mondo), e riscrivere il feed in tre query
  perché l'indice ne serva anche l'ordine.
- Il server: la migrazione, il riavvio e la misura lì li fa il
  Coordinatore, con l'ok dell'utente.

## Come si è misurato

`task-288-bench.py`, nella cartella di appunti condivisa delle sessioni
(`side-session-notes/local_52ecf722…`): avvia `postgis/postgis:16-3.4` in
docker con la password (come sul server), applica le migrazioni del codice
sul `PYTHONPATH`, mette 20 000 iscritti (3 000 con foto), 200 seguiti,
1 500 disegni pubblicati da 2 000 punti intorno a Trento (70% per tutti,
20% per chi segue, 10% solo io), e misura con `TestClient` nello stesso
processo: la mediana di 30 richieste (5 per il feed). `/cities` con un
Geoapify finto che aspetta 250 ms a richiesta (cinque città, tutte aree:
una geocodifica e cinque Places), e una volta col Geoapify vero.
«Prima» è `origin/main` `52b331f7`; «dopo» questo branch. **Sul Mac
l'immagine PostGIS è x86 ed è emulata**: i tempi del database sono molto
più alti di quelli del server; conta il rapporto fra prima e dopo.

## Tempi

Mediane; i byte sono quelli che viaggiano (con gzip dopo, il corpo è lo
stesso).

| Richiesta | Prima | Dopo |
|---|---|---|
| `GET /me` (solo il token) | 69 ms | 66 ms |
| `GET /users?q=ma` | 202 ms · 33 KB | 185 ms · 21 KB |
| `GET /users?q=ro` | 386 ms · 26 KB | 188 ms · 16 KB |
| `GET /users?q=mar` | 225 ms · 46 KB | 150 ms · 29 KB |
| `GET /users?q=lia` | 214 ms · 33 KB | 189 ms · 17 KB |
| `GET /users?q=an_1` | 202 ms · 21 KB | 150 ms · 13 KB |
| `GET /users?q=zzz` (nessuno) | 183 ms | 144 ms |
| `GET /feed` | 289 ms · 35 KB | 208 ms · 10 KB |
| `GET /feed?lat=&lon=` | 15 045 ms · 35 KB | 747 ms · 10 KB |
| `GET /feed?lat=&lon=&cursor=` (pagina 2) | 18 967 ms | 757 ms |
| `GET /cities` (Geoapify finto, 250 ms a richiesta, 5 aree) | 1 604 ms | 804 ms |
| `GET /cities` (Geoapify vero, dal Mac: Tenna, Levico, Caldonazzo, Pergine) | 976 · 778 · 699 · 768 ms | 757 · 707 · 625 · 728 ms |

Nello stesso database, la sola condizione «vicino» su 1 500 disegni: 23,1 s
sulla traccia intera, 0,82 s sull'anteprima (0,67 s sulla sfera invece
dello sferoide: non vale l'errore in più). La ricerca di «mar» col nuovo
indice: 7,8 ms di esecuzione nel database.

Quel che resta di `/users?q=` è quasi tutto il costo delle due connessioni
nuove a ogni richiesta (`/me` da solo ne apre una: 66 ms qui, la stretta di
mano SCRAM in emulazione): lo toglie il pool di connessioni, se l'utente
dice sì a `psycopg_pool`. Le vere città hanno di solito un'area sola: lì
il guadagno di `/cities` è piccolo, e grande per i nomi con più aree.

## Esito

Le ricerche rispondono con gli stessi corpi di prima, più leggere (gzip) e
prima: il feed con la posizione 20 volte più svelto in locale, `/cities`
non aspetta più un'area dopo l'altra, «Find friends» usa un indice e non
rifà le foto, una GET con il token non scrive più nel database. Nessuna
dipendenza nuova. Rimandati, in «Fuori scope»: il pool di connessioni, le
anteprime di «My activities», il riquadro prima di `ST_DWithin`. Il server
e la misura lì li fa il Coordinatore.

Merge del 2026-10-16: la #518 è in `main` (`2d8b4562`), con la CI 5/5 verde.
L'utente ha scritto «tu mergia tutte le nuove funzioni se hai finito
archiviati», e il Coordinatore ha dato il via. Il pool di connessioni
(`psycopg_pool`) l'utente l'ha approvato, dice il Coordinatore: è un task a
sé, con la sessione «API connection pool with psycopg_pool» proposta e
non ancora avviata, e un numero da chiedere al Coordinatore.
