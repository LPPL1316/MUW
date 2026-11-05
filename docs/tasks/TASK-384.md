# TASK-384 — «MuW Style»: post con modelli AI in outfit sportivi e tag «Shop»

**Stato**: Todo — proposta in `docs/STYLE.md` approvata dall'utente
(2026-11-04, «Sì, approvo»); prima del codice restano i testi
**Fase**: 4 · **Branch**: `docs/TASK-384-muw-style` (proposta) · **ADR**:
ADR-0326 · numero del task dal Coordinatore
(2026-11-04)

## Obiettivo

Nel Feed escono post dell'account MuW con una foto generata dall'AI: un modello
o una modella inventati, in posa sportiva all'aperto, con un outfit. Sulla
foto dei puntini-tag aprono una scheda prodotto con «Shop» e un link affiliato.
Richiesta dell'utente del 2026-11-04 (testo incollato in chat).

## Contesto da leggere

- `docs/STYLE.md`: la proposta intera.
- ADR-0310 e `tasks/TASK-365.md`: i percorsi di MuW nel Feed, contenuto nostro
  fuori da `GET /feed`, l'etichetta fissa.
- ADR-0289 (file su disco) e `tasks/TASK-315.md` (le foto nel Feed).
- ADR-0308 (le schede «All» e «Following»), ADR-0297 (la lente del Feed).
- TASK-267: i testi di oggi, «MuW non mostra pubblicità».

## Materiali preparati

In `out/TASK-384/` (fuori dal repository, `out/` è in `.gitignore`):
`outfits.csv` (100 outfit, 359 capi, 333 prodotti reali di zalando.it),
`image-prompts.md` (100 prompt), i due TSV letti da Zalando il 2026-11-04 e
`build_catalog.py`, che li rifà. Da Zalando solo nome, prezzo e link; nessuna
foto. `alt_retailer_url` è un link di **ricerca** Amazon, non una pagina
controllata. Dettagli in `docs/STYLE.md`, «Il catalogo preparato».

## Scelte dell'utente

Una alla volta, con le sue parole.

1. **Tema degli outfit.** Proposta: peso sugli sport dell'app, 35 running, 20
   trail, 20 bike, 15 athleisure, 10 gym, metà donna e metà uomo.
   — *Risposta* (2026-11-04): «Sport dell'app».
2. **Frequenza nel Feed.** Proposta: al massimo 1 ogni 8, solo «All», mai due
   di fila né nei primi 3, più la lente «Style» e un interruttore in
   «Settings» per toglierli dal Feed.
   — *Risposta* (2026-11-04): «1 ogni 8, solo All».
3. **Strumento per le immagini.** Proposta: Adobe Firefly (licenze,
   Content Credentials).
   — *Risposta* (2026-11-04): «Google Imagen / Gemini».
4. **Prima della società?** Il 2026-10-09 l'utente aveva scelto «niente
   pubblicità finché non c'è la società». Proposta: vale anche per Style.
   — *Risposta* (2026-11-04): «No, Style parte prima». Iscrizione ad Awin da
   persona fisica, fatta dall'utente; il fisco col commercialista.
