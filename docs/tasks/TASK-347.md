# TASK-347 — Il disegno libero ancorato alle strade: map matching per tratto, confronto e punteggio, strumenti da professionista, guide

**Stato**: Proposta approvata · 2026-10-30 · le cinque scelte di prodotto
fatte dall'utente lo stesso giorno (§«Scelte di prodotto»); i documenti
in questo branch; le parti partono una alla volta, ognuna nella sua
sessione, dalla A
**Fase**: 5 · **Branch**: `docs/TASK-347-pro-freehand` (documenti); le
parti `feat/TASK-347-a-engine-anchored` e così via
**Dipende da**: TASK-331 (a mano solo sulla mappa, in `main`), TASK-214
(il motore sul telefono), TASK-072/084 (il contorno da una foto),
TASK-282 (il percorso dove la figura è stata messa: lo assorbe)
**ADR**: ADR-0300 (proposto). Numeri dal Coordinatore il 2026-10-30

## Obiettivo

Chi disegna a mano libera sulla mappa vede il tratto **seguire da solo
strade e sentieri reali**, tratto per tratto, mentre disegna: il dito
impreciso viene corretto subito, non 7–50 secondi dopo «Draw route». Il
disegno originale resta visibile come fantasma sotto il percorso, un
punteggio dice quanto le strade lo seguono e un colore dice dove la
correzione è stata forte. Attorno, gli strumenti di un editor: magnete
regolabile, penna a punti su strada, nodi, ruota, righello, guide da
immagine, cronologia completa, bozza automatica, informazioni in tempo
reale ed esportazione.

## Contesto

Richiesta dell'utente del 2026-10-30, dopo la prova del TASK-331 sul
telefono: «Nell'app Expo/React Native devo migliorare la sezione di
disegno libero sulla mappa per la GPS Art. Oggi funziona ma non è
professionale. Obiettivo: l'utente disegna a mano libera e il tracciato
segue automaticamente strade e sentieri reali, correggendo da solo le
imprecisioni del dito», con sei capitoli (disegno fluido, map matching,
confronto, strumenti, informazioni, salvataggio) e cinque fasi, con una
fermata dopo ognuna.

### Com'è oggi (dal codice)

- Si disegna nella pagina della mappa (`map/mapPage.ts`, MapLibre in una
  WebView): con «Draw» i gesti di MapLibre sono spenti, la mappa è ferma, la
  pagina disegna l'inchiostro come linea GeoJSON ogni 3 px sulla GPU, senza
  passare dal ponte durante il tratto; al sollevamento la linea va all'app
  (`drawn`). Già fluido.
- `mapdraw/drawing.ts` semplifica (Douglas-Peucker all'1% della
  grandezza), chiude la prima linea entro il 15% o la tiene aperta, appende
  le linee dopo come dettagli; `tools.ts` ha gomma a pezzi, linea a tocchi,
  piega; `useMapCanvas.ts` stato, Undo/Redo, Clear all, richiesta. Niente
  smoothing. **Nessun aggancio alle strade mentre si disegna.**
- «Draw route» manda un `ImageRouteRequest` al motore: sul telefono
  (Pyodide, TASK-214) se c'è la zona scaricata attorno alla partenza (6 km)
  e il percorso è ≤ 8 km a piedi / 30 in bici, altrimenti al server.
- Il motore (`ROUTE_ENGINE.md` §4–5) aggancia con zone e corridoio, poi
  **cerca**: ruota (±15°, fino a ±45°), riscala (0,4–1,1), sposta la
  partenza fino a 500 m (2 km lontano), 20 tracciamenti più 10 inclinati.
  Somiglianza = media armonica di copertura e precisione entro il 2% del
  perimetro, −0,10 per punta mancata; Hausdorff e Fréchet provate e
  scartate. C'è già `--no-optimize` (un tracciamento nel piazzamento
  iniziale, TASK-017), solo da riga di comando; una linea aperta si
  pianifica come andata e ritorno (TASK-040/041).
