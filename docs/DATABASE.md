# DATABASE — Persistenza

Da TASK-110 (ADR-0114, ADR-0115). Lo schema qui sotto è quello di
partenza: ogni task lo crea con la sua migrazione e aggiorna questo file.

## Dove e come

- **PostgreSQL 16 con PostGIS**, in Docker sulla stessa VM dell'API
  (ADR-0115; ADR-0114 la voleva su Oracle, l'API pubblicata oggi è su
  Hetzner): il servizio `db` di `deploy/compose.yaml` (TASK-122). L'indirizzo del database solo in `.env`
  (`SHAPEROUTE_DATABASE_URL`), mai da riga di comando: contiene una
  password. Codice in `services/api/shaperoute_api/db.py`.
- **Migrazioni**: `services/api/migrations/NNNN_cosa.sql`, applicate
  all'avvio dell'API in ordine, una transazione ciascuna, registrate in
  `schema_migrations`. Una migrazione già in `main` non si modifica mai:
  se ne scrive un'altra.
- **Accesso dal codice**: psycopg 3, SQL scritto a mano, senza ORM.
- **Coordinate**: geometrie in WGS84 (SRID 4326), punti in `(lon, lat)`
  come vuole PostGIS; all'API e all'app escono `(lat, lon)` come sempre.
  Le distanze si misurano in metri con `geography`.
- **Test**: un database vero usa-e-getta, niente finti
  (`services/api/tests/conftest.py`). I test avviano l'immagine
  `postgis/postgis:16-3.4` con docker, una volta per giro, e danno a ogni
  test un database vuoto, cancellato dopo; con
  `SHAPEROUTE_TEST_DATABASE_URL` usano invece quel server. Senza docker né
  variabile i test del database si saltano sul PC e falliscono nella CI
  (`CI=true`), che ha docker. Sul Mac docker è Colima (`SETUP.md`, 10.4).

## Schema di partenza

