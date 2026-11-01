# TASK-351 — Il video della corsa con la mappa sotto: il look premium, il 3D e tre stili

**Stato**: Proposta · 2026-10-30 · la richiesta è dell'utente (2026-10-30);
le scelte 2, 3, 4 e 6 qui sotto sono la raccomandazione, accettata su
delega dell'utente del 2026-10-29, da rivedere; la scelta sulla privacy (5)
è dell'utente («Sì, va bene», 2026-10-30), come i nomi degli stili
(«Sì, questi», 2026-10-30); i punti tecnici sono decisi dall'agente su
delega dell'utente
**Fase**: 4 · **Branch**: `docs/TASK-351-video-map-styles` (i documenti,
worktree `.claude/worktrees/TASK-351-docs`: il nome `TASK-351` è occupato
dal branch di TASK-352), poi uno per parte · **ADR**: ADR-0303 (estende
ADR-0254 e ADR-0262; usa ADR-0293) · **Migrazione**: nessuna · **Solo
app** (nessun server, nessuna build nativa, nessuna dipendenza nuova)
**Numeri**: TASK-351 / ADR-0303, assegnati dal Coordinatore il 2026-10-30,
con le sue condizioni (sotto).

## Obiettivo

«Export video» in «Share your run» (TASK-295, ADR-0254; la musica di
TASK-301, ADR-0262) fa un video che non è più sul giallo del post: sotto
la linea della corsa c'è **la mappa**, nel look premium di TASK-339
(ADR-0293), e chi corre sceglie fra **tre stili** prima di esportare:
«Night», la mappa scura calda; «Day», la mappa chiara; «3D», la mappa
inclinata con le colline, come la mappa 3D dell'app e come i video di
Strava.

## La richiesta dell'utente (2026-10-30)

Parola per parola: «fai anche lo restyle del video post corsa con questo
stile aggiungendo la mappa sotto, magari la mappa in 3d come strava... e
la possibilità di avere 3 stili per il video ma apri un altra task».

## La proposta

Il canvas (Design, privato): https://claude.ai/artifact/MEGmg4FJp4mBKKFJriFkMV
— sette tavole: il video di oggi; i tre stili all'ultimo fotogramma
(Night, Day, 3D); «Share your run» con la riga «Style»; i 12 secondi; il
foglio del sistema (misure, colori dai token, testi, tempi, fattibilità).
I sorgenti del canvas e del bench stanno in `out/video-restyle/` (fuori
dal repository, sul Mac).

Che cosa si vede, in breve:

- la mappa riempie il 9:16, con i colori dei token della mappa dell'app
  (scura o chiara) e i nomi nella lingua dell'app; il disegno nella banda
  20–70 % dell'altezza come oggi, le estremità tagliate di 200 m come nel
  post e nel Feed;
- la linea è gialla `route.color` (sul chiaro con il bordo scuro di
  ADR-0231), larga 0,016 della larghezza; la punta della penna è gialla;
- il logo e «MuW» come oggi (il marchio non cambia); il titolo in
  `font.title` (regular, tracking −0,6); i numeri in `font.display`
  (light, −1, cifre tabulari) con le etichette in `font.label` maiuscole,
  su un velo che sale dal basso per il 40 % dell'altezza: `scrim`
  0 → 82 % su Night e 3D, `map.background` chiaro 0 → 94 % su Day;
- le emoji del post entrano una dopo l'altra, come oggi;
- in fondo, piccolo, il credito «© OpenStreetMap contributors ·
  OpenFreeMap» (ODbL e CC-BY lo chiedono quando la mappa si mostra, e un
  video la mostra);
- in «Share your run» una riga «Style» sopra «Music»: tre tessere 9:16
  con l'anteprima del disegno nei colori dello stile, «Night» accesa
  all'apertura; la scelta non si salva, come la musica;
- se la mappa non arriva (niente rete, il CDN o le tegole muti per 15 s)
  il video esce lo stesso, sul giallo di oggi, senza avvisi: l'export non
  fallisce mai per la mappa (condizione del Coordinatore).

## Condizioni del Coordinatore (2026-10-30)

