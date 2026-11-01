# TASK-363 — Dove va la posizione del telefono: la verifica e il testo

**Stato**: In corso — proposta approvata dall'utente il 2026-10-30 con «Sì, approvo tutto», codice nella PR
**Fase**: 4 · **Branch**: `docs/TASK-363-position-audit` (documenti),
`fix/TASK-363-position` (codice) · numero dal Coordinatore (2026-10-30),
decisione in ADR-0306, punto 4

## Obiettivo

Ogni richiesta che porta fuori dal telefono una posizione è arrotondata quando
la precisione non serve, e «Your position» dice tutte le altre. TASK-356 ha
chiuso il solo Feed; questo task fa il giro intero, una volta sola.

## La verifica

Lettura del codice di `main` del 2026-10-30 (`7519e36f`), nessuna prova in
esecuzione. Controllati a mano: `themed.py`, `phone_zone_places.py`,
`zones.ts`, `recommendedRoutes.ts`, `recommended.ts`, `placeFinder.ts`.
«Esatta» è il valore intero del GPS, o del posto scelto.

| Richiesta | Posizione | Precisione | Serve così? | Il server la tiene? | La cita il testo? |
|---|---|---|---|---|---|
| `GET /phone-zones` (ogni apertura) | reale | esatta | **No**: una zona da 3–6 km attorno | No | In parte, senza dire che parte |
| `GET /phone-zones` `prefetch` | paesi vicini | esatta | No | Solo un conteggio in memoria | Sì |
| `POST /phone-zones/.../places` | posto tenuto | esatta | No, ma è un posto scelto | In memoria; **il riquadro finisce nel log** | In parte; la riga «il log non scrive posizioni» è falsa qui |
| `POST /route-jobs` | reale o scelta | esatta | Sì: il percorso parte da lì | `drawn_routes`, senza account; evento a 1 km | Sì |
| `POST /route-jobs` delle forme vicine, automatico | reale | esatta | Sì, ma non è chiesto | `drawn_routes`, senza account | **No**: il testo dice «che chiedi» |
| `POST /route-jobs` degli esempi | paesi e punti d'acqua vicini | esatta | Sì | `drawn_routes`, senza account | Non come tale |
| `POST /image-route-jobs` | reale o scelta | esatta | Sì | No; evento a 1 km | Sì |
| `POST /kept-routes` | paesi vicini | esatta | Sì: chiave a 4 decimali | No | **No** |
| `GET /nearby-cities` | reale o scelta | 2 decimali | Già a posto | Cache 24 h, senza account | Solo fra i terzi |
| `GET /city-photos/Q….jpg` | paese vicino | nel percorso | n/a | **Nel log, con l'IP** | **No** |
| `GET /recommended-routes` | reale o scelta | esatta | **No**: raggio 5 km | Evento a 1 km, senza account | In parte |
| `GET /recommended`, con il token | reale o scelta | esatta | **No**: raggio 5 km | No | **No** |
| `GET /feed`, con il token | reale o scelta | 2 decimali con TASK-356 | Raggio 50 km | No | Sì con TASK-356 |
| `GET /places` | reale se nota | esatta; il server gira 2 decimali | **No**: ordina soltanto | Cache 1 h | Sì |
| Photon (komoot), dal telefono | come sopra | 2 decimali | Già a posto | Non è il nostro | Sì |
| `POST /themed-route-jobs` | reale o scelta | esatta; **Geoapify la riceve intera** | Sì per il percorso, **no per Geoapify** | Job in memoria; evento senza punto | **No** |
| `POST /way-back` | reale | esatta | n/a | No | Non si manda oggi: nessun chiamante |
| `PUT /me/activities/{key}` | reale | esatta | Sì | `runs`, con l'account | Sì |
| Strava | reale | 7 decimali, con i tempi | Sì | `runs` | Sì |
| `PUT /me/favorites/{key}` | dal percorso | esatta | Sì | Con l'account | Sì |
| Disegno in un messaggio | dal percorso | esatta | Sì | Con il messaggio | Sì |
| `POST /gpx` | reale o scelta | esatta | Il percorso sì | No | In parte |
| `POST /route-directions` | dal percorso | esatta | Sì | No | **No** |
| `POST /signals` | città scelta | esatta; il server la arrotonda | No, ma è scelta | Evento a 1 km | In parte |
| Tegole OpenFreeMap | area guardata | z/x/y | Sì | Terzi | Sì |
| Tegole Esri (Satellite) | area guardata | z/x/y | Sì | Terzi | **No** |
| Tegole AWS (3D) | area guardata | z/x/y | Sì | Terzi | **No** |
| Wikimedia, dal server | paese vicino | solo l'id | n/a | Terzi | **No** |

