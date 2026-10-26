# TASK-214 — Il motore dei percorsi sul telefono

**Stato**: In corso. Le sei scelte hanno la risposta dell'utente; la parte A
(API) è in `main` dalla #275, la parte B (l'app) dalla #282, la parte C
(«Settings» e l'avviso) dalla #295, la parte A2 (il tetto del traffico)
dalla #330, la parte B2 (le zone in più) dalla #337, le città vicine
(B2b) dalla #341. Le zone del telefono sono sul server e B2/B2b su
«preview» dal 2026-10-05. La parte D, la prova sull'iPhone, l'ha fatta
l'utente il 2026-10-25: «funziona ma cerca di migliorarlo». Segue un
miglioramento, da misurare e proporre all'utente (parte nuova). Scelto
dall'utente lo stesso giorno: la parte E, la zona più larga intorno al
telefono, in `main` dalla #546 (`7da61107`, 2026-10-25). Restano i criteri
ancora aperti qui sotto e le zone dove il server risponde `404`.
**Fase**: 4 · **Branch**: il task file con la #258; il codice in
`feat/TASK-214-…`, una PR per parte · **ADR**: ADR-0177

## Obiettivo

Il telefono calcola da solo i percorsi su strada, sulle zone salvate nella
sua memoria e con lo stesso codice del server. Il server resta la riserva.

La richiesta dell'utente, del 2026-10-03: «quando un utente installa
l'applicazione sul suo telefono fai un codice che cerchi di migliorare la
ricerca delle mappe con la potenza del suo telefono, utilizzando anche la
sua memoria, scaricando le mappe e ricerca».

**Già deciso dall'utente** (2026-10-03): al primo avvio il download parte da
solo, senza chiedere, **anche con i dati mobili** («no anche con i gb»), non
solo con il Wi-Fi. In «Settings» una riga mostra lo spazio usato e permette
di cancellarlo.

## La prova già fatta

Fatta il 2026-10-03, fuori dal repository. Gli script sono in
`out/on-phone-engine/`, ignorata da git: `spike.mjs`, `spike_api.mjs`,
`on_phone.py`, `profile.mjs`, e la pagina per l'iPhone `web/index.html` con
`serve.py`.

- **Il motore gira senza modifiche** in Pyodide 0.28.3, cioè Python 3.13 in
  WebAssembly, come in una WebView. Le versioni delle librerie: numpy 2.2.5,
  networkx 3.4.2, shapely 2.0.7, pillow 11.3.0, pydantic 2.10.6. OSMnx è
  sostituito da un modulo vuoto: serve solo a scaricare e a leggere il
  GraphML.
- **Stesso percorso del Mac.** Cuore da 5 km a Trento (46.0679, 11.1211)
  dalla CLI: il GPX è identico punto per punto a quello del Python del Mac
  (403 punti, 17 tentativi, somiglianza 0,92, 5165 m).
- **Stessa risposta dell'API.** La catena dell'API (`RouteJobs`,
  `plan_request`, `with_choices`, `RouteResultBody`) gira senza FastAPI,
  thread né processi. Il JSON è uguale a quello del Python del Mac:
  percorso, alternative e indicazioni. Cambia solo `angle_deg`, dalla 14ª
  cifra in poi.
- **Tempi.** Nel browser del Mac (Chromium):
  - solo dalla partenza: 4,3 s; 4,2 s la seconda volta, con la zona già in
    memoria;
  - dalla partenza e dalle tre partenze vicine, una dopo l'altra, come fa il
    server: 10,3 s.

  Il server ci mette 7–19 s per un esempio (STATUS, TASK-168).
- **Memoria.** Nel browser, la memoria di WebAssembly arriva a 225–270 MB.
  In Node il processo intero arriva a 490 MB, ma conta anche Node.
- **La zona di Trento** (`foot`) pesa 18,9 MB in pickle, 7,9 MB compressa
  con gzip. Leggerla in WebAssembly richiede 2,3–4,7 s.
- **iPhone: da misurare.** La pagina `serve.py` sul Mac, porta 8765, si
  apre dal Safari dell'iPhone sulla stessa rete. I risultati arrivano in
  `out/on-phone-engine/reports/`.

## Sei scelte prima del codice

Chieste all'utente **una alla volta**, nell'ordine, ognuna con la sua
proposta. La risposta si scrive qui sotto la domanda.

### 1. Dipendenze nuove

`react-native-webview` c'è già (13.16.1, la usa la mappa). È nuovo
**Pyodide 0.28.3**, licenza MPL-2.0: il suo runtime (`pyodide.asm.wasm`,
`pyodide.asm.js`, `python_stdlib.zip`, `pyodide-lock.json`) e otto
pacchetti, cioè numpy, networkx, shapely, pillow, pydantic, pydantic_core,
typing_extensions e annotated_types. Le licenze dei pacchetti sono BSD, MIT
e HPND. Per provare sul Mac lo stesso codice del telefono serve anche il
pacchetto npm `pyodide`, solo per lo sviluppo.

**Proposta**: i file di Pyodide vanno nell'app come asset, a versione fissa.
`pyodide` npm diventa una dipendenza di sviluppo, solo per lo script di
confronto (scelta 6).

**Risposta dell'utente** (2026-10-03): «si ok». Pyodide entra, dentro l'app
e a versione fissa.

### 2. App Store

Cosa dicono le regole di Apple:

- **Linea guida 2.5.2**: un'app non può «download, install, or execute code
  which introduces or changes features or functionality of the app».
- **Linea guida 4.7**: ammette software fuori dal binario solo in casi
  precisi (mini app HTML5 e JavaScript, giochi in streaming, chatbot,
  plug-in).
- **Developer Program License Agreement**, la parte sul codice interpretato:
  si può scaricare codice interpretato se non cambia lo scopo dichiarato
  dell'app e non aggira il sandbox. È la regola su cui si reggono anche gli
  aggiornamenti di Expo (`eas update`).

Il motore in Python è codice interpretato, eseguito dal WebAssembly di
WebKit, e fa ciò che l'app dichiara: disegnare percorsi. **Il rischio** è
che chi rivede l'app consideri Python e i suoi pacchetti scaricati dopo
l'installazione come «codice scaricato». Oggi non ci tocca: Sgrava gira in
Expo Go e l'App Store arriva con TASK-152.

**Proposta**: tutto ciò che è codice sta dentro l'app (Pyodide, i
pacchetti, il motore) e si aggiorna con l'app. Si scaricano solo dati,
cioè le zone. Per questo le zone non viaggiano come pickle: un pickle, letto,
può eseguire codice (vedi la scelta 6).

