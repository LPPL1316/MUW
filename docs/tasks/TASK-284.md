# TASK-284 — L'email di ritorno a chi non apre l'app da 14 giorni

**Stato**: Parte A In corso · B Todo
**Fase**: 4 · **Branch**: `feat/TASK-284-return-email` (parte A)
**Dipende da**: TASK-185 (gli interruttori), TASK-118 (il Feed), TASK-211
(follow), TASK-121 (bloccare); la parte B da #461 (TASK-262 C, privacy)
**ADR**: ADR-0244

## Obiettivo

Chi è iscritto e non apre MuW da 14 giorni riceve **una** email che lo
invita a tornare a vedere i post: quanti post nuovi ci sono di chi segue
(o nel Feed), un pulsante «Open MuW» e il link per non riceverne più.

## Scelte dell'utente (2026-10-11)

- **A tutti gli iscritti**, non solo a chi ha acceso «Email notifications»,
  con il link per disiscriversi in ogni email; privacy aggiornata
  (interesse legittimo, come per la rubrica). *Non è una consulenza legale.*
- **Un interruttore suo**, «Email when I'm away», **acceso di default**, in
  «Settings» sotto «Email notifications». All'iscrizione una riga con una
  casella **non spuntata** «Don't send me these emails» (il «soft opt-in»
  europeo vuole che si possa dire di no già lì). Il link nella email spegne
  lo stesso interruttore. «Email notifications» resta per follow,
  reazioni, commenti e tag (TASK-262 B).
- Proposta accettata: **una email per assenza** (la seguente solo se la
  persona torna e poi resta via altri 14 giorni); «N new drawings from
  people you follow» con fino a tre nomi, altrimenti «N new drawings on
  MuW»; pulsante «Open MuW»; lingua del telefono, altrimenti inglese;
  mittente `MuW <hello@getmuw.app>`; con **Resend** (scelto per TASK-262 B).

Note del coordinatore: rispettare gli interruttori; per il soft opt-in
informare e lasciar rifiutare già all'iscrizione; chiave Resend e DNS di
`getmuw.app` (SPF, DKIM, DMARC) li fa **l'utente**; nessuna chiave nel repo.

## Contesto da leggere

- `docs/API.md` «Notifications», «Accounts»; `docs/DATABASE.md` `users`,
  `sessions`, `push_tokens`
- ADR-0206 (gli interruttori), ADR-0226 (push), ADR-0227 (Feed)
- `services/api/shaperoute_api/push.py` ed `expo_push.py` (il modello:
  testi in cinque lingue, rete con la libreria standard)

## Parte A — API (in dettaglio)

1. **Migrazione** (`NNNN_away_email.sql`, il primo numero libero al
   merge): `users.notify_away boolean NOT NULL DEFAULT true` (anche per
   gli account di prima: scelta «tutti gli iscritti»), `users.away_emailed_at
   timestamptz` (l'ultima email di ritorno), `users.language` (la lingua
   dell'app all'iscrizione; vuota per gli account di prima).
2. **Interruttore**: `notifications.away` in `GET /me` e nelle risposte
   che danno l'account; `PUT /me/notifications` accetta `away`.
   `POST /accounts` accetta `away_email` (falso con la casella spuntata,
   vero se manca) e `language`.
3. **Chi riceve**: `notify_away` acceso; ultimo uso dell'app (il
   `last_used_at` più recente delle sue sessioni, o l'iscrizione se non ne
   ha) più vecchio di 14 giorni; nessuna email di ritorno dopo
   quell'ultimo uso. Solo se c'è qualcosa di nuovo da vedere dopo
   l'ultimo uso: disegni che il Feed gli mostrerebbe (stessa regola,
   `shown_sql`, mai attraverso un blocco), suoi esclusi. Senza niente di
   nuovo nessuna email: si riprova il giorno dopo.
4. **Cosa dice**: con post nuovi di chi segue, quanti e fino a tre nomi
   («+N» per gli altri); altrimenti quanti disegni nuovi nel Feed.
   Pulsante «Open MuW» verso la pagina App Store della app (su iPhone con
   l'app installata la pagina dice «Apri»: l'app non ha ancora link
   universali). In fondo: perché la riceve, il link «Don't send me these
   emails» e dove spegnerla in «Settings». Testo e HTML, in en, de, it,
   es, fr: la lingua dell'iscrizione, poi quella del telefono con le push,
   poi l'inglese.