- Tempi misurati: un cuore da 5 km ≈ 7,7 s sul telefono (2026-10-29),
  pochi secondi sul server; 21 km fino a 50 s sul server. Sono i tempi
  della ricerca intera; un tracciamento solo ne è una frazione (da misurare
  nella parte A).
- `RouteResult` porta `points`, `distance_m`, `similarity`, `warnings`,
  `alternatives`, `try_km`; **non** la forma come piazzata, quindi l'app
  non può disegnare il fantasma e la figura sparisce quando arriva il
  percorso. Niente dislivello, niente tempo.
- Lo stato del disegno vive in memoria e si perde chiudendo l'app.
- Dipendenze: WebView + MapLibre; **non** ci sono `react-native-skia`,
  `react-native-gesture-handler`, `react-native-reanimated`, `expo-haptics`,
  `react-native-svg`. L'impronta iOS deve restare `83793e26` fino alla
  prossima build nativa: ogni nativo nuovo va a quella build.
- L'API rifiuta i campi sconosciuti (`extra="forbid"`): un campo nuovo
  nella richiesta si manda solo a un server che lo conosce.

### Cosa non va

1. La verità arriva solo alla fine, e tardi.
2. Il motore sposta, ruota e riscala la figura: giusto per «un cuore da
   5 km vicino a casa», sbagliato per «l'ho disegnato qui» (TASK-282).
3. Nessun confronto disegno/percorso sulla mappa; la somiglianza è un
   numero sulle tessere, senza dire dove.
4. Tratto grezzo: niente smoothing, i limiti di punti arrivano presto.
5. Strumenti a metà: mancano magnete, nodi, ruota col dito, righello,
   blocco mappa, guida da immagine, bozza, dislivello e tempo.
6. Il motore sul telefono copre 6 km attorno alla partenza e ≤ 8 km.
7. Logica sparsa: `useMapCanvas` fa tutto, la pagina ripete in JS la piega.
8. Attesa muta durante il calcolo.

### Perché non un servizio esterno di map matching

OSRM `/match`, Valhalla `trace_route`, Mapbox Map Matching e GraphHopper
Map Matching sono modelli di Markov nascosti per **tracce GPS vere**
(punti con orario, errore 10–50 m): cercano la sequenza di strade più
probabile per un veicolo, tagliano punte e anse, non ripassano un tratto
apposta. Un dito a zoom 13 sbaglia di 50–150 m e vuole «la strada che
disegna questa forma»: è ciò che il nostro motore fa già (zone,
corridoio, speroni potati, tratti ripassati, punte), misurato su sette
città. Mapbox vuole una chiave nell'app (un segreto) e costa a richiesta;
Valhalla/OSRM/GraphHopper vogliono un servizio nuovo sul server con grafi
in RAM, quando i nostri grafi e le zone sono già lì; tutti vogliono la
rete, contro l'offline del motore sul telefono. **Il map matching è una
modalità «ancorata» del nostro motore.**

## Architettura proposta

**Principio.** La figura resta dove e come il dito l'ha messa: il motore
non cerca, aggancia. Il percorso finale è la concatenazione dei tratti
agganciati, chiusa dove il disegno è chiuso. La ricerca di oggi («free»)
resta per forme del catalogo, parole e chi vuole una forma «vicino a casa».

**Contratto** (`packages/shared-types`, tutto opzionale):
`ImageRouteRequest.placement?: "free" | "anchored"` (default `free`);
`ImageRouteRequest.fit?: number` in [0, 1], la forza del magnete (0 =
fedele al disegno: fascia e zone strette; 1 = tutto su strada: fascia
larga, come oggi); `RouteResult.placed_outline?: LatLon[][]` (la forma
come piazzata, per il fantasma, anche in `free`); nuovo `POST
/stroke-matches` `{activity, fit, line, from?}` → `{points, off_roads,
away_m[]}`, sincrono e piccolo: un tratto aperto agganciato che parte dal
nodo di `from` (la fine del tratto prima). Mandati solo dopo una sonda del
server (come `GET /feedback`, TASK-308).