Ordine: la parte A (documenti) parte subito da `main`; la B da `main`
solo dopo il merge della #658 (TASK-339 A) e col suo via; C e D dopo la
B, una alla volta. File: `src/share/video*`, `RunVideo.tsx`,
`SharePost.tsx` e i file nuovi sono di questo task; TASK-336 B costruirà
sopra e parte dopo: la misura del video resta un parametro della pagina e
il formato non si rompe; `map/mapStyle.ts` è libero ma si aggiunge solo
una funzione nuova senza cambiare `darkMapStyle`; i18n solo righe in
fondo. In più:

1. **Misure sul telefono vero, non solo nel simulatore**, che non fa testo
   per WebGL e WebCodecs; con la prova che il canvas della mappa diventa
   un `VideoFrame` (CORS delle tegole) e che il WebView 1 × 1 a opacità 0
   disegna. Se il 3D non regge, la parte D cade e lo si scrive con i
   numeri.
2. **Se la mappa non arriva l'export non fallisce**: il video esce sul
   giallo di oggi. Niente testo d'errore nuovo.
3. **Privacy**: una scelta esplicita dell'utente, nella chat di questo
   task, nell'ADR e prima del codice: la mappa nel video mostra dove si è
   corso, e un file esportato gira fuori dall'app. Le estremità restano
   tagliate di 200 m, e il taglio va verificato sulla linea del video; una
   corsa «Only me» o non pubblicata non cambia regole senza che l'utente
   lo sappia. Da controllare la riga su OpenFreeMap in `about/content`:
   se va cambiata, è un testo di privacy e vuole un sì.
4. **Nomi degli stili e testi nuovi**: un sì dell'utente (o
   dell'autopilota fino alle 17:15; la sua sessione risulta archiviata
   alle 16:20, quindi il sì è dell'utente), in tutte le lingue.
5. **Impronta iOS `83793e26` su copia pulita a ogni parte**, nessuna
   dipendenza, nessun colore a mano; il tempo di export resta misurato, e
   se raddoppia lo si scrive.

Merge del Coordinatore: «#NNN pronta» con la testa.

## Le scelte dell'utente

Una alla volta, ognuna con la proposta pronta. Le risposte si scrivono
qui con le parole dell'utente.

1. **I nomi degli stili** (testi nuovi, condizione 4):

   | en | it | es | fr | de |
   |---|---|---|---|---|
   | Style | Stile | Estilo | Style | Stil |
   | Night | Notte | Noche | Nuit | Nacht |
   | Day | Giorno | Día | Jour | Tag |
   | 3D | 3D | 3D | 3D | 3D |

   Nessun altro testo nuovo. Da proporre con lo stesso sì: nella privacy,
   la riga «A picture of your run made with «Share» is made on the phone
   and leaves it only through the share sheet, where you send it.» che
   dica «A picture or a video of your run…» (in tutte le lingue): il
   video esiste da TASK-295 e la riga non lo nomina.
   — *Risposta (2026-10-30, nella chat di questo task, alla domanda «Vanno
   bene i nomi Style · Night · Day · 3D (Stile · Notte · Giorno · 3D, e
   così nelle altre lingue)?»):* **«Sì, questi»**: i nomi della tabella
   valgono nelle cinque lingue. La riga della privacy estesa al video non
   era nella domanda: resta da chiedere, con la parte che la cambia.
2. **Il giallo di oggi sparisce dal video.** Proposta: sì; la foto per
   Instagram (il post di TASK-231) resta gialla, e il giallo resta solo
   come riserva quando la mappa non arriva. Alternativa: il giallo come
   quarto stile.
   — *Risposta:* accettata su delega dell'utente del 2026-10-29, da
   rivedere.
3. **Il 3D.** Proposta: la mappa scura inclinata di 55° con le colline
   (la specie 3D di TASK-264), senza le foto aeree: nessun credito Esri
   nel video, meno tegole. Alternativa: sulle foto aeree (misurato: va,
   con «Powered by Esri» in più e più tegole da scaricare).
   — *Risposta:* accettata su delega dell'utente del 2026-10-29, da
   rivedere.
