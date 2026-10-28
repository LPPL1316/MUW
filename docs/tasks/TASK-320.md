# TASK-320 — Disegnare a mano in «Draw», e modificare ogni disegno proposto

**Stato**: Todo (proposta, aspetta il sì dell'utente)
**Fase**: 4 · **Branch**: `docs/TASK-320-freehand-edit` (i documenti), poi
`feat/TASK-320-a-freehand`, `feat/TASK-320-b-edit-draw`,
`feat/TASK-320-c-edit-cards` · **ADR**: ADR-0280

> Numeri presi come primi liberi il 2026-10-28 (320 e 0280) mentre il
> Coordinatore era occupato, dopo averglielo scritto: se ne assegna altri,
> questo file e l'ADR cambiano numero nella stessa PR.

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
  disegnato; in «Draw» le scelte sono «Shape | Word | Image»;
- il contorno di una foto si modifica in «Edit the outline» (TASK-079,
  ADR-0074; «Save» in fondo, TASK-229): «Add a part» e «Add a detail»,
  uniti dal motore con `POST /image-outline-edits`, e «Undo». La tavola
  vuole una foto sotto;
- «Draw it near me» (TASK-313, ADR-0273) porta in «Draw» la forma o la
  parola di un percorso o di un disegno, non le sue linee: niente si cambia;
- un preferito con un'immagine ricostruisce il contorno dai punti del
  percorso (`favorites/favoriteRoute.ts`, `outlineOf`).

Il contratto ha già tutto: `ImageRouteRequest` (`outline` + `strokes`,
centrati in [-1, 1]) è quello che «Draw on the map» manda per una linea a
dito (`mapdraw/canvasRequest.ts`, `framed`), e `POST /image-outline-edits`
prende un contorno qualsiasi (`image_points`, `image_strokes`, `aspect`),
non solo quello di una foto. Niente cambia nell'API né nel motore. Un
contorno si disegna sul server (`engine/onPhone.ts`: «photos are drawn on
the server»): come «Image», serve la rete.

## Proposte da confermare (scelte di prodotto)

Decise dall'agente su delega, da confermare dall'utente con un sì o da
correggere; il codice parte dopo.

1. **Dove si disegna a mano**: una quarta scelta **«Freehand»**
   nell'interruttore di «Draw», «Shape | Word | Image | Freehand» (con
   «Paddle» non c'è, come «Word» e «Image»: sull'acqua solo forme). Sotto,
   il riquadro della figura disegnata, come l'anteprima di un'immagine ma
   senza foto, con «Edit the drawing»; vuoto, un tasto «Draw with your
   finger» che apre la tavola. «Draw on the map» resta com'è: là la figura
   ha la grandezza e il posto della mappa, qui la distanza e la partenza di
   «Draw». Scartato: la tavola vuota dentro «Draw on the map» (una figura
   disegnata sulla mappa ha già un posto e una grandezza).
