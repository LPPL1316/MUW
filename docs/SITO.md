# SITO — Il sito web

> Cosa c'è nel sito di MuW (già «Sgrava», ADR-0224), come si cambia e come
> si guarda in locale.
> Le scelte e i loro perché stanno in `DECISIONS.md` (ADR-0201); lo stato
> in `STATUS.md`.

## Cos'è

Una pagina sola, in inglese, in `site/`, che **spiega come si usa l'app**
(scelta dell'utente, 2026-10-05). HTML, CSS e JavaScript scritti a mano:
nessuna dipendenza, nessun passo di build, niente cookie, niente dati di
chi visita, niente caricato da altri siti.

Dall'alto in basso:

1. **In cima**, il titolo e il pannello **«Try it»**: si sceglie una forma
   (sei) e una distanza (5, 10, 21 km) e il pannello disegna quel percorso
   a Milano, uno dei percorsi veri del catalogo.
2. **«How it works»**: si sceglie lo **sport** («Run», «Bike», «Paddle») e
   cambiano i tre fatti (distanze, dove, come guida) e i quattro passi.
   Sotto, le quattro pagine dell'app: «Feed», «Draw», «Explore», «Profile».
3. **«Best drawings»**: dieci disegni, sei corse e quattro uscite in
   canoa, con un filtro («All», «Run», «Paddle»).
4. **«Get the app»**: «Download the app», in cima e in fondo, porta
   alla pagina di MuW sull'App Store (dal 2026-10-28, TASK-237 F).

## I file

| File | Cosa contiene |
|---|---|
| `site/index.html` | la pagina |
| `site/styles.css` | l'aspetto; i colori sono dichiarati una volta in cima e ricalcano `apps/mobile/src/theme/tokens.ts`, i toni più chiari si mescolano da quelli |
| `site/config.js` | **il link per scaricare l'app** (`downloadUrl`) |
| `site/content.js` | **i testi della guida**: sport, fatti, passi, le pagine dell'app |
| `site/data/drawings.js` | i disegni di «Try it» e di «Best drawings»; lo scrive `make_drawings.py`, non si tocca a mano |
| `site/render.js` | costruisce i pezzi della pagina (funzioni pure, provate dai test) |
| `site/main.js` | collega i tasti alla pagina |
| `site/assets/` | il segno e la scritta di MuW, ricavati da `docs/brand/muw-*.svg` (la scritta nel colore del testo, per lo sfondo scuro) |
| `site/tools/` | gli script che ricavano i disegni dai percorsi veri |
| `site/tests/` | i test (`node --test`) |

## Mettere il link per scaricare l'app

In `site/config.js`, `downloadUrl`: l'indirizzo `https://…` dell'app
sull'App Store. Con `null` i due tasti dicono «Download — coming soon»;
con l'indirizzo diventano «Download the app». Il titolo e la frase di
«Get the app» in `index.html` si cambiano a mano insieme al link (oggi
«On iPhone, now.», «MuW is free on the App Store, for iPhone.»); quando
arriva Google Play (TASK-294) cambiano anche loro.

## Cambiare i testi della guida

In `site/content.js`. Ogni riga dice una cosa che l'app fa oggi: quando
l'app cambia (una distanza, uno sport, un passo), si cambia lì. I test
chiedono tre fatti e quattro passi per sport.

## I disegni

Nessuna geometria è inventata: ogni linea è un percorso tracciato dal
Route Engine su dati OpenStreetMap, che gli script proiettano in metri,
sfoltiscono e adattano a un quadrato.

- **«Try it»**: `catalog/seed/milano.json`, sei forme per tre distanze.
- **«Best drawings»**: sei corse dei disegni d'esempio del «Feed»
  dell'app (`apps/mobile/src/feed/sampleFeed.json`) e i quattro esempi
  sull'acqua che il «Feed» mostra (`apps/mobile/src/paddle/paddleExamples.json`),
  con gli stessi titoli. Il sito mostra titolo, luogo e km; **non** i nomi
  degli utenti d'esempio, i minuti e i punteggi, che nell'app sono
  inventati. Non ci sono disegni in bici: nei dati dell'app non ce ne sono.

I file dell'app vengono solo letti; i disegni restano copiati in `site/`,
quindi un cambio nell'app non cambia il sito finché non si rilancia:

```bash
python3 site/tools/make_prints.py
python3 site/tools/make_drawings.py
```

Il primo rifà anche il cuore scritto dentro `index.html` (quello che si
vede prima che parta JavaScript) e i file del marchio in `site/assets/`:
dopo un cambio di logo in `docs/brand/` basta rilanciarlo. Quali forme, quali città e quali dieci
disegni: gli elenchi in cima a `make_drawings.py`.

Il credito «© OpenStreetMap contributors» in fondo alla pagina deve
restare (lo controlla un test).

## La pagina della privacy

`getmuw.app/privacy/` (inglese) e `privacy/it/`, `de/`, `fr/`, `es/`: il
testo «Privacy» dell'app, lo stesso parola per parola, che Apple chiede a
un indirizzo pubblico. **Non si scrive a mano**: il testo sta in
`apps/mobile/src/about/content/*.ts`, e le pagine le scrive

```bash
node site/tools/make_privacy.mjs
```

Dopo un cambio del testo nell'app si rilancia: un test del sito confronta
le pagine con l'app e fallisce finché non sono uguali (la CI del sito gira
anche quando cambiano i testi dell'app). Il piede della pagina
principale porta a `privacy/`.

## La pagina di assistenza

`getmuw.app/support/` (inglese) e `support/it/`, `de/`, `fr/`, `es/`: come
scriverci (`muw2610@gmail.com`, lo stesso indirizzo della privacy) e tre
domande frequenti, per il Support URL dell'App Store. I testi stanno in
`site/tools/support_text.mjs`; dopo un cambio:

```bash
node site/tools/make_support.mjs
```

Le risposte nominano i tasti come li mostra l'app in ogni lingua (un test
lo controlla): se l'app cambia un nome, cambia anche qui.