5. **Disiscriversi**: il link porta a `GET /away-email/stop?t=…`, una
   pagina con il pulsante «Stop these emails» (`POST` allo stesso
   indirizzo): un `GET` solo non spegne niente, perché i filtri antispam
   aprono i link. Anche `List-Unsubscribe` e `List-Unsubscribe-Post`
   (RFC 8058) per il «disiscriviti» del programma di posta. Il token è un
   HMAC del `public_id` con `SHAPEROUTE_EMAIL_SECRET`: niente nel
   database. La pagina è aperta senza `X-API-Key` (`access.py`, come
   `/strava/callback`).
6. **Quando**: un giro al giorno, alle `AWAY_EMAIL_AT` UTC (17:00 di
   default), in un thread dell'API avviato da `__main__.py`, solo con
   `RESEND_API_KEY`, `SHAPEROUTE_EMAIL_SECRET` e `SHAPEROUTE_DOMAIN`
   impostati: senza, l'API dice all'avvio che le email sono spente.
   Ogni account è «preso» con un `UPDATE … RETURNING` prima dell'invio
   (mai due email se due giri si sovrappongono) e rilasciato se Resend
   rifiuta. Al più `MAX_PER_ROUND` email a giro, una ogni mezzo secondo
   (il limite di Resend è 2 al secondo).
7. **Un giro a mano**: `python -m shaperoute_api.away_email` dice quanti
   la riceverebbero adesso, senza mandare niente; `--send` fa un giro.

### Criteri di accettazione (parte A)

- [ ] Un account nuovo ha `notifications.away` acceso; `away_email: false`
      all'iscrizione lo spegne; `PUT /me/notifications {"away": false}` lo
      spegne e lo riaccende, senza toccare gli altri due.
- [ ] Un account fermo da 14 giorni con disegni nuovi visibili riceve una
      email; uno fermo da 13 no; uno con l'interruttore spento no; uno già
      raggiunto per la stessa assenza no; uno tornato e poi fermo di nuovo
      14 giorni sì.
- [ ] I disegni di chi è bloccato (in un senso o nell'altro), quelli «only
      me» e quelli «followers» di chi non segue non contano mai.
- [ ] Il testo ha il numero giusto e fino a tre nomi; la lingua è quella
      dell'iscrizione, poi del telefono, poi l'inglese; cinque lingue.
- [ ] Il link della email apre una pagina; solo il `POST` spegne; un token
      sbagliato o di un altro account non spegne niente.
- [ ] Senza chiave, segreto o dominio non parte niente e l'API lo dice.
- [ ] Una email rifiutata da Resend non segna l'account: riprova il giorno
      dopo. La chiave non è mai nei log.
- [ ] Test deterministici verdi in locale e in CI.

### File toccati (parte A)

```
services/api/migrations/NNNN_away_email.sql            (nuovo)
services/api/shaperoute_api/away_email.py              (nuovo)
services/api/shaperoute_api/away_texts.py              (nuovo)
services/api/shaperoute_api/resend_email.py            (nuovo)
services/api/shaperoute_api/accounts.py
services/api/shaperoute_api/notifications.py
services/api/shaperoute_api/access.py
services/api/shaperoute_api/__main__.py
services/api/tests/test_away_email.py                  (nuovo)
services/api/tests/test_resend_email.py                (nuovo)
services/api/tests/test_notifications.py
services/api/tests/test_accounts.py
packages/shared-types/src/index.ts
packages/shared-types/fixtures/session.json
packages/shared-types/test/accounts.test.ts
apps/mobile/src/api/notifications.test.ts
apps/mobile/src/settings/notificationFields.test.ts
.env.example
docs/API.md
docs/DATABASE.md
docs/DEPLOY.md
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-284.md                                 (nuovo)
```

### Fuori scope della parte A

- L'app (casella all'iscrizione, interruttore in «Settings», testi): parte B.
- La privacy: parte B, dopo #461.
- Link universali o uno schema dell'app per aprirla dalla email: servono
  una build nativa e il sito (`apple-app-site-association`).
