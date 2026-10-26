# TASK-307 — Correre il disegno di un altro, e scaricarne la traccia

**Stato**: In corso
**Fase**: 4 · **Branch**: `feat/TASK-307-start-friend-track`

## Obiettivo

Chi apre il disegno di un altro iscritto (dal «Feed» o dai «Drawings» del
suo profilo) può **partire** su quella traccia e **scaricarla** come GPX.
Richiesta dell'utente del 2026-10-26: «quando entri in un'attività di un
tuo amico, nei suoi disegni e nel feed, poter scaricare la traccia e
poterla iniziare pure tu». Numero e regole dal Coordinatore (ADR-0267).

## Contesto da leggere

- `docs/UI.md`, «Drawings» (la scheda del disegno aperto sulla mappa).
- `docs/GPX.md`, «Struttura» e «La corsa fatta».
- `docs/DECISIONS.md` ADR-0159 (la traccia tagliata), ADR-0117
  (`/route-directions`), ADR-0033 (il foglio di condivisione).

## Cosa fare

1. Sulla scheda del disegno aperto (`DrawingCard`, la stessa dal Feed e
   dal profilo) aggiungere «Start» (giallo, come in «Explore») ed «Export
   GPX», solo se la traccia ha almeno due punti.
2. Il GPX si scrive **sul telefono** dalla traccia che l'app ha già: la
   stessa della mappa, senza i primi e gli ultimi 200 m, **senza tempi**,
   senza autore, senza quote. Un `<trk>`, un `<trkseg>`, 7 decimali, nome
   del file `muw-<forma>-<km>km.gpx`. Nessuna chiamata all'API.
3. «Start» segue la traccia come percorso **senza indicazioni delle
   svolte**: una traccia GPS non sta sui nodi del grafo, e
   `/route-directions` la rifiuta. Sotto «Start» la scheda lo dice: «This
   route has no turn directions: follow the line on the map.» (testo
   nuovo, nelle cinque lingue). Bici e acqua come il disegno è stato fatto;
   in acqua prima l'avviso, come ogni percorso là; la mappa girata come il
   disegno (TASK-232).
4. La corsa salvata dice cosa disegnava (forma, parola, titolo del
   percorso) e ha come percorso la traccia; la somiglianza è il punteggio
   del disegno, come per gli esempi di «Feed» (TASK-188).
5. Fine corsa (o Stop prima di partire): si torna al disegno, e da lì «←»
   o «Back to the profile» tornano dove era stato aperto («Feed», il
   profilo).

## Criteri di accettazione

- [x] Dal «Feed» e dal profilo di un altro, la scheda del disegno ha
      «Start» ed «Export GPX»; senza traccia nessuno dei due.
- [x] «Start» parte subito, senza chiamare `/route-directions`, e la mappa
      mostra la traccia del disegno come percorso.
- [x] «Export GPX» apre il foglio di condivisione con un GPX senza
      `<time>` e senza il nome di chi ha corso; se il telefono non può
      condividere, «The GPX could not be made. Try again.».
- [x] La corsa salvata manda `shape`, `word`, `points` = traccia,
      `similarity` = punteggio / 100.
- [x] Fine corsa → di nuovo il disegno → «←» → «Feed».
- [ ] Il testo nuovo approvato dall'utente nelle cinque lingue.
- [ ] La scelta dell'utente: chi pubblica può dire di no ai download?
      (sotto, «Domande aperte»).
- [x] Test deterministici verdi in locale (`npm run test`: 469 file).

## File toccati

```
apps/mobile/App.tsx
apps/mobile/src/social/DrawingCard.tsx
apps/mobile/src/social/drawingRoute.ts                (nuovo)
apps/mobile/src/social/drawingRoute.test.ts           (nuovo)
apps/mobile/src/social/useDrawingGpx.ts               (nuovo)
apps/mobile/src/social/DrawingCardStart.test.tsx      (nuovo)
apps/mobile/__tests__/AppDrawingStart.test.tsx        (nuovo)
apps/mobile/__tests__/AppFeedDrawing.test.tsx
apps/mobile/src/i18n/it.ts
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/fr.ts
apps/mobile/src/i18n/es.ts
docs/tasks/TASK-307.md                                (nuovo)
docs/STATUS.md
docs/DECISIONS.md
docs/UI.md
docs/GPX.md
```

## Fuori scope

- **Le svolte a voce sulla traccia di un altro**: servirebbe agganciare
  la traccia GPS alle strade (map-matching) nell'engine e in
  `/route-directions`. Un task a parte, se l'utente lo vuole.
- **Un «no» di chi pubblica ai download** (interruttore per post o in
  «Settings»): API, migrazione e app. Solo se l'utente lo sceglie.
- La riga della pagina «Privacy»: è un testo legale, lo decide l'utente
  (proposta sotto).
- «Start» ed «Export GPX» sulle schede del «Feed» senza aprirle.

## Domande aperte (per l'utente)

1. **Il «no» ai download.** Oggi chi pubblica sa che gli altri *vedono*
   la traccia tagliata; non che la possono *scaricare*. Proposta: nessun
   interruttore per ora, perché il file ha esattamente ciò che la mappa
   già mostra (senza i 200 m di casa, senza orari); una riga nella pagina
   «Privacy»: «Who can see a drawing of yours can also run it and save
   its line as a GPX file: the same line the map shows, without its first
   and last 200 m and without times.»
2. **Il testo nuovo** sotto «Start»: «This route has no turn directions:
   follow the line on the map.» — it «Questo percorso non ha le
   indicazioni delle svolte: segui la linea sulla mappa.», de, fr, es nel
   codice.

## Esito

*(a fine task)*
