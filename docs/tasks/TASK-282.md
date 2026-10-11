# TASK-282 — Il percorso proprio dove la figura è stata messa sulla mappa

**Stato**: Todo (aspetta l'approvazione di Apple della 1.0 e TASK-281)
**Fase**: 4 · **Branch**: parte A `feat/TASK-282-a-near-on-land`,
parte B `feat/TASK-282-b-app-near`

## Obiettivo

Una figura disegnata o messa sulla mappa con «Draw on the map»
(TASK-281) diventa un percorso centrato dove l'utente l'ha messa, non
solo vicino: il motore accetta `near` anche a piedi e in bici, e per il
contorno di un'immagine o di una linea disegnata.

## Contesto

Secondo dei due passi scelti dall'utente il 2026-10-11 per «Draw on the
map» (vedi `TASK-281.md`, «Contesto»), nella sessione «Explore e Draw:
profilo e disegno mappa»; numero dal Coordinatore.

Oggi `near` (ADR-0202, TASK-238) vale solo sull'acqua: il motore rifiuta
la richiesta con un'altra attività (`NEAR_ON_WATER_ONLY` in
`route_engine/models.py`) e `ImageRouteRequest` non ha il campo. A piedi
la forma la mette il motore attorno alla partenza, cercando posto,
grandezza e inclinazione (ADR-0040, partenze vicine ADR-0071).

**Aspetta l'approvazione di Apple della 1.0**: motore e server sono
fermi mentre il revisore prova l'app (`AGENTI.md`). Tocca `route_engine`:
`engine.zip` del motore sul telefono (TASK-214), forse
`paddleExamples.json` (se cambia un file nella sua impronta, come
`models.py`), e dopo l'aggiornamento del server `draw_examples`
(regola 11 di `AGENTI.md`), sempre con l'ok dell'utente.

## Contesto da leggere

- `docs/DECISIONS.md`: ADR-0202 (e le aggiunte 10–13 di TASK-244),
  ADR-0040, ADR-0071, ADR-0068/0069
- `docs/API.md`: `POST /route-jobs` (`near`), `POST /image-route-jobs`
- `docs/ROUTE_ENGINE.md`: dove si cerca il posto della forma
- `services/route-engine/route_engine/models.py`, `optimizer.py`,
  `nearby_starts.py`, `water_fit.py` (come lo fa l'acqua)
- memoria di TASK-238: aggiungere un campo a `RouteRequest`/`RouteResult`
  rompe gli elenchi di campi scritti a mano in `test_contract.py`
  (motore e API), `test_better_distance.py`, `test_request_log.py` e
  `contract.test.ts`

## Cosa fare

### Parte A — motore, API e contratto

1. **Prima del codice, campioni**: tre figure messe a mano su tre punti
   di Trento e di una città estera (cuore, stella, una linea disegnata),
   con il percorso di oggi (TASK-281) e con `near`; distanza fra il
   centro chiesto e quello ottenuto, somiglianza, tempo. Da far vedere
   all'utente prima di cambiare il codice dell'app.
2. `near` accettato con `running` e `cycling`: la forma si cerca con il
   centro il più vicino possibile al punto chiesto (un raggio piccolo,
   da misurare con i campioni), senza le partenze vicine lontane; se lì
   non sta, il motore lo dice con un errore chiaro invece di spostarla
   lontano (o la sposta del minimo: da decidere coi campioni, scelta
   tecnica della sessione).
3. `ImageRouteRequest.near` (nuovo, facoltativo), con la stessa regola.
4. `RouteResult.centre` anche a piedi, come sull'acqua.
5. L'inclinazione: una figura messa dritta resta dritta? Domanda per
   l'utente, con i campioni (oggi il motore la inclina fino a 45°,
   TASK-232).
6. Test deterministici; `engine.zip` rifatto; `paddleExamples.json`
   ridisegnato se cambia l'impronta (devono uscire uguali).

### Parte B — app

1. «Draw on the map» manda `near` (il centro della figura sulla mappa)
   con forme, immagini e linee disegnate.
2. Un'API più vecchia rifiuta `near` a piedi con `invalid_request`:
   l'app va pubblicata solo dopo il server (come TASK-202).

## Criteri di accettazione

- [ ] Una richiesta a piedi con `near` dà un percorso col centro entro
      la distanza misurata con i campioni dal punto chiesto (test
      deterministico su un grafo di prova).
- [ ] Senza `near` i percorsi sono identici a quelli di oggi (test sulle
      impronte, come per TASK-277).
- [ ] `ImageRouteRequest` con `near` funziona allo stesso modo (test).
- [ ] I campioni sono stati visti dall'utente prima della parte B.
- [ ] Contratto aggiornato in `shared-types`, `schemas.py`, `API.md` e
      nei test di contratto; suite di motore, API e app verdi.

## File toccati

Previsti; la sessione li conferma dopo i campioni.

Parte A:
```
services/route-engine/route_engine/models.py
services/route-engine/route_engine/optimizer.py
services/route-engine/route_engine/nearby_starts.py
services/route-engine/tests/*                 (i test che servono)
services/api/shaperoute_api/schemas.py
services/api/shaperoute_api/images.py
services/api/tests/*                          (i test che servono)
packages/shared-types/src/index.ts
packages/shared-types/fixtures/*              (se serve una fixture nuova)
apps/mobile/assets/engine/engine.zip          (rifatto)
apps/mobile/src/paddle/paddleExamples.json    (solo se cambia l'impronta)
docs/API.md
docs/ROUTE_ENGINE.md
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-282.md
```

Parte B:
```
apps/mobile/src/mapdraw/*
apps/mobile/src/api/*                         (la richiesta con near)
docs/UI.md
docs/STATUS.md
docs/tasks/TASK-282.md
```

## Fuori scope

- `near` per le parole.
- Ruotare la figura a mano.
- Toccare `route_engine/directions.py` (di TASK-271 finché la #489 non
  entra).
- Aggiornare il server, rilanciare `draw_examples`, pubblicare: con l'ok
  dell'utente e il via del Coordinatore.

## Esito

*(a fine task)*
