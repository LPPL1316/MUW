# Come si aggiunge uno sport

> TASK-376 parte C (ADR-0320), sulla struttura della parte B: ogni sport sta
> nei suoi file, e i file condivisi ne ricavano le tabelle. Uno sport nuovo
> è fatto di **file nuovi più una riga per registro**, e di pochi punti
> ancora scritti a mano, che qui sono elencati uno per uno. Se un passo non
> va come scritto, la deroga va in `CONDIVISO.md` e questa ricetta si
> corregge.

## 0. Prima del codice

1. **Numeri.** Il Coordinatore dà i numeri di task, ADR e migrazione.
   Il Coordinatore Sport manda la lista dei «File toccati» prima del codice.
2. **Letture.** Leggi `CONDIVISO.md` e il file `docs/sports/<sport>.md`
   degli sport vicini.
3. **Misura** con il banco (`README.md`), al turno del Coordinatore. Usa
   `nice -n 10`, lancia un comando per volta e aspetta se ci sono suite
   lunghe in corso. Misura la rete sulle sei zone e le forme del catalogo
   alle distanze proposte. Una rete che il motore non ha ancora si prova con
   `--loader`, senza toccare il motore. I risultati vanno in
   `docs/sports/<sport>.md`.
4. **Proposta all'utente**, una domanda per volta: nome, emoji, distanze,
   cosa si promette, se conta nel gioco e nei record, i testi, quando si
   accende («ready»). Sono scelte di prodotto: nessuna sessione le decide.
5. **I pezzi.** Si va per strati, una PR ciascuno: A per motore, contratto
   e API; B per l'app. Così i file restano bloccati poco.

## 1. Motore (`services/route-engine/route_engine/`)

File nuovi:

- `activities/<sport>.py`: un `Activity` (`activities/base.py`) con nome,
  distanze, rete, e se è sull'acqua o vi si disegna.
- Se la rete è nuova, `networks/<rete>.py`: un `Network` (`networks/base.py`)
  con nome, filtro Overpass, regole dei tag e download. Riusare una rete
  esistente non crea file di cache nuovi: la camminata usa `foot`.
- `tests/test_<sport>.py`: test deterministici sul grafo piccolo di
  Levico o su grafi finti.

Righe nei registri:

- `activities/__init__.py`: lo sport in `ENGINE_ACTIVITIES`, nell'ordine
  del contratto. `models.py` e `network.py` ne ricavano
  `SUPPORTED_ACTIVITIES`, `DISTANCE_LIMITS_M` e `NETWORKS`.
- `networks/__init__.py`: la rete in `NETWORKS_BY_NAME`, se è nuova.

Punti fissi:

- **La prima rete nuova.** `__main__.py` e `anchored.py` scelgono ancora la
  rete con un `if` sulla bici: la prima rete nuova li passa a
  `OsmnxSource.for_activity` (vedi `CONDIVISO.md`, «Il motore»).
- **`engine.zip` dell'app** si rifà come ultimo commit, dopo il
  riallineamento su `main`:
  `python tools/phone_engine/phone_engine.py engine`. Se git segnala un
  conflitto sullo zip, non lo risolvi: lo rigeneri dai sorgenti uniti.
- **L'impronta del motore cambia** se cambia ciò che il motore disegna.
  Serve una notte di `draw_examples`, col sì dell'utente.
  `SAME_ROUTES_AS` vale solo per un motore che ha spostato codice senza
  cambiare i percorsi (`test_same_routes.py`).
- **Uno sport fuori dall'impronta** si tiene in un modulo a parte, come
  `walking.py` (`WALK_ONLY`): così gli esempi già disegnati restano validi.

## 2. Contratto (`packages/shared-types/`)

File nuovi:

- `src/sports/<sport>.ts`: uno `PlannedSport` (attività e `distanceM`),
  oppure un `RecordedSport` (`recordOnly`), oppure un `TracklessSport`
  come la palestra. Si scrive `{ … } as const satisfies …`, così i tipi
  restano letterali.
- `fixtures/route-request-<sport>.json`, se lo sport si disegna: il test di
  contratto vuole che Python e TypeScript coincidano.

Righe nei registri:

- `src/sports/index.ts`: una riga in `PLANNED_SPORTS`, `RECORDED_SPORTS` o
  `TRACKLESS_SPORTS`. Il file `src/index.ts` ne ricava `ACTIVITIES`,
  `RECORD_ACTIVITIES`, `RUN_ACTIVITIES` e `DISTANCE_LIMITS_M`.

Gli import del contratto hanno l'estensione `.ts`, perché lo vuole
`node --test`.

## 3. API e database (`services/api/`)

File nuovi:

