# TASK-390 — Il disegno intero: via il taglio dei primi e ultimi 200 m

**Stato**: In lavorazione · 2026-11-05
**Fase**: 4 · **Branch**: `feat/TASK-390-a-whole-track` (parte A),
`feat/TASK-390-b-whole-drawing` (parte B)
**Numeri**: TASK-390 e ADR-0330, assegnati dal Coordinatore. Cambia il punto
4 di ADR-0114 e il punto 4 di ADR-0159.

## Obiettivo

L'utente, 2026-11-05: «togli la questione che il disegno non conteggia la
prima e l'ultima parte per privacy, rovina il disegno...». Alla domanda su
come toglierlo ha scelto **«Via, anche le vecchie»**: i disegni si vedono
interi, partenza e arrivo compresi, anche quelli già pubblicati, che il
server ricalcola dalla traccia intera della corsa.

## Cosa c'è oggi

- Il server (`drawings.py`, `cut_track`) tiene in `drawings.track` la
  traccia senza i primi e gli ultimi 200 m lungo di lei (ADR-0159 punto 4).
  Da lì leggono gli altri: dettaglio, Feed, profilo, ricerca, «Start», GPX.
- L'app taglia da sola (`share/postRun.ts`, `withoutEnds`, `POST_CUT_M`):
  immagine e video di «Share», la foto composta del post, il disegno
  mandato in un messaggio.
- I testi lo promettono: sotto «Who can see it» e nell'informativa privacy
  (app e sito), in cinque lingue.

## Ordine (dal Coordinatore)

Tocca una promessa fatta a chi ha già pubblicato:

1. il testo nuovo della privacy, con la data, approvato dall'utente in
   chat — **fatto** il 2026-11-05 («Sì, approvo»);
2. PR A (API + ricalcolo) e PR B (app + testi); il server legge sia i
   disegni vecchi sia quelli nuovi;
3. il ricalcolo dei disegni già pubblicati è una scrittura sul server:
   comando dell'utente, col suo sì, solo dopo che la privacy nuova è sul
   sito. Sito e ricalcolo li segue il Coordinatore con l'utente.

## Parte A — API e ricalcolo

- `drawings.py`: `shown_track` al posto di `cut_track`: la traccia intera,
  senza orari; vuota solo sotto `MIN_LEFT_M` (1 m), e allora resta il `422`,
  con «This run is too short to publish.». Una corsa salvata ha già due
  posizioni ad almeno `MIN_STEP_M` (1 m) l'una dall'altra, quindi in pratica
  il `422` non arriva più.
- `drawing_retrack.py` (nuovo): `python -m shaperoute_api.drawing_retrack`
  conta i disegni da ridisegnare senza scrivere niente; con `--apply`
  ridisegna `drawings.track` dalla corsa, come `PUT` lo darebbe adesso. Un
  disegno già intero resta com'è: un secondo giro non cambia niente. Chi lo
  vede, `published_at` e `updated_at` non cambiano. `drawings.preview` è
  una colonna generata (migrazione 0022): segue da sola. Nessuna migrazione.
- `DRAWING_CUT_M` esce da `shared-types`.

## Parte B — App e testi

- `withoutEnds` e `POST_CUT_M` escono da `share/postRun.ts`: immagine,
  video, foto composta e disegno nei messaggi usano la traccia intera.
- Testi approvati dall'utente il 2026-11-05 (inglese e italiano qui sotto;
  tedesco, spagnolo e francese tradotti allo stesso modo):
  - «Every member sees it in your profile.» / «Ogni iscritto la vede nel
    tuo profilo.»
  - «Your followers see it in your profile.» / «I tuoi follower la vedono
    nel tuo profilo.»
  - Privacy, «Le tue corse»: «…e allora vedono la traccia intera, partenza
    e arrivo compresi, con il titolo che le hai dato, e senza orari, pause
    o percorso pianificato.»; la frase «Una corsa spesso parte e finisce
    davanti a casa» resta.
  - Privacy, «Start» e GPX: «…salvarne la stessa traccia come file GPX,
    senza orari.»
  - Privacy, foto: «…lo stesso disegno che mostra il Feed.»
  - Privacy, «Share»: «Il video mostra la mappa attorno alla corsa,
    partenza e arrivo compresi.»
  - Data dell'informativa: 5 novembre 2026.
  - Due frasi in più con la stessa modifica, in attesa del sì dell'utente:
    il paragrafo dei messaggi in «Privacy» («Un disegno è una copia del
    percorso e arriva intero, con la sua partenza: sia una corsa che mandi,
    come nel Feed, sia un percorso che hai pianificato.») e una frase di
    «Help» («…e la vedono come disegno sul tuo profilo, intera.»). A e B
    entrano insieme, dopo quel sì (Coordinatore).
