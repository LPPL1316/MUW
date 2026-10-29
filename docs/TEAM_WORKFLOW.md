# TEAM_WORKFLOW — Come si lavora

## Il ciclo, dall'inizio alla fine

```
1. Leggi STATUS.md          → qual è il prossimo task
2. Apri docs/tasks/TASK-XXX.md
3. Crea il branch           → git switch -c feat/TASK-XXX-slug
4. Lavora solo su quel task
5. Test verdi in locale
6. Aggiorna STATUS.md (+ DECISIONS.md se serve)
7. Commit, push, Pull Request
8. Rileggi il diff della tua PR
9. Merge su main, cancella il branch
```

Il passo 8 non è formalità. Il diff mostra cose che nel flusso del lavoro
non si vedono: file toccati per sbaglio, `print` dimenticati, segreti
finiti dentro, modifiche fuori dallo scope del task.

## Branch

```
feat/TASK-011-parametric-shapes
fix/TASK-014-duplicate-nodes
docs/TASK-002-review-documentation
chore/TASK-001-ci-setup
```

Un branch per task. Si cancella dopo il merge: branch vecchi in giro sono
solo confusione.

## Commit

```
TASK-011: add heart parametric curve
TASK-011: resample shape points by arc length
TASK-011: update STATUS
```

Imperativo, in inglese, una riga, prefisso del task. Se serve una
spiegazione lunga va nel corpo del commit o nella PR, non nel titolo.

Commit piccoli e frequenti: servono a te quando qualcosa si rompe e devi
capire dove.

## Pull Request

`main` è protetto: niente push diretti, si passa sempre da una PR.
Il template in `.github/pull_request_template.md` chiede quattro cose:
task di riferimento, cosa cambia, come è stato verificato, cosa resta fuori.

Lavorando da solo la PR sembra un giro a vuoto. Non lo è: è il punto in cui
si rilegge il proprio lavoro con occhi diversi, ed è la cronologia che
permette di capire, tra sei mesi, perché il codice è fatto così.

## Il route-engine ha una verifica in più

Per i task di fase 1 non basta che i test siano verdi: bisogna **generare
un GPX e guardarlo**. Il file entra in `samples/` e nella PR, con la sua
riga in `samples/LOG.md`.

Un test che passa non dice se il cuore sembra un cuore.

I campioni si versionano e non si sovrascrivono (ADR-0014): è così che, a
ogni modifica, puoi rigenerare lo stesso caso e confrontarlo con com'era
prima. Vedi `samples/README.md`.

## Segreti

Mai nel repository, in nessuna forma, nemmeno temporaneamente, nemmeno in
un commit poi corretto: la cronologia di git conserva tutto.

Variabile nuova → in `.env` locale e in `.env.example` con valore fittizio,
nello stesso commit.

## I due repository (TASK-325, ADR-0285)

Dal 2026-10-28 il progetto sta in due posti uguali: `rockydalbianco/shaperoute`
(il primo: il server e il Mac leggono quello) e `LPPL1316/MUW` (la copia
sotto l'utente, dove le sessioni cloud di Claude possono scrivere). Un
flusso in MUW (`.github/workflows/mirror.yml`, `tools/mirror_repos.py`) li
tiene uguali a ogni push su MUW e ogni dieci minuti, nei due versi:

- un branch avanti da una parte viene portato avanti dall'altra; uno nuovo
  viene creato dall'altra parte; uno già fuso in `main` e cancellato da una
  parte viene cancellato anche dall'altra;
- un branch con commit da tutte e due le parti **non si tocca**: il flusso
  finisce rosso e lo nomina, e qualcuno lo unisce a mano da una delle due
  parti. Per non arrivarci: **si mergia sempre dallo stesso repository**
  (MUW, dove lavora Claude), e un branch si cancella dove lo si è aperto;
- niente viene mai forzato; i tag non si copiano.

Serve il segreto `MIRROR_TOKEN` in MUW (Settings → Secrets and variables →
Actions): un token classico di GitHub con gli scope `repo` e `workflow` di
un account che scrive in `shaperoute`. Senza, il flusso non fa niente e lo
scrive.

**`main` di `shaperoute` accetta solo pull request** (regola del
repository del proprietario, quattro controlli obbligatori): lo specchio
non può spingerlo, e quando il `main` di MUW è avanti il giro finisce rosso
con `refused: main` e la risposta del server. Un merge su `shaperoute`
arriva invece in MUW da solo. Per portare il `main` di MUW in `shaperoute`:
un branch fermo **esattamente** al commit di `main` di MUW (per convenzione
`sync/muw-main`, che lo specchio copia di là), una PR su `shaperoute` da
quel branch, fusa con un **merge commit**; il `main` nuovo di `shaperoute`
ha quello di MUW come antenato, e lo specchio porta avanti MUW al giro
dopo. Non si fonde di là un branch qualunque di una PR già fusa in MUW: i
due `main` avrebbero due merge commit diversi e tornerebbero divergenti.
`tasks/TASK-325.md`, «Aperto», punto 4, per le due strade che tolgono il
passaggio a mano.

## Lavorare con Claude Code

- Una sessione = un task. Finito il task, si chiude la sessione.
- Dare il task come riferimento a file, non incollandolo:
  «leggi `docs/tasks/TASK-011.md` ed eseguilo».
- Se durante il lavoro spunta un problema fuori scope: si annota in
  `STATUS.md` sotto **Note** e si apre un task nuovo. Non si risolve
  al volo.
- Se una risposta comincia a girare a vuoto o a riassumere sé stessa, il
  contesto è saturo: si chiude e si riapre dal task file.
- Il codice prodotto si legge prima di accettarlo. Sempre.
