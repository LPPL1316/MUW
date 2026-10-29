# TASK-337 — Meno note sotto il percorso: due alla volta, le altre dietro «Show more»

**Stato**: Done · 2026-10-29, chiuso nella stessa PR del codice
**Fase**: 4 · **Branch**: `feat/TASK-337-fewer-notes`

## Obiettivo

Sotto il risultato di «Draw» le note del motore («The roads here follow the
shape only roughly.», «388 m runs along main roads, with traffic.»…) sono
al massimo due. Le altre restano raggiungibili con «Show more», così la
mappa sopra resta in vista.

Richiesta dell'utente del 2026-10-29, con uno screenshot del risultato
(cuore a Levico, due note arancio): «a volte le scritte rosse… sono troppe,
magari tienine meno se risultano troppe, che poi non si visualizza più
l'immagine». Numero dal Coordinatore lo stesso giorno: TASK-337, nessun ADR
nuovo (aggiunta ad ADR-0048).

## Contesto da leggere

- `docs/DECISIONS.md` ADR-0048 (gli avvisi in parole semplici) e ADR-0077
  (un avviso sconosciuto non si nasconde).
- `docs/UI.md`, «Il risultato», il paragrafo «Gli avvisi sono in parole
  semplici».

## Cosa fare

1. `warnings.ts`: `NOTES_AT_FIRST = 2` e `shownNotes(notes, all)`, le prime
   due nell'ordine di sempre (prima quelle a cui fare attenzione) o tutte.
2. `RoutePanel.tsx`: le note in un componente `Notes`; sotto le prime due,
   se ce ne sono altre, una riga discreta «Show more» (testo già tradotto in
   tutte le lingue) che le apre. Aperte valgono per quel percorso: un altro
   percorso, o l'altro fra A e B, riparte da due.
3. La riga «The shape does not fit there: this is the nearest place.» (la
   forma spostata a mano sull'acqua, TASK-238) resta fuori dal conto: è la
   risposta a un gesto dell'utente. Fuori dal conto anche le righe con un
   pulsante («Try 8 km», «Lift the pen»).
4. Test, documenti.

## Criteri di accettazione

- [x] Con più di due note se ne vedono due, prima quelle a cui fare
  attenzione, e «Show more» (test).
- [x] «Show more» mostra tutte le altre e se ne va (test).
- [x] Con due note o meno nessun «Show more» (test).
- [x] Un altro percorso, o l'altro fra A e B, mostra di nuovo le prime due
  (test).
- [x] Nessun testo nuovo: in italiano «Mostra altro» (test).
- [x] Nessuna nota sparisce: tutte raggiungibili (ADR-0077).

## File toccati

- `apps/mobile/src/route/warnings.ts`
- `apps/mobile/src/route/warnings.test.ts`
- `apps/mobile/src/route/RoutePanel.tsx`
- `apps/mobile/src/route/RoutePanelNotes.test.tsx` (nuovo)
- `docs/tasks/TASK-337.md` (nuovo)
- `docs/DECISIONS.md` (aggiunta ad ADR-0048)
- `docs/UI.md` (paragrafo degli avvisi in «Il risultato»)
- `docs/STATUS.md`

## Fuori dal task

- Quali note contano di più fra quelle a cui fare attenzione: l'ordine
  resta quello del motore. Se l'utente preferisce che le scale o il
  traffico vengano prima di «forma poco fedele» (la somiglianza è già nelle
  tessere A · B), è un ritocco a `toNotes`.

## Esito

Fatto il 2026-10-29: due note alla volta, «Show more» per le altre. Solo JS
dell'app (OTA), nessun testo nuovo, nessuna dipendenza, impronta iOS
invariata (nessun file nativo toccato).
