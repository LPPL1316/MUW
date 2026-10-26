# TASK-298 — Fermarsi prima nella ricerca quando la forma non entra nelle strade

**Stato**: Done
**Fase**: 4 · **Branch**: `feat/TASK-298-stop-earlier`
**Dipende da**: TASK-297 (la misura di ADR-0257 che l'ha aperto), TASK-232
(le fasi dritta e inclinata della ricerca), TASK-203 B (la ricerca lontana
solo dove nulla si disegna)
**ADR**: ADR-0259

## Obiettivo

Una ricerca che non troverà un percorso buono smette prima di spendere tutti
i suoi 30 tracciamenti, senza perdere nessun percorso buono che oggi trova:
l'utente aspetta meno per la stessa risposta di oggi («nessun percorso», o
il percorso mediocre con gli avvisi).

## Contesto da leggere

- `docs/ROUTE_ENGINE.md` §5, «Strategia di ricerca» e «Forme inclinate»
  (le fasi, i 20 + 10 tracciamenti, la rifinitura e la lucidatura).
- `docs/DECISIONS.md`, ADR-0257 (la misura di Trento che ha trovato i 19
  casi su 36 che bruciano i 30 tracciamenti) e ADR-0259 (questo task).
- `services/route-engine/route_engine/optimizer.py`, `search` (`go`,
  `best_placement`, `rescale`, `polish`).

## Le condizioni del Coordinatore (2026-10-24)

1. **Prima misura, poi regola**: su quale tracciamento compare il primo
   percorso buono oggi e quanti ne servono, nelle 36 richieste di Trento e
   in più città; si contano i tracciamenti, non i secondi.
2. La regola tiene **tutti** i percorsi buoni di oggi (o dice esattamente
   quale perde e perché) e taglia i casi che bruciano il budget.
3. Quando si ferma, l'utente riceve la risposta di oggi: nessun codice né
   messaggio nuovo; la regola sta nel motore, vale anche sul telefono.
4. Catalogo ed esempi misurati prima e dopo: nessuna forma deve peggiorare;
   le impronte di `tests/test_kept_per_graph.py` che cambiano, spiegate.
5. Test deterministici sulle città finte; `ROUTE_ENGINE.md` §5, ADR-0259,
   questo file, `STATUS.md`.

## Cosa fare

1. Misurare: `tests/measure_stop_earlier.py` (nuovo) esegue
   `optimizer.search` come la chiama l'API (con `doubled`) per cuore,
   stella, gatto, lumaca e luna da 5 km e il cuore da 2 km, da sei partenze
   attorno al centro (le 36 richieste di ADR-0257), e scrive ogni
   tracciamento in JSON; `--compare` mette prima e dopo fianco a fianco.
   Città: Trento (zona in cache sul Mac) e Rovereto, Levico, Bologna,
   Milano, Roma, Chicago (zone copiate dal server in sola lettura, fuori dal
   repository).
2. Dai numeri, le regole che non perdono nessun percorso buono; quelle che
   ne perdono, scritte in ADR-0259 con che cosa perderebbero.
3. La regola in `optimizer.py`, `search`; i test in
   `tests/test_stop_earlier.py` sulle città finte di `test_kept_per_graph`;
   le impronte che cambiano aggiornate e spiegate.
4. `engine.zip` rifatto (`tools/phone_engine/phone_engine.py engine`): la
   CI lo confronta col motore.

## Le misure (2026-10-24/25, Mac; tracciamenti, non secondi)

252 richieste in sette città, con la chiamata dell'API (`doubled`): a
Trento così i buoni sono 16 su 36, non i 17 di ADR-0257 (la stella alla
terza partenza sta a 0,86).

| | richieste | buone | tracciamenti | di cui nei casi senza percorso buono |
|---|---|---|---|---|
| prima | 252 | 129 | 4 627 | 3 581 (77 %) nei 123 casi |

- Il primo percorso buono compare a **qualunque** tracciamento: 13 casi
  dopo il 20º, due al 30º di 30. 14 buoni su 129 vengono dalla fase
  inclinata (anche dal suo 5º e 6º piazzamento), 5 dal 6º piazzamento
  dritto, 14 dalla rifinitura della rotazione, 1 dalla lucidatura.
- Resa per posto nella ricerca (buoni ogni 100 tracciamenti): primo e
  secondo piazzamento dritto 5,5; terzo e quarto 3–4; sesto 2,5;
  rifinitura dritta 3,1; piazzamenti inclinati 0–3 (il primo inclinato 0
  su 413 tracciamenti, ma prepara gli altri).
- «N piazzamenti senza miglioramento» (del costo o della somiglianza) perde
  da 10 (N = 4) a 38 (N = 1) buoni su 129. La somiglianza del primo
  tracciamento di un piazzamento non predice nulla: sale anche da 0,42 a
  0,91 cambiando la scala. Il conteggio delle strade è 1,00 in testa alla
  classifica quasi ovunque in città: non distingue.
- Saltare la fase inclinata quando da dritta la somiglianza migliore è
  sotto 0,85 perde 1 buono (Rovereto, luna: dritta 0,81, inclinata buona
  al 6º piazzamento); sotto 0,80 non perde nulla sulle 252 con margine
  0,009; sotto 0,75 non perde nulla con margine 0,06 e vale 209
  tracciamenti (4,5 %). **Non adottata**: le sette città hanno griglie
  quasi nord-sud; un paese le cui strade disegnano la forma solo inclinata
  (il test di TASK-232, da dritta 0,29) non è nel campione, e in città a
  griglia diagonale la regola spegnerebbe proprio la fase di TASK-232.
  Sulla città finta spegne anche percorsi mediocri ma decenti (una stella
  0,87 fra le alternative, un cuore 0,80 da una partenza vicina).
