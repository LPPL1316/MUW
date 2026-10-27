# TASK-304 — La corsa continua mentre si usa un'altra app

**Stato**: Done
**Fase**: 4 · **Branch**: `feat/TASK-304-run-survives-camera`
**ADR**: ADR-0264 (numero riservato dal Coordinatore, sessione
local_e57a8224, il 2026-10-25)

## Obiettivo

Una corsa va avanti mentre chi corre usa un'altra app (la fotocamera per
una foto): MuW pesa meno in background, il file della corsa è sempre
aggiornato, e un'assenza fino a 10 minuti, anche se iOS ha chiuso l'app,
è corsa: tempo contato e linea unita, senza toccare niente.

## Origine

La prova sul campo dell'utente a Trento, 2026-10-25: uscito da MuW per una
foto con la fotocamera, al rientro l'attività «era ripartita da zero o si
era interrotta». Dalla stessa prova vengono TASK-302 (svolte unite) e
TASK-303 (rientro dopo una deviazione).

## Diagnosi

Risposte dell'utente in chat (2026-10-26):

1. La prova era con **MuW da TestFlight/App Store**, non con Expo Go.
2. Al rientro ha visto **la corsa in pausa**; non ricorda se tempo, km e
   linea fossero quelli di prima.

Cosa dicono il codice e le pubblicazioni:

- Su TestFlight c'è la **1.0.0 (7)**, fatta da `26990fd4` il 2026-10-11,
  con la stessa impronta della 5 (`83793e26…`). È stata tagliata **prima
  di TASK-272** (#492), e il canale `production` **non ha mai ricevuto un
  aggiornamento** (`eas update:list --branch production` è vuoto). Il JS
  dell'iPhone è quello di `26990fd4`: GPS in background sì (TASK-261),
  riapertura in pausa no.
- In quella build, se iOS chiude MuW, all'apertura l'app mostra la
  **fine della corsa** («Your run», `leftRun()` in `App.tsx`), non la
  corsa in pausa. Quindi a Trento **MuW non è stata chiusa**: era viva in
  background, con il GPS acceso.
- Con l'app viva, «Paused» viene da una sola cosa che l'utente non ha
  premuto: la **pausa automatica da fermi** (`AUTO_PAUSE_AFTER_MS`, 10 s
  senza una posizione nuova). Fermi per la foto, la corsa va in pausa da
  sola e la voce dice «Paused»; riparte da sola al primo passo. Tornati in
  MuW ancora fermi, si vede la corsa in pausa: è la causa più probabile di
  quello che l'utente ha visto. Il tempo da fermi non conta, per scelta
  (ADR-0137).
- Il rischio vero resta, ed è peggiore nella 1.0: la fotocamera è pesante
  e iOS può **chiudere MuW per memoria**. Con il solo «While using» iOS non
  la rilancia: il GPS si ferma fino al rientro. Nella 1.0 la corsa si
  apre allora sulla sua fine e non si può continuare; in `main`
  (TASK-272) si riapre in pausa, con al più 15 s di punti persi
  (`SAVE_EVERY_MS`) e l'assenza come pausa.
- Se invece iOS **congela** l'app (succede col GPS solo in primo piano, o
  di rado col GPS in background), oltre 60 s di assenza sono una pausa e
  la linea riparte senza riga dritta (ADR-0219).

Le correzioni di questo task arrivano sull'iPhone solo con un `eas update`
sul canale `production` o con la prossima build: lo decide il
Coordinatore. L'impronta iOS non cambia (sotto).

## Scelte dell'utente

- **2026-10-26**, alla domanda su cosa fare al rientro dopo una chiusura:
  «deve continuare a registrare la corsa anche mentre si usa un'altra
  app, magari un ragazzo vuole solamente fare una foto mentre corre».
  Alla proposta che ne è seguita, **«Sì, così»**: al rientro la corsa
  riparte da sola, il tempo dell'assenza conta e un tratto dritto unisce
  l'ultimo punto al nuovo; lo stesso quando iOS congela l'app; vale per
  assenze **fino a 10 minuti**, oltre resta in pausa con «Resume». La
  pausa da fermi (10 s) resta com'è. Cambia ADR-0219 (60 s → 10 minuti) e
  ADR-0240 (riapertura in corsa entro 10 minuti).
