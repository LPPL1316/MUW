# TASK-294 — MuW su Google Play

**Stato**: In corso (parte A)
**Fase**: 4 · **Branch**: `feat/TASK-294-a-android-background` (parte A),
`feat/TASK-294-b-play-build` (parte B), la parte C ne avrà uno suo

## Obiettivo

MuW si scarica da Google Play, e su Android una corsa registra, parla e
si mette in pausa da sola anche a schermo bloccato, come sull'iPhone.

## Contesto

Chiesto dall'utente il 2026-10-23 («aiutami a pubblicare l'app su
playstore»). Era la domanda 5 di TASK-152, chiusa il 2026-10-10 con «per
ora per iPhone, poi pubblichiamo per Google»: Android task a parte.
Numero TASK-294 dato dal coordinatore il 2026-10-23: la parte A è
un'aggiunta ad ADR-0225 (TASK-261), le parti B e C sono ADR-0253.

**Scelta dell'utente del 2026-10-23**: il GPS e la voce a schermo bloccato
su Android si fanno **prima** del test chiuso di Google («Sì, prima del
test»), non dopo.

Cosa c'era il 2026-10-23 (`main` a `336535a7`):

- L'app non è mai stata costruita né provata su Android; su questo Mac non
  ci sono l'SDK Android né Java.
- `runPosition.ts`: il GPS in background solo su iOS; su Android
  `watchPositionAsync`, solo in primo piano. A schermo bloccato la corsa
  non registrava niente.
- `app.json` senza `android.package`; `eas.json` con l'invio solo per iOS;
  le push su Android senza Firebase (FCM).
- La build Android di produzione è già senza AdMob:
  `react-native.config.js` toglie il pacchetto anche da Android con
  `APP_VARIANT=production` (TASK-267, ADR-0237; `storeWithoutAds.test.ts`).

**Cosa dicono le fonti** (verificate il 2026-10-23 nel codice di
`node_modules`):

- expo-location 57.0.19, `LocationModule.kt` `startLocationUpdatesAsync`:
  con `foregroundService` (titolo e testo della notifica) parte un
  servizio in primo piano che **non** chiede il permesso in background
  («user-initiated foreground service with notification»); serve solo il
  permesso in primo piano, più `FOREGROUND_SERVICE` e
  `FOREGROUND_SERVICE_LOCATION` nel manifest, che il plugin aggiunge con
  `isAndroidForegroundServiceEnabled`. Il servizio deve partire con l'app
  davanti (`ForegroundServiceStartNotAllowedException`).
- React Native 0.86, `JavaTimerManager.kt`: con l'Activity in pausa i
  timer JS si fermano (`isPaused && !isRunningTasks`), mentre gli eventi
  nativi, come le posizioni del task, arrivano lo stesso. A schermo
  bloccato il conto alla rovescia, la pausa automatica e il controllo del
  congelamento di `runAway.ts` non scattano.
- @expo/fingerprint 0.20.13, `sourcer/Expo.js`: l'impronta di **ogni**
  piattaforma legge tutta la configurazione (`expoConfig`), anche il
  blocco `android`, le opzioni dei plugin e i permessi che i plugin
  aggiungono. Misurato: `android.package` da solo sposta l'impronta iOS.
- Google Play, account personale nuovo: test chiuso con almeno 12 tester
  per 14 giorni prima della produzione (`DEPLOY.md` F.10); una pagina web
  per chiedere la cancellazione dell'account; la dichiarazione del
  servizio in primo piano di tipo «location», con un video.

## Cosa fare

### Parte A — GPS e voce a schermo bloccato su Android (aggiunta ad ADR-0225)

1. `app.json`, plugin `expo-location`: `isAndroidForegroundServiceEnabled`
   e l'icona della notifica (`assets/android-icon-monochrome.png`, quella
   delle push). Niente `ACCESS_BACKGROUND_LOCATION`: resta «While using».
2. `fingerprint.config.js`: le impostazioni solo Android fuori
   dall'impronta iOS e dentro quella Android (`fileHookTransform`).
   L'impronta iOS della build 7 (`83793e26…`) non deve cambiare.
3. `runPosition.ts`: su Android il task di TASK-261 parte in un servizio
   con la sua notifica, `killServiceOnDestroy` (l'app chiusa a mano chiude
   il GPS; la corsa riapre in pausa, TASK-272).
4. `runAway.ts`: su Android con il GPS in background un battito in ritardo
   è lo schermo spento, non un congelamento.
5. `runControl.ts`: su Android, a ogni posizione, quello che l'orologio
   doveva fare e non ha fatto: la fine del conto alla rovescia, la pausa
   per fermo dal momento in cui spettava. Su iOS niente cambia.
