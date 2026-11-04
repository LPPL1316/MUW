# TASK-375 — La categoria «Record only»: sport che si registrano senza forma

**Stato**: Proposto · bozza; nessun codice prima delle risposte alle
domande aperte e dei «File toccati» mandati al Coordinatore
**Fase**: 5 · **Branch**: `docs/TASK-375-record-only` (documenti); il
codice `feat/TASK-375-a-…`
**Dipende da**: nulla. Lo sci alpino (TASK-373, ADR-0317) è il primo sport
che la usa; lo sci di fondo (TASK-372) solo se l'utente lo sceglie così
**ADR**: ADR-0319 (proposto)

## Obiettivo

Uno sport «Record only» si sceglie in MuW come gli altri, ma non ha forme:
«Draw» apre la registrazione libera della giornata (TASK-220) e alla fine
mostra le metriche di quello sport, il percorso sulla mappa e il post nel
Feed. La categoria serve a non riscrivere la stessa cosa per ogni sport
senza forme.

## Scelte dell'utente

- 2026-11-04, domanda 2 di TASK-373: «Prima la categoria». La categoria è
  un task a parte e lo sci alpino è il suo primo sport.
- 2026-11-04, domanda 3: «Sì, separati». Lo sci alpino si chiama «Ski» ⛷️
  (Sci, Ski, Ski, Esquí) ed è uno sport distinto dallo sci di fondo
  (TASK-372).
- 2026-11-04, domanda 4: «Sì, tutte». A fine giornata di sci alpino:
  numero di discese, km sciati (solo le discese), dislivello sciato,
  velocità massima e media in km/h, impianti e piste usati con il nome e
  quante volte (dalle linee di OSM); sulla mappa le discese piene e le
  risalite tratteggiate.

## Vincoli (dal Coordinatore, 2026-11-04)

- L'impronta del motore resta neutra: «Record only» non pianifica, il
  Route Engine non cambia.
- L'impronta iOS resta 6f8bba4c: niente moduli nativi nuovi, si va con un
  aggiornamento OTA.
- La migrazione dei CHECK è una sola, 0044, per `skiing` e `xc_skiing`;
  se la categoria ne vuole una sua, il numero (0045) si chiede al
  Coordinatore.
- Lo sci di fondo entra anche lui: l'utente di TASK-372 ha scelto «Record
  only» (2026-11-04). Accordo con TASK-372: questo task aggiunge `skiing`
  e `xc_skiing` in un passaggio solo (shared-types, API, migrazione 0044,
  `sport.ts`, testi in tutte le lingue); TASK-372 resta di sola
  documentazione (ADR-0316, niente rete «nordic»). Il nome del fondo,
  proposto «Cross-country ski», si chiede all'utente con i testi.

## Domande aperte (una alla volta)

4. Le metriche e la mappa: discese, km sciati, dislivello, velocità
   massima e media in km/h, impianti usati e piste fatte con il nome
   (dalle linee di OSM); risalite tratteggiate.
5. Dopo: dove c'è la neve buona (proposta: segnalazioni degli sciatori di
   MuW; le previsioni solo con un abbonamento a pagamento) e le recensioni
   dei comprensori (in conflitto con la regola dei soli commenti positivi,
   TASK-213).

## Il disegno tecnico (deciso dall'agente su delega dell'utente)

- **Un tipo a parte.** In `shared-types` nasce `RECORD_ACTIVITIES =
  ["skiing", "xc_skiing"]` con il tipo `RecordActivity`, e `RunActivity`
  = `ApiActivity | RecordActivity` per ciò che si salva. `Activity` e
  `ApiActivity` non cambiano: le tabelle dell'app chiavate su `Activity`
  (distanze, reti del motore, filtri) restano come sono, e una richiesta di
  percorso con `skiing` resta un errore. Così il motore non si tocca.
