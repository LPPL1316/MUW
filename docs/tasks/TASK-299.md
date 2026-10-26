# TASK-299 — Il primo concorso: il post con più reazioni vince

**Stato**: In lavorazione · documenti in `main` (#549) · A (API) in `main` (#562, `5f762ae7`) · B (app) da fare
**Fase**: 4 · **Branch**: `docs/TASK-299-proposal` (documenti),
`feat/TASK-299-a-contest-api` (A), `feat/TASK-299-b-contest-app` (B)
**Dipende da**: TASK-117 (i disegni pubblicati), TASK-119 (le reazioni),
TASK-118 (il Feed), TASK-121 e TASK-291 (blocchi, segnalazioni, contenuti
nascosti), TASK-262 A (le push), TASK-116 e TASK-278 (il profilo)
**ADR**: ADR-0260

## Obiettivo

Il primo concorso di MuW: nel periodo del concorso vince il post pubblicato
con più reazioni. Il premio **non ha valore**: il badge «Winner» sul
profilo, il post in cima al Feed per una settimana, una push. Il server
decide chi partecipa, chi vince e quando; l'app mostra. Le regole sono in
`docs/CONCORSI.md`.

## Contesto

L'utente, il 2026-10-24: «vorrei fare il primo concorso a premio che il
vincitore, chi ha più like nel post, vince una maglietta». Fra tre strade
— premio simbolico subito; la maglietta a un disegno scelto da una giuria;
la maglietta a chi ha più like, in regola col DPR 430/2001 — ha scelto
**premio simbolico, subito**. La proposta con i default
(`out/concorso-proposta.md` del Mac; `out/` è ignorato da git) ha avuto
il suo «Sì, così» lo stesso giorno: scheda in cima al Feed, regolamento da
«How it works», badge sul profilo, post vincitore in evidenza 7 giorni,
una push al vincitore; conta ogni reazione, una per account, mai la
propria.

**Perché senza maglietta.** In Italia un concorso con un premio di valore
è un «concorso a premio» (DPR 430/2001): promotore un'impresa,
regolamento, comunicazione al Ministero, cauzione, verbale di un notaio o
di un funzionario camerale. Oggi MuW è di una persona, non di una ditta;
i costi superano la maglietta. Un badge e la visibilità non hanno valore
economico: il primo concorso resta fuori da quella legge. La maglietta è
un **secondo concorso**, quando ci sarà la ditta, da confermare col
commercialista («Seguiti da aprire»).

## Condizioni (dal Coordinatore, 2026-10-24)

1. **Regolamento ufficiale nell'app** (App Store 5.3 e le regole di
   Google Play sui concorsi): dalla scheda si apre il regolamento, che
   dice chi organizza (MuW), le date, come si vince, che il premio non ha
   valore, e che **Apple e Google non sponsorizzano né sono coinvolte**.
   Il testo lo approva l'utente.
2. **Contro i trucchi**: conta una reazione per account, mai la propria.
   Non contano i post nascosti o segnalati e nascosti (TASK-121,
   TASK-291), né gli account bloccati da chi ha pubblicato. Valutare se
   escludere gli account nati durante il concorso (valutato in
   `CONCORSI.md` §5: contano, con il controllo alla chiusura). Ogni
   regola con un test deterministico, e qui il perché.
3. Nessun acquisto né requisito per partecipare oltre l'account. Il premio
   resta simbolico, badge ed evidenza, come ha scelto l'utente; la
   maglietta è un concorso a parte, quando c'è la ditta.
4. I testi nelle cinque lingue (scheda, regolamento, push, badge) li
   approva l'utente **prima del merge**.
5. **Chiusura**: il comando proclama il vincitore una sola volta, anche se
   gira due volte (`UPDATE` condizionato), con un test. Pari merito con una
   regola deterministica.
6. App: impronta iOS invariata (`83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3`),
   nessuna dipendenza nuova. La scheda nel Feed si vede solo se il server
   ha un concorso in corso; con 404 o senza rete, niente.
7. Server dopo Apple e con l'ok dell'utente. «File toccati» completi al
   Coordinatore prima del codice di ogni parte; per ogni PR «#NNN pronta».

**File il 2026-10-24**: `feed.py`, `reactions.py`, `FeedScreen.tsx`,
`ProfileHeader.tsx` e `DrawingCard.tsx` liberi. `push.py` è della #525
(TASK-291) e della #540 (TASK-296 C, poi entrata in `main`): la push del
concorso sta in un file nuovo e in `push.py` si aggiungono solo il tipo
dell'evento e il suo testo; non si aspetta la #525, chi entra dopo si
riallinea. Migrazioni: 0024 della #525, 0026 e 0027 in `main`: questa
**da 0028 in su**, il numero al merge. `app.py` è della #461: una riga.

