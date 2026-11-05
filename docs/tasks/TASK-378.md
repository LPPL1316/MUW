# TASK-378 — Gravel e MTB: la bici fuori dall'asfalto

**Stato**: In corso — parte 0: misura delle reti e proposta. Le scelte di
prodotto vanno all'utente una alla volta, prima del codice.
**Fase**: 4 · **Branch**: `docs/TASK-378-0-gravel` (parte 0), poi
`feat/TASK-378-a-gravel-engine-api`, `feat/TASK-378-b-gravel-app` ·
**ADR**: ADR-0322 · numeri dal Coordinatore (2026-11-04) · sessione
dello sport, avviata dal «Coordinatore Sport»

## Obiettivo

Chi va in gravel o in mountain bike riceve un percorso che disegna la forma
**anche su sterrati, carrarecce e sentieri ciclabili**, dove la bici di oggi
scende e spinge. Lo pedala con passo, voce, salvataggio, Feed, Apple Salute,
Health Connect e Strava del suo sport.

È il secondo sport della fase 1 (TASK-376, ADR-0320), dopo il pilota
Escursionismo (TASK-377): file nuovi più una riga per registro, come dice
`docs/sports/COME-AGGIUNGERE.md`. Ogni altro file è una deroga, da scrivere
in `docs/sports/CONDIVISO.md`.

## Contesto

Richiesta dell'utente del 2026-11-04: Gravel/MTB fra gli sport della fase 1.

La bici di oggi (`cycling`, rete bike, ADR-0153 e ADR-0167) pedala già le
`track` di ogni tipo; i `path` solo se `bicycle=designated`, altrimenti li fa
**a piedi con la bici**, a 6 volte il costo. Gravel e MTB cambiano quali vie
si pedalano, non come il motore cerca la forma.

Da leggere: `docs/sports/COME-AGGIUNGERE.md`, `docs/sports/CONDIVISO.md`
(«Le reti»), `docs/sports/README.md` (il banco), `docs/sports/bike.md` (le
misure di base della bici), `docs/sports/gravel.md` (le misure di questo
task), ADR-0153, ADR-0167, ADR-0321 (il pilota).

## Cosa fare

### Parte 0 — misura e proposta (solo documenti)

1. Col banco, un comando per volta, `nice -n 10`, aspettando gli altri banchi
   e le suite: reti di prova con `--loader` (`out/TASK-378/loader.py`), senza
   toccare il motore. Rete e forme del catalogo a 10, 20 e 30 km, prima a
   Trento, poi sulle sei zone per le reti che reggono.
2. Quanto di ogni percorso è sterrato, a piedi con la bici e su strade
   principali (`out/TASK-378/mix.py`, dai controlli del motore).
3. Le misure in `docs/sports/gravel.md`, ADR-0322 in DECISIONS come
   «Proposto».
4. Le domande all'utente, una per volta, con una proposta già pronta:
   1. uno sport o due (Gravel e MTB);
   2. nome ed emoji;
   3. la rete;
   4. le distanze;
   5. il limite `mtb:scale`;
   6. gioco e record personali;
   7. i testi in en/it/de/fr/es;
   8. «ready».
5. Le risposte in una seconda PR di soli documenti: ADR-0322 «Accettato».
   Poi la lista della parte A al Coordinatore, con il numero della
   migrazione.

### Parte A — motore, contratto, API (dopo le scelte, in una sessione sua)

La lista va al Coordinatore dopo le scelte. Sulla ricetta: una rete nuova
in `route_engine/networks/` (o due, se gli sport sono due), un'attività in
`activities/`, il contratto, l'API, la migrazione che allarga i CHECK,
`engine.zip` rifatto.

### Parte B — app

Il profilo in `apps/mobile/src/sports/`, la riga in `settings/sport.ts`, i
testi col sì dell'utente.

## Scelte dell'utente

Da chiedere, una alla volta, dopo le misure.

## Criteri di accettazione

- [x] 0: le misure delle reti sono in `gravel.md`; ADR-0322 è proposto.
- [ ] 0: le scelte dell'utente sono scritte qui, una per una.
- [ ] 0: la lista della parte A è al Coordinatore, con la domanda sul numero
      della migrazione.
- [ ] A: un percorso gravel/MTB sul grafo di prova pedala dove la bici
      spinge; test deterministici; corsa, bici e canoa invariate al banco
      (`compare`).
- [ ] B: lo sport si sceglie, si pedala, si salva e va in Salute; i testi
      sono in cinque lingue.

## File toccati

Parte 0:

```
docs/tasks/TASK-378.md     (nuovo)
docs/sports/gravel.md      (nuovo)
docs/DECISIONS.md          (solo ADR-0322, in fondo)
docs/STATUS.md             (righe proprie)
docs/INDEX.md              (una riga)
```

Lista approvata dal Coordinatore il 2026-11-05. Parti A e B: liste al
Coordinatore dopo le scelte.

## Dove si è

2026-11-05: il Coordinatore ha approvato la lista, e ho misurato col banco
dopo i giri di 377-A, un comando per volta e `nice -n 10`:

- **`gravel`** (`track` fino a grade3, sentieri con la bici ammessa): 54 su
  54, come la bici, e con lo stesso sterrato. Non cambia i percorsi.
- **`mtb`** (ogni `track`, sentieri fino a `mtb:scale` 2): 49 su 54, 24
  buoni; a piedi con la bici dal 4,9% all'1,4% dei km.
- **Provate solo a Trento**: senza strade principali, e l'asfalto che costa
  2 o 4 volte. Non servono.

Le misure sono in `gravel.md`, e ADR-0322 è scritto come proposto.
Prossimo: la prima domanda all'utente, uno sport o due.
