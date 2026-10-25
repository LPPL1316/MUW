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
4. non escluso alla chiusura (`--exclude`, §5).

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

## 11. Comandi (sul server, chi lo gestisce)

```
python -m shaperoute_api.contests open --from 2026-11-02T00:00+01:00 --to 2026-11-15T23:59:59+01:00
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