- Le email di TASK-262 B (follow, reazioni, commenti, tag), la conferma
  dell'email e la password dimenticata.

## Parte B — app e privacy (Todo, dopo #461)

- «Sign up»: la riga e la casella non spuntata «Don't send me these
  emails»; la richiesta manda `away_email` e `language`.
- «Settings»: l'interruttore «Email when I'm away» sotto «Email
  notifications», con `PUT /me/notifications {"away": …}`.
- Testi in cinque lingue, da far approvare all'utente.
- Privacy in cinque lingue e `site/privacy/**` rigenerato: l'email di
  ritorno, la base (interesse legittimo, soft opt-in, rifiuto
  all'iscrizione, in «Settings» e in ogni email), Resend come fornitore
  (negli Stati Uniti). Gli account di prima: avvisati dalla privacy nuova
  e dalla prima email. Da far approvare all'utente, con la data.

## Prima di mandare la prima email (utente e coordinatore)

1. Parte A e B in `main`, l'app pubblicata con la casella.
2. Approvazione di Apple della 1.0 (niente server prima).
3. L'utente: account Resend, dominio `getmuw.app` verificato (record DNS
   SPF, DKIM, DMARC), `RESEND_API_KEY` e `SHAPEROUTE_EMAIL_SECRET` in
   `deploy/.env` sul server (`docs/DEPLOY.md`, «Email di ritorno»).
4. Il coordinatore aggiorna il server col suo via.

## Dove si è (2026-10-13)

- **Parte A**: fatta sul branch `feat/TASK-284-return-email` (worktree
  `.claude/worktrees/TASK-284`), unita a `main` `f88eca5d`, PR aperta e
  «pronta» al coordinatore. Test locali: API intera, `shared-types`, app
  (jest, tipi, lint, prettier). Spenta finché il server non ha chiave,
  segreto e dominio: entrare in `main` non manda niente. La migrazione è
  `0022_away_email.sql`: se al merge `0022` è già presa, rinominarla al
  primo numero libero (nessun test la cerca per numero).
- **I testi dell'email e della pagina** sono in
  `services/api/shaperoute_api/away_texts.py` (en, it, de, es, fr; de, es,
  fr tradotti dall'agente). **Aspettano il sì dell'utente** prima della
  prima email: mostrarglieli nella parte B insieme alla privacy.
- **Parte B**, da fare dopo il merge di #461 (TASK-262 C, privacy):
  1. «Sign up»: la riga «If you don't open MuW for 2 weeks, we email you
     once with what's new.» e la casella non spuntata «Don't send me these
     emails»; la richiesta manda `away_email` (falso se spuntata) e
     `language` (la lingua dell'app). Aggiornare
     `fixtures/sign-up-request.json` con i due campi e i test dell'app che
     lo confrontano (`api/accounts.test.ts`, `account/fields.test.ts`,
     `account/useAccount.test.ts`, `account/Profile.test.tsx`); poi in
     `test_accounts.py` togliere l'eccezione `optional`.
  2. «Settings»: l'interruttore «Email when I'm away» sotto «Email
     notifications» (`PUT /me/notifications {"away": …}`), con le parole
     di `away_texts.WORDS[…].switch`.
  3. Privacy in cinque lingue (`about/content/*.ts`, poi `node
     site/tools/make_privacy.mjs`): l'email di ritorno, interesse
     legittimo / soft opt-in, il rifiuto all'iscrizione, in «Settings» e in
     ogni email, Resend (Stati Uniti) come fornitore, e il fatto che gli
     account di prima la ricevono (avvisati dalla privacy nuova e dalla
     prima email). Togliere «MuW sends no emails yet». Sì dell'utente al
     testo e alla data.
- **Prima della prima email**: A e B in `main`, l'app pubblicata,
  l'approvazione di Apple, il server dal coordinatore col sì dell'utente,
  e l'utente che crea l'account Resend, verifica `getmuw.app` e scrive la
  chiave (`DEPLOY.md`, «Email di ritorno»). Poi `docker compose exec api
  python -m shaperoute_api.away_email` per contare, prima del primo giro.

## Esito

*(a fine task)*
