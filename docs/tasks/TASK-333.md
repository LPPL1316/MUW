# TASK-333 — Gli allegati nei messaggi privati: un disegno, una foto, un video

**Stato**: Proposta · 2026-10-29 · aspetta le scelte dell'utente
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
   — *Risposta:* …
2. **Quanto è lungo e pesante un video.** Proposta: fino a 30 secondi,
   ridotto sul telefono a 960 × 540 (sull'iPhone), al più 20 MB; scelto
   dalla galleria, non registrato dalla chat. Alternative: 15 s; 60 s e
   40 MB.
   — *Risposta:* …
3. **Quanto restano sul server.** Proposta: un video 30 giorni, poi al
   suo posto «This video has expired.»; foto e disegni restano come il
   testo. Più un tetto per tutto il server: sopra, i video nuovi
   aspettano. Alternative: 7 giorni; per sempre, con il solo tetto.
   — *Risposta:* …
4. **Chi riceve un disegno.** Proposta: nella conversazione una scheda
   con la mappa piccola, il nome e i km; un tocco la apre sulla mappa con
   «Start», «Export GPX», il cuore dei preferiti e «Draw it near me»
   quando la figura lo permette (ADR-0273). Alternativa: solo guardarlo e
   «Start».
   — *Risposta:* …
5. **Da dove si manda un disegno.** Proposta: tutti e due: «Send to a
   friend» sulla scheda di un percorso o di un disegno (il risultato di
   «Draw», «Explore», il «Feed», un profilo, «My activities», i
   preferiti), che chiede a chi; e «Drawing» nel «+» della conversazione,
   che sceglie fra i preferiti e le proprie corse. Alternative: solo
   dalla scheda; solo dalla conversazione.
   — *Risposta:* …
6. **Il resto della proposta**, in un sì solo: un allegato per messaggio,
   con un testo facoltativo; foto e video a tutto schermo con «Share» (dal
   foglio del telefono si salvano); la fotocamera nella chat solo con la
   build 1.0.1 (oggi il testo del permesso parla del contorno del
   percorso e quello del microfono dice «MuW never records sound»); le
   push «{name}: 📷 Photo», «🎬 Video», «🗺️ Drawing»; la corsa mandata
   tagliata come nel Feed (ADR-0159), un percorso progettato intero con la
   sua partenza.
   — *Risposta:* …
7. **I testi e la privacy** (sotto, «I testi»): in inglese da approvare,
   traduzioni dell'agente; la privacy nelle cinque lingue.
   — *Risposta:* …

## Il disegno tecnico (deciso dall'agente su delega dell'utente)

In ADR-0289: i file di foto e video su disco e non nel database, il
caricamento in due tempi, cosa controlla il server (tipo, peso, durata
letta dall'MP4, il luogo tolto), la pagina che dice cosa si può
allegare, il messaggio di prima per un'app vecchia, il tetto e la pulizia,
la segnalazione con l'allegato nella pagina del link, la stima dello
spazio.

## Le parti

Ognuna nella sua PR, dopo il sì a questa proposta. Le parti B e C
toccano file diversi della conversazione e vanno una dopo l'altra (C
dopo B).

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
   di un allegato in una richiesta (se la scelta 1 resta così); «Delete»,
   il blocco e l'account cancellato portano via anche i file.
4. `push.py`: i testi con l'allegato. `report_email.py`: l'email dice
   che c'è un allegato, la pagina del link lo mostra.
5. `deploy/compose.yaml`: `data/media` montata nell'API (e nell'`init`).
   `DEPLOY.md`: la cartella, il tetto, perché non è nelle copie.
6. `shared-types`: `MessageAttachment`, `MessageMedia`,
   `AttachmentsAllowed`, i limiti; esempi.
7. Test deterministici con un PostgreSQL vero (`test_message_media.py`,
   e in `test_messages.py` gli allegati), MP4 piccoli fatti nei test;
   `API.md`, `DATABASE.md`.

### Parte B — L'app: foto e video

1. `api/messageMedia.ts` (nuovo): caricare (`File` di `expo-file-system`
   come corpo), scaricare nella cache con le intestazioni, i problemi in
   parole.
2. Il «+» accanto alla casella, solo con `attachments` nella pagina:
   «Photo», «Video» (dalla galleria, `expo-image-picker`), con le
   proposte della scelta 2; la foto ridotta come quelle dei disegni.
3. L'anteprima prima dell'invio, con il testo facoltativo; «Sending…» e
   «Tap to try again».
4. Nei messaggi la foto e la locandina del video (fatta sul telefono di
   chi manda nella WebView nascosta, come il video della corsa; senza, un
   riquadro scuro con ▶ e la durata); a tutto schermo con «Share»; il
   video scaricato e guardato nella WebView (`<video>` dal file, come il
   motore legge i suoi).
