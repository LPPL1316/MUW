# TASK-373 — Sci alpino: proposta e misure

**Stato**: Proposto · solo documenti e misure (questa PR). Nessun codice
finché l'utente non sceglie un'opzione
**Fase**: 5 · **Branch**: `docs/TASK-373-ski-proposal` (documenti); le
parti, se si fanno, `feat/TASK-373-a-…` e così via
**Dipende da**: nulla per lo studio. L'opzione A si appoggia alla
categoria «Record only», se l'utente la vuole (vedi «Le opzioni»)
**ADR**: ADR-0317 (proposto)

## Obiettivo

Dire con numeri se MuW può avere lo sport «Ski» (sci alpino) e in che
forma. Le piste da discesa (`piste:type=downhill` di OSM) si fanno solo in
discesa e si risale con gli impianti (`aerialway=*`): una forma disegnata
dal Route Engine di oggi non torna così com'è. Lo studio misura cosa
offrono piste e impianti su tre comprensori, prova il motore di oggi su
quella rete e propone tre opzioni con costo, limiti e cosa vede l'utente.

Gli script, i dati e la pagina con le figure sono in `out/TASK-373/` del
Mac (`out/` è ignorato da git): `fetch.py` e `fetch2.py` (Overpass),
`analyse.py` (la rete), `engine_trial.py` (il motore), `gallery.py` →
`ski-study.html` (tabelle e 19 figure).

## Contesto

L'utente il 2026-11-04: «Studia l'aggiunta dello sport Ski (sci alpino) a
MuW […] Questo task parte con una PROPOSTA, non con il codice», con tre
opzioni d'esempio: solo registrazione libera + video; forme fatte di più
discese collegate dagli impianti; «Soon» come il parapendio.

Come sono fatti gli sport oggi:

- **App**: `apps/mobile/src/settings/sport.ts` elenca gli sport
  (`ALL_SPORTS`, con `ready`); uno sport con `ready: false` è «Soon», non
  si sceglie, e **una build dello store non lo mostra affatto** (ADR-0278,
  `shownSports`): «Soon» lo vedono solo Expo Go e `preview`. `activityOf`
  dà all'API l'attività di «Draw»; la registrazione senza percorso c'è già
  per ogni sport (`FreeRunScreen.tsx`, `navigation/freeSport.ts`,
  `useFreeRun.ts`, TASK-220).
- **Contratto**: `ACTIVITIES` in `packages/shared-types` (`running`,
  `cycling`, `paddling`) e `DISTANCE_LIMITS_M`; nell'API `RunActivity` ha
  anche `swimming`, e i `CHECK` di `favorites`, `runs` e `group_runs`
  elencano le attività: un'attività nuova è una migrazione come
  `0040_swimming.sql` e un aggiornamento del server, col sì dell'utente.
- **Motore**: `network.py` ha due reti, `foot` e `bike`. La rete `bike` è
  già **orientata** (i sensi unici valgono) e tiene il pezzo più grande in
  cui ogni nodo si raggiunge da ogni altro (`largest_piece`). Piste in
  discesa e impianti in salita hanno la stessa struttura, un grafo a sensi
  unici: lo studio la usa così com'è, con un grafo costruito a mano e
  `plan_shape(..., activity="cycling")`.
- **Salute**: `src/health/appleWorkout.ts` e `healthConnectWorkout.ts`
  mappano l'attività sul tipo di allenamento in JavaScript: «Downhill
  Skiing» non chiede codice nativo.
- **Il fondo**: TASK-372 (ADR-0316) ha misurato lo sci di fondo su Fiemme,
  Asiago e Dobbiaco: 45 richieste, nessuna arriva al minimo. Le due
  proposte vanno lette insieme.

## Le misure

### Come

1. **Dati** (Overpass, 2026-11-04): le vie `piste:type=downhill`, le vie
   delle relazioni `piste:type=downhill` (spesso strade o sentieri senza
   tag di pista), le `piste:type=connection` (collegamenti, nei due sensi)
   e gli impianti per persone (`cable_car`, `gondola`, `chair_lift`,
   `mixed_lift`, skilift e tappeti; fuori `goods` e `zip_line`). Le piste
   disegnate come aree non sono percorribili e restano fuori.
2. **Il verso**: ogni pista va dal primo all'ultimo punto; si controlla sul
   terreno (tile Terrarium z13, circa 13 m al pixel, la fonte aperta di
   TASK-347) e una pista disegnata in salita si gira.
