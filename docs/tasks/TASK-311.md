# TASK-311 — Parole scritte meglio, e sul server tutto quello che si chiede

**Stato**: In lavorazione (parte A fatta: la misura su 1000 parole; B in
PR, «Lift the pen» sotto una parola su una riga; C e D da cominciare)
**Fase**: 4 · **Branch**: `feat/TASK-311-a-words-measure` (A, con questo
file), `feat/TASK-311-b-pen-up-hint` (B), poi un branch per ciascuna delle
parti C e D
**Dipende da**: TASK-297 A (l'archivio `drawn_routes`, ADR-0256), TASK-050,
TASK-077 e TASK-067 (le parole, i due stili, le unioni in alto), TASK-279 A
(la fila «WORDS» di «Explore»)
**ADR**: ADR-0271

## Obiettivo

Richiesta dell'utente del 2026-10-27: migliorare il calcolo delle scritte,
«magari aumenta i km», provarne 1000 e salvarle sul server perché aiutino i
calcoli e le proposte future; e salvare sul server tutte le forme, i disegni
e le scritte che gli utenti chiedono.

Due risultati:

1. **Le parole escono buone più spesso.** Prima si misura, su 1000 parole,
   che cosa rende buona una parola (km per lettera, stile, lunghezza,
   città); poi si cambia solo quello che la misura dimostra.
2. **Sul server resta quello che si chiede**: le parole provate, pronte per
   chi le chiede da un centro città e per le proposte; e ogni forma, parola,
   disegno a mano e contorno di foto chiesto dagli utenti, senza chi l'ha
   chiesto.

## Che cosa c'è già

- `drawn_routes` (TASK-297 A, ADR-0256, migrazione 0026) tiene ogni
  percorso disegnato, di una forma o di una parola, senza l'account; chi
  chiede la stessa cosa entro 10 m ha la risposta subito, entro 100 m
  raggiunta lungo le strade. È in `main`; sul server arriva con
  l'aggiornamento dopo Apple, col sì dell'utente.
- Non tiene: il contorno di una foto e la forma spostata a mano sull'acqua
  (ADR-0256, «dell'utente»), le richieste che non trovano un percorso; le
  parole entrano senza filtro.
- Le ricerche testuali sono già contate dagli eventi di TASK-130
  (`INSIGHTS.md`); il registro delle richieste (TASK-090) è spento.
- Una parola chiede almeno 3 km a lettera (`words.LETTER_DISTANCE_M`) e ha
  al più 8 lettere (`MAX_WORD_LETTERS`).

## Le condizioni del Coordinatore (2026-10-27)

TASK-311 e ADR-0271 confermati dal Coordinatore; i prossimi liberi sono
TASK-312 e ADR-0272.

1. **Le 1000 parole**: la misura gira sul Mac, con le zone in sola lettura
   (qui scaricate da Overpass: la copia dal server è stata negata). Sul
   server solo dopo Apple e col sì dell'utente. La tabella dice buone,
   tempo e km a lettera prima e dopo, su più città. **Niente peggiora**:
   un cambio del motore rifà `draw_examples`, `engine.zip`,
   `paddleExamples.json` e `catalogueShapes.json`, e nessuna forma che oggi
   riesce deve riuscire peggio.
2. **Le parole scritte dagli utenti sono dati personali** (a volte nomi):
   nell'archivio solo quelle che passano il filtro di TASK-213, mai legate
   all'account. Agli altri si propongono **solo** parole della lista
   provata, mai quelle scritte da qualcun altro.
3. **Disegni a mano e foto**: ADR-0256 li ha esclusi apposta. Se entrano,
   solo il contorno e mai la foto, senza account, con un tetto e una
   pulizia. Il testo della privacy è nuovo, lo approva l'utente ed entra
   con il prossimo aggiornamento della privacy.
4. Tutto si appoggia a `drawn_routes` di TASK-297 A (migrazione 0026, in
   `main`, non ancora sul server). Le migrazioni nuove prendono il primo
   numero libero al merge; l'impronta iOS resta 83793e26 nelle parti app.

Valgono anche le solite: motore puro, nessuna dipendenza nuova, «File
toccati» al Coordinatore prima di ogni parte di codice, «#NNN pronta» a lui,
che mergia al verde i task scelti dall'utente (ok del 2026-10-27).

## Parte A — La misura su 1000 parole

`services/route-engine/tests/measure_words_many.py` (nuovo) scrive ogni
parola con `plan_route` dal centro di una città e tiene una riga JSON per
caso: esito (buono se la distanza è entro il 10 % e la somiglianza almeno
0,90, come TASK-298), somiglianza, distanza, altezza delle lettere,
rotazione, spostamento della partenza, tracciamenti, secondi, avvisi e
punti del percorso. Una città per processo; una corsa fermata riparte da
dove era.

I 1000 casi: 50 parole × 5 città × 2 distanze × 2 stili.

- **Parole**: 50, da 2 a 8 lettere, nelle lingue dell'app, nessun nome di
  persona (condizione 2): OK, GO, HI; RUN, MUW, SUN, JOY, YES, WOW, SKY,
  ZEN; CIAO, LOVE, HOLA, MARE, SOLE, PACE, LUNA, VITA, FREE, HOPE, BIKE,
  KISS, ROMA; AMORE, HELLO, FORZA, BRAVO, SMILE, HAPPY, PEACE, DREAM, MERCI,
  DANKE, ITALY; GRAZIE, AUGURI, ITALIA, ESTATE, FAMILY, FRIEND; BONJOUR,
  RUNNING, VIAGGIO, FREEDOM, SORRISO; MARATONA, FAMIGLIA, BIRTHDAY,
  SUNSHINE.
- **Città**: Trento, Milano, Torino, Bologna, Roma, dal centro. Le zone
  sono scaricate da Overpass sul Mac, fuori dal repository
  (`out/TASK-311/zones/`): la lettura dei file del server è stata negata.
- **Distanze**: 3 km a lettera (il minimo di oggi) e 4.
- **Stili**: tondo e squadrato.

La prova di partenza (2026-10-27, Trento, stile tondo, la zona del Mac):
a 3 km a lettera CIAO, LOVE, RUN e MUW escono tutte sotto la soglia (LOVE
0,85, MUW 0,89, CIAO −16 % di distanza, RUN −12 %); a 4 km MUW è buona
(0,92). Troppo pochi casi per decidere: è il motivo della misura.

### Le misure (2026-10-27/28, Mac, `main` 381e35ae)

I 1000 casi, tutti pianificati (nessuno saltato); i dati in
`out/TASK-311/words/<città>.jsonl` del checkout principale (ignorato da
git), il riepilogo con `--summary out/TASK-311/words`. **443 buoni su
1000.**

| km a lettera, stile | buoni | somiglianza mediana | secondi a caso |
|---|---|---|---|
| 3, squadrato | 107/250 (43 %) | 0,88 | 13 |
| 3, tondo | 108/250 (43 %) | 0,89 | 19 |
| 4, squadrato | 107/250 (43 %) | 0,87 | 26 |
| 4, tondo | 121/250 (48 %) | 0,90 | 36 |

| lettere | buoni a 3 km | buoni a 4 km | somiglianza mediana (3 km) |
|---|---|---|---|
| 2 | 30/30 (100 %) | 30/30 (100 %) | 0,96 |
| 3 | 63/80 (79 %) | 69/80 (86 %) | 0,92 |
| 4 | 93/130 (72 %) | 95/130 (73 %) | 0,91 |
| 5 | 24/110 (22 %) | 28/110 (25 %) | 0,86 |
| 6 | 5/60 (8 %) | 6/60 (10 %) | 0,81 |
| 7 | 0/50 | 0/50 | 0,70 |
| 8 | 0/40 | 0/40 | 0,67 |

| città | buoni a 3 km | buoni a 4 km |
|---|---|---|
| Milano | 59 % | 60 % |
| Roma | 56 % | 52 % |
| Torino | 52 % | 55 % |
| Bologna | 38 % | 46 % |
| Trento | 10 % | 15 % |

Che cosa dicono:

1. **Più km a lettera non servono**: da 3 a 4 km i buoni passano da 215 a
   228 su 500 (+2,6 punti, tutti nello stile tondo) e il tempo quasi
   raddoppia (16 → 31 s a caso). Proporre all'utente di alzare il minimo
   non ha senso sui numeri.
2. **Conta la lunghezza della parola**: l'altezza delle lettere è la stessa
   a ogni lunghezza (600–800 m), ma da 5 lettere in su la somiglianza
   crolla. La misura non è la causa (`word_similarity` è la media delle
   lettere): una parola lunga si scrive su una sola linea di base dritta di
   8–10 km e torna lungo quella, e in città una linea così non c'è. A
   Bologna e Roma, dei 178 casi cattivi da 5 lettere in su 176 lo sono per
   la sola somiglianza, nessuno per la sola distanza.
3. **Trento va male per la geografia**: il centro sta fra l'Adige e la
   collina, la parola sale sul versante (1–2 km di scalini a percorso) e
   perde la forma; anche a 4 lettere solo 2 buone su 52. La partenza si
   sposta al più di 250 m.
4. I due stili si equivalgono su una riga (43 % e 43 % a 3 km).

**Le parole lunghe a penna alzata** (TASK-197: ogni lettera da sola, senza
linea di base né ritorno; i tratti a piedi fra le lettere non contano
nella distanza, come per la ricerca). Le 26 parole da 5 a 8 lettere a 3 km
a lettera, nei due stili, nelle cinque città: 260 casi, dati in
`out/TASK-311/penup/`.

| lettere | una riga | penna alzata |
|---|---|---|
| 5 | 24/110 (22 %) | 64/110 (58 %) |
| 6 | 5/60 (8 %) | 29/60 (48 %) |
| 7 | 0/50 | 6/50 (12 %) |
| 8 | 0/40 | 6/40 (15 %) |
| in tutto | 29/260 (11 %) | 105/260 (40 %) |

| città | una riga | penna alzata |
|---|---|---|
| Milano | 11/52 | 39/52 |
| Roma | 8/52 | 28/52 |
| Bologna | 2/52 | 23/52 |
| Torino | 8/52 | 13/52 |
| Trento | 0/52 | 2/52 |

Lo stesso tempo (27 s a caso in media). A penna alzata il tondo va meglio
dello squadrato (65/130 contro 40/130); su una riga il contrario (12/130 e
17/130).

## Parte B — Il metodo (motore o API, dopo A)

Solo quello che A dimostra. Sui numeri:

- **più km a lettera: no** (punto 1 delle misure); il minimo resta 3 km;
- **le parole da 5 lettere in su a penna alzata**: da 11 % a 40 % di
  buone (5 lettere da 22 % a 58 %, 6 da 8 % a 48 %). Cambia come si corre la parola (la registrazione in pausa
  fra una lettera e l'altra), quindi è una **scelta dell'utente**: la
  penna alzata proposta o scelta da sola per le parole lunghe, o solo
  un consiglio quando la riga non riesce;
- **7–8 lettere** non riescono nemmeno così: due righe, o il limite a 6
  lettere, da studiare a parte;
- **una partenza più lontana** dove il centro non ha spazio (Trento):
  da studiare a parte, con la ricerca lontana di TASK-203 B;
- **il metodo in memoria**: la tabella di riuscita per lunghezza, stile e
  penna, un file nel repository come `learned/vocabulary.json`, letto
  dall'API per proporre la scelta che riesce; cambiato solo a mano.

«File toccati» al Coordinatore prima di cominciare.

### La scelta dell'utente (2026-10-28) e che cosa fa B

Fra tre proposte del Coordinatore (da 5 lettere in su la penna alzata già
scelta, con la riga unica a un tocco; sempre a penna alzata, senza scelta;
solo un consiglio quando la riga non riesce) l'utente ha scritto «anche
quando non riesce grazie»: la prima, e in più il consiglio.

La prima metà c'era già. Da TASK-202 (2026-10-03, «sì, acceso di
default») l'interruttore «Lift the pen between letters» parte acceso per
**ogni** parola, anche corta, e si spegne a mano. Il Coordinatore ha
confermato di lasciarlo così anche per le parole da 2 a 4 lettere: la
misura di A le dà buone su una riga (72–100 %) ma non le ha provate a
penna alzata, e l'utente non ha chiesto di cambiare TASK-202.

B aggiunge il consiglio, solo nell'app (JavaScript, nessuna dipendenza,
impronta iOS invariata):

- **Quando**: una parola di almeno due lettere chiesta su una riga (con
  l'interruttore spento) **non riesce** se nel percorso scelto dal motore
  la somiglianza è sotto 0,90 o la distanza si scosta di più del 10 %, le
  soglie del motore che A ha usato per dire buona una parola; oppure se la
  risposta è `shape_not_drawable`. Conta la scelta del motore, non
  l'alternativa guardata (come «Try N km» di TASK-234).
- **Che cosa**: sotto il percorso, o sotto l'errore, la riga «This word
  may come out better with the pen up: each letter on its own.» con il
  pulsante «Lift the pen». Il pulsante accende l'interruttore e ridisegna
  la stessa parola con `pen_up: true`; da lì «Draw» la chiede così.
- **Mai**: con la penna già alzata, per una lettera sola, per una forma,
  un'immagine o sull'acqua, per gli altri errori.
- **Fuori**: il segnale `hint_taken` del pulsante (l'API accetta tre nomi
  in `signals.py`: serve una modifica all'API, da chiedere a parte); la
  tabella `learned/vocabulary.json`, inutile con una regola fissa; le
  7–8 lettere e la partenza più lontana (Trento), ognuna uno studio a
  parte.

Le regole in `apps/mobile/src/route/penUpHint.ts`; la riga in
`RouteOutcome` (`RoutePanel.tsx`); il collegamento in `App.tsx`.

## Parte C — Le parole provate sul server

Un comando nuovo dell'API mette i percorsi buoni di A in `drawn_routes`,
dal centro delle città: chi chiede la stessa parola da lì ha la risposta
subito, e le proposte («WORDS» in «Explore») possono attingere alla lista
provata. Le righe valgono solo per il motore che le ha disegnate
(`engine_fingerprint`): vanno disegnate dal motore del server, dopo B.
Serve la migrazione 0026 sul server: dopo Apple, col sì dell'utente. Quali
parole mostrare in «Explore» è una scelta dell'utente.

## Parte D — Nell'archivio tutto quello che si chiede

- **Disegni a mano e contorni delle foto**: entrano, solo il contorno e mai
  la foto, senza l'account, con un tetto e una pulizia (condizione 3). È
  la scelta dell'utente del 2026-10-27, che supera il «mai» di ADR-0256
  per questi due.
- **Le parole**: solo quelle che passano il filtro di TASK-213
  (condizione 2).
- **Le richieste senza percorso**: che cosa si è chiesto, la distanza e il
  perché, con una cella di circa 1 km al posto della posizione.
- Una migrazione nuova (il primo numero libero al merge), il paragrafo della
  privacy da far approvare all'utente, con il prossimo aggiornamento della
  privacy.

«File toccati» al Coordinatore prima di cominciare.

## File toccati

Parte A (questa PR):

- `docs/tasks/TASK-311.md` (nuovo)
- `docs/DECISIONS.md` (ADR-0271)
- `docs/STATUS.md` (le righe di TASK-311)
- `services/route-engine/tests/measure_words_many.py` (nuovo)

Parte B (approvati dal Coordinatore il 2026-10-28):

- `apps/mobile/src/route/penUpHint.ts` (nuovo)
- `apps/mobile/src/route/penUpHint.test.ts` (nuovo)
- `apps/mobile/src/route/RoutePanel.tsx` (solo `RouteOutcome` e la prop
  `onLiftPen`)
- `apps/mobile/src/route/RoutePanelPenUpHint.test.tsx` (nuovo)
- `apps/mobile/App.tsx` (il collegamento di `onLiftPen`)
- `apps/mobile/__tests__/AppPenUpHint.test.tsx` (nuovo)
- `apps/mobile/src/i18n/it.ts`, `de.ts`, `es.ts`, `fr.ts` (due testi, in
  fondo)
- `docs/UI.md`, `docs/STATUS.md`, `docs/DECISIONS.md` (aggiunta in fondo),
  `docs/tasks/TASK-311.md`

## Criteri di accettazione (parte B)

- [x] Una parola su una riga che non riesce (somiglianza sotto 0,90,
      distanza oltre il 10 %, o `shape_not_drawable`) mostra «Lift the
      pen»; premuto, la stessa parola parte con `pen_up: true` e
      l'interruttore resta acceso (test).
- [x] Nessuna riga con la penna già alzata, per una lettera, una forma,
      un'immagine, sull'acqua, per gli altri errori (test).
- [x] Le parole corte restano a penna alzata all'avvio (TASK-202).
- [ ] I testi nuovi approvati dall'utente nelle cinque lingue.
- [x] Test, lint, `tsc` e `format:check` verdi; nessuna dipendenza nuova.

## Criteri di accettazione (parte A)

- [x] 1000 casi pianificati, i risultati e il riepilogo in questo file.
- [x] Le proposte per B scritte sui numeri, con che cosa cambia per
      l'utente.
- [x] Lo script passa `ruff` e `black`; non tocca il motore.

**Esito della parte A** (2026-10-28): 443 buone su 1000; più km a lettera
non servono (+2,6 punti, tempo quasi doppio), conta la lunghezza: da 5
lettere in su la penna alzata porta le buone da 11 % a 40 %. Prossimo: la
scelta dell'utente sulla penna alzata per le parole lunghe (parte B).