## Contesto da leggere

- `docs/CONCORSI.md`, tutto;
- `docs/API.md` («Reactions», «Feed», «Profile», «Push notifications»:
  come si scrive un endpoint con e senza account) e `docs/DATABASE.md`
  («Com'è oggi»: `drawings`, `reactions`, `blocks`);
- `services/api/shaperoute_api/reactions.py` (la tabella, una a testa),
  `feed.py` (come un post si legge con il suo autore: `LISTED_COLUMNS`,
  `_details`), `drawings.py` (`shown_sql`, `published_count_sql`),
  `follows.py` (`apart_sql`), `push.py` (`Kind`, `OWN_KINDS`, `TEXTS`,
  `PushEvent`), `game_backfill.py` (com'è fatto un comando
  `python -m`), `profiles.py` (`PublicProfileBody`);
- per B: `docs/UI.md` («Feed», il profilo), `apps/mobile/src/screens/FeedScreen.tsx`
  (`ListHeaderComponent`), `src/game/gameCatalog.ts` (una risposta tenuta
  sul telefono e `useSyncExternalStore`), `src/feed/FeedPost.tsx` (come si
  disegna l'anteprima di un post), `src/profile/ProfileHeader.tsx`,
  `src/social/DrawingCard.tsx`, `src/notifications/notificationTap.ts`.

## Parte A — API: il concorso, la classifica, la chiusura

1. **Migrazione** `00NN_contests.sql` (numero al merge, da 0028): la
   tabella `contests` di `CONCORSI.md` §9, un solo concorso aperto alla
   volta (indice unico parziale su `closed_at IS NULL`).
2. **`contests.py`** (nuovo):
   - la condizione SQL «partecipa» (`CONCORSI.md` §3) e la query della
     classifica, una sola, usata dall'endpoint e dai comandi: reazioni di
     altri account, non attraverso un blocco con l'autore, lasciate entro
     `ends_at`; l'ordine di §4;
   - `GET /contests/current`: con la sola chiave dell'API il concorso
     aperto, o chiuso da meno di 7 giorni, con i primi tre e il vincitore;
     con un token anche `mine`, e fuori da `top` i post attraverso un
     blocco con chi chiede; `404 no_contest` altrimenti (§10);
   - i comandi `open`, `standings`, `close` (§11), `close` idempotente
     con l'`UPDATE` condizionato, `--exclude` e `--dry-run`;
   - la push `contest_won` al vincitore, mandata da qui dopo il commit
     con il `Pusher` di `push.py`.
3. **`push.py`**: il `Kind` `contest_won` in `OWN_KINDS`, il suo testo
   nelle cinque lingue (da approvare, sotto). **`app.py`**: la riga del
   router.
4. **`profiles.py`**: `contest_wins` in `PublicProfileBody`;
   **`accounts.py`**: lo stesso campo in `UserBody` (il proprio profilo,
   `GET /me`), in aggiunta, 0 per tutti oggi.
5. **`shared-types`**: i tipi `Contest`, `ContestEntry`, `ContestMine` e
   `contest_won` in `PushKind`, in fondo a `index.ts`; fixture
   `contest.json`, `contest-closed.json`; `contest_wins` nelle fixture del
   profilo.
6. **Test deterministici** (`test_contests.py`), ognuno per una regola:
   la propria reazione non conta; una reazione attraverso un blocco non
   conta; un disegno `followers` o `only_me` non partecipa; uno pubblicato
   prima o dopo il periodo no; una reazione dopo `ends_at` no; un disegno
   nascosto (`hidden_at`, quando la #525 è in `main`) no; pari merito per
   cuori MuW, poi il più vecchio; `mine` con il posto giusto; `top` senza
   il post attraverso un blocco con chi chiede; `close` due volte: un
   vincitore, una push; `--exclude`; `--dry-run` non scrive; `open` con un
   concorso aperto o con `to ≤ from` rifiuta; 404 senza concorso e otto
   giorni dopo la chiusura; la corsa vincitrice cancellata lascia
   `contest_wins`; l'account cancellato lascia il concorso senza
   vincitore.
7. **Documenti**: `API.md` («Contest»), `DATABASE.md` (`contests`),
   `CONCORSI.md` (com'è fatta), `STATUS.md`, questo file.

## Parte B — App: la scheda nel Feed, il badge, la fascia

Parte dopo che A è in `main`. L'elenco dei file va al Coordinatore prima.

1. `src/contest/` (nuovo): `contestApi.ts` (il `GET`, letto senza
   fidarsi), `contestKept.ts` (l'ultima risposta sul telefono,
   `contest.json`, come `gameCatalog.ts`; un 404 la cancella),
   `useContest.ts` (chiesto quando il Feed si apre e si aggiorna),
   `daysLeft.ts`, `ContestCard.tsx`, `WinnerCard.tsx`, `ContestRules.tsx`.
2. `FeedScreen.tsx`: la scheda nell'intestazione, sotto la lente, solo
   con un concorso; un tocco su uno dei tre apre il disegno come un post
   (`useDrawingsDoor`); «How it works» apre il regolamento.
3. `ProfileHeader.tsx`: il badge «Winner» sotto il nome quando
   `contest_wins > 0` (`UserProfilePage.tsx` e `ProfileHome.tsx` lo
   passano). `DrawingCard.tsx`: la fascia «Winner» sul disegno vincitore
   del concorso tenuto sul telefono.
4. La push `contest_won` porta `drawing_id`: `notificationTap` apre già
   il disegno, nessun cambio; a app aperta non si mostra, come le altre.
5. Testi nelle cinque lingue (sotto), colori da `tokens.ts`.
6. Test: la scheda con 200 e nascosta con 404 e senza niente sul
   telefono; i giorni che restano da `ends_at` e «Ends today»; la riga
   «Your best post»; la scheda del vincitore con `closed_at`; il badge; la
   fascia; i test dell'app intera che contano le richieste all'avvio del
   Feed.

## Testi da approvare dall'utente

Inglese e italiano qui; tedesco, spagnolo e francese li porta la parte
che li usa (A la push, B il resto) e vanno approvati con lei.

**La scheda e il resto dell'app** (parte B):

| Dove | Inglese | Italiano |
|---|---|---|
| titolo della scheda | MuW contest | Concorso MuW |
| sotto il titolo | The post with the most reactions wins. | Vince il post con più reazioni. |
| quanto manca | {n} days left · 1 day left · Ends today | Mancano {n} giorni · Manca 1 giorno · Finisce oggi |
| finito, prima della proclamazione | Ended · the winner is coming | Finito · il vincitore sta arrivando |
| il proprio posto | Your best post: #{rank}, {n} reactions | Il tuo miglior post: n. {rank}, {n} reazioni |
| senza un post nel periodo | Publish a run to take part. | Pubblica una corsa per partecipare. |
| il link | How it works | Come funziona |
| il titolo del regolamento | Official rules | Regolamento |
| il badge e la fascia | Winner | Vincitore |
| la scheda del vincitore | {name} won the MuW contest | {name} ha vinto il concorso MuW |

**La push** (parte A, `contest_won`, al solo vincitore):

| Inglese | Italiano |
|---|---|
| You won the MuW contest! Your post got the most reactions. | Hai vinto il concorso MuW! Il tuo post ha avuto più reazioni di tutti. |

Tedesco, spagnolo e francese della push, proposti dalla parte A il
2026-10-26 (in `push.py`), **approvati dall'utente lo stesso giorno**
(«Sì, così» alla domanda della parte A; «Sì, vanno bene» alla sessione
del concorso):

| Lingua | Testo |
|---|---|
| de | Du hast den MuW-Wettbewerb gewonnen! Dein Beitrag hat die meisten Reaktionen bekommen. |
| es | ¡Has ganado el concurso MuW! Tu publicación ha recibido más reacciones que ninguna otra. |
| fr | Tu as gagné le concours MuW ! Ta publication a reçu le plus de réactions. |

**Il regolamento ufficiale** (parte B; l'organizzatore lo ha dato
l'utente il 2026-10-25: «L'organizzatore nel regolamento è Luca
Pallaoro»; `{start}` e `{end}` sono le date del concorso nella lingua del
telefono):

> **MuW contest — official rules**
> Organised by MuW (Luca Pallaoro). Runs from {start} to {end}.
> Anyone with a MuW account can take part, for free, by publishing a run
> for everyone in the app during the contest.
> At the end, the post with the most reactions from other members wins.
> One reaction per member counts; your own does not. If two posts tie,
> the one with more MuW hearts wins, then the one published first.
> The prize has no money value: the winner gets the Winner badge on their
> profile and their post shown at the top of the Feed for a week.
> MuW may leave out a post that breaks the community rules.
> Apple and Google are not sponsors of this contest and are not involved
> in it in any way.

> **Concorso MuW — regolamento**
> Organizzato da MuW (Luca Pallaoro). Dal {start} al {end}.
> Partecipa gratis chi ha un account MuW, pubblicando una corsa per tutti
> nell'app durante il concorso.
> Alla fine vince il post con più reazioni degli altri iscritti. Conta una
> reazione per iscritto; la propria no. A pari merito vince il post con
> più cuori MuW, poi quello pubblicato prima.
> Il premio non ha valore in denaro: chi vince ha il badge Vincitore sul
> profilo e il suo post in cima al Feed per una settimana.
> MuW può escludere un post che viola le regole della community.
> Apple e Google non sponsorizzano questo concorso e non vi sono
> coinvolte in alcun modo.

## Criteri di accettazione

Documenti (questa PR):
- [ ] `docs/CONCORSI.md`, questo file, ADR-0260, una riga in `INDEX.md` e
      una in `STATUS.md`.

Parte A (`test_contests.py`, un test per regola):
- [x] Con un concorso aperto, `GET /contests/current` senza token dà date,
      i primi tre con l'anteprima e l'autore, `mine` assente; con un token
      `mine` ha posto e reazioni del proprio miglior post (test).
- [x] Ogni regola di `CONCORSI.md` §3–§4 ha il suo test: la propria
      reazione, il blocco, `followers`/`only_me`, fuori dal periodo, dopo
      `ends_at`, nascosto (disegno e account: la #525 è in `main`), i due
      pari merito.
- [x] Chi chiede non vede in `top` un post attraverso un blocco (test).
- [x] `close` due volte proclama una volta e manda una push; `--exclude`
      salta un post; `--dry-run` non scrive; `open` rifiuta un secondo
      concorso aperto e `to ≤ from` (test). In più: `close` rifiuta prima
      di `ends_at`, e senza partecipanti chiude senza vincitore né push.
- [x] `standings` stampa i primi dieci con le reazioni da account più
      giovani del concorso (test sull'output).
- [x] Senza concorso, e otto giorni dopo la chiusura, `404 no_contest`
      (test).
- [x] La corsa vincitrice cancellata lascia `contest_wins` a 1; l'account
      cancellato lascia il concorso senza vincitore (test).
- [x] `contest_wins` in `GET /users/{public_id}` e in `GET /me`.
- [x] pytest, ruff e black verdi (in locale e nella CI della #562); il
      testo della push approvato dall'utente (de/es/fr, 2026-10-26, sopra).

Parte B:
- [ ] La scheda si vede con un 200 ed è nascosta con un 404 e senza
      niente sul telefono; il Feed senza concorso è uguale a oggi (test).
- [ ] I giorni che restano vengono da `ends_at`; «Ends today» l'ultimo
      giorno; «Ended · the winner is coming» dopo `ends_at` senza
      `closed_at` (test con l'orologio finto).
- [ ] Un tocco su uno dei tre apre il disegno; «How it works» apre il
      regolamento con le date (test).
- [ ] Con `closed_at` la scheda è quella del vincitore (test).
- [ ] Il badge con `contest_wins > 0`, sul proprio profilo e sugli altri;
      la fascia sul disegno vincitore (test).
- [ ] Impronta iOS invariata (`83793e26…`), solo JavaScript; nessuna
      dipendenza nuova.
- [ ] lint, typecheck, test e format:check verdi; i testi approvati
      dall'utente.

## File toccati

Documenti (questa PR):
```
docs/CONCORSI.md              (nuovo)
docs/tasks/TASK-299.md        (nuovo)
docs/DECISIONS.md             (ADR-0260 in fondo)
docs/STATUS.md                (righe nuove)
docs/INDEX.md                 (una riga: «Il primo concorso» → CONCORSI.md)
```

Parte A (da confermare col Coordinatore prima del codice):
```
services/api/migrations/00NN_contests.sql                (nuovo, numero al merge, da 0028)
services/api/shaperoute_api/contests.py                  (nuovo: regole, endpoint, comandi, push)
services/api/shaperoute_api/push.py                      (solo il Kind contest_won, OWN_KINDS, il testo)
services/api/shaperoute_api/app.py                       (solo la riga del router)
services/api/shaperoute_api/profiles.py                  (contest_wins in PublicProfileBody)
services/api/shaperoute_api/accounts.py                  (contest_wins in UserBody, in aggiunta)
services/api/tests/test_contests.py                      (nuovo)
services/api/tests/test_profiles.py, test_accounts.py    (il campo nuovo nelle uguaglianze, se le fanno)
services/api/tests/test_notifications.py                 (una riga: legge l'alias della sottoquery di contest_wins in USER_COLUMNS; ok del Coordinatore 2026-10-26, con l'indice sul vincitore e il tempo di GET /me nella PR)
services/api/shaperoute_api/schemas.py                   (una riga: no_contest in ErrorCode; ok del Coordinatore 2026-10-25)
packages/shared-types/fixtures/api-error-codes.json      (una riga: no_contest; ok del Coordinatore 2026-10-25)
apps/mobile/assets/engine/engine.zip                     (rifatto: schemas.py viaggia nel motore sul telefono, TASK-214; ok del Coordinatore 2026-10-26: se un'altra PR lo cambia prima del merge, si rigenera da main, mai a mano)
packages/shared-types/src/index.ts                       (in fondo: Contest, ContestEntry, ContestMine, ContestWinner; PushKind +contest_won; API_ERROR_CODES +no_contest; contest_wins in User e PublicProfile)
packages/shared-types/fixtures/contest.json, contest-closed.json   (nuovi)
packages/shared-types/fixtures/public-profile.json, session.json   (contest_wins: user.json non esiste, l'utente d'esempio è in session.json)
packages/shared-types/test/accounts.test.ts              (contest_wins nelle liste di chiavi; ok del Coordinatore 2026-10-26)
docs/API.md («Contest»), docs/DATABASE.md (contests), docs/CONCORSI.md (§13), docs/STATUS.md, docs/tasks/TASK-299.md
```

Parte B (da confermare col Coordinatore prima del codice):
```
apps/mobile/src/contest/                                 (nuova: contestApi, contestKept, useContest, daysLeft, ContestCard, WinnerCard, ContestRules e i test)
apps/mobile/src/screens/FeedScreen.tsx, FeedScreen.test.tsx          (la scheda nell'intestazione)
apps/mobile/src/profile/ProfileHeader.tsx, ProfileHeader.test.tsx    (il badge)
apps/mobile/src/profile/UserProfilePage.tsx, ProfileHome.tsx         (passano contest_wins)
apps/mobile/src/social/DrawingCard.tsx, DrawingCard.test.tsx         (la fascia)
apps/mobile/src/i18n/de.ts, es.ts, fr.ts, it.ts          (righe in fondo)
apps/mobile/__tests__/AppFeed.test.tsx (e gli altri test dell'app intera che contano le richieste)
docs/UI.md («Feed»: la scheda; il profilo: il badge), docs/CONCORSI.md, docs/STATUS.md, docs/tasks/TASK-299.md
```

## Fuori scope

- Un premio di valore (maglietta, buoni): è il secondo concorso, con la
  ditta e il commercialista («Seguiti da aprire»).
- Una classifica intera o una pagina dei concorsi: la scheda mostra tre
  post; TASK-241 ha tolto punteggi e classifiche su richiesta dell'utente.
- Una push a tutti alla chiusura, o all'apertura.
- Un pannello per aprire e chiudere i concorsi dall'app: i comandi sul
  server bastano (nessun admin panel, come ADR-0228).
- Il post vincitore sul sito e su Instagram: li fa l'utente a mano.
- Più concorsi aperti insieme, concorsi per città o per sport.

## Seguiti da aprire

- **Il concorso con la maglietta**, quando ci sarà la ditta: in Italia è
  un concorso a premio (DPR 430/2001): promotore l'impresa, regolamento,
  comunicazione al Ministero almeno 15 giorni prima, cauzione pari al
  valore dei premi, verbale di assegnazione con un notaio o un funzionario
  camerale, e l'esclusione dei dipendenti; il commercialista conferma. In
  app servirebbero il consenso a essere contattati e un indirizzo di
  spedizione. Numero dal Coordinatore quando l'utente lo vuole.

## Esito

- **Parte A** in `main` con la #562 (`5f762ae7`, 2026-10-26): migrazione
  `0030_contests.sql`, `contests.py`, la push `contest_won`, `contest_wins`
  nei profili, `no_contest`, tipi e fixture, 25 test; testi de/es/fr
  approvati dall'utente; `engine.zip` rifatto. Com'è fatta: `CONCORSI.md`
  §13. La parte B parte da qui.
