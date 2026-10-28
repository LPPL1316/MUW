# TASK-319 — I messaggi privati, con le richieste

**Stato**: In corso (parti A e B nella stessa PR)
**Fase**: 4 · **Branch**: `feat/TASK-319-private-messages` (scritto nella
sessione cloud su `claude/epic-gauss-k87m6o`; parte da `main`)
**ADR**: ADR-0279 · **Migrazione**: `0033_messages.sql` (il numero si
ricontrolla al merge)
**Numeri**: TASK-319 / ADR-0279, **assegnati dal Coordinatore** il
2026-10-28. Questo lavoro è nato come TASK-305 / ADR-0265 nella sessione
cloud, che non può fare il push (GitHub risponde 403), ed è stato
rinumerato quattro volte: 305, 310, 311 e 317 / ADR-0277 li hanno presi
altre sessioni prima che questo branch arrivasse su GitHub (317 è
`feat/TASK-317-waiting-card`, la #602). La migrazione è `0033` (`0031` e
`0032` sono di TASK-308 e TASK-309), da ricontrollare al merge.

## Obiettivo

Due iscritti si mandano messaggi privati. Chi non è seguito da chi riceve
arriva come **richiesta**, che l'altro accetta, cancella o blocca.

## Le scelte dell'utente (2026-10-26)

Richiesta: «aggiungi anche la possibilità di mandarsi messaggi privati».
Chieste una alla volta, con una proposta:

1. **Chi scrive a chi**: «Chiunque, con richiesta» (fra tre: chi si segue
   a vicenda; chi ha accettato il mio follow; chiunque con richiesta).
2. **Le regole**, approvate con «Sì, così»:
   - dritto in «Messages» se chi riceve segue chi scrive; altrimenti in
     «Requests», dentro «Messages», con un numero;
   - finché la richiesta non è accettata, chi scrive manda **un solo
     messaggio** e non sa se è stato letto;
   - «Accept» (conversazione normale), «Delete» (sparisce; chi ha scritto
     non lo sa e può riprovare, sempre con un solo messaggio, come i follow
     rifiutati), «Block»;
   - il primo messaggio di una richiesta passa dal filtro dei commenti; le
     conversazioni accettate no;
   - push: una per richiesta, al più una al giorno per chi scrive; una per
     ogni messaggio di una conversazione accettata;
   - un interruttore in «Settings» per non ricevere richieste: seguito
     possibile, non adesso.
