# TASK-321 — L'attività finita anche in Apple Salute e in Health Connect, perché compaia in Fitness

**Stato**: In lavorazione · documenti in `main` (#608), scelte dell'utente del 2026-10-28 dentro · A (app, nascosta) in `main` (#615, `8d8c4dde`), impronte invariate · poi B (la build nativa iOS 1.0.1), C (la build Android con Health Connect)
**Fase**: 4 · **Branch**: `docs/TASK-321-apple-health` (documenti),
`feat/TASK-321-a-health-app` (A), `chore/TASK-321-b-ios-health-build` (B),
`chore/TASK-321-c-android-health-connect` (C)
**Dipende da**: TASK-172 («Save» a fine corsa), TASK-187 e TASK-293
(«Send to Strava», il modello della riga a fine attività), TASK-169 (pause
e calorie stimate), TASK-262 C (la strada dell'esclusione dal linking),
TASK-152 (la 1.0.1 nativa, promemoria), TASK-294 (la build Android)
**Si incrocia con**: TASK-312 D (leggere da Salute: la stessa libreria),
TASK-322 (Sign in with Apple e Google: le stesse build native), TASK-323 E
(l'Apple Watch per il nuoto: la stessa 1.0.1 e HealthKit)
**ADR**: ADR-0281

## Obiettivo

A fine attività, con «Save», la corsa, la pedalata o la pagaiata va anche in
Apple Salute (iPhone) o in Health Connect (Android): un allenamento con lo
sport giusto, il tempo, la distanza e il percorso, e per la corsa le calorie
attive stimate. L'app Fitness lo mostra fra gli allenamenti, con la mappa.
Dopo il primo sì va da sé, a ogni «Save».

**Il codice aspetta una build nativa nuova**: nessun telefono vede la
funzione prima della 1.0.1 per iPhone e della build Android nuova. La parte
A può entrare in `main` prima, nascosta e senza muovere le impronte di oggi,
ma accesa è solo con le build di B e C.

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
- **Salute e Health Connect stanno sul telefono**: a differenza di Strava,
  niente server, niente rete, niente migrazione. La corsa salvata ha già
  tutto quello che serve (`SavedRun.track`: posizioni con orario, precisione
  e quota; le pause; i metri; lo sport in `activity`).
- **Expo Go non li ha**, e le build di oggi nemmeno: servono una build
  nativa iOS nuova, con la capability HealthKit, e una versione nuova
  sull'App Store (1.0.1), e una build Android nuova. Le impronte cambiano:
  non arriva con un aggiornamento OTA.

## Le scelte dell'utente (2026-10-28)

Una domanda per volta, in questa sessione, con la proposta pronta:

1. **Interruttore o automatico**: «Automatico». Alla prima attività una
   riga chiede di accendere; dopo il sì ogni «Save» va in Salute, senza
   interruttore. Si spegne dall'app Salute (o da Health Connect).
2. **Calorie stimate**: «Sì, solo corsa» (la proposta).
3. **Android**: «Sì, insieme» (la proposta era più avanti).
4. **Testi**: «Approvo così», in inglese, con le traduzioni dell'agente
   (tabella sotto). Poi la riga degli store divisa per store, «Sì, una per
   store»: Apple non vuole altre piattaforme nella scheda dell'App Store
   (2.3.10).
5. **Dipendenze**: «Sì, le quattro»: `@kingstinct/react-native-healthkit`
   e `react-native-nitro-modules` per l'iPhone, `react-native-health-connect`
   ed `expo-build-properties` per Android.

## Che cosa si scrive

| Dato | Da MuW | Apple Salute (HealthKit) | Health Connect |
|---|---|---|---|
| L'allenamento | la corsa salvata | `HKWorkout` | `ExerciseSessionRecord` |
| Lo sport | `activityOf(sport)` | `running` → `.running`, `cycling` → `.cycling`, `paddling` → `.paddleSports` | il tipo di esercizio corrispondente (corsa, bici; per la pagaia il più vicino, da verificare in A) |
| La camminata | non è ancora uno sport di MuW | `.walking`, quando lo sarà | il tipo camminata, idem |
| Inizio e fine | il primo e l'ultimo `track.fixes[].timeMs` | `startDate`, `endDate` | `startTime`, `endTime` |
| La distanza | `track.distanceM` | `totalDistance`, più un campione `distanceWalkingRunning`, `distanceCycling` o `distancePaddleSports` (questo da iOS 18) | `DistanceRecord` |
| Il percorso | `track.fixes`: posizione, orario, precisione, quota | `HKWorkoutRoute`, con `HKWorkoutRouteBuilder` | `ExerciseRoute` della sessione |
| Le calorie attive, solo corsa | `kcal()` di `navigation/runMetrics.ts` | un campione `activeEnergyBurned` legato all'allenamento | `ActiveCaloriesBurnedRecord` |
| All'aperto | sempre | `HKMetadataKeyIndoorWorkout: false` | — |
| Una volta sola | la chiave della corsa (`activityKey`) | `HKMetadataKeySyncIdentifier` e `HKMetadataKeySyncVersion` | `clientRecordId` e `clientRecordVersion` |

- **Le pause** (`track.pauses`): la libreria iOS salva l'allenamento senza
  gli eventi di pausa. Fitness conta allora il tempo dall'inizio alla fine,
  pause comprese, e il suo passo medio è più lento di quello di MuW quando
  ci sono state pause. La distanza e il percorso sono gli stessi. È un
  limite scritto, accettato con la scelta 5: il tempo totale è vero. Su
  Android le pause vanno come segmenti di pausa della sessione, se la
  libreria li passa (A lo verifica).
- **Le calorie**: `kcal()` è la formula della corsa (1,036 kcal per kg e
  per km, 70 kg finché il profilo non ha il peso), che la schermata di
  corsa usa oggi per ogni sport. Per la bici e la pagaia non vale, e Apple
  vieta di scrivere in Salute dati falsi o inesatti (5.1.3): per loro
  niente calorie (scelta 2), finché non c'è una stima per sport.
- **L'anello Movimento**: con l'Apple Watch al polso conta già la misura
  dell'orologio, e Salute non conta due volte le calorie dello stesso
  tempo (tiene la fonte prima nell'ordine delle fonti). Con il solo iPhone,
  le prove trovate in rete non concordano su quanto le calorie di un'altra
  app muovano l'anello: la parte B lo verifica sull'iPhone dell'utente. Gli
  anelli Esercizio e In piedi sono dell'Apple Watch: un'app non li scrive.

## Come funziona nell'app

- **Prima del sì**, a fine attività, sotto «Send to Strava», una riga come
  quella di «Connect with Strava»: il pulsante «Save to Apple Health» (su
  Android «Save to Health Connect») e sotto «Your activities also go to the
  Fitness app, with the route.». Torna a ogni fine attività finché non è
  acceso, come la riga di Strava finché Strava non è collegato.
- **Il pulsante** apre il foglio dei permessi del telefono. Con il sì, MuW
  se lo ricorda (un file `health.json`, come `strava.json`) e da lì ogni
  «Save» scrive l'attività, sul telefono, subito, anche senza rete. Sotto
  il modulo la riga dice «Also to Apple Health, with Save.».
- **Si spegne dall'app Salute** (o da Health Connect), come ha scelto
  l'utente: MuW legge lo stato del permesso prima di scrivere. Con il
  permesso tolto, o negato al foglio, la riga dice «MuW can't write to
  Apple Health. Allow it in the Health app: your profile › Apps › MuW.» e
  non scrive niente. iOS mostra il suo foglio una volta sola: dopo, il
  permesso si dà solo dall'app Salute.
- **«Discard» non scrive niente.** Senza account la fine corsa ha solo
  «Done» (TASK-172): niente Salute, come niente «My activities».
- **Solo dove c'è**: la riga non c'è senza il modulo nativo (Expo Go, le
  build di oggi) né dove il telefono non ha Health Connect (Android 13 e
  precedenti senza la sua app).
- Una corsa cancellata in «My activities», o l'account cancellato, **resta
  in Salute**: è dell'utente, sul suo telefono, e si cancella da lì.
- **Le attività importate** (TASK-312) non ci vanno: vengono da app che di
  solito ce le hanno già scritte.

## L'iPhone

- **La libreria**: `@kingstinct/react-native-healthkit` 16.2.0 (MIT, del
  2026-10-12), con `react-native-nitro-modules` (0.37.1) e
  `@react-native-healthkit/core`, che arriva con lei. Salva l'allenamento
  (`saveWorkoutSample`, con i campioni e i totali) e il percorso
  (`WorkoutProxy.saveWorkoutRoute`, che usa `HKWorkoutRouteBuilder`). Legge
  anche, e servirà a TASK-312 D. Scartata `react-native-health` (1.19.0,
  ottobre 2024): non salva il percorso e non aggiunge funzioni dal 2023.
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
- **Alla build (parte B)**: le librerie dentro il linking, gli entitlements
  e il testo del permesso in `app.json`, l'impronta nuova misurata. La 1.0.0
  (7) continua a ricevere gli aggiornamenti del suo runtime (`83793e26…`);
  la 1.0.1 ha il suo: ogni `eas update` dopo va fatto per tutti e due
  (`DEPLOY.md` A.7).
- **Una sola 1.0.1 (proposta)**: la stessa build accende anche quello che
  la aspetta già (`tasks/TASK-152.md`): `expo-contacts` di TASK-262 C e
  `expo-document-picker` di TASK-312 B, tolti dall'esclusione con i loro
  plugin e testi, e i moduli di TASK-322 se sono pronti. Una sola revisione
  di Apple e un solo runtime nuovo, al posto di tanti. Per HealthKit Apple
  guarda il testo del permesso (`NSHealthUpdateUsageDescription`), la
  privacy e la riga della descrizione: tutti e tre approvati dall'utente il
  2026-10-28 (sotto).

## In comune con TASK-323 (nuoto, parte E: Apple Watch)

TASK-323 E è un'app per Apple Watch che registra il nuoto in acque libere.
Non si toccano i file dell'altro; in comune ci sono:

- **la build e la capability**: la stessa 1.0.1, e HealthKit acceso una
  volta sola sull'App ID `com.lppl1316.sgrava`. Gli entitlements, i testi
  `NSHealth…` di `app.json` e la sezione della privacy li scrive la parte B
  di questo task; se l'orologio vuole di più (il suo target, altri
  permessi), TASK-323 E li aggiunge con la sua PR, dopo B;
- **un'attività, un allenamento**: se l'orologio salva già il nuoto in
  Salute, il telefono non lo riscrive. Il nuoto oggi non è uno sport di
  MuW; quando lo sarà, `.swimming` all'aperto, e la regola si scrive qui;
- **leggere da Salute non è di questo task**: TASK-321 scrive e non legge
  (scelte dell'utente, privacy approvata «MuW never reads your health
  data»). La lettura dei nuoti dell'orologio che TASK-323 E §4 si aspetta da
  qui è dello studio D di TASK-312, che dovrà cambiare anche quella riga
  della privacy, col sì dell'utente.

## Android

- **La libreria**: `react-native-health-connect` 4.1.3 (agosto 2026), con
  il plugin Expo dentro dalla 4 (che dichiara i permessi e la pagina che
  spiega perché li chiede). Scrive una `ExerciseSessionRecord` con il suo
  `ExerciseRoute`, la distanza e le calorie.
- **I permessi**: scrittura di esercizio, percorso dell'esercizio, distanza
  e calorie attive. Mai lettura.
- **`expo-build-properties`** alza `minSdkVersion` da 24 a 26, il minimo di
  Health Connect: MuW non si installa più su Android 7 (`compileSdk` e
  `targetSdk` sono già 36).
- **L'impronta**: il plugin e le impostazioni di Android vanno in
  `ANDROID_ONLY` di `fingerprint.config.js`, così il runtime dell'iPhone
  non si muove per loro (TASK-294).
- **Google Play**: la dichiarazione delle app di salute nella Play Console,
  dopo la sezione «Data safety»; l'approvazione può volere fino a 7 giorni,
  e l'accesso arriva qualche giorno dopo. La compila l'utente, con il testo
  preparato dall'agente nella parte C.

## Prima delle build (parte A)

Le quattro librerie stanno in `package.json` ma fuori dal linking
(`react-native.config.js`, `platforms: { ios: null, android: null }`, come
AdMob nella build dello store), l'app le carica con un `require` protetto e
senza il modulo la riga non c'è. Così il codice entra in `main`, si prova
con moduli finti nei test, e le build di oggi restano con le loro
impronte: quella iOS `83793e26…`, da misurare su una copia pulita, e
quella Android. Se si muovono anche così, A aspetta nel suo branch le build
di B e C.

## La revisione di Apple e di Google

- **2.5.1**: HealthKit solo per salute e fitness, integrato con Salute, e
  detto nella descrizione dell'app: una riga nella descrizione di App Store
  Connect e una in quella di Google Play, nelle cinque lingue (a mano,
  dell'utente). Ognuna nomina solo il suo servizio (2.3.10).
- **5.1.2 e 5.1.3**: i dati di Salute mai per la pubblicità, il marketing o
  il data mining; mai dati falsi o inesatti in Salute; mai dati di salute
  in iCloud. MuW scrive e non legge, e oggi non ha annunci (ADR-0237); le
  calorie solo per la corsa.
- **5.1.1**: la privacy dice cosa, come e perché (sotto).
- **Nell'interfaccia si scrive «Apple Health»**, mai «HealthKit» (le linee
  guida di Apple per l'interfaccia).
- **App Privacy** e **Data safety**: quello che MuW scrive resta sul
  telefono, e Apple conta come raccolto solo quello che lascia il telefono.
  B e C rileggono le due etichette attuali prima dell'invio.

## Testi approvati dall'utente (2026-10-28)

| Dove | Testo |
|---|---|
| Il pulsante a fine attività, prima del sì | «Save to Apple Health» · Android «Save to Health Connect» |
| Sotto il pulsante | «Your activities also go to the Fitness app, with the route.» · Android «Your activities also go to Health Connect, with the route.» |
| Acceso, sotto il modulo | «Also to Apple Health, with Save.» · Android «Also to Health Connect, with Save.» |
| Permesso negato o tolto | «MuW can't write to Apple Health. Allow it in the Health app: your profile › Apps › MuW.» · Android «MuW can't write to Health Connect. Allow it in Health Connect › App permissions › MuW.» |
| Il permesso di iOS (`NSHealthUpdateUsageDescription`) | «MuW saves your finished activities to Apple Health, with their time, distance, route and, for runs, estimated calories, so they also appear in the Fitness app.» |
| La descrizione degli store (a mano) | App Store «Saves your activities to Apple Health.» · Google Play «Saves your activities to Health Connect.» |
| La privacy | la sezione qui sotto |

Le traduzioni in italiano, tedesco, spagnolo e francese le fa l'agente
nella parte A (la privacy nella parte B), come per gli altri testi.

## La privacy (approvata)

Una sezione nuova, «Apple Health and Health Connect», nelle cinque lingue
(`src/about/content/*.ts`), con la data nuova:

> Once you turn on «Save to Apple Health» (iPhone) or «Save to Health
> Connect» (Android), every activity you save is also written there, on
> your phone: the sport, when it started and ended, the distance, the route
> and, for a run, the estimated active calories. MuW never reads your health
> data, and nothing from them reaches our server or any advertising. You can
> stop it in the Health app or in Health Connect. What is already there
> stays until you delete it there, also when you delete the run or your
> account.

E nella base giuridica, fra i consensi, il salvataggio in Apple Salute e in
Health Connect. Entra con la prima build che porta la funzione.

## Parti

### A — L'app, nascosta finché non c'è il modulo

1. Una funzione pura dalla corsa salvata all'allenamento, per i due
   telefoni (tipo, inizio, fine, distanza, posizioni, pause, calorie solo
   per la corsa, l'identificativo della corsa), con i test.
2. La riga a fine attività, il pulsante, il permesso, la scelta ricordata,
   la scrittura con «Save»; lo stato del permesso letto prima di scrivere.
3. Le librerie fuori dal linking, il `require` protetto, la riga nascosta
   senza il modulo; i test con moduli finti.
4. I testi nelle cinque lingue; le impronte misurate su una copia pulita.

File toccati, previsti (da dire al Coordinatore prima del codice):

```
apps/mobile/src/health/          (nuova: la funzione, la scelta, la riga, i test)
apps/mobile/src/activities/RunEnd.tsx
apps/mobile/src/i18n/{it,de,es,fr}.ts
apps/mobile/package.json
package-lock.json
apps/mobile/react-native.config.js
```

Senza Coordinatore (archiviato il 2026-10-28), la lista è rimasta questa,
più i documenti di chiusura di A nella stessa PR: `docs/tasks/TASK-321.md`,
`docs/STATUS.md` (righe aggiunte alla voce) e `docs/DECISIONS.md`
(aggiunta ad ADR-0281, in fondo).

#### Com'è andata A (2026-10-28)

- **Il codice**, tutto in `src/health/`: `workout.ts` (la funzione pura
  dalla traccia salvata all'allenamento: lo sport, inizio e fine dal primo
  e dall'ultimo punto, i metri di MuW, le pause dentro l'attività, le
  calorie di `kcal()` solo per la corsa, la chiave `activityKey`);
  `appleWorkout.ts` e `healthConnectWorkout.ts` (la forma che vuole ogni
  libreria); `appleHealth.ts` e `healthConnect.ts` (il foglio, il permesso,
  la scrittura di quello che il permesso concede, tipo per tipo);
  `healthModules.ts` (il `require` protetto); `healthChoice.ts`
  (`health.json`, solo il sì); `useHealth.ts` e `HealthRunEnd.tsx` (la
  riga). In `RunEnd.tsx` la riga sotto «Send to Strava» e la scrittura dopo
  un «Save» riuscito. I testi nelle quattro lingue, con le traduzioni
  dell'agente: «Apple Salute», «Apple Salud», «Apple Santé», e l'app
  Fitness in francese è «Forme».
- **Lo sport** è quello del modulo di fine corsa: parte da
  `activityOf(sport)` e l'utente lo può cambiare, come per Strava e per il
  disegno.
- **La corsa da scrivere** la legge `RunEnd` dal file della corsa
  (`loadRun()`) prima che «Save» lo lasci andare: così A non tocca
  `App.tsx`. È la corsa che «Save» manda in «My activities»; solo se il
  telefono aveva rifiutato di scrivere il file (TASK-252) il file ha
  l'ultima copia scritta, e in Salute va quella.
- **Fuori dal linking**: in `react-native.config.js` le tre librerie
  native e `@react-native-healthkit/core`, che arriva con quella
  dell'iPhone, con `platforms: { ios: null, android: null }`;
  `react-native-health-connect` anche in `expo.autolinking.exclude` di
  `package.json`, perché porta un modulo Expo per Android.
  `expo-build-properties` è solo un plugin: senza `app.json` non fa niente.
- **Le impronte**, misurate su una copia pulita (`npm ci`,
  `APP_VARIANT=production`), prima e dopo A: iOS
  `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3`, Android
  `e2d334978e85871928226a36343f757128d232b3`, le stesse di `main`. A può
  entrare in `main` senza aspettare B e C.
- **I test**, con moduli finti: `workout.test.ts`, `appleHealth.test.ts`,
  `healthConnect.test.ts`, `healthChoice.test.ts`, `healthModules.test.ts`,
  `RunEndHealth.test.tsx` (la riga nascosta senza modulo, il foglio, il no,
  la scrittura con «Save», niente con il permesso tolto né con «Discard»).

**Per B**, da guardare sull'iPhone:

- la libreria mette i metadati dell'allenamento, `HKSyncIdentifier`
  compreso, anche sui campioni di distanza e calorie che lega
  all'allenamento. Se Salute prendesse per lo stesso oggetto due campioni
  di tipo diverso con la stessa chiave, uno non entrerebbe: B guarda che in
  Salute ci siano l'allenamento, la distanza e le calorie;
- la distanza della pagaia (`distancePaddleSports`) c'è da iOS 18: prima,
  l'allenamento ha il suo totale e nessun campione;
- MuW non tiene la precisione verticale dei punti: l'altezza va con
  `verticalAccuracy` −1, «non sicura», e Fitness non ne fa un dislivello.
  Tenerla vorrebbe un campo in più in `TrackFix`
  (`navigation/trackRecorder.ts`): fuori da questo task.

**Per C**, letto il codice Kotlin di `react-native-health-connect` 4.1.3:

- **blocca la scrittura del percorso**: per ogni punto vuole
  `horizontalAccuracy`, `verticalAccuracy` e `altitude`, o lancia
  `InvalidLength`. MuW manda la precisione orizzontale e l'altezza quando
  c'è, mai la verticale (non la ha, e inventarla sarebbe un dato inesatto):
  con la 4.1.3 la sessione con il percorso non entra, e con lei niente.
  Prima di accendere Android, C lo risolve: una versione della libreria che
  lo corregga, o una correzione da proporre all'utente;
- legge le pause (`segments`) e i giri (`laps`) dallo stesso campo
  `samples`, e un giro vuole una lunghezza: le pause non possono passare.
  A le manda come `segments`, come dicono i tipi della libreria; la 4.1.3
  le ignora, e in Health Connect il tempo è dall'inizio alla fine, come
  su iPhone.

### B — La build nativa iOS 1.0.1

`app.json` (entitlements, testo del permesso), `locales/*.json`,
`react-native.config.js` (le librerie iOS dentro), la privacy
(`src/about/content/*.ts`), la prova sul simulatore e sull'iPhone
dell'utente (l'allenamento in Fitness con la mappa; l'anello Movimento),
poi la build e l'invio ad Apple. La capability, la build, l'invio e la
descrizione dello store vogliono il sì dell'utente, ognuno.

File toccati (detti al Coordinatore prima del codice, 2026-10-29), branch
`feat/TASK-321-b-health-ios` (il nome dato dalla sessione che ha aperto
B, al posto di `chore/TASK-321-b-ios-health-build`):

```
apps/mobile/app.json                          (ios.entitlements, NSHealthUpdateUsageDescription)
apps/mobile/locales/{en,it,de,es,fr}.json     (NSHealthUpdateUsageDescription)
apps/mobile/react-native.config.js            (le librerie iOS dentro, solo su iOS)
apps/mobile/src/about/content/{en,it,de,es,fr}.ts  (la sezione della privacy, la data)
apps/mobile/src/about/{AboutPage,documents}.test.*  (la data nuova)
apps/mobile/src/health/nativeConfig.test.ts   (nuovo)
site/privacy/*                                (rifatto con make_privacy.mjs)
site/tests/privacy.test.mjs                   (la data nuova)
docs/tasks/TASK-321.md, docs/STATUS.md (righe aggiunte), docs/DECISIONS.md (aggiunta ad ADR-0281)
```

**La PR resta in bozza** fino al taglio della 1.0.1, che decide il
Coordinatore: in `main` sposta l'impronta iOS e gli `eas update` da `main`
non arrivano più alla 1.0.0 (7).

#### Com'è andata B (2026-10-29)

- **Il codice**: in `app.json` `ios.entitlements`
  (`com.apple.developer.healthkit: true`, `…healthkit.access: []`) e
  `ios.infoPlist.NSHealthUpdateUsageDescription` con il testo approvato,
  tradotto nelle quattro `locales/*.json` con i nomi di A («Apple Salute»,
  «Apple Salud», «Apple Santé», l'app «Forme»); in `react-native.config.js`
  le tre librerie dell'iPhone collegate **solo su iOS**, Health Connect
  ancora fuori da tutte e due; la privacy approvata nelle cinque lingue,
  dopo «Strava», con il consenso nella base giuridica e la data del 29
  ottobre 2026, e `site/privacy/` rifatto. PR in bozza #620.
- **Le impronte** (copia pulita, `npm ci`, `APP_VARIANT=production`), anche
  dopo l'unione con `main` del 2026-10-29: iOS
  `fd0cbb436ec37c7ed184d1c88176cfaa08c68a02` (era `83793e26…`: le
  librerie, la configurazione, l'autolinking iOS), Android
  `e9a0bda01eef8abd2de692c67666d9bcc7e44b5a` (era `e2d33497…`: solo
  `expoConfig`, per le chiavi `ios` di `app.json`). Per tenere ferma quella
  Android servirebbe un elenco solo iOS in `fingerprint.config.js`, di
  TASK-294. **Scelta del Coordinatore** (2026-10-29): niente elenco,
  `fingerprint.config.js` resta com'è; Android ha comunque la sua build
  1.0.1, con contatti, document picker e l'accesso con Google, e la sua
  impronta si muove con quella iOS.
- **Il sì dell'utente** (2026-10-29, in questa sessione, una domanda per
  volta): «Approvo così» al testo del permesso
  (`NSHealthUpdateUsageDescription`) nelle cinque lingue, e «Approvo così»
  alla sezione della privacy e alla riga del consenso nelle cinque lingue.
- **La data della privacy** è quella del giorno del merge al taglio della
  1.0.1 (condizione del Coordinatore), così non va online prima che la
  1.0.1 sia sull'App Store: nella PR c'è il 29 ottobre 2026, da portare a
  quel giorno al riallineamento, dopo quello per TASK-312 B, con
  `site/privacy/` rifatto.
- **Sul simulatore** (Xcode 27, iOS 27, build Release come quella dello
  store, `APP_VARIANT=production`, con l'attesa degli update spenta e la
  scena di iOS 27 aggiunta solo nella copia locale): l'app parte con i
  moduli nativi, nel binario ci sono gli entitlements HealthKit, la fine
  corsa si apre con «Save» e «Discard». Il foglio di iOS dice «Write
  Access», «Choose which Health data you'd like this app to be able to add
  to», con il testo approvato sotto, e sei voci (energia attiva, distanza
  in bici, distanza della pagaia e le altre tre). Senza
  `NSHealthShareUsageDescription` non si chiude: per scrivere basta il testo
  dello scrivere, come previsto.
- **Dopo «Allow», l'allenamento in Fitness con la mappa** (con l'accesso
  al simulatore dato dall'utente): «Select All 6 Topics» e «Allow»; sulla
  fine corsa «Save to Apple Health» diventa «Also to Apple Health, with
  Save.» senza un altro foglio; poi «Save». Fitness mostra «Outdoor Run»,
  Trento, il percorso sulla mappa, la fonte MuW, 0:18:00, 3,01 km, 219 kcal
  attive, 5'58"/km: i numeri di MuW (3,02 km in MuW: 3016 m, che Fitness
  scrive 3,01). In «Step Distance» di oggi ci sono i 3,01 km: la distanza
  e le calorie sono entrate accanto all'allenamento, anche con lo stesso
  `HKSyncIdentifier` («Per B» qui sopra).
- **Resta per l'iPhone dell'utente**, alla build `preview` o alla 1.0.1:
  l'anello Movimento (il simulatore non ha un obiettivo, dice «--/--»).
- **Gli altri quattro sì dell'utente** (2026-10-29, «SI» a ognuno, in
  questa sessione): accendere HealthKit sull'App ID nell'account Apple
  Developer, la build, l'invio ad Apple e la riga dell'App Store «Saves your
  activities to Apple Health.». Valgono per il taglio della 1.0.1, che
  decide il Coordinatore: una sola build con contatti, document picker e
  l'accesso con Apple e Google, come ha chiesto l'utente. La build la lancia
  l'utente con il suo account Apple (`DEPLOY.md` A.7); la capability la
  allinea EAS alla build o, se non lo fa, l'utente a mano in
  developer.apple.com.

### C — La build Android con Health Connect

`app.json` (i plugin di `react-native-health-connect` ed
`expo-build-properties`), `fingerprint.config.js` (`ANDROID_ONLY`),
`react-native.config.js` (la libreria Android dentro), la prova su un
telefono Android, il testo per la dichiarazione della Play Console, poi la
build e l'invio. La dichiarazione, la build e l'invio vogliono il sì
dell'utente, ognuno. La privacy entra con B o con C, quella che arriva
prima.

## Criteri di accettazione

- [x] **Documenti**: questo file e l'ADR, con le scelte dell'utente
      scritte.
- [x] **A**: con moduli finti, una corsa salvata diventa un allenamento con
      lo sport, l'inizio, la fine, la distanza e le posizioni giuste, e le
      calorie solo se è una corsa; la stessa corsa salvata due volte ha lo
      stesso identificativo; senza il modulo, o con il permesso tolto, non
      si scrive niente e la riga lo dice; le impronte delle build di oggi
      non si muovono (o A aspetta B e C). *Fatto il 2026-10-28: i test di
      `src/health/`, impronte iOS `83793e26…` e Android `e2d33497…`
      invariate.*
- [ ] **B**: sul simulatore e sull'iPhone, dopo «Save» l'allenamento è in
      Fitness con la mappa; il foglio dei permessi ha il testo approvato;
      la privacy è aggiornata; la 1.0.1 parte per Apple solo con il sì
      dell'utente. *Sul simulatore fatto il 2026-10-29 (#620 in
      bozza): il foglio con il testo approvato, l'allenamento in Fitness con
      la mappa, privacy e testi approvati dall'utente. Restano l'iPhone e
      la 1.0.1, al taglio.*
- [ ] **C**: su un telefono Android l'attività è in Health Connect con il
      percorso; la dichiarazione della Play Console è fatta; la build parte
      solo con il sì dell'utente.

## File toccati (documenti, questa PR)

```
docs/tasks/TASK-321.md   (nuovo)
docs/DECISIONS.md        (ADR-0281, in fondo)
docs/STATUS.md           (una voce in «In lavorazione»)
docs/INDEX.md            (una riga)
```

## Fuori scope

- Leggere da Salute o da Health Connect: è TASK-312 D (le attività
  importate).
- Il battito dall'Apple Watch (TASK-169) e un'app per l'orologio.
- Mandare in Salute le corse già in «My activities»: solo quelle salvate
  dopo il sì.
- Cancellare da Salute quando si cancella in MuW.
- Una stima delle calorie per la bici e la pagaia.
- Passi, cadenza, dislivello come campioni a sé.

## Esito

*(si compila a fine task)*

- **A** (2026-10-28): l'app scrive l'attività in Apple Salute e in Health
  Connect con «Save», dopo il primo sì; nascosta finché le build non hanno
  il modulo nativo; impronte invariate. Per C, la libreria Android 4.1.3
  non scrive il percorso senza la precisione verticale (sopra, «Per C»).
