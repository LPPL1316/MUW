# TASK-328 — Le schermate nuove dell'App Store nel repository

**Stato**: Done — PR `chore/TASK-326-store-screenshots`
**Fase**: 4 · **Branch**: `chore/TASK-326-store-screenshots` · numero dato
dal Coordinatore il 2026-10-29 come TASK-326, ma TASK-326 era già preso nel
repository MUW (il passo medio nel Feed, nato il 2026-10-28 alle 23:22Z).
Rinumerato TASK-328 dal Coordinatore il 2026-10-29, con il sì
dell'utente, quando i due `main` si sono uniti; il branch e la PR #623
tengono il nome vecchio

## Obiettivo

`apps/mobile/store/` contiene le 7 schermate del 2026-10-29, le stesse
mandate in revisione ad Apple, così un `npx eas-cli metadata:push` futuro
(`DEPLOY.md` A.7, punto 5) non rimette sulla scheda le 5 vecchie.

Richiesta dell'utente del 2026-10-29: immagini più belle per l'App Store
(nelle vecchie si vedeva la batteria nella barra in alto) e un video di
anteprima. Una sessione ha fatto 7 schermate nuove dall'app vera nel
simulatore iOS (Barcellona: cuore, gatto, «RUN»; New York: «Explore»;
il Feed), un'immagine nuova per l'intestazione e una per i risultati di
ricerca, e un video di 29 s, tutto in `out/appstore-v2/` della copia
principale (ignorata da git). Con il sì dell'utente sono state caricate
nella «Libreria di risorse» di App Store Connect e mandate in revisione ad
Apple il **2026-10-29 alle 00:53**.

## Contesto da leggere

- `docs/DEPLOY.md` A.7, punto 5 (testi e screenshot della scheda);
- `docs/tasks/TASK-152.md`, parte B (dove sono nati `store.config.json` e
  `store/screenshots/`).

## Cosa fare

1. Togliere le 5 schermate vecchie da `apps/mobile/store/screenshots/`
   (`iphone-69-1-heart-route.jpg` … `iphone-69-5-draw.jpg`).
2. Copiarci le 7 nuove da `out/appstore-v2/upload/` (`muw-01-heart.jpg`
   … `muw-07-feed.jpg`, 1320×2868, JPEG senza trasparenza), con i nomi
   `iphone-69-N-<nome>.jpg`.
3. Mettere i 7 file in ordine in `screenshots.APP_IPHONE_67` di
   `apps/mobile/store.config.json`: cuore, gatto, parola, Draw, corsa,
   Explore, Feed.
4. `npx eas-cli metadata:lint` da `apps/mobile`.

## Criteri di accettazione

- [x] In `apps/mobile/store/screenshots/` ci sono solo i 7 file nuovi,
      byte per byte uguali a quelli di `out/appstore-v2/upload/`
      (controllato con `cmp`), tutti 1320×2868 e senza alfa (`sips`).
- [x] `APP_IPHONE_67` elenca i 7 file nell'ordine sopra e ogni percorso
      esiste.
- [x] `eas metadata:lint` (eas-cli 27.1.0): «Store configuration is
      valid», senza credenziali.
- [x] Nessun `eas metadata:push`, nessuna modifica su App Store Connect.

## File toccati

```
apps/mobile/store.config.json
apps/mobile/store/screenshots/iphone-69-1-heart-route.jpg   (tolto)
apps/mobile/store/screenshots/iphone-69-2-run.jpg           (tolto)
apps/mobile/store/screenshots/iphone-69-3-explore.jpg       (tolto)
apps/mobile/store/screenshots/iphone-69-4-feed.jpg          (tolto)
apps/mobile/store/screenshots/iphone-69-5-draw.jpg          (tolto)
apps/mobile/store/screenshots/iphone-69-1-heart.jpg         (nuovo)
apps/mobile/store/screenshots/iphone-69-2-cat.jpg           (nuovo)
apps/mobile/store/screenshots/iphone-69-3-word.jpg          (nuovo)
apps/mobile/store/screenshots/iphone-69-4-draw.jpg          (nuovo)
apps/mobile/store/screenshots/iphone-69-5-run.jpg           (nuovo)
apps/mobile/store/screenshots/iphone-69-6-explore.jpg       (nuovo)
apps/mobile/store/screenshots/iphone-69-7-feed.jpg          (nuovo)
docs/tasks/TASK-326.md      (ora docs/tasks/TASK-328.md)
docs/STATUS.md
```

## Fuori scope

- `eas metadata:push` e ogni passo su App Store Connect: le schermate
  sono già in revisione dalla «Libreria di risorse»; quando Apple le
  approva si scelgono per la pagina della 1.0.0 con «Scopri risorse»
  (l'utente ha già detto sì).
- Le immagini creative dell'intestazione (16:9, 5244×2950,
  `muw-header-5244x2950.png`) e dei risultati di ricerca (3:2,
  3840×2560, `muw-search-3840x2560.png`) e il video di anteprima: non
  hanno posto in `store.config.json`, restano solo in `out/appstore-v2/`
  (`creative/` per le due immagini) e su App Store Connect.
- `DEPLOY.md`: non si sa ancora come `metadata:push` si comporti con la
  «Libreria di risorse»; va visto la prima volta che serve un push.

## Esito

La scheda dello store nel repository usa ora il set del 2026-10-29 (7
schermate), lo stesso caricato dalla «Libreria di risorse» di App Store
Connect e mandato in revisione ad Apple il 2026-10-29 alle 00:53.
Intestazione, risultati di ricerca e video stanno solo in
`out/appstore-v2/` e su App Store Connect.
