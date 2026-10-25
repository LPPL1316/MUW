# TASK-152 — Sgrava sull'App Store

**Stato**: In lavorazione · parte A fatta (profilo `production`, ADR-0233);
parte B (ambiente `production`, prima build) in corso
**Fase**: 4 · **Branch**: `feat/TASK-152-app-store` (parte A:
`feat/TASK-152-a-production-profile`)
**Dipende da**: TASK-132 (AdMob nell'app), API raggiungibile con HTTPS
(server Hetzner, TASK-122) · **Serve prima di**: TASK-153 · In parallelo
con TASK-150

## Obiettivo

Sgrava si scarica dall'App Store, prima con TestFlight e poi per tutti. La
scheda dello store ha un sito dello sviluppatore e un'informativa sulla
privacy, così AdMob può verificare l'app (TASK-153).

## Contesto da leggere

- `docs/DECISIONS.md` ADR-0078 (EAS Update ed Expo Go), ADR-0102 (AdMob)
- `docs/tasks/TASK-132.md` «Seguiti» (UIScene con l'SDK iOS 27)
- `docs/tasks/TASK-110.md` «Esito», ultima voce: il testo della privacy
  pubblicato a un indirizzo
- `docs/DEPLOY.md` A.6 (pubblicare con EAS)

## Domande per l'utente (prima di partire, una per volta)

1. **Account Apple Developer** (99 $ l'anno): individuale o organizzazione?
   Un'organizzazione chiede una ditta e il numero D-U-N-S. Il nome del
   venditore sullo store è quello del titolare. Va d'accordo con la scelta
   di TASK-150.
2. **Commerciante («trader») per la UE**: Apple chiede di dichiararlo per
   distribuire in Europa. Un'app con pubblicità lo è probabilmente; in quel
   caso indirizzo, telefono ed email del titolare si vedono sullo store.
3. **Il sito dello sviluppatore**: un dominio proprio (circa 10 € l'anno) o
   un indirizzo del server Hetzner? AdMob cerca `app-ads.txt` alla radice
   del dominio scritto nella scheda dello store.
4. **Il nome sullo store** e sotto l'icona: «Sgrava» o «ShapeRoute»? Oggi
   `app.json` dice «ShapeRoute» e l'app mostra «Sgrava».
5. **Solo iPhone o anche Android?** Google Play costa 25 $ una volta. Se sì,
   Android diventa un task a parte.

**Risposte** (2026-10-08):

1. **Persona fisica**, come AdMob (TASK-150). L'utente si è iscritto con
   il suo Apple ID il 2026-10-08. Quando aprirà una società vuole passare
   a organizzazione: si fa da developer.apple.com/account, «Membership» →
   «Switch to organization membership», con il numero D-U-N-S della
   società (gratuito, da Dun & Bradstreet); Apple può chiedere documenti
   e la verifica dura fino a circa tre settimane. L'app resta nello
   stesso account, cambia solo il nome del venditore.
2. **Non commerciante («non-trader») UE, per ora** (2026-10-09). Prima
   l'utente aveva detto «sì commerciante» perché voleva gli annunci veri
   da subito; poi ha scelto di **lanciare senza pubblicità** e, richiesto
   esplicitamente con il nuovo quadro (app gratuita e senza annunci,
   nessun dato personale pubblico sullo store), ha risposto «sì, non
   commerciante per ora». Quando arrivano gli annunci (TASK-153) si passa
   a commerciante su App Store Connect, Business → Digital Services Act;
   con la società, con i dati della società (risposta 1). La società la
   apre dopo i primi ~300 € di guadagno.
3. **`getmuw.app`**, dominio proprio (TASK-265, ADR-0234): il sito è
   online lì, l'API su `api.getmuw.app`.
4. **«MuW»** (TASK-260, ADR-0224). Se il nome è già preso sull'App
   Store lo si scopre quando si crea la scheda.
5. **Solo iPhone per ora; Android dopo**, come task a parte (2026-10-10,
   «per ora per iphone poi pubblichiamo per google»). Anche niente iPad:
   `supportsTablet: false`, così su iPad l'app gira come app per iPhone e
   Apple non chiede screenshot né prove su iPad.

## Cosa fare

1. L'utente si iscrive all'Apple Developer Program e accetta i contratti
   (lo fa l'utente, con le sue credenziali).
2. **Sito**: una pagina con informativa sulla privacy e contatti. La
   privacy dice cosa raccoglie l'app e perché: posizione per il percorso,
   richieste all'API, dati raccolti da AdMob, consenso, come cancellarli.
   Il posto per `app-ads.txt` è pronto; il contenuto arriva in TASK-153.
3. **Build per lo store**: profilo `production` in `eas.json`. Prima di
   toccare `runtimeVersion` e canali, decidere come convivono Expo Go
   (canale `preview`, ADR-0078) e la build dello store, e scriverlo in
   un ADR. **Fatto nella parte A** (ADR-0233, `DEPLOY.md` A.7).
4. **SDK richiesto da Apple**: controllare quale Xcode accetta oggi App
   Store Connect. Se serve l'SDK iOS 27, fare il seguito UIScene di
   TASK-132 (`ExpoAppSceneDelegate`) con un config plugin, non a mano.
5. **Testi dei permessi** in `app.json`: posizione e foto in inglese, come
   gli altri testi dell'app.
6. **Etichette privacy** dell'App Store: seguire la guida di Google per i
   dati di AdMob. Nessuna richiesta ATT (ADR-0102).
7. **Scheda**: screenshot, descrizione, categoria (Salute e fitness), età,
   URL della privacy e del sito.
8. **TestFlight**: build sull'iPhone dell'utente e degli amici. Prova:
   percorso, navigazione, GPX, annuncio di prova di Google.
9. Revisione di Apple. Il rifiuto o l'approvazione si scrivono qui.

## Criteri di accettazione

- [ ] Le cinque domande hanno una risposta dell'utente, scritta qui.
- [ ] La pagina della privacy è pubblicata a un indirizzo HTTPS.
- [ ] Una build `production` è su TestFlight e si apre sull'iPhone
      dell'utente: percorso, navigazione, GPX e annuncio di prova funzionano.
- [ ] La scheda dell'App Store ha il sito dello sviluppatore e l'URL della
      privacy.
- [ ] Inviata alla revisione di Apple; l'esito è scritto qui.
- [ ] Expo Go sul canale `preview` funziona come prima (ADR-0078).

## File toccati

```
apps/mobile/app.json
apps/mobile/eas.json
apps/mobile/app.config.ts          (nuovo, parte A)
apps/mobile/fingerprint.config.js  (nuovo, parte A)
apps/mobile/__tests__/appConfig.test.ts  (nuovo, parte A)
apps/mobile/store.config.json      (nuovo, parte B: testi della scheda)
apps/mobile/store/                 (nuovo, parte B: screenshot della scheda)
docs/DEPLOY.md
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-152.md
```

## Fuori scope

- Gli ID veri di AdMob, il contenuto di `app-ads.txt`, il consenso GDPR:
  TASK-153.
- Pagamenti e fisco: TASK-150.
- Android e Google Play: un task a parte, se l'utente lo chiede.
- «Sign in with Apple» e la parte social.

## Esito

*(si compila a fine task)*

**Parte A — il profilo `production` (2026-10-08, ADR-0233)**. Chiesta
dall'utente prima dell'App Store; numero e ADR dal Coordinatore. In
`main` con la PR #446 (merge `9dcacbf4`); niente da pubblicare, `preview`
non cambia.

- `eas.json`: profilo `production` (canale `production`, ambiente EAS
  `production`, `autoIncrement`, `APP_VARIANT=production`).
- `app.config.ts` (nuovo): con `APP_VARIANT=production` il runtime è
  `{policy: "fingerprint"}`; senza resta quello di `app.json`,
  `exposdk:57.0.0`. `app.json` non cambia, così Expo Go e `preview`
  restano come prima e non c'è conflitto con TASK-261 (#441), che
  tocca `app.json`.
- `fingerprint.config.js` (nuovo): fuori dall'impronta versione, numero
  di build ed `eas.json`.
- `__tests__/appConfig.test.ts` (nuovo): caricata come la carica Expo
  (`getConfig`), senza variabile la config ha `exposdk:57.0.0` e tutti i
  plugin di `app.json` (chiesto dal Coordinatore; dopo il merge di #441,
  che aggiunge un plugin, va riallineato e riprovato); la variante
  `production` cambia solo il runtime; `APP_VARIANT` solo nel profilo
  `production`. `getConfig` valuta `app.config.ts` fuori da Jest, con le
  variabili vere del processo: la variante si prova chiamando la funzione. Provato anche sul Mac con `expo-updates
  runtimeversion:resolve` (i casi sono in ADR-0233). Nessuna build e nessun `eas update`: servono
  l'account Apple e le variabili dell'ambiente EAS `production`, oggi
  vuoto (`DEPLOY.md` A.7, punti 1–2).
- **Resta per la parte che fa la prima build**, nell'ordine:
  1. le variabili dell'ambiente EAS `production` (`EXPO_PUBLIC_API_URL`,
     `EXPO_PUBLIC_API_KEY`), oggi vuoto: le scrive l'utente, o l'agente
     solo con il suo sì esplicito, **prima** della prima build
     (`DEPLOY.md` A.7, punto 1);
  2. confrontare l'impronta della build con quella del Mac (`DEPLOY.md`
     A.7, punto 4);
  3. i passi 1–2 e 4–9 di «Cosa fare» e le cinque domande.

**Parte B — l'ambiente `production` e la prima build** (in corso, dal
2026-10-08). Data dal Coordinatore a una sessione nuova dopo la parte A.

- Iscrizione all'Apple Developer Program fatta dall'utente il
  2026-10-08, come persona fisica (risposta 1 sopra).
- Ambiente EAS `production`: `EXPO_PUBLIC_API_URL=https://api.getmuw.app`
  (plaintext) messo dall'agente il 2026-10-08 con il sì esplicito
  dell'utente. `EXPO_PUBLIC_API_KEY` la scrive l'utente, visibilità
  *Sensitive*; l'agente non la legge.
- Impronta calcolata sul Mac in un worktree pulito di `main` `d2ba47c6`
  dopo un `npm ci` vero: `97c9f355eb92df016e1222cfffa8f869ff391471`
  (uguale due volte; senza variabile resta `exposdk:57.0.0`). Va
  confrontata con quella della prima build sulla sua pagina di expo.dev
  (`DEPLOY.md` A.7, punto 4); la build parte dallo stesso worktree.
- La pagina della privacy non è ancora online: `getmuw.app/privacy` dà
  404 e la home non la collega (2026-10-08). Serve per la scheda e per
  il link pubblico di TestFlight. **La fa TASK-237 parte D** (sessione
  «SITO WEB», dalla bozza dell'app con i segnaposto compilati
  dall'utente), su decisione del Coordinatore del 2026-10-08: `site/`
  esce dai «File toccati» di questo task; l'URL arriva da lì e il
  Coordinatore avvisa quando è online.
- Il link di download del sito sarà il **link pubblico di TestFlight**
  (scelta dell'utente del 2026-10-08): appena esiste va scritto al
  Coordinatore, che lo passa a TASK-237. Vuole un gruppo di tester
  esterni e la Beta App Review della prima build.
- Primo tentativo di build `production` (2026-10-08 sera, lanciato
  dall'utente dal worktree pulito): login Apple e codice a due fattori
  riusciti, poi «You have no team associated with your Apple account»,
  cioè l'iscrizione non è ancora attiva. Nessuna build creata. Effetti
  rimasti, innocui: `buildNumber` su EAS passato da 1 a 2; canale e branch
  `production` creati su EAS. La build era partita senza
  `EXPO_PUBLIC_API_KEY` (non ancora nell'ambiente): al prossimo tentativo
  controllare che la riga «Environment variables … loaded» la elenchi.
- **Prima build `production` riuscita** il 2026-10-09 (build EAS
  `4455655b-154b-4a91-98e4-fd26b3dfc8dc`, `buildNumber` 3, commit
  `d2ba47c6`, team Apple «LUCA PALLAORO (Individual)», credenziali iOS
  create da EAS). **Impronta uguale a quella del Mac**:
  `97c9f355eb92df016e1222cfffa8f869ff391471`, quindi il controllo di
  `DEPLOY.md` A.7 punto 4 alla prima build è fatto. La build però non
  ha `EXPO_PUBLIC_API_KEY` (non era ancora nell'ambiente `production`):
  senza chiave l'API risponde 401 a tutto, quindi **non va mandata a
  TestFlight**; se ne fa un'altra con la chiave.
- Versione dell'app da `0.0.0` a **`1.0.0`** in `app.json`, prima della
  build per TestFlight: è il numero che Apple mostra sullo store e che
  la versione in App Store Connect deve uguagliare. L'impronta non lo
  guarda (`fingerprint.config.js`, provato in ADR-0233) e il runtime di
  Expo Go resta `exposdk:57.0.0`. Deciso dall'agente su delega
  dell'utente.
- **Seconda build `production`**, la prima per TestFlight (2026-10-09):
  build EAS `e1166bc0-842c-46d2-b39b-9180a20e9133`, versione `1.0.0`,
  build 4, commit `9295d17a`, runtime `97c9f355…` (uguale), con
  `EXPO_PUBLIC_API_KEY` (copiata dall'utente da `preview` a `production`
  con un suo comando `env:get | env:set`; l'agente non l'ha letta).
  `--auto-submit` è fallito con «Missing submit profile in eas.json:
  production» (con `--auto-submit` il profilo si cerca per nome; `eas
  submit` senza `--profile` usa quello predefinito): inviata a parte con
  `eas submit --platform ios --id e1166bc0…`. EAS ha creato su App Store
  Connect l'app **«MuW»** (il nome era libero; ASC App ID `6820961883`),
  il gruppo TestFlight interno «Team (Expo)» con l'utente e la chiave API
  di App Store Connect (salvata su EAS). La dichiarazione sulla
  crittografia non è stata chiesta (`usesNonExemptEncryption: false` in
  `app.json`). **L'utente l'ha installata da TestFlight: «sembra
  funzionare».**
- `eas.json`: profilo `submit.production` con l'`ascAppId`, così la
  prossima build va da sola su TestFlight con `--auto-submit` (`DEPLOY.md`
  A.7 punto 2); fuori dall'impronta. Test in `appConfig.test.ts`.
- **Ordine per la build 5, quella per la revisione** (Coordinatore,
  2026-10-09): #457 (TASK-121, segnala e blocca: lo chiede la Guideline
  1.2 di Apple per i contenuti degli utenti) → #451 (notifiche push,
  nativa) → TASK-153 (annunci veri, `app-ads.txt`; sessione «PUBBLICITA»).
  TASK-262 C (rubrica) solo se pronta in tempo, altrimenti 1.0.1. **Niente
  build 5 né invio in revisione senza il via del Coordinatore.**
- **Cambio dell'utente, 2026-10-09: si lancia senza pubblicità**, gli
  annunci si fanno dopo. TASK-153 esce dalla build 5; la build dello
  store non deve mostrare l'annuncio di prova di Google che oggi compare
  a ogni ricerca (TASK-166): chi lo spegne lo decide il Coordinatore.
- **Scheda dell'App Store** (parte B, 2026-10-09/10): testi in inglese
  (en-US) **approvati dall'utente** il 2026-10-09 («testi ok») e 5
  screenshot iPhone 6,9″ (1320×2868) **approvati** il 2026-10-10
  («screeenshoot si»), in `apps/mobile/store.config.json` e
  `apps/mobile/store/screenshots/` (JPEG). Si caricano con `eas
  metadata:push` (`DEPLOY.md` A.7, punto 5). Titolo «MuW», sottotitolo
  «Draw a shape, then run it», categorie Salute e fitness + Navigazione,
  copyright «2026 Luca Pallaoro», sito `https://getmuw.app`, assistenza
  `https://getmuw.app/support/` (pagina di TASK-237), privacy
  `https://getmuw.app/privacy/`; uscita manuale dopo l'approvazione.
  Screenshot dall'app vera (`preview` in Expo Go, senza il pulsante di
  Expo Go, ora 9:41) su un simulatore iPhone 18 Pro Max, a Trento: cuore
  di 5 km, corsa con la navigazione (posizione simulata lungo lo stesso
  percorso chiesto all'API locale), Explore, Feed, Draw.
- **Zona di Cupertino** sul server di produzione dal 2026-10-10 03:11Z
  (Coordinatore): copre Apple Park; un cuore di 5 km da lì risponde in
  ~14 s. Rischio «il revisore negli USA non riesce a disegnare» chiuso.
- **Fa l'utente su App Store Connect** (con le sue credenziali), prima
  dell'invio: Digital Services Act → non-trader; prezzo gratis, tutti i
  paesi; Age Rating (tutto «No» tranne contenuti degli utenti) con
  l'età alzata a 16+, come i termini; Content Rights (mappe
  OpenStreetMap); App Privacy senza tracciamento né dati pubblicitari
  (AdMob tolto dalla build, TASK-267): email, telefono, nome Strava,
  dati di fitness, posizione precisa, foto, contenuti degli utenti, User
  ID e Device ID (push) collegati alla persona per il funzionamento;
  posizione approssimativa, ricerche e interazioni non collegate, per
  statistiche; un account di prova per il revisore in «App Review
  Information».
- **Note per il revisore** (da incollare in App Store Connect):
  «MuW draws a route in the shape you choose on real streets. To try it:
  open Draw, keep "My position" or pick "Another place", choose a shape
  (e.g. heart) and 5 km, tap "Draw route", then "Start". Near Apple Park
  a 5 km heart takes about 15 seconds. Location: the app asks for
  location only while in use; during a run the user started, it keeps
  recording the track with the screen locked (blue indicator) until the
  run is stopped. Background audio: turn-by-turn voice guidance during a
  run or ride, with the screen locked. Feed, comments and profile need an
  account: use the demo account below. Users can report a drawing or a
  comment and block a person.» La riga sull'audio vale
  solo se TASK-261 B entra nella build 5; quella su segnala e blocca
  quando #457 è in main.
- `store.config.json` ha anche `"version": "1.0.0"`: senza, `eas metadata:push`
  manderebbe ad Apple un numero di versione vuoto insieme al copyright;
  con, la versione in preparazione su App Store Connect prende lo stesso
  numero della build (Apple accetta per una versione solo le build con
  quel numero). Il test in `appConfig.test.ts` la tiene uguale a
  `app.json`: a ogni nuova versione si cambiano tutti e due.
- 2026-10-10: su richiesta dell'utente («falla generica») la descrizione
  diventa una versione più corta e generica degli stessi testi (487
  caratteri, stesse funzioni, niente numeri di chilometri); parole chiave
  invariate. L'utente ha pubblicato le etichette App Privacy su App Store
  Connect (12 tipi di dati, nessun tracciamento).
- **`eas metadata:push` fatto dall'utente** (2026-10-10, da main
  `87bddb62`): versione su App Store Connect rinominata 1.0.0, testi
  en-US, categorie e i 5 screenshot caricati (chiave API di EAS, nessun
  login). Età, privacy e dati per la revisione inseriti a mano.
- **Build 5, quella per la revisione** (2026-10-10, lanciata dalla
  sessione «Indicazioni durante la corsa» su richiesta dell'utente, via
  del Coordinatore): build EAS `e449944f-bcf4-4b4f-94c2-81a21a1e5318`,
  versione 1.0.0, build 5, commit `793fa112` (worktree pulito con
  `npm ci`), runtime `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3`, uguale
  all'impronta del Mac. Contiene segnala e blocca, notifiche push, voce a
  telefono bloccato, tour iniziale, niente AdMob, solo iPhone. Con il
  login Apple dell'utente: capability Push Notifications sull'App ID,
  profilo `XHB94SGSJ9` aggiornato, chiave APNs creata da EAS. Caricata
  da sola su TestFlight (`--auto-submit`). Server pronto: migrazioni
  0020 e 0021 con l'ok dell'utente, zona di Cupertino.
- **L'utente l'ha provata da TestFlight** («provata, funziona tutto»), il
  Coordinatore ha dato l'ok, e l'utente l'ha **inviata in revisione** il
  2026-10-10: build 5 nella versione 1.0.0, note per il revisore (Apple
  Park, posizione e audio in background, push da attivare in Settings,
  account di prova che segue un account con disegni pubblicati),
  dichiarazione «non è un dispositivo medico», uscita manuale dopo
  l'approvazione. **Resta**: l'esito di Apple (si scrive qui), poi
  «Release This Version» dell'utente; nessun `eas update` sul canale
  `production` senza il via del Coordinatore.
- **2026-10-11: Apple ha risposto «Guideline 2.1 – Information Needed»**
  (account nuovo): video dall'iPhone, scopo, servizi esterni. Preparati
  la build 7 (stessa impronta della 5), il video tagliato
  (`out/MuW-review-video.mp4`) e la risposta (`out/apple-reply-text.txt`);
  TASK-275 ha aggiunto la segnalazione dei commenti. **L'utente ha
  rimandato la 1.0.0 (7) con video e Notes, entro il 2026-10-15, ed è
  in attesa del verdetto.** Fino al verdetto: niente server né motore.
- **2026-10-25: promemoria per la prossima build iOS (1.0.1)**. Con la
  #461 (TASK-262 C, scelta «c» dell'utente) i contatti sono in `main`
  ma **fuori dalle build native**: `expo-contacts` sta in
  `expo.autolinking.exclude` di `apps/mobile/package.json` e il suo
  plugin non è in `app.json`, così l'impronta iOS resta `83793e26…` e la
  1.0.0 (7) riceve ancora gli `eas update`; nella 1.0 «Find friends from
  contacts» non si vede (`contactsAvailable()` è falso). **Alla build
  1.0.1**: togliere `expo-contacts` dall'esclusione, rimettere il plugin
  e il testo del permesso in `app.json` (vedi `tasks/TASK-262.md`),
  misurare l'impronta nuova e provare la rubrica sull'iPhone prima
  dell'invio ad Apple. Per Android la stessa riga è in `tasks/TASK-294.md`
  (prima build senza contatti, scelta dell'utente «No, più avanti»).
