# Gravel e MTB (da decidere)

TASK-378, ADR-0322 proposto. Uno sport o due, nomi, emoji, distanze, rete e
testi sono scelte dell'utente: qui ci sono le misure che le preparano.

## Le reti provate (TASK-378 parte 0, 2026-11-05)

Banco `tools/sport_bench/` sul Mac, `main` `42e0433a`, `nice -n 10`, un
comando per volta, dopo i banchi di 377-A. Le reti non sono nel motore: le
dà `--loader out/TASK-378/loader.py`. Le richieste sono di bici
(`--activity cycling`), perché il motore non conosce ancora gravel e MTB:
il grafo è segnato come rete bike, così il motore lo accetta. Cache in
`out/TASK-378/cache`, JSON in `out/sport-bench/gravel-6` e `mtb-6`.
Cerchio, cuore e stella a 10, 20 e 30 km, come la bici. Il tempo è quello
del motore, col grafo già in cache.

Le reti sono la rete bike (ADR-0153, ADR-0167) con altre regole su cosa si
pedala; dove una via non si pedala, si fa a piedi con la bici come oggi (6
volte il costo). Un solo download per zona serve tutte le varianti.

- **`gravel`**: le `track` fino a `tracktype=grade3` (o senza
  `tracktype`), via le `grade4` e `grade5`; i `path` e le `bridleway`
  pedalabili quando la bici è ammessa (`bicycle` yes, permissive,
  designated) e fino a `mtb:scale` 1. Il resto come la bici.
- **`mtb`**: `gravel`, più tutte le `track`, e i `path` e le `bridleway`
  non chiusi alle bici fino a `mtb:scale` 2. Un sentiero senza
  `mtb:scale` vale fino a `sac_scale` T2 («mountain hiking»).
- **Tutte e due** lasciano fuori `bicycle=no` e `access=private`, come la
  bici.

Per sapere su cosa corrono i percorsi, `out/TASK-378/mix.py` rifà le stesse
richieste e legge i controlli del motore (`validation.usability`): metri
sterrati (`validation.unpaved`), a piedi con la bici, sulle strade
principali (`primary`). Lo stesso per la bici di oggi, sulla sua cache.

**In breve:**

- **`gravel` è la bici di oggi.** 54 percorsi su 54, 20 buoni, somiglianza
  mediana 0,85 (la bici: 54, 23, 0,87). Lo sterrato è lo stesso, 22,7%
  contro 23,3%: la bici pedala già ogni `track`. I sentieri con
  `bicycle=yes`, che la bici oggi fa a piedi, sono pochi: 89 km a Trento
  su 1115 di `path`.
- **`mtb` cambia davvero i percorsi.** 49 su 54, 24 buoni, mediana 0,90.
  A piedi con la bici passa dal 4,9% all'1,4% dei km. La rete pedalabile
  cresce del 24–39% in montagna, dell'1–3% in città e in pianura.
  - Le 5 forme mancate sono tutte a 30 km, quattro stelle e un cuore.
    Il motore le disegna, ma sbaglia la distanza di 2,0–2,8 km, oltre i
    2 km ammessi.
  - Il tempo massimo è 106 s, un cerchio di 30 km a Fiemme (riuscito),
    contro i 12,7 s della bici.
- **Lo sterrato lo decide il posto, non la rete.**
  - A Fiemme e ad Asiago è il 35–45% del percorso con tutte e tre le reti.
  - A Milano e in pianura è il 3–13%.
  - Il motore segue la forma, e attorno a una partenza in città le strade
    sono asfaltate.
- **Preferire lo sterrato nel costo non serve.** Ho provato a Trento, solo
  dentro il processo del banco, un metro d'asfalto che costa 2 o 4 metri.
  Lo sterrato sale poco:
  - `gravel` dal 10,1% al 12,3%;
  - `mtb` dal 14,1% al 19,4% a ×2, al 17,7% a ×4.

  Sarebbe un cambio della ricerca del motore. Non lo propongo.
