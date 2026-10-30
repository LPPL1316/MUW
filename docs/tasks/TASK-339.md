# TASK-339 — L'interfaccia premium ed elegante: tipografia, neutri caldi, immagini, movimento, dettagli

**Stato**: In lavorazione · parte A in `main` (#658, 2026-10-30) ·
**parte B pronta, in PR dal 2026-10-30** (branch
`feat/TASK-339-premium-look-b`); numeri e condizioni dal Coordinatore il
2026-10-30
**Fase**: 4 · **Branch**: `feat/TASK-339-premium-look-a` (A, in `main`),
`feat/TASK-339-premium-look-b` (B), poi uno per parte · **ADR**: ADR-0293

## Obiettivo

Richiesta dell'utente del 2026-10-29, incollata parola per parola:

> Ridisegna l'interfaccia dell'app per dare una sensazione premium ed
> elegante, senza stravolgere lo stile attuale.
> - Tipografia più raffinata: titoli grandi e leggeri, testo corpo ben
>   leggibile, letter-spacing curato
> - Palette ridotta: 1 colore d'accento usato con parsimonia, neutri caldi
>   o freddi
> - Immagini protagoniste, con angoli arrotondati e leggeri gradienti per
>   il testo sovrapposto
> - Micro-animazioni discrete: transizioni morbide, feedback al tocco
> - Supporto dark mode curato, non semplicemente "invertito"
> - Dettagli: separatori sottili, stati vuoti con illustrazione e
>   messaggio gentile
>
> L'app deve sembrare un prodotto curato da uno studio di design, non un
> template.

Alla fine l'app ha una scala tipografica sola (titoli grandi e leggeri,
corpo con interlinea), grigi caldi accanto al giallo nei due toni, le foto
e i disegni a tutta scheda con le parole su un velo scuro, un solo
feedback al tocco in tutta l'app, divisioni a filo e pagine vuote
disegnate. Niente di nativo cambia: tutto va in un aggiornamento OTA.

La proposta visiva, 16 tavole (prima/dopo di Feed, Explore, Profile, un
vuoto, il tono chiaro; le schede interne: Draw, l'attesa, la ricerca, il
risultato, la corsa, la fine, Settings, i messaggi, l'accesso; il foglio
del sistema): https://claude.ai/artifact/XRMFiZ9BWbWnKkdJ9Udtjf. Vista
dall'utente la sera stessa («BELLISSIMO»), che ha chiesto le schede
interne, aggiunte. La scelta fra neutri caldi e freddi, lasciata aperta
dal brief, è la raccomandazione dell'agente (caldi: un grigio senza tinta
legge freddo accanto al giallo), accettata su delega dell'utente del
2026-10-29, da rivedere.

## Contesto da leggere

- `docs/UI.md`, «Il tema» e «Il look premium»;
- ADR-0293 in `docs/DECISIONS.md` (e ADR-0046, ADR-0231, ADR-0081,
  ADR-0183 che estende);
- `apps/mobile/src/theme/tokens.ts`, `src/theme/palettes.test.ts`;
- per le parti B–E, il file della schermata e il task che la tiene
  occupata (`STATUS.md`, «In lavorazione»).

## Cosa fare

Una PR per parte. Ogni parte tocca solo i suoi file; una schermata di un
task in lavorazione aspetta che quel task entri in `main`.

**A — le fondamenta** (questa sessione).

