# TASK-360 — Il regolamento del concorso senza tema non sta più sotto la barra di stato

**Stato**: Done · 2026-10-31
**Fase**: 4 · **Branch**: `fix/TASK-360-contest-rules-inset`
**Numeri**: TASK-360, assegnato dal Coordinatore il 2026-10-30. Difetto
trovato provando TASK-343 B.

## Obiettivo

«How it works» sulla scheda di un concorso **senza tema** apre il regolamento
con «MuW contest» sotto l'orologio. Conta per il concorso che apre il
2026-11-16, se resta senza tema. Alla fine il regolamento comincia sotto la
barra di stato, con i testi di prima.

## La causa

Il `Pager` dà alle sue pagine un `SafeAreaInsetsContext` con `top: 0`, perché
il margine alto lo tiene la sua intestazione. La scheda sta dentro quelle
pagine, e `ContestRules` copriva tutto lo schermo con il margine letto da lì.
Con un tema il regolamento si apre dalla pagina della sfida, che ha i margini
veri: lì il difetto non si vedeva.

## Cosa cambia

`ContestRules` tiene nel `Modal` un suo `SafeAreaProvider`, come `Tour.tsx`, e
la pagina (`RulesPage`) legge i margini da lì. `initialMetrics` li dà già al
primo disegno, senza un salto durante l'animazione. `Pager.tsx` e
`ContestCard.tsx` non cambiano. Nessun testo nuovo, nessuna dipendenza, niente
di nativo, nessuna modifica al server.

## Criteri di accettazione

- [x] Difetto riprodotto nel simulatore, con API locale e concorso senza tema:
      «MuW contest» sotto l'orologio.
- [x] Dalla scheda del Feed il regolamento comincia sotto la barra di stato.
- [x] Con un tema, dalla pagina della sfida, resta corretto.
- [x] I testi del regolamento sono quelli di prima.
- [x] Test deterministico: senza la correzione lo spazio sopra il regolamento
      è 24, con la correzione 83 (59 di margine + `space.xl`).
- [x] Impronta iOS `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3` su copia pulita.

## File toccati

```
apps/mobile/src/contest/ContestRules.tsx
apps/mobile/src/contest/ContestRulesInset.test.tsx
docs/CONCORSI.md
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-360.md
```

## Fuori scope

- **Android non è provato**: la prova è sul simulatore iOS.
- **Altre finestre da guardare, non verificate.** Queste leggono `insets.top`
  dentro un `Modal` e potrebbero avere lo stesso difetto se si aprono da una
  pagina del `Pager`: `share/SharePost.tsx`, `messages/SendToFriend.tsx`,
  `messages/DrawingPicker.tsx`, `messages/MediaViewer.tsx`,
  `route/OutlineBoard.tsx`, `paddle/PaddleNotice.tsx`,
  `social/SuperLikeSheet.tsx`. Non le ho aperte: serve un task a parte.

## Esito

Il regolamento di un concorso senza tema comincia sotto la barra di stato;
quello con tema resta corretto. Visto su iPhone Air (iOS 27) in Expo Go, con
API locale e database usa e getta.
