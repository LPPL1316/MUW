# TASK-294 — MuW su Google Play

**Stato**: In corso (parte A in `main` con la #543, `1dfc440e`; parte B in
`main` con la #548, `049102c5`; parte C in PR)
**Fase**: 4 · **Branch**: `feat/TASK-294-a-android-background` (parte A,
PR #543), `feat/TASK-294-b-play-build` (parte B, PR #548),
`feat/TASK-294-c-account-deletion` (parte C)

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

Dopo la A. `android.package` = **`app.getmuw.android`** (**scelta
dell'utente** del 2026-10-25, fra questo e il bundle iOS
`com.lppl1316.sgrava`; definitivo), `eas.json` con
`submit.production.android`, Firebase per le push (`google-services.json`
e la chiave FCM V1 solo su EAS, mai nel repository), una sezione Android
in fondo a `DEPLOY.md`, la scheda dello store, la prova in un emulatore o
su un telefono Android. Il testo della privacy su FCM (Google è un
destinatario nuovo dei dati) si scrive qui per il sì dell'utente; i file
di `site/privacy/` entrano dopo la #461, insieme a TASK-284 B.

**Prima build Android, 2026-10-26**: la `preview` (EAS `93c8959c`, da
`main` `23fd4e6b`, keystore creata da EAS) è fallita in Gradle su
`react-native-google-mobile-ads` (vuole una sezione sua in `app.json`).
Correzione in `fix/TASK-294-android-build-no-admob`: AdMob mai collegato
su Android (aggiunta ad ADR-0237), test aggiornato; impronta iOS
invariata (`b8988669` nel worktree, prima e dopo). Il log di una build EAS
si legge così: `eas build:view <id> --json` dà `logFiles` (URL firmati,
15 minuti), il file è compresso **brotli** (`brotli -d`), una riga JSON
per voce. `expo doctor` segnala patch mancanti (expo ~57.0.31 e altri):
non bloccano la build.

**Promemoria (Coordinatore, 2026-10-25)**: i contatti della #461
(TASK-262 C) entrano **senza** il modulo nativo: `expo-contacts` sta in
`expo.autolinking.exclude` di `apps/mobile/package.json` e il suo plugin
non è in `app.json` (scelta dell'utente del 2026-10-25), così l'impronta
iOS resta `83793e26`. Nella prima build Android i contatti restano
nascosti (`contactsAvailable()` falso), a meno di togliere l'esclusione
solo per Android e rimettere il plugin. **Va chiesto all'utente** se li
vuole già nella prima build Android. **Risposta dell'utente del
2026-10-25: «No, più avanti»**: la prima build Android resta senza
rubrica, che arriva poi con un aggiornamento insieme a quella dell'iPhone.
Quando entrerà: l'esclusione solo per iOS
(`expo.autolinking.ios.exclude`), il plugin e `READ_CONTACTS` fra le voci
di `ANDROID_ONLY` in `fingerprint.config.js`; attenzione, anche i file del
plugin caricato entrano nell'impronta di ogni piattaforma
(`expoConfigPlugins`), quindi l'impronta iOS va rimisurata prima della PR,
e i contatti vanno dichiarati in «Sicurezza dei dati» con l'avviso in app
che Google chiede.

*Aggiunta (TASK-321 B, 2026-10-30, col sì del Coordinatore):*
`androidFingerprint.test.ts` si aspetta ora anche `READ_CONTACTS` e
`WRITE_CONTACTS`, che il plugin `expo-contacts` mette nella configurazione
con la 1.0.1. `WRITE_CONTACTS` è bloccato con `android.blockedPermissions`.

### Parte C — La pagina per cancellare l'account (ADR-0253)

Dopo la B. Solo file nuovi, `site/account-deletion/` nelle cinque lingue
con un test; testi approvati dall'utente; la pubblicazione su getmuw.app è
un intervento sul server, con il sì dell'utente.

**Fatto il 2026-10-26**: `site/tools/account_deletion_text.mjs` (i testi,
cinque lingue), `site/tools/make_account_deletion.mjs` (il generatore,
sul modello di `make_support.mjs`), le pagine generate in
`site/account-deletion/` e `site/tests/account-deletion.test.mjs`. La
pagina nomina l'app e lo sviluppatore, dà i passi nell'app («Profile» ›
«Settings» › «Delete account», con i nomi dei bottoni di ogni lingua), la
via senza app (email a muw2610@gmail.com dall'indirizzo dell'account,
**entro 30 giorni**: promessa nuova, **confermata dall'utente** il
2026-10-26 insieme ai testi della pagina), cosa
si cancella, i 13/14 giorni delle copie, cosa resta e come cancellare solo
una parte: tutto dalla privacy. `docs/DEPLOY.md` F.14: la riga del
`git archive` copia anche `site/account-deletion` (la #502 e la #525 sono
in `main`). Nella Play Console l'URL di cancellazione è per ora la privacy
(Google controlla che risponda): da cambiare in
`https://getmuw.app/account-deletion/` appena la pagina è online.

**Nella Play Console il 2026-10-26** (dall'agente in Chrome, salvo dove
detto): app creata (id `4972971737368438830`, l'utente ha spuntato le
dichiarazioni e premuto «Crea app»); privacy; annunci: no; categoria
Salute e fitness; contatti; scheda dello store (testi di Apple, icona,
immagine in evidenza, cinque screenshot 1320×2640, asset non etichettati
AI); App governative: no; Funzionalità finanziarie: nessuna; ID
pubblicità: no; Salute: attività fisica; Dettagli di accesso (credenziali
dell'utente); Sicurezza dei dati (nessun dato condiviso; posizione, email,
ID utente, telefono, bio, foto, fitness, interazioni, ricerche, contenuti
degli utenti, ID dispositivo; corretta la posizione che l'utente aveva
messo come temporanea e con tutti gli scopi); pubblico di destinazione e
classificazione dei contenuti compilati dall'utente. «Contenuti app» non
ha più niente in sospeso.

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

Parte B:

```
apps/mobile/app.json                       (solo `android.package`)
apps/mobile/app.config.ts                  (googleServicesFile da EAS)
apps/mobile/eas.json                       (submit.production.android)
apps/mobile/__tests__/androidPlayConfig.test.ts    (nuovo)
apps/mobile/__tests__/androidFingerprint.test.ts   (il package c'è davvero)
docs/DEPLOY.md                             (sezione G in fondo)
docs/DECISIONS.md                          (ADR-0253)
docs/STATUS.md                             (righe aggiunte)
docs/tasks/TASK-294.md
```

Parte C: `site/account-deletion/` (nuova), questo file.

## Fuori scope

- La musica che si abbassa mentre la voce parla, su Android.
- Le pubblicità su Android: arrivano con la società, come su iOS.
- Il tablet Android.
