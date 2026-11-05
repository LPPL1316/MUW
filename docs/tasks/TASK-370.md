# TASK-370 — L'app per Apple Watch, per tutti gli sport, anche senza telefono

**Stato**: Todo · proposta (parte 0) in PR; nessun codice prima delle scelte
dell'utente
**Fase**: 5 · **Branch**: `docs/TASK-370-apple-watch` (documenti); il codice
`feat/TASK-370-a-…`, `feat/TASK-370-b-…`, …
**Dipende da**: TASK-321 B (HealthKit nella build, in `main`), TASK-376 B3 (il
registro degli sport nell'app, `src/sports/`), TASK-323 D (il nuoto nell'app)
**ADR**: ADR-0314 (proposto) · numeri riservati dal Coordinatore il
2026-11-04, confermati il 2026-11-05

## Obiettivo

MuW ha un'app per Apple Watch che fa tutto quello che fa la schermata della
corsa, per **ogni sport** dell'app, **anche col telefono lasciato a casa**:
si sceglie sull'orologio un percorso già fatto (o si parte senza percorso),
l'orologio guida con freccia, metri e vibrazioni, registra col suo GPS, il
battito e le calorie, salva l'allenamento in Apple Salute e, quando il
telefono torna vicino, gli passa la traccia: lì si salva e si pubblica col
modulo di sempre.

Richiesta dell'utente del 2026-11-05: «si facciamo l'app per apple watch
completa per tutti gli sport». Alla domanda «Fin dove deve arrivare
l'orologio nella prima versione?» ha scelto **«Subito anche senza
telefono»** (contro «Prima col telefono, poi da solo» e «Solo battito e
comandi»).

