# TASK-279 — Parole e frasi con la penna alzata in «Explore»

**Stato**: parte A Done, in `main` con la #503 (`100aca2c`, 2026-10-13),
su `preview` con il gruppo `9dbc73d0`; parte B (frasi) Todo e il punto 7
(`draw_examples`) dopo l'approvazione di Apple
**Fase**: 4 · **Branch**: parte A `feat/TASK-279-a-explore-words`,
parte B `feat/TASK-279-b-phrases`

## Obiettivo

Negli esempi di una città, in «Explore», una riga di parole già
disegnate con la penna alzata (parte A); dopo, anche frasi di più parole
con lo spazio, come «TI AMO» (parte B).

## Contesto

Chiesto dall'utente il 2026-10-11 («In explore frasi con l'alzata di
penna»), nella sessione «Explore e Draw: profilo e disegno mappa»; numero
dal Coordinatore.

**Scelta dell'utente del 2026-10-11**: «Prima parole, poi frasi». Prima
parole corte, fino a 8 lettere (`MAX_WORD_LETTERS`), che il motore sa già
disegnare con la penna alzata (TASK-197, ADR-0157); le frasi vere con lo
spazio dopo, con un task per il motore. Scartati: solo parole; subito
frasi.

Trovato scrivendo questo file: gli esempi di una città sono richieste
normali **dal centro della città**, e l'API tiene già ogni percorso
chiesto da lì, **parole comprese** (`route_store.py`, ADR-0136: «stessa
forma o parola, stile, distanza, attività, la penna alzata o no»). Quindi
la parte A è **solo app**: il primo telefono in una città aspetta il
disegno, gli altri lo ricevono subito. Farle disegnare prima dal server
(`draw_examples`) è un di più, che tocca il server e aspetta
l'approvazione di Apple della 1.0. All'utente era stato detto «server,
dopo Apple»: va detto che la parte A può partire prima.

## Contesto da leggere

- `docs/UI.md`: «Explore» in «Le due schermate», «Forma e distanza»
  (le parole, «Lift the pen between letters»), «Il risultato» (la parola
  con la penna alzata)
- `docs/API.md`: «Gli esempi di una città, tenuti» e «La penna alzata»
- `docs/DECISIONS.md`: ADR-0136, ADR-0144, ADR-0157
- `apps/mobile/src/explore/exampleRoutes.ts`, `CityExamples.tsx`,
  `ExploreScreen.tsx`

## Cosa fare

### Parte A — parole fino a 8 lettere (solo app)

1. **Prima di scrivere codice, una domanda all'utente**: quali parole.
   Proposta già pronta, sei parole che si leggono in tutte e cinque le
   lingue dell'app o quasi: `CIAO`, `LOVE`, `AMORE`, `RUN`, `HELLO`,
   `MUW`. Lettere tonde (`style: "round"`), penna alzata,
   5 km come le forme.
2. Le parole si chiedono **dopo** le forme degli esempi (`DRAW_ORDER`),
   una alla volta, dal centro della città, come le forme: un percorso
   non riuscito non diventa una scheda.
3. Una riga nuova sotto gli esempi della città, con un'etichetta grigia
   in maiuscolo come «NEARBY TOWNS» (testo da far approvare: proposta
   «WORDS» · «PAROLE» · «WÖRTER» · «PALABRAS» · «MOTS»). Le schede sono
   quelle degli esempi, con la parola al posto della forma; un tocco apre
   il percorso sulla mappa come gli altri esempi, con «Start», i tratti a
   piedi fra le lettere e la riga «6.0 km of drawing + 0.4 km walking».
4. Le parole restano in memoria e nel file degli esempi come le forme.
5. «Paddle»: niente parole sull'acqua in questo task.
6. `UI.md` aggiornato; una nuova ADR (numero dal Coordinatore) o
   un'aggiunta ad ADR-0144, a scelta della sessione, «deciso dall'utente
   il 2026-10-11».
7. Facoltativo, con l'ok dell'utente e il via del Coordinatore, **dopo
   l'approvazione di Apple**: `draw_examples` disegna anche le parole
   (`prefetch_zones.py`), così nemmeno il primo telefono aspetta. Se si
   fa, è una PR a sé nella stessa parte.

### Parte B — frasi con lo spazio (motore, dopo Apple)

1. Il contratto accetta uno spazio fra le parole (`LETTERS`,
   `MAX_WORD_LETTERS` da rivedere: quante lettere in tutto), e il motore
   mette le parole una dopo l'altra sulla stessa riga, con la penna alzata
   anche fra una parola e l'altra. Se servono due righe, è una scelta da
   chiedere all'utente con dei campioni sulla mappa.
