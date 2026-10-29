# TASK-333 — Gli allegati nei messaggi privati: un disegno, una foto, un video

**Stato**: Proposta approvata · 2026-10-29 · le sette scelte e i testi
sono dell'utente (2026-10-29); le parti A, B e C partono col suo «vai»
**Fase**: 4 · **Branch**: `docs/TASK-333-message-attachments` (documenti),
poi una PR per parte
**ADR**: ADR-0289 (proposta) · **Migrazione**: il primo numero libero in
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

- [ ] In una conversazione `open` un messaggio porta una foto, un video o
      un disegno, con o senza testo; in una richiesta un allegato è `409`.
- [ ] Una foto torna JPEG, al più 1080 px, senza EXIF; un PNG anche.
- [ ] Un video oltre 60 s o 40 MB, o che non è MP4/QuickTime, è `422` e
      non resta niente su disco; `©xyz`, `udta` e `meta` diventano `free`
      e il file si legge ancora (test con un MP4 fatto nel test).
- [ ] Solo i due della conversazione leggono un file; un terzo, chi sta
      dietro un blocco e chi riceve un messaggio nascosto hanno `404`; un
      video dopo 30 giorni `410`.
- [ ] 10 video e 100 foto al giorno per account, poi `429`; sopra il tetto
      `attachments` non offre i video.
- [ ] «Delete» di chi ha scritto, il blocco, `DELETE /me`, la scadenza e
      un caricamento non usato da un'ora tolgono il file dal disco (la
      pulizia chiamata dal test, con l'orologio finto).
- [ ] Senza `?with=attachments` il messaggio ha «[Photo]», «[Video]» o
      «[Drawing]» davanti al testo; con, il campo `attachment`.
