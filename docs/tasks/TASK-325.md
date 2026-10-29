# TASK-325 — I due repository si tengono uguali da soli

**Stato**: Done — fuso in `main` di MUW (LPPL1316/MUW#4, `182800a3`,
2026-10-29). Il `main` di `shaperoute` prende quello di MUW solo con una PR
là («Aperto», punto 4): il primo è pronto in `sync/muw-main`
**Fase**: 4 · **Branch**: `chore/TASK-325-mirror-repos`
**ADR**: ADR-0285 · **Migrazione**: nessuna · Solo strumenti e CI
(nessuna dipendenza nuova). Numeri di task e di ADR presi senza
coordinatore (nessuna sessione raggiungibile): i primi liberi dopo
TASK-324 e ADR-0284 al 2026-10-28

## Obiettivo

Il repository `LPPL1316/MUW` (creato il 2026-10-28 dall'utente, con tutta
la storia e i branch di `rockydalbianco/shaperoute`, dove l'app GitHub di
Claude non si può installare) e `rockydalbianco/shaperoute` restano uguali
da soli, nei due versi: un push su uno arriva sull'altro.

Richiesta dell'utente del 2026-10-28: «fai sì che i due repository si
parlano a vicenda e si aggiornino in automatico entrambi in base alle
modifiche di uno e dell'altro».

## Contesto da leggere

- `docs/DECISIONS.md` ADR-0285;
- `docs/TEAM_WORKFLOW.md` «I due repository».

## Cosa fare

1. `tools/mirror_repos.py`: dati due remoti, porta avanti i branch
   indietro da una parte o dall'altra, crea i nuovi, cancella quelli già
   fusi in `main` e spariti dall'altra parte, lascia stare e segnala quelli
   con commit da tutte e due le parti. Mai un push forzato. Test con due
   repository nudi su disco (`tools/test_mirror_repos.py`), in CI con
   `pytest tools`.
2. `.github/workflows/mirror.yml`: lo esegue a ogni push su MUW e ogni
   dieci minuti, solo sotto `LPPL1316` (il file arriva anche nell'altro
   repository, dove non fa niente). Senza il segreto non fa niente e lo
   dice.
3. Documenti.

## Criteri di accettazione

- [x] `python3 tools/mirror_repos.py A B` porta `main` e i branch avanti
      da una parte all'altra, crea i nuovi, cancella i fusi, non tocca i
      divergenti e torna 1 (dieci test).
- [x] `ruff`, `black` e `pytest tools` verdi.
- [x] Il flusso gira su MUW con `MIRROR_TOKEN` (2026-10-28, lanciato a mano
      dal branch): ha creato su `shaperoute` i branch nuovi di MUW, portato
      su MUW due branch del team, cancellato su MUW 13 branch già fusi e
      cancellati di là, e si è fermato, come deve, sui due `main`
      divergenti; con lo scope `workflow` passa anche il branch con il
      file di flusso. `main` arriva su `shaperoute` col merge di questa PR.

## File toccati

```
tools/mirror_repos.py               (nuovo)
tools/test_mirror_repos.py          (nuovo)
.github/workflows/mirror.yml        (nuovo)
docs/tasks/TASK-325.md              (nuovo)
docs/DECISIONS.md                   (ADR-0285 in fondo)
docs/STATUS.md                      (una riga)
docs/TEAM_WORKFLOW.md               (sezione «I due repository»)
```

## Fuori scope

- Rinominare `shaperoute` in `MUW` nei documenti, nel server e in
  `deploy/`: il server Hetzner legge ancora `rockydalbianco/shaperoute`.
- I tag (non ce ne sono) e le impostazioni dei repository (protezioni,
  segreti, collaboratori): non si copiano.
- Un merge automatico dei branch divergenti: si fa a mano, da una parte o
  dall'altra.

## Aperto

