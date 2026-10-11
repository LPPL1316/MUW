# TASK-276 — Più percorsi all'ora sullo stesso server

**Stato**: Todo — aspetta l'approvazione di Apple della 1.0 (nessun lavoro
pesante sul server mentre il revisore prova l'app), poi l'ok dell'utente e
il via del coordinatore
**Fase**: 4 · **Branch**: `docs/TASK-276-plan` (questo file); per il
codice, se si decide di farlo, `feat/TASK-276-route-process-pool`
· **ADR**: 0242, riservato

## Obiettivo

Sapere, con numeri misurati sul server, quanti percorsi all'ora calcola il
CX33 e quante persone al giorno regge, poi decidere con l'utente se e come
fargliene calcolare di più senza cambiare server.

## Contesto

Il 2026-10-11 l'utente ha chiesto quante persone regge il server. La stima
data in chat era di 2.000–3.000 persone attive al giorno, con un limite
nel calcolo dei percorsi sul server, non in RAM, disco o banda. Poi ha
chiesto di «usare tutti e 4 i core» con più processi. Guardando il codice
e misurando, la premessa (un core su quattro) si è rivelata sbagliata:
prima di scrivere codice serve una misura sul server.

**Il server, in sola lettura, il 2026-10-11:**

- CX33: 4 vCPU, 8 GB, nessuno swap. RAM usata circa 1 GB (API 259 MB,
  database 77 MB), carico 0,04.
- Disco: volume delle zone 51 GB su 69, `/` 13 GB su 75.
- Traffico delle 48 ore prima: 4 job di percorso e circa 150 richieste
  oltre a `/health`.

**Come l'API calcola un percorso oggi:**

- Un solo processo uvicorn. I job di percorso girano in
  `services/api/shaperoute_api/jobs.py` su un `ThreadPoolExecutor` di
  `WORKERS = 2` thread (ADR-0032).
- Le zone tenute in memoria sono `MAX_ZONES = 2` a piedi e 1 in bici
  (`graphs.py`, `activity_graphs.ZONES_IN_MEMORY`).
- Ogni percorso è pianificato dalla partenza e, in contemporanea, da
  fino a 3 partenze vicine. Ognuna gira in un processo `spawn` a priorità
  più bassa (`route_engine/nearby_starts.py`, ADR-0071; senza `Pool` da
  TASK-248, ADR-0212).
- Le partenze vicine partono solo se c'è memoria libera, e mai su un
  grafo oltre `NEARBY_MAX_NODES` (30 000 nodi). Finito il piano dalla
  partenza, le partenze vicine hanno ancora 3–8 s (`NEARBY_GOOD_GRACE_S`,
  `NEARBY_GRACE_S`).

**Misura sul Mac (2026-10-11):**

- 12 percorsi a Trento con la zona già in memoria: cuore, cerchio e
  stella da 5 km e cuore da 10 km, ognuno da tre partenze.
- Tempo di ogni percorso: 0,9–2,6 s.
- CPU del thread del job: 17,5 s in tutto. CPU dei processi delle
  partenze vicine: 35,7 s. **Rapporto 2,04.**
- Sul Mac quindi un percorso usa già altri core. Con M secondi di CPU
  del thread, un percorso costa circa 3M secondi di CPU in tutto.
- Con oggi i due thread si dividono il GIL: al massimo un percorso ogni
  M secondi.
- Con 4 core il limite assoluto è 4/(3M):
  - un pool di processi da solo darebbe **al massimo +33%**;
  - un pool più nessuna partenza vicina quando il server è carico darebbe
    fino a circa ×3–4 nei picchi, ma in quei momenti ci sarebbero meno
    alternative e a volte forme meno fedeli (TASK-075: un cuore da 10 km a
    Caldonazzo è passato da 0,73 a 0,92 grazie alle partenze vicine).
    Questa è una scelta di prodotto, dell'utente.

**La domanda aperta:** sul server lo stesso cuore da 5 km a Trento risponde
in 8,9–18 s (misure del 2026-10-01 e del 2026-10-05), sul Mac in meno di
2. Non si sa quanto pesa la CPU più lenta e quanto l'attesa delle partenze
vicine o l'avvio dei processi `spawn`. È la prima cosa da misurare.

**Scelta dell'utente del 2026-10-11:** aspettare e misurare sul server dopo
l'approvazione di Apple, poi decidere con i numeri.

## Contesto da leggere

- `docs/tasks/TASK-248.md`, «Cosa si sa» e parte B: perché nel motore non
  c'è più un `Pool`.
- `docs/DECISIONS.md`: ADR-0032 (i job), ADR-0071 (le partenze vicine),
  ADR-0212 (i processi senza `Pool`).
