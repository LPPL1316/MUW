# TASK-366 — Le finestre aperte dal Pager: solo «Edit the outline» stava sotto la barra di stato

**Stato**: Done · 2026-11-02
**Fase**: 4 · **Branch**: `fix/TASK-366-modal-insets`
**Numeri**: TASK-366, assegnato dal Coordinatore. Seguito di TASK-360.

## Obiettivo

TASK-360 ha trovato che una finestra a tutto schermo (`Modal`) aperta da una
pagina del `Pager` legge un margine alto pari a zero e finisce sotto
l'orologio. Ha elencato sette finestre che leggono `insets.top` dentro un
`Modal`, senza aprirle. Qui si aprono tutte nel simulatore da dove si aprono
davvero, si scrive quali hanno il difetto e si correggono solo quelle.

## Cosa si è visto

iPhone Air (iOS 27), Expo Go, `main` a `74f34e79`, API locale con database
usa e getta. Le schermate sono in `out/TASK-366/` (non nel repository).

| Finestra | Da dove si apre | Dentro il `Pager`? | Difetto |
|---|---|---|---|
| `route/OutlineBoard.tsx` | «Draw» → «Image» → una foto → «Edit the outline» | sì | **sì**: «Edit the outline» sopra l'orologio |
| `share/SharePost.tsx` | «My activities» → una corsa → «Share» (scheda sulla mappa) | no | no |
| `messages/SendToFriend.tsx` | la stessa scheda → «Send to a friend» | no | no |
| `social/SuperLikeSheet.tsx` | scheda di un disegno sulla mappa → reazioni → cuore giallo | no | no |
| `messages/DrawingPicker.tsx` | «Messages» → conversazione → «+» → «Drawing» | no | no |
| `messages/MediaViewer.tsx` | «Messages» → conversazione → una foto | no | no |
| `paddle/PaddleNotice.tsx` | radice dell'app, prima del primo «Start» sull'acqua | no | no |

Le schede di corse e disegni si aprono sulla mappa: con una scheda aperta il
`Pager` non è montato. «Messages» sta in `ProfileLayer`, sopra tutta l'app.
`PaddleNotice` è figlia diretta di `App`, accanto al `Pager`. Tutte queste
leggono i margini veri del telefono.

`PaddleNotice` si apre solo al primo «Start» su un percorso in barca: per
vederla, nella copia di prova `usePaddleNotice` partiva già aperto. La sua
posizione nell'albero è quella vera.

## Cosa cambia

`OutlineBoard` tiene nel `Modal` un suo `SafeAreaProvider` con
`initialWindowMetrics`, come `ContestRules` (TASK-360) e `Tour.tsx`. La vista
che prima leggeva i margini diventa `BoardScreen`, che legge quelli del
provider. Nessun testo nuovo, nessuna dipendenza, niente di nativo, nessuna
modifica al server. Le altre sei finestre non cambiano.

## Criteri di accettazione

- [x] Le sette finestre aperte nel simulatore da dove si aprono davvero, con
      l'esito scritto qui sopra.
- [x] Difetto riprodotto: «Edit the outline» sopra l'orologio.
- [x] Con la correzione il titolo sta sotto la barra di stato.
- [x] Test deterministico (`OutlineBoardInset.test.tsx`): sotto un margine
      alto zero, senza la correzione lo spazio sopra la board è 0, con la
      correzione 62.
- [x] Test, typecheck, lint e Prettier verdi.
- [x] Impronta iOS `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3` su copia pulita.

## File toccati

```
apps/mobile/src/route/OutlineBoard.tsx
apps/mobile/src/route/OutlineBoardInset.test.tsx
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-366.md
```

## Fuori scope

- **Android non è provato**: la prova è sul simulatore iOS.
- **Altri `Modal` sotto il `Pager`.** Quelli che leggono i margini e si aprono
  da una pagina del `Pager` senza essere nella lista di TASK-360 non sono
  stati cercati uno per uno. `SportButton` sta nell'intestazione del `Pager`,
  fuori dal margine azzerato; `ReportMenu` (dal Feed) usa solo il margine
  basso.

## Esito

Delle sette finestre solo `OutlineBoard` aveva il difetto, perché è l'unica
che si apre da una pagina del `Pager` («Draw»). Corretta come TASK-360; visto
nel simulatore prima e dopo.
