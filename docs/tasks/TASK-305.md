# TASK-305 — I messaggi privati, con le richieste

**Stato**: In corso (parti A e B nella stessa PR)
**Fase**: 4 · **Branch**: `claude/epic-gauss-k87m6o` (il branch assegnato
alla sessione cloud; parte da `main` `7af6805`)
**ADR**: ADR-0265 · **Migrazione**: `0031_messages.sql` (il numero si
ricontrolla al merge)
**Numeri**: TASK-305 e ADR-0265 presi come primi liberi anche nei branch
remoti (TASK-303 e 304 e ADR-0263 e 0264 sono su `feat/TASK-303-…` e
`feat/TASK-304-…`): il Coordinatore non era raggiungibile dalla sessione
cloud. **Da confermare col Coordinatore.**

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

In ADR-0265 e in `API.md` «Messages»: una conversazione per coppia, lo
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
  notifications», «Messages»; `docs/DATABASE.md` `0020`, `0024`, `0031`
- ADR-0173, ADR-0176, ADR-0226, ADR-0228, ADR-0251, ADR-0265
- `services/api/shaperoute_api/follows.py` (`apart_sql`, `follows_sql`),
  `comments.py`, `moderation.py`, `report_email.py`, `push.py`

## Parte A — API

1. Migrazione `0031_messages.sql`: `conversations`, `conversation_members`,
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
services/api/migrations/0031_messages.sql               (nuovo)
services/api/shaperoute_api/messages.py                 (nuovo)
services/api/shaperoute_api/push.py
services/api/shaperoute_api/moderation.py
services/api/shaperoute_api/report_email.py
services/api/shaperoute_api/app.py
services/api/tests/test_messages.py                     (nuovo)
services/api/tests/test_moderation.py                   (l'elenco dei tipi è anche nella 0031)
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
docs/tasks/TASK-305.md                                  (nuovo)
```

## Parte B — L'app

Da fare dopo la parte A, nella stessa PR; i file si precisano quando si
comincia (le tabelle `i18n/*.ts` le toccano anche TASK-296 E e TASK-303:
righe diverse, chi arriva secondo unisce).

1. `api/messages.ts` (nuovo): le chiamate, come `api/comments.ts`.
2. «Messages» in «Profile», con il numero delle non lette e delle
   richieste (`GET /me/conversations/unread`); la pagina con le
   conversazioni e, in cima, «Message requests (N)».
3. La conversazione: i messaggi dal basso, la casella e «Send»; secondo
   `state` il suggerimento della richiesta, l'attesa, o «Accept · Delete ·
   Block»; si rilegge ogni pochi secondi mentre è aperta, e segna letto.
4. «Message» sul profilo di un altro (`UserProfilePage.tsx`).
5. Un tocco lungo su un messaggio: «Delete» (proprio) o «Report» (dell'altro,
   con i motivi di `ReportMenu`).
6. Il tocco di una push `message` o `message_request` apre la
   conversazione (`notifications/notificationTap.ts`).
7. «Help» e «Privacy»: i messaggi, che non sono cifrati end-to-end, e che
   l'inizio va nelle push.
8. Testi nelle cinque lingue; test con jest.

### Criteri di accettazione (parte B)

- [ ] Dal profilo di un altro «Message» apre la conversazione; il primo
      messaggio a chi non ci segue dice che arriva come richiesta, poi
      l'attesa.
- [ ] «Messages» in «Profile» elenca le conversazioni dall'ultima, con il
      pallino delle non lette; «Message requests» con il numero.
- [ ] Una richiesta mostra «Accept», «Delete» e «Block», che fanno quello
      che dicono.
- [ ] Un messaggio proprio si cancella, uno dell'altro si segnala.
- [ ] La conversazione aperta si aggiorna da sola; aprirla toglie il
      pallino.
- [ ] Con un'API senza messaggi «Messages» non si vede.
- [ ] Testi approvati dall'utente, nelle cinque lingue.
- [ ] Test, lint, typecheck e prettier verdi.

## Fuori scope

- Foto, vocali, reazioni ai messaggi, messaggi di gruppo.
- L'interruttore «Message requests» in «Settings» (seguito possibile).
- Conferme di lettura, «sta scrivendo…», WebSocket.
- Il server, `preview` e la build dello store: con l'ok dell'utente, dopo
  il merge.

## Dove si è

- 2026-10-26: parte A scritta, `test_messages.py` verde (24 test) con i
  test vicini (moderazione, email delle segnalazioni, push, contratto,
  account). Prossimo: la parte B.

## Esito

*(a fine task)*