**Motore.** `snap_stroke(line, graph, fit, start_node)`: zone + corridoio
su una polilinea aperta, senza chiusura né ricerca; per punto la distanza
dal percorso e `off_roads` quando la distanza media punto→nodo supera la
soglia che oggi dà il warning. `plan_route(optimize=False)` con `fit` e il
piazzamento in uscita; `anchored` sull'intero disegno chiude il giro e
valida la distanza senza riscalare. Tutto da riga di comando (`--anchored`,
`--fit`, `--stroke`), test deterministici sui grafi in cache di Trento.

**Dove gira e quanto ci mette** (richiesta del Coordinatore). Il tratto si
aggancia **prima sul telefono** (TASK-214: `phoneEngine` con una chiamata
nuova `match`, sulla zona già scaricata attorno alla partenza o, per un
disegno lontano, sulla zona del posto chiesta a `/phone-zones` come fa
TASK-334), **poi sul server** come oggi. Stima: un tracciamento solo invece
di 20–30, quindi sotto il secondo sul telefono per tratti di qualche km;
**da misurare nella parte A** col banco di TASK-335 (`out/TASK-335/`): se
supera ~1,5 s, server prima e telefono dopo, come per i percorsi lunghi.
Senza zona e senza rete il tratto resta fantasma e si aggancia alla prima
occasione.

**App** (`apps/mobile/src/mapdraw`). Il tratto resta nella pagina della
mappa: Skia e gesture-handler sono nativi (build successiva) e un livello
sopra la WebView passerebbe dal ponte, con ritardo. Moduli nuovi, logica
fuori dalla UI: `strokes.ts` (ricampionamento a passo fisso in metri,
Catmull-Rom o Chaikin, Douglas-Peucker all'1%; la stessa funzione nella
pagina per l'anteprima); `matching.ts` + `useMapMatching.ts` (al
sollevamento, debounce 300 ms, cache per punti+fit+attività, abort, stato
`pending | matched | off_roads | failed`, fallback); `history.ts` (pila di
stati immutabili con l'etichetta dello strumento, Undo/Redo/«torna a», al
posto di `Step put/swap`); `fidelity.ts` (distanza per punto fantasma →
percorso, soglia per «correzione forte»; il numero 0–100 è la
`similarity` del motore × 100); `useMapCanvas.ts` ridotto a composizione.
Pagina: fantasma (sottile, semitrasparente), percorso agganciato (giallo),
tratti corretti forte (terzo colore dai token), «Snapping…» discreto.

**Flusso di un tratto.** Dito su → smoothing + semplificazione → il tratto
entra come fantasma → aggancio (telefono, server) con «Snapping…» → il
tratto agganciato lo sostituisce come percorso, i punti lontani si
colorano, il punteggio si aggiorna; il tratto dopo parte dal nodo finale
di questo, così i tratti si collegano lungo le strade da soli. «Draw
route» = `anchored` sull'intero disegno (chiusura, distanza, GPX, Start),
col fantasma ancora sulla mappa.

**Casi difficili.** Zona senza strade → `off_roads`: il tratto resta
fantasma con un avviso e il nodo più vicino segnato. Aggancio fallito →
routing fra i vertici della semplificazione (`nearest_nodes` + percorso di
costo minimo), tratto segnato «approssimato». Tratto lungo → spezzato ogni
N km e concatenato.

**Confronto e punteggio.** Fantasma, percorso, terzo colore oltre la
soglia; punteggio = somiglianza del motore, spiegata come «quanto le strade
seguono il tuo disegno», sotto la mappa; non nei post (TASK-241).

## Le parti

- **A — Motore e API**: `snap_stroke`, `fit`, `placed_outline`,
  `placement`, `POST /stroke-matches`, test sui grafi di Trento, misura dei
  tempi (server e telefono col banco di TASK-335). `ROUTE_ENGINE.md`,
  `API.md`.
- **B — Telefono**: `match` in `phoneEngine`, la zona del posto per un
  disegno lontano, fallback al server.
