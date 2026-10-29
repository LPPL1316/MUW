# TASK-334 — I posti che l'utente tiene sul telefono

**Stato**: In corso — codice e documenti nella PR del branch
`feat/TASK-334-kept-places`; poi il server e l'OTA, ciascuno col sì
dell'utente
**Fase**: 4 · **Branch**: `feat/TASK-334-kept-places` · **ADR**: ADR-0290 ·
numeri dal coordinatore (2026-10-29)

## Obiettivo

L'utente sceglie i posti dove disegnerà: la loro zona sta sul telefono, e
le forme lì si disegnano sul telefono, più in fretta e anche senza
segnale. Dove il server non ha ancora la zona, la prepara lui.

Richiesta dell'utente del 2026-10-29: «Dai la possibilità ad un utente di
scaricarsi le zone di suo interesse, così è più veloce la creazione di
forme». È il seguito di TASK-214 (ADR-0177): il telefono scarica da solo
la zona intorno a sé e alcune città, ma più di metà delle richieste
`/phone-zones` trovano il server senza zona (`tasks/TASK-214.md`, «I log
dell'API sul server»).

**Scelta dell'utente** (2026-10-29, sulla proposta con l'anteprima di
«Settings»): **«Sì, così»**:

- in «Settings» → «Offline maps» c'è «Add a place»: si cerca un paese o
  una città per nome, si vede quanto pesa e si scarica;
- la zona di circa **6 km** intorno al posto, per lo **sport di
  «Settings»**, al massimo 12 MB;
- se il server non ha la zona **la prepara lui**, al massimo **3 zone nuove
  al giorno per telefono**, una alla volta; il telefono la scarica appena è
  pronta;
- fino a **10 posti**, che **restano finché non si cancellano**, fuori dal
  tetto dei 2 GB.

Testi approvati con l'anteprima: «Add a place», «Preparing the map…»,
«Places you add stay on the phone, so shapes there are drawn faster, even
without signal.». Testi nuovi da far approvare con la PR: «Trying again
later» e «Up to {count} places.» («Remove {name}», per VoiceOver, c'era
già).

## Contesto da leggere

- `docs/DECISIONS.md` ADR-0290 (e ADR-0177 per le zone del telefono);
- `docs/API.md` «Zone per il telefono», «I posti tenuti sul telefono»;
- `tasks/TASK-214.md`, «Il server: avvio, zone, traffico» e la parte E.

## Cosa fare

1. **API** — `POST /phone-zones/{network}/places` in
   `phone_zone_places.py`: `ready` se c'è una zona con 6 km intorno al
   posto, altrimenti in coda e `preparing`; un thread prepara un posto alla
   volta (Overpass con `OsmnxSource.load`, i nomi a piedi, il file del
   telefono); 3 posti nuovi al giorno per telefono e 20 per il server
   (`TrafficCap`), `429` oltre; `503` per un'ora dopo un download fallito.
   Mai mentre il server disegna percorsi (sotto, «Il server occupato»).
   Installato da `install_phone_zones`.
2. **App, le zone** — `ZoneEntry.kept`: fuori dai 2 GB, mai cancellata da
   `overLimit`, tenuta anche quando la zona intorno al telefono la
   riscrive; `downloadZone(…, { kept })` con un file parziale suo;
   `deleteZone(name)`.
3. **App, i posti** — `keptPlaces.ts`: la lista in
   `Documents/engine/places.json`, `addPlace` (10 al massimo),
   `removePlace` (con la zona se nessun altro posto la tiene),
   `forgetPlaces`, `keepPlaces` (uno alla volta: `POST`, poi `GET
   /phone-zones` con `margin_m=6000`).
4. **App, la pagina** — `OfflineMapsSetting`: una riga per posto con la
   misura o «Preparing the map…»/«Trying again later» e «✕», «Add a place»
   con `PlaceSearch`, la nota, «Delete» che toglie anche i posti; ogni
   30 s di nuovo mentre un posto si prepara. A ogni apertura dell'app
   `usePhoneZones` chiede i posti dopo le zone intorno e prima di quelle in
   anticipo.
5. **Testi** in italiano, tedesco, spagnolo e francese.

## Criteri di accettazione

- [x] Un posto dove il server ha la zona risponde `200 ready`; uno dove non
      ce l'ha `202 preparing`, viene preparato una volta sola anche se
      chiesto due volte, poi è `ready` e `GET /phone-zones` con
      `margin_m=6000` dà la sua zona, col file del telefono già scritto
      (`test_phone_zone_places.py`).
- [x] Il quarto posto nuovo di un telefono nello stesso giorno è `429` con
      `Retry-After`; un altro telefono passa; un posto già pronto non si
      conta; oltre il tetto del server `429`.
- [x] Un download fallito dà `503` con `Retry-After: 3600`, e dopo un'ora
      il posto si richiede.
