# TASK-323 — Nuoto in acque libere («Open water swim»)

**Stato**: In lavorazione · A1 scritta, in bozza (2026-10-29, «A1, dove si
è» più sotto); i documenti in `main` con la #609. L'utente il 2026-10-28:
«parti proprio con il progetto secondo me funziona»; le parti partono una
alla volta, ognuna nella sua sessione
**Fase**: 5 · **Branch**: `docs/TASK-323-open-water-swim` (documenti); le
parti `feat/TASK-323-a1-swim-band` e così via
**Dipende da**: TASK-191 (l'acqua della canoa, in `main`). La parte C dopo
TASK-318 (le build dello store nascondono gli sport non pronti, tocca
`sport.ts`); la parte D dopo TASK-312 (l'importazione); la parte E con
TASK-321 (Apple Salute, sessione local_f4599f22) nella build 1.0.1.
**ADR**: ADR-0283 (proposto). Numeri dal Coordinatore il 2026-10-28

## Condizioni del Coordinatore (2026-10-28)

1. **La canoa non cambia**: se il nuoto riusa l'acqua della canoa, i
   percorsi della canoa restano gli stessi, e l'impronta del motore con cui
   `route_store` tiene gli esempi (`engine_fingerprint`) resta la stessa,
   con un test. Se non si può, la PR dice perché e quali esempi tenuti si
   ridisegnano.
2. **Sono scelte di prodotto, dell'utente**: l'avviso di sicurezza, le
   distanze dalla riva, cosa si promette e i testi in cinque lingue.
3. **D ed E sono nativi**: vanno con una build nuova per l'App Store,
   insieme alla 1.0.1 e ad Apple Salute di TASK-321. Nessuna parte tocca i
   file di TASK-321, né il contrario.
4. **La riga dello sport** entra con `ready: false` finché il motore non
   c'è: con TASK-318 le build dello store non la mostrano.
5. **«File toccati» al Coordinatore prima di ogni parte.**

## Obiettivo

Chi sceglie «Open water swim» riceve un giro a nuoto che disegna una forma
del catalogo nell'acqua del mare o di un lago, **dentro la fascia dei
bagnanti**, con partenza e arrivo dalla stessa spiaggia. Prima di entrare
vede le curve, ognuna col posto a riva davanti a cui girare. Nuota con il
telefono nella boa di sicurezza o con il suo orologio, e la traccia diventa
il disegno nel Feed. Dopo (parte E, col sì dell'utente su dipendenze e
build) l'Apple Watch guida in acqua con le vibrazioni.

## Contesto

L'utente il 2026-10-28: «Anche nuoto acque libere potresti mettere dentro
come sport, poi per le indicazioni di dove nuotare dimmi te come fare se
hai suggerimenti, tutto con l'orologio deve fare presumo». La proposta
della sessione (in chat): l'acqua della canoa con la fascia rovesciata, le
curve con i nomi a riva, la guida con l'orologio in due fasi. Risposta:
«parti proprio con il progetto secondo me funziona».

Quello che c'è già (`ROUTE_ENGINE.md` §8): per la canoa la forma piazzata
**è** il percorso se sta tutta nella fascia; `water.py` tiene l'acqua
entro 1000 m dalla riva **meno 200 m al mare e 50 m sui laghi** (fuori dai
bagnanti, scelta dell'utente per TASK-191) e trova i punti della riva
raggiungibili a piedi; `water_fit.py` cerca scala, angolo e centro;
il percorso è riva → forma → riva. L'acqua di 67 posti di mare e di lago è
sul server (TASK-225, TASK-245 C); sul Mac ci sono solo due riquadri di
laghi vicino a Trento, Caldonazzo e Levico e i laghi di Piné
(`data/cache/water/`).

## Scelte dell'utente (2026-10-28)

- **Il nuoto in acque libere è uno sport di MuW**, con il progetto come
  proposto: la fascia dei bagnanti, le curve con i nomi a riva, prima senza
  codice per l'orologio (telefono nella boa o file dell'orologio), poi
  l'app per Apple Watch.
- Restano dell'utente, quando arriva la parte che li usa (una domanda per
  volta, con la proposta qui sotto): la fascia e le distanze dopo i
  campioni (A1), nome, testi e avviso di sicurezza (C), le dipendenze e la
  build dell'orologio (E).

## Il punto, in breve

- **Il modello**: quello della canoa, con la fascia rovesciata. La canoa
  sta *oltre* i 200 m al mare; il nuoto sta **fra 20 e 150 m dalla riva**,
  al mare e sui laghi (proposta), cioè dentro la zona dove di solito le
  barche a motore non entrano (le ordinanze locali dicono di solito 200 m
  dalle spiagge e 100 m dalle coste a picco, ma cambiano da posto a posto:
  il motore non le conosce). Partenza e arrivo sulla stessa spiaggia; si
  entra solo da una spiaggia o da una via pedonabile, non da uno scivolo né
  da un molo. Porti, marine e foci di fiumi a 200 m (proposta; la canoa ne
  tiene 30). **Il motore decide dove e quanto grande; l'AI interpreta
  soltanto.**
- **Il rischio da misurare prima di tutto** (A1): una fascia larga 130 m su
  una costa dritta tiene solo forme piccole (un cerchio di 130 m è circa
  0,4 km) o la forma va in una baia o in un lago. A1 misura la forma più
  grande che ci sta nei posti dell'acqua già scaricata, e l'utente giudica i
  campioni come per la canoa.
- **Le distanze**: 0,5–3 km (proposta). Fuori da ciò che ci sta, l'errore
  dice a quanti km la forma ci sta, come per la canoa.
- **Le curve con un nome a riva** (A2): in acqua ci si orienta alzando la
  testa verso un punto a terra. Per ogni curva il motore cerca il posto con
  un nome più vicino sulla riva di fronte, da OpenStreetMap (stabilimenti
  balneari, pontili, fari, alberghi, chiese, bar sulla spiaggia): «Turn
  opposite Bagno 54». È un dato, non un testo dell'AI. Serve un estratto
  nuovo dei posti con nome lungo la riva: lo scarica il server, col sì
  dell'utente.
- **La guida, fase 1 (A–D)**: niente codice per l'orologio. Prima di
  entrare l'app mostra la forma e le curve. In acqua il telefono non si
  guarda e la voce non si sente: nessuna guida. La traccia si registra con
  il telefono nella boa di sicurezza (sta a galla, il GPS prende meglio che
  al polso) o con la modalità nuoto dell'orologio, poi il file si importa
  (TASK-312).
- **La guida, fase 2 (E)**: un'app per Apple Watch. Riceve il giro, avvia un
  allenamento di nuoto in acque libere, vibra prima di ogni curva (destra e
  sinistra diverse) e quando si esce di rotta, mostra una freccia grande con
  i metri alla prossima curva per chi alza la testa, e rimanda la traccia
  al telefono. È codice nativo: una dipendenza nuova, una build nuova per
  l'App Store (l'impronta iOS 83793e26 cambia) e una prova in acqua prima di
  pubblicarla. Se le vibrazioni si sentono mentre si nuota non lo sa
  nessuno finché non si prova.
