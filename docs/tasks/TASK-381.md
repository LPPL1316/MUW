# TASK-381 — «Share your run» dal Feed: «Close» stava sotto la barra di stato

**Stato**: Done · 2026-11-04
**Fase**: 4 · **Branch**: `fix/TASK-381-share-post-inset`
**Numeri**: TASK-381, assegnato dal Coordinatore. Seguito di TASK-360 e TASK-366.

## Obiettivo

L'utente: quando condividi non puoi tornare indietro, perché il pulsante è
troppo in alto. «Share» sulla card del Feed (`feed/ActionBar.tsx`, TASK-355 A,
#700) apre `SharePost` da una pagina del `Pager`, che dà alle sue pagine un
margine alto pari a zero: «Close» finisce sotto l'orologio e non si tocca.
TASK-366 aveva controllato `SharePost` prima della #700, quando si apriva solo
dalla mappa.

## Cosa cambia

`SharePost` tiene nel `Modal` un suo `SafeAreaProvider` con
`initialWindowMetrics`, come `ContestRules` (TASK-360) e `OutlineBoard`
(TASK-366). Il contenuto della schermata passa in `SharePage`, che legge i
margini di quel provider. Da mappa, fine corsa e «My activities» il margine
resta quello di prima. Nessun testo nuovo, nessuna dipendenza, niente di
nativo, nessuna modifica al server.

## Criteri di accettazione

- [x] Test deterministico (`SharePostInset.test.tsx`): sotto un margine alto
      zero, senza la correzione lo spazio sopra «Close» è 0, con la
      correzione 59.
- [x] Test della condivisione, typecheck, lint e Prettier verdi.
- [x] CI verde (#750 in main, 9e2089a9).

## File toccati

```
apps/mobile/src/share/SharePost.tsx
apps/mobile/src/share/SharePostInset.test.tsx
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-381.md
```

## Fuori scope

- **Simulatore e Android non provati**: la prova è il test.
- **L'OTA di produzione**, che parte col sì dell'utente.

## Esito

`SharePost` legge i margini veri del telefono da ogni punto da cui si apre,
anche dal Feed dentro il `Pager`. Il test lo prova; la prova sul telefono
(Feed → «Share» → «Close») è dell'utente nell'anteprima, prima dell'OTA.
