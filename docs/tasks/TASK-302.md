# TASK-302 — Le svolte di un incrocio attraversato a piedi dette come una

**Stato**: Done — chiuso nella sua PR, entra in `main` col merge del
Coordinatore; poi su `preview` (il Coordinatore pubblica)
**Fase**: 4 · **Branch**: `feat/TASK-302-merge-close-turns`
**ADR**: aggiunta ad ADR-0047 · **Solo app**, nessun testo nuovo, nessuna
dipendenza, l'impronta iOS non cambia

## Obiettivo

Le indicazioni a pochi metri l'una dall'altra, che sul posto sono una
manovra sola, si dicono e si mostrano come **una** indicazione con la
direzione risultante. Le micro-deviazioni che non girano spariscono.

## Contesto

Prova sul campo dell'utente a Trento, 2026-10-25 (terzo dei tre problemi
riportati; gli altri due sono TASK-303, il rientro dopo una deviazione, e
TASK-304, l'attività persa uscendo dall'app). In città la voce diceva
sequenze come «svolta a destra tra 10 m, poi a sinistra tra 10 m, poi a
sinistra». La richiesta:

- le manovre consecutive molto ravvicinate (es. entro 20–30 m, valore
  configurabile) diventano un'unica indicazione con la direzione
  risultante;
- si ignorano le micro-deviazioni sotto una soglia di angolo/distanza;
- l'indicazione corrisponde a cosa vede l'utente sul posto, non alla
  geometria esatta della traccia.

Il piano è stato approvato dall'utente in chat («Ok, procedi con i tre
piani»); numero dal Coordinatore, che ha posto due condizioni: la «u-turn»
non si fonde mai, e niente cambia la build dell'iPhone.

Perché succedeva: il motore dà un'indicazione a ogni incrocio del grafo
con almeno 3 strade (ADR-0045), e OSM in città disegna marciapiedi e
strisce pedonali come strade a sé. Un incrocio attraversato a piedi sono
2–4 nodi a 5–25 m l'uno dall'altro. Quelle a meno di 15 m arrivavano in
catena con «poi» (`joined`, ADR-0047), quelle fra 15 e 50 m come annunci
separati uno dietro l'altro. Le «mini svolte da 3 m» della prima recensione
del tester (2026-10-10) erano state lasciate «per ora»: questo task le
chiude.

## Contesto da leggere

- `docs/DECISIONS.md`: ADR-0045 (indicazioni dagli incroci), ADR-0047
  (vicine segnate, non fuse), ADR-0052 (navigazione sul telefono)
- `apps/mobile/src/navigation/navigator.ts` (annuncio a `ANNOUNCE_M`,
  `chainFrom`)

## Cosa fare

1. `apps/mobile/src/navigation/simplifyDirections.ts` (nuovo):
   `simplifyDirections(points, directions, { mergeM, spanM })`.
   - Una **manovra** sono le indicazioni a `MERGE_M` = 25 m o meno dalla
     precedente, per al massimo `MERGE_SPAN_M` = 50 m dalla prima
     all'ultima (un sentiero che gira a lungo non è una svolta sola). Le
     due soglie si possono passare alla funzione.
   - La svolta della manovra è **la direzione del percorso prima contro
     quella dopo**, lette sui punti del percorso 20 m prima della prima
     indicazione e 20 m dopo l'ultima (come il motore legge una strada),
     senza oltrepassare le indicazioni vicine; arrotondata nel verso della
     somma degli angoli (due destre da 100° sono un'inversione, non una
     sinistra decisa). Le soglie del motore: fino a 30° dritto, da 135°
     decisa, da 165° inversione.
   - Si dice dove la manovra **comincia** (la voce conta i metri fino lì),
     sulla **strada dove finisce**.
   - Una manovra che **non gira** non si dice, a meno che finisca su una
     strada di un altro nome: allora «Prosegui dritto su …». Sulla stessa
     strada, o su un marciapiede senza nome, silenzio.
   - Un'indicazione da sola resta com'è (anche i bivi). La **partenza** e
     l'**inversione** («u-turn», TASK-271) non entrano mai in una manovra.
   - `joined` si ricalcola con `GROUP_M` (15 m) dalla fine della manovra
     precedente.
