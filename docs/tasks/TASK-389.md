# TASK-389 — Il test della pool che a volte conta tre connessioni

**Stato**: Done · 2026-11-04, alla fusione della sua PR
**Fase**: 4 · **Branch**: `fix/TASK-389-flaky-pool-test`
**Numeri**: TASK-389, assegnato dal Coordinatore. Seguito di TASK-288 B.

## Obiettivo

`test_the_pool_closes_when_the_app_never_started` deve passare o fallire
sempre allo stesso modo sullo stesso codice. Oggi in CI a volte fallisce con
«assert 3 == 2»: dal 26 al 30 ottobre è successo 7 volte, anche su PR di soli
documenti (#654) o di sola app (#758).

## Contesto da leggere

- `docs/tasks/TASK-288.md`, «Parte B»: la pool, i suoi numeri, i test.
- `services/api/tests/test_connection_pool.py`, `services/api/shaperoute_api/db.py`
  (`Database.pooled`) e `__main__.py` (`main`, il `finally` che chiude la pool).

## Cosa fare

1. Trovare da dove viene la terza riga di `pg_stat_activity`.
2. Rendere il test deterministico senza indebolirlo e senza toccare il
   server: deve ancora provare che la pool si apre con `POOL_MIN_SIZE`
   connessioni e che `main` le chiude tutte quando l'app non parte.
3. Provarlo: il file da solo 50 volte prima e 50 dopo la correzione, sotto
   `nice`, uno alla volta.

## Causa

Un autovacuum worker. La migrazione 0002 crea PostGIS, che riempie
`spatial_ref_sys` con migliaia di righe; poco dopo PostgreSQL manda un worker
a pulirla e analizzarla, nel momento che sceglie lui. Il worker compare in
`pg_stat_activity` col `datname` del database del test, e `others()` lo
contava come una connessione. La pool invece non può crescere da sola:
psycopg_pool 3.3 apre una connessione in più solo se un client aspetta, e
qui nessuno ne chiede.

La prova, sul Mac con i log di connessioni e autovacuum accesi:

- **prima della correzione**, 1 rosso su 50 giri del file (giro 28, «assert
  3 == 2»). Nel suo database c'erano soltanto le due connessioni della pool,
  la connessione di `migrate()` di `main` era già uscita 180 ms prima, e il
  worker 4150 lavorava su `spatial_ref_sys` dalle 21:46:35.8 fino al DROP
  DATABASE delle 35.950. Il conteggio era alle 35.842;
- **dopo la correzione**, 50 verdi su 50. In 6 giri l'autovacuum è entrato
  nel database di questo test, e in uno (`test_05cf3cf151f6`) era vivo
  proprio al momento del conteggio: il test vecchio lì contava 3.

## Cosa cambia

Solo `tests/test_connection_pool.py`:

- `others()` conta solo i `backend_type = 'client backend'`;
- il test aspetta, con `wait_for_others`, che il conteggio arrivi a
  `POOL_MIN_SIZE`: una connessione chiusa da `migrate()` può restare un attimo,
  quelle della pool non se ne vanno da sole;
- il test legge anche il conteggio della pool stessa (`get_stats`:
  `pool_size` e `connections_num` uguali a `POOL_MIN_SIZE`).

Due varianti della pool, provate e non tenute (una che apre tre connessioni,
una che ne aggiunge una terza subito dopo l'apertura), fanno ancora fallire il
test con «assert 3 == 2».

## Criteri di accettazione

- [x] La causa è scritta qui, con la prova.
- [x] Il test conta solo ciò che deve garantire: nessuna riga che non sia
      della pool lo fa fallire, una connessione in più della pool sì.
- [x] 50 giri del file dopo la correzione, tutti verdi.
- [ ] Nessuna modifica fuori da `tests/`; CI verde.

## File toccati

```
services/api/tests/test_connection_pool.py
docs/tasks/TASK-389.md
docs/STATUS.md
docs/DECISIONS.md
```

## Fuori scope

- **Il codice del server** (`db.py`, `__main__.py`): se servisse cambiarlo, ci
  si ferma e si chiede al Coordinatore.
- Gli altri test che contano le connessioni e già aspettano
  (`wait_for_others`): si toccano solo se usano lo stesso conteggio.

## Esito

Il test non dipende più dal momento in cui arriva l'autovacuum: conta i
client, aspetta il numero giusto e controlla la pool stessa, e una connessione
in più della pool lo fa ancora fallire. Il server non cambia. Il task si
chiude con la fusione della sua PR, perché non resta nulla da fare sul server
né nell'app.
