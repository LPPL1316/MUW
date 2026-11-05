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
- 2026-11-04, il nome dello sci di fondo nell'app: «Cross-country ski»
  (proposto con 🎿; le traduzioni con gli altri testi della parte B).
- 2026-11-04, domanda 4: «Sì, tutte». A fine giornata di sci alpino:
  numero di discese, km sciati (solo le discese), dislivello sciato,
  velocità massima e media in km/h, impianti e piste usati con il nome e
  quante volte (dalle linee di OSM); sulla mappa le discese piene e le
  risalite tratteggiate.
- 2026-11-04, i testi della parte B: «Sì, approvati».

  | Dove | en · it · de · fr · es |
  |---|---|
  | Sport | «Ski» ⛷️ · Sci · Ski · Ski · Esquí |
  | Sport | «Cross-country ski» 🎿 · Sci di fondo · Langlauf · Ski de fond · Esquí de fondo |
  | Pulsante in «Draw» | «Record your day» · Registra la giornata · Tag aufzeichnen · Enregistrer la journée · Registra tu jornada |
  | Riga sotto | «No shapes on the slopes: MuW records your day.» · Niente forme sulle piste: MuW registra la tua giornata. · Keine Formen auf der Piste: MuW zeichnet deinen Tag auf. · Pas de formes sur les pistes : MuW enregistre ta journée. · Sin formas en las pistas: MuW registra tu jornada. |

  Nel Feed e nell'elenco delle attività lo sport ha lo stesso nome.
- 2026-11-04, la giornata sulla neve nel Feed (parte B2): «Sì, così». È un
  post come gli altri: la scheda dice Ski o Cross-country ski con i suoi
  numeri, ha commenti, reazioni e «Share» sui propri. Non ha le azioni da
  percorso: niente «Draw it near me», niente «Start» sul disegno di un
  altro, niente «Edit the drawing», niente invio come disegno in un
  messaggio. Il cuore sta solo sui percorsi; l'export GPX resta.
- 2026-11-05, i testi della parte C: «Sì, approvati».

  | Dove | en · it · de · fr · es |
  |---|---|
  | Titolo sulla mappa | «Your day» · La tua giornata · Dein Tag · Ta journée · Tu jornada |
  | Riga sotto (C1) | «White: where you skied.» · Bianco: dove hai sciato. · Weiß: wo du gefahren bist. · Blanc : là où tu as skié. · Blanco: donde esquiaste. |
  | Riga sotto (C2, con gli impianti tratteggiati) | «White: your descents. Dashed: the lifts.» · Bianco: le discese. Tratteggio: gli impianti. · Weiß: deine Abfahrten. Gestrichelt: die Lifte. · Blanc : tes descentes. Pointillés : les remontées. · Blanco: tus descensos. Discontinuo: los remontes. |
  | Casella | «Descents» · Discese · Abfahrten · Descentes · Descensos |
  | Casella | «Vertical» · Dislivello · Höhenmeter · Dénivelé · Desnivel |
  | Casella | «Top speed» · Vel. max · Höchsttempo · Vitesse max · Vel. máx. |
  | Casella | «Lifts» · Risalite · Liftfahrten · Remontées · Remontes |
  | VoiceOver dei km | «Skied: {distance}» · Sciati: {distance} · Gefahren: {distance} · Skié : {distance} · Esquiado: {distance} |

  Lo sci alpino: in grande i km delle sole discese; sotto discese,
  dislivello sciato, velocità massima e media (km/h, mph con le miglia),
  risalite e tempo. Il fondo: distanza, passo medio, dislivello in salita e
  tempo, etichette che l'app ha già. Niente calorie sulla neve.

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

## La parte D — proposta (2026-11-05, «INIZIA LA PARTE D» dell'utente)

Cosa vede chi scia: sotto la giornata, l'elenco degli impianti presi e
delle piste fatte, con il nome e quante volte («Seggiovia Col Raiser ×3»).
È la metrica scelta il 2026-11-04 («Sì, tutte»), l'unica rimasta.

Il disegno tecnico (deciso dall'agente su delega dell'utente, da
confermare con le risposte qui sotto):

