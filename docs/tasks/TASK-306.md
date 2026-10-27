# TASK-306 — Forme pronte vicino a te in «Draw», ed «Explore» preparato all'apertura

**Stato**: Done
**Fase**: 4 · **Branch**: `feat/TASK-306-near-you-shapes`

## Obiettivo

In «Draw», sotto DISTANCE, una riga di forme semplici già disegnate dalla
posizione dell'utente, da toccare per averle sulla mappa; e all'apertura
dell'app «Explore» si prepara da solo, senza aspettare che lo si apra.

Richiesta dell'utente del 2026-10-26: «sotto a draw sotto a distanza 5 km
metti una sezione di figure semplici il cuore... di posti vicini
all'utente», e «in fase di download dell'app bisogna già capire dove si
trova l'utente e preparare già la sezione explore». Poi, alla proposta:
«se vicino a lui non viene nulla di bello aggiungi forme a caso in città a
caso dalle più semplici alle più complicate». Sì alla proposta lo stesso
giorno («Sì, va bene così: procedi con TASK-306»). Numeri dal Coordinatore:
TASK-306, ADR-0266.

## Contesto da leggere

- `docs/UI.md`, «Draw» ed «Explore».
- `docs/tasks/TASK-214.md`, «Parte D» e «Le misure dopo D» (il motore sul
  telefono, i tempi).
- `docs/tasks/TASK-236.md` (i paesi vicini e i loro esempi),
  `docs/tasks/TASK-287.md` (la coda delle richieste di percorsi).
- `docs/DECISIONS.md` ADR-0136 (gli esempi tenuti dall'API), ADR-0177 (il
  motore sul telefono), ADR-0248 (la coda).

## Le scelte dell'utente (2026-10-26)

- **La riga «NEAR YOU»** («VICINO A TE»), subito sotto DISTANCE e sopra
  CITY TOURS: cerchio, cuore e stella da **5 km**, sempre 5 km, anche con
  un'altra distanza scelta sopra. Partono dalla **posizione GPS**, non
  dal centro del paese. Una scheda toccata apre il percorso sulla mappa,
  come un percorso di «Explore» (Start, GPX, A · B · C); «←» torna a
  «Draw». Mentre si disegna, la scheda dice «Drawing…».
- **Solo la corsa**: con «Bike» o «Paddle» la riga non c'è.
- **Tenute sul telefono**: si disegnano di nuovo solo quando la posizione è
  a più di 1 km da dove sono state disegnate.
- **Quando una forma non viene** vicino (il motore la rifiuta, o non
  risponde), al suo posto va una forma **già disegnata in una città a
  caso** fra quelle in evidenza di «Explore», dalla più semplice alla più
  complicata (l'ordine di `DRAW_ORDER`: cerchio, cuore, stella, luna,
  cavallo, lumaca, testa di cane, testa di coniglio), ogni scheda una città
  diversa, scelte di nuovo a ogni apertura. Se vicino non viene niente, o
  la posizione non c'è, **6 forme in 6 città**. Solo forme che l'API ha già
  pronte (il lavoro è `done` nella risposta al POST, ADR-0136): le altre si
  saltano, e la scheda si apre subito. Sotto ogni scheda di un'altra città
  il nome della città; se tutte le schede sono di altre città il titolo
  della riga diventa **«SHAPES TO TRY»** («FORME DA PROVARE»).
- **Non vicino, e lo dice** (nota del Coordinatore del 2026-10-26): sotto
  una scheda di un'altra città, il nome della città e quanto è lontana
  dalla posizione, «Roma · 480 km away» («Roma · a 480 km»), con i testi
  «{km} km away» e «{mi} mi away» che l'app ha già; senza la posizione,
  il nome soltanto. Nessun endpoint nuovo: `GET /cities` e
  `POST /route-jobs` ci sono già.
- **«Bello» non si misura**: la somiglianza del motore sta sopra 0,9 anche
  per percorsi che non si leggono (TASK-290). «Non viene» vuol dire rifiutata
  (`shape_not_drawable`) o senza risposta.
