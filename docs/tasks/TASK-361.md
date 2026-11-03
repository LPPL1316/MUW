# TASK-361 — «Draw» si capisce in 3 secondi: partenza, cosa disegni, quanto corri, «Draw»

**Stato**: In lavorazione · **parte A in `main`**, #675 (i pezzi nuovi e
`ChooseScreen`); **parte B in `main`**, #688; manca la pubblicazione e la
data della privacy da sistemare (vedi «Esito»)
**Fase**: 4 · **Branch**: parte A `feat/TASK-356-draw-redesign` (nome del
numero di prima); parte B `feat/TASK-361-b-draw-wiring`, da `main` dopo la
#675 · **ADR**: ADR-0307

Numeri dal Coordinatore (2026-10-30, sulla #675): **TASK-361**, **ADR-0307**
confermato. Prima l'agente, senza Coordinatore raggiungibile, aveva preso
TASK-351 e poi TASK-356, già assegnati ad altri task (il video della
corsa, #669; la posizione del Feed).

## Obiettivo

Richiesta dell'utente del 2026-10-30, incollata parola per parola nella
sessione `claude/muw-draw-screen-redesign-n6gh3x` (riassunta qui): chi apre
«Draw» deve capire in tre secondi 1) da dove parte, 2) cosa disegna,
3) quanto corre, 4) che deve premere «Disegna il percorso». Senza cambiare
la generazione del percorso né le API; tema scuro e giallo d'accento.

Sette problemi:

1. due pulsanti gialli in gara: «Run without a route» diventa secondario;
2. il 🏃 dell'intestazione non si capisce: icona e testo in un pulsante;
3. «Draw on the map» sembra una quarta modalità separata: un'opzione
   esplicita dell'interruttore;
4. il campo «cerchio» ripete la forma scelta: solo in «Word», con
   «Scrivi una parola, es. CIAO»;
5. la fila delle forme è tagliata a destra: griglia a due righe con
   «Vedi tutte»;
6. «Parti dalla tua posizione.» non dice niente: la via vera
   («📍 Via Roma, Levico Terme»); in «Another place» la ricerca;
7. la scheda «Play» è coperta dal pulsante fisso: spazio in fondo pari al
   pulsante più l'area sicura.

Miglioramenti: sezioni numerate «1 Start · 2 What you draw · 3 Distance»;
anteprima della forma in scala; il tempo stimato sotto la distanza col
ritmo dell'utente; − e + di 0,5 km, tenuti premuti scorrono, il numero si
scrive con un tocco; il testo del pulsante dice cosa disegna («Draw a
7.8 km circle»); vibrazione (`expo-haptics`) su forme e passi; tocco
minimo 44 pt, grigi WCAG AA, `accessibilityLabel` su ogni pulsante.

## Scelte

- **Ordine dei lavori** (scelta dell'utente del 2026-10-30, «Dopo la
  #661»): `RoutePanel.tsx` e `App.tsx` sono della #661 (TASK-340) ancora
  aperta. Parte A: tutto ciò che si fa con file nuovi, più
  `ChooseScreen.tsx`, che nessuna PR aperta tocca. Parte B dopo il merge
  della #661, da `main`. Questo task prende il posto della parte E
  («Draw») di TASK-339.
- **«Freehand»**: lo fa già la #661, primo nell'interruttore («Freehand |
  Shape | Word | Image», richiesta dell'utente del 2026-10-29). La
  richiesta di oggi lo vuole un'opzione esplicita, che la #661 già fa; la
  posizione resta la prima (proposta dell'agente, da rivedere se l'utente
  lo vuole quarto, «Libero»).
- **La via** dal geocoder del telefono (`expo-location`,
  `reverseGeocodeAsync`): Apple su iPhone, Google su Android; niente
  chiavi né servizi nostri. **Il punto GPS va al geocoder del telefono**:
  una riga nuova nella privacy, sotto (risposta 1).
- **`expo-haptics`** (chiesta dall'utente): dipendenza nuova, esclusa
  dall'autolinking e caricata solo se il modulo nativo c'è, come
  `expo-contacts`: vibra in Expo Go e nella prossima build nativa, nella
  1.0 dello Store non fa niente. Impronta iOS `83793e26` invariata.
- Il resto deciso dall'agente su delega dell'utente: ADR-0307.

## Le risposte dell'utente (2026-10-30)

Chieste su richiesta del Coordinatore (sulla #675) prima di togliere la
bozza: 1) il sì alla riga di privacy sul geocoder del telefono, nelle cinque
lingue, col testo esatto; 2) il sì alla lista completa dei testi nuovi
(`out/TASK-361/testi-da-approvare.md`, ricopiata qui sotto per la parte che
resta). La risposta dell'utente, parola per parola:

> sì 1 e sì 2

**1. La riga di privacy**, in «Others who receive data», dopo OpenFreeMap,
nell'app (`about/content/*.ts`) e sul sito (`site/privacy/`, rifatto con
`site/tools/make_privacy.mjs`). La data resta il 30 ottobre 2026, già messa
da TASK-352 lo stesso giorno. Se TASK-356 (la posizione del Feed) cambia la
privacy dopo, chi arriva secondo riallinea. Riallineata al testo di TASK-363
il 2026-11-01, su indicazione del Coordinatore: la riga resta quella approvata,
e la data della privacy passa al 1° novembre 2026 nelle cinque lingue.

