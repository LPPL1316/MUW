# TASK-378 — Gravel e MTB: la bici fuori dall'asfalto

**Stato**: In corso — parte 0 in `main` (#840) e scelte dell'utente
(2026-11-05); prossimo: la parte A, dopo il via del Coordinatore sulla lista
e il numero della migrazione.
**Fase**: 4 · **Branch**: `docs/TASK-378-0-gravel` (parte 0), poi
`feat/TASK-378-a-gravel-engine-api`, `feat/TASK-378-b-gravel-app` ·
**ADR**: ADR-0322 · numeri dal Coordinatore (2026-11-04) · sessione
dello sport, avviata dal «Coordinatore Sport»

## Obiettivo

Chi va in gravel o in mountain bike riceve un percorso che disegna la forma
**anche su sterrati, carrarecce e sentieri ciclabili**, dove la bici di oggi
scende e spinge. Lo pedala con passo, voce, salvataggio, Feed, Apple Salute,
Health Connect e Strava del suo sport.

È il secondo sport della fase 1 (TASK-376, ADR-0320), dopo il pilota
Escursionismo (TASK-377): file nuovi più una riga per registro, come dice
`docs/sports/COME-AGGIUNGERE.md`. Ogni altro file è una deroga, da scrivere
in `docs/sports/CONDIVISO.md`.

## Contesto

Richiesta dell'utente del 2026-11-04: Gravel/MTB fra gli sport della fase 1.

La bici di oggi (`cycling`, rete bike, ADR-0153 e ADR-0167) pedala già le
`track` di ogni tipo; i `path` solo se `bicycle=designated`, altrimenti li fa
**a piedi con la bici**, a 6 volte il costo. Gravel e MTB cambiano quali vie
si pedalano, non come il motore cerca la forma.

Da leggere: `docs/sports/COME-AGGIUNGERE.md`, `docs/sports/CONDIVISO.md`
(«Le reti»), `docs/sports/README.md` (il banco), `docs/sports/bike.md` (le
misure di base della bici), `docs/sports/gravel.md` (le misure di questo
task), ADR-0153, ADR-0167, ADR-0321 (il pilota).

## Cosa fare

### Parte 0 — misura e proposta (solo documenti)

1. Col banco, un comando per volta, `nice -n 10`, aspettando gli altri banchi
   e le suite: reti di prova con `--loader` (`out/TASK-378/loader.py`), senza
   toccare il motore. Rete e forme del catalogo a 10, 20 e 30 km, prima a
   Trento, poi sulle sei zone per le reti che reggono.
2. Quanto di ogni percorso è sterrato, a piedi con la bici e su strade
   principali (`out/TASK-378/mix.py`, dai controlli del motore).
3. Le misure in `docs/sports/gravel.md`, ADR-0322 in DECISIONS come
   «Proposto».
4. Le domande all'utente, una per volta, con una proposta già pronta:
   1. uno sport o due (Gravel e MTB);
   2. nome ed emoji;
   3. la rete;
   4. le distanze;
   5. il limite `mtb:scale`;
   6. gioco e record personali;
   7. i testi in en/it/de/fr/es;
   8. «ready».
5. Le risposte in una seconda PR di soli documenti: ADR-0322 «Accettato».
   Poi la lista della parte A al Coordinatore, con il numero della
   migrazione.

### Parte A — motore, contratto, API (dopo le scelte, in una sessione sua)

Dopo la #838 (377-A) in `main`: tocca gli stessi registri, e porta già
`__main__.py` e `anchored.py` a `OsmnxSource.for_activity`. La lista va al
Coordinatore, che dà il numero della migrazione (la prima libera era 0052
il 2026-11-05):

```
services/route-engine/route_engine/networks/mtb.py              (nuovo)
services/route-engine/route_engine/networks/__init__.py         (una riga)
services/route-engine/route_engine/networks/base.py, bike.py    (i sensi unici e i tratti a piedi come proprietà della rete)
services/route-engine/route_engine/network.py                   (one_way_streets dalla proprietà della rete)
services/route-engine/route_engine/activities/mountain_biking.py (nuovo)
services/route-engine/route_engine/activities/__init__.py       (una riga)
services/route-engine/route_engine/walking.py                   (gravel_biking disegnato come cycling, fuori impronta)
services/route-engine/tests/test_mountain_biking.py             (nuovo)
services/route-engine/tests/test_gravel_biking.py               (nuovo)
services/route-engine/tests/test_sport_registry.py
packages/shared-types/src/sports/gravel_biking.ts               (nuovo)
packages/shared-types/src/sports/mountain_biking.ts             (nuovo)
packages/shared-types/src/sports/index.ts                       (due righe)
packages/shared-types/fixtures/route-request-gravel_biking.json (nuovo)
packages/shared-types/fixtures/route-request-mountain_biking.json (nuovo)
packages/shared-types/fixtures/contract.json, reads.json, run-activities.json
packages/shared-types/test/gravelMtb.test.ts                    (nuovo)
packages/shared-types/test/sportRegistry.test.ts
services/api/shaperoute_api/sports/gravel_biking.py             (nuovo)
services/api/shaperoute_api/sports/mountain_biking.py           (nuovo)
services/api/shaperoute_api/sports/__init__.py                  (due righe)
services/api/shaperoute_api/activities.py                       (due nomi nel Literal)
services/api/shaperoute_api/personal_bests.py                   (due nomi nel Literal Sport)
services/api/shaperoute_api/reads.py                            (due righe)
services/api/migrations/0052_gravel_mtb.sql                     (nuovo, numero dal Coordinatore)
services/api/tests/test_gravel_mtb_api.py                       (nuovo)
services/api/tests/test_sport_registry_api.py
apps/mobile/assets/engine/engine.zip                            (rifatto, ultimo commit)
docs/tasks/TASK-378.md, docs/STATUS.md, docs/sports/CONDIVISO.md, docs/sports/gravel.md
```

- **Il gioco non cambia**: Gravel e MTB ne restano fuori come la bici, e
  `game_rules.py` non si tocca.
- **L'impronta del motore cambia** con la rete `mtb`. Server, migrazione e
  notte degli esempi si fanno solo col sì dell'utente.
- **Il Gravel non la cambia**: sta in `walking.py`, che è fuori impronta
  (`WALK_ONLY`).
- **Una zona `mtb` in memoria sul server** si aggiunge a quella della bici:
  la parte A misura quanto pesa (`activity_graphs.ZONES_IN_MEMORY`).

### Parte B — app (dopo A)

```
apps/mobile/src/sports/gravelBiking.ts, mountainBiking.ts      (nuovi)
apps/mobile/src/sports/index.ts                                (due righe)
apps/mobile/src/sports/gravelMtbProfile.test.ts                (nuovo)
apps/mobile/src/settings/sport.ts                              (due righe in ALL_SPORTS, activityOf, runActivityOf)
apps/mobile/src/imports/fit.ts, imports/fileTrack.ts           (i tipi gravel e MTB nei file importati)
apps/mobile/src/social/PublicParts.tsx                         (gli sport pubblicabili)
apps/mobile/src/route/RoutePanel.tsx                           (l'avviso sui sentieri tecnici, se Hike non l'ha già reso un campo del profilo)
apps/mobile/src/i18n/it.ts, de.ts, fr.ts, es.ts                (i testi approvati)
```

Apple `.cycling` (13) e Health Connect `EXERCISE_TYPE_BIKING` (8), da
verificare sulle librerie; l'energia segue il Compendium della bici (per la
MTB, «bicycling, mountain»). Solo JavaScript: l'impronta iOS non si muove.

