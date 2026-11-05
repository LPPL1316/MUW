# TASK-392 — Il logo stilizzato nell'header, non più in cima a «Draw»

**Stato**: Done · 2026-11-05 · **Esito**: #787 in `main` (650d7685);
l'header di ogni pagina della barra ha il cuore su giallo e «MuW» grande,
«Draw» non ha più il logo. Anteprima pubblicata dal Coordinatore; l'altezza
dell'header la guarda l'utente sul telefono; OTA di produzione col suo sì.
**Fase**: 4 · **Branch**: `feat/TASK-392-header-logo`
**Numeri**: TASK-392, assegnato dal Coordinatore. Precisazione di ADR-0311
(TASK-367), nessun ADR nuovo.

## Obiettivo

L'utente, il 2026-11-05, guardando l'header e la pagina «Draw» sul telefono:
«In cima l'applicazione dove c'è il cuore solo l'emoji e la scritta MuW
voglio che sia come font come logo come nella sezione disegno quindi con il
cuore stilizzato e poi nella sezione disegno cancellalo a fianco a Run
without a route».

Con TASK-367 l'utente aveva detto che i loghi dentro le pagine restavano:
queste parole cambiano quella scelta per «Draw».

## Cosa c'era

- L'header delle pagine della barra (`tabs/AppHeader.tsx`, ADR-0311): il
  cuore pieno di Lucide (`assets/ui/tabs/heart.png`, 22 punti, giallo
  `accent`) e «MuW» in `font.heading`.
- In cima a «Draw» (`screens/ChooseScreen.tsx`): il cuore su giallo
  (`HeartBadge`, 32 punti, TASK-221) e «MuW» in `fontSize.title` grassetto, a
  sinistra di «Run without a route».

## Cosa cambia

- L'header mostra il logo di «Draw»: `HeartBadge` da 32 punti e «MuW» in
  `fontSize.title`, grassetto. Il lettore di schermo legge sempre «MuW», una
  volta.
- In cima a «Draw» il logo non c'è più: resta «Run without a route», a
  destra come prima.
- `assets/ui/tabs/heart.png` resta nel repository, non più usato
  dall'header (cancellarlo è fuori scope).

Solo JS, nessun testo nuovo, nessuna dipendenza: impronta iOS invariata.

## Criteri di accettazione

- [x] Nell'header il cuore su giallo sta subito prima di «MuW»
      (`HeartBadge.test.tsx`).
- [x] L'header si legge come «MuW», una volta; il cuore resta nascosto al
      lettore di schermo.
- [x] In cima a «Draw» non c'è né il cuore né «MuW»; «Run without a route»
      c'è.
- [x] I test di `ChooseScreen`, `TabShell`, `App` restano verdi; tsc, lint
      e Prettier verdi in locale sui file toccati.
- [x] CI verde (#787, unita dal Coordinatore).
- [ ] Visto sul telefono (anteprima del Coordinatore): in locale non è
      stato visto nel simulatore.

## File toccati

```
apps/mobile/src/tabs/AppHeader.tsx
apps/mobile/src/screens/ChooseScreen.tsx
apps/mobile/src/intro/HeartBadge.test.tsx    (il test del logo in Draw passa all'header)
docs/tasks/TASK-392.md                       (nuovo)
docs/STATUS.md
docs/DECISIONS.md
docs/UI.md
```

## Fuori scope

- Il cuore su giallo in «Explore» e nella pagina «Paddle»: l'utente ha
  chiesto solo di «Draw».
- Cancellare `assets/ui/tabs/heart.png`.
