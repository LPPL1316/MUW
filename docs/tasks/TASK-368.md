# TASK-368 — I record personali nel Profilo, a piedi e in bici

**Stato**: Done — parte A #721, parte B #723 (2026-11-04); il backfill sul server lo lancia l'utente; privacy sul sito e OTA col suo sì
**Fase**: 4 · **Branch**: `docs/TASK-368-personal-bests` (documenti),
`feat/TASK-368-a-personal-bests-api` (parte A), `feat/TASK-368-b-personal-bests-app`
(parte B) · **ADR**: ADR-0312 · numeri dal Coordinatore (2026-11-02)

## Obiettivo

Nel Profilo, sotto i totali, i **record personali** («best effort»): il tempo
più veloce su ogni distanza, preso dal tratto migliore dentro qualsiasi
attività salvata, come fa Strava. A piedi e in bici, ognuno con le sue
distanze. La richiesta è dell'utente (2026-11-02, durante TASK-367).

## Contesto da leggere

- `docs/API.md`, «Profile»; `profile_totals.py` (TASK-324, ADR-0284): i totali
  contano già le corse private.
- `activities.py`: come si salva una corsa (`recorded`, le pause, `track`).
- Migrazioni 0003 (`runs.track` `LineStringM`, M = secondi dal primo punto,
  pause comprese; `pauses`), 0014 (`drawings.activity`), 0034 (`runs.source`).
- `profile/ProfileStats.tsx`, `profile/ProfileHome.tsx`,
  `screens/UserProfilePage.tsx`.
- ADR-0170: le foto dei disegni «Only me» restano sul telefono; le corse no.

## Cosa c'è oggi

Letto il codice di `main` (`513bcb6c`) il 2026-11-02.

- Ogni corsa salvata con «Save» da un account arriva al server con la traccia
  intera, ogni punto con il suo tempo, e le pause, qualunque sia la sua
  visibilità. Restano fuori solo le corse senza account. Il Coordinatore l'ha
  verificato con questa sessione.
- Lo sport sta in `drawings.activity` (`running`, `cycling`, `paddling`).
- Le attività importate da file (TASK-312) sono `runs.source = 'file'`, con la
  stessa traccia a tempi.
- Nessun record personale da nessuna parte, né nell'app né sul server.

## Scelte dell'utente

Una alla volta, con le sue parole.

1. **Le distanze a piedi**: 5K, 10K, 15K, mezza maratona (21,0975 km), 30K,
   maratona (42,195 km), 60K.
   — *Risposta:* «Sì, con la maratona».
2. **Gli sport.** Proposta: solo la corsa (con e senza percorso).
   — *Risposta:* «Sì, solo corsa», poi: «per la bici fanne altri».
3. **Le distanze in bici**: 10, 20, 40, 50, 100, 160 km (cento miglia). La canoa
   no.
   — *Risposta:* «Sì, queste».
4. **Quali attività contano.** Proposta: tutte quelle salvate dall'account,
   private, di gruppo e importate.
   — *Risposta:* «tutte anche quelle importate», «e anche le private tutte».
5. **Chi vede i record.** Proposta: solo il proprietario.
   — *Risposta:* «Anche gli altri».
6. **Cosa vedono gli altri.** Proposta: solo il tempo.
   — *Risposta:* «Anche data e corsa».
7. **Un record fatto in un'attività che chi guarda non può vedere** (`only_me`,
   o `followers` per chi non segue). Proposta: tempo e data visibili, la corsa
   non si apre; chi può vedere l'attività la apre come sempre. L'alternativa
   era mostrare agli altri il migliore fra le attività che possono vedere.
   — *Risposta:* «Sì, corsa chiusa».
8. **Come si misura.** Proposta: il tratto più veloce dentro ogni attività;
   tempo in movimento, pause escluse; i pezzi con un salto del GPS (più di
   25 km/h a piedi, più di 90 km/h in bici fra due punti) non contano, il resto
   sì; un tempo sotto il record del mondo della distanza si scarta; cancellata
   un'attività, i suoi record passano alla migliore dopo.
   — *Risposta:* «Sì, così».
