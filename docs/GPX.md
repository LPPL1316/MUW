# GPX — Export della traccia

Come il route-engine scrive un percorso su file. Scritto con TASK-013,
aggiornato con TASK-024 (attribuzione, export dal telefono); le scelte di
fondo stanno in ADR-0019 e ADR-0033.

## Struttura

GPX **1.1**, namespace `http://www.topografix.com/GPX/1/1`.

```
<gpx version="1.1" creator="ShapeRoute route-engine">
  <metadata>
    <name>heart 5 km · 2026-09-22</name>
    <author><name>ShapeRoute route-engine</name></author>
    <copyright author="OpenStreetMap contributors">
      <license>https://opendatacommons.org/licenses/odbl/1-0/</license>
    </copyright>
    <link href="https://www.openstreetmap.org/copyright">
      <text>© OpenStreetMap contributors</text>
    </link>
    <time>2026-09-22T18:30:00Z</time>
  </metadata>
  <trk>
    <name>heart 5 km · 2026-09-22</name>
    <trkseg>
      <trkpt lat="46.0122000" lon="11.2986000"/>
      …
    </trkseg>
  </trk>
</gpx>
```

- **Un solo `<trk>` con un solo `<trkseg>`.** Niente `<rte>`: un track è
  ciò che i visualizzatori e gli orologi trattano come "percorso da
  seguire" senza ricalcolarlo. Niente `<wpt>`, tranne per una parola con
  la penna alzata (sotto).
- **Primo e ultimo punto coincidono** e sono il punto di partenza
  dell'utente (ADR-0018): il percorso è un anello. Tranne una parola con la
  penna alzata, che finisce sull'ultima lettera.
- **Coordinate con 7 decimali** (≈ 1 cm). Di più è rumore; di meno
  sposterebbe i punti in modo visibile a zoom stradale.
- **Niente quote** (`<ele>`) e niente tempi per punto: non esiste ancora una
  sorgente altimetrica, e un tempo inventato sarebbe un dato falso.

## La penna alzata (TASK-197, ADR-0157)

Una parola con la penna alzata ha i suoi tratti a piedi fra una lettera e
l'altra (`RouteResult.walks`, `API.md`). La linea resta **una sola**, da
seguire, tratti a piedi compresi; per ogni tratto a piedi il GPX ha **due
waypoint**, prima del `<trk>` come GPX 1.1 chiede, nell'ordine del
percorso:

```
<wpt lat="46.0671000" lon="11.1214000"><name>Pause</name></wpt>
<wpt lat="46.0671000" lon="11.1253000"><name>Resume</name></wpt>
```

- «Pause» sul primo punto del tratto a piedi, dove finisce una lettera;
  «Resume» sull'ultimo, dove comincia la successiva. Con n lettere,
  2 × (n − 1) waypoint.
- Servono a chi corre con l'orologio e mette in pausa a mano: molti
  orologi mostrano i waypoint lungo il percorso. L'app di Sgrava mette in
  pausa da sola (TASK-198), e il GPX della corsa fatta apre un `<trkseg>`
  nuovo a ogni pausa (sotto).
