# TASK-369 — «Edit the drawing» su ogni disegno: la traccia sulla mappa dov'è

**Stato**: In lavorazione — documenti in `main` (#712, `fe4e9499`); parte A
in `main` (#719, `3e7c7d28`); parte B in PR (#722), da unire dopo TASK-323 C2;
server con la parte B solo col sì dell'utente
**Fase**: 4 · **Branch**: `docs/TASK-369-edit-every-drawing` (documenti),
`feat/TASK-369-a-edit-every-drawing` (parte A),
`feat/TASK-369-b-edit-on-water` (parte B) · **ADR**: ADR-0313

Numero e ADR dal Coordinatore (2026-11-04: TASK-369, ADR-0313; A e B sono
parti dello stesso numero).

## Obiettivo

«Edit the drawing» («Modifica il disegno») c'è su ogni disegno dell'app che
ha una linea sulla mappa, così ogni disegno si può cambiare e poi correre:
anche le emoji, le parole, i percorsi a tema, le corse libere e quelle
importate, e sull'acqua. Come per un disegno del Feed (TASK-346, ADR-0299)
si modifica **la traccia, o la linea del percorso, dov'è e grande com'è**,
non la figura chiesta.

## Contesto

Richiesta dell'utente del 2026-11-03: «Voglio che "Modifica il disegno"
(disegno a mano libera sulla mappa) sia disponibile su TUTTI i disegni
dell'app, così ogni disegno può essere modificato e poi corso. In
particolare anche sui disegni pubblicati dagli altri utenti nel Feed».
Regole date con la richiesta: solo JS dell'app se possibile, niente build
nativa, contratto e motore invariati salvo un suo sì, testi nuovi solo dopo
il suo sì, server e privacy solo col suo sì.

Inventario su `main` (081f6d82, 2026-11-03), prima del task:

| Dove | Scheda | «Edit the drawing» |
|---|---|---|
| Feed «All» e «Following», disegni degli iscritti (anche dei contest) | `DrawingCard` | sì, la traccia dov'è stata corsa (TASK-346); no per emoji, parole, corse libere, importate, solo foto |
| Profilo mio e degli altri | `DrawingCard` | come il Feed |
| Explore (esempi, città, idee), «NEAR YOU» in Draw | `ExploredCard` | sì solo per un contorno (foto, disegno a mano), nel mezzo della partenza; no per emoji e parole |
| Preferiti, disegni nei messaggi | `ExploredCard` | come Explore |
| Feed, esempi di MuW | `ExploredCard` | no (forme del catalogo) |
| Risultato di «Draw» | — | no, tolto dal TASK-340 |
| Percorsi a tema | `ThemedCard` | no |
| Pagaia | — | mai sull'acqua (`cardFigure`, con lo sport scelto) |
| Le mie attività | `ActivityCard` | no |
| Sfide di «Play» | `ChallengeView` | no |
| Ricerca del Feed | — | l'app (TASK-344 B) non è in `main` |

TASK-346 è in `main` con la PR #655 (2026-10-30), anche se il suo task file
dice ancora «In corso»: lo chiude il Coordinatore.

L'API rifiuta un'immagine sull'acqua («not an image»,
`shaperoute_api/images.py` con `models.check_drawn_on_land`, ADR-0161), e
il motore sull'acqua disegna solo una forma del catalogo
(`paddling.water_shape` → `get_shape`). `water_fit.plan_on_water` invece
prende già una linea qualsiasi (`shape: Sequence[XY]`, `pieces`).

## Scelte dell'utente (2026-11-03 e 2026-11-04)

Una per volta, con una proposta pronta:

1. **Emoji** (forme del catalogo): **sì**, si modifica la traccia sulla
   mappa, non la figura dell'emoji («Sì, la traccia»). Cambia la scelta del
   2026-10-29 in TASK-331 («non la modifica delle emoji perché non serve a
   nulla»), che riguardava la figura.
2. **Parole**: **sì**, la traccia («Sì, la traccia»); i tratti fra una
   lettera e l'altra diventano linea normale e il percorso nuovo è un
   disegno a mano, non più una parola.
3. **Percorsi a tema**: **sì**, la linea del percorso dov'è («Sì, la
   traccia»); i luoghi del tema non restano e la riga «Passes by N of M
   places» sparisce.
4. **Pagaia**: **sì** («Voglio anche Pagaia»), **come parte a sé** («Sì,
   parte separata»): motore e API, il server col suo sì. Sull'acqua il
   disegno va dove c'è posto vicino alla partenza, non esattamente dov'era;
   niente «Freehand» sull'acqua in «Draw».
5. **Post con solo foto**: **niente tasto** («Sì, niente tasto»).
6. **Corse libere e importate**: **sì**, la traccia dov'è stata corsa («Sì,
   la traccia»).
7. **Risultato di «Draw»**: **resta tolto** («No, resta tolto»): TASK-340
   non cambia.