- [x] I nomi delle strade si scaricano solo a piedi; senza, la zona resta.
- [x] Nessun posto parte mentre l'API ha richieste a `/route-jobs` negli
      ultimi 120 s (il giro di `draw_examples`), né con
      `data/cache/places.pause`; dopo, parte.
- [x] L'API avviata da riga di comando ha l'endpoint.
- [x] Le zone tenute non contano nei 2 GB e non si cancellano oltre il
      limite; una zona tenuta riscritta dal download intorno al telefono
      resta tenuta; un `304` la rende tenuta (`zones.test.ts`).
- [x] Un posto si aggiunge una volta per rete, al massimo 10; `ready`
      scarica con `margin_m=6000` e `kept`; `preparing` non scarica;
      `429`/`503` aspettano `Retry-After`; un server senza l'endpoint dà
      quello che ha, altrimenti un'ora d'attesa; senza rete non cambia
      niente; togliere un posto cancella la sua zona solo se nessun altro
      la tiene (`keptPlaces.test.ts`).
- [x] La pagina mostra i posti con la misura o lo stato, «✕» li toglie,
      «Add a place» trova un posto e lo aggiunge, si richiede ogni 30 s
      solo mentre un posto si prepara, con 10 posti la riga sparisce,
      «Delete» toglie anche i posti, in italiano
      (`OfflineMapsSetting.test.tsx`).
- [x] A ogni apertura, con un server che risponde, i posti si chiedono
      dopo le zone intorno e prima di quelle in anticipo; senza rete no
      (`usePhoneZones.test.ts`).
- [ ] L'utente approva i due testi nuovi.
- [x] L'impronta iOS su una copia pulita resta `83793e26…` (misurata sulla
      testa `feb5ab54`).

## Il server occupato

Chiesto dal coordinatore il 2026-10-29: la preparazione dei posti si ferma
quando il server fa il giro di notte degli esempi (`draw_examples`).

- **Come lo sa**: `draw_examples` non gira dentro l'API, la chiama come un
  telefono: `POST /route-jobs`, poi `GET /route-jobs/{id}` finché il
  percorso è pronto, poi il successivo. Un middleware dell'API
  (`watch_route_work`, `RouteWork`) annota l'ora dell'ultima richiesta a
  `/route-jobs`. Un posto parte solo dopo **120 s** senza nessuna; chi è in
  coda riguarda ogni 30 s. Finché il giro gira, quindi, nessun posto parte;
  finisce il giro, e dopo due minuti partono uno alla volta.
- **Di giorno** vale lo stesso per i telefoni: un posto non parte mentre
  qualcuno aspetta il suo percorso.
- **A mano**: `data/cache/places.pause` (sul server
  `/root/shaperoute/data/cache/places.pause`) ferma tutti i posti finché
  c'è. Serve per i lavori pesanti che non passano da `/route-jobs`:
  `prefetch_zones`, `phone_zone_api`. Si crea con `touch` e si toglie a fine
  lavoro.
- **Nel frattempo** il telefono riceve `202 preparing` e mostra «Preparing
  the map…».

## File toccati

```
docs/tasks/TASK-334.md
docs/DECISIONS.md
docs/API.md
docs/STATUS.md
services/api/shaperoute_api/phone_zone_places.py
services/api/shaperoute_api/phone_zone_api.py
services/api/tests/test_phone_zone_places.py
apps/mobile/src/engine/keptPlaces.ts
apps/mobile/src/engine/keptPlaces.test.ts
apps/mobile/src/engine/OfflineMapsSetting.tsx
apps/mobile/src/engine/OfflineMapsSetting.test.tsx
apps/mobile/src/engine/zones.ts
apps/mobile/src/engine/zones.test.ts
apps/mobile/src/engine/usePhoneZones.ts
apps/mobile/src/engine/usePhoneZones.test.ts
apps/mobile/src/profile/SettingsPage.test.tsx
apps/mobile/src/i18n/it.ts
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/es.ts
apps/mobile/src/i18n/fr.ts
```

`SettingsPage.test.tsx` conta i bottoni di «Settings»: «Add a place» è
uno in più (da 11 a 12), nient'altro.

## Fuori scope

- «Download this area» tenendo premuto sulla mappa di «Draw» o dalla pagina
  di una città in «Explore»: l'utente ha scelto la sola ricerca per nome.
- Le zone tenute nel conto del «quasi pieno» di `aheadZones.ts`: si ferma
  al massimo ~120 MB prima, lasciato com'è.
- Una zona più piccola per un posto in una città fitta, dove quella con 6
  km supera i 12 MB: il telefono riceve quella che riceverebbe lì comunque.
- Aggiornare da sola la zona di un posto quando il server ne ha una più
  nuova: succede quando il telefono si apre lì, come per le zone in
  anticipo.
- Le scadenze di Overpass e il server in un processo a parte: la
  preparazione è un thread dell'API, uno alla volta.

## Esito

*(da compilare a fine task)*
