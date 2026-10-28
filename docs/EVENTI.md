# EVENTI — Le corse di gruppo («Group runs»)

> Regole delle corse di gruppo di MuW (TASK-309, ADR-0269). Il perché sta
> in `DECISIONS.md`, i passi in `tasks/TASK-309.md`, i contratti esatti in
> `API.md` quando la parte A li scrive.

## 1. Cos'è

Un iscritto sceglie una forma, dice **dove ci si trova e quando**, e la
pubblica come corsa di gruppo. Chi la vede dice «I'm going»; all'ora
fissata ci si trova alla partenza e si corre la forma insieme, come in un
run club. Ognuno registra la sua corsa come oggi.

Richiesta dell'utente del 2026-10-26: «dai la possibilità di creare anche
un post evento al quale una persona può creare un post con un disegno
scelto e dando un luogo di incontro ed un orario e poi come se fosse un
run club ci si incontra per correre la forma assieme». La proposta con i
default, aggiunte del Coordinatore comprese, ha avuto il suo «Sì, così»
lo stesso giorno: sono le regole qui sotto. Il punto 6.4 corregge la
proposta, e l'utente ha confermato la correzione lo stesso giorno.

## 2. Da dove nasce

- La crea **ogni iscritto con un account**, da un percorso pronto: il
  risultato di Draw, una scheda di Explore, un Preferito. Il bottone
  **«Create group run»** sta accanto al cuore dei preferiti.
- **Il percorso è quello**, punto per punto, con l'attività (corsa, bici,
  acqua), la penna alzata, i tratti con la bici a mano e l'inclinazione:
  gli stessi campi che si tengono in un Preferito (`API.md`,
  «Favorites»). Dopo la creazione il percorso non cambia; per un altro
  percorso si annulla e se ne crea una nuova.
- **Il luogo di ritrovo è la partenza del percorso**, il suo primo punto.
  Chi crea la sposta prima, sulla mappa, come oggi (TASK-273, TASK-292).
  Così tutti partono dallo stesso punto e disegnano la stessa forma.

## 3. I campi

| Campo | Regola |
|---|---|
| titolo | obbligatorio, una riga, al più 60 caratteri; l'app lo scrive col nome della forma |
| giorno e ora (`starts_at`) | da **30 minuti** a **60 giorni** da adesso; l'app li mostra nell'ora del telefono |
| «Where exactly» (`meeting_note`) | facoltativo, una riga, al più 80 caratteri («MUSE entrance») |
| descrizione | facoltativa, al più 500 caratteri, a capo compresi (ritmo, cosa portare) |
| chi lo vede (`visibility`) | **Everyone** o **Followers**; niente «Only me». Non cambia dopo la creazione |

- Titolo, «Where exactly» e descrizione passano dal **filtro dei commenti
  negativi** (TASK-213, `comment_filter.check_comment`): un testo
  rifiutato non si salva, e l'app mostra l'avviso di sempre.
- **Al più 10 corse di gruppo in arrivo per account**, contro lo spam.
- Il giorno e l'ora si scelgono con un selettore scritto in JavaScript,
  senza moduli nativi: l'impronta iOS resta `83793e26…` e la funzione
  arriva con un aggiornamento OTA.

## 4. Chi la vede

- **Everyone**: ogni iscritto; **Followers**: chi segue l'organizzatore
  con la richiesta accettata. L'organizzatore la vede sempre.
- **Un blocco** fra chi chiede e l'organizzatore (`follows.apart_sql`, nei
  due sensi) la nasconde del tutto: non si vede, non si apre, non si dice
  «I'm going». Risponde come un id che non c'è.
- **Nascosta** dal link delle segnalazioni (§8), la vede solo
  l'organizzatore.
- Un iscritto nascosto (`users.hidden_at`) è lontano da tutti, come oggi:
  le sue corse di gruppo non si vedono e lui non compare fra chi va.

## 5. Nel Feed

In cima al Feed, dall'alto, senza affollare:

1. la lente per trovare amici, a destra, com'è oggi;
2. la scheda del concorso, solo mentre un concorso c'è (TASK-299 B);
3. la fila **«Group runs»**, solo con almeno una corsa di gruppo da
   mostrare: schede piccole che scorrono di lato, con la forma, giorno e
   ora, i km e quanti vanno;
4. i post, come oggi.

Senza concorso e senza corse di gruppo il Feed è identico a oggi.