4. **La camera che gira nel 3D.** Proposta: da −10° a +10° in 12 s,
   rallentando alle estremità, se l'iPhone rende un fotogramma inclinato
   in meno di 25 ms (misurato dalla pagina stessa in un giro a vuoto);
   altrimenti uno scatto fermo con uno zoom lento 1,00 → 1,06.
   Alternativa: sempre fermo.
   — *Risposta:* accettata su delega dell'utente del 2026-10-29, da
   rivedere.
5. **La privacy** (condizione 3 del Coordinatore: la scelta è solo
   dell'utente, prima del codice). La mappa sotto il disegno mostra dove
   si è corso: le strade attorno, il quartiere; il video esce dall'app dal
   foglio di condivisione e va dove lo manda chi corre. Proposta: sì, con
   le estremità tagliate di 200 m come nel post e nel Feed (che mostra già
   la mappa sotto i disegni pubblicati), uguale per ogni corsa, anche
   «Only me» o non salvata: il video lo fa e lo manda solo chi ha corso.
   Alternative: la mappa solo per le corse pubblicate (chi corre dovrebbe
   capire perché a volte il video è giallo); una scelta in «Settings».
   — *Risposta (2026-10-30, nella chat di questo task, alla domanda «La
   mappa nel video mostra dove hai corso, con le estremità tagliate di
   200 m: va bene?»):* **«Sì, va bene»**. Vale la proposta: la mappa in
   ogni video, le estremità tagliate di 200 m, la stessa regola per ogni
   corsa.
6. **Il credito nel video.** Proposta: sì, 0,02 della larghezza (22 px su
   1080, leggibile su un telefono) in `textFaint`, in fondo; sul 3D anche
   «Terrain Tiles».
   — *Risposta:* accettata su delega dell'utente del 2026-10-29, da
   rivedere.

7. **La riga di privacy estesa al video** (condizione 3 del Coordinatore:
   con la B il file esportato mostra la mappa). Proposta, al posto della
   riga di oggi su «A picture of your run made with «Share»…», in
   `src/about/content/*.ts`:

   - en: «A picture or a video of your run made with «Share» is made on
     the phone and leaves it only through the share sheet, where you send
     it. The video shows the map around your run, without its first and
     last 200 metres.»
   - it: «Un'immagine o un video della tua corsa creati con «Condividi» si
     fanno sul telefono ed escono solo dal foglio di condivisione, dove li
     mandi tu. Il video mostra la mappa attorno alla corsa, senza i primi e
     gli ultimi 200 metri.»
   - de: «Ein Bild oder ein Video deines Laufs, das du mit «Teilen» machst,
     entsteht auf dem Handy und verlässt es nur über das Teilen-Menü,
     dorthin, wohin du es sendest. Das Video zeigt die Karte rund um deinen
     Lauf, ohne seine ersten und letzten 200 Meter.»
   - es: «Una imagen o un vídeo de tu carrera hechos con «Compartir» se
     crean en el teléfono y solo salen de él por el menú de compartir,
     hacia donde los envíes. El vídeo muestra el mapa alrededor de tu
     carrera, sin sus primeros y últimos 200 metros.»
   - fr: «Une image ou une vidéo de ta course faites avec «Partager» sont
     créées sur le téléphone et ne le quittent que par le menu de partage,
     vers l'endroit où tu les envoies. La vidéo montre la carte autour de
     ta course, sans ses 200 premiers et derniers mètres.»

   TASK-356 tocca gli stessi file: chi arriva secondo riallinea.
   — *Risposta (2026-10-30):* **sì**: entra con la B (#679).

**La privacy in `about/content`** (controllata il 2026-10-30, condizione
3): in «Others who receive data» ci sono OpenFreeMap («serves the map:
like any map service, it sees which area you look at»), Overpass e unpkg;
la mappa del video chiede le stesse tegole della zona già guardata sulla
mappa, quindi la riga copre il video. Non sono nominate le tegole del
terreno (Terrain Tiles, su Amazon S3) né le foto aeree (Esri), che la
mappa 3D e quella satellite di TASK-264 scaricano già oggi: una riga da
proporre a parte, col sì dell'utente, prima della parte D, che usa il
terreno. La riga sull'immagine di «Share» non nomina il video (scelta 1).

## Fattibilità del 3D, misurata il 2026-10-30

**Come si fanno i fotogrammi oggi.** `videoScene.ts` decide le cose da
disegnare per ognuno dei 360 fotogrammi (linee, punti, scritte, emoji, in
pixel); `videoPage.ts`, nel WebView nascosto (1 × 1, opacità 0, dentro il
Modal), le disegna su un canvas 2D e le codifica con WebCodecs; l'app
scrive l'MP4 (`mp4.ts`). Nessuno scatto della mappa: il video è il post,
sul giallo. Il Feed, invece, scatta già una mappa nascosta
(`feed/feedMapPage.ts`: MapLibre, `preserveDrawingBuffer`, `toDataURL`
dopo `idle`).

**Il bench** (`out/video-restyle/bench/`): una pagina con MapLibre GL JS
5.24.0 e lo stile vero dell'app (con le specie di `withKinds`), un cuore
di 5 km attorno a Trento, la mappa di 360 × 640 pt a `pixelRatio` 3
(1080 × 1920), WebCodecs come la pagina del video. Girato in Safari del
simulatore (iPhone 17, iOS 27) e **dentro l'app**, in Expo Go, nel WebView
nascosto com'è montato da `RunVideo.tsx` (1 × 1, opacità 0, `baseUrl`
`https://video.muw.invalid/`), più i modi 1 × 1 visibile e 360 × 640
coperto da una vista opaca (come il Feed). La GPU è quella del Mac:
sull'iPhone i tempi vanno rimisurati (condizione 1).

| Passo | Safari, freddo | Safari, tegole in cache | Nell'app, WebView nascosto, freddo |
|---|---|---|---|
| MapLibre dal CDN (1 MB) | 103 ms (locale) | 24 ms | 5,3 s la prima volta, poi in cache |
| Le tegole della zona, mappa piatta, primo `idle` | 4,4 s | 0,6 s | 9,9 s (0,8 s in cache) |
| In più il terreno e le colline del 3D, `idle` | 9,1 s | 0,5 s | 7,8 s (0,7 s in cache) |
| Uno scatto della mappa (`drawImage` del canvas WebGL) | 19 ms | 18 ms | 26 ms |
| La traccia proiettata in prospettiva (`map.project`, 99 punti) | 21 ms | 16 ms | 23 ms |
| 360 fotogrammi composti in 2D, senza codifica | 43 ms | 33 ms | 100 ms |
| 360 fotogrammi, mappa ferma, codifica H.264 | 7,9 s | 4,9 s | 5,9–7,2 s |
| Un fotogramma inclinato reso dalla mappa (`jumpTo` + `redraw`) | 8,8 ms + 5,3 di copia | 5,8 + 3,9 | 7–13 + 5–10 |
| 360 fotogrammi con la camera che gira, codifica | 12,3 s | 10,4 s | 14,0–16,2 s con il WebView 1 × 1 visibile o coperto; 21,0 s nascosto, con un giro a vuoto a 245 ms per fotogramma che gli altri modi non hanno ripetuto |
| Tegole mancanti durante il giro | 60/60 al primo passaggio | 1/60 al secondo | 60/60 al primo, 1/60 al secondo |
| Mappa a 540 × 960 (`pixelRatio` 1,5), un fotogramma | — | 1,9 + 2,3 ms | 2,5–4 + 3–5 ms |
| Le foto aeree (Esri) nel 3D, `idle` | 1,8 s | 0,3 s | 0,4–0,5 s |

Nel WebView nascosto `document.visibilityState` è `visible`,
`requestAnimationFrame` va a circa 18 al secondo (9 in 500 ms; 46 al
secondo con il WebView grande e coperto) e la mappa arriva a `idle` da
sola; i contenitori fuori schermo si disegnano lo stesso. I tre modi
provati nell'app danno tempi uguali per lo scatto e la codifica ferma: la
pagina del video può tenere la mappa com'è montata oggi. Solo la camera
che gira, nel modo nascosto, ha avuto un passaggio lento (245 ms a
fotogramma, non ripetuto negli altri due): un motivo in più per
misurarla sul telefono nel giro a vuoto e restare fermi sopra la soglia.
Il canvas della mappa è diventato un `VideoFrame` e il codificatore ha
dato 360 pezzi in ogni modo: le tegole di OpenFreeMap, del terreno e di
Esri arrivano con CORS e non sporcano il canvas (nel simulatore; da
ripetere sul telefono). Il video pesa 4,4 MB con la mappa ferma e 8,6 MB
con la camera che gira, a 6 Mbit/s.

**Che cosa ne segue.** La mappa può stare nella pagina del video, in uno
scatto preso una volta: il video costa come oggi più le tegole (0,5–0,8 s
in cache, qualche secondo a freddo). La camera che gira nel 3D costa una
resa per fotogramma (+4–9 s nel simulatore) e vuole un giro a vuoto prima,
per avere le tegole di tutte le rotazioni; sul telefono si misura dalla
pagina stessa, e sopra i 25 ms a fotogramma si resta fermi. Niente di
nativo, nessuna dipendenza: MapLibre arriva dal CDN come nella pagina
della mappa.

**La misura sul telefono** (condizione 1): la sera del 30 con l'utente,
dieci minuti: Metro del worktree `video-bench` sulla rete locale, Expo Go
sull'iPhone apre il harness (`apps/mobile/bench/`, file temporanei mai da
committare), i numeri arrivano al server del bench (`serve.py`) e si
scrivono qui. Decide la parte D: sopra i 25 ms a fotogramma la camera
resta ferma; se anche lo scatto inclinato non regge, la D cade.

