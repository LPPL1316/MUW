# TASK-300 — Email confermata e «Forgot password?»

**Stato**: In corso (parti A e B nella stessa PR)
**Fase**: 4 · **Branch**: `feat/TASK-300-account-emails`
**Dipende da**: TASK-114 (gli account), TASK-183 (il cambio email),
TASK-284 parte A (Resend, il segreto dei link, le pagine senza chiave);
#461 (TASK-262 C, tabelle i18n) è in `main`; TASK-284 B tocca le stesse
schermate (righe diverse: chi arriva secondo unisce)
**ADR**: ADR-0261 · **Migrazione**: `0029_email_confirmation.sql` (la
0028 è di TASK-262 B, #550; il numero si ricontrolla al merge)

## Obiettivo

Chi si iscrive riceve una email per confermare l'indirizzo; chi lo cambia
in «Settings» conferma il nuovo prima che valga, e il vecchio riceve un
avviso; chi ha dimenticato la password ne sceglie una nuova da un link
mandato per email. TASK-183 aveva lasciato fuori la conferma («niente
mail di conferma al nuovo indirizzo»), TASK-114 la password dimenticata
(«serve un servizio di posta»): il servizio ora c'è (Resend, TASK-284).

## Scelte

**Dell'utente (2026-10-25)**, chieste una alla volta con una proposta:

1. Un task a parte da TASK-262 B, da fare subito («a parte SUBITO»).
2. **Un indirizzo non confermato non blocca niente**: l'account funziona
   subito; «Settings» dice «Email not confirmed» con «Send the link
   again» finché il link non è aperto. «Forgot password?» funziona lo
   stesso, e aprire un link di reset conferma anche l'indirizzo.
3. **I 3 account di prima restano non confermati**, come un iscritto
   nuovo, e **nessuna email parte da sola** verso di loro.
4. **I testi** in inglese dell'elenco sotto, approvati così; le quattro
   traduzioni sono dell'agente.

**Del Coordinatore (2026-10-25)**, nel dare il numero: link che valgono
una volta e scadono; il reset fa uscire da ogni telefono; «Forgot
password?» risponde sempre allo stesso modo (nessuno scopre se un
indirizzo è iscritto), con un limite alle richieste ripetute; nessuna
modifica nativa (la 1.0 continua a ricevere gli aggiornamenti); al cambio
in «Settings» **il nuovo indirizzo vale solo quando è confermato**, e il
vecchio riceve un avviso.

## Il disegno (deciso dall'agente su delega dell'utente)

- **I link aprono pagine dell'API**, come `/away-email/stop`: senza una
  build nativa l'app non ha link universali. `GET` mostra la pagina con il
  pulsante o il modulo, solo il `POST` cambia qualcosa (i filtri antispam
  aprono i link). Le pagine non vogliono `X-API-Key` (`access.py`), non
  restano in cache, non mandano il referrer, non si aprono in un frame.
- **Il token** è un HMAC con `SHAPEROUTE_EMAIL_SECRET` (come il link di
  TASK-284, con un prefisso suo per ogni uso): `public_id.scadenza.tag`.
  Il tag copre anche lo stato che il link cambia, letto dal database al
  controllo: l'indirizzo da confermare per la conferma; indirizzo e hash
  della password per il reset. Così un link vale **una volta** (dopo, la
  password è un'altra, o l'indirizzo è già confermato) e muore se nel
  frattempo l'indirizzo cambia; niente tabella di token. Conferma: 7
  giorni. Reset: 1 ora.
- **Iscrizione**: l'account nasce non confermato e si entra subito; parte
  la email di conferma nella lingua dell'app.
- **Cambio in «Settings»** (`PUT /me/email`, con la password come oggi):
  con le email accese il nuovo indirizzo va in `users.pending_email`; si
  entra ancora con il vecchio. Al nuovo parte il link, al vecchio l'avviso
  con l'indirizzo nuovo coperto (`n•••@example.com`). Aperto il link,
  l'indirizzo cambia ed è confermato; se intanto un altro account l'ha
  preso, la pagina lo dice e non cambia niente. Un altro cambio sostituisce
  quello in attesa; `DELETE /me/email/pending` lo annulla. **Con le email
  spente** (nessuna chiave sul server) il cambio vale subito come oggi, e
  il nuovo indirizzo resta non confermato.
- **Reset**: `POST /password-reset` con l'email risponde sempre `202`,
  senza dire se l'account esiste; la ricerca dell'account e l'invio
  avvengono dopo la risposta, in un thread, così anche il tempo non dice
  niente. La pagina del link chiede la password due volte (8–128
  caratteri, come all'iscrizione); salvata: hash nuovo, **tutte le
  sessioni chiuse**, il cambio d'indirizzo in attesa annullato (l'avviso
  lo promette), il conto delle password sbagliate azzerato, l'indirizzo
  confermato. L'iscrizione dice già se un'email è usata (TASK-114): qui
  non si aggiunge un'altra via per saperlo.
- **Limiti**, in memoria come quello delle password sbagliate: 3 richieste
  di reset all'ora per indirizzo (la quarta `429`, che l'account esista o
  no); 3 invii all'ora per account fra «Send the link again» e cambi
  d'indirizzo (`429` con `Retry-After`); 300 email all'ora in tutto, oltre
  le quali non parte niente (nel log). Sopra resta il limite dei `POST`
  per client di `access.py`.
