# TASK-365 — I percorsi di MuW nel Feed

**Stato**: Todo — documenti ora, codice col via del Coordinatore e le scelte chiuse
**Fase**: 4 · **Branch**: `docs/TASK-365-muw-routes-in-feed` (documenti),
`feat/TASK-365-muw-routes` (codice) · **ADR**: ADR-0310 · numeri dal
Coordinatore (2026-10-31)

## Obiettivo

Nel Feed compaiono percorsi-disegno in bici creati da MuW, riconoscibili come
tali: autore MuW, l'etichetta «Percorso creato da MuW – pedalalo tu», nessuna
persona, data di uscita, tempo, passo o calorie. La richiesta è dell'utente
(2026-10-30; «Sì, apri il task», 2026-10-31).

## Contesto da leggere

- `docs/API.md`, «Feed» e «Block and report».
- ADR-0310; ADR-0127 (gli esempi), ADR-0097 e `recommended.py` (i percorsi
  letti da file), ADR-0153 (la bici, 10–30 km).
- `docs/tasks/TASK-362.md`, scelta 4: la questione degli esempi, aperta col
  Coordinatore.
- `docs/tasks/TASK-364.md` quando c'è: le stesse bozze in Explore.

## Cosa c'è oggi

- Un post è una riga di `drawings` su una riga di `runs`: `user_id`,
  `started_at` e `duration_s` sono obbligatori, e non c'è uno stato «bozza».
  Metterci un percorso mai pedalato vorrebbe dire inventare tempi e un utente.
- **Dodici bozze** in `out/muw-bike-drafts/`, fuori dal repository, generate
  il 2026-10-31 col motore (`plan_nearby`, `activity: cycling`):
  `feed_drafts.json`, tutte `approved: false`, e `posts/<id>/` con SVG, GPX,
  GeoJSON, PNG e metadati. Sono tutte fra 20 e 30 km: oltre, il motore in bici
  rifiuta. Nessuna è stata pedalata.
- **Il punteggio del motore non basta**: a Trento un fungo illeggibile aveva
  0,90, e 0,91–0,98 le altre forme scartate sulle reti stradali povere. Il
  controllo a occhio resta necessario (ADR-0036).
- Il motore non evita il traffico: tre bozze passano per quasi 1 km o più in
  galleria, due hanno più di 3 km su strade principali, due hanno 6–8 km di
  sterrato (`meta.json` di ognuna).

## Scelte dell'utente

Una alla volta, con le sue parole. **Aperte, tranne la 2.**

1. **Quali percorsi.** Proposta: si parte dai sette giudicati buoni a occhio,
   senza i tre di Halloween, fuori stagione dal 1° novembre, e senza quelli
   sopra i 500 m di galleria finché non sono controllati o rigenerati.
   **Oggi restano solo due**, Autumn Mushroom e GO: l'albero e la freccia tornano
   controllati i tunnel, gli altri cinque sono discreti a occhio e li giudica
   l'utente. Sono anche fra i cinque che TASK-364 propone per Explore (scelta 2).