8. **«Based on @name's drawing»** sul post nato da una copia: **niente
   scritta** («No, niente scritta»).
9. **L'autore può impedire la modifica**: **no, nessun blocco** («Sì,
   nessun blocco»).
10. **La copia quando l'autore blocca, rende privato o cancella
    l'originale** (domanda del Coordinatore, 2026-11-04): **resta di chi
    l'ha fatta**. Risposta dell'utente nella chat del Coordinatore: «si si».
    Nessun legame resta fra la copia e l'originale (niente scritta, niente
    campo sul server): la copia è un percorso suo come un altro. Chi è
    bloccato non vede più il disegno e non può farne altre copie.

Per i disegni degli altri la modifica crea sempre una **copia** dell'utente:
il post originale non cambia mai (dalla richiesta).

## Cosa fare

### Parte A — l'app (solo JS)

Dopo il merge di TASK-367 A, che occupa `App.tsx`, col via del Coordinatore.

1. `src/route/figureLines.ts`:
   - `drawingTrack(drawing)`: la traccia di ogni disegno di un membro che
     ne ha una (almeno 2 punti), anche un'emoji, una parola, una corsa
     libera o importata; null solo senza traccia (un post di sole foto) o
     con una traccia troppo corta.
   - `routeTrack(points)` (nuovo): la linea di un percorso di «Explore», di
     un preferito, di un messaggio, di un esempio del Feed, di «NEAR YOU» o
     di un percorso a tema, dov'è: `trackInPlace` sui punti del risultato.
   - `trackInPlace`: una traccia che finisce lontano dalla partenza resta
     **aperta** con la regola di TASK-331 (`CLOSED_SHARE`,
     `START_RING_SHARE` di `mapdraw/drawing.ts`): un anello minuscolo sul
     primo punto e la linea appesa come dettaglio; chiusa altrimenti, come
     oggi.
   - `requestLines` non serve più a «Edit the drawing».
2. `App.tsx`: la scheda di «Explore» (esempi, ricerche, preferiti,
   messaggi, esempi del Feed, «NEAR YOU») usa `routeTrack` del risultato ed
   `editTrackOf`, come la scheda del disegno; `editCardOf` e `onEditCard`
   spariscono. `cardFigure` resta per l'acqua (sport «Paddle»: niente tasto
   fino alla parte B). Il risultato di «Draw» resta senza tasto (TASK-340).
3. `src/explore/ThemedCard.tsx`: `onEditDrawing` facoltativo e il tasto
   neutro «Edit the drawing» come in `ExploredCard`, con la linea del
   percorso a tema dov'è.
4. Nessun testo nuovo: «Edit the drawing» c'è già in tutte le lingue. Se ne
   servisse uno, prima il sì dell'utente.