1. `tokens.ts`: `font` (display 44 light −1, title 30 regular −0,6,
   heading 20 medium −0,3, cardTitle 17 medium −0,2, body 15/22, small
   13/18, detail 12/16, label 11 semibold +1,2), `tracking`,
   `fontWeight.light`, `fontSize.heading`, `radius.xl` 20, `motion`
   (tocco 0,97 e 0,85 in 120/180 ms, comparsa 220 ms e 6 pt, fogli
   280 ms), `color.hairline` (il testo al 20 %); i grigi caldi nei quattro
   estremi di `SHADES` (anche la mappa; l'acqua no), `onAccent` e `scrim`
   `#0B0A08`. I contrasti di `palettes.test.ts` restano quelli.
2. `src/ui/`: `Tap` (il feedback al tocco, Animated sul driver nativo),
   `Hairline`, `Scrim` (con `assets/ui/scrim.png`, disegnato da
   `tools/ui_scrim.py`), `EmptyState` (sagoma del catalogo in filigrana,
   l'inizio in giallo, titolo, frase, un'azione), `outlines.ts` (il
   cuore); i test.
3. `Pager.tsx`: i tre nomi in alto a 30 regular, gli altri in `textFaint`,
   il segno sotto più sottile.
4. `UI.md`, `DECISIONS.md`, `STATUS.md`, questo file.

**B — Feed ed Explore, le immagini protagoniste**: `FeedPost`,
`RouteCard`, `ThemedCard`, `ExploredCard`, `DrawingCard`: raggio 20, senza
bordo, le parole sulla foto su `Scrim`, titolo `font.cardTitle`; sui
disegni le parole restano sotto, per non coprire la figura. Attenzione a
TASK-336 (il video nei post, `FeedPost`) e TASK-309 B (`FeedScreen`).
Fatta sopra la #666 (TASK-350, ADR-0302: nelle schede di «Explore» prima
il disegno e con uno swipe la foto), entrata in `main` prima della B: la
foto di una scheda di «Explore» è una pagina dopo il disegno, sotto le
stesse parole, quindi `Scrim` e le parole sopra la foto stanno solo in
«Feed».

**C — stati vuoti e separatori**: `EmptyState` in Favorites, My
activities, messaggi, liste follow, Feed senza account (testi nuovi da
approvare, in cinque lingue); `Hairline` al posto delle divisioni a 1 pt;
i 66 `styles.pressed` a `Tap` nei file liberi.

**D — Profile, Settings, i fogli**: `ProfileHome`, `ProfileHeader`,
`Settings`, `SuperLikeSheet`, `MessageSheet`: numeri `font.display`
tabulari, righe a filo, titoli leggeri.

**E — «Draw» e il risultato**: `RoutePanel` (la distanza in
`font.display`, le etichette), `ChooseScreen`, il risultato; per ultima,
dopo TASK-311 B, 331 e 335.

**Non ora**: la vibrazione al tocco (`expo-haptics`, nativa: con la
prossima build e il sì dell'utente); un tono «di sistema» che segue il
telefono (scelta di prodotto, da chiedere).

**Alla fine, da rifare**: le schermate dell'App Store (TASK-328) mostrano
l'app di prima; dopo la parte E vanno rifatte con il look nuovo (nota del
Coordinatore del 2026-10-30).

## Condizioni del Coordinatore (2026-10-30, parte A)

- `tokens.ts`, `palettes.test.ts`, `Pager.tsx` e `src/ui/` sono liberi;
  su `docs/UI.md` chi entra dopo si riallinea (la #643 e la #644 lo
  toccano).
- Neutri caldi e titoli leggeri: «raccomandata» sotto la delega, «da
  rivedere»; l'utente la vede sulla preview prima di qualsiasi OTA di
  produzione. Citare il «BELLISSIMO» dell'utente sul canvas (la sera del
  2026-10-29, verso mezzanotte).
- I test di contrasto restano verdi nei due toni.
- Nessuna libreria nuova, nessun file nativo: impronta iOS `83793e26` su
  una copia pulita della testa (`npm ci`).
- Il PNG alfa in `assets/` va bene.
- In testa alla PR, prima e dopo dei tre schermi principali, in chiaro e
  in scuro (screenshot dal simulatore).
- Con «Riduci movimento» acceso le micro-animazioni si spengono, con un
  test (`useReduceMotion`, `Tap`).
- Ordine A→B→C→D→E; la B parte dopo le PR aperte su `FeedPost` e
  `FeedScreen` (TASK-336 A e 309 B possono arrivare: chiedere prima); la E
  per ultima. Haptics solo con la build nativa, col sì dell'utente.
- «#NNN pronta» al Coordinatore con la testa.

## Condizioni del Coordinatore (2026-10-30, parte B)

- Via dato il 2026-10-30 (il primo messaggio delle 15:40 era rimasto in
  coda; ripetuto alle 15:55), a patto di partire da `main` con dentro la
  #658 (parte A) e la #666 (TASK-350, `RouteCard` con le due pagine).