**Senza posizione**: ricerca per testo in `/cities` e `/city-suggestions`,
`/place-photos`, `/contests/current`, `/game/*`, push, account, contatti. I
quattro selettori di foto hanno `exif: false`.

**Non verificato**: le impostazioni di produzione (`deploy/.env`, quindi anche
«It is off on our server» del registro delle richieste); quali zoom chiede
davvero MapLibre; se un livello nascosto scarica lo stesso le tegole; i log di
librerie di terzi; se i percorsi a tema finiscono in `drawn_routes`; se la
scheda annunci chiede altro, dentro l'SDK nativo.

## La proposta

Una sola, all'utente. Le domande a pezzi non servono.

**Due decimali nell'app** (circa 1 km): `GET /phone-zones`, `GET
/recommended-routes`, `GET /recommended`, `GET /places`. Il telefono ricalcola
`away_m` da `route.start`, come fa già `/nearby-cities`: le distanze sulle
schede restano giuste, e `ownCityName` con loro.

**Nel server**, serve un aggiornamento: `themed.py` manda a Geoapify due
decimali; `phone_zone_places.py` scrive il log senza il riquadro; `access_log.py`
toglie anche il percorso di `/city-photos`.

**Restano esatte**: la partenza di un percorso, gli esempi, `kept-routes` (la
chiave), un posto tenuto, le corse, i preferiti, i `signals` (il server li
arrotonda già).

**Il testo.** Sostituisce la frase approvata in TASK-356 solo dopo il sì
dell'utente.

«Your position»:

- **en** It goes to our server exactly as it is as the start of a route you ask
  for, as the start of the shapes the app prepares for you nearby when the
  phone cannot draw them itself, and inside a run you save. It goes rounded to
  about 1 km to find the offline map around you, recommended routes, towns and
  drawings nearby, and to put the places near you first in a search; rounded
  like this it is not kept with your account.
- **it** Va al nostro server esatta come partenza di un percorso che chiedi, come
  partenza delle forme che l'app ti prepara qui vicino quando il telefono non
  riesce a disegnarle da solo, e dentro una corsa che salvi. Va arrotondata a
  circa 1 km per trovare la mappa offline intorno a te, i percorsi consigliati,
  i paesi e i disegni vicini, e per mettere prima i luoghi vicini a te in una
  ricerca; così arrotondata non resta legata al tuo account.
- **de** Er geht genau an unseren Server als Start einer Route, die du anforderst,
  als Start der Formen, die die App dir in der Nähe vorbereitet, wenn das Handy
  sie nicht selbst zeichnen kann, und innerhalb eines Laufs, den du speicherst.
  Auf etwa 1 km gerundet geht er an den Server, um die Offline-Karte um dich
  herum, empfohlene Routen, Orte und Zeichnungen in der Nähe zu finden und bei
  einer Suche die Orte in deiner Nähe zuerst zu zeigen; so gerundet bleibt er
  nicht mit deinem Konto verbunden.
- **fr** Elle va vers notre serveur exacte comme départ d'un parcours que tu
  demandes, comme départ des formes que l'app te prépare à proximité quand le
  téléphone ne peut pas les dessiner lui-même, et dans une course que tu
  enregistres. Elle y va arrondie à environ 1 km pour trouver la carte hors ligne
  autour de toi, les parcours recommandés, les villes et les dessins proches, et
  pour montrer d'abord les lieux près de toi dans une recherche ; ainsi arrondie,
  elle ne reste pas liée à ton compte.
- **es** Va a nuestro servidor exacta como inicio de una ruta que pides, como
  inicio de las formas que la app te prepara cerca cuando el teléfono no puede
  dibujarlas por sí mismo, y dentro de una carrera que guardas. Va redondeada a
  cerca de 1 km para encontrar el mapa sin conexión a tu alrededor, las rutas
  recomendadas, los pueblos y los dibujos cercanos, y para poner primero los
  lugares cercanos en una búsqueda; así redondeada no queda ligada a tu cuenta.

Geoapify, l'inizio della voce (il resto non cambia):

- **en** Geoapify receives the searches for places, for the towns near you and
  for the places of a themed route, with the position rounded to about 1 km, and,
  to name the place of a saved run, its start rounded the same way:
- **it** Geoapify riceve le ricerche di luoghi, dei paesi vicini e dei posti di un
  percorso a tema, con la posizione arrotondata a circa 1 km, e, per dare il nome
  al luogo di una corsa salvata, la sua partenza arrotondata allo stesso modo:
- **de** Geoapify erhält die Suchen nach Orten, nach Orten in deiner Nähe und nach
  den Plätzen einer Themenroute, mit der auf etwa 1 km gerundeten Position, und,
  um den Ort eines gespeicherten Laufs zu benennen, seinen ebenso gerundeten
  Start:
- **fr** Geoapify reçoit les recherches de lieux, de villes près de toi et de lieux
  d'un parcours à thème, avec la position arrondie à environ 1 km, et, pour nommer
  le lieu d'une course enregistrée, son départ arrondi de la même façon :
- **es** Geoapify recibe las búsquedas de lugares, de pueblos cercanos y de los
  lugares de una ruta temática, con la posición redondeada a cerca de 1 km, y,
  para nombrar el lugar de una carrera guardada, su inicio redondeado igual:

Due voci nuove nell'elenco dei terzi:

- **en** Wikimedia serves our server the photos of towns: it sees which town, not
  who asked. · With the «Satellite» map Esri serves the images, and with the «3D»
  map Amazon Web Services serves the heights: like any map service, they see which
  area you look at.
- **it** Wikimedia dà al nostro server le foto dei paesi: vede quale paese, non chi
  lo chiede. · Con la mappa «Satellite» Esri fornisce le immagini, e con la mappa
  «3D» Amazon Web Services fornisce le altezze: come ogni servizio di mappe, vedono
  quale area guardi.
- **de** Wikimedia liefert unserem Server die Fotos der Orte: Es sieht welchen Ort,
  nicht wer fragt. · Bei der Karte «Satellit» liefert Esri die Bilder und bei der
  Karte «3D» liefert Amazon Web Services die Höhen: Wie jeder Kartendienst sehen sie,
  welches Gebiet du ansiehst.
- **fr** Wikimedia fournit à notre serveur les photos des villes : il voit quelle
  ville, pas qui demande. · Avec la carte « Satellite », Esri fournit les images, et
  avec la carte « 3D », Amazon Web Services fournit les altitudes : comme tout
  service de cartes, ils voient quelle zone tu regardes.
- **es** Wikimedia da a nuestro servidor las fotos de los pueblos: ve qué pueblo, no
  quién pregunta. · Con el mapa «Satélite» Esri da las imágenes, y con el mapa «3D»
  Amazon Web Services da las alturas: como cualquier servicio de mapas, ven qué zona
  miras.

## Scoperto nel codice

Due eccezioni a «`GET /phone-zones`», decise dall'agente su delega
dell'utente, senza effetto sul testo approvato:

- **Un posto tenuto resta esatto.** Il server prepara la sua zona attorno a
  quel punto, con il margine pieno: chiederla da un punto spostato di 700 m
  non la troverebbe.
- **Un paese scaricato in anticipo resta esatto.** È il centro di un paese,
  non dice dove sta il telefono.

**Il log del server**, prima e dopo: il riquadro di un posto tenuto (`place zone
foot (46.01, 11.07, 46.12, 11.17) queued`) diventa `place zone foot queued`;
`GET /city-photos/Q3415.jpg` diventa `GET /city-photos/`. L'indirizzo IP
resta nella riga come oggi.

## Criteri di accettazione

- [x] Nessuna delle quattro richieste scrive più di due decimali: test.
- [x] `away_m` ricalcolato sul telefono: test.
- [x] A Geoapify non arriva mai più di due decimali: test.
- [x] Il log non scrive il riquadro né `/city-photos`: test.
- [x] Il testo nelle cinque lingue, nell'app e in `site/privacy`, con la data.
- [ ] Suite mobile completa, CI verde, impronta `83793e26` su una copia pulita.

## File toccati

Questa PR: `docs/tasks/TASK-363.md`, `docs/STATUS.md`, `docs/INDEX.md`.

Il codice, se l'utente dice sì:

```
apps/mobile/src/engine/zones.ts, zones.test.ts
apps/mobile/src/explore/recommendedRoutes.ts, recommendedRoutes.test.ts
apps/mobile/src/explore/RecommendedRow.test.tsx, ExploreOwnRoutes.test.tsx, ExploreMoreShapes.test.tsx
apps/mobile/src/feed/feedRoute.test.ts
apps/mobile/src/api/recommended.ts, recommended.test.ts
apps/mobile/src/places/placeFinder.ts
apps/mobile/src/about/content/{en,it,de,fr,es}.ts
apps/mobile/__tests__/AppFeed.test.tsx
site/privacy/index.html, {it,de,fr,es}/index.html
services/api/shaperoute_api/themed.py, phone_zone_places.py, access_log.py, i test
docs/STATUS.md, docs/tasks/TASK-356.md, docs/tasks/TASK-363.md
```

## Fuori scope

- Pubblicare il sito, l'OTA di produzione e aggiornare il server: tre sì a parte.
- Le etichette App Privacy e Data safety: le controlla l'utente.
- Cambiare quando partono le forme vicine: scelta di prodotto, non chiesta.

## Esito

*(a fine task)*