3. **Il resto della proposta**, nello stesso «Sì, così»: solo testo fino a
   1000 caratteri, niente foto; «Message» sul profilo dell'altro e
   «Messages» in «Profile», con un pallino per le non lette; la
   conversazione aperta si aggiorna ogni pochi secondi; nessuna conferma di
   lettura; «Report» sul singolo messaggio (all'email va solo quello); il
   blocco chiude la conversazione per tutti e due; niente crittografia
   end-to-end e la privacy lo dice; chi ha scritto un messaggio lo
   cancella per tutti e due; niente email; parti A (API) e B (app), testi
   in inglese da approvare e traduzioni dell'agente; server e
   pubblicazione con l'ok dell'utente; la risposta «Messaging and Chat»
   del questionario dell'età su App Store Connect la cambia l'utente.

## Il disegno (deciso dall'agente su delega dell'utente)

In ADR-0279 e in `API.md` «Messages»: una conversazione per coppia, lo
stato della richiesta su chi riceve (`conversation_members.accepted_at`),
la conversazione chiesta col `public_id` dell'altro, lo `state` della
pagina (`open`, `first`, `waiting`, `request`), «Delete» che toglie dalla
propria vista, il blocco che cancella la conversazione, i due `Kind` di
push.

## I testi

**Push** (parte A, `push.py`), da approvare:

- `message` — «{name}: {text}» (l'inizio del messaggio, 100 caratteri)
- `message_request` — «{name} wants to send you a message.»
  (de «{name} möchte dir eine Nachricht schicken.», it «{name} vuole
  mandarti un messaggio.», es «{name} quiere enviarte un mensaje.», fr
  «{name} veut t'envoyer un message.»)

**App** (parte B): proposti nella parte B qui sotto, da approvare prima
del merge.

## Contesto da leggere

- `docs/API.md` «Follow», «Comments», «Block and report», «Push
  notifications», «Messages»; `docs/DATABASE.md` `0020`, `0024`, `0033`
- ADR-0173, ADR-0176, ADR-0226, ADR-0228, ADR-0251, ADR-0279
- `services/api/shaperoute_api/follows.py` (`apart_sql`, `follows_sql`),
  `comments.py`, `moderation.py`, `report_email.py`, `push.py`

## Parte A — API

1. Migrazione `0033_messages.sql`: `conversations`, `conversation_members`,
   `messages`; `reports.kind` con `message`.
2. `messages.py` (nuovo): gli otto endpoint, lo stato, il filtro sulla
   richiesta, il limite per minuto, «Delete», il gancio del blocco, le
   push.
3. `push.py`: i due `Kind` e i loro testi. `moderation.py`: `message` fra
   i tipi, segnalabile solo dall'altro membro. `report_email.py`: il
   messaggio nell'email e «Hide». `app.py`: `install_messages` dopo i
   blocchi.
4. `shared-types`: i tipi, `MESSAGE_MAX_LENGTH`, `CONVERSATION_STATES`,
   `MessagePushKind`, `REPORT_KINDS` con `message`; cinque esempi.
5. Test deterministici con un PostgreSQL vero (`test_messages.py`), e i
   test che leggono gli elenchi dei tipi; `API.md`, `DATABASE.md`, ADR.

### Criteri di accettazione (parte A)

- [x] Un messaggio a chi segue chi scrive arriva in «Messages»
      (`box=inbox`) e i due scrivono liberamente.
- [x] A chiunque altro è una richiesta (`box=requests`): un messaggio,
      poi `409` finché l'altro non accetta, risponde o cancella.
- [x] «Accept» e una risposta aprono la conversazione per tutti e due.
- [x] «Delete» toglie la richiesta a chi la riceve, non a chi ha scritto,
      che può riscrivere un messaggio; un messaggio che nessuno vede più si
      cancella.
- [x] Il messaggio di una richiesta negativo è `422 comment_rejected` e
      non si tiene niente; lo stesso testo fra due che si scrivono passa.
- [x] Un blocco cancella la conversazione; attraverso un blocco, e verso
      un iscritto nascosto, è `404`; dopo lo sblocco è di nuovo una
      richiesta.
- [x] Chi ha scritto un messaggio lo cancella per tutti e due; l'altro
      `403`, un terzo `404`.
- [x] Un messaggio si segnala solo da chi l'ha ricevuto; l'email porta
      solo quello; nascosto, lo vede solo chi l'ha scritto.
- [x] Il pallino: `unread` e `GET /me/conversations/unread`; nessun campo
      dice a chi scrive se è stato letto.
- [x] Pagine dall'ultimo, con cursore; limite di 20 al minuto; ogni
      endpoint vuole il token; `DELETE /me` cancella le conversazioni.
- [x] Push: `message` per ogni messaggio con l'inizio, `message_request`
      una volta al giorno, senza testo.
- [ ] Test verdi in locale e in CI.

### File toccati (parte A)

```
services/api/migrations/0033_messages.sql               (nuovo)
services/api/shaperoute_api/messages.py                 (nuovo)
services/api/shaperoute_api/push.py
services/api/shaperoute_api/moderation.py
services/api/shaperoute_api/report_email.py
services/api/shaperoute_api/app.py
services/api/tests/test_messages.py                     (nuovo)
services/api/tests/test_moderation.py                   (l'elenco dei tipi è anche nella 0033)
packages/shared-types/src/index.ts
packages/shared-types/test/messages.test.ts             (nuovo)
packages/shared-types/test/moderation.test.ts           (REPORT_KINDS con message)
packages/shared-types/fixtures/message-request.json     (nuovo)
packages/shared-types/fixtures/message.json             (nuovo)
packages/shared-types/fixtures/messages.json            (nuovo)
packages/shared-types/fixtures/conversations.json       (nuovo)
packages/shared-types/fixtures/conversations-unread.json (nuovo)
docs/API.md
docs/DATABASE.md
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-319.md                                  (nuovo)
```

## Parte B — L'app

Nella stessa PR. Le tabelle `i18n/*.ts` e `docs/UI.md` le toccano anche
TASK-296 E, TASK-303 e TASK-304 (righe diverse: chi arriva secondo
unisce).

1. `api/messages.ts` (nuovo): le otto chiamate, come `api/comments.ts`, e
   i problemi in parole.
2. `messages/messagesDoor.ts` (nuovo): cosa è aperto sopra l'app (la
   lista, le richieste, una conversazione) e i numeri del pallino, chiesti
   ogni minuto come le richieste di follow; con un'API senza messaggi
   (`404`) niente «Messages». `ProfileLayer.tsx` lo tiene, mette
   `MessagesOverlay` sopra tutto e gli passa il tocco delle push.
3. «✉️ Messages» in «Profile» (`MessagesRow`, sopra «Settings») con il
   numero rosso; la lista (`ConversationList`) con «Message requests» in
   cima, il pallino delle non lette, «Show more».
4. La conversazione (`ConversationScreen`): i messaggi dal basso (lista
   capovolta), «Show earlier messages»; secondo `state` la casella, il
   suggerimento della richiesta, l'attesa, o «Accept · Delete · Block»; si
   rilegge ogni 5 s mentre è aperta (una lettura alla volta, e una lettura
   chiesta prima di un invio non lo cancella), segna letto, il «…» della
   persona.
5. «Message» sul profilo di un altro (`MessageButton`, in
   `UserProfilePage.tsx`).
6. Un tocco lungo su un messaggio (`MessageSheet`): «Delete» (proprio) o
   «Report this message» con i motivi di `ReportMenu`; «Block» di una
   richiesta chiede prima.
7. Il tocco di una push `message` o `message_request` apre la
   conversazione (`notificationTap.ts`, `usePushNotifications.ts`).
8. Il testo del blocco (`BLOCK_EXPLAINED`) dice anche che la conversazione
   si cancella; «Help» e «Privacy» hanno una sezione nuova sui messaggi
   (niente frasi già approvate cambiate); le pagine della privacy del sito
   rifatte con `make_privacy.mjs`.

### I testi (parte B), approvati dall'utente il 2026-10-28

Inglese; le traduzioni in tedesco, italiano, spagnolo e francese sono
dell'agente (`i18n/*.ts`, `about/content/*.ts`).

- **Profilo**: «Messages» (VoiceOver «Messages, {count} waiting»);
  «Message» (VoiceOver «Message {name}»).
- **Lista**: «Messages», «Message requests» («Message requests, {count}
  waiting»), «You: {text}», «{name}, new message: {text}» (VoiceOver), «No
  messages yet. Open someone's profile and tap Message to write to them.»,
  «No message requests.».
- **Conversazione**: «Write a message…», «Send», «No messages yet.», «Show
  earlier messages», «{name} gets this as a message request. You can send
  one message until they accept it.», «Message request sent. You can write
  again when {name} accepts it.», «{name} wants to send you a message.»,
  «Accept», «Delete», «Block»; VoiceOver «Touch and hold to delete it»,
  «Touch and hold to report it».
- **Foglio**: «Delete this message for both of you?» [Delete]; «Report
  this message», poi i motivi e il grazie di sempre.
- **Errori**: «A message needs some words.», «A message is at most {max}
  characters.», «Too many messages in a minute. Wait a moment and try
  again.», «You can't send negative messages in this app.», «This
  conversation is not available.».
- **Il blocco** (cambiato, era approvato il 2026-10-09): «You will not see
  each other's drawings, comments, messages or profile, any follow between
  you ends and your conversation is deleted. They are not told.»
- **Help**, sezione nuova «Messages» dopo «Feed and friends»: tre
  paragrafi (`about/content/en.ts`).
- **Privacy**, sezione nuova «Private messages» prima di «Reports»: cosa
  si tiene, niente end-to-end, la richiesta e il filtro, cancellare e
  bloccare, l'email di una segnalazione con quel messaggio soltanto, le
  push con l'inizio. **Approvati dall'utente il 2026-10-28** («Approvo
  così», insieme ai testi qui sopra e alle due push). La data della
  privacy (oggi «26 October 2026») diventa il giorno del merge, nelle
  cinque lingue, con `node site/tools/make_privacy.mjs`.

### Criteri di accettazione (parte B)

- [x] Dal profilo di un altro «Message» apre la conversazione; il primo
      messaggio a chi non ci segue dice che arriva come richiesta, poi
      l'attesa.
- [x] «Messages» in «Profile» elenca le conversazioni dall'ultima, con il
      pallino delle non lette; «Message requests» con il numero.
- [x] Una richiesta mostra «Accept», «Delete» e «Block», che fanno quello
      che dicono.
- [x] Un messaggio proprio si cancella, uno dell'altro si segnala.
- [x] La conversazione aperta si aggiorna da sola; aprirla toglie il
      pallino.
- [x] Con un'API senza messaggi «Messages» e «Message» non si vedono.
- [x] Testi approvati dall'utente (2026-10-28, «Approvo così»); le
      traduzioni sono dell'agente.
- [ ] Test, lint, typecheck e prettier verdi in CI.

### File toccati (parte B)

```
apps/mobile/src/api/messages.ts                          (nuovo)
apps/mobile/src/api/messages.test.ts                     (nuovo)
apps/mobile/src/messages/messagesDoor.ts                 (nuovo)
apps/mobile/src/messages/MessagesOverlay.tsx             (nuovo)
apps/mobile/src/messages/MessagesRow.tsx                 (nuovo)
apps/mobile/src/messages/MessageButton.tsx               (nuovo)
apps/mobile/src/messages/ConversationList.tsx            (nuovo)
apps/mobile/src/messages/ConversationScreen.tsx          (nuovo)
apps/mobile/src/messages/MessageSheet.tsx                (nuovo)
apps/mobile/src/messages/Messages.test.tsx               (nuovo)
apps/mobile/src/messages/ConversationScreen.test.tsx     (nuovo)
apps/mobile/src/notifications/notificationTapMessages.test.ts (nuovo)
apps/mobile/src/notifications/notificationTap.ts
apps/mobile/src/notifications/usePushNotifications.ts
apps/mobile/src/screens/ProfileLayer.tsx
apps/mobile/src/profile/ProfileHome.tsx
apps/mobile/src/profile/UserProfilePage.tsx
apps/mobile/src/social/ReportMenu.tsx                    (il testo del blocco)
apps/mobile/src/social/DrawingComments.test.tsx          (il testo del blocco)
apps/mobile/src/i18n/de.ts, es.ts, fr.ts, it.ts
apps/mobile/src/about/content/de.ts, en.ts, es.ts, fr.ts, it.ts
site/privacy/index.html, de/, es/, fr/, it/              (rifatte da make_privacy.mjs)
docs/UI.md
```

## Fuori scope

- Foto, vocali, reazioni ai messaggi, messaggi di gruppo.
- L'interruttore «Message requests» in «Settings» (seguito possibile).
- Conferme di lettura, «sta scrivendo…», WebSocket.
- Il server, `preview` e la build dello store: con l'ok dell'utente, dopo
  il merge.
- Il numero dei messaggi anche sul pulsante di «Profile» in alto (oggi è
  solo delle richieste di follow, TASK-239): seguito possibile, da
  chiedere all'utente. Senza push (Expo Go) i messaggi nuovi si vedono
  solo aprendo «Profile».

## Dove si è

- 2026-10-26: parte A scritta, `test_messages.py` verde (24 test) con i
  test vicini (moderazione, email delle segnalazioni, push, contratto,
  account). La suite intera dell'API in locale: 1855 verdi e 1 rosso,
  `test_strava.py::test_no_secret_is_answered_or_logged`, rosso anche su
  `main` pulito nel container cloud (c'è `httpx2`, che scrive nel log
  l'indirizzo con il `code`): non è di questa PR.
- 2026-10-26: parte B scritta; test jest dei messaggi verdi, lint,
  typecheck e prettier verdi.
- 2026-10-27/28: rinumerato due volte (TASK-305, poi TASK-310 presi da
  altri), unito con `main` dopo TASK-306 e TASK-310; test vicini di nuovo
  verdi. Testi e privacy **approvati dall'utente** il 2026-10-28.
  **Bloccato sul push**: la sessione cloud è collegata a GitHub come
  LPPL1316 e l'app Claude non è installata sull'account rockydalbianco,
  quindi `git push` risponde 403. Il branch sta in un bundle git mandato
  all'utente (`TASK-317-messages.bundle`), da spingere dal Mac. Dopo: CI,
  la data della privacy al giorno del merge, il Coordinatore per la coda
  dei merge.
- 2026-10-28: una sessione sul Mac ha preso il bundle dall'artifact della
  sessione cloud (`git bundle verify` ok, diff identico alla patch) e l'ha
  spinto. Il Coordinatore ha dato TASK-319 / ADR-0279: «TASK-317» e
  «ADR-0277» sostituiti in tutti i file, questo file rinominato, branch
  `feat/TASK-319-private-messages`. Condizioni del Coordinatore, **da
  verificare sul codice prima del merge**: segnalazione e blocco valgono
  anche per i messaggi e per le richieste; c'è un limite ai messaggi
  inviati; quando un account si cancella si cancellano anche i suoi
  messaggi; «Messages» resta nascosto finché il server non ha la parte
  nuova, e il server si aggiorna solo con il sì dell'utente. Prima di
  cambiare il codice l'elenco dei file va al Coordinatore; prima del merge
  controlla dove l'utente ha approvato i testi di aiuto e privacy.

## Esito

*(a fine task)*
