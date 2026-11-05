# TASK-376 — Fase 0 degli sport: il registro, il banco condiviso, la ricetta

**Stato**: In corso — parte A in `main` (#736); parte B1 (il registro del
motore) in `main` (#763); B2 (contratto e API) con la lista dei file al
Coordinatore, poi B3 (app)
**Fase**: 4 · **Branch**: `feat/TASK-376-a-sport-bench` (parte A),
`feat/TASK-376-b-sport-registry` (parte B) · **ADR**: ADR-0320 · numeri dal
Coordinatore (2026-11-04) · sessione «Coordinatore Sport»

## Obiettivo

Dopo questa fase uno sport nuovo si aggiunge **quasi solo con file nuovi**:
ogni sport ha i suoi file nel motore, nell'API, nell'app e nei testi, e i
file condivisi restano punti di registrazione di una riga. Più sessioni
possono così aggiungere sport in parallelo senza toccare gli stessi file, e
ognuna parte dalle misure delle altre.

## Contesto

Richiesta dell'utente del 2026-11-04 (brief del «Coordinatore Sport»):
Camminata, Escursionismo, Gravel/MTB, Carrozzina e passeggino, Roller, Sci
di fondo, una categoria «Record only», poi Sci alpino, Ciaspole e
Scialpinismo, un po' alla volta con sessioni in parallelo.

Già in corso o deciso quando parte questo task:

- Camminata = TASK-371 (ADR-0315), 1–30 km, fatta con la struttura di oggi.
- Sci di fondo = TASK-372 (ADR-0316): banco su tre centri, nessuna forma
  buona → «Record only».
- Sci alpino = TASK-373 (ADR-0317): la giornata registrata.
- Categoria «Record only» con `skiing` e `xc_skiing` = TASK-375 (ADR-0319).
- Nuoto nell'app = TASK-323 C2 (#734).

Tutti toccano gli stessi file: `settings/sport.ts`, `shared-types` `index.ts`,
`network.py`, `models.py`, `activities.py`, `strava.py`,
`activity_graphs.py` e una ventina di file dell'app che decidono in base
all'attività. Per questo il refactor (parte B) aspetta che entrino.

Da leggere: ADR-0320, `docs/sports/README.md`, ADR-0153 (la bici, lo
sport aggiunto più simile), ADR-0315 (la camminata).

## Cosa fare

### Parte A — banco, documenti, ADR (questa PR)

1. `tools/sport_bench/`: dato un'attività (o una rete non ancora registrata,
   `--loader`) e le zone fisse, misura la rete (km, pezzi, pezzo più
   grande, incroci, km per `highway`), le forme del catalogo (riuscite
   ≥ 0,60, buone ≥ 0,90, somiglianza, km reali) e i tempi; `compare` dice
   cosa è peggiorato fra due misure. Test deterministici senza rete.
2. Zone fisse: Trento, Valsugana (Levico), Milano, Val di Fiemme
   (Cavalese), Asiago, Pianura (Mantova); un punto sull'acqua dove c'è.
3. `docs/sports/`: `README.md` (le regole e come si usa il banco),
   `CONDIVISO.md` (le scoperte comuni), `COME-AGGIUNGERE.md` (la ricetta,
   in bozza fino alla parte B), `run.md`, `bike.md`, `paddle.md` con le
   misure di base.
4. Le misure di base di corsa, bici e canoa, **una alla volta e col turno
   del Coordinatore** (il Mac si blocca con troppe suite insieme).
5. ADR-0320 con la struttura del registro e la scelta sull'impronta del
   motore.

### Parte B — il registro (dopo 371 A+B, 375 A+B, 323 C2 in `main`)

Una sessione sola, lista dei file al Coordinatore prima del codice; il
Coordinatore blocca gli altri lavori su quei file per la durata della PR.

1. Motore: `route_engine/networks/` (un modulo per rete) e
   `route_engine/activities/` (un modulo per attività); `network.py` e
   `models.py` derivano dal registro gli stessi valori di oggi.
2. Contratto: `packages/shared-types/src/sports/<activity>.ts`; `index.ts`
   ricostruisce `ACTIVITIES`, `API_ACTIVITIES`, `DISTANCE_LIMITS_M` uguali.