**Risposta dell'utente** (2026-10-03): «va bene».

### 3. Memoria e batteria

Il calcolo usa 225–270 MB nel browser del Mac; sull'iPhone è da misurare.
Su iOS la WebView gira in un processo suo. Se iOS lo chiude per la memoria,
l'app resta aperta e riceve `onContentProcessDidTerminate`. Il calcolo dura
5–15 s su un core, poco rispetto a una corsa con il GPS acceso. Pesa di più
il download delle zone.

**Proposta**: il telefono calcola solo se la zona sta sotto un limite di
grandezza, da fissare con la misura sull'iPhone. Se la WebView muore, la
stessa richiesta va al server, senza errore per chi usa l'app. La misura
va fatta su un iPhone vero e, se ce n'è uno, anche su un iPhone vecchio.

**Risposta dell'utente** (2026-10-03): «va bene grazie».

### 4. Dimensione dell'app e delle zone

- **L'app cresce di circa 20 MB** non compressi: `pyodide.asm.wasm` 8,6 MB,
  numpy 3,1, la libreria standard 2,4, pydantic con pydantic_core 1,8,
  pillow 1,1, il JavaScript di Pyodide 1,1, networkx 1,0, shapely 0,8, il
  motore 0,3. Su Expo Go viaggiano con `eas update`, che li riscarica solo
  quando cambiano.
- **Le zone**: Trento `foot` 7,9 MB compressa. Le zone `bike` sono a parte
  (Trento: 11,8 MB in pickle); l'acqua della canoa anche.

**Proposta**:
- al primo avvio, con qualunque rete (scelta già fatta), si scarica solo la
  zona dello sport di «Settings» intorno alla posizione;
- le altre zone si scaricano la prima volta che servono;
- al massimo 200 MB in tutto: quando si supera, si cancella la zona usata
  meno di recente.

**Risposta dell'utente** (2026-10-03):

- **il limite è 2 GB**, non 200 MB: «tieni il limite più alto fai 2
  gigabite»;
- **le cose più usate si scaricano il prima possibile**, «mentre si scarica
  l'app», perché l'app vada fluida. L'ordine:
  1. appena si apre l'app, la zona intorno, per la corsa e per la bici, e
     gli esempi di «Explore» della propria città (circa 20–30 MB);
  2. poi, piano piano, le zone delle città vicine e di quelle più cercate,
     fino a 2 GB;
- **anche il punto 2 con i dati mobili**, non solo con il Wi-Fi: «va bene
  anche con i giga». L'agente aveva consigliato il solo Wi-Fi: fino a 2 GB
  possono finire il traffico di un mese.

In Expo Go l'app non fa niente prima di essere aperta. Con una build
propria sull'App Store (TASK-152) c'è Background Assets di Apple, che
scarica durante l'installazione, quando l'app non sa ancora dove si trova:
lì solo le zone delle città più cercate. Non è stato chiesto se rispettare
la «Modalità dati ridotti» di iOS: da chiedere con la parte B.

### 5. Cosa resta al server

- **Restano al server**:
  - l'AI (le parole lette da Ollama);
  - le zone, che il server costruisce da Overpass e OSMnx;
  - gli esempi di «Explore»;
  - la ricerca dei luoghi;
  - gli account e la parte social;
  - la canoa, perché ha bisogno dell'acqua;
  - i percorsi da foto.
- **Può fare il telefono**: forme e parole su strada, di corsa e in bici,
  con le alternative A · B · C e le indicazioni.

**Proposta**: il telefono è una scelta in più, e il server resta sempre la
riserva. Con la zona già salvata calcola prima il telefono. Senza zona, o
se il telefono non riesce, calcola il server come oggi.

**Risposta dell'utente** (2026-10-03): «ottimo grazie».

### 6. Lo stesso motore

- **`route_engine` non cambia per il telefono** (CLAUDE.md, «Confini dei
  moduli»). L'adattatore per il telefono è un file nuovo, fuori dal motore,
  che riusa `jobs`, `images` e `schemas` dell'API senza FastAPI.
  `app.to_request` sta in `app.py`, che importa FastAPI: si copia
  nell'adattatore, con un test che controlla che le due copie diano lo
  stesso risultato.
- **Le versioni.** Il server installa le versioni più recenti che
  `pyproject.toml` permette (`Dockerfile`): oggi sul Mac networkx 3.7 e
  numpy 2.5.3. Pyodide 0.28.3 ha networkx 3.4.2 e numpy 2.2.5. TASK-203 ha
  già visto percorsi diversi fra versioni (ADR-0162).
- **Il formato delle zone.** Il pickle lega le versioni di NetworkX fra
  server e telefono: quando non si legge, il motore ripiega sul GraphML
  (ADR-0104), che sul telefono non c'è. In più un pickle può eseguire
  codice.

**Proposta**:
- la zona viaggia in un **formato neutro**: array di nodi e archi con i soli
  attributi che il motore usa, costruiti dal server dal grafo in cache;
- sul telefono la legge un `GraphLoader` dell'adattatore;
- un test controlla che grafo → file → grafo ridia lo stesso grafo;
- uno script confronta le impronte dei percorsi fra telefono (Pyodide), Mac
  e server sulle stesse richieste del registro;
- dove le impronte differiscono, si fissano le versioni sul server o si
  annota la differenza, come in TASK-203.

**Risposta dell'utente** (2026-10-03): «va bene grazie», alla proposta
precisata così: ogni percorso si salva com'è stato calcolato, uno script
confronta e annota, e **le versioni sul server non si fissano**: farlo
vorrebbe dire aggiornare il server e ridisegnare gli esempi.

## Le parti, dopo le scelte

**A — API** (prima PR):
- l'adattatore `on_phone.py`, con i suoi test;
- il formato neutro delle zone e il suo test di andata e ritorno;
- l'endpoint che dà la zona che copre un punto, per rete (`foot`, `bike`),
  con una versione per non riscaricarla. Sta in un file nuovo con
  `install_phone_zones(app, cache_dir)`. Si installa in `__main__.py`, non
  in `app.py`: lì c'è la cartella delle zone, che `create_app` non riceve
  (detto al coordinatore);
- ADR-0177.

**B — App**:
- la WebView nascosta con Pyodide e il motore (`src/engine/`, nuovo);
- le zone in `documentDirectory` con il limite di spazio;
- il download al primo avvio;
- il calcolo sul telefono e il passaggio al server.

