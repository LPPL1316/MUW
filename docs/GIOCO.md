# GIOCO — Il gioco delle forme

> Documento di dominio del gioco: come si contano i km, come si sblocca
> una forma, come funzionano squadre e sfide, dove stanno i dati.
> Perché è fatto così: ADR-0255. Lo stato delle parti: `tasks/TASK-296.md`.

## 1. L'idea

Le corse a piedi salvate in «My activities» valgono per un gioco. I km
sommati e i tempi migliori sbloccano **forme da collezionare**. In
**squadra** si ricrea insieme una forma divisa in **pezzi**, entro una
scadenza.

Tutto sta nella pagina **«Play»**, accanto a Feed, Draw ed Explore
(scelta dell'utente del 2026-10-23), con due schede: **Collection** e
**Challenges**.

Le forme del gioco sono figurine: **non** chiudono niente in «Draw», dove
ogni forma resta libera. Non c'è punteggio né classifica: TASK-241 ha tolto
il punteggio su richiesta dell'utente, e il gioco mostra solo la
collezione e le barre di avanzamento.

## 2. Chi decide che cosa

- **Il server conta, l'app mostra.** Km, passo e sblocchi si calcolano
  solo sull'API, dalla traccia salvata in `runs`. Un'app modificata non
  può dire «ho corso 100 km».
- **Le regole sono pure.** `services/api/shaperoute_api/game_rules.py`
  riceve una traccia e restituisce un risultato: niente database, rete o
  orologio. Ogni regola ha test deterministici su tracce finte.
- **Il route engine non cambia.** Il gioco non genera percorsi: usa solo
  `clean_track`, `haversine_m` e i contorni di `route_engine/shapes/`, che
  l'API già importa.
- **Tempo reale senza infrastruttura nuova.** L'app rilegge la sfida
  aperta ogni 15 s e quando torna in primo piano; poi ci sono le push.
  Niente WebSocket.
- **Agli altri nessuna coordinata.** I compagni di squadra vedono nome,
  foto, pezzi e km, mai tracce, orari o luoghi.

## 3. Che cosa conta

- Solo le corse a piedi salvate nell'account (`runs.activity =
  'running'`). Bici e pagaia no.
- Contano anche le corse salvate **prima** del gioco. Un comando le
  calcola una volta sul server (§7), senza mandare push.
- Due corse dello stesso account che si sovrappongono nel tempo contano
  una volta sola: vale quella salvata prima, l'altra ha la ragione
  `overlap`.
- Al massimo **120 km contati al giorno** (giorno UTC di `started_at`).
  Oltre il tetto la corsa conta solo fino a 120 km.
- Una corsa cancellata toglie i suoi km dal totale, ma le forme già
  sbloccate e i pezzi già finiti restano.
- Una corsa che non conta resta in «My activities» e la ragione si vede
  nel dettaglio della corsa, dentro «Play».

## 4. Anti-imbroglio

Lavora sulla traccia già pulita da `clean_track`: al salvataggio sono già
scartate le posizioni con precisione oltre 40 m, quelle ripetute e i
salti oltre 12 m/s. La traccia salvata non ha più la precisione, quindi
le regole sotto usano solo posizioni e tempi (`M`) e le pause della corsa.

1. **Tratti da veicolo.** Una finestra di passi consecutivi lunga almeno
   200 m e percorsa sopra **7,0 m/s** (2:23/km, più veloce di un record
   del mondo sui 1500 m) non conta.
2. **Corsa da veicolo.** La corsa non conta per niente (ragione
   `vehicle`) se i tratti scartati superano il **10 %** della distanza,
   oppure se la media in movimento supera **6,0 m/s** su più di 3 km.
3. **Buchi.** Un passo fra due posizioni distanti più di 30 s nel tempo
   conta nei km, se la sua velocità è da corsa, ma interrompe i tempi
   migliori: nessuna finestra lo attraversa.
4. **Tempi migliori solo su tratti densi.** Una finestra vale se ha in
   media almeno una posizione ogni 10 s.
5. **Pause.** Il tempo delle pause, manuali e automatiche, non conta. Il
   passo attraverso una pausa manuale non conta né nei km né nei tempi,
   come in `activities.recorded`.

**Limite noto**: una bici guidata piano, a passo di corsa, il solo GPS
non la riconosce. Servirebbe la cadenza dall'accelerometro, cioè una
dipendenza nativa nuova e quindi un task a parte, con il sì dell'utente.

Le soglie stanno in costanti di `game_rules.py`. Ogni volta che una regola
cambia si alza `RULES_VERSION` e il comando del §7 ricalcola le corse.

## 5. La collezione

### 5.1 Sbloccare

- **Per distanza**: la somma dei km contati raggiunge la soglia.
- **Per velocità**: in una sola corsa, un tratto continuo di distanza `D`
  ha un passo pari o migliore della soglia. Per ogni corsa si calcola il
  **miglior tempo in movimento** su 1 000, 5 000, 10 000 e 21 097 m con
  due indici che scorrono la traccia (O(n)), interpolando ai bordi della
  finestra.
- Una forma sbloccata resta per sempre (`game_unlocks`), anche se si
  cancella la corsa che l'ha sbloccata.

### 5.2 Avanzamento delle forme bloccate

- **Distanza**: km contati / soglia, per esempio «14.2 / 20 km — 71 %».
- **Velocità**: se hai già corso `D` di fila, tempo obiettivo / tuo
  miglior tempo, per esempio «Best 1 km 5:22 · target 5:00 — 93 %».
  Altrimenti la tua corsa più lunga / `D`.
- L'avanzamento si ferma al 99 % finché la forma non è sbloccata.

### 5.3 Catalogo

Il catalogo sta in `shaperoute_api/game_catalog.py`. Le forme si
cambiano con un deploy dell'API, senza toccare l'app. Ogni forma ha `id`,
nome, tipo (`distance` o `pace`), requisito, ordine e contorno in
coordinate **del disegno**, da 0 a 1 e mai geografiche:

- star, heart, circle, moon, sun, lightning, arrow e crown vengono da
  `route_engine/shapes/`;
- triangle, square, hexagon e diamond sono poligoni regolari.

| id | Requisito |
|---|---|
| `triangle` | 5 km in totale |
| `square` | 10 km |
| `hexagon` | 20 km |
| `circle` | 42 km |
| `star` | 100 km |
| `heart` | 250 km |
| `moon` | 500 km |
| `sun` | 1 000 km |
| `lightning` | 1 km sotto 5:00/km |
| `diamond` | 5 km sotto 5:30/km |
| `arrow` | 10 km sotto 6:00/km |
| `crown` | 21,1 km sotto 6:00/km |

Il catalogo è una proposta dell'agente: l'utente può cambiarlo quando
vuole, perché costa solo un deploy dell'API.

## 6. Squadre e sfide

### 6.1 Squadre

- Una squadra ha un nome, da 1 a 40 caratteri, che passa dal filtro
  delle parole di TASK-213 (`check_comment`). Ha fino a **20 iscritti**.
  Un account sta in al massimo 10 squadre.
- Si entra con un **codice di 6 caratteri** (`A–Z` e `2–9`, senza `I`,
  `O`, `0` e `1`). La squadra è privata: non compare in nessuna ricerca.
  Un link che apre direttamente l'app è un seguito, se chiede una build
  nativa.
- Chi crea la squadra può togliere un iscritto, e ognuno può uscire. Se
  chi l'ha creata se ne va o cancella l'account, la squadra passa
  all'iscritto più vecchio. Una squadra senza iscritti si cancella.
- **Blocchi (TASK-121)**: chi ha bloccato un iscritto, o ne è stato
  bloccato, non può entrare nella squadra e riceve un «You can't join this
  team.» generico, senza sapere perché. Se un blocco nasce fra due che
  sono già nella stessa squadra, uno dei due esce: la regola è nel
  task file, parte C, ed è da confermare con l'utente.

### 6.2 Sfide

- Una sfida ha una forma del catalogo divisa in **N pezzi**, da 2 a 12,
  di lunghezza uguale sul contorno. Ogni pezzo chiede **X km**, da 1 a
  50, oppure è un **pezzo veloce**: 1 km o 5 km sotto un passo scelto.
- Ha una scadenza da 1 a 14 giorni, **7 di default**. Una squadra ha al
  massimo una sfida attiva alla volta, e qualunque iscritto può crearne una
  quando non ce n'è.
- Il contorno dei pezzi non si salva: si ricava sempre da forma e N con
  una funzione pura, che dà gli stessi pezzi sul telefono e sul server.

### 6.3 Pezzi

- Un iscritto tocca un pezzo libero e il pezzo diventa suo (`held_at`).
  Ognuno tiene un solo pezzo in corso alla volta.
- Riempiono il pezzo le sue corse che contano, iniziate dopo `held_at` e
  prima della scadenza.
- Finito un pezzo, i km che avanzano passano da soli al prossimo pezzo
  libero, che diventa suo. Se non ce ne sono, i km avanzati si perdono.
- Un pezzo lasciato a metà torna libero con i km già fatti, che restano
  contati per chi li ha corsi.
- Un pezzo veloce è fatto quando una corsa del suo titolare, nella
  finestra di tempo della sfida, ha il miglior tempo richiesto.

### 6.4 Fine

- **Completa** quando tutti i pezzi sono fatti.
- **Scaduta** se alla scadenza ne manca anche uno solo. Conta una corsa
  iniziata prima della scadenza e salvata entro 3 ore dopo, per le corse
  ancora in coda sul telefono. La sfida si chiude a scadenza + 3 h.
- Chi ha dato km o ha finito un pezzo veloce in una sfida completa
  riceve la forma in **edizione squadra** (`edition = 'team'`).

## 7. Dati

Una migrazione nuova per la parte A e una per la parte C. Il numero è
il primo libero in `main` quando la PR entra. La tabella `runs` non
cambia. Ogni riga che appartiene a un account si cancella con l'account
(`ON DELETE CASCADE`). Le righe della squadra (sfide e pezzi) restano agli
altri iscritti, con il titolare del pezzo a `NULL`.

| Tabella | Parte | Che cosa |
|---|---|---|
| `game_runs` | A | per ogni corsa: `rules_version`, `counted`, `reason`, `counted_m`, `best_s` (jsonb, secondi su 1000/5000/10000/21097), `started_at`, `ended_at` |
| `game_unlocks` | A | `(user_id, shape_id, edition)`, `unlocked_at`, `run_id` (`SET NULL`), `challenge_id` (`SET NULL`) |
| `game_teams` | C | `id` uuid, `name`, `invite_code` unico, `owner_id` (`SET NULL`), `created_at` |
| `game_team_members` | C | `(team_id, user_id)`, `joined_at` |
| `game_challenges` | C | `id`, `team_id`, `shape_id`, `created_by` (`SET NULL`), `starts_at`, `ends_at`, `completed_at` |
| `game_pieces` | C | `(challenge_id, idx)`, `required_m` oppure `fast_distance_m` + `max_pace_s`, `holder_id` (`SET NULL`), `held_at`, `done_m`, `done_at` |
| `game_contributions` | C | `challenge_id`, `piece_idx`, `user_id` (`CASCADE`), `run_id` (`SET NULL`), `metres`, `at` |

Le corse di prima del gioco si calcolano con
`python -m shaperoute_api.game_backfill`: è idempotente, salta le righe
già alla `RULES_VERSION` corrente e non manda push. Si lancia una volta
dopo il deploy della parte A e di nuovo a ogni cambio di regole.

## 8. API

| Metodo | Percorso | Account | Parte |
|---|---|---|---|
| — | `POST /activities` (c'è già) | sì | A: dopo il salvataggio, `game.after_run_saved`; la risposta aggiunge `game: {counted, reason, unlocked[]}` (C aggiunge `pieces_done[]`) |
| GET | `/game/catalog` | no | A: il catalogo con i contorni. Se risponde 404, l'app nasconde «Play» (ADR-0255) |
| GET | `/game/me` | sì | A: km contati, migliori tempi, sblocchi, avanzamento |
| POST | `/game/teams` | sì | C |
| POST | `/game/teams/join` | sì | C: `{code}` |
| GET | `/game/teams` | sì | C: le mie squadre con la sfida attiva |
| DELETE | `/game/teams/{id}/members/{public_id}` | sì | C: esci, o togli un iscritto |
| POST | `/game/teams/{id}/challenges` | sì | C |
| GET | `/game/challenges/{id}` | sì | C: pezzi, titolari, km, contributi, tempo che resta |
| POST / DELETE | `/game/challenges/{id}/pieces/{idx}/hold` | sì | C: prendi o lascia un pezzo |

Le push sono `Kind` nuovi in `push.py`: `shape_unlocked` (parte A),
`piece_done`, `challenge_done` e `challenge_ending` (parte C). Valgono gli
interruttori di TASK-262 A (`notify_push`) e i blocchi, come per le altre
push. La push di una forma sbloccata parte sempre, ma con l'app aperta
il telefono non la mostra, perché c'è già la scheda dopo «Save». Serve
per le corse mandate più tardi dalla coda del telefono. I testi delle push li approva l'utente
nelle cinque lingue.

## 9. App

- **«Play»**, una quarta pagina da scorrere dopo Explore, con due schede
  (`Segmented`):
  - **Collection**: una griglia di forme. Le sbloccate sono a colori, con
    la data. Le bloccate sono in grigio, con il requisito e la barra di
    avanzamento. Senza account c'è «Sign in to collect shapes».
  - **Challenges**: le mie squadre, «Create» e «Join» con il codice, e la
    sfida aperta: la forma con i pezzi colorati per persona, chi ha dato
    quanto, quanto manca e il conto alla rovescia.
- **La pagina si vede solo se il server ha il gioco**: `GET /game/catalog`
  risponde 200. Con 404 resta nascosta. Senza rete vale l'ultima risposta
  salvata sul telefono, e al primo avvio la pagina resta nascosta.
- **Dopo «Save»**, se la risposta di `POST /activities` dice che la corsa
  ha sbloccato qualcosa, compare la scheda «New shape unlocked» con il
  contorno che si disegna, dopo il logo di TASK-212. Una corsa mandata
  più tardi dalla coda (`outbox`) avvisa con la push.
- **Durante la corsa** c'è una striscia sottile, per esempio «Hexagon
  14.2 / 20 km», oppure, con un pezzo veloce in mano, il passo dell'ultimo
  km contro l'obiettivo. È una stima del telefono: il conto vero lo fa il
  server dopo «Save».
- I colori vengono da `src/theme/tokens.ts`. I testi sono in inglese e
  tradotti nelle cinque lingue.