2. **La tavola**, «Edit the drawing»: la tavola di «Edit the outline» senza
   la foto, a tutto schermo. Con un dito si disegna; **la prima linea è il
   contorno**, chiuso dall'app come sulla mappa (ADR-0245: l'ultimo punto
   torna al primo; una linea che passa oltre l'inizio si chiude dove si
   incrocia); poi **«Add a part»** e **«Add a detail»** come oggi (il motore
   li unisce, con gli stessi rifiuti), **«Erase»** (nuovo: un tocco su una
   linea la toglie; una linea appesa va via da sola, il contorno porta via
   tutto), **«Undo»** e **«Save»** in fondo. Due dita ingrandiscono e
   spostano. Scartato: spostare i punti uno a uno (un altro editor; qui si
   ridisegna, come in ADR-0074).
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
     dopo «Draw it near me», **«Edit the drawing»**; «Save» va in «Draw»
     come «Draw it near me» (ADR-0273: la partenza di «Draw», la distanza
     del percorso o della corsa al decimo di km dentro i limiti dello sport,
     nessuna richiesta prima di «Draw route»), con «Freehand» e la figura
     cambiata;
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
5. **Testi** (col sì dell'utente, cinque lingue): la tabella sotto.

## Testi proposti

| en                                                              | it                                                                      | de                                                                          | es                                                                 | fr                                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Freehand                                                        | A mano libera                                                           | Freihand                                                                    | A mano alzada                                                      | À main levée                                                          |
| Edit the drawing                                                | Modifica il disegno                                                     | Zeichnung bearbeiten                                                        | Editar el dibujo                                                   | Modifier le dessin                                                    |
| Draw with your finger                                           | Disegna col dito                                                        | Mit dem Finger zeichnen                                                     | Dibuja con el dedo                                                 | Dessine avec le doigt                                                 |
| Erase                                                           | Cancella                                                                | Radieren                                                                    | Borrar                                                             | Effacer                                                               |
| Drawing                                                         | Disegno                                                                 | Zeichnung                                                                   | Dibujo                                                             | Dessin                                                                |
| Draw the outline with one finger: it closes by itself.          | Disegna il contorno con un dito: si chiude da solo.                     | Zeichne den Umriss mit einem Finger: er schließt sich von selbst.           | Dibuja el contorno con un dedo: se cierra solo.                    | Dessine le contour avec un doigt : il se ferme tout seul.             |
| Tap a line to erase it. The outline takes its details with it.  | Tocca una linea per cancellarla. Il contorno porta via i suoi dettagli. | Tippe auf eine Linie, um sie zu löschen. Der Umriss nimmt seine Details mit. | Toca una línea para borrarla. El contorno se lleva sus detalles.   | Touche une ligne pour l'effacer. Le contour emporte ses détails.      |
| This line encloses nothing. Draw a closed shape.                | Questa linea non racchiude niente. Disegna una figura chiusa.           | Diese Linie umschließt nichts. Zeichne eine geschlossene Form.              | Esta línea no encierra nada. Dibuja una figura cerrada.            | Cette ligne n'entoure rien. Dessine une figure fermée.                |

«Drawing» è il titolo del percorso di un disegno a mano dove quello di una
foto dice «Image» (risultato, preferiti, «My activities», `route_title` di
un disegno pubblicato), quando l'app sa che la figura viene dalla tavola.
«This line crosses itself. Draw it again without crossing it.» c'è già
(TASK-281).

## Contesto da leggere

- `docs/UI.md`: «L'immagine (TASK-073)» (la tavola, «Edit the outline»),
  «Disegnare sulla mappa: «Draw on the map»» (la linea a dito), «Il
  risultato» (la riga delle figure, TASK-286).
- `docs/DECISIONS.md`: ADR-0074 (parti e dettagli), ADR-0245 (la linea
  chiusa dall'app), ADR-0273 («Draw it near me»: che cosa passa a «Draw»),
  ADR-0191 («Save» in fondo), ADR-0280 (questo task).
- `docs/API.md`: `POST /image-route-jobs`, `POST /image-outline-edits`.
- Codice: `apps/mobile/src/route/OutlineBoard.tsx`, `useImageOutline.ts`,
  `ImagePreview.tsx`, `drawAgain.ts`; `src/mapdraw/drawing.ts`
  (`outlineOf`), `canvasRequest.ts` (`framed`), `figure.ts` (`lookOf`);
  `src/favorites/favoriteRoute.ts` (`outlineOf` dai punti).

## Cosa fare

Tre parti, ognuna un branch e una PR, in quest'ordine, ognuna in una
sessione sua; i «File toccati» di ogni parte al Coordinatore prima del
codice.

**Parte A — la tavola vuota e «Freehand» in «Draw»**
(`feat/TASK-320-a-freehand`)

1. `src/route/freehand.ts` (nuovo): la prima linea, in quote della tavola,
   fatta `ImageOutline` senza foto (`points` in [-1, 1] con la y in su,
   `image_points` in un riquadro quadrato, `aspect` 1): chiusa e
   raddrizzata con `outlineOf` di `mapdraw/drawing.ts` (le regole della
   mappa: incroci, una linea che non racchiude niente); le conversioni fra
   i due riquadri; «Erase» (quale linea è sotto il dito, la figura senza).
2. `useImageOutline.ts`: `show` senza foto, `start(line)` per la prima
   linea, `erase(index)`; `add` e `undo` come sono (vanno sul server con
   `/image-outline-edits`, qualunque sia il contorno).
3. `OutlineBoard.tsx`: la foto facoltativa; sulla tavola vuota un dito
   disegna il contorno (nella riga grigia il testo del contorno); «Erase»
   accanto a «Add a part» / «Add a detail»; il titolo «Edit the drawing»
   senza foto.
4. `RoutePanel.tsx` / `problems.ts`: la quarta scelta («Freehand» in
   `DRAW_KINDS`, `ChoiceKind`); sotto, il riquadro con le linee (gli
   `OutlineLines` di `ImagePreview` senza foto) ed «Edit the drawing», o
   «Draw with your finger» da vuoto.
5. `App.tsx`: lo stato di «Freehand» (lo stesso hook dell'immagine, o uno
   accanto: una foto scelta non si perde passando a «Freehand» e
   viceversa); la richiesta è un `ImageRouteRequest` come per una foto; il
   titolo «Drawing» dove oggi si scrive «Image» (`favoriteRoute.ts`,
   `route_title` alla pubblicazione).
6. I testi di A nelle cinque lingue; `UI.md`.

**Parte B — «Edit the drawing» in «Draw» e sul risultato**
(`feat/TASK-320-b-edit-draw`)

7. `src/route/figureLines.ts` (nuovo): le linee di una figura come
   `ImageOutline` senza foto: una forma del catalogo da
   `catalogueShapes.json` (la variante «down»: la prima linea è il
   contorno, le altre dettagli), una richiesta di percorso (forma →
   catalogo; immagine → `outline` e `strokes`; parola → null), un percorso
   o una traccia dai punti (`favoriteRoute.outlineOf`).
8. In «Draw», sotto la forma scelta, «Edit the drawing»: apre la tavola con
   la forma; «Save» sceglie «Freehand» con quelle linee.
9. Sul risultato, accanto alle tessere di TASK-286: la figura della
   richiesta mostrata; «Save» torna a «Draw» con «Freehand», stessa
   distanza e partenza (come `changedRequest` di `resultFigure.ts` fa per
   una tessera).

**Parte C — «Edit the drawing» sulle schede** (`feat/TASK-320-c-edit-cards`)

10. `ExploredCard.tsx` e `DrawingCard.tsx`: il pulsante dopo «Draw it near
    me», solo quando c'è una figura (punto 4 delle proposte). Per un
    disegno, le linee dalla traccia di `GET /drawings/{id}` (già nella
    scheda).
11. `App.tsx`: come «Draw it near me» (`drawAgain.ts`: distanza al decimo,
    limiti dello sport, `leave()` del disegno, `closeExplore()`), con
    «Freehand» e la figura; la tavola si apre subito, «Save» mostra «Draw».
12. Test del flusso (`__tests__/AppEditDrawing.test.tsx`): nessuna
    richiesta prima di «Draw route».

## Criteri di accettazione

- [ ] A: in «Draw» c'è «Freehand»; la tavola vuota chiude la prima linea
      da sola (test `freehand.test.ts`, con linee come quelle di
      `drawing.test.ts`); una linea che non racchiude niente è rifiutata
      col suo testo; «Add a part» / «Add a detail» mandano a
      `/image-outline-edits` il contorno della tavola (test di
      `useImageOutline`); «Erase» toglie la linea toccata e «Undo» la
      rimette.
- [ ] A: «Draw route» manda un `ImageRouteRequest` valido (contorno chiuso
      in [-1, 1], `strokes` se ci sono) con la partenza e la distanza di
      «Draw»; il risultato, i preferiti e «My activities» dicono «Drawing».
- [ ] A: una foto scelta in «Image» resta scelta dopo un passaggio a
      «Freehand» e ritorno, e viceversa.
- [ ] B: da una forma del catalogo la tavola mostra le sue linee (test: le
      17 forme danno un contorno chiuso e dettagli entro
      `MAX_DETAIL_POINTS`); «Save» sceglie «Freehand».
- [ ] B: dal risultato di una forma, di una foto e di un disegno la tavola
      mostra la figura chiesta; da una parola il pulsante non c'è.
- [ ] C: da un percorso di «Explore» e da un disegno di un iscritto (con
      forma, senza forma) la tavola si apre con le linee giuste; «Save»
      mostra «Draw» con «Freehand», la distanza di ADR-0273 e la partenza
      di prima; nessun `POST` prima di «Draw route». Niente pulsante per
      una parola, un percorso a tema, un post di sole foto.
- [ ] Con «Paddle» non c'è né «Freehand» né «Edit the drawing».
- [ ] Testi approvati dall'utente nelle cinque lingue; impronta iOS
      `83793e26` su una copia pulita; nessuna dipendenza nuova; `jest`,
      `tsc`, `expo lint`, `format:check` verdi.

## File toccati

Previsti; quelli in più si dicono nella PR. Ogni parte manda i suoi al
Coordinatore prima del codice.

```
apps/mobile/src/route/freehand.ts                 (A, nuovo, con test)
apps/mobile/src/route/useImageOutline.ts          (A)
apps/mobile/src/route/OutlineBoard.tsx            (A)
apps/mobile/src/route/ImagePreview.tsx            (A, forse: le linee senza foto)
apps/mobile/src/route/RoutePanel.tsx              (A, B)
apps/mobile/src/route/problems.ts                 (A, ChoiceKind)
apps/mobile/src/favorites/favoriteRoute.ts        (A, «Drawing»)
apps/mobile/src/screens/ChooseScreen.tsx          (A)
apps/mobile/App.tsx                               (A, B, C)
apps/mobile/src/route/figureLines.ts              (B, nuovo, con test)
apps/mobile/src/mapdraw/FigureTiles.tsx           (B, il pulsante sul risultato)
apps/mobile/src/explore/ExploredCard.tsx          (C)
apps/mobile/src/social/DrawingCard.tsx            (C)
apps/mobile/__tests__/AppEditDrawing.test.tsx     (C, nuovo)
apps/mobile/src/i18n/{it,de,es,fr}.ts             (A, C: solo le righe nuove)
docs/UI.md
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-320.md
```

## Fuori scope

- Cambi al contratto, all'API o al motore: il contorno si disegna sul
  server come per una foto. Disegnare un contorno a mano anche senza rete
  (il motore sul telefono, TASK-214) è un task a parte.
- Le parole: modificare le lettere (penna alzata) vuole un altro editor e
  il motore. Per loro resta «Draw it near me».
- Spostare i punti uno a uno, ruotare, specchiare: si ridisegna.
- I percorsi a tema di «Explore»; i post di sole foto (TASK-312).
- «Draw on the map» e TASK-282 (il posto esatto): non cambiano.
- Pubblicare l'app: il Coordinatore.

## Esito

_(a fine task)_