- en: «Apple on an iPhone, or Google on Android, through the phone's own
  address service, receives the position «Draw» starts from, to write the
  name of its street. MuW sends it nothing else and does not keep the name.»
- it: «Apple su iPhone, o Google su Android, tramite il servizio di
  indirizzi del telefono, riceve la posizione da cui parte «Disegna», per
  scrivere il nome della via. MuW non gli manda nient'altro e non conserva
  il nome.»
- de: «Apple auf dem iPhone oder Google auf Android erhält über den
  Adressdienst des Telefons die Position, von der «Zeichnen» startet, um den
  Namen der Straße anzuzeigen. MuW sendet sonst nichts und speichert den
  Namen nicht.»
- es: «Apple en el iPhone, o Google en Android, a través del servicio de
  direcciones del teléfono, recibe la posición desde la que empieza
  «Dibuja», para escribir el nombre de la calle. MuW no le envía nada más y
  no guarda el nombre.»
- fr: «Apple sur iPhone, ou Google sur Android, via le service d'adresses
  du téléphone, reçoit la position d'où part «Dessiner», pour écrire le nom
  de la rue. MuW ne lui envoie rien d'autre et ne garde pas le nom.»

Una correzione dopo il sì: nel testo approvato la pagina era «Draw» in
tutte le lingue; nell'app si chiama «Disegna», «Zeichnen», «Dibuja»,
«Dessiner» (TASK-210 G), e così è scritta sopra. Confermata
dall'utente lo stesso giorno, parola per parola: «sì, Disegna».

**2. I testi nuovi** (parte A, tutti già nelle tabelle `i18n/*.ts`):
«≈ {time} at {pace}», «≈ {time} at {pace} (a usual pace)», «{name}, about
{size} on the map», «See all», «See all {count} shapes», «Show fewer»,
«Show fewer shapes», «Tap to type the distance», «Records the run without
drawing a route first», «Draw a {distance} {name}», «Draw “{word}”,
{distance}», «Draw the picture, {distance}», «Type another shape», «Write
a shape that is not among the tiles», con le traduzioni approvate. Per la
parte B, approvati anche: «WHAT YOU DRAW» (COSA DISEGNI, WAS DU ZEICHNEST,
QUÉ DIBUJAS, CE QUE TU DESSINES) e «Write a word, e.g. CIAO» (Scrivi una
parola, es. CIAO; Schreib ein Wort, z. B. CIAO; Escribe una palabra, p. ej.
CIAO; Écris un mot, par ex. CIAO).

## Cosa fare

**Parte A** (questa PR):

1. `haptics/haptics.ts`: `selectionFeel`, `stepFeel`, muti senza nativo.
2. `route/halfStep.ts`: mezzo km per passo, i tempi della ripetizione.
3. `route/DistanceDial.tsx`: − e + a mezzo km, tenuti scorrono più veloci,
   il numero si scrive, regolabile da VoiceOver, il tempo sotto.
4. `route/runTime.ts`: il ritmo dalle ultime 10 corse a piedi (1 km o più,
   fra 2:30 e 15:00 al km), altrimenti 6:00 «a usual pace».
5. `route/shapeScale.ts`, `route/ShapePreview.tsx`: la forma del catalogo
   in scala, un pezzo di mappa, la barra della scala, le misure.
6. `route/ShapeGrid.tsx`: 7 forme + «See all» in due righe; aperta, tutte.
   La forma scelta resta sempre in vista.
7. `route/drawLabel.ts`: il testo del pulsante giallo.
8. `screens/StepTitle.tsx`, `screens/RunNoRouteButton.tsx`,
   `route/OtherShapeField.tsx` (il campo dietro «Type another shape»: si
   apre al tocco, o da solo se le parole scritte non sono quelle di un
   riquadro).
9. `location/startAddress.ts`: la via e il paese, richiesti di nuovo solo
   dopo 75 m.
