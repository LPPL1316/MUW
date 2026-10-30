# INDEX — Cosa leggere, e quando

Scopo di questo file: **evitare che si carichi documentazione inutile**.
Trova la riga che descrive il tuo task, leggi solo quei documenti.

## Regola generale

| Sempre | Mai "per sicurezza" |
|---|---|
| `CLAUDE.md`, `STATUS.md`, il task file | tutto il resto di `docs/` |

## Instradamento per tipo di task

| Sto lavorando su… | Leggi |
|---|---|
| Installare tutto e partire da zero | `SETUP.md` |
| Geometria delle forme (circle, heart, star) | `ROUTE_ENGINE.md` §2 |
| Proiezione forma → coordinate geografiche | `ROUTE_ENGINE.md` §3 |
| Snapping alla rete stradale, routing | `ROUTE_ENGINE.md` §4, `MAPS.md` |
| Ottimizzazione e metrica di somiglianza | `ROUTE_ENGINE.md` §5 |
| Validazione distanza / percorribilità | `ROUTE_ENGINE.md` §6, `TESTING.md` |
| Guardare o confrontare percorsi generati | `../samples/README.md` |
| Export GPX o wearable | `GPX.md` |
| Endpoint, contratti REST, validazione input | `API.md`, `ARCHITECTURE.md` §3 |
| Parole della forma lette dall'AI, Ollama | `AI.md` |
| Schermate, mappa, interazione utente | `UI.md`, `PRODUCT.md` |
| Modello dati, migrazioni, PostGIS | `DATABASE.md` |
| Scelta di libreria, provider, formato | `DECISIONS.md` |
| Struttura cartelle, confini tra moduli | `ARCHITECTURE.md` |
| Test, fixture, criteri di accettazione | `TESTING.md` |
| Il sito web, il merch, le magliette | `SITO.md` |
| Branch, PR, review, rilasci | `TEAM_WORKFLOW.md` |
| Pubblicità, account AdMob, pagamenti | `PUBBLICITA.md`, `DECISIONS.md` ADR-0198 |
| Il gioco delle forme, «Play», squadre e sfide | `GIOCO.md`, `tasks/TASK-296.md` |
| Il primo concorso, la scheda nel Feed, il regolamento | `CONCORSI.md`, `tasks/TASK-299.md` |
| Le sfide del mese: il tema, l'iscrizione, la galleria, l'archivio | `CONCORSI.md`, `tasks/TASK-343.md`, `DECISIONS.md` ADR-0296 e ADR-0260 |
| I badge sul profilo (primo disegno, 10 disegni, 30 km) | `tasks/TASK-341.md`, `DECISIONS.md` ADR-0294 e ADR-0284 |
| Le corse di gruppo, «Group runs», «I'm going» | `EVENTI.md`, `tasks/TASK-309.md` |
| Attività da altre app (GPX, TCX, FIT), post di sole foto, «Imported» | `IMPORTAZIONI.md`, `tasks/TASK-312.md` |
| Un video nei post: il video della corsa o uno proprio, la pagina nel Feed, `expo-video` | `tasks/TASK-336.md`, `DECISIONS.md` ADR-0292 e ADR-0289, `API.md` «Drawings» |
| Il compositore del post: fino a 10 foto, video e disegno, i layout, l'editor | `tasks/TASK-348.md`, `DECISIONS.md` ADR-0301 e ADR-0292, `API.md` «Drawings» |
| Disegnare a mano in «Draw» («Freehand»), «Edit the drawing» sulle figure proposte | `UI.md`, `tasks/TASK-320.md` |
| A mano solo sulla mappa: la linea aperta, «Erase», «Edit the drawing» sulla mappa, niente per le emoji | `UI.md` «Disegnare sulla mappa», `tasks/TASK-331.md`, `DECISIONS.md` ADR-0288 |
| Il disegno libero ancorato alle strade: map matching per tratto col nostro motore, fantasma e punteggio, strumenti da professionista, guide | `tasks/TASK-347.md`, `DECISIONS.md` ADR-0300, `ROUTE_ENGINE.md` §4–5 |
| «Edit the drawing» su un disegno del Feed: la traccia dov'è stata corsa | `UI.md` «Edit the drawing: la figura sulla mappa», `tasks/TASK-346.md`, `DECISIONS.md` ADR-0299 |
| Il nuoto in acque libere, «Open water swim», la guida con l'Apple Watch | `tasks/TASK-323.md`, `ROUTE_ENGINE.md` §8 |
| Apple Salute e Fitness, Health Connect: l'attività finita scritta sul telefono | `tasks/TASK-321.md`, `DECISIONS.md` ADR-0281 |
| Allegati nei messaggi privati: disegni, foto, video | `tasks/TASK-333.md`, `DECISIONS.md` ADR-0279 e ADR-0289, `API.md` «Messages» |
| La chat: orari, giorni, quanti messaggi nuovi, i vecchi scorrendo | `tasks/TASK-353.md`, `DECISIONS.md` ADR-0279 e ADR-0305, `API.md` «Messages», `UI.md` |
| Il look premium: la scala del testo (`font`), i grigi caldi, `src/ui/` (Tap, Hairline, Scrim, EmptyState), le pagine vuote | `UI.md` «Il tema» e «Il look premium», `tasks/TASK-339.md`, `DECISIONS.md` ADR-0293 |
| Calorie e battito nei post del Feed, «Show heart rate» | `tasks/TASK-345.md`, `DECISIONS.md` ADR-0298 |
| Il video della corsa con la mappa sotto, i tre stili, il 3D | `tasks/TASK-351.md`, `DECISIONS.md` ADR-0303, ADR-0254 e ADR-0262, `UI.md` «Il post da condividere» |
| La scheda del Feed: titolo, data, estremi, barra azioni, conteggi, filtri | `tasks/TASK-355.md`, `DECISIONS.md` ADR-0306 e ADR-0293 |
| Le schede del Feed «Tutti» e «Seguiti», il `filter` di `GET /feed`, la scheda ricordata | `tasks/TASK-362.md`, `DECISIONS.md` ADR-0308, `API.md` «Feed» |
| Cosa fare dopo | `ROADMAP.md`, `STATUS.md` |

