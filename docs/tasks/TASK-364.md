# TASK-364 — «RIDE IT YOURSELF»: percorsi in bici di MuW in «Explore»

**Stato**: In revisione — PR aperta · **Fase**: 4 · **Branch**: `feat/TASK-364-bike-ideas` ·
numero e ADR-0309 dati dal Coordinatore il 2026-10-31

## Obiettivo

In «Explore» una fila di percorsi in bici disegnati da MuW, da aprire e avviare
con «Start». Nessuno li ha pedalati: la scheda dice solo la distanza vera, mai
tempi, velocità o calorie.

Richieste dell'utente:
- 2026-10-30, «Idea in Explore» per «MARRY ME» a Chicago;
- 2026-10-31, «sincronizza anche la sezione explore con i nuovi posti … solo
  quelli venuti meglio», poi «Sì, le bozze» (le bozze di
  `out/muw-bike-drafts/`, sessione `local_c33ac9b1`);
- 2026-10-31, «Sì, questi 5»;
- 2026-11-01, su Autumn Mushroom e GO: «Nel Feed» (registrato in
  `tasks/TASK-365.md`, scelta 2). In «Explore» restano quindi **Ghost**
  (Barcellona), **Bat** (Madrid) e **Pumpkin** (Torino).

## Contesto da leggere

- `docs/DECISIONS.md`, ADR-0309, ADR-0287 e ADR-0310;
- `docs/UI.md`, «Le idee dall'Europa» e «Pedalalo tu».

## Cosa fare

1. `tools/bike_ideas.py`: legge le bozze scelte (fatte dal motore,
   `plan_nearby`, rete bici), toglie punti entro 2 m e scrive
   `apps/mobile/src/explore/bikeIdeas.json`. Non inventa coordinate.
2. `explore/bikeIdeas.ts`, `explore/RideItYourself.tsx`: la fila sotto «IDEAS
   FROM EUROPE», la scheda «Barcellona · Fantasma», «In bici · 24,4 km», la
   nota e il credito di OpenStreetMap.
3. `explored.ts`: un percorso della fila si apre **dal telefono**, senza server;
   una figura che il catalogo non ha (Bat) porta il suo contorno nella
   richiesta, che «Start» e «Export GPX» leggono.
4. «MARRY ME» entra **solo se passa dal motore** (`--outline`) e si legge;
   lo script di `out/marry-me/layout.py` resta uno studio.
5. Verifica nel simulatore: aprire e avviare un percorso di Barcellona e uno di
   Torino.

## File toccati

- `tools/bike_ideas.py`, `tools/test_bike_ideas.py` (nuovi)
- `apps/mobile/src/explore/bikeIdeas.json`, `bikeIdeas.ts`,
  `RideItYourself.tsx`, `RideItYourself.test.tsx` (nuovi)
- `apps/mobile/src/explore/ExploreScreen.tsx`, `explored.ts`,
  `recommendedRoutes.ts`
- `apps/mobile/src/i18n/it.ts`, `de.ts`, `es.ts`, `fr.ts`
- `docs/tasks/TASK-364.md`, `docs/DECISIONS.md`, `docs/UI.md`,
  `docs/STATUS.md`, `docs/INDEX.md`

## Testi (approvati dall'utente il 2026-10-31, «Sì, approvo»)

| en | it | de | es | fr |
|---|---|---|---|---|
| RIDE IT YOURSELF | PEDALALO TU | FAHR ES SELBST | RECÓRRELO EN BICI | À TOI DE PÉDALER |
| Routes drawn by MuW. Nobody has ridden them yet. | Percorsi disegnati da MuW. Nessuno li ha ancora pedalati. | Von MuW gezeichnete Routen. Noch niemand ist sie gefahren. | Rutas dibujadas por MuW. Nadie las ha recorrido todavía. | Parcours dessinés par MuW. Personne ne les a encore faits. |
| By bike | In bici | Mit dem Rad | En bici | À vélo |
| Bat | Pipistrello | Fledermaus | Murciélago | Chauve-souris |
| Madrid | Madrid | Madrid | Madrid | Madrid |
| Turin | Torino | Turin | Turín | Turin |

L'utente ha approvato l'inglese e l'italiano; le altre tre lingue sono
traduzioni dell'agente degli stessi testi.

## Criteri di accettazione

- [x] La fila mostra Ghost, Bat e Pumpkin, in bici, con la distanza vera e
  nessun tempo, velocità o calorie; nessun nome di stagione.
- [x] Ogni percorso si apre senza server e dà una richiesta in bici che
  «Start» legge (test).
- [x] Verificato nel simulatore (iPhone 17e, Expo Go, copia pulita con `npm ci`,
  2026-11-03): Ghost a Barcellona e Pumpkin a Torino si aprono senza server;
  «Start» avvia la corsa in bici (km/h, «24,3 km to go» e «25,4 km to go»)
  con le indicazioni di `POST /route-directions` dell'API locale.
- [x] «MARRY ME»: **fuori**. Il motore (`--outline`, lettere squadrate, in
  bici) non la disegna a Chicago: a 12, 16, 24 e 28 km «cannot be drawn
  here», la forma migliore resta 5–14 km sotto. Segnalato al Coordinatore;
  lo studio resta in `out/marry-me/`.
- [x] Impronta iOS su copia pulita (`npm ci` alla radice, misura in
  `apps/mobile`, `APP_VARIANT=production`): **83793e26**, come main 064470b5.
  Una prima misura dalla radice del repository dava ff4397a8: era il posto
  sbagliato, non il branch.
