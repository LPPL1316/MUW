# TASK-388 — Movimenti stile Apple: molle condivise, la barra in basso, l'«isola», fogli e liste

**Stato**: In corso — parte A in `main` (#770, 0d7819c4, 2026-11-05); A2 in `main` (#780, 07d5833c); parte B, l'isola, in PR
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
- [x] Impronta iOS invariata: `6f8bba4c`.
- [ ] Video in `out/TASK-388/b-*` e l'ok dell'utente.

### File toccati (B)

```
apps/mobile/src/ui/Island.tsx              (nuovo)
apps/mobile/src/ui/useIsland.tsx           (nuovo)
apps/mobile/src/ui/Island.test.tsx         (nuovo)
apps/mobile/src/messages/SendToFriend.tsx
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

## Fuori scope

- Reanimated o qualunque modulo nativo: se servisse davvero, è una domanda
  all'utente con il costo (una build nativa nuova).
- Dove usare l'«isola» oltre al primo punto: lo decide l'utente.
- Un OTA di produzione: col sì dell'utente.