## Il disegno tecnico (deciso dall'agente su delega dell'utente)

In ADR-0303: la mappa nella pagina del video, uno scatto e la linea sopra,
la quota della linea decisa dall'app e i suoi pixel dalla mappa, il
giallo di oggi come riserva, tre stili dai token, la riga «Style», il 3D
proiettato dalla pagina, la camera che gira se costa poco, il credito, la
privacy, i limiti.

## Le parti

Ognuna nella sua PR, col via del Coordinatore. Il codice parte da `main`
con dentro la #658 (TASK-339 A: `font`, i grigi caldi, `src/ui/`).

### Parte A — I documenti (questa PR)

`tasks/TASK-351.md`, ADR-0303, `STATUS.md`, `INDEX.md`.

### Parte B — La mappa sotto e il look premium, nello stile Night

Prima: la risposta dell'utente alla scelta 5 (privacy).

1. `src/share/videoMap.ts` (nuovo): lo stile della mappa per il video
   (dai token, per una palette data), la camera dal rettangolo del disegno
   (`lineCamera` come il Feed), il credito.
2. `src/share/videoScene.ts`: lo stile, la camera, la traccia (al più
   2000 punti, le estremità tagliate con `withoutEnds`, testato), le
   scritte nelle quote di `font`, il velo, la quota della linea (`share`)
   al posto dei pixel; la scena gialla di oggi resta come riserva.