3. API: `shaperoute_api/sports/<activity>.py` (Strava, zone in memoria,
   record); `activity_graphs.py`, `strava.py`, `activities.py` leggono il
   registro.
4. App: `src/sports/<sport>.ts` con un `SportProfile`; gli `switch`
   sull'attività diventano letture del profilo; testi di ogni sport in
   file propri (forma da decidere guardando `i18n` di allora).
5. Nessun cambiamento visibile: test esistenti invariati (solo import),
   test di uguaglianza dei valori derivati, impronta iOS invariata, banco
   prima e dopo con `compare` senza peggioramenti.
6. L'impronta del motore cambia (ADR-0320, punto 3): il server si aggiorna
   **insieme** al motore del primo sport della fase 1, una notte di esempi
   sola, col sì dell'utente.

Divisa per strato (Coordinatore, 2026-11-04), così i file restano bloccati
meno a lungo: **B1** il motore, **B2** contratto e API, **B3** l'app.

### Parte C — la ricetta definitiva e il pilota

1. `docs/sports/COME-AGGIUNGERE.md` riscritto sulla struttura della parte B.
2. Il pilota della struttura è l'**Escursionismo** (TASK-377, ADR-0321),
   al posto della camminata che è già TASK-371: scelta dell'utente del
   2026-11-04 («ok si»).
3. La fase 1 è Escursionismo (TASK-377), Gravel/MTB (TASK-378) e **Roller**
   (TASK-380, ADR-0324)
   (scelta dell'utente del 2026-11-04, «Sì, Roller»: asfalto liscio e
   `inline_skates=yes`, prima si misura quanta rete resta), al posto dello
   sci di fondo, già «Record only» (TASK-372).

## Criteri di accettazione

- [x] A: `python tools/sport_bench/sport_bench.py zones|run|compare` funziona;
      test di `tools/` verdi in CI.
- [x] A: `docs/sports/` con README, CONDIVISO, COME-AGGIUNGERE (bozza) e le
      misure di base di corsa, bici e canoa.
- [x] A: ADR-0320 scritto.
- [ ] B: corsa, bici, canoa, nuoto, camminata, sci identici: suite intere
      verdi, `compare` del banco senza peggioramenti, impronta iOS invariata.
- [ ] B: aggiungere uno sport di prova tocca solo file nuovi più una riga per
      punto di registrazione (test che lo dimostra).
- [ ] C: ricetta definitiva; il pilota la segue senza deroghe.

## File toccati

Parte A:

```
tools/sport_bench/sport_bench.py          (nuovo)
tools/sport_bench/test_sport_bench.py     (nuovo)
docs/sports/README.md                     (nuovo)
docs/sports/CONDIVISO.md                  (nuovo)
docs/sports/COME-AGGIUNGERE.md            (nuovo)
docs/sports/run.md                        (nuovo)
docs/sports/bike.md                       (nuovo)
docs/sports/paddle.md                     (nuovo)
docs/tasks/TASK-376.md                    (nuovo)
docs/DECISIONS.md                         (solo ADR-0320, in fondo)
docs/STATUS.md                            (solo righe di TASK-376)
docs/INDEX.md                             (una riga)
docs/AGENTI.md                            (solo la sezione «Sport (Coordinatore Sport)»)
```

Parte B1 (il motore; approvata dal Coordinatore il 2026-11-04 con
`SAME_ROUTES_AS`, la prova automatica e il motore del telefono rifatto):

```
services/route-engine/route_engine/networks/__init__.py      (nuovo)
services/route-engine/route_engine/networks/base.py          (nuovo)
services/route-engine/route_engine/networks/foot.py          (nuovo)
services/route-engine/route_engine/networks/bike.py          (nuovo)
services/route-engine/route_engine/activities/__init__.py    (nuovo)
services/route-engine/route_engine/activities/base.py        (nuovo)
services/route-engine/route_engine/activities/running.py     (nuovo)
services/route-engine/route_engine/activities/cycling.py     (nuovo)
services/route-engine/route_engine/activities/paddling.py    (nuovo)
services/route-engine/route_engine/activities/swimming.py    (nuovo)
services/route-engine/route_engine/network.py
services/route-engine/route_engine/models.py
services/route-engine/tests/test_sport_registry.py           (nuovo)
services/api/shaperoute_api/route_store.py
services/api/shaperoute_api/paddle_examples.py               (condizione 2 del Coordinatore)
services/api/tests/test_same_routes.py                       (nuovo)
services/api/tests/fixtures/same_routes/5b5e026cea9b.json    (nuovo)
services/api/tests/fixtures/same_routes/c9702b94404d.json    (nuovo)
apps/mobile/assets/engine/engine.zip
tools/sport_bench/sport_bench.py
tools/sport_bench/test_sport_bench.py
docs/tasks/TASK-376.md, docs/DECISIONS.md (ADR-0320), docs/STATUS.md,
docs/sports/CONDIVISO.md, docs/sports/README.md
```

