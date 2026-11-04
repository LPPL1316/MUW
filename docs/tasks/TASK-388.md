# TASK-388 — Movimenti stile Apple: molle condivise, la barra in basso, l'«isola», fogli e liste

**Stato**: In corso — parte A in PR (2026-11-04)
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

- `ScrollView` → `Animated.ScrollView`, `onScroll` =
  `Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }],
  { useNativeDriver: true, listener: onScroll })`. Il suo `onScroll` resta
  intero come listener (costruisce le pagine pigre, sposta le vicine a metà
  gesto), `scrollEventThrottle={16}`.
- `restX` = `(around.get(page) ?? now.place) * width`, in un
  `useLayoutEffect` su `[around.get(page), width]`. Una pagina cambia posto
  solo fuori vista, quindi `restX` resta fermo per tutto lo swipe. A un tocco,
  al giro guidato e a «indietro» la pagina nuova arriva nello stesso posto,
  quindi `drag` resta 0 e la capsula va con la molla.
- `drag = (scrollX − restX) / width`, passato a `TabBar`.
- «Messages» senza account: lo swipe arriva a Messages e l'app manda al
  profilo. La capsula si mette su Messages, dove il dito l'ha portata, e da
  lì va al profilo con la molla.
- Gli `scrollTo` (layout, `now.asked`, rotazione) riportano `drag` a 0 senza
  cambiare pagina. Con VoiceOver o TalkBack lo scroll è spento e `drag`
  resta 0. Ai capi della striscia lo swipe si ferma e non serve altro.
- I test di TASK-379 in `TabShell.test.tsx` (`tab-pages`, `scroll`,
  `momentumScrollEnd`, `scrollEndDrag`, le prop della striscia) restano
  sull'`Animated.ScrollView`. Dopo il cambio va rilanciato `jest src/tabs`.

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
- [ ] Impronta iOS invariata su una copia pulita.
- [ ] Video prima/dopo della barra in `out/TASK-388/`, e l'ok dell'utente.

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
docs/tasks/TASK-388.md                         (nuovo)
docs/DECISIONS.md                              (ADR-0329, righe aggiunte)
docs/STATUS.md                                 (righe aggiunte)
docs/INDEX.md                                  (una riga)
docs/UI.md                                     (la barra e il movimento)
```

## Fuori scope

- Reanimated o qualunque modulo nativo: se servisse davvero, è una domanda
  all'utente con il costo (una build nativa nuova).
- Dove usare l'«isola» oltre al primo punto: lo decide l'utente.
- Un OTA di produzione: col sì dell'utente.
