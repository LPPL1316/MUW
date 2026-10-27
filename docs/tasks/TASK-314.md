# TASK-314 — La strada per tornare sul percorso, sulle vie

**Stato**: In lavorazione — parte A
**Fase**: 4 · **Branch**: `feat/TASK-314-a-way-back` (A), poi
`feat/TASK-314-b-way-back-run` (B)
**ADR**: ADR-0274 (seguito di ADR-0263) · A: motore, API, motore sul
telefono · B: schermo di corsa, testi nuovi da approvare dall'utente

## Obiettivo

Chi esce dal percorso riceve la strada per tornarci **sulle vie**, come il
ricalcolo di Google Maps: disegnata sulla mappa e detta svolta per svolta.
Oggi (TASK-303) ha solo una linea a puntini in linea d'aria, «120 m NE».
Quella linea resta, ma solo quando la strada non si può calcolare.

## Contesto

Richiesta dell'utente del 2026-10-27: «Se esci dal percorso ti deve dare
le indicazioni per tornare sul percorso, tipo il ricalcolo di Google
maps». ADR-0263, punto 3, l'aveva lasciata come seguito: «Nessun calcolo
di strade: sarebbe un seguito, col motore».

Numero, ADR e condizioni dal Coordinatore (2026-10-27):

- A e B sono parti dello stesso task, in contesti separati. A può partire
  subito; B entra dopo la #567 (TASK-304) e dopo A.
- `app.py` (la riga del router) la tocca anche la #581: chi entra dopo
  si riallinea. `engine.zip` si rigenera da `main` al merge.
- **Impronta del motore**: `way_back.py` non cambia la ricerca dei
  percorsi, quindi l'impronta che decide gli esempi tenuti (`route_store`,
  `draw_examples`) non deve cambiare.
- **Server vecchio**: l'app nuova con il server di oggi (404 su
  `/way-back`) e senza zona sul telefono mostra i puntini come adesso,
  senza errori, con un test. `main` resta pubblicabile su `preview`.
- **Frequenza**: dal telefono al massimo una richiesta ogni N secondi
  mentre si è fuori; sul server un limite per chi chiede e per IP. La
  strada calcolata si tiene finché ci si sta sopra.
- **Voce (B)**: le frasi delle svolte che esistono già, mai sopra le
  svolte del percorso (TASK-302, TASK-303); un ricalcolo con il suo
  limite. Testi nuovi con il sì dell'utente.
- Il motore resta puro, eseguibile senza rete. L'impronta iOS `83793e26`
  non cambia. Il server si aggiorna dopo Apple e con il sì dell'utente.

## Contesto da leggere

- `docs/DECISIONS.md`: ADR-0263 (rientro e punto di rientro), ADR-0052
  (navigazione), ADR-0117 (`/route-directions`), ADR-0177 (motore sul
  telefono), ADR-0167 (bici a mano, `step_cost`)
- `docs/API.md`, `POST /route-directions`
- `services/api/shaperoute_api/line_directions.py`, `on_phone.py`
- `apps/mobile/src/navigation/rejoin.ts`, `navigator.ts` (solo B)

## Parte A — motore, API, motore sul telefono

1. **`route_engine/way_back.py`** (nuovo), `way_back(graph, here, ahead)`:
   - `ahead` è il tratto del percorso dove si può rientrare, in ordine.
     L'app lo taglia con `rejoinAheadM` (ADR-0263, punto 2) e con un tetto.
   - **Partenza**: il punto della strada più vicina al runner, non il
     nodo più vicino. A metà isolato si va avanti, non indietro
     all'incrocio. Da lì valgono i due capi della strada, ognuno con il
     suo pezzo di strada; in bici solo quelli percorribili (sensi unici).
   - **Arrivo**: il nodo di `ahead` più vicino **per strada** (Dijkstra con
     `step_cost`: la bici a mano costa di più, come `pen_up`); a parità,
     il primo lungo il percorso. Per costruzione la strada non corre sul
     percorso: il primo nodo del percorso che tocca è già un arrivo.
     Oltre `MAX_WAY_M` non c'è strada per tornare.
   - **Fuori**: i punti dal runner lungo le geometrie delle vie, la
     lunghezza, il punto di rientro, dove cade lungo `ahead` (`rejoin_m`)
     e le indicazioni. `guidance` gira sui nodi della strada più quelli del
     percorso dopo il rientro, così l'ultima indicazione dice da che parte
     prendere il percorso. Le distanze si misurano dal runner.
   - Nessuna strada (il tratto non è su questa mappa, niente entro
     `MAX_WAY_M`): `NoWayBackError`, un `InvalidRequestError`.
2. **L'impronta**: `route_store.engine_fingerprint` lascia fuori
   `way_back.py`. Un test controlla che nessun modulo del motore lo
   importi: se un giorno la ricerca dei percorsi lo usasse, il test cade e
   l'eccezione va tolta. Quella di `paddle_examples` già non lo vede.
