# CONCORSI — Il concorso del post con più reazioni

> Documento di dominio dei concorsi: chi partecipa, che cosa conta, come si
> vince, che cosa vede chi usa l'app, dove stanno i dati, come si apre e si
> chiude un concorso. Perché è fatto così: ADR-0260. Lo stato delle parti:
> `tasks/TASK-299.md`.

## 1. L'idea

Per un periodo deciso dall'utente, i post pubblicati per tutti gareggiano:
alla fine **vince il post con più reazioni**. Il premio **non ha valore
in denaro**: il badge «Winner» sotto il nome, il post in cima al Feed per
una settimana, una push a chi ha vinto. È la scelta dell'utente del
2026-10-24 fra tre strade, perché un premio di valore farebbe del concorso
un «concorso a premio» di legge (§12).

## 2. Chi decide che cosa

- **Il server decide, l'app mostra.** Chi partecipa, quante reazioni
  contano, chi è davanti e chi ha vinto si calcolano solo sull'API, con
  una query sola (`services/api/shaperoute_api/contests.py`), usata
  dall'endpoint e dai comandi: due letture danno lo stesso ordine.
- **Una persona proclama.** Il concorso finisce alla data scritta; il
  vincitore lo scrive il comando `close`, lanciato da chi gestisce il
  server dopo aver guardato i primi dieci (§5). Nessun orologio proclama
  da solo.
- **Nessuna colonna nuova su disegni e reazioni.** Il concorso legge
  `drawings` e `reactions` così come sono; ha una tabella sua (§9).
- **Il Feed, i profili e le reazioni non cambiano**: nessun endpoint
  esistente risponde diversamente, a parte il numero `contest_wins` nei
  profili.

## 3. Che cosa partecipa e che cosa conta

Partecipa un **disegno**:

1. con `visibility = 'everyone'`: un post per i soli follower non
   gareggia, perché non tutti potrebbero reagirgli;
2. con `published_at` fra `starts_at` ed `ends_at` del concorso;
3. non nascosto dalla moderazione (`hidden_at IS NULL`, TASK-291) e di un
   account non nascosto;
4. non escluso alla chiusura (`--exclude`, §5);
5. di una corsa **registrata dall'app** (`runs.source = 'muw'`, TASK-312,
   ADR-0272): un'attività aggiunta dal file di un'altra app, con
   «Imported», non partecipa, qualunque reazione abbia. La regola sta nella
   query di `contests.py` (`PARTICIPATES_SQL`), quindi vale per
   `GET /contests/current`, per `standings` e per `close`;
6. in una **sfida del mese** (un concorso con un tema, §15), **iscritto**
   dal suo proprietario (`contest_entries`). Senza tema il punto non c'è:
   partecipano tutti i post del periodo, come sopra.

Conta una **reazione**:

1. **una per account**: la tabella `reactions` ne tiene una a testa per
   disegno (la coppia è la chiave), di qualunque tipo; cambiarla non ne
   aggiunge;
2. **mai la propria**: l'API lascia reagire al proprio disegno, il
   concorso non la conta;
3. **non attraverso un blocco**: chi è bloccato dall'autore, o lo ha
   bloccato (`follows.apart_sql`), non conta, come non si vedono nel Feed;
4. **lasciata entro `ends_at`** (`created_at <= ends_at`). `created_at`
   cambia quando si cambia tipo: una reazione cambiata dopo la fine non
   conta più; è il prezzo di non avere una seconda colonna, e riguarda chi
   tocca la propria reazione dopo che il concorso è finito.

Nessun acquisto, nessun requisito oltre l'account.

## 4. Pari merito

Nell'ordine: più reazioni; poi più **cuori MuW** (`super_like`, che
richiede un commento); poi il post **pubblicato prima**. Tre chiavi che
non lasciano pari: `published_at` è diverso fra due post dello stesso
account e, al limite, l'`id` chiude.