3. **Le stazioni**: in OSM la linea dell'impianto finisce alla stazione e
   la pista spesso qualche decina di metri più in là. Si collegano a piedi
   fino a **100 m**: a 30 m la Paganella resta in due pezzi (Andalo e la
   Cima), a 100 m è intera.
4. **Il pezzo utile**: il più grande in cui da ogni punto si torna a ogni
   altro, scendendo e risalendo.
5. **Il motore di oggi**: `plan_shape` con cerchio e cuore da 5, 10 e
   20 km, e un cerchio da 40 km al Sella, come per la bici: partenza alla
   stazione a valle di un impianto (Andalo, Madonna di Campiglio, Selva),
   ricerca vicina e a 2 km. Il minimo per proporre una forma è 0,60.

### La rete

| | Paganella | Campiglio–Pinzolo–Folgarida | Sella Ronda (4 valli) |
|---|---|---|---|
| Piste (linee) | 34,8 km | 131,8 km¹ | 345,5 km |
| Piste solo come area | 0 | 8 | 84 |
| Impianti | 16 | 50 | 147 |
| Dislivello degli impianti | 1081 m | 1682 m | 1605 m |
| Piste disegnate in salita² | 1 su 45 | 31 su 184 | 28 su 458 |
| Pezzo utile: piste | 35 km (tutte) | 97,5 km (74%) | 265,5 km (77%) |
| Pezzo utile: impianti | 16 | 44 | 127 |
| Pezzo utile: estensione | 4,3 × 4,5 km | 10,4 × 8,2 km | 17,4 × 20,8 km |
| Un giro «sali e scendi», mediana | 2,1 km | 2,1 km | 1,8 km |

¹ Con le vie delle relazioni, spesso strade forestali che si sovrappongono
alle piste: senza, 100 km.
² Fra quelle con più di 10 m di dislivello fra i due capi: sono quasi
tutte vie di relazioni (strade senza verso di pista). Il terreno le gira.

**Cosa dice**: la rete c'è ed è coerente. I comprensori grandi sono un
pezzo solo, piste e impianti hanno quasi sempre il verso giusto, e un
grafo a sensi unici come quello della bici la rappresenta senza codice
nuovo. Le lacune sono le solite di OSM: stazioni staccate dalle piste
(serve camminare fino a 100 m), relazioni senza verso, piste solo come
area. **Nulla dice se una pista è aperta, battuta o adatta a chi scia**.

### Il motore di oggi

19 richieste, **nessuna proposta**: il motore le rifiuta tutte.

| Comprensorio | Forma | Chiesti | Somiglianza | Percorso | Sugli impianti |
|---|---|---|---|---|---|
| Paganella | cerchio | 5 / 10 / 20 km | 0,23 / 0,29 / 0,56 | 8 / 33 / 40 km | 39–40% |
| Paganella | cuore | 5 / 10 / 20 km | 0,26 / 0,35 / 0,22 | 54 / 55 / 34 km | 38–41% |
| Campiglio | cerchio | 5 / 10 / 20 km | 0,22 / 0,46 / 0,46 | 11 / 13 / 65 km | 27–43% |
| Campiglio | cuore | 5 / 10 / 20 km | 0,34 / 0,37 / 0,41 | 18 / 30 / 37 km | 36–38% |
| Sella Ronda | cerchio | 5 / 10 / 20 / 40 km | 0,33 / 0,39 / 0,46 / 0,48 | 8 / 16 / 37 / 41 km | 37–40% |
| Sella Ronda | cuore | 5 / 10 / 20 km | 0,34 / 0,58 / 0,40 | 17 / 43 / 45 km | 39–42% |

La somiglianza è quella con cui il motore rifiuta (minimo 0,60). Il
percorso è quello del tentativo migliore: spesso **due-cinque volte** la
distanza chiesta (un cuore da 5 km alla Paganella diventa 54 km con 17
risalite). Nelle figure di `ski-study.html` si vede perché.

### Perché non torna

- **Ogni lato della forma deve essere una discesa.** Le piste scendono
  lungo i versanti verso il fondovalle: da un punto si va solo verso il
  basso, e per tornare su c'è un impianto. Un contorno chiuso, che gira in
  tutte le direzioni, sulla neve non esiste quasi mai.
- **Le risalite sono linee dritte che tagliano la figura.** Sono il 27–43%
  della lunghezza di ogni percorso trovato, e la traccia GPS di una
  seggiovia è proprio quella linea dritta.