3. `src/share/videoPage.ts`: MapLibre dal CDN (stesso indirizzo e
   impronta di `mapPage.ts`), la mappa 360 × 640 a 3× (la misura resta un
   parametro, per TASK-336 B), lo scatto a `idle` (15 s al più, poi la
   riserva gialla), la linea e la punta proiettate, il velo, le scritte
   con il tracking, il credito; i tempi (tegole, scatto, codifica) detti
   all'app in un messaggio, per misurare.
4. `src/share/videoFile.ts`, `RunVideo.tsx`: il messaggio dei tempi.
5. I test: `videoScene.test.ts`, `videoPage.test.ts` (con `maplibregl` e
   `VideoEncoder` finti: scatto, proiezione, riserva senza mappa, 360
   pezzi, nessun colore fuori dai token), `videoMap.test.ts`,
   `SharePostVideo.test.tsx`.
6. `docs/UI.md` («Il post da condividere»), il task file, `STATUS.md`.

### Parte C — I tre stili e la riga «Style»

Prima: la risposta dell'utente alla scelta 1 (i nomi).

1. `src/share/videoStyle.ts` (nuovo): Night, Day, 3D con i loro colori
   dai token (`paletteOf` dei due toni ai loro estremi), i nomi.
2. `src/share/StyleRow.tsx` (nuovo): le tre tessere, «Night» all'apertura.
3. `SharePost.tsx`: la riga sopra «Music», lo stile nella scena.
4. Day: la mappa chiara, il bordo della linea, il velo chiaro.
5. I testi nelle cinque lingue, solo righe in fondo alle tabelle.
6. I test; `UI.md`, il task file, `STATUS.md`.

