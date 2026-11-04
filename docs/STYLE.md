# MuW Style — proposta

> Stato: **proposta approvata dall'utente** (2026-11-04, «Sì, approvo»),
> nessun codice; i testi si approvano a parte. Task: `tasks/TASK-384.md`.
> Decisione tecnica: `DECISIONS.md` ADR-0326. Materiali preparati (fuori dal
> repository, `out/` è in `.gitignore`): `out/TASK-384/`.

## Che cos'è

Nel Feed compaiono post di **MuW** con una foto generata dall'AI: un modello o
una modella inventati, in posa sportiva all'aperto, con un outfit da running,
trail, bici, palestra o tempo libero. Sulla foto ci sono dei **puntini**: uno
per capo. Toccato un puntino si apre una scheda col prodotto e un pulsante
**«Shop»** che porta al negozio con un link affiliato. MuW guadagna una
commissione se l'acquisto avviene.

Sono contenuti nostri, come i percorsi di MuW (TASK-365, ADR-0310), e non devono
sembrare post di iscritti né foto vere.

## Cosa vede l'utente

### Il post

- Autore **MuW**, con il logo, come la card dei percorsi di MuW.
- Sotto la foto, sempre, due etichette fisse e non rimovibili:
  **«AI-generated»** e **«Affiliate links»**. Sono anche la dichiarazione
  di AI Act art. 50 e la segnalazione della pubblicità (sotto, «Prerequisiti»).
- Un titolo breve («Rainy 10K», «Alpine trail day»), nessuna persona finta con
  nome, età o storia: il modello non è un «influencer» inventato.
- Nessuna reazione finta, nessun numero di like o commenti iniziale.

### Il tag e la scheda

- Un puntino bianco col bordo, sopra il capo. Al tocco si apre una scheda dal
  basso: nome del prodotto, marca, prezzo «da … €» col giorno in cui è stato
  letto, il negozio, il pulsante **«Shop»** e, sotto, una riga fissa:
  **«The photo is AI-generated: the item shown is similar, not the exact
  product.»**
- La riga serve perché l'immagine **non è la foto del prodotto**: il capo
  generato somiglia per colore e taglio, non è identico. Senza la riga la
  foto rischia di essere una pratica commerciale ingannevole (direttiva UE
  2005/29, Codice del consumo art. 21–22).
