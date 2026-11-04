# Corsa («Run»)

Attività `running`. Rete foot (il filtro `walk` di OSMnx senza l'esclusione delle ciclabili, ADR-0022), 1–50 km nel motore. Lo sport di partenza di MuW.

## Misure di base (TASK-376, 2026-11-04)

Banco `tools/sport_bench/` sul Mac, `main` `ea42f1c0` (motore uguale a
`bacd7c7b`), zone in cache in `data/cache`, `--label base-2026-11`; JSON in
`out/TASK-376/base-2026-11/running.json`. Cerchio, cuore, stella a 3, 5 e
10 km. **Il tempo è quello del motore** (`plan_route` con il grafo già in
cache), non quello dell'API né del telefono: serve a confrontare prima e
dopo, non a promettere tempi.

**In breve**: 54 percorsi su 54 riusciti, 25 buoni (≥ 0,90), somiglianza
mediana 0,89, tempo mediano 0,6 s, massimo 3,4 s (Milano, la rete più
fitta). Le città (Milano, Trento) e la pianura vanno meglio della montagna
(Asiago 0,76, Fiemme 0,83 di mediana): là la rete sono soprattutto `track` e
`path` lungo la valle. Il cerchio è la forma più difficile fuori città.
Controllo del banco: Trento a 5 km 0,91 / 0,92 / 0,98 (TASK-372: 0,90 /
0,91 / 0,98).

La rete è quella del pezzo connesso che il motore tiene (un solo pezzo per
zona), nell'area che serve ai percorsi da 10 km.

### Rete

| Zona | km di rete | pezzi | pezzo più grande | incroci | vicoli ciechi |
|---|---|---|---|---|---|
| trento | 1244,6 | 1 | 1244,6 km | 12473 | 4830 |
| valsugana | 598,3 | 1 | 598,3 km | 2446 | 841 |
| milano | 3174,2 | 1 | 3174,2 km | 49040 | 6801 |
| fiemme | 509,0 | 1 | 509,0 km | 1873 | 528 |
| asiago | 404,6 | 1 | 404,6 km | 1510 | 440 |
| pianura | 726,8 | 1 | 726,8 km | 6052 | 997 |

- trento, km per `highway`: service 255,9, footway 247,3, path 180,3, track 173,4, unclassified 117,5, residential 103,9, cycleway 54,9, tertiary 49,9, secondary 27,0, trunk 12,0, pedestrian 10,9, trunk_link 4,8, primary 3,0, steps 2,1, secondary_link 1,0, living_street 0,3, busway 0,2, tertiary_link 0,1, primary_link 0,1
- valsugana, km per `highway`: track 187,7, path 99,8, residential 89,4, unclassified 73,2, tertiary 39,7, service 39,0, secondary 34,4, footway 16,8, primary 6,5, cycleway 4,6, pedestrian 2,1, trunk 1,8, primary_link 1,8, trunk_link 0,9, tertiary_link 0,2, steps 0,2, secondary_link 0,0, living_street 0,0
- milano, km per `highway`: footway 2085,6, residential 481,4, service 232,0, cycleway 79,3, tertiary 72,9, secondary 50,4, pedestrian 47,3, unclassified 40,9, primary 30,6, path 26,1, track 15,2, steps 4,9, primary_link 2,2, corridor 1,8, tertiary_link 1,5, secondary_link 1,1, trunk_link 0,5, living_street 0,4, demolished 0,1, bus_stop 0,0, elevator 0,0
- fiemme, km per `highway`: track 169,4, path 98,7, unclassified 69,6, residential 37,0, secondary 26,6, service 26,2, tertiary 24,7, footway 21,2, primary 15,7, cycleway 15,4, living_street 1,4, pedestrian 1,1, primary_link 0,9, steps 0,8, road 0,1, secondary_link 0,1, tertiary_link 0,0
- asiago, km per `highway`: track 119,3, residential 84,5, path 75,4, unclassified 52,3, secondary 25,6, service 20,7, primary 13,1, footway 7,6, tertiary 3,8, pedestrian 1,0, cycleway 0,7, steps 0,3, living_street 0,2, road 0,1
- pianura, km per `highway`: residential 237,7, service 112,3, footway 73,5, unclassified 63,8, cycleway 52,4, track 37,8, path 36,0, secondary 34,5, primary 33,0, tertiary 20,3, trunk 13,4, pedestrian 5,4, trunk_link 4,8, primary_link 1,1, living_street 0,4, secondary_link 0,2, steps 0,1, tertiary_link 0,0

### Forme

| Zona | chiesti | riusciti (≥ 0,60) | buoni (≥ 0,90) | somiglianza mediana | tempo mediano | tempo massimo |
|---|---|---|---|---|---|---|
| trento | 9 | 9 | 5 | 0,91 | 1,0 s | 2,1 s |
| valsugana | 9 | 9 | 2 | 0,86 | 0,5 s | 0,7 s |
| milano | 9 | 9 | 9 | 0,96 | 1,9 s | 3,4 s |
| fiemme | 9 | 9 | 2 | 0,83 | 0,5 s | 0,7 s |
| asiago | 9 | 9 | 1 | 0,76 | 0,4 s | 0,6 s |
| pianura | 9 | 9 | 6 | 0,91 | 0,5 s | 1,1 s |
| tutte | 54 | 54 | 25 | 0,89 | 0,6 s | 3,4 s |

### Percorsi

| Zona | forma | km chiesti | km reali | somiglianza | tempo | esito |
|---|---|---|---|---|---|---|
| trento | circle | 3 | 3,5 | 0,80 | 1,0 s | riuscito |
| trento | circle | 5 | 5,3 | 0,91 | 1,3 s | buono |
| trento | circle | 10 | 8,9 | 0,86 | 1,8 s | riuscito |
| trento | heart | 3 | 3,5 | 0,89 | 1,1 s | riuscito |
| trento | heart | 5 | 5,2 | 0,92 | 1,0 s | buono |
| trento | heart | 10 | 9,1 | 0,88 | 2,1 s | riuscito |
| trento | star | 3 | 2,8 | 0,94 | 0,5 s | buono |
| trento | star | 5 | 4,8 | 0,98 | 0,5 s | buono |
| trento | star | 10 | 9,2 | 0,92 | 0,9 s | buono |
| valsugana | circle | 3 | 2,5 | 0,68 | 0,5 s | riuscito |
| valsugana | circle | 5 | 4,2 | 0,74 | 0,6 s | riuscito |
| valsugana | circle | 10 | 10,0 | 0,82 | 0,7 s | riuscito |
| valsugana | heart | 3 | 3,6 | 0,84 | 0,4 s | riuscito |
| valsugana | heart | 5 | 3,9 | 0,92 | 0,5 s | buono |
| valsugana | heart | 10 | 8,0 | 0,86 | 0,7 s | riuscito |
| valsugana | star | 3 | 2,4 | 0,86 | 0,4 s | riuscito |
| valsugana | star | 5 | 4,9 | 0,89 | 0,5 s | riuscito |
| valsugana | star | 10 | 9,8 | 0,93 | 0,5 s | buono |
| milano | circle | 3 | 2,8 | 0,92 | 1,9 s | buono |
| milano | circle | 5 | 5,4 | 0,92 | 2,0 s | buono |
| milano | circle | 10 | 9,7 | 1,00 | 3,3 s | buono |
| milano | heart | 3 | 3,1 | 0,96 | 1,3 s | buono |
| milano | heart | 5 | 5,4 | 0,97 | 1,8 s | buono |
| milano | heart | 10 | 10,1 | 0,99 | 3,4 s | buono |
| milano | star | 3 | 2,9 | 0,94 | 1,2 s | buono |
| milano | star | 5 | 4,7 | 0,92 | 1,9 s | buono |
| milano | star | 10 | 10,0 | 1,00 | 2,9 s | buono |
| fiemme | circle | 3 | 2,7 | 0,71 | 0,5 s | riuscito |
| fiemme | circle | 5 | 3,8 | 0,78 | 0,6 s | riuscito |
| fiemme | circle | 10 | 10,1 | 0,71 | 0,6 s | riuscito |
| fiemme | heart | 3 | 2,5 | 0,85 | 0,4 s | riuscito |
| fiemme | heart | 5 | 4,4 | 0,88 | 0,5 s | riuscito |
| fiemme | heart | 10 | 9,7 | 0,72 | 0,7 s | riuscito |
| fiemme | star | 3 | 2,9 | 0,91 | 0,4 s | buono |
| fiemme | star | 5 | 4,9 | 0,90 | 0,1 s | buono |
| fiemme | star | 10 | 9,0 | 0,83 | 0,6 s | riuscito |
| asiago | circle | 3 | 2,9 | 0,65 | 0,5 s | riuscito |
| asiago | circle | 5 | 5,2 | 0,76 | 0,4 s | riuscito |
| asiago | circle | 10 | 9,5 | 0,60 | 0,5 s | riuscito |
| asiago | heart | 3 | 3,2 | 0,81 | 0,4 s | riuscito |
| asiago | heart | 5 | 4,4 | 0,76 | 0,4 s | riuscito |
| asiago | heart | 10 | 8,7 | 0,78 | 0,6 s | riuscito |
| asiago | star | 3 | 2,8 | 0,76 | 0,3 s | riuscito |
| asiago | star | 5 | 5,4 | 0,91 | 0,4 s | buono |
| asiago | star | 10 | 9,5 | 0,84 | 0,5 s | riuscito |
| pianura | circle | 3 | 2,5 | 0,86 | 0,6 s | riuscito |
| pianura | circle | 5 | 4,7 | 0,94 | 0,3 s | buono |
| pianura | circle | 10 | 9,2 | 0,86 | 0,9 s | riuscito |
| pianura | heart | 3 | 3,0 | 0,90 | 0,5 s | buono |
| pianura | heart | 5 | 5,1 | 0,92 | 0,5 s | buono |
| pianura | heart | 10 | 8,7 | 0,89 | 1,1 s | riuscito |
| pianura | star | 3 | 2,9 | 0,94 | 0,4 s | buono |
| pianura | star | 5 | 4,6 | 0,91 | 0,3 s | buono |
| pianura | star | 10 | 9,2 | 0,97 | 0,4 s | buono |