- Senza `walks` (una forma, un'immagine, una parola senza penna alzata,
  un'app che non li manda) il file è quello di prima, senza `<wpt>`.

## Metadati

| Campo | Valore |
|---|---|
| `name` (metadata e trk) | `<forma> <distanza in km> km · <data>`, es. `heart 15.5 km · 2026-09-22` |
| `author/name`, `creator` | `ShapeRoute route-engine` — mai il nome di una persona: i campioni sono pubblici (ADR-0015) |
| `copyright` | `author="OpenStreetMap contributors"`, licenza ODbL 1.0 |
| `link` | `https://www.openstreetmap.org/copyright`, testo «© OpenStreetMap contributors» |
| `time` | istante di generazione, in UTC |

L'ordine dei campi in `metadata` è quello voluto da GPX 1.1: `name`,
`author`, `copyright`, `link`, `time`. L'attribuzione c'è dal TASK-024: il
percorso nasce da dati OSM, e la licenza ODbL chiede di dirlo dove il dato
viaggia. I campioni scritti prima non la hanno, e restano come sono
(ADR-0014).

## Dove vive il codice

`services/route-engine/route_engine/export_gpx.py`, solo libreria standard
(`xml.etree.ElementTree`). È l'unico scrittore del GPX di un percorso: lo
usano la CLI e l'API (`POST /gpx`, `API.md`), quindi il file del telefono e
quello della CLI sono uguali per lo stesso percorso. Niente
`services/export/` finché non arrivano i formati per orologi (ADR-0033).
Il GPX di una corsa fatta è un'altra cosa e lo scrive l'API: «La corsa
fatta», sotto.

## La corsa fatta (TASK-187, ADR-0156)

Una corsa salvata (`runs`, `DATABASE.md`) diventa un GPX quando va a
Strava (`API.md`, «Send to Strava»): `services/api/shaperoute_api/run_gpx.py`,
solo libreria standard. Non è il file del percorso: è dove il corridore è
stato e quando, quindi ha quello che là manca e non ha quello che là c'è.

```
<gpx version="1.1" creator="Sgrava">
  <metadata>
    <name>Heart in Trento</name>
    <time>2026-09-21T14:13:20.000Z</time>
  </metadata>
  <trk>
    <name>Heart in Trento</name>
    <trkseg>
      <trkpt lat="46.0671000" lon="11.1214000">
        <time>2026-09-21T14:13:20.000Z</time>
      </trkpt>
      …
    </trkseg>
    <trkseg>…</trkseg>
  </trk>
</gpx>
```

- **Ogni punto ha il suo orario**, in UTC al millisecondo: l'inizio della
  corsa più i secondi del punto (la coordinata M della traccia).
- **Una pausa chiude un `<trkseg>`** e il punto dopo ne apre un altro, come
  GPX chiede per un ricevitore spento. I punti presi dentro una pausa non
  ci sono: non sono della corsa. Una pausa che comincia su un punto lo
  lascia nel segmento di prima, come l'API conta i metri.
- **Niente attribuzione a OpenStreetMap**: la traccia è il GPS del
  corridore, non un dato di OSM. Niente quote: `runs` non le ha.
- Il nome c'è solo se la corsa ha disegnato qualcosa di noto.
- Il file non si salva da nessuna parte: si scrive quando parte.

## Il disegno di un altro (TASK-307, ADR-0267)

Sotto un disegno aperto sulla mappa, dal «Feed» o da un profilo, «Export
GPX» scrive il file **sul telefono**, senza chiedere niente all'API
(`apps/mobile/src/social/drawingRoute.ts`): la traccia che `GET
/drawings/{id}` ha già dato, quella della mappa.

```
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MuW" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Sunday heart by the river</name>
  </metadata>
  <trk>
    <name>Sunday heart by the river</name>
    <trkseg>
      <trkpt lat="46.0671000" lon="11.1239930"/>
      …
    </trkseg>
  </trk>
</gpx>
```

- **Solo la traccia tagliata**: mai i primi e gli ultimi 200 m (ADR-0159),
  **mai un tempo**, né per punto né nei metadati; mai il nome di chi ha
  corso; niente quote.
- Il nome è il titolo del disegno, altrimenti ciò che disegna («Star»,
  «CIAO», il titolo del percorso), altrimenti «MuW».
- Il file si chiama `muw-<forma o parola>-<km>km.gpx` (i km della corsa,
  interi, almeno 1; `drawing` senza forma né parola), solo lettere, cifre e
  trattini.
- Niente attribuzione a OpenStreetMap: è il GPS di chi ha corso, come «La
  corsa fatta».

## Dal telefono

Sotto un percorso disegnato, «Export GPX» (TASK-024):

1. l'app manda a `POST /gpx` la richiesta e il risultato che ha già;
2. l'API risponde il GPX con il nome del file, per esempio
   `sgrava-heart-5km-2026-09-23.gpx`: senza spazi né caratteri strani,
   che alcune app rifiutano;
3. l'app lo salva nella propria cartella temporanea (`expo-file-system`),
   che il sistema può svuotare;
4. si apre il foglio di condivisione di iOS (`expo-sharing`), con il tipo
   `com.topografix.gpx`: File, AirDrop, Mail, e le app che dicono di aprire
   i GPX.

## Uso dalla CLI

```
python -m route_engine --shape heart --distance 5000 \
    --start 46.0122,11.2986 --out samples/TASK-013_heart_5km_levico_v1.gpx
```

Se il file esiste già la CLI si ferma con un errore: un campione non si
sovrascrive mai (ADR-0014). La nomenclatura dei file in `samples/` è in
`samples/README.md`.

## Non ancora verificato

- **Garmin Connect** apre il GPX esportato dal telefono (TASK-024, prova
  dell'utente del 2026-09-23). **Strava** e **Komoot** non sono ancora stati
  provati.
- Quote altimetriche: servono in fase 4 (dislivello), sorgente da decidere.
- I waypoint «Pause» e «Resume» della penna alzata (TASK-197): scritti e
  provati nei test, non ancora aperti su un orologio né su Garmin Connect.
