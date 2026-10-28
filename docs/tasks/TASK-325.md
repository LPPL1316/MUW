# TASK-325 — I due repository si tengono uguali da soli

**Stato**: In corso — codice, test e documenti sul branch; aspetta la PR,
poi il segreto `MIRROR_TOKEN` dall'utente
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
- [ ] Il flusso gira su MUW con `MIRROR_TOKEN` e la prima esecuzione porta
      `main` di MUW (con TASK-324) in `rockydalbianco/shaperoute`.

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

1. **Il segreto `MIRROR_TOKEN`** lo mette l'utente in MUW (Settings →
   Secrets and variables → Actions → New repository secret): un token
   **classico** di GitHub (Settings → Developer settings → Personal access
   tokens → Tokens (classic)) con lo scope `repo`, di un account che
   scrive in `rockydalbianco/shaperoute`. Un token «fine-grained» non va:
   non può coprire un repository di un altro utente. Senza, lo specchio
   non parte: il flusso lo scrive e finisce verde.
2. **Due `main` con merge da tutte e due le parti nello stesso quarto
   d'ora** divergono: il flusso diventa rosso e nomina il branch; qualcuno
   unisce a mano. Con un solo repository dove si mergia (meglio MUW, dove
   lavora Claude) non succede.

## Esito

*(da compilare a fine task)*