- **Lingua**: per il reset quella dell'app che chiede, poi quella
  dell'account (iscrizione, telefono con le push), poi l'inglese; per le
  altre email e per le pagine quella dell'account.
- **L'app sa se il server manda email** con `GET /account-email` (`200`,
  o `404` da un server spento o di prima): solo allora mostra «Forgot
  password?» e la riga «Email not confirmed», come «Play» con
  `GET /game/catalog`.
- **Spento senza** `RESEND_API_KEY`, `SHAPEROUTE_EMAIL_SECRET` e
  `SHAPEROUTE_DOMAIN`: le stesse tre variabili dell'email di ritorno,
  nessuna nuova. Mittente `MuW <hello@getmuw.app>`, `resend_email.Resend`.

## I testi (approvati dall'utente il 2026-10-25)

Email:

- **Conferma, iscrizione** — «Confirm your email for MuW»; «Hi
  {username},»; «Tap the button to confirm that this is your email
  address.»; [Confirm my email]; «The link works for 7 days. If you did not
  sign up for MuW, ignore this email.»
- **Conferma, nuovo indirizzo** — «Confirm your new email for MuW»; «You
  asked to use this address for your MuW account. It changes once you
  confirm it.»; [Confirm my email]; «The link works for 7 days. If it
  wasn't you, ignore this email: nothing changes.»
- **Avviso al vecchio indirizzo** — «Your MuW email is about to change»;
  «Someone asked to change the email of your MuW account to {masked}. It
  changes only when the new address is confirmed.»; «If it wasn't you,
  choose a new password with «Forgot password?» on «Log in» in MuW: that
  cancels the change and signs out every phone.»
- **Reset** — «Choose a new MuW password»; «Someone asked to reset the
  password of your MuW account. Tap the button to choose a new one.»;
  [Choose a new password]; «The link works once, for 1 hour. If you did not
  ask, ignore this email: your password stays the same.»

Pagine: «Confirm {email} as the email of your MuW account?» [Confirm my
email]; «Done: {email} is confirmed. You can go back to MuW.»; «Another
account has this email now. Choose another one in Settings › Change
email.»; «This link does not work any more. Ask for a new one in MuW.»;
«Choose a new password for {username}»; «NEW PASSWORD» («At least 8
characters»), «REPEAT IT», [Save the password]; «The two passwords are not
the same.»; «Your password is changed. Open MuW and log in with it: every
phone was signed out.»

App (parte B): «Forgot password?»; «Write the email of your account: we
send it a link to choose a new password.» [Send the link] / «Sending…»;
«If an account has this email, a link is on its way. It works for 1 hour;
look in spam too.» [Back to Log in]; «Email not confirmed» [Send the link
again]; «Link sent to {email}. Look in spam too.»; «We sent a link to
{email}. Your email changes when you open it.»; «Waiting for {email}: open
the link we sent there.» [Send again] [Cancel change]; «Too many emails
asked: wait a few minutes and try again.»

