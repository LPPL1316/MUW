# Canoa e paddle («Paddle»)

Attività `paddling`. Nessuna rete: la forma si mette sull'acqua entro 1 km dalla riva, partendo dalla riva (TASK-191, ADR-0154, ADR-0161), 1–5 km. Il banco usa le partenze sull'acqua di Valsugana, Milano e Pianura; la somiglianza è sempre 1 (la forma è il percorso): contano se la forma entra, di quanto si rimpicciolisce (`scale`) e di quanto si sposta la partenza (`move_m`).

## Misure di base (TASK-376)

*Da fare, col turno del Coordinatore:*
`python tools/sport_bench/sport_bench.py run --activity paddling --label base-2026-11`.
Sono il riferimento con cui ogni modifica del motore si confronta
(`compare`).