9. **I testi della Guida e della privacy.** Oggi dicono che gli altri vedono
   «solo i totali… mai le corse». In italiano, le parti nuove fra `**`:
   - Guida: «Gli altri iscritti vedono sul tuo profilo i totali di tutte le tue
     corse salvate, distanza e dislivello, **e i tuoi record (il 5K, il 10K e
     le altre distanze più veloci, a piedi e in bici) con il tempo e la data.
     Una corsa privata resta chiusa anche quando contiene un record.**»
   - Privacy: «Gli altri iscritti vedono sul tuo profilo i totali di tutte le
     tue corse salvate, distanza e dislivello, **e i tuoi record, a piedi e in
     bici, con il tempo e la data in cui li hai fatti: anche quelli di una
     corsa privata, che però non si apre.**»
   Inglese, tedesco, spagnolo e francese uguali nel senso, nella parte B. La
   data nuova della privacy e la copia sul sito si pubblicano col sì
   dell'utente.
   — *Risposta:* «Sì, approvo».

10. **I testi nuovi del Profilo** (parte B): il titolo «Record personali»
    (en «Personal bests», de «Persönliche Bestzeiten», es «Mejores marcas», fr
    «Records personnels»), «Mezza maratona» («Half marathon», «Halbmarathon»,
    «Media maratón», «Semi-marathon»), «Maratona» («Marathon», «Marathon»,
    «Maratón», «Marathon»). I gruppi riusano «Corsa» e «Bici»; a piedi i nomi
    delle gare (5K, 10K…), in bici sempre i chilometri («40 km»).
    — *Risposta:* «Sì, approvo» (2026-11-04).

## Cosa fare

Il codice parte col via del Coordinatore, dopo TASK-367 A: l'app tocca il
Profilo, che è anche di 367 e 339 D.

### Parte A — il calcolo e l'API

1. `personal_bests.py` (nuovo), puro e testabile senza database: dalla traccia
   (punti con M) e dalle pause, il tempo più veloce per ogni distanza dello
   sport. Due indici che scorrono sulla traccia, la distanza cumulata in metri
   su piano proiettato, interpolazione al metro esatto della distanza, il tempo
   delle pause dentro il tratto tolto. Un tratto con un salto del GPS non conta;
   un tempo sotto il record del mondo si scarta (tabella nel modulo, con la
   fonte).
2. Una tabella di cache, `personal_bests` (account, sport, distanza, secondi,
   corsa, giorno di partenza): una riga per record. Si aggiorna al salvataggio,
   alla modifica e alla cancellazione di un'attività, e all'importazione.
   Migrazione: numero dal Coordinatore al merge (la 0040 è del nuoto).
3. Uno script una tantum che riempie la cache dalle corse già salvate, da
   lanciare sul server col sì dell'utente.
4. `GET /users/{public_id}` porta `personal_bests`: per ogni record sport,
   distanza, secondi, giorno, e la chiave della corsa solo se chi chiede può
   vederla (`shown_sql`); assente con un'API di prima. Il proprietario vede
   tutte le sue chiavi.
5. Tempi del calcolo su molte attività lunghe (maratone, 160 km in bici, tracce
   da 1 punto al secondo) in `out/TASK-368/bench.txt`.
6. `shared-types`, fixture, `docs/API.md` «Profile», `docs/DATABASE.md`.

### Parte B — il Profilo

1. `profile/PersonalBests.tsx` (nuovo): sotto `ProfileStats`, due gruppi
   («Running», «Cycling») mostrati solo se hanno almeno un record; per ogni
   distanza il tempo e la data; il tocco apre la corsa se c'è la sua chiave.
   Le distanze senza record non si mostrano.
2. Nel proprio Profilo e in quello degli altri (`UserProfilePage`).
3. Testi nuovi nelle cinque lingue, da approvare con il codice: il titolo, i
   nomi delle distanze («Half marathon», «Marathon»).
4. La Guida e la privacy (scelta 9) in cinque lingue, la data della privacy,
   la copia sul sito (`site/privacy/**`, F.14).