- «Shop» apre il link nel browser di sistema (non in una WebView dell'app),
  così l'acquisto e i cookie del negozio restano del negozio.
- Il prezzo è quello letto l'ultima volta: un prezzo più vecchio di 7 giorni
  non si mostra, si mostra solo «See price».

### Quanti e dove

- (Scelta dell'utente, 2026-11-04: «1 ogni 8, solo All».)
  **Al massimo 1 post Style ogni 8 post** nel Feed, solo nella scheda «All»,
  mai in «Following», mai due di fila, mai nei primi 3 post della pagina.
  Insieme ai percorsi di MuW (proposta 1 ogni 10, TASK-365 scelta 3) i
  contenuti nostri restano sotto 1 su 4.
- Una **lente «Style»** dedicata: un filtro accanto ad «All» e «Following»
  che mostra solo i post Style, in ordine di uscita, con i filtri per tema
  (Running, Trail, Bike, Gym, Athleisure) e per «Women»/«Men».
- Un'opzione in «Settings» per **non vedere i post Style nel Feed** (restano
  nella lente): è pubblicità, e va potuta spegnere.

### Uscita graduale

- **2–3 post al giorno**, non 100 insieme. Ogni post ha una data di uscita
  (`publish_at`); il server mostra solo quelli già usciti.
- Con 100 outfit e 2–3 al giorno il catalogo dura circa 40 giorni. Ordine
  proposto: alternare tema e genere, prima i capi della stagione (in inverno
  prima tight, giacche e termici).
- Ogni giorno, prima che un post esca, i suoi link si ricontrollano (sotto,
  «I link»): un prodotto finito o tolto spegne il suo tag; un post senza tag
  validi non esce.

## Il catalogo preparato

In `out/TASK-384/`, fuori dal repository:

| File | Cosa contiene |
| --- | --- |
| `outfits.csv` | 100 outfit, una riga per capo (359 righe, 333 prodotti diversi): `outfit_id, theme, gender, items, brand, product_name, price_eur, zalando_url, alt_retailer_url` |
| `image-prompts.md` | un prompt per outfit: persona inventata, posa, luogo all'aperto, luce, capi per colore e taglio, nessun logo |
| `zalando_listings_2026-11-04.tsv` | le 882 voci lette dalle pagine Sport di zalando.it il 2026-11-04: marca, nome, prezzo, link |
| `availability_2026-11-04.tsv` | le pagine prodotto lette una per una: 71 su 798, fermate al `429` di Zalando; 10 «OutOfStock», tolte dagli outfit |
| `build_catalog.py` | lo script deterministico che fa i due file dai TSV |

- **Temi** (scelta dell'utente, 2026-11-04, «Sport dell'app»): 35 running,
  20 trail, 20 bike, 15 athleisure, 10 gym; 50 donna e 50 uomo.
- **Da Zalando solo nome, prezzo e link**, letti dalle pagine di categoria
  della sezione Sport. Nessuna foto scaricata o copiata.
- **In elenco il 2026-11-04**: tutti comparivano quel giorno nelle pagine
  Sport. La disponibilità **pagina per pagina** è controllata solo su 71
  prodotti: Zalando ha risposto `429` (troppe richieste) e il controllo si è
  fermato lì, senza insistere. Sui 71, 10 erano «OutOfStock» (circa uno su
  sette) e sono fuori dagli outfit. Gli altri vanno riletti prima dell'uscita,
  meglio dal feed prodotti di Awin che dalle pagine (sotto, «I link»).
- **`alt_retailer_url` è un link di ricerca Amazon** (marca + modello), **non**
  una pagina prodotto controllata. Va verificato a mano, o lasciato vuoto,
  prima di usarlo. Decathlon non è stato cercato: vende soprattutto marche sue,
  che su Zalando non ci sono.
- I link Zalando sono **senza codice affiliato**: quello arriva con
  l'iscrizione (sotto).

## Modello dati

Come i percorsi di MuW, **i post Style non sono `drawings`**: non hanno una
corsa, un utente o dei tempi. Tabelle nuove, una migrazione, `GET /feed` che
non cambia.

```sql
CREATE TABLE style_posts (
    id            TEXT PRIMARY KEY,            -- 'MS-001'
    theme         TEXT NOT NULL CHECK (theme IN ('running','trail','bike','gym','athleisure')),
    gender        TEXT NOT NULL CHECK (gender IN ('women','men')),
    title         JSONB NOT NULL,              -- cinque lingue, come i percorsi di MuW
    image_path    TEXT NOT NULL,               -- file su disco, ADR-0289
    image_tool    TEXT NOT NULL,               -- lo strumento che l'ha generata
    publish_at    TIMESTAMPTZ NOT NULL,
    hidden_at     TIMESTAMPTZ                  -- tolto: non si cancella, si nasconde
);

CREATE TABLE post_product_tags (
    id            BIGSERIAL PRIMARY KEY,
    post_id       TEXT NOT NULL REFERENCES style_posts(id),
    x             REAL NOT NULL CHECK (x BETWEEN 0 AND 1),   -- posizione del puntino
    y             REAL NOT NULL CHECK (y BETWEEN 0 AND 1),   -- sulla foto, 0–1
    item          TEXT NOT NULL,               -- 'top', 'shoes', …
    brand         TEXT NOT NULL,
    product_name  TEXT NOT NULL,
    price_eur     NUMERIC(8,2),
    price_seen_at TIMESTAMPTZ,
    retailer      TEXT NOT NULL,               -- 'zalando', 'amazon', …
    url           TEXT NOT NULL,               -- link affiliato
    checked_at    TIMESTAMPTZ,                 -- ultimo controllo del link
    active        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE product_tag_clicks (
    tag_id        BIGINT NOT NULL REFERENCES post_product_tags(id),
    day           DATE NOT NULL,
    opens         INTEGER NOT NULL DEFAULT 0,  -- scheda aperta
    shops         INTEGER NOT NULL DEFAULT 0,  -- «Shop» toccato
    PRIMARY KEY (tag_id, day)
);
```

- **Il conteggio dei clic è aggregato per giorno**, senza utente, senza IP,
  senza identificativo del telefono: `POST /style/tags/{id}/open` e
  `/shop` aumentano un contatore e rispondono `204`. Così non è
  tracciamento nel senso di Apple (nessun dato collegato alla persona, niente
  ATT) e non serve un consenso in più.
- I **dati sulle vendite** (commissioni, conversioni) li dà la piattaforma
  affiliata nel suo pannello: non entrano nel nostro database.
- Endpoint: `GET /style?filter=…&cursor=…` (la lente) e i post Style
  mescolati dall'app nel Feed, come i percorsi di MuW: un'app già pubblicata
  non li chiede e non vede niente.

## I link

- Un controllo giornaliero sul server legge ogni link attivo dei post in uscita
  nei 2 giorni seguenti, con calma (una richiesta ogni pochi secondi), e
  spegne i tag dei prodotti non più disponibili. Se il programma affiliato
  offre un feed prodotti (Awin ne ha uno per inserzionista), si usa quello e
  non le pagine del negozio.
- Il link affiliato si costruisce col deep link del programma (per Awin:
  `awin1.com/cread.php?awinmid=…&awinaffid=…&ued=<url>`); l'ID affiliato sta
  in `.env`, mai nel repository.

## Prerequisiti (prima di qualsiasi post vero)

1. **Iscrizione al programma affiliato.** Zalando in Italia passa per
   **Awin**: iscrizione come publisher con dati fiscali e conto, poi la
   candidatura al programma Zalando, che può rifiutare un'app nuova con
   pochi utenti. Va fatta dall'utente. La regola del 2026-10-09 («niente
   pubblicità finché non c'è la società») **per Style non vale**: scelta
   dell'utente del 2026-11-04, «No, Style parte prima» (`tasks/TASK-384.md`,
   scelta 4). L'iscrizione è da persona fisica; il trattamento fiscale dei
   compensi (prestazione occasionale o altro) lo decide l'utente col
   commercialista, e i dati fiscali non entrano mai nel repository.
