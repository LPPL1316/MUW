# TASK-387 — Le app vecchie non ricevono le attività che non sanno leggere

**Stato**: In lavorazione · 2026-11-05
**Fase**: 4 · **Branch**: `feat/TASK-387-reads-guard`
**Numeri**: TASK-387 e ADR-0328, assegnati dal Coordinatore. Richiesta
dell'utente del 2026-11-04: «sì protezione».

## Obiettivo

Una guardia sul server: una build dell'app che non sa leggere un'attività
più nuova (il nuoto di TASK-323, la camminata di TASK-371, lo sci e il fondo
di TASK-375, i post senza traccia di TASK-385) non la riceve mai, in nessuna
lista. Il nuoto in acque libere (#765) aspetta questa guardia sul server e
l'app che manda l'header in produzione; camminata e sci contano su di essa.

## Il disegno (scelto prima del task, dettagli decisi dall'agente)

- L'app manda un header, `X-MuW-Reads`: la lista, separata da virgole, dei
  tipi in più che sa mostrare. Valori: `swimming`, `walking`, `skiing`,
  `xc_skiing`, `trackless` (una corsa o un post senza traccia).
- Il server toglie da ogni lista che risponde gli elementi la cui attività,
  o l'assenza di traccia, l'header non dichiara.
- Nessun header: una build vecchia, che riceve solo corsa, bici e pagaia.
- L'app di oggi (`apps/mobile`) manda tutto quello che legge oggi:
  `swimming,walking,skiing,xc_skiing`. Non `trackless`: nessuna schermata di
  oggi sa mostrare un post senza linea.
- Valori sconosciuti ignorati; nome e valori senza maiuscole/minuscole.
- La tolleranza dell'app per le attività sconosciute (TASK-375 B0, #749)
  resta la seconda linea di difesa.

Il perché e le alternative: `DECISIONS.md`, ADR-0328.

## Dove agisce

| Richiesta | Cosa succede a un elemento illeggibile |
|---|---|
| `GET /feed` (All e Following) | fuori dalla pagina |
| `GET /search/drawings` | fuori |
| `GET /users/{id}/drawings`, `GET /me/drawings` | fuori |
| `GET /drawings/{id}` | 404, come un disegno che non c'è (ADR-0327, punto 3) |
| `GET /contests/current`, `GET /contests`, `GET /contests/{id}/entries` | fuori da `top` e dalla galleria, i posti restano quelli veri; il vincitore resta con `drawing: null` |
| `GET /group-runs`, `GET /users/{id}/group-runs` | fuori; `GET /group-runs/{id}` 404 |
| `GET /conversations/{id}/messages` | il messaggio resta: il disegno diventa «[Drawing]» davanti al testo, come per un'app senza allegati; `GET /messages/{id}/drawing` 404 |
| `GET /me/favorites`, `GET /me/activities` | fuori |
| `GET /users/{id}/photos` | le foto di un disegno illeggibile fuori |
| `GET /notifications` | le voci su un disegno illeggibile fuori |

Fuori per scelta (ADR-0328): `/muw-routes`, `/style`, il gioco, reazioni e
commenti, le push, i conteggi del profilo.

## Criteri di accettazione

- [ ] `services/api/shaperoute_api/reads.py`: header letto senza
      maiuscole/minuscole, valori sconosciuti e spazi ignorati, più righe
      dell'header unite; nessun header = corsa, bici, pagaia.
- [ ] Ogni richiesta della tabella ha un test deterministico con e senza
      header (`tests/test_reads_lists.py`), e il caso `trackless` ha il suo
      test sul frammento SQL e sul filtro in Python.
- [ ] Il frammento SQL nasce da una lista fissa, mai dal testo dell'header.
- [ ] L'app manda `X-MuW-Reads: swimming,walking,skiing,xc_skiing` in ogni
      richiesta di `ask` (`src/api/reads.test.ts`, `accounts.test.ts`).
- [ ] `packages/shared-types/fixtures/reads.json` è lo stesso per i due lati
      (un test per lato).
- [ ] Test dei file toccati, `ruff`, `black`, `tsc` verdi in locale; CI verde.

## File toccati

In attesa dell'ok del Coordinatore (mandati il 2026-11-05).

```
docs/tasks/TASK-387.md                              (nuovo)
docs/DECISIONS.md                                   (ADR-0328, righe aggiunte)
docs/STATUS.md                                      (righe aggiunte)
docs/API.md                                         (un paragrafo)
docs/INDEX.md                                       (una riga)
packages/shared-types/fixtures/reads.json           (nuovo)
services/api/shaperoute_api/reads.py                (nuovo)
services/api/shaperoute_api/feed.py
services/api/shaperoute_api/drawing_search.py
services/api/shaperoute_api/drawings.py             (dopo la #781 di TASK-390)
services/api/shaperoute_api/contests.py
services/api/shaperoute_api/contest_entries.py
services/api/shaperoute_api/group_runs.py
services/api/shaperoute_api/messages.py
services/api/shaperoute_api/favorites.py
services/api/shaperoute_api/activities.py
services/api/shaperoute_api/user_photos.py
services/api/shaperoute_api/notification_list.py
services/api/tests/test_reads.py                    (nuovo)
services/api/tests/test_reads_lists.py              (nuovo)
services/api/tests/test_record_only.py              (una riga, di TASK-375)
apps/mobile/src/api/reads.ts                        (nuovo)
apps/mobile/src/api/reads.test.ts                   (nuovo)
apps/mobile/src/api/accounts.ts
apps/mobile/src/api/accounts.test.ts
```

## Dopo il merge (del Coordinatore, col sì dell'utente)

Il server aggiornato da `main` (nessuna migrazione) e un OTA di produzione
con l'header. L'ordine non rompe niente (ADR-0328). Poi la #765 del nuoto
può andare avanti.