## Criteri di accettazione

- [ ] Test del calcolo: una traccia di 10 km esatti, un 10K dentro un 25 km,
      interpolazione, una pausa dentro il tratto, un salto del GPS, un tempo
      sotto il record del mondo, una traccia più corta della distanza.
- [ ] Test dell'API: privata, `followers` per chi segue e per chi no, importata,
      di gruppo; chiave della corsa solo a chi può vederla; un blocco; una
      cancellazione che passa il record alla seconda migliore.
- [ ] Solo `running` e `cycling`, ognuno con le sue distanze; `paddling` mai.
- [ ] I tempi su molte attività lunghe nella PR.
- [ ] Nessun colore a mano, testi approvati in cinque lingue, nessuna
      dipendenza nuova, impronta iOS invariata.
- [ ] Server, migrazione, script, privacy sul sito e OTA solo col sì
      dell'utente.

## File toccati

Questa PR:

```
docs/tasks/TASK-368.md                (nuovo)
docs/DECISIONS.md
docs/STATUS.md
docs/INDEX.md
```

Parte A (lista aggiornata il 2026-11-04 con il codice):

```
services/api/shaperoute_api/personal_bests.py              (nuovo: il calcolo)
services/api/shaperoute_api/profile_bests.py               (nuovo: la lettura del profilo)
services/api/shaperoute_api/personal_bests_backfill.py     (nuovo: lo script una tantum)
services/api/shaperoute_api/activities.py
services/api/shaperoute_api/profiles.py
services/api/migrations/0042_run_bests.sql                 (nuovo)
services/api/tests/test_personal_bests.py                  (nuovo)
services/api/tests/test_profiles.py                        (il corpo esatto del profilo)
packages/shared-types/src/index.ts, test/accounts.test.ts
packages/shared-types/fixtures/public-profile.json, personal-bests.json (nuovo)
docs/API.md, docs/DATABASE.md, docs/DECISIONS.md, docs/STATUS.md, docs/tasks/TASK-368.md
```

L'importazione passa da `PUT /me/activities/{key}` come ogni corsa: nessun
`imports*.py`. Lo script è un modulo come `game_backfill`, non in `scripts/`.

Parte B:

```
apps/mobile/src/profile/PersonalBests.tsx, .test.tsx       (nuovi)
apps/mobile/src/profile/ProfileHome.tsx
apps/mobile/src/profile/UserProfilePage.tsx
apps/mobile/src/activities/activitiesDoor.ts               (open legge solo l'id)
apps/mobile/src/i18n/*.ts
apps/mobile/src/about/content/*.ts
site/privacy/**, site/tests/privacy.test.mjs
docs/UI.md, docs/STATUS.md, docs/tasks/TASK-368.md
```

## Fuori scope

- La canoa, il nuoto, la potenza in bici.
- Un record segnalato all'utente a fine corsa («Nuovo record!»): un task a
  parte, se lo vuole.
- Nascondere i record dal profilo pubblico con un interruttore: non chiesto.

## Esito

**Parte A** (2026-11-04): calcolo, tabella `run_bests` (migrazione 0042),
`personal_bests` in `GET /users/{public_id}`, script una tantum. Tempi: meno
di 10 ms per corsa anche a 25 000 punti; la lettura del profilo circa 10 ms a
1000 corse (`out/TASK-368/bench.txt` e la PR). Server, migrazione e script
col sì dell'utente; la parte B (il Profilo nell'app) dopo.

**Parte B** (2026-11-04): `profile/PersonalBests.tsx` sotto i totali, nel
proprio Profilo e in quello degli altri; il tocco apre la corsa (il disegno
per chi può vederlo, «My activities» per il proprietario). Testi approvati
(scelta 10), Guida e privacy nelle cinque lingue, copia del sito rifatta con
`site/tools/make_privacy.mjs` (la pubblicazione col sì dell'utente).
Simulatore con dati di prova, scuro e chiaro: `docs/tasks/TASK-368/`. I
record si vedono davvero solo dopo il server con la 0042 e il backfill.
