# TASK-336 — Un video nei post: il video della corsa di MuW o uno proprio

**Stato**: Proposta · 2026-10-29 · scelte 1 e 2 fatte dall'utente; 3 e 4
accettate su delega dell'utente, da rivedere; tutto ciò che è nativo
(`expo-video`, permessi, la build) aspetta l'utente
**Fase**: 4 · **Branch**: `docs/TASK-336-video-in-posts` (documenti),
poi una PR per parte
**ADR**: ADR-0292 (proposta), che estende ADR-0289 (TASK-333), ADR-0170 e
ADR-0275 · **Migrazione**: il primo numero libero in `main` al merge della
parte A
**Numeri**: TASK-336 / ADR-0292, **assegnati dal Coordinatore** il
2026-10-29.

## Obiettivo

Un post del Feed porta anche **un video**, oltre al disegno e alle foto.
Richiesta dell'utente del 2026-10-29: «dai la possibilità di aggiungere
anche il video della corsa e un video dell'utente, magari di lui, mentre
corre o del suo cane o di quello che vuole».

**Già approvato dall'utente** il 2026-10-29 («Yes, write it up»):

- due tipi di video, scelti quando si pubblica il post: il video della
  corsa che MuW fa già («Export video», TASK-295, ADR-0254, circa 12 s,
  9:16), aggiunto con un tocco; e un video proprio, dalla galleria o
  dalla fotocamera;
- un video per post, al più 30 s, ridotto sul telefono;
- nella scheda del Feed il video è una pagina della striscia dopo il
  disegno, insieme alle foto (ADR-0275, TASK-330); parte senza suono
  quando la sua pagina è sullo schermo, e un tocco accende il suono. Si
  vede anche nel disegno aperto;