## Scelte dell'utente

Una alla volta, ciascuna con la proposta dell'agente, il 2026-11-05. Tutte
come la proposta, tranne l'ultima:

1. **Uno sport o due**: due. **Gravel** si disegna sulla rete della bici,
   come la camminata su quella della corsa. **MTB** ha una rete sua.
2. **Nomi ed emoji**: «Gravel» 🚲 e «MTB» 🚵. «Bike» resta 🚴.
3. **Le reti**:
   - Gravel sulla rete bike di oggi: strade, ciclabili, ogni `track`; i
     sentieri si fanno a piedi con la bici.
   - MTB sulla rete `mtb` di `gravel.md`: in più i sentieri non chiusi alle
     bici.
   - Per tutte e due, `bicycle=no` e `access=private` restano fuori, e i
     sensi unici valgono come per la bici.
4. **Le distanze**: da 10 a 30 km per tutte e due, come la bici. A 30 km
   la MTB a volte non riesce (13 su 18 al banco). Allora il motore propone
   un'altra distanza, come fa già per la bici.
5. **La difficoltà dei sentieri MTB**: fino a `mtb:scale` S2. Un sentiero
   senza scala vale fino a `sac_scale` T2.
6. **Gioco e record**: come la bici. Fuori dal gioco delle forme, e ognuno
   ha i suoi record personali su 10, 20, 40, 50, 100 e 160 km, separati da
   quelli di Bike.
