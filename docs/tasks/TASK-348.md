# TASK-348 — Il compositore del post: foto e video in primo piano, il disegno GPS, un editor

**Stato**: Proposta · 2026-10-30 · le scelte di prodotto fatte dall'utente
il 2026-10-30; nulla di nativo prima del taglio della 1.0.2
**Fase**: 4 · **Branch**: `docs/TASK-348-post-composer` (documenti), poi
una PR per parte
**ADR**: ADR-0301 (proposta), che estende ADR-0170 (le foto dei post),
ADR-0275 (la striscia del Feed) e ADR-0292 (il video nei post, TASK-336);
usa ADR-0254 (il video della corsa)
**Numeri**: TASK-348 / ADR-0301, **assegnati dal Coordinatore** il
2026-10-30.

## Obiettivo

Quando pubblica una corsa, l'utente compone un post di più elementi: le
sue foto e i suoi video in primo piano, il disegno GPS come secondo piano
o come pagina a sé, e li ritocca con un editor integrato prima di
«Publish».

Richiesta dell'utente del 2026-10-30 (testo incollato, interrotto a
«Layout tra cui scegliere, con»), approvata con «Vai con la proposta»:

- l'utente sceglie il disegno GPS e aggiunge foto o video dalla galleria
  o dalla fotocamera;
- post a più contenuti (carosello): fino a 10 elementi tra foto, video e
  disegno, riordinabili trascinandoli;
- layout tra cui scegliere (il resto del testo manca);
- un editor foto e video «professionale» (stile Instagram, Strava,
  CapCut, VSCO).

La proposta di partenza, con l'analisi del codice, è in
`out/post-editor/PROPOSTA.md` (fuori dal repository).

## Contesto da leggere

- `docs/DECISIONS.md` ADR-0170 «Parte B» (foto sul telefono, `syncPhotos`),
  ADR-0275 (la striscia del Feed), ADR-0292 (il video nei post), ADR-0289
  (file su disco, `media_files.py`), ADR-0254 (il video della corsa).
- `docs/tasks/TASK-336.md` «Le scelte dell'utente»: un video per post,
  30 s, 40 MB, 960 × 540, tetto 15 GB, `expo-video` nella 1.0.2.
- `docs/API.md` «Drawings».

## Vincoli (dal Coordinatore, 2026-10-30)

- **TASK-336 / ADR-0292** (il video nei post) e **ADR-0289** (la regola
  comune dei media): qui si citano le loro regole, non se ne scrivono di
  nuove. Se l'utente vuole più video per post, serve una modifica
  esplicita ad ADR-0292 con lo spazio sul server ricalcolato.
