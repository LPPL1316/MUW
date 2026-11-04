# Bici («Bike»)

Attività `cycling`. Rete bike, sensi unici rispettati, tratti a piedi con la bici a 6 volte il costo (TASK-190, ADR-0153, ADR-0167), 10–30 km. Una zona per 30 km è circa 26 × 26 km.

## Misure di base (TASK-376, 2026-11-04)

Stesse condizioni di `run.md` (banco sul Mac, `main` `ea42f1c0`, zone in
cache, `--label base-2026-11`; JSON in
`out/TASK-376/base-2026-11/cycling.json`). Cerchio, cuore, stella a 10, 20
e 30 km. Tempo del solo motore, grafo in cache.

**In breve**: 54 percorsi su 54 riusciti, 23 buoni (≥ 0,90), somiglianza
mediana 0,87, tempo mediano 1,6 s, massimo 12,7 s (Milano, 30 km). Come per
la corsa, Milano è quasi perfetta (0,97 di mediana) e la montagna più debole
(Asiago 0,79, Fiemme 0,86); la stella è la forma più facile, il cerchio la
più difficile (Asiago 10 km 0,60, al limite). La zona della bici è molto più
grande di quella a piedi (circa 26 × 26 km per 30 km): 2 300–11 000 km di
rete, compresi i sentieri e i marciapiedi da fare a piedi con la bici
(ADR-0167). Milano è la sola zona dove i tempi passano i 5 s.

Durante questa misura Overpass ha risposto «pieno» (502) tre volte: i nuovi
tentativi del banco (60 s, poi 120 s) sono bastati.

### Rete

| Zona | km di rete | pezzi | pezzo più grande | incroci | vicoli ciechi |
|---|---|---|---|---|---|
| trento | 5077,1 | 1 | 5077,1 km | 31109 | 11045 |
| valsugana | 3457,7 | 1 | 3457,7 km | 12636 | 4714 |
| milano | 11043,7 | 1 | 11043,7 km | 143485 | 21001 |
| fiemme | 2653,3 | 1 | 2653,3 km | 6214 | 1992 |
| asiago | 2574,6 | 1 | 2574,6 km | 6335 | 2137 |
| pianura | 2259,1 | 1 | 2259,1 km | 12370 | 2806 |

- trento, km per `highway`: track 1515,8, path 1069,7, unclassified 631,1, service 475,3, footway 402,3, residential 367,4, secondary 227,6, tertiary 192,6, cycleway 124,0, primary 47,4, pedestrian 16,2, secondary_link 2,4, bridleway 2,0, living_street 1,8, primary_link 0,9, tertiary_link 0,5
- valsugana, km per `highway`: track 1205,8, path 863,9, unclassified 514,7, residential 259,6, service 171,8, tertiary 131,0, secondary 119,5, footway 79,1, primary 73,2, cycleway 29,5, pedestrian 3,3, primary_link 2,8, bridleway 2,1, living_street 0,8, tertiary_link 0,5, secondary_link 0,2
- milano, km per `highway`: footway 4183,6, residential 1953,8, service 1425,3, unclassified 769,9, cycleway 715,9, tertiary 633,5, track 437,8, secondary 311,1, path 262,8, primary 195,5, pedestrian 116,0, primary_link 12,6, secondary_link 11,1, tertiary_link 9,8, living_street 4,9, bridleway 0,1
- fiemme, km per `highway`: track 1214,3, path 788,2, unclassified 144,1, secondary 95,0, service 92,0, residential 90,6, tertiary 78,3, primary 55,2, footway 45,4, cycleway 45,1, pedestrian 2,1, living_street 1,4, primary_link 0,9, tertiary_link 0,5, road 0,1, secondary_link 0,1
- asiago, km per `highway`: track 957,0, path 763,5, unclassified 290,8, residential 179,5, secondary 121,2, tertiary 103,8, service 63,9, primary 58,6, cycleway 18,0, footway 15,6, pedestrian 1,3, living_street 1,3, road 0,1
- pianura, km per `highway`: unclassified 510,5, residential 489,2, track 365,7, service 276,5, secondary 128,9, primary 122,0, cycleway 114,1, footway 97,0, tertiary 81,8, path 62,3, pedestrian 7,5, living_street 1,2, primary_link 1,1, bridleway 0,7, secondary_link 0,6, tertiary_link 0,0

### Forme

| Zona | chiesti | riusciti (≥ 0,60) | buoni (≥ 0,90) | somiglianza mediana | tempo mediano | tempo massimo |
|---|---|---|---|---|---|---|
| trento | 9 | 9 | 4 | 0,89 | 3,5 s | 5,6 s |
| valsugana | 9 | 9 | 3 | 0,83 | 1,1 s | 2,4 s |
| milano | 9 | 9 | 9 | 0,97 | 8,9 s | 12,7 s |
| fiemme | 9 | 9 | 2 | 0,86 | 1,0 s | 1,8 s |
| asiago | 9 | 9 | 1 | 0,79 | 1,1 s | 2,5 s |
| pianura | 9 | 9 | 4 | 0,86 | 1,8 s | 2,9 s |
| tutte | 54 | 54 | 23 | 0,87 | 1,6 s | 12,7 s |

