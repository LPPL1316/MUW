# TASK-401 — Le indicazioni a schermo bloccato: la notifica subito, la Live Activity nella 1.0.2

**Stato**: Todo · proposta (parte 0) in PR; nessun codice prima delle scelte
dell'utente e del via del Coordinatore sulla lista dei file
**Fase**: 5 · **Branch**: `docs/TASK-401-lock-screen-directions` (documenti);
il codice `feat/TASK-401-a-…`, `feat/TASK-401-b-…`
**ADR**: ADR-0335 (proposto) · numeri dal Coordinatore il 2026-11-05

## Obiettivo

Con l'iPhone bloccato, durante una corsa con un percorso, chi corre **vede**
la prossima indicazione senza sbloccare: la freccia, «Turn right» o «Turn
left», i metri che mancano e la percentuale del disegno fatta. Oggi la sente
soltanto (la voce, ADR-0225).

Richiesta dell'utente del 2026-11-05: «Dai le indicazioni del percorso
anche da iPhone bloccato con una notifica esterna, quella percentuale svolta
a destra, sinistra, eccetera». Alla domanda «Come vuoi le indicazioni a
schermo bloccato?» ha scelto **«Live Activity, poi anche OTA»**: subito, con
un OTA, una notifica che si sostituisce a ogni svolta; nella build 1.0.2 la
Live Activity vera (il riquadro fisso sul lock screen e nella Dynamic
Island), contro «Solo Live Activity (1.0.2)» e «Solo notifica via OTA».

## Contesto da leggere

- `DECISIONS.md` ADR-0335 (questo task), ADR-0225 e la sua aggiunta (la corsa
  a schermo bloccato, iOS e Android), ADR-0045 (le svolte dal grafo),
  ADR-0314 (TASK-370, l'Apple Watch: la stessa dipendenza nativa)
- `apps/mobile/src/navigation/runPosition.ts` (il task di posizione che gira
  a schermo bloccato), `navigator.ts` (`onFix`, `upcoming`, `remainingM`),
  `screens/NavigateScreen.tsx` (`doneOf`, «{percent}% drawn»)
- `apps/mobile/src/gym/restAlert.ts`: la notifica locale di fine recupero
  (TASK-385 B), lo stesso schema per il permesso e per toglierla

## Com'è oggi (main `0ffada6b`)

1. **A schermo bloccato la corsa va avanti**: su iOS le posizioni arrivano al
   task `muw-run-location` di expo-task-manager (TASK-261), che chiama lo
   stesso `onFix` della schermata; la voce dice le svolte a 50 m
   (`ANNOUNCE_M`, più lontano in bici) e vibra. iOS mostra la barra blu.
2. **Sul lock screen non c'è niente di MuW**: nessuna notifica durante la
   corsa, nessuna Live Activity. Su Android c'è solo la notifica fissa del
   servizio, «MuW is recording your activity», che non cambia.
3. **I dati ci sono già tutti nel JavaScript**: la prossima svolta
   (`upcoming`, con il frasario di `phrases.ts`), i metri che mancano, la
   percentuale (`doneOf`, mostrata come «{percent}% drawn»), il fuori rotta e
   il rientro (TASK-303).
4. **`expo-notifications` è già nella build** (1.0.1, impronta iOS
   `6f8bba4c`): la usa `restAlert.ts` per le notifiche locali. Una notifica
   nuova è solo JavaScript: arriva con un OTA.
5. **Nessun codice nativo per i widget**: non esistono `apps/mobile/targets/`
   né un modulo per ActivityKit; `app.json` non ha `NSSupportsLiveActivities`.

## Come è fatta (proposta)

### Il principio

Quello che si vede a schermo bloccato è **la stessa indicazione che dice la
voce**, nello stesso momento, calcolata dallo stesso `onFix`: nessuna
seconda logica di guida. Il lock screen è un'altra uscita del navigatore,
come la voce e la vibrazione.

### A — La notifica (OTA, solo JavaScript)

- Un modulo nuovo `navigation/lockNotice.ts` con un'interfaccia
  sostituibile nei test, come `RestNotifier`.
- **Quando**: solo con l'app dietro o il telefono bloccato (`AppState` non
  `active`), e solo durante una corsa con un percorso. Una notifica quando la
  voce annuncia una svolta; una quando si esce di rotta («Off the route») e
  una quando si rientra. A fine corsa, e quando l'app torna davanti, si
  toglie.