- **La variante senza strade principali** (`gravel` senza `primary` e
  `secondary`), provata a Trento: 9 su 9, ma a piedi con la bici sale al
  10,3%, e la somiglianza scende a 0,86. Non l'ho portata sulle altre zone.

### Su cosa corrono i percorsi

Sei zone, 54 richieste per rete; percentuali sui km dei percorsi riusciti
(`out/TASK-378/summ.py` dai JSON `mix-*-6.json`).

| Rete | riusciti | buoni | somiglianza mediana | km | sterrato | a piedi con la bici | strade principali |
|---|---|---|---|---|---|---|---|
| `bike` (oggi) | 54 su 54 | 23 | 0,87 | 1083,7 | 23,3 % | 4,9 % | 4,9 % |
| `gravel` | 54 su 54 | 20 | 0,85 | 1081,2 | 22,7 % | 4,1 % | 4,7 % |
| `mtb` | 49 su 54 | 24 | 0,90 | 912,5 | 22,0 % | 1,4 % | 3,8 % |

| Zona | sterrato `bike` | sterrato `gravel` | sterrato `mtb` | a piedi `bike` | a piedi `gravel` | a piedi `mtb` |
|---|---|---|---|---|---|---|
| trento | 12,2 % | 10,1 % | 14,1 % | 5,4 % | 4,8 % | 1,4 % |
| valsugana | 28,4 % | 31,0 % | 34,0 % | 7,0 % | 6,8 % | 1,7 % |
| milano | 4,0 % | 3,1 % | 2,6 % | 1,6 % | 1,5 % | 1,5 % |
| fiemme | 44,9 % | 41,7 % | 34,8 % | 5,5 % | 5,9 % | 0,8 % |
| asiago | 40,7 % | 37,8 % | 39,6 % | 7,1 % | 3,0 % | 0,2 % |
| pianura | 9,7 % | 12,7 % | 9,2 % | 2,7 % | 2,9 % | 2,3 % |

A Trento, le prove che non ho portato sulle altre zone
(`mix-*-trento.json`):

| Rete | riusciti | buoni | somiglianza mediana | sterrato | a piedi con la bici | strade principali |
|---|---|---|---|---|---|---|
| `gravel` senza `primary` e `secondary` | 9 su 9 | 4 | 0,86 | 12,6 % | 10,3 % | 0,0 % |
| `gravel`, asfalto ×2 | 9 su 9 | 4 | 0,89 | 12,3 % | 6,5 % | 0,4 % |
| `mtb`, asfalto ×2 | 9 su 9 | 4 | 0,86 | 19,4 % | 4,4 % | 0,5 % |
| `mtb`, asfalto ×4 | 9 su 9 | 5 | 0,91 | 17,7 % | 7,1 % | 0,3 % |

### Quanto si pedala

Km pedalabili del download di ogni zona, con le regole di ogni rete
(`out/TASK-378/tags.py`; ogni tratto contato una volta).

| Zona | `bike` | `gravel` | `mtb` | `mtb` in più della bici |
|---|---|---|---|---|
| trento | 3.681,9 | 3.616,9 | 4.554,0 | +23,7 % |
| valsugana | 2.554,6 | 2.491,1 | 3.263,7 | +27,8 % |
| milano | 6.697,2 | 6.715,5 | 6.914,9 | +3,3 % |
| fiemme | 2.381,3 | 2.298,5 | 3.298,1 | +38,5 % |
| asiago | 1.815,7 | 1.697,8 | 2.490,0 | +37,1 % |
| pianura | 2.158,1 | 2.123,1 | 2.178,7 | +1,0 % |

I `path` e le `bridleway` per `mtb:scale`, in km. Quasi tutti i sentieri
non lo dicono: per loro vale `sac_scale`.

