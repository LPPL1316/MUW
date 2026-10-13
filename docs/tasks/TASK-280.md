# TASK-280 — Sotto «Draw»: i tour della città e le immagini pronte

**Stato**: In lavorazione
**Fase**: 4 · **Branch**: `feat/TASK-280-draw-tours-pictures`

## Obiettivo

In fondo alla pagina «Draw», sotto la distanza, due righe che scorrono di
lato: «CITY TOURS», i giri a tema nella città di partenza, e «PICTURES»,
una dozzina di sagome pronte che diventano un percorso con un tocco.

## Contesto

Chiesto dall'utente il 2026-10-11 («Sotto draw nella sezione draw
inserisci i tour delle città o immagini varie»), nella sessione «Explore e
Draw: profilo e disegno mappa»; numero dal Coordinatore.

**Scelta dell'utente del 2026-10-11**: «Tour e immagini», tutte e due le
righe. Scartati: solo i tour; solo le immagini.

Le due cose esistono già altrove, e qui si riusano:
- **i tour** sono i percorsi a tema di «Explore», «Ask for a route» con le
  categorie (Famous Places, Best Views, Hidden Gems…; TASK-134,
  ADR-0099): l'AI legge la richiesta, i luoghi sono veri, il percorso lo
  fa il motore. API già sul server;
- **le immagini** sono «Image» di «Draw» (TASK-073, ADR-0068/0069): il
  motore traccia il contorno di una foto e ne fa un percorso
  (`POST /image-outlines`, `POST /image-route-jobs`). API già sul server.

Solo app. Può partire mentre Apple prova la 1.0; va su `preview`.

**Scelte dell'utente del 2026-10-13** (chieste in chat con le opzioni):
- sagome: «Dodici, razzo»: bici, scarpa da corsa, dinosauro, chitarra,
  Torre Eiffel, razzo, cuore con freccia, ancora, aereo, gelato,
  palloncino, foglia (il razzo al posto del Colosseo). Scartati: le dodici
  col Colosseo; otto;
- giri: «Quattro»: Famous Places, Best Views, Hidden Gems, Romantic.
  Scartati: cinque con Food; tutte e tredici;
- il nome della città: con la partenza dal GPS l'app non lo sa e nessuna
  API lo dice. Scelta «Sempre, near your start»: etichetta «CITY TOURS»,
  sotto ogni categoria «near your start» (o «near Trento» da un luogo
  cercato). Scartati: la riga solo con un luogo cercato; un indirizzo
  nuovo dell'API (server, fuori da questo task).

## Contesto da leggere

- `docs/UI.md`: «Le due schermate» (la pagina «Draw»), «L'immagine
  (TASK-073)», «Explore» (le categorie di «Ask for a route»)
- `docs/DECISIONS.md`: ADR-0068, ADR-0069, ADR-0099
- `apps/mobile/src/screens/ChooseScreen.tsx`,
  `src/explore/themedRoutes.ts`, `useThemedRoute.ts`, `AskForRoute.tsx`,
  `src/route/ImageChoice.tsx`, `useImageOutline.ts`, `pickImage.ts`

## Cosa fare

1. **Prima del codice, due domande all'utente, una alla volta**:
   - quali sagome. Proposta: dodici, disegnate da noi (nessuna immagine di
     altri, niente licenze): bici, scarpa da corsa, dinosauro, chitarra,
     Torre Eiffel, Colosseo, cuore con freccia, ancora, aereo, gelato,
     palloncino, foglia. Ognuna una sola figura scura su fondo chiaro,
     come vuole il tracciato (`IMAGE_REASONS`);
   - quali giri. Proposta: quattro delle categorie di «Ask for a route»
     (Famous Places, Best Views, Hidden Gems, Romantic; in «Explore» la
     prima è Food), nella città di partenza di «Draw».
2. **«CITY TOURS · {città}»**: una riga di tasti, uno per categoria. Un
   tocco chiede il giro come «Ask for a route» in «Explore»
   (`themed.ask`), e si apre la mappa coi luoghi; «←» torna a «Draw».
   Senza una città di partenza nota, la riga non c'è.
3. **«PICTURES»**: una riga di tessere con la sagoma. Un tocco porta
   l'interruttore su «Image» con quella sagoma già scelta, il contorno
   e «Edit the outline» come per una foto; «Draw route» fa il resto.
   Per non far aspettare il tracciato, il contorno di ogni sagoma può
   stare nell'app (calcolato una volta dal motore con uno strumento in
   `tools/`, file nuovo): scelta tecnica della sessione, da scrivere in
   `DECISIONS.md`.
4. Le due righe stanno nella parte che scorre, sopra «Draw route», che
   resta fermo in fondo. Con «Bike» uguale; con «Paddle» le righe non ci
   sono (sull'acqua non ci sono città né foto).
5. Testi nuovi (le due etichette, eventuali nomi delle sagome per
   VoiceOver) approvati dall'utente nelle cinque lingue prima del merge.
6. `UI.md` aggiornato; nuova ADR (numero dal Coordinatore).

## Criteri di accettazione

- [ ] La riga dei giri mostra le categorie scelte con il nome della città
      di partenza; un tocco chiede il giro a tema e apre la mappa (test).
- [ ] La riga delle sagome ne mostra quante l'utente ha scelto; un tocco
      passa a «Image» con la sagoma e il suo contorno (test).
- [ ] «Draw route» con una sagoma manda `POST /image-route-jobs` con il
      contorno della sagoma (test).
- [ ] Con «Paddle» le due righe non ci sono (test).
- [ ] Le sagome sono file dell'app disegnati da noi, senza licenze di
      altri; nessuna dipendenza nuova.
- [ ] Testi approvati; `npm test`, `expo lint`, `format:check` verdi.

## File toccati

Confermati dalla sessione (2026-10-13). `ChooseScreen.tsx` non cambia: le
due righe sono figlie della pagina, messe da `App.tsx`. In più, con l'ok del
Coordinatore, `ThemedCard.tsx` per «Back to Draw».

```
apps/mobile/App.tsx
apps/mobile/src/explore/ThemedCard.tsx       (solo «Back to Draw»)
apps/mobile/src/route/DrawIdeas.tsx          (nuovo)
apps/mobile/src/route/DrawIdeas.test.tsx     (nuovo)
apps/mobile/src/route/samplePictures.ts      (nuovo)
apps/mobile/src/route/samplePictures.json    (nuovo, scritto dallo strumento)
apps/mobile/src/route/samplePictures.test.ts (nuovo)
apps/mobile/src/route/useImageOutline.ts
apps/mobile/__tests__/AppDrawIdeas.test.tsx  (nuovo)
apps/mobile/assets/pictures/*.png            (nuovi, dodici)
apps/mobile/src/i18n/{it,de,es,fr}.ts        (solo le stringhe nuove)
tools/sample_pictures.py                     (nuovo)
tools/test_sample_pictures.py                (nuovo)
docs/UI.md
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-280.md
```

## Fuori scope

- Nuove categorie di giri o cambi al server dei percorsi a tema.
- Immagini scaricate da internet o caricate da altri iscritti.
- Mettere la sagoma sulla mappa e trascinarla: è TASK-281.
- Pubblicare l'app: lo fa il Coordinatore.

## Esito

*(a fine task)*
