# TASK-313 — «Draw it near me»: la stessa forma in un altro posto

**Stato**: Done · in `main` con la #586 (2026-10-28)
**Fase**: 4 · **Branch**: `feat/TASK-313-draw-it-near-me`

## Obiettivo

Da un percorso di «Explore» o dal disegno di un iscritto si arriva a
«Draw» con la stessa forma (o la stessa parola) e la stessa distanza già
scelte, per disegnarla dove si vuole. Richiesta dell'utente del
2026-10-27: «possibilità di selezionare un'immagine dal Feed o da Explore
e chiedere di fare la stessa immagine in un altro posto»; alla proposta
(il pulsante «Draw it near me» che apre «Draw», contro uno che disegna
subito dove si è) ha risposto «Sì, così». Numero e ordine dal Coordinatore
(ADR-0273, vicino ad ADR-0267 ma un'altra scelta: ridisegnare, non
seguire la traccia di un altro). Entra prima di TASK-309 B, che tocca le
stesse schede e si riallinea.

Condizioni del Coordinatore: del percorso dell'altro viaggiano solo forma
(o parola con le sue lettere) e distanza; nessuna richiesta di percorso
prima di «Draw route», con un test; una forma non più nel catalogo o una
parola che non passa il controllo non hanno il pulsante, con un test; lo
sport resta quello di «Settings» (un disegno in bici, per chi corre, si
ridisegna di corsa); impronta iOS `83793e26` su una copia pulita, nessuna
dipendenza, i testi col sì dell'utente.

## Contesto da leggere

- `docs/UI.md`, «Correre il disegno, e scaricarlo» (la scheda del
  disegno) e la scheda di un percorso di «Explore».
- `docs/DECISIONS.md` ADR-0267 (TASK-307, «Start» sul disegno), ADR-0149
  (la distanza di «Draw»), ADR-0053 (forma o parola).

## Cosa fare

1. `src/route/drawAgain.ts` (nuovo): dalla richiesta di un percorso di
   «Explore» o dai campi di un disegno, la figura da scegliere in «Draw»
   (una forma del catalogo, o una parola con le sue lettere) e la sua
   distanza; niente per una foto, un'immagine o una forma sconosciuta.
2. «Draw it near me» nella scheda di un percorso di «Explore»
   (`ExploredCard`, sotto «Start») e in quella di un disegno
   (`DrawingCard`, dopo «Start» ed «Export GPX», che non si spostano; la
   fascia «Winner» resta com'è), solo quando «Draw» si apre senza errori
   con lo sport di «Settings»: niente per una forma che l'app non conosce
   o una parola che «Draw» rifiuterebbe.
3. In `App.tsx` il tocco sceglie forma o parola, lettere e distanza di
   «Draw», lascia il percorso o il disegno e mostra «Draw». La partenza
   resta quella di «Draw»; niente si chiede prima di «Draw route».
4. Il disegno si lascia senza riaprire «Profile» o «Find friends» dietro
   la mappa: `leave()` nel drawingsDoor, `onLeave` in `ProfileLayer`.
5. Il testo nuovo in fondo alle tabelle, nelle cinque lingue.

## Criteri di accettazione

- [x] Da un percorso di «Explore» (forma), il tocco porta a «Draw» con la
      forma e i km del percorso, la partenza di prima, nessuna richiesta
      all'API (`__tests__/AppDrawAgain.test.tsx`).
- [x] Da una parola di «Explore», «Draw» ha «Word», la parola e
      «Square» se era squadrata.
- [x] Da un disegno del «Feed», «Draw» ha la forma e i km corsi al
      decimo (4004 m → «4»); il disegno è chiuso e non torna dietro
      «Feed»; nessun `POST /route-jobs` né `/route-directions`.
- [x] Una foto o un'immagine, una forma che l'app non conosce, una parola
      che «Draw» rifiuterebbe («ÉTÉ», «CIAO!», due parole, troppe
      lettere): niente pulsante; «Start» resta.
- [x] Distanza: al decimo di km, una parola mai sotto i 3 km a lettera,
      dentro i limiti dello sport di «Draw»; una parola in «Paddle» non ha
      il pulsante (`src/route/drawAgain.test.ts`).
- [x] Il testo nuovo approvato dall'utente nelle cinque lingue: «Draw it
      near me» · it «Disegnala vicino a me» · de «In meiner Nähe
      zeichnen» · es «Dibujarla cerca de mí» · fr «La dessiner près de
      moi».
- [x] Impronta iOS invariata (`83793e26`) su una copia pulita con
      `npm ci`; nessuna dipendenza nuova.
- [x] Test deterministici verdi in locale (`jest`: 489 file, 3957 test;
      `tsc` senza errori nuovi, `expo lint`, Prettier).

## File toccati

```
apps/mobile/App.tsx
apps/mobile/src/route/drawAgain.ts                    (nuovo)
apps/mobile/src/route/drawAgain.test.ts               (nuovo)
apps/mobile/__tests__/AppDrawAgain.test.tsx           (nuovo)
apps/mobile/src/explore/ExploredCard.tsx
apps/mobile/src/social/DrawingCard.tsx
apps/mobile/src/social/drawingsDoor.ts               (`leave`, ok del Coordinatore)
apps/mobile/src/social/DrawingsGrid.test.tsx          (una riga: il door di prova ha `leave`, ok del Coordinatore)
apps/mobile/src/screens/ProfileLayer.tsx              (`onLeave`, ok del Coordinatore)
apps/mobile/src/i18n/it.ts
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/fr.ts
apps/mobile/src/i18n/es.ts
docs/tasks/TASK-313.md                                (nuovo)
docs/STATUS.md
docs/DECISIONS.md
docs/UI.md
```

## Fuori scope

- **Un'immagine o una foto da un post**: il disegno ne tiene solo il
  titolo. Servirebbe salvare nel disegno l'id dell'immagine scelta (un
  campo nuovo nell'API e nel contratto): un task a parte, se l'utente lo
  vuole.
- **Disegnare subito dove si è**, senza passare da «Draw»: l'utente ha
  scelto il pulsante che apre «Draw».
- Il pulsante sulle schede del «Feed» e di «Explore» senza aprirle.
- I percorsi a tema di «Explore» (passano da quei luoghi).

## Esito

In `main` con la #586 (2026-10-28). Il testo «Draw it near me» nelle
cinque lingue approvato dall'utente il 2026-10-28 («vanno bene si»,
nella chat del Coordinatore). Riallineata a `main` dal Coordinatore
(conflitti solo di righe aggiunte in fondo ai file); impronta iOS
`83793e26` misurata su una copia pulita con `npm ci`. Arriva
sul canale `preview` con la prossima pubblicazione del Coordinatore.