- La rifinitura della rotazione (±5–15° attorno al piazzamento migliore)
  ha dato percorsi buoni solo dove la fase aveva già un piazzamento a 0,86
  o più; saltarla quando il migliore è sotto 0,80 non perde buoni. Provata
  sulle 252 insieme ai duplicati: tracciamenti 4 627 → 4 566 (−1,3 %; nei
  123 casi senza buono −1,6 %, perché il budget liberato lo spende la fase
  inclinata), ma 6 risultati mediocri su 123 peggiorano fino a −0,13 e uno
  scende sotto 0,60 (Levico, gatto: da percorso mediocre a «nessun
  percorso»); nella città finta la stella da 3 km da 0,73 a 0,59.
  **Scartata.**
- 62 tracciamenti su 4 627 (1,3 %) sono **duplicati esatti**: la secante
  rimanda alla scala al bordo di `SCALE_RANGE` già tracciata per lo stesso
  piazzamento, e il tracciato era già noto. **Adottata**, l'unica: la
  ricerca fa gli stessi tentativi di oggi più qualcuno in coda alla fase.

Prima/dopo con la regola adottata (sette città, 252 richieste, stesse
richieste e stesse zone):

| | buone | tracciamenti | di cui senza percorso buono | mediocri cambiati |
|---|---|---|---|---|
| prima (`main`, #497 compreso) | 129 | 4 627 | 3 581 | — |
| dopo | 129, identiche | 4619 | 3576 | 1 migliore (Roma, cuore da 2 km: da 0,56 a 0,60), 0 peggiori |

I secondi non si confrontano (la stessa misura è durata 690 s e 171 s a
Mac carico e scarico, con risultati identici).

Per la scelta di prodotto (un tetto ai tracciamenti, sulle 252 richieste
misurate; «tracciamenti» è il costo del motore, i secondi vanno in
proporzione):

| tetto | tracciamenti (oggi 4 627) | buoni persi su 129 |
|---|---|---|
| 28 | 4 431 (−4 %) | 2 (Rovereto stella, Bologna luna: al 30º) |
| 25 | 4 098 (−11 %) | 5 (più Rovereto cuore al 27º, Milano lumaca al 27º, Chicago cuore 2 km al 28º) |
| 22 | 3 713 (−20 %) | 9 (più Trento lumaca al 24º, Milano cuore 2 km al 23º e 25º, Roma stella al 23º) |
| 20, cioè senza la fase inclinata | 3 443 (−26 %) | 12 (i 14 buoni della fase inclinata meno i 2 trovati entro il 20º, più nessun altro) |
| 15 | 2 756 (−40 %) | 19 |

Ogni percorso buono perso è un utente che oggi riceve un disegno buono e
domani ne riceverebbe uno mediocre o nessuno, per risparmiare 6–14 s sui
casi che oggi non trovano niente.

## Criteri di accettazione

- [x] Le 129 richieste buone delle sette città danno lo stesso percorso,
      punto per punto (tre con un tracciamento in meno: il duplicato).
- [x] Nessun tracciamento ripete piazzamento e scala di uno già fatto; dove
      la ricerca non converge il costo del percorso restituito non sale.
- [x] Le impronte di `test_kept_per_graph.py` che cambiano sono tutte di
      casi che oggi non convergono, e la PR dice come cambiano.
- [x] `pytest -m "not network"`, `ruff`, `black` e `pytest tools` verdi;
      `engine.zip` rifatto.

## File toccati

```
services/route-engine/route_engine/optimizer.py
services/route-engine/tests/test_stop_earlier.py        (nuovo)
services/route-engine/tests/measure_stop_earlier.py     (nuovo)
services/route-engine/tests/test_kept_per_graph.py      (impronte)
services/route-engine/tests/test_far_search_skipped.py  (le stesse impronte)
apps/mobile/assets/engine/engine.zip
docs/ROUTE_ENGINE.md
docs/DECISIONS.md
docs/tasks/TASK-298.md
docs/STATUS.md
```

## Fuori scope

- Parametri nuovi nella richiesta, cambi al contratto dell'API, l'app.
- Un tetto più basso di 30 tracciamenti o piazzamenti saltati: perdono
  percorsi buoni (misurato, sopra); se l'utente vuole scambiare percorsi
  per velocità, è una scelta di prodotto da fare con i numeri di ADR-0259.
- Il tempo delle partenze vicine (`nearby_starts.py`) e la ricerca lontana.
- Il risolutore della scala (la secante che rimbalza sui bordi): cambiarlo
  cambierebbe i percorsi che oggi convergono.

## Al merge

- `draw_examples` (anche `--water`) sul server, con l'ok dell'utente dopo
  Apple; `engine.zip` è nella PR; `paddleExamples.json` e
  `catalogueShapes.json` solo se le loro impronte cambiano (le forme non
  cambiano: `catalogueShapes.json` no).

## Esito

Misurato su 252 richieste in sette città: con questa ricerca fermarsi prima
senza perdere percorsi buoni non si può (il primo buono compare anche al 30º
tracciamento, dal 6º piazzamento inclinato), e le due regole che tengono i
buoni (fase inclinata e rifinitura saltate dopo una fase andata male)
peggiorano i risultati mediocri senza abbreviare: scartate, con i numeri in
ADR-0259. Resta la regola che non ripete un tracciamento (1,3 %): i buoni
identici, i mediocri mai peggiori. Il taglio vero è una scelta di prodotto
da fare con quei numeri, in un task suo. `tests/measure_stop_earlier.py`
rifà la misura. PR #558 (2026-10-25), al merge del Coordinatore.
