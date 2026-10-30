# TASK-337 — Meno note sotto il percorso: due alla volta, le altre dietro «Show more»

**Stato**: Done · 2026-10-29, chiuso nella stessa PR del codice
**Fase**: 4 · **Branch**: `feat/TASK-337-fewer-notes` (il Coordinatore
aveva proposto `fix/TASK-337-fewer-red-notes`: la PR #644 era già aperta
col primo nome, che resta)

## Obiettivo

Sotto il risultato di «Draw» le note del motore («The roads here follow the
shape only roughly.», «388 m runs along main roads, with traffic.»…) sono
al massimo due. Le altre restano raggiungibili con «Show more», così la
mappa sopra resta in vista. Le note di sicurezza non vanno mai dietro
«Show more».

Le parole dell'utente (2026-10-29, con uno screenshot del risultato: cuore
a Levico, due note arancio), così come le ha scritte:

> A VOLETE LE SCRITTE ROSSE AD ESEMPIO QUI LE STRADE SEGGUNO LA FORMA SOLO
> ALL'INCIRCA... ED ALTRE A VOLETE SONO TROPPE MAGARU TIENINE MENO SE
> RISULTANO TROPPE CHE POI NON SI VISUALIZZA PIù L'IMMAGINE... GARZIE

Numero dal Coordinatore lo stesso giorno: TASK-337, nessun ADR nuovo (voce
breve in DECISIONS, aggiunta ad ADR-0048).

## La condizione del Coordinatore (2026-10-29)

Le note che fermano chi corre, cioè quelle di sicurezza o «qui non si
corre», non vanno mai dietro «Show more», con un test che le tiene fra le
prime. Sono le scale, le strade principali col traffico, le gallerie e la
bici a mano (`safety` in `warnings.ts`). Se sono più di due si vedono
tutte. Impronta iOS `83793e26` misurata su una copia pulita della testa.

## Contesto da leggere

- `docs/DECISIONS.md` ADR-0048 (gli avvisi in parole semplici) e ADR-0077
  (un avviso sconosciuto non si nasconde).
- `docs/UI.md`, «Il risultato», il paragrafo «Gli avvisi sono in parole
  semplici».

## Cosa fare

1. `warnings.ts`: `NOTES_AT_FIRST = 2`, `safety` sulle regole di scale,
   strade principali, gallerie e bici a mano, e `shownNotes(notes, all)`:
   nell'ordine di sempre (prima quelle a cui fare attenzione) tutte quelle
   di sicurezza e le prime altre fino a due in tutto; o tutte.
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
- [x] Scale, traffico, gallerie e bici a mano non vanno mai dietro «Show
  more», anche se sono tre (test, condizione del Coordinatore).
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

## Esito

Fatto il 2026-10-29: due note alla volta, «Show more» per le altre, quelle
di sicurezza sempre in vista. Solo JS dell'app (OTA), nessun testo nuovo,
nessuna dipendenza. Impronta iOS misurata su una copia pulita di
`3e1617fe` (`npm ci`, `APP_VARIANT=production`): `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3`,
invariata.
