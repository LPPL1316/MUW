# TASK-338 — La foto di chi commenta apre il suo profilo

**Stato**: Done — PR `fix/TASK-338-comment-author-profile`
**Fase**: 4 · **Branch**: `fix/TASK-338-comment-author-profile` · numero
dato dal Coordinatore il 2026-10-29

## Obiettivo

Nel foglio dei commenti di un post, toccare la foto di chi ha scritto un
commento apre il suo profilo.

Richiesta dell'utente del 2026-10-29: «Nei commenti di un post se clicco
sull'immagine dell'autore del commento deve riportarti sul suo profilo».

## Contesto da leggere

- `docs/DECISIONS.md`, ADR-0175 (i commenti), con il punto 8 di questo
  task;
- `docs/UI.md`, «I commenti di un disegno».

## Cosa fare

1. In `CommentsSheet` la foto della riga diventa un pulsante: chiude il
   foglio e chiama `openProfile` di `followsDoor` con chi ha scritto, come
   i nomi taggati in `DrawingCard`.
2. Il tocco arriva a `MIN_TAP_SIZE` con `hitSlop`; tenuta premuta, la foto
   dà le stesse scelte della riga (segnala, blocca, cancella).
3. Per VoiceOver la riga è un solo elemento: il profilo è un'azione in
   più, «{name}'s profile» (testo già tradotto).
4. Un autore bloccato non apre il profilo, come altrove (richiesta del
   Coordinatore): con `useBlockedNow` la foto non è più un pulsante e
   l'azione sparisce.

## Criteri di accettazione

- [x] Toccare la foto di un altro apre il suo profilo (`public_id`, nome,
      foto `null` come i tag) e il foglio si chiude
      (`DrawingComments.test.tsx`).
- [x] La propria foto apre il proprio profilo: `openSomeone` di
      `ProfileLayer` porta alla propria pagina, come per un tag.
- [x] Tenere premuta la foto dà ancora «Report or block» e non apre il
      profilo.
- [x] VoiceOver ha l'azione «profile» con «{name}'s profile» su ogni riga.
- [x] Un autore bloccato mentre il foglio è aperto: niente pulsante sulla
      foto, niente azione, `openProfile` mai chiamato.
- [x] Nessun testo nuovo, nessuna dipendenza, impronta iOS `83793e26`
      invariata su una copia pulita della testa.

## File toccati

```
apps/mobile/src/social/DrawingComments.tsx
apps/mobile/src/social/DrawingComments.test.tsx
docs/DECISIONS.md
docs/STATUS.md
docs/UI.md
docs/tasks/TASK-338.md                           (nuovo)
```

## Esito

La foto di chi ha scritto un commento è un pulsante verso il suo profilo;
il foglio si chiude prima; un autore bloccato non apre niente. 20 test
del foglio verdi, 336 in `src/social`, `src/feed` e `ProfileLayer`.
