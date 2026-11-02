# TASK-356 — La posizione nel Feed: arrotondata, e detta nella privacy

**Stato**: Done · 2026-10-31 (PR #682)
**Fase**: 4 · **Branch**: `fix/TASK-356-feed-position` · numero dal
Coordinatore (2026-10-30), nessun ADR nuovo: la decisione è ADR-0306, punto 4

## Obiettivo

`GET /feed` manda già `lat` e `lon` del telefono, non arrotondati, da
TASK-118, e «Your position» non lo dice: il testo pubblicato nell'app e sul
sito è incompleto. Alla fine il punto parte con due decimali e il testo lo
dice.

## Contesto da leggere

- `docs/tasks/TASK-355.md`, «Scoperto strada facendo» e scelta 7.
- `docs/API.md`, «Feed», «I vicini».

## Cosa fare

1. `api/feed.ts`: `feedPath` scrive il punto con due decimali (circa 1 km; il
   raggio dei vicini è di 50 km). Ogni pagina di una lettura dice lo stesso
   punto, perché il valore dipende solo dal punto tenuto da `useFeed`.
2. `about/content/*.ts`: la frase di «Your position», in cinque lingue.
3. `site/privacy` rigenerato con `site/tools/make_privacy.mjs`.

**Il testo**, approvato dall'utente il 2026-10-30 con «Sì, approvo»: «It goes
to our server as the start of a route you ask for, inside a run you save,
with a search for a place, to put the places near you first, and, rounded to
about 1 km, to show you drawings nearby in the Feed.» Le altre quattro lingue
ne sono la traduzione, dell'agente.

**La data** della privacy è già 30 ottobre 2026 (TASK-352): va cambiata solo
se il merge cade in un altro giorno. Il Coordinatore la vuole al giorno del
merge.

## Criteri di accettazione

- [x] `feedPath` non scrive mai più di due decimali: test.
- [x] Le pagine di una lettura dicono lo stesso punto: test.
- [x] La frase nelle cinque lingue, nell'app e in `site/privacy`.
- [x] CI verde; impronta iOS `83793e26` su una copia pulita.
- [x] La data della privacy è il giorno del merge.

## File toccati

```
apps/mobile/src/api/feed.ts, feed.test.ts
apps/mobile/src/feed/useFeed.test.tsx
apps/mobile/src/screens/FeedScreenPosts.test.tsx
apps/mobile/__tests__/App{DrawAgain,DrawingStart,EditDrawing,FeedDrawing}.test.tsx
apps/mobile/src/about/content/{en,it,de,fr,es}.ts
site/privacy/index.html, {it,de,fr,es}/index.html
docs/API.md, docs/STATUS.md, docs/tasks/TASK-356.md
```

## Fuori scope

- Pubblicare il sito e l'OTA di produzione: due sì dell'utente, a parte.
- Le etichette App Privacy e Data safety: le controlla l'utente.
- **Le altre posizioni non arrotondate.** `GET /recommended-routes`
  (`api/recommended.ts`, `explore/recommendedRoutes.ts`) manda il punto intero,
  e «Your position» non cita nemmeno quelle: segnalato al Coordinatore.

## Esito

In `main` con la #682. Il punto di `GET /feed` parte con due decimali e la frase è nelle cinque lingue, con la data del 31 ottobre. Sito e OTA di produzione non sono pubblicati: aspettano il sì dell'utente. La stessa frase è poi riscritta da TASK-363.