5. **Aperte, da chiedere prima del codice**: i testi (etichette, scheda,
   «Shop», l'interruttore in «Settings») in cinque lingue; i nuovi Termini e
   Privacy al posto di «MuW non mostra pubblicità».
   — *Risposta* (2026-11-04): «Sì, approvo tutti», sui testi di «Testi
   approvati» qui sotto.
6. **La proposta intera** (`docs/STYLE.md`).
   — *Risposta* (2026-11-04): «Sì, approvo». Non copre i testi del punto 5,
   che si approvano a parte.

## Testi approvati

Bozze dell'agente, 2026-11-04, nelle cinque lingue (ADR-0172: nel codice la
base è l'inglese). **Approvati dall'utente il 2026-11-04** («Sì, approvo
tutti», sull'anteprima in italiano). Termini e Privacy nuovi entrano **insieme
alla prima versione con Style** (app e server), non prima: fino ad allora i
testi di oggi restano veri. La copia sul sito la chiede il Coordinatore. Il tono segue i testi di oggi: frasi brevi, «tu», «MuW» come
soggetto.

### A. Nell'app

1. **Etichetta fissa sul post (immagine AI)**
   - EN: AI-generated
   - IT: Generata con l'AI
   - DE: KI-generiert
   - FR: Générée par IA
   - ES: Generada con IA
2. **Etichetta fissa sul post (pubblicità)**
   - EN: Ad · Affiliate links
   - IT: Pubblicità · Link affiliati
   - DE: Werbung · Affiliate-Links
   - FR: Publicité · Liens affiliés
   - ES: Publicidad · Enlaces de afiliado
3. **Pulsante nella scheda del prodotto** (`{store}` = Zalando, Amazon…)
   - EN: Shop on {store}
   - IT: Compra su {store}
   - DE: Bei {store} kaufen
   - FR: Acheter sur {store}
   - ES: Comprar en {store}
4. **Prezzo nella scheda** (`{price}` già formattato, `{date}` giorno e mese)
   - EN: {price} on {date}
   - IT: {price} il {date}
   - DE: {price} am {date}
   - FR: {price} le {date}
   - ES: {price} el {date}
5. **Al posto del prezzo, se letto più di 7 giorni prima**
   - EN: See price
   - IT: Vedi il prezzo
   - DE: Preis ansehen
   - FR: Voir le prix
   - ES: Ver el precio
6. **Riga fissa nella scheda, sulla foto**
   - EN: The photo is AI-generated: the item shown is similar, not the exact product.
   - IT: La foto è generata con l'AI: il capo che vedi è simile, non è esattamente il prodotto.
   - DE: Das Foto ist KI-generiert: Das gezeigte Teil ist ähnlich, nicht genau das Produkt.
   - FR : La photo est générée par IA : l'article montré est similaire, pas exactement le produit.
   - ES: La foto está generada con IA: la prenda que ves es parecida, no es exactamente el producto.
7. **Riga fissa nella scheda, sul link**
   - EN: If you buy through this link, MuW earns a commission. The price for you stays the same.
   - IT: Se compri da questo link, MuW riceve una commissione. Per te il prezzo non cambia.
   - DE: Wenn du über diesen Link kaufst, erhält MuW eine Provision. Für dich bleibt der Preis gleich.
   - FR : Si tu achètes via ce lien, MuW reçoit une commission. Pour toi, le prix ne change pas.
   - ES: Si compras desde este enlace, MuW recibe una comisión. Para ti el precio no cambia.
8. **La lente / scheda del Feed**
   - EN: Style · IT: Style · DE: Style · FR: Style · ES: Style (nome proprio,
     non si traduce)
9. **Filtri nella lente**: i temi e il genere
   - EN: Running · Trail · Bike · Gym · Athleisure · Women · Men
   - IT: Corsa · Trail · Bici · Palestra · Tempo libero · Donna · Uomo
   - DE: Laufen · Trail · Rad · Gym · Freizeit · Damen · Herren
   - FR : Course · Trail · Vélo · Salle · Loisirs · Femme · Homme
   - ES: Correr · Trail · Bici · Gimnasio · Tiempo libre · Mujer · Hombre
10. **Lente vuota**
    - EN: No Style posts yet.
    - IT: Ancora nessun post Style.
    - DE: Noch keine Style-Beiträge.
    - FR : Pas encore de posts Style.
    - ES: Todavía no hay publicaciones Style.
11. **Interruttore in «Settings» / «Impostazioni»** (titolo e riga sotto; acceso all'inizio)
    - EN: Style posts in the Feed — Outfits made with AI, with links to shops. They stay in Style.
    - IT: Post Style nel Feed — Outfit fatti con l'AI, con i link ai negozi. Restano in Style.
    - DE: Style-Beiträge im Feed — Mit KI erstellte Outfits, mit Links zu Shops. Sie bleiben in Style.
    - FR : Posts Style dans le Feed — Des tenues créées par IA, avec des liens vers les boutiques. Elles restent dans Style.
    - ES: Publicaciones Style en el Feed — Outfits creados con IA, con enlaces a tiendas. Siguen en Style.

### B. Termini, sezione «Pubblicità» (sostituisce «MuW non mostra pubblicità.»)

- **EN**: MuW shows posts of its own, marked «Ad · Affiliate links», with links to shops (MuW Style). If you buy through one of these links, the shop pays MuW a commission; the price for you does not change. The sale is between you and the shop: MuW does not sell these products and does not answer for their price, availability, delivery or returns. The photos of these posts are made with AI and say so: the people in them do not exist, and the items shown are similar to the products, not the products themselves. You can hide these posts from the Feed in «Settings». MuW shows no other advertising.
- **IT**: MuW mostra dei post suoi, segnati «Pubblicità · Link affiliati», con i link ai negozi (MuW Style). Se compri da uno di questi link, il negozio paga a MuW una commissione; per te il prezzo non cambia. La vendita è fra te e il negozio: MuW non vende questi prodotti e non risponde di prezzo, disponibilità, consegna o resi. Le foto di questi post sono fatte con l'AI e lo dicono: le persone che vedi non esistono, e i capi sono simili ai prodotti, non sono i prodotti. Puoi togliere questi post dal Feed in «Impostazioni». MuW non mostra altra pubblicità.
- **DE**: MuW zeigt eigene Beiträge, gekennzeichnet mit «Werbung · Affiliate-Links», mit Links zu Shops (MuW Style). Wenn du über einen dieser Links kaufst, zahlt der Shop MuW eine Provision; für dich ändert sich der Preis nicht. Der Kauf findet zwischen dir und dem Shop statt: MuW verkauft diese Produkte nicht und haftet nicht für Preis, Verfügbarkeit, Lieferung oder Rücksendung. Die Fotos dieser Beiträge sind mit KI erstellt und als solche gekennzeichnet: Die Personen darauf gibt es nicht, und die gezeigten Teile ähneln den Produkten, sind aber nicht die Produkte selbst. Du kannst diese Beiträge in «Einstellungen» aus dem Feed ausblenden. Andere Werbung zeigt MuW nicht.
- **FR** : MuW affiche ses propres posts, marqués « Publicité · Liens affiliés », avec des liens vers des boutiques (MuW Style). Si tu achètes via l'un de ces liens, la boutique verse une commission à MuW ; pour toi, le prix ne change pas. La vente se fait entre toi et la boutique : MuW ne vend pas ces produits et ne répond pas de leur prix, de leur disponibilité, de la livraison ni des retours. Les photos de ces posts sont créées par IA et l'indiquent : les personnes qu'on y voit n'existent pas, et les articles montrés ressemblent aux produits sans être les produits eux-mêmes. Tu peux masquer ces posts du Feed dans «Réglages». MuW n'affiche aucune autre publicité.
- **ES**: MuW muestra publicaciones propias, marcadas «Publicidad · Enlaces de afiliado», con enlaces a tiendas (MuW Style). Si compras desde uno de estos enlaces, la tienda paga a MuW una comisión; para ti el precio no cambia. La venta es entre tú y la tienda: MuW no vende estos productos y no responde de su precio, disponibilidad, entrega o devoluciones. Las fotos de estas publicaciones están hechas con IA y lo indican: las personas que aparecen no existen, y las prendas son parecidas a los productos, no son los productos. Puedes quitar estas publicaciones del Feed en «Ajustes». MuW no muestra otra publicidad.

### C. Privacy, sezione «Pubblicità» (sostituisce il paragrafo di oggi)

- **EN**: MuW shows its own Style posts with links to shops, marked «Ad · Affiliate links». MuW uses no advertising network, and the app never asks to track you across other apps. When you open a product or tap «Shop», our server only adds one to that day's count for that product: it does not know who you are or which phone it was. «Shop» opens the shop's site in your browser through the link of our affiliate network, Awin: from there Awin and the shop record the click and any purchase, with their cookies and under their own privacy policies, so that MuW can be paid its commission. From them MuW receives only totals of clicks, sales and commissions, never who you are.
- **IT**: MuW mostra i suoi post Style con i link ai negozi, segnati «Pubblicità · Link affiliati». MuW non usa reti pubblicitarie, e l'app non chiede mai di tracciarti nelle altre app. Quando apri un prodotto o tocchi «Compra», il nostro server aggiunge solo uno al conteggio di quel giorno per quel prodotto: non sa chi sei né quale telefono era. «Compra» apre il sito del negozio nel tuo browser passando dal link della nostra rete di affiliazione, Awin: da lì Awin e il negozio registrano il clic e l'eventuale acquisto, con i loro cookie e secondo le loro informative, perché MuW riceva la commissione. Da loro MuW riceve solo i totali di clic, vendite e commissioni, mai chi sei.
- **DE**: MuW zeigt eigene Style-Beiträge mit Links zu Shops, gekennzeichnet mit «Werbung · Affiliate-Links». MuW nutzt kein Werbenetzwerk, und die App fragt nie, ob sie dich über andere Apps hinweg verfolgen darf. Wenn du ein Produkt öffnest oder auf «Kaufen» tippst, zählt unser Server nur für diesen Tag und dieses Produkt eins dazu: Er weiß nicht, wer du bist oder welches Telefon es war. «Kaufen» öffnet die Seite des Shops in deinem Browser über den Link unseres Affiliate-Netzwerks Awin: Ab dort erfassen Awin und der Shop den Klick und einen möglichen Kauf, mit ihren Cookies und nach ihren eigenen Datenschutzerklärungen, damit MuW seine Provision erhält. Von ihnen bekommt MuW nur Summen von Klicks, Verkäufen und Provisionen, nie, wer du bist.
- **FR** : MuW affiche ses propres posts Style avec des liens vers des boutiques, marqués « Publicité · Liens affiliés ». MuW n'utilise aucun réseau publicitaire, et l'app ne demande jamais à te suivre à travers d'autres apps. Quand tu ouvres un produit ou touches « Acheter », notre serveur ajoute seulement un au compte de ce jour pour ce produit : il ne sait pas qui tu es ni de quel téléphone il s'agit. « Acheter » ouvre le site de la boutique dans ton navigateur via le lien de notre réseau d'affiliation, Awin : à partir de là, Awin et la boutique enregistrent le clic et l'éventuel achat, avec leurs cookies et selon leurs propres politiques de confidentialité, pour que MuW reçoive sa commission. D'eux, MuW ne reçoit que des totaux de clics, de ventes et de commissions, jamais qui tu es.
- **ES**: MuW muestra sus propias publicaciones Style con enlaces a tiendas, marcadas «Publicidad · Enlaces de afiliado». MuW no usa redes publicitarias, y la app nunca pide rastrearte a través de otras apps. Cuando abres un producto o tocas «Comprar», nuestro servidor solo suma uno al recuento de ese día para ese producto: no sabe quién eres ni qué teléfono era. «Comprar» abre la web de la tienda en tu navegador a través del enlace de nuestra red de afiliación, Awin: desde ahí Awin y la tienda registran el clic y la posible compra, con sus cookies y según sus propias políticas de privacidad, para que MuW reciba su comisión. De ellos MuW solo recibe totales de clics, ventas y comisiones, nunca quién eres.

Nota: «Shop» nel resto dei documenti è il pulsante; il testo vero è quello
del punto 3 («Shop on {store}» / «Compra su {store}» …). La Privacy lo cita
con la parola breve della lingua.

## Prerequisiti fuori dal codice (dell'utente)

- Iscrizione ad Awin come publisher e candidatura al programma Zalando.
- Testi legali nuovi, sito rigenerato, App Privacy e Data safety aggiornate.
- Piano Google per le immagini con uso commerciale; generare le immagini e
  pubblicare i post solo col suo sì.

## Parti, dopo il sì

- **A — API**: migrazione `style_posts`, `post_product_tags`,
  `product_tag_clicks`; `GET /style`; i due contatori; il controllo dei link.
- **B — App**: la card Style nel Feed (1 ogni 8, «All»), i puntini e la
  scheda, la lente «Style», l'interruttore in «Settings».
- **C — Contenuti**: le immagini generate e i tag posizionati, approvati
  dall'utente a gruppi, poi l'uscita 2–3 al giorno.

## Parte A — l'API (branch `feat/TASK-384-a-style-api`)

Via del Coordinatore il 2026-11-04 con la lista dei file e la migrazione
`0046_style_posts.sql`; righe in `app.py` e `shared-types/src/index.ts` in un
blocco a parte, in fondo (li toccano anche TASK-376 B2 e TASK-387).

- `0046_style_posts.sql`: `style_posts`, `post_product_tags`,
  `product_tag_clicks` (`DATABASE.md`).
- `style_posts.py`: `GET /style`, `GET /style/{id}`, la foto, `POST
  /style/tags/{id}/open` e `/shop` (`API.md` «Style»).
- `style_links.py`: il deep link di Awin dagli ID in `.env`, solo verso i
  siti dei negozi.
- `style_import.py`: carica un post approvato (JSON + JPEG) o lo nasconde.
  **Nessun post caricato**: si fa sul server, col sì dell'utente.
- Test: `test_style_posts.py` (col database, in CI; c'è
  `test_nothing_personal_is_kept`), `test_style_import.py`,
  `test_style_links.py`; `shared-types/test/style.test.ts`.
- **Fuori**: il controllo giornaliero dei link (aspetta il feed di Awin,
  cioè l'iscrizione dell'utente), l'app (parte B), immagini e post (C).
  Server, migrazione e `.env` sul server solo col sì dell'utente.

File toccati della parte A: `services/api/migrations/0046_style_posts.sql`,
`services/api/shaperoute_api/style_posts.py`, `style_links.py`,
`style_import.py` (nuovi), `services/api/shaperoute_api/app.py` (5 righe),
`services/api/tests/test_style_posts.py`, `test_style_import.py`,
`test_style_links.py`, `services/api/tests/fixtures/style/MS-001.json`
(nuovi), `packages/shared-types/src/index.ts` (in fondo),
`packages/shared-types/fixtures/style-post.json`, `style-page.json`,
`packages/shared-types/test/style.test.ts` (nuovi), `.env.example`,
`docs/API.md`, `docs/DATABASE.md`, `docs/DECISIONS.md`,
`docs/tasks/TASK-384.md`, `docs/STATUS.md`.

## File toccati (questa PR)

- `docs/tasks/TASK-384.md` (nuovo)
- `docs/STYLE.md` (nuovo)
- `docs/DECISIONS.md` (una voce in fondo)
- `docs/INDEX.md` (una riga)
- `docs/STATUS.md` (righe aggiunte)

## Criteri di accettazione (questa PR)

- [x] 100 outfit in `out/TASK-384/outfits.csv`, solo prodotti di zalando.it,
      senza foto.
- [x] 100 prompt senza loghi né persone reali in `out/TASK-384/image-prompts.md`.
- [x] Proposta in `docs/STYLE.md` con etichette, tag, frequenza, uscita
      graduale, modello dati, clic, prerequisiti.
- [x] Le tre scelte chieste all'utente, più quella sulla società.
- [x] Il sì dell'utente sulla proposta (2026-11-04, «Sì, approvo»). Dopo:
      i testi, poi le parti A–C.