### Percorsi

| Zona | forma | km chiesti | km reali | somiglianza | tempo | esito |
|---|---|---|---|---|---|---|
| trento | circle | 10 | 8,4 | 0,92 | 2,3 s | buono |
| trento | circle | 20 | 21,3 | 0,87 | 3,5 s | riuscito |
| trento | circle | 30 | 29,8 | 0,76 | 4,2 s | riuscito |
| trento | heart | 10 | 8,3 | 0,89 | 2,7 s | riuscito |
| trento | heart | 20 | 20,2 | 0,89 | 4,2 s | riuscito |
| trento | heart | 30 | 30,3 | 0,86 | 5,6 s | riuscito |
| trento | star | 10 | 10,2 | 0,93 | 1,4 s | buono |
| trento | star | 20 | 21,6 | 0,92 | 1,7 s | buono |
| trento | star | 30 | 29,6 | 0,97 | 3,8 s | buono |
| valsugana | circle | 10 | 10,4 | 0,76 | 0,8 s | riuscito |
| valsugana | circle | 20 | 19,1 | 0,67 | 1,5 s | riuscito |
| valsugana | circle | 30 | 31,8 | 0,83 | 1,8 s | riuscito |
| valsugana | heart | 10 | 11,1 | 0,82 | 0,8 s | riuscito |
| valsugana | heart | 20 | 19,3 | 0,83 | 1,6 s | riuscito |
| valsugana | heart | 30 | 30,0 | 0,84 | 2,4 s | riuscito |
| valsugana | star | 10 | 10,6 | 0,95 | 0,4 s | buono |
| valsugana | star | 20 | 20,5 | 0,98 | 0,9 s | buono |
| valsugana | star | 30 | 30,5 | 0,95 | 1,1 s | buono |
| milano | circle | 10 | 9,3 | 0,97 | 5,7 s | buono |
| milano | circle | 20 | 20,6 | 0,99 | 8,9 s | buono |
| milano | circle | 30 | 29,0 | 0,97 | 12,7 s | buono |
| milano | heart | 10 | 10,4 | 0,96 | 5,5 s | buono |
| milano | heart | 20 | 20,7 | 0,99 | 8,9 s | buono |
| milano | heart | 30 | 29,6 | 0,97 | 11,5 s | buono |
| milano | star | 10 | 9,3 | 0,96 | 5,2 s | buono |
| milano | star | 20 | 19,4 | 1,00 | 7,9 s | buono |
| milano | star | 30 | 29,7 | 0,96 | 10,1 s | buono |
| fiemme | circle | 10 | 10,8 | 0,74 | 0,8 s | riuscito |
| fiemme | circle | 20 | 20,6 | 0,76 | 1,0 s | riuscito |
| fiemme | circle | 30 | 30,2 | 0,89 | 1,5 s | riuscito |
| fiemme | heart | 10 | 10,2 | 0,71 | 0,7 s | riuscito |
| fiemme | heart | 20 | 19,4 | 0,86 | 1,2 s | riuscito |
| fiemme | heart | 30 | 30,5 | 0,72 | 1,8 s | riuscito |
| fiemme | star | 10 | 8,4 | 0,86 | 0,8 s | riuscito |
| fiemme | star | 20 | 21,4 | 0,90 | 0,7 s | buono |
| fiemme | star | 30 | 30,4 | 0,91 | 1,3 s | buono |
| asiago | circle | 10 | 10,1 | 0,60 | 0,6 s | riuscito |
| asiago | circle | 20 | 19,7 | 0,79 | 1,0 s | riuscito |
| asiago | circle | 30 | 31,8 | 0,86 | 1,6 s | riuscito |
| asiago | heart | 10 | 9,8 | 0,72 | 0,7 s | riuscito |
| asiago | heart | 20 | 21,2 | 0,72 | 1,2 s | riuscito |
| asiago | heart | 30 | 29,8 | 0,74 | 2,0 s | riuscito |
| asiago | star | 10 | 8,9 | 0,87 | 0,6 s | riuscito |
| asiago | star | 20 | 18,7 | 0,96 | 1,1 s | buono |
| asiago | star | 30 | 28,1 | 0,87 | 2,5 s | riuscito |
| pianura | circle | 10 | 10,4 | 0,83 | 1,0 s | riuscito |
| pianura | circle | 20 | 21,3 | 0,80 | 1,5 s | riuscito |
| pianura | circle | 30 | 31,0 | 0,86 | 1,8 s | riuscito |
| pianura | heart | 10 | 10,2 | 0,90 | 1,2 s | buono |
| pianura | heart | 20 | 18,7 | 0,80 | 1,9 s | riuscito |
| pianura | heart | 30 | 29,7 | 0,83 | 2,9 s | riuscito |
| pianura | star | 10 | 10,2 | 0,92 | 0,7 s | buono |
| pianura | star | 20 | 21,7 | 0,92 | 1,8 s | buono |
| pianura | star | 30 | 29,4 | 0,96 | 2,4 s | buono |
