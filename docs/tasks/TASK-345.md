# TASK-345 — Calorie e battito nei post del Feed

**Stato**: Todo
**Fase**: 4 · **Branch**: `docs/TASK-345-heart-calories` (documenti),
poi `feat/TASK-345-a-feed-calories`, `feat/TASK-345-b-heart-from-files`,
`feat/TASK-345-c-heart-from-health` · numeri dati dal Coordinatore il
2026-10-29 (TASK-345, ADR-0298)

## Obiettivo

La card di un post nel Feed mostra le calorie di una corsa e, quando c'è,
il battito medio dell'attività.

Richiesta dell'utente del 2026-10-29: «SUL FEED NEI POSYT MANCANO IL DATO
DEI BATTITI CARDIACI CALORIE». Alla proposta in tre parti (calorie subito,
battito da Apple Salute / Health Connect e dai file importati) ha risposto
«Yes, A and B».

**Chi vede il battito**, scelta dell'utente (2026-10-29, alla domanda
«Heart rate is health data. Who should see it in the post on the Feed?»):
**«On, publisher can hide»** — nel post si vede quando c'è, e chi pubblica
può spegnerlo nel modulo di pubblicazione. Il Coordinatore consigliava
spento all'inizio: l'utente ha scelto acceso.

## Com'è oggi (main `dbf618fd`)

- **Calorie**: l'app le stima solo durante la corsa (`kcal()` in
  `navigation/runMetrics.ts`: 1,036 kcal per kg e per km, 70 kg fissi,
  nessun peso dell'utente) e solo per la corsa (ADR-0219). Non vanno al
  server e la card non le mostra.
- **Battito**: non esiste. Il telefono non lo misura, Apple Salute e
  Health Connect (TASK-321) scrivono soltanto, e l'importazione di
  GPX/TCX/FIT lo butta via (`IMPORTAZIONI.md`).

## Contesto da leggere

- `docs/DECISIONS.md` ADR-0298 (questo task), ADR-0219 (calorie solo
  correndo), ADR-0281 (Apple Salute), ADR-0272 (importazioni);
- `docs/IMPORTAZIONI.md` §3; `docs/DATABASE.md` «runs»; `docs/API.md`
  «Activities» e «Drawings»;