7. **I testi**, approvati come proposti. Il tono è quello dell'app («tu»,
   in tedesco «du»).

   | en | it | de | fr | es |
   |---|---|---|---|---|
   | Gravel | Gravel | Gravel | Gravel | Gravel |
   | MTB | MTB | MTB | VTT | MTB |
   | Trails can be technical: check the route before you set off. | I sentieri possono essere tecnici: controlla il percorso prima di partire. | Trails können technisch sein: Prüf die Route, bevor du losfährst. | Les sentiers peuvent être techniques : vérifie le parcours avant de partir. | Los senderos pueden ser técnicos: revisa la ruta antes de salir. |

   - Il pulsante per partire senza percorso riusa quello della bici, «Ride
     without a route», e i testi fra le parti e le lettere sono quelli della
     bici: nessun testo nuovo.
   - L'avviso sta sotto il percorso in «Disegna» quando lo sport è MTB.
8. **Quando si accendono**: appena pronti. La proposta era accenderli dopo
   una MTB in anteprima in una zona di montagna.
   - «ready» diventa vero quando il server ha la parte A (motore,
     migrazione, notte degli esempi) e l'app ha la parte B.
   - Server, migrazione, notte degli esempi e aggiornamento di produzione
     restano ciascuno col sì dell'utente.

**Deciso dall'agente su delega dell'utente**: i nomi delle attività nel
contratto sono `gravel_biking` e `mountain_biking`, con la forma in «-ing»
di quelle di oggi (`cycling`, `hiking`).

## Criteri di accettazione

- [x] 0: le misure delle reti sono in `gravel.md`; ADR-0322 è proposto.
- [x] 0: le scelte dell'utente sono scritte qui, una per una (2026-11-05).
- [ ] 0: la lista della parte A è al Coordinatore, con la domanda sul numero
      della migrazione.
- [ ] A: un percorso gravel/MTB sul grafo di prova pedala dove la bici
      spinge; test deterministici; corsa, bici e canoa invariate al banco
      (`compare`).
- [ ] B: lo sport si sceglie, si pedala, si salva e va in Salute; i testi
      sono in cinque lingue.

## File toccati

Parte 0:

```
docs/tasks/TASK-378.md     (nuovo)
docs/sports/gravel.md      (nuovo)
docs/DECISIONS.md          (solo ADR-0322, in fondo)
docs/STATUS.md             (righe proprie)
docs/INDEX.md              (una riga)
```

Lista approvata dal Coordinatore il 2026-11-05. Seconda PR (le scelte): gli
stessi file. Parti A e B: le liste sopra.

## Dove si è

2026-11-05: il Coordinatore ha approvato la lista, e ho misurato col banco
dopo i giri di 377-A, un comando per volta e `nice -n 10`:

- **`gravel`** (`track` fino a grade3, sentieri con la bici ammessa): 54 su
  54, come la bici, e con lo stesso sterrato. Non cambia i percorsi.
- **`mtb`** (ogni `track`, sentieri fino a `mtb:scale` 2): 49 su 54, 24
  buoni; a piedi con la bici dal 4,9% all'1,4% dei km.
- **Provate solo a Trento**: senza strade principali, e l'asfalto che costa
  2 o 4 volte. Non servono.

Le misure sono in `gravel.md`, e ADR-0322 è scritto come proposto.

2026-11-05: la parte 0 è in `main` (#840). Le scelte dell'utente, una alla
volta:

1. due sport;
2. «Gravel» 🚲 e «MTB» 🚵;
3. le reti proposte;
4. da 10 a 30 km;
5. fino a S2;
6. come la bici, con record propri;
7. i testi;
8. accesi appena pronti.

ADR-0322 accettato. Prossimo: la lista della parte A al Coordinatore, col
numero della migrazione, dopo la #838.
