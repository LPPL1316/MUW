# STATUS — Dove siamo adesso

> **Unica fonte di verità sullo stato del progetto.**
> Primo file da leggere in ogni sessione, ultimo da aggiornare a fine task.
> Se è disallineato dalla realtà, tutto il resto del sistema smette di
> funzionare: aggiornarlo non è burocrazia, è la parte che regge il metodo.

**Ultimo aggiornamento**: 2026-10-02 · **Fase corrente**: 4 — Estensione

---

## In una riga

MuW (già «Sgrava», TASK-260) gira dall'iPhone in Expo Go; l'app pubblicata usa l'API sul server
Hetzner, in HTTPS e sempre accesa, con il database degli account; il Mac
serve per lavorare. L'app ha tre pagine da scorrere, «Feed» (i disegni
pubblicati dagli iscritti, TASK-118; esempi finché non ce ne sono), «Draw» ed «Explore», e «Profile» per iscriversi ed
entrare, con i preferiti e le corse salvate («My activities»). In «Draw» si sceglie una forma del catalogo (cerchio, cuore,
stella, cavallo, luna, gatto, pesce, farfalla, lumaca, testa di cane,
testa di coniglio, zucca, albero di Natale, faccina, fantasmino,
ciambella, sole), una parola dalla A alla Z,
tonda o squadrata, o una foto, e una distanza fino a 21 km: fino a tre
percorsi fra cui scegliere, il GPX, la navigazione a voce, il punteggio a
fine corsa; si corre anche senza percorso.
«Explore» propone percorsi in ogni città: esempi già disegnati, categorie,
percorsi a tema dai luoghi veri, e «Start». Un annuncio di prova prima di
ogni percorso, solo nella build propria. Le ricerche insegnano sinonimi e
correzioni, applicati a mano (`INSIGHTS.md`). Tempi: 3–10 km nelle zone in
cache in 5–25 s, da 15 a 21 km in 30–50 s. 52 città italiane, Rovereto e 10 estere
hanno la zona già sul server; le altre la scaricano da Overpass, che dopo
molti download rifiuta per qualche ora (`MAPS.md`).

## Prossimo passo

*(2026-10-25: TASK-122 è Done, lo Storage Box c'è e riceve le copie; il
paragrafo qui sotto è superato per quella parte.)*

**TASK-122 — le copie fuori dal server**: il server è spostato, manca lo
Storage Box Hetzner, che crea l'utente (`DEPLOY.md` F.13, punto 2); poi
il servizio `offsite` sul server. Dopo, la parte social (`ROADMAP.md`,
«La parte social») riprende da **TASK-116** (il profilo: fatto, PR #224,
aspetta il merge, il server e l'app), **TASK-117**
(pubblicare una corsa: salvarla è già di TASK-172, e il suo task file va
aggiornato da chi lo prende) e **TASK-118** (il feed vero, al posto degli esempi
di TASK-156), poi 119–121. **TASK-092 — Percorsi consigliati** (ADR-0086)
ora ha il database e il server. Gli altri Todo.

In coda, dopo o accanto:

- **Seguiti di TASK-172** («My activities», fatto): l'altitudine delle
  posizioni non si salva; il GPX di una corsa salvata; il cuore dei
  preferiti e «Start» da una corsa aperta; «Send to Strava» a fine corsa è
  TASK-187, da chiedere all'utente. Tutti in `tasks/TASK-172.md`.
- **Le voci di «Settings»**, elencate dall'utente il 2026-10-02 e già
  sulla pagina con «Soon» (TASK-177): la foto del profilo è fatta
  (TASK-178, sotto), email e numero di telefono anche (TASK-183), le unità di misura sono fatte (TASK-182), «Help», «Terms» e «Privacy» sono fatte, i due testi
  legali come bozze (TASK-184); **TASK-185**, i due
  interruttori delle notifiche email e push, è fatto: salvati nell'account, spenti all'inizio, e **non mandano
  ancora niente**. L'invio vero (che cosa notificare, un servizio di
  posta, `expo-notifications`, una build propria) è un task da aprire,
  con scelte dell'utente. Nessuna voce dice più «Soon».
- **Pubblicità che paga**, chiesta dall'utente il 2026-10-02: **TASK-150**
  (account AdMob e pagamenti) e **TASK-152** (Sgrava sull'App Store) in
  parallelo, poi **TASK-153** (gli annunci veri). Partono da scelte e
  account dell'utente.
- **Seguiti scritti nei task fatti**: le forme a 21 km di Bari, Palermo
  e New York, quando Overpass riapre, e il feed d'esempio da rifare sulle
  14 città (TASK-161); cuore, cerchio e stella di Berlino nel catalogo,
  quando Overpass riapre, e `catalog/` da aggiornare sul server
  (TASK-163); Berlino, che resta a Overpass, e le zone da rifare
  quando l'estratto invecchia (TASK-137); il segnale della scelta fra
  A · B · C negli esempi (TASK-151); la linea intera a fine corsa
  (TASK-149); zone scaricate con un margine (TASK-143); un GraphML già
  rotto (TASK-133); la password dimenticata, che vuole la posta (TASK-114);
  un esempio sul server costa 7–19 s contro 1–2,5 del Mac (TASK-168, dai
  log): il piano dalla partenza, più l'attesa delle tre partenze vicine,
  che ogni richiesta fa in tre processi nuovi su 4 vCPU condivise (fino a
  3 s dopo un piano buono, 8 altrimenti); il grafo pesa 0,3–2 s, 8,8 alla
  prima lettura di una zona estera grande; i 4 minuti di Rovereto erano
  tre download da Overpass, uno per forma. Per scendere serve il motore:
  processi tenuti accesi, o esempi senza A · B · C (scelta dell'utente).
- **Da provare sull'iPhone**: la navigazione camminando un percorso vero
  (TASK-049), il punteggio a fine corsa (TASK-112, 113), iscriversi ed
  entrare (TASK-115: l'API sul server ha il database dal 2026-10-02),
  «Explore» (TASK-126, 134) e il suo «Start» (TASK-145), correre senza
  percorso (TASK-149), «A · B · C» negli esempi (TASK-151, 155), lo swipe
  col dito (TASK-154), il feed d'esempio e i ritocchi di TASK-156, 157,
  158, la schermata della corsa con i numeri e la freccia di direzione
  (TASK-164). Tutti pubblicati su `preview` il 2026-10-02 (ultimo update
  `eba74321`, da 73095e7).
- **Battito e musica nella corsa**, chiesti dall'utente il 2026-10-02
  (seguiti di TASK-169, numeri dal coordinatore): il battito da un sensore
  Bluetooth (`react-native-ble-plx`, dipendenza nuova) e da Apple Watch
  (HealthKit e un'app per l'orologio, dopo TASK-152), tutti e due solo in
  una build propria; la musica: l'utente usa Spotify, «Music» lo apre
  (TASK-173, fatto). **Aspetta la risposta dell'utente**: brano, pausa e
  avanti dentro Sgrava (app Spotify Developer sua, Premium, dipendenze
  nuove, 5 persone al massimo finché è in sviluppo); la proposta è di non
  farlo adesso (`tasks/TASK-173.md`, «La seconda parte»).
- **Altri sport**, chiesti dall'utente il 2026-10-02: dopo «Sport» in
  «Settings» (TASK-189, fatto), **TASK-190 — percorsi in bici**
  (ADR-0153 tenuto; 10–30 km, scelta dell'utente) e **TASK-191 — percorsi
  in canoa e paddle** (ADR-0154 tenuto; sull'acqua entro 1 km dalla riva,
  scelta dell'utente; esempi a Lago di Garda, Lago di Como, Jesolo,
  Riccione). La bici: motore (PR #214) e API (PR #219) in `main`, l'app
  (parte C) assegnata il 2026-10-02 sera. La canoa: il motore dell'acqua
  (A1, PR #216) in `main`; **A2** (la canoa in una richiesta del motore)
  in `main` (PR #235), con le scelte dell'utente del 2026-10-03: **1–5 km**, al
  mare la forma **oltre 200 m dalla riva**, sui laghi 50 m (ADR-0161);
  **B** (l'API, `activity: "paddling"`) in `main` (PR #241, ADR-0164);
  **C** (l'app, ADR-0169) fatta il 2026-10-03, in revisione; la prova dal
  vero aspetta l'acqua dei quattro luoghi sul server.
- **La penna alzata nelle parole**, chiesta e confermata dall'utente il
  2026-10-02: fra una lettera e l'altra si cammina senza disegnare, e
  l'app mette in pausa la registrazione da sola, con un avviso a voce.
  **TASK-197** (motore e API, ADR-0157: `pen_up` nella richiesta, `walks`
  nel risultato, aggiunti senza togliere niente), poi **TASK-198** (l'app).
  Tutti e due in `main` (PR #217 e #218), non ancora sul server né sul
  telefono. Seguiti: **TASK-199**, i `walks` in «My activities» e nei
  preferiti (assegnato il 2026-10-02 sera).
- **Server e app, al 2026-10-06**. **Server**: su `main` `873de53` dalle
  ~20:00Z (ok dell'utente «ok server», eseguito dal coordinatore; «MuW»
  nei testi di Strava, nel creatore del GPX e nel messaggio dei tag,
  TASK-260 A), con le migrazioni `0001`–`0019` (`0019_run_posts`: il
  post della corsa sul server, TASK-258; `0018_route_rotation`: la
  rotazione nelle corse salvate e nei preferiti), il punto del luogo in `/cities` (TASK-249: Tenna
  [46.015703, 11.264283]), `run_scored` al salvataggio (TASK-247), le
  partenze vicine senza `Pool` (TASK-248 B), `activity` in
  `/me/activities` (TASK-251 B), `rotation_deg` nel catalogo e negli
  esempi della canoa (TASK-232 C); fermo circa 10 secondi; immagine di
  prima `shaperoute-api:before-task260`, copia del database
  `shaperoute-2026-10-06T1957Z.dump`; `draw_examples` del mattino finito («70 of 72»:
  a Tenna il cuore e a Calceranica il cerchio non si disegnano). Zone del
  telefono: 528 file. Acqua della canoa: 248 file (Ledro dal 2026-10-06,
  TASK-250; l'elenco dei laghi vive nell'app, `lake_catalog.py` è un
  comando offline: il server non ha bisogno di altro). **App** su `preview` da `main`
  `873de53` (gruppo `9585ffac`, 2026-10-06 ~19:57Z): tutto `main`, fino
  al nome e alla scritta «MuW» (TASK-260; icona e splash con una build
  nativa), alla fine corsa stile Strava (TASK-208 B), a «Draw» ed
  «Explore» in italiano (TASK-210 C, D), a «Location is off»
  in corsa (TASK-259 B), alla corsa in italiano (TASK-210 B), al post che
  resta sul server
  (TASK-258), a «Open Settings» e «Retry» (TASK-259 A), agli errori che
  parlano a chi corre (TASK-256), alla corsa rifiutata
  con il motivo (TASK-257), allo schermo acceso in corsa (TASK-255), alle
  dodici correzioni piccole (TASK-254) e a Ledro in «Paddle» (TASK-250).
  **Da provare sull'iPhone.** Strava spento per scelta dell'utente.
- **Più veloce, ma con percorsi diversi** (TASK-203, da decidere
  dall'utente con campioni da più città): saltare la ricerca lontana
  quando la vicina ha già un percorso, o dimezzarla (`FAR_TRACES` 20→10),
  2–3,7 s in meno nei casi lunghi; `NEARBY_GOOD_GRACE_S` 3→1, 1,5 s in
  meno con meno alternative (`tasks/TASK-203.md`). **Fatto il
  2026-10-08 (parte B, ADR-0230)**: la ricerca lontana parte solo dove
  vicino non si disegna niente; `FAR_TRACES` e `NEARBY_GOOD_GRACE_S` non
  cambiano. **Resta**: aggiornamento del server e `draw_examples` (circa
  40 minuti) con l'ok dell'utente.

Dal 2026-09-24 più sessioni lavorano insieme, con le regole di
`CLAUDE.md` («Autonomia», «Merge», «Lavoro in parallelo»).

## In lavorazione

- **TASK-353 — La chat: orari, giorni, quanti messaggi nuovi, i vecchi
  scorrendo** (ADR-0305; piano confermato dall'utente il 2026-10-30, «Sì,
  passi 1 e 2»; numeri dal Coordinatore). Branch `feat/TASK-353-chat-look`.
  `unread_count` nella lista dell'API, senza migrazione; l'app funziona
  anche con il server di oggi, con il pallino. Testi da approvare. Dopo il
  merge, TASK-354 (invio ottimistico, coda offline). File
  `tasks/TASK-353.md`.
- **TASK-351 — Il video della corsa con la mappa sotto: il look premium,
  il 3D e tre stili** (ADR-0303, proposta; richiesta dell'utente del
  2026-10-30; numeri e condizioni dal Coordinatore). Branch
  `docs/TASK-351-video-map-styles` (worktree `TASK-351-docs`): i
  documenti, il canvas https://claude.ai/artifact/MEGmg4FJp4mBKKFJriFkMV
  e la fattibilità del 3D misurata nel simulatore e nel WebView nascosto
  dell'app (la mappa può stare nella pagina del video: uno scatto a
  `idle`, la linea sopra; la camera che gira costa una resa per
  fotogramma; sul telefono da rimisurare con l'utente). La scelta
  sulla privacy (la mappa nel video mostra dove si è corso) è dell'utente
  («Sì, va bene», 2026-10-30); i nomi degli stili sono
  suoi («Sì, questi», 2026-10-30). La B è la PR #679. Senza mappa il video
  esce sul giallo di oggi (condizione del Coordinatore). Poi B (la mappa
  sotto e il look premium, Night), C (i tre stili e la riga «Style»), D
  (il 3D), una PR ciascuna da `main` con la #658 e col via del
  Coordinatore. Solo app, impronta iOS `83793e26` invariata. File
  `tasks/TASK-351.md`.
- **TASK-355 — Una scheda del Feed che si capisce in un colpo d'occhio**
  (ADR-0306, estende ADR-0293; richiesta dell'utente del 2026-10-30, numeri
  dal Coordinatore). Branch `docs/TASK-355-feed-clarity` (documenti). Parte
  A solo app, dopo 339 B e prima di 348 A; parte B API e app, dopo 344 B e
  prima di 309 B. Scelte dell'utente chiuse il 2026-10-30. Il Feed manda
  già la posizione e «Your position» non lo dice: lo chiude TASK-356, dopo
  la #668, con il testo già approvato; sito e OTA di produzione con il suo
  sì. `tasks/TASK-355.md`.
- **TASK-339 — L'interfaccia premium ed elegante** (ADR-0293, proposta;
  brief dell'utente del 2026-10-29; il canvas della proposta, 16 tavole,
  visto e approvato a voce la sera stessa, «BELLISSIMO»:
  https://claude.ai/artifact/XRMFiZ9BWbWnKkdJ9Udtjf; numeri e condizioni
  dal Coordinatore il 2026-10-30). **Parte A in corso**, branch `feat/TASK-339-premium-look-a`, worktree
  `.claude/worktrees/premium-look-a`: `tokens.ts` (la scala `font` con
  tracking e interlinea, i grigi caldi nei due toni con gli stessi
  contrasti, `radius.xl`, `motion`, `color.hairline`), `src/ui/` (`Tap`,
  `Hairline`, `Scrim` con `assets/ui/scrim.png`, `EmptyState`, il cuore),
  i tre nomi dell'intestazione a 30 regular. Poi B (Feed ed Explore, le
  immagini protagoniste), C (stati vuoti e divisioni, i `pressed` a
  `Tap`), D (Profile, Settings, i fogli), E («Draw» e il risultato, dopo
  TASK-311 B, 331 e 335). Niente di nativo: la vibrazione al tocco solo
  con una build, col sì dell'utente. File `tasks/TASK-339.md`.
  **Parte B in PR dal 2026-10-30**, branch `feat/TASK-339-premium-look-b`
  (via del Coordinatore del 2026-10-30, dopo la #658 e la #666 di
  TASK-350 in `main`): le schede di «Feed» ed «Explore» (`FeedPost`,
  `RouteCard`, `ThemedCard`, `ExploredCard`, `DrawingCard`) col raggio
  20 e senza bordo, le parole di «Feed» sulla foto su `Scrim`, i titoli
  `cardTitle` e i nomi medium, `Tap` al posto dell'opacità, `Hairline`
  prima delle azioni, la distanza delle schede di «Explore» in `display`;
  prima/dopo in `tasks/TASK-339/b-*.jpg`. Poi C.
  **Parte B in `main` dal 2026-10-30** con la #677 (`4faeceb2`, 23:16 CET,
  mergiata al verde: tutte le 557 suite dell'app verdi anche nella copia
  pulita). Poi C.
- **TASK-343 — Le sfide del mese: un tema sul concorso, l'iscrizione,
  la galleria, l'archivio** (ADR-0296, estende ADR-0260; richiesta
  dell'utente del 2026-10-29, proposta approvata con «Yes, as proposed»;
  numeri dal Coordinatore). Branch `docs/TASK-343-monthly-challenges`
  (documenti), poi A (API: migrazione, iscrizioni, galleria, archivio,
  tre push, `open --theme`) e B (app: pagina della sfida, «Past
  challenges», interruttore nel modulo di pubblicazione). Disegni per
  account: nessun limite (scelta dell'utente del 2026-10-30, «No limit»).
  Testi, regolamento, server e push con il sì dell'utente. File
  `tasks/TASK-343.md`. **A in `main`** (#657, `5303a198`, 2026-10-30, migrazione
  0039): **il server non è aggiornato**, serve la 0039 e lo decide l'utente.
  I testi delle tre push: sì dell'autopilota, «accettati su delega
  dell'utente del 2026-10-29, da rivedere»; parlano solo di corsa. **B da
  fare**, i file prima al Coordinatore (TASK-339 B).
- **TASK-341 — I badge sul profilo: primo disegno, 10 disegni, 30 km**
  (ADR-0294; richiesta dell'utente del 2026-10-29, proposta approvata con
  «Yes, as proposed»; numeri dal Coordinatore). Branch
  `docs/TASK-341-profile-badges` (documenti), poi
  `feat/TASK-341-profile-badges`: `badges` in `GET /users/{id}`, decisi dal server sui disegni che chi guarda vede, solo
  corse registrate dall'app; nell'app una fila sotto il nome accanto a
  «Winner». Nessuna migrazione. Testi da approvare. File
  `tasks/TASK-341.md`.
- **TASK-345 — Calorie e battito nei post del Feed** (ADR-0298;
  richiesta dell'utente del 2026-10-29, «Yes, A and B»; numeri dal
  Coordinatore). Branch `docs/TASK-345-heart-calories`: i documenti. Poi
  A (le calorie sulla card dalla distanza, solo app), B (il battito dai
  file importati, «Show heart rate» acceso e nascondibile: scelta
  dell'utente «On, publisher can hide»; testi e privacy col suo sì) e C
  (lettura da Apple Salute / Health Connect, una sola modifica nativa con
  TASK-321 B). `tasks/TASK-345.md`.
- **TASK-347 — Il disegno libero ancorato alle strade: map matching per
  tratto, confronto e punteggio, strumenti da professionista, guide**
  (ADR-0300, proposta; richiesta dell'utente del 2026-10-30 in sei
  capitoli e cinque fasi, con una fermata dopo ognuna; numeri dal
  Coordinatore). Branch `docs/TASK-347-pro-freehand`: solo i documenti.
  Proposta: niente Mapbox/Valhalla/OSRM; il map matching è una modalità
  **ancorata** del nostro motore, per tratto al sollevamento del dito,
  prima sul telefono (TASK-214) poi sul server, con la forza del magnete
  (`fit`), il fantasma del tratto sotto il percorso e il punteggio = la
  somiglianza del motore; il tratto resta nella pagina della mappa (niente
  Skia: nativi alla build successiva). Parti A (motore e API), B
  (telefono), C (app), D (strumenti), E (forme e guide col contorno da
  foto), F (informazioni, bozza, esportazione), G (dislivello e profilo
  dalle tegole del terreno sul server, nella fase 5).
  Le cinque scelte di prodotto fatte dall'utente il 2026-10-30, una per
  volta (motore nostro; tratto nella pagina; punteggio = somiglianza;
  dislivello subito dalle tegole; contratto opzionale con la sonda).
  **Resta**: il merge dei documenti, poi la parte A nella sua sessione.
  Non si sovrappone a TASK-346 (i nodi della traccia vera). File
  `tasks/TASK-347.md`.
- **TASK-344 — Cercare i disegni dalla lente del Feed** (ADR-0297;
  richiesta dell'utente del 2026-10-29, sei scelte approvate con «Sì,
  vai»; numeri dal Coordinatore). Prima questa PR dei documenti
  (`docs/TASK-344-feed-search`), poi la parte A, branch
  `feat/TASK-344-a-drawing-search`: `GET /search/drawings` in
  `drawing_search.py` (parole senza accenti, `named`, filtri, tre ordini,
  nessuna migrazione), tipi in `shared-types`, `docs/API.md` «Drawing
  search»; tempi su 10.000 disegni in `out/TASK-344/bench.txt`. Il server
  si aggiorna solo col sì dell'utente. Poi parte B, l'app (`src/search/`,
  la lente apre la ricerca; testi da approvare). File `tasks/TASK-344.md`.

- **TASK-348 — Il compositore del post: foto e video in primo piano, il
  disegno GPS, un editor** (ADR-0301, proposta; richiesta dell'utente del
  2026-10-30, «Vai con la proposta»; numeri dal Coordinatore). Branch
  `docs/TASK-348-post-composer`: solo i documenti, con le scelte fatte
  dall'utente il 2026-10-30, una per volta (al più 3 video per post, i
  quattro layout, il disegno spostabile, appiattire, l'editor, testi e
  privacy). Poi A (fino a 10
  foto in ordine e i layout, con un OTA), B (editor foto, 1.0.2), C (video,
  1.0.2, dopo TASK-336), D (rifiniture). Impronta iOS `83793e26` invariata
  fino a B. File `tasks/TASK-348.md`. Limite scelto dall'utente il
  2026-10-30: 10 elementi col disegno. Parte A, API: #665 (migrazione 0041,
  server non aggiornato); la parte app aspetta il via del Coordinatore.
  fino a B. File `tasks/TASK-348.md`.
- **TASK-346 — «Edit the drawing» nel Feed: la traccia sulla mappa dov'è
  stata corsa** (ADR-0299; richiesta dell'utente del 2026-10-29, «nel Feed
  quando premo modifica il disegno devo poter modificare la traccia sulla
  mappa, non il disegno in sé»; scelta «Traccia dov'è»; numeri dal
  Coordinatore). Branch `feat/TASK-346-edit-track-in-place`. Sulla scheda di
  un disegno di un membro la traccia va su «Draw on the map» dove è stata
  corsa e grande com'è (`figureLines.trackInPlace`,
  `useMapCanvas.editInPlace`), non più nel mezzo della partenza di «Draw»;
  «Draw route» parte dal primo punto della corsa. «Explore» e il risultato
  di «Draw» invariati. Solo JS dell'app (OTA), nessun testo nuovo, contratto
  e motore invariati. **Resta**: il merge del Coordinatore e la prova sul
  telefono. File `tasks/TASK-346.md`.
- **TASK-336 — Un video nei post: il video della corsa di MuW o uno
  proprio** (ADR-0292, proposta; richiesta dell'utente del 2026-10-29,
  approvata con «Yes, write it up»; numeri dal Coordinatore). Branch
  `docs/TASK-336-video-in-posts`: solo i documenti, con quattro scelte da
  chiedere all'utente una per volta (il lettore, lo spazio e i limiti, i
  dati mobili, testi e privacy). Regola comune con TASK-333 (ADR-0289,
  modulo `media_files.py`), concordata con quella sessione. Poi A (API:
  file su disco in `data/media/posts`, `PUT` del file nudo, lettura con
  `Range`), B (app: scegliere e mandare), C (app: Feed e disegno aperto)
  e D (la build 1.0.2 con `expo-video`). Impronta iOS `83793e26`
  invariata fino a D. File `tasks/TASK-336.md`.
  Scelte dell'utente del 2026-10-29: `expo-video` nella 1.0.2, anche per
  i messaggi; i video sul disco del server con un tetto di 15 GB; a
  spazio pieno si cancellano i video dei messaggi dal più vecchio, mai
  quelli dei post. Dati mobili (parte sulla sua pagina), testi e privacy
  accettati su delega dell'utente, da rivedere; tutto ciò che è nativo
  aspetta l'utente. PR #631, solo documenti.
- **TASK-334 — I posti che l'utente tiene sul telefono** (ADR-0290;
  richiesta dell'utente del 2026-10-29, numeri dal coordinatore). Scelta
  dell'utente: «Sì, così»: in «Settings» → «Offline maps» «Add a place»
  cerca un paese per nome e ne scarica la zona con 6 km intorno, per lo
  sport di «Settings»; dove il server non l'ha la prepara lui (3 posti
  nuovi al giorno per telefono, 20 per il server, uno alla volta); fino a
  10 posti, fuori dai 2 GB, mai cancellati da soli. API
  (`phone_zone_places.py`, `POST /phone-zones/{network}/places`) e app
  (`keptPlaces.ts`, `OfflineMapsSetting`, `ZoneEntry.kept`) in `main` dalla
  #637 (`a623d61c`, 2026-10-29; task Done), impronta iOS invariata
  (`83793e26…`). I due testi nuovi («Trying again later», «Up to {count}
  places.») approvati dall'utente lo stesso giorno. Dopo il merge, il
  server e l'OTA col sì dell'utente. File `tasks/TASK-334.md`.
  Server a `c7a83347` dal 2026-10-30 07:20Z (migrazione 0038), `preview`
  `4ed4e1df`; l'OTA di produzione resta da lanciare a mano. La sfida del
  concorso (TASK-299) si apre il 2026-11-16 poco prima delle 09:00 ora
  italiana, come ha scelto l'utente: `python -m shaperoute_api.contests open
  --from 2026-11-16T09:00+01:00 --to 2026-11-29T23:00+01:00`.
- **TASK-329 — «Ask for a route» sempre aperto, con le nostre idee in
  Europa e poi le foto vere dei posti** (ADR-0287; richiesta a voce
  dell'utente del 2026-10-29, proposta approvata con «Sì, così»; numeri
  dal Coordinatore). **Parte A** (branch `feat/TASK-329-explore-ideas`,
  solo app, OTA): via «CITY TOURS» e «PICTURES» da «Draw»; «Ask for a
  route» aperto in fondo a «Explore» con quattro categorie fisse (Famous
  Places, Best Views, Hidden Gems, Photography); sopra, la fila «IDEAS FROM
  EUROPE» con circa 12 percorsi in 8 città calcolati una volta da
  `tools/themed_ideas.py` (job a tema dell'API e motore, nessuna coordinata
  inventata) in `src/explore/themedIdeas.json`; un'idea si apre senza rete
  e, lontano dalla partenza, ha «Make it near me». I testi nuovi aspettano
  il sì dell'utente; `App.tsx` dopo il merge di TASK-327. **Parte B** (API
  + server col sì dell'utente): codice Wikidata e foto di ogni posto con
  `CityPhotos` di TASK-283, la fila di foto sotto la mappa. File
  `tasks/TASK-329.md`.
  **A in `main`** con la #630 (`75bcb2e7`, 2026-10-29): «Draw» senza le
  due righe, «Ask for a route» aperto con quattro temi, 12 idee in 8 città
  da `tools/themed_ideas.py`, «Make it near me»; testi approvati («Sì,
  approvo»); impronta iOS `83793e26` invariata; solo OTA.
  **Parte B fatta il 2026-10-29**
  (branch `feat/TASK-329-b-place-photos`, aggiunta ad ADR-0287): ogni
  posto di un percorso a tema ha `wikidata`, i toccati `photo`
  (`CityPhotos`, ≤ 2 s); `GET /place-photos` per i soli elementi delle idee,
  elencati dallo strumento in `services/api/shaperoute_api/data/idea_items.json`
  (`themed_ideas.py --items`); nell'app la fila «1 Colosseum»… sotto la
  mappa, numerata come sulla mappa, un tocco porta la mappa lì; le schede
  delle idee con la foto del primo posto e la forma in piccolo. Nessun
  testo nuovo, nessuna dipendenza, `engine.zip` invariato. **Prossimo**:
  il sì dell'utente sulla riga della privacy (invariata), la PR al
  Coordinatore, poi il server col sì dell'utente; senza il server l'app
  mostra i posti col solo nome.
  **Chiuso il 2026-10-30**: B in `main` (#633), server da `5910bcfa`, privacy
  sul sito da `c7a83347` (F.14, lanciata dall'utente alle 07:27Z).

- **TASK-321 — L'attività finita anche in Apple Salute e in Health
  Connect, perché compaia in Fitness** (ADR-0281, proposta; domanda
  dell'utente del 2026-10-28, numero dal Coordinatore). Scelte
  dell'utente dello stesso giorno: automatico dopo il primo sì (si spegne
  dall'app Salute), calorie stimate solo per la corsa, Android insieme,
  testi e privacy approvati, quattro dipendenze sì
  (`@kingstinct/react-native-healthkit`, `react-native-nitro-modules`,
  `react-native-health-connect`, `expo-build-properties`). Branch
  `docs/TASK-321-apple-health` (documenti), poi A (app: la riga a fine
  attività e un allenamento con il percorso scritto con «Save»; le
  librerie fuori dal linking, impronte da misurare), B (la 1.0.1 iOS:
  capability HealthKit, testo del permesso, privacy, revisione di Apple) e
  C (la build Android: Health Connect, `minSdk` 26, la dichiarazione della
  Play Console). Capability, build, invii e dichiarazione col sì
  dell'utente. File `tasks/TASK-321.md`.
  **A fatta** (2026-10-28, branch `feat/TASK-321-a-health-app`): la riga
  sotto «Send to Strava», la scelta in `health.json`, l'allenamento con il
  percorso scritto con «Save» (`src/health/`), le quattro librerie in
  `package.json` ma fuori dal linking: senza il modulo nativo la riga non
  c'è. Impronte invariate su una copia pulita, iOS `83793e26…` e Android
  `e2d33497…`. Prossimo: B (la 1.0.1). Per C: `react-native-health-connect`
  4.1.3 non scrive il percorso senza la precisione verticale dei punti, che
  MuW non ha («Per C» nel task file).
  A in `main`: #615, merge `8d8c4dde` (2026-10-28), impronte misurate anche
  sull'albero unito con `main`: iOS `83793e26…`, Android `e2d33497…`.
- **TASK-323 — Nuoto in acque libere, «Open water swim»** (ADR-0283,
  proposta; richiesta dell'utente del 2026-10-28, «parti proprio con il
  progetto secondo me funziona»; numeri e condizioni dal Coordinatore).
  Branch `docs/TASK-323-open-water-swim` (documenti), poi A1 (motore:
  l'acqua della canoa con la fascia rovesciata, 20–150 m dalla riva,
  0,5–3 km, campioni per l'utente; la canoa e l'impronta degli esempi
  tenuti non cambiano), A2 (le curve col nome del posto a riva), B (API,
  migrazione, estratto dei nomi sul server col sì dell'utente), C (lo
  sport nell'app, `ready: false` fino al motore, avviso di sicurezza e
  testi da approvare), D (telefono nella boa, file dell'orologio) ed E
  (Apple Watch con le vibrazioni, nella build 1.0.1 con TASK-321). File
  `tasks/TASK-323.md`.
  **A1 scritta** (2026-10-29, sessione cloud, branch
  `claude/inspiring-lovelace-rcadwd` spinto su MUW e copiato dallo specchio,
  PR in bozza LPPL1316/MUW#10; come spingere dal cloud: `tasks/TASK-323.md`,
  «A1, dove si è»): il nuoto in file nuovi
  (`swim_water.py`, `swimming.py`, `python -m route_engine.swimming`), la
  canoa e le impronte come in `main` (`route_store` `abaea5bb82b3`, esempi
  della canoa `1b6759cb3cc4`; aggiunta ad ADR-0283). **Il risultato**: con
  20–150 m una costa dritta o la riva di un lago grande tengono un giro di
  0,4–0,5 km. **L'utente ha scelto i giri ripetuti**: la fascia resta, il
  nuoto ripassa la forma fino a 5 volte (fino a circa 2 km sulle coste
  dritte). Nel nuoto anche un disegno a mano e la grandezza coi giri
  (richiesta dell'utente). **Prossimo**: i posti veri sul Mac con
  `tests/measure_swim.py`, la conferma dei «File toccati» al Coordinatore
  prima del merge, poi B (con la canoa disegnata sull'acqua).
  **A1 in `main`** con la rockydalbianco/shaperoute#640 (2026-10-29).
  **A2 scritta** (2026-10-29, stessa sessione, branch
  `feat/TASK-323-a2-swim-turns`, allineato a `main`): le curve del nuoto con il
  posto a riva più vicino entro 300 m, dai file di `<cache>/shore_names/`,
  e i waypoint nel GPX; in `SwimPlan`, impronte come in `main`. **Prossimo**:
  A2 in `main`, poi B (contratto, migrazione, estratto dei nomi sul
  server, esempi della canoa rifatti).
- **TASK-317 — L'attesa in «Draw»: un testo da corridore e i disegni del
  Feed** (ADR-0277; richiesta e scelta dell'utente del 2026-10-28, numero e
  condizioni dal Coordinatore). Branch `feat/TASK-317-draw-waiting`. Prima
  del calcolo la scheda dice «Warming up: heart…» al posto di «Waiting for
  the API…»; dopo 3 s, sotto la barra, sei disegni di esempio del Feed da
  scorrere, senza rete. Solo app, OTA. Aspetta il sì dell'utente sui tre
  testi nelle cinque lingue; poi «pronta» al Coordinatore, che mergia.
  File `tasks/TASK-317.md`.

- **TASK-320 — Disegnare a mano in «Draw», e modificare ogni disegno
  proposto** (ADR-0280; richiesta dell'utente del 2026-10-28; proposte,
  testi e riga della privacy approvati dall'utente il 2026-10-28; numero,
  parti e condizioni dal Coordinatore). **Parte A fatta** (PR #612, branch
  `feat/TASK-320-a-freehand`): la quarta scelta «Freehand» in «Draw», la
  tavola a mano (la prima linea è il contorno chiuso dall'app, le altre
  dettagli appesi, «Erase», «Undo», «Save», niente rete), «Edit the
  drawing» sotto la forma scelta (le linee del catalogo smontate in contorno
  e dettagli) e sul risultato, «Draw route» come per un'immagine, «Drawing»
  dove una foto dice «Image». Solo app, OTA, impronta iOS `83793e26`
  invariata. **Parte B** (le schede di «Explore» e del «Feed») in un'altra
  sessione, dopo A. File `tasks/TASK-320.md`.
  **Parte B fatta il 2026-10-29** (branch `feat/TASK-320-b-edit-cards`):
  «Edit the drawing» sulle schede di «Explore» e dei disegni; il task è
  chiuso con la sua PR. Voce in «Completato».
  File `tasks/TASK-317.md`. **Chiuso il 2026-10-28**: testi approvati
  dall'utente, #604 in `main` (d6545be5), impronta iOS `83793e26`
  invariata; arriva con il prossimo OTA. Voce in «Completato».

- **TASK-318 — Gli sport non pronti nascosti nelle build dello store**
  (ADR-0278; scelta dell'utente del 2026-10-28, «nascondi Soon nello
  store»; fatto dal Coordinatore). Nelle build dell'App Store e di Google
  Play, e negli update `production`, «Paragliding · Soon» non si vede né
  in «Settings» né nel menu di «Draw»; Expo Go e `preview` come prima. Solo
  `sport.ts` e un test nuovo; impronta iOS `83793e26`. Va prima del primo
  update `production`. File: `tasks/TASK-318.md`.
- **TASK-319 — I messaggi privati, con le richieste** (ADR-0279;
  richiesta dell'utente del 2026-10-26, «aggiungi anche la possibilità di
  mandarsi messaggi privati»; scelte: «Chiunque, con richiesta», poi «Sì,
  così» alla proposta). Branch `feat/TASK-319-private-messages` (scritto
  nella sessione cloud); numeri dati dal Coordinatore il 2026-10-28.
  Chiunque scrive a chiunque; chi non è seguito da chi riceve arriva in
  «Requests», un messaggio solo finché non è accettato, filtrato come i
  commenti; «Accept», «Delete», «Block»; il blocco cancella la
  conversazione; nessuna conferma di lettura; push per ogni messaggio, una
  al giorno per una richiesta. **Parte A** (API, migrazione
  `0033_messages.sql`, numero al merge) e **parte B** (l'app: «Messages»
  in «Profile», «Message» sul profilo, la conversazione, «Help» e una
  sezione nuova della privacy, anche sul sito) scritte e verdi in locale;
  testi e privacy **approvati dall'utente** il 2026-10-28. La sessione
  cloud non può fare il push (l'app Claude non è installata su
  rockydalbianco): il branch è arrivato su GitHub dal Mac, dal bundle
  nell'artifact della sessione cloud. Prima del merge, le condizioni del
  Coordinatore scritte nel task file. Server, sito e app dopo il merge,
  con l'ok dell'utente;
  «Messaging and Chat» su App Store Connect la cambia l'utente. File:
  `tasks/TASK-319.md`.
  **Chiuso il 2026-10-28**: in `main` con la #605 (riallineata e chiusa
  dal Coordinatore, la sessione era archiviata); impronta iOS `83793e26`.
  «Messages» resta nascosto finché il server non ha la 0033: server e
  privacy online col sì dell'utente.

- **TASK-312 — Attività fatte con altre app nel Feed, e post di sole
  foto** (ADR-0272, proposta; richiesta dell'utente del 2026-10-27,
  scelte il 27 e il 28 ottobre, numero e condizioni dal Coordinatore).
  Branch `docs/TASK-312-import-activities` (documenti), poi A (API:
  `runs.source`, gioco e concorso solo per `muw`), B (app: «Add past
  activity» da un file GPX, TCX o FIT letto sul telefono, con
  `expo-document-picker` escluso dall'autolinking come i contatti:
  impronta iOS `83793e26` invariata, sui telefoni con la build nativa
  dopo), C (post di sole foto: un disegno senza corsa), D (studio di Apple
  Salute e Health Connect) ed E (studio dei collegamenti diretti: Strava,
  Garmin, Polar, Suunto, Coros, Wahoo, Komoot). Tutto con «Imported», mai
  per il gioco né per il concorso. Testi e privacy da approvare. Regole in
  `IMPORTAZIONI.md`, file `tasks/TASK-312.md`.
  **Parte A fatta** (2026-10-28, PR #613, branch
  `feat/TASK-312-a-imported-runs-api`): migrazione `0034_run_source.sql`
  (`runs.source`, `muw` o `file`); `PUT /me/activities/{key}` accetta
  `source` al primo `PUT`; le corse `file` non entrano nel gioco, nelle
  sfide né nel concorso, e «Send to Strava» risponde `409 imported_run`;
  `source` in «My activities», nel disegno, nel Feed e nel profilo, con
  le fixture `*-imported.json`. Server dopo il merge, col sì dell'utente.
  Prossima: B (l'app).
  **Parte B fatta** (2026-10-29, PR #622, branch
  `feat/TASK-312-b-import-file-app`): in cima a «My activities» «Add past
  activity» → «From a file»; GPX, TCX e FIT letti sul telefono dai lettori
  di `src/imports/` (niente dipendenze oltre al selettore), la corsa con gli
  orari del file e `source: "file"`, il modulo di fine corsa con
  «Imported», senza Strava né Apple Salute; «Imported» anche sulla riga,
  sulla scheda e nel Feed. `expo-document-picker` fuori dall'autolinking:
  nella 1.0 il pulsante non c'è (impronta iOS `83793e26` invariata, su copia
  pulita), si accende con la 1.0.1 (promemoria in `tasks/TASK-152.md`).
  Testi e riga della privacy approvati dall'utente, privacy del 29 ottobre
  2026. Provata contro l'API vera (0034); la prova con i file veri di
  Strava e Garmin resta per il telefono (Expo Go, preview). Prossima: C.
  **B in `main`** il 2026-10-29 (#622, `5d7a5eda`, merge del
  Coordinatore). La prova con i file veri la fa l'utente sulla preview di
  `main` dopo l'aggiornamento del server: è una sua scelta del
  2026-10-29, «Merge, provo sulla preview».
- **TASK-311 — Parole scritte meglio, e sul server tutto quello che si
  chiede** (ADR-0271, proposta; richiesta dell'utente del 2026-10-27,
  numero e condizioni dal Coordinatore). Parte A, branch
  `feat/TASK-311-a-words-measure`: 1000 parole (50 × 5 città × 3 e 4 km a
  lettera × due stili) misurate sul Mac con
  `tests/measure_words_many.py`. Poi B (il metodo, solo ciò che la misura
  dimostra; più km a lettera col sì dell'utente), C (le parole provate in
  `drawn_routes` sul server, dopo Apple) e D (nell'archivio anche disegni
  a mano, contorni delle foto e richieste senza percorso, senza account;
  privacy da approvare). File `tasks/TASK-311.md`. **A fatta** (2026-10-28):
  443 buone su 1000; più km a lettera non servono, conta la lunghezza;
  da 5 lettere in su la penna alzata porta le buone da 11 % a 40 %. B
  aspetta la scelta dell'utente sulla penna alzata per le parole lunghe.
  **Parte B** (2026-10-28, branch `feat/TASK-311-b-pen-up-hint`, worktree
  `.claude/worktrees/TASK-311-b`): la scelta dell'utente è «anche quando
  non riesce grazie». La penna alzata già scelta c'era da TASK-202, per
  ogni parola: le corte restano così (confermato dal Coordinatore). Nuovo:
  una parola chiesta su una riga che non riesce (somiglianza sotto 0,90,
  distanza oltre il 10 %, o `shape_not_drawable`) ha sotto «Lift the pen»,
  che accende l'interruttore e la ridisegna a penna alzata. Solo JS
  dell'app, impronta iOS `83793e26`; aggiunta ad ADR-0271 in fondo a
  `DECISIONS.md`. I due testi nuovi approvati dall'utente nelle cinque
  lingue («testi ok», 2026-10-28). PR #601, merge dal Coordinatore. **Dopo**:
  la parte C (le parole provate in `drawn_routes` sul server), in una
  sessione sua, col sì dell'utente.
  **Parte B** in `main` con la #601 (`83ba3087`, 2026-10-28), mergiata dal
  Coordinatore; impronta iOS `83793e26` invariata. Sul telefono con il
  prossimo aggiornamento dell'app, col sì dell'utente. **Prossimo**: la
  parte C, in una sessione nuova, dopo Apple e col sì dell'utente.
- **TASK-314 — La strada per tornare sul percorso, sulle vie** (ADR-0274,
  seguito di ADR-0263; richiesta dell'utente del 2026-10-27, «tipo il
  ricalcolo di Google maps»; numero e condizioni dal Coordinatore). Parte A
  nel branch `feat/TASK-314-a-way-back`, worktree
  `.claude/worktrees/TASK-314`: il motore calcola la strada per tornare,
  dal punto della via più vicina al runner fino al percorso più avanti, per
  strada e con le svolte. Gira sul telefono e su `POST /way-back`;
  l'impronta degli esempi tenuti non cambia. Parte B (schermo di corsa,
  testi nuovi) dopo la #567 e dopo A. File `tasks/TASK-314.md`.
  **Parte A** in `main` con la #588 (`f381b7f5`, 2026-10-28). Impronta di
  `route_store` invariata (`6072aa1ea3a3`), impronta iOS `83793e26`. Nessuno
  la chiama ancora: oggi la corsa mostra i puntini come prima. Sul server
  dopo Apple, con il sì dell'utente; poi va guardato nei log quello che
  dice il task file. La parte B parte da qui, in una sessione sua, con i
  «File toccati» al Coordinatore prima del codice.
- **TASK-313 — «Draw it near me»: la stessa forma in un altro posto**
  (ADR-0273; richiesta dell'utente del 2026-10-27, «Sì, così» alla
  proposta; numero e ordine dal Coordinatore, prima di TASK-309 B). Branch
  `feat/TASK-313-draw-it-near-me`, solo app (JS). Nella scheda di un
  percorso di «Explore» e in quella di un disegno (Feed, profili) il
  pulsante porta a «Draw» con la stessa forma, o la stessa parola con le
  sue lettere, e la stessa distanza (al decimo di km, una parola mai sotto
  i suoi 3 km a lettera, dentro i limiti dello sport); la partenza resta
  quella di «Draw» e niente si chiede prima di «Draw route». Niente per
  foto, immagini, percorsi a tema, forme sconosciute, parole che «Draw»
  rifiuterebbe o parole in «Paddle». Il testo nuovo è
  approvato dall'utente (2026-10-28). File: `tasks/TASK-313.md`.
  **Chiuso**: in `main` con la #586 (2026-10-28), impronta iOS `83793e26`.
- **TASK-309 — Le corse di gruppo («Group runs»)** (ADR-0269; richiesta
  dell'utente del 2026-10-26, «Sì, così» alla proposta con le aggiunte del
  Coordinatore lo stesso giorno). Branch `docs/TASK-309-group-runs`
  (documenti), poi A (API), B (app, dopo TASK-299 B) e C (commenti). Un
  iscritto crea da un percorso pronto una corsa di gruppo: il ritrovo è la
  partenza, giorno e ora da 30 minuti a 60 giorni, «Where exactly»,
  descrizione, Everyone o Followers; la fila «Group runs» in cima al Feed
  sotto la scheda del concorso, solo con qualcosa da mostrare; «I'm going»;
  un promemoria un'ora prima, le push di cambio e di annullamento; filtro
  dei testi, segnalazioni e blocchi come i post; avviso di sicurezza e
  riga della privacy. Selettore di data in JavaScript: impronta iOS
  invariata. Nessuna notifica all'organizzatore quando qualcuno si
  aggiunge: lo vede nella pagina. È la scelta dell'utente dopo la
  correzione della proposta, la cui «lista Notifiche» non esiste. Regole
  in `EVENTI.md`, file `tasks/TASK-309.md`.
  **Documenti** in `main` con la #574 (`06a95749`, 2026-10-27).
  **Parte A** (API, branch `feat/TASK-309-a-group-runs-api`, migrazione
  `0032_group_runs.sql`; la 0031 è del feedback, #576):
  `group_runs.py` con `POST /group-runs`, la fila `GET /group-runs`, la
  pagina, il cambio e l'annullamento dell'organizzatore, «I'm going» e «Not
  going», chi va a pagine, le corse di gruppo di un profilo; il promemoria
  un'ora prima una volta sola (`GroupRunClock`, `UPDATE` condizionato), le
  push di cambio e di annullamento (anche all'account cancellato
  dell'organizzatore), nessuna per un «I'm going»; blocchi, nascosti e il
  filtro dei testi; `group_run` nelle segnalazioni e nelle loro email.
  Tipi e fixture in `shared-types`. Nessun codice d'errore nuovo:
  `schemas.py` ed `engine.zip` invariati. Testi de/es/fr delle push e
  della privacy approvati dall'utente il 2026-10-27; la riga della privacy
  è nella sezione «Group runs» dei testi dell'app, sopra «Feedback», e
  `site/privacy` è rifatta (2026-10-28, dopo #573 e #576). Merge dal
  Coordinatore; server dopo Apple, con il sì dell'utente. Com'è fatta:
  `EVENTI.md` §14.
  **Parte A** in `main` con la #581 (`989fffe5`, 2026-10-28), mergiata dal
  Coordinatore; impronta iOS `83793e26` invariata. Sul server dopo Apple,
  con il sì dell'utente (migrazione `0032` all'avvio, nessuna variabile
  nuova). La riga «Reports» della privacy con «or a group run» la porta il
  Coordinatore all'utente; con il sì, va nella parte B. **Prossimo**: la
  parte B (app), in una sessione sua.
- **TASK-306 — Forme pronte vicino a te in «Draw», ed «Explore»
  preparato all'apertura** (ADR-0266; richiesta dell'utente del
  2026-10-26, «Sì, va bene così: procedi con TASK-306» lo stesso giorno;
  numeri e condizioni dal Coordinatore). Branch
  `feat/TASK-306-near-you-shapes`, solo app (JS, nessuna dipendenza,
  nessun server). Sotto la distanza, con la corsa, «NEAR YOU»: cerchio,
  cuore e stella da 5 km dalla posizione, disegnati dal telefono (il
  server se non ha mappe), tenuti in `near-you.json` fino a 1 km; una
  forma che non viene lascia il posto a una già pronta in una città in
  evidenza a caso, dalla più semplice; senza posizione o con niente
  vicino, sei città e «SHAPES TO TRY». All'apertura, prima che si apra,
  «Explore» chiede lista, paesi vicini e i loro esempi. Tutto dopo
  l'animazione d'apertura, mai durante corsa, navigazione o background.
  Testi: inglese e italiano approvati con la proposta, de/es/fr
  dell'agente; tempi e dati sul telefono sono stime. File:
  `tasks/TASK-306.md`.
  **Chiuso**: in `main` con la #571 (`0bfc07c0`, 2026-10-27); resta la
  preview del Coordinatore e il tempo vero sul telefono dell'utente.
- **TASK-303 — Dopo una deviazione la corsa rientra più avanti, con la
  guida per tornarci** (ADR-0263; prova sul campo dell'utente a Trento del
  2026-10-25, piano approvato; numero e condizioni dal Coordinatore). Branch
  `feat/TASK-303-detour-rejoin`, worktree `.claude/worktrees/TASK-303`.
  Fuori percorso, la corsa cerca il runner anche oltre i 300 m di `locate`,
  fino a 300 m più 2 m per ogni metro corso fuori, e lo riprende dopo 20 m
  nel verso del percorso (di traverso no), saltando le svolte di mezzo.
  Mentre è fuori: linea a puntini sulla mappa fino al punto più vicino in
  linea d'aria, distanza e punto cardinale nel banner, e una frase a voce
  dopo «Sei fuori percorso». Solo app, `useNavigation.ts` e `App.tsx`
  invariati. **Testi nuovi in 5 lingue da approvare dall'utente** prima del
  merge; poi «#NNN pronta» al Coordinatore, ordine 302 → 303 → 304.
  `tasks/TASK-303.md`.
  **Chiuso** nella sua PR #565 (2026-10-26); vedi «Completato».
- **TASK-307 — Correre il disegno di un altro, e scaricarne la traccia**
  (ADR-0267; richiesta dell'utente del 2026-10-26: «poter scaricare la
  traccia e poterla iniziare pure tu»; numero e regole dal Coordinatore).
  Branch `feat/TASK-307-start-friend-track`, solo app. Sulla scheda del
  disegno aperto, dal «Feed» o dal profilo: «Start» sulla traccia
  tagliata, subito e **senza svolte a voce** (una traccia GPS non sta sul
  grafo, `/route-directions` la rifiuta; la scheda lo dice), ed «Export
  GPX» scritto sul telefono, senza tempi né nome. La corsa salvata dice ciò
  che il disegno disegna; a fine corsa si torna al disegno. L'utente il
  2026-10-26 ha approvato il testo nuovo e scelto **nessun interruttore**
  per chi pubblica: una frase nuova nella «Privacy», in app e sul sito.
  Le svolte a voce (map-matching nell'engine) sarebbero un task a parte.
  File: `tasks/TASK-307.md`.
  **Chiuso**: in `main` con la #573 (`f8dd7964`, 2026-10-27), privacy
  datata 27 ottobre 2026; vedi «Completato».
- **TASK-299 — Il primo concorso: il post con più reazioni vince**
  (ADR-0260; richiesta dell'utente del 2026-10-24, «Sì, così» alla
  proposta lo stesso giorno; numeri e condizioni dal Coordinatore). Branch
  `docs/TASK-299-proposal` (documenti), poi `feat/TASK-299-a-contest-api`
  (A) e `feat/TASK-299-b-contest-app` (B). L'utente ha scelto, fra tre
  strade, il **premio senza valore**: il badge «Winner» sul profilo, il
  post vincitore in cima al Feed per 7 giorni, una push a chi ha vinto; la
  maglietta è un concorso a parte, quando ci sarà la ditta (DPR 430/2001).
  Il server decide: partecipano i post per tutti pubblicati nel periodo;
  conta una reazione per account, mai la propria, non attraverso un
  blocco, non i post nascosti; pari merito per cuori MuW, poi il post più
  vecchio. `GET /contests/current` anche senza account; i comandi `open`,
  `standings` e `close` sul server (chi lo gestisce, con le date
  dell'utente, dopo aver guardato i primi dieci); la scheda in cima al
  Feed solo con un 200, il regolamento ufficiale da «How it works» (Apple
  e Google non coinvolte). Regole in `CONCORSI.md`. Testi nelle cinque
  lingue da approvare prima del merge; server dopo Apple con l'ok
  dell'utente. File: `tasks/TASK-299.md`.
  **Documenti** in `main` con la #549 (`612bf143`, 2026-10-25).
  **Parte A** (branch `feat/TASK-299-a-contest-api`, PR #562, migrazione
  `0030_contests.sql`, rinumerata dopo la #559, numero al merge): la
  tabella `contests` con un
  solo concorso aperto; `contests.py` con la query unica della
  classifica (partecipa, conta, pari merito), `GET /contests/current`
  con la sola chiave (`mine` col token, `top` senza i post attraverso un
  blocco con chi chiede, `404 no_contest`), i comandi `open`,
  `standings` e `close` (una volta sola, `--exclude`, `--dry-run`,
  rifiuta prima della fine), la push `contest_won` al vincitore dopo il
  commit; `contest_wins` in `User` e `PublicProfile`; tipi e fixture in
  `shared-types`; il codice d'errore `no_contest` (`schemas.py`,
  `api-error-codes.json`, ok del Coordinatore). Un test per regola in
  `test_contests.py`. Testi de/es/fr della push approvati dall'utente il
  2026-10-26; `schemas.py` viaggia nel motore del telefono, quindi
  `engine.zip` rifatto (ok del Coordinatore). Server dopo Apple, con l'ok
  dell'utente.
  **Parte A** in `main` con la #562 (`5f762ae7`, 2026-10-26), mergiata su
  «mergia si» dell'utente; migrazione `0030_contests.sql`. La parte B
  (app) parte da qui, in una sessione sua. Sul server dopo Apple, con
  l'ok dell'utente: migrazione, deploy, `open`.
  **Parte B** (app, branch `feat/TASK-299-b-contest-app`, PR #575): la
  cartella `src/contest/`; la scheda sotto la lente di «Feed» solo con un
  concorso (chiesto quando «Feed» si apre e a ogni pull, tenuto in
  `contest.json`, cancellato da un 404): i giorni che restano, i primi tre
  che aprono il post, «Your best post» o «Publish a run to take part.»,
  «How it works» con il regolamento ufficiale; per 7 giorni dopo la
  chiusura il post vincitore; il badge «Winner» nei profili
  (`contest_wins`) e la fascia sul disegno vincitore. Testi nelle cinque
  lingue approvati dall'utente il 2026-10-26; impronta iOS invariata
  (`83793e26`). Com'è fatta: `CONCORSI.md` §14. Su preview la scheda resta
  nascosta finché il server non ha la parte A.
  **Chiuso**: parte B in `main` con la #575 (`4771402b`, 2026-10-27); il
  concorso è tutto in `main`. Sul server dopo Apple, con l'ok
  dell'utente: migrazione `0030`, deploy, `open` (Coordinatore).
- **TASK-262 parte B — L'email delle notifiche, una al giorno**
  (aggiunta ad ADR-0226; scelte dell'utente del 2026-10-25: un riassunto
  al giorno, la lingua come l'email di ritorno; conferma dell'email e
  password dimenticata a parte, TASK-300). Branch `feat/TASK-262-b-email`,
  solo API: le cinque notizie delle push tenute in `email_notices`
  (migrazione `0028_email_notices.sql`, numero da controllare al merge)
  per chi ha «Email notifications» acceso, un giro al giorno alle 18:00
  UTC, una email al massimo per account e giorno, il link per spegnerla.
  Si accende con l'email di ritorno e dopo la parte B di TASK-284 (nota di
  «Settings», help e privacy). I testi nuovi aspettano il sì dell'utente.
  File: `tasks/TASK-262.md`, «Parte B» (scritta dopo #461).
  **TASK-262 chiuso il 2026-10-26**: parte B in `main` con la #550
  (`ef5021f4`), con A (#451) e C (#461) già dentro; vedi «Completato».
- **TASK-300 — Email confermata e «Forgot password?»** (ADR-0261; scelta
  dell'utente del 2026-10-25, «a parte SUBITO»; numero e regole dal
  Coordinatore). All'iscrizione e al cambio in «Settings» un link conferma
  l'indirizzo; il nuovo vale solo confermato e il vecchio riceve un
  avviso; da «Log in», «Forgot password?» manda un link per scegliere una
  nuova password, che chiude ogni sessione. Scelte dell'utente: un
  indirizzo non confermato non blocca niente; i 3 account di prima restano
  non confermati, senza email partite da sole; testi approvati. Parti A e
  B in una PR (branch `feat/TASK-300-account-emails`). **Parte A** (migrazione
  `0029_email_confirmation.sql`, numero al merge: la 0028 è di #550):
  `account_email.py` e `account_email_texts.py`, link firmati senza
  tabella, pagine `/email/confirm` e `/password/reset` senza chiave,
  `GET /account-email`, `POST /password-reset`, `POST
  /me/email/confirmation`, `DELETE /me/email/pending`; `User` con
  `email_confirmed` e `pending_email`. Spenta senza le variabili di
  Resend, come l'email di ritorno. **Parte B** (app, solo JS): «Forgot
  password?» sotto «Log in» e le righe sotto «Change email», solo se
  `GET /account-email` risponde 200 (chiesto quando quelle pagine si
  vedono). TASK-284 B tocca le stesse schermate in righe diverse. Server
  dopo Apple, con l'ok dell'utente; l'app prima o insieme. File:
  `tasks/TASK-300.md`.
  **Chiuso**: in `main` con la #550 (`ef5021f4`, 2026-10-25); nota di
  «Settings», help e privacy con TASK-284 B (#556); server dal
  Coordinatore dopo Apple.
  **TASK-300 chiuso il 2026-10-26**: parti A e B in `main` con la #559
  (`57d87a10`), migrazione `0029`; vedi «Completato».
- **TASK-297 — Ricerche dall'archivio dei percorsi e loghi con la penna
  alzata** (ADR-0256 e ADR-0258; ADR-0257 misurata e scartata; richiesta
  dell'utente del 2026-10-24, «sì grazie» alla proposta lo stesso giorno;
  numeri e condizioni dal Coordinatore). Branch `docs/TASK-297-proposal`
  (documenti), poi `feat/TASK-297-a-route-archive` (A) e
  `feat/TASK-297-c-image-pieces` (C). **A**: ogni percorso disegnato
  resta nel database senza chi l'ha chiesto; la stessa richiesta entro
  100 m riceve il percorso pronto con l'avvicinamento (0–2 s invece dei
  6–14 s del server: mediana 6,6 s a ottobre, e l'80 % delle richieste
  ripeteva una già fatta nella stessa cella di 1 km); i più corsi e
  preferiti davanti, gli altri come alternative; tetto e pulizia; testo
  privacy all'utente. **B** (il motore riparte dai piazzamenti imparati
  vicino): misurata a Trento su 36 richieste, peggiore in 28, scartata;
  resta il ridisegno rapido dal piazzamento dopo un cambio del motore
  (A2, dopo la #497). **C**: nelle immagini i soggetti staccati e i fori
  diventano pezzi disegnati uno alla volta, camminando fra l'uno e
  l'altro: «RC» leggibile, la ruota coi raggi, il logo MuW; nel
  repository solo loghi sintetici e MuW. Proposta e prove in
  `out/archivio-apprendimento/` del Mac (ignorato da git). Server dopo
  Apple, con l'ok dell'utente. Seguito da aprire: fermarsi prima quando
  la forma non entra nelle strade (19 ricerche su 36 bruciano i 30
  tracciamenti). File: `tasks/TASK-297.md`.
  **Documenti** in `main` con la #538 (`9391893c`, 2026-10-24).
  **Parte A** (branch `feat/TASK-297-a-route-archive`, migrazione
  `0026_drawn_routes.sql`, numero al merge): la tabella `drawn_routes`
  senza `user_id`; `route_archive.py` davanti al `RouteStore` dei file
  (`get` subito dallo stesso punto, `nearby` nel thread del job entro
  100 m con l'avvicinamento lungo le strade, `put` di percorso e
  alternative, tetto di 50 000 righe); `RouteJobs` chiede l'archivio
  prima del motore (`FindsNearby`); le corse salvate e i preferiti contano
  per `line_key`. Contratto invariato; senza database tutto come prima.
  `jobs.py` va anche sul telefono: `engine.zip` rifatto (da pubblicare su
  `preview`), il telefono senza archivio disegna come prima (test).
  Server dopo Apple, con l'ok dell'utente e il paragrafo della privacy.
  **Parte A** in `main` con la #539 (`0c4ada00`, 2026-10-25), mergiata dal
  Coordinatore: impronta iOS invariata (`83793e26`), su `preview` (gruppo
  `e0e4e126`) con l'`engine.zip` nuovo. L'archivio lavora solo sul server:
  dopo Apple, con l'ok dell'utente; il paragrafo della privacy lo raccoglie
  TASK-284 B. Le parti **C** (motore, sessione sua) e il seguito
  **TASK-298** (ADR-0259, sessione sua) sono partiti il 2026-10-25.
- **TASK-298 — Fermarsi prima nella ricerca quando la forma non entra
  nelle strade** (ADR-0259; seguito di TASK-297, l'utente il 2026-10-24:
  «sì, apri anche quello per fermarsi prima»; condizioni dal
  Coordinatore). Branch `feat/TASK-298-stop-earlier`. **Misurato**
  (`tests/measure_stop_earlier.py`, 252 richieste in sette città,
  tracciamento per tracciamento) e **scartato**: il primo percorso buono
  compare a qualunque tracciamento, anche al 30º di 30 e dal 6º
  piazzamento inclinato; «N piazzamenti senza miglioramento» perde da 10 a
  38 buoni su 129; il conteggio delle strade è 1,00 in testa quasi ovunque;
  saltare la fase inclinata o la rifinitura dopo una fase andata male tiene
  i buoni ma peggiora i mediocri e non abbrevia. Resta una regola piccola:
  una scala già tracciata per lo stesso piazzamento non si traccia più
  (1,3 % dei tracciamenti; i 129 buoni identici, i mediocri mai peggiori).
  Il taglio vero costa percorsi buoni ed è una scelta di prodotto: numeri
  in ADR-0259. `engine.zip` rifatto nella PR. **PR #558** aperta il
  2026-10-25, al merge del Coordinatore. File: `tasks/TASK-298.md`.
  **Chiuso**: in `main` con la #558 (`61932179`, 2026-10-26), mergiata dal
  Coordinatore; scelta dell'utente del 2026-10-26: **tetto 30, invariato**,
  nessun percorso buono perso. Vedi «Completato».

  **Parte C, motore** (PR #547 aperta il 2026-10-25, branch
  `feat/TASK-297-c-image-pieces`): `outline_data(…, pen_up=True)` mette
  in `pieces` i soggetti dopo il primo e i fori che valgono il 3 % del
  loro soggetto, dal più grande al più piccolo, niente gambi; con
  `pen_up=False` le sedici immagini di «Draw» danno lo stesso contorno
  byte per byte (impronte in `tools/test_sample_logos.py`);
  `ImageRequest.pen_up` e `--image … --pen-up` compongono i pezzi come
  una forma a pezzi e cercano come le parole con la penna alzata; il
  contratto HTTP non cambia (C2). `tools/sample_logos.py` disegna sette
  loghi sintetici e usa il marchio MuW del lancio (anello con stella 2
  pezzi, ruota 4, «RC» la C e l'occhio della R). `engine.zip` rifatto;
  `draw_examples`, `paddleExamples.json` e `catalogueShapes.json` da
  rifare con gli altri cambi del motore, dopo Apple. Emerso: la ricerca
  lontana (ADR-0040) su un grafo piccolo che ignora l'area cade in
  `optimizer.next_scale` con `ZeroDivisionError` (`ratio` 0): da guardare
  con la #497, che ha `optimizer.py`.

  **Parte A2** (in `main` di `LPPL1316/MUW` con la #7, `e789e9c`, 2026-10-29, branch
  `feat/TASK-297-a2-first-placement`, sessione cloud; aggiunta ad
  ADR-0256): il ridisegno rapido dopo un cambio del motore.
  `optimizer.search` prende `first` (un piazzamento) e `first_scale_m`,
  facoltativi, e li prova per primi: se il percorso è buono si ferma lì,
  altrimenti i loro tracciamenti vanno da parte e la ricerca è quella di
  oggi; senza `first` è quella di oggi tracciamento per tracciamento
  (impronte prese su `main`). L'archivio tiene il piazzamento della
  ricerca vicino alla partenza (migrazione `0035_drawn_routes_placement.sql`,
  numero al merge; `RouteJobs` gli passa il piano, `KeepsPlacements`) e,
  quando entro 100 m c'è solo una riga buona di un altro motore o di più
  di 30 giorni, la ridisegna dalla sua partenza con il pianificatore
  dell'API e `first`, la tiene e la raggiunge dalla partenza dell'utente.
  Una linea ridisegnata uguale rinfresca la sua riga; i grafi caricati
  dall'archivio non finiscono più sotto le indicazioni del motore (difetto
  della parte A). File fuori elenco nella PR: la migrazione, `jobs.py`,
  `engine.zip`, `API.md`, `DATABASE.md`. Da rifare dopo il merge, con gli
  altri cambi del motore e dopo Apple: `draw_examples` (anche `--water`),
  `paddleExamples.json`, `catalogueShapes.json`; le città vere e gli
  esempi tenuti si misurano sul Mac (`tests/measure_first_placement.py
  --cache-dir`), qui la rete non c'è.
- **TASK-295 — Il video della corsa, da esportare per i social**
  (ADR-0254; richiesta e scelta dell'utente del 2026-10-23, «Sì, così»).
  Branch `feat/TASK-295-run-video`. In «Share your run», «Export video»
  accanto a «Instagram»: un video di 12 s, 9:16, sul giallo del post, con
  la linea della corsa che si disegna mentre distanza e tempo salgono, poi
  il post intero con le emoji; niente musica. Si fa sul telefono nel
  WebView (WebCodecs, H.264 Baseline) e l'app scrive l'MP4; poi il foglio
  di condivisione. Solo app: nessuna dipendenza nuova, niente di nativo,
  fingerprint iOS invariato. Provato nel simulatore (1,9 MB in circa
  10 s); la prova sull'iPhone è dell'utente. File: `tasks/TASK-295.md`.
  **Chiuso**: in `main` con la #533 (`90691d47`, 2026-10-23), mergiata
  dal Coordinatore, provato dall'utente sull'iPhone; vedi «Completato».
- **TASK-296 — Il gioco delle forme** (ADR-0255; chiesto dall'utente il
  2026-10-23, numero dal Coordinatore). Le corse a piedi salvate sbloccano
  forme da collezionare, per km totali e per passo su una distanza; in
  squadra si ricrea una forma divisa in pezzi entro una scadenza. Sta in
  una pagina nuova «Play», scelta dall'utente fra «Play», una riga nel
  Profilo e un'app a sé. Il server conta, l'app mostra; «Play» si vede
  solo se `GET /game/catalog` risponde 200. Le parti sono A (API,
  collezione), B (app, collezione), C (API, squadre e sfide), D (app,
  sfide) ed E (striscia in corsa). Regole in `GIOCO.md`. Prima i
  documenti (branch `docs/TASK-296-shape-game`), poi A. Testi delle push e
  paragrafo di privacy aspettano il sì dell'utente. Server solo dopo Apple.
  File: `tasks/TASK-296.md`.
  **Documenti** in `main` con la #532 (`f34ca6c5`, 2026-10-23).
  **Parte A** (branch `feat/TASK-296-a-game-api`, migrazione `0025_game.sql`
  da rinumerare al merge se serve): `game_runs` e `game_unlocks`, regole
  pure in `game_rules.py`, 12 forme in `game_catalog.py`, `GET
  /game/catalog`, `/game/me` e `/game/runs/{key}`, la push
  `shape_unlocked`, `python -m shaperoute_api.game_backfill` per le corse
  di prima. La risposta del salvataggio non cambia. Sul server, dopo
  Apple: migrazione, deploy, backfill.
  **Parte A** in `main` con la #534 (`abb593c5`, 2026-10-24).
  **Parte B** (branch `feat/TASK-296-b-play-collection`): la pagina «Play»
  fra «Explore» e il profilo, solo mentre `GET /game/catalog` risponde 200
  (chiesto all'avvio, tenuto sul telefono); la collezione a griglia, in
  giallo le forme sbloccate, in grigio le altre con requisito e
  percentuale, nelle unità scelte; la scheda «New shape unlocked» dopo
  che l'API ha preso la corsa; la push `shape_unlocked` che apre «Play» e
  non si mostra a app aperta. Solo app, impronta iOS invariata; su
  `preview` dopo che A è sul server (o prima: senza il gioco sul server la
  pagina non si vede).
  **Parte B** in `main` con la #536 (`145cf992`, 2026-10-24); testi
  dell'app approvati dall'utente lo stesso giorno. Restano C, D ed E.
  **Parte C** (branch `feat/TASK-296-c-teams-api`, PR #540, migrazione
  `0027_game_teams.sql`, perché la 0026 è di TASK-297 A, #539; il numero
  si ricontrolla al merge): `game_teams`, `game_team_members`,
  `game_challenges`, `game_pieces`, `game_contributions` e `challenge_id`
  in `game_unlocks`; `game_teams.py` (nome dal filtro di TASK-213, codice
  di 6, join rifiutato senza motivo con un blocco, oltre 20 iscritti o 10
  squadre, uscita, rimozione, passaggio di proprietà, ganci alla
  cancellazione dell'account e al blocco), `game_challenges.py` (una
  sfida per squadra, un pezzo in mano per persona, riempimento da
  `after_run_saved` con i km in avanzo, pezzo veloce, edizione squadra,
  `ChallengeClock` per «1 day left»), il contorno dei pezzi in
  `game_rules.pieces_of`, gli otto endpoint, `pieces_done` in `GET
  /game/runs/{key}`, i tre `Kind` in `push.py`. La regola del blocco fra
  iscritti e i testi delle tre push sono approvati dall'utente
  (2026-10-24). Server dopo Apple, con l'ok dell'utente.
  **Parte C** in `main` con la #540 (`88b63b6e`, 2026-10-25), mergiata dal
  Coordinatore su richiesta dell'utente a CI verde. Restano D ed E.
  **Parte D** (branch `feat/TASK-296-d-challenges-app`, PR #561, 2026-10-26):
  «Play» ha due schede, «Collection» e «Challenges»; la seconda ha le
  squadre («Create» con il nome, «Join» con il codice, la squadra con il
  codice, «Share code» con una frase nel foglio di condivisione, gli
  iscritti, «Remove» per chi l'ha creata, «Leave team») e la sfida (la
  forma a pezzi colorati per persona per quanto è corsa, chi ha dato
  quanto, i pezzi con «Take this piece» e «Leave», quanto manca e il conto
  alla rovescia, completa e scaduta, «New challenge»); la sfida si rilegge
  ogni 15 s e al ritorno in primo piano; le tre push della C aprono la
  sfida. Il contorno dei pezzi del telefono è uguale a quello dell'API
  (test di parità con i suoi numeri). Su un server senza la C la scheda
  dice che le squadre non ci sono ancora, senza errore. Solo app, nessuna
  dipendenza nuova; i testi nelle cinque lingue aspettano il sì
  dell'utente (task file, «Testi da approvare»). Resta la E.
  **Parte D** in `main` con la #561 (`a8d75842`, 2026-10-26), mergiata
  dalla sessione della D a CI verde su parola dell'utente, che ha
  approvato i testi lo stesso giorno («I testi vanno bene, mergiate pure
  la #561»); impronta iOS da misurare su `main` dal Coordinatore, poi il
  preview. Resta la E.
  **Parte E** (branch `feat/TASK-296-e-run-strip`, PR #564, 2026-10-26): la
  riga del gioco nella scheda della corsa, sotto i numeri di «Map» e di
  «Data», per la corsa a piedi con l'account: la prossima forma per
  distanza con i km del server più quelli della corsa («Hexagon 14.2 / 20
  km»; oltre la soglia la forma dopo, mai «unlocked»), o con un pezzo
  veloce in mano il passo dell'ultimo km contro l'obiettivo («Last km 5:12
  · target 5:00 /km»); `GET /game/me` e `GET /game/teams` una volta
  all'inizio della corsa, mai durante; niente riga e nessun errore in bici,
  in canoa, senza account, senza rete o senza il gioco sul server. Le
  squadre lette con `fetchTeams` e i tipi della D. Solo app, nessuna
  dipendenza nuova; i due testi approvati dall'utente il 2026-10-26 (task
  file, «Testi da approvare»); il posto della riga lo conferma l'utente su
  `preview`. Con la E il task è completo: dopo il merge, chiusura e
  server (A e C) dopo Apple.
  **Chiuso**: la E in `main` con la #564 (`de4ca26b`, 2026-10-28); le
  cinque parti sono in `main`, vedi «Completato». Sul server A e C dopo
  Apple, con l'ok dell'utente.

- **TASK-294 — MuW su Google Play** (richiesta dell'utente del
  2026-10-23; numero dal Coordinatore). Tre parti, una PR ciascuna.
  **A** (aggiunta ad ADR-0225), branch
  `feat/TASK-294-a-android-background`: su Android la corsa registra a
  schermo bloccato, in un servizio con la sua notifica, con «While using»
  (scelta dell'utente: prima del test chiuso). Il conto alla rovescia e la
  pausa per fermo si recuperano dalle posizioni, perché Android ferma i
  timer JS; la linea non si taglia per lo schermo spento. L'impronta iOS
  della build 7 non cambia (`fingerprint.config.js`, 83793e26 prima e
  dopo). Solo app; testi della notifica approvati dall'utente il
  2026-10-23. **PR #543**. La prova su Android vero si fa con la B. Account
  Google Play personale creato dall'utente il 2026-10-25 («Luca
  Pallaoro»), in attesa delle verifiche di Google. **A in `main`** con la
  #543 (`1dfc440e`, 2026-10-25, merge su via dell'utente). Pacchetto
  Android `app.getmuw.android` (scelta dell'utente del 2026-10-25).
  **B** (ADR-0253), branch `feat/TASK-294-b-play-build`: package,
  Firebase, `eas.json`, la build e il test chiuso. **C** (ADR-0253): la
  pagina per cancellare l'account su getmuw.app. File: `tasks/TASK-294.md`.
  **B in `main`** con la #548 (`049102c5`, 2026-10-25). Il 2026-10-26
  l'account Play è verificato, l'app «MuW» è creata e i moduli della
  console sono compilati (scheda, dichiarazioni, Sicurezza dei dati);
  prima build Android (APK `preview`) in corso su EAS. **C** fatta:
  `site/account-deletion/` nelle cinque lingue con test, PR aperta; i
  testi aspettano il sì dell'utente, poi la copia sul server (F.14).
  La prima build Android (`preview`) del 2026-10-26 è fallita in Gradle
  su AdMob: correzione `fix/TASK-294-android-build-no-admob` (#572),
  AdMob mai collegato su Android (aggiunta ad ADR-0237), impronta iOS
  invariata.
  **C in `main`** con la #569 (`4075ef8e`, 2026-10-26), testi approvati
  dall'utente («Sì, 30 giorni»); manca la copia sul server (F.14).
- **TASK-293 — «Send to Strava» senza un blocco del database dentro
  l'altro** (aggiunta ad ADR-0249; seguito di TASK-288 B, numero dal
  Coordinatore il 2026-10-18). Branch `feat/TASK-293-strava-one-block`.
  `send` legge la corsa senza lock, poi il token nel suo blocco (rinnovo
  sempre uno alla volta), poi blocca la corsa per il caricamento come
  prima; un token rifiutato si rinnova fuori dal blocco della corsa. Una
  connessione del pool alla volta, nessuna fuori dal pool. Una sonda su
  `Database.connect` in `test_strava.py` fa fallire ogni blocco annidato;
  due invii della stessa corsa insieme caricano un solo file. Solo API,
  nessuna migrazione; il server dopo Apple, con l'ok dell'utente. File:
  `tasks/TASK-293.md`.
  **Chiuso**: in `main` con la #528 (`aba94894`, 2026-10-19), mergiata
  dal Coordinatore; vedi «Completato».
- **TASK-292 — Scegliere la partenza sulla mappa** (ADR-0252; richiesta
  dell'utente del 2026-10-18, che ha scelto il mirino fisso fra quattro
  proposte). Branch `feat/TASK-292-start-on-map`. Sotto la ricerca di
  «Draw» il link «Choose on the map» apre la mappa con il segnaposto
  fermo al centro; «Start here» rende il punto la partenza (origine
  `map`, senza nome), «←» non cambia niente. Solo app, non nella 1.0;
  due testi nuovi nelle cinque lingue, approvati dall'utente il
  2026-10-19. File: `tasks/TASK-292.md`.
  **Chiuso**: in `main` con la #527 (`b35d461c`, 2026-10-19), mergiata
  dal Coordinatore; vedi «Completato».
- **TASK-291 — Ogni segnalazione arriva per email, con un link che
  nasconde** (ADR-0251; chiesto dall'utente il 2026-10-17 dopo la mail di
  Apple sulla regola 1.2). Solo API: a ogni segnalazione nuova un'email a
  chi gestisce MuW con il link «Hide» (firmato, 7 giorni, una volta, con
  «Undo»); disegni, commenti e iscritti nascosti agli altri, non
  all'autore. Migrazione `0024_hidden_content.sql`. Entra **dopo la
  #502**, poi usa il suo `resend_email.py`; server dopo Apple, con la
  privacy della parte B di TASK-284. File: `tasks/TASK-291.md`.
  **Chiuso**: in `main` con la #525 (2026-10-25, dopo la #502), sul
  «mergia» dell'utente; vedi «Completato».
- **TASK-288 parte B — Il pool di connessioni** (aggiunta ad ADR-0249;
  sì dell'utente del 2026-10-16 al Coordinatore: «sì, aggiungi il pool di
  connessioni»). Branch `feat/TASK-288-b-connection-pool`. Dipendenza
  nuova `psycopg[binary,pool]`: l'API presta da 2 a 10 connessioni tenute
  aperte invece di aprirne una nuova a ogni blocco (due a ogni richiesta
  con un token); ognuna torna come una sessione nuova (`DISCARD ALL`),
  anche dopo un errore; tutte occupate per 10 s danno `503
  accounts_unavailable` con `Retry-After`, non un'attesa senza fine; il
  pool si chiude quando l'API si ferma. In locale `/me` da 63 a 4 ms,
  `/users?q=` da 141–185 a 8–54 ms. Nessuna migrazione, nessun cambio
  all'app né a `compose.yaml`. Merge e server dopo Apple, con l'ok
  dell'utente. **PR #524**. File: `tasks/TASK-288.md`, «Parte B».
  **Chiuso**: in `main` con la #524 (`42699af4`, 2026-10-18), mergiata dal
  Coordinatore su richiesta dell'utente; vedi «Completato».
- **TASK-290 — Le sagome di «PICTURES» che vengono bene in città**
  (aggiunta ad ADR-0246; richiesta dell'utente del 2026-10-16). Branch
  `feat/TASK-290-better-draw-pictures`. Le sagome provate come percorsi
  veri in otto città, a 5 e a 10 km: tolte bici, cuore con freccia, ancora
  e gelato (in città venivano macchie); aggiunte fungo, auto, maglietta,
  paperella, stivale, casa, osso e coppa, scelte fra 29 provate. Sedici,
  le più chiare prima, anche nelle righe di «Draw on the map» e del
  risultato. Solo app e `tools/`; i nomi nuovi nelle cinque lingue
  approvati dall'utente il 2026-10-16. **PR #520**. File: `tasks/TASK-290.md`.
  **Chiuso**: in `main` con la #520 (`ff786f67`, 2026-10-16); vedi
  «Completato».
- **TASK-288 — Le ricerche dell'API più veloci** (ADR-0249, migrazione
  `0022_faster_searches.sql`; dall'analisi delle ricerche del 2026-10-16,
  sessione «MUW app performance e ricerca»). Branch
  `feat/TASK-288-faster-api-searches`. gzip nell'API da 1 KB in su;
  Geoapify chiesto insieme (aree di `/cities`, categorie di
  `/nearby-cities`), 3 s e un secondo tentativo su timeout/429/5xx, mai
  la chiave nei log, nessuna cache per le risposte vuote;
  `draw_examples` richiede un 503 invece di dire «not found»; i download
  delle foto delle città in un pool loro; «Find friends» con `pg_trgm` e
  la foto piccola fatta una volta; il feed e i profili leggono
  l'anteprima di 64 punti che PostgreSQL tiene in `drawings.preview`
  (feed con la posizione da 15 s a 0,75 s a pagina in locale); l'uso
  della sessione scritto una volta l'ora (90 giorni sempre garantiti).
  Stesse risposte, nessuna dipendenza nuova; il pool di connessioni
  (`psycopg_pool`) aspetta un sì dell'utente. Il server lo fa il
  Coordinatore, con l'ok dell'utente. **PR #518**: porta una migrazione,
  ferma come la #502 fino ad Apple e all'ok dell'utente. Il Caddy del
  server non comprime l'API (controllato il 2026-10-16); la domanda sul
  pool la porta il Coordinatore all'utente.
  File: `tasks/TASK-288.md`.
  **Chiuso**: in `main` con la #518 (`2d8b4562`, 2026-10-16), su
  richiesta dell'utente e col via del Coordinatore; vedi «Completato».
- **TASK-287 — La ricerca dei percorsi più veloce, lato app** (ADR-0248;
  dall'analisi della lentezza del 2026-10-16, sessione «MUW app
  performance e ricerca»; le parti del server sono TASK-288 e TASK-289,
  i tempi per fase). Branch `feat/TASK-287-faster-route-search`: una
  sola coda per le richieste di percorso (l'utente prima, poi gli esempi
  sulla pagina di «Explore», poi le forme sull'acqua in anticipo; niente
  in sottofondo mentre gira una richiesta dell'utente; al massimo 22 al
  minuto, 8 sempre dell'utente); un «Draw» annullato sul telefono esce
  dalla coda o fa ripartire la pagina di Python, e il prossimo non
  aspetta; Python parte appena c'è una zona salvata intorno; il chip di
  una città in evidenza non chiede più `/cities`; il campione di un
  paese vicino è già un suo esempio; `city-examples.json` scritto una
  volta per gruppo; `/places` lento lasciato stare 3 minuti. Solo app,
  non nella 1.0. File: `tasks/TASK-287.md`.
  **Chiuso il 2026-10-16**: #517 in `main` (`2259a5df`), mergiata dal
  Coordinatore; vedi «Completato».
- **TASK-289 — I tempi per fase nel log dei percorsi** (ADR-0250;
  dall'analisi della lentezza del 2026-10-16, prepara la misura di
  TASK-276). Branch `feat/TASK-289-phase-times`. Ogni job di percorso
  dell'API scrive una riga `job <id>: times total=… crop=… start=…
  traces=… converged=… wait=… nearby=… directions=…`, senza posizioni.
  L'immagine Docker porta il bytecode dei pacchetti (`compileall`), così
  i processi `spawn` delle partenze vicine non ricompilano il motore.
  Motore non toccato: gli esempi tenuti sul server restano validi. Sul
  server serve un'immagine nuova, dopo Apple e con l'ok dell'utente.
  **PR #515**, aspetta «merge 515». File: `tasks/TASK-289.md`.
  **Chiuso**: in `main` con la #515 (`cd5a4a3f`, 2026-10-16); vedi
  «Completato».
- **TASK-286 — Un'altra figura dalla mappa del risultato** (aggiunta ad
  ADR-0245; scelta dell'utente del 2026-10-15, seguito di TASK-281).
  Branch `feat/TASK-286-change-shape-on-result`. Sotto un percorso
  disegnato, da «Draw» o da «Draw on the map», sopra «Start» la stessa
  riga di 17 forme e 12 immagini della tela (con «Paddle» solo le forme);
  un tocco ridisegna dalla stessa partenza e con la stessa distanza. Da
  «Draw» la figura diventa la scelta di «Draw»; dalla tela prende il posto
  di quella sulla mappa (stesso centro, distanza del percorso) e «Undo» la
  rimette. Solo app, nessun testo nuovo, non nella 1.0; file e ordine con
  l'ok del Coordinatore; **PR #513**, aspetta «merge 513». File:
  `tasks/TASK-286.md`.
  **Chiuso il 2026-10-16**: #513 in `main` (`52b331f7`), mergiata dal
  Coordinatore; vedi «Completato».
- **Prova sull'iPhone del 2026-10-15**: l'utente ha provato `preview`
  (gruppo `9dbc73d0`, da `main` `fd4ae341`) con TASK-278 A e B, 279 A,
  280, 281 e 285 A e B: «funziona tutto ok». Le foto di TASK-283 non si
  vedono ancora: aspettano il server, dopo Apple.
- **Risposte dell'utente del 2026-10-15** (sessione di riepilogo; dette
  anche al Coordinatore): la 1.0.0 (7) è **rimandata ad Apple** con video
  e Notes, in attesa del verdetto (`tasks/TASK-152.md`); i testi
  dell'email di TASK-284 e la privacy **vanno bene** (la parte B può
  partire dopo #461); in TASK-282 la figura messa sulla mappa **può
  essere inclinata** come oggi; seguito di TASK-281: **cambiare figura
  anche dalla mappa del risultato** (numero dal Coordinatore); **ok a
  pubblicare su `preview` tutto `main`** (278 A+B, 279 A, 280, 281, 283
  lato app, 285 A+B), lo fa il Coordinatore. TASK-276 va rispiegato.
- **TASK-284 — L'email di ritorno a chi non apre l'app da 14 giorni**
  (ADR-0244; chiesto dall'utente il 2026-10-11; scelte sue: «a tutti gli
  iscritti», «un interruttore suo, acceso», con la casella non spuntata
  all'iscrizione e il link in ogni email). **Parte A** (API, migrazione
  `0023_away_email.sql`, Resend, pagina per disiscriversi, giro di ogni
  giorno): PR da `feat/TASK-284-return-email`, spenta finché il server non
  ha chiave, segreto e dominio. **Parte B** (Todo, dopo #461): la casella
  all'iscrizione, l'interruttore in «Settings», la privacy nuova e i testi,
  tutti col sì dell'utente. Nessuna email prima di A e B in `main`, app
  pubblicata, approvazione di Apple e chiave di Resend con il dominio
  verificato (lo fa l'utente, `DEPLOY.md` «Email di ritorno»). File:
  `tasks/TASK-284.md`.
  **Parte A in `main`** con la #502 (`263e86db`, 2026-10-25, sul
  «finiscila» dell'utente), migrazione `0023_away_email.sql`; spenta finché
  il server non ha chiave, segreto e dominio. Resta la parte B, dopo #461.
  **Parte B** (2026-10-25, branch `feat/TASK-284-b-app-privacy`): la
  casella non spuntata all'iscrizione, «Email when I'm away» in
  «Settings» e la **privacy unica** (email di ritorno, email delle
  notifiche, segnalazioni, gioco, archivio dei percorsi, push Android,
  Resend), approvata dall'utente («sì alla privacy, va bene così»).
  **Chiuso**: parte B in `main` con la #556 (`3ec54818`, 2026-10-26),
  privacy datata 26 ottobre 2026; vedi «Completato».
- **TASK-285 — Lo stretching dopo la corsa** (ADR-0247; due richieste
  dell'utente del 2026-10-13, unite dal Coordinatore; nessun codice
  ancora). **Parte A**, sessione «Esercizio con stretching opzionale»: a
  fine corsa «Remember to stretch» a schermo e a voce, «Skip» verso «Your
  run» o l'uscita verso lo stretching. **Parte B**, sessione «Animazione
  esercizi stretching post-corsa»: cinque esercizi animati uno dopo
  l'altro, con il conto alla rovescia e il passaggio da sé, «come
  sull'app bEND»; figura e testi nostri, nessuna dipendenza nuova. Solo
  app; A entra prima di B; non nella 1.0. Testi e voce nelle cinque
  lingue con il sì dell'utente. File: `tasks/TASK-285.md`.
- **TASK-285 parte B — I cinque esercizi animati** (ADR-0247, punti
  5–8; sessione «Animazione esercizi stretching post-corsa»). Branch
  `feat/TASK-285-b-stretch-exercises`: da «Stretch» della scheda di A si
  apre la schermata con i cinque esercizi (quadricipite, posteriore
  coscia, polpaccio, flessori dell'anca, gluteo), la figura stilizzata
  che entra in ogni posa, il conto alla rovescia di 20 s per lato, il
  «ding» fra un lato e l'altro, «Pause», «Skip»/«Done»; poi «Your run».
  File nuovi in `src/stretch/`, poche righe in `App.tsx`, le voci nei
  quattro `i18n`, `tools/stretch_chime.py` e `assets/stretch/ding.wav`.
  Il 2026-10-14 l'utente ha approvato i testi nelle cinque lingue e le
  tre proposte (i cinque esercizi a 20 s per lato, il «ding» nostro, la
  figura stilizzata); le pose viste in Expo Go nel simulatore. **Aspetta
  «merge 508»** dal Coordinatore (ordine su `App.tsx` con 278 B). Non
  nella 1.0.
  **Chiuso il 2026-10-15**: #508 in `main` (8295312f); vedi
  «Completato». Pubblica il Coordinatore.
- **TASK-277 — Un contorno che cade su un nodo solo non si disegna, e la
  ricerca va avanti** (aggiunta ad ADR-0040, con rimando ad ADR-0148; da
  un `engine_error` nei log dell'API del 2026-10-10: due cerchi da 5 km su
  una zona di campagna scaricata al volo). Branch
  `fix/TASK-277-collapsed-outline`. Il motore lancia `CollapsedShapeError`
  (uno `ShapeNotDrawableError`) invece di un `ValueError`; la ricerca salta
  quel tentativo, poi cerca entro 2 km, e se niente si traccia risponde
  `shape_not_drawable` con un messaggio chiaro. Ogni altro percorso
  identico; `engine.zip` e `paddleExamples.json` rifatti (solo la
  fingerprint). **Ferma** fino all'approvazione Apple della 1.0 e agli ok
  dell'utente; entra dopo la #489 (TASK-271), e allora i due file si
  rifanno su `main`. Dopo il merge: server, `draw_examples`, pubblicazione
  dell'app (Coordinatore). File: `tasks/TASK-277.md`, «File toccati».
  **Chiuso**: in `main` con la #497 (2026-10-25, «finiscilo»
  dell'utente), dopo la #489; server, `draw_examples` e motore sul
  telefono restano al Coordinatore; vedi «Completato».
- **TASK-283 — Le foto dei paesi in «NEARBY TOWNS»** (ADR-0243; chiesto
  dall'utente il 2026-10-11, «Aggiungere foto delle città»; scelte sue:
  «Solo foto», «Scheda di oggi» senza foto, credito «Piccolo sulla
  foto»). Codice in `main` con la #499. Ogni paese che ha
  un'immagine su Wikidata con licenza libera mostra la foto al posto di
  mappa e cuore, con «© autore · licenza» in piccolo; senza foto la scheda
  di prima. Le foto le prende e le tiene l'API (`GET /city-photos/…`): a
  Wikimedia vanno solo gli elementi, mai la posizione, e il telefono non
  chiede niente a Wikimedia. Provato nel simulatore intorno a Moreda: sei
  paesi su sei con la foto. **Resta: server** (lo aggiorna il
  Coordinatore dopo l'approvazione di Apple e con l'ok dell'utente, e
  controlla che `data/cache/city_photos/` stia sul volume); fino ad
  allora l'app mostra le schede di prima. File: `tasks/TASK-283.md`.
- **TASK-285 parte A — «Remember to stretch» a fine corsa, con «Skip»**
  (ADR-0247; chiesto dall'utente il 2026-10-13: «Finito l'esercizio, puoi
  dire all'inizio "ricordati di fare stretching" e dai la possibilità di
  skipparlo»). Branch `feat/TASK-285-a-stretch-reminder`: la scheda
  `StretchReminder.tsx` con la frase della voce nelle cinque lingue è
  scritta e testata, `App.tsx` collegato (ok del Coordinatore), i test
  dell'app della corsa libera e della corsa riaperta premono «Skip» dopo
  «Stop». Testi approvati dall'utente il 2026-10-13; **in `main` con la
  #504 (8cdadf70, 2026-10-14)**. Non provata nel simulatore (nessun tocco
  possibile): da vedere alla prima corsa vera. «Stretch» per ora chiude
  come «Skip», finché non c'è la parte B. La parte B (gli
  esercizi animati) è della sessione «Animazione esercizi stretching
  post-corsa», che scrive `tasks/TASK-285.md`.
- **TASK-278…282 — Cinque richieste dell'utente del 2026-10-11 su
  «Explore» e «Draw»** (numeri dal Coordinatore; task file scritti dalla
  sessione «Explore e Draw: profilo e disegno mappa», nessun codice
  ancora). Ognuno parte nella sua sessione, col via del Coordinatore;
  le scelte dell'utente già fatte sono nei task file.
  - **TASK-278** — il proprio profilo come quarta pagina dopo «Explore»;
    in alto tre nomi più il cerchio, che si illumina (scelta
    dell'utente). Solo app: può partire subito.
    **Fatto il 2026-10-13**, branch `feat/TASK-278-profile-page`; vedi
    «Completato».
    **Parte B** (scelte dell'utente del 2026-10-13): cuore, «Save» e lente
    senza account e il proprio nome taggato portano alla quarta pagina; il
    profilo di un altro torna con «←» dov'era. Branch
    `feat/TASK-278-b-profile-entry-points`; vedi «Completato».
  - **TASK-279** — parole con la penna alzata negli esempi di una città
    in «Explore» (parte A, solo app: l'API tiene già le parole chieste
    dal centro), poi frasi con lo spazio (parte B, motore, dopo Apple).
    **Parte A: PR #503** (2026-10-13, aggiunta ad ADR-0144), branch
    `feat/TASK-279-a-explore-words`. Dopo le otto forme una città scrive
    CIAO, LOVE, AMORE, RUN, HELLO, MUW (scelte dell'utente) con la penna
    alzata, ognuna alla distanza minima, 3 km a lettera (scelta
    dell'utente: a 5 km l'API rifiuta le parole), nella riga «WORDS»
    (testo approvato nelle cinque lingue). Aspetta il «merge 503» del
    Coordinatore; non nella 1.0; pubblica il Coordinatore. Resta la parte
    B e, facoltativo, `draw_examples` con le parole (punto 7, dopo Apple).
  - **TASK-280** — sotto «Draw», le righe «CITY TOURS» (i giri a tema) e
    «PICTURES» (sagome pronte). Solo app: può partire subito.
    **Fatto il 2026-10-13** (ADR-0246), PR in attesa del merge del
    Coordinatore dopo la #500; vedi «Completato».
  - **TASK-281** — «Draw on the map»: disegnare, mettere e trascinare
    forme e immagini sulla mappa della città, e cambiarle senza uscire.
    Solo app; il motore parte da dove è stata messa la figura.
    **Fatto il 2026-10-14** (ADR-0245), PR in attesa del merge del
    Coordinatore dopo la #504 e 278 B; vedi «Completato».
  - **TASK-282** — il percorso proprio dove la figura è stata messa
    (`near` a piedi): motore, dopo l'approvazione di Apple e TASK-281.
  278, 280 e 281 toccano `App.tsx`, 280 e 281 anche `ChooseScreen.tsx`:
  l'ordine lo dà il Coordinatore. File: `tasks/TASK-278.md` … `TASK-282.md`.
- **TASK-276 — Più percorsi all'ora sullo stesso server** (ADR-0242
  riservato; chiesto dall'utente il 2026-10-11). **Aspetta
  l'approvazione di Apple della 1.0**. Poi, con l'ok dell'utente e il via
  del coordinatore, circa 10 minuti di misura sul server: CPU per
  percorso, percorsi al minuto con più richieste insieme, RAM per
  processo. Con quei numeri l'utente sceglie se e come farne di più.
  Sul Mac ogni percorso usa già altri core per le partenze vicine
  (ADR-0071): i loro processi consumano circa il doppio della CPU del
  job. Un pool di processi da solo darebbe quindi al massimo +33%.
  File: `tasks/TASK-276.md`.
- **TASK-272 — La corsa interrotta si riapre in pausa** (ADR-0240; dalla
  prima recensione di un tester del 2026-10-10, scelta dell'utente «Riapre
  la corsa in pausa»). Branch `feat/TASK-272-reopen-interrupted-run`. Se
  l'app si chiude durante una corsa, riaprendola entro 2 ore si apre la
  corsa in pausa, sullo stesso percorso con la traccia fin lì: «Resume» o
  «Stop» tenuto; il tempo chiusa è una pausa. Il file della corsa tiene
  ora anche indicazioni, parola e tratti a piedi. Anche la corsa senza
  percorso. Più vecchia di 2 ore, la fine della corsa come prima. Solo
  app, nessun testo nuovo; pubblica il coordinatore.
  File: `tasks/TASK-272.md`, «File toccati».
  **Chiuso con la #492** (dopo il taglio della build 6); vedi «Completato».
- **TASK-273 — Una forma chiusa si comincia da qualunque punto** (ADR-0241;
  dalla prima recensione di un tester del 2026-10-10, scelta dell'utente
  «Automatico, dove la tocchi»). Branch `feat/TASK-273-start-anywhere`, da
  `main` con la #486. Lungo una forma chiusa la corsa comincia dove il
  corridore raggiunge la forma, fa tutto il giro e finisce lì; la voce dà
  le svolte da quel punto. Parole e forme aperte come prima. Solo app,
  nessun testo nuovo, non nella 1.0; tocca `navigator.ts`, `progress.ts`,
  `useNavigation.ts` come TASK-272: l'ordine lo dà il Coordinatore.
  File: `tasks/TASK-273.md`, «File toccati».
  **Chiuso con la #493** (dopo la #492); vedi «Completato».
- **TASK-271 — «Make a U-turn» anche fuori dagli incroci** (aggiunta ad
  ADR-0045; dalla prima recensione di un tester del 2026-10-10). Branch
  `fix/TASK-271-dead-end-u-turn`. Prima, tornando indietro in fondo a un
  vicolo cieco o su un nodo con due strade, la voce taceva: `directions()`
  saltava ogni nodo con meno di 3 strade. Ora lì si dice `"u-turn"` quando
  il percorso torna al nodo da cui è arrivato; le altre curve fuori dagli
  incroci restano in silenzio. Solo motore, nessun testo nuovo. Dopo il
  merge, con l'ok dell'utente: server, `draw_examples`, motore sul
  telefono; i percorsi già in cache tengono le indicazioni vecchie. Non
  nella 1.0. File: `tasks/TASK-271.md`, «File toccati».
  **Chiuso**: in `main` con la #489 (2026-10-25, «ok finiscilo»
  dell'utente); server, `draw_examples` e motore sul telefono restano al
  Coordinatore; vedi «Completato».
- **TASK-262 C — Amici dalla rubrica** (ADR-0226; scelta dell'utente del
  2026-10-08, che è il suo sì a `expo-contacts` e alla ricerca per hash).
  Branch `feat/TASK-262-c-contacts`. **App fatta**: in «Find friends»,
  sotto la ricerca per nome, «Find friends in your contacts»; il permesso
  solo al tocco, i numeri in E.164 con la regione del telefono, SHA-256,
  500 per richiesta, e gli iscritti trovati con «Follow». **API scritta**
  (`contact_people.py`, `POST /people/from-contacts`; gli hash non si
  tengono, provato da un test su database e log; 30 richieste all'ora per
  account; i bloccati mai, nei due versi): **entra dopo TASK-121**, di cui
  usa `apart_sql`. Privacy nuova del 9 ottobre 2026 nelle cinque lingue,
  con le pagine del sito rigenerate. **Aspetta**: «121 in main», poi il
  merge di #451 (262 A), poi il sì dell'utente su testi e privacy, poi
  «merge NNN»; il server con l'ok dell'utente, dal coordinatore.
  File: la PR, «File toccati» (la sezione C di `tasks/TASK-262.md` dopo
  il merge di A).
  **Aggiornamento 2026-10-10**: API in (dopo 121), provata nel simulatore,
  ADR-0226 aggiunta e sezione C del task file scritte, privacy del 10
  ottobre approvata dall'utente. **PR #461 pronta e ferma** per scelta del
  coordinatore fino all'approvazione di Apple della 1.0; poi «merge 461»,
  server, sito, preview, e la 1.0.1 nativa. Come riprendere: «Dove si è»
  in `tasks/TASK-262.md`, parte C.
  **Aggiornamento 2026-10-25**: `main` unito di nuovo, privacy datata 25
  ottobre 2026, test verdi. **Ferma sull'impronta**: `expo-contacts` porta
  l'impronta iOS da `83793e26` (la 1.0) a `9337973a`; l'utente sceglie
  quando unirla (con la 1.0.1, subito, o subito con `expo-contacts` escluso
  dalla build nativa, che tiene `83793e26`). «Dove si è (2026-10-25)» nel
  task file.
  **Chiuso con la #461** (scelta dell'utente: la terza); vedi «Completato».
- **TASK-270 — Dopo un'assenza del GPS il navigatore ritrova il percorso**
  (aggiunta ad ADR-0052; dalla prima recensione di un tester del
  2026-10-10). Branch `fix/TASK-270-navigator-rejoin`. Prima, con l'app
  dietro un'altra per più di 300 m di corsa, il navigatore restava «fuori
  percorso» fino alla fine. Ora, dopo 20 s senza posizioni, il corridore
  si cerca su tutto il percorso avanti e si riprende da lì dopo due
  posizioni. Solo app, nessun testo nuovo.
  File: `tasks/TASK-270.md`, «File toccati».
  **Chiuso il 2026-10-10**: #486 in `main` (`0a589ddd`); vedi «Completato».
- **TASK-245 parte C — 38 posti di mare in più per «Paddle»** (ADR-0210,
  aggiornamento; posti scelti dall'utente il 2026-10-09 sulla proposta
  dell'agente). Branch `feat/TASK-245-c-more-beaches`. `PLACES` da 29 a 67
  paesi, `beaches.json` da 29 a 67 righe: **tutti a 2 km**, nessuno
  scartato. **Aspetta**: l'ok dell'utente e il via del coordinatore per i
  **38 file d'acqua nuovi (20,3 MB)** sul server, in
  `data/cache/water/` senza sovrascrivere (ora in
  `.claude/worktrees/TASK-245-C/out/task245c-beaches/new/water/` sul Mac);
  poi il merge, un solo `draw_examples --water` e la pubblicazione
  dell'app, mai prima dell'acqua. File: `tasks/TASK-245.md`, «parte C».
  **2026-10-10: l'acqua è sul server** (38 file, 20,3 MB, SHA-256 uguali,
  provata nel container; ok dell'utente). Aspetta il merge della #480.
  **Chiusa** il 2026-10-10: #480 mergiata (`793fa11`); vedi «Completato».
- **TASK-261 parte B — La voce a telefono bloccato** (aggiunta ad
  ADR-0225; scelte dell'utente del 2026-10-10). Branch
  `feat/TASK-261-b-voice-background`. Durante la corsa la voce parla a
  telefono bloccato e col silenzioso e abbassa Spotify mentre parla
  (`runAudio.ts`, dipendenza nuova `expo-audio`, `UIBackgroundModes`
  `audio`). PR #475. Serve una build nativa nuova (obiettivo: build 5);
  il testo nuovo del microfono approvato dall'utente il 2026-10-10.
  File: `tasks/TASK-261.md`, «File toccati (parte B)».
  **Chiuso il 2026-10-10**: #475 in `main` (`d10df4a5`); vedi «Completato».
- **TASK-269 — «Paddle»: laghi e mare vicino a dove si vive, con
  «Lakes» / «Sea»** (`feat/TASK-269-paddle-places-near-home`, ADR-0239;
  richiesta dell'utente del 2026-10-09, il come deciso dall'agente su
  delega). La fila dei posti parte dalla zona di casa calcolata sul
  telefono dalle attività, con «Show more» e la riga «Suggested near …»;
  due chip filtrano laghi o mare; le forme già sul telefono seguono la
  stessa zona. Solo app, non nella 1.0. Testi approvati dall'utente il
  2026-10-10; la frase della privacy sulla zona di casa è nell'app e in
  `site/privacy/` (dopo «451 in main»). Dopo il merge: copia del sito
  (F.14) e pubblicazione del coordinatore.
  File: `tasks/TASK-269.md`, «File toccati».
  **Chiuso il 2026-10-10**: #482 in `main`; vedi «Completato».
- **TASK-267 — Annunci spenti nella build dello store**
  (`feat/TASK-267-store-without-ads`, ADR-0237): la 1.0 senza pubblicità,
  scelta dell'utente del 2026-10-09. Con `APP_VARIANT=production` il codice
  nativo di AdMob non entra nella build (`react-native.config.js`); il Feed
  ha solo i post. Preview ed Expo Go come prima. TASK-153 (annunci veri)
  aspetta la società dell'utente.
  **Chiuso il 2026-10-10** (#469, #474): voce in «Completato».
- **TASK-268 — Su «Data» «Map» e «Pause» restano sullo schermo**
  (aggiunta ad ADR-0137; dalla corsa su strada dell'utente del
  2026-10-09). Branch `fix/TASK-268-run-data-page`. Con l'indicazione in
  alto la pagina «Data», che non scorreva, spingeva pulsanti e «Map» sotto
  il bordo. Ora scorrono solo i numeri, fra l'indicazione e i pulsanti
  fissi. Solo app, nessun testo nuovo. La voce che si ferma a telefono
  bloccato o con Spotify davanti è TASK-261 parte B.
  File: `tasks/TASK-268.md`, «File toccati».
  **Chiuso il 2026-10-10**: #472 in `main` (`0a07f757`); vedi «Completato».
- **TASK-246 parte B — Il server tiene le figure «Paddle» dei laghi e
  delle spiagge** (aggiunta ad ADR-0211; via del coordinatore il
  2026-10-09). Branch `feat/TASK-246-b-water-shapes-kept`. L'API legge
  all'avvio i punti di `lakes.json` e `beaches.json` (`water_spots.py`,
  copiati nell'immagine dal `Dockerfile`) e tiene i percorsi dal punto
  stesso in `routes/water/` (limite suo di 10 000); `draw_examples
  --water` li disegna prima. L'app non cambia. Sul Mac le 24 forme di un
  telefono nuovo a Levico: 11 s di motore la prima volta, 0 s dopo; il
  giro di tutti i punti sul server, stimato, 4–8 ore.
  PR #462, merge chiesto dall'utente al verde (2026-10-09), non aspetta
  TASK-245 C. **Resta**: server e `draw_examples --water` con l'ok
  dell'utente, dal coordinatore.
  **Chiuso** il 2026-10-09: in `main` dalla #462 (vedi «Completato»).
  File: `tasks/TASK-246.md`, «File toccati (parte B)».
- **TASK-251 parte C — In bici senza percorso, la velocità** (aggiornamento
  di ADR-0215; scelta dell'utente del 2026-10-08). Branch
  `feat/TASK-251-c-free-ride-speed`. Con «Bike» in «Settings» «Ride without
  a route» mostra «Speed now», «Avg speed», «Last km» e i km in km/h (mph
  con le miglia), sulla scheda e a fine corsa, come un percorso in bici;
  nessun testo nuovo. La voce resta quella della corsa (da decidere
  dall'utente). Solo app: pubblica il coordinatore.
  File: `tasks/TASK-251.md`, «File toccati», parte C.
  **Done** il 2026-10-09: in `main` con la #458 (`fb27b50d`), vedi
  «Completato».
- **TASK-092 — «Recommended» in «Explore»** (ADR-0229; criterio lasciato
  all'agente dall'utente il 2026-10-07). Branch
  `feat/TASK-092-recommended-routes`. **API e app fatte** nel branch:
  `GET /recommended` (`best_routes.py`, token obbligatorio, nessuna
  migrazione) ordina i percorsi del catalogo entro 5 km: somiglianza come
  la scheda la scrive, poi reazioni dei disegni pubblicati, poi corse e
  preferiti; a parità tutti. In «Explore» la riga «RECOMMENDED» sopra le
  schede, solo con un account. Il testo nuovo nelle cinque lingue è
  **confermato dall'utente** (2026-10-08, «ok continua»; es
  «RECOMENDADAS» al femminile come «rutas»). PR #445. **Aspetta**: la coda
  dei merge; dopo il merge il server (`best_routes.py`, ok dell'utente,
  coordinatore) e la pubblicazione dell'app, che può uscire prima: senza
  `/recommended` la riga non c'è e «Explore» resta com'è.
  File: `tasks/TASK-092.md`, «File toccati».
  **Chiuso**: in `main` con la #445 (`48ba5912`, 2026-10-08); vedi
  «Completato».
- **TASK-265 — Il dominio getmuw.app** (ADR-0234; scelta dell'utente del
  2026-10-08). L'utente voleva spostare «il sito» su un'azienda tedesca;
  saputo che il sito non era online e che Hetzner è già tedesca, è
  **rimasto su questo server** e ha **comprato `getmuw.app`** su Porkbun.
  I tre record `A` (`@`, `www`, `api`) puntano al server. **L'API risponde
  su `https://api.getmuw.app`** dal 2026-10-08 (Caddyfile applicato dal
  Coordinatore con l'ok dell'utente; certificato Let's Encrypt fino al
  2027-01-06, si rinnova da solo) accanto a `sslip.io`, che resta.
  `getmuw.app` e `www` sono per il sito (TASK-237). Come si fa:
  `DEPLOY.md`, F.14. Il ritorno da Strava resta su `sslip.io`.
  `tasks/TASK-265.md`. **Done** il 2026-10-08: l'app di `preview` chiama
  `https://api.getmuw.app` dal gruppo `a39c9509` (vedi «Completato»).

- **TASK-262 — Le notifiche inviate davvero** (ADR-0226; scelte
  dell'utente del 2026-10-07). **Parte A, le push**, branch
  `feat/TASK-262-a-push`: tabella `push_tokens` (migrazione `0021` al
  merge), `PUT`/`DELETE /me/push-token`, invio con Expo fuori dalla
  richiesta, token morti cancellati; nell'app `expo-notifications`
  (dipendenza nuova), il permesso solo all'interruttore, il token una
  volta per telefono, il tocco che apre disegno o profilo; i ganci in
  `follows.py`, `reactions.py`, `comments.py`, `drawings.py` e i blocchi
  di TASK-121. Testi approvati dall'utente nelle cinque lingue. Le push
  si vedono solo con una build nativa. Parti B (email, Resend) e C
  (rubrica, con un nuovo sì) Todo. Da dove riprendere:
  `tasks/TASK-262.md`.
  **Parte A chiusa il 2026-10-10** (PR #451, merge `578c2f7e`): vedi
  «Completato». Restano B e C.
  **Task chiuso il 2026-10-26**: C con la #461, B con la #550; vedi
  «Completato».
- **TASK-152 — MuW sull'App Store** (ADR-0233). **Parte A** in `main`
  il 2026-10-08 (PR #446, merge `9dcacbf4`; chiesta dall'utente): profilo `production` in `eas.json`,
  canale `production`. Solo la build dello store ha il runtime dal
  `fingerprint` (`app.config.ts` con `APP_VARIANT=production`): un update
  fatto dopo un cambio nativo non le arriva. Expo Go e `preview` restano
  su `exposdk:57.0.0`, `app.json` non cambia. Come pubblicare per lo
  store: `DEPLOY.md` A.7. **Aspettano l'utente**: l'account Apple
  Developer e le cinque domande del task; prima della prima build, le
  variabili dell'ambiente EAS `production` (oggi vuoto). Da dove
  riprendere: `tasks/TASK-152.md`, «Esito».
  **Parte B** (2026-10-10): build 5 (1.0.0, `793fa112`, runtime
  `83793e26…`) inviata in revisione ad Apple dall'utente; scheda, screenshot
  e privacy su App Store Connect. Resta l'esito di Apple e l'uscita
  manuale.
  **Chiuso il 2026-10-28**: Apple ha approvato la 1.0.0 (7), che è
  sull'App Store; server, OTA `production` e 1.0.1 con il sì
  dell'utente, uno per volta (`tasks/TASK-152.md`, «Esito»).
- **TASK-237 — Il sito web** (ADR-0201; chiesto dall'utente il
  2026-10-05). Una pagina statica in `site/`, senza dipendenze. **Parte
  A** in `main` (PR #325, `f8e68b6`): la pagina con «Merch». **Parte A2**
  in `main` (PR #335, merge `8f23ff4`, 2026-10-05), dopo la seconda
  richiesta dell'utente («per intanto
  solo il sito che spiega come usare l'app… futuristico… selezionare lo
  sport… i post migliori, una decina»): la pagina è la **guida dell'app**.
  «Try it» disegna il percorso vero di Milano per la forma e la distanza
  scelte; «How it works» cambia fatti e passi con lo sport («Run»,
  «Bike», «Paddle»); «Best drawings» mostra dieci disegni dai dati
  dell'app, con un filtro; «Get the app» dice «Download — coming soon»
  finché `site/config.js` non ha il link. **Il merch è messo da parte**: i
  file restano, la pagina non lo mostra. **Niente è pubblicato.** Lo
  sport da scegliere e i dieci disegni sono **confermati dall'utente**
  (2026-10-05); **da confermare** restano i testi. **Aspettano l'utente**: il link dell'App Store
  (TASK-152), dominio e pubblicazione, e per il merch il servizio di
  stampa, magliette e prezzi. Come si cambia e come si guarda:
  `SITO.md`. Da dove riprendere: `tasks/TASK-237.md`, «Esito».
  **Parte A3** in PR (2026-10-08, «fai il sito web per il nuovo nome e
  aiutami a metterlo online»): il sito dice **MuW**, con il cuore su
  giallo e la scritta nuova; via il punteggio, aggiunto «Feed». **Messa
  online** (parte C): aspetta la scelta dell'utente su dove.
  Poi, lo stesso giorno: **testi confermati dall'utente** («i testi
  vanno bene così»); online sul server Hetzner con `getmuw.app`, scelta
  dell'utente: Caddy e DNS di TASK-265, sul server il Coordinatore.
  **Online su https://getmuw.app dal 2026-10-08** (parte A3 in `main`
  con la #443, `d7f53269`; copia sul server di `DEPLOY.md` F.14, ok
  dell'utente): da ripetere dopo ogni merge che cambia `site/`. Restano
  dell'utente il link per scaricare l'app (dopo l'App Store, TASK-152) e
  il merch.
  **Parte D** in PR (2026-10-08): la pagina della privacy,
  `getmuw.app/privacy/` in cinque lingue, scritta dal testo «Privacy»
  dell'app, ora **definitivo** con le scelte dell'utente (titolare Luca
  Pallaoro, email muw2610@gmail.com, basi giuridiche, 8 ottobre 2026) e
  la frase sulla posizione a telefono bloccato (TASK-261). Il link per
  scaricare arriva con la prima build TestFlight (scelta dell'utente).
  **Online dal 2026-10-09**: https://getmuw.app/privacy/ (copia F.14 da
  `main` `89287a0a`, ok dell'utente), app su `preview` (gruppo
  `20590b72`). La frase precisata sul punteggio, approvata dall'utente,
  era rimasta fuori dal merge: entra con una PR a parte, poi di nuovo
  copia F.14 e pubblicazione.
  **Parte E** in PR (2026-10-09): la pagina di assistenza
  `getmuw.app/support/` in cinque lingue (come scriverci e tre domande),
  per il Support URL dell'App Store; testi approvati dall'utente («Sì,
  va bene»).
  **Online dal 2026-10-09** (#467, `b19ab890`, copia F.14): restano
  dell'utente solo il link TestFlight e il merch.
  **Parte F** (2026-10-28, branch `feat/TASK-237-download-link`): il
  link per scaricare porta all'App Store
  (`https://apps.apple.com/app/id6820961883`), «Get the app» dice «On
  iPhone, now.». Dopo il merge: la copia F.14 sul server, con il sì
  dell'utente. Resta il merch.
  **Online dal 2026-10-28**: #614 in `main` (`0ddb6c4a`), copia F.14
  da quel commit (sì dell'utente: «Sì, pubblica»); su
  https://getmuw.app i due tasti portano all'App Store.
- **TASK-223 — Emoji semplici per il catalogo, e la penna alzata nelle
  forme** (ADR-0185; chiesto dall'utente il 2026-10-03). **Parte A, il
  motore**, in `main` (#284): le forme possono avere `pieces`, e gatto,
  pesce, teste e zucca staccano gli occhi con la penna alzata (`lift`).
  Giudizio dell'utente sui campioni: «sì» faccina, fantasmino e ciambella
  con la penna alzata, sole con la penna giù. **Parte B, il catalogo**,
  in `main` con la #296 (09c2c3c, 2026-10-04, dopo il «continua e
  pubblica» dell'utente): le quattro forme nel motore, nel
  contratto, nell'AI e nell'app (tessere 🙂 👻 🍩 ☀️); `pen_up` anche con
  una forma a pezzi (`PEN_UP_SHAPES`), solo su strada; nell'app
  «Lift the pen between parts», acceso di partenza, per le prime tre; la
  voce «Part done. Walk to the next part…» nelle cinque lingue; fino a 8
  tratti a piedi. Sul server da `main` 3b6e821 (2026-10-05), su
  `preview` dal gruppo `9585ffac` (2026-10-06). **Occhi staccati su strada**:
  sì a tutte e cinque le forme (gatto, pesce, teste, zucca; utente,
  2026-10-05, `samples/LOG.md`); l'interruttore in «Draw» anche per loro è
  un seguito di TASK-226 B. La voce fra i pezzi, la penna alzata accesa di
  partenza e i testi dello schermo sono **confermati dall'utente** in
  inglese e italiano (2026-10-05); tedesco, spagnolo e francese da
  confermare; la prova sul telefono è dell'utente. **Done** il
  2026-10-07: i seguiti senza numero sono in `tasks/TASK-223.md`, «Esito».
- **TASK-122 — L'API e il database sempre accesi** (ADR-0123): il server
  Hetzner gira su `deploy/compose.yaml` con il database e la copia
  notturna dal 2026-10-02 (07:27Z, 18 s di API ferma); iscrizione,
  cancellazione e ripristino provati dal vivo. Le copie fuori dal server
  vanno in uno Storage Box Hetzner (scelta dell'utente; il servizio
  `offsite` è in `main` dalla PR #167): manca che l'utente lo crei
  (`DEPLOY.md` F.13). Sessione «Sistema di auto-miglioramento ricerca»; da
  dove riprendere: il task file.
  **Done** il 2026-10-25: vedi «Completato».
- **TASK-190 — Percorsi in bici** (ADR-0153): **parte A, il motore**, in
  `main` (PR #214): la rete `bike` (ciclabili e strade fino alle
  `primary`, mai scale, `trunk` né vie vietate alle bici, sensi unici
  rispettati), la cache `bike_*` accanto ai `foot_*`, `cycling` di 10–30 km
  nel motore e nella CLI. **Parte B, l'API**, in `main` (PR #219,
  2026-10-02 20:10Z): `cycling` nel contratto (`shared-types`, anche
  `DISTANCE_LIMITS_M`), ogni richiesta sulle zone della rete della sua
  attività (una zona della bici in memoria, due a piedi come prima), fuori
  da 10–30 km un `invalid_request` che dice i limiti, le foto in bici, la
  distanza suggerita nei limiti, e `prefetch_zones --activity cycling
--extract` per zone della bici di 26 × 26 km (stima 0,15–0,6 GB in
  memoria ciascuna). La corsa non cambia. **Parte C, l'app** (assegnata il
  2026-10-02 sera), PR #221, in `main` dal 2026-10-02 20:36Z: «Bike» si
  sceglie in «Settings» e vale subito; con «Bike» «Draw» chiede `cycling`
  fra 10 e 30 km (parole fino a 8 lettere, «Ride without a route»); con
  «Run» le richieste sono quelle di prima, byte per byte. Due testi da
  confermare con l'utente («Ride without a route», «At most 8 letters.»).
  **Aspettano l'utente**: le due «Domande aperte» del task file (fino alla
  risposta «Explore», «Feed» e la schermata della corsa restano come oggi
  anche con «Bike»); l'ok per la prova sul server (Trento, comandi nel task
  file) e poi per pubblicare l'app, in quest'ordine (un'API senza la parte
  B rifiuta `cycling`). Da provare sull'iPhone. **I campioni** (2026-10-03,
  dal Mac: Overpass ha risposto per quattro download, poi ha rifiutato di
  nuovo): cinque a Trento, cuore, cerchio e stella a 10 e 20 km, giudicati
  dall'utente: tre «quasi» e le due stelle «no», «va bene ma migliora».
  Mancano il cerchio da 20 km, Levico e Padova, quando Overpass riapre. Il
  miglioramento delle forme in bici è TASK-206, qui sotto. Da dove
  riprendere: il task file, «Esito», «I campioni».
  **Chiuso il 2026-10-25**: Levico, Padova e il cerchio da 20 km giudicati
  dall'utente, la prova sul server del 2026-10-03 scritta nel task file;
  la voce è in «Completato».
- **TASK-232 — Forme inclinate fino a 45°, con la mappa girata**
  (ADR-0195; Todo, chiesto dall'utente il 2026-10-05): il motore inclina
  ogni forma fino a ±45° quando segue meglio le strade (oggi ±15°,
  ADR-0038), il risultato dice di quanto (`rotation_deg`), e l'app gira
  la mappa perché il disegno si veda dritto. Parte A (motore e API) dopo
  TASK-226, parti B e C (app, corse salvate) dopo TASK-119 B. Scelto
  dall'utente: una freccia del nord che rimette il nord in alto, e
  durante la corsa la mappa resta girata come il disegno, con le linee
  del percorso fatto e da fare (TASK-224) che girano con lei.
  **Parte A** (motore e API) in `main` dalla #356 (`799071a`): prima la ricerca di sempre
  entro ±15°, poi, solo se non dà un percorso buono, inclinata fino a 45°
  con 10 tracciamenti in più; anche in canoa. Su 129 percorsi 110
  identici (i 12 di riferimento tutti), 19 inclinati di 20–45°, i buoni da
  65 a 67, tempo +10% (`MAPS.md`, «Forme inclinate»). `rotation_deg` nel
  risultato e nell'API; `route_store` conserva anche `better_distance_m`
  (seguito di TASK-234). I 19 campioni giudicati dall'utente il
  2026-10-05: 17 `sì` e 2 `quasi`, nessun `no` (`samples/LOG.md`).
  Non ancora sul server: l'aggiornamento e `draw_examples` li fa il
  coordinatore, con l'ok dell'utente («ok server per le forme
  inclinate»). Prossimo passo: le parti B e C (la mappa girata nell'app),
  in un contesto pulito, dopo aver sentito il coordinatore; non si
  pubblicano prima del server. `tasks/TASK-232.md`.
  **Parte B** (sola app, in `main` dalla #378, `44f17c8`, il 2026-10-06;
  la freccia e i tre testi confermati dall'utente; la pubblica il
  coordinatore): un percorso
  disegnato in «Draw» che il motore ha inclinato gira la mappa dall'altra
  parte, così il disegno si legge dritto; ogni tessera «A · B · C» la sua
  inclinazione; la mappa resta girata mentre lo si corre e a fine corsa.
  Con la mappa girata c'è la freccia del nord, a destra sotto il «←» (in
  corsa sotto il riquadro della svolta): un tocco rimette il nord in alto,
  un secondo rigira la mappa come il disegno; compare anche quando la
  mappa è girata con due dita. «Move the shape» sposta giusto anche a
  mappa girata. Tre testi nuovi per VoiceOver nelle cinque lingue. Visto nel browser sulla pagina vera e nel simulatore
  (`out/task-232b/`); manca il dito vero. Prossimo passo: la **parte B2**
  («Explore»: l'esempio aperto, la sua corsa e le schede, che usano le
  foto-mappa del «Feed»), poi la C; il server ha già la parte A.
  **Parte B2** (sola app, in `main` dalla #384, `b2d7662`, il
  2026-10-06; pubblicata su `preview` dal coordinatore lo stesso giorno,
  da `cdb50bb`, gruppo `8429fea6`): un esempio di «Explore» che il motore ha
  inclinato si apre con la mappa girata e la freccia del nord, ogni
  tessera la sua inclinazione, e resta girato in corsa e a fine corsa; la
  sua scheda è girata allo stesso modo, linea e foto-mappa. Lo dicono gli
  esempi disegnati per un posto (città, paesi vicini, acqua); restano col
  nord in alto i percorsi del catalogo dell'API, gli esempi tenuti sul
  telefono da prima, quelli sull'acqua che arrivano con l'app e i
  preferiti. Visto nel browser sulla pagina vera delle foto-mappa con
  quattro campioni inclinati, e nel simulatore a Levico (la luna a 30°:
  scheda, mappa, freccia, tessere, corsa; «Move the shape» sul lago con la
  mappa girata; `out/task-232b2/`); non sul telefono. Visto lì, di prima
  della B2: appena aperto, un esempio è inquadrato come se la mappa fosse
  alta tutto lo schermo e la metà bassa resta sotto la scheda finché non si
  tocca una tessera (anche con la stella, dritta): un seguito. Prossimo
  passo: la **parte C** (corse
  salvate, preferiti, «Feed», post: una migrazione; e `rotation_deg` nel
  catalogo dell'API e in `paddleExamples.json`, punti 4 e 5 nel task
  file), in un contesto pulito, dopo aver sentito il coordinatore.
  **Parte C** (API e app, in `main` dalla #395, `f41eaea`, il 2026-10-06;
  **migrazione `0018`**: il server e la pubblicazione dell'app li fa il
  coordinatore con l'ok dell'utente; l'app regge un'API senza il campo): le corse salvate e i preferiti tengono `rotation_deg`
  come l'app l'ha mandato (`runs.route_rotation_deg`,
  `favorites.rotation_deg`; `null` per le righe di prima, che restano col
  nord in alto); «My activities», il disegno nel profilo, il post da
  condividere e la scheda di un preferito si vedono girati dall'altra
  parte (percorso e traccia insieme, `fitLines` con un `bearing`), e un
  preferito inclinato si apre con la mappa girata; il disegno visto dagli
  altri (`Drawing`) dice l'inclinazione. I due seguiti della B2: il
  catalogo dell'API risponde `rotation_deg` (`0` finché i file delle città
  non si ridisegnano; `seed_catalog` lo scrive) e gli esempi sull'acqua
  nell'app rifatti con l'acqua del Mac (25 su 32 inclinati di 5–15°,
  percorsi identici): i quattro disegni sull'acqua del «Feed» girano. Un'API
  precedente rifiuta il campo e l'app rimanda senza. Visto solo nei test
  (API in PostgreSQL, app con jest); non nel simulatore né sul telefono.
- **TASK-211 — Seguire con richiesta** (ADR-0173; scelte dell'utente del
  2026-10-03: seguire vuole una richiesta, gli iscritti si cercano per
  nome). **Parte A, l'API**, in `main` dal 2026-10-03 (PR #256,
  migrazione `0011`): `GET /users?q=` cerca per nome (almeno 2
  caratteri, al più 20, mai sé stessi: nome, foto a 128 px, `public_id`,
  mai l'email); chiedere, ritirare, smettere, accettare, rifiutare,
  togliere; gli elenchi `/me/followers`, `/me/following`,
  `/me/follow-requests` a pagine; `PublicProfile` con `followers`,
  `following` e `follow`; `follows_sql` per i disegni «Followers» di
  TASK-208. Rifiutare cancella la richiesta: chi l'ha mandata non lo sa.
  **Il profilo di un altro si apre dalla ricerca** e dagli elenchi
  (risposta alla domanda aperta di TASK-116). Bloccare (TASK-121) dovrà
  toccare `follows.py`. **Da dire all'utente**: la ricerca mostra il nome
  di ogni iscritto a chi ha un account. Non ancora sul server (vuole la
  `0011` e l'ok dell'utente). Poi **B** (l'app),
  dopo che l'utente ha confermato le proposte del task file; e TASK-208 A.
  Da dove riprendere: `tasks/TASK-211.md`.
  **Parte B, l'app** (2026-10-05, ADR-0199; chiesta dall'utente: «ho
  trovato il mio amico, ma non posso seguirlo»; «Requests» in «Profile»
  scelto dall'utente): sul profilo di un altro il tasto «Follow» →
  «Requested» → «Following»; in «Profile» i tre numeri «Requests»,
  «Followers», «Following» con i loro elenchi («Accept», «Decline»,
  «Remove»); un nome negli elenchi apre il profilo. Il server ha già l'API:
  **manca solo pubblicare l'app** (con l'ok dell'utente, dal coordinatore).
  Da fare: la prova sull'iPhone con due account; i testi nuovi (cinque
  lingue) da confermare. L'aspetto non è stato visto su un telefono.
- **TASK-208 — Pubblicare una corsa in stile Strava** (ADR-0170; scelte
  dell'utente del 2026-10-03: «How did it go?», tag degli iscritti per
  nome, fino a 3 foto, «Everyone», «Followers», «Only me»; e, durante la
  parte A, la descrizione **non filtrata** per le parole negative).
  **Parte A, l'API**, in `main` dal 2026-10-03 (PR #268, merge
  `ebb4f38`, migrazione `0014_drawing_details.sql`):
  `visibility` al posto di `public`
  (le pubbliche di prima `everyone`, le private `only_me`; `public` resta
  colonna generata per l'SQL di prima);
  `description`, `runs.activity` (anche nel `PUT` della corsa), i tag
  (al più 10, cancellato l'account il nome sparisce), le foto in posti
  1–3 a 1080 px senza EXIF, lette con il token da
  `/drawings/{id}/photos/{n}` e tenute sul server **solo mentre altri
  vedono il disegno** (scelta dell'utente: le foto delle corse «Only me»
  restano sul telefono); chi vede cosa con una domanda sola,
  `drawing_seen_sql`; il numero sul profilo è quello che chi guarda vede;
  a Strava descrizione e tipo (`Run`, `Ride`, e `StandUpPaddling` per la
  canoa, scelta dell'utente); i commenti seguono `drawing_seen_sql`, e
  questo chiude il seguito di TASK-120 (i commenti di un disegno
  «Followers»). L'app di oggi
  (`public` sì/no) continua a funzionare: i campi nuovi assenti restano
  come sono. Non sul server: vuole la migrazione, l'ok dell'utente e la
  stima dello spazio delle foto (`tasks/TASK-208.md`, «Note per il
  deploy»). Il server ha la `0014` dal 2026-10-06 (`d7b490f1`).
  **Parte B, l'app** (2026-10-06, PR #425; le sei proposte del task file
  **confermate dall'utente**, e il suo sì ai file fuori elenco e a
  `expo-image-manipulator`): a fine corsa e sulla corsa aperta in «My
  activities» il modulo come su Strava (foto fino a tre, «Title», «How did
  it go?», «Tag people» con la ricerca di TASK-215, «Activity» dallo sport
  di «Settings», «Who can see it» con «Only me» a ogni corsa); la scelta
  intera in una sola (`DrawingChoice`), i file di prima letti ancora; le
  foto sul telefono (un file per foto, ridotte a 1080 px) e all'API solo
  mentre altri vedono la corsa, dopo il disegno; il disegno prima di
  Strava; il disegno aperto con foto, descrizione, attività e i nomi
  taggati che aprono il profilo; 24 testi in cinque lingue. Test verdi
  (338 file), `typecheck`, `lint`, `format:check` puliti. **In `main`
  dal 2026-10-06** (merge `f6fcdacd`, CI 5/5; i 24 testi confermati
  dall'utente in tabella). Da pubblicare (coordinatore); niente da
  aggiornare sul server. **Resta la prova sull'iPhone** con l'utente. Da
  dove riprendere: `tasks/TASK-208.md`, «Esito».

- **TASK-187 — «Send to Strava»** (ADR-0156, migrazione `0004`; scelta
  dell'utente: «Sì, fallo vero»). **Parte API** in `main` (PR #210).
  **Parte app** fatta il 2026-10-02 sera, PR #229, in `main` dal
  2026-10-02 22:14Z, con le quattro risposte dell'utente: il nome si scrive
  prima di «Save», la descrizione va su ogni corsa («Recorded with Sgrava»
  per una corsa libera), l'interruttore ricorda l'ultima scelta, «Connect
  with Strava» è arancione. A fine corsa, sopra «Save» e «Discard», «Connect
  with Strava» o l'interruttore «Send to Strava» con «Name on Strava»; su
  una corsa aperta di «My activities» «Send to Strava» o «View on Strava»;
  in «Settings» la sezione «Strava» con «Disconnect». Senza rete la corsa
  va all'API e poi a Strava alla prossima apertura, una volta. Nell'API il
  corpo facoltativo `{ "name" }` di `POST /me/activities/{key}/strava`.
  Nessuna dipendenza, nessuna migrazione nuova. Come funziona: `UI.md` («La
  fine della corsa», «My activities», «Settings», «Cosa esce dal
  telefono»), `API.md` («Send to Strava»). **Aspettano l'utente**: creare
  la sua app Strava e scrivere il secret sul server (`DEPLOY.md`,
  «Strava»), l'ok per aggiornare il server (migrazioni `0004`–`0007`) e
  pubblicare l'app, la prova dal vero (data, ora, durata, le pause). Finché
  il server non ha Strava l'app non mostra niente di Strava. Da dove
  riprendere: `tasks/TASK-187.md`, «Esito».
- **TASK-191 — Percorsi in canoa e paddle** (ADR-0154, ADR-0161). **A1**
  in `main` (PR #216): l'acqua di laghi e mare, la fascia entro 1 km dalla
  riva, dove la forma ci sta, la partenza dalla riva dove si arriva a
  piedi; nove campioni a Riccione, Jesolo e Riva del Garda, giudicati
  dall'utente il 2026-10-03 «buoni, ma troppo vicini alla riva». **A2**
  in `main` (PR #235, 2026-10-03): `paddling` nel motore,
  **1–5 km** (scelta dell'utente), al mare la forma **oltre 200 m dalla
  riva** e sui laghi a 50 m (scelta dell'utente), `python -m route_engine
--activity paddling`, la validazione sull'acqua (errori, non warning),
  parole e immagini rifiutate sull'acqua, `paddling.plan_paddling` per la
  parte B; i centri scelti da dove si arriva alla riva. **B** (l'API,
  ADR-0164, in `main` dalla PR #241, 2026-10-03): `paddling` nel contratto
  (`shared-types` 1–5 km), l'API disegna sull'acqua della sua cache
  (`data/cache/water/`, scaricata da Overpass a ogni area nuova), senza
  indicazioni né alternative; lontano dall'acqua o forma troppo grande
  `shape_not_drawable`, con la distanza per difetto al mezzo km in cui ci
  sta; parole e immagini rifiutate; migrazione `0010` per i preferiti in
  canoa. Non provata dal vero: Overpass non risponde da quella sessione.
  **Manca il punto 5**:
  i campioni rifatti con le regole nuove sull'area intera, e Como
  (Overpass dal Mac, o il server con l'ok dell'utente). Cambia l'impronta
  del motore: un aggiornamento del server con TASK-203, poi
  `draw_examples`. **C** (l'app, ADR-0169, in `main` dalla PR #255,
  2026-10-03 sera, chiesta dall'utente), con le tre risposte dell'utente: «Paddle»
  si sceglie; «Draw» solo forme, 1–5 km, da 2 km; «on the water» e
  «Start» senza indicazioni (mai `/route-directions`); l'**avviso di
  sicurezza al primo «Start»** sull'acqua (testo approvato); i testi
  d'errore dell'acqua; **«Explore» con «Paddle»**: Lago di Garda, Lago di
  Como, Jesolo, Riccione e «Near me», cuore, cerchio e stella da 2 km dalla
  riva; i testi della canoa anche nelle quattro lingue di TASK-210.
  **Bloccato per la prova dal vero**: il server disegna in canoa solo
  dove ha l'acqua in `data/cache/water/`, e Overpass rifiuta server e Mac;
  scaricare prima l'acqua dei quattro luoghi è un seguito, con l'ok
  dell'utente, poi la pubblicazione. **Non pubblicare `main` con «Paddle»
  pronto finché l'acqua dei quattro luoghi non è sul server**: dal merge
  della #255 ogni pubblicazione di `main` porta «Paddle» pronto, e chi lo
  sceglie avrebbe solo errori. Seguito in `services/`: Strava riceve
  ogni attività come «Run». Da dove riprendere: `tasks/TASK-191.md`,
  «Esito», parti A2, B e C (fatta).
  **Done il 2026-10-07** (pulizia dei task file): il punto 5 e l'acqua
  sul server sono di TASK-225, Strava di TASK-208 A; la voce in
  «Completato».

- **TASK-119 — Reazioni ai disegni pubblicati** (ADR-0193; scelte
  dell'utente del 2026-10-04): era «Like», diventa sei reazioni sotto un
  disegno pubblicato aperto, una a testa: il cuore di Sgrava, 🔥 👏 💪 😂
  😮. Il cuore di Sgrava è il **super like**: doppio tocco sul disegno
  aperto, e **vuole un commento di almeno 2 caratteri**, salvato insieme.
  **Parte A, l'API**, in `main` dal 2026-10-04 (PR #301, `3c94690`):
  migrazione `0015_reactions.sql`, `GET /drawings/{id}/reactions`, `PUT`
  e `DELETE /drawings/{id}/reaction`; il super like scrive il suo
  commento nella stessa transazione, dal filtro di TASK-213. Non sul
  server: migrazione, quindi l'ok dell'utente. **Parte B, l'app**, fatta
  e in `main` dal 2026-10-05 (PR #309, merge `0e5ff55`): sotto un
  disegno aperto, accanto al pulsante dei commenti, la propria reazione,
  le tre più usate e il totale; il tocco apre la barra delle sei; le
  emoji si vedono subito e tornano com'erano se l'API non le tiene; il
  doppio tocco sulla mappa del disegno (che lì non fa più lo zoom) o il
  cuore nella barra aprono il foglio «Super like» con il cuore grande e
  il commento obbligatorio. Provata nel simulatore con un'API locale, non
  con le dita; testi confermati dall'utente. **Done** (2026-10-07): il
  server ha la `0015` dal 2026-10-05 e l'app è su `preview` dal gruppo
  `9585ffac` (2026-10-06). Resta la prova sull'iPhone con due account,
  dell'utente. `tasks/TASK-119.md`, «Esito».

- **TASK-210 — La lingua dell'app** (ADR-0172; scelte dell'utente: inglese,
  tedesco, italiano, spagnolo, francese; senza scelta la lingua del
  telefono). **Parte A** in `main` (PR #254, merge `18fe25c`) e pubblicata su
  «preview» il 2026-10-03 (gruppo `90bd8c06`, con TASK-212): `src/i18n/`
  (l'inglese come chiave, `t()`, i plurali, la virgola dei decimali, la
  scelta in `language.json`, la lingua del telefono senza dipendenze), la
  riga «Language» in «Settings» sotto «Preferences», le quattro tabelle e
  `t()` in «Settings», «Profile», l'accesso, «My activities», i preferiti,
  i disegni, il feed, Strava e la ricerca del luogo. Provata nel
  simulatore con il telefono in italiano: «Settings» parte in italiano,
  «Deutsch» la cambia subito e resta dopo un riavvio. **Le parti
  successive** (i file di TASK-191 C, TASK-208, TASK-209: «Draw»,
  «Explore», la corsa, la riga «Sport») dopo il loro merge. **Parte B — la
  corsa** fatta il 2026-10-06 (le schermate della corsa, il banner della
  svolta con il frasario della voce, 58 testi nuovi; testi approvati
  dall'utente il 2026-10-06). **Parte C — «Explore»** fatta il 2026-10-06
  (64 testi nuovi, le categorie tradotte a vista e inglesi verso l'API;
  testi approvati dall'utente il 2026-10-06). **Parte D — «Draw»** fatta
  il 2026-10-06 (branch `feat/TASK-210-draw`, in parallelo con la C): il
  pannello di «Draw», i testi d'errore in km, gli avvisi del motore, la
  parola, la foto e il contorno, 101 testi nuovi
  (`out/task-210-draw-testi.md`), test `route/DrawItalian.test.tsx`; testi
  approvati dall'utente il 2026-10-06, PR #421 (merge `438c019`); C e D in
  `main` e su «preview» (gruppo `65620103`). **Parte E — la fine corsa,
  «Sport» e la voce di «Dati»** fatta il 2026-10-07 (branch
  `feat/TASK-210-e-run-end-sport`, PR #433): i messaggi di `api/drawings.ts` in
  `t()`, i nomi degli sport con `tLater` e mostrati tradotti, la riga e il
  foglio della voce, 16 testi nuovi, test
  `settings/SportVoiceItalian.test.tsx`; testi approvati dall'utente il
  2026-10-07. **Parte G — i titoli delle pagine** fatta il 2026-10-08
  (branch `feat/TASK-210-g-page-titles`): «Feed», «Draw», «Explore» in alto
  passano da `screens/pageTitles.ts` (it «Feed», «Disegna», «Esplora»; fr
  «Fil», «Dessiner», «Explorer»), tre testi nuovi, test
  `screens/pageTitles.test.ts`. Restano i nomi delle forme, i nomi sulla
  mappa e «Start here», «Help» in de/es/fr (parte F, altra sessione),
  «Paddle ·» nel feed dopo TASK-118 (`tasks/TASK-210.md`). **Parte F — i
  nomi delle forme, la mappa e «Help»** fatta il 2026-10-08 (branch
  `feat/TASK-210-f-shape-names`): i nomi delle forme in «Draw» e sulle
  schede di «Explore» nella lingua dell'app, `shapeWords.ts` che legge le
  cinque lingue, i luoghi sulla mappa e «Start here» nella lingua
  dell'app, «NEAR TRENTO», «Help» in de/es/fr e, per scelta dell'utente,
  «Terms» e «Privacy» tradotti restando bozze, con le pagine chiamate come
  i titoli della parte G; 4 testi nuovi in fondo alle tabelle. Dopo F e G
  resta il Feed (`tasks/TASK-210.md`). L'utente ha
  delegato il controllo delle traduzioni e dato l'ok a pubblicare
  (2026-10-03), sapendo che fino all'ultima parte un telefono in italiano
  vede l'app mezza in italiano e mezza in inglese. Da dove riprendere:
  `tasks/TASK-210.md`.
  **Chiuso** (2026-10-25) con la **parte H** (branch
  `feat/TASK-210-h-last-texts`, PR #545, merge `52953c47`): gli ultimi testi rimasti in inglese, il
  Feed e la virgola delle schede; vedi «Completato».

- **TASK-214 — Il motore dei percorsi sul telefono** (ADR-0177; chiesto
  dall'utente il 2026-10-03). Il telefono disegna da sé forme e parole su
  strada, con Pyodide in una WebView e le zone nella sua memoria (fino a 2
  GB, scaricate anche con i dati mobili); il server resta la riserva. Le
  sei scelte hanno la risposta dell'utente (task file). **Parte A, l'API**,
  in `main` dalla #275 (`f2d1e90`, 2026-10-03), non ancora sul server: il
  formato neutro delle zone, `GET /phone-zones/{network}`, il comando
  `python -m shaperoute_api.phone_zone_api` e l'adattatore `on_phone.py`,
  che dà lo stesso `result` di `/route-jobs` (test su Levico; su Trento in
  Pyodide 5–7 s, uguale a CPython). L'aggiornamento del server e le zone
  scritte in anticipo (0,7–0,8 GB, 20–30 min) li chiede il coordinatore
  all'utente. **Parte B, l'app**, in `main` dalla #282 (`b87d8cc`,
  2026-10-03) e su «preview» dal 2026-10-04 (gruppo `1da074a6`, pubblicato
  dal coordinatore): Pyodide 314.0.7 e il motore in due zip fra
  gli asset (`tools/phone_engine/phone_engine.py`; chi cambia
  `route_engine` rifà `engine.zip`, la CI lo controlla), una WebView
  nascosta, le zone scaricate a ogni apertura, il telefono prima fino a 8
  km a piedi e 30 in bici, il server come riserva. In Expo Go, nel
  simulatore, con l'API spenta disegna il cuore da 5 km di Trento. Senza
  `/phone-zones` sul server l'app chiede tutto al server, come prima.
  L'utente ha scelto i testi delle mappe offline e il tetto del traffico
  (task file). **Parte C** in `main` dalla #295 (`17a9e6c`, 2026-10-04,
  non pubblicata): in «Settings», sotto
  «Preferences», «Offline maps: 10 MB» con «Delete» e «Maps download on
  Wi-Fi and mobile data.»; sopra «Draw route», solo al primo download,
  «Downloading the maps of your area (10 MB) so routes work without
  signal.» con il peso vero (il posto l'ha scelto l'utente il
  2026-10-04); nelle cinque lingue. Provata nel simulatore. **Parte A2**,
  il tetto del traffico, in `main` dalla #330 (`6f14656`, 2026-10-05): le zone in più
  arrivano con `?prefetch=1` e l'id anonimo del telefono, al massimo 300
  MB al giorno per telefono e 300 GB in tutto; oltre, `429` con
  `Retry-After` fino alla mezzanotte UTC, e l'app non ne chiede altre fino
  ad allora. Conteggio in memoria: un riavvio lo rimette a zero. Sul
  server dal 2026-10-05, 08:54Z. **Parte B2**, le zone in più, dalla
  #337 (`f3fdbce`) e **B2b**, i paesi vicini, dalla #341 (`a9ca8f6`):
  finite le zone intorno al telefono, una alla volta, quelle dei paesi
  vicini (`/nearby-cities`), delle città scelte per ultime in «Explore» e
  delle 14 in evidenza, dalla più vicina, con `prefetch=1`, fino a 2 GB;
  un giro intero al giorno. **Le zone del telefono sono sul server** dal
  2026-10-05 (521 file, 2,6 GB, 82 minuti), e B2/B2b su «preview» da
  `7a9506a`: il telefono disegna da sé. **Resta D**, la prova
  sull'iPhone, che è dell'utente e fissa i limiti di distanza. Da dove
  riprendere: `tasks/TASK-214.md`, «Esito».
  **Parte D fatta** il 2026-10-25: l'utente ha provato l'app sul suo
  iPhone e ha scritto «funziona ma cerca di migliorarlo». Prossimo passo:
  misurare (tempi telefono/server, richieste che ricadono sul server, zone,
  memoria, errori nei log) e proporre all'utente un miglioramento, che
  diventa una parte nuova di TASK-214.
  Misure fatte lo stesso giorno (task file, «Le misure dopo D»): il
  telefono disegna solo vicino a dove si è aperta l'app, perché la zona
  ha 3 km intorno; i tempi sono quelli del server. Tre proposte
  all'utente, in attesa della sua scelta.
  L'utente ha scelto la zona più larga («fai la 1»): **parte E** in
  `feat/TASK-214-e-wider-zone`. L'API dà con `margin_m=6000` una zona con
  6 km intorno al telefono, fino a 12 MB; l'app la chiede, passa al motore
  tutte le zone che contengono la partenza e legge la zona all'apertura.
  App e server si pubblicano in qualunque ordine: con il server di prima
  l'app scarica le stesse zone di oggi. I log del server (15 giorni):
  più di metà delle richieste di zona hanno `404`, cioè lì il server non
  ha una zona con 3 km intorno e il telefono non disegna.
  **Parte E in `main` dalla #546** (`7da61107`, 2026-10-25, mergiata dal
  coordinatore; la #541 della parte D è entrata con lei). La zona da 6 km
  si accende quando il server si aggiorna (solo l'API, dopo Apple e con il
  sì dell'utente); la lettura all'apertura vale già con il server di oggi.
  Restano aperti: tempi e memoria su un iPhone vero, le impronte
  telefono/server confrontate, il cuore senza rete sull'iPhone; e le zone
  per i posti dove oggi il server risponde `404` (un seguito da proporre
  all'utente). Da dove riprendere: `tasks/TASK-214.md`, «Esito».
- **TASK-266 — Il tour del primo avvio e la guida in «Profile»**
  (ADR-0235; richiesta dell'utente del 2026-10-09, che fra tre proposte ha
  scelto il tour sulle schermate vere). Branch
  `feat/TASK-266-first-run-tour`. Dopo l'animazione all'avvio, la prima
  volta, otto passi sopra l'app vera: una parte nella luce, il resto
  scuro; «Skip» conta 5 secondi prima di potersi toccare. «Guide» sulla
  prima pagina di «Profile», anche senza account, con «Watch the tour».
  Solo app, nessun server. **Aspetta**: il sì dell'utente sui testi
  (cinque lingue) e la coda dei merge. `tasks/TASK-266.md`.
  **Chiuso**: in `main` con la #479 (`1f64621e`, 2026-10-10); vedi
  «Completato».
- **TASK-305 — Parapendio: proposta e prova di fattibilità** (ADR-0265
  **proposto**; richiesta dell'utente del 2026-10-26; numeri e condizioni
  dal Coordinatore). Branch `docs/TASK-305-paragliding-proposal`: solo
  documenti e misure, **nessun codice**, e nessuna parte parte senza il sì
  dell'utente. Lo studio è `out/TASK-305/studio.md` del Mac (ignorato da
  git) con gli script, i dati e la pagina `paragliding-samples-grid.html`.
  **Il modello**: niente strade, il cono di planata fra il decollo e il suo
  atterraggio ufficiale (efficienza 8, 300 m sopra il terreno, aria calma);
  la forma più larga che ci sta, inclinata al massimo di 30°, sotto le CTA
  e sopra le riserve, 500 m sopra i centri abitati; la quota al posto della
  distanza; il motore decide, l'AI interpreta. **Misurato** su Monte Baldo
  → Malcesine, Monte Grappa → Semonzo e Panarotta → Levico (terreno EU-DEM,
  spazi aerei dal file comunitario AIRAC 2504, centri abitati OSM):
  in aria calma il cuore più grande è di 2,8 km al Baldo (1667 m di
  dislivello), 1,2 al Grappa, 1,0 alla Panarotta; con le regole il Baldo
  resta a 2,7, il Grappa scende a 0,24 (pianura costruita) e alla
  Panarotta non ci sta niente (il file comunitario mette l'atterraggio di
  Levico dentro una riserva); con vento contro la planata Grappa e
  Panarotta non hanno forma. Un cuore regge 12–16 boe; con 15 km/h di vento conta
  il raggio di virata (60–80 m di errore a 30 m, 90–135 a 50 m): sotto
  1,5 km la forma si deforma, da 2 km si legge. **Le fonti**: decolli da
  OSM (499 in Italia, incompleti), terreno Copernicus, vento ICON-D2 o
  ECMWF (CC BY 4.0); **gli spazi aerei sono il nodo**: openAIP è CC BY-NC,
  ENAV vuole un accordo, EAD è a pagamento; senza una fonte spedibile non
  si propone nessuna forma. **La sicurezza**: nessuna guida in volo, la
  forma si esporta come task di boe (XCTrack QR e `.xctsk`, `.cup`,
  `.wpt`) e dopo l'atterraggio si importa l'IGC; l'app non dice mai «vola
  qui», «qui è legale», «ce la fai». **L'utente** (2026-10-26): «è una
  bella idea», niente navigatore, solo la traccia e il caricamento del
  volo. **Costo**: 10–14 sessioni (la canoa ne ha prese 15), più le
  licenze, un parere legale e una prova con un pilota. **Verdetto**:
  conviene a tre condizioni (spazi aerei con licenza, decolli scelti dove
  la forma è ≥ 1,5 km, parere legale e prova), altrimenti no. Il
  2026-10-27 l'utente ha scelto la riga in Settings **subito, con «Soon»**:
  è la parte D0 (solo app, `sport.ts` e le lingue), che non aspetta le
  condizioni; il nome è «Paragliding» 🪂 (Parapendio, Gleitschirmfliegen,
  Parapente), l'avviso di sicurezza è approvato com'era proposto. Le
  scelte di prodotto sono tutte prese. **Aspetta**: le tre condizioni prima
  della parte A1 e, prima della build 1.0.1, la scelta se tenere la riga
  «Soon» nelle build per lo store (Apple, regola 2.1). File:
  `tasks/TASK-305.md`.
  **Documenti in main** con la #578 (`0f66aa54`, 2026-10-27). **Parte D0
  fatta** il 2026-10-28 (branch `feat/TASK-305-d0-soon-row`, PR #591): la
  riga «Paragliding» 🪂 con «Soon» in «Settings → Sport» e, per scelta
  dell'utente del 2026-10-27, anche nel menu dello sport di «Draw»; non si
  sceglie e non dà percorsi; impronta iOS invariata (`83793e26…`). Merge
  sulla parola dell'utente e il «merge 591» del Coordinatore.

- **TASK-301 — La musica nel video della corsa** (ADR-0262; richiesta
  dell'utente del 2026-10-25 «aggiungi la musica al video», scelte con le
  proposte lo stesso giorno; numeri e condizioni dal Coordinatore). Branch
  `feat/TASK-301-video-music`. In «Share your run» la riga «Music»: «None»
  all'inizio e dieci brani nostri, scritti da `tools/video_music.py` sui
  tempi del video e uguali byte per byte su ogni computer; un tocco li fa
  sentire, il brano acceso va nel video come seconda traccia AAC. Senza
  musica il video resta identico. 1,88 MB di brani nell'app. Solo app,
  impronta iOS invariata. File: `tasks/TASK-301.md`.

- **TASK-316 — Explore pronto prima: i disegni dei paesi vicini e della
  regione** (ADR-0276; richiesta dell'utente del 2026-10-27, «appena la
  apro deve già iniziare a scaricare i vari disegni nelle città vicine,
  anzi addirittura nella regione, e fai almeno 100 disegni da tenere in
  server»; numeri e condizioni dal Coordinatore). Branch
  `docs/TASK-316-explore-ahead`, poi A (API), B (app), C (server). Toccato
  un paese vicino, oggi gli undici esempi dopo cerchio, cuore e stella
  partono solo allora. A: `POST /kept-routes`, in sola lettura, i percorsi
  già tenuti e nient'altro; `draw_examples --all --around`. B: all'apertura
  i sei paesi vicini e quelli della regione (fino a 18) chiedono a
  `/kept-routes` i loro quattordici esempi, scritti in un file per paese
  per 7 giorni, al massimo 150 disegni a sessione: il prefetch non fa mai
  calcolare il server. C, dopo Apple e con il sì dell'utente: almeno 100
  disegni attorno a Trento e Caldonazzo calcolati sul server una volta, di
  notte. File: `tasks/TASK-316.md`.
  **A** in `main` con la #590 (`07f98951`, 2026-10-28) e **B** con la #593
  (`bf68d9cf`), impronta iOS `83793e26`. `/kept-routes` legge solo
  `route_store`, mai l'archivio, che tiene le posizioni degli utenti. Il
  punto 7 di TASK-279 B è fatto qui. Resta C, dopo Apple e con il sì
  dell'utente: il server con A, poi di notte `draw_examples --all --around`
  per Trento e Caldonazzo, almeno 100 disegni (comandi e ritorno indietro
  nel task file).
- **TASK-320 — Disegnare a mano in «Draw», e modificare ogni disegno
  proposto** (ADR-0280, proposta; richiesta dell'utente del 2026-10-28,
  «dai la possibilità di disegnare anche a mano nella pagina draw e […]
  modificare un disegno del feed, un disegno ricercato, un disegno di
  explore… tutto potenzialmente editabile»; numero, parti e condizioni dal
  Coordinatore). Branch `docs/TASK-320-freehand-edit`: solo i documenti.
  Proposta: «Freehand» come quarta scelta di «Draw»; una tavola vuota con
  le regole della linea a dito di «Draw on the map» (la prima linea è il
  contorno, le altre dettagli, «Erase»), tutta sul telefono, niente rete
  prima di «Draw route»; «Edit the drawing» sulla forma scelta, sul
  risultato, sui percorsi di «Explore» e sui disegni degli iscritti, che si
  aprono nella tavola e tornano in «Draw» come «Draw it near me». Parole e
  percorsi a tema no. Nessun contratto nuovo. La privacy di oggi non dice
  che un contorno parte come richiesta di percorso: una riga nuova proposta,
  col sì dell'utente. Parti A (tavola, «Freehand», «Edit» in «Draw» e sul
  risultato) e B (schede), ognuna nella sua sessione dopo il sì dell'utente
  alle proposte e ai testi. File `tasks/TASK-320.md`.
- **TASK-322 — Entrare e iscriversi con Apple e con Google** (ADR-0282,
  proposta; richiesta dell'utente del 2026-10-28, «Accedere e registrarsi
  con Google o Apple», «con google ed apple»). Branch
  `docs/TASK-321-sign-in-apple-google` (il nome con cui è nata la PR
  #607): solo i documenti. Scelte dell'utente: i tasti in alto in «Sign up»
  e «Log in», Apple solo su iPhone, Google su iPhone e Android, la prima
  volta nome ed età, stessa email stesso account; approvati anche i tre
  pacchetti nuovi, i testi, privacy e termini: il codice parte con A. Parti A
  (API), B (app, moduli fuori dall'autolinking e tasti nascosti nella build
  dello store: impronta 83793e26), C (console Apple e Google, server, la
  build 1.0.1 insieme a contatti, document picker e forse HealthKit). File
  `tasks/TASK-322.md`.
  **Parte A fatta** (2026-10-29, PR #621, branch
  `feat/TASK-322-a-sign-in-api`): migrazione `0036_user_identities.sql`,
  `GET /session/providers`, `POST /session/{provider}` (identità nota
  `200`, email già iscritta legata `200`, altrimenti `404 new_account` e poi
  `201` col nome; un'email non confermata legata perde password e sessioni),
  la revoca di Apple in `DELETE /me`, i tipi in `shared-types`. Token letti
  con le chiavi pubbliche in memoria, test con chiavi finte e senza rete
  (`test_sign_in_providers.py`). Solo API: impronta iOS `83793e26`
  invariata. Spento finché il server non ha le chiavi (parte C, col sì
  dell'utente). Prossima: B (l'app), in una sessione sua.
- **TASK-333 — Gli allegati nei messaggi privati: un disegno, una foto, un
  video** (ADR-0289, proposta; richiesta dell'utente del 2026-10-29,
  «Aggiungi la possibilità di inviare disegni agli amici allegati, foto
  video»; numeri dal Coordinatore). Branch
  `docs/TASK-333-message-attachments`: solo i documenti, con le scelte
  da chiedere all'utente una per volta. Poi A (API: file su disco in
  `data/media`, caricamento in due tempi, durata letta dall'MP4, il luogo
  tolto, limiti, scadenza dei video e tetto del server, segnalazione con
  l'allegato), B (app: foto e video) e C (app: i disegni), ognuna nella
  sua PR. Impronta iOS `83793e26`: niente moduli nuovi. Server, OTA e
  «App Privacy» / «Data safety» col sì dell'utente. File
  `tasks/TASK-333.md`.
  **Proposta approvata il 2026-10-29** (PR #627): solo dopo «Accept»,
  video fino a 60 s e 40 MB tenuti 30 giorni, il disegno si apre, si
  corre e si tiene, si manda dalla scheda e dalla conversazione; testi e
  privacy approvati («Approvo così»). Prossimo: la parte A, col «vai»
  dell'utente, in una sessione sua.
  **Parte A scritta il 2026-10-29** (branch
  `feat/TASK-333-a-attachments-api`, sulla delega di 23 ore dell'utente e
  col via del Coordinatore): migrazione `0038_message_media.sql`,
  `media_files.py` (comune con TASK-336), `message_media.py` (caricare,
  locandina, leggere con `Range`, 10 video e 100 foto al giorno, tetto
  `SHAPEROUTE_MESSAGE_MEDIA_MAX_GB`, video scaduti dopo 30 giorni, giro di
  pulizia ogni ora), `messages.py` (l'allegato solo in `open`, il disegno
  intero e la sua scheda, «[Photo]» per l'app di prima), push, la
  segnalazione con l'allegato sulla pagina del link, `data/media` in
  `compose.yaml`. Server fermo fino al ritorno dell'utente. Prossima: B
  (l'app, foto e video).
  A in `main` con la #634 (02e3fc5c). **Parte B scritta il 2026-10-29**
  (branch `feat/TASK-333-b-attachments-app`, stessa delega): il «+» solo
  quando la pagina ha `attachments` (niente sonda nuova), «Photo» e
  «Video» dalla galleria con i controlli di 60 s e 40 MB, l'anteprima con
  il testo, il file caricato con `File.upload` di `expo-file-system`, la
  locandina fatta in una WebView nascosta, la foto e il video a tutto
  schermo con «Share», la lista con «📷 Photo», la privacy nelle cinque
  lingue e sul sito; «Help» con la parte C. Solo OTA, dopo il server.
  Prossima: C (i disegni), dopo B; `RoutePanel.tsx` è conteso con TASK-331.
  B in `main` con la #635 (e6f5b1c3). **Parte C scritta il 2026-10-29**
  (branch `feat/TASK-333-c-attachments-drawings`, stessa delega): «Send to
  a friend» sotto il cuore della mappa e sulle schede di «My activities» e
  dei disegni, «Drawing» nel «+», la scheda del disegno nella
  conversazione e il disegno aperto sulla mappa come un preferito, con
  «←» che torna alla conversazione; «Help» nelle cinque lingue. Solo OTA,
  dopo il server; `RoutePanel.tsx` non toccato. Con C le parti di TASK-333
  sono tutte scritte: restano server, OTA e i moduli di «App Privacy» e
  «Data safety», col sì dell'utente.
  C in `main` con la #636 (2d6b8b69). **Parte D scritta il 2026-10-29**
  (branch `feat/TASK-333-d-free-videos`): con lo spazio pieno si tolgono i
  video dei messaggi più vecchi (`free_videos`, scelta dell'utente «appena
  è pieno cancella i video delle chat…»; mai quelli dei post), privacy e
  «Help» con i testi approvati, aggiunta ad ADR-0289, `data/media` su `/`
  da rivedere con l'utente al server. Parte E (expo-video nei messaggi) al
  taglio della 1.0.2.
  **Chiuso il 2026-10-29**: D in `main` con la #639 (dd607e89), quindi
  A–D tutte in `main`. Voce in «Completato».

## Completato

- **TASK-358 — Nei messaggi «Photo» e «Video» aprono la galleria** (2026-10-30; numero dal
  Coordinatore; bloccava l'update `production`). Su iOS la galleria presentata mentre il
  foglio del «+» si chiudeva non compariva: ora parte da `onDismiss`. Provato nel simulatore
  fino alla foto nella chat; sul telefono con la preview. Solo app, nessun testo nuovo.
  File: `tasks/TASK-358.md`.
- **App** — TASK-350 (ADR-0302; richiesta dell'utente del 2026-10-30): nelle schede di «Explore» con una foto, in «NEARBY TOWNS» e «IDEAS FROM EUROPE», prima il disegno sulla mappa e con uno swipe la foto col credito; due pallini dicono quale si vede, un tocco su tutte e due apre la scheda. Provato nel simulatore; Android no. Solo app, nessun testo nuovo, impronta iOS 83793e26. **Da vedere sull'iPhone** con la prossima preview. `tasks/TASK-350.md`.
- **App** — TASK-352 (ADR-0304; richiesta dell'utente del 2026-10-30, «Dopo la
  prima scelta»): «Who can see it» parte da «Only me» finché l'account non
  salva un'altra scelta, poi dall'ultima salvata; le attività da file partono
  sempre da «Only me». Help e Privacy aggiornate in cinque lingue. Da fare, col
  sì dell'utente: OTA e pubblicazione del sito.
- **App** — TASK-337 (aggiunta ad ADR-0048; richiesta dell'utente del 2026-10-29 con uno screenshot: «a volte le scritte rosse… sono troppe… che poi non si visualizza più l'immagine»): sotto il percorso di «Draw» due note del motore alla volta, prima quelle a cui fare attenzione; le altre con «Show more» (già tradotto), mai tolte. Scale, traffico, gallerie e bici a mano sempre in vista (condizione del Coordinatore). Un altro percorso, o l'altro fra A e B, riparte da due. Solo JS dell'app (OTA), nessun testo nuovo, nessuna dipendenza, impronta iOS invariata. **Da vedere sull'iPhone** con la prossima preview. `tasks/TASK-337.md`.
- **App** — TASK-331 (ADR-0288 con l'aggiunta della parte B; richieste
  dell'utente del 2026-10-29, «Tutto sulla mappa» e poi «fallo più
  complesso», testi approvati): a mano si disegna solo sulla mappa. La
  prima linea resta aperta se non torna all'inizio e il percorso la fa
  andata e ritorno (contratto invariato); via la tavola «Freehand»; «Edit
  the drawing» mette la figura sulla mappa, mai per un'emoji. Sotto la
  mappa «Draw | Line | Erase | Move», «Undo», «Redo», «Clear all»: la gomma
  toglie il pezzo sotto il dito e un pezzo staccato si riattacca con un
  collegamento tratteggiato; «Line» fa segmenti dritti a tocchi; con
  «Move» una linea tenuta ferma e trascinata si piega; due dita spostano la
  mappa. #632 (`b5d4e5d3`), #643 (`dbf618fd`); solo JS, impronta iOS
  `83793e26`. **Da provare col dito sull'iPhone** con la prossima preview.
  `tasks/TASK-331.md`.
- **App** — TASK-338 (punto 8 di ADR-0175; richiesta dell'utente del 2026-10-29): nel foglio dei commenti, un tocco sulla foto di chi ha scritto chiude il foglio e apre il suo profilo, come un nome taggato (il proprio porta alla propria pagina); tenuta premuta dà ancora le scelte del commento, e per VoiceOver è l'azione «{name}'s profile» della riga; un autore appena bloccato non apre niente. Solo app, nessun testo nuovo. **Da vedere sull'iPhone** con la prossima preview. `tasks/TASK-338.md`.
- **App e API** — TASK-334 (ADR-0290; richiesta e scelta dell'utente del 2026-10-29, «Sì, così», testi approvati lo stesso giorno): i posti che l'utente tiene sul telefono. «Add a place» in «Settings» → «Offline maps», fino a 10 posti con la zona di 6 km fuori dai 2 GB; il server prepara quelle che non ha (`POST /phone-zones/{network}/places`, 3 al giorno per telefono, 20 per il server, mai mentre disegna percorsi). In `main` dalla #637 (`a623d61c`). Restano il server e l'OTA col sì dell'utente; la pagina non è ancora vista sul telefono. `tasks/TASK-334.md`, «Esito».
- **App e API** — TASK-333 (ADR-0289 con l'aggiunta della parte D;
  richiesta dell'utente del 2026-10-29, «Aggiungi la possibilità di inviare
  disegni agli amici allegati, foto video», e le sue sette scelte, testi e
  privacy approvati): nei messaggi privati una foto, un video fino a 60 s
  e 40 MB o un disegno, solo dopo «Accept». File su disco in `data/media`
  (mai nel database né nelle copie), video tenuti 30 giorni o meno quando
  lo spazio è pieno, dal più vecchio; il «+» solo con un server che lo sa
  fare; «Send to a friend» sotto il cuore della mappa e sulle schede; il
  disegno ricevuto si apre sulla mappa come un preferito. #627, #634
  (`0038`), #635, #636, #639; impronta iOS `83793e26`. **Server, «App
  Privacy»/«Data safety», OTA e sito col sì dell'utente; da provare sul
  telefono.** Parte E (expo-video) al taglio della 1.0.2. `tasks/TASK-333.md`.
- **App** — TASK-335 (ADR-0291, che cambia il punto 3 di ADR-0277; segnalazione e scelta «Durante l'attesa» dell'utente del 2026-10-29): mentre «Draw» calcola, le sei schede «MEANWHILE, FROM THE FEED» hanno sotto la linea la foto della mappa del posto, come in «Feed». Le scatta una pagina nascosta sotto la fila, due schede alla volta, con la cache del Feed; senza rete, dopo due foto mancate non ne chiede altre. «Maps: …» sotto la fila. Misurato nel simulatore iOS: cuore da 5 km a Trento sul telefono, 7701 ms senza e 7714 ms con le sei foto (tre giri ciascuno), quindi nessun rallentamento visibile. Solo app, nessun testo nuovo, `RoutePanel.tsx` non toccato, impronta iOS `83793e26`. **Da vedere sull'iPhone** con la prossima preview. `tasks/TASK-335.md`.
- **App** — TASK-330 (segnalazione dell'utente del 2026-10-29): le foto dei post si vedono sul telefono. Si chiedevano senza `X-API-Key` e il server rispondeva 401 (Feed, galleria del profilo, disegno aperto); e nel Feed lo swipe sulla figura girava la pagina su Draw, perché su iOS uno `ScrollView` dentro un `Pressable` toccato non scorre: ora il disegno e ogni foto prendono il tocco da soli. Riprodotto e verificato nel simulatore iOS. Solo JS, impronta invariata. `tasks/TASK-330.md`.
- **App** — TASK-332 (una riga in ADR-0131; richiesta dell'utente del 2026-10-29): nella griglia «Drawings» del profilo, proprio e di un altro, ogni disegno ha sotto la foto della mappa del posto, come in «Feed», con «Maps: …» una volta sotto la griglia. La foto si chiede solo quando la miniatura entra nello schermo (`SightScrollView` in «Profile» e «Find friends»); sopra la mappa grande il profilo di un altro ha la sua pagina delle foto, e ne lavora una alla volta. Solo app, nessun testo nuovo. **Da vedere sull'iPhone** con la prossima preview. `tasks/TASK-332.md`.
- **App** — TASK-327 (ADR-0286, che cambia ADR-0255; richiesta e scelta dell'utente del 2026-10-29): «Play» non è più il quarto nome in alto accanto a «Explore». In «Draw», subito sotto la distanza e prima di «NEAR YOU», una riga «PLAY» · «Collect shapes by running» · «›», solo mentre l'API ha il gioco; un tocco apre il gioco a tutto schermo (le due schede di sempre) e «←» torna a «Draw». «See collection» e le notifiche del gioco lo aprono come prima. In alto tre nomi, il profilo di nuovo a uno swipe da «Explore». Testi approvati dall'utente, solo app, OTA, impronta iOS `83793e26`. **Da vedere su un telefono** (solo nei test finora). `tasks/TASK-327.md`.
- **Scheda dell'App Store** — TASK-328 (richiesta dell'utente del 2026-10-29): `apps/mobile/store/screenshots/` e `store.config.json` usano ora le 7 schermate del 2026-10-29 (cuore, gatto, «RUN», Draw, corsa, Explore, Feed; 1320×2868) al posto delle 5 vecchie, così un `eas metadata:push` non le rimette. Sono le stesse caricate dalla «Libreria di risorse» di App Store Connect e mandate in revisione ad Apple il 2026-10-29 alle 00:53. Le immagini creative dell'intestazione (5244×2950) e dei risultati di ricerca (3840×2560) stanno solo in `out/appstore-v2/creative/` e su App Store Connect. Nessun push, niente toccato su App Store Connect. `tasks/TASK-328.md`. Numero dato come TASK-326 e rinumerato TASK-328 il 2026-10-29, con il sì dell'utente: TASK-326 era già il passo medio nel Feed, nel repository MUW.
- **Strumenti e CI** — TASK-325 (ADR-0285; richiesta dell'utente del 2026-10-28): `LPPL1316/MUW`, copia intera di `rockydalbianco/shaperoute` sotto l'utente (dove l'app GitHub di Claude non si può installare), e lo specchio nei due versi: `tools/mirror_repos.py` e `.github/workflows/mirror.yml` in MUW, a ogni push e ogni dieci minuti, portano avanti i branch indietro, creano i nuovi, cancellano i fusi, non toccano i divergenti (rosso, si unisce a mano). Segreto `MIRROR_TOKEN` (token classico con `repo` e `workflow`) messo dall'utente; MUW reso pubblico dall'utente il 2026-10-29 (minuti di Actions). Fuso in `main` di MUW il 2026-10-29 (LPPL1316/MUW#4, `182800a3`), insieme ai due `main` e alla migrazione del dislivello di TASK-324 a `0037`, idempotente. **Aperto**: il `main` di `shaperoute` accetta solo PR (regola del proprietario), lo specchio non può spingerlo: il `main` di MUW aspetta in `sync/muw-main` la PR dell'utente su `shaperoute`; due strade per automatizzarlo in `tasks/TASK-325.md`, «Aperto» 4 (scelta dell'utente). Il server legge ancora `shaperoute`.
- **App e API** — TASK-324 (ADR-0284; richiesta dell'utente del 2026-10-26, che ha scelto «Km anche dalle private» e i testi della privacy): sul profilo di un altro e sul proprio «Distance», «Elev. gain» e «Likes», e le schede «Drawings» | «Photos» (le foto dei disegni, un tocco apre il disegno). L'app manda l'altezza di ogni posizione, l'API conta il dislivello (`runs.climb_m`, migrazione `0037`) e risponde ai totali e a `GET /users/{id}/photos`; con un'API di prima tutto come prima. Informativa e aiuto aggiornati nelle cinque lingue, sito rigenerato. PR #1 di `LPPL1316/MUW` (`84307224`, 2026-10-28), il primo merge nel repository nuovo. **Server e copia del sito prima dell'app, con l'ok dell'utente.** `tasks/TASK-324.md`.
- **App** — TASK-320 (ADR-0280; richiesta dell'utente del 2026-10-28, proposte, testi e riga della privacy approvati lo stesso giorno): disegnare a mano in «Draw» e cambiare ogni figura proposta. Parte A (#612): la quarta scelta «Freehand», la tavola a mano (contorno chiuso dall'app, dettagli appesi, «Erase», «Undo», «Save», niente rete), «Edit the drawing» sotto la forma scelta e sul risultato, «Drawing» dove una foto dice «Image». Parte B (2026-10-29, `feat/TASK-320-b-edit-cards`): «Edit the drawing» sulle schede di «Explore» e dei disegni degli iscritti, dopo «Start», «Draw it near me» ed «Export GPX»; «Save» mostra «Draw» con «Freehand» e la figura, nessuna richiesta prima di «Draw route». Solo app, OTA, impronta iOS `83793e26` invariata. **Da provare col dito sull'iPhone** (l'utente): la tavola, «Erase», l'interruttore a quattro segmenti in italiano e in francese. `tasks/TASK-320.md`.
- **App** — TASK-317 (ADR-0277; richiesta e scelta dell'utente del 2026-10-28): l'attesa in «Draw». Prima del calcolo la scheda dice «Warming up: heart…» («Warming up: “CIAO”…», «Warming up: the picture…») al posto di «Waiting for the API…». Dopo 3 s, sotto la barra, «MEANWHILE, FROM THE FEED» con sei disegni di esempio da scorrere, senza rete. Testi approvati, #604 in `main` (d6545be5), impronta iOS `83793e26`. Il gioco «Guess the shape» (#602) è stato chiuso senza merge e il branch `feat/TASK-317-waiting-card` resta su origin. `tasks/TASK-317.md`.
- **App** — TASK-315 (ADR-0275; richiesta dell'utente del 2026-10-27): le foto di un post si vedono nella scheda del Feed, a pagine da scorrere dopo il disegno, con un puntino per pagina sotto; si carica solo la foto dopo quella vista. Solo app, nessun testo nuovo. `tasks/TASK-315.md`.
- **App e API** — TASK-296 (ADR-0255; chiesto dall'utente il 2026-10-23,
  che ha scelto la pagina «Play» dentro MuW): il gioco delle forme. Le
  corse a piedi salvate valgono km e tempi migliori sul server, che
  sblocca forme da collezionare (per distanza totale o per passo) e tiene
  squadre e sfide con una forma divisa in pezzi entro una scadenza. API
  #534 (`abb593c5`, A: `game_runs`, `game_unlocks`, regole pure, catalogo,
  `/game/catalog`, `/game/me`, `/game/runs/{key}`, push `shape_unlocked`,
  `game_backfill`; migrazione `0025`) e #540 (`88b63b6e`, C: squadre e
  sfide, otto endpoint, tre push, timer «1 day left»; migrazione `0027`);
  app #536 (`145cf992`, B: la pagina «Play» fra «Explore» e il profilo,
  visibile solo con `GET /game/catalog` a 200, la collezione, la scheda
  «New shape unlocked»), #561 (`a8d75842`, D: la scheda «Challenges»,
  squadre, sfide e pezzi colorati, le push che aprono la sfida) e #564
  (`de4ca26b`, E: la riga del gioco nella scheda della corsa). Tutti i
  testi approvati dall'utente, regola del blocco fra iscritti scelta da
  lui. Chiuso il 2026-10-28. **Sul server A e C dopo Apple, con l'ok
  dell'utente** (migrazioni, deploy, backfill): fino ad allora «Play» resta
  nascosta su `preview`, e le prove sull'iPhone (B, D, E) vengono dopo.
  Regole in `GIOCO.md`, file `tasks/TASK-296.md`.
- **App e API** — TASK-308 (ADR-0268; scelta dell'utente del 2026-10-26,
  «Form in the app»): «Send feedback» in «Settings», un modulo che manda a
  chi gestisce MuW idee e problemi. `POST /feedback` (al più 5 al giorno
  per account, 20 per indirizzo di rete), tabella `feedback`, migrazione
  `0031`; un'email per messaggio a `SHAPEROUTE_FEEDBACK_TO` o a
  `SHAPEROUTE_REPORTS_TO`, con Reply-To l'iscritto. La sezione si vede solo
  quando il server risponde `204` a `GET /feedback`: con quello di oggi
  non c'è. Testi e privacy approvati dall'utente; privacy del 28 ottobre.
  PR #576 (`2a3e3fc9`); app solo JS, impronta iOS invariata. Sul server
  dopo Apple, con il suo ok. `tasks/TASK-308.md`.
- **App e API** — TASK-299 (ADR-0260; scelta dell'utente del 2026-10-24,
  premio senza valore): il primo concorso, vince il post per tutti con più
  reazioni. API #562 (`5f762ae7`: `GET /contests/current`, i comandi
  `open`, `standings`, `close`, la push `contest_won`, `contest_wins` nei
  profili, migrazione `0030`), app #575 (`4771402b`: la scheda sotto la
  lente di «Feed» solo con un concorso, il regolamento ufficiale, il post
  vincitore in cima per 7 giorni, il badge «Winner» nei profili e la fascia
  sul disegno). Testi nelle cinque lingue approvati dall'utente. Sul server
  dopo Apple, con il suo ok. File: `tasks/TASK-299.md`, `CONCORSI.md`.
- **App** — TASK-307 (ADR-0267; richiesta dell'utente del 2026-10-26):
  dal disegno di un altro, aperto dal «Feed» o dal profilo, **«Start»**
  sulla sua traccia tagliata (senza svolte a voce, e la scheda lo dice) ed
  **«Export GPX»** scritto sul telefono, senza tempi né nome. Solo i disegni
  che si possono già vedere, mai con un blocco, mai quelli nascosti: un
  test ciascuno nell'API. Nessun interruttore per chi pubblica (scelta
  dell'utente): la «Privacy» lo dice, in app e sul sito, dal 27 ottobre
  2026. #573, `tasks/TASK-307.md`.
- **CI** — TASK-310 (ADR-0270): `pytest` fermato sotto la 9.2 nelle dipendenze di sviluppo di motore, API e AI; la 9.2.0 rifiuta `approx` su liste di coordinate e aveva reso rosse `main` e tutte le PR del 2026-10-27. Seguito: riscrivere quei test e togliere il tetto. `tasks/TASK-310.md`.
- **App e API** — TASK-300 (ADR-0261; scelta dell'utente del 2026-10-25,
  «a parte SUBITO»): l'indirizzo email confermato con un link
  all'iscrizione e al cambio in «Settings» (il nuovo vale solo
  confermato, il vecchio riceve l'avviso) e «Forgot password?» sotto
  «Log in», con la pagina per la nuova password che chiude ogni sessione.
  Un indirizzo non confermato non blocca niente; i 3 account di prima
  restano non confermati. PR #559 (`57d87a10`), migrazione `0029`; app
  solo JS, impronta iOS invariata. **Spenta** finché il server non ha
  Resend: server dal Coordinatore dopo Apple e col sì dell'utente,
  dominio `getmuw.app` verificato su Resend dall'utente.
  `tasks/TASK-300.md`.
- **API** — TASK-262 B (aggiunta ad ADR-0226; scelte dell'utente del
  2026-10-25): un riassunto email al giorno delle cinque notizie delle
  push a chi ha «Email notifications» acceso, nella lingua dell'email di
  ritorno, con il link per spegnerlo. PR #550 (`ef5021f4`), migrazione
  `0028`. Con la parte A (push, #451) e la C (rubrica, #461) **chiude
  TASK-262**. Si accende con l'email di ritorno (server dal Coordinatore
  dopo Apple, col sì dell'utente). `tasks/TASK-262.md`.
- **App** — TASK-306 (ADR-0266; scelte dell'utente del 2026-10-26): in
  «Draw», con la corsa, «NEAR YOU» sotto la distanza, cerchio, cuore e
  stella da 5 km pronti dalla posizione (dal telefono, tenuti fino a
  1 km), e forme già pronte di città in evidenza a caso quando vicino non
  viene niente, con quanto sono lontane; «Explore» preparato
  all'apertura. In `main` con la #571 (`0bfc07c0`, 2026-10-27). Resta la
  preview (Coordinatore) e il tempo vero sul telefono dell'utente, da
  scrivere nell'Esito del task file.
- **App e API** — TASK-284 (ADR-0244; scelte dell'utente del 2026-10-11):
  l'email a chi non apre MuW da 14 giorni, una per assenza, per ogni
  iscritto con «Email when I'm away» acceso (casella non spuntata
  all'iscrizione, interruttore in «Settings», link in ogni email). Parte A
  #502 (migrazione `0023`, Resend), parte B #556 con la **privacy unica**
  del 26 ottobre 2026 che copre anche le email delle notifiche (TASK-262
  B), quelle dell'account (TASK-300), le segnalazioni (TASK-291), il gioco,
  l'archivio dei percorsi e le push Android. **Spenta** finché il server non
  ha Resend: copia del sito, app pubblicata e server dal Coordinatore dopo
  Apple e col sì dell'utente. `tasks/TASK-284.md`.
- **App** — TASK-303 (ADR-0263; prova sul campo dell'utente a Trento del
  2026-10-25): dopo una deviazione la corsa ritrova il runner più avanti
  sul percorso, dopo 20 m nel suo verso (di traverso no), entro 300 m più
  2 m per ogni metro corso fuori, così una forma che ripassa la stessa
  strada non lo porta a un giro dopo; le svolte del tratto saltato non si
  dicono. Fuori percorso: puntini sulla mappa fino al punto più vicino in
  linea d'aria, «120 m NE» nel banner, una frase a voce una volta. Lo
  stesso in bici e in canoa; distanza e tempo della deviazione contano.
  Provato nei test e nel simulatore iOS. Solo app, impronta iOS invariata.
  **Entra col merge del Coordinatore dopo il sì dell'utente ai testi nuovi
  in 5 lingue** (tabella nella PR #565), poi su `preview` da provare sul
  campo. Segue **TASK-304** (l'attività persa uscendo dall'app).
  `tasks/TASK-303.md`.
- **App** — TASK-304 (ADR-0264, aggiorna ADR-0219 e ADR-0240; prova sul
  campo dell'utente a Trento del 2026-10-25, uscito per una foto):
  **la corsa continua mentre si usa un'altra app**. Diagnosi: la prova era
  con la 1.0.0 (7) di TestFlight, di prima di TASK-272, e `production` non
  ha mai avuto un aggiornamento; MuW era viva e la pausa era quella da
  fermi. Scelta dell'utente del 2026-10-26 («deve continuare a registrare
  la corsa anche mentre si usa un'altra app», poi «Sì, così»):
  un'assenza fino a **10 minuti** (app congelata, o chiusa da iOS e
  riaperta) è corsa, con tempo contato e tratto dritto, mai più lungo del
  vero; oltre, pausa come prima. Riaperta entro 10 minuti la corsa va
  avanti da sola. Il file della corsa si scrive appena l'app va dietro e a
  ogni posizione finché ci resta; la mappa non c'è mentre la corsa è in
  background (nel simulatore circa 110 MB in meno) e torna com'era. Solo
  app, impronta iOS `83793e26…` invariata, nessun testo nuovo. **PR
  #567**, dopo la #565 (TASK-303). Arriva sulla 1.0 solo con un
  aggiornamento su `production` o con la prossima build: lo decide il
  Coordinatore. `tasks/TASK-304.md`.

- **App** — TASK-326 (aggiunta ad ADR-0207; richiesta dell'utente del
  2026-10-26): ogni post del «Feed» dice anche il **passo medio**, in
  fondo alla riga dei fatti: «Star · 4.0 km · 19 min · 4:45 /km»; con
  «Miles» al miglio, in canoa il tempo di 500 m, in bici al km come «My
  activities»; per gli iscritti dai secondi della corsa. Solo app
  (`feed/FeedPost.tsx`), nessun testo nuovo. Numero preso come primo
  libero da una sessione cloud, da confermare col Coordinatore; branch
  `claude/sweet-carson-vi9ekn`. `docs/UI.md` («Feed») da allineare dopo
  TASK-309 B, che lo ha in lavorazione. `tasks/TASK-326.md`.
- **Motore** — TASK-298 (ADR-0259; seguito di TASK-297, l'utente il
  2026-10-24: «sì, apri anche quello per fermarsi prima»): fermarsi prima
  dove la forma non entra nelle strade, **misurato e scartato**. Su 252
  richieste in sette città (`tests/measure_stop_earlier.py`, tracciamento
  per tracciamento) il primo percorso buono compare a qualunque
  tracciamento, anche al 30º di 30 e dal 6º piazzamento inclinato; ogni
  tetto o piazzamento in meno perde buoni (28: 2; 25: 5; 20: 12); le regole
  che li tengono (fase inclinata o rifinitura saltate dopo una fase andata
  male) peggiorano i mediocri senza abbreviare. Resta: una scala già
  tracciata per lo stesso piazzamento non si traccia più (1,3 %; i 129
  buoni identici, i mediocri mai peggiori). **Scelta dell'utente del
  2026-10-26: tetto 30, invariato.** `engine.zip` rifatto, impronta iOS
  `83793e26` invariata. PR #558, `61932179`. `tasks/TASK-298.md`.
- **App** — TASK-302 (aggiunta ad ADR-0047; prova sul campo dell'utente a
  Trento del 2026-10-25): le svolte di un incrocio attraversato a piedi, a
  25 m o meno l'una dall'altra, si dicono e si mostrano come una, con la
  direzione che si vede sul posto (il percorso 20 m prima contro 20 m
  dopo); una manovra che non gira tace, salvo su una via di un altro nome
  («Prosegui dritto su …»). Partenza, «u-turn» e arrivo mai fusi, e le
  indicazioni a più di 25 m dalle vicine identiche a prima (test su Trento
  e sul grafo di Levico di TASK-271). Su una camminata
  vera da Trento Fiere da 30 a 13 indicazioni. Solo app
  (`navigation/simplifyDirections.ts`), nessun testo nuovo; motore, API e
  file della corsa invariati, quindi vale anche per i percorsi già in
  cache. Entra col merge del Coordinatore, poi su `preview` da provare
  sul campo. Seguono **TASK-303** (il rientro dopo una deviazione, testi
  nuovi) e **TASK-304** (l'attività persa uscendo dall'app: prima la
  domanda all'utente sulla build della prova). `tasks/TASK-302.md`.
- **Server** — TASK-122 (ADR-0123), le copie fuori dal server: lo Storage
  Box Hetzner `muw-backups` (`u700709`, BX11, Falkenstein, 3,20 €/mese,
  comprato dall'utente il 2026-10-25) riceve ogni notte alle 02:30 UTC le
  13 copie del database e gli eventi delle ricerche. Primo invio a mano il
  2026-10-25, 1,5 s; una copia ripresa da lì ha lo stesso SHA-256 e si
  ripristina in `restore_check`, con 3 account e le migrazioni 0001–0021. È
  stato ricreato solo `offsite`, senza riavvii di API e database. Il
  server nella Console ora si chiama `muw`, il progetto `MuW`. L'iscrizione
  dall'iPhone la conferma l'utente. **TASK-122 è Done**; resta da guardare il
  2026-10-26 il primo invio notturno. `tasks/TASK-122.md`, `DEPLOY.md` F.13.
- **Motore, API e app** — TASK-190 (ADR-0153; chiuso il 2026-10-25): i
  percorsi in bici, parti A, B e C in `main` dal 2026-10-02 (PR #214, #219,
  #221). I campioni sono tutti giudicati dall'utente: oltre ai cinque di
  Trento del 2026-10-03, il 2026-10-25 il cerchio da 20 km di Trento «sì»
  (0,93), Levico cuore 10 «no», cerchio 10 «quasi», stella 10 «no», cuore
  20 «quasi», cerchio 20 «quasi», stella 20 «no» (0,71–0,94; a 20 km un
  terzo di sterrato, il cerchio da 10 km con 2,3 km di bici a mano per il
  posto), Padova «sì» per cuori, cerchi e stella da 20 km, «quasi» la stella
  da 10 (0,91–0,96: in pianura la bici disegna come la corsa). Zone
  scaricate da Overpass sul Mac, una per luogo; motore di `main` `263e86d`,
  1–5 s a campione. Nessuna correzione del motore: i difetti visti (stelle
  in valle, gallerie, sterrato, metri a piedi dove il posto li chiede) sono
  già noti in ADR-0167 e «Fuori scope». La prova vera sul server è quella
  del coordinatore del 2026-10-03 (TASK-205 e TASK-206: zona di Trento
  dall'estratto, 72 + 31 MB, 167 s, osmium 3,6 GB; cerchi 10/20/30 km in
  22/28/39 s, 0,88/0,87/0,73), ora scritta nel task file. **Resta**: una
  verifica leggera sul server (le zone `bike_*`, un cerchio da 10 km,
  `docker stats`), pronta coi comandi nel task file, dopo l'approvazione di
  Apple e con un sì dell'utente; la domanda 1 («Explore» e «Feed» con
  «Bike»), che resta dell'utente. PR dei campioni sul branch
  `chore/TASK-190-bike-samples-levico-padova`. `tasks/TASK-190.md`.
- **API** — TASK-291 (ADR-0251; chiesto dall'utente il 2026-10-17): ogni
  segnalazione nuova arriva per email a chi gestisce MuW, con il link
  firmato «Hide» (7 giorni, una volta, con «Undo»); il nascosto sparisce
  agli altri, non all'autore. Migrazione `0024_hidden_content.sql`. Invia
  con `resend_email.py` di TASK-284 A (#502): un solo codice parla con
  Resend, le stesse `RESEND_API_KEY` e `SHAPEROUTE_EMAIL_SECRET`. In
  `main` con la #525 (2026-10-25). **Spenta** finché il server non ha
  anche `SHAPEROUTE_REPORTS_TO`; prima la privacy che nomina Resend (parte
  B di TASK-284), poi il server dal Coordinatore dopo Apple e col sì
  dell'utente. `tasks/TASK-291.md`.
- **App** — TASK-210 parte H, la chiusura della lingua dell'app (aggiunta
  ad ADR-0172): letto tutto il codice dell'app in cerca di testi fuori da
  `t()`, tradotti gli ultimi che si vedono o si sentono: la riga sotto la
  partenza di «Draw» (`location/startStatus.ts`, prima in `App.tsx`),
  «PARTENZA», «La mia posizione», «Un altro posto», la nota senza
  percorsi consigliati e «a 1,4 km» in «Explore», l'attesa del percorso a
  tema, «47% disegnato», le lettere della direzione («SO», «O») e
  «mancano 3,2 km» nella corsa, «Pagaia ·» e «Bici ·» nel Feed,
  «Immagine» fra i preferiti, VoiceOver dopo «Save». Le mappe del Feed
  seguono un cambio di lingua; le schede di «Explore» e «Draw» scrivono
  la virgola («5,2 km»). 23 testi nuovi. **TASK-210 è Done**; seguiti
  fuori scope nel task file: le traduzioni dell'API (percorsi a tema,
  errori, Strava, push, email), il francese fra «tu» e «vous».
  `tasks/TASK-210.md`.
- **Motore** — TASK-277 (aggiunta ad ADR-0040, con rimando ad ADR-0148;
  da un `engine_error` nei log dell'API del 2026-10-10): un contorno che
  cade su un solo nodo stradale dà `CollapsedShapeError` (uno
  `ShapeNotDrawableError`) invece di un errore generico; la ricerca salta
  quel tentativo, poi cerca entro 2 km, e se niente si traccia risponde
  `shape_not_drawable` con un messaggio chiaro. Ogni altro percorso
  identico. Mergiata il 2026-10-25 su «finiscilo» dell'utente, dopo la
  #489, con `engine.zip` rifatto e `paddleExamples.json` ridisegnato
  (cambia solo l'impronta `engine`, gli esempi sono identici). In `main`,
  **non ancora sul server**: aggiornamento, `draw_examples` e motore sul
  telefono restano al Coordinatore dopo Apple e con il sì dell'utente,
  insieme a quelli di TASK-271. PR #497. `tasks/TASK-277.md`.
- **Motore** — TASK-271 (aggiunta ad ADR-0045; dalla prima recensione di
  un tester del 2026-10-10): la voce dice «Make a U-turn» anche dove il
  percorso torna indietro fuori da un incrocio, in fondo a un vicolo cieco
  o su un nodo con due strade; le altre curve fuori dagli incroci restano
  in silenzio. Nessun testo nuovo. Mergiata il 2026-10-25 su «ok
  finiscilo» dell'utente, con `engine.zip` rifatto e `paddleExamples.json`
  ridisegnato (cambia solo l'impronta `engine`, gli esempi sono
  identici). In `main`, **non ancora sul server**: aggiornamento,
  `draw_examples` e motore sul telefono (pubblicazione dell'app) restano al
  Coordinatore dopo Apple e con il sì dell'utente; i percorsi già
  calcolati tengono le indicazioni vecchie finché non si rifanno. PR #489.
  `tasks/TASK-271.md`.
- **App + API** — TASK-262 C (ADR-0226, aggiunte del 2026-10-10 e del
  2026-10-25): gli amici dalla rubrica. In «Find friends», sotto la
  ricerca per nome, «Find friends in your contacts»: il permesso solo al
  tocco, dal telefono escono solo gli SHA-256 dei numeri in E.164, il
  server (`POST /people/from-contacts`) li confronta con i numeri salvati
  e non ne tiene nessuno; mai i bloccati, 30 ricerche all'ora per account.
  Privacy del 25 ottobre 2026 nelle cinque lingue e in `site/privacy/`.
  **`expo-contacts` è escluso dalla build nativa** (scelta dell'utente del
  2026-10-25): l'impronta iOS resta `83793e26` e gli update arrivano
  ancora alla 1.0, dove la sezione non si vede; su preview (Expo Go) sì.
  Alla prossima build nativa (1.0.1 iOS, prima Android di TASK-294 B) si
  toglie l'esclusione e si rimette il plugin: «Alla prossima build
  nativa» in `tasks/TASK-262.md`. PR #461. **Restano**, del coordinatore
  con l'ok dell'utente: il server (nessuna migrazione), la copia del sito
  (F.14), preview.
- **App** — TASK-295 (ADR-0254; richiesta e scelta dell'utente del
  2026-10-23): il video della corsa da condividere. In «Share your run»,
  «Export video» accanto a «Instagram» fa un video di 12 s, 9:16, sul
  giallo del post: logo e titolo, la linea della corsa che si disegna
  mentre distanza e tempo salgono, poi il post intero con le emoji, senza
  musica; poi il foglio di condivisione («Save Video», Instagram). Il
  telefono lo fa nel WebView con WebCodecs (H.264 Baseline) e l'app
  scrive l'MP4: nessuna dipendenza nuova, niente di nativo, impronta iOS
  `83793e26` invariata, quindi arriva anche alla 1.0 con un aggiornamento.
  Limite fisso: 360 fotogrammi, al più 2000 punti sulla linea, al più
  ~9 MB. Su `preview` dal gruppo `bed64fd5` (`main` `90691d47`); prova
  sull'iPhone dell'utente del 2026-10-23: «provato, funziona tutto». PR
  #533, `90691d47`. `tasks/TASK-295.md`.
- **App** — prova sull'iPhone dell'utente del 2026-10-19 («provato, funziona tutto») su `preview` dal gruppo `6dab601f` (`main` `b35d461c`): TASK-292 (scegliere la partenza sulla mappa). Riga aggiunta nell'«Esito» del task file.
- **API** — TASK-293 (aggiunta ad ADR-0249; seguito di TASK-288 B): un
  invio a Strava apre un blocco del database alla volta. La corsa letta
  senza lock (un 404 resta prima di un 409), il token nel suo blocco
  (rinnovo sempre uno alla volta per account), poi la corsa bloccata per
  il caricamento come prima; un token rifiutato si rinnova fuori dal
  blocco della corsa. Dal pool una connessione alla volta e nessuna fuori
  dal pool. La stessa corsa va a Strava una volta sola anche con due
  invii insieme o con uno fra la prima lettura e il lock (condizione del
  Coordinatore, provata da un test); una sonda su `Database.connect` in
  `test_strava.py` fa fallire ogni blocco annidato. In `main`, **non
  ancora sul server**: va con il pool, dopo Apple e con l'ok
  dell'utente; cosa guardare dopo l'aggiornamento è nel task file. PR
  #528, `aba94894`. `tasks/TASK-293.md`.
- **App** — TASK-292 (ADR-0252; scelta dell'utente del 2026-10-18): la
  partenza si sceglie anche sulla mappa, senza scrivere la via. Sotto la
  ricerca di «Draw», «Choose on the map» apre la mappa con il segnaposto
  fermo al centro. «Start here» rende il punto la partenza (origine
  `map`, senza nome, nessuna chiamata in rete); «←» non cambia niente.
  Testi nelle cinque lingue approvati il 2026-10-19. Pubblicata su
  `preview` dal Coordinatore; **manca la prova sull'iPhone**, che segna
  lui. PR #527, `b35d461c`.
- **API** — TASK-288 parte B (aggiunta ad ADR-0249; sì dell'utente del
  2026-10-16): il pool di connessioni (`psycopg[binary,pool]`, dipendenza
  nuova). L'API presta da 2 a 10 connessioni tenute aperte; ognuna torna
  come una sessione nuova (`DISCARD ALL`, niente prepared statement),
  anche dopo un errore; tutte occupate per 10 s danno `503
  accounts_unavailable` con `Retry-After`; il pool si chiude quando l'API
  si ferma; un blocco annidato (`strava.py`) ha una connessione sua. In
  locale `/me` da 63 a 4 ms, `/users?q=` da 141–185 a 8–54 ms. In `main`,
  **non ancora sul server**: un'immagine nuova all'aggiornamento dopo
  Apple, con l'ok dell'utente; cosa guardare lì in `tasks/TASK-288.md`,
  «Parte B». Seguito: `strava.py` senza blocco annidato, in una sessione
  sua. PR #524, `42699af4`.
- **App** — prova sull'iPhone dell'utente del 2026-10-17 («provato, funziona tutto») su `preview` dal gruppo `cd521a21` (`main` `ff786f67`): TASK-286 (cambiare figura dalla mappa del risultato), TASK-287 (ricerche in coda, annullo del motore sul telefono) e TASK-290 (le sedici sagome). Righe aggiunte nell'«Esito» dei tre task file.
- **App** — TASK-290 (aggiunta ad ADR-0246, punti 8–10; richiesta
  dell'utente del 2026-10-16): le sagome di «PICTURES» scelte dal
  percorso, non dal disegno. 546 percorsi veri (le 12 sagome di TASK-280 e
  29 nuove, in otto città a 5 e a 10 km, sulle zone del server copiate in
  sola lettura), nessun errore. Tolte bici, cuore con freccia, ancora e
  gelato; aggiunte fungo, auto, maglietta, paperella, stivale, casa, osso
  e coppa. Sedici, le più chiare prima, anche in «Draw on the map» e
  sotto il risultato (33 tessere). La `similarity` del motore non basta
  per giudicare: è sopra 0,9 anche per un percorso illeggibile. Nomi e
  sagome tolte approvati dall'utente. Mergiato come #520 (`ff786f67`);
  su `preview` appena la CI di `main` è verde. Da provare sull'iPhone:
  qualche sagoma nuova a 5 km. `tasks/TASK-290.md`.
- **API** — TASK-288 (ADR-0249, migrazione `0022_faster_searches.sql`;
  dall'analisi delle ricerche del 2026-10-16): le ricerche diverse dal
  percorso rispondono prima, con le stesse risposte. gzip nell'API da
  1 KB in su (il Caddy del server non comprime l'API, controllato dal
  Coordinatore); Geoapify chiesto insieme in `/cities` e
  `/nearby-cities`, 3 s e un secondo tentativo su timeout, 429 e 5xx;
  `draw_examples` richiede un 503 invece di dire «not found»; «Find
  friends» con `pg_trgm` e la foto piccola fatta una volta; feed e
  profili leggono l'anteprima di 64 punti in `drawings.preview` (feed con
  la posizione da 15 s a 0,75 s a pagina in locale); l'uso della sessione
  scritto una volta l'ora. In `main`, **non ancora sul server**: la
  migrazione va con il prossimo aggiornamento, dopo Apple e con l'ok
  dell'utente; la #502 prenderà la 0023. Il pool di connessioni
  (`psycopg_pool`, approvato dall'utente) è un passo a parte
  (`tasks/TASK-288.md`). PR #518, `2d8b4562`.
- **App** — TASK-287 (ADR-0248; dall'analisi della lentezza del
  2026-10-16): una sola coda per le richieste di percorso dell'app
  (`src/api/routeQueue.ts`). Prima quelle dell'utente («Draw», spostare
  la forma di un esempio, il percorso a tema), poi gli esempi della
  pagina di «Explore», poi le forme sull'acqua in anticipo. Niente in
  sottofondo mentre gira una richiesta dell'utente, al massimo 22 al
  minuto (8 dei 30 sempre dell'utente), un minuto di pausa dopo un 429.
  Sul telefono un «Draw» annullato esce dalla coda, o fa ripartire la
  pagina di Python se è in calcolo, e il prossimo non aspetta il vecchio.
  Python parte appena una zona salvata copre la posizione. Il chip delle
  città in evidenza non chiede più `/cities`, i campioni dei paesi vicini
  sono già esempi del paese, `city-examples.json` è scritto una volta per
  gruppo, e dopo un `/places` lento si usa Photon per 3 minuti. Provato
  nel simulatore per la coda; l'annullo sul telefono resta da provare
  sull'iPhone (`tasks/TASK-287.md`, «Esito»). PR #517, `2259a5df`.
- **API** — TASK-289 (ADR-0250; dall'analisi della lentezza del
  2026-10-16, prepara la parte A di TASK-276): ogni job di percorso scrive
  nel log una riga `job <id>: times total=… crop=… loads=… download=…
  start=… traces=… converged=… far=… wait=… nearby=… chosen=…
  directions=…`, senza posizioni. Le chiavi sono spiegate in
  `shaperoute_api/job_times.py`. L'immagine Docker porta il bytecode dei
  tre pacchetti (`compileall`). Il motore non è toccato: l'impronta resta
  `9342c26d4006` e gli esempi tenuti sul server valgono ancora;
  `engine.zip` è ricostruito. Sul Mac un cuore da 5 km costa 1,1–2,9 s, e
  il bytecode fa risparmiare solo 23 ms per processo `spawn`. Con il Mac
  carico lo stesso cuore sale a 12–13 s: la CPU contesa è la prima ipotesi
  da controllare sul server. Mergiato come #515 (`cd5a4a3f`). Prossimo
  passo: TASK-276 parte A, con un'immagine nuova sul server, dopo Apple e
  con l'ok dell'utente. La parte B (due tempi in `NearbyPlan`) si fa solo
  se serve. `tasks/TASK-289.md`.
- **App** — TASK-286 (aggiunta ad ADR-0245, punti 10–14; scelta
  dell'utente del 2026-10-15, «sì, dai la possibilità di cambiare figura
  dalla mappa»): sotto un percorso disegnato, da «Draw» o da «Draw on the
  map», sopra «Start» c'è la riga della tela, 17 forme e 12 immagini (con
  «Paddle» solo le forme), con la figura del percorso segnata. Un tocco
  ridisegna subito dalla stessa partenza e con la stessa distanza: da
  «Draw» la figura diventa la scelta di «Draw» e «←» la ritrova; sull'acqua
  una forma spostata resta dov'era; dalla tela la figura nuova prende il
  posto della vecchia (stesso centro, distanza del percorso) e «Undo» la
  rimette. Nessun testo nuovo né dipendenza; in `main` con la #513
  (`52b331f7`). Solo app, pubblica il Coordinatore; non nella 1.0. Il tocco
  vero sull'iPhone resta all'utente. `tasks/TASK-286.md`.
- **App** — TASK-285 parte B (ADR-0247, punti 5–8; chiesto dall'utente il
  2026-10-13, «come sull'app bEND», scelte sue del 2026-10-14): «Stretch»
  sulla scheda di fine corsa apre cinque esercizi uno dopo l'altro,
  quadricipite, posteriore della coscia, polpaccio, flessori dell'anca e
  gluteo, 20 s per lato (3 min 20 s), con una figura stilizzata vista di
  lato che entra in ogni posa, una riga su come si fa, il conto alla
  rovescia, un «ding» nostro fra un lato e l'altro, «Pause» e «Skip» (o
  «Done») verso «Your run». File nuovi in `src/stretch/`, poche righe in
  `App.tsx`, suono da `tools/stretch_chime.py`. Nessuna dipendenza nuova.
  Le pose viste in Expo Go nel simulatore. Niente cambia nell'API né sul
  server; pubblica il Coordinatore; non nella 1.0 in revisione.
- **App** — TASK-278 parte B (aggiunta ad ADR-0124; scelte dell'utente del
  2026-10-13, «sì, portali tutti alla 4ª pagina»): gli altri ingressi al
  profilo portano alla **quarta pagina**. La lente di «Feed» senza account
  ci arriva con «Log in to find your friends.»; il cuore sulla mappa e la
  riga sotto la fine della corsa senza account con la loro riga, «←» e il
  titolo finché nessuno entra, e appena si entra l'app torna da sola dove
  era (percorso tenuto, «Save» e «Discard» sotto la corsa). Il profilo di
  un altro, da un nome taggato o da una notifica, si apre sopra l'app e «←»
  mostra l'app com'era, non più «Profile»; il proprio nome taggato porta
  alla quarta pagina. Nessun testo nuovo. Solo app, non nella 1.0: la
  pubblica il coordinatore. `tasks/TASK-278.md`, «Parte B».
- **App** — TASK-281 (ADR-0245; chiesto dall'utente il 2026-10-11, scelte
  sue del 2026-10-11 e del 2026-10-13): in «Draw», sotto «Shape | Word |
  Image», «Draw on the map» apre la mappa della partenza. Un dito disegna
  (la linea si chiude da sola, le linee dopo si appendono come dettagli),
  oppure una tessera mette una delle 17 forme, delle 12 immagini pronte
  di TASK-280 o una foto («+ photo»); con «Move» la figura si trascina e
  si ridimensiona con due dita, con la distanza che segue, una tessera la
  cambia dov'è e «Undo» toglie l'ultima cosa. «Draw route» chiede il
  percorso con le richieste di sempre (forma, o contorno come «Image»),
  dal primo punto della figura e con la sua distanza: il motore può
  spostarla, il posto esatto è TASK-282. Il risultato è quello di «Draw»
  e «←» torna alla figura. Le forme per l'app le scrive
  `tools/catalogue_shapes.py` dal motore: chi cambia una forma lo
  rigenera (il test di `tools/` lo dice). Provato nel simulatore; resta
  all'utente il dito vero sull'iPhone. Niente cambia nell'API né sul
  server; pubblica il Coordinatore.
- **App** — TASK-280 (ADR-0246; chiesto dall'utente il 2026-10-11, scelte
  sue del 2026-10-13): in fondo a «Draw», sotto la distanza, due righe da
  scorrere. «CITY TOURS»: Famous Places, Best Views, Hidden Gems e Romantic
  «near your start» (l'app non sa il nome del paese di una posizione GPS),
  chiesti come «Ask for a route» con «Near me»; si aprono sulla mappa coi
  luoghi, e «Back to Draw» o «←» tornano a «Draw». «PICTURES»: dodici
  sagome disegnate da `tools/sample_pictures.py` (bici, scarpa, dinosauro,
  chitarra, Torre Eiffel, razzo, cuore con freccia, ancora, aereo, gelato,
  palloncino, foglia), col contorno del motore già nell'app: un tocco le
  mette in «Image», «Draw route» manda quel contorno. Con «Paddle» nessuna
  delle due. Solo app, non nella 1.0; la pubblica il Coordinatore. Da
  provare sull'iPhone. File: `tasks/TASK-280.md`.
- **App** — TASK-278 (aggiunta ad ADR-0124; chiesto dall'utente il
  2026-10-11, scelte sue): il proprio profilo è **la quarta pagina**, dopo
  «Explore», a uno swipe a sinistra. In alto restano tre nomi; il cerchio
  della foto ha la lineetta quando il profilo è sullo schermo e ci porta
  con un tocco, da qualunque pagina (non apre più un foglio sopra l'app).
  La pagina non ha «←» né titolo (scelta dell'utente del 2026-10-13); si
  rifà a ogni ritorno, così elenchi e richieste sono nuovi. «Settings»,
  «Favorites», «My activities», «Edit profile», «Guide», il profilo di un
  altro e un disegno si aprono sopra l'app come prima, e «←» torna alla
  quarta pagina. Il cuore e «Save» senza account, la lente di «Feed» senza
  account, i nomi taggati e le notifiche aprono «Profile» sopra l'app come
  prima: portarli alla quarta pagina è da chiedere all'utente. «Help» dice
  ora «four pages» nelle cinque lingue (sì dell'utente). Solo app, non
  nella 1.0: la pubblica il coordinatore. `tasks/TASK-278.md`.
  Chiesto il 2026-10-13: ci portano, con la parte B (sopra).
- **App** — TASK-273 (ADR-0241; dalla prima recensione di un tester del
  2026-10-10, scelta dell'utente «Automatico, dove la tocchi»): lungo una
  forma chiusa la corsa comincia dove il corridore raggiunge la forma (3
  posizioni di fila, 20 m lungo la forma, il passaggio percorso nel verso
  del percorso), fa tutto il giro e finisce lì; la voce dà le svolte da quel
  punto, compresa quella alla vecchia partenza, ricavata sul telefono con la
  regola del motore. Parole e forme aperte come prima; anche una corsa
  riaperta (TASK-272) rientra nello stesso punto, e una parola riaperta
  resta una parola. PR #493, merge `f7ddfe81`, dopo la #492 e il taglio
  della build 6. Solo app, nessun testo nuovo, non nella 1.0: la pubblica
  il coordinatore. Provata nel simulatore con un cuore vero di 3,9 km a
  Trento; resta la prova correndo. `tasks/TASK-273.md`.
- **App** — TASK-272 (ADR-0240; dalla prima recensione di un tester del
  2026-10-10, scelta dell'utente «Riapre la corsa in pausa»): se l'app si
  chiude durante una corsa, riaprendola entro 2 ore si apre la corsa **in
  pausa**, lungo lo stesso percorso (indicazioni, parola, tratti a piedi e
  rotazione presi dal file della corsa) o senza percorso: «Resume» o
  «Stop» tenuto, il tempo chiusa è una pausa, e dopo «Resume» il
  navigatore ritrova chi corre anche più avanti (TASK-270). Più vecchia di
  2 ore, la fine della corsa come prima. PR #492, entrata dopo il taglio
  della build 6. Solo app, nessun testo nuovo; la pubblica il
  coordinatore. Provata nel simulatore (Expo Go); resta la prova correndo.
  TASK-273 (#493) tocca gli stessi file ed entra dopo. `tasks/TASK-272.md`.
- **App** — TASK-275 (aggiunta ad ADR-0228, per la risposta ad Apple del
  2026-10-11, «Guideline 2.1 – Information Needed»): tenendo premuto il
  commento di un altro, «Report» (i cinque motivi) e «Block» chi l'ha
  scritto; sotto il proprio disegno anche «Delete», il proprio commento
  solo «Delete». Alert nativi, le stesse scelte come azioni di VoiceOver.
  Nessun testo nuovo, niente server (l'API accettava già
  `kind: "comment"`). Entra nella **build 6**, quella su cui l'utente
  registra il video chiesto da Apple; via della build dal Coordinatore.
  `tasks/TASK-275.md`.
- **App** — TASK-270 (aggiunta ad ADR-0052, dalla prima recensione di un
  tester del 2026-10-10): dopo 20 s senza posizioni (app dietro un'altra,
  congelata da iOS, corsa ripresa) il navigatore cerca il corridore su
  tutto il percorso avanti e riprende da lì dopo due posizioni, senza
  ridire le svolte saltate. Prima, oltre 300 m d'assenza, restava «fuori
  percorso» fino alla fine. PR #486, merge `0a589ddd`. Solo app, nessun
  testo nuovo; non è nella build 5: su `preview` dal 2026-10-10 nel gruppo
  `cd929227` (da `066d10e8`), poi con un aggiornamento della 1.0. Resta la
  prova correndo. Dalla stessa recensione: TASK-271 (inversione a U nei
  vicoli ciechi), TASK-272 (corsa interrotta riaperta in pausa), TASK-273
  (partire da qualsiasi punto di una forma chiusa). File:
  `tasks/TASK-270.md`, «File toccati».
- **Test** — TASK-274 (aggiunta ad ADR-0120): il database dei test
  dell'API si chiude con `docker rm -f -v`, quindi se ne va anche il
  volume anonimo dei dati. Prima ogni giro ne lasciava uno: il 2026-10-10
  il disco di Colima sul Mac era pieno (168 volumi, 17,6 GB) e i test del
  database fallivano. `tasks/TASK-274.md`.
- **App** — TASK-266: il tour del primo avvio e «Guide» in «Profile»
  (ADR-0235; richiesta dell'utente del 2026-10-09, che ha scelto il tour
  sulle schermate vere). In `main` con la #479 (`1f64621e`, 2026-10-10).
  Dopo l'animazione all'avvio, la prima volta, otto passi sopra l'app
  vera (benvenuto, «START», forme, distanza, «Draw route», sport e
  «Profile», pagine «Explore» e «Feed»), il resto scuro con il colore
  fisso `scrim`; «Skip» non si tocca per 5 secondi e conta alla rovescia.
  «Guide» subito sotto «Settings» con un account, in fondo senza; apre «How
  MuW works» con «Watch the tour». Testi nelle cinque lingue **approvati
  dall'utente** il 2026-10-10. Provato nel simulatore. Solo app: su
  `preview` dal 2026-10-10 nel gruppo `ab5706fc` (da `1f64621e`, prima
  delle push di TASK-262 A). `tasks/TASK-266.md`.
- **App** — TASK-269 (ADR-0239): in «Explore» con «Paddle» laghi e mare
  suggeriti vicino alla zona di casa, calcolata sul telefono dalle
  attività e cancellata al logout, con «Show more», la riga «Suggested
  near …» e i chip «Lakes» / «Sea»; le forme già sul telefono seguono la
  stessa zona. Frase nuova nella privacy, app e sito. Richiesta
  dell'utente del 2026-10-09, il come deciso dall'agente su delega; testi
  approvati. Copia del sito e pubblicazione: del coordinatore.
- **App e API** — TASK-245 parte C (ADR-0210, aggiornamento): **38 posti
  di mare in più** per «Paddle», scelti dall'utente il 2026-10-09 sulla
  proposta dell'agente, sulle coste che ne avevano meno: `PLACES` e
  `beaches.json` da 29 a 67, **tutti a 2 km** e con le otto forme, nessuno
  scartato. L'acqua (38 file, 20,3 MB) è sul server dal 2026-10-10, prima
  del merge, con l'ok dell'utente; SHA-256 uguali, provata nel container.
  PR **#480** mergiata (`793fa11`, 05:00Z) col via del coordinatore.
  **Del coordinatore**: l'aggiornamento del server (`beach_catalog.py`, ok
  dell'utente già dato), la pubblicazione dell'app e un solo
  `draw_examples --water`, con l'ok dell'utente, finito il lavoro delle
  zone europee. Poi la prova sull'iPhone. `tasks/TASK-245.md`, «parte C».
  **Fatto dal coordinatore**: server con `beach_catalog.py` (67 posti) dal
  2026-10-10 05:11Z (main `55b990be`), su `preview` nel gruppo `999502dd`
  e nella build 5 (`793fa112`). Il `draw_examples --water` aspetta
  l'approvazione di Apple della 1.0 e l'ok dell'utente.
- **App** — TASK-261 parte B (aggiunta ad ADR-0225): durante la corsa la
  voce parla a telefono bloccato e con l'interruttore silenzioso, e
  abbassa la musica di un'altra app mentre parla (scelte dell'utente del
  2026-10-10). Dipendenza nuova `expo-audio`, `UIBackgroundModes` `audio`,
  `src/voice/runAudio.ts`; testo del microfono approvato. PR #475, merge
  `d10df4a5`. Serve una build nativa nuova (obiettivo del coordinatore:
  build 5); con Expo Go e la build 4 la voce resta come prima. Dopo il
  merge, `npm install` nel checkout principale. Resta la prova
  sull'iPhone. File: `tasks/TASK-261.md`, «File toccati (parte B)».
- **App** — TASK-268 (aggiunta ad ADR-0137): sulla pagina «Data» della
  corsa l'indicazione resta in alto, «Pause» e «Map» / «Data» in fondo, e
  scorrono solo i numeri in mezzo. Prima, con l'indicazione in alto,
  «Map» finiva sotto il bordo (corsa su strada dell'utente del
  2026-10-09). PR #472, merge `0a07f757` il 2026-10-10; nessun testo
  nuovo. Resta lo swipe col dito sull'iPhone. File: `tasks/TASK-268.md`.
- **API e app** — TASK-262 parte A: le notifiche push partono (ADR-0226;
  scelte dell'utente del 2026-10-07). PR #451, merge `578c2f7e` del
  2026-10-10. Tabella `push_tokens` (migrazione `0021`), `PUT`/`DELETE
  /me/push-token`, invio con il servizio push di Expo fuori dalla
  richiesta; richiesta di follow, richiesta accettata, reazione, commento
  e tag notificati una volta a chi ha «Push notifications» acceso, mai
  fra bloccati (TASK-121) né a chi ha agito. Nell'app
  `expo-notifications`, il permesso chiesto solo dall'interruttore, il
  tocco che apre il disegno o il profilo. **Da fare**: la `0021` sul
  server e la pubblicazione (coordinatore, con l'ok dell'utente), la
  prova con una build nativa, `npm install` nel checkout principale.
  `tasks/TASK-262.md`. **Fatto dal coordinatore**: la `0021` è sul
  server dal 2026-10-10 05:11Z (main `55b990be`, ok dell'utente), su
  `preview` nel gruppo `999502dd` e nella build 5 (`793fa112`).
- **API e app** — TASK-121: segnalare e bloccare (ADR-0228; brief del
  coordinatore del 2026-10-07/08). Branch `feat/TASK-121-report-block`,
  migrazione `0020_moderation.sql` (`blocks`, `reports`). Un blocco tiene
  lontani i due nei due sensi in feed, commenti, reazioni, ricerca,
  follow, profilo e disegni (anche aperti per id), e chiude ogni follow
  fra loro; `PUT`/`DELETE
  /users/{id}/block`, `GET /me/blocked`, `POST /reports` (disegno,
  commento o persona, con un motivo di cinque). Nessun endpoint legge le
  segnalazioni. Nell'app il «…» sul post e sul profilo di un altro, il
  foglio con «Report» e «Block», «Blocked people» in «Profile»; 21 testi
  nuovi nelle cinque lingue, **confermati dall'utente** il 2026-10-09. Restano la
  migrazione sul server (ok dell'utente, coordinatore) e la prova con due
  account. `tasks/TASK-121.md`. **In `main`** con la #457 (`a66341aa`,
  2026-10-10): chiuso; da qui partono TASK-262 A e C. **Sul server** dalle
  04:25Z del 2026-10-10 (migrazione 0020, ok dell'utente; copia
  `shaperoute-2026-10-10T0421Z.dump`, immagine `before-task121`). Su
  preview nel gruppo `872cd266`; **provato dall'utente sull'iPhone con due
  account** il 2026-10-10 («ok ci sono funzionano»).

- **App e sito** — TASK-267 (ADR-0237): la 1.0 dell'App Store **senza
  pubblicità**, scelta dell'utente del 2026-10-09 (gli annunci con la
  società). Con `APP_VARIANT=production` il codice nativo di AdMob non
  entra nella build (#469); «Termini» e «Privacy» dicono che MuW non mostra
  pubblicità, nell'app e su `getmuw.app/privacy` (#474, testi approvati).
  Preview ed Expo Go come prima. La verifica sulla build 5 è della sessione
  «App Store submission». TASK-153 (annunci veri) aspetta la società.
- **API** — TASK-246 parte B: il server tiene le figure «Paddle» dei
  laghi e delle spiagge (aggiunta ad ADR-0211). In `main` dalla #462
  (`589fdece`, 2026-10-09, merge chiesto dall'utente al verde). Le figure
  chieste dai punti di `lakes.json` e `beaches.json` restano in
  `routes/water/`: un telefono nuovo dove un altro ha già chiesto non fa
  lavorare il motore (a Levico, sul Mac, 11 s → 0 s); `draw_examples
  --water` le disegna prima. App invariata. **Non ancora sul server**:
  aggiornamento e `draw_examples --water` (stimato 4–8 ore, circa 50 MB)
  del coordinatore, con l'ok dell'utente; senza, il server disegna come
  prima e tiene per i telefoni dopo. `tasks/TASK-246.md`, «Parte B».
- **App** — TASK-251 parte C: in bici senza percorso la velocità
  (aggiornamento di ADR-0215, scelta dell'utente del 2026-10-08). In `main`
  con la #458 (`fb27b50d`, 2026-10-09). Con «Bike» in «Settings» «Ride
  without a route» mostra «Speed now», «Avg speed», «Last km» e i km in
  km/h (mph con le miglia), sulla scheda e a fine corsa, come un percorso
  in bici; nessun testo nuovo; corsa e «Paddle» come prima. **Da fare**:
  la pubblicazione su `preview` (coordinatore) e la prova sull'iPhone. La
  voce resta ogni km col passo, come una corsa: scelta dell'utente del
  2026-10-09.
  `tasks/TASK-251.md`.
- **App** — TASK-264: **il tipo di mappa** (ADR-0232; chiesto
  dall'utente il 2026-10-08). Un pulsante in alto a destra sulla mappa
  sceglie **Standard**, **Satellite** (foto Esri, i nomi dei paesi in
  chiaro) e **3D** (il rilievo con l'ombreggiatura, mappa inclinata a
  55°, come Strava e komoot); la scelta resta sul telefono. Lo stile non
  si ricarica: percorso e inquadratura restano. Gli edifici in 3D sono
  stati provati e tolti perché coprivano il percorso. Testi nelle cinque
  lingue approvati dall'utente (2026-10-09). Solo app: dopo il merge si
  pubblica, niente server. **Resta**: la chiave gratuita ArcGIS
  (`EXPO_PUBLIC_ARCGIS_API_KEY`), quando l'utente crea l'account; senza,
  le foto vengono dall'indirizzo pubblico di Esri. `tasks/TASK-264.md`.
- **API e app** — TASK-234 parte C: il «Try N km» della riga «comes out
  better» si conta (scelta dell'utente del 2026-10-08, aggiunta ad
  ADR-0197). PR #459: `hint_taken` con `hint: "better_distance"`,
  additivo (un'API di prima risponde 422 e l'app lo ignora). Il segno
  visibile mentre si calcola c'era già: il pannello dell'attesa con la
  barra e «Cancel» prende subito il posto della riga. Nessun testo nuovo,
  nessuna migrazione. Dopo il merge: il server (`signals.py`, ok
  dell'utente, coordinatore) e la pubblicazione dell'app. File:
  `tasks/TASK-234.md`, «File toccati». In `main` dalla #459
  (`5f028e8d`, 2026-10-09); l'utente ha confermato che il pannello
  d'attesa basta e ha dato l'ok per il server dopo il merge.
- **App** — TASK-263: tono scuro o chiaro, con la luminosità in cinque
  passi (ADR-0231; chiesto dall'utente il 2026-10-08). PR #444. In
  «Settings», «PREFERENCES», la riga «Tone»: «Dark» o «Light»,
  «Brightness» in cinque passi, un'anteprima nei colori scelti e «Apply»,
  che salva la scelta (`tone.json`) e riapre l'app (`reloadAppAsync`) nel
  tono nuovo. Senza scelta l'app è quella di prima (scuro, passo 1); il
  chiaro parte dal bianco, con la mappa chiara, il percorso giallo su un
  bordo scuro e la barra di stato scura. I contrasti di ogni tono a ogni
  passo sono un test. Testi in cinque lingue approvati dall'utente il
  2026-10-09; provata nel simulatore in Expo Go. Solo app: va pubblicata
  su `preview`, il server non cambia. **Parte B**, da aprire: le tastiere,
  ancora scure nel tono chiaro, e il logo bianco «Compatible with Strava»
  sul fondo chiaro.
- **App** — TASK-261 parte A: la corsa registra anche a telefono bloccato
  (ADR-0225; chiesto dall'utente il 2026-10-07). In `main` con la #441
  (`08793f4`, 2026-10-08). Nell'app costruita il GPS va avanti in
  background con il solo permesso «While using» e la pillola blu di iOS
  (dipendenza nuova `expo-task-manager`, `UIBackgroundModes` `location`);
  la pausa automatica funziona come in primo piano; la linea si taglia
  solo se iOS congela l'app. In Expo Go e su Android tutto come prima,
  quindi la pubblicazione su `preview` non cambia niente. Testo nuovo del
  permesso in cinque lingue (`apps/mobile/locales/`), approvato
  dall'utente. Provato nel simulatore con una build nativa; **la prova
  sull'iPhone vuole una build nativa** ed è dell'utente. Dopo la prova: la
  **parte B**, la voce a telefono bloccato (expo-audio, da chiedere), e
  Android in background, senza numero. Nel checkout principale serve
  `npm install` per la dipendenza nuova. `tasks/TASK-261.md`.
- **Pubblicità** — TASK-150: l'utente ha l'account AdMob **da persona**
  (la partita IVA quando arrivano i guadagni, scelta del 2026-10-02) e ha
  completato il profilo pagamenti (2026-10-08). La guida è
  `docs/PUBBLICITA.md`: come e quando paga Google (soglia 70 €, bonifico
  intorno al 21), i passi, le domande per il commercialista. Prossimi:
  TASK-152 (App Store) e TASK-153 (annunci veri, unità **nativa** per il
  Feed). Chiesti dall'utente il 2026-10-08: annunci anche sul sito.
- **App e API** — TASK-092: la riga **«RECOMMENDED»** in «Explore»
  (ADR-0229), in `main` con la #445 (`48ba5912`, 2026-10-08). Con un
  account, sopra le schede dei percorsi vicini, al più 10 percorsi del
  catalogo ordinati da `GET /recommended`: prima il disegno venuto
  meglio, poi le reazioni dei disegni pubblicati, poi corse e preferiti; a
  parità tutti. Testo confermato dall'utente nelle cinque lingue. **Non
  ancora sul server** (`best_routes.py`, nessuna migrazione: ok
  dell'utente, coordinatore); l'app può uscire prima, la riga non c'è
  finché manca. Seguito: con TASK-121 le reazioni di chi l'utente ha
  bloccato non contano.
  **Sul server dal 2026-10-09 ~12:20Z** (ok dell'utente, fatto dal
  coordinatore): `main` `fb27b50d`, copia del database
  `shaperoute-2026-10-09T1220Z.dump`, immagine di prima
  `shaperoute-api:before-task092`, migrazioni ancora fino a 0019;
  `/recommended` risponde `401 not_signed_in` senza token, quindi c'è.
  Con un account la riga «RECOMMENDED» ora si vede.
- **Server** — TASK-265: il dominio **`getmuw.app`** (ADR-0234). L'utente
  è rimasto sul server Hetzner e ha comprato il dominio su Porkbun il
  2026-10-08; tre record `A` (`@`, `www`, `api`) verso `188.245.9.220`.
  Caddy di apt serve l'API su `https://api.getmuw.app` accanto a
  `188-245-9-220.sslip.io`, che resta per le app su gruppi vecchi e per il
  ritorno da Strava; certificato Let's Encrypt fino al 2027-01-06, si
  rinnova da solo. L'app di `preview` usa il nome nuovo da `main`
  `08793f41`, gruppo `a39c9509`. Caddyfile e pubblicazione del
  Coordinatore, ciascuno con l'ok dell'utente. **Resta** il sito su
  `getmuw.app` e `www` (TASK-237 B, dopo la #443): come si fa in
  `DEPLOY.md`, F.14. `tasks/TASK-265.md`.
- **Motore** — TASK-203 parte B: la ricerca lontana («Start here» a 1–2
  km, ADR-0040) parte solo dove vicino alla partenza non si disegna
  niente, non più appena il percorso vicino non è buono (ADR-0230; «ok»
  dell'utente del 2026-10-07 a percorsi più veloci anche se diversi, la
  scelta fra le due (B) dell'agente su delega). Misurato sul Mac senza
  rete su 15 richieste in sei città, a caldo e a freddo: −1,3…−1,9 s sui
  cuori e cerchi lunghi (Trento, Bologna, Levico), −3,6…−6,5 s su una
  parola tonda; 14 percorsi scelti su 15 uguali, il cerchio da 15 km di
  Bologna passa da 0,917 a 1 km a 0,884 dalla partenza, il cerchio di
  Trento perde la seconda alternativa. `FAR_TRACES` 10 (nessun percorso
  cambia, 0,1–0,4 s) e l'attesa a 1 s (solo parole con la penna alzata,
  senza alternative) scartati con i numeri (`tasks/TASK-203.md`, «Parte
  B»). Test nuovo `test_far_search_skipped.py`, due impronte aggiornate in
  `test_kept_per_graph.py`, `engine.zip` rifatto. PR #440 (2026-10-08). **Resta**: server e `draw_examples` (circa 40 minuti) con
  l'ok dell'utente.
- **API e app** — TASK-118: il feed vero, versione semplice (ADR-0227;
  l'ordine è scelta dell'utente del 2026-10-07). `GET /feed`: i propri
  disegni, poi quelli di chi si segue, poi i vicini (50 km dal telefono;
  tutti senza posizione), dal più recente, a pagine con cursore, mai un
  privato né una traccia non tagliata; una pagina di venti sotto i 200
  kB. «Feed» li mostra sulle schede degli esempi, un tocco apre il
  disegno con reazioni e commenti; gli esempi restano senza account o
  con il feed vuoto. Fatto il 2026-10-08: server da aggiornare (senza
  migrazioni), app da pubblicare.
- **Motore, API e app** — TASK-191: percorsi in canoa e paddle (ADR-0154,
  ADR-0161, ADR-0164, ADR-0169; chiesto dall'utente il 2026-10-02).
  **A1** PR #216 (l'acqua e la fascia entro 1 km dalla riva), **A2** PR
  #235 (`paddling` nel motore, 1–5 km, al mare oltre 200 m dalla riva),
  **B** PR #241 (l'API sull'acqua, migrazione `0010`), **C** PR #255
  («Paddle» nell'app, l'avviso di sicurezza, «Explore» sull'acqua), tutte
  del 2026-10-02/03. Il punto 5 di A2 (i campioni v2 e Como) e l'acqua dei
  quattro luoghi sul server sono di TASK-225 (#285, 2026-10-04), Ledro di
  TASK-250 (#406); Strava riceve la canoa come `StandUpPaddling` da
  TASK-208 A (#268). Sul server (`873de538`) e su `preview` (gruppo
  `9585ffac`). Chiuso il 2026-10-07 dalla pulizia dei task file.
  **Aspettano l'utente**: il giudizio dei campioni v2
  (`out/task225-paddle-samples-v2.html`), i testi nuovi (`UI.md`,
  «Sull'acqua»; l'avviso è già approvato), se schiarire l'acqua sulla mappa
  scura, la prova sull'iPhone pagaiando. `tasks/TASK-191.md`.

- **App e API** — TASK-260: l'app si chiama «MuW» (ADR-0224; chiesto
  dall'utente il 2026-10-06). **Parte A** PR #426 (`717eb69b`): il nome
  sotto l'icona, i permessi, i testi nelle cinque lingue, aiuto,
  condizioni e privacy, e nell'API «Drawn with MuW», le pagine di ritorno
  da Strava, il `creator` del GPX, il messaggio dei tag; su `preview`
  (gruppo `36e2a9f1`). **Parte B** PR #428 (`873de538`, anteprima
  approvata dall'utente): il cuore su giallo con la scritta «MuW» come
  logo, icona iOS e Android, splash, favicon, `docs/brand/muw-*.svg` e
  il generatore `make_brand.py`; su `preview` (gruppo `9585ffac`), server
  a `873de538` (ok dell'utente). **Resta**: icona, splash e favicon si
  vedono solo con una build nativa; su `preview` arrivano la scritta
  all'avvio e in «salvato». `bundleIdentifier`, `slug` e il sito tengono
  il nome vecchio. `tasks/TASK-260.md`.

- **App** — TASK-251: «Paddle» con velocità in km/h e andatura in
  min/500 m (ADR-0215; chiesto dall'utente il 2026-10-06, unità scelte
  da lui). **Parte A** (l'uscita e la sua fine) in `main` con la PR #383
  (`bf859e0`), **parte B** («My activities», `activity` in
  `/me/activities`, nessuna migrazione) con la PR #394 (`c99b8c8`),
  entrambe del 2026-10-06; sul server (`d7b490f1`) e su `preview` dal
  2026-10-06. Chiuso il 2026-10-06 dalla pulizia dei task file.
  **Aspettano l'utente**: i testi nuovi, «Elev. gain» tolto sull'acqua,
  cosa mostra la bici senza percorso (oggi il passo al km), la prova
  sull'iPhone pagaiando. `tasks/TASK-251.md`.

- **App e API** — TASK-231: il post di una corsa su Instagram e Strava
  (ADR-0194; chiesto dall'utente il 2026-10-04). **Parte A**, l'app, PR
  #303 (`cf973d1`, 2026-10-04): «Share» a fine corsa e in «My activities»
  fa il post 9:16 giallo con emoji e risultati; «Instagram» ne fa un PNG
  e apre il foglio di iOS; «Send to Strava» manda emoji e risultati come
  descrizione. **Parte B**, l'API, PR #306 (`3b6e821`, 2026-10-05): il
  testo del post va come `post` in cima alla descrizione e su una corsa
  già su Strava la cambia («Update on Strava»). Sul server e su `preview`
  dal 2026-10-05. Chiuso il 2026-10-06 dalla pulizia dei task file; resta
  la prova sull'iPhone. `tasks/TASK-231.md`.

- **App e API** — TASK-120: i commenti sotto le corse pubblicate
  (ADR-0175; scelta dell'utente del 2026-10-03: subito sotto le corse
  pubblicate vere, non sugli esempi di «Feed»). In `main` con la PR #260
  (`8a938fd`, 2026-10-03): `GET`/`POST /drawings/{id}/comments`, `DELETE
  /comments/{id}`, tabella `comments` (migrazione `0013`), al più 10 al
  minuto, il filtro di TASK-213; nell'app il foglio dal basso con
  l'elenco e il campo sopra la tastiera, testi in cinque lingue. Sul
  server (migrazione `0013`) e su `preview` dal 2026-10-06. Chiuso il
  2026-10-06 dalla pulizia dei task file. **Aspettano l'utente**: i testi
  nuovi (`UI.md`, «I commenti di un disegno») e la prova sull'iPhone con
  due account. Segnalare un commento: TASK-121. `tasks/TASK-120.md`.

- **App e API** — TASK-117: pubblicare una corsa salvata come disegno
  (ADR-0159, ADR-0166; scelte dell'utente: due PR, anche le corse senza
  percorso). **Parte A**, l'API, PR #232 (2026-10-03): titolo e «Public»
  su una corsa di «My activities», i disegni di un profilo, la traccia
  senza i primi e gli ultimi 200 m; tabella `drawings`, migrazione
  `0009`. **Parte B**, l'app, PR #242 (`18f6d5c`, 2026-10-03): «Public» e
  «Title» a fine corsa e su una corsa aperta, «Drawings» nel profilo, un
  disegno aperto sulla mappa; senza rete la scelta aspetta. Sul server
  (migrazione `0009`) e su `preview` dal 2026-10-06. Chiuso il 2026-10-06
  dalla pulizia dei task file. **Aspettano l'utente**: quattro testi nuovi
  (task file, «Esito») e la prova sull'iPhone. `tasks/TASK-117.md`.

- **App** — TASK-259: «Open Settings» e «Location is off» (ADR-0223;
  seguito di TASK-256 e della revisione del 2026-10-06; testi nelle cinque
  lingue approvati dall'utente). **Parte A** PR #413, merge `2990b9d`,
  2026-10-06, su `preview` (gruppo `f062e005`): «Open Settings» sotto «The
  camera is off for this app…» in «Draw»; la riga rossa della mappa che
  non carica dice «The map could not be loaded. Check the network.», con
  un «Retry» che monta di nuovo la mappa. **Parte B** PR #419,
  2026-10-06: senza il permesso della posizione, o con la posizione del
  telefono spenta, il banner della navigazione e della corsa libera dice
  «Location is off», a cosa serve e «Open Settings» (`LocationOff`). Solo
  app: **la pubblicazione della parte B è del coordinatore**; da provare
  sull'iPhone con la posizione negata. Seguito senza numero: la foto del
  profilo (`profile/useProfilePhoto.ts`) ha la fotocamera negata senza
  bottone. `tasks/TASK-259.md`.

- **App e API** — TASK-258: il post condiviso resta sul server (ADR-0222;
  chiesto dall'utente il 2026-10-06, tre scelte sue: emoji e risultati
  senza l'immagine, salvato quando lo si condivide, rivisto riaprendo
  «Share»). Migrazione **0019** (`runs.post`), `PUT
  /me/activities/{key}/post`, `post` nella corsa intera; nell'app
  «Instagram» e «Send to Strava» mandano il post con la corsa, e «Share»
  da «My activities» lo riapre com'era. L'attività era già tutta sul
  server. **Vuole l'aggiornamento del server** (migrazione, motore non
  toccato) con l'ok dell'utente; poi la pubblicazione. Usare post e corse
  per «cosa piace» è un seguito, in forma aggregata e anonima.
  `tasks/TASK-258.md`.

- **App** — TASK-256: gli errori parlano a chi corre (ADR-0220; dalla
  revisione dell'app, «sì» dell'utente del 2026-10-06, testi nelle cinque
  lingue approvati dall'utente). PR #408, merge `e24c79f3`, 2026-10-06. I
  messaggi di «Draw» e dell'account riscritti per chi corre («No
  connection. Check the network and try again.», «Something went wrong on
  our side…», «Update the app» per la chiave rifiutata e per una build
  senza indirizzo), il dettaglio tecnico solo nelle build di sviluppo;
  «Try again» sotto l'errore di «Draw route» rimanda la stessa richiesta
  (`useRouteRequest.retry()`, `onRetry` su `RouteOutcome`, due righe in
  `App.tsx`); `AppBoundary` attorno all'app in `Root.tsx` (giallo, logo,
  «Something went wrong.», «Try again»); «Retry» sulla mappa che non
  carica, ricarica anche al ritorno in primo piano, `onError(null)` quando
  carica. Solo app: **la pubblicazione su `preview` è del coordinatore**.
  Seguiti senza numero, nel task file: «Open Settings» accanto a
  fotocamera/posizione negate (`ImageChoice.tsx`, `NavigateScreen`,
  `FreeRunScreen`), la riga rossa di `ChooseScreen.MapError` («reopen the
  app») da riscrivere. `tasks/TASK-256.md`.
- **App** — TASK-254: le correzioni piccole della revisione (ADR-0218;
  dalla revisione del codice dell'app del 2026-10-06, «sì» dell'utente).
  Dodici difetti piccoli, ognuno con il suo test, solo app, niente da
  vedere di nuovo: il preferito di un esempio a pezzi tiene la penna
  alzata; una foto negata non azzera il contorno e i ritocchi e dice
  perché; una ricerca di membri fallita si ripete; due richieste di
  «Follow» in corso tengono spenti i bottoni di tutte e due; un 5xx di un
  proxy durante l'attesa del percorso è perdonato come un errore di rete
  (tre di fila no); forma, svolta, stato o codice d'errore nuovi di un
  server più nuovo non rifiutano la risposta; la posizione va a Photon e a
  `/nearby-cities` con due decimali (circa 1 km; «km away» e l'ordine dei
  paesi li misura il telefono dal punto preciso), a `/phone-zones` intera
  (il server sceglie la zona con 3 km di margine attorno al punto); il
  disegno di una corsa lunga da condividere non sparisce; di due città
  chieste in «Explore» resta l'ultima; un controllo fallito non chiude il
  percorso a tema; il conto alla rovescia parte da 3. PR #407, merge il
  2026-10-06; la pubblicazione è del coordinatore. `tasks/TASK-254.md`.
- **App** — TASK-255: la corsa tiene lo schermo acceso (ADR-0219; scelte
  dell'utente del 2026-10-06 dalla revisione). Schermo acceso per tutta la
  corsa, con o senza percorso, non solo in modalità tasca; l'app che va in
  secondo piano per più di 60 s (telefonata, telefono bloccato e
  dimenticato) mette la corsa in pausa fino alla prossima posizione, senza
  riga dritta e senza il tempo di mezzo, entro 60 s (un cambio brano)
  tutto come prima (scelta dell'utente); «Calories» solo correndo. Solo app, nessun testo nuovo,
  nessuna dipendenza nuova. `tasks/TASK-255.md`.


- **App** — TASK-257: una corsa rifiutata resta sul telefono con il
  motivo (ADR-0221; dalla revisione dell'app, «sì» dell'utente del
  2026-10-06). Una corsa a cui l'API risponde `invalid_request` non
  sparisce più: resta nel file segnata e non viene rimandata; in cima a
  «My activities» una riga con giorno, km, «The server could not take
  this run: {message}», «Try again» e «Discard» dopo un sì. Il telefono
  tiene al più 20 corse non mandate **per account** e non ne butta più
  nessuna: «Save» della ventunesima dice che è pieno e la corsa in corso
  resta. Otto testi nuovi nelle cinque lingue, confermati
  dall'utente. Merge #400 (`7da5a8a0`) il 2026-10-06; solo app, la
  pubblicazione è del coordinatore. `tasks/TASK-257.md`.
- **App** — TASK-253: la navigazione non salta avanti e riprende dove era
  (ADR-0217; dalla revisione del codice dell'app del 2026-10-06). Dove il
  percorso ripassa dallo stesso punto entro 300 m la posizione resta sul
  passaggio vicino (andare avanti costa un quarto di metro al metro);
  «You have arrived» alla seconda posizione di fila entro 25 m; dopo
  «Stop» e «Keep running», o l'app chiusa a metà corsa, il navigatore
  riparte da dove la traccia era arrivata (svolte, penna, bici a piedi);
  un rifiuto della posizione porta a «denied». Solo app, niente testi
  nuovi. Il rientro più avanti dopo un pezzo saltato **non si fa**, per scelta
  dell'utente del 2026-10-06 (chi sbaglia strada disegna un'alternativa,
  l'app glielo dice). `tasks/TASK-253.md`.


- **CI e motore** — TASK-248: il job `api` della CI che restava appeso
  (ADR-0212 e aggiornamento; assegnato dal coordinatore il 2026-10-06;
  PR #385, merge `cdb50bb`, e PR #392, merge `11eeac7`). **La causa**:
  non un test lento ma `multiprocessing.Pool.terminate()` in
  `plan_nearby` (`route_engine/nearby_starts.py`), che aspetta per
  sempre se arriva mentre un grafo sta per essere mandato a un processo
  delle partenze vicine; in CI in `test_cycling.py`, dove il motore
  rifiuta subito; sul server solo dopo un `engine_error` inatteso (non
  verificato: lo guarda il coordinatore). **Parte A**: ogni job di
  `ci.yml` ha un tempo massimo e un test fermo da due minuti stampa gli
  stack (`faulthandler_timeout`, nessuna dipendenza nuova). **Parte B**:
  le partenze vicine senza `Pool` (un processo e una pipe ciascuna,
  fermarli ritorna sempre), 12 test nuovi, percorsi identici (impronte
  fissate e 7 casi su 7 con i processi), tempi uguali, `engine.zip`
  rifatto. **Per il server**: l'impronta del motore cambia, i percorsi
  no → al prossimo aggiornamento serve `draw_examples` (~40 minuti); la
  pubblicazione con `engine.zip` nuovo è del coordinatore. Come si
  riconosce il blocco sul server: `tasks/TASK-248.md`, «Esito».
- **App** — TASK-252: le code sul telefono non perdono niente (ADR-0216;
  dalla revisione del codice dell'app chiesta dall'utente il 2026-10-06,
  elenco in `out/revisione-app-2026-10-06.md` sul Mac, fuori dal
  repository). Le tre code (corse, «Public», Strava) con una copia accanto
  al file; «Public» spento non torna acceso da una scelta in coda; una
  corsa rifiutata non ferma le altre; la coda riparte quando l'app torna
  in primo piano; 30 s alle richieste dell'account (90 alle PUT); «Delete
  account» svuota le code di quell'account; «Stop» dà la corsa anche a
  file rifiutato. Solo app, niente di visibile. Dalla stessa revisione:
  TASK-253 (la navigazione), TASK-254 (correzioni piccole) e, dai «sì a
  tutte e cinque» dell'utente del 2026-10-06, TASK-255 (schermo acceso in
  corsa, niente calorie fuori dalla corsa), TASK-256 (gli errori per chi
  corre), TASK-257 (la corsa rifiutata resta con il motivo): task file in
  `main`, ordine 253 → 255 → 256 → 257. `tasks/TASK-252.md`.

- **API** — TASK-247: `run_scored` registrato al salvataggio della corsa
  (seguito di TASK-241, aggiornamento sotto ADR-0207; «si» dell'utente
  del 2026-10-06; PR #386). Il primo `PUT /me/activities/{key}` di una
  corsa con punteggio registra l'evento negli `insights` con la sola
  `quality`; una corsa rimandata o senza percorso no. Nella bozza di
  «Privacy» torna «a run scored». **Vuole l'aggiornamento del server**
  (nessuna migrazione, il motore non cambia: niente `draw_examples`), con
  l'ok dell'utente. `tasks/TASK-247.md`.

- **API** — TASK-249: un paese toccato in «NEARBY TOWNS» e lo stesso
  paese cercato per nome sono la stessa città (ADR-0213; seguito di
  TASK-236, scelto dall'utente il 2026-10-06). **Fatto**: in `main` dalla
  #381 (`c290d04`). Per Tenna, Calceranica al Lago, Caldonazzo, Riva del
  Garda e altri comuni `GET /cities` dava il centro dell'area del comune,
  a 500–1200 m dal paese, e `GET /nearby-cities` il centro del paese: due
  punti, due serie di esempi tenuti, percorsi diversi. Ora il punto di un
  luogo è uno, il suo nodo `place` di OpenStreetMap: `/cities` lo chiede
  al Places per i risultati che sono aree. Solo API: **niente app, motore,
  database**. Provato col servizio vero dal Mac; delle 66 città con gli
  esempi disegnati prima nessuna cambia punto. Se il Places non risponde
  la ricerca torna ai punti di prima, senza tenerli. **Aspetta**
  l'aggiornamento del server (del coordinatore, con l'ok dell'utente;
  nessun `draw_examples` del catalogo, solo Tenna, Calceranica e
  Caldonazzo per non far aspettare il primo telefono). **Seguito**: le
  etichette di una frazione e di un nome tradotto differiscono ancora fra
  i due endpoint (il punto no). `tasks/TASK-249.md`.

- **App** — TASK-182: le unità di misura, km o miglia (ADR-0149 e i suoi
  tre aggiornamenti; chiesto dall'utente il 2026-10-02 e il 2026-10-03;
  PR #351, #366, #368, #374, ultimo merge `3ad0c22`, 2026-10-05). In
  «Settings» la riga «Units»: «Phone units» (la partenza: miglia dove il
  telefono misura le strade in miglia, km altrove), «Kilometres»,
  «Miles»; la scelta vale subito e resta sul telefono. Con le miglia
  tutta l'app scrive e dice miglia: «My activities», i preferiti,
  «Explore», «Draw» (− e + di 1 mi; corsa 1–13, bici 7–18, canoa 1–3,
  scelta dell'utente; all'API metri interi), il «Feed», i disegni
  pubblici, la corsa e la sua fine (parziali per miglio calcolati sul
  telefono), la voce nelle cinque lingue (a ogni miglio, in bici ogni 5,
  le svolte in piedi, mph), il post di «Share». Con «Kilometres» ogni
  testo e ogni frase sono quelli di prima; il motore, l'API, il GPX e
  quello che si salva restano in metri. Testi e frasi **confermati
  dall'utente** il 2026-10-05, la voce come letta. Parti A, B e C su
  `preview` (gruppi `1b49d248`, `4dbdf450`, `f5623cf3`); l'ultimo passo
  («Phone units», «Share») esce con la prossima pubblicazione, del
  coordinatore. Provato nel simulatore con il telefono sugli Stati Uniti
  («Phone units — Miles», `out/task182/`). **Da fare sull'iPhone**:
  ascoltare la voce in miglia; un iPhone vero con le miglia. **Parte E**
  (2026-10-07, PR #436, branch `feat/TASK-182-e-draw-metres`, ADR-0149
  «aggiornamento (parte E)»): la distanza di «Draw» la tiene `App.tsx`
  con `useDrawDistance` (`src/units/`), come testo scritto o metri scelti
  dall'app («Try», lago piccolo), sempre nell'unità dell'app, e
  `useUnits()` è alla radice; a vista niente cambia (il campo mostrava già
  le miglia), il cambio di unità vale anche con «Draw» fuori dallo
  schermo; provata nel simulatore («0.9 mi» per un lago di 1,5 km).
  **Seguiti**: togliere l'effetto di cambio unità di `RouteChoice` quando
  `src/route/` è libero; una parola di corsa in miglia ha al più 6
  lettere; «within 1 km of the shore» e l'avviso sull'acqua restano in km
  per scelta. `tasks/TASK-182.md`. **Voce in miglia ascoltata
  dall'utente sull'iPhone il 2026-10-09: va bene.**

- **API e app** — TASK-185: i due interruttori delle notifiche (ADR-0206;
  chiesto dall'utente il 2026-10-02 e di nuovo il 2026-10-05, che ha
  scelto: **tutti e due spenti** all'inizio; PR #359, merge `c2bb428`).
  «Email notifications» e «Push notifications» in «Settings» sono due
  interruttori salvati nell'account: `PUT /me/notifications` (solo quello
  che cambia), `User.notifications`, migrazione `0017_notifications.sql`.
  **Non si manda niente**, e la pagina lo dice sotto le righe: «Sgrava
  does not send notifications yet. Your choice is kept for when it
  does.»; nessun permesso chiesto al telefono. Li legge solo il
  proprietario. Nessuna riga di «Settings» dice più «Soon»; una riga in
  «Help» e una nella bozza di «Privacy». Testi confermati dall'utente
  («ok, i testi delle notifiche vanno bene»). **Sul server** dal
  2026-10-05, 12:02Z (ok dell'utente «ok per il server», sessione
  «Impostazioni»; nello stesso aggiornamento il motore delle forme
  inclinate di TASK-232 A, con il suo ok): `main` `c2bb428`, circa 10
  secondi di fermo, copia `shaperoute-2026-10-05T1202Z.dump`, immagine di
  prima `shaperoute-api:before-task185`, `draw_examples` rilanciato alle
  12:03Z (`data/draw-examples-2026-10-05-task232.log`). La pubblicazione
  dell'app è del coordinatore. Visto nel simulatore (`out/task185/`),
  senza tocchi; **da provare sull'iPhone** (girare un interruttore e
  ritrovarlo dopo aver riaperto l'app). **Dopo**, un task da aprire con
  scelte dell'utente: l'invio vero (che cosa si notifica, il servizio di
  posta, `expo-notifications`, una build propria). `tasks/TASK-185.md`.

- **App** — TASK-184: «Help», «Terms», «Privacy» (ADR-0205; chiesto
  dall'utente il 2026-10-05: una mini guida, e le prime bozze di
  condizioni e privacy). PR #353, merge `8dfb62a`, 2026-10-05; solo
  app, nessuna dipendenza. Le
  tre righe di «About» in «Settings» aprono ognuna il suo testo come
  pagina, con «←» che torna a «Settings» com'era. I testi sono dati in
  `src/about/content/`, in inglese e in italiano (con tedesco, spagnolo e
  francese l'app mostra l'inglese). **«Terms» e «Privacy» sono bozze** e
  lo dicono in cima («Draft — not final yet.»). **Aspettano l'utente**:
  i segnaposto da riempire (`[name]`, `[contact email]`,
  `[governing law]`, le basi giuridiche), la lettura di un legale prima
  dell'App Store, l'approvazione, e poi le altre tre lingue; l'elenco
  intero dei punti aperti e di quello che «Privacy» non dice perché non
  si è potuto verificare è in `tasks/TASK-184.md`, «Esito». Visto nel
  simulatore in italiano (la cima di ogni pagina, senza tocchi:
  `out/task184/`); esce con la prossima pubblicazione; da provare
  sull'iPhone lo scorrimento e il «←». Chi cambia cosa l'app manda o tiene (TASK-208 B, TASK-092)
  aggiorna anche «Privacy».

- **App e API** — TASK-250: il Lago di Ledro nell'elenco di «Paddle»
  (ADR-0214; chiesto dall'utente il 2026-10-06, seguito di TASK-233). In
  OpenStreetMap Ledro è `water=pond` dal 2023, e su uno stagno il motore
  non pagaia: ora uno stagno con un nome da lago è un lago dell'elenco, e
  `lake_catalog --ponds` lo scrive come lago nei file d'acqua; **il motore
  non cambia**. `lakes.json` ha due punti di Ledro a 2 km, con tutte e otto
  le forme. I sette laghi scartati restano fuori: sei non hanno una via
  alla riva nei dati, Gannano tiene a 1 km solo la stella (tabella in
  `tasks/TASK-250.md`). **L'acqua è sul server dal 2026-10-06** (Ledro
  nuovo, Garda riscritto, il vecchio in `before-task250/`; senza riavvio):
  un cuore da 2 km da Ledro e uno da Riva rispondono 200 dentro l'API. Esce
  con la pubblicazione del coordinatore (gruppo 37310f11). I cinque laghi
  segnati `boat=no` o `access=private` restano nell'elenco (utente,
  2026-10-06). Ledro di nuovo `water=lake` in OpenStreetMap: chiesto
  dall'utente il 2026-10-06, da fare con il suo account.

- **App** — TASK-245 parte B: in «Another place» con «Paddle», una parola
  comune scritta sceglie fra i nomi trovati (ADR-0210, aggiornamento;
  seguito del task, fatto dopo il «continua» dell'utente del 2026-10-05).
  «lago lev» propone solo «Lago di Levico», non più anche «Sestri
  Levante»; «lev» da sola tutti e due, e «lungomare di Viareggio» trova
  la sua spiaggia. Solo `placeSpots.ts` e i suoi test; niente server.
  PR #376, merge `1c8366e` (2026-10-05, 15:23Z). Esce con la
  pubblicazione del coordinatore.
- **App e API** — TASK-245: altre spiagge per «Paddle», oltre Jesolo e
  Riccione (ADR-0210; chiesto dall'utente il 2026-10-05, che ha scelto 29
  posti di mare su tutte le coste; PR #363, merge `0d8bbc1`). Un comando
  nuovo, `beach_catalog.py`, sceglie per ogni paese un punto della riva
  dai dati di OpenStreetMap e lo prova col motore; l'elenco è
  `apps/mobile/src/paddle/beaches.json`, letto da `waterSpots.ts`: le
  spiagge si trovano in «Explore», in «Near me» e in «Another place», dove
  ora solo l'ultima parola scritta vale come inizio di un nome («via
  Roma» non propone «Viareggio»). **29 posti su 29** tengono le forme a
  2 km, con tutte e otto le forme di «Explore»; nessuno scartato.
  **L'acqua è sul server dal 2026-10-05**: 27 file nuovi, 22,6 MB, in
  `data/cache/water/` (247 file, 93 MB), senza riavvio, con le impronte
  uguali a quelle provate sul Mac. La prova dentro l'API non è stata
  fatta (negata dai permessi della sessione): **la prova di una spiaggia
  nuova sul telefono è dell'utente**, dopo la pubblicazione, che è del
  coordinatore. Seguiti in `tasks/TASK-245.md`.

- **App** — TASK-240: con «Paddle», laghi e spiagge anche in «Another
  place» (ADR-0204; chiesto dall'utente il 2026-10-05, scelte tutte
  confermate; PR #344). In «Draw», con «Paddle», la ricerca della partenza
  offre i laghi e le spiagge dell'elenco di «Explore» sopra le vie e i
  paesi, subito: «lago di Levico Terme» dà «Lago di Levico», e sceglierlo
  mette la partenza sulla riva; un lago piccolo porta la distanza a 1,5 o
  1 km; il campo dice «Lake, beach, city or street». Il mare: solo Jesolo
  e Riccione. Solo app, niente server; «Run» e «Bike» com'erano. Esce con
  la prossima pubblicazione, del coordinatore; da provare sull'iPhone.
  Seguiti in `tasks/TASK-240.md`.

- **API e app** — TASK-183: cambiare email e numero di telefono da
  «Settings» (ADR-0150; chiesto dall'utente il 2026-10-02 e di nuovo il
  2026-10-05; PR #346, merge `a89f086`). Scelte dell'utente: il numero
  serve a farsi trovare dagli amici che lo hanno già (la ricerca dalla
  rubrica è un task a parte: prima va deciso come si prova un numero), e
  l'email cambia subito con la password, senza mail di conferma finché
  non c'è un servizio di posta. `PUT /me/email` (password sbagliata
  `403`, contata con quelle dell'accesso), `PUT /me/phone` (prefisso del
  paese, tenuto in E.164, `null` lo toglie; non provato, quindi non
  unico; lo legge solo il proprietario), `User.phone`, migrazione
  `0016_contact.sql`. In «Settings» le righe «Change email» e «Phone
  number» si aprono sotto, nelle cinque lingue; testi confermati
  dall'utente. **Sul server** dal 2026-10-05, 10:58Z (ok dell'utente «ok
  aggiorna il server e pubblica», sessione «Impostazioni»): `main`
  `ae320d3`, circa 10 secondi di fermo, copia
  `shaperoute-2026-10-05T1058Z.dump`, immagine di prima
  `shaperoute-api:before-task183`, `draw_examples` rilanciato alle 10:59Z
  per il motore di #347 e #349 (`data/draw-examples-2026-10-05-task238.log`).
  La pubblicazione dell'app è del coordinatore. Visto nel simulatore;
  **da provare sull'iPhone** (un cambio vero di email e di numero).
  `tasks/TASK-183.md`.

- **Motore, API, app** — TASK-238: spostare la figura sull'acqua col dito
  (ADR-0202; chiesto dall'utente il 2026-10-05, che ha scelto il
  trascinamento). **Parte A** (PR #347, merge `797c4bb`): la richiesta in
  canoa può avere `near`, dove si vuole il centro della forma, e il
  risultato ha `centre`; il motore mette la forma nel posto più vicino in
  cui ci sta, nella fascia e con la riva a piedi entro 300 m; senza `near`
  niente cambia. **Parte B** (PR #350): «Move the shape» sotto «Start» in
  «Draw» con «Paddle», un dito trascina la figura a mappa ferma, al
  rilascio l'app richiede il percorso con `near`, e una riga dice se la
  figura non ci stava. I sei testi sono **confermati dall'utente**
  (2026-10-05). **Aspettano**: il server con la parte A e poi
  `draw_examples` (ok dell'utente, dal coordinatore: fino ad allora il
  pulsante non compare), la pubblicazione dell'app dopo il server, la
  prova con un dito vero sull'iPhone. Gli esempi di «Explore» e i
  preferiti non si spostano: seguito da chiedere. `tasks/TASK-238.md`.

- **App** — TASK-244: «Move the shape» anche sugli esempi di «Explore»
  con «Paddle» (aggiunta ad ADR-0202; chiesto dall'utente il 2026-10-05,
  che ha scelto: il percorso spostato **resta di «Explore»**). In `main`
  dal 2026-10-05 (PR #360, merge `20c021b`). Gli esempi dicono dov'è la loro forma (`centre`:
  nei 32 dentro l'app, ridisegnati sull'acqua del server e per il resto
  identici, e in quelli dei laghi chiesti al server da ora); la scheda di
  «Explore» ha «Move the shape» sotto «Start», e al rilascio l'app
  richiede l'esempio dalla partenza del suo luogo con `near`. La lista
  tiene l'esempio com'era. Solo app più lo script degli esempi: **niente
  motore, API, server, `draw_examples`, `engine.zip`**; nessun testo
  nuovo. Non si spostano: un esempio tenuto sul telefono da prima (finché
  non è ridisegnato), i preferiti, i disegni del «Feed». **Aspettano**: la
  pubblicazione dell'app (del coordinatore) e la prova con un dito vero
  sull'iPhone. `tasks/TASK-244.md`.

- **App** — TASK-246: le figure «Paddle» dei tre posti più vicini già
  sul telefono (ADR-0211; chiesto dall'utente il 2026-10-05, che ha
  scelto: tre posti, con qualunque sport, anche con i dati mobili).
  **Fatto**: in `main` dalla #369 (`2fcf6b5`). A ogni apertura, dopo le mappe della zona, il telefono fa
  disegnare al server le otto forme dei tre posti più vicini entro 30 km
  che non ha ancora, una ogni 6 secondi al massimo, e le tiene in
  `Documents/paddle-ahead.json`: «Explore» con «Paddle» le mostra subito.
  Solo app: **niente motore, API, server**; nessun testo nuovo.
  Provato dal vero sul Mac contro un'API locale (le otto forme del Lago di
  Levico, mezzo secondo l'una), non visto sullo schermo. Le spiagge di
  TASK-245 sono fra i tre posti; con l'app in secondo piano il giro
  aspetta. **Aspettano**: la pubblicazione dell'app (del coordinatore) e
  la prova sull'iPhone (aprire l'app, tre minuti, poi «Explore» con
  «Paddle»).
  **Seguito**: il server non tiene le figure dei laghi, ogni telefono
  nuovo gliene fa disegnare fino a 24 (circa un minuto di motore).
  `tasks/TASK-246.md`.

- **Motore** — TASK-243: la penna si alza anche sui baffi del contorno
  (ADR-0209; chiesto dall'utente il 2026-10-05 dopo il «sì» a TASK-242,
  campioni prima/dopo giudicati «va bene»; PR #362). Con la penna alzata,
  il contorno di una forma a pezzi non disegna più i suoi **baffi**: una
  deviazione oltre 3/8 di altezza di pezzo che rientra vicino a dove esce
  (salta al più 1/8 del lato del disegno di contorno, misurato lungo la
  linea, e la sua strada è lunga almeno il doppio della distanza fra i
  capi) diventa un tratto a piedi, al più due per contorno; le deviazioni
  lunghe restano disegnate; la partenza resta il primo punto
  (`pen_up._lifted`, `detours.py`). Senza `pen_up`, per le parole e
  sull'acqua niente cambia. Su 42 richieste di prova (motore con
  TASK-232) 26 identiche, 14 cambiano (10 con lo stesso disegno e un
  baffo camminato; in 4 la ricerca sceglie un altro disegno, e in 2 la
  somiglianza scende), una diventa disponibile (`ROUTE_ENGINE.md` §5).
  In media 1 km disegnato in meno e 0,7 km a piedi in più dove cambia.
  **Sul server** da `main` a784f772 dal 2026-10-05 22:22Z (ok dell'utente
  «ok server», 9 s di fermo, ritorno `shaperoute-api:before-task243`),
  `draw_examples` rifatto: 70 di 70 città alle 22:58Z, nessuna da rifare.
  La pubblicazione dell'app, con `engine.zip` rifatto, è del coordinatore.
  Seguiti in `tasks/TASK-243.md`.

- **Motore** — TASK-242: la penna si alza sulle deviazioni di un pezzo
  (ADR-0208; chiesto dall'utente il 2026-10-05 con lo screenshot della
  faccina a Trento, campioni prima/dopo giudicati «sì, va bene»; PR
  #349). Con la penna alzata, un pezzo di una forma (bocca, occhio, buco)
  che le strade portano più di 3/8 di altezza di pezzo lontano dalla sua
  linea si disegna in parti, e la deviazione è un tratto a piedi
  (`detours.py`, `pen_up.trace`): a Trento la bocca non scende più 250 m
  fino al sottopasso della ferrovia. I `walks` possono essere più dei
  pezzi meno uno, mai più di 9. Il contorno, le parole e l'acqua non
  cambiano; su 42 richieste di prova 30 danno lo stesso percorso, 10
  migliorano, nessuna peggiora (`ROUTE_ENGINE.md` §5). **Non sul server
  né pubblicato**: server e `draw_examples` li fa il coordinatore con
  l'ok dell'utente; `engine.zip` è rifatto, il telefono lo riceve con la
  prossima pubblicazione. Seguiti in `tasks/TASK-242.md`.

- **App** — TASK-241: niente punteggio sulle foto dei post del «Feed»
  (ADR-0207; chiesto dall'utente il 2026-10-05). Il riquadro «98 · out of
  100» sopra il disegno non c'è più, nemmeno nei post che «Explore» mostra
  mentre disegna una città (PR #345, merge `ad80385`). **Parte B**
  (stesso giorno, «sì toglilo anche da VoiceOver»): nemmeno VoiceOver lo
  legge più, nelle cinque lingue (PR #348, merge `69af6c6`). **Parte C**
  (stesso giorno, «togli il punteggio anche dal post da condividere»):
  «Score» non è più fra i risultati del post di «Share»: né pastiglia, né
  numero sull'immagine, né nel testo per Strava (PR #355, merge
  `b7a82da`). **Parte D** (stesso giorno, «toglilo anche da My
  activities»): niente «Score 91» nell'elenco e niente «91 · out of 100»
  sulla corsa aperta (PR #358, merge `78e9bc1`). **Parte E** (stesso
  giorno, «sì toglilo anche da lì», e per la fine corsa «solo km e
  tempo»): niente punteggio sui disegni del «Profile» né a fine corsa,
  dove la scheda dice «4.0 km · 32 min» e l'app non chiede più `POST
/track-scores` (PR #365, merge `0294922`). **Il punteggio non si vede
  più da nessuna parte nell'app**; l'API lo calcola ancora per le corse
  salvate. Conseguenza: l'evento `run_scored` degli `insights` non viene
  più registrato (seguito, se serve). **Parte F** («ok continua»
  dell'utente alla proposta): dalla bozza di «Privacy» esce «a run
  scored» fra gli eventi tenuti; resta «…distance, duration, score…»,
  ancora vera (PR #372). **Parte G**: tolto dall'app
  `src/api/trackScores.ts`, che nessuno chiamava più; niente cambia per
  chi usa l'app (PR #375). Seguito: TASK-247. `tasks/TASK-241.md`.

- **App** — TASK-239: il numero rosso delle richieste di follow, e
  «Follow back» (ADR-0203; chiesto dall'utente il 2026-10-05, PR #343).
  Sul pulsante di «Profile», in alto a destra, un tondo rosso con quante
  richieste di follow aspettano: l'app lo chiede all'apertura, al ritorno
  sullo schermo e ogni minuto mentre è aperta (`social/followRequests.ts`,
  `GET /me/follow-requests?limit=1`). «Profile» si apre con «Requests» già
  aperto; una richiesta accettata resta nella riga con «Follow back».
  Nessuna modifica all'API. **Confermati dall'utente** (2026-10-05): il
  numero, che si spegne quando ogni richiesta ha una risposta, i testi e il
  giro al minuto. **Non visto su un telefono**: esce con la prossima
  pubblicazione (del coordinatore, con l'ok dell'utente); da provare
  sull'iPhone con due account. Le notifiche ad app chiusa restano
  TASK-185. `tasks/TASK-239.md`.

- **App e API** — TASK-236: i paesi vicini sotto «Near me» (ADR-0200;
  chiesto dall'utente il 2026-10-05, regola, testi e campioni confermati
  uno per uno; PR #323, merge `8c3a6ff`). In «Explore», con «Near me»,
  sotto la fila delle città c'è «NEARBY TOWNS»: una fila di schede da
  scorrere con fino a sei posti intorno alla partenza, dal più vicino:
  quattro città e paesi (i più grandi entro 20 km; dove sono meno, i più
  vicini fino a 50) e i due posti più vicini di tutti, anche villaggi (da
  Caldonazzo: Tenna, Calceranica, Levico, Pergine, Trento, Borgo). Vengono
  da `GET /nearby-cities` (`nearby_cities.py`, Places di Geoapify, la
  chiave resta nell'API). Mentre la sezione è sulla pagina l'app fa
  disegnare al server cerchio, cuore e stella da 5 km di ogni posto, uno
  alla volta e al più 12 al minuto: la scheda mostra il cuore, e il paese
  toccato si apre con le prime tre schede pronte. Corsa e bici (stessi
  esempi della corsa); la canoa ha i laghi vicini (TASK-233). Provato nel
  simulatore con l'API del branch, prima dei due posti più vicini.
  **Sul server** dal 2026-10-05 09:32Z (`f3fdbce`) e **su `preview`** da
  `8c3a6ff` (gruppo `8f6849ca`), fatti dal coordinatore. Da provare
  sull'iPhone: le sei schede. Seguiti in `tasks/TASK-236.md`.

- **Motore, API e app** — TASK-234: «Viene meglio a N km» (ADR-0197;
  chiesto dall'utente il 2026-10-05, il «passo 1»; PR #327, merge
  `784cc03`, e #336, merge `db2c30e`). Quando un percorso riesce ma la
  ricerca ha già visto la forma chiaramente meglio a un'altra distanza,
  l'API manda `better_distance_m` e «Draw» scrive sotto le tessere «This
  shape comes out better at about 8 km.» con «Try 8 km», che ridisegna a
  quella distanza (testi nelle cinque lingue confermati dall'utente). Il
  percorso scelto non cambia. Scatta poco: 8 percorsi su 129 (`MAPS.md`);
  il passo 2 si valuta dopo. Sul server da `fd14cd3`; l'app esce con la
  prossima pubblicazione; da provare sull'iPhone. `tasks/TASK-234.md`.

- **App, API e server** — TASK-233: «Explore» della canoa come la corsa, e
  tutti i laghi (ADR-0196; chiesto dall'utente il 2026-10-05, scelte
  confermate una per una; PR #319, merge `1dc4bb9`, e la parte B). Con
  «Paddle», «Near me» è acceso da subito e mostra il lago più vicino
  («LAGO DI LEVICO · 1.2 KM AWAY»), poi gli otto luoghi più vicini da
  toccare e «Type a lake or a beach». L'elenco è dentro l'app
  (`src/paddle/lakes.json`, da `python -m shaperoute_api.lake_catalog`):
  **211 laghi d'Italia, 758 punti della riva**, ognuno provato dal motore;
  le forme sono da 2 km (128 laghi), da 1,5 km (48) o da 1 km (35). **Sul
  server** dal 2026-10-05 04:22Z l'acqua di ogni lago: 210 file, 50 MB in
  `data/cache/water/`, senza riavvio; provata dentro l'API sul lago di
  Levico. Esce con la prossima pubblicazione; da provare sull'iPhone.
  `tasks/TASK-233.md`.

- **App** — TASK-235: la pubblicità fra i post del «Feed» (ADR-0198,
  supera in parte ADR-0102; chiesto dall'utente il 2026-10-05, con la
  scelta che **sostituisce** l'annuncio a schermo intero all'inizio di ogni
  ricerca; PR #324, merge `7452ec6`). Un annuncio nativo AdMob dopo ogni 5 post, solo fra due post
  (tre nei 19 d'esempio), con «Sponsored» in alto grande come il nome di
  un corridore, nelle cinque lingue. Uno alla volta: il primo quando si
  apre il Feed, il successivo quando l'utente arriva al posto del
  precedente; un annuncio arrivato tardi non sposta i post sullo schermo.
  Il consenso di Google compare alla prima apertura del Feed, non
  all'avvio. «Draw route» e «Ask for a route» non mostrano più annunci
  (`useAdBeforeRoute` tolto). Provato in una build Release nel simulatore
  con l'annuncio nativo di prova (allora 15 post): due annunci dopo il 5°
  e il 10° post, nessuno in fondo, il validatore di AdMob «No implementation issues
  found». In Expo Go nessun annuncio, come prima. Da riguardare su un
  iPhone vero: che scorrere sopra un annuncio non lo apra (nel simulatore
  lo apriva solo il gesto finto dello strumento). Per gli annunci veri
  serve un'unità **nativa** in AdMob: TASK-153 parla ancora di
  interstitial. `tasks/TASK-235.md`.

- **Motore, API e app** — TASK-226: gli occhi staccati sull'acqua
  (ADR-0188; chiesto dall'utente il 2026-10-03, forme scelte il
  2026-10-05: tutte quelle a pezzi tranne il sole). **Parte A**, #310
  (`15df224`): con `pen_up` e `paddling` una forma a pezzi si disegna pezzo
  per pezzo; il percorso lascia il contorno dove gli occhi sono più vicini,
  li disegna e torna, e i tratti a penna alzata sono i `walks`; la distanza
  chiesta è quella di tutto il percorso. Campioni veri nei quattro luoghi:
  36 su 36 a 2 km. Con la penna giù tutto identico. **Parte B**, #315
  (`9297984`): con «Paddle» `pen_up` da solo per le otto forme, la pausa e
  la voce in canoa («Paddle to the next part», la penna giù 5 m prima), la
  riga dei km, le teste di «Explore» con gli occhi staccati anche dentro
  l'app e nelle schede; e, seguito di TASK-223, l'interruttore su strada
  per gatto, pesce, teste e zucca. **Il server non ha la parte A** e
  rifiuta `pen_up` con `paddling`: `main` non si pubblica finché il server
  non è aggiornato, con `draw_examples` e l'ok dell'utente. Due testi nuovi
  da confermare; da provare sull'iPhone. `tasks/TASK-226.md`.

- **App** — TASK-217: la voce confronta ogni km col precedente
  (ADR-0180; chiesto e scelto dall'utente il 2026-10-03; PR #308, merge
  `f811e3a`). Dal secondo km, subito dopo la frase del km, «Questo
  chilometro: 12 secondi meglio del precedente.» / «… peggio …», entro 2
  s «Stesso passo del chilometro precedente.»; al primo km niente. Con e
  senza percorso, con i secondi della fine corsa (`splits`), pause
  escluse. In bici ogni 10 km da 20 km e senza numeri («Ultimi 10
  chilometri più veloci dei 10 precedenti.»). Tutto in
  `src/navigation/kmCompare.ts`. **Confermate dall'utente** il 2026-10-05
  le frasi in tedesco, spagnolo e francese e, in bici, «stessa velocità»
  entro 0,5 km/h (frase e soglia). Le forme con le miglia le
  aggiunge TASK-182. Solo app: esce con la prossima pubblicazione; da
  provare correndo. Task file: `tasks/TASK-217.md`.
- **App** — TASK-227: «Explore» con «Paddle» come la corsa (ADR-0189;
  scelte dell'utente del 2026-10-04; PR #297, merge `e761044`). Con
  «Paddle» ogni luogo d'acqua ha le otto forme della corsa da 2 km, e i
  quattro luoghi le hanno **dentro l'app** (`src/paddle/paddleExamples.json`,
  circa 100 KB), pronte subito anche senza rete. Nei campioni veri
  sull'acqua del server ci stanno 52 forme su 52. Il JSON lo scrive `python
-m shaperoute_api.paddle_examples` e porta l'impronta del motore
  sull'acqua: un test dell'API dice quando rifarlo. «Near me» resta
  disegnato al momento, e fuori dai quattro luoghi dipende da Overpass (i
  laghi multipoligono solo dopo che il server ha TASK-230). Esce con la
  prossima pubblicazione. `tasks/TASK-227.md`.
- **App** — TASK-228: il «Feed» sull'acqua (ADR-0190; chiesto dall'utente
  il 2026-10-03, scelte del 2026-10-05; PR #322, merge `de9512b`). Fra i
  quindici disegni d'esempio di «Feed» ce ne sono quattro fatti sull'acqua,
  sempre, con ogni sport, al 3º, 8º, 13º e 18º posto di 19: `greta_kayak`
  (cuore, Lago di Garda), `leo.sup` (stella, Lago di Como),
  `irene_onwater` (luna, Jesolo), `ale.paddle` (testa di cane a pezzi,
  Riccione), da 2 km, con «Paddle» in testa alla riga dei fatti. I
  percorsi sono gli esempi dentro l'app (`paddleExamples.json`):
  `src/feed/paddlePosts.ts` li legge, senza una copia sua, quindi rifare
  quel JSON aggiorna anche i post. Un tocco apre il percorso sull'acqua
  senza chiedere all'API; lo sport scelto non cambia. Nessun testo nuovo
  da tradurre. Visto nel simulatore. Solo app: esce con la prossima
  pubblicazione. **Da confermare con l'utente** i quattro titoli e se
  «Meanwhile, from the feed» in «Explore» può mostrare anche un post
  sull'acqua; da provare sull'iPhone. `tasks/TASK-228.md`.

- **Motore** — TASK-230: l'acqua da Overpass con i laghi multipoligono
  (ADR-0192; trovato da TASK-225; PR #292, merge `28e1ae0`).
  `WATER_QUERY` chiede `out body geom` invece di `out tags geom`, così
  Overpass dà anche i membri delle relazioni, e i laghi multipoligono
  (Garda, Como, l'Idroscalo) arrivano interi. 4 test con un Overpass finto;
  corsa, bici e forme identiche (impronte fissate invariate). Lo zip del
  motore dell'app è rifatto dopo la #284. L'impronta del motore cambia, da
  `a89d46072607` a `a068054ef006`: dopo l'aggiornamento del server serve
  `draw_examples`, con l'ok dell'utente. I file d'acqua sul server restano
  buoni. `tasks/TASK-230.md`.

- **App** — TASK-222: il cuore su giallo in «Explore» (ADR-0184; chiesto
  dall'utente il 2026-10-03). A destra di «Best near you», sotto il
  cerchio del profilo e largo uguale (44 punti), il `HeartBadge` di
  TASK-221: solo un'immagine, VoiceOver lo salta. Visto nel simulatore.
  Sul telefono con la prossima pubblicazione. `tasks/TASK-222.md`.
- **App** — TASK-229: «Save» per uscire dalla lavagna del contorno
  (ADR-0191; chiesto dall'utente il 2026-10-03: dalla foto modificata non si
  usciva). In fondo a «Edit the outline» un pulsante «Save» largo quanto
  la riga chiude la lavagna e tiene le modifiche; tolto «Done» in alto a
  destra, che in Expo Go stava sotto il pulsante di Expo. Sul telefono con
  la prossima pubblicazione. `tasks/TASK-229.md`.
- **Server** — TASK-225: l'acqua dei quattro luoghi della canoa sul server
  (ADR-0187; «SI FALLO» dell'utente, e «Sì, scrivi e prova» per il
  server; PR #285, merge `87115ba`). `route_engine` non cambia:
  `covering_path` serviva già una richiesta da un file d'acqua più grande.
  Nuovo `shaperoute_api/water_extract.py`, che scrive l'acqua di un
  riquadro da un estratto osmium, uguale a una risposta di Overpass. Sul
  server dal 2026-10-04 ci sono sei riquadri dall'estratto dell'Italia,
  22 MB in `data/cache/water/`: Riccione, Jesolo, Garda nord e intero,
  Como città e intero. Il cuore da 2 km a Riccione è fatto in 3,1 s e i
  dodici esempi di «Explore» in 1–5 s. Il giudizio dei campioni v2 è
  dell'utente (`out/task225-paddle-samples-v2.html`). Seguito:
  **TASK-230**, `WATER_QUERY` di Overpass perde i membri delle relazioni
  (i laghi multipoligono). `tasks/TASK-225.md`.

- **App** — TASK-224: correndo un percorso, il fatto giallo pieno e il da
  fare tratteggiato che lampeggia (ADR-0186; chiesto dall'utente il
  2026-10-03, stile approvato su un'anteprima; PR #287, merge
  `ec6b748`). Il da fare è giallo, tratteggiato, 0,7 s acceso e 0,7 s a opacità 0,3, a scatti senza
  dissolvenza (due ridisegni ogni 1,4 s); fermo con «Pocket» e con «Riduci
  movimento». Il taglio è ai metri del navigatore, a passi di 5 m; dopo
  l'arrivo tutto pieno, a fine corsa il percorso torna intero. Con la penna
  alzata si tagliano solo le lettere; la bici a mano resta sopra. Provato
  e misurato con la pagina vera di MapLibre nel browser: il lampeggio
  costa 1,43 ridisegni al secondo (una battuta cambia lo stato della linea,
  non lo stile), 0 in «Pocket»; il GPS non cambia. Solo
  app: esce con la prossima pubblicazione, con l'ok dell'utente; da
  provare correndo sull'iPhone. Seguito da chiedere: fermarlo anche sulla
  pagina «Data», dove la mappa è coperta. Task file: `tasks/TASK-224.md`.
- **App** — TASK-221: il cuore su giallo accanto a «Sgrava» (ADR-0184;
  chiesto dall'utente il 2026-10-03). In cima a «Draw», a sinistra del
  nome, un quadrato giallo di 32 punti con il cuore nero dell'avvio, fermo.
  Un componente solo, `src/intro/HeartBadge.tsx`, che TASK-222 riusa in
  «Explore». Sul telefono con la prossima pubblicazione.
  `tasks/TASK-221.md`.
- **App** — TASK-220: «Run without a route» giallo (ADR-0183; chiesto
  dall'utente il 2026-10-03). In cima a «Draw» il pulsante, anche come
  «Ride without a route», ha il fondo giallo e il testo scuro: l'unica
  eccezione alla regola «il giallo è del percorso». PR #280, merge
  `0655511`. Esce con la prossima pubblicazione, che l'utente ha
  approvato il 2026-10-03 («aspetta e poi pubblica») solo dopo che
  l'acqua di TASK-225 è sul server: `main` ha già «Paddle» (#255).
  `tasks/TASK-220.md`.
- **App** — TASK-216: la navigazione in bici (ADR-0179; scelte
  dell'utente del 2026-10-03; PR #278, merge `510f8a5`). «Start» su un
  percorso in bici (da «Draw», da un preferito tenuto in bici) segue
  l'attività del percorso: km/h al posto del passo («Speed now», «Avg
  speed», «Last km», la colonna «Speed» di «Data»), la voce dei km ogni
  10 km con tempo e velocità media, svolte e tratti a mano detti 100 m
  prima (misurato su Trento: a 20 km/h la svolta arriva in mediana 16 s
  dopo l'inizio della frase, come nella corsa), «riding» / «Ride to the
  U» con la penna alzata. La corsa è identica. Frasi e nomi inglesi e
  italiani approvati dall'utente; tedesco, spagnolo e francese da
  confermare. Con la stessa PR, le conferme dell'utente del 2026-10-03
  della bici a mano di TASK-206 in tedesco, spagnolo e francese e dei
  testi della penna alzata di TASK-198. Solo app: esce con la prossima
  pubblicazione, con l'ok dell'utente; da provare sull'iPhone pedalando.
  Seguiti da chiedere all'utente: la fine della corsa in bici, le
  calorie, l'incitamento dopo 5 km, la corsa senza percorso in bici. Dopo
  viene TASK-217. Task file: `tasks/TASK-216.md`.
- **App** — TASK-219: «Find friends» è solo una lente (ADR-0182; chiesto
  dall'utente il 2026-10-03). In cima a «Feed», a destra sotto il bottone
  di «Profile», un cerchio con la lente apre la ricerca di TASK-215;
  VoiceOver la legge «Find friends». Seguiti scelti dall'utente «a
  tappe», senza numero per ora: «Invite friends» dopo l'App Store
  (TASK-152), poi gli amici dai contatti (numero nell'account, SMS di
  verifica, `expo-contacts`: da chiedere), Facebook per ultimo. Strava non
  si può: l'API non dà più amici né follower. `tasks/TASK-219.md`.
- **App** — TASK-218: le immagini ufficiali di Strava (ADR-0181; chiesto
  dall'utente il 2026-10-03). «Connect with Strava» è il pulsante del
  pacchetto di Strava (237 × 48 pt, in inglese in ogni lingua) a fine
  corsa, in «Settings» e sulla corsa aperta; l'interruttore «Send to
  Strava» ha sotto le parole il logo bianco «Compatible with Strava».
  Immagini mai ridisegnate, nessuna dipendenza né testo nuovo; i token
  `strava` e `onStrava` restano senza uso finché `tokens.ts` è di
  TASK-206. Visto nel simulatore. Sul telefono con la prossima
  pubblicazione (ok dell'utente), e solo quando il server ha Strava.
  Task file: `tasks/TASK-218.md`.
- **Motore, API e app** — TASK-206: forme in bici più riconoscibili con
  brevi tratti con la bici a mano (ADR-0167; scelta dell'utente «Sì,
  poco»). Parte A, il motore, PR #249 (marciapiedi, sentieri, zone
  pedonali e l'altro senso dei sensi unici a piedi, a sei volte il costo;
  i cerchi di Trento da «quasi» a «sì»); parte B, `on_foot` nel risultato,
  nel contratto e nei preferiti, PR #263 (migrazione `0012`); parte C,
  l'app, PR #269 (2026-10-03, testi e stile scelti dall'utente): la linea
  gialla intera con trattini scuri sopra i tratti a mano, «Di cui 920 m con
  la bici a mano.» nella scheda, la voce «Tra 50 metri, scendi e porta la
  bici a mano per 200 metri.» / «Risali in bici.» senza pause, i preferiti
  che tengono i tratti. La corsa e la canoa non cambiano. Il server ha A e
  B dalle 12:39Z (`7098cb9`, zona della bici di Trento rifatta); l'app esce
  con la prossima pubblicazione, con l'ok dell'utente, e va provata
  sull'iPhone. Seguiti: TASK-216 e TASK-217. Task file: `tasks/TASK-206.md`.
- **App** — TASK-209: la voce della corsa in cinque lingue (ADR-0171;
  chiesto dall'utente il 2026-10-03; PR #259). In «Data», sotto «Voice»,
  la lingua della voce («App language» o English, Deutsch, Italiano,
  Español, Français) e una voce del telefono per lingua, con «Listen»;
  ricordate in `voice.json`. Tutte le frasi dette in `src/voice/`, una
  tabella per lingua; senza scelta la voce segue la lingua dell'app, in
  inglese le frasi di prima parola per parola; il banner resta della lingua
  dell'app. Dopo i primi 5 km «Daje, avanti tutta!» (scelta dell'utente).
  Frasi **confermate dall'utente** in italiano e, dopo averle ascoltate,
  in spagnolo, francese e tedesco (2026-10-03). Provato nel simulatore (Expo Go): una corsa che parla
  italiano. Da provare sull'iPhone con la prossima pubblicazione, con l'ok
  dell'utente. Task file: `tasks/TASK-209.md`.
- **App** — TASK-215: «Find friends» in cima a «Feed» (ADR-0178; chiesto
  dall'utente il 2026-10-03). Il tasto con la lente apre sopra l'app la
  ricerca degli iscritti per nome (da 2 lettere, al più 20, foto e nome,
  `GET /users?q=` di TASK-211 A); un nome apre il suo profilo in sola
  lettura, con i disegni; «←» torna ai nomi, poi a «Feed». Senza account
  apre «Profile» dicendo perché. È la ricerca che TASK-211 B proponeva in
  «Profile»: B fa ora solo «Follow», «Requests», «Followers» e
  «Following», e riusa `social/PeopleSearch.tsx` (come i tag di TASK-208).
  **Non sul server né pubblicata**: serve l'aggiornamento con la
  migrazione `0011`, poi la prova sull'iPhone, con l'ok dell'utente.
  Testi tradotti dall'agente, da confermare. `tasks/TASK-215.md`.
- **API** — TASK-213: nessun commento negativo (ADR-0176, scelta
  dell'utente del 2026-10-03). `comment_filter.check_comment` rifiuta
  insulti, parolacce e parole negative in italiano e in inglese, anche
  camuffati («str0nz0», «m e r d a»), e lascia passare i nomi di posti
  (Troia, Bad Ischl, Cazzago). Entra in funzione quando TASK-120 lo chiama
  prima di salvare un commento: `422 comment_rejected` e, nell'app, l'alert
  «You can't write negative comments in this app. Try another app.». Una
  critica gentile non la riconosce: per quella servirebbe un'AI, da
  chiedere all'utente. Limiti e dettagli: `tasks/TASK-213.md`.
- **App** — TASK-212: il logo di Sgrava dopo «Save» (ADR-0174; chiesto
  dall'utente il 2026-10-03). Tenuta la corsa, sopra l'app sale il giallo
  dell'avvio con il logo, per 1,65 s (un tocco lo chiude prima), poi la
  mappa come prima; anche senza rete (scelta dell'utente), mai se il
  telefono non tiene la corsa né a «Discard». Solo app, `App.tsx` non
  cambia. Sul telefono con la prossima pubblicazione, con l'ok
  dell'utente. Task file: `tasks/TASK-212.md`.
- **App** — TASK-207: la foto dal cerchio di «Profile» (chiesto
  dall'utente il 2026-10-03, che ha scelto il «+»). Il cerchio grande di
  «Profile» ha un tondo bianco con il «+» in basso a destra; toccato apre,
  in un riquadro sopra «Edit profile», «Choose a picture», «Take a photo»
  e, con una foto, «Remove picture», le stesse di «Settings» (TASK-178).
  Solo app: nessuna API, nessuna migrazione. Visto nel simulatore con dati
  finti (iPhone 17); **sul telefono funziona solo dopo** l'aggiornamento
  del server con la `0005` e la pubblicazione dell'app, tutti e due con
  l'ok dell'utente; fino ad allora dice «Profile pictures are not
  available on this API yet.». Task file: `tasks/TASK-207.md`.
- **App** — TASK-205: lo sport accanto al profilo (ADR-0165; chiesto
  dall'utente il 2026-10-03). Nell'intestazione di «Feed», «Draw» ed
  «Explore», a sinistra del profilo, un pulsante tondo con l'emoji dello
  sport scelto; toccato apre un menu con «Run», «Bike» e «Paddle» «Soon».
  È la stessa scelta di «Settings» (`sport.json`), e «Draw» la segue
  subito. Visto nel simulatore (iPhone 13 mini); da provare sull'iPhone
  con la prossima pubblicazione, con l'ok dell'utente. Task file:
  `tasks/TASK-205.md`.
- **App** — TASK-204: la grafica della corsa in corso (ADR-0163; chiesto
  dall'utente il 2026-10-03; PR #233, in `main` dal 2026-10-03). Stessi
  numeri, comandi e comportamento di TASK-169: il numero grande con il nome
  sotto, la distanza più grande sotto la mappa, «Pocket» e «Music» tondi
  con l'icona, «Paused» in una pillola, una barra per ogni km di «Data»,
  interruttori disegnati, la freccia dei banner in un disco, il conto alla
  rovescia animato. Visto nel simulatore. L'aspetto e la parola «Pause»,
  nuova sotto il pulsante, **confermati dall'utente** il 2026-10-03
  («mi piace, teniamo Pause»), dopo un link di prova (ramo EAS
  `task-204-test`). Non su `preview`: arriva con il resto di `main`.

- **Motore** — TASK-203: dove va il tempo del piano dalla partenza, e le
  due correzioni che lasciano i percorsi identici (ADR-0162; la PR la apre
  questo task: PR #230, in `main` dal 2026-10-02 22:30Z). Misurato sul Mac, Trento in
  memoria, cinque richieste: metà del piano dei casi lunghi è la ricerca
  lontana (ADR-0040), il resto quasi tutto lavoro rifatto a ogni
  tracciamento. Nel motore (`network.py`): ciò che si tiene per grafo
  vale finché NetworkX non cambia il grafo, senza contarne gli archi a
  ogni tracciamento, e le coordinate dei nodi una volta per grafo. Stessi
  percorsi, alternative e punteggi (impronte prima e dopo nel task file,
  un test che li fissa, le richieste del registro rifatte); richieste
  lunghe 14–36% più veloci sul Mac, CPU di una richiesta −15…−43%; il
  server non è misurato. **Da decidere dall'utente, con campioni**:
  niente ricerca lontana quando vicino c'è già un percorso disegnabile
  (o `FAR_TRACES` 20 → 10), e `NEARBY_GOOD_GRACE_S` 3 → 1 s. Le altre
  proposte che non cambiano i percorsi sono seguiti (`tasks/TASK-203.md`,
  «Proposte»). **Deploy**: cambia l'impronta del motore; meglio un solo
  aggiornamento del server con TASK-191 A2, poi `draw_examples`.

- **API e app** — TASK-200: l'attività nei preferiti e le pause nel
  dettaglio di una corsa, i seguiti 1, 5 e 6 di TASK-190 C e TASK-199
  (ADR-0160, migrazione `0008`; PR #227, in `main` dal 2026-10-02
  22:05Z). Un percorso in bici tenuto col cuore si riapre in bici,
  qualunque sport dica «Settings»: «Export GPX» lo chiede con `cycling`;
  quelli di «Explore» e a tema sono a piedi. `GET /me/activities/{key}` ha
  le `pauses` (`pen` solo sulle pause «penna»); l'app le legge e non mostra
  niente di nuovo. Migrazione `0008_favorite_activity.sql`: `activity` in
  `favorites` (`running` per i preferiti di prima, vincolo sulle attività
  dell'API), provata su dati dello schema 0001–0007. Per una corsa l'app
  manda la richiesta di prima, byte per byte (test); un'API più vecchia che
  rifiuta `activity` riceve il preferito una volta come prima, e lo tiene
  come corsa. **Migrazione e campi nuovi arrivano al telefono solo dopo**
  l'aggiornamento del server (con la `0008`) e la pubblicazione dell'app,
  tutti e due con l'ok dell'utente. Non provato su un telefono. **Da
  decidere** (`tasks/TASK-200.md`, «Esito»): le indicazioni di «Start» per
  un preferito in bici restano a piedi, perché `POST /route-directions`
  non ha l'attività; i preferiti tenuti prima di TASK-199 restano senza
  `walks` (si tolgono e si rimettono).

- **Motore** — TASK-201: le partenze vicine senza processi nuovi a ogni
  richiesta, **misurato, non conviene** (decisione del coordinatore),
  PR di soli documenti, nessun codice cambiato. Sul Mac, Trento in
  memoria, quattro richieste: aprire i tre processi costa 0,21–0,30 s
  (0,05 l'interprete, 0,17 l'import del motore), mandare il grafo meno di
  0,1 s, il pickle 0,1–0,24 s; il piano dalla partenza 5–8 s copre tutto
  (cuore 10 km, «CIAO» 12 km, cerchio 15 km), e solo la stella da 5 km
  guadagnerebbe 0,2 s con i processi accesi. Il tempo è nel piano della
  partenza (`optimizer.py`), non nei processi: la voce «processi tenuti
  accesi» dei seguiti di TASK-168 non è la strada. Numeri e seguito in
  `tasks/TASK-201.md`; il server non è misurato, solo se serve e con
  l'ok dell'utente.

- **API e app** — TASK-116: il profilo, nome utente, bio e «Edit profile»
  (ADR-0128, migrazione `0007`), PR #224, in `main` dal 2026-10-02 21:21Z. In
  «Profile» sotto il nome ci sono la bio e «Edit profile», che apre una
  pagina con nome e bio: salvati, «Profile», «Settings» e il pulsante in
  alto li mostrano subito, e il portachiavi li tiene. API: `PATCH /me`
  (solo ciò che cambia; il nome con la regola dell'iscrizione, punto
  compreso; la bio al più 160 caratteri; errori in parole, `409
username_taken`) e `GET /users/{public_id}`, solo con il token: nome,
  bio, foto e disegni pubblicati (0 finché non c'è TASK-117), **mai
  l'email** (test). `public_id` è un UUID casuale nuovo in `users`, non
  l'id in sequenza. Migrazione `0007_profiles.sql`: `bio` e `public_id` in
  `users`, provata su dati dello schema 0001–0006 (sessioni di prima
  valide). La pagina in sola lettura del profilo di un altro c'è, ma
  nessuna strada ci porta: da dove si apre lo decide l'utente. Testi nuovi
  e domande da confermare con l'utente in `tasks/TASK-116.md`, «Esito».
  **Migrazione e «Edit profile» arrivano al telefono solo dopo**
  l'aggiornamento del server (con la `0007`) e la pubblicazione dell'app,
  tutti e due con l'ok dell'utente: finché il server è quello di oggi,
  «Save» dice «Editing the profile is not available on this API yet.».
  Non provato su un telefono.

- **API e app** — TASK-199: la penna alzata in «My activities» e nei
  preferiti, i seguiti di TASK-198 (ADR-0158, migrazione `0006`), PR #222,
  in `main` dal 2026-10-02 20:46Z. Una corsa su una parola con la penna
  alzata si salva con i `walks` del percorso e `pen: true` sulle pause
  «penna»: il punteggio in «My activities» è quello delle sole lettere,
  come a fine corsa, e riaperta ha i tratti a piedi tratteggiati (la linea
  corsa resta unita). Il cuore tiene i `walks`; un preferito riaperto si
  mostra, si corre (pause e voce di TASK-198), si esporta e si giudica
  come la parola appena disegnata. Migrazione `0006_pen_up_walks.sql`:
  `walks` (`jsonb`, `[]` per le righe di prima) in `runs` e `favorites`.
  Per ogni altra corsa o percorso l'app manda la richiesta di prima, byte
  per byte (test); se un'API più vecchia rifiuta `walks` o `pen`, l'app
  rimanda una volta senza, e la corsa non si perde. Come funziona:
  `API.md`, «Favorites» e «My activities»; `UI.md`, stesse voci.
  **Migrazione e campi nuovi arrivano al telefono solo dopo**
  l'aggiornamento del server (con TASK-197 e la `0006`) e la pubblicazione
  dell'app, tutti e due con l'ok dell'utente. Non provato su un telefono.
  Seguiti in `tasks/TASK-199.md`, «Esito»: la riga dei km delle lettere
  sulla scheda di un preferito (da chiedere), un preferito in bici che
  non ricorda l'attività.

- **App** — TASK-202: «Lift the pen between letters» è **acceso
  all'avvio**, scelta dell'utente del 2026-10-02 («sì, acceso di
  default»): una parola si chiede con la penna alzata, a meno di
  spegnerlo. **Risolta la prima domanda di TASK-198** (sotto); restano i
  due testi della voce e la riga dei km. Una forma e un'immagine non
  mandano mai `pen_up`. **Va sul telefono solo dopo l'aggiornamento del
  server**: un'API senza TASK-197 rifiuta ogni parola con la penna alzata
  (`tasks/TASK-202.md`, «Note per il deploy»).
- **App** — TASK-198: la penna alzata nella corsa, chiesta e confermata
  dall'utente («pausa automatica con avviso a voce»), PR #218, in `main`
  dal 2026-10-02 20:02Z. In «Draw», con
  una parola, l'interruttore «Lift the pen between letters» manda
  `pen_up: true`; **spento all'avvio** finché l'utente non sceglie (la
  proposta è acceso). Sulla mappa i tratti a piedi sono tratteggiati e
  grigi (token `walk`), le lettere gialle; sotto il risultato «… km of
  letters + … km walking between them». Correndo, alla fine di ogni lettera
  la registrazione va in pausa da sola, una pausa «penna», e riparte 20 m
  prima della lettera successiva (`PEN_DOWN_M`), con «Letter done. Walk to
  the U: the drawing is paused.» e «Pen down: draw the U.»; una pausa
  chiesta a mano resta sua. Tempo e distanza senza i tratti a piedi, i
  `walks` a `POST /track-scores` e a `POST /gpx`. Senza `walks` tutto come
  prima. Come funziona: `UI.md`, «Forma e distanza», «Il risultato», «La
  navigazione». **Da provare sull'iPhone**, camminando una parola vera.
  **Si vede sul telefono solo dopo** l'aggiornamento del server con
  TASK-197 e la pubblicazione dell'app, tutti e due con l'ok dell'utente.
  **Aspettano l'utente**: l'interruttore acceso di default, i due testi
  della voce e la riga dei km (`tasks/TASK-198.md`, «Esito»). Seguiti: i
  `walks` in «My activities» (il suo punteggio non li conosce) e nei
  preferiti: TASK-199.

- **Motore e API** — TASK-197: la penna alzata nelle parole, chiesta
  dall'utente (ADR-0157), PR #217, in `main` dal 2026-10-02 19:35Z. Con `pen_up: true` e una parola ogni lettera
  si disegna da sola, una volta, e fra una e l'altra si prende a piedi la
  strada più breve; il `RouteResult` ha `walks`, coppie `[da, a]` di indici
  in `points` (n − 1 per n lettere), e il percorso non è chiuso.
  Somiglianza e distanza chiesta sono delle sole lettere, `distance_m` di
  tutto: a Trento «CIAO» da 15 km fa 15,4 km di lettere alte 1,1 km (0,66
  chiusa) e 19,6 in tutto. `POST /track-scores` prende i `walks`, il GPX ha
  «Pause» e «Resume», la CLI `--pen-up`. Tutto facoltativo: l'app
  pubblicata non manda `pen_up` e ignora `walks`, e una parola senza
  `pen_up` dà lo stesso percorso di prima, punto per punto (test). Provato
  solo sulle zone già in cache (Trento, Levico), non giudicato a occhio.
  **Aspettano l'ok dell'utente**: l'aggiornamento del server e poi
  `draw_examples` rilanciato, da `origin/main` pulito; ogni cambio del
  motore cambia `engine_fingerprint` e ridisegna gli esempi tenuti, anche
  se i percorsi senza `pen_up` restano gli stessi. Dopo: TASK-198, l'app
  (cosa deve sapere: `tasks/TASK-197.md`, «Esito»).

- **API e app** — TASK-178: la foto del profilo, chiesta dall'utente con
  TASK-177 (ADR-0146). In «Settings» la riga «Profile picture» apre
  «Choose a picture», «Take a photo» e «Remove picture»; la foto si
  ritaglia al quadrato nel telefono e si vede nella riga, nel cerchio di
  «Profile» e nel pulsante in alto, al posto dell'iniziale. Nell'API la
  tabella `profile_photos` (migrazione `0005`) e `GET`, `PUT`, `DELETE
/me/photo`: l'API tiene solo un JPEG quadrato di 256 px fatto da lei,
  dritto e senza i dati dello scatto. `DELETE /me` la cancella. Nessuna
  dipendenza nuova. Il resto di TASK-116 (nome, bio, profilo visto dagli
  altri) avrà una migrazione sua. **Sul telefono si vede dopo due passi
  che vogliono l'ok dell'utente**: l'API del server aggiornata con la
  migrazione `0005` (`DEPLOY.md` F.12) e l'app pubblicata; prima, chi
  prova vede «Profile pictures are not available on this API yet.». Poi
  **da provare sull'iPhone**: libreria, fotocamera, il ritaglio.
- **App** — TASK-192: in «Explore» il luogo scelto ha sempre i suoi
  percorsi, chiesto dall'utente (ADR-0155: «premo su Caldonazzo e mi
  vengono fuori Levico»). Prima un paese accanto a una città con percorsi
  mostrava solo quelli della città, entro 5 km, e dal paese non partiva
  niente. Ora un percorso è del luogo solo se parte entro 1,5 km dal punto
  scelto: Caldonazzo, e una frazione come Barco, hanno prima cuore,
  cerchio e stella da 5 km dal loro centro e poi le altre forme; i
  percorsi di Levico restano sotto, con l'etichetta «NEAR CALDONAZZO». Il
  raggio resta 5 km, l'API non cambia. Solo test, non visto in un
  simulatore; il motore sul Mac disegna da Caldonazzo cuore 0,88, cerchio
  0,72, stella 0,90. Pubblicata il 2026-10-02 (update `85fbf31e`): **da
  provare sull'iPhone**. Fuori: «Near me» da Caldonazzo mostra ancora
  solo Levico (dalla posizione non si disegna, ADR-0136: scelta
  dell'utente); i paesi piccoli non sono disegnati in anticipo sul server.
- **App** — TASK-189: «Sport» in «Settings», chiesto dall'utente
  (ADR-0152). Una sezione con «Run» scelto e «Bike» e «Paddle» con «Soon»
  (scelta dell'utente): non si toccano finché il motore non disegna i loro
  percorsi (TASK-190 bici, TASK-191 canoa e paddle, Todo). La scelta resta
  sul telefono; accendere uno sport è una riga di `src/settings/sport.ts`.
  Solo app, nessuna dipendenza nuova. Pubblicata il 2026-10-02 (update
  `ae740677`).
- **App** — TASK-176: tre richieste dell'utente su «Explore»
  (ADR-0144). **I filtri non ci sono più**: «Best near you» mostra tutti
  i percorsi. **Scelta una città, dopo cuore, cerchio e stella l'app
  disegna altre cinque forme** mentre si guardano le prime (luna, cavallo,
  lumaca, testa di cane, testa di coniglio: quelle che a 5 km dal centro
  vengono meglio, misurate su quattro città), una alla volta, ognuna una
  scheda quando tocca a lei; anche nelle città con percorsi consigliati,
  in coda alle loro schede. Il cerchio si chiede per primo: una città nuova
  scarica una zona sola invece di due. **«My start» è diventato «Near
  me»**, la prima voce della fila delle città, accesa finché non se ne
  sceglie una. Nell'API cambia solo l'ordine in cui `draw_examples`
  chiede le prime tre forme. Visto in un simulatore con un'API
  locale: le otto forme a Padova, e Milano con tre forme nel catalogo che
  ne riceve altre cinque. Pubblicata il 2026-10-02 (update `ae740677`):
  **da provare sull'iPhone**. Nelle 64 città con gli esempi già disegnati sul server
  (TASK-168) le prime tre forme arrivano subito e le altre cinque le
  disegna il primo telefono, 7–19 s l'una; poi restano sull'API per tutti.
- **App** — TASK-177: «Profile» con un aspetto nuovo e «Settings», chiesti
  dall'utente (ADR-0145). Con l'account, in alto il cerchio con l'iniziale,
  il nome e l'email; due riquadri con ❤️ «Favorites» e 🏃‍♂️ «My activities»
  e il loro numero in grande; la riga ⚙️ «Settings». «Settings» è una
  pagina a sezioni: l'account, le nove voci che l'utente ha elencato
  (foto, email, telefono, unità, notifiche, help, termini, privacy) con
  «Soon» e senza tocco, e in fondo «Log out» e «Delete account», spostati
  lì con il sì dell'utente. Visto nel simulatore con un'API locale; i
  tocchi sono coperti dai test. **Il server è aggiornato** a `main`
  `781fb18` dal 2026-10-02 13:32Z (ok dell'utente; migrazione `0003_runs`
  applicata, 15 s di API ferma, immagine di prima
  `shaperoute-api:before-task172`). Pubblicata il 2026-10-02 (update
  `7bc3442f`): **da provare sull'iPhone**.
- **App** — TASK-188: un tocco su un disegno di «Feed» apre il suo
  percorso sulla mappa, chiesto dall'utente (ADR-0151): la scheda di
  «Explore», con il cuore dei preferiti, «Start» e il GPX; «←» torna a
  «Feed». Il percorso è quello del catalogo: se il suo `id` è cambiato lo
  si ritrova dalla partenza, se non c'è più la scheda lo dice e non ne
  apre un altro. Uno swipe sopra una scheda non la apre. Solo app. Provato
  in un simulatore con un'API e un database usa e getta: aprire, salvare
  il preferito, «Start», «←». Pubblicata il 2026-10-02 (update
  `7bc3442f`): **da provare sull'iPhone**. Seguiti: lo stesso swipe sulle
  schede di «Explore» (fatto, TASK-196); una domanda per l'utente nel task file (cuore
  e «Start» anche sulla scheda del feed).
- **App** — TASK-181: l'avvio tutto giallo, chiesto dall'utente (seguito di
  TASK-179; aggiornamenti di ADR-0134 e ADR-0147). La schermata di avvio
  nativa è gialla con il logo nero (`app.json`), e l'animazione parte già
  gialla, senza il nero iniziale. Corretto anche un difetto visto filmando
  con il Mac carico: il cuore poteva partire tardi ed essere tagliato dalla
  dissolvenza; ora attesa e disegno sono una sola animazione e l'uscita
  aspetta il cuore finito. Prebuild di iOS controllato, animazione filmata
  in un simulatore. Pubblicata il 2026-10-02 (update `7bc3442f`; in Expo
  Go cambia l'inizio dell'animazione); la schermata nativa **si vede
  solo in una build propria** (TASK-152).
- **API e app** — TASK-172: «My activities», chiesto dall'utente
  (ADR-0140). Con un account, a fine corsa «Save» mette la corsa in «My
  activities» e «Discard» la butta, dopo una conferma (scelta nuova
  dell'utente: non si salva più da sola), con un percorso o senza; senza
  rete la corsa salvata aspetta sul telefono e parte alla prossima
  apertura, una volta sola. In «Profile» la riga «My activities»
  le conta e le elenca, venti per volta: il disegno (percorso giallo,
  corsa chiara), giorno e ora, luogo, km, tempo, passo, punteggio; una
  corsa si apre sulla mappa e si cancella con una conferma. Km, tempo e
  punteggio li conta l'API dalla traccia; il luogo lo trova l'API dal
  chilometro della partenza. Senza account una riga invita a entrare.
  Nell'API la tabella `runs` (migrazione `0003`) e `/me/activities`.
  Server aggiornato (13:32Z, migrazione `0003`) e app pubblicata
  (`7bc3442f`); **provata dall'utente sull'iPhone** il 2026-10-02:
  «provata e funziona».
- **App** — TASK-186: nella corsa «Map» e «Data» sono due pulsanti grandi,
  chiesto dall'utente (ADR-0137, aggiornamento): metà scheda ciascuno, alti
  56 punti, la pagina aperta più chiara. Solo app, niente API, nessuna
  dipendenza nuova. Visto nel simulatore sulle due pagine. Pubblicata su
  `preview` il 2026-10-02 (update `21496dce`, da c6f1fc7), con l'ok
  dell'utente. **Da provare sull'iPhone**. Della
  stessa richiesta: la schermata «Save» / «Discard» a fine corsa va dentro
  TASK-172 (deciso dal coordinatore); «Send to Strava» è TASK-187, che
  aspetta la risposta dell'utente.
- **Motore** — TASK-067: due lettere di una parola si uniscono anche lungo
  la cima, dove la parola viene più corta e si legge uguale, chiesto
  dall'utente (ADR-0063). Tre regole di lettura: non si allunga un tratto
  che finisce in cima (la T, il braccio della E), non si passa sopra la
  lettera, non si tocca una lettera con un solo punto in cima (la I
  sarebbe una T). Cambiano solo le parole con U, V, W o Y (P, U, V, Y nelle
  squadrate): «UVA» −7,4%, «NUVOLA» −5,2%; le altre restano identiche.
  Diciotto campioni a 15 km: l'utente ha preferito il percorso di prima
  nei sette casi giudicati, e ha scelto lo stesso di accenderle per tonde
  e squadrate (`words.TOP_JOINS`; `False` per tornare indietro). La ricerca
  non dura di più. API e app non cambiano. **L'app pubblicata le vede dopo
  aver aggiornato l'API sul server** (`DEPLOY.md` F.12), con l'ok
  dell'utente. La scala per lettera non si fa, per scelta dell'utente.
- **App** — TASK-179: l'animazione all'avvio, chiesta dall'utente
  (ADR-0147). Aprendo l'app il giallo riempie lo schermo, una penna disegna
  il cuore di Milano del video, sotto c'è il logo nero; 2,4 secondi, poi
  l'app, che intanto si è caricata sotto. Si vede anche in Expo Go, dove la
  schermata di avvio di TASK-165 non c'è. Nessuna dipendenza nuova,
  `App.tsx` non toccato (monta da `index.ts`). Filmata in un simulatore.
  Pubblicata il 2026-10-02 (update `3ce1aaf2`, da 9b1968b): **da guardare
  sull'iPhone**. La schermata di avvio nativa gialla, scelta dall'utente, è
  TASK-181.
- **App** — TASK-174: le schede di «Explore» hanno la mappa sotto la linea,
  con i nomi dei paesi, chiesto dall'utente (ADR-0142): negli esempi di una
  città e in «Best near you». Sono le foto di «Feed» (TASK-162), fatte
  dalla stessa pagina nascosta; il credito della mappa sta una volta sola
  accanto alle schede. Negli esempi la scheda dice anche il paese. Solo
  app, niente API. Pubblicata il 2026-10-02 (update `3ce1aaf2`): **da
  provare sull'iPhone**.
- **App** — TASK-173: la musica nella corsa, chiesta dall'utente («uso
  Spotify», ADR-0141). Mentre si corre, sulle pagine «Map» e «Data», «Music»
  di fronte a «Pocket» apre Spotify; su un telefono senza Spotify, la sua
  pagina nello store. Sgrava non suona niente e la corsa non va in pausa.
  Nessuna dipendenza nuova. Visto nel simulatore, dove Spotify non c'è.
  Pubblicata il 2026-10-02 (update `3ce1aaf2`). **Da provare
  sull'iPhone**: «Music» con Spotify vero; la
  voce delle svolte con la musica accesa (la abbassa, la ferma, ci parla
  sopra?); la corsa mentre si è in Spotify. **Una domanda per l'utente**
  nel task file: brano, pausa e avanti dentro Sgrava.
- **App, test** — TASK-193: i test dell'app non cadono più per la macchina
  carica. Ogni test ha 30 s invece di 5: il primo disegno di un file a
  cache fredda prendeva 5,1–5,2 s in CI (oggi rossi #194, #199, #207) e
  fino a 22 s sul Mac con più agenti al lavoro. `AppFreeRun.test.tsx` gira
  su un orologio finto: prima quattro punti dipendevano dall'orologio vero.
  `AppFavorites.test.tsx` non è stato diviso: provato, il primo disegno
  lento passa solo a un altro file (numeri nel task file). L'app non
  cambia.
- **App** — TASK-175: la mappa non ha più i pulsanti «+» e «−» in alto a
  destra, chiesto dall'utente (ADR-0143): si ingrandisce solo con le dita.
  Il cuore dei preferiti sale nell'angolo, alla stessa altezza di «←».
  Solo app, niente API. Pubblicata il 2026-10-02 (update `3ce1aaf2`).
- **App** — TASK-169: la corsa rifatta sul modello di Nike Run Club, chiesta
  dall'utente (ADR-0137), con un percorso e senza. Parte con «3 · 2 · 1»;
  due pagine da scorrere, «Map» (mappa, indicazioni, km, passo di adesso e
  tempo) e «Data» (i km in grande, passo medio, ultimo km, dislivello,
  calorie stimate, i km uno per uno); «Pause» e «Resume», la pausa da sola
  dopo 10 secondi fermi, «Stop» da tenere premuto. Il tempo non conta più
  le pause, nemmeno fra «Stop» e «Keep running»; la voce dice i km anche
  con un percorso, e «Voice» la spegne. Chiude i tre seguiti di TASK-164.
  Nessuna dipendenza nuova, niente API, `App.tsx` non toccato. Visto nel
  simulatore con un GPS simulato. Pubblicato su `preview` il 2026-10-02
  (update `38f9a17b`, da fa6462b). **Da provare sull'iPhone**: lo swipe col
  dito, «Stop» tenuto premuto, la pausa da sola.
  Fuori, già chiesto dall'utente: il battito da sensore Bluetooth e da
  Apple Watch (solo in una build propria). La musica: l'utente usa Spotify
  (TASK-173).
- **API e app** — TASK-171: «Favorites», chiesti dall'utente (ADR-0139).
  Sulla mappa, di fronte a «←», un cuore tiene fra i preferiti dell'account
  il percorso che si vede (disegnato, di «Explore», a tema); in «Profile»
  la riga «Favorites» li elenca a schede e li riapre sulla mappa, da
  correre ed esportare. Senza account il cuore porta a «Sign up». Nell'API
  la tabella `favorites` (migrazione `0002`, la prima con PostGIS) e
  `/me/favorites`. Visto in un simulatore, con un'API e un database
  locali: l'elenco, un preferito aperto sulla mappa con il suo cuore, la
  riga in «Profile». **Sul telefono si vede dopo due passi che vogliono l'ok
  dell'utente**: l'API del server aggiornata (`DEPLOY.md` F.12) e l'app
  pubblicata. Poi **da provare sull'iPhone**. Segue TASK-172, «My
  activities»: le corse registrate, nel profilo.
- **API e app** — TASK-168: gli esempi di una città in «Explore» più
  veloci, chiesto dall'utente (ADR-0136). Un cuore, un cerchio o una stella
  disegnati dal centro di una città restano sull'API
  (`data/cache/routes/`), e la stessa richiesta riceve il percorso nella
  risposta al `POST`: aspetta solo il primo telefono in una città (sul
  Mac: 0,0 s invece di 10–14 s). Solo dai centri delle città, mai dalla
  posizione di qualcuno; un motore cambiato ridisegna. L'app chiede lo
  stato di ogni percorso ogni 0,5 s all'inizio, non più ogni 2 s.
  `python -m shaperoute_api.draw_examples` disegna prima gli esempi di un
  elenco di città. **Sul server dal 2026-10-02** (10:38Z, ok dell'utente;
  commit `ec84042`, 14 s di API ferma, immagine di prima
  `shaperoute-api:before-task171`): `draw_examples` ha disegnato gli
  esempi di 62 città (le 52 italiane, Rovereto e le città in evidenza
  tranne Berlino), 186 percorsi, 13 MB, 30 minuti; lì compaiono appena
  scelta la città. La zona di Rovereto è stata aggiunta dall'estratto
  (84 s, 35 MB). Il motore cambiato da TASK-067 e TASK-180 ha reso vecchi
  quegli esempi (l'impronta del motore è cambiata): il 2026-10-02 alle
  18:09Z il server è passato a `fa6ee9e` (ok dell'utente, immagine di
  prima `shaperoute-api:before-task176`) e `draw_examples` li ha ridisegnati
  per 64 città, Venezia e Berlino comprese (382 file, 33 minuti). **Dopo
  ogni aggiornamento che cambia `route_engine` va rilanciato
  `draw_examples`** (circa 35 minuti): seguito per `DEPLOY.md` F.12
  (TASK-122). Il controllo ogni 0,5 s è pubblicato.
- **API** — TASK-195: il cerchio per primo in `draw_examples` è entrato
  con TASK-176 (#199), che l'ha fatto mentre questo task partiva. Qui resta
  solo il test che tiene vera la ragione: l'area del cerchio da 5 km
  contiene quella di cuore e stella dallo stesso centro. Vale sul server
  dal 2026-10-02 18:09Z. Il task file dice «niente da rifare»: vale solo
  per l'ordine delle forme. Un aggiornamento che cambia `route_engine`
  invece fa ridisegnare gli esempi (vedi TASK-168).
- **App** — TASK-170: «Run with Strava» tolto, chiesto dall'utente
  (ADR-0138, che supera ADR-0106). Nelle tre schede di un percorso
  (disegnato, di «Explore», a tema) restano «Start» ed «Export GPX»; il
  GPX è il modo di portare un percorso in un'altra app. Solo app, niente
  API. Pubblicata il 2026-10-02 (update `38f9a17b`, da fa6462b).
- **Motore e API** — TASK-180: dove non ci sono strade il motore lo dice,
  e una zona tiene ogni pezzo della sua rete (ADR-0148). Gli esempi di
  Venezia finivano in `engine_error` (TASK-168) per due difetti. Un
  ritaglio senza nodi non aveva un nome: ora è `NoRoadsError`, che l'API
  dice `shape_not_drawable` e la CLI «No route». E la zona di Venezia non
  aveva l'isola: OSMnx tiene di un download il pezzo connesso più grande,
  e a piedi il centro storico non è unito alla terraferma (sul Ponte della
  Libertà l'ultimo tratto della ciclopedonale è `foot=no`: visto sui dati
  OSM del 2026-10-02). Ora chi scarica una zona tiene tutti i pezzi, e il
  più grande si sceglie nel ritaglio, area per area. Le città di oggi non
  cambiano: quattro zone del Mac rifatte dalle risposte in cache danno lo
  stesso grafo e la stessa linea (`MAPS.md`, «Area scaricata»). **Sul server dal
  2026-10-02 18:09Z** (ok dell'utente): la zona di Venezia è rifatta
  dall'estratto (26 MB, isola compresa; le zone vecchie messe da parte come
  `before-task180-…`), e cuore, cerchio e stella si disegnano in 33 s.
- **App** — TASK-166: l'annuncio AdMob compare all'inizio della ricerca
  («Draw route», «Ask for a route») e copre il calcolo; alla X lo schermo
  mostra il percorso, se è pronto, o l'attesa (ADR-0102, aggiornamento).
  L'ID vero dell'app AdMob dell'utente per iOS è in `app.json`; l'unità
  resta quella di prova finché non ci sono profilo pagamenti, app sullo
  store e annunci veri (TASK-150, 152, 153). Provato nel simulatore.
- **App e catalogo** — TASK-163 (ADR-0132), chiesto dall'utente: in
  «Explore», finché una città cercata disegna cuore, cerchio e stella,
  sotto ci sono 5 disegni del feed con la foto della mappa (#174,
  pubblicata il 2026-10-02, update `4cab12c4`; **da provare
  sull'iPhone**). E 13 delle 14 città in evidenza hanno le tre forme da
  5 km già nel catalogo: nove file nuovi, 27 forme fra 0,91 e 1,00, da
  `seed_catalog.py --featured` con le zone copiate dal server (New York
  le aveva da TASK-161). **Manca Berlino**, per scelta dell'utente
  rimandata a quando Overpass riapre: la sua zona non è sul server.
  Il catalogo è sul server dal 2026-10-02 10:38Z (aggiornamento a
  ec84042, con l'ok dell'utente): l'app pubblicata le vede.
- **App** — TASK-196: uno swipe che finisce sopra una scheda di «Explore»
  non la apre più (seguito di TASK-188, stessa soluzione di ADR-0151: la
  scheda ricorda dove il dito è sceso e ignora un dito che si è mosso più
  di 12 punti). La correzione è in `RouteCard`, quindi vale per i percorsi
  di «Best near you», per gli esempi di una città e per i preferiti in
  «Profile». Solo app, con un test; **da provare con il dito
  sull'iPhone**, dopo la prossima pubblicazione su `preview`. Restano com'erano i
  pulsanti piccoli della pagina (le città, «Ask for a route», «Try
  again»): vedi il task file.
- **App** — TASK-167: in «Explore» i percorsi sono schede, due per riga,
  con il disegno grande in alto, scelto dall'utente fra le proposte
  grafiche (ADR-0135). I filtri stanno in una riga sola, «Shape» e
  «Distance», e le scelte si aprono sotto. Anche gli esempi di una città
  sono schede. Visto su un simulatore con il catalogo di Trento.
  Pubblicata il 2026-10-02 (update `7950b7c0`): **da provare
  sull'iPhone**.
- **App** — TASK-164: la schermata della corsa rifatta, chiesta dall'utente
  (ADR-0133). Sotto la mappa, con un percorso e senza: km fatti, passo
  medio, passo di adesso (ultimi 200 m) e tempo; con un percorso anche i km
  rimasti, i minuti stimati e la barra del disegno fatto («42% drawn»
  sotto la svolta), senza percorso il passo dell'ultimo km. Sulla mappa il
  segnaposto è una freccia girata dove si sta andando. Senza percorso le
  svolte non esistono: al loro posto freccia e distanza verso la partenza.
  Nessuna dipendenza nuova, niente API. Visto nel simulatore con un GPS
  simulato. Pubblicata il 2026-10-02 (update `eba74321`). **Da provare
  sull'iPhone** camminando.
  Fuori, da chiedere all'utente: «Pause», «Stop» da tenere premuto, la voce
  a ogni km nella corsa con percorso.
- **Catalogo** — TASK-161: il catalogo seme in tutte le 14 città, 323
  percorsi (Napoli, Verona, Padova, Genova, Bari, Palermo e New York
  nuove; Genova, Bari, Palermo e New York con le zone del server), e le
  parole. Solo parole corte, scelta dell'utente (ADR-0130); parole e forme
  illeggibili tolte a occhio (ADR-0097, aggiornamento 2026-10-02).
  Mancano le forme a 21 km di Bari, Palermo e New York (Overpass).

- **App** — TASK-162: in «Feed» ogni disegno ha sotto la mappa della sua
  zona, chiesta dall'utente (ADR-0131): strade, acqua, verde e nomi, con
  lo stile dell'app. È una foto: una pagina MapLibre nascosta sotto
  l'elenco ne fa una alla volta e la scheda la mette sotto la linea, con
  il credito della mappa. Senza rete le schede restano come prima. Nessuna
  dipendenza nuova, niente API. Pubblicata il 2026-10-02 (update
  `d186a9ef`) e provata dall'utente sull'iPhone: «la mappa nei feed c'è».
- **App** — TASK-165: la schermata di avvio con il logo, chiesta
  dall'utente (ADR-0134): fondo nero, su iOS il logo intero, su Android il
  segno. Usa `expo-splash-screen`, dipendenza nuova approvata dall'utente;
  è fra i moduli di Expo Go, e l'app non lo importa: in Expo Go non cambia
  niente. **Da guardare in una build propria** (TASK-152). Dopo il merge:
  `npm install` nel checkout principale.
- **API e app** — TASK-194: il file GPX esportato si chiama
  `sgrava-heart-5km-2026-09-23.gpx`, non più `shaperoute-…` (seguito di
  TASK-160); senza un nome dall'API, `sgrava.gpx`. Un'API non aggiornata
  che risponde ancora il nome vecchio continua a funzionare. Sul telefono
  il nome nuovo arriva solo dopo l'aggiornamento del server e la
  pubblicazione dell'app: tutti e due aspettano l'OK dell'utente. Dentro
  il file, `creator` dice ancora «ShapeRoute route-engine»: seguito
  possibile (`tasks/TASK-194.md`).
- **App** — TASK-160: i tre messaggi sulla posizione spenta dicono
  «Location is off for Sgrava…» invece di «…for ShapeRoute…» (prima
  schermata, navigazione, corsa libera): è il nome sotto l'icona da
  TASK-159, e quello che le Impostazioni elencano in una build propria. In
  Expo Go il permesso resta sotto «Expo Go».
- **App** — TASK-159: l'icona dell'app è il nuovo logo scelto dall'utente
  (ADR-0129): una S gialla su nero, fatta come un percorso che parte da un
  punto. Sostituisce il segnaposto di Expo, anche su Android (icona
  adattiva e a un colore); i vettoriali in `docs/brand/`. In Expo Go sulla
  schermata di casa non si vede: **da guardare in una build propria**
  (TASK-152). Sotto l'icona il nome è «Sgrava», non più «ShapeRoute»
  (`name` in `app.json`). Restano la schermata di avvio, da decidere, e tre
  testi dell'app che dicono ancora «Location is off for ShapeRoute…».
- **Documentazione** — TASK-141: `STATUS.md` allineato ai task file e
  alle PR del 2026-10-02: prossimo passo, task in lavorazione, In una riga;
  TASK-126, 128, 129, 131 e 134 qui sotto.
- **App** — TASK-156: «Feed» mostra quindici disegni di esempio, chiesti
  dall'utente (ADR-0127): le figure venute meglio nelle sette città del
  catalogo, due per città, undici forme, con corridori, titoli, tempi e
  punteggi inventati. Le linee sono quelle del motore; le sceglie e le
  scrive `tools/sample_feed.py`. Niente sulla pagina dice che sono esempi,
  per scelta dell'utente: da rivedere prima di invitare altre persone.
  Niente API, niente like o commenti: il feed vero resta TASK-118. Visto
  su un simulatore. **Da provare sull'iPhone** (pubblicata il 2026-10-02; resta la prova sull'iPhone).
- **App** — TASK-157: in «Explore», «Ask for a route» sta in fondo alla
  pagina, sotto gli esempi della città e i percorsi consigliati, chiuso
  dietro una riga grigia e sottolineata; un tocco lo apre lì, e la pagina
  scorre fino a lui. Chiesto dall'utente: prima le figure già pronte delle
  zone, la richiesta in parole quasi nascosta. **Da provare sull'iPhone**
  (pubblicata il 2026-10-02; resta la prova sull'iPhone).
- **App** — TASK-158: il pulsante della corsa libera, in cima a «Draw», dice
  «Run without a route» invece di «Run», chiesto dall'utente: «Run» da solo
  si leggeva come correre il percorso scelto sotto. **Da provare
  sull'iPhone** (pubblicata il 2026-10-02; resta la prova sull'iPhone).
- **Mappe** — TASK-137: 52 città italiane con la zona già sul server
  Hetzner (circa 17 × 17 km attorno al centro, nomi delle strade compresi),
  da `python -m shaperoute_api.prefetch_zones --preset italy --extract …`
  (ADR-0119): esempi e categorie di «Explore» lì non aspettano Overpass
  (provato in 7 città, nessun download). Overpass aveva bloccato il server
  dopo 5 città; le altre vengono dall'estratto Geofabrik dell'Italia, con
  osmium solo nell'immagine dei download. Anche 10 delle 11 città estere in
  evidenza, dai loro estratti; Berlino no (memoria: non sta in 4 GiB). Una
  zona estera grande pesa 0,5–0,76 GB nella memoria dell'API (seguiti per
  TASK-122 nel task file). Berlino resta a Overpass. Da fare: rifare le zone
  quando l'estratto invecchia.
- **App** — TASK-155: in «Explore», sulla mappa di un esempio di città gli
  altri percorsi fra «A · B · C» sono linee grigie sotto quello scelto,
  come per un percorso disegnato; chiesto dall'utente dopo aver provato
  TASK-151 sull'iPhone (2026-10-02: «ora funziona»). In `App.tsx` cambia
  solo cosa riceve la mappa. **Da provare sull'iPhone** (app
  pubblicata il 2026-10-02; resta la prova sull'iPhone). Resta il segnale della scelta (`TASK-151.md`).
- **App** — TASK-154: tre pagine affiancate, «Feed», «Draw», «Explore»,
  scelta dell'utente dopo le proposte grafiche (ADR-0124). Si passa con
  uno swipe a destra o a sinistra, o toccando i nomi in alto; l'app si apre
  su «Draw». La barra in basso di TASK-115 non c'è più: «Profile» si apre
  da un pulsante tondo accanto ai nomi e si chiude con «←». «Explore»
  chiede i percorsi alla prima visita; «Feed» è vuota finché non arriva
  TASK-118. Mappa e corsa restano a tutto schermo, senza swipe. Viste le
  tre pagine e «Profile» su un simulatore. **Da provare con il dito
  sull'iPhone**: lo swipe, e le righe che scorrono di lato dentro le
  pagine (app pubblicata il 2026-10-02; resta la prova sull'iPhone). Seguiti nel task
  file, fra cui i «File toccati» di TASK-118.
- **App** — TASK-132: un annuncio AdMob a schermo intero a ogni ricerca
  («Draw route» e «Ask for a route» in «Explore»), prima del percorso; alla
  X, o senza annuncio, il percorso subito (ADR-0102). Consenso di Google
  alla prima ricerca, mai all'apertura. Solo in una build propria: in Expo
  Go nessun annuncio e l'app come prima. Annunci di prova di Google finché
  non ci sono account e app sullo store (TASK-150, 152, 153). Provato nel
  simulatore iPhone e in Expo Go (2026-10-02).
- **App** — TASK-115: ci si iscrive, si entra e si esce dall'app
  (ADR-0125). Due schede in fondo, «Draw» (le schermate di prima, intatte)
  e «Profile»: «Sign up» (email, nome, password, «I am at least 16») e
  «Log in», con gli errori in parole; dentro, «Log out» e «Delete account»
  con la conferma. La sessione sta nel portachiavi (`expo-secure-store`):
  riaperta, l'app è già dentro e lo verifica con `GET /me`; una sessione
  finita fa uscire e «Profile» chiede di rientrare. La barra si toglie
  sulla mappa e durante la corsa. **Da provare sull'iPhone contro l'API
  vera**: serve un'API con `SHAPEROUTE_DATABASE_URL`, che il server di
  TASK-122 ha dal 2026-10-02 (app pubblicata il 2026-10-02; resta la prova sull'iPhone). Seguito:
  TASK-116 (il profilo).
- **App** — TASK-151: in «Explore» un esempio di città (il cuore da 5 km
  di New York) si apre con le tessere «A · B · C», chiesto dall'utente
  (ADR-0126): l'API mandava già le alternative, l'app teneva solo la prima.
  Scheda, mappa, «Start» e GPX sono del percorso scelto; gli esempi già
  sul telefono si ridisegnano una volta. `App.tsx` non è toccato, quindi
  gli altri percorsi non sono ancora in grigio sulla mappa: seguito nel
  task file. I percorsi del catalogo restano uno solo. **Da provare
  sull'iPhone** (app pubblicata il 2026-10-02; resta la prova sull'iPhone).
- **App** — TASK-149: si può correre senza disegnare niente, chiesto
  dall'utente (ADR-0122). «Run» in alto nella prima schermata, accanto a
  «Explore», apre la mappa che segue la posizione e disegna la linea
  corsa; il banner dice km, tempo e passo medio, sotto «Pocket» e «Stop»;
  a ogni km la voce dice tempo e passo.
  A «Stop» il riepilogo (km, tempo, passo), «Keep running» e «Done», che
  cancella la corsa dal telefono. Niente forma, niente punteggio, niente
  API: la traccia è quella di TASK-112, nello stesso file, con il percorso
  vuoto, e si riapre con l'app se si chiude a metà. **Da provare
  sull'iPhone** (app pubblicata il 2026-10-02; resta la prova sull'iPhone). Seguito
  possibile: inquadrare tutta la linea a fine corsa.
- **App** — TASK-148: tolto da `ExploreTools.tsx` il vecchio «Ask for a
  route», con i suoi test e gli stili che usava solo lui: è il «da fare
  dopo il merge di TASK-142» di TASK-143. Quello vero è in
  `AskForRoute.tsx`; l'app non cambia, niente da ripubblicare.
- **App** — TASK-146: `apps/mobile/app.json` nomina il proprietario vero
  del progetto Expo, l'organizzazione `lppl1316s-team` (trasferito
  dall'account `lppl1316` il 2026-10-02). `eas update` da una copia pulita
  di `main` non chiede più di correggere `owner` a mano; `DEPLOY.md` A.6
  aggiornato. L'app non cambia: niente da ripubblicare per questo.
- **Catalogo** — TASK-128: Firenze nel catalogo seme (22 percorsi, 159 in
  7 città), una zona per città; la città salta se Overpass rifiuta. In
  `main` (PR #147). Napoli, Verona, Padova, Genova, Bari, Palermo,
  New York e le frasi sono del seguito TASK-161 (PR #175).
- **API** — TASK-114: gli account nell'API, su PostgreSQL con PostGIS
  (ADR-0115, ADR-0120). `POST /accounts` per iscriversi, `POST /session`
  ed `DELETE /session` per entrare e uscire, `GET /me`, `DELETE /me` che
  cancella tutto; token in `Authorization: Bearer`, password Argon2id,
  sessioni di 90 giorni dall'ultimo uso, 5 password sbagliate per email in
  15 minuti. I percorsi restano aperti. Con `SHAPEROUTE_DATABASE_URL`
  l'API applica le migrazioni all'avvio; senza, gli account rispondono 503.
  Test su un PostGIS vero, avviato con docker (sul Mac Colima,
  `SETUP.md` 10.4). Il database sul server è di TASK-122; il seguito è
  TASK-115, le schermate dell'app. La password dimenticata resta fuori:
  serve la posta (Brevo).
- **Server** — TASK-144: la guida per portare l'API su un server a
  pagamento, con il Mac spento (`DEPLOY.md`, strada F, ADR-0111), e la
  configurazione pronta in `deploy/`: l'API con zone, eventi e catalogo,
  l'AI (profilo `ai`) e HTTPS con Caddy (profilo `public`) a scelta. Prima
  privato con Tailscale e `tailscale serve`, poi un dominio, poi gli
  store, e i prezzi del 2026-10-01. Il server scelto dall'utente, Hetzner
  CX33 (10,97 €/mese IVA compresa), è già acceso ma messo su a mano:
  **spostarlo su `deploy/compose.yaml`** (F.12, stessi dati e stesso
  indirizzo, l'app non cambia) è il passo dopo, a fine coda dei merge. La
  CI avvia la configurazione.
- **Motore** — TASK-147: sul server Linux tornano le alternative A · B · C
  (forme, parole, immagini), che l'utente non vedeva più (ADR-0121). Il
  motore leggeva la memoria libera (MemFree, 534 MB: il resto è cache
  delle zone) invece di quella disponibile (MemAvailable, 6,8 GB), e non
  avviava mai le partenze vicine. Provato nel container del server: cuore
  da 5 km a Trento con 1 alternativa (10,8 s), stella con 2 (5,8 s), prima 0. Il server si aggiorna a `main` subito dopo il merge, perché l'utente
  vuole le alternative presto; l'app non va ripubblicata.
- **API e app** — TASK-142: le ricerche imparano anche da cosa fa l'app
  (ADR-0112, `docs/INSIGHTS.md`). `POST /signals` riceve la città scelta in
  «Explore» e come, il percorso usato fra A·B·C, «Try N km» e la forma presa
  dopo un errore; i percorsi annullati sono eventi. Nuove proposte:
  `city_name` («levic» → Levico Terme, applicata `/cities` la cerca),
  `review_ranking`, `review_distance`; Vercelli scelta fra i suggerimenti
  ora si propone per il catalogo. Comandi `why`, `compare --split`, `trend`,
  `--since/--until`. Corretto un errore di TASK-130: nessun percorso
  dell'API era mai stato registrato. Provato su un'API di prova con
  Geoapify. L'API sul server e l'app sono aggiornate (app pubblicata il
  2026-10-02; resta la prova sull'iPhone). Seguiti
  possibili: esportare il tipo dei segnali da `shared-types/src/index.ts`,
  ora che TASK-088 è entrato; la forma toccata dopo parole non lette
  (`ShapeTiles.tsx`) come prova per i sinonimi.
- **Motore** — TASK-140: luna, farfalla, lumaca (e il cavallo, che non
  cambia) evitano i baffi come cuore, cerchio e stella; si contano solo
  quelli oltre i tratti voluti della forma (ADR-0118). Gatto, pesce e le
  teste restano come prima, per scelta dell'utente. Provato sull'iPhone
  (2026-10-02): funziona.
- **Catalogo** — TASK-088: zucca di Halloween (`pumpkin`) e albero di
  Natale (`christmas_tree`) nel catalogo, con parole, tessere 🎃 🎄 e AI
  (ADR-0084); «albero» e «tree» da soli restano nessuna forma. Le tessere
  ora sono una riga che scorre di lato. Provato sull'iPhone a Milano
  (2026-10-01): «va tutto». Da decidere con l'utente: quali altri contorni
  già disegnati (uccello, cane intero, albero, freccia, corona) mettere
  nella riga.

- **Motore** — TASK-136 (miglioramento generale scelto dall'agente): la
  CLI e `seed_catalog` non salvano più i ritagli dei grafi, come già
  l'API (ADR-0108). Una partenza nuova è più veloce (Milano, cuore da
  10 km: da 11,8 a 5,5 s) e non scrive 20–110 MB; la stessa richiesta
  rifatta costa 0,4–2,6 s in più. Stessi percorsi. I ritagli già salvati
  si elencano con `python -m route_engine.prune_crops` e si cancellano con
  `--delete`: sul Mac erano 346 su 355 grafi, 17,9 GB su 18,6; alla
  cancellazione, dopo il merge su richiesta dell'utente (2026-10-01), erano
  382, per 19,4 GB.
- **Motore, API e app** — TASK-145: «Start» anche sui percorsi di
  «Explore» (consigliati, esempi delle città, a tema), chiesto dall'utente
  (ADR-0117). Al tocco l'app chiede le indicazioni a `POST
/route-directions`, che ritrova i nodi della linea sul grafo della zona
  (`route_nodes.py`), poi la navigazione di sempre; «Stop» torna alla
  scheda. Sull'API del Mac 0,1–0,5 s, e indicazioni identiche a quelle
  del motore su 4 percorsi appena pianificati. L'API sul server e l'app
  sono aggiornate (app pubblicata il 2026-10-02; resta la prova
  sull'iPhone).
- **App** — TASK-143: «Ask for a route» mostra Food, Famous Places e
  «More…»; una città senza percorsi consigliati disegna da sola cuore,
  cerchio e stella da 5 km, uno alla volta, che si aprono sulla mappa e
  restano sul telefono (ADR-0116). Pergine Valsugana: 6 s per tutti e tre.
  Sul server Hetzner, che l'app usa, Vercelli la prima volta: 94 s (cuore
  40, cerchio 48, stella 5), quasi tutti download da Overpass; il cerchio
  riscarica una zona più larga di soli 30 m per lato (proposta: zone
  scaricate con un margine, dopo TASK-136). Il vecchio `AskForRoute` di
  `ExploreTools.tsx` l'ha tolto TASK-148. TASK-138 provato sull'iPhone
  (2026-10-01): funziona.
- **Scelte** — TASK-110: la parte social decisa dall'utente (ADR-0114):
  Oracle Always Free, email e password, corse private finché pubblicate,
  consigliati da un punto del giro, 16 anni, cancellazione totale, due
  moderatori; il come in ADR-0115, lo schema in `DATABASE.md`.

- **API e app** — TASK-138: in «Explore» il campo «Type a city or a
  place» suggerisce a metà parola città e luoghi (ADR-0110): «arena di ver»
  → Verona Arena, «duomo di mil» → Duomo, «ver» → Verona come centro città.
  Un luogo scelto fa partire le categorie dal suo punto. L'API sul server
  e l'app sono aggiornate (app pubblicata il 2026-10-02); provato
  sull'iPhone il 2026-10-01 (voce di TASK-143).
  «ver» non dà ancora i luoghi famosi di Verona: Geoapify non li ordina per
  fama (Fuori scope del task file).
- **Motore** — TASK-139: anche cerchio e stella evitano i pezzi fatti
  avanti e indietro (ADR-0109), con lo stesso peso del cuore. Il cerchio
  non cambia sulle 7 prove; 3 stelle su 7 cambiano, 2 giudicate meglio.
  Provato sull'iPhone (2026-10-01): funziona.
- **API** — TASK-130: le ricerche che insegnano (ADR-0101,
  `docs/INSIGHTS.md`). L'API registra ogni ricerca e ogni segnale d'uso in
  `data/insights/` (acceso di default, senza dati personali); `python -m
shaperoute_api.insights` propone sinonimi, correzioni dei refusi, città e
  frasi per il catalogo, con le prove e i controlli superati (`explain`).
  Si impara solo da giorni o luoghi diversi (il modello risponde sempre
  uguale) e mai se l'AI e l'ortografia non concordano. Si applica solo a
  mano, validato (`validate`, anche in CI), versionato, reversibile;
  `impact` dice se una versione ha aiutato, solo con eventi sufficienti.
  Provato dal vivo: «rmantico» a Bologna e Torino → correzione → a Milano
  letto dal vocabolario, senza AI (1,0 s → 0 ms). Seguiti possibili, da
  approvare: i segnali dell'app (percorso scelto fra A·B·C, «Try N km»),
  e TASK-128 che legge città e frasi desiderate.
- **Motore** — TASK-131: un cuore più bello a occhio, provato
  sull'iPhone (2026-10-01). Il cuore evita i pezzi fatti avanti e indietro
  (ADR-0107); la forma ideale resta quella di oggi, preferita dall'utente.
  Il seguito, lo stesso peso per cerchio e stella, è TASK-139.
- **App e API** — TASK-134: «Explore»: città → categoria → percorso
  (ADR-0105): città in evidenza e recenti, suggerimenti mentre si scrive,
  13 categorie da toccare. In `main` (PR #135), da provare sull'iPhone
  (task file «In revisione»).
- **App** — TASK-135: «Run with Strava» in ogni scheda di percorso, il
  flusso ufficiale (ADR-0106): salvare il GPX, importarlo nel route builder
  di Strava, seguirlo dall'app Strava. Strava non permette di creare
  percorsi via API. L'import va provato con un account vero.
- **Motore** — TASK-133 (miglioramento generale scelto dall'agente): i
  file della cache delle zone si scrivono interi o non si scrivono
  (ADR-0104). Un'API o uno script fermati a metà scrittura non lasciano più
  un GraphML, un pickle o un file di vie con nome rotti, che facevano
  fallire ogni percorso della zona finché non si cancellavano a mano; un
  pickle che non si legge cede al GraphML. Stessi percorsi, stessi tempi.
- **API e app** — TASK-129: «Explore» per ogni città e percorsi a tema
  (ADR-0099): «Search a city» e «Ask for a route», una forma che passa dai
  luoghi veri di un tema. Provato a Torino, Bologna, Milano, Roma e New
  York; Parigi e Tokyo quando Overpass riapre. In `main` (PR #126; task
  file «In revisione»).
- **Motore** — TASK-127: Overpass dall'indirizzo che risponde (ADR-0100);
  le zone nuove si scaricano dal Mac. Dopo una serie di download Overpass
  smette comunque di rispondere per qualche ora (MAPS.md).
- **Motore, API e app** — TASK-093: fino a tre percorsi fra cui scegliere
  (ADR-0087). Sotto la mappa le tessere «A · B · C» con km e somiglianza,
  gli altri percorsi grigi sulla mappa; GPX, «Start» e avvisi del percorso
  scelto. Anche per le immagini. Il percorso scelto dal motore resta lo
  stesso (le 8 richieste dall'iPhone del 2026-10-01 rifatte uguali); dopo
  un piano già buono le partenze vicine si aspettano al più 3 s. Provato
  sull'iPhone (2026-10-01): funziona. L'utente: «il cuore ad occhio
  saprei farlo un po' meglio» (da proporre come task sul motore).
- **API e app** — TASK-126: «Explore» (ADR-0098): `GET
/recommended-routes` dai file del catalogo e la terza schermata
  dell'app. In `main` (PR #124), da provare sull'iPhone (task file «In
  corso»).
- **Catalogo** — TASK-125: il seme dei percorsi consigliati, 137 in 6
  città (Trento, Levico, Milano, Roma, Torino, Bologna), guardati a occhio
  (ADR-0097). Lo script ha già le frasi di ogni città e New York: si
  generano con un nuovo giro, insieme a Firenze, Napoli, Verona, Padova,
  Genova, Bari e Palermo, quando Overpass risponde da questo Mac.
- **API** — TASK-124: il log di accesso dell'API non scrive più le query
  string, quindi niente posizione né testo di `GET /places` (ADR-0096);
  provato sull'API del Mac, che gira con `--request-log`.
- **API e app** — TASK-123: i luoghi della partenza da Geoapify attraverso
  l'API (`GET /places`, ADR-0095), con cache; l'app torna a Photon senza
  API o senza chiave. Serve `GEOAPIFY_API_KEY` sull'API (`DEPLOY.md`, «La
  ricerca dei luoghi»), in `.env` sul Mac. Provato sull'iPhone (2026-10-01):
  0,4–1,2 s invece dei 2–4 s di Photon.
- **API e app** — TASK-113 (prova sull'iPhone non riportata, vale anche
  per TASK-112): a fine corsa l'app mostra
  la corsa sopra il percorso e il punteggio da 0 a 100, chiesto a `POST
/track-scores` (ADR-0093). Senza rete la corsa resta sul telefono e il
  punteggio si richiede dopo. Il seguito della parte social è **TASK-110**,
  le scelte dell'utente su account e dati.
- **Motore** — TASK-091: il log dell'API non scrive più le coordinate
  della partenza né delle partenze vicine provate (ADR-0092); resta
  «start N: score…, approach … m». Il nome del file della zona in cache
  (un riquadro di chilometri) c'è ancora.
- **App** — TASK-112 (prova sull'iPhone da fare con TASK-113): durante la
  navigazione l'app registra la traccia della corsa e la tiene in un file
  sul telefono, anche se l'app si chiude (`trackRecorder.ts`,
  `trackStore.ts`, ADR-0091). Sullo schermo non cambia niente: la usa
  **TASK-113**, che deve anche salvare la somiglianza del percorso e
  chiedere «riprendi o scarta» alla riapertura.

- **Motore, API e app** — TASK-084: più soggetti in una foto, fino a 4,
  in una linea sola (ADR-0079). Il più grande è il contorno, gli altri
  sono appesi con un trattino nel punto più vicino, fatto andata e
  ritorno; con più di 4 la foto è rifiutata («more than 4 separate
  things»). I dettagli a mano passano da 50 punti a 200 punti percorsi
  (circa 100 andata e ritorno). Campioni a 12 km: Milano «sì», Levico
  «quasi». Provato sull'iPhone dall'utente (2026-09-30): funziona.
- **API** — TASK-090: il registro delle richieste (ADR-0085). Con
  `--request-log` l'API scrive ogni richiesta di percorso, partenza
  compresa, in `data/requests/requests.jsonl`; `python -m
shaperoute_api.replay` la rifà e dice se il percorso è lo stesso punto
  per punto. **Spento per default**: accenderlo sempre sul Mac è una scelta
  dell'utente. Non si vede nell'app. Provato: cuore 10 km a Caldonazzo e
  «CIAO» a Levico, rifatti identici (467 e 626 punti).
- **Motore** — TASK-111: il punteggio di una traccia corsa, da 0 a 100
  (`track_score.py`, ADR-0090): la somiglianza del percorso per la fedeltà
  della corsa al percorso, entro 40 m. Dalla CLI con `--score-track
corsa.gpx`. Il seguito è **TASK-112** (registrare la traccia nell'app),
  poi TASK-113.

- **API e motore** — TASK-087: il ritaglio della zona più veloce, a
  percorsi identici (ADR-0082, la proposta 2 di TASK-063). A Milano, con
  la zona in memoria, da 2–6 s a 0,3–1 s a richiesta su questo Mac; stessi
  percorsi punto per punto su 12 casi (Milano e Levico a 10, 15 e
  21 km; a Levico il ritaglio pesava già meno di mezzo secondo).
  L'API va riavviata dopo il merge per prenderlo.
- **App** — TASK-089: un suggerimento toccato riempie il campo, chiude la
  tastiera e non fa ripartire la ricerca; i suggerimenti arrivano anche
  mentre si continua a scrivere, pausa 300 ms (ADR-0083). Photon resta a
  2–3 s a risposta. Provato sull'iPhone (2026-09-30).
- **App** — TASK-086: pulsanti più visibili, bordo e fondo dei comandi
  schiariti nei token (ADR-0081). Provato sull'iPhone (2026-09-30).
- **App** — TASK-085: i luoghi della partenza suggeriti mentre si scrive,
  da 3 lettere, prima quelli vicini alla posizione (ADR-0080). Provato
  sull'iPhone (2026-09-30).
- **App e motore** — TASK-079: modificare il contorno di un'immagine
  (ADR-0074). «Edit the outline» apre una lavagna a tutto schermo con zoom:
  «Add a part» unisce una forma alla sagoma, «Add a detail» aggiunge un
  tratto fatto andata e ritorno, «Undo» toglie l'ultima modifica. Si
  disegna dove si vuole: ciò che non tocca la linea è collegato alla linea
  più vicina, e le linee possono incrociarsi. `POST /image-outline-edits`,
  `strokes` in `/image-route-jobs`. Provato sull'iPhone dall'utente
  (2026-09-30): funziona. Il seguito è **TASK-084**: più soggetti in una
  foto, fino a 4, collegati in una linea sola.
- **App** — TASK-083: l'app su Expo con EAS Update (ADR-0078). Si apre
  in Expo Go sull'iPhone senza `npm run mobile` acceso; l'API serve
  sempre (Mac + Tailscale). Si ripubblica dopo ogni modifica dell'app
  (`DEPLOY.md` A.6). Provata dall'utente (2026-09-28): funziona.
- **App** — TASK-080: le lettere di una parola «Round» o «Square»,
  scelte nell'app sotto il campo della parola; `style` in `RouteRequest`,
  API e `shared-types` (ADR-0075). Provato sull'iPhone (2026-09-28).
- **App** — TASK-070: modalità tasca (ADR-0066). «Pocket» durante la
  navigazione: schermo nero e acceso, luminosità al minimo, tocchi
  ignorati, si esce tenendo premuto 2 s; voce e GPS come prima. Provata
  sull'iPhone dall'utente (2026-09-28): funziona.
- **App** — TASK-074: «Off the route» solo dopo 3 posizioni di fila oltre
  40 m, per almeno 8 s; una posizione con errore oltre 40 m non conta;
  «Back on the route» dopo 2 posizioni sul percorso (ADR-0070). Il
  marciapiede opposto e il GPS che sbaglia per qualche secondo non danno
  più l'avviso; una via parallela sbagliata sì, 8–10 s dopo.
- **Riparatore** — TASK-082: le direzioni col trattino («north-east»,
  «south-west») nell'avviso della partenza spostata ora si traducono come
  «north»; test per le otto direzioni del motore. Un avviso che l'app non
  conosce arriva con la prima lettera maiuscola (ADR-0077).
- **Motore** — TASK-076 (PR #93, in `main` dal 2026-09-26): il motore
  prova il cuore anche da 3 nodi a 25–100 m, in parallelo, e tiene il
  migliore; il percorso parte comunque dall'utente, con l'avvicinamento nei
  km e nel GPX (`nearby_starts.py`, ADR-0071, CLI `--nearby 3`). Trento
  10 km 0,86 → 0,88; Caldonazzo, Trento 15 km e Milano uguali. Vince il
  cuore migliore anche se la ricerca sposta la partenza (scelta
  dell'utente). Più 3–15 s; niente vicine su grafi oltre 30 000 nodi o
  senza memoria libera. Nell'API per forme e parole (`plan_request`).
  Caldonazzo: stesso motore di ieri; il cuore cambia con la posizione del
  GPS (0,73–0,98 entro 100 m). Il testo inglese grezzo di uno screenshot è
  un bug dell'app: TASK-082.
- **Catalogo** — TASK-065: farfalla, lumaca, testa di cane e testa di
  coniglio nel catalogo (ADR-0061; scelte dell'utente sui campioni di
  TASK-064, 068 e 078): motore, contratto, parole e tessere nell'app,
  righe in `OUTLINES` dell'AI. In `main` (PR #95, `59c8623b`, 2026-09-26).
  Chiuso il 2026-10-06 dalla pulizia dei task file: la prova sull'iPhone
  e la nuova misura dell'AI con `qwen3:4b` non risultano fatte.
- **Programmatore Lettere** — TASK-078: tre forme candidate come contorni,
  sagoma nel contorno e dettagli ripassati (ADR-0073): testa di coniglio
  (`rabbit_head`), zucca di Halloween (`pumpkin`), albero di Natale con la
  stella (`christmas_tree`); provate dalla CLI a 15 km: somiglianza
  0,97 · 0,88 · 0,97, 0,92 · 0,83 · 1,00 e 0,93 · 0,81 · 1,00 (Trento,
  Levico, Milano). Giudizio dell'utente: tutte e tre `sì` a Milano;
  coniglio `sì` a Trento e `quasi` a Levico, zucca `no` a Trento e `quasi`
  a Levico, albero `quasi` a Trento e `no` a Levico. Quali entrano nel catalogo lo decide l'utente, con
  TASK-065 o dopo.
- **Programmatore Lettere** — TASK-077: lettere squadrate, un secondo
  stile delle parole nel motore (`letters_block.json`, `style="block"`,
  ADR-0072): tratti dritti o a 45°, lettere larghe e vicine, la parola
  girata sulla griglia delle vie al più di 30°. Lo stile di oggi resta il
  predefinito, identico. Giudizio: CIAO sì · quasi · sì, MAX no · quasi ·
  sì, BELLO quasi · no · no, HURRY no (Trento · Levico · Milano): bene le
  parole corte con lettere grandi su una griglia regolare. L'utente vuole
  **tutti e due gli stili, da scegliere nell'app**: task da assegnare.
- **Interfaccia Grafica** — TASK-073: l'immagine nell'app e nell'API
  (ADR-0069). «Image» accanto a Shape e Word, foto dalla libreria o dalla
  fotocamera, anteprima del contorno prima del percorso, motivo del rifiuto
  in parole semplici. Provato sull'iPhone dall'utente (2026-09-26): «sì,
  funziona tutto».
- **Programmatore Lettere** — TASK-071: verificato che il ritorno di un
  tratto ripassato prende a volte un'altra via e disegna un anello,
  soprattutto a Milano («CIAO» 51% di strade doppie contro il 74% del
  disegno). Provato il ritorno sulle strade dell'andata: una linea sola, ma
  percorso più lungo e lettere più piccole (fino a −28%); per l'utente 4
  parole su 9 peggio, nessuna meglio. Il motore resta com'è (ADR-0067
  «Scartata», codice nel commit `0e8add6`). Proposta all'utente, da
  decidere: lettere squadrate come nello screenshot di Strava (task file).
- **Motore** — TASK-075: il cuore da 10 km di Caldonazzo non è peggiorato.
  Motore di ieri (`87304b0`) e di oggi (`709f4f5`) danno lo stesso percorso
  punto per punto su 9 partenze su 9, oggi in 16,9 s invece di 21,4 s.
  Cambia invece con la partenza: 25–100 m di GPS portano la somiglianza da
  0,73 a 0,92. Nessun codice cambiato; da decidere se il motore debba
  provare partenze vicine (task file). Giudizio: 5 `sì`, 3 `quasi`, 2 `no`
  su 10 cuori; l'utente ha scelto che il motore provi più partenze vicine e
  tenga la migliore: **TASK-076**.
- **Motore** — TASK-072: la forma ricavata da un'immagine. Da un PNG o
  JPEG con un soggetto chiaro su sfondo uniforme il motore ricava il
  contorno esterno con regole fisse (`image_outline.py`, ADR-0068) e la CLI
  ne fa un percorso (`--image`, `--save-outline`); sfondo non uniforme,
  più soggetti, soggetto sul bordo, piccolo o frastagliato sono rifiutati
  con il motivo. Campioni a 15 km a Trento e Milano: mela, pera e Italia
  `sì`, stella `quasi`/`sì`, gatto `no` (non si riconosceva già dal
  contorno). Il seguito è **TASK-073**: l'immagine nell'app e nell'API,
  con l'anteprima del contorno prima del percorso (task file).
- **App** — TASK-061: un marciapiede senza nome con accanto una via dice
  «Turn left onto the footpath beside Via Roma», sul banner e a voce
  (ADR-0058). `street` vince sempre; un'API senza `along` legge come prima.
- **Programmatore Lettere** — TASK-068: la testa di cane come contorno
  candidato (`dog_head`), vista di fronte con le orecchie che pendono, e
  occhi, naso e bocca ripassati (ADR-0065); provata dalla CLI a 15 km:
  somiglianza 0,97 a Trento, 0,95 a Levico, 0,99 a Milano. Giudizio
  dell'utente in attesa (pagina nel task file); decide se il cane entra nel
  catalogo con TASK-065, e se come testa o intero.
- **Indicazioni** — TASK-060: ogni indicazione dell'API ha `along`, la via
  lungo cui corre una strada senza nome, distinta da `street` (ADR-0057);
  opzionale in `shared-types`. Nomi solo dalla cache, mai da Overpass
  durante una richiesta. Cuore da 15 km di Trento: 118 → 57 indicazioni
  senza nome né via. Il seguito è TASK-061, `along` nella navigazione.
- **App** — TASK-069: la barra di una parola stima il calcolo dalle
  lettere, 20 s l'una (misure nel task file, ADR-0064): «CIAO» a 15 km
  pulsa dopo 160 s invece di 75 s. Le forme come prima.
- **Programmatore Lettere** — TASK-064: quattro animali candidati
  (farfalla, uccello, cane, lumaca) disegnati come contorni, con antenne,
  zampe, coda, spirale e corna ripassate (ADR-0060), provati dalla CLI a
  15 km. Giudizio dell'utente: tutti `sì` a Milano; farfalla `quasi` a
  Trento e Levico, uccello `quasi` a Levico, lumaca `sì` a Trento, il
  resto `no`. Quali entrano nel catalogo lo decide l'utente, con TASK-065.
- **App** — TASK-057: un interruttore «Shape | Word»; la parola si scrive
  nell'app, controllata prima (A–Z, al più 7 lettere, 3 km a lettera, con
  «Use N km»), parte come `word` ed è il nome del percorso (ADR-0053);
  provato sull'iPhone. Seguito possibile: una stima della barra per le
  parole (`progress.ts`).
- **Motore** — TASK-063: dove va il tempo sopra i 10 km (numeri nel task
  file) e corridoio da 1,3 a 4,5 volte più veloce a percorsi identici
  (ADR-0059): Trento da 15 a 21 km da 80–97 s a 35–64 s sul PC carico.
- **App** — TASK-066: una risposta senza `directions` (API precedente a
  TASK-048) è `bad_answer`, non un crash; la guardia accetta anche i
  percorsi di una parola (`shape: null`, `word`), pronta per TASK-057.
- **App** — TASK-058: la barra di caricamento anche sulla mappa che si
  carica e sotto la lettura dell'AI; pulsa quando un'attesa dura più del
  doppio del solito, anche con l'API che non risponde (ADR-0055); provato
  sull'iPhone.
- **Indicazioni** — TASK-062: `numpy` dichiarato fra le dipendenze del
  motore (`>=1.24,<3`, lo stesso limite basso di osmnx).
- **Indicazioni** — TASK-053: un marciapiede senza nome prende la via lungo
  cui corre, dedotta a parte (`sidewalks.alongs`, ADR-0054); i nomi delle
  vie escluse dal grafo in un file per zona. Cuori da 15 km, indicazioni
  senza nome né via: Milano 231 → 81, Trento 118 → 57, Levico 34 → 30.
  Nell'API c'è da TASK-060; nell'app non ancora.
- **App** — TASK-055: barra di caricamento gialla sotto la mappa, stimata
  per fasi (ADR-0050); provata sull'iPhone.
- **App** — TASK-054: partenza dal GPS o da un altro luogo anche con il
  GPS acceso, rotellina durante l'attesa, avvisi in parole semplici
  (ADR-0048); provato sull'iPhone. TASK-051: due schermate, prima cosa disegnare (tessere delle
  forme, distanza con − e +) poi la mappa; provato sull'iPhone.
- **Tema dell'app** — TASK-045: i token Sgrava
  (`apps/mobile/src/theme/tokens.ts`) e uno stile MapLibre scuro che li usa
  (`src/map/mapStyle.ts`), con i test che lo dicono ben formato (ADR-0046,
  `UI.md`, «Il tema»). TASK-046: l'app li usa, mappa scura e percorso
  giallo; provato sull'iPhone.
- **Fase 4 finora** — TASK-040: il contorno accetta `path`, una linea
  chiusa percorsa così com'è (ADR-0042); «CIAO» a tratto singolo, dalla
  CLI, `quasi` a Trento, Levico e Milano a 15 km. TASK-041: un `path`
  aperto si corre a sola andata (ADR-0043); per l'utente «CIAO» aperto è
  peggio del chiuso. TASK-047: indicazioni di svolta agli incroci nel
  motore (`directions.py`, ADR-0045), solo la funzione: su cuori da 15 km
  nessuna in mezzo a una strada; 180 a Trento, 75 a Levico, 264 a Milano,
  dove i marciapiedi senza nome le rendono difficili da leggere. TASK-048:
  le richieste in due tempi le restituiscono, con la partenza e le vicine
  segnate (`joined`, ADR-0047); l'app non le mostra ancora. TASK-050:
  le parole si compongono da un alfabeto a tratto singolo (C, I, A, O),
  con lettere più distanziate, un punto di passaggio ogni 1/16
  dell'altezza, ogni lettera spostata dove ha più strade e la I andata e
  ritorno sulla stessa strada (ADR-0044); «CIAO» dalla CLI (`--word`) è
  `sì` a Trento, Levico e Milano a 15 km, molto meglio di TASK-040.
  TASK-056: l'API accetta `word` al posto di `shape` e risponde con
  `"word": "CIAO"` e `"shape": null`; lettere dell'alfabeto, al più 8, e
  almeno 3 km per lettera, se no un `invalid_request` che dice perché
  (ADR-0051); `shared-types` ha le costanti per l'app. TASK-059: tutte le
  lettere dalla A alla Z, la E e la L col tratto basso staccato dalla base
  (ADR-0056); a 15 km «MAX» `sì` nelle tre zone, «BELLO» e «KIWI» `sì` a
  Milano, `quasi` a Levico, `no` a Trento.
- **Fase 3** — TASK-032: forme da un contorno in JSON, dalla CLI
  (`--outline`, ADR-0035). Cancello superato: stella sì ovunque, cavallo
  quasi a Trento e sì a Levico e Milano; la casa no, anche con camino e
  porta. TASK-033: catalogo di quattro forme (cerchio, cuore, stella,
  cavallo) e riquadro della forma che legge la parola in italiano o in
  inglese (ADR-0036); provato sull'iPhone. TASK-034: sei forme candidate
  (luna, pesce, freccia, albero, corona, gatto) si riconoscono solo a
  Milano, nessuna entra nel catalogo. TASK-035: nessuna misura di
  somiglianza separa i «no» dell'utente, la somiglianza resta com'è; conta
  l'orientamento (ADR-0037). TASK-036: le forme restano dritte entro 15°,
  tranne il cerchio; 7 casi su 15 migliorano, nessuno peggiora (ADR-0038).
  TASK-037: tratti interni ripassati nei contorni, con tolleranze dimezzate
  per le forme che li hanno (ADR-0039); a 15 km 4 casi su 12 migliorano,
  uno peggiora; gatto e pesce `sì` a Trento e Milano, Levico `no`.
  TASK-039: luna, gatto e pesce nel catalogo, scelti dall'utente; provati
  sull'iPhone. TASK-038: se la forma non va vicino, un posto fino a 2 km
  e «Start here» nell'app (ADR-0040); a Levico gatto e pesce `sì` a 1 km;
  provato sull'iPhone. TASK-030: le parole che la tabella non conosce le
  legge qwen3:4b in Ollama sul PC (ADR-0012): 94% sulle parole nuove,
  circa 5 s a parola; sull'iPhone vanno le parole semplici, non «stemma
  della ferrari» né «spirit» (`AI.md`, «Limiti»). TASK-031: con
  «nessuna forma» l'app offre le forme del catalogo come pulsanti, provato
  sull'iPhone; se la forma non ci sta per la distanza, l'API suggerisce
  quella che ci sta e l'app mostra «Try N km» (ADR-0041), un caso raro:
  sull'iPhone non è mai uscito.
- **Fase 2 — App e API** (TASK-020–026): monorepo npm con app Expo e
  `shared-types` (ADR-0028); mappa MapLibre GL JS in WebView con posizione
  GPS e ricerca del luogo (ADR-0029); API FastAPI con grafi di zona in
  memoria (ADR-0030); app che chiede i percorsi, li disegna e spiega ogni
  errore (ADR-0031); richieste in due tempi con stati, per 15 km e zone
  nuove (ADR-0032); export GPX con attribuzione OSM, aperto in Garmin
  Connect (ADR-0033); distanza scritta in km, fino a 21 km, scelta con le
  misure di 21 e 30 km a Trento (ADR-0034). Tutto provato sull'iPhone.
- **Fase 1 — Route engine** (TASK-010–019): CLI e GPX; forme circle e
  heart; snapping su OSMnx con zone e corridoio (ADR-0022); ottimizzatore
  che ruota, scala e sposta la partenza fino a 500 m (ADR-0023, ADR-0025);
  validazione con ripercorso e percorribilità (ADR-0026); anteprima dei
  campioni su mappa (ADR-0024). Cancello superato con la valle sospesa
  (ADR-0027).
- **TASK-001** — Repository pubblico, `main` protetto da PR obbligatoria.

- **CI** — TASK-349 (2026-10-30): il job `api` ha 40 minuti invece di 25,
  perché con molte PR aperte veniva cancellato senza test falliti. File
  `tasks/TASK-349.md`.

- **Regole** — TASK-357 (2026-10-30, richiesta dell'utente): con l'utente ogni
  sessione scrive in italiano (`CLAUDE.md`, «Convenzioni»). File
  `tasks/TASK-357.md`.

- **Lavoro in parallelo** — TASK-359 (2026-10-30): `STATUS.md`, `DECISIONS.md` e
  `INDEX.md` si uniscono con `merge=union`, per non far ripartire la CI a ogni
  aggiunta. File `tasks/TASK-359.md`.

## Bloccato

Niente.

## Note per la prossima sessione

- Sul Mac l'API che lancia il motore dal thread di una richiesta può
  mandare in errore (segfault) in loop i processi delle partenze vicine:
  è il fork su macOS, visto da TASK-197; sul server Linux no. Se l'API del
  Mac (porta 8000) rallenta o scrive questi errori, riavviarla.
- Navigazione col GPS (TASK-049): da provare sull'iPhone camminando un
  percorso vero; dopo il merge serve `npm install` dalla radice
  (`expo-speech`).
- Ollama 0.34.4 è installato in `D:\Ollama` e parte con Windows; i
  modelli stanno in `D:\Ollama\models` (variabile `OLLAMA_MODELS`
  dell'account). C'è solo `qwen3:4b`: i due scartati e l'installer sono
  già tolti. L'ambiente dell'API ha anche `services\ai` installato.
- Precaricamento del modello (TASK-052): da misurare con il PC scarico,
  riga «AI model loaded in … s» nel log dell'API.
- In sospeso, dall'AI (`AI.md`): precaricare il modello all'avvio
  dell'API (prima parola da 40–49 s a circa 5 s, 3,2 GB di RAM da subito).
- Su questo PC il route-engine usa l'ambiente dell'API: non c'è
  `services/route-engine/.venv` (`SETUP.md`, passo 10.2).
- In cache ci sono i grafi `foot` di zona di trento, levico, valsugana e
  milano (ADR-0023), più le zone di Trento da 21 e 30 km (TASK-026) e
  quelle di Levico e Milano larghe 12,7 km (casa da 15 km, TASK-032), e
  una zona di Levico larga 15 km (TASK-038, per cercare il posto a 2 km):
  tutti i casi girano offline. Da questo PC un indirizzo di
  `overpass-api.de` non risponde: prima di scaricare, leggere `MAPS.md`,
  "Overpass: come si scarica".
- Per generare campioni senza salvare ritagli in `data/cache/`: uno script
  usa-e-getta che chiama `plan_shape` con `ZoneGraphs` dell'API, come in
  TASK-032. Da TASK-136 anche la CLI non salva più i ritagli (ADR-0108).
- Per giudicare le forme senza mappa basta un PNG scritto con la libreria
  standard (`zlib`, `struct`), come `out/TASK-037-before-after.png`: niente
  matplotlib né PIL.
- Il 50% di `STROKE_DETAIL` (ADR-0039) è un primo valore; l'albero con
  fusto e sei rami è troppo fitto per 15 km.
- Per misurare sui casi di riferimento (in `services/route-engine/`, con
  `..\api\.venv\Scripts\python.exe`): `tests/measure_optimizer.py`
  (ottimizzatore, `--no-optimize` per TASK-017) e
  `tests/measure_snapping.py` (solo snapping).
- Fuori scope di TASK-016, annotati: tag `surface`, `sac_scale` e
  `sidewalk` (serve riscaricare i grafi), ed evitare scale e strade
  principali nella ricerca (oggi si misurano e si avvisa soltanto).
- Dopo TASK-063, sopra i 30 s restano la seconda ricerca fino a 2 km
  (ADR-0040), che a Trento corre quasi sempre, e il ritaglio della zona
  nell'API (6–13 s a Milano): proposte in `tasks/TASK-063.md`, da decidere.
- Motore lento sulle distanze lunghe: 30–50 s da 15 a 30 km, più il
  download di una zona nuova (TASK-023, TASK-026; `API.md`, «Tempi»). Le
  richieste in due tempi lo rendono sopportabile, non veloce: `PRODUCT.md`
  chiede al massimo 30 s.
- Far scegliere all'utente fra più percorsi alternativi: è TASK-093.
- La Valsugana è sospesa su richiesta dell'utente: cuore e cerchio da 5 km
  lì non sono disponibili (ADR-0025, ADR-0027).
- matplotlib non è una dipendenza: per guardare le forme basta uno script
  usa-e-getta fuori dal repository.
- Con latitudine negativa serve la forma `--start=-33.9,18.4`: argparse
  scambia `-33.9,...` per un'opzione.
- App: dalla radice `npm install`, poi `npm run mobile` e il QR con la
  Fotocamera dell'iPhone (`SETUP.md`, passo 9). In PowerShell di questo PC
  si scrive `npm.cmd` al posto di `npm` (script bloccati). Sull'iPhone
  Expo Go vuole l'accesso con lo stesso account Expo sul PC e sul telefono
  (già fatto); il permesso di posizione è di Expo Go (`SETUP.md`, 9.4).
- API: dalla radice `services\api\.venv\Scripts\python.exe -m
shaperoute_api --lan` (`SETUP.md`, passo 10); risponde anche su `/docs`.
- Il disco C: di questo PC ha poco spazio (5,5 GB liberi il 2026-09-23,
  dopo la pulizia: tolti MATLAB, i ritagli in `data/cache/` e la venv del
  route-engine). Ogni zona nuova scaricata vale circa 40 MB, più le
  risposte di Overpass in `data/cache/http/`; Expo si ferma con `ENOSPC`
  quando finisce lo spazio. Fino a TASK-136 la CLI salvava un ritaglio per
  ogni partenza o distanza nuova dentro una zona in cache: quelli rimasti
  si elencano e si cancellano con `python -m route_engine.prune_crops`
  (ADR-0108). Il disco D: ha più di 270 GB liberi.
- Le partenze delle tre zone sono in `docs/TESTING.md`.
- Nell'app la partenza è la posizione GPS o un luogo cercato (`UI.md`);
  le zone fisse servono solo a confrontare le prove.
- Il MVP non rispetta ancora il tempo di `PRODUCT.md` (≤ 30 s) sopra i
  10 km e con le zone nuove: è il motore lento annotato sopra.
- Il repository è pubblico: nessun segreto nei file, mai. Le chiavi stanno
  solo in `.env`, che non entra nel repository.
- Più sessioni lavorano insieme, ognuna nel suo worktree: l'app in
  `D:\shaperoute-app`, con i suoi `node_modules` (`npm ci --cache
D:/npm-cache`: il 2026-09-24 C: aveva 2,8 GB liberi). Il primo `jest` a
  freddo può superare i 5 s di un test e fallire; al secondo giro è verde.

---

## Come si aggiorna

A fine task, in un solo commit dentro la stessa PR:

1. Sposta il task da **In lavorazione** a **Completato**, con una riga di
   esito: cosa funziona adesso che prima non funzionava.
2. Riscrivi **Prossimo passo** con un solo task.
3. Aggiorna **In una riga**.
4. Svuota o aggiorna **Note per la prossima sessione**.

Tenere breve questo file è parte del lavoro: è quello che si paga in ogni
sessione. Lo storico sta nei commit e nelle PR, non qui. Se **Completato**
supera una decina di righe, si condensa per fase.