- `tasks/TASK-321.md` (parte B, la #620) solo per la parte C.

## Cosa fare

### A — Le calorie sulla card (solo app, va con un OTA)

1. Le calorie di un post si contano dalla sua distanza con la stessa
   `kcal()` della schermata della corsa: con 70 kg fissi dipendono solo dai
   metri, quindi niente server, niente migrazione, niente campo nuovo.
2. Solo per la corsa (`activity` `running`, anche importata e negli
   esempi): in bici e in canoa niente, come in ADR-0219.
3. Nella riga dei numeri della card, dopo il passo: «Moon · 4.9 km ·
   27 min · 5:32 /km · 355 kcal». Anche nel testo per VoiceOver, che
   usa la stessa riga.
4. Il calcolo in un file nuovo (`feed/postEnergy.ts`); in `FeedPost.tsx`
   solo la riga che lo aggiunge. **Prima di toccare `FeedPost.tsx`
   scrivere al Coordinatore** (lo toccano anche TASK-339 B e TASK-336).

### B — Il battito dai file importati, mostrato e nascondibile

1. I lettori di GPX, TCX e FIT tengono il battito di ogni punto, quando
   il file lo ha (`gpxtpx:hr`, `HeartRateBpm`, il campo `heart_rate` del
   FIT). Fuori dai 30–230 bpm un valore si scarta.
2. Al server va solo il riassunto, non i punti: `heart_avg_bpm` e
   `heart_max_bpm` (interi), con il `PUT` della corsa. Senza battito non si
   mandano.
3. API: due colonne nuove in `runs` e `heart_shown` (booleano, vero
   all'inizio). La migrazione prende **il primo numero libero in main al
   merge** (oggi 0039): chiederlo al Coordinatore.
4. Chi pubblica può spegnerlo: nel modulo di pubblicazione una riga
   «Show heart rate», accesa, che c'è solo quando la corsa ha il battito.
5. L'API dà il battito agli altri **solo** se `heart_shown`; all'autore
   sempre, in «My activities». Il filtro è nel server, non nell'app.
6. La card mostra il medio dopo le calorie: «… · 355 kcal · 148 bpm».
7. **Testi e privacy**: «Show heart rate», «bpm» e la riga della privacy
   nelle cinque lingue vogliono il sì dell'utente prima del merge.

### C — Il battito da Apple Salute e Health Connect

1. A corsa salvata, l'app legge i campioni di battito tra inizio e fine
   (Apple Watch o un altro orologio che scrive in Salute / Health
   Connect), ne fa medio e massimo e li manda come in B.
2. Il permesso di **lettura**: su iPhone serve solo la chiave
   `NSHealthShareUsageDescription` (`app.json` `ios.infoPlist` e
   `locales/*.json`); il tipo `HKQuantityTypeIdentifierHeartRate` si
   chiede a runtime (`requestAuthorization({ toRead })`, kingstinct
   16.2.0), niente entitlement nuovo. **Una sola modifica nativa**:
   accordo del 2026-10-30 con TASK-321 B (`local_a9812e3f`): la chiave la
   aggiunge quella sessione nella #620, se il Coordinatore conferma che la
   lettura entra nella 1.0.1 e l'utente approva il testo; altrimenti tutto
   alla 1.0.2. **Il Coordinatore ha confermato il 2026-10-30**: la lettura
   entra nella 1.0.1, nella #620; «Health» in App Privacy va dichiarato
   prima dell'invio della 1.0.1. La richiesta di lettura è separata, nei file nuovi di
   `health/` (`appleHealth.ts` resta di TASK-321).
3. **Mai sulla 1.0 build 7** (impronta `83793e26`): senza la chiave,
   chiedere `toRead` fa crashare l'app. C si accende solo sulle build che
   hanno la chiave, e può arrivare con un OTA sulla 1.0.1. Un test lo
   prova: sulla build 7 la lettura non si chiede mai.
4. Android: `READ_HEART_RATE` va con TASK-321 C (Health Connect,
   bloccata da 4.1.3), non nella #620.
5. Con C cambiano la privacy (la #620 dice che MuW non legge i dati di
   salute: resta vera finché C non legge), App Privacy su App Store
   Connect (dati Health legati all'utente) e forse la riga dello store:
   tutto con il sì dell'utente, quando C esce.
6. Se l'utente nega la lettura, niente battito e nessun messaggio: la
   corsa resta com'è.

## Criteri di accettazione

- [ ] A: una corsa di 4,9 km mostra «355 kcal» sulla card; una in bici o
      in canoa nessuna caloria (`postEnergy.test.ts`, `FeedPost` test).
- [ ] A: nessun testo nuovo, nessuna dipendenza, impronta iOS `83793e26`
      invariata su una copia pulita della testa.
- [ ] B: un GPX, un TCX e un FIT con battito danno medio e massimo giusti
      (fixture nei test); un file senza battito non manda i campi.
- [ ] B: l'API rifiuta battiti fuori dai 30–230 bpm o un medio sopra il
      massimo (`422`).
- [ ] B: un post con `heart_shown` falso non dà il battito a un altro
      utente (test API), all'autore sì.
- [ ] B: la card mostra «148 bpm» solo quando c'è e si vede.
- [ ] B: testi e privacy nelle cinque lingue con il sì dell'utente,
      scritto qui con le sue parole.
- [ ] C: la lettura da Salute / Health Connect dà medio e massimo della
      finestra della corsa (test con il modulo finto); negata, niente
      cambia.
- [ ] Il battito non si usa per nient'altro: né pubblicità, né classifiche,
      né il gioco, né le email.

## File toccati

```
docs/tasks/TASK-345.md
docs/DECISIONS.md
docs/STATUS.md
docs/INDEX.md
# A
apps/mobile/src/feed/postEnergy.ts            (nuovo)
apps/mobile/src/feed/postEnergy.test.ts       (nuovo)
apps/mobile/src/feed/FeedPost.tsx             (una riga in postFacts)
apps/mobile/src/feed/feedPosts.test.ts
apps/mobile/src/feed/FeedPost.test.tsx
apps/mobile/src/units/cardsInMiles.test.tsx
apps/mobile/src/screens/FeedScreenPosts.test.tsx
apps/mobile/__tests__/AppFeedDrawing.test.tsx
docs/UI.md
# B
apps/mobile/src/imports/gpx.ts, tcx.ts, fit.ts, fileTrack.ts, importFile.ts (+ test)
apps/mobile/src/activities/                   (il modulo di pubblicazione)
apps/mobile/src/api/activities.ts, drawings.ts
apps/mobile/src/i18n/*.ts
apps/mobile/src/about/                        (la privacy)
packages/shared-types/src/index.ts
services/api/migrations/00NN_run_heart.sql    (nuovo, numero al merge)
services/api/shaperoute_api/activities.py, drawings.py (+ test)
docs/API.md, docs/DATABASE.md, docs/IMPORTAZIONI.md
# C
apps/mobile/src/health/                       (lettura)
apps/mobile/app.json, locales/*.json          (nella #620, li tocca TASK-321 B)
```

## Fuori scope

- Il peso dell'utente per calorie più giuste: oggi non c'è, resta 70 kg.
- Il battito da un sensore Bluetooth (richiesta del 2026-10-02, ancora in
  `STATUS.md`): dipendenza nuova, task a parte.
- Il battito sulla schermata della corsa mentre si corre, il grafico del
  battito, le zone.
- Calorie per bici e canoa.
- Scrivere il battito in Strava o in Salute.

## Esito

*(si compila a fine task)*
