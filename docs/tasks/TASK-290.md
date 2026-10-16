# TASK-290 — Le sagome di «PICTURES» che vengono bene in città

**Stato**: In revisione (PR #520, aspetta «merge 520» dal Coordinatore)
**Fase**: 4 · **Branch**: `feat/TASK-290-better-draw-pictures`
**Dipende da**: TASK-280 (le dodici sagome, ADR-0246)
**ADR**: aggiunta ad ADR-0246

## Obiettivo

Provare le sagome di «PICTURES» (sotto «Draw», e nelle righe di «Draw on
the map» e della mappa del risultato) come percorsi veri in città diverse,
togliere quelle che non si riconoscono e aggiungerne di nuove che vengono
bene.

## Contesto

Chiesto dall'utente il 2026-10-16: «le immagini che hai aggiunto sotto la
sezione draw le hai un po provate nelle varie città? come vengono? in caso
aggiungine altre che vengono bene e togli quelle più brutte». Numero dal
Coordinatore.

Le dodici sagome di TASK-280 sono state scelte guardando il disegno e il
contorno, non il percorso. Il motore fa il percorso del **contorno
esterno**: quello che sta dentro la figura (raggi, buchi, venature) non
c'è, e le parti sottili diventano una strada sola o spariscono.

## Contesto da leggere

- `docs/DECISIONS.md`: ADR-0246 (le sagome), ADR-0068/0069 (il contorno
  di un'immagine)
- `tools/sample_pictures.py`, `tools/test_sample_pictures.py`
- `apps/mobile/src/route/samplePictures.ts`

## Cosa fare

1. Pianificare ogni sagoma come `POST /image-route-jobs` (lo stesso
   `plan_request` dell'API, con le partenze vicine) in otto città con
   strade diverse: Trento, Milano, Roma, Parigi, Barcellona, Londra,
   Chicago, Torino; a 5 e a 10 km. Le zone sono copie di quelle del
   server (sola lettura): Overpass non risponde.
2. Guardare i percorsi (la somiglianza del motore non basta: è sopra 0,9
   anche per un percorso che non si riconosce) e dare un giudizio per
   sagoma.
3. Togliere le sagome che non si riconoscono; disegnarne di nuove nello
   strumento, provarle allo stesso modo e tenere quelle che vengono bene.
   Niente doppioni delle forme di «Draw» (`SHAPES`).
4. Nomi nuovi tradotti nelle cinque lingue, da far approvare all'utente
   prima del merge.
5. Test dell'app e di `tools/` aggiornati dove nominano una sagoma tolta.

## Criteri di accettazione

- [x] In «Esito» il giudizio di ogni sagoma provata, vecchia e nuova, con
      le città dove viene e dove no.
- [x] Le sagome tolte non ci sono più (PNG, contorno, nome, traduzioni);
      quelle nuove sì, disegnate dallo strumento, senza immagini d'altri.
- [x] `npm test`, `expo lint`, `tsc`, `format:check` e i test di `tools/`
      verdi.
- [x] Nomi nuovi approvati dall'utente nelle cinque lingue (2026-10-16).

## File toccati

```
tools/sample_pictures.py
tools/test_sample_pictures.py
apps/mobile/src/route/samplePictures.ts
apps/mobile/src/route/samplePictures.json
apps/mobile/src/route/samplePictures.test.ts
apps/mobile/src/route/DrawIdeas.test.tsx
apps/mobile/src/mapdraw/ChangeFigureApp.test.tsx   (solo il conteggio)
apps/mobile/src/mapdraw/FigureTiles.tsx            (solo il commento)
apps/mobile/assets/pictures/*.png            (nuovi e tolti)
apps/mobile/src/i18n/{it,de,es,fr}.ts        (solo i nomi delle sagome)
docs/UI.md
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-290.md
```

## Fuori scope

- Il motore e il modo in cui traccia un'immagine.
- Le forme di «Draw» (`SHAPES`) e il server.
- Pubblicare l'app: lo fa il Coordinatore.

## Esito

Provate il 2026-10-16: 546 percorsi, nessun errore (12 sagome di
TASK-280 e 29 nuove, otto città, 5 e 10 km; le nuove più deboli lasciate
dopo le prime città). Giudizio guardando i percorsi:

| Sagoma | 5 km | 10 km | Esito |
|---|---|---|---|
| dinosauro | bene ovunque | bene ovunque | tenuta |
| Torre Eiffel | bene (Trento meno) | bene ovunque | tenuta |
| aereo | bene (Milano, Torino meno) | bene | tenuta |
| chitarra | bene | bene | tenuta |
| palloncino | bene (Trento meno) | bene | tenuta |
| razzo | macchia in metà città | bene | tenuta, in fondo |
| scarpa da corsa | si legge in 4 città su 8 | bene | tenuta, in fondo |
| foglia | così così | bene | tenuta, in fondo |
| bici | macchia ovunque | due gobbe, non una bici | **tolta** |
| cuore con freccia | la freccia sparisce | idem | **tolta** |
| ancora | groviglio (bene a Chicago) | solo 4 città | **tolta** |
| gelato | un ovale | un ovale | **tolta** |
| fungo | bene ovunque | bene ovunque | **nuova** |
| auto | bene ovunque | bene (Trento meno) | **nuova** |
| maglietta | bene ovunque | bene ovunque | **nuova** |
| paperella | bene (Chicago squadrata) | bene | **nuova** |
| stivale | bene ovunque | bene ovunque | **nuova** |
| casa | bene, si vede la porta | bene | **nuova** |
| osso | bene (Trento meno) | bene | **nuova** |
| coppa | bene (Trento meno) | bene | **nuova** |
| cactus, corona, freccia, nota | solo in qualche città | meglio | scartate |
| pollice in su, campana, diamante, pizza, fulmine | forma generica | idem | scartate |
| balena, veliero, castello, orsetto, elefante, mano, robot, tartaruga, pinguino, pupazzo di neve, guanto, tazza | dettagli persi | idem | scartate |

Sedici sagome nella riga, le più chiare prima: dinosauro, fungo, auto,
Torre Eiffel, maglietta, aereo, stivale, chitarra, casa, palloncino,
paperella, coppa, osso, razzo, scarpa da corsa, foglia. Più due file
fuori dall'elenco iniziale, con l'ok del Coordinatore da chiedere: il
conteggio delle tessere in `mapdraw/ChangeFigureApp.test.tsx` (29 → 33)
e il commento di `mapdraw/FigureTiles.tsx` («12» → «16»).
`FigureTiles.test.tsx` e `AppDrawIdeas.test.tsx` non cambiano (usano la
foglia, che resta). `npm test` (417 suite, 3425 test), `tsc`, `expo lint`,
`format:check`, i test di `tools/` (50), `ruff` e `black` verdi.

**Approvato dall'utente il 2026-10-16**: «I approve the eight new names in
all five languages and removing the bike, heart with arrow, anchor and ice
cream».
