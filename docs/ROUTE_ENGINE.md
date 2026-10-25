# ROUTE_ENGINE — Il cuore del sistema

Documento di riferimento per tutto ciò che trasforma una forma astratta in
un percorso reale. Se stai lavorando su una singola fase, leggi solo il suo
paragrafo.

## 1. Il problema, detto bene

Data una forma, una distanza target e un punto di partenza, trovare un
**ciclo chiuso sulla rete stradale** che parta e torni al punto di partenza,
misuri circa la distanza richiesta e la cui traccia assomigli alla forma.

Sono tre vincoli in conflitto. La rete stradale è un grafo discreto: non
contiene la forma, quindi la forma va approssimata. Più si forza la
distanza, più la forma si deforma; più si forza la forma, meno la distanza
torna. La priorità, stabilita in `PRODUCT.md`, è: **prima la forma, poi la
distanza entro il 10%**.

La pipeline è in cinque passi, ognuno testabile da solo:

```
forma parametrica  →  punti normalizzati        (§2)
punti normalizzati →  coordinate geografiche    (§3)
coordinate         →  waypoint sulla rete       (§4)
waypoint           →  percorso ottimizzato      (§5)
percorso           →  verdetto di validità      (§6)
```

## 2. Generazione delle forme

Ogni forma è una funzione parametrica che produce `N` punti ordinati, in
un sistema **normalizzato**: centrato nell'origine, racchiuso nel quadrato
`[-1, 1]`, indipendente da scala e posizione geografica.

```
circle:  x = cos t
         y = sin t

heart:   x = 16 sin³t
         y = 13 cos t − 5 cos 2t − 2 cos 3t − cos 4t
         (poi normalizzata nel quadrato unitario)
```

Regole:

- La curva è **chiusa**: l'ultimo punto coincide col primo. `N` conta i
  vertici distinti, quindi la lista ha `N + 1` elementi e `N` segmenti
  (ADR-0017).
- I punti sono **equispaziati in lunghezza d'arco**, non nel parametro `t`.
  Con `t` uniforme il cuore accumula punti sulle punte e ne lascia pochi
  sui lobi: l'approssimazione peggiora proprio dove la forma si riconosce.
- `N` è un parametro. Troppo basso: la forma si spigola. Troppo alto: ogni
  punto diventa un vincolo di routing e il percorso si frammenta.
  Punto di partenza ragionevole: **64 punti**, da tarare. Con `N` pari
  entrambe le punte del cuore cadono su un vertice.
- Nessuna forma conosce latitudine, longitudine o metri. Se un modulo di
  `shapes/` importa qualcosa di geografico, è nel posto sbagliato.

Aggiungere una forma significa aggiungere una funzione e registrarla: non
deve richiedere modifiche a nessun'altra fase.

### Forme da file e catalogo (TASK-032, TASK-033)

Una forma può anche arrivare da un **contorno** in JSON (ADR-0035): dalla
CLI con `--outline FILE`, oppure registrata in `SHAPES` come le altre. Le
forme registrate sono il **catalogo** e sono contratto (ADR-0036): `circle`,
`heart`, `star`, `horse`, `moon`, `cat`, `fish`, `butterfly`, `snail`,
`dog_head`, `rabbit_head`, `pumpkin`, `christmas_tree` e, a pezzi (sotto),
`smiley`, `ghost`, `donut`, `sun` (TASK-223). `tree`
(TASK-034) è un altro contorno, e non è nel catalogo. Un contorno entra nel catalogo solo dopo il
giudizio a occhio dell'utente sulle strade.

```json
{
  "name": "star",
  "source": "da dove viene il disegno",
  "license": "la sua licenza",
  "points": [[0.0, 1.0], [0.2245, 0.309], ..., [0.0, 1.0]]
}
```

- `x` verso destra, `y` verso l'alto, a qualsiasi scala: il motore porta il
  contorno in `[-1, 1]²` e lo ricampiona a `N` punti, come le altre forme.
- **Un solo contorno chiuso**: l'ultimo punto ripete il primo; niente
  buchi, pezzi separati o incroci, perché un percorso è una sola linea
  chiusa. Un file che non lo rispetta viene rifiutato con il motivo. I
  dettagli interni si aggiungono come tratti (sotto).
- Fonte e licenza stanno nel file: il disegno di qualcun altro entra solo
  con una licenza aperta.

### Tratti ripassati (TASK-037)

Un contorno può avere anche dei **tratti** (`strokes`, facoltativi): linee
dentro o accanto al contorno, come un ramo, un occhio o una finestra, che
il percorso disegna andando e tornando sulla stessa strada (ADR-0039).

```json
"strokes": [
  [[1.0, -0.275], [0.75, -0.275], [0.75, -0.1], [0.45, -0.1],
   [0.45, -0.45], [0.75, -0.45], [0.75, -0.275]]
]
```

- Un tratto **parte dal contorno o da un tratto precedente**: il primo
  punto deve stare su una sua linea (entro lo 0,1% della grandezza del
  contorno, e allora ci viene spostato sopra).
- Una **linea** (ramo, gamba) si percorre fino in fondo e si torna
  indietro. Un tratto che finisce su un suo punto precedente chiude lì un
  **anello** (finestra, occhio): l'anello si percorre una volta, e si torna
  indietro solo sulla linea che ci porta.
- I tratti non incrociano il contorno, gli altri tratti, né se stessi.
- Il motore ne fa **una sola linea chiusa**: il contorno, con ogni tratto
  inserito dove parte. Quella linea si ricampiona tenendo tutti i suoi
  vertici, così il ritorno passa esattamente dove è passata l'andata; gli
  altri punti fino a `N` si distribuiscono per lunghezza. Con più vertici
  che `N`, restano solo i vertici.
- Un contorno senza tratti si ricampiona come prima.

Del disegno i tratti fanno parte a tutti gli effetti: contano nella
lunghezza (la scala li comprende), nella somiglianza e negli angoli, e la
punta di ogni linea, dove si torna indietro, è un angolo della forma.

### Una linea sola, senza contorno (TASK-040)