2. Campioni prima di scrivere il codice dell'app: tre frasi in due città
   (proposta «TI AMO», «I LOVE RUN», «CIAO MAMMA»), da far giudicare
   all'utente.
3. Poi le frasi entrano nella riga della parte A e, se l'utente lo
   chiede, nel campo della parola in «Draw».
4. Cambia `route_engine`: `engine.zip`, `paddleExamples.json` (se tocca un
   file nell'impronta dell'acqua), aggiornamento del server con
   `draw_examples` (regola 11 di `AGENTI.md`), sempre con l'ok
   dell'utente.

## Criteri di accettazione

Parte A:
- [x] Le parole scelte dall'utente si chiedono dal centro della città
      dopo le forme, con `pen_up: true`, una alla volta (test).
- [x] La riga mostra solo le parole riuscite; un tocco apre il percorso
      con i tratti a piedi e «Start» (test).
- [x] Una seconda apertura della stessa città mostra le parole senza
      chiederle di nuovo (test).
- [x] Testi nuovi approvati dall'utente nelle cinque lingue; `npm test`,
      `expo lint`, `format:check` verdi.

Parte B:
- [ ] Il motore disegna una frase di almeno due parole con la penna
      alzata fra le lettere e fra le parole (test deterministico).
- [ ] I campioni sono stati giudicati dall'utente prima del codice
      dell'app.

## File toccati

Previsti; la sessione li conferma all'inizio.

Parte A:
```
apps/mobile/src/explore/exampleRoutes.ts
apps/mobile/src/explore/exampleRoutes.test.ts
apps/mobile/src/explore/CityExamples.tsx
apps/mobile/src/explore/CityExamples.test.tsx
apps/mobile/src/explore/ExploreScreen.tsx
apps/mobile/src/i18n/*        (solo le stringhe nuove)
docs/UI.md
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-279.md
```

Confermati dalla sessione della parte A (2026-10-13), con questi in più:

```
apps/mobile/src/explore/CityWords.tsx          (nuovo: la riga «WORDS»)
apps/mobile/src/explore/CityWords.test.tsx     (nuovo)
apps/mobile/src/explore/exampleWords.test.ts   (nuovo: i test delle parole)
apps/mobile/src/explore/ExploreMoreShapes.test.tsx  (conta anche le parole)
apps/mobile/src/explore/ExploredCard.tsx       (la riga dei km a piedi)
apps/mobile/src/route/RoutePanel.tsx           (solo `export` di PenSplit)
```

`CityExamples.tsx` e `CityExamples.test.tsx` non servono: la riga è un
file nuovo.

Parte B: da definire all'inizio della parte, dopo i campioni
(`services/route-engine/route_engine/words.py` e `letters`,
`packages/shared-types/src/index.ts`, `services/api/shaperoute_api/schemas.py`,
`docs/API.md`, `docs/ROUTE_ENGINE.md`, i test di contratto).

## Fuori scope

- Parole sull'acqua.
- Scrivere una parola propria in «Explore» (c'è già in «Draw»).
- Toccare `NearbyTowns.tsx` e `nearbyCities.ts`: sono di TASK-283.
- Server e pubblicazione: con l'ok dell'utente e il via del Coordinatore.

## Esito

**Parte A** (2026-10-13, PR #503, aggiunta ad ADR-0144): dopo le otto
forme di una città «Explore» scrive CIAO, LOVE, AMORE, RUN, HELLO, MUW dal
centro, lettere tonde e penna alzata, nella riga «WORDS». Il punto 1
diceva «5 km come le forme», ma il contratto vuole 3 km a lettera: scelta
dell'utente del 2026-10-13, ogni parola alla sua distanza minima (9, 12 o
15 km). Testo «WORDS» · «PAROLE» · «WÖRTER» · «PALABRAS» · «MOTS»
approvato dall'utente. `npm test` (397 suite, 3288 test), lint, tipi e
`format:check` verdi. Resta da provare su un telefono una città nuova per
l'API (la prima volta 30–50 s a parola). Restano il punto 7
(`draw_examples`, dopo Apple) e la parte B.

**Provato sull'iPhone dall'utente il 2026-10-15**, in Expo Go su `preview` (gruppo `9dbc73d0`, da `main` `fd4ae341`): «funziona tutto ok». Vale per la parte A (#503); restano il punto 7 (`draw_examples`, dopo Apple) e la parte B.

**Punto 7 spostato a TASK-316** (2026-10-27, dal Coordinatore): `draw_examples --all` disegna anche le sei parole che l'app chiede a una città, con la stessa richiesta dell'app; codice in `main` con la #590 (`07f98951`, 2026-10-28, ADR-0276). Il giro sul server è la parte C di TASK-316, dopo Apple e con il sì dell'utente. Qui resta solo la parte B (frasi).
