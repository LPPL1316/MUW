# TASK-331 — Disegnare a mano solo sulla mappa: la linea aperta, «Erase», «Edit the drawing» sulla mappa

**Stato**: In corso — codice e test fatti; aspetta il sì dell'utente sui
due testi nuovi, poi il merge del Coordinatore a CI verde
**Fase**: 4 · **Branch**: `feat/TASK-331-draw-on-map-only` · **ADR**: ADR-0288

Numero e ADR dal Coordinatore (2026-10-29: TASK-331, ADR-0288).

## Obiettivo

A mano si disegna solo sulla mappa di «Draw on the map»: la prima linea non
si chiude più da sola se non finisce vicino al suo inizio, «Edit the
drawing» porta la figura sulla mappa invece che su una tavola bianca, e non
c'è mai per le emoji (le forme del catalogo); il disegno sulla mappa è più
intuitivo.

## Contesto

Richiesta dell'utente del 2026-10-29, dopo la prova sul telefono: «il
disegno a mano libera deve essere solamente sulla mappa e non modifica il
disegno poi ho provato a disegnare e non mi lascia fare una linea singola.
La prima riga mi fa un cerchio sistema questa cosa quando tiro con il dito
non deve unirsi automaticamente e rendi più intuitivo il sistema di
disegna esposta sulla mappa».

Alla domanda su «Mano libera» e «Modifica il disegno» l'utente ha scelto
**«Tutto sulla mappa»**: via la tavola «Mano libera» da «Draw»; «Modifica il
disegno» resta ma apre «Disegna sulla mappa» con la figura già sulla mappa.

Nella sessione «Funzione modifica editing nella mappa» (local_dfa4942d),
passata a questo task, l'utente ha scritto lo stesso giorno: «La funzione
modifica editing in the drawing modifica il disegno, deve essere fatta
solamente Sulla mappa e non la modifica delle emoji perché non serve a
nulla». Quindi «Edit the drawing» non c'è per una forma del catalogo.

Oggi (prima del task): `mapdraw/drawing.ts` chiude sempre la prima linea
(TASK-281, ADR-0245); la tavola di «Draw» (TASK-320, ADR-0280) fa lo stesso
e rifiuta una linea dritta («This line encloses nothing»); con «Draw» due
dita sulla mappa non fanno niente; sulla mappa non c'è «Erase».

Il contratto vuole un contorno chiuso (`ImageRouteRequest.outline`, almeno
3 punti distinti, che non si incrocia). Prova sul motore, offline, con le
strade di Trento in cache (`out/TASK-331/open_line/`): un arco aperto
mandato come un anello minuscolo al suo inizio più la linea come dettaglio
(«strokes», andata e ritorno) dà un arco percorso andata e ritorno
(somiglianza 0.78, una «W» 0.89); chiuso come oggi dà la figura chiusa.
Niente da cambiare nel contratto, nell'API o nel motore.

## Cosa fare

1. `mapdraw/drawing.ts`: la prima linea si chiude solo se finisce entro il
   15% della sua grandezza dall'inizio (`CLOSED_SHARE`) e si può chiudere;
   altrimenti resta aperta: un anello di 0,5% della sua grandezza sul suo
   primo punto (`START_RING_SHARE`) e la linea appesa lì come dettaglio. La
   prima linea non è più rifiutata («crosses» non c'è più).
2. `mapdraw/edit.ts` (nuovo): da linee proposte a disegno (`drawingOf`, dalla
   tavola), una foto in disegno (`asDrawing`), «Erase» (`erasedAt`,
   `touchesLines`). Una forma del catalogo non diventa disegno.
3. `useMapCanvas.ts`: modo «Erase»; una linea su una foto vi si appende, su
   una forma ne prende il posto; `edit(lines, metri)` per «Edit the drawing»;
   «Undo» anche per i tratti appesi e le cancellature.
4. Pagina della mappa (`map/mapPage.ts`, `map/messages.ts`): con «Draw» ed
   «Erase» due dita spostano e ingrandiscono la mappa; con «Erase» anche un
   tocco viene mandato all'app.
5. `DrawOnMap.tsx`: «Draw | Move | Erase» e i suggerimenti nuovi.
6. Via la tavola: `FreehandBoard`, `FreehandChoice`, `useFreehand`,
   `freehand.ts` e i loro test; «Freehand» esce da «Shape | Word | Image»;
   `EditDrawingButton.tsx` (nuovo) è il solo pulsante rimasto.
7. `App.tsx`: «Edit the drawing» sul risultato e sulle schede mette la figura
   sulla mappa; dal risultato della mappa torna alla figura; niente sotto la
   forma scelta.
8. `figureLines.ts` nella cornice del motore; niente linee per una forma.
9. Il titolo «Drawing» per ogni disegno della mappa (`canvasRequest.ts`).
10. Testi nelle quattro lingue; test; `UI.md`, ADR-0288, STATUS.

## Criteri di accettazione

- [x] Una linea che non torna al suo inizio resta aperta sulla mappa e il
      percorso la fa andata e ritorno; una linea dritta è accettata.
- [x] Una linea che finisce vicino all'inizio si chiude, come prima.
- [x] In «Draw» non c'è più «Freehand»; non c'è «Edit the drawing» sotto la
      forma scelta.
- [x] «Edit the drawing» sul risultato e sulle schede mette la figura sulla
      mappa, senza rete prima di «Draw route»; mai per una forma del catalogo.
- [x] «Erase» sulla mappa toglie una linea; «Undo» la rimette.
- [x] Con «Draw» due dita spostano e ingrandiscono la mappa.
- [x] Contratto, API e motore invariati; nessuna dipendenza nuova.
- [x] jest, lint, typecheck, Prettier verdi.
- [ ] Testi nuovi approvati dall'utente (due, nelle quattro lingue, in
      `UI.md` sotto «Disegnare sulla mappa»).