Una parola a tratto singolo non ha un contorno che la contiene. Al posto di
`points` e `strokes` il file ha allora `path`: **una sola linea chiusa**
(l'ultimo punto ripete il primo), percorsa così com'è (ADR-0042).

```json
{"name": "ciao", "source": "...", "license": "...", "path": [[0.53, 0.18], ..., [0.53, 0.18]]}
```

- Può tornare su se stessa e toccarsi, e non deve racchiudere niente: i
  lati ripassati il motore li riconosce dalla geometria, come per i tratti.
- Si ricampiona tenendo tutti i vertici, come una forma con tratti.
- Rifiutati con il motivo: meno di 2 punti distinti, `path` insieme a
  `points` o `strokes`.
- **Aperta** (l'ultimo punto diverso dal primo) è una forma **a sola
  andata** (TASK-041, ADR-0043): il motore la pianifica come andata e
  ritorno al doppio della distanza, entrando solo dal suo primo punto, e
  del percorso tiene l'andata, fino al fondo della linea.

### Parole lettera per lettera (TASK-050)

Invece di un `path` disegnato a mano, una parola si **compone** da un
alfabeto a tratto singolo (`route_engine/letters.json`, ADR-0044): le 26
maiuscole dalla A alla Z (TASK-059, ADR-0056; prima solo C, I, A, O). Ogni
lettera è alta 1 e sta sulla sua base, y = 0:

```json
"A": {"out": [[0, 0], [0.12, 0.4], [0.48, 0.4], [0.6, 0]],
      "back": [[0.6, 0], [0.48, 0.4], [0.3, 1], [0.12, 0.4], [0, 0]]}
```

- `out` va dall'ingresso all'uscita, tutti e due sulla base, e può tornare
  su se stessa (la I sale e scende, la C fa andata e ritorno).
- `back`, solo se uscita e ingresso non coincidono, riporta all'ingresso
  senza passare dalla base: la A torna per le gambe, e la base non la
  chiude a triangolo. Solo B, D e Z, che una base ce l'hanno, tornano per
  quella; H, K, M, N, R, W, X restano aperte sotto, come la A.
- Ogni lettera entra dal suo punto più a sinistra sulla base ed esce da
  quello più a destra, così la linea che unisce le lettere non ci passa
  sopra. Un tratto sulla base si confonderebbe con quella linea: il tratto
  basso della E e della L sta a 0,2 dell'altezza, se no a metà parola si
  leggerebbero una F e una I.
- Larghe 0,5–0,65 (M e W 0,8, la I niente), le curve con un punto ogni 20°
  come la C e la O. Una lettera senza anelli (E, F, H, K, M, N, T, V, X…)
  si corre tutta due volte, andata e ritorno: un giro chiuso che non
  ripassi niente non c'è. Lunghezza del tratto, in altezze: 2 la I; 2,5–4
  A, B, C, D, F, J, L, O, P, Q, T, Y; 4–5,2 E, G, H, K, R, S, U, V, X, Z;
  6,3 la N, 7 la W, 7,2 la M.

`words.py` mette le lettere in fila, **0,6 dell'altezza** fra una e
l'altra, unite da tratti di base; dopo l'ultima lettera il percorso torna
indietro sulla base e sui `back`, fino alla partenza: una linea chiusa come
le altre forme. La linea parte **a metà del primo spazio**, e ogni lato è
diviso in pezzi di al più **1/16 dell'altezza**: «CIAO» ha 296 punti di
passaggio invece di 64, e la I ne ha 16 per salire e 16 per scendere. Ogni
punto sa di quale lettera è, o di quale spazio e a che punto (§5, «Lettere
che si spostano»). Lettere che l'alfabeto non ha (accenti, cifre,
segni): la parola è rifiutata, e il messaggio dice quali lettere ci sono
(«A to Z»).

La linea di base comincia dopo la prima lettera e finisce prima
dell'ultima: una I o una F all'inizio di una parola hanno la linea solo a
destra e si leggono come una L e una E: l'utente la tiene così
(TASK-059, ADR-0056).

### Lettere squadrate (TASK-077)

Un secondo alfabeto, `route_engine/letters_block.json`, nello stesso
formato, si sceglie con `style="block"` (`words.compose`,
`optimizer.plan_route`); senza, la parola è quella di sopra, identica
(ADR-0072). Ogni tratto è orizzontale, verticale o a 45°, come nelle scritte
di GPS art corse su una griglia di vie:

- O, D, B, Q sono rettangoli che si chiudono sulla base (la D con gli
  angoli di destra tagliati a 45°, la B con la pancia di sopra più stretta,
  la Q con una codina a 45° dentro l'angolo); la U è un rettangolo aperto
  con gli angoli bassi a 45°, fondo sulla base.
- C, G, S, J hanno il tratto basso a 0,2 dell'altezza, come oggi E e L:
  sulla base lo coprirebbe la linea che unisce le lettere. S e G sono a
  gradini, ad angolo retto.
- E, F, H, I, L, T come oggi, più larghe.
- Le diagonali a 45°: la A con la punta, M e W con la V a metà altezza, N,
  X e Z larghe 1, la V e la Y con le braccia a 45° dalla metà, la K con
  le braccia dal centro dell'asta, la R con la gamba.
- Larghe 0,8 (M, N, V, W, X, Y, Z 1; J 0,6, K 0,5, I niente), **0,3
  dell'altezza** fra una lettera e l'altra invece di 0,6. A 15 km, sul
  disegno, «CIAO» ha lettere alte 827 m (oggi 924), «BELLO» 507 (571),
  «MAX» 851 (854): le lettere sono più larghe, la parola più lunga.

`tests/measure_words.py` scrive le parole in uno dei due stili nelle tre
zone, solo dalla cache, e stampa le misure di ogni caso.

I contorni stanno in `route_engine/shapes/outlines/`, dati del pacchetto:
stella e casa (con camino e porta) disegnate per ShapeRoute, e la sagoma di
un cavallo al galoppo (OpenClipart, CC0). La casa si prova solo dalla CLI:
non è nel catalogo. Del cavallo resta il contorno
esterno, 147 vertici; a 64 punti gambe, coda e testa si leggono ancora, i
dettagli minori no. Come vengono sulle strade: ADR-0035 e
`samples/LOG.md`. Ci sono anche le candidate di TASK-034 (luna, pesce,
freccia, albero, corona, gatto); dal TASK-037 casa, albero, gatto e pesce
hanno dei tratti: due finestre, fusto e rami, gli occhi, l'occhio. Luna,
gatto e pesce sono nel catalogo dal TASK-039, gatto e pesce con i tratti;
freccia, albero, corona e casa si provano solo dalla CLI. Dal TASK-065 ci
sono anche farfalla, lumaca, testa di cane e testa di coniglio, tutte con i
tratti (ADR-0061); cane intero, uccello, zucca e albero di Natale restano
candidate da CLI (TASK-064, TASK-078). Lumaca e teste hanno più di 64
vertici: con i tratti restano tutti, e la forma ha più punti.

### Lettere unite anche dalla cima (TASK-067)

Due lettere si possono unire anche lungo la cima, y = 1, invece che lungo
la base (ADR-0063): dove accorcia la parola, perché a pari chilometri una
linea più corta dà lettere più alte. Fra una U e una V l'unione dalla base
va dal fondo dell'una alla punta dell'altra (1,2 altezze), dalla cima
dall'asta destra dell'una al braccio sinistro dell'altra (0,6).

Una lettera che si può unire in cima lo dice nell'alfabeto, con i suoi due
angoli alti:

```json
"V": {"top": {"in": [0, 1], "out": [0.6, 1]}, "out": [[0.3, 0], [0, 1], ...]}
```

- `in` è dove entra un'unione che arriva da sinistra, `out` dove esce
  quella verso destra; una lettera può avere solo `in` (B, D, P, R e K
  tonde: a destra la cima non arriva al bordo). Senza `top` la lettera si
  unisce solo dalla base, come prima.
- **La lettera resta la stessa**: entrata o lasciata in cima è la stessa
  linea chiusa, cominciata dall'ingresso e tagliata all'uscita
  (`Letter.route`). Stessi tratti, corsi lo stesso numero di volte: la
  lunghezza delle lettere non cambia, cambiano solo gli spazi.
- **Tre regole di lettura**, controllate sull'alfabeto da `parse_letters`:
  un `top` che ne viola una è rifiutato.
  1. Un'unione in cima non allunga un tratto che finisce sulla cima: la
     sbarra della T, il braccio alto di E, F e Z, e nelle squadrate anche
     di C, G e S. Il braccio si confonderebbe con l'unione, come la base
     inghiottiva il braccio basso di E e L (ADR-0056). Il lato alto di una
     pancia chiusa (P, R, la O squadrata) non finisce lì, e va bene.
  2. Un'unione in cima non passa sopra la lettera: entra dal bordo
     sinistro ed esce dal destro. Sotto una lettera la linea è il rigo su
     cui la parola sta; sopra è un tratto in più (la L diventerebbe una C,
     la A avrebbe una bandiera).
  3. Una lettera che tocca la cima in un punto solo non si unisce lì: la I
     fra due unioni in cima è una T («VIVA» si leggerebbe «VTVA»), e con
     la cima da un lato e la base dall'altro la I e la L sono un gradino.
- **La scelta** (`choose_joins`): ogni spazio va tutto lungo la base o
  tutto lungo la cima, mai in diagonale. Fra tutte le combinazioni che le
  lettere permettono, al più 128, vale la parola più corta; a pari
  lunghezza quella con meno unioni in cima. Stessa parola, stesse unioni.
  Una lettera può avere la cima da un lato e la base dall'altro (la V di
  «UVA»).

In cima si uniscono, tonde: H, M, N, U, V, W, X, Y da tutti e due i lati;
B, D, K, P, R solo da sinistra. Squadrate: H, K, M, N, O, P, Q, R, U, V, W,
X, Y; B e D solo da sinistra. Accorciano solo le coppie con U, V, W o Y
(tonde) e con P, U, V o Y (squadrate), che dalla base si uniscono a metà:
«UVA» 7,4% (8,6% squadrata), «NUVOLA» 5,2% (8,5%), «LUNA» 2,6%. Le altre
parole restano identiche. Misure e campioni: `docs/tasks/TASK-067.md`.

**Accese per difetto** in tutti e due gli stili (`words.TOP_JOINS`), per
scelta dell'utente (2026-10-02, ADR-0063). `compose` e `plan_route` hanno
`top_joins`, e `tests/measure_words.py` `--no-top-joins`: con `False` la
parola è quella di prima, punto per punto. La richiesta all'API resta la
stessa: cambia il percorso delle parole con U, V, W o Y.

### Parole con la penna alzata (TASK-197)

Una parola si può chiedere **con la penna alzata** (`pen_up`, ADR-0157):
fra una lettera e l'altra si cammina senza disegnare, e l'app mette in
pausa la registrazione (TASK-198). `compose(..., pen_up=True)`:

- ogni lettera è solo il suo `out`, dall'ingresso all'uscita sulla base,
  una volta: niente `back`, niente linea di base che la unisce alla
  successiva, niente ritorno alla partenza. La linea è **aperta**: parte
  dall'ingresso della prima lettera e finisce all'uscita dell'ultima;
- le lettere stanno dove le mette la parola chiusa senza unioni in cima,
  con lo spazio dello stile (0,6 dell'altezza, 0,3 le squadrate) fra
  l'uscita di una e l'ingresso dell'altra. Niente unioni in cima: la linea
  dritta che Strava traccia durante una pausa cade sulla base;
- i punti degli spazi restano nella linea, con il loro `Place`, per
  piazzare la parola e per allungarsi quando una lettera si sposta; il
  percorso non li disegna (§5, «La penna alzata»).

A parità di km le lettere vengono più alte, perché la distanza vale per le
lettere sole: «CIAO» è lungo 9,5 altezze invece delle 16,2 della linea
chiusa (andata, ritorno e base), 1,7 volte meno. A Trento, a 15 km, lettere
di 1.121 m invece di 659.

### Pezzi staccati dal contorno (TASK-223)

Un contorno può avere anche dei **pezzi** (`pieces`, facoltativi, ADR-0185):
linee staccate da tutto il resto, come gli occhi e il sorriso di una
faccina, i raggi di un sole, il buco di una ciambella. Lo stesso file si
disegna in due modi:

```json
"pieces": [
  [[-0.36, 0.11], [-0.29, 0.13], ..., [-0.36, 0.11]],
  [[-0.57, -0.14], [-0.48, -0.25], ..., [0.57, -0.14]]
]
```

- Un pezzo **chiuso** (l'ultimo punto ripete il primo, almeno 3 punti
  distinti) è un anello, come un occhio; uno **aperto** è una linea, come
  una bocca. Non tocca il contorno, i tratti, gli altri pezzi, né se
  stesso; contorno, tratti e pezzi stanno nello stesso riquadro.
- **Con la penna alzata** (`Outline.pen_up_lines`, `pieces.py`): prima il
  contorno con i suoi tratti, dal suo primo punto; poi ogni pezzo una
  volta, nell'ordine del file, a piedi dall'uno all'altro come fra le
  lettere di una parola (§5, «La penna alzata»). Un anello parte e finisce
  dal suo vertice più vicino a dove finisce la linea prima; una linea
  aperta dalla sua punta più vicina.
- **Con la penna giù** (`Outline.joined`): ogni pezzo si attacca al disegno
  con il collegamento più corto, dal punto più vicino delle linee prima di
  lui (il contorno, i tratti, i pezzi già attaccati e i loro collegamenti)
  al suo vertice più vicino, o alla punta più vicina di una linea aperta.
  Da lì è un tratto (sopra): andata e ritorno sul collegamento, l'anello
  una volta, la linea aperta fino in fondo e indietro. Un collegamento che
  taglierebbe un'altra linea si rifiuta, con il motivo: basta cambiare
  l'ordine dei pezzi.
- Senza pezzi un contorno si legge e si disegna come prima.

Le forme che hanno già gli occhi come tratti (gatto, pesce, teste di cane e
coniglio, zucca) li **staccano** con la penna alzata senza cambiare il
disegno con la penna giù: `"lift": [1, 2]` nel file dice quali tratti, da 1.
Di un tratto staccato la penna alzata disegna solo l'anello, chiuso, con ciò
che ci è appeso, dopo il contorno e prima dei pezzi; il collegamento che lo
appende no. Si staccano solo tratti che chiudono un anello, e niente può
pendere dal loro collegamento (la bocca della testa di cane pende da quello
del naso: il naso non si stacca).

I pezzi sono dettagli, come i tratti: con la penna alzata zone e corridoio
sono sempre quelli dimezzati (ADR-0039), e un anello si traccia chiuso,
così finisce dove è cominciato. Senza queste due cose, su una griglia di
vie da 100 m una faccina quadrata disegnava gli occhi a «P» e non si
chiudeva (0,48 contro 0,97, `tests/test_pieces.py`).

Le forme a pezzi si provano dalla CLI, `--outline FILE --pen-up`; nel
catalogo entrano solo dopo il giudizio dell'utente (ADR-0036). Dei candidati
del TASK-223 (`shapes/outlines/`, campioni in `samples/`, `TASK-223_*`)
sono entrati `smiley`, `ghost`, `donut` e `sun`, a pezzi; `lightning`,
`drop`, `balloon`, `ice_cream`, `cloud` e `apple`, a contorno solo, restano
alla CLI.

**Una richiesta con la penna alzata** (`RouteRequest.pen_up`, TASK-223 B)
vale per una parola e per una forma del catalogo che ha pezzi o tratti
staccabili (`shapes.in_pieces`): le quattro sopra e gatto, pesce, teste di
cane e coniglio, zucca. `plan_route` e `ShapeJob.of_request` la scrivono con
`pieces.compose_shape`, il risultato tiene `shape` e ha i `walks`. Una forma
senza pezzi si rifiuta (`… or the pieces of a shape; heart has none`).
Sull'acqua la penna alzata vale da TASK-226 (§8, «Una forma a pezzi
sull'acqua»): i pezzi si piazzano col contorno, senza `pieces.compose`. Con
la penna giù una forma a pezzi è una linea chiusa come le altre.

### Il contorno da un'immagine (TASK-072, TASK-084)

`route_engine/image_outline.py` ricava un contorno dal soggetto di
un'immagine PNG o JPEG, con regole fisse: la stessa immagine dà sempre lo
stesso contorno, e l'AI non c'entra (ADR-0068). Vale per **un soggetto
chiaro su sfondo uniforme**: un disegno, un logo, una sagoma, un oggetto
fotografato su un tavolo bianco. Del soggetto si tiene **solo il contorno
esterno**: buchi e linee interne si perdono. Con **più soggetti staccati,
fino a 4**, il contorno resta una linea sola (ADR-0079, punto 5).

1. L'immagine si raddrizza secondo l'EXIF (le foto del telefono) e si
   riduce a 640 pixel di lato al più.
2. Lo **sfondo** è quello che mostra il bordo dell'immagine (una fascia del
   2% del lato): il suo colore è la mediana del bordo, e almeno il 70% del
   bordo deve stare entro 40 da quel colore (distanza RGB). Un'immagine
   trasparente attorno al soggetto usa la trasparenza.
3. Il **soggetto** sono i pixel lontani dallo sfondo almeno 60, o il doppio
   della variazione dello sfondo lungo il bordo se è di più. I suoi pezzi
   diventano poligoni; quelli sotto l'1% del più grande sono macchioline, e
   si ignorano. Il più grande dà il contorno (`points`).
4. Il contorno si **liscia alla scala delle strade**: le parti più sottili
   del 2% del disegno si tolgono e le fessure altrettanto strette si
   chiudono (ADR-0039: i dettagli sottili sulle strade non restano), con
   gli angoli che restano angoli. Poi si **semplifica** agli angoli che si
   scostano più dell'1% del disegno, al più 100. Il «disegno» sono tutti i
   soggetti insieme: con uno solo è il soggetto, come prima di TASK-084.
5. Gli **altri pezzi sono altri soggetti** (TASK-084): ognuno si liscia e
   si semplifica come il più grande, alla scala di tutto il disegno, e
   diventa uno `stroke` con l'anello in fondo, come un occhio. Il gambo è
   il **collegamento**: il tratto più corto fra il soggetto e ciò che è già
   disegnato (il contorno, o un soggetto o un collegamento di prima),
   trovato sulle linee già semplificate. Si attacca per primo il soggetto
   più vicino: così nessun collegamento attraversa un altro soggetto. Il
   percorso fa il collegamento andata e ritorno, e il soggetto una volta.
   Non sono soggetti: un pezzo dentro un altro (è una sua linea interna),
   un pezzo secondario tagliato dal bordo, uno che la lisciatura consuma.
   Due soggetti più vicini del 2,5% del disegno diventano uno solo:
   semplificati, le loro linee potrebbero toccarsi. Gli `strokes` di tutti
   i soggetti insieme hanno al più 150 punti (`MAX_SUBJECT_POINTS`).

Il risultato è un contorno come quelli dei file (`name`, `source`,
`license`, `points` e `strokes` in pixel, y verso l'alto) e passa lo stesso
controllo (`parse_outline`, quello severo: nessuna linea ne incrocia
un'altra). Un'immagine che non va è **rifiutata con il motivo**,
una parola che l'API potrà tradurre (`InvalidImageError.reason`):

| `reason` | Quando |
|---|---|
| `unreadable` | il file non si legge come immagine |
| `format` | un formato che non è PNG o JPEG |
| `background` | lo sfondo non è uniforme |
| `no_subject` | niente si stacca dallo sfondo |
| `scattered` | più di 4 soggetti (`MAX_SUBJECTS`) |
| `edge` | il soggetto tocca il bordo dell'immagine |
| `small` | il soggetto è sotto i 48 pixel (su 640), o l'immagine sotto i 96 |
| `jagged` | più di 100 angoli anche dopo la semplificazione, o più di 150 punti per gli altri soggetti |

Dalla CLI, `--image` al posto di `--shape`; il nome della forma è quello
del file. `--save-outline` scrive il contorno in JSON per guardarlo, e si
rilegge con `--outline`:

```
python -m route_engine --image mela.png --save-outline mela.json     --distance 15000 --start 46.0671,11.1214 --out mela_trento.gpx
```

Come per `--outline`, la forma resta dritta (ADR-0038) e passa da
`plan_shape`. Il modulo sta fuori da `shapes/`, che legge i contorni con
la sola libreria standard: per ricavarne uno servono Pillow, numpy e
shapely.

### Parti e dettagli disegnati a mano (TASK-079)

`route_engine/outline_edits.py` (ADR-0074) aggiunge a un contorno una linea
disegnata col dito, e decide cosa diventa, con regole fisse:

- `add_part`: la linea si chiude, si semplifica all'1% e si **unisce alla
  sagoma**. Deve sovrapporsi (altrimenti i pezzi sarebbero due) e
  aggiungere almeno lo 0,5% dell'area; i buchi si perdono; i dettagli già
  fatti devono restare attaccati alla linea nuova.
- `add_detail`: la linea diventa uno **`stroke`** (TASK-037). L'inizio si
  aggancia al punto più vicino del contorno o di un dettaglio entro il 6%
  della sagoma, lasciando i punti fatti scorrendo sulla linea; dove la
  linea si incrocia da sola si chiude un anello (un occhio) e il resto si
  lascia, e così se la fine torna entro il 3% da un suo punto. Poi la
  semplificazione all'1%.

Un disegno **lontano da ogni linea non si rifiuta**: si collega. Una linea
aperta prende un tratto dritto dal punto più vicino del contorno o di un
dettaglio fino al suo capo più vicino; una forma chiusa che non si
sovrappone alla sagoma, o che ci sta tutta dentro, diventa un anello appeso
per il suo angolo più vicino. Le linee disegnate a mano **possono
incrociarsi** e incrociare il contorno: `parse_outline(...,
allow_crossings=True)` salta il controllo degli incroci, che per i file dei
contorni resta. Il percorso è sempre una linea sola, che lì si incrocia.

Tutto nella cornice del disegno, x a destra e y in alto, a qualunque scala.
Ogni risultato passa `parse_outline` con i suoi dettagli: la linea resta
una sola. Un disegno che non va è rifiutato con il motivo
(`InvalidEditError.reason`): `short`, `covers_detail`,
`too_many_corners` (oltre 100
angoli per il contorno, 200 punti percorsi per tutti i tratti (un tratto senza anello conta due volte, andata e ritorno: circa 100 punti di dettagli; TASK-084), 2000 per un
disegno).

## 3. Proiezione geografica

Trasformazione dei punti normalizzati in coordinate reali, applicando
**scala, rotazione e traslazione**. Sono i tre parametri che l'ottimizzatore
di §5 andrà a cercare.

Si lavora sempre in metri su un piano locale, mai in gradi: un grado di
longitudine a Levico vale circa 740 m, uno di latitudine circa 111 km, e
ignorarlo schiaccia la forma.

Approccio: piano tangente locale centrato sul punto di partenza.

```
lat = lat0 + (y_m / R) · 180/π
lon = lon0 + (x_m / (R · cos lat0)) · 180/π       R = 6_371_000 m
```

Misurato: su un cuore da 50 km l'errore sul perimetro è sotto lo 0,05% e
nessun punto si sposta di più di 8 m (a 60°N). Basta: niente `pyproj`
(ADR-0018). Il piano è tangente nel punto di partenza.

La rotazione è in gradi, **antioraria** (x verso est, y verso nord), e si
applica dopo la scala.

**Scala iniziale**: la forma normalizzata ha un perimetro noto in unità
normalizzate. Per ottenere `distance_m`, scala = `distance_m / perimetro`.
È solo un punto di partenza: il percorso reale sarà più lungo della forma
teorica, perché la rete costringe a deviazioni. Il fattore di correzione
empirico si misura, non si indovina.

**Vincolo di partenza**: il percorso deve passare per il punto dell'utente.
La traslazione non è quindi libera: il punto di partenza sta sulla curva,
non al suo centro. Quale punto della forma coincida con la partenza è esso
stesso un parametro (è la fase lungo la curva).

La **fase** è una frazione del perimetro in `[0, 1)`, misurata dal vertice 0
della forma. La curva proiettata comincia e finisce esattamente nel punto di
partenza; tutti i vertici della forma restano, e il punto di fase si
aggiunge solo se cade fra due vertici.

## 4. Snapping alla rete reale

I punti geografici della forma quasi mai cadono su una strada. Vanno
agganciati al grafo stradale e collegati tra loro.

Procedura di base:

1. Scaricare il grafo del rettangolo che contiene la forma proiettata,
   più un margine (ADR-0020), filtrato per l'attività: a piedi, la rete
   pedonale **con le ciclopedonali** (ADR-0022); in bici, la rete `bike`,
   con i sensi unici (ADR-0153, «La rete della bici» qui sotto).
2. Il primo punto della forma è la partenza: il percorso inizia e finisce
   al **nodo più vicino**.
3. Ogni altro punto della forma è una **zona**: i nodi entro un raggio dal
   punto. Raggiungere un nodo della zona costa la strada più la sua
   distanza dal punto, così il percorso sceglie il nodo comodo e non
   quello più vicino in linea d'aria ma oltre un fiume (TASK-017).
4. Fra una zona e la successiva, percorso di costo minimo in cui le strade
   lontane dal contorno costano di più (**corridoio**), tranne che dentro
   una fascia di tolleranza: il percorso segue il bordo invece di tagliare
   per l'interno, senza zig-zag per restarci appiccicato.
5. Concatenare i segmenti; l'ultimo torna alla partenza, chiudendo il ciclo.
6. Eliminare gli speroni: ogni A → B → A diventa A, e ogni andata e
   ritorno su strade parallele (marciapiede e strada) si sostituisce con il
   breve collegamento fra i due capi; le due potature si ripetono finché il
   percorso non cambia. Restano quelli che portano a una punta della forma
   (la punta del cuore), che la disegnano (ADR-0025, ADR-0026).

I **tratti** della forma (§2) si disegnano due volte apposta: il motore li
riconosce perché i loro lati coincidono, entro 1 m, con altri lati della
forma percorsi in senso contrario. Andando verso un punto di un tratto le
strade già percorse non costano di più, così il ritorno passa dalla stessa
strada dell'andata; la punta di ogni linea è un angolo, quindi la potatura
non la toglie (ADR-0039).

Raggio delle zone e fascia sono frazioni del perimetro della forma: crescono
con la distanza richiesta. Per una forma con tratti valgono la metà
(`STROKE_DETAIL`): a 15 km un occhio o una finestra sono larghi quanto il 2%
del percorso, e con zone e fascia così larghe il percorso passa accanto al
dettaglio senza disegnarlo (ADR-0039).

Valori, cache e misure: `MAPS.md`.

### I due problemi che emergono subito

**Andata e ritorno sulla stessa strada.** Se due waypoint consecutivi sono
collegati da un'unica via, il percorso ci passa due volte e sulla mappa si
vede un tratto che si ripercorre: brutto e ingannevole sulla distanza.
Mitigazione: aumentare il peso degli archi già usati, così il calcolo
preferisce strade nuove anche se più lunghe. Misurato in TASK-014: da sola
la penalità non basta, perché spesso il ritorno è l'unica via. Ciò che
funziona è potare gli speroni dopo il routing (passo 6).

**Deviazioni verso l'interno.** Collegare waypoint consecutivi col percorso
più breve taglia per l'interno appena il bordo non ha una strada continua, e
agganciare ogni punto a un solo nodo costringe a raggiungere anche i nodi
oltre un ostacolo. Zone e corridoio (passi 3 e 4) riducono entrambe le cose
(TASK-017). Quello che resta dipende da dove cade la forma: se il contorno
passa su campi o su un fiume, nessun aggancio lo recupera. Lo risolve
l'ottimizzatore spostando e ruotando la forma (§5).

**Rete troppo rada.** Se il nodo più vicino a un waypoint dista centinaia di
metri, la forma è irrecuperabile in quel punto. Non va nascosto: si misura
la distanza media punto-forma → nodo e, oltre una soglia, si restituisce un
warning esplicito in `RouteResult.warnings`. Vedi `PRODUCT.md`, rischi.

**Nessuna strada.** Se attorno alla partenza il grafo non ha strade (un
ritaglio senza nodi, o con un nodo solo), non c'è niente da agganciare: il
motore rifiuta con `NoRoadsError` (`errors.py`), un `ShapeNotDrawableError`
come ogni forma che lì non si disegna (TASK-180, ADR-0148; `MAPS.md`,
«Warning»).

**Un nodo solo.** Se tutti i punti di un contorno hanno lo stesso nodo più
vicino (poche strade, lontane dalla forma: una zona di campagna), quel
contorno non si aggancia: `snap_to_network` lancia `CollapsedShapeError`,
anche lei uno `ShapeNotDrawableError`. La ricerca salta quel tentativo e
prova le altre posizioni; se vicino non si traccia niente cerca entro 2 km
(§5, «Trova dove la forma ci sta»), e se nemmeno lì rifiuta con «… nor
within 2 km: too few roads, the shape collapses onto a single road node
wherever it is placed» (TASK-277, aggiunta ad ADR-0040). Prima era un
`ValueError` che finiva in `engine_error`.

### La rete della bici (TASK-190)

Una richiesta `activity: "cycling"` (10–30 km, `DISTANCE_LIMITS_M` in
`models.py`) si disegna sulla rete `bike` (ADR-0153, filtro e regole in
`network.py`):

- **Quali strade**: ciclabili e strade fino alle `primary` (`BIKE_ROADS`:
  anche `service` e `track`); i `path`, `footway` e `bridleway` solo se
  segnati come ciclabili (`bicycle=designated`); le zone pedonali dove le
  bici sono ammesse. Mai scale, `trunk` e autostrade; mai le strade chiuse
  alle bici (`bicycle=no`, `dismount`, `use_sidepath`, `motorroad=yes`) o
  a tutti i veicoli (`access`, `vehicle`), salvo un `bicycle=yes` esplicito
  (`rideable`).
- **Sensi unici**: valgono. Il grafo è orientato e il percorso segue gli
  archi: **un tratto contromano in sella non esiste**, non è un warning
  (a piedi sì, dal TASK-206: «La bici a mano» qui sotto). Un senso
  unico è percorribile nei due sensi in bici solo dove OSM lo dice
  (`oneway:bicycle=no`, `cycleway=opposite*`, una corsia ciclabile
  dall'altro lato con `cycleway:<lato>:oneway=-1`); una strada a doppio
  senso con `oneway:bicycle=yes` è a senso unico per le bici
  (`bike_direction`). Le regole si applicano strada per strada, prima che
  OSMnx unisca le strade in archi.
- **Pezzi**: un ritaglio della rete `bike` tiene il pezzo più grande in cui
  **ogni nodo si raggiunge da ogni altro** (`crop`, `largest_piece`; per le
  zone `bike` anche `ZoneCrop` passa da `crop`): da un senso unico cieco
  non si torna. A piedi resta il pezzo con le strade unite, come prima.
- **Partenze vicine** (§5): il ritorno alla partenza è la via più breve
  consentita, non l'andata al contrario (`with_approach`).
- **La rete giusta**: un grafo `bike` porta `network="bike"`; `plan_shape`
  e `ShapeJob` rifiutano un grafo di un'altra rete con
  `WrongNetworkError` (`check_network`): un percorso in bici sulla rete a
  piedi passerebbe per scale e contromano.
- **La bici a mano** (TASK-206, ADR-0167; scelta dell'utente: «poco»):
  dove la bici non si guida ma si può portare a piedi (`walkable`:
  `footway`, `path`, `bridleway` e zone pedonali chiuse alle bici, ogni
  via con `bicycle=dismount`; mai scale, mai vie chiuse ai pedoni) la rete
  ha archi nei due sensi segnati `walk`; e accanto a ogni senso unico c'è
  l'altro senso, a piedi sul marciapiede (`walkable_beside`). Un metro a
  piedi costa **`WALK_COST` = 6** metri in sella, nel corridoio del
  tracciamento e nelle vie più brevi fuori dalla forma (`step_cost`): il
  percorso porta la bici a mano solo dove la forma ne guadagna molto. A
  Trento, 10 km: 0,7–1,1 km a piedi, cuore da 0,70 a 0,79, cerchio da 0,77
  a 0,90. I controlli contano i metri a piedi (`on_foot`) e l'avviso li
  dice («… m of the route with the bike on foot»). Una zona `bike_*` fatta
  prima di TASK-206 non ha archi `walk` e si disegna come prima. Il
  risultato dice dove (`RouteResult.on_foot`, parte B): coppie `[da, a]` di
  indici nei punti, calcolate dai nodi del percorso
  (`network.on_foot_stretches`: i punti sono il primo nodo più quelli di
  ogni arco tranne il primo), nelle alternative e, da una partenza vicina,
  con l'avvicinamento e il ritorno (`with_approach`).

La rete a piedi non cambia: stesso filtro, stessi file, stessi percorsi.

Il provider definitivo di routing (OSMnx locale, OSRM, GraphHopper, Valhalla)
è una decisione aperta. Per la fase 1 si usa OSMnx perché gira in locale
senza server, il che rende il ciclo di prova rapidissimo.

### Da una linea ai suoi nodi (TASK-145)

I percorsi di «Explore» arrivano all'app come soli punti: il catalogo non
tiene altro. `route_nodes.nodes_along(graph, points)` ritrova i nodi del
grafo per cui passa la linea, per darle le indicazioni di svolta
(`directions.guidance`) come a un percorso pianificato (ADR-0117). Funziona
perché i punti del motore sono i nodi e la geometria dell'arco più corto
fra due nodi (`_edge_points`): ogni nodo è uno dei punti, anche arrotondato
a 6 decimali come nei file (circa 0,1 m).

- Un punto entro **1 m** da un nodo è quel nodo (`MATCH_M`); lo stesso
  nodo su punti di fila conta una volta.
- Un nodo che sta solo vicino alla linea (un ponte sopra una via, la
  geometria di un arco che sfiora un incrocio di un'altra strada) si scarta
  quando il nodo dopo si collega senza di lui.
- Due nodi senza strada fra loro, perché la zona è stata riscaricata e
  OpenStreetMap è cambiato, si uniscono con la via più breve se non supera
  **2 volte** il tratto di linea fra i due, più **50 m**; altrimenti il
  nodo si salta.
- Meno di due nodi trovati: `RouteNotOnGraphError` (un
  `InvalidRequestError`), la linea non è su questa mappa.

Su 4 percorsi appena pianificati (Trento, Bologna, con le alternative) le
indicazioni ricavate dai punti sono identiche a quelle del motore: nodo,
svolta, via, `along` e distanza.

## 5. Ottimizzazione e somiglianza

La forma non si disegna a scala e rotazione fisse: si adatta alle strade
(TASK-015, ADR-0023). La partenza si può spostare fino a 500 m dal punto
richiesto, se da lì la forma si chiude meglio (ADR-0025).

### Parametri da cercare

| Parametro | Valori | Note |
|---|---|---|
| rotazione | −15°, 0°, +15°, poi ±15° ogni 5° restando entro ±15°; se non basta, ±30° e ±45°, poi ogni 5° fra 15° e 45° | attorno alla partenza; il cerchio 0–345° ogni 15° |
| fase di partenza | 0; 0,25; 0,5; 0,75 | dove la partenza entra nella forma |
| scala | 0,4–1,1 × la stima di §3 | le strade allungano il percorso fino a 2,5× |
| partenza | il punto richiesto, o a 250 / 500 m in 8 direzioni | spostarla deve valere almeno il 5% del contorno |
| partenza lontana | a 1 / 1,5 / 2 km in 12 direzioni | solo nel secondo tempo, sotto |

La rotazione conta molto dove la rete ha buchi (campi, fiumi, ferrovie); in
una città fitta come Milano la forma va bene già dove cade. Su una mappa
col nord in alto l'occhio non riconosce una forma inclinata: dal TASK-036
ogni forma restava dritta entro ±15°, tranne il cerchio, che a qualsiasi
angolo è lo stesso (ADR-0038). Dal TASK-232 l'app gira la mappa come la
forma, e una forma si inclina fino a **45°** (ADR-0195, «Forme inclinate»
qui sotto).

### Strategia di ricerca

1. **Conteggio delle strade**, per tutte le combinazioni di partenza,
   rotazione e fase (17 × 3 × 4, il cerchio 17 × 24 × 4): la quota del contorno con una strada entro la fascia del corridoio
   (§4). Le strade si campionano una volta, su una griglia; nessun routing,
   quindi costa pochi millisecondi a combinazione.
2. **Tracciamento** (§4) della combinazione migliore, su un ritaglio del
   grafo attorno alla forma.
3. **Correzione della scala** verso la distanza target: prima in
   proporzione, poi per secante sugli ultimi due tentativi, perché la
   distanza non cresce in proporzione alla scala. Fino a 4 tracciamenti.
4. Si ripete per altre 2 combinazioni, riordinate alla scala imparata e
   lontane da quelle già provate; poi si rifinisce la rotazione migliore.
5. Con il budget che resta (20 tracciamenti in tutto, fino a 6
   piazzamenti) si corregge ancora la distanza del piazzamento migliore.
6. **Le inclinazioni oltre 15°** (TASK-232): se fin qui nessun percorso
   è buono, gli stessi passi 1–5 ripartono con le sole rotazioni oltre
   ±15° (±30°, ±45°; la rifinitura ogni 5° fra 15° e 45°) e **10
   tracciamenti in più** (`TILTED_TRACES`); non nella ricerca lontana.
   Sotto, «Forme inclinate».

Ci si ferma appena distanza (±10%) e somiglianza (≥ 0,90) vanno bene. Se il
budget finisce prima, si restituisce il tentativo di costo minore, dritto
o inclinato, entro
**±2 km** dal target, con un warning che dice cosa manca. Se la somiglianza
migliore è sotto **0,60**, o nessun tentativo sta entro ±2 km, nessun
percorso: la forma lì non è disponibile (ADR-0025).

### Forme inclinate (TASK-232)

L'app gira la mappa di quanto è girata la forma (`RouteResult.rotation_deg`,
antiorario, fra −180° e 180°, 0 per il cerchio), così il disegno si vede
dritto anche inclinato: il motivo di ADR-0038 cade, e una forma con un
alto e un basso si inclina fino a **±45°** (`MAX_TILT_DEG`, ADR-0195):
catalogo, emoji, contorni da foto, parole.

1. **Prima dritta, come prima**: la ricerca di sempre, entro ±15°
   (`UPRIGHT_TILT_DEG`) e con i suoi 20 tracciamenti. Se dà un percorso
   buono, è lui: stesso percorso e stesso tempo di prima.
2. **Poi inclinata**, solo se il primo tempo non trova un percorso buono:
   la stessa ricerca sulle sole rotazioni oltre ±15°, con 10 tracciamenti
   in più (`TILTED_TRACES`). Il risultato è il migliore dei due tempi. Le
   partenze vicine fanno lo stesso; la ricerca lontana (ADR-0040) no:
   resta dritta, e parte, come prima, se nessun percorso vicino è buono.
   Fra vicino e lontano si decide sul primo tempo, quello dritto
   (`Search.upright`): un percorso inclinato vicino che non è buono non
   tiene fuori quello lontano.
3. **Inclinarla costa**: oltre 15°, il 5% di copertura a 45° in
   proporzione all'angolo (`TILT_FIT_PENALTY`, come spostare la partenza
   di 500 m), sia nel conteggio delle strade sia nel costo di un
   tracciato (`W_TILT`). Entro 15° non costa, come prima. A parità vince
   la forma più dritta.
4. **Il risultato** dice la rotazione del percorso scelto (`shown_rotation`),
   anche per ogni partenza vicina e alternativa, e in canoa; 0 senza
   ricerca e per le forme che girano libere.

Provare tutte le rotazioni insieme, con la penalità in proporzione
dall'angolo 0 o da 15°, è stato misurato e scartato: il conteggio delle
strade premiava piazzamenti inclinati che tracciati venivano peggio, e la
ricerca, con lo stesso budget, perdeva percorsi buoni (`MAPS.md`, «Forme
inclinate»).

### Trova dove la forma ci sta (TASK-038)

Se la ricerca attorno alla partenza non trova **nessun percorso
disegnabile** (somiglianza sotto 0,60, o oltre ±2 km dal target: quelli che
il motore rifiuterebbe), c'è un **secondo tempo** (ADR-0040):

1. si carica un grafo più grande, che copre la forma anche da una partenza
   a 2 km (può voler dire scaricare una zona nuova);
2. la stessa ricerca riparte dalle partenze lontane (1, 1,5 e 2 km in 12
   direzioni), con altri 20 tracciamenti;
3. il percorso lontano sostituisce quello vicino se è buono, o anche solo
   disegnabile: quello vicino non lo era. Spostarsi continua a costare come
   sopra, quindi fra due posti buoni vince il più vicino.

Dove vicino alla partenza un percorso si disegna, **anche non buono**, il
secondo tempo non parte (TASK-203 B, ADR-0230). Fino ad allora partiva
appena il percorso vicino non era buono (distanza ±10% e somiglianza
≥ 0,90): era metà del tempo di una richiesta lunga (1,3–1,9 s su cuore e
cerchio, 3,6–6,5 s su una parola tonda, sul Mac) e, su 15 richieste in sei
città, ha dato un percorso migliore in una (il cerchio da 15 km a Bologna,
0,92 a 1 km invece di 0,88 dalla partenza). Scelta dell'utente del
2026-10-07: percorsi più veloci anche se diversi. Se la forma non è
disponibile né vicino né lontano, l'errore lo dice («… cannot be drawn
here, nor within 2 km: …»). L'avviso sullo spostamento passa ai km sopra i
1000 m («start moved 1.5 km north-east of the requested point, …»).

### Partenze vicine (TASK-076)

Pochi metri di partenza cambiano il percorso che la ricerca trova: a
Caldonazzo 25–100 m portano il cuore da 10 km da 0,73 a 0,92 (TASK-075).
Con `nearby_starts.plan_nearby` (ADR-0071) il motore prova la forma anche
da alcuni nodi della rete vicini e tiene il percorso migliore:

1. **Quali partenze**: fino a 3 nodi a 25–100 m in linea d'aria, uno per
   settore attorno alla partenza (il primo centrato sul nord), a non più di
   150 m lungo le strade (un nodo oltre il fiume non è vicino) e a 25 m
   l'uno dall'altro; nel settore, quello la cui strada è più vicina a 60 m.
2. **In parallelo**: la partenza dell'utente fa il piano di sempre, nel
   processo che la chiede (può scaricare la zona, spostare la partenza,
   cercare a 2 km). Ogni partenza vicina ha un processo suo, con il grafo
   già ritagliato per la partenza, e fa solo la ricerca da quel nodo: né
   anelli a 250–500 m né seconda ricerca, perché un percorso che comincia
   altrove andrebbe scartato comunque.
3. **Quanto si aspetta**: finita la partenza dell'utente, le vicine hanno
   al più altri 8 s, e mai oltre 25 s dalla richiesta; nessuno se il suo
   percorso è già buono. Quelle ancora in corso si lasciano: ogni processo
   ha una pipe sua e si ferma con `terminate`, non un `multiprocessing.Pool`,
   il cui `terminate()` aspettava per sempre se arrivava mentre un grafo
   stava per essere mandato (TASK-248, ADR-0212). Non si provano
   su grafi oltre 30 000 nodi (Milano) né in più processi di quanti ne
   entrano nella memoria che un processo nuovo può prendere: su Linux
   MemAvailable, che conta anche la cache dei file, non la memoria libera
   (TASK-147).
4. **Quale si tiene** (scelta dell'utente): il cuore migliore fra tutti,
   anche quello che la ricerca ha spostato («Start here»). Conta la
   somiglianza, meno la distanza oltre il 10% dal target; fra i candidati
   entro 0,01 dal migliore vince quello che comincia più vicino
   all'utente.
5. **L'avvicinamento**: se vince una partenza vicina, il percorso comincia
   dal nodo della partenza dell'utente, va al nodo vicino per la strada più
   corta, disegna la forma e torna indietro per la stessa strada. I metri
   dell'avvicinamento contano nella distanza e sono nel GPX; la somiglianza
   resta quella della forma.

Dalla CLI: `--nearby N` (N partenze vicine; senza, solo la partenza come
prima). L'API la usa per le forme, le parole e, da TASK-093, le immagini
(`plan_request`).

### Altri percorsi fra cui scegliere (TASK-093)

I percorsi delle partenze che non vincono non si buttano più
(`alternatives.py`, ADR-0087): `Plan.alternatives` ne tiene fino a **2**,
dal migliore, e l'API li manda all'app come `alternatives` del risultato.
Un percorso entra solo se:

- la sua somiglianza è al massimo **0,10** sotto la migliore fra tutti
  (scelta dell'utente: «10 punti» del percento che l'app mostra);
- non è **lo stesso percorso** di quello scelto o di uno già tenuto: lo è
  quando ciascuno corre entro **20 m** dall'altro per il **90%** della sua
  lunghezza (shapely, in metri), come una partenza a pochi metri che poi
  prende le stesse strade, o il marciapiede di fronte. Due percorsi diversi
  e buoni uguali si tengono tutti e due (ADR-0086).

Il percorso scelto resta quello di prima. Una differenza sola: se il
piano della partenza dell'utente è già buono, prima le vicine non si
aspettavano; ora si aspettano al più **3 s** (`NEARBY_GOOD_GRACE_S`), solo
per avere le alternative. Se in quei 3 s una vicina trova un percorso
nettamente migliore (oltre 0,01), vince quello, come succedeva già senza
piano buono. Misure del 2026-10-01 sul Mac, zone in memoria:

| Richiesta | Tempo | Scelto | Alternative |
|---|---|---|---|
| cuore 10 km, Caldonazzo | 1,7 s | 0,86, uguale a ieri | 0,82 · 0,79 |
| «CIAO» squadrato 12 km, Levico | 2,9 s | 0,89, uguale | nessuna (0,78 e meno) |
| stella 5 km, Levico | 0,9 s | 0,81, uguale | 0,77 |
| cuore 15 km, Trento | 6,0 s | 0,90 | 0,88 · 0,86 |
| immagine 12 km, Trento | 2,8 s (1,5 prima) | 0,91 | 0,92 · 0,91 |
| immagine 10 km, Caldonazzo | 1,5 s | 0,85 (0,75 prima) | 0,80 · 0,80 |

Le indicazioni di svolta delle alternative costano 0,03–0,15 s in tutto.
Le 8 richieste fatte dall'iPhone il 2026-10-01, rifatte dal registro,
danno lo stesso percorso scelto punto per punto. Dove le partenze vicine
sono poche (una sola a Levico, via Montebello) le alternative possono
mancare: l'app mostra allora il percorso da solo, come prima.

### Dove la forma viene meglio (TASK-234)

Un percorso può riuscire alla distanza chiesta mentre, a un'altra, la
forma verrebbe chiaramente meglio. La ricerca lo ha già visto: fra i suoi
tentativi (`Search.attempts`) ci sono quelli riscalati, ciascuno con la
sua somiglianza e la sua lunghezza. `optimizer.better_distance` (ADR-0197)
li guarda dopo che il percorso è scelto, senza tracciare niente in più:

1. **Il confronto** è sul costo senza la parte della distanza
   (`shape_cost`): forma, baffi in più e partenza spostata, come nella
   funzione obiettivo qui sotto. Un tentativo è «chiaramente meglio» se lo
   ha più basso di quello scelto di almeno `BETTER_MARGIN` = `W_SHAPE ×
   0,05` (cinque punti di somiglianza) e se la sua somiglianza è almeno
   0,90 (`SIMILARITY_THRESHOLD`). Un baffo ripassato o una partenza lontana
   lo rendono più caro: non si consiglia un percorso che sembra migliore
   solo alla somiglianza.
2. **La distanza** è quella da chiedere per avere quel tentativo
   (`ratio × distanza chiesta`: le lettere sole con la penna alzata, metà
   di una forma andata e ritorno), al km intero come `suggested_distance_m`
   di un errore. Niente consiglio se arrotondata è la distanza chiesta, se
   è fuori dai limiti dell'attività (`DISTANCE_LIMITS_M`: la bici 10–30
   km) o, per una parola, sotto i 3 km a lettera (`check_word`).
3. **Fra più distanze** vince quella col tentativo più economico; a
   parità, la più vicina alla distanza chiesta.
4. **Da dove**: dalla ricerca che ha dato il percorso, anche quella
   lontana (ADR-0040) quando vince lei; da una partenza vicina la sua
   (`ShapeJob.here`), da cui il percorso viene. Le alternative (TASK-093)
   non hanno un consiglio loro: vale per la richiesta.
5. **Il percorso non cambia**: è un campo in più del risultato,
   `better_distance_m`, `None` senza consiglio. Sull'acqua `water_fit` ha
   già la sua distanza suggerita (ADR-0164) e il campo resta `None`.

La ricerca prova scale fra 0,4 e 1,1 di quella iniziale, quindi il
consiglio vede solo distanze in quell'intorno, e a volte lontane da quella
chiesta (il cavallo di Trento da 15 km consiglia 6 km). Quanto spesso
scatta: `MAPS.md`, «Viene meglio a N km».

### Lettere che si spostano (TASK-050)

Per una parola composta (§2) la ricerca è la stessa, con due differenze
(ADR-0044):

- **Entra nella parola solo a metà di uno spazio** fra due lettere: le fasi
  sono i centri degli spazi, non i quarti del perimetro.
- **A ogni tracciamento, prima di tracciare, ogni lettera si sposta** dove
  i suoi tratti hanno più strade: prova gli spostamenti fino a **1/4
  dell'altezza** su una griglia di **1/16** (49 in tutto, lungo la base e
  in su), conta le strade entro 1/16 dell'altezza lungo la lettera sola
  (`RoadMask`), e ogni spostamento costa fino al 5% del conteggio, al
  massimo spostamento. Si guarda la lettera sola perché la quota sulla
  parola intera premia gli spostamenti che accorciano gli spazi. Gli spazi
  si allungano o accorciano, e lo spazio da cui parte il percorso resta
  fermo nel suo centro, dove sta la partenza. Le lettere non ruotano e non
  cambiano misura. Uno spazio lungo la cima (§2, TASK-067) si comporta
  come uno lungo la base: si allunga e si accorcia con le sue due lettere,
  e il percorso può partire dal suo centro.

La somiglianza si misura sulla parola con le lettere spostate: è quella
che il percorso deve disegnare.

### Parole squadrate sulla griglia delle vie (TASK-077)

Una parola in lettere squadrate (§2) non resta dritta entro ±15°
(ADR-0038): si gira come corrono le vie attorno alla partenza
(`street_grid.py`, ADR-0072). Ogni pezzo di via entro la portata della
parola vota per la sua direzione, ripiegata in un quarto di giro (una
griglia corre per lungo e per largo), con la sua lunghezza; i voti si
sommano per gradi e si lisciano di ±4°, e le cime più alte, fino a tre
lontane almeno 20° e alte almeno metà della prima, sono le direzioni della
griglia. La ricerca prova, per ogni partenza, le direzioni al più **30°**
fuori dall'orizzontale (dritta se non ce n'è), e la rifinitura gira di al
più 5° attorno a una di esse. A Levico una griglia a 43° metteva la parola
di traverso sulla mappa col nord in alto, e non si leggeva. Dal TASK-232
la mappa gira con la parola: le direzioni fra 30° e 45° (ogni griglia ne
ha una entro 45°) sono il secondo tempo della ricerca, come le
inclinazioni delle forme («Forme inclinate»).

### La penna alzata (TASK-197)

Una parola con la penna alzata (§2) si cerca come le altre parole, con
queste differenze (`pen_up.py`, ADR-0157):

1. **Ogni lettera si traccia da sola**, come linea aperta:
   `snap_to_network(closed=False)` fa zone e corridoio come sempre, ma il
   percorso finisce nella zona dell'ultimo punto invece di tornare alla
   partenza. Zone e corridoio sono quelli del disegno intero, una quota
   della lunghezza di tutte le lettere insieme (dimezzata se una lettera ha
   tratti ripassati, ADR-0039), non della lettera sola. Una lettera che
   cade su un nodo solo è quel nodo.
2. **Fra una lettera e l'altra, un tratto a piedi**: dall'ultimo nodo di
   una lettera, la strada più breve fino al primo della successiva (il nodo
   più vicino al suo ingresso), senza zone né corridoio. Il percorso resta una
   linea sola, lettere e tratti a piedi in fila; `walks` dice quali punti
   sono a piedi: coppie `[da, a]` di indici in `points`, compresi, in
   ordine. Dove finisce un tratto comincia la lettera successiva; n lettere,
   n − 1 tratti.
3. **Una fase sola**: la partenza è l'ingresso della prima lettera, e la
   parola si scrive da sinistra a destra. Le lettere si spostano come in
   «Lettere che si spostano», **tranne la prima**, che tiene la partenza.
4. **La somiglianza è delle sole lettere** (`pen_up.similarity`): la
   copertura di ogni lettera, linea aperta, in media sulle lettere, e la
   precisione del percorso senza i tratti a piedi, entro 1/8 dell'altezza
   come per le altre parole. Allungare un tratto a piedi non la cambia.
5. **La distanza chiesta è delle lettere**, la parte che la corsa registra
   (`pen_up.drawn_m`, `optimizer.drawn_distance`): da lì la scala iniziale
   (`first_scale`), il ±10% della ricerca, i ±2 km oltre cui la forma non è
   disponibile, la scelta fra le partenze vicine. `distance_m` resta la
   lunghezza di tutti i `points`, tratti a piedi compresi.
6. **Partenze vicine**: l'avvicinamento si corre, non è un tratto a piedi;
   i `walks` si spostano con i punti, e dopo l'ultima lettera non si torna
   alla partenza.

Senza `pen_up` niente cambia: una parola dà lo stesso percorso di prima,
punto per punto (`tests/test_pen_up.py`, sul grafo dei fixture e su una
griglia, contro le impronte di `main` a 59dd8a7).

Misure del 2026-10-02 sul Mac, dalla CLI con `--nearby 3`, zone già in
cache (Overpass rifiutava il Mac). **Non giudicate a occhio dall'utente**;
le due somiglianze non si confrontano fra loro, perché quella della penna
alzata non vede né la base né i ritorni:

| Richiesta | Linea chiusa | Penna alzata |
|---|---|---|
| «CIAO» 15 km, Trento centro | 0,83, 15,96 km, lettere alte 659 m, 11 s | 0,90; lettere 15,37 km + a piedi 2,09, 1,05 e 1,09 km = 19,59 km; lettere alte 1.121 m, partenza spostata di 1 km; 18 s |
| «IO» 6 km, Levico | 0,97, 5,12 km, lettere alte 543 m, 1 s | 0,92; lettere 5,13 km + 0,98 km a piedi; lettere alte 737 m; 2 s |

I tratti a piedi aggiungono il 20–30% ai km delle lettere: lo spazio fra
le lettere cresce con la loro altezza, e per strada è più lungo che in
linea d'aria.

**Una forma a pezzi** (TASK-223, §2) con la penna alzata è la stessa cosa:
`pieces.compose` la scrive come una parola a penna alzata, una «lettera»
per il contorno e una per ogni pezzo (`Word.kind == "piece"`, i messaggi
dicono «piece 2»). Il contorno tiene la partenza e non si sposta; i pezzi
si spostano come le lettere. Un'«altezza di lettera» è `PIECE_HEIGHT`, un
quarto del lato del disegno: i pezzi si spostano al massimo di 1/16 del
lato, e la somiglianza tiene entro 1/32 del lato, circa l'1% del perimetro
che la misura delle forme concede a un cerchio. I punti tracciati sono
`PIECE_POINTS` = 128 in tutto, ogni vertice tenuto.

Misure del 2026-10-03 sul Mac, 10 km, zone in cache; somiglianza dei pezzi
con la penna alzata, delle forme con la penna giù (non si confrontano):

| Forma | Trento | Levico | Milano |
|---|---|---|---|
| `smiley` penna alzata | 0,78; 10,6 km + 1,4 a piedi | non disponibile (0,51) | 0,86; 9,6 + 1,9 |
| `smiley` penna giù | 0,93 | 0,82 | 0,92 |
| `ghost` penna alzata | 0,82; 10,4 + 0,8 | 0,64 | 0,92; 10,4 + 1,2 |
| `donut` penna alzata | 0,77; 9,7 + 0,7 | non disponibile (0,57) | 0,81; 9,4 + 0,7 |
| `sun` penna alzata | 0,85; 10,3 + 7,6 | 0,65 | 0,95; 10,6 + 8,0 |

Il sole a penna alzata cammina quasi quanto disegna: otto raggi, sette
tratti a piedi da più di 1 km. Con la penna giù i raggi sono tratti
ripassati, e i km a piedi non ci sono.

**Le deviazioni di un pezzo** (TASK-242, ADR-0208, `detours.py`). Le
strade non sempre seguono un pezzo: a Trento la bocca di una faccina da
15 km attraversa la ferrovia, e il primo sottopasso è 250–370 m sotto la
sua linea. Disegnata, quella andata e ritorno appende la bocca al bordo
della faccia. Con la penna alzata si cammina:

1. un nodo del percorso di un pezzo è **sulla linea** entro `LIFT_NEAR` =
   1/8 di altezza di pezzo (la tolleranza della somiglianza);
2. un tratto fra due nodi sulla linea è una **deviazione** se un suo punto
   è più lontano di `LIFT_FAR` = 3/8 di altezza (circa un decimo del lato
   del disegno). Ciò che si allontana meno resta disegnato;
3. il pezzo si disegna **in parti**, e da una parte all'altra c'è un
   tratto a piedi per la strada più breve, come fra due pezzi: `walks`
   può avere più tratti dei pezzi meno uno, mai più di `MAX_WALKS` = 9
   (quelli che tiene un risultato dell'API); oltre, si camminano le
   deviazioni più profonde;
4. una deviazione all'inizio o alla fine del pezzo si lascia fuori (il
   pezzo comincia e finisce sulla sua linea; per un anello le due sono
   una sola), e una che torna al nodo da cui parte si taglia: in nessuno
   dei due casi c'è un tratto a piedi in più;
5. **il contorno** perde solo i suoi baffi (sotto, TASK-243); le parole e
   l'acqua non si toccano;
6. la distanza che la ricerca insegue conta ancora i metri delle
   deviazioni (`pen_up.sized_m`, `optimizer.drawn_distance`): la
   forma resta grande com'era. I km disegnati del risultato
   (`distance_m` meno i `walks`) sono quelli veri, e possono stare più
   sotto la distanza chiesta.

Un pezzo che resta vicino alla sua linea dà lo stesso percorso di prima,
punto per punto (`tests/test_detours.py`).

Misure del 2026-10-05 sul Mac, zone in cache, penna alzata, prima → dopo
(`plan_route`, una partenza sola; a 15 km da due punti di Trento e da
Milano per `smiley`, `ghost`, `donut`, `sun`, `cat`, `fish`, `dog_head`,
`rabbit_head`, `pumpkin`; a 10 km da Trento, Levico e Milano per le prime
cinque). Su 42 richieste **30 danno lo stesso percorso** di prima (tutte
quelle di Milano), 2 restano non disponibili (`smiley` e `donut` a 10 km
a Levico) e 10 cambiano, tutte in meglio:

| Richiesta | Somiglianza | Disegnati | A piedi | Tratti |
|---|---|---|---|---|
| `smiley` 15 km, Trento | 0,71 → 0,73 | 15,1 → 14,2 km | 2,6 → 3,4 km | 3 → 4 |
| `smiley` 15 km, Trento (altro punto) | 0,71 → 0,73 | 13,3 → 12,5 km | 2,0 → 2,8 km | 3 → 4 |
| `ghost` 15 km, Trento | 0,72 → 0,75 | 14,2 → 14,6 km | 1,2 → 1,6 km | 2 → 3 |
| `donut` 15 km, Trento | 0,74 → 0,76 | 15,9 → 14,9 km | 0,8 → 1,6 km | 1 → 2 |
| `fish` 15 km, Trento (altro punto) | 0,64 → 0,67 | 15,1 → 14,1 km | 0,4 → 0,5 km | 1 → 2 |
| `pumpkin` 15 km, Trento (altro punto) | 0,83 → 0,83 | 13,9 → 12,8 km | 1,9 → 3,0 km | 3 → 5 |
| `sun` 15 km, Trento | 0,83 → 0,85 | 13,4 → 12,0 km | 8,7 → 8,8 km | 8 → 8 |
| `sun` 15 km, Trento (altro punto) | 0,81 → 0,84 | 14,3 → 13,5 km | 10,6 → 11,4 km | 8 → 9 |
| `sun` 10 km, Trento | 0,88 → 0,89 | 9,6 → 8,8 km | 7,5 → 6,7 km | 8 → 8 |
| `sun` 10 km, Levico | 0,65 → 0,66 | 10,0 → 9,2 km | 5,0 → 5,7 km | 8 → 9 |

A Trento è la ferrovia, che taglia il centro, a fare quasi tutte le
deviazioni. Dove i tratti non crescono la deviazione era all'inizio o
alla fine di un pezzo, o tornava al suo nodo. La faccina dello
screenshot (dalla CLI con `--nearby 3`, come l'API: la variante A) passa
da 0,77 a 0,79 con lo stesso percorso di 15,8 km: 12,9 km disegnati
invece di 13,6, 2,9 km a piedi invece di 2,3 (`samples/`, `TASK-242_*`).
La faccina e la ciambella a Trento, prima e dopo, **giudicate dall'utente
il 2026-10-05: «sì, va bene»**; le altre righe della tabella no.

**I baffi del contorno** (TASK-243, ADR-0209, `pen_up._lifted`,
`pen_up._spike`). Il contorno è la forma: un buco gli toglie più di un
tratto storto. Con la penna alzata si alza solo sui **baffi**, le
deviazioni che escono e rientrano vicino a dove sono uscite:

1. una deviazione del contorno è la stessa dei pezzi (fra due nodi sulla
   linea, più lontana di `LIFT_FAR` = 3/8 di altezza di pezzo);
2. è un **baffo** se salta al più `OUTLINE_GAP` = 1/2 altezza di pezzo
   della linea del contorno (un ottavo del lato del disegno: 245 m per
   una faccina da 15 km), che è il buco che lascia, e la sua strada è
   lunga almeno `OUTLINE_SPIKE` = 2 volte la distanza in linea d'aria fra
   i suoi due capi. Il buco si misura **lungo la linea** (`Detour.hole_m`),
   da dove il percorso la lascia a dove la riprende, non in linea d'aria:
   due punti del contorno possono essere vicini e avere fra loro un
   orecchio, una coda, o tutto il giro. Un baffo si cammina, come la
   deviazione di un pezzo: il contorno si disegna in parti;
3. una deviazione che non è un baffo **resta disegnata**: è il contorno
   stesso sulle strade che ci sono (dove nessuna strada segue il bordo
   per centinaia di metri), e camminarla aprirebbe la forma;
4. al più `OUTLINE_WALKS` = 2 baffi camminati, i più profondi; i tratti a
   piedi restano al più `MAX_WALKS` = 9, contorno e pezzi insieme, le
   deviazioni più profonde per prime (il sole, con 8 tratti fra i pezzi,
   ne ha uno);
5. un baffo che torna **allo stesso nodo** si taglia senza tratti a
   piedi, come nei pezzi. Un baffo verso un **angolo** della forma è
   sulla linea, non è una deviazione, e resta;
6. **la partenza resta il primo punto del percorso**: il contorno
   comincia sempre dal suo primo nodo, e una deviazione che parte da lì
   resta disegnata (camminarla farebbe cominciare il percorso con un
   tratto a piedi). La fine può arrivare prima, se l'ultimo tratto verso
   la partenza è una deviazione: da lì parte il tratto a piedi verso il
   primo pezzo;
7. i metri dei baffi contano ancora nella distanza che la ricerca insegue
   (`sized_m`), come quelli delle deviazioni dei pezzi.

Vale solo per le forme a pezzi chieste con la penna alzata
(`PEN_UP_SHAPES`: le forme senza pezzi non si possono chiedere con
`pen_up`, `RouteRequest`). Senza `pen_up`, per le parole (anche con la
penna alzata) e sull'acqua il percorso è quello di prima, punto per
punto: provato su otto richieste a Trento, Levico e Milano (cuore,
cerchio, faccina, gatto e sole con la penna giù, «CIAO» e «IO» con la
penna alzata, «IO» senza) contro il motore di `main` a c2bb428, e
l'impronta del motore sull'acqua non cambia (`paddleExamples.json`).

Misure del 2026-10-05 sul Mac, zone in cache, penna alzata, prima → dopo,
le stesse 42 richieste di TASK-242 (`plan_route`, una partenza sola), sul
motore di `main` a c2bb428, con le forme inclinate di TASK-232. **26 danno
lo stesso percorso** di prima, una resta non disponibile (`smiley` a
10 km a Levico), una lo diventa (`donut` a 10 km a Levico: 0,62, 8,8 km
disegnati e 2,4 a piedi) e **14 cambiano**. In 10 il disegno è lo stesso
e un baffo, o due, diventano tratti a piedi: la somiglianza sale in
tutte, da 0,008 a 0,061. In 4 la ricerca sceglie un altro disegno
(«altro» nell'ultima colonna): la somiglianza resta uguale alla seconda
cifra in 2 e **scende in 2**.

| Richiesta | Somiglianza | Disegnati | A piedi | Tratti | Disegno |
|---|---|---|---|---|---|
| `ghost` 15 km, Trento (altro punto) | 0,82 → 0,78 | 14,3 → 13,7 km | 1,4 → 2,8 km | 2 → 4 | altro |
| `donut` 15 km, Trento | 0,76 → 0,78 | 14,9 → 14,1 km | 1,6 → 2,4 km | 2 → 3 | lo stesso |
| `cat` 15 km, Trento | 0,86 → 0,88 | 13,8 → 13,2 km | 1,8 → 2,3 km | 2 → 3 | lo stesso |
| `cat` 15 km, Trento (altro punto) | 0,82 → 0,83 | 14,1 → 13,6 km | 1,6 → 2,2 km | 2 → 3 | lo stesso |
| `fish` 15 km, Trento | 0,75 → 0,81 | 14,1 → 12,2 km | 0,5 → 0,5 km | 1 → 1 | lo stesso |
| `fish` 15 km, Trento (altro punto) | 0,75 → 0,70 | 16,6 → 12,6 km | 0,9 → 1,9 km | 1 → 4 | altro |
| `dog_head` 15 km, Trento | 0,82 → 0,82 | 14,7 → 14,0 km | 0,9 → 1,6 km | 2 → 3 | altro |
| `pumpkin` 15 km, Trento | 0,80 → 0,82 | 14,4 → 13,5 km | 1,7 → 2,5 km | 3 → 4 | lo stesso |
| `smiley` 10 km, Trento | 0,72 → 0,72 | 10,0 → 9,4 km | 1,9 → 2,4 km | 3 → 4 | altro |
| `ghost` 10 km, Trento | 0,81 → 0,83 | 9,8 → 9,2 km | 0,8 → 1,5 km | 2 → 3 | lo stesso |
| `ghost` 10 km, Levico | 0,64 → 0,65 | 9,7 → 8,6 km | 0,6 → 1,5 km | 2 → 3 | lo stesso |
| `donut` 10 km, Trento | 0,72 → 0,74 | 9,4 → 8,9 km | 0,7 → 1,2 km | 1 → 2 | lo stesso |
| `cat` 10 km, Trento | 0,77 → 0,80 | 10,7 → 9,6 km | 1,3 → 2,0 km | 2 → 3 | lo stesso |
| `cat` 10 km, Milano | 0,89 → 0,91 | 10,3 → 10,0 km | 1,7 → 2,1 km | 2 → 3 | lo stesso |

Nelle 14 che cambiano i km disegnati scendono in media di 1,0 km e
quelli a piedi salgono di 0,7 km. **Due cose da sapere**:

- i km «di disegno» stanno più sotto la distanza chiesta di prima (il
  fantasmino da 10 km a Levico: 8,6 km disegnati e 1,5 a piedi), perché
  i metri dei baffi contano ancora nella distanza inseguita (punto 7);
- dove la ricerca sceglie un altro disegno la somiglianza può scendere.
  Il costo che la ricerca minimizza conta anche la distanza e
  l'inclinazione (TASK-232): con i baffi camminati un disegno dritto e
  della misura giusta batte uno inclinato e più lungo che somiglia di
  più. Il pesce da 15 km dal secondo punto di Trento passa da 0,75
  (inclinato di 35°, 16,6 km disegnati) a 0,70 (inclinato di 15°,
  12,6 km), e all'occhio dell'agente si legge meglio; il fantasmino dallo
  stesso punto passa da 0,82 a 0,78, e all'occhio dell'agente è l'unica
  delle 14 che peggiora.

Dalla CLI con `--nearby 3`, come l'API, la faccina dello screenshot a
Trento tiene il suo disegno: un baffo del contorno (631 m di strada, che
rientra a 47 m da dove esce) diventa un tratto a piedi di 47 m, la
somiglianza passa da 0,79 a 0,80, il percorso da 15,8 a 15,3 km (12,3 km
disegnati, 3,0 a piedi in 5 tratti). I campioni prima/dopo sono in
`samples/` (`TASK-243_*`): faccina, ciambella e gatto a Trento,
fantasmino a Levico, gatto a Milano; il pesce e il fantasmino dal secondo
punto di Trento, dove la ricerca sceglie un altro disegno (dalla CLI
0,75 → 0,70 e 0,84 → 0,81); e la faccina a Milano, che resta identica.

### Funzione obiettivo

```
costo = w_forma · (1 − somiglianza) + w_dist · |dist_reale − dist_target| / dist_target
```

con `w_forma` = 3 e `w_dist` = 1: la forma conta più della distanza. Una
partenza spostata di 500 m aggiunge 0,15, cioè vale 5 punti di copertura;
altrettanto una forma inclinata di 45°, in proporzione ai gradi oltre 15°
(TASK-232, `W_TILT`).

**I baffi del cuore** (TASK-131, ADR-0107): per il cuore il costo ha un
termine in più, `w_baffi · quota fatta due volte`, con `w_baffi` = 1,5
(`W_DOUBLED`, `retracing.py`). La quota è la parte della lunghezza su pezzi
di strada percorsi più di una volta, in un verso o nell'altro: un «baffo»
che va a un punto della forma e torna indietro. La somiglianza non lo vede,
perché le due andate stanno sulla forma; l'occhio sì: l'unico cuore
giudicato `sì` (Milano) ne aveva 0%, gli altri 4–23%. Lo stesso termine,
diviso per `w_forma`, toglie punteggio nella scelta fra le partenze vicine
(`score`). Le altre forme non lo hanno: gatto, pesce e lettere ripassano
apposta i loro tratti, e le loro strade restano quelle di prima. Sui 7
cuori di prova cambiano Caldonazzo 10 km (17% → 7%), Levico 8 km
(23% → 4%) e Trento 15 km; la somiglianza può scendere un po' (Levico
0,84 → 0,78), i tempi no.

Da TASK-139 (ADR-0109) lo stesso peso, 1,5, vale per **cerchio e
stella**. Il cerchio ha già pochi baffi (0–7%): nessuno dei 7 di prova
cambia. La stella ne ha molti (5–59%: le punte si raggiungono spesso
andando e tornando): cambiano Levico 5 km (59% → 52%), Levico 8 km
(39% → 17%) e Trento 15 km (6% → 2%), gli altri 4 no. Un peso doppio
toglie più baffi ma fa perdere la forma (Levico 5 km 0,81 → 0,73): scartato.

Da TASK-140 (ADR-0118) si contano solo i baffi **in più** rispetto ai
tratti che la forma ripassa apposta (`extra_doubled_share`): la quota
della forma piazzata fatta due volte (occhi, antenne, spirale) si toglie
da quella del percorso. Per una forma senza tratti è zero, quindi cuore,
cerchio e stella restano quelli di prima. Il peso vale anche per
**cavallo, luna, farfalla e lumaca**; non per gatto, pesce, testa di cane e
testa di coniglio, dove l'utente ha preferito i percorsi di prima (meno
baffi, ma la forma si legge peggio). Sulle 7 partenze di prova, per le 11
forme del catalogo (77 percorsi), cambiano solo luna a Trento 15 km
(14% → 0%), farfalla a Levico 8 km e lumaca a Levico 12 km (75% → 42%);
il cavallo non cambia mai.

### Misura della somiglianza

Si confronta il percorso con la forma piazzata (ruotata e scalata), in tre
pezzi (ADR-0023, ADR-0025):

- **copertura**: quota del contorno con il percorso entro il 2% del
  perimetro;
- **precisione**: quota del percorso entro la stessa distanza dal contorno;
  scende con anelli interni, tagli e punte;
- **punte**: i vertici in cui il contorno gira più di 60° (incavo e punta
  del cuore; il cerchio non ne ha) devono avere il percorso vicino.

Somiglianza = media armonica di copertura e precisione (`fit`), meno 0,10
per ogni punta mancata. Per una forma con tratti la distanza è l'1% del
perimetro invece del 2%, come zone e fascia (§4, ADR-0039). Hausdorff e Fréchet discreta sono state provate e
scartate: dominate dal punto peggiore, andavano contro il giudizio a occhio.

### Il punteggio di una traccia corsa (TASK-111)

Chi ha corso un percorso ha una traccia GPS; `track_score.py` le dà un
punteggio da 0 a 100 (ADR-0090):

```
punteggio = arrotonda(100 · somiglianza del percorso · fedeltà)
```

- la **somiglianza** è quella del percorso pianificato
  (`RouteResult.similarity`): quanto il piano somiglia alla forma;
- la **fedeltà** è la media armonica di due quote, entro 40 m:
  **coperta**, la parte del percorso pianificato con la traccia vicina, e
  **sul percorso**, la parte della traccia vicina al percorso. Saltare un
  pezzo abbassa la prima, una deviazione la seconda.

Il percorso corso per intero prende quindi il voto del percorso. I 40 m
sono quelli di «Off the route» nell'app (ADR-0070): il marciapiede opposto
più l'errore del GPS fra le case; la via parallela resta fuori.

Prima la traccia si pulisce (`clean_track`): via le posizioni con errore
oltre 40 m, quelle a meno di 1 m dalla precedente e i salti oltre 12 m/s,
quando la traccia ha gli orari. Una traccia con meno di 2 posizioni buone,
o più corta del 10% del percorso, non ha punteggio
(`TrackNotScorableError`, con il motivo).

Vale per forme, parole e immagini allo stesso modo: servono solo i punti e
la somiglianza del percorso, niente grafo e niente rete.

Con i `walks` di una parola con la penna alzata (TASK-197) la corsa si
confronta con le **sole lettere**: «coperta» è la parte delle lettere con
la traccia vicina; in «sul percorso» non contano le posizioni vicine a un
tratto a piedi o alla linea dritta fra il suo inizio e la sua fine (dove
salta una registrazione in pausa), se non sono vicine anche a una lettera.
Il 10% minimo della traccia è delle lettere. Senza `walks`, come prima.

## 6. Validazione

Un percorso esce dal motore solo se (altrimenti è un errore, non un warning):

- è chiuso e parte dal punto di strada più vicino alla sua partenza;
- la partenza è entro 500 m da quella richiesta (ADR-0025).

Una parola con la penna alzata (TASK-197) non è chiusa: finisce sull'ultima
lettera, e si controlla solo dove comincia (`pen_up.check_begins`). Le
misure qui sotto sono di tutto il percorso, tratti a piedi compresi: anche
lì si cammina.

Poi si misurano, e oltre soglia diventano warning in `RouteResult.warnings`
con misura e limite (`validation.py`, ADR-0026):

- distanza: fuori da ±10% (oltre ±2 km la forma non è disponibile);
- somiglianza: sotto 0,90 (sotto 0,60 la forma non è disponibile);
- ripercorrenza esatta: archi già percorsi, sopra il 5% della lunghezza;
- ripercorrenza visiva: tratti entro 20 m da un altro tratto lontano almeno
  60 m lungo il percorso, sopra il 10% (le punte della forma escluse);
- percorribilità: metri su scale, strade principali (`trunk`, `primary`) e
  in galleria, appena ci sono.

**In bici** (ADR-0153) le stesse misure, sulla rete `bike`: le scale non
ci sono (la rete non le ha, quindi 0 m); le strade principali sono le
`primary` (le `trunk` sono escluse); in più lo **sterrato**, `unpaved`,
solo per la bici: metri su `surface` senza fondo duro (`gravel`,
`compacted`, `dirt`, `ground`…, `validation.UNPAVED`) o su `track` senza
`surface` e non `tracktype=grade1`. Appena ci sono è un warning («… m of
the route on unpaved roads»), come le strade principali. Una richiesta a
piedi ha le misure e i messaggi di sempre, senza `unpaved`.

Lungo i **tratti** della forma (§2), entro il 2% del perimetro, la strada
ripercorsa è voluta: non conta né nella ripercorrenza esatta né in quella
visiva (ADR-0039).

La CLI stampa sempre tutte le misure, anche sotto soglia. Il giudizio finale
resta visivo: vedi `TESTING.md` per come si tiene insieme la parte
automatica con quella a occhio.

## 7. Interfaccia da riga di comando

Il route-engine si usa senza app e senza server:

```
python -m route_engine \
    --shape heart \
    --distance 15000 \
    --start 46.0122,11.2986 \
    --out heart_levico.gpx
```

Con una forma da file, `--outline` al posto di `--shape`:

```
python -m route_engine \
    --outline services/route-engine/route_engine/shapes/outlines/house.json \
    --distance 15000 \
    --start 46.0671,11.1214 \
    --out house_trento.gpx
```

Con una parola, `--word` (§2, «Parole lettera per lettera»); la CLI
stampa di quanto si è spostata ogni lettera, in metri lungo la base e in
su:

```
python -m route_engine --word CIAO --distance 15000     --start 46.0671,11.1214 --out ciao_trento.gpx
```

Con `--nearby 3` prova anche 3 partenze vicine e tiene la migliore (§5,
«Partenze vicine»); la CLI stampa ogni partenza provata e quale ha vinto:

```
python -m route_engine --shape heart --distance 10000     --start 45.9934,11.2580 --nearby 3 --out heart_caldonazzo.gpx
```

Con `--score-track corsa.gpx` pianifica il percorso della richiesta e dà
il punteggio alla corsa registrata nel file (§5, «Il punteggio di una
traccia corsa»); `--out` non serve:

```
python -m route_engine --shape heart --distance 10000 \
    --start 45.9934,11.2580 --score-track corsa.gpx
```

Con `--pen-up`, insieme a `--word`, la parola con la penna alzata
(§5, «La penna alzata»); la CLI stampa i metri delle lettere contro il
target, la lunghezza di ogni tratto a piedi e il totale, e il GPX ha i
waypoint «Pause» e «Resume» (`GPX.md`):

```
python -m route_engine --word CIAO --distance 15000 --pen-up \
    --start 46.0671,11.1214 --nearby 3 --out ciao_penna_trento.gpx
```

Con `--pen-up` e una forma a pezzi, `--outline` o `--shape` (§2, «Pezzi
staccati dal contorno»), il contorno e poi ogni pezzo da solo, con le
stesse righe dei pezzi al posto delle lettere; senza `--pen-up` la stessa
forma con i pezzi attaccati. Una forma senza pezzi, o un'immagine, con
`--pen-up` si rifiuta:

```
python -m route_engine --outline route_engine/shapes/outlines/smiley.json \
    --distance 10000 --pen-up --start 45.4642,9.19 --out smiley_milano.gpx
```

Con `--activity cycling` un percorso in bici, 10–30 km, sulla rete `bike`
(§4, «La rete della bici»), con la sua cache (`bike_*.graphml`); la CLI
stampa anche i metri di sterrato:

```
python -m route_engine --shape heart --distance 20000 \
    --start 46.0671,11.1214 --activity cycling --out heart_bici_trento.gpx
```

Con `--activity paddling` una forma del catalogo sull'acqua di un lago o
del mare, 1–5 km, dalla riva (§8).

Il GPX si apre in un visualizzatore (gpx.studio, geojson.io) e si guarda.
Questo è il ciclo di lavoro di tutta la fase 1: **generare, guardare,
correggere**. Finché non produce un cuore riconoscibile, non si costruisce
nulla sopra.

## 8. Sull'acqua (TASK-191)

Per la canoa e il paddle non c'è una rete: la forma piazzata (§3) **è** il
percorso, se sta tutta sull'acqua (ADR-0154, ADR-0161). Dove ci sta lo
decide il motore, mai l'AI. Tre moduli, senza rete né chiavi una volta che
l'acqua è in cache:

- `water.py` — **l'acqua attorno alla partenza**, in metri sul piano
  tangente: i laghi (`natural=water`, almeno 10 ha), il mare come il
  riquadro meno la terra della `natural=coastline` (terra a sinistra del
  suo verso), gli ostacoli (moli, frangiflutti, pennelli, scogliere,
  marine, porti, fiumi, lagune) e **la fascia**: acqua entro 1000 m dalla
  riva, meno **200 m dalla riva al mare** (oltre la fascia dei bagnanti,
  scelta dell'utente) e **50 m sui laghi** e dagli scogli, e 30 m dagli
  ostacoli. Poi i punti della riva dove si arriva a piedi: entro 40 m da
  una spiaggia, uno scivolo, un molo o una via pedonabile.
- `water_fit.py` — **dove la forma ci sta**: grandezza intera, poi più
  piccola del 3% alla volta fino al 40%, dritta entro ±15° (il cerchio
  una volta sola) e, solo se così non ci sta nella tolleranza della
  distanza, inclinata da 20° a 45° ogni 5°, al costo del 5% della distanza
  a 45° (TASK-232, `TILT_WEIGHT`); per ogni scala e angolo, i centri della griglia della
  fascia in cui tutto il contorno cade nella fascia, dal più vicino alla
  partenza; i tre il cui contorno passa dove unirlo alla riva costa meno
  (i tratti fino al punto della riva raggiungibile più vicino, e lo
  spostamento fino a lì) si controllano esattamente con shapely. Poi la
  partenza sulla riva di costo minore, entro 300 m dalla forma e 2 km
  dalla partenza chiesta, con un tratto dritto sull'acqua fino alla forma;
  il percorso è riva → forma → riva per lo stesso tratto. Nessun tratto è
  più corto della via dal punto della riva raggiungibile più vicino alla
  fascia (al mare circa 200 m): le scale troppo lunghe con i loro tratti
  si saltano, e la ricerca si ferma quando nessuna forma più piccola può
  costare meno.
- `paddling.py` — **la richiesta**: `plan_paddling` prende una
  `RouteRequest` con `activity="paddling"`, disegna la forma del catalogo
  con 128 punti (il contorno è il percorso), la piazza con `water_fit`, la
  controlla con `validation.check_on_water` e dà un `RouteResult`
  (somiglianza 1, nessun warning). La usano la CLI e, con la parte B,
  l'API.

```
costo = |distanza − chiesta| / chiesta + 2 · tratti / chiesta + 0,1 · km spostati
```

La somiglianza è quella della forma con sé stessa: il costo dice quanto si
è dovuta rimpicciolire e spostare. Entro ±10% della distanza c'è un
percorso; fuori, `WaterFitError` dice a quanti km la forma ci sta
(`best_distance_m`). Lontano dall'acqua, `NoWaterError`. Tutti e due sono
`ShapeNotDrawableError`. `measure` dà quello che la validazione guarda
sull'acqua: metri sulla terra (oltre mezzo metro dentro), la distanza
massima dalla riva, la distanza, se è chiuso.

Con la fascia di 1 km una costa dritta tiene forme fino a circa 3 km (la
stella 4), un lago stretto 5–6 km (tabella in ADR-0154). Con i 200 m al
mare il percorso massimo resta circa 3 km, ma una parte sono i tratti: a
2 km la forma è il 79% del giro, a 1 km il 58% (ADR-0161). Il motore non
conosce le regole del posto: i bagnanti, i corridoi di lancio, il traffico
di barche. I 200 m tengono la forma fuori dalla fascia dei bagnanti, i
tratti dalla riva la attraversano.

**L'attività** `paddling` è del motore (`DISTANCE_LIMITS_M`, **1–5 km**,
scelta dell'utente; `WATER_ACTIVITIES`), non ancora del contratto
dell'API (`SUPPORTED_ACTIVITIES`, parte B). Sull'acqua si disegna solo una
forma del catalogo: una parola, un'immagine o un contorno da file sono
`InvalidRequestError` («on the water only a shape of the catalogue is
drawn, not a word»).

**Una forma a pezzi sull'acqua** (TASK-226, ADR-0188): con la penna alzata
(`pen_up` nella richiesta, §2 «Pezzi staccati dal contorno») il contorno e
i pezzi, per esempio gli occhi di un gatto, si piazzano insieme, tutti
nella fascia, e ogni pezzo si disegna da solo.

- **Dove si lascia il contorno**: al vertice da cui la penna resta alzata
  di meno (`water_fit._branch`), cioè vicino ai pezzi, non dove la riva
  tocca il contorno. Per il pesce sono 64–76 m su 2 km; partendo dal punto
  della riva erano 534 m.
- **Il giro dei pezzi** (`_tour`): da quel vertice al pezzo più vicino,
  entrando dal suo punto più vicino; poi al successivo più vicino; dopo
  l'ultimo si torna al vertice, e il contorno prosegue.
- **I tratti a penna alzata** sono dritti, stanno nella fascia come i
  pezzi, e sono i `walks` del risultato: uno per pezzo più il ritorno.
- **La distanza chiesta è quella di tutto il percorso**: contorno, pezzi,
  tratti a penna alzata e tratti dalla riva. Su strada la distanza di una
  forma a pezzi è quella del disegno; sull'acqua si pagaia quello che si è
  chiesto. Alla grandezza intera contorno, pezzi e tratti a penna alzata
  sono lunghi insieme quanto la distanza, quindi la scala è quella di una
  forma in una linea sola (0,79 al mare e 0,94 sui laghi a 2 km).
- **Con la penna giù niente cambia**: le forme a pezzi restano una linea
  sola, punto per punto come prima (`tests/test_water_pieces.py`).

**Una forma spostata dall'utente** (TASK-238, ADR-0202): la richiesta può
dire dove si vuole il centro della forma (`RouteRequest.near`, solo
sull'acqua), e il risultato dice dov'è (`RouteResult.centre`,
`WaterRoute.centre`: la media dei vertici del contorno, che la rotazione
non sposta). L'app fa trascinare la forma sulla mappa e richiede il
percorso con `near` = il centro di prima più lo spostamento. **Il posto lo
decide ancora il motore**: `near` è una preferenza, non una coordinata del
percorso.

- **La ricerca è la stessa** (`fit_shape(..., near=)`): stesse scale,
  stesse rotazioni, stessa fascia, stessa partenza dalla riva entro 300 m
  dalla forma e 2 km dalla partenza chiesta. Cambia quali posti si
  guardano: per ogni scala e rotazione i centri **più vicini a `near`**
  (`_fitting_centres`, `_nearest`: 6, a due celle l'uno dall'altro) invece
  di quelli dove il tratto dalla riva costa meno, e solo quelli da cui una
  riva raggiungibile a piedi sta entro 300 m (`_Wanted.reached`), così una
  forma lasciata al largo torna dove una partenza c'è.
- **Il costo** ha un termine in più: `NEAR_WEIGHT = 10` per ogni metro fra
  il centro e `near`, diviso la distanza chiesta: cinque volte un metro di
  tratto dalla riva andata e ritorno. Prima viene il posto, poi la forma
  più grande e il tratto più corto lì. I primi `NEAR_FREE_M = 30` metri non
  costano: un dito sulla mappa non li distingue, e la forma non si
  rimpicciolisce né si inclina per stare dieci metri più vicina.
- **Dove non ci sta** (sulla terra, oltre la fascia, troppo al largo,
  oltre i 2 km dalla partenza) la forma va nel posto più vicino in cui ci
  sta: più vicina alla riva di così non si può (50 m sui laghi, 200 m al
  mare), e può uscirne più piccola (entro il ±10% della distanza) o
  inclinata diversamente.
- **Chiesta dov'è, resta dov'è**: `near` uguale al `centre` di un percorso
  dà lo stesso percorso. **Senza `near` niente cambia**: i 32 esempi
  dell'app sull'acqua vera sono usciti identici, punto per punto.
- **Tempi** sull'acqua vera (Garda, Como, Jesolo, Riccione, 2 km, cuore e
  testa di cane a pezzi): 1–6 s, contro 0,5–1,7 s senza `near`: il costo
  del posto toglie potature alla ricerca.

**La validazione sull'acqua** (`validation.check_on_water`, da
`water_fit.measure`): il percorso è chiuso, nessun metro sulla terra (oltre
mezzo metro dentro: il tratto parte dal bordo dell'acqua), nessun punto
oltre 1000 m dalla riva, la distanza entro ±10%. Non sono warning: un
percorso che non li rispetta è un errore del motore (`InvalidRouteError`).
Niente scale, strade principali e ripercorrenza: sull'acqua non hanno
senso.

**Dalla CLI** di §7, l'acqua in `<cache-dir>/water/` (una richiesta a
Overpass se manca):

```
python -m route_engine --shape heart --distance 2000 \
    --start 44.0036,12.6634 --activity paddling --out heart_riccione.gpx
```

Stampa la scala e la rotazione, la partenza sulla riva e il suo tipo, il
tratto, la distanza, quanto la forma sta lontana dalla terra e quanto il
percorso si allontana dalla riva. `--score-track` vale anche sull'acqua;
`--nearby` e `--no-optimize` sono delle strade e si rifiutano. Con
`--pen-up` e una forma a pezzi stampa anche i tratti a penna alzata, e il
GPX li segna con `Pause` e `Resume`:

```
python -m route_engine --shape cat --distance 2000 --pen-up \
    --start 45.8132,9.0803 --activity paddling --out cat_como.gpx
```

Stampa anche il centro della forma (`centre:`). Con `--near LAT,LON` la
forma si chiede vicino a quel punto (TASK-238), e la riga dice a quanti
metri è finita; con un'altra attività `--near` si rifiuta:

```
python -m route_engine --shape heart --distance 2000 \
    --start 44.0036,12.6634 --activity paddling --near 44.0105,12.6702 \
    --out heart_riccione_moved.gpx
```

`python -m route_engine.water` resta per i campioni, dalle fixture o dalle
risposte dell'API di OSM:

```
python -m route_engine.water --shape heart --distance 2000 \
    --start 44.0007195,12.6512502 \
    --water-file services/route-engine/tests/fixtures/water_coast.json \
    --out heart_coast.gpx
```