### Parte D — Il 3D

Prima: la misura sul telefono, e la riga di privacy sulle tegole del
terreno col sì dell'utente.

1. `videoMap.ts`, `videoPage.ts`: il terreno e le colline, `fitBounds`
   inclinato, la proiezione col terreno.
2. La camera che gira: il giro a vuoto, la misura del costo di un
   fotogramma, la resa per fotogramma o lo scatto fermo con lo zoom lento.
3. I test; `UI.md`, il task file, `STATUS.md`, l'esito.

## Criteri di accettazione

Della proposta (parte A):

- [x] Il canvas fatto; le scelte 2, 3, 4 e 6 con la raccomandazione,
      accettata su delega e da rivedere; la 5 (privacy) e la 1 (i nomi)
      con le parole dell'utente.
- [x] La fattibilità del 3D misurata nel simulatore e nel WebView nascosto
      dell'app, scritta qui; il bench fuori dal repository (`out/`).
- [ ] La misura sul telefono dell'utente scritta qui (condizione 1).
- [x] ADR-0303 scritto; `STATUS.md` e `INDEX.md` aggiornati.

Delle parti:

- [ ] B: «Export video» fa il video con la mappa scura sotto la linea
      gialla, il titolo, i numeri e le etichette nella scala premium, il
      velo, le emoji, il credito; l'ultimo fotogramma è come la tavola
      «Night»; senza tegole in 15 s il video esce sul giallo di oggi;
      le estremità della linea sono tagliate di 200 m (test); durata e
      memoria non dipendono dalla corsa (ADR-0254, punto 9); il tempo di
      export misurato e scritto, prima e dopo.
- [ ] C: la riga «Style» con tre tessere, «Night» accesa all'apertura; Day
      fa la mappa chiara con il bordo scuro sulla linea e il velo chiaro,
      qualunque tono abbia l'app; i testi nelle cinque lingue col sì
      dell'utente.
- [ ] D: 3D fa la mappa inclinata con le colline, la linea in prospettiva;
      la camera gira solo se un fotogramma costa meno di 25 ms sul
      telefono, altrimenti lo zoom lento.
- [ ] **Prima dell'OTA di produzione della B** (condizione del Coordinatore,
      2026-10-30): l'utente ha esportato un video vero sull'iPhone, dalla
      preview, e ha visto la mappa sotto la linea. Il rischio da guardare
      è un telefono che ricade sul giallo in silenzio.
- [ ] **Prima dell'OTA di produzione della B**, se non è entrata con la B:
      la riga di privacy estesa al video, col sì dell'utente (scelta 7).
- [ ] Test deterministici verdi in locale e in CI: la scena (stile,
      camera, quote, il taglio), la pagina con MapLibre e WebCodecs finti
      (scatto, proiezione, riserva, 360 pezzi), i colori solo dai token.
- [ ] Nessuna dipendenza nuova; impronta iOS
      `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3` invariata su una copia
      pulita con `npm ci`, a ogni parte.
- [ ] Provato nel simulatore (Expo Go) e dall'utente sull'iPhone: un
      video per stile accettato da Instagram.

## File toccati

Parte A (questa PR):

```
docs/tasks/TASK-351.md        (nuovo)
docs/DECISIONS.md
docs/STATUS.md
docs/INDEX.md
```

Parte B:

