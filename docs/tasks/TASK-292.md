# TASK-292 — Scegliere la partenza sulla mappa

**Stato**: Done (in `main` con la #527, `b35d461c`, 2026-10-19)
**Fase**: 4 · **Branch**: `feat/TASK-292-start-on-map`
**ADR**: ADR-0252

## Obiettivo

Nella scheda «START» di «Draw» la partenza si sceglie anche **spostando
la mappa sotto un segnaposto fermo**, senza scrivere la via: oggi c'è
solo il GPS («My position») o un luogo cercato per nome («Another place»).

## Contesto

Chiesto dall'utente il 2026-10-18 («mettere che puoi scegliere dalla mappa
un punto da cui partire, senza scrivere la via»). Fra quattro proposte
(mirino fisso, tocco sul punto, terzo pulsante «Map», pressione lunga sul
risultato) l'utente ha scelto il **mirino fisso**, con l'ingresso sotto la
ricerca di «Another place». Numero e ADR dal Coordinatore; solo app,
niente motore, API o migrazioni; non nella 1.0.

## Contesto da leggere

- `docs/UI.md`: «La partenza», «Ricerca del luogo», «Disegnare sulla
  mappa: «Draw on the map»» (la mappa a tutto schermo che si riusa)
- `apps/mobile/src/location/startMode.ts`, `src/screens/ChooseScreen.tsx`,
  `src/map/MapView.tsx`, `src/map/mapPage.ts`, `src/map/messages.ts`,
  `App.tsx` (`chooseStart`, `statusText`, lo schermo `canvas`)

## Cosa fare

1. **L'ingresso**: con la ricerca in vista (cioè con «Another place», o
   senza GPS), sotto il campo un link **«Choose on the map»**.
2. **La mappa**: la stessa mappa a tutto schermo di «Draw» (`MapView`,
   mai una seconda), con «←» in alto e il tipo di mappa come sempre.
   All'apertura si inquadra sulla partenza di adesso a zoom 15, a nord in
   su; senza partenza resta dov'è. Il segnaposto della partenza diventa
   il **segnaposto della scelta**, fermo al centro: un dito sposta la
   mappa sotto di lui, due dita fanno lo zoom. Sotto la mappa, in grigio,
   *Move the map to put the pin where you want to start.* e **«Start
   here»**.
3. **«Start here»**: il centro della mappa diventa la partenza (origine
   nuova `map`, accanto a `gps` e `search`), l'interruttore resta su
   «Another place» e si torna a «Draw». La riga di stato dice
   «Starting from a point on the map.»: nessun nome cercato in rete.
   «←» torna a «Draw» senza cambiare niente.
4. Una partenza dalla mappa vale come un luogo cercato: resta anche se il
   GPS risponde, la cancella un nuovo luogo cercato o «My position», e
   vale con «Run», «Bike» e «Paddle» (sull'acqua come una via cercata:
   funziona dove il server ha o riesce a scaricare l'acqua).
5. Test deterministici: la pagina (modalità scelta con MapLibre finto),
   `MapView`, `startMode`, l'app intera (link → mappa → «Start here» →
   riga di stato e partenza della richiesta; «←» non cambia niente).
6. Documenti: `UI.md` («La partenza»), ADR-0252, `STATUS.md`.

## Criteri di accettazione

- [x] Con «Another place» sotto la ricerca c'è «Choose on the map».
- [x] Toccato, si apre la mappa con il segnaposto al centro, il testo
      grigio e «Start here»; il segnaposto resta al centro mentre la
      mappa si sposta.
- [x] «Start here» rende il centro della mappa la partenza della
      richiesta (`start` del `RouteRequest`) e la riga dice «Starting
      from a point on the map.».
- [x] «←» torna a «Draw» con la partenza di prima.
- [x] Il GPS che risponde mentre si sceglie non sposta la mappa.
- [x] I testi nuovi sono nelle cinque lingue, approvati dall'utente
      (2026-10-19, «Vanno bene»: «Choose on the map» / «Scegli sulla
      mappa» e il testo grigio; «Start here» era già tradotto).
- [x] `npm run lint`, `typecheck`, `test`, `format:check` verdi.

## File toccati

```
apps/mobile/App.tsx
apps/mobile/src/location/startMode.ts
apps/mobile/src/location/startMode.test.ts
apps/mobile/src/location/PickStart.tsx              (nuovo)
apps/mobile/src/location/PickStartApp.test.tsx      (nuovo)
apps/mobile/src/screens/ChooseScreen.tsx
apps/mobile/src/map/MapView.tsx
apps/mobile/src/map/MapViewPick.test.tsx            (nuovo)
apps/mobile/src/map/mapPage.ts
apps/mobile/src/map/mapPagePick.test.ts             (nuovo)
apps/mobile/src/map/messages.ts
apps/mobile/src/i18n/{de,es,fr,it}.ts               (righe in fondo)
docs/tasks/TASK-292.md                               (nuovo)
docs/UI.md                                           (solo «La partenza»)
docs/DECISIONS.md                                    (ADR-0252 in fondo)
docs/STATUS.md                                       (righe nuove)
```

## Fuori scope

- Il nome della via del punto scelto (geocodifica inversa: rete, API).
- Scegliere la partenza sulla mappa del risultato o con una pressione
  lunga (proposte scartate dall'utente).
- Tradurre le altre righe di stato e «My position» / «Another place»:
  sono «il resto di `App.tsx`» di TASK-210.
- «Explore» e la sua città: hanno la loro ricerca.

## Esito

In `main` con la #527 (`b35d461c`, 2026-10-19), mergiata dal Coordinatore
al verde e pubblicata da lui su `preview`. Sotto la ricerca di «Draw» il
link «Choose on the map» apre la mappa con il segnaposto fermo al centro.
«Start here» rende il punto la partenza (origine `map`, senza nome) e
«←» non cambia niente. Diff = «File toccati» (19 file).

I testi nuovi nelle cinque lingue sono stati approvati dall'utente il
2026-10-19. In locale lint, typecheck e format:check erano verdi; jest
aveva 415 suite su 421 verdi al primo giro e le altre 6, andate in
timeout per il carico del Mac, erano verdi rilanciate da sole.

**Resta da fare**: la prova sull'iPhone dalla `preview`. La segna il
Coordinatore quando l'utente l'ha fatta. Nel simulatore non è stata
provata: i test usano un MapLibre finto.

**Rimandato**:
- il nome della via del punto scelto (geocodifica inversa, «Fuori
  scope»);
- la traduzione della riga di stato, che resta in inglese come le sue
  vicine: è «il resto di `App.tsx`» di TASK-210.
