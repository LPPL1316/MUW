# TASK-321 — L'attività finita anche in Apple Salute, perché compaia in Fitness

**Stato**: In lavorazione · proposta (documenti) nel branch `docs/TASK-321-apple-health` · poi A (app, nascosta), B (la build nativa 1.0.1), C (Android, Health Connect: rinviata)
**Fase**: 4 · **Branch**: `docs/TASK-321-apple-health` (documenti),
`feat/TASK-321-a-apple-health-app` (A), `chore/TASK-321-b-health-native-build`
(B), `feat/TASK-321-c-health-connect` (C)
**Dipende da**: TASK-172 («Save» a fine corsa), TASK-187 e TASK-293
(l'interruttore di Strava, il modello), TASK-169 (pause e calorie stimate),
TASK-262 C (la strada dell'esclusione dal linking), TASK-152 (la 1.0.1
nativa, promemoria)
**Si incrocia con**: TASK-312 D (leggere da Salute: la stessa libreria),
TASK-321 (Sign in with Apple: la stessa build nativa)
**ADR**: ADR-0281

## Obiettivo

Su iPhone, a fine attività, con «Save» la corsa, la pedalata o la pagaiata
va anche in Apple Salute: un allenamento con lo sport giusto, il tempo, la
distanza e il percorso. L'app Fitness lo mostra fra gli allenamenti, con la
mappa. Se l'utente dice sì, ci vanno anche le calorie attive stimate, che
muovono l'anello Movimento.

## Contesto

La domanda dell'utente, il 2026-10-28: l'attività finita si può
sincronizzare con l'app Fitness di Apple?

- **Oggi**: a fine corsa (`src/activities/RunEnd.tsx`) ci sono «Send to
  Strava» (TASK-187, ADR-0156: passa dall'API, con la coda
  `src/strava/stravaOutbox.ts`) ed «Export GPX» sul disegno (TASK-307). Nel
  codice non c'è HealthKit; nei documenti compare solo per il battito da
  Apple Watch (`tasks/TASK-169.md`, ADR-0137, «Battito e musica, fuori da
  qui»).
- **Fitness non ha un'API sua**: mostra gli allenamenti che ogni app scrive
  in Salute. Scrivere in Salute è comparire in Fitness.
- **Salute sta sul telefono**: a differenza di Strava, niente server, niente
  rete, niente migrazione. La corsa salvata ha già tutto quello che serve
  (`SavedRun.track`: posizioni con orario, precisione e quota; le pause; i
  metri; lo sport in `activity`).
- **Expo Go non ha HealthKit**, e la 1.0 sull'App Store nemmeno: serve una
  build nativa nuova, con la capability HealthKit, e una versione nuova
  sull'App Store (1.0.1). L'impronta iOS cambia: non arriva con un
  aggiornamento OTA.

## Che cosa si scrive in Salute

| Dato | Da MuW | In HealthKit |
|---|---|---|
| L'allenamento | la corsa salvata | `HKWorkout` |
| Lo sport | `activityOf(sport)` | `running` → `.running`, `cycling` → `.cycling`, `paddling` → `.paddleSports` (canoa, kayak, SUP) |
| La camminata | non è ancora uno sport di MuW | `.walking`, quando lo sarà |
| Inizio e fine | il primo e l'ultimo `track.fixes[].timeMs` | `startDate`, `endDate` |
| La distanza | `track.distanceM` | `totalDistance`, più un campione `distanceWalkingRunning`, `distanceCycling` o `distancePaddleSports` (questo da iOS 18) |
| Il percorso | `track.fixes`: posizione, orario, precisione, quota | `HKWorkoutRoute`, con `HKWorkoutRouteBuilder` |
| Le calorie attive (se sì) | `kcal()` di `navigation/runMetrics.ts` | un campione `activeEnergyBurned` legato all'allenamento |
| All'aperto | sempre | `HKMetadataKeyIndoorWorkout: false` |
| Una volta sola | la chiave della corsa (`activityKey`) | `HKMetadataKeySyncIdentifier` e `HKMetadataKeySyncVersion` |

- **Le pause** (`track.pauses`): con la libreria proposta l'allenamento si
  salva senza gli eventi di pausa. Fitness conta allora il tempo
  dall'inizio alla fine, pause comprese, e il suo passo medio è più lento
  di quello di MuW quando ci sono state pause. La distanza e il percorso
  sono gli stessi. È un limite scritto, non un errore: il tempo totale è
  vero. Toglierlo vuole un modulo nostro in Swift (alternativa nell'ADR).
- **Le calorie**: `kcal()` è la formula della corsa (1,036 kcal per kg e
  per km, 70 kg finché il profilo non ha il peso), che la schermata di
  corsa usa oggi per ogni sport. Per la bici e la pagaia non vale, e Apple
  vieta di scrivere in Salute dati falsi o inesatti (5.1.3). Proposta: le
  calorie solo per la corsa; per la bici e la pagaia niente, finché non c'è
  una stima per sport.
- **L'anello Movimento**: con l'Apple Watch al polso conta già la misura
  dell'orologio, e Salute non conta due volte le calorie dello stesso
  tempo (tiene la fonte prima nell'ordine delle fonti). Con il solo iPhone,
  le prove trovate in rete non concordano su quanto le calorie di un'altra
  app muovano l'anello: la parte B lo verifica sull'iPhone dell'utente. Gli
  anelli Esercizio e In piedi sono dell'Apple Watch: un'app non li scrive.

## Dove, nell'app (proposta da confermare)

- Sotto «Send to Strava», l'interruttore **«Save to Apple Health»**: solo su
  iPhone, e solo dove c'è il modulo nativo (nella 1.0 non si vede).
  Ricorda l'ultima scelta sul telefono, come Strava (un file
  `apple-health.json`, come `strava.json`).
- **La prima volta è spento**. Acceso, iOS mostra il suo foglio dei
  permessi, una volta sola. Con il permesso negato resta spento, e una riga
  dice dove darlo.
- **Con «Save»** l'allenamento va in Salute subito, sul telefono, anche
  senza rete. «Discard» non scrive niente. Senza account la fine corsa ha
  solo «Done» (TASK-172): niente Salute, come niente «My activities».
- Una corsa cancellata in «My activities», o l'account cancellato, **resta
  in Salute**: è dell'utente, sul suo telefono, e si cancella da Salute.
- **Le attività importate** (TASK-312) non vanno in Salute: vengono da app
  che di solito ce le hanno già scritte.

## La parte nativa

- **La libreria**: `@kingstinct/react-native-healthkit` 16.2.0 (MIT, del
  2026-10-12), con `react-native-nitro-modules` (0.37.1) e
  `@react-native-healthkit/core`, che arriva con lei. Salva l'allenamento
  (`saveWorkoutSample`, con i campioni e i totali) e il percorso
  (`WorkoutProxy.saveWorkoutRoute`, che usa `HKWorkoutRouteBuilder`). Legge
  anche, e servirà a TASK-312 D. Confronto nell'ADR: `react-native-health`
  (1.19.0, ottobre 2024) non salva il percorso e non aggiunge funzioni dal
  2023.
- **Niente config plugin della libreria**: il suo plugin aggiunge sempre
  il testo per **leggere** («MuW wants to read your health data», se non
  se ne dà uno) e il permesso delle consegne in background, che a MuW non
  servono. In `app.json` bastano `ios.entitlements`
  (`com.apple.developer.healthkit: true`, `…healthkit.access: []`) e
  `ios.infoPlist.NSHealthUpdateUsageDescription`, con le traduzioni in
  `locales/*.json`. `NSHealthShareUsageDescription` (leggere) entra solo
  se B la trova obbligatoria per scrivere, o con TASK-312 D.
- **La capability**: la build la lancia l'utente con il suo account Apple
  (`DEPLOY.md`, la build della 1.0); con le credenziali gestite da EAS, alla
  build EAS allinea le capability dell'App ID `com.lppl1316.sgrava` agli
  entitlements e rifà il profilo di distribuzione. Tocca l'account Apple
  Developer: con il sì dell'utente, nella parte B. Se EAS non lo fa, si
  accende HealthKit a mano in developer.apple.com, Identifiers. Lo stesso
  per il profilo `preview` (ad hoc), per provare sull'iPhone.
- **Prima della build (parte A)**: le due librerie stanno in
  `package.json` ma fuori dal linking (`react-native.config.js`,
  `platforms: { ios: null, android: null }`, come AdMob nella build dello
  store), l'app le carica con un `require` protetto e senza il modulo
  nasconde l'interruttore. Così il codice entra in `main`, si prova con un
  modulo finto nei test, e la 1.0 resta con l'impronta `83793e26…`. Da
  misurare su una copia pulita: se l'impronta si muove anche così, A aspetta
  nel suo branch la build di B.
- **Alla build (parte B)**: le librerie dentro il linking, gli entitlements
  e il testo del permesso in `app.json`, l'impronta nuova misurata. La 1.0.0
  (7) continua a ricevere gli aggiornamenti del suo runtime; la 1.0.1 ha il
  suo: ogni `eas update` dopo va fatto per tutti e due (`DEPLOY.md` A.7).
  Insieme agli altri promemoria della 1.0.1 (`tasks/TASK-152.md`: i
  contatti di TASK-262 C, il selettore di file di TASK-312 B, i moduli di
  TASK-321).

## La revisione di Apple

- **2.5.1**: HealthKit solo per salute e fitness, integrato con Salute, e
  detto nella descrizione dell'app. Una riga nella descrizione di App Store
  Connect, nelle cinque lingue (a mano, dell'utente): «Saves your
  activities to Apple Health».
- **5.1.2 e 5.1.3**: i dati di Salute mai per la pubblicità, il marketing o
  il data mining; mai dati falsi o inesatti in Salute; mai dati di salute
  in iCloud. MuW scrive e non legge, e oggi non ha annunci (ADR-0237); le
  calorie solo dove la stima regge (sopra).
- **5.1.1**: la privacy dice cosa, come e perché (sotto).
- **Nell'interfaccia si scrive «Apple Health»**, mai «HealthKit» (le linee
  guida di Apple per l'interfaccia).
- **App Privacy** in App Store Connect: quello che MuW scrive in Salute
  resta sul telefono, e Apple conta come raccolto solo quello che lascia il
  telefono. B lo rilegge sull'etichetta attuale prima dell'invio.

## La privacy

Una sezione nuova, «Apple Health», nelle cinque lingue
(`src/about/content/*.ts`), con la data nuova. Proposta:

> If you turn on «Save to Apple Health», at the end of an activity MuW
> writes it to Apple Health on your iPhone: the sport, when it started and
> ended, the distance, the route and, for a run, the estimated active
> calories. It stays on your phone and in Apple's Health app. MuW never
> reads your Health data, and nothing from Health reaches our server or any
> advertising. You can stop it with the same switch, or in the Health app.
> What is already in Health stays there until you delete it there, also
> when you delete the run or your MuW account.

E nella base giuridica, fra i consensi, «the saving to Apple Health».

## Android (parte C, rinviata)

Health Connect è la stessa cosa su Android: `react-native-health-connect`
4.1.3 (agosto 2026, il plugin Expo è dentro dalla 4), un
`ExerciseSessionRecord` con il suo `ExerciseRoute`, i permessi di
scrittura per l'esercizio, il percorso, la distanza e le calorie, `minSdk`
26. Su Google Play serve la dichiarazione delle app di salute nella Play
Console (fino a 7 giorni di attesa) e una build Android nuova. Proposta:
una parte a sé, dopo che la prima Android (TASK-294) è sullo store.

## Testi da approvare

| Dove | Testo |
|---|---|
| L'interruttore a fine attività | «Save to Apple Health» |
| Sotto, acceso | «Also in the Fitness app, with the route.» |
| Sotto, permesso negato | «MuW can't write to Apple Health. Allow it in the Health app: your profile › Apps › MuW.» |
| Il permesso di iOS (`NSHealthUpdateUsageDescription`) | «MuW saves your finished activities to Apple Health, with their time, distance, route and, for runs, estimated calories, so they also appear in the Fitness app.» |
| La descrizione su App Store Connect | «Saves your activities to Apple Health.» |
| La privacy | la sezione qui sopra |

Le traduzioni in italiano, tedesco, spagnolo e francese le propone l'agente
nella parte A, come per gli altri testi.

## Domande per l'utente

Una per volta, con la proposta pronta:

1. **Interruttore o automatico**: proposta, l'interruttore come Strava,
   spento la prima volta, poi come lasciato.
2. **Calorie stimate**: proposta, sì, solo per la corsa.
3. **Android**: proposta, più avanti, in una parte a sé.
4. **I testi** della tabella, in inglese, con le traduzioni dell'agente.
5. **La dipendenza**: proposta, `@kingstinct/react-native-healthkit` con
   `react-native-nitro-modules`.

Le risposte si scrivono qui e nell'ADR, nella stessa PR.

## Parti

### A — L'app, nascosta finché non c'è il modulo

1. Una funzione pura dalla corsa salvata all'allenamento (tipo, inizio,
   fine, distanza, posizioni, calorie secondo la scelta, `SyncIdentifier`),
   con i test.
2. L'interruttore sotto «Send to Strava», la scelta ricordata, la scrittura
   con «Save».
3. La libreria fuori dal linking, il `require` protetto, l'interruttore
   nascosto senza il modulo; i test con un modulo finto.
4. I testi nelle cinque lingue; l'impronta iOS misurata su una copia
   pulita.

File toccati, previsti (da dire al Coordinatore prima del codice):

```
apps/mobile/src/health/          (nuova: la funzione, la scelta, l'interruttore, i test)
apps/mobile/src/activities/RunEnd.tsx
apps/mobile/src/i18n/{it,de,es,fr}.ts
apps/mobile/package.json
package-lock.json
apps/mobile/react-native.config.js
```

### B — La build nativa 1.0.1

`app.json` (entitlements, testo del permesso), `locales/*.json`,
`react-native.config.js` (le librerie dentro), la privacy
(`src/about/content/*.ts`), la prova sul simulatore e sull'iPhone
dell'utente (l'allenamento in Fitness con la mappa; l'anello Movimento),
poi la build e l'invio ad Apple. La capability, la build, l'invio e la
descrizione dello store vogliono il sì dell'utente, ognuno.

### C — Android (rinviata)

Health Connect, come sopra, quando l'utente lo sceglie.

## Criteri di accettazione

- [ ] **Documenti**: questo file e l'ADR in `main`, con le scelte
      dell'utente scritte.
- [ ] **A**: con un modulo finto, una corsa salvata diventa un allenamento
      con lo sport, l'inizio, la fine, la distanza e le posizioni giuste, e
      le calorie secondo la scelta; la stessa corsa salvata due volte ha lo
      stesso `SyncIdentifier`; senza il modulo l'interruttore non c'è;
      l'impronta iOS è ancora `83793e26…` (o A aspetta B).
- [ ] **B**: sul simulatore e sull'iPhone, dopo «Save» l'allenamento è in
      Fitness con la mappa; il foglio dei permessi ha il testo approvato;
      la privacy è aggiornata; la 1.0.1 parte per Apple solo con il sì
      dell'utente.
- [ ] I testi e la privacy approvati dall'utente prima del merge di A.

## File toccati (documenti, questa PR)

```
docs/tasks/TASK-321.md   (nuovo)
docs/DECISIONS.md        (ADR-0281, in fondo)
docs/STATUS.md           (una voce in «In lavorazione»)
docs/INDEX.md            (una riga)
```

## Fuori scope

- Leggere da Salute: è TASK-312 D (le attività importate).
- Il battito dall'Apple Watch (TASK-169) e un'app per l'orologio.
- Mandare in Salute le corse già in «My activities»: solo quelle che
  finiscono con l'interruttore acceso.
- Cancellare da Salute quando si cancella in MuW.
- Passi, cadenza, dislivello come campioni a sé.

## Esito

*(si compila a fine task)*
