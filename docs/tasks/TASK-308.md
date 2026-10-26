# TASK-308 — «Send feedback» in «Settings»

**Stato**: In lavorazione — PR aperta, aspetta il sì dell'utente sui testi
e sulla privacy, poi il «merge» del Coordinatore
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
2. **Testi e privacy**: da approvare prima del merge (sotto, «Testi»).

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
   per account, contati nel database, poi `429` con `Retry-After`. Tabella
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
   prima di «ABOUT». Testi nelle cinque lingue.
5. **Privacy**: sezione «Feedback», la frase di Resend e la base del
   trattamento, nelle cinque lingue; pagine del sito rifatte con
   `node site/tools/make_privacy.mjs`.
6. **Documenti**: `API.md`, `DATABASE.md`, `DEPLOY.md` («Email del
   feedback»), `UI.md`, `.env.example`, ADR-0268, `STATUS.md`.

## Testi

Da approvare dall'utente prima del merge:

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
- La data resta «26 October 2026»: se entra un altro giorno, la data
  nuova vuole il sì dell'utente.

## Criteri di accettazione

- [x] In «Settings» la sezione «FEEDBACK» con «Send feedback»; il modulo
      si apre e si chiude con un tocco, tiene le parole se chiuso.
- [x] «Send» manda testo, versione e sistema con il token; mandato,
      ringrazia; vuoto, lo dice prima di mandare; un secondo tocco mentre
      va non manda niente.
- [x] Sessione finita: esce come altrove; niente rete, limite del giorno
      e API precedente detti in parole, il campo tiene le parole.
- [x] `POST /feedback` tiene il messaggio, 422 per un testo che non lo è,
      401 senza token, 429 al sesto in 24 ore con `Retry-After` giusto.
- [x] Un'email a messaggio, Reply-To l'iscritto, al suo indirizzo o a
      quello delle segnalazioni; niente senza Resend; Resend che sbaglia
      non cambia la risposta; niente chiave, indirizzo o testo nei log.
- [x] Cancellare l'account cancella i suoi messaggi.
- [x] La privacy lo dice nelle cinque lingue; le pagine del sito sono
      uguali all'app (`site` `npm test`).
- [ ] Testi e privacy approvati dall'utente.
- [ ] Test verdi in CI.

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
site/privacy/index.html
site/privacy/it/index.html
site/privacy/de/index.html
site/privacy/es/index.html
site/privacy/fr/index.html
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
2. **Server prima dell'app**: l'app manda a `POST /feedback`, che c'è solo
   sul server aggiornato (dopo l'approvazione di Apple, con l'ok
   dell'utente; `DEPLOY.md`, «Email del feedback»). Pubblicata prima, «Send»
   dice «This is not available any more.».
3. Le pagine privacy del sito: copia F.14 sul server, con l'ok
   dell'utente.
4. Impronta iOS da rimisurare su una copia pulita (attesa `83793e26`).

## Dove si è (2026-10-26)

Codice, test e documenti fatti nel worktree `.claude/worktrees/TASK-308`.
Test locali: API `test_feedback.py`, `test_resend_email.py`,
`test_main.py`, `test_contract.py`, `test_access.py`, `test_moderation.py`,
`test_report_email.py` verdi; app jest intera verde (469 suite);
`shared-types` e `site` verdi; ruff, black, prettier, lint puliti; `tsc`
pulito tranne `expo-contacts`, che manca solo nei `node_modules` del Mac.
