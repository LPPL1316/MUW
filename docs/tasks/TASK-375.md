# TASK-375 — La categoria «Record only»: sport che si registrano senza forma

**Stato**: Proposto · bozza; nessun codice prima delle risposte alle
domande aperte e dei «File toccati» mandati al Coordinatore
**Fase**: 5 · **Branch**: `docs/TASK-375-record-only` (documenti); il
codice `feat/TASK-375-a-…`
**Dipende da**: nulla. Lo sci alpino (TASK-373, ADR-0317) è il primo sport
che la usa; lo sci di fondo (TASK-372) solo se l'utente lo sceglie così
**ADR**: ADR-0319 (proposto)

## Obiettivo

Uno sport «Record only» si sceglie in MuW come gli altri, ma non ha forme:
«Draw» apre la registrazione libera della giornata (TASK-220) e alla fine
mostra le metriche di quello sport, il percorso sulla mappa e il post nel
Feed. La categoria serve a non riscrivere la stessa cosa per ogni sport
senza forme.

## Scelte dell'utente

- 2026-11-04, domanda 2 di TASK-373: «Prima la categoria». La categoria è
  un task a parte e lo sci alpino è il suo primo sport.
- 2026-11-04, domanda 3: «Sì, separati». Lo sci alpino si chiama «Ski» ⛷️
  (Sci, Ski, Ski, Esquí) ed è uno sport distinto dallo sci di fondo
  (TASK-372).

## Vincoli (dal Coordinatore, 2026-11-04)

- L'impronta del motore resta neutra: «Record only» non pianifica, il
  Route Engine non cambia.
- L'impronta iOS resta 6f8bba4c: niente moduli nativi nuovi, si va con un
  aggiornamento OTA.
- La migrazione dei CHECK è una sola, 0044, per `skiing` e `xc_skiing`;
  se la categoria ne vuole una sua, il numero (0045) si chiede al
  Coordinatore.
- Lo sci di fondo entra anche lui: l'utente di TASK-372 ha scelto «Record
  only» (2026-11-04). Accordo con TASK-372: questo task aggiunge `skiing`
  e `xc_skiing` in un passaggio solo (shared-types, API, migrazione 0044,
  `sport.ts`, testi in tutte le lingue); TASK-372 resta di sola
  documentazione (ADR-0316, niente rete «nordic»). Il nome del fondo,
  proposto «Cross-country ski», si chiede all'utente con i testi.

## Domande aperte (una alla volta)

4. Le metriche e la mappa: discese, km sciati, dislivello, velocità
   massima e media in km/h, impianti usati e piste fatte con il nome
   (dalle linee di OSM); risalite tratteggiate.
5. Dopo: dove c'è la neve buona (proposta: segnalazioni degli sciatori di
   MuW; le previsioni solo con un abbonamento a pagamento) e le recensioni
   dei comprensori (in conflitto con la regola dei soli commenti positivi,
   TASK-213).

## File toccati

Da decidere dopo le risposte; si mandano al Coordinatore prima della prima
PR di codice.

## Criteri di accettazione

- [x] La domanda 3 ha una risposta scritta qui.
- [ ] La domanda 4 ha una risposta scritta qui.
- [ ] I «File toccati» della parte A sono approvati dal Coordinatore.
