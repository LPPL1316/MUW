# TASK-394 — I capi che indossi: tag sui propri post con il link al negozio

**Stato**: Proposta · 2026-11-05 · solo documenti, nessun codice. Le scelte
di prodotto sono dell'utente (sotto, «Le scelte dell'utente»); il resto è
deciso dall'agente su delega dell'utente
**Fase**: 4 · **Branch**: `docs/TASK-394-member-outfit-tags` (questa
proposta), poi una PR per parte
**Numeri**: TASK-394 assegnato dal Coordinatore (2026-11-05). L'ADR si
chiede al Coordinatore dopo il sì dell'utente, con la parte A
**Dipende da**: TASK-384 parte B (la scheda del prodotto nell'app, in
lavorazione), TASK-348 parte A (il compositore, in `main`)

## Obiettivo

Un iscritto segna sulle foto dei suoi post i capi che indossa (tipo, marca,
modello e il link al negozio dove comprarli); chi vede il post tocca un capo
e apre il negozio nel browser. **Per ora solo i link per comprare**: nessun
guadagno, né per l'iscritto né per MuW.

Idea dell'utente del 2026-11-05, detta alla sessione di TASK-384 («MuW
Style»): i membri taggano i vestiti che indossano nei loro post, con il link
al negozio dove comprarli; più avanti potrebbero guadagnarci (affiliazione per
gli utenti), per ora solo i link.

## Contesto da leggere