- **2026-10-26**: farla **subito, in parallelo a TASK-303**, con il merge
  comunque dopo 302 e 303.

## Contesto da leggere

- `docs/DECISIONS.md` ADR-0219 (punto 2), ADR-0225, ADR-0240, ADR-0137
- `docs/UI.md` «La corsa…»: il paragrafo su GPS in background e
  assenze, «La corsa interrotta si riapre in pausa»
- `docs/tasks/TASK-272.md`
- `apps/mobile/src/navigation/trackStore.ts`, `trackRecorder.ts`,
  `runControl.ts`, `runAway.ts`, `runPosition.ts`; `src/map/MapView.tsx`

## Cosa fare

1. **Salvataggio subito**: quando l'app lascia il primo piano
   (`AppState`) il file della corsa si scrive subito, se c'è qualcosa di
   nuovo; finché l'app resta dietro, a ogni posizione tenuta.
2. **App più leggera in background**: mentre una corsa è in corso e l'app
   è in background, la WebView della mappa non c'è; al rientro torna, con
   percorso, traccia e posizione. Memoria misurata nel simulatore prima e
   dopo.
3. **Assenza fino a 10 minuti = corsa** (`AWAY_AFTER_MS`): con l'app
   congelata o col GPS solo in primo piano, una posizione che arriva entro
   10 minuti dall'ultima si unisce alla linea e il tempo conta; oltre,
   pausa e tratto nuovo come prima.
4. **Riapertura**: una corsa che il file dà `running`, con l'ultima
   posizione da non più di 10 minuti, si riapre **in corsa** e la prima
   posizione si unisce alla linea con la stessa regola; più vecchia (fino
   a 2 ore) si riapre in pausa come oggi. La pausa da fermi non scatta
   appena riaperta: conta da quando la corsa è ripresa.
5. ADR-0264, `UI.md`, test, prova nel simulatore con una build nativa.

## Criteri di accettazione

- [x] Con una corsa in corso, l'app che passa a «background» o
      «inactive» scrive il file subito; dietro, ogni posizione tenuta lo
      riscrive; in primo piano resta ogni 15 s.
- [x] Una chiusura simulata subito dopo il passaggio in background ritrova
      nel file la stessa traccia che c'era in memoria.
- [x] Una posizione che arriva 9 minuti dopo l'ultima, con l'app via, si
      unisce alla linea (metri e tempo contati); una dopo 11 minuti
      comincia un tratto nuovo e quei minuti sono una pausa.
- [x] Riaperta entro 10 minuti dall'ultima posizione, la corsa è in corsa
      (niente «Paused»), e la prima posizione si unisce; riaperta più
      tardi, in pausa con «Resume» come prima; una pausa di chi corre o
      della penna aperta alla chiusura resta com'era, una da fermi resta
      da fermi (il primo passo la chiude).
- [x] Riaperta in corsa, la pausa da fermi scatta solo dopo 10 s da quando
      la corsa è ripresa.
- [x] Con una corsa in corso e l'app in background, la mappa non ha la
      WebView; al rientro torna e riceve di nuovo percorso e traccia. Senza
      corsa la mappa resta com'è.
- [x] Memoria misurata nel simulatore (build nativa) prima e dopo;
      `simctl terminate` dopo il background e rilancio: file letto e
      screenshot.
- [x] Impronta iOS `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3` invariata
      su una copia pulita con `npm ci`; nessuna dipendenza nuova, niente
      `app.json`, nessun testo nuovo.
- [x] `npm run lint`, `typecheck`, `test`, `format:check` verdi.

## File toccati

```
apps/mobile/src/navigation/trackStore.ts
apps/mobile/src/navigation/runControl.ts
apps/mobile/src/navigation/runBehind.ts                (nuovo)
apps/mobile/src/map/MapView.tsx
apps/mobile/src/navigation/runSurvives.test.ts         (nuovo)
apps/mobile/src/map/MapViewBehind.test.tsx             (nuovo)
apps/mobile/src/navigation/trackStore.test.ts
apps/mobile/src/navigation/reopenRun.test.ts
apps/mobile/src/navigation/backgroundRun.test.ts
apps/mobile/src/navigation/useFreeRun.test.ts
apps/mobile/__tests__/AppReopenRun.test.tsx
apps/mobile/__tests__/AppFreeRun.test.tsx              (aggiunto, chiesto al Coordinatore)
docs/UI.md
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-304.md                                 (nuovo)
```