Gli asset di Pyodide e il pacchetto del motore li costruisce uno script,
dalla stessa versione di `route_engine` del repository.

**C — «Settings»**: la riga dello spazio usato con «Delete». I testi in
inglese li sceglie l'utente; le traduzioni passano da `t()` di TASK-210.

**D — Prova sull'iPhone**: tempi, memoria, e le stesse impronte del server
su dieci richieste.

## Il server: avvio, zone, traffico

Note chieste dal coordinatore il 2026-10-03.

**Come parte l'API sul server.** Nel `Dockerfile` è `CMD ["python", "-m",
"shaperoute_api", "--lan"]`, e in `deploy/compose.yaml` il `command` è
`python -m shaperoute_api --lan --ai-url …`. Tutti e due passano da
`main()`, che installa `/phone-zones`; con il solo `create_app`
l'endpoint non ci sarebbe. Ci sono due test:
- `test_the_server_starts_the_api_from_the_command_line` legge i due file;
- `test_the_api_started_from_the_command_line_has_it` avvia `main()` e
  chiede una zona.

La cartella è `data/cache`, il volume `/app/data/cache`: il file per il
telefono si scrive lì, accanto alla zona.

**Le zone già sul server, nel formato neutro.**

| | Prima di comprimere | Formato neutro con gzip | Scritta sul Mac in |
|---|---|---|---|
| Trento | 19 MB | 7,0 MB | 2,7 s |
| Milano | 72 MB | 24,9 MB | 12,0 s |
| Tokyo | 83 MB | 27,9 MB | 14,8 s |

La misura è sui pickle: il file neutro pesa il 34–37% del pickle. Sul Mac
le 30 zone `foot` in cache fanno 894 MB di pickle, con una mediana di 27 MB.

- **Per le 66 città e la zona bici di Trento**, la stima è **0,7–0,8 GB**
  sul disco del server, e **20–30 minuti** di calcolo: circa 6 sul Mac, e
  il server è 3–5 volte più lento (TASK-168).
- **Il comando** è `python -m shaperoute_api.phone_zone_api`, dentro il
  container dell'API. Scrive i file di tutte le zone in cache e salta
  quelli già aggiornati.
- **Senza questo passo** il file si scrive alla prima richiesta di un
  telefono, che aspetta: circa 50 s per Milano sul server.
- **È un passo da fare con l'ok dell'utente**, come `draw_examples`, dopo
  l'aggiornamento del server con la parte A. Va aggiunto a `DEPLOY.md`
  F.12 da chi tiene quel file (TASK-122).

**Il traffico del server.**

Quanto scarica un telefono:
- **al primo avvio** la zona intorno a sé, `foot` e `bike`, più gli esempi:
  circa 20–40 MB;
- **le zone in più**, città vicine e più cercate, non arrivano a 2 GB: oggi
  il server ha in tutto 0,7–0,8 GB di zone. Il limite di 2 GB è lo spazio
  sul telefono, non quanto si scarica.

Quanto regge il server:
- **Hetzner** include 20 TB al mese di traffico in uscita (sedi UE, da
  verificare sul pannello). Nel caso peggiore, con ogni telefono che
  scarica tutte le zone, cioè 0,8 GB, bastano per circa 25 000 telefoni
  nuovi al mese.
- **La banda** è il rischio vero: 1000 telefoni nuovi in un giorno sono
  circa 0,8 TB, in media 70 Mbit/s, e tolgono rete e disco ai percorsi.
- **Le zone non cambiano fra i telefoni**: una CDN o uno Storage Box
  davanti ai file toglierebbe questo traffico al server. È un seguito.

Proposta di tetto, da far confermare all'utente con la parte B:
- **la propria zona** si scarica sempre;
- **le zone in più** vanno al massimo a 300 MB al giorno per telefono;
- **in tutto il server** dà al massimo 300 GB al giorno di zone in più,
  circa 9 TB al mese. Oltre il tetto risponde `429` con `Retry-After`, e
  il telefono riprova il giorno dopo.

Il tetto chiede che l'app dica quali richieste sono «in più», per esempio
con `?prefetch=1`. Si fa nella parte B o in una A2, con un numero di
migrazione solo se si contano i byte nel database (proposta: in memoria,
per giorno).

**Gli avvisi con i dati mobili** (parte B; testi da confermare con
l'utente, in inglese, poi tradotti con `t()`). Proposta:
- **la prima volta**, una riga sotto la mappa mentre scarica: «Downloading
  the maps of your area (35 MB) so routes work without signal.»;
- **in «Settings»**, «Offline maps: 1.2 GB» con «Delete», e sotto «Maps
  download on Wi-Fi and mobile data.»;
- **nessun avviso a ogni download**: l'utente ha scelto il download da
  solo, anche con i dati mobili.

## Criteri di accettazione

- [x] Le sei scelte hanno la risposta dell'utente, scritta qui.
- [x] La stessa richiesta dà lo stesso `RouteResultBody` dall'adattatore e
      da `/route-jobs` (test in CPython, nella CI, parte A).
- [x] Una zona passata nel formato neutro e riletta è lo stesso grafo
      (test, parte A).
- [ ] Le impronte di telefono, Mac e server sulle stesse richieste sono
      confrontate, e le differenze annotate qui.
- [ ] Senza rete, con la zona salvata, l'app disegna un cuore da 5 km sul
      telefono. Fatto nel simulatore con l'API spenta (parte B); manca
      l'iPhone (parte D).
- [x] Senza zona, o con la WebView chiusa da iOS, la richiesta va al
      server, e chi usa l'app non vede errori (test della parte B).
- [ ] Tempi e memoria misurati sull'iPhone, scritti qui.
- [x] In «Settings» lo spazio delle mappe del telefono, con «Delete», e
      sopra «Draw route» l'avviso del primo download, nelle cinque lingue
      (test e simulatore, parte C).
- [x] `git diff` su `services/route-engine/route_engine/` vuoto (A, B e C).

## File toccati

Il task file entrò da solo con la #258. Per il codice, confermati con il
coordinatore prima di partire (parte A il 2026-10-03; parte B il
2026-10-03 sera, con `App.tsx`, `useRouteRequest.ts` e `expo-asset` in
`package.json` e nel lock; `metro.config.js` non serve più):

```
docs/tasks/TASK-214.md, docs/DECISIONS.md (ADR-0177), docs/STATUS.md
docs/ARCHITECTURE.md, docs/API.md, docs/UI.md
services/api/shaperoute_api/on_phone.py            (nuovo)
services/api/shaperoute_api/phone_zones.py         (nuovo)
services/api/shaperoute_api/phone_zone_api.py      (nuovo, anche il comando)
services/api/shaperoute_api/phone_zone_cap.py      (nuovo, parte A2)
services/api/shaperoute_api/__main__.py            (tre righe, al posto di app.py)
services/api/tests/test_on_phone.py, test_phone_zones.py,
  test_phone_zone_api.py, test_phone_zone_cap.py   (nuovi)