- `docs/DEPLOY.md`, strada F: come si entra nel container dell'API.

## Cosa fare

### Parte A — misurare sul server

Dopo l'approvazione di Apple, con l'ok dell'utente e il via del
coordinatore, in un'ora con poco traffico: circa 10 minuti di CPU.

1. **CPU di un percorso**: CPU del thread del job e CPU dei processi
   figli, sulla zona di Trento e su una città grande (Milano, 15 km, oltre
   `NEARBY_MAX_NODES`). Lo script sotto, mandato su stdin dentro il
   container:
   `docker compose exec -T api python - < route_cpu.py`.
2. **Percorsi all'ora con più richieste insieme**: 1, 2, 4 e 8 richieste
   date tutte insieme a un `RouteJobs` come quello dell'API. Si misurano
   l'attesa in coda, il tempo totale e i percorsi finiti al minuto.
3. **Picco di RAM per processo**: RSS dell'API e dei processi figli, con
   le zone di Trento e di Milano in memoria.
4. Scrivere i numeri in «Esito» e rifare la stima delle persone al giorno.

Lo script del punto 1, usato sul Mac il 2026-10-11 (lì con
`PYTHONPATH=../route-engine:../ai:.` da `services/api`):

```python
import resource, time
from pathlib import Path
from route_engine.models import RouteRequest
from shaperoute_api.activity_graphs import ActivityGraphs, source_for
from shaperoute_api.images import plan_request

def cpu():
    me = resource.getrusage(resource.RUSAGE_SELF)
    kids = resource.getrusage(resource.RUSAGE_CHILDREN)
    return me.ru_utime + me.ru_stime, kids.ru_utime + kids.ru_stime

def main():
    roads = source_for(ActivityGraphs.from_cache(Path("data/cache")), "running")
    starts = [(46.0679, 11.1211), (46.0748, 11.1300), (46.0620, 11.1150)]
    plan_request(RouteRequest(start=starts[0], distance_m=3000, shape="circle"), roads)
    for shape, distance in [("heart", 5000), ("circle", 5000), ("star", 5000), ("heart", 10000)]:
        for start in starts:
            m0, k0 = cpu(); t0 = time.perf_counter()
            plan_request(RouteRequest(start=start, distance_m=distance, shape=shape), roads)
            m1, k1 = cpu()
            print(shape, distance, start, f"wall {time.perf_counter() - t0:.1f}",
                  f"main {m1 - m0:.1f}", f"children {k1 - k0:.1f}", flush=True)

if __name__ == "__main__":  # spawn re-imports the main module
    main()
```

### Parte B — decidere

Con i numeri della parte A, l'utente sceglie una di queste strade:

- non fare niente per ora;
- un pool di processi;
- un pool di processi, e niente partenze vicine quando il server è
  carico;
- un server più grande.

Se si costruisce, valgono i vincoli del coordinatore (2026-10-11):

1. Nessun `Pool` chiuso a metà lavoro (TASK-248, ADR-0212), e ogni job
   ha un tempo massimo.
2. Il numero di processi si sceglie dalla RAM misurata, non solo dai
   core: 8 GB vanno divisi anche con PostgreSQL, e osmium arrivava a
   3,6 GB.
3. Quando il server non è carico i percorsi restano identici a oggi,
   con un test che lo dimostra.

## Criteri di accettazione

- [ ] Parte A: CPU per percorso (thread e figli), percorsi al minuto con
      1, 2, 4 e 8 richieste insieme e picco di RAM per processo, misurati
      sul server e scritti in «Esito».
- [ ] La stima delle persone al giorno è rifatta con quei numeri e
      scritta in «Esito».
- [ ] Parte B: la scelta dell'utente è scritta qui. Se si costruisce,
      c'è ADR-0242 e i tre vincoli sono rispettati, con test.

## File toccati

Parte A:

```
docs/tasks/TASK-276.md
docs/STATUS.md (solo le righe di questo task)
```

Parte B, se si costruisce (previsti):

```
services/api/shaperoute_api/jobs.py
services/api/shaperoute_api/<modulo nuovo del pool>.py
services/api/tests/<test nuovi>
docs/DECISIONS.md (ADR-0242)
docs/STATUS.md, docs/tasks/TASK-276.md
```

## Fuori scope

- L'errore «the shape collapses onto a single road node» visto sul server
  il 2026-10-10: è un task del motore a parte, chiesto il 2026-10-11 in
  un'altra sessione.
- Cambiare server o provider.
- Cambiare il motore (`route_engine`), comprese le partenze vicine.

## Esito

*(si compila a fine task)*