| Zona | path e bridleway | senza `mtb:scale` | S0 | S1 | S2 | S3 | S4–S6 | `bicycle=no` |
|---|---|---|---|---|---|---|---|---|
| trento | 1.114,8 | 786,8 | 17,4 | 101,7 | 123,6 | 70,8 | 14,5 | 84,7 |
| valsugana | 900,7 | 692,0 | 16,4 | 65,6 | 72,5 | 41,6 | 12,6 | 84,1 |
| milano | 294,2 | 283,0 | 10,6 | 0,4 | 0,0 | 0,2 | 0,0 | 2,4 |
| fiemme | 1.064,3 | 919,3 | 7,6 | 37,8 | 68,9 | 17,2 | 13,5 | 64,6 |
| asiago | 789,5 | 620,6 | 20,7 | 53,1 | 53,4 | 32,8 | 8,9 | 57,8 |
| pianura | 69,5 | 69,5 | 0,0 | 0,0 | 0,0 | 0,0 | 0,0 | 0,4 |

Le `track` per `tracktype`, in km:

| Zona | track | grade1 | grade2 | grade3 | grade4 | grade5 | senza `tracktype` |
|---|---|---|---|---|---|---|---|
| trento | 1.597,9 | 134,7 | 273,1 | 311,9 | 92,1 | 34,9 | 751,2 |
| valsugana | 1.264,9 | 81,1 | 342,3 | 236,2 | 96,7 | 21,8 | 486,8 |
| milano | 481,4 | 19,3 | 117,8 | 81,0 | 22,3 | 9,7 | 231,3 |
| fiemme | 1.620,6 | 63,2 | 427,5 | 203,8 | 73,5 | 24,3 | 828,0 |
| asiago | 989,3 | 32,6 | 276,6 | 239,3 | 119,7 | 28,2 | 292,9 |
| pianura | 401,5 | 72,5 | 66,1 | 49,5 | 26,3 | 14,0 | 173,1 |

### Rete `gravel`

| Zona | km di rete | pezzi | pezzo più grande | incroci | vicoli ciechi |
|---|---|---|---|---|---|
| trento | 4937,6 | 1 | 4937,6 km | 30551 | 11093 |
| valsugana | 3308,8 | 1 | 3308,8 km | 12222 | 4747 |
| milano | 11013,2 | 1 | 11013,2 km | 143357 | 21005 |
| fiemme | 2564,3 | 1 | 2564,3 km | 5949 | 2017 |
| asiago | 2391,8 | 1 | 2391,8 km | 5893 | 2226 |
| pianura | 2219,4 | 1 | 2219,4 km | 12280 | 2804 |

- trento, km per `highway`: track 1343,8, path 1047,1, unclassified 623,5, service 489,3, residential 416,4, footway 407,1, secondary 226,4, tertiary 192,5, cycleway 123,2, primary 48,6, pedestrian 14,2, secondary_link 2,4, living_street 1,5, primary_link 0,9, tertiary_link 0,5, bridleway 0,2
- valsugana, km per `highway`: track 1081,8, path 856,0, unclassified 500,5, residential 259,5, service 172,3, tertiary 132,6, secondary 119,1, footway 79,3, primary 73,2, cycleway 24,8, pedestrian 3,3, primary_link 2,8, bridleway 2,2, living_street 0,8, tertiary_link 0,5, secondary_link 0,2
- milano, km per `highway`: footway 4187,8, residential 1956,9, service 1432,8, unclassified 762,8, cycleway 689,4, tertiary 634,8, track 413,3, secondary 309,8, path 272,3, primary 193,6, pedestrian 117,3, primary_link 15,5, secondary_link 12,6, tertiary_link 8,6, living_street 5,7, bridleway 0,1
- fiemme, km per `highway`: track 1131,4, path 790,5, unclassified 137,4, secondary 94,9, service 92,9, residential 91,0, tertiary 78,6, primary 55,2, footway 45,4, cycleway 42,2, pedestrian 1,9, living_street 1,4, primary_link 0,9, tertiary_link 0,5, road 0,1, secondary_link 0,1
- asiago, km per `highway`: track 808,6, path 740,9, unclassified 282,2, residential 181,2, secondary 121,2, tertiary 103,9, service 63,8, primary 58,6, footway 15,5, cycleway 13,3, pedestrian 1,3, living_street 1,2, road 0,1
- pianura, km per `highway`: unclassified 508,3, residential 493,6, track 325,6, service 277,4, secondary 128,2, primary 122,0, cycleway 104,7, footway 97,3, tertiary 82,5, path 68,6, pedestrian 7,5, living_street 1,2, primary_link 1,1, secondary_link 0,7, bridleway 0,7, tertiary_link 0,0

