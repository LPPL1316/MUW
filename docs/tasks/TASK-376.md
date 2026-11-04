# TASK-376 — Fase 0 degli sport: il registro, il banco condiviso, la ricetta

**Stato**: In corso — parte A (banco e documenti) in PR; parte B (il
refactor) dopo 371 A+B, 375 A+B e 323 C2 in `main`
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

### Parte C — la ricetta definitiva e il pilota

1. `docs/sports/COME-AGGIUNGERE.md` riscritto sulla struttura della parte B.
2. Il pilota della struttura è l'**Escursionismo** (TASK-377, ADR-0321),
   al posto della camminata che è già TASK-371: scelta dell'utente del
   2026-11-04 («ok si»).

## Criteri di accettazione

- [ ] A: `python tools/sport_bench/sport_bench.py zones|run|compare` funziona;
      test di `tools/` verdi in CI.
- [ ] A: `docs/sports/` con README, CONDIVISO, COME-AGGIUNGERE (bozza) e le
      misure di base di corsa, bici e canoa.
- [ ] A: ADR-0320 scritto.
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

Parte B: la lista va al Coordinatore prima del codice.

## Dove si è

2026-11-04: banco scritto e provato (14 test, uno sul motore vero col grafo
di Levico). Misure di base in attesa del turno del Coordinatore.
