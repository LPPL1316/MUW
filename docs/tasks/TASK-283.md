# TASK-283 — Le foto dei paesi in «NEARBY TOWNS»

**Stato**: In review (PR aperta, 2026-10-11)
**Fase**: 4 · **Branch**: `feat/TASK-283-city-photos`
**Dipende da**: TASK-236 (in `main`) · **ADR**: ADR-0243

Chiesto dall'utente il 2026-10-11, con lo screenshot di «Explore» intorno a
Moreda de Álava (Spagna): «Aggiungere foto delle città». Le schede di
«NEARBY TOWNS» erano vuote finché il cuore non era disegnato.

## Obiettivo

Ogni paese di «NEARBY TOWNS» che ha una foto la mostra nella sua scheda,
con il credito che la licenza chiede. Le scelte sono dell'utente, chieste
una per volta:

- **«Solo foto»**: la foto prende il posto di mappa e cuore; le forme si
  vedono dopo aver toccato il paese.
- **«Scheda di oggi»** per un paese senza foto: mappa e cuore come prima.
- **«Piccolo sulla foto»** per il credito: «© Autore · CC BY-SA 4.0» in
  basso sulla foto; niente se la licenza non chiede niente.

## Contesto da leggere

- `docs/DECISIONS.md` ADR-0243 (questa scelta), ADR-0200 (i paesi vicini)
- `docs/API.md`, `GET /nearby-cities` e `GET /city-photos/{item}.jpg`
- `docs/UI.md`, «Explore», «Da TASK-236» e «Da TASK-283»

## Cosa fare

1. **API** (`city_photos.py`, nuovo): dall'elemento Wikidata del posto
   (Geoapify lo dà già) l'immagine P18, da Commons licenza, autore e
   miniatura larga 500 px. Solo CC BY, CC BY-SA, CC0, pubblico dominio.
   La miniatura scaricata una volta, risalvata JPEG senza metadati, tenuta
   in `city_photos/` della cache e data da `GET /city-photos/{item}.jpg`.
2. **API** (`nearby_cities.py`): l'elemento di ogni posto, e `photo`
   (`url`, `credit`) nella risposta; `__main__.py` monta le due cose.
3. **App**: `nearbyCities.ts` legge `photo` (solo un percorso dell'API);
   `RouteCard.tsx` ha la prop `photo` (foto al posto del disegno, credito
   con la licenza mai tagliata); `NearbyTowns.tsx` la usa, e torna alla
   scheda di prima se la foto non si carica.

## Privacy

A Wikidata e a Commons vanno **solo l'elemento** (`Q1442886`) **e il nome
del file**, con lo User-Agent `MuW-API/1.0 (https://getmuw.app/support/)`:
mai la posizione dell'utente né il quadrato di `/nearby-cities`, che resta
fra l'API e Geoapify come prima. Il telefono prende le foto solo dalla
nostra API: Wikimedia non vede chi guarda. L'informativa non cambia.

## Criteri di accettazione

- [x] `GET /nearby-cities` dà `photo` per i posti che hanno una foto con
      licenza libera (`url` sull'API, `credit` o `null`), `null` per gli
      altri; le richieste a Wikimedia hanno solo elementi e nomi di file.
- [x] GFDL da sola e licenze sconosciute: nessuna foto. Pubblico dominio e
      CC0: nessun credito.
- [x] `GET /city-photos/{item}.jpg` dà la JPEG (≤ 500 px, senza EXIF),
      scaricata una volta e tenuta su disco; 404 per un elemento senza foto
      o mai nominato; 503 se Commons non la dà.
- [x] Un posto nuovo aspetta al più 2 s; quello che arriva dopo resta per la
      richiesta successiva; senza risposta da Wikimedia, 10 minuti senza
      chiedere.
- [x] Nell'app: scheda con la foto e il credito, senza «Drawing…»; senza
      foto, o se la foto non si carica, la scheda di prima; un `url` che non
      è un percorso dell'API è ignorato.
- [x] Test deterministici, senza rete, per API e app.
- [x] Provato dal vero sul Mac (2026-10-11): API del branch sulla porta 8083
      con Geoapify e Wikimedia veri, app in Expo Go nel simulatore (iPhone
      17e) con la posizione a 42.51, -2.42. «NEARBY TOWNS» mostra Moreda,
      Viana, Logroño, Lardero, Laguardia, Santa Cruz de Campezo, tutti con
      la foto; i sei `GET /city-photos/…` rispondono 200.

## File toccati

```
services/api/shaperoute_api/city_photos.py          (nuovo)
services/api/tests/test_city_photos.py              (nuovo)
services/api/shaperoute_api/nearby_cities.py
services/api/tests/test_nearby_cities.py
services/api/shaperoute_api/__main__.py             (quattro righe)
apps/mobile/src/explore/nearbyCities.ts
apps/mobile/src/explore/nearbyCities.test.ts
apps/mobile/src/explore/RouteCard.tsx
apps/mobile/src/explore/RouteCard.test.tsx
apps/mobile/src/explore/NearbyTowns.tsx
apps/mobile/src/explore/NearbyTowns.test.tsx
docs/API.md
docs/UI.md
docs/DECISIONS.md                                   (ADR-0243)
docs/STATUS.md
docs/tasks/TASK-283.md                              (nuovo)
```

## Fuori scope

- Foto per le altre città di «Explore» (la città scelta, le recenti) e per
  i posti di «Paddle» (laghi e spiagge): non chieste.
- Scegliere una foto migliore di quella di Wikidata (Laguardia ha un
  dolmen): la sceglie chi cura Wikidata.

## Pubblicazione

- **Server**: merge e aggiornamento solo dopo l'approvazione di Apple della
  1.0 e con l'ok dell'utente (Coordinatore). Nessuna migrazione; la
  cartella `city_photos/` nasce da sola nella cache (`data/cache`).
- **App**: solo JavaScript, pubblicabile con un aggiornamento OTA. Senza il
  server nuovo l'app mostra le schede di prima.