- Le stesse condizioni della A: nessuna dipendenza, nessun file nativo,
  impronta iOS `83793e26` su una copia pulita della testa; prima e dopo
  di «Feed» ed «Explore» nei due toni in testa alla PR; nessun testo nuovo.
- `FeedPost.tsx`, `RouteCard.tsx`, `ThemedCard.tsx`, `ExploredCard.tsx`,
  `DrawingCard.tsx` sono della B finché è aperta (TASK-336 A, 309 B e 348
  aspettano); la #660 (TASK-345 A, le calorie) è entrata in `main` prima,
  e la B la tiene (`postEnergy` nei fatti).
- «#NNN pronta» al Coordinatore con la testa; lui mergia al verde.

## Criteri di accettazione

Parte A:

- [x] `tokens.ts` esporta `font`, `tracking`, `motion`, `radius.xl`,
      `fontSize.heading`, `fontWeight.light`, `color.hairline`; i grigi
      sono quelli della tabella di `UI.md`; `palettes.test.ts` verde con
      gli stessi minimi di contrasto.
- [x] `src/ui/Tap`, `Hairline`, `Scrim`, `EmptyState` esistono, con test
      deterministici; `python tools/ui_scrim.py` rigenera il PNG uguale.
- [x] Con «Riduci movimento» acceso `Tap` non anima (`useReduceMotion`),
      con un test.
- [x] Impronta iOS `83793e26` misurata su una copia pulita della testa.
- [x] In testa alla PR: prima e dopo di Feed, Draw ed Explore, in scuro e
      in chiaro, dal simulatore.
- [x] In alto, «Feed · Draw · Explore» a 30 regular; la pagina su schermo
      si distingue per la luce, non per il giallo.
- [x] Nessuna dipendenza nuova; l'impronta nativa non cambia (solo JS e un
      PNG).
- [x] `UI.md` («Il tema», «Il look premium»), ADR-0293, `STATUS.md`
      aggiornati.

Parte B:

- [x] `FeedPost`, `RouteCard`: raggio `radius.xl` (20), nessun bordo,
      fondo `surface`; il titolo in `font.cardTitle` sotto il disegno, i
      fatti e il dettaglio in `textMuted` (in «Explore» il dettaglio resta
      a 12: a mezza larghezza «Best Views · 8.1 km» non ci starebbe).
- [x] In «Feed», sulle pagine delle foto le parole stanno sopra la foto,
      in `font.heading` e `font.small` chiare (`onScrim`) su `Scrim` alto
      150; sotto il disegno restano sotto. La pagina è alta quanto il
      disegno con le sue parole, la foto la riempie.
- [x] Avatar e nomi in `fontWeight.medium`, non grassetto; l'avatar senza
      bordo; i nomi taggati in `DrawingCard` medium.
- [x] Il tocco sulle schede, sulle loro pagine e sui loro bottoni passa da
      `Tap` (niente più `opacity: 0.6` in questi file); gli altri
      `pressed` dell'app restano per la C.
- [x] `Hairline` prima delle azioni in `ThemedCard`, `ExploredCard` e
      `DrawingCard` (prima delle reazioni); il giallo resta solo a «Start»
      e a «Make it near me», che ne prende il posto.
- [x] La distanza delle schede di «Explore» (`ThemedCard`, `ExploredCard`)
      in `font.display` con le cifre tabulari.
- [x] Test deterministici per ogni scheda: lo stile (raggio, pesi, le
      parole sulla foto, lo scrim), un `Hairline` solo, `Animated.timing`
      chiamato con `motion.pressMs` alla pressione.
- [x] Nessun testo nuovo, nessuna dipendenza, niente di nativo: impronta
      iOS su una copia pulita della testa (`npm ci`), invariata.
- [x] In testa alla PR: prima e dopo di «Feed» ed «Explore» (la testa e
      la fila «Ideas from Europe») nei due toni, dal simulatore; le
      schermate in `tasks/TASK-339/b-*.jpg`.

Parti C–E: i loro criteri si scrivono qui quando partono.

## File toccati

Parte A:

