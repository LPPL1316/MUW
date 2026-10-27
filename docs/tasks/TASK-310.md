# TASK-310 — La CI rossa per pytest 9.2: versione fermata sotto la 9.2

**Stato**: In corso
**Fase**: 4 · **Branch**: `chore/TASK-310-pin-pytest`
**ADR**: ADR-0270

## Obiettivo

Riportare verde la CI di `main` e di tutte le PR aperte, rosse dal
2026-10-27 nei job `route-engine` e `api` anche quando non toccano il
motore né l'API.

## Contesto

La CI installa le dipendenze di sviluppo con `pip install -e ".[dev]"`, e
`pytest` era dichiarato `pytest>=8` in `services/route-engine`,
`services/api` e `services/ai`. L'ultima `main` verde (`0bfc07c0`) aveva
`pytest-9.1.1`; quella rossa (`a6cab3b0`) ha preso `pytest-9.2.0`, che
rifiuta `pytest.approx()` su strutture annidate:

```
TypeError: pytest.approx() does not support nested data structures: (-0.5, 1) at index 0
```

Cadono, fra gli altri, `tests/test_outline.py::test_a_path_is_drawn_as_it_is`
e `tests/test_pieces.py` nel motore, `tests/test_paddling_near.py` e
`tests/test_paddling_pieces.py` nell'API: confrontano liste di coppie di
coordinate con un solo `approx`.

## Cosa fare

1. In `services/route-engine/pyproject.toml`, `services/api/pyproject.toml`
   e `services/ai/pyproject.toml`: `pytest>=8,<9.2`. Nessuna dipendenza
   nuova, solo un tetto a quella che c'è.
2. CI verde su questa PR.

## Criteri di accettazione

- [ ] I cinque job della CI verdi su questa PR.
- [ ] Il diff tocca solo «File toccati».

## File toccati

```
services/route-engine/pyproject.toml   (pytest>=8,<9.2)
services/api/pyproject.toml            (pytest>=8,<9.2)
services/ai/pyproject.toml             (pytest>=8,<9.2)
docs/tasks/TASK-310.md                 (nuovo)
docs/DECISIONS.md                      (ADR-0270 in fondo)
docs/STATUS.md                         (una voce in «Completato»)
```

## Fuori scope

- Riscrivere i test con un `approx` per elemento (o `numpy.testing`), così
  che il tetto si possa togliere: un seguito, da aprire con un numero suo.

## Esito

*(al merge)*