`base.py` dei due registri non era nella lista mandata: sono file nuovi,
per evitare un ciclo di import fra il registro e i suoi moduli.

Parte B2 (contratto e API), proposta al Coordinatore il 2026-11-05, prima
del codice. Ogni sport dice in un file suo quello che oggi è una riga in una
tabella condivisa; le tabelle se ne ricavano, uguali e nello stesso ordine:

```
packages/shared-types/src/sports/index.ts                   (nuovo, il registro in ordine)
packages/shared-types/src/sports/base.ts                    (nuovo, il tipo SportContract)
packages/shared-types/src/sports/running.ts                 (nuovo)
packages/shared-types/src/sports/cycling.ts                 (nuovo)
packages/shared-types/src/sports/paddling.ts                (nuovo)
packages/shared-types/src/sports/swimming.ts                (nuovo)
packages/shared-types/src/sports/walking.ts                 (nuovo)
packages/shared-types/src/sports/skiing.ts                  (nuovo)
packages/shared-types/src/sports/xc_skiing.ts               (nuovo)
packages/shared-types/src/index.ts                          (solo le righe 55-115: ACTIVITIES,
                                                             API_ACTIVITIES, RECORD_ACTIVITIES,
                                                             RUN_ACTIVITIES, DISTANCE_LIMITS_M)
packages/shared-types/test/sportRegistry.test.ts            (nuovo)
services/api/shaperoute_api/sports/__init__.py              (nuovo, il registro in ordine)
services/api/shaperoute_api/sports/base.py                  (nuovo: ApiSport, SportBests, Distance)
services/api/shaperoute_api/sports/running.py               (nuovo)
services/api/shaperoute_api/sports/cycling.py               (nuovo)
services/api/shaperoute_api/sports/paddling.py              (nuovo)
services/api/shaperoute_api/sports/swimming.py              (nuovo)
services/api/shaperoute_api/sports/walking.py               (nuovo)
services/api/shaperoute_api/sports/skiing.py                (nuovo)
services/api/shaperoute_api/sports/xc_skiing.py             (nuovo)
services/api/shaperoute_api/strava.py                       (SPORT_TYPES dal registro)
services/api/shaperoute_api/activity_graphs.py              (ZONES_IN_MEMORY dal registro)
services/api/shaperoute_api/personal_bests.py               (SPORTS dal registro; ON_FOOT, BY_BIKE
                                                             nei file dello sport, nomi ri-esportati)
services/api/shaperoute_api/activities.py                   (RECORD_ACTIVITIES dal registro;
                                                             RunActivity resta un Literal, provato)
services/api/shaperoute_api/prefetch_zones.py               (ZONE_BOXES, STREET_NAMES dal registro)
services/api/shaperoute_api/run_gpx.py                      (GPX_TYPES dal registro)
services/api/shaperoute_api/schemas.py                      (ACTIVITY_DESCRIPTION: una frase per sport)
services/api/tests/test_sport_registry_api.py               (nuovo)
docs/tasks/TASK-376.md, docs/STATUS.md (righe proprie), docs/sports/CONDIVISO.md
```

Restano fuori, apposta: `route_engine/walking.py` (la camminata resta fuori
dall'impronta del motore, WALK_ONLY), `themes.py` (parole delle sfide, non lo
sport), `errors.py` (legge già `API_DISTANCE_LIMITS_M`). Nessuna migrazione,
nessun cambiamento visibile: i test di oggi passano senza toccarli, l'impronta
iOS non cambia (solo JS e Python). La #781 (TASK-390) tocca `index.ts` alle
righe 1092 e 1280, lontane da queste: decide il Coordinatore. Il campo per gli
sport senza traccia (TASK-385, Palestra) non lo aggiunge B2: lo aggiunge la
Palestra nei file suoi, con una riga nel registro.

