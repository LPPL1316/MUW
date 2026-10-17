# TASK-286 — Cambiare figura dalla mappa del risultato

**Stato**: Done (in `main` con la #513, `52b331f7`, 2026-10-16)
**Fase**: 4 · **Branch**: `feat/TASK-286-change-shape-on-result`
**Dipende da**: TASK-280 (le 12 sagome), TASK-281 («Draw on the map»),
tutti e due in `main`.
**ADR**: aggiunta ad ADR-0245, senza numero nuovo

## Obiettivo

Sulla mappa del risultato (il percorso disegnato, dopo «Draw route» di
«Draw» o dopo «Draw on the map») la figura si cambia **senza tornare
indietro**: una riga di forme e immagini, un tocco ridisegna il percorso
dalla stessa partenza e con la stessa distanza.

## Contesto

Seguito di TASK-281 (`tasks/TASK-281.md`, «Esito»). Scelta dell'utente
del 2026-10-15: «sì, dai la possibilità di cambiare figura dalla mappa»,
confermata con «SI» lo stesso giorno. Numero dal Coordinatore; solo app,
niente server né motore; non nella 1.0.

Oggi, sul risultato, cambiare figura vuol dire «←» (verso «Draw» o verso
la tela di «Draw on the map»), toccare un'altra tessera e di nuovo «Draw
route».

## Contesto da leggere

- `docs/UI.md`: «Il risultato», «Disegnare sulla mappa: «Draw on the
  map»», «I giri e le immagini pronte»
- `docs/DECISIONS.md`: ADR-0245 (punti 7 e 9), ADR-0246, ADR-0202
  (la forma spostata sull'acqua, `near`)
- `apps/mobile/App.tsx` (`onDraw`, `onDrawCanvas`, `RouteOutcome`),
  `src/route/RoutePanel.tsx` (`RouteOutcome`), `src/mapdraw/DrawOnMap.tsx`,
  `useMapCanvas.ts`, `canvasRequest.ts`, `src/route/samplePictures.ts`

## Cosa fare

1. **La riga**, nel pannello del risultato, quando il percorso è arrivato
   (non durante l'attesa né sotto un errore): le 17 forme del catalogo coi
   loro simboli e le 12 immagini pronte di TASK-280, **le stesse tessere
   della tela** di «Draw on the map», senza «+ photo» e senza parole. Sta
   **sopra «Start»**, dopo le tessere «A · B · C», la riga «Try 8 km» e
   gli avvisi: quello che il percorso è, poi un'altra figura, poi le cose
   da fare. La figura del percorso è segnata dal bordo, come sulla tela.
   Con «Paddle» solo le forme (sull'acqua le immagini non si disegnano,
   come in «Draw»).
2. **Un tocco** chiede subito il percorso della figura nuova, con la barra
   dell'attesa e «Cancel» come ogni nuovo disegno:
   - **da «Draw»**: la forma diventa la scelta di «Draw» (interruttore su
     «Shape» e il nome nel campo, come una tessera di «Draw»), l'immagine
     come una di «PICTURES» (interruttore su «Image»); stessa partenza,
     stessa distanza, stesso sport, la penna alzata come la chiede «Draw».
     Sull'acqua una forma spostata con «Move the shape» resta dov'era
     (`near` tenuto);
   - **da «Draw on the map»**: la figura nuova prende il posto di quella
     sulla mappa, **con lo stesso centro e la distanza del percorso**
     (non la stessa grandezza, come fa invece una tessera sulla tela: qui
     si guarda un percorso di quei km); la partenza è il primo punto della
     figura nuova, come per ogni figura della tela.
   - la tessera della figura già sul percorso non fa niente.
3. **Indietro**: «←» e «Cancel» tornano a «Draw» con la scelta nuova, o
   alla tela con la figura nuova; sulla tela «Undo» rimette quella di
   prima, dov'era e grande com'era.
4. **Niente testo nuovo**: le tessere hanno i nomi già tradotti delle
   forme e delle immagini (VoiceOver). Se servisse un titolo sopra la
   riga, prima il sì dell'utente nelle cinque lingue.
5. La riga è **una sola**, `src/mapdraw/FigureTiles.tsx`, usata dalla tela
   e dal risultato: le tessere sono le stesse per costruzione.

## Criteri di accettazione

- [x] Sul risultato di «Draw» la riga mostra 17 forme e 12 immagini, con
      la figura del percorso segnata; con «Paddle» solo le 17 forme;
      durante l'attesa non c'è (test: `mapdraw/FigureTiles.test.tsx`,
      `ChangeFigureApp.test.tsx`; sotto un errore `RouteOutcome` mostra
      solo il problema).
- [x] Da «Draw» una forma chiede `POST /route-jobs` con la stessa
      partenza, distanza e sport, e la penna alzata come «Draw»; un'immagine
      chiede `POST /image-route-jobs` col suo contorno; sull'acqua `near`
      resta; «←» torna a «Draw» con la scelta nuova (test:
      `mapdraw/resultFigure.test.ts`, `mapdraw/ChangeFigureApp.test.tsx`).
- [x] Da «Draw on the map» la figura nuova sta allo stesso centro con la
      distanza del percorso, la richiesta è quella della tela; «←» torna
      alla tela con la figura nuova e «Undo» rimette quella di prima (test:
      `mapdraw/useMapCanvasChange.test.ts`, `ChangeFigureApp.test.tsx`).
- [x] La tela di «Draw on the map» ha le stesse tessere di prima (i test
      di TASK-281 restano verdi).
- [x] Nessuna dipendenza nuova, nessun testo nuovo; `npm run typecheck`,
      `expo lint`, `format:check` e `npm test` (417 file, 3421 test) verdi.

## File toccati

Esistenti, con l'ok del Coordinatore del 2026-10-16 (nessuna PR aperta
né altro worktree li toccava):

```
apps/mobile/App.tsx                       (il tocco sulla riga, poche righe)
apps/mobile/src/route/RoutePanel.tsx      (solo il posto della riga in RouteOutcome)
apps/mobile/src/mapdraw/DrawOnMap.tsx     (usa FigureTiles al posto della sua riga)
apps/mobile/src/mapdraw/useMapCanvas.ts   (changeTo: la figura nuova al posto di quella)
docs/UI.md
docs/DECISIONS.md                         (aggiunta in fondo ad ADR-0245)
docs/STATUS.md                            (solo righe nuove)
docs/tasks/TASK-286.md
```

Nuovi:

```
apps/mobile/src/mapdraw/FigureTiles.tsx
apps/mobile/src/mapdraw/resultFigure.ts
apps/mobile/src/mapdraw/resultFigure.test.ts
apps/mobile/src/mapdraw/FigureTiles.test.tsx
apps/mobile/src/mapdraw/useMapCanvasChange.test.ts
apps/mobile/src/mapdraw/ChangeFigureApp.test.tsx
```

## Fuori scope

- Una foto del telefono o una parola dalla riga del risultato.
- La riga sotto un errore (lì ci sono già le vie d'uscita di TASK-031).
- Gli esempi di «Explore», i giri a tema, il «Feed», i preferiti.
- Server, motore, contratto; pubblicare l'app (lo fa il Coordinatore).

## Esito

2026-10-16: sotto un percorso disegnato, da «Draw» o da «Draw on the
map», sopra «Start» c'è la riga della tela (17 forme e 12 immagini, con
«Paddle» solo le forme), con la figura del percorso segnata. Un tocco
chiede subito il percorso della figura nuova dalla stessa partenza e con
la stessa distanza: da «Draw» la figura diventa la scelta di «Draw» («←»
la ritrova, «Draw route» non la richiede); sull'acqua una forma spostata
resta dov'era; dalla tela la figura nuova prende il posto di quella sulla
mappa, stesso centro e distanza del percorso, e «Undo» rimette la vecchia.
Provato con i test (App intera compresa); non nel simulatore: il tocco
vero su un iPhone resta all'utente, alla prima prova di `preview`.
In `main` con la #513 (`52b331f7`), mergiata dal Coordinatore il
2026-10-16, che la pubblica su `preview` dopo la CI di `main`.


**Provato sull'iPhone dall'utente il 2026-10-17** («provato, funziona tutto»), su `preview` dal gruppo `cd521a21` (`main` `ff786f67`).