6. La voce: nessun codice. Le indicazioni partono dalle posizioni, non dai
   timer, e con il servizio acceso l'app resta viva. La musica di un'altra
   app **non** si abbassa su Android: expo-speech non chiede il focus
   audio, e farlo vorrebbe codice nativo o una dipendenza nuova.
7. I testi della notifica in cinque lingue, **approvati dall'utente** il
   2026-10-23 («Sì, vanno bene»): «MuW is recording your activity» /
   «It keeps going with the screen locked, voice included.»; in italiano
   «MuW sta registrando la tua attività» / «Continua anche a schermo
   bloccato, voce compresa.»

**Impronte misurate** il 2026-10-23 in un worktree pulito con `npm ci`
(`APP_VARIANT=production npx expo-updates fingerprint:generate`):

| | iOS | Android |
|---|---|---|
| `main` `336535a7` | `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3` (= build 7) | `63872a2b56c024a5e02a49e04e17c821c8aabfcb` |
| con la parte A | `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3` | `8e141f2d4fcefcea2e449aeefd59ffbd2fd8c51d` |
| con la parte A e `android.package` | `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3` | — |

Senza `fingerprint.config.js` nuovo, `android.package` da solo spostava
l'impronta iOS (misurato nel worktree della parte A).

### Parte B — Build e invio a Google Play (ADR-0253)

Dopo la A. `android.package` (proposta `com.lppl1316.sgrava`, uguale a
iOS: **scelta dell'utente**, definitiva), `eas.json` con
`submit.production.android`, Firebase per le push (`google-services.json`
e la chiave FCM V1 solo su EAS, mai nel repository), una sezione Android
in fondo a `DEPLOY.md`, la scheda dello store, la prova in un emulatore o
su un telefono Android. Il testo della privacy su FCM (Google è un
destinatario nuovo dei dati) si scrive qui per il sì dell'utente; i file
di `site/privacy/` entrano dopo la #461, insieme a TASK-284 B.

### Parte C — La pagina per cancellare l'account (ADR-0253)

Dopo la B. Solo file nuovi, `site/account-deletion/` nelle cinque lingue
con un test; testi approvati dall'utente; la pubblicazione su getmuw.app è
un intervento sul server, con il sì dell'utente.

## Criteri di accettazione

Parte A:

- [x] Su Android, con la build nativa, `watchRunPosition` usa il task in
      un servizio con la notifica; se il telefono lo rifiuta, il GPS in
      primo piano come prima (test).
- [x] Su Android a schermo spento un battito in ritardo non taglia la
      linea; in primo piano e su iOS tutto come prima (test).
- [x] Su Android il conto alla rovescia finisce e la pausa per fermo
      scatta anche senza timer, alla prima posizione dopo (test).
- [x] I test che c'erano per iOS restano verdi senza modifiche; quello per
      Android («in front, as before») è sostituito, perché descriveva
      proprio il comportamento che cambia.
- [x] L'impronta iOS della produzione è la stessa prima e dopo (tabella
      sopra); quella Android cambia (anche `androidFingerprint.test.ts`).
- [x] Testi della notifica approvati dall'utente.
- [ ] Prova su un Android vero o un emulatore (dopo la build della parte
      B): una corsa a schermo bloccato registra la linea e parla. Si fa
      con la parte B: oggi nessun telefono Android e nessun emulatore.

## File toccati

Parte A:

```
apps/mobile/app.json                       (solo il plugin expo-location)
apps/mobile/fingerprint.config.js
apps/mobile/__tests__/androidFingerprint.test.ts   (nuovo)
apps/mobile/src/navigation/runPosition.ts
apps/mobile/src/navigation/runPosition.test.ts
apps/mobile/src/navigation/runAway.ts
apps/mobile/src/navigation/runAway.test.ts
apps/mobile/src/navigation/runControl.ts
apps/mobile/src/navigation/runControl.test.ts
apps/mobile/src/i18n/{de,es,fr,it}.ts      (solo righe in fondo)
docs/tasks/TASK-294.md                     (nuovo)
docs/DECISIONS.md                          (aggiunta ad ADR-0225)
docs/STATUS.md                             (righe aggiunte)
```

Parte B (prevista): `apps/mobile/app.json` (blocco `android`),
`apps/mobile/eas.json`, `docs/DEPLOY.md` (sezione nuova in fondo),
`docs/DECISIONS.md` (ADR-0253), questo file. Parte C: `site/account-deletion/`
(nuova), questo file.

## Fuori scope

- La musica che si abbassa mentre la voce parla, su Android.
- Le pubblicità su Android: arrivano con la società, come su iOS.
- Il tablet Android.