Parte B3 (l'app): la lista va al Coordinatore dopo B2 in `main`.

## Dopo il deploy di B1 sul server (Linux x86)

Il server si aggiorna col sì dell'utente; i comandi sono suoi o del
Coordinatore. Tre controlli, nel contenitore dell'API e nel suo log:

1. **Subito, l'impronta.** `python -c "from shaperoute_api import
   paddle_examples, route_store as r; print(r.code_fingerprint(),
   r.engine_fingerprint(), r.engine_fingerprint(swims=True),
   paddle_examples.engine_fingerprint())"` deve dare
   `c9702b94404d 5b5e026cea9b b9d00c37d28d 574fbfba41eb`. Se il primo è
   un altro, il codice sul server non è quello di B1; se uno degli altri
   tre è diverso, l'alias non vale e gli esempi tenuti non rispondono più.
2. **Il primo giorno, il log.** Le richieste trovate fra quelle tenute
   scrivono `job <id>: <forma> <metri> m already drawn` (`jobs.py`), le
   altre `... queued`. La quota `already drawn / (already drawn + queued)`
   del giorno dopo il deploy deve restare quella del giorno prima (stesso
   ordine, qualche punto in più o in meno per il traffico). Se cade quasi
   a zero, l'alias non vale: si torna all'immagine di prima e si cerca il
   perché, non si ridisegna.
3. **I percorsi tenuti nuovi.** Ogni file `routes/*.json` e
   `routes/water/*.json` scritto dopo il deploy ha `"engine"`
   `5b5e026cea9b` (o `b9d00c37d28d` per il nuoto): nessun file con
   `c9702b94404d` o `11647a97e632`.

## Dove si è

2026-11-04: banco scritto e provato (16 test, uno sul motore vero col grafo
di Levico), con i nuovi tentativi per Overpass e l'acqua scaricata una volta
per zona. Misure di base fatte col turno del Coordinatore: corsa e bici su
sei zone (54/54 ciascuna), canoa su Valsugana e Mantova (10/18, il limite è
l'acqua entro 1 km dalla riva). La canoa a Milano è
misurata la sera: 0 su 9 all'Idroscalo, bacino troppo stretto (`paddle.md`).
Parte A in `main` (#736, `638d1ee2`). Scelte dell'utente: pilota
Escursionismo, Roller nella fase 1. Prossimo: la parte B dopo 371 B,
375 A+B e 323 D in `main` (condizione del Coordinatore), con la lista dei
file al Coordinatore prima del codice.

2026-11-04 sera, parte B1: reti e attività del motore nei registri
`networks/` e `activities/`; `network.py` e `models.py` ne ricavano gli
stessi valori nello stesso ordine (`test_sport_registry.py`), e i nomi di
prima si leggono ancora da `network.py`. La prova (`test_same_routes.py`,
nove percorsi fissi offline) è identica fra il motore di `main`
(`5b5e026cea9b` / nuoto `b9d00c37d28d` / esempi canoa `574fbfba41eb`) e
quello spostato (`c9702b94404d` / `11647a97e632` / `fb16815e3876`): tre
righe in `SAME_ROUTES_AS`, nessuna notte di esempi. `engine.zip` rifatto.
Sul Mac `test_first_placement[levico heart 1000]` fallisce anche sul
motore di `main` (verde in CI): non è di B1. Banco col turno del
Coordinatore, `main` (motore esportato a 961fe194) e poi il branch, sei
zone: `compare --same` **nessuna differenza**: corsa 54/54 e bici 54/54
identiche punto per punto, canoa 10 percorsi identici e gli stessi 17
rifiuti (`out/TASK-376/b1-main`, `b1-branch`). Poi B2 e B3.
`__main__.py` e `anchored.py` scelgono ancora la rete con un `if` sulla
bici: il primo sport con una rete nuova li passa a
`OsmnxSource.for_activity`.

2026-11-05: parte B1 in `main` (#763, 2026-11-04 sera), con la #758. Lista
dei file di B2 mandata al Coordinatore (sopra, «File toccati»); il codice
parte dal suo via.
