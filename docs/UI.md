# UI — Interfaccia mobile

> Scritto con TASK-021 (mappa, posizione, ricerca del luogo) e TASK-023
> (forma, distanza, percorso); la distanza libera con TASK-026, il
> riquadro della forma con TASK-033, le parole lette dall'AI con TASK-030,
> il tema con TASK-045. Le domande ancora aperte stanno in fondo.

## Cosa è deciso

- React Native + Expo + TypeScript; si prova con Expo Go (ADR-0028).
- La mappa è una pagina MapLibre GL JS dentro una WebView, con le tile di
  OpenFreeMap (ADR-0029). Non MapLibre React Native: in Expo Go non gira.
- I percorsi li chiede all'API sul PC (ADR-0030, ADR-0031); mappa e
  ricerca del luogo chiamano direttamente due servizi esterni (ADR-0029).
- Testi scritti in inglese, come il codice, e mostrati nella lingua scelta
  in «Settings» (TASK-210, ADR-0172): inglese, tedesco, italiano, spagnolo,
  francese; senza scelta, quella del telefono se è una delle cinque,
  altrimenti l'inglese. Ogni testo passa da `t()` (`src/i18n/`); un testo
  senza traduzione si mostra in inglese. Tradotti a pezzi: con la parte A
  «Settings», «Profile», l'accesso, «My activities», i preferiti, i
  disegni, il feed, Strava e la ricerca del luogo; i testi della canoa con
  TASK-191 C; «Draw», «Explore» e la corsa con le parti successive. Le traduzioni le ha riviste l'agente su
  delega dell'utente («controlla te, mi fido», 2026-10-03); chi parla
  tedesco, spagnolo o francese può ancora migliorarle in `src/i18n/`.

## Il tema

