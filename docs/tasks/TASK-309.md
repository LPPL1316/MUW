# TASK-309 — Eventi: le corse di gruppo («Group runs»)

**Stato**: In lavorazione · documenti in `main` (#574) · A (API) in PR · poi B (app), C (commenti)
**Fase**: 4 · **Branch**: `docs/TASK-309-group-runs` (documenti),
`feat/TASK-309-a-group-runs-api` (A), `feat/TASK-309-b-group-runs-app` (B),
`feat/TASK-309-c-group-run-comments` (C)
**Dipende da**: TASK-171 (i Preferiti: il percorso), TASK-118 (il Feed),
TASK-211 (follow), TASK-121 e TASK-291 (blocchi, segnalazioni, nascosti),
TASK-213 (il filtro dei testi), TASK-262 A (le push), TASK-299 B (la
scheda del concorso in cima al Feed, prima della parte B)
**ADR**: ADR-0269

## Obiettivo

Un iscritto pubblica una **corsa di gruppo** su una forma scelta, con il
luogo di ritrovo (la partenza del percorso) e giorno e ora; gli altri
dicono «I'm going» e si trovano a correrla insieme, come in un run club.
Le regole sono in `docs/EVENTI.md`.

## Contesto

L'utente, il 2026-10-26: «dai la possibilità di creare anche un post
evento al quale una persona può creare un post con un disegno scelto e
dando un luogo di incontro ed un orario e poi come se fosse un run club
ci si incontra per correre la forma assieme». La proposta con i default,
in due giri (il secondo con le aggiunte del Coordinatore su sicurezza,
Feed, push e privacy), ha avuto il suo «Sì, così: vai con la proposta del
Group run, aggiunte comprese» lo stesso giorno.

**Una correzione, confermata**: la proposta diceva che l'avviso «Anna is
going» arriva all'organizzatore «solo nella lista Notifiche dell'app».
Quella lista non esiste: ci sono solo le push e l'email del giorno.
Avuta la correzione, l'utente ha scelto lo stesso giorno: «Nessuna
notifica quando qualcuno si aggiunge: l'organizzatore lo vede nella
pagina della corsa di gruppo» (`EVENTI.md` §6.4).

## Condizioni (dal Coordinatore, 2026-10-26)

1. **Sicurezza di un ritrovo dal vivo**: chi la vede lo decide chi crea;
   il ritrovo in un luogo pubblico, mai a casa (avviso a chi crea); «MuW
   non organizza né controlla»; gli iscritti hanno almeno 16 anni, e va
   detto (`EVENTI.md` §10).
2. **Contenuti degli utenti** (Apple 1.2): titolo e descrizione passano
   dal filtro di TASK-213; segnalazione e blocco come per i post (TASK-121,
   TASK-291); chi è bloccato non vede la corsa di gruppo e non dice «I'm
   going».
3. **Feed**: lente, concorso e «Group runs» in cima, senza affollare
   (`EVENTI.md` §5). `FeedScreen.tsx` è di TASK-299 B finché la sua PR non
   entra: la parte B parte dopo.
4. **Push**: un promemoria prima, uno solo, con l'`UPDATE` condizionato
   come le sfide del gioco; l'annullamento. Valgono gli interruttori di
   TASK-262.
5. **Privacy**: chi va a quale corsa di gruppo è un dato nuovo; il testo
   lo approva l'utente; le righe si cancellano con l'account.
6. Migrazione al **primo numero libero al merge** (oggi 0031, contesa con
   TASK-308). Server dopo Apple e con il sì dell'utente. Impronta iOS
   `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3` per l'app. «File toccati» di
   ogni parte al Coordinatore prima del codice; per ogni PR «#NNN pronta».

## Contesto da leggere

- `docs/EVENTI.md`, tutto;
- `docs/API.md`: «Favorites» (i campi del percorso), «Feed» (i 50 km,
  `FEED_NEAR_M`), «Comments» (il filtro, il limite al minuto), «Block and
  report» e «Report emails», «Push notifications» (i tipi, `OWN_KINDS`,
  le push delle sfide); `docs/DATABASE.md`, «Com'è oggi»: `favorites`,
  `follows`, `blocks`, `reports`;
- `services/api/shaperoute_api/favorites.py` (il corpo del percorso, da
  riusare senza cambiarlo), `feed.py` (i vicini), `follows.py`
  (`apart_sql`), `moderation.py`, `report_email.py`, `push.py`,
  `game_challenges.py` (`ChallengeClock`), `comment_filter.py`,
  `notice_email.py` (`EMAIL_KINDS`: i tipi nuovi restano fuori senza
  cambiarlo);
- per B: `docs/UI.md` («Feed», il profilo), `apps/mobile/src/screens/FeedScreen.tsx`
  (`ListHeaderComponent`), `src/favorites/favoriteRoute.ts` (`Keepable`,
  `openedFavorite`), `src/favorites/FavoriteHeart.tsx`,
  `src/notifications/notificationTap.ts`, `src/contest/` (com'è fatta una
  scheda nell'intestazione del Feed, dopo TASK-299 B).

## Parte A — API: corse di gruppo, «I'm going», promemoria

1. **Migrazione** `00NN_group_runs.sql` (numero al merge, oggi da 0031):
   `group_runs` e `group_run_going` di `EVENTI.md` §12; indice su
   `starts_at` delle non annullate; GIST su `start`.
2. **`group_runs.py`** (nuovo):
   - `POST /group-runs`: il percorso con il corpo di un Preferito
     (`favorites.py`, importato, non cambiato), più `title`, `starts_at`,
     `meeting_note`, `description`, `visibility`; i limiti di `EVENTI.md`
     §3 (`422 invalid_request` con un messaggio da mostrare; il filtro di
     TASK-213 con `422 comment_rejected`, il codice che l'app conosce);
     al più 10 in arrivo per account;
   - `GET /group-runs?lat=…&lon=…`: la fila del Feed (§5), al più 20;
   - `GET /group-runs/{id}`: la corsa di gruppo intera, con la linea e i
     primi 20 che vanno, l'organizzatore per primo;
   - `PUT /group-runs/{id}`: l'organizzatore cambia titolo, ora, «Where
     exactly», descrizione, prima dell'inizio; con ora o luogo cambiati,
     `reminded_at` torna vuoto e parte `group_run_changed`;
   - `DELETE /group-runs/{id}`: l'organizzatore annulla (`cancelled_at`),
     prima dell'inizio; parte `group_run_cancelled`;
   - `PUT` e `DELETE /group-runs/{id}/going`: «I'm going» e «Not going»,
     idempotenti, rifiutati dopo la fine o l'annullamento;
   - `GET /group-runs/{id}/going?cursor=…`: chi va, in pagine come gli
     elenchi di «Follow» (`PeoplePage`);
   - `GET /users/{public_id}/group-runs`: quelle in arrivo e le ultime 20
     passate di un profilo, che chi chiede vede;
   - `GroupRunClock`, ogni 5 minuti: il promemoria `group_run_soon` con
     l'`UPDATE … WHERE reminded_at IS NULL … RETURNING`;
   - tutti con il token (`401`), `503` senza database; chi non vede,
     `404` come un id che non c'è. Nessun codice d'errore nuovo:
     `schemas.py` e `engine.zip` non cambiano.
3. **`push.py`**: i tipi `group_run_soon` (in `OWN_KINDS`: va anche
   all'organizzatore), `group_run_changed`, `group_run_cancelled`, con i
   testi (sotto, da approvare). **`app.py`**: la riga del router e
   l'orologio nel `lifespan`.
4. **`moderation.py`** e **`report_email.py`**: il tipo `group_run` nelle
   segnalazioni, nell'email e nel link che nasconde (`group_runs.hidden_at`).
5. **`accounts.py`**: prima di cancellare un account, la push
   `group_run_cancelled` a chi va alle sue corse di gruppo non ancora
   cominciate (una chiamata a `group_runs.py`).
6. **`shared-types`**: `GroupRun`, `GroupRunDetail`, `GroupRunRequest`,
   `GroupRunChange`, `GroupRunsPage`, i tre tipi in `PushKind`, `group_run`
   in `REPORT_KINDS`, in fondo a `index.ts`; fixture nuove.
7. **Privacy**: la riga di `EVENTI.md` §11 in `site/tools/make_privacy.mjs`
   e le cinque pagine rifatte; traduzioni da approvare.
8. **Test deterministici** (`test_group_runs.py`), uno per regola: i
   limiti dei campi e dell'ora (30 minuti, 60 giorni); il filtro dei
   testi; il decimo e l'undicesimo in arrivo; `followers` senza follow
   accettato; il blocco nei due sensi (non si vede, non si va, non si
   conta); nascosta; la fila con i 50 km, chi si segue e chi va ovunque,
   l'ordine, le finite e le annullate fuori; «I'm going» due volte; dopo
   la fine e dopo l'annullamento rifiutato; l'organizzatore primo, e il
   suo «Not going» rifiutato; il cambio di ora che riapre il promemoria; l'orologio due
   volte (e due processi): una push sola; nessuna push per un'aggiunta;
   l'account cancellato (righe sparite, push a chi andava); la
   segnalazione, l'email e il link che nasconde.
9. **Documenti**: `API.md` («Group runs»), `DATABASE.md`, `EVENTI.md`
   (com'è fatta), `STATUS.md`, questo file.

## Parte B — App: crearla, la fila nel Feed, la pagina

Parte dopo che A **e TASK-299 B** sono in `main`. L'elenco dei file va al
Coordinatore prima.

1. `src/groupRuns/` (nuova): l'API letta senza fidarsi, la fila, la
   scheda, la pagina della corsa di gruppo, il modulo per crearla e
   cambiarla, il selettore di giorno e ora in JavaScript, l'avviso di
   sicurezza, l'elenco di chi va.
2. Il bottone «Create group run» accanto al cuore dei Preferiti, sul
   percorso pronto di Draw, Explore e Preferiti.
3. `FeedScreen.tsx`: la fila sotto la scheda del concorso, solo con
   almeno una corsa di gruppo; con un 404 (API di prima) o senza rete,
   niente.
4. Il profilo: le corse di gruppo in arrivo e le passate.
5. `notificationTap.ts`: `group_run_id` apre la pagina; «Report» nel menu
   della pagina con il tipo `group_run`.
6. «Start» apre la corsa sul percorso, come un Preferito aperto.
7. Testi nelle cinque lingue (sotto), colori da `tokens.ts`.
8. Test: la fila nascosta senza corse di gruppo e con un 404; l'ora
   nell'ora del telefono; i limiti del selettore (30 minuti, 60 giorni);
   «I'm going» e «Not going»; «Cancelled» e finita; l'organizzatore; la
   push che apre la pagina; i test dell'app intera che contano le
   richieste all'avvio del Feed.

## Parte C — I commenti sotto una corsa di gruppo

Dopo B. Le regole dei commenti dei post (TASK-120, il filtro di TASK-213,
il limite al minuto, chi cancella), in una tabella a parte
`group_run_comments`, con le segnalazioni e il link che nasconde. Il
disegno preciso si scrive qui quando parte, con i suoi «File toccati».

## Testi da approvare dall'utente

Inglese e italiano qui; tedesco, spagnolo e francese li porta la parte che
li usa (A le push e la privacy, B il resto) e vanno approvati con lei.
L'avviso di sicurezza e la riga della privacy in inglese sono già stati
approvati con la proposta.

**L'app** (parte B):

| Dove | Inglese | Italiano |
|---|---|---|
| bottone sul percorso | Create group run | Crea corsa di gruppo |
| titolo del modulo | New group run | Nuova corsa di gruppo |
| campi | Title · Day and time · Where exactly · Notes · Who can see it | Titolo · Giorno e ora · Dove esattamente · Note · Chi la vede |
| suggerimenti | e.g. MUSE entrance · Pace, what to bring… | es. ingresso del MUSE · Ritmo, cosa portare… |
| chi la vede | Everyone · Followers | Tutti · Follower |
| sicurezza (inglese approvato) | Meet in a public place, never at your home. MuW doesn't organise or check group runs. Everyone on MuW is 16 or older. | Trovatevi in un luogo pubblico, mai a casa. MuW non organizza né controlla le corse di gruppo. Su MuW tutti hanno almeno 16 anni. |
| pubblicare | Publish | Pubblica |
| fila nel Feed | Group runs | Corse di gruppo |
| quanti vanno | {n} going | {n} partecipanti |
| partecipare | I'm going · You're going · Not going | Ci vado · Ci vai · Non vado più |
| organizzatore | Organiser | Organizza |
| annullare | Cancel group run · Cancel this group run? Everyone going gets a notice. | Annulla la corsa di gruppo · Annullare la corsa di gruppo? Chi partecipa riceve un avviso. |
| stati | Cancelled · Over | Annullata · Finita |
| profilo | Group runs · Past | Corse di gruppo · Passate |
| troppe | You can have 10 upcoming group runs at most. | Puoi avere al massimo 10 corse di gruppo in arrivo. |

**Le push** (parte A; nessun orario, `EVENTI.md` §8):

| Tipo | Inglese | Italiano |
|---|---|---|
| `group_run_soon` | {title} starts soon: see you at the start! | {title} sta per cominciare: ci vediamo alla partenza! |
| `group_run_changed` | {name} changed the time or place of {title}. | {name} ha cambiato ora o luogo di {title}. |
| `group_run_cancelled` | {name} cancelled {title}. | {name} ha annullato {title}. |

**La privacy** (parte A, approvata in inglese con la proposta):

> If you create a group run or say you're going, members who can see it
> see your name, your photo and that you're going. We delete your group
> runs and your answers when you delete your account.

> Se crei una corsa di gruppo o dici che ci vai, gli iscritti che la
> vedono vedono il tuo nome, la tua foto e che ci vai. Cancelliamo le tue
> corse di gruppo e le tue risposte quando cancelli l'account.

## Criteri di accettazione

Documenti (questa PR):
- [ ] `docs/EVENTI.md`, questo file, ADR-0269, una riga in `INDEX.md` e
      una in `STATUS.md`.

Parte A:
- [ ] Ogni regola di `EVENTI.md` §3–§9 ha il suo test in
      `test_group_runs.py` (elenco al punto A.8).
- [ ] Il promemoria parte una volta sola per corsa di gruppo, anche con
      l'orologio due volte; di nuovo dopo un cambio di ora (test).
- [ ] Chi è bloccato, in uno dei due sensi, non vede, non va, non è
      contato, non riceve push (test).
- [ ] `DELETE /me` toglie corse di gruppo e risposte, e avvisa chi andava
      (test).
- [ ] `schemas.py` e `engine.zip` invariati; pytest, ruff e black verdi;
      i testi delle push e della privacy approvati dall'utente.

Parte B:
- [ ] Il Feed senza corse di gruppo, o con un 404, è uguale a oggi (test).
- [ ] Il selettore non lascia scegliere prima di 30 minuti né oltre 60
      giorni; l'ora si mostra nell'ora del telefono (test con l'orologio
      finto).
- [ ] «I'm going», «Not going», «Cancelled», finita, l'organizzatore
      (test).
- [ ] La push apre la pagina (test).
- [ ] Impronta iOS invariata (`83793e26…`), nessuna dipendenza nuova;
      lint, typecheck, test e format:check verdi; i testi approvati.

## File toccati

Documenti (questa PR):
```
docs/EVENTI.md                (nuovo)
docs/tasks/TASK-309.md        (nuovo)
docs/DECISIONS.md             (ADR-0269 in fondo)
docs/STATUS.md                (righe nuove)
docs/INDEX.md                 (una riga: «Le corse di gruppo» → EVENTI.md)
```

Parte A (confermati dal Coordinatore il 2026-10-27, con due differenze
dalla prima lista: `accounts.py` esce, perché l'hook
`app.state.before_account_delete` c'è già; la privacy sta nei testi
dell'app, da cui `site/privacy` si rifà, e entra dopo #573 e #576):
```
services/api/migrations/0031_group_runs.sql              (nuovo, numero al merge; rifà il CHECK di reports.kind)
services/api/shaperoute_api/group_runs.py                (nuovo: regole, endpoint, orologio, push, hook di DELETE /me)
services/api/shaperoute_api/push.py                      (i tre Kind, OWN_KINDS, i testi; group_run_id in PushEvent e nei dati)
services/api/shaperoute_api/app.py                       (import e una riga install_group_runs)
services/api/shaperoute_api/moderation.py                (il tipo group_run)
services/api/shaperoute_api/report_email.py              (il tipo group_run, nascondere e rimostrare)
services/api/tests/test_group_runs.py                    (nuovo)
services/api/tests/test_moderation.py, test_report_email.py   (il tipo nuovo)
packages/shared-types/src/index.ts                       (REPORT_KINDS; in fondo i tipi, GroupRunPushKind e GroupRunPushData)
packages/shared-types/fixtures/group-run*.json           (nuovi)
packages/shared-types/test/groupRuns.test.ts             (nuovo)
packages/shared-types/test/moderation.test.ts            (una riga: REPORT_KINDS con group_run)
apps/mobile/src/about/content/{en,it,de,fr,es}.ts, site/privacy/*/index.html, site/tests/privacy.test.mjs   (la riga della privacy, dopo #573 e #576)
docs/API.md («Group runs»), docs/DATABASE.md, docs/EVENTI.md, docs/STATUS.md, docs/tasks/TASK-309.md
```

Parte B (da confermare col Coordinatore prima del codice):
```
apps/mobile/src/groupRuns/                               (nuova, con i test)
apps/mobile/src/screens/FeedScreen.tsx, FeedScreen.test.tsx    (la fila, dopo TASK-299 B)
apps/mobile/App.tsx                                      (il bottone accanto al cuore e la pagina: da verificare)
apps/mobile/src/notifications/notificationTap.ts, notificationTap.test.ts
apps/mobile/src/profile/ProfileHome.tsx, UserProfilePage.tsx   (le corse di gruppo del profilo)
apps/mobile/src/i18n/de.ts, es.ts, fr.ts, it.ts          (righe in fondo)
apps/mobile/__tests__/AppFeed.test.tsx (e gli altri test dell'app intera che contano le richieste)
docs/UI.md («Feed», il profilo), docs/EVENTI.md, docs/STATUS.md, docs/tasks/TASK-309.md
```

## Fuori scope

- I commenti: sono la parte C, dopo B.
- Legare le corse fatte alla corsa di gruppo («5 ran it together»).
- Corse di gruppo che si ripetono, i club con una pagina, l'invito a
  persone scelte.
- «Add to calendar»: vuole un modulo nativo e un build per gli store.
- Cambiare il percorso o chi la vede dopo la creazione: si annulla e se ne
  crea un'altra.
- Una push all'organizzatore quando qualcuno si aggiunge: per scelta
  dell'utente non c'è (`EVENTI.md` §6.4).
- Una pagina con tutte le corse di gruppo, o una ricerca: la fila del Feed
  e i profili bastano.

## Esito

*(si compila a fine task)*

**Documenti** in `main` con la #574 (`06a95749`, 2026-10-27).

**Parte A** (branch `feat/TASK-309-a-group-runs-api`, 2026-10-27):
`group_runs.py` con gli endpoint, `GroupRunClock` e le tre push; la
migrazione `0031_group_runs.sql` (numero al merge); il tipo `group_run`
nelle segnalazioni e nelle loro email; tipi e fixture in `shared-types`.
Un test per regola in `test_group_runs.py` (44), più il tipo nuovo in
`test_moderation.py` e `test_report_email.py`. Com'è fatta: `EVENTI.md`
§14. Scelte tecniche, prese su delega: le push con `GroupRunPushKind`
accanto a `PushKind` (i dati sono `{ kind, group_run_id }`, come le sfide
del gioco); un blocco non cancella le risposte, le esclude in lettura
(`counted_sql`); «in arrivo» vuol dire non finita e non annullata.
**Resta**: i testi de/es/fr delle push e della riga della privacy con il
sì dell'utente; la riga della privacy dopo #573 e #576; il merge dal
Coordinatore; il server dopo Apple, con il sì dell'utente.
