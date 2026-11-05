# TASK-382 — «Edit the drawing» sull'acqua: il 422 del contorno arrotondato

**Stato**: Done · 2026-11-05 — #767 (830a147e), #769 (f4e7a2ad)
**Fase**: 4 · **Branch**: `fix/TASK-382-paddle-edit-422`, poi
`fix/TASK-382-b-outline-message` (parte B)
**Numeri**: TASK-382, assegnato dal Coordinatore. Seguito di TASK-369 parte B
(ADR-0313). Nessun ADR nuovo: una precisazione di ADR-0245.

## Il difetto

Prova dell'utente sul telefono, 2026-11-04, anteprima 9e2089a9, sport
«Paddle»: su un esempio di «Explore» sui laghi (risposta dell'utente in
questa sessione), «Edit the drawing» e poi «Draw route» mostrano «Something
went wrong on our side. Try again in a moment.». Nel log dell'API c'è, dal
telefono, `POST /image-route-jobs` 422, subito dopo «dog_head 1500 m already
drawn» (gli esempi di un lago da 1,5 km).

## La causa

Il 422 è `invalid_request` con il messaggio «outline: the outline crosses
itself: the sides starting at points i and j meet». L'app controlla il
contorno del disegno (`edit.drawingOf`, `geometry.isSimpleRing`) **prima**
che `canvasRequest.framed` lo centri e lo arrotondi al decimillesimo; il
motore (`shapes/outline.py`, `_ring` → `_first_crossing`) controlla i numeri
arrivati, quelli arrotondati. Un percorso sull'acqua parte sempre dalla riva
e ci torna lungo lo stesso tratto (`water_fit`, «the straight leg from the
shore to the shape, each way»): modificato, quel tratto lascia nel contorno
una punta o un nastro largo quanto l'errore di calcolo, e l'arrotondamento
fa toccare i due lati. `problems.ts` dice per un `invalid_request` che non
conosce il messaggio generico, con un «Try again» che fallirebbe sempre.

Non dipende dal server: il codice di `bacd7c7b` (TASK-369 B) e quello di
`fe4e9499` danno lo stesso 422 (il controllo del contorno viene prima del
rifiuto «not an image» del server vecchio). Nemmeno dalla Pagaia in sé:
succede a qualunque contorno con lati quasi a contatto, ma sull'acqua il
tratto dalla riva lo rende frequente.

### Come è stato trovato

