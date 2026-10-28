# TASK-326 — Il passo medio nella riga dei fatti dei post del «Feed»

**Stato**: Done — chiuso nel suo branch, entra in `main` con la PR (dal
Coordinatore, in coda); poi su `preview` (il Coordinatore pubblica)
**Fase**: 4 · **Branch**: `claude/sweet-carson-vi9ekn` (sessione cloud:
il nome lo impone l'ambiente, non `feat/TASK-326-…`)
**ADR**: aggiunta ad ADR-0207 · **Solo app**, nessun testo da tradurre,
nessuna dipendenza, l'impronta iOS non cambia

## Obiettivo

Ogni scheda del «Feed» dice anche il **passo medio** della corsa, in fondo
alla riga dei fatti: «Star · 4.0 km · 19 min · 4:45 /km».

## Contesto

Richiesta dell'utente del 2026-10-26: «nella sezione feed quando viene
caricato un post bisogna aggiungere anche il passo medio come dato».
Numero: primo libero il 2026-10-29 (in `main` di `LPPL1316/MUW` e nei
branch remoti si arriva a TASK-325), preso senza Coordinatore
raggiungibile dalla sessione cloud; da confermare con lui (`AGENTI.md`,
punto 4). Il lavoro è del 2026-10-26: era TASK-305, poi TASK-311 e
TASK-317, tutti dati nel frattempo ad altro; rinumerato prima della PR.
La PR va su `LPPL1316/MUW` (richiesta dell'utente del 2026-10-29): la
sessione non ha il permesso di scrittura su `rockydalbianco/shaperoute`.

La riga dei fatti è `postFacts` in `apps/mobile/src/feed/FeedPost.tsx`
(TASK-156, 118, 182, 228): cosa disegna, distanza, durata. Il passo come
lo scrive l'app c'è già: `paceLabel` (`units/format.ts`, TASK-182) e
`paddlePaceLabel` (`navigation/paddle.ts`, TASK-251), usati da «My
activities» (`runFacts`) e dal post per Strava (`share/postRun.ts`).

## Contesto da leggere

- `apps/mobile/src/feed/FeedPost.tsx` (`postFacts`)
- `apps/mobile/src/feed/feedPosts.ts` (un disegno di un iscritto come scheda)
- `apps/mobile/src/activities/activityText.ts` (`runFacts`: lo stesso passo)

## Cosa fare

1. `postFacts` aggiunge in fondo il passo medio, come lo scrive «My
   activities»: corsa e bici al km (con «Miles» al miglio, «8:54 /mi»),
   canoa e paddle il tempo di 500 m («6:00 /500 m», ADR-0215). Sotto i
   100 m (`MIN_PACE_M`) nessun passo, come altrove.
2. Il passo di un disegno pubblicato si calcola dai **secondi** della
   corsa (`duration_s`), non dai minuti arrotondati che la riga mostra;
   un esempio ha solo i minuti e usa quelli.
3. VoiceOver legge la stessa riga, quindi anche il passo: nessun testo
   nuovo.

## Criteri di accettazione

- [x] La scheda di un esempio e quella di un iscritto mostrano il passo
      medio dopo la durata, in km e in miglia, e si riscrive quando
      «Settings» cambia le unità.
- [x] In canoa il passo è di 500 m; in bici al km, come «My activities».
- [x] Il passo di un iscritto viene dai secondi (5000 m in 25:29 → «5:06
      /km», non «5:00»); una corsa sotto i 100 m non ha passo.
- [x] Test aggiornati e nuovi verdi; `tsc`, `expo lint`, `prettier`
      puliti.

## Come provarlo

`cd apps/mobile && npx jest src/feed src/screens/FeedScreenPosts
src/units/cardsInMiles src/i18n/LastTextsItalian __tests__/AppFeed`. Sul
telefono: «Feed», la riga sotto il titolo di ogni scheda.

## File toccati

```
apps/mobile/src/feed/FeedPost.tsx                  (postFacts)
apps/mobile/src/feed/FeedPost.test.tsx             (le righe attese)
apps/mobile/src/feed/feedPosts.test.ts             (le righe attese, un test nuovo)
apps/mobile/src/screens/FeedScreenPosts.test.tsx   (le righe attese)
apps/mobile/src/units/cardsInMiles.test.tsx        (le righe attese)
apps/mobile/src/i18n/LastTextsItalian.test.tsx     (la riga attesa)
apps/mobile/__tests__/AppFeedDrawing.test.tsx      (la riga attesa)
apps/mobile/__tests__/AppFeedPaddle.test.tsx       (la riga attesa)
docs/tasks/TASK-326.md                             (nuovo)
docs/DECISIONS.md                                  (aggiunta ad ADR-0207, in fondo)
docs/STATUS.md                                     (righe nuove)
```

`docs/UI.md` («Feed») **non è toccato**: lo elenca TASK-309 parte B, in
lavorazione. Le tre righe d'esempio della scheda («Star · 4.0 km · 19
min», «Horse · 19.2 km · 1 h 41 min», «Paddle · Heart · 2.0 km · 26 min»)
vanno completate col passo («· 4:45 /km», «· 5:16 /km», «· 6:30 /500 m»)
dopo il merge di TASK-309 B, o da TASK-309 B stesso se il Coordinatore lo
preferisce. I due test dell'app intera (`AppFeedDrawing`, `AppFeedPaddle`)
sono fra quelli che TASK-309 B potrebbe toccare: qui cambia una riga
ciascuno, lontana dal conto delle richieste. `FeedPost.tsx` lo ha
cambiato anche TASK-315 (le foto nella scheda), già in `main`: qui cambia
solo `postFacts`, e il cambio si è applicato senza conflitti.

## Fuori scope

- Il passo nella scheda di un disegno aperto (`social/DrawingCard.tsx`,
  che mostra solo i km) e nella griglia del profilo.
- La velocità in km/h per la bici al posto del passo: «My activities» e
  il post scrivono il passo al km (ADR-0215, aggiornamento parte C); una
  scelta dell'utente, se la vuole.

## Esito

La riga dei fatti di ogni post del «Feed» finisce col passo medio, nelle
unità dell'app; canoa al tempo di 500 m. 2026-10-26.
