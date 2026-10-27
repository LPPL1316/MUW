# TASK-316 — Explore pronto prima: i disegni dei paesi vicini e della regione

**Stato**: In corso
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
   (`route_store`, archivio). Il prefetch non fa mai partire un calcolo
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
   finito, o `null`. Legge soltanto con `get` dello stesso store dei
   lavori: nessun lavoro, nessuna zona caricata, nessun motore, niente di
   scritto. Un POST: conta uno nel limite al minuto come gli altri.
2. `draw_examples --all`: oltre a cerchio, cuore e stella, gli altri
   cinque disegni e le sei parole che l'app chiede a una città, con la
   stessa richiesta dell'app (parole a 3 km a lettera, penna alzata, stile
   `round`). La lista è uguale a quella dell'app: un test legge la stessa
   fixture del test dell'app.
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
   niente di nuovo: tutto resta com'è oggi.

### Parte C — Sul server, dopo Apple e con il sì dell'utente

8. Aggiornamento del server con la parte A (dal Coordinatore, una
   pubblicazione alla volta), poi, di notte:
   `draw_examples --all --around Trento --around Caldonazzo`. Almeno 100
   disegni tenuti; si contano nella cartella `routes/` e nel log.
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
packages/shared-types/src/keptRoutes.ts             (nuovo)
packages/shared-types/src/index.ts                  (una riga di export)
packages/shared-types/fixtures/kept-routes-request.json   (nuovo)
packages/shared-types/fixtures/kept-routes.json           (nuovo)
packages/shared-types/fixtures/city-examples.json         (nuovo)
docs/API.md                                         (la sezione dell'endpoint)
```

Parte B:

```
apps/mobile/src/explore/regionAhead.ts              (nuovo)
apps/mobile/src/explore/regionAhead.test.ts         (nuovo)
apps/mobile/src/api/keptRoutes.ts                   (nuovo)
apps/mobile/src/api/keptRoutes.test.ts              (nuovo)
apps/mobile/src/explore/exploreAhead.ts             (chiama regionAhead dopo i paesi)
apps/mobile/src/explore/exploreAhead.test.tsx
apps/mobile/src/explore/exampleRoutes.ts            (legge il file del paese)
apps/mobile/src/explore/cityExamplesFixture.test.ts (nuovo: la fixture comune)
```

Documenti (ogni parte): `docs/tasks/TASK-316.md`, `docs/STATUS.md`,
`docs/DECISIONS.md`.

## Fuori scope

- Calcolare disegni nuovi dal prefetch, o scaricare zone nuove: mai
  (condizione 1 del Coordinatore).
- Sapere se il telefono è in Wi-Fi: vorrebbe un modulo nativo.
- Bici e pagaia: gli esempi preparati sono quelli della corsa.
- Cambiare l'aspetto di «NEARBY TOWNS» o delle carte.
- Le parole di TASK-279 B e di TASK-311: qui solo le sei che l'app chiede
  già.

## Al merge

- A e B si possono mergiare prima di Apple: B senza la parte A sul server
  non chiede niente di nuovo.
- C solo dopo Apple, con il sì dell'utente e il via del Coordinatore.

## Esito

*(a fine task)*
