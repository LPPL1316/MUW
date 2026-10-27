# TASK-305 — Parapendio: proposta e prova di fattibilità

**Stato**: Proposto · solo documenti e misure (questa PR). L'utente il
2026-10-26: «è una bella idea», senza navigatore; le parti partono dopo le
tre condizioni dello studio (licenza degli spazi aerei, decolli scelti,
parere legale)
**Fase**: 5 · **Branch**: `docs/TASK-305-paragliding-proposal` (documenti);
le parti, se si fanno, `feat/TASK-305-a1-air-cone` e così via
**Dipende da**: nulla per lo studio. Le parti dipendono da scelte
dell'utente (in fondo) e da due licenze da sciogliere (spazi aerei,
decolli).
**ADR**: ADR-0265 (proposto)

## Obiettivo

Dire con numeri, non a parole, se MuW può avere lo sport «Paragliding»: il
pilota sceglie un decollo, l'app propone una forma che sta nel cono di
planata fra il decollo e il suo atterraggio ufficiale, fuori dagli spazi
aerei e lontano dai centri abitati, la esporta allo strumento di volo e,
dopo l'atterraggio, importa la traccia per mostrare il disegno nel Feed.
Lo studio è `out/TASK-305/studio.md` del Mac (`out/` è ignorato da git),
con gli script e la pagina a griglia `paragliding-samples-grid.html`.

## Contesto

L'utente il 2026-10-26: aggiungere lo sport «Parapendio»: lo si sceglie e
l'app si adatta al volo, e il pilota disegna la forma nel cielo con la sua
traccia. `PRODUCT.md` e `ROADMAP.md` (Fase 5) dicono da sempre che il
parapendio «ha un modello di percorso diverso e va riprogettato, non
adattato». Le condizioni del Coordinatore: la sicurezza prima di tutto (cosa
l'app non deve mai fare); da dove vengono i dati delle zone e cosa dicono
le regole; il motore resta sulle strade, un motore per termiche e
traiettorie è un costo a parte; se non si può fare bene, lo studio dice
«non conviene».

## Scelte dell'utente (2026-10-26)

- **La prima versione**: «continua con il parapendio, secondo me è una
  bella idea; non facciamo da navigatore, diamo solo la tratta e facciamo
  sì che la gente possa caricare la loro volata». Quindi: pianificazione,
  export allo strumento di volo, import della traccia dopo l'atterraggio;
  **nessuna guida in volo** e nessuna schermata di volo (la parte G esce
  dal piano).

## Scelte dell'utente (2026-10-27)

- **Dove si vede**: «mostra Paragliding in Settings adesso con «Soon»,
  come la canoa». La riga c'è da subito, non si può scegliere, e la accende
  la parte D1 (proposta era: nascosto finché non è pronto). È la parte D0
  qui sotto, l'unica che non aspetta le tre condizioni del verdetto.
- **Il nome**: «Paragliding» 🪂 nell'interfaccia; **Parapendio** in
  italiano, **Gleitschirmfliegen** in tedesco, **Parapente** in francese e
  in spagnolo.
- **L'avviso di sicurezza**, approvato com'era proposto: compare la prima
  volta, prima di pianificare un volo su quel telefono (come la canoa):

  > **Before you fly**
  > - MuW is not a flight instrument. The shape is a plan made on the
  >   ground, in still air, with a glide ratio of 8 and 300 m over the
  >   terrain. The sky on the day is yours to judge.
  > - Check the wind, the airspace, the NOTAMs and the site rules yourself.
  >   MuW's data has a date; the sky does not.
  > - Fly it only if you hold a valid licence and insurance, in VMC,
  >   outside controlled and forbidden airspace, away from towns and
  >   crowds.
  > - Load the shape into your flight instrument. MuW does not guide you in
  >   the air.
  >
  > «I understand» · «Not now»

  E su ogni risultato, sempre visibile, con la data dei dati degli spazi
  aerei:

  > Still air, glide 8, 300 m over the ground. Check the wind, the airspace
  > and the NOTAMs yourself.

  Le traduzioni nelle altre lingue si fanno con la parte D1 e si fanno
  approvare all'utente.

## Il punto, in breve

- **Il modello**: niente strade, il cono di planata. Da ogni punto della
  forma l'atterraggio deve restare raggiungibile con 300 m sopra il
  terreno, efficienza 8, aria calma. Il motore decide dove e quanto grande;
  l'AI interpreta soltanto. Il motore resta una libreria senza rete:
  terreno, spazi aerei, centri abitati e decolli entrano come file.
- **I numeri** (`studio.md` §1): in aria calma il cuore più grande è di
  **2,8 km al Monte Baldo** (1667 m di dislivello), **1,2 km al Grappa**
  (1399 m) e **1,0 km alla Panarotta** (1044 m); la stella 2,3 · 1,0 ·
  0,8 km, la M 2,6 · 0,9 · 0,7 km. Con spazi aerei e centri abitati il
  Baldo resta a 2,7 km; il Grappa scende a 0,24 km (la pianura è costruita:
  0,74 km con i 300 m della regola invece dei nostri 500); **alla
  Panarotta non ci sta niente**, perché il file comunitario mette
  l'atterraggio ufficiale di Levico dentro la riserva «Inghiale» (GND –
  1500 ft). Con 15 km/h di vento contro la planata il Grappa e la Panarotta
  non hanno forma, il Baldo scende a 1,6 km. Con una termica fino a 150 m
  sotto la CTA: 6,0 · 2,5 · 4,8 km. Un cuore
  regge 12–16 boe; con il vento conta il raggio di virata (60–80 m di
  errore con 30 m, 90–135 con 50 m): sotto 1,5 km la forma si deforma, da
  2 km si legge. Senza termiche è una planata di 10–20 minuti; con le
  termiche il motore accetta una quota di partenza più alta, non pianifica
  la termica.
