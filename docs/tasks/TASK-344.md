# TASK-344 — Cercare i disegni dalla lente del Feed

**Stato**: In corso — documenti, poi parte A (server), poi B (app)
**Fase**: 4 · **Branch**: `feat/TASK-344-a-drawing-search` (A),
`feat/TASK-344-b-search-screen` (B) · **ADR**: ADR-0297 · numeri dal
coordinatore (2026-10-29)

## Obiettivo

La lente del Feed apre una ricerca a tutto schermo che trova i disegni
(dei membri e d'esempio), le persone e i percorsi d'esempio, con filtri e
ordinamento.

Richiesta dell'utente del 2026-10-29: una ricerca dei disegni GPS dalla
lente del Feed, con schede, filtri in un foglio dal basso, ricerche
recenti, categorie suggerite, «Disegni in evidenza», griglia a due colonne,
caricamento a scheletro e pagine infinite.

**Scelte dell'utente** (2026-10-29). L'agente ha proposto sei punti; la
risposta dell'utente, con le sue parole: **«Sì, vai»**. I sei punti
approvati:

1. **Discipline**: corsa, bici, pagaia (quelle dell'app), non il cammino.
2. **Categorie**: solo quelle che le forme del catalogo hanno davvero:
   Animali, Cuori, Scritte, Simboli, Emoji. Niente «Ritratti» né «Cammino
   di Santiago».
3. **Schede**: «All · Drawings · People · Routes». Un post è un disegno,
   quindi niente «Post»; «People» riusa la ricerca di «Find friends»,
   «Routes» cerca gli esempi di «Explore».
4. **La lente** apre la nuova ricerca, non più «Find friends»; il resto
   del Feed non cambia.
5. **Due parti**: A il server (`GET /search/drawings`), B l'app.
6. **Gli esempi** hanno categoria, paese e complessità ricavati dalla forma
   e dalla linea; il punteggio fa da popolarità; nessuna data inventata.

Condizioni del coordinatore (2026-10-29):

- i testi vanno in `src/i18n/*.ts`, **mai** in `apps/mobile/locales/*.json`
  (stringhe native dei permessi iOS: l'impronta resta `83793e26`);
- prima di toccare `ProfileLayer.tsx` e i file del Feed, chiedere al
  coordinatore: il redesign TASK-339 tocca Feed, Profile e i fogli nelle
  sue parti B–D;
- un indice (per esempio `pg_trgm`) è una migrazione: va chiesto, e prende
  il primo numero libero al merge;
- i tempi misurati su un database con almeno 10.000 disegni finti, scritti
  qui; i bloccati restano fuori e i disegni «Only me» non escono mai,
  nemmeno cercando per nome: un test per ciascuno;
- il server si aggiorna solo col sì dell'utente; B è solo OTA;
- l'ordine: la PR dei documenti, poi A, poi B.

## Contesto da leggere

- `docs/DECISIONS.md` ADR-0297 (e ADR-0227 per il feed);
- `docs/API.md` «Feed» e «Drawing search»;
- `services/api/shaperoute_api/feed.py` (chi vede cosa, il cursore).

## Cosa fare

### Parte A — il server

1. `GET /search/drawings` in `drawing_search.py`, installato in `app.py`
   dopo il feed: le parole `q`, `named` (le forme che le parole nominano
   nella lingua dell'app), i filtri `shape`, `activity`, `min_m`/`max_m`,
   `place`, `complexity`, l'ordine `sort` (`recent`, `longest`,
   `popular`), `limit` e `cursor`. Una pagina è un `FeedPage`.
2. Maiuscole e accenti non contano: la parola, piegata in Python, diventa
   un'espressione regolare con ogni lettera e le sue accentate
   (`pattern_of`), sul testo in minuscolo. Nessuna migrazione.
3. La complessità si legge dall'anteprima della traccia (al più 64 punti),
   su un piano con le longitudini accorciate dal coseno della latitudine:
   lunghezza diviso diagonale del rettangolo che la contiene, sotto 3,6
   `simple`, sotto 4,5 `medium`, oltre `complex` (soglie tarate sugli
   esempi del Feed: cerchio 3,0, cuore 3,0, stella 3,1–3,5, cavallo
   3,9–4,2, testa di cane 4,9, lumaca 5,3).
4. Tipi in `shared-types` (`DrawingSearchPage`, `DRAWING_SORTS`,
   `DRAWING_COMPLEXITIES`, le soglie), `docs/API.md`.
5. Tempi misurati su 10.000 disegni finti (`out/TASK-344/`).

### Parte B — l'app

1. Cartella nuova `src/search/`: `SearchScreen`, `searchDoor`,
   `SearchBar`, `FilterChip`, `FilterButton`, `FilterSheet`,
   `StartState`, `ResultsGrid`, `DrawingResultCard`, `SkeletonCard`,
   `EmptyResults`, `useDrawingSearch` (attesa di 300 ms), `drawingMatch`
   (gli esempi, con le stesse regole del server), `searchFilters`,
   `recentSearches` (con `keptList`), `categories`; `api/searchDrawings.ts`.
2. La lente (`FindFriendsButton.tsx`, `ProfileLayer.tsx`) apre la ricerca.
3. Gli esempi (`tools/sample_feed.py`, `sampleFeed.json`): categoria e
   paese.
4. Testi in inglese, italiano, tedesco, spagnolo e francese in
   `src/i18n/*.ts` (mai in `locales/`): vanno approvati dall'utente.

## Criteri di accettazione

### Parte A

- [ ] Le parole trovano un disegno dal titolo, dalla descrizione, dalla
      forma, dalla parola, dal titolo del percorso, dal posto e dal nome
      dell'autore; «Cuore» trova «cuore», «citta» trova «Città».
- [ ] Più parole vogliono tutte: «cane trento» non trova il cane di Bari.
- [ ] `named` trova le forme nominate anche quando le parole non sono nel
      testo («cuore» con `named=heart`).
- [ ] Ogni filtro toglie ciò che non è suo; più valori dello stesso filtro
      si sommano.
- [ ] Mai un disegno «Only me», nemmeno il proprio e nemmeno cercando per
      nome dell'autore; i «followers» solo a chi segue.
- [ ] Mai un disegno di un membro bloccato o che ha bloccato, nei due
      sensi.
- [ ] Le pagine non ripetono e non saltano nessuno, in ognuno dei tre
      ordini; un cursore di un altro ordine è `422`.
- [ ] I tempi su 10.000 disegni sono misurati e scritti qui sotto
      («I tempi»); nessuna ricerca costa più del feed sullo stesso database.

### I tempi (parte A, 2026-10-30)

10.000 disegni finti pubblicati da un membro, sul PostgreSQL di prova del
Mac (colima), con `ANALYZE`; script e piani in `out/TASK-344/` (fuori da
git). Solo l'SQL, con `EXPLAIN ANALYZE` e il JIT spento come nell'API:

| Ricerca | SQL |
|---|---|
| niente chiesto (`recent`) | 2,3 ms |
| `complexity=simple` | 3,9 ms |
| `q=cuore` con `named=heart` | 10,1 ms |
| `sort=longest` | 283 ms |
| `q=heart`, `q=citta`, `q=xyz` (nessuno) | 377–405 ms |
| `sort=popular` | 465 ms |
| `q=sunday heart trento` | 599 ms |

Con la richiesta intera (client di prova): da 295 a 760 ms; `GET /feed`
sullo stesso database circa 1.050 ms. Quando una ricerca legge tutti i
disegni, circa 200 ms sono il controllo dei blocchi riga per riga
(`shown_sql`, lo stesso del feed), il resto il confronto delle parole. Un
indice trigram non aiuta: le parole stanno in tre tabelle. Il criterio
di partenza, «meno di 300 ms», vale per le ricerche che si fermano presto
(niente parole, filtri, `named`), non per quelle che leggono tutto.

### Parte B

- [ ] *(da scrivere quando parte: testi, schermate, prove)*

## File toccati

```
docs/tasks/TASK-344.md      (PR dei documenti)
docs/STATUS.md              (PR dei documenti)
docs/DECISIONS.md           (PR dei documenti)
docs/API.md
services/api/shaperoute_api/drawing_search.py
services/api/shaperoute_api/app.py
services/api/tests/test_drawing_search.py
packages/shared-types/src/index.ts
```

Parte B, in più: `apps/mobile/src/search/*` (nuovi),
`apps/mobile/src/api/searchDrawings.ts` (nuovo),
`apps/mobile/src/social/FindFriendsButton.tsx`,
`apps/mobile/src/screens/ProfileLayer.tsx`,
`apps/mobile/src/feed/sampleFeed.json`, `tools/sample_feed.py`,
`apps/mobile/src/i18n/{it,de,es,fr}.ts`, `docs/UI.md`.

## Fuori scope

- Un indice o una migrazione per la ricerca: si aggiungono solo se i tempi
  su 10.000 disegni non bastano.
- I post del Feed stesso, il suo ordine e la sua scheda.
- Cercare nei commenti.
- Hashtag come campo a sé: si trovano già nella descrizione.

## Esito

*(si compila a fine task)*