## Contesto da leggere

- `docs/API.md` «Accounts», «Email and phone number», «Email when I'm
  away»; `docs/DATABASE.md` `users`, `sessions`
- ADR-0114, ADR-0150 (il cambio email), ADR-0244 (Resend, i link firmati)
- `services/api/shaperoute_api/accounts.py`, `contact.py`,
  `away_email.py`, `resend_email.py`, `access.py`

## Parte A — API

1. Migrazione `0029_email_confirmation.sql`: `users.email_confirmed`
   (falso per tutti gli account di prima, scelta 3), `users.pending_email`.
2. `User` con `email_confirmed` e `pending_email` (solo al proprietario).
3. `account_email.py` (nuovo): i link firmati, le email, i limiti, il
   thread che manda, `GET /account-email`, `POST /password-reset`,
   `POST /me/email/confirmation`, `DELETE /me/email/pending`, le pagine
   `GET`/`POST /email/confirm` e `/password/reset`.
   `account_email_texts.py` (nuovo): le parole in cinque lingue.
4. `accounts.py`: le colonne nuove e un gancio dopo l'iscrizione
   (`after_sign_up`, come `before_account_delete`). `contact.py`: con le
   email accese il cambio va in attesa e manda le due email. `access.py`:
   le due pagine fra quelle aperte. `__main__.py`: installare, con le
   variabili dell'email di ritorno.
5. Test deterministici con un PostgreSQL vero e Resend finto; `API.md`,
   `DATABASE.md`, `DEPLOY.md`, ADR.

### Criteri di accettazione (parte A)

- [ ] Iscriversi manda una email di conferma all'indirizzo, nella lingua
      dell'app; l'account è subito usabile e `email_confirmed` è falso.
- [ ] Il link apre una pagina; solo il pulsante conferma; dopo,
      `email_confirmed` è vero e il link non cambia più niente.
- [ ] Un link scaduto, alterato, di un altro account o di un indirizzo che
      non è più quello non conferma niente.
- [ ] Con le email accese `PUT /me/email` mette il nuovo indirizzo in
      attesa, manda il link al nuovo e l'avviso al vecchio; si entra con il
      vecchio finché il link non è aperto; poi con il nuovo, confermato.
      Se un altro account l'ha preso nel frattempo, niente cambia.
      `DELETE /me/email/pending` annulla. Con le email spente il cambio vale
      subito come prima e il nuovo indirizzo non è confermato.
- [ ] `POST /password-reset` risponde `202` uguale per un indirizzo
      iscritto e non; manda il link solo al primo; la quarta richiesta in
      un'ora per lo stesso indirizzo è `429` in entrambi i casi.
- [ ] La pagina del reset rifiuta password corte o diverse; salvata, la
      vecchia non entra più, la nuova sì, ogni sessione è chiusa, il cambio
      in attesa è annullato, l'indirizzo è confermato, e lo stesso link non
      vale più.
- [ ] Le pagine rispondono senza `X-API-Key`; senza chiave, segreto o
      dominio nessuna di queste strade c'è (`404`) e tutto va come prima.
- [ ] Gli account di prima: non confermati, nessuna email partita.
- [ ] Indirizzi, token e chiave mai nei log.
- [ ] Test verdi in locale e in CI.

### File toccati (parte A)

```
services/api/migrations/0029_email_confirmation.sql     (nuovo)
services/api/shaperoute_api/account_email.py            (nuovo)
services/api/shaperoute_api/account_email_texts.py      (nuovo)
services/api/shaperoute_api/accounts.py
services/api/shaperoute_api/contact.py
services/api/shaperoute_api/access.py
services/api/shaperoute_api/__main__.py
services/api/tests/test_account_email.py                (nuovo)
packages/shared-types/src/index.ts
packages/shared-types/fixtures/session.json
packages/shared-types/fixtures/password-reset-request.json   (nuovo)
packages/shared-types/test/accounts.test.ts
packages/shared-types/test/accountEmail.test.ts         (nuovo)
docs/API.md
docs/DATABASE.md
docs/DEPLOY.md
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-300.md                                  (nuovo)
```

