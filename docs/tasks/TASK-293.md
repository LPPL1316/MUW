# TASK-293 — «Send to Strava» senza un blocco del database dentro l'altro

**Stato**: In revisione (PR #528), aspetta «merge 528»; il server dopo
l'approvazione di Apple e l'ok dell'utente
**Fase**: 4 · **Branch**: `feat/TASK-293-strava-one-block`
**Dipende da**: TASK-288 parte B (il pool di connessioni, #524, in `main`
`42699af4`)
**ADR**: aggiunta ad ADR-0249 · **Migrazione**: nessuna · **Solo API**

## Obiettivo

`strava.py` non apre mai un blocco del database (`Database.connect()`)
mentre lo stesso thread ne tiene un altro. Un invio a Strava prende una
connessione del pool alla volta, e nessuna fuori dal pool. Restano «un
invio della stessa corsa alla volta» e «un rinnovo del token alla volta
per account».

## Contesto

Seguito di TASK-288 parte B (`tasks/TASK-288.md`, «Parte B», «Seguiti»,
il primo punto); numero dal Coordinatore il 2026-10-18, che ha posto una
condizione: **la stessa corsa non va mai a Strava due volte**, provato da
un test.

Prima, `StravaRuns.send` teneva la corsa bloccata (`SELECT … FOR UPDATE`
su `runs`) per tutto l'invio, e dentro quel blocco:

- `_upload` e `_describe` chiamavano `_authorized` → `_access_token`, che
  apriva un **secondo** blocco per leggere il token, con un altro
  `FOR UPDATE` su `strava_accounts`;
- dopo due rifiuti, `_authorized` chiamava `disconnect`, un **terzo**
  blocco.

Dal pool (TASK-288 B) funzionava solo per la regola di `db.py`: un blocco
dentro un altro nello stesso thread ha una connessione sua, fuori dal pool.
Così ogni invio pagava una connessione nuova (la stretta di mano della
password), e dieci invii insieme senza quella regola si sarebbero aspettati
a vicenda fino all'errore dopo 10 s.

## Contesto da leggere

- `docs/DECISIONS.md`: ADR-0156 («Send to Strava», il rinnovo con
  `FOR UPDATE`), ADR-0249 e la sua aggiunta della parte B (punto 5)
- `docs/tasks/TASK-288.md`, «Parte B»

## Cosa fare

1. `send` legge prima lo stato della corsa, senza lock (`_known`, lo
   stesso di `GET …/strava`): una corsa che l'account non ha è un 404
   prima che il token sia un 409, come prima; una corsa già su Strava senza
   un post nuovo risponde subito, senza token, come prima.
2. Poi il token, nel suo blocco (`_access_token`, invariato: il rinnovo
   resta sotto `FOR UPDATE` su `strava_accounts`, uno alla volta).
3. Poi la corsa nel suo blocco (`_send_with`), con `FOR UPDATE` come prima,
   per caricare o cambiare il testo con quel token. Un token rifiutato
   esce dal blocco (niente è scritto), `_authorized` rinnova fuori e
   ricomincia dalla corsa: la rilegge sotto lock, e trova quel che un altro
   invio ha fatto nel frattempo. Due rifiuti: `disconnect`, anch'esso fuori.
4. Dopo il blocco della corsa, `_follow` come prima (ogni sguardo legge il
   token nel suo blocco).
5. `db.py`: solo il commento della regola del blocco annidato, che resta
   come difesa.

## Criteri di accettazione

- [x] Nessun `Database.connect()` aperto mentre lo stesso thread ne tiene
      un altro, in nessun test di `test_strava.py`: una sonda autouse su
      `Database.connect` fa fallire il test e dice da dove. Contro lo
      `strava.py` di `main` fallisce in 30 test, con i percorsi
      `_access_token < _authorized < _upload` (o `_describe`) `< send`, e
      `disconnect` dopo un rifiuto.
- [x] Un test prova che la sonda vede un blocco dentro l'altro, e non
      quello di un altro thread.
- [x] Due invii della stessa corsa insieme: il secondo aspetta il lock
      della corsa mentre il primo è da Strava, poi trova quel che il primo
      ha fatto. Un solo file a Strava, tutti e due `sent`.
- [x] Un secondo invio della stessa corsa che passa fra la prima lettura
      (senza lock) e il lock del primo, e la carica: il primo la trova
      sotto il lock e non la carica di nuovo, che Strava l'abbia già letta
      (`sent`) o no (`processing`). Un solo file (richiesta del
      Coordinatore del 2026-10-18).
- [x] Due invii di corse diverse con il token scaduto, insieme: il secondo
      aspetta il lock del token mentre il primo lo rinnova, poi prende il
      nuovo. Un solo rinnovo.
- [x] Tutti i test di `test_strava.py` verdi; ruff, black e la suite
      dell'API con PostgreSQL verdi; CI verde. In locale il 2026-10-19:
      `test_strava.py` 65, la suite dell'API 1530, ruff e black puliti;
      CI 5/5 verde sulla head `9defe28b`, prima del riallineamento a
      `main` dopo la #527 (solo app e documenti).

## File toccati

```
services/api/shaperoute_api/strava.py
services/api/shaperoute_api/db.py                         (solo un commento)
services/api/tests/test_strava.py
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-293.md                                    (nuovo)
```

## Fuori scope

- Il lock della corsa tiene ancora una connessione del pool per tutta la
  chiamata a Strava (il caricamento, o il cambio del testo): serve a «un
  invio della stessa corsa alla volta». Toglierlo vorrebbe uno stato
  «sto caricando» sulla corsa, con una scadenza per chi cade a metà: una
  migrazione e un'altra scelta, non qui.
- Anche il rinnovo del token tiene la sua connessione durante la chiamata
  a Strava, per lo stesso motivo (un rinnovo alla volta).
- `docs/tasks/TASK-288.md` («Seguiti») non si tocca: è il file di un altro
  task.
- Il server: l'immagine nuova la fa il Coordinatore, dopo l'approvazione
  di Apple e con l'ok dell'utente.

## Esito

*(a fine task)*
