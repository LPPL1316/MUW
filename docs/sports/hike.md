# Escursionismo («Hike», da decidere)

Attività `hiking` (TASK-377, ADR-0321 proposto), il pilota della struttura
degli sport (TASK-376). Nome, emoji, distanze, rete e testi sono scelte
dell'utente: qui ci sono le misure che le preparano.

## Le due reti provate (TASK-377 parte 0, 2026-11-05)

Banco `tools/sport_bench/` sul Mac, `main` `95c46c3f`, `nice -n 10`, un
comando per volta. Le reti non sono nel motore: le dà `--loader
out/TASK-377/loader.py`. Le richieste sono di corsa (`--activity running`),
perché il motore non conosce ancora `hiking`. Cache in `out/TASK-377/cache`,
JSON in `out/sport-bench/hike-*`. Cerchio, cuore e stella a 5, 10 e 20 km.
Il tempo è quello del motore, col grafo già in cache.

- **`trails`**: solo le vie di un'escursione (`highway` path, footway,
  track, bridleway, steps, pedestrian).
- **`outdoor`**: la rete foot della corsa senza le strade delle auto
  (trunk, primary, secondary, tertiary).
- **Tutte e due** si fermano a `sac_scale` T3, «demanding mountain
  hiking»: i percorsi alpinistici restano fuori.

**In breve:**

- **`trails` non regge.** A Trento il pezzo che tocca la partenza è di 88
  km, quasi tutto marciapiede di città, con 3 forme su 9. Non l'ho portata
  sulle altre zone.
- **`outdoor` dà 46 percorsi su 54** (21 buoni), somiglianza mediana 0,87.
  Città e pianura riescono tutte. In montagna riescono 6–7 su 9:
  - Valsugana 6, Fiemme 6, Asiago 7;
  - il cerchio è la forma più difficile, come per la corsa;
  - i tre cerchi da 20 km che non riescono ci mettono 72–102 s a dirlo.
- **Lontano dalle città** la rete `outdoor` è soprattutto `track` e `path`:
  a Fiemme 706 km su 898.

### Rete `outdoor`

| Zona | km di rete | pezzi | pezzo più grande | incroci | vicoli ciechi |
|---|---|---|---|---|---|
| trento | 2419,3 | 1 | 2419,3 km | 17228 | 7574 |
| valsugana | 1461,1 | 1 | 1461,1 km | 5398 | 2624 |
| fiemme | 898,2 | 1 | 898,2 km | 1964 | 903 |
| asiago | 630,2 | 1 | 630,2 km | 1323 | 551 |
| milano | 6746,8 | 1 | 6746,8 km | 93232 | 16834 |
| pianura | 1003,6 | 1 | 1003,6 km | 6515 | 1995 |

- trento, km per `highway`: track 667,1, path 479,4, service 344,8, footway 321,1, unclassified 304,5, residential 203,3, cycleway 81,8, pedestrian 13,5, steps 2,8, living_street 0,8, busway 0,2, bridleway 0,1
- valsugana, km per `highway`: track 511,6, path 379,9, unclassified 236,9, residential 181,1, service 81,7, footway 51,0, cycleway 13,8, pedestrian 3,2, steps 1,6, living_street 0,2, bridleway 0,1
- fiemme, km per `highway`: track 465,8, path 239,7, unclassified 76,3, residential 42,6, service 25,5, footway 22,4, cycleway 22,3, steps 2,3, pedestrian 0,6, living_street 0,5
- asiago, km per `highway`: track 284,4, path 178,4, unclassified 76,6, residential 63,9, service 15,1, footway 5,8, cycleway 4,0, pedestrian 1,4, steps 0,4, road 0,1
- milano, km per `highway`: footway 3588,2, residential 1297,4, service 841,7, unclassified 322,9, cycleway 306,5, path 144,2, track 94,8, pedestrian 92,1, steps 54,3, living_street 2,4, corridor 1,2, busway 0,9, demolished 0,2, bus_stop 0,1, elevator 0,0
- pianura, km per `highway`: residential 337,0, unclassified 187,1, service 140,0, track 115,0, footway 82,8, cycleway 80,2, path 53,0, pedestrian 6,5, steps 1,6, living_street 0,4

L'area è quella dei percorsi da 20 km: i km non si confrontano con quelli
di `run.md`, misurati per i 10 km.

### Forme con `outdoor`

| Zona | chiesti | riusciti (≥ 0,60) | buoni (≥ 0,90) | somiglianza mediana | tempo mediano | tempo massimo |
|---|---|---|---|---|---|---|
| trento | 9 | 9 | 7 | 0,91 | 2,0 s | 3,6 s |
| valsugana | 9 | 6 | 0 | 0,77 | 1,3 s | 74,3 s |
| fiemme | 9 | 6 | 0 | 0,79 | 1,1 s | 102,1 s |
| asiago | 9 | 7 | 1 | 0,74 | 0,5 s | 71,6 s |
| milano | 9 | 9 | 9 | 0,99 | 4,2 s | 7,0 s |
| pianura | 9 | 9 | 4 | 0,87 | 0,9 s | 1,7 s |
| tutte | 54 | 46 | 21 | 0,87 | 1,3 s | 102,1 s |

### Percorsi con `outdoor`