- **Una sola alla volta**: sempre lo stesso identificativo, così iOS
  sostituisce quella di prima invece di accumularle.
- **Senza suono**: parla già la voce; la notifica si vede e basta (su
  Android un canale suo «Directions», importanza bassa).
- **Cosa dice** (testi da approvare): titolo con la freccia e la svolta,
  «↱ Turn right in 50 m»; sotto il nome della via, se c'è, e
  «42% drawn».
- **Il permesso** è quello delle notifiche push, chiesto come per il
  recupero della palestra; rifiutato, resta la voce come oggi.
- Limite: una notifica non si aggiorna da sola metro per metro; mostra i
  metri del momento dell'annuncio. Il conto alla rovescia è della parte B.

### B — La Live Activity (build 1.0.2, nativo)

- **Il riquadro sul lock screen**: freccia grande, metri alla svolta,
  «Turn right», la via, una barra con la percentuale e i km che mancano.
  **Nella Dynamic Island** (iPhone 14 Pro e più nuovi): compatta, freccia a
  sinistra e metri a destra; espansa, come il riquadro. Dagli iPhone
  senza isola si vede solo sul lock screen. Su un Apple Watch con watchOS 11
  la stessa Live Activity compare da sola nello Smart Stack.
- **Si aggiorna dal telefono**, non da un server: il task di posizione
  chiama `update` quando cambia qualcosa che si vede (i metri arrotondati a
  10, la percentuale intera, la svolta, il fuori rotta), al massimo una volta
  al secondo. Nessuna push di ActivityKit, nessun server toccato.
- **Parte** con «Start» della corsa e **finisce** a fine corsa (resta
  qualche minuto col riepilogo, da decidere), o si chiude da sola se l'app
  viene chiusa a mano.
- **Con la Live Activity attiva, la notifica della parte A non si manda**:
  una cosa sola sul lock screen.
- **Il nativo**: un widget extension SwiftUI (`ActivityConfiguration`) in
  `apps/mobile/targets/live-activity/`, generato a ogni `prebuild` da
  `@bacons/apple-targets`; un modulo Expo locale piccolo
  (`apps/mobile/modules/live-activity/`, Swift + `ActivityKit`) con tre
  funzioni, `start`, `update`, `end`; `NSSupportsLiveActivities` in
  `app.json`. ActivityKit chiede iOS 16.1 (il minimo di SDK 57 è da
  verificare).
- **L'impronta iOS cambia**: arriva solo con una build per l'App Store. Il
  codice JavaScript che la chiama controlla che il modulo ci sia, così un
  OTA con la parte B non rompe chi ha la 1.0.1: lì resta la notifica.

### La dipendenza nativa, con TASK-370

`@bacons/apple-targets` è la stessa dipendenza che TASK-370 (l'app per Apple
Watch, sessione «Apple Watch app status») porta nella build 1.1, con il sì
dell'utente del 2026-10-30 dato per TASK-323 E. Se la Live Activity va
nella 1.0.2, **la dipendenza arriva prima** e la aggiunge **TASK-401 B**:
`package.json`, il plugin in `app.json`, la cartella `apps/mobile/targets/`
con la sola sottocartella `live-activity/`. TASK-370 A2 la trova già lì e
aggiunge `targets/watch/` accanto, senza toccare quella della Live Activity.
Versione e posto del plugin si concordano con la sessione di TASK-370
prima di scrivere codice; la lista dei file va al Coordinatore.

La 1.0.2 è già condivisa (video nei messaggi 333 E; testo della chiave di
Salute 374 C, 345 C, 397 C; accesso con Apple e Google 322): l'ordine lo
tiene il Coordinatore con l'utente.

### Le scelte ancora aperte (una alla volta, all'utente)

1. ~~Notifica, Live Activity o tutte e due~~ → tutte e due (2026-11-05).
2. **Parte A, i testi** della notifica (svolta, fuori rotta, rientro) in
   cinque lingue.