Scuro, con il nome «MuW» (ADR-0046; «Sgrava» fino a ADR-0224), e dal TASK-263 anche chiaro, ognuno in cinque passi di luminosità (sotto, «Il tono e la luminosità»). Tutti i valori stanno in
`apps/mobile/src/theme/tokens.ts`: colori, spaziature a passi di 4, raggi,
corpi del testo, la linea del percorso (gialla, larga 5) e `MIN_TAP_SIZE`,
44, l'altezza minima di ogni cosa da toccare. **Nessun colore scritto a
mano fuori da lì**: lo stile della mappa e le schermate leggono gli stessi
token, e un colore nuovo è un token nuovo. Applicato all'app con TASK-046:
mappa scura, percorso giallo, pannelli scuri, tastiere scure, barra di
stato chiara. «Draw route» è il comando giallo, con il testo scuro (e
«Run without a route», per scelta dell'utente: TASK-220); gli
altri («My position», «Search», «Cancel», «Export GPX», le forme da
toccare) sono neutri, su `surfaceRaised`, con il bordo `borderStrong`:
schiariti con TASK-086 (ADR-0081) perché sul fondo nero non si vedevano. Il segnaposto della partenza è
chiaro (`text`): quello di MapLibre è un azzurro che si confonde con il
ciano di «Start here».

| Token | Colore | Per cosa |
|---|---|---|
| `accent` | `#FFD02B` | il percorso e il comando che lo produce, «Draw route» |
| `onAccent` | `#0A0A0B` | testo e icone sul giallo |
| `background` | `#0A0A0B` | il fondo dell'app, nero neutro |
| `surface`, `surfaceRaised` | `#141416`, `#2B2B31` | campi, schede, il pannello sopra la mappa; una superficie sopra un'altra |
| `border`, `borderStrong` | `#3D3D44`, `#74747E` | divisioni; bordi dei comandi (4,3:1 sul fondo, TASK-086) |
| `text` | `#F5F5F4` | il testo |
| `textMuted` | `#9B9B9F` | etichette e righe secondarie (7,2:1 sul fondo) |
| `textFaint` | `#8A8A90` | il testo più tenue ancora leggibile (5,8:1), non per il corpo |
| `warning` | `#FF7A59` | gli avvisi sul percorso prodotto |
| `error` | `#FF6B6B` | una richiesta fallita |
| `badge`, `onBadge` | `#E02D2D`, `#FFFFFF` | qualcuno aspetta una risposta: il numero delle richieste di follow sul pulsante di «Profile» e il pallino di «Requests» (TASK-239, rosso per scelta dell'utente); il numero è bianco, 4,6:1 |
| `startHere` | `#4DD2FF` | il segnaposto «Start here» (ADR-0040) |
| `strava`, `onStrava` | `#FC5200`, `#FFFFFF` | nessuno dal TASK-218: «Connect with Strava» (TASK-187) ora è l'immagine ufficiale di Strava, con i suoi colori dentro (ADR-0181); da togliere quando `tokens.ts` è libero |
| `map.*` | dal `#0D0E10` al `#3A3D45` | fondo, acqua, verde, costruito, edifici, quattro livelli di strade, nomi dei luoghi |

Quattro regole:

1. **Il giallo significa una cosa sola**: il percorso, il comando che lo
   produce e la barra che lo mostra mentre si disegna. Gli avvisi usano `warning`, arancio: un avviso giallo
   renderebbe il colore muto. **Un'eccezione**, scelta dall'utente
   (TASK-220, ADR-0183): «Run without a route» in cima a «Draw» è giallo,
   con il testo scuro. Per tutto il resto la regola vale.
2. **Sul giallo il testo è scuro** (`onAccent`, 13,5:1). Il bianco si ferma
   a 1,5:1, sotto il minimo, e in pieno sole, dove l'app si usa, non si
   legge.
3. **«Start here» è ciano**, non più verde: su una mappa scura il verde è
   spento, e il ciano non si scambia per il percorso.
4. **Lo stile della mappa è dell'app** (`src/map/mapStyle.ts`), non si
   scarica più da OpenFreeMap: le tile e i font sono gli stessi
   (OpenMapTiles, «Noto Sans Regular»), i colori li decidono i token.
   Prima era un file altrui, che poteva cambiare sotto di noi. La mappa
   mostra fondo, acqua, verde, edifici, strade e i nomi di città, paesi e
   villaggi; non i nomi delle vie, i numeri civici e i punti d'interesse.
   Nessuno strato della mappa usa il giallo.

### Il tono e la luminosità (TASK-263, ADR-0231)

In «Settings», sezione «PREFERENCES», la riga «Tone» dopo «Units» dice
il tono dell'app («Dark» o «Light») e si apre come «Units»: i due toni,
«Brightness» con cinque passi da «Darker» a «Brighter», un'anteprima e
«Apply». Ogni tono ricorda il suo passo: scuro parte dal passo 1, i colori
della tabella sopra; chiaro dal passo 5, il bianco. L'anteprima disegna
nel tono provato il fondo, una scheda con i suoi testi, un comando neutro
e quello giallo, e un angolo di mappa con acqua, verde, due strade e il
percorso. «Apply» compare solo se l'app cambierebbe aspetto; salva la
scelta e riapre l'app, che si ricarica nel tono nuovo («MuW opens again
in the new tone.»). Chiudendo la riga senza «Apply» la prova si perde.

I colori dei due toni a ogni passo stanno in `tokens.ts` (`SHADES`, i due
estremi di ogni tono, mescolati per i passi in mezzo); il giallo, il testo
sul giallo, il rosso dei numeri e i colori di Strava sono gli stessi in
tutti. Nel tono chiaro:

- avvisi, errori e «Start here» sono più scuri (arancio bruciato, rosso
  scuro, blu petrolio), per leggersi sul chiaro;
- **il percorso ha un bordo scuro** sotto la linea gialla, il nero del
  testo sul giallo: sulla mappa chiara il giallo da solo non si vede;
- la barra di stato è scura;
- restano scure le tastiere e bianco il logo «Compatible with Strava»
  (parte B).

## Il logo e l'icona (TASK-159, ADR-0129; «MuW» da TASK-260, ADR-0224)

Il segno è **il cuore dell'avvio su giallo**: il percorso a cuore di
Milano, nero `onAccent` su `accent`, con il punto di partenza (lo stesso
cuore del badge in cima a «Draw», sotto). Il logo intero è il cuore con
sotto la parola «MuW», disegnata con un tratto solo di spessore costante
e gli angoli arrotondati, come il vecchio «SGRAVA»: M e W maiuscole, la u
all'altezza delle minuscole. Fino a TASK-260 il segno era una S fatta come
un percorso, con «GRAVA» accanto. I vettoriali stanno in `docs/brand/`
(`muw-mark.svg`, `muw-logo.svg`); i PNG li genera `docs/brand/make_brand.py`
(Pillow, a mano) dai punti del cuore e dai colori dell'app.

Sotto l'icona il nome è «MuW» (`name` in `app.json`). L'icona dell'app
è il cuore nero su giallo (`assets/icon.png`, 1024 × 1024, senza
trasparenza), con il tratto più sottile del badge perché il percorso si
legga. Su Android il cuore sta nel cerchio sicuro dell'icona adattiva, il
fondo è giallo e l'icona a un colore è il cuore bianco. In Expo Go sulla
schermata di casa resta l'icona di Expo Go: la nostra si vede con una
build propria. Dentro l'app il nome in cima a «Draw» resta un testo, con
a sinistra il cuore su giallo (sotto).

**La schermata di avvio** (TASK-165, ADR-0134; gialla da TASK-181): fondo
giallo `accent`, il logo nero al centro. Su iOS la parola «MuW», larga 260
punti (`assets/splash-logo-dark.png`); su Android il cuore da solo
(`assets/splash-icon-dark.png`), perché il sistema ritaglia l'immagine in
un cerchio. La genera il plugin `expo-splash-screen` da `app.json`, dove il
giallo è scritto (`#FFD02B`: `app.json` non legge i token). Nessun codice la
tiene aperta, sparisce quando l'app è pronta. Come l'icona, si vede solo in
una build propria.

**L'animazione all'avvio** (TASK-179, ADR-0147; TASK-181): dopo la
schermata di avvio, e in Expo Go al suo posto, lo schermo è giallo `accent`
dal primo fotogramma, senza nero in mezzo, e una penna disegna un cuore,
nero `onAccent`: è il percorso a cuore di Milano da 10 km, quello del
video. Sotto, il logo intero, nero (la stessa immagine della schermata di
avvio). Tempi: 0,35 s la penna aspetta sul punto di partenza, 1,6 s il
disegno, 0,45 s fermo, 0,3 s di dissolvenza sull'app; il giallo si vede
almeno 2,4 secondi. Il cuore finito resta sempre i suoi 0,45 s: se il
telefono è lento e il disegno finisce tardi, la dissolvenza aspetta.
L'app parte sotto e si carica intanto; l'animazione prende i tocchi finché
c'è, non si salta, e si vede una volta a ogni apertura. Sta in
`src/intro/`, sopra `App` (`index.ts`). Al lettore di schermo dice
«MuW».

**Il cuore su giallo** (TASK-221, ADR-0184): lo stesso cuore, fermo e
piccolo, come un logo. Un quadrato giallo `accent` con gli angoli
arrotondati (22% del lato), dentro il cuore nero `onAccent` largo il 68%
del lato, con il punto di partenza; il tratto è 1/16 del lato, più spesso
di quello dell'avvio, perché il cuore si legga alla misura di una parola.
In cima a «Draw» sta a sinistra di «MuW», 32 punti, alto quanto il
titolo. È solo un'immagine: il lettore di schermo legge il nome accanto.
Un componente solo, `src/intro/HeartBadge.tsx` (`size`), per ogni posto
dove il cuore su giallo compare.

**Il tour della prima apertura** (TASK-266, ADR-0235): finita
l'animazione, la prima volta, il resto dello schermo si scurisce
(`scrim`, opacità 0,82, in entrambi i toni) e una parte vera dell'app
resta nella luce, con un bordo `onScrim` di 2 punti; sotto o sopra, in una
scheda `surface`, un titolo, una o due righe e in fondo otto puntini,
«Skip» e «Next» (chiaro su scuro, mai giallo). Otto passi: benvenuto (senza
luce, la scheda al centro), «START», le forme (con «Paddle» un testo suo),
la distanza, il fondo di «Draw» con «Draw route», sport e «Profile», poi
il tour va su «Explore» e su «Feed», che restano nella luce sopra la
scheda, e finisce su «Draw» con «Let's go». Una parte sotto il bordo viene
portata in vista scorrendo, e alla fine «Draw» torna in cima. «Skip» per i
primi 5 secondi del tour non si tocca e dice i secondi che mancano,
«Skip (5)»; il conto si ferma mentre il telefono chiede la posizione. I
tocchi sull'app aspettano la fine del tour. Il tour non torna, salvo
«Watch the tour» nella guida (qui «Skip» si tocca subito).

**«Guide»** (TASK-266): con un account è la riga subito sotto
«Settings» sulla prima pagina di «Profile», ❓ nel cerchio come «Settings»
(richiesta dell'utente del 2026-10-10); senza account è l'ultima riga,
sotto il modulo, come le righe di «ABOUT». Apre «How MuW works» con
il nome «Guide» e sopra il testo «Watch the tour», che chiude «Profile» e
rifà il tour; «←» torna a «Profile». «Help» in «Settings» resta, con lo
stesso pulsante.

## Le due schermate

Due, senza librerie di navigazione (TASK-051, scelta dell'utente). La
prima ed «Explore» sono due delle tre pagine affiancate (sotto, «Le
pagine»):

1. **«What to draw»**, all'apertura: la pagina «Draw». Dall'alto: il nome
   «MuW», con a sinistra il cuore su giallo (TASK-221, sopra), e il
   pulsante «Run without a route» (TASK-149, sotto; «Ride
   without a route» con «Bike», TASK-190); una
   scheda che dice da dove partirà il percorso,
   con, quando servono, il rimando alle Impostazioni e la ricerca del
   luogo; l'errore della mappa; le forme del catalogo come tessere, con un
   simbolo e il nome (quella scelta ha il bordo chiaro); il campo per
   un'altra parola; la distanza, grande, fra − e +. In fondo, fermo mentre
   il resto scorre, «Draw route». Sopra, solo mentre il telefono scarica
   le sue prime mappe (TASK-214, parte C), una riga piccola e grigia:
   «Downloading the maps of your area (10 MB) so routes work without
   signal.», con il peso vero; finito il download, sparisce.
2. **La mappa**, che si apre con «Draw route» e chiede il percorso. La
   mappa va da bordo a bordo, con «←» in alto a sinistra; sotto, una
   scheda con l'attesa, il risultato o il problema. All'apertura la mappa
   mostra l'Italia intera, poi la partenza con un segnaposto, a zoom 15
   (qualche via attorno); con un percorso, la linea e la mappa inquadrata
   su di lui. Si sposta e si ingrandisce con le dita: i pulsanti + e − non
   ci sono più (TASK-175, chiesto dall'utente). L'attribuzione dei dati è
   sempre visibile in basso, per intero; i suoi link si aprono nel browser
   del telefono.

   **Il tipo di mappa** (TASK-264, ADR-0232, chiesto dall'utente): in alto
   a destra, di fronte a «←», un pulsante tondo con due fogli; mentre si
   corre sta sotto la barra delle svolte. Toccato, sotto compaiono
   «Standard», «Satellite» e «3D», con la spunta su quello mostrato.
   **Standard** è la mappa scura di sempre. **Satellite** sono le foto
   aeree di Esri, con i nomi dei paesi in chiaro sopra e il credito
   «Powered by Esri». **3D** è la mappa scura inclinata a 55° con il
   rilievo vero e la sua ombreggiatura, come in Strava e komoot; niente
   edifici in piedi, che coprivano il percorso. Il cambio non ricarica la
   mappa: percorso, segni e inquadratura restano, e un percorso inquadrato
   si inquadra di nuovo con la nuova inclinazione. La scelta resta per la
   volta dopo. Le mappe piccole di «Feed» ed «Explore» restano standard.

3. **«Explore»** (TASK-126, variante C di TASK-092), la pagina a destra
   di «Draw» (TASK-154): «Best near you», i percorsi
   migliori che partono entro 5 km dalla partenza scelta, tutti, i migliori
   per primi. **I percorsi sono schede, due per riga**
   (TASK-167, ADR-0135, scelto dall'utente): in alto il disegno, largo
   quanto la scheda, giallo su fondo scuro, con la somiglianza in un angolo
   («97%»); sotto, forma e km («Star · 5.1 km») e città e distanza dalla
   partenza («Trento · 450 m away»). **Sotto la linea c'è la mappa** della
   zona, con i nomi dei paesi (TASK-174, ADR-0142, chiesto dall'utente): è
   la foto di «Feed» (TASK-162), fatta dalla stessa pagina nascosta; finché
   non arriva la scheda è la linea sul fondo scuro, e senza rete resta
   così. Il credito della mappa non è su ogni foto, che è larga mezzo
   telefono: sta una volta sola sopra le schede, «Maps: OpenFreeMap ©
   OpenMapTiles · Data from OpenStreetMap». **Un percorso inclinato ha la
   scheda girata** (TASK-232 parte B2, ADR-0195): la linea e la foto della
   mappa sotto sono girate dall'altra parte, così il disegno si legge
   dritto già nell'elenco, come poi sulla mappa; i nomi dei paesi restano
   dritti. Una scheda che non dice l'inclinazione resta col nord in alto.
   **Niente filtri** (TASK-176,
   ADR-0144, chiesto dall'utente: «toglimi i filtri, non mi piacciono»):
   fino a TASK-167 sopra le schede c'erano «Shape» e «Distance». Toccata
   una scheda, il percorso si apre sulla
   mappa con «Export GPX» e «Back to the list»; «←» torna all'elenco. Da
   TASK-145 ha anche «Start» (sotto). **Un dito che scorre sopra una scheda
   non la apre** (TASK-196, come in «Feed» da TASK-188): «Explore» è
   l'ultima pagina, uno swipe verso sinistra non fa scorrere niente e il
   dito alzato sopra una scheda contava come un tocco. La scheda ricorda
   dove il dito è sceso e ignora un dito che si è mosso più di 12 punti;
   vale per ogni scheda di questo tipo: i percorsi di «Best near you», gli
   esempi di una città, i preferiti in «Profile».

   **«RECOMMENDED»** (TASK-092, ADR-0229): sopra le schede dei percorsi
   vicini, con un account, una riga che scorre di lato con al più 10
   percorsi consigliati dall'API (`GET /recommended`): prima i disegni
   venuti meglio, a pari percento i più apprezzati (reazioni ai disegni
   pubblicati) e poi i più corsi e tenuti fra i preferiti. Le schede sono
   quelle di «Best near you», larghe come quelle di «NEARBY TOWNS» (due e
   il bordo della terza); un tocco apre il percorso sulla mappa come le
   altre, con «Start». Etichetta grigia in maiuscolo come «NEARBY TOWNS»
   (it «CONSIGLIATI», de «EMPFOHLEN», es «RECOMENDADAS», fr
   «RECOMMANDÉS»). **Senza account, senza percorsi vicini, senza rete o
   con un'API che non la conosce la riga non c'è**, e la pagina è come
   prima. Il token si legge dal portachiavi a ogni nuovo punto: chi entra
   con la pagina già aperta vede la riga al punto o alla città dopo.

   Sopra l'elenco (TASK-129): **«City»**, il campo «Search a city» per
   qualsiasi città del mondo (l'elenco e la richiesta partono dal suo
   centro, «Change» torna alla partenza). **In fondo alla pagina**, sotto
   gli esempi della città e l'elenco (TASK-157, chiesto dall'utente): una
   riga discreta, «Ask for a route», grigia e sottolineata. Un tocco la
   apre lì dov'è, e la pagina scorre fino a lei: **«Ask for a route»**, una
   richiesta in parole («a romantic heart», «famous places in Paris,
   15 km») e «Make my route», giallo come «Draw route». Il percorso si
   apre sulla mappa coi luoghi: pallini chiari col nome quelli da cui
   passa, più tenui quelli trovati e non raggiunti (token `stop`). Sotto,
   km, forma, città, somiglianza, «Passes by N of the M … found» coi nomi,
   «Export GPX» e «Back to Explore». Se i luoghi verificati sono troppo
   pochi, la scheda lo dice.

   **Da TASK-134** il percorso è: città → categoria → percorso, due tocchi.
   «City» mostra in alto le città recenti (↺, le ultime 5, salvate sul
   telefono) e una fila di città di tutto il mondo (New York, London,
   Paris, Tokyo, Rome, Milan, Torino, Barcelona, Dubai…): un tocco la
   sceglie, il centro viene dall'API, mai scritto nell'app. Sotto, «Type a
   city» suggerisce le città mentre si scrive (da 2 lettere, pausa 250 ms).
   **La prima voce della fila è «Near me»** (TASK-176, ADR-0144), con
   il segno della posizione, un anello col suo centro: è accesa finché non
   si sceglie una città, e da una città riporta ai percorsi vicini alla
   partenza. La città scelta è la voce accesa della fila, e il suo nome
   intero sta sotto il titolo della pagina. Prima c'era un pulsante «My
   start» accanto al nome della città: l'utente non lo trovava chiaro.
   «Ask for a route» ha le categorie come
   pulsanti, Food per prima (Famous Places, Romantic, Best Views, Shopping,
   Culture, Nightlife, Hidden Gems, Running, Walking, Family, Photography,
   Local Experience), ognuna con «in <città>» sotto: un tocco chiede
   «Food in New York». Il campo libero resta, con un esempio per la città.
   Ciò che si tocca si attenua (opacità), niente si sposta.

   **Da TASK-138** il campo è «Type a city or a place»: a metà parola
   suggerisce città e luoghi (monumenti, piazze, quartieri, vie), al più 6,
   nell'ordine del servizio. Ogni voce ha due righe: il nome, e sotto
   «City centre · Veneto, Italy» per una città o la sua città per un luogo
   («Verona, Italy»). Invio sceglie il primo suggerimento. Scelto un luogo,
   le categorie dicono «near Verona Arena» e chiedono il tema dal suo punto
   (le parole sono solo «Food»); l'esempio del campo libero non nomina
   città.

   **Da TASK-143** «Ask for a route» mostra due categorie, Food e Famous
   Places, e una terza tessera «More…» («11 more») che apre tutte le 13;
   tre tessere per riga. Scelta una città senza percorsi consigliati entro
   5 km, sotto «City» compare **«EXAMPLES IN VERCELLI»**: cuore, cerchio e
   stella da 5 km dal centro, chiesti da soli, uno alla volta, il cuore per
   primo. Sono schede come quelle di «Best near you», due per riga
   (TASK-167): una scheda dice «Drawing…» o «Next» con il posto del
   disegno vuoto, poi ha il disegno, i km e la somiglianza, il nome del
   paese sotto («Vercelli») e la mappa sotto la linea come in «Best near
   you» (TASK-174), con il credito della mappa una volta sotto le schede;
   un tocco apre il
   percorso sulla mappa con «Export GPX» e «Back to Explore». Se la mappa
   della zona
   non si scarica, un messaggio solo e «Try again». Gli esempi pronti
   restano sul telefono (ultime 8 città): la volta dopo sono subito lì.
   Restano anche sull'API (TASK-168, ADR-0136): in una città che qualcuno ha
   già aperto, o disegnata prima con `draw_examples`, le tre schede hanno
   il disegno appena scelta la città, senza «Drawing…».

   **Da TASK-176** (ADR-0144, chiesto dall'utente: le prime tre il più
   in fretta possibile, e intanto altre mentre si sceglie): dopo cuore,
   cerchio e stella l'app continua da sola con **luna, cavallo, lumaca,
   testa di cane e testa di coniglio**, le forme del catalogo che a 5 km
   dal centro vengono meglio, sempre una alla volta. Ognuna diventa una
   scheda quando tocca a lei («Moon», «Drawing…») e poi ha il disegno, in
   coda alle prime tre; quelle ancora in attesa non si annunciano, e una
   che non riesce non compare, senza messaggi. Finché ne arrivano la nota
   sotto il titolo finisce con «Three first, more while you choose.».
   La prima scheda resta il cuore, ma **il primo a essere chiesto è il
   cerchio**: la sua zona contiene quella di tutte le altre forme, così una
   città nuova per l'API scarica una mappa sola (col cuore per primo ne
   scaricava due). Per questo all'inizio il cuore dice «Next» e il cerchio
   «Drawing…».
   **Una città con percorsi consigliati** mostra quelli, senza la sezione
   degli esempi, e in più fa disegnare le forme che non ha fra quelle otto:
   si aggiungono in coda alle sue schede, uguali alle altre («Moon ·
   5.3 km», «Milano · 20 m away», con la mappa sotto la linea), con la
   scheda «Drawing…» per quella in corso. La città vi è chiamata come sulle
   schede del catalogo («Milano», non il «Milan» della ricerca). Senza una
   città scelta («Near me») non si disegna niente.

   **Da TASK-192** (ADR-0155, chiesto dall'utente: «premo su Caldonazzo e
   mi vengono fuori Levico … bisogna lavorare anche sul paese
   selezionato»): un percorso è **del luogo scelto** solo se parte entro
   1,5 km dal suo punto; gli altri, entro i 5 km, sono **dei vicini**. Un
   paese o una frazione accanto a una città con percorsi (Caldonazzo o
   Barco accanto a Levico) è come una città senza percorsi consigliati:
   prima la sezione «EXAMPLES IN CALDONAZZO» con cuore, cerchio e stella
   dal suo centro e poi le altre forme; sotto, l'etichetta **«NEAR
   CALDONAZZO»** e le schede dei vicini («Levico · 3.3 km away»), già lì
   mentre gli esempi si disegnano. In quel caso i disegni del feed
   nell'attesa non compaiono, e il credito della mappa resta uno solo. Una
   città con percorsi suoi mostra quelli e le forme aggiunte, poi, se ce
   ne sono, i vicini sotto la stessa etichetta. Con «Near me» resta una
   lista sola, senza etichetta.

   **Da TASK-236** (ADR-0200, chiesto dall'utente: «favorisci la sezione
   Near me con una sottocategoria con le città vicine a me … massimo
   quattro»): con «Near me», sotto la fila delle città c'è **«NEARBY
   TOWNS»**, una fila di schede da scorrere, fino a sei posti intorno
   alla partenza, dal più vicino: quattro paesi (i più grandi entro 20 km,
   o fino a 50 dove sono pochi) e i due posti più vicini di tutti, anche
   piccoli (da Caldonazzo: Tenna, Calceranica, Levico, Pergine, Trento,
   Borgo). Una scheda è larga il 42% della pagina: due intere e l'orlo
   della terza. Dice il nome e la distanza («Levico Terme», «2.9 km
   away»; da 10 km in su senza decimali) e mostra un campione disegnato
   nel paese, sulla sua mappa: il cuore, o il cerchio finché il cuore non
   c'è; prima, «2.9 km away · Drawing…» e il riquadro vuoto. Un tocco apre
   il paese come città scelta, e va fra le città recenti. Mentre la
   sezione è sulla pagina l'app fa disegnare al server cerchio, cuore e
   stella di ogni paese, uno alla volta: il paese si apre con le prime tre
   schede pronte. Il credito delle mappe resta uno: quello della pagina
   quando ha percorsi, altrimenti sotto la fila. Senza paesi intorno, o se
   l'API non risponde, la sezione non c'è. I testi, nelle cinque lingue:
   «NEARBY TOWNS», «{km} km away», «{town}, {km} km away» (VoiceOver).

   **Da TASK-163**, chiesto dall'utente: finché uno dei primi tre esempi è
   «Next» o «Drawing…», sotto «EXAMPLES IN …» c'è **«MEANWHILE, FROM THE FEED»**,
   con una riga che dice perché si aspetta (la prima volta in una città la
   mappa si scarica: fino a un minuto) e 5 disegni del feed d'esempio
   (TASK-156), uguali a come sono in «Feed». Partono da un punto del feed
   che dipende dalla città: città diverse, disegni diversi per primi.
   Arrivato l'ultimo esempio i disegni restano, e la riga dice «The shapes
   of this city are ready above.»; spariscono cambiando città. Una città
   con gli esempi già sul telefono non li mostra. «Ask for a route» resta
   in fondo, sotto i disegni.

   Le città in evidenza nella fila (New York, London, Paris, Tokyo, Rome,
   Milan, Torino, Barcelona, Dubai, Amsterdam, Lisbon, Sydney, San
   Francisco) hanno cuore, cerchio e stella da 5 km già nel catalogo
   (TASK-163): toccata la città, sono subito righe di «Best near you»,
   senza «Drawing…». Berlin non ancora: li disegna al tocco, come una città
   cercata.

   **Da TASK-145** ogni percorso di «Explore» aperto sulla mappa
   (consigliato, esempio, a tema) ha «Start», giallo, sopra «Export GPX».
   Questi percorsi arrivano senza indicazioni: al tocco l'app le chiede
   all'API (`POST /route-directions`) e il pulsante dice «Getting
   directions…»; poi la navigazione parte come per un percorso disegnato
   (sotto, «La navigazione»), lungo la linea di «Explore». «Stop» e la fine
   della corsa tornano alla sua scheda. Le indicazioni avute restano finché
   la scheda è aperta: un secondo «Start» non aspetta. Se non arrivano, la
   scheda dice perché in rosso e «Start» riprova; «Back to the list» o «←»
   lasciano perdere l'attesa.

   **Da TASK-151** un esempio di città aperto sulla mappa ha le tessere
   «A · B · C» (sotto, «Il risultato»), sopra «Start», quando l'API ha
   mandato delle alternative: A è il percorso del motore. Una tessera
   toccata diventa il percorso: km e somiglianza della scheda, la linea
   sulla mappa, «Start» e «Export GPX» sono i suoi. Mentre si aspettano le
   indicazioni la scelta resta ferma. Da TASK-155 gli altri percorsi sono
   linee grigie sulla mappa, sotto quello scelto, e spariscono durante la
   corsa. Un percorso consigliato o a tema è uno
   solo: niente tessere. Gli esempi salvati prima si ridisegnano una volta.

Passare da una schermata all'altra:

- «←» torna alla scelta con forma e distanza di prima. Se il percorso è
  ancora in calcolo, lo abbandona, come «Cancel».
- «Cancel» torna alla scelta. Una forma toccata dopo un problema anche.
- «Try N km» ridisegna restando sulla mappa.
- «Draw route» con forma, distanza e partenza di un percorso già disegnato
  lo mostra di nuovo, senza chiederlo di nuovo all'API.

La mappa resta caricata anche sotto la prima schermata: andare e tornare
non la ricarica. La scheda sta sotto la mappa, non sopra, così non copre
l'attribuzione; i margini seguono la tacca e la barra in basso di ogni
telefono.

## Le pagine: «Feed», «Draw», «Explore» (TASK-154, ADR-0124)

Tre pagine affiancate, scelta dell'utente: **«Feed»** a sinistra,
**«Draw»** al centro, **«Explore»** a destra. Si passa dall'una all'altra
con uno swipe a destra o a sinistra, oppure toccando il nome in alto. I tre
nomi stanno in alto a sinistra, nell'ordine in cui sono le pagine: dicono
dove porta lo swipe. Il nome della pagina sullo schermo è chiaro, con una
lineetta sotto; gli altri sono grigi. Niente giallo: è del percorso.

- L'app si apre su «Draw». Forma, parola, distanza e partenza restano come
  erano dopo un giro sulle altre pagine.
- **«Feed»** è la pagina dei disegni che gli iscritti pubblicano
  (TASK-118, ADR-0227; l'ordine è scelta dell'utente del 2026-10-07): con
  un account, appena la pagina è sullo schermo, legge dall'API i disegni
  che l'account può vedere, **i propri** prima, poi quelli **di chi
  segue**, poi **i vicini** (entro 50 km da dove parte «Draw»; tutti,
  senza posizione), dal più recente in ogni gruppo; tirando in giù si
  rilegge dall'alto, arrivati in fondo si caricano gli altri, venti alla
  volta. La scheda è quella degli esempi: nome di chi ha corso e luogo
  (senza luogo, solo il nome), la linea gialla sulla mappa, il titolo o,
  senza titolo, il giorno della corsa, e «Star · 4.0 km · 19 min»; una
  parola o il titolo del percorso al posto della forma, niente per una
  corsa senza percorso; in bici «Bike · …», in canoa «Paddle · …». **Un
  tocco apre il disegno intero sulla mappa**, con foto, racconto, tag,
  reazioni e commenti, come dal profilo (TASK-117, 119, 120); «←» torna
  a «Feed» com'era, senza rileggere, e «Profile» resta chiuso; se nel
  frattempo è sparito, sopra l'elenco: «This drawing is no longer
  public.». Mentre la prima pagina arriva, una rotella e niente altro.
  **Senza account, e finché nessuno ha pubblicato qualcosa che si può
  vedere** (o l'API non risponde, o è di prima del feed), mostra
  **quindici disegni di esempio**
  (TASK-156, ADR-0127, chiesto dall'utente). Niente sulla pagina dice che
  sono esempi: scelta dell'utente. Ogni scheda ha l'iniziale e il nome di
  chi ha corso, la
  città, il disegno in giallo a tutta larghezza, il titolo e una riga
  «Horse · 19.2 km · 1 h 41 min» (con «Miles», «Horse · 11.9 mi · 1 h 41
  min»: TASK-182). **Il punteggio non c'è**, né sopra il
  disegno né in quello che legge VoiceOver (TASK-241, ADR-0207, chiesto
  dall'utente). Sono le
  figure venute meglio nelle sette città del catalogo, due per città e
  nessuna forma più di due volte; corridori, titoli, tempi e punteggi sono
  inventati.
  **Fra i quindici ci sono quattro disegni fatti sull'acqua** (TASK-228,
  ADR-0190, chiesto dall'utente): sempre, qualunque sia lo sport scelto,
  il 3º, l'8º, il 13º e il 18º dei 19. Uno per luogo d'acqua di «Explore»
  con «Paddle», ognuno con la sua forma da 2 km: `greta_kayak` un cuore sul
  Lago di Garda, `leo.sup` una stella sul Lago di Como, `irene_onwater` una
  luna a Jesolo, `ale.paddle` una testa di cane a Riccione, con gli occhi
  staccati. La scheda è quella degli altri, con il luogo al posto della
  città e la mappa del lago o del mare sotto la linea; la riga dei fatti
  comincia con lo sport, «Paddle · Heart · 2.0 km · 26 min». Nomi, titoli,
  tempi e punteggi sono inventati; i percorsi sono gli esempi che l'app ha
  già per quei luoghi, disegnati dal motore sull'acqua vera. **Un disegno
  che il motore ha inclinato** (TASK-232, parte C) è girato dall'altra
  parte, linea e mappa sotto, così la figura si legge dritta: oggi i
  quattro sull'acqua (gli esempi nell'app dicono l'inclinazione); quelli
  delle corse la diranno quando la dirà il catalogo. Un tocco apre
  il percorso come un esempio di «Explore» con «Paddle», senza chiedere
  niente all'API: «on the water», «Start» con l'avviso della canoa, la
  linea senza indicazioni. Lo sport scelto non cambia.
  **Un tocco su una scheda apre il suo percorso** sulla mappa (TASK-188,
  ADR-0151, chiesto dall'utente), come un percorso di «Explore»: la stessa
  scheda con km, forma e città, «Start» per correrlo, «Export GPX», e il
  cuore dei preferiti in alto a destra. «←» e «Back to the list» tornano a
  «Feed». Il percorso è quello del catalogo da cui il disegno è nato: se
  nel catalogo non c'è più, la scheda dice «The route could not load. Try
  again.» e non mostra un altro percorso al suo posto. Un dito che scorre
  sopra una scheda non la apre. I disegni veri (TASK-118) non aprono un
  percorso: aprono il disegno, con reazioni e commenti; il profilo di chi
  ha corso si raggiunge da «Find friends» o dai nomi taggati. Su un
  disegno vero di un altro, il «…» a destra del nome segnala il disegno o
  blocca chi l'ha corso (TASK-121, sotto in «Profile», «Segnalare e
  bloccare»).
  **In cima, sopra i disegni, a destra, la lente** (TASK-215, ADR-0178;
  TASK-219, ADR-0182: solo la lente, scelta dell'utente): un cerchio come
  quello di «Profile», con una lente disegnata e nessun testo, sotto il
  bottone di «Profile»; VoiceOver lo legge «Find friends». Non sta
  nell'intestazione delle pagine: lì, accanto a sport e profilo, su un
  iPhone da 390 pt non c'è posto. Scorre con l'elenco. Apre
  sopra l'app, come «Profile», la pagina **«Find friends»**: «←», un campo
  «Name» con la tastiera già aperta e, sotto, gli iscritti trovati, al più
  20, ognuno con la foto (o l'iniziale) e il nome; mai l'email. La ricerca
  parte con 2 lettere, 300 ms dopo l'ultima, o subito con il tasto «cerca»
  della tastiera; sotto le 2 lettere la pagina dice «Type at least 2
  letters of a name.», mentre cerca «Searching…», senza nessuno «Nobody has
  a name like that.». Si cerca fra tutti gli iscritti: la lista dei nomi è
  visibile a chiunque ha un account (TASK-211). Un nome toccato apre il suo
  profilo (sotto, «Il profilo di un altro iscritto») con il titolo
  «Profile»; «←» torna ai nomi trovati, con il campo com'era, e un altro «←»
  a «Feed». Un disegno aperto da quel profilo, chiuso, torna al profilo.
  **Senza account** il tasto apre «Profile» con «Log in to find your
  friends.» sopra «Sign up». Un server senza la ricerca (prima della
  migrazione `0011`) fa dire «This server cannot look for members yet.».
  Sul profilo c'è il tasto «Follow» (TASK-211, sotto).
  **Sotto ogni linea c'è la mappa** della zona (TASK-162, ADR-0131,
  chiesto dall'utente): strade, acqua, verde e nomi dei paesi, con lo
  stile dell'app. È una foto, non una mappa da muovere: la fa una pagina
  MapLibre che l'elenco copre, una mappa alla volta, inquadrata come la
  linea; finché non arriva la scheda è la linea sul fondo scuro, e senza
  rete resta così. In basso a destra di ogni mappa il credito,
  «OpenFreeMap © OpenMapTiles / Data from OpenStreetMap», in due
  righe. Le foto fatte restano finché l'app è aperta.
- **«Explore»** chiede i suoi percorsi all'API la prima volta che ci si
  arriva, non all'apertura dell'app; tornandoci l'elenco è ancora lì. Non
  ha più «←»: per tornare c'è lo swipe, o il nome «Draw».
- La mappa, la corsa e la sua fine prendono tutto lo schermo: lì i nomi e
  lo swipe non ci sono. «←» da un percorso di «Explore» torna sulla pagina
  «Explore», da un disegno di «Feed» su «Feed» (TASK-188), da un percorso
  disegnato su «Draw».
- Uno swipe chiude la tastiera.
- Una pagina fuori dallo schermo non la legge nemmeno VoiceOver.
- **Da provare con il dito**: lo swipe stesso, e le righe che scorrono di
  lato dentro una pagina (le tessere delle forme, le città). L'attesa è
  che la riga scorra lei e che lo swipe fra le pagine parta da fuori; su
  Android non è stato provato niente.

## «Profile» (TASK-115, ADR-0125; TASK-154; TASK-177, ADR-0145; TASK-178, ADR-0146; TASK-116, ADR-0128)

In alto a destra, accanto ai nomi delle pagine, un pulsante tondo apre
**«Profile»**, l'account: mostra la foto di chi è entrato, o la sua
iniziale se non ne ha messa una, o una figura quando non c'è nessuno. «Profile» si apre sopra l'app e si chiude
con «←»: sotto, forma, distanza e mappa restano come erano. Sulla mappa e
durante la corsa il pulsante non c'è.

**Lo sport** (TASK-205, ADR-0165, chiesto dall'utente): a sinistra del
profilo un pulsante tondo uguale mostra l'emoji dello sport scelto (🏃‍♂️
«Run», 🚴 «Bike», 🛶 «Paddle» dal TASK-191). Toccato apre sotto di sé un
piccolo menu con gli sport di «Settings»: lo scelto con il «✓»; uno sport
non ancora pronto avrebbe «Soon» e non si toccherebbe.
Un tocco su uno sport lo sceglie e chiude il menu; un tocco fuori lo chiude
senza cambiare niente. È la stessa scelta della sezione «Sport» di
«Settings» (sotto): cambiata in un posto, cambia anche nell'altro, e
«Draw» la segue subito. Dove non c'è il profilo non c'è nemmeno lo sport.

**«Profile» senza account**: «Sign up» e «Log in», due pulsanti affiancati.
«Sign up» chiede email, nome (da 3 a 20 fra lettere, cifre, `_` e `.`),
password (almeno 8 caratteri) e la casella «I am at least 16» (ADR-0114);
«Log in» email e password. I campi si controllano prima di partire, con le
regole dell'API, e l'errore si dice in parole sotto il pulsante (sotto,
«Quando non va»). Si apre su «Sign up»; dopo «Log out» o una sessione
finita, su «Log in».

**«Profile» con l'account** (TASK-177, ADR-0145): in alto un cerchio con
la foto o l'iniziale, il nome, l'email e, se c'è, la bio (TASK-116); poi
il pulsante **«Edit profile»** (sotto). Il cerchio ha in basso a destra un
tondo bianco con il **«+»** scuro, con o senza foto (TASK-207, scelto
dall'utente): un tocco sul cerchio apre sotto la bio, sopra «Edit
profile» e in un riquadro che le separa da lui, le stesse scelte di
«Profile picture» in «Settings» (sotto), e un altro tocco le richiude; lì si leggono anche «Saving…», «Removing…» e
gli errori, e mentre la foto va all'API il cerchio non si tocca. Per
VoiceOver il cerchio si chiama «Profile picture», come la riga: nessun
testo nuovo (ADR-0168, che riusa ADR-0146). Il profilo di un altro non ha
il «+». Sotto, due riquadri affiancati: **«Favorites»**
con un cuore (❤️) e **«My activities»** con l'uomo che corre (🏃‍♂️), ognuno
con il suo numero in grande (un trattino finché l'elenco non è arrivato);
aprono le loro pagine (sotto, «Favorites» e «My activities»). Poi la riga
**«Settings»** (⚙️). Le emoji sono l'unico colore che non viene dai token;
nessun pulsante dell'account è giallo.

**«Drawings»** (TASK-117, ADR-0159, ADR-0166; il codice dei disegni sta
nella cartella nuova `src/social/`), in fondo a «Profile»: le corse che
l'account ha reso pubbliche, come le vedono gli altri, dalla
più recente, tre per riga. Ognuna è la traccia senza i primi e gli ultimi
200 m, piccola e gialla come i disegni di «Feed», **senza punteggio**
(TASK-241 parte E, chiesto dall'utente); venti per volta, poi «Show more».
Vuota: «No public drawings yet. Make a run public in My activities.».
Non arrivata: il motivo e «Try again». **Un disegno toccato si apre sulla
mappa**, come una corsa di «My activities»: «Profile» si toglie, la mappa
si inquadra sulla linea gialla (nessun segnaposto di partenza, nessuna
linea bianca) e sotto c'è la sua scheda: il titolo (senza titolo, il
giorno), il giorno, l'attività e i km («Run · 4.0 km»), mai il punteggio
né l'ora; poi, da TASK-208, **le foto** (alte 160 punti, da scorrere di
lato, lette dall'API con il token), **com'è andata** (la descrizione) e
**i nomi taggati** in pillole, ognuna delle quali apre il profilo di quella
persona sopra l'app; un disegno di un'API senza questi campi si vede come
prima. **«Back to the profile»** e «←» tornano a «Profile». Se nel
frattempo è tornato privato: «This drawing is no longer public.» sopra la
griglia.

**I commenti di un disegno** (TASK-120, ADR-0175, scelta dell'utente del
2026-10-03: subito sotto le corse vere, non sugli esempi di «Feed»): nella
scheda di un disegno aperto, fra i numeri e «Back to the profile», un
pulsante neutro dice quanti sono: «Write a comment», «1 comment», «4
comments» («Comments» finché il numero non arriva). Senza account, o con
un'API senza commenti, il pulsante non c'è. Il tocco apre un **foglio dal
basso** sopra la mappa (circa tre quarti dello schermo; un tocco sopra il
foglio o «Close» lo chiude): «Comments», l'elenco **dal più vecchio**
(la foto o l'iniziale di chi ha scritto, il nome, quanto tempo fa, «just
now», «5 min ago», «3 h ago», «2 d ago», poi il giorno; e il testo), venti
per volta con «Show more comments» in fondo; vuoto «No comments yet. Be
the first.»; mentre arriva «Loading the comments…»; non arrivato il motivo
e «Try again». In fondo, **sopra la tastiera**, il campo «Add a comment…»
(anche su più righe) e **«Post»**, spento finché il campo è vuoto o
supera i 500 caratteri; da 450 compare il conto, «460/500», rosso oltre.
Mandato, il campo si svuota e il commento compare in fondo. Rifiutato, il
campo resta com'è e sopra c'è il motivo dell'API (troppi in un minuto,
vuoto, troppo lungo); senza rete «No connection. Try again when you are
online.». **Tenere premuto** un commento che si può cancellare (il proprio,
o qualsiasi sotto il proprio disegno) chiede «Delete this comment?» con
«Cancel» e «Delete»; per VoiceOver è l'azione «Delete» della riga. **Il
testo è sempre solo testo**: un link non si tocca, un tag HTML si legge
com'è scritto, e il commento non entra mai nella WebView della mappa.

**Le reazioni di un disegno** (TASK-119, ADR-0193, scelte dell'utente del
2026-10-04): nella scheda di un disegno aperto, **sulla riga del pulsante
dei commenti, alla sua sinistra**, un pulsante tondo neutro con la propria
reazione (senza, una faccina 🙂 spenta: «React» per VoiceOver, poi «Your
reaction: Fire»), poi **le tre più usate** (a pari numero, l'ordine della
barra) e **il totale** («7»; per VoiceOver «7 reactions»); senza reazioni
solo il pulsante. Senza account, con un'API senza reazioni o se non
arrivano, la riga ha solo i commenti, com'era. **Il tocco sul pulsante
apre la barra delle sei** sopra la riga (un altro tocco la chiude): il
cuore di Sgrava sul suo quadrato giallo (`HeartBadge`), 🔥 👏 💪 😂 😮, la
propria con un bordo chiaro; per VoiceOver «Sgrava heart, super like»,
«Fire», «Clap», «Strong», «Laugh», «Wow». **Una a testa**: un'emoji scelta
si vede **subito** e prende il posto della propria; la propria toccata di
nuovo la toglie; una per volta (finché l'API non risponde un'altra scelta
non parte). Se l'API non la tiene (senza rete, troppe in un minuto) **torna
com'era** e sotto la riga c'è «Your reaction wasn't saved. Check the
connection.», che va via alla scelta dopo. **Il cuore di Sgrava è il super
like**: si mette con **un doppio tocco sulla mappa del disegno aperto**, o
dal cuore nella barra (così anche con VoiceOver). Compare **il cuore
grande** (128 pt, sul giallo) sopra il disegno e, dal basso sopra la
tastiera, il foglio **«Super like»**: il campo «Write a comment to send
your super like», sotto «At least 2 characters» finché mancano, «Cancel» e
**«Send»**, spento sotto i 2 caratteri (senza gli spazi ai lati) e oltre i
500 (da 450 il conto, come nei commenti). **Non conta prima che l'API lo
tenga** con il suo commento: mandato, il foglio si chiude, il cuore è la
propria reazione e il pulsante dei commenti ne conta uno in più.
«Cancel», o un tocco sopra il foglio, **non lascia niente**. Un commento
negativo: l'avviso di ADR-0176 («You can't write negative comments in this
app. Try another app.»), il foglio resta con le parole da cambiare, niente
super like; senza rete il motivo nel foglio («No connection. Try again when
you are online.»). **Con il super like già messo** il doppio tocco mostra
il cuore grande per un attimo (0,9 s) e non cambia niente; il proprio cuore
toccato nella barra lo toglie, e il commento resta. **Su un disegno aperto
il doppio tocco non fa lo zoom** della mappa (le due dita sì); altrove la
mappa è quella di prima.

**«Settings»**, una pagina di «Profile» («←» torna a «Profile»), a sezioni:

- **«Account»**: nome ed email; poi **«Profile picture»** (TASK-178,
  sotto); poi **«Change email»** e **«Phone number»** (TASK-183, sotto).
- **«Sport»** (TASK-189, ADR-0152): per cosa sono i percorsi. Tre righe:
  «Run» (🏃‍♂️), scelto all'inizio, con un «✓» bianco; «Bike» (🚴), che
  si sceglie dal TASK-190; «Paddle» (🛶: canoa, kayak, SUP, nome scelto
  dall'utente), che si sceglie dal TASK-191 (sotto, «Sull'acqua»). Uno
  sport pronto si sceglie con un tocco, qui o dal pulsante accanto al
  profilo (TASK-205, sopra); la scelta resta sul telefono, non
  nell'account, e vale subito, senza riaprire l'app. **Con «Bike»** cambia
  solo «Draw» (sotto, «Forma e distanza»): percorsi su strade da bici, da
  10 a 30 km. «Explore», «Feed» e la schermata della corsa restano quelli
  della corsa: cosa mostrano con la bici è una scelta dell'utente ancora
  aperta (`tasks/TASK-190.md`, «Domande aperte»). **Con «Paddle»** cambiano
  «Draw», «Start» ed «Explore» (sotto, «Sull'acqua»), e dal TASK-251 i
  numeri della schermata della corsa (sotto, «Velocità e andatura»);
  «Feed» resta quello della corsa. I quattro disegni sull'acqua di
  «Feed» (TASK-228, sopra) ci sono con ogni sport.
- **«Strava»** (TASK-187), solo se l'API ha Strava: «Connect with
  Strava» (il pulsante ufficiale di Strava, TASK-218, come a fine corsa)
  con «Send the runs you save in Sgrava to your Strava
  profile.»; collegato, «Connected as Ada Lovelace» e «Disconnect Strava»,
  in rosso, che chiede prima: «Disconnect Strava? Runs already sent stay
  on Strava.», con «Keep it» e «Disconnect».
- **«Preferences»**: **«Language»** (🌐, TASK-210, ADR-0172), con in
  fondo la lingua in cui è l'app; un tocco apre sotto la riga «Phone
  language» (con accanto la lingua del telefono) e «English», «Deutsch»,
  «Italiano», «Español», «Français», ognuna nel suo nome e letta da
  VoiceOver nella sua lingua, con il «✓» bianco sulla scelta. La scelta
  chiude la lista, vale subito per tutta l'app senza chiudere niente e
  resta sul telefono, come lo sport; «Phone language» torna a seguire il
  telefono. Poi **«Offline maps»** (🗺️, TASK-214, ADR-0177): «Offline
  maps: 1.2 GB», lo spazio delle mappe che il telefono tiene per disegnare
  da sé, con «Delete» in fondo alla riga quando ce ne sono; sotto, piccolo
  e grigio, «Maps download on Wi-Fi and mobile data.». «Delete» cancella
  subito, senza chiedere: le mappe tornano alla prossima apertura, con la
  riga sopra «Draw route». Il numero cresce anche da solo: dopo la zona
  intorno, il telefono scarica piano piano quelle dei paesi vicini e
  delle città di «Explore», senza avvisi (TASK-214, parte B2). Poi
  **«Units»** (📏, TASK-182, ADR-0149), con in fondo l'unità in cui è
  l'app («Kilometres» o «Miles»); un tocco apre sotto la riga «Phone
  units» (con accanto l'unità del telefono), «Kilometres» e «Miles», con
  il «✓» bianco sulla scelta, come «Language». La scelta chiude la lista,
  vale subito e resta sul telefono; «Phone units», la partenza di chi non
  ha mai scelto, segue il telefono: miglia dove il telefono misura le
  strade in miglia (Stati Uniti, Regno Unito, o il sistema di misura
  scelto a mano in iOS), km altrove e quando il telefono non lo dice.
  **Con le miglia** tutta l'app scrive e dice miglia: «My activities»
  («2.49 mi · 19:00 · 7:38 /mi»), i preferiti («Star · 3.2 mi»), le
  schede di «Explore» («0.4 mi away», sotto i 1000 piedi «650 ft away»),
  «Draw» e il suo risultato (sotto, «Forma e distanza» e «Il risultato»),
  i post del «Feed», i disegni pubblici, «Explore» con «Paddle», la corsa
  e la sua fine, la voce (sotto, «La navigazione»), il post di «Share»
  («3.23 mi · 28:10 · 8:43 /mi»). Restano in km, perché sono limiti del
  motore detti così: «Shapes to paddle, within 1 km of the shore» e
  l'avviso di sicurezza sull'acqua. Con «Kilometres» niente cambia. Il
  GPX, l'API e il motore restano in metri.
  **«Notifications»**: «Email
  notifications» e «Push notifications», due interruttori salvati
  nell'account (TASK-185, ADR-0206, sotto). **«About»**: «Help»,
  «Terms», «Privacy», tre righe con «›» in fondo: ognuna apre il suo
  testo come pagina (TASK-184, ADR-0205, sotto).
- In fondo **«Log out»** e **«Delete account»**, in rosso, che chiede prima
  sulla schermata stessa: «Delete my account» o «Keep my account».

Nessuna voce di «Settings» dice più «Soon»: le ultime due erano le
notifiche (TASK-185).
Usciti dall'account da «Settings», chi rientra trova
«Profile».

**«Notifications»** (TASK-185, ADR-0206): due righe in un riquadro, «Email
notifications» (📧) e «Push notifications» (🔔), ognuna con il suo
interruttore in fondo, disegnato come quelli della corsa (una pista con il
pomello a destra e bianca quando è acceso; mai gialla). **Tutti e due
spenti** finché non si accendono (scelta dell'utente). Sotto il riquadro,
piccolo e grigio come la nota di «Offline maps», sempre: «Push
notifications tell you about follow requests, reactions, comments and
tags. MuW does not send emails yet: your choice is kept for when it
does.» (TASK-262). **Le push partono, l'email no** (fino alla parte B di
TASK-262).

- **Accendere «Push notifications» chiede il permesso al telefono**, qui
  e in nessun altro posto, mai all'avvio (TASK-262, ADR-0226). Mentre il
  telefono chiede, l'interruttore è già acceso e occupato. Permesso dato:
  la scelta va all'API, e il telefono manda il suo token (una volta, e di
  nuovo solo per un altro account, un altro token o un'altra lingua
  dell'app). Negato, o negato prima: l'interruttore torna spento e sotto
  la nota, in rosso, «Notifications are off for MuW on this phone. Allow
  them in Settings to turn this on.», con «Open Settings» (TASK-259).
  Spegnere, ed «Email notifications», non chiedono niente al telefono.
- Spento l'interruttore, o usciti dall'account, il telefono riprende il
  suo token dall'API e non riceve più.
- **Toccare una notifica** apre il disegno (una reazione, un commento, un
  tag) sulla mappa, come dal «Feed», o il profilo di chi ha chiesto o
  accettato di seguire, come da «Find friends»; anche quando è la
  notifica ad aprire l'app. Senza account non apre niente. Con l'app
  aperta una notifica arriva come banner, senza suono.
- **In Expo Go le push non arrivano** (dall'SDK 53): l'interruttore si
  accende, il token non viene e niente lo dice. Si provano con una build
  dell'app.

- Un tocco su una riga gira il suo interruttore **subito** e manda all'API
  solo quello; se l'API rifiuta torna com'era, e sotto la nota, in rosso,
  c'è il motivo. Il tocco dopo toglie il motivo.
- Mentre una risposta è in viaggio un secondo tocco, su una qualunque
  delle due righe, non manda niente.
- Per VoiceOver ogni riga è un interruttore con il suo nome («Email
  notifications», acceso o spento); l'emoji non si legge.

| Cosa succede | Cosa dice, sotto la nota |
|---|---|
| API di prima di TASK-185 | Notifications are not available on this API yet. |
| senza rete | Cannot reach the API at {url}. Check the connection and try again. |
| sessione finita | Your session has ended. Log in again. (e si esce) |

**«Help», «Terms», «Privacy»** (❓ 📄 🔒, TASK-184, ADR-0205): un tocco
apre il testo sopra «Settings», a tutto schermo: «←», il nome della riga
come titolo, poi il nome del testo e le sue sezioni, ognuna sotto il suo
titolo, con paragrafi ed elenchi a punti. La pagina scorre da sola; «←»
torna a «Settings» **com'era**, nel punto in cui era e con le righe
aperte ancora aperte (resta montata sotto, nascosta anche a VoiceOver).
Per VoiceOver i titoli sono intestazioni.

- **«Help»** è la mini guida, «How Sgrava works»: undici sezioni brevi
  (che cos'è, disegnare un percorso, «Explore», correre, tenere corse e
  percorsi, pubblicare e condividere, «Feed» e amici, i tre sport con
  l'avviso dell'acqua, «Settings», l'account, a chi scrivere). Dice le
  cose con le parole del sito (`site/content.js`).
- **«Terms»** («Terms of use») e **«Privacy»** («Privacy policy») sono
  **bozze**, e lo dicono prima di tutto: un riquadro in cima, bordo e
  scritta arancio (`warning`, non il giallo del percorso), «Draft — not
  final yet.» e sotto, grigio, «Last updated: 5 October 2026». Restano
  bozze finché l'utente non le approva (`draft` in
  `src/about/content/`).
- **Quello che è ancora da riempire è scritto fra parentesi quadre** e
  spicca in arancio: `[name]` (chi gestisce Sgrava), `[contact email]`,
  `[governing law]` in «Terms», le basi giuridiche in «Privacy». Uguali in
  tutte le lingue. Li riempie l'utente; nel codice non c'è nessun nome né
  indirizzo vero.
- **Le lingue**: i testi sono in inglese e in italiano, e seguono la
  lingua dell'app; con tedesco, spagnolo e francese sono in inglese (e
  VoiceOver li legge in inglese), mentre il titolo della riga e il
  riquadro della bozza sono nella lingua dell'app. Nel testo italiano i
  nomi di pagine e pulsanti sono quelli che l'app in italiano mostra oggi.
- «Privacy» dice solo quello che fa l'app oggi («Cosa esce dal telefono»,
  sotto, e `DATABASE.md`): quando cambia cosa l'app manda o tiene, cambia
  anche `src/about/content/`. I punti ancora aperti sono in
  `tasks/TASK-184.md`, «Esito».
- **Dal 2026-10-08 «Privacy» è definitiva** (TASK-237 D, scelte
  dell'utente): niente riquadro della bozza né parentesi quadre; in cima,
  grigio, solo «Last updated: 8 October 2026» (nelle cinque lingue). Il
  titolare è Luca Pallaoro e l'indirizzo muw2610@gmail.com. «Terms»
  resta una bozza come descritto sopra. Lo stesso testo è sul sito,
  `getmuw.app/privacy/` (`SITO.md`).

**«Change email»** (✉️, TASK-183, ADR-0150): un tocco apre sotto la riga
«NEW EMAIL» e «PASSWORD» (la password dell'account, nascosta) e «Save»; un
altro tocco richiude e dimentica quello che era scritto. Salvata, la riga
si chiude e il riquadro del nome in cima mostra il nuovo indirizzo: vale
subito, senza mail di conferma, e da lì in poi si entra con quello. Il
telefono resta dentro.

**«Phone number»** (📱, TASK-183): in fondo alla riga il numero
dell'account, come lo tiene l'API («+393331234567»), o «Add». Un tocco
apre sotto la riga «PHONE NUMBER» (con il numero di adesso; l'esempio
grigio è «+39 333 123 4567»), la frase «Only you see your number. Friends
who already have it will be able to find you on Sgrava.», «Save» e, se un
numero c'è, «Remove number» in rosso. Il numero si scrive con il prefisso
del paese, spaziato come si vuole; salvare il campo vuoto lo toglie; lo
stesso numero di prima non chiede niente all'API. La ricerca degli amici
dalla rubrica non c'è ancora (ADR-0150).

| Cosa succede | Cosa dice, sotto «Save» |
|---|---|
| email non valida | Enter an email address, like name@example.com. |
| l'email di adesso | This is already the email of your account. |
| password non scritta | Enter your password. |
| password sbagliata | Wrong password. |
| troppe password sbagliate | Too many tries. Wait {minutes} minutes and try again. |
| email di un altro account | Another account has this email. |
| numero senza prefisso o non valido | Write the number with its country code, like +39 333 123 4567. |
| API di prima di TASK-183 | Changing the email is not available on this API yet. / The phone number is not available on this API yet. |

Con un errore i campi tengono quello che era scritto. Mentre salva il
pulsante dice «Saving…» («Removing…» per «Remove number») e un secondo
tocco non manda niente.

**«Profile picture»** (TASK-178, ADR-0146): una riga con 📷, il nome e, in
fondo, la foto in piccolo (o l'iniziale). Un tocco apre sotto la riga
«Choose a picture» (la libreria del telefono), «Take a photo» (la
fotocamera, che chiede il permesso la prima volta) e, se c'è una foto,
«Remove picture»; un altro tocco li richiude. La foto si ritaglia al
quadrato nell'editor del telefono; l'API la raddrizza, la riduce a 256 px
e ne tiene solo quel quadrato, senza i dati dello scatto (la posizione). Mentre
la manda la riga dice «Saving…» (o «Removing…») e non si tocca; fatto, la
foto è nella riga, nel cerchio di «Profile» e nel pulsante in alto. Riaperta
l'app, la foto si chiede all'API (`GET /me/photo`): per un attimo, o senza
rete, si vede l'iniziale. Gli errori si dicono sotto la riga, e la foto di
prima resta:

| Quando | Cosa dice |
|---|---|
| fotocamera negata | The camera is off for this app. Allow it in Settings, or choose a picture instead. + «Open Settings» (TASK-259) |
| foto oltre 10 MB | This picture is too large. Choose a smaller one. |
| il selettore non si apre | Could not open the picture. Try again. |
| l'API non legge l'immagine | This picture cannot be used. Choose another one. |
| un'API senza le foto (non ancora aggiornata) | Profile pictures are not available on this API yet. |
| API irraggiungibile, sessione finita… | come l'account (sotto) |

Chiuso il selettore senza scegliere non si dice niente.

**«Edit profile»** (TASK-116, ADR-0128; testi **da confermare con
l'utente**): una pagina di «Profile» («←» torna a «Profile» senza salvare)
con due campi, **«USERNAME»** (segnaposto «3 to 20 letters, digits, _ or
.») e **«BIO»** (segnaposto «A few words about you», su più righe, con il
conto «12/160» sotto, rosso oltre 160), e il pulsante **«Save»** («Saving…»
mentre va, e non si tocca). I campi partono dal nome e dalla bio di oggi;
si manda solo quello che cambia, e se non cambia niente «Save» torna
indietro senza chiedere. Salvato, si torna a «Profile», che li mostra
subito, come «Settings» e il pulsante in alto (l'iniziale); riaperta l'app,
ci sono ancora. La foto resta in «Settings». Gli errori si dicono sotto
«Save», e i campi tengono quello che è stato scritto:

| Quando | Cosa dice |
|---|---|
| nome fuori regola (prima di chiedere, e dall'API) | A username is 3 to 20 letters, digits, _ or . (no spaces). |
| bio oltre 160 caratteri | A bio is at most 160 characters. |
| nome di un altro account | This username is taken. Try another one. |
| un'API senza profili (il server di oggi, non ancora aggiornato) | Editing the profile is not available on this API yet. |
| API irraggiungibile, sessione finita… | come l'account (sotto) |

**Il profilo di un altro iscritto**, in sola lettura (TASK-116; testi
**da confermare**): la foto o l'iniziale, il nome, «12 drawings» (i
disegni pubblicati, TASK-117) e la bio; mai l'email. Sotto, **«Drawings»**
come in «Profile» (sopra), vuota «No drawings yet.»; un disegno toccato si
apre sulla mappa. Mentre arriva dice «Loading the profile…»; un profilo che
non c'è, o un'API senza profili, «This profile is not available.»; senza
account «Log in to see the profiles of the others.». **Ci si arriva da
«Find friends»**, la lente in cima a «Feed» (TASK-215, ADR-0178, sopra), e
dagli elenchi di chi segue in «Profile» (sotto); altri
ingressi (un like, un commento) li decide l'utente
(`tasks/TASK-116.md`, «Esito»).

**Seguire** (TASK-211, ADR-0173 e ADR-0199; testi **da confermare**). La
riga sotto il nome di un altro dice anche chi lo segue: «12 drawings · 3
followers · 5 following». Sotto l'intestazione, un tasto largo:

| Stato | Tasto | Toccato |
|---|---|---|
| non lo segui | **«Follow»**, bianco | manda la richiesta: l'altro accetta o rifiuta |
| hai chiesto | «Requested», neutro | ritira la richiesta, subito |
| lo segui | «Following», neutro | chiede «Stop following {name}?» con «Keep it» e «Unfollow» |

Una richiesta rifiutata rimette «Follow»: niente dice che è stata
rifiutata. Se la richiesta non parte, il tasto resta com'era e sotto dice
perché. Sul proprio profilo il tasto non c'è.

**In «Profile»**, sotto «Edit profile», tre riquadri con un numero:
**«Requests»**, **«Followers»**, **«Following»** (un trattino finché non
arrivano). Uno toccato apre sotto il suo elenco, toccato di nuovo lo
richiude. «Requests» ha un pallino rosso (`badge`) quando qualcuno
aspetta, e in quel caso il suo elenco è **già aperto** quando «Profile»
si apre (TASK-239). Ogni riga ha la foto (o l'iniziale) e il nome, che
toccato apre il profilo di quella persona sopra l'app; «←» torna a
«Profile».

**Il numero rosso** (TASK-239, ADR-0203; chiesto dall'utente, testi
**confermati** il 2026-10-05). Quando qualcuno chiede di seguirti, il pulsante di
«Profile» in alto a destra nelle pagine ha un tondo rosso col numero
delle richieste in attesa («9+» oltre nove), sopra il suo angolo in alto a
destra; VoiceOver dice «Profile, 2 follow requests». L'app lo chiede
all'apertura, ogni minuto mentre è sullo schermo e quando ci torna: una
richiesta nuova si vede da sola, senza aprire «Profile». Sparisce quando
ogni richiesta ha avuto «Accept» o «Decline»: guardarle non basta. Ad app
chiusa non arriva niente: le notifiche del telefono non ci sono ancora
(TASK-185 salva la scelta in «Settings»; le push partono con TASK-262, l'email con la sua parte B).

| Elenco | Tasti della riga | Vuoto |
|---|---|---|
| «Requests» | «Accept» (bianco), «Decline»; accettata: «Follow back» (bianco) | Nobody is asking to follow you. |
| «Followers» | «Remove», che chiede «Remove {name} from your followers?» con «Keep it» e «Remove» | Nobody follows you yet. |
| «Following» | nessuno: si smette dal profilo | You are not following anyone yet. Find friends from Feed. |

Accettata, la persona passa subito in «Followers» e **resta nella sua
riga** di «Requests» finché «Profile» è aperto (TASK-239): al posto dei due
tasti c'è **«Follow back»**, che manda la tua richiesta e diventa la
scritta «Requested» (o «Following», se l'altro ti aveva già accettato). Se
lo segui già, o hai già chiesto, la riga lo dice subito e il tasto non
c'è. Venti per volta, poi «Show more». Con un server senza gli elenchi i tre riquadri non ci sono.

**Segnalare e bloccare** (TASK-121, ADR-0228; testi **confermati dall'utente** il 2026-10-09).
Sulla scheda di un disegno di un altro in «Feed», a destra del nome, e sul
profilo di un altro, a destra sotto «Follow», un **«…»** grigio (VoiceOver:
«More», «Report or block»). Non c'è sui propri disegni, sul proprio
profilo, sugli esempi né senza account. Toccato, apre in basso un
foglio con due tasti e «Cancel»:

| Tasto | Cosa fa |
|---|---|
| «Report» | chiede «Why are you reporting this?» con cinque tasti: «Spam», «Offensive or hateful», «Harassment or bullying», «Nudity or sexual content», «Something else»; toccato uno, «Sending…», poi «Thanks for telling us. We will look at it.» e «Close». Dal feed segnala il disegno, dal profilo la persona |
| «Block {name}», rosso | chiede «Block {name}?» con «You will not see each other's drawings, comments or profile, and any follow between you ends. They are not told.», il tasto rosso «Block» e «Cancel» |

Bloccato, il foglio si chiude da solo: **le schede di quella persona
spariscono subito da «Feed»**, e alla lettura dopo l'API non le manda più;
il suo profilo dice «You blocked {name}. Unblock them from Blocked people in
your profile.»; gli elenchi di chi segue in «Profile» si rileggono (il
blocco chiude ogni follow). Se la richiesta non va, il foglio dice perché
(«This is not available any more.» per un'API di prima o una persona
sparita). In «Profile», sotto «Settings», la riga **«Blocked people»**:
toccata apre sotto l'elenco dei bloccati, l'ultimo per primo, con foto e
nome e il tasto **«Unblock»** (VoiceOver: «Unblock {name}»); vuoto, «You
have not blocked anyone.»; venti per volta, poi «Show more». Sbloccato,
esce dall'elenco e torna in «Feed» alla lettura dopo; il follow non
torna. Un profilo bloccato non si apre dall'elenco.

- **Chiusa e riaperta**, l'app è già dentro: la sessione sta nel
  portachiavi del telefono. All'apertura chiede all'API (`GET /me`) se vale
  ancora; senza rete resta dentro.
- **Sessione finita** (90 giorni senza uso, o chiusa altrove), all'apertura
  o a una richiesta: l'app esce da sola, il pulsante di «Profile» ha un
  pallino arancio e «Profile» dice «Your session has ended. Log in
  again.». «Draw» va come prima.
- **«Log out»**, in «Settings», esce subito, anche senza rete, e dice «You
  are logged out on this phone.».
- **«Delete account»**, in «Settings», esce solo con il sì dell'API; se
  l'API non risponde l'account resta e la pagina dice perché. Fatto, dice «Your account and
  everything that was yours have been deleted.» e torna a «Sign up».
- **Senza account** si disegna, si esplora e si corre come prima: il token
  lo vogliono solo l'account, i preferiti e le corse salvate.

## «Favorites» (TASK-171, ADR-0139)

Un percorso che piace si tiene, e si ritrova in «Profile» da ogni telefono
dell'account.

- **Il cuore sulla mappa**: quando sulla mappa c'è un percorso (disegnato in
  «Draw», di «Explore», a tema), in alto a destra, di fronte a «←» e alla
  sua altezza (dal TASK-175 la mappa non ha più i pulsanti dello zoom), c'è un cuore tondo come «←». Vuoto («♡»): il tocco tiene il percorso; pieno
  («♥»): lo toglie. Cambia subito, senza aspettare l'API; se l'API rifiuta
  torna com'era e sotto il cuore c'è il motivo in una riga, che un tocco
  chiude. Non è giallo: il giallo è del percorso. Durante l'attesa, la
  corsa e la fine della corsa il cuore non c'è.
- **Fra tre percorsi (A · B · C)** il cuore è di quello scelto: ognuno è un
  preferito a sé.
- **Senza account** il tocco apre «Profile» con la riga «Sign up or log in
  to keep your favorite routes.» sopra il modulo; appena si entra il
  percorso è tenuto. Chiuso «Profile» senza entrare, non si tiene niente.
- **La pagina «Favorites»**, da «Profile»: i preferiti come le schede di
  «Explore», due per riga, dal più recente: il disegno, «Star · 5.1 km», la
  somiglianza in un angolo, e sotto la città («Trento») o, per un percorso
  disegnato dal GPS, il giorno («Kept 2 Oct 2026»). Il titolo è la parola,
  o il tema di un percorso a tema, o la forma; un percorso da una foto è
  «Image». Il cuore nell'altro angolo del disegno toglie il preferito
  dall'elenco, subito. **Un preferito dalla forma inclinata** (TASK-232,
  parte C) ha la scheda girata come in «Explore», e si apre con la mappa
  girata e la freccia del nord; quelli tenuti prima restano col nord in
  alto.
- **Una scheda apre il percorso sulla mappa**, con la scheda dei percorsi di
  «Explore»: km, «star · Trento · looks 97% like it» («Favorite» al posto
  della città, quando non c'è), «Start», «Export GPX». «←» e «Back to the
  list» tornano all'elenco dei preferiti, sopra la pagina da cui si era
  partiti.
- **Vuoto**: «No favorites yet. Tap ♡ on a route on the map to keep it
  here.». **Elenco non arrivato**: «Your favorites could not load.» e «Try
  again». L'elenco si chiede all'apertura dell'app, se c'è un account, e
  ogni volta che la pagina si apre.
- **Sessione finita** a una richiesta dei preferiti: l'app esce, come dice
  «Profile», e il cuore torna a chiedere di entrare.
- **Al massimo 200**: oltre, l'API dice di toglierne uno e l'app lo ripete.
- **Una parola con la penna alzata** (TASK-199, ADR-0158): il cuore tiene
  anche i tratti a piedi (`walks`). Riaperto, il preferito è come la
  parola appena disegnata: sulla mappa le lettere gialle e i tratti a piedi
  tratteggiati; «Start» mette in pausa da sola alla fine di ogni lettera,
  con la voce, e riparte 20 m prima della successiva (TASK-198); «Export
  GPX» ha «Pause» e «Resume»; il punteggio che l'API calcola per la corsa
  salvata (l'app non lo mostra, TASK-241) guarda solo le lettere. Nessun testo nuovo. Un preferito tenuto prima di TASK-199, o
  con `walks` che non stanno nella linea, è una linea sola, come prima. Se
  l'API non conosce ancora i `walks` (più vecchia di TASK-199) e rifiuta,
  l'app tiene il preferito senza, come una linea sola, invece di mostrare
  l'errore; tenuto così, resta così.
- **Un percorso in bici** (TASK-200, ADR-0160): il cuore tiene anche
  l'attività con cui il percorso è stato chiesto in «Draw» («Bike» in
  «Settings», `cycling`); i percorsi di «Explore» e quelli a tema sono a
  piedi. Riaperto, il preferito resta in bici qualunque sport sia scelto in
  «Settings»: «Export GPX» lo chiede come percorso in bici. Cosa si vede
  non cambia (stessa scheda, stessi testi), e «Start» fa quello di oggi: la
  navigazione della corsa, con le indicazioni chieste per i soli punti,
  che l'API trova sulla rete a piedi (cosa debba fare «Start» in bici lo
  decide l'utente, TASK-190). Un preferito tenuto prima di TASK-200 è una
  corsa. Se l'API non conosce ancora l'attività (più vecchia di TASK-200) e
  rifiuta, l'app lo tiene come una corsa, senza mostrare l'errore; tenuto
  così, resta così.
- **La bici a mano** (TASK-206, ADR-0167): il cuore tiene anche i tratti
  con la bici a mano (`on_foot`), solo quando ce ne sono e stanno nella
  linea; riaperto, il preferito li segna sulla mappa come appena disegnato
  («Il risultato»), e tenuto di nuovo li tiene. Se l'API non li conosce
  ancora (più vecchia di TASK-206, parte B) e rifiuta, l'app lo manda di
  nuovo senza i tratti, ancora in bici; se rifiuta ancora, come un'app più
  vecchia di TASK-199. Un preferito tenuto prima non ha tratti.

## «My activities» (TASK-172, ADR-0140)

Le corse che chi ha un account salva si ritrovano in «Profile», da ogni
telefono dell'account: con un percorso o senza.

- **«Save» alla fine della corsa** (sotto, «La fine della corsa») mette la
  corsa in «My activities»; «Discard» la butta. Niente si salva da solo
  (scelta dell'utente, 2026-10-02). Va all'API la corsa com'è stata
  registrata, posizione per posizione, con le pause e, se c'era, il
  percorso seguito; km, tempo e punteggio li conta l'API, non il telefono.
- **Senza rete** la corsa salvata resta sul telefono, in un file a parte
  (`activities-outbox.json`, al più 20 corse per account), e parte da sola alla
  prossima apertura dell'app con la rete, o quando si apre «My
  activities»; mandata due volte, è salvata una volta. Una corsa che
  aspetta è dell'account con cui è stata corsa: un altro account sullo
  stesso telefono non la manda. In cima alla pagina, finché aspetta:
  «1 run is on this phone, waiting for a connection.».
- **Una corsa che l'API non prenderà mai** (`422 invalid_request`: meno
  di due posizioni buone, l'orologio del telefono sbagliato, i 2 000
  salvataggi dell'account già pieni) non sparisce (TASK-257, ADR-0221):
  resta nel file, segnata con il motivo, e non viene più mandata. In cima
  a «My activities», bordata di rosso come un problema, una riga per
  corsa con il giorno e l'ora, i km come il telefono li ha registrati e
  «The server could not take this run: {message}» (il messaggio dell'API,
  in inglese com'è arriva); sotto, «Try again» (la manda ancora: utile
  dopo aver cancellato una corsa a lista piena) e «Discard», che chiede
  «Discard this run? It will not be saved.» con «Keep it» e «Discard
  run». La riga «waiting for a connection» non la conta.
- **Il telefono tiene al più 20 corse non mandate per account**, le
  rifiutate comprese; non ne lascia andare nessuna per fare posto. Al
  «Save» della ventunesima la fine della corsa resta com'è (il file della
  corsa in corso non si cancella) e dice «The phone holds 20 runs not sent
  yet. Discard one in My activities first.» se fra quelle c'è una
  rifiutata, altrimenti «The phone holds 20 runs not sent yet. They go
  when there is a connection; then save this one.».
- **Senza account** non si salva niente, com'era: sotto la scheda di fine
  corsa la riga «Sign up or log in to keep your runs and share them as
  drawings.» (TASK-117) apre «Profile» con la stessa frase sopra il
  modulo. Chi entra da lì e
  torna alla scheda trova «Save» e «Discard» al posto di «Done».
- **La pagina «My activities»**, da «Profile»: una scheda per corsa, dalla
  più recente. A sinistra il disegno, come a fine corsa: il percorso
  giallo e sopra, sottile e chiara, la linea corsa; una corsa senza
  percorso ha solo la sua linea. A destra il giorno e l'ora dell'inizio,
  con l'orologio del telefono («Fri 2 Oct 2026 · 08:12»); il luogo e cosa
  disegnava («Trento · Star»; il luogo è il paese da cui si parte, trovato
  dall'API, e manca se non lo trova; senza luogo né percorso, «Run»); «4.01
  km · 19:00 · 4:45 /km», cioè km, tempo senza le pause e passo medio.
  **Il punteggio non c'è** (TASK-241 parte D, chiesto dall'utente), né
  nell'elenco né sulla corsa aperta. Niente è giallo, tranne il percorso
  nel disegno. **Una corsa lungo un percorso inclinato** (TASK-232, parte
  C) ha il disegno girato dall'altra parte, percorso e linea corsa
  insieme, così la forma si legge dritta come sulla mappa; lo stesso nel
  post da condividere (TASK-231) e nel disegno che gli altri vedono nel
  profilo (TASK-117). Le corse salvate prima restano col nord in alto.
- **Venti per volta**: in fondo «Show more» porta le venti successive. Il
  numero in «Profile» le conta tutte.
- **Una scheda apre la corsa sulla mappa**: il percorso giallo e la linea
  corsa, come a fine corsa; sotto, giorno e ora, luogo e disegno, km,
  tempo e passo, la legenda («Yellow: the route. White: what you
  ran.»). «←» e «Back to the list» tornano
  all'elenco. Niente cuore e niente «Start»: è una corsa, non un percorso.
- **Strava sulla corsa aperta** (TASK-187), sopra «Delete», solo se l'API
  ha Strava: **«View on Strava»** se la corsa c'è già (apre la sua pagina);
  se no il campo «Name on Strava», con il nome che l'API darebbe come
  suggerimento («Star in Trento»), e **«Send to Strava»**, che manda subito
  («Sending to Strava…»). Strava che sta ancora leggendo la corsa: «Strava
  is still reading this run.» e «Check again». Gli errori in una riga
  rossa sotto («Strava could not read this run.», «No connection. Try
  again when you are online.»). Un atleta che ha tolto l'accesso da Strava
  torna a «Connect with Strava».
- **Il modulo del disegno sulla corsa aperta** (TASK-117, ADR-0159,
  ADR-0166; TASK-208, ADR-0170), sopra Strava: lo stesso della fine corsa
  («La fine della corsa», più giù), come l'API lo ha: le foto, «Title»,
  «How did it go?», «Tag people», «Activity» e «Who can see it», in un
  riquadro che scorre (al più il 40 % dello schermo). Niente finché l'API
  non risponde, niente del tutto da un'API senza disegni. Una pillola
  («Activity», «Who can see it»), un tag messo o tolto e una foto mandano
  **subito** la scelta intera (`PUT /me/activities/{key}/drawing`); il
  titolo e la descrizione si mandano chiusa la tastiera, se sono cambiati.
  Sotto le pillole, con «Everyone»: «Every member sees it in your profile,
  without the first and last 200 m.»; con «Followers»: «Your followers see
  it in your profile, without the first and last 200 m.». Rifiutata, il
  motivo dell'API in rosso («This run is too short to publish: …») e il
  modulo torna a com'era. **Senza rete** la scelta resta sul telefono
  (`drawings-outbox.json`) e parte con la prossima apertura con la rete:
  «Saved on the phone. Others see it when you are back online.» (o, con
  «Only me», «Saved on the phone. It is sent when you are back online.»).
  **Le foto** (scelta dell'utente, ADR-0170 punto 7): «Add photo» aggiunge
  dal rullino o dalla fotocamera, fino a tre; ogni foto ha la sua «×».
  Mentre altri vedono la corsa, una foto aggiunta va all'API dopo il
  disegno, e una tolta viene svuotata là; con «Only me» restano sul
  telefono, e sotto c'è «Photos of a run only you can see stay on this
  phone. Delete the app or change phone and they are gone.». Tornare a
  «Only me» con delle foto dice «Its photos leave Sgrava and stay only on
  this phone.»: l'API le cancella, il telefono le tiene e le rimanda quando
  la corsa si riapre agli altri. Una foto che il telefono non riesce a
  scrivere: «This photo could not be kept on the phone. Try again.».
- **Una corsa che altri vedono** («Everyone» o «Followers») ha nell'elenco
  il segno **«Public»** sotto i suoi numeri (`GET /me/drawings`, chiesto a
  ogni elenco che arriva). Una corsa che aspetta sul telefono e andrà agli
  altri aggiunge, sotto «1 run is on this phone…», «Saved on the phone.
  Others see it when you are back online.».
- **«Delete»**, in rosso, sulla scheda dell'elenco e sotto la mappa, chiede
  prima sulla scheda stessa: «Delete this run? It cannot be undone.», con
  «Keep it» e «Delete run». La corsa sparisce subito; se l'API rifiuta
  torna dov'era, con il motivo in cima all'elenco.
- **Vuoto**: «No activities yet. Save a run when you finish it, and it is
  kept here.». **Elenco non arrivato**: «Your activities could not load.» e «Try
  again». L'elenco si chiede all'apertura dell'app, se c'è un account, e
  ogni volta che la pagina si apre.
- **Sessione finita** a una richiesta delle corse: l'app esce, come dice
  «Profile»; una corsa che aspettava resta sul telefono per quando si
  rientra con lo stesso account.
- **Una corsa su una parola con la penna alzata** (TASK-199, ADR-0158),
  da «Draw» o da un preferito: «Save» manda anche i tratti a piedi del
  percorso (`walks`) e dice quali pause sono della penna (`pen`); per
  ogni altra corsa la richiesta è quella di prima, campo per campo. Il
  punteggio che l'API tiene per la corsa (da TASK-241 «My activities» non
  lo mostra) è quello delle sole lettere, lo stesso
  della fine della corsa, e le pause «penna» tolgono km e tempo come le
  altre. Riaperta, la mappa ha i tratti a piedi tratteggiati, come a fine
  corsa; la linea corsa resta unita sulle pause (spezzarla è una scelta
  dell'utente, non fatta). Le corse salvate prima di TASK-199 non hanno i
  tratti a piedi: una linea sola. Se l'API non conosce ancora i `walks`
  (più vecchia di TASK-199) e rifiuta la corsa, l'app la rimanda subito
  come prima, senza `walks` né `pen`: si salva con il punteggio su tutto
  il percorso, tratti a piedi compresi, invece di perdersi.
- **Le pause di una corsa riaperta** (TASK-200): l'API ora le manda con la
  corsa intera, quelle della penna segnate; l'app le legge e **non mostra
  niente di nuovo**: la linea corsa resta unita (spezzarla sulle pause è
  una scelta dell'utente).

## La partenza

È un punto `(lat, lon)` con la sua origine, `gps` o `search`, e diventa lo
`start` del `RouteRequest`.

| Situazione | Riga di stato | Cosa c'è in più |
|---|---|---|
| In attesa del GPS | «Finding your position…» | — |
| GPS riuscito | «Starting from your position.» | — |
| Permesso negato | «Location is off for Sgrava…» | «Open Settings», ricerca |
| GPS spento, errore, nessuna risposta in 15 s | «Your position is not available right now…» | ricerca |
| «Another place», nessun luogo ancora | «Search for a city or street to start from.» | ricerca |
| Luogo scelto dalla ricerca | «Starting from Via Rodolfo Belenzani, Trento.» | ricerca, per cambiarlo |

La partenza si sceglie con due pulsanti affiancati nella scheda «START»
(TASK-054): **«My position»**, il GPS, e **«Another place»**, un luogo
cercato. Con «Another place» c'è la ricerca, e il luogo scelto resta la
partenza anche se il GPS risponde: si può partire da un'altra città con il
GPS acceso. «My position» torna al GPS, lo rilegge e chiede di nuovo il
permesso, se il telefono lo permette ancora; la ricerca sparisce. Senza GPS
(permesso negato, nessuna risposta) la ricerca c'è comunque, e il luogo
cercato fa da partenza finché il GPS non risponde. Ogni nuova partenza, anche nello stesso
punto, ricentra la mappa.

## Ricerca del luogo

- Compare solo quando la posizione manca. Campo «City or street», pulsante
  «Search» o invio della tastiera.
- I luoghi si suggeriscono **mentre si scrive** (TASK-085, ADR-0080): da 3
  lettere, 300 ms dopo l'ultima (`MIN_SUGGEST_LENGTH`,
  `SUGGEST_DELAY_MS` in `PlaceSearch.tsx`), non a ogni lettera: Photon
  chiede un uso corretto. «Search» e l'invio cercano subito, mai con il
  campo vuoto. I suggerimenti di prima restano finché arrivano i nuovi;
  sotto le 3 lettere spariscono. Una risposta si mostra se è più nuova di
  quella sullo schermo, anche con un'altra ricerca in corso (TASK-089,
  ADR-0083): Photon impiega 2–3 s.
- I luoghi li dà l'API (`GET /places`, Geoapify, TASK-123, ADR-0095); se
  l'API non c'è, non risponde entro 2,5 s o non ha la chiave, Photon come
  prima. Dopo un «non ho la chiave» l'API non si richiede fino al riavvio.
- Toccato un suggerimento, il campo ne prende il nome, la tastiera si
  chiude e l'elenco sparisce; la riga si illumina mentre è premuta.
- Con la posizione GPS nota (o l'ultimo luogo scelto), Photon riceve
  `lat`/`lon` e mette prima i luoghi attorno: «via bel» a Trento trova vie
  del Trentino, non del Brasile.
- Al massimo 5 risultati. Ognuno si legge come nome e prima area più ampia
  diversa dal nome: «Via Rodolfo Belenzani, Trento», «Levico Terme,
  Provincia di Trento». Le etichette uguali si mostrano una volta sola (una
  via spezzata in più tratti OSM torna una volta per tratto).
- Sotto i risultati, «© OpenStreetMap contributors».
- Nessun risultato: «No place found. Try adding the city.» Errore di rete o
  del servizio: «The search failed. Check the connection and try again.»
- Con «Paddle» la ricerca offre anche i laghi e le spiagge che l'app
  conosce, sopra questi risultati (TASK-240, ADR-0204: «Sull'acqua:
  «Paddle»»). Con «Run» e «Bike» è quella descritta qui.

## Forma e distanza

Sopra, un interruttore **«Shape | Word | Image»** (TASK-057, ADR-0053;
«Image» dal TASK-073): il percorso disegna una forma del catalogo, una
parola **oppure** il contorno di un'immagine, mai due insieme, e
l'interruttore mostra quale. Di partenza «Shape». Passare dall'uno all'altro
non cancella quanto scritto o scelto negli altri.

La forma si sceglie toccando una tessera, che scrive il nome nel campo, o
scrivendo nel campo. I simboli delle tessere sono caratteri (♥ ★ ◯ ☾ e le
emoji di gatto, pesce, cavallo, farfalla, lumaca, cane, coniglio, zucca,
albero di Natale, e 🙂 👻 🍩 ☀️ per faccina, fantasmino, ciambella e sole,
TASK-223):
disegnare i contorni veri vuole `react-native-svg`, una dipendenza non
ancora chiesta.
Le tessere stanno in una riga sola che scorre di lato col dito (TASK-088,
ADR-0084, chiesto dall'utente): se ne vedono poco meno di quattro, e la
tessera tagliata sul bordo dice che ce ne sono altre. Una forma scritta nel
campo porta la sua tessera in vista.

La **forma** è una parola, in inglese o in italiano (ADR-0036). Le forme
sono quelle del catalogo, le sole che l'utente ha giudicato riconoscibili
sulle strade:

| Forma | Parole |
|---|---|
| `circle` | circle, ring, round · cerchio, anello, tondo |
| `heart` | heart, love · cuore, cuoricino, amore |
| `star` | star · stella, stellina |
| `horse` | horse, pony, stallion · cavallo, cavallino, stallone, puledro |
| `moon` | moon, crescent, crescent moon · luna, mezzaluna, falce di luna |
| `cat` | cat, kitty, kitten · gatto, gatta, gattino, micio |
| `fish` | fish · pesce, pesciolino |
| `butterfly` | butterfly · farfalla, farfallina |
| `snail` | snail · lumaca, lumachina, chiocciola |
| `dog_head` | dog, dog head, doggy, puppy · cane, cagnolino, testa di cane |
| `rabbit_head` | rabbit, rabbit head, bunny · coniglio, coniglietto, testa di coniglio |
| `pumpkin` | pumpkin, halloween pumpkin, jack-o'-lantern · zucca, zucca di halloween |
| `christmas_tree` | christmas tree, xmas tree · albero di natale, alberello di natale |
| `smiley` | smiley, smiley face, smiling face, happy face, smile · faccina, faccina sorridente, sorriso, sorrisino |
| `ghost` | ghost, spook · fantasma, fantasmino, spettro |
| `donut` | donut, doughnut · ciambella, ciambellina |
| `sun` | sun, sunshine · sole, solicello, sole splendente |

- Anche al plurale («stelle», «hearts»), con l'articolo («una stella»,
  «l'amore»), con maiuscole e accenti qualsiasi. La tabella sta in
  `shapeWords.ts`.
- Una parola che non è il nome della forma la conferma sotto il campo:
  «cavallo» mostra «→ horse».
- Le teste si chiamano `dog_head` e `rabbit_head` nel contratto, «dog
  head» e «rabbit head» sullo schermo: nelle tessere, nei messaggi, nel
  campo e nel nome del percorso (ADR-0061). «cane» e «dog» portano alla
  testa di cane, «coniglio» e «bunny» a quella di coniglio: gli animali
  interi non sono nel catalogo.
- «albero» e «tree» da soli **non** sono l'albero di Natale (ADR-0084): un
  albero qualsiasi non è nel catalogo, e resta «nessuna forma». Sullo
  schermo `christmas_tree` si legge «christmas tree».
- Il campo vuoto: «Unknown shape. Try: circle, heart, star, horse, moon,
  cat, fish, butterfly, snail, dog head, rabbit head, pumpkin, christmas
  tree, smiley, ghost, donut or sun.» e «Draw route» resta spento.
- «ring», «round», «anello» e «tondo» restano del cerchio: «ciambella» e
  «donut» sono la ciambella (TASK-223). Nelle cinque lingue i nomi sono
  «Smiley», «Ghost», «Donut», «The sun» (`shapeNames.ts`; «Sun» è già la
  domenica) · «Faccina», «Fantasmino», «Ciambella», «Sole» (**confermati
  dall'utente** il 2026-10-05; tedesco, spagnolo e francese da confermare).
- **Faccina, fantasmino e ciambella** (TASK-223, ADR-0185), e **gatto,
  pesce, testa di cane, testa di coniglio e zucca** con gli occhi staccati
  (scelta dell'utente sui campioni, 2026-10-05; nell'app con TASK-226),
  hanno sotto il campo l'interruttore **«Lift the pen between parts»**, lo
  stesso stato di quello delle parole, acceso all'avvio (confermato
  dall'utente il 2026-10-05): acceso, la richiesta ha `pen_up: true` e la
  forma si disegna un pezzo alla volta, a piedi fra l'uno e l'altro
  (`API.md`, «La penna alzata»). Il sole si disegna con la penna giù,
  scelta sui campioni, e non ha l'interruttore. **Sull'acqua
  l'interruttore non c'è**: lì la penna si alza da sola («Sull'acqua:
  «Paddle»», sotto). Il percorso mostra «6.0 km of drawing + 0.4 km walking
  between the parts» · «6,0 km di disegno + 0,4 km a piedi fra una parte e
  l'altra» («riding» · «in bici» in bici), attraverso `t()`. Testi nuovi:
  «Lift the pen between parts» e le due righe dei km **confermati
  dall'utente** il 2026-10-05; le righe in tedesco, spagnolo e francese da
  confermare.
- Nel campo vuoto il suggerimento è «heart, star, horse…». Il campo
  accetta al massimo 60 caratteri.

Le **parole che la tabella non conosce** («stemma della Ferrari», «Nemo»)
le legge l'AI sul PC (ADR-0012, `AI.md`). La tabella viene sempre prima:
è immediata e non ha bisogno dell'AI.

| Quando | Sotto il campo | «Draw route» |
|---|---|---|
| Mentre si scrive | Press Done and the AI will read it. | spento |
| Dopo «Fine», o toccando fuori dal campo | The AI is reading it… | spento |
| L'AI trova una forma | → horse | acceso |
| L'AI non trova una forma | No shape in the catalogue for “Batman”. Describe what it looks like (“prancing horse”, not “Ferrari badge”), or pick one: (le tessere sono sopra il campo) | spento |
| L'AI non risponde (`ai_unavailable`) | The AI that reads shape words is not running on the PC (Ollama). These words work without it: circle, … | spento |

- Le parole partono quando la scrittura finisce («Fine» sulla tastiera, o
  un tocco fuori dal campo), non a ogni lettera: il modello impiega secondi
  e le parole a metà non servono.
- L'app ricorda le letture finché resta aperta: tornare sulle stesse parole,
  a meno di maiuscole e spazi, non le rimanda. Un errore invece non si
  ricorda: con «Fine» si riprova.
- Se l'API non si raggiunge, i messaggi sono quelli di «Quando non va».

La **parola** (con «Word») si scrive in un campo che va in maiuscole; al
posto delle tessere e del campo della forma. L'app la controlla prima di
mandarla, con le regole dell'API (`API.md`, «Una parola invece di una
forma»), e la manda come `word`, in maiuscole e senza `shape`:

| Quando | Sotto il campo | «Draw route» |
|---|---|---|
| Campo vuoto | Write a word to draw, with the letters A to Z. (grigio) | spento |
| Uno spazio in mezzo | One word only, without spaces. | spento |
| Una lettera fuori da A–Z | No letter “À”: a word can use only the letters A to Z, without accents. | spento |
| Più di 7 lettere | At most 7 letters: each needs 3 km, and the app goes up to 21 km. | spento |
| Con «Bike», più di 8 lettere (TASK-190) | At most 8 letters. (**da confermare con l'utente**) | spento |
| Meno di 3 km a lettera | “CIAO” needs at least 12 km: 3 km for each letter. e il tasto «Use 12 km» | spento |
| La parola va | 4 letters: at least 12 km. A word takes a few minutes to draw. | acceso |

Sotto la nota, **«LETTERS: Round | Square»** (TASK-080, ADR-0075): le
lettere di oggi o quelle squadrate, che nell'API sono `style: "block"`.
«Round» è la scelta all'avvio; con «Square» sotto compare, in grigio,
«Square letters follow the street grid: best for short words.». La scelta
va nella richiesta di ogni parola come `style` e non si salva fra un
avvio e l'altro.

Sotto, l'interruttore **«Lift the pen between letters»** (TASK-198,
ADR-0157), «On» o «Off» come quelli della corsa. Acceso, la richiesta
della parola ha `pen_up: true`: ogni lettera si disegna da sola e fra una e
l'altra si cammina (`API.md`, «La penna alzata»); spento, o con una forma o
un'immagine, il campo non c'è e la richiesta è quella di prima. La stessa
parola con e senza la penna alzata sono due richieste diverse. **Acceso
all'avvio** (TASK-202), scelta dell'utente del 2026-10-02 («sì, acceso di
default»); TASK-198 l'aveva costruito spento finché l'utente non
sceglieva. Un'API più vecchia di TASK-197 rifiuta il campo con
`invalid_request`: con l'interruttore acceso ogni parola chiesta a
un'API così fallisce, quindi l'app va pubblicata solo dopo il server
(`tasks/TASK-202.md`, «Note per il deploy»). Non si salva fra un avvio e
l'altro.

- Le lettere sono `LETTERS` di `shared-types`; il contratto ne ammette 8
  (`MAX_WORD_LETTERS`), ma a 3 km l'una (`LETTER_DISTANCE_M`) l'ottava
  vorrebbe 24 km, oltre i 21 dell'app: il limite dell'app è 7. Con «Bike»,
  fino a 30 km, le 8 del contratto (TASK-190).
- Gli accenti non si tolgono di nascosto: «città» dice quale lettera manca,
  come l'API.
- «Use 12 km» scrive la distanza minima nel campo dei km.
- Il campo accetta 20 caratteri, così oltre il limite si legge perché.
- Le regole stanno in `src/route/wordInput.ts`.

La **distanza** si scrive con il tastierino numerico (ADR-0034):

- interi o un decimale, con la virgola o con il punto: `7`, `7,5`, `7.5`;
  gli spazi attorno non contano. Al motore va in metri interi (7,5 km →
  7500);
- da 1 a **21 km**: il limite lo hanno deciso le misure (`API.md`, «Oltre
  15 km»), e sta in una costante dell'app (`MAX_APP_DISTANCE_KM`). Motore
  e contratto arrivano a 50 km;
- **con «Bike»** (TASK-190): da **10 a 30 km**, i limiti della bici nel
  contratto (`DISTANCE_LIMITS_M.cycling`, scelta dell'utente); messaggio,
  − e + seguono quei limiti. I limiti di ogni sport stanno in
  `APP_DISTANCE_LIMITS_KM` (`src/route/distance.ts`);
- con un valore non valido, anche il campo vuoto, sotto compare «Enter a
  distance between 1 and 21 km.» e «Draw route» resta spento;
- sopra i 15 km, prima della richiesta: «Long routes take longer: up to a
  few minutes.»

Di partenza «heart» e 5 km (10 con «Bike»). L'attività non si mostra:
è `running`, o `cycling` con «Bike» scelto in «Settings» (TASK-190); con
«Run» la richiesta è quella di prima, campo per campo. Uno sport scelto
mentre l'app è aperta porta la distanza nei suoi limiti, come − e +: 5 km
di corsa diventano 10 in bici, 25 in bici diventano 21 a piedi; una
distanza che sta nei due resta com'è. − e + cambiano la distanza di 1 km,
fermi fra 1 e 21 (fra 10 e 30 in bici); un valore fuori dai limiti torna
dentro, un testo che non è un numero riparte dal minimo. Il
tastierino numerico non ha il tasto invio: si chiude toccando «Draw
route»; quello della forma si chiude con «Fine». Mentre una tastiera è
aperta la schermata si accorcia perché non copra i campi.

**Con «Miles»** (TASK-182 parte B, ADR-0149 «aggiornamento»; scelte
dell'utente del 2026-10-05) la distanza si chiede in miglia:

- accanto al campo c'è «mi» (VoiceOver: «Distance in miles»); si scrivono
  miglia intere o con un decimale (`4`, `4,5`, `4.5`), e al motore vanno i
  metri interi (4,5 mi → 7242);
- **− e + cambiano di 1 miglio**; i limiti sono le miglia intere dentro
  quelli in km: **corsa 1–13 mi, bici 7–18 mi, canoa 1–3 mi**
  (`APP_DISTANCE_LIMITS_MI`). Fuori: «Enter a distance between 1 and 13
  mi.»;
- di partenza **3 mi** (i 5 km, al miglio più vicino), 7 mi con «Bike»,
  1 mi con «Paddle» (i 2 km);
- l'avviso dei percorsi lunghi resta a 15 km: compare da 9,4 mi (da 10
  mi con − e +);
- cambiando l'unità in «Settings» la distanza scritta resta la stessa,
  al km o al miglio intero più vicino e dentro i limiti (5 km → 3 mi,
  7,5 km → 5 mi, 21 km → 13 mi; 3 mi → 5 km);
- una parola: «“CIAO” needs at least 7.5 mi: 1.9 mi for each letter.»,
  il tasto «Use 8 mi» (il miglio intero che basta), «4 letters: at least
  7.5 mi. A word takes a few minutes to draw.»; le miglia di una parola
  sono arrotondate **in su**, mai meno di quelle che servono. A piedi le
  lettere sono **al massimo 6** (7 chiedono 21 km, più di 13 mi): «At
  most 6 letters: each needs 1.9 mi, and the app goes up to 13 mi.»;
- un lago piccolo scelto in «Another place» (TASK-240) tiene la sua
  distanza di 1 o 1,5 km anche sotto il miglio: il campo mostra «0.6» o
  «0.9».

Con «Kilometres» tutto è come sopra, alla lettera.

### L'immagine (TASK-073)

Con «Image» due pulsanti: **«Choose picture»**, dalla libreria delle foto,
e **«Take photo»**, con la fotocamera (`expo-image-picker`). La libreria
non chiede permessi su iOS: il selettore di sistema consegna solo la foto
scelta. La fotocamera chiede il suo la prima volta. La foto arriva intera,
senza ritaglio quadrato: il soggetto vuole sfondo tutto intorno. iOS la
consegna in JPEG anche se è HEIC; un PNG trasparente perde la trasparenza.

Prima di scegliere, una riga dice cosa funziona: *One subject on a plain
background works best: a drawing, a logo, an object on a bare table. The
route follows its outside line. Up to 4 separate subjects are joined in one
line.*

La foto va all'API (`POST /image-outlines`, ADR-0069) e mentre il motore
ricava il contorno la riga dice *Tracing the outline…* (meno di 2 s). Poi
l'**anteprima**: la foto attenuata, e sopra il contorno in giallo, il
colore del percorso, perché è quello che il percorso disegnerà. Quello che
non è diventato linea resta visibile sotto: un dettaglio lisciato, una
macchiolina. Con più soggetti staccati, fino a 4 (TASK-084, ADR-0079),
ognuno ha la sua linea gialla, e un trattino giallo lo collega al più
vicino: il percorso lo fa andata e ritorno. Sotto, *The yellow line is what the route
will draw. If it does not look like the subject, the route will not
either: try another picture, or edit the outline. Separate subjects are
joined by a short line, which the route runs there and back.* e un link
«Hide the picture» che lascia solo la linea, come sarà sulla mappa: il
gatto di TASK-072 non si riconosceva già dal contorno, e senza la foto
sotto si vede. Un'immagine alta resta entro 320 punti d'altezza, così la
distanza resta a vista. La linea è fatta di rettangoli sottili ruotati,
senza SVG (`react-native-svg` non è una dipendenza dell'app).

**Modificare il contorno** (TASK-079, ADR-0074). Sotto l'anteprima,
**«Edit the outline»** apre una **lavagna a tutto schermo**: la foto
attenuata con il contorno, e sotto **«Add a part»**, **«Add a detail»**,
**«Undo»**, e in fondo, largo quanto la riga, **«Save»**: tiene le
modifiche e chiude la lavagna (le modifiche sono già nel contorno, quindi
salvare è chiudere). In alto solo «Fit» quando la foto è ingrandita. Fino
a TASK-229 (ADR-0191) in alto a destra c'era «Done», ma in Expo Go quell'angolo è
coperto dal pulsante di Expo e l'utente non riusciva a uscire.
La lavagna sta fuori dalla pagina che scorre: mentre si disegna lo schermo
resta fermo (nella prima prova sull'iPhone l'anteprima, dentro la pagina,
scorreva col dito). L'anteprima nella pagina mostra soltanto.

- **Due dita** ingrandiscono (fino a 8 volte) e spostano la foto, sempre.
- **Un dito**, con «Add a part» o «Add a detail» acceso (giallo), disegna:
  la linea segue il dito, gialla e più sottile, e quando il dito si alza va
  all'API, che risponde con il contorno nuovo (*Adding the part…*). Se
  durante il tratto si appoggia un secondo dito, il tratto si lascia e si
  ingrandisce. Senza pulsante acceso, un dito sposta la foto ingrandita.
- Le linee restano larghe uguali a ogni ingrandimento; ingranditi si
  disegnano dettagli più fini.

Sopra i pulsanti una riga dice cosa fare:

- nessun pulsante: *Choose what to add. Two fingers zoom and move the
  picture.*
- parte: *Draw a closed shape. Across the yellow line it becomes part of
  the outline; anywhere else it is joined to the nearest yellow line.*
- dettaglio: *Draw a line anywhere: it is joined to the nearest yellow
  line, and the route runs along it and back. Close a loop to make an eye.*

Si disegna dove si vuole, anche dentro l'immagine: ciò che non tocca la
linea gialla il motore lo collega con un trattino nel punto più vicino. Le linee
possono incrociarsi e uscire dal contorno.

I dettagli si vedono gialli come il contorno. «Undo» toglie l'ultima
modifica, fino al contorno ricavato dalla foto; è spento finché non c'è
niente da togliere. «Choose another» riparte da capo. Se l'API rifiuta la
linea, al posto della riga il motivo, con sotto il testo del motore:

| `reason` | Messaggio |
|---|---|
| `short` | This line is too short to add. Draw a longer one. |
| `covers_detail` | This part covers where a detail starts. Undo the detail first, or draw the part elsewhere. |
| `too_many_corners` | That is too much for one route. Undo something, or draw simpler lines. |

«Draw route» si accende solo con un contorno: il percorso si chiede come
per una forma, con la distanza del campo sotto, e manda il contorno
dell'anteprima, con i dettagli disegnati (`POST /image-route-jobs`). «Choose another» sostituisce la
foto; annullare il selettore lascia quella di prima. Sotto la distanza del
risultato si legge «Picture · on roads · target 15 km».

Se l'immagine è rifiutata, al posto dell'anteprima il motivo in parole
semplici, con sotto il testo del motore:

| `reason` | Messaggio |
|---|---|
| `background` | The background is too busy. Use one subject on a plain background, like a drawing on white paper or an object on a bare table. |
| `no_subject` | Nothing stands out from the background. Use a subject much darker or brighter than what is around it. |
| `scattered` | The picture shows more than 4 separate things. Use a picture with 4 subjects at most. |
| `edge` | The subject touches the edge of the picture. Leave some background all around it. |
| `small` | The subject is too small. Get closer, or use a bigger picture. |
| `jagged` | The outline is too jagged to run on roads. Try a simpler subject. |
| `format` | Only PNG and JPEG pictures work. Choose another one. |
| `unreadable` | This picture could not be read. Choose another one. |
| fotocamera negata | The camera is off for this app. Allow it in Settings, or choose a picture instead. + «Open Settings» (TASK-259) |
| oltre 10 MB | This picture is too large: 12.3 MB, at most 10 MB. Choose a smaller one. |

## Chiedere un percorso

«Draw route» è spento finché non c'è una partenza. Toccato, la richiesta va
all'API in due tempi (ADR-0032): l'API la accetta subito, poi l'app chiede
a che punto è: ogni mezzo secondo nei primi 6 s, ogni secondo fino a 20 s,
poi ogni 2 s (ADR-0136). La scheda dice cosa sta succedendo e offre «Cancel»;
sotto, una barra gialla che avanza (TASK-055, ADR-0050). L'API dice la fase,
non una percentuale, quindi la barra è una stima: ogni fase ha il suo
tratto (in coda fino all'8%, download della zona fino al 45%, calcolo fino
al 95%) e lo percorre al ritmo dei tempi misurati qui sotto, rallentando
verso la fine senza superarlo. Non torna mai indietro, e si riempie solo
quando arriva il percorso. Se una fase dura più del doppio del solito
(anche la prima risposta dell'API, che di solito arriva in pochi secondi),
la barra pulsa: si sta ancora aspettando (TASK-058, ADR-0055).

La stessa barra, con la stessa regola, compare anche nelle altre attese:
sotto «The AI is reading it…» mentre l'AI legge le parole (di solito 20 s,
fino a 50 s se deve caricare il modello), e al centro della mappa mentre MapLibre e
le prime tessere si caricano (di solito 5 s): solo la prima volta, finché la
pagina non dice `loaded`; se la mappa non si carica, al suo posto l'errore.

| Stato dell'API | Il pannello dice |
|---|---|
| richiesta partita, o in coda | «Waiting for the API…» |
| zona da scaricare | «Downloading map data for this area…» |
| calcolo | «Drawing a 15 km heart…», per una parola «Drawing “CIAO”, 12 km…» |

Forma e distanza non si cambiano durante l'attesa.

- Fino a 10 km il percorso di solito arriva in 5–35 s, da 15 a 21 km in
  30–50 s; una zona nuova aggiunge il suo download, circa 105 s per un
  21 km (`API.md`, «Tempi»).
- Dopo 5 minuti l'app smette di aspettare e dice all'API di lasciar
  perdere.
- **In bici** (TASK-190) fuori dalle zone della bici scaricate prima il
  server scarica 23–26 km di mappa da Overpass: può passare i 5 minuti, e
  allora si legge il messaggio di sempre («The API took more than 5
  minutes…»). I tempi veri in bici non sono ancora misurati (ADR-0153).
- Due errori di rete di fila durante l'attesa si perdonano; al terzo l'app
  dice che l'API non si raggiunge.
- Una parola chiede più tempo di una forma: 40–140 s per «CIAO» a 15 km,
  fino a 258 s per «BELLO» (`API.md`). Per una parola la barra stima il
  calcolo dalle lettere, circa 20 s l'una, mai meno di una forma della
  stessa distanza (TASK-069, ADR-0064); pulsa oltre il doppio di quella
  stima (ADR-0055), per «CIAO» dopo 160 s.
- «Cancel» interrompe l'attesa e dice all'API di lasciar perdere: una
  richiesta in coda non parte, una in download si ferma prima di calcolare.
- Una partenza, una forma, una parola o una distanza nuove tolgono il percorso e
  l'esito di prima.

## Il risultato

Sulla mappa la linea del percorso, inquadrata. Sotto, la distanza in grande
(«4.0 km») e, dopo il nome del percorso, «heart · on roads · target 5 km»
o «“CIAO” · on roads · target 12 km» (TASK-057); poi gli avvisi del motore, uno per
riga, e «Export GPX» largo (sotto, «Export del GPX»).

**Con «Miles»** (TASK-182 parte B) tutto questo è in miglia, subito:
«3.2 mi», «heart · on roads · target 3 mi», l'attesa «Drawing a 3 mi
heart…», le tessere «3.2 mi · 91%», la riga della penna alzata («6.0 mi of
letters + 0.1 mi walking between them»), gli avvisi del motore in piedi
sotto i 1000 piedi e in miglia sopra («There are 400 ft of steps along the
way.», «The route starts 0.7 mi north of your start…», «Includes 0.7 mi
walking the bike.»). «This shape comes out better at about 5 mi.» e «Try
5 mi» propongono il **miglio intero più vicino** dentro i limiti, e il
tasto chiede quelle miglia (in metri interi); se la richiesta è già a quel
miglio la riga non c'è. Così «It fits at about 4 mi.» / «Try 4 mi» quando
la forma non ci sta; se il miglio intero è quello appena chiesto, il
decimo più vicino («Try 3.1 mi»), e senza un'altra distanza le forme del
catalogo. Sull'acqua il miglio è arrotondato **in giù** (la distanza
dell'API è il massimo che ci sta).

**Più percorsi fra cui scegliere** (TASK-093, ADR-0087, scelte
dell'utente): quando l'API manda delle alternative, sotto il nome ci sono
fino a tre tessere «A · B · C», con km e somiglianza in percento
(«4.0 km · 91%»); A è il percorso scelto dal motore ed è selezionata. Sulla
mappa il percorso selezionato è giallo, gli altri sono linee sottili grigie
sotto (`otherRoute` nei token); una tessera toccata diventa il percorso:
distanza, avvisi, «Start» e «Export GPX» sono i suoi. Durante la corsa le
linee grigie spariscono. Un nuovo risultato riparte da A. Con un percorso
solo, niente tessere, come prima.

**Dove la forma viene meglio** (TASK-234, ADR-0197, scelta dell'utente):
quando l'API manda `better_distance_m`, sotto le tessere c'è una riga
grigia come un avviso da sapere, «This shape comes out better at about 8
km.» («This word…» per una parola, «This outline…» per un'immagine), con
il pulsante «Try 8 km», che scrive la distanza e ridisegna come quello di
ADR-0041. La riga è della richiesta: resta con qualunque tessera
selezionata. Non c'è sull'acqua, né per una distanza fuori da quelle di
«Draw» (oltre 21 km a piedi, fuori da 10–30 in bici) o uguale a quella
chiesta; e dopo un «Try» non propone di tornare alla distanza appena
lasciata, per lo stesso disegno dalla stessa partenza. «This shape» e non
«This heart»: il nome della forma cambierebbe genere nelle altre lingue
(«Questa forma viene meglio a circa 8 km.»). Testi nelle cinque lingue
(`src/route/betterDistance.ts`). Il tocco su «Try» si conta
(`hint_taken` con `better_distance`, TASK-234 C) e, come ogni nuovo
disegno, lascia subito il posto al pannello dell'attesa con la barra e
«Cancel»: è il segno che il percorso nuovo si sta calcolando.

**La mappa girata e la freccia del nord** (TASK-232 parte B, ADR-0195;
la mappa girata, la freccia e i suoi due tocchi sono scelte dell'utente
del 2026-10-05). Il motore può inclinare una forma fino a 45° per seguire
meglio le strade, e il risultato dice di quanto (`rotation_deg`). Quando
il percorso disegnato è inclinato, **la mappa gira dall'altra parte** e lo
inquadra così: il disegno si legge dritto, le vie e i nomi sono girati.
Ogni tessera «A · B · C» ha la sua inclinazione, e la mappa gira con la
tessera scelta. Un percorso che non lo dice (il cerchio, un'API di prima)
resta col nord in alto, come sempre.

Con la mappa girata c'è **la freccia del nord**: un tondo come quello del
«←», a destra, sotto la riga del «←» (l'angolo in alto a destra è del
tondo del profilo, e in corsa del riquadro della svolta); dentro, una
punta e una «N» che indicano dov'è il nord. **Un tocco rimette il nord in
alto** (e il disegno torna inclinato), **un secondo tocco rigira la mappa
come il disegno**. Se la mappa è ancora inquadrata sul percorso il tocco
lo inquadra di nuovo, girato; se l'utente l'ha spostata o ingrandita, gira
dov'è. La freccia segue la mappa vera: anche girata con due dita compare,
e un tocco rimette il nord in alto (senza un percorso inclinato, a quel
punto sparisce). Per VoiceOver è «North arrow», con «Turns the map north
up» o «Turns the map like the drawing»; nelle cinque lingue
(`src/map/NorthArrow.tsx`, `turnedMap.ts`). Posto, aspetto e testi
confermati dall'utente il 2026-10-06, sulle schermate del simulatore.

Sull'acqua, «Move the shape» con la mappa girata sposta la forma dove va
il dito sullo schermo; durante l'attesa la forma lasciata resta girata
com'era.

**Anche gli esempi di «Explore»** (TASK-232 parte B2): un esempio che il
motore ha inclinato si apre con la mappa girata e la freccia del nord,
ogni tessera «A · B · C» con la sua inclinazione, e resta girato mentre lo
si corre e a fine corsa; spostato con «Move the shape», prende
l'inclinazione del percorso nuovo. Vale per gli esempi disegnati per un
posto (le città, i paesi vicini, l'acqua), che portano `rotation_deg`. Non
lo dicono, e restano col nord in alto: i percorsi del catalogo dell'API,
gli esempi tenuti sul telefono da prima (finché non vengono ridisegnati),
gli esempi sull'acqua che arrivano con l'app, i preferiti. Le corse
salvate, il «Feed» e il post restano col nord in alto fino alla parte C di
TASK-232.

Gli avvisi sono **in parole semplici** (TASK-054, ADR-0048): l'app
riconosce i testi che il motore scrive e li riscrive brevi, con una
striscia arancio (`warning`) per quelli a cui fare attenzione (scale,
strade principali, gallerie, forma poco fedele, pochi tratti di strada) e
grigia per quelli da sapere (partenza spostata, distanza diversa da quella
chiesta, strade ripercorse); prima quelli a cui fare attenzione, e la
stessa frase una volta sola. Un testo che l'app non conosce resta com'è,
in inglese. La somiglianza non si mostra come
numero, tranne nelle tessere dei percorsi alternativi, dove serve a
confrontarli (TASK-093, scelta dell'utente): la forma la giudica l'occhio
(`PRODUCT.md`), e sotto 0,90 il motore aggiunge già un avviso. Il segnaposto resta sulla partenza chiesta.
Se il percorso comincia a più di 50 m da lì, perché il motore ha spostato la
forma dove ci sta (fino a 2 km, ADR-0040), un secondo segnaposto ciano con
l'etichetta «Start here» segna dove andare, e la mappa inquadra tutti e due;
l'avviso dice di quanto e in che direzione.

**Una parola con la penna alzata** (TASK-198, ADR-0157). Sulla mappa, qui
e durante la corsa, le lettere sono gialle come ogni percorso e i tratti a
piedi fra una lettera e l'altra sono tratteggiati, sotto, grigi e più
sottili: il token `walk` (`textMuted`, largo 3, opacità 0,9, trattini di 2
larghezze e spazi di 1,5, estremi dritti). Grigi e non gialli perché il
giallo è il disegno: così la parola si legge. Sotto il nome del percorso
una riga in più, «15.4 km of letters + 4.2 km walking between them»
(testo confermato dall'utente il 2026-10-03): i km delle lettere sono quelli che
la corsa registra e quelli a cui va la distanza chiesta; a parità di km le
lettere vengono 1,7 volte più alte e i tratti a piedi aggiungono il 20–30%.
La distanza in grande e quella delle tessere «A · B · C» restano di tutto
il percorso, tratti a piedi compresi (`distance_m`). **In bici**
(TASK-216, testo scelto dall'utente) fra le lettere si pedala: «15.4 km of
letters + 4.2 km riding between them» · «15,4 km di lettere + 4,2 km in
bici fra una lettera e l'altra» (attraverso `t()`; tedesco, spagnolo e
francese da confermare). Un risultato senza
`walks` (un'API più vecchia di TASK-197) o con `walks` che non stanno nei
`points` (l'app non si fida: `src/route/walks.ts`) si disegna come prima,
una linea sola, con lo stesso messaggio alla mappa di prima. Il percorso
con i `walks` non è chiuso: va dalla prima lettera all'ultima. Da
TASK-199 un preferito tiene anche i `walks`, e riaperto si mostra e si
corre come appena disegnato («Favorites»); uno tenuto prima è una linea
sola.

**La bici a mano** (TASK-206, ADR-0167). Un percorso in bici può avere
brevi tratti con la bici portata a mano (marciapiedi, sentieri, l'altro
senso di un senso unico): l'API li manda in `on_foot`. Sulla mappa, qui e
durante la corsa, la linea gialla resta **intera**, perché i tratti sono
parte del disegno, e sopra di loro corrono **trattini scuri**: il token
`onFoot` (`onAccent`, largo 2, opacità 0,9, trattini e spazi di 1,5
larghezze, estremi dritti), sopra il percorso e sotto i luoghi di un
percorso a tema e la corsa. Scelta dell'utente del 2026-10-03; scartati il
blu delle pagine di confronto (spezza la forma) e il giallo tratteggiato.
Con una parola a penna alzata in bici, la parte di un tratto che cade fra
una lettera e l'altra non si segna: lì la linea è già grigia. Nella scheda
l'avviso del motore «923 m of the route with the bike on foot» diventa una
riga grigia, da sapere: **«Includes 920 m walking the bike.»** (in
italiano «Di cui 920 m con la bici a mano.», approvati dall'utente, come
il tedesco, lo spagnolo e il francese il 2026-10-03), i metri arrotondati a 10,
da 1 km «1.1 km». Ogni tessera «A · B · C» ha i suoi. La distanza resta di
tutto il percorso, tratti a mano compresi, e la corsa li registra senza
pause. Un risultato senza `on_foot` (un'API più vecchia di TASK-206) o con
tratti che non stanno nei `points` (`src/route/onFoot.ts`, gli stessi
controlli dei `walks`) si disegna come prima, con lo stesso messaggio alla
mappa di prima.

## La navigazione

Sotto il risultato, «Start» giallo, quando il percorso ha le indicazioni di
svolta (TASK-049, ADR-0052). Anche sotto un percorso di «Explore», che le
chiede all'API al tocco (TASK-145). Si resta sulla schermata della mappa: al posto
di «←» un banner con la prossima svolta (freccia gialla, distanza dal GPS
dal vivo, «Turn left onto Via Roma», e una seconda riga per le svolte a
pochi metri da leggere insieme); sotto la mappa la scheda della corsa, con
pochi numeri e «Pause» (vedi «La corsa», qui sotto). La mappa segue la
posizione, vicina (zoom 17), e a fine corsa inquadra di nuovo il percorso.
Senza il permesso della posizione, o con la posizione del telefono spenta,
il banner dice «Location is off» e «Allow it for Sgrava in Settings to
follow the route.», con «Open Settings» che apre la pagina dell'app nelle
impostazioni del telefono (TASK-259).

**La corsa: due pagine, il conto alla rovescia, la pausa** (TASK-169,
ADR-0137), chiesta dall'utente con una registrazione di Nike Run Club come
riferimento. Uguale con un percorso e senza; sostituisce il pannello di
TASK-164, di cui tiene i numeri.

- **Il conto alla rovescia.** Una corsa nuova parte con «3», «2», «1» a
  tutto schermo, gialli su nero, e «Get ready». In quei tre secondi il GPS
  cerca la posizione e la mappa la segue, ma metri e tempo non contano
  ancora: la corsa parte dal punto in cui si è quando il conto finisce, in
  quell'istante, anche da fermi. Una corsa ripresa («Keep running»)
  riparte subito, senza conto.
- **Due pagine, una accanto all'altra**: «Map» a sinistra, «Data» a destra.
  Si passa con uno swipe (verso sinistra per «Data», verso destra per
  tornare a «Map») o toccando i due pulsanti in fondo; la corsa si apre su
  «Map». Lo swipe parte dalla scheda, non dalla mappa: lì un dito sposta
  la mappa. I due pulsanti si dividono la larghezza della scheda e sono
  alti 56 punti, più del tocco minimo: si prendono col pollice correndo
  (TASK-186). La pagina aperta ha la superficie più chiara e il bordo,
  come le altre scelte dell'app; il giallo resta del percorso.
- **«Map»**: la mappa con sopra il banner (la svolta, o la partenza senza
  percorso) e sotto tre numeri soli: «Distance» («2.34», km), «Pace now»
  (il passo degli ultimi 200 m) e «Time». Con un percorso, sotto, la barra
  gialla del percorso fatto, «3.2 km to go» e «about 17 min».
- **«Data»**: nessuna mappa. In alto quello che dice il banner (la svolta
  resta leggibile anche qui), poi i km in grande («2.34», «kilometres»),
  la barra del percorso, e sei riquadri: «Pace now», «Avg pace», «Time»,
  «Last km» (il passo dell'ultimo km intero), «Elev. gain» (i metri di
  salita) e «Calories». Sotto, i km uno per uno («Km · Pace · Change»:
  «2 · 5:14 · -0:06», l'ultimo in cima; prima del primo km «Your first
  kilometre will show here.»). Poi i due interruttori della corsa,
  «Auto-pause» e «Voice».
- **«Pause»**, un pulsante tondo e chiaro in mezzo, su tutte e due le
  pagine; da una parte «Pocket», dall'altra «Music». In pausa il tempo si ferma, le posizioni non
  entrano nella traccia e «Pace now» è «–»; la mappa continua a seguire, e
  con un percorso le svolte si dicono ancora. Su «Map» la scheda si alza
  e mostra i km e i sei riquadri, come su «Data»: la mappa sopra, i numeri
  sotto. Al posto di «Pause» ci sono **«Stop»** e **«Resume»** (giallo:
  è l'azione principale di una corsa ferma), con «Paused» sopra.
- **«Stop» si tiene premuto** un secondo: il pulsante si riempie di
  arancio e la corsa finisce. Un tocco non fa niente, e sotto compare «Hold
  to stop». Finché la corsa non ha la prima posizione (o senza permesso)
  c'è il vecchio «Stop» da toccare: non c'è niente da perdere. All'arrivo
  di un percorso resta solo «Finish».
- **La pausa da sola** («Auto-pause», accesa): dieci secondi senza una
  posizione nuova (fermi a un semaforo) mettono la corsa in pausa, «Paused:
  you stopped moving», e la voce dice «Paused.»; la prima posizione che si
  sposta la fa ripartire, «Resumed.». «Resume» funziona anche qui. Spenta,
  il tempo conta anche le soste.
- **«Voice»** (accesa): spenta, l'app non dice più niente, né svolte né
  km; la vibrazione delle svolte resta. Sotto, la lingua e la voce con cui
  parla, e «Listen» (TASK-209: «La voce della corsa», più giù).
- **«Music»** (TASK-173, ADR-0141): mentre si corre, di fronte a «Pocket»,
  su tutte e due le pagine. Apre Spotify, dove lo si era lasciato; a Sgrava
  si torna da soli (su iPhone, «◀» in alto a sinistra). Sgrava non suona
  niente e non sa cosa suona. La corsa non va in pausa, ma finché Sgrava
  sta dietro a Spotify non riceve posizioni. Su un telefono senza Spotify
  si apre la sua pagina nello store. In pausa, prima della prima posizione
  e all'arrivo il pulsante non c'è.
- **Dopo «Resume»** la prima posizione non si unisce all'ultima di prima:
  i metri fatti in pausa non sono della corsa. Lo stesso dopo «Keep
  running»: il tempo fra «Stop» e la ripresa è una pausa.
- **La penna alzata** (TASK-198; chiesta e confermata dall'utente il
  2026-10-02: «pausa automatica con avviso a voce»). Su una parola con i
  `walks`, quando il navigatore porta chi corre al primo punto di un tratto
  a piedi, la fine di una lettera, la corsa va in pausa da sola: una pausa
  di tipo nuovo, **«penna»** (`pen` nel file e nei controlli della corsa,
  accanto ad `auto`), che non si confonde con quella da fermi né con quella
  chiesta a mano. Riparte quando il navigatore porta chi corre a **20 m**
  dall'ultimo punto del tratto, l'inizio della lettera successiva
  (`PEN_DOWN_M`, metà di `POOR_FIX_M`, in `src/navigation/penUp.ts`). La
  voce, con una vibrazione, dice «Letter done. Walk to the U: the drawing is
  paused.» alla fine della lettera e «Pen down: draw the U.» all'inizio
  della successiva, una volta sola ciascuno e prima delle svolte della
  stessa posizione (testi confermati dall'utente il 2026-10-03; se la
  parola non ha una lettera più dei tratti, «the next letter»). Sulla scheda è una
  pausa come le altre: «Paused», «Resume» e «Stop». **Una forma a pezzi**
  (TASK-223), un percorso con i tratti a piedi e senza parola: «Part done.
  Walk to the next part: the drawing is paused.» e «Pen down: draw the next
  part.» · «Parte finita. Cammina fino alla parte successiva: il disegno è
  in pausa.» e «Giù la penna: disegna la parte successiva.»; in bici «Ride
  to the next part» · «Pedala fino alla parte successiva». Inglese e
  italiano **confermati dall'utente** il 2026-10-05; tedesco, spagnolo e
  francese da confermare (`src/voice/`). **In canoa** (TASK-226) «Part
  done. Paddle to the next part: the drawing is paused.» · «Parte finita.
  Pagaia fino alla parte successiva: il disegno è in pausa.», e la penna
  scende 5 m prima della parte invece di 20 (`PEN_DOWN_ON_WATER_M`):
  sull'acqua i tratti a penna alzata sono di poche decine di metri, e
  quello che si registra prima della parte è proprio il collegamento da
  non disegnare. La frase della canoa è **da confermare con l'utente**, in
  tutte e cinque le lingue.
  - **Perché 20 m, e lungo il percorso**: una posizione che la corsa tiene
    sbaglia fino a 40 m (`POOR_FIX_M`), in città 10–20 m. Ripartendo 20 m
    prima della lettera, anche una posizione in ritardo fa partire la
    registrazione sulla lettera; i metri di tratto a piedi che entrano così
    sono su un tratto a piedi, che il punteggio non guarda, e alla distanza
    aggiungono al più 20 m per lettera, più il passo fra due posizioni. Una
    posizione con un errore dichiarato oltre 40 m non muove la penna. Conta
    solo dove il navigatore mette chi corre lungo il percorso, mai la
    distanza in linea d'aria dall'inizio della lettera: la strada più breve
    può passare a pochi metri da una lettera dall'altra parte di un fiume e
    arrivarci dopo un ponte.
  - **Chi va per un'altra strada** durante un tratto a piedi esce dal
    percorso («Off the route») e la penna non si abbassa da sola finché il
    navigatore non lo ritrova: il percorso non si ricalcola (ADR-0052).
    «Resume» a mano riprende la registrazione.
  - **Una pausa chiesta a mano resta sua**: messa prima della fine di una
    lettera, o durante il tratto a piedi dopo un «Resume», l'inizio della
    lettera successiva non la toglie (la voce lo dice lo stesso). La
    ripartenza da sola toglie solo una pausa «penna»; «Resume» toglie
    qualsiasi pausa, anche quella. Una pausa da fermi alla fine di una
    lettera diventa «penna», così riprendere a camminare non la chiude, e
    durante una pausa «penna» la pausa da fermi non scatta.
  - Le **indicazioni di svolta** continuano anche a piedi: il percorso da
    seguire è uno solo, con i tratti a piedi. Tempo e distanza della corsa
    non contano i tratti a piedi, perché sono pause, e la prima posizione di
    ogni lettera non si unisce all'ultima della lettera prima.
  - Solo nell'app: con il GPX sull'orologio la pausa si mette a mano, ai
    waypoint «Pause» e «Resume» (TASK-197, `GPX.md`).
- **La bici a mano** (TASK-206, ADR-0167; frasi scelte dall'utente il
  2026-10-03). Su un percorso in bici con tratti a mano (`on_foot`) la
  voce, con una vibrazione, dice il tratto **100 m prima**
  (`ON_FOOT_AHEAD_M`, come una svolta in bici: TASK-216, ADR-0179; prima
  50 m): «In 100 metres, get off and walk the bike for 200 metres.» · «Tra
  100 metri, scendi e porta la bici a mano per 200 metri.»,
  con i metri che mancano e la lunghezza del tratto arrotondati a 10; e
  alla sua fine «Back on the bike.» · «Risali in bici.», tranne quando il
  tratto finisce all'arrivo. Se la prima posizione è già sul tratto, la
  frase senza «Tra … metri», con i metri che restano. Due tratti a meno di
  30 m si dicono come uno; sotto i 25 m un tratto non si dice (sulla mappa
  c'è). Una volta sola ciascuna, dopo le svolte della stessa posizione. La
  registrazione **non** va in pausa: il tratto a mano è disegno, e conta
  nel tempo e nel punteggio. `src/navigation/onFootVoice.ts`.

**In bici** (TASK-216, ADR-0179; scelte dell'utente del 2026-10-03).
«Start» su un percorso in bici apre una navigazione da bici. L'attività è
quella del percorso, non quella di «Settings»: da «Draw» quella con cui è
stato chiesto, da un preferito quella con cui è stato tenuto, da «Explore»
quella dell'esempio (oggi sempre la corsa). Solo `cycling` cambia: la
corsa, e un percorso senza attività, restano come prima, parola per parola.

- **La velocità al posto del passo**: su «Map» «Speed now» (km/h, sugli
  ultimi 200 m, come «Pace now»); su «Data» e in pausa «Speed now», «Avg
  speed», «Last km» (la velocità dell'ultimo km intero), «Elev. gain»,
  senza «Calories» (la stima è di una corsa: TASK-255); i km uno per uno
  sono «Km · Speed · Change», con la velocità
  a un decimale («24.0») e la differenza col km prima in km/h («-4.0» più
  lento, «+1.5» più veloce). In italiano «Vel. ora», «Vel. media», «Ultimo
  km», «Velocità» (approvati dall'utente; tedesco, spagnolo e francese da
  confermare); i numeri col punto, come gli altri della schermata.
- **La voce dei km ogni 10 km**, a 10, 20 e 30: «10 kilometres. Time: 25
  minutes 10 seconds. Average speed: 24 kilometres per hour.» · «10
  chilometri. Tempo: 25 minuti e 10 secondi. Velocità media: 24 chilometri
  orari.», la velocità a numero intero, detta a parole (la voce del telefono
  può leggere male «km/h»). Le pause non contano, e una pedalata che
  riprende non ridice i 10 km già detti. L'incitamento dopo i primi 5 km
  in bici non c'è.
- **Il confronto ogni 10 km** (TASK-217, ADR-0180; scelta dell'utente del
  2026-10-03), subito dopo la frase dei km, a 20 e a 30 km (a 10 non c'è
  niente prima): gli ultimi 10 km contro i 10 precedenti, in velocità e
  **senza numeri**. «The last 10 kilometres were faster than the 10
  before.» / «… slower …» · «Ultimi 10 chilometri più veloci dei 10
  precedenti.» / «… più lenti …». Entro 0,5 km/h (compresi): «The last 10
  kilometres were at the same speed as the 10 before.» · «Ultimi 10
  chilometri alla stessa velocità dei 10 precedenti.» (proposta
  dell'agente, frase e soglia **confermate dall'utente** il 2026-10-05). «km» è detto
  per intero, come nella frase dei km. Le pause non contano.
- **Le svolte 100 m prima** (`RIDE_ANNOUNCE_M`), con la distanza detta
  («In 100 metres, turn left onto Via Roma»), e così i tratti con la bici a
  mano. Perché 100 m: a 20 km/h la svolta arriva in mediana 16 s dopo
  l'inizio della frase, come a 5:30 /km con 50 m; oltre non si guadagna,
  perché in bici le svolte distano in mediana 99 m (ADR-0179, misurato su
  Trento).
- **La penna alzata in bici**: alla fine di una lettera «Letter done. Ride
  to the U: the drawing is paused.» · «Lettera finita. Pedala fino alla U:
  il disegno è in pausa.» («the next letter» · «la lettera successiva»
  quando la parola non dice quale); «Pen down: draw the U.» come a piedi.
  La pausa «penna» è la stessa.
- **Come nella corsa**, per ora: la fine della corsa (il riepilogo col
  passo), le calorie (stimate per la corsa), la corsa senza percorso.

**L'aspetto della corsa** (TASK-204, ADR-0163; chiesto dall'utente il
2026-10-03: «migliora la parte grafica», e confermato lo stesso giorno,
«Pause» sotto il pulsante compreso). Stessi numeri, comandi e testi;
cambia come si leggono:

- **I numeri**: il valore grande con l'unità accanto, piccola («5:11 /km»),
  e il nome sotto, piccolo, maiuscolo e spaziato («PACE NOW»). Su «Map» i
  tre numeri non hanno riquadri: la distanza per prima e più grande
  (40 punti contro 25), separati da una riga sottile. I sei riquadri di
  «Data» e della pausa restano, nello stesso ordine.
- **I pulsanti tondi**: «Pocket» (un telefono disegnato) e «Music» (una
  nota) sono tondi, di 56 punti, accanto a «Pause» di 72, alla stessa
  altezza; ognuno ha il nome sotto, anche «Pause», come «Stop» e «Resume».
- **«Paused»** sta in una pillola chiara con il segno della pausa, sopra
  «Stop» e «Resume».
- **I km di «Data»**: accanto a ogni km una barra, lunga quanto il km è
  stato veloce fra quelli corsi (il più veloce intero, il più lento a
  0,35); la più veloce è chiara, le altre grigie, mai gialle. Con un km
  solo, o tutti uguali, le barre sono intere e grigie.
- **Gli interruttori** «Auto-pause» e «Voice» sono disegnati: acceso, la
  pista chiara e il pallino scuro a destra; spento, la pista scura e il
  pallino grigio a sinistra.
- **I banner**: la freccia della svolta (gialla) o della partenza (ciano)
  sta in un disco scuro di 56 punti. La barra del percorso fatto è alta
  8 punti.
- **Il conto alla rovescia**: ogni numero entra rimpicciolendo, mentre un
  anello giallo si allarga e svanisce in poco meno di mezzo secondo;
  «GET READY» sotto, maiuscolo.

Le icone sono disegnate con le `View`, come la pausa e il «play»: nessuna
libreria di icone. Il riquadro di fine corsa senza percorso usa gli stessi
sei riquadri e ne prende l'aspetto.

I passi compaiono dopo 100 m, prima c'è «–»; «Pace now» torna «–» anche da
fermi (più lenti di 20:00 /km). «Elev. gain» è «–» se il telefono non dà
la quota; conta le salite di almeno 3 m, perché la quota del GPS oscilla.
«Calories» è una stima da 70 kg (il peso non è ancora nel profilo): circa
una kilocaloria per kg e per km, e si vede solo correndo (in bici sarebbe
il triplo del vero: TASK-255, scelta dell'utente). Il battito non c'è: il telefono non lo
misura, e un sensore si collega solo in una build propria (seguiti in
`tasks/TASK-169.md`). Sotto il banner della svolta restano le due
etichette piccole di TASK-164: «42% drawn» e il punto cardinale («NE»).
Con un percorso la voce dice anche ogni km, come senza («1 kilometre.
Time: … Average pace: …»), dopo la svolta se cadono insieme, e dal secondo
km il confronto col km precedente (TASK-217: «Correre senza percorso»,
più giù).

**La freccia di direzione** (TASK-164). Mentre si corre il segnaposto sulla
mappa è una freccia chiara, girata dove si sta andando; la mappa resta col
nord in alto, o **girata come il disegno** quando il percorso è inclinato
(TASK-232, scelta dell'utente: chi corre vede la forma dritta come l'ha
scelta). La freccia segna sempre dove si va davvero: è girata con la
mappa. Il fatto e il da fare sono linee della mappa e girano con lei. La
freccia del nord c'è anche qui, sotto il riquadro della svolta, con gli
stessi due tocchi; la scelta vale fino alla fine della corsa. La direzione viene dalla traccia, dagli ultimi 10 m: serve
qualche passo perché compaia (prima c'è il segnaposto di sempre), e da
fermi resta quella di prima. A fine corsa torna il segnaposto.

**Il fatto e il da fare** (TASK-224, ADR-0186; chiesto dall'utente il
2026-10-03, stile approvato su un'anteprima). Mentre si corre un percorso,
la parte già corsa resta la linea gialla piena di sempre; la parte ancora
da fare è **gialla, tratteggiata e lampeggia**: 0,7 s accesa, 0,7 s
attenuata (opacità 0,3, mai spenta, così la strada si legge sempre), a
scatti e senza dissolvenza, così la mappa si ridisegna due volte ogni
1,4 s e non a ogni fotogramma (`routeAhead` nei token). Il taglio è dove il
navigatore mette chi corre (`alongM`), a passi di 5 m; dopo «You have
arrived» tutto il percorso è pieno, e a fine corsa torna intero.
- **Fermo**, sempre acceso: con «Pocket» (lo schermo nero, dove nessuno
  lo vede) e con «Riduci movimento» del telefono.
- **Con la penna alzata** si tagliano solo le lettere: i tratti a piedi fra
  una lettera e l'altra restano grigi, tratteggiati e fermi.
- **Con la bici a mano** i trattini scuri restano sopra, sia sul fatto sia
  sul da fare.

Ogni svolta si dice a voce 50 m prima («In 50 metres, turn left onto Via
Roma, then turn right onto the footpath»; in bici 100 m, «In bici» qui
sopra), con una vibrazione, nella lingua
della voce: in inglese finché non se ne sceglie un'altra («La voce della
corsa», sotto). Una via senza nome è «the footpath», «the
path», «the road»: mai un nome inventato. Se accanto corre una via con nome
(dedotta dall'API, ADR-0057), la si dice con «beside»: «Turn left onto the
footpath beside Via Roma», sul banner e a voce (ADR-0058). Oltre 40 m dal percorso per almeno
tre posizioni di fila e 8 secondi il banner diventa arancio, «Off the
route», e la voce lo dice una volta, con una vibrazione; il percorso non si
ricalcola. Il marciapiede opposto e un GPS che sbaglia per qualche secondo
non bastano, e una posizione con un errore dichiarato oltre 40 m non conta;
una via parallela sbagliata sì (ADR-0070). Dopo due posizioni di fila sul
percorso, «Back on the route». Alla fine, «You have arrived», alla seconda
posizione di fila entro 25 m dalla fine (TASK-253, ADR-0217): una sola, o
una con un errore dichiarato oltre 40 m, non basta, perché l'arrivo chiude
la registrazione. Dove il percorso ripassa dallo stesso punto entro 300 m
(un baffo, un incrocio) la posizione resta sul passaggio più vicino a dove
si era: andare avanti lungo il percorso costa un quarto di metro al metro,
andare indietro un metro al metro, e fra i punti del percorso entro 40 m
vince il più economico (ADR-0217). Dopo «Stop» e «Keep running», o dopo
l'app chiusa a metà corsa e riaperta (in pausa, TASK-272: «La corsa
interrotta si riapre in pausa», sotto), il navigatore riparte da dove la traccia era
arrivata, ripassando in silenzio le posizioni registrate: la prossima
svolta detta è quella davanti, le lettere già disegnate restano disegnate,
e «Head out on …» non si ripete. **Lo schermo resta acceso da solo per
tutta la corsa** (TASK-255, ADR-0219: scelta dell'utente del 2026-10-06),
con o senza la modalità tasca. **Nell'app costruita (non in Expo Go) la
corsa registra anche a telefono bloccato** o con un'altra app davanti
(il telefono bloccato a mano, una telefonata, «Music» che apre Spotify):
TASK-261, ADR-0225, con il solo permesso «While using». iOS mostra in
alto la pillola blu, che riporta a MuW; la linea, i metri, i km e la
pausa automatica vanno avanti come con l'app davanti, e la voce parla
solo se iOS la lascia parlare (a schermo bloccato no: un task suo). Se
iOS congela comunque l'app, il GPS si ferma con lei: tornata entro 60
secondi la linea continua; oltre, quel tempo è una pausa e la linea
riparte da dove si è, senza riga dritta. In Expo Go (e su Android) il GPS
si ferma ogni volta che l'app va in secondo piano, con la stessa regola
dei 60 secondi (scelta dell'utente). La finestra del permesso di
posizione ha un testo suo nelle cinque lingue, nella lingua del telefono.
La posizione non esce dal telefono.

**La voce della corsa** (TASK-209, ADR-0171; chiesto dall'utente il
2026-10-03: «scegliere la voce e la lingua della voce»). In «Data», sotto
«Auto-pause» e «Voice», una riga dice chi parla e in che lingua («English ·
Default», «Italiano · Alice»), con «›»; accanto, un tondo con il segno del
play, **«Listen»**, che dice una svolta d'esempio («In 50 metres, turn left
onto Via Roma», nella lingua scelta). Toccata la riga, dal basso sale un
foglio con due elenchi: **«Language»**, prima «App language» (con sotto la
lingua dell'app di adesso) e poi le cinque lingue, ognuna nel suo nome
(English, Deutsch, Italiano, Español, Français, l'ordine dell'utente); e
**«Voice»**, prima «Default» (la voce del telefono per quella lingua) e poi
le voci installate sul telefono per quella lingua, di ogni paese («Daniel»,
«en-GB · Enhanced»), per nome. Un tocco sceglie e resta; «Done» o un tocco
fuori chiude. Con «Voice» spenta la riga resta e si può cambiare, ma
«Listen» è spento e non parla nessuno.

- **Prima di ogni scelta** la voce segue la lingua dell'app (TASK-210),
  con la voce di sistema: oggi, in inglese, esattamente le frasi di prima
  (`en-US`). Scelta una lingua solo per la voce, lo schermo non cambia: il
  banner segue la lingua dell'app.
- **Ricordata sul telefono** (`voice.json` nei documenti, come lo sport):
  la lingua (o «App language») e una voce per ogni lingua, così tornando a
  una lingua torna la sua voce. Vale dalla frase successiva, anche a metà
  corsa.
- **Una voce sparita** dal telefono: parla la voce di sistema della stessa
  lingua, senza errore. **Una lingua senza nessuna voce** sul telefono: la
  voce parla inglese, e il foglio lo dice («This phone has no Français
  voice: the voice speaks English.»). Finché il telefono non ha detto
  quali voci ha, nessuna voce si chiede per nome (iOS, per una voce che
  non trova, non dice niente); lo si aspetta al massimo 3 secondi, e se
  non risponde il foglio ha solo «Default», con «This phone did not list
  its voices: its own voice speaks.» (nel simulatore iOS 27 l'elenco è
  arrivato dopo minuti: riaprendo il foglio le voci compaiono).
- **Cosa dice**, in ogni lingua: le svolte con la distanza e il «poi», la
  partenza, le vie senza nome per tipo (mai un nome inventato; i nomi
  delle vie mai tradotti), «beside», fuori e di nuovo sul percorso,
  l'arrivo, la pausa da fermi e la ripresa, la penna alzata, ogni km con
  tempo e passo e il confronto col km precedente (TASK-217), la bici a mano (TASK-206), in bici i km ogni 10 con la velocità media e la penna alzata
  pedalando (TASK-216: tedesco, spagnolo e francese da confermare). Il
  numero uno detto a parole dove si accorda («Un chilometro», «un'ora»,
  «eine Minute»). Le frasi sono in `src/voice/`, una tabella per lingua;
  quelle in inglese sono le stesse di prima, parola per parola.
- **Dopo i primi 5 km**, una volta sola e subito dopo l'annuncio del
  quinto km, la voce incita: **«Daje, avanti tutta!»** (chiesto
  dall'utente il 2026-10-03). Nelle altre lingue: «Come on, full speed
  ahead!», «Los, volle Kraft voraus!», «¡Vamos, a toda máquina!», «Allez,
  en avant toute !».
- **Testi**: le frasi italiane sono **confermate dall'utente** (2026-10-03),
  e lo sono anche le spagnole, francesi e tedesche: l'utente le ha
  ascoltate e approvate lo stesso giorno. Lo stesso giorno ha confermato
  anche quelle della bici a mano (TASK-206) in tedesco, spagnolo e francese,
  con «Includes … walking the bike.», e i testi della penna alzata
  (TASK-198). Restano da confermare le frasi nuove della bici (TASK-216) in
  tedesco, spagnolo e francese, e quelle dei pezzi di una forma (TASK-223)
  in tedesco, spagnolo e francese (inglese e italiano confermati il
  2026-10-05). Quelle del confronto dei km (TASK-217), con «stessa
  velocità» in bici, sono **confermate dall'utente** il 2026-10-05 in tutte
  e cinque le lingue. Le parole del foglio («App
  language», «Language», «Voice», «Default», «Listen», «Done») sono in
  inglese come il resto dello schermo: le traduce TASK-210.

| | Italiano (confermato dall'utente il 2026-10-03) |
|---|---|
| Svolta | «Tra 50 metri, svolta a sinistra su Via Roma, poi svolta a destra sul sentiero» |
| Partenza | «Parti lungo Via Roma» |
| Accanto | «Svolta a sinistra sul percorso pedonale accanto a Via Rosmini» |
| Fuori, di nuovo, arrivo | «Sei fuori percorso. Torna sul percorso.» · «Di nuovo sul percorso.» · «Hai raggiunto l'arrivo.» |
| Pausa, ripresa | «In pausa.» · «Si riparte.» |
| Penna alzata | «Lettera finita. Cammina fino alla A: il disegno è in pausa.» · «Giù la penna: disegna la A.» |
| Km | «Un chilometro. Tempo: 5 minuti e 42 secondi. Passo medio: 5 minuti e 42 secondi al chilometro.» |
| Dopo 5 km | «5 chilometri. Tempo: 25 minuti. Passo medio: 5 minuti al chilometro. Daje, avanti tutta!» |
| Bici a mano (TASK-206) | «Tra 100 metri, scendi e porta la bici a mano per 200 metri.» · «Risali in bici.» |
| Penna alzata in bici (TASK-216) | «Lettera finita. Pedala fino alla U: il disegno è in pausa.» |
| Km in bici, ogni 10 (TASK-216) | «10 chilometri. Tempo: 25 minuti e 10 secondi. Velocità media: 24 chilometri orari.» |
| Km sull'acqua (TASK-251) | «Un chilometro. Tempo: 12 minuti. Passo medio: 6 minuti ogni 500 metri.» |

**Modalità tasca** (TASK-070, ADR-0066). Accanto a «Pause», «Pocket»: lo
schermo diventa nero, la luminosità va al minimo e resta acceso, e i tocchi
non fanno niente; voce, vibrazione e GPS vanno avanti come prima. Si esce
tenendo premuto lo schermo 2 secondi: in basso, fioca, «Hold for 2 seconds
to leave pocket mode», e «Keep holding…» mentre si preme. La prima volta
per avvio dell'app un avviso, «Pocket mode», con «Cancel» e «Go dark»: «The
screen goes dark but stays on, so directions go on. Do not lock the phone:
if you press the side button, directions stop. To come back, hold the
screen for 2 seconds.» La luminosità torna com'era all'uscita, all'arrivo
(che toglie anche il pulsante), con «Stop» e quando l'app esce dal primo
piano.

**La traccia della corsa** (TASK-112, ADR-0091). Durante la navigazione
l'app tiene la linea di quello che si è corso: ogni posizione del GPS,
tranne quelle con errore oltre 40 m e quelle a meno di 5 m dalla
precedente, con distanza e durata. Anche in modalità tasca. La traccia sta
in un file nei documenti dell'app (`current-run.json`), insieme al percorso
pianificato: si scrive alla prima posizione, poi al più ogni 15 secondi, a
«Stop» e all'arrivo, e resta lì se l'app viene chiusa. Una corsa per volta:
«Start» sullo stesso percorso entro 30 minuti continua la traccia, un altro
percorso la sostituisce alla prima posizione. La traccia non esce dal
telefono: la usano i numeri della corsa e la schermata di fine corsa
(TASK-113). Da TASK-169 nel file ci sono anche le pause (da quando a
quando, e se sono venute da sole), scritte subito, la quota di ogni
posizione quando il telefono la dà, e il segno sulla prima posizione dopo
una pausa; la durata è il tempo senza le pause. Un file di prima si legge
come sempre. Da TASK-198 una pausa «penna» ha `pen: true`, e il file di
una parola a penna alzata ha anche i `walks` del percorso, per il
punteggio; quello di ogni altro percorso è come prima. Da TASK-272 il file
tiene anche quello che serve alla voce, quando il percorso ce l'ha: le
indicazioni (`directions`), la parola (`word`) e i tratti con la bici a
mano (`on_foot`).

**La corsa interrotta si riapre in pausa** (TASK-272, ADR-0240; scelta
dell'utente del 2026-10-10). Se l'app si chiude durante la corsa (chiusa a
mano, o fermata da iOS), riaprendo MuW entro **2 ore** dall'ultima
posizione si apre la schermata della corsa, **in pausa**: lo stesso
percorso sulla mappa, con la parte corsa e la prossima svolta, i numeri
della traccia fin lì, «Paused», «Resume» e «Stop» da tenere premuto.
Niente conto alla rovescia e niente «Head out on …». Il tempo con l'app
chiusa, e quello in pausa dopo, è una pausa: non conta nella durata, e la
prima posizione dopo «Resume» non si unisce alla linea di prima; se nel
frattempo si è andati avanti, il navigatore ritrova chi corre più avanti
sul percorso (TASK-270). Chiusa durante una pausa della penna, fra due
lettere, la lettera dopo la chiude da sé come sempre. «Stop» tenuto apre
la fine della corsa come sempre, e poi si torna alla prima schermata. Una
corsa interrotta da più di 2 ore apre invece la sua fine, da salvare o da
lasciare, come prima. Nessun testo nuovo. Lo stesso per la corsa senza
percorso («Correre senza percorso», sotto).

**Con le miglia** (TASK-182 parte C, ADR-0149 «aggiornamento (parte C)»;
scelta dell'utente del 2026-10-03, «come fa Strava»). Con «Miles» in
«Settings» la corsa si mostra e si dice in miglia, subito, anche a corsa
iniziata; con «Kilometres» ogni scritta e ogni frase è quella di prima.

- **Il banner della svolta**: la distanza in piedi, ai cinquanta («350
  ft», mai «0 ft»), e da 1000 piedi in miglia con un decimale («0.6 mi»).
- **I numeri** (sotto la mappa, in pausa e su «Data»): la distanza in
  miglia con due decimali e «mi» accanto («2.30 mi»; su «Data», sotto il
  numero grande, «miles»); «Pace now» e «Avg pace» in «/mi» («8:03 /mi»);
  al posto di «Last km», **«Last mi»**, l'ultimo miglio intero; lungo un
  percorso «2.0 mi to go», sotto i 1000 piedi «400 ft to go». «Elev.
  gain» resta in metri e «Calories» in kcal.
- **I parziali di «Data»** sono un miglio ciascuno: la colonna «Mi» al
  posto di «Km», una riga per ogni miglio intero con il suo passo e il
  cambio sul miglio prima («Mile 2: 9:39, +1:37» per chi ascolta lo
  schermo); prima del primo miglio «Your first mile will show here.». Li
  calcola il telefono dalla traccia, che resta in metri: quello che avanza
  dopo l'ultimo miglio intero non è una riga, le pause sono escluse come
  nei km.
- **In bici** la velocità è in **mph** («Speed now», «Avg speed», «Last
  mi»: «12.4 mph»), e i parziali dicono la velocità di ogni miglio («Mile
  2: 12.4 mph, -2.5»).
- **La voce** dice ogni miglio al posto di ogni km, con il tempo e il
  passo medio al miglio, e dal secondo il confronto col miglio prima
  (stesse soglie: entro 2 secondi, compresi, è lo stesso passo).
  L'incitamento arriva dopo il **terzo miglio** (4,8 km: il più vicino ai
  5 km). In bici la voce parla **ogni 5 miglia** (8 km) al posto di ogni
  10 km, con la velocità media in miglia orarie intere, e dal decimo
  confronta le ultime 5 con le 5 prima, senza numeri (entro 0,5 km/h,
  compresi, è la stessa velocità). **Le svolte e i tratti con la bici a
  mano si dicono in piedi**, ai cinquanta: i punti in cui la voce parla
  restano quelli di prima (50 m a piedi, 100 m in bici), cambiano solo le
  parole («In 150 feet…», «In 350 feet…»). Le frasi della penna, della
  pausa, del fuori percorso e dell'arrivo non hanno distanze: restano
  quelle. «Listen», sotto «Voice», fa sentire la svolta in piedi.
- Se l'unità cambia a corsa iniziata, la voce non ridice quello che è già
  passato: dice il prossimo miglio (o km) intero.

Le frasi nuove, in inglese e in italiano (**scritte dall'agente, da
confermare con l'utente**; tedesco, spagnolo e francese in
`src/voice/{de,es,fr}.ts`, anche quelle da confermare):

| Caso | Inglese | Italiano |
|---|---|---|
| ogni miglio | «1 mile. Time: 8 minutes 3 seconds. Average pace: 8 minutes 3 seconds per mile.» / «2 miles. …» | «Un miglio. Tempo: 8 minuti e 3 secondi. Passo medio: 8 minuti e 3 secondi al miglio.» / «2 miglia. …» |
| miglio più veloce | «12 seconds faster than the last mile.» | «Questo miglio: 12 secondi meglio del precedente.» |
| miglio più lento | «8 seconds slower than the last mile.» | «Questo miglio: 8 secondi peggio del precedente.» |
| stesso passo | «Same pace as the last mile.» | «Stesso passo del miglio precedente.» |
| bici, ogni 5 miglia | «5 miles. Time: 20 minutes. Average speed: 15 miles per hour.» | «5 miglia. Tempo: 20 minuti. Velocità media: 15 miglia orarie.» |
| bici, più veloce | «The last 5 miles were faster than the 5 before.» | «Ultime 5 miglia più veloci delle 5 precedenti.» |
| bici, più lento | «The last 5 miles were slower than the 5 before.» | «Ultime 5 miglia più lente delle 5 precedenti.» |
| bici, stessa velocità | «The last 5 miles were at the same speed as the 5 before.» | «Ultime 5 miglia alla stessa velocità delle 5 precedenti.» |
| una svolta | «In 150 feet, turn left onto Via Roma» | «Tra 150 piedi, svolta a sinistra su Via Roma» |
| la bici a mano | «In 350 feet, get off and walk the bike for 650 feet.» | «Tra 350 piedi, scendi e porta la bici a mano per 650 piedi.» |

## La fine della corsa

«Stop» tenuto premuto, dalla pausa (TASK-169), o «Finish» all'arrivo,
chiude la corsa e apre la schermata di fine corsa (TASK-113, ADR-0093), se
la traccia ha almeno due posizioni; se no si torna al risultato come
prima. Sulla mappa il percorso giallo e, sopra, più sottile e chiara
(`track` nei token), la linea di quello che si è corso. In alto «Your run»
con la legenda «Yellow: the route. White: what you ran.». Sotto, una
riga sola: «4.0 km · 32 min», distanza e durata della corsa. **Niente
punteggio** (TASK-241 parte E, ADR-0207, scelta dell'utente: «solo km e
tempo»): l'app non lo mostra e a fine corsa **non chiede più `POST
/track-scores`**, quindi non ci sono né un'attesa né «Try again». Il
punteggio lo calcola ancora l'API da sé per le corse salvate, e non si
vede da nessuna parte.
Con le miglia (TASK-182 parte C) la riga dice la distanza in miglia: «2.5
mi · 32 min» (sotto i 1000 piedi, in piedi); quello che «Save» tiene resta
in metri.

Con una parola a penna alzata (TASK-198) la mappa ha i tratti a piedi
tratteggiati. Con «Save» le pause «penna» vanno in «My
activities» con le altre, come pause di chi corre (`auto: false`), e da
TASK-199 con `pen: true` e i `walks` del percorso: il punteggio che l'API
di «My activities» calcola da sé è delle sole lettere, come qui, e la
corsa riaperta da lì ha i tratti a piedi tratteggiati («My activities»).
Il GPX per Strava (TASK-187) apre un segmento nuovo a ogni pausa: Strava
mostra le lettere unite da linee dritte sulla base.

- **Senza rete o senza API** la schermata è la stessa: non chiede niente
  a nessuno.
- **«Keep running»**, dopo uno «Stop» e con il percorso ancora sullo
  schermo: torna alla navigazione, e la traccia continua (ADR-0091).
- **«Done»**: torna al risultato, o alla prima schermata se il percorso
  non c'è più, e la traccia si cancella dal file della corsa. «Done» c'è
  solo senza account.
- **Con un account, «Save» e «Discard»** al posto di «Done», sotto la
  scheda, larghi mezza riga l'uno (TASK-172, chiesto dall'utente il
  2026-10-02: prima di salvare, una schermata che lo chiede). **«Save»**
  mette la corsa in «My activities» (sopra) e torna dove tornava «Done»;
  la corsa lascia il file, e l'API la giudica da sé. **«Discard»**, in rosso, chiede prima sulla scheda stessa:
  «Discard this run? It will not be saved.», con «Keep it» e «Discard
  run»; poi la corsa sparisce dal telefono e non va da nessuna parte.
  Finché non si tocca né l'uno né l'altro niente è salvato; «Keep running»
  resta nella scheda. Se il telefono non riesce a scrivere la corsa: «This
  run could not be kept on the phone. Try again.», e si resta lì. Nessuno
  dei due è giallo.
- **Il logo dopo «Save»** (TASK-212, ADR-0174; chiesto dall'utente il
  2026-10-03): tenuta la corsa, sopra l'app sale il giallo `accent`
  dell'avvio con il logo intero, che cresce un poco; resta 1,1 s e si
  dissolve sulla schermata dove «Save» porta (in tutto 1,65 s). Un tocco
  lo chiude prima. Anche senza rete, con la corsa che aspetta sul telefono
  (scelta dell'utente); mai se il telefono non tiene la corsa, né a
  «Discard». Al lettore di schermo: «Saved to My activities». Sta in
  `src/intro/SavedLogo.tsx`, in `Root` sotto l'animazione d'avvio.
- **Il modulo del disegno, come su Strava** (TASK-117, ADR-0159,
  ADR-0166; TASK-208, ADR-0170; le scelte dell'utente del 2026-10-03 e le
  sei proposte confermate il 2026-10-06), sopra Strava, solo con un
  account, in un riquadro che scorre (al più metà schermo, così la mappa e
  «Save» restano in vista). Nell'ordine scelto dall'utente:
  1. **le foto**: «Add photo» chiede «Choose a picture» o «Take a photo»
     («Cancel» chiude), fino a tre, ognuna con la sua «×»; il telefono le
     riduce a 1080 px sul lato lungo (JPEG, senza EXIF) e le tiene con la
     corsa. Fotocamera negata: la riga rossa di sempre e «Open Settings»;
  2. **«Title»** («Give it a name», al più 60 caratteri): **un solo
     campo** (scelta dell'utente) che dà il nome al disegno e, con «Send to
     Strava» acceso, alla corsa su Strava;
  3. **«How did it go?»**: la descrizione, vuota, su più righe, al più 500
     caratteri; va anche su Strava, mai filtrata (scelta dell'utente);
  4. **«Tag people»**: le persone taggate in pillole, con la «×»; il tasto
     apre un foglio dal basso con la ricerca per nome di «Find friends»
     (TASK-215): un nome toccato lo tagga e chiude il foglio. Al più 10;
  5. **«Activity»**: «Run», «Bike», «Paddle», **scelta in partenza dallo
     sport di «Settings»**; va anche a Strava come tipo (`Run`, `Ride`,
     `StandUpPaddling`); non cambia il punteggio;
  6. **«Who can see it»**: «Everyone», «Followers», «Only me», **«Only me»
     a ogni corsa** (scelta dell'utente: non ricorda la volta prima); sotto,
     con «Everyone», «Every member sees it in your profile, without the
     first and last 200 m.», con «Followers» «Your followers see it in
     your profile, without the first and last 200 m.»; con «Only me» e
     delle foto, «Photos of a run only you can see stay on this phone.
     Delete the app or change phone and they are gone.» (ADR-0170, punto
     7: le foto delle corse private sono del telefono).

  Con **«Save»** la corsa va all'API e, appena l'API l'ha, la scelta
  intera (`PUT /me/activities/{key}/drawing`) e poi le foto, **solo con
  «Everyone» o «Followers»**; con niente di scelto (né titolo, né
  descrizione, né tag, corsa a piedi, «Only me») non va niente in più, e
  le foto restano sul telefono. Il disegno va **prima di Strava**, che ne
  prende descrizione e tipo. Senza rete aspettano con la corsa e partono
  dopo di lei; un'API che rifiuta di pubblicare una corsa troppo corta
  tiene il resto della scelta, per il solo proprietario. Cambiare idea
  dopo si fa dalla corsa in «My activities», con lo stesso modulo.
- **«Send to Strava»** (TASK-187, ADR-0156), sopra «Save» e «Discard», solo
  se l'API ha Strava (`GET /me/strava` dice `available`; un'API senza
  Strava, o più vecchia, e niente si vede). Atleta non collegato:
  **«Connect with Strava»**, il pulsante ufficiale di Strava così com'è
  (TASK-218, ADR-0181: l'immagine arancione del suo pacchetto, 237 × 48
  pt, scritta in inglese in ogni lingua; VoiceOver lo legge nella lingua
  dell'app), e sotto «Connect Strava, and Save sends your runs there
  too.»; il tocco apre la pagina di Strava nel browser (o nell'app
  Strava), e tornati in Sgrava la riga si aggiorna da sola. Mentre si apre
  il pulsante resta uguale e accanto gira una rotellina.
  Collegato: l'interruttore **«Send to Strava»**, acceso la prima volta e
  poi come lo si è lasciato (scelta dell'utente, sul telefono, in
  `strava.json`), con sotto le parole il logo ufficiale **«Compatible
  with Strava»**, bianco, alto 16 pt (TASK-218; VoiceOver legge solo
  l'interruttore); acceso, sotto, «To Ada Lovelace's Strava, with Save.».
  Il nome su Strava è il **«Title»** sopra (TASK-117: prima era un campo
  «Name on Strava» suo): vuoto, l'API dà «Heart in Trento», o per una
  corsa libera il nome di Strava. Con l'interruttore acceso **«Save»**
  salva la corsa e poi la manda a Strava, con il titolo scritto (scelta
  dell'utente: modificabile prima di «Save»); spento, o con «Discard», a
  Strava non va niente. Senza rete la
  corsa aspetta sul telefono con la sua scelta, va all'API e poi a Strava
  alla prossima apertura con la rete, una volta sola (sotto, «Cosa esce dal
  telefono»).
- **Senza account**, sotto la scheda, la riga «Sign up or log in to keep
  your runs and share them as drawings.» (TASK-117), che apre «Profile».

Niente nella scheda è giallo: il giallo resta del percorso e dell'azione
principale.

## Il post da condividere (TASK-231, ADR-0194)

«Share» sta sulla scheda di fine corsa (con un percorso e senza) e sulla
scheda di una corsa in «My activities». Apre a tutto schermo «Share your
run», con «Close» in alto a sinistra:

- **Il post**, in alto: 9:16, sul giallo di Sgrava. Il cuore del logo e
  «Sgrava», il titolo (quello della corsa, o luogo e forma; nessuno a
  fine corsa), il disegno della corsa in nero **senza i primi e gli ultimi
  200 m**, e in basso i risultati accesi, due per riga: «Distance»,
  «Time», «Pace» (il passo manca sotto i 100 m). **Il punteggio non è fra i risultati**
  (TASK-241 parte C, chiesto dall'utente): non si può accendere, non è
  sul post e non va nel testo per Strava.
- **«Results»**: una pastiglia per risultato, accesa all'inizio; spenta,
  il risultato sparisce dal post e dal testo per Strava.
- **«Add emoji»**: 🔥 ❤️ 💪 🏃 🎉 😅 🥵 😎 ⚡ 🏆 ☀️ 🌧️. Un tocco mette l'emoji
  sul post, in un posto libero attorno al disegno; si trascina dove si
  vuole e un tocco la toglie («Drag the emoji to move them. Tap one to take
  it off.»). Al più cinque: «Up to 5 emoji: tap one on the post to take it
  off.». Con VoiceOver l'emoji è un pulsante con il suo nome, e il doppio
  tocco la toglie.
- **«Instagram»**, giallo: fa l'immagine del post («Making the
  picture…») e apre il foglio di condivisione di iOS. Sotto: «Pick
  Instagram in the list: Story, Feed or Messages.». Errori: «This phone
  cannot open the share sheet.», «The picture could not be made. Try
  again.».
- **Strava**, sotto, solo se l'API ha Strava: «Connect with Strava» se
  l'atleta non è collegato; a fine corsa, prima di «Save»: «To send this
  post to Strava, save the run, then share it from «My activities».». Su
  una corsa salvata: «Send to Strava» manda la corsa con il testo del post
  (emoji e risultati accesi) in cima alla descrizione; poi «View on
  Strava». Una corsa già su Strava: «Update on Strava» (solo se il post ha
  qualcosa da dire) mette il testo del post in cima a quello che c'è là,
  poi «The activity on Strava has this post's text now.»; se Strava non lo
  lascia fare, «Strava did not let Sgrava change this activity. Change its
  text on Strava.»; e «View on Strava». Sotto, sempre: «Strava takes no
  pictures from other apps: keep this one in Photos with «Save Image» and
  add it there.» (TASK-231 B).
- **Il post resta sul server** (TASK-258, ADR-0222; scelte dell'utente):
  su una corsa salvata, quando il foglio di condivisione si è aperto o
  la corsa è andata a Strava, l'app manda all'API gli emoji con la loro
  posizione, i risultati accesi e il titolo — mai l'immagine. Niente
  cambia sullo schermo e niente si dice se non arriva. Riaprendo «Share»
  da «My activities» il post torna com'era: stessi emoji nelle stesse
  posizioni, stessi risultati accesi (un risultato che la corsa non ha
  più non compare). A fine corsa, prima di «Save», il post si condivide
  come prima e non resta.

## Sull'acqua: «Paddle» (TASK-191, ADR-0169)

Con «Paddle» scelto (in «Settings» o dal pulsante dello sport) i percorsi
sono forme disegnate **sull'acqua** di un lago o del mare, entro 1 km dalla
riva, con partenza e arrivo sulla riva (il motore: ADR-0154, ADR-0161;
l'API: ADR-0164). Con «Run» e «Bike» niente di quanto segue cambia.

- **«Draw»**: niente interruttore «Shape | Word | Image», solo le forme
  del catalogo, con la riga «On the water, a shape of the catalogue.» al
  suo posto: sull'acqua parole e foto non si disegnano. Una parola o una
  foto scelte prima restano lì, e tornano con un altro sport. Distanze da
  1 a 5 km (scelta dell'utente), anche col mezzo km («2,5»); il campo parte
  da **2 km**, dove le forme ci stanno anche al mare, 200 m oltre la riva,
  e torna a 2 km ogni volta che si sceglie «Paddle». La richiesta ha
  `activity: "paddling"`. Il pulsante della corsa libera dice «Paddle
  without a route».
- **«Another place»** (TASK-240, ADR-0204): la ricerca della partenza
  offre anche i laghi e le spiagge dell'elenco di «Explore» (`WATER_SPOTS`:
  211 laghi d'Italia, Lago di Garda, Lago di Como, Jesolo, Riccione e, dal
  TASK-245, altri 29 posti di mare), mai
  un lago preso da Photon o da Geoapify: solo di quelli il server ha
  l'acqua.
  - Il campo dice «Lake, beach, city or street».
  - I laghi compaiono **subito**, da 3 lettere, senza aspettare la rete, e
    stanno **sopra** le vie e i paesi trovati; al massimo tre
    (`SPOT_PLACES_SHOWN`), il più vicino alla posizione per primo. Un
    luogo trovato con lo stesso nome di un lago mostrato non si ripete.
    Con un lago mostrato non si dice «No place found».
  - Il testo si legge come un indirizzo (`findSpots` in
    `src/paddle/placeSpots.ts`): le parole che non sono nel nome di nessun
    lago si ignorano («Terme», «via», «spiaggia»); le parole comuni, quelle
    in più del 2% dei nomi («lago», «di», «del», «san»), non contano quando
    un'altra parola dice il lago. «lago di Levico Terme» trova «Lago di
    Levico», «spiaggia di Riccione» trova «Riccione». Con sole parole
    comuni devono esserci tutte nel nome, come in «Explore»: «lago» trova
    ogni lago, «via al lago» nessuno. **Solo l'ultima parola scritta vale
    come inizio di una parola del nome**, perché la si sta ancora
    scrivendo; quelle prima devono essere parole intere (TASK-245,
    ADR-0210): «via» da sola propone «Viareggio», «via Roma» no; «lago di
    lev» trova «Lago di Levico», «lev terme» niente. **Una parola comune
    scritta sceglie fra i nomi trovati** (TASK-245 parte B, ADR-0210,
    aggiornamento): se qualche nome trovato ha tutte le parole scritte
    che l'elenco conosce, restano solo quelli. «lago lev» propone solo
    «Lago di Levico», non «Sestri Levante»; «lev» da sola tutti e due;
    «lungomare di Viareggio» trova la sua spiaggia.
  - Scelto un lago, la partenza è il suo punto della riva più vicino alla
    posizione (un lago lungo ne ha molti), e la riga dice «Starting from
    Lago di Levico.».
  - Un lago piccolo, le cui forme stanno a 1,5 o 1 km (TASK-233), porta il
    campo della distanza a quella, se era più lunga (`distanceOnSpot`); un
    lago da 2 km e una via la lasciano com'è.
  - Le vie e i paesi restano quelli della ricerca di sempre: una partenza
    su un lungomare che non è nell'elenco funziona solo dove il server ha
    o riesce a scaricare l'acqua.
  - La regola delle parole, il mare (solo Jesolo e Riccione), la distanza
    sui laghi piccoli e il testo del campo sono **confermati dall'utente**
    il 2026-10-05 (`tasks/TASK-240.md`).
- **Il risultato**: «heart · on the water · target 2 km». Il percorso
  parte dalla riva, dove si arriva a piedi: se è a più di 50 m dalla
  partenza chiesta, il segnaposto ciano «Start here» la segna, come per una
  forma spostata. Niente tessere «A · B · C» né avvisi del motore (l'API
  non ne manda sull'acqua). La linea gialla sull'acqua (`color.map.water`)
  ha contrasto 11,5:1, più che su una strada principale (7,4:1); il ciano
  di «Start here» 9,6:1 (`src/theme/waterContrast.test.ts`): nessun token
  nuovo. Si vede poco, invece, dove finisce l'acqua: acqua e terra della
  mappa scura sono a 1,15:1.
- **«Start»** c'è anche senza indicazioni di svolta: sull'acqua non ce ne
  sono e l'app non le chiede (`/route-directions`), né per un percorso
  disegnato né per uno di «Explore» o dei preferiti. Si segue la linea:
  il banner dice «Follow the route to the end.», la barra e i km mancanti
  sono quelli della corsa, la voce dice solo i km.
- **Velocità e andatura** (TASK-251, ADR-0215; unità scelte dall'utente il
  2026-10-06: km/h e minuti ogni 500 m). Lungo un percorso sull'acqua, e
  senza percorso con «Paddle» in «Settings» («Paddle without a route»):
  sotto la mappa «Speed now» in km/h; su «Data» e in pausa «Speed now»,
  «Avg speed», «Time», poi «Avg /500 m» (l'andatura media, «5:37»: l'unità
  è nel nome, perché accanto al numero lo rimpiccioliva), «Last 500 m» (il
  tempo degli ultimi 500 m interi), senza «Calories» (TASK-255). «Last km» ed
  «Elev. gain» non ci sono. I parziali sono **ogni 500 m**: «m · /500 m ·
  Change», le righe «500», «1000», … col loro tempo e la differenza dal
  precedente; prima, «Your first 500 metres will show here.» Con le miglia
  la distanza è in miglia e la velocità in mph; andatura e parziali restano
  ogni 500 m. La voce dice ogni km (con le miglia ogni miglio) col passo
  medio ogni 500 metri: «1 kilometre. Time: 12 minutes. Average pace: 6
  minutes per 500 metres.» · «Un chilometro. Tempo: 12 minuti. Passo
  medio: 6 minuti ogni 500 metri.»; il confronto col km prima è quello
  della corsa. Il post di fine uscita scrive l'andatura in `/500 m`. In
  italiano «Med. /500 m», «Ultimi 500 m», «I tuoi primi 500 metri
  appariranno qui.» (dell'agente, **da confermare**, come tedesco, spagnolo
  e francese). «My activities» mostra ancora il passo al km (parte B).
  `src/navigation/paddle.ts`.
  In bici senza percorso la velocità è quella di un percorso in bici
  (TASK-251 parte C, «Correre senza percorso»).
- **«Move the shape»** (TASK-238, ADR-0202; trascinare col dito è una
  scelta dell'utente del 2026-10-05): sotto «Start», quando il percorso
  disegnato è sull'acqua e la risposta dice dov'è la forma (`centre`; con
  un'API di prima il pulsante non c'è). Toccato, il pannello diventa «Move
  the shape», «Drag the shape where you want it, then let go.», «It stays
  on the water, off the shore, where it fits.» e «Cancel»; sulla mappa
  **un dito trascina il percorso invece della mappa** (due dita fanno lo
  zoom come sempre, e rimettono la forma dov'era). Al rilascio l'app
  richiede lo stesso percorso con `near`, il centro di prima più lo
  spostamento, e la stessa partenza: il posto lo decide il motore, il più
  vicino in cui la forma ci sta. Mentre il motore lavora la forma resta
  sulla mappa **dove il dito l'ha lasciata**, con la barra d'attesa sotto;
  poi arriva il percorso vero, con la sua partenza dalla riva. Se è finita
  a più di 80 m da dove è stata lasciata (`NOT_THERE_M`: sulla terra,
  troppo al largo, troppo vicina alla riva) una riga lo dice: «The shape
  does not fit there: this is the nearest place.». Si può spostare ancora,
  ogni volta da dov'è. Un dito che si muove meno di 8 px non sposta niente;
  «Cancel» lascia tutto com'era. Vale per il percorso di «Draw» e per gli
  esempi di «Explore» (qui sotto); i preferiti non si spostano (non hanno
  `centre`). Nella
  pagina della mappa sono i messaggi `setMove` e `moved`
  (`src/map/messages.ts`, `mapPage.ts`); la logica è in
  `src/paddle/shapeMove.ts` e `useMoveShape.ts`. Testi in cinque lingue.
- **«Move the shape» su un esempio di «Explore»** (TASK-244; che il
  percorso spostato resti di «Explore» è una scelta dell'utente del
  2026-10-05): nella scheda di un esempio sull'acqua aperto da «Explore»,
  sotto «Start», quando l'esempio dice dov'è la sua forma (i 32 che
  vengono con l'app, e quelli dei laghi chiesti al server da questo task
  in poi; uno tenuto sul telefono da prima no, finché non è ridisegnato).
  Stesso pannello, stesso dito sulla mappa, stessa riga se la forma non ci
  sta. Al rilascio l'app richiede **l'esempio com'era stato chiesto**
  (forma, distanza, la partenza del luogo) con `near`; mentre il motore
  lavora la forma resta dove il dito l'ha lasciata e la scheda dice
  «Drawing a 2 km heart…», senza «Start» né «Export GPX», con «Back to the
  list» che lascia perdere. Poi la scheda è **ancora quella di «Explore»**,
  con i km del percorso nuovo, «Start», «Move the shape» per spostarlo
  ancora, il GPX e il cuore dei preferiti. Se la richiesta fallisce torna
  il percorso di prima, con il perché in rosso. La lista tiene l'esempio
  com'era: riaperto, è al suo posto. Lo stesso esempio aperto dal «Feed»,
  un preferito e gli esempi della corsa non si spostano. La logica è in
  `src/paddle/useMoveExample.ts`; `exampleRoutes.ts` tiene `centre` e la
  richiesta di ogni esempio. Nessun testo nuovo.
- **L'avviso di sicurezza**, al **primo** «Start» sull'acqua su questo
  telefono (scelta dell'utente), a tutto schermo prima del conto alla
  rovescia: 🛶, «Before you paddle», quattro righe («Wear a life
  jacket.», «Check the weather and the wind before you go out.», «Follow
  the local rules: swimming areas, boat lanes, harbours. Sgrava does not
  know them.», «The route stays within 1 km of the shore. That does not
  make it safe or allowed.»), poi «I understand», giallo, che parte, e «Not
  now», che torna al percorso e lo richiederà al prossimo «Start». Il
  telefono lo ricorda in `paddle-notice.json`; uno che non può scrivere lo
  ricorda finché l'app è aperta.
- **Quando non va**, nelle parole dell'acqua: lontano dall'acqua «There is
  no lake or sea near this start. Start from the shore, within 2 km of the
  water.»; una forma troppo grande «This shape does not fit on the water
  here at this distance. It fits at about 2.5 km.» con «Try 2.5 km» (la
  distanza dell'API, per difetto al mezzo km); una che non ci sta fra 1 e
  5 km «This shape does not fit on the water here. Try a shorter distance,
  another shape, or another start:» con le forme. Senza i dati dell'acqua
  (Overpass che rifiuta) il testo è quello della mappa, «Map data for this
  area could not be downloaded. Try again later.».
- **«Explore»** (scelta dell'utente; come la corsa dal TASK-233, ADR-0196):
  al posto di città, esempi di corsa e percorsi consigliati, la pagina «On
  the water», «Shapes to paddle, within 1 km of the shore», con il cuore di
  Sgrava in alto a destra e la sezione «LAKES AND SEA». Con «Miles»
  (TASK-182 parte B) le schede dicono «Heart · 1.2 mi» («Heart, 1.2 mi, on
  the water» per VoiceOver) e il lago «0.6 mi away»; «within 1 km of the
  shore» resta in km, come nell'avviso di sicurezza: è il limite del
  motore, e in miglia tonde non sarebbe vero. Senza acqua vicina: «…Start
  from the shore, within 1 mile of the water.» (il motore cerca entro 2
  km).
  - **«Near me»** è il primo della riga, con il segno della posizione, ed è
    **acceso da subito** quando c'è una partenza, come nella corsa. Mostra
    il luogo dell'elenco più vicino entro 30 km, con il nome e la distanza:
    «LAGO DI LEVICO · 1.2 KM AWAY». Più lontano di così disegna dalla
    partenza di «Draw», sotto «NEAR YOUR START», come prima. La partenza è
    quella di quando «Near me» si è acceso: se si sposta, le forme non si
    ridisegnano. Senza partenza: «Choose a start in Draw first: the shapes
    start from the shore nearest to it.».
  - **I luoghi da toccare**, in una riga che scorre: gli otto più vicini
    alla partenza dopo quello di «Near me»; senza partenza i quattro scelti
    a mano («Lago di Garda», «Lago di Como», «Jesolo», «Riccione») e la
    frase «Choose a lake or a beach: eight shapes on its water, from the
    shore.», senza chiedere niente.
  - **«Type a lake or a beach»**: da due lettere, fino a sei nomi che hanno
    ogni parola scritta all'inizio di una loro parola, senza badare agli
    accenti («lev», «ca selva»), il più vicino per primo, con la distanza.
    Un nome toccato è scelto e diventa il primo della riga. Niente:
    «No lake or beach matches “zzz”.». La ricerca è nel telefono.
  - **L'elenco** (`src/paddle/lakes.json`, scritto da `python -m
    shaperoute_api.lake_catalog`): i laghi di OpenStreetMap su cui una
    forma ci sta, ognuno con i punti della riva da cui partono gli esempi
    (uno ogni 4 km su una riva lunga: l'app prende il più vicino) e la
    distanza delle forme: **2 km, oppure 1,5 o 1 km su un lago piccolo**.
    L'Italia intera: 211 laghi, 758 punti (`tasks/TASK-233.md`).
  - **Le spiagge** (TASK-245, ADR-0210; `src/paddle/beaches.json`, scritto
    da `python -m shaperoute_api.beach_catalog`): 29 posti di mare scelti
    dall'utente, su tutte le coste d'Italia, oltre a Jesolo e Riccione:
    Lignano Sabbiadoro, Bibione, Caorle, Cavallino, Sottomarina,
    Cesenatico, Rimini, Cattolica, Senigallia, San Benedetto del Tronto,
    Pescara, Vieste, Gallipoli, Otranto, Tropea, Cefalù, Mondello, San
    Vito lo Capo, Alghero, Villasimius, San Teodoro, Viareggio, Forte dei
    Marmi, Castiglione della Pescaia, Ostia, Sperlonga, Alassio, Sanremo,
    Sestri Levante. Ognuno ha **un punto solo**, sulla riva vicino al
    paese, dove si arriva a piedi, e le forme a 2 km. Si trovano come i
    laghi: «Near me» entro 30 km, fra gli otto luoghi più vicini, per nome
    in «Type a lake or a beach» e in «Another place». Le loro forme sono
    chieste all'API, come quelle dei laghi: niente esempi dentro l'app.
    Stanno 200 m oltre la riva, come a Jesolo e a Riccione.
  - Un luogo ha **le otto forme della corsa** in canoa (TASK-227, scelta
    dell'utente): cuore, cerchio, stella, luna, cavallo, lumaca, testa di
    cane, testa di coniglio. Quelle dei quattro luoghi scelti a mano
    **vengono con l'app** (`src/paddle/paddleExamples.json`, ADR-0189),
    sotto «LAGO DI GARDA · FROM RIVA DEL GARDA»: pronte subito, anche senza
    rete, e niente chiesto all'API. Quelle degli altri laghi sono chieste
    all'API una alla volta, il cerchio per primo, le cinque dopo le prime
    tre solo quando arrivano, e restano sul telefono come gli esempi delle
    città. Ogni scheda «Heart · 2.0 km», «On the water», si apre sulla
    mappa come un percorso di «Explore», con «Start», «Export GPX» e il
    cuore dei preferiti, che la tiene come canoa. La scelta resta quando si
    torna dalla mappa.
  - **Le forme dei tre posti più vicini sono già sul telefono** (TASK-246,
    ADR-0211; richiesta e scelta dell'utente): a ogni apertura dell'app,
    dopo le mappe della zona, il telefono chiede all'API le otto forme dei
    tre posti più vicini entro 30 km che non ha ancora, con qualunque
    sport di «Settings», senza avvisi, anche con i dati mobili. La pagina
    le mostra subito, come quelle venute con l'app; quello che manca
    ancora lo chiede lei come prima.
  - **Vicino a dove si vive, con un filtro** (TASK-269, ADR-0239; richiesta
    dell'utente del 2026-10-09, il come deciso dall'agente su delega
    dell'utente):
    - **La zona di casa**, calcolata sul telefono: il centro della zona
      (10 km) da cui partono più attività fra le 20 più recenti di «My
      activities», qualunque sport; a pari merito la più recente. Senza
      attività, la partenza da cui è partito «Near me». Resta in
      `Documents/home-area.json`: niente permessi nuovi, niente indirizzo,
      niente di nuovo all'API o sull'account. Se ne va al logout, a
      sessione finita, con l'account cancellato e con una lista vuota.
    - **I posti da toccare** sono quelli più vicini alla zona di casa, otto
      alla volta; in fondo alla fila «Show more» ne aggiunge altri otto.
      Sotto la fila una riga dice da dove: «Suggested near Trento» (il
      paese più frequente che l'API ha dato alle attività della zona),
      «Suggested near where you usually start» senza paese, «Suggested
      near your start» senza attività; senza partenza né attività nessuna
      riga, e i quattro posti scelti a mano come prima. **«Near me»** resta
      com'era: il lago più vicino alla partenza, anche in viaggio.
    - **«Lakes» e «Sea»**, due chip a destra di «LAKES AND SEA», accesi
      tutti e due. Toccarne uno mostra solo quel tipo, toccarlo di nuovo li
      riaccende, toccare l'altro passa all'altro; la scelta resta sul
      telefono (`Documents/water-filter.json`). Vale per la fila, non per
      «Near me» né per «Type a lake or a beach». Lago o mare lo dice
      l'elenco da cui viene il posto (`lakes.json`, `beaches.json`; Garda e
      Como laghi, Jesolo e Riccione mare).
    - **Le forme già sul telefono** (sopra) sono quelle dei tre posti più
      vicini alla zona di casa, quando c'è.
    - Testi **confermati dall'utente** il 2026-10-10, nelle cinque lingue
      (`tasks/TASK-269.md`): «Lakes», «Sea», «Suggested near …», e la
      frase della privacy sulla zona di casa.
- **I pezzi staccati sull'acqua** (TASK-226, ADR-0188; scelta dell'utente
  sui campioni): con «Paddle» gatto, pesce, testa di cane, testa di
  coniglio, zucca, faccina, fantasmino e ciambella si chiedono **sempre**
  con `pen_up: true`, senza interruttore; il sole e le forme in una linea
  come prima.
  - **Il percorso**: lascia il contorno vicino ai pezzi, li disegna uno
    per volta e torna. Sulla mappa i tratti a penna alzata sono
    tratteggiati, come fra le lettere. Sotto il percorso: «1.9 km of
    drawing + 0.1 km paddling between the parts» · «1,9 km di disegno +
    0,1 km pagaiando fra una parte e l'altra».
  - **Correndo**: a ogni tratto il disegno va in pausa da solo e riprende
    alla parte successiva, con la voce («La navigazione», «La penna
    alzata»).
  - **In «Explore»**: le teste di cane e di coniglio hanno gli occhi
    staccati, anche nei quattro luoghi dentro l'app, e la scheda non
    disegna i tratti a penna alzata. Un esempio di «Near me» tenuto prima,
    in una linea sola, si ridisegna.
  - Testi nuovi **da confermare con l'utente**: la frase della voce e la
    riga dei km, in inglese e in italiano; tedesco, spagnolo e francese da
    confermare.
- **I laghi sul server**: il server ha l'acqua dei quattro luoghi
  (TASK-225) e, dal 2026-10-05, di ogni lago dell'elenco (TASK-233: 210
  file in `data/cache/water/`). Le spiagge di TASK-245 hanno altri 27
  file (22,6 MB, sul server dal 2026-10-05), uno a paese: tengono ogni
  partenza entro 3 km dal paese.
  Altrove, per esempio al mare lontano dai posti dell'elenco,
  la scarica da Overpass, se risponde, e la prima volta
  ci mette minuti, altrimenti «Map data for this area could not be
  downloaded.». **Un elenco nuovo vuole prima la sua acqua sul server**
  (`MAPS.md`, «I laghi di Explore»).
- Testi nuovi **da confermare con l'utente**: «On the water, a shape of the
  catalogue.», «on the water», «Paddle without a route», i testi d'errore
  qui sopra e quelli di «Explore» («On the water», «Shapes to paddle,
  within 1 km of the shore», «LAKES AND SEA», «Near me», l'avviso senza
  partenza). I testi di TASK-233 sono **confermati dall'utente** il
  2026-10-05, in inglese e in italiano: «Choose a lake or a beach: eight
  shapes on its water, from the shore.», «Type a lake or a beach», «No lake
  or beach matches “…”.» e «… km away». Il
  testo dell'avviso di sicurezza è approvato. Tutti questi testi sono anche
  in tedesco, italiano, spagnolo e francese (ADR-0169, «Aggiunta»).

## Correre senza percorso (TASK-149, ADR-0122)

**«Run without a route»**, in alto nella pagina «Draw» accanto a «Sgrava»,
giallo con il testo scuro (TASK-220, scelta dell'utente: l'eccezione alla
regola 1 dei colori), fa partire una corsa senza disegnare niente: niente forma, niente percorso,
niente API. Con «Bike» scelto in «Settings» il pulsante dice **«Ride without
a route»** (TASK-190, **da confermare con l'utente**); la schermata che apre
resta quella della corsa (domanda 2 di `tasks/TASK-190.md`). La scritta è per intero (TASK-158, chiesto dall'utente): «Run» da
solo si leggeva come correre il percorso scelto sotto. Si apre la mappa, che segue la posizione come in navigazione (zoom
17) e disegna la linea corsa fin lì, sottile e chiara (`track`), con la
freccia di direzione della navigazione. Senza percorso non ci sono svolte
da dire: al posto di «←» un banner con il punto di partenza (TASK-164,
ADR-0133), cioè una freccia azzurra, il colore della partenza, la distanza
in grande («1.2 km») e «Your start, in a straight line»; sotto, «Heading
north-east». La freccia è come la vede chi corre: in su vuol dire davanti,
in giù alle spalle. A meno di 30 m dalla partenza, «You are at your start»
senza freccia. Prima della prima posizione, «Finding your position…»; senza
permesso, «Location is off», «Allow it for Sgrava in Settings to record
your track.» e «Open Settings» (TASK-259). Sotto la mappa la scheda della corsa, la stessa della navigazione
(«La corsa», sopra): il conto alla rovescia, le pagine «Map» e «Data»,
«Pause», «Pocket», «Stop» da tenere premuto; su «Data», al posto della
svolta, c'è la partenza. A ogni km la voce, in
inglese come il resto,
dice il tempo e il passo medio: «1 kilometre. Time: 5 minutes 42 seconds.
Average pace: 5 minutes 42 seconds per kilometre.» (oltre l'ora, ore e
minuti). Anche in modalità tasca; niente vibrazione, che in navigazione
vuol dire una svolta. «Keep running» non ripete i km già detti.

**In bici senza percorso** («Ride without a route», TASK-251 parte C,
ADR-0215; scelta dell'utente del 2026-10-08) la scheda e la fine della
corsa mostrano i numeri di un percorso in bici («In bici», sopra), con lo
stesso componente: sotto la mappa «Speed now» in km/h; su «Data», in pausa
e a fine corsa «Speed now», «Avg speed», «Time», «Last km» (in km/h),
«Elev. gain», senza «Calories»; i km uno per uno in km/h con la
differenza. Con le miglia mph. Lo sport è quello di «Settings» alla
partenza, tenuto nel file della corsa. La voce resta quella della corsa
senza percorso (ogni km, col passo medio), il post scrive il passo al km
come una pedalata con un percorso, e «My activities» come prima (il passo
al km: lì solo «Paddle» ha numeri suoi). Una corsa senza percorso e
«Paddle without a route» restano come prima.

**Il confronto col km precedente** (TASK-217, ADR-0180; chiesto e scelto
dall'utente il 2026-10-03: «ad ogni km di' anche se ha fatto meglio o
peggio rispetto al km precedente»). Dal secondo km, subito dopo la frase
del km, con un percorso e senza:

| Caso | Inglese | Italiano |
|---|---|---|
| più veloce | «12 seconds faster than the last kilometre.» | «Questo chilometro: 12 secondi meglio del precedente.» |
| più lento | «8 seconds slower than the last kilometre.» | «Questo chilometro: 8 secondi peggio del precedente.» |
| entro 2 s, compresi | «Same pace as the last kilometre.» | «Stesso passo del chilometro precedente.» |

Al primo km niente. I secondi sono quelli della colonna «Change» di «Data»
e della fine corsa (`splits`), interi e con le pause escluse; da un minuto
in su detti come un tempo («1 minute 15 seconds faster…»). Una corsa che
riprende non ridice i confronti già detti. Al quinto km viene dopo
l'incitamento, che chiude la frase del km. Tedesco, spagnolo e francese
scritti dall'agente e **confermati dall'utente** il 2026-10-05: «12 Sekunden schneller als der
letzte Kilometer.» / «… langsamer …» / «Gleiches Tempo wie der letzte
Kilometer.»; «Este kilómetro: 12 segundos más rápido que el anterior.» /
«… más lento …» / «Mismo ritmo que el kilómetro anterior.»; «Ce
kilomètre : 12 secondes plus rapide que le précédent.» / «… plus lent …»
/ «Même allure que le kilomètre précédent.». In bici il confronto è ogni
10 km («La navigazione», la bici). Con le miglia (TASK-182 parte C) la
voce dice ogni miglio e lo confronta col miglio prima («1 mile. Time: …
Average pace: … per mile.», «12 seconds faster than the last mile.»): le
frasi sono in «La navigazione», «Con le miglia»; il banner della partenza
dice la distanza in piedi («650 ft») e da 1000 piedi in miglia («1.2
mi»).

La traccia è quella della navigazione (ADR-0091), con le stesse regole,
nello stesso file `current-run.json`, con il percorso vuoto: resta se
l'app si chiude, e una corsa per volta (una nuova sostituisce quella nel
file alla prima posizione).

**«Stop»** (in pausa, tenuto premuto) apre la fine della corsa: in alto
«Your run» e «White: what you ran.»; sotto i km in grande e i sei riquadri
di «Data» (tempo senza le pause, passo medio, ultimo km, salita,
calorie). Con le miglia (TASK-182 parte C) le miglia in grande («2.62
mi»), il passo medio al miglio («9:33 /mi») e l'ultimo miglio («Last
mi»). Senza forma non c'è
punteggio, e niente va a `POST /track-scores`. **«Keep running»** torna
alla corsa, con la stessa traccia; **«Done»**, senza account, torna alla
prima schermata e toglie la corsa dal file: si perde, com'era, e sotto la
scheda c'è la riga che invita a entrare. Con un account al posto di
«Done» ci sono **«Save»** e **«Discard»** («La fine della corsa», sopra):
salvata, la corsa va in «My activities» senza punteggio (TASK-172). Uno «Stop» prima della prima posizione torna subito alla
prima schermata. Se l'app si chiude durante la corsa, alla riapertura entro
2 ore si riapre la corsa, in pausa, con «Resume» (TASK-272, ADR-0240, come
lungo un percorso: «La corsa interrotta si riapre in pausa», sopra); più
tardi si apre questa schermata, senza «Keep running». Dopo uno «Stop»,
«Keep running» c'è solo se l'ultima posizione è di meno di 30 minuti
prima.

## Export del GPX

«Export GPX» chiede il file all'API e apre il foglio di condivisione di
iOS: File, AirDrop, Mail, le app di corsa (`GPX.md`, «Dal telefono»).
Mentre l'API prepara il file il pulsante dice «Preparing GPX…». Se
l'utente chiude il foglio senza scegliere, non succede niente. Un errore
compare sotto il pulsante, con i messaggi di «Quando non va»; in più:

| Caso | Messaggio |
|---|---|
| Il telefono non ha il foglio di condivisione | This phone cannot open the share sheet. |
| Il file non si salva sul telefono | The GPX could not be saved on the phone. Try again. |

Un percorso nuovo toglie l'errore dell'export di prima. Una parola a
penna alzata manda all'API la richiesta con `pen_up` e il risultato con i
suoi `walks`, come sono arrivati (TASK-198): il file ha i waypoint «Pause»
e «Resume» (`GPX.md`).

## Quando non va

Un messaggio per caso, scritto per chi corre: cosa è successo e cosa può
fare (TASK-256, ADR-0220). Nessun testo mostrato nomina indirizzi, file,
comandi, l'AI sul PC o «bug»: il dettaglio tecnico (l'indirizzo cercato,
lo stato HTTP, il codice e il testo dell'API) compare sotto in grigio
**solo nelle build di sviluppo** (`__DEV__`). Dove la stessa richiesta può
andare bene la seconda volta (rete assente, risposta inattesa, motore
fallito, dati OSM non scaricati, cinque minuti passati, richiesta persa) c'è
un pulsante **«Try again»** che la rimanda uguale; una forma che non ci sta
o una chiave rifiutata non lo hanno. Un componente che va in errore mentre
disegna non lascia più lo schermo bianco: al suo posto il giallo della
partenza con il logo, «Something went wrong.» e «Try again», che riavvia
l'app (la corsa in corso è nel suo file e torna da sola); in sviluppo sotto
c'è anche l'errore.

| Caso | Messaggio |
|---|---|
| Forma che non ci sta, con una distanza che ci sta (`shape_not_drawable`, ADR-0041) | This shape does not fit the roads here at this distance. It fits at about 4 km. e un pulsante «Try 4 km» che scrive la distanza e ridisegna |
| Forma che non ci sta, senza distanza (somiglianza bassa, o distanza fuori da quelle di «Draw»: oltre 21 km, in bici fuori da 10–30) | This shape does not fit the roads here. Try another shape, or another start: e le forme del catalogo come pulsanti |
| Contorno di un'immagine che non ci sta (TASK-073) | come per la forma, con «This image…»; senza distanza: This outline does not fit the roads here. Try another distance, another start, or a simpler picture. (niente forme da toccare) |
| Parola che non ci sta (TASK-057) | come per la forma, con «This word…»; senza distanza: This word does not fit the roads here. Try a shorter word, or another start. (niente forme da toccare) |
| Dati OSM non scaricabili (`map_data_unavailable`) | Map data for this area could not be downloaded. Try again later. |
| Errore del motore (`engine_error`) | The route could not be drawn. Try again, or try another start. e «Try again» |
| L'AI non risponde (`ai_unavailable`) | This word cannot be read right now. Try one of these: circle, heart, star, horse, moon, cat, fish, butterfly, snail, dog head, rabbit head, pumpkin, christmas tree, smiley, ghost, donut or sun. |
| `invalid_request`, `http_error`, risposta illeggibile | Something went wrong on our side. Try again in a moment. e «Try again» (anche un percorso in bici chiesto a un'API più vecchia di TASK-190, parte B, che conosce solo `running`; il codice e il testo dell'API sotto, solo nelle build di sviluppo) |
| API non raggiungibile | No connection. Check the network and try again. e «Try again» (l'indirizzo cercato sotto, solo nelle build di sviluppo) |
| Nessun risultato in 5 minuti | Drawing this route is taking too long. Try again later, or a shorter distance. e «Try again» |
| L'API non conosce più la richiesta (riavviata) | This request was lost. Try again. e «Try again» |
| Chiave dell'app rifiutata (`unauthorized`, TASK-081) | This version of the app is no longer allowed in. Update the app. |
| Indirizzo dell'API sconosciuto (build senza indirizzo) | The app cannot reach the service. Update the app. |
| Account: email già usata (`email_taken`, TASK-115) | This email already has an account. Log in instead. |
| Account: nome già usato (`username_taken`) | This username is taken. Try another one. |
| Account: email o password sbagliate (`wrong_credentials`) | Wrong email or password. |
| Account: troppi tentativi (`too_many_requests`, con `Retry-After`) | Too many tries. Wait 10 minutes and try again. (al minuto intero; sotto il minuto, «Wait a minute») |
| Account: sessione scaduta o chiusa (`session_expired`, `not_signed_in`) | Your session has ended. Log in again. |
| Account: l'API non ha un database (`accounts_unavailable`) | Accounts are not available right now. Try again later. |
| Account: API non raggiungibile | No connection. Check the network and try again. |
| Account: chiave dell'app rifiutata, o risposta fuori dal contratto | This version of the app is no longer allowed in. Update the app. · Something went wrong on our side. Try again in a moment. |
| Account: un campo che l'API rifiuterebbe | il primo che non va: Enter an email address, like name@example.com. · A username is 3 to 20 letters, digits, _ or . (no spaces). · A password is at least 8 characters. · You must be at least 16 to sign up. |

## Cosa esce dal telefono

- **La partenza**: va all'API sul PC, in rete locale, con forma e
  distanza. Se la zona non è in cache, il PC la scarica da Overpass, che
  vede quale area si chiede. Il log dell'API non la scrive (TASK-091,
  ADR-0092: prima il motore scriveva le partenze vicine provate); dice
  solo quale zona in cache ha letto, un riquadro largo chilometri. Resta
  scritta solo nel **registro delle richieste**, e solo se chi avvia l'API
  lo accende (`--request-log`, spento per default; TASK-090, ADR-0085): un
  file sul computer dell'API, `data/requests/requests.jsonl`, con partenza,
  distanza, forma, parola o contorno dell'immagine di ogni richiesta, per
  poterla rifare (`API.md`). Mai la foto, mai la chiave. Non entra nel
  repository, non torna al telefono, non va a nessun servizio; al massimo
  10 MB, poi le righe vecchie si perdono. Per cancellarlo basta cancellare
  il file.
- **Le parole della forma** che la tabella non conosce: vanno all'API sul
  PC, e da lì al modello in Ollama, sullo stesso PC. Non escono dalla rete
  di casa; il log dell'API le scrive, con la forma scelta.
- **La foto scelta per «Image»** (TASK-073): va all'API sul PC, in rete
  locale, una volta; l'API non la salva e non la scrive nel log. Poi viaggia
  solo il contorno. Non va a nessun servizio esterno né all'AI.
- **Le tile**: il provider vede quale zona si guarda, come con ogni mappa.
  Da TASK-162 anche le zone dei disegni di «Feed», a ogni apertura
  dell'app: sono le città degli esempi, uguali per tutti, non la posizione
  di chi guarda.
  Da TASK-174 anche le zone dei percorsi mostrati in «Explore», quando si
  apre la pagina o si sceglie una città: sono attorno alla partenza o alla
  città scelta, come la mappa grande quando si apre un percorso.
  Da TASK-264, con «Satellite» le foto vengono da Esri e con «3D» le
  altezze dalle Terrain Tiles di AWS: anche loro vedono la zona guardata,
  e solo con quel tipo scelto.
- **La ricerca**: il testo cercato e la posizione (per mettere prima i
  luoghi vicini) vanno all'API, che li gira a Geoapify (TASK-123); senza
  API o senza chiave, a Photon (komoot). Il log dell'API scrive solo
  `GET /places`, né testo né posizione (TASK-124, ADR-0096).
- **La libreria**: MapLibre GL JS arriva da unpkg a ogni avvio a freddo.
- **L'account** (TASK-115): email, nome e password vanno all'API solo con
  «Sign up» e «Log in». Il telefono tiene la sessione, cioè il token e
  l'utente (numero, email, nome, ruolo), nel portachiavi
  (`expo-secure-store`, ADR-0125); mai la password. Il token va all'API
  solo con le richieste dell'account (`GET /me`, `DELETE /session`,
  `DELETE /me`), dei preferiti e delle corse, in `Authorization`.
- **Le notifiche** (TASK-185): i due interruttori di «Settings» vanno
  all'API quando si toccano e restano nell'account, letti solo dal suo
  proprietario. Non parte nessuna notifica, il telefono non chiede il
  permesso delle push e non manda nessun identificativo per riceverle.
- **I preferiti** (TASK-171): un percorso tenuto va all'API intero, con la
  sua linea, e resta nel database legato all'account finché non lo si
  toglie o si cancella l'account. La linea di un percorso disegnato parte
  da dove si è scelto di partire: spesso vicino a casa. Lo vede solo il suo
  account.
- **Le corse** (TASK-172): con un account, con «Save» a fine corsa la
  corsa va all'API **intera**: ogni posizione con il suo orario, le pause e il percorso
  seguito. Resta nel database legata all'account finché non la si cancella
  da «My activities» o si cancella l'account; la vede solo il suo account
  (niente è pubblico: «Public» e la traccia tagliata sono di TASK-117).
  Una corsa parte e finisce spesso davanti a casa: è il dato più personale
  che l'app manda. Per il nome del luogo l'API chiede a Geoapify il paese
  intorno alla partenza **arrotondata a circa un chilometre** (due
  decimali), come per la ricerca dei luoghi: il servizio non vede mai la
  porta da cui si parte, né la corsa, né chi è. Il log dell'API non scrive
  posizioni (ADR-0092). Senza rete la corsa aspetta in un file del
  telefono, che non esce da lì finché non parte per l'API. Senza account,
  o con «Discard», non va niente.
- **Strava** (TASK-187): una corsa va a Strava **solo quando l'utente lo
  chiede**, con l'interruttore acceso a «Save» o con «Send to Strava» su
  una corsa aperta, e solo dopo aver collegato il suo atleta. Il telefono
  manda all'API la chiave della corsa e, se scritto, il nome; l'API manda a
  Strava la traccia con gli orari, il nome e una riga di descrizione
  («Drawn with Sgrava», o «Recorded with Sgrava» per una corsa libera).
  Su Strava l'attività segue le impostazioni di privacy dell'atleta, non
  quelle di Sgrava. Il telefono non vede mai un token di Strava; il
  collegamento passa dal browser. Senza rete la corsa aspetta in
  `strava-outbox.json` (chiave e nome, al più 20), poi parte una volta.
- **Il post** (TASK-231): l'immagine si fa sul telefono ed esce solo
  dal foglio di condivisione, dove la manda l'utente (Instagram, Foto,
  Messaggi…). Non mostra i primi e gli ultimi 200 m della corsa, né la
  mappa sotto. A Strava, con «Send to Strava» o «Update on Strava» dal
  post, va in più il testo del post (emoji e risultati scelti), che
  sull'attività già là sostituisce il testo di prima.
- **Un disegno che altri vedono** (TASK-117, TASK-208): una corsa diventa
  visibile agli altri iscritti **solo con «Everyone» o «Followers»**
  scelto dall'utente, a fine corsa o su una corsa aperta; «Only me» a ogni
  corsa. Il telefono manda all'API la chiave della corsa, il titolo, la
  descrizione, l'attività, i `public_id` dei taggati e «Who can see it»;
  la traccia la taglia l'API (mai i primi e gli ultimi 200 m, mai il
  percorso pianificato né gli orari, ADR-0159). Senza rete la scelta
  aspetta in `drawings-outbox.json` (chiave e scelta intera, l'ultima per
  corsa, al più 20). **Le foto** stanno sul telefono, in un file per foto
  (`drawing-photo-{account}-{chiave}-{posto}.b64`, già ridotte a 1080 px e
  senza EXIF) con `drawing-photos.json` che dice quali l'API ha; vanno
  all'API **solo mentre altri vedono la corsa**, e tornate a «Only me»
  l'API le cancella (ADR-0170, punto 7: scelta dell'utente). Una corsa
  cancellata le cancella anche dal telefono. Le foto di una corsa privata
  non passano mai da un telefono all'altro, e si perdono con l'app.

## Quando la mappa non si carica

La pagina avvisa l'app se lo script di MapLibre non arriva (anche con un
hash SRI che non torna), se lo stile non è valido, o se non arriva la
descrizione delle tile di OpenFreeMap (la TileJSON): lo stile è nella
pagina, ma senza di lei la mappa resta vuota. Una tile mancante, dopo, non
è un errore. Sulla mappa, al posto della barra di caricamento, l'app
scrive «The map could not be loaded. Check the network.» con un pulsante
**«Retry»** che ricarica la pagina (TASK-256); la ricarica anche da sola
quando l'app torna in primo piano con la mappa in errore. Appena la mappa
carica, il testo sparisce e la schermata viene avvisata che l'errore non
c'è più (`onError(null)`), così la riga rossa sotto la ricerca
(`ChooseScreen`) se ne va. In «Draw» la mappa è sotto la schermata e il suo
«Retry» non si vede: la riga rossa dice le stesse parole della mappa, senza
il motivo tecnico (resta per il log), con un suo **«Retry»** che monta di
nuovo la mappa (TASK-259); se non carica ancora, la riga torna. Se iOS chiude la
pagina per liberare memoria, la WebView la ricarica da sola.

## Domande ancora aperte

- Cosa proporre quando l'AI non trova una forma: TASK-031.
- Forme nuove nel catalogo: si disegnano, si provano e si giudicano prima
  di entrare (ADR-0036).
- Distanze oltre i 21 km: aspettano un download delle zone più veloce
  (ADR-0009). In bici arrivano a 30 km (TASK-190).
- Con «Bike» scelto, cosa mostrano «Explore», «Feed» e la schermata della
  corsa: due domande per l'utente in `tasks/TASK-190.md`.
- Miglia al posto dei km.
- Avvisi in parole semplici: oggi l'app riconosce i testi del motore
  (ADR-0048); la strada pulita sono i codici negli avvisi del contratto.
- Rigenerare altri percorsi oltre a quelli proposti (scegliere fra quelli
  calcolati c'è da TASK-093).
- Contorni disegnati delle forme e cursore della distanza: vogliono
  dipendenze (TASK-051).