- `docs/STYLE.md`, `tasks/TASK-384.md`, `DECISIONS.md` ADR-0326 e la sua
  precisazione (l'API di Style): la forma del tag, la scheda, «Shop», i
  conteggi, `style_links.RETAILER_HOSTS`.
- `tasks/TASK-348.md` e ADR-0301: il compositore, le foto appiattite in JPEG
  4:5, i 10 posti e il loro ordine.
- `tasks/TASK-208.md` e ADR-0170: le persone taggate (`drawing_tags`); le
  foto stanno sul server solo per i disegni che altri vedono (scelta 6).
- `API.md` «Block and report» e «Report emails»: segnalare e nascondere.
- La privacy e i Termini di oggi in `apps/mobile/src/about/content/it.ts`
  («Come usare MuW», «Quello che pubblichi», «Pubblicità», «Servizi di
  altri»; «Le tue corse e le loro tracce GPS», «Segnalazioni»,
  «Pubblicità»), e i testi nuovi di TASK-384 («Testi approvati», B e C).

## Cosa vede e fa un iscritto

### Chi segna i capi

- **Solo l'autore, solo sulle foto dei suoi post**: non sul disegno, non sui
  post degli altri, non sulla foto del profilo, non sui post Style.
- Nel compositore (TASK-348), su una foto: **«Tag what you wear»**. Un tocco
  sul punto dove sta il capo apre un piccolo modulo:
  - **tipo**, da una lista fissa e tradotta: scarpe, maglia, giacca,
    pantaloncini, tight, calze, cappello, occhiali, orologio, zaino, altro;
  - **marca**, testo con i suggerimenti delle marche già usate;
  - **modello**, testo facoltativo («Pegasus 41»);
  - **link**, incollato, facoltativo (scelta 3);
  - «Add»: il puntino resta lì, si trascina o si toglie.
- Al più **5 capi per foto e 10 per post** (un outfit di Style ne ha 3–4).
- I capi si cambiano anche dopo, dalla scheda della corsa in «My activities»
  (lo stesso modulo di TASK-208): sono dati accanto alla foto, non pixel
  dentro, quindi cambiarli non tocca la foto appiattita (TASK-348 vieta solo
  di modificare la foto dopo «Publish»).

### Chi guarda

- Una foto con dei capi segnati ha in un angolo una piccola icona (una
  gruccia). Un tocco sulla foto mostra i puntini, un altro li nasconde: la
  foto di una persona vera resta pulita (scelta 4). I post Style, che sono
  pubblicità di MuW, li mostrano sempre: le due cose non si confondono.
- Un tocco su un puntino apre **la scheda dal basso di TASK-384 B**, con meno
  righe: tipo, marca e modello, il nome del negozio, **«Shop on {store}»**
  che apre il browser di sistema (mai una WebView), e «Report». Senza link,
  la scheda ha solo tipo, marca e modello.
- Nella scheda **non ci sono**: il prezzo (l'iscritto non lo scrive, e
  invecchierebbe), la riga «AI-generated» (la foto è dell'iscritto), le righe
  «Pubblicità» e «MuW riceve una commissione» (MuW non guadagna niente,
  scelta 2).
- Una riga fissa sotto «Shop», da approvare con i testi: «Link added by
  {name}. MuW doesn't check the products or the shops.»
- VoiceOver: ogni puntino è un pulsante «{tipo}, {marca}»; l'icona dice
  quanti capi ci sono.

## Cosa si riusa da TASK-384

| Pezzo | In Style | Per i capi degli iscritti |
|---|---|---|
| La forma del tag | `post_product_tags`: `x`, `y` fra 0 e 1, `item`, `brand`, `product_name`, `retailer`, `url`, `active` | Gli stessi campi, senza prezzo e senza `checked_at`, in una tabella legata alle foto dei disegni |
| Il controllo del link | `style_links.RETAILER_HOSTS`, `MAX_URL_LENGTH` | Ogni sito `https` (scelta 1), con Web Risk e un elenco di domini bloccati; `RETAILER_HOSTS` dà solo il nome del negozio noto |
| La scheda | `StyleProductSheet` di TASK-384 B | La stessa, con le righe di Style facoltative |
| «Shop» | un `POST` che conta e risponde il link; il browser di sistema | Uguale |
| I conteggi | `product_tag_clicks`: aperture e «Shop» per tag e per giorno, senza persona; 120 tocchi l'ora per indirizzo, contati solo in memoria | Uguale, in una tabella sua |
| Il link affiliato | il deep link di Awin dagli ID in `.env` | **No**, per ora (scelta 2) |

Le tabelle di Style restano di Style: `post_product_tags.post_id` punta a
`style_posts`, e un post di MuW e uno di un iscritto hanno regole diverse
(chi li scrive, chi li toglie, chi li vede, chi li segnala). Una tabella sola
con due chiavi facoltative sarebbe meno chiara e cambierebbe la `0046`, già
in produzione.

## Il disegno tecnico (proposta, deciso dall'agente su delega dell'utente)

1. **`drawing_outfit_tags`**: `id`, `drawing_id` e `n` (la foto) con
   `ON DELETE CASCADE` su `drawing_photos`, `x`, `y`, `item` (dalla lista),
   `brand`, `product_name`, `retailer`, `url` (già pulito), `hidden_at`,
   `created_at`. **Il capo segue la foto**: riordinare le foto (TASK-348) non
   lo tocca; una foto sostituita perde i suoi capi; un disegno tornato «Only
   me» perde le foto sul server e con loro i capi, che restano sul telefono
   accanto alla foto (come la foto, TASK-208 scelta 6) e risalgono quando il
   disegno si riapre agli altri.
2. **`outfit_tag_clicks`**: come `product_tag_clicks` (tag, giorno, `opens`,
   `shops`), nient'altro.
3. **API**: `PUT /me/activities/{key}/drawing/photos/{n}/tags` (la lista
   intera, che sostituisce la vecchia); i capi di ogni foto in `GET
   /drawings/{id}` e nel Feed, solo a chi vede la foto; `POST
   /outfit-tags/{id}/open` e `/shop` come in Style. Un'app vecchia ignora il
   campo nuovo; `X-MuW-Reads` non serve (non è un'attività nuova).
4. **Il link** (scelta 1, «Ogni link https»): solo `https`, un nome di
   dominio (niente indirizzo IP, utente, password o porta), al più 1000
   caratteri. Rifiutati (`422`): gli accorciatori noti (bit.ly, tinyurl, t.co,
   goo.gl e simili), che nascondono dove si arriva; i domini del nostro
   elenco di bloccati; i link che **Google Web Risk** dà per malware,
   phishing o software indesiderato. Il server **pulisce** il link: via il
   frammento e i parametri noti di tracciamento e di affiliazione (`utm_*`,
   `fbclid`, `gclid`, il `tag` di Amazon, quelli di Awin e simili); il resto
   della query resta, perché su un sito qualunque non si sa quali parametri
   servono alla pagina. **Il server non visita mai il link**: nessuna
   richiesta ai negozi a nome di chi scrive.
   - **Web Risk, non Safe Browsing**: l'API Safe Browsing di Google è solo
     per uso non commerciale, e MuW guadagna con Style. Web Risk sta su
     Google Cloud (un prerequisito dell'utente, sotto).
   - **Nella sua forma «Update API»**: il server tiene in locale i prefissi
     delle impronte (hash) delle liste di Google e chiede a Google solo
     quando un prefisso combacia, mandando il prefisso, **mai il link**. Il
     controllo si rifà a ogni «Shop», perché le liste cambiano: un link
     diventato pericoloso dopo il salvataggio non si apre più, e la scheda
     dice che il link non è disponibile.
   - **L'elenco dei bloccati** è nostro, in una tabella, e cresce con le
     segnalazioni: Web Risk non conosce i siti per adulti né lo spam.
   - **La scheda mostra sempre il dominio** a cui porta il link: «Shop on
     {store}», dove `{store}` è il nome del negozio per i siti noti
     (`RETAILER_HOSTS`: «Zalando») e il dominio per gli altri
     («nike.com»). Un dominio con lettere di alfabeti diversi si mostra in
     punycode (`xn--…`), così un sito che imita un altro non si traveste.
   - **Nei test** Web Risk è finto: niente rete, risposte sempre uguali.
5. **Marca e modello** passano da `comment_filter.py`, come i commenti; al più
   40 e 80 caratteri; un indirizzo scritto lì è rifiutato (`422`): un link
   sta solo nel campo link.
6. **Segnalare un capo**: `POST /reports` con `kind` `outfit_tag` (il vincolo
   `reports_kind_check` si allarga) e i motivi di oggi; l'email a chi gestisce
   MuW ha marca, modello, il link e «Hide it from everyone else», che nasconde
   **solo quel capo** (`hidden_at`), come un commento: l'autore lo vede
   ancora. Segnalare il post intero resta com'è.
7. **App**: nessuna dipendenza nuova. Il punto viene dal tocco
   (`locationX`/`locationY` di un `Pressable`) e si trascina con
   `PanResponder` + `Animated`, come il riordino del compositore. Impronta
   iOS invariata: arriva con un OTA, dopo il server.

## Moderazione e abusi

- **Link spam o pericolosi** (scelta 1, ogni link `https`): Web Risk ferma
  malware e phishing noti, al salvataggio e a ogni «Shop»; gli accorciatori
  sono rifiutati sempre; il resto (siti per adulti, spam, il proprio sito
  usato come pubblicità, un link a cose diverse dal capo) lo prendono le
  segnalazioni. **Più moderazione a mano**: ogni capo segnalato arriva per
  email con il link intero e il dominio; «Hide» nasconde il capo, e un
  dominio da fermare per tutti entra nell'elenco dei bloccati.
- **Codici affiliati propri**: il server toglie quelli noti; uno sconosciuto
  può restare nel link. Finché il guadagno non c'è, i Termini vietano i link
  affiliati propri, e si segnalano.
- **Il testo libero non diventa mai un link**: marca e modello sono testo, e
  un indirizzo scritto lì è rifiutato.
- **Limiti**: 5 capi per foto, 10 per post; salvarli conta come aggiornare il
  disegno, con lo stesso limite di richieste.
- **Pubblicità nascosta**: chi è pagato da un marchio, o ne riceve il capo,
  lo deve dire nella descrizione del post (Termini, sotto); MuW può togliere
  i capi che sono pubblicità non dichiarata. Nessun interruttore
  «Sponsorizzato» per ora: arriverebbe con il guadagno.
- **Segnalare**: «Report» nella scheda del capo, con i motivi di oggi (`spam`
  per primo); nascosto agli altri, non cancellato.
- **Bloccati**: chi hai bloccato non vede i tuoi post, quindi nemmeno i tuoi
  capi; nessuna regola nuova.
- **Contenuti dei negozi**: nessuna foto del prodotto, nessun prezzo, come in
  Style.

## Termini e Privacy: cosa cambierebbe

Le bozze nelle cinque lingue si scrivono dopo il sì sulla proposta e si
approvano a parte (scelta 6), come per TASK-384. Partono dai testi nuovi di
TASK-384 («Testi approvati», B e C), che entrano con la prima versione con
Style; se i capi degli iscritti uscissero prima di Style, si parte dai testi
di oggi, dove «MuW non mostra pubblicità» resta vero.

**Termini**

- «Come usare MuW»: un punto in più nell'elenco dei «non»: usare i capi per
  spam, per link a cose diverse da quello che indossi, per link affiliati
  tuoi (scelta 1), o per pubblicità che non dichiari.
- «Quello che pubblichi»: i capi che segni e i loro link sono parte di quello
  che pubblichi (restano tuoi, li togli quando vuoi).
- «Pubblicità» (il testo di TASK-384): i link che gli iscritti mettono sui
  capi dei loro post sono loro; MuW non ci guadagna e non risponde dei prodotti
  né dei negozi; se un marchio ti paga o ti regala ciò che segni, dillo nella
  descrizione del post.
- «Servizi di altri»: il link di un capo apre il sito del negozio nel tuo
  browser, con le sue condizioni.

**Privacy**

- «Le tue corse e le loro tracce GPS»: un paragrafo. Sulle foto che pubblichi
  puoi segnare i capi che indossi (tipo, marca, modello, link); li vede chi
  vede la foto; se la corsa torna «Solo io», tornano sul telefono con la foto.
- «Pubblicità» (il testo di TASK-384): il conteggio per giorno, senza sapere
  chi sei, vale anche per i capi degli iscritti; il link di un iscritto va
  diritto al negozio, senza Awin, e da lì il negozio registra la visita con i
  suoi cookie.
- «Segnalazioni»: «un capo segnato» fra le cose che si segnalano.
- «Chi altro riceve dati» (scelta 1): Google, con Web Risk, riceve dal
  nostro server pezzi dell'impronta di alcuni link messi dagli iscritti, per
  controllare che non portino a siti pericolosi: mai il link intero, né chi
  l'ha messo o chi lo apre.
- **App Privacy e Data safety**: nessun dato nuovo legato alla persona (i
  capi sono contenuto pubblicato insieme alle foto; i conteggi non hanno
  persona). Da rileggere sui moduli alla consegna della parte B.

## Guadagnare più avanti (solo da nominare)

Non è un passo di codice: è un passo di affari e di legge, da decidere con la
società e con il commercialista. Servirebbero almeno:

- **un programma affiliato che accetti i link messi dagli iscritti** (Awin e
  i negozi vogliono sapere dove compaiono i link, e possono rifiutare i
  contenuti degli utenti) e **un modo di sapere quale iscritto ha portato
  quale vendita** (un codice per iscritto nel link): un dato personale nuovo,
  con la sua privacy;
- **i pagamenti agli iscritti**: un servizio di pagamenti, l'identità di chi
  riceve, una soglia minima, solo maggiorenni;
- **il fisco**, per MuW e per l'iscritto: la società (scelta del 2026-10-09,
  «niente pubblicità finché non c'è la società»; per Style l'utente ha fatto
  un'eccezione il 2026-11-04, che non si estende da sola a questo), le
  ritenute, gli obblighi di comunicazione delle piattaforme che pagano gli
  utenti (da verificare col commercialista);
- **un contratto con chi guadagna** e l'etichetta «Pubblicità» sui suoi post
  (le regole AGCM sugli influencer);
- Termini, Privacy e le regole di App Store e Google Play da rileggere.

Fino ad allora: nessun codice affiliato nei link degli iscritti, né di MuW né
loro.

## Le scelte dell'utente

Una alla volta, ognuna con la proposta pronta. Le risposte si scrivono qui,
con le parole dell'utente.

1. **Quali link.** Proposta: solo pagine di negozi in un elenco tenuto da
   MuW: per partire quelli di Style (Zalando, Amazon, Decathlon) più i siti
   italiani dei marchi sportivi più comuni (Nike, Adidas, Asics, Brooks, Hoka,
   New Balance, Salomon, On, Puma, Saucony, Mizuno, The North Face). Un sito
   fuori elenco: «MuW can't open links to this site yet.». Alternativa: ogni
   link `https`, con un controllo esterno (Google Safe Browsing, un servizio
   in più che riceve i link) e più moderazione a mano.
   — *Risposta* (2026-11-05): «Ogni link https». Il controllo esterno è
   Google Web Risk e non Safe Browsing (solo uso non commerciale), nella
   forma che manda a Google prefissi di impronte e mai i link: «Il disegno
   tecnico», punto 4, e «Moderazione e abusi».
2. **MuW guadagna sui link degli iscritti?** Proposta: no, per ora. I link
   restano puliti, la scheda non dice «Pubblicità», i Termini dicono che MuW
   non ci guadagna. Alternativa: MuW mette il suo link Awin dove c'è
   (Zalando): guadagna MuW, ma il post dell'iscritto diventa pubblicità di
   MuW, va segnato «Pubblicità · Link affiliati», e il programma deve
   accettare link messi dagli utenti.
   — *Risposta* (2026-11-05): «No, per ora». Nessun link Awin sui capi
   degli iscritti; la proposta resta com'è.
3. **Il link è obbligatorio?** Proposta: no. Tipo e marca sì; modello e link
   facoltativi: «Nike, scarpe» senza link risponde già a «che scarpe sono?».
   — *Risposta* (2026-11-05): «No, facoltativo». Tipo e marca obbligatori,
   modello e link facoltativi; senza link la scheda non ha «Shop».
4. **Come si vedono i puntini.** Proposta: nascosti, con l'icona della
   gruccia nell'angolo; un tocco sulla foto li mostra. Alternativa: sempre
   visibili, come in Style.
   — *Risposta*: da chiedere.
5. **Chi vede i conteggi.** Proposta: nessuno nell'app, per ora; il server li
   tiene senza persona, perché serviranno se arriva il guadagno.
   Alternativa: l'autore vede sul suo post quante volte sono stati aperti i
   suoi capi.
   — *Risposta*: da chiedere.
6. **La proposta intera**, poi **i testi** (app, Help, Termini e Privacy
   nelle cinque lingue), approvati a parte.
   — *Risposta*: da chiedere.

## Prerequisiti dell'utente

- **Google Cloud con Web Risk** (scelta 1): un progetto Google Cloud con la
  fatturazione attiva e l'API Web Risk accesa, e la sua chiave nel `.env`
  del server, mai nel repository. Web Risk è gratuito fino a una quota
  mensile; il listino si legge quando si attiva. Senza la chiave la parte A
  rifiuta ogni link fuori da `RETAILER_HOSTS`, invece di lasciarlo passare
  senza controllo.

## Le parti, dopo il sì

Ogni parte: un branch da `main`, una PR, la lista dei file al Coordinatore
prima del codice. Il codice nuovo sta in file nuovi; nei file contesi solo
la riga che li aggancia.

- **A — API** (`feat/TASK-394-a-outfit-tags-api`): la migrazione (il primo
  numero libero al merge), i capi sulle foto, i conteggi, il controllo del
  link, `outfit_tag` nelle segnalazioni e nel link «Hide». Server e
  migrazione in produzione solo col sì dell'utente. File previsti:

  ```
  services/api/migrations/00NN_outfit_tags.sql            (nuovo)
  services/api/shaperoute_api/outfit_tags.py              (nuovo)
  services/api/shaperoute_api/outfit_links.py             (nuovo; importa RETAILER_HOSTS, style_links.py non cambia)
  services/api/shaperoute_api/web_risk.py                 (nuovo; la lista locale e il controllo, finto nei test)
  .env.example                                            (la chiave di Web Risk)
  services/api/shaperoute_api/app.py                      (poche righe, in fondo)
  services/api/shaperoute_api/drawings.py                 (i capi nei dettagli)
  services/api/shaperoute_api/feed.py                     (i capi nel Feed)
  services/api/shaperoute_api/moderation.py               (kind outfit_tag)
  services/api/shaperoute_api/report_email.py             (l'email e «Hide» del capo)
  services/api/tests/test_outfit_tags.py                  (nuovo)
  services/api/tests/test_outfit_links.py                 (nuovo)
  packages/shared-types/src/index.ts                      (in fondo)
  packages/shared-types/fixtures/outfit-tags-request.json (nuovo)
  packages/shared-types/test/outfit-tags.test.ts          (nuovo)
  docs/API.md
  docs/DATABASE.md
  docs/DECISIONS.md
  docs/tasks/TASK-394.md
  docs/STATUS.md
  ```

- **B — App**, dopo TASK-384 B in `main` (`feat/TASK-394-b-outfit-tags-app`):
  «Tag what you wear» nel compositore e nella scheda della corsa; l'icona, i
  puntini e la scheda sulle foto del Feed e del disegno aperto; «Report»; i
  testi approvati in cinque lingue, Help, Termini e Privacy nell'app e sul
  sito. Impronta iOS invariata, OTA col sì dell'utente. File previsti, nuovi
  in `apps/mobile/src/social/outfit/` (`OutfitTagEditor.tsx`,
  `OutfitTagLayer.tsx`, `outfitTags.ts`, `api/outfitTags.ts` e i loro test),
  più le righe d'aggancio in `social/composer/PostComposer.tsx`,
  `social/PublicParts.tsx`, `feed/FeedPost.tsx`, `social/DrawingCard.tsx`,
  `feed/StyleProductSheet.tsx`, `social/drawingOutbox.ts`, i file `i18n/` e
  `about/content/`, e `site/privacy/` (i Termini oggi stanno solo
  nell'app). La lista esatta va al Coordinatore prima del codice.

- **Dopo, non qui**: il guadagno per gli iscritti, una proposta a parte
  quando l'utente lo decide (sopra).

**File contesi** (ordine dal Coordinatore): `FeedPost.tsx` (TASK-336 B,
TASK-339, TASK-345, TASK-355), `PostComposer.tsx` e `PublicParts.tsx`
(TASK-348 B–D, TASK-336), `StyleProductSheet.tsx` (TASK-384 B, oggi in
lavorazione).

## Criteri di accettazione

Questa PR:

- [x] Proposta qui: cosa vede e fa l'iscritto, cosa si riusa di TASK-384,
      moderazione e abusi, Termini e Privacy, il guadagno nominato, le parti
      con i file.
- [ ] Le scelte 1–5 hanno una risposta dell'utente scritta qui.
- [ ] Il sì dell'utente sulla proposta intera (scelta 6).

Le parti (scritti ora, controllati con loro):

- [ ] A: un link `http`, con utente, porta o IP, un accorciatore, un dominio
      bloccato, un link che Web Risk (finto nei test) dà per pericoloso, o un
      indirizzo nella marca → `422`; il frammento e i parametri di
      tracciamento e affiliazione noti si tolgono, il resto della query resta.
- [ ] A: a Web Risk non arriva mai un link intero (un test sul finto).
- [ ] A: chi non vede la foto non vede i suoi capi; un capo nascosto lo vede
      solo l'autore; una foto sostituita o tolta perde i suoi capi.
- [ ] A: i conteggi non tengono account, indirizzo o telefono (un test come
      `test_nothing_personal_is_kept` di Style).
- [ ] B: un capo segnato nel compositore si vede nel Feed sulla stessa foto e
      nello stesso punto, anche dopo aver riordinato le foto.
- [ ] B: «Shop on {store}» apre il browser di sistema col link pulito.
- [ ] B: l'impronta iOS resta quella di `main`.

## File toccati (questa PR)

```
docs/tasks/TASK-394.md
docs/STATUS.md
```

## Fuori scope

- Guadagno per gli iscritti, o per MuW sui link degli iscritti.
- Prezzi, foto dei prodotti, il feed prodotti dei negozi per i capi degli
  iscritti.
- Riconoscere i capi dalla foto con l'AI.
- Capi sui post Style (sono di MuW), sul video e sul disegno.
- Cercare nel Feed per marca (la lente di TASK-344): possibile dopo.
- Un controllo dei link rotti: il server non visita i link degli iscritti.

## Esito

*(a fine task)*