## 5. Account nati durante il concorso e trucchi

Gli account creati durante il concorso **contano**. Escluderli terrebbe
fuori proprio chi il concorso vuole portare dentro, e le prime settimane di
MuW sono tutte account giovani.

Il trucco degli account finti si guarda **alla chiusura**: `standings`
stampa, per i primi dieci, le reazioni totali e quante vengono da account
più giovani del concorso; chi gestisce il server legge e, se un post ha
venti reazioni da venti account nati ieri senza una corsa, lo esclude con
`close --exclude <drawing_id>`. Il regolamento dice che MuW può escludere
un post che viola le regole della community (§8). Un post escluso non è
cancellato né nascosto: non vince.

## 6. Chiusura e vincitore

- `close` legge la classifica, scrive `winner_drawing_id`,
  `winner_user_id` e `closed_at` **solo se `closed_at` è nullo**: lanciato
  due volte, la seconda non fa niente e lo dice. Poi, fuori dalla
  transazione, una push `contest_won` al vincitore (`push.py`, con gli
  interruttori di TASK-262 A).
- Il vincitore è un account e un disegno. Se la corsa viene cancellata,
  il disegno sparisce e `winner_drawing_id` torna nullo (`ON DELETE SET
  NULL`): il badge resta, perché conta `winner_user_id`. Se l'account si
  cancella, il concorso resta senza vincitore.
- Per **7 giorni** dopo `closed_at` il concorso si legge ancora
  (`GET /contests/current`): è il tempo del post in evidenza. Poi 404.
- Senza partecipanti, `close` chiude senza vincitore e senza push.

## 7. Che cosa vede chi usa l'app

**Durante** — in cima al Feed, sotto la lente, la scheda «MuW contest»: i
giorni che restano, i **primi tre** con l'anteprima del disegno, il nome e
le reazioni (un tocco apre il post), la riga «Your best post: #5, 4
reactions» a chi ha un post nel periodo, «Publish a run to take part.»
agli altri, e «How it works» che apre il regolamento. Chi non è iscritto
vede la scheda senza la propria riga: è un motivo per iscriversi.

**Dopo**, per 7 giorni — la scheda diventa «{name} won the MuW contest»:
il disegno vincitore, il nome, il badge.

**Per sempre** — il badge «Winner» sotto il nome nel profilo, con
`contest_wins ≥ 1`; la fascia «Winner» sul disegno vincitore quando lo si
apre (per il concorso tenuto sul telefono).

**La scheda esiste solo se il server lo dice**: l'app chiede
`GET /contests/current` quando il Feed si apre e si aggiorna, tiene
l'ultima risposta sul telefono (`contest.json`, come il catalogo del gioco)
e la cancella con un 404. Senza rete vale l'ultima risposta; un telefono
che non ha mai sentito il server non mostra niente.

**La push** arriva solo al vincitore; toccata apre il suo post. Gli altri
vedono la scheda.

**In una sfida del mese** (§15) la scheda ha il titolo del tema e apre la
pagina della sfida: tema, date, partecipanti, premio, la galleria «Top» |
«New» e l'archivio «Past challenges»; chi pubblica sceglie di iscrivere il
disegno. Tre push in più: la sfida nuova, gli ultimi 3 giorni, i
risultati. È la parte B di TASK-343.

## 8. Il regolamento ufficiale

