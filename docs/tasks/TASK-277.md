# TASK-277 — Un contorno che cade su un nodo solo non si disegna, e la ricerca va avanti

**Stato**: In review (PR pronta, ferma fino all'approvazione Apple della 1.0
e agli ok dell'utente; il merge lo dà il Coordinatore)
**Fase**: 4 · **Branch**: `fix/TASK-277-collapsed-outline`

## Obiettivo

Quando tutti i punti di un contorno hanno lo stesso nodo stradale più
vicino, il motore non deve più finire in `engine_error`: quel tentativo
conta come «qui non si disegna», la ricerca prova le altre scale e
posizioni, poi la ricerca lontana (ADR-0040), e se niente funziona
risponde `shape_not_drawable` con un messaggio chiaro.

## Contesto

Nei log dell'API sul server (2026-10-11, lettura sola): il 2026-10-10 alle
12:05:29Z e 12:05:36Z due richieste «circle 5000 m» (corsa) sono finite
`engine_error` dopo 0,6–0,8 s, sulla zona appena scaricata da Overpass
`foot_42.52430_-2.27570_42.57390_-2.20840` (campagna, pochissime strade).
Traceback: `plan_nearby` → `_start_tried` → `ShapeJob.plan` →
`plan_shape` → `search` → `go` → `rescale` → `attempt` → `trace` →
`network.snap_to_network`: `ValueError("the shape collapses onto a single
road node")`. Un «heart 5000 m» subito dopo nello stesso posto non l'ha
incontrato: 76,3 s, ricerca lontana con un altro download, 3279 m, 0,62.

Il ValueError usciva da `search()` come eccezione imprevista: (1)
`plan_shape` non arrivava alla ricerca lontana; (2) `_start_tried` prende
solo `ShapeNotDrawableError`, quindi falliva tutto `plan_nearby`; (3)
l'API lo traduceva in `engine_error` (errore generico nell'app). Il motore
del telefono (`engine.zip`, TASK-214) ha lo stesso codice.

Numero dal Coordinatore il 2026-10-11; aggiunta ad ADR-0040, con rimando
ad ADR-0148. Il motore è fermo fino all'approvazione Apple della 1.0: PR
pronta, merge sul «merge NNN» del Coordinatore, dopo la #489 (TASK-271).

## Contesto da leggere

- `docs/DECISIONS.md`: ADR-0040, ADR-0148, ADR-0230, ADR-0071, ADR-0195
- `docs/ROUTE_ENGINE.md`: «Nessuna strada», la ricerca lontana
- `services/route-engine/route_engine/optimizer.py` (`search`,
  `plan_shape`), `network.py` (`snap_to_network`), `errors.py`

## Cosa fare

1. `errors.py`: `CollapsedShapeError`, un `ShapeNotDrawableError` (e
   quindi ancora un `ValueError`), con il messaggio di prima.
2. `network.snap_to_network` la lancia al posto del `ValueError`.
3. `optimizer.search`: un tentativo che collassa non c'è (né route né
   distanza da cui riscalare); si passa alla posizione dopo, la
   rifinitura si ferma lì. Se nessun contorno si traccia,
   `CollapsedShapeError`. Se la fase dritta non traccia niente e quella
   inclinata sì, la ricerca è quella inclinata.
4. `optimizer.plan_shape`: senza niente tracciato qui, ricerca lontana;
   lì vince qualunque percorso; senza niente nemmeno lì,
   `CollapsedShapeError` con «… cannot be drawn here, nor within 2 km:
   too few roads, …».
5. `pen_up.py`: una lettera che cade su un nodo solo resta quel nodo
   (stesso comportamento, ordine delle `except`).
6. Test deterministici su grafi sintetici, senza rete.
7. `engine.zip` ricostruito; `paddleExamples.json` ridisegnato (network.py
   ed errors.py sono nella fingerprint dell'acqua) su una copia in sola
   lettura dell'acqua del server.

## Criteri di accettazione

- [x] Un contorno su un nodo solo dà `CollapsedShapeError`, che è uno
      `ShapeNotDrawableError` e ancora un `ValueError` (test).
- [x] La ricerca salta i contorni che collassano e trova il percorso con
      gli altri (test con un tracciatore che collassa a comando).
- [x] Senza niente di dritto tracciato, la ricerca è quella inclinata
      (test).
- [x] Il caso del 2026-10-10 (cerchio 5 km, una sola strada corta 3 km
      più in là): la ricerca lontana parte e disegna il cerchio (test,
      anche per la via dell'API, `plan_nearby`).
- [x] Niente di tracciabile né qui né entro 2 km: `ShapeNotDrawableError`
      con il messaggio chiaro, senza distanza suggerita (test).
- [x] Ogni altro percorso identico: test del motore verdi, digest
      fissati (`test_kept_per_graph`, `test_far_search_skipped`) e 16
      richieste confrontate fra `main` e il branch; esempi in canoa
      identici (cambia solo `engine`).
- [x] `engine.zip` ricostruito (cambiano solo i quattro file del motore).

## File toccati

```
services/route-engine/route_engine/errors.py
services/route-engine/route_engine/network.py
services/route-engine/route_engine/optimizer.py
services/route-engine/route_engine/pen_up.py
services/route-engine/tests/test_collapsed_outline.py   (nuovo)
apps/mobile/assets/engine/engine.zip
apps/mobile/src/paddle/paddleExamples.json
docs/tasks/TASK-277.md                                  (nuovo)
docs/STATUS.md
docs/DECISIONS.md
docs/ROUTE_ENGINE.md
```

## Fuori scope

- L'API (`services/api`): già traduce ogni `ShapeNotDrawableError` in
  `422 shape_not_drawable`.
- Accendere il log delle richieste sul server.
- Aggiornare il server, `draw_examples` e il motore del telefono: li fa il
  Coordinatore con gli ok dell'utente, dopo il merge.

## Esito

PR pronta il 2026-10-11, ferma fino all'approvazione Apple della 1.0 e al
«merge NNN» del Coordinatore; entra dopo la #489 (TASK-271), e allora
`engine.zip` e `paddleExamples.json` vanno ricostruiti su `main`. La
fingerprint del motore cambia: dopo l'aggiornamento del server va rifatto
`draw_examples` (`AGENTI.md`, regola 11); il telefono ha il motore nuovo
solo con una pubblicazione dell'app. Fingerprint dell'acqua
`15bb981f9359` → `2693d5eb0b18`, i 32 esempi identici.
