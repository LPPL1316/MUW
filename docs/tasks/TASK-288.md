# TASK-288 — Le ricerche dell'API più veloci

**Stato**: In corso
**Fase**: 4 · **Branch**: `feat/TASK-288-faster-api-searches`
**ADR**: ADR-0249 · **Migrazione**: `0022_faster_searches.sql` (il numero
è il primo libero in `main` al merge: con #502 prima, diventa 0023)

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
- [ ] CI verde.

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
dipendenza nuova. Rimandati, in «Fuori scope»: il pool di connessioni
(chiedere all'utente), le anteprime di «My activities», il riquadro prima
di `ST_DWithin`. Il server e la misura lì li fa il Coordinatore.