**Cosa entra nella fila**, dalla più vicina nel tempo (a parità, l'id),
al più 20:

- quelle **non finite** (§7) e **non annullate**, che chi chiede vede;
- le proprie e quelle di chi si segue, ovunque siano;
- quelle degli altri con la partenza **entro 50 km** dal telefono
  (`FEED_NEAR_M`, la regola del Feed); senza la posizione del telefono,
  tutte;
- in più, quelle a cui chi chiede ha detto «I'm going», ovunque siano.

Un tocco apre la pagina della corsa di gruppo: la mappa con la forma, il
luogo, giorno e ora, la descrizione, chi va, «I'm going» e «Start».

Anche il **profilo** dell'organizzatore ha le sue corse di gruppo: quelle
in arrivo e, sotto, le passate.

## 6. Partecipare

1. **«I'm going»** si dice e si toglie («Not going») finché la corsa di
   gruppo non è finita e non è annullata. Dirlo due volte non cambia
   niente.
2. **L'organizzatore va sempre**: è il primo dell'elenco, con la scritta
   «Organiser», e non si toglie.
3. **Chi va** lo vede chi vede la corsa di gruppo: nome e foto piccola,
   mai l'email; il numero e le prime facce sulla scheda, l'elenco intero
   nella pagina. Chi è lontano da chi chiede (blocco, nascosto) non è
   nell'elenco e non è contato.
4. **Nessuna notifica quando qualcuno si aggiunge**: l'organizzatore lo
   vede nella pagina. La proposta del 2026-10-26 diceva «solo nella lista
   Notifiche dell'app», ma quella lista nell'app non esiste. Avuta la
   correzione, l'utente ha scelto lo stesso giorno: «Nessuna notifica
   quando qualcuno si aggiunge: l'organizzatore lo vede nella pagina
   della corsa di gruppo».
5. **«Start»** apre la corsa sullo stesso percorso, come un Preferito: si
   può partire in ogni momento, ma la pagina mostra il ritrovo e l'ora.

## 7. Cambiare, annullare, finire

- **L'organizzatore cambia** titolo, giorno e ora, «Where exactly» e
  descrizione, finché la corsa di gruppo non comincia. Se cambiano **ora o
  luogo**, chi va riceve una push e il promemoria riparte da capo.
- **Annulla** finché non comincia: la corsa di gruppo esce dalla fila e
  dal profilo; chi va riceve una push, e chi la apre dalla push la vede
  con «Cancelled». Non si può più dire «I'm going».
- **Finita** 3 ore dopo l'inizio: esce dalla fila, non si dice più «I'm
  going», non si cambia; resta nel profilo dell'organizzatore fra le
  passate e si apre ancora.
- **Account cancellato**: le sue corse di gruppo spariscono, e chi andava
  a una non ancora cominciata riceve la push dell'annullamento.

## 8. Notifiche

| Tipo | Quando | A chi |
|---|---|---|
| `group_run_soon` | un'ora prima dell'inizio, **una volta sola** | chi va, organizzatore compreso |
| `group_run_changed` | l'organizzatore cambia ora o luogo | chi va, non l'organizzatore |
| `group_run_cancelled` | l'organizzatore annulla, o cancella l'account | chi va, non l'organizzatore |

- Il promemoria lo trova un orologio dell'API **ogni 5 minuti**, come
  `ChallengeClock` del gioco: le corse di gruppo che cominciano entro
  un'ora, non annullate e non ancora avvisate. Lo segna con un `UPDATE`
  condizionato (`reminded_at IS NULL`), così non parte mai due volte,
  anche con due processi. Una corsa di gruppo creata meno di un'ora prima
  avvisa al primo giro: il testo dice «sta per cominciare», non l'ora
  esatta.
- Le push non portano orari: il server non sa il fuso del telefono.
- Valgono l'interruttore «Push notifications» e i blocchi, come per le
  altre push (TASK-262 A). Questi tipi **non entrano nell'email del
  giorno** (TASK-262 B): arriverebbero dopo l'ora.
- La push porta `{ kind, group_run_id }` e apre la pagina della corsa di
  gruppo.

## 9. Segnalare e nascondere

Una corsa di gruppo si segnala come un post (`POST /reports`, il tipo
nuovo `group_run`), e la segnalazione arriva per email con il link
«Hide it from everyone else» (TASK-291). Nascosta, la vede solo
l'organizzatore; niente si cancella. Le regole di TASK-121 valgono tutte:
bloccare l'organizzatore la toglie.

## 10. Sicurezza

Un ritrovo dal vivo fra persone che non si conoscono:

- quando si crea una corsa di gruppo, sopra «Publish», sempre visibile:
  «Meet in a public place, never at your home. MuW doesn't organise or
  check group runs. Everyone on MuW is 16 or older.» (testo approvato con
  la proposta);
- il luogo lo sceglie chi crea, e MuW non lo controlla;
- chi vede la corsa di gruppo è deciso da chi la crea (Everyone o
  Followers); l'invito a persone scelte è fuori da questa versione (§13);
- segnalazioni, blocchi e il filtro dei testi come per i post.

## 11. Privacy

Chi va a quale corsa di gruppo è un dato nuovo. Lo vede chi vede la corsa
di gruppo; l'organizzatore vede tutti quelli che vanno. Le corse di gruppo
e le risposte di un account si cancellano con l'account (`ON DELETE
CASCADE`). La riga dell'informativa (`site/privacy`, cinque lingue), in
inglese:

> If you create a group run or say you're going, members who can see it
> see your name, your photo and that you're going. We delete your group
> runs and your answers when you delete your account.

Le traduzioni le porta la parte A, da approvare con l'utente.

## 12. I dati

```
group_runs
  id            uuid, primaria
  owner_id      → users, ON DELETE CASCADE
  title         text, 1–60
  starts_at     timestamptz
  meeting_note  text, al più 80, facoltativo
  description   text, al più 500, facoltativo
  visibility    'everyone' | 'followers'
  il percorso   i campi di un Preferito: activity, city, shape, word,
                style, distance_m, route_m, similarity, la linea intera,
                walks, on_foot, rotation_deg
  start         geography(Point), il primo punto, con indice GIST
  created_at, updated_at
  cancelled_at, reminded_at, hidden_at   facoltativi

group_run_going
  group_run_id  → group_runs, ON DELETE CASCADE
  user_id       → users, ON DELETE CASCADE
  created_at
  primaria (group_run_id, user_id)
```

L'organizzatore non ha una riga in `group_run_going`: va sempre (§6.2).

## 13. Fuori da questa versione

- **I commenti** sotto una corsa di gruppo: sono la parte C del task, dopo
  A e B.
- Legare le corse fatte alla corsa di gruppo («5 ran it together»).
- Corse di gruppo che si ripetono («ogni sabato alle 9»).
- I club, con una pagina propria.
- L'invito a persone scelte («solo su invito»).
- Il calendario del telefono («Add to calendar»): vuole un modulo nativo.

## 14. Com'è fatta

**Parte A, l'API** (branch `feat/TASK-309-a-group-runs-api`; contratti in
`API.md`, «Group runs»; tabelle in `DATABASE.md`, migrazione
`0032_group_runs.sql`):

- `group_runs.py` tiene tutto: le regole dei campi (§3), chi vede
  (`seen_sql`, §4), chi è contato (`counted_sql`, §6.3), la fila (§5), il
  profilo, i cambi e l'annullamento (§7), «I'm going» (§6), l'orologio
  `GroupRunClock` (§8) e la push a chi andava quando l'organizzatore
  cancella l'account (con `app.state.before_account_delete`, senza toccare
  `accounts.py`). Il percorso è il corpo di un Preferito
  (`favorites.FavoriteRequestBody`), importato e non cambiato.
- **Lo stato** si legge dall'ora del server: `upcoming` fino all'inizio,
  `started` per 3 ore, poi `over`; `cancelled` se annullata. «In arrivo»,
  per il limite di 10 e per il profilo, vuol dire non finita e non
  annullata.
- **Un blocco non cancella niente**: chi va e poi è bloccato (o blocca)
  resta nella tabella, ma non vede, non va, non è contato e non riceve
  push, per nessuno; sbloccato, torna. Lo stesso vale per chi non vede
  più una corsa «Followers» dopo aver smesso di seguire. Fra due che vanno,
  un blocco toglie l'uno dall'elenco dell'altro.
- **«Where exactly»** è il luogo del §7: cambiarlo, come cambiare l'ora,
  avvisa chi va e fa ripartire il promemoria. Titolo e note no.
- **Le push** portano `{ kind, group_run_id }` (`GroupRunPushData` in
  `shared-types`, accanto a `PushKind` come quelle delle sfide del gioco).
- I limiti contano i caratteri come Python (punti di codice); l'app li
  ricontrolla con le costanti `GROUP_RUN_*` di `shared-types`.
- Nessun codice d'errore nuovo: `schemas.py` ed `engine.zip` invariati.
- **La riga della privacy** (§11) sta in `apps/mobile/src/about/content/`,
  sezione «Group runs» sopra «Feedback», nelle cinque lingue approvate
  dall'utente; le pagine di `site/privacy` si rifanno da lì
  (`site/tools/make_privacy.mjs`).
