# TASK-327 — «Play» sotto la distanza di «Draw», non più in alto accanto a «Explore»

**Stato**: Done — PR #626 `feat/TASK-327-play-under-distance`; testi
approvati dall'utente il 2026-10-29
**Fase**: 4 · **Branch**: `feat/TASK-327-play-under-distance` · **ADR**:
ADR-0286 · numeri dati dal Coordinatore il 2026-10-29

## Obiettivo

Richiesta dell'utente del 2026-10-29, parola per parola: «la sezione play
non mi piace in cima a fianco ad explore mettila direttamente in sotto la
modifica della distanza».

«Play», il gioco delle forme (TASK-296, ADR-0255), esce dall'intestazione,
dove era il quarto nome dopo «Explore». In «Draw», subito sotto la
distanza e prima di «NEAR YOU», c'è una riga che apre il gioco.

Scelta dell'utente dello stesso giorno, fra due proposte: **una riga che
apre il gioco a tutto schermo**, con «←» che torna a «Draw» (scartato: le
due schede e la griglia delle forme dentro «Draw», che sarebbe diventata
molto più lunga). Testi della riga visti dall'utente nell'anteprima della
proposta: «PLAY» e «Collect shapes by running».

## Contesto da leggere

- `docs/UI.md`, «“Play”: la collezione delle forme» e la pagina «Draw»;
- `docs/GIOCO.md` §9;
- ADR-0255 e ADR-0286 (questo task) in `docs/DECISIONS.md`.

## Cosa fare

1. `App.tsx`: «Play» fuori dalle pagine affiancate (`PAGES`), la riga
   sotto `RouteChoice`, il gioco sopra l'app quando lo schermo è `"play"`.
2. `src/game/PlayRow.tsx` (nuovo): la riga, solo mentre l'API ha il gioco.
3. `src/game/PlayOverlay.tsx` (nuovo): «←» e «Play» in alto, sotto
   `PlayScreen`.
4. I due testi nuovi in it/de/es/fr.
5. Test dell'app intera in `__tests__/AppPlay.test.tsx`.
6. `UI.md`, `GIOCO.md`, `DECISIONS.md`, `STATUS.md`.

## Criteri di accettazione

- [x] In alto restano tre nomi, «Feed», «Draw», «Explore», anche con il
      gioco sull'API; il profilo è di nuovo a uno swipe da «Explore».
- [x] Con il gioco sull'API, in «Draw» la riga «PLAY» · «Collect shapes by
      running» · «›» sta subito dopo «DISTANCE» e il suo campo; senza il
      gioco non c'è.
- [x] Un tocco sulla riga apre il gioco a tutto schermo (le pagine non
      sono sotto), con «Play», le schede, le forme e, senza account,
      «Sign in to collect shapes.»; «←» torna a «Draw», con la riga.
- [x] «See collection» della scheda di una forma sbloccata, e la sua
      notifica, aprono il gioco da qualunque pagina.
- [x] I testi nuovi ci sono in it/de/es/fr (`tables.test.ts`).
- [x] `__tests__/AppPlay.test.tsx` verde; l'intera suite dell'app verde
      tranne due gruppi che in locale non trovano dipendenze nuove di
      `main` (Health, document picker), verdi in CI.
- [x] Impronta iOS della testa, misurata su una copia pulita: `83793e26`
      (testa `fda7f0a5`; da rimisurare dopo il riallineamento su main).
- [x] Il sì dell'utente ai testi nuovi nelle cinque lingue, prima del
      merge (2026-10-29, «Yes, approve them»): «PLAY» / «GIOCA» / «SPIELEN» / «JUEGA» / «JOUER» e «Collect
      shapes by running» / «Colleziona le forme correndo» / «Sammle Formen
      beim Laufen» / «Colecciona formas corriendo» / «Collectionne des
      formes en courant».

## File toccati

```
apps/mobile/App.tsx
apps/mobile/__tests__/AppPlay.test.tsx
apps/mobile/src/game/PlayOverlay.tsx      (nuovo)
apps/mobile/src/game/PlayRow.tsx          (nuovo)
apps/mobile/src/screens/pageTitles.ts     (solo il commento)
apps/mobile/src/i18n/it.ts
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/es.ts
apps/mobile/src/i18n/fr.ts
docs/UI.md
docs/GIOCO.md
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-327.md
```

## Fuori scope

- `Pager.tsx` e il suo test: il meccanismo di una pagina che si aggiunge
  dopo resta, anche se oggi nessuna pagina lo usa.
- Tornare a «Play» dopo l'accesso: «Sign in to collect shapes.» porta al
  profilo come prima.
- Nessun file nativo e nessuna dipendenza: l'impronta iOS non dovrebbe
  cambiare (83793e26), da misurare su una copia pulita prima del merge.

## Esito

«Play» non è più il quarto nome in alto: in «Draw», subito sotto la
distanza, una riga «PLAY» apre il gioco a tutto schermo, e «←» torna a
«Draw». Visto solo nei test, non ancora su un telefono.