```
apps/mobile/src/theme/tokens.ts
apps/mobile/src/theme/palettes.test.ts
apps/mobile/src/ui/Tap.tsx, Tap.test.tsx, TapStill.test.tsx         (nuovi)
apps/mobile/src/ui/useReduceMotion.ts, useReduceMotion.test.tsx     (nuovi)
apps/mobile/src/ui/Hairline.tsx, Hairline.test.tsx       (nuovi)
apps/mobile/src/ui/Scrim.tsx, Scrim.test.tsx             (nuovi)
apps/mobile/src/ui/EmptyState.tsx, EmptyState.test.tsx   (nuovi)
apps/mobile/src/ui/outlines.ts                           (nuovo)
apps/mobile/assets/ui/scrim.png                          (nuovo)
apps/mobile/src/screens/Pager.tsx
apps/mobile/src/map/mapPageTone.test.ts                 (il fondo scuro della mappa, caldo anch'esso; col via del Coordinatore del 2026-10-30)
tools/ui_scrim.py                                        (nuovo)
docs/UI.md, docs/DECISIONS.md, docs/STATUS.md, docs/INDEX.md, docs/tasks/TASK-339.md
docs/tasks/TASK-339/*.jpg                                (12 schermate prima/dopo dal simulatore, nuove)
```

Parte B:

```
apps/mobile/src/feed/FeedPost.tsx, FeedPost.test.tsx, FeedPostPhotos.test.tsx
apps/mobile/src/explore/RouteCard.tsx, RouteCard.test.tsx
apps/mobile/src/explore/ThemedCard.tsx, ThemedCard.test.tsx
apps/mobile/src/explore/ExploredCard.tsx, ExploredCard.test.tsx
apps/mobile/src/social/DrawingCard.tsx, DrawingCardStart.test.tsx
docs/UI.md, docs/STATUS.md, docs/tasks/TASK-339.md
docs/tasks/TASK-339/b-*.jpg                              (12 schermate prima/dopo dal simulatore, nuove)
```

## Fuori scope

- Un carattere tipografico proprio: il font di sistema ha già i pesi
  leggeri, e un file nuovo cambierebbe il marchio.
- Librerie di gradienti, SVG, animazioni o vibrazione: native, e la 1.0.1
  deve tenere l'impronta.
- Cambiare `fontSize.title` per tutti: 53 punti in grassetto
  diventerebbero più pesanti, non più leggeri; si migra schermata per
  schermata.
- Nuove funzioni: questo task cambia l'aspetto, non cosa fa l'app.

## Esito

*(a fine task)* Parte A, 2026-10-30: `font`, grigi caldi, `motion`,
`hairline`, `src/ui/` (Tap con «Riduci movimento», Hairline, Scrim,
EmptyState), i tre nomi in alto; 538 test dell'app più gli 11 nuovi verdi;
impronta iOS `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3` su una copia pulita
(`npm ci`); le 12 schermate prima/dopo in `docs/tasks/TASK-339/`. Non vista
su un iPhone vero: arriva con la prossima preview.

Parte B, 2026-10-30: le cinque schede col raggio 20 e senza bordo, le
parole di «Feed» sulla foto su `Scrim` (150) e sotto il disegno in
`cardTitle`, i nomi medium, `Tap` al posto dell'opacità, `Hairline` prima
delle azioni, la distanza di «Explore» in `display`; una scelta presa su
delega: le parole sopra la foto sono nascoste allo screen reader, che
sente la scheda come una cosa sola, così il titolo non si ripete (e le
pagine di «Feed» restano verdi). Nelle schede di «Explore» il dettaglio
resta a 12 punti: a mezza larghezza un punto in più tagliava «8.1 km».
Verificato: le 105 suite attorno alle schede e alle loro pagine (734
test) più i 24 test nuovi o cambiati, `tsc`, Prettier, `expo lint`;
impronta iOS `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3` su una copia
pulita (`npm ci`); le 12 schermate `b-*.jpg` dal simulatore (iPhone 17e,
Expo Go). Non vista su un iPhone vero: arriva con la prossima preview.

Parte B in `main` con la PR #677 (`4faeceb2`, 2026-10-30 23:16 CET), mergiata
al verde; prima del merge tutte le 557 suite dell'app verdi nella copia
pulita. Il branch `feat/TASK-339-premium-look-b` è cancellato.