- **C — App, fase 2 dell'utente**: `strokes.ts`, `matching.ts` +
  `useMapMatching`, `fidelity.ts`, `history.ts`, i tre livelli sulla
  mappa, «Snapping…», punteggio, «Draw route» ancorato. Server aggiornato
  col sì dell'utente prima dell'OTA (la sonda copre l'app più vecchia).
- **D — Strumenti, fase 3**: magnete (slider di `fit`, re-match del tratto
  corrente); penna a punti con percorso su strada fra i punti («Line» +
  match); nodi: trascina/inserisci/elimina un vertice **del tratto
  disegnato** → re-match di quel tratto; seleziona tutto / sposta / ruota
  (due dita) / ridimensiona con re-match alla fine; righello; blocco
  mappa; cronologia completa con «torna a».
- **E — Forme e guide, fase 4**: le tessere di oggi (forme, immagini
  pronte, foto → contorno) mandate `anchored`; **livello guida**: PNG/JPEG
  (e SVG caricato come immagine dalla pagina, senza librerie)
  semitrasparente sulla mappa, opacità, posizione e scala; «adatta alle
  strade» = il contorno già tracciato dal motore (`POST /image-outlines`,
  TASK-072/084, coi pezzi di TASK-297) mandato `anchored`.
- **F — Informazioni, bozza, esportazione, fase 5**: km (c'è), tempo per
  sport (passo medio dalle corse salvate o un default), punteggio; avviso
  «qui non c'è una strada percorribile» (`off_roads`: la rete pedonale e
  bici esclude già superstrade e vietate); bozza automatica (`draft.ts` su
  `expo-file-system`, ripresa all'apertura, anche offline); GPX, Start,
  condivisione e pubblicazione ci sono già; anteprima immagine dalla
  condivisione (TASK-231).
- **G — Dislivello e profilo altimetrico, nella fase 5** (scelta
  dell'utente: «Subito»): le quote vengono dalle **tegole del terreno di
  AWS** (Terrarium, circa 30 m, gratuite e senza chiave), le stesse che la
  mappa 3D usa già (TASK-264, ADR-0232). Il server le scarica una volta e
  le tiene in cache sul Volume (`data/cache/terrain/`, qualche decina di
  KB a tegola), le decodifica con Pillow (già nel motore) e misura un
  percorso campionato ogni 20–30 m: quota per punto, lisciata (mediana su
  finestra) e con isteresi di 3 m per non contare il rumore; dislivello in
  salita e in discesa; profilo decimato a ~100 punti. Contratto,
  opzionale: `RouteResult.elevation { gain_m, loss_m, profile:
  [along_m, m][] }` e `POST /elevations` per le linee mentre si disegna
  (dopo ogni tratto agganciato, con debounce e cache per tratto); il GPX
  esportato ha `<ele>`. Nel motore una funzione pura
  `elevation_profile(points, tiles)` con test su tegole salvate; la rete
  la fa l'API, non il motore. **Senza rete niente quote** («—» nella
  barra): le tegole non sono nelle zone del telefono; se servirà offline,
  si aggiungeranno alle zone, a parte.
  **Spazio sul server** (condizione del Coordinatore, 2026-10-30: il
  Volume ha 12 GB liberi, all'82%): si usa lo zoom 12, dove una tegola
  copre circa 10 × 7 km alle nostre latitudini con un pixel di 25–30 m,
  quanto basta per campionare ogni 20–30 m; una tegola PNG pesa 20–60 KB
  (le montagne di più, fino a ~100 KB). Un percorso da 5 km tocca 1–4
  tegole (0,1–0,2 MB), una città 25–50 (1–3 MB), le zone italiane
  servite oggi qualche decina di MB. Le tegole si scaricano solo quando
  un percorso le tocca, in `data/cache/terrain/12/{x}/{y}.png` sul
  Volume, come i grafi. **Tetto: 1 GB** (≈ 25 000 tegole, ≈ 2 milioni di
  km², più di quanto si userà mai): superato, la pulizia toglie le meno
  usate di recente (per data d'ultimo uso) fino a tornare sotto, a ogni
  scrittura e in una passata notturna; e se il Volume scende sotto 2 GB
  liberi la tegola si usa in memoria e non si salva. Se il Volume non
  bastasse, la stessa cache va su `/` (57 GB) cambiando una sola
  variabile (`TERRAIN_CACHE_DIR`). Lo zoom 13 raddoppierebbe la
  risoluzione per quattro volte lo spazio: non serve.

Dopo, alla build nativa successiva: feedback aptico (`expo-haptics`) e,
se mai servisse, Skia.

## Scelte di prodotto

Da fare all'utente **una per volta**, in quest'ordine, ognuna con la
proposta pronta:

1. **L'aggancio col nostro motore** (modalità ancorata, per tratto) e non
   con Mapbox/Valhalla/OSRM/GraphHopper. Proposta: sì. **Scelta
   dell'utente, 2026-10-30: «Sì, motore nostro».**
2. **Il tratto nella pagina della mappa**, niente Skia/gesture-handler/
   haptics fino alla build successiva. Proposta: sì. **Scelta
   dell'utente, 2026-10-30: «Sì, nella pagina».**
3. **Il punteggio = somiglianza del motore**, 0–100%, sotto la mappa mentre
   si disegna, non nei post. Proposta: sì. **Scelta dell'utente,
   2026-10-30: «Sì, così».**
4. **Dislivello e profilo** come parte a sé (G), dopo le altre. Proposta:
   sì; fino ad allora km, tempo e punteggio. **Scelta dell'utente,
   2026-10-30: «Subito»**: dislivello e profilo già nella fase 5, dalle
   tegole del terreno sul server (parte G, sotto).
5. **Tre campi opzionali nel contratto e un endpoint nuovo**, con la sonda
   per il server vecchio; il server si aggiorna col sì dell'utente prima
   dell'OTA. Proposta: sì. **Scelta dell'utente, 2026-10-30: «Sì,
   così»** (con la parte G sono due endpoint: `/stroke-matches` e
   `/elevations`).

Tutte e cinque fatte il 2026-10-30, una per volta, in questa sessione.

## Criteri di accettazione (proposta)

- [ ] Documenti in `main`: questo file, ADR-0300, la riga in `INDEX.md`,
      la voce in `STATUS.md`.
- [x] Le cinque scelte fatte dall'utente, registrate qui e in ADR-0300
      (2026-10-30).
- [ ] Le parti A–G con i loro file, pronte a partire una alla volta.

## File toccati

```
docs/DECISIONS.md (ADR-0300)
docs/INDEX.md (una riga)
docs/STATUS.md (righe nuove)
docs/tasks/TASK-347.md
```

Le parti elencheranno i propri: A `services/route-engine/route_engine/`
(`optimizer.py`, `network.py`, un modulo nuovo `stroke_match.py`,
`__main__.py`, test), `services/api/` (route e modelli),
`packages/shared-types`; B `apps/mobile/src/engine/`; C–F
`apps/mobile/src/mapdraw/`, `apps/mobile/src/map/mapPage.ts`,
`messages.ts`, `MapView.tsx`, `App.tsx` (poche righe), `i18n/`, `UI.md`.

## Fuori scope

- **Modificare i nodi della traccia vera** (il percorso registrato o
  calcolato): è del TASK-346 («Edit the drawing» sulla traccia vera,
  sessione local_e2f58775). Qui si modificano i tratti **disegnati** e si
  riaggancia; non si tocca una traccia corsa.
- Un servizio esterno di map matching, per le ragioni sopra.
- Dipendenze native (Skia, gesture-handler, haptics, svg): alla build
  successiva, se mai.
- Un modello del terreno scaricato intero sul server o sul telefono: le
  quote si leggono dalle tegole, per zona, in cache (parte G).
- Pubblicare il punteggio nei post (TASK-241 lo ha tolto).

## Esito

*(a fine task)*
