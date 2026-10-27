# TASK-315 — Le foto di un post si scorrono nella scheda del Feed

**Stato**: In corso
**Fase**: 4 · **Branch**: `feat/TASK-315-feed-photos`
**ADR**: aggiunta ad ADR-0227 (deciso dall'agente su delega dell'utente)

## Obiettivo

Richiesta dell'utente del 2026-10-27: «la foto nel feed deve essere
scorribile e visibile dal feed». Oggi la scheda di un post nel Feed mostra
solo il disegno sulla mappa; le foto si vedono solo aprendo il post.

## Contesto

`GET /feed` manda già le foto di ogni post (`photos`, TASK-208,
`drawings.py` `_seen`): serve solo l'app. Le foto si leggono con il token
(`drawingPhotoSource`), come nel disegno aperto (`DrawingCard`).

Condizioni del Coordinatore nell'assegnare il numero:

- la mappa resta la prima pagina, poi le foto, con i puntini **sotto**;
- scorrere le foto non deve girare per sbaglio la pagina dell'app
  (Feed, Draw ed Explore scorrono già in orizzontale);
- si carica solo la foto che si vede, più la successiva;
- un post senza foto resta identico.

## Cosa fare

1. In `FeedPost.tsx`, per un post di un iscritto con foto e qualcuno
   entrato: il riquadro del disegno diventa uno `ScrollView` orizzontale a
   pagine (`pagingEnabled`), il disegno e poi una foto per pagina, larga
   quanto la scheda e alta quanto il disegno.
2. Sotto, un puntino per pagina; acceso quello della pagina mostrata.
3. Le foto oltre la successiva a quella più avanti vista non si caricano
   (un riquadro vuoto); quelle già caricate restano.
4. Lo scorrimento rimbalza ai bordi (default iOS): passare l'ultima foto
   non gira la pagina dell'app.
5. Test deterministici in un file nuovo `FeedPostPhotos.test.tsx`.

## Criteri di accettazione

- [x] Un post con foto le mostra dopo il disegno, lette con il token.
- [x] Un puntino per pagina, acceso quello mostrato dopo uno scorrimento.
- [x] Caricate solo fino alla foto dopo la più avanti vista.
- [x] Un post senza foto, un esempio o nessuno entrato: la scheda di prima.
- [x] Un tocco sulla scheda apre ancora il disegno.
- [x] Nessun testo nuovo; nessuna dipendenza nuova.
- [ ] CI verde; impronta iOS invariata (83793e26).

## File toccati

```
apps/mobile/src/feed/FeedPost.tsx              (le foto a pagine, i puntini)
apps/mobile/src/feed/FeedPostPhotos.test.tsx   (nuovo)
docs/tasks/TASK-315.md                         (nuovo)
docs/DECISIONS.md                              (aggiunta ad ADR-0227)
docs/STATUS.md                                 (una voce in «Completato»)
```

## Fuori scope

- Ingrandire una foto a schermo intero dal Feed: un tocco apre il disegno,
  dove le foto ci sono già.
- Android: l'annidamento è quello delle file orizzontali di «Explore»; se
  sul telefono Android lo scorrimento delle foto girasse la pagina, serve
  un blocco nel `Pager` (file non di questo task).

## Esito

*(al merge)*