## Online

Il sito è su **https://getmuw.app** dal 2026-10-08, servito dal Caddy del
server Hetzner (`www.getmuw.app` rimanda lì). Sul server stanno solo i file
pubblici, copiati da `main` in `/srv/getmuw-site`: non i test, gli script,
`package.json` e il merch spento. **Non si aggiorna da solo**: dopo un
merge che cambia `site/` si ripete la copia di `DEPLOY.md` F.14 (il
server è del Coordinatore, con l'ok dell'utente). Un file pubblico nuovo
va aggiunto anche all'elenco di F.14.

## Guardarlo in locale

Da un terminale nella radice del repository, poi `http://127.0.0.1:8237`:

```bash
python3 -m http.server 8237 --bind 127.0.0.1 --directory site
```

Aprire `index.html` con un doppio clic non basta: senza un server il
browser non carica gli script, e passi e disegni non compaiono.

## I test

```bash
cd site && npm test
```

Solo Node, niente da installare. In CI li fa girare
`.github/workflows/site.yml`, quando cambia qualcosa in `site/`.

## Il merch, messo da parte

La prima versione della pagina aveva una sezione «Merch» con le magliette,
vendute da un servizio di stampa su ordinazione. Il 2026-10-05 l'utente ha
detto di fare **per ora solo la guida**: la sezione è fuori dalla pagina,
ma i suoi file restano e i loro test girano ancora: `site/products.js` (le
magliette), `site/merch.js` (le schede), `site/merch.css` (lo stile),
`site/prints/` (le stampe). Per rimetterla: una sezione con
`<ul data-products>` e `<p data-shop-note>` in `index.html`, il foglio
`merch.css` e lo script `merch.js` nell'intestazione; una maglietta è in
vendita quando ha `buyUrl` (`https`) e `priceEur` in `products.js`, e
`fulfilledBy` dice il nome del servizio.

## Non ancora deciso (dell'utente)

Testi, dieci disegni e scelta dello sport sono confermati (2026-10-05 e
2026-10-08). Il sito andrà su `getmuw.app`, dal Caddy del server Hetzner
(scelta dell'utente, 2026-10-08; la configurazione è di TASK-265). Restano
dell'utente: quando rimettere il merch, con quale servizio, quali magliette e
quali prezzi. Il link per scaricare l'app arriva con l'App Store (TASK-152).
