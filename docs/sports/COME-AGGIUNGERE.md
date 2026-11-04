# Come si aggiunge uno sport

> **Bozza** (TASK-376 parte A). Oggi uno sport tocca file condivisi da
> tutti: questa è la ricetta della struttura di oggi, ricavata dalla bici
> (TASK-190) e dalla camminata (TASK-371). Dopo la parte B di TASK-376 (il
> registro, ADR-0320) diventa «file nuovi più una riga per registro» e
> questo file si riscrive.

## 0. Prima del codice

1. Numeri di task e ADR dal Coordinatore; il Coordinatore Sport scrive i
   «File toccati» in `docs/AGENTI.md` prima di aprire la sessione.
2. Leggi `docs/sports/CONDIVISO.md` e i file degli sport vicini.
3. **Misura** con il banco (`docs/sports/README.md`), col turno del
   Coordinatore: la rete sulle sei zone e le forme del catalogo alle
   distanze proposte. Se la rete non è nel motore, provala con `--loader`.
   Scrivi i risultati in `docs/sports/<sport>.md`.
4. Proposta all'utente, **una domanda per volta**: nome, emoji, distanze,
   cosa si promette, se conta nel gioco e nei record. Sono scelte di
   prodotto: nessuna sessione le decide.

## 1. Motore (`services/route-engine/`)

- `models.py`: l'attività in `SUPPORTED_ACTIVITIES` e `DISTANCE_LIMITS_M`
  (e in `WATER_ACTIVITIES` se è sull'acqua).
- `network.py`: in `NETWORKS` la rete su cui si disegna; una rete nuova ha
  nome, filtro Overpass in `FILTERS`, regole dei tag e il suo nome nel grafo
  (`check_network`). Riusare una rete esistente non crea file di cache
  nuovi (la camminata usa foot).
- Un modulo proprio per le regole dello sport (es. `walking.py` di
  TASK-371) invece di allargare quelli di altri.
- `engine.zip` dell'app rifatto se cambia il motore sul telefono.
- Test deterministici sul grafo piccolo di Levico o su grafi finti.
- **L'impronta del motore cambia**: notte di `draw_examples` col sì
  dell'utente, insieme ad altre modifiche del motore se possibile.

## 2. Contratto (`packages/shared-types/`)

- `API_ACTIVITIES` subito; `ACTIVITIES` (quelle dell'app) solo con la parte
  dell'app. `DISTANCE_LIMITS_M`. Fixture `route-request-<attività>.json` e
  il test di contratto (Python e TypeScript devono coincidere).

## 3. API e database (`services/api/`)

- `activities.py` (`RunActivity`), `strava.py` (`SPORT_TYPES`),
  `activity_graphs.py` (zone in memoria della rete), `schemas.py`,
  `run_gpx.py` / `export_gpx.py` (`<type>` del GPX), `personal_bests.py`
  se conta nei record.
- Migrazione col **primo numero libero in `main` al merge**: i vincoli
  `activity` di `favorites`, `runs`, `group_runs`.
- Il server col sì dell'utente.

## 4. App (`apps/mobile/`)

- `settings/sport.ts`: lo sport in `ALL_SPORTS`, `activityOf`,
  `withoutRouteLabel`.
- I punti che decidono in base all'attività (da cercare con
  `grep -rn '"cycling"\|activity ==='`): `route/RoutePanel.tsx`,
  `route/distance.ts`, `navigation/ride.ts`, `navigation/penUp.ts`,
  `navigation/useNavigation.ts`, `screens/RunPanel.tsx`,
  `screens/RunNoRouteButton.tsx`, `imports/fit.ts`, `imports/fileTrack.ts`,
  `social/PublicParts.tsx`, `profile/PersonalBests.tsx`, `feed/FeedPost.tsx`,
  `api/muwRoutes.ts`, `engine/zones.ts`, `engine/usePhoneZones.ts`,
  `engine/keptPlaces.ts`, gli allenamenti di Salute.
- Testi in `i18n` (en, it, de, fr, es) e nella voce, col sì dell'utente.
- Impronta iOS invariata se non c'è codice nativo.

## 5. Chiusura

- Banco di corsa, bici e canoa rifatto e confrontato con le misure di base
  (`compare`): niente peggioramenti.
- `docs/sports/<sport>.md` con le misure finali; le scoperte utili ad altri
  al Coordinatore Sport per `CONDIVISO.md`.
- Task file in Done, STATUS, DECISIONS.