Approvati dal Coordinatore il 2026-10-26, con tre condizioni (il tratto
mancante è una linea dritta, mai più lunga del vero; la mappa torna
com'era; salvataggio e Strava invariati, mai un invio doppio). Nella lista
approvata c'erano anche `trackRecorder.ts` e `runControl.test.ts`: non è
servito toccarli. `AppFreeRun.test.tsx` è in più: il suo test della corsa
senza percorso riaperta chiudeva l'app 60 s prima, e con la regola dei 10
minuti ora riparte in corsa; portato a 15 minuti, più un test nuovo per la
riapertura entro 10 minuti. Chiesto al Coordinatore il 2026-10-26.

## Fuori scope

- Il permesso «Always» o un rilancio di MuW da parte di iOS dopo una
  chiusura: escluso in TASK-261; qualunque cosa nativa (`app.json`,
  modalità in background, moduli) toglierebbe la 1.0 dagli aggiornamenti.
- `useNavigation.ts`, `NavigateScreen.tsx`, `navigator.ts` (TASK-302,
  TASK-303).
- Pubblicare su `production`: lo decide il Coordinatore.
- Una riga che dica «la corsa era stata interrotta» (testo nuovo).
- La pausa da fermi durante la foto: resta com'è (ADR-0137).

## Verifica nel simulatore (2026-10-26)

Build nativa Release (Xcode 27, iOS 27, iPhone 17), fatta da una copia
pulita di `main` con `npm ci` e le due patch locali di sempre (scene
lifecycle, `EXUpdatesEnabled` spento), poi ricompilata con le quattro
sorgenti di questo task. Permesso «While using» soltanto. Nel file della
corsa una corsa `running` lungo un percorso di 2 km a Trento, 500 m fatti,
l'ultima posizione 15 minuti prima; «Resume», poi il GPS simulato a 3,3
m/s lungo il percorso; il background con `simctl launch … Preferences`, la
chiusura da iOS con `simctl terminate`, il rilancio dopo 20 s. Memoria come
footprint di MuW e dei processi WebKit del simulatore:

| | MuW | WebContent | GPU | Rete | Totale |
|---|---|---|---|---|---|
| Prima, davanti | 67 MB | 151 MB | 21 MB | 11 MB | 250 MB |
| Prima, in background | 67 MB | 84 MB | 20 MB | 11 MB | 182 MB |
| Dopo, davanti | 66 MB | 141 MB | 18 MB | 10 MB | 235 MB |
| Dopo, in background | 63 MB | — | — | 10 MB | 73 MB |

- **Prima** (`main`): in background il file si scriveva ogni 15 s (l'ultima
  posizione nel file fino a 15 s vecchia); chiusa e riaperta, la corsa era
  in pausa con «Resume» a 1,04 km (screenshot
  `out/TASK-304/before-reopened.png`, fuori dal repository).
- **Dopo**: in background il file si scrive a ogni posizione (mai più
  vecchio di 2 s) e i processi WebContent e GPU della mappa non ci sono:
  circa 110 MB in meno. Chiusa con 900 m nel file e riaperta 20 s dopo, la
  corsa va avanti da sola («Pause», niente «Paused»): le 91 posizioni di
  prima uguali, la prima nuova 31 s dopo l'ultima e unita alla linea, senza
  pause né tratti nuovi; 1,04 km sullo schermo, poi 1,21 km. Tornata davanti
  dopo un background senza chiusura, la mappa c'è di nuovo con percorso,
  parte fatta e posizione.

## Esito

La corsa continua mentre si usa un'altra app: in background il file è
sempre aggiornato e la mappa non pesa (circa 110 MB in meno nel
simulatore); un'assenza fino a 10 minuti, anche con MuW chiusa da iOS e
riaperta, è corsa, con tempo contato e tratto dritto; oltre, pausa come
prima (ADR-0264, scelta dell'utente). La diagnosi della prova a Trento:
build 7 senza TASK-272, MuW viva, pausa da fermi durante la foto. Le
correzioni arrivano sulla 1.0 solo con un aggiornamento su `production` o
con la prossima build (impronta invariata): lo decide il Coordinatore.
Merge dopo la #565 (TASK-303), che tocca anche `MapView.tsx`.
