# TASK-316 — Explore pronto prima: i disegni dei paesi vicini e della regione

**Stato**: In corso · A e B in `main`; C dopo Apple
**Fase**: 4 · **Branch**: `docs/TASK-316-explore-ahead` (documenti), poi
`feat/TASK-316-a-kept-routes` (A), `feat/TASK-316-b-region-ahead` (B)

## Obiettivo

Toccato un paese vicino in «Explore», i suoi disegni ci sono già tutti;
e il server tiene già pronti almeno 100 disegni dei paesi attorno a Trento
e Caldonazzo.

Richiesta dell'utente del 2026-10-27: «Explore - disegno troppo lento
quando si seleziona una città vicino a me: appena la apro deve già iniziare
a scaricare i vari disegni nelle città vicine, anzi addirittura nella
regione, e fai almeno 100 disegni da tenere in server». Numeri e condizioni
dal Coordinatore lo stesso giorno: TASK-316, ADR-0276.

## Perché oggi è lento

All'apertura (TASK-236, TASK-306) ognuno dei sei paesi vicini chiede solo
cerchio, cuore e stella. Toccato il paese, gli altri undici esempi (luna,
cavallo, lumaca, testa di cane, testa di coniglio, poi CIAO, LOVE, AMORE,
RUN, HELLO, MUW) partono soltanto allora, uno alla volta. Dove il server
non li tiene, ognuno è un calcolo del motore: 7–19 s sul server
(misure di TASK-168), e minuti se manca la zona.

