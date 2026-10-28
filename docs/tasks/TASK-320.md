# TASK-320 — Disegnare a mano in «Draw», e modificare ogni disegno proposto

**Stato**: In lavorazione — parte A fatta (PR #612), parte B da fare
**Fase**: 4 · **Branch**: `docs/TASK-320-freehand-edit` (i documenti, PR #606),
`feat/TASK-320-a-freehand` (parte A, PR #612), poi
`feat/TASK-320-b-edit-cards` · **ADR**: ADR-0280

Numeri, parti e condizioni dal Coordinatore (2026-10-28, sotto).

## Obiettivo

In «Draw» la figura si può anche disegnare col dito su una tavola vuota, e
ogni figura che l'app già propone — una forma del catalogo, il risultato di
«Draw», un percorso di «Explore» (anche da una ricerca), il disegno di un
iscritto nel «Feed» o in un profilo — si apre nella stessa tavola, si cambia
e si ridisegna dove si vuole.

## Contesto

Richiesta dell'utente del 2026-10-28: «Dai la possibilità di disegnare anche
a mano nella pagina draw e dai la possibilità di modificare un disegno del
feed, un disegno ricercato, un disegno di explore… o quanto già proposto
deve essere tutto potenzialmente editabile».

Oggi:

- col dito si disegna solo sulla mappa («Draw on the map», TASK-281,
  ADR-0245): la grandezza è quella sulla mappa, la partenza dove si è
  disegnato; in «Draw» le scelte sono «Shape | Word | Image». La linea a
  dito è lavorata tutta sul telefono (`mapdraw/drawing.ts`): la prima
  linea è il contorno, le altre dettagli appesi;
- il contorno di una foto si modifica in «Edit the outline» (TASK-079,
  ADR-0074; «Save» in fondo, TASK-229): «Add a part» e «Add a detail»,
  uniti dal motore con `POST /image-outline-edits`, e «Undo». La tavola
  vuole una foto sotto e la rete a ogni linea;
- «Draw it near me» (TASK-313, ADR-0273) porta in «Draw» la forma o la
  parola di un percorso o di un disegno, non le sue linee: niente si cambia;
- un preferito con un'immagine ricostruisce il contorno dai punti del
  percorso (`favorites/favoriteRoute.ts`, `outlineOf`).

Il contratto ha già tutto: `ImageRouteRequest` (`outline` + `strokes`,
centrati in [-1, 1]) è quello che «Draw on the map» manda per una linea a
dito (`mapdraw/canvasRequest.ts`, `framed`). Niente cambia nell'API né nel
motore. Un contorno si disegna sul server (`engine/onPhone.ts`,
`planOnPhone`: «photos are drawn on the server»): «Draw route» di un
disegno a mano va al server come per una foto; prima di «Draw route» niente
parte dal telefono.

## Proposte da confermare (scelte di prodotto)

Decise dall'agente su delega, da confermare dall'utente con un sì o da
correggere; il codice parte dopo.

**Approvate dall'utente il 2026-10-28**, tutte e cinque, insieme ai testi e
alla riga della privacy qui sotto («Sì, le proposte, i testi e la riga
della privacy di TASK-320 vanno bene: avvia la parte A»).

1. **Dove si disegna a mano**: una quarta scelta **«Freehand»**
   nell'interruttore di «Draw», «Shape | Word | Image | Freehand» (con
   «Paddle» non c'è, come «Word» e «Image»: sull'acqua solo forme). Sotto,
   il riquadro della figura disegnata, come l'anteprima di un'immagine ma
   senza foto, con «Edit the drawing»; vuoto, un tasto «Draw with your
   finger» che apre la tavola. «Draw on the map» resta com'è: là la figura
   ha la grandezza e il posto della mappa, qui la distanza e la partenza di
   «Draw». Scartato: la tavola vuota dentro «Draw on the map» (una figura
   disegnata sulla mappa ha già un posto e una grandezza).
2. **La tavola**, «Edit the drawing»: una tavola vuota a tutto schermo con
   le regole della linea a dito di «Draw on the map» (ADR-0245), tutte sul
   telefono. **La prima linea è il contorno**, chiuso dall'app (l'ultimo
   punto torna al primo; una linea che passa oltre l'inizio si chiude dove
   si incrocia); **le linee dopo sono dettagli** appesi al contorno (un
   trattino dal punto più vicino; il percorso le fa andata e ritorno; una
   linea che torna su se stessa fa un anello, come un occhio); **«Erase»**
   (nuovo: un tocco su una linea la toglie; il contorno porta via i suoi
   dettagli, e la linea dopo è il contorno nuovo); **«Undo»** e **«Save»**
   in fondo. Due dita ingrandiscono e spostano. Niente rete prima di «Draw
   route». Scartati: «Add a part» del motore (unire una figura chiusa al
   contorno con `/image-outline-edits`: vorrebbe la rete a ogni linea; qui
   il contorno si ridisegna; per le foto «Edit the outline» resta com'è) e
   spostare i punti uno a uno (un altro editor).
3. **Da dove si modifica** («tutto quello che è proposto»):
   - in «Draw», sotto la forma scelta, **«Edit the drawing»**: le linee
     della forma del catalogo nella tavola; con «Save» la scelta passa a
     «Freehand» con quelle linee (la forma non è più «heart»: è un
     disegno);
   - sul **risultato** di «Draw», accanto alla riga delle figure (TASK-286):
     la figura chiesta (forma, foto, immagine pronta o disegno) nella
     tavola; «Save» torna a «Draw» con «Freehand» e la figura, stessa
     distanza e partenza;
   - sulla **scheda di un percorso di «Explore»** (esempi, consigliati, le
     ricerche) e su quella del **disegno di un iscritto** (Feed, profili):
     dopo «Start», «Export GPX» e «Draw it near me», che non si spostano,
     **«Edit the drawing»**; «Save» va in «Draw» come «Draw it near me»
     (ADR-0273: la partenza di «Draw», la distanza del percorso o della
     corsa al decimo di km dentro i limiti dello sport, nessuna richiesta
     prima di «Draw route»), con «Freehand» e la figura cambiata;
   - le immagini pronte e le foto hanno già «Edit the outline»: resta
     com'è.
4. **Che linee si aprono**: di una forma del catalogo, le linee del motore
   (`mapdraw/catalogueShapes.json`, come «Draw on the map» le mostra); di
   una foto o un'immagine, il contorno tracciato; di un percorso di
   «Explore» con una forma, e di un disegno di un iscritto con una forma,
   la forma del catalogo; di un disegno **senza** forma (una foto,
   un'immagine, un disegno a mano) la traccia corsa (`DrawingDetail.track`,
   tagliata ai capi), raddrizzata come fa un preferito e chiusa. **Non si
   modifica** (il pulsante non c'è): una **parola** (lettere a penna alzata,
   ADR-0157: la tavola disegna figure chiuse con dettagli; le lettere a mano
   sono un task a parte, se l'utente lo vuole), un **percorso a tema** di
   «Explore» (passa dai luoghi veri), un post di sole foto (TASK-312), una
   corsa senza traccia.
5. **Testi** (col sì dell'utente, cinque lingue): la tabella sotto, e la
   riga della privacy più sotto.

## Testi proposti

**Approvati dall'utente il 2026-10-28**, nelle cinque lingue, come sono
qui; in `src/i18n/{it,de,es,fr}.ts` con la parte A.

| en                                                             | it                                                                      | de                                                                           | es                                                               | fr                                                               |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| Freehand                                                       | A mano libera                                                           | Freihand                                                                     | A mano alzada                                                    | À main levée                                                     |
| Edit the drawing                                               | Modifica il disegno                                                     | Zeichnung bearbeiten                                                         | Editar el dibujo                                                 | Modifier le dessin                                               |
| Draw with your finger                                          | Disegna col dito                                                        | Mit dem Finger zeichnen                                                      | Dibuja con el dedo                                               | Dessine avec le doigt                                            |
| Erase                                                          | Cancella                                                                | Radieren                                                                     | Borrar                                                           | Effacer                                                          |
| Drawing                                                        | Disegno                                                                 | Zeichnung                                                                    | Dibujo                                                           | Dessin                                                           |
| Draw the outline with one finger: it closes by itself.         | Disegna il contorno con un dito: si chiude da solo.                     | Zeichne den Umriss mit einem Finger: er schließt sich von selbst.            | Dibuja el contorno con un dedo: se cierra solo.                  | Dessine le contour avec un doigt : il se ferme tout seul.        |
| Tap a line to erase it. The outline takes its details with it. | Tocca una linea per cancellarla. Il contorno porta via i suoi dettagli. | Tippe auf eine Linie, um sie zu löschen. Der Umriss nimmt seine Details mit. | Toca una línea para borrarla. El contorno se lleva sus detalles. | Touche une ligne pour l'effacer. Le contour emporte ses détails. |
| This line encloses nothing. Draw a closed shape.               | Questa linea non racchiude niente. Disegna una figura chiusa.           | Diese Linie umschließt nichts. Zeichne eine geschlossene Form.               | Esta línea no encierra nada. Dibuja una figura cerrada.          | Cette ligne n'entoure rien. Dessine une figure fermée.           |

«Drawing» è il titolo del percorso di un disegno a mano dove quello di una
foto dice «Image» (risultato, preferiti, «My activities», `route_title` di
un disegno pubblicato), quando l'app sa che la figura viene dalla tavola.
I testi della linea che si incrocia e dei troppi dettagli ci sono già
(TASK-281): si riusano.

## Privacy: che cosa copre oggi (condizione 5 del Coordinatore)

Letto il 2026-10-28 in `apps/mobile/src/about/content/en.ts`, «Routes you
ask for»: «To draw a route the app sends our server the start, the shape
or the word and the distance»; «The routes our engine draws stay on our
server without who asked for them…»; «A photo you choose for a drawing
goes to our server once, to find its outline: the server does not save it
and does not log it».

Che cosa succede davvero: un disegno a mano parte come `ImageRouteRequest`
(contorno e dettagli in [-1, 1], partenza, distanza), lo stesso di una foto
dopo il tracciato e della linea a dito di «Draw on the map» (TASK-281). Il
server non tiene i percorsi di un'immagine né il loro contorno («an image:
its outline is the user's own», `route_store.py`, ADR-0136; nemmeno
l'archivio di ADR-0256, `route_archive.py`); il registro delle richieste,
spento sul server, terrebbe `outline` e `strokes` (`API.md`). Il motore sul
telefono non disegna i contorni: vanno al server anche con la mappa offline.

**Trovato**: la privacy dice che partono «la forma o la parola», e della
foto solo che va a trovare il contorno. **Non dice che un contorno** —
della foto, della linea sulla mappa, di un disegno a mano — **parte come
richiesta di percorso, né che il server non lo tiene**. Vale già oggi per
TASK-073 e TASK-281: questo task non manda un dato di un tipo nuovo, ma
rende il buco più visibile. Proposta, col sì dell'utente (i testi legali li
approva lui, non l'agente): una riga in «Routes you ask for», dopo quella
della foto, nelle cinque lingue, che entra con la parte A insieme alla data
«updated».

**Approvata dall'utente il 2026-10-28**, come è qui; in
`src/about/content/{en,it,de,es,fr}.ts` con la parte A (la data «updated»
era già il 28 ottobre 2026, il giorno dei contatti di TASK-262 C).

| en                                                                                                                                     | it                                                                                                                                          | de                                                                                                                                                      | es                                                                                                                                            | fr                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A figure you draw with your finger, or the outline of your photo, goes to our server once, as the route you ask for: the server does not keep it. | Una figura disegnata col dito, o il contorno della tua foto, va al nostro server una volta, come il percorso che chiedi: il server non la tiene. | Eine mit dem Finger gezeichnete Figur oder der Umriss deines Fotos geht einmal an unseren Server, als die Route, die du anfragst: der Server behält sie nicht. | Una figura dibujada con el dedo, o el contorno de tu foto, va a nuestro servidor una vez, como la ruta que pides: el servidor no la guarda. | Une figure dessinée avec le doigt, ou le contour de ta photo, va une fois sur notre serveur, comme l'itinéraire que tu demandes : le serveur ne la garde pas. |

## Condizioni del Coordinatore (2026-10-28)

1. Il motore e il contratto non cambiano: la richiesta è un
   `ImageRouteRequest` come quello di TASK-281, sia sul server sia sul
   motore del telefono (TASK-214), con un test. Sul telefono i contorni
   vanno al server (`planOnPhone` li passa, come una foto): il test lo
   dice.
2. Niente rete finché l'utente non preme «Draw route».
3. Testi nuovi in cinque lingue col sì dell'utente.
4. L'impronta iOS resta `83793e26`, misurata dal Coordinatore: niente
   nativo e niente dipendenze nuove.
5. Privacy: un disegno a mano che parte per il server è come il contorno di
   un'immagine. Controllato sopra; la riga nuova vuole il sì dell'utente.
6. A PR verde, «#NNN pronta» al Coordinatore, che mergia.

Ordine e file: **due parti**, A («Freehand» ed «Edit the drawing» in
«Draw» e sul risultato) e B (le schede), ognuna un branch da `main` e i
suoi «File toccati» al Coordinatore prima del codice.

- La #584 (TASK-315) è in `main`: non blocca.
- A: `App.tsx` e i selettori di «Draw» li tocca anche TASK-318 (nascondere
  «Soon» nello store: `sport.ts`, `SportButton`, un test), piccolo e prima:
  se si toccano `SportButton` o `sport.ts`, aspettare il suo merge. La #604
  (TASK-317) tocca `RoutePanel.tsx` solo in `waitingText` e nel ramo
  «waiting»: non toccarli. `RouteOutcome` e `onLiftPen` (TASK-311 B, in
  `main`) restano come sono.
- B: `DrawingCard.tsx` lo toccherà TASK-309 B (corse di gruppo), non ancora
  partita; `ExploredCard`/`DrawingCard` hanno da poco «Draw it near me»
  (TASK-313). B dopo A; se 309 B è già aperta, il Coordinatore dice chi va
  prima. Il pulsante dopo «Start», «Export GPX» e «Draw it near me», che
  non si spostano.
- Profile e messaggi (TASK-319, PR in arrivo): non toccarli.
- Prossimi liberi per altri task: TASK-321, ADR-0281.

## Contesto da leggere

- `docs/UI.md`: «L'immagine (TASK-073)» (la tavola, «Edit the outline»),
  «Disegnare sulla mappa: «Draw on the map»» (la linea a dito e i suoi
  testi), «Il risultato» (la riga delle figure, TASK-286).
- `docs/DECISIONS.md`: ADR-0245 (la linea chiusa dall'app, i dettagli
  appesi), ADR-0074 (parti e dettagli delle foto), ADR-0273 («Draw it near
  me»: che cosa passa a «Draw»), ADR-0191 («Save» in fondo), ADR-0280
  (questo task).
- `docs/API.md`: `POST /image-route-jobs`.
- Codice: `src/mapdraw/drawing.ts` (`outlineOf`, `withDetail`,
  `travelledPoints`), `canvasRequest.ts` (`framed`), `figure.ts`
  (`lookOf`); `src/route/OutlineBoard.tsx`, `boardView.ts`, `drawnLine.ts`,
  `ImagePreview.tsx` (`OutlineLines`, `Sides`), `drawAgain.ts`;
  `src/favorites/favoriteRoute.ts` (`outlineOf` dai punti);
  `src/about/content/en.ts` («Routes you ask for»).

## Cosa fare

**Parte A — la tavola, «Freehand» ed «Edit the drawing» in «Draw» e sul
risultato** (`feat/TASK-320-a-freehand`)

1. `src/route/freehand.ts` (nuovo): la figura della tavola (contorno e
   dettagli in quote della tavola) con le regole di `mapdraw/drawing.ts`
   portate sul riquadro invece che sul piano in metri: `outlineOf` per la
   prima linea, i dettagli appesi come `withDetail` (le funzioni sul piano
   esportate da `drawing.ts`, se serve), «Erase» (la linea sotto il dito),
   e la richiesta con `framed` di `canvasRequest.ts` (`outline` e `strokes`
   in [-1, 1]).
2. `src/route/useFreehand.ts` (nuovo): lo stato della figura e i passi per
   «Undo»; nessuna chiamata di rete.
3. La tavola: `OutlineBoard.tsx` con la foto facoltativa e, senza foto, i
   tasti della tavola a mano («Erase», «Undo», «Save») e i suoi testi al
   posto di «Add a part» / «Add a detail»; oppure una tavola nuova
   `FreehandBoard.tsx` che riusa `boardView.ts`, `drawnLine.ts` e gli
   `OutlineLines`/`Sides` di `ImagePreview.tsx`. Decide la sessione, senza
   cambiare come funziona la tavola delle foto.
4. `RoutePanel.tsx` / `problems.ts`: la quarta scelta («Freehand» in
   `DRAW_KINDS`, `ChoiceKind`); il riquadro con le linee ed «Edit the
   drawing», o «Draw with your finger» da vuoto; sotto la forma scelta,
   «Edit the drawing» con le linee del catalogo.
5. `src/route/figureLines.ts` (nuovo): le linee di una figura, come la
   tavola le vuole: una forma del catalogo da `catalogueShapes.json` (la
   variante «down»: la prima linea è il contorno, le altre dettagli), una
   richiesta di percorso (forma → catalogo; immagine → `outline` e
   `strokes`; parola → null), i punti di un percorso o di una traccia
   (`favoriteRoute.outlineOf`).
6. `App.tsx`: lo stato di «Freehand» accanto a quello dell'immagine (una
   foto scelta non si perde passando a «Freehand» e viceversa); la
   richiesta è un `ImageRouteRequest` come per una foto; sul risultato
   «Edit the drawing» accanto alle tessere (`FigureTiles`), e «Save» torna
   a «Draw» con «Freehand», stessa distanza e partenza (come
   `changedRequest` di `resultFigure.ts`); il titolo «Drawing»
   (`favoriteRoute.ts`, `route_title` alla pubblicazione).
7. I testi di A e la riga della privacy nelle cinque lingue (con la data
   «updated»); `UI.md`. Test: per le stesse linee la richiesta è quella di
   «Draw on the map» (`canvasRequest`); `planOnPhone` la passa al server
   come una foto; nessuna chiamata prima di «Draw route».

**Parte B — «Edit the drawing» sulle schede** (`feat/TASK-320-b-edit-cards`),
dopo A

8. `ExploredCard.tsx` e `DrawingCard.tsx`: il pulsante dopo «Start»,
   «Export GPX» e «Draw it near me», solo quando c'è una figura (punto 4
   delle proposte). Per un disegno, le linee dalla traccia di
   `GET /drawings/{id}` (già nella scheda).
9. `App.tsx`: come «Draw it near me» (`drawAgain.ts`: distanza al decimo,
   limiti dello sport, `leave()` del disegno, `closeExplore()`), con
   «Freehand» e la figura; la tavola si apre subito, «Save» mostra «Draw».
   Niente in Profile e nei messaggi.
10. Test del flusso (`__tests__/AppEditDrawing.test.tsx`): nessuna
    richiesta prima di «Draw route».

## Criteri di accettazione

- [x] A: in «Draw» c'è «Freehand»; la tavola chiude la prima linea da sola
      (test `freehand.test.ts`, con linee come quelle di
      `drawing.test.ts`), rifiuta col suo testo una linea che non racchiude
      niente e una che si incrocia dove non si può chiudere, appende le
      linee dopo come dettagli; «Erase» toglie la linea toccata e «Undo» la
      rimette; nessuna chiamata di rete nella tavola (test).
- [x] A: «Draw route» manda un `ImageRouteRequest` valido (contorno chiuso
      in [-1, 1], `strokes` se ci sono) con la partenza e la distanza di
      «Draw», uguale a quello di «Draw on the map» per le stesse linee;
      `planOnPhone` lo passa al server come una foto (test). Il risultato,
      i preferiti e «My activities» dicono «Drawing».
- [x] A: una foto scelta in «Image» resta scelta dopo un passaggio a
      «Freehand» e ritorno, e viceversa.
- [x] A: da una forma del catalogo la tavola mostra le sue linee (test: le
      17 forme danno un contorno chiuso e dettagli entro
      `MAX_DETAIL_POINTS`); dal risultato di una forma, di una foto e di un
      disegno mostra la figura chiesta; da una parola il pulsante non c'è;
      «Save» sceglie «Freehand».
- [ ] B: da un percorso di «Explore» e da un disegno di un iscritto (con
      forma, senza forma) la tavola si apre con le linee giuste; «Save»
      mostra «Draw» con «Freehand», la distanza di ADR-0273 e la partenza
      di prima; nessun `POST` prima di «Draw route». Niente pulsante per
      una parola, un percorso a tema, un post di sole foto.
- [x] Con «Paddle» non c'è né «Freehand» né «Edit the drawing» (A: in
      «Draw» e sul risultato, test; B: le schede).
- [x] Testi e riga della privacy approvati dall'utente nelle cinque
      lingue; impronta iOS `83793e26` su una copia pulita; nessuna
      dipendenza nuova; `jest`, `tsc`, `expo lint`, `format:check` verdi
      (A, 2026-10-28: 514 suite e 4156 test verdi, impronta
      `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3`; da rifare per B).

## File toccati

Previsti; quelli in più si dicono nella PR. Ogni parte manda i suoi al
Coordinatore prima del codice.

**Parte A, com'è andata** (PR #612): la tavola è un file nuovo,
`src/route/FreehandBoard.tsx`, e il riquadro di «Freehand» un altro,
`src/route/FreehandChoice.tsx`; `OutlineBoard.tsx`, `ImagePreview.tsx`,
`FigureTiles.tsx` e `ChooseScreen.tsx` **non** sono stati toccati (il
pulsante sul risultato passa dalla prop `figures`, che `App.tsx` già
riempiva). In più: i test `freehand.test.ts`, `figureLines.test.ts`,
`useFreehand.test.ts`, `FreehandBoard.test.tsx`,
`src/engine/onPhoneFreehand.test.ts` e `__tests__/AppFreehand.test.tsx`.
`DECISIONS.md`: lo stato di ADR-0280 e la sua «Attuazione». Fuori lista,
generati: `site/privacy/{,it/,de/,es/,fr/}index.html`, le pagine della
privacy del sito, che `site/tools/make_privacy.mjs` riscrive dal testo
dell'app e un test del sito pretende aggiornate (la CI «site» era rossa
senza).