| Tabella | Cosa | Chi la crea |
|---|---|---|
| `users` | email (unica, minuscola), hash della password (Argon2id), nome utente (unico, 3–20 caratteri), bio, id pubblico casuale del profilo, `role` (`user` o `admin`), quando ha detto di avere 16 anni, data d'iscrizione; il numero di telefono, facoltativo (TASK-183); i due interruttori delle notifiche, spenti all'inizio (TASK-185) | TASK-114, TASK-116, TASK-183, TASK-185 |
| `sessions` | hash del token (SHA-256), utente, ultimo uso, scadenza a 90 giorni | TASK-114 |
| `profile_photos` | utente, JPEG quadrato 256 px | TASK-178 |
| `generated_routes` | ogni percorso dell'API (ADR-0086): richiesta, tipo (forma, parola, immagine), distanza, somiglianza, linea, **punto di partenza mostrato** (a più di 500 m da quello vero), centro, data; utente se era entrato, se no nessuno | TASK-092 |
| `favorites` | percorso tenuto fra i preferiti: utente, chiave fatta dall'app sulla linea (unica per utente), città, forma o parola e stile, titolo, distanza chiesta e sulle strade, somiglianza, **linea intera**, data; i tratti a piedi di una parola con la penna alzata (TASK-199); i tratti con la bici a mano (TASK-206) | TASK-171, TASK-199, TASK-206 |
| `runs` | corsa salvata: utente, chiave fatta dall'app, percorso pianificato, cosa disegna, traccia (`LineStringM`, M = secondi dall'inizio), pause, inizio, distanza, durata, punteggio, fedeltà, luogo (TASK-172); i tratti a piedi del percorso di una parola con la penna alzata (TASK-199); l'attività, a piedi, in bici o in canoa (TASK-208); il post condiviso, emoji e risultati, mai l'immagine (TASK-258) | TASK-172, TASK-199, TASK-208, TASK-258 |
| `drawings` | il disegno di una corsa: **traccia tagliata** (senza 200 m all'inizio e alla fine), titolo dato dall'utente (TASK-117); chi lo vede (tutti, chi segue, solo io) e la descrizione (TASK-208) | TASK-117, TASK-208 |
| `drawing_photos` | fino a 3 foto di un disegno oltre alla mappa: posto 1–3, JPEG al più 1080 px di lato, senza EXIF | TASK-208 |
| `drawing_tags` | gli iscritti taggati in un disegno, in ordine, al più 10 | TASK-208 |
| `reactions` | disegno, chi reagisce (coppia unica: una a testa), quale delle sei, data | TASK-119 |
| `comments` | disegno, autore, testo (1–500), data | TASK-120 |
| `reports` | chi segnala, cosa (disegno, commento, utente) e il suo id, motivo da un elenco corto, data; una riga per chi segnala e per cosa | TASK-121 |
| `blocks` | chi blocca, chi è bloccato, data; una riga tiene lontani i due nei due sensi | TASK-121 |

Tutte le tabelle legate a un utente hanno `ON DELETE CASCADE`: cancellare
la riga di `users` cancella tutto il resto, anche i suoi
`generated_routes` (ADR-0114, punto 7). I percorsi generati senza account
non hanno utente e restano.

## Com'è oggi

Migrazione `0001_users_sessions.sql` (TASK-114, ADR-0120):

- `users`: `id`, `email` (minuscola, unica), `password_hash` (Argon2id),
  `username` (3–20 fra lettere, cifre, `_` e `.`; unico con
  `lower(username)`), `role` (`user` o `admin`, default `user`),
  `confirmed_16_at`, `created_at`. La bio arriva con il profilo
  (TASK-116).
- `sessions`: `token_hash` (SHA-256 del token, 32 byte, chiave),
  `user_id` (`ON DELETE CASCADE`), `created_at`, `last_used_at`. Valida
  finché `last_used_at` è più recente di 90 giorni; ogni uso la sposta.
  Una sessione scaduta si cancella quando qualcuno la usa.
- L'estensione PostGIS la crea la prima migrazione che usa una geometria:
  è la `0002` (`CREATE EXTENSION IF NOT EXISTS postgis`); l'immagine la ha
  già.
- Un admin si nomina a mano sulla VM:
  `UPDATE users SET role = 'admin' WHERE email = '…';`

Migrazione `0002_favorites.sql` (TASK-171, ADR-0139):

- `favorites`: `id`, `user_id` (`ON DELETE CASCADE`), `key` (da 8 a 40 fra
  minuscole e cifre, unica con `user_id`), `city`, `shape`, `word`, `style`
  (`round` o `block`), `title`, `distance_m`, `route_m`, `similarity`,
  `line` (`geometry(LineString, 4326)`, punti in `(lon, lat)`),
  `created_at`. Un indice per l'elenco di un utente, dal più recente.
- Il preferito è una **copia** del percorso, non un rimando al catalogo o
  a `generated_routes`: resta com'era anche se il catalogo cambia, e un
  percorso disegnato sul telefono non sta da nessun'altra parte.
- La linea entra come WKT con tutte le cifre e torna con
  `ST_AsGeoJSON(line, 15)`: l'app ritrova gli stessi punti, e quindi la
  stessa chiave.

Migrazione `0003_runs.sql` (TASK-172, ADR-0140):

- `runs`: `id`, `user_id` (`ON DELETE CASCADE`), `key` (da 8 a 40 fra
  minuscole e cifre, unica con `user_id`), `route`
  (`geometry(LineString, 4326)`) e `route_similarity`, tutti e due o
  nessuno; `shape`, `word`, `style`, `title` (cosa disegna il percorso,
  come in `favorites`: non il titolo che l'utente darà alla corsa, che è di
  TASK-117); `track` (`geometry(LineStringM, 4326)`), `pauses` (`jsonb`),
  `started_at`, `distance_m`, `duration_s`, `score` e `fidelity` (tutti e
  due o nessuno, e solo con un percorso), `place`, `created_at`. Un indice
  per l'elenco di un utente, dall'inizio più recente.
- `track` è la traccia **pulita dal motore**, non quella grezza del
  telefono: le posizioni scartate non tornano. M sono i secondi dalla
  prima posizione, con l'orologio che corre anche nelle pause; `pauses` le
  dice, come `[{"from_s", "to_s", "auto"}]` sullo stesso orologio (più
  `"pen": true` per le pause della penna, da TASK-199); il dettaglio di una
  corsa le restituisce così, da TASK-200.
  `started_at` più M dà l'orario di ogni punto. L'altitudine non c'è.
- `distance_m`, `duration_s`, `score` e `fidelity` sono contati dall'API al
  salvataggio (`API.md`, «My activities») e non si ricalcolano: se il
  motore cambia il modo di giudicare, le corse già salvate tengono il loro
  punteggio.
- Solo il proprietario legge una riga. Quello che vedono gli altri di una
  corsa pubblicata sta in `drawings` (migrazione `0009`, TASK-117).

Migrazione `0004_strava.sql` (TASK-187, ADR-0156):

- `strava_states`: `state_hash` (SHA-256 dello `state`, chiave), `user_id`
  (unico, `ON DELETE CASCADE`), `created_at`. Un collegamento a Strava
  cominciato e non finito: vale una volta, per 10 minuti, uno per account.
- `strava_accounts`: `user_id` (chiave, `ON DELETE CASCADE`), `athlete_id`
  (unico: un atleta è di un account solo), `athlete_name`, `access_token`,
  `refresh_token`, `expires_at`, `connected_at`. I token sono **in
  chiaro**: l'API li deve rimandare a Strava, quindi un hash non basta.
  Quello d'accesso dura sei ore; il refresh token non serve a niente senza
  il Client Secret, che sta solo nell'ambiente del server. Una copia del
  database non fa entrare nessuno in Strava da sola.
- `runs` prende tre colonne: `strava_status` (assente: mai mandata;
  `processing`: Strava ha il file e lo sta leggendo; `sent`: è
  un'attività), `strava_upload_id` (l'upload su Strava) e
  `strava_activity_id` (l'attività; assente anche da `sent` quando Strava
  aveva già la corsa e non ha detto dove).
- «Disconnect» e la cancellazione dell'account non lasciano righe in
  `strava_accounts` né in `strava_states`.

Migrazione `0005_profile_photos.sql` (TASK-178, ADR-0146):

- `profile_photos`: `user_id` (chiave, `ON DELETE CASCADE`), `jpeg`
  (`bytea`, da 1 a 200 000 byte), `updated_at`. Una riga per account con
  la foto; senza riga, nessuna foto. Una foto nuova prende il posto di
  quella di prima.
- `jpeg` è il quadrato di 256 px fatto dall'API, mai il file del telefono:
  niente EXIF, quindi niente posizione dello scatto (`API.md`, «Profile
  picture»). Le copie di sicurezza la prendono con il resto (ADR-0115).
- Il nome utente e la bio di TASK-116 vengono con una migrazione sua.

Migrazione `0006_pen_up_walks.sql` (TASK-199, ADR-0157 e ADR-0158):

- `runs` e `favorites` prendono `walks` (`jsonb`, `NOT NULL`, default
  `[]`, sempre una lista): i tratti a piedi di una parola con la penna
  alzata, come `[[da, a], …]`, indici nei punti del percorso (`route` per
  `runs`, `line` per `favorites`), compresi tutti e due, come
  `RouteResult.walks`. Indici e non geometria: dicono quale pezzo della
  linea si cammina, la linea resta una sola.
- Le righe di prima prendono `[]` dal default, senza riscrivere la tabella
  (PostgreSQL 11 e dopo): si leggono come prima, una linea sola.
- In `runs` un vincolo vuole `walks` vuoto quando non c'è `route`: i tratti
  a piedi sono pezzi di un percorso.
- `pauses` non cambia colonna: una pausa della penna (l'app si è fermata
  da sola fra due lettere) ha in più `"pen": true`, e solo lei; le altre
  restano `{"from_s", "to_s", "auto"}` come prima. Per km e tempo conta
  come una pausa chiesta dal corridore (`auto` falso).

Migrazione `0007_profiles.sql` (TASK-116, ADR-0128):

- `users` prende `bio` (`text`, `NOT NULL`, default `''`, al più 160
  caratteri) e `public_id` (`uuid`, `NOT NULL`, unico, default
  `gen_random_uuid()`). Il nome utente c'era già dalla `0001`, obbligatorio
  all'iscrizione: ogni account ne ha uno, e `PATCH /me` lo cambia con la
  stessa regola.
- `public_id` è l'id con cui gli altri iscritti aprono il profilo (`GET
  /users/{public_id}`, `API.md` «Profile»): casuale, perché `id` è in
  sequenza e direbbe quanti sono gli account. Non cambia con il nome.
- Gli account di prima prendono la bio vuota e ognuno il suo `public_id`
  quando la colonna si aggiunge (il default si calcola riga per riga, e la
  tabella si riscrive una volta: pochi account, un attimo). Le sessioni di
  prima restano valide (test con dati sullo schema 0001–0006).
- Il numero di disegni del profilo non è una colonna: si conta sulle
  righe pubbliche di `drawings` (TASK-117); da TASK-208, su quelle che chi
  guarda può vedere.

Migrazione `0008_favorite_activity.sql` (TASK-200, ADR-0160):

- `favorites` prende `activity` (`text`, `NOT NULL`, default `'running'`,
  vincolo `activity IN ('running', 'cycling')`): l'attività per cui il
  percorso è stato disegnato, come `RouteRequest.activity`. Un percorso in
  bici, riaperto, si riapre in bici.
- I preferiti di prima prendono `'running'` dal default, senza riscrivere
  la tabella: erano tutti corse (test con dati sullo schema 0001–0007).
- Il vincolo elenca le attività dell'API (`SUPPORTED_ACTIVITIES`):
  un'attività nuova (la canoa, TASK-191) vuole una migrazione che lo
  allarghi. Un test di `test_favorites.py` tiene un preferito per ogni
  attività dell'API, e fallisce finché la migrazione manca.
- `runs` non cambia: `GET /me/activities/{key}` ora legge anche `pauses`,
  così come la colonna le tiene (`API.md`, «My activities»).

Migrazione `0009_drawings.sql` (TASK-117, ADR-0159):

- `drawings`: `id` (`uuid` casuale, chiave: con questo gli altri iscritti
  aprono un disegno, e contarli non dice niente), `run_id` (unico,
  `ON DELETE CASCADE` su `runs`), `title` (da 1 a 60 caratteri, o assente),
  `public`, `track` (`geometry(LineString, 4326)`), `published_at`
  (presente solo quando `public` è vero), `updated_at`. Una riga per una
  corsa che il suo iscritto ha titolato o pubblicato; una corsa mai
  toccata non ne ha, ed è privata.
- `track` è quello che vedono gli altri: la traccia della corsa senza i
  primi e gli ultimi 200 m lungo di lei, senza M (niente orari), tagliata
  dall'API da `runs.track` a ogni `PUT` del disegno: la stessa corsa dà
  la stessa linea. Assente quando non resta niente (meno di un metro):
  allora la riga non può essere pubblica (un vincolo).
- Una tabella sua, non colonne in `runs`: la riga si legge con chi ne è
  l'autore (`runs.user_id`) e cade con la corsa e con l'account. L'id del
  disegno è un altro dalla chiave della corsa, che è del telefono e unica
  solo dentro un account.
- Le corse salvate prima non hanno righe: sono private, come erano, e si
  pubblicano come le altre (test con dati sullo schema 0001–0008).

Migrazione `0010_favorite_paddling.sql` (TASK-191, parte B, ADR-0164):

- Il vincolo di `favorites.activity` della `0008` prende anche
  `'paddling'`: la canoa è un'attività dell'API, e un percorso
  sull'acqua tenuto col cuore si riapre in canoa. Lo stesso nome
  (`favorites_activity_check`), tolto e rimesso; nessuna riga cambia.
- Dipende dalla `0008` (la colonna): il test dei preferiti di prima di
  TASK-200 applica lo schema senza tutte e due, poi tutte e due.

Migrazione `0011_follows.sql` (TASK-211, ADR-0173):

- `follows`: `follower_id` e `followed_id` (tutti e due `ON DELETE
  CASCADE` su `users`, insieme la chiave: una riga per coppia, in un
  verso), `status` (`pending` o `accepted`), `asked_at`, `accepted_at`
  (presente solo da accettata). Un vincolo vieta di seguire sé stessi. Un
  indice su `(followed_id, status)` per chi segue un account e le sue
  richieste; la chiave serve l'altro verso.
- Due persone che si seguono a vicenda hanno due righe, ognuna accettata
  dal suo. Rifiutare, ritirare, smettere e togliere **cancellano** la
  riga: nessuno stato «rifiutata» resta a dire di no a chi aveva chiesto.
- Contano solo le righe `accepted`: i numeri del profilo e gli elenchi si
  contano sulla tabella, senza colonne in `users`. Cancellato un account,
  le sue righe nei due versi spariscono con lui.
- Le righe non hanno niente di pubblico: chi segue chi lo legge solo il
  proprio account (`API.md`, «Follow»). Gli account di prima non seguono
  nessuno (test con dati sullo schema 0001–0010).

Migrazione `0012_favorite_on_foot.sql` (TASK-206, parte B, ADR-0167; il
numero è il primo libero in `main` quando la PR entra, `AGENTI.md` regola
10: la `0011` è di TASK-211):

- `favorites` prende `on_foot` (`jsonb`, `NOT NULL`, default `[]`, sempre
  una lista): dove un percorso in bici si fa con la bici a mano, come
  `[[da, a], …]`, indici nei punti di `line`, compresi tutti e due, come
  `RouteResult.on_foot`. Come `walks`: indici e non geometria, la linea
  resta una sola. Un preferito in bici riaperto ha i suoi tratti a mano
  sulla mappa e nella voce (TASK-206, parte C).
- Le righe di prima prendono `[]` dal default, senza riscrivere la
  tabella: si leggono come prima, senza tratti a mano (test con dati sullo
  schema senza la migrazione).
- `runs` non cambia: i tratti a mano non contano per il punteggio, e una
  corsa salvata non li mostra.

Migrazione `0013_comments.sql` (TASK-120, ADR-0175; il numero è il primo
libero in `main` al merge):

- `comments`: `id` (`uuid` casuale, chiave: con questo si cancella),
  `drawing_id` (`ON DELETE CASCADE` su `drawings`), `user_id` (chi l'ha
  scritto, `ON DELETE CASCADE` su `users`), `text` (da 1 a 500 caratteri,
  senza spazi in testa e in coda), `created_at`. Un indice per le pagine
  di un disegno (`drawing_id`, `created_at`, `id`), dal più vecchio, e uno
  su `user_id` per cancellare quelli di un account.
- Legati al **disegno**, non alla corsa: chi li legge è chi vede il
  disegno, e un disegno tornato privato li tiene. Cancellare la corsa
  cancella il disegno, e con lui i commenti.
- Niente colonna «nascosto» (lo schema di partenza la prevedeva): la
  aggiunge TASK-121, se una segnalazione deve nascondere un commento senza
  cancellarlo.

Migrazione `0014_drawing_details.sql` (TASK-208, ADR-0170):

- `drawings.public` diventa **`visibility`** (`everyone`, `followers`,
  `only_me`, default `only_me`): ogni riga pubblica di prima passa a
  `everyone`, ogni privata a `only_me`, e chi la vedeva la vede ancora
  (test con dati sullo schema 0001–0013). I due vincoli di `public` si
  riscrivono su `visibility`: `published_at` c'è quando la vede qualcun
  altro, e allora c'è anche `track`.
- **`public` resta**, colonna generata (`visibility = 'everyone'`), per
  l'SQL scritto prima: non si scrive mai. Chi può vedere un disegno si
  chiede con `drawings.drawing_seen_sql(viewer)`, una condizione su
  `drawings d JOIN runs r ON r.id = d.run_id`: il proprietario sempre;
  gli altri se è `everyone`, o se è `followers` e lo seguono con la
  richiesta accettata (`follows`). Foto e commenti (TASK-120) seguono la
  stessa domanda. `shown_sql(viewer)` è quella del profilo: solo i
  pubblicati, anche per il proprietario.
- `drawings.description`: da 1 a 500 caratteri, a capo compresi, o
  assente.
- `runs.activity` (`running`, `cycling`, `paddling`, default `running`):
  ogni corsa di prima era a piedi, e non si riscrive la tabella. Il
  vincolo elenca le attività dell'API, come `favorites.activity`.
- **`drawing_photos`**: `drawing_id` (`ON DELETE CASCADE` su `drawings`) e
  `n` (da 1 a 3) insieme la chiave, `jpeg` (`bytea`, al più 2 MB: il
  peggio misurato, puro rumore a 1080 px, è 0,8 MB), `width` e `height`
  (al più 1080), `updated_at`. Un posto svuotato resta vuoto, gli altri
  non si spostano. Il JPEG lo fa l'API (`drawing_photos.py`): il file del
  telefono e il suo EXIF non si tengono, come per `profile_photos`. Ci
  sono righe solo per i disegni che altri vedono (`everyone`,
  `followers`): passato a `only_me`, il disegno perde le sue foto, che
  restano sul telefono (scelta dell'utente, 2026-10-03).
- **`drawing_tags`**: `drawing_id` (`ON DELETE CASCADE` su `drawings`),
  `user_id` (`ON DELETE CASCADE` su `users`: cancellato l'account
  taggato, il suo nome sparisce dal disegno), `position` (da 1 a 10). Una
  riga per persona, una persona per posto; un indice su `user_id` per
  cancellare un account.
- Quanto pesano le foto: una foto vera a 1080 px è circa 0,1–0,3 MB; un
  disegno con tre foto al più 1 MB, di solito meno. Con mille disegni
  **visti da altri** con tre foto l'uno, circa 0,5–1 GB nel database, e
  altrettanto in **ognuna** delle 13 copie di notte (TASK-122): un JPEG non
  si comprime di più, e sul disco del server pesa circa 14 volte. Le foto
  delle corse private non ci sono. Le note per il deploy sono in
  `tasks/TASK-208.md`.

Migrazione `0015_reactions.sql` (TASK-119, ADR-0193; il numero è il primo
libero in `main` al merge):

- `reactions`: `drawing_id` (`ON DELETE CASCADE` su `drawings`) e
  `user_id` (chi reagisce, `ON DELETE CASCADE` su `users`) insieme la
  chiave: **una reazione a testa** per disegno, garantita dal database;
  un'altra prende il suo posto (`ON CONFLICT … DO UPDATE`). `kind` è un
  codice, mai l'emoji: `super_like` (il cuore di Sgrava), `fire`, `clap`,
  `strong`, `laugh`, `wow`, con un vincolo che li elenca come il contratto.
  `created_at` è quando è stata lasciata o cambiata l'ultima volta. Un
  indice su `user_id` per cancellare quelle di un account.
- Il **commento del super like** è una riga di `comments` come le altre,
  scritta nella stessa transazione della reazione: nessuna colonna lega
  le due righe, perché dopo vivono separate (ADR-0193).
- Legate al **disegno**, come i commenti: le vede chi vede il disegno, e
  un disegno tornato privato le tiene.

Migrazione `0016_contact.sql` (TASK-183, ADR-0150; il numero è il primo
libero in `main` al merge):

- `users.phone`: il numero di telefono in E.164 (`^\+[1-9][0-9]{7,14}$`,
  «+» e da 8 a 15 cifre), `NULL` senza, come per ogni account di prima.
  **Non unico**: nessuno ha provato che il numero è suo (niente SMS), e un
  vincolo direbbe a chi lo scrive che un altro account lo ha già. Lo legge
  solo il proprietario (`GET /me`). Nessun indice: lo chiederà la ricerca
  dalla rubrica, quando ci sarà.
- L'email cambia con un `UPDATE` della stessa riga (`PUT /me/email`): il
  vincolo `users_email_key` dice quando è di un altro account.

Migrazione `0017_notifications.sql` (TASK-185, ADR-0206; il numero è il
primo libero in `main` al merge):

- `users.notify_email` e `users.notify_push`: i due interruttori di
  «Settings», `boolean NOT NULL DEFAULT false`. **Spenti** per ogni
  account che non li ha mai toccati, quelli di prima compresi: il
  `DEFAULT` li riempie senza toccare le righe. Li legge solo il
  proprietario (`GET /me`, dove sono l'oggetto `notifications`) e li
  cambia `PUT /me/notifications`.
- `notify_push` lo legge l'invio delle push (TASK-262, migrazione
  `push_tokens` sotto) prima di ogni notifica; `notify_email` aspetta
  l'email (TASK-262, parte B). Nessun indice: si leggono per un account
  alla volta.

Migrazione `0018_route_rotation.sql` (TASK-232, parte C, ADR-0195; il
numero è il primo libero in `main` al merge):

- `runs.route_rotation_deg` e `favorites.rotation_deg` (`real`, fra −180 e
  180, facoltative): di quanti gradi il motore ha girato la forma del
  percorso (`RouteResult.rotation_deg`, antiorario), come l'app l'ha
  mandato. L'app mostra la corsa salvata, il preferito e il disegno visto
  dagli altri girati dall'altra parte, così la forma si legge dritta. In
  `runs` solo con un percorso (`CHECK`): una corsa libera non ha niente da
  girare.
- **Assenti** per ogni riga di prima, per un percorso che l'app ha mandato
  col nord in alto e per un'app precedente: si leggono `null`, e l'app li
  mostra col nord in alto, com'erano (test con dati sullo schema senza la
  migrazione). Nessun indice: non si cerca per inclinazione.

Migrazione `0019_run_posts.sql` (TASK-258, ADR-0222; il numero è il primo
libero in `main` al merge):

- `runs.post` (`jsonb`, facoltativa): il post della corsa come il suo
  proprietario l'ha condiviso, `{ title, results, emoji, shared_at }`
  (`API.md`, «My activities»): gli emoji con il centro come frazioni
  dell'immagine, i risultati accesi, il titolo scritto sul disegno, e
  quando. Scritto intero a ogni condivisione; **mai l'immagine**, che si
  rifà da questi dati e dalla corsa. Letto solo con la corsa intera.
- **Assente** per ogni corsa di prima e per una corsa mai condivisa: si
  legge `null`. Nessun indice: non si cerca per post. Cade con la corsa
  (è una colonna sua) e con l'account.

Migrazione `0020_moderation.sql` (TASK-121, ADR-0228; il numero è il primo
libero in `main` al merge):

- `blocks`: `blocker_id` e `blocked_id` (tutti e due `ON DELETE CASCADE`
  su `users`, chiave la coppia, mai sé stessi), `created_at`. Una riga per
  coppia, in un senso: **basta una delle due righe** perché i due non si
  vedano (`follows.apart_sql` la cerca nei due sensi; un indice su
  `blocked_id` per il senso inverso). Sbloccare cancella la riga.
- `reports`: `id` (uuid casuale), `reporter_id` (`ON DELETE CASCADE`),
  `kind` (`drawing`, `comment` o `user`), `target_id` (l'id del disegno o
  del commento, il `public_id` dell'iscritto), `reason` (`spam`,
  `offensive`, `harassment`, `sexual`, `other`; lo stesso elenco del
  codice e di `shared-types`), `created_at`. **Unica la terna**
  `(reporter_id, kind, target_id)`: segnalato di nuovo, la riga prende il
  motivo e l'ora nuovi. **Nessuna chiave esterna** su `target_id`: la
  segnalazione resta anche se il disegno, il commento o l'account
  spariscono. Indice su `(kind, target_id)` per leggere le segnalazioni
  di una cosa. Nessun endpoint le legge (ADR-0228): si leggono nel
  database.
- Cancellare un account cancella i suoi blocchi, fatti e ricevuti, e le
  sue segnalazioni; le segnalazioni degli altri su di lui restano.

Migrazione `0021_push_tokens.sql` (TASK-262 parte A, ADR-0226; il numero
è il primo libero in `main` al merge):

- `push_tokens`: `token` (il token Expo, `ExponentPushToken[…]`, chiave),
  `user_id` (`ON DELETE CASCADE` su `users`), `platform` (`ios` o
  `android`), `language` (`en`, `de`, `it`, `es`, `fr`, o `NULL`: le
  notifiche in inglese), `updated_at` (l'ultima volta che l'app l'ha
  mandato). Un indice su `user_id`: i telefoni di un destinatario.
- **Una riga per token, un account per token**: il token è la chiave, e
  un altro account che lo manda (il telefono ha cambiato mano) prende la
  riga (`ON CONFLICT … DO UPDATE`). Un account ha tante righe quanti
  telefoni.
- Si cancella con `DELETE /me/push-token/{token}` (interruttore spento,
  uscita dall'account), quando Expo dice il token morto
  (`DeviceNotRegistered`) e con l'account. È **l'unico dato che lascia il
  server per un terzo**: il token, con il testo della notifica, va al
  servizio push di Expo, che lo passa ad Apple o a Google.

Migrazione `0022_away_email.sql` (TASK-284, ADR-0244; il numero è il primo
libero in `main` al merge):

- `users.notify_away` (`boolean NOT NULL DEFAULT true`): «Email when I'm
  away» di «Settings». **Acceso** per ogni account, quelli di prima
  compresi (scelta dell'utente: tutti gli iscritti); lo spengono
  `away_email: false` all'iscrizione, `PUT /me/notifications` e il link
  della email. In `GET /me` è `notifications.away`.
- `users.away_emailed_at` (`timestamptz`, facoltativa): l'ultima email di
  ritorno. Un account la riceve di nuovo solo quando l'app è stata usata
  dopo (`sessions.last_used_at` più recente di questa data).
- `users.language` (`en`, `de`, `it`, `es`, `fr`, o `NULL`): la lingua
  dell'app all'iscrizione, per i testi delle email; `NULL` per gli account
  di prima, e allora vale quella del telefono (`push_tokens.language`) o
  l'inglese.
- Nessun indice: il giro di ogni giorno legge tutti gli account con
  `notify_away` una volta. **L'indirizzo email lascia il server per un
  terzo**, Resend, solo dentro un'email di ritorno (ADR-0244).

## Come si memorizza una traccia

In PostGIS, non come GPX su un disco: le domande «vicino a me» si fanno
nel database; il taglio dei 200 m nell'API, in metri. Una corsa salvata
ha due linee: quella intera in `runs`, che vede solo il proprietario
(TASK-172), e quella tagliata in `drawings`, calcolata quando la titola o
la pubblica, che vedono gli altri (TASK-117). Gli orari stanno nella
coordinata M della traccia intera. Il GPX si scrive al volo quando serve.

## Copie di sicurezza

Da TASK-122 (ADR-0123, `DEPLOY.md` F.13): `pg_dump` ogni notte sul
server, nel servizio `backup` di `deploy/compose.yaml`, in
`data/backups/`, 13 giorni tenuti; mezz'ora dopo il servizio `offsite` le
manda in uno Storage Box Hetzner, separato dal server (scelta dell'utente,
aggiornamento del 2026-10-02), dove restano le stesse: quelle con più di
13 giorni spariscono anche lì. Così un account cancellato è fuori da ogni
copia entro 14 giorni. Senza Storage Box le copie restano sul server.
`backup.sh check` prova che una copia si ripristina, in un database a
parte; il ripristino vero è in `DEPLOY.md` F.13. ADR-0115 le voleva
nell'Object Storage di Oracle, che non c'è più (l'API è su Hetzner,
ADR-0111).

## Privacy dei dati di posizione

- Agli altri iscritti una corsa arriva solo pubblicata e tagliata, senza
  orari, pause né il percorso pianificato (TASK-117); un
  percorso consigliato parte dal punto mostrato, mai da quello vero, e non
  dice chi l'ha chiesto (ADR-0114).
- Senza account non si legge niente degli iscritti.
- Nel database non ci sono indirizzi IP; i log dell'API non hanno
  posizioni (ADR-0092).
- Cancellare l'account cancella tutto, subito; le copie di sicurezza lo
  perdono entro 14 giorni.
- Una corsa va a Strava solo quando il suo proprietario lo chiede, e solo
  all'atleta che lui ha collegato (TASK-187); a Strava si chiede il solo
  permesso di aggiungere attività, niente in lettura.
- Età minima 16 anni.
