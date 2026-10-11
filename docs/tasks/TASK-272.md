# TASK-272 — La corsa interrotta si riapre in pausa

**Stato**: Done
**Fase**: 4 · **Branch**: `feat/TASK-272-reopen-interrupted-run`
**ADR**: ADR-0240 (numeri dati dal Coordinatore, sessione local_e57a8224,
il 2026-10-10)

## Obiettivo

Quando l'app si è chiusa durante una corsa (chiusa a mano o fermata da
iOS), riaprendo MuW si riapre quella corsa **in pausa**: la schermata della
corsa sullo stesso percorso, con la traccia corsa fin lì, «Resume» per
andare avanti e «Stop» tenuto premuto per chiuderla e salvarla come sempre.
Il tempo con l'app chiusa è una pausa.

## Origine

La prima recensione di un tester (2026-10-10): a metà corsa è uscito
dall'app, tornato ha dovuto chiuderla e riaprirla, «ma era scomparsa»; ha
calcolato un altro percorso e le due metà non combaciavano; «bisogna capire
come salvare le attività interrotte». Scelta dell'utente del 2026-10-10,
chiesta in chat con le opzioni: **«Riapre la corsa in pausa»** (non va
richiesta di nuovo). Gli altri due problemi della recensione sono TASK-270
(il navigatore dopo un'assenza del GPS, #486 in `main`) e TASK-271.

## Contesto da leggere

- `docs/UI.md` «La corsa: due pagine, il conto alla rovescia, la pausa»,
  «La traccia della corsa», «La fine della corsa», «Correre senza percorso»
- `docs/DECISIONS.md` ADR-0091 (il file della corsa), ADR-0137 (pausa),
  ADR-0217 (TASK-253, la navigazione che riparte), ADR-0219 (TASK-255)
- `apps/mobile/src/navigation/trackStore.ts`, `resume.ts`,
  `runControl.ts`, `useNavigation.ts`, `useFreeRun.ts`; `App.tsx`

## Cosa c'era già

- `trackStore.ts` tiene la corsa in `current-run.json` (scritto al più ogni
  15 s; `status: "running"` vuol dire che l'app si è chiusa durante la
  corsa). `resumable()` continua una corsa solo se si riparte lo **stesso
  percorso** entro 30 minuti (`RESUME_WITHIN_MS`), e subito in corsa.
- `resume.ts` (`resumeFollowing`, TASK-253) porta navigatore, penna e bici a
  mano in silenzio lungo le posizioni registrate.
- All'apertura l'app mostrava la **fine della corsa** («Your run») di una
  corsa lasciata nel file, senza «Keep running» lungo un percorso (il
  percorso non c'era più in memoria).
- Mancava: il file teneva percorso, somiglianza, `walks`, attività,
  rotazione e traccia, ma **non le indicazioni, la parola, i tratti a
  piedi**: la navigazione non si poteva ricostruire dal file.

## Cosa fare

1. Il file della corsa tiene anche `directions`, `word` e `on_foot` del
   percorso (campi facoltativi, scritti solo quando il percorso li ha: il
   file di ogni altra corsa è come prima; i file vecchi restano validi).
2. Una corsa che il file dà `running`, sullo stesso percorso, riparte **in
   pausa**: il tempo dall'ultima posizione è una pausa di chi corre, aperta,
   che «Resume» chiude. I controlli (`runControl`) partono in pausa quando la
   traccia ha una pausa aperta.
3. All'apertura dell'app (`App.tsx`) una corsa interrotta da poco apre la
   schermata della corsa, in pausa: lungo il percorso del file con le sue
   indicazioni, o senza percorso. Più vecchia, la fine della corsa come
   prima.
4. Decidere e scrivere in ADR-0240: il limite di età, cosa succede a un file
   più vecchio, le corse senza percorso.
5. Test deterministici del formato del file, del riconoscimento
   all'apertura e della riapertura in pausa; prova nel simulatore iOS.

## Criteri di accettazione

- [x] Un file scritto da una corsa lungo un percorso con indicazioni,
      parola e tratti a piedi li rilegge uguali; un file senza questi campi
      si legge come prima; campi sbagliati rendono il file «nessuna corsa»,
      come per gli altri campi.
- [x] All'apertura, con nel file una corsa `running` con almeno due
      posizioni e l'ultima da meno di `REOPEN_WITHIN_MS`, l'app apre la
      corsa in pausa: «Paused», «Resume», «Stop» da tenere, i numeri della
      traccia, il percorso sulla mappa; nessun conto alla rovescia, nessun
      «Head out on …».
- [x] «Resume» chiude la pausa in quel momento: il tempo con l'app chiusa
      (e in pausa) non conta nella durata, la prima posizione dopo non si
      unisce alla linea di prima; la navigazione prosegue dalla posizione
      nuova anche più avanti sul percorso (TASK-270).
- [x] «Stop» tenuto apre «Your run» con «Keep running», «Save»/«Discard» o
      «Done» come sempre; dopo, si torna alla prima schermata.
- [x] Una corsa interrotta più vecchia del limite apre la fine della corsa
      come prima; una corsa fermata con «Stop» o arrivata non si riapre.
- [x] Una corsa senza percorso interrotta si riapre allo stesso modo, in
      pausa sulla sua schermata.
- [x] Nessun testo nuovo nell'interfaccia (si riusano «Paused», «Resume»,
      «Stop»).
- [x] `npm run lint`, `typecheck`, `test`, `format:check` verdi; provato nel
      simulatore iOS.

## File toccati

```
apps/mobile/App.tsx
apps/mobile/src/navigation/trackRecorder.ts
apps/mobile/src/navigation/trackStore.ts
apps/mobile/src/navigation/runControl.ts
apps/mobile/src/navigation/useNavigation.ts
apps/mobile/src/navigation/reopenRun.test.ts        (nuovo)
apps/mobile/__tests__/AppReopenRun.test.tsx         (nuovo)
apps/mobile/__tests__/AppFreeRun.test.tsx
docs/UI.md
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-272.md                              (nuovo)
```

## Fuori scope

- `navigator.ts` e `progress.ts` (TASK-270, TASK-273): la corsa riaperta
  usa il navigatore com'è in `main` dopo #486.
- Una riga che dica «la corsa era stata interrotta»: sarebbe un testo nuovo
  da far approvare in cinque lingue; si riusano quelli che ci sono.
- Salvare da sé una corsa interrotta, o mandarla all'API senza «Save».
- Il GPS in background e la voce a telefono bloccato (TASK-261).

## Verifica nel simulatore (2026-10-10)

Expo Go 57 su un simulatore proprio (iPhone 17, iOS 27), Metro dal
worktree, API locale solo per il percorso: un cuore di 3,9 km da Trento
(`POST /routes`) con le sue 79 indicazioni (`POST /route-directions`).
Nel file della corsa dell'app una corsa `running` a 1,2 km, l'ultima
posizione 4 minuti prima; poi l'app riaperta:

- si apre la corsa **in pausa**: il percorso sulla mappa con la parte
  corsa, «30% drawn», la svolta davanti nel banner, 1.20 km, «Time 6:00»
  (i 4 minuti chiusa non contano), «Paused», «Stop» e «Resume»;
- «Resume» (senza tocchi: un `setTimeout` provvisorio in `index.ts`, tolto)
  con il GPS simulato 600 m più avanti sul percorso: la corsa riparte,
  il navigatore ritrova chi corre più avanti («52% drawn», «1.9 km to go»),
  1.31 km e «Time 6:42»; nel file una pausa di 282 s dall'ultima posizione
  a «Resume», `gap: true` sulla prima posizione dopo, le 79 indicazioni.

«Stop» tenuto e «Your run» non provati nel simulatore (nessun tocco:
l'accesso al pannello non è stato dato); li coprono i test dell'app.

## Esito

Una corsa interrotta da meno di 2 ore si riapre in pausa all'apertura, lungo
il percorso del file o senza percorso; più vecchia, la sua fine come prima
(ADR-0240). PR #492, entrata dopo il taglio della build 6 su «merge 492»
del Coordinatore; il coordinatore la pubblica. Resta da provare su una
corsa vera (con l'app chiusa a metà). «Stop» tenuto non provato nel
simulatore (senza tocchi): lo coprono i test. TASK-273 (#493) collega la
ripresa alla sua scelta di partenza (`startsAnywhere`).
