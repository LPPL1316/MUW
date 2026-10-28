# TASK-322 — Entrare e iscriversi con Apple e con Google

**Stato**: Todo (proposta: il sì dell'utente alle scelte di prodotto, ai
pacchetti nuovi e ai testi c'è; manca la riga della privacy)
**Fase**: 4 · **Branch**: `docs/TASK-321-sign-in-apple-google` (i
documenti), poi `feat/TASK-322-a-sign-in-api`, `feat/TASK-322-b-sign-in-app`
· **ADR**: ADR-0282

> Numeri assegnati dal Coordinatore il 2026-10-28: 322 e 0282 (321 e
> 0281 sono di «Apple Health»). Il branch dei documenti tiene il nome con
> cui è nata la PR #607.

## Obiettivo

In «Sign up» e in «Log in» si entra anche con **«Continue with Apple»**
(solo iPhone) e con **«Continue with Google»** (iPhone e Android), senza
scegliere una password; email e password restano come sono.

## Contesto

Richiesta dell'utente del 2026-10-28: «Accedere e registrarsi con Google o
Apple», poi «con google ed apple».

Oggi:

- si entra solo con email e password (ADR-0114 punto 3: «Apple e Google
  forse dopo, con una build propria»; ADR-0115 per hash e token). TASK-115
  e TASK-152 lo lasciavano fuori scope;
- `POST /accounts` iscrive (`email`, `password`, `username`, `at_least_16`,
  facoltativi `away_email` e `language`), `POST /session` fa entrare; il
  token di sessione è quello di ADR-0115 (`accounts.py`, `current_user`);
- `users.password_hash` è `NOT NULL` (migrazione 0001), e il flusso «Forgot
  password» di TASK-300 lo usa per legare il link alla password di quel
  momento (`account_email.reset_state`);
- l'app in produzione è la 1.0 (build 7): gli aggiornamenti OTA valgono
  solo finché l'impronta nativa iOS resta **83793e26**. Apple e Google
  vogliono codice nativo: arrivano con la prossima build, come
  `expo-contacts` (TASK-262 C), escluso dall'autolinking fino ad allora.

## Scelte dell'utente (2026-10-28)

Proposte dall'agente e approvate dall'utente: «Sì, la proposta va bene:
pulsanti in alto in Sign up e Log in, Apple solo su iPhone, Google su
iPhone e Android, la prima volta solo nome + «I am at least 16», stessa
email = stesso account.»

1. **Dove**: in «Sign up» e in «Log in», in alto, sopra email e password,
   «Continue with Apple» e «Continue with Google». È lo stesso tasto nelle
   due schermate: chi non ha un account lo crea, chi ce l'ha entra.
2. **Apple solo su iPhone**, Google su iPhone e Android. Su Android Apple
   vorrebbe un passaggio dal browser e un «Services ID» in più, per pochi.
3. **La prima volta, una schermata sola**: il nome utente (le regole di
   oggi) e «I am at least 16»; sotto, come in «Sign up», «Don't send me
   these emails». Email e password no: l'email la dà Apple o Google.
4. **Stessa email, stesso account**: se l'email che Apple o Google
   garantiscono è già di un iscritto con la password, si entra in
   quell'account, che da allora si apre in tutti e due i modi.

## Proposte da confermare

1. **Pacchetti nuovi** — **approvati dall'utente il 2026-10-28**: «Sì, i
   tre pacchetti vanno bene: expo-apple-authentication e
   @react-native-google-signin/google-signin nell'app, PyJWT[crypto]
   nell'API.»
   - `expo-apple-authentication` nell'app (di Expo, la versione di SDK 57);
   - `@react-native-google-signin/google-signin` nell'app, la versione
     libera su npm (con il plugin di Expo);
   - `PyJWT[crypto]` nell'API, per leggere i token di Apple e di Google e
     firmare la richiesta di revoca ad Apple (porta `cryptography`).

   Scartati: `expo-auth-session` per Google (un passaggio dal browser,
   come già scartato per Strava in ADR-0156; e Google non lo consiglia più
   su Android); verificare i token chiedendoli a Google (`tokeninfo`: una
   chiamata di rete a ogni accesso, e per Apple non esiste).
2. **I testi** dell'app: la tabella qui sotto, «Testi della parte B» —
   **approvati dall'utente il 2026-10-28**: «Sì, i testi vanno bene così,
   in tutte e cinque le lingue.»
3. **La privacy e i termini**: le tre righe qui sotto, «Privacy e termini».

## Testi della parte B (approvati il 2026-10-28)

Il tono è quello delle schermate di oggi, col «tu». Il tasto di Apple non
ha testi nostri: è `AppleAuthenticationButton` («Continue with Apple», tipo
`CONTINUE`), che Apple disegna nella lingua del telefono, come chiedono le
sue regole. Il tasto di Google lo disegniamo noi con la «G» di Google e
la sua frase ufficiale.

| Dove | en | it | de | es | fr |
|---|---|---|---|---|---|
| Tasto Google | Continue with Google | Continua con Google | Weiter mit Google | Continuar con Google | Continuer avec Google |
| Fra i tasti e l'email | or | oppure | oder | o | ou |
| Titolo della prima volta | Choose your username | Scegli il tuo nome utente | Wähle deinen Benutzernamen | Elige tu nombre de usuario | Choisis ton nom d'utilisateur |
| Sotto il titolo | Your account email: {email} | Email dell'account: {email} | E-Mail deines Kontos: {email} | Correo de tu cuenta: {email} | E-mail de ton compte : {email} |
| Tasto | Create account | Crea l'account | Konto erstellen | Crear cuenta | Créer le compte |
| Tasto, mentre aspetta | Creating account… | Creo l'account… | Konto wird erstellt… | Creando la cuenta… | Création du compte… |
| Errore Apple | Signing in with Apple didn't work. Try again or use your email. | L'accesso con Apple non è riuscito. Riprova o usa la tua email. | Die Anmeldung mit Apple hat nicht geklappt. Versuch es noch mal oder nutze deine E-Mail. | No se pudo entrar con Apple. Vuelve a intentarlo o usa tu correo. | La connexion avec Apple n'a pas marché. Réessaie ou utilise ton e-mail. |
| Errore Google | Signing in with Google didn't work. Try again or use your email. | L'accesso con Google non è riuscito. Riprova o usa la tua email. | Die Anmeldung mit Google hat nicht geklappt. Versuch es noch mal oder nutze deine E-Mail. | No se pudo entrar con Google. Vuelve a intentarlo o usa tu correo. | La connexion avec Google n'a pas marché. Réessaie ou utilise ton e-mail. |

Restano come oggi, già tradotti: «USERNAME», «3 to 20 letters, digits, _
or .», «I am at least 16», la riga e la casella «Don't send me these
emails», «This username is taken. Try another one.», «No connection. Check
the network and try again.», «Cancel». Se si chiude il foglio di Apple o di
Google senza scegliere, non compare niente.

## Privacy e termini (da confermare)

Entrano con la parte B, in `about/content/*.ts` e in `site/privacy/`, nelle
cinque lingue. A Apple chiediamo solo l'email, non il nome; da Google
teniamo solo l'id e l'email, anche se ci manda nome e foto.

**1. Privacy, «Your account»**, una voce nuova dopo la password:

- en: «If you sign in with Apple or Google: the ID that Apple or Google
  gives your account and the email address they share. With Apple's «Hide
  My Email» it is an Apple address that forwards our emails to you. For
  Apple we also keep a token, only to tell Apple when you delete your
  account.»
- it: «Se entri con Apple o Google: l'identificativo che Apple o Google
  danno al tuo account e l'indirizzo email che ci condividono. Con
  «Nascondi la mia email» di Apple è un indirizzo di Apple che ti inoltra le
  nostre email. Per Apple teniamo anche un token, solo per avvisare Apple
  quando cancelli l'account.»
- de: «Wenn du dich mit Apple oder Google anmeldest: die Kennung, die Apple
  oder Google deinem Konto gibt, und die E-Mail-Adresse, die sie mit uns
  teilen. Mit Apples «E-Mail-Adresse verbergen» ist es eine Adresse von
  Apple, die unsere E-Mails an dich weiterleitet. Für Apple speichern wir
  außerdem ein Token, nur um Apple Bescheid zu sagen, wenn du dein Konto
  löschst.»
- es: «Si entras con Apple o Google: el identificador que Apple o Google
  dan a tu cuenta y la dirección de correo que comparten con nosotros. Con
  «Ocultar mi correo» de Apple es una dirección de Apple que te reenvía
  nuestros correos. Para Apple también guardamos un token, solo para avisar
  a Apple cuando borras tu cuenta.»
- fr: «Si tu te connectes avec Apple ou Google : l'identifiant qu'Apple ou
  Google donne à ton compte et l'adresse e-mail qu'ils nous partagent. Avec
  « Masquer mon adresse e-mail » d'Apple, c'est une adresse d'Apple qui te
  transfère nos e-mails. Pour Apple, nous gardons aussi un jeton, seulement
  pour prévenir Apple quand tu supprimes ton compte.»

**2. Privacy, «Others who receive data»**, una voce nuova:

- en: «Apple and Google, if you sign in with them: they see that you use
  MuW and tell us which account is yours. We keep only the ID and the email
  address.»
- it: «Apple e Google, se entri con loro: vedono che usi MuW e ci dicono
  qual è il tuo account. Teniamo solo l'identificativo e l'email.»
- de: «Apple und Google, wenn du dich mit ihnen anmeldest: Sie sehen, dass
  du MuW nutzt, und sagen uns, welches Konto deins ist. Wir speichern nur
  die Kennung und die E-Mail-Adresse.»
- es: «Apple y Google, si entras con ellos: ven que usas MuW y nos dicen
  cuál es tu cuenta. Solo guardamos el identificador y el correo.»
- fr: «Apple et Google, si tu te connectes avec eux : ils voient que tu
  utilises MuW et nous disent quel compte est le tien. Nous ne gardons que
  l'identifiant et l'adresse e-mail.»

**3. Termini, «Your account»** (e la stessa frase nel riassunto in cima
ai termini): come ci si iscrive.

- en: «You sign up with an email address and a password, or with Apple or
  Google, and a username.» (oggi: «You sign up with an email address, a
  username and a password.»)
- it: «Ti iscrivi con un'email e una password, o con Apple o Google, e un
  nome utente.»
- de: «Du registrierst dich mit einer E-Mail-Adresse und einem Passwort
  oder mit Apple oder Google, und mit einem Benutzernamen.»
- es: «Te registras con un correo y una contraseña, o con Apple o
  Google, y un nombre de usuario.»
- fr: «Tu t'inscris avec une adresse e-mail et un mot de passe, ou avec
  Apple ou Google, et un nom d'utilisateur.»

Il resto della frase di oggi (i 16 anni, l'account solo tuo) resta.

Trovato, fuori da questo task: i termini dicono ancora che non c'è un modo
di recuperare una password dimenticata (en «There is no way to reset a
forgotten password yet», it «Non c'è ancora un modo…»), ma c'è da TASK-300.
Lo segnalo, non lo cambio qui.

## Come (deciso dall'agente su delega dell'utente, ADR-0282)

- **Una tabella nuova `user_identities`**: `provider` (`apple`,
  `google`), `subject` (l'id stabile che dà il provider, `sub`),
  `user_id`, `email` al momento, `apple_refresh_token` (solo Apple, per la
  revoca), `created_at`; unica su `(provider, subject)`. `users` non
  cambia: chi si iscrive con Apple o Google riceve una password a caso che
  nessuno conosce (hash Argon2id di 32 byte casuali, buttati). Così
  `password_hash` resta `NOT NULL`, «Forgot password» funziona anche per
  loro (un modo di avere anche la password), e nessun codice di oggi cambia.
- **Un endpoint**: `POST /session/{provider}` con `id_token` (e per Apple
  `authorization_code` e `nonce`):
  - identità già nota → `200 Session`;
  - email garantita già di un iscritto → l'identità si lega a lui,
    `200 Session` (scelta 4);
  - né l'una né l'altra, senza `username` → `404 new_account` con
    l'email da mostrare; l'app apre la schermata del nome e rimanda la
    stessa richiesta con `username`, `at_least_16`, `away_email`,
    `language` → `201 Session`. Il token di Google vale un'ora, quello di
    Apple dieci minuti: scaduto, l'app lo richiede in silenzio (Google) o
    con un tocco (Apple).
- **I token si leggono sul server**, con le chiavi pubbliche di Apple
  (`appleid.apple.com/auth/keys`) e di Google (le JWKS di
  `accounts.google.com`), tenute in memoria come dicono i loro header di
  cache: firma, `iss`, `aud` (il bundle `com.lppl1316.sgrava` per Apple; i
  client ID iOS e web per Google, in `.env`), scadenza, `email_verified`;
  per Apple il `nonce` (SHA-256 di quello che l'app ha generato).
- **Stessa email, la sicurezza**: se l'account con quella email non ha
  l'email confermata (TASK-300), chi l'ha creato non ha mai provato che
  fosse sua. Allora l'identità si lega ma la password di prima si cambia
  con una a caso e le altre sessioni finiscono: vince chi l'email la
  possiede davvero (Apple o Google lo garantiscono). Con l'email
  confermata, password e sessioni restano.
- **Cancellare l'account** (`DELETE /me`): per Apple il server revoca
  l'accesso (`appleid.apple.com/auth/revoke`, con il refresh token avuto
  dal primo `authorization_code`); Apple lo chiede (App Review 5.1.1(v)).
  Una revoca che non riesce non ferma la cancellazione: si scrive nel log.
  Per Google non teniamo token: niente da revocare.
- **Chiavi**: in `.env` (`SHAPEROUTE_APPLE_TEAM_ID`,
  `SHAPEROUTE_APPLE_KEY_ID`, `SHAPEROUTE_APPLE_KEY_P8`,
  `SHAPEROUTE_GOOGLE_CLIENT_IDS`), aggiornando `.env.example`. Senza,
  l'endpoint risponde `503 provider_unavailable` e `GET /session/providers`
  dice quali ci sono: l'app mostra solo quei tasti.
- **L'app**: i due moduli nativi esclusi dall'autolinking finché non c'è
  la build 1.0.1, la stessa di `expo-contacts`, `expo-document-picker`
  (TASK-312) e forse HealthKit (TASK-321), come chiede il Coordinatore.
  Fino ad allora i tasti restano nascosti nella build dello store, come i
  contatti: l'impronta iOS resta 83793e26 e gli OTA della 1.0 continuano. «Log out» fa anche `GoogleSignin.signOut()`, così la volta
  dopo Google fa scegliere l'account.

## Parti

**A — API** (`feat/TASK-322-a-sign-in-api`): migrazione (la prima libera
al momento del merge: 0033 se la contendono TASK-319 e TASK-312 A; il
numero non si scrive nei test), `POST /session/{provider}`,
`GET /session/providers`, la revoca Apple in `DELETE /me`, i tipi in
`shared-types`, `API.md` e `DATABASE.md`. Test deterministici con chiavi
finte (un JWKS generato nei test, niente rete).

**B — App** (`feat/TASK-322-b-sign-in-app`): i due tasti in
`SignInScreen`, la schermata del nome, i testi nelle cinque lingue, i due
pacchetti esclusi dall'autolinking. Test con i moduli nativi finti.

**C — La build e le console** (con l'utente, ognuna col suo sì):

- Apple Developer: «Sign in with Apple» sull'App ID (EAS lo accende da
  solo con `usesAppleSignIn`), una chiave «Sign in with Apple» (.p8) per
  la revoca; per «Hide My Email», il dominio da cui partono le email
  registrato in «Sign in with Apple for Email Communication», o le email
  ai relay di Apple non arrivano;
- Google Cloud: un progetto con la schermata del consenso (nome MuW, la
  privacy) e tre client OAuth: iOS (`com.lppl1316.sgrava`), Android
  (`app.getmuw.android`, con lo SHA-1 della chiave di firma di Google Play
  e di quella di caricamento) e web (il `webClientId` che dà l'`id_token`
  su Android);
- il server con la parte A (la migrazione, il ritorno indietro come in
  `DEPLOY.md`);
- la build nativa 1.0.1 per App Store e Google Play, una sola insieme a
  `expo-contacts`, `expo-document-picker` (TASK-312) e forse HealthKit
  (TASK-321): i moduli entrano nell'autolinking, l'impronta cambia, la
  revisione di Apple e di Google.

## Criteri di accettazione

- [ ] `POST /session/apple` e `/session/google` con un token valido danno
      `200 Session` a un'identità nota, legano un'email già iscritta, e
      danno `404 new_account` e poi `201 Session` a una nuova.
- [ ] Un token con firma, `aud`, `iss`, scadenza o `nonce` sbagliati, o
      con l'email non verificata, dà `401 wrong_credentials`.
- [ ] Un'email non confermata legata da Apple o Google perde la password
      di prima e le altre sessioni; una confermata no.
- [ ] `DELETE /me` di un account Apple chiama la revoca (finta nei test) e
      cancella anche se la revoca fallisce.
- [ ] Senza le chiavi in `.env`, `503 provider_unavailable` e
      `GET /session/providers` vuoto; il resto degli account va come oggi.
- [ ] Nell'app i tasti compaiono solo con il modulo nativo e il provider
      acceso: Apple solo su iOS. L'impronta iOS resta 83793e26 fino alla
      parte C.
- [ ] Test verdi: `pytest` dell'API, `jest` dell'app.

## File toccati

Questa PR (solo documenti):

```
docs/tasks/TASK-322.md
docs/DECISIONS.md
docs/STATUS.md
```

Parte A (previsti):

```
services/api/migrations/00XX_user_identities.sql
services/api/shaperoute_api/sign_in_providers.py      (nuovo)
services/api/shaperoute_api/accounts.py
services/api/shaperoute_api/app.py
services/api/pyproject.toml
services/api/tests/test_sign_in_providers.py           (nuovo)
packages/shared-types/src/…                            (i tipi nuovi)
.env.example
docs/API.md
docs/DATABASE.md
```

Parte B (previsti):

```
apps/mobile/package.json
apps/mobile/app.json
apps/mobile/src/screens/SignInScreen.tsx
apps/mobile/src/screens/SignInScreen.test.tsx
apps/mobile/src/account/providerSignIn.ts              (nuovo)
apps/mobile/src/account/providerSignIn.test.ts         (nuovo)
apps/mobile/src/account/useAccount.ts
apps/mobile/locales/*
package-lock.json
```

## Fuori scope

- Apple su Android, Facebook, Strava o altri accessi.
- Legare o slegare Apple e Google da un account già aperto, nelle
  impostazioni («Connected accounts»): un task a parte, se l'utente lo
  chiede.
- Cambiare il flusso di email e password, «Forgot password» compreso.
- La foto e il nome di Google nel profilo: si sceglie il nome come oggi.

## Esito

*(si compila a fine task)*
