# TASK-340 — «Freehand» prima di «Shape | Word | Image», niente «Edit the drawing» in «Draw»

**Stato**: Done — chiuso nella stessa PR, partita da `main` dopo il merge
della #643 (TASK-331 B) e della #644 (TASK-337)
**Fase**: 4 · **Branch**: `feat/TASK-340-freehand-first` · **ADR**: ADR-0288
(aggiunta)

Numero dal Coordinatore (2026-10-29: TASK-340, nessun ADR nuovo).

## Obiettivo

In «Draw» il disegno a mano sulla mappa è la prima scelta
dell'interruttore, «Freehand | Shape | Word | Image», e sotto il percorso
disegnato non c'è più «Edit the drawing».

## Contesto

Richiesta dell'utente del 2026-10-29, parola per parola:

> TOGLI LA FUNZIONE MODIFICA IL DISEGNO IN DRAW, TIENI SOLO LA FUNZIONE DISEGNA A MANO L'IBERA SU MAPPA E METTILA PER PRUMA TRA FORMA PAROLA ED IMMAGINE

(«L'IBERA» e «PRUMA» stanno per «libera» e «prima».)

Prima del task (TASK-331, ADR-0288): sotto «Shape | Word | Image» c'era il
tasto «Draw on the map» (`MapDrawButton.tsx`), che apre la mappa della
partenza per disegnarci; sotto il risultato di «Draw» c'era «Edit the
drawing» (`EditDrawingButton.tsx`), che metteva la figura del percorso
sulla mappa (o tornava alla figura, dal risultato della mappa). «Edit the
drawing» c'è anche sulle schede di «Explore» e del Feed (`ExploredCard`,
`DrawingCard`).

## Cosa fare

1. `RoutePanel.tsx`: «Freehand» prima di «Shape | Word | Image», con
   `onFreehand` al posto di `underKinds`; un tocco apre la mappa e
   l'interruttore resta sulla scelta di prima. Con «Paddle» non c'è (non
   c'è l'interruttore).
2. `App.tsx`: `onFreehand={onOpenCanvas}`; via «Edit the drawing» sotto il
   risultato (`resultLines`, `onEditResult`).
3. Via `MapDrawButton.tsx` ed `EditDrawingButton.tsx`.
4. Testi: torna «Freehand» con le traduzioni approvate dall'utente per il
   TASK-320 il 2026-10-28; esce «Draw on the map», che nessuno mostra più.
5. Test; `UI.md`, ADR-0288 (aggiunta), STATUS.

## Criteri di accettazione

- [x] Fuori dall'acqua l'interruttore di «Draw» è «Freehand | Shape | Word
      | Image», in quest'ordine.
- [x] Un tocco su «Freehand» apre la mappa della partenza per disegnare;
      l'interruttore resta sulla scelta di prima.
- [x] Con «Paddle» «Freehand» non c'è.
- [x] Sotto il percorso disegnato in «Draw» non c'è «Edit the drawing», né
      dopo «Draw route» della mappa; «←» torna alla figura come prima.
- [x] Le schede di «Explore» e del Feed tengono «Edit the drawing».
- [x] Nessun testo nuovo: «Freehand» ha le traduzioni già approvate.
- [x] jest, lint, typecheck e format verdi; impronta iOS `83793e26`.

## File toccati

```
apps/mobile/App.tsx
apps/mobile/src/route/RoutePanel.tsx
apps/mobile/src/screens/Segmented.tsx
apps/mobile/src/mapdraw/MapDrawButton.tsx          (cancellato)
apps/mobile/src/route/EditDrawingButton.tsx        (cancellato)
apps/mobile/src/i18n/it.ts
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/es.ts
apps/mobile/src/i18n/fr.ts
apps/mobile/__tests__/AppEditDrawing.test.tsx
apps/mobile/src/mapdraw/DrawOnMapApp.test.tsx
apps/mobile/src/mapdraw/ChangeFigureApp.test.tsx
docs/tasks/TASK-340.md
docs/STATUS.md
docs/DECISIONS.md
docs/UI.md
```

## Fuori scope

- «Edit the drawing» sulle schede di «Explore» e del Feed: l'utente ha
  detto «in Draw»; se le vuole via, è un task a parte.
- Gli strumenti della mappa (TASK-331 B, #643).
- Contratto, API, motore, privacy, nativo: niente cambia.

## Esito

In «Draw» l'interruttore è «Freehand | Shape | Word | Image»: «Freehand»
apre subito la mappa per disegnare a mano e non resta acceso; sotto il
risultato non c'è più «Edit the drawing» (le schede di «Explore» e del
Feed lo tengono). Nessun testo nuovo. Visto sul simulatore (iPhone 17e):
«Freehand» apre la mappa; in italiano «A mano libera» va su due righe, e
`Segmented.tsx` ora centra le etichette (non previsto all'inizio, una riga
di stile).
