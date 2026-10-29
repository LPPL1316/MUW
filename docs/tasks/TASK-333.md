# TASK-333 — Gli allegati nei messaggi privati: un disegno, una foto, un video

**Stato**: Done · 2026-10-29 · parti A–D in `main` (#634, #635, #636,
#639); la parte E (expo-video nei messaggi) al taglio della 1.0.2. Le
sette scelte e i testi sono dell'utente (2026-10-29)
**Fase**: 4 · **Branch**: `docs/TASK-333-message-attachments` (documenti),
poi una PR per parte
**ADR**: ADR-0289 (con l'aggiunta della parte D) · **Migrazione**: il primo numero libero in
`main` al merge della parte A (per il Coordinatore oggi `0038`)
**Numeri**: TASK-333 / ADR-0289, **assegnati dal Coordinatore** il
2026-10-29.

## Obiettivo

Nei messaggi privati (TASK-319, ADR-0279) un messaggio porta anche **un
allegato**: un disegno (un percorso o una corsa, da aprire sulla mappa e
da correre), una foto o un video. Richiesta dell'utente del 2026-10-29:
«Aggiungi la possibilità di inviare disegni agli amici allegati, foto
video».

## Vincoli (dal Coordinatore e dalla sessione che ha aperto il task)

- **Impronta iOS `83793e26`**: niente moduli nativi né dipendenze nuove.
  Quello che serve c'è già: `expo-image-picker` (foto e video dalla
  galleria; su iPhone riduce il video con `videoExportPreset`),
  `expo-image-manipulator` (la foto ridotta, come quelle dei disegni),
  `expo-file-system` (caricare e scaricare il file), `react-native-webview`
  (il video si guarda in una WebView, come il motore e il video della
  corsa di TASK-295), `expo-sharing` (il foglio «Share»).
- **Apple 1.2**: segnalazione e blocco coprono anche gli allegati.
- **Spazio sul server limitato**: i video hanno limiti di durata, di peso,
  di quanti al giorno e di quanto restano, più un tetto per tutto il
  server.
- **Privacy** aggiornata nelle cinque lingue, col sì dell'utente.
- **Server e update `production`** solo col sì dell'utente.
- **Server vecchio**: l'allegato non si vede. Non con una sonda nuova:
  `messagesDoor.ts` smette di chiedere dopo un `404` finché l'app non si
  riapre. La pagina della conversazione dice se gli allegati ci sono
  (ADR-0289, punto 3).

## Le scelte dell'utente

Da chiedere una alla volta, ognuna con la proposta già pronta. Le
risposte si scrivono qui.

1. **Chi manda un allegato.** Proposta: solo in una conversazione aperta;
   una richiesta resta di solo testo, e foto, video e disegni arrivano
   dopo «Accept». Alternative: i disegni anche in una richiesta (foto e
   video no); tutto anche in una richiesta.
   — *Risposta (2026-10-29):* «Solo dopo «Accept»», la proposta.
2. **Quanto è lungo e pesante un video.** Proposta: fino a 30 secondi,
   ridotto sul telefono a 960 × 540 (sull'iPhone), al più 20 MB; scelto
   dalla galleria, non registrato dalla chat. Alternative: 15 s; 60 s e
   40 MB.
   — *Risposta (2026-10-29):* «60 s, 40 MB». Quindi fino a 60 secondi e
   40 MB, sempre ridotto a 960 × 540 sull'iPhone (circa 22 MB per 60 s) e
   scelto dalla galleria; Android lo manda com'è entro i 40 MB.
3. **Quanto restano sul server.** Proposta: un video 30 giorni, poi al
   suo posto «This video has expired.»; foto e disegni restano come il
   testo. Più un tetto per tutto il server: sopra, i video nuovi
   aspettano. Alternative: 7 giorni; per sempre, con il solo tetto.
   — *Risposta (2026-10-29):* «Video 30 giorni», la proposta (chiesta con
   il peso di un video da 60 s, circa 22 MB, e il tetto di 10 GB che
   regge circa 15 video al giorno).
4. **Chi riceve un disegno.** Proposta: nella conversazione una scheda
   con la mappa piccola, il nome e i km; un tocco la apre sulla mappa con
   «Start», «Export GPX», il cuore dei preferiti e «Draw it near me»
   quando la figura lo permette (ADR-0273). Alternativa: solo guardarlo e
   «Start».
   — *Risposta (2026-10-29):* «Aprirlo, correrlo, tenerlo», la proposta.
5. **Da dove si manda un disegno.** Proposta: tutti e due: «Send to a
   friend» sulla scheda di un percorso o di un disegno (il risultato di
   «Draw», «Explore», il «Feed», un profilo, «My activities», i
   preferiti), che chiede a chi; e «Drawing» nel «+» della conversazione,
   che sceglie fra i preferiti e le proprie corse. Alternative: solo
   dalla scheda; solo dalla conversazione.
   — *Risposta (2026-10-29):* «Da tutti e due», la proposta.
6. **Il resto della proposta**, in un sì solo: un allegato per messaggio,
   con un testo facoltativo; foto e video a tutto schermo con «Share» (dal
   foglio del telefono si salvano); la fotocamera nella chat solo con la
   build 1.0.1 (oggi il testo del permesso parla del contorno del
   percorso e quello del microfono dice «MuW never records sound»); le
   push «{name}: 📷 Photo», «🎬 Video», «🗺️ Drawing»; la corsa mandata
   tagliata come nel Feed (ADR-0159), un percorso progettato intero con la
   sua partenza.
   — *Risposta (2026-10-29):* «Sì, così» (l'alternativa era senza
   «Share»).
7. **I testi e la privacy** (sotto, «I testi»): in inglese da approvare,
   traduzioni dell'agente; la privacy nelle cinque lingue.
   — *Risposta (2026-10-29):* «Approvo così», sui testi dell'app, delle
   push, di «Help» e della privacy elencati sotto (con 60 s, 40 MB e 30
   giorni già dentro); la domanda diceva che le traduzioni sono
   dell'agente e che la data della privacy diventa il giorno del merge
   della parte B.

## Il disegno tecnico (deciso dall'agente su delega dell'utente)

In ADR-0289: i file di foto e video su disco e non nel database, il
caricamento in due tempi, cosa controlla il server (tipo, peso, durata
letta dall'MP4, il luogo tolto), la pagina che dice cosa si può
allegare, il messaggio di prima per un'app vecchia, il tetto e la pulizia,
la segnalazione con l'allegato nella pagina del link, la stima dello
spazio.

## Le parti

Ognuna nella sua PR e nella sua sessione, dopo il «vai» dell'utente:
A, poi B, poi C. B e C toccano la stessa conversazione
(`ConversationScreen.tsx`, `api/messages.ts`) e le tabelle `i18n`, quindi
C parte quando B è in `main`. B si prova con l'API della parte A in
locale; l'OTA aspetta il server.

### Parte A — API

1. Migrazione (il primo numero libero al merge): `message_media` (i file
   caricati: proprietario, tipo, byte, misure, durata, scadenza, il
   messaggio a cui sono legati), `messages.text` vuoto ammesso con un
   allegato, la colonna `drawing` (jsonb) del disegno.
2. `message_media.py` (nuovo): `POST /me/message-media` (il file nudo,
   `Content-Type` `image/jpeg`, `image/png`, `video/mp4` o
   `video/quicktime`), `PUT /me/message-media/{id}/poster`, `GET
   /message-media/{id}` e `…/poster` (solo i due della conversazione,
   `404` attraverso un blocco o nascosto, `410` scaduto); la foto rifatta
   con `drawing_photos.fitted_jpeg`; il video controllato (scatole MP4,
   durata da `mvhd`, il luogo `©xyz` e i metadati resi `free`); i limiti
   al giorno; il tetto; la pulizia ogni ora (file senza messaggio dopo
   un'ora, video scaduti, file dei messaggi cancellati).
3. `messages.py`: `attachment` nel corpo di `POST …/messages` (un `id`
   caricato o un disegno), nella risposta e nelle pagine; `attachments`
   nella pagina della conversazione; `?with=attachments` dell'app nuova
   (senza, l'app vecchia legge «[Photo]» al posto del messaggio); il `409`
   di un allegato in una richiesta (scelta 1); «Delete», il blocco e
   l'account cancellato portano via anche i file.
4. `push.py`: i testi con l'allegato. `report_email.py`: l'email dice
   che c'è un allegato, la pagina del link lo mostra.
5. `deploy/compose.yaml`: `data/media` montata nell'API (e nell'`init`).
   `.env.example`: `SHAPEROUTE_MESSAGE_MEDIA_MAX_GB` (10). `DEPLOY.md`:
   la cartella, il tetto, perché non è nelle copie, `df -h` prima.
6. `shared-types`: `MessageAttachment`, `MessageMedia`,
   `AttachmentsAllowed`, i limiti; esempi.
7. Test deterministici con un PostgreSQL vero (`test_message_media.py`,
   e in `test_messages.py` gli allegati), MP4 piccoli fatti nei test;
   `API.md`, `DATABASE.md`.

#### Criteri di accettazione (parte A)

- [x] In una conversazione `open` un messaggio porta una foto, un video o
      un disegno, con o senza testo; in una richiesta un allegato è `409`.
- [x] Una foto torna JPEG, al più 1080 px, senza EXIF; un PNG anche.
- [x] Un video oltre 60 s o 40 MB, o che non è MP4/QuickTime, è `422` e
      non resta niente su disco; `©xyz`, `udta` e `meta` diventano `free`
      e il file si legge ancora (test con un MP4 fatto nel test).
- [x] Solo i due della conversazione leggono un file; un terzo, chi sta
      dietro un blocco e chi riceve un messaggio nascosto hanno `404`; un
      video dopo 30 giorni `410`.
- [x] 10 video e 100 foto al giorno per account, poi `429`; sopra il tetto
      `attachments` non offre i video.
- [x] «Delete» di chi ha scritto, il blocco, `DELETE /me`, la scadenza e
      un caricamento non usato da un'ora tolgono il file dal disco (la
      pulizia chiamata dal test, con l'orologio finto).
- [x] Senza `?with=attachments` il messaggio ha «[Photo]», «[Video]» o
      «[Drawing]» davanti al testo; con, il campo `attachment`.
- [x] La pagina della conversazione ha `attachments`; un'API senza
      allegati no (l'app nasconde il «+»).
- [x] Segnalare un messaggio con un allegato: l'email lo dice, la pagina
      del link lo mostra, «Hide» lo toglie a chi l'ha ricevuto.
- [x] Push «{name}: 📷 Photo» e simili, con il testo se c'è.
- [ ] Test verdi in locale e in CI (in locale sì: sotto, «Dove si è»).

#### File toccati (parte A)

`media_files.py` è il modulo comune con i video dei post (TASK-336,
ADR-0292): l'ha scritto questa parte, la prima in `main`; l'altra lo
importa soltanto. Non ha tabelle: ogni parte tiene la sua (`message_media`
qui). Rispetto alla proposta: `app.py` non si tocca (l'installazione è in
`__main__.py`, come le email delle segnalazioni), `test_report_email.py`
nemmeno (la segnalazione con l'allegato si prova in
`test_message_media.py`), e le parti tecniche nuove sono qui sotto, non in
`DECISIONS.md`. Elenco mandato al Coordinatore prima del codice.

```
services/api/migrations/0038_message_media.sql          (nuovo)
services/api/shaperoute_api/media_files.py              (nuovo, comune con TASK-336)
services/api/shaperoute_api/message_media.py            (nuovo)
services/api/shaperoute_api/messages.py
services/api/shaperoute_api/push.py
services/api/shaperoute_api/report_email.py
services/api/shaperoute_api/__main__.py
services/api/tests/test_media_files.py                  (nuovo)
services/api/tests/test_message_media.py                (nuovo)
services/api/tests/test_messages.py
services/api/tests/test_profile_totals.py               (una riga: la 0037 non è più l'ultima)
packages/shared-types/src/index.ts
packages/shared-types/test/message-attachments.test.ts  (nuovo)
packages/shared-types/fixtures/message.json
packages/shared-types/fixtures/messages.json
packages/shared-types/fixtures/conversations.json
packages/shared-types/fixtures/message-media.json       (nuovo)
packages/shared-types/fixtures/message-attachment-request.json (nuovo)
packages/shared-types/fixtures/message-attachments.json (nuovo)
deploy/compose.yaml
.env.example
docs/API.md
docs/DATABASE.md
docs/DEPLOY.md
docs/STATUS.md
docs/tasks/TASK-333.md
```

#### Le scelte tecniche della parte A (decise dall'agente su delega dell'utente)

Oltre ad ADR-0289, scrivendo il codice:

1. **Il disegno ha due copie** nel messaggio: `drawing` intero e
   `drawing_card` (nomi, metri, al più 64 punti); le pagine portano solo la
   scheda, l'intero si chiede con `GET /messages/{id}/drawing`. Una pagina
   di venti disegni da 20 000 punti sarebbe di megabyte.
2. **`attachment` c'è sempre** nei messaggi (`null` per il testo): solo il
   testo cambia per l'app di prima, che non chiede `?with=attachments`.
3. **Le scatole di metadati diventano `free` piene di zeri**, non solo
   rinominate: rinominate, le coordinate sarebbero rimaste nel file.
4. **Lettura con `FileResponse`**: dal disco senza caricarlo in memoria, e
   risponde a `Range` (`206`), che serve se il lettore diventa `expo-video`
   (la scelta di TASK-336).
5. **Il file sparisce dal disco al giro di ogni ora**, non nella stessa
   richiesta: la riga si toglie subito (in cascata, anche dentro la
   transazione del blocco) e da quel momento nessuno lo legge più. Un file
   scritto e non ancora nella tabella resta 10 minuti (`STRAY_AFTER_S`).
6. **Il tetto si conta dalla tabella** (somma dei byte tenuti), non
   leggendo la cartella; i codici sono quelli che c'erano: `507
   http_error` per il server pieno, `429 too_many_requests` per il giorno.
7. **La pagina del link della segnalazione** prende il file dallo stesso
   indirizzo `/report-link?t=…&part=media`, già senza chiave
   (`access.OPEN_PATHS`): `access.py` non cambia. Il disegno lo mostra come
   una linea SVG, senza mappa.
8. **La 30ª giornata di un video** si misura dal suo messaggio, e l'API la
   applica subito (`410`, `expired`) anche se il giro non è ancora passato.

### Parte B — L'app: foto e video

1. `api/messageMedia.ts` (nuovo): caricare (`File` di `expo-file-system`
   come corpo), scaricare nella cache con le intestazioni, i problemi in
   parole.
2. Il «+» accanto alla casella, solo con `attachments` nella pagina:
   «Photo», «Video» (dalla galleria, `expo-image-picker`), fino a 60 s e
   40 MB (scelta 2), sull'iPhone ridotto a 960 × 540; la foto ridotta
   come quelle dei disegni.
3. L'anteprima prima dell'invio, con il testo facoltativo; «Sending…» e
   «Tap to try again».
4. Nei messaggi la foto e la locandina del video (fatta sul telefono di
   chi manda nella WebView nascosta, come il video della corsa; senza, un
   riquadro scuro con ▶ e la durata); a tutto schermo con «Share»; il
   video scaricato e guardato nella WebView (`<video>` dal file, come il
   motore legge i suoi).
5. La lista: «📷 Photo», «🎬 Video»; il messaggio scaduto.
6. «Privacy» (sezione «Private messages» allungata, cinque lingue, sito
   rifatto con `make_privacy.mjs`, data della privacy al giorno del merge).
   Il paragrafo di «Help» va con la parte C (sotto, «Le scelte tecniche
   della parte B»).

#### Criteri di accettazione (parte B)

- [x] In una conversazione aperta il «+» offre «Photo» e «Video»; in una
      richiesta, o con un'API senza `attachments`, non c'è.
- [x] Un video oltre 60 s o 40 MB si ferma sul telefono con il suo testo,
      prima di caricarlo; sull'iPhone parte ridotto a 960 × 540 (la
      riduzione si vede solo sul telefono: da provare).
- [x] Chi riceve vede la foto e la locandina del video; a tutto schermo
      il video si guarda, «Share» apre il foglio del telefono (nei test;
      locandina e lettore nella WebView da provare sul telefono).
- [x] Un invio fallito resta con «Couldn't send. Tap to try again.».
- [x] Il video scaduto dice «This video has expired.»
- [x] «Report this message» e «Delete» funzionano anche su un messaggio
      con un allegato.
- [x] Testi approvati (2026-10-29), traduzioni dell'agente; privacy nelle
      cinque lingue e sul sito («Help» con la parte C). Un testo nuovo,
      «Too many photos today. Try again tomorrow.», **da rivedere**.
- [x] Impronta iOS `83793e26` invariata su una copia pulita (`83793e26fc0d…`,
      misurata sulla testa con `npm ci`).
- [ ] Test, lint, typecheck e prettier verdi in CI.

#### File toccati (parte B)

Mandati al Coordinatore prima del codice; rispetto alla proposta, le due
pagine della WebView stanno in `videoPage.ts` (con il suo test) e la
locandina in `VideoPoster.tsx`, e c'è `attachmentText.ts`.

```
apps/mobile/src/api/messageMedia.ts                      (nuovo)
apps/mobile/src/api/messageMedia.test.ts                 (nuovo)
apps/mobile/src/api/messages.ts
apps/mobile/src/api/messages.test.ts
apps/mobile/src/messages/attachmentText.ts               (nuovo: «📷 Photo» e VoiceOver)
apps/mobile/src/messages/AttachButton.tsx                (nuovo: il «+» e il suo foglio)
apps/mobile/src/messages/AttachmentPreview.tsx           (nuovo)
apps/mobile/src/messages/MessageMedia.tsx                (nuovo: foto e locandina nel messaggio)
apps/mobile/src/messages/MediaViewer.tsx                 (nuovo: a tutto schermo, «Share»)
apps/mobile/src/messages/pickMessageMedia.ts             (nuovo)
apps/mobile/src/messages/pickMessageMedia.test.ts        (nuovo)
apps/mobile/src/messages/videoPage.ts                    (nuovo: le pagine del lettore e della locandina)
apps/mobile/src/messages/videoPage.test.ts               (nuovo)
apps/mobile/src/messages/VideoPoster.tsx                 (nuovo: la locandina nella WebView nascosta)
apps/mobile/src/messages/Attachments.test.tsx            (nuovo)
apps/mobile/src/messages/ConversationScreen.tsx
apps/mobile/src/messages/ConversationScreen.test.tsx     (l'indirizzo con ?with=attachments)
apps/mobile/src/messages/ConversationList.tsx
apps/mobile/src/messages/Messages.test.tsx               (gli indirizzi con ?with=attachments)
apps/mobile/src/i18n/de.ts, es.ts, fr.ts, it.ts
apps/mobile/src/about/content/de.ts, en.ts, es.ts, fr.ts, it.ts
site/privacy/index.html, de/, es/, fr/, it/              (rifatte da make_privacy.mjs)
docs/UI.md
docs/STATUS.md
docs/tasks/TASK-333.md
```

Solo se il merge non è il 29 ottobre (condizione del Coordinatore: la
data della privacy è quella del merge): `PRIVACY_UPDATED` nei cinque
`about/content/*.ts`, e con lei `site/tests/privacy.test.mjs`,
`apps/mobile/src/about/documents.test.ts`,
`apps/mobile/src/about/AboutPage.test.tsx` e le pagine del sito rifatte.
Oggi la data è già «29 October 2026» in tutte e cinque le lingue, quindi
un merge del 29 non cambia niente. Il sito va online solo col sì
dell'utente; `about/content`, `site/privacy` (anche nella #620) e le
tabelle `i18n` (anche nella #632): chi entra secondo si riallinea tenendo
tutte le righe.

#### Le scelte tecniche della parte B (decise dall'agente su delega dell'utente)

1. **Niente sonda nuova per il server vecchio**: il «+» c'è solo quando
   la pagina della conversazione ha `attachments` e non è `null`. Un
   server senza la 0038 non ha il campo, e il «+» manca; aggiornato il
   server, compare alla lettura dopo (ogni 5 s), senza riaprire l'app,
   mentre una sonda come `GET /feedback` ricorderebbe il `404` fino alla
   riapertura (ADR-0289, punto 3). Il test: «a server before the
   attachments shows no «+»». Detto al Coordinatore con l'elenco dei file.
2. **Caricare e scaricare con `expo-file-system` 57.0.7**, già nella build
   dello store: `File.upload` col corpo nudo (`BINARY_CONTENT`) e
   `File.downloadFileAsync` con le intestazioni. Mai usate prima
   nell'app: da provare sul telefono.
3. **La foto si guarda dall'indirizzo**, con la chiave e il token (come
   le foto del Feed, TASK-330); il video si scarica una volta nella cache
   (`message-<id>.mp4`) e si guarda in una WebView che legge la cache, con
   i comandi del telefono. «Share» scarica anche la foto.
4. **La locandina** la fa una WebView nascosta mentre si scrive il testo:
   il video in un `<video>` muto, un decimo di secondo dentro, disegnato su
   un `<canvas>`, JPEG al più 720 px; dieci secondi al massimo, poi il
   video parte senza. Va al server prima del messaggio, così chi riceve la
   vede subito.
5. **Dalla galleria senza `allowsEditing`**: così iOS usa il selettore che
   non chiede permessi; la durata si controlla dopo la scelta, non con il
   taglio del selettore.
6. **«Help» con la parte C**: il paragrafo approvato parla anche di
   «Send to a friend» e dei disegni, che arrivano con C; prima sarebbe
   sbagliato. La privacy invece entra adesso intera: dice cosa fa il
   server, che i disegni li tiene già.
7. **Un testo nuovo, «Too many photos today. Try again tomorrow.»**, per
   il limite delle 100 foto al giorno, come quello approvato per i video:
   preso il consigliato, **da rivedere** con l'utente.
8. **Il testo scritto prima di scegliere** passa sotto la foto, e parte
   con lei.

### Parte C — L'app: i disegni

1. «Send to a friend» e la scelta della persona (`SendToFriend.tsx`:
   chi ti scrive, poi chi segui, con la ricerca). Sulla mappa è il tasto
   tondo sotto il cuore (`FavoriteHeart.tsx`), che ha già il percorso di
   «Draw», «Explore», dei percorsi a tema e dei preferiti; sulle schede di
   «My activities» (`ActivityCard.tsx`) e di un disegno (`DrawingCard.tsx`).
2. «Drawing» nel «+»: i preferiti e «My activities» (`DrawingPicker.tsx`).
3. La scheda del disegno nella conversazione (la sua linea con
   `RouteThumb`) e, toccata, il disegno aperto sulla mappa **come un
   preferito** (`favoritesDoor.show`): «Start», «Export GPX», il cuore,
   «Draw it near me», e «←» che torna alla conversazione.
4. La lista: «🗺️ Drawing».
5. Il disegno da mandare (`messageDrawing.ts`): il corpo di un preferito;
   la corsa propria tagliata a 200 m come nel Feed (`withoutEnds`), un
   disegno del Feed come l'API lo dà, un percorso intero.
6. «Help»: il paragrafo approvato, nelle cinque lingue.

#### Criteri di accettazione (parte C)

- [x] «Send to a friend» c'è sulla mappa (Draw, Explore, a tema,
      preferiti), su «My activities» e sui disegni; chiede a chi, e chi non
      ha accettato la conversazione si vede con «Photos, videos and
      drawings can be sent once {name} accepts your message.».
- [x] «Drawing» nel «+» sceglie fra i preferiti e le proprie corse.
- [x] Una propria corsa parte tagliata all'inizio e alla fine; un
      percorso progettato intero.
- [x] Chi riceve vede la scheda; aperta sulla mappa ha «Start», «Export
      GPX», il cuore e «Draw it near me» quando la figura lo permette, e
      «←» torna alla conversazione.
- [x] «Help» nelle cinque lingue.
- [x] Impronta iOS `83793e26` invariata (`83793e26fc0d…`, copia pulita
      della testa con `npm ci`).
- [ ] Test, lint, typecheck e prettier verdi in CI.

#### File toccati (parte C)

Mandati al Coordinatore prima del codice e poi ristretti: `RoutePanel.tsx`,
`ExploredCard.tsx` e `ThemedCard.tsx` non si toccano (il tasto della mappa
sta sotto il cuore), `App.tsx` nemmeno. `DrawingCard.tsx` è anche nella
#632 (TASK-331), che lì cambia solo due commenti: righe diverse.

```
apps/mobile/src/messages/messageDrawing.ts               (nuovo)
apps/mobile/src/messages/SendDrawingButton.tsx           (nuovo)
apps/mobile/src/messages/SendToFriend.tsx                (nuovo)
apps/mobile/src/messages/DrawingPicker.tsx               (nuovo)
apps/mobile/src/messages/Drawings.test.tsx               (nuovo)
apps/mobile/src/messages/AttachButton.tsx
apps/mobile/src/messages/ConversationScreen.tsx
apps/mobile/src/messages/MessageMedia.tsx
apps/mobile/src/messages/attachmentText.ts
apps/mobile/src/messages/Attachments.test.tsx            (VoiceOver col nome della forma)
apps/mobile/src/api/messages.ts                          (GET /messages/{id}/drawing)
apps/mobile/src/favorites/favoritesDoor.ts               (show, e «←» che torna)
apps/mobile/src/favorites/FavoriteHeart.tsx              (il tasto sotto il cuore)
apps/mobile/src/activities/ActivityCard.tsx
apps/mobile/src/social/DrawingCard.tsx
apps/mobile/src/i18n/de.ts, es.ts, fr.ts, it.ts
apps/mobile/src/about/content/de.ts, en.ts, es.ts, fr.ts, it.ts  (Help)
docs/UI.md
docs/STATUS.md
docs/tasks/TASK-333.md
```

#### Le scelte tecniche della parte C (decise dall'agente su delega dell'utente)

1. **Il disegno ricevuto si apre come un preferito**: `favoritesDoor`
   ha `show(detail, back)`, che mostra sulla mappa un percorso non in
   lista; `App.tsx` lo legge già come un preferito, con la sua scheda. La
   chiave è quella di un preferito (`favoriteKey` della linea), così il
   cuore lo tiene come ogni percorso. «Back to the list» va a `back`, cioè
   alla conversazione, non alla lista dei preferiti.
2. **«Send to a friend» sulla mappa è un tasto tondo «✉︎» sotto il cuore**,
   con VoiceOver «Send to a friend»: il cuore ha già il percorso di ogni
   pagina, quindi nessuna scheda di «Draw» o di «Explore» cambia (né il
   `RoutePanel.tsx` conteso con TASK-331). Sulle schede di «My activities»
   e del Feed è una riga col testo approvato.
3. **«Drawing» nel «+» manda subito**, senza l'anteprima delle foto: un
   disegno non si carica, e il testo già scritto va con lui.
4. **Il tasto c'è solo con un account e un'API che ha i messaggi** (il
   numero di «Messages» arrivato), come «Message» su un profilo.
5. **Una corsa di ore** va in al più 20 000 punti (il limite dei
   preferiti), primo e ultimo tenuti.

### Parte D — Lo spazio pieno toglie i video dei messaggi più vecchi

Due scelte dell'utente del 2026-10-29, prese con TASK-336 (video nei post,
ADR-0292, #631), cambiano i file di questo task. Le parole esatte, come le
riporta il task file di TASK-336:

- sul lettore: **«expo-video in 1.0.2»** (la proposta; per i post e per i
  messaggi);
- sullo spazio, subito dopo la scelta «Server disk, 15 GB cap»: **«poi
  appena è pieno cancella i video delle chat degli utenti dal più vecchio
  al più recente»**.

I due testi nuovi, chiesti all'utente in questa sessione con l'anteprima
di prima e dopo: risposta **«Approvo così»** (le traduzioni nelle altre
quattro lingue sono dell'agente):

- privacy, «Private messages»: «… and is deleted 30 days after it was
  sent, or earlier, oldest first, when our space for videos is full.»
- «Help», «Messages»: «Videos are kept for 30 days, or less when our space
  for videos is full: the oldest go first.»

Il via e le condizioni del Coordinatore: parte D di TASK-333 senza un
numero nuovo, un'aggiunta ad ADR-0289, da `main` dopo la #636.

1. `MessageMedia.free_videos(needed_bytes) -> int`: i video dei messaggi
   più vecchi smettono di essere tenuti finché c'è posto; prima il
   database, poi il disco. Un caricamento pieno fa posto così; `507` solo
   senza più video da togliere. La chiama anche la parte A di TASK-336.
2. La privacy e «Help» con i due testi, nelle cinque lingue; il sito
   rifatto (online solo con l'aggiornamento del server); la data della
   privacy al giorno del merge.
3. L'aggiunta ad ADR-0289 (punti 8 e 9); `API.md`, `DEPLOY.md` (dove sta
   `data/media`, da rivedere con l'utente).

#### Criteri di accettazione (parte D)

- [x] Pieno, un video nuovo entra e il video del messaggio più vecchio
      diventa «This video has expired.» (`410`); gli altri restano.
- [x] `free_videos` non tocca mai una foto, un caricamento non mandato né
      un video di un post (la cartella dei post resta com'è, anche dopo il
      giro di ogni ora); senza più video da togliere, `507`.
- [x] Fermato a metà, nessuna riga tiene un file che non c'è: con il
      database giù non cambia niente; fermato dopo il database, il file
      resta senza riga, nessuno lo legge (`410`) e il giro lo toglie.
- [x] I due testi approvati nelle cinque lingue e sul sito.
- [ ] Test verdi in CI.

#### File toccati (parte D)

Approvati dal Coordinatore prima del codice.

```
services/api/shaperoute_api/message_media.py
services/api/tests/test_message_media.py
apps/mobile/src/about/content/de.ts, en.ts, es.ts, fr.ts, it.ts
apps/mobile/src/about/documents.test.ts                  (solo se la data cambia)
apps/mobile/src/about/AboutPage.test.tsx                 (solo se la data cambia)
site/tests/privacy.test.mjs                              (solo se la data cambia)
site/privacy/index.html, de/, es/, fr/, it/              (rifatte da make_privacy.mjs)
docs/DECISIONS.md                                        (aggiunta ad ADR-0289, in fondo)
docs/API.md
docs/DEPLOY.md
docs/STATUS.md
docs/tasks/TASK-333.md
```

La data della privacy dice già «29 October 2026»: con un merge del 29 non
cambia; se slitta, cambiano `PRIVACY_UPDATED` e i tre test.

### Parte E — Il lettore dei video con expo-video (al taglio della 1.0.2)

Con la build 1.0.2 (scelta dell'utente «expo-video in 1.0.2», ADR-0289
aggiunta della parte D, punto 3): i video dei messaggi si guardano con
`expo-video`, come quelli dei post di TASK-336, e il lettore nella WebView
(`MediaViewer.tsx`, `videoPage.ts` per il lettore) esce da `main` nello
stesso cambio che collega il modulo. Un lettore solo (Coordinatore). La
locandina fatta nella WebView resta finché non serve altro. File e criteri
si scrivono quando il Coordinatore fissa il taglio.

### Dopo, col sì dell'utente

- Il server (migrazione, `data/media`, spazio misurato con `df -h`
  prima) e poi l'OTA, nell'ordine di sempre.
- **App Store Connect**: «App Privacy» deve dire «Photos or Videos»
  (contenuto dell'utente, legato all'account, per far funzionare l'app);
  **Google Play**: «Data safety» lo stesso. Li cambia l'utente prima che
  l'OTA con le foto vada in `production`.
- Con la 1.0.1: la fotocamera nella chat e i testi dei permessi.

## I testi

In inglese, **approvati dall'utente il 2026-10-29** («Approvo così»,
scelta 7); le traduzioni in tedesco, italiano, spagnolo e francese sono
dell'agente.

**App**

- «+» (VoiceOver «Add a photo, a video or a drawing»): «Photo», «Video»,
  «Drawing», «Cancel».
- Anteprima: «Add a message…», «Send», «Sending…», «Couldn't send. Tap to
  try again.»
- Nei messaggi: «Photo», «Video, {duration}», «Drawing: {title},
  {distance}» (VoiceOver); «This video has expired.»; «Share»,
  «Close».
- Errori: «This video is longer than {seconds} seconds. Choose a shorter
  one.» ({seconds} = 60), «This video is too large: at most {mb} MB.
  Choose a shorter one.» ({mb} = 40), «Too many videos today. Try again tomorrow.», «Videos can't be
  sent right now. Try again later.», «Photos, videos and drawings can be
  sent once {name} accepts your message.»
- Lista: «📷 Photo», «🎬 Video», «🗺️ Drawing», «You: 📷 Photo».
- Disegni: «Send to a friend», «Send to…», «Search people», «Sent to
  {name}.»; «Send a drawing», «Favorites», «My activities».

**Push**: «{name}: 📷 Photo», «{name}: 🎬 Video», «{name}: 🗺️ Drawing»; con
un testo, «{name}: 📷 {text}».

**Help**, in «Messages», un paragrafo nuovo dopo gli altri: «In a
conversation, tap + to send a photo, a video of up to 60 seconds or a
drawing, or tap Send to a friend on a route or a drawing. You can send
them once the other person has accepted your message. Videos are kept
for 30 days. Tap a drawing to open it on the map, start it, export its
GPX or keep it in your favorites.»

**Privacy**, in «Private messages», un paragrafo nuovo dopo il primo:
«A message can carry a photo, a video or a drawing. A photo is kept
resized, without the data your phone adds to it, such as where and when
it was taken. A video is kept as your phone sends it, without the place
it was shot, and is deleted 30 days after it was sent. A drawing is
a copy of the route: a run you send is cut at its start and end as in
the Feed, a route you plan is sent whole, with its start. Photos and
videos are not end-to-end encrypted, are not in our backup copies, and
are deleted with their message, the conversation or your account. When
you report a message, the person who runs MuW sees its photo, video or
drawing too.»

## Criteri di accettazione

Della proposta (questa PR):

- [x] Le scelte 1–6 hanno una risposta dell'utente, scritta qui.
- [x] I testi e la privacy sono approvati (scelta 7).
- [x] Le parti hanno i loro file toccati e criteri, aggiornati alle
      risposte (sopra, in «Le parti»).

## File toccati

Questa PR (documenti):

```
docs/tasks/TASK-333.md                                  (nuovo)
docs/DECISIONS.md
docs/STATUS.md
docs/INDEX.md
```

Le parti A, B e C hanno i loro elenchi in «Le parti».

## Fuori scope

- Più foto in un messaggio, vocali, GIF, adesivi, reazioni.
- La fotocamera e la registrazione dalla chat (con la 1.0.1).
- Ridurre il video su Android (oggi parte com'è, entro il peso).
- Un filtro automatico delle immagini: c'è la richiesta di solo testo, la
  segnalazione e il blocco.
- Mandare l'immagine di un disegno a mano senza il percorso.

## Dove si è

- 2026-10-29: letti TASK-319, ADR-0279, `messages.py`, `0033`, l'app dei
  messaggi, le foto dei disegni (`drawing_photos.py`), i preferiti, il
  video della corsa e i permessi in `app.json`. Numeri dal Coordinatore.
  Proposta scritta, PR #627.
- 2026-10-29: le sette scelte dell'utente, una per volta (sopra): solo
  dopo «Accept»; video 60 s e 40 MB; video 30 giorni; il disegno si
  apre, si corre e si tiene; si manda dalla scheda e dalla
  conversazione; il resto «Sì, così»; testi e privacy «Approvo così».
  Parti pianificate. Prossimo: il «vai» dell'utente per la parte A, in
  una sessione sua.
- 2026-10-29 sera: **parte A partita** sulla delega dell'utente di 23 ore
  (il suo messaggio delle 17:16Z nella sessione «Coordinatore automatico
  23 ore», `out/autopilota-23h/RUNBOOK.md`: «avvio delle parti in coda
  che aspettavano solo il via»), col via del Coordinatore: migrazione
  0038, branch `feat/TASK-333-a-attachments-api` da `main` 95bfc5c4,
  nella sessione della proposta. Server e `compose.yaml` in produzione
  fermi fino al ritorno dell'utente.
- 2026-10-29: **parte A scritta**. In locale verdi: `test_media_files.py`
  (15) e `test_message_media.py` (25) con un PostgreSQL vero, e con loro
  `test_messages.py`, `test_push.py`, `test_report_email.py`,
  `test_moderation.py` (131 in tutto); `ruff` e `black`; `shared-types`
  (tsc, 100 test), i test jest dei messaggi dell'app (18), prettier.
- 2026-10-29: **parte A in `main`** con la #634 (02e3fc5c), branch
  cancellato; la 0038 è sua. Il Coordinatore ha dato il via alla parte B
  sotto la stessa delega.
- 2026-10-29 sera: **parte B scritta** (branch
  `feat/TASK-333-b-attachments-app` da `main` 02e3fc5c). In locale verdi:
  i test nuovi (`Attachments.test.tsx` 12, `messageMedia.test.ts` 6,
  `pickMessageMedia.test.ts` 3, `videoPage.test.ts` 3) e la suite jest
  intera tranne due suite che qui non partono per moduli assenti dai
  `node_modules` del checkout principale (document picker, Salute), le
  stesse su `main`; lint, typecheck, prettier. Da provare sul telefono:
  la riduzione del video, `File.upload`, la locandina e il lettore nella
  WebView.
  Sulla copia pulita della testa (`npm ci`): impronta iOS
  `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3`, invariata, e verdi anche le
  due suite che in locale non partivano.
- 2026-10-29: **parte B in `main`** con la #635 (e6f5b1c3). Il
  Coordinatore ha dato il via alla parte C sotto la stessa delega.
- 2026-10-29 notte: **parte C scritta** (branch
  `feat/TASK-333-c-attachments-drawings` da `main` e6f5b1c3). In locale
  verdi: `Drawings.test.tsx` (10), i test dei messaggi (42 in tutto), la
  suite jest intera tranne le due suite che qui non partono per moduli
  assenti (document picker, Salute); lint, typecheck, prettier. Da provare
  sul telefono: il disegno aperto sulla mappa e il ritorno alla
  conversazione.
  Sulla copia pulita (`npm ci`) della testa 53b53573: impronta iOS
  `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3`, invariata, e verdi anche le
  due suite che in locale non partivano.
- 2026-10-29: **parte C in `main`** con la #636 (2d6b8b69).
- 2026-10-29 notte: **parte D scritta** (branch `feat/TASK-333-d-free-videos`
  da `main` 2d6b8b69), col via del Coordinatore e i testi approvati
  dall'utente. In locale verdi: i tre test nuovi di `test_message_media.py`
  e i vicini (67), `ruff`, `black`.
- 2026-10-29: **parte D in `main`** con la #639 (dd607e89), alle 22:29
  italiane: la data della privacy «29 October 2026» è giusta.

## Esito

Nei messaggi privati si mandano una foto, un video fino a 60 s e 40 MB, o
un disegno, solo in una conversazione accettata. L'API (#634, migrazione
`0038`) tiene foto e video su disco in `data/media`, mai nel database né
nelle copie, senza EXIF né il luogo del video; i video durano 30 giorni,
o meno quando lo spazio è pieno, e allora vanno via dal più vecchio
(#639). L'app (#635, #636) ha il «+» con «Photo», «Video» e «Drawing»
(solo con un server che lo sa fare), l'anteprima, foto e video a tutto
schermo con «Share», «Send to a friend» sotto il cuore della mappa e sulle
schede, e il disegno ricevuto aperto sulla mappa come un preferito.
Privacy e «Help» nelle cinque lingue, testi approvati dall'utente. Solo
OTA: impronta iOS `83793e26` invariata in ogni parte.

**Restano, col sì dell'utente**: il server (migrazione `0038`, dove sta
`data/media` e il tetto dopo un `df -h` quel giorno, `DEPLOY.md` «Foto e
video dei messaggi»), «Photos or Videos» in «App Privacy» di App Store
Connect e in «Data safety» di Google Play, l'OTA dopo il server, il sito
con la privacy nuova. **Da provare sul telefono**: il caricamento, la
riduzione del video sull'iPhone, la locandina e il lettore nella WebView,
il disegno aperto sulla mappa e il ritorno alla conversazione. **Da
rivedere** con l'utente: «Too many photos today. Try again tomorrow.».
**Dopo**: la parte E al taglio della 1.0.2.