10. `ChooseScreen.tsx`: «🏃 Run without a route» con contorno; «1 START»;
    «📍 via, paese» col GPS; il pulsante in fondo ancorato sopra la
    pagina, che finisce più in basso della sua altezza misurata.
11. Testi nelle quattro lingue; test.

**Parte B** (dopo la #661, da `main`):

1. `RouteChoice` in `RoutePanel.tsx`: «2 WHAT YOU DRAW» e «3 DISTANCE»
   con `StepTitle`; `ShapeGrid` al posto di `ShapeTiles`; il campo della
   forma dietro «Type another shape» (`OtherShapeField`, con `ShapeNote`
   sotto), **scelta dell'utente del 2026-10-30** («Tienilo dietro il link
   «Type another shape»»): così una forma fuori catalogo si scrive ancora
   e l'AI la legge;
   in «Word» il segnaposto «Write a word, e.g. CIAO»; `ShapePreview` sotto
   la griglia; `DistanceDial` al posto di `DistanceStepper` con
   `runTimeText`.
2. `DrawButton` col testo di `drawLabel`.
3. `App.tsx`: il ritmo da `useActivities` (con un account), l'icona della
   bici in `runIcon`.
4. Etichette inattive di `Segmented` più chiare (`textMuted`).
5. `UI.md` («La partenza», «Draw»), ADR-0307, STATUS.

## Criteri di accettazione

Parte A:

- [x] «Run without a route» non è giallo: contorno, 🏃 e testo in un
      pulsante con `accessibilityLabel` e `accessibilityHint`.
- [x] Col GPS la scheda dice «📍 via, paese»; senza risposta la riga di
      prima; con «Another place», permesso negato o ricerca, la riga di
      prima.