- `shaperoute_api/sports/<sport>.py`: un `ApiSport` (`sports/base.py`) con:
  - il tipo Strava;
  - la frase della descrizione per l'AI;
  - `record_only`;
  - le zone: il box e i nomi delle strade, se va su strada;
  - i record (`SportBests`), se conta nei record;
  - il `<type>` del GPX.

  Il modulo importa solo `shaperoute_api.sports`: va sul telefono dentro
  `engine.zip`.
- `migrations/00NN_<sport>.sql` (numero dal Coordinatore): allarga i CHECK
  `activity` di `runs` e, se lo sport si disegna, di `favorites` e
  `group_runs`. Il CHECK si legge e si allarga, non si riscrive: guarda
  `0047_gym.sql`. Una migrazione già in `main` non si modifica mai.
- `tests/test_<sport>_api.py`.

Righe nei registri:

- `sports/__init__.py`: lo sport in `API_SPORTS`, nell'ordine del contratto.
  Da lì si ricavano:
  - `strava.SPORT_TYPES`;
  - `activities.RECORD_ACTIVITIES`;
  - `run_gpx.GPX_TYPES`;
  - `prefetch_zones.ZONE_BOXES` e `STREET_NAMES`;
  - `activity_graphs.ZONES_IN_MEMORY`;
  - `personal_bests.SPORTS`;
  - `schemas.ACTIVITY_DESCRIPTION`.

Punti fissi, scritti a mano:

- **Literal.** Un nome in `activities.RunActivity` e, se lo sport conta nei
  record, in `personal_bests.Sport`. `test_sport_registry_api.py` segnala
  quando non coincidono con il registro.
- **`reads.py`**: le attività che una lettura accetta.
- **`game_rules.py` e `themes.py`**, solo se lo sport entra nel gioco e
  nelle sfide.
- **Il server** si aggiorna col sì dell'utente: comandi dell'utente o del
  Coordinatore.

## 4. App (`apps/mobile/`)

File nuovi:

- `src/sports/<sport>.ts`: un `SportProfile` (`src/sports/base.ts`). Di
  solito servono questi campi:
  - nome (`tLater`) ed emoji;
  - distanze di «Disegna», con passo e partenza;
  - i numeri di Apple Salute e Health Connect;
  - rete sul telefono ed energia;
  - `freeRunAs`, cioè cosa diventa una corsa senza percorso;
  - il passo e la scritta delle rotte MuW.

  Servono solo se lo sport li ha: `shapesOnly`, `noWords`, `laps`,
  `timeAt`, i testi `partsBetween` e `lettersBetween`, `bests`, `skied`,
  `onWater`. Un file di sport importa solo il contratto, `../i18n`, il tipo
  `Limits` e `./base`: lo prova `sportProfiles.test.ts`.
- Un test del profilo, nuovo.

Righe nei registri:

- `src/sports/index.ts`: lo sport in `SPORT_PROFILES`, nell'ordine di
  `RUN_ACTIVITIES`. Da lì si ricavano:
  - le distanze;
  - Salute;
  - le etichette della ricerca;
  - le reti sul telefono;
  - le calorie;
  - la corsa libera;
  - le rotte MuW;
  - «Disegna», il Feed, i record, il pannello della corsa;
  - il nome nel modulo per pubblicare.

Punti fissi, scritti a mano:

- **`settings/sport.ts`**: la riga in `ALL_SPORTS` (id, emoji, nome,
  `ready`), `activityOf` e `runActivityOf`.
- **`imports/fit.ts` e `imports/fileTrack.ts`**: il tipo dello sport nei
  file FIT, GPX e TCX importati.
- **`route/runTime.ts`**: il tempo stimato, se usa il passo a piedi.
- **`social/PublicParts.tsx`**: la lista degli sport pubblicabili.
- **I testi** nelle tabelle `i18n` (`it.ts`, `de.ts`, `fr.ts`, `es.ts`): il
  file dello sport tiene la chiave inglese. Testi, voce e «ready» vogliono
  il sì dell'utente.
- **L'impronta iOS** resta invariata se non c'è codice nativo. Si misura
  su una copia pulita (`npm ci`, `APP_VARIANT=production`), una sessione
  alla volta.

## 5. Chiusura

- Il banco di corsa, bici e canoa si rifà se è cambiato il motore, e si
  confronta con le misure di base con `compare`: nessun peggioramento.
- `docs/sports/<sport>.md` con le misure finali. Le scoperte utili ad altri
  vanno al Coordinatore Sport, per `CONDIVISO.md`.
- **Il confronto con la ricetta.** Il diff delle PR dello sport si
  confronta con le sezioni 1–4: solo file nuovi, righe nei registri e i
  punti fissi elencati. Ogni altro file è una deroga: va in `CONDIVISO.md`,
  e qui si corregge la ricetta o si porta quel punto nel registro.
- Task file in Done, STATUS e DECISIONS.