- **Garmin**: dal manuale la modalità nuoto in acque libere non segue un
  percorso. Chi ha un Garmin registra col suo orologio e importa il file
  (TASK-312). Un'app Connect IQ è fuori da questo task.
- **La stagione**: in Italia è finita. Le prove in acqua (D ed E) sono fra
  primavera ed estate 2027; A–C si possono fare prima.

## Cosa fare

Parti piccole, una sessione per parte, nell'ordine. Ogni parte è un branch
e una PR, e chiede al Coordinatore i suoi «File toccati» prima del codice.
Dove si può, file **nuovi**: la canoa non deve cambiare di un metro.

### A1 — Motore: la fascia del nuoto

0. **Prima del codice, l'impronta** (condizione 1): `engine_fingerprint`
   (`services/api/shaperoute_api/route_store.py`) legge ogni `.py` e
   `.json` del motore tranne `NOT_ROUTES`, quindi toccare `models.py` o
   `water.py` cambia l'impronta e fa ridisegnare tutti gli esempi tenuti
   (`draw_examples` sul server, lo zip del motore sul telefono). A1 sceglie
   e scrive al Coordinatore, prima del codice, una delle due strade: il
   nuoto tutto in file nuovi che i moduli della corsa, della bici e della
   canoa non importano, con un'impronta sua per i giri a nuoto e un test
   che l'impronta di prima non cambia; oppure la fascia per attività dentro
   `water.py`, dicendo quali esempi tenuti si ridisegnano e quando.
