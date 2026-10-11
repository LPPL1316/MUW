# TASK-281 — «Draw on the map»: disegnare e spostare la figura sulla mappa della città

**Stato**: Todo
**Fase**: 4 · **Branch**: `feat/TASK-281-draw-on-map`

## Obiettivo

Da «Draw» si apre una schermata con la mappa della città scelta, dove si
disegna col dito, oppure si mette una forma del catalogo o un'immagine e
la si trascina dove si vuole. La figura si cambia senza uscire. Poi
«Draw route» fa il percorso partendo da lì, con la grandezza disegnata.

## Contesto

Chiesto dall'utente il 2026-10-11 con due richieste, nella sessione
«Explore e Draw: profilo e disegno mappa»; numeri dal Coordinatore:
- «Nella sezione draw aggiungere la possibilità di avere una tavola di
  disegno sulla cartina della città selezionata e poi dare la possibilità
  di muoversi sulla mappa»;
- «Nella sezione disegna dare la possibilità di cambiare figura da
  dentro, aggiungere un immagine e spostarla da sopra la mappa».

**Scelte dell'utente del 2026-10-11**:
- le due richieste sono **una schermata sola**, «Draw on the map»: la
  mappa della città, in basso l'interruttore **Disegna / Muovi**, una
  riga di forme e immagini da cambiare senza uscire, e la figura messa
  sulla mappa si trascina col dito (scartato: due schermate separate);
- **in due passi**: questo task è il primo, **solo app**. Il motore fa il
  percorso partendo da dove la figura è stata disegnata o messa, con la
  grandezza disegnata, e può spostarlo di qualche centinaio di metri per
  trovare le strade. Il secondo passo, il percorso proprio dove la figura
  è stata messa, è **TASK-282** (motore, dopo l'approvazione di Apple).
  Scartato: aspettare e fare tutto insieme dopo Apple.

Oggi non c'è niente di simile: la tavola di «Edit the outline» (TASK-079)
disegna sopra una foto, non sulla mappa; spostare una forma col dito
c'è solo sull'acqua (TASK-238, `near`, che il motore accetta solo con
«Paddle»: `NEAR_ON_WATER_ONLY`). Questo task non cambia il contratto: usa
le richieste che esistono.

## Contesto da leggere

- `docs/UI.md`: «Forma e distanza», «L'immagine (TASK-073)», «Il
  risultato», «Sull'acqua: «Paddle»» (spostare la forma, TASK-238)
- `docs/DECISIONS.md`: ADR-0068, ADR-0069, ADR-0074 (la tavola), ADR-0202
  (spostare la forma sull'acqua)
- `docs/API.md`: `POST /route-jobs`, `POST /image-route-jobs`
- `apps/mobile/src/map/MapView.tsx`, `mapPage.ts`, `messages.ts`,
  `coordinates.ts`; `src/paddle/shapeMove.ts`, `useMoveShape.ts`,
  `MoveShape.tsx`; `src/route/OutlineBoard.tsx`, `boardView.ts`,
  `drawnLine.ts`

## Cosa fare

1. **Prima del codice, una domanda all'utente**: da dove si apre.
   Proposta: un tasto «Draw on the map» sotto l'interruttore
   «Shape | Word | Image» di «Draw»; scartabile per un quarto segmento
   «Map».
2. **La schermata**, a tutto schermo come la mappa del percorso: «←», il
   nome della città, la mappa (la città di partenza di «Draw», o quella
   cercata), e in basso:
   - l'interruttore **«Draw | Move»**: con «Draw» un dito traccia una
     linea gialla e la mappa sta ferma; con «Move» un dito sposta la mappa
     (o la figura, se il dito parte sopra di lei) e due dita la
     ingrandiscono;
   - «Undo», che toglie l'ultimo tratto o l'ultima figura messa;
   - una riga che scorre di lato con le forme del catalogo, le sagome di
     TASK-280 se è già in `main`, e «+ photo» (una foto dal telefono, il
     cui contorno lo traccia il motore come in «Image»). Un tocco mette la
     figura al centro della mappa; un'altra tessera la **cambia** lì
     dov'è, con la stessa grandezza;
   - la distanza che la figura farebbe, letta dalla grandezza sulla mappa
     («≈ 6.2 km»), e «Draw route».
3. **Grandezza**: due dita sopra la figura la ingrandiscono o la
   rimpiccioliscono; la distanza resta nei limiti dell'app (la stessa
   di «Draw»), e oltre il limite la figura non cresce più.
4. **«Draw route»**, senza cambiare il contratto:
   - linea disegnata a dito: chiusa dall'app (l'ultimo punto torna al
     primo), centrata e portata in [-1, 1] come `ImageOutline.points`,
     mandata con `POST /image-route-jobs`; `start` il primo punto
     disegnato, `distance_m` il perimetro in metri;
   - forma del catalogo: `POST /route-jobs` con `shape`, `start` il punto
     della figura più vicino al suo inizio, `distance_m` dalla grandezza;
   - immagine: come la linea, con il contorno dell'immagine.
   Il calcolo in metri, mai in gradi (`CLAUDE.md`): la linea sulla mappa
   si porta su un piano in metri attorno al suo centro.
