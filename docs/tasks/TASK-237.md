# TASK-237 — Il sito web, con la sezione «Merch» per le magliette

**Stato**: In corso — il sito è **online su https://getmuw.app** con
la guida, la privacy (`/privacy/`) e l'assistenza (`/support/`), in
cinque lingue (parti A, A2, A3, C, D, E fatte, 2026-10-05/09); il link
per scaricare l'app porta all'App Store (parte F, 2026-10-28); resta il
merch (parte B, messo da parte)
**Fase**: 4 · **Branch**: `feat/TASK-237-website-merch`
**ADR**: ADR-0201

## Obiettivo

Sgrava ha un sito web con una sezione di merchandising da cui si comprano
le magliette.

## La richiesta dell'utente (2026-10-05)

«Aiutami a fare il sito web; nel sito web vorrei fare la sezione di
merchandising per vendere le nostre magliette.»

## Le scelte dell'utente (2026-10-05)

Alla domanda «come si vendono le magliette (chi incassa e chi spedisce)?»,
fra stampa su ordinazione, magliette proprie con Stripe, negozio Shopify e
sola vetrina: **stampa su ordinazione**. Un servizio stampa e spedisce
ogni maglietta quando viene ordinata; il sito mostra le magliette e «Buy»
apre il pagamento del servizio.

## La seconda richiesta dell'utente (2026-10-05)

«No dai, per intanto fai solo il sito web che spiega come utilizzare
l'app, e poi inseriremo anche il link per poterla scaricare; fallo un po'
futuristico; poter selezionare un po' di cose, per selezionare [lo sport];
metti i post migliori, tipo una decina.»

Letta così; l'utente ha poi confermato lo sport e i disegni (2026-10-05:
«sì intendevo sport, i disegni vanno bene così»):

1. **Per ora niente merch**: la pagina spiega solo come si usa l'app.
2. **Il link per scaricare** arriva dopo: adesso un segnaposto.
3. **Più futuristico**.
4. **Cose da selezionare**: lo sport («trasporta» nel messaggio dettato:
   era «sport», confermato), e una forma e una distanza da provare.
5. **I dieci post migliori**: dieci disegni presi da quelli dell'app.

## La terza richiesta dell'utente (2026-10-08)

«Fai il sito web per il nuovo nome, grazie, e aiutami a metterlo online.»
Il nuovo nome è **MuW** (ADR-0224, TASK-260), con il logo scelto
dall'utente il 2026-10-06: il cuore su giallo e la scritta «MuW».

## Contesto da leggere

- `docs/SITO.md`
- `docs/DECISIONS.md`, ADR-0201

## Cosa fare