```
apps/mobile/src/route/freehand.ts                 (A, nuovo, con test)
apps/mobile/src/route/useFreehand.ts              (A, nuovo, con test)
apps/mobile/src/route/figureLines.ts              (A, nuovo, con test)
apps/mobile/src/route/OutlineBoard.tsx            (A, o FreehandBoard.tsx nuovo)
apps/mobile/src/route/ImagePreview.tsx            (A, forse: le linee senza foto)
apps/mobile/src/route/RoutePanel.tsx              (A, mai waitingText e il ramo «waiting»)
apps/mobile/src/route/problems.ts                 (A, ChoiceKind)
apps/mobile/src/mapdraw/drawing.ts                (A, forse: le funzioni sul piano esportate)
apps/mobile/src/mapdraw/FigureTiles.tsx           (A, il pulsante sul risultato)
apps/mobile/src/favorites/favoriteRoute.ts        (A, «Drawing»)
apps/mobile/src/screens/ChooseScreen.tsx          (A)
apps/mobile/App.tsx                               (A, B)
apps/mobile/src/about/content/{en,it,de,es,fr}.ts (A, la riga della privacy e la data)
apps/mobile/src/explore/ExploredCard.tsx          (B)
apps/mobile/src/social/DrawingCard.tsx            (B)
apps/mobile/__tests__/AppEditDrawing.test.tsx     (B, nuovo)
apps/mobile/src/i18n/{it,de,es,fr}.ts             (A, B: solo le righe nuove)
docs/UI.md
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-320.md
```

