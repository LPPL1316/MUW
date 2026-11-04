# TASK-379 — Lo swipe fra le schede, con la barra in basso

**Stato**: In corso — documenti e scelte dell'utente fatte (2026-11-04);
codice dopo la lista dei file mandata al Coordinatore
**Fase**: 4 · **Branch**: `docs/TASK-379-tab-swipe` (documenti),
`feat/TASK-379-tab-swipe` (codice) · **ADR**: ADR-0323 · numeri dal
Coordinatore (2026-11-04)

## Obiettivo

Richiesta dell'utente del 2026-11-04: «poter swippare da una scheda all'altra
slidando verso destra e sinistra con il dito».

La barra di schede in basso di TASK-367 resta com'è: si aggiunge lo swipe
orizzontale fra le pagine, come c'era con le pagine affiancate di TASK-154.
ADR-0311 al punto 3 aveva scelto «niente swipe fra le pagine»: ADR-0323 lo
corregge, il resto di ADR-0311 resta.

## Contesto da leggere

- `DECISIONS.md` ADR-0311 (la barra), ADR-0124 (le pagine affiancate),
  ADR-0323.
- `tasks/TASK-367.md`, `tasks/TASK-154.md` (il `Pager`, tolto con `d68e6838`).
- `tasks/TASK-350.md`: una `Pressable` attorno a uno `ScrollView` lo blocca;
  dall'ultima pagina della foto lo swipe passa alla fila.
- `tasks/TASK-366.md`: i `Modal` aperti dalle pagine e il margine alto.
- `apps/mobile/src/tabs/`.

## Cosa c'è oggi

Letto il codice di `main` (`c79a97b1`) il 2026-11-04.

- `TabShell` tiene le pagine una sopra l'altra: quella fuori vista ha
  `display: none`, resta costruita con scroll e campi. Un tocco sulla barra
  mostra la pagina subito.
- Cinque schede: Feed, Draw, Messages (costruita al primo arrivo), Explore
  (al primo arrivo: chiede i percorsi solo allora), il profilo. Senza account
  «Messages» porta al profilo: lo decide `App.tsx` in `onPage`.
- Il tocco sulla scheda già attiva torna in cima (`useTabReselect`); su
  Android «indietro» torna alla scheda di prima (una pila); il giro guidato
  sposta le pagine per nome (`useTourPager`, `tourPart`); le pagine ricevono
  margini alto e basso a zero (li tengono header e barra).
- Il `Pager` di TASK-154 era uno `ScrollView` orizzontale a pagine
  (`pagingEnabled`, `bounces={false}`, `directionalLockEnabled`,
  `keyboardDismissMode="on-drag"`): costruiva una pagina appena entrava nello
  schermo e cambiava pagina a fine scorrimento.

## I gesti orizzontali dentro le pagine

Un gesto che parte su uno di questi resta suo. L'elenco è fatto su `main`;
con il codice ogni riga ha l'esito e, dove si può, un test.

| Pagina | Cosa | Componente | Oggi |
|---|---|---|---|
| Feed | foto e disegno di un post | `feed/FeedPost.tsx` | `ScrollView` a pagine, rimbalza ai bordi: «uno swipe oltre l'ultima foto resta qui» (scritto per il `Pager`) |
| Feed | post dei concorsi | `contest/ContestGallery.tsx`, `ContestPage.tsx`, `WinnerCard.tsx` | usano `FeedPost` |
| Draw | le forme, le figure | `route/ShapeTiles.tsx`, `ShapeGrid.tsx`, `mapdraw/FigureTiles.tsx` | righe orizzontali |
| Draw | «NEAR YOU», l'attesa del percorso | `route/NearYou.tsx`, `route/WhileRouting.tsx` | righe di schede |
| Explore | le file di schede | `explore/RecommendedRow.tsx`, `CityWords.tsx`, `NearbyTowns.tsx`, `IdeasFromEurope.tsx`, `RideItYourself.tsx`, `ExploreTools.tsx` | righe orizzontali |
| Explore | il disegno e poi la foto | `explore/RouteCard.tsx` (TASK-350) | `ScrollView` a pagine con `bounces={false}`: dall'ultima pagina passa alla fila |
| Explore | la ricerca | `search/SearchScreen.tsx`, `StartState.tsx` | righe orizzontali |
| Explore sull'acqua | le file di schede | `paddle/PaddleExplore.tsx` | righe orizzontali |
| Profilo | disegni, preferiti | `social/DrawingsGrid.tsx`, `favorites/FavoritesList.tsx` | schede `RouteCard` |

