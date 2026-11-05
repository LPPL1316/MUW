# TASK-391 — Lo swipe che arriva su «Messages» o sul profilo: niente pagina che si svuota

**Stato**: In revisione · 2026-11-05
**Fase**: 4 · **Branch**: `fix/TASK-391-tab-landing-flash`
**Numeri**: TASK-391, assegnato dal Coordinatore; nessun ADR nuovo, una
precisazione sotto ADR-0323 (lo swipe di TASK-379).

## Obiettivo

Segnalazione dell'utente del 2026-11-05, con un video registrato sul
telefono: «escono questi bag tra la ricerca ed il profilo e anche sui
messaggi fa uno scattino». Lo swipe fra «Explore» (la lente) e il profilo
mostra un difetto, e arrivando su «Messages» la pagina fa uno scatto.

## La causa

Prima dello swipe (TASK-379) una scheda compariva di colpo, quindi
ricostruirla quando arrivava sullo schermo non si vedeva. Con lo swipe la
pagina accanto è già visibile mentre scorre, e l'app la ricostruiva solo
quando lo swipe si fermava:

- il profilo (`OwnProfile`, `key={visit}`) rinasceva vuoto: numeri,
  record, liste di chi segue e foto sparivano e tornavano, e la pagina si
  accorciava e si riallungava;
- «Messages» (`ConversationList`, `key={visit}`) mostrava «Loading…» al
  posto delle conversazioni appena viste scorrere, poi di nuovo la lista.

## Cosa cambia

- «Messages» rilegge la lista ogni volta che arriva sullo schermo, come
  prima, ma sul posto: le conversazioni restano finché arriva la lista
  nuova (`ConversationList` prende `visit` e rilegge quando cambia).
- Il profilo si ricostruisce quando lo si lascia per un'altra scheda, fuori
  vista: chi ci torna lo trova intero, in cima, letto di nuovo dall'ultima
  visita. Dopo una pagina aperta sopra l'app («Settings», le liste…) si
  ricostruisce al ritorno, come prima. Un tocco sulla scheda già attiva lo
  ricostruisce in cima, come prima.
- `TabShell` e `TabBar` non cambiano (sono di TASK-388).

## Criteri di accettazione

- [x] Tornando su «Messages» la lista viene richiesta di nuovo e resta a
      schermo, senza «Loading…», finché arriva quella nuova: test.
- [x] Il profilo si ricostruisce quando lascia lo schermo e non quando lo
      swipe ci arriva: test.
- [x] Dopo una pagina del profilo aperta sopra l'app, il ritorno lo
      ricostruisce: test.
- [x] Test dei file toccati e dei vicini verdi (42 file, 300 test), `tsc`,
      lint e Prettier puliti.
- [ ] Visto sul telefono con la preview (l'utente).

## File toccati

```
apps/mobile/src/tabs/MessagesPage.tsx
apps/mobile/src/messages/ConversationList.tsx
apps/mobile/src/screens/ProfileLayer.tsx
apps/mobile/src/tabs/TabLanding.test.tsx   (nuovo)
docs/tasks/TASK-391.md                     (nuovo)
docs/DECISIONS.md                          (precisazione sotto ADR-0323, righe aggiunte)
docs/STATUS.md                             (righe aggiunte)
```

Solo app, nessun testo nuovo, nessuna dipendenza: impronta iOS invariata,
arriva con un OTA. Il video dell'utente non si è potuto aprire (macOS blocca
il file temporaneo di Foto): la causa è stata trovata nel codice.
