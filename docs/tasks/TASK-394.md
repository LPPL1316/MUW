# TASK-394 — I capi che indossi: tag sui propri post con il link al negozio

**Stato**: Todo — proposta approvata dall'utente (2026-11-05, «Sì,
approvo»), con le cinque scelte, e testi approvati lo stesso giorno;
prossimo: la parte A, con l'ADR dal Coordinatore. Le scelte
di prodotto sono dell'utente (sotto, «Le scelte dell'utente»); il resto è
deciso dall'agente su delega dell'utente
**Fase**: 4 · **Branch**: `docs/TASK-394-member-outfit-tags` (proposta,
#805), `docs/TASK-394-choices` (le scelte, #808), poi una PR per parte
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

### L'autore vede i conteggi (scelta 5)

- Sotto le foto del suo post, **solo per l'autore**, una riga coi totali
  da quando ha segnato i capi: quante volte sono stati aperti e quante
  volte si è andati al negozio (testo da approvare, per esempio «Your items:
  opened 15 times · 3 to the shop»). Nella scheda di ogni suo capo, gli
  stessi due numeri per quel capo.
- Gli altri non vedono numeri: né sul post, né nella scheda.
- Sono totali, mai chi: il server non sa chi ha aperto un capo (sotto,
  «Il disegno tecnico», punto 2). I tocchi dell'autore sui suoi capi non si
  contano: l'app non li manda.

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
   intera: un capo che resta, col suo `id`, si aggiorna e tiene i suoi
   conteggi; uno che manca si toglie con i suoi); i capi di ogni foto in
   `GET /drawings/{id}` e nel Feed, solo a chi vede la foto; `POST
   /outfit-tags/{id}/open` e `/shop` come in Style. **I totali** (`opens`,
   `shops`, per capo, dalla somma dei giorni) solo nella risposta per
   l'autore (scelta 5), mai per gli altri. Un'app vecchia ignora i campi
   nuovi; `X-MuW-Reads` non serve (non è un'attività nuova).
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

Le bozze nelle cinque lingue sono in «I testi», sotto, e si approvano a
parte (scelta 6), come per TASK-384. Partono dai testi nuovi di
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
  chi sei, vale anche per i capi degli iscritti, e chi ha segnato un capo
  vede quante volte è stato aperto e quante volte si è andati al negozio,
  mai chi (scelta 5); il link di un iscritto va
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
   — *Risposta* (2026-11-05): «Nascosti, gruccia». I post Style continuano
   a mostrarli sempre.
5. **Chi vede i conteggi.** Proposta: nessuno nell'app, per ora; il server li
   tiene senza persona, perché serviranno se arriva il guadagno.
   Alternativa: l'autore vede sul suo post quante volte sono stati aperti i
   suoi capi.
   — *Risposta* (2026-11-05): «L'autore del post». Totali di aperture e di
   «Shop», sul post e nella scheda, solo per l'autore e mai chi:
   «L'autore vede i conteggi».
6. **La proposta intera**, poi **i testi** (app, Help, Termini e Privacy
   nelle cinque lingue), approvati a parte.
   — *Risposta* (2026-11-05): «Sì, approvo», sulla proposta con le cinque
   scelte. Non copre i testi, che si approvano a parte («I testi», sotto).

## I testi

Bozze dell'agente, 2026-11-05, nelle cinque lingue (ADR-0172: nel codice la
base è l'inglese). **Approvati dall'utente il 2026-11-05** («Sì, approvo
tutti», sull'anteprima in italiano). Anche la variante della Privacy
«Pubblicità» per una parte B che esce prima di Style (D.2b) è approvata, lo
stesso giorno («SI APPROVO»). Per il nome della società di Google che fa Web
Risk l'utente ha dato il sì in anticipo (2026-11-05, «OK SI»): lo si copia dal
contratto di Google Cloud quando l'utente lo attiva, senza un'altra domanda
(D.4). Il tono segue i
testi di oggi: frasi brevi, «tu», «MuW» come soggetto. «Shop on {store}» e
«Report» ci sono già (TASK-384, TASK-121); `{store}` è il nome del negozio
noto o il dominio. Termini e Privacy cambiano con la parte B, insieme alla
prima versione con i capi degli iscritti; la data della Privacy è quella del
merge, e il sito la riprende.

### A. Nell'app

1. **Pulsante nel compositore, su una foto**
   - EN: Tag what you wear
   - IT: Segna cosa indossi
   - DE: Markiere, was du trägst
   - FR: Identifie ce que tu portes
   - ES: Etiqueta lo que llevas
2. **Suggerimento sulla foto**
   - EN: Tap what you're wearing on the photo.
   - IT: Tocca sulla foto quello che indossi.
   - DE: Tippe auf dem Foto auf das, was du trägst.
   - FR: Touche sur la photo ce que tu portes.
   - ES: Toca en la foto lo que llevas.
3. **Il modulo**: campi e pulsanti
   - EN: Item · Brand · Model (optional) · Link to the shop (optional) · Add · Remove
   - IT: Capo · Marca · Modello (facoltativo) · Link al negozio (facoltativo) · Aggiungi · Togli
   - DE: Teil · Marke · Modell (optional) · Link zum Shop (optional) · Hinzufügen · Entfernen
   - FR : Article · Marque · Modèle (facultatif) · Lien vers la boutique (facultatif) · Ajouter · Retirer
   - ES: Prenda · Marca · Modelo (opcional) · Enlace a la tienda (opcional) · Añadir · Quitar
4. **I tipi**
   - EN: Shoes · Top · Jacket · Shorts · Tights · Socks · Cap · Glasses · Watch · Backpack · Other
   - IT: Scarpe · Maglia · Giacca · Pantaloncini · Tight · Calze · Cappello · Occhiali · Orologio · Zaino · Altro
   - DE: Schuhe · Shirt · Jacke · Shorts · Tights · Socken · Kappe · Brille · Uhr · Rucksack · Sonstiges
   - FR : Chaussures · Haut · Veste · Short · Collant · Chaussettes · Casquette · Lunettes · Montre · Sac à dos · Autre
   - ES: Zapatillas · Camiseta · Chaqueta · Pantalón corto · Mallas · Calcetines · Gorra · Gafas · Reloj · Mochila · Otro
5. **Gli errori nel modulo**
   - a. EN: Use a link that starts with https:// · IT: Usa un link che inizia con https:// · DE: Verwende einen Link, der mit https:// beginnt · FR : Utilise un lien qui commence par https:// · ES: Usa un enlace que empiece por https://
   - b. EN: Short links can't be used: paste the shop's full link. · IT: I link accorciati non si possono usare: incolla il link intero del negozio. · DE: Kurzlinks gehen nicht: Füge den vollständigen Link des Shops ein. · FR : Les liens raccourcis ne sont pas acceptés : colle le lien complet de la boutique. · ES: No se pueden usar enlaces acortados: pega el enlace completo de la tienda.
   - c. (un dominio bloccato o segnalato da Web Risk; le regole di Google
     chiedono di non dire che un sito è di certo pericoloso) EN: MuW can't
     open this link. · IT: MuW non può aprire questo link. · DE: MuW kann
     diesen Link nicht öffnen. · FR : MuW ne peut pas ouvrir ce lien. · ES:
     MuW no puede abrir este enlace.
   - d. (un indirizzo in marca o modello) EN: Put the link in the link box. · IT: Il link va nel riquadro del link. · DE: Der Link gehört ins Link-Feld. · FR : Le lien va dans le champ du lien. · ES: El enlace va en la casilla del enlace.
   - e. EN: Up to 5 items on a photo. · IT: Al massimo 5 capi su una foto. · DE: Höchstens 5 Teile auf einem Foto. · FR : 5 articles au maximum sur une photo. · ES: Como máximo 5 prendas en una foto.
   - f. EN: Up to 10 items in a post. · IT: Al massimo 10 capi in un post. · DE: Höchstens 10 Teile in einem Beitrag. · FR : 10 articles au maximum dans un post. · ES: Como máximo 10 prendas en una publicación.
   - g. (il filtro di parole) EN: These words can't be used. Try other words. · IT: Queste parole non si possono usare. Prova con altre. · DE: Diese Wörter gehen nicht. Versuch es mit anderen. · FR : Ces mots ne sont pas acceptés. Essaie d'autres mots. · ES: Estas palabras no se pueden usar. Prueba con otras.
6. **VoiceOver**: l'icona della gruccia (con il singolare per 1) e il puntino
   - EN: {n} items tagged · 1 item tagged · {item}, {brand}
   - IT: {n} capi segnati · 1 capo segnato · {item}, {brand}
   - DE: {n} Teile markiert · 1 Teil markiert · {item}, {brand}
   - FR : {n} articles identifiés · 1 article identifié · {item}, {brand}
   - ES: {n} prendas etiquetadas · 1 prenda etiquetada · {item}, {brand}
7. **Riga fissa nella scheda di un capo con link**
   - EN: Link added by {name}. MuW doesn't check the products or the shops.
   - IT: Link aggiunto da {name}. MuW non controlla i prodotti né i negozi.
   - DE: Link hinzugefügt von {name}. MuW prüft weder die Produkte noch die Shops.
   - FR : Lien ajouté par {name}. MuW ne vérifie ni les produits ni les boutiques.
   - ES: Enlace añadido por {name}. MuW no comprueba los productos ni las tiendas.
8. **Al posto di «Shop», se il link non si apre più**
   - EN: This link isn't available.
   - IT: Questo link non è disponibile.
   - DE: Dieser Link ist nicht verfügbar.
   - FR : Ce lien n'est pas disponible.
   - ES: Este enlace no está disponible.
9. **I conteggi, solo per l'autore**: sotto le foto del post, nella scheda di
   un suo capo, e la riga sotto
   - EN: Your items · Opens: {opens} · To the shop: {shops} — Opens: {opens} · To the shop: {shops} — Only you see these numbers.
   - IT: I tuoi capi · Aperture: {opens} · Al negozio: {shops} — Aperture: {opens} · Al negozio: {shops} — Questi numeri li vedi solo tu.
   - DE: Deine Teile · Geöffnet: {opens} · Zum Shop: {shops} — Geöffnet: {opens} · Zum Shop: {shops} — Diese Zahlen siehst nur du.
   - FR : Tes articles · Ouvertures : {opens} · Vers la boutique : {shops} — Ouvertures : {opens} · Vers la boutique : {shops} — Toi seul vois ces chiffres.
   - ES: Tus prendas · Aperturas: {opens} · A la tienda: {shops} — Aperturas: {opens} · A la tienda: {shops} — Estos números solo los ves tú.

### B. Help, «Pubblicare e condividere» (un paragrafo nuovo, dopo quello delle foto)

- **EN**: On a photo you publish you can tag what you're wearing: what it is, the brand and, if you like, the model and a link to the shop. Others tap the photo to see the items and open the shop. Under your post only you see how many times they were opened.
- **IT**: Su una foto che pubblichi puoi segnare quello che indossi: cos'è, la marca e, se vuoi, il modello e il link al negozio. Gli altri toccano la foto per vedere i capi e aprire il negozio. Sotto il tuo post solo tu vedi quante volte sono stati aperti.
- **DE**: Auf einem Foto, das du veröffentlichst, kannst du markieren, was du trägst: was es ist, die Marke und, wenn du willst, das Modell und einen Link zum Shop. Andere tippen auf das Foto, um die Teile zu sehen und den Shop zu öffnen. Unter deinem Beitrag siehst nur du, wie oft sie geöffnet wurden.
- **FR** : Sur une photo que tu publies, tu peux identifier ce que tu portes : ce que c'est, la marque et, si tu veux, le modèle et un lien vers la boutique. Les autres touchent la photo pour voir les articles et ouvrir la boutique. Sous ton post, toi seul vois combien de fois ils ont été ouverts.
- **ES**: En una foto que publiques puedes etiquetar lo que llevas: qué es, la marca y, si quieres, el modelo y un enlace a la tienda. Los demás tocan la foto para ver las prendas y abrir la tienda. Debajo de tu publicación solo tú ves cuántas veces se han abierto.

### C. Termini

1. **«Come usare MuW»**, un punto in più nell'elenco dei «non», prima
   dell'ultimo:
   - EN: use the items you tag for spam, for links to anything other than what you are wearing, for affiliate links of your own, or for advertising you do not declare;
   - IT: usare i capi che segni per spam, per link a cose diverse da quello che indossi, per link affiliati tuoi o per pubblicità che non dichiari;
   - DE: die Teile, die du markierst, für Spam nutzen, für Links zu etwas anderem als dem, was du trägst, für eigene Affiliate-Links oder für Werbung, die du nicht kennzeichnest;
   - FR : utiliser les articles que tu identifies pour du spam, pour des liens vers autre chose que ce que tu portes, pour tes propres liens d'affiliation ou pour de la publicité que tu ne déclares pas ;
   - ES: uses las prendas que etiquetas para spam, para enlaces a algo distinto de lo que llevas, para enlaces de afiliado tuyos o para publicidad que no declaras;
2. **«Quello che pubblichi»**, una frase dopo la prima:
   - EN: The items you tag on your photos, with their links, are part of what you publish.
   - IT: I capi che segni sulle tue foto, con i loro link, sono parte di quello che pubblichi.
   - DE: Die Teile, die du auf deinen Fotos markierst, gehören mit ihren Links zu dem, was du veröffentlichst.
   - FR : Les articles que tu identifies sur tes photos, avec leurs liens, font partie de ce que tu publies.
   - ES: Las prendas que etiquetas en tus fotos, con sus enlaces, forman parte de lo que publicas.
3. **«Pubblicità»**, in fondo (dopo il testo di TASK-384, o dopo «MuW non
   mostra pubblicità.» se Style non è ancora uscito):
   - EN: The links members add to the items on their posts are theirs: MuW earns nothing from them and does not answer for the products or the shops. If a brand pays you or gives you what you tag, say so in the post's description.
   - IT: I link che gli iscritti mettono sui capi dei loro post sono loro: MuW non ci guadagna e non risponde dei prodotti né dei negozi. Se un marchio ti paga o ti regala quello che segni, dillo nella descrizione del post.
   - DE: Die Links, die Mitglieder an die Teile in ihren Beiträgen setzen, sind ihre: MuW verdient nichts daran und haftet nicht für die Produkte oder die Shops. Wenn eine Marke dich bezahlt oder dir schenkt, was du markierst, sag es in der Beschreibung des Beitrags.
   - FR : Les liens que les membres ajoutent aux articles de leurs posts sont les leurs : MuW n'y gagne rien et ne répond ni des produits ni des boutiques. Si une marque te paie ou t'offre ce que tu identifies, dis-le dans la description du post.
   - ES: Los enlaces que los miembros ponen en las prendas de sus publicaciones son suyos: MuW no gana nada con ellos y no responde de los productos ni de las tiendas. Si una marca te paga o te regala lo que etiquetas, dilo en la descripción de la publicación.
4. **«Servizi di altri»**, un punto in più:
   - EN: The link of a tagged item opens the shop's site in your browser: the shop has its own terms.
   - IT: Il link di un capo segnato apre il sito del negozio nel tuo browser: il negozio ha le sue condizioni.
   - DE: Der Link eines markierten Teils öffnet die Seite des Shops in deinem Browser: Der Shop hat seine eigenen Bedingungen.
   - FR : Le lien d'un article identifié ouvre le site de la boutique dans ton navigateur : la boutique a ses propres conditions.
   - ES: El enlace de una prenda etiquetada abre la web de la tienda en tu navegador: la tienda tiene sus propias condiciones.

### D. Privacy

1. **«Le tue corse e le loro tracce GPS»**, un paragrafo in fondo:
   - EN: On the photos you publish you can tag the items you are wearing: what each one is, its brand and, if you like, its model and a link to a shop. Whoever sees the photo sees them. If the run goes back to «Only me», they leave our server with its photos and stay on this phone.
   - IT: Sulle foto che pubblichi puoi segnare i capi che indossi: cos'è ognuno, la marca e, se vuoi, il modello e il link a un negozio. Li vede chi vede la foto. Se la corsa torna «Solo io», lasciano il nostro server con le sue foto e restano su questo telefono.
   - DE: Auf den Fotos, die du veröffentlichst, kannst du die Teile markieren, die du trägst: was jedes ist, die Marke und, wenn du willst, das Modell und einen Link zu einem Shop. Wer das Foto sieht, sieht sie. Geht der Lauf zurück auf «Nur ich», verlassen sie mit seinen Fotos unseren Server und bleiben auf diesem Telefon.
   - FR : Sur les photos que tu publies, tu peux identifier les articles que tu portes : ce qu'est chacun, sa marque et, si tu veux, son modèle et un lien vers une boutique. Ceux qui voient la photo les voient. Si la course repasse en «Moi seulement», ils quittent notre serveur avec ses photos et restent sur ce téléphone.
   - ES: En las fotos que publiques puedes etiquetar las prendas que llevas: qué es cada una, su marca y, si quieres, su modelo y un enlace a una tienda. Las ve quien ve la foto. Si la carrera vuelve a «Solo yo», salen de nuestro servidor con sus fotos y se quedan en este teléfono.
2. **«Pubblicità»**, in fondo al testo di TASK-384 (se Style non è ancora
   uscito, la variante qui sotto, 2b):
   - EN: The same count, by day and without knowing who you are, applies to the items members tag on their posts: whoever tagged an item sees how many times it was opened and how many times someone went to the shop, never who. A member's link goes straight to the shop, without Awin: from there the shop records the visit with its cookies, under its own privacy policy.
   - IT: Lo stesso conteggio, per giorno e senza sapere chi sei, vale per i capi che gli iscritti segnano sui loro post: chi ha segnato un capo vede quante volte è stato aperto e quante volte si è andati al negozio, mai chi. Il link di un iscritto va diritto al negozio, senza Awin: da lì il negozio registra la visita con i suoi cookie, secondo la sua informativa.
   - DE: Dieselbe Zählung, pro Tag und ohne zu wissen, wer du bist, gilt für die Teile, die Mitglieder in ihren Beiträgen markieren: Wer ein Teil markiert hat, sieht, wie oft es geöffnet wurde und wie oft jemand zum Shop gegangen ist, nie wer. Der Link eines Mitglieds führt direkt zum Shop, ohne Awin: Ab dort erfasst der Shop den Besuch mit seinen Cookies, nach seiner eigenen Datenschutzerklärung.
   - FR : Le même comptage, par jour et sans savoir qui tu es, vaut pour les articles que les membres identifient sur leurs posts : celui qui a identifié un article voit combien de fois il a été ouvert et combien de fois quelqu'un est allé à la boutique, jamais qui. Le lien d'un membre va directement à la boutique, sans Awin : à partir de là, la boutique enregistre la visite avec ses cookies, selon sa propre politique de confidentialité.
   - ES: El mismo recuento, por día y sin saber quién eres, vale para las prendas que los miembros etiquetan en sus publicaciones: quien etiquetó una prenda ve cuántas veces se abrió y cuántas veces alguien fue a la tienda, nunca quién. El enlace de un miembro va directo a la tienda, sin Awin: desde ahí la tienda registra la visita con sus cookies, según su propia política de privacidad.

   **2b. Se la parte B esce prima di Style**: il paragrafo «Pubblicità» di
   oggi resta com'è e in fondo si aggiunge questa frase, senza «Lo stesso»
   e senza Awin. **Approvata dall'utente il 2026-11-05** («SI APPROVO»).
   - EN: For the items members tag on their posts, our server counts by day how many times they are opened and how many times someone goes to the shop, without knowing who you are or which phone it was: whoever tagged an item sees these totals, never who. A member's link goes straight to the shop: from there the shop records the visit with its cookies, under its own privacy policy.
   - IT: Per i capi che gli iscritti segnano sui loro post, il nostro server conta per giorno quante volte vengono aperti e quante volte si va al negozio, senza sapere chi sei né quale telefono era: chi ha segnato un capo vede questi totali, mai chi. Il link di un iscritto va diritto al negozio: da lì il negozio registra la visita con i suoi cookie, secondo la sua informativa.
   - DE: Für die Teile, die Mitglieder in ihren Beiträgen markieren, zählt unser Server pro Tag, wie oft sie geöffnet werden und wie oft jemand zum Shop geht, ohne zu wissen, wer du bist oder welches Telefon es war: Wer ein Teil markiert hat, sieht diese Summen, nie wer. Der Link eines Mitglieds führt direkt zum Shop: Ab dort erfasst der Shop den Besuch mit seinen Cookies, nach seiner eigenen Datenschutzerklärung.
   - FR : Pour les articles que les membres identifient sur leurs posts, notre serveur compte par jour combien de fois ils sont ouverts et combien de fois quelqu'un va à la boutique, sans savoir qui tu es ni de quel téléphone il s'agit : celui qui a identifié un article voit ces totaux, jamais qui. Le lien d'un membre va directement à la boutique : à partir de là, la boutique enregistre la visite avec ses cookies, selon sa propre politique de confidentialité.
   - ES: Para las prendas que los miembros etiquetan en sus publicaciones, nuestro servidor cuenta por día cuántas veces se abren y cuántas veces alguien va a la tienda, sin saber quién eres ni qué teléfono era: quien etiquetó una prenda ve esos totales, nunca quién. El enlace de un miembro va directo a la tienda: desde ahí la tienda registra la visita con sus cookies, según su propia política de privacidad.
3. **«Segnalazioni»**, l'inizio della prima frase:
   - EN: When you report a drawing, a tagged item, a comment or a profile, …
   - IT: Quando segnali un disegno, un capo segnato, un commento o un profilo, …
   - DE: Wenn du eine Zeichnung, ein markiertes Teil, einen Kommentar oder ein Profil meldest, …
   - FR : Quand tu signales un dessin, un article identifié, un commentaire ou un profil, …
   - ES: Cuando denuncias un dibujo, una prenda etiquetada, un comentario o un perfil, …
4. **«Chi altro riceve dati»**, un punto in più (la società di Google che
   firma il contratto di Web Risk si scrive quando l'utente lo attiva, come
   «Google Ireland Limited» per Firebase: «Google» diventa quel nome, copiato
   dal contratto; sì anticipato dell'utente, 2026-11-05, «OK SI»):
   - EN: Google, with its Web Risk service, receives from our server parts of the fingerprint (hash) of some links that members add to their items, to check that they do not lead to dangerous sites: never the whole link, nor who added it or who opens it.
   - IT: Google, con il suo servizio Web Risk, riceve dal nostro server pezzi dell'impronta (hash) di alcuni link che gli iscritti mettono sui loro capi, per controllare che non portino a siti pericolosi: mai il link intero, né chi l'ha messo o chi lo apre.
   - DE: Google erhält mit seinem Dienst Web Risk von unserem Server Teile des Fingerabdrucks (Hash) mancher Links, die Mitglieder an ihre Teile setzen, um zu prüfen, dass sie nicht zu gefährlichen Seiten führen: nie den ganzen Link, und nie, wer ihn gesetzt hat oder wer ihn öffnet.
   - FR : Google, avec son service Web Risk, reçoit de notre serveur des morceaux de l'empreinte (hash) de certains liens que les membres ajoutent à leurs articles, pour vérifier qu'ils ne mènent pas à des sites dangereux : jamais le lien entier, ni qui l'a ajouté ou qui l'ouvre.
   - ES: Google, con su servicio Web Risk, recibe de nuestro servidor partes de la huella (hash) de algunos enlaces que los miembros ponen en sus prendas, para comprobar que no llevan a sitios peligrosos: nunca el enlace entero, ni quién lo puso o quién lo abre.

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
- [x] Le scelte 1–5 hanno una risposta dell'utente scritta qui
      (2026-11-05).
- [x] Il sì dell'utente sulla proposta intera (scelta 6, 2026-11-05).
- [x] Il sì dell'utente sui testi nelle cinque lingue (2026-11-05).

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
- [ ] A: i totali dei conteggi arrivano solo all'autore; aggiornare i capi
      tiene i conteggi di quelli che restano.
- [ ] B: l'autore vede i totali sul suo post e nella scheda dei suoi capi,
      gli altri no; i tocchi dell'autore sui suoi capi non si contano.
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