- **Il server salva soltanto.** La migrazione 0044 allarga il CHECK di
  `runs` a `skiing` e `xc_skiing`; `favorites` e `group_runs` no, perché
  tengono un percorso da rifare e qui non ce n'è. `RunActivity` dell'API e
  la tabella di Strava (`AlpineSki`, `NordicSki`) si allargano.
- **Nell'app** gli sport «Ski» e quello del fondo hanno `recordOnly: true` in
  `sport.ts`: «Draw» apre la registrazione libera di TASK-220 invece della
  pagina delle forme; la fine giornata e il post usano le metriche dello
  sport; Apple Salute e Health Connect ricevono «Downhill Skiing» e
  «Cross Country Skiing» con una tabella nuova accanto a quelle di oggi.
- **Le risalite** si riconoscono sul telefono, in un file TypeScript puro e
  testato: un tratto che sale a velocità costante per più di un minuto è un
  impianto. Si taravano su tracce vere prima della stagione.
- **I nomi di impianti e piste** li dà il server (parte D), confrontando la
  traccia salvata con le linee `aerialway` e `piste:type=downhill` di OSM
  già caricate per zona, così la posizione non va a servizi esterni.

## Le parti

| Parte | Cosa | Server o testi |
|---|---|---|
| A | API: migrazione 0044, `RunActivity`, Strava, contratto, test | server con il sì dell'utente |
| B | App, la categoria: `recordOnly`, «Draw» alla registrazione libera, salute, etichetta nel Feed, nascosta nelle build di negozio finché non è pronta | testi con il sì dell'utente |
| C | Le metriche dello sci: discese, km, dislivello, velocità massima e media, risalite tratteggiate; per il fondo km, passo e salita | testi con il sì dell'utente |
| D | Impianti e piste per nome, sul server | server e riga privacy con il sì dell'utente |
| E | La prova sul campo: 6 ore di GPS in background, batteria al freddo | — |

A e B si possono fare in parallelo; C dopo B; D dopo A; E con la neve.

## File toccati

Questa PR (documenti): `docs/tasks/TASK-375.md` (nuovo), `docs/DECISIONS.md`
(ADR-0319), `docs/STATUS.md` (una voce), `docs/INDEX.md` (una riga).

Parte A (approvata dal Coordinatore il 2026-11-04):
`packages/shared-types/src/index.ts`,
`packages/shared-types/fixtures/run-activities.json` (nuovo),
`packages/shared-types/test/runActivities.test.ts` (nuovo; `contract.json`
no, perché il `test_contract.py` del motore confronta il contratto intero),
`services/api/migrations/0044_record_only.sql` (nuovo),
`services/api/shaperoute_api/activities.py`,
`services/api/shaperoute_api/strava.py`, `services/api/tests/test_strava.py`,
`services/api/tests/test_record_only.py` (nuovo), `docs/API.md`,
`docs/DATABASE.md`.

Parte B: `apps/mobile/src/settings/sport.ts`,
`apps/mobile/src/navigation/freeSport.ts`,
`apps/mobile/src/navigation/useFreeRun.ts`,
`apps/mobile/src/health/recordWorkout.ts` (nuovo),
`apps/mobile/src/health/appleWorkout.ts`,
`apps/mobile/src/health/healthConnectWorkout.ts`,
`apps/mobile/src/activities/activityText.ts`, il punto di «Draw» che apre
la pagina delle forme (da trovare all'inizio di B), i file di
`apps/mobile/src/i18n/` e i test nuovi accanto. La lista precisa si manda
al Coordinatore prima di B.

Parti C–E: si elencano prima di ciascuna.

## Criteri di accettazione

- [x] La domanda 3 ha una risposta scritta qui.
- [x] La domanda 4 ha una risposta scritta qui.
- [ ] I «File toccati» della parte A sono approvati dal Coordinatore.
- [ ] Ogni parte ha test deterministici; l'impronta del motore e quella
  iOS (6f8bba4c) non cambiano.
