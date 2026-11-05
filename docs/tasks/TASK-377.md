# TASK-377 — L'escursionismo, il pilota della struttura degli sport

**Stato**: In corso — parte 0: misura dei sentieri e proposta. Le scelte
di prodotto vanno all'utente una alla volta, prima del codice.
**Fase**: 4 · **Branch**: `docs/TASK-377-0-hike` (parte 0), poi
`feat/TASK-377-a-hike-engine-api`, `feat/TASK-377-b-hike-app` ·
**ADR**: ADR-0321 · numeri dal Coordinatore (2026-11-04) · sessione
«Coordinatore Sport»

## Obiettivo

Chi sceglie l'escursionismo riceve un percorso **sui sentieri** che disegna
la forma: fuori dalle strade delle auto, con la salita detta prima di
partire. Lo cammina con passo, voce, salvataggio, Feed, Apple Salute,
Health Connect e Strava da escursione.

È anche **il pilota della struttura** di TASK-376 (ADR-0320). Il diff delle
sue PR deve toccare solo file nuovi, una riga per registro e i punti fissi
elencati in `docs/sports/COME-AGGIUNGERE.md`. Ogni altro file è una deroga,
e va scritta in `docs/sports/CONDIVISO.md`.

## Contesto

Scelta dell'utente del 2026-11-04: l'escursionismo è il pilota, al posto
della camminata, che era già TASK-371.

Due cose lo distinguono dalla camminata:

- **È la prima rete nuova del motore dopo la bici.** «foot» tiene le
  strade; un'escursione le evita quando può.
- **Va in montagna.** Le zone del banco Val di Fiemme e Asiago diventano
  quelle che contano. Il dislivello pesa nel tempo e nelle calorie.

Da leggere: `docs/sports/COME-AGGIUNGERE.md`, `docs/sports/CONDIVISO.md`
(«Le reti», «Le quote»), `docs/sports/README.md` (il banco),
`docs/sports/hike.md` (le misure), ADR-0320, ADR-0315 (la camminata).

## Cosa fare

### Parte 0 — misura e proposta (solo documenti)

1. Col banco, al turno del Coordinatore, `nice -n 10`, un comando per
   volta: due reti di prova con `--loader` (`out/TASK-377/loader.py`),
   senza toccare il motore. Misuro la rete e le forme del catalogo a 5, 10
   e 20 km sulle sei zone.
   - **`trails`**: solo le vie di un'escursione (`highway` path, footway,
     track, bridleway, steps, pedestrian).
   - **`outdoor`**: la rete «foot» senza le strade delle auto (trunk,
     primary, secondary, tertiary).
   - **Tutte e due** si fermano a `sac_scale` T3, «demanding mountain
     hiking»: i percorsi alpinistici restano fuori.
2. Le misure vanno in `docs/sports/hike.md`, ADR-0321 in DECISIONS come
   «Proposto».
3. Le domande all'utente, una per volta, con una proposta già pronta, in
   questo ordine:
   1. il nome e l'emoji;
   2. la rete;
   3. le distanze;
   4. il limite `sac_scale`;
   5. se conta nel gioco e nei record;
   6. i testi;
   7. «ready».

### Parte A — motore, contratto, API (dopo le scelte)

Lista approvata dal Coordinatore il 2026-11-05; la migrazione ha il numero
dal Coordinatore quando ci si arriva:

```
services/route-engine/route_engine/networks/hike.py          (nuovo)
services/route-engine/route_engine/networks/__init__.py      (una riga)
services/route-engine/route_engine/activities/hiking.py      (nuovo)
services/route-engine/route_engine/activities/__init__.py    (una riga)
services/route-engine/route_engine/__main__.py, anchored.py  (la rete con OsmnxSource.for_activity)
services/route-engine/tests/test_hiking.py                   (nuovo)
packages/shared-types/src/sports/hiking.ts                   (nuovo)
packages/shared-types/src/sports/index.ts                    (una riga)
packages/shared-types/fixtures/route-request-hiking.json     (nuovo)
services/api/shaperoute_api/sports/hiking.py                 (nuovo)
services/api/shaperoute_api/sports/__init__.py               (una riga)
services/api/shaperoute_api/activities.py                    (un nome nel Literal)
services/api/shaperoute_api/reads.py                         (una riga)
services/api/migrations/00NN_hiking.sql                      (nuovo)
services/api/tests/test_hiking_api.py                        (nuovo)
apps/mobile/assets/engine/engine.zip                         (rifatto, ultimo commit)
docs/tasks/TASK-377.md, docs/STATUS.md, docs/sports/CONDIVISO.md, docs/sports/hike.md
```

L'impronta del motore cambia: server, migrazione e notte degli esempi si
fanno solo col sì dell'utente.

### Parte B — app (dopo A e dopo la #765, che tiene `settings/sport.ts`)