3. **Parte B, cosa mostra** il riquadro e l'isola compatta; e senza percorso
   («Run without a route»): niente Live Activity, o tempo, distanza e passo.
4. **Parte B, la fine**: il riquadro sparisce a fine corsa o resta qualche
   minuto col riepilogo.
5. **La dipendenza** `@bacons/apple-targets` nella 1.0.2 (sì dell'utente e
   via del Coordinatore), e il modulo locale in Swift.

## Cosa fare

**Parte 0 (questa PR)**: questo file, ADR-0335 «Proposto», le righe in
`STATUS.md`.

**Parte A** (dopo la scelta 2):
1. `navigation/lockNotice.ts` + test: quando parte, cosa dice, che si
   sostituisce, che si toglie a fine corsa e con l'app davanti, che col
   permesso rifiutato non fa niente.
2. Il collegamento in `NavigateScreen.tsx` dove la voce dice la svolta.
3. I testi in `locales/*.json`.
4. Prova nel simulatore a schermo bloccato con la corsa simulata.

**Parte B** (dopo le scelte 3–5, nella 1.0.2):
1. `@bacons/apple-targets`, `targets/live-activity/` (SwiftUI), il modulo
   locale, `NSSupportsLiveActivities`.
2. `navigation/liveActivity.ts` + test (quando parte, quando si aggiorna,
   il limite di una volta al secondo, il ritorno alla notifica senza il
   modulo).
3. Prova nel simulatore (lock screen e Dynamic Island) e sull'iPhone con la
   build di prova.

## Criteri di accettazione

**Parte A**
- [ ] Con il telefono bloccato e una corsa con percorso, a ogni svolta
      annunciata dalla voce c'è una notifica con freccia, svolta, metri e
      percentuale, e una sola alla volta.
- [ ] La notifica non suona; a fine corsa e con l'app davanti sparisce.
- [ ] Col permesso delle notifiche rifiutato la corsa va come oggi.
- [ ] L'impronta iOS di `main` non cambia (OTA).
- [ ] Test deterministici verdi.

**Parte B**
- [ ] Sul lock screen e nella Dynamic Island la Live Activity mostra la
      prossima svolta con i metri che scendono e la percentuale, e finisce
      con la corsa.
- [ ] Con la Live Activity attiva la notifica della parte A non parte.
- [ ] Su una build senza il modulo (1.0.1) un OTA con la parte B dà la
      notifica della parte A, senza errori.
- [ ] Test deterministici verdi; la build 1.0.2 si costruisce con
      `targets/live-activity/`.

## File toccati

Parte 0:

```
docs/tasks/TASK-401.md
docs/DECISIONS.md
docs/STATUS.md
```

Parte A (previsti):

```
apps/mobile/src/navigation/lockNotice.ts          (nuovo)
apps/mobile/src/navigation/lockNotice.test.ts     (nuovo)
apps/mobile/src/screens/NavigateScreen.tsx
apps/mobile/locales/{en,it,de,fr,es}.json
```

Parte B (previsti, con il via del Coordinatore):

```
apps/mobile/package.json, package-lock.json
apps/mobile/app.json
apps/mobile/targets/live-activity/**              (nuovo)
apps/mobile/modules/live-activity/**              (nuovo)
apps/mobile/src/navigation/liveActivity.ts        (nuovo)
apps/mobile/src/navigation/liveActivity.test.ts   (nuovo)
apps/mobile/src/screens/NavigateScreen.tsx
apps/mobile/fingerprint.config.js (se serve)
```

## Fuori scope

- Le indicazioni sull'Apple Watch: sono di TASK-370.
- Push di ActivityKit dal server (aggiornare la Live Activity con l'app
  chiusa): la corsa tiene l'app viva, non serve.
- Cambiare la notifica fissa del servizio su Android: la parte A manda la
  sua, accanto.
- Le Live Activity per altro (gruppi, contest, recupero della palestra).
- Toccare la logica delle svolte (`navigator.ts`, `phrases.ts`).

## Esito

*(si compila a fine task)*