- [ ] La pagina della conversazione ha `attachments`; un'API senza
      allegati no (l'app nasconde il «+»).
- [ ] Segnalare un messaggio con un allegato: l'email lo dice, la pagina
      del link lo mostra, «Hide» lo toglie a chi l'ha ricevuto.
- [ ] Push «{name}: 📷 Photo» e simili, con il testo se c'è.
- [ ] Test verdi in locale e in CI.

#### File toccati (parte A)

`media_files.py` è il modulo comune con i video dei post (TASK-336,
ADR-0292): lo scrive la prima parte A che arriva in `main`, l'altra lo
importa soltanto. Se c'è già, esce da questo elenco con il suo test.
Non ha tabelle: ogni parte tiene la sua (`message_media` qui).

```
services/api/migrations/00NN_message_media.sql          (nuovo; il primo numero libero al merge)
services/api/shaperoute_api/message_media.py            (nuovo)
services/api/shaperoute_api/media_files.py              (nuovo, comune con TASK-336: controllo MP4, file su disco, tetto)
services/api/shaperoute_api/messages.py
services/api/shaperoute_api/push.py
services/api/shaperoute_api/report_email.py
services/api/shaperoute_api/app.py
services/api/tests/test_message_media.py                (nuovo)
services/api/tests/test_media_files.py                  (nuovo)
services/api/tests/test_messages.py
services/api/tests/test_push.py
services/api/tests/test_report_email.py
packages/shared-types/src/index.ts
packages/shared-types/test/message-media.test.ts        (nuovo)
packages/shared-types/fixtures/message-media.json       (nuovo)
packages/shared-types/fixtures/message-attachments.json (nuovo)
deploy/compose.yaml
.env.example
docs/API.md
docs/DATABASE.md
docs/DEPLOY.md
docs/DECISIONS.md                                       (righe in fondo, se serve un'aggiunta)
docs/STATUS.md
docs/tasks/TASK-333.md
```

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
6. «Help» e «Privacy» (sezione «Private messages» allungata, cinque
   lingue, sito rifatto con `make_privacy.mjs`, data della privacy al
   giorno del merge).

#### Criteri di accettazione (parte B)

- [ ] In una conversazione aperta il «+» offre «Photo» e «Video»; in una
      richiesta, o con un'API senza `attachments`, non c'è.
- [ ] Un video oltre 60 s o 40 MB si ferma sul telefono con il suo testo,
      prima di caricarlo; sull'iPhone parte ridotto a 960 × 540.
- [ ] Chi riceve vede la foto e la locandina del video; a tutto schermo
      il video si guarda, «Share» apre il foglio del telefono.
- [ ] Un invio fallito resta con «Couldn't send. Tap to try again.».
- [ ] Il video scaduto dice «This video has expired.»
- [ ] «Report this message» e «Delete» funzionano anche su un messaggio
      con un allegato.
- [ ] Testi approvati (2026-10-29), traduzioni dell'agente; privacy e
      «Help» nelle cinque lingue e sul sito.
- [ ] Impronta iOS `83793e26` invariata su una copia pulita.
- [ ] Test, lint, typecheck e prettier verdi in CI.

#### File toccati (parte B)

```
apps/mobile/src/api/messageMedia.ts                      (nuovo)
apps/mobile/src/api/messageMedia.test.ts                 (nuovo)
apps/mobile/src/api/messages.ts
apps/mobile/src/api/messages.test.ts
apps/mobile/src/messages/AttachButton.tsx                (nuovo: il «+» e il suo foglio)
apps/mobile/src/messages/pickMessageMedia.ts             (nuovo)
apps/mobile/src/messages/pickMessageMedia.test.ts        (nuovo)
apps/mobile/src/messages/AttachmentPreview.tsx           (nuovo)
apps/mobile/src/messages/MessageMedia.tsx                (nuovo: foto e locandina nel messaggio)
apps/mobile/src/messages/MediaViewer.tsx                 (nuovo: a tutto schermo, «Share»)
apps/mobile/src/messages/videoPlayerPage.ts              (nuovo: la pagina della WebView)
apps/mobile/src/messages/videoPoster.ts                  (nuovo: la locandina nella WebView nascosta)
apps/mobile/src/messages/Attachments.test.tsx            (nuovo)
apps/mobile/src/messages/ConversationScreen.tsx
apps/mobile/src/messages/ConversationScreen.test.tsx
apps/mobile/src/messages/ConversationList.tsx
apps/mobile/src/i18n/de.ts, es.ts, fr.ts, it.ts
apps/mobile/src/about/content/de.ts, en.ts, es.ts, fr.ts, it.ts
site/privacy/index.html, de/, es/, fr/, it/              (rifatte da make_privacy.mjs)
docs/UI.md
docs/STATUS.md
docs/tasks/TASK-333.md
```

### Parte C — L'app: i disegni

1. «Send to a friend» sulle schede scelte (risposta 5) e la scelta della
   persona (le conversazioni, poi chi si segue, con la ricerca).
2. «Drawing» nel «+»: i preferiti e «My activities».
3. La scheda del disegno nella conversazione e quella aperta sulla mappa
   con «Start», «Export GPX», il cuore, «Draw it near me» (risposta 4).
4. La lista: «🗺️ Drawing».
5. Il disegno da mandare (`messageDrawing.ts`): il corpo di un preferito;
   la corsa tagliata a `DRAWING_CUT_M` come nel Feed, un percorso intero.

#### Criteri di accettazione (parte C)

- [ ] «Send to a friend» c'è sulle schede di «Draw», «Explore», del Feed,
      di un profilo, di «My activities» e dei preferiti, e chiede a chi;
      chi non ha accettato la conversazione si vede con «Photos, videos
      and drawings can be sent once {name} accepts your message.».
- [ ] «Drawing» nel «+» sceglie fra i preferiti e le proprie corse.
- [ ] Una propria corsa parte tagliata all'inizio e alla fine; un
      percorso progettato intero.
- [ ] Chi riceve vede la scheda; aperta sulla mappa ha «Start», «Export
      GPX», il cuore e «Draw it near me» quando la figura lo permette.
- [ ] Impronta iOS `83793e26` invariata; test, lint, typecheck e
      prettier verdi in CI.

#### File toccati (parte C)

Da ricontrollare con il Coordinatore all'inizio di C: le schede sono
file che altri task toccano spesso (oggi `route/RoutePanel.tsx` per
TASK-331).

```
apps/mobile/src/messages/messageDrawing.ts               (nuovo)
apps/mobile/src/messages/messageDrawing.test.ts          (nuovo)
apps/mobile/src/messages/SendToFriend.tsx                (nuovo: la scelta della persona)
apps/mobile/src/messages/SendToFriend.test.tsx           (nuovo)
apps/mobile/src/messages/DrawingPicker.tsx               (nuovo: preferiti e «My activities»)
apps/mobile/src/messages/MessageDrawing.tsx              (nuovo: la scheda nel messaggio)
apps/mobile/src/messages/ReceivedDrawing.tsx             (nuovo: aperta sulla mappa)
apps/mobile/src/messages/Drawings.test.tsx               (nuovo)
apps/mobile/src/messages/AttachButton.tsx
apps/mobile/src/messages/ConversationScreen.tsx
apps/mobile/src/messages/ConversationList.tsx
apps/mobile/src/route/RoutePanel.tsx                     («Send to a friend»)
apps/mobile/src/explore/ExploredCard.tsx, RouteCard.tsx
apps/mobile/src/social/DrawingCard.tsx
apps/mobile/src/activities/RunDrawing.tsx
apps/mobile/src/favorites/FavoritesList.tsx
apps/mobile/src/i18n/de.ts, es.ts, fr.ts, it.ts
docs/UI.md
docs/STATUS.md
docs/tasks/TASK-333.md
```

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
