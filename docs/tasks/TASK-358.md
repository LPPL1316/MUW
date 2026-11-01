# TASK-358 — Nei messaggi «Photo» e «Video» aprono la galleria

**Stato**: Done · 2026-10-30
**Fase**: 4 · **Branch**: `fix/TASK-358-attach-picker`
**Numeri**: TASK-358, assegnato dal Coordinatore il 2026-10-30. Bloccava
l'update `production`.

## Obiettivo

Sulla preview 90f4b395 l'utente tocca il «+» nella chat, poi «Photo», e la
galleria non si apre. Alla fine la galleria si apre e la foto arriva nella
chat.

## La causa

Riprodotto nel simulatore (Expo Go 57, iOS 27): «Photo» e «Video» chiudono il
foglio e poi non succede niente; «Drawing» funziona. `pick()` chiudeva il
Modal e chiamava subito `launchImageLibraryAsync`: su iOS la galleria
presentata mentre un Modal si sta chiudendo non compare. La conferma: con
`onDismiss` la galleria si apre. I test con il picker finto non potevano
vederlo.

## Cosa è cambiato

- Il Modal del «+» resta montato con `visible={open}`, e su iOS ciò che si è
  scelto parte da `onDismiss`, quando il foglio è davvero chiuso. Niente
  `setTimeout`.
- Su Android parte subito, come prima: lì non c'è da aspettare.
- `dismissingModal.tsx`, solo per i test: un Modal che dice di essere chiuso,
  come iOS. Il mock di React Native non lo fa mai.

## Criteri di accettazione

- [x] Test che fissa l'ordine: su iOS `onPick` solo dopo la chiusura, una
      volta sola; «Cancel» non apre niente; su Android subito
      (`AttachButton.test.tsx`).
- [x] Nel simulatore, contro un'API locale: «Photo» apre la galleria, la foto
      scelta arriva all'anteprima, «Send» fa `POST /me/message-media` e
      `POST …/messages` (201), la foto si vede nella chat e si apre a tutto
      schermo.
- [x] Nel simulatore «Video» apre la galleria dei video e «Drawing» «Send a
      drawing».
- [x] Nessun testo nuovo, nessuna dipendenza, impronta iOS `83793e26`.

Non provati: l'invio di un video vero (il simulatore non ne ha) e Android.

## File toccati

```
apps/mobile/src/messages/AttachButton.test.tsx
apps/mobile/src/messages/AttachButton.tsx
apps/mobile/src/messages/Attachments.test.tsx
apps/mobile/src/messages/Drawings.test.tsx
apps/mobile/src/messages/dismissingModal.tsx
docs/STATUS.md
docs/tasks/TASK-358.md
```

## Fuori scope

- `ConversationScreen.tsx` non è toccato.
- Le altre gallerie dell'app (foto del profilo, foto del post, immagine di
  «Draw») non partono da un Modal che si chiude.

## Esito

La galleria si apre da «Photo» e «Video» e la foto arriva nella chat, provato
nel simulatore. Da riprovare sul telefono con la preview.
