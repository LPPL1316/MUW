# TASK-388 — Movimenti stile Apple: molle condivise, la barra in basso, l'«isola», fogli e liste

**Stato**: In corso — parte A in `main` (#770, 0d7819c4, 2026-11-05); A2 in `main` (#780, 07d5833c); parte B in `main` (#786, dde301bd); parte C in `main` (#803, fed77512); C2, lo sfondo che sfuma, in PR
**Fase**: 4 · **Branch**: `feat/TASK-388-a-springs-tab-bar` (parte A) ·
**ADR**: ADR-0329 · numeri dal Coordinatore (2026-11-04)

## Obiettivo

Brief dell'utente del 2026-11-04: rendere i movimenti dell'app fluidi ed
eleganti, nello stile Apple (Dynamic Island, molle naturali, niente effetti da
cartone animato). Tre parti, una PR ciascuna; l'aspetto è una scelta di
prodotto: prima di ogni merge i video dal simulatore, prima e dopo, e l'ok
dell'utente.

ADR-0293 diceva per `motion` «brevi e con una curva, mai rimbalzi»: ADR-0329
lo aggiorna per i movimenti (molle con un rimbalzo appena percettibile, mai
elastiche). Il resto di ADR-0293 resta.

## Contesto da leggere

- `DECISIONS.md` ADR-0329, ADR-0293 (punto 4, `motion`), ADR-0311 (la barra),
  ADR-0323 (lo swipe fra le schede).
- `apps/mobile/src/theme/tokens.ts` (`motion`), `src/ui/` (`Tap`,
  `useReduceMotion`), `src/tabs/`, `src/haptics/haptics.ts`.

## Vincoli del brief

- Niente dipendenze nuove: `react-native-reanimated` non c'è e aggiungerlo
  cambia l'impronta iOS (niente OTA). Solo `Animated` di React Native con
  `useNativeDriver: true`, solo `transform` e `opacity`.
- L'impronta iOS resta `6f8bba4cf1b6f95fc3c1c84ba9812d950a2232a1`, misurata
  su una copia pulita prima della PR.
- Nessun colore a mano, testi dell'interfaccia invariati.
- «Riduci movimento» (`AccessibilityInfo.isReduceMotionEnabled`, già letto da
  `useReduceMotion`): solo dissolvenze brevi, niente molle né spostamenti.
- Ogni animazione si interrompe: un tocco a metà riparte da dove si trova.
- Test deterministici con i timer finti di jest; in locale solo i test dei
  file toccati e `tsc`, la suite intera la fa la CI.

## Le parti

### A — Molle condivise e barra in basso

1. `motion.spring` in `tokens.ts`: `snappy`, `smooth`, `island` (rigidità,
   smorzamento, massa; risposta 0,35–0,5 s, oltre il segno ≤ 3%), usate solo
   da `src/ui/motion.ts` (`springTo`, `fadeTo`).
2. `TabBar`: una capsula morbida dietro l'icona attiva che scivola alla nuova
   scheda con `snappy`, allungandosi un poco a metà corsa (`scaleX`); con lo
   swipe di TASK-379 segue il dito (prop `drag`, cablata in `TabShell` dopo il
   merge della #764), e fa il giro dal profilo al Feed con una copia a una
   barra di distanza.
3. L'icona premuta scende a 0,88 e torna con la molla, appena oltre 1;
   l'icona che diventa attiva sale di 1,5 pt e passa dal contorno al pieno in
   dissolvenza incrociata.
4. Una vibrazione leggera (`selectionFeel`, cioè `selectionAsync`) solo al
   cambio di scheda col tocco: non sulla scheda già attiva, non a ogni
   tocco. Dove l'app è costruita senza `expo-haptics` non succede niente.
5. `Tap` torna su con la stessa molla `snappy`: tutta l'app risponde al dito
   allo stesso modo.

#### Il cablaggio di `drag` in `TabShell` (dopo la #764)

Concordato con TASK-379 il 2026-11-04; `TabShell` passa a questo task col
via del Coordinatore, dopo il merge della #764.

- Fatto così (deciso dall'agente su delega dell'utente): lo `ScrollView` di
  TASK-379 resta com'è. Il suo `onScroll`, che riceve già ogni evento
  (`scrollEventThrottle={16}`), mette in un `Animated.Value` `drag` la
  distanza dalla pagina dell'app, in pagine (`pagesFromPage`):
  `x / width − now.place + now.page − page`, col giro della barra più vicino
  all'ultimo valore. Con più swipe di fila la striscia porta le pagine
  lontano da quella dell'app, che cambia solo a riposo: contare da
  `now` tiene la capsula in avanti (visto nel simulatore il 2026-11-04).
  Il valore va a `TabBar`. Scartato un `Animated.event` sul driver nativo:
  avrebbe cambiato lo `ScrollView` della striscia in `Animated.ScrollView`,
  e `TabBar` non avrebbe più potuto leggere `drag` da JS, che le serve per
  capire se una pagina è arrivata col dito.
- Un `useLayoutEffect` su posto e `width` ricalcola `drag` dall'ultima
  posizione della striscia. Una pagina cambia posto solo fuori vista, quindi
  il posto resta fermo per tutto lo swipe. A un tocco, al giro guidato e a
  «indietro» la pagina nuova arriva nello stesso posto: `drag` resta 0 e la
  capsula va con la molla.
- «Messages» senza account: lo swipe arriva a Messages e l'app manda al
  profilo. La capsula si mette su Messages, dove il dito l'ha portata, e da
  lì va al profilo con la molla.
- Gli `scrollTo` (layout, `now.asked`, rotazione) riportano `drag` a 0 senza
  cambiare pagina. Con VoiceOver o TalkBack lo scroll è spento e `drag`
  resta 0. Ai capi della striscia lo swipe si ferma e non serve altro.
- I test di TASK-379 in `TabShell.test.tsx` (`tab-pages`, `scroll`,
  `momentumScrollEnd`, `scrollEndDrag`, le prop della striscia) restano
  verdi senza cambi: `jest src/tabs`, 59 test.

### B — L'«isola» per i messaggi brevi

Una capsula scura in alto al centro che nasce piccola, si gonfia in
orizzontale e poi in verticale per un messaggio breve, poi si richiude e
sparisce. `src/ui/Island.tsx` e un hook; solo `scaleX`/`scaleY` e il
contenuto in dissolvenza dopo l'espansione. Collegata a **un solo** punto
dell'app come prova; dove altro usarla lo decide l'utente.

### C — Fogli, Modal e liste

Fogli dal basso e `Modal` con la molla `smooth` invece della curva fissa; le
liste che appaiono con una cascata leggerissima (20–30 ms fra una riga e la
successiva, al massimo 6 righe animate). Dopo la #760 di TASK-339, che tocca
`MessageSheet` e `SuperLikeSheet`.

## Criteri di accettazione (parte A)

- [x] Le tre molle rispettano risposta e rimbalzo del brief: test.
- [x] La capsula arriva sulla scheda giusta, con il rimbalzo della molla e
      non oltre il 3%: test.
- [x] Un nuovo tocco a metà corsa riparte da dove si trova, senza salti: test
      (capsula e `Tap`).
- [x] Il cambio di scheda chiama la vibrazione una volta; la scheda già
      attiva no: test.
- [x] Con «Riduci movimento» non parte nessuna molla, la capsula compare in
      dissolvenza dove va: test.
- [x] Sotto il dito che scorre le pagine la capsula lo segue, anche nel giro
      profilo → Feed: test (con la prop `drag`).
- [x] Impronta iOS invariata su una copia pulita: `6f8bba4c`.
- [x] Video prima/dopo della barra in `out/TASK-388/`, e l'ok dell'utente:
      «Sì, approvo» (2026-11-04).
- [x] La capsula segue lo swipe: `drag` cablato in `TabShell` dopo la #764
      (`TabShellDrag.test.tsx`: segue il dito, il giro, il tocco, la pagina
      che l'app manda altrove).

## File toccati

Parte A:

```
apps/mobile/src/theme/tokens.ts                (motion.spring; releaseMs resta finché le PR aperte lo leggono)
apps/mobile/src/ui/motion.ts                   (nuovo)
apps/mobile/src/ui/motion.test.ts              (nuovo)
apps/mobile/src/ui/animationsOnJs.testing.ts   (nuovo, solo per i test)
apps/mobile/src/ui/Tap.tsx
apps/mobile/src/ui/Tap.test.tsx
apps/mobile/src/tabs/TabBar.tsx
apps/mobile/src/tabs/TabBarMotion.test.tsx     (nuovo)
apps/mobile/src/tour/GuideRowTap.test.tsx      (il rilascio con la molla; sì del Coordinatore)
apps/mobile/src/tabs/TabShell.tsx              (la prop drag, dopo il merge della #764)
apps/mobile/src/tabs/TabShellDrag.test.tsx     (nuovo)
docs/tasks/TASK-388.md                         (nuovo)
docs/DECISIONS.md                              (ADR-0329, righe aggiunte)
docs/STATUS.md                                 (righe aggiunte)
docs/INDEX.md                                  (una riga)
docs/UI.md                                     (la barra e il movimento)
```

## A2 — La barra più fluida (2026-11-05)

Dal Coordinatore, dopo la prova dell'utente sull'anteprima 0fd6c1dc (`main`
0d7819c4): «funziona magari se riesci a migliorarla un attimo è un po'
macchinosa rendila più fluida», a proposito del rimbalzo della barra al
cambio di scheda. Branch `fix/TASK-388-a2-smoother-tab-bar` da `main`; la
PR la unisce il Coordinatore.

Cosa c'era: la capsula partiva nel commit della pagina nuova, quindi dopo
che JS aveva costruito Feed o Explore, e da lì faceva due rimbalzi (`snappy`
e la sequenza dell'allungamento); l'icona premuta tornava oltre la misura
mentre quella nuova saliva con un altro rimbalzo.

Cosa cambia (ADR-0329, aggiornamento A2):

- la molla `glide` in `motion.spring` (256/32, risposta ~0,39 s, smorzamento
  critico, oltre il segno 0) per capsula, icone e ritorno del tocco (`Tap`
  con la prop `settle`); niente allungamento; tocco a 0,9;
- capsula e icona partono al tocco, prima di `onTab`: su iOS la molla va
  subito al thread UI e corre mentre JS costruisce la pagina. Se l'app tiene
  la sua pagina, la capsula torna indietro;
- un tocco durante uno swipe parte da dove il dito ha lasciato la capsula;
  `TabShell` tiene `drag` a 0 fino al dito successivo.

### Criteri di accettazione (A2)

- [x] `glide`: risposta 0,35–0,5 s, smorzamento 1, nessun rimbalzo
      (`motion.test.ts`).
- [x] La capsula arriva sulla scheda senza mai superarla né allungarsi, un
      fotogramma dopo l'altro sempre avanti (`TabBarMotion.test.tsx`).
- [x] La molla parte prima che l'app riceva `onTab`, e la pagina che arriva
      non ne fa partire un'altra (`TabBarMotion.test.tsx`).
- [x] L'app che tiene la sua pagina: la capsula torna (`TabBarMotion.test.tsx`).
- [x] Tocco a metà swipe: nessun salto, sempre verso la scheda, lo
      scorrimento che resta non la sposta (`TabShellDrag.test.tsx`).
- [x] Impronta iOS invariata: `6f8bba4c`.
- [ ] Video prima/dopo in `out/TASK-388/a2-*` e l'ok dell'utente.

### File toccati (A2)

```
apps/mobile/src/theme/tokens.ts
apps/mobile/src/ui/motion.test.ts
apps/mobile/src/ui/Tap.tsx
apps/mobile/src/ui/Tap.test.tsx
apps/mobile/src/tabs/TabBar.tsx
apps/mobile/src/tabs/TabBarMotion.test.tsx
apps/mobile/src/tabs/TabShell.tsx
apps/mobile/src/tabs/TabShellDrag.test.tsx
docs/tasks/TASK-388.md
docs/DECISIONS.md   (righe aggiunte in ADR-0329)
docs/STATUS.md      (righe aggiunte)
docs/UI.md
```

### Esito A2

Fatto nel codice e nei test (`jest src/tabs src/ui src/tour`: 216 verdi,
`tsc` pulito). Nei video del simulatore la capsula non si ferma più a metà
mentre Explore si costruisce e non supera Feed al ritorno. Aspetta l'ok
dell'utente sui video, poi il merge del Coordinatore.
In `main` il 2026-11-05 (#780, 07d5833c); l'anteprima per il telefono la
pubblica il Coordinatore.

## Parte B — L'isola (2026-11-05)

Branch `feat/TASK-388-b-island` da `main`; lista dei file mandata al
Coordinatore prima del codice. Fatto così (ADR-0329, «Parte B»):
`src/ui/Island.tsx` (la capsula, `color.scrim` con le parole in `onScrim`)
e `src/ui/useIsland.tsx` (`const [island, say] = useIsland()`). Nasce al
30% × 75%, si allarga, 120 ms dopo si alza, altri 120 ms e compaiono le
parole, sulla molla `island`; resta 1,8 s e si chiude nell'ordine inverso.
Un messaggio nuovo mentre è aperta cambia le parole senza richiuderla. Con
«Riduci movimento» solo una dissolvenza, alla sua misura.

Il punto scelto: «Sent to {name}.» di «Send to a friend» (`SendToFriend`).
I problemi restano scritti sopra la lista; i testi non cambiano.

### Criteri di accettazione (B)

- [x] Nasce piccola, prima si allarga, poi si alza, poi le parole; mai oltre
      il 3% della sua misura (`Island.test.tsx`).
- [x] Resta un momento, poi si chiude (prima le parole) e sparisce.
- [x] Un messaggio nuovo mentre è aperta: nessun salto, parole nuove, tempo
      di nuovo da capo.
- [x] Con «Riduci movimento» nessuna molla, solo la dissolvenza.
- [x] Un solo punto dell'app: «Sent to {name}.»; `Drawings.test.tsx` lo
      trova ancora senza cambi.
- [x] Scelta dell'utente: anche «Thanks for telling us. We will look at
      it.» dopo ogni segnalazione andata a buon fine (post, profilo,
      messaggio, commento). Il foglio si chiude e l'isola dice grazie; per i
      commenti niente più `Alert` (`IslandLayer.test.tsx` e i test delle
      segnalazioni).
- [x] Impronta iOS invariata: `6f8bba4c`.
- [ ] Video in `out/TASK-388/b-*` e l'ok dell'utente.

### File toccati (B)

```
apps/mobile/src/ui/Island.tsx              (nuovo)
apps/mobile/src/ui/useIsland.tsx           (nuovo)
apps/mobile/src/ui/Island.test.tsx         (nuovo)
apps/mobile/src/messages/SendToFriend.tsx
apps/mobile/src/ui/IslandLayer.tsx         (nuovo)
apps/mobile/src/ui/IslandLayer.test.tsx    (nuovo)
apps/mobile/src/intro/Root.tsx             (una riga: <IslandLayer />)
apps/mobile/src/social/ReportMenu.tsx
apps/mobile/src/social/ReportMenu.test.tsx
apps/mobile/src/social/commentChoices.ts
apps/mobile/src/social/DrawingComments.tsx
apps/mobile/src/social/DrawingComments.test.tsx
apps/mobile/src/messages/MessageSheet.tsx
apps/mobile/src/messages/Messages.test.tsx
apps/mobile/src/profile/UserProfileReport.test.tsx
docs/tasks/TASK-388.md
docs/DECISIONS.md   (righe aggiunte in ADR-0329)
docs/STATUS.md      (righe aggiunte)
docs/UI.md
```

### Esito B

Fatto nel codice e nei test (`Island.test.tsx` 5, `Drawings.test.tsx` 10,
`tsc` ed eslint puliti). Il video `out/TASK-388/b-island.mov` è girato
nella copia del simulatore con un collegamento di prova solo locale (un
tocco su una scheda fa dire all'isola «Sent to Ada_runs.»), perché lì
l'account punta a un'API locale spenta e «Send to a friend» non si apre;
nell'app il collegamento è solo su «Sent to». Aspetta l'ok dell'utente.

Il 2026-11-05 l'utente ha scelto un secondo punto, «Anche «Thanks for…»».
Il grazie di ogni segnalazione ora arriva nell'isola: `sayInIsland` parla
nell'ultimo `IslandLayer` sullo schermo, cioè quello sopra l'app (`Root.tsx`)
o quello nel foglio dei commenti. I test toccati sono verdi (57 + 39 di
`src/intro`), `tsc` ed eslint puliti; solo JS, impronta invariata. Nessun
video di questo collegamento: nella copia del simulatore l'API è spenta e
una segnalazione non parte. L'isola è la stessa del video
`b-island.mov`.

**B in `main`** il 2026-11-05 (#786, dde301bd), unita dal Coordinatore;
anteprima e OTA li segue lui con l'utente.

## Parte C — Fogli e liste (2026-11-05)

Branch `feat/TASK-388-c-sheets-lists` da `main` (dde301bd, con la #760 e la
#786 dentro); lista dei file approvata dal Coordinatore prima del codice.
Fatto così (ADR-0329, «Parte C»):

- `src/ui/SheetModal.tsx`: un `Modal` trasparente con `animationType="none"`
  il cui contenuto sale sulla molla `smooth` e scende allo stesso modo. Il
  `Modal` resta finché il foglio è giù; chiuso a metà scende da dove si
  trova, riaperto mentre scende torna su, con il contenuto da capo. Mentre
  scende non prende tocchi. Con «Riduci movimento» solo una dissolvenza.
  Passa `onDismiss` (iOS, TASK-358) e ha `onHidden` per chi lo smonta.
- I sette fogli dal basso che usavano `animationType="slide"` su un `Modal`
  trasparente: «+» dei messaggi (`AttachButton`), il foglio di un messaggio
  (`MessageSheet`, che ora si chiude da sé e poi chiama `onClose`), i filtri
  della ricerca (`FilterSheet`), il super like (`SuperLikeSheet`, solo il
  foglio), «Tag people» (`TagPeople`), i commenti (`DrawingComments`), il
  «…» (`ReportMenu`).
- `src/ui/Cascade.tsx`: `<Cascade index>` fa entrare una riga in
  dissolvenza, 6 punti più in basso, sulla molla `smooth`, 25 ms dopo la
  precedente; solo le prime 6. Con «Riduci movimento» le righe ci sono
  subito. Sulle liste: le conversazioni (`ConversationList`), la campanella
  (`BellOverlay`), i commenti (`DrawingComments`), i risultati della ricerca
  (`ResultsGrid`).

Restano come sono: i `Modal` a tutto schermo (Body, Heart zones, Send to a
friend, il picker dei disegni, `OutlineBoard`, `SharePost`), che salgono con
la pagina nativa di iOS; le note in dissolvenza; `FeedScreen` (la riga di
TASK-365); `tokens.ts` (le costanti stanno nei file nuovi).

### Criteri di accettazione (C)

- [x] Il foglio sale sulla molla `smooth`, mai oltre il suo posto di più di
      un punto; chiuso, scende e poi sparisce, e `onHidden` arriva dopo
      (`SheetModal.test.tsx`).
- [x] Riaperto mentre scende: nessun salto, torna su da dove si trova, con
      il contenuto da capo.
- [x] Con «Riduci movimento» nessuna molla, solo la dissolvenza.
- [x] La cascata: righe una dopo l'altra, dal basso, solo le prime 6; con
      «Riduci movimento» nessun movimento (`Cascade.test.tsx`).
- [x] «+» dei messaggi: la libreria si apre ancora solo a foglio sparito
      (TASK-358, `Attachments.test.tsx`).
- [x] Testi invariati, nessun colore a mano, nessuna dipendenza; solo JS,
      impronta iOS `6f8bba4c` invariata.
- [x] Video in `out/TASK-388/c-*` e l'ok dell'utente («Sì, approvo», 2026-11-05).

### File toccati (C)

```
apps/mobile/src/ui/SheetModal.tsx            (nuovo)
apps/mobile/src/ui/SheetModal.test.tsx       (nuovo)
apps/mobile/src/ui/Cascade.tsx               (nuovo)
apps/mobile/src/ui/Cascade.test.tsx          (nuovo)
apps/mobile/src/messages/AttachButton.tsx
apps/mobile/src/messages/MessageSheet.tsx
apps/mobile/src/messages/ConversationList.tsx
apps/mobile/src/messages/Attachments.test.tsx
apps/mobile/src/search/FilterSheet.tsx
apps/mobile/src/search/ResultsGrid.tsx
apps/mobile/src/social/SuperLikeSheet.tsx
apps/mobile/src/social/TagPeople.tsx
apps/mobile/src/social/DrawingComments.tsx
apps/mobile/src/social/ReportMenu.tsx
apps/mobile/src/social/DrawingReactions.test.tsx
apps/mobile/src/bell/BellOverlay.tsx
docs/tasks/TASK-388.md
docs/DECISIONS.md   (righe aggiunte in ADR-0329)
docs/STATUS.md      (righe aggiunte)
docs/UI.md
```

### Esito C

Fatto nel codice e nei test: `SheetModal.test.tsx` 5, `Cascade.test.tsx` 3;
verdi le cartelle toccate (486) e le schermate che usano questi pezzi (382),
`tsc` ed eslint puliti. Due test esistenti aspettano ora che il foglio sia
giù: `Attachments.test.tsx` (la libreria dopo il foglio) e
`DrawingReactions.test.tsx` (il super like). Video
`out/TASK-388/c-sheet-list.mov` nella copia del simulatore, app vera senza
banco di prova: i filtri della ricerca salgono in ~0,35 s e si fermano sul
posto, si chiudono scendendo; i risultati «Hearts» entrano uno dopo l'altro
(`c-sheet-frames.jpg`, `c-cascade-frames.jpg`). Approvato dall'utente il
2026-11-05 («Sì, approvo»); merge del Coordinatore a CI verde.
**C in `main`** il 2026-11-05 (#803, fed77512).

## C2 — Lo sfondo che sfuma (2026-11-05)

L'utente, alla proposta di far sfumare lo sfondo scuro invece di farlo salire
con il foglio: «VA BENE». Branch `fix/TASK-388-c2-sheet-scrim` da `main`
(fed77512); lista dei file approvata dal Coordinatore. Dei sette fogli solo i
filtri della ricerca hanno uno sfondo scuro; gli altri sei sono trasparenti e
non cambiano.

- `SheetModal` ha `dim`: dietro il foglio uno strato `color.scrim` che resta
  fermo e si scurisce fino a `SHEET_DIM_OPACITY` (0,5, il valore che aveva
  `FilterSheet`) con la stessa molla del foglio, e si schiarisce quando
  scende. Non prende tocchi.
- `FilterSheet` passa `dim`; il suo `backdrop` resta solo per il tocco che
  chiude, senza colore.

### Criteri di accettazione (C2)

- [x] Senza `dim` nessuno strato; con `dim` lo strato non scorre, cresce
      solo mentre il foglio sale, mai oltre 0,5, e se ne va con il foglio
      (`SheetModal.test.tsx`).
- [x] Lo strato non prende tocchi: il tocco fuori dal foglio lo chiude
      ancora.
- [x] Solo JS, impronta `6f8bba4c` invariata; nessun colore a mano.
- [x] Video in `out/TASK-388/c2-*` e l'ok dell'utente: «Sì, approvo»,
      2026-11-05.

### File toccati (C2)

```
apps/mobile/src/ui/SheetModal.tsx
apps/mobile/src/ui/SheetModal.test.tsx
apps/mobile/src/search/FilterSheet.tsx
docs/tasks/TASK-388.md
docs/DECISIONS.md   (righe aggiunte in ADR-0329)
docs/STATUS.md      (righe aggiunte)
docs/UI.md
```

### Esito C2

`SheetModal.test.tsx` 8 (3 nuovi sullo strato), `src/search` verde, `tsc` ed
eslint puliti. Video `out/TASK-388/c2-scrim.mov` sull'app vera (ricerca, i
filtri): lo schermo si scurisce in alto e in basso nello stesso momento, cioè
sul posto, mentre il foglio sale (`c2-scrim-frames.jpg`); chiuso, schiarisce
in ~0,4 s. L'utente l'ha approvato il 2026-11-05 («Sì, approvo»); merge del
Coordinatore a CI verde.

## Fuori scope

- Reanimated o qualunque modulo nativo: se servisse davvero, è una domanda
  all'utente con il costo (una build nativa nuova).
- Dove usare l'«isola» oltre al primo punto: lo decide l'utente.
- Un OTA di produzione: col sì dell'utente.

## C3 — Il foglio dei prodotti Style (2026-11-05)

Dopo la parte C è arrivato in `main` il foglio di un prodotto dei post Style
(TASK-384 B, #809), ancora con la `Modal` «slide» di sistema. Lista dei file
approvata dal Coordinatore («via sulla lista»); `StyleProductSheet` e
`StylePost.test` sono di TASK-384, chiuso per la parte B, e nessuna PR aperta
li tocca. Branch `fix/TASK-388-c3-style-sheet` da `main`.

- `StyleProductSheet` passa a `SheetModal`, come `MessageSheet`: tiene il suo
  `open`; il tocco fuori e il «indietro» di Android chiudono, e il post
  sente `onClose` solo quando il foglio è giù (`onHidden`). Niente `dim`: lo
  sfondo resta trasparente, com'era.

### Criteri di accettazione (C3)

- [x] Il foglio sale e scende sulla molla `smooth` dei fogli; con «Riduci
      movimento» sfuma.
- [x] Il tocco fuori chiude; il post lo sa a foglio giù
      (`StylePost.test.tsx`).
- [x] Solo JS, impronta `6f8bba4c` invariata; testi invariati.
- [x] Video in `out/TASK-388/c3-*` e l'ok dell'utente: «Sì, approvo»,
      2026-11-05.

### File toccati (C3)

```
apps/mobile/src/feed/StyleProductSheet.tsx
apps/mobile/src/feed/StylePost.test.tsx
docs/tasks/TASK-388.md
docs/STATUS.md      (righe aggiunte, dopo la #811)
docs/UI.md
```

### Esito C3

`StylePost.test.tsx` 8 (il tocco fuori ora aspetta il foglio giù) e
`SheetModal.test.tsx` verdi, `tsc`, eslint e prettier puliti. Video
`out/TASK-388/c3-style-sheet.mov` nella copia del simulatore, con un post
Style di prova sulla ricerca (solo nella copia, tolto dopo: il Feed lì non
carica senza API): il foglio sale in ~0,35 s e si ferma senza rimbalzo, il
tocco fuori lo fa scendere (`c3-open-frames.jpg`, `c3-close-frames.jpg`).
Approvato dall'utente il 2026-11-05 («Sì, approvo»); merge del Coordinatore
a CI verde, dopo la #811.