5. Test deterministici: `figureLines.test.ts` (un'emoji, una parola, una
   corsa libera, una importata hanno la traccia; un post di sole foto no;
   una traccia aperta resta aperta; un punto torna dov'era),
   `ThemedCard.test.tsx` (il tasto c'è solo con `onEditDrawing`),
   `__tests__/AppEditDrawing.test.tsx` (un esempio di Explore con una forma
   del catalogo apre la sua linea dov'è; un percorso a tema pure; il
   risultato di «Draw» resta senza tasto).
6. Documenti: `UI.md` («Edit the drawing: la figura sulla mappa»),
   `STATUS.md`, questo file.

Impronta iOS invariata: **6f8bba4c** (`main` sulla 1.0.1 dalla #620);
arriva con un OTA.

### Parte B — sull'acqua (motore e API)

Dopo la parte A. La via cercata è **neutra per l'impronta del motore**,
come TASK-347 (`route_store.ANCHORED_ONLY`): toccare `paddling.py`
cambierebbe l'impronta e vorrebbe ore di `draw_examples --water` sul server
(Explore lento).

1. `services/route-engine/route_engine/drawn_water.py` (nuovo):
   `plan_drawn_water(outline, strokes, distance_m, start, source)` mette un
   contorno disegnato sull'acqua con `water_fit.plan_on_water` (i dettagli
   come `pieces`) e lo controlla con `validation.check_on_water`, senza
   toccare `paddling.py`, `water_fit.py`, `models.py`.
2. `services/api/shaperoute_api/route_store.py`: `drawn_water.py` in un
   insieme escluso dall'impronta (`DRAWN_WATER_ONLY`, come
   `ANCHORED_ONLY`), con il test che fallisce se un modulo che disegna
   altri percorsi lo importa; un percorso disegnato sull'acqua non viene
   mai tenuto fra quelli del catalogo.
3. `services/api/shaperoute_api/images.py`: un'immagine con «paddling»
   (solo `placement` «free») non chiama più `check_drawn_on_land` e va a
   `plan_drawn_water`. Il contratto non cambia forma
   (`ImageRouteRequest.activity` è già `Activity`); l'API accetta quello
   che rifiutava: `API.md` lo dice.
4. App: `cardFigure` lascia il tasto anche con lo sport «Paddle»; «Draw
   route» chiede il disegno con «paddling», dentro i limiti dell'acqua.
5. Test: motore (`test_drawn_water.py`, con l'acqua di prova), API
   (un'immagine sull'acqua dà un percorso; l'impronta non cambia), app.
6. Server: aggiornamento col sì dell'utente.

**Se la via neutra non basta** (se `plan_on_water` o `check_on_water`
vanno cambiati): si scrive qui, e la parte B si programma di notte col sì
dell'utente, per le ore di `draw_examples --water`.

## Criteri di accettazione

- [ ] Ogni disegno con una linea sulla mappa ha «Edit the drawing», tranne
      il risultato di «Draw» e i post di sole foto; si apre dov'è e grande
      com'è.
- [ ] Il post originale di un altro non cambia mai; la copia non dice da
      chi viene.
- [ ] Parte A: niente cambia in contratto, API, motore, testi, nativo;
      impronta iOS 6f8bba4c.
- [ ] Parte B: impronta del motore dell'API invariata, oppure la via notturna
      scritta qui; server col sì dell'utente.
- [ ] Test deterministici verdi.

## File toccati

Documenti (questa PR):

- `docs/tasks/TASK-369.md`
- `docs/DECISIONS.md` (ADR-0313)
- `docs/STATUS.md`
- `docs/INDEX.md`

Parte A:

- `apps/mobile/src/route/figureLines.ts`, `figureLines.test.ts`
- `apps/mobile/App.tsx`
- `apps/mobile/src/explore/ThemedCard.tsx`, `ThemedCard.test.tsx`
- `apps/mobile/__tests__/AppEditDrawing.test.tsx`
- `docs/UI.md`, `docs/STATUS.md`, `docs/tasks/TASK-369.md`

Parte B:

- `services/route-engine/route_engine/drawn_water.py`,
  `services/route-engine/tests/test_drawn_water.py`
- `services/api/shaperoute_api/route_store.py`,
  `services/api/shaperoute_api/images.py`
- `services/api/tests/test_drawn_water_fingerprint.py`
- `services/api/tests/test_paddling.py`,
  `services/api/tests/test_anchored_requests.py` (il vecchio rifiuto «not an
  image» diventa il comportamento nuovo; aggiunti col sì del Coordinatore,
  2026-11-04)
- `apps/mobile/App.tsx`, `apps/mobile/__tests__/AppEditDrawing.test.tsx`
- `apps/mobile/src/route/figureLines.ts`, `figureLines.test.ts` (le righe
  della parte A che escludevano la canoa; col sì del Coordinatore)
- `apps/mobile/src/route/problems.ts`, `problems.test.ts` (il ripiego col
  server di prima; col sì del Coordinatore, dopo TASK-323 C2)
- `apps/mobile/assets/engine/engine.zip` (il motore del telefono ricostruito
  con `tools/phone_engine/phone_engine.py engine`: ha tutto `route_engine`,
  `drawn_water.py` compreso, e `images.py`; la CI lo controlla; impronta iOS
  6f8bba4c invariata)
- `docs/API.md`, `docs/ROUTE_ENGINE.md`, `docs/UI.md` (una frase della parte
  A), `docs/STATUS.md`, `docs/tasks/TASK-369.md`

## Avanzamento

- **Parte A** (2026-11-04, #719, `3e7c7d28`): «Edit the drawing» su ogni
  scheda con una linea, la traccia dov'è (`figureLines.drawingTrack`,
  `routeTrack`, la traccia aperta con `firstLineOf`), il tasto in
  `ThemedCard`; impronta iOS 6f8bba4c; app 612 suite verdi.
- **Parte B** (2026-11-04, PR #722): `drawn_water.py` fuori dall'impronta del
  motore (`DRAWN_WATER_ONLY`): impronta uguale a `main`, `5b5e026cea9b` (con
  i nuoti `b9d00c37d28d`), niente notte di `draw_examples --water`; l'API
  accetta un'immagine «paddling» solo libera; l'app toglie l'esclusione
  dell'acqua. Impronta iOS 6f8bba4c. Nel motore
  `test_first_placement[levico heart 1000]` fallisce uguale su `main`: non
  è di questo task. Resta: merge dopo TASK-323 C2, poi il server col sì
  dell'utente.
- **Ripiego col server di prima** (deciso dall'agente su delega dell'utente,
  2026-11-04, approvato dal Coordinatore): l'OTA può arrivare prima del
  server, che rifiuta un disegno sull'acqua con `422 invalid_request` «… not
  an image». Invece di «Something went wrong on our side» con un «Try again»
  che fallirebbe sempre, `problems.ts` dice il testo che c'è già, «On the
  water, a shape of the catalogue.», senza «Try again»; col server nuovo non
  compare mai. Scartati un campo o una versione nell'API (server e una
  chiamata in più, solo per il passaggio).

## Esito

*(a fine task)*