- **La rete è rada e fissa.** Una città ha una via ogni 100 m in ogni
  direzione; un comprensorio ha qualche decina di discese, sempre le
  stesse, e la forma non trova dove appoggiarsi.

Il motore così com'è, quindi, non serve. Servirebbe un pianificatore
apposta (opzione B), e anche quello avrebbe solo le discese per disegnare.

### La sicurezza

Richiesta dal Coordinatore: pendenze, piste chiuse, fuoripista.

**Pendenze** (`out/TASK-373/slopes.py` nel worktree del task: i 100 m più
ripidi di ogni pista sul terreno, Terrarium z13; i tre comprensori
insieme):

| Difficoltà OSM | Piste | Tratto più ripido, mediana | 90° percentile | Oltre il 40% |
|---|---|---|---|---|
| `novice` | 8 | 13% | 24% | 0% |
| `easy` (blu) | 272 | 19% | 30% | 1% |
| `intermediate` (rossa) | 252 | 31% | 45% | 18% |
| `advanced` (nera) | 51 | 43% | 58% | 65% |
| `freeride` | 6 | 36% | 83% | 50% |

La difficoltà scritta in OSM torna col terreno: se mai si propone una
pista (opzione B), si filtra per livello sulla difficoltà, mai sulla
pendenza misurata da noi, che su 13 m al pixel è approssimata. Le
`freeride` restano sempre fuori.

**Piste chiuse**: OSM non le conosce. Su 67 + 184 + 615 piste nessuna ha
`opening_hours`; due impianti su 147 al Sella, nessuno negli altri due.
Aperture, chiusure per vento o neve, gare e battitura stanno nei siti dei
comprensori, non in un dato aperto e uniforme. Quindi: **l'opzione A non
propone mai piste** (registra quello che lo sciatore fa); l'opzione B
direbbe sempre «verifica che piste e impianti siano aperti», e una pista
chiusa trovata sul posto romperebbe la figura.

**Fuoripista**: MuW non propone mai un tratto fuori dalle piste
`piste:type=downhill` (fuori `freeride`, `skitour` e le aree). I soli
tratti a piedi sono i collegamenti di OSM e i 100 m alle stazioni. La
registrazione non giudica dove si scia, ma nulla nel riepilogo o nel Feed
premia un fuoripista (nessuna forma, nessun record di velocità in
classifica). In Italia il D.Lgs. 40/2021 (a memoria, da far verificare)
chiede assicurazione RC sulle piste, casco ai minori di 18 anni e ARTVA,
pala e sonda fuoripista con rischio valanghe: l'avviso lo ricorda senza
fare da consulente.

**In pista il telefono non si guarda**: nessuna guida a voce in discesa,
nessuna notifica che chiede di guardare lo schermo; i numeri si leggono
sull'impianto o alla fine. Un avviso la prima volta, come per la canoa
(testo da approvare, comune con lo sci di fondo).

### Gli impianti in un percorso

Si possono includere, tecnicamente: nel grafo sono archi a senso unico in
salita, come nelle misure sopra, e OSM dà spesso la durata della corsa
(`aerialway:duration` su 46 impianti su 50 a Campiglio, 101 su 147 al
Sella). Ma:

- **la distanza non è la misura giusta**: una richiesta «10 km» con il
  40% in seggiovia non dice niente. Con gli impianti la misura è il numero
  di discese o le ore;
- **nella figura non devono contare**: sono linee dritte. Vanno tenuti
  come la penna alzata delle parole (TASK-197), tratteggiati sulla mappa e
  nel GPX con «Pause» e «Resume» (`GPX.md`);
- **OSM non dice se sono aperti né che skipass servono**: un percorso che
  passa da un comprensorio all'altro può chiedere un altro biglietto.

Nell'opzione A gli impianti non sono un percorso: sono riconosciuti nella
traccia registrata (salita a velocità costante) e tratteggiati.

### Impronta e disco

- **Questa PR**: solo documenti, nessun effetto.
- **Opzione A**: nessun modulo nativo nuovo (registrazione in background,
  Salute e video ci sono già; il tipo «Downhill Skiing» è una riga in
  JavaScript), quindi l'impronta della 1.0.1 non dovrebbe cambiare: si
  misura su una copia pulita prima della PR di A2, come per le altre. Il
  motore non cambia. Sul server: una migrazione dei `CHECK`, nessun file
  nuovo; ogni giornata salvata è più lunga di una corsa (6 ore invece di
  una), quindi più punti nella stessa tabella, nell'ordine delle centinaia
  di kB per giornata se la traccia si salva come oggi.
