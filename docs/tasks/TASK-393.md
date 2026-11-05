# TASK-393 — La CI salta i test sulle PR di soli documenti

**Stato**: In lavorazione · 2026-11-05
**Fase**: 4 · **Branch**: `chore/TASK-393-ci-skip-docs-only`
**Numeri**: TASK-393 e ADR-0331, assegnati dal Coordinatore. Seguito di
TASK-248 e TASK-349 (i tempi dei job).

## Obiettivo

Una PR che cambia solo documenti finisce la CI in pochi secondi, verde, con
gli stessi check obbligatori; un push nuovo su una PR cancella il run vecchio
della stessa PR. Per le PR di codice e per `main` non cambia niente.

## Contesto

Problema visto dall'utente il 2026-11-05: `ci.yml` fa girare route-engine,
api, ai, mobile e docker su ogni PR, anche su quelle di soli `docs/`
(chiusure, righe di STATUS). Il job `api` dura 25–30 minuti; con 8–11 run
insieme la coda delle unioni si ferma per un'ora. I run delle head vecchie
dello stesso branch continuano fino in fondo.

Il ruleset «protect main» (`gh api repos/rockydalbianco/shaperoute/rules/branches/main`;
la protezione classica non c'è, 404) chiede quattro check: `route-engine`,
`mobile`, `api`, `ai`. Un filtro `paths` in `on:` non farebbe partire il
workflow e i quattro check resterebbero «Expected» per sempre.

## File toccati

```
.github/workflows/ci.yml
.github/workflows/site.yml
tools/ci_changes.py
tools/test_ci_changes.py
docs/tasks/TASK-393.md
docs/TESTING.md
docs/DECISIONS.md
docs/STATUS.md
```

## Cosa cambia

- `tools/ci_changes.py`, solo libreria standard: sul merge commit della PR
  (checkout con `fetch-depth: 2`) elenca i percorsi che cambiano rispetto al
  primo genitore, cioè `main` (`git diff --name-only --no-renames -z`), e
  scrive `code=false` in `$GITHUB_OUTPUT` solo se sono tutti documenti. Nel
  dubbio `code=true`: nessun merge commit, git che fallisce, nessun file. Su
  un push (`main`) sempre `code=true`.
- **Documento** vuol dire: ogni file di `docs/`, e un `.md` fuori da
  `apps/`, `packages/`, `services/`, `tools/`, `site/`, `deploy/` (il
  `README.md` e il `CLAUDE.md` della radice, `samples/*.md`,
  `catalog/README.md`, il modello delle PR). Dentro quelle cartelle un `.md`
  è codice: prettier controlla `apps/` e `packages/` (`format:check`),
  `engine.zip` prende ogni file del pacchetto `route_engine`. Le fixture, la
  privacy del sito e i file di `packages/` sono codice.
- `ci.yml`: in ogni job, dopo il checkout, il passo `Changes` (id
  `changes`); ogni passo seguente ha `if: steps.changes.outputs.code ==
  'true'` (i due `Log` di docker `always() && …`). Nomi dei job invariati.
  Se `Changes` fallisce il job è rosso, mai verde senza test.
- `concurrency` in `ci.yml` e `site.yml`: gruppo `ci-<ref>` / `site-<ref>`
  per le PR, `cancel-in-progress`; per un push su `main` il gruppo è l'id
  del run, così nessun run di `main` aspetta o viene cancellato. I gruppi
  valgono per tutto il repository: per questo due prefissi.
- `site.yml` non salta niente: ha già i suoi `paths` («site» non è
  obbligatorio) e i suoi test leggono `docs/DEPLOY.md`, che lì conta come
  codice. Una PR che tocca `site/` fa girare «site» come prima.
- `mirror.yml` invariato: gira solo in `LPPL1316/MUW`, sui push e ogni dieci
  minuti, non sulle PR; ha già un suo gruppo `mirror` senza cancellazione,
  e cancellare uno specchio a metà lascerebbe i branch indietro.

## Criteri di accettazione

- [ ] Una PR di soli documenti: i quattro check obbligatori e `docker`
      verdi in meno di un minuto ciascuno, i test saltati (run di prova
      linkato nella PR).
- [ ] Una PR di codice: gli stessi passi di prima (il run della PR stessa).
- [ ] Un push nuovo su una PR cancella il run ancora in corso.
- [ ] `tools/test_ci_changes.py` verde in CI (job route-engine, passo
      «Tools»).

## Fuori scope

- Saltare solo alcuni job a seconda della cartella (per esempio `api` su
  una PR di sola app): oggi ogni PR di codice fa girare tutto, e resta così.
- Cambiare i check obbligatori del ruleset.

## Come si prova

La PR stessa tocca codice: il suo run è quello completo. Per il run di soli
documenti col workflow nuovo serve una PR il cui merge commit abbia il
`ci.yml` nuovo e un diff di soli documenti: una PR di prova da un branch
temporaneo verso un altro branch temporaneo (mai `main`), il secondo con
quel branch aggiunto a `on.pull_request.branches`. Poi la PR si chiude e i
due branch si cancellano.
