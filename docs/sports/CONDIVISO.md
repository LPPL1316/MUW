# Sport — quello che si è scoperto, per tutti

Lo tiene solo il Coordinatore Sport (ADR-0320). Ogni voce ha la data, chi
l'ha scoperta e dove sono i dettagli. Prima di cominciare uno sport si legge
tutto: è corto apposta.

## Le reti

- **2026-11-04, TASK-372 — le piste da fondo di OSM non bastano per le
  forme.** `piste:type=nordic` più le relazioni `route=piste`, 20 × 20 km
  attorno a Fiemme (Lago di Tesero), Asiago, Dobbiaco: 81–178 km di pista,
  ma 0 forme buone su 45 (al massimo 0,81, cerchio mai sopra 0,49). Le piste
  seguono la valle e hanno pochi incroci vicini. Lo sci di fondo è
  «Record only». Una zona di sola rete nordic pesa 0,2–0,4 MB.
  `tasks/TASK-372.md`.
- **2026-11-04, TASK-373 — piste da discesa e impianti: nessuna forma.**
  Paganella, Campiglio, Sella Ronda: 19 richieste, somiglianza 0,22–0,58,
  27–43% del percorso sugli impianti. Lo sci alpino è «Record only».
  `tasks/TASK-373.md`.
- **Rete foot** (corsa, camminata): il filtro `walk` di OSMnx senza
  l'esclusione delle ciclabili (ADR-0022); i marciapiedi disegnati a parte
  restano fuori e servono solo a dare i nomi (ADR-0054).
- **Rete bike**: strade e ciclabili, sensi unici rispettati, i tratti a
  piedi con la bici a 6 volte il costo (ADR-0153, ADR-0167). Una zona bike
  per 30 km è circa 26 × 26 km: una sola in memoria sul server.

## Le quote (dislivello)

- **La fonte già usata**: le Terrain Tiles di AWS (codifica «terrarium»),
  gratuite e senza chiave, per le colline della mappa 3D dell'app
  (`apps/mobile/src/map/mapKindStyle.ts`, TASK-351) e per lo studio dello
  sci alpino (`out/TASK-373/dem` sul Mac, zoom 13). **Prima di aggiungere
  un'altra fonte, si usa questa.**
- **ADR-0300, parte G di TASK-347** ha già deciso dislivello e profilo dal
  server, da queste tegole (circa 30 m), in cache sul Volume, con
  `RouteResult.elevation` e `POST /elevations` opzionali, senza quote
  offline. Non è ancora codice. Il calcolo del dislivello va fatto **una
  volta sola**, in un modulo condiviso: la prima sessione sport che ne ha
  bisogno (escursionismo probabilmente) si accorda con TASK-347 G tramite il
  Coordinatore, invece di farne uno suo.

## Il motore

- **L'impronta del motore** è l'hash di ogni `.py` e `.json` di
  `route_engine/` (`route_store.engine_fingerprint`): anche un file nuovo la
  cambia, e con lei tutti gli esempi (8–16 ore di `draw_examples`) e
  l'archivio. Un file che non disegna percorsi tenuti si può tenere fuori
  (come `ANCHORED_ONLY`, `DRAWN_WATER_ONLY`). ADR-0320, punto 3.
- Un grafo di rete sbagliata viene rifiutato (`network.check_network`):
  una rete nuova ha il suo nome nel grafo (`graph.graph["network"]`).

## Il banco e Overpass

- **2026-11-04, TASK-376 — Overpass rifiuta spesso** (502 «pieno», 429
  «troppe richieste», timeout). Il banco riprova solo gli errori di rete,
  dopo 60, 120 e 240 s, e se la zona non arriva la lascia fuori dicendolo.
  Sull'acqua il motore scarica l'acqua dentro il calcolo di ogni percorso:
  il banco la scarica **una volta per zona**, prima dei percorsi. Un primo
  giro che riprovava subito ha preso una serie di 429 ed è stato fermato:
  dopo un 429, almeno 10 minuti di pausa.
- I tempi del banco sono del solo motore, con la zona già in cache: corsa
  0,6 s di mediana, bici 1,6 s (Milano fino a 12,7 s a 30 km), canoa sotto
  0,3 s. Servono a confrontare prima e dopo, non a promettere tempi.

## Le misure

Le misure di base di corsa, bici e canoa stanno in `run.md`, `bike.md`,
`paddle.md`.