### Forme con `gravel`

| Zona | chiesti | riusciti (≥ 0,60) | buoni (≥ 0,90) | somiglianza mediana | tempo mediano | tempo massimo |
|---|---|---|---|---|---|---|
| trento | 9 | 9 | 4 | 0,89 | 3,3 s | 5,7 s |
| valsugana | 9 | 9 | 2 | 0,82 | 1,5 s | 3,0 s |
| milano | 9 | 9 | 9 | 0,98 | 9,1 s | 23,2 s |
| fiemme | 9 | 9 | 1 | 0,81 | 1,2 s | 1,9 s |
| asiago | 9 | 9 | 1 | 0,80 | 1,1 s | 1,7 s |
| pianura | 9 | 9 | 3 | 0,85 | 1,8 s | 2,7 s |
| tutte | 54 | 54 | 20 | 0,85 | 1,6 s | 23,2 s |

### Percorsi con `gravel`

| Zona | forma | km chiesti | km reali | somiglianza | tempo | esito |
|---|---|---|---|---|---|---|
| trento | circle | 10 | 8,4 | 0,92 | 2,6 s | buono |
| trento | circle | 20 | 20,5 | 0,77 | 3,3 s | riuscito |
| trento | circle | 30 | 31,3 | 0,66 | 3,9 s | riuscito |
| trento | heart | 10 | 8,3 | 0,89 | 2,8 s | riuscito |
| trento | heart | 20 | 21,4 | 0,84 | 4,4 s | riuscito |
| trento | heart | 30 | 30,2 | 0,85 | 5,7 s | riuscito |
| trento | star | 10 | 10,2 | 0,93 | 1,4 s | buono |
| trento | star | 20 | 19,9 | 0,92 | 1,8 s | buono |
| trento | star | 30 | 28,6 | 0,97 | 3,7 s | buono |
| valsugana | circle | 10 | 10,4 | 0,77 | 0,8 s | riuscito |
| valsugana | circle | 20 | 19,7 | 0,71 | 1,4 s | riuscito |
| valsugana | circle | 30 | 29,3 | 0,73 | 1,8 s | riuscito |
| valsugana | heart | 10 | 8,5 | 0,86 | 0,9 s | riuscito |
| valsugana | heart | 20 | 20,1 | 0,82 | 1,6 s | riuscito |
| valsugana | heart | 30 | 29,9 | 0,81 | 2,7 s | riuscito |
| valsugana | star | 10 | 10,5 | 0,96 | 0,4 s | buono |
| valsugana | star | 20 | 18,5 | 0,94 | 1,5 s | buono |
| valsugana | star | 30 | 30,0 | 0,84 | 3,0 s | riuscito |
| milano | circle | 10 | 9,3 | 0,97 | 5,7 s | buono |
| milano | circle | 20 | 20,6 | 0,99 | 9,3 s | buono |
| milano | circle | 30 | 31,9 | 0,98 | 13,5 s | buono |
| milano | heart | 10 | 10,3 | 0,97 | 5,6 s | buono |
| milano | heart | 20 | 20,7 | 0,99 | 9,1 s | buono |
| milano | heart | 30 | 29,7 | 0,97 | 12,1 s | buono |
| milano | star | 10 | 9,3 | 0,96 | 5,3 s | buono |
| milano | star | 20 | 20,4 | 1,00 | 8,1 s | buono |
| milano | star | 30 | 28,6 | 1,00 | 23,2 s | buono |
| fiemme | circle | 10 | 10,3 | 0,71 | 0,6 s | riuscito |
| fiemme | circle | 20 | 21,8 | 0,81 | 1,1 s | riuscito |
| fiemme | circle | 30 | 30,2 | 0,86 | 1,4 s | riuscito |
| fiemme | heart | 10 | 11,0 | 0,61 | 1,4 s | riuscito |
| fiemme | heart | 20 | 20,6 | 0,77 | 1,2 s | riuscito |
| fiemme | heart | 30 | 31,4 | 0,86 | 1,9 s | riuscito |
| fiemme | star | 10 | 11,4 | 0,70 | 0,8 s | riuscito |
| fiemme | star | 20 | 18,7 | 0,83 | 1,2 s | riuscito |
| fiemme | star | 30 | 29,8 | 0,96 | 0,7 s | buono |
| asiago | circle | 10 | 9,2 | 0,68 | 0,6 s | riuscito |
| asiago | circle | 20 | 19,2 | 0,80 | 0,9 s | riuscito |
| asiago | circle | 30 | 31,8 | 0,72 | 1,6 s | riuscito |
| asiago | heart | 10 | 8,9 | 0,76 | 0,7 s | riuscito |
| asiago | heart | 20 | 21,2 | 0,81 | 1,2 s | riuscito |
| asiago | heart | 30 | 29,3 | 0,81 | 1,7 s | riuscito |
| asiago | star | 10 | 9,2 | 0,80 | 0,7 s | riuscito |
| asiago | star | 20 | 19,9 | 0,83 | 1,1 s | riuscito |
| asiago | star | 30 | 28,3 | 0,95 | 1,5 s | buono |
| pianura | circle | 10 | 10,4 | 0,84 | 1,0 s | riuscito |
| pianura | circle | 20 | 21,3 | 0,80 | 1,4 s | riuscito |
| pianura | circle | 30 | 30,3 | 0,86 | 2,1 s | riuscito |
| pianura | heart | 10 | 8,5 | 0,94 | 1,2 s | buono |
| pianura | heart | 20 | 18,7 | 0,84 | 1,9 s | riuscito |
| pianura | heart | 30 | 30,7 | 0,85 | 2,7 s | riuscito |
| pianura | star | 10 | 10,1 | 0,90 | 0,6 s | buono |
| pianura | star | 20 | 21,9 | 0,79 | 1,8 s | riuscito |
| pianura | star | 30 | 30,8 | 0,93 | 2,3 s | buono |

