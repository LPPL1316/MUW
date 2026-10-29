# TASK-332 — La mappa sotto i disegni del profilo

**Stato**: Done — PR `fix/TASK-332-profile-drawings-map`
**Fase**: 4 · **Branch**: `fix/TASK-332-profile-drawings-map` · numero dato
dal Coordinatore il 2026-10-29

## Obiettivo

Nella griglia «Drawings» di un profilo, ogni disegno ha sotto la mappa del
posto dove è stato corso, come le schede di «Feed» ed «Explore».

Richiesta dell'utente del 2026-10-29: «Quando vado sul profilo di un amico
e vede i disegni, non c'è sotto la cartina geografica, sistema». Il
Coordinatore, dando il numero, ha chiesto di caricare la mappa solo per le
miniature che si vedono, così una griglia lunga non fa decine di
richieste.

## Contesto da leggere

- `docs/DECISIONS.md`, ADR-0131 (la foto della mappa sotto i disegni di
  «Feed»), con la riga di questo task;
- `docs/UI.md`, «Drawings» in «Profile».

## Cosa fare

1. `RunDrawing` accetta la foto della mappa e la mette sotto le linee.
2. La griglia la chiede per ogni disegno con `useFeedMap`, con la stessa
   inquadratura della linea, e mostra i crediti delle mappe una volta.
3. La foto si chiede solo quando la miniatura entra nello schermo: le
   pagine che scorrono («Profile», «Find friends») lo dicono a chi
   aspetta.
4. Sopra la mappa grande, dove «Feed» e la sua pagina delle foto non ci
   sono, il profilo di un altro ha la sua; una sola pagina fa le foto alla
   volta.

## Criteri di accettazione

- [x] Una miniatura della griglia ha sotto la foto della mappa, prima
      delle linee; finché non arriva, la linea sul fondo scuro (test in
      `DrawingsGrid.test.tsx`).
- [x] Sotto la griglia, una volta, «Maps: OpenFreeMap © OpenMapTiles ·
      Data from OpenStreetMap».
- [x] Una miniatura sotto lo schermo non chiede la foto; la chiede quando
      lo scorrere la porta su (`DrawingsGrid.test.tsx`,
      `scrollSight.test.tsx`).
- [x] Con due pagine delle foto montate, una sola fa le foto; andata via
      quella, l'altra continua (`FeedMaps.test.tsx`).
- [x] Il profilo di un altro ha la sua pagina delle foto solo quando si
      vede (`PeopleScreen.test.tsx`).
- [x] Nessun testo nuovo, nessuna dipendenza, impronta iOS `83793e26`
      invariata.

## File toccati

```
apps/mobile/src/activities/RunDrawing.tsx
apps/mobile/src/feed/FeedMaps.tsx
apps/mobile/src/feed/FeedMaps.test.tsx
apps/mobile/src/screens/PeopleScreen.tsx
apps/mobile/src/screens/PeopleScreen.test.tsx
apps/mobile/src/screens/ProfileScreen.tsx
apps/mobile/src/social/DrawingsGrid.tsx
apps/mobile/src/social/DrawingsGrid.test.tsx
apps/mobile/src/social/scrollSight.tsx           (nuovo)
apps/mobile/src/social/scrollSight.test.tsx      (nuovo)
docs/DECISIONS.md
docs/STATUS.md
docs/UI.md
docs/tasks/TASK-332.md                           (nuovo)
```

## Esito

La griglia «Drawings» del proprio profilo e di quello di un altro mostra
la mappa sotto ogni disegno, chiesta quando la miniatura entra nello
schermo. Solo app (OTA). Da vedere sull'iPhone con la prossima preview:
non provato nel simulatore (serve un account con disegni pubblici).