L'App Store (linea guida 5.3: i concorsi dentro un'app sono del
developer, con il regolamento nell'app e la frase che Apple non è sponsor
né coinvolta) e Google Play chiedono un regolamento visibile. Si apre da
«How it works» e dice: chi organizza (MuW, Luca Pallaoro: il nome dato
dall'utente il 2026-10-25),
le date, chi partecipa e come, come si vince e i pari merito, che il
premio non ha valore in denaro, che MuW può escludere un post che viola le
regole, e che **Apple e Google non sponsorizzano il concorso e non vi sono
coinvolte**. Il testo, nelle cinque lingue, è in `tasks/TASK-299.md`
(«Testi da approvare») finché l'utente non lo approva; poi vive nell'app.

Una **sfida del mese** ha il suo regolamento (`THEMED_RULES` in
`ContestRules.tsx`): in più dice il tema, come ci si iscrive, che i disegni
iscritti non hanno limite e si ritirano fino alla fine, che vince fra quelli in
gara e che MuW può escludere un post fuori tema. Premio e frase su Apple e
Google restano quelli di sopra. Il testo è approvato dall'utente (2026-10-30,
«Approve them all», PR #667). Un concorso senza tema mostra il regolamento di
prima, senza cambi.

## 9. Dati

Migrazione `00NN_contests.sql` (il numero è il primo libero al merge, da
0028):

| Colonna | Che cos'è |
|---|---|
| `id uuid` | la chiave, casuale |
| `starts_at`, `ends_at timestamptz` | il periodo, `ends_at > starts_at` |
| `winner_drawing_id uuid` | il disegno vincitore, `REFERENCES drawings ON DELETE SET NULL`, nullo finché aperto |
| `winner_user_id bigint` | l'account vincitore, `REFERENCES users ON DELETE SET NULL` |
| `closed_at timestamptz` | quando è stato proclamato; nullo finché aperto |
| `created_at timestamptz` | quando è stato aperto |

Un indice unico parziale su `(closed_at) WHERE closed_at IS NULL` tiene
**un solo concorso aperto** alla volta. `contest_wins` di un account è
`count(*)` dei concorsi con `winner_user_id` suo.

Le sfide del mese (TASK-343, `0039_contest_themes.sql`) aggiungono due
colonne e una tabella:

| Colonna | Che cos'è |
|---|---|
| `contests.theme jsonb` | il tema per lingua, `{"en": {"title", "description"}, …}`, `en` obbligatoria; nullo: il concorso di ADR-0260 |
| `contests.reminded_at timestamptz` | quando è partita la push degli ultimi 3 giorni; nullo finché no |
| `contest_entries (contest_id, drawing_id, user_id, created_at)` | i disegni iscritti, chiave `(contest_id, drawing_id)`, `ON DELETE CASCADE` su concorso, disegno e account |

Nessuna colonna su `drawings` e `reactions`: l'iscrizione dice solo che il
proprietario ha scelto il tema; se il disegno partecipa lo rilegge la
query (§3).

## 10. API

| Metodo | Endpoint | Account | Cosa |
|---|---|---|---|
| GET | `/contests/current` | no (il token aggiunge `mine`) | il concorso aperto, o chiuso da meno di 7 giorni |

Risposta `200 Contest`:

```json
{
  "id": "…",
  "starts_at": "2026-11-02T00:00:00+01:00",
  "ends_at": "2026-11-15T23:59:59+01:00",
  "closed_at": null,
  "top": [
    { "rank": 1, "reactions": 14, "drawing": { "…": "come un post del feed, con author" } }
  ],
  "mine": { "drawing_id": "…", "rank": 5, "reactions": 4 },
  "winner": null
}
```

- `top` ha al più **tre** voci nell'ordine di §4; con un token, un post
  attraverso un blocco con chi chiede **non c'è** (tiene il suo `rank`:
  la lista può avere due voci).
- `mine` c'è solo con un token, e vale `null` se chi chiede non ha un
  post che partecipa.
- `winner` è `{ "reactions", "drawing" }` dopo la chiusura, `null` prima;
  `drawing` è `null` se la corsa è stata cancellata.
- `404 no_contest` «There is no contest right now.» senza un concorso
  aperto né uno chiuso da meno di 7 giorni. Senza database,
  `503 accounts_unavailable`.
- I profili: `contest_wins` in `GET /users/{public_id}` e in `GET /me`.
- La push `contest_won`, `data` con `kind` e `drawing_id`.

