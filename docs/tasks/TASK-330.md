# TASK-330 — Le foto del Feed si vedono e si scorrono sul telefono

**Stato**: Done (al merge)
**Fase**: 4 · **Branch**: `fix/TASK-330-photo-api-key`

## Obiettivo

Segnalazione dell'utente del 2026-10-29: «L'immagine nel feed non è ancora
visualizzabile e poi, se faccio swipe destra sulla figura quando c'è
un'immagine, mi va nella sezione Draw, ma dovrei vedere l'immagine». Alla
fine, sul telefono, una foto di un post si vede nella scheda del Feed e lo
swipe sulla figura la mostra, senza girare la pagina dell'app.

## Contesto

Due bug, tutti e due nati con TASK-315 (ADR-0275) e invisibili ai test e
in sviluppo:

1. **La foto non arriva.** `drawingPhotoSource` (`api/drawings.ts`) chiede
   la foto con il solo `Authorization`. Il server (`api.getmuw.app`) ha
   `SHAPEROUTE_API_KEY` e risponde `401 unauthorized` a ogni richiesta senza
   `X-API-Key` (provato con curl il 2026-10-29 su
   `/drawings/{id}/photos/1`). In sviluppo l'API sul Mac non ha chiave, per
   questo funzionava. Vale per il Feed, la galleria del profilo (TASK-324) e
   il disegno aperto (le foto di un altro).
2. **Lo swipe gira la pagina.** Su iOS, React Native (Fabric) non lascia
   scorrere uno `ScrollView` se un suo antenato è il destinatario JS del
   tocco: `RCTScrollViewComponentView` → `touchesShouldCancelInContentView`
   → `_shouldDisableScrollInteraction`, che sale i `superview` cercando
   `isJSResponder`. La scheda del Feed è tutta un `Pressable`, che diventa
   il destinatario del tocco: le foto restano ferme e il gesto lo prende il
   `Pager` (Feed → Draw). Le file di «Explore» non lo hanno perché lì i
   `Pressable` stanno dentro lo `ScrollView`, non intorno.

Riprodotti tutti e due nel simulatore iOS (Expo Go 57.0.9) con il `Pager`
vero, la scheda vera del Feed e un finto server delle foto che risponde 401
senza chiave: prima della correzione lo swipe sulla figura portava a Draw;
la stessa scheda senza `Pressable` scorreva alla foto.

## Cosa fare

1. `drawingPhotoSource`: `X-API-Key` (la chiave dell'app, `apiKey()`) più
   il token, come ogni altra chiamata e come le foto delle città
   (`NearbyTowns.tsx`).
2. `FeedPost.tsx`: con le foto, ogni pagina dello scorrimento (il disegno e
   ogni foto) è un `Pressable` suo, con gli stessi `onPressIn`/`onPress`
   della scheda. Il tocco che parte sulle foto lo prende la pagina, che sta
   **dentro** lo `ScrollView`: le foto scorrono. Il resto della scheda
   (nome, titolo) resta il `Pressable` di prima; un post senza foto è
   identico.
3. Test deterministici in file nuovi.

## Criteri di accettazione

- [x] Una foto di un disegno si chiede con `X-API-Key` e il token; senza
      chiave, con il solo token.
- [x] Nella scheda del Feed il disegno e ogni foto prendono il tocco da
      soli; un tocco su una foto apre il disegno; un dito che si è mosso
      non apre.
- [x] Nel simulatore iOS: lo swipe sulla figura mostra la foto e la pagina
      resta sul Feed; oltre l'ultima foto rimbalza e non va su Draw.
- [x] Test di `src/feed`, `src/social`, `src/profile`, `src/api` verdi.
- [ ] CI verde.

## File toccati

```
apps/mobile/src/api/drawings.ts                   (la chiave con la foto)
apps/mobile/src/api/drawingPhotoSource.test.ts    (nuovo)
apps/mobile/src/feed/FeedPost.tsx                 (una pagina, un tocco)
apps/mobile/src/feed/FeedPostPhotoTap.test.tsx    (nuovo)
docs/tasks/TASK-330.md                            (nuovo)
docs/STATUS.md                                    (una voce in «Completato»)
```

Solo JavaScript: nessun file nativo, nessuna dipendenza, nessun testo
nuovo; l'impronta iOS non cambia (83793e26).

## Fuori scope

- Un post appena pubblicato compare nel Feed (con le sue foto) solo dopo
  averlo tirato giù o riaperto l'app: il Feed si legge una volta per
  apertura (`useFeed`). Non cambiato qui.
- Il video nei post (chiesto dall'utente nello stesso messaggio): è una
  funzione nuova, con scelte di prodotto; va proposta a parte.

## Esito

Le foto si chiedono con la chiave e la striscia delle foto prende il tocco
da sola: nel simulatore lo swipe sulla figura mostra la foto e resta sul
Feed. La correzione arriva sul telefono con il prossimo aggiornamento OTA.