- Le strade di «Edit the drawing» → «Draw route» con le fixture semplici
  (anello, cuore e quadrato sull'acqua del motore, tracce aperte, GPS fitto,
  piccole, grandi, km e miglia, i disegni sull'acqua del Feed, gli esempi
  di Riccione nell'app intera) passano tutte: 202.
- 136 percorsi pagaiati del motore (costa e lago di prova, ogni forma, 1–3
  km) con un tratto dalla riva attaccato a metà di un lato (50–1000 m): il
  ~1,5% dei corpi che l'app manda è rifiutato dall'API di `main` con il 422
  sopra. Con la correzione: 4506 corpi, nessuno rifiutato.
- Il caso fissato nei test: un cavallo da 1,5 km sul lago di prova con 300 m
  dalla riva. Il corpo di prima dà «… the sides starting at points 1 and 38
  meet»; quello di adesso è pagaiato sul lago in circa un secondo.

## La correzione (solo app, JS)

`mapdraw/sentOutline.ts` (nuovo) controlla il contorno **come parte**, con la
regola del motore copiata operazione per operazione (`_ring`, `_orient`,
`_meet`, `_folds_back`, `_first_crossing`), così app e motore danno lo
stesso verdetto sugli stessi numeri. Se due lati si incontrano, toglie gli
angoli fra loro dal lato con meno angoli (la punta, il nastro, o un anellino
che l'arrotondamento ha stretto) finché nessuno si incontra; non crea punti
nuovi, quindi niente va riarrotondato. Il contorno riparte dall'angolo più
vicino al suo primo punto, dove parte il percorso. Se resterebbe troppo poco
o un dettaglio non partirebbe più sul contorno (`ATTACH_TOLERANCE` del
motore), il contorno va com'era e l'API dice perché, come prima.

`canvasRequest.framed` lo usa per ogni figura della mappa: disegni, foto,
tracce modificate, sull'acqua e sulle strade. Un contorno che il motore
prende già (quasi tutti) parte identico a prima.

Nessun testo nuovo, nessuna modifica a server, motore, contratto, dipendenze
o nativo: impronta del motore invariata (`test_drawn_water_fingerprint`
verde), impronta iOS 6f8bba4c (solo JS, non misurata in una copia pulita).
Funziona col server di oggi.

## Parte B: il messaggio (#769)

Su richiesta del Coordinatore: un 422 «outline: …» (un contorno che
`parse_outline` rifiuta, che si incrocia per esempio) non mostra più
«Something went wrong on our side» con un «Try again» che fallirebbe
sempre. `route/problems.ts` lo riconosce dal prefisso del messaggio: a
terra dice «This outline does not fit the roads here. Try another
distance, another start, or a simpler picture.», sull'acqua il testo
dell'acqua (`waterProblemText`, con «pick a shape»). Testi che c'erano già,
nessuno nuovo; gli altri `invalid_request` restano come prima. Il test è
in `problems.test.ts`.

## Criteri di accettazione

- [x] Test deterministico lato app (`sentOutline.test.ts`): la traccia
      pagaiata con il tratto dalla riva, passata da `routeTrack`,
      `drawingOf`, i limiti della Pagaia e `canvasRequest` come fa «Edit
      the drawing» → «Draw route», dà il corpo della fixture; senza la
      correzione il test fallisce. Più i casi della regola (incrocio,
      contatto, ritorno indietro) e della riparazione (punta, inizio,
      dettaglio, troppo poco). A terra (richiesta del Coordinatore): un
      disegno da corsa con una fessura larga 4 cm, che l'arrotondamento
      chiude, parte senza la fessura; senza la correzione il test fallisce.
- [x] Gli esempi d'acqua forniti con l'app (`paddleExamples.json`: Riva del
      Garda, Como, il litorale veneto, Riccione; 20 con «Edit the drawing»,
      alternative comprese) passano tutti all'API, prima e dopo: non sono
      loro il disegno della segnalazione. Il log del Coordinatore (server
      `bacd7c7b`, un solo `POST /image-route-jobs` del telefono, il 422 delle
      20:32:00Z, nessun `GET /drawings/{id}`) indica un percorso pagaiato
      disegnato dal server o un preferito: la classe che la correzione copre.
- [x] Test deterministico lato API (`test_paddle_edit_outline.py`): il corpo
      di prima dà il 422 esatto, quello di adesso è pagaiato sul lago.
- [x] Test delle suite che usano `canvasRequest` (`src/mapdraw`,
      `AppEditDrawing`, `onPhoneFreehand`), tsc, eslint, Prettier, ruff e
      black verdi in locale; la suite intera è della CI.
- [x] CI verde (#767 e #769).
- [ ] Prova sul telefono, dall'utente, con l'anteprima: lo stesso esempio
      del lago, «Edit the drawing», «Draw route».

## File toccati

```
apps/mobile/src/mapdraw/canvasRequest.ts
apps/mobile/src/mapdraw/sentOutline.ts                          (nuovo)
apps/mobile/src/mapdraw/sentOutline.test.ts                     (nuovo)
packages/shared-types/fixtures/track-paddled-with-leg.json      (nuovo)
packages/shared-types/fixtures/image-route-request-paddle-edit.json          (nuovo)
packages/shared-types/fixtures/image-route-request-paddle-edit-touching.json (nuovo)
services/api/tests/test_paddle_edit_outline.py                  (nuovo)
docs/tasks/TASK-382.md                                          (nuovo)
docs/STATUS.md                                                  (righe aggiunte)
docs/DECISIONS.md                                               (righe aggiunte)
```

Parte B (#769):

```
apps/mobile/src/route/problems.ts
apps/mobile/src/route/problems.test.ts
```

Chiusura (PR dei documenti): `docs/tasks/TASK-382.md`, `docs/STATUS.md` e
`docs/DECISIONS.md` (righe aggiunte).

## Fuori scope

- **Il corpo esatto mandato dal telefono** non è nel log: la causa è
  riprodotta con percorsi del motore e coincide con ogni indizio (422 alla
  `POST`, `invalid_request` senza «not an image», lago da 1,5 km), ma non
  è confrontata con quel corpo. La prova sul telefono la conferma.
- **Il messaggio per un `invalid_request` sconosciuto** resta quello
  generico con «Try again»: cambiarlo vorrebbe un testo nuovo, col sì
  dell'utente. Quello di un contorno rifiutato è cambiato nella parte B,
  con testi che c'erano già.
- **L'OTA** (anteprima e produzione), col sì dell'utente.

## Esito

In `main` dal 2026-11-05: #767 (830a147e) manda il contorno come il motore lo
prende; se il motore lo rifiuta lo stesso, #769 (f4e7a2ad) dice perché. Solo
JS, testi esistenti, impronta del motore invariata. Restano all'utente,
col Coordinatore: la prova sul telefono con l'anteprima (l'esempio del lago,
«Edit the drawing», «Draw route») e l'OTA di produzione.
