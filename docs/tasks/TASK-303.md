# TASK-303 — Dopo una deviazione la corsa rientra più avanti, con la guida per tornarci

**Stato**: In corso
**Fase**: 4 · **Branch**: `feat/TASK-303-detour-rejoin`
**ADR**: ADR-0263 · **Solo app**, testi nuovi in 5 lingue (da approvare
dall'utente prima del merge), nessuna dipendenza, l'impronta iOS non cambia

## Obiettivo

Chi esce dal percorso per una strada chiusa e ci rientra più avanti viene
ritrovato dove rientra, sente «Di nuovo sul percorso» e riprende le
indicazioni da lì. Mentre è fuori, la mappa, il banner e la voce gli dicono
dove riprende il percorso.

## Contesto

Prova sul campo dell'utente a Trento, 2026-10-25 (secondo dei tre problemi
riportati; gli altri sono TASK-302, le svolte ravvicinate, e TASK-304,
l'attività persa uscendo dall'app). Un passaggio vicino a Trento Fiere era
chiuso: l'utente ha fatto il giro dell'isolato ed è rientrato sul percorso
più avanti, ma la corsa è rimasta «fuori percorso» per sempre e ha dovuto
fermarla e ripartire.

Perché: una volta fuori, `locate` (`progress.ts`) cerca il runner solo da
`BACK_M` = 50 m dietro ad `AHEAD_M` = 300 m avanti rispetto a dove era
uscito. Su tutto il percorso avanti cerca solo dopo un buco di 20 s senza
GPS (`GAP_MS`, `foundAhead` in `navigator.ts`, TASK-270). E nessuna guida:
il banner diceva «Head back to the yellow line.», la voce «Sei fuori
percorso. Torna sul percorso.».