```
apps/mobile/src/share/videoMap.ts                 (nuovo)
apps/mobile/src/share/videoMap.test.ts            (nuovo)
apps/mobile/src/share/videoScene.ts
apps/mobile/src/share/videoScene.test.ts
apps/mobile/src/share/videoPage.ts
apps/mobile/src/share/videoPage.test.ts
apps/mobile/src/share/videoFile.ts
apps/mobile/src/share/videoFile.test.ts
apps/mobile/src/share/RunVideo.tsx
apps/mobile/src/share/SharePostVideo.test.tsx
apps/mobile/src/map/mapStyle.ts                   (solo una funzione nuova)
apps/mobile/src/about/content/en.ts               (la riga di privacy, scelta 7)
apps/mobile/src/about/content/it.ts
apps/mobile/src/about/content/de.ts
apps/mobile/src/about/content/es.ts
apps/mobile/src/about/content/fr.ts
site/privacy/index.html                           (rigenerate da make_privacy.mjs)
site/privacy/it/index.html
site/privacy/de/index.html
site/privacy/es/index.html
site/privacy/fr/index.html
docs/UI.md
docs/DECISIONS.md                                 (aggiunta a ADR-0303)
docs/tasks/TASK-351.md
docs/STATUS.md
```

Parte C:

```
apps/mobile/src/share/videoStyle.ts               (nuovo)
apps/mobile/src/share/videoStyle.test.ts          (nuovo)
apps/mobile/src/share/StyleRow.tsx                (nuovo)
apps/mobile/src/share/StyleRow.test.tsx           (nuovo)
apps/mobile/src/share/SharePost.tsx
apps/mobile/src/share/SharePost.test.tsx
apps/mobile/src/share/SharePostVideo.test.tsx
apps/mobile/src/share/videoMap.ts
apps/mobile/src/share/videoScene.ts
apps/mobile/src/share/videoPage.ts
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/es.ts
apps/mobile/src/i18n/fr.ts
apps/mobile/src/i18n/it.ts
docs/UI.md
docs/tasks/TASK-351.md
docs/STATUS.md
```

Parte D:

```
apps/mobile/src/share/videoMap.ts
apps/mobile/src/share/videoMap.test.ts
apps/mobile/src/share/videoScene.ts
apps/mobile/src/share/videoScene.test.ts
apps/mobile/src/share/videoPage.ts
apps/mobile/src/share/videoPage.test.ts
docs/UI.md
docs/DECISIONS.md
docs/tasks/TASK-351.md
docs/STATUS.md
```

## Fuori scope

- La foto per Instagram (il post, TASK-231): resta gialla.
- Il video nei post (TASK-336): la sua parte B prende questo video a
  540 × 960 con lo stile scelto; qui nessun cambio al server.
- La musica (TASK-301): non cambia.
- Le foto aeree nel video; un video più lungo; la velocità vera lungo la
  traccia; il profilo d'altitudine.
- La riga di privacy sulle tegole del terreno e sulle foto aeree della
  mappa 3D e satellite di oggi (TASK-264): da proporre a parte.
- Android (TASK-294).

## La parte B, com'è fatta (2026-10-30)

PR #679, branch `feat/TASK-351-b-video-map` (worktree `TASK-351-b`), da
`main` 477bdb68 con la #658; testa `a6d8cf1d (il codice; poi la privacy e i documenti)`.

