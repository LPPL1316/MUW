# TASK-273 — Una forma chiusa si comincia da qualunque punto

**Stato**: In corso
**Fase**: 4 · **Branch**: `feat/TASK-273-start-anywhere`

## Obiettivo

Lungo una forma chiusa (cuore, cerchio, stella…: il percorso finisce dove
comincia) il corridore preme «Start» dove vuole: la corsa comincia nel punto
della forma dove la raggiunge, fa tutto il giro e finisce quando torna lì,
con le svolte dette da quel punto. Parole e forme aperte partono dalla loro
partenza come oggi.

## Contesto

Dalla prima recensione di un tester (2026-10-10): al secondo tentativo ha
cominciato il cuore da un'altra parte («ho iniziato da una parte diversa …
non ci ho fatto, funziona un po' a tentoni»). Oggi il navigatore
(`navigator.ts`, ADR-0052) aspetta il corridore al primo metro: `locate`
(`progress.ts`) guarda solo da 50 m dietro a 300 m avanti all'ultimo punto,
e chi entra a metà forma resta «fuori percorso». TASK-270 cerca su tutto il
percorso avanti, ma solo dopo un'assenza del GPS e solo per chi era già sul
percorso: apposta non per chi va verso la partenza, perché una forma può
ripassare vicino alla partenza molto dopo (aggiunta ad ADR-0052).

**Scelta dell'utente** (2026-10-10, chiesta in chat con le opzioni, da non
richiedere): «Automatico, dove la tocchi». Si preme «Start» dove si vuole;
la corsa comincia dove si raggiunge la forma, fa tutto il giro e finisce
quando si torna lì. La voce dà le svolte da quel punto. Solo per le forme
chiuse; parole e forme aperte partono dalla loro partenza come oggi.

**Condizioni del Coordinatore** (sessione `local_e57a8224`, 2026-10-10):

- Si parte solo dopo «486 in main» (PR #486, TASK-270): il branch nasce da
  `origin/main` con la #486 dentro (`066d10e8`).
- Tocca `navigator.ts`, `progress.ts` e `useNavigation.ts`, come TASK-272
  (riaprire una corsa interrotta). Chi entra secondo fa il rebase; l'ordine
  lo dà il Coordinatore quando sono pronti tutti e due.
- Testi nuovi visibili solo col sì dell'utente (mostrati in en/it/de/es/fr
  prima del merge); meglio nessuno.
- Non nella 1.0 per Apple (build 5): esce con un aggiornamento. Solo app;
  pubblica il Coordinatore.
- A verde «#NNN pronta» al Coordinatore; merge solo al suo «merge NNN»
  esplicito, con `--match-head-commit`.

