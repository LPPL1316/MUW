# TASK-311 — Parole scritte meglio, e sul server tutto quello che si chiede

**Stato**: In lavorazione (parte A: la misura su 1000 parole)
**Fase**: 4 · **Branch**: `feat/TASK-311-a-words-measure` (A, con questo
file), poi un branch per ciascuna delle parti B, C e D
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

1. **Le parole possono essere personali** (un nome): nell'archivio entrano
   solo quelle che passano il filtro delle parole, mai legate all'account;
   agli altri si propongono solo parole della lista provata.
2. **Disegni e foto**: se entrano nell'archivio, solo il contorno, mai la
   foto. Il testo della privacy lo approva l'utente.
3. **Niente peggiora**: nessuna forma che oggi riesce deve riuscire peggio;
   catalogo ed esempi misurati prima e dopo ogni modifica del motore.

Valgono anche le solite: motore puro, nessuna dipendenza nuova, impronta
iOS 83793e26, il server solo col sì dell'utente.

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
  persona (condizione 1): OK, GO, HI; RUN, MUW, SUN, JOY, YES, WOW, SKY,
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

### Le misure

*(In corso: i risultati vanno qui, con il riepilogo di `--summary`.)*

## Parte B — Il metodo (motore o API, dopo A)

Solo quello che A dimostra. Le strade possibili, da scegliere sui numeri:

- **più km a lettera** (`LETTER_DISTANCE_M` da 3000 a 4000): cambia che
  cosa l'utente può chiedere (CIAO da 9 a 16 km), quindi è una scelta
  dell'utente;
- **l'API propone la distanza e lo stile che riescono** per quella
  lunghezza di parola, da una tabella imparata da A, un file nel
  repository come `learned/vocabulary.json`, cambiato solo a mano;
- **le lettere che non riescono** mai, corrette nell'alfabeto.

«File toccati» al Coordinatore prima di cominciare.

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
  la foto, senza l'account (condizione 2). È la scelta dell'utente del
  2026-10-27, che supera il «mai» di ADR-0256 per questi due.
- **Le parole**: solo quelle che passano il filtro (condizione 1).
- **Le richieste senza percorso**: che cosa si è chiesto, la distanza e il
  perché, con una cella di circa 1 km al posto della posizione.
- Una migrazione nuova (il primo numero libero al merge), il paragrafo della
  privacy da far approvare all'utente.

«File toccati» al Coordinatore prima di cominciare.

## File toccati

Parte A (questa PR):

- `docs/tasks/TASK-311.md` (nuovo)
- `docs/DECISIONS.md` (ADR-0271)
- `docs/STATUS.md` (le righe di TASK-311)
- `services/route-engine/tests/measure_words_many.py` (nuovo)

## Criteri di accettazione (parte A)

- [ ] 1000 casi pianificati, i risultati e il riepilogo in questo file.
- [ ] Le proposte per B scritte sui numeri, con che cosa cambia per
      l'utente.
- [ ] Lo script passa `ruff` e `black`; non tocca il motore.