Piano approvato dall'utente in chat il 2026-10-25 («Ok, procedi con i tre
piani»); numero e ADR dal Coordinatore, che entra dopo TASK-302 (#557) e
prima di TASK-304 (condividono `useNavigation.ts` e `NavigateScreen.tsx`).

## Contesto da leggere

- `docs/DECISIONS.md`: ADR-0052 (navigazione) con le aggiunte di TASK-270,
  ADR-0070 (fuori percorso dopo più posizioni), ADR-0241 (TASK-273, il
  rientro su una forma chiusa con `JOIN_M`), ADR-0137 (la pausa)
- `docs/UI.md`, la navigazione e le frasi della voce
- `apps/mobile/src/navigation/navigator.ts`, `progress.ts`

## Cosa fare

1. **Rientro più avanti** (`navigator.ts`): quando la corsa è già fuori
   percorso (`offRoute`) e il runner era stato messo sul percorso prima, una
   posizione lontana da dove è uscito si cerca su tutto il percorso avanti,
   come dopo un buco (`foundAhead`). Il rientro conta dopo almeno
   `BACK_FIXES` posizioni di fila, ognuna vicina alla precedente, che vanno
   nel verso del percorso per almeno `JOIN_M` = 20 m (come TASK-273):
   passare sopra la forma più avanti, di traverso, non è rientrare. Poi «Di
   nuovo sul percorso» e le svolte rimaste indietro si saltano. Vicino a
   dove è uscito (la finestra di `locate`) tutto resta com'è.
2. **Il punto di rientro** (`rejoin.ts`, nuovo): il punto del percorso, più
   avanti di dove il runner è uscito, più vicino a lui in linea d'aria;
   ricalcolato a ogni posizione mentre è fuori, con la distanza e la
   direzione. Prima di essere mai stato sul percorso, il punto più vicino
   dove `locate` lo prenderebbe (i primi `AHEAD_M`); su una forma chiusa non
   ancora agganciata, il più vicino di tutta la forma. Niente calcolo di
   strade: sarebbe un seguito, col motore. Il navigatore lo tiene in
   `Navigation.rejoin`, così schermo e mappa lo leggono senza toccare
   `App.tsx` né `useNavigation.ts`.
3. **La guida**:
   - sulla mappa una linea a puntini dal runner al punto di rientro
     (`messages.ts`, `mapPage.ts`, `MapView.tsx`);
   - nel banner («Off the route») la distanza e il punto cardinale
     (`compassPoint`), e «Follow the dotted line back to the route.»;
   - a voce, una volta quando si esce, dopo «Sei fuori percorso. Torna sul
     percorso.»: «Il percorso riprende a 120 metri verso nord-est.».
4. **Distanza e tempo** della deviazione si sommano già alla corsa: la
   registrazione (`trackRecorder.ts`) non guarda il percorso. Un test lo
   fissa. La pausa resta com'è (ADR-0137).
5. **Testi nuovi** in en, it, es, fr, de (solo righe in fondo ai file),
   proposti all'utente: senza il suo sì la PR non entra.

## Criteri di accettazione

- [ ] Un percorso finto: si esce a 300 m, si fa il giro dell'isolato e si
      rientra a 700 m. La corsa dice «fuori» una volta, con il punto di
      rientro; mentre gira il punto si sposta con lui; rientrata dice «Di
      nuovo sul percorso» a circa 700 m e non dice le svolte di mezzo; la
      svolta dopo si annuncia come sempre.
- [ ] Lo stesso giro che attraversa il percorso di traverso a 700 m e
      prosegue dall'altra parte resta fuori percorso.
- [ ] La distanza della traccia è il cammino fatto, deviazione compresa.
- [ ] Senza la modifica il primo test fallisce (la corsa resta fuori).
- [ ] Chi non è mai stato sul percorso (va verso la partenza) non viene
      preso più avanti, come prima.
- [ ] Banner e mappa mostrano distanza, punto cardinale e linea a puntini
      mentre si è fuori, e niente dopo il rientro.
- [ ] I testi nuovi in 5 lingue, approvati dall'utente.
- [ ] Una corsa simulata nel simulatore iOS sulla deviazione
      (`xcrun simctl location … start`).
- [ ] Tutta la suite dell'app verde, lint, typecheck e prettier; impronta
      iOS `83793e26…` invariata su una copia pulita con `npm ci`.

## File toccati

```
apps/mobile/src/navigation/rejoin.ts                 (nuovo)
apps/mobile/src/navigation/rejoin.test.ts            (nuovo)
apps/mobile/src/navigation/detourRun.test.ts         (nuovo)
apps/mobile/src/navigation/navigator.ts
apps/mobile/src/navigation/navigator.test.ts         (la voce fuori percorso attesa)
apps/mobile/src/navigation/startAnywhere.test.ts     (la voce fuori percorso attesa)
apps/mobile/src/voice/phrasebook.ts
apps/mobile/src/voice/en.ts                          (righe in fondo)
apps/mobile/src/voice/it.ts                          (righe in fondo)
apps/mobile/src/voice/es.ts                          (righe in fondo)
apps/mobile/src/voice/fr.ts                          (righe in fondo)
apps/mobile/src/voice/de.ts                          (righe in fondo)
apps/mobile/src/voice/rejoinWords.test.ts            (nuovo)
apps/mobile/src/i18n/it.ts                           (righe in fondo)
apps/mobile/src/i18n/es.ts                           (righe in fondo)
apps/mobile/src/i18n/fr.ts                           (righe in fondo)
apps/mobile/src/i18n/de.ts                           (righe in fondo)
apps/mobile/src/screens/NavigateScreen.tsx
apps/mobile/src/screens/NavigateRejoin.test.tsx      (nuovo)
apps/mobile/src/map/messages.ts
apps/mobile/src/map/mapPage.ts
apps/mobile/src/map/MapView.tsx
apps/mobile/src/map/mapPageRejoin.test.ts            (nuovo)
apps/mobile/src/map/MapViewRejoin.test.tsx           (nuovo)
docs/tasks/TASK-303.md                               (nuovo)
docs/DECISIONS.md
docs/STATUS.md
docs/UI.md
```

## Fuori scope

- Il giro calcolato sulle strade fino al punto di rientro (il motore):
  qui è in linea d'aria.
- Cambiare la pausa (ADR-0137) o i pulsanti di «RunDashboard.tsx»
  (TASK-296 E lo tocca, coordinato dal Coordinatore).
- `useNavigation.ts` e `App.tsx`: il punto di rientro passa dentro
  `Navigation`.
- La ricerca dopo un buco di GPS (TASK-270): resta com'è, senza il verso.
- L'attività persa uscendo dall'app (TASK-304).

## Esito

*(a fine task)*