- Le pagine `site/privacy/` si rigenerano con `site/tools/make_privacy.mjs`.

## Criteri di accettazione

Parte A:

- [x] Un disegno pubblicato si vede intero, dal primo all'ultimo punto della
      corsa, senza orari (`test_drawings.py`, `test_drawing_download.py`).
- [x] Una corsa di 300 m si pubblica (prima: `422`).
- [x] Il ricalcolo: senza `--apply` conta e non scrive; con `--apply`
      ridisegna intero un disegno tagliato, lascia chi lo vede e la data;
      un secondo giro non cambia niente (`test_drawing_retrack.py`).
- [x] ruff, black e i test toccati verdi in locale.
- [ ] CI verde.

Parte B:

- [ ] Immagine, video, foto composta e disegno in un messaggio usano la
      traccia intera.
- [ ] I testi approvati nelle cinque lingue, in app e sul sito; nessuna
      chiave vecchia rimasta.
- [ ] typecheck, lint, Prettier e i test toccati verdi; CI verde.

## File toccati

Parte A:

```
services/api/shaperoute_api/drawings.py
services/api/shaperoute_api/drawing_retrack.py       (nuovo)
services/api/tests/test_drawings.py
services/api/tests/test_drawing_download.py
services/api/tests/test_drawing_retrack.py           (nuovo)
packages/shared-types/src/index.ts
docs/tasks/TASK-390.md                                (nuovo)
docs/DECISIONS.md
docs/API.md
docs/DATABASE.md
docs/STATUS.md
```

Parte B:

```
apps/mobile/src/share/postRun.ts
apps/mobile/src/share/postRun.test.ts
apps/mobile/src/share/PostImage.tsx
apps/mobile/src/share/PostImageTurn.test.tsx
apps/mobile/src/share/StyleRow.tsx
apps/mobile/src/share/videoScene.ts
apps/mobile/src/social/composer/ComposedPhoto.tsx
apps/mobile/src/social/composer/ComposedPhoto.test.tsx
apps/mobile/src/social/PublicParts.tsx
apps/mobile/src/social/PublicRow.test.tsx
apps/mobile/src/social/DrawingsGrid.tsx
apps/mobile/src/social/drawingRoute.ts
apps/mobile/src/messages/messageDrawing.ts
apps/mobile/src/messages/Drawings.test.tsx
apps/mobile/src/api/drawings.ts
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/es.ts
apps/mobile/src/i18n/fr.ts
apps/mobile/src/i18n/it.ts
apps/mobile/src/about/content/en.ts
apps/mobile/src/about/content/it.ts
apps/mobile/src/about/content/de.ts
apps/mobile/src/about/content/es.ts
apps/mobile/src/about/content/fr.ts
apps/mobile/src/about/documents.test.ts
apps/mobile/__tests__/AppDrawings.test.tsx
apps/mobile/src/activities/RunEndForm.test.tsx
apps/mobile/src/about/AboutPage.test.tsx              (la data; ok del Coordinatore)
apps/mobile/src/share/videoScene.test.ts              (ok del Coordinatore)
apps/mobile/src/share/SharePost.test.tsx              (ok del Coordinatore)
apps/mobile/src/share/StyleRow.test.tsx               (ok del Coordinatore)
site/tests/privacy.test.mjs                           (la data; ok del Coordinatore)
site/privacy/index.html
site/privacy/it/index.html
site/privacy/de/index.html
site/privacy/es/index.html
site/privacy/fr/index.html
docs/tasks/TASK-390.md
docs/STATUS.md
```

## Fuori scope

- Un'opzione «Nascondi partenza e arrivo» (proposta all'utente, non
  scelta).
- Avvisare nell'app chi ha già pubblicato (proposta dal Coordinatore, non
  chiesta dall'utente).
- Il deploy del server, il sito e il ricalcolo in produzione: dell'utente,
  col Coordinatore.
