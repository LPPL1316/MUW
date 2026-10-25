# TASK-262 — Le notifiche inviate davvero: push, email, amici dalla rubrica

**Stato**: Parte A Done (2026-10-10, PR #451) · C Done (2026-10-25, PR #461) · B In revisione (PR #550)
**Fase**: 4 · **Branch**: `feat/TASK-262-a-push` (parte A)
**Dipende da**: TASK-185 (i due interruttori), TASK-211 (follow),
TASK-119 (reazioni), TASK-120 (commenti), TASK-208 (tag), TASK-121
(bloccare: i ganci della parte A entrano dopo di lui)
**ADR**: ADR-0226

## Obiettivo

Gli interruttori «Email notifications» e «Push notifications» di
«Settings» (TASK-185) mandano davvero qualcosa. Scelte dell'utente del
2026-10-07, tre parti in quest'ordine:

- **A — push**: `expo-notifications` nell'app e il servizio push di Expo
  sul server. Questa parte.
- **B — email**: con Resend. La chiave di Resend la crea e la scrive
  **l'utente** in `/root/shaperoute/.env` sul server, mai un agente;
  `.env.example` aggiornato con il nome della variabile.
- **C — amici dalla rubrica**: `expo-contacts` e i numeri confrontati
  come hash. Serve un **nuovo sì esplicito dell'utente** prima di
  cominciare.

**Cosa si notifica** (scelta dell'utente, la stessa lista per ogni
canale): una richiesta di follow e un nuovo follower, una reazione, un
commento, un tag in un post. L'interruttore «Push notifications» di
TASK-185 resta l'unico acceso/spento del canale push; «Email
notifications» lo sarà per l'email.

## Contesto da leggere

- `docs/tasks/TASK-185.md` (i due interruttori e i loro «Seguiti»)
- `docs/API.md` («Notifications», «Push notifications», «Follow»,
  «Comments», «Reactions», «Drawings»), `docs/DATABASE.md`, `docs/UI.md`
  («Settings», «Notifications»)
- ADR-0206 (gli interruttori), ADR-0226 (questo task)

## Parte A — push (in dettaglio)

### API

1. Migrazione `NNNN_push_tokens.sql` (numero: il primo libero in `main` al
   merge; oggi `0021`, dopo `0020_moderation` di TASK-121, i test la trovano per nome): tabella `push_tokens`,
   una riga per token, con l'account, la piattaforma, la lingua dell'app e
   la data.
2. `push.py` (nuovo): `PUT /me/push-token {token, platform, language?}` e
   `DELETE /me/push-token/{token}`, `204`; `install_push` in `app.py` (una
   riga). Il token passa all'account che lo manda per ultimo (il telefono
   ha cambiato mano); il `DELETE` toglie solo il proprio.
3. `expo_push.py` (nuovo): l'invio a `https://exp.host/--/api/v2/push/send`
   con `urllib` della libreria standard, come `strava_client.py` (nessuna
   dipendenza Python nuova), a gruppi di 100; le ricevute
   (`getReceipts`) lette 15 minuti dopo; un token che Expo chiama
   `DeviceNotRegistered`, subito o nella ricevuta, si cancella.
4. L'invio è **fuori dalla richiesta**: la richiesta che scrive l'evento
   legge solo, con una query, a chi mandare cosa; la rete la fa un thread
   (`ThreadPoolExecutor` di un posto). Si manda solo se il destinatario ha
   `notify_push` acceso, non è chi ha agito, nessuno dei due ha bloccato
   l'altro (TASK-121) e, per un disegno, il destinatario lo vede. Lo
   stesso evento al massimo una volta al giorno (una richiesta rifatta,
   una reazione cambiata).
5. **I ganci**, come funzioni nuove in fondo ai moduli e chiamate dopo la
   scrittura: `follows.py` (richiesta, richiesta accettata),
   `reactions.py`, `comments.py` e il tag, che non sta in `activities.py`
   ma in `drawings.py` (`PUT /me/activities/{key}/drawing`, `Drawings.keep`).
   **Entrano come ultimo commit dopo «121 in main»** (condizione del
   coordinatore: TASK-121 tocca gli stessi file), con il controllo dei
   bloccati sulla tabella di TASK-121.
