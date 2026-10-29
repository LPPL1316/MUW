# TASK-325 — I due repository si tengono uguali da soli

**Stato**: Done — chiuso nella sua PR (LPPL1316/MUW#4), entra in `main` di
MUW col merge; lo specchio porta `main` su `shaperoute` da solo
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
   specchio. Si sblocca da Settings → Billing and plans (un tetto di spesa
   per Actions) o rendendo MUW pubblico (minuti illimitati): scelta
   dell'utente. Fino ad allora i branch si allineano a mano con il bundle
   o dal Mac.
3. **Due `main` con merge da tutte e due le parti** divergono e lo specchio
   si ferma in rosso: è successo tre volte il 2026-10-28, con il team che
   mergiava su `shaperoute` mentre MUW prendeva TASK-324, TASK-326 e
   questa PR. Si unisce a mano in una PR su MUW (come questa). Meglio
   mergiare sempre dallo stesso repository.

## Esito

Chiuso nella sua PR, LPPL1316/MUW#4 (2026-10-29), che unisce in un colpo
solo lo specchio (`tools/mirror_repos.py`, `.github/workflows/mirror.yml`,
undici test), i due `main` divergenti (`shaperoute` fino a `df96f316`,
TASK-312, 321 A, 237 F; MUW fino a `61846764`, TASK-324 e 326) e la
rinumerazione della migrazione del dislivello a `0037` (la 0034 l'ha presa
TASK-312, la 0035 TASK-297 A2, la 0036 TASK-322 A). Col merge il `main` di `shaperoute` diventa un antenato di
quello di MUW e lo specchio lo porta avanti da solo; la PR
rockydalbianco/shaperoute#618 dello stesso branch risulta fusa. Lo
specchio ha già girato dal branch con il token: tre giri utili, poi i
minuti di Actions sono finiti («Aperto», punto 2). Il server e `deploy/`
leggono ancora `shaperoute`: rinominare è un task a parte.
