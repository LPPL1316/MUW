# TASK-372 — Sci di fondo: la rete delle piste non basta, lo sport va in «Record only»

**Stato**: Done (2026-11-04) — benchmark fatto, nessun codice; lo sport
`xc_skiing` entra nella categoria «Record only» con TASK-375 (ADR-0319).
**Fase**: 4 · **Branch**: `docs/TASK-372-xc-ski-record-only`
**Da allineare con**: TASK-373 (sci alpino, ADR-0317), TASK-375 («Record
only», ADR-0319)

## Obiettivo

Sapere se la rete OSM delle piste da fondo basta a disegnare forme, prima
di aggiungere lo sport «Cross-country ski». Richiesta dell'utente del
2026-11-04; numeri dal Coordinatore.

## La richiesta (2026-11-04)

Sul modello della bici (TASK-190): una rete `nordic` (vie con
`piste:type=nordic` e relazioni `route=piste`, `piste:oneway` rispettato,
niente strade normali); un'attività `xc_skiing` dal motore all'app, con
ritmo e testi in tutte le lingue. Fuori dai centri fondo il motore deve dire
chiaramente che non ci sono piste. **Prima del codice, un benchmark su 2–3
centri**. Se la rete basta solo per forme piccole, proporre distanze e forme
ammesse. Le scelte di prodotto (stagionalità, l'estate) sono dell'utente.

## Il benchmark

Fatto sul Mac in `out/xc-ski-bench/` (ignorato da git): `download.py`,
`stats.py`, `bench.py`, `REPORT.md`, le immagini in `pics/`.

- **Rete**: da Overpass, `way["piste:type"="nordic"]` più le vie delle
  relazioni `route=piste` `piste:type=nordic`, in un riquadro di 20 × 20 km
  attorno al centro. Il grafo collega le vie che hanno un punto in comune.
- **Forme**: il motore vero (`plan_shape`, lo stesso della CLI) sul pezzo
  connesso più grande, con cerchio, cuore e stella a 3, 5, 8, 12 e 20 km.
  Le piste valgono **nei due sensi**, quindi la stima è ottimistica: a
  Fiemme 76 vie hanno `piste:oneway=yes`.
- **Controllo del banco**: lo stesso codice sul grafo a piedi di Trento in
  cache, a 5 km, dà cerchio 0,90, cuore 0,91, stella 0,98.

| Centro | km di pista | pezzi | pezzo più grande | estensione | incroci | anelli |
|---|---|---|---|---|---|---|
| Val di Fiemme (Lago di Tesero) | 81 | 4 | 56 km | 5,8 × 7,8 km | 44 | 23 |
| Asiago | 178 | 10 | 65 km | 5,2 × 9,8 km | 25 | 10 |
| Dobbiaco | 161 | 14 | 54 km | 15,3 × 10,1 km | 70 | 38 |

**Esito**: delle 45 richieste nessuna arriva alla soglia buona di 0,90.
Sei superano il minimo di 0,60 e a occhio sono tutte irriconoscibili:
- Fiemme: stella 8 km 0,81, stella 12 km 0,69, cuore 20 km 0,64, cuore 12 km 0,61;
- Dobbiaco: stella 5 km 0,66, stella 3 km 0,63.

Asiago: 0 su 15. Il cerchio non riesce in nessun centro (al massimo 0,49).
Le forme piccole non vanno meglio delle grandi: le piste sono lunghe, seguono
la valle e hanno pochi incroci vicini fra loro.

**Disco**: una zona di sola rete nordic pesa 0,2–0,4 MB di risposta Overpass
e circa 0,2 MB di grafo. Il disco non sarebbe un vincolo.

Lo sci alpino (TASK-373) trova lo stesso su Paganella, Campiglio e Sella
Ronda: somiglianza 0,22–0,58.

## La scelta dell'utente (2026-11-04)

Fra «fermare il task», «gli anelli segnati del centro, senza forma» e
«registrare senza forma», l'utente ha scelto **«Sì, Record only»**: lo sci
di fondo è uno sport che si registra senza forma, nella categoria di
TASK-375, come lo sci alpino.

## Cosa fare

1. Scrivere il benchmark e la scelta qui e in ADR-0316.
2. Accordarsi con TASK-375: lì si aggiungono `skiing` e `xc_skiing`
   insieme (contratto, API, la migrazione 0044 dei vincoli su `activity`,
   lo sport nell'app, i testi), così quei file hanno un solo padrone e la
   migrazione è una.

## Criteri di accettazione

- [x] Benchmark su tre centri, con il controllo del banco, scritto qui.
- [x] ADR-0316 con la decisione e il motivo.
- [x] Nessun file di codice toccato; l'impronta del motore non cambia.

## File toccati

```
docs/tasks/TASK-372.md
docs/DECISIONS.md
docs/STATUS.md
```

## Fuori scope

- La rete `nordic` e un filtro delle piste nel motore: non si fanno, perché
  le forme non escono. Se un giorno si faranno le forme di piste, sarà una
  rete «piste» unica con lo sci alpino (proposta di TASK-373, ADR-0317 punto 4).
- L'attività `xc_skiing`, i testi e lo sport nell'app: sono di TASK-375.
- La stagione e cosa si mostra d'estate: scelte dell'utente, da fare in
  TASK-375 per i due sci insieme. OSM non dice se una pista è battuta o
  aperta.

## Esito

La rete delle piste da fondo non disegna forme: nessuna delle 45 richieste
arriva a 0,90, e il cerchio non riesce mai. Nessuna rete nuova e nessun
codice. Lo sci di fondo si registra senza forma con TASK-375.