| Zona | forma | km chiesti | km reali | somiglianza | tempo | esito |
|---|---|---|---|---|---|---|
| trento | circle | 5 | 5,1 | 0,96 | 0,7 s | buono |
| trento | circle | 10 | 8,9 | 0,84 | 2,0 s | riuscito |
| trento | circle | 20 | 19,2 | 0,91 | 2,5 s | buono |
| trento | heart | 5 | 5,1 | 0,91 | 0,9 s | buono |
| trento | heart | 10 | 9,9 | 0,86 | 2,2 s | riuscito |
| trento | heart | 20 | 19,9 | 0,91 | 3,6 s | buono |
| trento | star | 5 | 4,8 | 0,98 | 0,6 s | buono |
| trento | star | 10 | 10,4 | 0,93 | 1,0 s | buono |
| trento | star | 20 | 19,0 | 0,99 | 2,1 s | buono |
| valsugana | circle | 5 | 4,2 | 0,65 | 0,6 s | riuscito |
| valsugana | circle | 10 | — | — | 1,8 s | ShapeNotDrawableError |
| valsugana | circle | 20 | — | — | 74,3 s | ShapeNotDrawableError |
| valsugana | heart | 5 | 4,8 | 0,73 | 0,6 s | riuscito |
| valsugana | heart | 10 | — | — | 1,3 s | ShapeNotDrawableError |
| valsugana | heart | 20 | 21,8 | 0,72 | 1,3 s | riuscito |
| valsugana | star | 5 | 5,4 | 0,80 | 0,6 s | riuscito |
| valsugana | star | 10 | 9,0 | 0,83 | 0,7 s | riuscito |
| valsugana | star | 20 | 20,4 | 0,85 | 2,2 s | riuscito |
| fiemme | circle | 5 | — | — | 1,5 s | ShapeNotDrawableError |
| fiemme | circle | 10 | — | — | 1,7 s | ShapeNotDrawableError |
| fiemme | circle | 20 | — | — | 102,1 s | ShapeNotDrawableError |
| fiemme | heart | 5 | 3,7 | 0,84 | 0,5 s | riuscito |
| fiemme | heart | 10 | 11,3 | 0,73 | 1,1 s | riuscito |
| fiemme | heart | 20 | 18,5 | 0,69 | 1,3 s | riuscito |
| fiemme | star | 5 | 4,8 | 0,86 | 0,5 s | riuscito |
| fiemme | star | 10 | 9,6 | 0,89 | 0,7 s | riuscito |
| fiemme | star | 20 | 21,3 | 0,75 | 0,7 s | riuscito |
| asiago | circle | 5 | — | — | 1,3 s | ShapeNotDrawableError |
| asiago | circle | 10 | 9,3 | 0,63 | 1,4 s | riuscito |
| asiago | circle | 20 | — | — | 71,6 s | ShapeNotDrawableError |
| asiago | heart | 5 | 3,8 | 0,74 | 0,4 s | riuscito |
| asiago | heart | 10 | 10,3 | 0,61 | 0,5 s | riuscito |
| asiago | heart | 20 | 18,2 | 0,67 | 1,5 s | riuscito |
| asiago | star | 5 | 4,7 | 0,87 | 0,4 s | riuscito |
| asiago | star | 10 | 11,1 | 0,74 | 0,5 s | riuscito |
| asiago | star | 20 | 21,9 | 0,92 | 0,4 s | buono |
| milano | circle | 5 | 4,9 | 0,90 | 2,6 s | buono |
| milano | circle | 10 | 9,6 | 1,00 | 4,4 s | buono |
| milano | circle | 20 | 21,1 | 0,97 | 6,7 s | buono |
| milano | heart | 5 | 4,7 | 0,95 | 2,6 s | buono |
| milano | heart | 10 | 9,6 | 0,99 | 4,2 s | buono |
| milano | heart | 20 | 21,7 | 0,97 | 7,0 s | buono |
| milano | star | 5 | 4,9 | 0,99 | 2,3 s | buono |
| milano | star | 10 | 10,1 | 0,99 | 4,0 s | buono |
| milano | star | 20 | 19,8 | 1,00 | 5,7 s | buono |
| pianura | circle | 5 | 5,4 | 0,87 | 0,7 s | riuscito |
| pianura | circle | 10 | 9,4 | 0,80 | 0,9 s | riuscito |
| pianura | circle | 20 | 19,2 | 0,63 | 1,4 s | riuscito |
| pianura | heart | 5 | 5,4 | 0,91 | 0,5 s | buono |
| pianura | heart | 10 | 8,3 | 0,96 | 1,0 s | buono |
| pianura | heart | 20 | 19,9 | 0,67 | 1,7 s | riuscito |
| pianura | star | 5 | 4,0 | 0,94 | 0,6 s | buono |
| pianura | star | 10 | 9,2 | 0,93 | 0,4 s | buono |
| pianura | star | 20 | 19,8 | 0,86 | 1,5 s | riuscito |

### `trails` a Trento

| Zona | km di rete | pezzi | pezzo più grande | incroci | vicoli ciechi |
|---|---|---|---|---|---|
| trento | 88,5 | 1 | 88,5 km | 1110 | 551 |

- trento, km per `highway`: footway 68,0, path 11,8, pedestrian 5,6, track 2,6, steps 0,5

Forme: 9 chieste, 3 riuscite, nessuna buona; somiglianza mediana 0,78,
tempo massimo 104,2 s (il cerchio da 20 km).

## Cosa resta da misurare

- **Quanto di ogni percorso sta su `track` e `path`**: il banco oggi misura
  la rete, non il percorso. Si misura con la parte A, sul motore vero.
- **Il dislivello dei percorsi** (`CONDIVISO.md`, «Le quote»).