1. `swimming` in `DISTANCE_LIMITS_M` (500–3000 m) e in `WATER_ACTIVITIES`
   (`models.py`).
2. La fascia per attività: `water.py` prende i limiti (distanza minima e
   massima dalla riva, margine dagli ostacoli, tipi di accesso) da un
   profilo per attività; quello della canoa ha i valori di oggi, quello del
   nuoto 20–150 m, 200 m da porti, marine e foci, accesso `beach` e
   `path`.
3. `swimming.py` (nuovo), come `paddling.py`: `plan_swimming` disegna la
   forma del catalogo, la piazza con `water_fit` nella fascia del nuoto, la
   controlla e dà un `RouteResult`. `--activity swimming` nella CLI.
4. `validation.check_on_water` controlla anche la distanza **minima** e
   **massima** dalla riva del profilo.
5. I campioni: cerchio, cuore e stella a 0,5, 1 e 1,5 km a Levico e
   Caldonazzo (acqua sul Mac) e in quattro posti di mare (Riccione, Jesolo
   e due fra i 67). L'acqua del mare la scarica Overpass dal Mac; se non
   risponde, si chiede all'utente di copiarla dal server. Più la tabella
   della forma più grande che ci sta per posto. Pagina a griglia
   `out/TASK-323/swim-samples-grid.html` per l'utente.

Criteri: dalla CLI, senza rete né chiavi, sull'acqua in cache, un giro a
nuoto di 1 km a Levico sta tutto fra 20 e 150 m dalla riva e parte e torna
alla stessa spiaggia; i test della canoa passano **senza cambiare un
valore** e `paddleExamples.json` resta uguale; l'impronta degli esempi
tenuti resta la stessa, con un test, o la PR dice cosa si ridisegna; la
pagina dei campioni c'è.

File (da confermare col punto 0; con la prima strada si aggiungono
`route_store.py` e il suo test): `services/route-engine/route_engine/models.py`,
`services/route-engine/route_engine/water.py`,
`services/route-engine/route_engine/water_fit.py`,
`services/route-engine/route_engine/swimming.py`,
`services/route-engine/route_engine/validation.py`,
`services/route-engine/route_engine/__main__.py`,
`services/route-engine/tests/test_swimming.py`, `docs/ROUTE_ENGINE.md` §8
(una sottosezione nuova).

#### A1, dove si è (2026-10-29)