3. **`POST /way-back`** (`shaperoute_api/way_back.py` per corpi e calcolo,
   senza FastAPI, perché gira anche sul telefono; `way_back_api.py` per il
   router e i limiti; una riga in `app.py`). Il corpo è
   `{activity, here, ahead}`. La risposta è
   `{points, distance_m, rejoin, rejoin_m, directions}`, con le vie a cui
   corre accanto una strada senza nome (`with_alongs`), come
   `/route-directions`. Solo le reti di strada: sull'acqua 422.
   - **Limiti**: per chi chiede (`X-Phone-Id`, l'id anonimo del telefono
     di TASK-214 A2, altrimenti l'IP) e per IP, più larghi, perché gli
     operatori mobili mettono molti telefoni dietro un IP. Oltre, 429 con
     `Retry-After`. Non per account: la corsa e la sua guida funzionano
     senza account, e il token costerebbe una query a ogni richiesta.
4. **Sul telefono**: `on_phone.way_back_json`, la stessa risposta dello
   stesso calcolo; `page.ts` e `phoneEngine.ts` con la chiamata
   `wayBack`; `engine.zip` ricostruito.
5. **Nell'app** (nessuno la usa fino a B): `api/wayBack.ts` (POST
   `/way-back`, non lancia mai) e `engine/wayBackOnPhone.ts`. Prima il
   telefono, se ha la zona e il motore va. Poi il server. Altrimenti
   `{kind: "none"}`, cioè i puntini come oggi: server vecchio (404),
   offline, 429, 422, tempo scaduto.
6. **Contratto**: tipi in `shared-types`, fixture `way-back-request.json`
   e `way-back.json` controllate da TypeScript e da Python; `API.md`.

## Parte B — lo schermo di corsa

In un contesto suo, dopo la #567 e dopo A. I «File toccati» di B li
manda al Coordinatore chi la fa, prima del codice.

- Fuori percorso (ADR-0070) l'app chiede la strada per tornare con
  `wayBackOnPhone`, al massimo una volta ogni `WAY_BACK_EVERY_S`. La
  tiene finché il runner ci sta sopra. La chiede di nuovo quando la lascia
  o quando il punto di rientro esce dalla finestra di ADR-0263.
- **Mappa**: la strada sulle vie a puntini, al posto della linea dritta.
  **Banner**: la prossima svolta della strada per tornare. **Voce**: le
  frasi delle svolte che ci sono già, mai sopra le svolte del percorso;
  una frase al ricalcolo, con il suo limite.
- Senza strada si vedono i puntini dritti di TASK-303, senza errori.
- Il rientro resta quello di ADR-0263: lo decide il navigatore con le
  posizioni, non la strada calcolata.
- I testi nuovi in 5 lingue vanno proposti all'utente: senza il suo sì la
  PR non entra.

## Criteri di accettazione — parte A

- [ ] Su una griglia di prova: un runner a metà isolato va avanti verso
      il percorso, non torna all'incrocio dietro; il rientro è il nodo più
      vicino per strada, non in linea d'aria (un isolato lungo in mezzo).
- [ ] Il percorso chiuso più avanti (la strada che il runner ha lasciato)
      non si riprende all'indietro: si rientra al primo nodo raggiunto.
- [ ] In bici un senso unico contrario non si prende; un tratto a mano
      costa di più.
- [ ] Le indicazioni partono dal runner e finiscono al rientro, con il
      verso da prendere sul percorso; le distanze sono dal runner.
- [ ] Niente strada entro `MAX_WAY_M`, o tratto non sulla mappa:
      `NoWayBackError` → 422.
- [ ] `engine_fingerprint` di `route_store` è uguale a quello di `main`;
      il test che nessun modulo importi `way_back` c'è.
- [ ] `POST /way-back` risponde con le fixture; 429 oltre i limiti, per
      telefono e per IP; 422 sull'acqua.
- [ ] Sul telefono `way_back_json` dà la stessa risposta dell'API
      (test in CPython; `engine.zip` ricostruito, il test di
      `tools/phone_engine` è verde).
- [ ] `wayBackOnPhone`: zona salvata → telefono; senza zona → server;
      server 404 / offline / 429 / 422 → `none`, senza eccezioni.
- [ ] Suite del motore, dell'API, dell'app e di `shared-types` verdi;
      lint, typecheck, prettier, ruff, black; impronta iOS `83793e26`
      su una copia pulita.

## File toccati — parte A

```
docs/tasks/TASK-314.md                                 (nuovo)
docs/DECISIONS.md                                      (ADR-0274, in fondo)
docs/STATUS.md                                         (righe nuove)
docs/API.md                                            (POST /way-back)
services/route-engine/route_engine/way_back.py         (nuovo)
services/route-engine/tests/test_way_back.py           (nuovo)
services/api/shaperoute_api/way_back.py                (nuovo)
services/api/shaperoute_api/way_back_api.py            (nuovo)
services/api/shaperoute_api/app.py                     (una riga: install_way_back)
services/api/shaperoute_api/on_phone.py                (way_back_json)
services/api/shaperoute_api/route_store.py             (l'impronta lascia fuori way_back.py)
services/api/tests/test_way_back_api.py                (nuovo: API e telefono)
services/api/tests/test_way_back_fingerprint.py        (nuovo)
packages/shared-types/src/index.ts                     (WayBackRequest, WayBack, in fondo)
packages/shared-types/fixtures/way-back-request.json   (nuovo)
packages/shared-types/fixtures/way-back.json           (nuovo)
packages/shared-types/test/wayBack.test.ts             (nuovo)
apps/mobile/assets/engine/engine.zip                   (ricostruito)
apps/mobile/src/engine/page.ts                         (wayBack)
apps/mobile/src/engine/phoneEngine.ts                  (wayBack)
apps/mobile/src/engine/phoneEngineWayBack.test.ts      (nuovo)
apps/mobile/src/engine/wayBackOnPhone.ts               (nuovo)
apps/mobile/src/engine/wayBackOnPhone.test.ts          (nuovo)
apps/mobile/src/api/wayBack.ts                         (nuovo)
apps/mobile/src/api/wayBack.test.ts                    (nuovo)
```