2. `useNavigation.ts`: la navigazione parte da
   `simplifyDirections(points, directions)`. Il file della corsa tiene le
   indicazioni del motore come sono (TASK-272 le riapre e le semplifica di
   nuovo).
3. Test deterministici, sotto.

**Perché nell'app e non nel motore** (deciso dall'agente su delega
dell'utente): così vale subito per tutti i percorsi, anche quelli in cache,
gli esempi di «Explore» e le corse salvate, con un aggiornamento OTA. Nel
motore avrebbe chiesto `engine.zip`, `paddleExamples.json`, il server e
`draw_examples` (come TASK-271), e i percorsi già calcolati avrebbero
tenuto le indicazioni vecchie. Il motore continua a decidere il percorso e
le sue indicazioni; l'app decide come dirle.

## Criteri di accettazione

- [x] Un incrocio attraversato a piedi (destra, sinistra, sinistra in 20 m)
      è una sola «svolta a sinistra» sulla via dove finisce, detta una
      volta («In 50 metres, turn left onto Via Verdi»); senza la modifica
      lo stesso test sente «turn right onto the footpath, then turn left
      onto the footpath, then turn left onto Via Verdi».
- [x] Attraversare la strada e proseguire sulla stessa via (destra-sinistra
      in 12 m) non si dice; su una via di un altro nome si dice «dritto».
- [x] Svolte a più di 25 m restano come le dà il motore; con `mergeM: 5`
      tutto resta com'era.
- [x] «u-turn» e partenza non si fondono mai; `joined` resta quello del
      motore attorno a loro.
- [x] Un sentiero che gira di 45° ogni 20 m per 120 m non diventa una
      svolta sola.
- [x] Due destre da 100° in 15 m sono un'inversione.
- [x] Una camminata vera di Trento da Trento Fiere (grafo OSM in cache,
      indicazioni del motore di `main`): da 30 a 13 indicazioni;
      l'attraversamento verso Viale Rovereto (destra, sinistra, sinistra,
      destra in 25 m) è una «svolta a destra su Viale Rovereto»; il cambio
      di marciapiede a 1187 m sparisce.
- [x] Il file della corsa tiene le indicazioni del motore.
- [x] Tutta la suite dell'app verde (449 file, 3649 test), lint e prettier
      sui file toccati.

## Come provarlo

- `npx jest src/navigation/simplifyDirections` da `apps/mobile`: i casi
  finti e la traccia di Trento
  (`src/navigation/fixtures/trento-fiere-crossings.json`: un percorso a
  piedi fra Trento Fiere e Viale Rovereto calcolato sul grafo in cache
  `foot_46.03390_11.07360_46.10030_11.16920`, con le indicazioni di
  `directions.guidance`).
- Sul campo: lo stesso giro in città, dopo la pubblicazione su `preview`.

## File toccati

```
apps/mobile/src/navigation/simplifyDirections.ts            (nuovo)
apps/mobile/src/navigation/simplifyDirections.test.ts       (nuovo)
apps/mobile/src/navigation/simplifyDirectionsRun.test.ts    (nuovo)
apps/mobile/src/navigation/fixtures/trento-fiere-crossings.json (nuovo)
apps/mobile/src/navigation/useNavigation.ts
docs/tasks/TASK-302.md                                      (nuovo)
docs/DECISIONS.md
docs/STATUS.md
```

## Fuori scope

- Il motore (`directions.py`) e l'API: le indicazioni restano quelle,
  piatte, con `joined` (ADR-0047).
- Un'impostazione per l'utente sulla soglia: è una costante del codice.
- Il rientro dopo una deviazione (TASK-303) e l'attività persa uscendo
  dall'app (TASK-304).
- Le indicazioni attorno al punto in cui si aggancia una forma chiusa
  (TASK-273, `startTurn` di `startAnywhere.ts`): la svolta all'inizio del
  giro si aggiunge dopo la semplificazione, come prima.

## Esito

L'app dice una volta sola le svolte di un incrocio attraversato a piedi,
con la direzione che si vede sul posto, e tace le micro-deviazioni; su
una camminata vera di Trento le indicazioni passano da 30 a 13. Nessun
testo nuovo, motore e API invariati. Da provare sul campo dopo la
pubblicazione su `preview`.
