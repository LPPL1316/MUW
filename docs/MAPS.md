# MAPS — Dati cartografici e routing

Come il route-engine ottiene la rete stradale e ci aggancia la forma.
Scritto con TASK-014, aggiornato con TASK-017 e TASK-015; le scelte di
fondo stanno in ADR-0008, ADR-0020, ADR-0022 e ADR-0023.

## Sorgente

- **OpenStreetMap** via **OSMnx 2.1** (ADR-0008), che interroga Overpass
  (`overpass-api.de`). Unica dipendenza runtime del route-engine: niente
  scikit-learn né scipy, il nodo più vicino si calcola in metri con
  `geo.py`.
- Rete **`foot`** (ADR-0022): il filtro `walk` di OSMnx **senza**
  l'esclusione di `highway=cycleway`. In Trentino le ciclabili sono quasi
  sempre ciclopedonali, e il filtro `walk` le scartava: nel rettangolo del
  cuore da 5 km a Levico mancavano 4,6 km di ciclabili, lungo il lago e a
  sud del paese. Filtro in `FOOT_FILTER`, `route_engine/network.py`.
- Il grafo si costruisce con `network_type="walk"` insieme al filtro: è ciò
  che rende ogni strada percorribile nei due sensi. Con il solo filtro
  OSMnx rispetta i sensi unici, che a piedi non valgono, e alcuni punti
  della forma diventano irraggiungibili.
- Rete **`bike`** per `activity: "cycling"` (TASK-190, ADR-0153): ciclabili
  e strade fino alle `primary`, i sentieri e i marciapiedi solo se segnati
  come ciclabili, mai scale, `trunk` e autostrade né le strade vietate alle
  bici (`ROUTE_ENGINE.md` §4, «La rete della bici»). Si costruisce con
  `network_type="bike"`, quindi **con i sensi unici**, e senza
  semplificare: `bike_ways` scarta le strade e apre o chiude i sensi per
  le bici strada per strada, con i tag che OSMnx di solito non tiene
  (`BIKE_TAGS`: `bicycle`, `oneway:bicycle`, `cycleway*`, `surface`…), poi
  semplifica come OSMnx. Due filtri Overpass (`BIKE_FILTER`), quindi **due
  richieste per zona**: le strade, e i sentieri, i marciapiedi e le zone
  pedonali. Fino a TASK-206 il secondo filtro prendeva solo quelli con un
  tag `bicycle` che li apre; da TASK-206 (ADR-0167) li prende tutti:
  dove la bici non si guida si porta a mano (archi `walk`, a sei volte il
  costo), e anche l'altro senso di un senso unico si fa a piedi.
  Tutti e due fatti di condizioni semplici, come `FOOT_FILTER`:
  l'estratto (`prefetch_zones --extract`) li sa leggere.

## Overpass: come si scarica

- **Un download alla volta**, mai istanze OSMnx in parallelo per aggirare i
  limiti del server (lo raccomanda OSMnx stesso). Il limitatore di OSMnx
  resta attivo.
- **Un tentativo per grafo**: se Overpass non risponde si salta e si
  riprova più tardi, non in un ciclo stretto. Il 2026-09-22 sera, dopo due
  download, Overpass ha smesso di accettare connessioni per il resto della
  sessione.
- I grafi si **costruiscono dalla cache**, anche più volte: la GraphML in
  `data/cache/` e, sotto, le risposte grezze di Overpass in
  `data/cache/http/`. Cambiare come si costruisce il grafo (non cosa si
  chiede) non richiede un nuovo download.
- `ox.settings.requests_timeout` finisce **dentro la query**: cambiarlo
  cambia la chiave della cache HTTP e costringe a riscaricare.
- `overpass-api.de` ha due indirizzi IPv4, e da questo PC uno
  (65.109.112.52) non accetta connessioni. OSMnx fissa un solo indirizzo
  per richiesta con `socket.gethostbyname`, che restituisce il primo: se è
  quello irraggiungibile, il download va in timeout dopo 180 s. I download
  di TASK-015 sono riusciti facendo restituire a `gethostbyname` il primo
  indirizzo raggiungibile, in uno script usa-e-getta; il motore non lo fa.
  Vale anche per l'API: il 2026-09-23 sera (TASK-025) una zona nuova
  chiesta dall'app è finita in `map_data_unavailable` dopo 180 s, perché
  `gethostbyname` restituiva sempre 65.109.112.52, mentre 162.55.144.139 si
  collegava in 0,08 s. L'ordine cambia: alle 21:03 un download dal PC era
  riuscito. Deciso con l'utente di lasciarlo così: è un difetto della rete
  di sviluppo, e in produzione il download si ripensa con ADR-0009.
  Controllo rapido: un tentativo di connessione alla porta 443 dei due
  indirizzi dice quale risponde.
  **Da TASK-127 (ADR-0100) il motore lo fa da solo**: prima di ogni
  download prova gli indirizzi di Overpass e, per la durata del download,
  fa risolvere il nome al primo che accetta la connessione
  (`route_engine/overpass_address.py`). Il nome resta nell'URL, HTTPS
  controlla il certificato come sempre; un download alla volta.
- Per controllare Overpass senza scaricare nulla: la pagina
  `https://overpass-api.de/api/status`, con uno User-Agent vero (quello
  di default di curl riceve 406).

## Cache

- **Nomi delle vie escluse** (TASK-053, ADR-0054): accanto ai grafi,
  `names_<sud>_<ovest>_<nord>_<est>.json`, le vie con nome che
  `FOOT_FILTER` lascia fuori perché hanno il marciapiede disegnato a parte
  (`sidewalk=separate`). Servono solo a dire lungo quale via corre un
  marciapiede senza nome, mai a camminarci. Una richiesta a Overpass per
  zona (`network.named_roads`), un tentativo solo; un file che copre la
  zona vale anche per le zone più piccole. Pesano poco: Trento 106 KB,
  Levico 5 KB, Milano 1,1 MB, scaricati in 1–30 s.