Tipi in `shared-types` (`Contest`, `ContestEntry`, `ContestMine`,
`PushKind`), esempi in `fixtures/contest.json` e `contest-closed.json`.

Le sfide del mese hanno in più (§15, `API.md` «Le sfide del mese»):
`theme`, `entrants` ed `entered` in `GET /contests/current`; `PUT` e
`DELETE /contests/{id}/entries/{drawing_id}`; la galleria `GET
/contests/{id}/entries?order=top|new&cursor=`; l'archivio `GET
/contests?state=closed&cursor=`; le push `contest_open`,
`contest_last_days`, `contest_results` con `data` `{ kind, contest_id }`.

## 11. Comandi (sul server, chi lo gestisce)

```
python -m shaperoute_api.contests open --from 2026-11-02T00:00+01:00 --to 2026-11-15T23:59:59+01:00 [--theme FILE.json]
python -m shaperoute_api.contests standings
python -m shaperoute_api.contests close [--exclude <drawing_id> …] [--dry-run]
```

- `open` rifiuta se c'è già un concorso aperto, o se `to` non è dopo
  `from`. Le date le dà l'utente; la proposta per il primo: due
  settimane, dal lunedì dopo che il server ha il concorso.
- `standings` stampa i primi dieci: posto, autore, titolo, reazioni, di
  cui da account più giovani del concorso, cuori MuW.
- `close` proclama una volta (§6); `--dry-run` stampa chi vincerebbe e
  non scrive.
- `--theme FILE.json` apre una **sfida del mese** (§15): il file ha il
  titolo (1–60 caratteri) e la descrizione (1–500) in `en`, `de`, `it`,
  `es` e `fr`, nient'altro; è controllato **prima** di aprire (altrimenti
  esce con 2 e dice che cosa manca). Aperta la sfida, la push
  `contest_open` parte dal comando e il comando dice a quanti account.
  `standings` di una sfida scrive prima il tema e quanti disegni sono
  iscritti, da quanti account.

Sul server il concorso arriva **dopo l'approvazione di Apple e con l'ok
dell'utente**: migrazione, deploy, `open`.

## 12. Il concorso con la maglietta

Quando ci sarà la ditta. In Italia un premio di valore fa del concorso un
**concorso a premio** (DPR 430/2001): promotore un'impresa, regolamento,
comunicazione al Ministero almeno 15 giorni prima, cauzione pari al
valore dei premi, verbale di assegnazione con un notaio o un funzionario
camerale, esclusi i dipendenti. Serve il commercialista. In app
servirebbero il consenso a essere contattati e un indirizzo di spedizione.
È un task a sé, non questo.

## 13. Com'è fatta la parte A

Dal piano qui sopra cambiano solo questi dettagli, decisi dall'agente su
delega dell'utente (2026-10-26):

- l'indice di un solo concorso aperto è su `((TRUE)) WHERE closed_at IS
  NULL`, non su `closed_at`: in un indice unico i `NULL` non collidono;
- `close` **rifiuta prima di `ends_at`** («the contest ends at …: close it
  after»): fino alla fine le reazioni contano ancora, e il concorso
  finisce alla data scritta (§2). Chiude con la riga bloccata (`FOR
  UPDATE`) e l'`UPDATE … WHERE closed_at IS NULL`; la push parte dopo il
  commit, nel processo del comando, prima che il comando esca;
- una reazione di un **account nascosto** (TASK-291) non conta, come non si
  vede: `apart_sql` tiene a parte anche loro;
- le «reazioni da account più giovani del concorso» di `standings` sono
  quelle di account creati da `starts_at` in poi;
- un post escluso con `--exclude` non si scrive da nessuna parte: non
  vince, ma resta in `top` al suo posto anche dopo la chiusura;
- `winner.reactions` è il conto di oggi con la stessa query; `0` con
  `drawing` `null` (corsa cancellata, o nessun partecipante);
- `mine` manca senza token (`response_model_exclude_unset`) ed è `null` con
  un token senza un post che partecipa;
- `contest_wins` è una sottoquery fra le colonne di `User`
  (`accounts.contest_wins_sql`): `GET /me`, `Session` e ogni risposta che
  riporta l'account lo hanno senza altre letture;
- il codice d'errore `no_contest` sta in `schemas.py`,
  `fixtures/api-error-codes.json` e `API_ERROR_CODES` (ok del
  Coordinatore, 2026-10-25);
- i comandi escono con 0 (fatto), 1 (niente da fare: nessun concorso
  aperto) o 2 (rifiuto: date, secondo concorso, chiusura anticipata).

## 14. Com'è fatta la parte B

L'app (`apps/mobile/src/contest/`) mostra quello che il server dice, come
in §7. Questi dettagli li ha decisi l'agente su delega dell'utente
(2026-10-26):

- **Quando chiede.** `useContest` chiede `GET /contests/current` quando
  «Feed» è sulla pagina, **una volta per account** finché l'app è aperta
  (come la prima pagina del Feed: «Feed» si ricostruisce dopo un disegno
  sulla mappa e non richiede), e di nuovo a **ogni pull**. Con un account
  la richiesta porta il token, per `mine`. Una risposta arrivata dopo una
  richiesta più nuova non conta.
- **Che cosa tiene.** `contest.json` nei documenti del telefono tiene la
  risposta **e l'account per cui è stata chiesta** (`{ account, contest }`):
  `mine` si mostra solo all'account a cui appartiene, anche senza rete
  dopo un cambio di account. Lo cancellano il `404 no_contest` e il 404 di
  un'API di prima del concorso (`http_error`, che su preview tiene la
  scheda nascosta finché il server non ha la parte A); senza rete, un 5xx
  o un 401 non cambiano niente.
- **I giorni** sono quelli del calendario del telefono (`daysLeft.ts`): «3
  days left» tre giorni prima dell'ultimo, a qualunque ora; «Ends today»
  l'ultimo; da `ends_at` in poi, finché manca `closed_at`, «Ended · the
  winner is coming». L'orologio si rilegge ogni minuto mentre la scheda è
  sulla pagina. Dopo la fine «Publish a run to take part.» non c'è più.
- **I primi tre** sono tasti solo con un account: aprire un disegno chiede
  `GET /drawings/{id}` con il token. Un autore bloccato mentre l'app è
  aperta sparisce subito dalla scheda, come il suo post dal Feed.
- **Il vincitore**: per 7 giorni la scheda è il post vincitore disegnato
  da `FeedPost`, con la sua mappa, sotto la riga «{name} won the MuW
  contest» e il badge; senza `winner.drawing` (corsa cancellata, nessun
  partecipante) non c'è niente. La fascia sul disegno aperto
  (`DrawingCard`) vale per il concorso tenuto sul telefono, finché c'è.
- **Il regolamento** (`ContestRules.tsx`) si apre sopra l'app: «MuW
  contest», il titolo «Official rules», poi i paragrafi approvati, con le
  date scritte come i giorni dei disegni (`dayLabel`, nella lingua
  dell'app).
- **I numeri al singolare**: «1 reaction» e «Your best post: #1, 1
  reaction», approvati dall'utente con gli altri testi (2026-10-26).
- **La push** `contest_won` porta `drawing_id`: `notificationTap` la apriva
  già, nessun cambio.
- Il badge e la fascia sono lo stesso componente (`WinnerBadge.tsx`),
  neutro: il giallo è del percorso, il rosso di chi aspetta una risposta;
  la coppa è un emoji.

## 15. Le sfide del mese (TASK-343, ADR-0296)

Il concorso con un **tema**. La richiesta dell'utente del 2026-10-29 (una
sezione «Challenge» con il tema del mese, la galleria, l'archivio, le
notifiche) e la proposta approvata con «Yes, as proposed»: il tema sta sul
concorso, si partecipa **iscrivendosi**, il voto resta la reazione (§3).
Quanti disegni per account: **nessun limite** (scelta dell'utente del
2026-10-30, «No limit»).

- **Senza tema niente cambia**: `GET /contests/current` risponde con gli
  stessi campi, partecipano tutti i post del periodo, nessuna push nuova.
- **Con un tema** partecipa solo un disegno **iscritto** (§3, punto 6),
  con tutte le altre regole. Il proprietario lo iscrive e lo ritira finché
  la sfida è aperta e prima di `ends_at`; dopo, la classifica è ferma per
  `close`. Si iscrive solo un disegno che partecipa già (per tutti, nel
  periodo, registrato dall'app, non nascosto): un rifiuto ha il suo codice
  (`contest_closed`, `not_entrant`). Un disegno iscritto che smette di
  partecipare esce dalla classifica da solo, l'iscrizione resta: se torna
  per tutti, torna in gara. Nessun controllo del tema: chi chiude esclude
  a mano con `--exclude` (§5).
- **La galleria** è la classifica intera (`RANKED_SQL`, una regola sola
  per chi è davanti), per posto o dal più recente; **l'archivio** i
  concorsi chiusi, con o senza tema, dal più recente, con vincitore e
  primi tre. Un blocco toglie il post a chi chiede, i posti restano.
- **Tre push**, con l'interruttore «Push notifications» e un telefono, mai
  a un account nascosto, il titolo del tema nella lingua del telefono
  (inglese se il tema non ce l'ha); toccate aprono la pagina della sfida:
  - `contest_open`, quando `open --theme` apre la sfida: a tutti;
  - `contest_last_days`, quando mancano **3 giorni** a `ends_at`, una
    volta sola: a chi ha pubblicato almeno un disegno per tutti e non ne
    ha iscritto nessuno;
  - `contest_results`, quando `close` chiude la sfida: a chi aveva un
    disegno in gara, tranne il vincitore, che riceve `contest_won`.

Questi dettagli li ha decisi l'agente su delega dell'utente
(2026-10-30):

- `GET /contests/current` di una sfida è `ThemedContestBody`, un
  `ContestBody` con `theme`, `entrants` ed `entered`: un concorso senza
  tema ha lo stesso corpo di prima, senza campi nulli in più, e l'app
  riconosce la sfida dal campo `theme`.
- `entrants` conta gli account con un disegno che partecipa **oggi**;
  `entered` gli id iscritti, che partecipino ancora o no (l'interruttore
  dell'app deve poter ritirare anche quelli).
- Iscriversi a un **concorso senza tema** è `409 contest_closed`: quel
  concorso non prende iscrizioni. Un id di concorso che non c'è è `404
  no_contest` «There is no such contest.». Iscrivere di nuovo, o ritirare
  un disegno non iscritto, è `204`: le due chiamate sono idempotenti.
  L'iscrizione tiene la riga del concorso `FOR SHARE`: non s'incrocia con
  `close`.
- Il tema dal comando ha tutte e cinque le lingue; nel database basta
  `en` (un `CHECK`), perché l'app sceglie la sua e ripiega sull'inglese.
  Titolo al più 60 caratteri, descrizione al più 500.
- La galleria e l'archivio rispondono **anche senza token**, come
  `/contests/current`; 30 voci per pagina la galleria, 10 l'archivio. Il
  `cursor` della galleria per posto è il posto dell'ultima voce (se la
  classifica cambia fra due pagine una voce può ripetersi o saltare: è
  una galleria, non la classifica ufficiale, che è `standings`); dal più
  recente e nell'archivio è il momento e l'id dell'ultima voce.
- **Gli ultimi 3 giorni**: un orologio nel processo dell'API
  (`ContestClock` in `contest_clock.py`, ogni 10 minuti), come
  `GroupRunClock`: un `UPDATE … SET reminded_at` marca la sfida prima di
  avvisare, così due processi non la mandano due volte. Parte se la sfida
  è cominciata, aperta, con tema, e `ends_at` è fra adesso e 3 giorni; un
  server spento in quel momento la manda alla ripartenza, purché prima
  della fine. «Ha pubblicato almeno un disegno» vuol dire un disegno per
  tutti, non nascosto, di qualunque giorno.
- **I risultati** vanno a chi ha un disegno in gara alla chiusura, anche
  se escluso con `--exclude`; partono dal comando `close` dopo il commit,
  come `contest_won`. `contest_open` parte dal comando `open`, con le
  push mandate una per volta prima che il comando esca.
- Le tre push sono in `OWN_KINDS`: ognuno ne è l'«autore», perché non le
  manda nessuno; la chiave del «stesso evento» è l'id della sfida.

**Nell'app** (parte B, `apps/mobile/src/contest/`), decisi dall'agente su
delega dell'utente (2026-10-30):

- **Una sfida si riconosce da `theme`** (`themedOf`): senza, o con un tema che
  non si legge, è un concorso come prima, con la stessa scheda e lo stesso
  regolamento. Mancano `entrants` o `entered`: 0 e nessuno.
- **La scheda** ha «Monthly challenge» e il titolo del tema; la testa e «See
  the challenge» aprono la pagina, dove sta «How it works». Dopo la chiusura
  «See the challenge» resta sotto il post vincitore, per la settimana.
- **La pagina** sta sopra l'app, come «Find friends»: la monta `ProfileLayer`
  e la apre `contestDoor`, dalla scheda o da una delle tre push. Un post aperto
  dalla galleria la nasconde senza smontarla: tornando è dov'era. «Draw it near
  me», «Edit the drawing» e il proprio profilo la chiudono. All'apertura chiede
  di nuovo la sfida; se non è quella tenuta sul telefono la cerca nella prima
  pagina dell'archivio, altrimenti dice che non è più disponibile.
- **La galleria** mostra posto e reazioni sopra il post di `FeedPost`; si vota
  dal post aperto, come nel Feed. Un 404 è una galleria vuota; senza rete, «Try
  again».
- **«Past challenges»** è una pagina dentro quella della sfida: si chiede solo
  quando si apre. I concorsi senza tema ci sono, come «MuW contest».
- **L'iscrizione** è un campo della scelta (`DrawingChoice.entry`), mai nel
  corpo del disegno: parte dopo il salvataggio, anche dalla coda di
  `drawingOutbox`. Senza rete aspetta; rifiutata se ne va, il disegno resta
  pubblicato. Su «Followers» o «Only me» l'interruttore sparisce e non parte
  niente; tornando a «Everyone» è com'era.
- **Sul post già pubblicato**: dal modulo di «My activities», che parte acceso
  se il disegno è fra gli `entered` dell'account. L'interruttore sul post aperto
  è `EnterOnPost.tsx`, si monta in `DrawingCard` dopo TASK-339 B.
- **L'interruttore usa la sfida tenuta sul telefono**: `ProfileLayer` la chiede
  una volta per account appena c'è un accesso, così il modulo la conosce anche
  senza aver aperto «Feed». Una sfida aperta mentre l'app è già aperta si vede
  alla prossima apertura, o con un pull del Feed.
- **L'interruttore è quello dell'app** (`SwitchRow`, come `StravaSwitch`, «On» o
  «Off»), non quello del telefono: nel simulatore il tocco sul nativo accendeva
  e non spegneva, e un ritiro così non si poteva fare (trovato nella prova del
  2026-10-30).
- **Dopo un'iscrizione o un ritiro** la sfida si richiede (`tellEntered`): i
  primi tre, `mine` e quanti partecipano cambiano, e la scheda li mostra senza
  pull.
- **I testi** dicono «Monthly challenge», mai solo «Challenges» come la scheda di
  «Play»; nelle altre lingue «del mese» sta anche in «Past challenges».
