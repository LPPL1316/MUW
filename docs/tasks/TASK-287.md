# TASK-287 — La ricerca dei percorsi più veloce, lato app

**Stato**: Done · in `main` con la #517 (`2259a5df`, 2026-10-16); resta
la prova sull'iPhone dell'annullo del motore sul telefono (vedi «Esito»)
**Fase**: 4 · **Branch**: `feat/TASK-287-faster-route-search`
**Dipende da**: niente · **ADR**: ADR-0248

Nato dall'analisi della lentezza della ricerca del 2026-10-16 (sessione
«MUW app performance e ricerca»): lato app le richieste di percorso in
sottofondo competono con il «Draw» dell'utente e possono superare il
limite del server, il motore sul telefono non si ferma quando si
annulla, Explore chiede cose che ha già. Le parti lato server sono in
altre sessioni (TASK-288, e TASK-289 per i tempi per fase). Solo app, non
nella 1.0.

## Obiettivo

La richiesta dell'utente parte per prima e non prende mai un 429 per
colpa delle richieste in sottofondo; un «Draw» annullato non tiene
occupato il telefono; Explore non chiede di nuovo quello che ha già.

## Contesto da leggere

- `docs/DECISIONS.md` ADR-0076 (30 POST al minuto per telefono), ADR-0177
  (il motore sul telefono), ADR-0136 (gli esempi tenuti dall'API)
- `docs/tasks/TASK-214.md`, «Esito» (tempi di Pyodide)

## Cosa fare

1. **Una sola coda per i route job, con priorità**: richiesta dell'utente
   («Draw», sposta la forma di un esempio, percorso a tema) > esempi
   visibili in Explore (gli esempi della città scelta, i paesi vicini) >
   prefetch (le forme sull'acqua dei posti vicini). Un solo contatore dei
   POST dell'ultimo minuto al posto dei tre di oggi
   (`exampleRoutes.ts` 18/min, `nearbySamples.ts` 12/min,
   `aheadExamples.ts` 10/min, insieme oltre i 30 del server). Mentre gira
   una richiesta dell'utente, quelle in sottofondo non partono.
2. **Annullare davvero sul telefono**: un job in coda annullato esce
   dalla coda; quello che Python sta calcolando non si può interrompere
   con un messaggio alla pagina (Python gira sul solo thread della
   WebView: il messaggio arriverebbe a calcolo finito, ADR-0248 punto 3),
   quindi la pagina si rifà da capo e Python riparte subito, pronto per
   il prossimo «Draw». Per questo `page.ts` non cambia.
3. **`warmUp()` prima**: appena una zona salvata copre la posizione, non
   dopo il download delle zone di tutte e due le reti.
4. **Explore riusa ciò che ha**: il chip di una città in evidenza usa la
   città già chiesta a `GET /cities` (tenuta in `ahead.json`); il
   dettaglio dei campioni dei paesi vicini va nella cache degli esempi,
   così il tocco sul paese non chiede di nuovo le prime forme;
   `city-examples.json` si scrive una volta per gruppo (prime forme,
   altre forme, parole), non a ogni esempio, e si legge una volta.
5. `useRouteRequest` non crea uno stato nuovo se la fase non cambia;
   `placeFinder` ricorda per qualche minuto che `/places` è lento o giù.

Non si fa: la gara telefono contro server (ADR-0177, il telefono prima
fino a 8 km a piedi resta com'è).

## Criteri di accettazione

- [x] Nessuna richiesta in sottofondo parte mentre gira una
      dell'utente; in un minuto le richieste in sottofondo lasciano
      sempre posto a quelle dell'utente (test della coda).
- [x] Un esempio visibile passa davanti a un prefetch in attesa (test).
- [x] Un job annullato in coda non arriva alla pagina; uno annullato
      mentre calcola fa ripartire la pagina e il job dopo non aspetta il
      vecchio (test di `phoneEngine`).
- [x] `warmUp` parte prima del download quando una zona salvata copre la
      posizione (test).
- [x] Il chip di una città in evidenza già tenuta non chiede `/cities`;
      il tocco su un paese vicino già campionato non richiede le prime
      forme; il file degli esempi si scrive una volta per gruppo (test).
- [x] `useRouteRequest` e `placeFinder` come al punto 5 (test).
- [x] jest, tsc, lint e prettier verdi; provata nel simulatore.

## File toccati

```
apps/mobile/src/api/routeQueue.ts            (nuovo)
apps/mobile/src/api/routeQueue.test.ts       (nuovo)
apps/mobile/src/engine/phoneEngine.ts
apps/mobile/src/engine/phoneEngine.test.ts
apps/mobile/src/engine/onPhone.ts
apps/mobile/src/engine/onPhone.test.ts
apps/mobile/src/engine/usePhoneZones.ts
apps/mobile/src/engine/usePhoneZones.test.ts
apps/mobile/src/engine/aheadZones.ts
apps/mobile/src/engine/aheadZones.test.ts
apps/mobile/src/explore/exampleRoutes.ts
apps/mobile/src/explore/exampleRoutes.test.ts
apps/mobile/src/explore/exampleRoutesTurn.test.ts
apps/mobile/src/explore/exampleWords.test.ts
apps/mobile/src/explore/nearbySamples.ts
apps/mobile/src/explore/nearbySamples.test.ts
apps/mobile/src/explore/NearbyTowns.test.tsx
apps/mobile/src/explore/ExploreTools.tsx
apps/mobile/src/explore/ExploreTools.test.tsx
apps/mobile/src/explore/useThemedRoute.ts
apps/mobile/src/paddle/aheadExamples.ts
apps/mobile/src/paddle/aheadExamples.test.ts
apps/mobile/src/paddle/useMoveExample.ts
apps/mobile/src/route/useRouteRequest.ts
apps/mobile/src/route/useRouteRequest.test.ts
apps/mobile/src/places/placeFinder.ts
apps/mobile/src/places/placeFinder.test.ts
docs/tasks/TASK-287.md
docs/STATUS.md
docs/DECISIONS.md
```

## Dove si è (2026-10-16)

- Codice e test nel branch; in locale jest (3422 test: i quattro caduti
  nella corsa intera erano timeout di avvio a freddo con la macchina
  carica, rifatti da soli passano), `tsc`, `expo lint` e prettier verdi.
- **Simulatore** (iPhone Air, Expo Go, API locale del worktree, log
  temporanei della coda poi tolti): durante una richiesta dell'utente
  di 43 s («Draw» di un'immagine, poi «Cancel») nessuna richiesta in
  sottofondo è partita; il prefetch è ripartito appena finita. Il log è
  nelle note della sessione che ha avviato questa.
- **Non provato nel simulatore**: l'annullo del motore sul telefono.
  L'API locale non ha zone per il telefono (`GET /phone-zones/*` 404),
  quindi Python nella WebView non parte; coperto dai test. Da vedere
  sull'iPhone vero: un «Draw» a piedi fino a 8 km annullato e rifatto
  deve ripartire in pochi secondi (l'avvio di Python), non dopo il
  vecchio.

## Esito

**Done il 2026-10-16.** PR #517, CI 5/5 verde, mergiata dal Coordinatore
su richiesta esplicita dell'utente («mergia la 517»), sulla testa
`e92f0eb4`: in `main` come `2259a5df`. Il `gh pr merge` della sessione
del task era stato bloccato dal classificatore della modalità auto
(«Merge Without Review»), come per la #509. La pubblicazione su
`preview` la fa il Coordinatore.

- In `main`: la coda unica delle richieste di percorso
  (`src/api/routeQueue.ts`); l'annullo vero nel motore sul telefono (job
  in coda tolti, pagina di Python rifatta per quello in calcolo); Python
  avviato appena una zona salvata copre la posizione; il chip delle città
  in evidenza da `ahead.json`; i campioni dei paesi vicini come esempi;
  `city-examples.json` scritto una volta per gruppo; `useRouteRequest` e
  `placeFinder` come al punto 5. Nessun testo nuovo, `engine.zip` e
  `page.ts` non toccati.
- **Resta da provare sull'iPhone**, dopo la pubblicazione su `preview`:
  un «Draw» a piedi fino a 8 km, annullato e rifatto, deve ripartire in
  pochi secondi (l'avvio di Python), non dopo il calcolo di prima. Nel
  simulatore non si è potuto: l'API locale non ha zone per il telefono.


**Provato sull'iPhone dall'utente il 2026-10-17** («provato, funziona tutto»), su `preview` dal gruppo `cd521a21` (`main` `ff786f67`).