Scritta in una sessione cloud, branch `claude/inspiring-lovelace-rcadwd`
(il nome lo impone la sessione), PR in bozza
[LPPL1316/MUW#10](https://github.com/LPPL1316/MUW/pull/10). Il Coordinatore
non era raggiungibile: la strada del punto 0 è scelta su delega dell'utente
e scritta nell'aggiunta ad ADR-0283; va confermata con i «File toccati» qui
sotto prima del merge.

**Il push dal cloud** (2026-10-29): su `rockydalbianco/shaperoute` la
sessione cloud riceve 403, sia col push sia con lo strumento GitHub (l'app
Claude non ci può scrivere). Funziona così, col sì dell'utente: `add_repo`
di `LPPL1316/MUW` con accesso `push`, un remote `muw` nel checkout, `git
fetch muw main`, poi `git push -u muw <branch>`. Lo specchio
(`TEAM_WORKFLOW.md`) copia il branch su `shaperoute` in pochi secondi. La PR
su `shaperoute` resta da aprire a mano (anche quella dà 403 dal cloud);
dal cloud si apre in bozza su MUW. L'utente ha chiesto di dirlo al
Coordinatore, perché valga per tutte le sessioni cloud.

- **Punto 0, la prima strada**: tutto in file nuovi; `models.py`,
  `water.py`, `water_fit.py`, `validation.py`, `paddling.py` e
  `__main__.py` non cambiano. `route_store` lascia fuori i file del nuoto
  (`SWIM_ONLY`), con il test. Impronte come in `main`: `route_store`
  `abaea5bb82b3`, esempi della canoa `1b6759cb3cc4`. I punti 1 e 4 e
  `--activity swimming` passano a B (con `models.py`); al loro posto
  `SwimRequest` (0,5–3 km), `check_in_band` e
  `python -m route_engine.swimming`.
- **I campioni**: solo sulle due acque di prova del motore (la sessione
  cloud non raggiunge Overpass né il server). Pagina per l'utente:
  https://claude.ai/artifact/UYiPvDiPaiJetF9z5ntoEX. Levico, Caldonazzo,
  Riccione e Jesolo si misurano sul Mac con `tests/measure_swim.py`
  (comando in `ROUTE_ENGINE.md` §8).
- **Il rischio c'è**: con 20–150 m un giro ci sta da 0,4–0,5 km lungo una
  costa dritta e la riva di un lago grande.
- **Domanda 1, risposta dell'utente (2026-10-29)**: «Giri ripetuti». La
  fascia resta 20–150 m, le distanze 0,5–3 km; un nuoto più lungo della
  forma la ripassa a giri, al massimo 5 (`MAX_LAPS`). I campioni del task
  ci stanno tutti, in 1–4 giri; 5 giri arrivano a 1,7–2,1 km lungo una
  costa dritta, 3 km solo dove un giro è di 0,6 km.
- **Richiesta dell'utente dello stesso giorno**: «dai la possibilità di
  disegnare anche sull'acqua e di modificare la forma più grande e più
  piccola». Nel motore del nuoto, in A1: `SwimRequest.outline` (un disegno
  come «Freehand») e `SwimRequest.laps` (meno giri, forma più grande; la
  distanza resta). Per la canoa va con B (tocca `models.py`), lo schermo
  con C. Aggiunta ad ADR-0283.
- **Prossimo**: i posti veri sul Mac con `tests/measure_swim.py`; la
  conferma dei «File toccati» e della canoa disegnata in B al
  Coordinatore; poi B.

File toccati da A1:

```
services/route-engine/route_engine/swim_water.py        (nuovo)
services/route-engine/route_engine/swimming.py          (nuovo)
services/route-engine/tests/test_swimming.py            (nuovo)
services/route-engine/tests/measure_swim.py             (nuovo)
services/api/shaperoute_api/route_store.py              (SWIM_ONLY)
services/api/tests/test_swim_fingerprint.py             (nuovo)
apps/mobile/assets/engine/engine.zip                    (rifatto)
docs/ROUTE_ENGINE.md                                    (§8, sottosezione)
docs/tasks/TASK-323.md
docs/DECISIONS.md                                       (aggiunta ad ADR-0283)
docs/STATUS.md                                          (le righe di TASK-323)
```

### A2 — Motore: le curve e i nomi a riva

1. `swim_turns.py` (nuovo): le curve del giro (dove la direzione cambia più
   di 45°), ognuna con la distanza dalla partenza, il verso (destra o
   sinistra) e l'angolo.
2. `shore_names.py` (nuovo): per ogni curva il posto con un nome più vicino
   sulla riva di fronte, entro 300 m, con il tipo e la direzione in cui
   guardarlo. I posti arrivano come file in una cartella nuova della cache
   (`<cache>/shore_names/`); senza file, le curve non hanno nome.
3. `RouteResult.turns` per il nuoto; le curve come waypoint nel GPX.

Criteri: su una fixture con tre posti con nome, ogni curva ha il nome
giusto; senza file, nessun nome e nessun errore; tutto senza rete.

File: `services/route-engine/route_engine/swim_turns.py`,
`services/route-engine/route_engine/shore_names.py`,
`services/route-engine/route_engine/models.py`,
`services/route-engine/route_engine/export_gpx.py`,
`services/route-engine/tests/test_swim_turns.py`,
`services/route-engine/tests/fixtures/shore_names_*.json`.

#### A2, dove si è (2026-10-29)

Scritta nella stessa sessione cloud di A1, su richiesta dell'utente («Prima
A2», alla domanda su B), branch `feat/TASK-323-a2-swim-turns` partito da
A1, poi allineato a `main` dopo che A1 c'è entrata (rockydalbianco/shaperoute#640).
«File toccati» mandati al Coordinatore prima del codice. Aggiunta ad
ADR-0283.

