# TASK-398 — «town cat 5000» rosso in CI: l'immagine ubuntu-26.04, non la ricerca

**Stato**: In review · 2026-11-05
**Fase**: 4 · **Branch**: `fix/TASK-398-flaky-cat-search`
**Numeri**: TASK-398, assegnato dal Coordinatore. Nessun ADR: nessun
comportamento del motore cambia.

## Obiettivo

`tests/test_first_placement.py::test_without_first_the_search_is_that_of_before[town cat 5000]`
cadeva in CI con `assert 'd080e87a95000aa5' in ('671bc212a66d021f',)` su
main a `9c617cb5` (run 42062533100, 16:15Z e rilancio 17:18Z) e sulle PR
#811 e #822, che non toccano il motore; main a `95c46c3f` (run 42056773904,
15:37Z), con lo stesso codice (fra i due solo documenti), passava. Bloccava
ogni merge. Trovare la causa e rendere il test stabile senza cambiare quello
che il motore disegna.

## File toccati

- `services/route-engine/tests/test_first_placement.py`
- `docs/tasks/TASK-398.md` (nuovo)
- `docs/STATUS.md` (solo righe nuove)

## Causa

Non è un test instabile: è deterministico su ogni macchina, ma dà un digest
diverso sull'immagine nuova dei runner di GitHub.

- Dalle 16:00Z circa del 2026-11-05 `runs-on: ubuntu-latest` assegna
  **ubuntu-26.04** invece di ubuntu-24.04 (riga «Image:» nel log del job).
- Job `route-engine` di 79 run di `ci.yml` letti: **42 su 42** run con i test
  su 24.04 verdi, **3 su 3** su 26.04 rossi, sempre con `d080e87a95000aa5`
  (main `9c617cb5` due volte, la PR del run 42071713126). Gli altri run su
  26.04 erano di soli documenti e saltano i test (TASK-393).
- Stessi Python (3.11.18) e pacchetti pip nei due run confrontati
  (`numpy 2.4.6`, `networkx 3.6.1`, `shapely 2.2.0`, `osmnx 2.1.1`): cambia
  solo l'immagine, cioè la libreria matematica di sistema (glibc) o la CPU.
  Quale funzione dia l'ultima cifra diversa non è stato isolato: serve una
  26.04 x86_64, che sul Mac non c'è.
- Niente tempo: il budget della ricerca (`optimizer.search`, `go`,
  `rescale`, `polish`) è un numero di tracce (`len(attempts) >= budget`),
  non un orologio. Niente ordine di hash: in locale il caso passa con sette
  `PYTHONHASHSEED` diversi. Il grafo è il paese finto `_town(TRENTO)`, da un
  seme fisso: niente rete.

## Cosa cambia

`BEFORE["town cat 5000"]` accetta i due digest, `671bc212a66d021f` (24.04 e
Mac) e `d080e87a95000aa5` (26.04), come già «town heart 5000»; il commento
dice perché e che «budget» è un conteggio di tracce. `route_engine` non si
tocca: l'impronta del motore resta ferma, nessuna prova same-routes.
`ci.yml` resta su `ubuntu-latest` (scelta del Coordinatore: su 26.04 tutti
gli altri test passano).

## Rischio da guardare (nessuna azione adesso)

Il server gira su un'immagine sua: se un giorno passasse a una versione di
Ubuntu più nuova, lo stesso codice potrebbe disegnare in qualche caso un
percorso diverso di un soffio, come qui il gatto del paese finto. Prima di un
aggiornamento del sistema del server conviene rifare la prova dei nove
percorsi fissi (`tests/test_same_routes.py`) sulla macchina nuova.

## Verifica

- In locale (Mac, Python 3.12, NumPy 2.5.3, NetworkX 3.7): il caso passa
  con `671bc212a66d021f`, anche con sette `PYTHONHASHSEED` diversi.
  `test_first_placement.py` intero: 23 su 24; cade «levico heart 1000»
  (`e1d94c980bc22f34`), differenza del Mac già presente su main e non toccata
  qui: in CI passa su 24.04 e su 26.04.
- CI della PR (su 26.04): verde.

## Criteri di accettazione

- [ ] La CI `route-engine` passa su ubuntu-26.04.
- [x] Nessun file di `route_engine` toccato; impronta del motore invariata.
- [x] Il diff tocca solo i file elencati.
