# TASK-275 — Segnalare un commento e bloccare chi l'ha scritto

**Stato**: Done
**Fase**: 4 · **Branch**: `fix/TASK-275-report-comment`

## Obiettivo

Tenendo premuto il commento di un altro, «Report» (i cinque motivi) e
«Block» chi l'ha scritto, come il «…» di un disegno e di un profilo.

## Contesto

Il 2026-10-11 Apple ha risposto alla 1.0.0 (build 5) con «Guideline 2.1 –
Information Needed»: per un account sviluppatore nuovo chiede un video
che mostri anche i meccanismi per segnalare i contenuti degli utenti e
bloccare le persone (Guideline 1.2). Nella build 5 «Report» c'è solo sul
disegno e sul profilo (ADR-0228); un commento si può solo cancellare (se
è proprio o sotto il proprio disegno) e dal commento non si apre il
profilo di chi l'ha scritto. L'API accetta già `POST /reports` con
`kind: "comment"` e rifiuta con 422 il proprio commento. L'utente ha
detto sì il 2026-10-11; numero dal Coordinatore, aggiunta ad ADR-0228.

## Contesto da leggere

- `docs/DECISIONS.md`: ADR-0228, ADR-0175 (commenti)
- `apps/mobile/src/social/DrawingComments.tsx`, `ReportMenu.tsx`

## Cosa fare

1. Un file nuovo, `social/commentChoices.ts`: `useCommentChoices()` con
   l'account e l'API di `FollowsContext`, «Report» (i motivi, poi il
   grazie) e «Block» (chiede prima, dicendo cosa fa) in alert nativi,
   con le parole del «…» (`ReportMenu.tsx`). Null senza account.
2. `DrawingComments.tsx`: tenendo premuto il commento di un altro, un
   alert «Report or block» con «Report», «Block {user}» e, sotto il
   proprio disegno, «Delete». Il proprio commento: «Delete this
   comment?» come prima. Le stesse scelte come azioni di VoiceOver.
3. Dopo un blocco la pagina dei commenti si chiede di nuovo (l'API non dà
   più i suoi) e le sue schede escono da «Feed» (`markBlocked`).
4. Nessun testo nuovo: solo stringhe che l'app ha già nelle cinque lingue.

## Criteri di accettazione

- [x] Il commento di un altro, tenuto premuto, offre «Report», «Block
      {user}» e «Cancel»; «Report» chiede uno dei cinque motivi, manda
      `kind: "comment"` con l'id del commento e dice grazie (test).
- [x] «Block» chiede prima, poi blocca l'autore: i suoi commenti escono
      dal foglio e le sue schede da «Feed» (test).
- [x] Sotto il proprio disegno c'è anche «Delete»; il proprio commento
      offre solo «Delete», mai «Report» (test).
- [x] VoiceOver ha le stesse scelte come azioni (test).
- [x] Un errore dice perché; una sessione finita si chiude (test).
- [x] Nessuna stringa nuova in `i18n/`.

## File toccati

```
apps/mobile/src/social/commentChoices.ts   (nuovo)
apps/mobile/src/social/DrawingComments.tsx
apps/mobile/src/social/DrawingComments.test.tsx
docs/tasks/TASK-275.md
docs/STATUS.md
docs/DECISIONS.md
```

## Fuori scope

- Un pannello per leggere le segnalazioni (ADR-0228: si leggono nel
  database).
- Aprire il profilo di chi ha scritto un commento.
- La build 6 e la risposta ad Apple: le danno il Coordinatore e l'utente
  dopo il merge.

## Esito

Fatto il 2026-10-11: `commentChoices.ts` nuovo, `DrawingComments.tsx` con
il menu tenendo premuto, cinque test nuovi in `DrawingComments.test.tsx`.
Nessun testo nuovo, nessun cambio al server. Entra nella build 6, quella
per rispondere ad Apple.