- `swim_turns.py`: le curve (oltre 45°, guardate 15 m prima e dopo), con
  punto, metri dalla partenza, verso, angolo e giro; `with_turns` mette nel
  GPX un waypoint per ogni curva del primo giro.
- `shore_names.py`: il posto con un nome più vicino entro 300 m, col tipo e
  la direzione in cui guardarlo, dai file di `<cache>/shore_names/` (il
  formato che B deve scrivere è in `ROUTE_ENGINE.md` §8). Senza file,
  nessun nome e nessun errore.
- `SwimPlan.turns` al posto di `RouteResult.turns`, e niente
  `export_gpx.py`: tutti e due vanno con B, insieme a `models.py`, perché
  cambiano le impronte. Impronte come in `main`.
- Criteri: sulla fixture `shore_names_coast.json` (tre posti) ogni curva ha
  il nome giusto, il faro oltre 300 m nessuna; senza file nessun nome e
  nessun errore; tutto senza rete (`tests/test_swim_turns.py`).

File toccati da A2:

```
services/route-engine/route_engine/swim_turns.py         (nuovo)
services/route-engine/route_engine/shore_names.py        (nuovo)
services/route-engine/route_engine/swimming.py           (di A1: le curve)
services/route-engine/tests/test_swim_turns.py           (nuovo)
services/route-engine/tests/fixtures/shore_names_coast.json (nuovo)
services/api/shaperoute_api/route_store.py               (SWIM_ONLY)
apps/mobile/assets/engine/engine.zip                     (rifatto)
docs/ROUTE_ENGINE.md, docs/tasks/TASK-323.md, docs/DECISIONS.md,
docs/STATUS.md
```

### B — API e server

1. `swimming` nel contratto (`packages/shared-types`, `SUPPORTED_ACTIVITIES`
   dell'API), con `turns` nella risposta.
2. Una migrazione che apre i vincoli sull'attività (preferiti, disegni,
   gioco, corse di gruppo) a `swimming`: numero dal Coordinatore quando
   parte.
3. Il comando che taglia i posti con nome lungo la riva dall'estratto
   dell'Italia, come `water_extract.py`.
4. Sul server, **col sì dell'utente**: l'estratto dei nomi e, per
   «Explore», un `draw_examples --water` per il nuoto.

### C — App: lo sport

1. «Open water swim» 🏊 in «Settings» e nel menu degli sport di «Draw»
   (dopo TASK-318), con la sua attività. La riga entra con `ready: false`
   (condizione 4: le build dello store non la mostrano) e si accende quando
   A1, A2 e B sono in `main` e sul server.
