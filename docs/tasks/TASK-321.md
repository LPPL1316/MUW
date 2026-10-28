# TASK-321 — Entrare e iscriversi con Apple e con Google

**Stato**: Todo (proposta: il sì dell'utente alle scelte di prodotto c'è;
mancano i pacchetti nuovi, i testi e la riga della privacy)
**Fase**: 4 · **Branch**: `docs/TASK-321-sign-in-apple-google` (i
documenti), poi `feat/TASK-321-a-sign-in-api`, `feat/TASK-321-b-sign-in-app`
· **ADR**: ADR-0281

> Numeri presi come primi liberi il 2026-10-28 (321 e 0281) mentre il
> Coordinatore era occupato, dopo averglielo scritto: se ne assegna altri,
> questo file e l'ADR cambiano numero nella stessa PR.

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

1. **Pacchetti nuovi** (CLAUDE.md: niente dipendenze senza chiedere):
   - `expo-apple-authentication` nell'app (di Expo, la versione di SDK 57);
   - `@react-native-google-signin/google-signin` nell'app, la versione
     libera su npm (con il plugin di Expo);
   - `PyJWT[crypto]` nell'API, per leggere i token di Apple e di Google e
     firmare la richiesta di revoca ad Apple (porta `cryptography`).

   Scartati: `expo-auth-session` per Google (un passaggio dal browser,
   come già scartato per Strava in ADR-0156; e Google non lo consiglia più
   su Android); verificare i token chiedendoli a Google (`tokeninfo`: una
   chiamata di rete a ogni accesso, e per Apple non esiste).
2. **I testi** dell'app (tabella nella parte B, nelle cinque lingue).
3. **La riga della privacy**: «If you sign in with Apple or Google, we keep
   the account ID they give us and the email they share. Nothing else.»
   Con Apple «Hide My Email» l'email è un indirizzo di Apple che inoltra.

## Come (deciso dall'agente su delega dell'utente, ADR-0281)

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
- **L'app**: i due moduli nativi esclusi dall'autolinking (come
  `expo-contacts`) finché non c'è la build nuova, e i tasti nascosti se il
  modulo nativo non c'è: l'impronta resta 83793e26 e gli OTA della 1.0
  continuano. «Log out» fa anche `GoogleSignin.signOut()`, così la volta
  dopo Google fa scegliere l'account.

## Parti

**A — API** (`feat/TASK-321-a-sign-in-api`): migrazione (il prossimo
numero libero, dal Coordinatore), `POST /session/{provider}`,
`GET /session/providers`, la revoca Apple in `DELETE /me`, i tipi in
`shared-types`, `API.md` e `DATABASE.md`. Test deterministici con chiavi
finte (un JWKS generato nei test, niente rete).

**B — App** (`feat/TASK-321-b-sign-in-app`): i due tasti in
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
- la build nativa nuova (1.0.1) per App Store e Google Play: i moduli
  entrano nell'autolinking, l'impronta cambia, la revisione di Apple e di
  Google.

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
docs/tasks/TASK-321.md
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