5. La lista: «📷 Photo», «🎬 Video»; il messaggio scaduto.
6. «Help» e «Privacy» (sezione «Private messages» allungata, cinque
   lingue, sito rifatto con `make_privacy.mjs`).

### Parte C — L'app: i disegni

1. «Send to a friend» sulle schede scelte (risposta 5) e la scelta della
   persona (le conversazioni, poi chi si segue, con la ricerca).
2. «Drawing» nel «+»: i preferiti e «My activities».
3. La scheda del disegno nella conversazione e quella aperta sulla mappa
   con «Start», «Export GPX», il cuore, «Draw it near me» (risposta 4).
4. La lista: «🗺️ Drawing».

### Dopo, col sì dell'utente

- Il server (migrazione, `data/media`, spazio misurato con `df -h`
  prima) e poi l'OTA, nell'ordine di sempre.
- **App Store Connect**: «App Privacy» deve dire «Photos or Videos»
  (contenuto dell'utente, legato all'account, per far funzionare l'app);
  **Google Play**: «Data safety» lo stesso. Li cambia l'utente prima che
  l'OTA con le foto vada in `production`.
- Con la 1.0.1: la fotocamera nella chat e i testi dei permessi.

## I testi

In inglese, da approvare con la scelta 7; le traduzioni in tedesco,
italiano, spagnolo e francese sono dell'agente.

**App**

- «+» (VoiceOver «Add a photo, a video or a drawing»): «Photo», «Video»,
  «Drawing», «Cancel».
- Anteprima: «Add a message…», «Send», «Sending…», «Couldn't send. Tap to
  try again.»
- Nei messaggi: «Photo», «Video, {duration}», «Drawing: {title},
  {distance}» (VoiceOver); «This video has expired.»; «Share»,
  «Close».
- Errori: «This video is longer than {seconds} seconds. Choose a shorter
  one.», «This video is too large: at most {mb} MB. Choose a shorter
  one.», «Too many videos today. Try again tomorrow.», «Videos can't be
  sent right now. Try again later.», «Photos, videos and drawings can be
  sent once {name} accepts your message.»
- Lista: «📷 Photo», «🎬 Video», «🗺️ Drawing», «You: 📷 Photo».
- Disegni: «Send to a friend», «Send to…», «Search people», «Sent to
  {name}.»; «Send a drawing», «Favorites», «My activities».

**Push**: «{name}: 📷 Photo», «{name}: 🎬 Video», «{name}: 🗺️ Drawing»; con
un testo, «{name}: 📷 {text}».

**Privacy**, in «Private messages», un paragrafo nuovo dopo il primo:
«A message can carry a photo, a video or a drawing. A photo is kept
resized, without the data your phone adds to it, such as where and when
it was taken. A video is kept as your phone sends it, without the place
it was shot, and is deleted {days} days after it was sent. A drawing is
a copy of the route: a run you send is cut at its start and end as in
the Feed, a route you plan is sent whole, with its start. Photos and
videos are not end-to-end encrypted, are not in our backup copies, and
are deleted with their message, the conversation or your account. When
you report a message, the person who runs MuW sees its photo, video or
drawing too.»

## Criteri di accettazione

Della proposta (questa PR):

- [ ] Le scelte 1–6 hanno una risposta dell'utente, scritta qui.
- [ ] I testi e la privacy sono approvati (scelta 7).
- [ ] Le parti hanno i loro file toccati e criteri, aggiornati alle
      risposte.

Delle parti (da precisare con le risposte):

- [ ] Una foto e un video si mandano in una conversazione aperta e chi
      riceve li vede; con un server vecchio il «+» non c'è.
- [ ] Un video oltre la durata o il peso è rifiutato prima di partire
      (app) e all'arrivo (API); la foto non ha EXIF, il video non ha il
      luogo.
- [ ] Un allegato si segnala come il suo messaggio, e chi lo riceve
      segnalato e nascosto non lo vede più; la pagina del link lo mostra.
- [ ] Blocco, «Delete» di chi ha scritto, l'account cancellato e la
      scadenza portano via i file dal disco.
- [ ] Un disegno arriva, si apre sulla mappa e si corre.
- [ ] Impronta iOS `83793e26` invariata.
- [ ] Test verdi in locale e in CI.

## File toccati

Questa PR (documenti):

```
docs/tasks/TASK-333.md                                  (nuovo)
docs/DECISIONS.md
docs/STATUS.md
docs/INDEX.md
```

Le parti A, B e C scrivono i loro elenchi qui quando partono, dopo le
risposte.

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
  Proposta scritta; le scelte all'utente.
