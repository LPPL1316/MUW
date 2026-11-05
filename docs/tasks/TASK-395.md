# TASK-395 — La ricerca non divide più per zero quando un percorso non disegna niente

**Stato**: Done · 2026-11-05, alla fusione della sua PR
**Fase**: 4 · **Branch**: `fix/TASK-395-next-scale-zero`
**Numeri**: TASK-395, assegnato dal Coordinatore. Nessun ADR: nessun
comportamento documentato cambia. Seguito di TASK-297 C.

## Obiettivo

Il 2026-10-25 (TASK-297 C) un'immagine a pezzi con la penna alzata, mandata
dalla ricerca lontana (ADR-0040) su un grafo piccolo che ignora l'area, è
caduta in `optimizer.next_scale` con `ZeroDivisionError`. Il motore deve dare
una risposta, o un errore di dominio chiaro, invece di cadere.

## Contesto da leggere

- `services/route-engine/route_engine/optimizer.py`: `search`, le sue
  funzioni interne `attempt`, `next_scale`, `rescale`, `polish`, e `_done`.
- `services/route-engine/route_engine/pen_up.py`: `_trace_letter` (una
  lettera che cade su un nodo è quel nodo), `drawn_m`, `sized_m`.
- `tests/test_collapsed_outline.py` (TASK-277): lo stesso caso per un
  contorno intero su un solo nodo.

## Causa

Con la penna alzata ogni lettera, o pezzo, si traccia da sola; una lettera i
cui punti hanno tutti lo stesso nodo più vicino diventa quel nodo, senza
errore (`pen_up._trace_letter`). Su un grafo di una strada sola succede a
tutte: il percorso è fatto soltanto dei tratti a piedi fra una lettera e
l'altra, e la distanza che conta per la richiesta (`drawn_distance`, senza i
tratti a piedi) è 0. Allora `ratio` è 0, e `next_scale` calcola
`last.scale_m / last.ratio`.

Riprodotto senza rete: «HI» e «OK» da 6 km con la penna alzata su una strada
di 50 m (`_stub` di TASK-277) a 0, 300 e 3000 m dalla partenza, con la stessa
strada anche per la ricerca lontana (come una `FileSource`): sei
`ZeroDivisionError` su sei, dal primo `rescale`.

## Cosa cambia

Solo `attempt` in `optimizer.search`: un tracciato la cui distanza disegnata
è 0 vale come un contorno caduto su un solo nodo (TASK-277). Non si conta fra
i tentativi, non consuma il budget e non si riscala; la ricerca passa al
piazzamento dopo. Se nessun tracciato disegna niente, `_done` dice
`CollapsedShapeError`, e `plan_route` risponde come per ogni forma che non si
disegna: «cannot be drawn here, nor within 2 km», con il punteggio migliore
quando qualche lettera ha disegnato qualcosa. Un tracciato con `ratio` 0 prima
cadeva sempre in `next_scale` (nel `rescale` subito dopo, o nel `polish`): i
percorsi che si trovavano prima si trovano uguali.

`engine.zip` rifatto dai sorgenti dopo la #798: dentro cambia solo
`route_engine/optimizer.py`. È un asset JavaScript dell'app: l'impronta iOS
(`6f8bba4c`) non cambia.

## Criteri di accettazione

- [x] Il crash riprodotto con un test deterministico, senza rete:
      `tests/test_next_scale.py`, 9 casi rossi su `main` con
      `ZeroDivisionError`.
- [x] Dopo la correzione il motore risponde con un errore di dominio
      (`ShapeNotDrawableError`, `CollapsedShapeError`) o con un percorso
      quando qualche tracciato disegna: i 10 casi del test verdi.
- [x] Nessuna regressione nei test vicini (`test_optimizer`,
      `test_collapsed_outline`, `test_pen_up`, `test_image_pieces`: 109
      verdi); ruff e black puliti.
- [x] `engine.zip` rifatto per ultimo; `tools/phone_engine` verde.
- [ ] CI verde.

## File toccati

```
services/route-engine/route_engine/optimizer.py
services/route-engine/tests/test_next_scale.py
apps/mobile/assets/engine/engine.zip
docs/tasks/TASK-395.md
docs/STATUS.md
```

## Esito

Una parola o una forma a pezzi con la penna alzata su un grafo troppo piccolo
non fa più cadere il motore: la ricerca salta i tracciati che non disegnano
niente e, se non c'è altro, dice che la forma non si disegna lì.