- sul server solo mentre gli altri possono vedere il post, come le foto
  (ADR-0170: «use the phones' memory more than ours»);
- un lettore nativo, quindi nella build **1.0.2**: la 1.0.1 tiene
  l'impronta iOS `83793e26`, e niente di nativo entra in `main` prima del
  suo taglio.

## Vincoli (dal Coordinatore e dalla sessione che ha aperto il task)

- **Una regola sola con TASK-333** (gli allegati nei messaggi privati):
  caricamento, limiti, spazio, lettura, segnalazione e lo stesso lettore.
  Concordato con quella sessione il 2026-10-29: la regola comune è
  ADR-0289, il codice comune sta in `media_files.py` (lo scrive la prima
  parte A che arriva in `main`, l'altra lo importa soltanto), ogni task
  tiene la sua tabella, e i due tetti stanno insieme nello spazio libero
  misurato prima di aggiornare il server.
- **Il lettore**: confrontare la WebView (la scelta di TASK-333) con
  `expo-video` e portare all'utente una proposta sola, per post e
  messaggi (scelta 1).
- **Privacy** nelle cinque lingue, col sì dell'utente; **stima scritta
  dello spazio** per 1000 iscritti (ADR-0292, punto 13).
- **Prima PR**: solo documenti. Server, OTA, build e acquisti col sì
  dell'utente.
- **File occupati**: `app.json` e `apps/mobile/src/about/content/*.ts`
  dalla #620 (TASK-321 B, in bozza fino al taglio della 1.0.1): la parte D
  parte dopo quel merge. La #629 (TASK-330) è in `main` dal 2026-10-29,
  e così TASK-333 A (#634, `media_files.py`, `data/media` in
  `compose.yaml`) e B (#635, la WebView per i video dei messaggi).

## Le scelte dell'utente

Da chiedere una alla volta, ognuna con la proposta già pronta. Le
risposte si scrivono qui.

1. **Il lettore, una dipendenza nuova.** Proposta: `expo-video` (un
   pacchetto di Expo, già dentro Expo Go) per i video dei post e dei
   messaggi, nella build 1.0.2. Parte in meno di un secondo perché legge
   il file a pezzi; la WebView prima lo scarica tutto (3–5 s in 4G per un
   video proprio di 30 s). I video dei messaggi aspetterebbero la 1.0.2;
   foto e disegni dei messaggi no. Alternative: la WebView per tutti,
   subito con un OTA e senza dipendenze; tutti e due, `expo-video` dove
   la build lo ha e la WebView altrove (due lettori da tenere). Confronto
   intero in ADR-0292, punto 6.
   — *Risposta (2026-10-29):* «expo-video in 1.0.2», la proposta. Vale
   anche per i video dei messaggi (TASK-333, il suo punto 9). Mentre
   l'utente sceglieva, TASK-333 B è entrata in `main` (#635) con la
   WebView per i video dei messaggi: resta fino alla 1.0.2, che li porta
   su `expo-video` (lo fa TASK-333 nei suoi file).
2. **Lo spazio sul server e i limiti.** Proposta: fino a 30 s e 40 MB
   (lo stesso peso dei messaggi), ridotto a 960 × 540 sull'iPhone (circa
   11 MB per 30 s), il video della corsa circa 3 MB; un tetto di 30 GB
   per i video dei post; un **Volume Hetzner nuovo da 50 GB** per foto e
   video di post e messaggi (circa 3 € al mese), che si allarga quando
   serve; i video non entrano nelle copie di notte. Con 1000 iscritti
   l'ipotesi media fa circa 45 GB in un anno. Alternative: nessun Volume,
   sul disco del server con un tetto di 15 GB; 1280 × 720 (circa 19 MB
   per 30 s, il doppio dello spazio).
   — *Risposta (2026-10-29):* «Server disk, 15 GB cap». Quindi nessun
   Volume nuovo: `data/media` sul disco del server, tetto di 15 GB per i
   video dei post (più i 10 GB dei messaggi), fino a 30 s e 40 MB, 960 ×
   540 sull'iPhone, niente copie di notte. Con l'ipotesi media il tetto
   si raggiunge in circa quattro mesi: all'80 % il log lo dice e si
   richiede all'utente.
   Aggiunta dell'utente, subito dopo: «poi appena è pieno cancella i video
   delle chat degli utenti dal più vecchio al più recente». Letta così
   (ADR-0292, punto 11): i due tetti sono uno spazio solo per i video;
   quando un video nuovo non ci sta, il server cancella i video dei
   messaggi dal più vecchio finché ci sta; quelli dei post non si
   cancellano mai per fare posto, e un video nuovo di un post aspetta sul
   telefono solo quando non resta nessun video di un messaggio. Cambia
   ADR-0289 punto 8 e la riga della privacy dei messaggi: li aggiorna
   TASK-333, che ne chiede il sì all'utente.
3. **I dati mobili.** Proposta: il video parte quando la sua pagina è
   sullo schermo, anche con i dati mobili. È l'ultima pagina, ci si
   arriva solo scorrendo; prima si scarica solo la locandina, e un video
   visto non si riscarica. Alternativa: con i dati mobili la locandina
   con ▶ e il video parte con un tocco, o un interruttore in «Settings»;
   tutte e due vogliono `expo-network`, un altro modulo nativo.
   — *Risposta:* la domanda è stata fatta il 2026-10-29 e l'utente ha
   risposto con un'altra cosa (la frase della scelta 2). **Accettata su
   delega dell'utente del 2026-10-29, da rivedere**: la proposta, il
   video parte sulla sua pagina anche con i dati mobili, e niente
   `expo-network`. La delega è di 23 ore, fino al 2026-10-30 16:15Z
   (sessione «Coordinatore automatico 23 ore»), comunicata dal
   Coordinatore e letta in quella sessione: «porta avanti accetta tutto».
   Una risposta dell'utente prende il suo posto.
4. **I testi e la privacy** (sotto, «I testi»): in inglese da approvare,
   le traduzioni dei testi dell'app le fa l'agente nelle parti; la
   privacy qui nelle cinque lingue.
   — *Risposta:* non ancora chiesta. **Accettata su delega dell'utente
   del 2026-10-29, da rivedere**: i testi e la privacy come scritti
   sotto. Nessuno va online prima della parte D, che chiede di nuovo il
   sì dell'utente su testi, permessi e privacy prima della build.

## Il disegno tecnico (deciso dall'agente su delega dell'utente)

In ADR-0292: un file su disco in `data/media/posts/` finché altri vedono
il post, il caricamento del file nudo con un `PUT`, i controlli comuni di
ADR-0289, la lettura con `Range` e con chiave e token, l'ultima pagina
della striscia, il disegno aperto, il video della corsa a 540 × 960, i
permessi della 1.0.2, la stima dello spazio, segnalazione e blocco.

## Le parti

Ognuna nella sua PR, dopo le risposte. A non tocca niente di nativo e può
andare quando è pronta; B e C entrano in `main` con `expo-video` escluso
dall'autolinking, quindi l'impronta non cambia e nella 1.0 e nella 1.0.1
non si vede niente; D è la build 1.0.2.

### Parte A — API

1. Migrazione: `drawing_videos` (una riga per disegno, `ON DELETE
   CASCADE` da `drawings`).
2. `media_files.py` (comune con TASK-333, già in `main`): solo import
   (`MediaFolder`, `video_facts`, `without_metadata`, `cap_bytes`).
3. `drawing_videos.py` (nuovo): `PUT`, `DELETE`
   `/me/activities/{key}/drawing/video`, `PUT …/video/poster`, `GET
   /drawings/{id}/video` e `…/video/poster` con `Range`; i limiti al
   minuto e al giorno; lo spazio pieno che toglie i video dei messaggi
   dal più vecchio con `MessageMedia.free_videos(needed_bytes)` di
   TASK-333 (la sua parte D, nome e firma già fissati), e `507` come i
   messaggi solo quando non ne resta nessuno. Questa parte conta lo
   spazio delle due tabelle e decide quando è pieno per un video di un
   post.
4. `drawings.py`: `video` nei corpi di «My activities», del disegno e del
   Feed, letto insieme alle foto; «Only me» toglie riga e file.
5. La pulizia di ogni ora di ADR-0289 copre anche `data/media/posts`.
6. `report_email.py`: l'email dice che il post ha un video, la pagina del
   link lo mostra.
7. `SHAPEROUTE_POST_MEDIA_MAX_GB` in `.env.example` (`data/media` è già
   montata in `compose.yaml` da TASK-333 A).
8. `shared-types`: `DrawingVideo`, i limiti; esempi.
9. Test deterministici con un PostgreSQL vero e MP4 piccoli fatti nei
   test: `206` a una richiesta `Range`, `404` a chi non vede il disegno e
   attraverso un blocco, `409` con «Only me», `413`, `422`, il luogo reso
   `free`, «Only me» che toglie il file, la corsa cancellata che lo lascia
   alla pulizia, il tetto.
10. `API.md`, `DATABASE.md`, `DEPLOY.md`: per la cartella, lo spazio e
    perché non è nelle copie un rimando a «Foto e video dei messaggi»
    (TASK-333), non una copia; qui solo `data/media/posts`, il tetto di
    15 GB e la prova `Range` attraverso Caddy. Prima di aggiornare il
    server, un `df -h` nuovo (la sera del 2026-10-29: 57 GB liberi su `/`,
    dove sta `data/media`).

File toccati:

```
services/api/migrations/00NN_drawing_videos.sql      (nuovo; numero al merge)
services/api/shaperoute_api/drawing_videos.py        (nuovo)
services/api/shaperoute_api/drawings.py
services/api/shaperoute_api/app.py
services/api/shaperoute_api/report_email.py
services/api/tests/test_drawing_videos.py            (nuovo)
services/api/tests/test_drawings.py
services/api/tests/test_report_email.py
packages/shared-types/src/index.ts
packages/shared-types/fixtures/drawing-video.json    (nuovo)
packages/shared-types/fixtures/feed-video.json       (nuovo)
.env.example
docs/API.md
docs/DATABASE.md
docs/DEPLOY.md
docs/tasks/TASK-336.md
docs/STATUS.md
```

### Parte B — L'app: scegliere e mandare il video

1. `social/pickDrawingVideo.ts` (nuovo): galleria e fotocamera con
   `expo-image-picker` (ADR-0292, punto 10), durata e peso controllati,
   la locandina dalla WebView nascosta.
2. `share/`: «Run video» fa il video della corsa a 540 × 960 e 2 Mbit/s
   con la pagina di ADR-0254, e la locandina dall'ultimo fotogramma.
3. `social/drawingVideo.ts` (nuovo): il file nei documenti e la lista
   «mandato o no», come `drawingPhotos.ts`; `syncVideo` dopo le foto.
4. `api/drawingVideos.ts` (nuovo): `PUT` del file nudo (`File` di
   `expo-file-system` come corpo, come TASK-333), della locandina,
   `DELETE`; i problemi in parole.
5. `drawingOutbox.ts`: dopo le foto, il video.
6. `PublicParts.tsx`, `RunEnd.tsx` e «My activities»: «Add video», il
   foglio con «Run video», «Choose a video», «Record a video» (solo con
   la 1.0.2) e «Cancel»; la miniatura con «Remove video»; i testi di
   «Only me».
7. «Add video» c'è solo se il modulo nativo di `expo-video` c'è: nella 1.0
   e nella 1.0.1 non si vede.
8. Account cancellato e corsa cancellata portano via il file dal
   telefono.
9. Test deterministici; i testi nelle cinque lingue
   (`tables.test.ts`); impronta iOS `83793e26` invariata su una copia
   pulita.

File toccati (da confermare quando parte, sul codice di allora):

```
apps/mobile/src/social/pickDrawingVideo.ts            (nuovo)
apps/mobile/src/social/pickDrawingVideo.test.ts       (nuovo)
apps/mobile/src/social/drawingVideo.ts                (nuovo)
apps/mobile/src/social/drawingVideo.test.ts           (nuovo)
apps/mobile/src/api/drawingVideos.ts                  (nuovo)
apps/mobile/src/api/drawingVideos.test.ts             (nuovo)
apps/mobile/src/share/postVideo.ts                    (nuovo: il video della corsa per il post)
apps/mobile/src/share/videoPage.ts
apps/mobile/src/social/drawingOutbox.ts
apps/mobile/src/social/PublicParts.tsx
apps/mobile/src/activities/RunEnd.tsx
apps/mobile/src/activities/ActivitiesList.tsx
apps/mobile/src/i18n/it.ts
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/es.ts
apps/mobile/src/i18n/fr.ts
docs/UI.md
docs/tasks/TASK-336.md
docs/STATUS.md
```

### Parte C — L'app: il video nel Feed e nel disegno aperto

1. `expo-video` in `package.json`, escluso dall'autolinking fino al
   taglio della 1.0.1 (accanto a `expo-document-picker`).
2. `feed/FeedVideoPage.tsx` (nuovo): l'ultima pagina della striscia, la
   locandina, senza suono e in loop sulla sua pagina, il tocco per il
   suono e l'altoparlante, ferma fuori dalla pagina, fuori dallo schermo
   e con l'app in secondo piano.
3. `FeedPost.tsx`: la pagina del video dopo le foto, il suo puntino.
4. `FeedScreen.tsx`: quale scheda si vede, per farne suonare una sola.
5. `social/DrawingVideo.tsx` (nuovo) e `DrawingCard.tsx`: il video nella
   fila delle foto, a tutto schermo con il suono.
6. La sorgente con chiave e token (`drawingVideoSource`, come
   `drawingPhotoSource` di TASK-330) e la cache a 200 MB.
7. Test deterministici, con `expo-video` finto nei test.

File toccati (da confermare quando parte):

```
apps/mobile/package.json
package-lock.json
apps/mobile/src/feed/FeedVideoPage.tsx               (nuovo)
apps/mobile/src/feed/FeedVideoPage.test.tsx          (nuovo)
apps/mobile/src/feed/FeedPost.tsx
apps/mobile/src/screens/FeedScreen.tsx
apps/mobile/src/social/DrawingVideo.tsx              (nuovo)
apps/mobile/src/social/DrawingVideo.test.tsx         (nuovo)
apps/mobile/src/social/DrawingCard.tsx
apps/mobile/src/social/drawingsDoor.ts
apps/mobile/src/api/drawings.ts
apps/mobile/src/i18n/it.ts
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/es.ts
apps/mobile/src/i18n/fr.ts
docs/UI.md
docs/tasks/TASK-336.md
docs/STATUS.md
```

### Parte D — La build 1.0.2

Col sì dell'utente a ogni passo, dopo il taglio della 1.0.1.

1. `expo-video` fuori dall'esclusione dell'autolinking.
2. `app.json`: i testi del microfono e della fotocamera (scelta 4);
   «Record a video» acceso.
3. «Help» e «Privacy» nelle cinque lingue, il sito rifatto
   (`make_privacy.mjs`).
4. Prima: il server con la parte A (`df -h` per i due tetti, prova
   `Range` attraverso Caddy).
5. La build, la prova sul telefono (Feed, suono, dati, galleria,
   fotocamera, «Only me»), la revisione di Apple, Google Play.

File toccati (da confermare): `apps/mobile/package.json`,
`apps/mobile/app.json`, `apps/mobile/src/about/content/{en,it,de,es,fr}.ts`,
i file del sito che `make_privacy.mjs` rifà, `docs/tasks/TASK-336.md`,
`docs/STATUS.md`.

## I testi

In inglese, da approvare (scelta 4).

**Il modulo** (fine corsa e «My activities»):

- «Add video»; il foglio: «Run video», «Choose a video», «Record a
  video», «Cancel».
- «Making the video…» mentre si fa il video della corsa.
- «Video» (VoiceOver, sulla miniatura), «Remove video».
- «This video is longer than 30 seconds. Trim it and try again.»
- «This video is too large. Choose a shorter one.»
- «Could not open the video. Try again.»
- «Could not make the video. Try again.»
- Al posto dei due testi di oggi sotto «Who can see it», quando c'è un
  video: «Photos and videos of a run only you can see stay on this
  phone. Delete the app or change phone and they are gone.» e «Its photos
  and video leave MuW and stay only on this phone.»

**Il Feed e il disegno aperto** (VoiceOver): «Video, {seconds} seconds»,
«Sound on», «Sound off».

**I permessi della build 1.0.2** (`app.json`):

- Fotocamera: «MuW uses the camera for the outline your route will draw,
  and for the photos and videos you add to your runs.»
- Microfono: «MuW records sound only in the videos you take for your
  runs. During your activity it only speaks the directions.»
- Foto: «MuW uses the pictures and videos you choose to trace the outline
  of your route or to add them to your runs.»

**Help**, in «Publish and share», un paragrafo nuovo dopo il primo: «A run
you publish can have up to three photos and one video of up to 30
seconds: the video of your run that MuW makes, or one of yours. In the
Feed the video plays without sound: tap it to hear it.»

**Privacy**, in «Your runs and their GPS tracks», un paragrafo nuovo dopo
l'ultimo:

- en: «A run you publish can have one video of up to 30 seconds: the
  video of your run that MuW makes, or one you choose or record. It
  reaches our server only while other members can see the run. It is
  kept as your phone sends it, without the place it was shot, and is not
  in our backup copies. When you set the run to «Only me», delete it or
  delete your account, the video is deleted from our server within an
  hour; your phone keeps its copy. Whoever can see the run can watch its
  video, and when someone reports the run, the person who runs MuW sees
  the video too.»
- it: «Una corsa che pubblichi può avere un video fino a 30 secondi: il
  video della corsa che fa MuW, o uno che scegli o registri tu. Arriva sul
  nostro server solo finché gli altri iscritti possono vedere la corsa.
  Lo teniamo come lo manda il tuo telefono, senza il luogo in cui è stato
  girato, e non è nelle nostre copie di sicurezza. Quando metti la corsa
  su «Only me», la cancelli o cancelli l'account, il video si cancella dal
  nostro server entro un'ora; il tuo telefono tiene la sua copia. Chi può
  vedere la corsa può guardarne il video, e quando qualcuno segnala la
  corsa, anche chi gestisce MuW vede il video.»
- de: «Ein Lauf, den du veröffentlichst, kann ein Video von bis zu 30
  Sekunden haben: das Video deines Laufs, das MuW erstellt, oder eines,
  das du auswählst oder aufnimmst. Es kommt nur auf unseren Server,
  solange andere Mitglieder den Lauf sehen können. Wir speichern es so,
  wie dein Telefon es sendet, ohne den Ort, an dem es gedreht wurde, und
  es ist nicht in unseren Sicherungskopien. Wenn du den Lauf auf «Only
  me» stellst, ihn löschst oder dein Konto löschst, wird das Video
  innerhalb einer Stunde von unserem Server gelöscht; dein Telefon behält
  seine Kopie. Wer den Lauf sehen kann, kann sein Video ansehen, und wenn
  jemand den Lauf meldet, sieht auch die Person, die MuW betreibt, das
  Video.»
- fr: «Une course que tu publies peut avoir une vidéo de 30 secondes au
  plus : la vidéo de ta course que fait MuW, ou une que tu choisis ou
  enregistres. Elle n'arrive sur notre serveur que tant que les autres
  membres peuvent voir la course. Nous la gardons telle que ton téléphone
  l'envoie, sans le lieu où elle a été tournée, et elle n'est pas dans nos
  copies de sauvegarde. Quand tu mets la course sur «Only me», la
  supprimes ou supprimes ton compte, la vidéo est effacée de notre serveur
  dans l'heure ; ton téléphone garde sa copie. Qui peut voir la course
  peut regarder sa vidéo, et quand quelqu'un signale la course, la
  personne qui gère MuW voit aussi la vidéo.»
- es: «Una carrera que publicas puede tener un vídeo de hasta 30
  segundos: el vídeo de tu carrera que hace MuW, o uno que eliges o
  grabas. Llega a nuestro servidor solo mientras otros miembros pueden
  ver la carrera. Lo guardamos tal como lo envía tu teléfono, sin el lugar
  donde se grabó, y no está en nuestras copias de seguridad. Cuando pones
  la carrera en «Only me», la borras o borras tu cuenta, el vídeo se
  borra de nuestro servidor en menos de una hora; tu teléfono conserva su
  copia. Quien puede ver la carrera puede ver su vídeo, y cuando alguien
  denuncia la carrera, la persona que gestiona MuW también ve el vídeo.»

Nota: oggi la privacy non dice niente delle foto dei post (TASK-208):
vanno sul server, ridotte e senza EXIF, finché altri vedono il post, e
sono nelle copie di notte. È fuori da questo task; da proporre a parte.

## Criteri di accettazione

Della proposta (questa PR):

- [x] Le scelte 1 e 2 hanno una risposta dell'utente, con le sue parole,
      scritta qui; 3 e 4 accettate su delega, da rivedere.
- [x] ADR-0292 e le parti aggiornati alle risposte.
- [x] TASK-333 informato della scelta del lettore (il suo punto 9) e
      della regola a spazio pieno (il suo punto 8).

Delle parti:

- [ ] A: un video si carica, si sostituisce e si toglie; si legge a pezzi
      (`206`) con chiave e token solo da chi vede il post, `404` agli
      altri e attraverso un blocco; oltre durata e peso `422` e `413`;
      il luogo non resta nel file; «Only me» lo toglie dal disco subito,
      corsa e account cancellati entro un'ora; a spazio pieno se ne vanno
      i video dei messaggi dal più vecchio, mai quelli dei post, e `507`
      solo quando non ne resta nessuno.
- [ ] B: «Run video», galleria e (dalla 1.0.2) fotocamera danno un video
      entro i limiti, che arriva al server dopo il disegno e le foto e
      aspetta senza rete, con «Only me» e sopra il tetto; nella 1.0 e
      nella 1.0.1 «Add video» non c'è.
- [ ] C: nel Feed il video è l'ultima pagina, parte senza suono solo
      sulla sua pagina, uno alla volta, si ferma fuori; un tocco accende
      e spegne il suono; nel disegno aperto si guarda a tutto schermo.
- [ ] Impronta iOS `83793e26` invariata in A, B e C, misurata su una copia
      pulita; cambia solo con D.
- [ ] D: provato sul telefono (Wi-Fi e dati mobili, galleria, fotocamera,
      «Only me», segnalazione), privacy e «Help» nelle cinque lingue.
- [ ] Test verdi in locale e in CI.

## File toccati

Questa PR (documenti):

```
docs/tasks/TASK-336.md                                  (nuovo)
docs/DECISIONS.md
docs/STATUS.md
docs/INDEX.md
```

Le parti A, B, C e D hanno i loro elenchi sopra, da confermare quando
partono.

## Fuori scope

- Più di un video per post; video oltre i 30 s; tagliare o montare il
  video nell'app.
- La musica nel video della corsa del post (resta in «Share your run»,
  TASK-301).
- Ridurre il video su Android (WebCodecs nella WebView): un seguito
  comune con TASK-333.
- Il video nella scheda «Photos» del profilo (TASK-324), nelle corse di
  gruppo, in Strava e in Apple Salute.
- I video dei messaggi: sono di TASK-333, che segue la scelta 1.
- Object Storage o una CDN.
- La riga delle foto dei post nella privacy (nota sopra).