```
apps/mobile/src/sports/hiking.ts                 (nuovo)
apps/mobile/src/sports/index.ts                  (una riga)
apps/mobile/src/sports/hikingProfile.test.ts     (nuovo)
apps/mobile/src/settings/sport.ts                (una riga in ALL_SPORTS, activityOf)
apps/mobile/src/imports/fit.ts, imports/fileTrack.ts
apps/mobile/src/route/runTime.ts                 (se il tempo usa il passo a piedi)
apps/mobile/src/social/PublicParts.tsx           (la lista degli sport pubblicabili)
apps/mobile/src/i18n/it.ts, de.ts, fr.ts, es.ts  (i testi, col sì dell'utente)
```

Il profilo usa Apple `.hiking` (24) e Health Connect `EXERCISE_TYPE_HIKING`
(37). L'energia segue l'ACSM a piedi, come la camminata, con la salita.
L'impronta iOS non si muove (solo JavaScript): si misura comunque.

## Scelte dell'utente

Una alla volta, ciascuna con la proposta dell'agente:

1. **Nome ed emoji** (2026-11-05): «Hike» ⛰️. La proposta era «Hike» 🥾;
   l'utente ha scelto la montagna.
2. **La rete** (2026-11-05): la rete a piedi della corsa senza le strade
   delle auto (niente `trunk`, `primary`, `secondary`, `tertiary`) e senza
   sentieri oltre `sac_scale` T3, come la proposta. È `outdoor` di
   `hike.md`: 46 forme su 54 sulle sei zone.
3. **Le distanze** (2026-11-05): da 1 a 30 km, gli stessi limiti della
   camminata. La proposta era 3–20 km. Oltre i 20 km, in montagna, i
   cerchi del banco non riescono e il motore ci mette fino a 102 s a dirlo:
   la parte A lo misura a 25 e 30 km.
4. **La difficoltà dei sentieri** (2026-11-05): fino a `sac_scale` T3,
   «demanding mountain hiking», come nelle misure di `hike.md`. La
   proposta era T2, più prudente per percorsi disegnati per chiunque.
   L'utente ha scelto T3. I testi dovranno dire che i sentieri possono
   essere impegnativi: è la domanda sui testi.
5. **Gioco e record** (2026-11-05): come la camminata, che era la
   proposta. I metri contano nel gioco come quelli di una corsa, con gli
   stessi controlli. Niente tempi migliori e niente record personali.
6. **I testi** (2026-11-05), approvati come proposti. Il tono è quello
   dell'app («tu», in tedesco «du»).

   | en | it | de | fr | es |
   |---|---|---|---|---|
   | Hike | Escursione | Wandern | Randonnée | Senderismo |
   | Hike without a route | Escursione senza percorso | Ohne Route wandern | Randonner sans parcours | Senderismo sin ruta |
   | Trails can be demanding: check the route and the weather before you set off. | I sentieri possono essere impegnativi: controlla il percorso e il meteo prima di partire. | Wege können anspruchsvoll sein: Prüf Route und Wetter, bevor du losgehst. | Les sentiers peuvent être exigeants : vérifie le parcours et la météo avant de partir. | Los senderos pueden ser exigentes: revisa la ruta y el tiempo antes de salir. |

   - «Hike» è il nome in «Impostazioni», nella ricerca e nei post.
   - «Hike without a route» è il pulsante per partire senza percorso.
   - L'avviso sta sotto il percorso in «Disegna» quando lo sport è Hike:
     c'è perché i sentieri arrivano fino a T3. Per l'app è un punto in
     più, e va nella lista della parte B.

## Criteri di accettazione

- [x] 0: le misure delle reti sono in `hike.md`; ADR-0321 è proposto.
      `trails` è misurata solo a Trento, perché lì non regge.
- [ ] 0: le scelte dell'utente sono scritte qui, una per una.
- [ ] A: un percorso d'escursione sul grafo di prova sta sui sentieri; test
      deterministici; corsa, bici e canoa invariate al banco (`compare`).
- [ ] B: l'escursione si sceglie, si cammina, si salva e va in Salute; i
      testi sono in cinque lingue.
- [ ] Il diff di A e B confrontato con la ricetta: ogni deroga è in
      CONDIVISO, e il criterio aperto di TASK-376 B si chiude.

## File toccati

Parte 0:

```
docs/tasks/TASK-377.md     (nuovo)
docs/sports/hike.md        (nuovo)
docs/DECISIONS.md          (solo ADR-0321, in fondo)
docs/STATUS.md             (righe proprie)
docs/INDEX.md              (una riga)
```

Parti A e B: le liste sopra.

## Dove si è

2026-11-05: il Coordinatore ha approvato il piano, e ho misurato col banco,
un comando per volta e `nice -n 10`:

- **`trails`**: a Trento resta un pezzo di 88 km di marciapiedi attorno
  alla partenza, con 3 forme su 9. Non l'ho portata sulle altre zone.
- **`outdoor`**: 46 forme su 54 sulle sei zone, 21 buone. In montagna 6–7
  su 9, e la rete lì è soprattutto `track` e `path`.

Le misure sono in `hike.md`, e ADR-0321 è scritto come proposto. Prossimo:
la prima domanda all'utente, il nome e l'emoji.
