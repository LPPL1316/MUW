# TASK-271 — «Make a U-turn» anche dove non c'è un incrocio

**Stato**: Done (in `main` con la #489, 2026-10-25; server, `draw_examples`
e motore sul telefono ancora da fare, vedi «Cosa resta per il server»)
**Fase**: 4 · **Branch**: `fix/TASK-271-dead-end-u-turn`

Numero dato dal Coordinatore (sessione `local_e57a8224`) il 2026-10-10.
Aggiunta ad ADR-0045, senza ADR nuovo.

## Obiettivo

Quando un percorso torna indietro in un vicolo cieco o su un nodo che non è
un incrocio, la voce dice «Make a U-turn» («Torna indietro»), come già fa
agli incroci.

Dalla prima recensione di un tester (2026-10-10): «quando devi tornare
indietro non lo dice. Quando devi tipo arrivare ad un punto e tornare
indietro dalla stessa strada».

## Contesto da leggere

- `services/route-engine/route_engine/directions.py`, `directions()`
- `docs/DECISIONS.md` §ADR-0045

**Causa, già verificata**: `directions()` salta ogni nodo con meno di
`MIN_BRANCHES` (3) strade (`if count < MIN_BRANCHES: continue`). Su una
strada senza uscita (1 strada) o su un nodo in mezzo a una strada (2 strade:
bordi tagliati, vie unite) il percorso torna indietro e non si dice niente.
Sul grafo dei test `directions(g, [T, W, T])` (W ha 1 strada) e
`directions(g, [T, P, T])` (P ne ha 2) danno `[]`, mentre `[W, T, W]`
all'incrocio T dà `"u-turn"`.

## Cosa fare

1. In `directions()`, su un nodo con meno di `MIN_BRANCHES` strade, dare
   un'indicazione solo quando il percorso torna da dove è venuto
   (`after == before`) e l'angolo è un `"u-turn"` (`turn_of`); ogni altro
   nodo così resta in silenzio come oggi. `branches` resta il conteggio
   vero. Aggiornare la docstring del modulo e quella di `directions()`.
2. Test in `services/route-engine/tests/test_directions.py`: vicolo cieco →
   un `"u-turn"` col nome della via; ritorno in mezzo a una strada →
   `"u-turn"`; un nodo in mezzo a una strada passato dritto o con una
   curva resta in silenzio; `test_on_a_real_graph_every_direction_is_at_a_real_junction`
   vale ancora per i percorsi che non tornano indietro.
3. Controllare che a valle niente supponga `branches >= 3`
   (`route_engine/sidewalks.py`, l'API che riempie `along`). L'app ha già il
   testo `"u-turn"` nelle 5 lingue (`apps/mobile/src/voice/*.ts`): nessun
   testo nuovo.
4. Una riga in `docs/DECISIONS.md` («ADR-0045, aggiunta», in fondo) e una
   voce «In lavorazione» in `docs/STATUS.md` (solo righe aggiunte).

## Criteri di accettazione

- [ ] `directions(g, [T, W, T])` dà un solo `"u-turn"` su W, con «Via
      Roma» e `branches == 1`.
- [ ] `directions(g, [T, P, T])` dà un solo `"u-turn"` su P, con «Via
      Verdi» e `branches == 2`.
- [ ] `directions(g, [T, P, Q])` resta `[]` (curva di 90° fuori da un
      incrocio), come i nodi a due strade passati dritti.
- [ ] Su un grafo vero (Levico) i percorsi più brevi, che non tornano mai
      indietro, hanno indicazioni solo agli incroci; ogni ritorno su un
      vicolo cieco o su un nodo a due strade dà `"u-turn"`.
- [ ] `pytest -m "not network"` del motore verde, `ruff` e `black` puliti.

## File toccati

```
services/route-engine/route_engine/directions.py
services/route-engine/tests/test_directions.py
docs/tasks/TASK-271.md
docs/STATUS.md
docs/DECISIONS.md
apps/mobile/assets/engine/engine.zip
apps/mobile/src/paddle/paddleExamples.json
```

Gli ultimi due li ha approvati il Coordinatore (`local_e57a8224`) il
2026-10-10, per la regola di `AGENTI.md` su chi cambia il motore: lo zip del
motore sul telefono (`python tools/phone_engine/phone_engine.py engine`) e
gli esempi di «Paddle» dentro l'app
(`python -m shaperoute_api.paddle_examples --cache-dir <cache>`, TASK-227)
seguono `directions.py`, altrimenti i due test che li legano al motore
falliscono. Nessun altro task li tiene adesso.

## Condizioni del Coordinatore

- Cambia il motore: dopo il merge servono **l'ok dell'utente** per
  aggiornare il server, per un giro di `draw_examples` e per ripubblicare
  il motore sul telefono (il motore del telefono è il motore Python in una
  WebView, TASK-214).
- **Non entra nella 1.0** (build 5).
- I percorsi già in cache (esempi di «Explore», percorsi salvati) tengono
  le indicazioni vecchie finché non si ricalcolano: va detto all'utente.
- A PR verde: «#NNN pronta» al Coordinatore, e merge solo dopo il suo
  «merge NNN» esplicito.

## Fuori scope

- Le «mini svolte di 3 m» citate dal tester («per ora si può lasciare
  così»).
- Il navigatore dell'app (TASK-270, PR #486: `navigator.ts`, `progress.ts`).
- Testi nuovi nell'app: `"u-turn"` c'è già in tutte le lingue.
- Le descrizioni «junction» di `DirectionBody` (API) e di `Direction`
  (`packages/shared-types`): `branches` sotto 3 c'era già, nella partenza.

## Dove siamo (2026-10-10)

Codice, test e documenti fatti; PR #489 aperta (in locale: motore 1581
passati, test API sulle indicazioni 67, ruff/black puliti; i 3 test nuovi
falliscono su `main`). Il Coordinatore la tiene ferma con un **veto fino
all'approvazione di Apple della 1.0**; poi chiede all'utente l'ok per
server, `draw_examples` e motore sul telefono e scrive «merge 489». La
sessione che l'ha aperta è archiviata su richiesta dell'utente: chi
riprende tiene la PR verde, la riallinea a `main` se va in conflitto su
STATUS o DECISIONS (tenendo tutte le voci), la mergia al «merge 489» e poi
chiude il task (questo «Esito», riga di chiusura e voce «Completato» in
STATUS) con una PR di documenti da `origin/main`.