Il telefono, da solo, non può prepararne cento: la coda delle richieste
lascia a ciò che si prepara in anticipo 10 POST al minuto (ADR-0248, su
30 dell'API). Cento disegni chiesti uno a uno vorrebbero più di dieci
minuti con l'app aperta.

## Contesto da leggere

- `docs/tasks/TASK-236.md` (i paesi vicini e i loro esempi),
  `docs/tasks/TASK-306.md` («Explore» preparato all'apertura),
  `docs/tasks/TASK-287.md` (la coda).
- `docs/DECISIONS.md` ADR-0136 (gli esempi tenuti dall'API), ADR-0256
  (l'archivio dei percorsi), ADR-0266, ADR-0248.
- `docs/API.md`, `POST /route-jobs`.

## Le condizioni del Coordinatore (2026-10-27)

1. L'app prende in anticipo **solo** disegni che il server ha già: tenuti
   (`route_store`; l'archivio no, per la nota sui dati più sotto). Il prefetch non fa mai partire un calcolo
   nuovo né una zona nuova. L'API di oggi non distingue «già pronto» da
   «da calcolare»: serve un endpoint di sola lettura (parte A), sul
   server dopo Apple.
2. I 100 e più disegni li calcola il server una volta, con
   `draw_examples --all` fuori dalle ore di punta, per Trento, Caldonazzo
   e i paesi attorno (parte C): dopo Apple e con il sì dell'utente; disco e
   tempo scritti qui.
3. Valgono le condizioni di TASK-306: dopo l'animazione d'apertura, mai
   durante corsa, navigazione o background; impronta iOS `83793e26`;
   nessuna dipendenza nuova. Tetto per sessione, coda «prefetch» dietro
   tutto il resto.

## Cosa fare

### Parte A — API: i percorsi già tenuti, in sola lettura

1. `POST /kept-routes`, corpo `{"requests": [...]}`: fino a 16 richieste
   di forma o di parola come quelle di `POST /route-jobs` (nessuna
   immagine, nessuna forma spostata). Risponde `{"routes": [...]}`, uno per
   richiesta nello stesso ordine: il risultato tenuto, come lo dà un lavoro
   finito, o `null`. Legge soltanto con `get`: nessun lavoro, nessuna zona
   caricata, nessun motore, niente di scritto (un test conta che il motore
   non viene mai chiamato). Un POST: conta uno nel limite al minuto come
   gli altri.
   **Niente dati di nessuno** (nota del Coordinatore): legge solo i file
   dei centri (`route_store.py`: centri delle città e punti sull'acqua),
   **mai l'archivio** di TASK-297 A, che tiene anche i percorsi disegnati
   dalla posizione degli utenti, senza account: con una risposta «tenuto o
   no» un punto direbbe se qualcuno ci ha disegnato. Nessun account, nessun
   post. Un test disegna lo stesso percorso da casa di un utente e dal
   centro di una città: torna solo il secondo.
2. `draw_examples --all`: oltre a cerchio, cuore e stella, gli altri
   cinque disegni e le sei parole che l'app chiede a una città, con la
   stessa richiesta dell'app (parole a 3 km a lettera, penna alzata, stile
   `round`). La lista è uguale a quella dell'app: un test legge la stessa
   fixture del test dell'app. Le parole sono il **punto 7 di TASK-279 B**
   («facoltativo, `draw_examples` con le parole»): il Coordinatore l'ha
   spostato qui il 2026-10-27; in `TASK-279.md` mette lui la riga di
   rimando, con una PR di soli documenti, dopo il merge di A.
3. `draw_examples --around CITTÀ`: i paesi che `GET /nearby-cities` dà
   attorno alla città, ognuno dal **suo** punto di `/nearby-cities` (per
   un paesino non è quello di `/cities`, TASK-236), e i paesi attorno a
   quelli, fino a `--towns` paesi (20 di base).

### Parte B — App: i disegni della regione preparati all'apertura

4. Dopo i paesi vicini, «Explore» preparato all'apertura (TASK-306) chiede
   i paesi della regione: `GET /nearby-cities` dai punti dei sei paesi
   vicini, senza doppioni, i più vicini all'utente prima, fino a 18 paesi
   in tutto.
5. Per ogni paese, i sei vicini prima: un solo `POST /kept-routes` con le
   sue quattordici richieste, nella coda «prefetch». Ciò che torna si
   scrive in un file del paese nella cache del telefono e vale 7 giorni;
   un paese senza niente si richiede dopo un giorno. Tetto: 150 disegni
   scaricati per sessione.
6. Toccato un paese, i suoi esempi partono da quel file: le carte già
   pronte si vedono subito, e all'API si chiedono solo quelle che mancano,
   come oggi. Le carte dei paesi vicini lo leggono anche loro: un cerchio,
   un cuore o una stella già nel file non si chiede più.
7. Con un server senza `/kept-routes` (404, l'API di oggi) non si chiede
   niente di nuovo: tutto resta com'è oggi (un test: le carte dei paesi
   vicini si disegnano come prima, e nessun file viene scritto).

### Parte C — Sul server, dopo Apple e con il sì dell'utente

8. Aggiornamento del server con la parte A, dal Coordinatore e una
   pubblicazione alla volta (`DEPLOY.md` F.12), poi il giro dei disegni di
   notte: alle 23:00 UTC (mezzanotte in Italia), finito prima delle copie
   delle 02:30 UTC. Sul server, in `/root/shaperoute`:

   ```
   # 1. Prima: l'immagine per tornare indietro e il segno del momento
   docker tag shaperoute-api:latest shaperoute-api:before-task316
   touch data/cache/routes/.before-task316
   ls data/cache/routes/*.json | wc -l          # i disegni tenuti prima
   # 2. L'aggiornamento (F.12): main con A, poi build e up dell'API
   git fetch origin && git checkout <commit di main con A>
   docker compose build api && docker compose up -d api
   # 3. Il giro, dentro il contenitore dell'API (la chiave resta lì)
   nohup docker compose exec -T api python -m shaperoute_api.draw_examples \
     --api http://127.0.0.1:8000 --all Trento Caldonazzo \
     --around Trento --around Caldonazzo \
     > data/draw-examples-<data>-task316.log 2>&1 &
   # 4. Alla fine: quanti disegni nuovi, e l'ultima riga del log
   find data/cache/routes -name '*.json' -newer data/cache/routes/.before-task316 | wc -l
   tail -3 data/draw-examples-<data>-task316.log
   ```

   Per aspettare il giro via ssh: `pgrep -f "[d]raw_examples"` o l'ultima
   riga del log, mai `pgrep -f "draw_examples"` (trova sé stesso). Almeno
   100 disegni nuovi; un paese «not found by the city search» si rifà da
   solo, per nome.

   **Come si torna indietro**:
   - l'endpoint: `docker tag shaperoute-api:before-task316
     shaperoute-api:latest && docker compose up -d api` (F.12); l'app, con
     un 404, fa come prima;
   - i disegni sono una cache, come gli altri esempi. Per toglierli:
     `find data/cache/routes -name '*.json' -newer
     data/cache/routes/.before-task316 -delete`;
   - le zone nuove: `find data/cache -maxdepth 1 -name 'foot_*' -newer
     data/cache/routes/.before-task316`, spostate in
     `data/cache/before-task316/` come in TASK-206.
9. **Disco e tempo** (stima, da riscrivere con le misure):
   - un percorso tenuto pesa circa 100 kB (`route_store.py`): 150 disegni
     sono circa 15 MB;
   - una zona nuova circa 22 MB (GraphML 15 MB e pickle 7,5 MB) e circa
     un minuto dall'estratto Italia. Una decina di paesi attorno a Trento
     e Caldonazzo ha già la sua zona (TASK-236, TASK-168); per altri 10–15
     paesi sono 220–330 MB. Sul Volume da 70 GB è meno dell'1 %;
   - un disegno nuovo costa 7–19 s sul server: 150 sono 20–50 minuti, più
     10–15 minuti di zone. Meno di un'ora e mezza, di notte.

## Costi sul telefono

- **Dati**: circa 100 kB a disegno. La prima apertura in una regione nuova
  scarica al massimo 150 disegni (circa 15 MB), una volta ogni 7 giorni;
  le aperture dopo, quasi niente. Senza un modulo nativo nuovo l'app non sa
  se è in Wi-Fi o su rete mobile (`expo-network` cambierebbe l'impronta
  iOS): il tetto è lo stesso per tutte e due, e i paesi della regione
  vengono solo dopo i sei vicini.
- **Disco**: un file per paese nella cache (il sistema può svuotarla), al
  massimo 18 paesi, circa 15 MB.
- **Batteria**: da 6 a 18 POST e altrettante scritture, nessun calcolo
  sul telefono.

## Criteri di accettazione

- [ ] `POST /kept-routes` risponde i percorsi tenuti e `null` per gli altri,
      senza far partire nessun lavoro (un test lo conta) e senza caricare
      zone.
- [ ] `POST /kept-routes` non restituisce mai un percorso disegnato dalla
      posizione di un utente: solo i file dei centri, mai l'archivio (un
      test).
- [ ] `POST /kept-routes` rifiuta più di 16 richieste e le immagini (422).
- [ ] `draw_examples --all` chiede le otto forme e le sei parole dell'app,
      con le stesse richieste: un test Python e uno dell'app leggono la
      stessa fixture.
- [ ] `draw_examples --around` disegna dai punti di `/nearby-cities`.
- [ ] All'apertura l'app chiede `/kept-routes` per i sei paesi vicini, poi
      per quelli della regione, mai più di 18 paesi né 150 disegni per
      sessione, nella coda «prefetch»; mai `POST /route-jobs` per un
      disegno della regione.
- [ ] Toccato un paese preparato, le sue carte pronte si vedono senza
      nessuna richiesta all'API.
- [ ] Con 404 su `/kept-routes` l'app si comporta come oggi.
- [ ] Niente prima della fine dell'animazione, durante corsa, navigazione
      o background (le stesse guardie di TASK-306).
- [ ] Impronta iOS `83793e26` invariata, nessuna dipendenza nuova.
- [ ] Parte C: almeno 100 disegni tenuti sul server, e le misure scritte
      qui.

## File toccati

Parte A:

```
services/api/shaperoute_api/kept_routes.py          (nuovo)
services/api/shaperoute_api/__main__.py             (una riga: install_kept_routes)
services/api/shaperoute_api/draw_examples.py        (--all, --around, --towns)
services/api/shaperoute_api/city_examples.py        (nuovo: la lista dell'app)
services/api/tests/test_kept_routes.py              (nuovo)
services/api/tests/test_draw_examples_all.py        (nuovo)
packages/shared-types/src/keptRoutes.ts             (nuovo, a parte come signals.ts)
packages/shared-types/test/keptRoutes.test.ts       (nuovo)
packages/shared-types/fixtures/kept-routes-request.json   (nuovo)
packages/shared-types/fixtures/kept-routes.json           (nuovo)
packages/shared-types/fixtures/city-examples.json         (nuovo)
docs/API.md                                         (la sezione dell'endpoint)
```

Parte B:

```
apps/mobile/src/explore/regionAhead.ts              (nuovo)
apps/mobile/src/explore/regionAhead.test.ts         (nuovo)
apps/mobile/src/explore/regionStore.ts              (nuovo: i file, come paddle/aheadStore.ts)
apps/mobile/src/api/keptRoutes.ts                   (nuovo)
apps/mobile/src/api/keptRoutes.test.ts              (nuovo)
apps/mobile/src/explore/exploreAhead.ts             (chiama regionAhead dopo i paesi)
apps/mobile/src/explore/exploreAhead.test.tsx
apps/mobile/src/explore/exampleRoutes.ts            (legge il file del paese)
apps/mobile/src/explore/NearbyTowns.tsx             (una riga: useRegionAhead)
apps/mobile/src/explore/cityExamplesFixture.test.ts (nuovo: la fixture comune)
```

`NearbyTowns.tsx` perché `App.tsx` ferma `prepareExplore` appena «Explore»
si apre (`exploreSeen`): senza la riga il giro si fermerebbe proprio lì. Con la riga
riprende dai file finché «Near me» è in pagina; `App.tsx` resta com'è.

Documenti (ogni parte): `docs/tasks/TASK-316.md`, `docs/STATUS.md`,
`docs/DECISIONS.md`.

## Fuori scope

- Calcolare disegni nuovi dal prefetch, o scaricare zone nuove: mai
  (condizione 1 del Coordinatore).
- Sapere se il telefono è in Wi-Fi: vorrebbe un modulo nativo.
- Bici e pagaia: gli esempi preparati sono quelli della corsa.
- Cambiare l'aspetto di «NEARBY TOWNS» o delle carte.
- Le parole nuove di TASK-279 B e di TASK-311: qui solo le sei che l'app
  chiede già (il punto 7 di TASK-279 B, `draw_examples` con le parole, è
  fatto qui).

## Al merge

- A e B si possono mergiare prima di Apple: B senza la parte A sul server
  non chiede niente di nuovo.
- C solo dopo Apple, con il sì dell'utente e il via del Coordinatore.

## Esito

A e B in `main` il 2026-10-28. La parte A è la #590 (`07f98951`):
`POST /kept-routes` in sola lettura e `draw_examples --all --around`. La
parte B è la #593 (`bf68d9cf`): all'apertura i 6 paesi vicini e poi
quelli della regione, 18 in tutto, chiedono i loro 14 esempi a
`/kept-routes`, una richiesta a paese, nella coda «prefetch». Il telefono
li tiene 7 giorni, al massimo 150 disegni a sessione. Toccato un paese
preparato, le carte sono già pronte. Con il server di oggi (404) tutto
resta com'era.

Emerso nel lavoro: l'archivio di TASK-297 A non ha `user_id`, ma tiene
anche i percorsi disegnati **dalla posizione degli utenti**. Con una
risposta «tenuto o no» un punto direbbe se qualcuno ci ha disegnato.
Quindi `/kept-routes` legge **solo `route_store`** (i centri delle città e
i punti sull'acqua), **mai l'archivio**, con un test. Il punto 7 di
TASK-279 B (`draw_examples` con le parole) è fatto qui. Un'altra cosa
emersa: `App.tsx` ferma il prefetch appena «Explore» si apre
(`exploreSeen`), quindi il giro riparte anche da «Near me», con una riga
in `NearbyTowns.tsx`.

Impronta iOS `83793e26`, invariata. Non provato nel simulatore né sul
telefono: finché il server non ha A non c'è niente da vedere.

Resta la **parte C**, dopo Apple e con il sì dell'utente: aggiornare il
server con A e lanciare di notte `draw_examples --all Trento Caldonazzo
--around Trento --around Caldonazzo` (i comandi e il ritorno indietro sono
nella parte C). Poi qui le misure vere di disco e tempo.
