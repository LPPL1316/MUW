# TASK-289 — I tempi per fase nel log dei percorsi

**Stato**: In lavorazione
**Fase**: 4 · **Branch**: `feat/TASK-289-phase-times`
**Dipende da**: niente; prepara la misura della parte A di TASK-276
**ADR**: ADR-0250

## Obiettivo

Ogni job di percorso dell'API scrive nel log **una riga** con i secondi
di ogni fase. Così la misura sul server di TASK-276 dice dove vanno i
9–18 s di un cuore da 5 km a Trento, che sul Mac ne prende meno di 2.
Poi l'immagine Docker porta il bytecode dei pacchetti, perché i processi
`spawn` delle partenze vicine non ricompilino il motore a ogni percorso.

## Contesto

Analisi della lentezza del 2026-10-16 (sessione «MUW app performance e
ricerca»). Cause probabili, lette nel codice:

- le 3 partenze vicine, con un'attesa fino a 8 s quando il piano dalla
  partenza non converge (`NEARBY_GRACE_S`, ADR-0071);
- i processi `spawn` nuovi a ogni richiesta: import, grafo da unpickle;
- un solo processo uvicorn con 2 job in thread (ADR-0032).

Oggi il log dice solo il tempo totale del job. Il motore misura già i
secondi di ogni partenza (`Tried.seconds`), ma non li scrive nel log.

Il Coordinatore ha chiesto di **non toccare il motore**: ogni cambio a
`route_engine` cambia l'impronta del motore (`route_store.engine_fingerprint`)
e butta via gli esempi già tenuti sul server (ADR-0136). Le fasi si misurano
quindi tutte dall'API.

## Cosa fare

1. In `jobs.py` una riga per job, dopo quella di fine: `job <id>: times
   total=… crop=… loads=… download=… start=… traces=… converged=… far=…
   wait=… nearby=… chosen=… directions=…`. Anche per i job falliti e per
   quelli lasciati prima di calcolare. Le chiavi sono spiegate in
   `job_times.py`. Nessuna posizione (ADR-0092).
2. Il ritaglio della zona si misura in `jobs._Reporting.load`. Il piano
   dalla partenza, le tracce e la convergenza vengono da `NearbyPlan.tried[0]`,
   che `images.plan_request` passa al job (`job_times.noted`). L'attesa
   delle partenze vicine è il tempo del planner meno il primo ritaglio e il
   piano dalla partenza. Le indicazioni si misurano intorno a `with_choices`.
3. Nel `Dockerfile`, `RUN python -m compileall` sui tre pacchetti, dopo
   la copia dei sorgenti e prima di `USER`.
4. Rifare `engine.zip` (`jobs.py` e `images.py` sono nel motore del
   telefono).
5. Misura in locale, Trento, cuore da 5 km: qui sotto, in «Esito».

## Criteri di accettazione

- [ ] Un test controlla la riga intera con un orologio finto: ritaglio,
      piano dalla partenza, tracce, convergenza, attesa, secondi di ogni
      partenza vicina, indicazioni, e nessuna posizione nel log.
- [ ] Un test controlla il `Dockerfile` e che il bytecode non cambi
      l'impronta del motore.
- [ ] Nessun file di `services/route-engine/` toccato: i percorsi e gli
      esempi tenuti restano gli stessi.
- [ ] Misura locale scritta in «Esito».
- [ ] CI verde.

## File toccati

```
services/api/shaperoute_api/job_times.py (nuovo)
services/api/shaperoute_api/jobs.py
services/api/shaperoute_api/images.py
services/api/tests/test_job_times.py (nuovo)
services/api/tests/test_compiled_image.py (nuovo)
Dockerfile
apps/mobile/assets/engine/engine.zip (rifatto)
docs/tasks/TASK-289.md
docs/STATUS.md, docs/DECISIONS.md (righe aggiunte)
```

## Fuori scope