2026-10-11: PR riallineata a `main` (conflitto solo in fondo a
`DECISIONS.md`, tenute tutte e due le voci) e rimessa verde: la CI chiedeva
i due file del motore. `engine.zip` rifatto (dentro cambia solo
`route_engine/directions.py`); `paddleExamples.json` ridisegnato sull'acqua
del server copiata in sola lettura sul Mac (292 file): cambia solo
l'impronta `engine` (`15bb981f9359` → `bf3ab4e15853`), i 32 esempi sono
identici.

2026-10-25: l'utente ha scritto «ok finiscilo» per la #489 (nella sessione
«Task ancora da completare»), che vale come via al merge anche prima
dell'approvazione di Apple. Riallineata a `main` `88b63b6e` (conflitti
solo in `STATUS.md` e `DECISIONS.md`, tenute tutte le voci; la voce di
DECISIONS in fondo, dopo quelle entrate nel frattempo); `engine.zip`
rifatto da `main` (dentro cambia ancora solo `route_engine/directions.py`);
`paddleExamples.json` ridisegnato su una nuova copia in sola lettura
dell'acqua del server (297 file): di nuovo cambia solo l'impronta
`engine` (`15bb981f9359` → `bf3ab4e15853`), i 32 esempi identici.

## Esito

In `main` con la #489 (2026-10-25). Dove il percorso torna indietro su un
vicolo cieco o su un nodo con due strade, `directions()` dà `"u-turn"` col
nome della via; le altre curve fuori dagli incroci restano in silenzio,
agli incroci niente cambia. Nessun testo nuovo nell'app. Test del motore
verdi, ruff e black puliti, CI verde.

## Cosa resta per il server

Il merge non tocca il server: le indicazioni nuove arrivano solo dopo
questi passi, del Coordinatore (`local_e57a8224`), dopo l'approvazione di
Apple della 1.0 e con il sì dell'utente.

1. **Aggiornare il server** a un `main` che contiene la #489 (insieme agli
   altri cambi in coda per il server).
2. **`draw_examples`**: l'impronta del motore cambia, quindi gli esempi di
   «Explore» tenuti sul server vanno ridisegnati (`AGENTI.md`, regola 11).
   Finché non si rifanno, e per i percorsi già salvati, restano le
   indicazioni vecchie.
3. **Motore sul telefono** (TASK-214): `engine.zip` in `main` è già quello
   nuovo, ma arriva sui telefoni solo con una pubblicazione dell'app
   (`eas update`), con il via del Coordinatore.

Gli esempi in canoa dentro l'app (`paddleExamples.json`) non cambiano: è
cambiata solo l'impronta.