## Fuori scope

- Cambi al contratto, all'API o al motore: il contorno si disegna sul
  server come per una foto. Disegnare un contorno a mano anche senza rete
  (il motore sul telefono, TASK-214) è un task a parte.
- «Add a part» sulla tavola a mano (unire una figura chiusa al contorno:
  solo il motore lo fa, `/image-outline-edits`, e vorrebbe la rete a ogni
  linea): il contorno si ridisegna. Per le foto resta in «Edit the
  outline».
- Le parole: modificare le lettere (penna alzata) vuole un altro editor e
  il motore. Per loro resta «Draw it near me».
- Spostare i punti uno a uno, ruotare, specchiare: si ridisegna.
- I percorsi a tema di «Explore»; i post di sole foto (TASK-312).
- «Draw on the map» e TASK-282 (il posto esatto): non cambiano.
- Pubblicare l'app: il Coordinatore.

## Esito

**Parte A** (2026-10-28, PR #612, branch `feat/TASK-320-a-freehand`): in
«Draw» c'è «Freehand», con la tavola a mano, e «Edit the drawing» sotto la
forma scelta e sul risultato. Scelte tecniche dell'agente su delega
dell'utente, registrate anche in ADR-0280 («Attuazione»):

- **La tavola è un quadrato** che riempie lo schermo (`fitBox` con
  proporzione 1, come la foto della tavola di ADR-0074): i punti della
  figura sono quote del quadrato, dall'angolo in alto a sinistra con la y in
  giù, come gli `image_points` di una foto; la richiesta li gira (y in su)
  e li passa a `framed` di `canvasRequest.ts`, lo stesso di «Draw on the
  map». Per le stesse linee la richiesta è la stessa (test). Le regole della
  linea sono le funzioni sul piano di `mapdraw/drawing.ts`: `outlineOf` per
  la prima linea e `detailOf`, la parte sul piano di `withDetail`, ora
  esportata; `withDetail` la chiama, e i suoi test restano.
- **Tavola nuova, non la tavola delle foto**: `FreehandBoard.tsx` riusa
  `boardView.ts`, `drawnLine.ts` e `OutlineLines`/`Sides` di
  `ImagePreview.tsx`; «Edit the outline» resta com'è. Un dito disegna
  sempre (niente «Add a detail» da accendere: la prima linea è il contorno,
  le altre dettagli); con «Erase» acceso un tocco cancella e un dito che si
  muove sposta il quadrato ingrandito; due dita ingrandiscono e spostano.
- **«Erase» di un dettaglio porta via i dettagli appesi a lui** (partono da
  un suo punto): senza di lui galleggerebbero, e il motore li rifiuterebbe.
  Il contorno porta via tutto, e «Erase» si spegne da solo: la linea dopo è
  il contorno nuovo.
- **Le linee del catalogo non sono «contorno + dettagli»** come il task
  file supponeva: la variante «down» di `catalogueShapes.json` è **una**
  linea, in cui il motore corre gli occhi, i raggi del sole e la chiocciola
  della lumaca come escursioni che partono da un punto del contorno e vi
  tornano (`travelled_points`): per 12 forme su 17 non è un anello
  semplice, e `outlineOf` la rifiuterebbe o perderebbe gli occhi.
  `figureLines.ts` (`splitExcursions`) la smonta: ogni escursione è un
  dettaglio appeso in quel punto (la sola andata se il ritorno la ripercorre,
  come un raggio; l'anello chiuso sul punto da cui parte, come un occhio), e
  quel che resta è il contorno. Le 17 forme danno così un contorno chiuso
  semplice e i loro dettagli (test); il cavallo, 148 angoli, viene
  raddrizzato ai 100 che un contorno può avere.
- **«Drawing» al posto di «Image»**: l'app riconosce la richiesta di un
  disegno a mano dagli array del contorno che la tavola ha fatto
  (`isDrawnOutline`, un `WeakSet`), come `drawnTile` riconosce
  un'immagine pronta dal suo `outline`: niente campo nuovo nel contratto, e
  `RouteOutcome` non cambia. Vale per il risultato («Drawing · on roads ·
  target 5 km»), i preferiti e «My activities» (il titolo tenuto è
  «Drawing», mostrato con `t()`); il percorso di una linea a dito su «Draw
  on the map» resta «Image», fuori scope.
- **«Save» dal risultato** porta a «Draw» con «Freehand», la distanza del
  percorso e la partenza di «Draw» (anche da un risultato di «Draw on the
  map», la cui partenza era il primo punto della figura). Aprire la figura
  del risultato e salvarla uguale chiede il percorso di nuovo: la richiesta
  è una figura nuova (ricentrata da `framed`).

Resta alla **parte B**: «Edit the drawing» sulle schede di «Explore» e del
«Feed» (`ExploredCard.tsx`, `DrawingCard.tsx`, dopo «Draw it near me»),
con `requestLines` e `trackLines` di `figureLines.ts` già pronti e
provati, e il test di flusso `__tests__/AppEditDrawing.test.tsx`. Da
provare col dito vero sull'iPhone (l'utente): la tavola, «Erase», i
quattro segmenti dell'interruttore («A mano libera», «À main levée»
potrebbero andare su due righe su un telefono stretto).