- **`FeedPost.tsx`** lo toccano anche TASK-336 B, TASK-339 B (il nuovo
  aspetto) e TASK-345 A (una riga): prima del codice si chiede l'ordine al
  Coordinatore.
  Ordine dato dal Coordinatore per la parte app: TASK-339 B, TASK-355 A,
  TASK-348 A, TASK-336 B. Il contatore delle pagine del carosello è di
  questa parte (decisione con TASK-355, #670).
- **Parte A** con `react-native-view-shot` e `PanResponder`, nessuna
  dipendenza nuova, impronta iOS `83793e26` invariata.
  `react-native-view-shot` 5.1.0 è già in `apps/mobile/package.json` e lo
  usa `share/sharePicture.ts` (TASK-231): non è una dipendenza nuova.

## Cosa c'è già e cosa si riusa

| Pezzo | Dove | Riuso |
|---|---|---|
| Form di pubblicazione | `social/PublicParts.tsx` (`PhotosRow`, `nextPlace`), `activities/RunEnd.tsx` | Punto d'ingresso: «Add photo» apre il compositore |
| Scelta e riduzione | `social/pickDrawingPhoto.ts` | Scelta multipla (`allowsMultipleSelection`, `selectionLimit`), foto e video; riduzione a 1080 px invariata |
| Foto sul telefono e invio | `social/drawingPhotos.ts`, `drawingOutbox.ts`, `drawingsDoor.ts` | Stessa via: un file sul telefono per elemento, inviato dopo il `PUT` del disegno |
| Carosello del Feed | `feed/FeedPost.tsx` (TASK-315, TASK-330) | Lettore del carosello; `Pressable` dentro lo `ScrollView` |
| Video della corsa | `share/videoScene.ts`, `videoPage.ts`, `mp4.ts`, `videoMusic.ts` | Un elemento del carosello con un tocco |
| Immagine composta | `share/PostImage.tsx`, `sharePicture.ts`, `react-native-view-shot` | I layout delle foto nella parte A senza nulla di nativo |
| Linea del disegno | `share/postRun.ts` (`withoutEnds`), `feed/turnedLine.ts` | La linea sopra la foto, già tagliata |
| Video nei post | TASK-336, `media_files.py` | Caricamento, lettura con `Range`, tetto, lettore |

Nell'app mancano `react-native-gesture-handler`, `react-native-reanimated`,
`@shopify/react-native-skia` ed `expo-video`: tutti nativi, quindi solo
dalla build 1.0.2 (l'impronta iOS `83793e26` resta per la 1.0.1).

## Il disegno tecnico (proposta, deciso dall'agente su delega dell'utente)

1. **Un post è una lista ordinata di elementi**, al più 10: il disegno
   (sempre uno, la mappa viva del Feed), foto, video, il video della corsa.
2. **Modifiche non distruttive**: l'originale resta sul telefono; le
   modifiche sono un JSON (ritaglio, rotazione, filtro, regolazioni,
   testo, adesivi; per i video anche inizio e fine) fino a «Publish».
3. **Il layout è una funzione pura** (`layoutFrame(layout, size)` →
   rettangoli), la stessa per anteprima ed esportazione, con test
   deterministici.
4. **«Publish» appiattisce**: ogni foto diventa un JPEG 1080 × 1350 (4:5)
   con disegno e modifiche dentro, ogni video un MP4 con i limiti di
   TASK-336. Il server riceve file normali e non sa nulla dell'editor.
   Il disegno dentro la foto è **sempre la linea già tagliata del Feed**
   (`withoutEnds` e `POST_CUT_M` = 200 m, `share/postRun.ts`): non si
   riapre la porta di casa di chi corre. Una foto appiattita non si può tagliare dopo, quindi questo si
   controlla con un test.
5. **API**: 10 posti per le foto (`DRAWING_PHOTO_PLACES`; `DRAWING_MAX_PHOTOS`
   resta 3 finché l'app non passa al limite nuovo, nella parte A app) e un
   ordine riscrivibile degli
   elementi (oggi «un posto svuotato resta vuoto»); un'app vecchia continua
   a vedere le foto in ordine.
6. **Librerie** (ognuna è una dipendenza nuova e va chiesta all'utente):
   - parte A, nessuna: riordino con `PanResponder` + `Animated` di React
     Native, layout con `react-native-view-shot` (c'è già);
   - dalla 1.0.2: `react-native-gesture-handler` + `react-native-reanimated`
     (gesti), `@shopify/react-native-skia` (filtri come matrici di colore e
     LUT, regolazioni, testo, adesivi, JPEG finale con `makeImageSnapshot`),
     `expo-video` (già scelto in TASK-336);
   - per esportare un video modificato: un modulo Expo nostro in
     `apps/mobile/modules/` (AVFoundation su iOS, Media3 Transformer su
     Android), senza librerie di terzi.
   - Scartati: ffmpeg-kit (ritirato nel 2025, licenza GPL, 30–60 MB);
     WebCodecs nella WebView per i video dell'utente (serve un demuxer MP4,
     lento a 1080p, non garantito su Android).

## Le scelte dell'utente

Da chiedere una alla volta, ognuna con la proposta già pronta. Le
risposte si scrivono qui.

1. **Il resto della richiesta**: il testo incollato si ferma a «Layout tra
   cui scegliere, con».
   — *Risposta (2026-10-30):* «Vai con la proposta»: si procede con
   quello che c'è; i layout e l'editor li propone l'agente qui sotto.
2. **Quanti video per post.** TASK-336 ha il sì per un video ≤ 30 s; la
   richiesta parla di 10 elementi tra foto e video. Proposta: fino a 10
   elementi, al più 3 video da 30 s; il tetto di 15 GB si riempie circa
   tre volte più in fretta. Se l'utente dice sì: una modifica esplicita
   ad ADR-0292 con la stima dello spazio rifatta.
   — *Risposta (2026-10-30):* «Sì, al più 3». Fino a 10 elementi, al più
   3 video da 30 s l'uno (il video della corsa conta come uno). La modifica
   è «ADR-0292, aggiunta» in `DECISIONS.md`: il tetto di 15 GB non cambia,
   e con l'ipotesi media si raggiunge in 5–10 settimane invece di circa
   quattro mesi.
3. **I layout.** Proposta, quattro: foto a tutto schermo con il disegno in
   un riquadro d'angolo; la linea del disegno sopra la foto, trasparente;
   metà foto e metà disegno; disegno grande con la foto nell'angolo.
   — *Risposta (2026-10-30):* «Sì, i quattro».
4. **Il disegno nel carosello.** Proposta: spostabile; la scheda del Feed
   mostra come copertina il primo elemento.
   — *Risposta (2026-10-30):* «Sì, spostabile».
5. **Appiattire o no.** Proposta: appiattire (foto con il disegno dentro).
   Alternativa: il layout ricostruito nel Feed, con la linea nitida, ma
   un'app vecchia vedrebbe solo la foto nuda.
   — *Risposta (2026-10-30):* «Sì, appiattire».
6. **Cosa c'è nell'editor.** Proposta: ritaglio e raddrizza, 12–15 filtri,
   regolazioni (esposizione, contrasto, saturazione, calore, ombre e luci,
   vignettatura, grana), testo, adesivi, prima/dopo, annulla e ripeti,
   «applica a tutte»; per i video taglio di inizio e fine, ritaglio 4:5 o
   9:16, filtri, il disegno sopra.
   — *Risposta (2026-10-30):* «Sì, tutte».
7. **I testi e la privacy**: in inglese da approvare, la privacy nelle
   cinque lingue se cambia (10 foto invece di 3, più video).
   — *Risposta (2026-10-30):* «Approvo così», i testi e la privacy di «I
   testi» qui sotto. I testi dell'editor no: li portano le parti B e C.

8. **Il limite: 10 con il disegno o 10 più il disegno.** Il testo di Help
   approvato diceva «up to 10 photos and the drawing» (11 elementi), la
   richiesta 10 elementi tra foto, video e disegno. Proposta: 10 in tutto.
   — *Risposta (2026-10-30):* «10 col disegno». Al più 9 tra foto e video
   più il disegno. Il limite lo mette l'app; l'API tiene 10 posti.

## I testi

In inglese, da approvare (scelta 7). Le traduzioni dei testi dell'app le fa
l'agente nelle parti; la privacy è qui nelle cinque lingue. Le parti B e C
portano i testi dell'editor (nomi dei filtri e degli strumenti) nella loro
PR, col sì dell'utente.

**Il compositore** (parte A): «Your post»; «Hold and drag to reorder»;
«Move left» e «Move right» (VoiceOver, chi non può trascinare); «Drawing»;
«Layout»; i quattro layout: «Drawing in the corner», «Line on the photo»,
«Half and half», «Photo in the corner»; «Up to 10 in a post.»; «Could not
prepare this photo. Try again.». Parte C: «Up to 3 videos in a post.».

**Help**, in «Publish and share» (parte A; il numero cambiato dalla scelta
8): «A run you publish can have up to 9 photos and the drawing. Hold one and drag it to change the order: the
first is what people see in the Feed. Choose a layout to put the drawing on
a photo.». Parte C, al posto di «up to 9 photos and the drawing»: «up to 10
items: photos, up to 3 videos of up to 30 seconds each, and the drawing».

**Privacy**, in «Your runs and their GPS tracks», un paragrafo nuovo (parte
A), con la data del giorno del merge:

- en: «A photo you publish can have the drawing of your run inside the
  picture. It is the same drawing the Feed shows, cut at its start and end.»
- it: «Una foto che pubblichi può avere dentro l'immagine il disegno della
  tua corsa. È lo stesso disegno che mostra il Feed, tagliato all'inizio e
  alla fine.»
- es: «Una foto que publiques puede llevar dentro de la imagen el dibujo de
  tu carrera. Es el mismo dibujo que muestra el Feed, cortado al principio
  y al final.»
- fr: «Une photo que tu publies peut contenir le dessin de ta course dans
  l'image. C'est le même dessin que celui du Feed, coupé au début et à la
  fin.»
- de: «Ein Foto, das du veröffentlichst, kann die Zeichnung deines Laufs im
  Bild enthalten. Es ist dieselbe Zeichnung wie im Feed, am Anfang und am
  Ende gekürzt.»

Parte C: il testo di TASK-336 «one video of up to 30 seconds» diventa «up
to three videos of up to 30 seconds each» (e così nelle altre lingue).

## Cosa fare (le parti)

Ogni parte ha la sua PR e parte da `main` solo col via del Coordinatore.

- **A — Carosello di foto e layout, con un OTA.** API: fino a 10 foto e
  l'ordine (migrazione, il primo numero libero in `main` al merge). App:
  scelta multipla, riordino col dito, i layout, «Publish» che appiattisce
  con `view-shot`, il Feed con fino a 10 pagine. Impronta iOS invariata.
- **B — Editor foto (1.0.2).** Skia, gesture-handler, reanimated, dopo il
  sì a ciascuna dipendenza.
- **C — Video nel carosello (1.0.2, dopo TASK-336 A–D).** Taglio, ritaglio,
  filtri, disegno sopra, il modulo di esportazione nativo.
- **D — Rifiniture.** Preset salvati, musica (`videoMusic.ts`), velocità.

## Criteri di accettazione

- [x] Le scelte 2–8 hanno una risposta dell'utente scritta qui.
- [ ] Ogni dipendenza nuova ha il sì dell'utente scritto qui.
- [ ] Parte A: un post con 9 foto e il disegno, riordinato, si pubblica e
      si vede nel Feed nello stesso ordine; un'app vecchia vede le foto.
- [x] Parte A: un test dimostra che il disegno nella foto usa la linea tagliata del Feed
      (`composer/ComposedPhoto.test.tsx`).
- [x] Parte A: `layoutFrame` ha test deterministici per ogni layout
      (`composer/layoutFrame.test.ts`).
- [x] Parte A: l'impronta iOS resta quella di `main` su una copia pulita:
      `83793e26` prima della 1.0.1; dopo l'unione con la #620 (Apple Health)
      `6f8bba4c`, uguale a `main` (misurata il 2026-11-04).
- [ ] Parti B e C: entrano solo nella build 1.0.2.

## File toccati

Questa PR (solo documenti):

```
docs/tasks/TASK-348.md
docs/DECISIONS.md
docs/STATUS.md
docs/INDEX.md
```

Parte A, API (#665):

```
docs/API.md
docs/STATUS.md
docs/tasks/TASK-348.md
packages/shared-types/fixtures/drawing-details-imported.json
packages/shared-types/fixtures/drawing-order-request.json
packages/shared-types/fixtures/feed-imported.json
packages/shared-types/fixtures/my-drawing-imported.json
packages/shared-types/src/index.ts
packages/shared-types/test/drawing-details.test.ts
packages/shared-types/test/userPhotos.test.ts
services/api/migrations/0041_drawing_item_order.sql
services/api/shaperoute_api/drawing_photos.py
services/api/shaperoute_api/drawings.py
services/api/tests/test_drawing_photos.py
services/api/tests/test_drawings.py
services/api/tests/test_feed.py
```

Parte A, app (via del Coordinatore del 2026-11-03, dopo la #700; nessun
`App.tsx`):

```
apps/mobile/src/about/AboutPage.test.tsx
apps/mobile/src/about/content/de.ts
apps/mobile/src/about/content/en.ts
apps/mobile/src/about/content/es.ts
apps/mobile/src/about/content/fr.ts
apps/mobile/src/about/content/it.ts
apps/mobile/src/about/documents.test.ts
apps/mobile/src/activities/ActivityCard.tsx
apps/mobile/src/activities/RunEnd.tsx
apps/mobile/src/activities/RunEndForm.test.tsx
apps/mobile/src/activities/activitiesDoor.ts
apps/mobile/src/api/drawingOrder.ts
apps/mobile/src/feed/FeedPost.tsx
apps/mobile/src/feed/FeedPostOrder.test.tsx
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/es.ts
apps/mobile/src/i18n/fr.ts
apps/mobile/src/i18n/it.ts
apps/mobile/src/profile/ProfileGallery.test.tsx
apps/mobile/src/social/DrawingsGrid.test.tsx
apps/mobile/src/social/PublicParts.test.tsx
apps/mobile/src/social/PublicParts.tsx
apps/mobile/src/social/PublicRow.test.tsx
apps/mobile/src/social/PublicRow.tsx
apps/mobile/src/social/composer/ComposedPhoto.test.tsx
apps/mobile/src/social/composer/ComposedPhoto.tsx
apps/mobile/src/social/composer/PostComposer.test.tsx
apps/mobile/src/social/composer/PostComposer.tsx
apps/mobile/src/social/composer/flattenPhoto.test.ts
apps/mobile/src/social/composer/flattenPhoto.ts
apps/mobile/src/social/composer/layoutFrame.test.ts
apps/mobile/src/social/composer/layoutFrame.ts
apps/mobile/src/social/composer/pickPhotos.ts
apps/mobile/src/social/composer/pickPhotos.test.ts
apps/mobile/src/social/composer/postOrder.test.ts
apps/mobile/src/social/composer/postOrder.ts
apps/mobile/src/social/drawingOrder.test.ts
apps/mobile/src/social/drawingOrder.ts
apps/mobile/src/social/drawingOutbox.ts
apps/mobile/src/social/drawingPhotos.ts
apps/mobile/src/social/drawingsDoor.ts
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-348.md
packages/shared-types/src/index.ts
site/privacy/de/index.html
site/privacy/es/index.html
site/privacy/fr/index.html
site/privacy/index.html
site/privacy/it/index.html
site/tests/privacy.test.mjs
```

Le parti elencano i loro file prima del codice e li mandano al
Coordinatore; `PublicParts.tsx` e `drawingsDoor.ts` sono anche di
TASK-336, `FeedPost.tsx` anche di TASK-336 B, TASK-339 B e TASK-345 A:
l'ordine lo decide il Coordinatore.

## Fuori scope

- Montaggio di più clip in un video solo, transizioni, sottotitoli
  automatici (CapCut vero e proprio).
- Un'AI che ritocca le foto o sceglie il layout.
- Modificare foto e video dopo «Publish» (si toglie e si rimette).
- Condividere il carosello su Instagram come carosello (oggi si condivide
  un'immagine sola).

## Esito

*(a fine task)*

- 2026-11-04, parte A: API con la #665 (migrazione 0041), app con la #711
  (testa `348d1ed0`, CI verde, impronta iOS `6f8bba4c` uguale a `main`).
  Manca la prova sul telefono del primo criterio di A; l'OTA di
  produzione col sì dell'utente (il server è già alla 0041). Parti B, C e D aperte.