- [x] La pagina finisce sotto il pulsante fisso: `paddingBottom` = altezza
      misurata del pulsante (che ha già dentro l'area sicura) + 24; il
      pulsante resta sopra la tastiera (ancorato in una scatola che la
      tastiera accorcia, non nel `KeyboardAvoidingView` stesso).
- [x] − e + di mezzo km, tenuti scorrono; nessun passo in più al rilascio.
- [x] Il tempo: «≈ 42 min at 5:20/km», o «(a usual pace)» senza corse.
- [x] La griglia non scorre di lato; «See all» apre le 17 forme.
- [x] La vibrazione non fa niente senza il modulo nativo, e mai un errore.
- [x] Impronta iOS `83793e26` invariata.
- [x] jest, lint, typecheck e format verdi.

Parte B:

- [x] «2 WHAT YOU DRAW» e «3 DISTANCE» con `StepTitle`; «DRAW» esce dalle
      tabelle.
- [x] In «Shape» la griglia a due righe (`ShapeGrid`) al posto della fila,
      il campo dietro «Type another shape» con le note sotto, la forma in
      scala quando c'è una forma e una distanza valida.
- [x] In «Word» il segnaposto «Write a word, e.g. CIAO».
- [x] `DistanceDial` al posto di `DistanceStepper`, col tempo stimato solo
      per la corsa; il ritmo da «My activities» (`list` di
      `useActivitiesDoor`), o 6:00 senza corse.
- [x] «Draw route» dice cosa disegna (`drawLabel`, `drawWhat`), su una riga
      che si stringe; `testID="draw-route"` per i test, perché le parole
      cambiano.
- [x] L'icona dello sport accanto a «… without a route» (🏃 🚴 🛶 🪂).
- [x] `Segmented`: le scelte non prese nel colore del testo, più leggere;
      la presa in grassetto.
- [x] jest di tutto `src` (4323 test) e di 29 file delle schermate
      intere verdi su questa macchina, lint, typecheck e format verdi.
      `App.test.tsx`, `AppFavoriteActivity`, `AppBikeNavigation`,
      `AppDrawingStart` e `AppPenUpSaved` qui si bloccano anche senza la
      parte B (provati sulla testa della #675, verde in CI): li prova la
      CI.

## File toccati

Parte A:

```
apps/mobile/package.json                 (expo-haptics, escluso dall'autolinking)
package-lock.json
apps/mobile/src/haptics/haptics.ts       (nuovo, con test)
apps/mobile/src/location/startAddress.ts (nuovo, con test)
apps/mobile/src/route/halfStep.ts        (nuovo, con test)
apps/mobile/src/route/DistanceDial.tsx   (nuovo, con test)
apps/mobile/src/route/runTime.ts         (nuovo, con test)
apps/mobile/src/route/shapeScale.ts      (nuovo, con test)
apps/mobile/src/route/ShapePreview.tsx   (nuovo, con test)
apps/mobile/src/route/ShapeGrid.tsx      (nuovo, con test)
apps/mobile/src/route/drawLabel.ts       (nuovo, con test)
apps/mobile/src/screens/StepTitle.tsx    (nuovo, con test)
apps/mobile/src/screens/RunNoRouteButton.tsx (nuovo)
apps/mobile/src/route/OtherShapeField.tsx (nuovo, con test)
apps/mobile/src/screens/ChooseScreen.tsx
apps/mobile/src/screens/ChooseScreen.test.tsx
apps/mobile/src/i18n/{it,de,es,fr}.ts    (solo righe aggiunte in fondo)
apps/mobile/src/about/content/{en,it,de,es,fr}.ts (la riga di privacy)
site/privacy/**/index.html               (rifatte da make_privacy.mjs)
apps/mobile/src/about/AboutPage.test.tsx (la data della privacy)
apps/mobile/src/about/documents.test.ts  (la data della privacy)
site/tests/privacy.test.mjs              (la data della privacy)
docs/tasks/TASK-361.md
docs/DECISIONS.md                        (ADR-0307)
docs/STATUS.md                           (una riga in «In lavorazione»)
```

Parte B:

```
apps/mobile/App.tsx
apps/mobile/src/route/RoutePanel.tsx
apps/mobile/src/route/drawLabel.ts          (drawWhat)
apps/mobile/src/route/DistanceDial.tsx      (via il riquadro «adjustable»)
apps/mobile/src/route/DistanceDial.test.tsx
apps/mobile/src/screens/Segmented.tsx
apps/mobile/src/screens/RunNoRouteButton.tsx (withoutRouteIcon)
apps/mobile/src/route/OtherShapeField.tsx   (il campo resta aperto, e mostra
                                            il nome di una tessera scritto)
apps/mobile/src/route/OtherShapeField.test.tsx
apps/mobile/src/route/testing.ts            (nuovo: aiuti per i test)
apps/mobile/src/i18n/{it,de,es,fr}.ts       (due testi, via «DRAW»)
docs/UI.md, docs/DECISIONS.md (ADR-0307), docs/STATUS.md, questo file
```

E i test che cercavano «Draw route» per le sue parole, ora per
`testID="draw-route"` (solo quella riga cambia): `__tests__/App*.test.tsx`
(16 file), `src/account/Profile.test.tsx`,
`src/location/PickStartApp.test.tsx`, `src/mapdraw/ChangeFigureApp.test.tsx`,
`src/mapdraw/DrawOnMapApp.test.tsx`, `src/screens/ProfileLayer.test.tsx`;
con le attese nuove (mezzo km, «COSA DISEGNI», «WHAT YOU DRAW», la
griglia, il campo dietro il link, con gli aiuti di `src/route/testing.ts`):
`src/route/RoutePanelMiles.test.tsx`, `RoutePanelBike.test.tsx`,
`RoutePanelPaddle.test.tsx`, `DrawItalian.test.tsx`,
`src/units/DrawDistanceMiles.test.tsx`,
`__tests__/App.test.tsx`, `AppDrawAgain.test.tsx`, `AppPaddle.test.tsx`,
`AppPlay.test.tsx`.

## Fuori scope

- La generazione del percorso, il motore, le API: non si toccano.
- La build nativa che accende la vibrazione nello Store (con TASK-321 B o
  la 1.0.2 di TASK-336, col sì dell'utente).
- Il resto del look premium (TASK-339 B–D).
- Spostare «Play» in «Explore»: basta lo spazio in fondo.

## Esito

**2026-11-02, non ancora chiuso.** La parte A è in `main` con la #675
(`d2dd7435`, 12:04 UTC, alla testa `99570990` con la CI verde, impronta iOS
`83793e26` invariata); la parte B con la #688 (`74f34e79`, 12:24 UTC).

Ancora aperto:

- **La data della privacy**: dice 1° novembre 2026 nelle cinque lingue
  (app e sito), ma il testo nuovo è entrato in `main` il 2 novembre. Da
  sistemare con un sì dell'utente, perché tocca il testo della privacy.
- **La pubblicazione**: prima una preview di `main` che l'utente prova, poi
  l'OTA di produzione. La preview la pubblica il Coordinatore; l'OTA di
  produzione la lancia l'utente a mano, dalla copia pulita che il
  Coordinatore ha preparato (2026-11-02). Il server
  resta a `c7a83347` (migrazioni fino alla 0038): secondo il Coordinatore
  non blocca, perché senza tema le sfide di TASK-343 B non si vedono.
- **La vibrazione** resta spenta nella build dello Store finché una build
  nativa non toglie `expo-haptics` dall'esclusione dell'autolinking.