2. L'avviso di sicurezza la prima volta e la riga fissa sotto ogni giro
   (testi da far approvare, proposta nell'ADR).
3. Sul risultato, prima di «Start», l'elenco delle curve con i nomi a riva.
4. I posti d'acqua in «Explore» con gli esempi a nuoto.
5. Testi in cinque lingue, col sì dell'utente.

### D — App: nuotare con il telefono nella boa

1. La schermata della corsa per il nuoto: niente voce, il passo per 100 m,
   le soglie di pausa e di assenza adatte al nuoto (TASK-304).
2. Il giro diventa il disegno nel Feed come per la canoa; l'importazione di
   un file dell'orologio con lo sport «nuoto» (TASK-312).
3. Prova in acqua con il telefono in una boa (primavera 2027).
4. Il codice nativo che serve (condizione 3) va nella build 1.0.1 con E e
   con Apple Salute di TASK-321; quello solo JavaScript può uscire prima,
   con l'impronta iOS misurata su una copia pulita.

### E — Apple Watch (solo col sì dell'utente su dipendenze e build)

1. Un target watchOS nell'app: la dipendenza per aggiungerlo (un plugin di
   configurazione di Expo) si chiede all'utente prima.
2. L'app dell'orologio: allenamento di nuoto in acque libere, il giro e le
   curve dal telefono, le vibrazioni (curva a destra, curva a sinistra, fuori
   rotta oltre 25 m), la freccia con i metri, la traccia rimandata al
   telefono.
3. Esce solo con una build nuova per l'App Store, la 1.0.1 insieme ad Apple
   Salute di TASK-321 (condizione 3), dopo una prova in acqua.
4. La lettura dei nuoti dell'Apple Watch da Apple Salute, per chi non usa
   la nostra app dell'orologio: è di TASK-321 e dello studio D di TASK-312;
   qui si usa quello che decidono, senza toccare i loro file.

## Criteri di accettazione (del task intero)

- [ ] Dalla CLI, senza rete né chiavi, un giro a nuoto sta tutto fra la
      distanza minima e massima dalla riva scelte e parte e torna alla
      stessa spiaggia.
- [ ] La canoa dà gli stessi percorsi di prima, punto per punto.
- [ ] Ogni curva ha un nome a riva dove l'estratto ne ha uno entro 300 m.
- [ ] «Open water swim» si sceglie nell'app, con l'avviso di sicurezza
      approvato dall'utente.
- [ ] Un nuoto registrato (telefono nella boa o file dell'orologio) diventa
      un disegno nel Feed.
- [ ] (E) L'Apple Watch vibra alle curve e fuori rotta in una prova in
      acqua.

## File toccati

Questa PR, solo documenti:

```
docs/tasks/TASK-323.md
docs/DECISIONS.md
docs/STATUS.md
docs/INDEX.md
```

Le parti hanno i loro elenchi qui sopra, da confermare col Coordinatore
quando partono.

## Fuori scope

- Un'app per Garmin (Connect IQ) o per Wear OS; occhialini con lo schermo.
- La piscina.
- Parole, immagini e disegni nell'acqua: come per la canoa, solo forme del
  catalogo.
- La qualità dell'acqua (dati europei sulle acque di balneazione: licenza da
  verificare), le ordinanze, le bandiere, le boe dei campi di regata.
- I fiumi; il nuoto oltre la fascia.

## Domande aperte per l'utente

Una per volta, quando serve la parte:

1. (A1, dopo i campioni) La fascia: 20–150 m dalla riva? Le distanze:
   0,5–3 km?
2. (C) Il nome, l'avviso di sicurezza, la riga sotto il giro.
3. (E) La dipendenza per il target watchOS e la build nuova.

## Esito

*(si compila a fine task)*