5. Il risultato si apre come un percorso di «Draw», con i suoi «Start»,
   GPX e alternative; «←» torna alla schermata con la figura com'era,
   così cambiarla non vuol dire ricominciare. Se l'utente vuole cambiare
   figura anche dalla mappa del risultato, è una domanda da fargli, non
   da decidere qui.
6. Il tocco sulla mappa si legge nella pagina MapLibre (messaggi nuovi in
   `messages.ts`, come `setMove`/`moved` di TASK-238): la pagina dà i
   punti già in lat/lon.
7. Con «Paddle» il tasto non c'è (sull'acqua la forma si sposta già, con
   TASK-238).
8. Testi nuovi approvati dall'utente nelle cinque lingue; `UI.md`
   aggiornato; nuova ADR (numero dal Coordinatore).

## Criteri di accettazione

- [ ] Con «Draw» un dito traccia una linea sulla mappa ferma; con «Move»
      la mappa si sposta e si ingrandisce (test della logica dei gesti).
- [ ] Una tessera mette la figura al centro; un'altra la sostituisce lì
      dov'è con la stessa grandezza; «Undo» toglie l'ultima cosa (test).
- [ ] La figura si trascina col dito e si ingrandisce con due dita, e la
      distanza mostrata segue la grandezza (test).
- [ ] «Draw route» manda per la linea e per l'immagine un
      `ImageRouteRequest` valido (contorno chiuso in [-1, 1], `start`,
      `distance_m` in metri interi) e per una forma un `RouteRequest`
      (test sulle richieste).
- [ ] Il risultato si apre come in «Draw» e «←» torna alla figura com'era
      (test).
- [ ] Provato nel simulatore iOS con screenshot in `out/task-281/`;
      il dito vero sull'iPhone resta all'utente.
- [ ] Nessuna dipendenza nuova; testi approvati; `npm test`, `expo lint`,
      `format:check` verdi.

## File toccati

Previsti; la sessione li conferma all'inizio. Il grosso in file nuovi
(cartella `src/mapdraw/`). `App.tsx` e `ChooseScreen.tsx` li tocca anche
TASK-280: l'ordine dei merge lo dà il Coordinatore.

```
apps/mobile/src/mapdraw/*                 (nuovi)
apps/mobile/src/map/MapView.tsx
apps/mobile/src/map/mapPage.ts
apps/mobile/src/map/messages.ts
apps/mobile/src/screens/ChooseScreen.tsx
apps/mobile/App.tsx
apps/mobile/src/i18n/*                    (solo le stringhe nuove)
docs/UI.md
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-281.md
```

## Fuori scope

- Il percorso proprio dove la figura è stata messa: TASK-282.
- Ruotare la figura a mano (se l'utente lo chiede, task a parte).
- Parole sulla mappa.
- Cambi al contratto, all'API o al motore.
- Pubblicare l'app: lo fa il Coordinatore.

## Esito

*(a fine task)*