- `videoMap.ts` (nuovo): `NIGHT`, il tono scuro al suo passo più scuro
  (`paletteOf`), lo stile con `mapStyleFor(NIGHT, language)`, la camera da
  `lineCamera` del Feed (ADR-0131) sul riquadro del disegno, con il
  `padding` della mappa che mette il centro in mezzo al riquadro: la
  linea, calcolata dall'app con `fitLines` come oggi, cade sulla mappa a
  meno di un pixel (la proiezione dalla pagina con `map.project` arriva
  con la D, dove l'inclinazione la rende necessaria). 360 × 640 pt a 3×;
  15 s di attesa al più; il credito.
- `videoScene.ts`: due look, `paper` (il giallo di oggi, byte per byte
  tranne il formato degli op) e `night`; i colori per ruolo (`ink`,
  `muted`, `faint`, `accent`, `onAccent`, `dot`) risolti dai token della
  palette del look; gli op nuovi `map`, `scrim`, `rect`; le scritte con
  `weight`, `tracking` e il ruolo del colore; le quote di `font` sulla
  larghezza del telefono (390 pt): titolo 30 regular −0,6, etichette 11
  semibold +1,2 in maiuscolo nella lingua dell'app, numeri 44 light −1; il
  credito a 0,02 della larghezza; nessuna mappa per una corsa troppo corta
  da disegnare (resta scuro, senza luogo).
- `videoPage.ts`: MapLibre dal CDN con l'indirizzo e l'impronta SRI di
  `mapPage.ts` (l'unico `src=` della pagina); `prepareMap` fa la mappa
  (`preserveDrawingBuffer`, `pixelRatio` 3, `setPadding` + `jumpTo`),
  aspetta `idle` al più `waitMs`, copia il canvas in un'immagine e lascia
  andare la mappa; un errore di tegola o il tempo scaduto rispondono
  `map ok:false`; ogni 4 s un `waiting`, così il silenzio di 20 s
  dell'app non scatta. Il velo è un gradiente con la curva di
  `tools/ui_scrim.py` (smoothstep, 82 %); le lettere spaziate con
  `letterSpacing` del canvas dove c'è (iOS 17), altrimenti una per una.
  Il canvas non ha le cifre tabulari: i numeri sono allineati a sinistra,
  e il tremolio mentre salgono è piccolo.
- `RunVideo.tsx`: due passi, `prepareMap` poi `make` con la scena, o con
  la scena di riserva (`fallback`) quando la mappa non arriva; `onTimes`
  dà i tempi della pagina a chi lo monta. Mentre le tegole arrivano il
  pulsante resta su «Making the video… 0%»: lo stato di attesa che c'è
  già, nessun testo nuovo (condizione del Coordinatore).
- `mapStyle.ts`: `mapStyleFor(palette, language)`; `darkMapStyle` tiene
  firma e risultato e delega (il test di uguaglianza lo controlla).
- Test: 98 nelle suite toccate (scena, mappa, pagina con MapLibre e
  WebCodecs finti, flusso in due passi, riserva gialla); la suite intera
  verde in locale, tranne due file che cercano moduli nativi assenti dal
  `node_modules` del checkout principale (in CI ci sono).
- Impronta iOS su copia pulita con `npm ci`: `83793e26…` invariata, e
  uguale a `main` 477bdb68 misurato nello stesso modo.
- Provata in Expo Go (simulatore iPhone 17, iOS 27, il WebView nascosto
  com'è montato): 12 s, 360 fotogrammi, 1080 × 1920, 4,6 MB (il giallo:
  1,9), il foglio di condivisione con «Save Video». Fotogrammi in
  `out/TASK-351-b/frames/` sul Mac.
- Tempo di export (condizione 5), dal montaggio all'ultimo fotogramma,
  cache calda, tre giri: Night 5,4–8,3 s (tegole 0,55 s, scatto 10 ms,
  codifica 3,1–5,0 s) contro giallo 4,1–5,9 s (codifica 2,9–4,0 s):
  +1,3–2,4 s. A tegole fredde +4–10 s (dal bench): lì può raddoppiare, e
  si vede solo lo stato di attesa.

## Dove si è (2026-10-30, sera)

Fatto: il canvas; il bench in Safari del simulatore e nell'app (Expo Go,
tre modi del WebView); questo file, ADR-0303, `STATUS.md`, `INDEX.md`.
Strumenti lasciati sul Mac per le parti B–D: il simulatore «MuW video
bench» (spento), il worktree staccato `.claude/worktrees/video-bench` con
il harness (file temporanei, mai da committare), il bench in
`out/video-restyle/`.

Arrivate le scelte 5 (privacy, «Sì, va bene») e 1 (i nomi, «Sì,
questi»). La B ha il via del Coordinatore ed è la PR #679
(`feat/TASK-351-b-video-map`, worktree `TASK-351-b`): la mappa sotto nel
look Night, la riserva gialla, provata in Expo Go; le sue righe qui e in
STATUS arrivano quando questa PR è in `main`. Resta la misura sul
telefono: l'iPhone dell'utente ha Expo Go SDK 58, che non apre i progetti
SDK 57, quindi il video vero si prova dalla preview dopo il merge, e i
numeri di MapLibre per il 3D si prendono con la pagina del bench in
Safari sulla rete locale.
