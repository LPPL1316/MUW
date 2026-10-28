# TASK-318 — Gli sport non pronti nascosti nelle build dello store

**Stato**: Done · in `main` con la PR di questo task (2026-10-28)
**Fase**: 4 · **Branch**: `feat/TASK-318-hide-soon-in-store`

## Obiettivo

Nelle build dell'App Store e di Google Play, e negli update fatti per
loro, gli sport non ancora pronti non si vedono: oggi è solo
«Paragliding · Soon» (TASK-305 D0, #591), in «Settings» e nel menu degli
sport di «Draw». In Expo Go e sul canale `preview` resta tutto com'è.
Scelta dell'utente del 2026-10-28, nella chat del Coordinatore:
«nascondi Soon nello store». Il parapendio dipende da una licenza dello
spazio aereo che non c'è ancora, e agli utenti veri non si promette.
Numero e ADR (ADR-0278) dal Coordinatore, che fa il task da sé perché il
primo update `production` (sì dell'utente: «sì 2, fai l'OTA dopo il
server») aspetta questo.

## Contesto da leggere

- `docs/tasks/TASK-305.md`, parte D0; ADR-0165 e ADR-0265.
- `apps/mobile/app.config.ts` e `docs/DEPLOY.md` A.7 (il runtime della
  build dello store).

## Criteri di accettazione

- [x] In una build dello store `SPORTS` non ha «Paragliding»: niente riga
      «Soon» in «Settings» né nel menu di «Draw» (test).
- [x] In Expo Go e `preview` (runtime `exposdk:57.0.0`) tutto come prima:
      i test di TASK-305 D0 non cambiano.
- [x] Come si riconosce una build dello store, con test sui casi: runtime
      `{ policy: "fingerprint" }` o un hash sì; `exposdk:…`, niente
      runtime o niente config no.
- [x] Nessun testo nuovo, nessuna dipendenza nuova (`expo-constants` c'è
      già); impronta iOS `83793e26` su una copia pulita con `npm ci`.
- [x] Test deterministici verdi (`jest`, `tsc`, ESLint, Prettier).

## File toccati

```
apps/mobile/src/settings/sport.ts
apps/mobile/src/settings/SportStoreBuild.test.tsx   (nuovo)
docs/tasks/TASK-318.md                              (nuovo)
docs/STATUS.md
docs/DECISIONS.md                                   (ADR-0278 in fondo)
```

## Fuori scope

- Togliere «Soon» anche da `preview`: l'utente lo vuole lì.
- La riga di `docs/UI.md` su «Soon» in «Settings» (già vecchia da
  TASK-305 D0): resta a chi tocca quella pagina.

## Esito

`sport.ts` ha ora `ALL_SPORTS` (tutti, come prima `SPORTS`),
`isStoreBuild()` e `shownSports()`; `SPORTS`, quello che «Settings» e il
menu di «Draw» usano di default, è `ALL_SPORTS` meno gli sport non pronti
quando la build è dello store. I componenti non cambiano. Arriva sui
telefoni dello store con il primo update `production`.