### Rete `mtb`

| Zona | km di rete | pezzi | pezzo più grande | incroci | vicoli ciechi |
|---|---|---|---|---|---|
| trento | 5084,3 | 1 | 5084,3 km | 31099 | 11046 |
| valsugana | 3461,6 | 1 | 3461,6 km | 12634 | 4711 |
| milano | 11046,3 | 1 | 11046,3 km | 143498 | 21002 |
| fiemme | 2665,4 | 1 | 2665,4 km | 6205 | 1991 |
| asiago | 2584,7 | 1 | 2584,7 km | 6322 | 2137 |
| pianura | 2259,6 | 1 | 2259,6 km | 12378 | 2812 |

- trento, km per `highway`: track 1627,2, path 984,0, unclassified 598,5, service 474,8, footway 403,6, residential 380,9, secondary 227,1, tertiary 193,4, cycleway 121,1, primary 48,6, pedestrian 16,1, bridleway 3,0, secondary_link 2,5, living_street 2,1, primary_link 0,9, tertiary_link 0,5
- valsugana, km per `highway`: track 1137,9, path 937,8, unclassified 464,4, residential 298,1, service 184,2, tertiary 132,6, secondary 119,7, footway 80,5, primary 73,2, cycleway 26,0, pedestrian 2,9, primary_link 2,8, living_street 0,8, tertiary_link 0,5, secondary_link 0,2, bridleway 0,1
- milano, km per `highway`: footway 4199,3, residential 2002,9, service 1436,4, unclassified 737,4, cycleway 691,1, tertiary 631,9, track 408,6, secondary 308,8, path 284,4, primary 195,3, pedestrian 109,5, primary_link 13,6, secondary_link 12,6, tertiary_link 9,0, living_street 5,6, bridleway 0,1
- fiemme, km per `highway`: track 1157,1, path 855,6, unclassified 118,4, residential 109,1, service 102,6, secondary 94,9, tertiary 78,6, primary 55,2, footway 45,7, cycleway 43,3, pedestrian 2,0, living_street 1,4, primary_link 0,9, tertiary_link 0,5, road 0,1, secondary_link 0,1
- asiago, km per `highway`: track 889,5, path 834,3, unclassified 261,1, residential 216,2, secondary 121,2, tertiary 103,6, service 68,5, primary 58,6, footway 15,9, cycleway 13,3, living_street 1,3, pedestrian 1,2, road 0,1
- pianura, km per `highway`: residential 519,2, unclassified 493,5, track 342,7, service 288,9, secondary 127,8, primary 122,0, cycleway 106,0, footway 97,7, tertiary 82,0, path 69,3, pedestrian 6,9, living_street 1,1, primary_link 1,1, secondary_link 0,7, bridleway 0,7, tertiary_link 0,0