- **I dati** (§2): decolli da OSM (incompleti) o da un catalogo con
  licenza; terreno Copernicus; **gli spazi aerei sono il nodo**: la fonte
  aperta più usata non ammette l'uso commerciale, quella ufficiale non è
  in un formato leggibile. **Senza una fonte di spazi aerei che si possa
  spedire nell'app, la parte A3 e la B2 non si fanno, e senza quelle non si
  propone nessuna forma.**
- **La sicurezza** (§3): l'app non dice mai «vola qui», non propone mai un
  punto dentro o sotto uno spazio aereo né sopra un centro abitato, non
  spinge verso il pendio, non conta su una termica, non parla in decollo e
  in atterraggio, non dice «ce la fai», non sostituisce AIP e NOTAM.
  **Nessuna guida in volo** nella prima versione: la fa lo strumento.
- **Gli strumenti** (§4): export come task di boe (XCTrack QR e `.xctsk`,
  `.cup`, `.wpt`), import IGC dopo l'atterraggio.
- **Il costo** (§6): 10–14 sessioni (la schermata di volo è fuori per
  scelta dell'utente); la canoa ne ha prese 15 con una sola fonte di dati
  già nel motore. Qui le fonti sono quattro, due con una licenza da
  sciogliere prima del codice, e serve una prova con un pilota vero.
- **Il verdetto** (§7): conviene a tre condizioni, altrimenti no: una
  fonte di spazi aerei con licenza prima del codice; un elenco di decolli
  scelti a mano dove la forma è ≥ 1,5 km; un parere legale e una prova con
  un pilota e il club prima di pubblicare.

## Cosa fare (se l'utente decide di sì)

Parti piccole, una sessione per parte, nell'ordine. Ogni parte è un branch
e una PR. I file sono quasi tutti **nuovi**: nessuna parte tocca i file
delle strade e dell'acqua.

### A1 — Motore: il cono sul terreno

1. Un pacchetto nuovo `route_engine/air/` con `cone.py`: griglia di
   terreno in metri sul piano tangente, Dijkstra in avanti dal decollo e
   all'indietro dall'atterraggio, 300 m sopra il terreno (nessun margine
   nei primi 300 m dal decollo, 100 m sopra il campo all'arrivo), vento
   come correzione della deriva. Niente rete.
2. Fixture sintetiche (un pendio, una valle, una collina) e test
   deterministici: il cono è vuoto senza quota, cresce con la quota, si
   sposta sottovento, non entra sotto il margine.

Criteri: dalla CLI, senza rete e senza chiavi, sulle fixture, il cono dei
tre siti dello studio (terreno in `tests/fixtures/`) ha l'area che lo
studio misura, ±5 %.

File: `services/route-engine/route_engine/air/__init__.py`,
`services/route-engine/route_engine/air/cone.py`,
`services/route-engine/tests/test_air_cone.py`,
`services/route-engine/tests/fixtures/air_*.npz`, `docs/ROUTE_ENGINE.md`
(§9 nuovo).

### A2 — Motore: dove la forma ci sta, le boe, la planata

1. `air/fit.py`: la forma più larga del catalogo (e una lettera) che sta
   nel cono, scale decrescenti e bisezione, inclinazione entro ±30°, punto
   d'ingresso; il percorso decollo → forma → atterraggio; la quota prevista
   lungo la forma e la riserva.
2. `air/task.py`: la forma come boe (12–16 per un cuore, i vertici per
   stella e lettere; raggio 30–50 m), con i tipi `TAKEOFF`, `SSS`, `ESS`.
3. `RouteRequest` con `activity="paragliding"` e i campi `takeoff`,
   `landing` (coordinate e quota); `RouteResult` con le boe e i numeri;
   `--activity paragliding --takeoff --landing --dem` nella CLI.
4. Rifiuta: parole di più lettere, immagini, forme a pezzi, `near`,
   `nearby`, una distanza (la grandezza la decide il cono).

Criteri: sui tre siti dello studio, dalla CLI senza rete, la forma più
larga di ogni tipo con le misure dello studio ±5 %; nessun punto della
forma sotto `h_req`; i test della corsa, della bici e della canoa passano
senza modifiche ai valori.

File: `services/route-engine/route_engine/air/fit.py`,
`services/route-engine/route_engine/air/task.py`,
`services/route-engine/route_engine/models.py`,
`services/route-engine/route_engine/__main__.py`,
`services/route-engine/tests/test_air_fit.py`,
`services/route-engine/tests/test_air_cli.py`, `docs/ROUTE_ENGINE.md` §9.

### A3 — Motore: spazi aerei, riserve, centri abitati e vento

1. `air/limits.py`: i poligoni (GeoJSON) con pavimento e soffitto in metri
   AMSL o AGL diventano per cella un soffitto (stare sotto) o un pavimento
   (stare sopra); i centri abitati un pavimento a 500 m; una zona da terra
   al cielo blocca la cella.
2. Il vento come vettore nella richiesta (direzione e forza), già nel
   modello di A1.

Criteri: con una zona sopra la forma di A2 la forma scende o si sposta;
con una riserva sotto il decollo il primo chilometro resta volabile; tutto
senza rete.

File: `services/route-engine/route_engine/air/limits.py`,
`services/route-engine/tests/test_air_limits.py`,
`services/route-engine/tests/fixtures/air_zones.json`.

### B1 — Server: decolli, atterraggi e terreno

1. La tabella `air_sites` (decollo, atterraggio ufficiale, quote, fonte,
   licenza, data) e il comando che la riempie dalla fonte scelta
   (`studio.md` §2: **da decidere con l'utente**, la licenza prima del
   codice).
2. Le mattonelle del terreno (Copernicus GLO-30) per ogni sito, in cache
   sul server come le zone delle città, scaricate da un comando, mai dal
   job.

File: `services/api/shaperoute_api/air_sites.py`,
`services/api/shaperoute_api/air_terrain.py`,
`services/api/migrations/00XX_air_sites.sql` (numero al merge),
`services/api/tests/test_air_sites.py`, `docs/ARIA.md` (nuovo),
`docs/DATABASE.md`.

### B2 — Server: spazi aerei e centri abitati, aggiornamento AIRAC

1. `airspace_cache.py`: lettura della fonte scelta (OpenAir o GeoJSON) in
   poligoni per il motore, con il ciclo AIRAC (28 giorni) e la data; i
   centri abitati OSM attorno a ogni sito.
2. Un lavoro di aggiornamento ogni ciclo; **se i dati sono più vecchi di un
   ciclo, il job rifiuta la richiesta** (errore che lo dice).

File: `services/api/shaperoute_api/airspace_cache.py`,
`services/api/shaperoute_api/air_towns.py`,
`services/api/tests/test_airspace_cache.py`, `docs/ARIA.md`.

### C — API

1. `activity: "paragliding"` in `SUPPORTED_ACTIVITIES` e in
   `shared-types`; la richiesta con `takeoff_id` (o decollo e atterraggio
   espliciti), la forma, la riserva voluta; la risposta con le boe, il cono
   (come immagine o poligono), la quota prevista, i numeri, la data dei dati.
2. `GET /air/sites?near=` per Draw ed Explore.
3. Gli export: `GET /drawings/{id}/task.xctsk`, `.cup`, `.wpt`, e il testo
   del QR di XCTrack.
4. Gli errori nuovi: «no takeoff here», «the shape does not fit in the
   glide», «airspace data too old».

File: `services/api/shaperoute_api/paragliding.py`,
`services/api/shaperoute_api/air_export.py`,
`services/api/shaperoute_api/app.py`, `services/api/shaperoute_api/schemas.py`,
`services/api/shaperoute_api/jobs.py`, `packages/shared-types/src/index.ts`,
`services/api/tests/test_paragliding.py`, `docs/API.md`.

### D0 — App: la riga «Paragliding» con «Soon» in Settings (subito)

Scelta dell'utente del 2026-10-27. Non dipende da licenze né dal motore.

1. In `sport.ts` la voce `{ id: "paragliding", emoji: "🪂", name:
   tLater("Paragliding"), ready: false }`, dopo «Paddle»: «Settings» la
   mostra con «Soon» e non si può scegliere (`canChoose`), come la canoa
   prima di TASK-191 C.
2. `Sport` diventa `"run" | "bike" | "paddle" | "paragliding"`: dove l'app
   elenca tutti gli sport (`Record<Sport, …>`, `switch`) la voce nuova
   prende il valore della corsa o nessuno, mai un percorso; `loadSport`
   continua a dare «run» per uno sport non pronto.
3. Il nome nelle quattro lingue, in fondo ai file: `Paragliding:
   "Parapendio"` (`it.ts`), `"Gleitschirmfliegen"` (`de.ts`),
   `"Parapente"` (`fr.ts`, `es.ts`), scelti dall'utente il 2026-10-27.
4. Test: la riga c'è, dice «Soon», toccarla non cambia lo sport; i test di
   prima passano senza modifiche ai valori.

Criteri: in «Settings → Sport» quattro righe, l'ultima «Paragliding» 🪂 con
«Soon»; nessun altro cambiamento visibile. Solo app, nessun server;
l'impronta nativa iOS non cambia (solo JS).

Condizioni del Coordinatore (2026-10-27): parte dopo il merge della #578
(il nome è scelto); le chiavi nuove in fondo ai file delle lingue;
l'impronta iOS si controlla su una copia pulita; «#NNN pronta» al
Coordinatore, e per il merge serve la parola dell'utente.

**Apple e le voci «Soon».** Alla regola 2.1 (completezza dell'app) Apple
può contestare voci «coming soon» o funzioni che non fanno niente in una
build in revisione. **Non c'è un precedente**: la canoa è stata «Soon» solo
dal 2026-10-02 al 2026-10-03 (da TASK-189 a TASK-191 C), e le due build
della 1.0 viste da Apple (5 da `793fa112`, 7 da `26990fd4`) hanno tutti e
tre gli sport pronti, nessuna riga «Soon». D0 non tocca la 1.0: su
production non va nessuna OTA prima del verdetto. **Prima della build
1.0.1 va deciso** se tenere la riga o nasconderla nelle build per lo store
(proposta: nasconderla nelle build per lo store finché il parapendio non è
pronto, tenerla in `preview`).

File: `apps/mobile/src/settings/sport.ts`,
`apps/mobile/src/settings/sport.test.ts`,
`apps/mobile/src/settings/SportSetting.test.tsx`,
`apps/mobile/src/i18n/it.ts`, `de.ts`, `fr.ts`, `es.ts`, e solo se il tipo
lo chiede i file con un `Record<Sport, …>` (da elencare nella PR).

**Esito D0** (2026-10-28): fatta nella PR #591 (branch
`feat/TASK-305-d0-soon-row`). «Paragliding» 🪂 è l'ultima riga di
«Settings → Sport», con «Soon», e non si sceglie. Nell'app non c'è nessun
`Record<Sport, …>`; `activityOf` e `withoutRouteLabel` le danno già i
valori della corsa. **Scelta dell'utente del 2026-10-27**: la riga compare
anche nel menu dello sport di «Draw» (`SportButton`, ADR-0165, che mostra
gli sport di «Settings» con i loro «Soon»); `SportButton.tsx` non cambia.
I test che contano le righe «Soon» o i nomi da `SPORTS` salgono di uno:
`sport.test.ts`, `SportSetting.test.tsx` e, fuori dall'elenco qui sopra,
`SportButton.test.tsx`, `SportVoiceItalian.test.tsx`,
`profile/SettingsPage.test.tsx` (solo test). Su una copia pulita, dopo
l'allineamento con `main` (la #576 aveva messo le sue chiavi in fondo alle
lingue): tsc, Prettier, eslint e jest (23 suite, 174 test) verdi, impronta
iOS `83793e26…` invariata. Merge sulla parola dell'utente e il «merge 591»
del Coordinatore.

### D1 — App: lo sport, Draw dai decolli, l'avviso

1. La voce di D0 diventa `ready: true` e prende la sua attività
   (`activityOf`).
2. Con «Paragliding» Draw parte da un decollo (`src/air/TakeoffPicker.tsx`,
   lista dai `GET /air/sites`), non dalla posizione; la distanza sparisce
   e al suo posto c'è la riserva («safer / bigger»); forme del catalogo e
   lettere sole.
3. L'avviso di sicurezza la prima volta, prima di pianificare
   (`src/air/safetyNotice.ts`, come `src/paddle/safetyNotice.ts`), e la riga
   fissa su ogni risultato: i testi inglesi approvati il 2026-10-27
   («Scelte dell'utente»); le traduzioni da far approvare.

File: `apps/mobile/src/settings/sport.ts`, `apps/mobile/src/air/*.tsx`,
`apps/mobile/src/air/safetyNotice.ts`, i file delle lingue in
`apps/mobile/src/i18n/`, `apps/mobile/__tests__/AppParagliding.test.tsx`,
`docs/UI.md`.

### D2 — App: il risultato e l'export

1. La pagina del risultato: la forma, il cono, le boe, i numeri, l'avviso
   fisso con la data dei dati; niente «Start».
2. «Open in XCTrack» (QR a schermo: **serve una libreria QR, da chiedere
   prima**) e «Download task» con lo share sheet.

File: `apps/mobile/src/air/AirResult.tsx`, `apps/mobile/src/air/taskExport.ts`,
`apps/mobile/src/air/*.test.tsx`, `docs/UI.md`.

### E — Import della traccia IGC

1. `src/air/igc.ts`: lettura dei record B (posizione e quota), scarto dei
   record H con nome del pilota e vela; la traccia diventa posizioni come
   quelle di una corsa.
2. «Import IGC» dallo share sheet e da file; il punteggio sulla forma
   (`track_scores`, come per una corsa), il salvataggio in «My activities»
   e la pubblicazione nel Feed con il tipo `paragliding`.

File: `apps/mobile/src/air/igc.ts`, `apps/mobile/src/air/igcImport.ts`,
`apps/mobile/src/air/igc.test.ts`, `services/api/shaperoute_api/track_scores.py`
(solo se il punteggio in aria vuole la quota), `docs/GPX.md`.

### F — Explore con i decolli e il Feed

1. Con «Paragliding» le card di Explore sono i decolli con i loro esempi
   (cuore, stella, lettera), disegnati sul server come oggi
   (`draw_examples.py --air`).
2. Il post nel Feed mostra traccia, forma e quota.

File: `apps/mobile/src/air/AirExplore.tsx`, `apps/mobile/src/explore/ExploreScreen.tsx`,
`services/api/shaperoute_api/draw_examples.py`, `apps/mobile/src/feed/*`
(solo le righe del tipo), test relativi.

### ~~G — La schermata di volo~~

Fuori per scelta dell'utente (2026-10-26): MuW non fa da navigatore.

## Criteri di accettazione dello studio (questa PR)

- [x] Tre decolli reali con il loro atterraggio ufficiale, da OSM.
- [x] Per ognuno il cono di planata in aria calma con efficienza 8 e 300 m
      di margine, e la misura del cuore, della stella e di una lettera che
      ci stanno; gli scenari con vento, margine 150 m, +500 m, termica,
      spazi aerei e centri abitati (`data/results_*.json`).
- [x] Quanti spigoli regge con raggio 30–50 m e vento (`data/fly_sim.json`).
- [x] Le fonti con licenza, aggiornamento e peso; le regole del VDS; gli
      strumenti e i formati (`research_*.md`).
- [x] La pagina a griglia `out/TASK-305/paragliding-samples-grid.html`.
- [x] ADR-0265 in stato «proposto»; righe in `STATUS.md`.
- [x] Le scelte di prodotto dell'utente: la prima versione (2026-10-26),
      la visibilità, il nome e l'avviso (2026-10-27).

## File toccati (questa PR)

```
docs/tasks/TASK-305.md          (nuovo)
docs/DECISIONS.md               (ADR-0265, righe mie)
docs/STATUS.md                  (righe mie)
```

Lo studio, gli script e i dati stanno in `out/TASK-305/` del worktree
`.claude/worktrees/wizardly-knuth-22b876` (git li ignora, come per TASK-297
e TASK-299): **prima di archiviare il worktree vanno copiati in
`out/TASK-305/` del checkout principale**, o si perdono. Si rifanno da
capo con `fetch_dem.py`, `run_study.py`, `fly_sim.py` e `build_grid.py`
(circa 40 minuti, terreno dall'API pubblica di OpenTopoData).

## Fuori scope

- Codice dell'app, del motore o dell'API: niente, nemmeno uno stub.
- Un motore per le termiche, i rotori e le traiettorie: costo a parte, non
  proposto.
- La guida in volo, a voce o a schermo: esclusa dall'utente.
- Dipendenze o fonti nuove: nessuna aggiunta; ogni fonte è una proposta
  con la sua licenza, da scegliere con l'utente.
- Pubblicazioni e merge senza il «merge NNN» del Coordinatore.

## Scelte di prodotto da chiedere all'utente

Una alla volta, ognuna con la proposta pronta (`studio.md`, in fondo):

1. ~~Dove si vede~~ — **decisa** (2026-10-27): in Settings subito, con
   «Soon» (parte D0).
2. ~~Prima versione~~ — **decisa** (2026-10-26): solo la traccia e il
   caricamento del volo, nessun navigatore.
3. ~~L'avviso di sicurezza~~ — **approvato** (2026-10-27) com'era
   proposto, la prima volta prima di pianificare, più la riga fissa su ogni
   risultato.
4. ~~Il nome~~ — **deciso** (2026-10-27): «Paragliding» 🪂; Parapendio,
   Gleitschirmfliegen, Parapente.

## Esito

Proposto il 2026-10-26: lo studio dice che si può fare come pianificatore
(forme di 2–3 km dai decolli con molto dislivello, 1 km dagli altri) e che
il nodo sono i dati degli spazi aerei, non il motore. L'utente ha scelto
la traccia più il caricamento del volo, senza navigatore (2026-10-26), e la
riga in Settings con «Soon» da subito, il nome «Paragliding» e l'avviso di
sicurezza (2026-10-27; la riga è la parte D0). Restano le tre condizioni
del verdetto prima della parte A1 e, prima della build 1.0.1, la scelta se
tenere «Soon» nelle build per lo store.
