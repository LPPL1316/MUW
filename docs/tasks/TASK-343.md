# TASK-343 — Le sfide del mese: un tema per concorso, l'iscrizione, la galleria, l'archivio

**Stato**: In lavorazione — documenti in `main` (#648), parte A in `main`
(#657, `5303a198`), parte B nella PR #667
**Fase**: 4 · **Branch**: `feat/TASK-343-a-themed-contest-api` (A),
`feat/TASK-343-b-themed-contest-app` (B)
**ADR**: ADR-0296 (estende ADR-0260) · **Migrazione**: una, in A; il
numero lo dà il Coordinatore prima di dare il nome al file (il primo
libero in `main` il 2026-10-29 è 0039) · Numeri dati dal Coordinatore
il 2026-10-29

## Obiettivo

Il concorso di TASK-299 diventa una sfida del mese con un tema: chi
pubblica sceglie di iscrivere il suo disegno, ha una pagina con la
galleria delle iscrizioni, un archivio delle sfide passate e tre push.

Richiesta dell'utente del 2026-10-29 (testo incollato, «GPS Art e
challenge mensili», punto 4): «Sezione "Challenge" con il tema del mese
(es. "Animali", "Lettere"…) — Pagina della challenge: descrizione,
regole, date, premi/badge, numero di partecipanti — Partecipazione con un
disegno registrato nel periodo della challenge — Galleria delle
partecipazioni con ordinamento per più votati e più recenti — Sistema di
voto (un "mi piace" per disegno, niente autovoto) — Classifica finale e
badge per i vincitori sul profilo — Archivio delle challenge passate —
Notifiche: nuova challenge, ultimi 3 giorni, risultati». La proposta
(`out/gps-art-lacune/proposta.md` nel checkout principale) con
**l'iscrizione esplicita** e il voto che resta la reazione è stata
**approvata dall'utente con «Yes, as proposed»** lo stesso giorno.

## Contesto da leggere

- `CONCORSI.md` tutto (è il documento di dominio che questo task cambia)
- `DECISIONS.md` ADR-0260, ADR-0296, ADR-0272 (le importate non
  partecipano)
- `services/api/shaperoute_api/contests.py`: `PARTICIPATES_SQL`,
  `RANKED_SQL`, `ContestBody`, `Contests.open/close`, `_parser`
- `services/api/shaperoute_api/push.py` (`Kind`, `OWN_KINDS`, i testi,
  `data_of`) e `group_runs.py` `GroupRunClock` (un promemoria mandato una
  volta sola, `reminded_at`)
- App: `apps/mobile/src/contest/*`, `social/PublicParts.tsx`
  (`DrawingForm`, `VisibilityChips`), `api/drawings.ts` (`DrawingChoice`),
  `social/drawingOutbox.ts`, `notifications/notificationTap.ts`

## Cosa fare

### Parte A — API (migrazione, endpoint, push, comandi)

1. **Migrazione**: `contests.theme jsonb NULL` (titolo e descrizione per
   lingua: `{"en": {"title", "description"}, "it": …}`, `en`
   obbligatoria quando c'è), `contests.reminded_at timestamptz NULL`;
   tabella nuova `contest_entries (contest_id, drawing_id, user_id,
   created_at)`, chiave `(contest_id, drawing_id)`, `ON DELETE CASCADE`
   su concorso, disegno e account. Nessuna colonna nuova su `drawings` e
   `reactions` (CONCORSI §2).
2. **Chi partecipa**: un concorso **senza tema** resta com'è (tutti i
   post per tutti del periodo). Un concorso **con tema**: solo i disegni
   iscritti, oltre a tutte le regole di oggi (`PARTICIPATES_SQL`: per
   tutti, nel periodo, corsa registrata dall'app, non nascosto, non
   escluso). Il voto resta la reazione: una per account, mai la
   propria, non attraverso un blocco.
3. **Iscriversi**: `PUT /contests/{id}/entries/{drawing_id}` e `DELETE`,
   solo il proprietario, solo a concorso aperto e con tema, solo un
   disegno che oggi partecipa; `409` con un codice nuovo per ogni rifiuto
   (`contest_closed`, `not_entrant`; testi d'errore in inglese, codici in
   `schemas.py` e `api-error-codes.json`, come `no_contest`, con l'ok del Coordinatore). Quanti disegni per
   account: **nessun limite**, scelta dell'utente (sotto, «Scelte
   dell'utente»). Un disegno che smette di partecipare (reso
   privato, nascosto) esce dalla classifica da solo: la query lo rilegge.
4. **`GET /contests/current`** ha in più `theme` (tutte le lingue: l'app
   sceglie la sua, `en` se manca), `entrants` (gli account con almeno
   un disegno in gara) e, con il token, `entered` (gli id dei propri
   disegni iscritti).
5. **La galleria**: `GET /contests/{id}/entries?order=top|new&cursor=`,
   30 per pagina, ogni voce con posto in classifica, reazioni e il post
   come nel Feed (`FeedPostBody`, la traccia già tagliata di ADR-0114);
   senza i post attraverso un blocco con chi chiede.
6. **L'archivio**: `GET /contests?state=closed&cursor=`, i concorsi
   chiusi dal più recente: date, tema, vincitore e i primi tre.
7. **Push** (tre tipi nuovi in `push.py`, testi nelle cinque lingue da
   approvare, rispettano «Push notifications» di Settings):
   `contest_open` a tutti gli account con le push accese quando `open`
   apre un concorso con tema; `contest_last_days` tre giorni prima di
   `ends_at`, una volta sola (`reminded_at`, come `GroupRunClock`), agli
   account con le push accese che hanno pubblicato almeno un disegno e
   non sono iscritti; `contest_results` alla chiusura a chi ha
   partecipato (al vincitore resta `contest_won`). Un tocco apre la
   pagina della sfida.
8. **Comandi**: `open --theme FILE.json` (le cinque lingue, controllate
   prima di aprire); `standings` mostra il tema e le iscrizioni.
9. Tipi e fixture in `shared-types`; `CONCORSI.md` (§3, §7, §9, §10,
   §11 e un paragrafo nuovo per i temi), `API.md`.

### Parte B — app (dopo A in `main`)

1. **La scheda del Feed** mostra il titolo del tema; un tocco apre la
   **pagina della sfida**: tema e descrizione, date e giorni che
   restano, quanti partecipano, il premio (badge «Winner», post in cima
   per 7 giorni), «How it works», la galleria «Top» | «New» con le
   reazioni come nel Feed, e in fondo «Past challenges».
2. **«Past challenges»**: l'archivio, una scheda per sfida con tema,
   date, vincitore e i primi tre; un tocco apre il post.
3. **Iscriversi** nel modulo di pubblicazione (`DrawingForm`, fine corsa
   e «My activities»): l'interruttore «Enter “{theme}”» sotto
   `VisibilityChips`, solo con un concorso con tema aperto, visibilità
   «Everyone» e una corsa registrata dall'app; la chiamata parte dopo il
   salvataggio del disegno, anche dalla coda di `drawingOutbox`. Dal post
   già pubblicato si iscrive e si ritira dallo stesso menu.
4. Il tocco sulle tre push apre la pagina della sfida
   (`notificationTap.ts`).
5. **Il regolamento ufficiale** (`ContestRules.tsx`) dice il tema,
   l'iscrizione e quanti disegni: testo da approvare (CONCORSI §8).
6. Testi nelle cinque lingue da approvare prima del merge; impronta iOS
   invariata (`83793e26`), nessuna dipendenza nuova.

## Criteri di accettazione

- [x] Un concorso senza tema si comporta esattamente come oggi (i test
      di `test_contests.py` passano senza cambiarli).
- [x] In un concorso con tema un disegno non iscritto non è in
      classifica; iscritto sì; ritirato no.
- [x] L'iscrizione è rifiutata a concorso chiuso o senza tema, per un
      disegno di un altro, privato, per i soli follower, importato o
      pubblicato fuori dal periodo.
- [x] `GET /contests/current` dà `theme`, `entrants`, e `entered` solo
      con il token; la galleria ordina per classifica e per data e
      pagina con `cursor`; l'archivio dà i concorsi chiusi.
- [x] Ognuna delle tre push parte una volta sola e solo a chi deve
      (test con un `pusher` finto e l'orologio finto).
- [x] App: scheda con il tema, pagina, galleria nei due ordini,
      archivio, interruttore solo quando vale, tocco della push; con
      un'API senza tema tutto come oggi.
- [ ] Testi e regolamento approvati dall'utente; server e push solo con
      il sì dell'utente. (Testi e regolamento sì; server e push no.)

## File toccati

```
# Parte A
services/api/migrations/00NN_contest_themes.sql   (nuovo, numero dal Coordinatore)
services/api/shaperoute_api/contests.py
services/api/shaperoute_api/contest_entries.py    (nuovo: iscrizioni, galleria, archivio)
services/api/shaperoute_api/contest_clock.py      (nuovo: la push degli ultimi 3 giorni)
services/api/shaperoute_api/push.py
services/api/shaperoute_api/__main__.py
packages/shared-types/fixtures/api-error-codes.json
services/api/shaperoute_api/schemas.py              (il codice d'errore; engine.zip rifatto, ok del Coordinatore)
services/api/tests/test_contest_themes.py         (nuovo)
services/api/tests/test_contest_entries.py        (nuovo)
packages/shared-types/src/index.ts
packages/shared-types/fixtures/contest-themed.json (nuovo)
packages/shared-types/fixtures/contest-entries.json (nuovo)
docs/CONCORSI.md
docs/API.md
# Parte B
apps/mobile/src/contest/ContestCard.tsx
apps/mobile/src/contest/ContestPage.tsx           (nuovo)
apps/mobile/src/contest/ContestGallery.tsx        (nuovo)
apps/mobile/src/contest/PastContests.tsx          (nuovo)
apps/mobile/src/contest/EnterSwitch.tsx           (nuovo)
apps/mobile/src/contest/contestApi.ts
apps/mobile/src/contest/ContestRules.tsx
apps/mobile/src/social/PublicParts.tsx
apps/mobile/src/api/drawings.ts
apps/mobile/src/social/drawingOutbox.ts
apps/mobile/src/notifications/notificationTap.ts
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/es.ts
apps/mobile/src/i18n/fr.ts
apps/mobile/src/i18n/it.ts
apps/mobile/src/contest/contestDoor.ts            (nuovo)
apps/mobile/src/contest/sendEntry.ts              (nuovo)
apps/mobile/src/contest/FeedContest.tsx
apps/mobile/src/contest/contestKept.ts
apps/mobile/src/contest/useClock.ts               (nuovo)
apps/mobile/src/screens/ProfileLayerContest.test.tsx (nuovo)
apps/mobile/src/contest/EnterOnPost.tsx           (nuovo)
apps/mobile/src/social/DrawingCard.tsx            (una riga, dopo TASK-339 B, su parola del Coordinatore: non in questa PR)
docs/CONCORSI.md
apps/mobile/src/screens/ProfileLayer.tsx          (monta ContestPage, ok del Coordinatore 2026-10-30)
apps/mobile/src/notifications/usePushNotifications.ts
apps/mobile/src/social/drawingsDoor.ts
apps/mobile/src/social/PublicRow.tsx
apps/mobile/src/activities/RunEnd.tsx
apps/mobile/src/activities/ActivityCard.tsx
(e i test accanto a ogni file)
# Tutte e due
docs/STATUS.md
docs/DECISIONS.md
docs/tasks/TASK-343.md
```

## Parte B: esito della PR (2026-10-30)

Scheda col titolo del tema, pagina della sfida, galleria «Top» | «New», «Past
challenges», interruttore «Enter “{theme}”» nel modulo (fine corsa e «My
activities»), iscrizione anche dalla coda di `drawingOutbox`, tocco delle tre
push, regolamento della sfida. Con l'API di oggi (c7a83347, senza 0039)
l'app resta com'è: lo provano `fixtures/contest.json` e gli endpoint nuovi che
rispondono 404. I dettagli sono in `CONCORSI.md` §15.

**Resta aperto, il task non è `Done`:**

1. ~~i testi nelle cinque lingue e il regolamento~~: **approvati dall'utente il
   2026-10-30** con «Approve them all», sull'elenco nella PR #667, e con «sì
   testi 667» nella chat del Coordinatore (riferito dal Coordinatore: copre i
   testi e il regolamento alla testa `2af16096`). Da allora i testi non sono
   cambiati; un cambio vuole un sì nuovo;
2. la riga che monta `EnterOnPost` in `DrawingCard`: dopo TASK-339 B, su parola
   del Coordinatore. Il componente ha i suoi test ma oggi nessuno lo mostra;
   sul post già pubblicato si iscrive e si ritira da «My activities»;
3. il server con la migrazione 0039: lo decide l'utente, insieme a questa parte.

**Prova nel simulatore** (2026-10-30, chiesta dal Coordinatore; iPhone Air, Expo
Go, API vera in locale su un database usa e getta):

- **Con un tema** (API del branch, `open --theme`, sfida «Animals», due account):
  la scheda del Feed ha il titolo; la pagina si apre con date, partecipanti,
  premio, regolamento e galleria «Top» | «New»; un post aperto dalla galleria
  torna alla pagina com'era, e «Start» non resta sotto la pagina. Da «My
  activities» e dal modulo di fine corsa (corsa col GPS simulato) iscrizione e
  ritiro arrivano all'API (`entered`, `entrants`, galleria letti dall'API).
- **Col server di oggi** (API di c7a83347, migrazioni fino alla 0038, il
  concorso senza tema aperto e prima di aprirlo): niente di nuovo. Prima del
  concorso nessuna scheda; dopo «MuW contest», «How it works» e il regolamento
  di prima; nessun interruttore nel modulo; nessuna richiesta di galleria o
  archivio.

**La prova ha trovato tre difetti, corretti**: l'interruttore nativo si accendeva
e non si spegneva (ora è `SwitchRow`, con «On» e «Off», testi già approvati);
il modulo non conosceva la sfida se «Feed» non era stato aperto (`ProfileLayer`
la chiede all'accesso); dopo un'iscrizione la scheda restava vecchia fino al pull
(`tellEntered`). I testi approvati non sono cambiati.

**Non provato**: il tocco sulle tre push (Expo Go non riceve push: solo test) e
l'interruttore sul post aperto, che non è montato. **Difetto di prima, non
corretto qui**: il regolamento aperto dalla scheda del Feed sta sotto la barra
di stato, perché il Pager azzera il margine in alto; col tema si apre dalla
pagina e il problema non c'è.

## Fuori scope

- Premi con valore (CONCORSI §12: è un concorso a premio di legge).
- Un giudice o un controllo automatico del tema: chi chiude esclude a
  mano con `--exclude`, come oggi.
- Più concorsi aperti insieme; sfide per città o per sport.
- Il gioco delle forme di «Play» (TASK-296): ha già le sue «challenges»,
  separate da queste. Nei testi dell'app le due cose non devono
  confondersi (da guardare con i testi).
- Disegni su più giorni.

## Scelte dell'utente

1. **Quanti disegni può iscrivere un account in una sfida: nessun
   limite.** Proposta dell'agente: uno, cambiabile fino alla fine. Il
   2026-10-30 l'utente ha risposto «Several» e poi, fra «Up to 3» e «No
   limit», **«No limit»**: ogni disegno pubblicato nel periodo che
   partecipa si può iscrivere. Conseguenza: la galleria può mostrare più
   volte lo stesso autore; ogni disegno conta le sue reazioni da solo.
   Il regolamento ufficiale (parte B, punto 5) lo dice.

## Esito

### Parte A — in `main` (#657, `5303a198`, 2026-10-30)

Migrazione `0039_contest_themes.sql` (numero confermato dal Coordinatore),
iscrizioni, galleria, archivio, le tre push, `open --theme`, `standings` col
tema. CI verde. In locale: `test_contest_themes.py`,
`test_contest_entries.py`, `test_contests.py` (invariato), `test_push.py`,
`test_imported_runs.py`; la suite intera dell'API solo in CI. Le regole sono
in `CONCORSI.md` §15, gli endpoint in `API.md` «Le sfide del mese».

**Il server non è aggiornato**: serve la migrazione 0039 e lo decide
l'utente. Nessun concorso con tema è stato aperto, nessuna delle tre push è
mai partita.

**I testi delle tre push**: sì dell'autopilota nelle cinque lingue,
«accettati su delega dell'utente del 2026-10-29, da rivedere» (riferito dal
Coordinatore: vale la delega scritta dall'utente fino alle 17:15 del
2026-10-30). **Da rivedere**: «Corri il tuo disegno» e «pubblica una corsa»
parlano solo di corsa, da cambiare se una sfida vale anche per bici o canoa.

**Quattro scelte dell'agente** su delega dell'utente, da guardare con i
testi:

1. un concorso senza tema non prende iscrizioni e non manda nessuna delle tre
   push (`409 contest_closed`, il corpo di `GET /contests/current` resta
   quello di prima);
2. «3 days left» va a chi ha pubblicato almeno un disegno per tutti, di
   qualunque data, e non ne ha iscritto nessuno in questa sfida;
3. i risultati vanno a chi ha un disegno in classifica alla chiusura, anche
   escluso con `--exclude`, tranne il vincitore (che ha `contest_won`);
4. galleria e archivio rispondono anche senza token: 30 voci per pagina la
   galleria, 10 sfide l'archivio.

**Rispetto ai «File toccati»**: `__main__.py` non è servito (l'orologio parte
da `install_contests`, attorno al lifespan dell'app, come `GroupRunClock`);
`engine.zip` è rifatto perché contiene `schemas.py`, l'unico file cambiato
dentro lo zip.

### Parte B

Nella PR #667: vedi «Parte B: esito della PR», sopra.
