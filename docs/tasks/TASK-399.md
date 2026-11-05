# TASK-399 — Nel Feed il nome di chi ha pubblicato apre il suo profilo

**Stato**: In review — PR `fix/TASK-399-feed-author-profile`
**Fase**: 4 · **Branch**: `fix/TASK-399-feed-author-profile` · numero
dato dal Coordinatore il 2026-11-05

## Obiettivo

Nel Feed, toccare il nome (o l'iniziale) di chi ha pubblicato un disegno
apre il suo profilo, come un nome taggato (TASK-208) e la foto di chi
commenta (TASK-338).

Richiesta dell'utente del 2026-11-05: «Nel feed, quando premo sull'utente
rocche, ad esempio, non mi apre il suo profilo fai sì che si apre sul
profilo».

## Causa

In `FeedPost` la riga con l'iniziale, il nome, la città e il giorno stava
dentro il pulsante dell'intera card: il tocco apriva il disegno.

## Cosa fare

1. Sul disegno di un iscritto la riga del nome diventa un pulsante a sé,
   fuori da quello della card (come il «…» e l'`ActionBar`): chiama
   `openProfile` di `followsDoor` con `public_id`, nome e foto `null`, come
   i tag.
2. Lo stesso controllo della card sul dito che scorre: la fine di uno
   scorrimento sopra il nome non apre niente.
3. La card sotto il nome perde gli angoli in alto, che sono del post: a
   vista non cambia niente.
4. Un esempio (nessun autore) resta com'era: il nome è solo testo e il
   tocco apre il percorso.
5. Un autore bloccato: la card sparisce già (TASK-121), quindi niente da
   aprire.

## Criteri di accettazione

- [x] Toccare il nome o l'iniziale di un iscritto apre il suo profilo e
      non il disegno (`FeedPostAuthor.test.tsx`).
- [x] La fine di uno scorrimento sopra il nome non apre il profilo.
- [x] Il resto della card apre ancora il disegno.
- [x] Il nome di un esempio non è un pulsante.
- [x] VoiceOver legge il nome come pulsante «{name}'s profile» (testo già
      tradotto); la card resta un elemento a parte.
- [x] Nessun testo nuovo, nessuna dipendenza; solo JS, l'impronta iOS
      (`6f8bba4c`) non cambia.

## File toccati

```
apps/mobile/src/feed/FeedPost.tsx
apps/mobile/src/feed/FeedPostAuthor.test.tsx      (nuovo)
apps/mobile/src/screens/FeedScreenPosts.test.tsx  (riga 148, sì del Coordinatore)
docs/STATUS.md
docs/tasks/TASK-399.md                            (nuovo)
```

## Esito

Il nome di chi ha pubblicato è un pulsante verso il suo profilo. Il test
di `FeedScreenPosts` che apriva il secondo disegno toccando il nome ora
tocca la card. 27 test verdi su `FeedPost`, `FeedPostAuthor` e
`FeedScreenPosts`; 110 su `src/feed/FeedPost*`, `snowFeed` e
`src/screens/FeedScreen*` (uno rosso prima della correzione della riga 148).