6. **I testi** sono nella lingua che l'app manda con il token; senza,
   inglese. **Cosa sa l'API della lingua**: niente, prima di questo task
   (la lingua dell'app sta solo sul telefono, ADR-0172); da qui la sa per
   telefono, nella riga del token, e solo per le push. L'email della parte
   B dovrà decidere da dove prenderla.

### App

1. Dipendenza nuova **`expo-notifications`** (`~57.0.20`, quella dell'SDK
   57; il sì dell'utente del 2026-10-07): porta con sé `expo-application`
   e `badgin`. Il plugin in `app.json` con l'icona monocroma dell'app e il
   colore `color.accent` di `src/theme/tokens.ts` (un test li tiene
   uguali).
2. Il permesso del telefono si chiede **solo all'accensione di «Push
   notifications»**, mai all'avvio (la regola di TASK-185: il permesso
   quando c'è qualcosa da mandare, e ora c'è). Negato: l'interruttore resta
   spento, sotto c'è il motivo e «Open Settings» (TASK-259).
3. Con l'interruttore acceso e il permesso dato: `getExpoPushTokenAsync`
   con il `projectId` EAS di `app.json`, poi `PUT /me/push-token`. **Una
   volta per telefono**: l'app ricorda nel portachiavi token, account e
   lingua mandati, e rimanda solo se uno dei tre cambia.
4. Spento l'interruttore: `DELETE /me/push-token/{token}`. All'uscita
   dall'account: il `DELETE` del token prima di `DELETE /session`.
   Cancellato l'account: il server cancella i token con lui.
5. Il tocco su una notifica apre il disegno (reazione, commento, tag) o il
   profilo di chi ha agito (richiesta, richiesta accettata), anche quando
   la notifica apre l'app. Passa da `ProfileLayer` con le porte che ha già
   (niente `App.tsx`, niente `src/feed/*`).
6. La nota sotto gli interruttori e le due righe di «Help» e «Privacy»
   riscritte: le push partono, l'email non ancora (fino alla parte B).

### La prova

**Expo Go non riceve le push dall'SDK 53**: lì `getExpoPushTokenAsync`
non dà un token, e l'app non manda niente senza dire nulla. La prova
vera è una **build nativa sull'iPhone** (non fatta in questo task).
**Cosa prova jest invece**: il permesso chiesto solo dall'interruttore e
una volta sola, il token mandato una volta per telefono e di nuovo solo
per un altro account, token o lingua, ritirato allo spegnimento e
all'uscita, il tocco che apre il disegno o il profilo (anche quello che
apre l'app, una volta sola). **Cosa prova pytest**, con il database vero
ed Expo finto: token tenuti e tolti, un invio esatto per evento, nessuno
con l'interruttore spento, fra bloccati o a chi ha agito, i token morti
cancellati dai biglietti e dalle ricevute.

### Criteri di accettazione (parte A)

- [x] Il token si salva e si toglie, con i test (`test_push.py`).
- [x] Una richiesta di follow, una richiesta accettata, una reazione, un
      commento e un tag producono **un solo invio** al destinatario con
      `notify_push` acceso; nessuno spento, nessuno fra bloccati, nessuno a
      chi ha agito (test con Expo finto): `test_push.py` per evento,
      `test_push_hooks.py` attraverso le rotte vere, con il blocco vero di
      TASK-121.
- [x] Una ricevuta `DeviceNotRegistered` cancella il token.
- [x] L'app chiede il permesso solo all'interruttore e manda il token una
      volta per telefono.
- [x] Testi nuovi mostrati all'utente nelle cinque lingue, prima del
      merge: confermati il 2026-10-08 («i testi vanno bene»); fra questi
      c'è «{name} accepted your follow request.» per il nuovo follower.
      Il 2026-10-09 l'utente li ha riletti nella sessione «Scelte prodotto
      prioritarie» e li ha approvati con una modifica, in italiano e neutra
      rispetto al genere: «{name} ha accettato la tua richiesta di
      follow.» al posto di «… di seguirlo.» (fatta in `push.py`).
      Le righe di «Help» e «Privacy» in tedesco, spagnolo e francese sono
      traduzioni dell'agente dell'inglese approvato, aggiunte al
      riallineamento con `main` dopo la #453: non erano nel file letto
      dall'utente. La sessione «Scelte prodotto prioritarie» gliele ha
      mostrate così come sono su #451, e l'utente le ha approvate il
      2026-10-09 («Sì, vanno bene»). **Tutti i testi della parte A sono
      approvati dall'utente, nelle cinque lingue.**
- [ ] Test verdi in API e app.

### File toccati (parte A)

```
services/api/migrations/0021_push_tokens.sql      (nuovo; numero al merge)
services/api/shaperoute_api/push.py               (nuovo)
services/api/shaperoute_api/expo_push.py          (nuovo)
services/api/shaperoute_api/app.py                (install_push)
services/api/shaperoute_api/notifications.py      (docstring: le push partono)
services/api/tests/test_push.py                   (nuovo)
services/api/tests/test_expo_push.py              (nuovo)
services/api/tests/test_push_hooks.py             (nuovo, i cinque eventi dalle rotte)
services/api/shaperoute_api/follows.py            (ganci, dopo TASK-121)
services/api/shaperoute_api/reactions.py          (gancio, dopo TASK-121)
services/api/shaperoute_api/comments.py           (gancio, dopo TASK-121)
services/api/shaperoute_api/drawings.py           (gancio del tag, dopo TASK-121)
packages/shared-types/src/index.ts                (PushTokenRequest, PushData)
packages/shared-types/fixtures/push-token-request.json   (nuovo)
packages/shared-types/fixtures/push-data.json            (nuovo)
packages/shared-types/test/push.test.ts                  (nuovo)
apps/mobile/package.json, package-lock.json       (expo-notifications)
apps/mobile/app.json                              (il plugin)
apps/mobile/__mocks__/expo-notifications.ts       (nuovo)
apps/mobile/src/api/pushToken.ts (+ test)         (nuovi)
apps/mobile/src/notifications/*                   (nuovi, con i test)
apps/mobile/src/account/useAccount.ts             (uscita: il token prima)
apps/mobile/src/account/signOutPush.test.ts       (nuovo)
apps/mobile/src/settings/NotificationsSetting.tsx (+ test)
apps/mobile/src/settings/notificationFields.ts
apps/mobile/src/screens/ProfileLayer.tsx          (una chiamata)
apps/mobile/src/social/drawingsDoor.ts            (open vuole solo l'id)
apps/mobile/src/screens/FeedScreenPosts.test.tsx  (il tipo di open finto)
apps/mobile/src/profile/SettingsPage.test.tsx     (la nota nuova, il telefono finto)
apps/mobile/src/about/content/en.ts, it.ts, de.ts, es.ts, fr.ts
                                                  (solo le righe delle notifiche)
site/privacy/index.html, it/, de/, es/, fr/index.html
                                                  (rifatte con site/tools/make_privacy.mjs)
apps/mobile/src/about/documents.test.ts
apps/mobile/src/i18n/de.ts, es.ts, fr.ts, it.ts
docs/API.md, docs/DATABASE.md, docs/UI.md
docs/DECISIONS.md (ADR-0226), docs/STATUS.md
docs/tasks/TASK-262.md                            (nuovo)
```

### Fuori scope della parte A

- L'email (parte B) e la rubrica (parte C).
- Le push in Expo Go; una build nativa per provarle (dell'utente o del
  coordinatore).
- Il token di accesso di Expo («enhanced push security»): oggi spento,
  quindi nessuna variabile nuova nel `.env`.
- Uscire dall'account **senza rete**: il telefono dimentica il token ma
  il server lo tiene per l'account uscito finché un altro account entra
  sullo stesso telefono o Expo lo dice morto. Accettato.
- Ritentare un invio che Expo non ha preso (rete giù, `5xx`): si scrive
  nel log e si perde.

## Parte B — email (In revisione, PR #550)

Resend per le stesse cinque notizie con «Email notifications» acceso.
All'inizio c'erano anche la conferma dell'email e la password dimenticata
(TASK-114, TASK-183); la lingua, il mittente e il dominio erano da
decidere.

### Le scelte dell'utente (2026-10-25)

- **La conferma dell'email e la password dimenticata vanno in un task a
  parte**, subito («a parte SUBITO»): **TASK-300**, sessione «Email
  confirmation and forgotten password».
- **Un riassunto al giorno**, non un'email per evento: al massimo una email
  al giorno per account, solo nei giorni con qualcosa. La push resta
  l'avviso subito. L'utente aveva risposto prima «B» (un'email per evento),
  poi ha corretto: «ho sbagliato anche alla precedente domanda usa il
  metodo A».
- **La lingua come l'email di ritorno** («A»): quella dell'iscrizione
  (`users.language`, TASK-284 A), poi quella del telefono con le push,
  poi l'inglese.
- Il mittente e il dominio sono quelli di TASK-284: `MuW <hello@getmuw.app>`.
- **I testi nuovi**, nelle cinque lingue (oggetto, titolo, «…and N more»,
  il perché in fondo, la pagina del link), **approvati**: «sì vanno bene»
  (2026-10-25). Le righe delle notizie sono le push della parte A, già
  approvate.

### Cosa fa (API, PR #550)

- `push.py`: il `Pusher` ha dei listener, chiamati per ogni evento che
  lascia passare (non il proprio, una volta al giorno). Le push non
  cambiano (test).
- `notice_email.py` (nuovo): tiene i cinque eventi in `email_notices`
  (migrazione `0028_email_notices.sql`, numero da controllare al merge)
  solo per chi ha l'interruttore acceso. Ogni giorno alle 18:00 UTC
  (`NOTICE_EMAIL_AT`) un giro manda a ogni account una email con quello che
  è ancora vero, mai attraverso un blocco né da ciò che è stato nascosto
  da una segnalazione (TASK-291). Una email al giorno al massimo anche con
  due giri insieme o dopo un riavvio (presa con `users.notices_emailed_at`).
  Resend che rifiuta restituisce il giorno. Le righe vanno via con l'email,
  dopo 7 giorni o con l'interruttore spento. Il thread si ferma prima che
  la fine dell'app chiuda il pool.
- `notice_texts.py` (nuovo): le parole. `away_email.StopLinks` ha uno scopo
  nell'HMAC, così il link di un'email non spegne l'altra. Pagina
  `/notice-email/stop` senza chiave dell'API.

### Criteri di accettazione (parte B)

- [x] Le cinque notizie di un giorno arrivano in una email sola, le più
      recenti prima, nella lingua dell'account (`test_notice_email.py`).
- [x] Con l'interruttore spento non si tiene niente; ciò che non è più vero
      (richiesta ritirata, reazione tolta, commento cancellato, blocco,
      disegno non più visibile, contenuto nascosto) resta fuori.
- [x] Una email al giorno al massimo, anche con due giri insieme e dopo un
      riavvio; una rifiutata si riprova; le righe vecchie vanno via.
- [x] Il link chiede prima e spegne solo col pulsante; il link dell'email
      di ritorno non spegne questa.
- [x] Il giro si ferma fra due email quando l'app finisce, prima della
      chiusura del pool.
- [x] Le push senza listener come prima.
- [x] Testi nuovi approvati dall'utente nelle cinque lingue.
- [ ] Test verdi in CI.

### File toccati (parte B)

```
services/api/migrations/0028_email_notices.sql   (nuovo; numero al merge)
services/api/shaperoute_api/notice_email.py      (nuovo)
services/api/shaperoute_api/notice_texts.py      (nuovo)
services/api/shaperoute_api/push.py              (i listener)
services/api/shaperoute_api/away_email.py        (StopLinks con lo scopo; time_of_day)
services/api/shaperoute_api/access.py            (OPEN_PATHS)
services/api/shaperoute_api/__main__.py          (crea, installa, avvia)
services/api/shaperoute_api/notifications.py     (docstring)
services/api/tests/test_notice_email.py          (nuovo)
packages/shared-types/src/index.ts               (il commento di Notifications)
.env.example                                     (NOTICE_EMAIL_AT)
docs/API.md, docs/DATABASE.md, docs/DEPLOY.md
docs/DECISIONS.md (aggiunta ad ADR-0226), docs/STATUS.md
docs/tasks/TASK-262.md
```

### Prima di accenderla

La nota di «Settings» («MuW does not send emails yet»), l'help e la
privacy che nomina Resend cambiano con la **parte B di TASK-284**, una
volta sola per le tre email (ritorno, segnalazioni, notizie). Poi il
server, dal Coordinatore dopo l'approvazione di Apple e col sì
dell'utente: si accende con l'email di ritorno (`DEPLOY.md`).

## Parte C — amici dalla rubrica (Done)

**Branch** `feat/TASK-262-c-contacts`, PR #461 · ADR-0226 (aggiunta).
**Scelte dell'utente**: il 2026-10-07 l'ordine A push → B email → C
rubrica, con `expo-contacts` e i numeri come hash; il **2026-10-08** ha
scelto C (e non B per ora), che è il suo **sì esplicito alla dipendenza
`expo-contacts` e alla ricerca dalla rubrica**; il **2026-10-09** «i
testi vanno bene, interesse legittimo ok»: i nove testi nelle cinque
lingue, la domanda di iOS solo in inglese e la privacy con il confronto
dei numeri sotto l'interesse legittimo; il **2026-10-10** «sì, va bene il
10 ottobre»: la privacy finale con la data del 10 ottobre 2026, unita ai
testi di TASK-267 B, della parte A e di TASK-269. La **1.0 dello store esce senza
rubrica** (scelta dell'utente del 2026-10-09): la PR entra dopo che la
build 5 è partita, poi va su preview; su production con una 1.0.1.

### Cosa fa

- **App**: in «Find friends», sotto la ricerca per nome, «FROM YOUR
  CONTACTS» con «Find friends in your contacts». Il permesso della
  rubrica si chiede **solo a quel tocco**. L'app legge solo i numeri, li
  scrive in E.164 con il prefisso della regione del telefono, ne fa lo
  SHA-256 e li manda 500 per volta (al più 10 richieste); gli iscritti
  trovati hanno foto, nome (apre il profilo) e «Follow». In un'app
  costruita senza `expo-contacts` (la 1.0 dello store) la sezione non si
  vede: il modulo si carica solo al primo uso e solo se il binario lo ha
  (richiesta del coordinatore del 2026-10-10). `UI.md`.
- **API**: `POST /people/from-contacts {hashes}` (`contact_people.py`):
  confronto con lo SHA-256 di `users.phone`, mai chi chiede, mai fra
  bloccati nei due versi, solo chi ha salvato un numero; 30 richieste
  all'ora per account; **gli hash ricevuti non si tengono e non si
  scrivono in nessun log**. `API.md`, «People from the contacts».
- **Privacy** (cinque lingue, le pagine di `site/privacy/` rigenerate):
  la sezione «Friends from your contacts» e la frase onesta che l'hash di
  un numero si inverte provando tutti i numeri, quindi la protezione vera
  è che il server non tiene niente. La data è quella del merge.

### La prova

- **jest**: SHA-256 contro lo standard e contro Node; E.164 in tanti modi
  di scrivere (spazi, trattini, parentesi, «00», «+», interni, segni di
  direzione) e paesi; gli hash che escono, ognuno una volta, mai il
  numero; il permesso solo al tocco; «Follow» com'è; nessun numero, un no,
  un no per sempre, un'API senza l'endpoint, la sessione finita.
- **pytest** (database vero, `test_contact_people.py`, 11 test): un
  numero salvato trova l'account (anche salvato come «0039 333 123
  4567»), un numero di nessuno non trova niente, mai sé stessi, il blocco
  nei due versi, **gli hash assenti da ogni tabella, dai log e dal
  registro delle richieste**, il limite all'ora, `401` senza token.
- **Nel simulatore** (2026-10-10, iPhone 17e, Expo Go SDK 57, l'API del
  branch su un PostGIS usa e getta, tre contatti con `simctl addmedia`:
  «333 123 4567», «0039 0461 123456», «+39 347 000 0000», più i sei di
  esempio): aprendo «Find friends» nessuna domanda; la domanda solo al
  tocco (il testo è quello di Expo Go: quello di MuW si vede solo in una
  build nativa), poi «Share All / Select Contacts» di iOS 18; trovati
  Ada_runs e Bea_trento con «Follow», il numero di nessuno niente;
  «Follow» → «Requested»; nel log dell'API solo `POST
  /people/from-contacts 200`, nessun hash, e nessuno nel `pg_dump`.
  Visto: la tastiera del campo del nome resta aperta (il suo `autoFocus`
  di TASK-215) e copre una lista lunga finché non si trascina.

### Criteri di accettazione (parte C)

- [x] Un contatto con il numero di un account lo trova, scritto con o
      senza spazi e prefisso (jest, pytest, simulatore).
- [x] Un numero di nessuno non trova niente.
- [x] Gli hash ricevuti non sono nel database né nel log delle
      richieste (test).
- [x] Un account bloccato non compare mai, nei due versi (test).
- [x] Il permesso si chiede solo al tocco (test, simulatore).
- [x] Testi nuovi mostrati all'utente nelle cinque lingue e approvati
      (2026-10-09).
- [x] Test verdi in API e app (CI 6/6 del 2026-10-10).
- [x] L'impronta iOS della 1.0 resta `83793e26`, misurata su una copia
      pulita con `npm ci` (2026-10-25).

### File toccati (parte C)

```
apps/mobile/package.json, package-lock.json         (expo-contacts)
apps/mobile/app.json                                (plugin, contactsPermission)
apps/mobile/__mocks__/expo-contacts.ts              (nuovo)
apps/mobile/src/contacts/*                          (nuovi: sha256, phoneNumbers, contactHashes, phoneContacts, con i test)
apps/mobile/src/api/contactsPeople.ts (+ test)      (nuovi)
apps/mobile/src/social/ContactsFriends.tsx (+ test) (nuovi)
apps/mobile/src/screens/PeopleScreen.tsx
apps/mobile/src/i18n/de.ts, es.ts, fr.ts, it.ts     (righe in fondo)
apps/mobile/src/about/content/*.ts                  (privacy)
apps/mobile/src/about/AboutPage.test.tsx, documents.test.ts
site/privacy/**/index.html                          (rigenerate da make_privacy.mjs)
site/tests/privacy.test.mjs                         (la data; ok del coordinatore)
packages/shared-types/src/index.ts
packages/shared-types/fixtures/contacts-people.json, contacts-people-request.json   (nuovi)
packages/shared-types/test/contactsPeople.test.ts   (nuovo)
services/api/shaperoute_api/contact_people.py       (nuovo)
services/api/shaperoute_api/app.py                  (install_contact_people)
services/api/tests/test_contact_people.py           (nuovo)
docs/API.md, docs/UI.md, docs/STATUS.md, docs/DECISIONS.md (ADR-0226, aggiunta)
docs/tasks/TASK-262.md                              (questa sezione)
```

### Dove si è (2026-10-10)

PR #461 **pronta** (CI 6/6, CLEAN, allineata a `main` dopo la #482), ma
**ferma per scelta del coordinatore fino all'approvazione di Apple della
1.0** (1–2 giorni): l'app chiamerebbe un endpoint che il server non ha
ancora, e il server e la privacy pubblica non si toccano durante la
revisione. Dopo l'approvazione: il coordinatore chiede all'utente l'ok
per il server → «merge 461» → server (`contact_people.py`, nessuna
migrazione), copia F.14 del sito, pubblicazione su preview; più avanti la
1.0.1 nativa con `expo-contacts`.

Per chi riprende:

1. Se `main` mette la PR in conflitto: unire `origin/main` tenendo tutte
   le voci (le righe nuove di `i18n/*` dopo quelle di `main`, le voci di
   STATUS e DECISIONS di tutti), poi `node site/tools/make_privacy.mjs`.
2. **La data della privacy** è quella del merge: l'utente ha approvato il
   10 ottobre 2026. Se il merge è un altro giorno, cambiare le cinque
   `PRIVACY_UPDATED` di `about/content/*.ts`, `AboutPage.test.tsx`,
   `documents.test.ts` e `site/tests/privacy.test.mjs`, rigenerare
   `site/privacy/` e **richiedere il sì dell'utente su quella data**.
3. Merge solo dopo il «merge 461» del coordinatore, poi questa parte a
   Done, la voce in «Completato» di STATUS e «TASK-262 C fatto».

### Dove si è (2026-10-25)

Il 2026-10-25 l'utente ha chiesto di portare la #461 in `main` («fallo»),
salvo l'impronta della build. Fatto:

- **`origin/main` unito** (`7a4bbef8`, 173 commit dal 2026-10-10):
  conflitti solo in `i18n/de, es, fr, it` (le righe di `main` di TASK-280,
  281, 285 B, 292, 295, 296, poi le nostre), `shared-types/src/index.ts`
  (i tipi del gioco di TASK-296, poi i nostri), `app.py`
  (`install_game`, poi `install_contact_people`) e `STATUS.md` (tutte e
  due le voci). Privacy, `package.json`, `package-lock.json`, `app.json`,
  `PeopleScreen.tsx` e `contact_people.py` uniti senza conflitti; in
  `main` la privacy non era cambiata dal 10 ottobre, e «Find friends» si
  apre ancora dalla lente di «Feed», come dice il testo.
- **Data della privacy**: 25 ottobre 2026 nelle cinque `PRIVACY_UPDATED`,
  in `AboutPage.test.tsx`, `documents.test.ts`, `site/tests/privacy.test.mjs`
  e nelle pagine di `site/privacy/` rigenerate (`2556ba5e`). «Terms» resta
  al 10 ottobre. Se il merge avviene un altro giorno, la data va spostata
  di nuovo allo stesso modo.
- In locale verdi: jest (443 suite, 3596 test), lint, typecheck,
  `format:check`, i test del sito (43).
- **L'impronta iOS cambia**, misurata in due worktree puliti con `npm ci`
  (DEPLOY A.7): `main` (`88b63b6e`) dà `83793e26fc0d…` (quella della 1.0
  in revisione), questo branch `9337973a0af4…`. Cambiano
  `expoAutolinkingConfig:ios`, `expoConfig` (il plugin con
  `contactsPermission`) e i file nativi di `expo-contacts`. Con questa PR
  in `main`, un `eas update` di production da `main` non raggiungerebbe più
  la 1.0. Quindi **niente merge**: domanda all'utente.
- **Una terza strada, misurata**: con `expo-contacts` escluso dalla build
  nativa (`"expo": {"autolinking": {"exclude": ["expo-contacts"]}}` in
  `apps/mobile/package.json`) e senza il suo plugin in `app.json`,
  l'impronta torna `83793e26`. Il pacchetto JS resta, quindi Metro lo
  trova; nella 1.0 il modulo nativo manca e la sezione non si vede (come
  già previsto, `phoneContacts.ts`); in Expo Go c'è. Alla build 1.0.1 si
  toglie l'esclusione e si rimette il plugin. Non applicata: aspetta la
  scelta dell'utente.
- **Scelta dell'utente, 2026-10-25: «vai con la c»** (consigliata anche
  dal coordinatore, con le due condizioni: la sezione nascosta senza il
  modulo nativo, già provata da `ContactsFriends.test.tsx` e
  `phoneContacts.test.ts`; il promemoria qui sotto). Applicata: esclusione
  in `apps/mobile/package.json`, plugin tolto da `app.json` (ora uguale a
  quello di `main`), `package-lock.json` invariato. ADR-0226, aggiunta del
  2026-10-25. Le righe gemelle in `tasks/TASK-152.md` e `tasks/TASK-294.md`
  le mettono il coordinatore e la sessione di Google Play, padroni di quei
  file.

### Alla prossima build nativa (promemoria)

Finché `expo-contacts` è escluso, nessuna build lo contiene e la ricerca
dalla rubrica non si vede. Prima della **1.0.1 iOS** e della **prima build
Android di TASK-294 B**:

1. in `apps/mobile/package.json` togliere il blocco
   `"expo": {"autolinking": {"exclude": ["expo-contacts"]}}`;
2. in `apps/mobile/app.json`, in fondo a `plugins`, rimettere:

   ```json
   [
     "expo-contacts",
     {
       "contactsPermission": "MuW reads only the phone numbers of your contacts, when you tap «Find friends in your contacts», to find friends who are on MuW. The numbers leave the phone coded and the server keeps none."
     }
   ]
   ```

3. misurare l'impronta (DEPLOY A.7): cambia, ed è giusto così. Da quel
   momento gli update di production arrivano solo alla build nuova, che
   passa dalla revisione di Apple.

### Fuori scope della parte C

- La domanda di iOS nelle cinque lingue (oggi solo inglese, come le
  altre).
- Una colonna con l'hash in `users` per molti account.
- La tastiera aperta di «Find friends» sopra la lista (comportamento di
  TASK-215).

## Esito

**Parte C fatta il 2026-10-25**: PR #461, in `main` con `expo-contacts`
escluso dalla build nativa (scelta dell'utente), così l'impronta iOS
resta `83793e26` e gli update arrivano ancora alla 1.0. Privacy datata 25
ottobre 2026 nelle cinque lingue e sul sito; test verdi in app, sito,
contratto e API. La ricerca dalla rubrica si vede su preview (Expo Go);
nelle build dello store solo dopo il «promemoria» della parte C.
**Restano** (del coordinatore, con l'ok dell'utente): il server con
`contact_people.py` (nessuna migrazione), la copia del sito (F.14), la
pubblicazione su preview.

**Parte A fatta il 2026-10-10**: PR #451, in `main` con il merge
`578c2f7e` (dopo TASK-121, #457, e #475). Le push partono: tabella
`push_tokens` (migrazione `0021_push_tokens.sql`), `PUT`/`DELETE
/me/push-token`, invio con Expo fuori dalla richiesta, i cinque eventi
dai loro moduli con i blocchi di TASK-121, i token morti cancellati;
nell'app `expo-notifications`, il permesso solo all'interruttore, il
token una volta per telefono, il tocco che apre il disegno o il
profilo. Testi approvati dall'utente nelle cinque lingue. In locale
verdi tutta la parte JS, i test del sito e i test dell'API senza
database; quelli con il database (`test_push_hooks.py` compreso) sono
passati in locale prima che il disco di Docker si riempisse, e nella CI.
**Restano**: il server con la `0021` e la pubblicazione (del
coordinatore, con l'ok dell'utente); la prova vera con una build nativa
sull'iPhone (Expo Go non riceve push); `npm install` nel checkout
principale (`expo-notifications` non c'è ancora). Parti B e C Todo.

Quanto segue è il diario della parte A mentre aspettava TASK-121.

**Parte A in lavorazione**, sessione chiusa il 2026-10-09 su richiesta
dell'utente. Dove si è arrivati:

- PR #451 in **bozza** sul branch `feat/TASK-262-a-push` (worktree
  `.claude/worktrees/TASK-262`), allineata a `main` del 2026-10-09
  (merge `43d05a4f`), tutto spinto. API, app, contratto e documenti sono
  fatti; testi approvati dall'utente nelle cinque lingue (sopra).
- In locale verdi: tutta la parte JS (358 suite), `test_push.py`,
  `test_expo_push.py`, `test_notifications.py`, `test_accounts.py`,
  `test_contract.py`, i test del sito.

**Da dove riprendere**, dopo il «121 in main» del coordinatore (TASK-121
è la PR #457, con la migrazione `0020_moderation.sql`):

1. **Già fatto il 2026-10-10**, su un branch **locale** `local/262-hooks`
   del worktree (non spinto: dentro c'è la #457 unita a mano): la
   migrazione rinominata `0021_push_tokens.sql`; i ganci in fondo a
   `follows.py`, `reactions.py`, `comments.py`, `drawings.py`, chiamati
   dopo la scrittura (gli aiuti `notify_account`, `notify_owner`,
   `tagged_before`, `notify_tagged` in `push.py`); `Pusher.blocked` =
   `blocked_between` con `follows.apart_sql`; `test_push_hooks.py` (sei
   test attraverso le rotte, il blocco vero compreso); i documenti.
2. Al «121 in main»: `git switch feat/TASK-262-a-push`, unire
   `origin/main`, poi portare l'ultimo commit di `local/262-hooks` (quello
   dei ganci) con `git cherry-pick`; ricontrollare che `0021` sia ancora il
   primo numero libero dopo `0020_moderation`.
3. Test: i file dell'API toccati (`test_push*`, `test_follows`,
   `test_reactions`, `test_comments`, `test_drawings`, `test_moderation`,
   `test_feed`, `test_contract`), tutta la parte JS, i test del sito; la
   suite intera dell'API va alla CI.
4. PR fuori bozza; al verde «#451 pronta» al coordinatore, ricordando che
   la prova vera è solo con una build nativa; merge solo dopo il suo
   «merge 451». Poi il server (migrazione) è del coordinatore, con l'ok
   dell'utente.

In locale il worktree ha in `node_modules` cartelle vere per
`expo-notifications`, `expo-application`, `badgin`,
`expo-image-manipulator`, `expo-task-manager`, `unimodules-app-loader`,
che il checkout principale non ha ancora; dopo il merge serve `npm
install` nel checkout principale.