**Ordine del Coordinatore** (2026-10-11, sulla PR #493): prima la #492
(TASK-272), poi la #493. Tutte e due ferme finché non si taglia la build 6
per Apple (TASK-275): niente altro in quella build. Dopo il suo «merge
492», e con la #492 in `main`: riallineare la #493 su `main` e collegare la
ripresa di TASK-272 a questa scelta (chi ricostruisce la navigazione passa
`startsAnywhere(points, {word, walks})` a `startNavigation`), con un test;
poi «#493 pronta» e merge solo al suo «merge 493». Intanto la #493 resta
verde.

**Dopo il «merge 492», anche** (Coordinatore, 2026-10-11): la #492 riapre
una corsa con `reopenedRoute` in `App.tsx`, che passa `word` solo quando ci
sono le `walks`; una parola senza camminate riaperta perderebbe la parola e
partirebbe «dovunque». Nella #493: `word: run.word ?? null` sempre in
`reopenedRoute` (le `walks` solo quando ci sono), più il test della ripresa
(una forma chiusa riaperta rientra nello stesso punto; una parola senza
camminate riaperta non diventa forma chiusa). La #492 resta com'è.

## Contesto da leggere

- `docs/DECISIONS.md`: ADR-0052 e la sua aggiunta (TASK-270), ADR-0070
  (fuori percorso), ADR-0167 (la bici a mano)
- `apps/mobile/src/navigation/navigator.ts`, `progress.ts`, `resume.ts`,
  `onFootVoice.ts`, `useNavigation.ts`
- `services/route-engine/route_engine/directions.py` (le soglie delle
  svolte, da rifare uguali sul telefono per l'incrocio della partenza)

## Cosa fare

1. **Quando una forma è chiusa** (`startsAnywhere`, file nuovo
   `startAnywhere.ts`): l'ultimo punto entro `ARRIVE_M` (25 m) dal primo,
   nessuna parola (`word`), nessuna camminata a penna alzata. Vale anche in
   bici e sull'acqua.
2. **Prima della corsa**: per una forma chiusa «Head out on …» non si dice
   allo «Start» (non si sa ancora dove comincia); finché il corridore non è
   sulla forma, una posizione si cerca su **tutta** la forma, col punto più
   vicino. Lontano dalla forma vale «Off the route» come oggi per chi va
   verso la partenza.
3. **L'ingresso**: il corridore è sulla forma dopo `JOIN_FIXES` (3)
   posizioni di fila entro `OFF_ROUTE_M`, ognuna vicino alla precedente,
   che si sono spostate di almeno `JOIN_M` (20 m) lungo la forma. Una
   posizione storta vicino a un passaggio lontano non basta; nemmeno
   attraversare la forma di traverso. Una posizione povera (oltre 40 m
   d'errore) non conta né azzera. La serie parte su ogni passaggio vicino
   alla prima posizione (le vie ripassate, ADR-0039) e vince quello
   percorso nel verso del percorso. Il punto d'ingresso è la prima
   posizione della serie.
4. **Il giro dal punto d'ingresso**: il percorso del navigatore è la stessa
   forma ruotata, dal punto d'ingresso a sé stesso (`joinLoop`); le
   indicazioni seguono con le distanze nuove; all'incrocio della vecchia
   partenza, dove il motore non dice niente, la svolta si ricava dalla
   geometria (direzione d'arrivo e di partenza a 20 m, le soglie di
   `directions.py`), solo se è un incrocio (`branches` ≥ 3) e si gira o
   cambia via. Un ingresso entro 25 m dalla partenza è la partenza: il
   percorso resta com'è.
5. **All'ingresso** si dice «Head out on …» con la via del punto
   d'ingresso (testo che c'è già), preceduto da «Back on the route» se si
   era detto «Off the route»; poi le svolte come sempre. L'arrivo
   (`ARRIVE_M`, `ARRIVE_FIXES`) è al punto d'ingresso.
6. **Mappa**: la parte corsa e quella che resta (TASK-224) si tagliano sulla
   linea del navigatore, così la linea gialla parte dal punto d'ingresso e
   la forma resta intera.
7. **Bici a mano** (TASK-206): i tratti si ruotano con il percorso; un
   tratto a cavallo del punto d'ingresso si divide in due
   (`joinOnFoot.ts`, file nuovo); prima dell'ingresso non si dicono.
8. **Corsa ripresa** (`resume.ts`, TASK-253): la corsa riparte passando le
   posizioni registrate nel navigatore, che rientra nello stesso punto;
   nessun campo nuovo in `SavedRun`. Per TASK-272: chi ricostruisce la
   navigazione deve passare a `startNavigation` la stessa scelta
   (`startsAnywhere`).
9. Test deterministici; prova nel simulatore iOS con una corsa simulata.

## Criteri di accettazione

- [x] Entrare a metà di un giro: le svolte da lì, compresa quella alla
      vecchia partenza, e l'arrivo al punto d'ingresso (test).
- [x] Una posizione storta vicino a un passaggio lontano, e attraversare
      la forma di traverso, non scelgono l'ingresso (test).
- [x] Su una via che la forma percorre due volte vince il passaggio
      percorso nel verso del percorso (test).
- [x] Forme aperte e parole come prima: «Head out on …» allo «Start», la
      partenza al primo metro (test).
- [x] Partire dalla partenza di una forma chiusa: le svolte come prima,
      «Head out on …» all'ingresso (test).
- [x] La parte corsa sulla mappa parte dal punto d'ingresso (test).
- [x] I tratti con la bici a mano dopo l'ingresso si dicono (test).
- [x] Una corsa ripresa rientra nello stesso punto (test, anche con il
      file della corsa vero in `useNavigation.test.ts`).
- [x] Nessun testo nuovo.
- [x] Corsa simulata nel simulatore iOS, entrando a metà di una forma.
- [ ] `npm run lint`, `typecheck`, `test`, `format:check` verdi (CI;
      in locale verdi).

## File toccati

```
apps/mobile/src/navigation/startAnywhere.ts            (nuovo)
apps/mobile/src/navigation/startAnywhere.test.ts       (nuovo)
apps/mobile/src/navigation/joinOnFoot.ts               (nuovo)
apps/mobile/src/navigation/navigator.ts
apps/mobile/src/navigation/progress.ts
apps/mobile/src/navigation/useNavigation.ts
apps/mobile/src/navigation/useNavigation.test.ts
apps/mobile/src/navigation/resume.ts
apps/mobile/src/map/MapView.tsx
apps/mobile/src/map/MapView.test.tsx
apps/mobile/__tests__/AppExploreStart.test.tsx        («Head out» della stella d'esempio, chiusa: ora all'ingresso)
apps/mobile/App.tsx                                   (dopo la #492: `word` sempre in `reopenedRoute`)
apps/mobile/__tests__/AppReopenRun.test.tsx           (dopo la #492: il test della ripresa)
docs/tasks/TASK-273.md
docs/STATUS.md, docs/DECISIONS.md                     (le righe di questo task)
```

## Fuori scope

- Correre la forma al contrario: la direzione resta quella del percorso
  (in bici i sensi unici e i tratti a mano valgono in un verso solo).
  Sarebbe una scelta di prodotto.
- Spostare il segnaposto della partenza sulla mappa al punto d'ingresso.
- Le parole e le forme aperte.
- La svolta indietro a un vicolo cieco (TASK-271, motore).
- Riaprire una corsa interrotta in pausa (TASK-272).

## Esito

*(in corso: si completa dopo il merge)*

**Prova nel simulatore** (2026-10-10, iPhone 17e con Expo Go, l'API del
worktree sulla cache delle mappe del Mac): un cuore vero di 3,9 km a Trento
(79 indicazioni), la posizione simulata da `simctl location start` a partire
da 2,8 km, l'app sulla schermata della corsa con un'impalcatura temporanea
(tolta). Allo «Start» nessuna frase; dopo una ventina di metri «Head out on
Largo Giosuè Carducci / Via Oriola» e «In 30 metres, turn right onto Piazza
Cesare Battisti / Via del Simonino»; la linea gialla parte dal punto
d'ingresso, «3.9 km to go». Alla vecchia partenza la voce ha detto «turn
left onto Via Giuseppe Verdi», poi la svolta ricavata sul telefono («make a
U-turn onto Via Giuseppe Verdi»: il percorso va per 33 m fino al punto di
partenza disegnato e torna), poi «turn right onto Vicolo Terlago»; nessun
«Off the route», nessun arrivo lì. Alla fine «In 50 metres, turn right onto
Largo Giosuè Carducci / Via Oriola» e «You have arrived.» al punto
d'ingresso, con tutta la forma gialla. La riproduzione della posizione del
simulatore si è fermata più volte (Mac in pausa): ripresa per gli ultimi
600 m.