## Stato dei documenti

`[pieno]` utilizzabile · `[stub]` da scrivere quando arriva il task che lo richiede

| Documento | Stato | Si scrive con |
|---|---|---|
| `SETUP.md` | pieno | — |
| `PRODUCT.md` | pieno | — |
| `ARCHITECTURE.md` | pieno | — |
| `ROUTE_ENGINE.md` | pieno | — |
| `ROADMAP.md` | pieno | — |
| `DECISIONS.md` | pieno | — |
| `STATUS.md` | pieno | — |
| `TEAM_WORKFLOW.md` | pieno | — |
| `TESTING.md` | pieno | — |
| `GPX.md` | pieno | — |
| `MAPS.md` | pieno | — |
| `API.md` | pieno | — |
| `UI.md` | pieno per mappa e posizione | il resto con TASK-023 |
| `AI.md` | pieno | — |
| `DATABASE.md` | pieno | — |
| `SITO.md` | pieno | — |
| `PUBBLICITA.md` | pieno per account e pagamenti | annunci veri con TASK-153 |

Uno stub si riempie **quando arriva il suo task**, non prima: scrivere oggi
un `DATABASE.md` dettagliato significa documentare decisioni non ancora prese.

## Chi possiede cosa

Ogni informazione vive in **un solo** documento. Se la trovi in due posti,
uno dei due è già sbagliato: cancellalo e metti un rimando.

- Stato corrente e prossimo passo → `STATUS.md` (solo lì)
- Perché una scelta è stata fatta → `DECISIONS.md` (solo lì)
- Cosa faremo e in che ordine → `ROADMAP.md` (solo lì)
- Come funziona un algoritmo → il documento di dominio
- Regole permanenti di comportamento → `CLAUDE.md` (solo lì)
- Risultati generati e loro giudizio → `samples/LOG.md` (solo lì)
