# TASK-307 — Correre il disegno di un altro, e scaricarne la traccia

**Stato**: Done · 2026-10-27 (PR #573, merge `f8dd7964`)
**Fase**: 4 · **Branch**: `feat/TASK-307-start-friend-track`

## Obiettivo

Chi apre il disegno di un altro iscritto (dal «Feed» o dai «Drawings» del
suo profilo) può **partire** su quella traccia e **scaricarla** come GPX.
Richiesta dell'utente del 2026-10-26: «quando entri in un'attività di un
tuo amico, nei suoi disegni e nel feed, poter scaricare la traccia e
poterla iniziare pure tu». Numero e regole dal Coordinatore (ADR-0267).

## Contesto da leggere

- `docs/UI.md`, «Drawings» (la scheda del disegno aperto sulla mappa).
- `docs/GPX.md`, «Struttura» e «La corsa fatta».
- `docs/DECISIONS.md` ADR-0159 (la traccia tagliata), ADR-0117
  (`/route-directions`), ADR-0033 (il foglio di condivisione).

## Cosa fare

1. Sulla scheda del disegno aperto (`DrawingCard`, la stessa dal Feed e
   dal profilo) aggiungere «Start» (giallo, come in «Explore») ed «Export
   GPX», solo se la traccia ha almeno due punti.
2. Il GPX si scrive **sul telefono** dalla traccia che l'app ha già: la
   stessa della mappa, senza i primi e gli ultimi 200 m, **senza tempi**,
   senza autore, senza quote. Un `<trk>`, un `<trkseg>`, 7 decimali, nome
   del file `muw-<forma>-<km>km.gpx`. Nessuna chiamata all'API.
3. «Start» segue la traccia come percorso **senza indicazioni delle
   svolte**: una traccia GPS non sta sui nodi del grafo, e
   `/route-directions` la rifiuta. Sotto «Start» la scheda lo dice: «This
   route has no turn directions: follow the line on the map.» (testo
   nuovo, nelle cinque lingue). Bici e acqua come il disegno è stato fatto;
   in acqua prima l'avviso, come ogni percorso là; la mappa girata come il
   disegno (TASK-232).
4. La corsa salvata dice cosa disegnava (forma, parola, titolo del
   percorso) e ha come percorso la traccia; la somiglianza è il punteggio
   del disegno, come per gli esempi di «Feed» (TASK-188).
5. Fine corsa (o Stop prima di partire): si torna al disegno, e da lì «←»
   o «Back to the profile» tornano dove era stato aperto («Feed», il
   profilo).

## Criteri di accettazione

- [x] Dal «Feed» e dal profilo di un altro, la scheda del disegno ha
      «Start» ed «Export GPX»; senza traccia nessuno dei due.
- [x] «Start» parte subito, senza chiamare `/route-directions`, e la mappa
      mostra la traccia del disegno come percorso.
- [x] «Export GPX» apre il foglio di condivisione con un GPX senza
      `<time>` e senza il nome di chi ha corso; se il telefono non può
      condividere, «The GPX could not be made. Try again.».
- [x] La corsa salvata manda `shape`, `word`, `points` = traccia,
      `similarity` = punteggio / 100.
- [x] Fine corsa → di nuovo il disegno → «←» → «Feed».
- [x] Il testo nuovo approvato dall'utente nelle cinque lingue
      (2026-10-26).
- [x] La scelta dell'utente (2026-10-26): **nessun interruttore**; la
      frase nuova nella pagina «Privacy», in app e sul sito, nelle cinque
      lingue (sotto, «Domande aperte»).
- [x] Le quattro regole fisse del Coordinatore, un test ciascuna su
      `GET /drawings/{id}`, l'unica fonte di «Start» e del GPX
      (`services/api/tests/test_drawing_download.py`): solo un disegno che
      chi legge può già vedere; mai attraverso un blocco; mai un disegno
      nascosto (TASK-121/291); sempre la traccia tagliata, senza i primi e
      gli ultimi 200 m e senza tempi. Nell'app, il GPX senza `<time>` né
      nome (`drawingRoute.test.ts`).
- [x] Impronta iOS invariata, `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3`,
      su una copia pulita con `npm ci`; nessuna dipendenza nuova; i testi
      nuovi in fondo alle tabelle.
- [x] Test deterministici verdi in locale (`npm run test`: 469 file).

## File toccati

```
apps/mobile/App.tsx
apps/mobile/src/social/DrawingCard.tsx
apps/mobile/src/social/drawingRoute.ts                (nuovo)
apps/mobile/src/social/drawingRoute.test.ts           (nuovo)
apps/mobile/src/social/useDrawingGpx.ts               (nuovo)
apps/mobile/src/social/DrawingCardStart.test.tsx      (nuovo)
apps/mobile/__tests__/AppDrawingStart.test.tsx        (nuovo)
apps/mobile/__tests__/AppFeedDrawing.test.tsx
apps/mobile/src/i18n/it.ts
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/fr.ts
apps/mobile/src/i18n/es.ts
services/api/tests/test_drawing_download.py           (nuovo)
apps/mobile/src/about/content/en.ts
apps/mobile/src/about/content/it.ts
apps/mobile/src/about/content/de.ts
apps/mobile/src/about/content/fr.ts
apps/mobile/src/about/content/es.ts
site/privacy/index.html                               (da make_privacy.mjs)
site/privacy/it/index.html
site/privacy/de/index.html
site/privacy/fr/index.html
site/privacy/es/index.html
apps/mobile/src/about/AboutPage.test.tsx              (la data, al merge)
apps/mobile/src/about/documents.test.ts               (la data, al merge)
site/tests/privacy.test.mjs                           (la data, al merge)
docs/tasks/TASK-307.md                                (nuovo)
docs/STATUS.md
docs/DECISIONS.md
docs/UI.md
docs/GPX.md
```

## Fuori scope

- **Le svolte a voce sulla traccia di un altro**: servirebbe agganciare
  la traccia GPS alle strade (map-matching) nell'engine e in
  `/route-directions`. Un task a parte, se l'utente lo vuole.
- **Un «no» di chi pubblica ai download** (interruttore per post o in
  «Settings»): l'utente il 2026-10-26 ha scelto di non farlo.
- «Start» ed «Export GPX» sulle schede del «Feed» senza aprirle.

## Domande aperte (per l'utente) — risposte del 2026-10-26

L'utente: «Nessun interruttore: aggiungi la frase nella pagina Privacy
(app e sito) come proponi. Il testo nuovo sotto «Start» va bene nelle
cinque lingue.» La frase è un paragrafo nuovo subito dopo quello dei
200 m, con il nome del pulsante di ogni lingua («Parti», «Start»,
«Démarrer», «Empezar»); il sito è riscritto da `site/tools/make_privacy.mjs`.
TASK-308 (#576) tocca altri paragrafi degli stessi file: righe diverse.

1. **Il «no» ai download.** Oggi chi pubblica sa che gli altri *vedono*
   la traccia tagliata; non che la possono *scaricare*. Proposta: nessun
   interruttore per ora, perché il file ha esattamente ciò che la mappa
   già mostra (senza i 200 m di casa, senza orari); una frase in più nel
   paragrafo «Your runs and their GPS tracks» della pagina «Privacy», in
   app e sul sito, nelle cinque lingue: «Whoever can see one of your runs
   can also follow it with «Start» and save that same track as a GPX
   file: still without its first and last 200 m and without times.» — it
   «Chi può vedere una tua corsa può anche seguirla con «Start» e salvarne
   la stessa traccia come file GPX: sempre senza i primi e gli ultimi
   200 m e senza orari.» Se l'utente sceglie un interruttore (per post o
   in «Settings») serve l'API: il task si ferma e torna al Coordinatore.
2. **Il testo nuovo** sotto «Start»: «This route has no turn directions:
   follow the line on the map.» — it «Questo percorso non ha le
   indicazioni delle svolte: segui la linea sulla mappa.», de, fr, es nel
   codice.

## Al merge

- [x] Fatto il 2026-10-27, al «mergia 573» dell'utente portato dal
  Coordinatore: «27 October 2026» nelle cinque lingue, nei tre test e nel
  sito; prima `origin/main` unito (#574, #575: la fascia «Winner» di
  TASK-299 B sulla stessa scheda, tenuta insieme a «Start»).
- **La data della «Privacy» diventa quella del giorno del merge**
  (richiesta del Coordinatore, come #556 e #576): oggi è «26 October
  2026», messa il 2026-10-26 alle 23:52, e il merge cade dopo. Se il
  giorno del merge non è il 26 ottobre, prima del merge:
  1. `PRIVACY_UPDATED` in `apps/mobile/src/about/content/{en,it,de,fr,es}.ts`
     («27 October 2026», «27 ottobre 2026», «27. Oktober 2026», «27 octobre
     2026», «27 de octubre de 2026», o il giorno vero);
  2. i test che la nominano: `apps/mobile/src/about/AboutPage.test.tsx`
     (righe del titolo nelle cinque lingue), `apps/mobile/src/about/documents.test.ts`
     (l'espressione della data), `site/tests/privacy.test.mjs` (le cinque
     pagine);
  3. `node site/tools/make_privacy.mjs` per riscrivere `site/privacy/*`;
  4. `npx jest src/about` e i test del sito, poi push e CI verde.
  Questi tre file di test si aggiungono a «File toccati» in quel momento.
  Se #576 entra prima e ha già messo la data del giorno, resta la sua.

## Esito

**Fatto.** In `main` con la #573 (merge `f8dd7964`, 2026-10-27, impronta
iOS `83793e26` invariata): sulla scheda di un disegno aperto, dal «Feed»
o dal profilo, «Start» parte subito sulla traccia tagliata, senza svolte
a voce e con la riga che lo dice, ed «Export GPX» scrive sul telefono la
stessa traccia, senza tempi né nome; la corsa salvata dice ciò che il
disegno disegna, e a fine corsa si torna al disegno. Le quattro regole
fisse hanno un test ciascuno nell'API. Scelte dell'utente del 2026-10-26:
nessun interruttore per chi pubblica, una frase nuova nella «Privacy» in
app e sul sito (datata 27 ottobre 2026), il testo sotto «Start» nelle
cinque lingue. Sulla stessa scheda convive la fascia «Winner» di TASK-299
B. Arriva sui telefoni con il prossimo aggiornamento OTA, che pubblica il
Coordinatore. Rimandato: le svolte a voce sulla traccia di un altro
(map-matching nell'engine), un task a parte se l'utente lo vuole.