**Parte A — la pagina e la vetrina** (PR #325, fatta):

1. Una cartella nuova `site/`: pagina, stile, le magliette in un file
   solo, le schede di «Merch» costruite da quel file.
2. Le stampe dai percorsi veri del catalogo, con uno script.
3. Test in Node e un workflow suo.
4. `docs/SITO.md`, ADR-0201, le righe in `STATUS.md` e `INDEX.md`.

**Parte A2 — la guida dell'app** (PR #335, fatta):

1. Il merch esce da `index.html`; i suoi file restano, con i loro test.
2. In cima il pannello «Try it»: forma e distanza scelte, il percorso
   vero di Milano disegnato.
3. «How it works» con la scelta dello sport: fatti e passi per «Run»,
   «Bike», «Paddle»; le tre pagine dell'app.
4. «Best drawings»: dieci disegni dai dati dell'app, con un filtro.
5. «Get the app»: segnaposto, e `site/config.js` per il link.
6. L'aspetto: griglia da mappa, etichette a spaziatura fissa, la linea
   gialla che brilla.

**Parte A3 — il nome MuW** (terza PR):

1. Nome, segno e scritta di MuW nella pagina, nell'icona della scheda e
   in fondo; nessun «Sgrava» nei testi del sito.
2. I testi allineati all'app di oggi: niente punteggio a fine corsa
   (TASK-241), «Feed» fra le pagine dell'app (TASK-118).

**Parte C — metterlo online** (fatta): sul server Hetzner, dal Caddy, su
`getmuw.app` (scelta dell'utente, 2026-10-08; Caddy e DNS di TASK-265).

**Parte D — la pagina della privacy** (chiesta dal Coordinatore il
2026-10-08: Apple la vuole per TestFlight esterno, TASK-152 B):

1. `getmuw.app/privacy/` in inglese, più `it/`, `de/`, `fr/`, `es/`,
   scritte da `site/tools/make_privacy.mjs` dal testo «Privacy»
   dell'app, senza copiarlo a mano; un test le confronta.
2. I dati che mancavano, chiesti all'utente uno per volta: titolare,
   email, basi giuridiche, data e stato. Scritti una volta sola nel testo
   dell'app (decisione del Coordinatore), quindi uguali in app e sito.
3. Il testo verificato contro il codice: la posizione a telefono
   bloccato durante la corsa (TASK-261) mancava ed è aggiunta; punteggio
   ed evento «run_scored» sono ancora salvati dal server, quindi restano.
4. `site/privacy` nell'elenco della copia di `DEPLOY.md` F.14.

**Parte E — la pagina di assistenza** (chiesta dal Coordinatore il
2026-10-09: Apple vuole un Support URL con un contatto):

1. `getmuw.app/support/` più `it/`, `de/`, `fr/`, `es/`, scritte da
   `site/tools/make_support.mjs` dai testi di `support_text.mjs`: come
   scriverci (l'indirizzo già pubblico nella privacy) e tre domande.
2. Risposte verificate nel codice: fino a tre percorsi
   (`MAX_ALTERNATIVES = 2`, più il primo), «Try 12 km» (TASK-234,
   `betterDistance.ts`), «Delete account» in «Settings»
   (`SettingsPage.tsx`), con i nomi dei tasti di ogni lingua.
3. `site/support` nella riga `git archive` di `DEPLOY.md` F.14.

**Parte B — aprire il negozio e pubblicare** (dopo le scelte dell'utente):

1. L'utente sceglie il servizio di stampa e apre l'account (un agente non
   crea account).
2. Decise magliette, nomi e prezzi, si preparano i file di stampa e
   l'utente li carica sul servizio.
3. In `site/products.js`: `buyUrl`, `priceEur`, `fulfilledBy`.
4. Dominio e pubblicazione, con l'ok dell'utente.

## Criteri di accettazione

Parte A:

- [x] `site/index.html` servita da un server locale mostra intestazione,
      «How it works» e «Merch» con una scheda per maglietta di
      `products.js`, a 1280 px e a 520 px di larghezza.
- [x] Una maglietta con `buyUrl` `https` ha «Buy» che apre quell'indirizzo
      in una scheda nuova; senza, «Coming soon» e nessun link.
- [x] La pagina non carica niente da altri siti; l'unico indirizzo esterno
      è il link del credito OpenStreetMap.
- [x] `cd site && npm test` è verde, senza installare niente.
- [x] `python3 site/tools/make_prints.py` rifà gli stessi file.

Parte A2:

- [x] La pagina non mostra più il merch e non ne carica i file.
- [x] Toccando «Bike» o «Paddle» cambiano i tre fatti e i quattro passi;
      il tasto scelto ha `aria-pressed="true"`.
- [x] Toccando una forma e una distanza in «Try it» cambiano il disegno e
      la riga «Milano · Star · 20.7 km»; ogni coppia ha il suo percorso.
- [x] «Best drawings» mostra dieci disegni; «Paddle» ne lascia quattro,
      «Run» sei.
- [x] Con `downloadUrl` `null` i due tasti dicono «Download — coming
      soon»; con un indirizzo `https` sono un link.
- [x] Nessuno scorrimento orizzontale a 1280 e a 390 px; nessun errore
      nella console.
- [x] `cd site && npm test` è verde; i due script rifanno gli stessi file.

Parte A3:

- [x] Titolo, logo, icona della scheda e piede dicono «MuW»; nessun file
      del sito che la pagina carica contiene «Sgrava» (lo controlla un
      test).
- [x] I testi della guida non promettono il punteggio; le pagine
      dell'app sono quattro, con «Feed».
- [x] Nessuno scorrimento orizzontale a 1280 e a 390 px; nessun errore
      nella console; `cd site && npm test` verde.

Parte B: da scrivere con le scelte dell'utente.

## File toccati

```
site/**                          (nuova)
.github/workflows/site.yml       (nuovo)
docs/SITO.md                     (nuovo)
docs/tasks/TASK-237.md           (nuovo)
docs/STATUS.md                   (le righe di TASK-237)
docs/DECISIONS.md                (ADR-0201)
docs/INDEX.md                    (una riga per SITO.md)
```

Parte D, con il sì del Coordinatore (2026-10-08):

```
apps/mobile/src/about/content/*.ts      (solo «Privacy»: i dati
                                         dell'utente, la data, la frase
                                         della posizione a telefono bloccato)
apps/mobile/src/about/AboutPage.tsx     (la data su un testo definitivo)
apps/mobile/src/about/*.test.ts(x)      (Privacy definitiva, Terms bozza)
docs/DEPLOY.md                          (F.14: solo `site/privacy`
                                         nella riga `git archive`)
docs/UI.md                              (una riga: Privacy definitiva)
```

Parte E (2026-10-09):

```
site/support/**                         (nuova)
site/tools/make_support.mjs, support_text.mjs, site/tests/support.test.mjs (nuovi)
site/index.html                         (il link «Support» in fondo)
site/styles.css                         (tre regole per la pagina)
docs/DEPLOY.md                          (F.14: `site/support` nella riga `git archive`)
```

`site/privacy/**` e `site/tests/privacy.test.mjs` sono di TASK-262 C
dal 2026-10-09: la parte E non li tocca.

TASK-262 A (le notifiche push) tocca gli stessi `about/content/*.ts` e
`about/documents.test.ts` per la frase sul token push: chi entra secondo
riallinea, ognuno solo i suoi paragrafi.

## Fuori scope

- Pagamenti, carrello, ordini o dati dei clienti sul sito: li tiene il
  servizio di stampa.
- Pubblicare il sito, comprare un dominio, toccare `deploy/` o il server.
- Scegliere il servizio, i prezzi, i nomi e i disegni definitivi.
- Altre pagine (privacy, termini, contatti: TASK-184), altre lingue,
  i tasti degli store (l'app non è sull'App Store: TASK-152).
- L'app, l'API, il motore.

## Esito

**Parte A** (2026-10-05, PR #325, merge `f8e68b6`): il sito è in `site/`, guardato in Chrome senza
finestra a 1280 e 520 px; 12 test verdi. Quattro magliette proposte (cuore
di Milano, lumaca di Torino, stella di Trento, logo), tutte «Coming soon».
Il cuore in cima sta nella pagina e non in un'immagine: disegnato dentro
un `<img>` l'animazione non partiva nel controllo, e la riga restava
nascosta.

**Parte A2** (2026-10-05, PR #335, merge `8f23ff4`): la pagina è la guida dell'app. Provata in
Chrome senza finestra guidato dal protocollo DevTools, a 1280 e 390 px:
i tasti di sport, forma, distanza e filtro cambiano quello che devono,
nessun errore in console, nessuno scorrimento orizzontale; 25 test verdi.
Il pannello Browser dell'app non si è potuto usare: `launch.json` è nel
checkout principale e la modifica è stata bloccata dai permessi. Nei
«Best drawings» non ci sono i nomi degli utenti d'esempio né minuti e
punteggi, che nell'app sono inventati: solo titolo, luogo e km. Nessun
disegno in bici: i dati dell'app non ne hanno. **Confermati dall'utente** il 2026-10-05 («sì
intendevo sport, i disegni vanno bene così»): la scelta dello sport e i
dieci disegni come sono, senza nomi, minuti e punteggi. I testi sono stati
confermati poi, con la parte A3 (2026-10-08).

**Parte A3** (2026-10-08): il sito dice MuW, con il segno (il cuore su
giallo) accanto alla scritta in alto, nell'icona della scheda e in fondo;
la scritta è quella di `docs/brand/muw-logo.svg` nel colore del testo. Via
il punteggio dalla corsa, aggiunto «Feed». Provato in Chrome senza
finestra a 1280 e 390 px; 27 test verdi. **I testi del sito sono
confermati dall'utente** (2026-10-08: «i testi vanno bene così»).
**Parte C, online**: l'utente ha scelto il server Hetzner con il dominio
`getmuw.app` (in un'altra sessione, 2026-10-08); Caddy e DNS sono di
TASK-265, sul server applica il Coordinatore.

**Aspettano l'utente** (parte B, il merch, messo da parte): il servizio di stampa e l'account; magliette,
nomi, colori e prezzi; i testi della pagina («Runs that draw a shape on
the map.», i tre passi, «Sgrava is in preview on iPhone, not yet on the
App Store.»); dominio e pubblicazione.

**Parte C** (2026-10-08): il sito è **online su https://getmuw.app**, con
l'ok dell'utente alla pubblicazione; eseguito dalla sessione di TASK-265 al
via del Coordinatore. Sul server: i 9 file pubblici di `site/` da `main`
`d7f53269` in `/srv/getmuw-site`, serviti dal Caddy; `www.getmuw.app` →
301 su `getmuw.app`; `package.json` e il merch spento non sono serviti
(404). Il Caddyfile di prima è `Caddyfile.before-task237b`. Ricontrollato
da questa sessione: pagina, script e logo rispondono 200 con i tipi giusti,
e in Chrome senza finestra i tasti di sport, forma, distanza e filtro
funzionano, i dieci disegni ci sono, nessun errore, nessuno scorrimento
orizzontale a 1280 e 390 px. **Il sito non si aggiorna da solo**: dopo un
merge che cambia `site/` va ripetuta la copia di `DEPLOY.md` F.14
(scritta da TASK-265).

**Parte D** (2026-10-08): la pagina della privacy, in PR. **Scelte
dell'utente**, una domanda per volta: titolare **Luca Pallaoro**; email
**muw2610@gmail.com** (scelta al posto di un indirizzo di `getmuw.app`);
le basi giuridiche proposte dall'agente (contratto, legittimo interesse,
consenso, obbligo di legge), accettate così («Sì, usa questo testo»),
con il consiglio di farle rileggere a un esperto; il testo è
**definitivo**, data **8 ottobre 2026**. Nell'app «Privacy» non dice più
«Draft» e mostra la data; «Terms» resta una bozza con i suoi
segnaposto. Aggiunta in cinque lingue la frase sulla posizione a
telefono bloccato (TASK-261, ADR-0225). Verificato nel codice: il server
salva ancora il punteggio di una corsa (`activities.py`) e l'evento
`run_scored`: la frase resta, precisata («a score of how closely the
track follows the route (worked out by our server and not shown in the
app)»). Le due frasi nuove le ha approvate l'utente il 2026-10-09 («Sì,
vanno bene»). Un test del sito controlla
che la copia di `DEPLOY.md` F.14 prenda ogni file che le pagine
caricano. Dopo il merge: la copia sul server al via del Coordinatore,
con il sì dell'utente alla pubblicazione; l'indirizzo per Apple è
`https://getmuw.app/privacy/`.

**Aperti, dell'utente**: il link per scaricare l'app. Scelta del
2026-10-08, raccolta dalla sessione di TASK-265: resta «Download — coming
soon» fino alla prima build su TestFlight (TASK-152 B); allora
`site/config.js` `downloadUrl` diventa il link pubblico di TestFlight e
si ricopia il sito (F.14). Il link di Expo Go è scartato. Il merch
(parte B), messo da parte.

**Parte D online** (2026-10-09): la #453 è entrata in `main` come
`89287a0a`, ma sul commit prima dell'ultimo: la frase precisata sul
punteggio, approvata dall'utente, era rimasta fuori. La copia F.14 da
`89287a0a` (ok dell'utente: «Sì, pubblicala» a questa sessione, «ok
privacy online» al Coordinatore) ha messo online
https://getmuw.app/privacy/ in cinque lingue, con titolare, email e
data; l'app con il testo definitivo è su `preview` (gruppo `20590b72`).
La frase del punteggio entra con la PR `fix/TASK-237-privacy-score`;
dopo il suo merge servono di nuovo la copia F.14 e una pubblicazione
dell'app, che sono del Coordinatore.

**Parte E** (2026-10-09): la pagina di assistenza, PR #467. Testi
**approvati dall'utente** («Sì, va bene», sul testo italiano; le altre
lingue dicono lo stesso). Dopo il merge: la copia F.14, del
Coordinatore; l'indirizzo per la scheda dell'App Store è
`https://getmuw.app/support/`.

**Parte E online** (2026-10-09): #467 in `main` come `b19ab890` (sull'head
approvato), copia F.14 del Coordinatore. `/support/` e le altre quattro
lingue rispondono 200 con l'indirizzo, la home ha il link «Support»;
ricontrollato da questa sessione. L'URL è passato alla sessione «App Store
submission».

**Parte F, il link per scaricare** (2026-10-28): l'utente chiede
«sistema il sito aggiungendo il link per scaricare l'app». MuW è
sull'App Store dal 2026-10-28 (TASK-152), quindi il link è la pagina
dell'App Store, non TestFlight: `site/config.js` `downloadUrl` =
`https://apps.apple.com/app/id6820961883` (lo stesso indirizzo di
«Open MuW» nelle email, `away_email.py`). I due tasti diventano
«Download the app»; «Get the app» dice «On iPhone, now.» e «MuW is free
on the App Store, for iPhone.» (gratis, come dice la scheda). Android
non è nominato: Google Play (TASK-294) non è ancora pubblico. Branch
`feat/TASK-237-download-link`. Dopo il merge: la copia F.14 sul server,
con il sì dell'utente.

**Parte F online** (2026-10-28): testi approvati dall'utente («Sì,
pubblica»); #614 in `main` come `0ddb6c4a`, copia F.14 da quel commit.
Su https://getmuw.app i due «Download the app» aprono
`https://apps.apple.com/app/id6820961883`; `/privacy/`, `/support/` e
`/account-deletion/` rispondono 200, `www` → 301. Quando Google Play
(TASK-294) è pubblico, il titolo e la frase di «Get the app» cambiano
di nuovo (`SITO.md`).