- Il grafo si scarica una volta e si salva in `data/cache/` come GraphML
  (ignorato da git). Da lì la CLI gira **offline**.
- Nome del file: `<rete>_<sud>_<ovest>_<nord>_<est>.graphml`, con il
  rettangolo arrotondato verso l'esterno a 1e-4° (≈ 10 m), così la stessa
  richiesta trova sempre lo stesso file. `<rete>` è `foot` dalla TASK-017;
  i file `walk_*` sono quelli di TASK-014, tenuti per i confronti.
- **La bici ha la sua cache** (TASK-190, ADR-0153): `bike_<sud>_<ovest>_
  <nord>_<est>.graphml`, col suo pickle, accanto ai `foot_*` e con le
  stesse regole (zona, ritagli non salvati, scrittura intera). Una zona si
  cerca solo fra i file della sua rete: un `foot_*` non serve mai una
  richiesta in bici, né un `bike_*` una a piedi (`OsmnxSource.for_activity`
  dà la sorgente di un'attività). I file `foot_*` già sul Mac e sul server
  restano validi, con gli stessi nomi. Un grafo `bike` porta anche
  l'attributo `network="bike"`, che il motore controlla prima di disegnare
  (`check_network`). Le risposte grezze stanno nella stessa `http/`: la
  query è un'altra, quindi un'altra chiave. Le vie con nome (`names_*`)
  servono alla rete a piedi; quella della bici ha già le strade col
  marciapiede a parte. **Le zone `bike_*` fatte prima di TASK-206** non
  hanno i tratti a mano (ADR-0167): funzionano come prima, e per averli
  vanno rifatte (cancellare il `bike_*` col suo pickle e rifarlo: dal Mac
  da Overpass, sul server dall'estratto). Un grafo fatto da TASK-206 in
  poi porta `on_foot=True`.
- Dimensioni tipiche: 1–20 MB per grafo. I 12 grafi `walk` di TASK-014
  occupano 78 MB.
- I dati OSM cambiano: un campione è riproducibile solo con lo stesso
  grafo. Per rifare un confronto pulito, si tiene la cache.
- Accanto a ogni GraphML c'è una copia **pickle** dello stesso grafo:
  leggere il GraphML di una zona richiede 5–13 s (fino a un minuto a
  Milano), il pickle pochi secondi. Il GraphML resta il formato di
  riferimento; il pickle si rigenera da solo se manca, è più vecchio o
  non si legge, e se non si riesce a scrivere si va avanti senza.
- Ogni file della cache (GraphML, pickle, vie con nome) si scrive prima
  su un nome temporaneo accanto, `.<nome>.<cifre>.part`, e prende il suo
  nome solo quando è intero (ADR-0104): un'API o uno script fermati a metà
  non lasciano un file rotto che faccia fallire la zona. Un `.part`
  rimasto da un processo ucciso non viene mai letto, e si può cancellare.
- **L'acqua** (TASK-191, ADR-0154), separata dalle strade:
  `data/cache/water/water_<sud>_<ovest>_<nord>_<est>.json`, gli elementi
  di OpenStreetMap che servono all'acqua (coastline, `natural=water`,
  moli, frangiflutti, pennelli, scogliere, marine, spiagge, scivoli e le
  vie entro 40 m dall'acqua) nel formato `out body geom` di Overpass,
  coordinate a 7 decimali. Un file che contiene l'area chiesta la serve;
  altrimenti **una** richiesta Overpass (`water.WATER_QUERY`), scritta
  intera o niente come gli altri file. Il 2026-10-02 la richiesta non è
  stata provata: Overpass rifiutava il Mac. I file fatti dalle risposte
  dell'API di OSM per i campioni (`python -m route_engine.water --osm-api
  … --save-water …`) hanno lo stesso formato.
  **L'acqua da un estratto** (TASK-225, ADR-0187): come le zone di
  TASK-137, un file d'acqua si scrive anche da un estratto Geofabrik,
  senza Overpass. Prima si tengono i tag della query e tutte le vie:
  `osmium tags-filter <estratto>.osm.pbf
  nwr/natural=coastline,water,beach,reef
  nwr/man_made=pier,breakwater,groyne
  nwr/leisure=marina,slipway,beach_resort nwr/landuse=harbour w/highway
  -o acqua.osm.pbf`. Poi `python -m shaperoute_api.water_extract
  --extract acqua.osm.pbf --bbox S,W,N,E --cache-dir data/cache` taglia il
  riquadro con `osmium extract --strategy smart` (500 m di margine, i
  laghi interi) e scrive gli elementi che Overpass avrebbe risposto, con
  il nome di un download di quel riquadro (`--osm` se il ritaglio XML c'è
  già). Un riquadro grande serve ogni richiesta che ci sta dentro, uguale
  a un download del suo; la più grande, 5 km, chiede ±5,04 km attorno
  alla partenza. osmium vuole più di 2 GB di memoria per un estratto
  regionale: la VM docker del Mac non basta. Sul server, il 2026-10-04,
  `italy-260930-water.osm.pbf` (674 MB, in `/srv/shaperoute/extracts`)
  e i sei riquadri dei quattro luoghi della canoa (TASK-225).
  **I laghi di Explore** (TASK-233, ADR-0196): l'elenco dei laghi dell'app
  (`apps/mobile/src/paddle/lakes.json`) si scrive dallo stesso estratto, in
  tre passi. Prima le acque, una a riga: `osmium tags-filter
  <estratto>.osm.pbf wr/natural=water -o water.osm.pbf`, poi `osmium export
  water.osm.pbf -f geojsonseq -o water.geojsonseq`. Poi i riquadri: `python
  -m shaperoute_api.lake_catalog --waters water.geojsonseq --boxes` stampa
  per ogni lago `S,W,N,E` e il nome, e ogni riga è un `water_extract
  --extract acqua.osm.pbf --bbox S,W,N,E --cache-dir data/cache`. Infine,
  con quell'acqua in una cartella (il server, o una sua copia), `python -m
  shaperoute_api.lake_catalog --waters water.geojsonseq --cache-dir <cache>`
  prova ogni punto con il motore e scrive l'elenco; dopo, Prettier sul
  file. Un lago è un'acqua su cui il motore pagaia (`water.is_lake`), con
  un nome da lago e largo abbastanza per un cerchio da 1 km a 50 m dalla
  riva. Nel nord-est (estratto del 2026-10-02): 41 laghi, 93 punti, 41 file
  d'acqua per 12 MB, 4 minuti e mezzo di prove sul Mac. **In Italia**
  (`italy-260930-water.osm.pbf`, 2026-10-05): 211 laghi, 758 punti, 210
  file d'acqua per 50 MB, sul server dallo stesso giorno; 26 minuti di
  prove sul Mac.
  **Un lago segnato come stagno** (TASK-250, ADR-0214): il Lago di Ledro è
  `water=pond` in OpenStreetMap, e su uno stagno il motore non pagaia.
  Uno stagno con un nome da lago è un lago dell'elenco, e prima di provare
  i punti `lake_catalog --waters water.geojsonseq --cache-dir <cache>
  --ponds` lo riscrive come `water=lake` nei file d'acqua della cartella
  che lo contengono (quello che dice la mappa resta in `water:osm`); il
  motore non cambia. Va rilanciato ogni volta che i file d'acqua si
  rifanno. Il comando dice di ogni lago lasciato fuori il motivo del
  motore. Dei sette laghi scartati da TASK-233, sei non hanno nei dati
  una via, una spiaggia o uno scivolo a meno di 40 m dalla riva (Griessee,
  Salarno, Sciaguana, Esaro, Castelnuovo, Sant'Anna in Calabria), e Gannano tiene a 1 km la
  stella ma non il cuore e il cerchio: restano fuori (`tasks/TASK-250.md`).
  **Le spiagge di «Paddle»** (TASK-245, ADR-0210): l'elenco dei posti di
  mare dell'app (`apps/mobile/src/paddle/beaches.json`) si scrive in due
  passi, senza le acque esportate. I posti sono nel comando (`PLACES`, 29
  paesi scelti dall'utente, ognuno dove OpenStreetMap ha il suo nodo
  `place`). Prima i riquadri: `python -m shaperoute_api.beach_catalog
  --boxes` stampa per ogni paese `S,W,N,E` e il nome, e ogni riga è un
  `water_extract --extract acqua.osm.pbf --bbox S,W,N,E --cache-dir
  data/cache`; con `--cache-dir <cache>` lascia fuori i paesi che un file
  di quella cartella copre già. Un riquadro tiene la richiesta più lunga,
  5 km, da ogni partenza entro 3 km dal paese: circa 16 km di lato. Poi,
  con quell'acqua in una cartella, `python -m shaperoute_api.beach_catalog
  --cache-dir <cache>` sceglie per ogni paese un punto della riva dove si
  arriva a piedi (`water.build_area`, quelli del motore): su una spiaggia
  se c'è, il più vicino al paese entro 3 km; ne prova fino a quattro,
  lontani almeno 500 m l'uno dall'altro, e tiene il primo dove cuore,
  cerchio e stella stanno a 2 km, altrimenti quello dove stanno a 1,5 o a
  1 km. Un paese senza un punto così resta fuori, e il comando dice
  perché. Dopo, Prettier sul file. Il 2026-10-05
  (`italy-260930-water.osm.pbf`): 29 paesi su 29 a 2 km, tutti con le otto
  forme di «Explore»; 27 file d'acqua nuovi per 22,6 MB, sul server dallo
  stesso giorno (Rimini e
  Cavallino stanno nei file di Riccione e di Jesolo, TASK-225); 4 minuti
  per scrivere l'acqua e 1 per le prove, sul Mac.
  Il 2026-10-09 (TASK-245 parte C, stesso estratto) **38 paesi in più**,
  scelti dall'utente sulle coste che ne avevano meno (Campania, Basilicata,
  Calabria, Sicilia, Sardegna, Puglia, Molise, Friuli, Marche, Liguria, le
  isole toscane): `PLACES` ne ha 67, e **67 su 67 tengono cuore, cerchio e
  stella a 2 km**, nessuno scartato. 38 file d'acqua nuovi per 20,3 MB, da
  0,1 MB (Soverato) a 1,7 MB (Grado); il punto della riva sta da 60 m
  (Amalfi) a 1,7 km (Maratea, che è in collina) dal paese. Sul Mac 29
  minuti per scrivere l'acqua con pyosmium.
  **Overpass e i laghi**: la prima risposta vera alla query (dal server,
  2026-10-04, 184 s) dava le relazioni senza membri, perché `out tags
  geom` non li scrive: un lago disegnato come multipoligono mancava.
  Da TASK-230 (ADR-0192) la query chiede `out body geom`, che scrive i
  membri con la loro geometria.
- **Ritagli salvati prima di TASK-136** (ADR-0108): `python -m
  route_engine.prune_crops` elenca, zona per zona, i grafi che un altro
  grafo della cache contiene; con `--delete` li cancella, GraphML e
  pickle. Si rifanno dalla zona senza rete. Sul Mac, il 2026-10-01, erano
  346 su 355, 17,9 GB su 18,6. Zone, nomi delle vie, `walk_*` e `http/`
  restano.

## Area scaricata

- **Con l'ottimizzatore** (TASK-015, ADR-0023): un quadrato attorno alla
  partenza che contiene la forma a ogni rotazione, fase e scala massima,
  più la partenza spostabile (500 m, ADR-0025) e 500 m di margine
  (`zone_area`). Per 15 km circa 12,5 km di lato (155 km²); per le
  distanze della bici (cerchio, TASK-190) 9 km a 10 km, 16 km a 20 km,
  **23 km a 30 km** (530 km²), 26 km con la ricerca lontana: una zona di
  oggi da 17 km non basta per 30 km, e le zone della bici fatte prima sono
  di 26 km («Zone scaricate prima», sotto). Si scarica **un grafo per zona**, partendo dal caso
  più grande (cerchio da 15 km): ogni area più piccola si **ritaglia** da un
  grafo in cache che la contiene (`crop`). Il ritaglio resta in memoria e
  non si salva (ADR-0108): fino a TASK-136 la CLI lo salvava col suo nome,
  3–170 MB per partenza.
- **Senza** (`--no-optimize`): il rettangolo della forma teorica proiettata,
  più **500 m per lato** (`AREA_MARGIN_M`).

Grafi di zona (cerchio da 15 km): Trento 22.613 nodi, Levico 6.845,
Valsugana 7.156, Milano 85.336. Il ritaglio di Levico sull'area del cuore
da 5 km dà 905 nodi contro i 904 del download diretto di TASK-017:
ritagliare equivale a scaricare.

**Una zona tiene ogni pezzo della sua rete** (TASK-180, ADR-0148). OSMnx
da solo, di quello che scarica, tiene il pezzo connesso più grande e butta
gli altri. Per una zona di 17 km è sbagliato dove la città sta su un'isola:
la zona di **Venezia** prende anche Mestre e Marghera, e sul server il
centro storico è rimasto senza un nodo (TASK-168). A piedi isola e
terraferma non si toccano (dati OSM del 2026-10-02): sul Ponte della
Libertà la ciclopedonale è `foot=designated` fino a 5 m dalla rete
dell'isola, poi l'ultimo tratto è `highway=cycleway` con `foot=no` (way
597743868), che `FOOT_FILTER` scarta come le due carreggiate. Ora il
download chiede `retain_all=True` e il file della zona ha tutti i pezzi; il
più grande si sceglie **area per area**, nel ritaglio (`crop`), e chi
chiede la zona intera riceve il suo pezzo più grande, come prima
(`largest_piece`). Per le città di terraferma non cambia niente: i pezzi in
più sono piccoli (cortili, sentieri isolati) e nel ritaglio vince la stessa
rete. Rifatte sul Mac dalle risposte di Overpass in cache, senza rete:

| Zona | Nodi prima | Con tutti i pezzi | Pezzi | Il secondo pezzo |
|---|---|---|---|---|
| Trento, 17 km | 32.728 | 33.880 | 425 | 36 nodi |
| Verona, 17 km | 30.838 | 31.761 | 300 | 36 nodi |
| Verona, zona piccola | 2.459 | 2.523 | 27 | 8 nodi |
| Rosolina Mare | 1.286 | 1.624 | 129 | 26 nodi |

In tutte e quattro il pezzo più grande è il grafo di prima, nodo per nodo
e arco per arco, nello stesso ordine, con le stesse lunghezze e geometrie;
così i ritagli di cuore, cerchio e stella da 5 km, e il cuore da 5 km dal
centro di Trento e di Verona ha la stessa linea. **Le zone salvate prima
di TASK-180 restano col solo pezzo più grande** finché non si rifanno:
quella di Venezia sul server va rifatta.

Limite che resta: nel ritaglio vince il pezzo più grande **dell'area
chiesta**, non quello della partenza. Dal centro di Venezia a 5 km l'area
è tutta laguna e isola; un'area che prende più terraferma che isola dà la
terraferma, e la partenza si aggancia lì.

### Zone scaricate prima (TASK-137, ADR-0119)

`python -m shaperoute_api.prefetch_zones --preset italy` (o `featured`, o
nomi di città) scarica prima che qualcuno le chieda le zone di «Explore»:
per ogni città il centro dalla ricerca delle città (lo stesso che l'app
riceve), poi un riquadro di circa **17 × 17 km** (289 km²) che contiene
ogni forma dei temi a 10 km da qualunque partenza entro 2,5 km
(`search_radius_m`), con la ricerca lontana del motore da lì
(`zone_area(..., FAR_OFFSET_M)`: senza, Romantic a Verona chiedeva 0,7 km
oltre un riquadro di 14 km), e gli esempi di TASK-143 (cuore, cerchio e
stella da 5 km) da qualunque partenza entro 2 km (`FAR_OFFSET_M`); più i
nomi delle strade (ADR-0057). Una città già coperta è «ready»; le altre si scaricano
**una alla volta**, con una pausa (`--pause-s`, 60 s) e un tetto
(`--max-downloads`). Prima di ogni città legge la pagina di stato di
Overpass: con un posto libero scarica, con «Slot available after … in N
seconds» aspetta quei secondi (fino a 5 minuti). Overpass dà due posti per
indirizzo, e dopo una richiesta grande il posto resta occupato più dei 60 s
di pausa: senza l'attesa, il secondo download prendeva un errore HTTP. Una
città il cui download fallisce (col codice HTTP: Overpass carico risponde
504) resta per il giro dopo e si passa alla seguente; si ferma dopo **due
errori di fila**, se Overpass non risponde o sotto i 5 GB liberi; rilanciato, riparte dalle
città mancanti. `--dry-run` dice cosa manca senza scaricare. Si lancia
dove gira l'API usata dall'app, con la sua cartella della cache e
`GEOAPIFY_API_KEY`.

**Da un estratto, senza Overpass** (`--extract FILE.pbf`, scelta
dell'utente del 2026-10-02): Overpass blocca l'indirizzo dopo pochi
download grandi, anche quello del server (2026-10-01: dopo 5 città). Con
l'estratto di Geofabrik, filtrato una volta alle sole strade, ogni zona si
ritaglia con `osmium extract --strategy complete_ways` (riquadro più 700 m:
OSMnx chiede 500 m attorno) e, per la durata del download, OSMnx e il
motore leggono da lì le risposte che Overpass darebbe
(`zone_extract.served_from`): il filtro `FOOT_FILTER` letto com'è, i nodi e
le strade in ordine di id. Il resto è di OSMnx e del motore come per un
download. Napoli e Palermo, scaricate prima da Overpass, rifatte
dall'estratto (30 settembre): Palermo identica (18.681 nodi, 53.930 archi,
44 strade con nome); Napoli 26.977 nodi contro 26.979, 6 archi su 76.628 in
meno (un giorno di modifiche a OSM); cuore e stella da 5 km dal centro con
la stessa linea nelle due. Circa un minuto per città. osmium-tool
(dipendenza approvata dall'utente, ADR-0119; sul Mac `brew install
osmium-tool`, `SETUP.md` 10.5) sta solo nell'immagine dei download, non in
quella dell'API:

```bash
curl -O https://download.geofabrik.de/europe/italy-latest.osm.pbf
```

```bash
printf 'FROM shaperoute-api\nUSER root\nRUN apt-get update && apt-get install -y --no-install-recommends osmium-tool\nUSER shaperoute\n' | docker build -t shaperoute-prefetch -
```

```bash
docker run --rm -v "$PWD":/extracts shaperoute-prefetch osmium tags-filter /extracts/italy-latest.osm.pbf w/highway -o /extracts/italy-highways.osm.pbf
```

Poi il comando nel container, con la cache dell'API montata e `--extract
/extracts/italy-highways.osm.pbf` (2,2 GB l'estratto, 647 MB le sole
strade, 90 s il filtro). Le città fuori dall'estratto (le estere in
evidenza) vogliono il loro estratto o Overpass.

**Le zone della bici** (TASK-190, ADR-0153): `--activity cycling` fa la
zona della rete `bike` (`bike_*`, accanto alle `foot_*`) di **26 × 26 km**
attorno al centro della città (`bike_zone_box`): ogni forma del catalogo
a 30 km dal centro, con la ricerca lontana. Da lì entrano anche un 30 km
da una partenza fino a circa 1,4 km dal centro, un 20 km fino a 3,4 km e
un 10 km fino a 6,9 km. Senza i nomi delle strade, che alla bici non
servono. **Solo dall'estratto**: senza `--extract` il comando si ferma
(una zona della bici sono due richieste grandi a Overpass). L'estratto
filtrato a `w/highway` va bene così: `zone_extract` legge i due filtri
`BIKE_FILTER` come legge `FOOT_FILTER`.

```bash
python -m shaperoute_api.prefetch_zones --activity cycling --extract /extracts/italy-highways.osm.pbf Trento
```

Quali città: prima Trento (la prova sul server), poi `--preset italy` con
l'ok dell'utente; le estere no (ADR-0153, «Aggiornamento»). Misure fatte
sul Mac dalle risposte a piedi in cache, quindi senza le vie col
marciapiede a parte (stessa strada dell'estratto, stesso riquadro della
zona a piedi): Trento 20.424 nodi, 11 MB di pickle, 127 MB in memoria
contro i 185 della zona a piedi; Milano 52.493 nodi, 24 MB, 236 MB contro
618; Roma 186 MB contro 454; costruzione in 10–29 s, picco 1–1,8 GB. Una
zona di 26 km dovrebbe stare fra 0,15 e 0,6 GB in memoria e 70–150 MB su
disco; l'API ne tiene una alla volta (`API.md`, «Grafi»). Non ancora
provata su una zona vera (task file di TASK-190).

### Impianti e piste da sci da un estratto (TASK-375 parte D, ADR-0319)

I nomi degli impianti presi e delle piste fatte in una giornata di sci
(`ski_names.py`) vengono dalle linee di OSM. Come l'acqua, si prendono da
un estratto Geofabrik, una volta per paese alpino: Italia, Austria,
Svizzera, Francia, Germania, Slovenia. Per ogni estratto:

```bash
osmium tags-filter italy-latest.osm.pbf w/aerialway nwr/piste:type=downhill -o italy-ski.osm.pbf
```

Poi un solo comando per tutti:

```bash
python -m shaperoute_api.ski_extract --extract italy-ski.osm.pbf austria-ski.osm.pbf switzerland-ski.osm.pbf france-ski.osm.pbf germany-ski.osm.pbf slovenia-ski.osm.pbf --cache-dir data/cache
```

Il comando scrive riquadri di 0,25° in `data/cache/ski/<lat>_<lon>.json`.
Un estratto passato di nuovo si unisce a ciò che c'è già, e una via con lo
stesso id sostituisce la vecchia: un impianto di confine resta uno solo.
Restano fuori le stazioni, i piloni, le teleferiche merci, le zip line e le
piste di fondo. Sul server di produzione questi comandi li lancia
l'utente.

## Dal disegno alla strada

1. La partenza (primo punto della forma) si aggancia al **nodo più
   vicino**: il percorso inizia e finisce lì.
2. Ogni altro punto della forma è una **zona**: i nodi entro il 2% del
   perimetro della forma (`ZONE_RADIUS`; 100 m per 5 km), o il più vicino
   se nessuno è così vicino. Raggiungere un nodo della zona costa la strada
   più la sua distanza dal punto: vince il nodo comodo, non quello più
   vicino in linea d'aria ma oltre un fiume.
3. Fra una zona e la successiva, percorso di costo minimo con il
   **corridoio**: una strada costa la sua lunghezza × (1 + 2,0 · eccesso /
   fascia), dove l'eccesso è quanto la strada sta lontana dal contorno oltre
   la fascia del 2% del perimetro (`CORRIDOR_WEIGHT`, `CORRIDOR_BAND`).
   Dentro la fascia non c'è premio a zig-zagare per restare più vicini.
4. Gli archi già usati costano **2.0** volte di più
   (`EDGE_REUSE_PENALTY`).
5. **Potatura degli speroni**: ogni A → B → A diventa A, finché ce ne
   sono. Se non resta un anello, si tiene il percorso non potato.
6. I punti del GPX seguono la geometria vera delle strade, non la corda fra
   due incroci.

Parametri: `--reuse-penalty` dalla CLI; gli altri sono costanti in
`route_engine/network.py`. Raggio e fascia sono frazioni del perimetro,
quindi crescono con la distanza richiesta.

## Warning

- **Rete rada**: distanza media punto-forma → nodo sopra **150 m**
  (`SPARSE_THRESHOLD_M`).
- **Partenza lontana dalla strada**: il nodo di partenza è a più di 150 m
  dal punto dell'utente.
- **Punto della forma irraggiungibile**: nessuna strada porta alla sua
  zona; il punto si salta e la CLI lo dice.

**Nessuna strada** non è un warning ma un rifiuto (TASK-180, ADR-0148):
se nell'area chiesta il grafo non ha un nodo (mare aperto, o un posto che
la zona non copre), o ne ha uno solo senza archi, il motore alza
`NoRoadsError`, che è un `ShapeNotDrawableError`: la CLI dice «No route:
there are no roads to run on around here», l'API risponde
`shape_not_drawable`. Prima il grafo vuoto si rompeva più avanti (`max()`
di nessun pezzo, un indice in nessuna strada) e l'API diceva
`engine_error`.

In TASK-014 e TASK-017 il warning di rete rada è comparso solo in
`valsugana` a 15 km, a 151 m e 158 m: appena sopra la soglia.

## Come si misura

`services/route-engine/tests/measure_snapping.py` rifà i 12 casi di
riferimento dalla cache e stampa, per ciascuno:

- **rapporto**: distanza su strada / distanza target;
- **ripercorso**: quota della lunghezza su tratti già fatti;
- **deviazione**: distanza media e massima del percorso dal contorno;
- **copertura**: quota del contorno che ha il percorso entro il 2% della
  distanza target (100 m a 5 km).

La copertura serve perché il rapporto da solo inganna: un percorso che
salta metà della forma è corto e sembra ottimo.

## Cosa si è misurato

Sui 12 casi (heart/circle, 5 e 15 km, tre zone), forma a scala iniziale,
rotazione 0, fase 0.

**TASK-014**, rete `walk`:

| | Distanza su strada / target |
|---|---|
| Snapping al nodo + routing (penalità 2.0) | 3,3× – 7,0× |
| Penalità 2.0 contro nessuna penalità | 0–3% in più, nessun ritorno evitato a occhio (cuore 5 km, Trento e Levico) |
| + potatura degli speroni | 2,2× – 4,7× (−19/−53% di km), archi ripercorsi −43/−90% |

**TASK-017**, varianti provate una alla volta sulla rete `walk` (rapporto
mediano e copertura media sui 12 casi):

| Variante | Entro 1,5× | Rapporto | Copertura |
|---|---|---|---|
| TASK-014 (nodo più vicino) | 0/12 | 2,89× | 79% |
| Aggancio all'arco più vicino | 0/12 | 2,90× | 81% |
| Meno waypoint (Douglas-Peucker, 30 m) | 0/12 | 2,31× | 74% |
| Guardia sulle deviazioni, k = 2 | 8/12 | 1,33× | 45% |
| Guardia k = 2 + corridoio | 11/12 | 1,21× | 41% |
| Zone + corridoio, 8 punti invece di 64 | 3/12 | 1,91× | 62% |
| **Zone + corridoio (tenuta)** | 0/12 | **2,57×** | **79%** |

- La guardia sulle deviazioni accorcia **scartando la forma**: sul cuore
  di Levico resta un terzo del contorno. Scartata.
- Aggancio all'arco e meno waypoint non aiutano, o aiutano solo perdendo
  copertura.
- Zone + corridoio è più corta della TASK-014 in 11 casi su 12, a parità
  di copertura media. Peggiora `circle_5km_valsugana` (3,37× → 3,66×, ma
  copertura 47% → 62%).
- Raggio delle zone, peso e fascia del corridoio cambiano poco: fra 1% e
  3% del perimetro e peso fra 1 e 4, rapporto mediano 2,53–2,86×. Si
  tengono 2%, 2,0 e 2%.

**Rete `foot`** (con le ciclopedonali), sui 4 casi scaricati prima che
Overpass smettesse di rispondere:

| Caso | TASK-014 su `foot` | TASK-017 su `walk` | TASK-017 su `foot` |
|---|---|---|---|
| heart 5 km trento | 2,02× · 94% | 2,10× · 94% | 1,66× · 94% |
| heart 15 km trento | 2,05× · 100% | 2,62× · 99% | 1,98× · 100% |
| heart 5 km levico | 1,94× · 93% | 1,82× · 82% | **1,47× · 90%** |
| heart 5 km valsugana | 3,30× · 71% | 3,18× · 62% | 3,17× · 62% |

(rapporto · copertura). In Valsugana le ciclabili aggiunte (2 km) non
cambiano nulla.

**Il limite rimasto**: con scala e rotazione iniziali il contorno passa in
parte su campi, fiumi e ferrovie. Sul cuore di Levico la metà inferiore
attraversa campi senza strade, e il percorso rientra verso l'interno per
aggirarli. Nessun aggancio lo recupera: serve spostare la forma dove le
strade ci sono, cioè ruotarla e scalarla (TASK-015, `ROUTE_ENGINE.md` §5).
Il traguardo di 1,5× passa lì.

**TASK-015**, ottimizzatore sulla rete `foot`, campioni v3 (rapporto ·
somiglianza; ✅ = distanza entro ±10% e somiglianza ≥ 0,90; ADR-0025):

| Zona | cuore 5 km | cuore 15 km | cerchio 5 km | cerchio 15 km |
|---|---|---|---|---|
| trento | 1,02× · 0,82 | 0,93× · 0,94 ✅ | 1,00× · 0,93 ✅ | 0,93× · 0,91 ✅ |
| levico | 1,04× · 0,80 | 1,01× · 0,82 | 1,00× · 0,71 | 1,04× · 0,80 |
| valsugana | 0,76× · 0,70 | non disponibile | non disponibile | 1,05× · 0,73 |
| milano | 1,08× · 0,97 ✅ | 0,95× · 1,00 ✅ | 1,09× · 0,91 ✅ | 1,07× · 1,00 ✅ |

- Trento e Levico: distanza entro ±10% in 8 casi su 8, copertura ≥ 87%.
  Rapporto mediano sui 12 casi di TASK-017: 2,57×; qui 1,02×.
- Giudizi a occhio (`samples/LOG.md`): Milano `sì`; Trento `sì`, tranne il
  cuore da 5 km, migliore nella v2; Levico `quasi` (le punte ci sono, ma i
  lobi restano irregolari); Valsugana sospesa, con due forme non
  disponibili.
- Cosa ha contato, versione per versione: v1 copertura → v2 `fit` (niente
  più pezzi tagliati a Trento) → v3 punte premiate e non potate (a Levico
  la punta del cuore ricompare, con la forma ruotata di 45–60°).
- La partenza spostata è servita solo in Valsugana (250 m): in città le
  strade ci sono ovunque e il conteggio non la premia.
- Tempi dalla cache: 7–32 s per caso nelle tre zone, 11–33 s a Milano
  (dopo la prima lettura, che scrive il pickle).
- Difetto rimasto: **punte** di andata e ritorno su strade parallele
  (marciapiede e strada), che la potatura non riconosce. Tolte in TASK-016.

**TASK-016**, validazione e punte parallele tolte (ADR-0026), campioni
`TASK-016_*_v1` (somiglianza · ripercorso a vista · metri su scale /
strade principali / gallerie):

| Zona | cuore 5 km | cuore 15 km | cerchio 5 km | cerchio 15 km |
|---|---|---|---|---|
| trento | 0,89 · 10% · 373 / 0 / 110 | 0,89 · 4% · 575 / 0 / 405 | 0,94 · 9% · 80 / 0 / 0 | 0,82 · 2% · 450 / 0 / 415 |
| levico | 0,87 · 5% · 14 / 0 / 0 | 0,82 · 4% · 14 / 1500 / 0 | 0,74 · 2% · 0 / 0 / 0 | 0,79 · 2% · 14 / 726 / 0 |
| valsugana | non disponibile | 0,66 · 7% · 685 / 0 / 0 | non disponibile | 0,77 · 5% · 704 / 0 / 0 |
| milano | 0,97 · 7% · 131 / 0 / 700 | 1,00 · 0% · 303 / 0 / 255 | 0,92 · 5% · 255 / 0 / 464 | 1,00 · 2% · 157 / 20 / 298 |

- Ripercorrenza esatta sotto il 5% tranne il cuore 5 km di Levico (5,3%)
  e il cuore 15 km della Valsugana (7,3%); a vista sotto il 10% ovunque.
- Le scale sono il difetto più frequente: fino a 700 m in un percorso,
  in città e in collina. A Levico i 15 km passano per 0,7–1,5 km di strade
  principali. A Milano "gallerie" sono soprattutto sottopassi pedonali.
- Confronto di strategie di ricerca, 14 casi disegnabili, 20 tracciamenti:
  correggere la scala di ogni piazzamento (tenuta) dà somiglianza media
  0,862; tracciare più piazzamenti una volta sola 0,845.
- Tempi dalla cache: 5–28 s per caso.

### Viene meglio a N km (TASK-234)

Quante volte i tentativi della ricerca dicono una distanza dove la forma
viene chiaramente meglio (`better_distance`, `ROUTE_ENGINE.md` §5,
ADR-0197). Misurato il 2026-10-05 sul Mac, dalla cache (`plan_route`: la
ricerca della partenza, e quella lontana quando parte), con
`services/route-engine/tests/measure_better.py --catalog --words`: per
ogni caso il consiglio e il margine più grande di un tentativo con
somiglianza ≥ 0,90 a un altro km, così la soglia si legge sugli stessi
numeri.

| Casi | Percorsi | Consigli a 5 punti (tenuta) | a 4 | a 3 |
|---|---|---|---|---|
| I 14 disegnabili (12 in cache: la Valsugana no) | 12 | 0 | 0 | 0 |
| Le 17 forme del catalogo a Trento e Levico, 5/10/15 km (il pesce di Levico da 5 km rifiutato) | 93 | 6 | 6 | 8 |
| «CIAO», «IO», «RUN» a 9/12/15 km (dai 3 km a lettera), Trento, Levico, Milano | 24 | 2 | 2 | 3 |
| **Tutti** | **129** | **8 (6%)** | 8 | 11 |

I consigli con la soglia tenuta (somiglianza scelto → consigliato):

| Caso | Scelto | Consiglio |
|---|---|---|
| cuore 10 km, Trento | 0,86 a 8,3 km, non buono | 8 km, 0,92 |
| cavallo 10 km, Trento | 0,97, con baffi | 7 km, 1,00 |
| cavallo 15 km, Trento | 0,93, con baffi | 6 km, 0,96 |
| cavallo 15 km, Levico | 0,98, con baffi | 17 km, 1,00 |
| luna 10 km, Levico | 0,90, non buono, con baffi | 16 km, 0,91 |
| lumaca 10 km, Levico | 0,83 a 8,6 km, non buono | 12 km, 0,94 |
| «IO» 12 km, Levico | 0,88 a 13,8 km, non buono | 10 km, 0,94 |
| «IO» 15 km, Levico | 0,86, non buono | 12 km, 0,92 |

- **Scatta poco**: 8 percorsi su 129, nessuno dei 12 di riferimento
  misurati. Dove la forma riesce (somiglianza ≥ 0,90, distanza ±10%: 65
  percorsi su 129) la ricerca si ferma al primo tentativo buono e ne prova
  pochi altri; dove non riesce, di solito non riesce a nessuna scala
  (forme a Levico: 40 su 50 non buone, e in 36 di loro nessun tentativo
  arriva a 0,90).
- **La soglia resta 5 punti** (`BETTER_MARGIN` = 0,15): a 4 gli stessi
  8; a 3 entrano testa di cane 5 km e albero 15 km a Trento, «CIAO» 12 km
  a Milano (0,92 → 0,96 a 15 km), e il cerchio di Milano da 5 km resta
  appena sotto (0,089): guadagni di 3–4 punti di somiglianza.
- **Con le partenze vicine** (`plan_nearby`, come l'API) il consiglio è
  quello della partenza che vince: il cavallo di Trento da 10 km consiglia
  8 km invece di 7, la lumaca di Levico nessuno (vince una partenza
  vicina, con la sua ricerca). I percorsi di prima non cambiano: stesse impronte sui
  12 casi e su tre dei consigli, con `plan_route` e `plan_nearby`,
  alternative comprese.
- **I baffi pesano**: per cavallo e luna il margine viene soprattutto dalla
  quota fatta due volte (`W_DOUBLED`), non dalla somiglianza.
- **Le distanze possono essere lontane**: il cavallo di Trento da 15 km
  viene meglio a 6 km (la scala più piccola che la ricerca prova, 0,4).
- Il passo 2 (cercare apposta altre distanze, ADR-0197) troverebbe di
  più, a 5–50 s di server per distanza.

### Forme inclinate (TASK-232)

Quanto cambiano i percorsi se una forma si inclina fino a 45° (ADR-0195,
`ROUTE_ENGINE.md` §5, «Forme inclinate»). Misurato il 2026-10-05 sul Mac,
dalla cache, con `plan_route` (la ricerca della partenza e quella lontana
quando parte) e `services/route-engine/tests/measure_tilt.py --catalog
--words`: ogni caso prima com'era (15°, parole squadrate a 30°, nessun
costo dell'inclinazione) e poi con il motore nuovo, uno dopo l'altro sullo
stesso grafo già letto. 129 percorsi: i 12 di riferimento in cache, le 17
forme del catalogo a Trento e Levico a 5/10/15 km (il pesce di Levico da
5 km rifiutato), «CIAO», «IO», «RUN» a 9/12/15 km. Quattro processi in
parallelo: i tempi si confrontano dentro lo stesso processo.

| Ricerca | Uguali | Meglio | Peggio | Oltre 15° | Buoni (65 prima) | Tempo medio |
|---|---|---|---|---|---|---|
| Tutte le rotazioni insieme, costo in proporzione da 0° | 71 | 27 | 29 | 0 | 70, ma 2 buoni persi | +22% |
| Tutte insieme, i primi 15° gratis | 116 | 4 | 8 | 7 | 65, 2 buoni persi | +11% |
| Prima dritta, poi inclinata, anche lontano | 107 | 15 | 4 | 22 | 69 | +31% |
| **Prima dritta, poi inclinata solo vicino (tenuta)** | **110** | **14** | **2** | **19** | **67** | **+10%** |

(«meglio» e «peggio»: somiglianza di almeno mezzo punto diversa; i
percorsi che cambiano di meno contano fra quelli che cambiano.)

- **Tutte insieme non va**: il conteggio delle strade premia piazzamenti
  inclinati che tracciati vengono peggio, e con lo stesso budget la
  ricerca ne prova meno di dritti. Con il costo da 0° nessuna forma si
  inclina oltre 15°, ma molte si raddrizzano e peggiorano (il pesce di
  Trento da 10 km 0,91 → 0,70, la testa di cane di Levico da 15 km 0,95 →
  0,88); il cuore di Levico da 5 km, uno dei 12 di riferimento, scende da
  0,92 a 0,88.
- **Prima dritta**: dove la ricerca di sempre dà un percorso buono è lui,
  punto per punto. Nella prima prova anche la ricerca lontana provava le
  inclinazioni (tempo +31%), e un percorso inclinato vicino, disegnabile
  ma non buono, teneva fuori quello lontano che vinceva prima: gatto e
  pesce di Levico da 15 km da 0,71 e 0,78 a 0,64 e 0,62. Tenuta: la
  ricerca lontana resta dritta, e vicino o lontano si decide sulla ricerca
  dritta, come prima.
- **I 12 di riferimento**: tutti identici, tempo medio 5,5 → 5,8 s (+6%;
  due cuori di Levico fanno i 10 tracciamenti in più senza trovare di
  meglio).
- **I 19 che cambiano** (campioni `samples/TASK-232_*`, `LOG.md`): tutti
  inclinati oltre 15°, di 20–45° (la mappa li gira), 14 con la somiglianza
  più alta.
  Diventano buoni la lumaca di Trento da 5 km (0,85 → 0,91) e quella di
  Levico da 10 km (0,83 → 0,92); l'albero di Natale di Trento da 15 km
  (0,93 → 0,98) e la lumaca di Trento da 10 km (0,92 → 0,90) erano buoni
  solo con la partenza spostata di 1 km, ora lo sono dove l'utente è. Il
  sole di Levico da 15 km 0,75 → 0,90, il fantasmino di Levico da 10 km
  0,61 → 0,73. Due scendono di qualche punto con la distanza più giusta:
  l'albero di Natale di Levico da 5 km (0,75 a 6,6 km → 0,73 a 4,8 km) e
  la lumaca di Trento da 10 km, sopra. Il gatto e il sole di Trento da
  5 km guadagnano forma (0,79 → 0,91, 0,84 → 0,96) allungandosi del 22–25%,
  scelti dal costo.
- **Sull'acqua** lo stesso schema (`water_fit.py`): i 32 esempi della canoa
  in «Explore» non cambiano (tutti ci stanno dritti).

## Fixture di test

`services/route-engine/tests/fixtures/levico_walk_1km.graphml`: 1 km²
attorno a Levico, rete `walk`, 303 nodi, 347 KB, scaricato il
**2026-09-22**. Si rigenera con `python tests/fixtures/make_fixtures.py`
(serve la rete) e si aggiorna questa data. Resta una rete `walk` apposta:
serve a provare l'algoritmo su un grafo reale, non il filtro.

## Ancora aperto

- Motore di routing di produzione: ADR-0009.
- Attribuzione OpenStreetMap (ODbL): sulla mappa dell'app è sempre
  visibile (ADR-0029, tile di OpenFreeMap), e dal TASK-024 anche nei
  metadati di ogni GPX (`GPX.md`, ADR-0033).
