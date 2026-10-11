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

## Completato

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
