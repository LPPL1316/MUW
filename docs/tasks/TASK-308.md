# TASK-308 — «Send feedback» in «Settings»

**Stato**: Done · 2026-10-28 (PR #576, merge `2a3e3fc9`)
**Fase**: 4 · **Branch**: `feat/TASK-308-feedback`
**ADR**: ADR-0268 · **Migrazione**: `0031_feedback.sql` (il numero è il
primo libero in `main` al merge, conteso con TASK-309) · **API e app**
(nessuna build nativa, nessuna dipendenza nuova)

## Obiettivo

Chi usa MuW scrive a chi lo gestisce idee, problemi e suggerimenti da un
tasto in «Settings», senza uscire dall'app; il messaggio arriva per email
e si può rispondere direttamente.

## La richiesta dell'utente (2026-10-26)

«aggiungi un tasto in impostazioni per darci un feedback e suggerimenti...
grazie». Numero di task dal Coordinatore (`local_e57a8224`).

## Le scelte dell'utente (2026-10-26)

1. **Dove arriva il messaggio**: «Form in the app» (fra un'email scritta
   dall'app Mail del telefono a `hello@getmuw.app`, che oggi non riceve
   posta, e un modulo nell'app che il server tiene e manda per email).
2. **Testi e privacy**: approvati così come sono (sotto, «Testi»):
   «Sì ai testi e alla privacy di TASK-308, così come sono.» (2026-10-26).

## Contesto da leggere

- `docs/API.md`, «Block and report» e «Report emails»: lo stesso schema
  (riga nel database, email fuori dalla richiesta).
- `docs/UI.md`, «Settings».
- `services/api/shaperoute_api/report_email.py`, `resend_email.py`.
- `apps/mobile/src/settings/EmailSetting.tsx`: la riga che apre un modulo.

## Cosa fare

1. **API** (`feedback.py`): `POST /feedback` con il token; testo da 1 a
   2000 caratteri (senza spazi ai due capi, niente caratteri di
   controllo), `app_version` e `platform` facoltativi; al più 5 in 24 ore
   per account, contati nel database, e 20 per indirizzo di rete, in
   memoria, poi `429` con `Retry-After`. `GET /feedback` risponde `204`:
   la sonda dell'app. Tabella
   `feedback` (migrazione `0031_feedback.sql`, `ON DELETE CASCADE`).
2. **Email**: fuori dalla richiesta, con Resend, a
   `SHAPEROUTE_FEEDBACK_TO` o, senza, a `SHAPEROUTE_REPORTS_TO`; Reply-To
   l'email dell'iscritto (`reply_to` nuovo in `resend_email.Email`). Mai
   chiave, indirizzo o testo nei log. Avvio in `__main__.py`, rotta in
   `app.py`.
3. **Tipi**: `FeedbackRequest` e `MAX_FEEDBACK_LENGTH` in `shared-types`,
   esempio `fixtures/feedback-request.json`, letto dai test dei due lati.
4. **App**: `api/feedback.ts`; `settings/FeedbackSetting.tsx` (la riga e
   il modulo) e `settings/feedbackFields.ts` (controllo, versione,
   sistema, errori in parole); la sezione «FEEDBACK» in `SettingsPage.tsx`,
   prima di «ABOUT», **solo dopo il `204` di `GET /feedback`**
   (`settings/useFeedbackService.ts`): con il server di oggi (`404`) non
   c'è, così `main` resta pubblicabile su preview (condizione del
   Coordinatore). Testi in fondo alle quattro tabelle.
5. **Privacy**: sezione «Feedback», la frase di Resend e la base del
   trattamento, nelle cinque lingue; pagine del sito rifatte con
   `node site/tools/make_privacy.mjs`.
6. **Documenti**: `API.md`, `DATABASE.md`, `DEPLOY.md` («Email del
   feedback»), `UI.md`, `.env.example`, ADR-0268, `STATUS.md`.

## Testi

Approvati dall'utente il 2026-10-26, così come sono:

| en | it | de | es | fr |
|---|---|---|---|---|
| FEEDBACK | FEEDBACK | FEEDBACK | COMENTARIOS | AVIS |
| Send feedback | Mandaci un feedback | Feedback senden | Envíanos tus comentarios | Envoie-nous ton avis |
| Ideas, problems, anything that would make MuW better: we read every message. | Idee, problemi, tutto ciò che renderebbe MuW migliore: leggiamo ogni messaggio. | Ideen, Probleme, alles, was MuW besser machen würde: Wir lesen jede Nachricht. | Ideas, problemas, todo lo que haría mejor a MuW: leemos cada mensaje. | Idées, problèmes, tout ce qui rendrait MuW meilleur : nous lisons chaque message. |
| Write here… | Scrivi qui… | Hier schreiben… | Escribe aquí… | Écris ici… |
| It reaches us with your username, your email and the app's version, so we can answer you. | Ci arriva con il tuo nome utente, la tua email e la versione dell'app, così possiamo risponderti. | Sie erreicht uns mit deinem Benutzernamen, deiner E-Mail-Adresse und der Version der App, damit wir dir antworten können. | Nos llega con tu nombre de usuario, tu correo y la versión de la app, para que podamos responderte. | Il nous parvient avec ton nom d'utilisateur, ton e-mail et la version de l'app, pour que nous puissions te répondre. |
| Thank you! Your message reached us. | Grazie! Il tuo messaggio ci è arrivato. | Danke! Deine Nachricht ist bei uns angekommen. | ¡Gracias! Tu mensaje nos ha llegado. | Merci ! Ton message nous est bien parvenu. |
| Write something first. | Scrivi prima qualcosa. | Schreib zuerst etwas. | Escribe algo primero. | Écris d'abord quelque chose. |
| You sent a lot of feedback today. Try again tomorrow. | Oggi ci hai già scritto molto. Riprova domani. | Du hast uns heute schon viel geschrieben. Versuch es morgen wieder. | Hoy ya nos has escrito mucho. Vuelve a intentarlo mañana. | Tu nous as déjà beaucoup écrit aujourd'hui. Réessaie demain. |
| Your message (letto da VoiceOver) | Il tuo messaggio | Deine Nachricht | Tu mensaje | Ton message |

«Send», «Sending…» e «This is not available any more.» ci sono già.

**Privacy**, in inglese (le altre lingue nei file `about/content/*.ts`):

- Sezione nuova **«Feedback»**, dopo «Reports»: «When you write to us from
  «Send feedback» in «Settings», we keep your message, the app's version,
  your phone's system (iOS or Android) and when you sent it. The person
  who runs MuW receives it by email with your username and email address,
  to read it and, if needed, to answer you by email. It is never shown to
  the other members. When you delete your account, your messages are
  deleted from our server with it.»
- In fondo alla riga di **Resend**: «For «Send feedback» it carries your
  message, your username and your email address.»
- In fondo all'**interesse legittimo**: «…; the messages of «Send
  feedback», to read them and answer you.»
- La data è quella del giorno del merge: «28 October 2026» (la #573
  l'aveva portata al 27; il merge è il 28), come ha chiesto il
  Coordinatore.

## Criteri di accettazione

- [x] In «Settings» la sezione «FEEDBACK» con «Send feedback»; il modulo
      si apre e si chiude con un tocco, tiene le parole se chiuso.
- [x] «Send» manda testo, versione e sistema con il token; mandato,
      ringrazia; vuoto, lo dice prima di mandare; un secondo tocco mentre
      va non manda niente.
- [x] Sessione finita: esce come altrove; niente rete, limite del giorno
      e API precedente detti in parole, il campo tiene le parole.
- [x] `POST /feedback` tiene il messaggio, 422 per un testo che non lo è,
      401 senza token, 429 al sesto in 24 ore con `Retry-After` giusto, e
      al ventunesimo dallo stesso indirizzo.
- [x] Con il server di oggi (`GET /feedback` → `404`) e senza rete la
      sezione «FEEDBACK» non c'è; con `204` c'è (test di `SettingsPage`).
- [x] Il testo non è mai nei log (`test_the_words_are_never_in_a_log`).
- [x] Un'email a messaggio, Reply-To l'iscritto, al suo indirizzo o a
      quello delle segnalazioni; niente senza Resend; Resend che sbaglia
      non cambia la risposta; niente chiave, indirizzo o testo nei log.
- [x] Cancellare l'account cancella i suoi messaggi.
- [x] La privacy lo dice nelle cinque lingue; le pagine del sito sono
      uguali all'app (`site` `npm test`).
- [x] Testi e privacy approvati dall'utente (2026-10-26).
- [x] Test verdi in CI.

## File toccati

```
docs/tasks/TASK-308.md
docs/STATUS.md
docs/DECISIONS.md
docs/API.md
docs/DATABASE.md
docs/DEPLOY.md
docs/UI.md
.env.example
services/api/migrations/0031_feedback.sql
services/api/shaperoute_api/feedback.py
services/api/shaperoute_api/resend_email.py
services/api/shaperoute_api/app.py
services/api/shaperoute_api/__main__.py
services/api/tests/test_feedback.py
services/api/tests/test_resend_email.py
packages/shared-types/src/index.ts
packages/shared-types/fixtures/feedback-request.json
packages/shared-types/test/feedback.test.ts
apps/mobile/src/api/feedback.ts
apps/mobile/src/api/feedback.test.ts
apps/mobile/src/settings/FeedbackSetting.tsx
apps/mobile/src/settings/FeedbackSetting.test.tsx
apps/mobile/src/settings/feedbackFields.ts
apps/mobile/src/settings/feedbackFields.test.ts
apps/mobile/src/settings/useFeedbackService.ts
apps/mobile/src/profile/SettingsPage.tsx
apps/mobile/src/profile/SettingsPage.test.tsx
apps/mobile/src/i18n/it.ts
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/es.ts
apps/mobile/src/i18n/fr.ts
apps/mobile/src/about/content/en.ts
apps/mobile/src/about/content/it.ts
apps/mobile/src/about/content/de.ts
apps/mobile/src/about/content/es.ts
apps/mobile/src/about/content/fr.ts
apps/mobile/src/about/AboutPage.test.tsx
apps/mobile/src/about/documents.test.ts
site/privacy/index.html
site/privacy/it/index.html
site/privacy/de/index.html
site/privacy/es/index.html
site/privacy/fr/index.html
site/tests/privacy.test.mjs
```

## Fuori scope

- Un pannello o un endpoint per leggere i messaggi (si leggono per email
  e nel database, come le segnalazioni).
- Allegati (uno screenshot) e categorie («bug», «idea»).
- Il feedback senza account.
- Una casella che riceva posta su `getmuw.app` (record MX).

## Al merge

1. Migrazione: se TASK-309 entra prima con `0031`, rinominare in
   `0032_feedback.sql` (e la riga di `DATABASE.md`, `DEPLOY.md`, il task
   file).
2. **App e server in qualsiasi ordine**: finché il server non ha
   `GET /feedback` la sezione non si vede. Il server dopo l'approvazione
   di Apple, con l'ok dell'utente (`DEPLOY.md`, «Email del feedback»).
3. **La data della privacy** è quella del giorno del merge, nelle cinque
   lingue (`PRIVACY_UPDATED` in `about/content/*.ts`) e nei loro test
   (`AboutPage.test.tsx`, `documents.test.ts`, `site/tests/privacy.test.mjs`),
   poi `node site/tools/make_privacy.mjs` (condizione del Coordinatore):
   fatto per il 28 ottobre. Se il merge slitta ancora, si rifà.
4. Le pagine privacy del sito: copia F.14 sul server, con l'ok
   dell'utente.
5. Impronta iOS su una copia pulita con `npm ci` (attesa `83793e26`).

## Dove si è (2026-10-26)

PR #576, head dopo `865af5db`, `main` già dentro. Le note del Coordinatore
applicate: testi in fondo alle tabelle, limite per indirizzo, la sonda
`GET /feedback` (con il server di oggi la sezione non c'è), un test per il
testo mai nei log. Test locali: API `test_feedback.py` (26),
`test_resend_email.py`, `test_main.py`, `test_access.py`,
`test_contract.py`, `test_moderation.py`, `test_report_email.py` verdi; app
jest intera verde (469 suite, 3826 test); `shared-types` e `site` verdi;
ruff, black, prettier, lint puliti; `tsc` pulito tranne `expo-contacts`,
che manca solo nei `node_modules` del Mac. **Impronta iOS** su una copia
pulita con `npm ci` a `865af5db`: `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3`,
invariata. Aspetta il sì dell'utente su testi e privacy; al merge la data
della privacy (sopra, «Al merge»).

## Esito

**Fatto** (chiuso il 2026-10-28). API e app in `main` con la #576 (merge
`2a3e3fc9`), migrazione `0031_feedback.sql`: in «Settings» la sezione
«FEEDBACK» con «Send feedback», che apre il modulo sotto la riga;
`POST /feedback` tiene il messaggio, al più 5 al giorno per account e 20
per indirizzo di rete, e lo manda per email a `SHAPEROUTE_FEEDBACK_TO` o
a `SHAPEROUTE_REPORTS_TO`, con Reply-To l'iscritto. La sezione si vede
solo dopo il `204` di `GET /feedback`: con il server di oggi non c'è.
Testi e privacy approvati dall'utente il 2026-10-26; privacy datata
28 ottobre 2026 nelle cinque lingue, pagine del sito rifatte. Criteri
provati dai test della PR, verdi in CI: `test_feedback.py` su PostgreSQL
vero (26), `test_resend_email.py`, i jest della riga, del modulo, della
sonda e di «Settings» con il server vecchio e quello nuovo, `shared-types`
e `site`. Solo JS nell'app: impronta iOS `83793e26` invariata.
**Restano**: il server con la `0031` dopo l'approvazione di Apple e col
sì dell'utente (`DEPLOY.md`, «Email del feedback»; basta
`SHAPEROUTE_REPORTS_TO`, già previsto), la copia F.14 delle pagine
privacy del sito, la pubblicazione dell'app.