1. **Lo scope `workflow` del token**: il primo giro vero ha rifiutato il
   branch con il file di flusso («refusing to allow a Personal Access
   Token to create or update workflow … without `workflow` scope»);
   l'utente lo ha aggiunto il 2026-10-28 e da allora passa. Se il token
   viene rifatto, servono `repo` **e** `workflow`.
2. **I minuti di GitHub Actions**: il 2026-10-28 sera MUW (repository
   privato) ha esaurito i minuti del piano gratuito («The job was not
   started because recent account payments have failed or your spending
   limit needs to be increased»): nessun lavoro parte, né la CI né lo
   specchio. **Risolto il 2026-10-29**: l'utente ha reso MUW pubblico
   (minuti illimitati; il codice era già pubblico in `shaperoute`).
3. **Due `main` con merge da tutte e due le parti** divergono e lo specchio
   si ferma in rosso: è successo tre volte il 2026-10-28, con il team che
   mergiava su `shaperoute` mentre MUW prendeva TASK-324, TASK-326 e
   questa PR. Si unisce a mano in una PR su MUW (come questa). Meglio
   mergiare sempre dallo stesso repository.
4. **Il `main` di `shaperoute` accetta solo pull request.** Una regola del
   repository del proprietario («GH013: Changes must be made through a
   pull request», quattro controlli obbligatori) rifiuta il push dello
   specchio su `main` (primo giro da `main` di MUW, 2026-10-29 09:10:
   `refused: main`). L'altro verso funziona: un merge su `shaperoute`
   arriva in MUW da solo. Per portare il `main` di MUW in `shaperoute`
   serve una PR là da un branch fermo **esattamente** al commit di `main`
   di MUW, fusa con un merge commit: il `main` nuovo di `shaperoute` ha
   quello di MUW come antenato e lo specchio porta avanti MUW al giro dopo
   (un branch qualunque della PR, fuso di là, darebbe due merge commit
   diversi e i `main` tornerebbero divergenti). Il primo è pronto:
   `sync/muw-main` su `shaperoute` (= `182800a3`), da fondere con la PR
   <https://github.com/rockydalbianco/shaperoute/compare/main...sync/muw-main>;
   le sessioni cloud non possono aprirla (403). Finché il `main` di
   `shaperoute` è indietro, il giro ogni dieci minuti è rosso su quella
   riga sola. Due strade per non farlo a mano ogni volta, **scelta
   dell'utente**: il proprietario mette l'utente `LPPL1316` nella lista di
   bypass della regola di `main` (allora lo specchio spinge `main` da
   solo), oppure lo specchio tiene aggiornato `sync/muw-main` da sé e
   qualcuno apre la PR (un task nuovo, piccolo: `tools/mirror_repos.py`,
   un test).

## Esito

Fuso in `main` di MUW il 2026-10-29 (LPPL1316/MUW#4, merge commit
`182800a3`), con la CI verde su `1852942f` (api, mobile, route-engine, ai,
docker, site). La PR unisce in un colpo solo lo specchio
(`tools/mirror_repos.py`, `.github/workflows/mirror.yml`, undici test), i
due `main` divergenti (`shaperoute` fino a `5d7a5eda`: TASK-312 A e B,
321 A, 237 F, 320 B, 322 A; MUW fino a `3a34d621`: TASK-324, 326, 297 A2) e
la rinumerazione della migrazione del dislivello a `0037` (la 0034 l'ha
presa TASK-312, la 0035 TASK-297 A2, la 0036 TASK-322 A), resa idempotente
con `ADD COLUMN IF NOT EXISTS` perché la stessa colonna sta nei due `main`
con altri nomi (segnalazione di un'altra sessione; `DATABASE.md`). Lo
specchio ha girato dal branch con il token: ha portato i branch nei due
versi e cancellato quelli fusi; dal `main` di MUW il push su `main` di
`shaperoute` è rifiutato dalla regola del repository («Aperto», punto 4):
`main` di MUW aspetta in `sync/muw-main` la PR dell'utente su
`shaperoute`. Il server e `deploy/` leggono ancora `shaperoute`:
rinominare è un task a parte.