## File toccati

```
apps/mobile/App.tsx
apps/mobile/__tests__/AppEditDrawing.test.tsx
apps/mobile/__tests__/AppFreehand.test.tsx (tolto)
apps/mobile/src/engine/onPhoneFreehand.test.ts
apps/mobile/src/explore/ExploredCard.tsx (solo il commento)
apps/mobile/src/favorites/favoriteRoute.ts
apps/mobile/src/i18n/de.ts, es.ts, fr.ts, it.ts
apps/mobile/src/map/mapPage.ts
apps/mobile/src/map/messages.ts
apps/mobile/src/mapdraw/DrawOnMap.tsx
apps/mobile/src/mapdraw/DrawOnMapApp.test.tsx
apps/mobile/src/mapdraw/canvasRequest.ts
apps/mobile/src/mapdraw/drawing.ts
apps/mobile/src/mapdraw/drawing.test.ts
apps/mobile/src/mapdraw/edit.ts (nuovo)
apps/mobile/src/mapdraw/edit.test.ts (nuovo)
apps/mobile/src/mapdraw/mapPageCanvas.test.ts
apps/mobile/src/mapdraw/useMapCanvas.ts
apps/mobile/src/mapdraw/useMapCanvas.test.ts
apps/mobile/src/route/EditDrawingButton.tsx (nuovo)
apps/mobile/src/route/FreehandBoard.tsx, FreehandBoard.test.tsx (tolti)
apps/mobile/src/route/FreehandChoice.tsx (tolto)
apps/mobile/src/route/RoutePanel.tsx
apps/mobile/src/route/figureLines.ts
apps/mobile/src/route/figureLines.test.ts
apps/mobile/src/route/freehand.ts, freehand.test.ts (tolti)
apps/mobile/src/route/problems.ts
apps/mobile/src/route/useFreehand.ts, useFreehand.test.ts (tolti)
apps/mobile/src/social/DrawingCard.tsx (solo i commenti)
docs/DECISIONS.md (ADR-0288)
docs/INDEX.md (una riga)
docs/STATUS.md (righe nuove)
docs/UI.md
docs/tasks/TASK-331.md
```

## Fuori scope

- Un percorso da A a B che non torna alla partenza per una linea aperta: il
  motore lo sa fare (`one_way`), ma vuole un campo nuovo nel contratto e il
  server; si propone a parte se l'utente lo chiede.
- Linee separate senza il trattino che le unisce (penna alzata per un
  disegno): il contratto la rifiuta per le immagini (`pen_up` solo per le
  parole).
- Spostare un punto di una linea già disegnata.
- La privacy: la riga del TASK-320 («un contorno viaggia come richiesta del
  percorso e non si tiene») vale già per ogni disegno della mappa.

## Esito

*(a fine task)* Il 2026-10-29 il codice è fatto: la prima linea resta
aperta se non torna all'inizio (andata e ritorno, contratto invariato,
provato sul motore con le strade di Trento), la tavola di «Draw» è tolta,
«Edit the drawing» mette la figura sulla mappa e non c'è per le emoji, sulla
mappa ci sono «Erase» e le due dita che spostano la mappa. Jest 533 suite /
4297 test verdi. Restano il sì dell'utente sui due testi nuovi e, dopo il
merge, la prova col dito sull'iPhone con la prossima anteprima.
