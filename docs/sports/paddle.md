# Canoa e paddle («Paddle»)

Attività `paddling`. Nessuna rete: la forma si mette sull'acqua entro 1 km dalla riva, partendo dalla riva (TASK-191, ADR-0154, ADR-0161), 1–5 km. Il banco usa le partenze sull'acqua di Valsugana, Milano e Pianura; la somiglianza è sempre 1 (la forma è il percorso): contano se la forma entra, di quanto si rimpicciolisce (`scale`) e di quanto si sposta la partenza (`move_m`).

## Misure di base (TASK-376, 2026-11-04)

Stesse condizioni di `run.md`; JSON in
`out/TASK-376/base-2026-11/paddling.json`. Cerchio, cuore, stella a 2, 3 e
5 km dalle partenze sull'acqua di Valsugana (lago di Levico) e Pianura
(laghi di Mantova); Milano (Idroscalo) misurata a parte la sera, quando
Overpass ha risposto (sotto, JSON in `out/TASK-376/milano-retry2/`).

**In breve**: 10 su 18. Tutte le forme entrano a 2 km; a 3 km entrano tutte a
Mantova e solo la stella a Levico; a 5 km nessuna. Il motore dice fino a
dove arriva («it fits at 2.1–4.0 km»): Levico 2,1–2,7 km, Mantova
2,9–4,0 km. Quando entra la forma è il percorso (somiglianza 1), la forma si
rimpicciolisce al massimo del 12% (`scale` 0,88–0,97) e la partenza si sposta
sulla riva di 110–890 m. Tempo del motore sotto 0,3 s, con l'acqua in cache.

**Milano, Idroscalo: 0 su 9.** Il bacino è lungo e stretto (circa 2,5 km,
largo poche centinaia di metri): a 3 e 5 km nessuna forma entra («even at 1.2 km», «at 2.0 km»),
la stella entra solo fino a 1,1 km, e a 2 km cerchio e cuore entrerebbero
sull'acqua ma **senza una riva raggiungibile a piedi entro 300 m**. È un
rifiuto vero del motore, non della rete: la canoa non promette niente su
uno specchio così.

Per i laghi piccoli il limite viene dall'acqua entro 1 km dalla riva
(ADR-0161), non dal motore: è il dato da cui partire per altri sport
sull'acqua (nuoto, TASK-323).

### Forme

| Zona | chiesti | riusciti (≥ 0,60) | buoni (≥ 0,90) | somiglianza mediana | tempo mediano | tempo massimo |
|---|---|---|---|---|---|---|
| valsugana | 9 | 4 | 4 | 1,00 | 0,1 s | 0,2 s |
| pianura | 9 | 6 | 6 | 1,00 | 0,2 s | 0,3 s |
| tutte | 18 | 10 | 10 | 1,00 | 0,2 s | 0,3 s |

### Percorsi

| Zona | forma | km chiesti | km reali | somiglianza | tempo | esito |
|---|---|---|---|---|---|---|
| valsugana | circle | 2 | 2,0 | 1,00 | 0,1 s | buono |
| valsugana | circle | 3 | — | — | 0,0 s | WaterFitError |
| valsugana | circle | 5 | — | — | 0,0 s | WaterFitError |
| valsugana | heart | 2 | 2,0 | 1,00 | 0,2 s | buono |
| valsugana | heart | 3 | — | — | 0,2 s | WaterFitError |
| valsugana | heart | 5 | — | — | 0,2 s | WaterFitError |
| valsugana | star | 2 | 2,0 | 1,00 | 0,1 s | buono |
| valsugana | star | 3 | 2,8 | 1,00 | 0,1 s | buono |
| valsugana | star | 5 | — | — | 0,1 s | WaterFitError |
| pianura | circle | 2 | 2,0 | 1,00 | 0,1 s | buono |
| pianura | circle | 3 | 3,0 | 1,00 | 0,1 s | buono |
| pianura | circle | 5 | — | — | 0,1 s | WaterFitError |
| pianura | heart | 2 | 2,0 | 1,00 | 0,3 s | buono |
| pianura | heart | 3 | 3,0 | 1,00 | 0,2 s | buono |
| pianura | heart | 5 | — | — | 0,2 s | WaterFitError |
| pianura | star | 2 | 2,0 | 1,00 | 0,3 s | buono |
| pianura | star | 3 | 3,0 | 1,00 | 0,3 s | buono |
| pianura | star | 5 | — | — | 0,2 s | WaterFitError |

### Forme a Milano

| Zona | chiesti | riusciti (≥ 0,60) | buoni (≥ 0,90) | somiglianza mediana | tempo mediano | tempo massimo |
|---|---|---|---|---|---|---|
| milano | 9 | 0 | 0 | — | 0,2 s | 0,3 s |
| tutte | 9 | 0 | 0 | — | 0,2 s | 0,3 s |

### Percorsi a Milano

| Zona | forma | km chiesti | km reali | somiglianza | tempo | esito |
|---|---|---|---|---|---|---|
| milano | circle | 2 | — | — | 0,1 s | WaterFitError |
| milano | circle | 3 | — | — | 0,0 s | WaterFitError |
| milano | circle | 5 | — | — | 0,1 s | WaterFitError |
| milano | heart | 2 | — | — | 0,3 s | WaterFitError |
| milano | heart | 3 | — | — | 0,2 s | WaterFitError |
| milano | heart | 5 | — | — | 0,2 s | WaterFitError |
| milano | star | 2 | — | — | 0,3 s | WaterFitError |
| milano | star | 3 | — | — | 0,2 s | WaterFitError |
| milano | star | 5 | — | — | 0,2 s | WaterFitError |