2. **Chi pubblica cosa con TASK-364.** Proposta di questo task: un percorso sta
   in Explore **o** nel Feed, mai doppio senza motivo. TASK-364 propone cinque
   bozze per Explore; l'elenco si decide con quella sessione (`local_ef39e13c`)
   e con l'utente.
   — *Risposta* (2026-11-01, su Autumn Mushroom e GO, che erano nelle due
   proposte): «Nel Feed». Ghost, Bat e Pumpkin vanno in Explore con TASK-364
   (scelta dell'utente in quella sessione: «Sì, questi 5»).
3. **Dove stanno nel Feed.** Proposta: uno ogni dieci post, solo nella scheda
   «Tutti», mai in «Seguiti», e pochi: non devono coprire i post degli iscritti.
4. **Senza account.** Proposta: si vedono anche senza account, dopo gli esempi
   che ci sono oggi.
5. **I testi**, in inglese, italiano, tedesco, francese e spagnolo. Proposta
   per l'etichetta:
   - Route created by MuW – ride it yourself
   - Percorso creato da MuW – pedalalo tu
   - Route von MuW – fahr sie selbst
   - Parcours créé par MuW – à toi de pédaler
   - Ruta creada por MuW – recórrela tú

   Anche i titoli dei percorsi sono testi: si approvano con l'elenco della
   scelta 1. Nel codice il testo di base è l'inglese (ADR-0172).
6. **Cosa si può fare sul post.** Proposta, ADR-0310 punto 4: niente account
   «MuW», reazioni, commenti, profilo, follow o messaggi; si apre il percorso e
   si parte. La scelta dell'utente può cambiarlo.

## I candidati del secondo giro (2026-11-02)

Richiesta dell'utente, riportata dal Coordinatore: «almeno 30 percorsi in città
diverse, lunghezze diverse, sport differenti, con la canoa mi raccomando, fai
qualche sbavatura, non possono essere perfette le forme». Sono **33 candidati**
in `out/muw-bike-drafts/` (`candidates.json`, `contact_sheet_all.png`, un
`posts/<id>/` ciascuno), tutti `approved: false`: nel repository entrano solo
quelli che l'utente approva dal foglio di contatto.

- **Sport e luoghi**: 16 a piedi (5–21 km, una città ciascuno), 13 in bici
  (11–28 km: le 9 bozze del primo giro senza Ghost, Bat e Pumpkin, che sono di
  TASK-364, più 4 città nuove), 4 in canoa (1,2–2 km, in tre laghi del Trentino).
- **Come sono fatte le sbavature**: solo linee del motore, mai rumore aggiunto. A
  piedi il motore parte solo dalla piazza scelta, senza le partenze vicine
  (`nearby=0`): si tiene la sua prima risposta, non la migliore fra molte, e si
  tiene anche a similarità bassa (0,85–0,87 a Pisa, Padova, Parma) se si legge.
  In bici il primo giro aveva le partenze vicine; le 4 nuove pure.
- **In canoa la forma è perfetta per forza**: sull'acqua non ci sono strade a
  piegarla, e il motore la mette intera (similarità 1). Le sbavature lì non
  vengono.
- **Il controllo a occhio** è in `candidates.json` (`eye_check`): 10 buoni, 15
  discreti, 8 deboli. I deboli si leggono poco anche con similarità alte (il
  cavallo di Roma ha 0,997): li giudica l'utente.
- **Limiti del motore e del Mac**: in bici oltre 30 km il motore rifiuta
  (ADR-0153), quindi niente 40 km; in canoa da 1 a 5 km, e solo dove
  `data/cache/water` copre già la zona (`download=False`: nessun download
  d'acqua, nessuna lettura dal server). Per questo le canoe stanno in tre laghi
  e sono corte. I grafi scaricati stanno in `out/muw-bike-drafts/cache/`
  (`CACHE.md`), mai in `data/cache/`.

**Tempi del motore per città** (secondi, la prova tenuta; comprendono il
download da Overpass la prima volta, che quel giorno rispondeva spesso 502):

| Sport | Città e secondi |
|---|---|
| Piedi | Firenze 245, Verona 84, Padova 249, Roma 124, Parma 142, Ferrara 90, Bergamo 73, Sevilla 237, Zaragoza 77, Salamanca 107, Granada 113, Paris 100, Modena 80, Brescia 108, Pisa 109, Lecce 64 |
| Bici | Barcelona 738, Torino 77, Valencia 6 e 186, Milano 166, Madrid 137, Burgos 73, León 141, Bologna 88, Vitoria-Gasteiz 168, Valladolid 160, Reggio Emilia 136, Cremona 162 |
| Canoa | Caldonazzo 1 e 1, Toblino 0, Serraia 0 (acqua già in cache) |

## Cosa fare

Il codice parte col via del Coordinatore, dopo il merge di questi documenti.
Ordine dato dal Coordinatore: API e `shared-types` dopo la PR di TASK-362; la
card dopo TASK-362 (`FeedScreen`) e TASK-355 A (`FeedPost`), prima di TASK-348 A
app.

1. `catalog/muw_routes/<id>.json`: **solo** i percorsi approvati, copiati dalle
   bozze, con linea, distanza, dislivello stimato, difficoltà, testi e
   attribuzione OSM. Nessun campo di tempo.
2. `muw_routes.py` (nuovo): legge i file all'avvio, come `recommended.py`.
   `GET /muw-routes` li elenca, ognuno con un'anteprima leggera, e
   `GET /muw-routes/{id}` ne dà uno intero. `feed.py` non si tocca.
3. `shared-types`, fixture, `docs/API.md`.
4. `api/muwRoutes.ts` e `feed/useMuwRoutes.ts` (nuovi): `404` o un errore di
   rete danno un elenco vuoto, senza messaggi.
5. `feed/MuwPost.tsx` (nuovo): la card, con i token e `Tap`. In `FeedScreen` il
   minimo per inserirla; `FeedPost.tsx` non si tocca.
6. Aprire il percorso: lo stesso cammino di Explore per «Start», da verificare
   nel codice prima di scrivere; se non basta, ci si ferma e si segnala.
7. I testi approvati in `i18n/*.ts`.

## Criteri di accettazione

- [ ] **App già pubblicata**: `GET /feed` risponde come prima, nessun tipo e
      nessun campo nuovo: test sulla risposta.
- [ ] **Server di oggi**: la nuova app, con `GET /muw-routes` a `404`, mostra il
      Feed di sempre, senza errori: test, e provato nel simulatore.
- [ ] Una bozza non approvata non arriva mai all'API: nel repository ci sono
      solo i file approvati, e un test rifiuta un file senza attribuzione OSM o
      con un campo di tempo.
- [ ] Sulla card c'è sempre l'etichetta tradotta; nessuna data, tempo, passo,
      calorie o nome di persona: test.
- [ ] Nessun utente «MuW» nel database; niente reazioni, commenti, profilo,
      follow, messaggi o segnalazione sulla card: test.
- [ ] Un percorso approvato si apre e si esporta in GPX come `cycling`.
- [ ] Nessun percorso è doppio fra Feed ed Explore, salvo scelta dell'utente.
- [ ] Ogni percorso pubblicato è stato guardato a occhio, ha il dislivello detto
      come stima e non supera i limiti della scelta 1.
- [ ] Testi approvati in cinque lingue, nessun colore a mano, nessuna dipendenza
      nuova, impronta iOS invariata su una copia pulita.
- [ ] Prima e dopo dal simulatore, in scuro e in chiaro. Server e OTA solo col
      sì dell'utente.

## File toccati

Questa PR:

```
docs/tasks/TASK-365.md
docs/DECISIONS.md
docs/STATUS.md
docs/INDEX.md
```

Codice, se le scelte confermano ADR-0310:

```
catalog/muw_routes/*.json                             (nuovi)
services/api/shaperoute_api/muw_routes.py             (nuovo)
services/api/shaperoute_api/app.py
services/api/tests/test_muw_routes.py                 (nuovo)
packages/shared-types/src/index.ts
packages/shared-types/fixtures/muw-routes.json        (nuovo)
packages/shared-types/fixtures/muw-route.json         (nuovo)
packages/shared-types/test/muwRoutes.test.ts          (nuovo)
apps/mobile/src/api/muwRoutes.ts                      (nuovo)
apps/mobile/src/feed/useMuwRoutes.ts, .test.tsx       (nuovi)
apps/mobile/src/feed/MuwPost.tsx, MuwPost.test.tsx    (nuovi)
apps/mobile/src/screens/FeedScreen.tsx                (il minimo)
apps/mobile/src/i18n/*.ts
docs/API.md, docs/UI.md, docs/STATUS.md, docs/tasks/TASK-365.md
```

Senza migrazione: se le scelte la rendono necessaria, il numero lo dà il
Coordinatore (0040 e 0041 sono prese).

## Fuori scope

- `tools/sample_feed.py`, `sampleFeed.json` e gli esempi finti: la scelta è
  aperta col Coordinatore (TASK-362, scelta 4). Qui non si scrive codice su
  questo.
- Percorsi oltre i 30 km: cambierebbero il motore (ADR-0153).
- Numeri, spazi e frasi lunghe nelle scritte: «2026» e «BUEN CAMINO» non si
  disegnano col motore di oggi.
- Le voci nel catalogo delle forme (ADR-0036).
- Un account «MuW» con follow e messaggi, se l'utente non lo sceglie.

## Esito

*(si compila a fine task)*
