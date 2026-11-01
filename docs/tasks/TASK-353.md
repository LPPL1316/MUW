# TASK-353 — La chat: orari, giorni, quanti messaggi nuovi, i vecchi scorrendo

**Stato**: In corso
**Fase**: 4 · **Branch**: `feat/TASK-353-chat-look`
**ADR**: ADR-0305 · **Numeri**: TASK-353 / ADR-0305, assegnati dal
Coordinatore il 2026-10-30. Il passo dopo è TASK-354 (invio ottimistico e
coda offline), che parte quando questo è in `main`.

## Obiettivo

Nei messaggi privati si vede quando è stato scritto ogni messaggio, e
nell'elenco quanti ce ne sono di nuovi. Piano confermato dall'utente il
2026-10-30: «Sì, passi 1 e 2».

## Contesto da leggere

- `docs/DECISIONS.md` ADR-0279 (i messaggi) e ADR-0289 (gli allegati)
- `docs/API.md` «Messages», `docs/UI.md` «I messaggi privati»

## Cosa fare

1. Sotto ogni messaggio l'orario, sopra il primo di ogni giorno un titolo:
   «Today», «Yesterday» o la data intera.
2. Nell'elenco l'orario, «Yesterday» o il giorno accanto a ogni
   conversazione, e il numero rosso dei messaggi nuovi al posto del pallino.
3. API: `unread_count` in `GET /me/conversations`, senza migrazione, ricavato
   da `read_at`. Con un server di prima l'app mostra il pallino.
4. I messaggi vecchi arrivano scorrendo verso l'alto. «Show earlier
   messages» resta solo per quando il caricamento è fallito.

## Criteri di accettazione

- [x] Orario e titoli dei giorni sull'orologio del telefono; «Yesterday»
      regge i giorni di 23 e 25 ore, i cambi di mese e di anno
      (`messageTime.test.ts`).
- [x] Il numero rosso si ferma a «9+»; `unread_count` si ferma a 10
      (`test_the_count_stops_at_its_most`, `ChatLook.test.tsx`).
- [x] Con un server senza `unread_count` l'app mostra il pallino e accetta
      la risposta (`ChatLook.test.tsx`).
- [x] Il conteggio non rallenta l'elenco: misurato con 2000 conversazioni
      (sotto).
- [x] Scorrendo si chiede la pagina una volta sola; se fallisce il tasto
      resta e richiede (`ChatLook.test.tsx`).
- [x] Testi nuovi approvati dall'utente, in cinque lingue: «Approvo»
      (2026-10-30, tabella sotto).
- [x] Impronta iOS `83793e26` su una copia pulita (664687ad, con `npm ci`).
- [ ] Provato sul telefono: l'aspetto delle bolle e dell'elenco e lo
      scorrimento vero non sono coperti dai test.

## File toccati

```
apps/mobile/src/activities/activityText.ts
apps/mobile/src/api/messages.ts
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/es.ts
apps/mobile/src/i18n/fr.ts
apps/mobile/src/i18n/it.ts
apps/mobile/src/messages/Attachments.test.tsx
apps/mobile/src/messages/ChatLook.test.tsx
apps/mobile/src/messages/ConversationList.tsx
apps/mobile/src/messages/ConversationScreen.tsx
apps/mobile/src/messages/Drawings.test.tsx
apps/mobile/src/messages/Messages.test.tsx
apps/mobile/src/messages/MessagesRow.tsx
apps/mobile/src/messages/messageTime.test.ts
apps/mobile/src/messages/messageTime.ts
docs/API.md
docs/DECISIONS.md
docs/INDEX.md
docs/STATUS.md
docs/UI.md
docs/tasks/TASK-353.md
packages/shared-types/fixtures/conversations.json
packages/shared-types/src/index.ts
services/api/shaperoute_api/messages.py
services/api/tests/test_messages.py
```

## Fuori scope

- Invio ottimistico, coda offline, barra di avanzamento: TASK-354.
- «Sta scrivendo…» e tempo reale, posizione, vocali, fotocamera: i passi
  3–5 del piano, ancora senza task.
- Conferme di lettura: ADR-0279 dice di no, e lo promette la privacy.

## Testi nuovi, approvati

| Inglese | Italiano | Tedesco | Francese | Spagnolo |
|---|---|---|---|---|
| Today | Oggi | Heute | Aujourd’hui | Hoy |
| Yesterday | Ieri | Gestern | Hier | Ayer |
| {day} {month} | {day} {month} | {day}. {month} | {day} {month} | {day} {month} |
| {name}, {count} new messages: {text} (VoiceOver) | {name}, {count} nuovi messaggi: {text} | {name}, {count} neue Nachrichten: {text} | {name}, {count} nouveaux messages : {text} | {name}, {count} mensajes nuevos: {text} |

## Dove si è

La misura del 2026-10-30, su PostgreSQL in Docker sul Mac: un account con
2000 conversazioni, 220.001 messaggi, una conversazione da 21.100. Una
pagina da 20, mediana di 9 prove:

| | Prima (`EXISTS`) | Dopo (conteggio solo sulla pagina) |
|---|---|---|
| Tutto non letto | 173 ms | 211 ms |
| Tutto letto | 178 ms | 143 ms |

Il primo tentativo, con il conteggio dentro la query della pagina, costava
647 ms invece di 125: la query legge tutte le conversazioni per ordinarle.
Per questo il conteggio è una query a parte, solo sulla pagina.

## Esito

*(si compila a fine task)*