2. **Testi legali.** Oggi Termini e Privacy dicono «MuW non mostra
   pubblicità» e «nessun servizio pubblicitario» (TASK-267). Vanno cambiati,
   con il sì dell'utente, in cinque lingue, e il sito rigenerato.
3. **App Privacy (App Store) e Data safety (Google Play).** Con i contatori
   aggregati senza identificativi non si raccolgono dati nuovi; va però
   dichiarato che l'app contiene link a terzi e pubblicità di terzi
   (Google Play: «Contains ads», da rileggere sulla definizione di Google
   al momento della consegna: i link affiliati ci rientrano quasi certamente).
4. **AI Act, art. 50** (obblighi di trasparenza, in vigore dal 2 agosto
   2026): chi pubblica immagini generate che sembrano vere deve dichiararlo.
   L'etichetta fissa «AI-generated» sul post, sempre visibile, e i metadati
   del file (C2PA o IPTC «trainedAlgorithmicMedia») quando lo strumento li
   scrive.
5. **Pubblicità riconoscibile**: Codice del consumo art. 23 e Digital Chart
   IAP per l'Italia: la natura commerciale deve essere chiara subito,
   l'etichetta «Affiliate links» sul post e «Shop» nella scheda.
6. **App Store Review Guidelines**: 3.1.3(e) (i beni fisici consumati fuori
   dall'app si comprano senza acquisto in-app, quindi i link al negozio sono
   ammessi), 1.1 (contenuti) e 5.6 (condotta: niente che inganni). Le linee
   guida non vietano i link affiliati, ma la pubblicità non deve sembrare
   contenuto degli utenti. Da rileggere sul testo in vigore prima della
   build che li porta.
7. **Lo strumento per le immagini**: Google Imagen / Gemini (scelta
   dell'utente, 2026-11-04). Uso commerciale ammesso dai termini di Google per
   le immagini generate; ogni immagine porta la filigrana invisibile SynthID,
   che non sostituisce l'etichetta visibile. Da controllare prima di
   generare: i termini del piano usato (API Vertex/Gemini o app), che le
   immagini non finiscano ad addestrare altro, e che lo strumento accetti
   persone realistiche inventate (alcuni piani le limitano). Si genera da
   testo, con i prompt di `image-prompts.md`, mai da foto.

## I cinque punti del Coordinatore

Il Coordinatore (2026-11-04) chiede che la proposta li metta in chiaro come
scelte per l'utente. Come stanno:

1. **Persone generate dall'AI dichiarate come tali**, mai presentate come
   vere, mai il volto di una persona reale. Già nella richiesta dell'utente
   (etichetta fissa «AI-generated») e nei prompt (persona inventata, nessuna
   somiglianza): non serve un'altra domanda.
2. **I link affiliati segnalati come pubblicità in ogni post**, come per gli
   influencer in Italia (AGCM, Digital Chart IAP). Già nella richiesta
   dell'utente (etichetta fissa «Affiliate links»); si aggiunge che il testo
   dell'etichetta, nelle cinque lingue, deve dire «pubblicità» in modo chiaro
   («Ad · Affiliate links», «Pubblicità · Link affiliati»): è uno dei testi
   da far approvare.
3. **Il programma affiliato e la società.** Chiesto all'utente il
   2026-11-04: «No, Style parte prima» (`tasks/TASK-384.md`, scelta 4).
   Awin di solito vuole dati fiscali: l'iscrizione la fa l'utente, e se il
   programma Zalando chiede una partita IVA si torna da lui.
4. **Le immagini dei prodotti solo come le permette il programma**, dal
   feed ufficiale. Oggi la proposta non ne usa nessuna: la scheda ha nome,
   marca, prezzo e «Shop». Una miniatura del prodotto nella scheda si
   aggiunge solo dal feed prodotti di Awin e con le sue condizioni, ed è una
   scelta da chiedere quando ci sarà l'iscrizione.
5. **Privacy e App Store.** La Privacy dirà che l'app contiene link
   d'acquisto affiliati, che MuW conta per giorno le aperture e i tocchi
   senza sapere chi sei, e che **il negozio e Awin registrano il clic** con
   i loro cookie, sotto la loro privacy, per pagare la commissione. Gli
   acquisti sono di beni fisici fuori dall'app: per Apple non passano
   dall'acquisto in-app (3.1.3(e)), e Apple non ne prende una
   percentuale. I testi nuovi vogliono il sì dell'utente.

## Cosa non si fa

- Nessuna foto di Zalando o di altri negozi, nemmeno come riferimento per lo
  strumento: si generano da testo.
- Nessun volto vero, nessuna somiglianza a persone note, nessun «stile di».
- Nessun logo o marchio sulle immagini.
- Nessuna immagine pubblicata e nessun post creato sul server senza il sì
  dell'utente.
- Nessun tracciamento della persona: solo contatori per giorno.
