# TASK-343 — Le sfide del mese: un tema per concorso, l'iscrizione, la galleria, l'archivio

**Stato**: Todo — documenti nella PR `docs/TASK-343-monthly-challenges`;
il codice parte dopo il loro merge
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

- [ ] Un concorso senza tema si comporta esattamente come oggi (i test
      di `test_contests.py` passano senza cambiarli).
- [ ] In un concorso con tema un disegno non iscritto non è in
      classifica; iscritto sì; ritirato no.
- [ ] L'iscrizione è rifiutata a concorso chiuso o senza tema, per un
      disegno di un altro, privato, per i soli follower, importato o
      pubblicato fuori dal periodo.
- [ ] `GET /contests/current` dà `theme`, `entrants`, e `entered` solo
      con il token; la galleria ordina per classifica e per data e
      pagina con `cursor`; l'archivio dà i concorsi chiusi.
- [ ] Ognuna delle tre push parte una volta sola e solo a chi deve
      (test con un `pusher` finto e l'orologio finto).
- [ ] App: scheda con il tema, pagina, galleria nei due ordini,
      archivio, interruttore solo quando vale, tocco della push; con
      un'API senza tema tutto come oggi.
- [ ] Testi e regolamento approvati dall'utente; server e push solo con
      il sì dell'utente.

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
(e i test accanto a ogni file)
# Tutte e due
docs/STATUS.md
docs/DECISIONS.md
docs/tasks/TASK-343.md
```

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

*(a fine task)*