### Forme con `mtb`

| Zona | chiesti | riusciti (≥ 0,60) | buoni (≥ 0,90) | somiglianza mediana | tempo mediano | tempo massimo |
|---|---|---|---|---|---|---|
| trento | 9 | 9 | 5 | 0,91 | 3,2 s | 6,6 s |
| valsugana | 9 | 9 | 3 | 0,86 | 1,7 s | 3,1 s |
| milano | 9 | 8 | 8 | 0,98 | 9,2 s | 22,9 s |
| fiemme | 9 | 7 | 3 | 0,89 | 0,8 s | 106,0 s |
| asiago | 9 | 8 | 2 | 0,85 | 1,1 s | 1,8 s |
| pianura | 9 | 8 | 3 | 0,83 | 1,4 s | 2,6 s |
| tutte | 54 | 49 | 24 | 0,90 | 1,8 s | 106,0 s |

### Percorsi con `mtb`

| Zona | forma | km chiesti | km reali | somiglianza | tempo | esito |
|---|---|---|---|---|---|---|
| trento | circle | 10 | 8,4 | 0,92 | 2,4 s | buono |
| trento | circle | 20 | 21,4 | 0,81 | 3,2 s | riuscito |
| trento | circle | 30 | 29,1 | 0,76 | 4,5 s | riuscito |
| trento | heart | 10 | 8,1 | 0,91 | 2,9 s | buono |
| trento | heart | 20 | 20,8 | 0,85 | 4,3 s | riuscito |
| trento | heart | 30 | 29,5 | 0,87 | 6,1 s | riuscito |
| trento | star | 10 | 9,5 | 0,96 | 1,4 s | buono |
| trento | star | 20 | 18,2 | 0,96 | 2,2 s | buono |
| trento | star | 30 | 30,3 | 0,93 | 6,6 s | buono |
| valsugana | circle | 10 | 9,6 | 0,84 | 0,7 s | riuscito |
| valsugana | circle | 20 | 21,8 | 0,75 | 1,5 s | riuscito |
| valsugana | circle | 30 | 30,6 | 0,86 | 1,9 s | riuscito |
| valsugana | heart | 10 | 8,9 | 0,82 | 0,9 s | riuscito |
| valsugana | heart | 20 | 18,2 | 0,86 | 1,7 s | riuscito |
| valsugana | heart | 30 | 29,6 | 0,89 | 2,7 s | riuscito |
| valsugana | star | 10 | 10,5 | 0,94 | 0,7 s | buono |
| valsugana | star | 20 | 18,7 | 0,92 | 3,1 s | buono |
| valsugana | star | 30 | 31,2 | 0,90 | 2,3 s | buono |
| milano | circle | 10 | 10,7 | 0,97 | 6,8 s | buono |
| milano | circle | 20 | 20,6 | 0,99 | 9,7 s | buono |
| milano | circle | 30 | 31,0 | 0,99 | 12,2 s | buono |
| milano | heart | 10 | 10,3 | 0,97 | 5,7 s | buono |
| milano | heart | 20 | 20,7 | 0,99 | 9,2 s | buono |
| milano | heart | 30 | 28,4 | 0,98 | 12,6 s | buono |
| milano | star | 10 | 9,3 | 0,96 | 6,3 s | buono |
| milano | star | 20 | 19,9 | 1,00 | 8,6 s | buono |
| milano | star | 30 | — | — | 22,9 s | ShapeNotDrawableError |
| fiemme | circle | 10 | 10,6 | 0,76 | 0,8 s | riuscito |
| fiemme | circle | 20 | 18,7 | 0,69 | 0,9 s | riuscito |
| fiemme | circle | 30 | 31,0 | 0,89 | 106,0 s | riuscito |
| fiemme | heart | 10 | 9,3 | 0,72 | 0,7 s | riuscito |
| fiemme | heart | 20 | 20,6 | 0,96 | 0,7 s | buono |
| fiemme | heart | 30 | — | — | 1,7 s | ShapeNotDrawableError |
| fiemme | star | 10 | 9,9 | 0,92 | 0,5 s | buono |
| fiemme | star | 20 | 19,8 | 0,90 | 0,4 s | buono |
| fiemme | star | 30 | — | — | 1,4 s | ShapeNotDrawableError |
| asiago | circle | 10 | 8,0 | 0,77 | 1,7 s | riuscito |
| asiago | circle | 20 | 18,6 | 0,93 | 1,0 s | buono |
| asiago | circle | 30 | 28,3 | 0,83 | 1,7 s | riuscito |
| asiago | heart | 10 | 8,8 | 0,80 | 0,7 s | riuscito |
| asiago | heart | 20 | 20,1 | 0,87 | 1,1 s | riuscito |
| asiago | heart | 30 | 28,5 | 0,81 | 1,8 s | riuscito |
| asiago | star | 10 | 10,8 | 0,90 | 0,6 s | riuscito |
| asiago | star | 20 | 18,1 | 0,94 | 0,6 s | buono |
| asiago | star | 30 | — | — | 1,3 s | ShapeNotDrawableError |
| pianura | circle | 10 | 10,1 | 0,84 | 1,0 s | riuscito |
| pianura | circle | 20 | 20,2 | 0,74 | 1,2 s | riuscito |
| pianura | circle | 30 | 31,4 | 0,78 | 2,0 s | riuscito |
| pianura | heart | 10 | 8,3 | 0,91 | 1,2 s | buono |
| pianura | heart | 20 | 20,3 | 0,80 | 1,9 s | riuscito |
| pianura | heart | 30 | 28,1 | 0,83 | 2,6 s | riuscito |
| pianura | star | 10 | 9,0 | 0,99 | 0,5 s | buono |
| pianura | star | 20 | 18,7 | 0,91 | 1,4 s | buono |
| pianura | star | 30 | — | — | 2,4 s | ShapeNotDrawableError |

## Cosa resta da misurare

- **Il dislivello dei percorsi** (`CONDIVISO.md`, «Le quote»): conta per
  il tempo e le calorie di una MTB in montagna.
- **Le stelle di 30 km di `mtb`** che sbagliano la distanza di poco: con la
  parte A, sul motore vero.
