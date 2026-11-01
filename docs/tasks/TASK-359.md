# TASK-359 — Niente più conflitti nei documenti che si aggiungono soltanto

**Stato**: Done — chiuso nella stessa PR
**Fase**: 4 · **Branch**: `chore/TASK-359-docs-union-merge` · numero dal
Coordinatore (2026-10-30)

## Obiettivo

`docs/STATUS.md`, `DECISIONS.md` e `INDEX.md` crescono solo per aggiunta.
Con molte PR aperte ogni merge mette le altre in conflitto proprio lì: ognuna
si riallinea e la CI, che dura 25 minuti, riparte. Il 2026-10-30 è successo a
quasi ogni merge.

## Cosa cambia

In `.gitattributes` quei tre file hanno `merge=union`: quando due rami
aggiungono righe nello stesso punto, git le tiene tutte e due.

## File toccati

```
.gitattributes
docs/tasks/TASK-359.md
docs/STATUS.md
```

## Criteri di accettazione

- [x] Prova locale: due rami che aggiungono una riga alla fine dello stesso
      file si uniscono senza conflitto, con tutte e due le righe.
- [ ] Da vedere sul primo merge dopo questa PR: se GitHub applica la regola
      anche nelle sue fusioni. Se non lo fa, la regola serve comunque ai
      merge locali.

## Rischio

Il rischio è una riga fuori posto o doppia, mai una riga persa: `union` non
segnala i conflitti veri. Vale solo per questi tre file, dove non si riscrive.

## Esito

In prova dal 2026-10-30. Una modifica di una riga esistente fatta da due rami
tiene entrambe le versioni: chi riscrive una riga deve rileggere il risultato.