Assorbe la parte E di TASK-323 (il nuoto in acque libere guidato
dall'orologio, «E, il piano» in `tasks/TASK-323.md`) e il battito in tempo
reale dall'Apple Watch rimandato da TASK-169 e TASK-374.

## Contesto da leggere

- `DECISIONS.md` ADR-0314 (questo task), ADR-0281 (Salute), ADR-0052
  (navigazione), ADR-0320 (registro degli sport), ADR-0319 (Record only),
  ADR-0318 (calorie e zone)
- `tasks/TASK-323.md`, «E — Apple Watch» e «E, il piano»
- `tasks/TASK-321.md`, «In comune con TASK-323» (un'attività, un allenamento)

## Com'è oggi (main `ba91ee3b`)

1. **Nessun codice per l'orologio**: non esistono `apps/mobile/targets/` né
   `apps/mobile/src/watch/`; in `package.json` nessuna dipendenza per
   watchOS.
2. **La guida è tutta JavaScript sul telefono**: `navigation/navigator.ts`
   (svolte, `ANNOUNCE_M` 50 m, `PASS_M` 10 m), `progress.ts` (fuori rotta,
   `OFF_ROUTE_M`), `rejoin.ts` (il rientro, TASK-303), `startAnywhere.ts`,
   `swim.ts` e `paddle.ts`; con dei fixture JSON in `navigation/fixtures/`.
3. **Gli sport** stanno in `src/sports/*.ts` (running, walking, cycling,
   paddling, swimming, skiing, xc_skiing, gym; hike, gravel e roller
   arrivano con TASK-377, 378, 380). Ognuno dice già il suo
   `appleWorkout` (il numero di `HKWorkoutActivityType`), il passo, l'energia.
4. **Salute**: `@kingstinct/react-native-healthkit` 16.2.0, entitlement
   HealthKit in `app.json`; il telefono scrive un allenamento a corsa finita
   (`health/workout.ts`). Il battito non si legge ancora (TASK-345 C).
5. **Le due dipendenze dell'orologio** hanno già il sì dell'utente
   (2026-10-30, per TASK-323 E): `@bacons/apple-targets` (il target watchOS
   da una cartella `targets/watch/` a ogni `prebuild`) e
   `react-native-watch-connectivity` (`WCSession` dal JavaScript).
6. **Un OTA non arriva all'orologio**: l'app dell'orologio è Swift, esce
   solo con una build per l'App Store.

## Come è fatta (proposta)

### Il principio

L'orologio **non disegna percorsi**: il Route Engine resta sul telefono e
sul server, come dice CLAUDE.md. L'orologio porta percorsi già decisi, li
segue e registra. «Senza telefono» vuol dire: preparati prima, corsi dopo.

### Le parti

**A — Le fondamenta (con il telefono vicino)**
- Il target watchOS (SwiftUI, watchOS 10 o più) con `@bacons/apple-targets`
  in `apps/mobile/targets/watch/`; `react-native-watch-connectivity` per
  parlarsi.
- L'allenamento sull'orologio: un `HKWorkoutSession` col tipo dello sport
  (`appleWorkout` del registro), avvio, pausa, ripresa, stop dal polso, e
  dal telefono allo stesso modo (lo stesso stato sui due).
- I numeri sull'orologio: tempo, distanza, passo o velocità come li scrive
  lo sport, battito e zona, calorie.
- **Il battito in tempo reale al telefono** (mirroring di `HKWorkoutSession`,
  iOS 17 e watchOS 10): la schermata della corsa lo mostra con la zona.
- **Un'attività, un allenamento** (regola di TASK-321): quando registra
  l'orologio, l'allenamento in Salute lo salva lui; il telefono non lo
  riscrive.

**B — Senza telefono**
- **I percorsi sull'orologio**: dal telefono «Send to watch» sul percorso
  che si vede (testo da approvare); in più l'orologio tiene da solo gli
  ultimi percorsi mandati e i «Favorites» (numero da decidere, ~20).
  Viaggiano con `transferUserInfo`/`transferFile`, arrivano anche a
  telefono lontano.
- **La guida in Swift**: la stessa logica di `navigator.ts`, `progress.ts`,
  `rejoin.ts`, `startAnywhere.ts`, riscritta in un pacchetto Swift puro
  (`WatchGuide`). Per non farle divergere, i test XCTest leggono **gli stessi
  fixture JSON** di `navigation/fixtures/` e un test jest nuovo genera i
  risultati attesi dal TypeScript: se uno cambia e l'altro no, la CI lo dice.
- **Le vibrazioni**: svolta a destra, svolta a sinistra, fuori rotta,
  rientrato (schemi da far scegliere all'utente); la schermata: freccia
  grande, metri alla prossima svolta, una mappa piccola con la linea.
- **La registrazione**: GPS dell'orologio, la traccia salvata
  sull'orologio, a fine corsa mandata al telefono con `transferFile`
  quando torna vicino. Il telefono la apre come una corsa finita sua: «Save»
  e il modulo di pubblicazione di sempre (con la traccia dell'orologio).
- **Senza percorso**: «Run without a route» anche sull'orologio.

**C — Sport per sport**, ognuno coi suoi numeri e le sue regole
- Corsa, camminata, escursione, roller: come B.
- Bici e gravel: velocità al posto del passo; le vibrazioni un po' prima
  (la distanza di annuncio dello sport, come sul telefono).
- Canoa: passo per 500 m; sull'acqua niente dislivello.
- **Nuoto in acque libere** (la vecchia 323 E): `swimmingLocationType
  .openWater`, il blocco dell'acqua, i giri, la guida alle curve e il fuori
  rotta oltre 25 m. Va provato in acqua (primavera 2027): fino ad allora
  resta spento sull'orologio, come il nuoto nell'app (`ready`).
- Sci alpino e fondo (Record only): registra, niente guida.
- Palestra: niente GPS; tempo, battito, calorie e il timer di recupero.
- Gli sport che arrivano dopo: la lista dell'orologio viene dal registro
  `src/sports/` (un JSON generato al `prebuild`, con un test che lo tiene
  uguale), così uno sport nuovo non dimentica l'orologio.

**D — L'uscita**
- Testi nelle cinque lingue (orologio e telefono), da approvare.
- Privacy: posizione e battito letti dall'orologio durante l'allenamento;
  `site/privacy/` e l'etichetta App Privacy dell'App Store, col sì.
- Le schermate dell'orologio per l'App Store.
- La build (vedi sotto) e l'invio ad Apple, col sì dell'utente.

### Fuori, per ora

- **Disegnare un percorso nuovo dall'orologio** (orologio cellular, l'API
  del server): possibile più avanti, ma non nella prima versione.
- Complicazioni e widget sul quadrante: dopo D, se servono.
- Musica dall'orologio: l'utente usa Spotify, che ha la sua app per
  l'orologio.

### La build: nella 1.0.2 o in una sua

Il Coordinatore tiene l'ordine della 1.0.2 con l'utente. Ci vanno già: 333 E
(expo-video), la chiave di Salute per 374 C, 345 C, 397 C e Sign in with
Apple/Google (322). L'orologio è il cambio nativo più grosso.

| | Nella 1.0.2 | In una build sua (1.1) |
|---|---|---|
| Pro | Una sola revisione Apple, una sola impronta nuova, un solo giro di OTA divisi | La 1.0.2 esce appena pronte le sue cose; l'orologio ha il tempo di essere provato al polso; un rifiuto di Apple sull'orologio non ferma accesso e Salute |
| Contro | La 1.0.2 aspetta settimane di prove sull'orologio; un problema dell'orologio ferma tutto il resto | Due revisioni e due impronte iOS; gli OTA si dividono per un'altra versione |

**Proposta**: una build sua, la **1.1**, dopo la 1.0.2. Il codice Swift
dell'orologio non si corregge con un OTA: meglio uscire solo quando è
provato, senza tenere ferme le altre cose.

### Cosa serve per provarlo

- Il Mac con Xcode (c'è, Xcode 27) e il simulatore di watchOS: GPS simulato
  e allenamenti finti bastano per A e buona parte di B.
- **Un Apple Watch vero** per battito, vibrazioni, GPS e prova senza
  telefono; poi uscite vere, una per sport che si può.

## Scelte dell'utente

1. **Fin dove nella prima versione** (2026-11-05): «Subito anche senza
   telefono».

2. **La build** (2026-11-05): «Build sua, la 1.1» — dopo la 1.0.2, che
   esce senza aspettare l'orologio.

3. **L'Apple Watch per provare** (2026-11-05): «Sì, Series 6 o più nuovo»,
   con watchOS 10 o più: basta per battito, vibrazioni, GPS e uscite senza
   telefono.

**Da chiedere, una per volta** (con una proposta pronta):
4. Gli schemi delle vibrazioni (alle prime prove al polso).
5. I testi nelle cinque lingue.
6. La riga della privacy e l'etichetta App Privacy.

## Parte A, il piano (2026-11-05)

**Il vincolo della build**: la 1.1 è una build sua, dopo la 1.0.2, e gli
OTA di `main` devono continuare ad arrivare alla 1.0.1 e alla 1.0.2. Quindi
**fino alla build 1.1 l'impronta iOS di `main` non si muove**: ogni PR della
parte A la controlla (`ios-fingerprint` su una copia pulita con
`APP_VARIANT=production`, prima e dopo uguali). Le dipendenze native e il
plugin entrano in `main` solo con l'ultima PR, **A-flip**, quando l'utente e
il Coordinatore fissano la 1.1.

**A1 — Il nucleo, senza nativo** (in `main` subito, impronta invariata):
- `apps/mobile/targets/watch/Core/` (nuova): un pacchetto Swift puro
  (`Package.swift`, `WatchCore`): lo stato dell'allenamento (pronto, conto
  alla rovescia, in corso, in pausa, finito) e le sue transizioni, i
  messaggi telefono↔orologio con la versione, la tabella degli sport;
  XCTest con `swift test`, senza Xcode project né `prebuild`.
- `apps/mobile/src/watch/` (nuova): `watchMessages.ts` (puro: gli stessi
  messaggi, con dei fixture JSON letti anche da XCTest), `watchSports.ts`
  (puro: la tabella degli sport dell'orologio dal registro `src/sports/`;
  un test jest la confronta con `targets/watch/Core/.../sports.json`, che
  si rigenera con uno script), test jest.
- `.github/workflows/watch.yml` (nuova): `swift test` su un runner macOS,
  solo quando cambia `apps/mobile/targets/watch/` (i minuti macOS costano
  di più: per questo il filtro sui percorsi).

**A2 — L'app dell'orologio** (in `main`, impronta invariata finché il
plugin non è in `app.json`):
- `apps/mobile/targets/watch/` (nuova): `expo-target.config.js`
  (`type: "watch"`, bundle `.watchkitapp`, entitlement HealthKit), l'app
  SwiftUI (scelta dello sport, avvio, numeri, pausa, ripresa, fine),
  `HKWorkoutSession` + `HKLiveWorkoutBuilder`, il mirroring al telefono,
  `WCSession`. I testi dell'orologio, in A, sono solo quelli che l'app ha
  già, con le loro traduzioni.
- Le prove nel simulatore di watchOS e sull'orologio dell'utente con un
  `prebuild` locale che aggiunge il plugin solo con una variabile
  d'ambiente (`MUW_WATCH=1` in `app.config.ts`); senza, la config di `main`
  è quella di oggi.

**A3 — Il telefono** (in `main`, solo JavaScript, il modulo nativo caricato
solo se c'è, come `haptics/haptics.ts`):
- `src/watch/watchLink.ts` (il ponte su `react-native-watch-connectivity`,
  niente in un'app senza), `src/watch/useWatch.ts` (manda lo stato della
  corsa da `runControl`, riceve pausa, ripresa e fine dal polso, e il
  battito), `src/watch/WatchHeart.tsx` (il battito con la zona),
  `__mocks__/react-native-watch-connectivity.ts`, test.
- File esistenti, una riga o poche: `src/screens/RunDashboard.tsx` (e
  `FreeRunScreen.tsx` se non la usa) per montare `useWatch` e mostrare il
  battito; `src/health/HealthRunEnd.tsx` o `workout.ts` per non riscrivere
  in Salute l'allenamento che l'orologio ha già salvato.

**A-flip — L'interruttore nativo** (solo alla build 1.1): `app.json` (il
plugin `@bacons/apple-targets`), `apps/mobile/package.json` e
`package-lock.json` (le due dipendenze), `app.config.ts` (via la variabile
`MUW_WATCH`). Qui l'impronta iOS cambia, ed è voluto.

**Le condizioni del Coordinatore** (2026-11-05, piano approvato):
- `RunDashboard.tsx`, `FreeRunScreen.tsx`, `src/health/` e `app.config.ts`
  oggi non li tiene nessuna PR. `src/health/` però è in fila per la 1.0.2
  (374 C, 345 C, 397 C, la lettura da Salute) e forse per TASK-400 (nuoto
  in piscina): le righe lì vanno in A3, il più tardi possibile; chi arriva
  secondo unisce `main`.
- `app.config.ts` con `MUW_WATCH=1` va bene se senza la variabile
  l'impronta iOS resta **`6f8bba4c`**: misurarla in ogni PR su una copia
  staccata e scriverla nella PR.
- `watch.yml`: filtro sui percorsi (solo `apps/mobile/targets/watch/**` e
  il workflow stesso), `timeout-minutes: 15`, `concurrency` che cancella i
  giri vecchi come in `ci.yml`. Dei minuti macOS parla il Coordinatore
  all'utente.
- A-flip solo alla build 1.1, col sì dell'utente.
- A1 parte in una sessione nuova.

## File toccati

Parte 0 (questa proposta):

```
docs/tasks/TASK-370.md (nuovo)
docs/DECISIONS.md (ADR-0314, aggiunta)
docs/STATUS.md (aggiunta)
```

Parte A: vedi «Parte A, il piano» sopra (lista mandata al Coordinatore
il 2026-11-05). Parti B–D (previsti, ognuno con la sua lista al
Coordinatore prima di partire):

```
apps/mobile/targets/watch/ (nuova: target, Swift, XCTest)
apps/mobile/src/watch/ (nuova: il ponte col telefono e i test)
apps/mobile/package.json, app.json (le due dipendenze e il plugin)
apps/mobile/App.tsx, la schermata della corsa («Send to watch», il battito)
apps/mobile/src/health/ (l'allenamento salvato dall'orologio)
apps/mobile/src/i18n/*.ts, site/privacy/ (testi e privacy, col sì)
docs/DECISIONS.md, docs/STATUS.md, docs/tasks/TASK-370.md
```

## Criteri di accettazione

- [ ] (0) Proposta in `main`, ADR-0314 «Proposto», scelte dell'utente
      registrate.
- [ ] (A) Avvio, pausa e stop dal polso e dal telefono, lo stesso stato sui
      due; il battito in tempo reale sul telefono; un solo allenamento in
      Salute.
- [ ] (B) Un percorso mandato all'orologio si corre col telefono spento:
      freccia, vibrazioni, fuori rotta e rientro come sul telefono (gli
      stessi fixture verdi in jest e XCTest); la traccia arriva al telefono
      e si salva e pubblica.
- [ ] (C) Ogni sport del registro ha i suoi numeri sull'orologio; il nuoto
      resta spento fino alla prova in acqua.
- [ ] (D) Testi e privacy approvati; build e invio col sì dell'utente.