services/api/tests/test_request_log.py             (il finto create_app dà un FastAPI)
apps/mobile/src/engine/                            (nuova)
apps/mobile/assets/engine/                         (nuova: i due zip)
apps/mobile/package.json, package-lock.json        (expo-asset, una riga)
apps/mobile/App.tsx                                (la WebView e le zone)
apps/mobile/src/route/useRouteRequest.ts           (il telefono, poi il server)
apps/mobile/src/profile/SettingsPage.tsx, src/i18n/*.ts   (parte C)
tools/phone_engine/                                (nuova: build e confronto)
```

## Fuori scope

- La canoa e i percorsi da foto sul telefono.
- Le tile della mappa salvate per l'uso senza rete.
- Costruire le zone sul telefono da Overpass.
- Cambiare `route_engine` per farlo andare più veloce in WebAssembly: se
  serve, è un task suo.
- Pubblicare l'app e aggiornare il server: solo con l'ok dell'utente.

## Esito

**Parte A, l'API** (#275, in `main` come `f2d1e90` il 2026-10-03, non
ancora sul server; ADR-0177):

- **Il formato delle zone** è in `phone_zones.py`: JSON con gzip, nodi e
  archi con tutti gli attributi, e i nomi delle strade. Le geometrie sono
  liste di coordinate e `np.float64` torna `np.float64`. Gli archi sono
  scritti in un ordine che ridà a ogni nodo i suoi successori e i suoi
  predecessori nello stesso ordine (ordinamento topologico dei vincoli).
- **La zona di Trento** (`foot`, 32 728 nodi, 85 988 archi) torna
  identica: ordine, valori e tipi. Pesa 7,0 MB, contro i 7,9 del pickle
  con gzip. In CPython si scrive in 2,7 s e si legge in 1,4.
- **`GET /phone-zones/{network}?lat=&lon=`** (`phone_zone_api.py`) dà la
  zona in cache che contiene 3 km intorno al punto. Il file si scrive la
  prima volta accanto alla zona, e di nuovo quando la zona è più recente.
  Ha un ETag, e con `If-None-Match` risponde `304`. Senza zona risponde
  `404`; non scarica mai da Overpass.
- **Il comando** `python -m shaperoute_api.phone_zone_api` scrive in
  anticipo i file di tutte le zone in cache (sopra, «Il server»).
- **`on_phone.py`** fa sul telefono il job di `/route-jobs`: `RouteJobs`
  con un esecutore che lavora subito, `plan_on_phone` (le partenze vicine
  una dopo l'altra) e le zone del telefono (`PhoneZones` dentro
  `ZoneGraphs`). Restituisce il JSON di `GET /route-jobs/{job_id}`.
- **Test**:
  - sulla zona di Levico, la stessa richiesta dà dal telefono e da
    `/route-jobs` lo stesso `result`;
  - senza zona la risposta è `map_data_unavailable`, in canoa
    `invalid_request`;
  - `to_request` è uguale a quello dell'API.

  28 test nuovi.
- **In Pyodide**, in Node sul Mac, il codice vero sulla zona di Trento
  disegna il cuore da 5 km in 7,0 s la prima volta e in 5,3 s la seconda;
  CPython ci mette 3,5 s. Il JSON è uguale a quello di CPython, salvo 18
  angoli delle indicazioni che differiscono meno di 1e-9.

**Parte B, l'app** (#282, in `main` come `b87d8cc` il 2026-10-03; su
«preview» dal 2026-10-04, gruppo `1da074a6`; ADR-0177). Finché il server
non ha `/phone-zones` con le zone, l'app chiede tutto al server, come
prima:

- **Pyodide 314.0.7, non 0.28.3** (deciso dall'agente). In 0.28.3 la
  stella da 5 km a Trento fa fallire il `buffer` di Shapely 2.0.7 (GEOS
  3.12.1) con una TopologyException. In Pyodide è un errore fatale: Python
  si ferma per sempre in quella pagina. La 0.29.5 ha lo stesso Shapely.
  La 314.0.7 (Python 3.14.2, numpy 2.4.6, networkx 3.6.1, Shapely 2.1.2,
  pydantic 2.12.5) disegna la stella identica a CPython del Mac, e ha
  versioni più vicine al server (numpy 2.5.3, networkx 3.7, Shapely 2.1.2
  con GEOS 3.13.1). GEOS resta 3.12.1: dopo un errore fatale la pagina
  riparte, e la richiesta va al server (limite noto).
- **Due zip fra gli asset** (`apps/mobile/assets/engine/`), costruiti da
  `tools/phone_engine/phone_engine.py`:
  - `pyodide.zip`, 21,2 MB: Pyodide e nove pacchetti (c'è anche
    typing-inspection, per pydantic 2.12), con gli SHA-256 controllati, il
    lock ridotto a quei nove e `THIRD_PARTY.txt` con le licenze;
  - `engine.zip`, 0,6 MB: tutto `route_engine`, più i 13 moduli dell'API
    e dell'AI che `on_phone` importa, trovati dalle righe `import`.

  Non sono compressi: la pagina li legge con poche righe di JavaScript, e
  gli stessi file danno lo stesso zip. `zip` è già fra gli asset di Metro:
  `metro.config.js` non serve.
- **Nel repository**. `pyodide.zip` cambia solo con la versione di
  Pyodide, `engine.zip` con il motore. Il test
  `tools/phone_engine/test_phone_engine.py` (CI, job del route-engine)
  fallisce quando `engine.zip` è più vecchio del codice. Il messaggio dice
  di lanciare `python tools/phone_engine/phone_engine.py engine`. Gli zip
  stanno nel repository perché `eas update` pubblica quello che Metro
  trova nel checkout pulito di `origin/main`: un passo di build prima di
  ogni pubblicazione si dimenticherebbe.
- **Il download per il telefono**. Gli asset di `eas update` si
  riconoscono dal contenuto: un telefono scarica `pyodide.zip` una volta
  sola, 14,0 MB con gzip (13,1 con brotli, 21,2 senza compressione).
  `engine.zip`, 0,12–0,16 MB compresso, lo riscarica quando cambia il
  motore.
- **Expo Go basta**, senza una build propria: nel simulatore (iPhone 17e,
  Expo Go 57) la WebView carica WebAssembly da file locali.
- **Come gira** (`apps/mobile/src/engine/`):
  - `page.ts`, la pagina della WebView. Legge gli zip con
    XMLHttpRequest, perché in WebKit `fetch` non legge `file:`. Risponde
    da memoria alle richieste di Pyodide e rifiuta ogni altro indirizzo.
    `pyodide.asm.mjs` entra da un blob, con `createPyodideModule`;
  - `PhoneEngineView.tsx`, la WebView nascosta: 1×1 e fuori dal layout,
    anche il suo contenitore, che con `flex: 1` toglieva metà schermo
    all'app. La pagina sta in `Documents/engine/index.html`; la WebView
    legge solo la cartella comune a pagina, zone e zip;
  - `phoneEngine.ts`, una richiesta alla volta. Python parte alla prima
    richiesta, o all'apertura dell'app quando c'è una zona. Se iOS chiude
    la WebView durante un percorso, quel percorso va al server; dopo due
    volte il telefono smette fino alla prossima apertura. Chiusa mentre è
    ferma, non conta. Dopo un errore fatale di Python, una pagina nuova;
  - `zones.ts`, le zone in `Documents/engine/zones/` con il nome che dà
    l'API, e un indice con ETag, peso e ultimo uso. Chiede con
    `If-None-Match` e tiene la zona al `304`. Oltre 2 GB cancella la zona
    usata meno di recente. Scarica con `downloadAsync` di
    `expo-file-system/legacy`, l'unico che dà stato e intestazioni;
  - `usePhoneZones.ts`, a ogni apertura, con la posizione: le zone a piedi
    e in bici, prima quella dello sport di «Settings», con qualunque rete;
  - `onPhone.ts`, il telefono prima, fino a 8 km a piedi e 30 km in bici.
    I verdetti del motore (`shape_not_drawable`, `invalid_request`) si
    mostrano subito; tutto il resto va al server. Oltre quei limiti prima
    il server, e il telefono solo quando il server non risponde, con 5
    minuti di tempo.
- **Perché i limiti di distanza**. Il telefono calcola la partenza e le tre
  partenze vicine una dopo l'altra; il server le calcola insieme, con una
  scadenza (ADR-0071). Tempi di Pyodide 314 in Node sul Mac, sulla zona di
  Trento. Sono rumorosi: il Mac lavorava anche per altre sessioni.

  | Richiesta | Pyodide |
  |---|---|
  | cuore 3 km | 8,5 s |
  | cuore 5 km (simulatore) | 6,8 s |
  | cavallo 8 km | 45,1 s |
  | stella 10 km | 25,1 s |
  | cuore 10 km | 117,3 s |
  | cuore 15 km | 98,4 s |
  | «CIAO» 12 km | 164,7 s |
  | «SGRAVA» 18 km (simulatore) | 93,2 s |
  | bici, cuore 15 km (simulatore) | 15,7 s |
  | bici, stella 20 km | 15,3 s |

  Un iPhone sarà più lento del Mac: i limiti li fissa la parte D.
- **Stesso percorso**: nelle 9 richieste in Node e nella parola del
  simulatore, Pyodide e CPython danno la stessa distanza e la stessa
  somiglianza. Il cuore in bici da 30 km è `map_data_unavailable` in tutti
  e due: la zona di Trento non basta.
- **Nel simulatore, l'app vera**: all'apertura chiede le due zone, `304`
  quando le ha già. Con l'API spenta, «Draw route» disegna sul telefono il
  cuore da 5 km a Trento: 5,2 km, le scelte A e B, gli avvisi e le
  indicazioni. Memoria di WebAssembly: 314 MB dopo il primo cuore, 412 MB
  dopo la parola da 18 km.
- **Test**: 38 nell'app (`src/engine/`) e 9 per lo script; tutta la suite
  dell'app passa.

**Risposte dell'utente** (2026-10-03 sera), tutte e due «Va bene così»
alla proposta:
- **i testi**, in inglese e tradotti con `t()` nelle cinque lingue:
  - la prima volta, una riga sotto la mappa mentre scarica: «Downloading
    the maps of your area (10 MB) so routes work without signal.», con il
    peso vero;
  - in «Settings», «Offline maps: 1.2 GB» con «Delete», e sotto «Maps
    download on Wi-Fi and mobile data.»;
  - nessun avviso agli altri download;
- **il tetto del traffico**:
  - la zona intorno a sé si scarica sempre;
  - le zone in più al massimo 300 MB al giorno per telefono;
  - il server ne dà al massimo 300 GB al giorno in tutto; oltre risponde
    `429` con `Retry-After`, e il telefono riprova il giorno dopo.

La «Modalità dati ridotti» di iOS non si chiede ora: in Expo Go non si
legge (`expo-network` non la dà). È un seguito della build propria
(TASK-152).

**Parte C, «Settings» e l'avviso** (#295, in `main` come `17a9e6c` il
2026-10-04, non pubblicata; ADR-0177,
«Decisione dell'agente, parte C»):

- **Dove sta l'avviso**: sopra «Draw route», in fondo a «Draw», la pagina
  con cui si apre l'app. Scelta dell'utente del 2026-10-04: la proposta
  diceva «sotto la mappa», ma la mappa si vede solo dopo «Draw route».
- **L'avviso**: «Downloading the maps of your area (10 MB) so routes work
  without signal.», piccolo e grigio. Compare solo se all'apertura il
  telefono non ha nessuna zona, cioè dopo l'installazione o dopo «Delete»;
  agli aggiornamenti delle zone niente. Il peso è quello vero, il
  `Content-Length` del server: lo dà il primo avanzamento di
  `createDownloadResumable` (`downloadAsync` non lo dà). Le due zone si
  sommano man mano che partono: a Trento «7 MB» con quella a piedi, poi
  «10 MB» con la bici. Sotto 100 kB la risposta è un errore del server,
  non una mappa, e non si dice. Finiti i download, la riga sparisce.
- **In «Settings»**, sotto «Preferences», dopo «Language»: 🗺️ «Offline
  maps: 10 MB», con «Delete» quando ci sono zone; sotto, «Maps download
  on Wi-Fi and mobile data.». Il peso è in MB interi, da 1000 MB in GB con
  un decimale: «1.2 GB», «1,2 GB» in italiano, «Mo» e «Go» in francese.
  «Delete» cancella subito tutte le zone, senza chiedere: si riscaricano
  alla prossima apertura, con l'avviso. Il numero segue le zone anche con
  la pagina aperta.
- **I testi** in inglese e nelle quattro tabelle (`src/i18n/`); «Delete»
  c'era già.
- **I file**: nuovi `src/engine/OfflineMapsSetting.tsx`, `ZoneNotice.tsx`
  e `sizeText.ts`. In `SettingsPage.tsx` una riga; in `App.tsx` l'avviso
  nel `footer` di «Draw»; in `zones.ts` il peso, `savedBytes` e
  `watchZones`; `usePhoneZones` dà i byte del primo download.
- **Nel simulatore** (iPhone 17e, Expo Go, 2026-10-04), con l'API del
  branch e le zone di Trento dietro un proxy lento, a 400 kB/s:
  - «Settings» dice «Offline maps: 10 MB»; «Delete» porta a «0 MB» e
    sparisce;
  - riaperta l'app, sopra «Draw route» compare «… (7 MB) …», poi
    «… (10 MB) …», poi la riga sparisce.
- **Test**: 16 nuovi; tutta la suite dell'app passa.

**Parte A2, il tetto del traffico** (#330, in `main` come `6f14656` il
2026-10-05, non sul server; ADR-0177,
«Decisione dell'agente, parte A2»). Solo codice: niente server, niente
migrazione.

- **Le richieste «in più»** sono `GET /phone-zones/{network}?…&prefetch=1`
  (`phone_zone_cap.py`, collegato in `phone_zone_api.py`). Senza
  `prefetch=1` la zona si dà sempre e non si conta: è quella intorno al
  telefono.
- **Il tetto** è quello scelto dall'utente: 300 MB al giorno per telefono,
  300 GB al giorno in tutto il server, in unità decimali come i 2 GB del
  telefono. Si contano i byte del file mandato. Una zona che farebbe
  passare uno dei due tetti si rifiuta intera, con `429
  too_many_requests`, «Enough maps downloaded ahead today: try again
  tomorrow.», e `Retry-After` con i secondi fino alla mezzanotte UTC;
  una più piccola può ancora entrare. Un rifiuto non si conta.
- **Il giorno** è quello UTC: in Italia ricomincia all'una di notte, alle
  due d'estate.
- **Un `304`** (la zona che il telefono ha già) non costa niente e passa
  anche oltre il tetto; una zona che il server non ha resta `404`.
- **Il telefono** è un id anonimo, 32 cifre esadecimali a caso fatte dal
  telefono la prima volta, nell'header `X-Phone-Id`. Il server lo tiene
  solo in memoria, per il giorno, e non lo scrive nei log. Senza un id
  valido conta l'indirizzo del telefono, che Caddy passa all'API
  (`FORWARDED_ALLOW_IPS` in `compose.yaml`), come per il limite dei POST;
  con i dati mobili più telefoni possono avere lo stesso. L'app nuova
  manda sempre l'id con `prefetch=1`; quelle di prima non mandano
  `prefetch=1`.
- **In memoria**: un riavvio dell'API riparte da zero, e un giorno con un
  riavvio può dare un po' di più.
- **Nell'app**, `downloadZone(…, { prefetch: true })` (`src/engine/zones.ts`)
  manda `prefetch=1` e l'id (`src/engine/prefetch.ts`, in
  `Documents/engine/prefetch.json`, che «Delete» non tocca). Dopo un `429`
  non chiede zone in più fino a `Retry-After` (mai più di un giorno; un
  giorno senza l'header); la zona intorno al telefono si chiede sempre.
  Nessuno la chiama ancora: le zone in più sono la parte B2.
- **Test**: 19 per il tetto e 6 per l'endpoint nell'API; 9 nell'app.

**Parte B2, le zone in più** (#337, in `main` come `f3fdbce` il
2026-10-05, non pubblicata; ADR-0177, «Decisione dell'agente, parte B2»).
Partita senza la #323 per scelta dell'utente («parti subito con la b»,
2026-10-05); le città vicine sono entrate dopo, con la B2b (#341).

- **Quando**: a ogni apertura, finite le zone intorno al telefono, e solo
  se il server ne ha appena data una (salvata o `304`): un server senza
  zone per il telefono, o nessuna rete, non riceve richieste inutili. Una
  zona alla volta, senza avvisi, con qualunque rete (scelte dell'utente).
- **Quali città, in ordine** (`src/engine/aheadZones.ts`):
  1. i paesi vicini al telefono, dal più vicino, come li dà `GET
     /nearby-cities` di TASK-236 (fino a sei, parte B2b). Senza risposta
     (un server di prima, nessuna chiave Geoapify) il giro va avanti
     senza, e li richiede il giorno dopo;
  2. quelle scelte per ultime in «Explore» (fino a cinque, la memoria
     dell'app), cioè le più cercate da chi usa il telefono;
  3. le 14 città in evidenza di «Explore», **dalla più vicina**. Il centro
     lo dà `GET /cities` come al tocco del chip, una volta sola: poi resta
     in `Documents/engine/ahead.json`.

  Una città che una zona salvata contiene già non si chiede: la sua zona
  si aggiorna il giorno che il telefono si apre lì, come zona intorno.
- **Solo la rete dello sport** di «Settings» (a piedi con la canoa):
  le zone bici sul server sono poche, e scaricarle tutte e due
  raddoppierebbe il traffico.
- **Il tetto** è quello della parte A2: ogni zona va con `prefetch=1`;
  al `429` il giro si ferma fino a `Retry-After`.
- **Un giro intero al giorno al massimo.** Un giro interrotto (rete
  caduta, app chiusa, tetto, un centro che non arriva) riprende alla
  prossima apertura.
- **I 2 GB**: il giro si ferma a 100 MB dal limite, lasciando posto alla
  zona intorno al telefono. Una zona scaricata in anticipo entra come
  «mai usata» (`usedAt` 0): oltre il limite se ne va prima di quelle in
  cui il telefono è stato. Diventa «usata» quando un percorso la usa o il
  telefono si apre lì.
- **«Delete»** in «Settings» lascia `ahead.json`: la zona intorno torna
  alla prossima apertura, le altre col giro dopo. Se il giro del giorno era
  finito, il giorno dopo.
- **Prima di pubblicare**: il server deve avere la parte A2, e ce l'ha
  dal 2026-10-05 alle 08:54Z (`fd14cd3`). Senza il tetto un telefono
  scaricherebbe in un giorno tutte le zone in più, oggi circa 0,2 GB per
  le città in evidenza. **Meglio anche scrivere prima le zone del
  telefono sul server** (`python -m shaperoute_api.phone_zone_api`, il
  passo della parte D): senza, il primo telefono che chiede una zona la
  fa scrivere al server, circa 50 s di calcolo per Milano, una volta per
  zona.
- **Test**: 9 nuovi in `aheadZones.test.ts`, uno in `zones.test.ts`, uno
  in `usePhoneZones.test.ts`; tutta la suite dell'app passa (1926).
- **Nel simulatore** (iPhone 17e, Expo Go, 2026-10-05), con l'API del
  branch e la cache delle zone del Mac, il telefono a Trento con le sue
  due zone:
  - all'apertura, due `304` per le zone intorno; poi le 14 città con
    `/cities`, e una zona alla volta con `prefetch=1`: Milano, Torino,
    Roma, Parigi, Berlino (`404`: il Mac non ce l'ha), Amsterdam,
    Barcellona, Londra, Lisbona, Dubai, New York, Tokyo, San Francisco,
    Sydney. 13 zone, 211 MB, in circa 2 minuti, tutte con `usedAt` 0;
    sotto i 300 MB del giorno, nessun `429`;
  - riaperta l'app, solo i due `304`: niente `/cities`, niente zone in
    più;
  - con il giro di 25 ore prima, i due `304` e una richiesta sola, Berlino.
  - Nessun avviso sopra «Draw route».

**Parte B2b, le città vicine** (#341, in `main` come `a9ca8f6` il
2026-10-05; ADR-0177, punto 1
della parte B2). Il giro chiede prima i paesi vicini con
`fetchNearbyCities` di TASK-236 (`src/explore/nearbyCities.ts`, solo
letto), che tiene la risposta per quadrato di circa 1 km, la stessa che
usa «Explore». I paesi vengono in testa, prima delle città scelte per
ultime e di quelle in evidenza. Sul server di oggi `/nearby-cities` non
c'è ancora (404): il giro va avanti senza, e li richiede il giorno dopo.
Test: uno nuovo per l'ordine e i paesi già dentro la zona intorno;
tutta la suite dell'app passa (1960). Non provata nel simulatore: è
un'aggiunta all'ordine del giro provato con la B2.

**Le zone del telefono sul server** (2026-10-05, ok dell'utente «ok zone e
pubblica» e «fallo girare anche ora»; lanciate dal coordinatore con `nice
-n 19 python -m shaperoute_api.phone_zone_api` nel container):
- **521 file, 2,6 GB, 82 minuti**. La stima di prima (0,7–0,8 GB, 66
  città) era vecchia: il server aveva 521 grafi `foot` e `bike`, 7,3 GB
  di pickle. Sul Mac 33 zone fanno 352 MB in ~155 s, con un picco di
  memoria di 2,0–2,35 GB (una zona alla volta).
- **Trento**: a piedi 2,5 MB, in bici 11,5 MB, in meno di 0,1 s.
  `/phone-zones` dà la zona più piccola che contiene 3 km intorno al
  punto, e sul server per Trento è una zona piccola: un percorso più
  lungo di quella il telefono lo passa al server. Lo misura la D.
- **App**: B2 e B2b su «preview» da `main` `7a9506a` (gruppo
  `1b49d248`), pubblicate dal coordinatore. Da allora il telefono
  scarica la sua zona e disegna da sé: comincia la D.

**Le parti dopo** (d'accordo con il coordinatore, ognuna in un contesto
pulito, tutte sotto TASK-214 e ADR-0177):
1. **C**, la riga in «Settings» e l'avviso del primo download: fatta,
   sopra.
2. **A2**, il tetto sul server: le richieste «in più» con `?prefetch=1`, i
   byte contati per giorno, in memoria, senza migrazione: fatta, sopra.
3. **B2**, le zone in più, cioè le città vicine e le più cercate fino a 2
   GB (scelta 4, punto 2): fatta, sopra; le città vicine con la B2b,
   dopo la #323 (TASK-236).
4. **D**, la prova sull'iPhone: fissa i limiti di distanza. Le zone del
   telefono sono sul server dal 2026-10-05 (sotto): la prova è
   dell'utente, con l'app di «preview». Fatta il 2026-10-25, sopra.

**Parte D, la prova sull'iPhone** (2026-10-25). L'ha fatta l'utente, sul
suo iPhone, con l'app che usa le zone del server dal 2026-10-05. Le sue
parole: «funziona ma cerca di migliorarlo». La prova dice che il telefono
disegna; i numeri dei criteri ancora aperti (tempi e memoria sull'iPhone,
impronte confrontate, cuore senza rete) non li ha dati la prova: vengono
dalle misure del miglioramento, nella parte che segue.

**Le misure dopo D** (2026-10-25, dell'agente, sul Mac M4; dettagli in
`out/task214-miglioramento/misure.md`, ignorata da git). Zona di Trento
`foot` come quella che il server dà al telefono (7,4 × 7,4 km, 2,7 MB):

- **La zona è piccola.** Il server dà la zona più piccola con 3 km intorno
  al punto (`ZONE_MARGIN_M`). Il ritaglio del motore va da 1,4–2,1 km (3 km)
  a 2,1–3,8 km (8 km, 6 forme su 17 oltre 3 km), e la ricerca «più lontano»
  chiede 3,2–4,3 km. Sul codice del telefono, 8 richieste fino a 8 km:
  dal centro della zona 7 disegnate sul telefono; da 1,5 km più in là 1;
  da 2,5 km nessuna. Le altre vanno al server con `map_data_unavailable`,
  in meno di 0,1 s. Da una partenza scelta sulla mappa, o senza rete
  lontano da dove si è aperta l'app, il telefono non disegna.
- **Tempi.** Stesso percorso dai tre. Cuore da 5 km: server sullo stesso Mac
  2,4 s, telefono in CPython 5,2 s, in Pyodide 9,6 s (le altre: 2,6–8,9 s).
  Pyodide è circa 1,8× CPython; le partenze vicine una dopo l'altra fanno
  il 65% del lavoro. Il server vero ci mette 9–12 s per lo stesso cuore: il
  telefono non è più veloce, ma lavora senza rete e senza il server.
- **Le partenze vicine contano**: in 44 lavori su 76 il percorso scelto è
  di una partenza vicina. Le scadenze del server applicate sul telefono non
  fanno risparmiare niente in mediana a questa velocità.
- **Memoria.** Python avviato 79 MB, 196–338 MB dopo i percorsi; la zona
  costa circa 21 MB di memoria per MB di file (Trento 0,78 s e +57 MB).
- **I log del server non sono letti**: la lettura via `ssh` è stata
  bloccata dai permessi della sessione.

**I log dell'API sul server** (letti dall'utente lo stesso giorno con lo
script dell'agente, che dà solo conteggi e secondi; log Docker dal
2026-10-10 al 2026-10-25, 15 giorni):

- **Pochi percorsi**: 272 `POST /route-jobs`, da 1 a 41 al giorno. Per
  distanza, fra quelli calcolati: fino a 3 km 55, fino a 5 km 79 (più 55
  esempi già disegnati), fino a 8 km 66, oltre 23. Quindi 200 su 223
  arrivano al server pur stando nei limiti del telefono (8 km).
- **Tempi del server**: mediana 0,9 s fino a 3 km, 7,2 s fino a 5 km (p90
  18,3 s), 5,5 s fino a 8 km, 10,9–15,7 s fino a 15 km. Le righe dei tempi
  per fase (TASK-289) non ci sono: il server non ha ancora quel codice.
- **Le zone del telefono**: 155 richieste in 15 giorni. A piedi 44 `404`, 19
  `200`, 7 `304`; in bici 41 `404`, 1 `200`, 13 `304`. **Più di metà sono
  `404`**: lì il server non ha una zona con 3 km intorno al punto, quindi il
  telefono non ha mappa e manda tutto al server. Nessun `429`; un solo file
  scritto al momento (5,5 s).
- **Errori**: 40 `shape_not_drawable` (23 fino a 3 km), 5
  `map_data_unavailable`, 12 `engine_error`, tutti «the shape collapses onto
  a single road node» (TASK-277). 36 lavori annullati (15 mentre scaricavano
  la zona, 16 mentre calcolavano).
- **Le zone del server per i percorsi**: 118 dalla memoria, 92 dal disco, 21
  scaricate al momento (ritaglio fino a 347 s).

Proposte all'utente, in attesa della sua scelta: (1, raccomandata) una
zona con 6 km intorno, sotto ~10 MB, letta all'apertura; (2) un segnale
anonimo a ogni percorso, per avere i numeri degli iPhone; (3) le scadenze
del server sul telefono (tocca `route_engine`: un task suo).

**Risposta dell'utente** (2026-10-25): «fai la 1».

**Parte E, la zona più larga intorno al telefono** (#546, in `main` come
`7da61107` il 2026-10-25, mergiata dal coordinatore insieme ai documenti
della parte D della #541; ADR-0177, «Decisione dell'agente, parte E»).
Per chi corre: il telefono disegna fino a 8 km anche da una partenza
scelta sulla mappa o a 2 km da dove si è aperta l'app, anche senza rete,
dove il server ha una zona abbastanza grande; e il primo percorso non
aspetta la lettura della zona.

- **L'API** (`phone_zone_api.py`): `GET /phone-zones/{network}` accetta
  `margin_m` (da 3000 a 10 000 m). Dà la zona più piccola che contiene
  quel margine intorno al punto, se il suo file pesa al massimo **12 MB**;
  altrimenti, o senza `margin_m`, quella di prima, con 3 km. Il file si
  scrive se manca, come per la zona di 3 km. Il `304` arriva se l'`ETag`
  della zona scelta è in `If-None-Match` (anche fra altri, separati da
  virgole) o nell'header nuovo `X-Zone-ETags`, e porta il suo `ETag`. Le
  app di prima chiedono e ricevono le stesse zone.
- **12 MB e non i ~10 della proposta** (deciso dall'agente): è la zona più
  grande che i telefoni usano già, quella in bici di Trento (11,5 MB).
  Letta, una zona costa circa 21 MB di memoria per MB di file: 12 MB sono
  circa 250 MB, più Python e i percorsi. Milano intera (25 MB) resta
  fuori: lì il telefono tiene la zona di 3 km.
- **L'app** (`src/engine/`):
  - chiede le zone intorno a sé con `margin_m=6000` (`AROUND_MARGIN_M`,
    `usePhoneZones.ts`). In `If-None-Match` va l'ETag della zona più
    piccola che ha lì, come prima; quelli delle altre in `X-Zone-ETags`. Al
    `304` segna come usata quella che il server nomina (`zones.ts`). Le
    zone in più (parte B2) restano a 3 km: il tetto del traffico non
    cambia;
  - per un percorso dà al motore tutte le zone che contengono la partenza,
    al massimo tre, dalla più piccola (`zonesForEngine`, `onPhone.ts`):
    Python disegna sulla più piccola che contiene tutto il percorso
    (`PhoneZones`), quindi un percorso troppo largo per la zona piccola
    trova quella grande;
  - quando le zone intorno ci sono (o, senza rete, quelle salvate), legge
    in memoria la zona dello sport (`PhoneEngine.prepare`, la pagina
    `warm`, `on_phone.warm`): quella di un percorso di 3–5 km da lì (2 km
    intorno). Va dietro ai percorsi già chiesti, uno nuovo la sostituisce,
    non avvia Python da solo; se iOS chiude la WebView mentre legge, non
    conta come morte.
- **Misure** (Pyodide sul Mac, zona di Trento 2,7 MB): `warm` 0,7 s; il
  primo cuore da 3 km da 8,9 a 7,4 s, stesso percorso.
- **Test**: 7 per l'endpoint e 2 per `warm` nell'API; 11 nell'app
  (`zones`, `onPhone`, `phoneEngine`, `usePhoneZones`). `engine.zip`
  rifatto.
- **App e server in qualunque ordine** (richiesto dal coordinatore il
  2026-10-25, prima del merge): il server di prima ignora `margin_m` e
  `X-Zone-ETags` e legge in `If-None-Match` lo stesso ETag di oggi, quindi
  con lui l'app nuova scarica le stesse zone di oggi. La lettura all'apertura
  e le zone date tutte al motore valgono subito; la zona più larga arriva con
  l'aggiornamento del server.
- **Non misurato**: quante zone del server bastano per i 6 km (la lista
  delle zone sul server non è letta); dove non ce n'è una, non cambia
  niente. I log dicono che oggi più di metà delle richieste di zona hanno
  `404`: lì la parte E non aiuta.

**Seguito fuori dal task**: una scadenza per le partenze vicine anche senza
processi, in `route_engine`, in un task suo. Il telefono disegnerebbe
percorsi più lunghi in meno tempo.
