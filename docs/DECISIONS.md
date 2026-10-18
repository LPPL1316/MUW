# DECISIONS — Registro delle decisioni

Una voce per decisione, **mai cancellata**. Se una decisione viene
ribaltata, la vecchia voce passa a `Superata da ADR-00XX` e se ne aggiunge
una nuova: sapere cosa si è provato e perché è stato abbandonato vale
quanto sapere cosa si usa oggi.

Formato: contesto in una riga, decisione, motivo, conseguenza.

Stati: `Attiva` · `Aperta` (da decidere) · `Superata`

---

## ADR-0001 — L'AI non genera percorsi
**Stato**: Attiva · 2026-09-22

Un modello linguistico non sa produrre coordinate corrette né rispettare
una rete stradale: inventerebbe tracce plausibili e sbagliate.

**Decisione**: l'AI traduce la richiesta in un `RouteRequest` strutturato e
si ferma lì. Il percorso lo calcola solo il route-engine.

**Conseguenza**: il prodotto funziona anche senza AI, con un form. Questa è
la verifica che il confine regga.

## ADR-0002 — Route engine separato dal backend
**Stato**: Attiva · 2026-09-22

**Decisione**: `services/route-engine/` è una libreria Python pura, senza
dipendenze da API, AI, rete o chiavi.

**Conseguenza**: si sviluppa e si testa da riga di comando, il che rende la
fase 1 possibile senza costruire nient'altro.

## ADR-0003 — Sviluppo per fasi guidate dal rischio
**Stato**: Attiva · 2026-09-22

**Decisione**: prima il route-engine completo e funzionante, poi app e API.
Non si costruisce l'interfaccia prima di avere qualcosa da mostrarci.

**Motivo**: il rischio del progetto è tutto nella conversione forma →
percorso reale. Rimandarla significa scoprire tardi se il prodotto è
possibile.

**Conseguenza**: per tutta la fase 1 si lavora in un solo linguaggio, con
cicli di prova di pochi secondi.

## ADR-0004 — Task piccoli, un branch e una PR ciascuno
**Stato**: Attiva · 2026-09-22

**Decisione**: nessun lavoro ordinario su `main`. Ogni task ha il suo file
in `docs/tasks/`, il suo branch e la sua Pull Request.

**Motivo**: oltre alla tracciabilità, è la misura principale di controllo
del contesto: un task piccolo entra in una sessione sola.

## ADR-0005 — Documentazione stratificata
**Stato**: Attiva · 2026-09-22

**Decisione**: `CLAUDE.md` corto e permanente; il dettaglio in `docs/`,
caricato su richiesta tramite `docs/INDEX.md`.

**Motivo**: `CLAUDE.md` si paga in ogni sessione, i documenti di dominio solo
quando servono.

## ADR-0006 — Gli stub si riempiono quando arriva il loro task
**Stato**: Attiva · 2026-09-22

**Decisione**: `API.md`, `DATABASE.md`, `UI.md`, `AI.md`, `MAPS.md`, `GPX.md`
restano segnaposto finché non inizia il task che li riguarda.

**Motivo**: documentare in anticipo decisioni non ancora prese produce testo
che sembra autorevole ed è inventato. È peggio di un file vuoto.

## ADR-0007 — Lingua: documentazione in italiano, codice in inglese
**Stato**: Attiva · 2026-09-22

**Decisione**: prosa dei documenti in italiano; identificatori, commenti,
messaggi di commit e PR in inglese.

**Conseguenza**: il repository resta apribile a collaboratori non
italofoni senza riscrivere il codice.

## ADR-0008 — OSMnx per la fase 1
**Stato**: Attiva · 2026-09-22

**Decisione**: prototipo di routing con OSMnx, che scarica la rete OSM e
calcola i percorsi in locale.

**Motivo**: nessun server da gestire, ciclo di prova immediato.

**Conseguenza**: è una scelta da prototipo, lenta su aree grandi. Il motore
di produzione è ADR-0009.

## ADR-0009 — Motore di routing di produzione
**Stato**: Aperta

Candidati: OSRM, GraphHopper, Valhalla. Valhalla è interessante per il
supporto a dislivello e superfici, che servirà in fase 4.

**Da decidere entro**: fase 4, con hosting e database (ADR-0013). Era
fase 2, TASK-022: rinviata con ADR-0030, l'MVP resta su OSMnx.

## ADR-0010 — Metrica di somiglianza
**Stato**: Superata da ADR-0023 (e ADR-0025) · 2026-09-23

Hausdorff contro Fréchet discreta: si implementano entrambe in TASK-015, si
confrontano con il giudizio a occhio e si sceglie con dati alla mano.

**Da decidere entro**: fine fase 1.

## ADR-0011 — Provider di mappe e tiles
**Stato**: Superata da ADR-0029 · 2026-09-23

## ADR-0012 — Provider e modello AI
**Stato**: Attiva · 2026-09-24 · provider e modello scelti dall'utente; il
resto proposto dall'agente e approvato dall'utente (TASK-030)

Vincolo già fissato: dietro un'interfaccia astratta, sostituibile senza
toccare l'architettura. Il lavoro dell'AI lo ha deciso la fase 3: leggere le
parole del riquadro della forma che la tabella dell'app non conosce
(«stemma della Ferrari») e scegliere una forma del catalogo (ADR-0036).

**Decisione**:
- **Provider: un modello aperto in locale, in Ollama**, sullo stesso PC
  dell'API. Niente chiavi né costi per richiesta, e le parole non escono
  dalla rete di casa. Ollama e i modelli stanno sul disco D:.
- **Modello: `qwen3:4b`** (Apache 2.0, 2,5 GB), senza «ragionamento»
  (`think: false`). Scelto misurando tre modelli con licenza aperta che
  parlano italiano: qwen3:4b, phi4-mini (MIT) e granite4:3b (Apache 2.0).
  Scartati prima di misurare: qwen2.5:3b (licenza di ricerca), Gemma e
  Llama (licenze proprie).
- **Pacchetto `services/ai/`** (`shaperoute_ai`), solo libreria standard:
  `ShapeModel.choose(text, shapes) -> Choice` è l'interfaccia,
  `OllamaModel` l'unico provider. Il catalogo lo passa l'API, e
  `ShapeReader` scarta ogni risposta fuori catalogo.
- **Risposta vincolata** da uno schema JSON: `picture` (cosa raffigura
  l'immagine più nota della cosa nominata), poi `shape`, un nome del
  catalogo o `none`. Temperatura 0, seme fisso. Testo da 1 a 60 caratteri.
- **API**: `POST /shape-readings`, `{text}` → `{text, shape}`; `503
  ai_unavailable` se Ollama non risponde entro 90 s; cache in memoria.
- **App**: prima la tabella; le altre parole vanno all'API quando l'utente
  ha finito di scrivere. «Draw route» si accende solo con una forma.
- **Soglia**: l'utente ha accettato qwen3:4b sotto il 90% della lista di
  messa a punto (87%), perché sulle parole nuove arriva al 94% e sbaglia
  forma di rado (3 volte su 84). La soglia si guarda sulla lista di
  controllo, che non serve mai a cambiare la domanda al modello.

**Motivo**: l'utente vuole strumenti gratuiti e open source (TASK-030,
punto A). Fra i tre modelli qwen3:4b dà più risposte giuste su tutte e due
le liste (89% in tutto, contro 83% e 81%) in 5–6 s a parola. granite4:3b
non sbaglia mai forma ma dice più spesso «nessuna»; phi4-mini dà 9 forme
sbagliate su 84. Con il ragionamento acceso, qwen3:4b non risponde in 5
minuti su questo PC (`AI.md`, «Misure»).

**Conseguenza**: il PC dell'API deve avere Ollama acceso con il modello
(`SETUP.md` 10.3); senza, l'app va lo stesso con le parole della tabella.
Il modello caricato occupa 3,2 GB di RAM per 15 minuti dopo l'ultima
parola, e la prima parola dopo una pausa aspetta il caricamento, fino a
49 s. Quando l'API lascerà il PC (ADR-0013) servirà un altro provider:
un'altra classe dietro `ShapeModel`. Una forma nuova nel catalogo vuole la
sua riga in `OUTLINES` e le sue parole nelle due liste. Sull'iPhone le
parole semplici vanno, quelle che il modello conosce poco no («stemma della
ferrari», «spirit»): l'utente ha scelto di tenere il limite, documentato in
`AI.md`, «Limiti», invece di cercare un modello più grande.

## ADR-0013 — Database, hosting e autenticazione
**Stato**: Superata da ADR-0114 (scelte dell'utente) e ADR-0115 (come) ·
2026-10-01 (TASK-110)

Ipotesi di partenza: PostgreSQL + PostGIS. Non serve prima di avere account
e percorsi salvati.

## ADR-0014 — I GPX di prova si versionano
**Stato**: Attiva · 2026-09-22

Un GPX guardato una volta e buttato non lascia niente: alla modifica
successiva non c'è modo di sapere se il risultato è migliorato o peggiorato.

**Decisione**: i campioni generati stanno in `samples/`, entrano nel
repository e non si sovrascrivono mai — ogni rigenerazione incrementa la
versione nel nome. Ogni campione guardato ha una riga in `samples/LOG.md`
con punteggio di somiglianza e giudizio a occhio.

**Motivo**: la qualità del risultato non è catturabile da un test
automatico. L'unico modo di misurarla nel tempo è conservare i risultati e
confrontarli.

**Conseguenza**: il confronto fra punteggio e giudizio, accumulato prova
dopo prova, è il dato che chiude ADR-0010. In più `git show` recupera
qualsiasi campione com'era a una data precedente.

Restano ignorati `out/` e `scratch/`, per le prove che non si guardano.

## ADR-0015 — Repository pubblico
**Stato**: Attiva · 2026-09-22

Su GitHub la protezione del ramo `main` è gratuita solo sui repository
pubblici; su uno privato richiede GitHub Pro.

**Decisione**: `rockydalbianco/shaperoute` è pubblico.

**Motivo**: la protezione del ramo è il vincolo che regge tutto il metodo
di lavoro (ADR-0004), e vale più della riservatezza del sorgente. Nel
codice non c'è nulla di riservato: le chiavi stanno in `.env`, che non
entra nel repository.

**Conseguenza**: nessun segreto nei file, mai, nemmeno temporaneamente —
la cronologia di git è pubblica e conserva tutto. Se in futuro servisse
riservatezza, la visibilità si cambia dalle impostazioni, perdendo però la
protezione del ramo a meno di passare a GitHub Pro.

## ADR-0016 — Contratto e CLI del route-engine senza dipendenze runtime
**Stato**: Attiva · 2026-09-22 · le forme ammesse sono superate da ADR-0036

TASK-010 lasciava aperte alcune scelte sullo scheletro del route-engine.

**Decisione**:
- `RouteRequest` e `RouteResult` sono dataclass `frozen`, non modelli
  Pydantic; la validazione sta in `RouteRequest.__post_init__`.
- La CLI usa `argparse` della libreria standard.
- Distanza target ammessa: da 1 000 a 50 000 m.
- Attività ammesse: solo `running`.
- Forme ammesse: `circle` e `heart`, registrate in
  `route_engine/shapes/SUPPORTED_SHAPES`.

**Motivo**: il route-engine è una libreria pura (ADR-0002); ogni dipendenza
runtime evitata è una in meno da installare in CI e da tenere allineata.
Validare nel modello e non solo nella CLI protegge anche i chiamanti futuri
(l'API). I limiti di distanza coprono una corsa plausibile, da un giro breve
a una maratona abbondante; `running` è l'unica attività dell'MVP.

**Conseguenza**: l'API, in fase 2, userà Pydantic ai suoi confini e
convertirà verso le dataclass. Con latitudine negativa la CLI richiede
`--start=-33.9,18.4`, perché argparse legge `-33.9,...` come un'opzione.
Walking e cycling, o limiti di distanza diversi per attività, richiedono una
nuova voce che superi questa. I modelli vivono in `route_engine/models.py`
finché `packages/shared-types/` non esiste (ARCHITECTURE §3).

## ADR-0017 — `n_points` conta i vertici, la chiusura è in più
**Stato**: Attiva · 2026-09-22

Il cuore ha due punte (incavo in alto, punta in basso) a metà esatta della
lunghezza d'arco. Con 64 elementi di cui l'ultimo uguale al primo i segmenti
sono 63, dispari: la punta in basso cade fra due vertici, viene tagliata
(y = −16.2 invece di −17 prima della normalizzazione) e la spaziatura fra
punti consecutivi scende al 23% della media.

**Decisione**: una forma chiamata con `n_points` restituisce `n_points`
vertici equispaziati in lunghezza d'arco, più il primo ripetuto in fondo:
`n_points + 1` elementi, `n_points` segmenti. La chiusura resta esplicita
come vuole `ROUTE_ENGINE.md` §2.

**Motivo**: la regola "ultimo = primo" semplifica proiezione, routing ed
export; contare i vertici invece degli elementi è ciò che lascia al
chiamante il controllo sul numero di segmenti, e quindi sulle punte.

**Conseguenza**: il criterio di TASK-011 "`get_shape("heart")(64)`
restituisce 64 punti" si legge come 64 vertici, 65 elementi. Chi consuma la
lista e vuole i soli vertici usa `points[:-1]`.

## ADR-0018 — Proiezione: piano tangente locale, fase continua, rotazione antioraria
**Stato**: Attiva · 2026-09-22

TASK-012 doveva chiudere la scelta fra formula locale e `pyproj`, e fissare
come si esprimono fase e rotazione.

**Decisione**:
- Conversione metri ↔ gradi con il piano tangente nel punto di partenza
  (`route_engine/geo.py`, R = 6 371 000 m). Niente `pyproj`.
- La fase è una frazione del perimetro in `[0, 1)`, dal vertice 0. La curva
  proiettata inizia e finisce nel punto di partenza; i vertici originali
  restano tutti.
- La rotazione è in gradi, antioraria, applicata dopo la scala.

**Motivo**: misurato su un cuore con distanza fino a 50 km (il massimo di
ADR-0016): errore di perimetro sotto lo 0,05%, spostamento massimo di un
punto 5 m a 46°N e 8 m a 60°N — meno della larghezza di una strada, e lo
snapping sposterà molto di più. Una fase continua è ciò che serve
all'ottimizzatore (TASK-015); tenere i vertici originali conserva le punte
del cuore (ADR-0017). L'antiorario è la convenzione della trigonometria
usata nel codice.

**Conseguenza**: nessuna dipendenza nuova. La formula degenera vicino ai
poli (`cos lat0 → 0`); `RouteRequest` oggi ammette latitudini fino a ±90, e
se servirà un limite si apre un task. Se lo snapping di TASK-014 mostrasse
errori riconducibili alla proiezione, questa voce si riapre.

## ADR-0019 — Export GPX dentro il route-engine, solo libreria standard
**Stato**: Attiva · 2026-09-22

ARCHITECTURE §2 colloca l'export in `services/export/`, ma TASK-013 lo
chiede in `route_engine/export_gpx.py`.

**Decisione**: in fase 1 l'export GPX vive nel route-engine e usa solo
`xml.etree.ElementTree`. Formato: GPX 1.1, un `<trk>` con un `<trkseg>`,
coordinate a 7 decimali, niente quote, metadati senza nomi di persone. La
CLI rifiuta di scrivere su un file esistente.

**Motivo**: la fase 1 vive di generare → guardare → correggere dalla riga
di comando; un servizio separato non aggiunge nulla finché l'unico formato
è GPX. Il rifiuto di sovrascrivere rende automatica la regola di ADR-0014.

**Conseguenza**: in fase 2, con i formati wearable, si decide se spostare
il modulo in `services/export/`. Dettagli del formato in `docs/GPX.md`.

## ADR-0020 — Grafo stradale: cache locale, area della forma, penalità fissa
**Stato**: Attiva · 2026-09-22

Preparando TASK-014 sono emersi tre conflitti: `CLAUDE.md` vuole il
route-engine eseguibile senza rete, OSMnx scarica da internet; `TESTING.md`
chiede di versionare i grafi delle zone, che pesano decine di MB in un
repository pubblico; `ROUTE_ENGINE.md` §4 scarica un raggio pari alla
distanza target, circa 700 km² per 15 km.

**Decisione**:
- Il grafo si scarica una volta e si salva in `data/cache/` (ignorata da
  git); da lì la CLI gira offline. I test usano grafi sintetici costruiti
  nel codice e un grafo reale piccolo (< 1 MB) in `tests/fixtures/`. I
  grafi di zona non si versionano.
- L'area scaricata è il rettangolo della forma teorica proiettata più un
  margine.
- La penalità sugli archi già percorsi entra in TASK-014 con un fattore
  fisso, tarato a occhio sui campioni.

**Motivo**: la cache mantiene la promessa "senza rete" dopo il primo
download senza appesantire il repository; le fixture piccole bastano a
rendere i test deterministici. L'area della forma è ciò che il percorso usa
davvero. Senza penalità i primi campioni reali sarebbero pieni di tratti
ripercorsi, e giudicarli a occhio non direbbe nulla.

**Conseguenza**: `TESTING.md` (fixture) e `ROUTE_ENGINE.md` §4 (area) vanno
corretti in TASK-014. I campioni in `samples/` restano riproducibili solo a
parità di dati OSM: la data del download va annotata. Il fattore di
penalità si rivede con l'ottimizzatore (TASK-015).

## ADR-0021 — Solo `osmnx` come dipendenza; potatura degli speroni
**Stato**: Attiva · 2026-09-22

TASK-014 ha aggiunto la prima dipendenza runtime e ha mostrato che la
penalità sugli archi usati (ADR-0020) non basta contro le andate e ritorno.

**Decisione**:
- Dipendenza runtime: `osmnx>=2.1,<3` e ciò che porta con sé. Niente
  extra `neighbors` (scikit-learn, scipy): il nodo più vicino si calcola in
  metri con `geo.py` e numpy.
- Dopo il routing si potano gli speroni: ogni A → B → A diventa A, finché
  ce ne sono; se non resta un anello si tiene il percorso originale.

**Motivo**: calcolare in metri è la regola del progetto e numpy arriva già
con osmnx; scikit-learn e scipy aggiungerebbero ~60 MB per una sola
funzione. Rispetto a nessuna penalità, la penalità 2.0 cambia la distanza
del 0–3% (cuore 5 km, Trento e Levico); sui 12 campioni la potatura la
riduce del 19–53% e taglia gli archi ripercorsi del 43–90%. A occhio
erano proprio i ritorni a rovinare il disegno.

**Conseguenza**: le deviazioni residue (2,2–3,8× il target) sono il
problema di TASK-017. La penalità resta, con valore da rivedere lì.

## ADR-0022 — Zone e corridoio al posto del nodo più vicino; rete con le ciclopedonali
**Stato**: Attiva · 2026-09-22

TASK-017 doveva portare la distanza su strada entro 1,5× il target senza
ottimizzatore. Misurando anche quanta parte del contorno il percorso segue
davvero (copertura, `MAPS.md`), le varianti che ci arrivano lo fanno
saltando pezzi di forma. Guardando i campioni è emerso anche che la rete
`walk` di OSMnx scarta le ciclabili, quasi tutte ciclopedonali in Trentino.

**Decisione**:
- Ogni punto della forma, tranne la partenza, è una **zona** di nodi
  (raggio 2% del perimetro), non il solo nodo più vicino. Fra una zona e la
  successiva le strade costano di più quanto più stanno lontane dal
  contorno oltre una fascia del 2% del perimetro (**corridoio**, peso 2,0).
  Aggancio all'arco, guardia sulle deviazioni e sfoltimento dei waypoint
  sono stati provati e scartati.
- La rete a piedi è il filtro `walk` di OSMnx **senza** l'esclusione di
  `highway=cycleway`, costruita con `network_type="walk"` perché ogni strada
  resti percorribile nei due sensi. I grafi in cache si chiamano `foot_*`.
- Il traguardo di 1,5× esce da TASK-017 e passa a TASK-015: ruotare e
  scalare la forma, tracciare, misurare e ripetere finché forma e distanza
  vanno bene.

**Motivo**: sui 12 casi zone e corridoio accorciano in 11 casi (rapporto
mediano 2,89× → 2,57×) senza perdere copertura (79%); la guardia arriva a
11/12 entro 1,5× ma con copertura 41%, cioè disegnando un'altra forma. Le
ciclabili, sul cuore da 5 km a Levico, portano 1,82× → 1,47× e copertura
82% → 90%. Il residuo viene da dove cade la forma (campi, fiumi, ferrovie a
scala e rotazione iniziali), che nessun aggancio può correggere.

**Conseguenza**: TASK-017 si chiude con i criteri rivisti (più corto della
TASK-014 senza perdere copertura). TASK-015 usa `snap_to_network` così com'è
come passo di tracciamento e la copertura come candidata alla misura di
somiglianza. Gli 8 grafi `foot` non ancora scaricati si scaricano uno alla
volta quando Overpass risponde (`MAPS.md`).

## ADR-0023 — Un grafo per zona; somiglianza = copertura del contorno
**Stato**: Attiva · 2026-09-23 · la scelta della metrica è superata da ADR-0025

TASK-015 ruota e scala la forma attorno alla partenza: il rettangolo della
forma (ADR-0020) cambia a ogni tentativo, e scaricarlo ogni volta vorrebbe
dire decine di richieste a Overpass per un solo percorso. Serviva anche una
misura di somiglianza per decidere quando fermarsi (`ROUTE_ENGINE.md` §5).

**Decisione**:
- L'area è un **quadrato attorno alla partenza** che contiene la forma a
  ogni rotazione, fase e scala massima, più 500 m: circa 11,5 km di lato per
  15 km. Si scarica **un grafo per zona**; ogni area più piccola si ritaglia
  da un grafo in cache che la contiene, e il ritaglio si salva col suo nome.
  Ogni tracciamento lavora sul ritaglio attorno alla forma candidata.
- La somiglianza è la **copertura**: quota del contorno con il percorso
  entro il 2% del perimetro. Ci si ferma a **0,90** e distanza entro
  **±10%**; il costo pesa la forma 3 e la distanza 1.
- Hausdorff e Fréchet discreta sono implementate e misurate, ma scartate;
  `fit` (copertura nei due sensi) resta come misura di controllo.

**Motivo**: con un grafo per zona bastano 3 download per le tre zone (più
Milano per confronto), e un caso gira dalla cache in 3–24 s. Sui primi sei
percorsi giudicati a occhio, i due `sì` avevano copertura 90–95% e gli
altri 84% o meno; `fit` metteva un `sì` (71%) sotto un `no` (72%), Fréchet
dava il voto più alto a un `no`. La forma conta più della distanza per il
prodotto, da qui il peso 3.

**Conseguenza**: i grafi di zona pesano 8–26 MB in Trentino e 98 MB a
Milano, dove leggere il GraphML porta un caso a 36–85 s. La copertura non
vede anelli interni né punte (andata e ritorno su strade parallele): se i
giudizi a occhio lo chiedono, si passa a `fit` o si corregge lo snapping.
Soglia e pesi si rivedono con i giudizi sui campioni di TASK-015.

## ADR-0024 — Anteprima dei campioni: pagina HTML con Leaflet e tile OSM
**Stato**: Attiva · 2026-09-23

Ogni task di fase 1 produce 12 campioni da guardare a occhio, e caricarli
uno alla volta in gpx.studio costa più che guardarli (TASK-019). Il
provider di mappe e tiles dell'app, ADR-0011, è ancora aperto.

**Decisione**:
- `tools/preview_samples.py`, fuori dal route-engine e con la sola libreria
  standard, scrive una pagina HTML con tutti i GPX di un pattern, un
  livello per file. Le tracce sono dentro la pagina come JSON: si apre da
  `file://`, senza server.
- Mappa con **Leaflet 1.9.4** da unpkg (versione fissata, hash SRI) e
  **tile standard di OpenStreetMap**, con l'attribuzione sempre visibile.
  Uso leggero, interattivo e personale, come chiede la policy delle tile
  OSM: niente download in anticipo né per l'uso offline.
- La pagina va in `out/preview.html`, ignorato da git, e si sovrascrive: è
  usa-e-getta e si rigenera dai GPX versionati (ADR-0014).
- `tools/` è la cartella degli script di sviluppo. In CI lint e test
  girano nello stesso job del route-engine, con le sue regole
  (`--config services/route-engine/pyproject.toml`).

**Motivo**: un comando e un doppio clic al posto di dodici caricamenti,
senza dipendenze nuove né per il route-engine né per chi lancia lo script.
Leaflet con tile raster è il minimo che serve per guardare tracce; MapLibre,
la libreria dell'app, chiederebbe uno stile e un provider, cioè la
decisione di ADR-0011. Il dubbio sul Referer, che una pagina aperta da
`file://` non manda, è stato provato: le tile si caricano (Edge headless,
2026-09-23).

**Conseguenza**: la pagina ha bisogno della rete per Leaflet e per le tile,
anche se i dati sono dentro. La scelta vale solo per lo strumento di
sviluppo: ADR-0011 resta aperta per l'app. Se un giorno le tile da
`file://` venissero rifiutate, le alternative sono servire `out/` con
`python -m http.server` o un altro provider: si decide allora.

## ADR-0025 — Regole dell'ottimizzatore dopo i giudizi a occhio
**Stato**: Attiva · 2026-09-23 · la partenza si sposta anche fino a 2 km con
ADR-0040

I campioni di TASK-015 giudicati a occhio hanno mostrato quattro cose:
- la copertura non vede i pezzi tagliati;
- un cuore senza punta non sembra un cuore;
- forzare la forma a passare per il punto richiesto la fa tagliare vicino
  alla partenza;
- in Valsugana certe forme non si disegnano.

**Decisione**:
- **Somiglianza** = `fit` (copertura nei due sensi) meno 0,10 per ogni
  punta della forma mancata; ci si ferma a 0,90. Le punte sono i vertici
  in cui il contorno gira più di 60° (l'incavo e la punta del cuore). La
  ricerca penalizza già nel conteggio delle strade le punte senza strada.
- **Le punte non si potano**: lo sperone che scende alla punta di un cuore
  e risale è ciò che la disegna. Gli altri speroni si potano come prima.
- **Partenza spostabile** fino a 500 m (anelli a 250 e 500 m, 8 direzioni);
  spostarla deve valere almeno 5 punti di copertura. Il percorso parte e
  finisce nella partenza spostata: il tratto dal punto richiesto non entra
  né nel GPX né nella distanza.
- **Distanza**: obiettivo ±10%; se nessun piazzamento ci riesce, fino a
  **±2 km** pur di tenere la forma.
- **Forma non disponibile** (nessun percorso, errore esplicito) se la
  somiglianza migliore è sotto 0,60 o la distanza è oltre ±2 km.
- Ricerca: fino a 6 piazzamenti e 16 tracciamenti; ogni caso sotto i 40 s.

**Motivo**: sui giudizi v1 la copertura metteva Trento (`quasi`, 91–97%)
alla pari di Milano (`sì`, 95–100%); `fit` li separa (0,71–0,85 contro
0,91–1,00). A Levico la punta del cuore spariva per la potatura degli
speroni; con le punte protette e premiate i due cuori la raggiungono (v3),
ruotati di 45–60°. L'utente preferisce la forma alla rotazione e accetta
fino a 2 km di scarto quando la forma non ci sta, ma non un percorso che
non somiglia alla forma.

**Conseguenza**: `--no-optimize` rifà TASK-017, tranne dove la punta del
cuore era uno sperone potato: lì ora resta (cuore 5 km Valsugana: 15,9 →
16,8 km; Trento e Levico identici).
Soglie e penalità sono tarate su 16 casi e pochi giudizi: si rivedono con
altri campioni. Una forma rifiutata oggi (Valsugana 15 km cuore, 5 km
cerchio) può diventare disponibile con uno snapping migliore.

## ADR-0026 — Validazione del percorso e potatura delle punte parallele
**Stato**: Attiva · 2026-09-23 · lungo i tratti delle forme superata in
parte da ADR-0039

Dopo TASK-015 restavano difetti che nessuna misura vedeva: le "punte" di
andata e ritorno su strade parallele (marciapiede e strada), e tratti su
scale, strade principali e gallerie. La §6 di `ROUTE_ENGINE.md` chiedeva
anche un percorso che passasse per il punto di partenza, superato da
ADR-0025.

**Decisione** (soglie confermate dall'utente, da ritarare):
- ogni percorso misura la **ripercorrenza esatta** (archi già percorsi,
  warning sopra il 5%) e **visiva** (tratti entro 20 m da un altro tratto
  lontano almeno 60 m lungo il percorso, warning sopra il 10%; le punte
  della forma sono escluse) e i **metri su scale, strade principali**
  (`trunk`, `primary`) **e gallerie** (warning appena ci sono), solo con i
  tag già in cache;
- un percorso non chiuso, che non parte dalla sua partenza o con la
  partenza a più di 500 m da quella richiesta è un **errore del motore**,
  non un warning;
- nello snapping si **tolgono le punte parallele**: un tratto che torna
  entro 20 m da dove era passato, dopo almeno 60 m e al massimo il 15% del
  percorso, sottile per il 70% della lunghezza, senza punte della forma e
  con i due estremi collegati da strada in meno di 60 m. Le due potature
  (esatta e parallela) si ripetono finché il percorso non cambia;
- la ricerca resta quella di TASK-015 (correzioni di scala su ogni
  piazzamento), con 20 tracciamenti invece di 16.

**Motivo**: con 200 m di distanza lungo il percorso, come proposto, le
punte sotto i 200 m non si vedevano; con 60 m sì (cerchio 15 km Trento: 2%
→ 7%). Una sola passata di potatura lasciava sul cerchio 5 km di Levico il
59% di percorso ripercorso a vista; ripetendole, il 2%. Tracciare più
piazzamenti una volta sola invece di correggere la scala di ciascuno ha
dato somiglianza media 0,845 contro 0,862 sui 14 casi disegnabili.

**Conseguenza**: i percorsi puliti cambiano le distanze, quindi le
correzioni di scala e l'ordine dei tentativi: il cuore 15 km di Trento non
ritrova il piazzamento della v3 (0,94) e si ferma a 0,89, anche se quel
piazzamento, tracciato a mano, vale ancora 0,94. La ricerca resta sensibile
al percorso esatto dei tentativi. Sterrati, sentieri difficili e
marciapiedi richiedono altri tag (`surface`, `sac_scale`, `sidewalk`) e un
nuovo download.

## ADR-0027 — Cancello di fase 1 superato con la valle sospesa
**Stato**: Attiva · 2026-09-23

Il cancello di fase 1 (`ROADMAP.md`) chiede tre forme generate in città,
paese e valle e giudicate a occhio.

**Decisione**: il cancello è superato, e si passa alla fase 2. Giudizi sui
campioni `TASK-016_*_v1`: Trento (città) `sì` su cuore e cerchio,
Levico (paese) `quasi`, Milano (solo confronto) `sì`. La valle (Valsugana)
è sospesa su scelta dell'utente: dove la rete non basta, il motore dichiara
la forma non disponibile invece di disegnarla male (ADR-0025).

**Motivo**: in città e in paese la forma si riconosce alla distanza giusta;
in valle i casi da 5 km sono rifiutati dalla regola stessa del motore, non
disegnati male. Il rischio più grande adesso è l'app, non il motore.

**Conseguenza**: la valle resta un caso aperto, da riprendere con dati o
ricerca migliori, non in fase 2. Restano annotati in `STATUS.md` i limiti
noti del motore: scale e strade principali solo misurate, non evitate;
ricerca sensibile all'ordine dei tentativi (ADR-0026).

## ADR-0028 — Monorepo npm, app Expo, tipi condivisi scritti a mano
**Stato**: Attiva · 2026-09-23

TASK-020 crea la prima parte TypeScript del repository: servivano gestore
dei pacchetti, forma dell'app, posto e verifica dei tipi condivisi,
strumenti. Confermato dall'utente, con il vincolo che tutto sia aperto e
gratuito (lo è: licenze MIT).

**Decisione**:
- **Monorepo** con i workspace di **npm** (`apps/*`, `packages/*`), un solo
  `package-lock.json`, **Node 24** (`.nvmrc`). Niente pnpm, yarn, Turborepo.
  Alla radice un `overrides` tiene **una sola copia di React**, quella
  dell'SDK di Expo (oggi 19.2.3).
- **App** `apps/mobile` dal template Expo `blank-typescript`, **SDK 57**,
  `strict`, senza expo-router. Del template non si tengono `CLAUDE.md`,
  `AGENTS.md`, `.claude/` (istruzioni per agenti che imponevano expo-router
  ed EAS) e la `LICENSE` di Expo.
- **`@shaperoute/shared-types`**: sorgenti TypeScript senza build, stessi
  nomi dei campi di `models.py` (snake_case), punti `[lat, lon]`. Tre JSON
  di esempio (`fixtures/`) sono controllati da `tsc` e dal test runner di
  Node da un lato, da `tests/test_contract.py` del route-engine dall'altro.
- **Strumenti**: ESLint con `eslint-config-expo` (`expo lint`), Prettier
  (larghezza 88 come `black`, fine riga automatica per Windows), Jest con
  `jest-expo` e `@testing-library/react-native`, `tsc --noEmit` su ogni
  workspace; per `shared-types` `node --test`, che non aggiunge un secondo
  Jest. Job `mobile` in CI.

**Motivo**: npm e Node sono già installati e bastano per due pacchetti;
Expo trova da solo i workspace npm. Expo Go apre solo l'ultimo SDK, per
questo il 57. Copiare i tipi a mano con un test di allineamento costa meno
di un generatore di codice, e la scelta di generarli dall'OpenAPI resta a
TASK-022. Due copie di React nello stesso bundle rompono gli hook: npm, con
i workspace, ne aveva installate due (19.2.3 e 19.3.0).

**Conseguenza**: quando cambia l'SDK di Expo si aggiorna anche la versione
di React in `overrides`. `test-renderer` resta a ~1.2 finché Expo non passa
a React 19.3 (la 1.3 lo richiede). TypeScript 6 non carica più da solo i
tipi `@types`: vanno dichiarati in `types` (`jest` nell'app, `node` in
`shared-types`, che dichiara `@types/node`). `npm audit` segnala 10
vulnerabilità moderate, tutte da `uuid` dentro gli strumenti di build di
Expo (`xcode`), non nell'app: si risolvono con un SDK nuovo, non a mano.

## ADR-0029 — Mappa dell'app in WebView, posizione GPS, ricerca del luogo
**Stato**: Attiva · 2026-09-23

TASK-021 porta nell'app la mappa e la posizione. L'utente prova su iPhone
con Expo Go, da un PC Windows e con strumenti gratuiti: MapLibre React
Native non gira in Expo Go, e su un iPhone vero la *development build*
chiede un Mac o l'Apple Developer Program a pagamento. Confermato
dall'utente, che ha chiesto in più la ricerca del luogo quando la posizione
non c'è.

**Decisione**:
- **Mappa**: l'app scrive una pagina HTML e la apre in
  `react-native-webview`. Dentro, **MapLibre GL JS 5.24.0** da unpkg
  (versione fissata, hash SRI, come ADR-0024) e lo stile `liberty` di
  **OpenFreeMap** (dati OSM, gratuito, senza chiave né account).
  Attribuzione estesa, mai compressa dietro l'icona «i». La 5.x perché è
  l'ultima in un file solo: la 6 è solo moduli ES, con il worker in un file
  separato. URL dello stile in una sola costante.
- **App e pagina** si parlano con messaggi tipati: `setPosition` verso la
  pagina, `ready` ed `error` verso l'app. Lo scambio fra `[lat, lon]` e il
  `[lon, lat]` di MapLibre e GeoJSON avviene solo in
  `apps/mobile/src/map/coordinates.ts`. I link della pagina si aprono nel
  browser del telefono.
- **Posizione** con `expo-location`, solo in primo piano: una lettura
  all'apertura e una a ogni «My position», al massimo 15 s. Non esce dal
  telefono.
- **Senza posizione** (permesso negato, GPS spento o muto): mappa
  sull'Italia e ricerca di una città o una via con **Photon**
  (`photon.komoot.io`: dati OSM, gratuito, senza chiave, uso corretto e
  nessuna garanzia). Richiesta all'invio, non a ogni lettera, al massimo 5
  risultati. Il luogo scelto diventa la partenza; il GPS, quando risponde,
  torna a vincere.
- **Margini dello schermo** con `react-native-safe-area-context`: il
  `SafeAreaView` di React Native è deprecato.
- Dipendenze nuove: `react-native-webview`, `expo-location`,
  `react-native-safe-area-context`, nelle versioni dell'SDK 57, licenza
  MIT, tutte già dentro Expo Go.

**Motivo**: la mappa usa gli stessi dati OSM su cui traccia il motore,
quindi i sentieri del percorso si vedono; è la stessa su iPhone e Android;
non servono chiavi né account; resta MapLibre, e stile e provider si
riusano con MapLibre nativo se un giorno arriva una development build.
Scartati: `react-native-maps` (su iPhone è Apple Maps, senza i dati OSM; su
Android Google Maps con chiave e fatturazione), MapLibre React Native (non
gira in Expo Go), Leaflet con le tile OSM (la loro policy non è per un'app
distribuita); per la ricerca, il geocoder del telefono (su Android vuole
proprio il permesso che manca, e restituisce solo coordinate senza nomi) e
Nominatim (per le app chiede un server intermedio con cache e al massimo
una richiesta al secondo in tutto).

**Conseguenza**: l'app chiama direttamente due servizi esterni, le tile e
Photon; non sono servizi nostri, quindi ARCHITECTURE §4 («`mobile` parla
solo con `api`») non cambia. Senza rete non ci sono né mappa né ricerca, e
l'app lo dice. Il provider delle tile vede quale zona si guarda, Photon il
testo cercato (`UI.md`). OpenFreeMap e Photon non garantiscono nulla: si
cambiano in una costante ciascuno, e con molti utenti si potranno mettere
dietro l'API (TASK-022). A ogni avvio a freddo la WebView scarica circa
1 MB di MapLibre GL JS. La mappa vera non gira in Jest: nei test WebView,
posizione e rete sono finte, la pagina si prova sul telefono.

## ADR-0030 — API FastAPI sul route-engine, grafi di zona in memoria
**Stato**: Attiva · 2026-09-23 · l'app non usa più `POST /routes` ma le
richieste in due tempi, e il lucchetto unico dei grafi è diventato uno per
zona (ADR-0032)

TASK-022 espone il route-engine al telefono. Servivano forma dell'API,
errori, gestione dei grafi e una risposta ad ADR-0009 e alla domanda
lasciata aperta da ADR-0028 sui tipi generati. Confermato dall'utente.

**Decisione**:
- **Pacchetto** `services/api/` (`shaperoute_api`), Python 3.11, FastAPI e
  uvicorn; httpx solo per i test. Il route-engine si installa accanto, nello
  stesso ambiente. `python -m shaperoute_api` risponde solo al PC; con
  `--lan` alla Wi-Fi, e stampa l'indirizzo per il telefono.
- **Endpoint**: `GET /health` e `POST /routes`, con `RouteRequest` e
  `RouteResult` identici a `shared-types`. Richiesta sincrona. Niente
  autenticazione, prefisso di versione e CORS finché l'API gira solo sul PC.
- **Errori** tutti come `{"error": {"code", "message"}}`:
  `invalid_request` e `shape_not_drawable` (422), `map_data_unavailable`
  (503), `engine_error` (500), `http_error` per indirizzi e metodi
  sbagliati. I limiti dei valori restano solo in `models.py`.
- **Grafi**: l'API tiene in memoria gli ultimi 2 grafi di zona e ritaglia
  in memoria, senza salvare i ritagli; le zone nuove si scaricano e si
  salvano come con la CLI. Nel route-engine `read_graph` diventa pubblica.
- **Tipi**: niente generazione dall'OpenAPI. I modelli Pydantic leggono
  gli stessi JSON di esempio di `shared-types`, come `tsc` e il test del
  motore.
- **ADR-0009** (motore di routing di produzione) rinviata alla fase 4.
- **CI**: job `api` con lint e test.

**Motivo**: la CLI salva ogni ritaglio, da 3 a 110 MB per partenza: con
un'API il disco del PC, già quasi pieno, finirebbe in poche decine di
richieste; tenere la zona in memoria evita anche di rileggerla. Con due
oggetti nel contratto un generatore di tipi costa più di quanto risparmia,
e i JSON di esempio tengono già allineate le tre copie. OSRM, GraphHopper e
Valhalla sono server a parte e non conoscono zone e corridoio (ADR-0022):
adottarli vuol dire riscrivere lo snapping, meglio con i tempi misurati in
uso vero. `--lan` esplicito perché un'API senza autenticazione aperta alla
rete deve essere una scelta, non il default.

**Conseguenza**: un grafo di zona in memoria occupa centinaia di MB, da
qui il limite di 2. La prima richiesta in una zona legge il grafo dal
disco, le altre no. Con `--lan` chiunque sulla stessa Wi-Fi può chiedere
percorsi: va usata solo su reti di casa. Se il telefono non aspetta la
risposta di una richiesta lunga, le richieste in due tempi si decidono con
TASK-023.


## ADR-0031 — L'app chiede i percorsi all'API: indirizzo, attesa, errori
**Stato**: Attiva · 2026-09-23 · la richiesta sincrona e il limite di 60 s
sono superati da ADR-0032; i pulsanti delle distanze da ADR-0034, quelli
delle forme da ADR-0036

TASK-023 collega l'app all'API di ADR-0030. Servivano l'indirizzo
dell'API, la scelta di forma e distanza, l'attesa, il disegno del percorso
e un messaggio per ogni errore. Confermato dall'utente, per questa prima
fase.

**Decisione**:
- **Indirizzo**: l'host del server di sviluppo di Expo
  (`Constants.expoConfig.hostUri`) con la porta 8000; `expo-constants`
  diventa una dipendenza dichiarata. Senza host l'app lo dice, non tira a
  indovinare.
- **Forma e distanza** fra pulsanti: `circle` e `heart`; 3, 5, 10, 15 km;
  di partenza cuore da 5 km; attività sempre `running`.
- **Richiesta sincrona**, niente richieste in due tempi. L'app smette di
  aspettare dopo 60 s e ha «Cancel»; una partenza, una forma o una
  distanza nuove scartano l'esito di prima.
- **Percorso sulla mappa** con i messaggi `showRoute` e `clearRoute`, punti
  in `[lon, lat]` da `toLngLat`; il segnaposto resta sulla partenza
  chiesta.
- **Risultato**: distanza reale contro distanza chiesta e avvisi del
  motore così come sono; la somiglianza non si mostra come numero.
- **Errori**: un messaggio per caso (`UI.md`, «Quando non va»).
- **Contratto**: `ApiError` e `API_ERROR_CODES` entrano in `shared-types`,
  con `api-error.json` e `api-error-codes.json` controllati da `tsc`, dal
  test di Node e dal test di contratto dell'API.

**Motivo**: il telefono raggiunge già il PC per scaricare l'app, quindi
l'indirizzo non va scritto a mano e non cambia a ogni rete. Le distanze
proposte sono quelle con tempi misurati; i tempi (7–32 s, `API.md`) stanno
sotto i circa 60 s dopo cui iOS chiude una richiesta ferma, e la richiesta
sincrona basta. `PRODUCT.md` vuole che la forma la giudichi l'occhio: un
numero di somiglianza direbbe altro. Il corpo degli errori è contratto come
richiesta e risultato, e si allinea allo stesso modo.

**Conseguenza**: l'indirizzo vale solo in sviluppo; quello di produzione
arriva con l'hosting (fase 4). Una richiesta che supera i 60 s, di solito
perché la zona va scaricata, finisce in «nessuna risposta»: l'API però
finisce il lavoro e salva la zona, e il tentativo dopo trova la cache.
L'utente ha chiesto, per dopo questa fase, campi liberi per ogni distanza e
ogni forma (`ROADMAP.md`, fase 2).

## ADR-0032 — Richieste in due tempi: accettata subito, chiesta finché è pronta
**Stato**: Attiva · 2026-09-23

Sull'iPhone (TASK-023) i 15 km e le zone nuove superavano i circa 60 s che
il telefono aspetta una risposta: l'API finiva il lavoro, ma il telefono
non c'era più. Confermato dall'utente (TASK-025).

**Decisione**:
- **Endpoint**: `POST /route-jobs` risponde subito `202` con un `RouteJob`;
  `GET /route-jobs/{job_id}` ne dà lo stato e, alla fine, il percorso o
  l'errore; `DELETE /route-jobs/{job_id}` annulla. `POST /routes` resta per
  `/docs`, `curl` e le misure.
- **Stati**: `queued`, `downloading_map`, `computing`, `done`, `failed`.
  Nessuna percentuale.
- **Dove girano**: due thread nel processo dell'API; le richieste stanno in
  memoria e si dimenticano 10 minuti dopo la fine. Nessuna dipendenza
  nuova. Una richiesta annullata in coda non parte; una annullata mentre
  carica il grafo si ferma prima di calcolare; una che calcola finisce nel
  suo thread e il risultato si butta.
- **Un lucchetto per zona** invece di uno per tutti i grafi.
- **L'app** chiede lo stato ogni 2 s, fino a 5 minuti; perdona due errori
  di rete di fila; con «Cancel» o allo scadere manda il `DELETE`. Il
  pannello dice lo stato: attesa, download, calcolo.
- **Contratto**: `RouteJob` e `JOB_STATUSES` in `shared-types`, con JSON di
  esempio per una richiesta in corso, finita e fallita, e per gli stati,
  letti da `tsc`, dal test di Node e dai modelli Pydantic.

**Motivo**: la richiesta sincrona dipende da quanto aspetta il telefono, e
né il download di una zona (72–100 s sui dati mobili) né un 15 km (30–65 s)
ci stanno con margine. Chiedere ogni 2 s costa poche richieste piccole e
non ha bisogno di nuove librerie né di tenere aperta una connessione. Due
thread e non uno perché un calcolo già partito non si interrompe: con un
thread solo, annullare un 15 km lascerebbe in coda la richiesta dopo. Il
lucchetto unico faceva aspettare un 5 km in una zona in memoria dietro il
download di un'altra zona.

**Conseguenza**: riavviare l'API perde le richieste in corso, e l'app lo
dice («lost»). Due richieste insieme si dividono il processore: un 15 km
che finisce nel suo thread rallenta quella dopo, anche se non la blocca.
Una zona si scarica e si salva anche quando la richiesta viene annullata:
circa 40 MB per zona, più le risposte di Overpass in `data/cache/http/`.
Con l'hosting (fase 4) le richieste dovranno sopravvivere a un riavvio e a
più processi: servirà una coda vera. Il motore resta lento sui 15 km,
oltre i 30 s di `PRODUCT.md`: è un lavoro a parte.

## ADR-0033 — Il GPX per il telefono lo scrive l'API, con l'export del motore
**Stato**: Attiva · 2026-09-23

TASK-024 porta l'export GPX nell'app. Servivano chi scrive il file, come
il telefono lo salva e lo condivide, e l'attribuzione di OpenStreetMap.
Confermato dall'utente.

**Decisione**:
- **`POST /gpx`** nell'API riceve `{request, result}` (`GpxRequest`) e
  risponde il GPX scritto da `to_gpx` e `route_name` del motore, con il
  nome del file nell'intestazione (`shaperoute-heart-5km-2026-09-23.gpx`).
  Non ricorda niente.
- **Sul telefono** il file va nella cartella temporanea dell'app
  (`expo-file-system`) e si apre il foglio di condivisione di iOS
  (`expo-sharing`, tipo `com.topografix.gpx`). Dipendenze nuove, MIT,
  dentro Expo Go; `expo install` ha aggiunto il plugin di `expo-sharing` in
  `app.json`.
- **Attribuzione OSM** nei metadati di ogni GPX, anche della CLI:
  `<copyright author="OpenStreetMap contributors">` con la licenza ODbL e
  un `<link>` a `https://www.openstreetmap.org/copyright`.
- **Nell'app** il pulsante «Export GPX» sotto il risultato, con «Preparing
  GPX…» mentre aspetta; gli errori usano i messaggi che ci sono già, più
  due per il telefono (niente foglio di condivisione, file non salvato).
- Il GPX **resta nel motore**: niente `services/export/` finché non
  arrivano i formati per orologi.
- `GpxRequest` entra nel contratto, con il suo JSON di esempio controllato
  da `tsc`, dal test di Node e dai modelli Pydantic.

**Motivo**: un solo scrittore di GPX, già provato dalla CLI e dai campioni,
vuol dire che il file del telefono e quello della CLI sono uguali, e un
test lo controlla. Un endpoint che non ricorda niente non dipende dai 10
minuti di vita delle richieste in due tempi (ADR-0032). Mettere il GPX in
ogni `RouteJob` finito appesantirebbe tutte le risposte per un file che non
tutti vogliono; scriverlo nell'app sarebbe un secondo scrittore da tenere
allineato. Il percorso nasce da dati OSM: la licenza ODbL chiede di dirlo
dove il dato viaggia, e un GPX viaggia.

**Conseguenza**: l'export ha bisogno dell'API accesa, come il calcolo. I
campioni scritti prima del TASK-024 non hanno l'attribuzione e restano come
sono (ADR-0014). Il file nella cartella temporanea può sparire: chi lo vuole
tenere lo salva dal foglio di condivisione.

## ADR-0034 — La distanza si scrive in km, fino a 21 km nell'app
**Stato**: Attiva · 2026-09-23

L'utente ha chiesto un campo libero per la distanza al posto dei pulsanti
(`ROADMAP.md`, fase 2). Oltre i 15 km non c'erano misure: TASK-026 ha
misurato 21 e 30 km a Trento. Confermato dall'utente.

**Decisione**:
- **Un campo «km»** con il tastierino numerico al posto dei pulsanti 3, 5,
  10 e 15 km, senza scorciatoie. Accetta interi e un decimale, con la
  virgola o con il punto; al contratto va `distance_m` intero (7,5 km →
  7500). La conversione è una funzione pura, `toDistanceM`. Di partenza 5.
- **Limite dell'app: 21 km**, in una sola costante (`MAX_APP_DISTANCE_KM`).
  Motore e contratto restano a 1–50 km (ADR-0016).
- **Fuori limite**: «Enter a distance between 1 and 21 km.» sotto il campo,
  e «Draw route» spento. Sopra i 15 km, un avviso prima della richiesta:
  «Long routes take longer: up to a few minutes.»
- La **forma** resta a pulsanti: la forma libera è fase 4.
- **Tastiera**: la schermata si accorcia quando si apre (`KeyboardAvoidingView`
  di React Native), e «Draw route» la chiude, perché il tastierino di iOS
  non ha il tasto invio. Nessuna dipendenza nuova.

**Motivo**: l'app offre la distanza più lunga che arriva entro i 5 minuti
di attesa (ADR-0032) anche in una zona nuova. A Trento il calcolo cresce
poco con la distanza (36–47 s a 21 km, 28–42 s a 30 km); cresce il
download della zona: 105 s a 21 km, 279 s a 30 km, che da solo quasi
esaurisce i 5 minuti, e sui dati mobili è più lento. A 30 km il cuore di
Trento non si disegna. Un campo solo, senza pulsanti, è quello che l'utente
ha chiesto; il limite in una costante si alza quando il download sarà più
veloce.

**Conseguenza**: le distanze fra 21 e 50 km le accetta solo la CLI o
`/docs`. Una zona da 21 km pesa circa 55 MB su disco, più la risposta di
Overpass (`API.md`, «Oltre 15 km»). Alzare il limite chiede prima un modo
più veloce di avere i dati delle zone (ADR-0009). Il tastierino segue la
lingua del telefono: per questo si accettano sia la virgola sia il punto.

## ADR-0035 — Forme da un contorno in un file, per ora solo dalla CLI
**Stato**: Attiva · 2026-09-24 · la spiegazione della somiglianza generosa
è corretta da ADR-0037; i tratti ripassati si aggiungono con ADR-0039

Prima di catalogo e AI (fase 3, `ROADMAP.md`) serviva sapere se le strade
reggono forme più complesse di cerchio e cuore. TASK-032 le ha provate da
file. Confermato dall'utente.

**Decisione**:
- **Il contorno è un JSON** con `name`, `source`, `license` e `points`: un
  solo contorno chiuso (l'ultimo punto ripete il primo), senza buchi, pezzi
  separati o incroci; `x` verso destra e `y` verso l'alto, a qualsiasi
  scala. Il motore lo porta in `[-1, 1]²` e lo ricampiona a 64 punti come
  le altre forme; un file sbagliato è rifiutato con il motivo
  (`shapes/outline.py`). Solo la libreria standard.
- **Solo dalla CLI**: `--outline FILE` al posto di `--shape`.
  `RouteRequest`, contratto, API e app non cambiano. Il lavoro di
  `plan_route` passa a `plan_shape`, che accetta qualsiasi forma
  normalizzata con il suo nome; `plan_route` la chiama con la forma
  registrata. La CLI controlla partenza, distanza e attività con gli stessi
  controlli di `RouteRequest` (`check_start`, `check_distance`,
  `check_activity`).
- **Forme di prova** in `services/route-engine/outlines/`: stella e casa
  disegnate per ShapeRoute, la sagoma di un cavallo al galoppo (OpenClipart
  via FreeSVG, CC0; solo il contorno esterno, convertito da uno script
  usa-e-getta fuori dal repository).
- **Nessuna taratura**: 64 punti, angoli sopra 60°, regole sulle andate e
  ritorno restano come sono.

**Motivo**: provare forme nuove senza prometterle all'app; quali entrano
nel contratto lo decide il catalogo (TASK-033). Fonte e licenza nel file
tengono tracciabile ogni disegno che non è nostro. Gli stessi controlli di
`RouteRequest` fanno fallire allo stesso modo una richiesta sbagliata, con
o senza contorno.

**Conseguenza**: il cancello della fase 3 è superato (giudizio
dell'utente, `samples/LOG.md`): la **stella** si riconosce ovunque, il
**cavallo** a Levico e Milano e quasi a Trento. La **casa** no: senza
camino né porta non si legge come casa da nessuna parte; con camino e porta
(v2) quasi a Milano, no a Trento e Levico. Regge un contorno riconoscibile
dalla sagoma grande (punte, zampe, testa); non regge una forma che si
riconosce da dettagli di poche centinaia di metri o da lati dritti, fuori
da una rete fitta come Milano. La **somiglianza calcolata è più generosa
dell'occhio** sulle forme complesse (casa 0,76–1,00 giudicata `no`): la
tolleranza del 2% del perimetro, 200–300 m, copre i dettagli che mancano.
A Trento e Levico le zampe del cavallo diventano andate e ritorno: dal 5 al
17% del percorso su strade già fatte, dove il limite è il 5%, con un
avviso. Le finestre della
casa, chieste dall'utente, stanno dentro il contorno: servono forme di più
pezzi e tratti percorsi due volte, un lavoro a parte da decidere.

## ADR-0036 — Catalogo delle forme: solo quelle giudicate a occhio, scritte in un riquadro
**Stato**: Attiva · 2026-09-24 · deciso dall'agente su delega dell'utente;
il catalogo cresce con luna, gatto e pesce (TASK-039)

TASK-033 porta nell'app le forme nuove di TASK-032. L'utente, prima di
lasciare lavorare l'agente da solo, gli ha chiesto di prendere le decisioni
migliori senza chiedere: questa voce le registra, perché possa rivederle.

**Decisione**:
- **Nel catalogo entra una forma solo se l'utente l'ha giudicata a occhio**
  sulle strade, con `sì` o `quasi` in almeno una zona (`samples/LOG.md`).
  Oggi: `circle`, `heart`, `star`, `horse`. La casa resta fuori, anche con
  camino e porta.
- **Il catalogo è contratto**: `star` e `horse` entrano in
  `SUPPORTED_SHAPES` del motore, nello schema dell'API, in `SHAPES` di
  `shared-types` e in `contract.json`. Supera le forme ammesse di ADR-0016.
- **I contorni sono dati del pacchetto del motore**,
  `route_engine/shapes/outlines/`, dichiarati in `pyproject.toml`: l'API li
  legge all'avvio anche senza i sorgenti accanto. Ci stanno anche i contorni
  solo di prova (la casa), non registrati come forme.
- **Il riquadro della forma** nell'app è un campo di testo, di partenza
  «heart», nella stessa riga dei km. Una tabella di parole (`shapeWords.ts`)
  porta la parola alla forma: inglese e italiano, singolare e plurale, con o
  senza articolo, accenti e maiuscole indifferenti. Una parola che non è il
  nome della forma lo conferma sotto il campo («→ horse»); una sconosciuta
  spegne «Draw route» con «Unknown shape. Try: circle, heart, star or
  horse.». Niente AI.

**Motivo**: la forma la giudica l'occhio (`PRODUCT.md`), e la somiglianza
calcolata è più generosa dell'occhio sulle forme complesse (ADR-0035):
offrire una forma mai guardata vorrebbe dire promettere un disegno che forse
non si riconosce. Una tabella di parole copre i nomi che l'utente scrive
davvero, è deterministica e si prova con test; le frasi libere («stemma
della Ferrari») restano all'AI di TASK-030. Tenere i contorni nel pacchetto
evita un percorso di file che vale solo con l'installazione in sviluppo.

**Conseguenza**: aggiungere una forma al catalogo vuol dire disegnarla,
generare i campioni, farla giudicare all'utente, poi registrarla e
aggiungerne le parole. Nell'app le forme non si vedono più come pulsanti:
chi non sa cosa scrivere lo scopre dal messaggio, o dal suggerimento nel
campo vuoto. L'API risponde `invalid_request` a una forma fuori catalogo,
come prima.

## ADR-0037 — La somiglianza resta com'è; l'orientamento conta per l'occhio
**Stato**: Attiva · 2026-09-24 · deciso dall'agente su delega dell'utente

TASK-035 doveva trovare una somiglianza che andasse d'accordo con l'occhio,
dopo che TASK-032 e TASK-034 avevano mostrato percorsi con 0,83–1,00
giudicati `no`.

**Decisione**:
- **La somiglianza del motore non cambia** (fit al 2% con la penalità
  sugli angoli, ADR-0025).
- **Il metodo resta**: il motore è deterministico, quindi i casi giudicati
  si rigenerano identici e ogni misura nuova si confronta con i giudizi
  dell'utente prima di entrare nel motore.
- **Prossimo passo**: tenere dritte, entro pochi gradi, le forme che hanno
  un alto e un basso; con campioni nuovi da giudicare.

**Motivo**: su 60 casi giudicati (senza la casa, dove conta il disegno)
nessuna delle 16 misure provate separa i `no`: copertura, precisione e fit
all'1% e allo 0,5%, angoli mancati, Hausdorff, Fréchet, zigzag e svolte
del percorso. La media dei `no` sta sempre fra quella dei `sì` e quella
dei `quasi`. Una tolleranza più stretta separa appena meglio i `sì` dai
`quasi` (coppie ordinate come l'occhio 0,83 contro 0,79): troppo poco per
cambiare tutti i percorsi. Invece, senza cerchio e casa, 25 `sì` su 26
sono dritti, e 8 dei 10 casi inclinati di 15° o più sono `no` (TASK-035,
«L'orientamento»).

**Conseguenza**: la spiegazione di ADR-0035, «la tolleranza del 2% copre i
dettagli che mancano», era sbagliata: la somiglianza misura quanto il
percorso segue il contorno piazzato, e lo misura bene; l'occhio giudica
anche orientamento, disegno e grandezza. Un numero alto non promette una
forma riconoscibile: per questo il catalogo resta legato al giudizio a
occhio (ADR-0036). 16 `no` su 24 sono dritti: sulle strade di Trento e
Levico, a 10–15 km, molte forme non passano comunque. Lì servono i tratti
ripassati e la scelta del posto (`ROADMAP.md`).

## ADR-0038 — Le forme restano dritte, tranne il cerchio
**Stato**: Attiva · 2026-09-24 · deciso dall'agente su delega dell'utente;
confermato dal giudizio dell'utente sui campioni

TASK-035 ha mostrato che l'occhio non riconosce una forma inclinata: 25
`sì` su 26 erano dritti, 8 dei 10 casi inclinati di 15° o più erano `no`.
La ricerca invece ruotava la forma su tutto il giro (ADR-0023).

**Decisione**:
- **Inclinazione massima 15°** (`MAX_TILT_DEG`): la ricerca prova −15°, 0°
  e +15°, e la rifinitura resta dentro lo stesso limite.
- **Il cerchio gira libero** (`FREE_ROTATION`): è lo stesso a ogni angolo,
  e la rotazione attorno alla partenza lo sposta dove le strade lo reggono.
- Vale per il catalogo e per i contorni da file della CLI.
- Nessun altro parametro cambia (fasi, partenze, scale).

**Motivo**: rigenerati i 60 casi giudicati (senza cerchio e casa v1), 45
non cambiano e 15 escono dritti; nessuno è rifiutato. Il giudizio
dell'utente sui 15: 7 migliorano e nessuno peggiora. Il cuore di Levico da
15 km passa da `quasi` a `sì`, la luna di Levico da 10 km da `no` a `sì`;
pesce di Trento, freccia di Trento da 15 km, albero di Levico e gatto di
Trento da `no` a `quasi` (`samples/LOG.md`, TASK-036).

**Conseguenza**: con meno rotazioni la ricerca ha meno posizioni e fa meno
conti. In un posto dove la forma ci sta solo inclinata, esce dritta ma
seguita peggio: non è successo nei casi provati, e il rimedio è cercare il
posto (TASK-038), non inclinarla. La luna ora ha un `sì` a Levico e può
entrare nel catalogo (ADR-0036). Le forme ancora a `no` si riconoscono da
un occhio, una finestra, una rientranza: servono i tratti interni ripassati
(TASK-037).

**Aggiornamento 2026-10-05 (TASK-232)**: il limite di 15° è superato da
ADR-0195, scelta dell'utente: le forme si inclinano fino a 45° e l'app
gira la mappa perché si vedano dritte. Il cerchio resta libero.

## ADR-0039 — Tratti ripassati: linee e anelli dentro la forma
**Stato**: Attiva · 2026-09-24 · deciso dall'agente su delega dell'utente;
il giudizio dell'utente sui campioni lo sostiene a Trento e Milano, non a
Levico

Le forme ancora a `no` dopo TASK-036 si riconoscono da un dettaglio
interno, e l'utente ha chiesto di disegnarli come nella Strava art, con
tratti di andata e ritorno. Un contorno era un solo anello, e il motore
potava e segnalava ogni ripasso (ADR-0026).

**Decisione**:
- **Formato**: il JSON del contorno accetta `strokes`, facoltativo. Un
  tratto parte dal contorno o da un tratto precedente; una linea si
  percorre fino in fondo e ritorno, un tratto che finisce su un suo punto
  chiude un anello, percorso una volta. Niente incroci con il contorno, fra
  tratti o su se stessi (`ROUTE_ENGINE.md` §2).
- **Una sola traccia**: il motore inserisce ogni tratto dove parte, e
  ricampiona la linea tenendo tutti i vertici, così andata e ritorno
  coincidono. Senza tratti, il contorno si ricampiona come prima.
- **Potatura e misure**: i lati che la forma disegna due volte (entro 1 m
  da un altro lato percorso in senso contrario) si riconoscono dalla
  geometria, senza altri dati. Verso
  quei punti le strade già percorse non costano di più; la punta di ogni
  linea è un angolo e la potatura la tiene. Entro il 2% del perimetro da un
  tratto nulla conta come ripercorso, né esatto né a vista.
- **Somiglianza**: la stessa misura, sulla forma intera con i tratti.
- **Tolleranze dimezzate per le forme con tratti** (`STROKE_DETAIL` = 0,5):
  raggio delle zone, fascia del corridoio e tolleranza della somiglianza
  passano dal 2% all'1% del perimetro. Le forme senza tratti non cambiano.
- **Forme**: finestre alla casa, fusto e tre coppie di rami all'albero,
  occhi al gatto, occhio al pesce.

**Motivo**: con le tolleranze al 2% del percorso, a 15 km circa 300 m, i
dettagli erano larghi quanto la tolleranza: il percorso passava accanto a
finestre e rami senza disegnarli, e la somiglianza non se ne accorgeva
(albero di Levico 0,99 senza un ramo). All'1% i dettagli entrano nella
ricerca. Giudizio dell'utente sui 12 casi da 15 km (`samples/LOG.md`,
TASK-037): a Trento gatto e pesce `sì` (prima `quasi` e `no`), casa
`quasi` (prima `no`), albero `no` come prima; a Milano tutti `sì` (la casa
prima era `quasi`); a Levico casa e albero `no` (l'albero prima era
`quasi`), gatto e pesce non disponibili (prima `no`). Quattro casi
migliorano, uno peggiora. Le forme del catalogo non hanno tratti e danno
gli stessi percorsi di prima.

**Conseguenza**: i dettagli si disegnano dove le strade sono fitte, e a
Levico no: le strade rade reggono il contorno, non i dettagli a 15 km. Il
rimedio è cercare il posto dove la forma ci sta (TASK-038), o distanze più
lunghe. Gatto e pesce con i tratti hanno ora un `sì` a Trento e a Milano:
possono essere proposti per il catalogo (ADR-0036), in un task a parte.
L'albero con fusto e sei rami è troppo fitto per 15 km. Il 50% di
`STROKE_DETAIL` è un primo valore, da ritarare con altri giudizi.

## ADR-0040 — Trova dove la forma ci sta: una seconda ricerca fino a 2 km
**Stato**: Attiva · 2026-09-24 · proposto dall'agente, approvato
dall'utente; confermato dal suo giudizio sui campioni

Chi fa Strava art sceglie il posto dove la forma ci sta. Il motore invece
cercava solo entro 500 m dalla partenza (ADR-0025): a Levico, a 15 km, gatto
e pesce non erano disponibili e la casa non si riconosceva (ADR-0039).

**Decisione**:
- **Due tempi.** Prima la ricerca di sempre. Solo se non trova un percorso
  buono (distanza ±10%, somiglianza ≥ 0,90), o la forma non è disponibile,
  una seconda ricerca parte da 1, 1,5 e 2 km in 12 direzioni, con altri 20
  tracciamenti (`FAR_RINGS_M`, `FAR_BEARINGS`, `FAR_TRACES`).
- **Il percorso lontano vince solo se è buono**, o se quello vicino non
  c'era. Lo spostamento costa come prima: fra due posti buoni, il più
  vicino.
- **Zona più grande solo nel secondo tempo**: il grafo copre la forma da
  una partenza a 2 km; dove la cache non basta si scarica.
- **Contratto invariato**: il percorso comincia da `points[0]`, e l'avviso
  dice quanto e dove si è spostato. Il rifiuto dice «… nor within 2 km».
- **L'app** mette un segnaposto verde «Start here» sul primo punto del
  percorso quando comincia a più di 50 m dalla partenza chiesta, e inquadra
  tutti e due i segnaposti.

**Motivo**: a Levico 15 km gatto e pesce con gli occhi trovano posto a 1 km
(est e nord-ovest) e l'utente li giudica `sì`: prima non erano disponibili.
Anche il cuore di Trento 15 km e la stella di Levico 10 km, `sì` ma non
buoni per il motore (0,87; −11% dal target), si spostano di 1 km, e restano
`sì` (`samples/LOG.md`, TASK-038). Dove la ricerca vicina è buona (cerchio,
cavallo, albero di Levico) niente cambia; la casa di Levico resta dov'era,
perché lontano il motore trova 0,86, non abbastanza.

**Conseguenza**: una forma che non va vicino costa un secondo tempo:
12–14 s per gatto e pesce a Levico, fino a 52 s per il cuore di Trento da
15 km, che prima consuma tutta la ricerca vicina (`API.md`, «Tempi»). Il
primo secondo tempo in una zona non in cache la scarica: 42 s per quella di
Levico. Il posto si cerca solo quando la somiglianza del motore dice che la
forma non va: dove l'occhio non è d'accordo (l'albero di Levico) non si
sposta.

## ADR-0041 — Quando la forma non ci sta, proporre la distanza che ci sta
**Stato**: Attiva · 2026-09-24 · scelto dall'utente fra quattro proposte
dell'agente (TASK-031)

Quando il motore rifiuta perché il percorso migliore segue la forma ma è
lontano dalla distanza chiesta, la sua lunghezza è già nota: il rifiuto la
porta (`ShapeNotDrawableError.best_distance_m`) e l'API la restituisce
arrotondata al km come `suggested_distance_m`, fra 1 e 50 km. L'app, se è
entro i 21 km che offre, mostra «Try N km», che scrive la distanza e
ridisegna. Se il motivo è la somiglianza, o la distanza è oltre 21 km, l'app
propone le forme del catalogo da toccare. Il campo c'è in ogni errore,
`null` fuori da questo caso.

**Scartate**: provare le altre forme del catalogo nella stessa zona e
proporre quelle che riescono (5–25 s a forma: minuti di attesa); le due
cose insieme; solo testi più chiari.

**Motivo**: nessun calcolo in più, e una via d'uscita da toccare.

**Conseguenza**: la distanza proposta non è garantita: un nuovo disegno
rifà la ricerca, che a quella distanza di solito trova lo stesso percorso,
ma può rifiutare ancora.

## ADR-0042 — Scritte: una linea chiusa percorsa così com'è
**Stato**: Attiva · 2026-09-24 · tratto singolo e parola corta scelti
dall'utente; il formato proposto dall'agente; giudizio dell'utente sui
campioni: `quasi`

La fase 4 comincia dalle scritte (`ROADMAP.md`). L'utente ha scelto il
tratto singolo, come nella Strava art, e di provare subito una parola
corta. Il contorno di ADR-0035 è un anello che non si incrocia, con tratti
appesi (ADR-0039): una parola a tratto singolo non ci entra.

**Decisione**:
- **`path`** al posto di `points` e `strokes`: una sola linea chiusa,
  percorsa così com'è, che può ripassare e toccare se stessa
  (`ROUTE_ENGINE.md` §2). Il resto del motore non cambia: i lati
  ripassati li riconosce già dalla geometria, e con loro dimezza le
  tolleranze (ADR-0039); le forme restano dritte (ADR-0038).
- **«CIAO»** (`shapes/outlines/ciao.json`), disegnato per ShapeRoute:
  maiuscole alte 1 unite da una linea di base; il ritorno alla partenza
  ripassa la base e le gambe della A, per non chiudere la A a triangolo.
  Solo dalla CLI: contratto, API e app non cambiano.

**Motivo**: la cosa più piccola che permette di giudicare una parola a
occhio, senza toccare il motore oltre il formato del file.

**Conseguenza**: a 15 km «CIAO» dà un percorso a Trento (0,93), Levico
(0,91) e Milano (1,00), e l'utente lo giudica `quasi` in tutte e tre
(`samples/LOG.md`, TASK-040). Il giro chiuso costa: il ritorno ripassa
circa un quarto della linea (24%), e le lettere restano alte 750–930 m. Un
percorso aperto, che non torna alla partenza, lascerebbe tutta la
distanza alla parola: è TASK-041, proposto dall'utente.

## ADR-0043 — Percorso aperto: andata e ritorno pianificati, tenuta l'andata
**Stato**: Attiva · 2026-09-24 · proposto dall'utente; il metodo proposto
dall'agente; solo motore e CLI, scelto dall'utente; giudizio dell'utente
sui campioni: peggio del giro chiuso

Durante TASK-040 l'utente ha proposto che una scritta si possa correre
senza tornare alla partenza, a scelta. Il giro chiuso regge tutto il
motore.

**Decisione**:
- **Un `path` aperto è a sola andata** (`Outline.one_way`): il motore lo
  legge come andata e ritorno sulla stessa linea, una linea chiusa.
- **Si pianifica al doppio della distanza**, entrando nella forma solo alla
  fase 0, cioè all'inizio della parola (`search(phases=...)`,
  `planned_distance`). Gli scarti in percentuale e la somiglianza sono gli
  stessi per il tutto e per la metà; i messaggi parlano della distanza
  chiesta.
- **Si tiene l'andata** (`network.first_leg`): fino al nodo più vicino al
  fondo della parola, che è a metà della linea di andata e ritorno, più un
  decimo della distanza da metà percorso (`HALF_WAY_WEIGHT`). Il ritorno
  può fare strade diverse dall'andata, e metà percorso è solo indicativa;
  ma un passaggio precedente vicino al fondo (l'ingresso nella O di
  «CIAO») è chilometri prima di metà. Con peso 1 il taglio cadeva a 124 m
  dal fondo in un percorso che ci passava a 30 m; con 0,1 a 36 m.
- **Solo dalla CLI**, con l'apertura nel file (`ciao_open.json`):
  contratto, API e app non cambiano.

**Motivo**: il motore dei giri chiusi resta quello di prima, senza un
secondo modo di cercare.

**Conseguenza**: «CIAO» aperto a 15 km dà un percorso a Trento (0,96),
Levico (0,91) e Milano (1,00, ma 13,6 km e 263 s: la ricerca lontana
lavora su una zona grande il doppio). L'utente lo giudica peggio del giro
chiuso di TASK-040 (`samples/LOG.md`, TASK-041). Per una forma a sola
andata tutti i lati sono «disegnati due volte», e la misura delle strade
ripercorse non vede niente. Il percorso aperto resta disponibile dalla CLI;
nell'app arriva, se serve, con le parole.

## ADR-0044 — Parole lettera per lettera: alfabeto a tratto singolo, lettere che si spostano
**Stato**: Attiva · 2026-09-24 · chiesto dall'utente dopo TASK-041; il metodo
deciso dall'agente su delega dell'utente; giudizio dell'utente sui
campioni: `sì` nelle tre zone, molto meglio di TASK-040

Dopo TASK-041 l'utente ha chiesto lettere più distanziate, una I corsa
andata e ritorno sulla stessa strada, e di «intensificare i punti di
passaggio e creare le lettere separatamente e poi connetterle». La «CIAO»
di TASK-040 aveva 67 vertici, sopra i 64 punti del motore: lungo la I
nessun punto di passaggio.

**Decisione**:
- **Alfabeto** (`route_engine/letters.json`, per ora C, I, A, O): ogni
  lettera è alta 1 sulla sua base, con un'andata dall'ingresso all'uscita,
  tutti e due sulla base, e, se diversi, un ritorno che non passa dalla
  base: la A torna per le gambe. `words.py` compone la parola: lettere a
  0,6 dell'altezza l'una dall'altra (erano 0,3), unite sulla base, e il
  ritorno ripassa base e ritorni. Ogni lato è di al più 1/16 dell'altezza:
  296 punti per «CIAO». Dalla CLI, `--word` (`ROUTE_ENGINE.md` §2).
- **La ricerca entra nella parola solo a metà di uno spazio**, e lì la
  partenza resta ferma quando le lettere si spostano.
- **Le lettere si spostano** fino a 1/4 dell'altezza, su una griglia di
  1/16, dove i loro tratti hanno più strade entro 1/16 dell'altezza;
  lo spostamento massimo costa il 5% del conteggio. Conta la lettera sola:
  la quota sulla parola intera premiava gli spostamenti che accorciano gli
  spazi. Lo stesso conteggio, lettera per lettera, ordina i piazzamenti da
  tracciare (§5).
- **Somiglianza delle parole**: la copertura di ogni lettera entro 1/8
  dell'altezza, in media sulle lettere, in media armonica con la
  precisione sulla parola intera; niente penalità per gli angoli, che in
  una parola sono decine. Quella delle altre forme (1% del perimetro, circa
  150 m a 15 km) dava 0,92 a una «CIAO» di Trento senza metà della C e
  senza la I.
- **Ripasso sulla stessa strada**: dove la parola torna su se stessa (la I,
  la C, la base) le strade appena percorse pesano la metà
  (`snap_to_network(retrace=0.5)`); prima pesavano come le altre, e la I
  tornava su una parallela. Le altre forme non cambiano.
- Provati e scartati: zone e corridoio del tracciamento larghi 1/8
  dell'altezza invece dell'1% del perimetro. A Milano la I veniva più
  dritta, ma a Trento il percorso perdeva la O e a Levico peggiorava.

**Motivo**: ogni richiesta dell'utente diventa una regola che si prova da
sola, senza cambiare il motore per le forme del catalogo; e la ricerca
guarda le lettere, che sono ciò che l'occhio legge.

**Conseguenza**: a 15 km la somiglianza delle lettere è 0,82 a Trento, 0,86
a Levico e 0,97 a Milano (con la misura delle altre forme 0,90, 0,93 e
0,99); lettere alte 690–810 m (TASK-040: 750–930 m), perché gli spazi più
larghi tolgono distanza alle lettere. I tempi crescono a 40–140 s
(TASK-040: 8–54 s): 296 punti invece di 64, e con la misura più severa la
ricerca si ferma di rado prima del budget e prova anche lontano. Le
lettere si spostano poco: solo la O, di 43–97 m. Per l'utente «CIAO» è
`sì` a Trento, Levico e Milano, molto meglio di TASK-040
(`samples/LOG.md`).

## ADR-0045 — Indicazioni di svolta: dagli incroci del grafo, non dalle curve
**Stato**: Attiva · 2026-09-24 · deciso dall'agente su delega dell'utente
(TASK-047)

Per guidare chi corre servono le svolte. Un incrocio e il nome di una via
sono proprietà del grafo, che ha solo il motore: la funzione sta in
`route_engine/directions.py` e parte da `(grafo, nodi del percorso)`.

**Decisione**:
- **Un incrocio è un nodo con almeno 3 strade** (`MIN_BRANCHES`). Le strade
  si contano come coppie distinte (vicino, lunghezza), in entrata e in
  uscita, non con `graph.degree`: nel grafo a piedi ogni strada è un arco
  per verso, e un nodo in mezzo a una strada ha grado 4. Il grafo di
  `network.py` è semplificato (`graph_from_bbox` di OSMnx, `simplify` di
  default), ma restano nodi con due strade: 27 su 303 nella fixture di
  Levico, 22 di grado 4 (bordi tagliati, vie unite).
- **Si parla solo agli incroci**, mai sul primo e sull'ultimo nodo, e
  quando: la svolta supera 30° (`TURN_MIN_DEG`); oppure si va dritti ma si
  cambia strada (nomi diversi, o fra una via con nome e una senza); oppure
  si va dritti ma un'altra strada va dritta quanto o più di quella presa
  (un bivio): allora il verso è `left`/`right` rispetto a quella.
- **Il verso** viene dalla direzione delle due strade a 20 m dal nodo
  (`HEADING_PROBE_M`), in metri sul piano locale: `straight` fino a 30°,
  `sharp-*` da 135° (a metà fra angolo retto e tornare indietro),
  `u-turn` da 165°.
- **Il nome**: `name`, se manca `ref` (come «SP12»), se manca niente; il
  tipo di strada (`highway`) a parte, per chi mostra le vie senza nome. Un
  arco semplificato con più nomi continua la strada con cui ne condivide
  uno; altrimenti porta tutti i nomi, uniti da « / ». Mai un nome inventato.
- **Distanze** dalla partenza come somma delle `length` degli archi più
  corti, gli stessi che disegna `snap_to_network`.
- **Solo il modulo e i test**: `RouteResult`, API e app non cambiano
  (TASK-048).

**Motivo**: su cuori veri da 15 km (Trento, Levico, Milano, script usa-e-getta)
nessuna indicazione cade su un nodo che OSM stesso (`street_count`) non
conta come incrocio, e ogni cambio di strada a un incrocio ne ha una. Senza
la regola del bivio, a Trento 9 incroci si passavano in silenzio con
un'altra strada più dritta di quella presa (per esempio Via dei Masetti che
piega di 22° mentre una laterale va dritta): chi corre avrebbe sbagliato.
Il numero di indicazioni cambia poco con la sonda (10–40 m: ±5%) e più con
la soglia del dritto (Milano: 296 a 20°, 264 a 30°, 229 a 40°); 30° lascia
in silenzio le vie che piegano un poco all'incrocio senza nascondere le
svolte vere.

**Conseguenza**: 180 indicazioni a Trento, 75 a Levico, 264 a Milano, in
circa 0,1 s. Dove il grafo è fatto di marciapiedi senza nome (Milano: 213
indicazioni su 264 entrano in un `footway`) molte arrivano a coppie a pochi
metri (110 entro 15 m dalla precedente): attraversare una strada è «sinistra,
poi destra». Sono incroci veri, quindi restano; raggrupparle è compito di chi
le presenta (TASK-049). Il nome della via lungo cui corre un marciapiede non
è nel dato, e non si indovina.

## ADR-0046 — Tema Sgrava: i token in un file, lo stile della mappa nostro
**Stato**: Attiva · 2026-09-24 · tavolozza, regole e file consegnati
dall'utente (TASK-045); verifiche e registrazione dell'agente su delega
dell'utente

L'app è grigia e chiara, sopra la mappa «liberty» di OpenFreeMap, e ogni
schermata scrive a mano i suoi colori: un percorso giallo, lì sopra, quasi
non si vede.

**Decisione**:
- **Un file di token** (`apps/mobile/src/theme/tokens.ts`): colori,
  spaziature, raggi, corpi del testo, la linea del percorso e
  `MIN_TAP_SIZE` (44). Nessun colore scritto a mano fuori da lì. Un tema
  solo, scuro.
- **Il giallo `#FFD02B` è il percorso** e il comando che lo produce,
  nient'altro; gli avvisi sono `warning` (`#FF7A59`), gli errori `error`. Sul
  giallo il testo è scuro (`onAccent`). «Start here» (ADR-0040) è ciano,
  `#4DD2FF`.
- **Lo stile della mappa lo scrive l'app** (`src/map/mapStyle.ts`,
  `sgravaDarkStyle`): la stessa sorgente vettoriale OpenMapTiles di
  OpenFreeMap (`tiles.openfreemap.org/planet`, senza chiave), gli stessi
  glifi, i colori dai token. L'attribuzione nella sorgente è quella della
  TileJSON, per intero: OpenFreeMap, OpenMapTiles, OpenStreetMap. In
  MapLibre l'attribuzione di una sorgente sostituisce quella della TileJSON:
  il file consegnato diceva solo «© OpenStreetMap» e avrebbe tolto le altre
  due, che le licenze chiedono (corretto dall'agente su delega
  dell'utente).
- **I test controllano quello che fallisce in silenzio**: ogni strato ha
  sorgente e `source-layer`, gli id sono unici, le strade grandi stanno
  sopra le piccole, i colori vengono solo dai token e nessuno è il giallo.

**Motivo**: un colore si decide una volta, e mappa e pannello non si
separano più; lo stile non cambia sotto di noi quando OpenFreeMap aggiorna
il suo.

**Verificato il 2026-09-24**: la TileJSON risponde e ha tutti gli strati
usati, con `name:it` sui luoghi; il font «Noto Sans Regular», lo stesso di
liberty, risponde. Contrasti: testo scuro sul giallo 13,5:1, bianco 1,5:1;
`textMuted` 7,2:1 e `textFaint` 5,8:1 sul fondo; sulla mappa il percorso
13,2:1, «Start here» 11,0:1, i nomi dei luoghi 5,6:1.

**Conseguenza**: la mappa ha meno strati di liberty: niente nomi delle vie,
numeri civici, punti d'interesse, confini. Se le etichette si vedano
davvero lo dice solo il telefono. Le schermate usano i token da TASK-046;
fino ad allora l'app non cambia.

## ADR-0047 — Indicazioni nell'API: lista piatta, partenza prima, vicine segnate
**Stato**: Attiva · 2026-09-24 · deciso dall'agente su delega dell'utente
(TASK-048)

Le indicazioni di ADR-0045 stavano solo nel motore. Per mostrarle o dirle
servono all'app, con due cose emerse in TASK-047: la via da cui si parte, e
le coppie a pochi metri quando si attraversa una strada.

**Decisione**:
- **`RouteResult.directions`** nel motore, nell'API e in `shared-types`,
  campo per campo come il resto del contratto (ADR-0028), vuoto di
  default: `optimizer.py` non cambia, e `/routes` sincrono lo lascia vuoto.
- **Le calcola `jobs.py`** alla fine di una richiesta in due tempi, sui nodi
  di `Plan.search.best.route` e sul grafo che il loader ha dato al motore
  (l'ultimo se il percorso viene dalla ricerca lontana, ADR-0040).
- **La prima è la partenza**: `turn` `depart`, distanza 0, la via del primo
  arco (`directions.guidance`).
- **Le vicine si segnano, non si fondono**: `joined` è vero quando
  un'indicazione arriva meno di `GROUP_M` = 15 m dopo la precedente. La
  lista resta piatta e nessuna indicazione si perde; chi le presenta le
  legge insieme.

**Motivo**: una lista piatta è lo stesso tipo in Python, in pydantic e in
TypeScript, e i test del contratto la controllano già; un'indicazione che
ne contiene altre avrebbe voluto un tipo ricorsivo su tre lati. Sui cuori
da 15 km, con 15 m i momenti da annunciare scendono da 181 a 138 a
Trento, da 76 a 73 a Levico e da 265 a 155 a Milano; la catena più lunga
è di 5. Con 10 m restano coppie da attraversamento separate (Milano 190);
con 25 m a Milano le catene arrivano a 7, troppe per dirle insieme.

**Conseguenza**: il contratto cresce di un campo che l'app di oggi
ignora. La schermata e la voce sono TASK-049; i nomi dei marciapiedi,
TASK-053.

## ADR-0048 — Avvisi del motore in parole semplici, riconosciuti dall'app
**Stato**: Attiva · 2026-09-24 · chiesto dall'utente («migliorare le note
che vengono fuori»); il metodo deciso dall'agente su delega dell'utente
(TASK-054)

Gli avvisi arrivano all'app come frasi per sviluppatori («shape similarity
0.86 is below 0.90 after 18 attempts»), e l'app li mostrava così com'erano.
Il contratto non ha codici per gli avvisi, e oggi è di TASK-048
(`packages/shared-types`).

**Decisione**: l'app riconosce i testi che il motore scrive oggi, con una
regola per ciascuno (`apps/mobile/src/route/warnings.ts`), e li riscrive
brevi, con un tono: **attenzione** (scale, strade principali, gallerie,
forma poco fedele, pochi tratti di strada, pezzi di forma saltati) o
**da sapere** (partenza spostata, distanza diversa, strade ripercorse,
partenza lontana dalla strada). Prima quelli di attenzione, la stessa frase
una volta sola. Un testo sconosciuto passa com'è: un avviso nuovo non si
perde mai.

**Scartata**: codici negli avvisi del contratto, la strada pulita, ma
tocca motore, API e `shared-types` insieme, oggi di un altro task.

**Motivo**: la richiesta dell'utente subito, senza toccare file di altri.

**Conseguenza**: i testi del motore diventano un contratto nascosto. I test
di `warnings.test.ts` li copiano parola per parola: chi cambia una frase del
motore deve cambiarla anche lì, o l'app torna a mostrarla grezza. Quando il
contratto avrà i codici, questo file si toglie.

## ADR-0049 — Il modello dell'AI si carica all'avvio dell'API, in background
**Stato**: Attiva · 2026-09-24 · deciso dall'agente su delega dell'utente
(TASK-052)

La prima parola letta dall'AI paga il caricamento del modello dal disco:
40–49 s su questo PC, a ridosso dei 60 s dopo i quali iOS chiude una
richiesta (`AI.md`).

**Decisione**:
- **All'avvio l'API chiede a Ollama di caricare il modello**
  (`OllamaModel.preload`: `/api/generate` senza prompt), in un thread in
  background, con una riga di log. L'API risponde subito.
- **Non fallisce mai**: Ollama spento, modello mancante o memoria che non
  basta finiscono nel log («AI model not preloaded»); la prima parola si
  comporta come prima (`ShapeReader.warm_up`).
- **Stessa durata di prima** (`KEEP_ALIVE`, 15 minuti dall'ultima
  richiesta), non per sempre (`keep_alive: -1`).

**Motivo**: di solito l'API si accende per provare l'app subito dopo, e la
prima parola arriva entro 15 minuti. Tenere il modello caricato per sempre
occuperebbe 3,2 GB su 6,9 finché l'API è accesa, anche nelle ore in cui
nessuno scrive. Se servisse, basta cambiare `KEEP_ALIVE` per le richieste
dell'API.

**Conseguenza**: nei 15 minuti dopo l'avvio la RAM del modello è occupata
anche se nessuno scrive una parola. Con il PC carico (1,9 GB liberi, il
2026-09-24) Ollama non riesce a caricarlo entro 90 s: l'API parte lo
stesso e la prima parola resta lenta. Il tempo della prima parola dopo il
precaricamento è da misurare con il PC scarico.

## ADR-0050 — Barra di caricamento: una stima per fasi, mai oltre la fase
**Stato**: Attiva · 2026-09-24 · la barra chiesta dall'utente; la stima
decisa dall'agente su delega dell'utente (TASK-055)

L'API dice solo la fase della richiesta (in coda, download della zona,
calcolo, ADR-0032), non a che punto è. Una barra che si riempie a tempo
fisso mentirebbe: un 21 km in una zona nuova dura minuti, un 5 km in cache
pochi secondi.

**Decisione**: ogni fase ha un tratto della barra (in coda 0–8%, download
8–45%, calcolo 45–95%). Dentro la fase la barra avanza come
`1 − e^(−2t/T)`, con `T` il tempo che la fase di solito prende (in coda
4 s, download 90 s, calcolo 2,5 s a km e non meno di 10 s, dalle misure di
`API.md`): al tempo atteso è all'86% del tratto, poi rallenta senza mai
superarlo. Non torna indietro, e il 100% lo dà solo il percorso arrivato.
Gialla, come il percorso che prende forma (ADR-0046). Nessuna libreria.

**Scartate**: una barra indeterminata che va e viene (non dice niente in
più della rotellina); una percentuale vera dal motore (tocca motore, API e
contratto).

**Conseguenza**: la barra dice la verità sulle fasi e più o meno sul tempo:
un calcolo più lento del solito resta fermo poco sotto il 95%. Se le misure
dei tempi cambiano, vanno cambiate le costanti di `progress.ts`.

## ADR-0051 — La parola nell'API: `word` accanto a `shape`, una delle due
**Stato**: Attiva · 2026-09-24 · chiesto dall'utente (tramite il
coordinatore); il contratto e i limiti decisi dall'agente su delega
dell'utente

L'utente vuole scrivere nell'app la parola da disegnare. Il motore la sa
scrivere dalla CLI (ADR-0044); il contratto con l'app conosceva solo le
forme del catalogo, e l'app controlla che il risultato ne nomini una.

**Decisione**:
- **Contratto**: `RouteRequest` ha `shape` oppure `word`, l'altro assente
  o `null`; `RouteResult` ha `shape: null` e `word` (in maiuscole) per una
  parola, `word: null` per una forma. Sono aggiunte: l'app di oggi manda e
  riceve una forma come prima, e compila senza modifiche. Il nome del file
  e della traccia GPX usa la parola.
- **Controlli nel motore** (`models.check_word`), come gli altri valori:
  solo lettere dell'alfabeto, oggi A, C, I, O; al più 8 lettere; almeno
  3 km di percorso per lettera. Ogni caso è un `invalid_request` con un
  messaggio in inglese che l'app può mostrare così com'è: quali lettere
  mancano e quali ci sono, o la distanza minima.
- **Costanti in `shared-types`** (`LETTERS`, `MAX_WORD_LETTERS`,
  `LETTER_DISTANCE_M`), allineate al motore da `contract.json`: l'app può
  controllare prima di chiedere (TASK-057).

**Motivo**: 3 km per lettera perché «CIAO» è stato giudicato `sì` a 15 km,
3,75 km per lettera, con lettere alte 700–800 m, e con meno le lettere
scendono sotto quello che gli isolati di una città sanno disegnare. 8
lettere perché ognuna aggiunge circa 75 punti di passaggio a una ricerca
che per quattro dura già 40–140 s.

**Conseguenza**: nell'app, che arriva a 21 km, una parola ha al più 7
lettere. Con l'alfabeto di oggi le parole possibili sono poche: allargarlo
è una scelta chiesta all'utente. Il campo nell'app è TASK-057.

## ADR-0052 — Navigazione nell'app: il percorso già disegnato, seguito col GPS
**Stato**: Attiva · 2026-09-25 · chiesta dall'utente («come Google Maps»);
`expo-speech` approvata dall'utente il 2026-09-24; il resto deciso
dall'agente su delega dell'utente (TASK-049)

**Decisione**:
- **Si segue il percorso che c'è**, con le indicazioni di ADR-0047: niente
  ricalcolo. Oltre 40 m dalla linea (`OFF_ROUTE_M`) si dice «Off the route»
  una volta.
- **La posizione si cerca vicino a dov'era** (da 50 m indietro a 300 m
  avanti) e tornare indietro lungo il percorso costa quanto starne fuori:
  una forma passa due volte per la stessa strada (i tratti ripassati,
  ADR-0039), e il punto più vicino di tutto il percorso può essere quello
  sbagliato.
- **Una svolta si annuncia a 50 m** (`ANNOUNCE_M`, circa 15 s di corsa),
  una volta, insieme a quelle `joined`; si considera passata 10 m dopo
  l'incrocio (`PASS_M`), l'arrivo a 25 m dalla fine.
- **Voce e vibrazione**: `expo-speech` in inglese (`en-US`), come
  l'interfaccia; `Vibration` di React Native, 400 ms, per ogni svolta.
- **La mappa segue** con un messaggio nuovo, `follow`: sposta il
  segnaposto e centra a zoom 17 senza rifare l'inquadratura del percorso.

**Motivo**: la prima versione deve dire la verità su un percorso che già
esiste; ricalcolarlo vorrebbe il motore dal telefono a ogni errore, con i
tempi del motore (30–50 s sopra i 10 km).

**Conseguenza**: una dipendenza in più nell'app. Le soglie sono stime,
non misure: vanno provate correndo (TASK-049, «Esito»).

## ADR-0053 — La parola nell'app: un interruttore «Shape | Word», controllata prima di mandarla
**Stato**: Attiva · 2026-09-25 · il campo chiesto dall'utente il 2026-09-24;
la forma decisa dall'agente su delega dell'utente (TASK-057)

L'API accetta `word` al posto di `shape` (ADR-0051). Nell'app il campo
della forma manda già le parole che la tabella non conosce all'AI: un campo
solo per tutte e due renderebbe ambiguo «ciao» (una parola da scrivere, o
una forma da leggere?).

**Decisione**: sopra le tessere un interruttore «Shape | Word», lo stesso
componente della partenza (`Segmented`). Con «Word» un campo in maiuscole
prende il posto di tessere e campo della forma; la richiesta porta `word`
e non `shape`. L'app controlla la parola prima (`wordInput.ts`, con
`LETTERS`, `MAX_WORD_LETTERS`, `LETTER_DISTANCE_M` di `shared-types`) e
dice in inglese cosa non va, con «Draw route» spento. Il limite dell'app è
7 lettere: l'ottava vorrebbe 24 km, oltre i 21 dell'app (ADR-0034). Con una
distanza troppo corta un tasto «Use N km» scrive la minima. Il nome del
percorso, nell'attesa e nel risultato, è la parola fra virgolette, o la
forma.

**Scartate**: un campo unico che indovina (ambiguo con l'AI); togliere gli
accenti da sé («città» → «CITTA», l'utente non vede cosa è stato disegnato);
bloccare il campo a 7 caratteri (l'ottavo sparirebbe senza spiegazione).

**Conseguenza**: la barra usa ancora la stima delle forme, e per una parola
(40–258 s) pulsa prima (ADR-0055): «più lento del solito», non «rotto».
Se si vorrà una stima per le parole, è `progress.ts`.

## ADR-0054 — Marciapiedi senza nome: la via lungo cui corrono, dedotta a parte
**Stato**: Attiva · 2026-09-25 · file a parte per i nomi scelto
dall'utente; il resto deciso dall'agente su delega dell'utente (TASK-053)

A Milano quasi tutte le indicazioni entrano in un `footway` senza nome
(TASK-047): il marciapiede disegnato a parte, accanto alla sua via. La via
col nome spesso non è nel grafo: `FOOT_FILTER` esclude quelle con
`sidewalk=separate`, proprio quelle.

**Decisione**:
- **I nomi delle vie escluse** arrivano da una seconda richiesta a
  Overpass per zona, salvata in un file JSON accanto al grafo
  (`network.named_roads`, `MAPS.md`, «Cache»). Il grafo su cui si corre non
  cambia. **Scartato**: le stesse vie nel grafo marcate non percorribili
  (riscaricare ogni zona, circa 100 MB a Milano, e il rischio che la
  ricerca le usi).
- **La via di un marciapiede** (`sidewalks.py`): contano le vie escluse e
  le vie con nome del grafo. Il marciapiede si campiona ogni 5 m; a ogni
  campione la via con nome più vicina entro **15 m** e parallela entro
  **20°**. Vince la via che accompagna almeno **metà** dei campioni.
  Un attraversamento, perpendicolare, non prende nessuna via.
- **È una deduzione, tenuta a parte**: `alongs(...)` dà una lista
  affiancata alle indicazioni, mai dentro `street`. Non è un campo di
  `Direction`: il contratto (`schemas.py`, `shared-types`) era di un altro
  task, e un test lo vuole identico al motore. Portarla nell'API e
  nell'app è di TASK-049 o seguenti.

**Motivo**: pochi MB per zona e nessun cambio al percorso; le soglie sono
quelle della proposta, e sui cuori reggono (campione sotto).

**Conseguenza**: sui cuori da 15 km le indicazioni senza nome passano da
231 a 81 a Milano, da 118 a 57 a Trento, da 34 a 30 a Levico (sentieri di
campagna, senza vie accanto). Un campione di quattro deduzioni a Milano,
controllato su openstreetmap.org, era giusto in tutti e quattro. Restano
senza via i marciapiedi di piazze e parchi, e quelli più lontani di 15 m
dal centro della strada (i viali larghi).

## ADR-0055 — La barra in ogni attesa, e pulsa quando l'attesa si allunga
**Stato**: Attiva · 2026-09-25 · i tre punti chiesti dall'utente; la forma
decisa dall'agente su delega dell'utente (TASK-058)

La barra di ADR-0050 c'era solo nel disegno del percorso. L'utente la
vuole anche mentre la mappa si carica e mentre si aspetta l'API: la lettura
dell'AI e un'API che non risponde. In quel caso la barra restava ferma
vicino all'8% fino al timeout di iOS (60 s): sembrava bloccata.

**Decisione**: una sola barra (`EstimateBar`), con la regola di ADR-0050
(stima `1 − e^(−2t/T)`, mai indietro, mai piena da sola), usata tre volte:
percorso, lettura dell'AI (`T` = 20 s, fra i 4–10 s a modello caricato e i
39–49 s da caricare, `AI.md`), mappa con le tessere (`T` = 5 s, 0–95%).
Oltre `2T` nella stessa fase la barra **pulsa** e dice «Still waiting» allo
screen reader; la fase dopo la ferma. Niente librerie: `Animated` di React
Native.

**Scartate**: accorciare il timeout della prima chiamata (cambia quando
l'app dice «API non raggiungibile», fuori da questo task); far avanzare la
barra oltre il tratto della fase (poi resterebbe ferma alla fase dopo).

**Conseguenza**: una pulsazione vuol dire «più lento del solito», non
«rotto». Per la mappa la pagina deve dire all'app quando carica e quando ha
finito: il primo `idle` di MapLibre diventa il messaggio `loaded`. La barra
della mappa compare solo al primo caricamento, al centro della mappa
(dentro `MapView`): a ogni spostamento, in navigazione, ci sarebbe sempre.

## ADR-0056 — Alfabeto dalla A alla Z: 26 maiuscole a tratto singolo, E ed L staccate dalla base
**Stato**: Attiva · 2026-09-25 · chiesto dall'utente («sì fai tutte le
lettere dell'alfabeto»); il disegno delle lettere deciso dall'agente su
delega dell'utente (TASK-059); giudizio dell'utente: lettere nuove
approvate, E ed L staccate dalla base sì; sui campioni «MAX» `sì` nelle tre
zone, «BELLO» e «KIWI» `sì` a Milano, `quasi` a Levico, `no` a Trento

Il motore scriveva solo con C, I, A, O (ADR-0044), e l'API rifiutava ogni
altra lettera (ADR-0051): poche parole possibili.

**Decisione**:
- **22 lettere nuove** in `letters.json`, nello stesso formato; A, C, I, O
  restano identiche. Alte 1, larghe 0,5–0,65 come la A (M e W 0,8), curve
  con un punto ogni 20° come la C e la O; M con la V a 0,3 dell'altezza e
  W con la punta a 0,7, così non toccano la base; la coda della Q scende
  dall'interno della O fino alla base, e la Q esce da lì.
- **Ingresso e uscita**: ogni lettera entra dal suo punto più a sinistra
  sulla base ed esce da quello più a destra. La linea che unisce le lettere
  non passa mai sopra una lettera, e non si allunga sotto di lei.
- **La base**: la disegnano solo B, D e Z, che ce l'hanno; H, K, M, N, R,
  W, X tornano per i loro tratti, come la A, perché chiuse sotto
  diventerebbero altre figure.
- **E ed L**: il tratto in basso sta a 0,2 dell'altezza (i bracci della E
  a 1, 0,6 e 0,2). Sulla base la linea di unione se lo mangia, e a metà
  parola la E si legge F e la L si legge I. Provato e scartato: un dentino
  verso l'alto alla fine del braccio, che da lontano sembra un punto dopo
  una F o una I.
- Il messaggio per una lettera che manca dice «a word can use only the
  letters A to Z» invece di elencarle (`words.spell_letters`), anche nella
  descrizione di `word` dell'API. `LETTERS` di `shared-types` e
  `contract.json` hanno le 26 lettere.

**Motivo**: lettere dello stesso stile di «CIAO», giudicata `sì`, e le
regole di ADR-0044 estese a tutte: la A aperta sotto vale per ogni lettera
coi piedi separati. Le due scelte sulla base nascono dal guardare le parole
composte (anteprima di TASK-059), non le lettere da sole.

**Conseguenza**:
- Una lettera senza anelli si corre tutta due volte: tratto di 7,2 altezze
  per la M, 7 la W, 6,3 la N, contro 2,5–3,8 per O, A, C. Con gli spazi,
  «CIAO» è lunga 4,1 altezze a lettera, «BELLO» 5,3, «MAMMA» 6,6: a pari
  distanza le lettere vengono più piccole. A 15 km le lettere di «BELLO»,
  «KIWI» e «MAX» sono alte 493–727 m (CIAO: 690–810 m), con somiglianza
  delle lettere 0,74–0,95 (CIAO: 0,82–0,97; `samples/LOG.md`). I 3 km a
  lettera di ADR-0051 sono misurati su «CIAO»: una distanza minima che
  guardi la lunghezza del tratto invece del numero di lettere tocca
  `models.py` e il contratto, ed è fuori da TASK-059.
- Più punti di passaggio (461 per «BELLO», 297 per «CIAO») e ricerche più
  lunghe: 15–258 s a 15 km, «BELLO» 255 s a Trento e 258 s a Milano (CIAO:
  40–140 s). L'app aspetta al più 5 minuti (`MAX_WAIT_MS`): una parola di
  7 lettere con M o W a 21 km può non bastare.
- La base comincia dopo la prima lettera e finisce prima dell'ultima,
  così una I o una F in prima posizione, con la linea solo a destra, si
  leggono L ed E («IO» sembra «LO»). Proposto un tratto di base anche prima
  della prima lettera e dopo l'ultima: l'utente non lo vuole (2026-09-25),
  resta così.
- Giudizio dell'utente (2026-09-25): le lettere nuove si leggono dove le
  strade le aiutano, «MAX» ovunque, «BELLO» e «KIWI» a Milano; a Trento no.
  Per il seguito l'utente chiede che le lettere si possano unire anche
  dalla cima, se non confonde o se aiuta, e che possano avere scale
  diverse, purché non troppo da quelle vicine: TASK-067 (ADR-0063).

## ADR-0057 — `along` nell'API e nei tipi condivisi
**Stato**: Attiva · 2026-09-25 · deciso dall'agente su delega dell'utente
(TASK-060)

La via lungo cui corre un marciapiede senza nome (ADR-0054) c'era solo nel
motore, in una lista a parte; la navigazione (TASK-061) la vuole nella
risposta dell'API.

**Decisione**:
- **Un campo `along` per indicazione**, accanto a `street` e distinto da
  lui: stringa o `null`, e non `null` solo quando `street` è `null`. È un
  campo di `Direction` nel motore (`directions.py`, predefinito `None`),
  così il test che vuole il contratto uguale al motore resta com'è;
  `guidance` lo lascia `None`, lo riempie l'API (`alongs.py`). Il principio
  di ADR-0054 resta: una deduzione non entra mai in `street`.
- **Retrocompatibile**: in `shared-types` è `along?: string | null`
  (un'API precedente non lo manda), nell'API ha `null` come predefinito
  (un `GpxRequest` di un'app precedente non lo ha). La guardia dell'app
  ignora i campi che non conosce.
- **I nomi solo dalla cache**: l'API legge il file dei nomi della zona
  (`OsmnxSource.named_roads(..., download=False)`), non chiede mai a
  Overpass durante una richiesta. Senza il file, o se non si legge,
  contano le sole vie con nome del grafo: `along` non fa mai fallire un
  percorso.
- **Solo attorno al percorso**: vie del grafo e nomi si prendono nel
  riquadro del percorso allargato di 60 m (4 volte la soglia di 15 m).

**Motivo**: un campo opzionale per indicazione è la forma più semplice da
leggere per l'app, e non cambia niente per chi non lo usa.

**Conseguenza**: sul cuore da 15 km di Trento, dall'API, 118 indicazioni
senza nome, 74 senza via con le sole vie del grafo, 57 col file dei nomi
(come TASK-053); circa 0,3 s in più. Oggi il file dei nomi c'è solo per
le zone di TASK-053 (Trento, Levico, Milano): nessuno lo scarica da solo,
e una zona nuova ha le sole vie del grafo finché non si chiama
`OsmnxSource.named_roads`. Scaricarlo insieme alla zona è un seguito
possibile, non fatto qui.

## ADR-0058 — `along` nella navigazione: «beside», mai «onto»
**Stato**: Attiva · 2026-09-25 · deciso dall'agente su delega dell'utente
(TASK-061)

Con ADR-0057 ogni indicazione può avere `along`: la via che corre accanto a
una strada senza nome, dedotta dalle strade vicine. L'app la ignorava, e un
marciapiede diceva solo «Turn left onto the footpath».

**Decisione**: quando `street` manca e `along` c'è, la frase aggiunge
«beside» e la via dopo il tipo di strada: «Turn left onto the footpath
beside Via Roma», alla partenza «Head out on the footpath beside Via Roma».
Senza tipo di strada resta solo «Turn left beside Via Roma». Vale uguale
per il banner, la seconda riga e la voce, che usano la stessa funzione
(`onto` in `phrases.ts`). `street` vince sempre; senza tutti e due, e con
un'API senza `along`, la frase è quella di prima.

**Scartate**: «along Via Roma» (si legge come se la via fosse quella su cui
si corre, e a voce si confonde con «onto»); «Turn left onto Via Roma» (è un
nome dato a una strada che non l'ha, contro ADR-0045); «near Via Roma»
(troppo vago per decidere a un incrocio).

**Conseguenza**: le frasi dei marciapiedi si allungano di due o tre parole;
il nome è sempre quello di una via vera accanto, non del marciapiede.

## ADR-0059 — Corridoio più veloce, a percorsi identici
**Stato**: Attiva · 2026-09-25 · deciso dall'agente su delega dell'utente
(TASK-063)

Sopra i 10 km il motore stava fra 40 e 97 s sui casi di riferimento, e più
di metà del tempo era il corridoio (`_corridor_costs`): a ogni tracciato,
fino a 40 per richiesta, l'elenco in Python di tutti gli archi della zona
e la distanza dalla forma di tre punti per arco.

**Decisione**: si accelera senza cambiare un solo numero.
- Gli archi di un grafo e i loro passi u→v si elencano una volta e restano
  accanto al grafo, come già i punti campione (mappa debole, rifatta se
  cambia il numero di archi); i costi si calcolano con numpy.
- La distanza dalla forma si calcola una volta per punto distinto: i capi
  degli archi si ripetono, e ogni strada c'è nei due sensi.
- `distance_to_segments` lavora su x e y separati, a blocchi di circa un
  milione di coppie: la stessa aritmetica, circa il doppio più veloce.

**Perché così**: il compito chiedeva prima i tagli che non cambiano i
percorsi. Questi danno gli stessi bit (test in `test_network.py`) e, sui 13
casi misurati, gli stessi percorsi punto per punto. Corridoio da 1,3 a 4,5
volte più veloce; Trento da 15 a 21 km da 80–97 s a 35–64 s.

**Scartato, per ora**: fermare la seconda ricerca fino a 2 km (ADR-0040)
quando la prima ha già un percorso disegnabile, o darle meno tracciati:
taglia di più ma cambia i percorsi, va deciso fuori da questo task. Un
ritaglio della zona senza copia: tocca l'API (`services/api`) e il nodo
temporaneo che il motore aggiunge al grafo.

## ADR-0060 — Animali candidati: la sagoma nel contorno, i dettagli sottili ripassati
**Stato**: Attiva · 2026-09-25 · chiesto dall'utente («aumenta il numero di
forme disponibili», poi «Animali»: farfalla, uccello, cane, lumaca); il
disegno deciso dall'agente su delega dell'utente (TASK-064); giudizio
dell'utente: tutti e quattro `sì` a Milano; farfalla `quasi` a Trento e
Levico, uccello `quasi` a Levico, lumaca `sì` a Trento, il resto `no`

Il catalogo ha sette forme, e ci entra solo ciò che l'utente ha giudicato
a occhio sulle strade (ADR-0036). Servivano quattro animali da provare,
come le candidate di TASK-034.

**Decisione**:
- **Quattro contorni nuovi** in `route_engine/shapes/outlines/`
  (`butterfly`, `bird`, `dog`, `snail`), disegnati dall'agente con pochi
  punti e archi calcolati: nessuna licenza di terzi, nessun download. Si
  provano solo dalla CLI (`--outline`) finché l'utente non li giudica;
  nessun parametro del motore cambia.
- **La sagoma grande sta nel contorno** (ADR-0035): la farfalla vista
  dall'alto, simmetrica, con quattro ali e una rientranza profonda fra
  l'ala superiore e l'inferiore; l'uccello in volo di profilo, con due ali
  alzate e larghe e la coda a forbice; il cane in piedi di profilo, con
  l'orecchio alzato; la lumaca di profilo, con il guscio tondo sul corpo.
  Tutti dritti, come le altre forme (ADR-0038).
- **I dettagli sottili sono tratti ripassati** (ADR-0039): le antenne della
  farfalla, le quattro zampe e la coda del cane, la spirale del guscio (un
  giro, appesa al guscio con una linea corta come gli occhi del gatto) e le
  corna della lumaca. L'uccello resta solo contorno.
- **Campioni come la CLI, senza ritagli**: `read_outline`, `plan_shape` e
  `tilt_limit` come `--outline`, ma con i grafi di zona dell'API in
  memoria, come TASK-032 e TASK-034: nessun ritaglio in `data/cache/` (C:
  quasi pieno) e solo le zone già in cache.

**Motivo**: una prima bozza, provata sulle strade prima dei campioni, aveva
l'uccello con ali strette, il cane con le quattro zampe nel contorno e la
lumaca con una spirale di un giro e un quarto. Le ali strette si chiudevano
in una macchia; le zampe del contorno, larghe 0,11 della forma, si
riducevano a due blocchi o sparivano (un contorno senza tratti si
ricampiona a 64 punti, e un piede ne prende uno o due); la spirale fitta
diventava un groviglio. Con i tratti ripassati ogni vertice resta, e la
strada scende lungo la zampa e torna indietro. Rifatti così, uccello, cane
e lumaca si leggono meglio in due zone su tre (confronto a occhio
dell'agente, non un giudizio); le bozze non sono nei campioni.

**Conseguenza**: 12 campioni a 15 km (`samples/LOG.md`, TASK-064), tutti
con un percorso: somiglianza 0,84–1,00, in 4–60 s, generati prima di
TASK-063, che lascia i percorsi identici (ADR-0059). Tre animali su
quattro hanno tratti, quindi le tolleranze dimezzate di ADR-0039.
Giudizio dell'utente (2026-09-25): a Milano si riconoscono tutti e
quattro; fuori da Milano la farfalla è `quasi` a Trento e Levico,
l'uccello `quasi` a Levico, la lumaca `sì` a Trento, il cane `no` in
tutte e due. Quali animali entrano nel catalogo lo decide l'utente, con
TASK-065 (ADR-0036); gli altri restano nella cartella dei contorni, come
la casa e l'albero.

## ADR-0061 — Farfalla, lumaca, testa di cane e di coniglio nel catalogo; «dog head» sullo schermo
**Stato**: Attiva · 2026-09-26 · le forme scelte dall'utente; il resto
deciso dall'agente su delega dell'utente (TASK-065)

TASK-064 (ADR-0060), TASK-068 (ADR-0065) e TASK-078 (ADR-0073) hanno
disegnato quattro animali, una testa di cane e tre candidate nuove (testa di
coniglio, zucca, albero di Natale), giudicati dall'utente sulle strade a
15 km. Quali entrano nel catalogo lo decide l'utente (ADR-0036).

**Decisione**:
- **Entrano `butterfly`, `snail`, `dog_head` e `rabbit_head`**, scelti
  dall'utente. Tutti e quattro sono `sì` a Milano; la farfalla è `quasi` a
  Trento e Levico, la lumaca `sì` a Trento, la testa di cane `sì` in tutte
  e tre le zone, la testa di coniglio `sì` a Trento e `quasi` a Levico. Il
  cane intero (`dog`), l'uccello (`bird`), la zucca (`pumpkin`) e l'albero
  di Natale (`christmas_tree`) restano contorni da CLI, come la casa: il
  cane è `sì` solo a Milano, e la testa lo sostituisce.
- **Come le forme di TASK-039**: in `SHAPES` del motore, in `shared-types`
  e in `contract.json`, con le parole in `shapeWords.ts` e una riga per
  forma nella domanda all'AI (`OUTLINES`). Tutte e quattro entrano con i
  tratti ripassati (antenne; spirale e corna; occhi, naso e bocca).
- **I nomi nel contratto sono `dog_head` e `rabbit_head`**, come i file.
  **Sullo schermo si legge «dog head», «rabbit head»** (`shapeName` in
  `shapeWords.ts`): tessere, suggerimenti, conferma sotto il campo, attesa,
  nome del percorso. Una tessera, o un chip dopo un percorso che non ci
  sta, scrive nel campo il nome che si legge, e la tabella lo conosce; la
  tabella legge il trattino basso come uno spazio.
- **«cane», «dog», «cagnolino», «puppy» portano alla testa di cane**, e
  «coniglio», «rabbit», «bunny» a quella di coniglio: nel catalogo c'è un
  cane solo e un coniglio solo, e chi li chiede vuole quelli. «chiocciola»
  porta alla lumaca: nel campo della forma è l'animale, non la «@».
- **Tessere con le emoji** 🦋 🐌 🐶 🐰, come gatto, pesce e cavallo (🐶 e
  🐰 sono proprio due teste), quattro per riga come oggi.
- **Liste di prova dell'AI**: «cane» e «farfalla», che valevano nessuna
  forma, escono perché ora le legge la tabella; entrano parole che la
  tabella non conosce per le quattro forme («Snoopy», «Lassie»,
  «escargot», «farfalla monarca», «Bugs Bunny»…) e due senza forma
  («ragno», «ape»).

**Motivo**: la regola del catalogo resta ADR-0036: entra solo ciò che
l'utente ha giudicato a occhio. Un nome di contratto con il trattino basso
è chiaro per l'API ma non per chi corre; un nome solo per lo schermo tiene
il contratto com'è e costa una funzione. Portare «cane» alla testa evita
un «nessuna forma» per la parola più ovvia.

**Conseguenza**: il catalogo ha undici forme. La lumaca (72 vertici), la
testa di cane (69) e quella di coniglio (81) hanno più vertici dei 64 punti
di una forma: con i tratti ogni vertice resta (TASK-037), e i test del
catalogo lo prevedono. Chieste come forme del catalogo danno, punto per
punto, i percorsi dei campioni giudicati (`docs/tasks/TASK-065.md`).
Un'app più vecchia dell'API non conosce le forme nuove: se l'AI risponde
«butterfly», quell'app lo tratta come una risposta sbagliata. App e API si
aggiornano insieme, come oggi dallo stesso checkout. Le tessere sono undici:
tre righe da quattro, l'ultima con tre.

## ADR-0063 — Lettere unite anche dalla cima: tre regole di lettura, la parola più corta
**Stato**: Attiva · 2026-10-02 · chiesto dall'utente nel giudizio di
TASK-059 (2026-09-25: «anche connetterle dalla cima», se non confonde o
aiuta); formato, regole e scelta decisi dall'agente su delega dell'utente
(TASK-067); accese per difetto in tutti e due gli stili per scelta
dell'utente (2026-10-02)

**Contesto**: ogni lettera entra ed esce sulla base, e le unioni si corrono
due volte. U, V, W, Y e T toccano la base a metà: l'unione passa sotto
mezza lettera, mentre in cima hanno un angolo sul bordo. A pari chilometri
una parola più corta dà lettere più alte, e lettere più basse si leggono
peggio (ADR-0067). Le misure sono in `docs/tasks/TASK-067.md`.

**Decisione**:
- **Il formato**: una lettera che si può unire in cima lo dichiara in
  `letters.json` e `letters_block.json` con `"top": {"in": [x, 1], "out":
  [x, 1]}`, uno o tutti e due. Il task chiedeva per ogni ingresso e uscita
  i suoi `out` e `back` scritti a mano; li ricava invece il motore
  (`Letter.route`) dalla linea chiusa che la lettera ha già, cominciata
  dall'ingresso e tagliata all'uscita. La lettera è per costruzione la
  stessa, corsa lo stesso numero di volte, e non ci sono 150 linee in più
  da tenere uguali a mano. Ne segue che la lunghezza delle lettere non
  cambia mai: una coppia si accorcia solo per lo spazio.
- **Tre regole di lettura**, controllate da `parse_letters` sull'alfabeto
  (un `top` che ne viola una è rifiutato), ognuna con un test e una coppia
  che la viola:
  1. un'unione in cima non allunga un tratto che finisce sulla cima (la
     sbarra della T, il braccio alto di E, F, Z e delle C, G, S squadrate):
     «TU», «EH», «CH» squadrata restano sulla base. Era la regola già
     scritta nel task, sul modello di ADR-0056;
  2. un'unione in cima non passa sopra la lettera, entra dal bordo sinistro
     ed esce dal destro: «PU» resta sulla base. Sotto la lettera la linea è
     il rigo; sopra è un tratto in più;
  3. una lettera che tocca la cima in un punto solo non si unisce lì: «VI»
     e «UL» restano sulla base. La I fra due unioni in cima è una T («VIVA»
     si legge «VTVA»); con la cima da un lato e la base dall'altro la I e
     la L sono un gradino, il caso che il task chiedeva di guardare.
- **Cima da un lato e base dall'altro è permesso** alle lettere che passano
  le tre regole (H, M, N, U, V, W, X, Y…): hanno due punti in cima e
  restano loro stesse (la V di «UVA»).
- **La scelta** (`choose_joins`): ogni spazio tutto sulla base o tutto in
  cima; fra le combinazioni permesse, al più 128, la parola più corta; a
  pari lunghezza meno unioni in cima, poi la base per prima. Deterministica.
- **Accese per difetto in tutti e due gli stili** (`words.TOP_JOINS`),
  scelta dell'utente. Sui campioni l'utente ha preferito il percorso di
  oggi in tutti e sette i casi giudicati (unioni in cima: 5 «no», 2
  «quasi», nessun «sì») e ha detto che le tre regole vanno bene; nella
  scelta finale ha chiesto di accenderle per tonde e squadrate, e
  interpellato sulla differenza fra le due risposte ha confermato
  «accendi in cima». `compose` e `plan_route` hanno `top_joins`,
  `measure_words.py` ha `--no-top-joins`: con le unioni spente ogni parola
  è identica a prima, punto per punto (test). API, `shared-types` e app
  non cambiano.
- **La scala per lettera non si fa**: era l'altra metà della richiesta del
  2026-09-25, che ADR-0056 rimanda qui. L'utente la lascia fuori
  (2026-10-02), perché lettere più piccole si leggono peggio (ADR-0067).

**Alternative scartate**: `out` e `back` scritti a mano per ogni ingresso e
uscita (sopra); i punti in cima dedotti dalla geometria senza dichiararli
(togliere una lettera dopo il giudizio dell'utente vorrebbe codice, non una
riga dell'alfabeto); unire anche la I e la T, che danno quasi tutto il
guadagno senza regole («TUTTI» −16,6%, «VIVA» −6,3%) ma cambiano la
parola; unioni a metà altezza o in diagonale (fuori scope).

**Conseguenze**: con le regole si accorciano solo le coppie in cui una
lettera è U, V, W o Y (tonde), P, U, V o Y (squadrate), e l'altra arriva in
cima con un angolo: 68 coppie tonde e 87 squadrate su 676. Delle sette
parole misurate cambia solo «UVA» (−7,4% tonda, −8,6% squadrata); «NUVOLA»
−5,2%, «LUNA» −2,6%. Le altre parole restano identiche. Sulle strade le
lettere non vengono sempre più alte: su nove campioni a 15 km lo sono in
cinque, e sempre per «UVA» squadrata (`docs/tasks/TASK-067.md`). La ricerca
non dura di più. `nearby_starts.py`, la CLI e `seed_catalog.py`
compongono la parola con il predefinito dello stile, quindi le seguono
senza altre modifiche. L'app pubblicata le vede quando l'API sul server è
aggiornata (`DEPLOY.md` F.12, con l'ok dell'utente). Le parole già nel
catalogo restano com'erano finché non si ridisegnano: fra quelle di oggi
cambierebbe solo «NYC» tonda. Per tornare indietro basta `TOP_JOINS` a
`False`.

## ADR-0064 — La barra stima una parola dalle sue lettere
**Stato**: Attiva · 2026-09-25 · deciso dall'agente su delega dell'utente
(TASK-069)

Una parola si calcolava come una forma della stessa distanza
(`computeSeconds`, 2,5 s a km): per «CIAO» a 15 km 37,5 s, mentre il motore
ne mette 40–140. La barra arrivava presto in fondo e pulsava a 75 s, quando
un'attesa normale era ancora in corso.

**Misure** (CLI del motore, Trento, zona in cache, PC di sviluppo,
2026-09-25): «UNO» 10 km 45 s; «CIAO» 15 km 75 s e 43 s; «TRENTO» 21 km
106 s; «CAMMINO» 21 km 141 s. A parità di distanza, 7 lettere costano un
terzo più di 6: il tempo lo fanno le lettere, ognuna un percorso a sé
cucito alla vicina.

**Decisione**: nella fase di calcolo, se la richiesta ha `word`, la stima è
`wordSeconds` = 20 s a lettera, mai meno di `computeSeconds` della stessa
distanza. Le altre fasi (coda, download) restano quelle di ADR-0050; la
regola della pulsazione oltre il doppio (ADR-0055) vale uguale: «CIAO»
pulsa dopo 160 s invece di 75 s.

**Scartate**: una retta con lettere e km insieme (con quattro misure, due
parametri inseguono il rumore: «CIAO» varia da 43 a 75 s da solo); 18 s a
lettera, il valore medio (20 s sta un po' sopra, e le attese già annotate
arrivano a 140 s per «CIAO» e 258 s per «BELLO»).

**Conseguenza**: la barra di una parola avanza più piano, e pulsa solo dopo
il doppio del solito per quella parola. Se il motore diventa più veloce
sulle parole, basta cambiare `WORD_LETTER_S` con nuove misure.

## ADR-0065 — Testa di cane: orecchie che pendono, occhi, naso e bocca ripassati
**Stato**: Attiva · 2026-09-25 · chiesto dall'utente («Per il cane prova
anche solo la testa facendo dettagli come bocca naso e occhi»); il disegno
deciso dall'agente su delega dell'utente (TASK-068); giudizio dell'utente:
`sì` a Trento, Levico e Milano

Il cane intero di TASK-064 (ADR-0060) è `sì` a Milano e `no` a Trento e
Levico. L'utente chiede di provare solo la testa, con i dettagli del muso.

**Decisione**:
- **Un contorno nuovo**, `route_engine/shapes/outlines/dog_head.json`,
  accanto a `dog.json`, che resta com'è. Si prova solo dalla CLI
  (`--outline`) finché l'utente non lo giudica; nessun parametro del motore
  cambia.
- **Vista di fronte, orecchie che pendono**: cranio tondo, muso più
  stretto, due orecchie lunghe ai lati delle guance, aperte in basso di
  30°, staccate dalla guancia da una tacca a V larga. È ciò che la
  distingue dal gatto (`cat.json`), che ha le orecchie a punta in su: nella
  testa di cane la cima è il cranio.
- **Occhi, naso e bocca sono tratti ripassati** (ADR-0039): gli occhi, due
  anelli di otto punti appesi con una linea corta alla tacca fra orecchio e
  guancia, come quelli del gatto; il naso, un anello in mezzo al muso,
  appeso a una linea che sale dal mento; la bocca, due linee corte da quella
  linea sotto il naso, una per lato.
- **Campioni come TASK-064**: i grafi di zona dell'API in memoria, solo le
  zone in cache, nessun ritaglio su C:.

**Motivo**: otto bozze provate sulle strade prima dei campioni
(`docs/tasks/TASK-068.md`). Con dettagli piccoli il muso si aggrovigliava;
il motore taglia gli anelli all'interno, quindi occhi e naso devono essere
grandi quasi quanto gli occhi del gatto (470 m contro 560 m a 15 km, a
scala piena) e avere più punti di passaggio; con la tacca stretta il
percorso la scorciava e un orecchio spariva. Con le orecchie aperte la
somiglianza sale a 0,97 · 0,95 · 0,99 (Trento, Levico, Milano), da
0,94 · 0,92 · 0,98.

**Conseguenza**: 3 campioni a 15 km (`samples/LOG.md`, TASK-068), tutti
con un percorso, in 3–17 s. I dettagli, andata e ritorno, sono il 44% della
lunghezza del disegno, contro il 29% del gatto: a 15 km naso e bocca escono
più piccoli del disegno. Giudizio dell'utente (2026-09-25): la testa è
`sì` in tutte e tre le zone, dove il cane intero era `sì` solo a Milano.
Se il cane entra nel catalogo, e come testa o intero, lo decide l'utente
con TASK-065 (ADR-0036).

## ADR-0067 — Parole: il ritorno sulle strade dell'andata, provato e scartato
**Stato**: Scartata · 2026-09-26 · chiesto dall'utente («se si percorre la
stessa strada anche al ritorno le rende più pulite le lettere, e più
fini»); il metodo deciso dall'agente su delega dell'utente (TASK-071);
giudizio dell'utente: 4 parole su 9 peggio, nessuna meglio; l'utente ha
scelto di non farlo entrare nel motore

Una lettera senza anelli si corre tutta due volte (ADR-0056), e dove la
parola torna su se stessa le strade appena usate costano la metà
(ADR-0044). Sui campioni di TASK-050 e TASK-059, rigenerati con il codice
di `main`, il ritorno prende un'altra strada dove l'andata ha fatto
zig-zag, e al posto di una linea viene un anello. Succede soprattutto a
Milano, con marciapiedi e vie parallele fitte: «CIAO» ha il 51% del
percorso su strade corse due volte contro il 74% del disegno, e 3,7 km
corsi una volta sola accanto a un tratto ripassato
(`docs/tasks/TASK-071.md`).

**Provato** (commit `0e8add6` nel branch `feat/TASK-071-retraced-letters`,
tolto dal commit dopo):
- in `words.compose` i tratti ripassati tagliati negli stessi punti
  all'andata e al ritorno (il gambo di E, K, L e la sbarra della B non lo
  erano);
- un tracciatore per le parole, `retrace.snap_retraced`: ogni punto della
  linea tiene il nodo di strada in cui è stato raggiunto la prima volta, e
  un lato già disegnato nel verso opposto ripete all'indietro i nodi
  dell'andata; al primo passaggio le strade già usate costano la metà, come
  prima. Le altre forme restavano con `snap_to_network`, identiche (cuore,
  gatto e stella a 15 km nelle tre zone, stessi punti).

**Esito**: ogni tratto ripassato diventa una linea sola (Milano: «CIAO» 77%
di strade doppie, «MAX» 92%), ma il ritorno ripete gli zig-zag dell'andata
e allo stesso piazzamento il percorso si allunga del 2–24% (mediana 5%). La
ricerca, per stare nella distanza, stringe la parola o sceglie un altro
posto: a Trento e Levico lettere più piccole del 13–28%. Giudizio
dell'utente, prima → dopo: «CIAO» sì · sì · sì → quasi · quasi · sì;
«BELLO» no · quasi · sì → no · no · quasi; «MAX» sì ovunque, come prima (e
grande come prima). Le linee più sottili non compensano lettere più
piccole.

**Decisione**: il motore resta com'è. Il ritorno su un'altra strada nasce
dallo zig-zag dell'andata, cioè da tratti obliqui o curvi su una griglia di
vie: il seguito proposto all'utente sono le lettere squadrate dello
screenshot di Strava, un tratto per via, dove il ritorno pulito viene da
sé (proposta in `docs/tasks/TASK-071.md`).

**Quanta strada costa il ripasso** (per chi non ama strade doppie e
inversioni): sta nel disegno delle lettere, con o senza questa modifica.
Le lettere ripassano il 74–91% della loro linea; a 15 km il 51–92% del
percorso è su strade corse due volte (con il ritorno a specchio 71–92%,
cioè 5,4–7,0 km di secondo passaggio), con 3–25 inversioni a U per parola.

## ADR-0068 — Il contorno ricavato da un'immagine, con regole fisse
**Stato**: Attiva · 2026-09-25 · chiesto dall'utente («l'utente può caricare
un'immagine da rappresentare e dai contorni si ricava la forma»), con il
perimetro della prima versione: un soggetto chiaro su sfondo uniforme, solo
il contorno esterno; Pillow autorizzata dall'utente; il metodo e le soglie
decisi dall'agente su delega dell'utente (TASK-072); giudizio
dell'utente: mela, pera e Italia `sì` ovunque, stella `quasi` a Trento e
`sì` a Milano, gatto `no` a Trento e Milano

Le forme arrivavano solo dal catalogo, dai file dei contorni e dalle
parole. L'utente vuole partire da un'immagine sua. Il principio resta: il
percorso lo decide il motore, e anche il contorno lo ricava il motore, non
l'AI.

**Decisione**:
- **Un modulo nuovo, `route_engine/image_outline.py`**: PNG o JPEG →
  sfondo dal bordo → soggetto per soglia sul colore (o sulla trasparenza) →
  il pezzo più grande → contorno esterno lisciato e semplificato → un
  `Outline` come quelli dei file, controllato da `parse_outline`
  (`ROUTE_ENGINE.md` §2, «Il contorno da un'immagine»). Fuori da
  `shapes/`, che resta alla sola libreria standard.
- **Regole fisse, niente di appreso**: stessa immagine, stesso contorno.
  Soglie: sfondo uniforme se il 70% del bordo sta entro 40 dalla sua
  mediana (RGB); soggetto oltre 60 dallo sfondo; il pezzo più grande
  almeno il 75% del soggetto; il soggetto staccato dal bordo e largo almeno
  48 pixel su 640; al più 100 angoli.
- **Rifiutare invece di indovinare**: sfondo non uniforme, nessun
  soggetto, più soggetti, soggetto che tocca il bordo, troppo piccolo,
  troppo frastagliato, formato sbagliato. Ogni rifiuto ha un motivo in una
  parola (`reason`), per il messaggio dell'app di TASK-073.
- **Lisciato alla scala delle strade**: le parti più sottili del 2% del
  soggetto si tolgono e le fessure altrettanto strette si chiudono, con
  giunzioni ad angolo, così le punte restano punte (ADR-0038, ADR-0039: i
  dettagli sottili sulle strade non restano). Semplificazione di
  Douglas–Peucker all'1% del soggetto.
- **Il contorno si calcola con shapely** (unione dei tratti di pixel di
  ogni riga, `buffer`, `simplify`) e numpy, già installati con osmnx:
  dichiarati in `pyproject.toml` come Pillow, perché il motore li importa
  (come numpy con TASK-062). Nessuna altra libreria (scikit-image, OpenCV).
- **Dalla CLI**: `--image FILE` come `--outline` (`plan_shape`,
  `tilt_limit`, forma dritta), con il nome del file; `--save-outline FILE`
  scrive il contorno in JSON, che `--outline` rilegge uguale.

**Motivo**: un soggetto su sfondo uniforme si separa bene con una soglia,
senza modelli, e la regola si prova con immagini disegnate nei test. Uno
sfondo pieno di cose invece non ha una soglia giusta: meglio un rifiuto con
il motivo che una forma a caso. Il pezzo più grande e il solo contorno
esterno danno una linea chiusa, l'unica cosa che un percorso disegna senza
tratti ripassati.

**Conseguenza**: un pezzo staccato più piccolo (un gambo che non tocca la
mela, un puntino) si perde senza avviso: l'anteprima del contorno
nell'app (TASK-073) lo farà vedere prima di chiedere il percorso. Uno
sfondo con una sfumatura forte, o un'ombra attaccata al soggetto, viene
rifiutato o finisce nel contorno. I dettagli interni (occhi, finestre) non
diventano tratti ripassati: se servono, è un lavoro a parte.
Giudizio dell'utente (2026-09-25, `samples/LOG.md`): mela, pera e Italia
`sì` in ogni zona, stella `quasi` a Trento e `sì` a Milano, gatto `no` a
Trento e Milano. Il gatto non si riconosceva già dal contorno: una sagoma
povera di dettagli resta povera anche sulle strade. Da valutare con
TASK-073: l'anteprima che fa giudicare la sagoma prima del percorso, e se
la semplificazione toglie troppo.

## ADR-0069 — L'immagine nell'API: base64 in JSON, anteprima, poi il contorno
**Stato**: Attiva · 2026-09-26 · perimetro dell'utente (un soggetto chiaro
su sfondo uniforme, solo il contorno esterno, rifiuto con il motivo;
anteprima prima del percorso; `expo-image-picker` autorizzato); il
contratto deciso dall'agente su delega dell'utente, approvato dal
coordinatore (TASK-073)

**Decisione**:

- **Due richieste.** `POST /image-outlines` riceve l'immagine e risponde
  con il contorno che il motore ricava (ADR-0068), in meno di 2 s; l'app lo
  mostra. `POST /image-route-jobs` riceve il contorno, non l'immagine, e
  risponde con un `RouteJob` come `/route-jobs`, letto e annullato sullo
  stesso `/route-jobs/{job_id}`.
- **L'immagine in base64 dentro il JSON**, al più 10 MB prima della
  codifica (`MAX_IMAGE_BYTES`; Pydantic taglia prima la stringa a
  13 333 336 caratteri). Niente multipart, che vorrebbe `python-multipart`:
  nessuna dipendenza Python nuova (Pillow c'era già con il motore). Una foto
  dell'iPhone, ricodificata in JPEG a qualità 0,8 dal selettore, sta fra 1
  e 4 MB. L'API non salva e non scrive l'immagine.
- **Il contorno torna in due forme**: `points`, normalizzati in [-1, 1],
  per il percorso; `image_points`, frazioni della foto dall'alto a
  sinistra, con `aspect`, per disegnarlo sopra la foto nell'anteprima.
- **Il contorno che torna dal telefono si controlla come ogni input**
  (richiesta del coordinatore): da 4 a 101 punti (al più 100 angoli, il
  limite del motore), numeri finiti, dentro [-1, 1] (tolleranza 1e-6), poi
  `parse_outline` del motore (chiuso, 3 punti distinti, senza incroci).
  Altrimenti `invalid_request` con il motivo, prima di creare il job.
- **Il contratto del motore non cambia**: `RouteRequest` e `models.py`
  restano forma o parola. L'API ha il suo `ImageRequest` (partenza,
  distanza e attività controllate con le funzioni di `models.py`) e il suo
  pianificatore, `plan_request`, che per un'immagine chiama `plan_shape`
  come `--image` dalla CLI: dritto (ADR-0038), nome `image`. Il
  `RouteResult` di un'immagine ha `shape` e `word` a `null`.
- **Un codice nuovo, `image_not_usable`** (422), con un campo nuovo in ogni
  errore, `reason`: `null`, tranne con questo codice, dove è il motivo del
  motore (`IMAGE_REASONS`). Un test dell'API controlla che i motivi di
  `image_outline.py` siano tutti nel contratto.
- **`shared-types` resta retrocompatibile**: tipi nuovi
  (`ImageOutlineRequest`, `ImageOutline`, `ImageRouteRequest`,
  `ImageReason`), `reason` opzionale, `GpxRequest.request` che accetta
  anche un `ImageRouteRequest`. Un'app vecchia non chiama i due indirizzi
  nuovi e ignora `reason`.
- **La semplificazione di ADR-0068 resta com'è.** Misurata sui cinque
  campioni di TASK-072: il contorno finale copre il 97–99% della sagoma
  grezza (sovrapposizione mela 0,987, gatto 0,981, Italia 0,968, pera
  0,984, stella 0,985) con 16–42 angoli, lontano dal limite di 100.
  Dimezzare lisciatura e semplificazione porta il gatto a 0,989: la sua
  sagoma resta la stessa. Il gatto non si riconosceva per la sagoma, non per
  la semplificazione.

**Motivo**: l'anteprima fa giudicare la sagoma prima di aspettare il
percorso, ed è la risposta al gatto di TASK-072. Mandare il contorno invece
dell'immagine alla seconda richiesta evita di rimandare megabyte, e lascia
l'API senza stato fra le due. Il contorno però arriva dal telefono, e il
motore non si fida di un input: lo ricontrolla.

**Conseguenza**: l'API potrebbe ricevere un contorno che non ha tracciato
lei. Se passa i controlli è una forma valida come un file di `outlines/`, e
il motore la disegna: nessun rischio per il motore, e il principio resta
(l'AI non produce geometrie; qui l'AI non c'entra). La trasparenza di un PNG
si perde nel selettore di iOS, che consegna JPEG. Un pezzo staccato si perde
ancora, ma ora si vede nell'anteprima.

## ADR-0070 — «Off the route» dopo più posizioni e qualche secondo, non dopo una
**Stato**: Attiva · 2026-09-25 · deciso dall'agente su delega dell'utente
(TASK-074)

L'utente, correndo sul marciapiede opposto a quello del percorso, si è
sentito dire «You are off the route». La soglia era già 40 m
(`OFF_ROUTE_M`, ADR-0052), ma bastava **una** posizione oltre: in OSM il
marciapiede opposto è spesso una linea a sé, a 15–25 m dal percorso, e il
GPS fra le case sbaglia di 10–20 m, a tratti per qualche secondo di fila.
22 m di marciapiede più 20 m di errore passano i 40 m.

**Decisione** (`navigator.ts`):
- **La soglia resta 40 m.** Alzarla non basta (un errore raro supera
  qualunque soglia) e ritarda la via sbagliata, che è a 50 m o più.
- **L'avviso dopo 3 posizioni di fila oltre la soglia, che coprono almeno
  8 s** (`OFF_FIXES`, `OFF_SECONDS`) dalla prima. Una posizione entro la
  soglia azzera la serie. Il GPS che sbaglia di solito torna in pochi secondi; una via
  sbagliata non torna vicina. Il conto da solo non basta: a passo di corsa
  le posizioni arrivano ogni 2 s circa (`FIX_EVERY_M` = 5 m), e 3 posizioni
  sono 4 s. Senza l'ora della posizione conta solo il numero.
- **Una posizione con errore dichiarato oltre 40 m** (`POOR_FIX_M`, da
  `coords.accuracy`) non dice niente sull'essere fuori: non allunga né
  azzera la serie, e non riporta sul percorso. Sul percorso fa avanzare
  come prima.
- **«Back on the route» dopo 2 posizioni di fila entro la soglia**
  (`BACK_FIXES`): su una via parallela a 50 m, una posizione storta verso
  il percorso non deve far dire «Back on the route» e poi di nuovo «off».
  Il ritorno vero, con una posizione ogni 2 s, si sente dopo 2 s in più.

**Scartate**: una soglia che cresce con l'accuracy della posizione (iOS la
dà spesso a gradini larghi, fino a 65 m, e a 65 m nessuna soglia utile resta sotto
i 50 m della via parallela); la media delle ultime posizioni (un errore
grande pesa comunque, e la via sbagliata arriva più tardi).

**Conseguenza**: sulla via parallela sbagliata l'avviso arriva 8–10 s dopo
averla presa, circa 25–30 m di corsa, invece che alla prima posizione. Test
con sequenze finte in `navigator.test.ts`: 4 minuti sul marciapiede opposto
con tre posizioni di fila oltre 40 m, nessun avviso; un punto a 60 m,
nessuno; una via a 47–63 m, uno dopo 8 s; posizioni con errore 80 m,
nessuno. Se sul campo arriva ancora a sproposito, si alza `OFF_SECONDS`.

## ADR-0072 — Lettere squadrate: un secondo alfabeto, girato sulla griglia delle vie
**Stato**: Attiva · 2026-09-26 · chiesto dall'utente dopo TASK-071
(«sì, provale»), sul modello delle scritte di GPS art che ha mandato
(«2024», «HURRY»); disegno delle lettere, rotazione e soglie decisi
dall'agente su delega dell'utente (TASK-077); dopo il giudizio l'utente ha
scelto di tenere tutti e due gli stili, da scegliere nell'app (un task a
parte)

**Contesto**: le lettere di oggi (ADR-0044, ADR-0056) hanno curve e
diagonali che su una griglia di vie diventano scale e zig-zag, ed è lì che
il ritorno prende un'altra strada (ADR-0067). Nelle scritte di Strava che
l'utente ha mandato ogni tratto è una via, corsa all'andata e al ritorno,
e le lettere sono larghe e vicine.

**Decisione**:
- `letters_block.json`, stesso formato di `letters.json`: tratti solo
  orizzontali, verticali o a 45°. O, D, B, Q rettangoli chiusi sulla base
  (come oggi B, D, Z); la U con il fondo sulla base e gli angoli a 45°,
  perché due aste su una linea continua si leggerebbero come «II»; C, G,
  S, J con il tratto basso a 0,2, come E e L oggi. Le diagonali a 45° e
  non a gradini: la strada le fa comunque a gradini, della misura dei suoi
  isolati, mentre un gradino disegnato ha una misura che una via su due
  non ha. Larghe 0,8–1, spazi di 0,3 invece di 0,6.
- Lo stile si sceglie con `style` in `words.compose` e
  `optimizer.plan_route`, `"round"` per difetto: senza, parole e forme
  sono identiche a prima. `RouteRequest`, API e app non lo conoscono
  ancora.
- Una parola squadrata si gira come corrono le vie attorno a ogni
  partenza (`street_grid.py`: direzioni dei pezzi di via pesate per
  lunghezza, ripiegate in 90°, cime dopo una lisciatura di ±4°), invece di
  stare dritta entro ±15° (ADR-0038). Al più 30° fuori dall'orizzontale:
  a Levico la griglia a 43° vinceva il conteggio delle strade e metteva
  «MAX» e «BELLO» di traverso sulla mappa, illeggibili; senza una
  direzione entro 30° la parola sta dritta.

**Alternative scartate**: provare tutte le rotazioni fra −45° e 45° a
passi fini e lasciar scegliere il conteggio delle strade (sei volte i
piazzamenti da contare, e la griglia la trova già l'istogramma); una
direzione sola per tutta la zona (a 1–2 km le vie girano: Trento ha due
griglie a 5° e a −20°); diagonali a gradini disegnati.

**Conseguenze**: le parole squadrate sono più lunghe sul disegno (lettere
più larghe) e, a 15 km, lettere un po' più basse. Dove la griglia è
regolare (Milano) le lettere cadono sulle vie; dove non lo è (Levico,
Trento di là dall'Adige) il percorso resta a zig-zag come oggi.

**Giudizio dell'utente** (2026-09-26), squadrate (oggi): «CIAO» sì ·
quasi · sì (sì · sì · sì); «BELLO» quasi · no · no (no · quasi · sì);
«MAX» no · quasi · sì (sì · sì · sì); «HURRY» no ovunque. Vanno bene le
parole corte con lettere grandi su una griglia regolare (CIAO e MAX a
Milano); con cinque lettere a 15 km le lettere sono troppo piccole anche a
Milano. Lo stile di oggi resta il predefinito.

## ADR-0071 — Partenze vicine: tre nodi entro 100 m in parallelo, si tiene il cuore migliore
**Stato**: Attiva · 2026-09-26 · chiesto dall'utente dopo TASK-075 («il
motore prova alcune partenze vicine e tiene il percorso migliore», con
l'avvicinamento nel percorso); quante partenze, come sceglierle e come
tenere il tempo deciso dall'agente su delega dell'utente (TASK-076);
giudizio dell'utente: Caldonazzo partenza `sì`, vicina `quasi`; Trento 10 km
entrambe `sì`; Trento 15 km partenza spostata `sì`, vicina `quasi`; Milano
`sì`. Scelta dell'utente dopo il giudizio (2026-09-26): «vince il cuore
migliore», anche con la partenza spostata dalla ricerca

**Contesto**: a Caldonazzo 25–100 m di partenza portano il cuore da 10 km
da 0,73 a 0,92 (TASK-075). Il motore però non va toccato: `optimizer.py` è
di TASK-071 mentre si scrive questo.

**Decisione** (`route_engine/nearby_starts.py`):

- **Quali partenze**: fino a 3 nodi a 25–100 m in linea d'aria, uno per
  settore di 120° (il primo sul nord), al più 150 m lungo le strade e 25 m
  l'uno dall'altro; nel settore quello con la strada più vicina a 60 m.
- **In parallelo, in processi**: la partenza dell'utente fa il piano di
  sempre (`plan_shape`, può scaricare, spostare la partenza, cercare a
  2 km) nel processo che la chiede; ogni partenza vicina ha un processo
  (`multiprocessing`, `spawn`, priorità bassa). I processi, non i thread:
  la ricerca è Python puro e il GIL la serializza.
- **Una partenza vicina fa solo la ricerca da quel nodo** (`search` con
  `move_start=False`, `ShapeJob.here`): senza anelli a 250–500 m e senza la
  seconda ricerca a 2 km, i cui percorsi comincerebbero altrove e
  andrebbero scartati. Costa circa metà di un piano intero (Caldonazzo
  7–9 s contro 13–17 s). I passi dopo la ricerca ripetono quelli di
  `plan_shape` per questo caso; un test controlla che diano lo stesso
  risultato. Con un interruttore in `plan_shape`, dopo TASK-071, la copia
  si toglie.
- **Il grafo ai processi**: quello già ritagliato per la partenza, pickled
  una volta sola. La partenza vicina è entro 100 m, dentro il margine di
  500 m dell'area. Leggere la zona intera in ogni processo mandava in swap
  il PC (Trento 15 km: 240 s).
- **Quanto si aspetta**: finita la partenza dell'utente, al più 8 s, mai
  oltre 25 s dalla richiesta; se il suo percorso è già buono (somiglianza
  ≥ 0,90, distanza entro il 10%, partenza non spostata) nessuno. I ritardatari
  si chiudono (`terminate`).
- **Quando non si provano**: grafo oltre 30 000 nodi (Milano: 55 676 a
  10 km, 83 779 a 15 km; lì la sola ricerca da un nodo dura 35 s e il cuore
  è già a 0,99); e solo tanti processi quanti entrano nella memoria libera,
  lasciandone 1 GB alla partenza dell'utente (un processo ≈ 100 MB + 10
  volte il grafo pickled). Senza memoria il percorso è quello di oggi.
- **Quale si tiene** (scelta dell'utente): il cuore migliore fra tutti i
  candidati, cioè la partenza dell'utente, le vicine e la partenza che la
  ricerca ha spostato («Start here», fino a 1 km come prima). Punteggio: la
  somiglianza, meno la distanza oltre il 10% dal target pesata come in
  `search`; dove comincia il percorso non conta. Fra i candidati entro
  0,01 dal migliore vince quello che comincia più vicino all'utente
  (avvicinamento o spostamento), poi la partenza stessa. Soglia decisa
  dall'agente: a Trento 15 km l'occhio ha visto 0,02 (0,90 `sì`, 0,88
  `quasi`), in TASK-075 non sempre meno (0,85 `sì` e `quasi`).
  Scartati: il costo di `search` con la distanza piena (a Caldonazzo
  sceglieva un cuore da 0,82 a 9,4 km al posto di quello da 0,86 a 11,8 km,
  il tipo che l'utente aveva giudicato `no`); e la prima versione, che
  pesava lo spostamento come la ricerca e a Trento 15 km preferiva la
  vicina `quasi` al cuore `sì` a 1 km.
- **L'avvicinamento**: dal nodo della partenza dell'utente al nodo vicino
  per la strada più corta, e ritorno per la stessa; nei metri, nel GPX e
  nei nodi (le indicazioni lo contano). La somiglianza resta quella della
  forma.
- **Nell'API**: `plan_request` (`images.py`) chiama `plan_nearby` al posto
  di `plan_route`, per le forme e le parole; le immagini come prima. Le
  indicazioni non cambiano: quando vince una vicina il grafo è quello della
  partenza, il primo caricato. Dalla CLI: `--nearby N`.

**Misure** (cuore, zona già in memoria; tempi da 2–3 ripetizioni, molto
variabili: il PC ha 7 GB e durante le misure 0,4–2 GB liberi, con altri
agenti al lavoro):

| Caso | Solo partenza | Con 3 vicine | Somiglianza scelta |
|---|---|---|---|
| Caldonazzo 10 km | 8–19 s | 11–20 s | 0,86 → 0,86 (vicine 0,82, 0,79, 0,77) |
| Trento 10 km | 29–40 s | 40–42 s | 0,86 → 0,88 (65 m) |
| Trento 15 km | 34–39 s | 43–69 s | 0,90 spostata di 1 km, tenuta (vicina migliore 0,88) |
| Milano 10 km | 15–18 s | 25–33 s prima del limite sui nodi, ora non provate | 0,99 |
| Milano 15 km | 25–80 s | non provate | 1,00 |

Con 4 vicine: stessi guadagni, più tempo e memoria (Trento 15 km 52–256 s,
Milano 15 km `MemoryError`). Nell'ultima serie di misure, con meno di
1,5 GB liberi, la regola della memoria ha lasciato fuori le vicine in ogni
caso: tempi e percorsi quelli di oggi.

Caldonazzo, 25 posizioni entro ±100 m da Via della Villa, 10 km (le
posizioni del GPS degli screenshot dell'utente): dalla sola partenza
0,73–0,96, media 0,834, 7 sotto 0,80; con le vicine e la regola sopra
0,77–0,96, media 0,847, 4 sotto 0,80. I 7 cuori da 0,90 in su restano 7, e
vengono tutti dalla partenza spostata di 1 km.

**Conseguenza**: dove la rete è rada e la memoria c'è, il cuore dipende
meno dalla partenza: i casi peggiori migliorano, i migliori restano quelli
che la ricerca trova spostandosi. Dove la rete è fitta non cambia nulla. Il tempo cresce di
qualche secondo nei paesi e di 5–15 s a Trento, fuori dai 30 s di
PRODUCT.md dove già lo si era. Su questo PC la memoria decide spesso lei:
più RAM libera (chiudere applicazioni) lascia provare le vicine. La
somiglianza non segue sempre l'occhio (TASK-075): con la regola dell'utente
la scelta coincide con il giudizio in tutti e quattro i casi giudicati
(a Trento 10 km la vicina, 0,88, contro la partenza, 0,86: tutte e due
`sì`).

## ADR-0073 — Coniglio, zucca e albero di Natale: candidate come la testa di cane
**Stato**: Attiva · 2026-09-26 · chiesto dall'utente (spunti da gpsart.info:
animali «solo la testa», temi stagionali, sagome semplici); il disegno
deciso dall'agente su delega dell'utente (TASK-078); giudizio dell'utente:
tutte e tre `sì` a Milano; coniglio `sì` a Trento e `quasi` a Levico,
zucca `quasi` a Levico, albero di Natale `quasi` a Trento, il resto `no`

La testa di cane (ADR-0065) è `sì` in tutte e tre le zone, il cane intero
solo a Milano; il gatto da immagine (TASK-072) non si riconosceva già come
sagoma. Servivano altre forme da provare, riconoscibili dai loro tratti
principali prima che dai dettagli.

**Decisione**:
- **Tre contorni nuovi** in `route_engine/shapes/outlines/`
  (`rabbit_head`, `pumpkin`, `christmas_tree`), disegnati dall'agente con
  archi calcolati: nessuna licenza di terzi. Si provano solo dalla CLI
  (`--outline`) finché l'utente non li giudica; nessun parametro del motore
  cambia; `tree.json` resta com'è.
- **Il tratto che fa riconoscere la forma sta nel contorno** (ADR-0035):
  le orecchie lunghe e dritte del coniglio, più lunghe dei due terzi della
  testa (il gatto le ha corte a punta, il cane le ha pendenti); i tre
  spicchi della zucca, che si toccano in quattro tacche, e il picciolo
  storto; i tre piani dell'abete, con il bordo che risale verso il tronco.
  Dritti (ADR-0038).
- **I dettagli sono tratti ripassati** (ADR-0039, ADR-0065): occhi, naso e
  bocca del coniglio come quelli della testa di cane; occhi a triangolo e
  sorriso della zucca, appesi alle tacche e al fondo; la stella a cinque
  punte in cima all'albero.
- **Campioni come TASK-064 e TASK-068**: i grafi di zona dell'API in
  memoria, solo le zone in cache, nessun ritaglio su C:.

**Motivo**: bozze provate sulle strade prima dei campioni
(`docs/tasks/TASK-078.md`). Le orecchie strette del coniglio si perdevano
a Levico (0,78; con orecchie più larghe 0,88); i denti del sorriso,
larghi 0,12 della forma, sparivano in tutte le zone; tacche più profonde
fra gli spicchi spezzavano la zucca a Levico; con piani poco sporgenti e
la stella piccola l'albero di Trento perdeva i piani.

**Conseguenza**: 9 campioni a 15 km (`samples/LOG.md`, TASK-078), tutti
con un percorso, in 11–44 s: somiglianza 0,81–1,00, la più bassa a
Levico per tutte e tre. L'albero resta difficile fuori da Milano, come
quello di TASK-034/037. Giudizio dell'utente (2026-09-26): a Milano si
riconoscono tutte e tre; il coniglio è `sì` a Trento e `quasi` a Levico,
la zucca `no` a Trento e `quasi` a Levico, l'albero di Natale `quasi` a
Trento e `no` a Levico (l'albero di TASK-034/037 era `no` in tutte e due). Quali forme entrano nel catalogo
lo decide l'utente, con TASK-065 o dopo (ADR-0036).

## ADR-0076 — API da fuori casa: chiave, limite, indirizzo nell'app, Docker

**Data**: 2026-09-26 · **Task**: TASK-081 · **Stato**: accettata ·
deciso dall'agente su delega dell'utente (strade e vincolo «gratis e senza
carta» dall'utente, tramite il coordinatore)

**Decisione**:

- **Strada di adesso: PC + Tailscale** (`DEPLOY.md`, A): l'API resta sul
  PC con `--lan`, che ascolta su tutte le interfacce, anche quella di
  Tailscale; Expo pubblica l'indirizzo `100.x` se
  `REACT_NATIVE_PACKAGER_HOSTNAME` è impostato, e l'app ricava l'API dallo
  stesso host (ADR-0031). Nessuna chiave: la tailnet è privata. Poi
  Cloudflare Tunnel (B), server con carta (C), Raspberry Pi 5 (D), VPS
  pagato con PayPal (E).
- **Chiave**: solo dalla variabile `SHAPEROUTE_API_KEY`, mai da riga di
  comando (resta nella cronologia). Intestazione `X-API-Key`, confronto a
  tempo costante (`hmac.compare_digest`), almeno 16 caratteri o l'API non
  parte. `GET /health` resta aperto. Senza variabile, tutto come prima.
  Errore 401 `unauthorized`, codice nuovo del contratto.
- **Limite in memoria**, senza dipendenze: `SHAPEROUTE_RATE_LIMIT` POST al
  minuto per client (default 30, 0 = spento), finestra scorrevole; 429
  `too_many_requests` con `Retry-After`. Solo i POST, che fanno lavorare
  il PC: il polling dei job (GET ogni 2 s) non conta. Per indirizzo del
  client: dietro un tunnel tutti condividono lo stesso, accettabile per un
  utente solo.
- **Tutto in un modulo nuovo**, `shaperoute_api/access.py`, collegato con
  `protect(app)` in `create_app`.
- **App**: `EXPO_PUBLIC_API_URL` ed `EXPO_PUBLIC_API_KEY` in
  `apps/mobile/.env`, letti da Expo; l'indirizzo configurato vince su
  quello di Expo, la chiave va in ogni chiamata (job, polling, DELETE,
  GPX, letture, contorni). Senza, come prima.
- **Docker**: `python:3.12-slim`, dipendenze prese dai `pyproject.toml`,
  pacchetti eseguiti dai sorgenti con `PYTHONPATH` (così i file di dati
  del motore ci sono tutti, anche quelli che `package-data` non elenca),
  utente non root, grafi nel volume `/app/data/cache`, zone scaricate alla
  prima richiesta o subito con la CLI del motore. Ollama fuori
  dall'immagine: senza, `ai_unavailable`. La CI costruisce l'immagine per
  amd64 (con una prova di `/health` e della chiave) e per ARM64 (Raspberry
  Pi, Oracle Ampere), senza pubblicarla.

**Alternative scartate**: Hugging Face Spaces (Docker a pagamento), Render
e Koyeb gratis (512 MB di RAM, niente disco permanente: una zona ne occupa
centinaia), Cloudflare Workers (memoria); una libreria di rate limiting
(dipendenza nuova, non serve per un utente); la chiave come opzione
`--api-key`.

**Conseguenza**: l'utente può chiedere percorsi in 5G con il PC acceso
(A) senza cambiare codice; le strade senza PC acceso (D, E) sono
documentate e l'immagine è pronta. Il messaggio dell'app quando l'API non
risponde nomina Wi-Fi, Tailscale e l'indirizzo del server.

## ADR-0077 — Un avviso sconosciuto arriva con la prima lettera maiuscola
**Stato**: Attiva · 2026-09-26 · deciso dall'agente su delega dell'utente
(TASK-082)

Con ADR-0048 un avviso che l'app non riconosce passa com'è, e i testi del
motore sono in minuscolo: con «north-east» l'utente vedeva «start moved
250 m north-east of the requested point…» (Caldonazzo, TASK-076).

**Decisione**: la regola della partenza spostata accetta le direzioni col
trattino, tutte quelle di `optimizer._compass`; e un testo sconosciuto
passa ancora com'è, ma con la prima lettera maiuscola.

**Scartata**: cambiare il testo del motore; codici negli avvisi (vedi
ADR-0048), oggi fuori dal task.

**Motivo**: un avviso nuovo non si perde, e non sembra un errore.

**Conseguenza**: resta vero quello che dice ADR-0048: chi cambia una frase
del motore la cambia anche in `warnings.test.ts`.

## ADR-0066 — Modalità tasca: schermo acceso ma nero, invece della posizione in background
**Stato**: Attiva · 2026-09-26 · strada scelta dall'utente; dettagli decisi
dall'agente su delega dell'utente (TASK-070)

L'utente vuole le indicazioni a voce col telefono in tasca. La posizione in
background di `expo-location` non funziona in Expo Go («You must use a
development build»), e una build propria su iPhone da Windows richiede
l'account Apple Developer a pagamento. L'utente ha scelto la «modalità
tasca».

**Decisione**:
- durante la navigazione, «Pocket» accanto a «Stop»: lo schermo resta
  acceso (`expo-keep-awake`, tag `pocket-mode`), la luminosità dell'app va
  a 0 (`expo-brightness`), un `Modal` nero copre tutto e ignora i tocchi;
  si esce solo **tenendo premuto 2 secondi** (`HOLD_MS`), con la scritta
  «Hold for 2 seconds to leave pocket mode» e «Keep holding…» mentre si
  preme. Il tasto indietro di Android non esce;
- la prima volta per avvio dell'app, un avviso con «Cancel» / «Go dark»:
  bloccare il telefono o premere il tasto laterale ferma le indicazioni;
- la luminosità torna com'era all'uscita, all'arrivo, con «Stop» e quando
  l'app va in background; su iOS anche quando l'app è solo «inactive»
  (centro di controllo, tasto laterale), perché la luminosità impostata
  dall'app resta fino al blocco del telefono anche fuori dall'app; se l'app
  torna attiva senza uscire, lo schermo si riabbassa;
- navigazione, voce, vibrazione, GPS e tolleranza «fuori tracciato»
  (ADR-0070) non cambiano: la modalità tasca è solo schermo.

**Scartata**: posizione in background (non va in Expo Go); una build
propria (costa); il nero senza abbassare la luminosità (su un LCD la
retroilluminazione resta accesa); un doppio tocco o uno swipe per uscire
(in tasca capitano); l'avviso salvato per sempre (servirebbe una
dipendenza di storage).

**Motivo**: l'app resta in primo piano, quindi tutto quello che già
funziona continua a funzionare, con due dipendenze Expo che vanno in Expo
Go.

**Conseguenza**: se l'utente blocca il telefono le indicazioni si fermano,
come prima. La mappa sotto il nero continua a seguire la posizione (è in
`App.tsx`, fuori dal task): costa un po' di batteria, stima nel task file.

## ADR-0074 — Modificare il contorno di un'immagine: parti e dettagli disegnati col dito
**Stato**: Attiva · 2026-09-28 · il cosa approvato dall'utente (aggiungere
una parte unita alla sagoma, dettagli come occhi attaccati alla linea e
fatti andata e ritorno, annullare; sempre un tratto solo); il come deciso
dall'agente su delega dell'utente (TASK-079)

Il contorno ricavato da un'immagine è solo la linea esterna (ADR-0068): il
gatto di TASK-072 non si riconosceva, e i dettagli interni si perdevano.
L'utente vuole completarlo a mano sull'anteprima (ADR-0069).

**Decisione**:
- **Il formato c'è già**: un dettaglio è uno `stroke` dei file dei contorni
  (TASK-037): parte dalla linea o da un dettaglio prima, il percorso lo
  segue e torna indietro; se finisce su un suo punto chiude un anello (un
  occhio). `parse_outline` controlla che niente si incroci: la linea resta
  una sola. Il motore non cambia: `plan_shape` disegna già i `strokes`.
- **La geometria la decide il motore**, in un modulo nuovo
  (`route_engine/outline_edits.py`, shapely come `image_outline.py`),
  con regole fisse:
  - *parte*: il disegno si chiude, si semplifica all'1% come il contorno e
    si unisce alla sagoma. Deve sovrapporsi (una parte che tocca solo in un
    punto farebbe due pezzi) e aggiungere almeno lo 0,5% dell'area. I buchi
    si perdono. I dettagli già fatti devono restare attaccati alla linea
    nuova, altrimenti `covers_detail`;
  - *dettaglio*: l'inizio si aggancia al punto più vicino della linea o di
    un dettaglio entro il 6% della sagoma (il dito non è preciso), e i
    punti fatti scorrendo sulla linea si lasciano; dove il disegno si
    incrocia da solo si chiude l'anello e il resto si lascia; se la fine
    torna entro il 3% da un suo punto, l'anello si chiude lì. Poi la
    semplificazione all'1%, anello e gambo ognuno per sé;
  - limiti: al più 100 angoli per il contorno, 50 punti per tutti i
    dettagli insieme (ognuno si fa due volte), 2000 punti per un disegno;
  - **un disegno lontano dalla linea si collega, non si rifiuta**
    (seconda prova sull'iPhone, 2026-09-30: l'utente vuole disegnare dentro
    l'immagine): una linea aperta prende un tratto dritto dal punto più
    vicino al suo capo più vicino; una forma chiusa che non si sovrappone
    alla sagoma, o che ci sta dentro, diventa un anello appeso;
  - **le linee disegnate possono incrociarsi** e incrociare il contorno
    (scelta dell'utente, 2026-09-30: «a me va bene se si incrociano»):
    `parse_outline` ha `allow_crossings`, usato solo per i contorni
    modificati a mano; per i file dei contorni il controllo resta. Provato
    a Milano, 10 km, con un occhio, una bocca e due linee che incrociano:
    10,1 km, somiglianza 0,92; con tanti tratti interni il disegno si
    riconosce meno, e l'andata e ritorno fa a volte un piccolo anello
    (TASK-071);
  - un rifiuto ha un motivo in una parola: `short`, `covers_detail`,
    `too_many_corners`.
- **L'API non tiene stato**: `POST /image-outline-edits` riceve il contorno
  mostrato, nella cornice della foto (`image_points`, `image_strokes`,
  `aspect`), il tipo e la linea disegnata, e risponde con un
  `ImageOutline` nuovo, che ha anche `strokes` e `image_strokes`. Il motore
  lavora con x a destra e y in alto, in altezze della foto, così un
  cerchio su una foto larga resta un cerchio. Il rifiuto è `422`
  `outline_edit_rejected` con `reason`.
- **«Undo» è dell'app**: la pila dei contorni di prima, senza chiamare
  l'API. Una foto nuova azzera la pila.
- **`/image-route-jobs` e `/gpx` accettano `strokes`**, facoltativo, e lo
  controllano come il contorno (numeri finiti, dentro [-1, 1], al più 50
  punti, poi `parse_outline` con i dettagli). Un'app o un'API più vecchie
  vanno come prima: senza `strokes` il contorno è quello di TASK-073.
- **App**: «Edit the outline» apre una lavagna a tutto schermo (`Modal`),
  fuori dalla pagina che scorre, con «Add a part», «Add a detail», «Undo».
  Un dito disegna con un pulsante acceso, due dita ingrandiscono (fino a 8
  volte) e spostano; le linee restano larghe uguali. Tutto con i gestori di
  tocco di React Native (nessuna dipendenza nuova). I punti più vicini
  dell'1% della foto, diviso l'ingrandimento, si lasciano prima di
  mandarla. Le azioni arrivano al pannello dell'immagine con un contesto
  React, senza passare dal pannello del percorso. Prima prova sull'iPhone
  (2026-09-28): disegnando sull'anteprima dentro la pagina, la pagina
  scorreva; l'utente ha chiesto la lavagna a tutto schermo e lo zoom.

**Motivo**: il formato e il disegno dei tratti ripassati esistevano già
(gatto, pesce, testa di cane): basta produrli. Decidere nel motore tiene il
principio (il percorso lo decide il motore, e ora anche cosa diventa un
disegno) e rende tutto provabile con test deterministici. Rifiutare invece
di aggiustare di nascosto: il motivo dice come ridisegnare.

**Conseguenza**: prova da capo a fondo con il motore vero, Milano, 10 km:
una testa disegnata, due orecchie aggiunte, un occhio ad anello: 9,3 km,
somiglianza 0,96, in 3 s, una linea sola. Non si cancella una parte e non si spostano punti: per
togliere c'è solo «Undo». Un dettaglio che esce dalla sagoma è ammesso se
non incrocia la linea (baffi, antenne).

## ADR-0075 — Lo stile delle lettere nella richiesta e nell'app
**Stato**: Attiva · 2026-09-28 · chiesto dall'utente dopo TASK-077
(«tutti e due gli stili, da scegliere nell'app»); forma del campo, nomi e
testi decisi dall'agente su delega dell'utente (TASK-080)

**Contesto**: il motore scrive le parole in due stili (ADR-0072), ma
`style` era solo un argomento di `plan_route`: `RouteRequest`, API, CLI
delle partenze vicine e app non lo conoscevano.

**Decisione**:
- `RouteRequest.style`, `"round"` per difetto, controllato lì come gli
  altri campi: uno stile che non c'è, o `"block"` con una forma, è
  `InvalidRequestError`. `plan_route(style=None)` usa quello della
  richiesta; `ShapeJob.of_request` (partenze vicine, ADR-0071) pure.
- Nell'API `style` è un campo facoltativo di `RouteRequestBody`, passato
  com'è: lo controlla il motore. Non c'è in `ImageRouteRequestBody`.
- In `shared-types`: `LETTER_STYLES`, `LetterStyle`, `style?` nel
  `RouteRequest` (solo `"round"` per una forma); `contract.json` ha
  `styles`, confrontato dai test del motore e dei tipi.
- Nell'app, sotto il campo della parola, un `Segmented` «Round | Square»:
  «Square» perché «block» a un utente non dice niente. «Round» all'avvio,
  non salvato (servirebbe una dipendenza di storage). La parola parte
  sempre con `style`.

**Alternative scartate**: un campo `word_style` separato (un nome in più
per la stessa cosa del motore); lo stile scelto dall'API secondo la
griglia delle vie (è una scelta dell'utente, non del motore); il selettore
anche per le forme (non hanno lettere).

**Conseguenza**: un'app vecchia che non manda `style` ha le lettere di
prima; un'API vecchia rifiuta `style` (`extra="forbid"`): app e API vanno
aggiornate insieme, come per ogni campo nuovo.

---

## ADR-0078 — L'app pubblicata con EAS Update, aperta da Expo Go

**Data**: 2026-09-28 · **Task**: TASK-083 · **Stato**: accettata ·
strada scelta dall'utente (tramite `PASSAGGIO.md`); `expo-updates`
approvato dall'utente; dettagli decisi dall'agente su delega dell'utente

L'utente vuole aprire l'app dall'iPhone senza tenere acceso Expo sul PC.

**Decisione**:

- **EAS Update** sul progetto Expo `@lppl1316/shaperoute` (account
  personale dell'utente, non il team: Expo Go su iPhone apre solo i
  progetti dell'account con cui si entra). `expo-updates` ~57.0.23,
  `runtimeVersion` `exposdk:57.0.0` (l'unica forma che Expo Go accetta),
  `updates.url` e `projectId` in `app.json`; nessun `eas.json`, finché non
  servono build.
- Si pubblica a mano sul branch `preview` (`DEPLOY.md` A.6), non dalla CI:
  servirebbe `EXPO_TOKEN` fra i segreti di GitHub (proposta a parte).
- L'indirizzo dell'API viene da `EXPO_PUBLIC_API_URL` al momento della
  pubblicazione, salvato come variabile dell'ambiente `preview` su EAS
  (visibilità «plain text»: finisce comunque nell'app), non nel `.env` del
  PC: chiunque pubblichi, da qualunque PC, usa lo stesso indirizzo (chiesto
  dall'utente). L'app ricava l'API dall'host di Expo **solo** con
  `__DEV__` (`devServerHost` in `apiUrl.ts`): un update pubblicato è un
  bundle di produzione servito da Expo, e il suo host non è il PC.

**Scartata**: `expo publish` (non esiste più); una build propria o
TestFlight (serve l'account Apple Developer); un indirizzo dell'API letto
da un file remoto a ogni avvio (più codice, un servizio in più).

**Motivo**: una dipendenza ufficiale Expo, nessun codice nuovo tranne
l'host, e Expo Go resta quello di oggi.

**Conseguenza**: indirizzo e chiave dell'API sono dentro l'update,
leggibili da chi lo scarica; cambiare indirizzo o app vuol dire
ripubblicare. Con `expo start --no-dev` l'app non ricava più l'API
dall'host di Expo: serve `EXPO_PUBLIC_API_URL`.

## ADR-0079 — Più soggetti in una foto: fino a 4, appesi con un collegamento nel punto più vicino
**Stato**: Attiva · 2026-09-30 · il cosa deciso dall'utente (al più 4
soggetti, oltre la foto è rifiutata; il collegamento si vede sulla mappa,
fatto andata e ritorno; si collega «nel punto meno problematico per non
intaccare il disegno», cioè dove i soggetti sono più vicini); il come
deciso dall'agente su delega dell'utente (TASK-084)

Una foto con più soggetti era rifiutata (`scattered`, ADR-0068), o ne
restava solo il più grande. L'utente, provando TASK-079, vuole che si
disegnino tutti.

**Decisione**:
- **Il formato c'è già**: un soggetto in più è uno `stroke` con l'anello in
  fondo (TASK-037, ADR-0074). Il gambo è il collegamento, l'anello il
  contorno del soggetto. `parse_outline`, `plan_shape`, l'API e l'app li
  portano e li disegnano già: il lavoro è in `image_outline.py`.
- **Soggetto** è ogni pezzo sopra l'1% del più grande (la soglia delle
  macchioline di prima), tranne: un pezzo dentro un altro; un pezzo
  secondario tagliato dal bordo (prima si ignorava, e si ignora ancora: il
  bordo rifiuta solo il soggetto più grande); un pezzo che la lisciatura
  consuma. Sparisce la regola del 75%.
- **Una scala sola**: lisciatura e semplificazione usano il lato lungo di
  tutto il disegno, non del singolo soggetto. Sulla mappa la scala è una,
  e un soggetto piccolo non può avere più dettagli di quanti le strade ne
  disegnino. Con un soggetto solo il disegno è il soggetto: il contorno è
  quello di prima, punto per punto (verificato su 9 immagini contro il
  codice di `main`).
- **Il collegamento** è il tratto più corto fra il soggetto e tutto ciò
  che è già disegnato: contorno, soggetti e collegamenti di prima
  (`shapely.ops.nearest_points` sulle linee già semplificate). Si attacca
  ogni volta il soggetto più vicino al già disegnato. Per costruzione il
  tratto non attraversa niente: se attraversasse una linea, quella linea
  sarebbe più vicina. Il controllo severo di `parse_outline` (niente
  incroci) lo conferma a ogni foto.
- **Soggetti quasi attaccati diventano uno**: sotto il 2,5% del disegno,
  perché la semplificazione sposta ogni linea fino all'1% e due linee
  potrebbero toccarsi.
- **Limiti**: `MAX_SUBJECTS` = 4; oltre, `scattered`, lo stesso motivo con
  un testo nuovo («more than 4 separate things»): nessun valore nuovo nel
  contratto. Gli `strokes` dei soggetti hanno al più 150 punti
  (`MAX_SUBJECT_POINTS`), altrimenti `jagged`. `MAX_DETAIL_POINTS`, il
  limite di tutti gli `strokes` nell'API e nelle modifiche a mano, passa da
  50 a **200 punti percorsi** (`travelled_points`): un anello conta una
  volta, il gambo e un tratto senza anello due volte, andata e ritorno.
  Sono circa 100 punti di dettagli a mano senza anello: lo ha chiesto
  l'utente dopo i rifiuti `too_many_corners` provando TASK-079 (richiesta
  passata dalla sessione di TASK-079, con le sue misure: a Milano 100
  punti a zig-zag vanno a 5, 10 e 15 km; 120 falliscono a 15 km).
  Contare i punti percorsi tiene insieme le due cose: i soggetti, che si
  fanno una volta, pesano la metà di un dettaglio andata e ritorno.
  Misurato a Milano: 4 ingranaggi, 43 angoli più 118 punti di soggetti,
  a 10 e 15 km con somiglianza 0,99–1,00.

**Motivo**: riusare lo `stroke` ad anello tiene il principio (una linea
sola, decisa dal motore) senza toccare il motore dei percorsi né il
contratto. Il punto più vicino è quello che l'utente ha chiesto, ed è
anche il collegamento più corto da correre due volte.

**Conseguenza**: una foto con un pezzo secondario sopra l'1% (prima
ignorato) ora lo disegna come soggetto, con il suo collegamento. Il limite
resta un'approssimazione: a far fallire la distanza è la lunghezza dei
tratti ripassati, non il numero dei punti. Tre soggetti da 118 punti più
uno zig-zag fitto da 40 punti, dentro il limite, a Milano non si
disegnano né a 10 né a 15 km («does not fit», dopo l'attesa). «Add a part»
unisce solo al contorno principale: una parte disegnata sopra un soggetto
secondario diventa un anello appeso alla linea più vicina. Campioni a
12 km: a Milano somiglianza 0,96–0,98; a Levico 0,76–0,84, come le altre
forme con tratti in montagna.


## ADR-0081 — Comandi più visibili: bordo e fondo schiariti nei token
**Stato**: Attiva · 2026-09-30 · chiesto dall'utente («devono essere più
visibili i vari pulsanti, vedi tu come fare»); valori decisi dall'agente su
delega dell'utente (TASK-086)

**Contesto**: i comandi neutri (ADR-0046) avevano fondo `#1A1A1D` e bordo
`#33333A` sul fondo `#0A0A0B`: contrasto 1,1:1 e 1,6:1. Sull'iPhone,
all'aperto, un pulsante non si distingueva dal pannello.

**Decisione**: tre token cambiano, nessun file oltre `tokens.ts`:
`surfaceRaised` `#2B2B31`, `borderStrong` `#74747E` (4,3:1 sul fondo,
sopra il 3:1 chiesto a un comando), `border` `#3D3D44`. Tutti i comandi li
leggono già, quindi cambiano insieme: «Search», «My position», «Cancel»,
«Export GPX», − e +, l'opzione scelta di un interruttore, le tessere.

**Alternative scartate**: comandi gialli (il giallo è del percorso e di
«Draw route», ADR-0046); uno stile per pulsante, file per file (tocca file
di altri task e i comandi smettono di assomigliarsi); testo più grande
(non era il testo a mancare).

**Conseguenza**: anche i bordi dei campi e delle tessere sono più chiari.
Il testo sui comandi resta sopra 12:1.
## ADR-0080 — I luoghi suggeriti mentre si scrive
**Stato**: Attiva · 2026-09-30 · chiesto dall'utente («il suggerimento
della posizione, città, via, mentre sto scrivendo»); soglie e dettagli
decisi dall'agente su delega dell'utente (TASK-085)

**Contesto**: la ricerca del luogo partiva solo con «Search» o l'invio
(ADR-0029), per non mandare a Photon una richiesta a lettera.

**Decisione**: `PlaceSearch` cerca da solo quando il testo ha almeno 3
lettere e non cambia da 500 ms. «Search» e l'invio restano e cercano
subito; la pausa dopo non ripete la stessa ricerca. Si mostra solo la
risposta all'ultima ricerca chiesta; i suggerimenti di prima restano
sullo schermo finché arrivano i nuovi. Nessuna dipendenza nuova, stesso
servizio e stesso limite di 5 risultati.

**Alternative scartate**: una richiesta a ogni lettera (uso scorretto di
Photon, e risposte che si accavallano); togliere «Search» (con la rete
lenta è il modo di riprovare).

**Aggiunta dopo la prima prova dell'utente** (2026-09-30): «via bel» dava
una strada in Brasile. Quando la posizione GPS è nota (o, senza, l'ultimo
luogo scelto), va a Photon come `lat`/`lon`: i luoghi attorno vengono
prima. Photon risponde in circa 3 s: «Searching…» resta visibile.

**Conseguenza**: più richieste a Photon di prima, una per pausa. Se il
servizio dovesse limitare, la soglia e il ritardo sono due costanti.

## ADR-0082 — Il ritaglio della zona rifatto a mano, nello stesso ordine
**Stato**: Attiva · 2026-09-30 · il lavoro e il vincolo («percorsi
identici») chiesti dall'utente; il come deciso dall'agente su delega
dell'utente (TASK-087)

**Contesto**: l'API ritaglia a ogni richiesta il grafo dalla zona in
memoria (ADR-0030). `network.crop` passa due volte da una vista di
NetworkX, per trovare il pezzo connesso più grande e per copiarlo, e
intanto il garbage collector di Python ripassa più volte tutta la zona: a
Milano 2–5 s su questo Mac, 6–13 s sul PC di TASK-063.

**Decisione**:

- `route_engine/zone_crop.py`: `ZoneCrop(zona).crop(bbox)` costruisce il
  ritaglio dai dizionari della zona, senza viste. Dà il grafo di
  `network.crop` con nodi, archi e attributi **nello stesso ordine**,
  seguendo passo per passo quello che fa NetworkX (l'ordine di una vista,
  la visita in ampiezza dei pezzi, la copia). Dove NetworkX cambia ordine
  (un ritaglio con meno nodi della metà delle strade di un incrocio) lascia
  il lavoro a `network.crop`.
- Il ritaglio ha dizionari **suoi**, anche per gli attributi: ogni
  richiesta ha ancora il suo grafo e la zona non viene mai modificata. Il
  nodo «sink» di `_route_through_zones` e le richieste in parallelo restano
  com'erano; motore e `nearby_starts.py` non si toccano.
- `ZoneGraphs` sospende il garbage collector durante il ritaglio
  (`_gc_paused`, con un contatore per i ritagli contemporanei) e lo
  riaccende alla fine se era acceso. La raccolta è solo rimandata.
- `network.crop` resta: lo usa la CLI, ed è il riferimento dei test.

**Scartate**:

- *Nessun ritaglio: il motore sulla zona intera o su una vista.* L'ordine
  dei nodi e degli archi cambierebbe, e con lui i percorsi a parità di
  costo; una vista rende più lento ogni Dijkstra; il «sink» finirebbe nel
  grafo condiviso dalle richieste in parallelo.
- *Tenere il ritaglio per la stessa area.* Le partenze dal GPS cambiano a
  ogni richiesta (l'area è arrotondata a 10 m), e un grafo riusato andrebbe
  protetto dal «sink» di chi lo sta usando.
- *Attributi condivisi con la zona* (senza copiarli): 0,1 s in meno, ma un
  attributo cambiato da una richiesta arriverebbe a tutte le altre.

**Perché così**: i percorsi dipendono dall'ordine nel grafo, non solo dal
suo contenuto. Rifare lo stesso grafo più in fretta è l'unica strada che
non tocca né il motore né quel che vede.

**Conseguenza**: `zone_crop.py` dipende da come NetworkX 3 ordina viste e
visite. Se una versione nuova lo cambia, `test_zone_crop.py` fallisce (il
confronto è con `network.crop` nello stesso processo): si aggiorna
`ZoneCrop`, o si torna a `crop` in `graphs.py`, una riga. Una zona in
memoria non va modificata dopo essere stata data a `ZoneCrop`.

## ADR-0083 — Suggerimenti dei luoghi: risposte intermedie e tocco che chiude
**Stato**: Attiva · 2026-09-30 · chiesto dall'utente («la ricerca è lenta,
il suggerimento non riesco a premerlo»); deciso dall'agente su delega
dell'utente (TASK-089). Modifica ADR-0080.

**Contesto**: Photon risponde in 2–3 s, tempo del server. Con ADR-0080 si
mostrava solo la risposta all'ultima ricerca: chi continuava a scrivere
non vedeva nulla per 5–6 s. Dopo il tocco su un suggerimento il campo
restava col testo parziale, e un tocco entro la pausa faceva ripartire la
ricerca e riaprire l'elenco.

**Decisione**: le ricerche sono numerate e una risposta con dei luoghi si
mostra se è più nuova di quella sullo schermo, anche con un'altra in
corso; «No place found» e l'errore solo per l'ultima. La pausa scende da
500 a 300 ms. Al tocco il campo prende il nome del luogo, la tastiera si
chiude, le risposte in arrivo si scartano e quel testo non si cerca.

**Alternative scartate**: una richiesta a lettera (ADR-0080); cambiare
servizio o ospitare Photon (scelta dell'utente, fuori dal task).

**Conseguenza**: qualche richiesta in più a Photon. I suggerimenti possono
essere per il testo di un attimo prima, finché arriva la risposta nuova.

## ADR-0090 — Il punteggio di una corsa: somiglianza del percorso per fedeltà
**Stato**: Attiva · 2026-09-30 · il punteggio chiesto dall'utente; il come
deciso dall'agente su delega dell'utente (TASK-111)

**Contesto**: l'utente vuole un punteggio per il disegno corso, «in base
alla somiglianza». Il task proponeva di confrontare la traccia GPS con la
forma ideale, con `shape_similarity`. Ma la forma piazzata (ruotata,
scalata, per le parole con le lettere spostate) non esce dal motore:
`RouteResult` porta i punti del percorso e la sua somiglianza, e così API
e app. Parole e immagini poi non usano la stessa misura delle forme.

**Decisione** (`track_score.py`):
- **Punteggio = arrotonda(100 · somiglianza del percorso · fedeltà).** La
  fedeltà è la media armonica fra la quota del percorso pianificato con la
  traccia entro 40 m e la quota della traccia entro 40 m dal percorso.
- **40 m**, come `OFF_ROUTE_M` dell'app (ADR-0070): chi non ha mai sentito
  «Off the route» non perde punti.
- **Pulizia prima del confronto**: errore oltre 40 m, passi sotto 1 m,
  salti oltre 12 m/s (solo con gli orari).
- **Niente punteggio** sotto 2 posizioni buone o sotto il 10% della
  lunghezza del percorso: un errore con il motivo, non uno zero.
- CLI: `--score-track FILE`, che ripianifica il percorso della richiesta.

**Scartata**: *traccia contro forma piazzata, con la somiglianza del
motore.* Chiede di portare il piazzamento nel contratto (API,
`shared-types`, app) e una strada diversa per parole e immagini; e la sua
tolleranza, il 2% del perimetro, a 15 km è 300 m: chi corre la via
parallela prenderebbe lo stesso voto.

**Conseguenze**: chi corre il percorso per intero prende il voto del
percorso, mai di più: una forma che le strade disegnano male ha un tetto
basso anche corsa bene. Chi devia e disegna la forma *meglio* del piano
perde punti. Il punteggio non riconosce una traccia finta o fatta in bici:
annotato, non fatto. TASK-113 deve mandare all'API punti e somiglianza del
percorso; presa dall'app, la somiglianza si può falsare: TASK-117 la
ricalcola o la conserva col percorso.

## ADR-0085 — Il registro delle richieste dell'API, spento per default
**Stato**: Attiva · 2026-09-30 · la funzione è chiesta dall'utente («serve
a correggere i difetti e non si vede nell'app»); tutto il resto deciso
dall'agente su delega dell'utente (TASK-090)

**Contesto**: in TASK-075 l'utente ha visto sull'iPhone un cuore brutto a
Caldonazzo e non si è potuto rifare: la partenza era il GPS del telefono, e
25–100 m portano la somiglianza da 0,73 a 0,92. L'API non tiene niente
delle richieste. La richiesta contiene la posizione di chi la fa.

**Decisione**:
- Un modulo nuovo, `shaperoute_api/request_log.py`: una riga JSON (JSON
  Lines) per ogni richiesta di percorso finita, in
  `data/requests/requests.jsonl`, fuori dal repository (`.gitignore`), con
  ora, tipo, id del job, il corpo com'è arrivato (`model_dump` del corpo
  già controllato) e l'esito: distanza, somiglianza, secondi, numero di
  punti e un'impronta SHA-256 dei punti; oppure il solo codice dell'errore.
- **Spento per default**; acceso con `--request-log` o
  `SHAPEROUTE_REQUEST_LOG=1`. Acceso per default sarebbe una scelta
  dell'utente (le posizioni restano su disco): non è stata presa qui.
- La riga si scrive nel thread del job, **dopo** che il job ha la sua
  risposta (`on_end` di `RouteJobs`): l'app non aspetta il disco. Ogni
  errore di scrittura è un avviso nel log, senza il corpo; un ascoltatore
  che fallisce non cambia l'esito del job.
- Tetto: a 5 MB il file diventa `requests.old.jsonl` e ne parte uno nuovo;
  al massimo 10 MB. File creato con permessi `0600`, cartella `0700`.
- Si registrano solo le richieste di percorso (`/route-jobs`,
  `/image-route-jobs`, `/routes`). Niente intestazioni, chiave, indirizzo
  del client, foto, punti del percorso, messaggio dell'errore.
- `python -m shaperoute_api.replay`: legge una riga (`--job`, `--line`, o
  l'ultima), ricostruisce la richiesta con `to_request`, la dà a
  `plan_request` sui grafi in cache e confronta l'impronta; codice di
  uscita 1 se il percorso non è quello registrato; `--gpx` lo scrive.

**Alternative scartate**: registrare dentro `data/cache` (la cache si copia
a un collega, `PASSAGGIO.md`: porterebbe con sé le posizioni); scrivere la
riga all'arrivo della richiesta e l'esito in una seconda riga (due righe da
ricomporre; si perde solo la richiesta in corso se l'API muore); salvare
tutti i punti del percorso (file cento volte più grande: l'impronta basta a
dire «uguale», e il percorso si rifà); un middleware HTTP (vedrebbe
intestazioni e foto); `logging.handlers.RotatingFileHandler` (non crea il
file con permessi ristretti).

**Conseguenza**: un percorso si rifà uguale finché motore e grafi in cache
sono gli stessi; se cambiano, il replay lo dice. Il motore non usa le
partenze vicine quando la memoria libera è poca (ADR-0071): in quel caso un
replay può dare un percorso diverso da quello registrato. Su un server il
file conterrebbe le posizioni di tutti gli utenti: `DEPLOY.md` lo dice.
Un'API su più processi scriverebbe nello stesso file da più parti: oggi è
un processo solo.

## ADR-0091 — La traccia della corsa: registrata nella navigazione, in un file
**Stato**: Attiva · 2026-09-30 · la traccia chiesta dall'utente per il
punteggio; il come deciso dall'agente su delega dell'utente (TASK-112)

**Contesto**: il punteggio (ADR-0090) vuole la traccia GPS della corsa.
L'app riceve già le posizioni durante la navigazione (`useNavigation`), con
lo schermo acceso o in modalità tasca; a telefono bloccato Expo Go non le
dà.

**Decisione**:
- `trackRecorder.ts`, puro: tiene una posizione se ha errore entro 40 m
  (`POOR_FIX_M`, ADR-0070), è ad almeno 5 m dall'ultima tenuta e non ha un
  orario precedente. Salti e velocità li giudica il motore (ADR-0090).
- `trackStore.ts`: un solo file, `current-run.json`, nei **documenti**
  dell'app (la cache il sistema la può svuotare), con `expo-file-system`
  già presente. Dentro: percorso pianificato, traccia, stato (`running`,
  `stopped`, `arrived`). Scritto alla prima posizione, poi al più ogni
  15 s, a «Stop» e all'arrivo. `running` trovato alla riapertura vuol dire
  app chiusa durante la corsa.
- **Riprendere senza chiedere**: «Start» sullo stesso percorso, con
  l'ultima posizione a meno di 30 minuti, continua la traccia; se no ne
  comincia una nuova, che sostituisce il file alla prima posizione tenuta.
- Un file che il telefono rifiuta non ferma né la navigazione né la
  traccia in memoria.

**Scartate**: *chiedere «riprendi o scarta» alla riapertura*: serve una
schermata in `App.tsx`, fuori dai file del task; va con la schermata di
fine corsa (TASK-113). *Più corse nel file*: per ora serve solo l'ultima;
i disegni salvati sono di TASK-117. *GPS in background*: serve una build
propria, non Expo Go.

**Conseguenze**: il file tiene i punti del percorso ma non la sua
somiglianza né la richiesta, che `useNavigation` non riceve: TASK-113, che
tocca `App.tsx`, deve passarle e salvarle. Una corsa da 21 km sono circa
4000 posizioni, mezzo MB riscritto ogni 15 s. Dopo la chiusura dell'app il
percorso sullo schermo non c'è più: la traccia resta nel file ma si
riprende solo se l'app ridisegna lo stesso identico percorso.

## ADR-0092 — Nessuna posizione nel log dell'API
**Stato**: Attiva · 2026-09-30 · chiesto dall'utente («togli le partenze
dal log a schermo dell'API»); il come deciso dall'agente su delega
dell'utente (TASK-091)

**Contesto**: da TASK-076 il motore scriveva nel log, per ogni richiesta di
forma o parola, le coordinate della partenza e delle partenze vicine
provate («start 0 (45.9934, 11.258): score…»), e l'errore di una partenza
vicina che non disegna le ripeteva («from (45.99…)»). Emerso in TASK-090.

**Decisione**: `nearby_starts.py` scrive «start N: score…, approach … m»
senza coordinate, e l'errore dice «from this start». Restano il numero
della partenza e i metri di avvicinamento, che bastano a leggere la scelta.
Per rifare una richiesta c'è il registro (ADR-0085), che è spento finché
non lo si accende.

**Non toccato**: il log dice ancora quale file di grafo è stato letto
(`foot_45.97750_11.24860_….graphml`): è il nome del file in cache, cioè il
riquadro di una zona larga chilometri, non la partenza. Cambiarlo tocca
`graphs.py` / `network.py` e i nomi della cache.

**Conseguenza**: chi legge il log non vede più dove si trova l'utente;
per sapere la partenza di una richiesta serve il registro.

## ADR-0093 — Il punteggio a fine corsa: l'API lo calcola, l'app tiene la corsa
**Stato**: Attiva · 2026-09-30 · la schermata chiesta dall'utente; il come
deciso dall'agente su delega dell'utente (TASK-113)

**Contesto**: il motore sa dare il punteggio (ADR-0090) e l'app registra la
traccia (ADR-0091). Manca il giro: chiedere il punteggio e mostrarlo.

**Decisione**:
- **`POST /track-scores`**: punti e somiglianza del percorso più le
  posizioni della corsa; risponde il `TrackScore` del motore. Niente grafo,
  niente stato. La corsa troppo corta è `422 invalid_request` con il motivo
  del motore: nessun codice d'errore nuovo.
- **La somiglianza la manda l'app**, che l'ha avuta col percorso: senza
  account non c'è niente da difendere. Quando il punteggio si salva o si
  pubblica (TASK-117) il server non può fidarsi: va ricalcolata o tenuta
  col percorso.
- **La traccia porta con sé la somiglianza**: `useNavigation` la riceve e
  `trackStore` la scrive nel file (campo facoltativo, la versione resta 1).
- **Fine corsa**: «Stop»/«Finish» chiama `endRun()`, che scrive subito il
  file e restituisce la corsa; la schermata è `FinishCard` dentro
  `MapScreen`, con la mappa che disegna la corsa sopra il percorso (un
  secondo strato, `showTrack`, colori dal token `track`).
- **La corsa si cancella solo dopo il punteggio** (o se è troppo corta).
  Senza rete resta nel file, e alla riapertura l'app parte dalla schermata
  di fine corsa: è la risposta a «riprendi o scarta» rimandata da TASK-112.
  Riprendere la navigazione dopo aver chiuso l'app no: il percorso e le
  indicazioni non sono nel file.

**Scartate**: *calcolare il punteggio nell'app*: sarebbe una seconda copia
della misura del motore, in un altro linguaggio. *Un codice d'errore
`track_not_scorable`*: l'app non chiede altro a questo endpoint che possa
essere rifiutato. *Una domanda «riprendi o scarta» all'avvio*: la schermata
di fine corsa dice già tutto, e «Done» la chiude.

**Conseguenze**: toccati anche file fuori dall'elenco del task, detti nella
PR: `src/map/` (la linea della corsa), `theme/tokens.ts` (il token
`track`), `trackStore.ts` e `useNavigation.ts` (la somiglianza, `endRun`),
i test accanto, e due fixture in `shared-types`. Una corsa senza punteggio
blocca l'avvio sulla schermata di fine corsa finché l'API non risponde o
un'altra corsa la sostituisce.


## ADR-0086 — Tutti i percorsi generati si salvano, i migliori si consigliano
**Stato**: Attiva · 2026-10-01 · **scelta dell'utente** (TASK-092). Il
numero è uno di quelli lasciati liberi (0086 … 0089, `PASSAGGIO.md`), per
non scontrarsi con gli ADR che TASK-110 sta per scrivere.

**Contesto**: l'utente vede percorsi diversi a ogni richiesta (la partenza
GPS si sposta di 25–100 m, TASK-075) e vuole tenere quelli venuti
benissimo. Con la parte social (TASK-110 … 122) vuole un archivio delle
ricerche di tutti, per consigliare i percorsi migliori agli utenti e usarli
sui social del progetto. Proposta dell'agente: salvare e consigliare solo i
percorsi che l'utente sceglie di condividere.

**Decisione dell'utente**: si salvano **tutti** i percorsi generati, senza
che l'utente scelga; i migliori si consigliano agli altri e si usano sui
social. Motivo, con le sue parole: chi corre passa su strade pubbliche,
al massimo davanti alla casa di un altro, senza fare male a nessuno; e
consigliare i percorsi serve anche a **ripopolare strade di solito poco
frequentate**.

**Conseguenza**:
- Serve il database (TASK-114) e l'API sempre accesa (TASK-122): sul Mac
  il registro delle richieste (ADR-0085) raccoglie già le richieste
  dell'utente, non quelle degli altri.
- La partenza di un percorso salvato è spesso dove abita chi l'ha chiesto.
  Resta da decidere con TASK-110 (punto 6, «Dati personali») cosa dice il
  testo della privacy e se un percorso consigliato si mostra partendo da
  un punto del giro invece che dalla partenza vera.

**Aggiunta** (2026-10-01, scelta dell'utente): due percorsi di qualità
uguale si tengono e si propongono **tutti e due**; nessuno dei due passa
davanti all'altro perché tocca strade meno frequentate (era la proposta
dell'agente, scartata).

## ADR-0095 — I luoghi da Geoapify, attraverso l'API
**Stato**: Attiva · 2026-10-01 · servizio scelto dall'utente («Geoapify
via l'API»); dettagli decisi dall'agente su delega dell'utente
(TASK-123). Modifica ADR-0029 per i suggerimenti della partenza.

**Contesto**: Photon pubblico risponde in 2–4 s (misurato il 2026-09-30 e
il 2026-10-01, quasi tutto tempo del server). Nominatim è veloce ma le sue
regole vietano l'autocompletamento.

**Decisione**: `GET /places` nell'API chiede l'autocompletamento di
Geoapify con la chiave `GEOAPIFY_API_KEY`, che resta sull'API. Stesse
etichette di Photon («nome, area»), al più 5 luoghi, `lat`/`lon` come
`bias=proximity`. Cache in memoria di 500 ricerche per un'ora, chiave del
testo in minuscolo a spazi singoli e del punto arrotondato a 0,01°.
Richiesta con `urllib` della libreria standard: nessuna dipendenza nuova.
Il corpo è in `packages/shared-types/fixtures/places.json`, letto dai test
dell'API e dell'app; senza tipo nuovo in `shared-types` (`Place` resta in
`photon.ts`). L'app chiede all'API con 2,5 s di tempo; se manca, è lenta o
dà errore usa Photon; dopo un 503 (niente chiave) non la richiede fino al
riavvio. Senza chiave, `503 http_error`: nessun codice d'errore nuovo.

**Alternative scartate**: la chiave nell'app (`EXPO_PUBLIC_…`): chiunque
la legge dal pacchetto pubblicato; MapTiler e Photon sul Mac (scelta
dell'utente); un codice d'errore `places_unavailable` (tocca il contratto
per un caso che l'app tratta come ogni altro errore).

**Conseguenza**: con l'API spenta la ricerca resta su Photon, lenta. Il
piano gratuito di Geoapify regge 3000 ricerche al giorno, una per pausa
di scrittura, meno quelle in cache.

## ADR-0096 — Nessuna query string nel log di accesso dell'API
**Stato**: Attiva · 2026-10-01 · deciso dall'agente su delega dell'utente
(TASK-124), su segnalazione della sessione di TASK-090/091.

**Contesto**: con TASK-123 l'app chiama `GET /places?q=…&lat=…&lon=…`, e
il log di accesso di uvicorn scrive l'URL intero: la posizione
dell'utente tornava nel log dell'API, che non ne deve avere (ADR-0092).

**Decisione**: un filtro sul logger `uvicorn.access`
(`shaperoute_api/access_log.py`), messo all'avvio, toglie la query string
da ogni riga: restano metodo, percorso e stato. Vale per tutti gli
endpoint, così un parametro nuovo non può riportare dati nel log.

**Alternative scartate**: `lat`/`lon` in un `POST` (cambia il contratto
appena usato dall'app pubblicata); arrotondarli a 1 km prima di mandarli
(nel log resterebbe comunque la zona, e il testo cercato).

**Conseguenza**: nel log non si legge più cosa è stato cercato. Le righe
scritte prima del filtro restano nel file finché non si cancellano.


## ADR-0097 — Il seme del catalogo dei percorsi consigliati
**Stato**: Attiva · 2026-10-01 · scelta dell'utente (13 città, variante C
di TASK-092); il come deciso dall'agente su delega dell'utente (TASK-125)

**Contesto**: la schermata «Explore» di TASK-092 mostra i percorsi
migliori vicino a chi guarda. Finché nessuno ne ha generati, sarebbe vuota
proprio all'arrivo dei primi utenti. Un catalogo per tutta l'Italia costa
ore di download da Overpass, e quasi tutto resterebbe lontano dagli utenti.

**Decisione**:
- **Un seme, poi la crescita dagli utenti**: 13 città (Trento, Levico,
  Milano, Roma, Torino, Bologna, Firenze, Napoli, Verona, Padova, Genova,
  Bari, Palermo), dal centro (una piazza, mai la posizione di qualcuno),
  ogni forma del catalogo a 5, 10 e 21 km, pianificate come l'API
  (`plan_nearby`). Il resto lo portano i percorsi degli utenti (ADR-0086).
- **Si tiene da 0,88 di somiglianza in su**, tutti, anche se equivalenti
  (TASK-092, punto 3). La somiglianza non basta da sola (la zucca a 0,92
  giudicata «no», TASK-078): un campione per città si guarda a occhio.
- **Nei file, non nel database**: `catalog/seed/<città>.json`, un file per
  città, ricostruito ogni volta dal registro delle prove
  (`out/seed_catalog/runs.jsonl`, fuori dal repository). Si caricano nel
  database con TASK-114. Coordinate a 6 decimali.
- **La licenza dei dati è nel file**: i percorsi stanno su strade di
  OpenStreetMap (ODbL): chi li pubblica, anche sui social, cita
  «© OpenStreetMap contributors».
- **Lo script è nel motore** (`route_engine/seed_catalog.py`): usa il
  motore e basta, gira senza API né chiavi; in `tools/` la CI ha solo la
  libreria standard.

**Alternative scartate**: tutta l'Italia subito (8000 comuni, percorsi che
nessuno vede, mappe che invecchiano); solo le zone già in cache (tre città
del nord).

**Conseguenza**: una partenza per città: chi è a 5 km dal centro non ha
ancora niente vicino. Il registro locale serve per rifare la selezione con
un'altra soglia senza ripianificare.

**Aggiunta (2026-10-01, scelta dell'utente)**: anche **le frasi** e **New
York** (Union Square, sulla griglia di Manhattan). Ogni città ha le sue
parole, nella lingua del posto (`PHRASES`): CIAO, TIAMO, GRAZIE, BUONDI,
NOTTE, AMORE, HELLO in Italia, più quelle locali (UELA a Milano, CEREA a
Torino, AO e AMOR a Roma, BONA a Firenze, UAGLIO e AMMORE a Napoli, ROMEO a
Verona, UE a Bari, AMURI a Palermo); HELLO, ILOVENY, THANKS, LOVE, HEY, NYC
a New York. Il motore scrive solo A–Z, senza spazi, al più 7 lettere a
21 km: BUONGIORNO e BUONANOTTE non ci stanno, BUONDI e NOTTE sì. Una parola
si scrive a 3,75 km a lettera (come CIAO a 15 km), da 5 a 21 km, nei due
stili, tonde e squadrate; nel catalogo ha `word` e `style` invece di
`shape`.

**Aggiornamento 2026-10-02** (deciso dall'agente su delega dell'utente,
TASK-161): anche le parole si guardano a occhio, una per città e stile, e
quelle che non si leggono restano fuori come le forme: `UNREADABLE_WORDS`,
terne (città, parola, stile), accanto a `UNREADABLE`. Una parola tolta da
`PHRASES` (ADR-0130) resta nel registro ma non entra più nel catalogo. Le
forme illeggibili delle città nuove vanno in `UNREADABLE` come le altre.
Prima di scaricare la zona di una città, se la zona di ogni suo caso è già
in cache (per esempio costruita sul server dall'estratto Geofabrik,
TASK-137) non si scarica niente: Genova, Bari, Palermo e New York sono
entrate così, con Overpass che rifiutava il Mac.

## ADR-0098 — «Explore» dal catalogo, prima del database
**Stato**: Attiva · 2026-10-01 · variante C scelta dall'utente (TASK-092);
il come deciso dall'agente su delega dell'utente (TASK-126)

**Contesto**: l'utente ha chiesto di programmare «Explore» e provarlo
subito. Il database (TASK-114) non c'è ancora; il seme del catalogo sì
(ADR-0097).

**Decisione**:
- **L'API serve i file di `catalog/seed/`**, letti all'avvio:
  `GET /recommended-routes` (vicino a un punto, con l'anteprima) e
  `GET /recommended-routes/{id}` (intero). Con TASK-114 la stessa API
  leggerà dal database: il contratto resta.
- **L'anteprima la calcola l'API** (64 punti), così la lista pesa poco; la
  miniatura nell'app sono segmenti di `View` ruotati: nessuna dipendenza
  nuova (niente `react-native-svg`).
- **Una terza schermata**, oltre alle due di TASK-051, nello stesso stato
  di `App.tsx`, senza librerie di navigazione.
- **Niente «Start»** sui percorsi di «Explore»: non hanno le indicazioni di
  svolta. Restano mappa e GPX.
- **I tipi nell'app** (`src/explore/recommendedRoutes.ts`), non in
  `shared-types`, come `Place` (TASK-123): `shared-types` è toccato da
  un'altra PR aperta (TASK-088).

**Conseguenza**: «Explore» mostra solo le città del seme, a 5 km dal
centro; altrove dice che non ci sono ancora percorsi. Nell'immagine Docker
`catalog/` non c'è: là la lista è vuota finché non la si copia.

## ADR-0087 — Più percorsi fra cui scegliere: le partenze vicine non si buttano
**Stato**: Attiva · 2026-10-01 · come si vedono, quanti e le immagini
sono **scelte dell'utente**; il resto deciso dall'agente su delega
dell'utente (TASK-093). Numero preso fra quelli lasciati liberi (0086 …
0089, `PASSAGGIO.md`).

**Contesto**: dalla stessa partenza il percorso è sempre lo stesso, ma
pochi metri di GPS ne danno un altro, a volte più bello (TASK-075,
TASK-090). Il motore ne calcola già fino a 4 per richiesta (ADR-0071) e ne
tiene uno.

**Scelte dell'utente**: tessere «A · B · C» sotto la mappa, con gli altri
percorsi grigi sulla mappa (proposta A di tre); fino a 3 percorsi, solo se
diversi e con somiglianza non più di 10 punti sotto il migliore; le
alternative anche per le immagini, sapendo che possono costare tempo.

**Decisioni tecniche**:
- `route_engine/alternatives.py` (nuovo): sceglie fra i percorsi delle
  partenze provate. «Stesso percorso»: ciascuno entro 20 m dall'altro per
  il 90% della lunghezza (shapely, già dipendenza). `Plan.alternatives` e
  `RouteResult.alternatives`, con default vuoto: niente cambia per chi non
  li usa (CLI, test).
- Il percorso scelto non cambia. Dopo un piano già buono le vicine si
  aspettano al più 3 s (prima: per niente), altrimenti le alternative
  mancavano proprio sui percorsi venuti bene (Trento 12 km: tutte e tre le
  vicine «still running» dopo 1,5 s).
- Le immagini passano anch'esse da `plan_nearby` (`image_job`), con il
  piano di sempre per la partenza dell'utente; nelle misure il tempo è
  rimasto 1,5–2,8 s, e a Caldonazzo l'immagine è migliorata (0,75 → 0,85).
- API: ogni alternativa ha le sue indicazioni (`with_choices`), calcolate
  sugli stessi grafi; +0,03–0,15 s. `/routes` le manda senza indicazioni.
- Contratto: `alternatives?` facoltativo in `shared-types`, un'app o
  un'API vecchie funzionano come prima; `MAX_ALTERNATIVES` in un file di
  esempio nuovo (`route-alternatives.json`), per non toccare
  `contract.json`, modificato in quel momento da TASK-088.
- App: lo stato del percorso scelto (`Picked`) resta legato al risultato a
  cui appartiene, così un risultato nuovo riparte da A senza effetti.
  Navigazione, GPX e avvisi leggono il percorso scelto.

**Alternative scartate**: più ricerche apposta per avere alternative (più
tempo per ogni richiesta); mostrare tutti e 4 i percorsi senza filtri
(scelta dell'utente); alternative dalle prove interne della ricerca
(posizioni o rotazioni diverse dalla stessa partenza: spesso quasi uguali,
e senza la strada fatta per arrivarci).

**Conseguenza**: dove le partenze vicine sono poche o il grafo è troppo
grande (Milano, oltre 30 000 nodi, ADR-0071) le alternative mancano. Una
richiesta con piano buono può durare fino a 3 s di più.

## ADR-0099 — Una forma che passa dai luoghi veri di un tema, in ogni città
**Stato**: Attiva · 2026-10-01 · scelta dell'utente («forma + tappe», città
di tutto il mondo); il come deciso dall'agente su delega dell'utente
(TASK-129)

**Contesto**: l'utente vuole cercare qualsiasi città in «Explore» e
chiedere un percorso in parole («romantico a Parigi», «gastronomico a
Tokyo»), con luoghi veri e niente inventato, al costo più basso.

**Decisione**:
- **L'AI interpreta, i dati danno i luoghi, il motore il percorso**: il
  principio di `CLAUDE.md` resta. Tabelle di parole prima, AI solo per il
  tema che manca e vincolata a una lista; mai luoghi né coordinate.
- **I luoghi da Geoapify Places** (OpenStreetMap), con la chiave che
  c'è già: con un nome, Wikidata per dire «notevole». Niente ricerca
  libera su Internet: costa di più e non dà coordinate verificabili.
- **Le città dalla geocodifica per città**, non dall'autocompletamento
  (il centro vero, non quello dell'area del comune).
- **Forma + tappe nel motore** (`stops.py`): la forma pianificata da
  qualche partenza fra i luoghi, tenuta la più leggibile che ne tocca di
  più; dice quali tocca. Nessun cambio all'ottimizzatore.
- **Un job a parte** (`/themed-route-jobs`), non `/route-jobs`: il
  contratto dei percorsi resta com'è.

**Alternative scartate**: la ricerca web con un modello (luoghi e
coordinate non verificabili, costo per richiesta); un percorso a tappe
senza forma (scelta dell'utente); toccare `optimizer.py` per pesare i
luoghi nella ricerca (più rischio, da rivedere coi risultati).

**Conseguenza**: funziona dove le strade si scaricano. Da questo Mac
Overpass risponde solo da un indirizzo (`MAPS.md`): oggi solo le zone in
cache (Trento, Levico, Milano, Roma, Torino, Bologna); New York, Parigi,
Tokyo dopo TASK-127. Una forma tocca di solito 2–9 luoghi, non tutti.

## ADR-0100 — Overpass dall'indirizzo che risponde
**Stato**: Attiva · 2026-10-01 · via esplicito dell'utente; il come deciso
dall'agente su delega dell'utente (TASK-127)

**Contesto**: da questo Mac uno dei due indirizzi di `overpass-api.de`
rifiuta ogni connessione, e OSMnx usa sempre quello (MAPS.md). Ogni zona
nuova falliva: il catalogo fermo a 6 città, «Explore» a tema senza New
York, Parigi, Tokyo (TASK-125, TASK-129). Nel 2026-09-23 si era deciso di
lasciarlo così; l'utente ha chiesto di sistemarlo.

**Decisione**: un modulo del motore, `overpass_address.py`. Prima di un
download prova a connettersi agli indirizzi IPv4 del server nell'ordine del
resolver; per la durata del download `socket.gethostbyname` e
`socket.getaddrinfo` danno, per quel solo nome, il primo che risponde (come
fa già OSMnx per tenere lo stesso server). Il nome resta nell'URL: il
certificato HTTPS si controlla come sempre. Un lock: un download alla
volta. Se nessun indirizzo risponde, nulla cambia. Vale per i grafi e per
le vie con nome (`_overpass`).

**Alternative scartate**: un altro server Overpass (quelli provati non
rispondevano da qui); l'indirizzo nell'URL (il certificato non
corrisponderebbe); uno script fuori dal motore (non vale per l'API).

**Conseguenza**: il centro di Verona, mai scaricato, in 10 s. Il cambio è
globale al processo per la durata del download: altri nomi non sono
toccati.

## ADR-0101 — Le ricerche insegnano, ma solo con una firma
**Stato**: Attiva · 2026-10-01 · raccolta sempre accesa: scelta dell'utente;
il come deciso dall'agente su delega dell'utente (TASK-130)

**Contesto**: l'utente vuole che la ricerca migliori con le ricerche vere:
query frequenti, risultati mancanti, errori, città, lingue, segnali di
utilità. Senza modifiche automatiche rischiose, con versioni e rollback,
metriche, storia conservata, attenzione a privacy e costi.

**Decisione**:
- **Eventi, non log grezzi** (`shaperoute_api/insights/events.py`): una
  riga per ricerca e per segnale (GPX esportato, corsa con punteggio), in
  `data/insights/events-AAAA-MM.jsonl`, mai riscritti, leggibili solo dal
  proprietario. Testo in minuscolo, email e numeri lunghi oscurati, 200
  caratteri; posizioni solo come celle di 0,01° (~1 km); nessun
  identificativo. **Accesi di default** (scelta dell'utente); si spengono
  con `--no-insights` o `SHAPEROUTE_INSIGHTS=0`. `/places` non si registra
  (indirizzi digitati, ADR-0096).
- **Proposte da prove ripetute** (`analyze.py`): un sinonimo solo se l'AI
  ha letto la stessa frase allo stesso modo almeno 3 volte e mai
  diversamente, e se non contraddice le tabelle; una città se «Explore» vi
  è stato vuoto 3 volte; una frase se disegnata 3 volte. Le richieste mai
  capite e i temi senza luoghi sono proposte «review», per una persona.
- **Dati, mai codice** (`vocabulary.py`): ciò che si applica va in
  `shaperoute_api/learned/vocabulary.json`, nel repository, una versione
  per cambio con data, motivo e prove; `revert` aggiunge una versione, non
  cancella. Si applica solo a mano (`apply`), si rivede e si committa.
- **Dove agisce**: tabelle, poi vocabolario, poi AI, per i temi
  (`themes.read_with_ai`) e per le parole della forma (`/shape-readings`):
  ogni frase imparata è una chiamata al modello in meno.
- **Metriche per versione** del vocabolario (`report`): quota di letture
  dall'AI, temi sconosciuti, successo dei percorsi a tema e tappe toccate,
  «Explore» vuoto, GPX per percorso. Ogni evento porta la versione.
- **Nessun costo**: l'analisi gira sul Mac, sui file; niente AI né servizi.

**Alternative scartate**: un database (non c'è ancora: TASK-114); modifiche
automatiche al vocabolario o al codice (rischio, scelta dell'utente);
imparare dalla prima risposta dell'AI (una risposta può essere sbagliata:
«zzz qualcosa di strano» è stato letto «romantic»).

**Conseguenza**: provato dal vivo: tre richieste «un giro per innamorati»
lette dall'AI → proposta → `apply` → la quarta, a Roma, letta dal
vocabolario (v1: quota AI da 1,0 a 0,0). Lisbona proposta per il catalogo.

**Aggiornamento** (2026-10-01, stesso task; deciso dall'agente su delega
dell'utente, che ha chiesto di nuovo il sistema completo):
- **Prove da giorni o luoghi diversi** (≥ 2): il modello gira a
  temperatura 0, quindi tre risposte uguali alla stessa frase non provavano
  nulla, e una persona sola poteva insegnare all'API ripetendo una
  richiesta.
- **Correzioni dei refusi** (`correction`): una parola vicina (distanza di
  modifica 1, o 2 da 8 lettere) a una parola delle tabelle, ≥ 2 volte, mai
  letta altrimenti dall'AI; per i temi si corregge la parola prima delle
  tabelle, in ogni richiesta. **`conflict`** quando l'AI e l'ortografia non
  concordano (dal vivo: «curoe» letto come cerchio): mai imparato da solo.
- **Validazione** (`Vocabulary.check`, comando `validate`): risposte fuori
  catalogo, chiavi mai cercate, correzioni di parole già note o verso parole
  che le tabelle non leggono, storia con buchi. `apply` valida prima di
  salvare; l'API scarta all'avvio le voci sbagliate; un test della CI
  valida il file del repository.
- **Impatto per versione** (`impact`): ogni tasso contro la versione
  precedente con un test sulle proporzioni (|z| ≥ 1,96, almeno 20 eventi per
  lato, altrimenti «too few»); un peggioramento di una metrica d'utilità
  indica la versione a cui tornare. Il tempo della sola lettura
  (`read_ms`) misura il costo dell'AI.
- **Una proposta annullata non torna** da sola (`apply --again`).

Scartato: correggere le parole sotto le 5 lettere (troppe parole vere
vicine: «lana»/«luna»); dare ragione all'ortografia senza una persona.
Dal vivo: «rmantico» a Bologna e Torino → correzione → a Milano letto dal
vocabolario, lettura da 1,0 s a 0 ms.

## ADR-0102 — Un annuncio AdMob fra «percorso pronto» e «percorso mostrato»
**Stato**: Attiva · 2026-10-01 · AdMob con una build dell'app: scelta
dell'utente; il come deciso dall'agente su delega dell'utente (TASK-132) ·
2026-10-02: un annuncio a ogni ricerca, scelta dell'utente

**Contesto**: l'utente vuole pubblicità solo dopo «Draw route» (o «Ask for
a route» in «Explore»), prima del percorso; con una rete ufficiale, consenso
e privacy rispettati, e il percorso subito se non c'è annuncio. L'app gira
in Expo Go, che non ha il codice nativo di nessuna rete pubblicitaria
ufficiale: l'utente ha scelto AdMob e una build propria dell'app.

**Decisione**:
- `react-native-google-mobile-ads` (AdMob), interstitial (immagine o
  video, con la X di Google). Nessuna schermata nostra: niente annunci finti.
- `useAdBeforeRoute` sta fra lo stato della richiesta e lo schermo: mentre
  il motore lavora prepara un annuncio; quando il percorso è pronto, se
  l'annuncio è carico lo mostra e tiene sullo schermo l'attesa; alla
  chiusura (o a un errore) mostra il percorso. Senza annuncio carico, il
  percorso subito: non si aspetta il caricamento.
- Un annuncio a ogni ricerca: scelta dell'utente del 2026-10-02, dopo la
  prova nel simulatore (prima era al più uno ogni 3 minuti). Chiuso un
  annuncio, il prossimo si carica subito, così è pronto alla ricerca dopo
  anche quando il percorso arriva in 1–3 s. «Draw route» sullo stesso
  percorso già disegnato non è una ricerca: lo mostra di nuovo, senza
  annuncio.
- Consenso: il modulo di Google (UMP, `gatherConsent`) alla prima richiesta
  di percorso, mentre il motore lavora; mai all'apertura. Senza
  `canRequestAds`, nessun annuncio. Niente richiesta ATT di Apple: su iOS
  annunci senza IDFA.
- In Expo Go, sul web e nei test il modulo nativo manca
  (`TurboModuleRegistry.get`): `NO_ADS`, l'app come prima. Lo stesso
  `eas update` va bene per Expo Go e per la build.
- ID di prova di Google (app e annuncio) finché non c'è l'account AdMob:
  gli ID veri in `app.json` e in `EXPO_PUBLIC_ADMOB_INTERSTITIAL_*`.
- `apps/mobile/eas.json`, profilo `preview` (distribuzione interna, canale
  `preview`). Bundle identifier iOS `com.lppl1316.sgrava`, scelto
  dall'utente.

**Alternative scartate**: AdSense in una WebView (vietato dalle regole
AdMob nelle app); un annuncio fatto da noi (finto); al più un annuncio ogni
3 minuti (la prima scelta, tolta dall'utente il 2026-10-02); aspettare il
caricamento dell'annuncio quando il percorso è pronto (blocca l'utente); il
consenso all'apertura (l'utente non vuole nulla all'apertura).

**Conseguenza**: in Expo Go nessun annuncio. Per vederli serve una build
EAS (iPhone: account Apple Developer); per annunci veri l'account AdMob e
l'app in uno store. Con gli ID veri vanno aggiunti gli identificativi
SKAdNetwork di Google (opzione `skAdNetworkItems` del plugin): l'SDK ne
segnala 50 mancanti. La prima ricerca dopo l'installazione di solito non
ha annuncio: il consenso e il caricamento arrivano dopo il percorso.
Una build fatta con Xcode 27 (SDK iOS 27) non si apre senza il ciclo di
vita a scene (`UIScene`), che il modello nativo di Expo SDK 57 non usa
ancora: per la prova nel simulatore (2026-10-02) la cartella `ios/`
generata, che non è nel repository, è stata adattata a mano con
`ExpoAppSceneDelegate` di Expo. Le build EAS usano il loro Xcode.

**Aggiornamento 2026-10-02 (TASK-166)**: l'annuncio copre l'attesa invece
di stare fra «percorso pronto» e «percorso mostrato», scelta dell'utente.
Quando una ricerca parte, un annuncio già carico si mostra subito e il
motore lavora dietro; alla chiusura lo schermo mostra quello che c'è (il
percorso, o l'attesa). Senza annuncio carico la ricerca va avanti senza, e
se ne carica uno per la prossima: di solito resta senza solo la prima
ricerca dopo l'installazione. Uno per ricerca, mai all'apertura, come
prima. Lo stato della ricerca non si trattiene più: `useAdBeforeRoute` lo
passa com'è e guarda solo l'inizio dell'attesa. L'ID dell'app AdMob vero
dell'utente sostituisce quello di prova in `app.json`; l'unità resta quella
di prova di Google fino a TASK-153.

**Aggiornamento 2026-10-05 (TASK-235, ADR-0198)**: l'annuncio a schermo
intero all'inizio di ogni ricerca non c'è più, scelta dell'utente: la
pubblicità sta fra i post del «Feed», un annuncio nativo ogni 5 post
(ADR-0198). `useAdBeforeRoute` e `routeAds` sono tolti. Restano AdMob, il
consenso di Google (ora alla prima apertura del Feed, mai all'avvio),
niente richiesta ATT, niente annunci in Expo Go. Le variabili
`EXPO_PUBLIC_ADMOB_INTERSTITIAL_*` diventano `EXPO_PUBLIC_ADMOB_NATIVE_*`.

## ADR-0104 — I file della cache delle zone si scrivono interi o non si scrivono
**Stato**: Attiva · 2026-10-01 · deciso dall'agente su delega dell'utente
(TASK-133, miglioramento generale)

**Contesto**: GraphML, pickle e vie con nome si scrivevano direttamente sul
nome definitivo. Un GraphML di zona pesa 50–120 MB e si scrive in secondi:
un'API o uno script fermati in quel momento lasciavano un file a metà, che
la cache trovava per nome. Un GraphML a metà o un pickle a metà (più
recente del GraphML, quindi letto per primo) facevano fallire ogni percorso
della zona; un file di vie con nome a metà mandava il percorso in
`engine_error`. Si usciva solo cancellando il file a mano. Sul Mac, il
2026-10-01, nessuno dei 355 GraphML in cache era rotto: è prevenzione.

**Decisione**: in `network.py` ogni file della cache si scrive su un nome
temporaneo accanto, `.<nome>.<8 cifre esadecimali>.part`, e prende il suo
nome con `os.replace` solo quando è scritto per intero (`_whole`). Un
errore o un'interruzione (Ctrl+C) tolgono il file temporaneo; un processo
ucciso lo lascia, ma un nome che comincia col punto non è trovato da
nessuna ricerca della cache (`foot_*.graphml`, `names_*.json`). Il pickle,
che fa solo risparmiare tempo: se non si legge si legge il GraphML e lo si
riscrive; se non si riesce a scrivere (`OSError`: disco pieno, cartella in
sola lettura) il caricamento va avanti senza.

**Alternative scartate**: `tempfile.mkstemp` (crea il file coi permessi
0600, diversi da quelli di oggi); un lock fra processi (non serve: due
scritture dello stesso file finiscono in due file temporanei diversi, e
vince l'ultima, intera); riscaricare da solo un GraphML già rotto (il
GraphML è il formato di riferimento: cancellarlo è una scelta di chi guarda
la cache).

**Conseguenza**: nessun cambio nei percorsi né nei tempi; un `.part`
rimasto da un processo ucciso si può cancellare a mano quando si vuole.

## ADR-0105 — «Explore»: città → categoria → percorso
**Stato**: Attiva · 2026-10-01 · le funzioni chieste dall'utente; il come
deciso dall'agente su delega dell'utente (TASK-134)

**Contesto**: l'utente vuole meno passaggi: città già pronte, ricerca con
suggerimenti, categorie da toccare, esempi che seguono la città.

**Decisione**:
- **Le città in evidenza sono solo nomi**: il centro lo dà `/cities` al
  tocco (una chiamata, in cache un giorno). Nessuna coordinata scritta
  nell'app (il principio di `CLAUDE.md`).
- **Suggerimenti** da `GET /city-suggestions` (autocompletamento per
  città), non da `/places`: lì le città hanno il centro dell'area.
- **Una categoria è un tema**: l'app manda le parole «Food in New York»,
  che le tabelle dell'API leggono; nessun campo nuovo nel contratto.
  Otto temi nuovi in `themes.py`, con categorie di Geoapify provate a New
  York. Parole brevi («bar», «pub», «run») si confrontano intere.
- **Recenti, non preferiti**: le ultime 5 città scelte, in un file sul
  telefono come la corsa (`trackStore`). I preferiti sarebbero un'altra
  lista da gestire per lo stesso scopo.
- **Le categorie sono gli esempi**: ognuna mostra «in <città>», così gli
  esempi cambiano con la città senza una seconda lista.

**Alternative scartate**: coordinate delle città nell'app; un campo
`theme` nella richiesta (contratto più grande per lo stesso effetto);
animazioni di layout (su Android chiedono API sperimentali).

**Conseguenza**: due tocchi per un percorso. Le categorie dove OSM ha pochi
luoghi (Family, Running in centro) lo dicono con `no_places`.

## ADR-0106 — Strava: il flusso ufficiale, senza account collegato
**Stato**: Superata da ADR-0138 · 2026-10-01 · scelta dell'utente («flusso ufficiale»);
il come deciso dall'agente su delega dell'utente (TASK-135)

**Contesto**: l'utente vuole «Avvia con Strava»: trasferire il percorso e
seguirlo in Strava, solo con ciò che Strava supporta ufficialmente.
Verificato sulla documentazione (2026-10-01): le API dei percorsi sono in
sola lettura (`GET /routes/{id}`, export GPX/TCX, elenco dell'atleta);
`POST /uploads` crea **attività**, non percorsi; nessun deep link
documentato per aprire un percorso o avviare una registrazione; il GPX si
importa come percorso dal route builder del sito; nell'app un percorso
salvato si segue da Record → Add Route.

**Decisione**: «Run with Strava» spiega e guida in tre passi: salvare il
GPX (l'export esistente), aprire il route builder ufficiale, aprire Strava.
Niente OAuth, niente token, niente dati inviati da noi. Funziona uguale su
iOS e Android (`Linking.openURL` su indirizzi https).

**Alternative scartate**: caricare il percorso come attività con
`POST /uploads` (sul profilo comparirebbe una corsa mai fatta); OAuth per
ritrovare il percorso importato (registrazione dell'app su Strava e token
da custodire per poco); URI `strava://` non documentati.

**Conseguenza**: l'import su Strava resta un passo a mano dell'utente,
dal sito. Se Strava aprirà la creazione di percorsi via API, il pulsante
potrà farlo da solo.

## ADR-0107 — Il cuore evita i «baffi»: le strade fatte due volte costano
**Stato**: Attiva · 2026-10-01 · giudizio e scelte dell'utente; misura e
peso decisi dall'agente su delega dell'utente (TASK-131). ADR-0106 era
stato preso intanto da un'altra sessione (Strava): numero cambiato.

**Contesto**: «ad occhio saprei farlo un po' meglio il cuore». Su 7 cuori
veri (Caldonazzo, Levico, Trento, Milano) l'utente ha dato 6 `quasi` e un
`sì` (Milano). Tre forme ideali più larghe o con lobi più tondi (che aveva
chiesto) hanno perso contro quella di oggi su 5 righe su 7: la forma non è
il problema. Alla domanda «cosa rende Milano migliore» ha risposto: linee
più pulite, senza pezzi avanti e indietro. Misurati: Milano 0% del
percorso fatto due volte, gli altri cuori scelti 1–23%.

**Decisione**:
- `route_engine/retracing.py` (nuovo): `doubled_share`, la quota della
  lunghezza su pezzi di strada percorsi più di una volta (dai punti degli
  archi del grafo, in un verso o nell'altro).
- Nel costo della ricerca, solo per il cuore: `+ 1,5 · doubled_share`
  (`W_DOUBLED`, `doubled_weight(nome)`); nella scelta fra le partenze
  vicine lo stesso termine diviso per `W_SHAPE`. Pesi 1,5 e 3 danno gli
  stessi cuori sulle 7 prove; si tiene il più piccolo.
- La forma ideale del cuore non cambia.

**Giudizio dell'utente** sui cuori cambiati: Levico 8 km e Trento 15 km
meglio i nuovi; Caldonazzo 10 km nessuna preferenza; gli altri 4 uguali.

**Alternative scartate**: cuore più largo (A) o a lobi tondi (B, C):
preferito quello di oggi; penalizzare i baffi per tutte le forme (gatto,
pesce e lettere li hanno apposta; sarebbe da rigiudicare tutto il
catalogo); un filtro dopo la ricerca invece del costo (scarta, non cerca
un percorso pulito).

**Conseguenza**: alcuni cuori cambiano e la loro somiglianza può scendere
di qualche punto; nessun tempo in più. Le altre forme e le parole danno gli
stessi percorsi (registro rifatto: stella, cavallo, farfalla, CIAO,
cerchio identici). Se l'occhio lo chiede, il peso si può dare ad altre
forme senza tratti (cerchio, stella), con un loro giudizio.

## ADR-0108 — La CLI non salva più i ritagli dei grafi
**Stato**: Attiva · 2026-10-01 · deciso dall'agente su delega dell'utente
(TASK-136); supera ADR-0023 solo sul salvataggio dei ritagli

**Contesto**: da ADR-0023 `OsmnxSource.load` salva col suo nome ogni
ritaglio di una zona in cache, GraphML e pickle. L'API non lo fa
(ADR-0030), ma la CLI e `seed_catalog` sì, una volta per partenza. Sul Mac,
il 2026-10-01, `data/cache/` pesava 18,6 GB: 346 grafi su 355 (17,9 GB)
stavano per intero dentro un grafo più grande della cache, con 19 GB
liberi sul disco. E `covering_path` sceglie il grafo più piccolo che
contiene l'area: con i ritagli salvati, lo stesso percorso può venire da un
ritaglio di un ritaglio, a seconda delle richieste fatte prima su quel
disco, e l'API tiene in memoria quei ritagli invece della zona.

**Decisione**:
- Un'area dentro una zona in cache si **ritaglia in memoria e non si
  salva**, come nell'API. Il file esatto, se c'è, si legge ancora; una zona
  nuova scaricata si salva come prima (ADR-0104).
- `python -m route_engine.prune_crops` elenca i grafi contenuti in un altro
  grafo della cache, raggruppati per zona; con `--delete` li cancella
  (GraphML e pickle). Senza, non cancella nulla. Un grafo si cancella solo
  se lo contiene un grafo che resta; zone, `names_*.json`, `walk_*` e
  `http/` non si toccano.

**Misure** (Mac, cache di prova con la sola zona, stesso percorso punto per
punto prima e dopo):

| Caso | Prima | Dopo |
|---|---|---|
| Trento, cuore 5 km, partenza nuova | 2,4 s, scrive 19,7 MB | 1,4 s, niente |
| Milano, cuore 10 km, partenza nuova | 11,8 s, scrive 108 MB | 5,5 s, niente |
| Trento, stessa richiesta rifatta | 0,9 s | 1,3 s |
| Milano, stessa richiesta rifatta | 2,9 s | 5,5 s |

Scrivere il GraphML del ritaglio era metà del tempo di una partenza nuova.

**Alternative scartate**:
- *Tenere i ritagli, con un limite di spazio o di numero*: la cache
  cancellerebbe da sola file dell'utente, e il percorso dipenderebbe ancora
  da quali ritagli ci sono.
- *Salvare solo i ritagli dei casi di riferimento*: serve un elenco da
  tenere allineato a `TESTING.md`, per guadagnare 0,4–2,6 s a richiesta.
- *Tenere la zona in memoria fra una partenza e l'altra nella CLI e in
  `seed_catalog`*, come `ZoneGraphs`: più veloce ancora, ma è un altro
  cambiamento; annotato in `tasks/TASK-136.md`.

**Conseguenza**: la cache cresce solo con le zone nuove. Rifare la stessa
richiesta costa 0,4 s in più a Trento e 2,6 s a Milano, perché si rilegge
la zona. I ritagli già salvati restano e si leggono come prima finché non
li si cancella con `prune_crops --delete`: è una scelta dell'utente, perché
i casi di riferimento letti dal loro ritaglio passerebbero a un ritaglio
fatto dalla zona.

## ADR-0109 — Anche cerchio e stella evitano i «baffi»
**Stato**: Attiva · 2026-10-01 · chiesto dall'utente («fai lo stesso per
cerchio e stella») e giudicato da lui; il peso deciso dall'agente su
delega dell'utente (TASK-139). Segue ADR-0107.

**Decisione**: `W_DOUBLED` vale 1,5 anche per `circle` e `star`, come per
il cuore. Le forme con tratti ripassati apposta (gatto, pesce, lettere,
immagini) restano senza.

**Misure** (7 partenze: Caldonazzo 10 km, Levico 12, 5, 8 km, Trento 10,
15 km, Milano 10 km): il cerchio non cambia in nessuna. La stella cambia in
3: Levico 5 km, Levico 8 km, Trento 15 km.

**Giudizio dell'utente**: Levico 8 km e Trento 15 km meglio la stella
nuova; Levico 5 km nessuna preferenza. Peso doppio (3,0) scartato: a
Levico 5 km la stella somiglia meno (0,81 → 0,73).

**Conseguenza**: alcune stelle cambiano, con la somiglianza a volte un
po' più bassa (Levico 8 km 0,93 → 0,86); i tempi no. Cavallo, farfalla,
CIAO e il cerchio del registro danno gli stessi percorsi di prima.

## ADR-0110 — «Explore»: città e luoghi mentre si scrive
**Stato**: Attiva · 2026-10-01 · la funzione chiesta dall'utente («scrivo
ver, devono uscirmi Verona centro, Arena di Verona»); il come deciso
dall'agente su delega dell'utente (TASK-138). Allarga ADR-0105, che
suggeriva solo città.

**Contesto**: provata «Explore» sull'iPhone, il campo della città non
suggeriva nulla: l'app pubblicata era di prima di TASK-134 e l'API del Mac
era partita prima del suo merge (`/city-suggestions` → 404). Ma anche con
TASK-134 i suggerimenti erano solo città (`type=city`).

**Decisione**:
- **Una sola chiamata**, l'autocompletamento di Geoapify senza `type`.
  Provato su 10 città (Milano, Roma, Parigi, New York, Londra, Torino,
  Trento, Levico, Tokyo, Barcellona): i risultati `city` hanno lo stesso
  punto di `type=city` (Parigi 2 km più a est, all'Hôtel de Ville). Il
  centro dell'area del comune che ADR-0105 temeva (Milano: Baggio) viene
  dai risultati `county`, che si scartano con regioni, stati e CAP.
- **L'ordine del servizio**, non prima le città: «casa di giu» mette
  davanti la Casa di Giulietta, non una frazione col nome simile.
- **`kind` nella risposta** (`city` | `place`): una città si nomina nelle
  parole («Food in Verona», come prima); un luogo no, la richiesta è solo
  «Food» col suo punto, come dalla partenza. Le parole «Food in Verona
  Arena» farebbero cercare una città con quel nome (`themed.py`).
- **Etichetta col nome del risultato**: «Parè, Colverde, Italy», non
  «Colverde» per chi scrive «par». Niente luoghi senza nome (edifici con
  il solo indirizzo); due luoghi a meno di 150 m sono un solo punto.
- **Invio sceglie il primo suggerimento**: è quello che si vede.

**Alternative scartate**: i luoghi famosi della prima città già da «ver»,
come Google: la ricerca dei luoghi di Geoapify li dà per distanza (a Roma
statue prima del Colosseo, provato) e l'autocompletamento non ha un
ordine per fama; servirebbe un'altra fonte. Photon trova meglio i
monumenti a metà parola («colos» → Colosseo) ma risponde in 3 s contro
1 s (ADR-0095). Un endpoint nuovo accanto a `/city-suggestions`:
lascerebbe codice morto.

**Conseguenza**: «arena di ver» → Verona Arena, «duomo di mil» → Duomo,
«colosseo» → Piazza del Colosseo; «ver» dà ancora solo città. Una
categoria da un luogo parte dal suo punto (provato: Duomo di Milano →
Food, cerchio di 9,8 km, 4 ristoranti). Etichette in inglese, come le
città di TASK-134.

## ADR-0111 — Il server a pagamento: quale, e la configurazione in `deploy/`
**Stato**: Attiva · 2026-10-01 · TASK-144 · la configurazione decisa
dall'agente su delega dell'utente; il server scelto dall'utente

Chiesto dall'utente: le istruzioni per mettere l'app su un server, da
usare con il computer spento e un giorno da pubblicare, e i server a
pagamento migliori per qualità e prezzo.

**Contesto**: la strada C di ADR-0076 aveva i prezzi del 2026-09-26, e
Hetzner li ha alzati il 1° aprile e il 15 giugno 2026 (CX33 da 6,49 a
8,49 €, CPX e CCX più che raddoppiati). Il solo `docker run` del
pacchetto lascia fuori `catalog/` («Explore» vuoto), perde gli eventi di
TASK-130 a ogni container nuovo e non ha HTTPS né l'AI.

**Decisione**:
- **Il server** (`DEPLOY.md`, F.1, prezzi del 2026-10-01): **Hetzner
  CX33** (4 vCPU, 8 GB, 80 GB, 10,97 €/mese IVA compresa, a ore), scelto
  dall'utente il 2026-10-01 al posto dell'Oracle di ADR-0114, che
  rispondeva «Out of capacity», e già acceso: messo su a mano, con
  `docker run` e Caddy da apt su un nome `sslip.io`. L'alternativa
  annotata è OVHcloud VPS-3 (6 vCore, 12 GB, 100 GB, 12,69 €/mese con 12
  mesi, backup incluso).
- **`deploy/compose.yaml`**: l'API dal `Dockerfile`, senza cambiarlo.
  Zone, eventi e registro in `data/` del checkout con bind mount (cartelle
  normali: `rsync` dal Mac le riempie, e sopravvivono alle immagini
  nuove); `catalog/` in sola lettura; un servizio `data-owner` (busybox)
  che a ogni avvio crea le cartelle e le dà all'utente 10001 dell'API.
  Porta 8000 solo su `127.0.0.1`: Docker aprirebbe `0.0.0.0` scavalcando
  `ufw`. Log di Docker limitati a 3 × 10 MB per servizio.
- **Profili** in `COMPOSE_PROFILES` di `deploy/.env`: `ai` (immagine
  `ollama/ollama`, `--ai-url http://ollama:11434`; senza il profilo il nome
  non si risolve e le parole fuori tabella danno `ai_unavailable`, come con
  Ollama spento) e `public` (Caddy).
- **Privato prima di pubblico**, nella guida: `tailscale serve` sul
  server dà HTTPS con certificato vero solo alla tailnet, senza dominio né
  porte aperte. Per il pubblico **Caddy**, che chiede e rinnova da solo il
  certificato di `SHAPEROUTE_DOMAIN`: un dominio vostro, o per cominciare
  un nome `sslip.io`, come il server di oggi. Non Tailscale Funnel: il
  suo nome pubblico non è stato creato (tailscale/tailscale#21502).
- **Il limite per telefono anche dietro il proxy**:
  `FORWARDED_ALLOW_IPS="*"`, letto da uvicorn, fa vedere all'API
  l'indirizzo di `X-Forwarded-For`. Si può fidare di tutti perché alla
  porta arrivano solo Caddy e `tailscale serve`.
- **Segreti in `deploy/.env`**, copia di `.env.example` (`.gitignore` lo
  esclude già); variabili nuove `SHAPEROUTE_DOMAIN` e `COMPOSE_PROFILES`.
- **CI**: il job `docker` avvia `deploy/compose.yaml` e controlla
  `/health`, la chiave (401/200), il proprietario di `data/cache`, i
  percorsi di «Explore» a Trento e il `Caddyfile` (`caddy validate`).

**Alternative scartate**: DigitalOcean, Vultr, Linode, Lightsail (4–5
volte il prezzo per la stessa RAM); Render, Railway, Fly.io (RAM e disco
permanente a parte); netcup (14,50 € per 8 GB); vCPU dedicati Hetzner
dopo i rincari; Contabo come prima scelta (processore e disco più lenti,
impegno di 24 mesi); nginx con certbot (più passi e un rinnovo da
controllare); Cloudflare Tunnel con dominio (il dominio deve stare su
Cloudflare e il traffico passa da loro); volumi Docker con nome per le
zone (da riempire servirebbe root); cambiare il `Dockerfile` per
`catalog/` (il montaggio basta, e un catalogo nuovo non chiede
un'immagine nuova).

**Conseguenza**: dal server comprato all'app sull'iPhone a Mac spento sono
i passi F.2–F.7 di `DEPLOY.md`. Il server di oggi non usa ancora questa
configurazione: spostarlo (F.12, stessi dati e stesso indirizzo) si fa a
parte, a fine coda dei merge. Misurato lì, a mano: cuore da 5 km a Trento
in 18,7 s con la zona in cache, l'API in 0,56 GB; l'AI su CPU è da
provare. TASK-122 aggiunge il database a `deploy/compose.yaml`.
## ADR-0112 — Le ricerche imparano anche da cosa fa l'app
**Stato**: Attiva · 2026-10-01 · deciso dall'agente su delega dell'utente
(TASK-142), che ha chiesto di nuovo il sistema di auto-miglioramento

**Contesto**: ADR-0101 impara da cosa l'API vede. Ma l'API non vede le
scelte: da TASK-134/138 una città scelta fra i suggerimenti non passa da
`/cities` (dal vivo: Vercelli, «Explore» vuoto 3 volte, nessuna proposta);
non sa quale percorso si usa fra A, B e C, né se si prende «Try N km».
Una ricerca sbagliata e corretta subito («levic» → Levič, Slovenia → 16 s
dopo Levico) non insegnava nulla. Un cambio del motore o del catalogo non
si misurava: `impact` confronta solo versioni del vocabolario.

**Decisione**:
- **`POST /signals`** (`signals.py`): tre corpi in lista bianca,
  `city_chosen`, `route_chosen`, `hint_taken`; un campo in più è un 422.
  Sempre `204`, mai un errore sul telefono. Oltre 60 al minuto, tutti i
  client insieme, non si registrano. Il nome di una città è pubblico e si
  tiene con le maiuscole; il punto diventa la cella di ~1 km; mai le lettere
  digitate, mai la partenza. Nell'app un invio che non fallisce mai, da
  `ExploreTools.tsx` (la città e come) e `RoutePanel.tsx` (il primo uso di
  un percorso, «Try N km», una forma del catalogo), senza toccare `App.tsx`.
- **Percorsi annullati** come eventi (`cancelled`, con lo stato a cui
  erano), registrati da `DELETE`; il risultato buttato non conta.
- **`city_name`**, una proposta applicabile: parole cercate come città e
  lasciate entro 3 minuti per una città il cui nome comincia con quelle
  parole o ne dista poche lettere, ≥ 2 volte, in ≥ 2 giorni, in metà delle
  ricerche. Nel vocabolario (`city_names`), `/cities` cerca il nome
  imparato. Senza un identificativo, ricerca e scelta si legano solo per
  tempo: da qui le tre condizioni.
- **Metriche di comportamento** (`cancel_rate`, `first_choice_rate`): si
  leggono, ma non chiedono di tornare indietro col vocabolario, che non le
  cambia. `city_left_rate` sì: è quella che un nome imparato abbassa.
- **`compare --split GIORNO`** per ogni cambio, con lo stesso test di
  `impact`; `trend` per settimana; `why` per sapere cosa manca a una
  proposta.

**Alternative scartate**: un identificativo di sessione nei segnali
(legherebbe ricerca e scelta con certezza, ma è un dato di una persona:
scelta dell'utente, con gli account di TASK-110); registrare le lettere di
`/city-suggestions` (ADR-0101); imparare dalle scelte fra A, B e C (la
classifica è codice del motore: `review_ranking`, per una persona);
il tipo dei segnali in `shared-types/src/index.ts` (è di TASK-088, aperto:
per ora `src/signals.ts`).

**Conseguenza**: provato dal vivo su un'API di prova con Geoapify: il primo
giorno ricostruito dall'evento vero di «levic», il secondo dal vivo →
proposta `city_name` → `apply` → `GET /cities?q=levic` risponde Levico
Terme (`"by":"learned"`). Vercelli scelta fra i suggerimenti → proposta per
il catalogo. Trovato e corretto un errore di TASK-130: `Insights.record`
riceveva `ms` due volte, e nessun percorso dell'API era mai stato
registrato (c'erano solo quelli importati dallo storico).

## ADR-0114 — La parte social: le scelte dell'utente
**Stato**: Attiva · 2026-10-01 · **scelte dell'utente**, una domanda per
volta (TASK-110). Chiude, con ADR-0115, ADR-0013.

**Contesto**: la parte social (`ROADMAP.md`, TASK-110 … 122) aspettava le
scelte su dove stanno i dati, come si entra, chi vede cosa e chi modera.
Le proposte, con le alternative scartate, sono nel task file.

**Decisione dell'utente**:
1. **Punteggio**: la corsa contro il percorso pianificato (ADR-0090).
2. **Hosting**: **Oracle Cloud Always Free**, VM ARM Ampere A1 (oggi 2
   OCPU e 12 GB gratis), per API e database. Scartati Hetzner (circa
   6–11 €/mese), un VPS con database e accessi gestiti (Supabase), un
   Raspberry Pi a casa.
3. **Accesso**: email e password. Apple e Google forse dopo, con una build
   propria.
4. **Corse salvate**: private finché l'iscritto non le pubblica;
   pubblicate, le vedono gli iscritti (il feed non si legge senza account),
   senza i primi e gli ultimi 200 m della traccia.
5. **Percorsi consigliati** (ADR-0086): mostrati da un punto del giro a
   più di 500 m dalla partenza vera, mai con il nome di chi li ha chiesti.
6. **Età minima**: 16 anni, con la casella «I am at least 16».
7. **Cancellare l'account** cancella tutto, anche i percorsi generati da
   quell'iscritto nel catalogo dei consigliati. Un percorso generato senza
   account non è di nessuno e resta.
8. **Moderazione**: due admin, l'utente e il collega, avvisati per email a
   ogni segnalazione; un contenuto si toglie entro 24 ore, a mano. Nessun
   contenuto si nasconde da solo.
9. **Pacchetti e servizi nuovi approvati**: psycopg e argon2-cffi
   nell'API, expo-secure-store nell'app, PostgreSQL con PostGIS in Docker
   sulla VM, Object Storage di Oracle per le copie, Brevo per le email.

**Conseguenze sui task già scritti**: nel task file di TASK-110,
«Esito».

**Aggiornamento (TASK-213, 2026-10-03)**: il punto 8 è superato in parte
da ADR-0176. I commenti negativi non si pubblicano: li rifiuta l'API, e chi
li scrive vede un avviso. Per tutto il resto il punto 8 resta valido.

## ADR-0115 — Database, account e server: come
**Stato**: Attiva · 2026-10-01 · deciso dall'agente su delega
dell'utente, dentro le scelte di ADR-0114 (TASK-110)

**Decisione**:
- **PostgreSQL 16 con PostGIS**, in Docker sulla stessa VM dell'API
  (immagine `postgis/postgis`). Tracce e percorsi come geometrie PostGIS in
  WGS84: le domande «vicino a me» (TASK-092, TASK-118) si fanno nel
  database con un indice spaziale. Schema in `DATABASE.md`.
- **Migrazioni**: file SQL numerati in `services/api/migrations/`,
  applicati all'avvio dell'API in una transazione, con la tabella
  `schema_migrations`. Niente Alembic: una dipendenza in meno, e lo schema
  si legge in SQL.
- **psycopg 3** senza ORM: le query sono poche e PostGIS si scrive meglio
  in SQL.
- **Password** con Argon2id (`argon2-cffi`), mai nei log. **Sessione**: un
  token casuale di 32 byte dato all'app; nel database solo il suo hash
  (SHA-256), con scadenza a 90 giorni dall'ultimo uso. Niente JWT: un token
  si revoca cancellando la riga. Nell'app il token sta in
  `expo-secure-store`.
- **Foto del profilo**: un JPEG quadrato piccolo (256 px) nel database,
  così le copie di sicurezza le prendono con il resto.
- **Copie di sicurezza**: `pg_dump` ogni notte sulla VM, caricato
  nell'Object Storage gratuito di Oracle (20 GB), 14 copie; un ripristino
  provato in TASK-122. Le copie stanno fuori dalla VM perché Oracle può
  reclamarla (ADR-0114).
- **Admin**: una colonna `role` negli utenti; i due admin si nominano con
  una riga SQL sulla VM, senza schermate.
- **Email** con Brevo, dall'API soltanto: la chiave in `.env`, mai
  nell'app.

**Da decidere in TASK-122, con l'utente**: HTTPS (serve un nome di
dominio, qualche euro all'anno, o un altro modo) e se passare l'account
Oracle a «Pay As You Go», che resta gratis dentro i limiti e, secondo le
regole di Oracle, non reclama le VM poco usate: la VM dell'API usa poca
CPU e rischia proprio quello.

**Scartate**: *Supabase* per database e accessi (scelta dell'utente:
tutto sulla VM); *SQLite* (niente PostGIS, un solo processo che scrive);
*le foto nell'Object Storage* (un servizio in più da chiamare per ogni
profilo, per pochi KB).

## ADR-0116 — «Explore»: due categorie, ed esempi disegnati subito per una città
**Stato**: Attiva · 2026-10-01 · chiesto dall'utente dopo la prova di
TASK-138 («solo due e poi altro con tre puntini»; «devono partire subito i
cuori, le forme più semplici, e gli dai l'esempio»); forme, distanza e il
come decisi dall'agente su delega dell'utente (TASK-143). Allarga ADR-0105.

**Contesto**: 13 categorie occupavano lo schermo. Una città fuori dal
catalogo (Vercelli) mostrava solo «No recommended routes near this start
yet»: il catalogo ha percorsi per 6 città.

**Decisione**:
- **Due categorie e «More…»**: le prime due dell'ordine di ADR-0105 (Food,
  Famous Places); «More…» apre le altre nella stessa griglia, a tre per
  riga. Il componente sta in un file nuovo, `AskForRoute.tsx`: quello
  vecchio in `ExploreTools.tsx` resta finché TASK-142, che ha quel file,
  non è in `main`.
- **Esempi solo dove il catalogo non ha niente**: cuore, cerchio e stella
  da 5 km dal centro della città, le forme più semplici del catalogo e la
  distanza più breve che si chiede di solito. Con `/route-jobs`, come
  «Draw route»: nessun contratto nuovo.
- **Uno alla volta, il cuore per primo**: ogni forma chiede un riquadro un
  po' diverso, e due richieste insieme potevano scaricare due zone da
  Overpass, che dopo pochi download rifiuta il Mac per ore. La prima
  scarica, le altre la trovano in cache.
- **Fuori dalla schermata**: gli esempi stanno in un modulo, non nello
  stato di `ExploreScreen`; aprire un esempio sulla mappa non ferma quelli
  in calcolo. Un'altra città sì: l'API ha 2 worker, la città nuova ha la
  precedenza.
- **Si aprono come un percorso consigliato** (`onOpen`, `useExplored`):
  `explored.ts` trova il percorso intero già sul telefono e non lo chiede
  al catalogo. `App.tsx` non cambia (lo tocca la PR #130).
- **Restano sul telefono**: in memoria e in `city-examples.json` (ultime 8
  città), come le città recenti. La seconda volta sono immediati, anche
  dopo aver chiuso l'app.
- **Mappa non scaricabile o API spenta**: un solo messaggio
  (`problemText`) e «Try again»; le altre forme non si chiedono, finirebbero
  uguali.

**Alternative scartate**: salvare gli esempi nel catalogo dell'API per
tutti (il catalogo è guardato a occhio, ADR-0097; i percorsi salvati per
tutti aspettano il database, ADR-0086); un endpoint che disegni le tre
forme in una volta (contratto nuovo per lo stesso effetto); chiedere gli
esempi già mentre si scrive la città (scaricherebbe zone di città non
scelte).

**Conseguenza**: provato sull'API del Mac il 2026-10-01: Pergine Valsugana
(zona in cache, niente catalogo) cuore 4,4 km 0,87, cerchio 4,6 km 0,77,
stella 4,8 km 0,94, 2 s l'uno; New York uguale. Vercelli:
`map_data_unavailable` dopo 63 s, finché Overpass rifiuta il Mac: lì
servono le zone scaricate prima (TASK-137).

## ADR-0117 — «Start» sui percorsi di «Explore»: le indicazioni dai punti
**Stato**: Attiva · 2026-10-01 · chiesto dall'utente («dalla sezione di
explore implementa la stessa funzione di start del percorso con le
indicazioni»); il come deciso dall'agente su delega dell'utente
(TASK-145). Toccare `App.tsx` (anche di TASK-132) e `app.py` (anche di
TASK-142) approvato dall'utente.

**Contesto**: un percorso aperto da «Explore» aveva solo «Export GPX»: il
catalogo tiene i punti e basta (ADR-0097), il percorso a tema e gli
esempi di una città arrivano all'app allo stesso modo. Le indicazioni di
svolta (ADR-0045) vogliono i nodi del grafo, che l'app non ha.

**Decisione**:
- **Le indicazioni si ricavano dai punti, sull'API**: i punti del motore
  sono i nodi e la geometria degli archi fra loro, quindi ogni nodo è uno
  dei punti (entro 1 m, anche coi 6 decimali dei file). Un modulo nuovo
  del motore, `route_nodes.py`, ritrova i nodi; l'API ci mette
  `guidance` e gli `along` come per un percorso pianificato. Un solo
  endpoint, `POST /route-directions` (`{points}` → `{directions}`), per
  tutti i percorsi di «Explore», qualunque sia la loro origine.
- **Una richiesta sola, non un job**: con la zona in cache bastano 0,1–
  0,5 s; i percorsi di «Explore» stanno in zone già usate (il catalogo è
  stato pianificato lì, a tema ed esempi sono appena stati disegnati). Una
  zona da scaricare può metterci di più: la scheda lo dice se fallisce, e
  «Start» riprova.
- **Errori senza codici nuovi**: una linea fuori dalla mappa è
  `invalid_request` (`RouteNotOnGraphError` è un `InvalidRequestError`),
  una zona che non si scarica `map_data_unavailable`.
- **Nell'app**: «Start» giallo nelle due schede di «Explore», sopra
  «Export GPX» come per un percorso disegnato. Le indicazioni si chiedono
  al tocco, non all'apertura: chi guarda e basta non chiede niente.
  Restano in memoria per quella linea (stessa lista di punti), così un
  secondo «Start» dopo «Stop» parte subito. La navigazione, la traccia e
  il punteggio sono quelli di sempre (ADR-0052, ADR-0091, ADR-0093), sulla
  linea di «Explore»; uscire da «Explore» lascia perdere l'attesa e la
  corsa.
- **Tipi nel modulo dell'app** (`routeDirections.ts`), come
  `themedRoutes.ts`: `packages/shared-types/src/index.ts` è di TASK-088
  (PR #112). Il contratto sta nelle fixture.

**Alternative scartate**: salvare le indicazioni nel catalogo
(`seed_catalog.py` è di TASK-128, e un percorso a tema o un esempio non
passano dal catalogo); mandarle già con `GET /recommended-routes/{id}` e
nel risultato a tema (due endpoint da cambiare, e indicazioni calcolate
anche per chi non parte); calcolarle sul telefono dalla sola geometria
(senza grafo niente nomi delle vie né incroci veri); ricalcolare il
percorso dalla partenza (sarebbe un altro percorso).

**Conseguenza**: provato sull'API del Mac il 2026-10-01: percorsi del
catalogo a Trento (5 e 23 km), Bologna, Milano e Levico, tutta la linea
ritrovata in 0,1–0,5 s; 4 percorsi appena pianificati (Trento e Bologna,
con le alternative) danno indicazioni identiche a quelle del motore. Da
provare sull'iPhone.

## ADR-0084 — Zucca e albero di Natale nel catalogo; «albero» da solo resta fuori
**Stato**: Attiva · 2026-09-30 · le forme scelte dall'utente; parole,
tessere e domanda all'AI decise dall'agente su delega dell'utente (TASK-088)

**Contesto**: TASK-078 (ADR-0073) ha disegnato zucca di Halloween e albero
di Natale, giudicati a 15 km: zucca `sì` a Milano, `no` a Trento, `quasi`
a Levico; albero `sì` a Milano, `quasi` a Trento, `no` a Levico. ADR-0061
li aveva lasciati contorni da CLI. Nel motore c'è anche `tree.json`
(TASK-034/037), un albero qualsiasi, mai entrato nel catalogo.

**Decisione**:
- **Entrano `pumpkin` e `christmas_tree`**, scelti dall'utente
  (2026-09-30) sapendo il giudizio: fuori da una rete fitta possono non
  riuscire, e l'app propone già un'altra distanza o le altre forme
  (ADR-0041). Come le forme di ADR-0061: `SHAPES` del motore,
  `shared-types`, `contract.json`, `shapeWords.ts`, `OUTLINES`. Sullo
  schermo «pumpkin» e «christmas tree».
- **Parole**: «zucca», «zucche», «zucca di halloween», «pumpkin»,
  «halloween pumpkin», «jack-o'-lantern»; «albero di natale», «alberi di
  natale», «alberello di natale», «christmas tree», «xmas tree».
- **«albero» e «tree» da soli non cambiano significato**: non sono nella
  tabella e per l'AI restano «nessuna forma» (due voci nella lista di
  messa a punto lo controllano). La riga dell'AI dice «a decorated
  Christmas tree with a star on top, not a plain tree»: senza le ultime
  parole qwen3:4b sceglieva l'albero di Natale per «tree». «Natale»,
  «Halloween», «abete addobbato» le legge l'AI, e portano alle due forme.
- **Tessere** 🎃 e 🎄, **in una riga sola che scorre di lato** (chiesto
  dall'utente, 2026-10-01: nella griglia di quattro per riga zucca e albero
  non si trovavano). Tessere larghe 88 punti, poco meno di quattro per
  schermo: quella tagliata sul bordo dice che la riga continua. Una forma
  scritta nel campo («zucca») porta la sua tessera in vista.

**Alternative scartate**: portare «albero» all'albero di Natale (chi
scrive «albero» a luglio non vuole la stella in cima; è una scelta di
prodotto, non delegata); mettere «halloween» e «natale» nella tabella
(sono feste, non disegni: le legge l'AI, e si possono spostare se sbaglia).

**Conseguenza**: il catalogo ha tredici forme. Chieste all'API a Milano a
15 km danno, punto per punto, i campioni giudicati di TASK-078. Se un
giorno `tree` entra nel catalogo, «albero» e «tree» sono liberi per lui.

## ADR-0118 — I baffi delle altre forme: solo quelli oltre i tratti voluti
**Stato**: Attiva · 2026-10-02 · chiesto dall'utente («fai lo stesso per
le altre forme») e giudicato da lui forma per forma; misura e peso decisi
dall'agente su delega dell'utente (TASK-140). Segue ADR-0107 e ADR-0109.

**Contesto**: senza tratti ripassati restano solo cavallo e luna. Gatto,
pesce, farfalla, lumaca, testa di cane e di coniglio ripassano apposta
occhi, antenne, spirale (TASK-037): contare tutto il percorso fatto due
volte li avrebbe puniti per i loro tratti.

**Decisione**:
- `extra_doubled_share(percorso, forma)`: la quota fatta due volte del
  percorso meno quella della forma piazzata; mai sotto zero. Sostituisce
  `doubled_share` nel costo della ricerca e nello `score` delle partenze
  vicine. Per una forma senza tratti è la stessa cosa: cuore, cerchio e
  stella restano identici (77 percorsi confrontati con `main`).
- `W_DOUBLED` = 1,5 per cuore, cerchio, stella, cavallo, luna, farfalla,
  lumaca.

**Giudizio dell'utente** sui 13 percorsi che cambiavano con il peso su
tutte le forme: meglio i nuovi per luna (1 su 1), farfalla (1 su 1),
lumaca (1 su 1); meglio quelli di prima per gatto (3 su 4), pesce (1 su 1),
testa di cane (2 su 3), testa di coniglio (1 su 1, l'altro indifferente).
Il cavallo non cambiava: entra come il cerchio, perché non ha tratti.

**Alternative scartate**: il peso per tutte le forme (gatto, pesce e teste
avrebbero perso forma, giudicati peggio); un peso diverso per forma (con
7 prove ciascuna non c'è abbastanza per tararlo).

**Conseguenza**: sulle prove cambiano solo i 3 percorsi giudicati meglio.
Gatto, pesce e le teste possono tenere dei baffi: se l'occhio lo chiede,
servono altre idee (ritoccare la forma, o la somiglianza delle teste).

## ADR-0119 — Le zone delle città scaricate prima, sul server dell'app
**Stato**: Attiva · 2026-10-02 · chiesto dall'utente («scarica un po' di
mappe almeno per l'Italia»); quali città, il riquadro e il come decisi
dall'agente su delega dell'utente (TASK-137).

**Contesto**: la prima richiesta per una città nuova scarica la sua zona da
Overpass: Vercelli, la prima volta, 94 s per i tre esempi (TASK-143), quasi
tutti download. Dal Mac Overpass rifiuta per ore dopo pochi download; dal
server Hetzner, che l'app usa dal 2026-10-01, risponde.

**Decisione**:
- **Un comando dell'API**, `python -m shaperoute_api.prefetch_zones`: usa la
  stessa ricerca delle città di `GET /cities`, quindi lo stesso centro che
  l'app riceve al tocco.
- **Il riquadro di «Explore»**: ogni forma dei temi (lette da `THEMES`) a
  10 km da qualunque partenza entro `search_radius_m(10 km)` (2,5 km), con
  l'area della ricerca lontana del motore da quelle partenze
  (`zone_area(..., FAR_OFFSET_M)`), e gli esempi di TASK-143 a 5 km da
  qualunque partenza entro `FAR_OFFSET_M` (2 km). Bastano le quattro
  partenze più lontane a nord, est, sud e ovest: i riquadri sono allineati
  agli assi. Circa 17 × 17 km, 289 km². Il primo riquadro, senza la ricerca
  lontana, era di 14 km: Romantic a Verona e Bolzano usciva di 0,4–0,7 km a
  nord e chiedeva Overpass. Le zone a 14 km già fatte restano: l'API prende
  la zona più piccola che copre la richiesta, quindi la più leggera.
- **Con i nomi delle strade** (ADR-0057): l'API li legge solo dalla cache,
  e «Start» (TASK-145) li dice. Una città con la zona ma senza nomi scarica
  solo i nomi.
- **Le città**: `--preset italy`, 52 città (i 21 capoluoghi di regione e
  provincia autonoma, poi le più grandi e visitate, Vercelli e Levico
  comprese); `--preset featured`, le 14 città in evidenza dell'app. Solo
  nomi, nessuna coordinata scritta.
- **Prudenza con Overpass**: un download alla volta, 60 s fra una città e
  l'altra; prima di ognuna la pagina di stato, e se un posto si libera fra
  N secondi si aspetta (fino a 5 minuti): è quello che il servizio chiede, e
  il primo giro sul server senza attesa si era fermato a Milano con un
  errore HTTP subito dopo Roma. Un tentativo per città; una città che
  fallisce resta per il giro dopo, e due errori di fila fermano il comando
  (TASK-137 diceva «il primo errore»: pensato per il Mac, che Overpass
  blocca per ore; dal server l'errore tipico è un 504 passeggero, e il
  secondo giro si era fermato a Torino per uno solo). Stop anche se Overpass
  non risponde, `--max-downloads` per stare nell'uso corretto del servizio
  pubblico; stop sotto i 5 GB liberi. Rilanciato riparte dalle mancanti.
- **Sul server, in un container a parte** con la cartella della cache
  dell'API: l'API in servizio non si ferma, e legge le zone nuove dal disco
  alla prima richiesta (le scritture sono intere, ADR-0104).

- **Dall'estratto di Geofabrik** (scelta dell'utente del 2026-10-02, dopo
  che Overpass aveva bloccato il server alla quinta città): `--extract`,
  osmium solo nell'immagine dei download. **osmium-tool è una dipendenza
  nuova, approvata dall'utente** il 2026-10-02 (nell'opzione scelta, poi
  alla domanda diretta del Coordinatore); serve solo a chi rifà le zone
  (`SETUP.md` 10.5: `brew install osmium-tool` sul Mac), non all'API né
  all'app. OSMnx e il motore ricevono dal
  ritaglio le risposte di Overpass (sostituendo per la durata del download
  `osmnx._overpass._download_overpass_network` e `network._overpass`) e
  fanno tutto il resto come sempre: così la zona è quella di un download,
  verificato su Napoli e Palermo (stessa linea per cuore e stella).
  Costruire il grafo da un file `.osm` con `graph_from_xml` saltava il
  taglio al riquadro e il filtro: zone diverse.

**Alternative scartate**: Overpass molto piano (una città ogni due ore,
giorni per l'Italia, e il server ribloccato ogni tanto anche per l'app);
pyosmium nel progetto (una dipendenza Python in più per l'API, che non ne ha
bisogno); zone più grandi per le città grandi:
più download per le stesse richieste di «Explore»; scaricare sul Mac:
Overpass lo rifiuta, e l'app non usa più il Mac.

**Conseguenza**: nelle città scaricate «Explore» non aspetta Overpass;
fuori, la prima richiesta scarica ancora. Il riquadro non copre «Draw
route» da partenze lontane dal centro né percorsi a tema oltre i 10 km.

## ADR-0121 — Su Linux la memoria per le partenze vicine è MemAvailable
**Stato**: Attiva · 2026-10-02 · deciso dall'agente su delega dell'utente
(TASK-147), dopo che l'utente non vedeva più le alternative sul server.

**Contesto**: le partenze vicine (ADR-0071) partono ciascuna in un
processo solo se c'entra nella memoria, lasciando 1000 MB al piano della
partenza dell'utente; le alternative (ADR-0087) sono i loro percorsi. Su
Linux la memoria si leggeva da `SC_AVPHYS_PAGES`, cioè MemFree, che non
conta la cache dei file. Sul server Hetzner la cache è piena delle zone
lette dal disco: 534 MB liberi su 6,8 GB disponibili, quindi nessuna
partenza vicina e nessuna alternativa, per forme, parole e immagini. Sul
Mac `SC_AVPHYS_PAGES` non esiste (si provano sempre tutte), su Windows si
legge già la memoria disponibile: per questo non si era visto.

**Decisione**:
- Su Linux si legge **MemAvailable** da `/proc/meminfo`: la stima del
  kernel della memoria che un processo nuovo può prendere senza swap,
  cache liberabile compresa.
- Sotto un **limite cgroup v2** (container con `--memory`, servizio
  systemd con `MemoryMax`) non più di quanto resta del limite, contando
  come libera la cache inattiva (`inactive_file`), come fa `docker stats`.
  Senza limite (`max`), solo MemAvailable.
- Senza MemAvailable (kernel prima di 3.14) si torna a `SC_AVPHYS_PAGES`.
- In un modulo nuovo, `route_engine/memory.py`; `free_memory_mb` lo usa su
  Linux. Riserva, peso per processo e attese restano quelli di ADR-0071.

**Conseguenza**: sul server, nel container dell'API, il cuore da 5 km a
Trento torna con un'alternativa (10,8 s) e la stella con due (5,8 s),
come sul Mac. Due richieste insieme contano la memoria ognuna quando
parte, come prima.

## ADR-0120 — Account nell'API: endpoint, errori, tentativi, test
**Stato**: Attiva · 2026-10-02 · deciso dall'agente su delega dell'utente,
dentro ADR-0114 e ADR-0115 (TASK-114); Colima sul Mac scelto dall'utente

**Contesto**: ADR-0115 decide database, libreria, hash della password e
token. Restavano i nomi degli endpoint, gli errori che l'app deve
distinguere, il limite ai tentativi, cosa fa l'API senza database e come
girano i test con un database vero.

**Decisione**:
- **Endpoint**: `POST /accounts` (iscriversi, e si entra), `POST /session`
  (entrare), `DELETE /session` (uscire da questo telefono), `GET /me`,
  `DELETE /me`. Il token va in `Authorization: Bearer`, separato dalla
  chiave dell'API in `X-API-Key` (ADR-0076). Gli altri endpoint restano
  aperti; quelli che verranno usano la dipendenza `current_user`.
- **Errori**: sei codici nuovi, in `schemas.py` e `shared-types`:
  `email_taken` e `username_taken` (409), `wrong_credentials`,
  `not_signed_in` e `session_expired` (401), `accounts_unavailable` (503).
  Troppi tentativi riusano `too_many_requests` (429, `Retry-After`).
- **Email sconosciuta e password sbagliata** danno la stessa risposta, nello
  stesso tempo (la password si verifica contro un hash finto): la risposta
  non dice chi è iscritto. L'iscrizione con un'email già usata invece lo
  dice (`email_taken`): il task lo chiede, e senza l'app non saprebbe cosa
  rispondere.
- **Tentativi**: 5 password sbagliate per la stessa email in 15 minuti,
  poi 429 finché la più vecchia esce dalla finestra, anche con la password
  giusta. In memoria: un riavvio li azzera, accettato per un'API con un
  solo processo. Il limite dei POST di ADR-0076 vale in più.
- **Valori**: email in minuscolo, fino a 254 caratteri; password 8–128
  (Argon2 legge tutto: il tetto evita un «password» da un megabyte); nome
  3–20 fra lettere, cifre, `_` e `.`, unico senza badare alle maiuscole e
  mostrato com'è scritto.
- **Scadenza**: una sessione vale finché l'ultimo uso è entro 90 giorni, e
  ogni uso la allunga. Quella scaduta si cancella al primo uso e risponde
  `session_expired` una volta, poi `not_signed_in`.
- **`DELETE /me`** basta il token, senza ripetere la password: la conferma
  la chiede l'app (TASK-115, TASK-121).
- **Senza database** (`SHAPEROUTE_DATABASE_URL` vuota) l'API parte come
  prima e gli account rispondono `503 accounts_unavailable`. **Con
  l'indirizzo ma il database irraggiungibile**, o una migrazione che
  fallisce, l'API non parte e dice perché: meglio che account rotti una
  richiesta alla volta.
- **Migrazioni**: le applica `__main__` prima di aprire la porta, ognuna
  nella sua transazione, sotto un advisory lock; una che fallisce non
  lascia niente. L'estensione PostGIS la crea la prima migrazione con una
  geometria.
- **Connessioni**: una per richiesta, nessun pool (`psycopg_pool` sarebbe
  un pacchetto in più); da rivedere se gli account diventano tanti.
- **Test**: `conftest.py` avvia `postgis/postgis:16-3.4` con docker, una
  volta per giro, e dà a ogni test un database vuoto. I runner della CI
  hanno docker: `ci.yml` non cambia. Senza docker i test del database si
  saltano sul PC e falliscono in CI. Sul Mac docker è Colima (scelta
  dell'utente, 2026-10-02): niente Docker Desktop né licenze.

**Scartate**: `/signup` e `/login` (verbi, mentre l'API nomina le cose);
un servizio `postgres` nella CI (cambia `ci.yml`, e il conftest basta);
un database finto o SQLite nei test (`DATABASE.md`: niente finti);
un 401 diverso per l'email sconosciuta (direbbe chi è iscritto).

**Conseguenze**: TASK-115 usa questi endpoint e i tipi di `shared-types`
(`SignUpRequest`, `Session`, `User`). TASK-122 mette il database sul
server, accanto all'API, con `SHAPEROUTE_DATABASE_URL`. La password
dimenticata resta fuori: serve la posta (Brevo, ADR-0115).

## ADR-0122 — Correre senza percorso: «Run» registra solo la traccia
**Stato**: Attiva · 2026-10-02 · chiesto dall'utente («la possibilità
anche di iniziare una corsa senza disegnare nulla, magari la prima
facciata scrivi Run»); il come deciso dall'agente su delega dell'utente
(TASK-149). Toccare `App.tsx`, che è anche di TASK-132 (in corso), è
segnalato nella PR: le righe cambiate sono altre.

**Contesto**: fino a qui una corsa partiva solo da un percorso (disegnato
o di «Explore») con le indicazioni, e la traccia registrata (ADR-0091)
serviva al punteggio (ADR-0090). Chi vuole solo correre doveva disegnare
qualcosa.

**Decisione**:
- **«Run» nella prima schermata**, un pulsante come «Explore», accanto a
  lui: la corsa parte subito, dal GPS, senza scegliere partenza, forma o
  distanza.
- **Stessa traccia, stesso file**: `startRun` di TASK-112 con il percorso
  vuoto (`FREE_ROUTE`). Valgono le regole di ADR-0091 (posizioni scartate,
  salvataggio ogni 15 s, «una corsa per volta», ripresa entro 30 minuti),
  e un percorso vuoto basta a riconoscere una corsa libera nel file
  (`pendingFreeRun`). Nessuna modifica a `trackStore.ts`.
- **Niente punteggio e niente API**: senza forma non c'è niente da
  giudicare. La fine della corsa mostra km, tempo e passo medio; «Done» la
  cancella subito dal telefono (una corsa con la forma resta finché non ha
  il punteggio).
- **Banner da corsa**: km con due decimali, tempo dalla prima posizione
  (va avanti ogni secondo), passo medio dopo 100 m.
- **La voce a ogni km** (chiesta dall'utente dopo la prima versione): km,
  tempo e passo medio, come un orologio da corsa, con la voce della
  navigazione (`play`, inglese). Una volta per km: se il GPS ne salta uno,
  si dice l'ultimo; una corsa ripresa non ripete i km già detti. Senza
  vibrazione: in navigazione la vibrazione è una svolta.
- **Codice in file nuovi** (`freeRun.ts`, `useFreeRun.ts`,
  `FreeRunScreen.tsx`); `App.tsx` collega le due schermate nuove (`run`,
  `runFinish`) e `ChooseScreen.tsx` ha il pulsante.

**Alternative scartate**: un file a parte per le corse libere (due corse
in corso insieme, e la ripresa da riscrivere); usare `useNavigation` con
un percorso vuoto (il navigatore vuole una linea e dice «You have
arrived»); chiedere un punteggio di sola distanza all'API (non c'è niente
da confrontare); salvare le corse finite (è la cronologia, TASK-117).

**Conseguenza**: dopo uno «Stop» la mappa resta dove si è partiti a zoom
15, non inquadra tutta la linea: inquadrarla vuole un messaggio nuovo
della pagina della mappa (seguito possibile). Il messaggio di «Pocket»
parla di indicazioni anche qui. Da provare sull'iPhone, anche la voce a
schermo nero.

## ADR-0123 — Il database sul server, e le sue copie sul Mac
**Stato**: Attiva · 2026-10-02 · le copie sul Mac sono una **scelta
dell'utente**; il resto deciso dall'agente su delega dell'utente
(TASK-122). Cambia ADR-0115 per le copie di sicurezza.

**Contesto**: ADR-0115 metteva il database sulla VM dell'API e le copie
nell'Object Storage gratuito di Oracle. L'API pubblicata è su Hetzner
(ADR-0111) e Oracle non c'è più. TASK-122 porta gli account (TASK-114)
sul server, e con loro lo spostamento del server su `deploy/compose.yaml`
(`DEPLOY.md` F.12), fatto una volta sola con il database dentro.

**Decisione**:
- **Il servizio `db`** in `deploy/compose.yaml`: `postgis/postgis:16-3.4`,
  i dati nel volume `db` e non in `data/` (`data-owner` dà `data/`
  all'utente dell'API, PostgreSQL vuole i suoi), nessuna porta verso
  fuori, un controllo di salute; l'API parte quando il database risponde e
  ha il suo indirizzo da `POSTGRES_PASSWORD` (solo lettere e cifre, perché
  sta dentro un URL). Il database c'è sempre, senza profili: gli account
  sono parte dell'app.
- **La copia notturna** nel servizio `backup`, con la stessa immagine (un
  `pg_dump` della stessa versione del server): ogni giorno alle 02:00 UTC,
  formato custom, scritta con un nome nascosto e rinominata quando è
  intera, leggibile solo dal proprietario. Le copie con più di 13 giorni
  si cancellano, e solo dopo una copia riuscita: un account cancellato
  esce da ogni copia entro 14 giorni (ADR-0114, punto 7). `backup.sh
  check` ripristina una copia in un database a parte e lo cancella.
- **Le copie sul Mac** (scelta dell'utente, fra il *Backup* di Hetzner, lo
  Storage Box, un object storage S3 e il Mac): `launchd` ogni 6 ore e
  all'accesso, `rsync` sopra SSH con la chiave che il Mac usa già; le
  copie del database sono uguali a quelle del server e quelle con più di
  13 giorni si cancellano anche a server irraggiungibile; gli eventi delle
  ricerche si aggiungono e non si cancellano.
- **La CI** (job `docker`): con `POSTGRES_PASSWORD`, un'iscrizione vera
  (`201`), `/me` senza token (`401`, cioè account accesi), una copia, il
  suo ripristino con un account dentro, il file in modo `600`.
- **Il ripristino vero** cancella e ricrea il database e vi ripristina la
  copia; l'API, riavviata, riapplica le migrazioni più nuove della copia.

**Scartate**: il *Backup* di Hetzner (+20%), lo Storage Box e un object
storage (scelta dell'utente: il Mac, gratis; il primo resta possibile in
più); i dati del database in una cartella di `data/` (il `chown` di
`data-owner` li toglierebbe a PostgreSQL); un `cron` sul server (un
servizio di `compose.yaml` si avvia con tutto il resto, con un comando);
tenere le ultime 14 copie invece dei 13 giorni (una copia fatta a mano in
più accorcerebbe i giorni, e la promessa dei 14 giorni è sui giorni).

**Conseguenze**: a Mac spento per giorni le copie stanno solo sul server.
Il server passa su `compose.yaml` dentro TASK-122, dopo il sì
dell'utente. Sul Mac Docker vuole il plugin `buildx`: senza BuildKit
l'heredoc del `Dockerfile` si salta in silenzio e l'immagine nasce senza
dipendenze (visto il 2026-10-02; la CI e il server hanno BuildKit).

**Aggiornamento 2026-10-02** (scelta dell'utente: «Storage Box, sposto
ora»): le copie fuori dal server vanno in uno **Storage Box Hetzner**
(BX11, Falkenstein), non sul Mac; `deploy/mac/` è tolto. Un servizio
`offsite` le manda ogni notte alle 02:30 UTC, mezz'ora dopo la copia, con
`rsync` sopra SSH sulla porta 23: le copie del database in `sgrava-db/`,
le stesse del server (quelle con più di 13 giorni spariscono anche lì, e
la promessa dei 14 giorni vale anche fuori), e gli eventi delle ricerche
in `sgrava-insights/`, solo aggiunti. `offsite` è un'immagine Alpine a
parte: quella di `postgis/postgis:16-3.4` è su Debian 11, il suo archivio
di PostgreSQL non c'è più e lì non si installa niente. La chiave è una
chiave SSH dedicata, generata sul server in `/root/.ssh/storagebox/`, fuori
dal repository; la chiave dello Storage Box si fissa una volta in
`known_hosts`. Lo Storage Box lo crea l'utente nel pannello; finché non
c'è, le copie restano sul server. Il server è passato su `compose.yaml`
con il database lo stesso giorno, alle 07:27Z, con 18 s di API ferma. Un
server di sviluppo, se l'utente lo vorrà, è un task a parte.

## ADR-0125 — L'account nell'app: due schede, la sessione nel portachiavi, l'uscita
**Stato**: Attiva · 2026-10-02 · deciso dall'agente su delega dell'utente,
dentro ADR-0114, ADR-0115 e ADR-0120 (TASK-115)

**Contesto**: ADR-0114 e ADR-0115 decidono email e password e il token in
`expo-secure-store`; ADR-0120 gli endpoint e gli errori. Restavano come
fare le schede senza librerie di navigazione (TASK-051), cosa tiene il
telefono, cosa fa l'app senza rete e cosa fa quando la sessione finisce.

**Decisione**:
- **Schede fatte a mano** (`src/screens/Tabs.tsx`), come le schermate di
  TASK-051: niente `react-navigation`. «Draw» resta montata sotto
  «Profile», così la mappa non si ricarica e le scelte restano.
- **La barra solo sotto le schermate che scelgono** («What to draw»,
  «Explore»): ognuna lo dice con `useTabBar`; mappa, corsa e fine della
  corsa la tolgono, come le app iOS nelle schermate di dettaglio. È
  l'elenco di chi la vuole, non di chi non la vuole: una schermata nuova
  (TASK-149) parte senza. Sopra la barra il margine in basso vale zero
  (`SafeAreaInsetsContext`): l'indicatore di home lo tiene la barra.
- **Nel portachiavi la `Session` intera**, token e `User`, sotto una chiave
  sola (`shaperoute.session`), letta in modo sincrono all'avvio come la
  corsa non giudicata (TASK-113): la prima schermata è già giusta, e il
  nome si vede anche senza rete. La password non resta mai sul telefono.
- **All'apertura un `GET /me`**: aggiorna l'utente; `session_expired` o
  `not_signed_in` fanno uscire e «Profile» lo dice, con un pallino
  `warning` sulla scheda; senza risposta l'app resta dentro (offline non
  è uscito). Lo stesso vale per ogni richiesta dell'account.
- **«Log out» esce subito**, anche senza rete: il telefono dimentica il
  token e `DELETE /session` parte senza aspettarlo. Un'API irraggiungibile
  non tiene nessuno dentro; la sessione rimasta sull'API scade in 90
  giorni.
- **«Delete account» esce solo con il 204 dell'API**: altrimenti
  l'account resterebbe sull'API e sparirebbe dal telefono. La conferma è
  sulla schermata, non un `Alert` di sistema: si prova nei test.
- **I campi si controllano nell'app** con le regole di `accounts.py`
  (email, nome 3–20, password 8–128, casella dei 16 anni), e si dice il
  primo che non va: l'API resta il giudice, l'app evita un `invalid_request`
  che sarebbe un bug.

**Scartate**: `react-navigation` (una dipendenza in più contro TASK-051);
il solo token nel portachiavi (senza rete l'app non saprebbe chi è
dentro); la barra sempre visibile (ruba spazio alla mappa e alla corsa);
un «Log out» che aspetta l'API; un `Alert` per la conferma.

**Conseguenze**: i task che useranno il token (TASK-116 e seguenti)
lo prendono dallo stato di `useAccount` (`src/account/`, oggi tenuto da
`Tabs.tsx`: un contesto React quando servirà a più schermate) e lo
mandano con `authHeaders` di `src/api/accounts.ts`.

## ADR-0126 — «Explore»: gli esempi di una città con le alternative A · B · C
**Stato**: Attiva · 2026-10-02 · chiesto dall'utente («seleziono New York
e un cuore da 5,2 km: non ci sono le tre opzioni»); il come deciso
dall'agente su delega dell'utente (TASK-151).

**Contesto**: un esempio di città (ADR-0116) è un percorso chiesto
all'API come uno disegnato, e l'API manda già fino a due alternative
(ADR-0087; sul server da ADR-0121). L'app teneva solo il primo percorso,
quindi la scheda di «Explore» non aveva le tessere. `App.tsx`, che passa
alla scheda il percorso aperto, è di altri tre task in corso.

**Decisione**:
- **L'esempio tiene le alternative**, ognuna un percorso intero
  (`ExampleDetail.alternatives`), in memoria e nel file sul telefono. Il
  campo c'è sempre, anche vuoto.
- **Un esempio salvato senza il campo si ridisegna**, una volta: è di
  prima di questo task, e senza rifarlo le città già viste non avrebbero
  mai le tessere. Con la zona in cache sono pochi secondi a forma.
- **La scelta sta dentro il percorso aperto** (`useExplored`): `choices`,
  `chosen`, `choose`, e `route`, `detail`, `request`, `result` sono quelli
  del percorso scelto. `App.tsx` li legge già così, quindi mappa, «Start»
  (ADR-0117) e GPX seguono la scelta senza toccarlo. Ogni percorso ha il
  suo `result`, fatto una volta: è da quello che «Start» e l'export
  riconoscono un percorso.
- **Le tessere sono quelle di sempre** (`RouteTiles`), sopra «Start».
  Mentre si aspettano le indicazioni un tocco non cambia percorso: la
  risposta in arrivo è di quello scelto.

**Scartate**: tenere la scelta in `App.tsx` come per i percorsi disegnati
(il file è occupato; da rivedere insieme alle linee grigie); mostrare gli
esempi vecchi senza tessere (l'utente non le vedrebbe mai sul cuore che
ha già); un file nuovo sul telefono (lascerebbe il vecchio orfano).

**Conseguenze**: gli altri percorsi non sono in grigio sulla mappa e la
scelta non manda il segnale di ADR-0112: tutte e due le cose passano da
`App.tsx`, seguiti scritti in `tasks/TASK-151.md`. I percorsi del catalogo
e quelli a tema restano uno solo. Provato sull'API del Mac a New York:
cuore, cerchio e stella da 5 km arrivano con due alternative ciascuno.

## ADR-0124 — Tre pagine affiancate con lo swipe, al posto delle schede in basso
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** per il cosa («vai
con lo swipe fra le tre pagine», fra la variante con i nomi in alto e
quella con la barra in basso); il come deciso dall'agente su delega
dell'utente (TASK-154). **Supera**, di ADR-0125, i punti «Schede fatte a
mano» e «La barra solo sotto le schermate che scelgono».

**Contesto**: l'utente ha chiesto di passare fra le schermate con uno
swipe a destra e a sinistra, con «Explore» da un lato e dall'altro una
pagina con i disegni pubblicati dagli iscritti. TASK-115 aveva appena
messo due schede in basso, «Draw» e «Profile»; «Explore» si apriva da un
pulsante della prima schermata e si chiudeva con «←».

**Decisione**:
- **Tre pagine, in quest'ordine**: «Feed», «Draw», «Explore». L'app si
  apre su «Draw», al centro. I nomi in alto sono anche i comandi: si
  toccano, e mostrano l'ordine delle pagine.
- **Lo scorrimento a pagine di React Native** (`ScrollView` orizzontale
  con `pagingEnabled`, `src/screens/Pager.tsx`): nessuna dipendenza nuova,
  nessuna libreria di navigazione, come in TASK-051.
- **Lo stato resta in `App.tsx`**: `feed`, `choose` ed `explore` sono tre
  valori di `Screen`, e il pager dice quale è sullo schermo. Mappa, corsa e
  fine corsa restano schermate intere: lì il pager non è montato, così lo
  swipe non compete con il dito sulla mappa.
- **«Explore» si monta alla prima visita** (`lazy`): chiede i percorsi
  all'API appena si apre, e non deve farlo a ogni avvio dell'app. Si monta
  ai primi pixel dello swipe verso di lei, così entra già disegnata. Le
  altre due pagine sono montate subito.
- **La barra in basso sparisce**. «Profile» si apre da un pulsante tondo
  accanto ai nomi e si chiude con «←» (`src/screens/ProfileLayer.tsx`, al
  posto di `Tabs.tsx`); il pallino `warning` della sessione finita passa
  sul pulsante. `useTabBar` non serve più.
- **La figura del pulsante è disegnata con due `View`**, testa e spalle:
  l'app non ha icone né `react-native-svg`. Con un account, l'iniziale.
- **«Feed» per ora è una pagina vuota e onesta**: dice che lì arriveranno
  i disegni pubblicati. La riempie TASK-118.
- **Sotto l'intestazione il margine in alto vale zero**
  (`SafeAreaInsetsContext`): la tacca la tiene l'intestazione, e le
  schermate di prima non cambiano.
- **Una pagina fuori dallo schermo è nascosta all'accessibilità**: uno
  screen reader legge solo la pagina che si vede.

**Scartate**: la barra in basso con quattro schede (la variante B del
canvas: l'utente ha scelto l'altra); `react-navigation` o
`react-native-pager-view` (dipendenze nuove contro TASK-051); un gesto
fatto a mano con `PanResponder` (lo scorrimento a pagine del sistema ha già
inerzia e rimbalzo giusti); montare «Explore» all'avvio (una richiesta
all'API a ogni apertura, anche per chi non la guarda).

**Conseguenze**: TASK-118 riempie `FeedScreen.tsx` e non ha più `Tabs.tsx`
da toccare. Le righe che scorrono di lato dentro una pagina (le tessere,
le città) dovrebbero tenere il gesto per sé, con lo swipe fra le pagine
che parte da fuori: va provato con il dito sull'iPhone, e su Android non è
stato provato niente. Il nome «Sgrava» resta in
cima a «Draw» e «Best near you» in cima a «Explore»: toglierli o no è
parte del ridisegno delle due pagine, non ancora scelto.

**Aggiunta del 2026-10-13 (TASK-278): il proprio profilo come quarta
pagina.** **Deciso dall'utente il 2026-10-11** il cosa («Dopo explore metti
il mio profilo personale facendo uno swipe a sinistra»; in alto tre nomi
più il cerchio, che si illumina; scartati quattro nomi in alto, che accanto
allo sport non ci stanno su un iPhone da 390 pt né in tedesco); dall'utente
il 2026-10-13 la pagina senza titolo e il testo nuovo di «Help»; il come
deciso dall'agente su delega dell'utente.

- **Quattro pagine**: «Feed», «Draw», «Explore» e, a destra, il profilo
  (`profile` in `PAGES` di `App.tsx`). La quarta pagina non ha un nome in
  alto (`unnamed` in `Pager.tsx`): ci porta il cerchio di «Profile», che ha
  la lineetta della pagina accesa quando è lì e per VoiceOver è
  «selezionato» (`ProfileButton` con `selected` e `onPress`). La lineetta
  sta sotto il cerchio, nello spazio in fondo all'intestazione, che resta
  alta com'era. Si monta alla prima visita (`lazy`), come «Explore».
- **La pagina è la prima di «Profile»** (`OwnProfile` in
  `ProfileLayer.tsx`, che mostra `ProfileScreen` senza `onBack`: niente «←»
  né titolo, come le altre pagine). Si rifà ogni volta che torna sullo
  schermo (una `key` che cresce): gli elenchi di chi segue e i disegni si
  rileggono come quando «Profile» si apriva sopra l'app, e il numero rosso
  delle richieste apre ancora «Requests».
- **Le pagine che apre restano sopra l'app** («Settings», «Favorites», «My
  activities», «Edit profile», «Guide», il profilo di un altro), con lo
  strato e i contesti dove erano: `ProfileLayer` ricorda da dove si è
  partiti (`home`, la quarta pagina o lo strato) e «←» verso la prima
  pagina chiude lo strato quando si era partiti dalla quarta. Un disegno
  aperto dalla pagina torna alla pagina sotto la mappa, come da «Feed».
  «Guide» aperto da lì torna lì, non a «Settings».
- **Gli altri ingressi restano come prima**: il cuore e «Save» senza
  account, la lente di «Feed» senza account, un nome taggato, una notifica
  aprono «Profile» sopra l'app. Portarli alla quarta pagina è una scelta
  dell'utente, da chiedere.
- Il giro di benvenuto (ADR-0235) regge con quattro pagine: non nomina il
  loro numero, e il passo dell'intestazione dice già «In your profile…».
  «Help» lo diceva («three pages»): cambiato nelle cinque lingue.

**Scartate**: aprire anche le pagine del profilo dentro la quarta pagina
(cambierebbe dove sono, fuori dal task); tenere «Profile» sopra l'app e
aggiungere solo lo swipe (due posti per la stessa pagina); una pagina che
non si rifà mai (elenchi e richieste vecchi fino alla riapertura dell'app).

**Conseguenze**: uno swipe che arriva sul profilo mostra per un attimo
gli elenchi di prima, poi i trattini mentre si rileggono; un tocco sul
cerchio no, perché la pagina si rifà prima di scorrere.

**Aggiunta del 2026-10-13 (TASK-278 parte B): gli altri ingressi alla
quarta pagina.** **Deciso dall'utente il 2026-10-13** il cosa («sì, portali
tutti alla 4ª pagina»; poi, alle due domande della sessione: «4ª pagina, poi
torni» per il cuore e «Save», «Torna dov'eri» per il profilo di un altro);
il come deciso dall'agente su delega dell'utente.

- **Cuore e «Save» senza account** stanno sulla mappa e sulla fine della
  corsa, che prendono tutto lo schermo: portano alla quarta pagina con la
  loro riga sopra «Sign up» e, solo finché nessuno entra, con «←» e il
  titolo «Profile» (`OwnProfile` con `onBack`), che tornano lì senza
  tenere niente. Appena si entra l'app torna da sola dov'era: il percorso
  è tenuto (come prima, quando arriva l'elenco dei preferiti), la fine
  della corsa ha «Save» e «Discard». Uno swipe o un nome lasciano la mappa
  o la fine della corsa: il percorso non si tiene (`forgetWaiting`, come
  il vecchio «←»), la corsa resta sul telefono e torna alla prossima
  apertura.
- **La lente di «Feed» senza account** porta alla quarta pagina con «Log
  in to find your friends.», senza «←»: si parte da una pagina.
- **Il profilo di un altro** (nome taggato, notifica) resta sopra l'app;
  «←» chiude e mostra l'app com'era (`home` = `app`), non più «Profile».
  **Il proprio nome** chiude il disegno e porta alla quarta pagina; una
  notifica non lo porta mai (l'API non avvisa l'account di quello che fa
  lui), ma passa dalla stessa porta. Durante una corsa nessuna richiesta
  la toglie dallo schermo.
- **Un disegno di una notifica** toccata mentre una pagina del profilo è
  sopra la quarta pagina torna, con «Back to the profile», alla quarta
  pagina invece di aprire «Profile» sopra l'app.
- **Come**: `ProfileLayer` chiude ciò che è sopra l'app e conta la
  richiesta con la riga del perché (`OwnAsk`, letto con `useOwnPage`);
  `App.tsx` va alla quarta pagina a ogni richiesta nuova e ricorda da dove
  (`profileFrom`, solo dalla mappa o dalla fine della corsa senza account)
  per «←» e per il ritorno dopo l'ingresso. Uscendo dalla quarta pagina
  (`leave`) la riga va via. Le liste di «Profile» aperto sopra l'app dal
  cerchio fuori dal pager (oggi solo nei test) tornano lì come prima
  (`home` = `layer`).

**Scartate** (dall'utente): la quarta pagina senza «←» anche da mappa e
fine corsa (chi non entra perde la fine della corsa fino alla prossima
apertura); cuore e «Save» ancora sopra l'app; «←» dal profilo di un altro
alla quarta pagina. (Dall'agente): far decidere a ogni porta se c'è «←»
invece che dallo schermo di partenza; un'attesa dell'ingresso in un
`useEffect`, che il lint di React rifiuta.

**Conseguenze**: dalla mappa e dalla fine della corsa la quarta pagina
ha, per poco, sia lo swipe sia «←»; chi entra non vede il proprio profilo
ma torna subito dov'era. Nessun testo nuovo.

## ADR-0127 — «Feed» con quindici esempi dal catalogo, finché non pubblicano gli iscritti
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** per il cosa («nella
sezione feed crea già in automatico 15 attività con nomi inventati, utenti
inventati, che hanno fatto delle figure in sette città differenti d'Italia,
e seleziona le figure che sono venute meglio»); il come deciso dall'agente
su delega dell'utente (TASK-156).

**Contesto**: dopo TASK-154 «Feed» era una pagina vuota. Il feed vero
(TASK-118) vuole account, disegni salvati e un endpoint: non c'è ancora.
L'utente vuole la pagina piena da subito.

**Decisione**:
- **Le linee vengono dal catalogo seme** (`catalog/seed/`, sette città): le
  ha tracciate il motore, e uno script (`tools/sample_feed.py`) le sceglie
  e le scrive in `apps/mobile/src/feed/sampleFeed.json`. Nessuna coordinata
  è inventata, né dall'AI né a mano (`CLAUDE.md`).
- **La scelta**: ogni città dà due figure di forme diverse, le sue meglio
  riuscite; fra quelle riuscite almeno al 95% prende prima una forma non
  ancora nel feed; nessuna forma più di due volte; scelgono prima le città
  con meno figure buone; la quindicesima è la migliore rimasta. Oggi: 11
  forme, somiglianza minima 0,954, Firenze con tre.
- **Meno punti, stessi angoli**: ogni linea scende a 120 punti al più con
  Douglas-Peucker in metri, non un punto ogni tanti come l'anteprima
  dell'API a 64: a tutta larghezza gli angoli contano.
- **Inventati e sempre uguali**: corridori, titoli, tempi (da 5:15 a 6:40
  al km) e punteggi (qualche punto sotto la somiglianza) escono dallo
  script con regole fisse. Il file cambia solo se cambia il catalogo, e si
  rifà a mano: nessun test lo lega al catalogo, così chi aggiunge una città
  non rompe la CI di questo.
- **Niente sulla pagina dice che sono esempi**: scelta dell'utente
  (2026-10-02). L'agente aveva messo una riga in cima («Examples, drawn by
  the route engine on real streets…») perché corridori finti mostrati come
  veri ingannano chi entra; l'utente, sentito il motivo, l'ha fatta
  togliere. Niente like, commenti o tocchi: quelle cose non esistono ancora.
- **I dati stanno nell'app**, non nell'API: nessuna richiesta, funziona
  senza rete. Il disegno si fa come le miniature di «Explore»
  (`thumbSegments`), una `View` per tratto, in un elenco che monta poche
  schede alla volta.

**Scartate**: scrivere a mano corridori e linee; chiedere i percorsi
all'API a ogni apertura (sette richieste per una pagina di esempi); like e
commenti finti; orari finti («2 h ago» per sempre).

**Conseguenze**: TASK-118 sostituisce gli esempi con i disegni veri, o li
tiene sotto finché sono pochi: lo decide l'utente allora. **Prima di
invitare persone che non conoscono l'app** (il cancello di `ROADMAP.md`,
«La parte social») va rivisto se gli esempi restano senza dirlo: chi entra
li prende per corse di iscritti veri. Gli `id` sono
quelli che l'API dà ai percorsi del catalogo: servono a TASK-118 per aprire
il percorso dal feed. Se il catalogo cambia, `python tools/sample_feed.py`
rifà il file.

## ADR-0129 — Il logo: una S fatta come un percorso, l'icona dell'app e il suo nome
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** fra tre proposte
(«scelgo la A, metti l'icona nell'app») e per il nome («cambia il nome
sotto l'icona in Sgrava»); le misure e i file decisi dall'agente su delega
dell'utente (TASK-159).

**Contesto**: l'utente ha chiesto un logo «più futuristico, più moderno» di
quello disegnato a mano il 2026-09-20 («grava» su asfalto). L'icona
dell'app era ancora il segnaposto di Expo, azzurro.

**Decisione**:
- **Il segno**: una S di un tratto solo, con gli angoli arrotondati, e un
  punto in alto a destra: il percorso e la sua partenza. In un quadro di
  77 × 87: tratto `M40 24H12Q0 24 0 36V48Q0 60 12 60H48Q60 60 60 72V84Q60
  96 48 96H0`, largo 14, estremità tonde; punto in (62, 24), raggio 8.
- **Il logo**: il segno fa da S, seguito da «GRAVA» con lo stesso tratto;
  le due A senza trattino, come la V rovesciata. Come nel logo di prima, il
  segno è la prima lettera del nome.
- **I colori sono quelli del tema** (ADR-0046): giallo `#FFD02B` su nero
  `#0A0A0B`, o nero su giallo. Nessun colore nuovo.
- **L'icona**: il segno giallo su nero, alto il 53% del lato; 1024 × 1024,
  senza trasparenza (l'App Store la rifiuta). Su Android il segno è alto il
  43% del lato, dentro il cerchio sicuro dell'icona adattiva; fondo nero,
  icona a un colore bianca su trasparente.
- **Il nome sotto l'icona è «Sgrava»**: `name` in `app.json`, che era
  ancora «ShapeRoute». `slug` (`shaperoute`), `bundleIdentifier` e il
  progetto EAS non cambiano: gli aggiornamenti arrivano come prima.
- **I vettoriali stanno in `docs/brand/`**: le immagini si rifanno da lì.
  Nessuno script nel repository: sono sei immagini, rifatte di rado.

**Scartate**: «Nodi», la S su una griglia di incroci (i puntini si perdono
sotto i 30 px); «Scatto», due frecce inclinate (simile a molti marchi
sportivi); il fondo giallo con il segno nero per l'icona (nell'app il
giallo è il percorso su fondo nero, e l'icona lo anticipa).

**Conseguenze**: le proposte, l'immagine del profilo e i post per Instagram
stanno in un canvas privato dell'utente, non nel repository. La schermata
di avvio non è configurata in `app.json`: `splash-icon.png` è ridisegnata
ma non usata. L'icona e il nome sulla schermata di casa si vedono solo in
una build propria (TASK-152). Una cartella `ios/` generata prima porta il
nome vecchio: si rifà con `npx expo prebuild --clean`. Tre testi dell'app
dicono ancora «Location is off for ShapeRoute…»: da allineare in un task a
parte, perché in una build propria le Impostazioni elencano «Sgrava».

## ADR-0131 — La mappa sotto i disegni di «Feed» è una foto, fatta da una pagina nascosta
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** per il cosa («nella
sezione feed sotto le immagini, bisogna aggiungere la mappa»); il come
deciso dall'agente su delega dell'utente (TASK-162).

**Contesto**: da TASK-156 una scheda di «Feed» è la linea gialla su un
fondo vuoto. L'utente vuole sotto la mappa. La mappa dell'app è MapLibre
GL JS in una WebView (ADR-0029): una per scheda vorrebbe dire fino a una
decina di pagine con WebGL vive insieme in un elenco che scorre.
OpenFreeMap dà solo tile vettoriali: non c'è un'immagine da chiedere.

**Decisione**:
- **Una foto, non una mappa**: la scheda non si tocca (ADR-0127), quindi
  le basta un'immagine. **Una sola pagina MapLibre**, in «Feed», sotto
  l'elenco che la copre: inquadra una mappa alla volta, aspetta che ogni
  tile sia disegnata (`idle`) e manda all'app il canvas come JPEG
  (`toDataURL`, `preserveDrawingBuffer`). La scheda lo mostra con `Image`
  sotto la linea.
- **Stesso stile e stessa libreria della mappa grande** (`MAP_STYLE`,
  MapLibre con SRI): i colori restano i token, niente chiave. Senza
  controlli e senza gesti.
- **La linea resta dell'app**: le `View` di `thumbSegments`, sopra la foto.
  `lineCamera` dà a MapLibre centro e zoom dello stesso riquadro; su pochi
  chilometri la proiezione della mappa e quella piana della linea
  differiscono di meno di un punto (un test lo misura). Così la scheda è
  subito quella di prima, e la mappa le arriva sotto.
- **Una alla volta, a richiesta**: la foto la chiede la scheda quando
  l'elenco la monta (`useFeedMap`); la pagina c'è solo finché c'è una foto
  da fare, poi si smonta e libera la memoria. Ogni richiesta porta la sua
  misura: la pagina si ridimensiona da sola.
- **Le foto restano in memoria** per tutta la vita dell'app, per `id` e
  misura: il `Pager` smonta «Feed» ogni volta che si apre la mappa grande.
- **Quando non va**: una tile che manca dà una scheda senza mappa, non
  mezza mappa; una foto che non arriva in 20 s si salta; se MapLibre non si
  carica la pagina si smonta. Nessun messaggio: la scheda senza mappa è
  quella di TASK-156. Una scheda che torna sullo schermo richiede.
- **Il credito su ogni foto**: «OpenFreeMap © OpenMapTiles / Data from
  OpenStreetMap», il testo di `ATTRIBUTION`, senza link perché la scheda
  non si tocca. In due righe, in basso a destra, accanto al punteggio.

**Scartate**: una WebView per scheda (memoria, e i gesti della mappa
contro lo swipe delle pagine); immagini già pronte nell'app, fatte da uno
script (vuole un browser senza testa fra gli strumenti, e non serve al feed
vero); tile raster di un altro fornitore (un'altra mappa, chiara, e una
chiave); disegnare anche la linea in MapLibre (la scheda resterebbe vuota
finché la foto non arriva).

**Conseguenze**: all'apertura dell'app partono le foto delle prime schede
(«Feed» è costruita subito: `App.tsx` non si tocca qui), cioè MapLibre da
unpkg e qualche tile per città; nel simulatore 2 s la prima volta, meno di
1 s con le tile in cache. Le foto non restano fra un'apertura e l'altra.
Con il feed vero (TASK-118) la stessa pagina fotografa qualsiasi linea, ma
serve un tetto alle foto in memoria. `FeedPost` mostrato altrove (TASK-163)
ha la mappa finché «Feed» è montata. Android non è stato provato.

## ADR-0134 — La schermata di avvio: `expo-splash-screen`, logo su nero
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** per il cosa («metti
anche la schermata di avvio con il logo») e per la dipendenza («Sì,
aggiungila»); il come deciso dall'agente su delega dell'utente (TASK-165).

**Contesto**: l'app non aveva una schermata di avvio. In Expo SDK 57 la
chiave `splash` di `app.json` non esiste più, tranne che per il web: la
schermata nativa la scrive solo il plugin del pacchetto `expo-splash-screen`,
che nel progetto non c'era.

**Decisione**:
- **Dipendenza nuova: `expo-splash-screen` ~57.0.9**, il pacchetto ufficiale
  di Expo per l'SDK 57 (è in `bundledNativeModules.json` di `expo`, quindi
  fra i moduli che Expo Go ha già dentro). Con sé porta `xml2js`,
  `@expo/image-utils` e `@expo/config-plugins`, già nel lock.
- **Solo il plugin, nessun codice**: l'app non importa il modulo e non
  chiama `preventAutoHide`. La schermata sparisce quando l'app è pronta.
  In Expo Go quindi non cambia niente, e un `eas update` resta sicuro.
- **Fondo `#0A0A0B`, logo giallo** (ADR-0129, ADR-0046).
- **Su iOS il logo intero**, largo 260 punti: `assets/splash-logo.png`,
  1040 × 1040 trasparente, perché il plugin mette l'immagine in un quadrato
  largo `imageWidth`.
- **Su Android il segno da solo**, `assets/splash-icon.png` a 240 dp: da
  Android 12 il sistema ritaglia l'immagine in un cerchio di 192 dp, dove
  il logo largo starebbe minuscolo; il segno ha una diagonale di 131 dp.

**Scartate**: un plugin scritto da noi per non aggiungere il pacchetto
(codice nativo generato a mano, da provare e mantenere); un componente
React che mostra il logo all'avvio (prima che parta il JavaScript lo schermo
resta vuoto, e toccava `App.tsx`); il logo intero anche su Android.

**Conseguenze**: si vede solo in una build propria (TASK-152). Il prebuild
di prova genera `SplashScreen.storyboard` con il logo in un riquadro di
260 × 260 al centro e il colore `SplashScreenBackground` a `#0A0A0B`; su
Android `windowSplashScreenBackground` e `splashscreen_logo`. Il prebuild
scrive anche `android.package` in `app.json` e cambia due script di
`package.json`: sono effetti della prova, non vanno committati. Tenere la
schermata finché i dati sono pronti vorrebbe `preventAutoHide` in `App.tsx`:
un task a parte, se servirà.

**Aggiornamento 2026-10-02 (TASK-181)** — **scelta dell'utente** («sì, fai
gialla anche la schermata di avvio nativa»): il fondo è `#FFD02B`, il
giallo `accent`, e le immagini sono nere: `assets/splash-logo-dark.png` su
iOS e `assets/splash-icon-dark.png` su Android, le stesse di prima con ogni
pixel a `#0A0A0B`. Larghezze invariate (260 e 240). Le due immagini gialle
sono cancellate: niente le usa più. Così l'avvio è giallo dall'inizio alla
fine, schermata nativa e animazione (ADR-0147). Il prebuild di iOS genera
`SplashScreenBackground` a 255, 208, 43 e il logo nero di 260 × 260 al
centro.

## ADR-0130 — Nel catalogo solo parole corte
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** («Solo parole
corte»); l'elenco preciso deciso dall'agente su delega dell'utente
(TASK-161).

**Contesto**: il giro del 2026-10-02 ha scritto le frasi di ADR-0097 in 14
città. Guardate a occhio, al tetto dei 21 km si leggono solo le parole fino
a 4 lettere (CIAO, AO, BONA, UE) e qualche TIAMO sulle griglie regolari;
da 5–6 lettere in su (AMORE, BUONDI, GRAZIE, NOTTE, HELLO, CEREA, UAGLIO)
le lettere sono più piccole degli isolati e non si leggono. Sotto 0,88 di
somiglianza nessuna parola si legge.

**Decisione**: `PHRASES` tiene solo parole corte. In Italia CIAO e TIAMO,
più AO e AMOR a Roma, BONA a Firenze, UE a Bari, UELA a Milano; a New York
LOVE, HEY e NYC. Escono GRAZIE, BUONDI, NOTTE, AMORE, HELLO, CEREA,
UAGLIO, AMMORE, ROMEO, AMURI, ILOVENY, THANKS. Fra quelle rimaste, il
catalogo tiene solo le combinazioni di città e stile che si leggono
(ADR-0097, aggiornamento 2026-10-02).

**Alternative scartate**: tenere tutte le frasi e lasciare decidere la
soglia (parole illeggibili sopra 0,88); alzare il tetto oltre i 21 km per
le parole lunghe (percorsi che quasi nessuno corre).

**Conseguenze**: meno parole nel catalogo (Bologna nessuna), ma tutte
leggibili. Parole più lunghe torneranno con un motore che le scriva meglio,
non allungando la lista.

## ADR-0132 — «Explore»: i disegni del feed mentre una città si disegna, e le città in evidenza già nel catalogo
**Stato**: Attiva · 2026-10-02 · chiesto dall'utente («almeno un cuore, un
cerchio e la stella devono essere già disegnate [in] tutte le città che
consigliamo»; «mentre sta caricando fai vedere dei post […] quelli che
abbiamo già tenuto in feed»); quanti, quali e fino a quando decisi
dall'agente su delega dell'utente (TASK-163). Allarga ADR-0116.

**Contesto**: una città cercata la prima volta scarica la mappa prima di
disegnare cuore, cerchio e stella (Vercelli sul server: 94 s), e in
quell'attesa la pagina aveva tre righe «Drawing…» / «Next» e nient'altro.
Delle 14 città in evidenza (`FEATURED_CITIES`) solo Roma, Milano e Torino
hanno le tre forme nel catalogo: le altre le disegnano al tocco.

**Decisione, l'attesa (parte B)**:
- **I disegni di «Feed» sotto gli esempi**, finché uno è «Next» o
  «Drawing…»: 5, in colonna, resi dallo stesso `FeedPost` della pagina
  «Feed», che non si tocca. Cinque bastano per un minuto, e ogni disegno
  sono un centinaio di `View`: tutti e quindici insieme peserebbero su una
  pagina che non è un elenco a finestra.
- **In colonna, non in una fila da scorrere di lato**: le pagine si
  cambiano con lo swipe orizzontale (ADR-0124), e una fila in più dentro
  «Explore» gli ruba il gesto.
- **Città diverse, disegni diversi per primi**: il primo è scelto dalla
  chiave della città (`cityKey`), poi l'ordine del feed. Sempre lo stesso
  per la stessa città: niente caso, i test restano deterministici.
- **Restano finché non si cambia città**: se sparissero all'arrivo
  dell'ultimo esempio, la pagina salterebbe sotto il dito di chi li sta
  guardando. La riga sotto il titolo passa da «la mappa si scarica, fino a
  un minuto» a «The shapes of this city are ready above.».
- **Solo dove c'è un'attesa**: una città con percorsi consigliati, o con
  gli esempi già sul telefono, non li mostra.
- **Non si aprono al tocco**, come in «Feed» oggi: aprire un disegno del
  feed è di TASK-118 e TASK-162.
- **Un file nuovo** (`WhileDrawing.tsx`), e in `ExploreScreen.tsx` solo
  l'aggancio.

**Decisione, le città in evidenza (parte A)**:
- **Nel catalogo, con lo strumento del catalogo** (ADR-0097):
  `seed_catalog.py --featured`. Le città in evidenza che il seme non ha
  stanno in una tabella a parte (`FEATURED`), non in `CITIES`: così il giro
  intero (ogni forma a 5, 10 e 21 km, le frasi) non parte anche per loro,
  che hanno le zone solo sul server e a 17 km.
- **Solo cuore, cerchio e stella da 5 km**, come gli esempi che l'app
  disegnava al tocco (ADR-0116), da una piazza del centro entro 5 km dal
  centro che l'API dà per il nome della città: è il raggio dell'elenco di
  «Explore».
- **Le zone copiate dal server in sola lettura** (`rsync`, 1,2 GB per nove
  città, nella cache del Mac): niente Overpass, niente chiave dell'API,
  niente scritto sul server.
- **La soglia resta 0,88**: le 27 forme sono fra 0,91 e 1,00, tutte viste a
  occhio dall'agente (`samples/LOG.md`). Le più deboli sono il cuore e la
  stella di Dubai: da far vedere all'utente.
- **Un test tiene il patto**: `tools/test_featured_catalog.py` legge
  `FEATURED_CITIES` dall'app e fallisce se una città in evidenza non ha le
  tre forme vicino al suo centro.
- **Berlino manca**: la sua zona non è sul server (TASK-137) e Overpass
  rifiuta il Mac. Nel test è una mancanza dichiarata (`MISSING`, `xfail`
  rigido: il giorno che le forme ci sono, il test chiede di toglierla). In
  app Berlino continua a disegnarle al tocco, con i disegni del feed
  nell'attesa. **Scelta dell'utente (2026-10-02)**: il catalogo entra con
  13 città, Berlino dopo, quando Overpass riapre.
- **Il registro delle prove** è lo stesso del seme
  (`out/seed_catalog/runs.jsonl`, fuori dal repository): le 27 righe sono
  state aggiunte lì.

**Scartate**: disegnare le forme delle città in evidenza chiedendole
all'API del server con uno script a parte (uno strumento parallelo a
quello del catalogo, e la chiave dell'API fuori dal suo posto; paletto del
coordinatore); metterle dentro l'app come file (un megabyte di punti nel
bundle, e chi è vicino a quelle città senza toccare la tessera non le
vedrebbe); una fila orizzontale di disegni; i post che si aprono sulla
mappa da «Explore» prima che lo facciano in «Feed».

**Conseguenze**: `WhileDrawing` dipende da `FeedPost`. Con la mappa di
TASK-162 (ADR-0131) i disegni in «Explore» hanno anche loro la foto della
mappa sotto la linea: la chiede la scheda, la fa la pagina nascosta di
«Feed», che resta montata accanto a «Explore»; visto in un simulatore
senza aver mai aperto «Feed». Il feed vero (TASK-118) deciderà se qui
restano gli esempi o entrano i disegni degli iscritti. **In due PR**, per
richiesta dell'utente (2026-10-02, «pubblica intanto la parte dei post
sul telefono»): prima l'attesa, poi il catalogo. Una città in evidenza
ora mostra «Best near you» con tre righe invece di «EXAMPLES IN …»: senza
le alternative A · B · C degli esempi (ADR-0126), che il catalogo non
tiene. **Per vederle nell'app pubblicata va aggiornato `catalog/` sul
server** e riavviata l'API (`DEPLOY.md` F.12): con l'ok dell'utente.

## ADR-0133 — La schermata della corsa: gli stessi numeri con un percorso e senza, e una freccia di direzione dalla traccia
**Stato**: Attiva · 2026-10-02 · chiesto dall'utente («mi devi dire la
andatura media, chilometri fatti, tra quanti metri devo girare, ci deve
essere la freccia di indicazione dove sto andando… così è troppo
semplice»); il cosa scelto dall'utente su un mockup in chat («sì, fallo»),
il come deciso dall'agente su delega dell'utente (TASK-164).

**Contesto**: la corsa con un percorso mostrava la svolta e i km rimasti,
ma né i km fatti né il passo; la corsa senza percorso (ADR-0122) mostrava
km, tempo e passo medio, e nient'altro. Senza percorso le svolte non
esistono: non c'è una linea da seguire. La mappa non sapeva disegnare un
segnaposto orientato, e l'app non leggeva la direzione.

**Decisione**:
- **Un pannello solo per le due corse** (`RunPanel.tsx`), sotto la mappa:
  km fatti in grande, «Avg pace», «Pace now», «Time». Con un percorso,
  accanto ai km, «… to go» e «about … min», e la barra del percorso fatto;
  senza, «Last km» con il passo dell'ultimo km intero.
- **I km fatti sono quelli della traccia**, anche con un percorso: è
  quello che si è corso davvero, lo stesso numero della fine della corsa
  (ADR-0093). I km rimasti e la barra vengono invece dalla posizione lungo
  il percorso (`alongM`).
- **«Pace now» è il passo degli ultimi 200 m di traccia**, fino a adesso:
  abbastanza lungo da non seguire gli errori del GPS, abbastanza corto da
  mostrare un cambio di ritmo. Il tempo va avanti fra una posizione e
  l'altra, quindi da fermi il passo rallenta, e oltre 20:00 /km sparisce:
  è stare fermi, non correre. Come il passo medio, compare dopo 100 m.
- **«about 17 min» è i km rimasti al passo medio fin lì**: una stima, e lo
  dice. Il tempo conta anche le soste, come prima (ADR-0091).
- **La direzione viene dalla traccia, non dalla bussola**: il verso dalla
  posizione di 10 m prima all'ultima (`headingDeg`). Funziona uguale su
  ogni telefono e nei test; la bussola del telefono sbaglia in tasca e
  vicino al metallo, e `coords.heading` del GPS manca da fermi. Una sola
  posizione di distanza (5 m) sta dentro l'errore del GPS e la freccia
  tremerebbe. Da fermi la direzione resta l'ultima.
- **La freccia sulla mappa**: `follow` porta `heading` (gradi interi, o
  null), e la pagina mette al posto del segnaposto una freccia chiara,
  `rotationAlignment: "map"`, con il bordo scuro per leggersi sul giallo.
  `stopFollow`, mandato quando la corsa finisce, rimette il segnaposto.
  La mappa resta col nord in alto.
- **Senza percorso, la partenza al posto della svolta**: freccia, distanza
  in linea d'aria e «Your start, in a straight line». È l'unica direzione
  che una corsa senza percorso può dare senza inventare niente, e dice
  quanto manca per tornare. La freccia è relativa a chi corre (in su =
  davanti), come le frecce delle svolte; è azzurra, il colore della
  partenza (ADR-0040), non gialla (ADR-0046). «In a straight line» è
  scritto: non è la strada da fare.
- **Il giallo della barra è quello del percorso** (ADR-0046): la barra è
  il percorso, per quanto è stato corso. I km restano bianchi.
- **`useNavigation` dà la traccia** nello stato, come `useFreeRun`: il
  registratore parte prima del primo stato. Nessuna modifica a
  `trackStore.ts`, `freeRun.ts`, `navigator.ts`.

**Alternative scartate**: girare la mappa nel verso di marcia (la figura
del percorso si legge col nord in alto, e i gesti della mappa vanno
ripensati); la bussola del telefono (`expo-sensors`: dipendenza nuova, e
inaffidabile in corsa); il passo istantaneo fra due posizioni (salta di
minuti con un errore di pochi metri); il nome della via in cui si è, senza
percorso (vuole l'API o i dati delle strade sul telefono); tenere due
schermate diverse per le due corse.

**Conseguenze**: il pannello è più alto della riga di prima, e la mappa
più bassa di circa 90 punti. «Pause», lo «Stop» da tenere premuto e la
voce a ogni km nella corsa con percorso restano fuori: task a parte, se
l'utente li vuole. La freccia compare dopo i primi 10 m. Chi preme «Start»
lontano dall'inizio del percorso («Start here») ha nei km e nel passo anche
il tratto per arrivarci: la traccia parte con «Start» (ADR-0091), e i km
rimasti no. Provato nel simulatore con un GPS simulato, nelle due corse;
camminando con l'iPhone no.
## ADR-0135 — «Explore» a schede: due per riga, e i filtri in una riga sola
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** per il cosa («Pagina
Explore a schede», fra le proposte del canvas); il come deciso dall'agente
su delega dell'utente (TASK-167).

**Contesto**: in «Explore» ogni percorso era una riga con una miniatura da
72 × 60: il disegno, che è il motivo per cui si sceglie un percorso, era la
cosa più piccola della riga. I filtri erano due file di chip, una sopra
l'altra, prima dell'elenco.

**Decisione**:
- **Una scheda per percorso** (`src/explore/RouteCard.tsx`), due per riga:
  il disegno in alto, largo quanto la scheda e alto due terzi, poi forma e
  km, poi città e distanza. La somiglianza sta in un angolo del disegno.
  Il disegno è fatto come le miniature, una `View` per tratto
  (`thumbSegments`), con la linea da 3: nessuna dipendenza nuova.
- **La larghezza viene dalla finestra**, non da una misura dopo il primo
  disegno: i tratti si calcolano in punti, e la scheda non salta.
- **Gli esempi di una città sono le stesse schede**: una non ancora
  disegnata tiene il posto del disegno vuoto e dice «Drawing…» o «Next»,
  e non è un pulsante.
- **I filtri in una riga** (`src/explore/RouteFilters.tsx`): un pulsante
  per filtro, che dice cosa tiene («Shape: Star ▾»); le scelte si aprono
  sotto la riga, lì dove sono, e una scelta le richiude. Niente menu a
  comparsa né fogli: non servono librerie, e la pagina non perde il posto.
  «▾» e «▴» sono caratteri, come «←» e «↺» nel resto dell'app.
- **«Scelto» è il bordo chiaro**, non il fondo chiaro di prima: è il modo
  delle tessere delle forme, e il giallo resta del percorso.
- **Due filtri che insieme non lasciano niente lo dicono**, invece di una
  pagina vuota.

**Scartate**: una colonna sola di schede larghe (metà dei percorsi a
schermo); la foto della mappa sotto il disegno come in «Feed» (ADR-0131:
una foto per scheda, con decine di percorsi a città); un menu a comparsa
per i filtri; tenere le due file di chip.

**Conseguenze**: il componente `RouteThumb` non è più usato da «Explore»
(resta ai suoi test; `thumbSegments`, nello stesso file, lo usano le schede
e «Feed»); `Chips` non c'è più. Le righe che scorrono di lato
dentro la pagina restano due, le città e le scelte di un filtro aperto. Da
provare con il dito sull'iPhone.

## ADR-0136 — Gli esempi di una città restano sull'API una volta disegnati
**Stato**: Attiva · 2026-10-02 · chiesto dall'utente («in Explore deve
essere molto più veloce quando seleziono una nuova città, gli esempi in
Rovereto»); il come deciso dall'agente su delega dell'utente (TASK-168).
Allarga ADR-0116, che aveva scartato «salvare gli esempi nel catalogo
dell'API per tutti».

**Contesto**: in una città senza percorsi consigliati l'app chiede cuore,
cerchio e stella da 5 km dal centro, uno alla volta (ADR-0116). Misurato
il 2026-10-02: sul Mac libero 1,2–2,4 s di calcolo l'uno, sul server circa
18 s (5 km a Trento), più il download della zona dove manca. L'app chiede
lo stato ogni 2 s fissi: nel registro del Mac i tre esempi di Pergine,
calcolati in 2 s l'uno, arrivano a 4 s l'uno dall'altro. E ogni telefono
rifà gli stessi tre calcoli: la richiesta di una città è uguale per tutti,
e il motore dà lo stesso percorso.

**Decisione**:
- **Un percorso disegnato dal centro di una città resta in un file**
  (`shaperoute_api/route_store.py`), e la stessa richiesta riceve il job
  già `done` nella risposta al `POST /route-jobs`. Nessun contratto nuovo:
  l'app pubblicata legge già un job `done` alla prima risposta, e ci
  guadagna senza essere ripubblicata.
- **Solo dal centro di una città.** Tenere **ogni** percorso è la scelta
  dell'utente di ADR-0086, ed è di TASK-092: nel database, con le regole
  sui dati personali di TASK-110 (la partenza è spesso dove abita chi
  chiede) ancora da scrivere. Qui non la si anticipa: su disco vanno solo
  i percorsi che partono da un centro, che non è la posizione di nessuno
  (come per gli eventi di ADR-0101). I centri sono quelli che l'API stessa
  ha dato con `GET /cities` e, per le sole città, con `GET
  /city-suggestions`; un posto suggerito può essere la via di qualcuno, e
  resta fuori. Una partenza è un centro nello stesso quadrato di circa
  10 m (4 decimali, il `cityKey` dell'app). Le immagini mai.
- **Come si lega ad ADR-0086 / TASK-092.** Questo è una memoria delle
  risposte, non l'archivio dei percorsi: non sceglie i migliori, non
  propone niente, e si può cancellare senza perdere nulla. Non è un
  secondo archivio accanto a quello di TASK-092, che in `main` oggi ha
  solo i documenti (#118, #120). È fatto perché TASK-092 lo prenda:
  `RouteJobs` parla a un `KeepsRoutes` con due metodi (`get`, `put`), e
  `put` è chiamato per **ogni** percorso finito, nel punto dove TASK-092
  deve salvare; oggi `RouteStore` scarta quelli che non partono da un
  centro. Una versione sul database dello stesso `KeepsRoutes` salva
  tutto e risponde agli esempi dalla stessa tabella. Ogni file porta già
  quello che TASK-092 vuole di un percorso (la richiesta, i punti, la
  distanza, la somiglianza, le alternative, la data) più l'impronta del
  motore, e si importa così com'è.
- **Non è il catalogo.** Il catalogo dei percorsi consigliati resta
  guardato a occhio (ADR-0097). Qui c'è solo quello che l'API risponderebbe
  comunque alla stessa richiesta, senza rifare il calcolo.
- **Un motore cambiato ridisegna**: nel nome del file entra un'impronta dei
  `.py` e `.json` di `route_engine`, dal contenuto e non dalle date (una
  immagine Docker rifatta con lo stesso codice tiene quello che ha). Chi
  prova una modifica al motore sull'API del Mac non riceve percorsi vecchi.
  Dopo 30 giorni si ridisegna comunque: la zona può essere più nuova.
- **In `routes/` dentro la cartella dei grafi**: sul server `data/cache` è
  già montata fuori dal contenitore, e `deploy/compose.yaml` (di TASK-122)
  non si tocca. I file dei grafi si cercano per nome (`foot_*`), la
  cartella non li disturba. Al massimo 3000 percorsi, circa 90 kB l'uno.
- **Anche un job annullato si tiene**, se il motore l'ha finito: chi cambia
  città mentre una si disegna la trova pronta tornando.
- **`draw_examples`**: un comando che fa il primo telefono per un elenco
  di città, contro un'API accesa. Con le zone già sul server (ADR-0119)
  rende gli esempi immediati dal primo utente.
- **L'app chiede lo stato più spesso all'inizio** (`pollDelay` in
  `routes.ts`): ogni 0,5 s nei primi 6 s, ogni secondo fino a 20 s, poi
  ogni 2 s come prima. Il controllo è un GET senza limite (ADR-0076) e la
  risposta di un job non finito è di poche decine di byte. Vale per ogni
  percorso.

**Alternative scartate**: tenere già qui ogni percorso, da qualsiasi
partenza (è ADR-0086, che aspetta il database di TASK-092 e le regole di
TASK-110); un campo `example` nella richiesta, messo dall'app
(contratto nuovo, app da ripubblicare, e la riservatezza affidata al
telefono); un endpoint che disegni le tre forme insieme (ADR-0116: stesso
effetto, contratto nuovo); i tre esempi chiesti insieme (l'API ha due
thread e il motore usa già più processi: sul server si pesterebbero i
piedi); il database (sul Mac l'API gira senza; un file basta); tenerli
solo in memoria (un riavvio li perde, e sul server l'API si riavvia a ogni
aggiornamento); disegnare gli esempi già quando la città compare fra i
suggerimenti (calcoli per città non scelte, ADR-0116).

**Conseguenze**: aspetta solo il primo telefono in una città; sul Mac la
seconda richiesta dei tre esempi di Trento risponde in 0,0 s invece di
10–14 s. Una città **nuova per tutti** costa come prima: per quelle servono
le zone sul server e `draw_examples`, che toccano il server e aspettano
l'ok dell'utente. Il tempo di un esempio sul server (18 s contro 2 del
Mac) resta da capire dai log del server. Negli eventi delle ricerche una
risposta tenuta conta come un percorso da 0 ms. In «Explore» i disegni del
feed («MEANWHILE, FROM THE FEED», ADR-0132) compaiono anche quando gli
esempi arrivano subito: da rivedere in un task dell'app.

## ADR-0138 — Niente «Run with Strava»: da un percorso si esce con il GPX
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** («L'impostazione
run with strava la vorrei togliere»); il come deciso dall'agente su delega
dell'utente (TASK-170). Supera ADR-0106.

**Contesto**: «Run with Strava» (ADR-0106) era un pulsante sotto «Export
GPX» in ogni scheda di un percorso. Strava non lascia creare percorsi ad
altre app, quindi il pulsante apriva solo una spiegazione in tre passi:
salvare il GPX, importarlo a mano dal sito di Strava, seguirlo dall'app
Strava. L'utente non lo vuole più.

**Decisione**: il pulsante e la sua scheda si tolgono dalle tre schede
(percorso disegnato, di «Explore», a tema), e `apps/mobile/src/strava/` si
cancella. Per portare un percorso in un'altra app resta «Export GPX», che
già apre il foglio di condivisione. Il segnale `route_chosen` non cambia:
il pulsante di Strava contava come `via: "gpx"`, lo stesso valore di
«Export GPX».

**Alternative scartate**: tenere il codice e nascondere il pulsante dietro
un interruttore (codice morto da mantenere e da provare; torna con git se
serve); tenere una riga di aiuto su Strava vicino a «Export GPX» (non
chiesta: è una scelta di prodotto).

**Conseguenza**: una riga in meno in ogni scheda di un percorso. Fuori
dall'app non c'era niente da togliere: ADR-0106 non aveva account
collegati, token, chiavi né parti nell'API o sul server. Se Strava aprirà
la creazione di percorsi via API, si riparte da ADR-0106.

## ADR-0137 — La corsa: conto alla rovescia, due pagine, pausa, «Stop» da tenere premuto e tutti i numeri che il telefono sa misurare
**Stato**: Attiva · 2026-10-02 · chiesto dall'utente con una registrazione
di Nike Run Club («voglio che sia simile a questa, sempre con il nostro
stile, ma deve esserci tutto: metriche; mancano battito, musica») e poi
precisato («in tutti i casi tieni dislivello e passo dell'ultimo km;
dividi in due schermate, una con meno dati e la mappa con le indicazioni,
una con solo i dati, con uno swipe»); il come deciso dall'agente su delega
dell'utente (TASK-169). Aggiorna ADR-0133 (il pannello), ADR-0091 (la
traccia), ADR-0122 (la corsa senza percorso).

**Contesto**: la corsa di TASK-164 aveva un pannello solo sotto la mappa e
«Stop» da toccare; il tempo contava le soste, non c'erano dislivello,
calorie né i km uno per uno, e la corsa partiva al tocco, senza un attimo
per mettere via il telefono. I tre seguiti di TASK-164 («Pause», «Stop» da
tenere premuto, la voce a ogni km con un percorso) aspettavano l'utente.

**Decisione**:
- **Due pagine, non tre**: «Map» (mappa, banner, tre numeri: km, passo di
  adesso, tempo) e «Data» (tutti i numeri, i km uno per uno, gli
  interruttori, nessuna mappa). Nike ne ha tre («Controls», numeri,
  «Splits») perché non ha una mappa da seguire: qui la mappa con le
  svolte è la pagina principale, e l'utente ha chiesto due schermate.
- **«Data» scorre sopra «Map»**, da destra, in un `Modal` trasparente con
  la sua animazione; il dito la trascina via verso destra. Così la mappa
  resta una sola (`MapView` in `App.tsx`, mai ricaricata) e `App.tsx` non
  cambia: la scheda (`RunCard`) vive dentro `FreeRunCard` e
  `NavigationCard`, che tengono le loro props. Lo swipe verso «Data» parte
  dalla scheda, perché sulla mappa il dito sposta la mappa. I due nomi in
  fondo fanno lo stesso con un tocco.
- **I comandi della corsa in un modulo** (`runControl.ts`), uno per volta
  come il file della corsa: conto alla rovescia, «Pause», «Resume», pausa
  da sola, «Voice». Le schermate premono lì e i due registratori
  (`useFreeRun`, `useNavigation`) eseguono: la pausa non poteva passare
  dalle props senza toccare `App.tsx`.
- **La pausa sta nella traccia** (`Track.pauses`, da quando a quando): il
  tempo della corsa è quello passato meno le pause, ovunque (orologio,
  passi, ultimo km, splits, voce, fine corsa). In pausa le posizioni non
  entrano nella traccia; la prima dopo «Resume» ha `gap` e non aggiunge
  metri. Si scrive nel file subito, così regge alla chiusura dell'app.
- **«Keep running» è una pausa**: il tempo fra «Stop» (o la chiusura
  dell'app) e la ripresa non conta più, e la linea non si unisce. Prima
  contava: era il difetto annotato in ADR-0091.
- **La pausa da sola**: dieci secondi senza una posizione tenuta. Le
  posizioni arrivano ogni 5 m, quindi chi cammina piano ne dà una ogni
  4–5 secondi; dieci stanno sopra. La pausa parte da quel momento, non
  dall'ultima posizione: l'orologio non torna indietro sotto gli occhi di
  chi lo guarda, al costo di dieci secondi contati per sosta. Finisce con
  la prima posizione che si sposta di 5 m, che tiene i suoi metri. Accesa
  di default, come nel riferimento; si spegne da «Data».
- **«Stop» solo dalla pausa, e tenuto un secondo**: una mano che sfiora
  lo schermo in corsa non chiude più la corsa. Prima della prima posizione
  resta lo «Stop» da toccare, e all'arrivo «Finish».
- **Il conto alla rovescia è tempo, non una schermata da aspettare**:
  `runControl` lo chiude da solo dopo 3 secondi; lo schermo lo mostra
  soltanto. Il GPS parte prima, la traccia dopo: l'ultima posizione vista
  durante il conto diventa la prima della corsa, con l'ora in cui il conto
  finisce. Senza, chi parte da fermo non avrebbe una posizione fino ai
  primi 5 m (il GPS ne dà una ogni 5 m) e l'orologio aspetterebbe.
- **Dislivello dalla quota del GPS** (`coords.altitude`, già nel
  permesso): la somma delle salite di almeno 3 m, perché da fermi la quota
  oscilla di qualche metro. Il barometro sarebbe più preciso ma è una
  dipendenza nuova (`expo-sensors`).
- **Calorie stimate**: 1,036 kcal per kg e per km, con 70 kg finché il
  profilo non ha il peso (TASK-116 e seguiti). È una stima e come tale va
  letta; il numero giusto arriva col peso.
- **La voce a ogni km anche con un percorso**, dopo la svolta se cadono
  insieme. «Voice» spenta toglie tutta la voce e lascia la vibrazione.
- **Niente giallo su «Pause»**: è chiaro; il giallo resta del percorso e
  dell'azione principale (ADR-0046), che in pausa è «Resume». «Stop» si
  riempie di arancio (`warning`).
- **Un token nuovo**, `fontSize.hero` (88): i km a braccio teso.

**Battito e musica, fuori da qui**. L'utente vuole il battito sia da un
sensore Bluetooth sia da Apple Watch, e la casella solo quando un sensore
è collegato. Il telefono non lo misura: il sensore Bluetooth vuole
`react-native-ble-plx`, Apple Watch vuole HealthKit e un'app per
l'orologio; tutti e due solo in una build propria, non in Expo Go, dove
l'utente prova oggi. Finché non c'è un sensore la casella non c'è, quindi
qui non cambia niente da vedere. La musica (aprire Spotify o Apple Music,
o i comandi nella schermata) aspetta la risposta dell'utente su quale app
usa. Sono task a parte (`tasks/TASK-169.md`, «Fuori scope»). La risposta è
arrivata lo stesso giorno, «uso Spotify»: ADR-0141 (TASK-173).

**Alternative scartate**: tre pagine come Nike (la mappa finirebbe dietro
un pulsante); un pager vero con la mappa dentro (vuole riscrivere
`App.tsx` e il `MapView`, occupati da altri task, e lo swipe sulla mappa
resterebbe della mappa); la pausa da sola retroattiva dall'ultima
posizione (più giusta di dieci secondi, ma l'orologio salta indietro); la
pausa come stato delle schermate e non della traccia (si perdeva alla
chiusura dell'app, e ogni numero avrebbe dovuto sottrarla per conto suo);
la cadenza (vuole il contapassi, `expo-sensors`).

**Conseguenze**: il tempo di una corsa è il tempo senza le pause, anche a
fine corsa e nella voce; il punteggio non cambia (usa i punti, non il
tempo). La linea sulla mappa unisce ancora con un tratto dritto il punto
della pausa e quello della ripresa: i metri non contano, il segno sì. Un
tunnel o un GPS che si perde più di dieci secondi mettono in pausa la
corsa, se «Auto-pause» è accesa. Con «Data» aperta i pulsanti esistono due
volte nell'albero (sotto e sopra): è voluto, la scheda sotto si vede
mentre la pagina scorre. Provato nel simulatore con un GPS simulato, nelle
due corse: conto alla rovescia, «Map», «Data», pausa a mano e da sola,
splits. Lo swipe col dito e «Stop» tenuto premuto no (il simulatore non si
poteva toccare): restano per l'iPhone.

**Aggiornamento 2026-10-02 (TASK-186)**: **scelta dell'utente** per il
cosa («ingrandiscimi pulsante map e data sotto»); il come deciso
dall'agente su delega dell'utente. «Map» e «Data» erano due scritte da 13
punti con un trattino sotto, larghe quanto la parola. Ora sono due
pulsanti che si dividono la larghezza della scheda, alti 56 punti
(`MIN_TAP_SIZE` più un passo), con la scritta da 16 in grassetto; la pagina
aperta ha la superficie più chiara e il bordo, come `Segmented` nel resto
dell'app. Restano due `tab` per VoiceOver. Scartati: il giallo per la
pagina aperta (è del percorso); solo la scritta più grande (il bersaglio
del dito restava stretto); riusare `Segmented` (i suoi pulsanti sono
`button`, e la sua altezza serve ad altre schermate). Conseguenza: la
scheda sotto la mappa è più alta di circa 36 punti, tolti alla mappa. Visto in
un simulatore con un GPS simulato, sulle due pagine.

## ADR-0139 — «Favorites»: una copia del percorso, legata all'account
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** per il cosa («mettere
nei preferiti i percorsi che gli utenti vedono», con la voce «Favorites» nel
profilo di chi è entrato); il come deciso dall'agente su delega dell'utente
(TASK-171).

**Contesto**: un percorso che piace oggi si perde: quello disegnato sparisce
con la richiesta successiva, quello di «Explore» va ricercato fra le schede.
L'utente vuole ritrovarli nel profilo, «una volta loggati»: quindi stanno
con l'account, sul server, non sul telefono.

**Decisione**:
- **Un preferito è una copia intera del percorso** nella tabella `favorites`
  (migrazione `0002`): la linea, cosa disegna, le due distanze, la
  somiglianza, la città. Non un rimando: un percorso disegnato non è
  salvato da nessun'altra parte (TASK-092 non c'è ancora), e un percorso
  del catalogo può cambiare o sparire quando il catalogo si rigenera.
- **La chiave la fa l'app dalla linea** (`favoriteKey`: due hash FNV-1a sui
  punti arrotondati a cinque decimali, 16 cifre esadecimali), unica per
  account. Così il cuore sa se il percorso sulla mappa è già tenuto senza
  chiedere niente, lo stesso percorso è un preferito solo comunque ci si
  arrivi, e `PUT /me/favorites/{key}` è idempotente. L'API non ricalcola la
  chiave: è un nome dentro un account, non una prova.
- **La linea in PostGIS** (`geometry(LineString, 4326)`), come `DATABASE.md`
  vuole per ogni geometria; è la prima, e la migrazione crea l'estensione.
  Torna cifra per cifra (`ST_AsGeoJSON(line, 15)`), perché la chiave si
  rifà sui punti.
- **L'elenco è leggero**: 64 punti di anteprima per preferito, come i
  percorsi consigliati; la linea intera solo aprendo un preferito.
- **Al massimo 200 preferiti per account**, detto con `invalid_request` e
  un messaggio che l'app mostra: niente codice d'errore nuovo, che avrebbe
  toccato `schemas.py` e `shared-types` mentre altri task li usano.
- **Il cuore sta sulla mappa**, di fronte a «←», non dentro le schede del
  percorso: vale per i tre modi di arrivare a un percorso con un solo
  pezzo, e non tocca `RoutePanel`, `ExploredCard` e `ThemedCard`, che
  TASK-170 ha cambiato lo stesso giorno. È un carattere («♡», «♥»), come
  «←»: l'app non ha icone. Non è giallo.
- **Cambia subito e torna indietro se l'API rifiuta**: il modo già scritto
  per il like (TASK-119).
- **Un preferito aperto è un percorso di «Explore»**: la stessa scheda, lo
  stesso «Start» e lo stesso export, senza un'altra schermata. Per un
  preferito senza forma né parola (una foto) l'export manda come contorno
  la linea stessa, ridotta a 100 punti: il contorno vero il telefono non
  lo ha più.
- **Senza account il cuore porta a «Profile»** e tiene il percorso appena
  si entra; non ci sono preferiti senza account.
- **`Account.sessionEnded`**: una richiesta dei preferiti che trova la
  sessione finita fa uscire l'app, come `UI.md` già diceva («a una
  richiesta»).

**Scartate**: tenere i preferiti sul telefono (non seguono l'account);
salvare solo l'id del catalogo (non vale per i percorsi disegnati); far
calcolare la chiave all'API (l'app dovrebbe aspettarla per riempire il
cuore); il cuore su ogni scheda di «Explore» e di «Feed» (dopo, se serve: i
file sono di altri task); una linea in `jsonb` (contro `DATABASE.md`).

**Conseguenze**: il database tiene linee che spesso partono vicino a casa
di chi le ha disegnate; le vede solo il loro account e spariscono con lui
(`UI.md`, «Cosa esce dal telefono»). L'app chiede l'elenco a ogni apertura
con un account: una richiesta in più. Sul server la migrazione parte al
primo avvio dell'API nuova (`DEPLOY.md` F.12). «My activities» (TASK-172,
ADR-0140) userà la stessa pagina di «Profile» e la tabella `runs`.

## ADR-0141 — La musica nella corsa: «Music» apre Spotify, Sgrava non suona niente
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** per il cosa (la
musica nella corsa, chiesta con ADR-0137; «uso Spotify»); il come deciso
dall'agente su delega dell'utente (TASK-173). Aggiorna ADR-0137 (la musica
era rimasta fuori).

**Contesto**: il riferimento dell'utente (Nike Run Club) ha «Connect
Music». La corsa di TASK-169 non ha niente per la musica; l'utente prova in
Expo Go, dove non entrano moduli nativi nuovi.

**Decisione**:
- **Un pulsante che apre l'app di musica, non un lettore.** «Music» apre
  Spotify con il suo link (`spotify:`): l'app si apre dove era rimasta, e
  si torna a Sgrava da soli. Sgrava non suona, non mette in pausa e non sa
  cosa suona. Nessuna dipendenza: `Linking` di React Native.
- **Si apre, non si chiede prima.** `canOpenURL` risponde no per ogni
  schema che la build non dichiara (`LSApplicationQueriesSchemes`), ed
  Expo Go non dichiara i nostri: direbbe «Spotify non c'è» anche quando
  c'è. `openURL` invece non vuole dichiarazioni e fallisce da solo se
  l'app manca (visto nel simulatore: «Unable to open URL: spotify:»).
- **Senza Spotify, la sua pagina nello store** del telefono (App Store,
  Google Play; altrove `open.spotify.com`). Se non si apre nemmeno quella,
  niente: nessun avviso sopra una corsa.
- **Di fronte a «Pocket»**, nel posto vuoto accanto a «Pause», quindi su
  «Map» e su «Data» con un pezzo solo. Solo mentre si corre: in pausa la
  scheda ha «Stop» e «Resume» ed è già alta, e prima della prima posizione
  e all'arrivo c'è un pulsante solo.
- **«Music» non mette in pausa la corsa.** Chi sceglie una playlist
  correndo non vuole trovare la corsa ferma.
- **Solo Spotify**, scritto in un file (`music.ts`): è l'app dell'utente.
  Un'altra app di musica è un altro link nello stesso file.

**Scartate**: brano, pausa e avanti dentro Sgrava adesso (vogliono un'app
Spotify Developer dell'utente con Premium, l'accesso al conto Spotify con
tre dipendenze nuove, e in sviluppo valgono per 5 persone aggiunte a mano:
è la domanda aperta in `tasks/TASK-173.md`); `canOpenURL` e il pulsante
nascosto senza Spotify (in Expo Go sarebbe sempre nascosto); un avviso
«Spotify is not installed» (un testo in più da leggere correndo; lo store
dice la stessa cosa); il link `https://open.spotify.com` per tutti (senza
l'app apre il sito in Safari, non lo store); la scelta fra più app di
musica (nessuno l'ha chiesta).

**Conseguenze**: mentre Spotify è davanti, Sgrava non registra (registra
solo in primo piano): i secondi passati a scegliere la musica sono un buco
nella traccia, come ogni uscita dall'app. Come si mescolano la voce delle
svolte e la musica lo decide iOS, perché l'app non imposta niente
dell'audio: se la voce ferma la musica o non si sente, serve `expo-audio`
(dipendenza nuova, task a parte). Tutte e due le cose si vedono solo
sull'iPhone e sono fra le prove di `tasks/TASK-173.md`. Con una build
propria si potrà dichiarare lo schema e mostrare «Music» solo a chi ha
Spotify.

## ADR-0143 — La mappa senza pulsanti di zoom: si ingrandisce solo con le dita
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** («togli la
possibilità di zumare in alto a destra […] si potrà zumare solamente con
il touch»); il come deciso dall'agente su delega dell'utente (TASK-175).

**Contesto**: la pagina della mappa aveva il `NavigationControl` di
MapLibre, due pulsanti «+» e «−» in alto a destra. Su un telefono
ripetono un gesto che si fa già con due dita, e occupavano l'angolo: il
cuore dei preferiti (ADR-0139) stava sotto di loro, più in basso di «←».

**Decisione**: la pagina non crea più il controllo. Lo zoom resta quello
dei gesti di MapLibre, che la pagina non tocca: due dita, doppio tocco.
Il cuore dei preferiti sale nell'angolo, alla stessa altezza di «←»
(`insets.top` più lo stesso margine).

**Alternative scartate**: nascondere i pulsanti con il CSS (il controllo
resterebbe nella pagina, da mantenere); toglierli solo dall'anteprima di
un percorso e tenerli in corsa (la pagina è una sola, e in corsa la mappa
segue la posizione da sé); spegnere anche la rotazione con due dita (non
chiesto).

**Conseguenza**: chi non può fare il gesto con due dita ha il doppio
tocco per avvicinare. I pulsanti mancano apposta: un test della pagina
controlla che il controllo non torni e che il gesto non venga spento.

## ADR-0142 — La mappa anche sotto le schede di «Explore», con un credito solo
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** per il cosa («nella
sezione explore, quando ci sono i vari sample, mettimi sotto anche la
mappa […] con scritto il nome del paese»); il come deciso dall'agente su
delega dell'utente (TASK-174). Cambia un punto di ADR-0135, che aveva
scartato la foto della mappa nelle schede.

**Contesto**: da TASK-167 un percorso di «Explore» è una scheda larga mezzo
telefono, la linea gialla su un fondo vuoto. In «Feed» sotto la linea c'è
la foto della mappa (ADR-0131), e l'utente la vuole anche qui. ADR-0135
l'aveva scartata per il numero: una foto per scheda, decine di percorsi a
città.

**Decisione**:
- **Le stesse foto di «Feed»**: `RouteCard` con `map` chiede la foto a
  `useFeedMap` e la mette sotto la linea. Le fa la pagina nascosta di
  «Feed», che il `Pager` tiene montata accanto a «Explore»: nessuna pagina
  MapLibre in più. Misurato sul simulatore: 27 foto in 1,6 s con le tile
  della zona già scaricate, perché i percorsi di una città stanno sulle
  stesse tile.
- **La foto ha il nome di ciò che inquadra** (centro e zoom di
  `lineCamera`), non l'`id` del percorso: un esempio ridisegnato tiene il
  suo `id` e può cambiare linea, e due percorsi con lo stesso riquadro
  hanno la stessa foto.
- **`map` va chiesto**: lo passano le schede di «Explore» (esempi e «Best
  near you»). «Favorites» usa lo stesso componente e resta com'è.
- **Il credito una volta sola, accanto alle schede**, in una riga: «Maps:
  OpenFreeMap © OpenMapTiles · Data from OpenStreetMap». Sopra le schede di
  «Best near you», che sono molte e scorrono; sotto quelle degli esempi,
  che sono tre. Scritto su ogni foto, come in «Feed», su una scheda di 170
  punti andava a capo, perdeva «Data from OpenStreetMap» e copriva i nomi
  dei paesi, che sono ciò che l'utente ha chiesto.
- **Il nome del paese anche in parole** negli esempi: la scheda pronta lo
  dice sotto forma e km, come le schede di «Best near you» dicono già la
  città. Sulla mappa il nome c'è quando il centro del paese cade nel
  riquadro, cioè quasi sempre, non sempre.

**Scartate**: una pagina delle foto anche in «Explore» (due pagine
farebbero la stessa foto due volte); il credito su ogni foto con un
carattere più piccolo (sotto gli 11 punti non c'è un token, e resta sopra
i nomi); un'etichetta con il nome del paese disegnata sopra la foto
(doppia, quando la mappa lo scrive già).

**Conseguenze**: aprire «Explore» chiede a OpenFreeMap le tile delle zone
dei percorsi mostrati (`UI.md`, «Cosa esce dal telefono»). Le foto restano
in memoria finché l'app è aperta, una per scheda vista; cambiata città, le
foto già in coda per quella di prima si fanno lo stesso. Fuori dal `Pager`
(«Explore» aperta con `onBack`) la pagina delle foto non c'è e le schede
restano senza mappa.

## ADR-0147 — L'animazione all'avvio: un componente sopra l'app, il cuore del video sul giallo
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** per il cosa («il
logo e l'animazione che deve durare almeno due secondi quando apri
l'applicazione: un cuore che si disegna su uno sfondo giallo, come il
video»); il come deciso dall'agente su delega dell'utente (TASK-179).

**Contesto**: la schermata di avvio di ADR-0134 è nativa, ferma, e si vede
solo in una build propria. L'utente apre l'app in Expo Go: non vedeva né il
logo né un'animazione. ADR-0134 aveva scartato un componente React perché
prima che parta il JavaScript lo schermo resta vuoto e perché toccava
`App.tsx`; per un'animazione il componente è l'unica strada, e le due cose
stanno insieme: la schermata nativa copre l'attesa del JavaScript,
l'animazione viene dopo.

**Decisione**:
- **Un componente sopra l'app**, `src/intro/LaunchIntro.tsx`, montato da
  `src/intro/Root.tsx`, che `index.ts` registra al posto di `App`.
  `App.tsx` non cambia. L'app parte subito sotto: posizione, mappa e prime
  richieste si caricano mentre il cuore si disegna.
- **Il cuore è quello del video**: il percorso a cuore di Milano da 10 km
  del catalogo seme (`catalog/seed/milano.json`), semplificato a 8 m, 99
  punti in `src/intro/heartLine.ts`. È un percorso vero del Route Engine,
  con le sue strade: il segno che dice cosa fa l'app.
- **I tempi**: 0,35 s il giallo `accent` riempie lo schermo dal centro,
  1,6 s il cuore si disegna, 0,45 s resta, 0,3 s l'animazione sfuma
  sull'app. Il giallo si vede 2,4 secondi: sopra i due chiesti, sotto i tre
  che a ogni apertura peserebbero.
- **Nero su giallo**: la linea, la penna e il logo sono `onAccent`; il logo
  è `assets/splash-logo.png` (giallo) colorato con `tintColor`. Il punto di
  partenza è chiaro con il bordo scuro, come sul logo e sulla mappa.
- **Senza SVG e senza dipendenze**: la linea è fatta di tratti, View
  sottili e girate come in `RouteThumb`; ognuno compare al suo momento da
  un solo valore animato sul thread nativo. I tratti lunghi sono tagliati
  (al più 1/110 della linea) perché la linea non salti.
- **La durata la tiene un timer**, non la fine dell'animazione: con le
  animazioni spente sul telefono il disegno finisce subito, e il cuore deve
  restare comunque il suo tempo. È anche ciò che rende il test
  deterministico (sotto jest le animazioni finiscono all'istante).
- **Una volta per apertura**: non si salta con un tocco, e finché c'è
  prende i tocchi.

**Scartate**: una riga in `App.tsx` (è di TASK-172 e TASK-174, e non
serve); `react-native-svg` o Lottie (dipendenze nuove per un disegno che
l'app sa già fare); una pagina in una WebView (parte tardi e lampeggia); un
cuore geometrico pulito (non è «come il video», e non dice che il disegno
è fatto di strade); `preventAutoHide` di `expo-splash-screen` per tenere
la schermata nativa (resta ferma, e in Expo Go non c'è).

**Conseguenze**: ogni apertura costa 2,7 secondi prima di poter toccare
l'app, che intanto si carica. In Expo Go prima dell'animazione resta la
schermata di caricamento di Expo Go. In una build propria la schermata
nativa è nera con il logo giallo e poi arriva il giallo: farla gialla è
una riga di `app.json`, lasciata all'utente. La barra di stato resta
chiara sul giallo: la decide `App.tsx`. Chi ha «Riduci movimento» vede la
stessa animazione.

**Aggiornamento 2026-10-02 (TASK-181)**, deciso dall'agente su delega
dell'utente dopo la sua scelta della schermata nativa gialla (ADR-0134,
aggiornamento):
- **L'animazione parte già gialla.** Il fondo è `accent` dal primo
  fotogramma e il cerchio che riempiva lo schermo dal nero non c'è più:
  dopo una schermata nativa gialla sarebbe stato giallo, nero, giallo. I
  0,35 s restano come attesa della penna sul punto di partenza; il giallo
  si vede sempre 2,4 secondi. Il logo è `splash-logo-dark.png`, senza
  `tintColor`.
- **Attesa e disegno sono una sola animazione nativa**, che parte al primo
  fotogramma (`penProgress`: ferma per l'attesa, poi il disegno). Filmando
  con il Mac molto carico, il disegno partiva in ritardo: fra l'attesa e il
  disegno serviva un passaggio dal JavaScript, occupato ad avviare l'app,
  mentre il timer dell'uscita scattava puntuale e la dissolvenza tagliava
  il cuore a metà. Era così anche nella versione pubblicata di TASK-179.
- **L'uscita segue la fine del disegno**: il cuore finito resta 0,45 s, e
  comunque l'animazione non dura meno di 2,4 s (con le animazioni spente
  il disegno finisce subito). Il timer da solo è scartato per il motivo
  qui sopra; la sola fine del disegno era già scartata.

Resta com'era: il logo passa dal centro (schermata nativa) a sotto il cuore
con un salto. Si giudica in una build propria.

## ADR-0140 — «My activities»: «Save» a fine corsa, e i numeri della corsa li conta l'API
**Stato**: Attiva · 2026-10-02 · **scelte dell'utente** per il cosa («le
mie attività con tutte le attività che hanno registrato, con lo storico:
data, ora, posizione e l'anteprima di cosa aveva disegnato»; senza account
resta com'è, con una riga che invita a entrare; il luogo lo trova l'API);
il come deciso dall'agente su delega dell'utente (TASK-172).

**Scelta nuova dell'utente, lo stesso giorno** (riferita dal coordinatore
da un'altra sessione): «quando termino l'attività devi salvarmi l'attività
in activity sul mio profilo, e prima mi fai comparire una nuova schermata
nella quale mi dici salva, cancella, invia a Strava». Quindi **la corsa
non si salva più da sola**, com'era nella prima scelta («sì a tutte e
tre»): a fine corsa «Save» e «Discard», e solo «Save» la mette in «My
activities». «Send to Strava» è un task a parte (TASK-187), da chiedere
all'utente: ADR-0138 aveva tolto Strava dall'app.

**Contesto**: una corsa finita si perdeva: il telefono la teneva solo
finché non aveva il punteggio (ADR-0093), e quella senza percorso fino a
«Done» (ADR-0122). L'utente vuole ritrovarle nel profilo. È la metà
privata di TASK-117 («salvare un disegno»): titolo, «Public» e traccia
tagliata restano là.

**Decisione**:
- **La tabella `runs`** (migrazione `0003`), una riga per corsa, solo del
  proprietario. Tiene il percorso seguito (o nessuno), cosa disegnava, la
  traccia, le pause, l'inizio, km, tempo, punteggio e luogo.
- **L'app manda la corsa com'è stata registrata**, posizione per
  posizione con le pause; **km, tempo e punteggio li conta l'API** e l'app
  non li può nemmeno mandare (campi in più: `422`). Il punteggio è quello
  di `track_score.py` (ADR-0090), come `POST /track-scores`; la traccia
  tenuta è quella pulita dal motore (`clean_track`), non la grezza. Così
  un numero in «My activities» non dipende dalla versione dell'app che ha
  corso, e TASK-117 potrà pubblicarlo senza fidarsi del telefono.
- **Le pause sono nel contratto** (`pauses`, da TASK-169, ADR-0137): il
  tempo le toglie tutte; i metri tolgono solo il passo a cavallo di una
  pausa chiesta dal corridore, come fa l'app (`gap`). M della traccia sono
  i secondi dalla prima posizione, pause comprese, e le pause stanno
  accanto in `jsonb`: dalla riga si rifà l'orario di ogni punto.
- **Una corsa troppo corta per il punteggio si salva lo stesso**, senza
  punteggio; con meno di due posizioni buone non si salva. Non c'è una
  lunghezza minima: con «Save» e «Discard» lo decide chi ha corso.
- **La chiave la fa l'app dalla prima posizione** (`activityKey`: orario e
  punto), come per i preferiti la fa dalla linea: `PUT` due volte salva una
  volta, e resta la prima. Dall'inizio e non da tutta la traccia perché una
  corsa ripresa è la stessa corsa.
- **Il luogo**: geocoding inverso di Geoapify, con la chiave che l'API ha
  già, per la partenza **arrotondata a due decimali** (circa 1 km), come la
  ricerca dei luoghi fa con `near` (ADR-0095). Chiesto una volta, al
  salvataggio; se non arriva, la corsa non ha luogo. Il servizio non vede
  la porta di casa, e l'API non scrive posizioni nel log (ADR-0092).
- **L'elenco a pagine con cursore** sull'ordine `(inizio, id)`, dalla più
  recente, 20 per volta, con il totale: cancellare o salvare fra due pagine
  non ne ripete e non ne salta. Anteprime di 64 punti per linea, come i
  preferiti. Al massimo 2 000 corse per account.
- **«Save» e «Discard» stanno sulla schermata di fine corsa**, quella che
  «Stop» già apre con la mappa, i numeri e il punteggio: è la schermata
  che l'utente chiede, e una in più dopo «Done» sarebbe un tocco in più
  per dire la stessa cosa. Con un account prendono il posto di «Done»,
  sotto la scheda; «Keep running» resta. «Discard» chiede conferma: un
  tocco sbagliato butterebbe una corsa che non si rifà. Con «Save» o
  «Discard» la corsa lascia il file della corsa in corso anche senza
  punteggio: non torna alla prossima apertura.
- **Niente parte a «Stop»**: fra «Stop» e «Save» c'è «Keep running», e
  una corsa mandata a metà resterebbe a metà (resta la prima). Con «Save»
  la corsa va in un file del telefono (`activities-outbox.json`), con
  l'account di chi l'ha corsa, e da lì all'API: subito, o alla prossima
  apertura con la rete, o aprendo «My activities». Un `422` la toglie dalla
  coda (rimandarla non cambierebbe niente); ogni altro errore la lascia.
  Dopo un salvataggio l'elenco si richiede all'API: i numeri sono i suoi.
- **Cosa disegnava il percorso** l'app lo sa finché quel percorso è ancora
  sullo schermo (disegnato, di «Explore», a tema, un preferito); una corsa
  rimasta da un'altra apertura manda solo la linea.
- **La pagina** è una riga per corsa, non due schede affiancate come i
  preferiti: giorno, ora, luogo, km, tempo, passo e punteggio non stanno
  sotto mezzo schermo. Il disegno ha le due linee nella stessa cornice
  (`fitLines`), come a fine corsa.
- **Una corsa aperta è sulla mappa come a fine corsa**, non come un
  percorso di «Explore»: niente «Start», niente cuore. «Delete» chiede
  prima, sulla scheda.
- **Le schede di fine corsa cambiano di poco**: `FinishCard` e
  `FreeFinishCard` non mostrano «Done» quando non ricevono `onDone`; i due
  pulsanti e la riga per chi non ha account sono un pezzo solo sotto la
  scheda (`RunEnd`), uguale con un percorso e senza. `POST /track-scores`
  resta com'è: la scheda mostra il punteggio subito, il salvataggio va per
  conto suo.

**Scartate**: salvare da sola a «Done» (la prima scelta dell'utente,
cambiata da lui); salvare a «Stop» (vedi sopra); una schermata a parte
dopo «Done» con i due pulsanti; «Discard» senza conferma; fidarsi di km, tempo e punteggio dell'app; tenere la traccia
grezza (sulla mappa avrebbe i salti del GPS, e il punteggio è già sulla
pulita); la chiave da tutta la traccia (la stessa corsa, ripresa,
cambierebbe nome); mandare a Geoapify la partenza
esatta; un elenco di città dentro l'API (vale solo dove c'è il catalogo);
pagine con `offset` (saltano o ripetono quando l'elenco cambia); tenere le
corse senza account sul telefono (scelta dell'utente: restano com'erano).

**Conseguenze**: il database tiene tracce intere, con gli orari: il dato
più personale dell'app; le vede solo il loro account, spariscono con lui e
dalle copie entro 14 giorni (`UI.md`, «Cosa esce dal telefono»). Geoapify
riceve un punto al chilometro per ogni corsa salvata. Sul server la
migrazione `0003` parte al primo avvio dell'API nuova (`DEPLOY.md` F.12):
finché non c'è, l'app nuova tiene le corse nella coda. Una corsa chiusa
con «Discard» non si recupera. Chi chiude l'app sulla schermata di fine
corsa senza scegliere la ritrova alla prossima apertura, da salvare o
buttare. L'altitudine delle posizioni (TASK-169) non si salva. Il
punteggio di una corsa salvata non cambia se il motore cambia. TASK-117 parte da
`runs` con una migrazione sua (traccia tagliata, «pubblica», il titolo
dell'utente: `title` qui è cosa disegna il percorso) e il suo task file
va aggiornato da chi lo prende.

## ADR-0148 — Una zona tiene ogni pezzo della sua rete, e dove non ci sono strade il motore lo dice
**Stato**: Attiva · 2026-10-02 · deciso dall'agente su delega dell'utente
(TASK-180).

**Contesto**: sul server gli esempi di Venezia finivano in `engine_error`
(TASK-168): il ritaglio attorno al centro storico non aveva nodi. Due
difetti, uno sopra l'altro.

Il primo: un grafo senza strade non aveva un nome. `crop` chiamava `max()`
su nessun pezzo (`ValueError`), e un ritaglio di un nodo solo arrivava a
`RoadMask`, che indicizzava nessun campione (`IndexError`): l'API poteva
solo dire `engine_error`, «vedi il log».

Il secondo, la causa: OSMnx di un download tiene **il pezzo connesso più
grande** (`retain_all=False`, due volte in `graph_from_polygon`) e butta
gli altri. Verificato:

- il centro che dà la ricerca delle città è giusto: 45,4372 N 12,3346 E,
  in mezzo al centro storico; l'area del cuore da 5 km (45,4127–45,4617 N,
  12,2997–12,3695 E) è tutta isola e laguna;
- a piedi l'isola non è unita alla terraferma. Sui dati di OpenStreetMap
  del 2026-10-02, letti dall'API di OSM in una striscia attraverso il
  Ponte della Libertà e al suo capo verso Venezia, e passati per
  `FOOT_FILTER`: le due carreggiate cadono (`highway=trunk` con `foot=no`
  o `sidewalk:right=separate`); la ciclopedonale «Ciclabile per Venezia»
  resta (`foot=designated`, poi `foot=yes`) fino al nodo 5690409049
  (45,44258 N 12,31505 E), dove continua come way 597743868,
  `highway=cycleway` con `foot=no`, che cade. Il marciapiede dell'isola
  corre lì accanto, a 5 m, senza un nodo in comune. Il pezzo che arriva
  dalla terraferma ha 57 nodi in quel riquadro e non tocca la rete
  dell'isola (2.881 nodi nello stesso riquadro);
- l'estratto (`prefetch_zones --extract`) non c'entra: dà a OSMnx le
  stesse strade di Overpass, e il taglio lo fa OSMnx. Un test costruisce
  la zona da un estratto con una terraferma, un'isola e un ponte `foot=no`
  e, col motore di prima, trova il file senza l'isola e l'area dell'isola
  vuota.

**Non verificato**: che nella zona vera di Venezia (17 × 17 km, con Mestre
e Marghera) la terraferma abbia più nodi dell'isola. Lo dice il ritaglio
vuoto visto sul server; contarlo voleva la zona, e il 2026-10-02 Overpass
rifiutava le connessioni dal Mac (niente estratto né osmium in locale).

**Decisione**:

- **Chi scarica una zona tiene tutti i pezzi** (`retain_all=True` in
  `OsmnxSource.load`): il file della zona è la rete com'è. **Il pezzo più
  grande si sceglie area per area**, nel ritaglio, come `crop` e
  `ZoneCrop` fanno già; chi chiede la zona intera riceve il suo pezzo più
  grande (`largest_piece`), cioè quello che OSMnx dava prima. Una zona
  salvata prima, tutta d'un pezzo, torna com'è.
- **Dove non ci sono strade il motore rifiuta col suo nome**:
  `NoRoadsError`, da `crop` (nessun nodo nell'area) e da `RoadMask`
  (nessun arco). È un `ShapeNotDrawableError`: lì nessuna forma si
  disegna, e la CLI («No route: …»), i job e `POST /routes` rispondono già
  a quell'errore, con `shape_not_drawable`. Niente codice d'errore nuovo:
  l'app lo mostra già («This shape does not fit the roads here… another
  start»), e un codice nuovo sarebbe stato un contratto da cambiare
  nell'app.
- I due errori stanno in un modulo loro, `route_engine/errors.py`:
  `network.py` non può importare da `optimizer.py`, che lo importa.
  `optimizer.ShapeNotDrawableError` resta lo stesso oggetto, e nessun
  import cambia.

**Motivo**: buttare i pezzi piccoli ha senso per l'area di una richiesta,
dove la partenza si aggancia alla rete che c'è; non per una zona di 17 km
scaricata una volta per tutti, dove «il più grande» è deciso da cosa c'è a
8 km dal centro. Per le città di terraferma non cambia niente, e si è
visto sui dati veri: quattro zone del Mac rifatte dalle risposte di
Overpass in cache, senza rete (Trento e Verona a 17 km, 32.728 e 30.838
nodi; la zona piccola di Verona; Rosolina Mare). Con tutti i pezzi le due
grandi hanno il 3% circa di nodi in più (Trento 33.880 in 425 pezzi,
Verona 31.761 in 300; i pezzi in più hanno al massimo 36 nodi), Rosolina,
fra canali e lidi, il 26%. In tutte il pezzo più grande è il grafo di
prima: stessi nodi e stessi archi nello stesso ordine, stesse lunghezze e
geometrie; così i ritagli (cuore, cerchio e stella da 5 km da tre
partenze per zona), e il cuore da 5 km dal centro di Trento e di Verona
esce con la stessa linea. Cambia solo l'ordine dei valori dentro le
etichette di una strada fatta di più tratti (`name`, `highway`, `lanes`,
`maxspeed`…), che OSMnx mette in un insieme e non tiene fermo nemmeno fra
due costruzioni dello stesso download: la linea non ne dipende.

**Scartate**: un codice `no_roads` nell'API (contratto nuovo per l'app,
scelta di prodotto); mappare l'errore in `errors.py` e `app.py` dell'API
(`app.py` è di un altro task in corso, e la CLI sarebbe rimasta fuori);
restituire un grafo vuoto da `crop` e controllare in ogni chiamante (tre
punti nel motore, e uno dimenticato torna `engine_error`); una zona più
piccola solo per Venezia (un dato da ricordare, non una regola); scegliere
nel ritaglio il pezzo **della partenza** invece del più grande (più giusto
per chi parte da un'isola piccola, ma cambia i percorsi di oggi dove la
partenza sta su un pezzo minore: è un task a parte, da misurare).

**Conseguenze**: le zone già in cache restano col solo pezzo più grande:
**quella di Venezia sul server va rifatta** dopo l'aggiornamento dell'API
(con l'ok dell'utente; i comandi in `tasks/TASK-180.md`), poi i suoi tre
esempi. Che il centro storico dia un buon cuore da 5 km non è stato
provato: calli e ponti sono una rete molto diversa da una città di
strade. Le zone nuove pesano qualche punto percento in più. Un'area che
prende più terraferma che isola dà ancora la terraferma (una forma lunga
da Venezia, una partenza alla Giudecca vista da un'area che prende il
centro storico). Una zona scaricata al momento dall'API resta in memoria
col solo pezzo più grande fino al riavvio. `engine_fingerprint` cambia
come a ogni modifica del motore: gli esempi tenuti sul server si
ridisegnano alla prima richiesta.

## ADR-0151 — Un disegno di «Feed» si apre come un percorso di «Explore», e il suo percorso si ritrova dalla partenza
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** per il cosa («quando
sono in feed […] cliccare sull'attività delle persone inventate e mettere
nei preferiti o fare inizia percorso»); il come deciso dall'agente su
delega dell'utente (TASK-188).

**Contesto**: i disegni di «Feed» sono esempi (ADR-0127): corridori, titoli,
tempi e punteggi inventati, ma la linea è di un percorso vero del catalogo
(ADR-0098), e l'`id` del disegno è l'`id` di quel percorso. Sulla mappa un
percorso di «Explore» ha già tutto ciò che l'utente chiede: il cuore dei
preferiti (ADR-0139), «Start» con le indicazioni (TASK-145), il GPX. Il
disegno ha la linea con 120 punti, pochi per correrla: serve il percorso
intero. E l'`id` di un percorso del catalogo è la sua **posizione nel file
della città**: il catalogo è cresciuto dopo che il feed è stato scritto, e
sotto `roma-butterfly-21000-11` oggi c'è un cerchio di 5 km (la farfalla è
alla posizione 12).

**Decisione**:
- **Un tocco sulla scheda apre il percorso sulla mappa**, con la scheda di
  «Explore» (`useExplored`, `ExploredCard`): niente pulsanti nuovi sulla
  scheda del feed. Cuore, «Start» e GPX sono quelli che ci sono già; «←» e
  «Back to the list» tornano alla pagina da cui si è partiti, che `App.tsx`
  ricorda in uno stato (`routeList`).
- **Il percorso si chiede per `id` e si controlla**: è quello del disegno
  solo se ha la stessa città, la stessa forma e la stessa lunghezza
  (`isRouteOf`). Se sotto l'`id` c'è un altro percorso, o nessuno, lo si
  cerca fra i percorsi che partono dove parte il disegno
  (`GET /recommended-routes` attorno al primo punto della linea) e si
  chiede quello. `useExplored.open` prende, da chi apre, un modo diverso
  di chiedere il percorso intero; senza, chiede per `id` come prima.
- **Se il percorso non c'è più, non se ne apre un altro**: la scheda dice
  «The route could not load. Try again.», come per un percorso che non
  arriva. Un percorso sbagliato sotto il titolo di un altro sarebbe peggio
  di un messaggio.
- **Uno swipe non è un tocco**: «Feed» è la prima pagina, uno swipe verso
  destra non fa scorrere niente, nessuno toglie il tocco alla scheda e il
  dito alzato sopra di lei contava come un tocco (visto nel simulatore).
  La scheda ricorda dove il dito è sceso e ignora un dito che si è mosso
  più di 12 punti.
- La scheda è un pulsante solo quando chi la mostra le dà cosa aprire: in
  «Explore», fra i disegni mostrati mentre una città si disegna (ADR-0132),
  resta da guardare.

**Alternative scartate**: cuore e «Start» sulla scheda del feed (due
pulsanti per quindici schede, e «Start» senza aver visto dove si parte;
si può aggiungere, vedi il task file); mettere il percorso intero nel
file del feed (da 120 a 300–1600 punti per disegno, nel pacchetto
dell'app, e una copia che invecchia); correggere a mano gli `id` nel file
(lo scrive `tools/sample_feed.py`, e il catalogo cambierà ancora);
riscrivere il feed sul catalogo nuovo (cambia i disegni che l'utente
vede: è il seguito di TASK-161); `id` stabili nel catalogo (cambia un
contratto dell'API usato dai preferiti e da «Explore»: un task suo).

**Conseguenze**: un disegno apre in una richiesta se il suo `id` regge,
in tre se è cambiato. La ricerca dalla partenza vede i 60 percorsi
migliori entro 5 km (i limiti dell'API): la città più ricca ne ha 37.
Mentre il percorso arriva, la scheda sulla mappa dice «looks N% like it»
con il punteggio inventato del disegno, poi con la somiglianza vera del
percorso (di solito più alta): meno di un secondo. Il preferito salvato
da un disegno è il percorso, non il post: non ricorda chi l'ha «corso».
Le schede di «Explore», ultima pagina, hanno probabilmente lo stesso
difetto dello swipe verso sinistra: da guardare in un task suo.

## ADR-0145 — «Profile»: emoji per le voci, due riquadri con il numero, l'account in «Settings»
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** per il cosa («cambia
un po' la grafica, rendila più accattivante», un cuore accanto a
«Favorites», l'uomo che corre «come emoji» accanto alle attività, una
sezione «Settings» da riempire «con calma»); il come deciso dall'agente su
delega dell'utente (TASK-177).

**Contesto**: «Profile» con l'account era una scheda «LOGGED IN AS», un
elenco di righe di solo testo e, sotto, «Log out» e «Delete account»: tutto
grigio, con i due comandi che si usano una volta sola in vista quanto le
cose che si aprono ogni giorno.

**Decisione**:
- **Le voci hanno un'emoji**: ❤️ «Favorites», 🏃‍♂️ «My activities», ⚙️
  «Settings», ognuna in un tondo `surfaceRaised`. L'app non ha icone e
  una libreria di icone sarebbe una dipendenza nuova; l'emoji è il
  carattere che l'utente ha chiesto, e porta l'unico colore di «Profile»
  che non viene dai token. Non è giallo, quindi non si confonde con il
  percorso. Il cuore sulla mappa resta il carattere «♡»/«♥» di ADR-0139: è
  un comando con due stati, neutro come «←».
- **«Favorites» e «My activities» sono due riquadri affiancati** con il
  numero in grande (`fontSize.display`) e il nome sotto: il numero è la
  cosa che cambia, e si legge senza aprire la pagina. Finché l'elenco non
  è arrivato c'è un trattino, non uno zero.
- **In alto chi è**: un cerchio con l'iniziale, come il pulsante che apre
  «Profile», poi nome ed email. «LOGGED IN AS» sparisce: lo dice il
  cerchio. La foto prenderà il posto dell'iniziale con TASK-178.
- **«Log out» e «Delete account» stanno in «Settings»**, con l'account
  (nome, email), senza cambiare comportamento né testi. «Settings» è una
  pagina di «Profile» come «Favorites»: «←» torna a «Profile».
- **Le voci da sviluppare ci sono già, con «Soon»**: l'utente ha
  elencato cosa vuole in «Settings» (foto, cambiare email, numero di
  telefono, unità di misura, notifiche email e push, help, termini,
  privacy) e ha chiesto di aggiungerle subito e svilupparle dopo. Sono
  righe con il nome e «Soon», senza interruttori e senza tocco: si vede
  cosa arriverà e niente finge di funzionare. Ogni task che ne accende una
  la toglie dall'elenco `COMING` di `SettingsPage.tsx`.
- **Usciti da «Settings»**, per «Log out» o per l'account cancellato, la
  pagina torna «Profile»: chi rientra non si ritrova in «Settings».
- **Pezzi nuovi in `src/profile/`** (`Avatar`, `ProfileHome`,
  `SettingsPage`), che ricevono numeri e account come proprietà:
  `ProfileScreen.tsx`, che TASK-172 cambiava nelle stesse ore, li monta e
  basta.

**Scartate**: una libreria di icone (`@expo/vector-icons`: dipendenza
nuova, e l'utente ha chiesto un'emoji); il giallo per dare colore (il
giallo è del percorso, `UI.md` «Il tema»); un ingranaggio accanto al titolo
al posto della riga «Settings» (l'utente ha chiesto una sezione, come le
altre due); lasciare «Log out» sulla prima pagina (resterebbe la cosa più
in vista di «Profile»; l'utente ha confermato lo spostamento); interruttori
già disegnati per le notifiche (prometterebbero una cosa che non c'è).

**Conseguenze**: per uscire dall'account serve un tocco in più. Le emoji
le disegna il telefono: su Android hanno un altro tratto. «Settings»
mostra nove voci che ancora non fanno niente: le accendono TASK-178 (la
foto, ADR-0146, che riusa `Avatar`), TASK-183 (email e telefono), TASK-182
(unità), TASK-184 (help, termini, privacy, dopo TASK-152) e TASK-185
(notifiche, per ultime).

## ADR-0144 — «Explore»: niente filtri, altre forme dopo le prime tre, «Near me» al posto di «My start»
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** per il cosa
(«toglimi i filtri, non mi piacciono»; le prime tre figure «più velocemente
possibile, ma poi allo stesso tempo cerca di farne altre mentre li
selezionano»; «non mi piace il tasto My start … non è intuibile, devi
rivederla»); il come deciso dall'agente su delega dell'utente
(TASK-176). Supera la parte dei filtri di ADR-0135 e allarga ADR-0116.

**Contesto**: «Best near you» aveva due filtri in una riga, «Shape» e
«Distance» (ADR-0135). Una città scelta senza percorsi consigliati
disegnava tre esempi, cuore, cerchio e stella da 5 km, e poi si fermava
(ADR-0116); una con percorsi consigliati mostrava solo quelli. Per tornare
dalla città ai percorsi vicini c'era un pulsante «My start» accanto al nome
della città, sotto il campo di ricerca.

**Decisione**:
- **I filtri si tolgono**, non si nascondono: `RouteFilters.tsx` e i suoi
  test si cancellano, con `filterOptions` e `filtered`. «Best near you»
  mostra tutti i percorsi nell'ordine dell'API, i migliori per primi.
- **Dopo le prime tre forme l'app ne disegna altre cinque**: luna, cavallo,
  lumaca, testa di cane, testa di coniglio (`MORE_SHAPES` in
  `exampleRoutes.ts`). Scelte misurando, il 2026-10-02 sul Mac, ogni forma
  del catalogo a 5 km dal centro di quattro città, come la chiede l'app
  (somiglianza del percorso scelto dal motore):

  | Forma | Trento | Verona | Bologna | Padova | Media |
  |---|---|---|---|---|---|
  | cavallo | 0,98 | 0,97 | 0,99 | 0,94 | 0,97 |
  | lumaca | 0,92 | 0,99 | 0,95 | 0,94 | 0,95 |
  | stella | 0,92 | 0,97 | 0,96 | 0,94 | 0,95 |
  | luna | 0,92 | 0,94 | 0,97 | 0,92 | 0,94 |
  | testa di cane | 0,92 | 0,90 | 0,98 | 0,90 | 0,92 |
  | testa di coniglio | 0,91 | 0,91 | 0,94 | 0,92 | 0,92 |
  | cerchio | 0,91 | 0,92 | 0,92 | 0,91 | 0,92 |
  | cuore | 0,81 | 0,91 | 0,95 | 0,94 | 0,90 |
  | farfalla | 0,89 | 0,94 | 0,89 | 0,88 | 0,90 |
  | gatto | 0,83 | 0,92 | 0,88 | 0,81 | 0,86 |
  | pesce | 0,87 | 0,77 | 0,75 | 0,75 | 0,79 |

  Le cinque scelte vengono come il cerchio e il cuore o meglio; farfalla,
  gatto e pesce restano fuori, zucca e albero di Natale sono di stagione.
- **Una alla volta, come le prime**: l'API lavora due richieste alla volta e
  il motore usa già più processi (ADR-0136 ha scartato le richieste
  insieme). Le altre forme partono solo quando le prime tre sono finite.
- **Una scheda solo quando tocca a lei.** La forma in corso ha la scheda
  «Drawing…», quelle dopo non si annunciano: nessuno le ha chieste, e una
  fila di schede vuote spingerebbe sotto lo schermo i disegni del feed
  (ADR-0132). Una forma che l'API non riesce a disegnare lì
  (`shape_not_drawable`) non compare e non viene richiesta finché l'app
  resta aperta: darebbe lo stesso esito al costo di una ricerca intera. Un
  guaio che non è della forma (rete, troppe richieste al minuto) ferma le
  altre in silenzio; si richiedono alla prossima scelta della città. Le
  prime tre si comportano come prima: scheda, messaggio, «Try again».
- **Le forme in più stanno dentro una parte del limite dell'API**
  (`EXAMPLES_PER_MINUTE`, 18). L'API accetta 30 POST al minuto da un
  telefono (ADR-0076), e una città che ha già disegnato risponde subito
  alle sue otto richieste: tre città così in un minuto li userebbero
  tutti, e verrebbero rifiutati «Start», «Export GPX» o le prime tre forme
  della città dopo. Le prime tre non aspettano mai, e costano quanto
  prima; una forma in più parte solo se nell'ultimo minuto sono partite
  meno di 18 richieste di esempi, altrimenti aspetta, senza scheda.
  Il tetto è preso sul 30 che l'API ha da sola, non su quello del server:
  lì oggi `SHAPEROUTE_RATE_LIMIT` è 120 a telefono (`deploy/.env`, rimasto
  da quando tutti i telefoni contavano come uno), e `DEPLOY.md` F.12 dice
  che può tornare vuoto, cioè a 30. L'app non sa quale dei due vale, e
  con 120 il tetto costa solo l'attesa delle forme in più della terza
  città sfogliata in un minuto.
- **Il cerchio si chiede per primo**, anche se la prima scheda resta il
  cuore. La zona di una forma è un quadrato attorno al centro, largo quanto
  la forma arriva lontano, e l'API ne scarica una solo se nessuna di quelle
  sul disco la contiene (`covering_path`). Mezzo lato a 5 km, dal motore:
  cerchio 2751 m, cuore 2718, luna 2579, stella 2471, cavallo 2426, lumaca
  1971, testa di coniglio 1794, testa di cane 1681. Col cuore per primo una
  città nuova per l'API scaricava la zona del cuore e subito dopo quella
  del cerchio, 33 m più larga per lato: due download da Overpass invece di
  uno (a Rovereto, prima che avesse la zona, i log di TASK-168 ne contano
  uno per forma). Fra le altre forme la luna va per prima per lo stesso
  motivo. **Lo stesso ordine nell'API**: `EXAMPLE_SHAPES` in
  `prefetch_zones.py` diventa cerchio, cuore, stella, e da lì lo prende
  `draw_examples`, così app e server chiedono le prime tre allo stesso
  modo. Per le zone di `prefetch_zones` l'ordine non conta: sono
  l'unione delle aree.
- **Anche le città con percorsi consigliati**: fra le otto forme l'app
  disegna quelle che la città non ha, e le aggiunge in coda alle sue
  schede, uguali alle altre. Sono tutte «in più»: niente sezione degli
  esempi, niente messaggi. Le città in evidenza, che dal catalogo hanno
  solo cuore, cerchio e stella (ADR-0132), ricevono così le altre cinque.
  Senza una città scelta non si disegna niente: una richiesta dalla
  posizione di chi usa l'app non resta sull'API (ADR-0136), e si rifarebbe
  a ogni apertura. Sulle schede aggiunte la città ha il nome che le danno
  le sue schede del catalogo («Milano», dove la ricerca dice «Milan»): è
  quello del percorso che parte più vicino al centro, entro un chilometro
  (`ownCityName`); vale anche per la scheda sulla mappa.
- **I disegni del feed sotto gli esempi** (ADR-0132) restano legati alle
  prime tre forme: quando arrivano le altre c'è già qualcosa da scegliere.
- **«Near me» è la prima voce della fila delle città**, con il segno della
  posizione (un anello col suo centro, due `View`: nessuna icona nuova). È
  accesa finché non si sceglie una città; da una città, un tocco riporta
  ai percorsi vicini alla partenza. La riga col nome della città e «My
  start» sparisce: la città scelta è la voce accesa, e il suo nome intero
  è già sotto il titolo della pagina («Starting within 5 km of …»).

**Scartate**: nascondere i filtri dietro un pulsante (l'utente non li
vuole); disegnare le otto forme insieme, o a coppie (i due thread
dell'API); annunciare subito tutte le schede (cinque schede vuote in più, e
i disegni del feed fuori dallo schermo); una soglia di somiglianza per le
altre forme (le prime tre non l'hanno, e la scheda dice già la
percentuale); `maintainVisibleContentPosition` sulla pagina, per non
spostare i disegni del feed quando si aggiunge una riga di schede (terrebbe
fermo anche quello che sta sotto il campo della città quando compaiono i
suggerimenti, spingendo il campo fuori dallo schermo); aggiungere le
altre cinque forme a `EXAMPLE_SHAPES` dell'API perché `draw_examples` le
disegni prima (oltre un'ora e mezza di calcolo in più sulle città già
previste, e restano comunque sull'API dal primo telefono: si può fare
dopo, rilanciando il comando); chiamare la voce col nome
della partenza quando è un luogo cercato (servirebbe una riga in `App.tsx`,
che è di altri task in lavorazione); un pulsante con una freccia, o «Back
to my position» scritto per esteso (resta un pulsante in più, lontano
dalla fila in cui si sceglie).

**Conseguenze**: una città nuova chiede all'API otto percorsi invece di
tre, sempre uno alla volta: sul server 7–19 s l'uno (TASK-168, dai log),
ma solo al primo telefono, perché restano sull'API come le prime tre. Nelle
62 città disegnate prima con `draw_examples` le prime tre arrivano subito,
e il primo telefono disegna le altre cinque. Chi sfoglia più di due città
già disegnate per intero in un minuto vede le forme in più della terza
arrivare quando il minuto è passato. Il file degli esempi sul
telefono tiene fino a otto percorsi per città invece di tre (ultime 8
città). Quando si aggiunge una riga di schede i disegni del feed scendono
di una riga, al più due volte. `draw_examples` disegna ancora solo le
prime tre forme. Se la partenza è un
luogo cercato e non la posizione, la voce dice comunque «Near me». Con la
mappa sotto le schede (ADR-0142) ogni forma in più chiede anche la sua
foto. Da provare con il dito sull'iPhone.

## ADR-0152 — «Sport» in «Settings»: un elenco nell'app, la scelta sul telefono, «Soon» finché il motore non c'è
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** («Nelle
impostazioni, fai scegliere anche il tipo di sport, perché poi
implementiamo anche per Bici e padel canoa»; fra tre proposte: «Run»
scelto, gli altri visibili con «Soon»); il come deciso dall'agente su
delega dell'utente (TASK-189).

**Contesto**: il motore disegna solo percorsi da corsa (la richiesta
all'API ha già `activity`, che oggi vale solo `"running"`). Bici e canoa
sono task del motore (TASK-190, TASK-191). «Settings» (ADR-0145) è a
sezioni, e le voci non ancora fatte dicono «Soon» senza prendere il tocco.

**Decisione**: gli sport sono un elenco nell'app,
`src/settings/sport.ts`: «Run», «Bike», «Paddle» (canoa, kayak, SUP),
ognuno con `ready`. In «Settings» hanno una sezione loro, «SPORT», tre
righe: uno sport pronto è un pulsante di scelta, con «✓» su quello
scelto; uno non pronto dice «Soon» e non si tocca, come le altre voci da
fare. La scelta resta nei documenti del telefono (`sport.json`), come le
città recenti; senza scelta, o con una scelta non pronta, vale «Run». Il
«✓» è bianco: il giallo è del percorso. Per ora la scelta non va all'API:
con un solo sport non cambierebbe niente.

**Alternative scartate**: far scegliere subito bici e canoa, con una
riga che avvisa che i percorsi sono da corsa (scartata dall'utente:
promette una cosa che non c'è); una riga sola «Sport» con «Soon»
(scartata dall'utente); tenere la scelta nell'account (serve l'API e una
migrazione, per una scelta che oggi ha un valore solo); una riga in
«Preferences» che apre una pagina (per tre voci basta l'elenco sul
posto, e «Settings» non ha altre pagine sotto).

**Conseguenza**: accendere uno sport è `ready: true` nella sua riga, più
il lavoro del motore: lo fa il task che lo porta, che manda anche la
scelta all'API in `activity`. La scelta vale per il telefono, non per
l'account: su un altro telefono si riparte da «Run». La sezione è un
componente a parte (`SportSetting`), con gli stili delle righe di
«Settings» ripetuti: `SettingsPage.tsx` era di TASK-177 mentre si
scriveva.

## ADR-0153 — La rete della bici: strade e ciclabili, sensi unici rispettati, una cache sua
**Stato**: Attiva · 2026-10-02 · deciso dall'agente su delega dell'utente
(TASK-190, parte A: il motore). Le distanze, 10–30 km, e `activity:
"cycling"` invece di un campo `sport` sono **scelte dell'utente** (task
file).

**Contesto**: il motore aveva una rete sola, `foot` (ADR-0022): ogni
strada nei due sensi, scale e marciapiedi compresi, le strade col
marciapiede disegnato a parte escluse. In bici servono altre strade, i
sensi unici, e una cache che non si mescoli con quella a piedi.

**Misure sui dati veri, e il loro limite.** Overpass il 2026-10-02 rifiuta
le connessioni dal Mac: un tentativo solo, alle 18:23Z, dalla CLI
(`--activity cycling`, cerchio da 10 km dal centro di Trento), «Connection
refused» su tutti e due gli indirizzi. **Nessuna zona della bici è stata
scaricata.** Le misure vengono dalle risposte di Overpass già in cache sul
Mac (`data/cache/http/`, lette senza scriverci), che sono quelle del
filtro **a piedi**: ci sono i tag veri di ogni strada, ma **mancano le
strade col marciapiede disegnato a parte** (`sidewalk=separate`, spesso le
vie principali di una città) e quelle con `foot=no`. Quattro zone: Trento
(città, 17 km), Valsugana (valle: Levico, Caldonazzo, Pergine), Padova
(città di pianura), Bologna. Km di strada:

| | Trento | Valsugana | Padova | Bologna |
|---|---|---|---|---|
| tutta la risposta | 4.102 | 3.883 | 4.619 | 3.561 |
| `highway=cycleway` | 113 | 29 | 86 | 277 |
| `path` + `bicycle=designated` | 19 | 25 | **310** | 13 |
| `footway` + `bicycle=designated` | 0,9 | 0 | 15,6 | 8,4 |
| `path`/`footway` + `bicycle=yes` | 63 | 79 | 26 | 50 |
| pedonali aperte alle bici | 4,2 | 1,4 | 7,0 | 12,6 |
| `trunk` (con le rampe) | 51,5 | 50,4 | 125,3 | 11,7 |
| `primary` (con le rampe) | 29,6 | 83,3 | 60,6 | 134,4 |
| `track` | 1.168 | 1.361 | 248 | 174 |
| vietate alle bici¹ | 45 | 46 | 29 | 27 |
| sensi unici, fra le strade della bici | 147 | 56 | 520 | 519 |
| … aperti alle bici in contromano² | 4,1 | 1,0 | 13,9 | 8,1 |
| … con una corsia ciclabile nell'altro senso³ | 0,2 | 0 | 7,8 | 5,1 |
| sterrato (`surface`, o `track` senza) | 1.096 | 1.271 | 375 | 251 |

¹ `bicycle=no|dismount|use_sidepath|private`, `access=no|private|
agricultural|forestry`, `vehicle=no|private`, `motorroad=yes`.
² `oneway:bicycle=no` (Padova 113 strade, Bologna 65, Trento 68,
Valsugana 5) o `cycleway*=opposite*` (Padova 21, Trento 1).
³ `cycleway:left|right:oneway=-1|no`, spesso insieme al tag di ².

Rete della bici costruita **dal codice del motore** su quelle risposte
(sempre senza le strade col marciapiede a parte): con i sensi unici, il
pezzo più grande in cui ogni nodo si raggiunge da ogni altro è il 99,0%
del pezzo più grande senza sensi (Valsugana), il 98,1% (Padova), il 79,5%
(Trento); nessun arco su scale, marciapiedi, `trunk` o vie vietate. Percorsi
pianificati lì (cuore, cerchio, stella; somiglianza, sterrato):

- **Valsugana** (partenza a Levico): tutti e sei disegnati, 0,62–0,92; a
  10 km 0,79 cuore, 0,68 cerchio, 0,83 stella; a 20 km 0,76, 0,62, 0,92;
  sterrato 0–6,2 km, `primary` 0–1,5 km; 2–4 s l'uno.
- **Padova** (centro): a 20 km cuore 0,86, cerchio 0,93, stella 0,91; a
  10 km stella 0,79, cuore e cerchio non disegnabili.
- **Trento** (centro): stella 0,90 a 10 km e 0,74 a 20, cuore 0,66 a
  10 km, il resto non disegnabile. Nell'area del cuore da 10 km la rete
  approssimata è a pezzi già senza i sensi unici (il pezzo più grande ha
  7.152 nodi su 9.978), e coi sensi unici 3.763, senza la partenza: mancano
  proprio le vie principali col marciapiede a parte.

Queste misure dicono **quali tag contano** e che il motore li legge; non
dicono come viene una forma sulla rete vera della bici in città. Non sono
campioni da giudicare.

**Decisione**:

1. **Quali strade** (`network.rideable`, `BIKE_ROADS`): ciclabili e strade
   fino alle `primary` (`primary`, `secondary`, `tertiary` con le rampe,
   `unclassified`, `residential`, `living_street`, `service`, `road`,
   `track`). `path`, `footway` e `bridleway` **solo con
   `bicycle=designated`** (a Padova sono 310 km, più delle sue `cycleway`);
   non con `bicycle=yes`, che a Trento e in Valsugana è soprattutto un
   sentiero di montagna (58 e 76 km di `path`) e in città un marciapiede.
   Zone pedonali con `bicycle=yes|designated|permissive|destination`. **Mai**
   scale, `trunk` e autostrade. Una strada è chiusa con `bicycle=no|
   private|dismount|use_sidepath`, `motorroad=yes`, `vehicle=no|private`,
   `access=no|private|agricultural|forestry`, salvo un `bicycle=yes|
   designated|permissive|destination` esplicito. Le `track` restano (in
   valle sono la rete fra i paesi) e le `primary` anche: tutte e due
   diventano warning (punto 5).
2. **Il download**: `network_type="bike"` (OSMnx tiene i sensi unici:
   `oneway=yes|-1`, rotatorie), con **due filtri Overpass** (`BIKE_FILTER`):
   le strade, e solo i sentieri e le zone pedonali con un tag `bicycle` che
   le apre. Due richieste per zona invece di una, ma la seconda porta pochi
   km: un filtro solo con tutti i `footway` e `path` scaricherebbe il 25%
   delle vie a Trento (7.644 `footway` su 30.910) e l'80% a Parigi e New
   York, per buttarle. Sono condizioni semplici, come `FOOT_FILTER`, che
   l'estratto (`zone_extract.tag_filter`) sa leggere. I tag che servono
   (`BIKE_TAGS`) si aggiungono a quelli che OSMnx tiene, solo per il
   download. Il grafo arriva **non semplificato**: `bike_ways` decide
   strada per strada, poi semplifica come OSMnx.
3. **Sensi unici: un percorso contromano non esiste.** Il grafo è
   orientato e il percorso segue gli archi, quindi non è un warning ma
   un'impossibilità. Un senso unico è aperto alle bici nei due sensi solo
   dove OSM lo dice: `oneway:bicycle=no`, `cycleway[:both|:left|:right]=
   opposite*`, `cycleway:left|right:oneway=-1|no` con una corsia
   (`bike_direction`); `oneway:bicycle=yes|-1` su una strada a doppio
   senso la fa a senso unico per le bici. Conseguenze nel motore:
   - un ritaglio della rete `bike` tiene il pezzo più grande **in cui ogni
     nodo si raggiunge da ogni altro** (`crop`, `largest_piece`), non solo
     quello con le strade unite: da un senso unico cieco non si torna. Per
     le zone `bike`, `ZoneCrop` passa da `crop` (la scorciatoia di
     ADR-0082 segue i pezzi a piedi);
   - da una partenza vicina (ADR-0071) **il ritorno è la via più breve
     consentita**, non l'andata al contrario (`with_approach`); se non c'è,
     quella partenza si scarta.
4. **Una cache sua**: `bike_<sud>_<ovest>_<nord>_<est>.graphml` col suo
   pickle, accanto ai `foot_*`; una zona si cerca solo fra i file della sua
   rete. I `foot_*` non cambiano nome né contenuto. Un grafo `bike` porta
   `network="bike"`; i grafi a piedi non hanno l'attributo, quindi tutti
   quelli già salvati restano «foot». `plan_shape` e `ShapeJob` ricevono
   l'`activity` e rifiutano un grafo di un'altra rete (`check_network`,
   `WrongNetworkError`): una sorgente sbagliata è un errore, non un
   percorso a piedi chiamato bici.
5. **Le attività** (`models.py`): `DISTANCE_LIMITS_M` con `running` 1–50 km
   (come prima) e `cycling` **10–30 km**; `ACTIVITIES` sono quelle che il
   motore disegna e che `check_activity` accetta; `check_distance(distance,
   activity)`: «distance must be between 10000 and 30000 metres for
   cycling, got 5000». Per la corsa messaggi e ordine dei controlli sono
   quelli di prima. **`SUPPORTED_ACTIVITIES` resta `("running",)`**: è il
   contratto che `packages/shared-types` rispecchia (ADR-0028), e
   `test_contract.py` lo confronta con `fixtures/contract.json`;
   cambiarlo da solo rompe quel test, e `shared-types` è della parte B.
   Passa a `("running", "cycling")` nella parte B, insieme al suo
   specchio.
6. **Validazione (§6) in bici**: le stesse misure; le scale non possono
   esserci; le strade principali sono le `primary`; in più `unpaved`, solo
   sulla rete `bike`: metri su `surface` senza fondo duro
   (`validation.UNPAVED`) o su `track` senza `surface` e non
   `tracktype=grade1`, warning appena c'è («… m of the route on unpaved
   roads»). A piedi le misure restano cinque, senza `unpaved`.
7. **La CLI**: `--activity cycling` usa la rete `bike` e stampa i metri di
   sterrato.

**Scartate**: il filtro `bike` di OSMnx com'è (prende ogni `path` e
`bridleway`, le `trunk`, e non legge `oneway:bicycle` né `cycleway`); un
solo filtro Overpass con tutti i marciapiedi (sopra); escludere tutti i
`path` (Padova perde 310 km di ciclabili); prendere anche i `path` con
`bicycle=yes` (sentieri); escludere le `track` (la valle resta senza rete
fra i paesi; la superficie è fuori scope, e lo sterrato è un warning come
chiede il task); i sensi unici come warning invece che come regola (il
task: un percorso contromano non è accettabile); i pezzi «con le strade
unite» anche in bici; aggiungere ora `cycling` a `SUPPORTED_ACTIVITIES`
(sopra); un campo nuovo nel grafo per ogni arco al posto dell'attributo
del grafo (le zone a piedi già salvate non l'avrebbero).

**Conseguenze**:

- La corsa non cambia: stessi file, stesso filtro, stessi percorsi; i test
  di prima passano senza toccarli (motore 1.026, API 574).
- **Fra la parte A e la B** il motore accetta `cycling` (`RouteRequest`), e
  quindi anche l'API: una richiesta `cycling` a `/route-jobs` o `/routes`
  finisce in `WrongNetworkError` (`engine_error`), perché l'API dà ancora
  la rete a piedi. Le foto (`images.py`) invece costruiscono `ShapeJob`
  senza `activity` e controllano la distanza della corsa: una foto
  `cycling` uscirebbe a piedi. L'app non manda `cycling` (la riga «Bike» è
  «Soon», ADR-0152). La parte B chiude tutti e due.
- Una zona della bici costa **due richieste a Overpass**.
- **Le zone della bici sono grandi**: cerchio da 10 km, 9 km di lato; da
  20 km, 16; da 30 km, **23 km** (530 km²), 26 con la ricerca lontana. Le
  zone di oggi (17 × 17 km, ADR-0119) non bastano per 30 km: va misurato
  nella parte B prima di promettere i tempi.
- `ZoneCrop` non accelera le zone `bike`: in una città grande il ritaglio
  costa di più che a piedi (da misurare nella parte B).
- `engine_fingerprint` cambia come a ogni modifica del motore: gli esempi
  tenuti sul server si ridisegnano alla prima richiesta.
- **Non verificato**: una zona vera della bici (Overpass), i tempi su di
  essa, quanto la rete vera di una città resta a pezzi coi sensi unici, e
  i campioni da far giudicare all'utente (cuore, cerchio e stella a 10, 20
  e 30 km a Trento e in una città di pianura). Da fare appena Overpass
  riapre o con l'estratto (parte B, `prefetch_zones --extract`).

**Aggiornamento (parte B, l'API, 2026-10-02)** — deciso dall'agente su
delega dell'utente (TASK-190, parte B). Cosa mostrano «Explore», «Feed» e
la corsa con «Bike» scelto resta una scelta dell'utente (parte C).

1. **Il contratto**: `SUPPORTED_ACTIVITIES = ("running", "cycling")`,
   rispecchiato da `ACTIVITIES` di `shared-types` e da
   `fixtures/contract.json`, che ora porta anche i limiti di ogni attività
   (`distance_limits_m`; in `shared-types` `DISTANCE_LIMITS_M`, per la
   parte C). `min_distance_m` e `max_distance_m` restano quelli della
   corsa. Una fixture nuova, `route-request-cycling.json`, letta dai test
   dei due lati. L'app pubblicata manda `running` e legge le stesse
   risposte: per lei non cambia niente.
2. **Ogni richiesta sulla rete della sua attività**: l'API tiene un
   `ZoneGraphs` per attività (`activity_graphs.ActivityGraphs`), ognuno
   sulla sua cache (`OsmnxSource.for_activity`: `foot_*`, `bike_*`);
   `/routes`, `/route-jobs`, `/image-route-jobs` e il replay danno al
   motore quello della richiesta (`source_for`). Quello che non ha
   un'attività resta a piedi: i percorsi a tema e `/route-directions` (i
   percorsi di «Explore» sono corse). Un'API con un solo loader (i test) lo
   dà a ogni richiesta, e il motore rifiuta una bici su un grafo a piedi
   (`engine_error`): mai un percorso a piedi chiamato bici.
3. **Solo le attività del contratto**: il motore può disegnarne di più
   (`ACTIVITIES`; domani `paddling`, TASK-191), e una che l'API non serve è
   `invalid_request` («unsupported activity 'paddling'; choose one of:
   running, cycling», `check_supported`), non un 500.
4. **Limiti ed errori**: in bici fuori da 10–30 km è `invalid_request` col
   messaggio del motore («distance must be between 10000 and 30000 metres
   for cycling, got 5000»); la corsa ha i messaggi di prima. La distanza
   suggerita di `shape_not_drawable` resta nei limiti dell'attività (in
   bici mai sotto 10 né sopra 30 km): `/routes` la sa dalla richiesta
   (`request.state`), i job dal loro `RouteRequest`. Una foto in bici ha
   limiti e rete della bici (`ImageRequest`, `image_job`).
5. **Una zona della bici alla volta in memoria** (`ZONES_IN_MEMORY`): le
   zone a piedi restano 2 (`MAX_ZONES`), quelle della bici 1. Una richiesta
   in bici in un'altra città rilegge la sua zona dal disco (il pickle:
   0,3–0,5 s sul Mac).
6. **Le zone della bici** (`prefetch_zones --activity cycling`,
   `bike_zone_box`): **26 × 26 km** attorno al centro della città, cioè
   ogni forma del catalogo a 30 km dal centro con la ricerca lontana del
   motore (la più larga è il cerchio; una parola, che ripiega la sua
   linea, sta in meno). Ci stanno anche un 30 km da una partenza fino a
   circa 1,4 km dal centro (senza ricerca lontana), un 20 km fino a circa
   3,4 km, un 10 km fino a circa 6,9 km. Senza i nomi delle strade: la rete
   della bici ha già le vie col marciapiede a parte (parte A).
   **Solo dall'estratto**: il
   comando rifiuta `--activity cycling` senza `--extract`, perché una zona
   della bici sono due richieste grandi, e Overpass rifiuta il Mac e il
   server. Un riquadro di 30 km (anche il 30 km da 2 km dal centro)
   costerebbe un terzo in più di memoria e di disco: scartato per ora.
   Fuori dalle zone, una richiesta in bici scarica da Overpass come una a
   piedi.
7. **Quali città**: prima **Trento**, la prova vera sul server (con l'ok
   dell'utente; comandi nel task file). Poi, con un altro ok, le 52 di
   `--preset italy`, una alla volta nel container da 4 GiB di TASK-137;
   una città che non ci sta (come Berlino a piedi) resta senza. Le città
   estere no: non c'è il loro estratto, restano a Overpass.
8. **Gli esempi delle città** (`draw_examples`): nessuna variante della
   bici adesso. Cosa mostra «Explore» con «Bike» scelto è la domanda 1 del
   task file, una scelta di prodotto della parte C.
9. **I percorsi tenuti** (`route_store`): la chiave aveva già
   `activity`; un test lo prova (lo stesso cuore dallo stesso centro in
   bici è un altro file, e quello della corsa resta). Nessun nome di file
   cambia.

**Misure, sul Mac e senza rete.** Zone `bike` costruite **per la strada
dell'estratto** (`zone_extract.served_from`, che legge i due `BIKE_FILTER`
senza modifiche) dalle risposte a piedi già in cache, sullo stesso
riquadro della zona a piedi. Mancano quindi le vie col marciapiede a
parte: nei file `names_*` del server sono lo 0–2% dei km di strada a
Palermo, Bari e Genova, il 23% a Londra, più del doppio a New York.
«In memoria» è quanto cresce un processo che fa `read_graph` e `ZoneCrop`
come l'API:

| Zona | Lato | Nodi | Archi | Pickle | In memoria | Costruzione |
|---|---|---|---|---|---|---|
| Trento, bici | 18,6 km | 20.424 | 43.110 | 11 MB | 127 MB | 10 s, picco 0,97 GB |
| Valsugana, bici | 22,6 km | 12.152 | 27.540 | 9 MB | 105 MB | 8 s |
| Milano, bici | 19,4 km | 52.493 | 104.856 | 24 MB | 236 MB | 29 s, picco 1,79 GB |
| Roma, bici | 16,7 km | 41.073 | 77.995 | 19 MB | 186 MB | 18 s, picco 1,69 GB |
| Trento, piedi | 18,6 km | 32.728 | 85.988 | 19 MB | 185 MB | |
| Milano, piedi | 19,4 km | 136.447 | 406.392 | 72 MB | 618 MB | |
| Roma, piedi | 16,7 km | 91.894 | 262.808 | 51 MB | 454 MB | |

Il ritaglio di una zona della bici passa da `network.crop` (punto 3 della
decisione):
0,1–0,7 s (Milano, tutta la zona), e mentre c'è il processo cresce del
25–35% della zona. **Stima per una zona di 26 km** (676 km²), in
proporzione all'area: 0,14 GB in valle, 0,25 GB a Trento, 0,43–0,45 GB a
Milano e Roma, fino a circa 0,6 GB contando le vie che qui mancano; più il
ritaglio durante una richiesta. Una zona della bici pesa quanto o meno di
una zona a piedi della stessa città di oggi (Milano a piedi 0,62 GB): con
una sola in memoria, l'API sul server (8 GB) cresce al più di circa
0,6–0,8 GB; i processi delle partenze vicine partono solo se la memoria
c'è (ADR-0121). La costruzione dall'estratto, per 26 km: circa 1,9 GB a
Trento e 3,2 GB a Milano oltre a osmium, dentro i 4 GiB del container per
le città medie, da guardare per le grandi.

**Conseguenze**: una richiesta `cycling` all'API ora arriva sulla rete
della bici; cambia `models.py`, quindi di nuovo `engine_fingerprint` (gli
esempi tenuti sul server si ridisegnano alla prima richiesta). Gli eventi
delle ricerche (`insights`) non scrivono l'attività: un percorso in bici
vi compare come una corsa (il registro delle richieste invece ha il corpo
intero). **Non verificato**: una zona vera della bici, i tempi di un
percorso su di essa, i campioni da far giudicare all'utente.

**Aggiornamento (parte C, l'app, 2026-10-02)** — deciso dall'agente su
delega dell'utente (TASK-190, parte C). Le due domande di prodotto
(«Explore», «Feed» e la corsa con «Bike» scelto) restano dell'utente: con
la bici quelle pagine non cambiano.

1. **Lo sport arriva a «Draw» subito**: `saveSport` avvisa chi ascolta
   (`subscribeSport`), `useSport` lo legge dal telefono una volta e poi
   segue le scelte. Scartati: rileggere `sport.json` a ogni disegno (un
   accesso al disco per ogni render) e un contesto React attorno all'app
   (`App.tsx` e `ProfileLayer` da cambiare per una scelta sola).
2. **Sport e attività**: `activityOf` in `sport.ts` («Bike» → `cycling`,
   il resto → `running`); uno sport non pronto non è mai quello scelto. Con
   «Run» la richiesta resta la stessa, campo per campo e nello stesso
   ordine.
3. **Le distanze di ogni sport nell'app**: `APP_DISTANCE_LIMITS_KM`
   (`distance.ts`), corsa 1–21 km (`MAX_APP_DISTANCE_KM`, come prima), bici
   i limiti del contratto, 10–30 km (`DISTANCE_LIMITS_M.cycling`). Campo,
   messaggio, − e +, «Try N km» e il numero di lettere di una parola (7 a
   piedi, 8 in bici) li leggono da lì; ogni funzione ha la corsa come
   valore di partenza, così chi non passa un'attività fa quello di prima.
4. **Uno sport nuovo porta la distanza nei suoi limiti** (`fitDistance`,
   la regola di − e +): 5 → 10 in bici, 25 → 21 a piedi, una distanza che
   sta nei due resta. Scartato: tenere una distanza per sport (due stati da
   ricordare per un caso raro) e lasciare il campo fuori dai limiti con
   «Draw route» spento (l'utente vedrebbe un errore senza aver fatto
   niente).
5. **Gli errori restano quelli di prima**: un'API senza la parte B
   (`invalid_request`) e i 5 minuti (`MAX_WAIT_MS`, che non cambia) hanno i
   loro testi di sempre. Due testi nuovi, da confermare con l'utente: «Ride
   without a route» al posto di «Run without a route» con «Bike», e «At most
   8 letters.» per una parola troppo lunga in bici.

**Conseguenze**: l'app pubblicata con questa parte chiede `cycling` solo
con «Bike» scelto; va pubblicata dopo che il server ha la parte B, o chi
sceglie «Bike» legge «The app and the API do not agree». **Non
verificato**: niente sull'iPhone.

## ADR-0155 — «Explore»: il luogo scelto ha i suoi percorsi, quelli dei vicini stanno sotto
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** per il cosa
(«premo su Caldonazzo, ma non vengono fuori suggerimenti a Caldonazzo: mi
vengono fuori Levico perché è vicino … va bene dare le alternative, ma
bisogna lavorare anche su Caldonazzo, ad esempio anche le frazioni, Barco
eccetera; va bene tenere 5 km, però bisogna lavorare anche sul paese
selezionato»); il come deciso dall'agente su delega dell'utente
(TASK-192). Precisa ADR-0116 e ADR-0144.

**Contesto**: una città scelta in «Explore» riceve i percorsi del catalogo
che partono entro 5 km dal suo centro, e gli esempi disegnati dal suo
centro solo se quelli mancano (ADR-0116); da TASK-176 una città con
percorsi riceve le forme che non ha (ADR-0144). «Entro 5 km» però non vuol
dire «suoi»: Caldonazzo ha gli otto percorsi di Levico fra 3,3 e 4,3 km,
quindi mostrava solo quelli, e da Caldonazzo non partiva niente. Lo stesso
per ogni paese o frazione accanto a una città del catalogo.

**Decisione**:
- **I percorsi vicini a un luogo scelto si dividono in due** (`byPlace` in
  `ownRoutes.ts`): **suoi**, con la partenza entro `OWN_RADIUS_M` =
  **1500 m** dal punto scelto, e **dei vicini**, il resto entro i 5 km.
- **La soglia viene dal catalogo**, misurato il 2026-10-02: dei 350
  percorsi di `catalog/seed/`, il 98% parte entro 500 m dal centro della
  propria città e il più lontano a 1013 m (Levico, Trento, Verona e Padova
  ne hanno attorno a 1 km); quelli di un altro paese partono più lontano:
  i percorsi di Levico sono a 3,3 km dal centro di Caldonazzo e a 1,8 km
  da Barco. 1500 m sta in mezzo.
- **Vale per ogni luogo scelto**: città, paesi, frazioni e luoghi arrivano
  tutti da `/city-suggestions` come un punto con un nome (`Place`, `kind`
  «city» o «place»), e la divisione guarda solo il punto. Barco, a 2,8 km
  dal centro di Levico, ha i suoi esempi; un luogo dentro Levico ha i
  percorsi di Levico come suoi.
- **Le forme che il luogo «ha» sono solo quelle dei percorsi suoi.** Senza
  percorsi suoi è una città senza percorsi consigliati: la sezione
  «EXAMPLES IN …» con cuore, cerchio e stella da 5 km dal suo centro, poi le
  altre cinque forme, come in ADR-0116 e ADR-0144. Con percorsi suoi resta
  com'era: le sue schede più le forme che non ha.
- **I percorsi dei vicini stanno sotto**, in una griglia loro con
  l'etichetta **«NEAR <LUOGO>»**; le schede dicono già il paese e la
  distanza («Levico · 3.3 km away»). Il raggio resta 5 km e l'API non
  cambia.
- **Con i vicini sotto gli esempi, i disegni del feed nell'attesa non
  compaiono** (ADR-0132): c'è già qualcosa da guardare. Il credito della
  mappa resta uno solo: quello della sezione degli esempi appena uno è
  pronto, prima quello della pagina.
- **Una soglia sola**: `ownCityName` di TASK-176 usava 1000 m per lo stesso
  concetto; ora usa `OWN_RADIUS_M`.
- **Senza città scelta («Near me») non cambia niente**: una lista sola,
  nessuna etichetta, niente disegnato (ADR-0136).

**Alternative scartate**: stringere il raggio di «near you» (l'utente
tiene i 5 km, e le alternative vicine gli vanno bene); riconoscere il paese
dal nome (il catalogo dice «milano» dove la ricerca dice «Milan», e una
frazione nel catalogo non ha nome); 1000 m come soglia (quattro percorsi
del catalogo partono fra 1001 e 1013 m dal proprio centro); una griglia sola
con i suoi e quelli dei vicini mescolati per somiglianza (è quello che
l'utente ha visto: Levico al posto di Caldonazzo); disegnare cuore,
cerchio e stella dal centro anche a una città che ha già percorsi suoi
(doppioni delle sue schede); cambiare l'API perché dica di che paese è un
percorso (serve un confine per ogni paese, e la distanza dalla partenza
basta).

**Conseguenze**: il motore, provato sul Mac da Caldonazzo a 5 km con le
tre partenze vicine dell'API, disegna cuore 0,88, cerchio 0,72 e stella
0,90: in un paese piccolo le forme vengono, non tutte bene. Un paese
accanto a una città del catalogo chiede all'API
otto percorsi la prima volta che lo si sceglie, uno alla volta; se la sua
zona non è sul server la scarica (fino a un minuto), poi i percorsi restano
sull'API (ADR-0136) e la volta dopo sono subito lì. Nell'attesa sotto ci
sono già i percorsi dei vicini. Da «Near me» a Caldonazzo si vedono ancora
solo quelli di Levico: dalla posizione di qualcuno non si disegna
(ADR-0136), cambiarlo è una scelta dell'utente. Paesi piccoli e frazioni
non sono disegnati in anticipo sul server (`draw_examples`): da fare lì,
con l'ok dell'utente. Da provare con il dito sull'iPhone.

## ADR-0156 — «Send to Strava»: il collegamento passa dal server, e la corsa tiene cosa ne ha fatto Strava
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** per il cosa («Sì,
fallo vero»: l'invio vero della corsa fatta, con un'app Strava sua, fra
tre proposte); il come deciso dall'agente su delega dell'utente
(TASK-187, parte API). Non riapre ADR-0138: quello toglieva il passaggio a
mano di un *percorso*; questo carica la *corsa fatta*, che Strava permette
alle altre app (`POST /uploads`).

**Contesto**: l'utente vuole, a fine corsa, «salva, cancella, invia a
Strava». Le corse salvate ci sono (`runs`, ADR-0140). Per caricare
un'attività Strava chiede OAuth con il permesso `activity:write`, un
Client Secret che non può stare in un'app, token d'accesso che scadono
dopo sei ore e un file con l'orario di ogni punto. Documentazione riletta
il 2026-10-02: la revoca si fa con `POST /oauth/revoke` (dal 1° giugno
2026; `/oauth/deauthorize` finisce il 1° giugno 2027); un'app non rivista
collega un atleta solo; 200 richieste ogni quarto d'ora e 2 000 al giorno.

**Decisione**:
- **Tutto OAuth sta sul server.** L'app chiede `POST /me/strava/connect`,
  apre nel browser l'indirizzo che riceve e non vede altro: né il secret
  né un token. Strava rimanda il browser a `GET /strava/callback`
  dell'API, che scambia il codice e risponde una pagina. Nessuna
  dipendenza nuova, né nell'app né nell'API (`urllib`, come per Geoapify).
- **Lo `state` lega la callback all'account**: casuale, 32 byte, vale una
  volta per 10 minuti, uno per account, nel database solo il suo SHA-256
  (tabella `strava_states`). La callback è fuori da `X-API-Key`
  (`OPEN_PATHS`): un browser non ha la chiave, e senza uno `state` buono
  la pagina non fa niente.
- **Si chiede solo `activity:write`**, e si controlla che l'atleta non
  l'abbia tolto: senza, non si chiede nemmeno il token.
- **I token in chiaro nel database** (`strava_accounts`). Vanno rimandati
  a Strava, quindi un hash non basta; cifrarli vorrebbe una dipendenza e
  una chiave in più da custodire nello stesso `.env`. Chi copia il
  database ha token d'accesso che durano al più sei ore e refresh token
  inutili senza il Client Secret, che sta solo nell'ambiente del server.
- **Un atleta è di un account solo, l'ultimo che l'ha collegato**: Strava
  dà una sola serie di token per atleta, e due righe se li romperebbero a
  vicenda a ogni rinnovo.
- **Il rinnovo è dell'API**: prima di usare un token a meno di cinque
  minuti dalla scadenza lo rinnova, una richiesta alla volta per atleta
  (`FOR UPDATE`), e tiene il refresh token nuovo. Un token rifiutato
  mentre è ancora buono per l'orologio si rinnova una volta: se Strava
  rifiuta anche il refresh token l'atleta ha tolto l'accesso, la riga si
  cancella e l'app torna a «Connect with Strava» (`409`). Un Client Secret
  sbagliato sul server (`401` di Strava) non scollega nessuno.
- **La corsa tiene cosa ne ha fatto Strava** (`strava_status`,
  `strava_upload_id`, `strava_activity_id` su `runs`): una già mandata non
  si rimanda, una in lettura si riprende a guardare. Due invii insieme si
  mettono in fila sulla riga della corsa. `external_id` è la chiave della
  corsa: se il server dimentica, Strava rifiuta il doppione dicendo quale
  attività è, e l'API la prende per mandata.
- **L'invio aspetta Strava per pochi secondi** (5 sguardi, uno al
  secondo, come Strava chiede), poi risponde `202 processing` e la stessa
  chiamata rifatta riprende: niente lavori in sottofondo nell'API, e la
  coda dell'app (`outbox`) sa già riprovare.
- **Lo stato dell'invio ha un endpoint suo** (`GET
  /me/activities/{key}/strava`) invece di un campo in più nelle corse di
  «My activities»: `activities.py`, i suoi esempi e i tipi dell'app non
  cambiano, e chi non ha Strava non riceve niente di Strava.
- **Nessun codice d'errore nuovo**: `http_error` con `503` (Strava
  spento), `409` (non collegato), `502` (Strava non risponde),
  `too_many_requests` con `Retry-After` (il limite di Strava),
  `invalid_request` (`422`, Strava non legge la corsa). L'app li distingue
  dallo stato HTTP; il contratto degli errori (`schemas.py`,
  `shared-types`) resta com'è.
- **Il GPX della corsa lo scrive l'API** (`run_gpx.py`), non il motore:
  non è un percorso, è la traccia salvata con i suoi orari, e una pausa
  chiude un `<trkseg>` (`GPX.md`, «La corsa fatta»). Il motore resta
  l'unico a scrivere il GPX di un percorso (ADR-0033).
- **Scollegare cancella i token comunque**, poi revoca su Strava; se
  Strava non risponde non resta niente da noi, e l'atleta può togliere
  Sgrava dalle impostazioni di Strava. `DELETE /me` fa lo stesso prima di
  cancellare l'account, senza aspettare Strava (`before_account_delete` in
  `accounts.py`: `accounts.py` non sa niente di Strava).
- **Il dominio della callback** è `SHAPEROUTE_DOMAIN`, che il server ha
  già per Caddy; vuota, l'indirizzo a cui è arrivata la richiesta. Nessuna
  variabile in più oltre a `STRAVA_CLIENT_ID` e `STRAVA_CLIENT_SECRET`.
- **Il nome e la descrizione**, proposti dal task file e poi **scelti
  dall'utente** il 2026-10-02 sera: il nome si scrive nell'app prima di
  «Save» (`{ "name": … }`, facoltativo; vuoto, «Heart in Trento» o quello
  di Strava); la descrizione su ogni corsa, «Drawn with Sgrava» con un
  percorso, «Recorded with Sgrava» senza.

**Parte app** (2026-10-02 sera; l'arancione di Strava e l'interruttore
che ricorda sono **scelte dell'utente**, il resto deciso dall'agente su
delega dell'utente):

- **Strava si chiede all'API solo quando una schermata lo mostra** (fine
  della corsa, una corsa aperta, «Settings»), una volta per account, e di
  nuovo quando l'app torna in primo piano dopo aver aperto la pagina di
  Strava. Un'API senza Strava, o più vecchia di TASK-187 (`404`), è
  «Strava spento»: niente si vede. Il resto dell'app non fa richieste in
  più all'apertura.
- **La scelta passa da `RunEnd` a «Save» con `toStrava`** della porta
  delle corse (`activitiesDoor.ts`), detta subito prima di `onSave`:
  `App.tsx` non cambia (era di TASK-200).
- **Le corse che aspettano Strava hanno un file loro**
  (`strava-outbox.json`: account, chiave e nome), non restano in
  `activities-outbox.json`: quello tiene la corsa intera e conta «runs
  waiting for a connection»; una corsa che l'API ha già non aspetta più la
  connessione per «My activities». Una corsa con l'interruttore acceso
  porta `strava: { name }` nel primo file finché l'API non l'ha; poi passa
  al secondo, scritto prima di togliere la corsa dal primo. Si riprova a
  ogni apertura: `202`, `502`, `429` e senza rete restano; `409`, `422`,
  `404` e `503` escono (rimandare non cambierebbe niente).
- **Lo stato HTTP resta nella risposta** (`http` in `StravaOutcome`):
  l'API dice `http_error` per `404`, `409`, `502` e `503`, e l'app fa una
  cosa diversa per ognuno. `accounts.ts` non cambia.
- **Nessun ritorno automatico nell'app** dopo il browser (uno schema
  `sgrava://` nella callback): Expo Go non ha schemi nostri (come
  `music.ts`), e la pagina della callback dice già «Go back to Sgrava.».
- **Nessuna dipendenza nuova**: `Linking` e `AppState` di React Native.

**Scartate**: OAuth nell'app con `expo-auth-session` (una dipendenza, e il
secret dovrebbe comunque stare sul server per lo scambio del codice); lo
`state` in memoria (si perde a ogni riavvio e non si prova con l'orologio
dei test); cifrare i token (sopra); rifiutare un atleta già collegato a un
altro account (chi prova con due account resterebbe bloccato; e non ferma
chi convince una persona ad autorizzare un collegamento non suo, che
resta il limite di ogni collegamento cominciato nell'app e finito nel
browser: si vede solo `activity:write`, e la persona lo toglie da Strava);
un lavoro in sottofondo che segue l'upload (un'altra cosa che gira, per
due secondi di attesa); il campo `strava` dentro `Activity` (sopra);
codici d'errore nuovi (tre file del contratto in più, per casi che lo
stato HTTP già distingue); scrivere il GPX nel motore (il motore non sa
niente di corse salvate, pause e orari); `/oauth/deauthorize` (in
dismissione).

**Conseguenze**: sul server arrivano la migrazione `0004` e due variabili
(`DEPLOY.md`, «Strava»); finché l'utente non crea la sua app Strava,
Strava è spento e niente cambia. Finché Strava non approva l'app si
collega solo l'atleta dell'utente. La prova dal vero (data, ora e durata
dell'attività; se Strava legge i `<trkseg>` come pause) è dell'utente,
dopo la parte app. Strava conta le sue richieste per tutta l'app: 200
ogni quarto d'ora bastano a qualche decina di corse mandate insieme, non
a migliaia. Un'attività cancellata su Strava resta `sent` da noi: per
rimandarla serve un task. La parte app (`RunEnd`, «My activities»,
«Settings», la coda senza rete) è la seconda PR di TASK-187.

## ADR-0146 — La foto del profilo: un quadrato di 256 px fatto dall'API, cambiato da «Settings»
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** per il cosa (la
foto del profilo, da mettere in «Settings», chiesta con TASK-177); il come
deciso dall'agente su delega dell'utente (TASK-178).

**Contesto**: ADR-0115 aveva già detto dove sta la foto, un JPEG quadrato
di 256 px nel database, perché le copie di sicurezza la prendano con il
resto. TASK-116 doveva farla insieme a nome utente, bio e profilo
pubblico; l'utente l'ha chiesta prima, da «Settings», dove ADR-0145 l'ha
messa con «Soon».

**Decisione**:
- **Una tabella sua**, `profile_photos` (migrazione `0005`): una riga per
  account con la foto, `bytea`, `ON DELETE CASCADE`. Non una colonna di
  `users`: ogni `GET /me` e ogni richiesta con il token leggono `users`,
  e non devono trascinarsi i KB della foto.
- **Tre endpoint con il token**, `GET`, `PUT` e `DELETE /me/photo`, come i
  preferiti. La foto va e viene in base64 dentro JSON, come per i contorni
  delle immagini (ADR-0069): nessun formato nuovo per l'app e per i test.
  Nella risposta il JPEG intero (pochi KB), che l'app mostra come
  `data:image/jpeg;base64,…`: niente indirizzo da chiedere con il token,
  niente cache da invalidare.
- **L'API fa il quadrato**, sempre: raddrizza con l'EXIF, prende il
  quadrato in mezzo, riduce a 256 px, salva un JPEG nuovo. Il file del
  telefono non si tiene, e con lui l'EXIF: dove è stata scattata una foto
  non arriva nel database. Oltre 50 megapixel, o un formato che non è JPEG
  o PNG, è `422` prima di leggere i pixel.
- **Il quadrato lo sceglie la persona** nell'editor del telefono
  (`allowsEditing` con `aspect: [1, 1]` di `expo-image-picker`, già una
  dipendenza); quello dell'API, in mezzo, conta per una foto che arriva
  non quadrata (Android, o un'altra app).
- **10 `PUT` al minuto per account**, in memoria come le password
  sbagliate: il limite di `access.py` conta solo i POST per indirizzo, e
  ridurre una foto è il lavoro più caro degli account.
- **Nell'app**: la riga «Profile picture» di «Settings» (in un file suo,
  `PhotoRow.tsx`, lontano dalle righe che TASK-189 cambia) apre sotto di sé
  «Choose a picture», «Take a photo» e «Remove picture», come «Delete
  account» apre la sua domanda: niente menu del sistema, che in Expo Go e
  nei test si comporta in un altro modo. La foto la tiene un contesto di
  `ProfileLayer.tsx`, come preferiti e corse: il pulsante in alto, il
  cerchio di «Profile» e la riga la leggono dallo stesso posto, e si
  cambiano insieme.
- **Senza foto, senza rete o con un'API non ancora aggiornata** si vede
  l'iniziale, come prima, e non si dice niente: una foto non vale un
  errore sullo schermo. Gli errori si dicono solo quando la persona prova a
  cambiarla.

**Scartate**: la foto come colonna di `users` (sopra); un file su disco o
un servizio a parte (ADR-0115); `multipart/form-data` (una dipendenza nuova
nell'API, `python-multipart`, per un solo endpoint); un indirizzo della
foto da caricare con `Image` (vorrebbe il token in un'intestazione di
`Image`, o un indirizzo pubblico, che è TASK-116); tenere la foto sul
telefono fra un'apertura e l'altra (un'altra copia da tenere allineata;
per ora l'iniziale per un attimo va bene); `ActionSheetIOS` o `Alert` per
le tre scelte (diversi su Android, non provabili nei test come il resto di
«Settings»).

**Conseguenze**: all'apertura l'app chiede una richiesta in più, `GET
/me/photo`, con l'account. Sul server serve la migrazione `0005` (un
aggiornamento dell'API, con l'ok dell'utente); finché non c'è, la riga
dice «Profile pictures are not available on this API yet.» a chi prova. La
foto la vede solo il suo proprietario: mostrarla agli altri, con nome e
bio, resta a TASK-116, con una migrazione sua.

## ADR-0154 — Sull'acqua la forma è il percorso: la fascia entro 1 km dalla riva, la ricerca di dove ci sta, la partenza dalla riva dove si arriva a piedi
**Stato**: Attiva · 2026-10-02 · **scelta dell'utente** per il cosa (il
disegno resta entro circa 1 km dalla riva; esempi a Lago di Garda, Lago di
Como, Jesolo, Riccione); il come deciso dall'agente su delega dell'utente
(TASK-191, parte A1: solo moduli nuovi del motore).

**Contesto**: sull'acqua non c'è una rete di strade. La forma proiettata
(`ROUTE_ENGINE.md` §3) **è** il percorso, se sta tutta sull'acqua: il
lavoro è trovare rotazione, scala e posizione in cui ci sta, e una
partenza sulla riva. Il motore aveva solo le strade; serve l'acqua da
OpenStreetMap, che per il mare non ha un poligono ma la linea
`natural=coastline`, con la terra a sinistra del suo verso.

**Decisione** (`route_engine/water.py`, `route_engine/water_fit.py`):

- **L'acqua.** I laghi sono `natural=water` con `water=lake`,
  `water=reservoir` o senza `water`, di almeno **10 ha**, e non marine,
  porti o fontane; una relazione multipoligono si ricompone dalle sue way
  (esterne meno interne: le isole). Il mare è **il riquadro meno la
  terra**: la coastline taglia il riquadro in facce, e ogni faccia sta a
  sinistra (terra) o a destra (mare) dei tratti di coastline che la
  delimitano, a voti dei suoi lati più lunghi. Senza coastline nel
  riquadro non c'è mare: il mare aperto lontano da ogni riva non serve
  alla fascia. Tutto il resto del riquadro è **terra**, isole comprese.
- **Gli ostacoli**: moli, frangiflutti e pennelli (`man_made=pier`,
  `breakwater`, `groyne`; una way aperta conta larga 6 m), scogliere
  (`natural=reef`), marine e porti (`leisure=marina`, `landuse=harbour`) e
  ogni altra acqua (fiumi, canali, lagune, darsene, stagni): si tolgono
  dall'acqua navigabile. Fiumi, canali e lagune sono fuori dal task.
- **La fascia**: l'acqua navigabile entro **1000 m** dalla riva, meno
  **50 m** dalla riva e **30 m** dagli ostacoli, e a 50 m dal bordo del
  riquadro (oltre il bordo non si sa cosa c'è). La riva che conta per il
  chilometro è la terraferma e le isole di almeno **1 ha**: uno scoglio o
  un frangiflutti staccato si evita, ma non allunga la fascia di un
  chilometro in mare aperto.
- **I margini, sui dati** (API di OSM, 2026-10-02): a Jesolo i 17 pennelli
  di legno di 1,7 km di spiaggia escono dalla riva di 17–66 m (mediana
  37); a Riva del Garda i moli di 1–36 m (mediana 14), i frangiflutti di
  2–7 m, una scogliera di 12 m, una marina di 9 m; a Riccione nessuno.
  Con 50 m dalla riva la forma passa oltre la metà dei pennelli senza
  contarli; i 30 m dagli ostacoli tengono la forma lontana dalle punte
  degli altri (il pennello più lungo, 66 m, la spinge a 96 m dalla
  riva). 50 m tengono anche il disegno staccato dalla spiaggia sulla
  mappa, alla scala di un percorso di 2–3 km; 30 m tengono conto della
  base di un frangiflutti a scogliera, più larga della linea disegnata.
- **La ricerca** (`fit_shape`): la forma a grandezza intera (contorno
  lungo quanto la distanza chiesta), poi più piccola del 3% alla volta fino
  al 40%; dritta entro ±15° ogni 5°, il cerchio una volta sola (ADR-0038).
  Per ogni scala e angolo, la fascia su una griglia di celle di
  1/200 del contorno (10–40 m), ristretta di 1,25 celle: un centro va
  bene se tutti i punti del contorno cadono su celle della fascia, e allora
  il contorno è nella fascia. I centri si guardano dal più vicino alla
  partenza, 20 000 alla volta, finché 200 vanno bene; dei centri buoni se
  ne tengono 3, lontani fra loro, il cui contorno passa più vicino alla
  partenza, e si controllano esattamente con shapely
  (`band.contains`). Nessuna linea esce dal motore senza quel controllo.
- **Il costo** = |distanza − chiesta| / chiesta + **2** × (i due tratti
  dalla riva) / chiesta + **0,1** × km fra la partenza chiesta e quella
  sulla riva. Un metro di tratto costa il doppio di un metro mancato: un
  tratto più lungo non compra mai una forma più piccola. La forma «ci sta»
  se la distanza è entro **±10%** (come sulle strade); altrimenti è un
  errore che dice a quanti km ci sta (`best_distance_m`, come TASK-031).
  La somiglianza è quella della forma con sé stessa: il costo dice quanto
  si è rimpicciolita (`scale`) e spostata (`move_m`).
- **La partenza sulla riva**: i punti della riva della **terraferma** ogni
  10 m, che toccano l'acqua navigabile e stanno entro **40 m** da una
  spiaggia (`natural=beach`, `leisure=beach_resort`), uno scivolo
  (`leisure=slipway`), un molo o una via che si percorre a piedi
  (`highway`, non autostrade, superstrade, `foot=no` o private). Un nodo
  conta solo se è uno scivolo. Per una forma piazzata si tengono i punti
  entro 2 km dalla partenza chiesta e entro **300 m** dalla forma, e vince
  quello di costo minore il cui tratto dritto fino al punto più vicino
  della forma sta tutto sull'acqua navigabile (mezzo metro di tolleranza
  sul bordo). Il percorso: riva, tratto, la forma intera da lì, lo stesso
  tratto, riva. I tratti contano nella distanza e sono nel GPX.
- **Gli errori** sono `ShapeNotDrawableError`, come `NoRoadsError`
  (ADR-0148), quindi ogni chiamante li sa già trattare: `NoWaterError`
  («there is no lake or sea to paddle on within 2 km of here»), e
  `WaterFitError` («the heart does not fit at 6 km … it fits at 3.1 km»;
  «… even at 4.0 km»; «… no shore within 300 m of it can be reached on
  foot»).
- **La cache**: `data/cache/water/water_<s>_<w>_<n>_<e>.json`, separata
  dalle strade, scritta intera o niente (ADR-0104); un file che contiene
  l'area la serve. Un mancato è **una** richiesta Overpass
  (`WATER_QUERY`: coastline, `natural=water`, ostacoli, spiagge, scivoli
  e le sole vie entro 40 m dall'acqua), dall'indirizzo che risponde
  (ADR-0100). L'area di una richiesta è la partenza ± (2 km + 300 m + il
  diametro della forma + 1 km).
- **Per i campioni**, quando Overpass rifiuta: `python -m
  route_engine.water --osm-api …` legge le risposte dell'API di OSM
  (`map.json` di un riquadro piccolo, più `relation/<id>/full.json` per un
  lago grande, di cui `map` dà solo le way nel riquadro). Mai nell'API.

**Verificato sui dati veri** (API di OSM, 2026-10-02, sei chiamate: due
strisce sottili per trovare la costa, un riquadro a Riccione, uno a
Jesolo, uno a Riva del Garda e la relazione 8569 del lago intera):
il mare dalla coastline a Riccione (1,5 × 1,4 km) e a Jesolo
(1,7 × 1,8 km), il lago dalla relazione a Riva (1,9 × 2,3 km), gli
ostacoli e i punti di partenza; nove campioni (cuore e cerchio da 2 km,
stella da 3 km nei tre posti), chiusi, sull'acqua, fra 63 e 81 m dalla
terra, al più 835 m dalla riva. Fin dove le forme ci stanno, chiedendo
1, 2, 3, 4, 5, 6, 8 e 10 km: l'ultima distanza chiesta che dà un
percorso, la prima che non lo dà, e a quanto l'errore dice che la forma ci
sta (fra parentesi i km del percorso, quando non sono quelli chiesti):

| Dove | cuore | cerchio | stella |
|---|---|---|---|
| Riccione (costa dritta) | 3 sì · 4 no, «3,3» | 3 sì (2,9) · 4 no, «2,9» | 4 sì (3,7) · 5 no, «3,7» |
| Jesolo (costa dritta) | 3 sì · 4 no, «3,2» | 3 sì (2,9) · 4 no, «2,9» | 4 sì (3,7) · 5 no, «3,7» |
| Riva del Garda (riquadro di 1,9 × 2,3 km) | 4 sì · 5 no, «4,3» | 4 sì (3,6) · 5 no, «3,6» | 6 sì (5,7) · 8 no, «5,5» |
| Lago della fixture (largo 1,8 km) | 6 sì (5,6) · 8 no, «5,8» | 5 sì · 6 no, «5,1» | 6 sì · 8 no, «6,3» |

Ogni piano sui dati veri richiede meno di un secondo; costruire l'acqua
di un'area intera (8–9 km, con la relazione del Garda) 0,1 s.

**Solo sulle fixture o non verificato**: la richiesta Overpass (un
tentativo il 2026-10-02: «No route to host»; la query non è mai stata
eseguita), e quindi un riquadro intero di una richiesta vera con tutti
i suoi ostacoli e accessi; isole in mare e un lago con un'isola (fixture);
il Lago di Como (nessun dato scaricato). I campioni sono fatti solo dentro
i riquadri scaricati: oltre il bordo non si vede niente, e la fascia si
ferma a 50 m dal bordo.

**Alternative scartate**: un grafo sull'acqua a cui agganciare la forma
(non c'è una rete da prendere: sarebbe inventarla); spostare o piegare i
punti della forma dove escono dalla fascia (la forma non sarebbe più
quella, e sull'acqua niente obbliga a deformarla); 200 m dalla riva, la
fascia dei bagnanti delle ordinanze balneari sul mare (è una regola del
posto, fuori dal task; con 200 m restano 800 m, e la scelta va fatta
dall'utente); girare liberamente le forme lungo una costa obliqua
(ADR-0038: una forma inclinata non si riconosce; riaprirlo è una scelta
dell'utente); `features_from_bbox` di OSMnx (scarica tutte le strade del
riquadro per trovare quelle vicino all'acqua, e un GeoDataFrame per
leggerle; la query fatta a mano chiede solo le vie entro 40 m
dall'acqua, e basta shapely); la partenza sulla riva più vicina alla
partenza chiesta invece che alla forma (un tratto lungo fino alla forma,
o un posto da cui la forma non si vede); unire e allargare tutte le vie
per trovare la riva raggiungibile (2,7 s su Riva; con un indice spaziale
0,1 s per tutta l'acqua).

**Conseguenze**: con la fascia di 1 km, **su una costa dritta le forme
stanno fino a circa 3 km** (la stella fino a 4): la proposta di 1–10 km
del task non regge al mare, e le distanze per la canoa vanno chieste
all'utente (domanda 2 del task). Su un lago stretto, dove tutto è entro
1 km da una riva, si arriva a 5–6 km. I due tratti dalla riva (60–90 m
l'uno) pesano su un percorso corto: un cuore da 1 km si disegna all'88%.
Il motore non conosce le regole del posto (bagnanti, corridoi di lancio,
traffico di barche): l'avviso di sicurezza della parte C deve dirlo.
`activity: "paddling"`, i limiti, la CLI `--activity paddling` e la
validazione di §6 sull'acqua sono la parte A2, dopo la bici (TASK-190,
PR #214), che ha toccato gli stessi file (`models.py`, `validation.py`,
`__main__.py`).
La corsa non cambia: nessun file del motore che già c'era è toccato; ma
`engine_fingerprint` dell'API legge ogni `.py` del motore, quindi dopo il
prossimo aggiornamento del server gli esempi tenuti (ADR-0136) si
ridisegnano alla prima richiesta, uguali a prima.

**Aggiornamento** (2026-10-03, ADR-0161): al mare la forma sta oltre
**200 m** dalla riva, sui laghi resta a 50 m; le distanze sono 1–5 km;
fra i centri buoni si tengono quelli da cui si arriva alla riva col costo
minore, non i più vicini alla partenza chiesta.

## ADR-0157 — La penna alzata: indici dei tratti a piedi in `points`, non pezzi separati
**Stato**: Attiva · 2026-10-02 · deciso dall'agente su delega dell'utente
(TASK-197, motore e API). Il cosa è **scelta dell'utente** («per le
scritte, stoppare il tragitto, camminare fino alla seconda lettera senza
tracciare»), con la pausa automatica e l'avviso a voce nell'app (TASK-198).

**Contesto**: una parola si scrive come una linea chiusa: ogni lettera
andata e ritorno, unita alla successiva da una linea di base, e il ritorno
alla partenza (ADR-0044). Quella base deve passare su una strada: dove non
c'è, il percorso gira e sporca la parola. Con la penna alzata ogni lettera
si disegna da sola e fra due lettere si cammina con la registrazione in
pausa; Strava, in una pausa, traccia una linea dritta dal punto dove ci si
è fermati a quello dove si riparte. Il contratto (`RouteRequest`,
`RouteResult`) lo usa anche l'app già pubblicata: non deve rompersi.

**Decisione**:

1. **La richiesta**: `pen_up`, vero o falso, falso se manca. Solo con
   `word`: con `shape` o in una richiesta d'immagine è `invalid_request`
   (`pen_up is for the letters of a word`). L'immagine ha il campo solo per
   rifiutarlo con questo messaggio invece di «Extra inputs».
2. **La risposta**: `walks`, una lista di coppie `[da, a]` di indici in
   `points`, compresi tutti e due, in ordine; dove finisce un tratto
   comincia la lettera successiva; con n lettere n − 1 coppie. **Indici in
   una linea sola, non pezzi separati**: tutto quello che oggi legge
   `points` (la navigazione e il «fuori percorso» dell'app, le
   indicazioni di svolta calcolate sui nodi del percorso, il GPX, i
   preferiti e le corse salvate, le alternative, il registro e il replay)
   continua a leggere una linea da seguire, e un'app che non conosce
   `walks` la segue tutta, camminando dove non disegna. Pezzi separati
   (una lista di linee) avrebbero voluto un campo nuovo al posto di
   `points` o due copie del percorso, e ogni lettore da cambiare insieme.
3. **Facoltativi in tutti e due i sensi**: l'API manda sempre `walks`
   (vuoto per una forma, un'immagine, una parola senza `pen_up`); in
   `shared-types` è `walks?`, così un'app nuova legge un'API vecchia come
   una linea sola. `pen_up?` nella richiesta (`false` per una forma e
   un'immagine). Le fixture scritte prima restano come sono, e i test le
   leggono come richieste e risposte di un'app e di un'API precedenti
   (come le fixture senza dettagli di ADR-0074).
4. **Il motore** (`pen_up.py`, `ROUTE_ENGINE.md` §2 e §5): ogni lettera
   è il suo `out` una volta, tracciato come linea aperta
   (`snap_to_network(closed=False)`, un parametro nuovo che per difetto
   lascia tutto com'era), con le zone e il corridoio del disegno intero;
   fra due lettere la strada più breve, senza zone né corridoio. Una fase
   sola, l'ingresso della prima lettera, che non si sposta perché tiene la
   partenza; le altre si spostano come prima. Somiglianza e distanza sono
   delle sole lettere; `distance_m` resta la lunghezza di tutti i
   `points`. Il percorso non è chiuso: si controlla solo dove comincia.
5. **Senza `pen_up` niente cambia**: le stesse funzioni con gli stessi
   argomenti, e un test confronta i percorsi di cinque parole (sul grafo
   dei fixture di Levico e su una griglia, anche con le partenze vicine)
   con le impronte di `main` a 59dd8a7, punto per punto.
6. **Il punteggio di una corsa** (`POST /track-scores`) prende i `walks`,
   facoltativi: la corsa si confronta con le sole lettere, e non contano le
   posizioni su un tratto a piedi né sulla linea dritta fra il suo inizio e
   la sua fine (una registrazione in pausa salta lì). **Il GPX del
   percorso** resta una linea sola e aggiunge un waypoint «Pause» e uno
   «Resume» per tratto (`GPX.md`).
7. **I percorsi tenuti** (`route_store.py`, ADR-0136) distinguono la penna
   alzata; la chiave delle altre richieste non cambia.

**Scartate**: pezzi separati al posto di `points` (sopra); un tratto a
piedi anche dalla partenza alla prima lettera (n tratti invece di n − 1:
la partenza è l'ingresso della prima lettera, come la fase 0 di una forma
aperta, TASK-041); tracciare ogni lettera andata e ritorno e tenerne
l'andata con `first_leg` (TASK-041), senza toccare `network.py`: costa il
doppio dei tracciamenti e rende economico ripassare ogni strada già fatta
anche all'andata (ogni lato sarebbe «ripassato»), col rischio di baffi
nelle lettere chiuse come la O;
copiare `snap_to_network` in `pen_up.py` per non cambiarlo (due copie
dello stesso tracciamento da tenere allineate); misurare ripercorrenza e
scale sulle sole lettere (le misure sono di tutto il percorso: anche nei
tratti a piedi si cammina); un `walks` che manca invece che vuoto nelle
risposte (un serializzatore apposta, e nessun vantaggio: le app installate
ignorano un campo in più).

**Conseguenze**: a parità di km le lettere sono più alte (la distanza è
delle lettere: «CIAO» 9,5 altezze invece di 16,2) e i tratti a piedi
aggiungono il 20–30% di strada: a Trento «CIAO» da 15 km fa 15,4 km di
lettere e 19,6 in tutto. L'app lo deve dire (TASK-198). Il percorso di
una parola con la penna alzata **non è chiuso**: chi legge `points`
supponendo che l'ultimo punto sia il primo (l'app pubblicata non lo
chiede mai) va guardato in TASK-198. Ogni cambio di `route_engine` cambia
`engine_fingerprint`, quindi dopo l'aggiornamento del server gli esempi
tenuti si ridisegnano (anche se i percorsi senza `pen_up` restano gli
stessi): server e `draw_examples` con l'ok dell'utente. Provato sulle
strade vere solo dalle zone già in cache (Trento, Levico), non giudicato
a occhio dall'utente.

## ADR-0158 — La penna alzata nelle corse salvate e nei preferiti: una colonna `walks`, e una richiesta rifiutata si rimanda come prima
**Stato**: Attiva · 2026-10-02 · deciso dall'agente su delega dell'utente
(TASK-199). Il cosa (le corse e i preferiti tengono i tratti a piedi) è
nei seguiti di TASK-198, assegnati dal coordinatore su delega
dell'utente; il contratto dei `walks` è ADR-0157, le corse salvate
ADR-0140, i preferiti ADR-0139.

**Contesto**: `PUT /me/activities/{key}` e `PUT /me/favorites/{key}`
rifiutano un campo che non conoscono (`extra="forbid"`): un'API precedente
a TASK-199 risponde `422 invalid_request` a una corsa o a un preferito con
`walks`. Una corsa nella coda del telefono che riceve `422` viene tolta
(ADR-0140: rimandarla non cambierebbe niente), quindi si perderebbe.
Server e app si aggiornano in momenti diversi, e tutti e due solo con
l'ok dell'utente: un server con TASK-197 ma senza TASK-199 dà già i
`walks` ai percorsi, e l'app li rimanderebbe.

**Decisione**:

1. **Una colonna `walks` (`jsonb`, default `[]`)** in `runs` e in
   `favorites`, nella stessa migrazione: indici nei punti della linea, come
   `RouteResult.walks`, non una geometria (la linea resta una, ADR-0157).
   Le righe di prima prendono `[]`. In `runs`, `walks` vuoto quando non c'è
   `route`. Il dettaglio (`GET /me/activities/{key}`, `GET
   /me/favorites/{key}`) ha **sempre** `walks`, vuoto per ogni altra corsa
   o percorso, come `RouteResult` (ADR-0157, punto 3); gli elenchi non
   cambiano.
2. **Nella richiesta `walks` è facoltativo**, controllato come in `POST
   /track-scores` (`walks_problem`): fuori dai punti, all'indietro, che si
   sovrappongono, o senza `points` per una corsa: `422 invalid_request`.
   Con i `walks` il punteggio di una corsa è quello delle sole lettere, lo
   stesso di `POST /track-scores` con gli stessi dati.
3. **`pen` nella pausa**, facoltativo, falso se manca, nel `pauses` già
   `jsonb` di `runs`: si scrive **solo quando è vero**, così le altre pause
   restano byte per byte quelle di prima. Per km e tempo vale come una
   pausa chiesta dal corridore (`auto` falso), come la manda l'app da
   TASK-198. Il dettaglio non ha le pause (non le aveva, e la linea corsa
   resta unita): `pen` sta nella riga, per chi la leggerà (TASK-117).
4. **L'app manda `walks` e `pen` solo per una parola con la penna alzata**,
   e solo i `walks` che stanno nei punti (`walksOf`): una corsa con
   `walks` sbagliati verrebbe rifiutata e persa. Per ogni altra corsa o
   percorso il corpo è quello di prima, campo per campo e nello stesso
   ordine; i test lo confrontano come testo.
5. **Un rifiuto si rimanda una volta come prima**: se l'API risponde `422
   invalid_request` a una corsa con `walks` o `pen`, l'app la rimanda
   subito senza (`withoutPenUp`); lo stesso per un preferito con `walks`.
   Un'API precedente a TASK-199 salva la corsa con il punteggio su tutto il
   percorso e le pause «penna» come pause del corridore, e tiene il
   preferito come una linea sola: com'era prima di TASK-199, invece di
   perdere la corsa o di mostrare «Extra inputs are not permitted» sotto il
   cuore. Senza rete, o con un altro errore, niente si rimanda: resta la
   regola di ADR-0140.
6. **I tipi restano nell'app** (`src/api/activities.ts`,
   `src/api/favorites.ts`), dove TASK-171 e TASK-172 li hanno messi:
   `shared-types` prende le fixture nuove (`activity-request-walks.json`,
   `activity-walks.json`, `favorite-request-walks.json`,
   `favorite-walks.json`) e un controllo nel suo test; quelle di prima
   restano com'erano, come richieste di un'app e risposte di un'API
   precedenti.
7. **Un preferito con i `walks`** si apre come una parola appena
   disegnata con la penna alzata: il risultato ha i `walks`, la richiesta
   `pen_up: true` (l'export GPX la rimanda all'API, che vuole `pen_up`
   solo con una parola: senza parola i `walks` non si leggono).

**Scartate**: una geometria per i tratti a piedi (una seconda linea da
tenere allineata alla prima); scrivere sempre `pen` (cambierebbe le pause
di ogni corsa, e i test di prima); le pause nel dettaglio della corsa
(nessuno le legge: la linea corsa resta unita, scelta dell'utente fuori
da qui); rimandare dopo ogni `422`, anche senza `walks` né `pen` (la
richiesta sarebbe la stessa); chiedere prima all'API che versione è (una
richiesta in più per ogni corsa, e la coda lavora anche quando la rete
torna dopo); spostare i tipi in `shared-types` (file usati da altri task
oggi, e nessun vantaggio per il contratto, che le fixture già tengono).

**Conseguenze**: la migrazione `0006` e i campi nuovi arrivano al
telefono solo dopo l'aggiornamento del server e la pubblicazione
dell'app, tutti e due con l'ok dell'utente. Con un'API precedente a
TASK-199 una corsa su una parola con la penna alzata si salva con un
punteggio più basso di quello visto a fine corsa (la camminata fra le
lettere conta), e un preferito si riapre come una linea sola: tenuto così,
resta così anche dopo l'aggiornamento (la chiave è la stessa, e il
secondo `PUT` non cambia niente). Un `422` di una corsa con i `walks`
costa una richiesta in più.

## ADR-0128 — Il profilo: `PATCH /me` per nome e bio, `GET /users/{public_id}` con un id casuale, mai l'email
**Stato**: Attiva · 2026-10-02 · deciso dall'agente su delega dell'utente
(TASK-116), dentro le scelte di ADR-0114 (gli iscritti vedono ciò che è
pubblicato, il feed non si legge senza account) e ADR-0115 (il database).
Numero tenuto dal coordinatore per TASK-116. La foto è di ADR-0146.

**Contesto**: ogni account ha un nome dall'iscrizione (ADR-0120) e, da
TASK-178, una foto che vede solo lui. Il profilo aggiunge la bio, il modo
di cambiare nome e bio, e una pagina che gli altri iscritti possono
leggere. Restava da dire con che id si chiede un profilo, chi lo può
leggere, cosa ci si legge e cosa vuol dire «numero di disegni» quando
pubblicare una corsa ancora non si può (TASK-117).

**Decisione**:
1. **`PATCH /me`** con solo quello che cambia (`username`, `bio`; assente
   o `null` resta com'è), risposta il `User` di adesso. Un endpoint solo
   per i due campi, come `GET /me` legge l'account: niente `/me/profile`.
   I valori rifiutati sono `422 invalid_request` con un messaggio scritto
   per le persone (non quello di Pydantic), che l'app mostra così com'è;
   il nome di un altro è `409 username_taken`, il codice dell'iscrizione.
   Con un errore non cambia niente.
2. **Il nome segue la regola dell'iscrizione** di ADR-0120: da 3 a 20 fra
   lettere, cifre, `_` **e `.`**, unico senza badare alle maiuscole. Il
   task file diceva «lettere, cifre e `_`», scritto prima di ADR-0120:
   due regole per lo stesso campo farebbero rifiutare in «Edit profile» un
   nome che l'iscrizione accetta, e un account con il punto non potrebbe
   rimetterlo. Il proprio nome con altre maiuscole si può.
3. **La bio**: al più 160 caratteri contati come li conta PostgreSQL (un
   carattere, non un byte né un'unità UTF-16: un'emoji è uno; l'app conta
   allo stesso modo), senza spazi in testa e in coda, a capo come `\n`,
   nessun carattere di controllo (un NUL farebbe fallire PostgreSQL). `""`
   la toglie. Una colonna di `users`, come diceva `DATABASE.md`: è corta e
   la legge ogni `GET /me`.
4. **`{id}` è `public_id`**, un UUID casuale (`gen_random_uuid()`) dato a
   ogni account dalla migrazione `0007`, anche a quelli di prima. Non
   `users.id`, che è in sequenza: direbbe quanti account ci sono e farebbe
   leggere tutti i profili uno dopo l'altro. Non il nome: cambia con
   `PATCH /me`, e un profilo aperto dal feed o da un commento salvato
   (TASK-118, 120) deve restare lo stesso. `User` porta `public_id` al
   proprietario, per i link che verranno; un id che non è un UUID è `404`,
   come uno sconosciuto.
5. **Il profilo lo legge solo un iscritto** (il token, come il feed,
   ADR-0114 punto 4), anche il proprio. Ha `public_id`, `username`, `bio`,
   `photo` (il JPEG in base64, come `GET /me/photo`: pochi KB, nessuna
   richiesta in più) e `drawings`. **Mai** email, `role`, `id` o data
   d'iscrizione: la risposta è un modello suo, non `User` con dei campi
   tolti, e un test cerca l'email in tutto il testo della risposta.
6. **«Numero di disegni» sono i disegni pubblicati**: le corse salvate sono
   private (ADR-0114, punto 4), e anche il loro numero dice qualcosa di
   chi corre. Pubblicare è di TASK-117: fino ad allora `drawings` è 0 per
   tutti, e TASK-117 cambia una riga di `profiles.py`. Se l'utente vuole
   contare anche le corse private, è una scelta sua (task file, «Esito»).
7. **Chi non ha un nome** non c'è: il nome è obbligatorio all'iscrizione
   dalla `0001` (`NOT NULL`), e `PATCH /me` non lo toglie. Chi non ha bio
   mostra solo nome e foto (o l'iniziale); chi non ha foto, l'iniziale.
8. **Nell'app** (`src/profile/`): «Edit profile» è un pulsante sotto il
   nome in «Profile» e una pagina di «Profile» (`EditProfile.tsx`, «←»
   torna senza salvare), non una riga di «Settings»: è la cosa che si
   cambia guardando il proprio profilo. Nome e bio cambiati diventano la
   sessione (`useAccount.editProfile`, che la tiene nel portachiavi come un
   ingresso): «Profile», «Settings» e il pulsante in alto li mostrano
   subito. La pagina del profilo di un altro (`UserProfilePage.tsx`) usa la
   stessa testa (`ProfileHeader.tsx`) e **non ha ancora una strada per
   arrivarci**: da dove si apre lo decide l'utente.
9. **Con un server di prima**: `User` senza `bio` né `public_id` si legge
   (campi facoltativi nei tipi dell'app), `PATCH /me` risponde `405
   http_error` e la pagina dice «Editing the profile is not available on
   this API yet.». L'app pubblicata, con il server nuovo, ignora i campi in
   più di `User` (`isUser` non li guarda).

**Scartate**: `users.id` come `{id}` (sopra); il nome come `{id}` (cambia,
e i link si romperebbero); un id corto fatto in Python (servirebbe un
generatore nella migrazione per gli account di prima, e `random()` di
PostgreSQL non è fatto per questo); il profilo aperto senza account (il
feed non lo è, ADR-0114); la foto a un indirizzo suo (`GET
/users/{id}/photo`: una richiesta in più per una pagina sola; per il feed,
con molti profili insieme, TASK-118 potrà aggiungerlo); contare le corse
private (sopra); un codice d'errore nuovo per il profilo che non c'è
(`404 http_error` è quello di un preferito o di una corsa che non c'è);
un limite ai `PATCH` al minuto (un `UPDATE` di una riga costa quanto un
`GET /me`, che non ha limiti); la regola del nome senza il punto (sopra).

**Conseguenze**: la migrazione `0007` riscrive `users` una volta (il
default casuale si calcola riga per riga): con gli account di oggi è un
attimo. Il server la prende solo con il suo aggiornamento, e «Edit
profile» si vede sul telefono solo dopo la pubblicazione dell'app, tutti e
due con l'ok dell'utente; finché il server non è aggiornato, «Save» dice
che l'API non ha i profili. TASK-117 conta i disegni pubblicati; TASK-118
e seguenti aprono il profilo di un altro con `public_id`.

## ADR-0159 — Pubblicare una corsa salvata: una tabella `drawings`, 200 m tagliati lungo la traccia, mai il percorso pianificato agli altri
**Stato**: Attiva · 2026-10-03 · deciso dall'agente su delega dell'utente
(TASK-117, parte A), dentro le scelte di ADR-0114 (corse private finché
non pubblicate; pubblicate le vedono gli iscritti, senza i primi e gli
ultimi 200 m). Due **scelte dell'utente** del 2026-10-03: il punteggio lo
vedono tutti; una corsa senza percorso si pubblica anche lei, senza
punteggio. Numero tenuto dal coordinatore.

**Contesto**: il task file di TASK-117 era scritto prima di TASK-172:
voleva `POST /drawings` per salvare un disegno a fine corsa. Salvare una
corsa c'è già («My activities», ADR-0140), con km, tempo e punteggio
contati dall'API. Restava pubblicarla: un titolo, «Public», cosa ne vedono
gli altri, come la si apre. L'app della fine corsa (`RunEnd.tsx`) e la
scheda della corsa sono di TASK-187 e TASK-200, in lavorazione: l'utente ha
scelto due PR, l'API adesso e l'app dopo.

**Decisione**:
1. **Una tabella `drawings`**, una riga per corsa titolata o pubblicata,
   con `run_id` unico e `ON DELETE CASCADE`: cancellare la corsa o
   l'account cancella il disegno, senza codice. Non colonne nuove in
   `runs`: `activities.py` resta com'è (è di TASK-200), e una corsa mai
   toccata non ha niente da dire agli altri.
2. **Un id suo, casuale** (`uuid`), con cui gli altri aprono il disegno
   (`GET /drawings/{id}`): la chiave della corsa è del telefono, unica solo
   dentro un account, e un numero in sequenza direbbe quante sono. L'id non
   cambia togliendo e rimettendo «Public»: un link resta buono.
3. **`PUT /me/activities/{key}/drawing` con la scelta intera** (`title` e
   `public`), non un `PATCH`: rimandato dopo un telefono senza rete non
   cambia niente la seconda volta, come il `PUT` della corsa. Accanto,
   `GET` dello stesso indirizzo e `GET /me/drawings` per sapere quali
   corse sono pubbliche, come `GET /me/activities/{key}/strava` di
   ADR-0156: gli endpoint di «My activities» non cambiano.
4. **Il taglio**: 200 m lungo la traccia pulita, da ognuna delle due
   estremità, con il punto del taglio interpolato in metri sul piano del
   segmento (`route_engine.geo`). Lungo la traccia, non in linea d'aria,
   perché così l'ha scelto l'utente (ADR-0114: «i primi e gli ultimi
   200 m»). Un cerchio di 200 m attorno a partenza e arrivo toglierebbe
   di più a chi gira attorno all'isolato prima di partire, ma bucherebbe a
   metà le forme che ripassano vicino alla partenza: da riproporre
   all'utente se serve. La linea tagliata si calcola nell'API a ogni `PUT`
   e si tiene in `drawings.track`, senza orari: la stessa corsa dà la
   stessa linea, e chi legge non ricalcola niente. Con meno di un metro
   rimasto la corsa non si pubblica (`422`, con il motivo in parole).
5. **Agli altri mai il percorso pianificato**, né orari, pause, `walks` o
   la chiave: il percorso parte dalla porta di chi corre, e tagliato
   direbbe lo stesso dove comincia il giro. Arrivano la traccia tagliata,
   il paese (già arrotondato, ADR-0140), forma o parola, km, tempo,
   punteggio, la data. Rifare la stessa forma partendo da un disegno di
   un altro è un'altra cosa (TASK-118 o dopo).
6. **Il punteggio è quello della corsa**, contato dall'API al salvataggio:
   il disegno non accetta numeri dall'app (`422` per un campo in più). Lo
   vedono tutti (scelta dell'utente). Una corsa senza percorso si pubblica
   con `score` `null` (scelta dell'utente): un disegno a mano libera.
7. **Il proprietario vede il suo disegno come lo vedono gli altri** da
   `GET /drawings/{id}`, anche privato (`public` falso); la corsa intera
   resta in `GET /me/activities/{key}`. Uno privato, per chiunque altro, è
   `404` come un id che non c'è.
8. **Il profilo conta i disegni pubblici** (`PublicProfile.drawings`) ed
   elenca solo quelli, a pagine, dalla corsa più recente, anche a chi lo
   guarda dal proprio account. Il cursore porta l'id casuale del disegno,
   non quello della riga.

**Aggiornamento (TASK-208, 2026-10-03)**: `public` è diventato
`visibility`, con «Followers» in mezzo (ADR-0170). I punti 3, 7 e 8
restano, con «pubblico» letto come «che qualcun altro vede»: il profilo
conta ed elenca quelli che chi guarda può vedere.

## ADR-0160 — L'attività nei preferiti e le pause nel dettaglio di una corsa: una colonna con le attività dell'API, un rimando solo come prima
**Stato**: Attiva · 2026-10-02 · deciso dall'agente su delega dell'utente
(TASK-200). Il cosa (un preferito ricorda l'attività, il dettaglio di una
corsa ha le pause) è nei seguiti di TASK-190 parte C e TASK-199, assegnati
dal coordinatore su delega dell'utente; le aggiunte al contratto seguono
ADR-0157 e ADR-0158, i preferiti ADR-0139, le corse ADR-0140, la bici
ADR-0153. Numero tenuto dal coordinatore per TASK-200.

**Contesto**: `favorites` non sapeva l'attività: un percorso in bici,
riaperto, si esportava come una corsa. Il dettaglio di una corsa non aveva
le pause, che la riga tiene, `pen` compreso, da TASK-199 (ADR-0158 le
lasciava fuori perché nessuno le leggeva). `PUT /me/favorites/{key}`
rifiuta un campo che non conosce, e server e app si aggiornano in momenti
diversi.

**Decisione**:

1. **Una colonna `activity`** in `favorites` (migrazione `0008`), `text
   NOT NULL DEFAULT 'running'`, con il vincolo `activity IN ('running',
   'cycling')`: le attività dell'API (`SUPPORTED_ACTIVITIES`), come
   `style` elenca i suoi valori. Un'attività nuova vuole una migrazione che
   allarghi il vincolo; un test tiene un preferito per ogni attività
   dell'API, così l'API non può offrirne una che il database rifiuta
   (sarebbe un 500). I preferiti di prima diventano `running`.
2. **Nella richiesta è facoltativa** (`running` se manca), controllata con
   `check_supported`, le parole di `POST /routes`; l'elenco e il dettaglio
   la hanno **sempre**. La chiave resta quella della linea (ADR-0139): la
   stessa linea è un preferito solo, con l'attività della prima volta.
3. **L'app la manda solo quando non è `running`**, ultima dopo `walks`: la
   richiesta di una corsa resta quella di prima, campo per campo. La
   prende dalla richiesta del percorso disegnato; quelli di «Explore» e a
   tema non la mandano. Un preferito riaperto la mette nella sua richiesta
   (quella che «Export GPX» manda), qualunque sport dica «Settings».
4. **Un rifiuto si rimanda una volta sola, come un'app precedente a
   TASK-199**: se `PUT` torna `422 invalid_request` a un preferito con
   `walks` o `activity`, l'app lo rimanda subito senza tutti e due
   (`asBefore`), la richiesta che ogni API da TASK-171 accetta. Un'API con
   TASK-199 e senza TASK-200 perde così i `walks` di una parola con la
   penna alzata tenuta in bici: un caso che non c'è (il server prenderà
   TASK-199 e TASK-200 insieme), contro un secondo rimando in più.
5. **L'app legge un'attività che manca, o che non conosce, come `running`**
   (`favoriteActivity`): l'elenco accetta qualunque stringa, come fa con
   `style`, perché un preferito di un'attività arrivata dopo (la canoa)
   non deve far sparire l'elenco a un'app più vecchia; quel preferito si
   esporta come una corsa, come prima di TASK-200.
6. **`pauses` nel dettaglio di una corsa**, sempre (`[]` se non ce ne
   sono), così come la colonna le tiene: `from_s`, `to_s`, `auto`, e
   `pen` solo quando è vero; in secondi dal primo punto di `track`, solo
   quello che di ogni pausa sta dentro la corsa, nell'ordine mandato, le
   sovrapposte come sono. L'elenco non le legge (una colonna in meno per
   20 righe). Nella risposta sono un `TypedDict` con `pen` non
   obbligatorio: così `pen: false` non compare, su ogni Pydantic 2 e su
   Python 3.11 (da `typing_extensions`, che Pydantic ha già). L'app le
   accetta solo ben fatte, e non le mostra: spezzare la linea corsa sulle
   pause è una scelta dell'utente. Questo toglie una delle «Scartate» di
   ADR-0158, che le lasciava fuori perché nessuno le leggeva.

**Scartate**: un'attività senza vincolo nel database (un errore di
battitura dell'API resterebbe scritto); un formato (`^[a-z]+$`) invece
dell'elenco (non dice quali sono); rimandare due volte, prima senza
`activity` e poi senza `walks` (due richieste per un caso che non c'è);
leggere dagli errori di Pydantic quale campo l'API non conosce (testi che
cambiano con le versioni); un'attività sconosciuta come risposta sbagliata
(tutto l'elenco non si aprirebbe); `exclude_if` di Pydantic per `pen`
(una funzione recente, mentre FastAPI chiede soltanto Pydantic 2.9); un `model_serializer` (lo
schema OpenAPI della pausa resterebbe vuoto).

**Conseguenze**: la migrazione `0008` e i campi nuovi arrivano al telefono
solo dopo l'aggiornamento del server e la pubblicazione dell'app, tutti e
due con l'ok dell'utente. Un preferito in bici tenuto con un'API
precedente a TASK-200 è una corsa, e resta tale (si toglie e si rimette).
Le indicazioni di «Start» e il punteggio non hanno l'attività: `POST
/route-directions` prende solo i punti e cerca sulla rete a piedi, `POST
/track-scores` confronta due linee; dare l'attività a `/route-directions`
è un'aggiunta al suo contratto, da decidere con cosa fa «Start» in bici
(TASK-190, parte C, seguito 2).

## ADR-0162 — Ciò che il motore tiene per grafo vale finché NetworkX non cambia il grafo
**Stato**: Attiva · 2026-10-03 · deciso dall'agente su delega dell'utente
(TASK-203; proposte A1 e A2 approvate dal coordinatore)

Il piano della partenza costa 4,5–7,5 s sulle richieste lunghe di Trento
(TASK-203). Fra l'11 e il 30% era il controllo delle cache del corridoio:
ADR-0059 le rifaceva «se cambia il numero di archi», e `number_of_edges()`
di NetworkX su un `MultiDiGraph` conta gli archi nodo per nodo (7–12 ms),
due volte per tracciamento, fino a 40 tracciamenti per richiesta e
altrettanti in ogni partenza vicina. In più `nearest_nodes` e
`_route_through_zones` rifacevano a ogni chiamata la lista delle coordinate
di tutti i nodi (quasi un milione di letture per un cuore da 10 km).

**Decisione**:
- I dati tenuti per grafo (campioni degli archi, punti distinti, passi
  u→v, e ora id e coordinate dei nodi, `_node_table`) valgono finché il
  grafo ha lo stesso **segno** in `graph.__networkx_cache__`. NetworkX
  (dalla 3.3, che `ZoneCrop` già richiede) svuota quel dizionario a ogni
  nodo o arco aggiunto o tolto: un segno sparito vuol dire grafo cambiato.
  Niente più conteggio degli archi. Sostituisce il «rifatta se cambia il
  numero di archi» di ADR-0059; il resto di ADR-0059 resta.
- Il nodo pozzo di `_route_through_zones` entra e esce a ogni zona: tolto,
  il grafo è quello di prima nodo per nodo e arco per arco, nello stesso
  ordine, e il segno gli si ridà (`_same_graph`).
- Una vista di un altro grafo (`subgraph`) cambia con lui senza che
  NetworkX lo dica: per una vista non si tiene niente.
- `nearest_nodes` e `_route_through_zones` prendono id e coordinate dei
  nodi dalla tabella del grafo: gli stessi numeri, nello stesso ordine.

**Perché così**: gli stessi percorsi punto per punto, e lo dicono tre
prove: 7 casi fissati in `test_kept_per_graph.py` sul codice di prima
(griglia, una città finta con parchi e un fiume, la fixture di Levico; con
partenze vicine, alternative e ricerca lontana), i 5 casi di Trento di
TASK-203 e le richieste del registro rifatte prima e dopo. Sul Mac tolgono
1,1–1,6 s alle richieste lunghe di Trento (14–36%) e il 15–43% della CPU di
una richiesta, contando le partenze vicine. Il
segno vede anche ciò che il conteggio non vedeva: un arco tolto e uno
aggiunto lasciano lo stesso numero di archi.

**Scartato**: passare i dati dalla ricerca ai tracciamenti (cambia la firma
di `snap_to_network` e tocca `pen_up.py`, i cui tracciamenti delle lettere
sono quelli che guadagnano di più); tenere i dati per grafo senza nessun
controllo (un grafo cambiato, in un test o in una richiesta futura, li
troverebbe vecchi); controllare solo il numero dei nodi (non vede gli
archi).

**Conseguenze**: una modifica fatta sul posto agli attributi di un arco non
si vede, come prima. Con una NetworkX che non svuota `__networkx_cache__`
(prima della 3.3) i dati resterebbero vecchi: lo dice
`test_a_change_to_the_graph_is_seen`, e `ZoneCrop` già non funzionerebbe.
Il grafo mandato alle partenze vicine (`OneGraph`) porta con sé il segno,
pochi byte, che nel processo nuovo non corrisponde a niente: lì i dati si
calcolano da capo, come prima. Cambia l'impronta del motore
(`engine_fingerprint`): i percorsi tenuti si buttano e dopo l'aggiornamento
del server va rilanciato `draw_examples` (`AGENTI.md`, regola 11).

## ADR-0161 — La canoa nel motore: 1–5 km, 200 m dalla riva al mare, solo forme del catalogo, la validazione sull'acqua
**Stato**: Attiva · 2026-10-03 · **scelta dell'utente** per le distanze
(1–5 km) e per quanto stare lontani dalla riva (200 m al mare, 50 m sui
laghi); il resto deciso dall'agente su delega dell'utente (TASK-191,
parte A2). Aggiorna ADR-0154.

**Contesto**: A1 (ADR-0154) ha messo nel motore l'acqua, la fascia entro
1 km dalla riva e la ricerca di dove la forma ci sta, ma solo da `python
-m route_engine.water`. A2 collega la canoa a una richiesta: l'attività,
le distanze, la CLI, la validazione. L'utente ha guardato i nove campioni
di A1 (Riccione, Jesolo, Riva del Garda): «buoni, ma troppo vicini alla
riva» (la forma passava a 60–80 m dalla spiaggia).

**Decisione**:

1. **Le distanze** (scelta dell'utente): `DISTANCE_LIMITS_M["paddling"] =
   (1000, 5000)`, un limite solo come per corsa e bici. Al mare una forma
   sta fino a circa 3 km: oltre, `WaterFitError` dice a quanti km ci sta
   (`best_distance_m`, come TASK-031), e l'app lo può proporre.
2. **Dalla riva** (scelta dell'utente): al mare la forma sta oltre
   **200 m** dalla riva, fuori dalla fascia dei bagnanti di molte
   ordinanze (`water.SEA_SHORE_MARGIN_M`): dalla fascia si toglie il mare
   entro 200 m dalla terraferma e dalle isole di almeno 1 ha. Sui laghi, e
   attorno a scogli e frangiflutti, restano 50 m e 30 m. Solo i tratti
   dalla riva attraversano i 200 m.
3. **Fra i centri buoni, quelli da cui si arriva alla riva**
   (`water_fit._join_costs`, `_promising`): A1 teneva, per ogni scala e
   angolo, i tre centri il cui contorno passava più vicino alla partenza
   chiesta. Con tratti di almeno 200 m questo non regge: dietro il
   frangiflutti della fixture i tre centri più vicini erano a più di 300 m
   da ogni riva raggiungibile, e un cuore da 2 km «ci stava a 2,2 km»
   mentre accanto, davanti alla spiaggia, ci stava a 2 km. Ora ogni cella
   della fascia ha il costo di unirla alla riva (i due tratti fino al
   punto della riva raggiungibile più vicino, entro 2 km dalla partenza,
   più lo spostamento fino a lì, con i pesi del costo), e si tengono i tre
   centri il cui contorno passa dove costa meno; a parità, i più vicini
   alla partenza.
4. **Le scale, con i loro tratti**: nessun tratto è più corto della via
   dal punto della riva raggiungibile più vicino alla fascia (al mare
   circa 200 m). Le scale per cui forma e tratti sono già oltre il +10%
   si saltano, e la ricerca si ferma quando |scala + tratti − 1| + 2 ·
   tratti (il costo minimo di qualunque forma più piccola) non batte il
   migliore trovato. Senza, al mare la ricerca scendeva 15 scale invece di
   5: un cuore da 2 km sulla costa della fixture 5,7 s, ora 0,4 s; i test
   dell'acqua girano in 5,2 s come in `main`.
5. **`paddling` è un'attività del motore, non ancora del contratto**:
   entra in `ACTIVITIES` con `DISTANCE_LIMITS_M`, ed è in
   `WATER_ACTIVITIES` (`models.py`), le attività senza rete: non è in
   `network.NETWORKS` e non ci deve essere. `SUPPORTED_ACTIVITIES` e
   `shared-types` la prendono con la parte B, come per la bici
   (ADR-0153): fino ad allora l'API la rifiuta come prima.
6. **Sull'acqua solo forme del catalogo**: una parola, un'immagine o un
   contorno da file sono `InvalidRequestError` («on the water only a
   shape of the catalogue is drawn, not a word»), da
   `models.check_drawn_on_land`: nella `RouteRequest` per una parola
   (prima della distanza per lettera, che direbbe altro), nella CLI per
   immagine e contorno prima di tracciare l'immagine; l'API la usa per le
   immagini nella parte B (`ON_WATER_SHAPES_ONLY`). Una parola vuole 3 km
   a lettera (`LETTER_DISTANCE_M`): in 5 km ci sta una lettera. Il
   contorno di un'immagine ci starebbe (`water_fit` prende qualunque linea
   chiusa), ma è una cosa che l'utente vede: si apre dopo, se la chiede.
7. **La validazione sull'acqua** (`validation.check_on_water`, da
   `water_fit.measure`): chiuso; nessun metro sulla terra oltre mezzo
   metro dentro (`ON_LAND_M`: il tratto parte dal bordo dell'acqua);
   nessun punto oltre 1000 m dalla riva; la distanza entro ±10%. Non sono
   warning: un percorso che non li rispetta è un errore del motore
   (`InvalidRouteError`), come un percorso aperto sulle strade. Niente
   scale, strade principali, sterrati e ripercorrenza.
8. **Il piano di una richiesta** (`route_engine/paddling.py`, nuovo):
   `plan_paddling(request, source)` disegna la forma con 128 punti (il
   contorno è il percorso: il doppio di una forma sulle strade, come i
   campioni), la piazza con `plan_on_water`, la controlla e dà
   `WaterPlan`: il `RouteResult` (somiglianza 1, nessun warning, nessuna
   indicazione di svolta: le dà l'API dal grafo, che sull'acqua non c'è,
   parte B), il `WaterRoute` e l'acqua. La usano la CLI e, nella parte B,
   l'API.
9. **La CLI**: con `--activity paddling` il piano è `plan_paddling` con
   `OverpassWaterSource(<cache-dir>)`, deciso prima di qualunque grafo
   delle strade; stampa scala, rotazione, partenza sulla riva e il suo
   tipo, tratto, distanza, quanto la forma sta lontana dalla terra e il
   punto più lontano dalla riva. `--score-track` vale (servono solo i
   punti); `--nearby` e `--no-optimize` sono delle strade e si rifiutano;
   `--reuse-penalty` sull'acqua non conta.
10. **Le fixture**: la coastline della costa prosegue dritta fino a ±9 km,
    così taglia anche l'area di una richiesta (circa 8 km di lato per un
    cuore da 2 km); `build_area` la taglia al riquadro chiesto, e i test
    di A1 vedono la stessa costa. I test della CLI mettono l'acqua delle
    fixture in una cartella di cache, col nome dell'area della richiesta,
    come la lascerebbe un download; un download nei test è un errore.

**Misurato sulle fixture** (dati veri non scaricabili oggi: la cartella
di A1 con le risposte dell'API di OSM non c'è più): sulla costa la forma
sta a 208–223 m dalla terra, con tratti di 209–223 m per lato; a 1 km la
forma è il 58% del giro, a 2 km il 79%, a 3 km l'85%; il cuore ci sta fino
a 3,0 km, il cerchio a 2,8, la stella a 3,4. Sul lago, come in A1: tratti
di 59–96 m, 1–5 km tutti disegnati, scala 0,88–0,97. Ogni piano al più un
secondo.

**Alternative scartate**: un limite per il mare e uno per i laghi (1–3 e
1–5 km: il limite dipenderebbe dall'acqua, che si conosce solo dopo
averla letta, e l'app non saprebbe cosa proporre prima); 1–3 km ovunque
(offerte all'utente, che ha scelto 1–5); 200 m anche sui laghi, o 100 m
ovunque (offerte all'utente); 200 m anche dagli scogli (non c'è una
spiaggia di bagnanti attorno a uno scoglio); tratti più lunghi (300 →
450 m) invece di scegliere i centri dalla riva (accanto al frangiflutti
avrebbe preso tratti di 380 m invece di 215); parole e immagini
sull'acqua adesso; una rete della canoa in `NETWORKS`; i controlli
sull'acqua come warning.

**Conseguenze**: la richiesta `running` non cambia (nessun modulo delle
strade è toccato; `models.py` aggiunge la canoa e rifiuta solo le parole
sull'acqua). I campioni v1 del mare (Riccione, Jesolo) non sono più quello
che il motore disegna, e quelli di Garda vengono da una scelta dei centri
diversa: si rifanno tutti, con Como, quando Overpass risponde o dal
server con l'ok dell'utente (punto 5 di A2). `engine_fingerprint` cambia:
dopo il prossimo aggiornamento del server gli esempi tenuti si
ridisegnano (`draw_examples`). Per la parte B: `SUPPORTED_ACTIVITIES`,
`shared-types`, l'API che chiama `plan_paddling` con la cache dell'acqua
del server e manda `NoWaterError` e `WaterFitError` come
`shape_not_drawable` con la distanza suggerita, e le immagini rifiutate
con `check_drawn_on_land`. Le regole del posto restano fuori: i 200 m
non dicono che un percorso è permesso, e i tratti attraversano la fascia
dei bagnanti (l'avviso di sicurezza della parte C).

## ADR-0163 — La grafica della corsa in corso: il numero prima del nome, pulsanti tondi con icone disegnate, barre grigie per i km
**Stato**: Attiva · 2026-10-03 · deciso dall'agente su delega dell'utente
(TASK-204). La richiesta è dell'utente («Migliora la parte grafica di
quando registri una corsa»); il modo, qui sotto, è dell'agente. Numero
preso come primo libero dopo ADR-0162, con TASK-204 dato dal coordinatore.

**Contesto**: la schermata di TASK-169 (ADR-0137) aveva tutto quello che
serve, ma sotto la mappa tre riquadri uguali, con il nome sopra il numero:
la distanza, il numero che si cerca, pesava quanto il tempo. «Pocket» e
«Music» erano pillole di testo accanto a un «Pause» tondo; «Paused» una
riga grigia; gli interruttori due scatole con «On» e «Off»; i km di «Data»
una tabella senza niente da vedere. L'app non ha librerie di icone né di
grafica (niente SVG), e una dipendenza nuova va chiesta.

**Decisione**:

1. **Il numero prima del nome**: valore grande, unità piccola accanto, nome
   sotto in maiuscolo spaziato (lo stile delle etichette di sezione
   dell'app, `fontSize.label`). Su «Map» niente riquadri: la distanza più
   grande (`fontSize.display`) e con più larghezza, poi passo e tempo
   (`fontSize.title`), separati da righe sottili.
2. **Tutti i pulsanti della corsa tondi, con il nome sotto**: «Pocket» e
   «Music» di 56 punti (`MIN_TAP_SIZE + space.md`, come «Map» e «Data»),
   centrati sull'altezza di «Pause» (72) così cerchi e nomi stanno in riga.
   Le icone sono `View` (un telefono) e il carattere «♪»: come già la
   pausa, il «play» e lo «stop».
3. **Le barre dei km** vanno dal più lento (0,35 della larghezza) al più
   veloce (intera), non in proporzione al passo: fra un km a 5:00 e uno a
   5:20 la proporzione darebbe barre quasi uguali. Grigie (`borderStrong`)
   e la più veloce chiara (`text`): **non gialle**, il giallo è del percorso
   (ADR-0046).
4. **Gli interruttori disegnati**: la pista chiara col pallino a destra
   acceso, scura col pallino grigio a sinistra spento; la riga resta tutta
   da toccare, come prima.
5. **Il conto alla rovescia** si anima con `Animated` di React Native
   (driver nativo): il numero entra rimpicciolendo, un anello giallo si
   allarga e svanisce. Il giallo resta quello dell'azione che il conto
   annuncia (ADR-0137).
6. Nessun colore nuovo, nessun token nuovo: tutto da `tokens.ts`.

**Perché così**: è il modo delle app di corsa che l'utente ha preso a
riferimento (Nike Run Club, TASK-169): il numero si legge per primo,
correndo, e il nome serve una volta sola. Pulsanti tutti tondi e con il
nome sono un solo linguaggio fra corsa e pausa. Nessuna dipendenza: le
forme da disegnare sono poche e semplici.

**Scartato**: una libreria di icone (`@expo/vector-icons`, dipendenza
nuova per due icone); `Switch` di React Native (nativo, colori e forma
diversi fra iOS e Android, fuori dai token); colorare i km più veloci o
più lenti di verde e rosso (colori nuovi con un significato nuovo);
abbassare «Map» e «Data», che l'utente ha voluto alti (TASK-186);
cambiare la linea della corsa sulla mappa o l'attribuzione (sono della
mappa, comune a ogni schermata).

**Conseguenze**: anche il riquadro di fine corsa senza percorso
(`FreeFinishCard`, che usa `RunGrid`) prende il nome sotto il numero. I
test che cercano i numeri per etichetta d'accessibilità non cambiano:
«Distance: 2.30 km» è lo stesso. Il carattere «♪» viene dal font del
telefono: su un Android senza quel segno si vedrebbe un quadratino, da
guardare quando l'app avrà una build Android.

## ADR-0164 — La canoa nell'API: l'acqua nella cache del server, nessuna indicazione né alternativa, la distanza suggerita per difetto al mezzo km
**Stato**: Attiva · 2026-10-03 · deciso dall'agente su delega dell'utente
(TASK-191, parte B: l'API). Le distanze, 1–5 km, e «l'errore dice a
quanti km la forma ci sta» sono **scelte dell'utente** (ADR-0161).

**Contesto**: A2 (ADR-0161) ha messo la canoa nel motore
(`paddling.plan_paddling`), ma non nel contratto: l'API la rifiutava come
un'attività qualunque. La bici, nella sua parte B (ADR-0153), ha dato a
ogni attività le zone della sua rete (`activity_graphs.py`); la canoa non
ha una rete, ha l'acqua (`water.OverpassWaterSource`), e il suo piano non
passa dal grafo: niente partenze vicine, niente alternative, niente
indicazioni.

**Decisione**:

1. **Il contratto, solo aggiunte**: `SUPPORTED_ACTIVITIES = ("running",
   "cycling", "paddling")` nel motore, `ACTIVITIES` e
   `DISTANCE_LIMITS_M.paddling = [1000, 5000]` in `shared-types`,
   `contract.json`, la fixture `route-request-paddling.json` letta dai
   test dei due lati. L'app ha un `Record<Activity, …>` dei suoi limiti
   (`distance.ts`) che vuole la riga della canoa per compilare, e due test
   che usavano `"paddling"` come esempio di attività sconosciuta (ora
   `"swimming"`): tre righe, col permesso del coordinatore; l'app non
   cambia comportamento, perché «Paddle» resta «Soon» (parte C).
2. **L'acqua dell'API**: `ActivityGraphs` tiene, accanto alle zone delle
   attività sulle strade (`ROAD_ACTIVITIES`), l'acqua
   (`paddling.ServerWater`: `OverpassWaterSource` su `<cache>/water/`,
   cioè `--cache-dir` come le zone, sul server `data/cache/water/`).
   `ground_for` dà a una richiesta le zone della sua rete o l'acqua; il
   planner dell'API (`plan_request`) sceglie dall'attività e chiama
   `plan_paddling`. Così `/routes`, `/route-jobs` e il replay dicono la
   stessa cosa, e i test che sostituiscono il planner restano come sono.
3. **Il download dell'acqua** è uno alla volta (un lucchetto, e la cache
   ricontrollata dopo), e uno non riuscito è `503 map_data_unavailable`,
   come una zona. Il job lo mostra come `downloading_map`, e uno annullato
   nel frattempo si ferma prima di piazzare la forma (`_ReportingWater`,
   come `_Reporting` per i grafi). Nessuna zona da preparare:
   `prefetch_zones --activity` è solo per corsa e bici.
4. **Il risultato** è il `RouteResult` del motore: somiglianza 1,
   `directions` vuoto (si leggono sul grafo, e sull'acqua non c'è),
   `alternatives` vuoto (il motore piazza la forma una volta), nessun
   avviso. Il GPX è quello di ogni percorso.
5. **La distanza suggerita, per difetto al mezzo km**
   (`errors.WATER_STEP_M`): `WaterFitError` porta la distanza a cui la
   forma ci sta (`best_distance_m`), e `suggested_distance_m` è quella
   arrotondata **per difetto** al mezzo km, fra 1 e 5 km, `null` se ci sta
   solo sotto 1 km. Sull'acqua una forma ci sta fino a una certa grandezza
   e non oltre: al km più vicino «ci sta a 2,6 km» diventerebbe 3 km, la
   cui tolleranza (±10%, 2,7–3,3 km) non arriva a 2,6, e la distanza
   suggerita, chiesta, fallirebbe di nuovo. Il mezzo km perché la canoa va
   da 1 a 5 km e il campo dell'app prende un decimale. Corsa e bici restano
   al km più vicino (ADR-0041, ADR-0153). Sulle fixture: cuore da 5 km al
   mare, «ci sta a 3,1 km» → 3000, chiesto → disegnato; cerchio da 4 km,
   «2,8» → 2500, chiesto → disegnato (test).
6. **Parole e immagini** (ADR-0161): la parola la rifiuta già
   `RouteRequest`; l'immagine `ImageRequest`, prima della distanza («on the
   water only a shape of the catalogue is drawn, not an image»), da
   `/image-route-jobs` e da `/gpx`.
7. **`/route-directions` resta senza attività**: la richiesta ha solo i
   punti, e un campo in più l'API di prima lo rifiuterebbe (`extra:
   forbid`). Con i punti di un percorso sull'acqua l'API carica la zona a
   piedi attorno alla linea e risponde `422 invalid_request` («The route
   does not follow the roads of this map.», test). L'app non le deve
   chiedere: il percorso di un job sull'acqua ha già `directions` vuoto.
8. **I preferiti**: la migrazione `0010_favorite_paddling.sql` allarga il
   vincolo della `0008`, come diceva il suo commento.
9. **Esempi**: gli esempi tenuti (`route_store`) hanno già l'attività
   nella chiave. `draw_examples` non disegna la canoa: dove stanno laghi e
   mare in «Explore» è una scelta di prodotto (domanda 3 del task file).

**Alternative scartate**: una «rete» finta della canoa in
`ActivityGraphs`, un `GraphLoader` che dà l'acqua (il motore la
rifiuterebbe giustamente, e il tipo mentirebbe); il piano sull'acqua
chiamato fuori dal planner, nei tre posti che lo usano (tre copie della
stessa scelta); la distanza suggerita al km più vicino come per le strade
(sopra); scaricare un'area più larga di quella della richiesta, perché le
partenze vicine trovino lo stesso file (l'acqua letta dal motore non
sarebbe più quella della CLI per la stessa richiesta: è un seguito, con
le aree d'acqua preparate prima); un campo `activity` in
`/route-directions`; un messaggio dell'API che sostituisce quello del
motore.

**Conseguenze**: una richiesta `paddling` all'API ora disegna sull'acqua;
la corsa e la bici non cambiano (test di prima, tranne l'esempio di
attività rifiutata). **Ogni partenza nuova sull'acqua è una richiesta
Overpass** per un'area di 8–10 km di lato: Overpass rifiuta dopo molti
download, e dal Mac oggi non risponde; la richiesta d'acqua non è mai
stata provata dal vero (ADR-0154). Seguiti: le aree d'acqua dei quattro
luoghi d'esempio scaricate prima sul server, con l'ok dell'utente. Cambia
`models.py`, quindi `engine_fingerprint`, già cambiato da A2: un solo
aggiornamento del server, poi `draw_examples`. Per la parte C: «Paddle»
pronto, l'avviso di sicurezza, i testi «does not fit the roads» da dire
per l'acqua, e niente `/route-directions` sull'acqua.

## ADR-0165 — Lo sport accanto al profilo: un pulsante tondo con l'emoji, un menu sotto di sé, la stessa scelta di «Settings»
**Stato**: Attiva · 2026-10-03 · deciso dall'agente su delega dell'utente
(TASK-205). La richiesta è dell'utente («Nella prima schermata a fianco al
profilo, metti la possibilità di cambiare sport»); il modo, qui sotto, è
dell'agente. TASK-205 e ADR-0165 dati dal coordinatore.

**Contesto**: lo sport si sceglieva solo in «Settings» (TASK-189,
ADR-0152), tre tocchi lontano da «Draw», che con «Bike» chiede percorsi
diversi (TASK-190, ADR-0153). L'intestazione delle pagine ha i tre nomi a
sinistra e il pulsante tondo del profilo a destra (TASK-154, ADR-0124).

**Decisione**:

1. **Un pulsante tondo come quello del profilo** (44 punti, bordo
   `borderStrong`, fondo `surfaceRaised`), a sinistra del profilo, a
   `space.sm` da lui, con l'emoji dello sport scelto (🏃‍♂️, 🚴). Sta nella
   stessa `action` del `Pager`: dove c'è il profilo c'è lo sport, e sulla
   mappa e durante la corsa nessuno dei due.
2. **Toccato apre un menu sotto di sé**, non cambia sport a ogni tocco:
   le righe sono quelle della sezione «Sport» di «Settings» (emoji, nome,
   «✓» bianco sullo scelto, «Soon» su uno non pronto, che non prende il
   tocco). Un tocco su uno sport pronto lo sceglie e chiude il menu; un
   tocco fuori, o il tasto indietro di Android, chiude senza cambiare. Il
   menu è un `Modal` trasparente di React Native, appeso sotto il pulsante
   dove `measureInWindow` dice che è (fino alla misura, dove l'intestazione
   lo mette).
3. **Una sola scelta**: `saveSport` e `useSport` di `src/settings/`, lo
   stesso `sport.json`. Il pulsante segue anche una scelta fatta in
   «Settings», e «Draw» segue il pulsante come segue «Settings». La
   sezione «Sport» di «Settings» resta.

**Perché così**: un pulsante gemello di quello del profilo non aggiunge
un linguaggio nuovo all'intestazione e ci sta anche sull'iPhone più
stretto (375 punti, provato sul 13 mini). Un menu dice quali sport ci
sono, quale è scelto e quale arriva («Soon»), come «Settings»; un tocco
che passa allo sport dopo cambierebbe i percorsi di «Draw» senza dirlo, e
con «Paddle» pronto diventerebbe un giro di tre. Il `Modal` prende i tocchi
fuori dal menu su iOS e Android senza toccare `Pager.tsx`.

**Scartato**: un tocco che alterna «Run» e «Bike»; una riga di pillole
sotto i nomi delle pagine (ruba altezza a ogni pagina); spostare il menu
dentro `ProfileLayer.tsx` o `Pager.tsx` (file di altri, e lo sport non è
dell'account né delle pagine); togliere «Sport» da «Settings».

**Conseguenze**: quando TASK-191 C accende `ready` di «Paddle» in
`sport.ts`, il menu lo mostra da solo e l'emoji del pulsante diventa 🛶. Un
quarto sport allunga il menu, non l'intestazione. I nomi delle pagine e i
due pulsanti stanno in 375 punti con circa 11 punti di margine: un nome di
pagina più lungo, o un terzo pulsante, non ci starebbe.

## ADR-0166 — Pubblicare una corsa, l'app: la scelta dopo la corsa, una coda sua senza rete, il disegno sulla mappa come una corsa
**Stato**: Attiva · 2026-10-03 · deciso dall'agente su delega dell'utente
(TASK-117, parte B), dentro le **scelte dell'utente** dello stesso giorno:
«Public» a fine corsa e su una corsa di «My activities», spento a ogni
corsa; un solo campo «Title» a fine corsa, per il disegno e per Strava; i
testi del task file. Numero tenuto dal coordinatore.

**Contesto**: l'API dei disegni (ADR-0159) vuole la corsa salvata prima
del suo disegno (`PUT /me/activities/{key}/drawing` dà `404` a una corsa
che non ha), e la corsa a fine corsa può restare sul telefono senza rete
(ADR-0140). Strava ha lo stesso problema e l'ha risolto con una coda sua
dopo quella delle corse (ADR-0156).

**Decisione**:
1. **La scelta di fine corsa viaggia con la corsa**: `activities-outbox.json`
   tiene, accanto a `strava`, un campo `drawing` (`title`, `public`); solo
   quando l'API ha la corsa la scelta passa a una coda sua,
   `drawings-outbox.json`, e parte dopo la corsa e dopo Strava, nello
   stesso giro. Senza titolo e con «Public» spento non si manda niente.
2. **Nella coda dei disegni c'è solo l'ultima scelta per corsa**: il
   `PUT` è la scelta intera, e una scelta più vecchia mandata dopo una più
   nuova la disferebbe. Esce dalla coda quando l'API l'ha, o la rifiuta
   (`404` corsa cancellata, `422`); con un `422` su «Public» e un titolo,
   si rimanda una volta privata, così il titolo resta (ADR-0159 punto 4).
   Senza rete, `429` o `5xx`, aspetta.
3. **La scelta su una corsa aperta si legge dall'API ogni volta**
   (`GET /me/activities/{key}/drawing`), o dalla coda se il telefono ne
   ha una che aspetta. Senza rete e senza coda non si mostra un «Off» che
   potrebbe essere falso: solo il problema. Un'API senza disegni (`404`)
   non mostra niente. Le scelte di una scheda partono una alla volta,
   nell'ordine fatto.
4. **Il disegno aperto va sulla mappa grande**, come una corsa di «My
   activities» (`App.tsx`, lo stesso ramo di `reviewing`): la traccia
   tagliata come linea del percorso, gialla come i disegni di «Feed», così
   la mappa si inquadra su di lei; nessun segnaposto di partenza (la
   partenza è tagliata apposta) e nessuna linea bianca. La scheda sotto
   non dice mai l'ora: agli altri arriva il giorno.
5. **Una «porta» dei disegni** (`social/drawingsDoor.ts`), come quelle dei
   preferiti, delle corse e di Strava, data da `ProfileLayer.tsx`: le corse
   pubbliche dell'account (per il segno in «My activities»), la scelta di
   una corsa, le pagine di un profilo, il disegno aperto.

**Perché così**: la coda separata è quella di Strava, già provata; tenere
la scelta dentro la corsa che aspetta evita un `PUT` destinato al `404`.
Leggere la scelta dall'API a ogni scheda costa una chiamata, ma non
mostra mai lo stato di un altro telefono dell'account come se fosse
questo. La mappa grande è quella che l'utente conosce dalle corse.

**Scartato**: mandare la scelta insieme alla corsa nello stesso `PUT`
(l'API delle corse è di TASK-172 e non la conosce); ricordare «Public»
fra una corsa e l'altra (scelta dell'utente: no); una mappa piccola dentro
«Profile» per il disegno aperto (un'altra mappa da caricare, e i disegni
di «Feed» si aprono già sulla mappa grande); la linea bianca della corsa
per il disegno (la mappa non si inquadra su una traccia sola).

**Conseguenze**: a fine corsa il campo «Name on Strava» non c'è più
(«Title» lo sostituisce); su una corsa aperta resta. **Aggiorna ADR-0156**,
«Parte app» (il nome si scrive nell'app prima di «Save», scelta
dell'utente del 2026-10-02): il nome si scrive ancora prima di «Save», ma
nel campo «Title», che vale per il disegno e per Strava (scelta
dell'utente del 2026-10-03); vuoto, l'API dà il suo nome come prima. La
coda di Strava (`stravaOutbox.ts`) non cambia: riceve il titolo come
nome, anche per una corsa partita senza rete (`AppDrawings.test.tsx`). La griglia nel
profilo di un altro c'è, ma nessuno la apre finché TASK-116 non sceglie da
dove si apre un profilo. Testi nuovi oltre a quelli scelti dall'utente:
«Saved on the phone. It is sent when you are back online.», «This drawing
is no longer public.», «Back to the profile», «Score 87» sotto un disegno
della griglia.

## ADR-0167 — La bici a mano: brevi tratti a piedi nella rete della bici, a sei volte il costo
**Stato**: Attiva · 2026-10-03 · deciso dall'agente su delega dell'utente
(TASK-206, parte A), dentro la **scelta dell'utente** dello stesso giorno:
«Sì, poco», circa 1 km a mano su 10, che si vede sulla mappa e la voce
annuncia. Numero tenuto dal coordinatore.

**Contesto**: i primi campioni in bici a Trento (TASK-190, `samples/LOG.md`)
sono «quasi» per cuore e cerchio e «no» per le stelle; l'utente ha chiesto
«migliora». Misurato sul Mac, senza rete, sulla zona di Trento: i parametri
del tracciamento (zone attorno ai punti della forma più larghe, corridoio,
penalità delle strade già fatte), il verso opposto della forma, i sentieri
con `bicycle=yes`, le zone pedonali e altre partenze in città non cambiano
niente o peggiorano. La rete della bici ha due terzi dei km di quella a
piedi (mancano marciapiedi, sentieri e zone pedonali) e un quinto è a
senso unico: per toccare in ordine i punti della forma il percorso gira
attorno agli isolati e fa punte. Con i tratti a piedi aggiunti, a sei volte
il costo, il cuore da 10 km passa da 0,70 a 0,79 di somiglianza, il cerchio
da 0,77 a 0,90, la stella resta (0,95 → 0,92, più grande); a piedi
0,7–1,1 km su 10. A tre volte il costo le forme migliorano ancora (cuore
0,90) ma a piedi sono 1,2–2,6 km; senza costo 6 km su 9.

**Decisione**:
1. **La rete `bike` tiene anche le vie dove la bici si porta a mano**
   (`walkable`): `footway`, `path`, `bridleway` e zone pedonali non aperte
   alle bici, e ogni via con `bicycle=dismount`; mai scale, mai una via
   chiusa ai pedoni (`foot=no`, o `access` chiuso senza un `foot` che la
   apra). Sono archi nei due sensi, segnati `walk`.
2. **L'altro senso di un senso unico si fa a piedi**, sul marciapiede:
   accanto a ogni arco a senso unico che la bici percorre c'è l'arco
   opposto segnato `walk` (`walkable_beside`), salvo `foot=no`. Si
   aggiunge dopo la semplificazione di OSMnx, che con un arco a piedi e uno
   in sella attorno a ogni nodo spezzerebbe ogni senso unico in pezzi da un
   isolato.
3. **Un metro a piedi costa `WALK_COST` = 6 metri in sella** nel costo del
   tracciamento (`_corridor_costs`) e nelle vie più brevi che non
   disegnano la forma (il ritorno da una partenza vicina, i tratti fra le
   lettere con la penna alzata: `step_cost`). Dove fra gli stessi due nodi,
   nello stesso verso, c'è un arco in sella, quello a piedi non c'è.
   OSMnx semplifica tenendo separati i tratti a piedi da quelli in sella
   (`edge_attrs_differ=["walk"]`).
4. **I controlli contano i metri a piedi** (`usability`, `on_foot`) e il
   risultato li dice fra gli avvisi: «650 m of the route with the bike on
   foot», come lo sterrato. La CLI li stampa fra i controlli.
5. **Un solo filtro Overpass più largo**: il secondo filtro della bici
   scarica tutti i `footway`, `path`, `bridleway` e le zone pedonali, non
   più solo quelli con un tag `bicycle`; sempre due richieste per zona.
   `rideable` e `walkable` decidono sui tag tenuti (`BIKE_TAGS` ha anche
   `foot`).
6. **Le zone fatte prima restano valide, senza tratti a piedi**: la rete
   si chiama ancora `bike`, i file `bike_*` sono gli stessi; un grafo fatto
   da TASK-206 in poi porta `on_foot=True`. Per avere i tratti a piedi una
   zona va rifatta (dall'estratto sul server, da Overpass sul Mac).
7. **La corsa e la canoa non cambiano**: sulla rete a piedi non ci sono
   archi `walk`, il costo è la lunghezza come prima.

**Perché così**: è l'unica leva misurata che migliora le forme, e la
scelta dell'utente («poco») è il costo che ne tiene i tratti brevi. Tenere
le vie a piedi nella stessa rete, con il loro costo, lascia al
tracciamento di sempre la scelta di dove servono; un grafo separato a
piedi da unire a ogni richiesta costerebbe memoria e tempo sul server.
Tenere il nome `bike` evita di toccare l'API e i suoi test in questa
parte, e lascia funzionare le zone di oggi finché non si rifanno.

**Scartato**: zone più larghe attorno ai punti della forma (le stelle non
si disegnano più); più ricerca o partenze più lontane (la ricerca lontana
a 1–2 km c'è già, e a Trento non trova di meglio); le zone pedonali in
sella (in Italia la legge le apre alle bici, ma non ovunque nel mondo, e a
Trento non cambiano le forme); un tetto rigido ai metri a piedi (il costo
li tiene a 0,7–1,1 km su 10 a Trento; i controlli li dicono); un nome
nuovo per la rete (`bike2`), che avrebbe obbligato a rifare subito le
zone e a cambiare l'API.

**Conseguenze**: una zona della bici pesa circa il doppio (i marciapiedi
e i sentieri: la zona di prova di Trento, rifatta senza rete dalle risposte
in cache, da 16.569 a 29.383 nodi e da 36.872 a 77.584 archi, 29.215 a
piedi); memoria dell'API e picco della costruzione da misurare sul server
quando si rifà la zona di Trento. Le zone `bike_*` del Mac e quella di Trento sul
server vanno rifatte per avere i tratti a piedi. I tratti a piedi come
dato del risultato (`on_foot`: da dove a dove, per la mappa e la voce)
entrano nella parte B con il contratto dell'API (`RouteResult` e
`RouteResultBody` devono avere gli stessi campi, `test_contract.py`), e
nell'app con la parte C. Fino ad allora l'avviso dice i metri a piedi.
Le gallerie stradali in bici (fino a 1 km nei campioni) restano: sono un
seguito.

**Aggiornamento (parte B, 2026-10-03)**, deciso dall'agente su delega
dell'utente; la migrazione con l'ok del coordinatore: il `RouteResult` ha
`on_foot`, coppie `[da, a]` di indici nei punti, compresi tutti e due, una
per ogni fila di archi a piedi (`network.on_foot_stretches`, calcolata dai
nodi del percorso come i punti), nelle alternative e, da una partenza
vicina, con l'avvicinamento e il ritorno. Si aggiunge senza togliere
niente: vuoto per la corsa e la canoa, facoltativo in `shared-types`,
sempre nelle risposte dell'API; si controlla come i `walks` (lo stesso
`walks_problem`). I preferiti lo tengono (migrazione `0012`, colonna
`on_foot` come `walks`, al più 1000 coppie nel `PUT`), perché un preferito
in bici riaperto abbia i tratti a mano sulla mappa e nella voce; le corse
salvate no (il punteggio non cambia). Il GPX non cambia: nessuna pausa, la
bici a mano è percorso. Le frasi della voce sono della parte C.

**Aggiornamento (parte C, l'app, 2026-10-03)**. Testi e stile **scelti
dall'utente** (`tasks/TASK-206.md`, «Le risposte dell'utente»); il resto
deciso dall'agente su delega dell'utente:

- **La mappa** (scelta dell'utente): la linea gialla resta intera e un
  livello `on-foot` sopra di lei la segna a trattini scuri (token `onFoot`,
  `onAccent`), sotto i luoghi e la corsa. Sopra e non al posto della
  linea, al contrario dei `walks` della penna alzata, perché il tratto a
  mano è disegno. Con una parola a penna alzata in bici si segna solo la
  parte dei tratti che cade sulle lettere (`onFootLines`).
- **La scheda** (testo dell'utente): non una riga nuova in `RoutePanel`, ma
  una regola in `warnings.ts` per l'avviso che il motore manda già («… m of
  the route with the bike on foot»): stessi metri del motore, stessa
  riga per ogni tessera, nessun file della #255 da toccare. Tono `info`:
  è da sapere, non un pericolo. Arrotondati a 10 m, almeno 10; da 1 km in
  km con un decimale.
- **I tratti si controllano come i `walks`** (`onFootOf` usa `walksOf`):
  indici interi, in ordine, dentro i punti; altrimenti nessuno e il
  percorso di prima. Un'API vecchia non li manda: niente cambia.
- **I preferiti**: `on_foot` nella richiesta solo se ce ne sono. A un
  `invalid_request` l'app riprova prima **senza i tratti** (un'API con
  l'attività di TASK-200 ma senza la parte B tiene il percorso in bici),
  poi come un'app più vecchia di TASK-199 (`asBefore`, che ora toglie
  anche `on_foot`): al più tre `PUT`, solo davanti a un rifiuto.
- **La voce** (frasi dell'utente; quando e quanto deciso dall'agente,
  `src/navigation/onFootVoice.ts`): dai metri lungo il percorso del
  navigatore, come la penna alzata. L'avviso a `ANNOUNCE_M` (50 m) prima
  del tratto, come una svolta, con i metri che mancano davvero e la
  lunghezza del tratto; se il primo fix è già sul tratto (un percorso che
  parte a piedi, un fix in ritardo), la frase senza «Tra … metri», con i
  metri che restano. «Back on the bike» alla fine, non quando il tratto
  finisce all'arrivo (lo dice già il navigatore). Due tratti a meno di
  **30 m** l'uno dall'altro si dicono come uno, e un tratto (anche unito)
  sotto i **25 m** non si dice, ma sulla mappa c'è: pochi metri contromano
  non valgono due frasi in pochi secondi. Un fix peggiore di `POOR_FIX_M`
  non muove niente; un tratto saltato tutto da un fix che salta passa in
  silenzio. La registrazione non va in pausa. Le parole arrivano dalle
  tabelle di `src/voice/` (TASK-209).
- **Non nella parte C**: la fine della corsa non segna i tratti (la corsa
  salvata non ha `on_foot`); un'anteprima di «Favorites» nemmeno.
- **«Start» in bici e la penna alzata in bici** (domande aperte di
  TASK-190): per scelta dell'utente sono **TASK-216**, «la navigazione in
  bici».

## ADR-0168 — La foto dal cerchio di «Profile»: un «+» bianco, le scelte di «Settings» in un riquadro sopra «Edit profile»
**Stato**: Attiva · 2026-10-03 · deciso dall'agente su delega dell'utente
(TASK-207). La richiesta e il «+» in basso a destra del cerchio sono
dell'utente, che l'ha scelto fra tre proposte (il «+» sul cerchio, «Change
picture» in «Edit profile», lasciarla in «Settings»); il resto, qui sotto,
è dell'agente.

**Contesto**: la foto del profilo si cambiava solo da «Settings», con la
riga «Profile picture» (TASK-178, ADR-0146), due tocchi lontano dal cerchio
che la mostra. `ProfileHeader` disegna lo stesso cerchio sul proprio
profilo e su quello di un altro (TASK-116).

**Decisione**:

1. **Tutto il cerchio è il pulsante**, «Profile picture» per VoiceOver,
   come la riga di «Settings»; il «+» è un tondo di 28 punti in basso a
   destra, **bianco (`text`) con il «+» scuro** e un anello del colore
   della pagina che lo stacca dal cerchio. Non giallo: nessun pulsante
   dell'account lo è. Il «+» c'è anche con una foto: toccato, si può
   cambiarla o toglierla. `ProfileHeader` ha il pulsante solo se gli si
   passa `photoButton`: il profilo di un altro resta com'era.
2. **Le scelte si aprono sotto nome e bio, sopra «Edit profile»**, in un
   riquadro (`surface`, bordo `border`, come i gruppi di «Settings»):
   senza, le tre pillole e «Edit profile» sembravano quattro pulsanti
   dello stesso gruppo (visto nel simulatore). Un altro tocco sul cerchio
   le richiude; una scelta le chiude e parte.
3. **Le scelte sono un file solo**, `PhotoChoices.tsx`, usato dalla riga
   di «Settings» e da «Profile»: stessi testi, stesso stato
   (`useProfilePhoto`). «Saving…», «Removing…» e gli errori si leggono
   sotto il riquadro, con le parole di ADR-0146, e il cerchio non prende
   il tocco mentre la foto va all'API.

**Perché così**: il cerchio intero è un bersaglio di 88 punti, il «+» da
solo sarebbe sotto i 44 che vogliamo. Aprire le scelte sul posto, come in
«Settings», evita un foglio o un `Modal` nuovi e una seconda maniera di
fare la stessa cosa.

**Scartato**: un foglio dal basso (un componente nuovo, e in «Settings» le
scelte si aprono sul posto); il «+» solo senza foto (con una foto non
resterebbe un modo di cambiarla da «Profile»); le scelte fra cerchio e
nome (spezzano chi è).

**Conseguenze**: la riga di «Settings» resta e fa lo stesso. Come la foto
di TASK-178, sul telefono funziona solo con il server alla migrazione
`0005` e l'app pubblicata.

## ADR-0169 — La canoa nell'app: solo forme, da 2 km, «Start» senza indicazioni dietro l'avviso della prima volta, «Explore» con i luoghi d'acqua
**Stato**: Attiva · 2026-10-03 · deciso dall'agente su delega dell'utente
(TASK-191, parte C). Sono **scelte dell'utente**: il nome «Paddle», il
testo dell'avviso di sicurezza e il suo mostrarsi **solo la prima volta**,
i quattro luoghi d'acqua al posto delle città in «Explore» quando lo sport
è «Paddle»; le distanze 1–5 km (ADR-0161). Il resto, qui sotto,
dell'agente.

**Contesto**: il motore (ADR-0154, ADR-0161) e l'API (ADR-0164) disegnano
sull'acqua con `activity: "paddling"`: solo forme del catalogo, nessuna
indicazione di svolta né alternativa, la partenza sulla riva, la distanza
suggerita per difetto al mezzo km. Nell'app «Paddle» era «Soon»
(ADR-0152), «Start» c'era solo con le indicazioni, «Start» da «Explore»
le chiedeva a `/route-directions` (che sull'acqua risponde `422`), e gli
esempi di «Explore» erano corse da 5 km dal centro di una città.

**Decisione**:

1. **«Paddle» pronto** in `sport.ts`; `activityOf` dà `paddling`;
   `withoutRouteLabel` dice il pulsante della corsa libera per ogni sport
   («Run», «Ride», «Paddle without a route»).
2. **Solo forme**: con «Paddle» il pannello non ha l'interruttore «Shape |
   Word | Image» e l'app manda la forma anche se prima era scelta una
   parola o una foto (`drawKind`); quella scelta resta, e torna con un
   altro sport. Così l'app non manda mai ciò che l'API rifiuterebbe
   (`invalid_request`).
3. **La distanza parte da 2 km** (`distanceForSport`), all'apertura e ogni
   volta che si sceglie «Paddle», non dai 5 km della corsa: 5 km stanno nei
   limiti, ma al mare il cuore ci sta fino a 3 km (ADR-0161) e la prima
   richiesta fallirebbe. Corsa e bici tengono la regola di prima
   (`fitDistance`). Il passo di − e + resta 1 km; il mezzo km arriva da
   «Try 2.5 km» o scritto.
4. **I testi d'errore dell'acqua** (`problems.ts`): con `paddling`,
   `shape_not_drawable` si legge nelle parole dell'acqua; «lontano
   dall'acqua» si riconosce dal messaggio del motore, «no lake or sea»
   (`NoWaterError`), perché l'API non ha un codice suo (ADR-0164); la
   distanza suggerita è offerta fra 1 e 5 km, altrimenti le forme.
5. **«Start» senza indicazioni**: un percorso `paddling` ha «Start» anche
   con `directions` vuoto; da «Explore» e dai preferiti, con `paddling`,
   l'app non chiede `/route-directions` e parte con la lista vuota. Il
   navigatore regge già un percorso senza svolte (arriva alla fine della
   linea; il banner «Follow the route to the end.»): la schermata della
   corsa non cambia.
6. **L'avviso**: un `Modal` a tutto schermo, come il conto alla rovescia
   che segue, davanti al primo «Start» sull'acqua (`usePaddleNotice`).
   «I understand» lo ricorda in `paddle-notice.json` e parte; «Not now» non
   parte e lo richiede al prossimo «Start». Un telefono che non scrive lo
   ricorda finché l'app è aperta. Il modulo si chiama `safetyNotice.ts`:
   `paddleNotice.ts` accanto a `PaddleNotice.tsx` è lo stesso file per il
   disco del Mac, che non distingue le maiuscole, e Jest importava l'uno
   per l'altro.
7. **«Explore» con «Paddle»** è una pagina sua, `PaddleExplore`, al posto di
   `ExploreScreen` (che non cambia): «Near me» e i quattro luoghi, ognuno
   con un punto della riva scelto a mano (`waterPlaces.ts`: le partenze dei
   campioni di A1 per Riva del Garda, Jesolo e Riccione; per Como il
   lungolago, Lungo Lario Trento, da Nominatim). Gli esempi sono quelli
   delle città con un `ExampleSet` diverso (`PADDLE_EXAMPLES`: paddling,
   2 km, cuore, cerchio e stella, nessuna forma dopo), tenuti a parte con
   la chiave `paddling:<punto>`; un esempio sull'acqua porta `activity`
   nel suo dettaglio, così `toRequest`, l'export, «Start» e i preferiti
   (`exploredKeepable`) lo trattano da canoa. Gli esempi di corsa restano
   identici, chiavi e file compresi. «Near me» prende la partenza di «Draw»
   al tocco, non quella che si muove col GPS: ogni punto nuovo
   ridisegnerebbe tre forme sull'acqua. La scelta del luogo vive fuori
   dalla pagina, che si smonta quando la mappa prende lo schermo.
8. **Il contrasto**: la linea gialla sull'acqua scura è a 11,5:1, più che
   su una strada principale (7,4:1); nessun token nuovo. Un test lo fissa
   dai token (`waterContrast.test.ts`).

**Alternative scartate**: l'avviso a ogni «Start» o anche come riga sotto
il percorso (proposte all'utente, che ha scelto la prima volta); l'avviso
come scheda sotto la mappa al posto del risultato (va davanti al conto
alla rovescia, che è un `Modal`); un campo `activity` in
`/route-directions` (ADR-0164, punto 7); `ExploreScreen` con un ramo per
l'acqua (cento righe di città e catalogo da spegnere una per una); una
cache degli esempi d'acqua tutta nuova (la stessa coda, gli stessi limiti
al minuto e lo stesso file di `exampleRoutes.ts` servono uguali); il passo
di mezzo km per − e + (un comportamento nuovo del campo non chiesto);
5 km di partenza come la corsa (sopra, punto 3).

**Conseguenze**: con «Paddle» l'app manda `paddling`, che un'API senza la
parte B rifiuta: si pubblica solo dopo il server. Sul server la canoa
funziona solo dove l'acqua è già in `data/cache/water/`: Overpass rifiuta
l'IP del server e da stamattina anche il Mac, quindi gli esempi dei
quattro luoghi danno «Map data for this area could not be downloaded.»
finché l'acqua non è scaricata (seguito, con l'ok dell'utente). «Feed», la
schermata della corsa (il passo al km, le calorie), Strava (che riceve una
corsa) e «My activities» restano quelli della corsa: la voce e il
punteggio pensati per l'acqua sono fuori scope (`tasks/TASK-191.md`).

**Aggiunta** (2026-10-03, dopo la lingua dell'app, TASK-210, ADR-0172;
deciso dall'agente su delega dell'utente): i testi nuovi della canoa
passano da `t()` e sono nelle quattro tabelle. Dove una frase si compone,
si traduce la frase intera: il «da dove» dei luoghi è un testo solo
(«from the beach», «from Riva del Garda»: in italiano «dalla spiaggia»
non si fa da «da» + «la spiaggia»), e la riga sotto la distanza è
«{name} · on the water · target {km} km» con la sua gemella «on roads»,
che così si traduce anche per la corsa e la bici. I nomi dei luoghi
(Lago di Garda, Jesolo…) restano quelli italiani in ogni lingua.

## ADR-0171 — La voce della corsa in cinque lingue: le frasi dette in `src/voice/`, una tabella per lingua, la scelta in «Data»
**Stato**: Attiva · 2026-10-03 · deciso dall'agente su delega dell'utente
(TASK-209). Le cinque lingue, il posto («Data», accanto a «Voice») e la
voce fra quelle del telefono con un ascolto di prova sono dell'utente; che
la voce segua la lingua dell'app (TASK-210) salvo una scelta solo sua è
del coordinatore con l'utente; un solo elenco di lingue in `src/i18n/`
(di TASK-210) è l'accordo fra i due task. Il resto è dell'agente.

**Contesto**: la voce diceva tutto in inglese (`en-US`), con le frasi
scritte dentro la logica della corsa: `phrases.ts` (le svolte, la penna
alzata), `navigator.ts` (fuori percorso, arrivo), `freeRun.ts` (ogni km),
`runControl.ts` (pausa e ripresa). `instruction()` serviva sia al banner
sia alla voce. Altri task toccano la voce (TASK-191 C toglie le svolte
sull'acqua, TASK-206 C annuncia i tratti a piedi) e TASK-210 traduce lo
schermo.

**Decisione**:

1. **Il detto separato dallo scritto.** Ogni frase detta, l'inglese
   compreso, sta in `src/voice/`: un `Phrasebook` per lingua (`en.ts`,
   `it.ts`, `es.ts`, `fr.ts`, `de.ts`) con le parole (i verbi delle
   svolte, le vie senza nome per tipo, «beside», «In 50 metres», «then», le
   frasi fisse, le unità di tempo), e `voiceWords()` che le mette insieme
   allo stesso modo per tutte: partenza, svolta, catena di svolte, tempo
   detto («5 minuti e 42 secondi»), km. Il banner resta in `phrases.ts`
   (`instruction`, `thenText`), in inglese: lo traduce TASK-210. Da
   `phrases.ts` escono `announcement`, `penUpCue` e `penDownCue`, da
   `freeRun.ts` `spokenTime`.
2. **I file della corsa passano solo la lingua.** `startNavigation`,
   `onFix`, `movePen` e `kmAnnouncement` prendono `language` in coda, per
   difetto l'inglese: chi non la passa ha le frasi di prima. I due hook
   leggono la lingua **a ogni posizione**, così un cambio in «Data» vale
   dalla frase dopo; `runControl` dice pausa e ripresa con `spokenWords()`.
   `play()` chiede a `Speech.speak` la lingua e la voce di adesso.
3. **Una tabella per lingua invece di frasi intere tradotte**: i nomi
   delle vie entrano nelle frasi così come sono (mai tradotti, ADR-0057), e
   ogni lingua ha bisogno di forme sue: il tedesco cambia l'articolo fra
   «auf den Fußweg» (dopo una svolta) e «auf dem Fußweg» (alla partenza), e
   mette il verbo in fondo («In 50 Metern links abbiegen auf …», senza
   virgola); l'italiano dice «sul sentiero» ma «lungo il sentiero»; il
   francese «à côté d'Avenue Foch». Per questo ogni via senza nome ha due
   forme (`Place`: `onto`, `on`). **L'uno detto a parole** dove si accorda
   con l'unità («Un chilometro», «un'ora», «une heure», «eine Minute»):
   la voce del telefono leggerebbe «1» al maschile.
4. **La scelta** (`voiceChoice.ts`, `voice.json` nei documenti, come lo
   sport): `language` è una delle cinque o `"app"` (per difetto), e
   `voices` tiene **una voce per lingua**, per identificatore, così
   tornando a una lingua torna la sua voce. `speaking()` decide:
   - la lingua scelta, o quella dell'app;
   - **inglese se il telefono non ha nessuna voce per quella lingua**
     (parole italiane dette da una voce inglese non si capiscono), detto
     anche nel foglio;
   - la voce scelta **solo se il telefono ce l'ha**: iOS (`expo-speech`)
     per un identificatore che non trova lancia un errore e non dice
     niente. Una voce sparita lascia la voce di sistema della lingua.
     Prima che il telefono abbia detto le sue voci (`loadVoices`, all'inizio
     di ogni corsa, all'apertura di «Data» e del foglio), nessuna voce per
     nome.
   Un telefono che non dà voci (errore, o nessuna) non sa niente: la lingua
   resta quella voluta. **Si aspetta al massimo 3 s** (`VOICES_WAIT_MS`):
   nel simulatore iOS 27 l'elenco è arrivato solo dopo minuti; scaduta
   l'attesa si va avanti senza voci, e la risposta tardiva si tiene per la
   volta dopo (riaprendo il foglio le voci compaiono).
5. **Dopo i primi 5 km** (`CHEER_KM`) l'annuncio del km finisce con un
   incitamento, una volta per corsa: «Daje, avanti tutta!» in italiano,
   chiesto dall'utente il 2026-10-03; ogni lingua ha il suo (`cheer`). È
   dentro `kilometre()`: i file della corsa non cambiano.
6. **In «Data»** una riga sotto gli interruttori, «English · Default», e
   «Listen»; la riga apre un foglio dal basso con «Language» e «Voice»
   (`VoiceSetting.tsx`, un `Modal` dentro quello di «Data», come la
   modalità tasca). Con «Voice» spenta la scelta resta, «Listen» no.

**Perché così**: tradurre stringhe intere con dei segnaposto («Turn left
onto {street}») non regge la grammatica delle cinque lingue (articoli,
preposizioni articolate, il verbo tedesco in fondo), e metterebbe in ogni
tabella le stesse frasi ripetute per ogni svolta e ogni tipo di via. Le
frasi in file nuovi lasciano i file della corsa ad altri task con un solo
parametro in più. Leggere la lingua a ogni posizione costa una lettura di
memoria e fa sentire subito il cambio.

**Scartato**: le frasi come chiavi strutturate nei `Cue` e tradotte solo in
`play()` (cambiava il tipo `Cue` e tutti i test che leggono `cue.say`);
il banner nella lingua della voce (è dello schermo, TASK-210); la scelta
in «Settings» (l'utente l'ha voluta in «Data»; si può aggiungere dopo);
voci scaricate da internet (fuori scope).

**Conseguenze**: le frasi nuove della voce (TASK-206 C, i tratti a piedi)
vanno in tutte e cinque le tabelle: `Phrasebook` lo impone al compilatore e
`words.test.ts` lo controlla. Le frasi italiane sono confermate
dall'utente (2026-10-03), e lo sono anche quelle spagnole, francesi e
tedesche, che l'utente ha ascoltato lo stesso giorno (`UI.md`, «La voce
della corsa»). Il branch importa `src/i18n/` (TASK-210), che entra in `main`
prima.

## ADR-0172 — La lingua dell'app: l'inglese resta la base e la chiave, la lingua del telefono alla partenza, nessuna dipendenza
**Stato**: Attiva · 2026-10-03 · deciso dall'agente su delega dell'utente
(TASK-210). La richiesta e le cinque lingue sono dell'utente; la lingua di
partenza (quella del telefono) è una sua scelta del 2026-10-03; il modo,
qui sotto, è dell'agente. TASK-210 e ADR-0172 dati dal coordinatore.

**Contesto**: `CLAUDE.md` e ADR-0007 vogliono i testi dell'interfaccia in
inglese, come il codice, e `UI.md` diceva «le traduzioni verranno dopo».
L'utente chiede di scegliere in «Settings» fra inglese, tedesco, italiano,
spagnolo e francese. I testi sono scritti a mano in un centinaio di file,
e altri lavori li stanno toccando.

**Decisione**:

1. **L'inglese resta la lingua del codice e la base.** Ogni testo si
   scrive in inglese nel file che lo mostra, come prima, dentro `t()`:
   `t("Log out")`. La regola di `CLAUDE.md` vale ancora per chi scrive
   codice: l'inglese è il testo di partenza, le altre lingue sono
   traduzioni di quello.
2. **Il testo inglese è la chiave** delle tabelle (`src/i18n/de.ts`,
   `it.ts`, `es.ts`, `fr.ts`), non un nome inventato: il file resta
   leggibile, i test in inglese non cambiano, un testo senza traduzione si
   mostra **in inglese** invece di rompersi. Un test legge con TypeScript
   tutte le chiamate dell'app e controlla che ogni lingua abbia ogni testo,
   con gli stessi `{segni}`, e nessun testo che nessuno mostra più: chi
   cambia una frase inglese lo vede subito.
3. **Numeri e parole che cambiano**: un valore entra in un segno, mai
   incollato a pezzi tradotti (`t("{count} km left", { count })`), perché
   l'ordine delle parole cambia da lingua a lingua. I decimali si scrivono
   con la virgola in de, it, es, fr (`decimal()`, e un numero passato a un
   segno). I plurali con `tPlural(count, uno, altri)`, entrambi con
   `{count}`: il francese usa la forma «uno» anche per lo zero.
4. **La lingua di partenza è quella del telefono** se è una delle cinque,
   la prima che lo è fra le lingue preferite di iOS (`Settings` di React
   Native, `AppleLanguages`; `I18nManager` altrove); altrimenti
   l'inglese. **Nessuna dipendenza nuova** (non `expo-localization` né
   `i18next`): bastano due moduli di React Native e una funzione di
   sessanta righe. Nei test il telefono non dice niente, quindi l'app è in
   inglese su ogni macchina.
5. **La scelta** sta in `language.json` nei documenti, come lo sport
   (TASK-189); «Phone language» cancella il file. Vale subito: la radice
   dell'app chiama `useLanguage()` e una lingua nuova ridisegna tutto
   senza smontare niente (un percorso aperto resta aperto). Un testo
   tenuto in uno stato (un errore già comparso) resta nella lingua di
   quando è comparso.
6. **`t()` si chiama mentre si disegna**, mai al caricamento di un file:
   una lista fissa tiene il testo inglese dentro `tLater()` e lo traduce
   dove lo mostra.
7. **Un solo elenco di lingue**, `src/i18n/languages.ts`, con il nome di
   ognuna nella sua lingua («Deutsch») e la lingua della voce («de-DE»):
   la voce di TASK-209 lo legge e segue la lingua dell'app se in «Data»
   non se ne sceglie un'altra.
8. **Il tono**: il «tu» in tutte e quattro le lingue, come l'inglese
   dell'app. Strava e OpenStreetMap con le parole che danno loro nelle
   varie lingue («Mit Strava verbinden», «© contributori di
   OpenStreetMap»). Un testo inglese usato in due posti ha una traduzione
   sola che deve andare bene per entrambi («Keep it» → «Annulla»).

**Perché così**: una chiave inventata («settings.logout») obbliga a
leggere due file per capire una schermata e cambia ogni test; una libreria
porta più di quanto serve a cinque lingue con plurali semplici. La lingua
del telefono è quello che fanno le app sull'iPhone.

**Scartato**: smontare l'app al cambio di lingua (`key` sulla radice: si
perderebbe il percorso disegnato); l'inglese fisso fino a una scelta (la
scelta dell'utente è stata l'altra); le bandiere accanto alle lingue
(l'inglese e lo spagnolo non hanno un paese solo).

**Conseguenze**: tradotta **a pezzi** (TASK-210 parte A e le successive),
perché altri lavori tengono i file della corsa, di «Draw» e di
«Explore»: fino all'ultima parte, in italiano alcune schermate restano in
inglese. I testi che arrivano dall'API (titoli, nomi dei percorsi a tema,
il nome su Strava) restano in inglese. Le traduzioni le ha riviste
l'agente su delega dell'utente («controlla te, mi fido»); chi parla le
altre lingue può migliorarle senza toccare il codice.

**Aggiunta** (2026-10-06, TASK-210 parte D, «Draw»; deciso dall'agente su
delega dell'utente): (1) gli avvisi del motore (`warnings.ts`) restano
riconosciuti dai suoi testi inglesi e detti con `t()`; la direzione dello
start spostato («north-east») è tradotta con le stesse chiavi dei punti
cardinali della corsa (`runStats.ts`), così un avviso e la scheda «Dati»
dicono «nord-est» allo stesso modo; una distanza che il motore scrive
«1.2 km» si mostra con il decimale della lingua («1,2 km»). (2) Le ragioni
di una foto o di una linea rifiutata (`REASON_TEXT`, `EDIT_REASON_TEXT`)
restano tabelle inglesi marcate con `tLater` e tradotte dove si mostrano:
i test le confrontano in inglese. (3) I nomi delle forme («heart», «dog
head») e il segnaposto del campo restano per la parte «nomi delle forme»:
in de/es/fr il segnaposto suggerisce parole («Herz, Stern, Pferd…») che
`shapeWords.ts` non conosce e manda all'AI, accettato fino a quella parte.
(4) L'avviso dice «Vai a «Parti da qui»» (de «Hier starten», es «Empieza
aquí», fr «Départ ici»): la parte di `mapPage.ts` chiamerà così «Start
here».

**Aggiunta** (2026-10-07, TASK-210 parte E, la fine corsa, «Sport» e la
voce; deciso dall'agente su delega dell'utente): (1) i nomi degli sport
restano inglesi in `SPORTS` (`sport.ts`), marcati con `tLater`, e si
traducono dove si mostrano, con le stesse chiavi delle schede «Activity»
della fine corsa: lo sport di «Settings» e quello del post si chiamano
allo stesso modo («Corsa», «Bici», «Pagaia»). Chi legge `name` senza
`t()` (oggi `FeedPost`, «Paddle ·») vede l'inglese, come prima. (2) Nel
foglio della voce i nomi delle lingue restano ognuno nel suo, anche
dentro una frase tradotta («non ha una voce per Deutsch»): sono gli
stessi nomi delle righe da toccare. «Enhanced» si traduce con la parola
di iOS in quella lingua; i nomi delle voci e i codici («it-IT») restano
come li dà il telefono. (3) I messaggi di `drawingProblem` passano da
`t()`, compresa la sessione scaduta (`t(SESSION_ENDED)`, come in
`account/messages.ts`); il messaggio `invalid_request` resta quello
dell'API, in inglese.

**Aggiunta** (2026-10-08, TASK-210 parte F, i nomi delle forme, la mappa
e «Help»; deciso dall'agente su delega dell'utente, i quattro punti fuori
dalla lista approvati dal coordinatore il 2026-10-07): (1) **Un nome solo
per forma**: il nome dentro una frase e nel campo di «Draw»
(`shapeWord`, «Hundekopf», «testa di cane», «cabeza de perro», «tête de
chien») si ricava dal nome con la maiuscola della parte A (`shapeName`),
senza la maiuscola tranne in tedesco, che la vuole su ogni nome; in
inglese restano le parole della forma di prima («dog head»), byte per
byte. Nessuna tabella nuova di nomi. (2) **`shapeWords.ts` conosce le
cinque lingue** quale che sia quella dell'app (chi scrive «cuore» con
l'app in tedesco ha il cuore), con singolare, plurale e qualche
diminutivo; le parole si scrivono con accenti e maiuscole e si leggono
senza («Kürbis» = «kurbis», «œ» = «oe»); gli articoli delle cinque lingue
si saltano («ein Herz», «l'étoile»). Un albero o un abete da soli non
sono l'albero di Natale (ADR-0084). (3) **La mappa nomina i luoghi nella
lingua dell'app** (`name:de`, `name:fr`…, poi il nome del posto), non più
sempre in italiano: anche in inglese («Munich», non più «Monaco di
Baviera»). Provata nel browser con le tile vere: «Mailand», «Neapel» in
tedesco, «Gênes», «Trente» e «Départ ici» in francese. La pagina si costruisce con la lingua; `MapView` la rifà
quando la lingua cambia e la mappa si ricarica come con «Retry»,
ricevendo di nuovo partenza e percorso. Le mappe piccole del Feed
(`MAP_STYLE`, file di TASK-118) prendono la lingua dell'apertura
dell'app: seguono un cambio con la parte G. (4) **«Help», «Terms» e
«Privacy»** hanno un file per lingua in `about/content/`, anche in
tedesco, spagnolo e francese (scelta dell'utente del 2026-10-07: «Terms»
e «Privacy» tradotti come bozze, con gli stessi segnaposto `[name]`,
`[contact email]`, `[governing law]`; la nota delle basi giuridiche è
tradotta come in italiano); non si ricade più sull'inglese e VoiceOver
legge ogni testo nella lingua dell'app. I nomi dei pulsanti sono quelli
che l'app mostra in ogni lingua; le tre pagine hanno i titoli della
parte G (#437: «Disegna», «Zeichnen», «Fil»…), anche se una delle due PR
entra qualche minuto prima dell'altra. (5) Quattro
testi nuovi in fondo alle tabelle (dopo il merge della parte E):
«{list} or {last}», «Start here», «NEAR {city}», «here».

## ADR-0173 — Seguire con richiesta, l'API: una tabella `follows` con due stati, la ricerca per nome, gli elenchi solo propri
**Stato**: Attiva · 2026-10-03 · deciso dall'agente su delega dell'utente
(TASK-211, parte A), dentro due **scelte dell'utente** del 2026-10-03:
seguire vuole una richiesta che l'altro accetta o rifiuta; gli iscritti si
cercano per nome. Le proposte per l'app (dove stanno «Requests», il tasto
«Follow») sono nel task file e si confermano prima della parte B. Numero
tenuto dal coordinatore.

**Contesto**: TASK-208 vuole «Followers» fra le scelte di «Who can see it»
e i tag delle persone, cercate per nome. Non c'era un modo di trovare un
altro iscritto, né di arrivare al suo profilo (`UserProfilePage.tsx`,
ADR-0128 punto 8: «da dove si apre lo decide l'utente», domanda aperta in
TASK-116). Bloccare e segnalare sono di TASK-121, che non è ancora fatto.

**Decisione**:
1. **Una tabella `follows`**, una riga per coppia ordinata (chi chiede, chi
   è seguito: la chiave), con `status` `pending` o `accepted`, `asked_at` e
   `accepted_at` (presente solo da accettata). Un vincolo vieta di seguire
   sé stessi; `ON DELETE CASCADE` su tutti e due gli account, così un
   account cancellato sparisce da ogni elenco e da ogni numero senza
   codice. Due righe a due versi per due persone che si seguono a vicenda:
   ognuna accetta la sua.
2. **Ogni azione porta allo stato voluto, e rifatta non cambia niente**:
   chiedere di nuovo lascia la riga com'è (una sola, con la sua data);
   ritirare, smettere, rifiutare e togliere cancellano la riga (`204` anche
   quando non c'era); accettare una richiesta già accettata è `204`. Solo
   accettare senza nessuna richiesta è `404`. Seguire sé stessi è `422`
   con il motivo in parole; un profilo che non c'è, `404` come in
   `GET /users/{public_id}`.
3. **Rifiutare cancella la richiesta**: chi aveva chiesto vede di nuovo
   `none`, come se non avesse mai chiesto, e può richiedere. Nessuno stato
   «rifiutata» che l'API potrebbe lasciar trapelare (scelta proposta
   nel task file: il tasto torna «Follow»).
4. **Contano solo le richieste accettate**: nei numeri `followers` e
   `following` del profilo, negli elenchi e nella funzione per TASK-208
   (`follows_sql`, `Follows.follows`: «A segue B, accettato?»). Una
   richiesta in attesa non dà niente in più a chi l'ha mandata.
5. **`PublicProfile`** prende `followers`, `following` e `follow`, lo
   stato di chi guarda verso quel profilo: `none`, `requested`,
   `following`. Il proprio profilo dice `none`. Nell'app i tre campi sono
   facoltativi: un server di prima non li manda.
6. **La ricerca** (`GET /users?q=`): almeno 2 caratteri dopo aver tolto
   gli spazi (meno: `422` in parole), al più 20 risultati, mai chi cerca.
   Cerca il pezzo dentro il nome senza badare alle maiuscole (`_` e `%`
   valgono come lettere, non come jolly); prima i nomi che cominciano così,
   poi i più corti, poi in ordine alfabetico: lo stesso risultato ogni
   volta. Ogni risultato è solo `public_id`, `username` e `photo`: niente
   email, bio o numeri (un test cerca l'email nel testo).
7. **La foto negli elenchi è piccola**: 128 px di lato invece dei 256 del
   profilo, rifatta dall'API a ogni lettura (circa un quinto dei byte: 7 KB
   invece di 36 per una foto piena di dettagli; venti risultati restano
   leggeri mentre si scrive). Una colonna in più in
   `profile_photos` non serve finché costa così poco.
8. **Gli elenchi sono solo propri**: `GET /me/followers`, `/me/following`
   e `/me/follow-requests`, a pagine come i disegni di un profilo (`limit`
   da 1 a 50, `next`, `total`), dal più recente (l'accettazione per i
   primi due, la richiesta per il terzo). Chi segue chi, per gli altri, si
   legge solo nei due numeri del profilo.
9. **Da dove si apre il profilo di un altro** (domanda aperta di TASK-116,
   risposta del coordinatore su delega dell'utente): **dalla ricerca**, e
   dagli elenchi di «Followers», «Following» e «Requests». Il feed
   (TASK-118), i like e i commenti si aggiungeranno quando ci sono.

**Il rapporto con TASK-121** (bloccare e segnalare): questa parte non
blocca niente. Quando TASK-121 arriva, bloccare dovrà togliere le righe di
`follows` nei due versi e rifiutare una richiesta nuova fra i due, e la
ricerca e gli elenchi dovranno saltare chi è bloccato: tocca `follows.py`,
che il suo task file non elenca ancora. Fino ad allora chi viene rifiutato
può richiedere quante volte vuole (il limite dei POST di `access.py` vale
lo stesso). Il cancello di `ROADMAP.md` resta: prima di invitare persone che
non si conoscono, TASK-121 e TASK-122 fatti.

**Scartate**: seguire libero, come Strava di base (non è la scelta
dell'utente); uno stato `declined` nella riga (direbbe il rifiuto, o
andrebbe nascosto a mano in ogni risposta); il `public_id` come chiave
della tabella (le altre tabelle di un account usano `users.id`, che resta
dentro l'API); gli elenchi di un altro (`GET /users/{id}/followers`: dice chi
frequenta chi, non è chiesto); la foto a 256 px negli elenchi (sopra);
`GET /users/{id}/photo` a parte (una richiesta per ogni riga, e l'immagine
vorrebbe il token in un'intestazione: ADR-0128 lo lasciava al feed); un
indice a trigrammi per la ricerca (`pg_trgm`: con pochi iscritti la
lettura di tutta `users` costa meno di un millisecondo).

**Conseguenze**: una migrazione nuova (`00NN_follows.sql`, il primo numero
libero in `main` al merge) e un modulo nuovo (`follows.py`); `profiles.py`
legge i tre campi in più. Sul telefono arriva solo con l'aggiornamento del
server e la parte B, tutti e due con l'ok dell'utente. **Va detto
all'utente**: la ricerca mostra il nome di ogni iscritto a chi ha un
account (con due lettere alla volta si può fare l'elenco di tutti).

## ADR-0174 — Il logo dopo «Save»: il giallo e il logo dell'avvio, 1,65 s, sopra l'app, anche senza rete
**Stato**: Attiva · 2026-10-03 · deciso dall'agente su delega dell'utente
(TASK-212). La richiesta («Finita l'attività, quando la salvi deve uscire
il logo di Sgrava») e il logo anche senza rete sono dell'utente; il resto,
qui sotto, è dell'agente.

**Contesto**: «Save» a fine corsa (TASK-172, ADR-0140) tiene la corsa e
torna alla mappa, senza nessun segno che sia andata. Il logo con il giallo
si vede già all'avvio (TASK-179, ADR-0147), in `src/intro/`, sopra `App`.

**Decisione**:

1. **Lo stesso giallo `accent` e lo stesso logo intero dell'avvio**
   (`splash-logo-dark.png`), senza il cuore: il cuore è dell'apertura, e
   qui il disegno è quello appena corso, già sulla scheda.
2. **Tempi**: 0,25 s il giallo sale e il logo cresce dall'85% alla sua
   misura, 1,1 s fermo, 0,3 s di dissolvenza; in tutto 1,65 s, meno
   dell'avvio (2,7 s). Un tocco lo manda via subito. Il tempo lo tiene un
   timer, non l'animazione, come all'avvio: con le animazioni del telefono
   spente il logo resta lo stesso.
3. **Sopra l'app, in `Root.tsx`**, sotto l'animazione d'avvio: `RunEnd`
   chiama `showSavedLogo()` quando `onSave()` è vero, e uno strato in
   `Root` lo mostra. `App.tsx` non cambia: `RunEnd` si smonta appena la
   corsa è tenuta, e il logo deve restare.
4. **Anche senza rete** (scelta dell'utente): «Save» vero vuol dire la
   corsa tenuta, sul telefono o già sull'API. Niente logo se il telefono
   non tiene la corsa, né a «Discard».
5. Al lettore di schermo: «Saved to My activities», annunciato.

**Perché così**: un'immagine sola, già nell'app, e nessuna dipendenza;
uno strato in `Root` vede l'app intera, mentre la schermata della corsa se
ne va nello stesso tocco.

**Scartato**: il disegno della corsa tracciato sul giallo come il cuore
dell'avvio (non chiesto, e più lungo); il logo dentro `App.tsx` (il file
più conteso); un «Saved» scritto sotto il logo (non chiesto).

**Conseguenze**: TASK-208 B, che rifà la fine della corsa, tiene la
chiamata a `showSavedLogo()` dopo un «Save» riuscito. Si vede sul telefono
con la prossima pubblicazione dell'app, con l'ok dell'utente.

## ADR-0175 — I commenti: legati al disegno, chi lo vede li legge, in un foglio dal basso aperto dal disegno
**Stato**: Attiva · 2026-10-03 · **scelta dell'utente** il posto (subito
sotto le corse pubblicate vere, non sugli esempi di «Feed»); il resto
deciso dall'agente su delega dell'utente (TASK-120).

**Contesto**: l'utente ha chiesto di poter commentare sotto i post. TASK-120
li voleva dopo il feed vero (TASK-118), che aspetta il «segui» (TASK-211)
e la pubblicazione alla Strava (TASK-208); i post di «Feed» di oggi sono
esempi (TASK-156) che non stanno sul server. Le corse pubblicate vere
(TASK-117) ci sono, e si aprono sulla mappa da un profilo.

**Decisione**:

1. **Un commento è del disegno** (`comments.drawing_id`, non la corsa):
   lo legge e lo scrive **chi vede il disegno**, cioè ogni iscritto
   finché è pubblico e il proprietario sempre. Quando arriverà «Followers»
   (TASK-208) la regola resta questa: chi vede, commenta. Un disegno
   tornato privato tiene i commenti, visti solo dal proprietario.
2. **Cancella chi l'ha scritto o il proprietario del disegno**, come
   diceva il task. Chi l'ha scritto lo cancella anche sotto un disegno
   tornato privato (sono suoi dati, ADR-0114). Chi vede il commento ma non
   è nessuno dei due: `403`; chi non lo vede: `404`, come un id che non
   c'è. Ogni commento dice a chi chiede se lo può cancellare
   (`deletable`): l'app non lo ricava da sola.
3. **Pagine dal più vecchio**, 20 per volta, con lo stesso cursore dei
   disegni (inizio in microsecondi e id casuale) e `total`. Il numero sul
   pulsante è il `total` della prima pagina: il disegno non ha un campo
   nuovo e `drawings.py` non cambia (lo toccano anche TASK-208 e 211).
4. **Al più 10 commenti al minuto per account**, con il `RateLimiter` delle
   foto, prima di ogni altro controllo (anche un commento rifiutato
   conta: non si prova il filtro a raffica).
5. **Il filtro di TASK-213 decide nell'API** (ADR-0176): dopo i controlli
   di lunghezza, `check_comment` sul testo pulito; rifiutato, `422
   comment_rejected` con `reason` (`COMMENT_REASONS`, oggi solo
   `"negative"`) e le parole dell'utente. Il codice e il motivo sono nel
   contratto come gli altri.
6. **Nell'app, un foglio dal basso** aperto da un pulsante nella scheda
   del disegno, non l'elenco nella scheda: la scheda sta sotto la mappa e
   un elenco la spingerebbe via. Un `Modal` trasparente a tutto schermo con
   `KeyboardAvoidingView` (con `pageSheet` di iOS il calcolo della
   tastiera sbaglia di quanto il foglio parte in basso). Il foglio è un
   componente a sé (`DrawingComments`), pronto per le schede di TASK-118.
7. **La foto di chi scrive** non viaggia nel commento (20 foto in base64
   per pagina): l'app la chiede a `GET /users/{public_id}`, una volta per
   profilo finché è aperta; senza, l'iniziale.

**Perché così**: la scelta dell'utente dà commenti veri subito, e i file
nuovi (`comments.py`, `src/social/…`) non si scontrano con i task che
toccano disegni e profili.

**Scartato**: commenti sui post d'esempio (non sono sul server; l'utente
non l'ha scelto); il numero dei commenti dentro `DrawingDetail` (un campo
in più in un file di altri task, per un numero che la prima pagina dà
già); la foto nel commento; una colonna «nascosto» che nessuno usa ancora
(la aggiunge TASK-121 se serve).

**Conseguenze**: migrazione `0013` (il primo numero libero al merge). Sul
telefono funziona solo con il server aggiornato e l'app pubblicata, con
l'ok dell'utente; un'API senza commenti risponde `404` e il pulsante non
c'è. I testi nuovi sono tradotti come vuole ADR-0172 (TASK-210 è entrato
prima). **Segnalare un commento arriva con TASK-121** (scelta dell'utente,
2026-10-03): per ora bastano il filtro e la cancellazione da parte del
proprietario; TASK-121 resta il cancello prima di invitare chi non si
conosce.

## ADR-0176 — Nessun commento negativo: un elenco di parole nell'API, rifiutato con un avviso
**Stato**: Attiva · 2026-10-03 · **scelta dell'utente** la regola e
l'avviso; il modo di riconoscerli è deciso dall'agente su delega
dell'utente (TASK-213). Supera in parte ADR-0114, punto 8.

**Contesto**: con i commenti (TASK-120) gli iscritti scrivono sotto le
corse degli altri. L'utente, il 2026-10-03: «non si possono fare commenti
negativi, se uno scrive qualcosa di negativo o brutto il messaggio viene
bloccato». E sull'avviso: «Fai uscire un alert, dicendo: in questa app non
puoi scrivere commenti negativi, cambia app». ADR-0114 diceva «nessun
contenuto si nasconde da solo».

**Decisione dell'utente**:
1. Un commento negativo o brutto **non si pubblica**. È la prima eccezione
   al punto 8 di ADR-0114. Per tutto il resto restano le segnalazioni e la
   rimozione a mano entro 24 ore (TASK-121).
2. Chi lo scrive vede un **alert**: «You can't write negative comments in
   this app. Try another app.». In inglese come tutti i testi dell'app;
   l'utente l'ha detto in italiano, «In questa app non puoi scrivere
   commenti negativi, cambia app».

**Decisione dell'agente**:
1. **Decide l'API**, non l'app: un controllo solo nell'app si aggira.
   `comment_filter.check_comment(text)` restituisce `None` o il motivo,
   `"negative"`. TASK-120 lo chiama prima di salvare, risponde `422` con
   `comment_rejected` e il motivo, e l'app mostra l'alert. Il testo resta nel
   campo, così si corregge.
2. **Un elenco di parole**, in italiano e in inglese, senza AI. Gli
   **insulti** (parolacce, insulti, bestemmie, insulti contro gruppi di
   persone) sono negativi sempre. Le **parole negative** («brutto»,
   «pessimo», «ugly», «worst») lo sono a meno che una negazione stia nelle
   tre parole prima («non è affatto brutto», «not bad»). Poi alcune frasi
   («che palle», «go to hell») e le emoji 🖕 👎 💩 🤮 🤢 😡 🤬 😠.
3. **Parole intere, non pezzi**: così Cazzago, Schifanoia, Scunthorpe e la
   puttanesca passano. Le parole si confrontano in minuscolo e senza
   accenti, con le cifre lette come lettere («str0nz0»), le lettere tenute
   lunghe ridotte («schifoooo») e le lettere scritte una alla volta riunite
   («m e r d a»).
4. **Le parole che sono anche posti** (Troia, Bastardo, Bad Ischl, Crap
   Sogn Gion, Boring, Noia) passano quando sono scritte con la maiuscola in
   mezzo alla frase. In minuscolo, tutte maiuscole o a inizio frase restano
   rifiutate.

**Perché così**: nessuna dipendenza, nessuna rete, la stessa risposta a
ogni prova, e la regola si legge e si corregge in un file solo. Sul server
non c'è un modello (manca Ollama), e un servizio esterno vorrebbe dire
mandare fuori i commenti, una scelta dell'utente.

**Limiti**: una critica gentile («un po' noioso», «dull») passa se la
parola non è nell'elenco. «Sei un Bastardo», con la maiuscola, passa come
il paese, e passa anche una lettera raddoppiata una volta sola («troiaa»).
Un commento affettuoso con una parola dell'elenco viene rifiutato: «Brutta
caduta, rimettiti presto». Per questi casi restano le segnalazioni.

**Scartato**: un modello che legga il tono (più memoria sul server, o un
servizio esterno: si può aggiungere dopo, con il sì dell'utente); pezzi di
parola («cazz…» blocca Cazzago); nascondere il commento in silenzio a tutti
tranne chi lo scrive (l'utente ha scelto l'avviso); riscriverlo in modo
gentile (non è più quello che la persona ha scritto).

**Conseguenze**: nessuna finché TASK-120 non chiama il filtro. Titolo e
descrizione delle corse pubblicate (TASK-208) non sono filtrati.

## ADR-0178 — «Find friends» in cima a «Feed»: la ricerca degli iscritti in una pagina sopra l'app
**Stato**: Attiva · 2026-10-03 · **scelta dell'utente** il posto; il resto
deciso dall'agente su delega dell'utente (TASK-215). Cambia la proposta di
`tasks/TASK-211.md` (la lente in «Profile»).

**Contesto**: l'utente, il 2026-10-03: «In feed, metti il tasto ricerca per
cercare gli amici». La ricerca degli iscritti per nome era nella parte B di
TASK-211, con una lente in «Profile»; l'API (`GET /users?q=`, ADR-0173) è
in `main` dalla #256. Il profilo di un altro (`UserProfilePage`, TASK-116)
c'era, ma nell'app non lo apriva niente.

**Decisione dell'utente**: il tasto per cercare gli amici sta in «Feed».

**Decisione dell'agente**:
1. **Un tasto largo in cima all'elenco di «Feed»**, a forma di campo: una
   lente disegnata con due `View` (l'app non ha icone) e «Find friends» in
   grigio. Scorre con i disegni. Non nell'intestazione delle pagine, che è
   la stessa per «Feed», «Draw» ed «Explore» e sta in `App.tsx`.
2. **Una pagina sopra l'app, come «Profile»** (`screens/PeopleScreen.tsx`),
   aperta da `ProfileLayer`, che ha l'account: una porta
   (`social/peopleDoor.ts`) come quelle di preferiti e disegni. Senza
   account il tasto apre «Profile» con il motivo sopra «Sign up», come il
   cuore dei preferiti.
3. **Il campo e i nomi sono un componente a sé** (`social/PeopleSearch.tsx`),
   che TASK-211 B e i tag di TASK-208 possono riusare. Cerca da 2 lettere,
   300 ms dopo l'ultima (come la ricerca del luogo, ADR-0080), o subito con
   il tasto della tastiera; mostra solo la risposta all'ultima richiesta.
4. **Il profilo si apre nella stessa pagina**; «←» torna ai nomi, che
   restano com'erano (la ricerca resta montata, nascosta). Un disegno
   aperto da quel profilo lascia la pagina nascosta dietro la mappa, e il
   suo «←» ci torna invece che a «Profile».
5. Un server senza la ricerca (prima della migrazione `0011`) risponde
   `404`: la pagina dice «This server cannot look for members yet.».

**Scartato**: la lente nell'intestazione solo su «Feed» (tocca `App.tsx` e
il `Pager`, e il posto a destra è di sport e profilo); il campo di ricerca
direttamente in «Feed» (la tastiera e i risultati in mezzo ai disegni);
aprire il profilo in «Profile» (il suo «←» porterebbe al proprio profilo,
non ai nomi trovati).

**Conseguenze**: TASK-211 B non fa più la ricerca: aggiunge «Follow» alla
pagina del profilo e «Requests», «Followers» e «Following» in «Profile».
I testi nuovi sono tradotti nelle quattro lingue (ADR-0172), da far
confermare con gli altri.

## ADR-0177 — Il motore sul telefono: Pyodide nella WebView, le zone come dati, il server come riserva
**Stato**: Attiva · 2026-10-03 · **scelte dell'utente** le sei di
`tasks/TASK-214.md`; il resto deciso dall'agente su delega dell'utente
(TASK-214, parti A e B).

**Contesto**: l'utente, il 2026-10-03, vuole che l'app usi «la potenza del
suo telefono, utilizzando anche la sua memoria, scaricando le mappe». La
prova di TASK-214: `route_engine` gira senza modifiche in Pyodide (Python
in WebAssembly) e dà lo stesso percorso del Python del Mac.

**Decisioni dell'utente** (risposte nel task file):
1. Pyodide entra, dentro l'app, a versione fissa.
2. Tutto il codice sta nell'app (Pyodide, i pacchetti, il motore) e si
   aggiorna con l'app; il telefono scarica solo dati, le zone, non in
   pickle (regole 2.5.2 e 4.7 di Apple).
3. Il telefono calcola solo zone sotto un limite di grandezza, da fissare
   con la misura sull'iPhone; se iOS chiude la WebView, la stessa richiesta
   va al server senza errori.
4. Fino a **2 GB** di zone: subito la zona intorno, poi le città vicine e
   le più cercate, con qualunque rete, anche i dati mobili.
5. Sul telefono le forme e le parole su strada, di corsa e in bici; al
   server l'AI, le zone, gli esempi, i luoghi, gli account, la canoa e le
   foto. Il telefono calcola prima se ha la zona; il server è sempre la
   riserva.
6. `route_engine` non cambia; le versioni delle librerie possono restare
   diverse da quelle del server, e uno script le confronta.

**Decisione dell'agente** (parte A):
1. **Le zone in un formato neutro** (`phone_zones.py`): JSON con gzip,
   nodi e archi con tutti i loro attributi, le geometrie come liste di
   coordinate, i nomi delle strade della zona. Si rilegge lo stesso grafo
   nello **stesso ordine**: i nodi, i successori e i predecessori di ogni
   nodo, le chiavi degli archi paralleli. Il motore scioglie i pareggi con
   quell'ordine (ADR-0162). Gli archi si scrivono in un ordine
   topologico dei vincoli «u prima di v fra i successori, e fra i
   predecessori», che ricostruisce entrambi con il solo `add_edge`.
2. **Il server scrive il file accanto alla zona** alla prima richiesta
   (`<zona>.zone.json.gz`), e di nuovo quando GraphML o pickle sono più
   recenti; `GET /phone-zones/{network}?lat=&lon=` dà la zona più piccola
   che contiene 3 km intorno al punto, con un ETag (`304` se il telefono
   ce l'ha). Nessun download da Overpass per il telefono.
3. **L'adattatore** (`on_phone.py`) riusa `RouteJobs`, `with_choices` e
   `RouteResultBody`: il telefono restituisce il JSON di
   `GET /route-jobs/{id}`. Niente FastAPI, thread né processi: il job
   corre dentro `submit`, le partenze vicine una dopo l'altra (tutte: il
   server lascia cadere quelle oltre la sua scadenza, ADR-0071).
   `to_request` è copiato da `app.py`, che importa FastAPI, e un test lo
   confronta.
4. **L'endpoint si installa in `__main__.py`**, dove c'è la cartella delle
   zone, non in `app.py`. Il server parte da lì, con `python -m
   shaperoute_api` (`Dockerfile`, `compose.yaml`); un test lo controlla.
5. **`python -m shaperoute_api.phone_zone_api`** scrive in anticipo i file
   di tutte le zone in cache: 0,7–0,8 GB e 20–30 minuti stimati sul server,
   un passo da fare con l'ok dell'utente, come `draw_examples`.

**Scartato**: il pickle del server (lega le versioni di NetworkX fra
server e telefono, ADR-0104, e può eseguire codice quando si legge); il
GraphML (sul telefono servirebbe OSMnx, e leggerlo richiede fino a un
minuto); ricostruire `_succ` e `_pred` direttamente (interni di NetworkX);
scaricare Pyodide o il motore dopo l'installazione (regole di Apple).

**Conseguenze**: la zona di Trento pesa 7,0 MB (7,9 il pickle con gzip).
Il server scrive un file in più per ogni zona chiesta da un telefono.

**Decisione dell'agente** (parte B, l'app; numeri in `tasks/TASK-214.md`,
«Esito»):
1. **Pyodide 314.0.7** (Python 3.14), non 0.28.3. In 0.28.3 Shapely 2.0.7
   fa fallire il `buffer` della stella da 5 km a Trento, e in Pyodide
   l'eccezione di GEOS è fatale per Python. In 314.0.7, con Shapely 2.1.2,
   la stella è identica al Mac, e numpy, networkx e Shapely sono più
   vicini al server. Resta GEOS 3.12.1: dopo un errore fatale la pagina
   riparte, e la richiesta va al server.
2. **Due zip non compressi fra gli asset dell'app**: `pyodide.zip` (21,2
   MB, nove pacchetti, il lock ridotto, gli SHA-256 scritti nello script)
   e `engine.zip` (0,6 MB, `route_engine` intero e i moduli che
   `on_phone` importa). Li scrive `tools/phone_engine/phone_engine.py`.
   `zip` è già un asset di Metro, quindi niente `metro.config.js`.
   **Stanno nel repository**, perché `eas update` pubblica il checkout
   pulito di `origin/main`. Il git cresce di 21 MB una volta, e di 0,6 MB
   (0,16 compressi) a ogni cambio del motore.
3. **Un test nella CI** (`tools/phone_engine/test_phone_engine.py`)
   confronta `engine.zip` con il codice. **Chi cambia `route_engine`, o un
   modulo dell'API che il telefono importa, rifà lo zip** con `python
   tools/phone_engine/phone_engine.py engine`: il telefono e il server
   hanno sempre lo stesso motore.
4. **`expo-asset` dichiarato** in `apps/mobile/package.json` (~57.0.18):
   porta gli zip sul disco del telefono. È già nell'albero come modulo
   dell'SDK, alla stessa versione: non scarica niente di nuovo (ok del
   coordinatore).
5. **La pagina legge da file**: XMLHttpRequest sugli zip (in WebKit
   `fetch` non legge `file:`), le richieste di Pyodide servite dalla
   memoria, ogni altro indirizzo rifiutato. La WebView legge solo la
   cartella comune a pagina, zone e zip. Funziona in **Expo Go**, senza
   build propria.
6. **Le zone sul telefono**: con il nome dell'API, un indice con ETag,
   peso e ultimo uso, `If-None-Match`; oltre 2 GB va via la meno usata. A
   ogni apertura le zone a piedi e in bici intorno alla posizione, con
   qualunque rete. Le scarica `downloadAsync` di `expo-file-system/legacy`:
   l'API nuova dei file non dà stato e intestazioni.
7. **Chi calcola**: il telefono prima, fino a 8 km a piedi e 30 km in
   bici; il server se il telefono non dà né un percorso né un verdetto del
   motore. Un verdetto (`shape_not_drawable`, `invalid_request`) si mostra
   subito, perché il server direbbe lo stesso. Oltre i limiti prima il
   server, e il telefono solo quando il server non risponde. Il telefono
   calcola le partenze vicine una dopo l'altra, senza la scadenza del
   server: un cuore da 10 km impiega 25–117 s sul Mac. I limiti si fissano
   con l'iPhone (parte D).
8. **La WebView si arrende in fretta**: una richiesta alla volta. Se iOS la
   chiude due volte durante un percorso, il telefono smette fino alla
   prossima apertura; chiusa mentre è ferma non conta.

**Scartato**: Pyodide 0.28.3 e 0.29.5 (Shapely 2.0.7); un `metro.config.js`
con `wasm`, `whl` e `mjs` fra gli asset (una configurazione per tutta
l'app, per niente); passare i file alla WebView con `postMessage` (base64,
tre volte la memoria); gli zip fuori dal repository, costruiti prima di
pubblicare; `File.downloadFileAsync` (né stato né ETag).

**Decisione dell'agente** (parte C, «Settings» e l'avviso del primo
download; testi e posto dell'avviso scelti dall'utente, `tasks/TASK-214.md`):
1. **Il peso vero** viene dal `Content-Length` della zona, letto al primo
   avanzamento di `createDownloadResumable` di `expo-file-system/legacy`:
   `downloadAsync` non lo dà, e una richiesta in più prima del download
   costerebbe tempo. Una risposta sotto 100 kB è un errore del server, non
   una mappa: non si annuncia.
2. **«La prima volta»** è un telefono senza zone all'apertura: dopo
   l'installazione o dopo «Delete». Non si salva niente in più. Le zone a
   piedi e in bici sono un numero solo, che cresce quando parte la
   seconda.
3. **I pesi in unità decimali**, come il limite di 2 GB: MB interi, mai
   «0 MB» per qualcosa che c'è, GB con un decimale da 1000 MB. «MB» e «GB»
   passano da `t()`, perché il francese scrive «Mo» e «Go».
4. **«Delete» non chiede conferma**: le zone si riscaricano da sole alla
   prossima apertura. Senza zone il pulsante non c'è. Il numero segue
   l'indice delle zone (`watchZones`) anche con la pagina aperta.
5. **I pezzi nuovi stanno in `src/engine/`**: in `SettingsPage.tsx` e in
   `App.tsx` entra una riga ciascuno, perché quei file li toccano anche
   altri task.

**Scartato**: l'avviso sotto la mappa (all'apertura non si vede); un
avviso a ogni download (l'utente ha detto di no); chiedere il peso con una
richiesta `HEAD` prima del download; una conferma su «Delete».

**Decisione dell'agente** (parte A2, il tetto del traffico, 2026-10-05; i
numeri sono dell'utente, `tasks/TASK-214.md`), deciso dall'agente su
delega dell'utente:
1. **Le zone in più si dichiarano** con `?prefetch=1` su
   `/phone-zones/{network}`; senza, la zona si dà sempre e non si conta.
   Il codice sta in un file nuovo, `phone_zone_cap.py`; `__main__.py` non
   cambia: `install_phone_zones` prende il tetto dell'utente da solo.
2. **Il conteggio è in memoria, per giorno UTC**: niente database, niente
   migrazione. **Un riavvio dell'API riparte da zero**, e un giorno con un
   riavvio può dare un po' di più del tetto. Con un solo processo uvicorn,
   com'è oggi sul server, il conteggio è uno; con più processi ognuno
   avrebbe il suo.
3. **Si contano i byte del file**, prima di mandarlo: una zona che farebbe
   passare il tetto si rifiuta intera, così il tetto non si supera mai. Un
   download interrotto resta contato. Un `304` non costa niente e passa
   anche oltre il tetto.
4. **`Retry-After` dice i secondi fino alla mezzanotte UTC**, quando il
   conteggio riparte: «il telefono riprova il giorno dopo». L'app aspetta
   quei secondi, mai più di un giorno, e un giorno se l'header manca.
5. **Il telefono è un id anonimo** in `X-Phone-Id`: 32 cifre esadecimali a
   caso, fatte dall'app la prima volta e tenute in
   `Documents/engine/prefetch.json` (fuori dalle zone: «Delete» non lo
   cambia). Non è un segreto né un'identità: `Math.random` basta, senza
   dipendenze nuove. Il server lo tiene solo in memoria, per il giorno,
   e non lo scrive. Chi cambia id a ogni richiesta trova comunque il tetto
   di tutto il server.
6. **Senza un id valido conta l'indirizzo** della richiesta, come il
   limite dei POST (ADR-0076): sul server è quello del telefono, che Caddy
   passa in `X-Forwarded-For` (`FORWARDED_ALLOW_IPS` in `compose.yaml`).
   Con i dati mobili molti telefoni escono dallo stesso indirizzo e
   dividerebbero un tetto: non succede, perché solo l'app nuova manda
   `prefetch=1`, e la manda sempre con l'id.

**Scartato**: contare solo per indirizzo (con i dati mobili molti
telefoni escono dallo stesso indirizzo); contare nel database (una migrazione per un numero che vale un
giorno); un tetto solo sul telefono (un'app difettosa non lo rispetta);
rifiutare solo quando il tetto è già passato (lo si supererebbe di una
zona).

**Decisione dell'agente** (parte B2, le zone in più, 2026-10-05; 2 GB,
qualunque rete e nessun avviso sono scelte dell'utente, e così partire
senza la #323), deciso dall'agente su delega dell'utente:
1. **Le città «più cercate» sono quelle di «Explore»**: prima le ultime
   scelte sul telefono (`recent-cities.json`), poi le 14 in evidenza
   dalla più vicina. Il server sa quali città si cercano di più (gli
   eventi di TASK-130), ma darle all'app vorrebbe un endpoint nuovo e un
   aggiornamento del server. Le città vicine (TASK-236, `GET
   /nearby-cities`) vanno in testa (parte B2b, dopo la #323), con la
   cache per quadrato di `nearbyCities.ts`, la stessa di «Explore». Se non
   rispondono, il giro non le aspetta: le richiede il giorno dopo, come
   chiede un server senza `/nearby-cities`.
2. **Il centro di una città in evidenza** lo dà `GET /cities`, come al
   tocco del chip, una volta per telefono: poi resta in
   `Documents/engine/ahead.json`. I centri non si scrivono nel codice
   (`presets.ts` tiene solo i nomi), e il server tiene le risposte un
   giorno: 14 città costano a Geoapify al massimo 14 richieste al giorno.
3. **Solo la rete dello sport** di «Settings», a piedi con la canoa.
4. **Una città già dentro una zona salvata non si chiede**, nemmeno con
   l'ETag: la zona si aggiorna quando il telefono si apre lì. Un giro
   costa così solo le città che mancano.
5. **Un giro intero al giorno al massimo**, segnato in `ahead.json`;
   un giro interrotto riprende alla prossima apertura. Parte solo se il
   server ha appena dato la zona intorno al telefono (salvata o `304`):
   con un server senza zone per il telefono, o senza rete, non si chiede
   niente.
6. **Le zone in più entrano come «mai usate»** (`usedAt` 0) e il giro si
   ferma a 100 MB dai 2 GB. Così oltre il limite se ne va prima una zona
   in più che quella intorno al telefono, e due giri non si cancellano a
   vicenda le zone per farsi posto.
7. **L'app con B2 si pubblica solo con il server che ha A2** (c'è dal
   2026-10-05, `fd14cd3`): senza il tetto un telefono scaricherebbe
   tutte le zone in più in un giorno. Meglio dopo aver scritto le zone del
   telefono sul server (parte D): se no le scrive la prima richiesta di
   ogni zona, circa 50 s di calcolo per Milano.

**Scartato**: un endpoint con le città più cercate (API nuova e server
da aggiornare, per un ordine che «Explore» dà già); scaricare tutte e
due le reti (le zone bici sul server sono poche, il traffico
raddoppierebbe); richiedere ogni giorno con l'ETag le zone già salvate
(richieste per niente); cancellare zone in più per farne entrare altre
(i giri si inseguirebbero); aspettare qualche minuto dopo l'apertura (chi
apre l'app per poco non scaricherebbe mai).

## ADR-0170 — Pubblicare come su Strava, l'API: chi lo vede in tre valori, una domanda sola per saperlo, foto in posti fissi, campi nuovi che un'app di prima non cancella
**Stato**: Attiva · 2026-10-03 · deciso dall'agente su delega dell'utente
(TASK-208, parte A), dentro le **scelte dell'utente** del 2026-10-03:
descrizione con «How did it go?»; iscritti taggati cercati per nome; fino a
tre foto oltre alla mappa; «Who can see it» con «Everyone», «Followers» e
«Only me», dove «Followers» è chi segue con la richiesta accettata
(ADR-0173). Tre altre **scelte dell'utente**, chieste durante il task: la
descrizione **non passa dal filtro dei commenti negativi** (ADR-0176); la
canoa va su Strava come `StandUpPaddling`; **le foto restano sul telefono
finché la corsa è «Only me»** (usare la memoria dei telefoni più di quella
del server). Numero tenuto dal coordinatore.

**Contesto**: fino a TASK-117 un disegno aveva solo `title` e `public`
(ADR-0159); l'app del 2026-10-03 (ADR-0166) manda `{title, public}` e deve
continuare a funzionare con l'API nuova. I commenti (TASK-120, PR #260)
chiedono chi vede un disegno con `d.public OR r.user_id = …`, e possono
entrare in `main` prima o dopo questa parte.

**Decisione**:
1. **`visibility`** (`everyone`, `followers`, `only_me`) al posto di
   `public`: la migrazione porta `true` a `everyone` e `false` a `only_me`.
   **`public` resta** come colonna generata (`visibility = 'everyone'`),
   mai scritta, così l'SQL scritto prima funziona in qualsiasi ordine di
   merge: sbaglia per difetto, non lascia uscire niente. `comments.py` di
   #260, entrato prima, passa in questa parte alla domanda nuova (punto 2).
2. **Una domanda sola** per «chi può vedere questo disegno»:
   `drawings.drawing_seen_sql(viewer)`, una condizione SQL su `drawings d
   JOIN runs r ON r.id = d.run_id`: il proprietario sempre; gli altri se
   `everyone`, o se `followers` e `follows_sql` (ADR-0173) dice che lo
   seguono, accettati. `viewer` si legge una volta sola (un `%s`, un
   valore), così chi la usa non conta i segnaposti. Disegno, foto e
   commenti la seguono; il profilo ne ha una sua, `shown_sql`, perché lì
   anche il proprietario vede solo i pubblicati (ADR-0159, punto 8).
3. **Il numero sul profilo è quello che chi guarda vede**: `PublicProfile.
   drawings` e `total` della griglia contano gli stessi disegni. Un numero
   solo per tutti direbbe a chi non segue quanti disegni ha per i suoi
   follower, e non tornerebbe con la griglia.
4. **Il `PUT` del disegno resta la scelta intera per l'app nuova**, ma
   `description`, `activity` e `tags` **assenti restano come sono**: un'app
   di prima manda solo `title` e `public`, e non deve cancellare quello
   che un'app nuova ha scelto sullo stesso account. Il titolo assente si
   toglie, come prima. `visibility` e `public` insieme sono `422`:
   una regola sola per chi vede, mai due che si contraddicono.
5. **`published_at`** è da quando gli altri lo vedono: passare fra
   `everyone` e `followers` non lo ripubblica, tornare da `only_me` sì.
6. **Le foto in posti fissi**, da 1 a 3: `PUT` e `DELETE
   /me/activities/{key}/drawing/photos/{n}`. Svuotare un posto non sposta
   le altre: un `DELETE` rimandato da una coda senza rete non cancella mai
   un'altra foto, e un `PUT` rifatto non ne aggiunge una quarta. La
   quarta è un posto che non c'è (`422`).
7. **Le foto come la foto del profilo** (ADR-0146): base64 dentro JSON,
   raddrizzate con l'EXIF, ridotte dall'API e salvate come JPEG nuovo,
   senza EXIF, nel database (ADR-0115). **1080 px sul lato lungo**, mai
   ingrandite, qualità 82: la larghezza di un telefono; una foto vera pesa
   0,1–0,3 MB, il peggio misurato (rumore puro) 0,8 MB, e il vincolo del
   database tiene fino a 2 MB. 20 `PUT` al minuto per account.
   **Sul server solo mentre altri vedono il disegno** (scelta dell'utente):
   con `everyone` o `followers`. Su una corsa senza disegno, o `only_me`,
   il `PUT` è `409 http_error` («Photos stay on the phone while only you
   see this run: choose Everyone or Followers first.»); rimettere
   `only_me` cancella le foto dal server, nella stessa transazione del
   disegno. Le tiene il telefono, e le rimanda quando il disegno si apre
   di nuovo agli altri (parte B). Il `PUT` della foto e quello del disegno
   bloccano la stessa corsa: una foto non arriva mai su un disegno appena
   tornato `only_me`. Così il server tiene solo quello che serve agli
   altri, e le foto delle corse private non pesano su di lui né sulle sue
   copie.
8. **Le foto si leggono da un indirizzo**, `GET /drawings/{id}/photos/{n}`,
   come JPEG, con il token: nel disegno ci sono solo `n`, `url`, `width` e
   `height`. Il base64 dentro ogni disegno farebbe una griglia di 20
   disegni pesante 10 MB o più. `url` porta `?v=` con l'ora della foto,
   così una foto cambiata ha un indirizzo nuovo e la cache del telefono
   (`private`, un giorno) non mostra quella di prima.
9. **I tag**: una tabella `drawing_tags` con l'account (`ON DELETE
   CASCADE`: cancellato l'account taggato, il nome sparisce) e la
   posizione. Un id che non è un iscritto, sé stessi, due volte lo stesso:
   `422`, con il motivo. Si tagga ogni iscritto, come cerca la ricerca di
   TASK-211; chi è taggato **non vede di più**: vale la visibilità del
   disegno (il task file, punto 3). Nessuna notifica (TASK-185).
10. **L'attività è della corsa**, `runs.activity`: il `PUT` della corsa la
    prende al primo invio (per difetto `running`, ogni corsa di prima), il
    disegno la cambia. Va a Strava come `sport_type`: `Run`, `Ride`, e
    `StandUpPaddling` per la canoa (**scelta dell'utente**, fra `Canoeing`,
    la proposta, `Kayaking` e `StandUpPaddling`). Prima bici e canoa
    arrivavano su Strava come «Run». Non cambia il punteggio.
11. **Strava prende anche la descrizione**: il corpo di `POST
    /me/activities/{key}/strava` ha `description`, come `name`, perché
    l'app manda Strava prima del disegno (ADR-0166); senza, quella del
    disegno. Sopra la riga di Sgrava («Drawn with Sgrava»), dopo una riga
    vuota. Le foto no.
12. **La descrizione non è filtrata** (scelta dell'utente): è il racconto
    della propria corsa, e «gambe pessime oggi» verrebbe rifiutata; una
    descrizione rifiutata dentro la coda senza rete si scoprirebbe quando
    l'avviso non serve più. Al più 500 caratteri, gli a capo restano.

**Scartate**: togliere `public` dalla tabella (romperebbe #260 se entra
dopo, o questa parte se entra prima); `drawing_seen_sql` con il
segnaposto ripetuto (chi la usa dovrebbe passare lo stesso valore tre
volte); le foto in ordine che si compatta (un `DELETE` rimandato
cancellerebbe la foto dopo); le foto in base64 dentro il disegno (sopra);
la foto a 256 px come quella del profilo (troppo piccola a tutto
schermo); un `PATCH` per i campi nuovi (l'app di prima usa già il `PUT`);
dare a chi è taggato il diritto di vedere un disegno `followers` o
`only_me` (non è nel task file: da chiedere all'utente se serve); tenere
sul server anche le foto delle corse private (la proposta di prima:
l'utente ha scelto il telefono); le corse private solo sul telefono (pesano
circa 50 KB l'una, servono a punteggio, Strava e a un secondo telefono:
scartato dall'utente); foto a 720 px (la qualità a tutto schermo).

**Conseguenze**: una migrazione nuova (`00NN_drawing_details.sql`, il
primo numero libero in `main` al merge), un modulo nuovo
(`drawing_photos.py`); `profiles.py` conta i disegni per chi guarda;
`strava_client.upload` prende `sport_type`; `comments.py` (TASK-120) passa
a `drawing_seen_sql`, così chi segue legge anche i commenti di un disegno
«Followers». Con «Only me» le foto esistono solo sul telefono: cancellando
l'app o cambiando telefono si perdono. La parte B propone un avviso, con il
testo da confermare con l'utente (`tasks/TASK-208.md`). Le foto pesano sul
server: nel database e in ognuna delle 13 copie di notte (TASK-122), stima
in `tasks/TASK-208.md`, «Note per il
deploy». Niente sul server né sul telefono senza la parte B e l'ok
dell'utente.

**Parte B, l'app** (2026-10-06; deciso dall'agente su delega dell'utente,
dentro le **sei proposte confermate dall'utente** lo stesso giorno: «Only
me» a ogni corsa, «Activity» dallo sport di «Settings», Strava senza foto,
lo stesso modulo in «My activities», 10 tag e 500 caratteri, i testi; e
il suo **sì** ai sei file fuori dall'elenco del task e alla dipendenza
nuova):
1. **Una scelta sola, intera** (`DrawingChoice`: titolo, descrizione,
   attività, tag con i nomi, visibilità) in ogni posto dove prima c'erano
   `title` e `public`: la coda delle corse, quella dei disegni, la porta
   dei disegni. I file scritti dall'app di prima (`{title, public}`) si
   leggono ancora e si fanno interi (`choiceFrom`). Niente va all'API con
   niente di scelto, come prima; una corsa che non è una corsa (bici,
   canoa) conta come scelta, perché l'API tiene ogni corsa per corsa
   finché non glielo si dice.
2. **Le foto in un file per foto**, base64 già ridotto
   (`drawing-photo-{account}-{chiave}-{posto}.b64`), con un elenco
   (`drawing-photos.json`, scritto come le code di TASK-252) che dice per
   ognuna se l'API l'ha (`sent`) e se un posto è stato svuotato qui mentre
   l'API l'ha ancora (`removed`). Non dentro il JSON della coda (una corsa
   con tre foto sarebbe un file da 1 MB riscritto a ogni corsa) e non in
   un `.jpg` (il base64 serve così com'è per il `PUT`, e il mock dei test
   legge testo). Il `data:` URI basta all'`Image`.
3. **La sincronizzazione delle foto viene sempre dopo un `PUT` del
   disegno riuscito**, con la visibilità appena confermata: con «Only me»
   l'API le ha cancellate e si segnano tutte `sent: false`; se no vanno i
   posti non ancora sull'API e si svuotano quelli `removed`. Un `409` (per
   l'API il disegno è ancora `only_me`), la rete che manca o l'API occupata
   lasciano la foto **e il disegno** in coda: il prossimo giro rifà il
   `PUT` del disegno (innocuo) e riprova le foto. Un `422` (non è una foto)
   la butta. L'app non distingue il `409` dal `404` (l'errore dell'API non
   porta lo stato HTTP): dopo un `PUT` del disegno riuscito un `404` non
   può venire, quindi `http_error` dopo il disegno è il `409`.
4. **Il disegno va all'API prima di Strava**: Strava prende descrizione e
   tipo dal disegno (ADR-0170, punti 10 e 11), così il corpo di Strava
   resta com'era (`name`, `post`). Prima era il contrario (ADR-0166).
5. **Le foto si riducono sul telefono** con `expo-image-manipulator`
   (dipendenza nuova, pacchetto dell'SDK di Expo, dentro Expo Go; ok
   dell'utente): 1080 px sul lato lungo, JPEG a qualità 0,8, senza EXIF,
   come farebbe l'API. Così il telefono tiene 0,1–0,3 MB a foto invece di
   1–2 MB, e il `PUT` pesa altrettanto. Il picker non ritaglia (una foto
   di una corsa è quella che è), al contrario di quello del profilo.
6. **Il modulo scorre in un riquadro**: metà schermo a fine corsa, 40 %
   sulla scheda di «My activities», con «Save» e «Discard» fuori dal
   riquadro, sempre in vista. Il foglio sotto la mappa non scorre da sé, e
   sei campi più Strava lo farebbero uscire dallo schermo.
7. **I tag con la ricerca di TASK-215** in un foglio dal basso
   (`TagPeople.tsx`), che prende l'API e l'account da `FollowsContext`:
   per questo il contesto, che stava solo intorno a «Profile», sta anche
   intorno all'app (una riga in `ProfileLayer.tsx`), e lo stesso contesto
   dà a un nome taggato il modo di aprire il profilo.
8. **La risposta del `PUT` del disegno viene ripulita dei posti svuotati**
   prima di tornare alla scheda: arriva prima che il `DELETE` della foto
   parta, e mostrerebbe di nuovo la foto appena tolta.

**Scartate (parte B)**: un contesto nuovo per l'account (c'è già
`FollowsContext`); mandare le foto con `activity` nel `PUT` della corsa
(il task dice «prima il disegno, poi le foto»); riusare il picker del
profilo (ritaglia al quadrato); un «Modifica» che apre il modulo sulla
scheda (il task vuole lo stesso modulo, in vista).

**Da fare dopo**: cancellato l'account, i file delle foto restano sul
telefono (`forgetAllPhotosOf` c'è, `useAccount.ts` non è del task);
l'aspetto sull'iPhone.

## ADR-0181 — Le immagini ufficiali di Strava: il pulsante «Connect with Strava» e «Compatible with Strava» dal pacchetto di Strava, mai ridisegnate
**Stato**: Attiva · 2026-10-03 · deciso dall'agente su delega dell'utente
(TASK-218). Usare le immagini ufficiali di Strava al posto del pulsante di
solo testo, e il logo di Strava accanto a «Send to Strava», è scelta
dell'utente («ok perfetto», 2026-10-03); il resto, qui sotto, è
dell'agente.

**Contesto**: «Connect with Strava» (TASK-187, ADR-0156) era un pulsante
disegnato dall'app, arancione `strava` con il testo bianco tradotto; a
fine corsa e in «Settings» non c'era nessun logo di Strava. Le regole del
marchio (developers.strava.com/guidelines, riviste il 2025-09-29) dicono:
il pulsante «Connect with Strava», se un'app lo usa, è quello del loro
pacchetto (arancione o bianco, 48 px a 1x) e porta all'`oauth/authorize`;
per dire che un'app lavora con Strava si usa «Powered by Strava» o
«Compatible with Strava»; i loghi non si modificano né si animano, non
fanno da icona dell'app, stanno separati dal nome e dal logo dell'app e
non più in vista di loro.

**Decisione**:

1. **Il pulsante è l'immagine di Strava** `btn_strava_connect_with_orange`
   (pacchetto `1.1-Connect-with-Strava-Buttons.zip`), 237 × 48 pt, in
   `assets/strava/connect-with-strava.png` con `@2x` e `@3x`. 1x e 2x
   sono i PNG del pacchetto; il 3x è lo stesso SVG del pacchetto
   rasterizzato a 3x, senza ritocchi, perché il pacchetto non ha un 3x e
   l'iPhone è a 3x. È lo stesso componente nei tre posti che lo usano (fine
   corsa, «Settings», la corsa aperta in «My activities»).
2. **Mentre si apre Strava il pulsante resta com'è** (niente opacità,
   che lo altererebbe) e accanto gira una rotellina; il tocco è spento.
3. **Accanto a «Send to Strava» il logo «Compatible with Strava»**
   (pacchetto `1.2-Strava-API-Logos.zip`): è quello per le app che mandano
   attività a Strava; «Powered by Strava» è per chi mostra dati di Strava, e
   un logo di Strava da solo nel pacchetto non c'è. Versione **bianca**
   orizzontale, perché l'app è scura: quella arancione ha «COMPATIBLE WITH»
   in nero, illeggibile sul fondo. Alto 16 pt (189 × 16), sotto le parole
   dentro l'interruttore; 1x, 2x e 3x rasterizzati dall'SVG del pacchetto.
4. **VoiceOver**: il pulsante si chiama `t("Connect with Strava")` (o
   `t("Opening Strava…")` mentre si apre), già tradotti; il logo dentro
   l'interruttore non si legge da solo, perché l'interruttore ha già il suo
   nome («Send to Strava»). Nessun testo nuovo nelle tabelle.
5. **Nessun colore nuovo**: i colori di Strava stanno dentro le sue
   immagini. I token `strava` e `onStrava` restano in `tokens.ts` senza
   uso: `tokens.ts` è nei file di TASK-206, si tolgono quando è libero.

**Perché così**: le regole di Strava vogliono le sue immagini com'è, e
un'immagine non si può tradurre né ridisegnare; nessuna dipendenza nuova
(`react-native-svg` non c'è, quindi PNG a tre scale). Un test legge
l'intestazione di ogni PNG e controlla che 1x, 2x e 3x abbiano la misura
mostrata: un'immagine sostituita male si vede subito.

**Scartato**: tradurre il pulsante (le regole non lo permettono, e il
pacchetto è solo in inglese); la versione bianca del pulsante (l'utente
aveva scelto l'arancione in TASK-187); «Compatible with Strava»
accanto alle parole, sulla stessa riga (in tedesco non ci sta); un logo
in `docs/brand/` (quella cartella è di Sgrava).

**Conseguenze**: il pulsante dice «CONNECT WITH STRAVA» in ogni lingua
dell'app. TASK-208 B, che rifà la fine della corsa, tiene
`StravaSwitch` e `ConnectWithStrava` di `StravaParts.tsx`. Si vede sul
telefono con la prossima pubblicazione dell'app (ok dell'utente) e solo
quando il server ha Strava.

## ADR-0182 — «Find friends» è solo una lente; inviti, contatti e Facebook a tappe, Strava no
**Stato**: Attiva · 2026-10-03 · **scelta dell'utente** la lente sola e
l'ordine delle tappe; il posto della lente deciso dall'agente su delega
dell'utente (TASK-219). Supera il punto 1 di ADR-0178.

**Contesto**: provato «Find friends» (TASK-215), l'utente, il 2026-10-03:
«deve esserci solo un emoji del trova», e sotto la ricerca «la possibilità
di collegare Facebook, invitare gli amici, numero di telefono e trovare gli
amici così», poi «anche il loro profilo Strava».

**Decisione dell'utente**:
1. Il tasto è **solo la lente**, senza testo.
2. **A tappe**: prima la lente; poi gli amici dai contatti; Facebook per
   ultimo, quando Sgrava è sull'App Store (TASK-152).
3. **«Invite friends» aspetta l'App Store**: finché non c'è un link che
   funzioni per tutti, nessun invito (scartati il link di Expo Go e un
   messaggio senza link).

**Decisione dell'agente**:
1. La lente è un **cerchio come quello di «Profile»**, in cima all'elenco di
   «Feed», **a destra**, sotto il bottone di «Profile». Non
   nell'intestazione delle pagine: i nomi «Feed · Draw · Explore» più tre
   cerchi da 44 pt non ci stanno su un iPhone da 390 pt.
2. VoiceOver la legge «Find friends»: il testo resta, solo per lui.

**Cosa serve alle tappe dopo** (da scegliere con l'utente quando partono):
- **Contatti**: il numero di telefono nell'account (TASK-183, «a cosa serve
  il numero»: a farsi trovare dagli amici), la sua verifica con un SMS (un
  servizio a pagamento; senza, chiunque può scrivere il numero di un altro),
  la dipendenza `expo-contacts` (va in Expo Go) e una riga della privacy:
  i numeri della rubrica arrivano al server, da mandare come impronta e mai
  tenere.
- **Facebook**: l'SDK di Facebook non va in Expo Go, solo in una build
  propria; un'app sviluppatore su Meta e la revisione di Meta per
  `user_friends`, che dà solo gli amici che hanno collegato anche Sgrava.
- **Strava: non si può.** L'API di Strava non ha più gli elenchi di amici e
  follower (`/athlete/friends` risponde 401), e dal 1° settembre 2026 ha
  tolto anche i membri dei club.

## ADR-0179 — La navigazione in bici: km/h, la voce ogni 10 km, svolte e tratti a mano detti 100 m prima
**Stato**: Attiva · 2026-10-03 · **scelte dell'utente** km/h al posto del
passo, la voce ogni 10 km, le frasi e i nomi dei numeri; la distanza degli
avvisi **decisa dall'agente su delega dell'utente**, misurando (TASK-216).

**Contesto**: fino a TASK-216 «Start» su un percorso in bici apriva la
navigazione della corsa: il passo al km, la voce a ogni km, le svolte dette
50 m prima (`ANNOUNCE_M`, circa 15 s di corsa; a 20 km/h sono 9 s), e fra le
lettere di una parola a penna alzata «Walk to the U». L'app non sapeva
l'attività del percorso seguito.

**Decisione dell'utente** (2026-10-03, `tasks/TASK-216.md`):
1. In bici la schermata mostra la **velocità in km/h** dove la corsa mostra
   il passo: «Speed now», «Avg speed», «Last km», la colonna «Speed» dei km
   di «Data» (IT «Vel. ora», «Vel. media», «Ultimo km», «Velocità»).
2. La voce dice i km **ogni 10 km**, con tempo e velocità media a numero
   intero, detta a parole: «10 kilometres. Time: 25 minutes 10 seconds.
   Average speed: 24 kilometres per hour.» · «10 chilometri. Tempo: 25
   minuti e 10 secondi. Velocità media: 24 chilometri orari.» (scartati il
   tempo senza secondi e «km/h» scritto, che la voce del telefono può
   leggere male).
3. Fra le lettere si pedala: «… km riding between them» · «… km in bici fra
   una lettera e l'altra», «Letter done. Ride to the U: the drawing is
   paused.» · «Lettera finita. Pedala fino alla U: il disegno è in pausa.»

**Decisione dell'agente**:
1. **Le svolte in bici si dicono 100 m prima** (`RIDE_ANNOUNCE_M` in
   `src/navigation/ride.ts`), e alla stessa distanza **i tratti con la bici
   a mano** (`ON_FOOT_AHEAD_M`, che esistono solo in bici). Misurato il
   2026-10-03 sul Mac, senza rete, sulle zone di Trento in cache: 21
   percorsi in bici da 10 km e 40 di corsa da 5 e 10 km (cuore, cerchio,
   stella, luna, gatto, pesce, farfalla da Piazza Duomo, Le Albere e Povo),
   le indicazioni come le calcola l'API (`guidance`), 1.664 e 3.202 svolte
   dette. In bici le svolte distano in mediana **99 m** (7,8 al km), nella
   corsa 68 m (11,4 al km). Il tempo fra l'inizio della frase e la svolta,
   in mediana: corsa a 5:30 /km con 50 m **16,5 s**; bici a 20 km/h con 50 m
   9,0 s, con 80 m 14,4 s, con **100 m 16,1 s**, con 120 o 150 m ancora
   16,1 s. Oltre 100 m la mediana non cresce, perché metà delle svolte è
   più vicina della precedente: si allunga solo la strada in cui si
   incrociano vie laterali prima di quella giusta, e cala la parte di
   svolte dette alla distanza piena (45% a 100 m, 24% a 150 m). La frase
   dura 3,0–3,3 s, 5,4–5,7 s con un «poi» (voci Samantha e Alice di macOS):
   a 20 km/h con 100 m restano 13 s per la svolta, come nella corsa. A
   25 km/h la mediana è 12,9 s. Script e numeri in
   `out/task216-bike-announce/` (fuori dal repository).
2. **L'attività arriva alla navigazione dal percorso, non da «Settings»**:
   da «Draw» quella della richiesta, da un preferito quella con cui è stato
   tenuto (ADR-0160, TASK-200), da «Explore» quella
   dell'esempio (oggi sempre la corsa). Una bici è solo `cycling`: la corsa,
   la canoa (TASK-191 C) e un percorso senza attività si seguono come prima.
3. **La corsa resta identica**: stesse frasi, stessi numeri, stessi testi
   (in inglese anche con l'app in un'altra lingua, finché TASK-210 non
   traduce la schermata). I testi nuovi della bici passano da `t()`, i
   numeri restano col punto come gli altri della schermata.
4. **I km di «Data» in bici**: la velocità di ogni km a un decimale e la
   differenza col km prima in km/h («-4.0» più lento, «+1.5» più veloce);
   le barre come nella corsa.

**Conseguenze**: TASK-217 aggiunge alla frase dei 10 km il confronto coi 10
precedenti, da 20 km. Restano come nella corsa, da chiedere all'utente:
la fine della corsa (il passo nel riepilogo), le calorie (stimate per la
corsa, circa il triplo di quelle in bici), l'incitamento dopo 5 km (in bici
non c'è: i 5 km non si dicono), la corsa senza percorso in bici.

## ADR-0183 — «Run without a route» è giallo
**Stato**: Attiva · 2026-10-03 · **scelta dell'utente** (TASK-220). Fa
un'eccezione alla regola 1 dei colori di `UI.md` (ADR-0046 e seguenti: il
giallo è del percorso e del comando che lo produce).

**Contesto**: l'utente, il 2026-10-03: «il pulsante fallo giallo», del
pulsante «Run without a route» in cima a «Draw». Fino a qui era neutro,
su `surfaceRaised` con il bordo `borderStrong`, perché non produce un
percorso.

**Decisione dell'utente**: il pulsante è **giallo**, anche come «Ride
without a route» con «Bike».

**Decisione dell'agente**: fondo `accent` e testo `onAccent` (13,5:1),
senza bordo, come «Draw route»; nessun token nuovo. L'eccezione vale **solo
per questo pulsante**: gli altri comandi restano neutri.

**Conseguenze**: nella pagina «Draw» ci sono due comandi gialli, in alto
e in fondo; «Draw route» resta spento finché la richiesta non è completa,
quindi all'apertura il giallo pieno è quello in alto. Il commento di
`accent` in `src/theme/tokens.ts` dice ancora «una cosa sola»: da
aggiornare con il prossimo task che tocca quel file.

## ADR-0185 — Le forme a pezzi: un file solo, con la penna alzata o giù
**Stato**: Attiva · 2026-10-03 · **deciso dall'agente su delega
dell'utente** (TASK-223, parte A). Quali forme entrano nel catalogo, e se
la penna alzata è accesa di partenza, restano dell'utente (ADR-0036).

**Contesto**: l'utente, il 2026-10-03: «Trova da fare emoji molto più
semplici da aggiungere al catalogo, metti anche la possibilità di fermare
il tratteggio». Le emoji semplici hanno spesso parti staccate (gli occhi di
una faccina, il buco di una ciambella). Fino a oggi un dettaglio interno era
un tratto (`strokes`, ADR-0039) che parte dal contorno: gli occhi di gatto
e cane sono attaccati alla testa da una linea percorsa due volte. Le parole
hanno già la penna alzata (TASK-197, ADR-0157).

**Decisione**:
1. **`pieces` nel JSON di un contorno**: linee staccate da tutto, anelli o
   linee aperte. Lo stesso file serve ai due modi; non due file per forma.
2. **Penna alzata**: la forma è una parola a penna alzata, una «lettera»
   per il contorno e una per ogni pezzo (`pieces.compose`). Ricerca,
   tracciamento, tratti a piedi, somiglianza, GPX con «Pause»/«Resume»
   sono quelli di TASK-197: niente di nuovo da spiegare all'app, che già
   tratteggia i `walks` e mette in pausa.
3. **Penna giù**: ogni pezzo si attacca da solo con il collegamento più
   corto e diventa un tratto. Chi disegna una forma scrive solo i pezzi,
   senza inventare dove attaccarli.
4. **Le forme di oggi con gli occhi** (chiesto dall'utente al coordinatore:
   «gli occhi interni senza linee di collegamento»): i loro occhi restano
   tratti appesi al contorno, così con la penna giù il percorso è lo stesso
   punto per punto. Una riga nel file dice quali tratti con la penna alzata
   si **staccano**: `"lift": [1, 2]`, i numeri dei tratti, da 1. Di un
   tratto staccato si disegna solo l'anello, con ciò che ci è appeso, e il
   collegamento no. Si staccano solo tratti che chiudono un anello, e niente
   può essere appeso al collegamento. Gatto `[1, 2]`, pesce `[1]`, teste di
   cane e coniglio `[1, 2]` (gli occhi: naso e bocca restano attaccati, la
   bocca pende dal collegamento del naso), zucca `[1, 2, 3]`.
5. **I pezzi sono dettagli**: con la penna alzata zone e corridoio dimezzati
   come per i tratti, e un anello tracciato chiuso. Le parole non cambiano.
6. **Un'«altezza di lettera» di una forma a pezzi è un quarto del suo
   lato** (`PIECE_HEIGHT`): così la tolleranza della somiglianza è circa
   quella delle forme (1% del perimetro di un cerchio), e un pezzo si sposta
   al massimo di 1/16 del lato.
7. **Il catalogo non cambia** in questo passo: i candidati si provano dalla
   CLI finché l'utente non li giudica, e le forme con gli occhi staccati
   con la penna alzata solo dalla CLI (`--shape cat --pen-up`).

**Alternative scartate**: pezzi attaccati a mano nel file (più lavoro per
ogni forma, e due versioni da tenere allineate); un tracciamento nuovo per
le forme a pezzi (TASK-197 lo fa già per le lettere); zone e corridoio del
disegno intero come per le lettere (gli occhi venivano a «P», la faccia non
si chiudeva).

**Conseguenze**: TASK-226 (gli occhi staccati sull'acqua) trova gli occhi
di gatto, pesce, teste e zucca già staccabili (`lift`), e una forma nuova li
scrive come `pieces`. Le forme e le parole di oggi danno lo stesso percorso
di `main` a b87d8cc, punto per punto (`tests/test_pieces_before.py`). Per chiedere una forma a pezzi con la
penna alzata all'API servono il contratto (`pen_up` oggi è solo per le
parole) e l'app: la parte B di TASK-223.

**Parte B, il catalogo** (2026-10-04, TASK-223 B, **deciso dall'agente su
delega dell'utente**). Le quattro forme sono il «sì» dell'utente sui
campioni; la penna alzata accesa di partenza e la frase della voce sono le
proposte del task file, applicate sul «continua e pubblica» dell'utente e
da confermare sul telefono. **Confermate dall'utente** il 2026-10-05
(«confermo le frasi della voce e la penna accesa»).

8. **Nel catalogo** faccina (`smiley`), fantasmino (`ghost`), ciambella
   (`donut`) e sole (`sun`), in coda a `SHAPES` e al contratto.
9. **`pen_up` anche con una forma**, se ha pezzi (`shapes.in_pieces`:
   `pieces` o `lift`), e solo su strada: altrimenti `invalid_request` con
   il motivo (`… or the pieces of a shape; heart has none`, `on the water a
   shape is drawn with the pen down`, finché TASK-226 non mette i pezzi
   sull'acqua). Il contratto le elenca in `PEN_UP_SHAPES`: le quattro e le
   cinque con gli occhi staccabili, che l'app per ora non offre. Il
   risultato tiene `shape`, con i `walks` come una parola.
10. **Fino a 8 tratti a piedi** in un risultato, un preferito o una corsa
   (`MAX_WALKS`): i raggi del sole. Prima erano 7, le lettere meno una.
11. **L'app offre la penna alzata per faccina, fantasmino e ciambella**,
   con l'interruttore delle parole («Lift the pen between parts»), lo
   stesso stato acceso di partenza (TASK-202); il sole solo con la penna
   giù; sull'acqua mai.
12. **La voce**: un percorso con tratti a piedi e senza parola è una forma
   a pezzi, e i pezzi non hanno nome: «Part done. Walk to the next part:
   the drawing is paused.», «Pen down: draw the next part.», in bici
   «Ride to», nelle cinque lingue. Nessun campo nuovo fra la mappa e la
   navigazione.
13. **«The sun»** è il nome inglese del sole nelle tabelle delle lingue:
   le chiavi sono il testo inglese (ADR-0172) e «Sun» è già la domenica.
14. **I preferiti** tengono i tratti a piedi anche di una forma di
   `PEN_UP_SHAPES`, e la riaprono chiesta con la penna alzata.

**Aggiornamento** (2026-10-05, ADR-0188, TASK-226): la penna alzata delle
forme a pezzi vale anche sull'acqua, e lì i tratti sono uno in più (il
ritorno al contorno): al più 9, non 8. I punti 9–11 qui sopra dicono
com'era prima.

## ADR-0184 — Il cuore su giallo, segno di Sgrava: il cuore dell'avvio, fermo, in un quadrato giallo, un componente solo
**Stato**: Attiva · 2026-10-03 · deciso dall'agente su delega dell'utente
(TASK-221). La richiesta («Dentro l'app, metti il cuore giallo sullo
sfondo giallo, a fianco al nome sgrava») è dell'utente, come quella dello
stesso cuore in «Explore», sotto la foto del profilo (l'altra sessione);
misure, posto e componente, qui sotto, sono dell'agente.

**Contesto**: il cuore nero su giallo si vede solo all'avvio (TASK-179,
ADR-0147), disegnato da una penna; dentro l'app il nome in cima a «Draw»
era un testo solo. Due richieste dello stesso giorno lo vogliono in due
posti dell'app: serve una regola sola, perché non nascano due cuori
diversi.

**Decisione**:

1. **Lo stesso cuore dell'avvio** (`heartLine.ts`, il cuore di Milano da
   10 km), fermo: un tratto dritto per ogni pezzo del percorso, senza i
   tagli che servono all'animazione (98 View invece di circa 200).
2. **Un quadrato giallo `accent`**, angoli al 22% del lato, come
   un'icona e non come un pulsante; il cuore nero `onAccent` largo il 68%
   del lato, centrato, con il punto di partenza dell'avvio (bianco `text`
   con l'anello nero). Il tratto è 1/16 del lato, il punto 1/6: più
   spessi che all'avvio, perché il cuore si legga alla misura di una
   parola.
3. **Un componente solo**, `src/intro/HeartBadge.tsx`, con la misura del
   lato come unico parametro. Ogni altro posto dove il cuore su giallo
   compare (il primo dopo questo: «Explore») lo importa, non lo ridisegna.
4. **Dove si usa**: in «Draw», a sinistra di «Sgrava», 32 punti,
   `space.sm` di distanza, il nome resta un testo (TASK-221); in
   «Explore», sotto il cerchio del profilo, 44 punti (TASK-222).
5. **Solo un'immagine**: nascosto al lettore di schermo, che legge il nome
   accanto.

**Perché così**: il logo si usa già «nero su giallo» (ADR-0129, `UI.md`
«Il logo e l'icona»): il cuore su giallo è un segno della marca, non un
comando, e non tocca la regola «il giallo significa una cosa sola», che
parla dei comandi e della mappa. Nessuna dipendenza nuova: View girate,
come all'avvio.

**Scartato**: un'immagine PNG del cuore (un file in più, sfocata alle
misure che non sono la sua); il segno «S» invece del cuore (non chiesto);
il cuore senza quadrato, nero o giallo sul fondo scuro (il giallo dietro
è la richiesta); il cuore a destra del nome (il logo viene prima del
nome, come in ogni marchio).

**Conseguenze**: TASK-222 («Explore») importa `HeartBadge` dopo il merge
di TASK-221; un posto nuovo si aggiunge al punto 4. Si vede sul telefono
con la prossima pubblicazione dell'app, con l'ok dell'utente.

## ADR-0186 — Correndo un percorso: il fatto giallo pieno, il da fare tratteggiato che lampeggia
**Stato**: Attiva · 2026-10-03 · **scelta dell'utente** il giallo pieno
del fatto, il tratteggio lampeggiante del da fare e lo stile proposto
(anteprima approvata); il resto deciso dall'agente su delega dell'utente
(TASK-224).

**Contesto**: correndo, la mappa disegnava tutto il percorso giallo pieno,
uguale prima e dopo il passaggio. L'utente, il 2026-10-03: «voglio che il
segno del percorso fatto sia giallo mentre quello da fare sia tratteggiato
che lampeggia come se dovessi ancora farlo». Il coordinatore ha chiesto che
il nuovo tratteggio si distingua dagli altri due della mappa, che il
lampeggio costi poca batteria e si fermi con «Pocket», e che penna alzata e
bici a mano restino giuste.

**Decisione dell'utente**: fra tre proposte, «Sì, così»: il da fare giallo
tratteggiato, a scatti, 0,7 s acceso e 0,7 s attenuato, mai spento; fermo
in «Pocket». Scartati il lampeggio morbido (più batteria) e il da fare in
grigio (il giallo non indicherebbe più tutta la strada).

**Decisione dell'agente**:
1. **Il taglio si fa nell'app, non nella pagina della mappa**
   (`src/map/routeSplit.ts`, puro e provato con jest): dal percorso e dai
   metri del navigatore (`alongM`) escono le linee fatte e quelle da fare,
   mandate alla pagina con `showProgress`. Il percorso di `showRoute`
   resta nella pagina e torna intero con `clearProgress`.
2. **A passi di 5 m**: la mappa non riceve il percorso a ogni metro; un
   passo ogni due secondi circa di corsa. Dopo «You have arrived» il fatto
   è tutto il percorso, anche se l'arrivo scatta 25 m prima della fine.
3. **Uno strato nuovo, `route-ahead`**, sotto la linea piena: giallo,
   largo come il percorso, trattini 2 × 1,5 larghezze. **Una battuta cambia
   lo stato della linea** (`feature-state` «dim», la sola linea dello
   strato ha id 0 con `generateId`), **mai lo stile**: un `setPaintProperty`,
   anche con la transizione dell'opacità a zero, fa ripartire per 300 ms le
   transizioni di tutte le proprietà dello strato, e la mappa si ridisegna
   per tutto quel tempo.
4. **«Pocket» arriva alla mappa da un segnale piccolo**
   (`src/navigation/pocketOn.ts`), scritto da `usePocketMode`: la scheda
   della corsa e la mappa sono in due rami diversi di `App.tsx`, e passare
   lo stato fra loro avrebbe toccato più file. Con «Riduci movimento» del
   telefono la pagina non lampeggia (`prefers-reduced-motion`).
5. **Penna alzata e bici a mano**: si tagliano solo le linee disegnate (le
   lettere); i tratti a piedi fra le lettere restano grigi e fermi, i
   trattini scuri della bici a mano restano sopra il fatto e il da fare.

**Come si distingue dagli altri due tratteggi**:

| | colore | larghezza | dove | si muove |
|---|---|---|---|---|
| da fare (`routeAhead`) | giallo `accent` | 5, come il percorso | sotto la linea piena | lampeggia |
| tratti a piedi fra le lettere (`walk`) | grigio `textMuted` | 3 | sotto il percorso | fermo |
| bici a mano (`onFoot`) | scuro `onAccent`, dentro il giallo | 2 | sopra il percorso | fermo |

Il grigio dice «non è disegno», lo scuro dentro il giallo «disegno, ma a
piedi», il giallo tratteggiato «disegno, ancora da fare».

**Misure** (la pagina vera della mappa, MapLibre 5.24, nel browser
dell'app sul Mac, il cane da 15 km di Levico, 665 punti, alla vicinanza
della corsa; ridisegni contati sulle chiamate di disegno WebGL):

| | ridisegni al secondo |
|---|---|
| fermo, nessun taglio | 0 |
| taglio, lampeggio spento («Pocket») | 0 |
| lampeggio con `setPaintProperty` (la prima versione) | 28,6 |
| lampeggio con `feature-state` | 1,43 (due ogni 1,4 s) |
| la mappa che segue chi corre, una posizione al secondo | 20,6 |
| la stessa, più il taglio ogni 2 s e il lampeggio | 25,2 |

Un messaggio di taglio costa alla pagina 0,05 ms e pesa 17 KB per 15 km;
arriva ogni 5 m, circa ogni 2 s di corsa. Seguire chi corre (`easeTo` a
ogni posizione) resta la spesa grande; il taglio e il lampeggio aggiungono
circa un quinto, e in «Pocket» niente. **Il GPS non cambia**: la
registrazione e le sue richieste di posizione non sono toccate; la mappa
legge i metri che il navigatore calcola già. Da confermare correndo
sull'iPhone (una WebView di iOS, non il browser del Mac).

## ADR-0187 — L'acqua della canoa da un estratto Geofabrik: un riquadro grande per luogo, `route_engine` invariato

**Data**: 2026-10-03 · **Stato**: Accettato · **Task**: TASK-225 ·
deciso dall'agente su delega dell'utente («SI FALLO», «SI GRAZIE»)

**Contesto**: il server disegna in canoa solo con l'acqua in
`data/cache/water/` (ADR-0164). Overpass rifiuta l'indirizzo del server e,
dal 2026-10-03, anche quello del Mac: la query dell'acqua non ha mai avuto
risposta (ADR-0154). Il coordinatore chiedeva di controllare se la cache
serve solo lo stesso riquadro. `OverpassWaterSource.covering_path` sceglie
invece già il file più piccolo il cui riquadro contiene quello chiesto, e
`build_area` ritaglia tutto al riquadro della richiesta.

**Decisione**:

1. **Nessuna modifica a `route_engine`.** Un file d'acqua più grande
   serve già ogni richiesta che ci sta dentro, con la stessa area di un
   download del suo riquadro: Overpass dà un sovrainsieme, e il ritaglio
   lo riporta allo stesso. Corsa, bici e forme restano identiche per
   costruzione. L'impronta del motore non cambia: niente `draw_examples`,
   niente copia del motore da rifare per TASK-214 B.
2. **L'acqua da un estratto, come le zone (ADR-0119).**
   `shaperoute_api/water_extract.py` legge un ritaglio OSM XML di osmium e
   sceglie gli elementi che Overpass risponderebbe a
   `water.water_query(bbox)`:
   - nel riquadro: un nodo dentro; una via con un nodo dentro o un tratto
     che lo attraversa; una relazione con un membro così;
   - attorno all'acqua: le vie entro 40 m (`ACCESS_NEAR_M`) dalle vie
     d'acqua o dalle vie membro delle loro relazioni, misurate in metri
     sul piano tangente al centro del riquadro.

   Li scrive con `compact` nel formato e col nome di un download. Il
   ritaglio usa `osmium extract --strategy smart`, così un lago che
   attraversa il bordo arriva intero, come da Overpass. Nell'API, non nel
   motore: è preparazione dei dati, come `zone_extract.py`, e così
   l'impronta non cambia.
3. **Un riquadro grande per luogo**, allargato di 5,2 km attorno a dove si
   parte: la richiesta più grande, 5 km, chiede ±5,04 km. Sono Riccione
   (da Rimini a Cattolica), Jesolo (da Cavallino a Eraclea), il Garda
   intero e il Lago di Como intero. Accanto ci sono i riquadri piccoli di
   Riva e di Como città, che servono gli esempi di «Explore» leggendo meno
   dati, perché l'API sceglie il file più piccolo che copre la richiesta.

**Alternative scartate**: unire più file vicini per una richiesta che sta a
cavallo (cambia `water.py`, quindi l'impronta, per un caso che i riquadri
larghi evitano); aspettare Overpass (rifiuta da ore il server e il Mac);
l'API di OSM a pezzi piccoli (limite di 50.000 nodi, troppe chiamate per
aree di 20–50 km).

**Conseguenze**: una partenza in canoa fuori dai riquadri chiede ancora
Overpass, e dal server ha `503`. Un luogo nuovo è un riquadro nuovo
scritto da un estratto. I dati sono quelli dell'estratto (Geofabrik del
2026-10-02), non aggiornati da soli. Il Lago di Lugano, in parte svizzero,
negli estratti italiani può non essere intero.

## ADR-0191 — Dalla lavagna del contorno si esce con «Save», in fondo
**Stato**: Attiva · 2026-10-04 · deciso dall'agente su delega dell'utente
(TASK-229). Cambia l'uscita della lavagna di ADR-0074.

**Contesto**: l'utente, il 2026-10-03: «Non si riesce ad uscire quando
carichi una foto e modifichi la sagoma, da aggiungere qualcosa per
salvare le modifiche e uscire». L'unica uscita era «Done», un testo in
alto a destra; in Expo Go quell'angolo è coperto dal pulsante di Expo, e
la lavagna a tutto schermo di iOS non si chiude trascinando in giù.

**Decisione**:

1. **«Save» in fondo alla lavagna**, sotto «Add a part», «Add a detail» e
   «Undo», largo quanto la riga, neutro come gli altri pulsanti (il
   giallo è del percorso).
2. **Salvare è chiudere**: ogni tratto entra nel contorno appena l'API
   risponde (ADR-0074), quindi «Save» chiude e basta. Il tasto «indietro»
   di Android chiude tenendo le modifiche, come prima.
3. **Tolto «Done»**: due pulsanti per la stessa cosa confondono.
4. **Nessun «Cancel»**: non chiesto; «Undo» torna fino al contorno
   ricavato.

**Scartato**: lasciare «Done» e spostarlo a sinistra (resta un testo
piccolo e non dice che le modifiche restano); «Save» giallo (il giallo è
del percorso, `UI.md` «Il tema»); «Cancel» che butta le modifiche della
visita (una scelta di prodotto non chiesta: un task nuovo se serve).

**Conseguenze**: «Fit», quando la foto è ingrandita, resta in alto a
destra, in Expo Go sotto il pulsante di Expo: due dita fanno lo stesso.
Si vede sul telefono con la prossima pubblicazione dell'app.

## ADR-0192 — L'acqua da Overpass con `out body geom`: i membri delle relazioni, quindi i laghi multipoligono

**Data**: 2026-10-04 · **Stato**: Accettato · **Task**: TASK-230 ·
deciso dall'agente su delega dell'utente

**Contesto**: `WATER_QUERY` (ADR-0154) finiva con `out tags geom`. A
quel livello Overpass scrive di una via i tag e la geometria, ma di una
relazione solo l'id e i tag, senza membri. Il 2026-10-04 Overpass ha
risposto al server per la prima volta (TASK-225, Milano). Le 10 relazioni
`natural=water` del riquadro sono arrivate con `members` vuoti, mentre
l'estratto le aveva intere (ADR-0187). Un lago disegnato come
multipoligono, come il Garda, il Lago di Como o l'Idroscalo, non aveva
così forma, e una partenza lì rispondeva «no lake or sea».

**Decisione**: la query finisce con `out body geom;`.

- Di ogni relazione Overpass scrive allora i membri, con ruolo e
  geometria; di ogni via anche gli id dei nodi.
- `compact` tiene solo tipo, id, tag e geometria: i file della cache
  restano nel formato di prima, e `water_extract` (ADR-0187) scrive già
  gli stessi elementi.
- Non `out meta geom`: versioni e autori non servono.

**Conseguenze**:

- La risposta di Overpass pesa di più per i laghi grandi, perché ogni
  membro arriva con tutta la sua geometria. È quello che serve per
  costruirli.
- Un file d'acqua scritto prima da Overpass non ha i membri, e resta così
  finché non lo si cancella. Sul server non ce n'è nessuno: quello di
  Milano è stato sostituito dall'estratto.
- L'impronta del motore cambia: dopo l'aggiornamento del server serve
  `draw_examples`, e lo zip del motore dell'app è rifatto. Corsa, bici e
  forme non leggono la query: identiche.

## ADR-0189 — «Explore» con «Paddle»: le otto forme della corsa, e gli esempi dei quattro luoghi dentro l'app

**Data**: 2026-10-04 · **Stato**: Accettato · **Task**: TASK-227 · le
forme e «dentro l'app» sono scelte dell'utente; il resto è deciso
dall'agente su delega dell'utente

**Contesto**: con «Paddle», «Explore» (ADR-0169) disegnava per ogni luogo
d'acqua cerchio, cuore e stella da 2 km, chiesti all'API alla prima
apertura. L'utente ha chiesto gli stessi esempi della corsa, comprese le
cinque forme di ADR-0144. Sui campioni veri, sull'acqua del server
(TASK-225), le 13 forme del catalogo ci stanno tutte nei quattro luoghi.
Alla domanda «sul server o alla prima apertura» ha risposto «già
scaricati al momento del download dell'app».

**Decisione**:

1. **Le otto forme della corsa**, nello stesso ordine: `PADDLE_EXAMPLES`
   prende `MORE_SHAPES`.
2. **I quattro luoghi vengono con l'app**: `src/paddle/paddleExamples.json`,
   nel formato in cui l'app tiene i suoi esempi. Un `ExampleSet` porta
   `bundled`; `fromFile` lo legge prima del file del telefono. Così sono
   pronti subito, anche senza rete né API, e non si chiedono più. Non si
   scrivono nel file del telefono.
3. **Il JSON lo scrive il motore**: `python -m
   shaperoute_api.paddle_examples`, con `plan_water` come l'API, sull'acqua
   del server copiata (TASK-225), senza scaricare niente. Un test dell'app
   rifà ogni esempio da `asRecommended`, così il file resta quello che
   l'app avrebbe disegnato.
4. **«Near me» resta disegnato al momento**, come gli esempi di una città:
   le prime tre forme, poi le altre quando arrivano (`shownExamples`).

**Alternative scartate**:

- Disegnarli in anticipo sul server con `draw_examples`: oggi l'API tiene
  solo gli esempi dei centri città (ADR-0136), quindi sarebbero serviti
  una modifica all'API e un passo sul server, e il primo accesso avrebbe
  comunque chiesto la rete.
- Le sole forme senza occhi, in attesa di TASK-226: scartato dall'utente.

5. **Il JSON dice con quale motore è stato disegnato**: `engine` è
   l'impronta dei file del motore che disegnano sull'acqua, cioè
   `route_engine.paddling` e ciò che importa, seguendo le righe `import`,
   più le sagome delle otto forme. Un test dell'API fallisce quando
   l'impronta cambia, come quello dello zip del telefono (ADR-0177), e dice
   come rifarlo.

**Conseguenze**:

- L'app cresce di 101 KB di codice JavaScript; nel repository il file pesa
  156 KB dopo Prettier.
- Rifarlo vuole l'acqua del server, copiata in sola lettura con `scp`,
  e il comando: dopo un cambio del motore sull'acqua (TASK-226 ne è uno),
  dei luoghi, delle forme o dell'acqua stessa. Un cambio del motore che
  non tocca l'acqua (la ricerca su strada, la penna alzata) non lo chiede.
- Un esempio dentro l'app si apre, parte e si tiene nei preferiti come
  quelli disegnati dall'API.
- **Limite**: «Near me» resta legato al server, che fuori dai quattro
  luoghi scarica l'acqua da Overpass. Finché il server non ha TASK-230
  (ADR-0192) i laghi multipoligono scaricati così mancano.

## ADR-0193 — Le reazioni ai disegni pubblicati, e il super like di Sgrava con un commento
**Stato**: Attiva · 2026-10-04 · scelte dell'utente (1–5), il resto
deciso dall'agente su delega dell'utente (TASK-119). Prende il posto del
«Like» con un cuore solo che TASK-119 prevedeva prima.

**Contesto**: l'utente, il 2026-10-04: «puoi reagire con varie emoji e
metti anche l'emoji del cuore di sgrava»; «il cuore sgrava è super like e
si fa premendo due volte sul post»; «quando metto il super like, sei
obbligato a mettere un commento di minimo due caratteri». I disegni
pubblicati si aprono da un profilo (TASK-117) e hanno già i commenti
(TASK-120); il feed vero (TASK-118) non c'è ancora.

**Decisione**:

1. **Sei reazioni** (utente): il cuore di Sgrava (`HeartBadge`), 🔥 👏 💪
   😂 😮. **Una a testa** per disegno: un'altra la cambia, la stessa la
   toglie. Sotto il disegno le tre più usate e il totale.
2. **Il cuore di Sgrava è il super like** (utente), con un **doppio tocco
   sul disegno aperto** (utente, fra due proposte: nella griglia il tocco
   singolo continua ad aprire subito).
3. **Il super like vuole un commento di almeno 2 caratteri** (utente).
4. **Super like e commento in una sola richiesta e una sola
   transazione**: o tutti e due o niente. Il commento passa dagli stessi
   controlli degli altri e dal filtro di ADR-0176; negativo, `422
   comment_rejected` e niente super like.
5. **Dopo sono separati**: togliere o cambiare il super like lascia il
   commento; cancellare il commento lascia il super like.
6. **Codici fissi** nel database e nel contratto (`super_like`, `fire`,
   `clap`, `strong`, `laugh`, `wow`), mai i caratteri delle emoji: l'app
   li disegna, e un'emoji nuova è una migrazione e una riga nel contratto.
7. **Un endpoint loro** (`GET /drawings/{id}/reactions`, `PUT` e `DELETE
   /drawings/{id}/reaction`), come il numero dei commenti: `DrawingDetail`
   non cambia.
8. **Il pulsante delle reazioni apre la barra delle sei**, cuore
   compreso: chi usa VoiceOver mette il super like da lì. Il doppio tocco
   su un super like già messo mostra il cuore e basta.
9. **Sul disegno aperto il doppio tocco non fa lo zoom** della mappa; le
   due dita sì. Altrove la mappa non cambia.

**Scartato**: un cuore solo (era TASK-119, superato dall'utente); più
reazioni a testa come Telegram (proposta, non scelta); il doppio tocco
anche nella griglia (il tocco singolo avrebbe dovuto aspettare); il
super like ottimista (il commento può essere rifiutato: l'app aspetta
l'API); i caratteri delle emoji nel database (un cambio di Unicode o di
glifo diventerebbe un dato da migrare); `likes` e `reactions` dentro
`DrawingDetail` (toccava `drawings.py` e il contratto di TASK-117/208 per
una cosa che si legge a parte).

**Conseguenze**: migrazione nuova (il primo numero libero al merge) e
quindi l'ok dell'utente per il server. I post di esempio del «Feed»
restano senza reazioni; il feed vero (TASK-118) userà gli stessi
endpoint. Bloccare (TASK-121) dovrà tenere conto anche delle reazioni.

**Parte B, l'app** (2026-10-05, deciso dall'agente su delega dell'utente,
TASK-119):

10. **Il doppio tocco lo riconosce la pagina della mappa** dai tocchi di
    un dito (`touchstart`/`touchend` sul contenitore di MapLibre, ascolto
    passivo): due tocchi sotto i 300 ms, entro 350 ms e 40 px. Solo quando
    l'app lo chiede (`setDoubleTap`), e allora `doubleClickZoom` di
    MapLibre è spento; gli ascolti si mettono alla prima richiesta, così
    altrove la pagina è byte per byte quella di prima. Non l'evento
    `dblclick`: su iOS con le dita non arriva in modo affidabile.
11. **La mappa non sa delle reazioni**: `MapView` ha solo `onDoubleTap`, e
    `App.tsx` lo collega a `drawingDoubleTapped()` di `DrawingReactions`
    (una lista di ascoltatori nel modulo, come `showSavedLogo` di
    ADR-0174), senza stato nuovo in `App.tsx`.
12. **Le emoji sono ottimiste, una per volta**; a un rifiuto torna
    l'ultima risposta dell'API. Se le reazioni non si leggono (qualsiasi
    motivo) la riga non c'è: non valgono un «Try again» nella scheda.
13. **Dopo un super like i commenti si richiedono** (il pulsante si
    rimonta), invece di uno stato condiviso fra reazioni e commenti.
14. **Il cuore grande sta nei `Modal`** (nel foglio, sopra; da solo per
    0,9 s): niente da posare sulla mappa in `App.tsx`. L'animazione del
    cuore è in JS: con `useNativeDriver` dentro il `Modal` restava
    invisibile (visto nel simulatore, iOS 27, nuova architettura).
15. **Per VoiceOver il totale si dice «7 reactions»**: un testo in più
    rispetto alla proposta del task file.

## ADR-0194 — Il post di una corsa: un'immagine fatta dall'app, Instagram dal foglio di condivisione, Strava come testo

**Data**: 2026-10-04 · **Stato**: Accettato · **Task**: TASK-231 · il
post, le emoji, i risultati, i due posti di «Share», Instagram dal foglio
e Strava come testo sono scelte dell'utente, con la dipendenza nuova; il
resto è deciso dall'agente su delega dell'utente

**Contesto**: l'utente vuole condividere il «post» di Sgrava su Instagram
e Strava, dopo averlo cambiato con emoji e risultati della corsa.
Instagram non ha un'API per pubblicare da un'altra app senza un account
business; Strava non accetta foto dalla sua API (ADR-0170). L'app non ha
SVG: le linee sono `View` ruotate.

**Decisione**:

1. **Il post è una `View` dell'app** (`PostImage`), 9:16, fatta con le
   stesse linee di «My activities» (`fitLines`); ogni misura è una parte
   della larghezza, così l'immagine è uguale su ogni telefono. Giallo e
   nero sono quelli del logo (ADR-0129), in ogni tema.
2. **L'immagine la fa `react-native-view-shot` 5.1.0** (`captureRef`, PNG
   ai pixel del telefono, nella cache): MIT, dentro Expo Go 57, nessun
   plugin. Poi `expo-sharing` apre il foglio di iOS: Instagram (Storia,
   Feed, Messaggi), «Save Image», Messaggi, AirDrop.
3. **Le emoji** stanno sul post come parti di larghezza e altezza
   (`stickers.ts`): al più 5, dodici fra cui scegliere, trascinate con il
   responder di React Native (nessuna libreria di gesti), tolte con un
   tocco (meno di 6 punti di movimento) o con l'azione di VoiceOver.
4. **Il disegno del post perde i primi e gli ultimi 200 m** lungo la
   traccia (`withoutEnds`, `POST_CUT_M`), come un disegno che vedono gli
   altri: l'immagine esce dall'app.
5. **Strava riceve il testo del post** come descrizione, quando la corsa
   parte dal post: emoji, poi i risultati accesi («🔥❤️ 5.20 km · 28:10 ·
   5:25 /km · Score 87»), nella lingua dell'app; l'API ci mette sotto
   «Drawn with Sgrava». `sendToStrava` prende `description` fra le
   opzioni, così chi lo chiamava prima non cambia.
6. **«Share» non vuole un account** a fine corsa: il post è fatto sul
   telefono. Strava, invece, solo per una corsa salvata.

**Alternative scartate**:

- `instagram-stories://share` con il post come adesivo: vuole un App ID
  di Meta, le chiavi del pasteboard di Instagram e una build propria.
- Disegnare il PNG a mano o con `@shopify/react-native-skia`: più codice,
  e il post non sarebbe la stessa `View` che si vede e si cambia.
- Catturare a 1080×1920 fissi: da una `View` di 250 punti l'immagine
  verrebbe ingrandita, non più nitida; Instagram ingrandisce lo stesso.
- Mandare a Strava l'immagine: l'API di Strava non la accetta.

**Conseguenze**:

- Una dipendenza in più (`react-native-view-shot`, con `html2canvas` solo
  per il web). Dopo il merge, `npm install` nel checkout principale.
- Una corsa già su Strava tiene il testo con cui è partita: «View on
  Strava», e la foto si aggiunge a mano. Cambiare la descrizione là è la
  parte B di TASK-231 (API).
- I testi nuovi sono nelle cinque lingue (ADR-0172), da far confermare.

**Parte B** (2026-10-05, «fai la parte b e pubblica» dell'utente; deciso
dall'agente su delega dell'utente):

7. **Il testo del post è un campo suo**, `post`, nel corpo di `POST
   /me/activities/{key}/strava`, non la `description`: va in cima, sopra
   le parole di chi corre (TASK-208) e la riga di Sgrava, così il post non
   le cancella. La parte A, mai pubblicata, mandava il testo come
   `description`: cambiata senza che nessun telefono l'abbia avuta.
8. **Su una corsa già mandata `post` cambia il testo su Strava** con `PUT
   /api/v3/activities/{id}` (basta `activity:write`); il nome resta. Senza
   `post` la corsa risponde com'era, come prima: l'outbox di «Send to
   Strava» che rimanda una corsa non cambia niente. Se Strava risponde 403
   o 404 (attività cancellata, o «Only me» senza `activity:read_all`),
   `422 invalid_request` e la corsa resta mandata: non si chiede un
   permesso in più per leggere.
9. **Nell'app** «Update on Strava» compare su una corsa già là solo se il
   post ha un testo.

**Aggiornamento** (2026-10-05, TASK-241 parte C, scelta dell'utente): il
punteggio non è più fra i risultati del post né nel testo per Strava
(punto 5: «🔥❤️ 5.20 km · 28:10 · 5:25 /km»). Vedi ADR-0207.

## ADR-0180 — Il confronto dei km nella voce: i secondi della fine corsa, una frase a parte, in bici ogni 10 km senza numeri
**Stato**: Attiva · 2026-10-05 · **scelte dell'utente** (2026-10-03) la
frase a ogni km con i secondi, «stesso passo» entro 2 s, niente al primo
km, in bici ogni 10 km e senza numeri; il resto **deciso dall'agente su
delega dell'utente** (TASK-217).

**Contesto**: a ogni km la voce diceva il tempo e il passo medio della
corsa. L'utente ha chiesto di sentire anche se il km è andato meglio o
peggio del precedente, e fra tre proposte ha scelto quella con i secondi.

**Decisione**:

1. **Gli stessi secondi della fine corsa.** La differenza viene da
   `splits` (`runMetrics.ts`), il calcolo della colonna «Change» di «Data»
   e del riepilogo: il tempo di ogni km dalla traccia, pause escluse,
   arrotondato al secondo come `changeLabel`. La voce e lo schermo non
   possono dire due numeri diversi. Il limite dei 2 s (compresi) si guarda
   sul numero arrotondato, quello che si sentirebbe.
2. **Una frase a parte, dopo quella del km** (`kmCompare.ts`, un file
   nuovo: `freeRun.ts`, `runMetrics.ts` e `ride.ts` restano com'erano). La
   frase del km non cambia di una parola; al quinto km il confronto viene
   dopo «Daje, avanti tutta!», che è la coda della frase del km (TASK-209).
3. **Da un minuto in su la differenza è detta come un tempo** («1 minute
   15 seconds faster…»), con `time` del `Phrasebook`: «75 secondi» non lo
   dice nessuno. Sotto il minuto è la frase scelta dall'utente.
4. **In bici**, ogni `RIDE_KM_EVERY` km da 20 km: gli ultimi 10 km contro
   i 10 prima, in km/h, senza numeri. «Stessa velocità» entro 0,5 km/h
   (`SAME_SPEED_KMH`): su 10 km a 24 km/h sono circa 30 secondi, sotto non
   è una differenza che si sente pedalando. L'utente non l'aveva chiesto:
   frase e soglia **confermate dall'utente** il 2026-10-05.
5. **«km» detto per intero** nelle frasi della bici («Ultimi 10 chilometri
   più veloci dei 10 precedenti.»): l'utente le ha scritte con «km», ma la
   voce del telefono può leggere male le sigle (ADR-0179, «km/h») e la
   frase dei km dice già «chilometri». All'orecchio è la stessa frase.
6. **Tedesco, spagnolo e francese** scritti dall'agente, **confermati
   dall'utente** il 2026-10-05.
   Spagnolo e francese dicono «più veloce / più lento» («más rápido», «plus
   rapide»): «mejor / mieux» con i secondi suona tradotto.

**Alternative scartate**:

- Allungare la frase del km con il confronto: cambiava una frase
  approvata (TASK-209) e i test che la fissano parola per parola.
- Calcolare la differenza dai tempi detti a voce (il tempo totale a ogni
  km): contiene le pause automatiche solo in parte e non è il numero di
  «Data».
- Il confronto in bici con i km/h («2 km/h più veloci»): l'utente ha
  scelto senza numeri.

**Conseguenze**:

- Le forme con le miglia («Questo miglio: …», «… than the last mile.») le
  aggiunge TASK-182 con il resto della voce in miglia; lì si decide anche
  l'intervallo della bici in miglia.
- `rideRun.test.ts` (TASK-216) ha la riga nuova a 20 km e, per la corsa,
  «Same pace as the last kilometre.» al secondo km.
- Solo app: esce con la prossima pubblicazione, con l'ok dell'utente.

## ADR-0188 — Gli occhi staccati sull'acqua: i pezzi piazzati col contorno, lasciato dove sono più vicini, e la distanza di tutto il percorso

**Data**: 2026-10-05 · **Stato**: Accettato · **Task**: TASK-226 · le forme
(tutte quelle a pezzi tranne il sole) e la penna alzata automatica sono
scelte dell'utente; il resto è deciso dall'agente su delega dell'utente

**Contesto**: sull'acqua una forma a pezzi (ADR-0185) si disegnava in una
linea sola, con gli occhi attaccati al contorno da un collegamento
percorso due volte, e `pen_up` con `paddling` era rifiutato. L'utente ha
chiesto gli occhi senza linee di collegamento, con il disegno in pausa da
solo fra un pezzo e l'altro. Sull'acqua non c'è una rete: i pezzi non si
spostano «dove ci sono le strade», come fanno su strada (`pieces.compose`).

**Decisione**:

1. **Contorno e pezzi si piazzano insieme, rigidi.** Stessa scala, stessa
   rotazione, stesso centro; tutti nella fascia (ADR-0154), compresi i
   tratti a penna alzata. Un pezzo su un'isola o troppo vicino a un
   ostacolo scarta il piazzamento.
2. **Il contorno si lascia dove i pezzi sono più vicini**: al vertice da
   cui la penna resta alzata di meno, calcolato una volta sulla forma. Lì
   il percorso va al pezzo più vicino, poi al successivo, e dopo l'ultimo
   torna allo stesso vertice; poi il contorno prosegue. I `walks` sono
   quei tratti, dritti: uno per pezzo più il ritorno.
3. **La distanza chiesta è quella di tutto il percorso**, tratti a penna
   alzata compresi, come lo sono già i tratti dalla riva. Alla grandezza
   intera contorno, pezzi e tratti a penna alzata sono lunghi insieme
   quanto la distanza: la ricerca di ADR-0161 resta la stessa.
4. **`pen_up` vale con `paddling`** per le forme a pezzi; senza, il
   percorso è quello di prima, punto per punto. Quali forme l'app chiede
   così è una scelta dell'utente, nell'app (parte B): tutte tranne il
   sole.
5. **`MAX_WALKS` dell'API sale a 9**: sull'acqua c'è anche il ritorno al
   contorno.

**Alternative scartate**:

- **Andare ai pezzi da dove la riva tocca il contorno**, come su strada si
  parte dalla fine del contorno. Provato: al mare il punto della riva è
  spesso dal lato opposto agli occhi, e il pesce aveva 534 m a penna
  alzata su 2 km, con la forma al 55%. La lunghezza dei tratti dipendeva
  anche dal punto della riva, e i limiti della ricerca non valevano più.
- **La distanza del solo disegno**, come su strada: sull'acqua i limiti di
  1–5 km sono di sicurezza, e i tratti a penna alzata si pagaiano.
- **Un tratto di andata e ritorno per ogni pezzo**, dal punto del contorno
  più vicino a ciascuno: più pause, per pochi metri in meno.

**Conseguenze**:

- La penna alzata sull'acqua costa 64–112 m su 2 km per pesce e teste,
  185–354 m per zucca, ciambella, fantasmino, gatto e faccina; il sole
  726–876 m in 9 tratti, e per questo l'utente lo tiene a penna giù.
- L'impronta del motore cambia: `draw_examples` dopo l'aggiornamento del
  server, lo zip del telefono e l'impronta degli esempi della canoa
  nell'app (ADR-0189) rifatti.
- Un server senza questa parte rifiuta `pen_up` con `paddling`: l'app che
  lo chiede (parte B) si pubblica dopo l'aggiornamento del server.

## ADR-0195 — Le forme si inclinano fino a 45°, e la mappa gira perché si vedano dritte

**Data**: 2026-10-05 · **Stato**: Accettato; motore e API fatti (parte A),
l'app da fare · **Task**: TASK-232 ·
45°, la mappa girata, la freccia del nord e la mappa della corsa sono
scelte dell'utente; il resto è deciso
dall'agente su delega dell'utente · supera in parte ADR-0038 (il limite
di 15°)

**Contesto**: ADR-0038 tiene ogni forma con un alto e un basso entro
±15°, perché su una mappa col nord in alto l'occhio non riconosceva le
forme inclinate (TASK-035). In un posto dove le strade reggono la forma
solo inclinata, il percorso esce dritto ma la segue peggio. L'utente:
«pur di farlo venire perfetto puoi scegliere tu l'orientamento e girare
la mappa anche fino a 45 gradi».

**Decisione**:

1. Ogni forma con un alto e un basso si inclina fino a ±45°: catalogo,
   emoji, contorni da foto, parole (anche quelle a blocchi lungo le
   strade), canoa. Il cerchio resta libero.
2. A parità vince la forma dritta: inclinarla costa il 5% di copertura a
   45°, in proporzione all'angolo, come spostare la partenza di 500 m
   (`OFFSET_FIT_PENALTY`). Il valore si tara sui campioni.
3. Il risultato porta `rotation_deg` (antiorario, ADR-0018, fra −180 e
   180), 0 per le forme che girano libere.
4. L'app gira la mappa di `−rotation_deg` dove mostra il disegno di un
   percorso, così la forma si vede dritta. Senza il campo, nord in alto.
5. Con la mappa girata c'è una piccola freccia del nord in alto a
   destra: un tocco rimette il nord in alto, un secondo rigira la mappa
   come il disegno.
6. Durante la corsa la mappa resta girata come il disegno, e la freccia
   del corridore gira di conseguenza.
7. Il GPX non cambia.

**Alternative scartate**: tenere 15° (la richiesta è di provare di più);
girare libero ogni forma (oltre 45° la mappa capovolta disorienta, e
lettere e animali si leggono male); inclinare la forma senza girare la
mappa (è ciò che ADR-0038 ha mostrato non riconoscibile).

**Conseguenze**: la ricerca prova più rotazioni (7 invece di 3 per
partenza e fase), con lo stesso numero di tracciati: il tempo va misurato.
Cambiano i percorsi di oggi dove una forma inclinata segue meglio: i
campioni si rigiudicano. Le corse salvate prima restano col nord in
alto.

**Parte A, motore e API (2026-10-05)**, deciso dall'agente su delega
dell'utente dopo le misure (`MAPS.md`, «Forme inclinate»):

- **Prima dritta, poi inclinata**, invece di provare tutte le rotazioni
  insieme (punto 1 sopra, e il piano del task file): la ricerca di sempre
  entro ±15°, e solo se non dà un percorso buono le rotazioni oltre 15°
  fino a 45° (±30°, ±45°, rifinitura ogni 5°) con 10 tracciamenti in più
  (`TILTED_TRACES`). Tutte insieme, con lo stesso budget, perdevano
  percorsi buoni (pesce di Trento da 10 km 0,91 → 0,70) e peggioravano il
  cuore di Levico da 5 km, uno dei 12 di riferimento. Così su 129 percorsi
  110 restano identici (i 12 di riferimento tutti), 19 si inclinano di
  20–45°, i buoni passano da 65 a 67, e il tempo medio sale del 10% (dei
  12 di riferimento il 6%).
- **Il costo dell'inclinazione** (punto 2) conta solo i gradi oltre 15°:
  il 5% di copertura a 45°, 0 entro 15° come prima (`tilt_share`). Dal
  primo grado faceva raddrizzare forme che prima venivano meglio a 15°.
- **La ricerca lontana resta dritta** (ADR-0040), e vicino o lontano si
  decide sulla ricerca dritta, come prima (`Search.upright`): un percorso
  inclinato vicino, disegnabile ma non buono, teneva fuori quello lontano
  che prima vinceva (gatto e pesce di Levico da 15 km). Un percorso
  inclinato vicino buono vince, e la ricerca lontana non parte.
- **Le parole squadrate** seguono le vie fino a 45° (`GRID_MAX_TILT_DEG`):
  le direzioni oltre 30° sono il secondo tempo, come le inclinazioni.
- **Sull'acqua** lo stesso schema in `water_fit.py`: entro ±15° ogni 5°,
  e solo se la forma non ci sta nella tolleranza della distanza, da 20° a
  45°, con il 5% di distanza a 45° (`TILT_WEIGHT`). I 32 esempi della
  canoa non cambiano.
- **`rotation_deg`** anche dalle partenze vicine (`ShapeJob.here`) e dalla
  canoa; 0 senza ricerca. I percorsi tenuti sul server (`route_store`, gli
  esempi di «Explore») lo conservano, e da qui anche `better_distance_m`
  (TASK-234), che rileggendoli si perdeva.
- **I campioni**: i 19 percorsi che cambiano, prima col nord in alto e
  dopo con la mappa girata (`tools/preview_turned.py`). Giudizio
  dell'utente sui percorsi nuovi: 17 `sì`, 2 `quasi`, nessun `no`.

**Parte B, la mappa girata nell'app (2026-10-05)**, deciso dall'agente su
delega dell'utente (TASK-232 parte B):

- **La mappa gira con il percorso mostrato**: `showRoute` porta il
  `bearing` (`−rotation_deg`), e la pagina inquadra il percorso così
  (`fitBounds` con il `bearing`). La pagina tiene il `bearing` voluto e lo
  ripete a ogni mossa sua (`follow`, `setPosition`): un `easeTo` senza
  `bearing` fermerebbe la rotazione a metà.
- **La freccia del nord è dell'app, non della pagina** (React Native,
  `NorthArrow.tsx`): testi di VoiceOver nelle cinque lingue e colori dai
  token come ogni altro pulsante. La pagina dice all'app di quanto è
  girata, a gradi interi (`turned`), anche quando la girano due dita.
- **Dove sta**: a destra, sotto la riga del «←» o sotto il riquadro della
  svolta. «In alto a destra» è già del tondo del profilo, e in corsa del
  riquadro: sopra non ci sta.
- **La freccia vale per ogni mappa girata**, non solo per un percorso
  inclinato: MapLibre gira la mappa anche con due dita, e finora non c'era
  modo di rimettere il nord. Con il nord in alto e nessun percorso
  inclinato la freccia non c'è.
- **Il tocco inquadra di nuovo il percorso** se la mappa è ancora
  com'era inquadrata (il riquadro di una forma girata è diverso, e il
  percorso uscirebbe dai bordi); se l'utente l'ha mossa, o in corsa, gira
  dov'è. Un percorso nuovo riparte girato come il suo disegno.
- **Due dita lasciano la mappa come l'hanno girata** anche in corsa, come
  prima: la pagina prende quel `bearing` come voluto.
- **Solo «Draw» in questo passo**: il percorso disegnato, la sua corsa e
  la sua fine. Gli esempi di «Explore» non portano `rotation_deg` fino
  alla mappa (`RecommendedRouteDetail` non ce l'ha) e le loro schede usano
  le foto-mappa del «Feed»: sono il passo B2, prima della parte C.

**Parte B2, «Explore» con la mappa girata (2026-10-06)**, deciso
dall'agente su delega dell'utente (TASK-232 parte B2):

- **L'inclinazione viaggia con l'esempio**: `rotation_deg` in
  `RecommendedRoute` (la scheda) e in `RecommendedRouteDetail` (il
  percorso intero, le alternative ciascuna la sua), preso dal risultato del
  motore (`asRecommended`, `movedExample`) e riportato nel risultato che
  leggono la mappa, «Start» e la corsa (`toResult`, `ExploreRun`).
- **Dritto vuol dire senza campo** (`turnOf`): 0, assente o illeggibile
  non si scrive. Gli esempi dritti, il file sul telefono e le foto già
  fatte restano identici a prima, byte per byte.
- **Un esempio tenuto sul telefono da prima non si ridisegna** per avere
  il campo: è un percorso trovato entro ±15°, e resta col nord in alto
  com'era. Ridisegnarli tutti costerebbe una ricerca per forma a ogni
  utente, per percorsi che vanno già bene.
- **La scheda gira la linea, non la vista**: `turnedLine` gira i punti
  attorno al loro centro, in metri, e `thumbSegments` li disegna come
  sempre; così il disegno girato riempie la scheda con lo stesso margine.
  Girare la vista (un `transform`) taglierebbe gli angoli o lascerebbe la
  forma più piccola.
- **La foto-mappa prende lo stesso `bearing`** (`lineCamera`, `Shoot`):
  l'inquadratura è quella della linea girata, con il centro riportato sulla
  terra. La pagina rimette il nord in alto a ogni foto che non lo chiede,
  perché la mappa è una sola per tutte le foto. La foto girata ha un nome
  suo (`…@−30`): non prende il posto di quella col nord in alto. Serve
  anche alla parte C.
- **Niente freccia del nord sulle schede**: sono disegni larghi mezzo
  telefono; la freccia c'è sulla mappa, appena si apre il percorso.
- **Fuori da questo passo**: il catalogo dell'API
  (`/recommended-routes`) e gli esempi sull'acqua che arrivano con l'app
  (`paddleExamples.json`) non dicono l'inclinazione; i preferiti non la
  tengono (parte C).

**Parte C, i disegni salvati (2026-10-06)**, deciso dall'agente su delega
dell'utente (TASK-232 parte C):

- **L'inclinazione si salva com'è stata mandata, non si ricalcola**:
  `runs.route_rotation_deg` e `favorites.rotation_deg` (migrazione
  `0018`, `real`, fra −180 e 180, facoltative). L'API non ha la forma né
  il motore sotto mano quando salva una corsa: tiene quello che il
  `RouteResult` diceva, come fa per `similarity`. In `runs` solo con un
  percorso (`CHECK`).
- **L'app manda il campo solo quando la forma è girata** (`turnOf`: un
  numero finito diverso da 0), e **l'API risponde sempre**, `null` quando
  non c'è: la regola di `walks`, `activity` e `on_foot`. Un'API precedente
  rifiuta il campo: l'app rimanda prima senza il campo, poi come un'app
  precedente (`withoutTurn` davanti alla catena di `saveActivity` e
  `keepFavorite`).
- **Le corse di prima restano col nord in alto**: la colonna è vuota per
  ogni riga di prima e non si riempie (non si sa com'era la forma). Lo
  stesso per i preferiti.
- **Il disegno visto dagli altri dice l'inclinazione della corsa**
  (`Drawing`, `DrawingDetail`): la traccia segue il percorso, e girarla
  dello stesso angolo la fa leggere dritta. `MyDrawing` no: è della corsa.
- **Un disegno di più linee gira attorno a un centro solo** (`fitLines`
  con un `bearing`): «My activities» disegna percorso e traccia insieme, e
  girare ognuno attorno al proprio centro, come `turnedLine` fa per una
  linea sola, li separerebbe. La linea del post (una sola) passa dalla
  stessa strada.
- **La corsa tiene l'inclinazione nel suo file** (`SavedRun.rotation_deg`,
  solo quando c'è): `recordedRun` la manda all'API e la fine corsa la mette
  nel post; il file di ogni altro percorso resta com'era.
- **Il catalogo dell'API risponde sempre `rotation_deg`**, `0` per un
  percorso dritto, come `RouteResult`: lo legge dai file delle città
  (`seed_catalog` del motore lo scrive solo quando il motore inclina) e un
  valore che non è un angolo si legge `0`. Il catalogo di oggi è di prima
  della parte A: resta tutto `0` finché non si ridisegna. Il feed campione
  (`tools/sample_feed.py`) porta il campo nel post quando il file lo dice.
- **Gli esempi sull'acqua che arrivano con l'app dicono l'inclinazione**
  (`paddle_examples.py`, solo quando c'è, come `asRecommended`): rifatti
  con l'acqua del server sul Mac, 25 esempi su 32 escono inclinati di
  5–15° con gli stessi percorsi di prima; «Explore» con «Paddle» e i
  quattro disegni sull'acqua del «Feed» girano da soli.


## ADR-0197 — «Viene meglio a N km»: la distanza consigliata anche quando la forma riesce

**Data**: 2026-10-05 · **Stato**: Accettato; motore e API fatti (parte A),
l'app da fare · **Task**: TASK-234 ·
il consiglio da tentativi già fatti (il «passo 1») e la riga con «Prova»
sono scelte dell'utente; soglie, campo e casi sono decisi dall'agente su
delega dell'utente · estende ADR-0041

**Contesto**: ADR-0041 propone una distanza solo quando il motore
rifiuta. Se il cuore da 15 km riesce ma a 12 km verrebbe meglio, oggi
nessuno lo dice. L'utente: «te cerchi un cuore da 15 km ma se con 12 viene
meglio te lo dice». Fra due proposte ha scelto di partire da quella senza
calcoli in più.

**Decisione**:

1. Il consiglio viene dai tentativi che la ricerca ha già tracciato
   (`Search.attempts`): nessun tracciato e nessuna attesa in più.
2. Un tentativo è «chiaramente meglio» quando il suo costo senza la parte
   della distanza è più basso di quello del percorso scelto di almeno
   `W_SHAPE × 0,05`, e la sua somiglianza è almeno 0,90. Sono i valori
   di partenza: la soglia si decide misurando (TASK-234) e si scrive
   qui.
3. La distanza è la sua, arrotondata al km e dentro i limiti
   dell'attività come `suggested_distance_m`; uguale a quella chiesta,
   niente consiglio.
4. Il percorso scelto non cambia: il consiglio è il campo nuovo
   `better_distance_m` del risultato, `null` senza consiglio.
5. L'app scrive «This heart comes out better at about 12 km.» con «Try
   12 km» sotto il percorso, nelle cinque lingue, solo dentro le distanze
   di «Draw», e mai per tornare alla distanza appena lasciata.
6. La canoa resta fuori: ha già la sua distanza suggerita (ADR-0164).

**Alternative scartate**: cercare apposta 2–3 distanze vicine dopo il
primo percorso (il «passo 2»: 5–50 s di server per distanza; si valuta se
il passo 1 scatta poco); consigliare in base alla sola somiglianza (un
percorso con un baffo ripassato o una partenza spostata sembrerebbe
migliore di quanto è).

**Conseguenze**: il consiglio vede solo le distanze che la ricerca ha
provato, cioè intorno a quella chiesta (scale fra 0,4 e 1,1 di quella
iniziale): quanto spesso scatta va misurato prima di fare l'app. Come per
ADR-0041, la distanza consigliata non è garantita: un nuovo disegno rifà
la ricerca.

**Parte A, motore e API (2026-10-05)**, deciso dall'agente su delega
dell'utente:

- **La soglia resta 5 punti** (`BETTER_MARGIN` = `W_SHAPE × 0,05`) con
  somiglianza ≥ 0,90: misurata su 129 percorsi (i 12 di riferimento in
  cache, le 17 forme a Trento e Levico, tre parole), scatta in 8, a 4
  punti negli stessi 8, a 3 in 11, con guadagni di 3–4 punti
  (`MAPS.md`, «Viene meglio a N km»). Nessuno dei 12 di riferimento.
- **Fuori dai limiti niente consiglio**, invece di riportarlo dentro come
  `suggested_distance_m`: una distanza riportata al limite non è quella
  dove la forma è venuta meglio. Per una parola il limite basso è anche
  3 km a lettera (`check_word`), per una forma a pezzi no.
- **Fra più distanze** si confronta il costo senza la parte della
  distanza, il migliore per ogni km; a parità vince il km più vicino.
- **Il calcolo sta nel motore** (`optimizer.better_distance`), già al km:
  la CLI e il telefono (TASK-214) lo hanno uguale all'API. Lo fanno
  `plan_shape` e `ShapeJob.here` (`nearby_starts.py`, ok del coordinatore),
  così resta anche quando vince una partenza vicina; `plan_nearby` lo
  toglie alle alternative.
- **Il campo è nuovo e facoltativo** (`shared-types`, `RouteResultBody`):
  `null` senza consiglio; le fixture di prima restano quelle di un'API
  precedente, e una nuova (`route-result-better-distance.json`) ha tutti i
  campi.

Il percorso scelto è identico: le impronte fissate dei test non cambiano.
Gli esempi della canoa e `engine.zip` sono rifatti solo perché `models.py`
è cambiato (in `paddleExamples.json` cambia solo `"engine"`).

**Parte B, l'app (2026-10-05)**: l'utente, viste le misure, ha detto «sì,
fai la parte B come previsto», e ha confermato i testi nelle cinque
lingue. Deciso dall'agente su delega dell'utente:

- **«This shape», non «This heart»**: con il nome della forma l'italiano,
  lo spagnolo, il francese e il tedesco dovrebbero accordare l'articolo al
  genere di ogni forma; le tabelle hanno una frase per testo
  (ADR-0172). Tre frasi: forma, parola («This word…»), contorno di
  un'immagine («This outline…»), come i messaggi di ADR-0041.
- **Sotto le tessere, grigia** come gli avvisi da sapere, con il pulsante
  secondario: il giallo resta del percorso e di «Start».
- **Della richiesta**: si legge dalla scelta del motore (la prima
  tessera), quindi resta anche con B o C selezionata.
- **Niente avanti e indietro**: dopo un «Try» la riga non propone la
  distanza appena lasciata, se il disegno, la partenza e l'attività sono
  gli stessi (`sameRequest`).
- **Nessun segnale nuovo** per il «Try» della riga: `hint_taken` resta
  quello degli errori; un `hint` nuovo toccherebbe `shared-types` e
  l'API, ed è un seguito.

## ADR-0199 — Seguire nell'app: il tasto sul profilo di un altro, tre numeri in «Profile» con i loro elenchi
**Stato**: Attiva · 2026-10-05 · deciso dall'agente su delega dell'utente
(TASK-211, parte B), dentro le **scelte dell'utente**: seguire vuole una
richiesta (2026-10-03, ADR-0173) e le richieste si vedono in «Profile»,
con i tre numeri «Requests», «Followers», «Following» che aprono gli
elenchi (2026-10-05, chiesto con «ho trovato il mio amico, ma non posso
seguirlo»). Numero preso come primo libero, detto al coordinatore.

**Contesto**: l'API di ADR-0173 è sul server dal 2026-10-03, ma l'app
aveva solo la ricerca (TASK-215): un iscritto trovato non si poteva
seguire, e chi riceveva una richiesta non aveva dove accettarla.

**Decisione**:

1. **Il tasto sul profilo di un altro** (`social/FollowButton.tsx`, sotto
   l'intestazione di `UserProfilePage`): «Follow» (bianco, l'unica cosa da
   fare lì; il giallo resta del percorso) manda la richiesta e diventa
   «Requested»; «Requested» toccato la ritira subito; «Following» chiede
   prima «Stop following {name}?» con «Keep it» e «Unfollow», nella
   pagina come le altre conferme dell'app, senza finestre di sistema. Lo
   stato mostrato è quello che risponde l'API, mai uno supposto prima. Sul
   proprio profilo e con un'API senza `follow` il tasto non c'è.
2. **La riga sotto il nome** di un altro: «12 drawings · 3 followers · 5
   following». Chi smette di seguire vede subito un follower in meno,
   senza richiedere il profilo.
3. **In «Profile»**, sotto «Edit profile», **tre numeri**
   (`social/FollowLists.tsx`): «Requests», «Followers», «Following». Un
   tocco apre l'elenco sotto la riga, un altro lo richiude: niente pagine
   nuove in `ProfileScreen`. «Requests» ha un pallino `warning` quando
   qualcuno aspetta: senza notifiche (TASK-185) è l'unico posto che lo
   dice.
4. **Negli elenchi**: una richiesta ha «Accept» (bianco) e «Decline»;
   accettata, la persona passa in «Followers» senza richiedere gli
   elenchi. Un follower ha «Remove», che chiede prima «Remove {name} from
   your followers?». «Following» non ha tasti: si smette dal profilo.
   Venti per pagina, poi «Show more».
5. **Un nome in un elenco apre il profilo** di quell'iscritto sopra l'app
   (`PeopleScreen` con `first`, senza la ricerca sotto); «←» torna a
   «Profile», che richiede i numeri.
6. **Un contesto nuovo**, `social/followsDoor.ts`, dato da `ProfileLayer`
   a «Profile»: l'API, l'account e la via al profilo di un iscritto. Le
   chiamate stanno in `api/follows.ts`.
7. **«Following» è una parola sola** per il tasto e per l'elenco: una
   traduzione che va per tutti e due (it «Segui già»), come «Keep it».
8. Con un'API senza gli elenchi (`404`) i tre numeri non si mostrano.

**Alternative scartate**: le richieste in cima a «Feed» (proposta
all'utente, non scelta); pagine proprie per gli elenchi dentro
`ProfileScreen` (più file di altri per lo stesso risultato); una finestra
di sistema per «Unfollow» (l'app non ne usa per le conferme); cambiare il
tasto prima della risposta dell'API (su una rete lenta direbbe
«Requested» per una richiesta mai arrivata).

**Conseguenze**: si può seguire e accettare, quindi «Followers» di
TASK-208 ha qualcuno da mostrare. Le richieste si scoprono solo aprendo
«Profile», fino alle notifiche (TASK-185). I testi nuovi, in cinque
lingue, sono da confermare con l'utente. Bloccare resta TASK-121.

## ADR-0190 — Il «Feed» sull'acqua: quattro post che leggono gli esempi dentro l'app

**Data**: 2026-10-05 · **Stato**: Accettato · **Task**: TASK-228 · quando
si vedono, quanti, dove e i nomi sono scelte dell'utente; il resto è deciso
dall'agente su delega dell'utente

**Contesto**: «Feed» mostra quindici disegni d'esempio della corsa
(ADR-0127), scritti in `sampleFeed.json` da `tools/sample_feed.py` a
partire dal catalogo. L'utente ha chiesto anche personaggi inventati con
percorsi fatti in canoa. Sull'acqua il catalogo non c'è: ci sono gli esempi
dei quattro luoghi dentro l'app (`paddleExamples.json`, ADR-0189),
disegnati dal motore sull'acqua del server. La condizione è che i percorsi
dei post vengano dal motore, mai disegnati a mano.

**Decisione**:

1. **Sempre, mescolati** (utente): i post sull'acqua stanno fra quelli
   della corsa con qualunque sport, il primo dopo due della corsa e poi
   uno ogni quattro.
2. **Quattro, uno per luogo** (utente): Lago di Garda, Lago di Como,
   Jesolo, Riccione, con cuore, stella, luna e testa di cane, da 2 km.
3. **I nomi** (utente): `greta_kayak`, `leo.sup`, `irene_onwater`,
   `ale.paddle`.
4. **I post non hanno coordinate loro**: `src/feed/paddlePosts.ts` tiene
   solo il luogo, la forma e ciò che è inventato (nome, titolo, minuti,
   punteggio), e legge il percorso da `PADDLE_EXAMPLES.bundled`. L'`id`
   del post è quello dell'esempio.
5. **Il tocco apre l'esempio**: `fetchPostRoute` di un post sull'acqua
   restituisce il percorso dentro l'app, senza chiedere all'API. Lo sport
   viene dal percorso (`activity: "paddling"`), come per un preferito o un
   esempio di «Explore»: lo sport scelto dall'utente non cambia.
6. **«Paddle» sulla scheda** è il nome dello sport come lo scrive il suo
   bottone (`SPORTS`), uguale in ogni lingua, in testa alla riga dei
   fatti: nessun testo nuovo da tradurre.
7. `SAMPLE_FEED` resta il nome di ciò che «Feed» mostra; i quindici della
   corsa sono `RUN_POSTS`.

**Alternative scartate**:

- Un `paddleFeed.json` scritto da un comando, come per la corsa: sarebbe
  una seconda copia delle stesse coordinate, da rifare a ogni cambio del
  motore sull'acqua insieme a `paddleExamples.json`.
- Percorsi di altre lunghezze disegnati apposta (scartata dall'utente):
  «Explore» non li avrebbe, e andrebbero tenuti dentro il feed.
- Cambiare lo sport scelto quando si apre un post sull'acqua: un tocco su
  un disegno non deve cambiare un'impostazione.
- Una targhetta «Paddle» sopra il disegno: vuole uno stile nuovo; la riga
  dei fatti c'è già e VoiceOver la legge.
- Mettere i post in `FeedScreen.tsx` o aprirli da `App.tsx`: sono i file
  di TASK-235, e non serve.

**Conseguenze**: nessun file di dati nuovo e nessun comando nuovo; il peso
dell'app non cambia. Rifare `paddleExamples.json` aggiorna anche i post;
se un luogo o una forma dei quattro manca, il post sparisce e
`paddlePosts.test.ts` lo dice. «Meanwhile, from the feed» in «Explore»
(TASK-163) mostra gli stessi 19 disegni, quindi a volte uno sull'acqua.
Senza API configurata un post toccato non si apre, come uno della corsa.
Il feed vero (TASK-118) dovrà dire lo sport di ogni disegno: il campo
`activity` di `SamplePost` è già quello.

## ADR-0196 — «Explore» della canoa come la corsa: l'elenco dei laghi dentro l'app, il più vicino per primo, forme più corte sui laghi piccoli

**Data**: 2026-10-05 · **Stato**: Accettato · **Task**: TASK-233 · «tutti
i laghi» e «come la corsa» sono richieste dell'utente; le forme più corte
sui laghi piccoli (sui campioni), «Near me» acceso da subito e i bacini
artificiali nell'elenco sono sue scelte del 2026-10-05, e i testi li ha
confermati lo stesso giorno; il resto è deciso dall'agente su delega
dell'utente

**Contesto**: con «Paddle», «Explore» aveva quattro luoghi scelti a mano
(ADR-0169, ADR-0189) e «Near me», che disegnava dalla partenza e funzionava
solo se la partenza era già sulla riva. L'utente, che sta a un chilometro
dal lago di Levico, non vedeva il suo lago. Ha chiesto tutti i laghi e una
pagina come quella della corsa.

**Decisione**:

- **L'elenco dei laghi viene con l'app** (`lakes.json`): nome, punto della
  riva, distanza delle forme. La ricerca per nome e «il più vicino» si
  fanno nel telefono, senza API. Gli esempi no: 25 KB a lago sarebbero
  megabyte, quindi li disegna il server quando il lago è scelto, come per
  una città.
- **Che cos'è un lago**: un'acqua su cui il motore pagaia (`water.is_lake`:
  `natural=water` con `water=lake`, `reservoir` o senza `water`), con un
  nome, e `water=lake`/`reservoir` oppure un nome che dice lago («Lago»,
  «Laghi», «Laghetto», «Lac», «…see»). Senza la regola del nome entravano
  valli da pesca, casse di laminazione e cave. I bacini artificiali ci
  sono (confermato dall'utente): OpenStreetMap non dice dove pagaiare è
  vietato, e l'avviso di sicurezza della canoa c'è già. Restano fuori le
  acque segnate come lago ma chiamate per quello che sono: «Centrale …»,
  «Cassa di …», «Vasca …», «Zona umida …» (trovate nell'estratto
  dell'Italia: il bacino di una centrale, una cassa di espansione, una
  zona umida).
- **Le forme sono da 2 km dove ci stanno, altrimenti da 1,5 o da 1 km**: la
  distanza più grande a cui cuore, cerchio e stella ci stanno tutti e tre,
  provata con il motore punto per punto. Sotto 1 km il motore non disegna,
  e il lago resta fuori. «Tutti i laghi» con le sole forme da 2 km erano 16
  su 41 nel nord-est.
- **Un punto ogni 4 km di riva** sui laghi lunghi: una richiesta parte entro
  2 km dal punto chiesto (`MOVE_MAX_M`), quindi così ogni tratto di riva ha
  le sue forme. L'app mostra un nome una volta, con il punto più vicino.
- **«Near me» è acceso da subito**, come nella corsa, e mostra il luogo
  dell'elenco più vicino entro 30 km. Più lontano resta com'era: le forme
  dalla partenza. I luoghi da toccare sono gli otto più vicini.
- **I quattro luoghi scelti a mano restano**, con i loro esempi dentro
  l'app: un punto dell'elenco con lo stesso nome entro 3 km è quel luogo.
- **Il comando legge `osmium export`** (un GeoJSON a riga), non il PBF:
  nessuna dipendenza nuova, e i multipoligoni li ricompone osmium.

**Alternative scartate**:

- Chiedere i laghi all'API (`GET /lakes`): un contratto nuovo e la rete
  per una ricerca che nel telefono pesa 7 KB.
- «Near me» che cerca l'acqua attorno alla partenza sul server: dipende da
  Overpass, che rifiuta (ADR-0187).
- Solo forme da 2 km: lascia fuori 25 laghi su 41.
- Gli esempi di ogni lago dentro l'app: 1 MB per il solo nord-est.

**Conseguenze**:

- **Il server deve avere l'acqua di ogni lago dell'elenco prima che l'app
  sia pubblicata** (parte B, con l'ok dell'utente): 41 file e 12 MB per il
  nord-est. Senza, un lago scelto dice «Map data for this area could not be
  downloaded.».
- L'elenco di questa PR è il nord-est: l'estratto dell'Italia è sul server.
- Con una partenza, aprire «Explore» con «Paddle» chiede subito all'API le
  otto forme del lago più vicino (prima non chiedeva niente fino al tocco).
- La frase d'attesa perde «of 2 km» nelle cinque lingue; tre testi nuovi,
  confermati dall'utente in inglese e in italiano.
- Il Lago di Ledro manca: in OpenStreetMap è `water=pond`. Seguito.
- Gli esempi a 1,5 e 1 km stanno sul telefono sotto chiavi loro
  (`paddling:1500:…`), a parte da quelli a 2 km.

**Aggiunta (2026-10-05, parte B)**: con l'ok dell'utente l'elenco è
dell'Italia intera, 211 laghi e 758 punti, e l'acqua di ognuno è sul
server (210 file, 50 MB). Il calcolo è stato fatto sul Mac dall'estratto
del server copiato in sola lettura, e sul server sono stati solo copiati i
file: niente CPU dell'API, niente riavvio.

## ADR-0198 — La pubblicità fra i post del «Feed»: un annuncio nativo ogni 5 post, niente più annuncio alla ricerca

**Data**: 2026-10-05 · **Stato**: Accettato · **Task**: TASK-235 ·
**Supera in parte ADR-0102**: l'annuncio a schermo intero all'inizio di
ogni ricerca non c'è più; restano AdMob, il consenso di Google, niente
ATT, niente annunci in Expo Go · il posto (fra i post del Feed, al posto
dell'annuncio della ricerca), l'annuncio nativo con «Sponsored» e uno ogni
5 post sono scelte dell'utente; il resto è deciso dall'agente su delega
dell'utente

**Contesto**: il 2026-10-05 l'utente ha scritto «La pubblicità le mettiamo
tra i post dei feed». Alla domanda se si aggiunge all'annuncio all'inizio
di ogni ricerca o lo sostituisce ha scelto **sostituisce**, con la
proposta che la accompagnava: un annuncio nativo con l'aspetto di un post,
la scritta «Sponsored», uno ogni 5 post. Il Feed oggi ha 19 post d'esempio
(ADR-0127, quattro in canoa da ADR-0190); il feed vero è TASK-118.

**Decisione**:

1. **Annunci nativi di AdMob** (`NativeAd`, `NativeAdView`, `NativeAsset`,
   `NativeMediaView` di `react-native-google-mobile-ads` 17.2, già
   nell'app): nessun pacchetto e nessuna configurazione nuovi. L'unità da
   `EXPO_PUBLIC_ADMOB_NATIVE_IOS` / `_ANDROID`; vuote, l'annuncio nativo
   di prova di Google. Si chiede il media orizzontale
   (`NativeMediaAspectRatio.LANDSCAPE`).
2. **Dove** (`feedWithAds`): dopo il 5°, il 10°, … post, solo se sotto c'è
   un altro post. Nessuno con 5 post o meno, uno con 6–10, tre con i 19
   d'esempio. Mai in cima, mai in fondo, mai due di fila. Un posto senza
   annuncio non lascia buchi.
3. **Quando** (`useFeedAds`): uno alla volta. Il primo si chiede quando il
   Feed è la pagina sullo schermo, il successivo quando l'utente arriva al
   posto del precedente (`AD_LOAD_AHEAD`, 5 post). Un posto il cui annuncio
   non arriva resta vuoto e non si richiede. Un annuncio che arriva quando
   il post sotto il suo posto è già stato sullo schermo va al primo posto
   ancora davanti, così i post che l'utente guarda non si spostano; se non
   ce n'è, si distrugge. Quando il Feed si smonta, i suoi annunci si
   distruggono.
4. **Consenso**: lo stesso modulo di Google (UMP, `gatherConsent`), una
   volta, alla prima richiesta di annuncio: la prima volta che l'utente
   apre il Feed. Il Feed si costruisce dietro «Draw» all'avvio, ma non
   chiede niente finché non è la pagina sullo schermo (`active`): niente
   all'apertura dell'app, come in ADR-0102. Senza `canRequestAds`, niente
   annunci.
5. **L'aspetto** (`FeedAd`): largo e arrotondato come un post. In alto,
   prima di tutto, «Sponsored» grande come il nome di un corridore
   (`fontSize.body`, colore dei testi), con l'icona quadrata (il corridore
   ha il cerchio) e il nome dell'inserzionista; poi il media, mai più alto
   che largo; poi titolo, testo e un pulsante grigio (il giallo è del
   percorso). Niente iniziale, punteggio, tempi; un tocco apre quello che
   dice l'annuncio, non la mappa. AdChoices lo mette l'SDK in alto a
   destra, dove la riga lascia spazio. «Sponsored» nelle cinque lingue.
6. **Via l'annuncio della ricerca**: `useAdBeforeRoute` e `routeAds` sono
   tolti; «Draw route» e «Ask for a route» non mostrano più annunci.

**Alternative scartate**: aggiungere gli annunci del Feed a quello della
ricerca (l'utente ha scelto di sostituirlo); un banner fra i post (si
vede come la pubblicità di un'altra app; l'utente ha chiesto l'aspetto di
un post); caricare tutti gli annunci all'apertura del Feed (traffico per
annunci che nessuno vede); mettere un annuncio arrivato tardi nel suo
posto anche se è sullo schermo (sposta i post sotto il dito); chiedere il
consenso all'avvio dell'app (ADR-0102: niente all'apertura).

**Conseguenze**: con i 19 post d'esempio al più tre annunci per visita
del Feed, meno impressioni di un annuncio a ogni ricerca. In Expo Go
nessun annuncio, come prima. Per gli annunci veri serve un'unità
**nativa** in AdMob: TASK-153 parla ancora di un'unità interstitial, e
`docs/PUBBLICITA.md` (branch di TASK-150) dice ancora «a ogni ricerca»;
li aggiornano i loro task. Il feed vero (TASK-118) usa la stessa
`feedWithAds`.

## ADR-0201 — Il sito web: una pagina statica in `site/`, e il merch venduto da un servizio di stampa su ordinazione
**Stato**: Attiva · 2026-10-05 · deciso dall'agente su delega dell'utente
(TASK-237), dentro la **scelta dell'utente**: le magliette si vendono con
la **stampa su ordinazione** (2026-10-05, fra quattro vie proposte: stampa
su ordinazione, magliette proprie con Stripe, negozio Shopify, sola
vetrina). Numero preso come primo libero, detto al coordinatore.

**Contesto**: l'utente ha chiesto il sito web con una sezione di
merchandising per vendere le magliette. Nel repository non c'era nessun
sito, e Sgrava non ha ancora un dominio.

**Decisione**:

1. **Una pagina statica in una cartella nuova, `site/`**: HTML, CSS e
   JavaScript scritti a mano, senza dipendenze e senza build. Sta fuori dai
   workspace npm (`apps/*`, `packages/*`) e da `prettier`, così non tocca
   `package.json`, `package-lock.json` né la CI dell'app. Si pubblica
   copiando la cartella su un qualsiasi servizio di pagine statiche.
2. **Il sito non vende niente da solo.** «Buy» apre la pagina della
   maglietta sul servizio di stampa (`buyUrl`), in una scheda nuova:
   pagamento, spedizione, resi e dati dei clienti restano al servizio. Il
   sito non ha carrello, non riceve carte né indirizzi, non mette cookie e
   non carica niente da altri siti.
3. **Le magliette stanno in un file solo**, `site/products.js`. Una
   maglietta è in vendita solo con un `buyUrl` `https`; altrimenti la
   scheda dice «Coming soon», e senza nessuna in vendita il negozio dice
   «The shop opens soon.». Il prezzo si mostra solo se c'è, e i test
   rifiutano una maglietta in vendita senza prezzo o senza il nome del
   servizio (`fulfilledBy`).
4. **Il sito non dipende da un servizio preciso**: gli serve solo un
   indirizzo per maglietta. Quale servizio usare lo sceglie l'utente, che
   ne apre l'account.
5. **Le stampe sono percorsi veri** di `catalog/seed/`, disegnati da
   `site/tools/make_prints.py` (solo libreria standard, proiezione in
   metri): il sito, come l'app, non inventa geometrie. Il credito
   «© OpenStreetMap contributors» sta in fondo alla pagina.
6. **I colori** sono dichiarati una volta in cima a `styles.css` e
   ricalcano `tokens.ts`: senza build il sito non può importarli.
7. **Il cuore in cima** è un SVG dentro la pagina, animato dal foglio di
   stile: la riga è intera se l'animazione non parte, e ferma con
   «riduci movimento».
8. **Test** con `node --test`, senza installare niente, in un workflow
   suo (`site.yml`) che gira solo quando cambia `site/`.
9. **Testi in inglese**, come l'interfaccia dell'app.

**Alternative scartate**: un negozio Shopify incorporato (canone mensile,
scartato dall'utente); un framework (Astro, Next) o la versione web
dell'app Expo (dipendenze nuove e una build per una pagina sola); le
magliette scritte dentro `index.html` (prezzo e indirizzo in più punti).

**Non deciso, dell'utente**: il servizio di stampa; magliette, nomi,
colori e prezzi (le quattro di adesso sono una proposta); i testi della
pagina; il dominio e dove pubblicare. Niente è pubblicato.

**Conseguenze**: chi vuole aggiungere o mettere in vendita una maglietta
tocca solo `products.js` (`docs/SITO.md`). Un cambio di colore in
`tokens.ts` va ripetuto in `styles.css`. Se un giorno servono un carrello
o più pagine, questa decisione va rivista.

**Aggiornamento del 2026-10-05, stesso giorno** (deciso dall'agente su
delega, dentro la **seconda richiesta dell'utente**: «per intanto fai solo
il sito web che spiega come utilizzare l'app, poi inseriremo il link per
scaricarla; un po' futuristico; poter selezionare lo sport; i post
migliori, una decina»):

1. **La pagina è la guida dell'app; il merch è messo da parte.** La
   sezione esce da `index.html`, ma `products.js`, `merch.js`, `merch.css`
   e `prints/` restano con i loro test: rimetterla è una sezione e due
   righe nell'intestazione. I punti 2–4 sopra valgono per quando torna.
2. **Lo sport si sceglie** («Run», «Bike», «Paddle») e cambia fatti e
   passi di «How it works». I testi stanno in `content.js` e dicono solo
   cose che l'app fa oggi.
3. **«Try it»**: una forma e una distanza scelte mostrano il percorso
   vero di Milano del catalogo (sei forme per 5, 10, 21 km). Niente è
   calcolato nel browser: il sito non ha un motore e non chiama l'API.
4. **«Best drawings» sono dieci percorsi veri** presi dai dati dell'app:
   sei corse dei disegni d'esempio del «Feed» e i quattro esempi
   sull'acqua, con i loro titoli. **Nomi degli utenti, minuti e punteggi
   d'esempio non si mostrano**: nell'app sono inventati, e su un sito
   pubblico sembrerebbero persone e risultati veri. Quando ci sarà il
   feed vero (TASK-118) si potrà scegliere da lì.
5. **I disegni sono copiati in `site/data/drawings.js`** da
   `make_drawings.py`, che legge i file dell'app senza toccarli e sfoltisce
   le linee (Douglas–Peucker a 2,5 m, in metri): il sito non dipende dai
   file dell'app mentre gira, e i test non si rompono se quelli cambiano.
6. **Il link per scaricare** è una riga in `config.js`; finché è `null`
   la pagina dice «Download — coming soon». Solo un indirizzo `https`
   diventa un link.
7. **L'aspetto «futuristico»**: griglia da mappa sullo sfondo, etichette
   a spaziatura fissa, angoli accesi sul pannello, la linea gialla con un
   alone. Sempre i colori di `tokens.ts` (il ciano è `startHere`, l'acqua
   è `map.water`); i toni intermedi si mescolano con `color-mix`, senza
   colori nuovi. Nessun font scaricato: quelli del sistema.

**Aggiornamento del 2026-10-08** (deciso dall'agente su delega, dentro la
richiesta dell'utente «fai il sito web per il nuovo nome» e la scelta del
logo di ADR-0224): il sito dice **MuW**. In alto il segno (il cuore su
giallo, `docs/brand/muw-mark.svg`) accanto alla scritta di
`docs/brand/muw-logo.svg`, ridisegnata da `make_prints.py` nel colore
`text` perché nera non si leggerebbe sul fondo scuro; il segno è anche
l'icona della scheda. I testi della guida seguono l'app di oggi: niente
punteggio (TASK-241), «Feed» fra le pagine (TASK-118).

**Aggiornamento del 2026-10-08, la pagina della privacy** (TASK-237 D;
il dove deciso dal Coordinatore, i dati e lo stato **scelte
dell'utente**, il modo deciso dall'agente su delega): `getmuw.app/privacy/`
è il testo «Privacy» dell'app, non una copia scritta a mano. Lo script
`site/tools/make_privacy.mjs` carica i file dell'app (Node 24 li legge
così come sono, importano solo tipi) e scrive una pagina statica per
lingua, con la stessa avvertenza di bozza quando c'è; un test le
confronta con l'app, e la CI del sito gira anche quando cambia quel
testo. I dati mancanti si scrivono una volta sola, nell'app: titolare,
email, basi giuridiche e data sono dell'utente, e «Privacy» è
definitiva dall'8 ottobre 2026. L'app mostra la data anche su un testo
definitivo. Scartato: una pagina scritta a parte per il sito (due testi
che si separano al primo cambio); un servizio esterno di informative
(un testo generico, che non dice cosa fa MuW).

## ADR-0200 — I paesi vicini sotto «Near me»: quattro paesi e i due posti più vicini, dal Places di Geoapify, con i campioni chiesti dal telefono

**Data**: 2026-10-05 · **Stato**: Accettato · **Task**: TASK-236 ·
la sezione, i 20–50 km, i quattro paesi, i due più vicini «anche se
piccoli» e i campioni sono scelte dell'utente; il resto è deciso
dall'agente su delega dell'utente

**Contesto**: l'utente: «favorisci la sezione Near me con una
sottocategoria con le città vicine a me, fai 20, 50 km in base alla città,
suggeriscine massimo quattro, e poi inizia a scaricare tutte le mappe di
quei quattro paesi, qualcosina per qualche campione». Oggi «Near me»
mostra i percorsi entro 5 km dalla partenza; un paese accanto si trova
solo scrivendone il nome.

**Decisione**:

1. **Da dove vengono i paesi**: `place=city` e `place=town` di
   OpenStreetMap, dal Places di Geoapify (`populated_place.city`,
   `populated_place.town`) con la chiave che l'API ha già. Punto ed
   etichetta sono quelli che `GET /cities` dà per lo stesso nome (lo
   stesso nodo di OpenStreetMap: provato su Levico, Pergine, Borgo,
   Trento, Rovereto): un paese toccato qui e lo stesso paese scritto sono
   una città sola, con gli stessi esempi tenuti (ADR-0136).
2. **Quali quattro**: quelli entro 20 km, i più grandi per abitanti; se
   sono meno di quattro, il cerchio si allarga fino a 50 km e la lista si
   riempie con i più vicini oltre i 20. Mostrati dal più vicino. Il paese in cui si è (centro entro
   1,5 km, come `OWN_RADIUS_M`) resta fuori: è già «Near me». Fra questi
   quattro i villaggi (`place=village`) no: intorno a una città sarebbero
   decine. Da Caldonazzo: Levico, Pergine, Trento, Borgo. Dal centro di Trento:
   Pergine, Levico, poi Rovereto (21 km) e Arco (25 km). Da Livigno:
   Bormio, St. Moritz, Glorenza, Tirano. Da Milano, i quattro più grandi
   entro 20 km (Monza, Sesto San Giovanni, Cinisello, Cologno). Provati
   sul servizio vero il 2026-10-05.
   **Più i due posti più vicini, anche se piccoli** (risposta dell'utente
   del 2026-10-05 alla regola qui sopra: «va bene così, magari aggiungine
   altri due e sono i più vicini anche se piccoli»): fra città, paesi e
   villaggi (`populated_place.village`) entro 20 km, i due più vicini che
   non sono già fra i quattro. Sei in tutto, mostrati dal più vicino alla
   posizione. Da Caldonazzo si aggiungono Tenna e Calceranica al Lago; dal
   centro di Trento Sardagna e Vela; da Milano Lavanderie e Linate; da
   Livigno Trepalle e Semogo. «Dove si è» è il posto più vicino di tutti,
   se ha il centro entro 1,5 km, e solo quello: da Caldonazzo, Calceranica
   è a 1,6 km e resta.
3. **La posizione**: al servizio va il centro di un quadrato di circa
   1 km (2 decimali), non la posizione; la risposta è tenuta un giorno in
   memoria. Negli eventi non si scrive niente.
4. **Le mappe e i campioni li chiede il telefono**, non il server da
   solo: mentre la sezione è sulla pagina l'app chiede per ogni paese, uno
   alla volta, cerchio, cuore e stella da 5 km dal centro, con la stessa
   richiesta degli esempi di una città (ADR-0144: il cerchio per primo, la
   sua zona tiene le altre). Il server scarica la zona alla prima e tiene
   ogni percorso: i centri dei paesi vicini sono centri di città per
   `route_store`. Sei paesi sono 18 richieste, un minuto e mezzo. Al più
   una richiesta ogni 5 s (12 al minuto: con le 18
   degli esempi di una città restano nei 30 POST al minuto di un
   telefono, ADR-0076). Si fermano quando la sezione lascia la pagina, e
   al primo guaio che non è di una forma (zona non scaricata, rete, troppe
   richieste). Una richiesta che non arriva all'API si rifà una volta dopo
   1 s: uvicorn chiude una connessione ferma da 5 s, proprio l'intervallo
   fra due campioni, e nel simulatore una richiesta su sei andava persa.
5. **Nell'app**: una fila di schede da scorrere sotto la fila delle
   città, solo con «Near me»: il nome, la distanza, e un campione
   disegnato sulla sua mappa (il cuore, o quello che c'è prima). Un tocco
   apre il paese come città scelta. Corsa e bici; la canoa ha i laghi
   vicini (TASK-233).

**Alternative scartate**:

- **Un elenco di città dentro l'API** (GeoNames): un file di dati da
  tenere aggiornato, con punti ed etichette diversi da quelli di
  `/cities`, quindi esempi doppi.
- **Overpass** per i `place=*`: rifiuta dopo pochi download (`MAPS.md`), e
  serve già alle zone.
- **Il server che scarica e disegna da solo** a ogni `GET /nearby-cities`:
  lavoro che nessuno guarda quando l'app si chiude, e download da Overpass
  senza un telefono che li aspetti.
- **I più vicini invece dei più grandi, entro 20 km**: intorno a Milano
  sarebbero Corsico, Cesano Boscone, Buccinasco, Bresso.
- **I più grandi anche oltre i 20 km**: da Trento usciva Schio, a 44 km
  oltre le montagne, prima di Arco e Riva.
- **Riusare `drawExamples`** per i campioni: disegna una città alla volta,
  e i paesi vicini fermerebbero gli esempi della città scelta.

**Conseguenze**:

- Una posizione nuova costa al più 14 crediti di Geoapify (4 richieste) e,
  la prima volta, fino a 6 zone scaricate da Overpass e 18 percorsi sul
  server (7–19 s l'uno, TASK-168), uno alla volta. Un villaggio accanto a
  un paese sta di solito nella zona di quello, e non ne scarica un'altra.
- Un server senza `GET /nearby-cities` risponde 404: la sezione non
  compare, il resto di «Explore» è com'era. L'app si può pubblicare prima
  del server.
- I campioni restano in memoria per un'apertura dell'app; riaperti, il
  server risponde subito da quelli tenuti.
- TASK-214 B2 può chiedere i paesi vicini allo stesso endpoint.

## ADR-0204 — Con «Paddle», i laghi e le spiagge nella ricerca di «Another place»: dall'elenco dentro l'app, sopra i luoghi trovati
**Stato**: Attiva · 2026-10-05 · deciso dall'agente su delega dell'utente
(TASK-240), dentro la **richiesta dell'utente** del 2026-10-05: con
«Paddle», in «Draw», «Another place» deve far scegliere anche i laghi e i
mari («lago di Levico Terme» dava solo «Via al Lago»). La regola delle
parole, il mare, la distanza sui laghi piccoli e il testo del campo sono
**scelte dell'utente** del 2026-10-05, proposte una alla volta e tutte
confermate (`tasks/TASK-240.md`, «Scelte dell'utente»). Numero dato dal
coordinatore.

**Contesto**: la ricerca della partenza chiede i luoghi all'API
(Geoapify) o a Photon, che per un lago rispondono con vie e paesi. L'app
ha già l'elenco dei laghi su cui il motore pagaia, con un punto sulla riva
e la distanza a cui le forme ci stanno (`WATER_SPOTS`, TASK-233,
ADR-0196), e il server ha l'acqua solo di quelli. La ricerca di «Explore»
(`searchSpots`) vuole ogni parola scritta nel nome: «lago di Levico Terme»
non trova niente, per «Terme».

**Decisione**:

1. **I laghi vengono dall'elenco dentro l'app, non dalla ricerca in
   rete.** `PlaceSearch` riceve `suggest`, una funzione che dà subito i
   luoghi che l'app conosce per il testo scritto; li mostra sopra quelli
   trovati, senza ripetere un'etichetta uguale. Senza `suggest` è quella
   di prima: `App.tsx` la passa solo con «Paddle». Niente API, niente
   server, nessuna richiesta in più.
2. **Il testo si legge come un indirizzo** (`findSpots`, in
   `src/paddle/placeSpots.ts`): le parole scritte che non cominciano
   nessuna parola di nessun nome si ignorano; le parole **comuni**, quelle
   in più del 2% dei nomi (oggi «lago», «di», «del», «san», «d», «della»),
   non servono a trovare un lago quando un'altra parola, di almeno 3
   lettere, lo dice. Con sole parole comuni vale la regola di «Explore»
   (tutte nel nome), e se una parola è stata ignorata non si propone
   niente: «via al lago» non è un lago. Le parole comuni si contano
   sull'elenco, non stanno scritte a mano.
3. **Al massimo tre laghi**, il più vicino per primo; di un lago lungo il
   punto della riva più vicino alla posizione (`byName`).
4. **Un lago scelto è un luogo con la sua distanza** (`SpotPlace`): se le
   sue forme stanno a meno di 2 km e la distanza scritta è più lunga, il
   campo scende a quella (`distanceOnSpot`). Non sale mai, e un lago da
   2 km non la tocca: 2 km è la distanza a cui è stato provato, non la più
   lunga che tiene.
5. `searchSpots` e «Explore» non cambiano: lì si sceglie fra laghi, e una
   parola in più è un errore di battitura da far vedere.

**Alternative scartate**:

- **Aggiungere i laghi a `GET /places`**: vuole l'elenco anche nell'API e
  un aggiornamento del server, e i laghi arriverebbero dopo 2–3 s come le
  vie; l'elenco è già nel telefono.
- **Avvolgere `find`** (la funzione che cerca) invece di un prop nuovo: i
  laghi comparirebbero solo quando la rete risponde, e sparirebbero con un
  errore di rete.
- **Allentare `searchSpots`** per tutti: cambierebbe «Explore», che è di
  TASK-233 e ha i suoi testi («No lake or beach matches…»).
- **Un elenco scritto a mano di parole da ignorare** («terme», «via»,
  «lido»): non finisce mai, e cambia con la lingua.
- **Chiedere a Photon solo i laghi** (`osm_tag=natural:water`): troverebbe
  anche i laghi fuori elenco, di cui il server non ha l'acqua.

**Conseguenze**:

- Una via che contiene una parola del nome di un lago mostra quel lago
  sopra le vie («via Monte Grappa»: due laghi «Monte…»). Solo con
  «Paddle», e al massimo tre righe.
- Il mare resta alle due spiagge dell'elenco; le altre partenze sul mare
  sono le vie e i paesi di prima, e dipendono dall'acqua che il server ha
  o riesce a scaricare.
- Un elenco nuovo (`lakes.json` rifatto) cambia da solo le parole comuni.

## ADR-0202 — Spostare la figura sull'acqua: l'utente dice «vicino a dove», il motore decide il posto

**Data**: 2026-10-05 · **Stato**: Accettato · **Task**: TASK-238 ·
trascinare la figura col dito è una **scelta dell'utente** (2026-10-05,
fra tre proposte: quattro pulsanti, quattro frecce, il dito); il resto è
deciso dall'agente su delega dell'utente. Numero preso come primo libero
di `AGENTI.md`, detto al coordinatore.

**Contesto**: l'utente: «dai la possibilità nella sezione padel di poter
spostare la figura un po' più destra sinistro, un po' più vicini alla
riva». Sull'acqua il posto della forma lo sceglie il motore (ADR-0154,
ADR-0161): quello dove il tratto dalla riva costa meno. Chi vuole la
figura davanti a un'altra spiaggia, o più al largo, non aveva modo di
dirlo. Il principio di `CLAUDE.md` resta: il percorso lo decide il
motore, mai l'app.

**Decisione**:

1. **Una preferenza, non una coordinata**. La richiesta può avere `near`,
   il punto dove si vuole il centro della forma; il risultato ha `centre`,
   dove il motore l'ha messo. L'app manda `centre` più lo spostamento del
   dito. Il motore mette la forma **nel posto più vicino a `near` in cui
   ci sta**: stessa fascia, stessi margini dalla riva, stessa partenza
   raggiungibile a piedi entro 300 m, stessi 2 km dalla partenza chiesta.
2. **La stessa ricerca**, non una seconda: `fit_shape(..., near=)` guarda
   i posti più vicini a `near` invece dei più comodi dalla riva, e mette
   nel costo i metri di distanza da lì (`NEAR_WEIGHT = 10` per metro sulla
   distanza chiesta: il posto conta più del tratto dalla riva, che pesa 2
   all'andata e 2 al ritorno). Scala e rotazione le cerca come sempre.
3. **I primi 30 m non costano** (`NEAR_FREE_M`). Senza, la forma si
   rimpiccioliva dell'11% per stare 20 m più vicina al punto chiesto, e si
   inclinava da −15° a +15° per 10 m. Un dito sulla mappa non distingue
   30 m; una forma più piccola si vede.
4. **Solo sull'acqua**. Su strada `near` è `invalid_request`: lì il posto
   lo trova la ricerca fra le strade, e spostare la forma a mano
   cambierebbe quanto il percorso le somiglia.
5. **`start` non cambia** fra uno spostamento e l'altro: è la partenza
   chiesta all'inizio. Così l'acqua è lo stesso file della cache, e la
   figura non si allontana a passi oltre i 2 km da dove l'utente è.
6. **Un percorso spostato non si tiene** fra gli esempi (`route_store`): è
   di chi l'ha spostato, come il contorno di un'immagine.
7. **I campi sono facoltativi** nel contratto. Un'app di prima non manda
   `near`; un'API di prima lo rifiuta, e l'app offre lo spostamento solo
   se il risultato ha `centre`.
8. **Il trascinamento è un modo, non un gesto in più** (parte B). Fuori
   da «Move the shape» la mappa è quella di sempre: un dito la sposta, due
   la ingrandiscono. Dentro, **un dito sposta la forma, ovunque tocchi**
   (non serve prendere la linea, che su un telefono è larga pochi pixel),
   e la mappa non si sposta (`dragPan` spento, `touch-action: none` sulla
   mappa); **due dita fanno ancora lo zoom**, e se arrivano a metà
   trascinamento rimettono la forma dov'era, senza dire niente all'app. Un
   dito che si muove meno di 8 px non ha spostato niente. Dal modo si esce
   lasciando la forma o con «Cancel». Così i due gesti non si possono
   confondere: lo dice il pannello sotto la mappa, non la distanza del
   dito dalla linea.
9. **La forma resta dove il dito l'ha lasciata** finché il motore non
   risponde: la pagina tiene il percorso di prima traslato, l'app non lo
   ridisegna (gli stessi array), poi arriva quello vero. Se il motore l'ha
   messo a più di 80 m da lì, una riga lo dice.

**Alternative scartate**: mandare uno spostamento in metri rispetto al
posto automatico (il motore dovrebbe piazzare due volte, e dopo il primo
spostamento «da dove» non è più il posto automatico); far calcolare il
centro all'app dai punti del percorso (i tratti dalla riva e i pezzi a
penna alzata lo spostano: chiesta dov'è, la forma si muoverebbe);
rispettare il punto a ogni costo (porta la forma sulla terra o fuori
dalla fascia: la sicurezza dei margini è una scelta dell'utente del
2026-10-03); far scegliere all'app anche scala e rotazione (è TASK-232, e
resta del motore); tenere fissi scala e rotazione di prima (in una baia
stretta la forma non ci starebbe più, e la richiesta dovrebbe portarli);
prendere la forma toccando la linea, senza un modo (la linea è larga
4 px, e un dito accanto sposterebbe la mappa: lo stesso gesto farebbe due
cose); tenere premuto per prenderla (un gesto che nessuno scopre da solo).

**Conseguenze**:

- Uno spostamento costa 1–6 s sull'acqua vera, contro 0,5–1,7 s del posto
  automatico: il costo del posto toglie potature alla ricerca.
- La forma può fermarsi prima di dove è stata lasciata, e uscirne più
  piccola (entro il ±10% della distanza) o inclinata diversamente: l'app
  lo deve dire, non nasconderlo (parte B).
- Senza `near` il motore è quello di prima: i 32 esempi della canoa
  dentro l'app, ridisegnati sull'acqua del server, sono identici. Cambia
  solo l'impronta del motore (`paddleExamples.json`, `engine.zip`), e sul
  server vanno ridisegnati gli esempi tenuti (`draw_examples`).
- Gli esempi di «Explore» con «Paddle» non hanno `centre`: per spostarli
  serve ridisegnarli o chiedere il percorso al server (parte B).

**Aggiunta del 2026-10-05 (TASK-244)** — gli esempi di «Explore» con
«Paddle» si spostano anche loro; che il percorso spostato **resti di
«Explore»** è una scelta dell'utente (2026-10-05, l'altra proposta: farlo
diventare il percorso di «Draw»), il resto è deciso dall'agente su delega
dell'utente.

10. **L'esempio dice dov'è la sua forma**: `centre` è scritto nei 32
    esempi dentro l'app (`paddle_examples.py`; ridisegnati sull'acqua del
    server sono identici, con `centre` in più) e tenuto per quelli chiesti
    al server, anche nel file del telefono. Un esempio tenuto prima non ce
    l'ha e non si sposta finché non è ridisegnato: non lo si ridisegna
    apposta, perché senza rete sparirebbe.
11. **Si richiede l'esempio com'era stato chiesto**, con `near`: l'app
    ricorda la richiesta di ogni esempio pronto, con **la partenza del
    luogo** e non quella del percorso sulla riva. È il punto 5: la stessa
    partenza è lo stesso file dell'acqua, e nessun download in più.
12. **La risposta prende il posto dell'esempio sulla mappa, non nella
    lista**: la scheda resta quella di «Explore», e riaprendola dalla
    lista c'è l'esempio com'era (il punto 6 dal lato dell'app). Se la
    richiesta fallisce torna il percorso di prima, con una riga che dice
    perché.
13. **Solo aperto da «Explore»**: lo stesso esempio aperto dal «Feed»
    (TASK-228) o un preferito non si spostano. Scartato: scrivere nella
    richiesta la partenza del percorso (`points[0]`), che l'esempio ha già
    (un'altra area dell'acqua, forse da scaricare); far passare il
    percorso spostato a «Draw» (la sua pagina avrebbe forma, distanza e
    partenza diverse da quelle sulla mappa).

## ADR-0207 — Niente punteggio sopra il disegno dei post del «Feed»

**Data**: 2026-10-05 · **Stato**: Accettato · **Task**: TASK-241 ·
togliere il punteggio dalle foto dei post è una scelta dell'utente; il
resto è deciso dall'agente su delega dell'utente

**Contesto**: ogni post del «Feed» aveva, in basso a sinistra sopra il
disegno, un riquadro con il punteggio («98», «out of 100»; TASK-156,
ADR-0127). Il 2026-10-05 l'utente ha scritto «togli dalle foto dei post
98 su 100 - 93 su 100...».

**Decisione**:

1. Il riquadro è tolto da `FeedPost`: sopra il disegno resta solo il
   credito della mappa. Vale anche per i post che «Explore» mostra mentre
   disegna una città, che sono lo stesso componente.
2. Il punteggio non va altrove nella scheda (né nel titolo né nella riga
   dei fatti): l'utente ha chiesto di toglierlo, non di spostarlo.
3. L'etichetta di VoiceOver dice ancora «Score 92 out of 100»: toglierlo
   vuole una chiave nuova nei file `src/i18n/*`, che un altro task aveva
   in lavorazione (TASK-239, PR #343).
4. Il campo `score` resta nei post d'esempio (`sampleFeed`) e, altrove
   nell'app, il punteggio si vede come prima: a fine corsa, in «My
   activities», sotto un disegno aperto dal «Profile», nel post da
   condividere.

**Alternative scartate**: spostare il punteggio nella riga dei fatti
(l'utente ha detto «togli»); toglierlo da tutta l'app (la richiesta parla
delle foto dei post); togliere `score` dai dati d'esempio (lo legge
ancora VoiceOver, e il feed vero, TASK-118, lo avrà dall'API).

**Conseguenze**: nel «Feed» chi vede non sa più quanto un disegno
somiglia alla forma, chi ascolta sì: da allineare con l'utente quando i
file delle lingue sono liberi.

**Aggiornamento** (2026-10-05, stesso giorno, TASK-241 parte B; scelta
dell'utente: «sì toglilo anche da VoiceOver»): il punto 3 non vale più.
L'etichetta del post è «{user} in {city}: {title}. {facts}.», senza
punteggio, in inglese e nelle quattro tabelle (`de`, `es`, `fr`, `it`).
Chi ascolta sente quello che gli altri vedono.

**Aggiornamento** (2026-10-05, stesso giorno, TASK-241 parte C; scelta
dell'utente: «togli il punteggio anche dal post da condividere»): del
punto 4 non vale più «nel post da condividere». Nel post di «Share»
(ADR-0194) i risultati sono tre, «Distance», «Time», «Pace»: «Score» non
si può accendere, non è sull'immagine e, poiché il testo per Strava è
fatto dei risultati accesi, non va nemmeno là (deciso dall'agente su
delega: un punteggio nel testo e non nel post direbbe due cose diverse).
`PostRun` non porta più il punteggio e `postOfTrack` non lo riceve; la
chiave «Score» esce dalle quattro tabelle, «Score {score}» resta per «My
activities» e i disegni del «Profile». A fine corsa, in «My activities» e
sotto un disegno aperto dal «Profile» il punteggio si vede come prima.

**Aggiornamento** (2026-10-05, stesso giorno, TASK-241 parte D; scelta
dell'utente: «toglilo anche da My activities»): in «My activities» il
punteggio non si vede e non si legge più, né nella riga dell'elenco
(«Score 91») né sulla corsa aperta («91», «out of 100»). L'API lo tiene
e lo manda come prima (`score` in `/me/activities`): l'app non lo
mostra. Le chiavi «Score {score}», «Score: {score} out of 100» e «out of
100» restano nelle tabelle perché le usano i disegni del «Profile»
(`DrawingsGrid`, `DrawingCard`), dove il punteggio si vede ancora, come
a fine corsa: l'utente non li ha nominati.

**Aggiornamento** (2026-10-05, stesso giorno, TASK-241 parte E; scelte
dell'utente: «sì toglilo anche da lì» per la fine corsa e i disegni del
«Profile», e «Solo km e tempo» alla domanda su cosa mostra la scheda di
fine corsa). **Il punteggio non si vede e non si legge più da nessuna
parte nell'app.**

1. **Disegni del «Profile»**: niente «Score 87» sotto il disegno della
   griglia, niente riquadro sul disegno aperto; l'etichetta è «{title},
   open on the map» per tutti.
2. **Fine corsa** (supera in parte ADR-0090 e ADR-0093, per quello che
   l'app mostra): la scheda ha una riga, «4.0 km · 32 min», e i pulsanti
   di prima. L'app **non chiede più `POST /track-scores`**: via «Scoring
   your run…», «Too short for a score», «The score will come later»,
   «The score did not arrive», «Try again» e «97% of the route».
3. **«Done» senza account** toglie sempre la corsa dal file: non c'è più
   un punteggio da aspettare alla prossima apertura (deciso dall'agente
   su delega, conseguenza del punto 2).
4. **L'API non cambia**: `POST /track-scores` resta, e le corse salvate
   hanno ancora `score`, calcolato da sé. `src/api/trackScores.ts` resta
   nell'app senza che una schermata lo chiami (deciso dall'agente: i test
   della penna alzata leggono `toScoreRequest`; toglierlo è un seguito).
5. **Le chiavi** «Score {score}», «Score: {score} out of 100», «out of
   100» e «{title}, score {score} out of 100, open on the map» escono
   dalle quattro tabelle.
6. **«Help» e «Terms»** (`src/about/content/`, bozze di TASK-184): tolta
   la frase «At the end, a score out of 100 tells how close you drew the
   shape.» e «and score» da «Distances, times, speed and score come from
   the phone's GPS». **«Privacy» non è toccata**: dice che il server
   tiene il punteggio delle corse salvate (vero) e nomina l'evento «a run
   scored», che l'app non manda più; è un testo dell'utente.

**Alternative scartate**: tenere «97% of the route» (l'utente ha scelto
solo km e tempo; avrebbe tenuto la richiesta all'API, l'attesa e i
messaggi senza rete); togliere `score` dall'API (altro contratto, usato
dai dati già salvati; non chiesto).

**Aggiornamento** (2026-10-06, TASK-247, seguito di TASK-241; scelta dell'utente:
«si» alla domanda «vuoi che il server torni a registrare l'evento "run
scored" quando una corsa viene salvata?»). Il punto 4 cambia: **l'API
registra `run_scored` al salvataggio**. Il resto è deciso dall'agente su
delega dell'utente:

1. **Quando**: al primo `PUT /me/activities/{key}` di una corsa (`201`)
   che ha un punteggio. Non a una ripetizione della stessa chiave (`200`:
   l'outbox dell'app rimanda), non per una corsa senza percorso o troppo
   corta per un punteggio.
2. **Cosa**: solo `quality` (punteggio / 100, tre decimali), come faceva
   `POST /track-scores`. Niente account, luogo, forma o titolo: gli
   `insights` restano senza niente che dica chi è (ADR-0101).
3. **`POST /track-scores` non cambia** e registra ancora l'evento: l'app
   da TASK-241 non lo chiama. Un'app più vecchia conta la stessa corsa
   due volte finché non si aggiorna; non vale un cambio dell'endpoint.
4. **Cosa si conta adesso**: le corse lungo un percorso **salvate da chi
   ha un account**. Prima erano tutte le corse finite con un punteggio,
   anche senza account e anche se poi scartate.
5. **«Privacy»**: torna «a run scored» fra gli eventi tenuti (tolto con la
   parte F), in inglese e in italiano.

**Alternative scartate**: spostare l'evento togliendolo da `POST
/track-scores` (cambia un endpoint che le app vecchie usano ancora);
registrarlo dall'app con `POST /signals` (il telefono non ha più il
punteggio); contare anche le corse senza account (non arrivano al
server).

## ADR-0203 — Le richieste di follow si vedono da fuori: un numero rosso sul pulsante di «Profile», e «Follow back» nella riga accettata
**Stato**: Attiva · 2026-10-05 · deciso dall'agente su delega dell'utente
(TASK-239), dentro la **richiesta dell'utente** dello stesso giorno: «deve
arrivarti una notifica quando ti mettono un follower… sulla foto in alto a
destra, tipo un pallino rosso oppure uno rosso che dice la notifica, e
quando accetti puoi seguire subito». Numero dato dal coordinatore.

**Contesto**: con ADR-0199 una richiesta si vedeva solo aprendo «Profile»
(un pallino arancio su «Requests»), e per seguire a propria volta chi si
era appena accettato servivano il suo profilo e il ritorno: cinque tocchi.

**Decisione**:

1. **Un numero, non un pallino**: sul pulsante di «Profile»
   (`ProfileButton`), sopra l'angolo in alto a destra, un tondo rosso con
   quante richieste aspettano, «9+» oltre nove
   (`social/RequestsBadge.tsx`). Fra le due forme dette dall'utente è
   quella che dice di più nello stesso spazio.
2. **Rosso, con due colori nuovi** in `tokens.ts`: `badge` `#E02D2D` e
   `onBadge` bianco (4,6:1). `error` (`#FF6B6B`) è troppo chiaro per un
   numero bianco e vuol dire un'altra cosa; `warning` è degli avvisi sul
   percorso. Il pallino di «Requests» in «Profile» passa allo stesso
   rosso: un colore solo per «qualcuno aspetta te».
3. **Conta le richieste in attesa, non quelle «non viste»**: sparisce
   quando ognuna ha avuto «Accept» o «Decline». Non serve ricordare sul
   telefono cosa è stato visto, e una richiesta guardata e lasciata lì
   resta una cosa da fare.
4. **L'app chiede il numero da sola**
   (`social/followRequests.ts`): con un account all'apertura, ogni 60
   secondi mentre è sullo schermo, e quando ci torna; in secondo piano
   niente. Chiede `GET /me/follow-requests?limit=1` e legge `total`: una
   persona sola per risposta, nessun endpoint nuovo. Senza risposta resta
   l'ultimo numero; con un `404` (API senza gli elenchi) non chiede più.
5. **Gli elenchi di «Profile» sanno il numero meglio**: dopo ogni
   risposta lo dicono a `ProfileLayer` (`onRequests` in `followsDoor.ts`),
   e una risposta dell'API chiesta prima viene scartata.
6. **«Requests» è già aperto** se qualcuno aspetta quando «Profile» si
   apre: il numero rosso porta dritto a chi ha chiesto.
7. **«Follow back» nella stessa riga**: accettata, la persona resta in
   «Requests» (che non la conta più) con «Follow back» al posto dei due
   tasti. Prima di mostrarlo l'app chiede il profilo (`GET /users/{id}`,
   campo `follow`): chi è già seguito ha la scritta «Following», chi ha già
   una richiesta «Requested». Se il profilo non risponde il tasto c'è lo
   stesso: chiedere due volte non cambia niente (ADR-0173).
8. **Niente notifiche del telefono**: ad app chiusa non arriva niente.
   Servono una dipendenza nuova (`expo-notifications`), una build propria e
   il server che le manda: restano TASK-185, da decidere con l'utente.

**Alternative scartate**: il numero anche sulla foto grande dentro
«Profile» (quel cerchio cambia la foto: un numero lì farebbe credere che
apra le richieste); lo stato `follow` dentro `Person` negli elenchi
(cambia un contratto dell'API già sul server per risparmiare una
richiesta); chiedere il numero solo all'apertura (una richiesta arrivata
con l'app aperta non si vedrebbe fino al giorno dopo); una connessione
sempre aperta col server (troppo per un numero).

**Conseguenze**:

- Un telefono con l'app aperta fa una richiesta piccola al minuto in più.
- Solo app: si può pubblicare senza toccare il server.
- Quattro testi nuovi in inglese e nelle quattro lingue: «Follow back»,
  «Follow {name} back», «Profile, {count} follow request(s)».

**Confermato dall'utente** (2026-10-05, «va bene così, tieni il giro al
minuto e fai il merge»): il numero (punto 1), quando si spegne (punto 3),
i testi, e il giro ogni 60 secondi (punto 4), che il coordinatore
proponeva di togliere per non caricare il server.

## ADR-0150 — Cambiare email e numero di telefono: l'email con la password e senza mail di conferma, il numero privato e non provato
**Stato**: Attiva · 2026-10-05 · deciso dall'agente su delega dell'utente
(TASK-183), dentro le **scelte dell'utente** del 2026-10-05: il numero di
telefono serve a farsi trovare dagli amici che lo hanno già, e il cambio
email vale subito, con la password, finché non c'è un servizio di posta.
Numero tenuto dal coordinatore dal 2026-10-02.

**Contesto**: «Change email» e «Phone number» erano in «Settings» con
«Soon» (ADR-0145). L'API non manda email (nessun servizio di posta: è
anche il motivo per cui la password dimenticata non c'è, TASK-114) e non
manda SMS.

**Decisione**:

1. **Due endpoint nuovi, non `PATCH /me`**: `PUT /me/email` e
   `PUT /me/phone`, in `contact.py`. `PATCH /me` (ADR-0128) cambia quello
   che gli altri vedono e non chiede la password; l'email è la chiave con
   cui si entra e la chiede. Tenerli separati lascia `PATCH /me` com'è per
   l'app pubblicata.
2. **L'email cambia con la password dell'account**, riscritta: il token da
   solo, su un telefono lasciato sbloccato, non basta a portare l'account
   a un altro indirizzo. La password sbagliata è `403 wrong_credentials`
   (non `401`: la sessione vale ancora, e l'app non deve uscire) e conta
   con le password sbagliate dell'accesso, per l'email di adesso: dopo 5
   in 15 minuti, `429` qui e all'accesso.
3. **Niente mail di conferma**: il nuovo indirizzo vale subito. Chi lo
   scrive sbagliato e poi esce non rientra più, perché non c'è ancora la
   password dimenticata: per questo «Settings» mostra subito il nuovo
   indirizzo, sopra la riga. Quando ci sarà la posta: conferma al nuovo
   indirizzo e avviso al vecchio.
4. **Le altre sessioni restano aperte**: cambiare email non è cambiare
   password.
5. **Il numero di telefono** sta in `users.phone`, in E.164 («+» e da 8 a
   15 cifre), `NULL` senza. Si scrive con il prefisso del paese; spazi,
   trattini, punti, barre e parentesi si tolgono, «00» davanti vale «+».
   Senza prefisso è rifiutato: indovinare il paese vorrebbe una libreria
   dei numeri (dipendenza nuova) o la posizione.
6. **Il numero non è provato, quindi non è unico**: nessun SMS dice che è
   di chi lo scrive. Due account possono avere lo stesso numero, e
   l'API non dice a nessuno se un numero è già di un account.
7. **Lo vede solo il proprietario** (`GET /me`): mai in `PublicProfile`,
   nella ricerca, negli elenchi. `DELETE /me` lo cancella con la riga.
8. **Nell'app** le due righe si aprono sotto, come «Language» e «Profile
   picture»; sotto il campo del numero: «Only you see your number. Friends
   who already have it will be able to find you on Sgrava.».

**Alternative scartate**:

- **Aspettare il servizio di posta** per il cambio email: proposto
  all'utente, che ha scelto di farlo subito con la password.
- **Il numero unico**: senza prova, chi scrive per primo il numero di un
  altro glielo toglie, e l'errore «numero già usato» dice a chiunque chi
  è iscritto.
- **Solo cifre nazionali** («333 123 4567»): due paesi hanno gli stessi
  numeri; la rubrica di un amico li ha quasi sempre con il prefisso o li
  porta a E.164 il telefono.
- **`401` per la password sbagliata**: l'app lo legge come sessione finita
  ed esce.

**Conseguenze**:

- **La ricerca dalla rubrica non c'è ancora**, e prima di farla va deciso
  come si prova un numero (SMS, un servizio a pagamento): oggi chiunque
  può scrivere il numero di un altro e farsi trovare al suo posto. La
  frase nell'app dice «will be able», non «can».
- La privacy (TASK-184) deve dire che il numero è facoltativo, a cosa
  serve e che si toglie da «Settings».
- Migrazione nuova (`0016_contact.sql`, il primo numero libero al merge):
  serve l'aggiornamento del server prima di pubblicare l'app. Un'API di
  prima risponde `404` ai due `PUT` e l'app lo dice in parole; il suo
  `User` non ha `phone` e l'app lo legge come «nessun numero».

## ADR-0208 — Con la penna alzata, la deviazione di un pezzo si cammina invece di disegnarla
**Stato**: Attiva · 2026-10-05 · **deciso dall'agente su delega
dell'utente** (TASK-242). Se alzare la penna anche sulle deviazioni del
contorno resta dell'utente.

**Contesto**: l'utente, il 2026-10-05, con lo screenshot della faccina a
15 km a Trento: «Ma quand'è la possibilità di alzare la penna anche per la
bocca», e poi «vedi da dove nasce e migliora il servizio di disegno». La
bocca è già un pezzo staccato (ADR-0185), ma sulla mappa pendeva dal bordo
della faccia. Rifatto sul Mac: la bocca attraversa la ferrovia, il primo
sottopasso è 250–370 m sotto la sua linea, e il motore disegnava 560–650 m
di andata e ritorno fuori dalla linea. La penna si alzava solo fra un
pezzo e l'altro, mai dentro un pezzo.

**Decisione**:

1. **Una deviazione** (`detours.py`) è un tratto del percorso di un pezzo
   fra due nodi **sulla linea** del pezzo (entro `LIFT_NEAR` = 1/8 di
   altezza di pezzo, la tolleranza della somiglianza) che se ne allontana
   più di `LIFT_FAR` = 3/8 di altezza: circa un decimo del lato del
   disegno, 175–185 m per una faccina da 15 km. La distanza si misura sui
   punti delle strade, non solo sui nodi.
2. **Si cammina, non si disegna** (`pen_up.trace`, `_lifted`): il pezzo si
   disegna in due parti, e dalla fine dell'una all'inizio dell'altra c'è
   un tratto a piedi come fra due pezzi, per la strada più breve. I `walks`
   sono quindi più dei pezzi meno uno.
3. **Un pezzo comincia e finisce sulla sua linea**: un tratto così prima
   del primo nodo sulla linea, o dopo l'ultimo, si lascia fuori senza
   tratti a piedi in più (il tratto a piedi che porta al pezzo arriva più
   avanti). Per un anello, che finisce dove comincia, i due sono un tratto
   solo.
4. **Una deviazione che torna al nodo da cui parte** si taglia e basta:
   la linea prosegue, nessun tratto a piedi.
5. **Il contorno non si tocca**: le sue deviazioni restano disegnate. Un
   buco nel contorno toglie alla forma più di un tratto storto.
6. **Mai più di `MAX_WALKS` = 9 tratti a piedi**, quanti ne tiene un
   risultato dell'API (`schemas.MAX_WALKS`, che non cambia): se le
   deviazioni sono di più, si camminano le più profonde. Il sole, con 8
   tratti fra i pezzi, ne ha uno.
7. **La distanza che la ricerca insegue conta ancora le deviazioni**
   (`pen_up.sized_m`, `optimizer.drawn_distance`): la forma resta
   grande com'era, non cresce per recuperare i metri non disegnati.
   Togliendoli dal conto, a Trento la ricerca ingrandiva la faccina fino
   a far passare la bocca sul bordo (18,0 km, 0,74, contro 15,8 km e
   0,79). I km «di disegno» che l'app mostra sono quelli veri, senza le
   deviazioni: possono stare più sotto la distanza chiesta di prima.
8. **Solo le forme a pezzi sulle strade**: le parole con la penna alzata
   (ADR-0157) e l'acqua (ADR-0188) restano come sono.

**Alternative scartate**:

- **Spostare la bocca dove le strade la lasciano passare**: i pezzi si
  spostano al più di 1/16 del lato (116 m a 15 km), il sottopasso è a
  250–370 m.
- **Alzare la penna dopo la ricerca, solo sul percorso scelto**: due
  copie dei passi dopo la ricerca (`plan_shape`, `ShapeJob.here`), e la
  ricerca non vede che una forma con una deviazione camminata è riuscita
  meglio.
- **Togliere le deviazioni dai km che la ricerca insegue**: vedi il
  punto 7.
- **Una soglia più bassa** (2/8 di altezza, 120 m a 15 km): non provata
  sui percorsi. Dai tratti misurati a Trento, la bocca della variante B
  si spezzerebbe in tre parti per due tratti a 133 e 142 m dalla linea,
  che all'occhio dell'agente (non giudicati dall'utente) si leggono come
  bocca.

**Conseguenze**:

- Il percorso scelto è quasi sempre quello di prima, con la deviazione
  tratteggiata e più km a piedi (a Trento, variante A: da 2,3 a 2,9 km a
  piedi, da 13,5 a 12,9 km di disegno, somiglianza da 0,77 a 0,79).
- La voce dice «Part done. Walk to the next part» anche a metà di un
  pezzo: la frase resta giusta.
- `schemas.py` e `models.py` descrivono ancora i `walks` come «uno in
  meno dei pezzi»: sono di TASK-238 mentre si scrive, da aggiornare dopo.
- `engine.zip` va rifatto: il telefono disegna con lo stesso motore.

**Giudicato dall'utente** (2026-10-05, sulle immagini prima/dopo della
faccina e della ciambella a Trento): «sì, va bene, fai il merge».

## ADR-0149 — Le unità di misura: km o miglia scelti in «Settings», l'unità del telefono alla partenza, la conversione solo dove si mostra
**Stato**: Attiva · 2026-10-05 · deciso dall'agente su delega dell'utente (TASK-182)
(parte A). Le **scelte dell'utente** (2026-10-03): si parte dall'unità del
telefono, e con le miglia si fa come Strava (distanze in mi, passo in
min/mi, voce a ogni miglio, distanze brevi in piedi). Il modo, qui sotto,
è dell'agente. Numero tenuto dal coordinatore dal 2026-10-02.

**Contesto**: «Units» era in «Settings» con «Soon» (ADR-0145). L'app
scrive le distanze a mano in decine di file, quasi tutti di altri lavori
in corso; il motore, l'API e il GPX lavorano in metri (`CLAUDE.md`). La
lingua (ADR-0172) ha già lo schema: la scelta in un file, la partenza dal
telefono, un cambio che vale subito.

**Decisione**:

1. **`src/units/`, sullo schema della lingua.** `Units = "km" | "mi"`; la
   scelta sta in `units.json` nei documenti (`{"units":"mi"}`), «Phone
   units» cancella il file; un file che non si legge vale «telefono». La
   scelta vale subito: `saveUnitsChoice()` avvisa chi ascolta.
2. **Si converte solo dove si mostra.** Il motore, l'API, il GPX, i file
   sul telefono e il database restano in metri. I formattatori
   (`src/units/format.ts`) prendono metri e scrivono nell'unità dell'app
   (o in quella passata): `distanceLabel` («5.2 km» / «3.2 mi», con la
   virgola di `decimal()` nelle lingue che la usano), `wholeDistanceLabel`
   («21 km» / «13 mi»), `awayNumber` («2.9», da dieci unità in su «13»),
   `runDistanceLabel` («4.01 km» / «2.49 mi»), `paceLabel` («4:44 /km» /
   «7:37 /mi»), `shortDistanceLabel` («50 m» / «150 ft»),
   `nearDistanceLabel` (breve o no). 1 mi = 1609,344 m, 1 ft = 0,3048 m.
3. **Con «Kilometres» l'app scrive quello che scriveva prima**, alla
   lettera e in ogni lingua: un test confronta `runDistanceLabel` e
   `paceLabel` con `kmLabel` e `paceLabel` di `navigation/freeRun.ts`.
   Per questo i formattatori scrivono la virgola con `decimal()` (i
   preferiti e i paesi vicini la scrivevano già), ma:
   - la **distanza di una corsa** (due decimali) resta **con il punto in
     ogni lingua**, come sulla schermata della corsa: la virgola lì
     arriva, se arriva, insieme a quella schermata (parte B), non a metà;
   - le schede di **«Explore»**, i cui testi sono ancora in inglese
     (ADR-0172, parti successive), passano `withPoint` e restano con il
     punto, anche in miglia: prendono la virgola quando vengono tradotte,
     togliendo quel parametro.
4. **Le distanze brevi**: i metri alla decina, i piedi ai cinquanta («50
   m» → «150 ft», «100 m» → «350 ft»): sono i numeri che si dicono, e la
   voce della parte B li userà così. «Quanto dista» passa dai piedi alle
   miglia a 1000 piedi (dai metri ai km a 1000 m, come prima): mai «0.0
   mi».
5. **L'unità del telefono, senza dipendenze nuove**
   (`src/units/phoneUnits.ts`), come la lingua legge `AppleLanguages`:
   - su iOS, `Settings` di React Native legge `AppleMetricUnits` e
     `AppleMeasurementUnits`, che ci sono quando il «Sistema di misura» è
     stato scelto a mano (su un Mac con la regione e nient'altro mancano:
     per questo serve la regione); si leggono come li legge iOS (non metrico = Stati
     Uniti; metrico con «Inches» = Regno Unito: tutti e due in miglia);
   - altrimenti la **regione** del telefono, da `AppleLocale` e da
     `I18nManager.localeIdentifier` (anche su Android): miglia per Stati
     Uniti, Regno Unito, Liberia e Myanmar, cioè i paesi che iOS mette nei
     sistemi «US» e «UK»; una regione o un sistema scritti nel locale
     (`@rg=uszzzz`, `@measure=metric`, `-u-ms-…`) vengono prima;
   - se il telefono non dice niente (nei test, sempre): **km**.
6. **Nessun `useUnits()` alla radice.** La lingua ridisegna tutto da
   `App.tsx`, che oggi è di altri task. `useUnits()` (con
   `useSyncExternalStore`) lo chiama **ogni componente che scrive una
   distanza**: si ridisegna da solo quando «Settings» cambia. I
   formattatori leggono l'unità dell'app (`appUnits()`), come `decimal()`
   legge la lingua: chi li usa senza `useUnits()` è giusto alla prossima
   volta che si disegna.
7. **La riga «Units»** (`src/settings/UnitsSetting.tsx`) è la copia di
   «Language»: stessa riga, stesse scelte sotto, stesso «✓». In fondo alla
   riga il nome dell'unità («Kilometres», «Miles»), non la sigla. Sta
   sotto «Offline maps», dov'era la riga con «Soon».
8. **I testi con l'unità dentro** hanno una riga per unità nelle tabelle
   («{km} km away» e, nuova, «{mi} mi away»): le righe degli altri non si
   riscrivono, e in km le traduzioni restano quelle. Le sigle «km», «mi»,
   «m», «ft» non si traducono.
9. **A pezzi**, come la lingua. Parte A: il modulo, la riga, «My
   activities», i preferiti, le schede di «Explore». `runFacts` e
   `favoriteHeading` cambiano dove sono definiti, quindi anche la scheda
   della corsa aperta (`ActivityCard.tsx`, non toccata) scrive in miglia.

**Alternative scartate**: `expo-localization` (una dipendenza per leggere
una regione); `Intl.NumberFormat` con `unit` (scrive il numero, ma non
dice l'unità del telefono, e cambierebbe i testi in km); convertire nell'API (un contratto in più
per una cosa che è solo di chi guarda); `useUnits()` in `App.tsx` (file di
altri task: si può aggiungere dopo senza cambiare niente); un testo solo
«{distance} away» con dentro numero e sigla (lascerebbe senza uso le righe
di TASK-236 nelle tabelle, che il test delle tabelle rifiuta); le yarde
(fuori scope); i piedi alla decina («160 ft» non lo dice nessuno).

**Conseguenze**:

- Finché la parte B non c'è, con «Miles» l'app è **mista**: liste e
  schede in miglia, «Draw», la corsa, la voce, il «Feed», i disegni
  pubblici, «Explore» con «Paddle» e le frasi di «Explore» in km. Con
  «Kilometres», e su ogni telefono che non misura in miglia, niente cambia.
  **Scelta dell'utente del 2026-10-05**: la parte A si pubblica subito,
  ma finché non c'è la parte B l'app **parte in km su ogni telefono** e
  «Settings» non offre «Phone units» (`FOLLOWS_PHONE` in
  `src/units/followsPhone.ts`, oggi `false`); solo chi sceglie «Miles» a
  mano vede l'app mista. La parte B accende l'interruttore, e da allora
  vale il punto 5: un telefono degli Stati Uniti o del Regno Unito parte
  in miglia.
- **Non provato su un iPhone**: che `Settings` di React Native dia
  `AppleLocale`, `AppleMetricUnits` e `AppleMeasurementUnits` in Expo Go è
  dedotto da come dà `AppleLanguages` (ADR-0172), non visto. Se non li dà,
  l'app resta in km e la scelta a mano funziona lo stesso.
- Cinque testi nuovi in inglese e nelle quattro lingue: «Phone units»,
  «Kilometres», «Miles», «{mi} mi away», «{town}, {mi} mi away».
- Solo app: nessuna dipendenza, niente server.
- Parte B: chi scrive una distanza usa `src/units/format.ts` e chiama
  `useUnits()`; la distanza di «Draw» in miglia (passi e limiti dentro
  `DISTANCE_LIMITS_M`) è una scelta ancora da fare lì.

## ADR-0205 — «Help», «Terms», «Privacy»: i testi come dati in inglese e italiano, una pagina sopra «Settings», e le bozze che dicono di esserlo
**Stato**: Attiva · 2026-10-05 · deciso dall'agente su delega dell'utente
(TASK-184), dentro le **scelte dell'utente** del 2026-10-05: «Help» è una
mini guida; «Terms» e «Privacy» sono bozze, segnate come bozze finché non
le approva; chi gestisce Sgrava e l'indirizzo a cui scrivere restano
segnaposto, `[name]` e `[contact email]`. Numero dato dal coordinatore.

**Contesto**: le tre righe di «About» erano in «Settings» con «Soon»
(ADR-0145). Sono testi lunghi, due dei quali legali, e l'app ha cinque
lingue con una regola (ADR-0172): ogni testo è scritto in inglese dentro
`t()`, e l'inglese è la chiave delle tabelle.

**Decisione**:

1. **I testi sono dati, non chiamate a `t()`**: `src/about/content/en.ts`
   e `it.ts`, ognuno con i tre testi (`AboutDocument`: titolo, `draft`,
   data, sezioni con titolo, paragrafi ed elenchi). Un paragrafo intero
   come chiave di quattro tabelle non si legge e non si corregge; e una
   virgola cambiata in inglese farebbe sparire le traduzioni.
   `aboutDocument(id, language)` sceglie il file della lingua dell'app.
2. **Inglese e italiano, per ora**: l'italiano perché l'utente deve
   leggere e approvare le bozze; tedesco, spagnolo e francese dopo
   l'approvazione, per non tradurre tre volte un testo che cambierà. Con
   quelle lingue il testo è in inglese (come ogni testo senza traduzione,
   ADR-0172) e VoiceOver lo sa (`accessibilityLanguage`). Un test
   controlla che l'italiano abbia le sezioni dell'inglese, blocco per
   blocco.
3. **Le frasi corte passano da `t()`**: i nomi delle righe (c'erano già),
   «Draft — not final yet.» e «Last updated: {date}», nelle cinque lingue.
   La data sta nel testo, scritta come la scrive la sua lingua.
4. **Una pagina, non una riga che si apre sotto**: sono testi da leggere,
   lunghi fino a diciotto sezioni. `ProfilePage` ha tre valori nuovi
   (`help`, `terms`, `privacy`) e `ProfileScreen` mostra `AboutScreen`
   **sopra** «Settings», con il suo «←», il suo titolo e il suo scorrere;
   «Settings» resta montata sotto, nascosta (`display: none`, come la
   lista di «Find friends» sotto un profilo). Così «←» la ritrova nel
   punto in cui era, con le righe aperte ancora aperte. `ProfileLayer.tsx`
   non cambia: tiene già la pagina qualunque sia.
5. **Una bozza lo dice prima di tutto**: un riquadro in cima con «Draft —
   not final yet.» e la data, con il colore `warning` (il giallo è del
   percorso). Lo decide `draft` nel testo: l'approvazione dell'utente è
   cambiare quel campo, non il codice della pagina.
6. **I segnaposto sono testo fra parentesi quadre**, uguali in ogni
   lingua, e la pagina li mette in evidenza: `[name]`, `[contact email]`,
   `[governing law]`, e le basi giuridiche in «Privacy». Un test rifiuta
   in tutti i testi un indirizzo email, un link o un numero di telefono, e
   controlla che chi offre l'app e chi è titolare dei dati sia `[name]`.
7. **«Privacy» dice solo quello che documenti e codice confermano**
   (`UI.md` «Cosa esce dal telefono», `DATABASE.md`, `API.md`,
   `DEPLOY.md`, ADR-0101, 0102, 0114, 0150, 0156, 0177, 0198, le
   migrazioni). Quello che non si è potuto verificare non è scritto: è
   nell'elenco dei punti aperti di `tasks/TASK-184.md`. Esempio: la
   tabella `generated_routes` di `DATABASE.md` non esiste nelle migrazioni
   (TASK-092 è da fare), e la bozza non parla di percorsi tenuti.
8. **La guida usa le parole del sito** (`site/content.js`, TASK-237), che
   è la guida dell'app sul web: stessi fatti, stesse frasi dove si può.
9. **Nel testo italiano i nomi di pagine e pulsanti sono quelli che l'app
   in italiano mostra oggi**: «Impostazioni», «Salva», ma ancora «Feed»,
   «Draw», «Start», «Pause» (TASK-210 non li ha tradotti tutti).

**Alternative scartate**:

- **I testi nelle tabelle di `t()`**: punto 1.
- **Le righe che si aprono sotto**, come «Language» (la riserva del task):
  un testo di diciotto sezioni dentro una riga allunga «Settings» di
  molte schermate e mette «Log out» e «Delete account» in fondo a tutto.
- **Lo stesso scorrere di «Profile»** per il testo: le righe di «About»
  sono in fondo a «Settings», e il testo si aprirebbe alla fine; riportare
  lo scorrere a mano, all'andata e al ritorno, non si può provare senza un
  telefono.
- **Una pagina web** aperta nel browser o in una WebView: serve un
  indirizzo pubblicato e la rete, e il sito è di un altro task; senza rete
  la guida non si aprirebbe.
- **Markdown** con una libreria che lo mostra: una dipendenza nuova per
  titoli, paragrafi ed elenchi.
- **Un nome e un indirizzo veri**, o inventati: scelta dell'utente.
- **Scrivere nella privacy quello che di solito si scrive** (basi
  giuridiche, trasferimenti, tempi di risposta) senza una fonte: un testo
  legale con fatti inventati è peggio di uno con un buco dichiarato.

**Conseguenze**:

- Le due bozze non sono approvate: prima dell'App Store l'utente riempie
  i segnaposto, le fa leggere a un legale e mette `draft: false`.
- Chi cambia cosa l'app manda o tiene (TASK-208 B: descrizione, foto e
  tag dei disegni; TASK-092: i percorsi generati; la ricerca dalla
  rubrica; il servizio di posta) aggiorna anche `src/about/content/`, in
  tutte e due le lingue.
- Quando TASK-210 traduce le pagine che mancano, i nomi nel testo
  italiano vanno riallineati.
- `SettingsPage` chiede a chi la mostra di aprire i testi (`onAbout`);
  restano «Soon» solo le due righe di «Notifications» (TASK-185).
- Solo app: nessuna dipendenza, niente server.

## ADR-0206 — I due interruttori delle notifiche: salvati nell'account, spenti all'inizio, e niente si manda ancora
**Stato**: Attiva · 2026-10-05 · deciso dall'agente su delega dell'utente
(TASK-185), dentro le **scelte dell'utente** del 2026-10-05: tutti e due
gli interruttori partono spenti («Spenti tutti e due»), e si salvano
anche se l'invio vero non c'è ancora, purché la pagina lo dica. Numero
assegnato dal coordinatore.

**Contesto**: «Email notifications» e «Push notifications» erano in
«Settings» con «Soon» (ADR-0145), le ultime due righe così. L'API non
manda email (nessun servizio di posta) e non manda push; l'app gira in
Expo Go, dove le push non arrivano, e non ha `expo-notifications`. Non è
deciso nemmeno che cosa si notificherà.

**Decisione**:

1. **Si salva la scelta, non si manda niente.** Nessun codice legge i due
   interruttori per agire: sono una preferenza tenuta per quando l'invio
   ci sarà. Nessuna dipendenza nuova, nessun permesso chiesto al telefono:
   accendere «Push notifications» salva soltanto.
2. **La pagina lo dice**, sotto le due righe, sempre: «Sgrava does not
   send notifications yet. Your choice is kept for when it does.». Un
   interruttore che non fa niente senza dirlo sarebbe una promessa falsa.
3. **Nell'account, non sul telefono**: due colonne di `users`,
   `notify_email` e `notify_push`, `boolean NOT NULL DEFAULT false`. Chi
   manderà le notifiche sarà il server, e deve saperlo senza chiederlo al
   telefono; la scelta segue l'account su ogni telefono. `DEFAULT false`
   dà «spento» anche a ogni account di prima, senza toccarne le righe.
4. **Un endpoint suo, `PUT /me/notifications`**, in `notifications.py`,
   come `PUT /me/email` e `PUT /me/phone` (ADR-0150): `PATCH /me` cambia
   quello che gli altri vedono e resta com'è per l'app pubblicata.
5. **Il corpo porta solo quello che cambia** (`email?`, `push?`): un
   interruttore non mandato resta com'è, così un tocco su uno non può
   riscrivere l'altro con un valore vecchio del telefono. `{}` non cambia
   niente e risponde l'account com'è; `null` vale «non mandato». Solo
   vero o falso (`StrictBool`): `"true"`, `1` sono `422`, perché una
   preferenza accesa per una conversione di tipo è un consenso mai dato.
6. **`User.notifications` è un oggetto, `{ "email": …, "push": … }`**, non
   due campi piatti: è la forma della richiesta, ed è dove andranno le
   voci future (che cosa si notifica) senza allargare `User`. Nel database
   restano due colonne piatte in `USER_COLUMNS`; l'oggetto lo costruisce
   un `model_validator(mode="before")` di `UserBody`, così `accounts.py`,
   `profiles.py` e `contact.py` continuano a fare
   `UserBody.model_validate(row)` senza cambiare una riga di SQL.
7. **Le legge solo il proprietario** (`GET /me`, `Session`): mai in
   `PublicProfile`, nella ricerca, negli elenchi. `DELETE /me` le cancella
   con la riga.
8. **Nel contratto `User.notifications` è facoltativo**: un'API di prima
   non lo manda, e l'app lo legge come «tutti e due spenti».
9. **Nell'app l'interruttore è disegnato**, come gli altri dell'app
   (`RunDashboard`: una pista e un pomello, colori dai token, bianco
   quando è acceso — il giallo è del percorso), non lo `Switch` di React
   Native: l'app non lo usa da nessuna parte, e così ogni riga è **un
   solo** elemento per VoiceOver, un interruttore con il suo nome e il suo
   stato, senza l'emoji.
10. **Il valore nuovo si vede subito** e torna indietro se l'API rifiuta,
    con il motivo in parole sotto le righe; mentre una risposta è in
    viaggio un secondo tocco, su uno qualunque dei due, non manda niente.
    Con un'API di prima (`404`): «Notifications are not available on this
    API yet.».
11. **«Soon» esce da «Settings»**: erano le ultime due righe a dirlo.
    `COMING` e `ComingRows` sono tolti da `SettingsPage`, e i testi «Soon»
    e «{name}, coming soon» dalle quattro tabelle (`tables.test.ts`
    rifiuta un testo che nessuno mostra).
12. **«Help» e «Privacy» lo dicono** (ADR-0205: chi cambia cosa l'app
    tiene aggiorna i testi): una riga nella sezione «Settings» della
    guida, un punto in «Your account» della bozza, in inglese e italiano.

**Alternative scartate**:

- **Aspettare l'invio vero** e lasciare «Soon»: l'utente ha chiesto gli
  interruttori adesso; proposto e accettato di salvarli dicendo che non si
  manda niente.
- **La scelta solo sul telefono** (come lingua e unità): il server non la
  saprebbe, e cambiando telefono si perderebbe.
- **Due campi piatti in `User`** (`notify_email`, `notify_push`): più
  semplici oggi, ma ogni voce futura allargherebbe `User`, e la richiesta
  avrebbe una forma diversa dalla risposta.
- **Costruire l'oggetto in SQL** (`json_build_object(…) AS notifications`
  dentro `USER_COLUMNS`): `USER_COLUMNS` smetterebbe di essere un elenco
  di colonne, e chi lo usa in un `RETURNING` o in una `JOIN` dovrebbe
  saperlo.
- **`PUT` con tutti e due i valori obbligatori**: due telefoni con valori
  vecchi si sovrascriverebbero l'interruttore che non hanno toccato.
- **Accesi all'inizio**: scelta dell'utente, spenti; e un consenso a
  ricevere messaggi non si presume.
- **Chiedere il permesso delle push all'accensione**: serve
  `expo-notifications`, e chiedere un permesso per qualcosa che non
  arriva brucia l'unica domanda che iOS lascia fare.
- **Lo `Switch` di React Native**: punto 9.

**Conseguenze**:

- **L'invio vero è un task a parte**, con scelte dell'utente: che cosa si
  notifica, quale servizio di posta, `expo-notifications` e una build
  propria. Quel task legge `users.notify_email` e `users.notify_push`,
  chiede il permesso del telefono, e riscrive la nota sotto gli
  interruttori e le due righe di «Help» e «Privacy».
- Migrazione nuova (`0017_notifications.sql`, il primo numero libero al
  merge): serve l'aggiornamento del server prima di pubblicare l'app.
  Un'API di prima risponde `404` al `PUT` e l'app lo dice in parole.
- Ogni `SELECT {USER_COLUMNS}` legge le due colonne: un test che usa
  l'API di oggi su uno schema senza `0017` fallisce (`UndefinedColumn`),
  come successe con `phone` (TASK-183). Quelli che ci sono creano già
  l'account di prima in SQL.
- `Account` ha un metodo in più, `changeNotifications`: i test che
  costruiscono un `Account` a mano hanno una riga in più.

## ADR-0210 — Le spiagge di «Paddle»: i paesi scelti dall'utente, il punto della riva dai dati, un riquadro d'acqua a paese
**Stato**: Attiva · 2026-10-05 · deciso dall'agente su delega dell'utente
(TASK-245), dentro la **richiesta dell'utente** del 2026-10-05: «aggiungi
altre spiagge oltre Jesolo e Riccione». I 29 posti e la regola «si tengono
solo dove il motore disegna» sono **scelte dell'utente** dello stesso
giorno (`tasks/TASK-245.md`, «Scelte dell'utente»). Numero dato dal
coordinatore.

**Contesto**: al mare l'app aveva due posti scelti a mano, con il punto
della riva scritto a mano e gli esempi dentro l'app (`waterPlaces.ts`,
ADR-0169, ADR-0189). I laghi invece vengono da un elenco scritto da un
comando (`lake_catalog.py`, ADR-0196), con i punti presi dalla forma del
lago. Il mare non ha una forma da cui prendere i punti: è il riquadro
meno la terra, e una costa non ha un nome. Il server ha l'acqua solo dei
riquadri che gli si danno (ADR-0187): Overpass non gli risponde.

**Decisione**:

1. **Un comando nuovo, `beach_catalog.py`, sul modello di quello dei
   laghi**, in due passi: i riquadri d'acqua (`--boxes`), poi l'elenco
   (`--cache-dir`), provato col motore come lo disegna l'API
   (`plan_water`). Scrive `apps/mobile/src/paddle/beaches.json`, con le
   righe uguali a quelle di `lakes.json`. `lake_catalog.py` non cambia.
2. **Un posto è un paese**: il nome che l'app mostra e il punto dove
   OpenStreetMap ha il suo nodo `place`, scritti nel comando (`PLACES`).
   Le posizioni sono state lette una volta da Photon; «Ostia» è Lido di
   Ostia, «Cavallino» il paese di Cavallino-Treporti.
3. **Il punto della riva non è scritto a mano**: è uno dei punti dove il
   motore dice che si arriva all'acqua a piedi (`water.build_area`), su
   una spiaggia se ce n'è una, il più vicino al paese entro **3 km**
   (`REACH_M`: la piazza di Villasimius è a 1,8 km dalla sua spiaggia). Il
   comando ne prova fino a quattro, lontani almeno 500 m l'uno
   dall'altro, e tiene il primo dove cuore, cerchio e stella stanno a
   2 km; altrimenti quello con la distanza più lunga fra 1,5 e 1 km, come
   sui laghi piccoli (scelta dell'utente in TASK-233).
4. **Un punto solo a paese**, non uno ogni 4 km come sulle rive dei laghi:
   chi cerca «Rimini» vuole Rimini, e il motore sposta comunque la
   partenza fino a 2 km lungo la riva.
5. **Un riquadro d'acqua a paese**: tiene la richiesta più lunga che l'API
   accetta sull'acqua (5 km) da ogni partenza entro 3 km dal paese, circa
   16 km di lato. Un paese che un file già sul server copre non ne ha uno
   nuovo (`--boxes --cache-dir`): Rimini sta nel file di Riccione,
   Cavallino in quello di Jesolo.
6. **Nell'app solo `waterSpots.ts`**: `WATER_SPOTS` è i luoghi scelti a
   mano, i laghi, poi le spiagge. «Explore», «Near me» e «Another place»
   le trovano. Niente esempi dentro l'app: le forme si chiedono all'API,
   come per i laghi.
7. **In «Another place» solo l'ultima parola scritta vale come inizio di
   una parola del nome** (`findSpots` in `placeSpots.ts`, ADR-0204); le
   parole prima, già finite, devono essere parole intere. Con le spiagge
   nell'elenco ogni indirizzo che comincia con «via» proponeva
   «Viareggio», di cui «via» è l'inizio: «via al lago» e «via Roma,
   Trento» tornano a non proporre niente, come l'utente aveva confermato
   in TASK-240. «via» da sola, mentre si scrive, propone ancora
   «Viareggio». `searchSpots` di «Explore» non cambia: lì si cerca un
   lago o una spiaggia, e ogni parola vale come inizio. File dati dal
   coordinatore a questo task.

**Alternative scartate**:

- **Un elenco di parole da strada da ignorare** («via», «viale»,
  «corso»): già scartato in ADR-0204, non finisce mai.
- **Tutta la costa d'Italia**, un punto ogni tanti km: a spanne 0,3–1,7 GB
  d'acqua sul server, e punti senza un nome da cercare. Sconsigliata
  all'utente, che ha scelto i 29 posti.
- **Aggiungere i posti a `waterPlaces.ts`**, come Jesolo e Riccione:
  vorrebbe il punto scritto a mano e gli esempi dentro l'app (25 KB a
  posto), che sono di TASK-244.
- **Il punto scritto a mano**, guardando la mappa: 29 punti da scegliere e
  da rifare a ogni estratto nuovo, e niente dice che lì si arriva
  all'acqua.
- **Prendere i paesi dall'estratto** (`place=*`): l'estratto dell'acqua
  non ha i nodi dei paesi, e «Mondello» o «Ostia» non sono comuni.
- **Riquadri stretti intorno al punto scelto**: il punto si conosce solo
  dopo aver letto l'acqua, e una partenza sul lungomare a 2 km dal punto
  resterebbe senz'acqua.

**Conseguenze**:

- 29 posti su 29 tengono le forme a 2 km (estratto del 2026-09-30), e
  tutti le otto forme di «Explore». 27 file d'acqua nuovi, 22,6 MB.
- **L'app non si pubblica prima che l'acqua sia sul server**: senza,
  scegliere una spiaggia nuova dà «Map data for this area could not be
  downloaded.».
- In «Another place» una parola scritta a metà e seguita da un'altra non
  trova più niente («lev terme»); «lev», «lago di lev» e i nomi interi
  come prima. «lev» trova anche «Sestri Levante».
- Una partenza al mare a più di 3 km da un paese dell'elenco resta come
  prima: funziona solo dove il server ha o riesce a scaricare l'acqua.
- Se il motore dell'acqua cambia (TASK-232 A tocca `water_fit.py`), le
  distanze dell'elenco vanno riprovate: `MAPS.md`, «Le spiagge di
  «Paddle»».
- Il motore non cambia; «Run» e «Bike» non cambiano.

## ADR-0149 — aggiornamento (parte C): la corsa e la voce in miglia
**Stato**: Attiva · 2026-10-05 · deciso dall'agente su delega dell'utente (TASK-182,
parte C). Le **scelte dell'utente** restano quelle del 2026-10-03: con le
miglia le distanze in mi, il passo in min/mi, la voce a ogni miglio, le
distanze brevi in piedi; in bici la velocità. Il modo, e i numeri qui
sotto, sono dell'agente e **vanno detti all'utente**.

**Contesto**: dopo la parte A, con «Miles» la corsa, la sua fine e la
voce erano ancora in km. La traccia sul telefono, i punti in cui la voce
parla (ADR-0052, ADR-0179) e quello che si salva sono in metri; i
parziali di «Data» e il confronto della voce (ADR-0180) nascono dalla
traccia, per km. La voce ha le sue tabelle per lingua (ADR-0171).

**Decisione**:

1. **I parziali per miglio si calcolano sul telefono, dalla traccia.**
   `unitTimesMs(track, unitM)` in `runMetrics.ts` è `kmTimesMs` con la
   lunghezza del tratto come parametro (`kmTimesMs` lo chiama con 1000);
   `splits(track, unitM)` e `lastKmS(track, unitM)` lo stesso. Un miglio
   che finisce fra due posizioni finisce in proporzione, le pause sono
   escluse, quello che avanza dopo l'ultimo miglio intero non è un
   parziale: come per i km. Niente si salva per miglio: non esistono
   parziali salvati (né alla fine della corsa né in «My activities»), e
   quello che va all'API o resta nel file della corsa non cambia.
2. **In bici la voce parla ogni 5 miglia** (`RIDE_MI_EVERY`, 8 km) al
   posto di ogni 10 km (`RIDE_KM_EVERY`, scelta dell'utente del
   2026-10-03): è il numero tondo di miglia più vicino, e a 15 mph sono
   venti minuti. Dal decimo miglio confronta le ultime 5 con le 5 prima.
3. **Le soglie non cambiano con l'unità**: stesso passo entro 2 secondi,
   compresi, anche fra due miglia (`SAME_PACE_S`); stessa velocità entro
   0,5 km/h, compresi, misurati in km/h anche con le miglia
   (`SAME_SPEED_KMH`): la frase della bici non ha numeri.
4. **L'incitamento dopo il terzo miglio** (`CHEER_MI`, 4,8 km): il miglio
   più vicino ai 5 km scelti dall'utente (`CHEER_KM`); al quinto miglio
   sarebbero 8 km.
5. **I piedi ai cinquanta, mai zero** (`roundFeet` in
   `src/units/runFormat.ts`), come `shortDistanceLabel` della parte A:
   50 m → «150 feet», 100 m → «350 feet». **I punti in cui la voce parla
   restano in metri** (50 m a piedi, 100 m in bici, il tratto con la bici
   a mano): cambiano solo le parole. Il banner scrive i piedi allo stesso
   modo e passa alle miglia, con un decimale e il punto, da 1000 piedi.
6. **La voce legge l'unità quando parla**: `wordsOf(lingua, unità =
   appUnits())` dà le frasi con le distanze brevi in metri o in piedi
   (`voiceWords(book, units)`); il navigatore e la bici a mano non sanno
   niente delle unità. Le frasi del miglio sono voci nuove di ogni
   tabella (`mile`, `mileFaster`, `mileSlower`, `mileSamePace`,
   `rideMiles`, `rideMilesFaster`…, `inFeet`, `walkTheBikeFeet`), accanto
   a quelle in km, che restano alla lettera. I ganci della corsa leggono
   `appUnits()` a ogni posizione: se l'unità cambia a corsa iniziata, il
   conto riparte da dove si è, senza ridire niente.
7. **Sullo schermo**: `useRunNumbers` chiama `useUnits()` e porta l'unità
   nei numeri; la distanza con due decimali e il punto, come in km
   (ADR-0149, punto 3); la velocità in mph con un decimale. I testi nuovi
   in `t()` con una riga per unità (ADR-0149, punto 8): «Last mi»,
   «miles», «Mi», «Your first mile will show here.», «Mile {mile}:
   {pace}», «Mile {mile}: {speed} mph». I testi in km della schermata,
   non ancora tradotti (ADR-0172), restano come sono.
8. **Resta in metri**: la traccia, il file della corsa, il GPX, l'API, i
   punti delle svolte, la salita («Elev. gain», in m) e le calorie.

**Alternative scartate**: ogni 10 miglia in bici (16 km: a 15 mph la voce
tacerebbe quaranta minuti); ogni miglio in bici (un miglio dura quattro
minuti: troppo, per la stessa ragione per cui i km sono ogni 10);
l'incitamento al quinto miglio (8 km: non è più «dopo i primi 5 km»); i
piedi alla decina («160 feet» non lo dice nessuno, ADR-0149); le yarde
(fuori scope); convertire le soglie del confronto (3,2 s al miglio, 0,3
mph: numeri che nessuno ha scelto, per una frase che in bici non ha
numeri); salvare i parziali per miglio (un contratto in più, per una cosa
che il telefono calcola dalla traccia); rinominare `kilometre`, `kmFaster`
e le altre voci delle tabelle in nomi senza unità (cambierebbe i test di
TASK-209/216/217, che devono passare come sono).

**Conseguenze**:

- Con «Miles» la corsa, la navigazione, la sua fine e la voce sono in
  miglia; con «Kilometres» niente cambia (i test di prima passano senza
  modifiche). `FOLLOWS_PHONE` resta spento: lo accende chi chiude la
  parte B.
- **Mostrati all'utente e confermati il 2026-10-05** («ok, i testi delle
  miglia vanno bene»): i tre numeri sopra (5 miglia in bici, il terzo
  miglio, i piedi ai cinquanta), i sei testi nuovi e le frasi della voce
  in inglese e italiano (`tasks/TASK-182.md`, «Parte C»); tedesco,
  spagnolo e francese sono dell'agente.
- **Non ascoltato**: come la voce del telefono legge «feet», «miles per
  hour», «miglia orarie» e il francese «mile» va sentito su un telefono.
- `src/activities/RunEnd.tsx` non scrive distanze e non è stato toccato:
  la fine della corsa con i km è in `FinishScreen.tsx` e
  `FreeRunScreen.tsx`.
- `kmLabel` e `paceLabel` di `navigation/freeRun.ts` restano in km per chi
  li usa ancora (`share/postRun.ts`, `social/DrawingCard.tsx`: parte B).
- Solo app: nessuna dipendenza, niente server.

## ADR-0211 — Le figure «Paddle» dei tre posti più vicini si disegnano prima, in un file loro sul telefono
**Stato**: Attiva · 2026-10-05 · deciso dall'agente su delega dell'utente
(TASK-246), dentro la **scelta dell'utente** del 2026-10-05: i tre posti
più vicini, con qualunque sport di «Settings», anche con i dati mobili.
Numero assegnato dal coordinatore.

**Contesto**: l'utente ha chiesto che all'installazione il telefono abbia
già «un po' di mappe vicino a me e un po' di figure per il padel». Le
mappe della zona si scaricano già al primo avvio (ADR-0177). Le figure in
canoa erano dentro l'app solo per i quattro luoghi scelti a mano
(ADR-0189); per ogni altro lago le disegnava il server all'apertura di
«Explore» con «Paddle», una alla volta.

**Decisione**:

1. **Le disegna il server, in anticipo, e il telefono le tiene.** La canoa
   resta al server (ADR-0177, scelta 5): il telefono chiede le stesse
   richieste che farebbe la pagina, prima che la pagina si apra. Nessun
   endpoint nuovo, nessun cambiamento all'API.
2. **I tre posti più vicini entro 30 km**, un posto per nome, come li
   offre «Explore» (`byName`, `NEAR_ME_M`); il più vicino è quello di
   «Near me». Le otto forme di ognuno, nell'ordine della pagina, alla
   distanza del posto.
3. **A ogni apertura, dopo le mappe della zona**, e solo se il server ha
   risposto alla richiesta delle mappe (con una zona o senza): un telefono
   senza rete non prova. Si chiede solo quello che manca: un'apertura dopo
   costa zero richieste.
4. **Una richiesta ogni 6 secondi al massimo.** L'API accetta 30 POST al
   minuto da un telefono (ADR-0076) e gli esempi della pagina ne usano
   fino a 18: dieci al minuto qui lasciano posto a «Start».
   Con l'app in secondo piano non si chiede niente: il giro aspetta che
   torni davanti (paletto del coordinatore: il server è piccolo). Un
   telefono nuovo fa al massimo 24 richieste, in circa due minuti e mezzo.
5. **Un file suo, `Documents/paddle-ahead.json`**, non quello della
   pagina (`city-examples.json`), che tiene gli ultimi otto luoghi scelti
   e li butterebbe fuori. Tiene gli ultimi sei posti disegnati. La pagina
   lo legge in `fromFile`, dopo gli esempi venuti con l'app e prima del
   suo file, solo per la canoa.
6. **Una forma che lì non si disegna** (`shape_not_drawable`) si segna nel
   file e non si richiede per una settimana: sarebbe una ricerca intera
   del motore a ogni apertura. Un posto senza acqua sul server
   (`map_data_unavailable`) si salta. Ogni altro guasto ferma il giro, che
   riprende all'apertura dopo.
7. **Senza avvisi e senza una riga in «Settings»**: sono circa 150 kB
   per tre posti (47 kB misurati per uno), e l'utente ha già scelto così
   per le mappe scaricate in anticipo.

**Alternative scartate**:

- *Mettere tutte le figure dentro l'app*, come i quattro luoghi: 211 laghi
  per otto forme sono decine di MB in ogni aggiornamento, e vanno
  ridisegnate a mano a ogni cambio del motore.
- *Scriverle nel file della pagina*: usciva dopo otto città guardate.
- *Farle disegnare al telefono*: la canoa ha bisogno dell'acqua, che il
  telefono non ha (ADR-0177).

**Conseguenze**:

- Ogni telefono nuovo fa disegnare al server fino a 24 figure. Il server
  non le tiene (`route_store.py` tiene solo i centri delle città). Sul Mac
  una figura esce in mezzo secondo: sul server è circa un minuto di motore
  per telefono nuovo. Tenerle sul server è il seguito scritto in
  `tasks/TASK-246.md`, per una pubblicazione larga.
- `requestOf` e `drawOrderOf` di `exampleRoutes.ts` sono esportate.
- `usePhoneZones` ha un'opzione in più, `shapes`: i test che lo montano la
  passano finta.

## ADR-0149 — aggiornamento (parte B): «Draw» in miglia
**Stato**: Attiva · 2026-10-05 · deciso dall'agente su delega dell'utente
(TASK-182, parte B). Le **scelte dell'utente** (2026-10-05): con «Miles»
− e + cambiano di 1 miglio; i limiti sono miglia intere dentro quelli di
oggi (corsa 1–13 mi, bici 7–18 mi, canoa 1–3 mi); un valore scritto con un
decimale («4.5») vale. Il modo, qui sotto, è dell'agente.

**Contesto**: la parte A (sopra, ADR-0149) ha lasciato in km «Draw», il
«Feed», i disegni pubblici, «Explore» con «Paddle». La distanza scritta in
«Draw» la tiene `App.tsx`, che è di altri task: la legge con
`toDistanceM`, la porta nei limiti con `distanceForSport`, e ci scrive da
sé dei km (`String(metri / 1000)`) dopo un «Try» e per un lago piccolo
(TASK-240).

**Decisione**:

1. **Il testo del campo dice la sua unità** (`src/units/distanceInput.ts`,
   nuovo). In km è il numero da solo, come sempre («7», «7,5»); in miglia
   è il numero con la sigla («4.5 mi»), che il campo aggiunge e toglie da
   sé. Così chi tiene il testo non deve sapere l'unità, `App.tsx` non
   cambia, e un testo rimasto da prima di un cambio in «Settings» vale
   ancora la stessa distanza.
2. **All'API vanno metri interi**, con aritmetica intera: i decimi di
   miglio per 1 609 344 e una sola divisione arrotondata (3 mi → 4828 m,
   4,5 mi → 7242 m, 13 mi → 20 921 m). Con «Kilometres» il codice e la
   richiesta sono quelli di prima.
3. **I limiti in miglia** sono le miglia intere dentro quelli in km
   (`APP_DISTANCE_LIMITS_MI`, calcolati da `APP_DISTANCE_LIMITS_KM`: 1–13,
   7–18, 1–3), quindi dentro `DISTANCE_LIMITS_M`. Valgono per quello che
   si scrive e per − e +, che cambiano di 1 miglio e tengono il decimale
   scritto, come in km.
4. **La partenza e il cambio di unità**: la distanza di oggi al miglio
   intero più vicino dentro i limiti (5 km → 3 mi, i 2 km della canoa → 1
   mi, i 10 km della bici → 7 mi). Quando «Settings» cambia l'unità,
   «Draw» riscrive il campo allo stesso modo (7,5 km → 5 mi; 3 mi → 5
   km); un testo che non è un numero resta com'è.
5. **Un testo in km mentre l'app è in miglia** non è stato scritto a
   mano: sono i metri che l'app ha scritto da sé, o quelli di prima del
   cambio. Vale per i metri che dice (fino a tre decimali), dentro i
   limiti in km, e il campo lo mostra in miglia con un decimale. Così
   dopo un «Try» la richiesta resta la stessa e il percorso resta sullo
   schermo, e un lago piccolo tiene i suoi 1 o 1,5 km anche sotto il
   miglio (a 1 mi le forme non ci starebbero).
6. **Le distanze che l'app propone**: «better at about N mi» e «Try N
   mi» al miglio intero più vicino dentro i limiti, e «Try» chiede quelle
   miglia; niente riga se la richiesta è già a quel miglio. «It fits at
   about N mi» lo stesso; se il miglio intero è quello appena chiesto (e
   fallito), il decimo di miglio più vicino («3.1 mi»); se anche quello
   coincide, nessuna distanza. Sull'acqua, dove la distanza dell'API è il
   massimo che ci sta (ADR-0164), il miglio intero **in giù**.
7. **Quello che una parola chiede** si dice in miglia arrotondate **in
   su** al decimo («needs at least 7.5 mi», «1.9 mi for each letter»), e
   «Use N mi» porta al miglio intero che basta. Con il limite di 13 mi
   una parola a piedi ha al massimo **6 lettere** (7 chiedono 21 km =
   13,05 mi); in bici restano 8.
8. **L'avviso dei percorsi lunghi** resta a 15 km, in metri.
9. **I testi**: una riga per unità nelle tabelle, come nella parte A. Le
   frasi di «Draw» che in km non passano ancora da `t()` hanno la loro
   versione in miglia in `t()`, tradotta. Gli avvisi del motore
   (`warnings.ts`) e le due frasi di «Explore» con una distanza fissa
   restano frasi inglesi con dentro la misura scritta dai formattatori:
   piedi ai cinquanta sotto i 1000 piedi (mai «0 ft»), miglia sopra;
   «Starting within 3.1 mi of…» e «shapes of 3.1 mi from the centre»
   dicono i 5 km del motore al decimo, perché «3 mi» non sarebbe vero.
10. **Restano in km anche con «Miles»**: «Shapes to paddle, within 1 km
    of the shore» e l'avviso di sicurezza della canoa (il limite del
    motore in una frase che promette la vicinanza alla riva: «0.6 mi»
    sarebbe meno del vero). «Start from the shore, within 2 km of the
    water» diventa «within 1 mile»: un miglio sta dentro i 2 km.

**Alternative scartate**: tenere la distanza in metri in `App.tsx` (il
modo più pulito, ma è un file di altri: si può fare dopo, e il testo con
la sigla sparisce); leggere il testo secondo l'unità dell'app, senza
sigla (i km che `App.tsx` scrive da sé verrebbero letti come miglia: un
lago di 1,5 km diventerebbe 1,5 mi); limiti in miglia con i decimali
(13,05 mi per arrivare ai 21 km: l'utente ha scelto miglia intere); arrotondare
al miglio intero anche la distanza di un lago piccolo (1 mi è più del lago);
proporre sempre il decimo di miglio (l'utente ha scelto il miglio intero);
«within 0.6 mi of the shore».

**Conseguenze**:

- Con «Miles» sono in miglia «Draw» e il suo risultato, il «Feed», i
  disegni pubblici, «Explore» con «Paddle». La corsa, la fine corsa, la
  navigazione e la voce sono della parte C; `FOLLOWS_PHONE` resta spento
  finché non c'è anche quella.
- `src/share/postRun.ts` non è stato toccato: i suoi numeri vengono da
  `navigation/freeRun.ts` (parte C).
- I testi nuovi sono da confermare con l'utente (`tasks/TASK-182.md`,
  «Parte B»).
- Quando `App.tsx` è libero: la distanza in metri nello stato e
  `useUnits()` alla radice.
- Solo app: nessuna dipendenza, niente server.

## ADR-0149 — aggiornamento (ultimo passo): l'app segue l'unità del telefono, e «Share» è nell'unità scelta
**Stato**: Attiva · 2026-10-05 · deciso dall'agente su delega dell'utente
(TASK-182), dentro la **scelta dell'utente** del 2026-10-05: «subito, ma km
di partenza» finché non c'era la seconda parte; con le parti B e C in
`main` torna la partenza dal telefono, scelta il 2026-10-03.

**Decisione**:

1. `unitsOf("phone")` chiede di nuovo `phoneUnits()`, e «Phone units» è
   la prima scelta di «Units». L'interruttore `FOLLOWS_PHONE` e il suo
   file sono tolti: era una porta per una pubblicazione a metà, e tenerlo
   spento per sempre sarebbe codice morto.
2. Il post di «Share» (`share/postRun.ts`) scrive distanza e passo con i
   formattatori di `src/units/format.ts`, quindi nell'unità dell'app, anche
   nel testo che va a Strava: è il testo dell'utente, nella sua unità.
3. Restano in km due frasi che dicono un limite del motore («within 1 km
   of the shore», l'avviso sull'acqua): tradotte in miglia direbbero un
   numero che il motore non usa.

**Conseguenze**:

- Un iPhone degli Stati Uniti o del Regno Unito apre l'app in miglia.
  Provato nel simulatore con la regione «Stati Uniti» (l'app legge
  `AppleLocale`); su un iPhone vero non è stato visto, e la voce in
  miglia non è stata ascoltata.
- Chi aveva scelto «Kilometres» o «Miles» a mano tiene la sua scelta.

## ADR-0149 — aggiornamento (parte E): la distanza di «Draw» la tiene `App.tsx`, come testo scritto o metri scelti dall'app
**Stato**: Attiva · 2026-10-07 · deciso dall'agente su delega dell'utente
(TASK-182, parte E, assegnata dal coordinatore). Il seguito scritto con la
parte B: «quando `App.tsx` è libero, la distanza in metri nello stato e
`useUnits()` alla radice».

**Contesto**: con la parte B `App.tsx` (allora di altri task) teneva il
testo del campo e ci scriveva da sé dei km (`String(metri / 1000)`) dopo un
«Try» e per un lago piccolo. Il campo li mostrava già in miglia
(`shownNumber`) e `toDistanceM` ne prendeva i metri esatti (punto 5 della
parte B), ma il testo che girava era in km anche con «Miles», e il cambio
di unità lo faceva solo `RouteChoice` quando era montato.

**Decisione**:

1. La distanza di «Draw» la tiene `useDrawDistance(sport)`
   (`src/units/useDrawDistance.ts`; le funzioni pure in
   `src/units/drawDistance.ts`), chiamato da `App.tsx`: o il **testo**
   scritto nel campo (anche −, + e «Use N mi»), o i **metri** che l'app
   sceglie da sé («Try», lago piccolo). L'app non scrive più testi in km
   mentre è in miglia.
2. Al campo va il testo nell'unità dell'app: quello scritto com'è; i metri
   dell'app in km come prima («1.5», «12»), in miglia al decimo («0.9 mi»,
   «7 mi»). La richiesta prende i metri così come sono, dentro i limiti in
   km dello sport: un «Try» e un lago chiedono quello che chiedevano.
3. `useUnits()` alla radice (`App`, accanto a `useLanguage()`) e nel
   gancio: a un cambio di unità il gancio riscrive subito la distanza, che
   «Draw» sia sullo schermo o no, con la regola della parte B (punto 4: la
   stessa distanza al km o al miglio intero dentro i limiti), anche per i
   metri dell'app, calcolata dai metri e non dal decimo mostrato. L'effetto
   di `RouteChoice` trova poi il testo già nell'unità nuova e lo lascia
   com'è.
4. Un cambio di sport passa da `distanceForSport` come prima: per i metri
   dell'app dal loro testo in km, con lo stesso risultato di prima.

**Alternative scartate**: solo metri in `App.tsx`, senza testo (il campo
deve tenere quello che si sta scrivendo, «4,», e `RouteChoice` e
`DistanceStepper`, in `src/route/`, vogliono un testo); scrivere i metri
dell'app come testo in miglia e rileggerlo (i 1500 m di un lago
diventerebbero «0.9 mi», cioè 1448 m, rifiutati sotto il miglio); tenere i
metri dell'app anche a un cambio di unità (con «Draw» sullo schermo
l'effetto di `RouteChoice` li arrotonderebbe comunque: due comportamenti).

**Conseguenze**:

- A vista niente cambia: il «Try» e il lago si mostravano già in miglia.
  Cambia dove vive la distanza, e il cambio di unità vale anche con «Draw»
  smontato (nell'app di oggi «Settings» si apre solo con «Draw» montato
  sotto, quindi in pratica è una garanzia).
- Con «Kilometres» testi e richieste sono quelli di prima: i test
  esistenti passano senza modifiche.
- Seguito: togliere l'effetto di cambio unità da `RouteChoice`
  (`src/route/RoutePanel.tsx`) quando `src/route/` è libero.
- Solo app: nessuna dipendenza, nessun testo nuovo, niente server.


## ADR-0210 — aggiornamento (parte B): una parola comune scritta sceglie fra i nomi trovati
**Stato**: Attiva · 2026-10-05 · deciso dall'agente su delega dell'utente
(TASK-245, parte B; seguito scritto alla chiusura del task).

**Contesto**: in «Another place» con «Paddle» (`findSpots`, ADR-0204) le
parole comuni («lago», «di») non contano quando un'altra parola dice il
luogo. Con le spiagge nell'elenco, «lago lev» proponeva «Lago di Levico»
e poi «Sestri Levante»: «lev» è l'inizio di tutti e due i nomi, e il
«lago» scritto non veniva guardato.

**Decisione**: fra i nomi trovati con le parole che dicono il luogo, se
qualcuno ha **tutte** le parole scritte che sono in un nome dell'elenco,
comuni comprese, restano solo quelli. Se nessuno le ha tutte, i nomi
trovati restano come prima. «lago lev» e «lago di lev» propongono solo
«Lago di Levico»; «lev» da sola propone ancora tutti e due;
«lungomare di Viareggio» e «spiaggia di San Vito lo Capo» trovano la loro
spiaggia, anche se nel nome non c'è «di»; «lago di iseo» trova «Lago
d'Iseo».

**Alternative scartate**:

- **Far contare sempre le parole comuni**: «lago di Levico Terme» e
  «spiaggia di Riccione», i testi dell'utente in TASK-240, non
  troverebbero più niente.
- **Ordinare soltanto** (prima i nomi con più parole scritte): «Sestri
  Levante» resterebbe fra le tre proposte sopra le vie, per chi ha
  scritto «lago».

**Conseguenze**: solo `placeSpots.ts`; `searchSpots` di «Explore» non
cambia, e nemmeno il motore o l'API. Chi scrive «lago» prima del nome di
una spiaggia la trova lo stesso, perché nessun nome trovato ha «lago».

## ADR-0210 — aggiornamento (parte C): 38 posti di mare in più
**Stato**: Attiva · 2026-10-09 · i posti sono **scelta dell'utente**
(«Proponi tu altri posti» il 2026-10-08, poi la lista dell'agente più le
sette alternative il 2026-10-09); il punto del paese, le frazioni sul mare
e il metodo sono **deciso dall'agente su delega dell'utente** (TASK-245,
parte C).

**Contesto**: dopo TASK-245 i posti di mare di «Paddle» erano 29 più
Jesolo e Riccione, e alcune coste ne avevano pochi o nessuno (Campania,
Basilicata, Molise, le isole toscane, Trieste).

**Decisione**: `PLACES` di `beach_catalog.py` passa da 29 a 67 paesi; il
metodo di TASK-245 non cambia (il punto della riva dai dati, un riquadro
d'acqua a paese, le prove del motore a 2, 1,5 e 1 km). Dove il nodo
`place` del comune è lontano dal mare o in collina si prende quello della
frazione sul mare, col nome che la gente usa: «Ischia» è Ischia Porto,
«Soverato» Soverato Marina, «Vasto» Marina di Vasto, «Trieste» Barcola.
Un file d'acqua per paese anche dove due paesi sono vicini (Positano e
Amalfi), come prima: un riquadro unito cambierebbe il nome dei file e il
modo di rifarli.

**Alternative scartate**:

- *Il nodo del comune per tutti*: la spiaggia di Vasto sta a circa 3 km
  dal centro, al limite di `REACH_M`; a Trieste la riva vicina al centro è
  il porto. Maratea invece tiene il nodo del comune: il punto della riva
  trovato sta a 1,7 km.
- *Tutta la costa d'Italia*: già scartata in TASK-245 (0,3–1,7 GB).

**Conseguenze**: 38 file d'acqua nuovi sul server (20,3 MB), da copiare
prima della pubblicazione dell'app, senza sovrascrivere; poi un solo
`draw_examples --water` (TASK-246 B), col via del coordinatore. Il motore
e `paddleExamples.json` non cambiano.

## ADR-0209 — Con la penna alzata, sul contorno si camminano solo i baffi
**Stato**: Attiva · 2026-10-05 · **deciso dall'agente su delega
dell'utente** (TASK-243): la regola, le soglie e il tetto. Che la penna si
alzi anche sul contorno è una richiesta dell'utente.

**Contesto**: l'utente, il 2026-10-05, subito dopo il «sì» ai campioni di
TASK-242: «alza la penna anche sulle deviazioni del contorno». In
ADR-0208 (punto 5) il contorno era rimasto fuori apposta: «un buco nel
contorno toglie alla forma più di un tratto storto». Il contorno ha molte
più deviazioni di un pezzo: nella faccina da 15 km a Trento, da una
partenza sola, 16 tratti fra due nodi sulla linea se ne allontanano più
della tolleranza, uno più di `LIFT_FAR`.

**Decisione**:

1. **Una deviazione del contorno è la stessa dei pezzi** (ADR-0208, punto
   1): fra due nodi sulla linea, più lontana di `LIFT_FAR` = 3/8 di
   altezza di pezzo.
2. **Si cammina solo se è un baffo**: salta al più `OUTLINE_GAP` = 1/2
   altezza di pezzo della linea del contorno (un ottavo del lato del
   disegno), che è il buco che lascia, e la sua strada è lunga almeno
   `OUTLINE_SPIKE` = 2 volte la distanza in linea d'aria fra i suoi due
   capi. Esce e rientra vicino a dove è uscita.
3. **Il buco si misura lungo la linea del contorno** (`Detour.hole_m`),
   da dove il percorso la lascia a dove la riprende, seguendo il verso in
   cui il percorso la percorre; un passo indietro più corto di `LIFT_FAR`
   non è un buco.
4. **Le altre deviazioni restano disegnate**: dove le strade non seguono
   il bordo per centinaia di metri, quel giro è il contorno.
5. **Al più `OUTLINE_WALKS` = 2 baffi camminati**, i più profondi, e mai
   più di `MAX_WALKS` = 9 tratti a piedi fra contorno e pezzi (le
   deviazioni più profonde per prime).
6. **Un baffo che torna allo stesso nodo si taglia** senza tratti a
   piedi, come nei pezzi. Sui percorsi veri è raro: `snap_to_network` li
   toglie già quasi tutti (nelle nove richieste guardate ce n'è uno solo,
   profondo 38 m, sotto la soglia).
7. **La partenza resta il primo punto**: il contorno comincia dal suo
   primo nodo, e una deviazione che parte da lì resta disegnata.
8. **I metri dei baffi contano ancora nella distanza inseguita**, come in
   ADR-0208 (punto 7).
9. **Solo le forme a pezzi chieste con `pen_up`**: senza `pen_up`, per le
   parole e sull'acqua niente cambia.

**Alternative scartate**, provate sulle stesse richieste (immagini in
`out/task-243/`, fuori dal repository). Le prime sei sono misurate sul
motore di `main` a 490d01c, prima che entrasse TASK-232:

- **La regola dei pezzi anche sul contorno** (ogni deviazione oltre
  `LIFT_FAR`): la faccina da 15 km a Trento passa a 0,83 di somiglianza
  ma con 8 tratti a piedi, 6,4 km a piedi e 11,1 disegnati; la ricerca
  sceglie un altro disegno, con quattro buchi nel bordo e i tratti a
  piedi che tagliano dentro la faccia. La somiglianza premia i buchi.
- **Lo stesso con un tetto di due**: i buchi arrivano a 450–500 m su un
  contorno di 6 km.
- **Solo il buco piccolo, senza chiedere che sia un baffo**: sulla
  faccina dello screenshot apriva il bordo in alto a sinistra per un giro
  di 346 m che lo segue da vicino (la strada è meno del doppio del buco),
  senza togliere nulla di storto.
- **Una soglia più bassa per il contorno** (2/8 di altezza): 23 richieste
  su 42 cambiano invece di 18, spesso con due tratti a piedi in più per
  rientranze di 120–180 m che all'occhio dell'agente si leggono come
  bordo.
- **Misurare il baffo sul tratto a piedi** (strada lunga almeno il
  doppio della via più breve fra i due capi): cambia una richiesta su 42.
  I baffi lunghi sono quasi sempre l'unica strada (un sottopasso), come
  la bocca di ADR-0208: a piedi sono lunghi uguale, ma non si disegnano.
- **Solo i baffi che tornano allo stesso nodo**: nelle nove richieste
  guardate nessuno supera la soglia, e non cambia niente.
- **Il buco misurato in linea d'aria fra i due capi** (la prima versione
  di questo task, su `main` a c2bb428): due punti del contorno possono
  essere vicini con in mezzo una coda, un orecchio o tutto il giro. Nei
  tentativi della ricerca del pesce da 15 km a Trento passavano per
  «baffi» tratti di contorno da 5 a 7 km, e la somiglianza di quei
  tentativi saliva (da 0,51 a 0,67 in uno) perché il contorno quasi non
  c'era più. Sulle 42 richieste il risultato scelto cambiava in una in
  più (15 invece di 14); gli otto campioni dalla CLI sono gli stessi con
  le due misure.

**Misure** (2026-10-05, Mac, zone in cache, motore di `main` a c2bb428
con TASK-232; `ROUTE_ENGINE.md` §5 ha la tabella): su 42 richieste da una
partenza sola 26 danno lo stesso percorso, 14 cambiano, una diventa
disponibile e una resta non disponibile. In 10 delle 14 il disegno è lo
stesso con un baffo o due camminati, e la somiglianza sale (da 0,008 a
0,061); in 4 la ricerca sceglie un altro disegno (somiglianza uguale alla
seconda cifra in 2, giù in 2: 0,82 → 0,78 e 0,75 → 0,70). In media
1,0 km disegnati in meno e 0,7 km a piedi in più. Otto richieste senza
pezzi, con la penna giù o di parole danno lo stesso percorso di `main`,
punto per punto. La faccina dello screenshot (CLI, `--nearby 3`): 0,79 →
0,80, stesso disegno, 12,9 → 12,3 km disegnati, 4 → 5 tratti a piedi
(quello nuovo è di 47 m), 15,8 → 15,3 km in tutto.

**Conseguenze**:

- Più tratti a piedi: uno o due in più dove il contorno ha baffi, e la
  voce «Part done. Walk to the next part» anche a metà del contorno.
- I km «di disegno» scendono ancora sotto la distanza chiesta (il
  fantasmino da 10 km a Levico: 8,6 km disegnati e 1,5 a piedi).
- La ricerca può scegliere un altro disegno, e la somiglianza può
  scendere: il costo conta anche distanza e inclinazione, e con i baffi
  camminati un disegno dritto della misura giusta batte uno inclinato e
  più lungo che somiglia di più. Dal secondo punto di Trento, a 15 km: il
  pesce 0,75 → 0,70 (all'occhio dell'agente si legge meglio), il
  fantasmino 0,82 → 0,78 (all'occhio dell'agente peggio).
- Una forma può diventare disponibile grazie ai baffi tolti (la ciambella
  da 10 km a Levico, 0,62), con un disegno appena sopra la soglia.
- `engine.zip` è rifatto; gli esempi tenuti sul server cambiano (da
  rifare con `draw_examples`, del coordinatore).

**Giudicato dall'utente** (2026-10-05, sulle otto immagini prima/dopo dei
campioni di `samples/`, `TASK-243_*`, con la domanda «va bene così,
compresi i casi 6 e 7?», il pesce e il fantasmino in cui la somiglianza
scende): «continua va bene».

## ADR-0212 — La CI ha un tempo massimo per job e dice dove un test si è fermato
**Stato**: Attiva · 2026-10-06 · **deciso dall'agente su delega
dell'utente** (TASK-248): i tempi e il modo.

**Contesto**: il 2026-10-05 il job `api` della CI è rimasto appeso tre
volte nel passo «Test», una per sei ore. La causa è nel motore
(`multiprocessing.Pool.terminate()` in `plan_nearby` aspetta per sempre
se arriva mentre un grafo sta per essere mandato a un processo:
`tasks/TASK-248.md`), ma dal log non si capiva: pytest stampa una riga
per file, a file finito, e un job di GitHub senza tempo massimo dura fino
a sei ore.

**Decisione**:

1. **Ogni job ha `timeout-minutes`**, almeno il doppio del suo tempo
   normale: `route-engine` 15, `api` 25, `ai` 5, `mobile` 10, `docker`
   15. Un job che lo supera fallisce.
2. **`faulthandler_timeout = 120`** nei `pyproject.toml` dell'API e del
   route-engine: un test che dura più di due minuti stampa lo stack di
   ogni thread e prosegue. Vale anche in locale.
3. **Nessuna dipendenza nuova.** `pytest-timeout` farebbe fallire il
   singolo test invece del job, ma è una dipendenza da chiedere, e con la
   causa tolta (parte B) non serve.

**Conseguenze**:

- Un blocco costa al più il tempo massimo del job, non ore, e il log dice
  quale test e in quale riga.
- Un test lento ma sano che supera i due minuti stampa uno stack e passa:
  rumore nel log, non un errore. Oggi nessun test ci arriva.
- Se un job diventa più lento del suo tempo massimo per buone ragioni, il
  numero in `ci.yml` va alzato: resta almeno il doppio del tempo normale.
- Chi aggiunge un job a `ci.yml` gli dà un tempo massimo.

## ADR-0215 — Con «Paddle» la velocità è in km/h e l'andatura è il tempo di 500 m
**Stato**: Attiva · 2026-10-06 · deciso dall'agente su delega dell'utente
(TASK-251), dentro la **scelta dell'utente** del 2026-10-06: velocità in
km/h, andatura in minuti ogni 500 m (proposte anche: nodi e min/500 m; solo
nodi). Numero assegnato dal coordinatore.

**Contesto**: un'uscita sull'acqua mostrava i numeri di una corsa: passo al
chilometro sotto la mappa, su «Data», nei parziali, nella voce e nel post,
e nessuna velocità. Solo la bici aveva i suoi (ADR-0179). L'utente ha
chiesto la velocità e l'andatura «che si usa col kayak».

**Decisione**:

1. **Sotto la mappa «Speed now»**, in km/h, al posto di «Pace now», come
   in bici: è il numero che si guarda pagaiando.
2. **Su «Data» e in pausa sei caselle**: «Speed now», «Avg speed», «Time»;
   «Avg /500 m» (l'andatura media), «Last 500 m» (il tempo degli ultimi
   500 m interi), «Calories». L'unità dell'andatura è nel nome della
   casella: accanto al numero («5:37 /500 m») lo rimpiccioliva, visto in
   un simulatore; i nomi nelle altre lingue sono quelli che ci stanno
   («Med. /500 m», «Ø /500 m», «Moy. /500 m»). **«Last km» ed «Elev. gain» non ci sono**: per
   mostrare velocità e andatura insieme due caselle dovevano lasciare il
   posto, e un lago non sale. Le calorie restano quelle della corsa.
3. **I parziali ogni 500 m**, non ogni km: il tempo di ogni 500 m è già
   l'andatura, e un percorso sull'acqua è di 1–5 km (ADR-0169). Le righe
   si chiamano coi metri («500», «1000»), sotto «m».
4. **Con le miglia** (ADR-0149) la distanza è in miglia e la velocità in
   mph, come in bici; **andatura e parziali restano ogni 500 m**: è il
   metro della canoa e del canottaggio ovunque, e «ogni 0,31 miglia» non lo
   legge nessuno.
5. **La voce dice ogni km** (con le miglia ogni miglio), come in una corsa,
   col **passo medio ogni 500 metri**: «1 kilometre. Time: 12 minutes.
   Average pace: 6 minutes per 500 metres.» Il confronto col km prima
   (ADR-0180) e l'incitamento restano quelli della corsa.
6. **Il post** scrive l'andatura in `/500 m`. Per saperlo a fine uscita il
   file della corsa in corso (`current-run.json`) tiene `activity` quando
   non è una corsa; il file di una corsa resta com'era, byte per byte.
7. **Senza percorso** vale lo sport di «Settings» alla partenza: solo con
   «Paddle» cambia qualcosa. In bici senza percorso resta il passo al km:
   non chiesto, lasciato com'è e segnalato all'utente.
8. **`navigation/paddle.ts`** accanto a `ride.ts`: funzioni pure, e una
   corsa o una pedalata non passano dal codice nuovo.

**Alternative scartate**: l'andatura al posto della velocità sotto la mappa
(un solo numero ci sta: la velocità è il primo chiesto); una terza riga di
caselle per tenere anche «Elev. gain» (la pagina «Data» non ha lo spazio
sopra i parziali); i parziali ogni km con l'andatura ogni 500 m (un numero
che non è il tempo della riga); la velocità detta dalla voce (a 5–6 km/h un
numero intero non dice niente, e i decimali la voce li legge male).

**Conseguenze**: «My activities» e il post fatto da lì mostravano ancora il
passo al km: l'API non restituiva lo sport di una corsa salvata. La parte
B di TASK-251 aggiunge `activity` alle risposte di `GET /me/activities` e
`GET /me/activities/{key}` (campo in più, nessuna migrazione: la colonna
c'è dal TASK-208); nell'app è facoltativo, così un server di prima lascia
il passo al km. I testi nuovi in tedesco, spagnolo e francese sono
dell'agente, da confermare.

## ADR-0212 — aggiornamento (parte B): le partenze vicine senza `multiprocessing.Pool`
**Stato**: Attiva · 2026-10-06 · **deciso dall'agente su delega
dell'utente** (TASK-248, parte B).

**Contesto**: la causa del job appeso (ADR-0212) è nel motore:
`plan_nearby` fermava i processi delle partenze vicine con
`Pool.terminate()`, che aspetta per sempre se arriva mentre il thread
del pool ha deciso di mandare un compito ma non ha ancora scritto il
primo byte (svuota la coda finché ci trova qualcosa, poi ferma i
processi; il thread scrive allora megabyte in una pipe che nessuno legge
più). Capitava in CI, dove un test rifiuta subito; sul server solo dopo
un errore inatteso del piano dalla partenza. Riprodotto sul Mac con la
sola libreria standard.

**Decisione**:

1. **Un `Process` e una `Pipe` per partenza vicina** (`_Workers`), non un
   `Pool`: a processi fermati nessuno legge più, chi manda riceve un
   errore invece di aspettare, e fermarli ritorna sempre.
2. **Lo stesso lavoro di prima**: `_plan_in_worker`, `spawn`, la
   priorità abbassata, le attese e i limiti di memoria non cambiano. I
   percorsi sono identici: impronte fissate uguali, e con i processi
   7 casi su 7 con lo stesso digest prima e dopo.
3. **Un processo che muore** è una partenza senza piano, detta nel log
   («the worker process stopped»), non un'attesa fino al limite come con
   il `Pool`. Un errore inatteso in un processo è rialzato qui, come
   prima.

**Conseguenze**:

- L'impronta del motore cambia anche se i percorsi no: al prossimo
  aggiornamento del server serve `draw_examples`. `engine.zip` è
  rifatto; l'impronta dell'acqua (`paddleExamples.json`) non cambia.
- Tempi uguali (0,48 s e 0,54 s sui due casi rapidi, prima e dopo, a
  macchina scarica); memoria nella stessa fascia.
- Il telefono (`processes=False`) non cambia.

## ADR-0213 — Un luogo ha un punto solo: il suo nodo `place` di OpenStreetMap

**Data**: 2026-10-06 · **Stato**: Accettato · **Task**: TASK-249 ·
deciso dall'agente su delega dell'utente

**Contesto**: per alcuni luoghi `GET /cities` e `GET /nearby-cities`
(ADR-0200) davano punti diversi: Tenna a 650 m, Calceranica al Lago a
700 m, Caldonazzo a 1,1 km, Riva del Garda a 500 m. La geocodifica
`type=city` di Geoapify dà per loro il confine del comune
(`category: administrative`) col punto al centro dell'area; il Places e
l'autocompletamento di `/city-suggestions` danno il nodo `place`, il
centro del paese. Gli esempi tenuti vanno per punto (ADR-0136): lo stesso
paese aveva due serie di esempi, e chi lo toccava in «NEARBY TOWNS» e chi
lo cercava per nome vedeva percorsi diversi.

**Decisione**: il punto di un luogo è **quello del suo nodo `place`**
(`place=city`, `town`, `village`), come lo dà il Places di Geoapify.
`/nearby-cities` e `/city-suggestions` lo danno già e non cambiano.
`/cities`, per ogni risultato che è un'area, chiede al Places i luoghi con
quel nome dentro il `bbox` dell'area, dal più vicino al suo punto, e
prende il punto del primo con **la stessa etichetta** (nome, regione,
stato: `place_label`, la stessa regola di `/nearby-cities`). Se nessuno ha
quell'etichetta resta il punto della geocodifica. Se il Places non
risponde, la ricerca risponde lo stesso coi punti della geocodifica, ma
quella risposta **non è tenuta** e gli altri luoghi non si chiedono
(un'attesa sola): la ricerca dopo richiede e trova il nodo.

**Alternative scartate**:

- **Il punto della geocodifica come verità**, con `/nearby-cities` che
  cerca per nome ogni posto: chiamate in più per ogni posizione, e il
  centro dell'area di un comune è un punto peggiore (per Caldonazzo è nei
  campi, per Calceranica sul monte).
- **Un registro di punti imparati** da `/nearby-cities`, che `/cities`
  rilegge: nessuna chiamata in più, ma il punto di un paese cambierebbe
  il giorno in cui qualcuno gli passa vicino.
- **Una sola chiamata all'autocompletamento** per ricerca: dà il nodo,
  ma solo per i primi nomi che iniziano così; i risultati che non ci sono
  resterebbero col punto dell'area.
- **La regola solo per i villaggi** (`place=village`): Riva del Garda è
  `place=town` e ha i due punti a 519 m; e non risparmierebbe niente al
  catalogo, che non si sposta comunque (0 città su 66, misurato).
- **Fallire la ricerca (503) se il Places non risponde**, la prima
  stesura: mai due punti, ma la ricerca delle città smetterebbe di
  funzionare per un servizio che le serve solo a spostare qualche paese
  di qualche centinaio di metri. Scartata su richiesta del coordinatore.
- **Tenere un giorno la risposta coi punti dell'area**: lo stesso luogo
  avrebbe di nuovo due punti per un giorno. Non tenuta, dura una ricerca.

**Conseguenze**:

- Una ricerca nuova costa una richiesta al Places per ogni area fra i suoi
  risultati (al più 5, una dopo l'altra, circa 0,35 s l'una: «Roma»
  1,8 s), poi è tenuta un giorno. Nessuna chiamata in più per posizione.
- Mentre il Places non risponde, un luogo cercato per nome può avere il
  punto dell'area: `route_store` lo impara come centro, e i suoi esempi
  restano finché scadono.
- Delle 66 città con gli esempi disegnati prima nessuna cambia punto.
  Cambiano Tenna, Calceranica al Lago, Caldonazzo, Riva del Garda, Jesolo
  fra quelle provate: i loro esempi disegnati dal punto vecchio di
  `/cities` non vengono più chiesti e scadono da soli.
- Anche `themed.py` e `prefetch_zones.py`, che usano la stessa ricerca,
  partono dal nodo.
- Chi ha già scelto uno di quei paesi lo tiene sul telefono col punto di
  prima finché non lo sceglie di nuovo.
- Le etichette possono ancora differire fra i due endpoint (una frazione,
  un nome tradotto): il punto no. `tasks/TASK-249.md`, «Emerso».

## ADR-0216 — Le code sul telefono: una copia accanto al file, un tempo massimo alle richieste dell'account, una corsa rifiutata non ferma le altre
**Stato**: Attiva · 2026-10-06 · deciso dall'agente su delega dell'utente
(TASK-252, dalla revisione del codice dell'app chiesta il 2026-10-06).
Numero assegnato dal coordinatore.

**Contesto**: le corse salvate senza rete, «Public» e Strava aspettano in
tre file JSON dei documenti dell'app, riscritti per intero a ogni
cambiamento con `create({ overwrite: true })` e poi `write`: fra le due
chiamate il file è vuoto, e con il telefono pieno resta così. Il giro che
manda le corse si fermava alla prima risposta che non fosse un sì o un
`invalid_request`, anche per un 413 o un 500 di quella sola corsa. Le
richieste dell'account (`api/accounts.ts` `ask`) non avevano un tempo
massimo: su Android una connessione che tace tiene «Logging in…»,
reazioni e «Follow» fermi per sempre. Una scelta «Public» rimasta in coda
non veniva tolta quando una scelta successiva arrivava all'API.

**Decisione**:

1. **Un modulo solo per le liste su file** (`src/storage/keptList.ts`):
   il contenuto nuovo va prima in una copia (`<nome>.copy`), poi nel file;
   in lettura un file vuoto o rotto lascia il posto alla copia; una lista
   vuota cancella prima la copia, poi il file. Solo con i metodi di `File`
   che i trenta test con un file system in memoria già imitano: niente
   `move`, che li avrebbe cambiati tutti. **Non** per il file della corsa
   in corso, riscritto ogni 15 secondi: lì «Stop» dà la corsa dalla
   memoria se l'ultima scrittura è fallita.
2. **Il giro delle corse si ferma solo** senza rete, con l'API che chiede
   di rallentare (`too_many_requests`) o con la sessione finita. Una corsa
   rifiutata in un altro modo resta in coda e la successiva parte; **due
   fallimenti dell'API di fila (5xx) fermano il giro**, perché un server
   spento dietro Caddy risponde 502 a tutto e venti corse con la traccia
   sono megabyte di dati mobili a ogni apertura. Il giro parte anche
   quando l'app torna in primo piano (`AppState`), oltre che all'apertura,
   al «Save» e in «My activities».
3. **Tempo massimo in `ask`**: 30 secondi, 90 per le `PUT` (una corsa, una
   foto; una `PUT` mandata due volte non cambia niente). Allo scadere la
   richiesta è interrotta (`AbortController`) e l'esito è `unreachable`,
   che ogni chiamante già gestisce. Un corpo che smette di arrivare conta
   lo stesso. Le altre famiglie di `fetch` (percorsi, GPX, foto del
   contorno, Photon) restano senza: sono di TASK-254 e di un task di
   struttura.
4. **Una scelta «Public» arrivata all'API** (un sì, o un no definitivo)
   toglie dalla coda quella più vecchia della stessa corsa. Con la
   sessione finita resta: la manderà lo stesso account.
5. **«Delete account» riuscito** toglie dalle tre code le voci di quel
   solo account; «Log out» non toglie niente. Il file della corsa in corso
   non ha un proprietario e non si tocca.
6. **Una corsa salvata con una sola posizione non si riprende**: non è una
   linea, e diventava il primo punto della corsa dopo.

**Conseguenze**: tre file `.copy` in più nei documenti; una scrittura in
più per ogni cambiamento delle code (rare). Niente di visibile cambia.
Rimandati all'utente: la corsa rifiutata con `invalid_request`, oggi
cancellata in silenzio, e la più vecchia che sparisce oltre le venti.

## ADR-0217 — La posizione sul percorso preferisce il passaggio vicino, l'arrivo vuole due posizioni, la navigazione riprende da dove era
**Stato**: Attiva · 2026-10-06 · deciso dall'agente su delega dell'utente
(TASK-253, dalla revisione del codice dell'app del 2026-10-06). Numero
assegnato dal coordinatore. Aggiorna ADR-0052.

**Contesto**: `progress.locate` metteva la posizione sul punto del percorso
con il costo più basso fra 50 m indietro e 300 m avanti, con costo = scarto
laterale + metri indietro. Andare avanti non costava niente: dove il
percorso ripassa dallo stesso posto entro 300 m (un baffo percorso andata e
ritorno, un incrocio con sé stesso: nelle forme succede spesso) una
posizione sbagliata di pochi metri finiva sul passaggio successivo, 130–230
m avanti. Le svolte saltate non si dicevano, quella all'uscita del baffo si
diceva mentre ci si allontanava, l'avanzamento tornava indietro; negli
ultimi 300 m «You have arrived» chiudeva la registrazione in anticipo e
senza «Resume». «Keep running» dopo «Stop» e una corsa ripresa dopo l'app
chiusa facevano ripartire il navigatore da 0 m con la traccia che
continuava: «off the route» fino alla fine, nessuna svolta, 0 % disegnato.
Una svolta negli ultimi 10 m non poteva mai risultare passata, e l'arrivo
non veniva detto. `watchPositionAsync` che rifiutava (servizi di posizione
spenti) era un rifiuto non gestito.

**Decisione**:

1. **Un costo anche per andare avanti**: `FORWARD_COST` = 0,25 al metro
   (indietro resta 1 al metro). Fra i punti del percorso **entro i 40 m del
   fuori tracciato** vince il più economico; se nessuno è entro 40 m, il
   più vicino, come prima. Così una posizione sbagliata di 8 m batte il
   passaggio della stessa strada 40 m più avanti, e un corridore che salta
   davvero 200 m di percorso viene ritrovato entro due o tre posizioni,
   appena il punto sbagliato esce dai 40 m. La finestra resta 50 m indietro
   e 300 m avanti. Pesi fissati con i test (`progress.test.ts`: baffo di
   80 m e incrocio, con e senza un errore GPS di 3–8 m).
2. **L'arrivo alla seconda posizione di fila entro 25 m dalla fine**
   (`ARRIVE_FIXES`), nessuna delle due con un errore dichiarato oltre 40 m;
   una posizione lontana azzera il conto. Entro 25 m dalla fine le svolte
   che restano contano come passate.
3. **La navigazione riprende** (`navigation/resume.ts`): quando il
   registratore continua una traccia, il navigatore, la penna e la bici a
   piedi vengono fatti passare in silenzio per le posizioni già registrate;
   «Head out on …» non si ripete. Chi si era fermato fuori percorso riparte
   fuori percorso e lo ritrova come prima.
4. **Rientrare più avanti dopo aver saltato un pezzo** (cercare su tutto il
   percorso dopo N secondi fuori tracciato) **non si fa qui**: cambia quello
   che il corridore sente, è una scelta dell'utente.
5. Un rifiuto della posizione (permesso o `watchPositionAsync` che lanciano)
   porta allo stato «denied» che c'è, in corsa e senza percorso.

**Conseguenze**: tre test di prima cambiano misura (la fine della corsa
arriva una posizione dopo: +20 m in `penUpRun.test.ts`, una posizione in più
in `mileRun.test.ts`). Nessun testo nuovo.

## ADR-0217 — aggiornamento: nessun rientro più avanti, chi sbaglia strada disegna un'alternativa
**Stato**: Attiva · 2026-10-06 · **scelta dell'utente**, alla domanda
lasciata aperta dal punto 4 (TASK-253).

L'utente, il 2026-10-06: «no, hai sbagliato a disegnare e basta, ma puoi
continuare dicendo che è sbagliato e così disegni un'alternativa». Quindi:
il navigatore **non** cerca il corridore più avanti sul percorso dopo un
pezzo saltato. Chi esce dal percorso sente «Off the route» una volta e vede
il banner arancio finché non ci torna (ADR-0070); la registrazione continua
e la corsa che ne esce è il disegno che ha fatto davvero. Nessun lavoro da
fare: è il comportamento di oggi. La domanda è chiusa.

## ADR-0221 — Una corsa rifiutata resta sul telefono con il motivo; il telefono pieno lo dice invece di lasciarne andare una
**Stato**: Attiva · 2026-10-06 · scelta dell'utente (la corsa resta con il
motivo e «Discard», «sì» alla revisione dell'app del 2026-10-06); il resto
deciso dall'agente su delega dell'utente (TASK-257). Numero assegnato dal
coordinatore.

**Contesto**: dopo TASK-252 (ADR-0216) una corsa a cui l'API risponde
`422 invalid_request` era tolta dal file senza una parola, quando l'utente
aveva già visto il logo «salvato» e la corsa in corso era già cancellata.
Oltre le 20 corse in attesa, la più vecchia spariva in silenzio.
`invalid_request` di `PUT /me/activities/{key}` vuol dire, nell'API di
oggi: meno di due posizioni buone, un orologio che non è un orologio, i
2 000 salvataggi dell'account già pieni, un corpo che non va.

**Decisione**:

1. **La voce del file ha `refused: { code, message }`** (il messaggio
   dell'API in inglese, com'è). Il giro delle corse salta le voci
   segnate; il contatore `waiting` le conta ancora, `refused` le elenca.
2. **«My activities» le mostra sopra la lista**: giorno, km del telefono
   (la somma dei tratti della traccia registrata, non pulita come la
   conta l'API), un solo testo per tutti i motivi («The server could not
   take this run: {message}»), «Discard» dopo un sì e **«Try again»**,
   che toglie il segno e rimanda la corsa: serve dopo aver fatto posto in
   una lista piena; per gli altri motivi la risposta torna uguale, senza
   danno.
3. **Il limite di 20 è per account**, non per file: le corse di un altro
   account sullo stesso telefono non si possono scartare da qui, e non
   devono bloccare chi è entrato. `keepWaiting` risponde `kept`, `full` o
   `not_written`; `withRun` non toglie mai niente. A telefono pieno
   `record` risponde `false` come a file rifiutato: `App.tsx` già non
   cancella la corsa in corso quando `Save` fallisce, e non cambia.
4. **Due testi a telefono pieno**: con una corsa rifiutata fra le 20,
   «Discard one in My activities first.»; senza, le 20 aspettano solo la
   rete (o un'API che risponda), e il testo dice che partono con la
   connessione. Una corsa in attesa non ha «Discard»: fuori scope.

**Conseguenze**: otto testi nuovi nelle quattro tabelle (i due di «Save» a
telefono pieno e sei della riga rifiutata). Un file d'attesa di prima si
legge com'era: le voci senza `refused` sono in attesa. Un telefono che
aveva già perso una corsa non la ritrova.

## ADR-0219 — La corsa tiene lo schermo acceso, l'app in secondo piano è una pausa, niente calorie fuori dalla corsa
**Stato**: Attiva · 2026-10-06 · **scelte dell'utente** del 2026-10-06
(«sì a tutte e cinque» alle domande della revisione: lo schermo acceso, le
calorie); il modo deciso dall'agente su delega dell'utente (TASK-255).
Numero assegnato dal coordinatore. Aggiorna ADR-0066.

**Contesto**: `expo-keep-awake` era chiamato solo entrando in modalità
tasca (ADR-0066). Con la mappa a vista e il blocco automatico del telefono
l'app andava in secondo piano; il GPS è seguito solo in primo piano
(nessun permesso di sfondo), quindi registrazione, voce e pausa automatica
si fermavano senza avviso, e al ritorno la prima posizione era unita
all'ultima con una riga dritta, con tutto il tempo di mezzo sul cronometro.
Una build di sviluppo tiene lo schermo acceso da sola e lo nascondeva. Le
calorie usavano la formula della corsa (1,036 kcal per kg e km) per ogni
sport: in bici circa il triplo del vero.

**Decisione**:

1. **Lo schermo resta acceso per tutta la corsa** (`useRunAwake`, tag
   `run`), dalla partenza a «Stop» o all'arrivo, con e senza percorso. La
   modalità tasca tiene il suo tag (`pocket-mode`): entrare e uscire non
   spegne lo schermo della corsa. Nessuna dipendenza nuova.
2. **L'app che lascia il primo piano per più di 60 secondi è una pausa**
   (`Pause.away`, `leaveTrack`, `RunRecorder.leave`, `AWAY_AFTER_MS`;
   **scelta dell'utente** del 2026-10-06, su proposta dell'agente dopo
   l'obiezione del coordinatore): quando `AppState` passa a «background»
   l'app si segna il momento; se la prossima posizione arriva più di 60 s
   dopo l'ultima, la corsa è stata in pausa da quel momento e la posizione
   comincia un tratto nuovo (`gap`): niente metri sulla riga dritta, niente
   tempo di mezzo (una telefonata, il telefono bloccato e dimenticato). Se
   arriva prima (un cambio brano su Spotify, un'occhiata a una notifica)
   la linea continua come oggi: riga dritta e tempo contato. Una pausa a
   mano o della penna che copre l'assenza resta com'è; una pausa da fermi
   finisce dove l'app è uscita, perché quello che segue non è del
   corridore. Scartata la regola «nessuna posizione per 30 s» senza
   guardare `AppState`: con la pausa automatica spenta avrebbe tolto dal
   cronometro anche una sosta lunga a un semaforo, e sotto una galleria
   avrebbe tolto i metri. «inactive» (centro di controllo, tasto laterale
   senza blocco) non conta.
3. **Il riquadro «Calories» solo correndo**: in bici e in canoa il suo
   posto lo prendono i riquadri accanto; nessun testo nuovo. Una formula
   per sport quando l'utente la vorrà.

**Conseguenze**: più batteria con lo schermo acceso (era già così in
modalità tasca). Il file della corsa può avere pause `away`
(`trackStore.isPause` le legge). `NavigateScreen.test.tsx` cambia verso:
lo schermo è acceso anche senza la modalità tasca.

## ADR-0220 — Gli errori parlano a chi corre: il dettaglio tecnico solo in sviluppo, «Try again» dove la richiesta può andare, uno schermo giallo al posto di quello bianco
**Stato**: Attiva · 2026-10-06 · scelta dell'utente del 2026-10-06 («sì» ai
testi per chi corre con «Try again», dalla revisione dell'app); il resto
deciso dall'agente su delega dell'utente (TASK-256).

**Contesto**: i messaggi di `route/problems.ts` e `account/messages.ts`
erano scritti per chi sviluppa: «Cannot reach the API at https://…sslip.io.
Check that it is running (on the PC: with --lan)…», «look at the API log»,
«not running on the PC (Ollama)», «Put the API's key in
EXPO_PUBLIC_API_KEY in apps/mobile/.env…», «The app and the API do not
agree (a bug): HTTP 502». L'indirizzo del server finiva sullo schermo del
telefono. Dopo un errore di «Draw route» non c'era modo di rifare la stessa
richiesta. L'app non aveva un `ErrorBoundary`: un componente in errore
lasciava lo schermo bianco, anche a metà corsa. Una mappa che non caricava
(offline, `unpkg.com` irraggiungibile) restava in errore per sempre e il
testo diceva di riaprire l'app.

**Decisione**:

1. **I testi dicono cosa è successo e cosa fare, a chi corre.** «No
   connection. Check the network and try again.», «Something went wrong on
   our side. Try again in a moment.», «The route could not be drawn. Try
   again, or try another start.», «This word cannot be read right now. Try
   one of these: …», «Drawing this route is taking too long…», «This
   request was lost. Try again.», «Accounts are not available right now.
   Try again later.». Una chiave rifiutata o una build senza indirizzo
   dell'API sono, sul telefono, un'app più vecchia del suo servizio: «This
   version of the app is no longer allowed in. Update the app.» e «The app
   cannot reach the service. Update the app.». Nessun testo mostrato
   contiene `http`, `.env`, `npm`, `Ollama`, `--lan`, «API log» o «bug»: un
   test lo verifica su ogni problema di `problems.ts` e su ogni codice di
   `messages.ts`. Testi nelle cinque lingue (ADR-0172); in `problems.ts`
   si traducono solo i testi toccati, il resto resta a TASK-210.
2. **Il dettaglio tecnico solo nelle build di sviluppo**: `detail`
   (l'indirizzo, lo stato HTTP, il codice e il testo dell'API, le parole
   del motore) passa da `devDetail()`, che fuori da `__DEV__` non dà
   niente; nei messaggi dell'account `withDetail()` lo accoda fra
   parentesi, solo in sviluppo. Sotto jest `__DEV__` è vero: i test del
   dettaglio lo spengono a mano.
3. **«Try again» dove la stessa richiesta può andare bene la seconda
   volta**: `ProblemText.retry` è vero per rete assente, risposta
   inattesa, motore fallito, dati OSM non scaricati, cinque minuti
   passati, richiesta persa; falso per una forma che non ci sta, una
   chiave rifiutata, troppe richieste, l'AI spenta. `useRouteRequest.retry()`
   rimanda l'ultima richiesta com'era; `RouteOutcome` riceve `onRetry` e
   senza di esso non mostra il pulsante.
4. **`AppBoundary` attorno all'app** (`src/intro/AppBoundary.tsx`, in
   `Root.tsx` intorno all'app, al logo di «Save» e all'animazione): un
   componente che lancia mentre disegna mostra il giallo della partenza con
   il logo, «Something went wrong.» e «Try again», che rimonta l'app con
   una `key` nuova senza rifare l'animazione (lo stato dell'intro sta
   fuori). La corsa in corso è nel suo file (TASK-252) e torna da sola.
   Nessuna segnalazione a un servizio esterno (dipendenza nuova, scelta
   dell'utente).
5. **La mappa in errore si ricarica**: `MapView` mostra al posto della
   barra «The map could not be loaded. Check the network.» e «Retry»
   (`reload()` della WebView), ricarica da sola quando `AppState` torna
   «active» con la mappa in errore, e appena la pagina dice `loaded`
   chiama `onError(null)`: la riga rossa della schermata sparisce. Il
   tipo di `onError` diventa `(reason: string | null) => void`, compatibile
   con `setMapError` in `App.tsx` e con `giveUp()` in `FeedMaps.tsx` senza
   toccarli.

**Alternative scartate**: tradurre tutto `problems.ts` (è di TASK-210);
un «Try again» che passa da `onTryDistance(view.request.distance_m)` per
non toccare `App.tsx` (meno chiaro di `retry()`; `App.tsx` prende le due
righe con l'ok del coordinatore); «Open Settings» accanto a «The camera is
off…» e a «Location is off» (stanno in `ImageChoice.tsx`, di TASK-254, e
in `NavigateScreen` / `FreeRunScreen`: seguito).

**Conseguenze**: i test che leggevano i vecchi testi (account, profilo,
impostazioni, `App.test.tsx`, `AppBike.test.tsx`) leggono i nuovi, con il
dettaglio fra parentesi dove jest fa da build di sviluppo. La riga rossa di
`ChooseScreen` («Check the connection and reopen the app») è ancora quella
di prima finché la mappa non carica: seguito, file non del task. `UI.md`
(«Quando non va», «Quando la mappa non si carica») aggiornato.

## ADR-0218 — Le correzioni piccole della revisione: tolleranza ai 5xx e a quello che l'app non conosce, posizione arrotondata dove è solo «qui vicino»

**Data**: 2026-10-06 · **Stato**: accettata · **Task**: TASK-254
(deciso dall'agente su delega dell'utente, dentro i punti del task file)

**Contesto**: la revisione del codice dell'app del 2026-10-06 ha trovato
dodici difetti piccoli e verificati. Tre di questi chiedevano una scelta
tecnica, non solo una correzione.

**Decisione**:

1. **Un 5xx che non è un errore dell'API** (una pagina di un proxy, non
   JSON) durante i controlli di `/route-jobs` conta come un errore di rete:
   uno è perdonato, tre di fila chiudono la richiesta come `bad_answer`
   con l'ultimo stato (`MAX_POLL_FAILURES`, `api/routes.ts`). Un errore
   dell'API con il suo codice, a qualunque stato, chiude subito come prima.
   Lo stesso per i controlli dei percorsi a tema (`useThemedRoute`), che
   prima si chiudevano al primo controllo fallito.
2. **Server e app si pubblicano separati**: una risposta con una forma, una
   svolta, uno stato del job o un codice d'errore che questa versione
   dell'app non conosce **non si rifiuta**. La forma sconosciuta è una forma
   (`shapeName` ha già un nome per tutte); la svolta sconosciuta si legge
   «straight» prima dei controlli (`withKnownTurns`, solo nella strada di
   `requestRoute`: le indicazioni chieste a parte restano strette); lo stato
   sconosciuto è lavoro in corso, detto a `onStatus` come «computing»; il
   codice sconosciuto è un errore con il messaggio dell'API, mostrato dal
   ramo generico di `route/problems.ts`. I controlli di struttura (punti,
   numeri, campi obbligatori) restano com'erano.
3. **La posizione del telefono esce con due decimali** (circa 1 km,
   `nearParams` in `places/photon.ts`) dove serve solo come «qui vicino»:
   a Photon, servizio terzo che la usa per ordinare, e a `/nearby-cities`,
   che cerca già nel quadrato di due decimali. **Resta intera verso
   `/phone-zones`**: il server sceglie la zona più piccola che tiene 3 km
   attorno al punto (`ZONE_MARGIN_M`), e con il punto spostato fino a
   ~550 m ai bordi sceglierebbe un'altra zona o risponderebbe 404; la
   zona deve tenere il percorso vero, non uno vicino. Intera resta anche
   come partenza del percorso, per forza.

   Il server misura `away_m` dal punto che riceve, fino a ~700 m di
   differenza: **«km away» e l'ordine dei paesi li misura il telefono** dal
   punto preciso (`metresBetween`), su richiesta del coordinatore; l'`away_m`
   del server non si usa.

**Conseguenze**: i paesi tenuti in memoria per quadrato si rimisurano a
ogni partenza; un posto senza `away_m` non si scarta più. I guard `isApiError` e
`isRouteJob` accettano codici e stati come stringhe qualsiasi: chi li usa
ha già un ramo generico. Un profilo nuovo sul server (una forma nuova)
arriva all'app vecchia senza aggiornarla.

## ADR-0222 — Il post condiviso resta sul server: emoji, risultati e titolo con la corsa, mai l'immagine

**Data**: 2026-10-06 · **Stato**: Accettato · **Task**: TASK-258 · cosa
resta del post, quando si salva e dove si rivede sono scelte dell'utente;
il resto è deciso dall'agente su delega dell'utente. Numero assegnato dal
coordinatore.

**Contesto**: il 2026-10-06 l'utente ha scritto «voglio che rimanga
salvato sul server il post dell'utente e l'attività con tutti i dati,
luogo, passo medio, km… poi ti serviranno tutti questi dati per
migliorarti nelle ricerche in cosa la gente preferisce». La corsa salvata
era già intera sul server (ADR-0140: traccia, pause, percorso, km, durata,
punteggio, luogo, forma o parola, titolo, `walks`, sport); il post di
«Share» (ADR-0194) viveva solo sul telefono: emoji, posizioni, risultati
accesi, immagine. Alle tre domande ha scelto: **emoji e risultati, non
l'immagine**; **quando lo si condivide**, senza un pulsante «Save»;
**si rivede riaprendo «Share»**.

**Decisione**:

1. **Cosa**: `runs.post` (`jsonb`, migrazione 0019): `title` (quello sul
   disegno, o `null`), `results` (fra `distance`, `time`, `pace`,
   nell'ordine del post), `emoji` (al più 5, con il centro come frazioni
   dell'immagine, fra 0 e 1), `shared_at`. Mai l'immagine: si rifà da
   questi dati e dalla corsa, ed è 300 KB a post per niente. Niente di
   nuovo su chi è l'utente: il post è della sua corsa.
2. **Quando**: l'app manda `PUT /me/activities/{key}/post` dopo che il
   foglio di condivisione si è aperto («Instagram») e dopo un invio a
   Strava riuscito («Send to Strava», «Update on Strava»); scritto
   intero, l'ultimo vince. L'immagine che non si fa, o Strava che
   rifiuta, non salva niente. Prima di «Save» la corsa non ha una chiave:
   il post si condivide come prima e non resta.
3. **Fuoco e dimentica** (`keepPost` nella porta delle attività): la
   condivisione è fatta, il post è un di più. Nessun riprova, nessun
   messaggio; una sessione finita si ascolta (come ogni altra chiamata
   con il token). Un'API senza la migrazione risponde `404`: lo stesso.
4. **Dove si rivede**: «Share» su una corsa di «My activities» con un post
   si apre com'era: gli stessi emoji nelle stesse posizioni (riportati
   sul post se stavano sul bordo), gli stessi risultati accesi; un
   risultato tenuto che la corsa non ha più (un passo per una corsa
   troppo corta) non compare. Il titolo è quello della corsa adesso, non
   quello tenuto: il post è della corsa.
5. **Il contratto**: `post` nella corsa intera (`null` senza), mai
   nell'elenco; esempi `run-post-request.json` e `run-post.json` in
   `shared-types`; l'app legge una corsa senza `post` come prima (un'API
   più vecchia).
6. **Cosa se ne fa**: per capire «cosa preferisce la gente» i post e le
   corse si leggono **in forma aggregata e anonima**, come gli `insights`
   (ADR-0101), mai per account: un seguito, con un task suo.

**Alternative scartate**: tenere l'immagine PNG (scelta dell'utente: no;
pesante e ricostruibile); un pulsante «Save post» (l'utente: no; un
pulsante e un testo in cinque lingue in più); un'anteprima del post
nella corsa aperta (l'utente: no); una tabella `run_posts` (una riga per
corsa al più, letta solo con la corsa: una colonna basta; una tabella
servirebbe a più post per corsa, che non ci sono); salvare il post anche
a fine corsa prima di «Save» (non c'è ancora una corsa sul server a cui
attaccarlo; si potrebbe tenere nel file e mandare al «Save»: un seguito,
se serve); riprovare l'invio del post senza rete (una coda per un dato
che non si vede; non vale).

**Conseguenze**: serve l'aggiornamento del server con la migrazione 0019
(l'ok dell'utente, tramite il coordinatore); finché manca, l'app riceve
`404` e non dice niente. Una corsa cancellata porta via il suo post. Un
post condiviso da un'app precedente non c'è: si vede dal prossimo
«Share». TASK-182 B (le miglia) non cambia il post tenuto: i risultati
sono nomi, i numeri si rifanno nelle unità di adesso.

## ADR-0214 — Un lago che la mappa segna come stagno entra nell'elenco di «Paddle» scritto come lago nel suo file d'acqua, senza cambiare il motore
**Stato**: Attiva · 2026-10-06 · deciso dall'agente su delega dell'utente
(TASK-250), dentro i confini del coordinatore: Ledro entra senza toccare
il motore, se si può. Numero dal coordinatore (il primo libero dopo
TASK-249).

**Contesto**: il Lago di Ledro (2,1 km², 655 m) manca dall'elenco dei
laghi di «Explore» con «Paddle» (TASK-233, ADR-0196): in OpenStreetMap è
`water=pond` dal 2023 (relazione 1400447, versioni 17–19; prima era
`water=lake`), e il motore pagaia solo su `natural=water` senza `water` o
con `lake` o `reservoir` (`water.is_lake`). Su uno stagno il motore dice
«there is no lake or sea to paddle on». In Italia gli stagni sopra 10 ha
sono 32, quasi tutti stagni veri (Molentargius, Santa Caterina, Pantano
Longarini); sei hanno un nome da lago, e solo Ledro è largo abbastanza
per una forma. Cambiare `is_lake` vorrebbe dire un aggiornamento del
server e il ridisegno degli esempi (`draw_examples`, 35 minuti).

**Decisione**:

1. **Uno stagno con un nome da lago è un lago dell'elenco**
   (`lake_catalog.named_pond`): `water=pond`, un nome che dice «lago»
   (la stessa regola dei laghi senza `water`), e niente di quello per cui
   `is_lake` lo terrebbe fuori comunque (porto, `amenity`). Poi le regole
   di sempre: largo per un cerchio da 1 km, e provato dal motore.
2. **Il motore non cambia: cambia il file d'acqua.** `lake_catalog
   --ponds` riscrive come `water=lake`, nei file d'acqua di una cartella,
   gli stagni dell'elenco, e tiene quello che dice la mappa in
   `water:osm=pond`. Solo quegli elementi; un file che non li ha non è
   riscritto; rifatto, non cambia niente. Il motore legge i file e
   pagaia su Ledro come su ogni lago; lo stesso file serve «Explore»,
   «Draw» e «Another place».
3. **I file sono due**: quello nuovo di Ledro
   (`water_45.84170_10.69460_45.91630_10.81050.json`, 0,5 MB) e quello
   del Garda di TASK-233 (`water_45.41050_10.46120_45.92020_10.91900.json`),
   che contiene Ledro e serve le richieste più lunghe (da 3 a 5 km): senza
   riscriverlo, da 3 km in su Ledro tornerebbe «no lake». Riscritto, i
   percorsi del Garda vicino a Ledro sono gli stessi, punto per punto (192
   su 192: i 12 punti del Garda entro 15 km, otto forme, 2 e 5 km).
4. **Il comando dice perché un lago resta fuori**, con le parole del
   motore, per il primo punto: serve a capire i laghi scartati senza
   rifare le prove a mano.

**Alternative scartate**:

- *Cambiare `water.is_lake`*: la regola più pulita (vale anche per un
  download da Overpass, e per un altro lago che la mappa segnasse così),
  ma costa un aggiornamento del server con il ridisegno degli esempi per
  un lago solo. Da fare insieme a un altro cambio del motore; allora
  `--ponds` non serve più e i file riscritti restano giusti.
- *Correggere OpenStreetMap* (Ledro di nuovo `water=lake`): è la cura
  vera e l'estratto successivo lo avrebbe, ma è una modifica pubblica, con
  l'account di qualcuno. Proposta all'utente, non fatta.
- *Un elenco di eccezioni nel motore* («Lago di Ledro è un lago»): un
  nome scritto nel codice del motore, e comunque un aggiornamento del
  server.

**Conseguenze**:

- L'acqua del server va riscritta in due file, con l'ok dell'utente:
  copiare il file nuovo di Ledro e quello del Garda riscritto, senza
  riavvio. Fino ad allora l'app pubblicata con Ledro nell'elenco
  direbbe «no lake» toccandolo: la pubblicazione viene dopo.
- Un download da Overpass dell'area di Ledro scriverebbe un file nuovo con
  lo stagno: sul server non succede (Overpass rifiuta il server, e un file
  che copre la richiesta c'è già).
- Se l'estratto si rifà, `--ponds` va rilanciato dopo i file d'acqua
  (`MAPS.md`, «I laghi di Explore»).

## ADR-0223 — «Open Settings» accanto a ogni permesso negato, e il «Retry» di «Draw» monta di nuovo la mappa
**Stato**: Attiva · 2026-10-06 · deciso dall'agente su delega dell'utente
(TASK-259); i testi nuovi sono mostrati all'utente prima del merge.

**Contesto**: con la fotocamera negata (`ImageChoice`) e con la posizione
negata durante la corsa i testi dicevano «allow it in Settings» senza un
modo di arrivarci; solo la partenza di «Draw» aveva «Open Settings». La
riga rossa di `ChooseScreen.MapError` diceva il motivo tecnico e «reopen
the app»; il «Retry» della mappa (TASK-256, ADR-0220) in «Draw» non si
vede, perché la mappa è sotto la schermata.

**Decisione**:

1. Un solo bottone `permissions/OpenSettings.tsx`
   (`Linking.openSettings()`, già in React Native: nessuna dipendenza),
   un link sottolineato e non giallo, usato dalla partenza, dalla
   fotocamera negata e da `location/LocationOff.tsx` per la corsa.
2. `MapError` dice le parole della mappa, «The map could not be loaded.
   Check the network.», senza il motivo (resta per il log); con
   `onRetry` mostra «Retry». In «Draw» `App.tsx` azzera l'errore e cambia
   la `key` della `MapView`: la mappa viene montata di nuovo, come una
   ricarica; se non carica ancora, `onError` rimette la riga.
3. La foto della libreria non chiede permessi (il selettore di sistema
   consegna solo la foto scelta): non c'è un «foto negate» da trattare.

**Alternative scartate**:

- *Una prop `reload` su `MapView`* (come le richieste `turn`): ricarica
  senza smontare, ma tocca la `MapView` e il suo protocollo per un caso
  in cui la mappa è vuota comunque; la `key` costa due righe in `App.tsx`.
- *Solo un testo diverso* («leave the app and come back»): vero, perché
  la mappa si ricarica quando l'app torna in primo piano, ma chiede a chi
  corre un gesto strano invece di un bottone.

**Conseguenze**:

- L'avviso «Location is off» con «Open Settings» va nelle schermate della
  corsa (`NavigateScreen`, `FreeRunScreen`) dopo il merge della parte
  «corsa» di TASK-210, che modifica quei due file: parte B di TASK-259.
- La foto del profilo (`profile/useProfilePhoto.ts`) ha lo stesso testo
  della fotocamera negata senza bottone: seguito.

## ADR-0224 — L'app si chiama «MuW»
**Stato**: Attiva · 2026-10-06 · scelta dell'utente (TASK-260).

**Contesto**: l'app si chiamava «Sgrava» (ADR-0046, ADR-0129 per il
logo). Il 2026-10-06 l'utente ha chiesto «Cambia il nome dell'app con
MuW».

**Decisione**:

1. «MuW», scritto così, ovunque un utente lo legge: `name` in
   `app.json` (sotto l'icona), i permessi di sistema, il titolo di
   «Draw», il post condiviso, l'etichetta dell'avvio, aiuto, condizioni
   e privacy, i testi nelle cinque lingue, e quello che l'API scrive
   fuori dall'app («Drawn with MuW» su Strava, le pagine di ritorno da
   Strava, `creator` del GPX, il messaggio dei tag).
2. Non cambiano `bundleIdentifier` e `slug`: sono l'identità tecnica
   dell'app sull'App Store e su EAS, e cambiarli è difficile da
   annullare.
3. Il logo, il segno «S» e l'icona restano quelli di ADR-0129 finché
   l'utente non sceglie i nuovi: un segno è una scelta di prodotto.
4. I nomi dentro al codice (`sgrava` in file, variabili e commenti) e i
   documenti che raccontano il passato non si riscrivono.

**Alternative scartate**:

- *Cambiare solo `name` in `app.json`*: il nome sotto l'icona sarebbe
  diverso da quello in cima a «Draw» e nei testi.
- *Rinominare anche `bundleIdentifier`*: l'app installata diventerebbe
  un'altra app, e il progetto EAS andrebbe rifatto.

**Conseguenze**:

- Le tabelle delle lingue (`i18n/*`) cambiano dopo il merge della PR
  #425 (TASK-208 B), che vi aggiunge righe: seconda parte di TASK-260.
- Il server va aggiornato (i testi di Strava e del GPX), con l'ok
  dell'utente; l'app va pubblicata su `preview`.
- Logo, segno e icona con «MuW»: parte B, sotto. Il sito (`site/`) è di
  TASK-237.

**Aggiunta (parte B, 2026-10-06, scelta dell'utente)**: «terrei il cuore
sullo sfondo giallo però con scritto muw». Il segno diventa il cuore
dell'avvio su giallo (quello del badge di «Draw», TASK-221), il logo il
cuore con sotto «MuW» nel tratto del vecchio logo (M e W maiuscole, u
minuscola: la grafia del nome). L'icona iOS è il cuore nero su giallo,
quella Android ha il fondo giallo e il cuore nel cerchio sicuro; lo
splash iOS mostra «MuW», quello Android il cuore. I PNG li genera
`docs/brand/make_brand.py` con Pillow, a mano, dai punti del cuore e dai
token dell'app: non è in `tools/`, dove la CI ha solo la libreria
standard. I vecchi `sgrava-*.svg` sono tolti (restano nella storia).

## ADR-0225 — La corsa registra anche a telefono bloccato: «While using», la pillola blu, e la linea si taglia solo se iOS congela l'app
**Stato**: Attiva · 2026-10-08 · **scelte dell'utente** del 2026-10-07 e
del 2026-10-08 (la dipendenza, il permesso, la prova, la voce fuori); il
modo deciso dall'agente su delega dell'utente (TASK-261). Numero assegnato
dal coordinatore. Aggiorna ADR-0219.

**Contesto**: il GPS della corsa era seguito con `watchPositionAsync`,
solo in primo piano (expo-location mette `allowsBackgroundLocationUpdates
= false`); a telefono bloccato registrazione, voce e pausa automatica si
fermavano. ADR-0219 teneva lo schermo acceso e, dopo 60 s in secondo
piano, metteva la corsa in pausa. Apple consente gli aggiornamenti in
background a un'app con il solo permesso «While using», se partono con
l'app in primo piano e l'app dichiara `UIBackgroundModes` `location`; iOS
mostra allora la pillola blu. expo-location li dà con
`startLocationUpdatesAsync`, che su iOS controlla solo il permesso in
primo piano, e li consegna a un task di expo-task-manager. In Expo Go su
iOS il background non c'è.

**Decisione**:

1. **`expo-task-manager`** (~57.0.19) è la dipendenza nuova (**scelta
   dell'utente**): senza, expo-location non dà posizioni in background.
2. **Il permesso resta «While using»** (**scelta dell'utente**: niente
   «Always»). `app.json`: il plugin `expo-location` con
   `isIosBackgroundLocationEnabled` (`UIBackgroundModes` `location`;
   expo-task-manager aggiunge `fetch`) e un testo nuovo del permesso, in
   cinque lingue con `locales` e `CFBundleAllowMixedLocalizations` (la
   guida Expo). Android resta com'era (**scelta dell'utente**).
3. **`watchRunPosition`** (`runPosition.ts`; deciso dall'agente): su iOS,
   se il modo background c'è, `startLocationUpdatesAsync` sul task
   `muw-run-location` per tutta la corsa, anche in primo piano (in
   background non si può farlo partire), con `activityType` Fitness,
   `pausesUpdatesAutomatically: false` (il consumatore nativo lo metteva
   a `true`: a un semaforo iOS avrebbe spento il GPS e non l'avrebbe più
   riacceso) e `showsBackgroundLocationIndicator: true`. Se manca o il
   telefono rifiuta (Expo Go, Android, una build senza il modo),
   `watchPositionAsync` come prima. Il task è definito quando l'app si
   carica; una corsa alla volta; start e stop in fila, così lo stop di una
   corsa finita non arriva mai dopo lo start della successiva; posizioni
   senza corsa (app chiusa a metà, task ripreso da iOS al riavvio) fermano
   il task, che costa batteria.
4. **Il taglio della linea** (`runAway.ts`; deciso dall'agente; la regola
   dei 60 s di ADR-0219, scelta dell'utente, non cambia): col GPS in
   background uscire dal primo piano non ferma più niente, e un corridore
   fermo a un semaforo non dà posizioni (una ogni 5 m) proprio come un GPS
   fermo. Il GPS si è fermato davvero solo se iOS ha **congelato l'app**:
   un battito dell'orologio JS ogni secondo che arriva con più di 15 s di
   ritardo (`FROZEN_AFTER_MS`), controllato anche prima di ogni posizione,
   lo dice al registratore (`RunRecorder.leave` dall'ultimo battito);
   la posizione dopo, se arriva più di 60 s dopo l'ultima, comincia un
   tratto nuovo, senza metri né tempo di mezzo. Fermi a un semaforo a
   telefono bloccato vale quindi la pausa automatica come in primo piano,
   e sotto una galleria la linea dritta come in primo piano: le due cose
   per cui ADR-0219 aveva scartato la regola del silenzio GPS. Col GPS
   solo in primo piano resta l'ascolto di `AppState` di ADR-0219, e conta
   anche il congelamento: una posizione arrivata subito dopo l'uscita, e
   prima che iOS congeli l'app, non nasconde più il buco che segue.
   `trackStore.ts` non cambia.
5. **La voce a telefono bloccato fuori da questo task** (**scelta
   dell'utente**): con la sessione audio di partenza iOS la zittisce; i km
   detti in secondo piano contano comunque, e al ritorno non si ripetono.
   Un task suo con expo-audio e `UIBackgroundModes` `audio`, dopo la prova
   sull'iPhone.

**Conseguenze**: in Expo Go nulla cambia; il GPS in background si vede
solo in una build nativa (simulatore, Xcode sull'iPhone, TestFlight). La
pillola blu durante un'attività con l'app in secondo piano; il GPS acceso
come prima, lo schermo spento consuma meno. Nelle Impostazioni di iOS,
alla voce di MuW, compare la scelta della lingua. iOS può comunque
sospendere l'app (lo dice Apple): allora vale il punto 4. Il task di
expo-task-manager resta registrato fino allo stop, anche se l'app viene
chiusa a metà: lo ferma la prima posizione senza corsa.

## ADR-0227 — Il feed vero, versione semplice
**Stato**: Attiva · 2026-10-08 · l'ordine è scelta dell'utente del
2026-10-07 («ok va bene questo semplice»); il resto deciso dall'agente su
delega dell'utente (TASK-118).

**Contesto**: «Feed» mostrava quindici disegni d'esempio (ADR-0127).
Dall'API esistono i disegni pubblicati (ADR-0159, ADR-0170), chi segue
chi (ADR-0173), reazioni e commenti (ADR-0193, ADR-0175). Serviva il feed
di quei disegni, senza inventare una classifica.

**Decisione**:

1. **Un endpoint, `GET /feed`**, in un modulo nuovo (`feed.py`), che
   riusa i corpi e la domanda «chi vede cosa» dei disegni
   (`drawings.shown_sql`): mai un `only_me`, nemmeno al proprietario; mai
   una traccia non tagliata. Ogni post è il `Drawing` dell'elenco del
   profilo più l'autore: l'app lo apre intero con `GET /drawings/{id}`,
   e reazioni e commenti restano dove sono (sul disegno aperto).
2. **Tre gruppi in ordine fisso**: i propri, quelli di chi si segue con
   la richiesta accettata, gli altri; dentro ogni gruppo il pubblicato
   per ultimo prima (`published_at`, non l'inizio della corsa: un feed
   dice cosa è nuovo). Nessun filtro, nessun punteggio.
3. **«Vicini» è il terzo gruppo entro 50 km** dalla posizione del
   telefono (`FEED_NEAR_M`, il raggio delle città lontane di «Near me»),
   misurato sulla traccia tagliata con `ST_DWithin`; **senza posizione
   niente è lontano**: chi nega la posizione vede tutti. Deciso
   dall'agente: un feed vuoto per chi non segue nessuno e non dà la
   posizione sarebbe stato peggio di uno lontano.
4. **Cursore a chiave** `gruppo-microsecondi-id`, mai un offset: un
   disegno nuovo va sopra il cursore, e due pagine consecutive non
   ripetono né saltano. L'app manda lo stesso punto a ogni pagina di una
   lettura. Chi comincia a seguire fra due pagine può vedere un disegno
   due volte o perderlo fino alla lettura dopo: accettato.
5. **Nessuna migrazione**: le tabelle bastano; un indice si aggiunge
   quando i numeri lo chiedono.
6. **Nell'app** la scheda resta quella degli esempi (`FeedPost`, mappe,
   un annuncio ogni cinque): un disegno vero è convertito nei suoi campi
   (`feedPosts.ts`) e porta con sé il `Drawing` da aprire. Il feed si
   legge solo quando la pagina è sullo schermo (`useFeed.ts`), con tira
   per aggiornare e la pagina dopo in fondo. **Gli esempi restano come
   riempitivo** quando non c'è account, il feed è vuoto, l'API è di
   prima o non risponde; mentre la prima pagina arriva, niente.

**Alternative scartate**:

- *Un feed di tutti dal più recente, senza gruppi*: i propri e quelli
  degli amici finirebbero sotto gli sconosciuti.
- *Il terzo gruppo vuoto senza posizione*: feed vuoto per molti nuovi
  iscritti.
- *Ordinare per `started_at` come il profilo*: una corsa vecchia
  pubblicata oggi non si vedrebbe mai in cima.
- *Un offset invece del cursore*: salta o ripete quando arriva un post.
- *Mischiare esempi e disegni veri*: un iscritto non capirebbe quali
  sono finti.

**Conseguenze**:

- Il server va aggiornato (`feed.py`), senza migrazioni; l'app va
  pubblicata.
- Due file fuori dall'elenco del task, concessi dal coordinatore:
  `App.tsx` passa a «Feed» la partenza come a «Explore» (una riga);
  `ProfileLayer.tsx` ricorda che il disegno è stato aperto con «Profile»
  chiuso, e «←» torna al Feed invece di aprire «Profile».
- Finché il server non ha `/feed` (404) il Feed mostra gli esempi senza
  nessun avviso: l'app esce prima dell'aggiornamento del server.
- Seguiti: un indice su `drawings (published_at)` quando servirà; la
  foto dell'autore sulla scheda (oggi l'iniziale, come gli esempi); il
  nome dell'autore che apre il suo profilo.

## ADR-0229 — «Recommended»: prima il disegno, poi le reazioni, poi le corse
**Stato**: Attiva · 2026-10-08 · il criterio è **dell'agente su delega
esplicita dell'utente** («consiglia tu i migliori disegni», 2026-10-07);
il come deciso dall'agente su delega dell'utente (TASK-092). Completa
ADR-0086 e ADR-0098.

**Contesto**: ADR-0086 vuole che i percorsi migliori si consiglino agli
altri; «Explore» (ADR-0098) mostra il catalogo vicino in ordine di
somiglianza e basta. Dal database ora ci sono le corse salvate (TASK-172),
i disegni pubblicati con le reazioni (TASK-117, TASK-119) e i preferiti
(TASK-171). Serviva un ordine che usasse anche quelli, senza filtri nuovi
(ADR-0144) e senza scartare nessuno.

**Decisione**:

1. **Un endpoint, `GET /recommended`**, in un modulo nuovo
   (`best_routes.py`), sullo stesso catalogo di `/recommended-routes`: i
   percorsi che partono entro 5 km dal punto (come le altre righe), al
   più 10 (`limit` fino a 20), con lo stesso corpo di
   `/recommended-routes`. **Vuole un token**, come `/feed`: i dati sono
   degli iscritti; senza account la riga non c'è.
2. **L'ordine**, da sinistra:
   1. **la somiglianza come la scheda la scrive** (il percento intero,
      «97%» prima di «96%»): il disegno viene prima di tutto, e due
      percorsi che l'utente vede uguali sono uguali anche qui;
   2. a pari percento, **le reazioni** lasciate sui disegni pubblicati
      (`visibility` non `only_me`) delle corse fatte su quel percorso;
      un disegno tornato privato non conta più;
   3. poi **quante volte è stato corso e tenuto**: le corse salvate in «My
      activities» più i preferiti, contati insieme (ognuno è qualcuno che
      l'ha voluto);
   4. **a parità di tutto restano tutti**, il più vicino prima e poi l'id,
      così l'ordine è sempre uno: nessun percorso ne scarta un altro
      perché passa dalle stesse strade (ADR-0086, utente 2026-10-01).
3. **Una corsa, o un preferito, è di un percorso del catalogo quando la sua
   linea è quella**: l'app manda i punti del percorso come li mostra, e i
   preferiti hanno già per chiave `favoriteKey` della linea. L'API calcola
   la stessa chiave (`line_key`, la stessa funzione riscritta in Python;
   il suo test ha l'esempio scritto in `favoriteKey.test.ts`). Le corse si
   leggono solo se partono entro il raggio (più 100 m) e hanno tanti punti
   quanti un candidato.
4. **Nessuna migrazione e nessun dato nuovo**: si legge, non si scrive.
   I conteggi non escono nella risposta: decidono solo l'ordine.
5. `run_scored` degli `insights` **non entra**: non sa di quale percorso
   è; le corse salvate dicono lo stesso e sanno il percorso.
6. **Nell'app** una riga «RECOMMENDED» che scorre di lato, sopra le
   schede di «Best near you», con le stesse schede (`RouteCard`) larghe
   come quelle di «NEARBY TOWNS»; un tocco apre il percorso come le altre.
   La riga (`RecommendedRow.tsx`) legge da sola il token dal portachiavi
   (`loadSession`), una volta per punto, perché `App.tsx` resta fuori dal
   task. Si chiede solo quando «Best near you» ha percorsi: senza
   catalogo vicino nessuna richiesta in più. Senza token, rete o risposta
   valida non c'è.

**Alternative scartate**:

- *La somiglianza esatta per prima*: 0,9968 contro 0,9971 avrebbe deciso
  sempre lei, e reazioni e corse non avrebbero mai contato.
- *Un punteggio solo* (somiglianza più reazioni pesate): un percorso
  disegnato peggio passerebbe davanti con qualche like; la scelta
  dell'utente mette il disegno prima.
- *Contare le reazioni di ogni disegno, anche privato*: chi rende privato
  un disegno non vuole che parli ancora per lui.
- *Senza token*: avrebbe mostrato agli ospiti un ordine fatto dagli
  iscritti; la riga senza account si nasconde (criterio del coordinatore).
- *Togliere i doppioni per strade in comune*: è la proposta che l'utente
  aveva scartato in ADR-0086.

**Conseguenze**:

- Il server va aggiornato (`best_routes.py`), senza migrazioni; finché non
  c'è, `/recommended` risponde 404 e la riga non c'è.
- Se l'app cambia `favoriteKey`, va cambiata anche `line_key`: il test
  dell'API ha lo stesso esempio di quello dell'app.
- Le corse dei percorsi disegnati sul telefono o dagli esempi di una
  città non entrano: solo il catalogo, come «Best near you».
- La riga ripete in un altro ordine percorsi che sono anche sotto: è il
  suo scopo (mettere davanti i migliori), non un doppione da togliere.
- Chi entra nell'account con «Explore» già aperto vede la riga dal punto
  o dalla città dopo: il token si legge per punto, non a ogni disegno.
- Senza `/recommended` sul server (404, un server di prima) la riga non
  c'è e «Explore» resta com'è, senza avvisi: l'app può uscire prima del
  server.
- Seguito (coordinatore, 2026-10-08): quando c'è TASK-121, le reazioni di
  chi l'utente ha bloccato non contano per lui (l'aiuto di
  `moderation.py`).

## ADR-0230 — La ricerca lontana parte solo dove vicino non si disegna niente
**Stato**: Attiva · 2026-10-08 · scelta dell'utente (2026-10-07: «ok» a
percorsi più veloci anche se diversi da quelli di oggi) e dell'agente su
delega dell'utente (quale delle due proposte (B) di TASK-203).

**Contesto**: dal TASK-038 (ADR-0040) la ricerca riparte da 1–2 km
(«Start here») appena quella attorno alla partenza non trova un percorso
**buono** (somiglianza ≥ 0,90 e distanza ±10%), anche se ne ha uno
disegnabile da 0,85. TASK-203 ha misurato che è metà del piano di una
richiesta lunga. Le due proposte (B) del task, che cambiano i percorsi,
erano dell'utente: saltare o dimezzare la ricerca lontana, e aspettare le
vicine 1 s invece di 3 quando la partenza è già buona. TASK-203 B le ha
misurate sul Mac, senza rete, per la strada dell'API (`plan_nearby`, tre
partenze vicine in processi), su 15 richieste in sei città in cache
(Trento ×5, Bologna ×3, Palermo ×2, Verona ×2, Levico ×2, Milano ×1),
a caldo e a freddo, 3 giri, le varianti alternate a ogni giro (load
average 4,5–16, mediana 6,7: altre sessioni al lavoro). La ricerca lontana
è partita in 6 richieste su 15 e ha vinto in 2: il cerchio da 15 km di
Trento (0,925 a 1 km, ma vince una partenza vicina con 0,970 e il lontano
resta seconda alternativa) e il cerchio da 15 km di Bologna (0,917 a 1 km
contro 0,884 dalla partenza). Nelle altre 4 ha bruciato 16–19
tracciamenti per niente. Nella città finta di `test_kept_per_graph.py`
(parchi, fiume, un terzo delle strade tolte) vince 2 volte su 5, e di
molto (cuore 0,912 contro 0,819, stella 0,935 contro 0,831).

**Decisione**:

1. **La ricerca lontana parte solo se vicino non c'è nessun percorso
   disegnabile** (`optimizer.plan_shape`: `_drawable` della ricerca
   dritta, come prima di TASK-232; somiglianza sotto 0,60 o oltre ±2 km
   dal target). Un percorso vicino disegnabile ma non buono si tiene, e la
   forma resta dove l'utente è. Quando parte, è come prima: 20
   tracciamenti, e il suo percorso sostituisce quello vicino se è buono o
   almeno disegnabile.
2. **`FAR_TRACES` resta 20** e **`NEARBY_GOOD_GRACE_S` resta 3 s**
   (sotto, le alternative scartate).
3. I percorsi nuovi sono fissati da `tests/test_far_search_skipped.py`
   (la ricerca lontana non parte con un percorso vicino disegnabile e il
   grafo grande non si legge; parte ancora dove non si disegna niente;
   le impronte dei due casi della città finta che cambiano) e da
   `test_kept_per_graph.py`, le cui due impronte cambiate sono aggiornate.

**Misure** (secondi, mediana di 3 giri a caldo, zona in memoria; fra
parentesi a freddo, processo nuovo; prima → dopo):

| Richiesta | Prima | Dopo | Percorso |
|---|---|---|---|
| Trento cuore 10 km | 4,07 (4,48) | 2,73 (3,50) | uguale, 0,915 (vicina), stesse alternative |
| Trento cerchio 15 km | 4,86 (5,30) | 2,92 (3,38) | uguale, 0,970 (vicina); perde la seconda alternativa (quella lontana, 0,924) |
| Trento «CIAO» 12 km tondo | 12,6 (10,1) | 6,05 (6,49) | uguale, 0,919 (vicina), stessa alternativa |
| Bologna cerchio 15 km | 4,48 (5,26) | 2,70 (3,22) | **diverso**: 0,884 dalla partenza (14,8 km) invece di 0,917 a 1 km (14,3 km) |
| Levico cuore 10 km | 1,84 (2,12) | 1,07 (1,63) | uguale, 0,839, stesse alternative |
| Levico cerchio 15 km | 2,63 (3,35) | 1,25 (1,83) | uguale, 0,906 (vicina), stesse alternative |

Nelle altre 9 richieste (stella 5 km, cuore 10 km e cerchio 15 km dove la
partenza è già buona, «CIAO» con la penna alzata, Milano) la ricerca
lontana non partiva e niente cambia. I tempi di «dopo» qui sono della
variante provata fuori dal motore; quelli del codice vero sono nel task
file, «Parte B».

**Alternative scartate**:

- *`FAR_TRACES` 20 → 10*: nessun percorso cambia nei 15 casi e nei 7 del
  test (dove la ricerca lontana vince, converge in 7–12 tracciamenti), ma
  guadagna solo 0,1–0,4 s sulle forme (cuore 4,07 → 3,93, cerchio 4,86 →
  4,70, Levico cuore 1,84 → 1,45) e 1,6–4 s sulla parola tonda: il costo
  fisso della ricerca lontana (ritaglio del grafo grande, `RoadMask`,
  conteggio delle strade da 36 partenze) resta tutto. Scelta sicura ma da
  poco; resta disponibile se l'utente preferisce non perdere mai uno
  «Start here».
- *Saltarla solo se vicino la somiglianza è ≥ 0,85*: salva i due casi
  della città finta (0,739 e 0,831 vicino) ma non Bologna (0,884), e fra i
  casi veri guadagna solo sul cuore di Trento.
- *`NEARBY_GOOD_GRACE_S` 3 → 1 s*: conta solo quando la partenza è già
  buona e le vicine sono lente, cioè le parole con la penna alzata
  («CIAO» 12 km: 6,47 → 4,55 a caldo, 4,59 → 3,31 a freddo), e lì toglie
  tutte le alternative; sulle forme le vicine finiscono entro 1–2 s e il
  guadagno è ≤ 0,1 s. Sul server, più lento del Mac, 1 s toglierebbe le
  alternative quasi sempre: l'attesa che l'utente ha scelto in TASK-093
  resta.

**Conseguenze**:

- Un percorso disegnabile ma sotto 0,90 vicino alla partenza non viene
  più sostituito da uno migliore a 1–2 km: a Bologna il cerchio da 15 km
  passa da 92% a 88%; nei posti con buchi (fiumi, parchi, campi) la
  perdita può essere più grande (la città finta: −0,09 e −0,10).
- Cambia l'impronta del motore: dopo l'aggiornamento del server va
  rilanciato `draw_examples` (circa 40 minuti, `AGENTI.md` regola 11), con
  l'ok dell'utente; `apps/mobile/assets/engine/engine.zip` è rifatto.
- `docs/ROUTE_ENGINE.md` §5, «Trova dove la forma ci sta», descrive la
  regola nuova.

## ADR-0231 — Tono scuro o chiaro, con la luminosità in cinque passi
**Stato**: Attiva · 2026-10-08 · la richiesta e il significato di
«luminosità» sono scelte dell'utente («dai la possibilità di cambiare tono
scuro chiaro, e la luminosità, nel tono»; poi «più chiaro o più scuro il
tono», con l'app che si riapre al cambio); colori e meccanismo decisi
dall'agente su delega dell'utente (TASK-263). Supera ADR-0046 nel punto
«un solo tema, scuro».

**Contesto**: l'app aveva un solo tono, scuro (ADR-0046), con tutti i
colori in `tokens.ts`. Gli stili leggono i colori quando il loro file si
carica: 101 `StyleSheet.create` e la mappa nella WebView, scritta una
volta come testo. Cambiare tono mentre l'app è aperta voleva dire
riscriverli tutti con un hook, toccando i file di ogni altro task.

**Decisione**:

1. **Due toni, cinque passi ciascuno.** Ogni tono ha due estremi in
   `tokens.ts` (`SHADES`): il più scuro e il più chiaro; i tre passi in
   mezzo sono mescolati colore per colore. Scuro va dai colori di sempre
   (identici, passo 0) all'antracite; chiaro dal grigio chiaro al bianco.
   Anche la mappa ha i suoi colori in ogni tono.
2. **Non cambiano mai** il giallo e il testo sul giallo, il rosso dei
   numeri e i colori di Strava. Nel tono chiaro avvisi, errori e «Start
   here» sono più scuri, per leggersi sul chiaro.
3. **I contrasti sono un test** (`palettes.test.ts`), per ogni tono a
   ogni passo: testo ≥ 7:1 su fondo, scheda e comando; testi secondari,
   avvisi ed errori ≥ 4,5:1; bordo dei comandi ≥ 3:1; nomi dei luoghi
   ≥ 4,5:1 sul loro alone.
4. **Il percorso sulla mappa chiara ha un bordo scuro** (`routeCasing`):
   il giallo è chiaro quanto le strade e da solo non si vede. Sulla mappa
   scura nessun bordo, come prima.
5. **La scelta resta sul telefono** (`tone.json`, `src/theme/tone.ts`),
   letta in modo sincrono all'avvio come lingua e unità; ogni tono ricorda
   il suo passo. Senza scelta: scuro, passo 0, cioè l'app di prima. Il
   chiaro parte dal bianco.
6. **Cambiare tono riapre l'app** (`reloadAppAsync` di `expo`): `color` si
   riempie una volta, quando `tokens.ts` si carica, e nessuno dei file che
   lo usano cambia. In «Settings» un'anteprima disegnata nei colori scelti
   (fondo, scheda, testi, comando, mappa e percorso) fa provare toni e
   passi senza riaprire a ogni tocco; «Apply» compare solo se l'app
   cambierebbe aspetto, salva e riapre.
7. **La barra di stato** segue il tono: chiara sullo scuro, scura sul
   chiaro (`statusBarStyle`).

**Alternative scartate**:

- *Un tema dinamico con un hook in ogni schermata*: cambio istantaneo, ma
  un centinaio di file da riscrivere, quasi tutti di altri task.
- *Riaprire l'app a ogni tocco di un passo*: cinque riaperture per
  provare cinque passi.
- *La luminosità dello schermo* (`expo-brightness`): proposta, scartata
  dall'utente.
- *Seguire il tono del telefono*: non chiesto.

**Conseguenze**:

- Riaprendosi, l'app rifà l'animazione di apertura e torna alla prima
  pagina.
- Restano scure nel tono chiaro le tastiere (`keyboardAppearance="dark"`
  in una decina di file di altri task) e il logo bianco «Compatible with
  Strava» (TASK-218) va sostituito, sul chiaro, dalla versione scura del
  pacchetto di Strava: una parte B di TASK-263.
- Un colore nuovo si aggiunge a tutti e quattro gli estremi di `SHADES`,
  o a `FIXED` se non cambia col tono.

## ADR-0233 — La build dello store ha il runtime dal fingerprint, Expo Go resta su `exposdk:57.0.0`
**Stato**: Attiva · 2026-10-08 · TASK-152 parte A · deciso dall'agente su
delega dell'utente (l'utente ha chiesto il profilo `production` e il
`fingerprint` prima dell'App Store; come farli convivere con Expo Go è
dell'agente).

**Contesto**: `eas.json` aveva solo `preview`. `runtimeVersion` in
`app.json` è `exposdk:57.0.0`: cambia solo con l'SDK. Per una build
dello store vuol dire che un `eas update` fatto dopo una libreria nativa
nuova (stesso SDK) arriverebbe a telefoni che quella libreria non ce
l'hanno, e l'app si chiuderebbe all'avvio. Il rimedio di Expo è la
politica `fingerprint`: il runtime è un'impronta del codice nativo. Ma
Expo Go apre un update solo se il runtime è `exposdk:<sdk>` (ADR-0078):
passare tutto a `fingerprint` spegnerebbe il canale `preview` sull'iPhone.

**Decisione**:

1. `app.json` non cambia: `exposdk:57.0.0` per Expo Go, per il canale
   `preview` e per le build `preview`.
2. Un nuovo `apps/mobile/app.config.ts` riprende `app.json` e, solo con
   `APP_VARIANT=production`, mette `runtimeVersion: {policy:
   "fingerprint"}`.
3. Profilo `production` in `eas.json`: canale `production`, ambiente
   EAS `production`, `autoIncrement` del numero di build (le versioni
   stanno su EAS, `appVersionSource: remote`), `APP_VARIANT=production`
   in `env`.
4. Gli update per lo store si pubblicano con la stessa variabile:
   `APP_VARIANT=production npx eas-cli update --channel production ...`
   (`DEPLOY.md` A.7).
5. `apps/mobile/fingerprint.config.js` toglie dall'impronta la versione,
   il numero di build ed `eas.json`, oltre a quello che Expo toglie già
   (gli script `ios`/`android` di `package.json`, la cartella `ios/`
   locale, ignorata da git).

**Provato sul Mac** (`expo-updates runtimeversion:resolve`, iOS):
senza variabile il runtime resta `exposdk:57.0.0`; con la variabile è un
hash di 40 caratteri, uguale due volte di fila. Non cambia con: versione
1.0.0 e build 7, una sezione `submit` in `eas.json`, una riga in
`App.tsx`, una cartella `ios/` locale. Cambia con: `supportsTablet`
falso, un plugin nativo in più (`expo-location`). Android ha un'impronta
sua. Nell'impronta entra anche il percorso dei pacchetti: un worktree con
`node_modules` collegati dalla cartella principale dà un altro hash di un
checkout con `npm install` (le prove sopra confrontano sempre lo stesso
worktree).

**Alternative scartate**:

- *`fingerprint` in `app.json` per tutti*: Expo Go non apre più gli
  update di `preview` (ADR-0078), e il criterio di TASK-152 «Expo Go
  funziona come prima» cade.
- *`exposdk:57.0.0` anche per lo store, solo canali separati*: niente
  ferma un update con codice nativo nuovo verso le build vecchie; il
  controllo resterebbe a memoria.
- *`appVersion` (il runtime è la versione dell'app)*: va ricordato di
  alzarla a ogni cambio nativo; lo stesso errore, spostato.
- *Lasciare `eas.json` nell'impronta (il default di Expo)*: la sezione
  `submit` che TASK-152 aggiunge dopo la prima build cambierebbe il
  runtime, e gli update smetterebbero di arrivare in silenzio.
- *`EAS_BUILD_PROFILE` invece di `APP_VARIANT`*: esiste solo durante
  `eas build`, non in `eas update`.

**Conseguenze**:

- Un errore con la variabile non rompe niente: un update per lo store
  pubblicato senza `APP_VARIANT` ha il runtime di Expo Go e nessuna
  build dello store lo prende; uno per `preview` con la variabile non
  lo prende Expo Go. In tutti e due i casi `eas update` stampa il
  runtime: va controllato.
- Ogni cambio nativo (libreria, plugin, permesso, icona, splash, SDK)
  vuole una build nuova e la revisione di Apple: gli update per lo store
  arrivano solo alle build con la stessa impronta.
- L'impronta calcolata sul Mac e quella della build su EAS non sono
  ancora state confrontate: si fa alla prima build `production`
  (`DEPLOY.md` A.7, punto 4).
- L'ambiente EAS `production` deve avere `EXPO_PUBLIC_API_URL` e
  `EXPO_PUBLIC_API_KEY` prima della prima build: oggi ci sono solo in
  `preview`.
- *Aggiunta del 2026-10-09 (TASK-152 parte B)*: la prima versione per lo
  store è `1.0.0` (prima `0.0.0`); `version` resta fuori dall'impronta.
  Alla prima build `production` (EAS `4455655b`) l'impronta è risultata
  uguale a quella del Mac, `97c9f355…`.

## ADR-0234 — Il dominio getmuw.app: si resta su Hetzner, l'API anche su api.getmuw.app
**Stato**: Attiva · 2026-10-08 · scelta dell'utente (restare sul server,
il nome); il modo deciso dall'agente su delega dell'utente e diviso dal
Coordinatore (TASK-265).

**Contesto**: l'utente voleva «spostare il sito» su un'azienda tedesca
(«Zeda Server», forse Zade Servers). Il sito (`site/`, TASK-237) non era
online da nessuna parte; sul server Hetzner CX33 di Falkenstein gira
l'API, raggiunta dall'app su `188-245-9-220.sslip.io`, un nome che
contiene l'IP e cambia con il server. Hetzner è già un'azienda tedesca.
Saputo questo, l'utente ha scelto di restare e di comprare un dominio:
`getmuw.app`, preso da lui su Porkbun il 2026-10-08 (liberi anche
`muw.run`, `muwrun.com`, `muw.club`; già presi `muw.com`, `muw.app`,
`muw.it`, `muwapp.com`, `getmuw.com`).

**Decisione**:

1. Il server resta quello di Hetzner. Nessun trasloco.
2. L'API risponde su `api.getmuw.app` **e** su `188-245-9-220.sslip.io`:
   un indirizzo in più nella riga del Caddyfile di apt, un `reload` senza
   fermare niente. Il vecchio nome resta per le app che non hanno ancora
   l'aggiornamento con l'indirizzo nuovo.
3. `getmuw.app` e `www.getmuw.app` sono per il sito (TASK-237), sullo
   stesso Caddy: una copia dei soli file che la pagina carica in
   `/srv/getmuw-site`, presa da `origin/main` con `git archive` e un
   elenco esplicito, rifatta a mano dopo ogni merge che cambia il sito;
   `www` rimanda a `getmuw.app`.
4. Tre record `A` verso l'IPv4 del server, nessun `AAAA` per ora.
5. Il ritorno da Strava (`SHAPEROUTE_DOMAIN`) resta su `sslip.io`.
6. Chi fa cosa: la documentazione TASK-265; il Caddyfile sul server e
   `EXPO_PUBLIC_API_URL` di `preview` il Coordinatore, ciascuno con l'ok
   dell'utente; il sito la sessione di TASK-237. Come si fa:
   `DEPLOY.md`, F.14.

**Alternative scartate**:

- *Spostare tutto su un altro provider tedesco*: un trasloco (30 GB di
  zone, il database, una pubblicazione dell'app) per arrivare dove si è
  già, in Germania; il dominio rende invisibile all'app un trasloco
  futuro, se un giorno servirà.
- *Sostituire `sslip.io` con `api.getmuw.app`*: le app che non hanno
  ancora scaricato l'aggiornamento resterebbero senza API.
- *Passare al Caddy di `deploy/compose.yaml`* (F.12, punto 4): due
  cambi insieme dove ne basta uno.
- *DNS su Cloudflare con il proxy acceso*: Caddy e Let's Encrypt
  lavorano già da soli; un intermediario in più da configurare.

**Conseguenze**:

- Un nome che resta se cambia il server, e che serve anche agli store
  (la pagina della privacy, F.10).
- Il dominio va rinnovato ogni anno (Porkbun, l'utente); `.app` vuole
  sempre HTTPS, che Caddy dà da solo.
- Spostare il ritorno da Strava su `api.getmuw.app` richiede di cambiare
  anche l'applicazione Strava dell'utente: un passo a parte.

## ADR-0232 — Il tipo di mappa: Standard, Satellite, 3D in un solo stile

**Stato**: Attiva · 2026-10-09 · il pulsante e i tre tipi sono richiesta
dell'utente del 2026-10-08; Esri per le foto è scelta dell'utente
(«Esri, chiave dopo»); il resto deciso dall'agente su delega dell'utente
(TASK-264).

**Contesto**: la mappa era solo lo stile scuro dell'app (ADR-0046) nella
pagina MapLibre della WebView (ADR-0029). L'utente ha chiesto di poter
scegliere fra mappa normale, satellitare e 3D. Le foto aeree buone e
gratuite sono quelle di Esri (World Imagery, fino a circa un metro in
Italia): senza account Esri l'uso in un'app con pubblicità è una zona
grigia delle loro condizioni, con un account gratuito ArcGIS Location
Platform (chiave nell'app, 2 milioni di tasselli al mese) è in regola.

**Decisione**:

1. **Un solo stile per tre tipi** (`map/mapKindStyle.ts`): lo stile
   scuro con dentro, nascosti, le foto (sopra lo sfondo), una copia dei
   nomi in chiaro per le foto (`-on-photos`, testo `text` su alone
   `background`) e l'ombreggiatura del rilievo (sopra il terreno, sotto
   strade e nomi). Il tipo mostra e nasconde strati con
   `setLayoutProperty`: lo stile non si ricarica, e percorso, segni e
   inquadratura restano. Uno strato nascosto non scarica tasselli.
2. **Satellite** = sfondo, foto, nomi chiari; niente strade scure sopra.
   Credito «Powered by Esri» con le fonti del servizio. Con
   `EXPO_PUBLIC_ARCGIS_API_KEY` le foto vengono da `ibasemaps-api.arcgis.com`
   con il token; senza, da `server.arcgisonline.com`.
3. **3D = il rilievo, come in Strava e komoot**: lo stile scuro più
   l'ombreggiatura, il terreno (`setTerrain`, esagerazione 1,3) e la mappa
   inclinata a 55°. Le altezze sono le Terrain Tiles del registro AWS
   (codifica terrarium), gratuite e senza chiave; due fonti uguali per
   terreno e ombreggiatura, come chiede MapLibre.
4. **L'inquadratura non cambia**: inclinata, una forma inquadrata come
   piatta occupa meno schermo, mai di più (misurato nel browser, una
   forma alta e stretta compresa). Cambiando tipo con il percorso
   inquadrato, la mappa lo inquadra di nuovo con la nuova inclinazione;
   altrimenti si inclina dov'è.
5. **La scelta resta sul telefono** (`map-kind.json`, come le unità);
   «Standard» non scrive niente. `MapView` la manda alla pagina appena è
   pronta e a ogni cambio; una pagina nuova parte standard.
6. **Il pulsante** è tondo come «←» e la freccia del nord, con due fogli
   disegnati (l'app non ha icone), in alto a destra; mentre si corre la
   barra delle svolte prende la riga e il pulsante sta sotto. Il menu si
   apre sotto il pulsante, dentro la colonna e non sovrapposto, perché su
   Android un tocco fuori dai bordi del genitore non arriva.

**Alternative scartate**:

- *Edifici in 3D* (`fill-extrusion` dai tasselli OpenMapTiles): provati.
  Con il rilievo acceso il percorso è steso sul terreno e gli edifici lo
  coprono strada dopo strada, anche semitrasparenti; senza rilievo si
  perdono le montagne, che in Trentino sono il 3D che conta.
- *Un `setStyle` per tipo*: toglie gli strati che la pagina aggiunge (il
  percorso, i segni) e va rifatto tutto.
- *MapTiler o Mapbox per le foto*: chiave obbligatoria, e per un'app con
  pubblicità MapTiler è a pagamento.
- *Sentinel-2 (EOX)*: libero, ma 10 m per pixel: alle vie non serve.
- *Allontanare l'inquadratura in 3D*: non serve, vedi il punto 4.

**Conseguenze**:

- Solo app: nessun server, nessuna migrazione. Esri e AWS vedono la zona
  guardata, come OpenFreeMap (`UI.md`, «Cosa esce dal telefono»).
- La chiave ArcGIS è facoltativa: quando l'utente crea l'account va in
  `apps/mobile/.env` e nelle variabili di EAS (`preview`, poi
  `production`). Fino ad allora le foto vengono dall'indirizzo pubblico.
- Le mappe sotto i disegni di «Feed» ed «Explore» restano standard.
- Nel tono chiaro (TASK-263, ADR-0231) l'ombreggiatura prende l'ombra
  scura e la luce chiara di quel tono (`hillshadeOf`); i nomi sulle foto
  sono il testo del tono sul suo fondo, scuri su alone chiaro.
- Seguiti possibili, da chiedere: satellite e 3D insieme (le foto sul
  rilievo).

## ADR-0211 — aggiornamento (parte B): il server tiene le figure «Paddle» dei laghi e delle spiagge
**Stato**: Attiva · 2026-10-09 · deciso dall'agente su delega dell'utente
(TASK-246 parte B); task e via dal coordinatore, nessun numero nuovo.

**Contesto**: con ADR-0211 ogni telefono chiede le otto forme dei tre
posti più vicini, dal punto delle liste `lakes.json` e `beaches.json`
dell'app. `route_store.py` (ADR-0136) teneva solo i percorsi dal centro di
una città: il server ridisegnava le stesse 24 forme per ogni telefono
nuovo della stessa zona: a Levico 11 s di motore sul Mac, tre-cinque
volte tanto sul server, per ogni telefono, e una coda quando ne arrivano
molti insieme.

**Decisione**:

1. I punti delle due liste sono **centri anche loro**, dati all'avvio
   (`RouteStore(water=…)`, letti da `water_spots.py`): un percorso dallo
   stesso quadrato di 10 m si tiene come quello dal centro di una città,
   con la stessa chiave (forma, distanza, attività, penna alzata,
   motore). Non si imparano e non si scrivono in `city-centres.txt`.
2. **Una cartella e un limite loro**: `routes/water/`, 10 000 percorsi
   (circa 8 kB l'uno). I 6 400 percorsi delle liste non spingono fuori
   gli esempi delle città, e viceversa.
3. Le liste restano **quelle dell'app**: il `Dockerfile` e
   `.dockerignore` copiano i due file nell'immagine allo stesso percorso
   del repository. Una lista assente vale vuota.
4. `draw_examples --water` (e `--water-name`) fa il primo telefono per
   ogni punto: le otto forme nell'ordine dell'app, a pezzi con la penna
   alzata come la chiede l'app; un punto senza acqua sul server si salta
   alla prima forma.
5. L'app non cambia: chiede le stesse richieste, che arrivano già
   `done`. I 6 s fra una richiesta e l'altra di `aheadExamples.ts`
   restano: servono al limite di 30 POST al minuto, che conta anche le
   risposte tenute.

**Alternative scartate**:

- *Una copia delle liste dentro `services/api/`*: due file da tenere
  uguali, e TASK-245 C sta già cambiando quello delle spiagge.
- *`learn` dei punti in `city-centres.txt`*: si dimenticherebbero con i
  centri più vecchi (`MAX_CENTRES`) e il file crescerebbe a ogni avvio.
- *Tenere ogni percorso `paddling`, da qualunque partenza*: la partenza è
  la posizione di chi chiede (ADR-0085, ADR-0092).
- *Lo stesso limite di 3000 delle città*: `draw_examples --water` lo
  riempirebbe da solo.

**Conseguenze**:

- Un telefono nuovo in una zona già chiesta, o disegnata prima, ha le sue
  24 forme senza motore (0 s sul Mac invece di 11 s); il giro sul
  telefono dura sempre circa due minuti e mezzo, per i 6 s fra le
  richieste: il guadagno è del server, non del tempo che vede l'utente.
- Ogni cambio di `route_engine` le fa ridisegnare tutte, come gli esempi
  delle città; `draw_examples --water` è molto più lungo di quello delle
  città (stima in `tasks/TASK-246.md`, «Esito parte B»).
- Su disco circa 50 MB per tutti i punti, 80 MB al più, in
  `data/cache/routes/water/`.

## ADR-0215 — aggiornamento (parte C): in bici senza percorso, la velocità
**Stato**: Attiva · 2026-10-09 · **scelta dell'utente** del 2026-10-08
(la velocità, non il passo al km); il come è **deciso dall'agente su
delega dell'utente** (TASK-251, parte C).

**Contesto**: il punto 7 di ADR-0215 lasciava a una pedalata senza
percorso il passo al km, segnalandolo. L'utente ha scelto la velocità.

**Decisione**:

1. Senza percorso lo sport di «Settings» alla partenza va nel file della
   corsa anche quando è `cycling` (`navigation/freeSport.ts`,
   `freeRunActivity`): la scheda e la fine della corsa passano dallo
   stesso `useRunNumbers` di un percorso in bici (TASK-216), con gli
   stessi testi. Una corsa non ha sport nel file, come prima.
2. **La voce non cambia**: ogni km col passo medio, come una corsa senza
   percorso. Con un percorso la bici dice ogni 10 km la velocità media
   (ADR-0179): non chiesto, segnalato all'utente, che il 2026-10-09 ha
   scelto di lasciarla così.
3. Il post scrive il passo al km e «My activities» non cambia: è quello
   che fa già una pedalata con un percorso.

**Alternative scartate**: un componente proprio per la pedalata senza
percorso (due modi di mostrare la stessa cosa); cambiare anche la voce
(non chiesto: una scelta dell'utente).

## ADR-0235 — Il tour del primo avvio sulle schermate vere, e «Guide» in «Profile»
**Stato**: Attiva · 2026-10-09 · **scelta dell'utente** (un tutorial alla
prima apertura, saltabile ma non nei primi 5 secondi; una guida d'uso;
fra tre proposte, il tour sulle schermate vere); il come è **deciso
dall'agente su delega dell'utente** (TASK-266).

**Contesto**: l'app non mostrava a chi la apre la prima volta come si
usa. «How MuW works» (TASK-184) c'era, ma solo da «Settings», quindi solo
con un account.

**Decisione**:

1. Dopo l'animazione all'avvio, alla prima apertura, un tour sopra l'app
   (`src/tour/`, montato in `intro/Root.tsx`): il resto dello schermo
   scuro, una parte vera nella luce, poche parole accanto, «Next». Otto
   passi, in ordine: benvenuto, «START», le forme, la distanza, il fondo
   di «Draw» con «Draw route», sport e «Profile», la pagina «Explore», la
   pagina «Feed»; finisce su «Draw». La corsa non ha un passo: non si
   mostra senza un percorso disegnato, la dice il passo di «Draw route».
2. **Le parti si trovano per nome**: le schermate danno al tour le loro
   viste (`TourPartView`, `tourPart`, `useTourPart`), il tour le misura
   (`measureInWindow`) e le unisce. Una parte sotto il bordo di «Draw» è
   portata in vista (`TourScrollView`); una pagina si cambia come
   toccandone il nome (`useTourPager`). Il tour rimisura ogni 150 ms
   finché le parti sono tutte sullo schermo e ferme, al più 1,5 s: una
   pagina che entra scorrendo non è misurata a metà. Una parte che non
   c'è lascia le parole al centro, senza luce. Niente librerie nuove.
3. **«Skip»** c'è da subito ma per `SKIP_LOCK_S` = 5 secondi non si
   tocca e conta alla rovescia («Skip (5)»); il conto è del tour, non del
   passo, e si ferma mentre il telefono chiede qualcosa sopra l'app
   (`AppState` non attivo: la posizione, alla prima apertura). «Next» si
   tocca subito.
4. Visto fino in fondo o saltato, il telefono lo ricorda in
   `tour-seen.json` (come l'avviso di «Paddle», ADR-0169). Senza le
   pagine sullo schermo (una corsa lasciata aperta) il tour non parte e
   non conta come visto.
5. **«Guide»** sulla prima pagina di «Profile», con e senza account (con
   un account subito sotto «Settings», su richiesta dell'utente del
   2026-10-10; senza, in fondo), apre «How MuW works» (il testo di «Help», che non cambia) con sopra
   «Watch the tour»: chiude «Profile» e rifà il tour, con «Skip» subito.
   Anche «Help» in «Settings» ha «Watch the tour».
6. Il buio è un colore fisso nuovo, `scrim`, con opacità 0,82, e il bordo
   della luce `onScrim`: scuro nei due toni di ADR-0231, mai giallo (il
   giallo è del percorso).
7. I testi sono in `tour/tourTexts.ts` nelle cinque lingue, non in
   `i18n/`; i nomi dei pulsanti che citano sono quelli di `i18n/`, e un
   test lo controlla. Con «Paddle» il passo delle forme ha il suo testo.

**Alternative scartate**: animazioni disegnate o immagini delle schermate
(proposte, l'utente ha scelto il tour vero); una libreria di tour (una
dipendenza per poche centinaia di righe); il conto alla rovescia per ogni
passo (5 secondi a passo sono un tutorial lungo, non breve).

**Conseguenze**: chi aggiorna l'app vede il tour una volta, come chi la
scarica (nessun modo di distinguerli senza un dato in più). Una parte
nuova da mostrare è un nome in `TOUR_PART`, una vista con quel nome e un
passo in `TOUR_STEPS`.

## ADR-0197, aggiunta — Il «Try» della riga si conta come `better_distance`
**Stato**: Attiva · 2026-10-09 · deciso dall'agente su delega dell'utente
(TASK-234 parte C), dentro la **scelta dell'utente** del 2026-10-08
(«Tutti e due»: contare i tocchi su «Try N km» e un segno visibile mentre
il percorso nuovo si calcola). Aggiunta ad ADR-0197, senza numero nuovo,
d'accordo con il coordinatore.

**Decisione**:

1. «Try N km» della riga sotto un percorso riuscito manda `hint_taken`
   con un `hint` nuovo, `better_distance`, con `distance_m` (quella
   disegnata) e `to_m` (quella provata). Un valore nuovo di un segnale
   che c'è, non un `kind` nuovo: il report delle ricerche lo conta già fra
   gli `hints`, a parte dai `try_distance` degli errori; la proposta
   `review_distance` resta dei soli errori.
2. Additivo: l'API nuova registra i corpi di prima come prima; un'API di
   prima risponde 422 al `hint` nuovo e l'app, che manda i segnali senza
   aspettarli, non se ne accorge. Il corpo nuovo è in un fixture suo,
   `signal-better-distance.json`, per non cambiare `signals.json` che i
   test di TASK-142 leggono per posizione.
3. Nessun indicatore nuovo sul pulsante: il «Try» fa partire un disegno
   nuovo e il pannello dell'attesa (testo, «Cancel», barra) prende subito
   il posto del percorso e della riga. Un secondo indicatore sopra
   sarebbe lo stesso segno detto due volte.

**Alternative scartate**: un `kind` nuovo (`better_taken`): un modello e
un conteggio in più nell'API per la stessa cosa, un «Try»; uno spinner
nel pulsante: il pulsante non resta sullo schermo mentre si calcola.

## ADR-0137, aggiunta — Su «Data» scorrono solo i numeri
**Stato**: Attiva · 2026-10-09 · deciso dall'agente su delega dell'utente
(TASK-268), dopo la corsa su strada dell'utente dello stesso giorno («se
compaiono le indicazioni si sposta tutto in basso e non si riesce più a
cliccare»). Aggiunta ad ADR-0137, senza numero nuovo.

**Decisione**:

1. La pagina «Data» ha tre parti: in alto l'indicazione (o la via verso la
   partenza), fissa; in mezzo una sola `ScrollView` che prende lo spazio
   che resta, con i km grandi, la barra del percorso, i numeri, i km uno
   per uno, gli interruttori e la voce; in fondo i pulsanti della corsa e
   «Map» / «Data», fissi. Prima la pagina era una colonna fissa: con
   l'indicazione in alto i pulsanti e «Map» uscivano dallo schermo, e il
   tocco dove stava «Map» cadeva sugli interruttori.
2. I km uno per uno non hanno più uno scorrimento loro: due scorrimenti
   verticali uno dentro l'altro si contendono il dito.
3. Lo swipe verso la mappa resta della pagina: lo scorrimento ha
   `directionalLockEnabled`, la pagina non cede uno swipe iniziato, e se
   le viene tolto torna al suo posto invece di restare a metà.

**Alternative scartate**: rimpicciolire i km grandi o togliere righe
(cambia quello che l'utente vede, e una corsa lunga esce dallo schermo lo
stesso); mettere anche l'indicazione nello scorrimento (la svolta è il
motivo per cui si guarda la pagina correndo).

## ADR-0237 — La build dello store senza AdMob: niente codice nativo con APP_VARIANT=production
**Stato**: Attiva · 2026-10-09 · «la lanciamo senza pubblicità, faremo
poi», e poi «la pubblicità la inseriamo quando facciamo la società»:
scelte dell'utente; il come deciso dall'agente su delega dell'utente
(TASK-267), su indicazione del coordinatore di togliere il codice nativo

**Contesto**: la 1.0 va in revisione da Apple senza annunci; gli annunci
veri aspettano la società dell'utente (TASK-153 fermo). Il codice degli
annunci nativi del Feed (ADR-0198) resta: preview, Expo Go e le build di
prova come oggi.

**Decisione**:
- `apps/mobile/react-native.config.js` (file nuovo) toglie
  `react-native-google-mobile-ads` dall'autolinking, iOS e Android, quando
  `APP_VARIANT=production`, la variabile che `eas.json` dà al profilo
  `production` (come per il runtime di `app.config.ts`, TASK-152). Nella
  build dello store non entrano né l'SDK di AdMob né quello del consenso di
  Google (UMP), né i loro manifesti della privacy.
- Il JS non cambia: senza il modulo nativo `src/ads/admob.ts` non carica il
  pacchetto e dà «nessun annuncio», come in Expo Go. Il Feed ha solo i
  post, senza spazi vuoti (un posto senza annuncio non entra nella lista,
  `feedWithAds`). Un test controlla che fuori da `admob.ts` il pacchetto
  sia importato solo come tipo.
- Gli update del canale `production` girano sulla build senza il modulo:
  anche loro senza annunci, qualunque cosa ci sia nel JS.

**Alternative scartate**: una variabile `EXPO_PUBLIC_ADS=off` che lascia
l'SDK nell'app, fermo (fatta e poi tolta: il manifesto della privacy di
Google, che dichiara l'ID del dispositivo per il tracciamento, finiva
comunque nel pacchetto); togliere il plugin da `app.json` o da
`app.config.ts` (file di altri task; il plugin da solo scrive solo chiavi
in `Info.plist`); spegnere gli annunci ovunque (preview resta come oggi).

**Conseguenza**: l'impronta della build `production` cambia (il file
entra nell'impronta e cambia l'autolinking): la build 5 è comunque nuova.
Si ricontrolla come in `DEPLOY.md` A.7 punto 4, sempre con
`APP_VARIANT=production`. In `Info.plist` resta la chiave
`GADApplicationIdentifier` scritta dal plugin di `app.json`: senza l'SDK
non fa nulla. I testi «Termini» e «Privacy» dell'app e del sito dicono
ancora che ci sono annunci: si correggono nei loro task. Per riaccendere
gli annunci (TASK-153): togliere la condizione da `react-native.config.js`
e fare una build nuova; un update non basta.

## ADR-0228 — Segnalare e bloccare: due tabelle, un blocco nei due sensi, nessun pannello
**Stato**: Attiva · 2026-10-09 · il perimetro è del brief del coordinatore
(2026-10-07/08) e dell'ok dell'utente a segnalare e bloccare; il resto
deciso dall'agente su delega dell'utente (TASK-121). I testi dell'app
sono confermati dall'utente il 2026-10-09.

**Contesto**: con il feed vero (ADR-0227) i disegni di chiunque arrivano a
chiunque. Serviva un modo per non vedere più una persona e per dire a chi
gestisce l'app che qualcosa non va. Il vecchio piano di TASK-121 aveva
anche gli endpoint `/admin`, le regole al primo accesso e il rifacimento
di `DELETE /me`: il brief li lascia fuori.

**Decisione**:

1. **Due tabelle nuove** in una migrazione nuova (`0020_moderation.sql`,
   il numero è il primo libero al merge): `blocks` (chi blocca, chi è
   bloccato, quando) e `reports` (chi segnala, cosa, l'id, il motivo,
   quando). Tutte e due cadono con l'account di chi blocca o segnala.
2. **Un blocco vale nei due sensi**: basta una riga perché nessuno dei due
   veda l'altro. Una sola condizione SQL, `follows.apart_sql`. Entra in
   `drawings.drawing_seen_sql` e `shown_sql` (con il sì del coordinatore
   del 2026-10-09), e da lì nel disegno aperto per id, nelle sue foto, nei
   suoi commenti e nelle sue reazioni, nel feed e nei disegni di un
   profilo. In più la leggono i commenti di un lettore bloccato sotto il
   disegno di un terzo, il conteggio delle reazioni, la ricerca per nome,
   la richiesta di follow, il profilo pubblico e i disegni di un profilo
   (`404`). Sta in `follows.py`, accanto a `follows_sql`, e non in
   `moderation.py`: `moderation.py` usa i corpi di `follows.py`, e il
   contrario sarebbe un import circolare. Un profilo bloccato risponde
   `404` come per nessuno: niente dice all'altro che è stato bloccato.
3. **Bloccare chiude ogni follow** fra i due, nei due sensi, richieste
   comprese, nella stessa transazione; sbloccare non rimette niente.
   Bloccare due volte, o sbloccare chi non è bloccato, non cambia niente.
4. **Una segnalazione per chi segnala e per cosa**: la seconda aggiorna
   motivo e ora. `target_id` **senza chiave esterna**: la segnalazione
   resta anche quando la cosa segnalata sparisce. Motivi da un elenco
   corto (`spam`, `offensive`, `harassment`, `sexual`, `other`), codici e
   mai parole: l'app li dice nella sua lingua. Si segnala solo ciò che
   esiste e non è proprio.
5. **Nessun endpoint legge le segnalazioni** e nessun ruolo admin entra in
   gioco: si leggono nel database finché non servirà un pannello.
6. **Nell'app** un «…» sulla scheda di un disegno di un altro e sul
   profilo di un altro apre un foglio con «Report» (i cinque motivi, poi
   un grazie) e «Block» (chiede prima, dicendo cosa fa). Dopo un blocco
   le schede di quella persona spariscono subito da «Feed» grazie a un
   piccolo registro in memoria (`social/blockedNow.ts`), senza toccare
   `FeedScreen.tsx` né `useFeed.ts`; la lettura dopo del feed non le ha
   comunque. Gli elenchi di chi segue si rileggono (`FollowLists` con una
   `key` che cambia a ogni blocco). «Blocked people» in «Profile» elenca i
   bloccati con «Unblock».

**Fuori, per ora**: i tag in un disegno, «Recommended» (TASK-092, che non
passa da `shown_sql`) e le notifiche vecchie.

**Conseguenze**: ogni lettura social fa una sottoquery in più su `blocks`,
con la chiave e un indice su `blocked_id`: trascurabile ai numeri di oggi.
Chi aggiunge un endpoint che mostra persone o contenuti di altri deve
aggiungere `apart_sql`.

## ADR-0225, aggiunta — La voce parla a telefono bloccato, col silenzioso, e abbassa la musica
**Stato**: Attiva · 2026-10-10 · **scelte dell'utente** del 2026-10-10 (la
dipendenza `expo-audio`, la musica che si abbassa, la voce anche col
silenzioso); il modo deciso dall'agente su delega dell'utente (TASK-261
parte B). Aggiunta ad ADR-0225, senza numero nuovo.

**Decisione**:

1. Durante una corsa (con e senza percorso) la sessione audio di iOS è
   `playback` con `duckOthers`: la voce parla a telefono bloccato (con
   `UIBackgroundModes` `audio`) e con l'interruttore silenzioso, e la
   musica di un'altra app si abbassa mentre parla. Fuori dalla corsa
   torna `ambient` mescolabile.
2. La sessione si attiva quando la sintesi vocale parla e l'app la
   rilascia quando la voce non ha più parole (`isSpeakingAsync` ogni
   secondo, solo mentre parla): iOS altrimenti terrebbe la musica bassa
   per tutta la corsa. La musica torna su al più un secondo dopo
   l'ultima parola.
3. Il modulo nativo di expo-audio si chiede con
   `requireOptionalNativeModule`: un'app costruita senza parla come
   prima. Solo iOS; Android come prima.
4. `NSMicrophoneUsageDescription` c'è, con un testo che dice che l'app
   non registra: expo-audio porta con sé il codice per registrare, e per
   un pacchetto così senza la chiave Apple segnala ITMS-90683 e può
   rifiutarlo.

**Alternative scartate**: `useApplicationAudioSession: false` di
expo-speech (una sessione del sistema per la sola voce, senza dipendenze):
Apple non dice se parla a telefono bloccato e col silenzioso, e non si
prova senza un iPhone; `onDone` di `Speech.speak` per sapere quando la voce
ha finito: cambia ogni chiamata a `Speech.speak` (e i test che la
guardano), e un `onDone` che non arriva lascerebbe la musica bassa;
chiedere se parla ancora si corregge da solo al giro dopo; `enableBackgroundPlayback`
del plugin: su Android aggiunge un servizio e due permessi che non
servono.

## ADR-0226 — Le notifiche push partono: Expo, un token per telefono, il permesso solo dall'interruttore
**Stato**: Attiva · 2026-10-08 · i canali, il loro ordine, Expo, Resend
e la lista di cosa si notifica sono scelte dell'utente del 2026-10-07; il
resto deciso dall'agente su delega dell'utente (TASK-262, parte A).

**Contesto**: TASK-185 (ADR-0206) ha messo in «Settings» due interruttori
che non mandavano niente. L'utente ha scelto tre parti: A le push con
`expo-notifications` e il servizio push di Expo, B l'email con Resend, C
gli amici dalla rubrica; cinque notizie, le stesse per ogni canale: una
richiesta di follow, un nuovo follower, una reazione, un commento, un tag.

**Decisione** (parte A):

1. **Il servizio push di Expo**, chiamato dall'API con `urllib` come
   Strava (`expo_push.py`): nessuna dipendenza Python nuova, nessun
   certificato Apple o chiave Firebase sul server (li tiene EAS). Niente
   token di accesso di Expo finché la «enhanced push security» è spenta.
2. **Una tabella `push_tokens`, una riga per token**, con account,
   piattaforma, lingua e data. Il token è la chiave: un telefono è
   dell'ultimo account che l'ha mandato, così chi esce e lascia il
   telefono a un altro non riceve le sue notifiche.
3. **L'invio fuori dalla richiesta, la lettura dentro**: la richiesta che
   scrive l'evento legge con una query chi avvisare (interruttore acceso,
   non chi ha agito, nessun blocco, il disegno visto) e passa a un thread
   solo la rete. Una richiesta che non avvisa nessuno non costa thread né
   rete; un errore non cambia mai la risposta. Le ricevute di Expo si
   leggono 15 minuti dopo; un token `DeviceNotRegistered` si cancella.
4. **Lo stesso evento al più una volta al giorno**, in memoria: una
   richiesta rifatta o una reazione cambiata non notificano di nuovo; ogni
   commento sì.
5. **«Un nuovo follower» è la richiesta accettata**, mandata a chi aveva
   chiesto: ogni follow passa da una richiesta (ADR-0173), e chi accetta
   lo sa già. Da confermare con l'utente insieme ai testi.
6. **La lingua delle notifiche la manda l'app con il token**: l'API non
   la sapeva (ADR-0172, la lingua sta sul telefono). Senza, inglese.
7. **Il permesso del telefono solo all'accensione di «Push
   notifications»**, mai all'avvio; negato, l'interruttore resta spento
   con «Open Settings». L'app manda il token **una volta per telefono**
   (ricorda nel portachiavi token, account e lingua), lo ritira allo
   spegnimento e all'uscita (prima di `DELETE /session`).
8. **Il tocco apre il disegno o il profilo** con le porte che `Profile`
   ha già; `open` dei disegni vuole solo l'id.
9. **I ganci** nei moduli degli eventi (`follows.py`, `reactions.py`,
   `comments.py`, `drawings.py` per i tag: il tag si scrive lì, non in
   `activities.py`) sono entrati dopo TASK-121, che tocca gli stessi file
   (condizione del coordinatore), con il controllo dei blocchi sulla sua
   tabella (`follows.apart_sql`). Un tag si notifica solo a chi è taggato
   per la prima volta in quel disegno: i taggati di prima si leggono prima
   del salvataggio.

**Alternative scartate**:

- *APNs e FCM direttamente*: certificati e chiavi da tenere sul server, e
  due protocolli; Expo li nasconde, ed EAS ha già le credenziali.
- *L'SDK Python di Expo (`exponent_server_sdk`)*: una dipendenza per due
  POST.
- *Il token legato alla sessione*: più preciso all'uscita senza rete, ma
  una migrazione su `sessions` e un'API più larga; accettato il caso raro
  (il token resta finché un altro entra o Expo lo dice morto).
- *Chiedere il permesso all'avvio*: contro la regola di TASK-185.
- *Una coda nel database per gli invii*: niente perso a un riavvio, ma
  un worker e una tabella in più per notifiche che possono perdersi.

**Conseguenze**:

- Il server va aggiornato (migrazione `push_tokens`) prima che l'app
  pubblicata mandi i token: con l'API di prima il `PUT` è `404` e l'app
  non dice niente.
- Le push si vedono solo in una **build dell'app**: Expo Go non le riceve
  dall'SDK 53.
- Il token e il testo della notifica (con l'inizio di un commento) vanno
  a Expo e da lì ad Apple o a Google: lo dice la bozza della privacy.
- Seguiti: la parte B (email, Resend, la lingua delle email), la parte C
  (rubrica), il token di accesso di Expo se si accende la «enhanced push
  security», ritentare gli invii falliti.

## ADR-0052, aggiunta — Dopo un'assenza del GPS il corridore si cerca su tutto il percorso avanti
**Stato**: Attiva · 2026-10-10 · deciso dall'agente su delega dell'utente
(TASK-270), dalla prima recensione di un tester («sono uscito
dall'applicazione, sono rientrato, però il GPS non mi è più andato
avanti»). Aggiunta ad ADR-0052, senza numero nuovo.

**Decisione**:

1. Il navigatore ricorda l'ora dell'ultima posizione. Una posizione che
   arriva 20 s o più dopo la precedente (`GAP_MS`), per un corridore già
   messo sul percorso, è un'assenza: l'app era dietro un'altra, congelata
   da iOS o chiusa, e il corridore può essere ovunque più avanti.
2. Finché non lo si rimette sul percorso, una posizione fuori dalla
   finestra di sempre (da 50 m dietro a 300 m avanti) si cerca su tutto il
   percorso avanti, con lo stesso costo: vince il passaggio più vicino
   avanti. Il punto si prende dopo 2 posizioni di fila lì (`BACK_FIXES`);
   una posizione con più di 40 m d'errore non conta.
3. Le svolte saltate non si dicono. Se si era già detto «Off the route»,
   si dice «Back on the route».
4. Senza assenza nulla cambia: oltre la finestra si è fuori percorso. Chi
   non è mai stato sul percorso (va verso la partenza) non si cerca più
   avanti, perché una forma può passare vicino alla partenza molto dopo.

**Motivo**: la finestra stretta serve contro i passaggi ripetuti di una
forma, ma senza posizioni per più di 300 m il corridore usciva dalla
finestra e restava fuori percorso fino alla fine. 20 s sono meno di
quanto serve per fare 300 m anche in bici, e più dell'intervallo fra due
posizioni in movimento (5 m): il caso di sempre resta com'era.

**Alternative scartate**: allargare la finestra sempre (una posizione
storta vicino a un passaggio successivo farebbe saltare metà forma);
cercare più avanti anche dopo un «Off the route» senza assenza (chi va
verso la partenza o sbaglia strada verrebbe spostato su un passaggio
successivo e la forma resterebbe a metà).

## ADR-0239 — «Paddle»: i posti suggeriti dalla zona di casa, calcolata sul telefono, e il filtro «Lakes» / «Sea»
**Stato**: Attiva · 2026-10-10 · richiesta dell'utente del 2026-10-09
(«consiglia alle persone i posti in base a dove vivono, o fai una sezione
filtro e decidi tu come suggerire le cose»); il disegno è **deciso
dall'agente su delega dell'utente** (TASK-269). Testi nuovi e frase della
privacy approvati dall'utente il 2026-10-10.

**Contesto**: in «Explore» con «Paddle» (ADR-0196) la fila dei posti era
quella più vicina alla partenza di «Draw», e senza partenza i quattro scelti
a mano. Con 760 punti di lago e 29 (presto 66, TASK-245 C) di mare, chi
vive a Trento e apre l'app in viaggio vedeva i posti del viaggio; e nessuno
poteva chiedere solo il mare. In «Explore» della corsa l'utente aveva
tolto i filtri (TASK-176): questa è una richiesta nuova, solo per l'acqua.

**Decisione**:
- **La zona di casa** è il centro delle partenze della zona (10 km) da cui
  partono più attività fra le 20 della prima pagina di «My activities»,
  qualunque sport; a pari merito vince la zona dell'attività più recente.
  La partenza di un'attività è il primo punto della traccia, se no del
  percorso. Il nome è il paese più frequente fra quelle attività
  (`Activity.place`, che l'API scrive già). Senza attività, la partenza da
  cui è partito «Near me».
- **Solo sul telefono**: `useActivities` la annota in
  `Documents/home-area.json` quando arriva la prima pagina, che l'app chiede
  già; nessuna richiesta nuova, niente al server, niente sull'account,
  nessun permesso, nessun indirizzo. Il file tiene solo il centro e il
  nome del paese; se ne va quando nessuno è più entrato (logout, sessione
  finita, account cancellato) e con una lista vuota. La lista
  delle attività vive in `App.tsx`, che è di altri: per questo il file e
  non una prop.
- **La fila** è in ordine di distanza dalla zona di casa, otto posti come
  prima (`SPOTS_SHOWN`), più «Show more» in fondo alla fila che scorre:
  altri otto, senza pagine nuove. Sotto la fila «Suggested near {place}»,
  «Suggested near where you usually start» (senza paese) o «Suggested near
  your start» (senza attività). «Near me» resta sulla partenza.
- **Il filtro**: «Lakes» e «Sea» a destra di «LAKES AND SEA», tre stati
  (tutti e due, solo laghi, solo mare: mai nessuno), in
  `Documents/water-filter.json`. Vale per la fila, non per «Near me» né per
  la ricerca per nome: chi scrive un nome lo vuole trovare. Il tipo viene
  dall'elenco da cui è letto il posto (`lakes.json`, `beaches.json`, e
  `kind` in `WATER_PLACES`), mai da una copia: i posti nuovi di TASK-245 C
  entrano da soli.
- **Le forme già sul telefono** (ADR-0211) partono dalla zona di casa
  quando c'è, così i posti suggeriti si aprono subito; senza, dal telefono
  come prima.

**Alternative scartate**: chiedere la città o l'indirizzo di casa (un dato
nuovo da tenere e un campo da riempire); tenere la zona sull'account (un
dato personale nuovo sul server); la posizione GPS in sottofondo (un
permesso nuovo); un riquadro di filtri come la vecchia `RouteFilters`
(l'utente non li voleva nella corsa); il filtro anche su «Near me» (un
«Near me» che salta il lago sotto casa non è più «vicino a me»).

**Conseguenza**: in viaggio la fila resta vicino a casa e «Near me» mostra
il lago del viaggio; chi non ha attività vede la fila di prima. Un seguito
possibile, fuori da questo task: la stessa zona di casa in «Explore» della
corsa.

## ADR-0120, aggiunta — Il database dei test se ne va col suo volume

**Stato**: Attiva · 2026-10-10 · deciso dall'agente su delega dell'utente
(TASK-274). Aggiunta ad ADR-0120 («Test»), senza numero nuovo.

**Decisione**: alla fine del giro `conftest.py` toglie il container di
`postgis/postgis:16-3.4` con `docker rm -f -v`: con il container va via
anche il volume anonimo di `PGDATA`. `--rm` resta per il container che si
ferma da solo, che toglie già il suo volume.

**Motivo**: `docker rm` senza `-v` lascia il volume anonimo che l'immagine
dichiara. Ogni giro ne lasciava uno: il 2026-10-10 il disco di Colima sul
Mac (20 GB) era pieno di 168 volumi (17,6 GB), PostgreSQL non partiva più
e tutti i test del database fallivano.

**Alternative scartate**: un `docker volume prune` alla fine del giro
(toglierebbe anche i volumi di altri container e di altre sessioni); un
volume `tmpfs` per `PGDATA` (cambia l'avvio e la memoria usata, per un
problema che `-v` risolve da solo).

## ADR-0228, aggiunta — Segnalare un commento e bloccare chi l'ha scritto

**Stato**: Attiva · 2026-10-11 · il sì dell'utente a segnalare i commenti
(2026-10-11, dopo la risposta di Apple alla 1.0.0); il modo deciso
dall'agente su delega dell'utente (TASK-275). Aggiunta ad ADR-0228, senza
numero nuovo.

**Contesto**: Apple ha chiesto, per la revisione, un video con i modi di
segnalare i contenuti degli utenti e di bloccare le persone (Guideline
1.2). Nella build 5 un commento non si segnalava e dal commento non si
arrivava al profilo di chi l'aveva scritto. L'API accettava già
`kind: "comment"` (punto 4 di ADR-0228) e rifiuta con 422 il proprio.

**Decisione**:

1. Tenendo premuto il commento di un altro si apre un alert nativo
   «Report or block» con «Report», «Block {user}» e, se il commento si
   può cancellare (sotto il proprio disegno), «Delete». Il proprio
   commento apre «Delete this comment?» come prima, mai «Report».
2. «Report» chiede uno dei cinque motivi e dice grazie; «Block» chiede
   prima con la frase del «…». Stesse parole di `ReportMenu.tsx`: nessun
   testo nuovo nelle cinque lingue.
3. Dopo un blocco il foglio chiede di nuovo la prima pagina dei commenti
   (l'API non dà più quelli di chi è bloccato) e `markBlocked` toglie le
   sue schede da «Feed». Un commento segnalato resta: lo guarda chi
   gestisce l'app.
4. La logica sta in un file nuovo, `social/commentChoices.ts`, con l'API e
   l'account di `FollowsContext`, che copre gli stessi schermi di
   `CommentsContext`. Senza account niente cambia.
5. Le stesse scelte sono azioni di VoiceOver, che non ha il tocco lungo.

**Alternative scartate**: il foglio del «…» (`ReportMenu`) sopra il foglio
dei commenti (un `Modal` dentro un `Modal`, da provare su un iPhone vero
prima della build per Apple; gli alert sono quelli che il foglio usa già
per cancellare); un «…» su ogni commento (più rumore in ogni riga, e
cambia il disegno della riga); aprire il profilo dal commento e segnalare
da lì (due passi in più, e la segnalazione sarebbe della persona, non del
commento).

## ADR-0240 — La corsa interrotta si riapre in pausa
**Stato**: Attiva · 2026-10-10 · scelta dell'utente del 2026-10-10,
chiesta in chat con le opzioni: **«Riapre la corsa in pausa»**; il limite
di età, il file più vecchio e le corse senza percorso sono **decisi
dall'agente su delega dell'utente** (TASK-272).

**Contesto**: la prima recensione di un tester (2026-10-10): uscito
dall'app a metà corsa, tornato ha dovuto chiuderla e riaprirla, «ma era
scomparsa»; ha calcolato un altro percorso e le due metà non combaciavano.
Il file della corsa (`current-run.json`, ADR-0091) restava, con `status:
"running"`, ma all'apertura l'app mostrava la fine della corsa senza
«Keep running»: il percorso non era più in memoria, e il file non teneva
le indicazioni, la parola né i tratti a piedi per rifarne la navigazione.
«Start» sullo stesso percorso entro 30 minuti (`RESUME_WITHIN_MS`)
continuava la traccia, ma solo ritrovando lo stesso percorso, e subito in
corsa.

**Decisione**:
- **Il file tiene quello che serve alla voce**: `directions`, `word` e
  `on_foot` del percorso, accanto a `walks`, `activity` e `rotation_deg`.
  Facoltativi e scritti solo quando il percorso li ha: il file di ogni
  altra corsa è quello di prima, e un file di prima si legge come sempre
  (riaperto, una corsa così va senza svolte dette). Campi sbagliati rendono
  il file «nessuna corsa», come gli altri.
- **All'apertura** (`interruptedRun`), una corsa che il file dà `running`,
  con almeno due posizioni e l'ultima da meno di **2 ore**
  (`REOPEN_WITHIN_MS`), apre la sua schermata in pausa: lungo il percorso
  del file con le sue indicazioni, la parola, i tratti a piedi, l'attività
  e la rotazione; o senza percorso. Il navigatore, la penna e la bici a
  mano ripassano in silenzio la traccia (TASK-253): niente conto alla
  rovescia, niente «Head out on …», la prossima svolta è quella davanti.
- **In pausa**: il tempo dall'ultima posizione è una pausa di chi corre,
  aperta (`holdTrack`), che «Resume» chiude in quel momento: il tempo con
  l'app chiusa, e quello passato in pausa dopo, non conta nella durata, e
  la prima posizione dopo non si unisce alla linea. Una pausa già aperta
  quando l'app si è chiusa continua da dove era cominciata: quella di chi
  corre resta sua, quella della penna fra due lettere resta della penna
  (la lettera dopo la chiude da sé, o «Resume»); una pausa da fermi o
  dell'app via diventa di chi corre. «Stop» tenuto chiude la corsa come
  sempre, con «Keep running», «Save» / «Discard» o «Done». Dopo la fine si
  torna alla prima schermata: la corsa riaperta non ha una scheda di
  «Explore» a cui tornare.
- **Il riconoscimento è dei controlli**: `startRun` riprende in pausa la
  corsa dello stesso percorso che il file dà `running` (l'app si è chiusa
  durante), e `controlRun` parte in pausa quando la traccia ha una pausa
  aperta. Una corsa fermata con «Stop» continua subito come prima
  («Keep running», `RESUME_WITHIN_MS`).
- **Il limite di 2 ore**: abbastanza per una corsa andata avanti senza
  l'app (una mezza maratona lenta), poco perché la corsa di ieri sera, col
  telefono scarico, si apra come una corsa in corso. L'età la giudica solo
  l'app quando si apre; `startRun` non la guarda, perché una corsa riaperta
  a un passo dal limite non diventi una corsa nuova un secondo dopo.
- **Un file più vecchio** resta com'è e l'app apre la sua fine della corsa,
  come prima: da salvare con «Save» o da lasciare con «Discard» / «Done».
  Non si butta niente da sé, e la fine della corsa non si lascia senza uno
  dei tre: non c'è modo di ripartire per sbaglio da una corsa vecchia.
- **Le corse senza percorso** si riaprono allo stesso modo, sulla loro
  schermata, in pausa: una sola regola per chi corre. Prima si apriva la
  loro fine con «Keep running» entro 30 minuti; ora quella fine resta per
  le corse fermate con «Stop» e per quelle interrotte da più di 2 ore.
- **Nessun testo nuovo**: «Paused», «Resume» e «Stop» ci sono già. Una
  riga che dica che la corsa era stata interrotta sarebbe un testo da far
  approvare in cinque lingue; non serve per capire cosa fare.

**Alternative scartate**: aprire la fine della corsa con «Keep running»
(la scelta dell'utente è la corsa in pausa); riprendere da sé, in corsa
(il tempo con l'app chiusa diventerebbe corsa, e chi ha già finito si
troverebbe in una corsa che va); salvare da sé la corsa interrotta (un
salvataggio che nessuno ha chiesto, e senza account non c'è dove); lo
stesso limite di 30 minuti di «Keep running» (chi se ne accorge a fine
corsa perderebbe il «Resume»); rifare la richiesta delle indicazioni
all'API (serve la rete, e la risposta può cambiare).

**Conseguenza**: una corsa interrotta non sparisce più e non va rifatta
da capo; dopo «Resume» il navigatore ritrova chi corre anche più avanti
sul percorso (TASK-270, ADR-0052). Il file della corsa cresce delle
indicazioni del percorso (qualche decina di kB al più).

## ADR-0241 — Una forma chiusa si comincia dove la si raggiunge
**Stato**: Attiva · 2026-10-10 · la scelta di prodotto è dell'utente
(chiesta in chat con le opzioni, TASK-273): «Automatico, dove la tocchi»;
il come deciso dall'agente su delega dell'utente. Dalla prima recensione di
un tester («ho iniziato da una parte diversa … non ci ho fatto, funziona
un po' a tentoni»).

Il navigatore (ADR-0052) aspettava il corridore al primo metro: chi
cominciava il cuore da un'altra parte restava «fuori percorso». La scelta
dell'utente: si preme «Start» dove si vuole; la corsa comincia nel punto
della forma dove la si raggiunge, fa tutto il giro e finisce quando si
torna lì; la voce dà le svolte da quel punto. Solo per le forme chiuse;
parole e forme aperte partono dalla loro partenza come prima.

**Decisione** (tecnica, dell'agente):

1. **Chiusa** (`startAnywhere.ts`): l'ultimo punto entro 25 m dal primo
   (`CLOSED_M`, quanto `ARRIVE_M`: a quella distanza il navigatore
   dice già che si è arrivati), e il percorso non è una parola (`word`) né
   in pezzi a penna alzata (`walks`). Vale anche in bici e sull'acqua.
2. **Prima dell'ingresso** «Head out on …» non si dice allo «Start». Una
   posizione si cerca su **tutta** la forma: lontano più di 40 m
   (`OFF_ROUTE_M`) da tutta la forma vale «Off the route» come per chi va
   verso la partenza.
3. **L'ingresso** dopo 3 posizioni di fila (`JOIN_FIXES`) sulla forma,
   ognuna entro 50 m lungo la forma dalla precedente, che si sono spostate
   di almeno 20 m lungo la forma (`JOIN_M`). Una posizione storta vicino a
   un passaggio lontano, o una vecchia che il telefono dà per prima (dove
   si è disegnato il percorso), resta sola; attraversare la forma di
   traverso non la percorre. Una posizione con più di 40 m d'errore non
   conta né azzera. La serie parte su **ogni passaggio** vicino alla prima
   posizione (una forma ripassa la stessa via, ADR-0039): vince quello che
   il corridore percorre nel verso del percorso. Il punto d'ingresso è la
   prima posizione della serie.
4. **Il giro**: il percorso del navigatore diventa la stessa forma dal
   punto d'ingresso a sé stesso (`joinRoute`, con la forma due volte di
   fila per passare la partenza in tutti e due i versi); le indicazioni
   restano quelle del motore con le distanze da lì. Un ingresso entro 25 m
   dalla partenza (`AT_START_M`) è la partenza: il percorso resta com'è.
5. **L'incrocio della vecchia partenza**, dove il motore non dice niente
   (è l'ultimo nodo), riceve la svolta ricavata sul telefono come la
   ricava il motore (`directions.py`): direzione d'arrivo e di partenza a
   20 m, le stesse soglie (30°, 135°, 165°), solo a un incrocio
   (`branches` ≥ 3 della partenza) e solo se si gira o si cambia via. La
   via è quella della partenza.
6. **All'ingresso** la voce dice «Head out on …» con la via su cui si è
   (quella dell'ultima indicazione prima del punto), dopo «Back on the
   route» se si era detto «Off the route»; poi le svolte come sempre.
   **Nessun testo nuovo.** L'arrivo (`ARRIVE_M`, `ARRIVE_FIXES`) è al
   punto d'ingresso.
7. **La direzione resta quella del percorso**: chi entra e va nel verso
   opposto sente «Head out on …» e poco dopo «Off the route», come chi
   oggi parte dalla partenza al contrario.
8. **Mappa, bici a mano, corsa ripresa**: la parte corsa (TASK-224) si
   taglia sulla linea del navigatore, che parte dal punto d'ingresso; i
   tratti con la bici a mano (TASK-206) si ruotano con il percorso (uno a
   cavallo del punto in due) e prima dell'ingresso non si dicono; una corsa
   ripresa (TASK-253) ripassa le posizioni della traccia e rientra nello
   stesso punto, senza campi nuovi nel file della corsa. La traccia, i
   chilometri, il file e la corsa salvata non cambiano: la linea corsa fa
   tutto il giro, quindi tutta la forma.

**Motivo**: la forma è un disegno chiuso, e da dove si comincia non cambia
il disegno. Più posizioni di fila che si muovono lungo la forma sono la
prova che il corridore la sta correndo, non solo che le è passato vicino;
la svolta della vecchia partenza serve perché, ruotato, quell'incrocio
cade in mezzo al giro.

**Alternative scartate**: la prima posizione vicina alla forma (una sola
storta, o quella vecchia di dove si è disegnato, sceglierebbe l'ingresso);
il punto più vicino senza guardare il verso (sulle vie ripassate, metà
delle volte il passaggio sbagliato e «Off the route»); dire «Head out» allo
«Start» con la via della partenza (sbagliata per chi è altrove); seguire la
forma al contrario per chi va nell'altro verso (svolte e sensi unici
cambiano, i tratti a mano in bici valgono in un verso: sarebbe una scelta
di prodotto); un campo nuovo nel file della corsa per il punto d'ingresso
(le stesse posizioni lo ritrovano).

**Conseguenza**: anche chi parte dalla partenza di una forma chiusa sente
«Head out on …» dopo una ventina di metri sulla forma, non allo «Start».
Il segnaposto della partenza resta dove il percorso è stato disegnato.
Una corsa riaperta con l'app (TASK-272, ADR-0240) passa per lo stesso
`useNavigation`, quindi per la stessa scelta (`startsAnywhere`):
`reopenedRoute` passa ora sempre la parola del file, anche senza
camminate, perché una parola riaperta non diventi una forma chiusa. Se il motore
cambierà le indicazioni ai vicoli ciechi (TASK-271), la svolta alla vecchia
partenza segue ancora la regola degli incroci di `directions.py`.

## ADR-0243 — Le foto dei paesi vicini: l'immagine di Wikidata, tenuta sul nostro server
**Stato**: Attiva · 2026-10-11 · le scelte di prodotto sono dell'utente
(chieste in chat con le opzioni, TASK-283): «Solo foto», «Scheda di oggi»
per un paese senza foto, «Piccolo sulla foto» per il credito; il come
deciso dall'agente su delega dell'utente. Dalla richiesta «Aggiungere foto
delle città» con lo screenshot di «NEARBY TOWNS» intorno a Moreda de Álava
(schede vuote mentre il cuore si disegnava).

Le schede di «NEARBY TOWNS» (TASK-236, ADR-0200) mostravano un campione
disegnato sulla mappa del paese, vuote finché il server non lo aveva
disegnato. L'utente vuole le foto dei paesi: al posto di mappa e disegno.

**Decisione** (tecnica, dell'agente):

1. **La fonte**: l'elemento Wikidata del posto, che Geoapify dà già con
   il posto (`wiki_and_media.wikidata` o `datasource.raw.wikidata`), e la
   sua immagine (P18, la preferita, mai una deprecata), un file di
   Wikimedia Commons. Intorno a Moreda 19 posti su 22 ne hanno una.
2. **La licenza**: tenute solo le foto che chiunque può usare, CC BY, CC
   BY-SA, CC0, pubblico dominio (`License` di Commons: `cc-by-*`, `cc0`,
   `pd*`); GFDL da sola, Free Art e il resto no. Il credito è quello che
   la licenza chiede: «© autore · licenza» (l'autore da `Artist`, senza
   HTML, al più 60 caratteri), «Wikimedia Commons · licenza» senza
   autore; nessuno quando `AttributionRequired` è falso, CC0 o pubblico
   dominio. La licenza è sempre in fondo, e l'app accorcia l'autore, mai
   lei.
3. **Sul nostro server**: l'API scarica la miniatura di Commons larga 500
   pixel, la risalva JPEG senza i metadati del file (EXIF compresi) e la
   dà da `GET /city-photos/{item}.jpg`. Il telefono non chiede mai niente
   a Wikimedia: nessun servizio nuovo nell'informativa privacy. A
   Wikidata e Commons vanno solo l'elemento e il nome del file, con uno
   User-Agent che dice chi siamo (lo chiede Wikimedia), mai la posizione.
   Cosa si sa di un elemento è tenuto in `city_photos/` della cartella
   della cache, accanto alle zone, e richiesto di nuovo dopo 30 giorni;
   se la foto cambia, la vecchia va via.
4. **I tempi**: un elemento chiede a Wikidata `wbgetclaims` (piccolo; il
   `wbgetentities` di sei città pesava 340 kB e 15 s), i sei in parallelo,
   poi una sola richiesta a Commons per tutti i file: 1–3 s misurati. La
   risposta di `/nearby-cities` aspetta al più 2 s; quello che arriva dopo
   resta per la richiesta successiva. Le foto trovate si scaricano subito
   dopo, prima che il telefono le chieda. Se Wikimedia non risponde,
   niente foto e nessuna richiesta per 10 minuti; un elemento senza
   risposta resta da chiedere.
5. **L'app**: una scheda con la foto mostra solo la foto e il credito; un
   paese senza foto, o la cui foto non si carica (`onError`), ha la scheda
   di prima. I campioni si disegnano lo stesso per tutti, come prima: il
   paese si apre con le forme pronte. Un'API senza il campo `photo` dà le
   schede di prima: app e server possono arrivare in qualsiasi ordine.
   L'`url` della foto deve essere un percorso dell'API (`/…`): mai un
   altro host con la chiave dell'API nell'intestazione.

**Motivo**: Wikidata è la fonte libera che copre anche i paesini
(OpenStreetMap la nomina già), e Commons dice di ogni file licenza e
autore. Tenere le foto sul server costa poco (~60 kB l'una) e lascia la
privacy com'è.

**Alternative scartate**: `wbgetentities` (troppo grande e lento), lo
SPARQL di Wikidata (una richiesta sola ma 1,2 s e a volte sovraccarico);
far caricare le foto al telefono da Wikimedia (un servizio nuovo che vede
chi guarda, da scrivere nell'informativa); Google Places Photos o Unsplash
(a pagamento o con chiave, e poco per i paesini); una foto per i paesi
senza (un'immagine generica dice meno della mappa col disegno, che l'utente
ha scelto di tenere).

**Conseguenza**: la cartella `city_photos/` cresce di un file JSON per
elemento e di una JPEG per foto vista: con mille paesi, circa 60 MB. Una
foto di Commons può mostrare un monumento invece del paese (Laguardia: un
dolmen); la sceglie chi cura Wikidata.

## ADR-0144, aggiunta — Le parole di una città, dopo le sue forme

**Stato**: Attiva · 2026-10-13 · **scelte dell'utente** il cosa (il
2026-10-11 «prima parole, poi frasi»; il 2026-10-13 le sei parole e la
distanza minima di ognuna); il come deciso dall'agente su delega
dell'utente (TASK-279 parte A). Aggiunta ad ADR-0144, senza numero nuovo.

**Contesto**: in «Explore» una città scelta disegna otto forme da 5 km dal
centro, una alla volta (ADR-0144). L'utente vuole anche parole con la penna
alzata (ADR-0157). L'API tiene già ogni percorso chiesto da un centro,
parole comprese (ADR-0136): basta l'app. Il task diceva «5 km come le
forme», ma il contratto vuole almeno `LETTER_DISTANCE_M` (3 km) per
lettera: a 5 km l'API rifiuta ogni parola (`check_word`).

**Decisione**:
- **Sei parole**, scelte dall'utente: CIAO, LOVE, AMORE, RUN, HELLO, MUW
  (`EXAMPLE_WORDS` in `exampleRoutes.ts`), lettere tonde, `pen_up: true`.
  **Ognuna alla distanza minima** (scelta dell'utente): 3 km a lettera,
  come «Use 12 km» in «Draw». RUN e MUW 9 km, CIAO e LOVE 12, AMORE e
  HELLO 15.
- **Dopo le otto forme**, nello stesso giro e con le stesse regole delle
  forme in più: una alla volta, dentro `EXAMPLES_PER_MINUTE`, una scheda
  solo quando tocca a lei, nessuna scheda né messaggio per una che non
  riesce. `shape_not_drawable` la lascia fuori finché l'app resta aperta;
  un guaio che non è della parola (rete, troppe richieste) ferma in
  silenzio anche le parole, che si richiedono alla prossima scelta della
  città. Sull'acqua niente parole.
- **La più lunga per prima** (`wordOrder`): AMORE, HELLO, CIAO, LOVE, RUN,
  MUW. Ogni lettera ha la stessa distanza, quindi una parola più lunga va
  più lontano dal centro e la zona che l'API scarica per lei contiene
  quelle delle più corte, come il cerchio fra le forme. Le schede restano
  nell'ordine dell'utente.
- **Una lista accanto alle forme**, non dentro: `Example` ha `shape`, e lo
  leggono anche «Paddle», «WhileDrawing» e le schede degli esempi.
  `WordExample` ha `word` e gli stessi stati; il giro chiede le forme e
  poi le parole con la stessa funzione (`Ask`). Gli id sono
  `example:word:CIAO:<chiave>`.
- **Nello stesso file degli esempi**, con le forme della città: una parola
  tenuta a un'altra distanza o senza `walks` si ridisegna. Un'app più
  vecchia legge il file come prima (cerca le forme per `shape`).
- **Anche una città con percorsi consigliati** riceve le parole, meno
  quelle che ha già fra i suoi percorsi (`wordsOf`, nel catalogo c'è un
  CIAO); la riga sta sotto le sue schede, con il nome della città del
  catalogo.
- **La riga**: «WORDS», schede come «NEARBY TOWNS» (42% della pagina), la
  parola e i km, la città, la somiglianza, la mappa; i tratti a piedi non
  si disegnano (`gaps`). Il credito delle mappe sotto la riga solo se
  sopra non c'è. Aperta, la scheda del percorso dice anche «6.0 km of
  letters + 0.4 km walking between them», come «Draw» (`PenSplit`, ora
  esportato da `RoutePanel.tsx`), solo per le parole.

**Motivo**: le parole sono richieste uguali per tutti i telefoni, che
l'API tiene; seguire le regole delle forme in più non tocca il limite
dell'API (ADR-0076) né i primi tre esempi, che non aspettano mai.

**Alternative scartate**: le parole a 5 km (rifiutate dal contratto); tutte
a 15 km (scartata dall'utente); un `Example` con `shape` o `word` (cambia
i file di «Paddle» e degli esempi); una seconda coda di richieste per le
parole (due giri insieme supererebbero il limite al minuto); farle
disegnare prima dal server con `draw_examples` (TASK-279 punto 7, dopo
l'approvazione di Apple e con l'ok dell'utente).

**Conseguenza**: il primo telefono in una città aspetta, dopo le forme,
30–50 s per parola sul server (15 km); gli altri le ricevono subito. Fra
due città sfogliate in un minuto le parole della seconda aspettano il
minuto dopo. Una città senza zona sul server può scaricarne una più
grande per la parola più lunga.

## ADR-0245 — «Draw on the map»: la figura sulla mappa la misura l'app, il percorso lo fa il motore
**Stato**: Attiva · 2026-10-13 · le scelte di prodotto sono dell'utente:
una schermata sola con «Draw | Move», una riga di forme e immagini che
cambia la figura dove sta, la figura trascinata col dito, e «in due
passi» (il motore può spostare la figura; il posto esatto è TASK-282),
il 2026-10-11; il tasto «Draw on the map» sotto «Shape | Word | Image» e
i sei testi nuovi nelle cinque lingue, il 2026-10-13. Il come è deciso
dall'agente su delega dell'utente (TASK-281).

**Decisione** (tecnica, dell'agente):

1. **La stessa mappa, una schermata nuova** (`screen: "canvas"` in
   `App.tsx`): la WebView di MapLibre resta una sola, come per il
   percorso. In alto «←» e il luogo cercato in «Draw» (la posizione del
   GPS non ha un nome nell'app); sotto la mappa il pannello
   `src/mapdraw/DrawOnMap.tsx`. Con «Paddle» il tasto non c'è: sull'acqua
   la forma si sposta già (ADR-0202).
2. **I gesti sono della pagina della mappa.** Sulla tela la pagina spegne
   i gesti di MapLibre (`dragPan`, `touchZoomRotate`, `doubleClickZoom`,
   `dragRotate`, `touchPitch`) e li fa da sé, come il trascinamento di
   ADR-0202: con «Draw» un dito disegna una linea gialla e la mappa sta
   ferma, due dita non fanno niente; con «Move» un dito che parte sulla
   figura (il suo riquadro sullo schermo, più 24 px) la trascina, altrove
   sposta la mappa; due dita col punto di mezzo sulla figura la
   ingrandiscono o rimpiccioliscono dal suo centro, altrove fanno lo zoom
   della mappa. Un dito ferma la mappa che si sta ancora muovendo (nel
   simulatore una linea disegnata durante l'inquadratura veniva storta).
   Una figura cresciuta oltre lo schermo fa allontanare la mappa, così
   resta posto per lo zoom fuori dalla figura. Uscendo, i gesti di
   MapLibre tornano com'erano. Messaggi nuovi in `messages.ts`:
   `setCanvas`/`clearCanvas` verso la pagina; `drawn` (la linea, in
   lat/lon), `figure` (il centro nuovo e il fattore; `done: false` mentre
   due dita la ridimensionano, per la distanza che segue) e `centre` (il
   centro della mappa) verso l'app.
3. **La figura nell'app** (`figure.ts`): la figura nella sua cornice, con
   x a destra e y in alto, più il centro sulla mappa e i metri di
   un'unità. La distanza è la lunghezza nella cornice per i metri
   dell'unità; la lunghezza è quella su cui il motore scala (§3): il
   perimetro della linea a 64 punti per una forma, `drawn_length` con la
   penna alzata, e per un disegno o una foto il contorno più i dettagli
   andata e ritorno (un anello una volta). I conti sono sul piano
   tangente, in metri, con la proiezione del motore (`plane.ts`).
4. **Le forme del catalogo le dà il motore**: `tools/catalogue_shapes.py`
   scrive `src/mapdraw/catalogueShapes.json` (le linee, la lunghezza e la
   partenza di ogni forma, con la penna giù e, se ha pezzi, alzata), come
   lo scrive Prettier (`as_prettier` di ADR-0246).
   `tools/test_catalogue_shapes.py` fallisce quando il motore cambia una
   forma: chi cambia il motore lo rigenera.
5. **La linea a dito** (`drawing.ts`): la prima diventa il contorno,
   semplificata all'1% (Douglas–Peucker, al più 100 angoli) e chiusa
   dall'app: una fine entro il 5% dall'inizio finisce lì. Se si incrocia,
   resta l'anello più grande chiuso dove si incrocia (una linea che passa
   oltre l'inizio, un otto), o si accorcia la coda; se così si perde più
   del 40% del disegno, «This line crosses itself…» e niente cambia. Le
   linee dopo sono **dettagli appesi**, come «Add a detail» (ADR-0074),
   ma calcolati dall'app: dal punto più vicino della figura, col capo
   più vicino, agganciati entro il 6% o con un trattino dritto; un capo
   che torna entro il 3% su un suo punto chiude un anello. Oltre
   `MAX_DETAIL_POINTS` il testo già approvato «That is too much for one
   route…». Una linea su una forma o su una foto ne prende il posto.
6. **Il contratto non cambia**: una forma va a `POST /route-jobs` con
   `shape` (e la penna alzata come la chiede «Draw», `shapeAsked`), un
   disegno o una foto a `POST /image-route-jobs` col contorno ricentrato
   e portato in [-1, 1] insieme ai dettagli (`strokes`). `start` è il
   primo punto della figura sulla mappa (la fase 0); `distance_m` la sua
   distanza al decimo di km o di miglio, come una distanza scritta in
   «Draw» (il risultato dice «target 5.7 km»), dentro i limiti di «Draw»
   per lo sport. Il motore cerca come sempre (fasi, rotazioni, partenze
   vicine e lontane).
7. **La riga delle tessere**: «+ photo» per prima (una foto della libreria,
   tracciata dal motore con un `useImageOutline` suo), poi le 17 forme e
   le 12 sagome di ADR-0246, col loro contorno già nell'app. La prima
   figura va nel centro della mappa, lunga quanto la distanza di «Draw»,
   e la mappa si inquadra su di lei; una tessera dopo la cambia dov'è,
   grande uguale sulla mappa (la distanza cambia con la forma). Dopo una
   tessera l'interruttore passa a «Move», che è la cosa da fare dopo.
8. **«Undo»** toglie l'ultima figura messa o disegnata (torna quella di
   prima, dov'era), l'ultimo cambio di tessera (torna la forma di prima,
   dove sta ora) o l'ultimo dettaglio. Spostare e ridimensionare non si
   annullano.
9. **Il risultato è quello di «Draw»**: lo stesso `useRouteRequest`, e
   `fromCanvas` dice che la richiesta è della figura. «←» e «Cancel»
   tornano alla figura com'era; «Try 8 km» porta la figura a quella
   grandezza e la richiede. Le richieste della stessa figura, spostata o
   ridimensionata, hanno gli stessi array del contorno, così l'app
   riconosce il risultato e non lo chiede due volte.

**Motivo**: la richiesta dell'utente in due passi si fa senza toccare
contratto, API e motore: la figura sulla mappa diventa le richieste che
esistono, con la grandezza disegnata e la partenza dove la figura
comincia. I gesti nella pagina sono la sola parte che sa dove sta la
figura sullo schermo; la geometria nell'app si prova coi test.

**Alternative scartate**: una seconda WebView solo per la tela (il doppio
della memoria di MapLibre, che iOS chiude quando manca); tenere i gesti di
MapLibre con delle eccezioni (dalla pagina non si sceglie chi riceve il
dito per primo); mandare ogni tratto a `POST /image-outline-edits`
(vuole un contorno di una foto, e una chiamata per tratto); `near` su
strada (rifiutato dal motore, ADR-0202 punto 4: è TASK-282).

**Conseguenza**: la figura non è ancora il percorso. Provato nel
simulatore a Trento: la stella da 5,7 km messa a nord del centro è venuta
5,4 km, 1–2 km più in là, con «Start here». Il dito vero sull'iPhone
resta da provare. Una figura grande quanto lo schermo prende tutte le due
dita: per lo zoom della mappa serve il margine fuori dalla figura, ed è
per questo che la mappa si allontana quando la figura cresce oltre.

**Aggiunta del 2026-10-16 (TASK-286, un'altra figura dalla mappa del
risultato)**: la scelta di prodotto è dell'utente del 2026-10-15 («sì, dai
la possibilità di cambiare figura dalla mappa», poi «SI»); il come è
deciso dall'agente su delega dell'utente, con l'ok del Coordinatore ai
file.

10. **Una riga sola** (`src/mapdraw/FigureTiles.tsx`): le tessere della
    tela (punto 7) diventano un componente, usato da `DrawOnMap.tsx` con
    «+ photo» davanti e dal pannello del risultato senza. Le stesse
    tessere per costruzione, nessun testo nuovo (VoiceOver legge i nomi
    già tradotti delle forme e delle immagini).
11. **Sopra «Start»**: `RouteOutcome` riceve la riga come `figures` e la
    mette, a percorso arrivato, dopo «A · B · C», «Try 8 km» e gli avvisi:
    prima cos'è il percorso, poi un'altra figura, poi le cose da fare;
    «Start» resta in basso dov'era. Con «Paddle» solo le forme (in «Draw»
    sull'acqua le immagini non si disegnano). Non sotto un errore: lì ci
    sono già le vie d'uscita di TASK-031.
12. **Da «Draw» la tessera diventa la scelta di «Draw»** (`App.tsx`,
    `onChangeFigure`): una forma mette «Shape» e il suo nome nel campo,
    un'immagine «Image» con `image.show` come «PICTURES»; la richiesta
    (`changedRequest` in `resultFigure.ts`) tiene partenza, distanza e
    sport del percorso sullo schermo, la penna alzata come `shapeAsked`,
    gli stessi array del contorno dell'immagine e, sull'acqua, il `near`
    di una forma spostata (ADR-0202). Così la richiesta che «Draw»
    ricalcola al render dopo è uguale per `sameRequest`: il risultato
    resta sullo schermo, «←» torna a «Draw» con la scelta nuova e «Draw
    route» non lo chiede due volte. Scartato: chiedere il percorso con un
    effetto quando la richiesta di «Draw» cambia (un giro in più, e un
    effetto che disegna da sé).
13. **Da «Draw on the map» la figura nuova prende il posto di quella sulla
    tela** (`changeTo` di `useMapCanvas`): stesso centro, **la distanza
    della richiesta sullo schermo** e non la grandezza (sulla tela una
    tessera tiene la grandezza perché si guarda la figura; qui si guarda
    un percorso di quei km), dentro i limiti come ogni figura. È un passo
    «put» di «Undo»: tornati sulla tela, «Undo» rimette la figura di
    prima com'era. La partenza è quella della figura nuova (punto 6).
14. **La tessera segnata** è letta dalla richiesta per «Draw» (la forma,
    o l'immagine pronta il cui contorno la richiesta manda tale e quale:
    un contorno ritoccato con «Edit the outline» non è più lei) e dalla
    figura per la tela; toccarla non chiede niente.

## ADR-0246 — Sotto «Draw» i giri a tema e dodici sagome pronte, col contorno già nell'app
**Stato**: Attiva · 2026-10-13 · le scelte di prodotto sono dell'utente
(chieste in chat con le opzioni, TASK-280): le dodici sagome col razzo al
posto del Colosseo, i quattro giri, «near your start» al posto del nome
della città; il come deciso dall'agente su delega dell'utente. Dalla
richiesta del 2026-10-11 «Sotto draw nella sezione draw inserisci i tour
delle città o immagini varie» (scelta «Tour e immagini»).

**Decisione** (tecnica, dell'agente):

1. **Due righe nuove in un file nuovo**, `src/route/DrawIdeas.tsx`, messe
   da `App.tsx` sotto `RouteChoice` dentro la pagina che scorre:
   `ChooseScreen.tsx` non cambia. Nessuna con «Paddle».
2. **I giri sono quelli di «Explore»** (ADR-0099), senza niente di nuovo
   sul server: `useThemedRoute.ask` con la categoria da sola, `centre` la
   partenza di «Draw» e `city` nullo, come «Near me» in «Explore». La mappa
   e la scheda (ThemedCard) sono le stesse; `routeList` ricorda «Draw»
   (`"choose"`), così «←» e «Back to Draw» tornano lì.
3. **Il nome della città non c'è**: con la partenza dal GPS l'app non lo
   sa e nessuna API lo dice (`/nearby-cities` esclude il paese entro
   1,5 km, ADR-0200; il nome di una corsa lo cerca solo il server per le
   attività). Le tessere dicono «near your start», o «near {posto}» per un
   luogo cercato, testi già tradotti (scelta dell'utente). Un indirizzo
   nuovo per il nome sarebbe lavoro di server, fuori da un task solo app.
4. **Le sagome le disegna uno strumento**, `tools/sample_pictures.py`, con
   Pillow da cerchi, linee e poligoni: dodici PNG 640 × 640 (il lato che
   il motore analizza, `ANALYSIS_SIDE`), figura scura su fondo chiaro,
   12–27 kB l'una, in `assets/pictures/`. Nessuna immagine d'altri, nessuna
   licenza, nessuna dipendenza nuova (Pillow è già del motore).
5. **Il contorno lo calcola il motore una volta**, con lo stesso
   `outline_data` di `POST /image-outlines`, girato nella risposta
   dell'API come fa `images.trace` (senza importare l'API, così lo
   strumento gira col solo motore, come il job «Tools» della CI), e sta in
   `src/route/samplePictures.json`: 17–46 angoli, un soggetto ciascuna.
   L'app lo mostra subito, senza aspettare il tracciato (meno di 2 s, ma
   con la rete) e senza mandare l'immagine. «Draw route» manda quel
   contorno a `POST /image-route-jobs`, che lo ricontrolla come ogni
   contorno che arriva dal telefono (ADR-0069).
6. **`useImageOutline.show(picture, outline)`**: mette la sagoma come una
   foto già tracciata, toglie le modifiche e lascia perdere un tracciato
   in corso. Il `Picture` di una sagoma è fatto una volta
   (`Image.resolveAssetSource`) e si riconosce perché è lo stesso oggetto:
   così la tessera scelta ha il bordo chiaro, e una foto scelta dopo no.
7. **I test di `tools/`** controllano che i PNG dell'app siano quelli
   disegnati, che il contorno nel JSON sia quello che il motore traccia dai
   PNG (entro 0,02 nel quadrato [-1, 1]: un'altra versione di shapely può
   spostare un angolo) e che il JSON sia scritto come lo scrive Prettier.

**Motivo**: le due cose esistevano già, giri a tema e immagini; qui si
riusano dove l'utente le vuole, senza toccare server, motore e schermate
degli altri task. Il contorno nell'app toglie l'unica attesa di una
sagoma.

**Alternative scartate**: tracciare la sagoma con `POST /image-outlines` a
ogni tocco (attesa e immagine mandata per niente); disegnare le sagome a
mano in un programma di grafica (non si rifanno uguali, e lo strumento le
prova); il Colosseo (del contorno esterno resterebbe un blocco largo col
bordo rotto, scelta dell'utente); «CITY TOURS · {città}» solo con un luogo
cercato (la riga mancherebbe nel caso più comune, il GPS).

**Conseguenza**: quindici file nuovi nell'app, oltre ai test, con circa 220 kB di PNG. Una
sagoma nuova è una funzione in `tools/sample_pictures.py`, un nome in
`samplePictures.ts` e le sue traduzioni. Un giro chiesto con «Bike» è
quello di «Explore», a piedi, come in «Explore».

**Aggiunta del 2026-10-16 (TASK-290, le sagome che vengono bene in
città)**: richiesta dell'utente («le hai provate nelle varie città? …
aggiungine altre che vengono bene e togli quelle più brutte»); quali
tenere, togliere e aggiungere lo ha deciso l'agente su delega dell'utente,
guardando i percorsi; i nomi nuovi li approva l'utente.

8. **Una sagoma si sceglie dal percorso, non dal disegno.** Ogni sagoma è
   stata pianificata come `POST /image-route-jobs` (lo stesso
   `plan_request` dell'API, con le partenze vicine) in otto città con
   strade diverse, Trento, Milano, Roma, Parigi, Barcellona, Londra,
   Chicago e Torino, a 5 e a 10 km, sulle zone del server copiate in
   locale. Si è guardato il disegno dei percorsi: la somiglianza del
   motore (`similarity`) non distingue, è sopra 0,9 anche per un percorso
   che non si riconosce.
9. **Cosa viene bene**: il motore segue solo il contorno esterno, e a
   5 km una parte stretta diventa una strada sola. Vengono le sagome
   riconoscibili dal contorno, con due o tre parti larghe: dinosauro,
   Torre Eiffel, aereo, chitarra, palloncino e, nuove, fungo, auto,
   maglietta, paperella, stivale, casa, osso, coppa. Razzo, scarpa da
   corsa e foglia vengono a 10 km, meno a 5: restano, in fondo alla riga.
   **Tolte** bici (il contorno è quello delle due ruote insieme), cuore con
   freccia (la freccia sparisce, e il cuore c'è già tra le forme), ancora
   (un groviglio fuori da Barcellona e Chicago) e gelato (le palline e il
   cono diventano un ovale). Provate e **scartate** anche balena, veliero,
   castello, orsetto, elefante, mano, robot, tartaruga, pinguino, pupazzo
   di neve, cactus, corona, pollice in su, guanto, fulmine, freccia, nota,
   tazza, campana, diamante e fetta di pizza: dettagli persi, o percorsi
   che si leggono solo in qualche città.
10. **Sedici, le più chiare prima**: la riga di «Draw» e quella di
    `FigureTiles` (ADR-0245) ne hanno sedici invece di dodici. Nessun
    doppione delle forme di `SHAPES`.

## ADR-0247 — A fine corsa l'app ricorda lo stretching, con «Skip»
**Stato**: Attiva · 2026-10-13 · chiesto dall'utente («Finito
l'esercizio, puoi dire all'inizio "ricordati di fare stretching" e dai la
possibilità di skipparlo»); il come deciso dall'agente su delega
dell'utente. TASK-285 in due parti: A il bivio (questa voce), B gli
esercizi animati (sessione «Animazione esercizi stretching post-corsa»).

«Stop» tenuto premuto, o «Finish» all'arrivo, apriva subito «Your run»:
nessuno ricordava lo stretching.

**Decisione** (tecnica, dell'agente):

1. **Un bivio prima di «Your run»**: con una traccia da mostrare, al posto
   della scheda di fine corsa compare «Remember to stretch» con due
   pulsanti, «Skip» e «Stretch» (`src/screens/StretchReminder.tsx`).
   «Skip» mostra la scheda di oggi, intatta («Keep running», «Save» e
   «Discard», «Done»). «Stretch» apre gli esercizi della parte B; finché
   la parte B non è in `main`, chiude la scheda come «Skip». Nessun colore
   nuovo e niente giallo: il giallo resta del percorso (ADR-0183), e
   nessuno dei due pulsanti è «quello giusto».
2. **La voce la dice una volta**, all'apertura della scheda, nella lingua e
   con la voce scelte per la corsa (ADR-0171): la frase sta nel frasario
   della voce (`stretch` in `src/voice/*.ts`), non nei testi dell'app,
   come ogni altra cosa detta. Con «Voice» spento non si sente niente.
   Mentre la scheda è sullo schermo l'app tiene il suono della corsa
   (`startRunAudio`/`endRunAudio` di TASK-261 B): la frase passa sopra
   l'interruttore silenzioso e abbassa la musica come le altre; alla
   chiusura della scheda il suono torna com'è fuori da una corsa.
3. **Quando si chiede**: ogni volta che una corsa finisce dalle sue mani
   (`onEndRun`, `onStopFreeRun`), con o senza percorso; mai per uno «Stop»
   prima della prima posizione (torna alla prima schermata) né per la
   corsa riaperta dopo due ore (TASK-272, ADR-0240), che non è appena
   finita. «Keep running» e poi un nuovo «Stop» lo chiedono di nuovo: è
   una nuova fine.
4. **Nessuna memoria della scelta**: il promemoria torna a ogni corsa; un
   «non chiedermelo più» non è stato chiesto.

**Motivo**: lo stretching va fatto subito dopo la corsa, quando la
schermata di fine è la prima cosa che si vede; chi non vuole ha «Skip» a
un tocco, senza niente da leggere prima di salvare.

**Alternative scartate**: una riga nella scheda «Your run» invece del
bivio (si perde fra «Save» e «Discard»); dirlo solo con la voce (chi corre
con la voce spenta non lo saprebbe); un promemoria anche prima del conto
alla rovescia (non chiesto).

**Conseguenza**: la fine della corsa ha un tocco in più per chi non fa
stretching. Lo screenshot della fine corsa nei materiali per lo store
mostra «Your run» dopo «Skip».

**Aggiunta del 2026-10-14, parte B (sessione «Animazione esercizi
stretching post-corsa»; chiesto dall'utente il 2026-10-13: «Dopo la
corsa, metti l'animazione di cinque esercizi di stretching come sull'app
bEND»; il come deciso dall'agente su delega dell'utente):

5. **Cinque esercizi in una schermata sola** (`src/stretch/StretchScreen.tsx`,
   un `Modal` a tutto schermo sopra «Your run», montato da `App.tsx` da
   `onStretch` della scheda): i classici del dopo corsa, quadricipite,
   posteriore della coscia, polpaccio, flessori dell'anca, gluteo, 20 s
   per lato, 3 min 20 s in tutto (`exercises.ts`: nomi, righe e tempi
   sono dati, facili da cambiare con le scelte dell'utente). Il tempo lo
   tiene un `setInterval` di un secondo che porta avanti da sé il proprio
   passo in un ref: sotto jest due tick possono scattare prima di un
   render, e il secondo deve contare dal primo.
6. **La figura senza dipendenze nuove** (`Figure.tsx`, `poses.ts`): una
   persona vista di lato fatta di dodici segmenti, ognuno una View a
   dimensione zero sul suo snodo, girata del suo angolo, che contiene la
   barra e i segmenti che le pendono: un arto non cambia mai lunghezza
   mentre gira. Una posa è l'angolo assoluto di ogni segmento (0 in giù,
   90 avanti, 180 su); il passaggio da una posa all'altra è un solo
   `Animated.timing` di 0,8 s, ogni snodo per la via più corta; il bacino
   sale e scende con la posa (`grounding`: il punto più basso tocca il
   pavimento). I test controllano la geometria pura: le pose stanno in
   piedi, la testa sopra il bacino, il ginocchio a terra nell'affondo.
   Scartati: Lottie e `react-native-svg` (dipendenze nuove, come per
   ADR-0147), disegni PNG per posa (niente movimento fra le pose), una
   WebView (parte tardi).
7. **Il suono** fra un lato e l'altro e fra due esercizi è un «ding» di
   0,35 s nostro, scritto da `tools/stretch_chime.py` con la sola
   libreria standard (`assets/stretch/ding.wav`), suonato con
   `expo-audio` (già in app per la voce in sottofondo) e mai bloccante:
   senza suono si va avanti lo stesso. Scartato per ora dire a voce il
   nome dell'esercizio seguente: vorrebbe il frasario nelle cinque
   lingue; resta una scelta dell'utente.
8. **Nessun consiglio di salute** oltre «Stop if it hurts.», e nessun
   materiale di bEND: figure, animazioni, nomi e testi sono nostri.

## ADR-0248 — Una sola coda per le richieste di percorso dell'app, e un annullo vero sul telefono
**Stato**: Attiva · 2026-10-16 · deciso dall'agente su delega
dell'utente, dall'analisi della lentezza della ricerca (sessione «MUW app
performance e ricerca»). TASK-287, solo app. Non tocca ADR-0177: il
telefono prima fino a 8 km a piedi resta com'è.

Tre parti dell'app chiedevano percorsi in sottofondo, ognuna col suo
contatore: gli esempi della città scelta (18 al minuto, le prime forme
fuori conto), i campioni dei paesi vicini (uno ogni 5 s, 12 al minuto),
le forme sull'acqua dei posti vicini (uno ogni 6 s, 10 al minuto).
Insieme superavano i 30 POST al minuto che l'API prende da un telefono
(ADR-0076), e il «Draw» dell'utente poteva prendere un 429. Il motore sul
telefono, annullato, finiva lo stesso il percorso (fino a 120 s) e il
«Draw» dopo aspettava dietro.

**Decisione** (tecnica, dell'agente):

1. **Una coda sola** (`src/api/routeQueue.ts`) con tre livelli: le
   richieste dell'utente («Draw», spostare la forma di un esempio, il
   percorso a tema) partono sempre e subito; poi gli esempi sulla pagina
   di «Explore» (della città scelta e dei paesi vicini, `visible`); poi
   ciò che si disegna in anticipo (le forme sull'acqua, `prefetch`).
   Mentre gira una richiesta dell'utente nessuna in sottofondo parte;
   quelle già partite finiscono. Un solo conto delle richieste
   dell'ultimo minuto, quelle dell'utente comprese: gli esempi della
   pagina partono finché sono meno di 22, l'anticipo finché sono meno di
   10. All'utente restano sempre almeno 8 dei 30 («Start», «Export GPX»,
   una reazione). Dopo un 429, qualunque, niente in sottofondo per un
   minuto. Spariscono le pause fisse fra un campione e l'altro: il passo
   lo dà la coda.
2. **Le prime forme di una città possono aspettare**: prima non
   aspettavano mai. Succede solo se nell'ultimo minuto sono già partite
   22 richieste (tre città con tutti gli esempi già pronti sul server);
   la scheda mostra «Drawing…» finché tocca a lei.
3. **Annullare sul telefono**: una richiesta annullata in coda esce dalla
   coda e non arriva alla pagina. Quella che Python sta calcolando non si
   può fermare con un messaggio: Python gira sull'unico thread della
   pagina, e un messaggio aspetta che abbia finito. Interromperlo da fuori
   vorrebbe un `SharedArrayBuffer` (Pyodide in un worker), che la WebView
   di iOS dà solo a una pagina isolata con intestazioni che una pagina
   letta da file non ha. Quindi la pagina si butta e se ne avvia subito
   una nuova: qualche secondo di avvio di Python invece di un percorso
   che nessuno aspetta, e il «Draw» dopo non aspetta il vecchio. Non conta
   come una morte della WebView (ADR-0177).
4. **Python parte prima**: appena una zona salvata copre la posizione,
   prima ancora di aggiornare le zone; senza zone salvate, con la prima
   scaricata e non dopo tutte e due le reti.
5. **Explore riusa ciò che ha**: il centro e il nome delle città in
   evidenza stanno in `engine/ahead.json` (accanto ai centri, i nomi:
   un file di prima li chiede una volta in più a `GET /cities`), e il chip
   apre la città senza chiederla; un campione di un paese vicino diventa
   un esempio pronto del paese, intero, e toccare il paese non lo chiede
   più (solo in memoria: il file resta delle città scelte);
   `city-examples.json` si scrive una volta per gruppo (prime forme,
   altre forme, parole) o quando un'altra città ferma quella in corso, e
   si legge una volta sola.
6. **Piccole cose**: `useRouteRequest` non crea uno stato nuovo se la
   fase dell'API è la stessa; dopo un `/places` lento o fallito si va su
   Photon per 3 minuti invece di aspettare 2,5 s a ogni lettera.

**Alternative scartate**: interrompere gli esempi già partiti quando
l'utente chiede un percorso (il lavoro del server andrebbe perso, e
quasi sempre sono percorsi tenuti, che rispondono subito); lasciare
finire il calcolo annullato e far partire la pagina nuova solo se arriva
un altro «Draw» (si pagherebbe l'avvio proprio quando l'utente aspetta);
la gara fra telefono e server (scelta di prodotto, fuori da qui).

**Conseguenza**: chi sfoglia molte città in un minuto vede le schede
arrivare un po' più piano, ma il suo «Draw» non prende più un 429 per
colpa degli esempi. Un «Draw» annullato sul telefono costa un nuovo
avvio di Python (~5 s sul Mac, da misurare sull'iPhone).

## ADR-0249 — Le ricerche dell'API più veloci: gzip, Geoapify in parallelo, indici e anteprime nel database
**Stato**: Attiva · 2026-10-16 · deciso dall'agente su delega
dell'utente (TASK-288, dall'analisi delle ricerche della sessione «MUW
app performance e ricerca»). Nessuna scelta di prodotto: le risposte sono
le stesse, arrivano prima. Nessuna dipendenza nuova.

Le ricerche diverse dal percorso aspettavano cose evitabili, misurate in
locale (`tasks/TASK-288.md`): `/feed` con la posizione del telefono
calcolava la distanza geodetica dalla traccia intera di ogni disegno
(15 s a pagina con 1 500 disegni da 2 000 punti, nell'immagine PostGIS
emulata del Mac); `/cities` chiedeva a Geoapify un'area dopo l'altra (sei
richieste in fila, fino a 8 s l'una); `/users?q=` leggeva ogni account e
rifaceva la foto piccola di ognuno a ogni lettera; ogni richiesta con un
token scriveva l'ultimo uso della sessione, anche una GET.

**Decisione** (tecnica, dell'agente):

1. **gzip nell'API** (`app.py`): `GZipMiddleware` di Starlette da 1 KB in
   su, livello 6 (il 9 di Starlette costa cinque volte tanto per un feed
   meno dell'1% più piccolo). Sta **dentro** `protect` (aggiunto prima):
   il middleware di `protect` manda le risposte a pezzi, e a pezzi gzip
   le comprimerebbe tutte, anche le più piccole. JPEG e i `.gz` delle
   zone restano come sono (esclusi da Starlette). Il Caddy del server
   (`/etc/caddy/Caddyfile`, `DEPLOY.md` F.14) non ha `encode` per l'API,
   solo per il sito (letto sul server dal Coordinatore il 2026-10-16): il
   telefono riceveva tutto in chiaro.
2. **Geoapify** (`places.py`): `fetch_json` aspetta 3 s invece di 8 e
   chiede **una seconda volta** su timeout, connessione caduta, 429 (dopo
   1 s: il piano gratuito regge 5 richieste al secondo) e 5xx (dopo
   0,5 s); mai su 4xx, che risponderebbe uguale. Logga il codice o il tipo
   d'errore, mai l'URL, che contiene la chiave. `fetch_together` chiede più
   URL insieme, ognuno con la sua risposta o il suo errore. `/cities` chiede
   i Places delle aree tutti insieme (al più 4 alla volta, con la
   geocodifica 5): un'area che non risponde resta al punto della
   geocodifica, le altre vanno al loro paese (prima, dopo un errore, le
   aree seguenti non si chiedevano più). Una risposta senza città non si
   tiene 24 ore: la ricerca seguente chiede di nuovo. `/nearby-cities`
   chiede insieme le tre categorie; la quarta (i paesi fino a 50 km) resta
   dopo, solo quando serve.
3. **`draw_examples`** distingue un 5xx della ricerca città da «non
   trovata»: lo richiede tre volte, 10 s l'una dall'altra, e se non
   risponde scrive «the city search did not answer (http_503)».
4. **Le foto delle città** (`city_photos.py`): due pool di thread, uno per
   chiedere Wikimedia (che una lista aspetta) e uno per scaricare le
   immagini (che nessuno aspetta); prima, due download lenti tenevano
   fuori la ricerca della lista seguente.
5. **«Find friends»** (migrazione 0022): `pg_trgm` e un indice GIN su
   `lower(username) gin_trgm_ops`, che risponde a `LIKE '%q%'` da tre
   lettere in su (con due il piano resta la lettura di tutti). La foto
   piccola (128 px) di una lista si fa una volta per ogni foto
   (`follows.SmallPhotos`, 2 000 tenute in memoria, le ultime usate), con
   chiave un'impronta BLAKE2 dei byte della foto: una foto nuova è
   un'impronta nuova, e la vecchia non si vede mai. Scartata la colonna
   della foto piccola nel database: vuole un'immagine fatta da Python per
   le righe già lì.
6. **L'anteprima del disegno nel database** (migrazione 0022): la funzione
   SQL `drawing_preview(track)` sceglie i punti che sceglie
   `recommended.preview` (64, per indice, primo e ultimo; lo stesso
   arrotondamento `rint` di Python), e la colonna generata
   `drawings.preview` la tiene aggiornata da sé a ogni scrittura della
   traccia, anche per i disegni già lì. Il feed e i disegni di un profilo
   leggono quella invece della traccia intera: stesso `track_preview`,
   controllato da un test per molte lunghezze. Il feed chiede
   all'anteprima se un disegno è vicino (entro 50 km): 64 punti invece di
   migliaia, con un errore di poche centinaia di metri al bordo dei 50 km.
   Da 23 s a 0,8 s per 1 500 disegni; `/feed` con la posizione da 15 s a
   0,75 s a pagina, in locale. La funzione ha `search_path`
   scritto: un ripristino di `pg_dump` la chiama con uno vuoto. Più un
   indice parziale `drawings (published_at DESC, id DESC) WHERE visibility
   <> 'only_me'`, che il feed può usare (la condizione è ripetuta nella
   query); con l'ordine per gruppo (i propri, i seguiti, gli altri) oggi
   PostgreSQL ordina comunque in memoria.
7. **L'ultimo uso della sessione** (`accounts.user_of`) si scrive solo
   quando quello scritto ha un'ora (`USE_WRITTEN_EVERY`): le altre
   richieste leggono e basta, senza attendere il disco. Perché i 90 giorni
   non si accorcino, una sessione vale 90 giorni **e un'ora** dall'ultimo
   uso scritto: mai meno di 90 dall'ultimo vero. L'email di chi non apre
   l'app da 14 giorni (TASK-284) legge lo stesso `last_used_at`: un'ora di
   ritardo non cambia niente.

**Alternative scartate**: un pool di connessioni (`psycopg_pool`,
dipendenza nuova: va chiesto all'utente; oggi ogni chiamata apre una
connessione, due per richiesta con un token, 40–70 ms in locale); `encode
gzip` nel Caddy del server (lavoro sul server, e l'API resterebbe senza
gzip dove gira senza Caddy); `ST_Simplify` al posto dei 64 punti
(cambierebbe il disegno che si vede); un indice spaziale per «vicino»
(la condizione sta in un OR col gruppo del disegno, e l'indice non si
userebbe); riscrivere il feed in tre query unite (rischio alto per un
guadagno che oggi, con pochi disegni, non si vede).

**Conseguenze**: la migrazione 0022 va sul server con l'aggiornamento
(numero al merge: se entra prima #502, che ha la sua 0022, questa diventa
0023); crea `pg_trgm` (l'utente del database è il proprietario, ed è
un'estensione «trusted»). Chi cambia il modo in cui `preview` sceglie i
punti cambia anche `drawing_preview`, con una migrazione nuova: il test
dell'anteprima lo ricorda.

**Aggiunta del 2026-10-16 (TASK-288 parte B, il pool di connessioni)**:
l'alternativa scartata sopra è presa. L'utente l'ha approvata scrivendo al
Coordinatore: «sì, aggiungi il pool di connessioni». Le scelte tecniche
sono dell'agente su delega dell'utente, con le condizioni e l'ok del
Coordinatore; numeri e ragionamento in `tasks/TASK-288.md`, «Parte B».

1. **`psycopg_pool`** (`psycopg[binary,pool]`, il pool ufficiale di
   psycopg 3), dipendenza nuova. `Database.pooled()` apre il pool,
   `Database.connect()` presta una connessione con lo stesso contratto di
   prima (un blocco, una transazione); senza pool apre la sua, come
   prima. L'API lo apre dopo le migrazioni.
2. **2–10 connessioni, 10 s di attesa**, `max_idle` 10 min, `max_lifetime`
   1 h: un processo, 40 thread, 4 vCPU divise col motore (oltre ~9 query
   insieme PostgreSQL fa solo la fila), ~100 MB al più, un decimo di
   `max_connections`. `draw_examples` passa dall'API in HTTP: anche con
   lui PostgreSQL resta sotto 20 connessioni su 100.
3. **Una sessione nuova a ogni prestito**: `DISCARD ALL` alla
   riconsegna, dopo il commit o il rollback del blocco (il pool annulla
   una transazione lasciata aperta). Per questo **niente prepared
   statement** (`prepare_threshold=None`): dopo un secondo `DISCARD ALL`
   psycopg userebbe istruzioni che PostgreSQL ha già tolto.
4. **Controllo al prestito** (una query vuota): una connessione chiusa da
   un riavvio di PostgreSQL si sostituisce senza far fallire la richiesta.
5. **Un blocco dentro un altro nello stesso thread** (`strava.py`: la
   corsa bloccata mentre si legge il token) apre una connessione sua,
   fuori dal pool, come prima: dal pool, dieci invii insieme si
   aspetterebbero a vicenda fino all'errore.
6. **Tutte occupate per 10 s**: `503 accounts_unavailable` con
   `Retry-After: 10` e una riga WARNING, non un 500 né un'attesa senza
   fine. Codice che l'app conosce già: mostra il suo testo tradotto.
7. **Chiusura** nel `lifespan` dell'app, prima che uvicorn restituisca il
   SIGTERM, e nel `finally` di `main` se l'app non è partita.

**Alternative scartate**: aprire il pool nel `lifespan` (chi non usa il
`lifespan`, come i test con un uvicorn finto, non avrebbe connessioni; e
l'API deve fermarsi subito se il database non risponde); tenere i prepared
statement e togliere a mano solo SET e tabelle temporanee (`RESET ALL`,
`DISCARD TEMP`, …: più comandi da tenere allineati a PostgreSQL, per un
guadagno che con una o due esecuzioni per query non c'è); un codice
d'errore nuovo per «occupato» (cambierebbe il contratto e l'app);
riscrivere `strava.py` perché non apra un blocco dentro l'altro (il lock
sulla corsa serve davvero: è un altro task, se mai); un pool asincrono
(gli endpoint sono sincroni).

**Conseguenze**: sul server serve un'immagine nuova (la dipendenza si
installa da `pyproject.toml`, il `Dockerfile` non cambia); nessuna
migrazione. Un codice nuovo che apre un blocco dentro un altro funziona
come prima, ma paga la connessione nuova: meglio non farlo.

## ADR-0250 — Una riga di tempi per ogni job di percorso, e il bytecode nell'immagine
**Stato**: Attiva · 2026-10-16 · deciso dall'agente su delega dell'utente
(TASK-289; prepara la misura di TASK-276, dove l'utente ha scelto il
2026-10-11 di misurare prima di decidere)

**Contesto**: sul server un cuore da 5 km a Trento risponde in 9–18 s,
sul Mac in meno di 2 (TASK-276). Il log del job diceva solo il tempo
totale. Il motore misura i secondi di ogni partenza (`Tried.seconds`), ma
non li scrive. Ogni processo `spawn` delle partenze vicine importa il
motore: nell'immagine Docker non c'è bytecode (`.dockerignore` toglie
`__pycache__`), e l'API gira con `PYTHONDONTWRITEBYTECODE` e un utente
che non può scrivere accanto ai sorgenti. Quindi ogni processo ricompila
il motore, a ogni percorso.

**Decisione** (tecnica, dell'agente):

1. **Una riga per job** in `jobs.py`, dopo quella di fine, anche per i
   job falliti e per quelli lasciati: `job <id>: times total=… crop=…
   loads=… download=… start=… traces=… converged=… far=… wait=… nearby=…
   chosen=… directions=…`. Sono coppie `chiave=valore` con i secondi a
   due decimali e `-` per ciò che il job non sa, così la misura di
   TASK-276 le legge con `grep` e `awk`. Le chiavi sono spiegate in
   `shaperoute_api/job_times.py`. Ci sono solo secondi e conteggi, nessuna
   posizione (ADR-0092).
2. **Tutto si misura dall'API, il motore non si tocca.** Il ritaglio si
   misura in `_Reporting.load`, contando anche un download fallito. Le
   indicazioni si misurano intorno a `with_choices`, il planner intorno a
   sé stesso. Il piano dalla partenza con le sue tracce e la convergenza,
   e i secondi di ogni partenza vicina, vengono dal `NearbyPlan`:
   `images.plan_request` lo passa al source del job (`job_times.noted`,
   protocollo `NotesNearby`, come `KnowsDownloads` e `KnowsNames`) e poi
   restituisce il piano come prima. `wait` è il tempo del planner meno il
   primo ritaglio e il piano dalla partenza: grafo in pickle e processi
   avviati prima, attesa e arresto dopo, scelta fra i piani.
3. **Il bytecode nell'immagine**: `RUN python -m compileall -q` sui tre
   pacchetti, dopo la copia dei sorgenti e prima di `USER`. L'impronta del
   motore legge solo `.py` e `.json` (`route_store.engine_fingerprint`):
   i percorsi già tenuti restano validi, e un test lo controlla.

**Motivo**: la scelta di TASK-276 (pool di processi, meno partenze vicine
quando il server è carico, server più grande) dipende da quale fase pesa.
Una riga per job, con le stesse chiavi, si legge su ore di traffico vero
e non solo nei 10 minuti della misura.

**Alternative scartate**:

- Due campi di tempo in `NearbyPlan`, per separare esattamente la
  preparazione dall'attesa: cambiano l'impronta del motore, e gli esempi
  tenuti sul server andrebbero rifatti (Coordinatore, 2026-10-16). Si
  potranno aggiungere con i prossimi cambi del motore, dopo Apple.
- Una riga per fase: le righe di job diversi si mescolano, perché i job
  girano su due thread (ADR-0032).
- Un `ContextVar` al posto del source per passare il `NearbyPlan`: è un
  canale nascosto; il source è già l'oggetto che il job dà al planner.
- `--invalidation-mode unchecked-hash`: risparmia solo uno `stat` per
  modulo, e un sorgente cambiato a mano nel container userebbe il
  bytecode vecchio.

**Conseguenza**: il log dell'API ha una riga in più per percorso. `wait`
mette insieme la preparazione e l'attesa delle partenze vicine. Sul
server il bytecode arriva solo con un'immagine nuova (dopo Apple e con
l'ok dell'utente). `engine.zip` è rifatto, perché `jobs.py` e `images.py`
sono nel motore del telefono.

## ADR-0251 — Ogni segnalazione arriva per email, con un link firmato che nasconde
**Stato**: Attiva · 2026-10-17 · **scelta dell'utente** del 2026-10-17
(«SI FAI IL TASK DELLE SEGNALAZIONI»: email a ogni segnalazione e un link
per nascondere); le tre note del Coordinatore (segreti solo in
`deploy/.env`; link che scade, vale una volta e si annulla; privacy con la
parte B di TASK-284); il resto deciso dall'agente su delega dell'utente
(TASK-291). Rimanda ad ADR-0228, che resta valida.

**Contesto**: ADR-0228 lascia le segnalazioni nel database, senza pannello.
Il 2026-10-17 Apple ha aggiornato la regola 1.2: chi non mette tutele o non
rimedia ai contenuti segnalati dopo un avviso viola il Developer Code of
Conduct. La risposta ad Apple promette di guardare le segnalazioni entro 24
ore, ma nessuno sa quando ne arriva una.

**Decisione**:

1. **Un'email per ogni segnalazione nuova**, in inglese, a
   `SHAPEROUTE_REPORTS_TO`, con Resend, fuori dalla richiesta (un thread,
   come le push di ADR-0226). Nuova vuol dire una riga nuova di `reports`
   (`xmax = 0`): la stessa persona che cambia il motivo non manda niente.
   Dice cosa, perché, chi segnala, chi ha scritto, il testo, quante
   segnalazioni ha la cosa e se è già nascosta. Un errore di Resend non
   cambia la risposta di `POST /reports`.
2. **Il link è firmato** (HMAC-SHA256 con `SHAPEROUTE_EMAIL_SECRET`, lo
   stesso dell'email di ritorno con un prefisso diverso) e porta azione,
   tipo, id, scadenza a **7 giorni** e un numero a caso. **GET mostra e
   chiede, POST fa**: un lettore di posta che apre i link per controllarli
   non nasconde niente. **Una volta sola**: il numero entra in
   `report_links_used` nella stessa transazione dell'azione. Dopo «Hide»
   la pagina ha «Undo», un link nuovo `show` con le stesse regole.
3. **Nascondere, mai cancellare**: `hidden_at` su `drawings`, `comments`
   e `users`. Nascosto agli altri, **non all'autore**, che non si accorge
   di niente.
   - Disegno: dentro `drawing_seen_sql` e `shown_sql`, le due domande che
     tutti i lettori di un disegno fanno già (ADR-0228).
   - Commento: dentro `comments.NOT_APART`.
   - Iscritto: dentro `follows.apart_sql`, che vale anche quando `other`
     è nascosto e non è chi guarda. Così un iscritto nascosto sparisce
     come dietro un blocco da ogni posto che ADR-0228 ha già coperto
     (profilo, ricerca, feed, disegni, commenti, reazioni, follow), senza
     toccarli uno per uno. Le push guardano dal lato di chi le riceve
     (`push.blocked_between` chiede se chi agisce è lontano da chi riceve):
     un nascosto non fa arrivare notifiche agli altri.
4. **Spento** senza `RESEND_API_KEY`, `SHAPEROUTE_EMAIL_SECRET`,
   `SHAPEROUTE_DOMAIN` e `SHAPEROUTE_REPORTS_TO`: le segnalazioni restano
   come in ADR-0228. Indirizzo, chiave e token mai nei log.
5. **Un modulo minimo per l'invio** (`send_email.py`): la #502 (TASK-284)
   porta `resend_email.py`; dopo il suo merge `send_email` lo usa e
   l'invio resta uno solo (indicazione del Coordinatore).

**Alternative scartate**: cancellare il commento segnalato (non si
annulla, nota 2 del Coordinatore); rendere il disegno «only_me» (si
perderebbe la visibilità di prima, e l'autore vedrebbe il cambio); un
pannello o un endpoint `/admin` (più grande, e vuole un login per chi
gestisce); un link che agisce già al GET (i filtri antispam delle caselle
di posta aprono i link).

**Conseguenze**: `apart_sql` fa una sottoquery in più su `users` per la
chiave primaria; trascurabile. Chi aggiunge una lettura di disegni o
commenti deve passare da queste condizioni, come già per i blocchi.
L'email porta a Resend (Stati Uniti) il contenuto segnalato e i nomi: la
privacy lo dirà con la parte B di TASK-284, con il sì dell'utente sul
testo, prima di accendere l'email sul server.