- **Opzione B**: il motore cambia (rete `ski`, pianificatore), ma resta sul
  server, come la canoa: il motore sul telefono (TASK-214) disegna solo a
  piedi e in bici, e il suo codice viaggia con l'app come risorsa, non come
  modulo nativo (TASK-347 A non ha cambiato l'impronta), quindi l'impronta
  resta; da rimisurare comunque prima della PR. Disco: i grafi di prova, con un nodo ogni
  10 m, pesano 0,5 MB (Paganella), 1,4 MB (Campiglio) e 3,7 MB (Sella
  Ronda); semplificati come quelli delle strade, meno della metà. Il
  terreno serve solo a costruirli (58 tile, 6,9 MB per i tre) e non resta
  sul server. Cento comprensori alpini starebbero sotto i 100 MB.

### Con lo sci di fondo (TASK-372)

Allineato con la sessione di TASK-372 (ADR-0316) il 2026-11-04, perché non
nascano due modi di trattare le piste:

- **Rete**: una sola rete «piste» in `network.py`, con il filtro per tipo
  (`downhill` orientata col terreno e con gli impianti in salita; `nordic`
  nei due sensi salvo `oneway`), le stazioni collegate a piedi fino a
  100 m e le `piste:type=connection` nei due sensi. Solo se una delle due
  fa le forme: per registrare non serve nessuna rete.
- **Attività**: due valori distinti, `skiing` (alpino) e `xc_skiing`
  (fondo), con **una sola migrazione** dei `CHECK` per tutte e due, col
  primo numero libero in `main` quando entra (`AGENTI.md`, punto 10).
- **Da decidere dall'utente, non fra le sessioni**: se tutti e due sono
  sport «che si registrano senza forma» con lo stesso percorso in app; un
  solo avviso di sicurezza sulla neve per tutti e due; uno sport con due
  modi o due sport; la stagione come scadenza (dicembre–aprile).
  TASK-372 propone di fermare il fondo e tenere il benchmark; le sue
  alternative sono gli anelli già segnati del centro o la registrazione
  senza forma, come qui.

## Le opzioni

### A — Solo registrazione della giornata, con il video (raccomandata)

**Cosa vede l'utente**: «Ski» ⛷️ fra gli sport. Con «Ski» scelto, «Draw»
non propone forme: apre la registrazione libera, come «Run without a
route». Durante la giornata l'app registra in background; a fine giornata
il riepilogo dà **discese, km sciati, dislivello in discesa, velocità
massima** e la mappa con le discese piene e le risalite tratteggiate. Il
post nel Feed e il video della corsa in 3D (TASK-351: le montagne sono il
caso migliore) funzionano come per le altre attività; l'allenamento va in
Salute/Health Connect come «Downhill Skiing». Il «disegno» è la giornata
stessa: la traccia sulla mappa. **Nessuna forma, nessun punteggio di
forma**: gioco delle forme e concorsi non la contano.

**Costo**: 4–6 sessioni.
- A1 API: l'attività `skiing` (shared-types, `RunActivity`, una
  migrazione dei `CHECK` come la 0040, condivisa con `xc_skiing` di
  TASK-372 se anche il fondo si fa, l'etichetta del Feed). Server col sì
  dell'utente.
- A2 app: lo sport, «Draw» che apre la registrazione, il riconoscimento
  delle risalite (salita a velocità costante: non sono discese e non
  entrano nella media), le metriche e i testi in tutte le lingue (col sì
  dell'utente). Regola deterministica, testata su tracce di prova.
- A3 la giornata intera: background GPS (TASK-261) per 6 ore al freddo,
  batteria, e i limiti trovati scritti.
- Si appoggia alla categoria «Record only» (sport che si registrano senza
  forma) se l'utente la vuole come task a parte: «Ski» ne sarebbe il primo
  sport. Senza, A2 mette in `sport.ts` solo quello che serve allo sci.

**Limiti**: nessuna forma, quindi MuW qui è un registratore come gli altri
(Slopes, Ski Tracks); il riconoscimento delle risalite sbaglia sui tratti
lenti in piano (spinta, skilift lenti) e va tarato su giornate vere; il
freddo scarica il telefono; nessuna mappa delle piste aperte. Probabilmente
basta un aggiornamento OTA (nessun modulo nativo nuovo): da verificare con
l'impronta prima di A2.

**Quando**: la stagione va da dicembre ad aprile. Fatta a novembre, arriva
per l'apertura degli impianti.

### B — Forme fatte di discese, con le risalite «a penna alzata»

**Cosa vede l'utente**: sceglie un comprensorio e una figura; l'app
propone una sequenza: «Seggiovia X, poi la pista Y (rossa), poi la
cabinovia Z…», senza guida svolta per svolta. Sulla mappa le discese
disegnano la figura e le risalite sono tratteggiate e non contano, come i
tratti a piedi delle parole con la penna alzata (TASK-197). A fine
giornata il punteggio confronta le discese con la figura.

**Costo**: 12–18 sessioni, A compresa (la registrazione serve lo stesso).
- Un pianificatore nuovo nel motore: la figura spezzata in tratti, ogni
  tratto una discesa, gli impianti come penna alzata; la rete `ski` con il
  verso dal terreno e le stazioni collegate (5–7 sessioni).
- Le zone dei comprensori sul server, l'API, «Draw» per lo sci, la
  schermata con la sequenza (5–7 sessioni).
- Un filtro di difficoltà (chi scia sulle blu non riceve una nera) e i
  testi di sicurezza.

**Limiti**: la misura sopra dice che con le risalite nel disegno non c'è
nessuna forma (0,22–0,58). Senza le risalite le linee dritte spariscono, ma
restano solo le discese, che seguono il pendio: si possono sperare figure
fatte di tratti (lettere come V, N, M, zig-zag, una stella grande) nei
comprensori grandi, non un cuore in un comprensorio piccolo. OSM non sa se
una pista è aperta o battuta; seguire un percorso sulla pista invita a
guardare il telefono dove non si deve. **Prima del resto serve un
prototipo di soli motore** (3–4 sessioni, nessuna app): se su tre
comprensori almeno metà delle richieste non arriva a 0,60, ci si ferma.

### C — «Soon», come il parapendio

**Cosa vede l'utente**: niente. Una riga «Ski · Soon» in Settings e nel
menu degli sport, che **le build dello store non mostrano** (ADR-0278):
la vedono solo Expo Go e `preview`.

**Costo**: meno di una sessione (una riga in `ALL_SPORTS`, il nome nelle
lingue, i test).

**Limiti**: non dà niente a chi scia questo inverno; promette senza dire
cosa. Ha senso solo come segnaposto mentre si decide fra A e B.

## La raccomandazione

**A adesso**, per la stagione: lo sci entra come sport che si registra, con
la giornata sulla mappa e il video in 3D, che in montagna è il pezzo più
bello. **B dopo, solo come prototipo del motore**, con il criterio
d'arresto scritto sopra, e provato sulle giornate vere registrate con A.
**C no** da sola: nelle build dello store non si vede.

Con TASK-372 (sci di fondo) la parte tecnica è già allineata (sopra);
restano all'utente uno sport o due, e un avviso comune o due.

## Le scelte dell'utente

Una domanda alla volta, dopo la PR:

1. **Quale opzione**: A, B o C (proposta: A, poi forse il prototipo di B).
2. Solo con A o B: la categoria «Record only» a parte, o lo sci da solo.
3. Il nome e l'emoji («Ski» ⛷️; Sci, Ski, Ski, Esquí) e il rapporto con lo
   sci di fondo (TASK-372).
4. Le metriche mostrate e le risalite sulla mappa (proposta: discese,
   km sciati, dislivello, velocità massima; risalite tratteggiate).

Nessuna parte parte senza la risposta alla domanda 1.

## File toccati

Questa PR (solo documenti): `docs/tasks/TASK-373.md` (nuovo),
`docs/DECISIONS.md` (ADR-0317), `docs/STATUS.md` (una voce in «In
lavorazione»), `docs/INDEX.md` (una riga). Le parti di codice avranno la
loro lista dopo la scelta dell'utente.

## Criteri di accettazione (studio)

- [x] Come sono fatti gli sport letto in `sport.ts`, `ACTIVITIES` e
      `network.py`.
- [x] Misure su tre comprensori: rete, verso, pezzo utile, motore di oggi.
- [x] Sicurezza (pendenze, piste chiuse, fuoripista), impianti nel
      percorso, impronta e disco (richiesti dal Coordinatore).
- [x] Allineamento con TASK-372 sullo sci di fondo.
- [x] Tre opzioni con costo, limiti e cosa vede l'utente, e la
      raccomandazione.
- [ ] La scelta dell'utente (domanda 1).
