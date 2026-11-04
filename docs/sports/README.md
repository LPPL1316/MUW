# Sport — misure, scoperte comuni, ricetta

Cartella condivisa degli sport (TASK-376, ADR-0320). Ogni sport ha **un file
suo**, `<sport>.md`, con le misure del banco e quello che ha imparato:
nessuno scrive nel file di un altro.

| File | Cosa c'è | Chi lo scrive |
|---|---|---|
| `README.md` | queste regole, le zone, come si usa il banco | Coordinatore Sport |
| `CONDIVISO.md` | le scoperte che servono a più sport (tag OSM, fonti delle quote, trucchi di velocità, errori del motore) | solo il Coordinatore Sport, da quello che le sessioni gli scrivono |
| `COME-AGGIUNGERE.md` | la ricetta per aggiungere uno sport | Coordinatore Sport |
| `<sport>.md` | misure e note di uno sport | la sessione di quello sport |

## Le regole

1. **Prima si misura, poi si scrive codice.** Ogni sport nuovo passa dal
   banco sulle sei zone e scrive i risultati nel suo file, prima della
   proposta all'utente.
2. **Un banco alla volta sul Mac**, mai insieme alle suite di altre
   sessioni: il turno lo dà il Coordinatore. Le zone non in cache si
   scaricano da Overpass, che dopo molti download rifiuta per qualche ora
   (`MAPS.md`): poche zone per volta.
3. **Prima di un merge che tocca il motore**, il banco di corsa, bici e
   canoa si rifà e si confronta con le misure di base (`compare`): nessun
   peggioramento né di tempi né di qualità.
4. Una scoperta utile ad altri sport si scrive al Coordinatore Sport, che la
   mette in `CONDIVISO.md` e la gira alle altre sessioni.
5. Le righe di registrazione nei file condivisi non le scrive la sessione
   dello sport: le raccoglie il Coordinatore Sport (ADR-0320, punto 5).

## Le zone fisse

Le stesse per tutti gli sport (`tools/sport_bench/sport_bench.py zones`):

| Chiave | Zona | Tipo | Partenza | Sull'acqua |
|---|---|---|---|---|
| `trento` | Trento | città di valle | 46,0679, 11,1211 | — |
| `valsugana` | Valsugana (Levico Terme) | valle con laghi | 46,0122, 11,2986 | lago di Levico |
| `milano` | Milano | grande città piana | 45,4642, 9,1900 | Idroscalo |
| `fiemme` | Val di Fiemme (Cavalese) | montagna | 46,2915, 11,4605 | — |
| `asiago` | Asiago | altopiano | 45,8757, 11,5097 | — |
| `pianura` | Pianura (Mantova) | pianura | 45,1564, 10,7914 | laghi di Mantova |

Le partenze sull'acqua sono vicino alla riva: il motore le porta sulla riva e
dice di quanto (`move_m`).

## Il banco

Dalla radice del repository, con l'ambiente Python del motore:

```
python tools/sport_bench/sport_bench.py run --activity running \
    --zones trento valsugana --cache-dir data/cache --label base-2026-11
python tools/sport_bench/sport_bench.py compare \
    out/sport-bench/base-2026-11/running.json out/sport-bench/dopo/running.json
```

- Forme di base: cerchio, cuore, stella (le stesse di TASK-372, così i
  numeri restano confrontabili); `--shapes` per altre.
- Distanze di base: corsa 3/5/10 km, camminata 2/5/10, bici 10/20/30,
  canoa 2/3/5; `--distances` (in metri) per uno sport nuovo.
- Una rete non ancora nel motore si prova con `--loader FILE:FUNCTION`: la
  funzione riceve la cartella della cache e rende un GraphLoader (un
  oggetto con `load(bbox)` che dà un grafo OSMnx).
- I risultati vanno in `out/sport-bench/<label>/<attività>.json` (ignorato
  da git); le tabelle stampate si incollano nel file dello sport.
- Soglie: «riuscito» da 0,60 (il minimo del motore), «buono» da 0,90.
  `compare` lascia passare 0,02 di somiglianza e tempi fino a 1,5 volte o
  2 s in più.

Controllo del banco: rete foot a Trento, 5 km, cerchio/cuore/stella
0,90/0,91/0,98 in TASK-372.