- **Mappe**: dentro le pagine non ce n'è una che si trascina. Le mappe del
  Feed, di Explore e del Profilo sono immagini (`feed/FeedMaps.tsx` le scatta
  da una `WebView` nascosta); la mappa vera (`map/MapView.tsx`: disegno sulla
  mappa, percorso, corsa) prende lo schermo intero e lì barra e pagine non ci
  sono.
- **Slider**: nessuno nelle pagine (`search/FilterButton.tsx` lo nomina solo).
- **`PanResponder`**: `OutlineBoard`, `PostImage`, `PostComposer` stanno in un
  `Modal`, `RunDashboard` nella corsa: fuori dalle pagine.
- **Campi di testo**: un dito che sposta il cursore non deve cambiare pagina.

## Scelte dell'utente

Una alla volta, con la proposta già pronta; le risposte con le sue parole.

1. **La pagina segue il dito**, con le pagine affiancate che scorrono come
   prima di TASK-367, oppure cambia di colpo alla fine del gesto.
   Proposta: segue il dito.
   — *Risposta:* «Segue il dito».
2. **Dall'ultima scheda si torna alla prima?** Proposta: no, si ferma.
   — *Risposta:* «Torna alla prima»: dal profilo uno swipe porta al Feed, e
   dal Feed all'indietro al profilo, in giro continuo.
3. **Su quali schede funziona.** Proposta: tutte e cinque, salvo quando il
   gesto parte su un carosello o una fila di schede.
   — *Risposta:* «Tutte e cinque».

## Cosa fare

1. `tabs/TabShell.tsx`: lo swipe fra le pagine come scelto dall'utente, senza
   dipendenze nuove (React Native di base). Restano: pagine costruite al
   primo arrivo (anche quando entrano nello schermo durante lo swipe) e poi
   tenute; tocco sulla scheda attiva che torna in cima; «indietro» di
   Android; il giro guidato; VoiceOver (schede `tab` con stato `selected`, la
   pagina fuori vista nascosta al lettore); il margine zero alle pagine.
2. Un tocco sulla barra mostra la pagina subito, come oggi: non scorre sopra
   le pagine in mezzo e non le costruisce.
3. Ogni riga dell'elenco qui sopra provata: test dove si può, simulatore per
   il resto.
4. `docs/UI.md` («Le pagine e la barra di schede»), `STATUS.md`, ADR-0323.

## Criteri di accettazione

- [ ] Uno swipe a destra o a sinistra porta alla scheda accanto, la pagina
      segue il dito e la barra la segue: test.
- [ ] Dal profilo si va al Feed e dal Feed al profilo, in giro: test.
- [ ] Le pagine costruite restano con scroll e campi; una pagina pigra si
      costruisce quando ci si arriva, non prima: test.
- [ ] Tocco sulla scheda attiva, «indietro» di Android, giro guidato, stato
      `selected` per VoiceOver come prima: test.
- [ ] Un gesto che parte su un carosello o una fila resta suo: elenco con
      l'esito di ogni riga.
- [ ] Nessun colore a mano, nessuna dipendenza nuova, impronta iOS
      `6f8bba4cf1b6f95fc3c1c84ba9812d950a2232a1` su una copia pulita.
- [ ] Prima e dopo dal simulatore, in scuro e in chiaro.

## File toccati

Questa PR:

```
docs/tasks/TASK-379.md                (nuovo)
docs/DECISIONS.md                     (ADR-0323, righe aggiunte)
docs/STATUS.md                        (righe aggiunte)
docs/INDEX.md                         (una riga)
```

Codice: la lista va al Coordinatore prima di scriverlo.

## Fuori scope

- Il contenuto delle pagine e i componenti dell'elenco: se uno di loro va
  cambiato perché il suo gesto resti suo, lo si segnala al Coordinatore.
- La Guida: dice «tocca una scheda per andarci», e resta vero. Una frase
  sullo swipe sarebbe un testo nuovo da far approvare.
- Android oltre ai test: la prova è sul simulatore iOS.
- Un OTA di produzione: col sì dell'utente.

## Esito

*(da scrivere)*