- **«Explore» preparato all'apertura**: «durante il download» non gira
  niente (né codice né posizione prima che l'app si apra); il primo momento
  utile è l'apertura, appena c'è la posizione. Allora, senza aspettare la
  pagina: i percorsi vicini alla partenza, i paesi vicini e i loro esempi.

## Le condizioni del Coordinatore (2026-10-26)

1. **Permesso della posizione**: questo task non lo chiede mai. Usa la
   posizione solo quando l'app ce l'ha già (`useCurrentPosition`, com'è
   oggi); senza, la riga mostra le città a caso ed «Explore» non si prepara.
2. **Telefono**: niente prima che l'animazione d'apertura sia finita; tutto
   si ferma durante una corsa o la navigazione e con l'app in background, e
   riparte da dove era al ritorno. Il server è la riserva con l'API di oggi:
   nessun endpoint nuovo.
3. **Dati**: misurati e scritti qui sotto, con la rete mobile.
4. Impronta iOS `83793e26…` invariata, nessuna dipendenza nuova, i18n solo
   righe in fondo.
5. «File toccati» al Coordinatore prima del codice; il merge con la parola
   dell'utente.

## Cosa fare

1. `src/route/nearYouShapes.ts` (non `nearYou.ts`: sul Mac, che non
   distingue maiuscole e minuscole nei nomi, si confonde con
   `NearYou.tsx`): il cerchio, il cuore e la stella dalla posizione,
   uno dopo l'altro nella coda delle richieste (priorità «visible»), con
   `requestRouteOnPhoneFirst` (il telefono, il server se il telefono non
   può); tenuti in `near-you.json` nei documenti dell'app con il punto da
   cui sono partiti; disegnati di nuovo oltre 1 km. Poi le forme di
   riserva dalle città in evidenza (`featuredPlace`, o `searchCities` la
   prima volta), con `requestRoute` e un `onStatus` che lascia perdere la
   richiesta appena l'API dice che deve disegnare; al più 3 città per
   forma. Ogni percorso pronto si apre come un esempio (`exampleDetail`).
2. `src/route/NearYou.tsx`: la riga, schede come quelle di «Explore».
3. `src/explore/exploreAhead.ts`: all'apertura, con la posizione e finché
   «Explore» non si è aperto, la lista dei percorsi vicini (tenuta per
   `ExploreScreen`), i paesi vicini (`fetchNearbyCities`, che li tiene già)
   e i loro esempi (`drawSamples` con priorità «prefetch»).
4. `src/intro/firstPage.ts`: dice quando l'animazione d'apertura è finita
   (`markFirstPage` da `Root.tsx`), e `useMayWorkAhead`: dopo di quella,
   in primo piano, né corsa né navigazione.
5. `App.tsx`: la riga sotto `RouteChoice`, aperta come una scheda di
   «Explore» con «←» verso «Draw»; la preparazione di «Explore»; lo stop
   durante corsa, navigazione e background.
6. Testi nelle cinque lingue, in fondo alle tabelle.
7. Test deterministici di tutto: la scelta delle città con un `random`
   dato, il file con un `Storage` finto, il motore e l'API finti.

## Costi (stime da misure già fatte; da rifare sul telefono)

- **Tempo sul telefono**: un cuore da 5 km è 9,6 s in Pyodide sul Mac M4
  (TASK-214, «Le misure dopo D»); un iPhone vecchio, 2–4 volte tanto:
  tre forme fra 1 e 2 minuti di un core, una volta per luogo (poi stanno
  nel file). Senza zona del telefono intorno (più di metà dei casi nei log
  di TASK-214) le tre forme le disegna il server, 7–18 s l'una.
- **Batteria**: un core per 1–2 minuti alla prima apertura in un luogo,
  stimato sotto l'1% della batteria; niente in background né durante una
  corsa.
- **Dati con la rete mobile**, oltre la zona del telefono (fino a 12 MB,
  già scaricata oggi da TASK-214): un percorso da 5 km con le sue due
  alternative è circa 45 KB di JSON (un 10 km sono 870 punti, 30 KB);
  i paesi vicini 6 × 3 esempi ≈ 0,8 MB; le forme di riserva 3–6 ≈ 0,3 MB;
  le tre forme vicine dal server, quando il telefono non può, ≈ 0,15 MB;
  lista e paesi ≈ 0,05 MB. **Fino a circa 1,3 MB** in più alla prima
  apertura in un luogo, senza compressione; le foto dei paesi non si
  scaricano prima che «Explore» si apra.

## Criteri di accettazione

- [ ] Con la corsa e la posizione, sotto DISTANCE c'è «NEAR YOU» con
      cerchio, cuore e stella da 5 km dalla posizione; toccata, una scheda
      apre il percorso sulla mappa e «←» torna a «Draw».
- [ ] Le forme vicine si chiedono con `requestRouteOnPhoneFirst`, nella
      coda in priorità «visible», e restano nel file: riaperta l'app nello
      stesso posto non si chiede niente; a più di 1 km si disegnano di nuovo.
- [ ] Una forma vicina rifiutata è sostituita da una forma di
      `DRAW_ORDER` non già mostrata, in una città in evidenza diversa
      dalle altre; senza posizione, o con tutte rifiutate, 6 schede di 6
      città e il titolo «SHAPES TO TRY».
- [ ] Una forma di riserva che l'API non ha già pronta non si aspetta: si
      prova un'altra città, al più 3 per forma.
- [ ] Con «Bike» o «Paddle» la riga non c'è.
- [ ] Prima della fine dell'animazione d'apertura, durante corsa o
      navigazione e in background non parte nessuna richiesta di questo task.
- [ ] All'apertura, con la posizione, la lista dei percorsi vicini e i
      paesi vicini con i loro esempi si chiedono prima che «Explore» si
      apra; aperto, la lista c'è già senza «Loading routes…».
- [ ] Nessun permesso della posizione chiesto da questo task.
- [ ] Testi nelle cinque lingue; `npm run lint`, `typecheck`, `test`,
      `format:check` verdi; impronta iOS invariata.

## File toccati

```
docs/tasks/TASK-306.md
docs/STATUS.md
docs/DECISIONS.md
docs/UI.md
apps/mobile/App.tsx
apps/mobile/src/intro/Root.tsx
apps/mobile/src/intro/firstPage.ts
apps/mobile/src/intro/firstPage.test.ts
apps/mobile/src/route/nearYouShapes.ts
apps/mobile/src/route/nearYouShapes.test.ts
apps/mobile/src/route/NearYou.tsx
apps/mobile/src/route/NearYou.test.tsx
apps/mobile/src/explore/exploreAhead.ts
apps/mobile/src/explore/exploreAhead.test.tsx
apps/mobile/src/explore/ExploreScreen.tsx
apps/mobile/__tests__/AppNearYou.test.tsx
apps/mobile/src/explore/exampleRoutes.ts
apps/mobile/src/i18n/it.ts
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/es.ts
apps/mobile/src/i18n/fr.ts
```

`exampleRoutes.ts` solo per una funzione esportata che tiene un percorso
intero già disegnato, perché si apra come un esempio (oggi lo fa
`keepSample`, che però lo lega a una città).

## Al merge

1. **Impronta iOS** misurata su una copia pulita (`npm ci`, `env
   APP_VARIANT=production npx expo-updates fingerprint:generate --platform
   ios`) il 2026-10-26 sul commit `cf7d6f64`:
   `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3`, invariata.
2. Il merge con la parola dell'utente, dal Coordinatore; poi «preview» con
   l'ok dell'utente, da `origin/main` pulito.
3. **Il tempo vero sul telefono dell'utente** (richiesta del Coordinatore):
   con l'app aggiornata, aperta in un posto a più di 1 km dall'ultima
   volta, un cronometro dalla fine dell'animazione d'apertura a quando le
   tre schede hanno il disegno; e se intanto si è vista la riga «Downloading
   the maps…» (la zona del telefono prima delle forme). Il numero va
   nell'«Esito», al posto della stima.

## Fuori scope

- La bici (10–30 km) e la canoa (ha già i suoi posti sull'acqua).
- Scaricare qualcosa durante l'installazione: serve una build nativa (Apple
  Background Assets) e la posizione allora non c'è.
- Chiedere il permesso della posizione in un momento diverso da oggi.
- Le foto dei paesi scaricate prima di aprire «Explore».
- Forme vicine a un'altra distanza, o seguendo la distanza scelta.
- Il server: nessun endpoint e nessun `draw_examples` nuovo.

## Esito

In `main` con la PR #571 (`0bfc07c0`, 2026-10-27), mergiata dal
Coordinatore con la parola dell'utente; impronta iOS `83793e26…`
invariata, rimisurata da lui sull'ultimo head. Con la corsa, sotto la
distanza di «Draw», «NEAR YOU»: cerchio, cuore e stella da 5 km dalla
posizione, disegnati dal telefono (il server se non ha mappe), tenuti
fino a 1 km; una forma che non viene lascia il posto a una già pronta in
una città in evidenza a caso, con il nome della città e quanto è lontana;
con niente vicino o senza posizione, sei città e «SHAPES TO TRY».
«Explore» chiede lista, paesi vicini e i loro esempi all'apertura, prima
di essere aperto. Tutto dopo l'animazione d'apertura, mai durante corsa,
navigazione o background. 33 test nuovi; criteri di accettazione
verificati con i test, non sul telefono.

**Resta** (seguito, non codice): la pubblicazione su «preview», del
Coordinatore insieme a #565 e #573, con l'ok dell'utente («Sì: dopo
l'unione pubblica sulla preview, così la provo sul telefono»); poi il
tempo vero sul telefono dell'utente («Al merge», punto 3), da scrivere
qui al posto della stima di «Costi». Il segnaposto della scheda dice
«Drawing…», non la forma in grigio descritta all'utente nella proposta.