`access.py` e `__main__.py` li toccavano anche #525 (TASK-291) e #550
(TASK-262 B), già in `main`: unite. `accounts.test.ts` cambia di due chiavi
(la lista dei campi di `User`); i test nuovi di `shared-types` sono in
`accountEmail.test.ts`.

### Fuori scope

- Mandare l'email di ritorno (TASK-284) e le notizie (TASK-262 B) solo a
  indirizzi confermati: scelta di quei task.
- Cambiare la password da «Settings» con quella vecchia: non chiesto.
- Link universali per aprire l'app dal link: build nativa e sito.

## Parte B — app

- «Log in»: «Forgot password?» sotto il pulsante, solo se
  `GET /account-email` risponde `200` (chiesto la prima volta che il
  modulo «Log in» o «Settings» si vede, mai all'apertura né su «Sign up»:
  un telefono nuovo non chiede niente di più); la schermata `ForgotPassword` con l'email
  già scritta e «Send the link», poi la frase che non dice se l'account
  esiste e «Back to Log in».
- «Settings»: sotto «Change email», `EmailConfirmation`: «Email not
  confirmed» con «Send the link again»; dopo un cambio, «We sent a link to
  {email}…» e, finché aspetta, «Waiting for {email}…» con «Send again» e
  «Cancel change».
- `useAccount` presta sessione, `change` ed `ended` a `useAccountEmail`
  (file nuovo) e dà `email`, **facoltativo** nel tipo `Account`: i test
  delle pagine che costruiscono un `Account` a mano (una dozzina, di altri
  task) non cambiano; senza, niente di questo si vede.
- Testi nelle quattro tabelle; test di ogni pezzo; `UI.md`.
- Pubblicare l'app prima o insieme al server: l'app di prima, a un cambio
  in attesa, chiude il modulo e mostra ancora il vecchio indirizzo.

### Criteri di accettazione (parte B)

- [ ] «Forgot password?» c'è solo sotto «Log in» e solo da un server che
      risponde `200` a `GET /account-email`; manda l'email scritta con la
      lingua dell'app; dice la stessa frase qualunque sia l'indirizzo.
- [ ] «Settings» dice «Email not confirmed» solo da un server con le email
      e per un indirizzo non confermato; «Send the link again» lo manda;
      un indirizzo in attesa ha «Send again» e «Cancel change», e annullato
      diventa l'account sul telefono.
- [ ] Un telefono senza account che non apre «Profile» non chiede niente
      di nuovo all'API; un'API di prima non mostra niente di questo.
- [ ] Testi nelle quattro tabelle (test `tables`), nessun colore a mano,
      nessuna dipendenza nuova, impronta iOS invariata (solo JS).

### File toccati (parte B)

```
apps/mobile/src/api/accountEmail.ts                     (nuovo)
apps/mobile/src/api/accountEmail.test.ts                (nuovo)
apps/mobile/src/account/accountEmail.ts                 (nuovo)
apps/mobile/src/account/accountEmail.test.ts            (nuovo)
apps/mobile/src/account/useAccount.ts
apps/mobile/src/screens/ForgotPassword.tsx              (nuovo)
apps/mobile/src/screens/ForgotPassword.test.tsx         (nuovo)
apps/mobile/src/screens/SignInScreen.tsx
apps/mobile/src/screens/ProfileScreen.tsx
apps/mobile/src/settings/EmailConfirmation.tsx          (nuovo)
apps/mobile/src/settings/EmailConfirmation.test.tsx     (nuovo)
apps/mobile/src/settings/EmailSetting.tsx
apps/mobile/src/i18n/de.ts, es.ts, fr.ts, it.ts
docs/UI.md
```

## Prima della prima email (utente e Coordinatore)

Come per TASK-284: approvazione di Apple della 1.0, il server dal
Coordinatore col sì dell'utente, l'account Resend con `getmuw.app`
verificato (SPF, DKIM, DMARC) e le tre variabili in `deploy/.env`
(`DEPLOY.md`). La privacy dice già di Resend con TASK-284 B; queste email
servono all'account (contratto), non sono promozione.

## Esito

*(a fine task)*