- La misura sul server e ogni scelta su pool di processi e partenze
  vicine: sono di TASK-276, dopo Apple.
- Cambiare il motore, comprese le partenze vicine.

## Esito

### Misura locale, 2026-10-16 (Mac, 10 core)

Cuore da 5 km a Trento attraverso `RouteJobs` e `images.plan_request`,
come nell'API, dalle tre partenze dello script di TASK-276. Tre giri per
partenza, con la zona già scaricata. «Senza bytecode» è una copia dei
pacchetti senza `__pycache__`, con `PYTHONDONTWRITEBYTECODE=1`, come nel
container di oggi. «Con bytecode» è la stessa copia dopo `compileall`.
Mediane dei tre giri, in secondi:

| Partenza | Bytecode | total | start (tracce) | wait | nearby, una per partenza vicina |
|---|---|---|---|---|---|
| 0 | senza | 1.98 | 0.92 (17, converge) | 0.95 | 1.14–1.52 (2) |
| 0 | con | 1.89 | 0.79 (17, converge) | 0.85 | 1.01–1.37 (2) |
| 1 | senza | 2.50 | 2.05 (30, non converge) | 0.44 | 1.41–2.02 (2) |
| 1 | con | 1.65 | 1.34 (30, non converge) | 0.22 | 1.01–1.36 (2) |
| 2 | senza | 1.50 | 1.07 (12, converge) | 0.29 | 0.63–0.93 (3) |
| 2 | con | 1.25 | 0.81 (12, converge) | 0.23 | 0.48–0.73 (3) |

Il ritaglio vale 0,03 s con la zona in memoria e 0,1–0,5 s quando la zona
si legge dal disco; le indicazioni 0,06–0,11 s.

**Cosa dicono questi numeri:**

- **Le partenze vicine allungano il percorso, non solo la CPU.**
  Dalla partenza 0 il piano converge in 0,8–0,9 s, ma le due partenze
  vicine finiscono dopo (1,0–1,5 s): il job aspetta ancora circa 0,9 s,
  quasi metà del totale. Girano a priorità più bassa, e ognuna parte da
  un processo nuovo che importa il motore e legge il grafo.
- **Il bytecode conta poco sul Mac.** Un processo `spawn` pronto a
  pianificare (avviato, motore importato, risposta indietro, mediana di
  15) passa da 0,182 s a 0,159 s, cioè 23 ms per processo, circa 70 ms
  per percorso. Del motore importato (0,14 s) networkx pesa 59 ms e numpy
  22 ms: quelli hanno già il bytecode da `pip`. La differenza più grande
  fra i due blocchi della tabella è il carico del Mac: anche il piano
  dalla partenza, che il bytecode non tocca, è più veloce nel secondo.
  Sul server, con CPU più lente, il guadagno sarà qualche decimo di
  secondo per percorso, non i secondi che mancano.
- **Il Mac carico rifà i tempi del server.** In un primo giro, con altre
  sessioni al lavoro e XProtect al 180% (carico 13 su 10 core), gli
  stessi cuori sono costati 13,4 s, 12,0 s e 3,2 s: il piano dalla
  partenza 0 è passato da 0,9 a 8,9 s con le stesse 17 tracce, e le
  partenze vicine a 8,0–8,2 s ciascuna. La CPU contesa rallenta il piano
  dalla partenza e quelli vicini tutti insieme. Su 4 vCPU condivise un
  percorso tiene occupati 4 processi. È la prima ipotesi da controllare
  con la riga sul server (TASK-276).
- **Una zona da scaricare** (qui una per partenza, 79–110 s da Overpass)
  usa tutto il budget delle partenze vicine (25 s dalla richiesta): la
  riga mostra `download=109.69 … wait=0.18 nearby=-,-`. Un primo download
  fallito dopo 39 s ora conta i suoi secondi (`download=`), invece di
  `loads=0`.