- **I dati da un estratto, non da Overpass.** Overpass rifiuta il server
  (ADR-0154). Come l'acqua (TASK-225), un comando una tantum filtra
  l'estratto Geofabrik con `osmium tags-filter w/aerialway
  w/piste:type=downhill` e scrive un file compatto per comprensorio
  (linea, nome, tipo d'impianto o colore della pista). Nessuna rete
  quando si salva una giornata.
- **Il confronto sul server, alla lettura della giornata salvata.** La
  traccia è già sul server quando la giornata si salva (`runs.track`).
  Una risalita va a un impianto se quasi tutti i suoi punti stanno entro
  ~30 m dalla sua linea e salgono nel suo verso; una discesa va alla
  pista su cui passa la maggior parte dei suoi punti. Senza un impianto o
  una pista vicini, il tratto resta senza nome. La posizione non va a
  servizi esterni.
- **Dove si tiene.** Una colonna nuova di `runs`, scritta una volta
  (migrazione 0048, numero dal Coordinatore il 2026-11-05; si libera se
  non serve), oppure il calcolo a ogni lettura con una cache: lo decido
  con i tempi misurati.
- **L'app** mostra l'elenco dove l'utente sceglie (domanda D1), coi testi
  da approvare. Niente moduli nativi: l'impronta iOS resta 6f8bba4c.
- **Le parti**: D1 l'estratto e il confronto (server, test sulle tracce
  di C), D2 l'API, D3 l'app. Server, privacy e testi col sì dell'utente.

Le domande, una alla volta:

1. **Dove compaiono i nomi e chi li vede.** Proposta: nella scheda della
   giornata (il post), per chi può vedere il post; la fine giornata resta
   com'è, senza aspettare la rete. **Risposta dell'utente, 2026-11-05:
   «Nel post, per tutti».** I nomi stanno nel post della giornata e li
   vede chiunque può vedere il post.
2. **Quali comprensori all'inizio.** Proposta: l'Italia, dall'estratto
   che il server ha già; Austria, Svizzera, Francia dopo, con la memoria
   del server misurata.
3. **I testi** (titolo dell'elenco, la riga senza nomi), in cinque lingue.
4. **La riga della privacy**: che la traccia della giornata si confronta,
   sul server di MuW, con le linee di OpenStreetMap.

## File toccati

Parte D1 (approvata dal Coordinatore il 2026-11-05; il codice dopo le
risposte alle domande 1 e 2; solo file nuovi, nessun
file esistente del server): `services/api/shaperoute_api/ski_extract.py`
(il comando una tantum: dall'estratto filtrato con osmium al file degli
impianti e delle piste), `services/api/shaperoute_api/ski_names.py` (il
confronto di una traccia con quelle linee: risalite e discese, nomi e
volte), `services/api/tests/test_ski_extract.py`,
`services/api/tests/test_ski_names.py` e un piccolo estratto finto in
`services/api/tests/fixtures/ski/`; documenti: `docs/MAPS.md` (come si fa
il file dei comprensori), `docs/STATUS.md`, `docs/DECISIONS.md` (ADR-0319,
punto 11) e questa lista. Nessuna migrazione, nessuna rotta dell'API:
vengono con D2.

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
`docs/DATABASE.md`; dopo il merge di TASK-371 A, con il sì del
Coordinatore, `services/api/tests/test_walking_api.py` (due righe: le
attività salvate e Strava hanno anche quelle senza forma) e questa lista.

Parte B0 (approvata dal Coordinatore il 2026-11-04): un'attività che
l'app non conosce non fa cadere la pagina. `apps/mobile/src/api/drawings.ts`,
`apps/mobile/src/api/drawings.test.ts`, `apps/mobile/src/api/feed.test.ts`,
`docs/STATUS.md`, `docs/DECISIONS.md` (ADR-0319, punto 6) e questa lista.
`packages/shared-types/src/index.ts`, approvato, alla fine non serve: i
tipi dei disegni restano `Activity` (ADR-0319, punto 6).

Parte B1 (2026-11-04, la lista di B più ciò che è servito, approvata dal
Coordinatore lo stesso giorno; i testi sono quelli approvati dall'utente
con «Sì, approvati», nella tabella sopra): `apps/mobile/src/settings/sport.ts`,
`apps/mobile/src/screens/ChooseScreen.tsx`,
`apps/mobile/src/screens/RunNoRouteButton.tsx`,
`apps/mobile/src/navigation/freeSport.ts`,
`apps/mobile/src/navigation/useFreeRun.ts`,
`apps/mobile/src/screens/FreeRunScreen.tsx`,
`apps/mobile/src/activities/RunEnd.tsx`, `apps/mobile/src/health/workout.ts`,
`apps/mobile/src/health/useHealth.ts`, `apps/mobile/src/health/appleWorkout.ts`,
`apps/mobile/src/health/healthConnectWorkout.ts`, i quattro file di
`apps/mobile/src/i18n/`; in più `apps/mobile/src/api/drawings.ts` (di B0),
`apps/mobile/src/social/PublicParts.tsx` (i chip «Activity») e
`packages/shared-types/src/index.ts` (`DrawingRequest` e `MyDrawing` →
`RunActivity`). Test: nuovi `settings/snowSport.test.ts`,
`health/snowWorkout.test.ts`, `screens/RecordDay.test.tsx` e
`social/snowChips.test.tsx`; `api/drawings.test.ts`; il conteggio dei
«Soon» in `settings/sport.test.ts`, `SportSetting.test.tsx`,
`SportButton.test.tsx`, `SportVoiceItalian.test.tsx` e
`profile/SettingsPage.test.tsx`. Documenti:
`docs/STATUS.md`, `docs/DECISIONS.md` (ADR-0319, punto 7) e questa lista.
`trackStore.ts` e `api/activities.ts` alla fine non servono.

Parte C2 (approvata dal Coordinatore il 2026-11-05):
`apps/mobile/src/activities/snowLifts.ts` e `snowLifts.test.ts` (nuovi),
`apps/mobile/src/map/MapViewLifts.test.tsx` e `mapPageLifts.test.ts`
(nuovi), `apps/mobile/src/map/messages.ts`, `apps/mobile/src/map/mapPage.ts`,
`apps/mobile/src/map/MapView.tsx`, `apps/mobile/App.tsx` (il campo `lifts`
e il prop di `MapView`), `apps/mobile/src/screens/FreeRunScreen.tsx`,
`apps/mobile/src/screens/SnowFinishCard.test.tsx` (la riga del banner, approvata
dal Coordinatore), `apps/mobile/src/i18n/{it,de,fr,es}.ts`; documenti:
`docs/STATUS.md`, `docs/DECISIONS.md` (ADR-0319, punto 10) e questa lista.
**In `main` il 2026-11-05** (#783, 9adb22d1); con C1 (#778) la parte C è
chiusa.

Parte C1 (approvata dal Coordinatore il 2026-11-05):
`apps/mobile/src/activities/snowDay.ts` e `snowDay.test.ts` (nuovi),
`apps/mobile/src/screens/SnowFinishCard.tsx` e `SnowFinishCard.test.tsx`
(nuovi), `apps/mobile/src/screens/FreeRunScreen.tsx`,
`apps/mobile/src/i18n/{it,de,fr,es}.ts`; documenti: `docs/STATUS.md`,
`docs/DECISIONS.md` (ADR-0319, punto 9) e questa lista. C2 (le risalite
tratteggiate: `App.tsx`, `src/map/MapView.tsx`) col via del Coordinatore
dopo C1.

Parte B2 (approvata dal Coordinatore il 2026-11-04): `apps/mobile/src/activities/snow.ts`
(nuovo), `packages/shared-types/src/index.ts` (`activity` dei disegni →
`RunActivity`), `apps/mobile/src/api/drawings.ts`,
`apps/mobile/src/api/activities.ts`, `apps/mobile/src/feed/sampleFeed.ts`,
`apps/mobile/src/feed/FeedPost.tsx`, `apps/mobile/src/feed/ActionBar.tsx`,
`apps/mobile/src/feed/postEnergy.ts`, `apps/mobile/src/share/postRun.ts`,
`apps/mobile/src/social/DrawingCard.tsx`,
`apps/mobile/src/social/drawingRoute.ts`,
`apps/mobile/src/messages/messageDrawing.ts`,
`apps/mobile/src/search/drawingMatch.ts`,
`apps/mobile/src/route/WhileRouting.tsx`; test: `feed/snowFeed.test.tsx`
(nuovo), `api/drawings.test.ts`, `api/feed.test.ts`; documenti:
`docs/STATUS.md`, `docs/DECISIONS.md` (ADR-0319, punto 8) e questa lista.
`App.tsx`, `feedPosts.ts` e `activityText.ts` alla fine non servono.

Parte B (la lista di partenza): `apps/mobile/src/settings/sport.ts`,
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
