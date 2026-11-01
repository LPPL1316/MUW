import type { AboutContent, AboutDocument } from "../documents";

/**
 * «Help», «Terms» and «Privacy» in Italian (TASK-184, ADR-0205): the same
 * sections as `en.ts`, in the same order (a test compares them). The names
 * of pages and buttons are the ones the app shows in Italian, the pages'
 * as TASK-210 G names them: «Feed», «Disegna», «Esplora».
 */

const UPDATED = "10 ottobre 2026";
/** «Privacy» is final since the user approved it (TASK-237 D; without ads, TASK-267 B); dated the day the contacts entered (TASK-262 C). */
const PRIVACY_UPDATED = "31 ottobre 2026";

const help: AboutDocument = {
  title: "Come funziona MuW",
  draft: false,
  updated: null,
  sections: [
    {
      heading: "Che cos'è MuW",
      blocks: [
        "MuW disegna percorsi veri che sulla mappa tracciano una forma. Scegli la forma, la distanza e da dove partire: ottieni un percorso su strade vere, con il suo file GPX.",
        "L'app ha quattro pagine affiancate, «Feed», «Disegna», «Esplora» e il tuo profilo: scorri a destra o a sinistra, oppure tocca un nome in alto. Il cerchio in alto porta al tuo profilo.",
      ],
    },
    {
      heading: "Disegnare un percorso",
      blocks: [
        {
          bullets: [
            "Scegli una forma: un cuore, una stella, un gatto e altre, una parola dalla A alla Z, o il contorno di una tua foto.",
            "Scegli la distanza: fino a 21 km a piedi, partendo da dove sei o da un luogo che cerchi.",
            "Tocca «Disegna il percorso». MuW disegna fino a tre percorsi su strade vere, A, B e C: tieni quello che ti piace.",
            "«Esporta GPX» ti dà il file per l'orologio o per un'altra app.",
          ],
        },
        "Un percorso di solito arriva in pochi secondi; i più lunghi possono chiedere fino a un minuto.",
      ],
    },
    {
      heading: "Esplora",
      blocks: [
        "Percorsi già disegnati nella tua città, pronti da correre: niente attesa, basta sceglierne uno.",
        "Scegli «Vicino a me», un paese vicino o cerca una città, poi tocca un percorso per vederlo sulla mappa.",
      ],
    },
    {
      heading: "Correre un percorso",
      blocks: [
        {
          bullets: [
            "«Parti» fa partire la corsa dopo un breve conto alla rovescia.",
            "Una voce ti dice ogni svolta in anticipo. La mappa mostra il tratto già corso e quello ancora davanti.",
            "«Pausa» ferma il tempo e «Riprendi» lo fa ripartire.",
            "Per finire la corsa tieni premuto il pulsante di stop: un tocco breve non la chiude.",
          ],
        },
        "«Corri senza percorso» registra lo stesso la tua corsa, senza una forma da seguire.",
        "Un percorso è un suggerimento calcolato dai dati della mappa: tieni gli occhi sulla strada e rispetta il codice della strada.",
      ],
    },
    {
      heading: "Tenere corse e percorsi",
      blocks: [
        "Con un account, «Salva» a fine corsa la tiene in «Le mie attività», in «Profilo»; «Scarta» la butta via. Senza rete la corsa aspetta sul telefono e parte dopo.",
        "Il cuore su un percorso sulla mappa lo tiene fra i «Preferiti».",
      ],
    },
    {
      heading: "Pubblicare e condividere",
      blocks: [
        "Una corsa salvata è privata: la vedi solo tu. Gli altri iscritti vedono sul tuo profilo solo i totali di tutte le tue corse salvate, distanza e dislivello, mai le corse. Scegli «Tutti» o «Follower» sotto «Chi può vederla», a fine corsa o su una corsa di «Le mie attività», e la vedono come disegno sul tuo profilo, senza i primi e gli ultimi 200 m. La prossima corsa che finisci parte dall'ultima scelta che hai salvato: la vedi prima di «Salva» e puoi cambiarla. Un'attività aggiunta da un file parte sempre da «Solo io».",
        "«Condividi» crea un'immagine della tua corsa da mandare dove vuoi.",
      ],
    },
    {
      heading: "Feed e amici",
      blocks: [
        "«Feed» mostra disegni da cui prendere idee: toccane uno per aprire il suo percorso e correrlo.",
        "La lente in cima a «Feed» trova gli altri iscritti per nome. Su un profilo puoi toccare «Segui»; le richieste, chi ti segue e chi segui sono in «Profilo».",
        "Sul disegno pubblico di un iscritto puoi reagire con un'emoji, mandare un super like e scrivere un commento. I commenti negativi non sono accettati.",
      ],
    },
    {
      heading: "Messaggi",
      blocks: [
        "«Messaggio» sul profilo di un iscritto gli scrive. Se ti segue, il messaggio arriva nei suoi «Messaggi»; se no, arriva come richiesta, e puoi mandare un solo messaggio finché non la accetta.",
        "Le tue conversazioni sono in «Profilo», «Messaggi», con «Richieste di messaggio» in cima. Accetta una richiesta per scrivervi, eliminala (chi ha scritto non lo sa) o blocca chi ha scritto.",
        "Tieni premuto un messaggio per eliminare il tuo, per tutti e due, o per segnalarne uno che hai ricevuto. Nessuno vede se hai letto un messaggio. Con le push accese, MuW ti avvisa di ogni messaggio e di ogni richiesta.",
        "In una conversazione tocca + per inviare una foto, un video fino a 60 secondi o un disegno, oppure tocca Invia agli amici su un percorso o un disegno. Puoi inviarli quando l'altra persona ha accettato il tuo messaggio. I video restano 30 giorni, o meno quando il nostro spazio per i video è pieno: i più vecchi vanno via per primi. Tocca un disegno per aprirlo sulla mappa, partire, esportarne il GPX o tenerlo nei preferiti.",
      ],
    },
    {
      heading: "Corsa, bici, canoa",
      blocks: [
        "Scegli lo sport con il pulsante accanto al profilo, o in «Impostazioni».",
        {
          bullets: [
            "Corsa: fino a 21 km su strade vere, con la voce svolta per svolta.",
            "Bici: da 10 a 30 km, su ciclabili e strade aperte alle bici. Le svolte sono dette in anticipo e lo schermo mostra la velocità.",
            "Canoa: da 1 a 5 km su laghi e mare, vicino alla riva, in canoa, kayak o SUP. Segui la linea sulla mappa.",
          ],
        },
        "Sull'acqua leggi l'avviso di sicurezza prima di partire: indossa il giubbotto salvagente, controlla il meteo e il vento, rispetta le regole del posto. Il percorso resta entro 1 km dalla riva: questo non lo rende sicuro né permesso.",
      ],
    },
    {
      heading: "Impostazioni",
      blocks: [
        {
          bullets: [
            "Foto del profilo, email e numero di telefono. Il numero è facoltativo e lo vedi solo tu.",
            "Lingua: English, Deutsch, Italiano, Español o Français. La voce la segue.",
            "Mappe offline: il telefono tiene le mappe intorno a te e disegna i percorsi da solo; «Elimina» libera lo spazio.",
            "Unità di misura: quelle del telefono, chilometri o miglia. Con le miglia cambiano le distanze, il passo e la voce: un annuncio a ogni miglio, le svolte in piedi.",
            "Notifiche: tre interruttori. «Notifiche email» e «Notifiche push» sono spenti finché non li accendi; «Email quando sono via» è acceso finché non lo spegni. Con le push accese, e quando il telefono le consente, MuW ti avvisa subito di richieste di follow, richieste accettate, reazioni, commenti e tag; toccandone una si apre il post o il profilo. Con le email accese, le stesse novità arrivano in una email al giorno al massimo. «Email quando sono via»: se non apri MuW per 2 settimane, una email con le novità.",
          ],
        },
      ],
    },
    {
      heading: "Il tuo account",
      blocks: [
        "Ti iscrivi con un'email, un nome utente e una password. Devi avere almeno 16 anni.",
        "Non c'è ancora un modo per recuperare una password dimenticata: conserva bene la tua.",
        "«Esci» ed «Elimina account» sono in fondo a «Impostazioni». Eliminare l'account elimina tutto quello che è tuo, subito, e non si può annullare.",
      ],
    },
    {
      heading: "Domande",
      blocks: ["Scrivi a [contact email]."],
    },
  ],
};

const terms: AboutDocument = {
  title: "Condizioni d'uso",
  draft: true,
  updated: UPDATED,
  sections: [
    {
      heading: "Chi offre MuW",
      blocks: [
        "MuW è offerta da [name] («noi»). Puoi scriverci a [contact email].",
        "Queste condizioni sono l'accordo fra te e noi per l'uso dell'app MuW. Creando un account o usando l'app le accetti.",
      ],
    },
    {
      heading: "Che cos'è MuW",
      blocks: [
        "MuW disegna percorsi che sulla mappa tracciano una forma, da fare di corsa, in bici o in canoa; registra la tua attività mentre li segui; e permette agli iscritti di pubblicare i loro disegni, seguirsi, reagire e commentare.",
      ],
    },
    {
      heading: "Chi può usarla",
      blocks: [
        "Per creare un account devi avere almeno 16 anni. Per disegnare un percorso l'account non serve.",
      ],
    },
    {
      heading: "Il tuo account",
      blocks: [
        {
          bullets: [
            "Ti iscrivi con un indirizzo email, un nome utente e una password. L'account è solo tuo: non usare l'account di un'altra persona e non farti passare per qualcun altro.",
            "Tieni segreta la password. Sei responsabile di ciò che viene fatto con il tuo account. Non c'è ancora un modo per recuperare una password dimenticata.",
            "Se aggiungi un numero di telefono, aggiungi solo un numero che è tuo.",
            "Puoi uscire o eliminare l'account in ogni momento da «Impostazioni».",
          ],
        },
      ],
    },
    {
      heading: "Come usare MuW",
      blocks: [
        "Usa l'app nel rispetto della legge e degli altri iscritti. In particolare, non:",
        {
          bullets: [
            "pubblicare contenuti offensivi, d'odio, minacciosi o molesti, nel nome utente, nella bio, nella foto, nei titoli o nei commenti;",
            "pubblicare contenuti che non hai il diritto di pubblicare, o dati personali di altre persone senza il loro permesso;",
            "cercare di guastare, sovraccaricare o aggirare il servizio, o raccogliere dati sugli iscritti con mezzi automatici.",
          ],
        },
      ],
    },
    {
      heading: "Quello che pubblichi",
      blocks: [
        "Le tue corse, i tuoi disegni, i loro titoli, il tuo profilo e i tuoi commenti restano tuoi.",
        "Pubblicandoli ci permetti di conservarli e di mostrarli nell'app agli altri iscritti, solo per far funzionare il servizio: un permesso gratuito e non esclusivo, che finisce quando elimini il contenuto o l'account.",
        "L'app non accetta commenti con parole offensive: un filtro automatico di parole li rifiuta. Possiamo togliere i contenuti contrari a queste condizioni. Per segnalarci un contenuto che non dovrebbe esserci, scrivi a [contact email].",
      ],
    },
    {
      heading: "Sicurezza",
      blocks: [
        "Un percorso è un suggerimento calcolato dai dati della mappa. Nessuno lo ha percorso per te, e la mappa può essere incompleta o non aggiornata: una strada può essere chiusa, privata, senza marciapiede o pericolosa.",
        {
          bullets: [
            "Sei tu responsabile di dove vai. Rispetta il codice della strada e la segnaletica, anche quando il percorso o la voce dicono altro.",
            "Controlla le condizioni prima e durante l'attività: traffico, luce, meteo, fondo, la tua salute e il tuo allenamento.",
            "Non guardare il telefono mentre ti muovi nel traffico.",
            "Sull'acqua serve ancora più attenzione: indossa il giubbotto salvagente, controlla il meteo e il vento, rispetta le regole del posto (zone di balneazione, corridoi di lancio, porti). MuW non le conosce. Un percorso vicino alla riva non è, per questo, sicuro né permesso.",
          ],
        },
        "Distanze, tempi e velocità vengono dal GPS del telefono e sono stime.",
      ],
    },
    {
      heading: "Nessuna garanzia, e i limiti della nostra responsabilità",
      blocks: [
        "Lavoriamo perché MuW funzioni e i suoi percorsi siano buoni, ma l'app è offerta così com'è: non promettiamo che sia sempre disponibile o senza errori, che un percorso si possa completare, o che le sue misure siano esatte.",
        "Nei limiti in cui la legge lo permette, non rispondiamo dei danni che derivano dall'uso dell'app o dei suoi percorsi. Niente in queste condizioni limita una responsabilità che la legge non permette di limitare, né i diritti che hai come consumatore.",
      ],
    },
    {
      heading: "Pubblicità",
      blocks: ["MuW non mostra pubblicità."],
    },
    {
      heading: "Servizi di altri",
      blocks: [
        {
          bullets: [
            "Le mappe vengono da OpenFreeMap e dai dati di OpenStreetMap (© contributori di OpenStreetMap).",
            "I luoghi si cercano con Geoapify.",
            "Se colleghi Strava, le corse che mandi là seguono le condizioni e le impostazioni di privacy di Strava.",
            "Un'immagine che condividi esce dal foglio di condivisione del telefono: l'app che la riceve ha le sue condizioni.",
          ],
        },
      ],
    },
    {
      heading: "Modifiche",
      blocks: [
        "Possiamo cambiare l'app, e aggiungere o togliere ciò che fa. Quando cambiamo queste condizioni cambiamo la data in cima; se una modifica è importante la faremo sapere prima che valga.",
      ],
    },
    {
      heading: "Chiudere l'account",
      blocks: [
        "Puoi smettere di usare MuW ed eliminare l'account in ogni momento: «Privacy» dice che cosa si cancella e quando. Possiamo sospendere o chiudere un account contrario a queste condizioni.",
      ],
    },
    {
      heading: "Legge applicabile",
      blocks: [
        "Queste condizioni sono regolate da [governing law]. Se sei un consumatore, conservi le tutele che la legge del paese in cui vivi non permette di escludere.",
      ],
    },
    {
      heading: "Contatti",
      blocks: ["[name] · [contact email]"],
    },
  ],
};

const privacy: AboutDocument = {
  title: "Informativa sulla privacy",
  draft: false,
  updated: PRIVACY_UPDATED,
  sections: [
    {
      heading: "Chi è responsabile dei tuoi dati",
      blocks: [
        "Il titolare del trattamento dei tuoi dati personali è Luca Pallaoro. Per tutto ciò che riguarda i tuoi dati, scrivi a muw2610@gmail.com.",
        "Questo testo dice quali dati tratta MuW, perché, dove stanno e per quanto tempo, e che cosa puoi fare.",
      ],
    },
    {
      heading: "Senza account",
      blocks: [
        "Puoi disegnare percorsi, esplorare e correre senza account. La corsa, allora, non esce dal telefono. Quello che esce lo stesso è in «I percorsi che chiedi», «La tua posizione» e «Chi altro riceve dati».",
      ],
    },
    {
      heading: "Il tuo account",
      blocks: [
        {
          bullets: [
            "Il tuo indirizzo email e il tuo nome utente, per farti entrare e distinguere gli account.",
            "La tua password, conservata solo come hash (Argon2id): la password vera non la conserviamo e non la vediamo mai.",
            "Il giorno in cui ti sei iscritto e quando hai confermato di avere almeno 16 anni.",
            "La sessione di ogni telefono da cui sei entrato: il telefono tiene un token nel suo archivio protetto, il server ne tiene solo l'hash. Una sessione finisce 90 giorni dopo l'ultimo uso, o quando esci.",
            "Le tue tre scelte sulle notifiche in «Impostazioni»: «Notifiche email» e «Notifiche push», spente finché non le accendi, ed «Email quando sono via», accesa finché non la spegni. Con le push accese, il token push del tuo telefono, se è un iPhone o un Android e la lingua dell'app, per mandarti le notifiche attraverso il servizio push di Expo, che le passa ad Apple o a Google. Una notifica dice chi ha fatto cosa, con l'inizio di un commento. Il token se ne va quando spegni le push, esci dall'account o lo cancelli.",
            "La lingua dell'app quando ti sei iscritto, per scriverti le nostre email in quella lingua.",
          ],
        },
        "Il tuo indirizzo email non è mai mostrato agli altri iscritti.",
      ],
    },
    {
      heading: "Le email di MuW",
      blocks: [
        {
          bullets: [
            "Con «Notifiche email» accese, al massimo una email al giorno, solo nei giorni con novità: le richieste di follow, le richieste accettate, le reazioni, i commenti e i tag del giorno, come li dicono le notifiche push. Finché non parte, il nostro server tiene chi ha fatto cosa e su quale post, per al massimo 7 giorni; quello che non è più vero quando la email si scrive resta fuori.",
            "«Email quando sono via»: se non apri MuW per 2 settimane, una email con quanti disegni nuovi ci sono delle persone che segui, con fino a tre dei loro nomi utente, oppure nel Feed. Una per assenza: la successiva solo dopo che sei tornato e poi di nuovo via. È accesa per ogni iscritto, anche per chi si è iscritto prima di questo testo; puoi dire di no all'iscrizione, in «Impostazioni» o con il link nella email.",
            "Ogni email ha il link «Non mandarmi più queste email», che spegne quella email. Le mandiamo attraverso Resend, da un indirizzo di getmuw.app.",
            "Le email che servono al tuo account, che nessun interruttore spegne: una per confermare il tuo indirizzo quando ti iscrivi o lo cambi, un avviso al vecchio indirizzo quando lo cambi, e un link per una nuova password quando lo chiedi.",
          ],
        },
      ],
    },
    {
      heading: "Il tuo numero di telefono (facoltativo)",
      blocks: [
        "Puoi aggiungere un numero di telefono in «Impostazioni». È facoltativo: l'app funziona allo stesso modo senza.",
        "È privato: lo vedi solo tu. Non compare mai sul tuo profilo, nella ricerca o in un elenco. Serve perché gli amici che hanno il tuo numero nella rubrica del telefono possano trovare il tuo account (vedi «Amici dalla rubrica»).",
        "Non verifichiamo il numero e non gli mandiamo messaggi. Puoi toglierlo in ogni momento da «Impostazioni»; si cancella con l'account.",
      ],
    },
    {
      heading: "Amici dalla rubrica",
      blocks: [
        "Sotto la lente in cima a «Feed», «Trova amici nella rubrica» cerca gli iscritti il cui numero è nella rubrica del tuo telefono. L'app chiede la rubrica al telefono solo quando lo tocchi, e ne legge solo i numeri di telefono: mai nomi, email o foto.",
        "Ogni numero esce dal telefono in codice: scritto con il prefisso del paese e trasformato in un hash (SHA-256). Il nostro server confronta i codici con quelli dei numeri aggiunti dagli iscritti, risponde con gli iscritti trovati e non tiene nulla di ciò che ha ricevuto: né nel database né in un registro.",
        "L'hash di un numero di telefono non è un segreto: chi avesse i codici potrebbe ritrovare i numeri provando tutti i numeri possibili. Per questo la vera protezione è che il nostro server non ne tiene nessuno; viaggiano solo sulla connessione cifrata.",
        "I numeri della tua rubrica sono dati di altre persone: si confrontano una volta, per trovare gli account, e si dimenticano. Per impedire a chiunque di provare i numeri uno a uno, il server conta le ricerche di ogni account in un'ora, solo in memoria. Si trova solo chi ha aggiunto il proprio numero, e mai chi hai bloccato o chi ti ha bloccato.",
      ],
    },
    {
      heading: "Il tuo profilo",
      blocks: [
        "Il nome utente, la bio e la foto del profilo sono ciò che gli altri iscritti vedono di te. La foto è conservata come una piccola immagine quadrata, senza i dati che la fotocamera le aggiunge. Chiunque abbia un account può cercare gli iscritti per nome utente.",
      ],
    },
    {
      heading: "Le tue corse e le loro tracce GPS",
      blocks: [
        "Con un account, quando tocchi «Salva» a fine corsa la corsa intera va al nostro server: ogni posizione con il suo orario e la sua altezza, le pause, il percorso seguito, distanza, durata, un punteggio di quanto la traccia segue il percorso (calcolato dal nostro server e non mostrato nell'app) e il nome del luogo. Con «Discard» non parte niente.",
        "Una corsa salvata è privata, se non scegli diversamente: la vede solo il tuo account. Gli altri iscritti vedono sul tuo profilo solo i totali di tutte le tue corse salvate, distanza e dislivello, mai le corse. Resta finché non la elimini da «Le mie attività» o elimini l'account.",
        "Se aggiungi un'attività passata da un file, ne teniamo la traccia e gli orari come per una corsa registrata con MuW. Il file non lo teniamo.",
        "Una corsa spesso parte e finisce davanti a casa. Per questo diventa visibile agli altri iscritti solo dopo che hai scelto «Tutti» o «Follower» sotto «Chi può vederla», e allora vedono la traccia senza i primi e gli ultimi 200 m, con il titolo che le hai dato, e senza orari, pause né il percorso pianificato. La tua scelta resta su questo telefono per la corsa successiva: parte dall'ultima che hai salvato, la vedi prima di «Salva» e puoi cambiarla. Un'attività aggiunta da un file parte sempre da «Solo io».",
        "Chi può vedere una tua corsa può anche seguirla con «Parti» e salvarne la stessa traccia come file GPX: sempre senza i primi e gli ultimi 200 m e senza orari.",
      ],
    },
    {
      heading: "Preferiti, commenti, reazioni e follow",
      blocks: [
        {
          bullets: [
            "Un percorso che tieni fra i «Preferiti» è conservato intero, con la sua linea, che spesso parte vicino a casa tua. Lo vede solo il tuo account, finché non lo togli o elimini l'account.",
            "I tuoi commenti e le tue reazioni sotto un disegno li vedono gli iscritti che vedono quel disegno. Puoi eliminare i tuoi commenti.",
            "Chi segui, chi ti segue e le richieste di follow sono conservati con il tuo account.",
          ],
        },
      ],
    },
    {
      heading: "Messaggi privati",
      blocks: [
        "I tuoi messaggi privati stanno sul nostro server: chi ha scritto, a chi, il testo e quando, e per ognuno dei due se ha accettato la conversazione, quando l'ha letta l'ultima volta e fino a quando l'ha tolta dalla sua vista. Non sono cifrati end-to-end. Nell'app una conversazione la vedono solo i suoi due iscritti, e nessuno viene avvisato se un messaggio è stato letto. Li teniamo per darti il servizio che chiedi (contratto).",
        "Un messaggio può portare una foto, un video o un disegno. Una foto la teniamo ridotta, senza i dati che il telefono le aggiunge, come dove e quando è stata scattata. Un video lo teniamo come lo manda il telefono, senza il luogo in cui è stato girato, e lo cancelliamo 30 giorni dopo l'invio, o prima, dai più vecchi, quando il nostro spazio per i video è pieno. Un disegno è una copia del percorso: una corsa che mandi arriva senza l'inizio e la fine, come nel Feed, un percorso che hai pianificato arriva intero, con la sua partenza. Foto e video non sono cifrati end-to-end, non sono nelle nostre copie di sicurezza e si cancellano con il loro messaggio, la conversazione o il tuo account. Quando segnali un messaggio, chi gestisce MuW vede anche la sua foto, il video o il disegno.",
        "Un messaggio a chi non ti segue arriva come richiesta; il primo messaggio di una richiesta passa dallo stesso filtro di parole dei commenti.",
        "Puoi eliminare i tuoi messaggi, per tutti e due. Eliminare una conversazione la toglie dalla tua vista; un messaggio che nessuno dei due vede più viene cancellato. Un blocco cancella la conversazione; cancellare l'account cancella tutte le tue conversazioni, con i messaggi di tutti e due.",
        "Quando segnali un messaggio, l'email a chi gestisce MuW contiene solo quel messaggio, mai il resto della conversazione. Con le push accese, la notifica di un messaggio ne porta l'inizio, attraverso il servizio push di Expo e Apple o Google, come per i commenti.",
      ],
    },
    {
      heading: "Segnalazioni",
      blocks: [
        "Quando segnali un disegno, un commento o un profilo, teniamo chi ha segnalato cosa, il motivo e quando. Chi gestisce MuW la riceve per email e può nascondere agli altri iscritti ciò che è stato segnalato. Non si cancella niente, e il suo autore continua a vederlo. La tua segnalazione non è mai mostrata all'autore.",
      ],
    },
    {
      heading: "Corse di gruppo",
      blocks: [
        "Se crei una corsa di gruppo o dici che ci vai, gli iscritti che la vedono vedono il tuo nome, la tua foto e che ci vai. Cancelliamo le tue corse di gruppo e le tue risposte quando cancelli l'account.",
      ],
    },
    {
      heading: "Feedback",
      blocks: [
        "Quando ci scrivi da «Mandaci un feedback» in «Impostazioni», teniamo il tuo messaggio, la versione dell'app, il sistema del telefono (iOS o Android) e quando l'hai mandato. Chi gestisce MuW lo riceve per email con il tuo nome utente e il tuo indirizzo email, per leggerlo e, se serve, risponderti per email. Non è mai mostrato agli altri iscritti. Quando cancelli l'account, i tuoi messaggi sono cancellati con esso dal nostro server.",
      ],
    },
    {
      heading: "Il gioco delle forme",
      blocks: [
        "Con un account, il nostro server calcola dalle tue corse a piedi salvate quanti chilometri contano per il gioco, i tuoi tempi migliori su 1, 5, 10 e 21,1 km e le forme che hai collezionato. Solo tu vedi la tua collezione e i tuoi tempi migliori. Se entri in una squadra, i suoi iscritti vedono il tuo nome utente, la tua foto, i pezzi di una sfida che hai preso e i chilometri che hai dato a ognuno, mai le tue tracce, gli orari delle tue corse o dove hai corso. Una squadra si trova solo con il suo codice: non è mai in una ricerca. Eliminare una corsa toglie i suoi chilometri dal conteggio, e le forme che hai già collezionato restano. Quando elimini l'account, i tuoi dati del gioco si cancellano con lui; nelle sfide di una squadra i pezzi che hai corso restano agli altri, senza il tuo nome.",
      ],
    },
    {
      heading: "I percorsi che chiedi",
      blocks: [
        "Per disegnare un percorso l'app manda al nostro server la partenza, la forma o la parola e la distanza. Quando il telefono ha la mappa offline della zona, il percorso lo disegna da solo.",
        "I percorsi che il nostro motore disegna restano sul nostro server senza chi li ha chiesti, per rispondere subito a chi chiede lo stesso disegno vicino e per consigliarli; contiamo quante corse e quanti preferiti seguono ognuno. Un percorso parte da dove è stato chiesto, spesso vicino a casa di qualcuno, ma non dice mai chi l'ha chiesto o corso.",
        "Le mappe offline vengono dal nostro server: quella intorno a te e, in anticipo, quelle dei paesi vicini. Per mettere un tetto a questi download il server li conta, giorno per giorno, con un numero anonimo che l'app crea per il telefono; il conteggio sta solo in memoria.",
        "Le parole che descrivono una forma sono lette sul nostro server e non vanno a un servizio di AI esterno.",
        "Una foto che scegli per un disegno va al nostro server una volta, per trovarne il contorno: il server non la salva e non la scrive nei log.",
        "Una figura disegnata col dito, o il contorno della tua foto, va al nostro server una volta, come il percorso che chiedi: il server non la tiene.",
        "Per migliorare la ricerca teniamo un evento per ogni ricerca e per alcuni usi dell'app (un percorso scelto, un file GPX esportato, una corsa con il punteggio): il testo in minuscolo, al massimo 200 caratteri, con email e numeri lunghi oscurati; le posizioni solo come quadrati di circa 1 km; niente che dica chi sei o quale telefono era. Questi eventi sono conservati senza un limite di tempo.",
      ],
    },
    {
      heading: "La tua posizione",
      blocks: [
        "La posizione del telefono è usata sul telefono, per far partire un percorso da dove sei e per seguire la tua corsa. Va al nostro server esatta come partenza di un percorso che chiedi, come partenza delle forme che l'app ti prepara qui vicino quando il telefono non riesce a disegnarle da solo, e dentro una corsa che salvi. Va arrotondata a circa 1 km per trovare la mappa offline intorno a te, i percorsi consigliati, i paesi e i disegni vicini, e per mettere prima i luoghi vicini a te in una ricerca; così arrotondata non resta legata al tuo account.",
        "Su iPhone, durante una corsa che hai fatto partire, l'app continua a seguire la tua posizione anche a telefono bloccato o con un'altra app aperta, finché non fermi la corsa; l'iPhone lo mostra con un segno blu in cima allo schermo. MuW chiede la posizione solo mentre usi l'app, mai «Sempre».",
        "Come ogni servizio su internet, il nostro server vede l'indirizzo internet (IP) da cui arriva una richiesta mentre le risponde. Il log del server non scrive posizioni, e nel database non ci sono indirizzi IP.",
        "Un registro delle richieste di percorso, con la loro partenza, esiste per riprodurre un difetto. Sul nostro server è spento; acceso, tiene al massimo 10 MB, poi le righe più vecchie si perdono.",
      ],
    },
    {
      heading: "Pubblicità",
      blocks: [
        "MuW non mostra annunci e non usa servizi pubblicitari: nessun dato su di te va a una rete pubblicitaria, e l'app non chiede mai di tracciarti nelle altre app.",
      ],
    },
    {
      heading: "Strava",
      blocks: [
        "Una corsa va a Strava solo quando lo chiedi, e solo dopo che hai collegato il tuo profilo Strava. Finché è collegato, il nostro server tiene il tuo nome su Strava e le chiavi che Strava ci ha dato per il tuo profilo. A Strava mandiamo allora la traccia con gli orari, il nome e una riga di descrizione. A Strava chiediamo solo il permesso di aggiungere attività, mai di leggere le tue. Su Strava l'attività segue le tue impostazioni di privacy di Strava, non quelle di MuW.",
      ],
    },
    {
      heading: "Chi altro riceve dati",
      blocks: [
        {
          bullets: [
            "Hetzner ospita il nostro server e le sue copie di sicurezza, in Germania.",
            "Geoapify riceve le ricerche di luoghi, dei paesi vicini e dei posti di un percorso a tema, con la posizione arrotondata a circa 1 km, e, per dare il nome al luogo di una corsa salvata, la sua partenza arrotondata allo stesso modo: mai la tua porta, la corsa o chi sei. Se il nostro server non risponde, la ricerca di un luogo va invece a Photon (komoot).",
            "OpenFreeMap serve la mappa: come ogni servizio di mappe, vede quale zona guardi.",
            "Wikimedia dà al nostro server le foto dei paesi: vede quale paese, non chi lo chiede.",
            "Con la mappa «Satellite» Esri fornisce le immagini, e con la mappa «3D» Amazon Web Services fornisce le altezze: come ogni servizio di mappe, vedono quale area guardi.",
            "Il servizio Overpass dei dati di OpenStreetMap riceve dal nostro server la richiesta della mappa di una zona che non ha ancora: vede quale zona, non chi l'ha chiesta.",
            "unpkg serve la libreria della mappa all'avvio dell'app.",
            "Expo serve gli aggiornamenti dell'app.",
            "Google Ireland Limited (Firebase Cloud Messaging), per consegnare le notifiche push ai telefoni Android. Quando accendi le push, l'app chiede a Firebase un token di registrazione per il tuo telefono; il servizio push di Expo passa ogni notifica (chi ha fatto cosa, e l'inizio di un commento) a Google, che la consegna al tuo telefono. Google vede il token e il contenuto di ogni notifica, non il tuo account né la tua posizione. Il token si toglie dal nostro server quando spegni le push, esci dall'account o lo elimini; quello sul telefono se ne va quando disinstalli l'app.",
            "Resend, negli Stati Uniti, manda le email di MuW: il tuo indirizzo email con la email stessa. Per una segnalazione porta a chi gestisce MuW ciò che è stato segnalato, il suo testo, il motivo e i nomi utente di chi l'ha segnalato e di chi l'ha scritto. Per «Mandaci un feedback» porta il tuo messaggio, il tuo nome utente e il tuo indirizzo email.",
            "Strava, come detto sopra.",
          ],
        },
        "Un'immagine o un video della tua corsa creati con «Condividi» si fanno sul telefono ed escono solo dal foglio di condivisione, dove li mandi tu. Il video mostra la mappa attorno alla corsa, senza i primi e gli ultimi 200 metri.",
      ],
    },
    {
      heading: "Dove stanno i tuoi dati e per quanto",
      blocks: [
        {
          bullets: [
            "Sul nostro server in Germania, finché hai l'account.",
            "Quando elimini l'account, tutto quello che è tuo si cancella subito: profilo, foto, numero di telefono, corse, disegni, preferiti, commenti, reazioni, follow, dati del gioco e le novità in attesa della tua email. I percorsi disegnati dal nostro motore restano: non dicono niente di chi li ha chiesti.",
            "Una copia di sicurezza del database si fa ogni notte e si tiene 13 giorni: un account eliminato è fuori da ogni copia entro 14 giorni.",
            "Sul tuo telefono: la sessione, le tue scelte (lingua, sport, laghi o mare), le mappe offline, le corse che aspettano ancora di partire e, con un account, la zona da cui partono di solito le tue attività, per suggerirti laghi e mare vicini; si cancella quando esci dall'account.",
          ],
        },
        "Il collegamento fra l'app e il nostro server è cifrato (HTTPS).",
      ],
    },
    {
      heading: "Perché possiamo usare i tuoi dati",
      blocks: [
        {
          bullets: [
            "Per darti il servizio che chiedi (contratto): il tuo account, il tuo profilo, i percorsi che chiedi, e le corse, i preferiti, i commenti, le reazioni e i follow che salvi, le email delle notifiche che hai acceso, e il gioco delle forme.",
            "Il nostro legittimo interesse a far funzionare MuW, a tenerla sicura e a migliorarla: i brevi registri del server, i conteggi che limitano gli scaricamenti delle mappe e gli eventi delle ricerche, che non dicono nulla di chi sei; il confronto dei numeri della tua rubrica, che non ne tiene nessuno; la email quando sei via, che puoi rifiutare all'iscrizione, in «Impostazioni» o in ogni email; le email delle segnalazioni, per tenere MuW sicura; l'archivio dei percorsi disegnati, che non dice nulla di chi sei; i messaggi di «Mandaci un feedback», per leggerli e risponderti.",
            "Il tuo consenso: il numero di telefono che scegli di aggiungere e il collegamento a Strava. Puoi ritirare un consenso in qualsiasi momento; quello che è stato fatto prima resta lecito.",
            "Un obbligo di legge, quando una legge ci chiede di conservare o di consegnare dei dati.",
          ],
        },
      ],
    },
    {
      heading: "I tuoi diritti",
      blocks: [
        "Puoi, in ogni momento:",
        {
          bullets: [
            "vedere e correggere i tuoi dati: nome utente, bio e foto in «Profilo», email e numero di telefono in «Impostazioni»;",
            "eliminare una corsa da «Le mie attività», un preferito, un commento, o l'intero account da «Impostazioni», «Elimina account»;",
            "chiederci una copia dei tuoi dati, o di fermare o limitare un loro uso;",
            "ritirare un consenso che hai dato;",
            "spegnere qualsiasi email in «Impostazioni» o con il suo link;",
            "fare reclamo all'autorità per la protezione dei dati del tuo paese (in Italia, il Garante per la protezione dei dati personali).",
          ],
        },
        "Per tutto ciò che non puoi fare dall'app, scrivi a muw2610@gmail.com.",
      ],
    },
    {
      heading: "Minori",
      blocks: [
        "Gli account di MuW sono per chi ha almeno 16 anni. Se pensi che qualcuno più giovane abbia un account, scrivici e lo elimineremo.",
      ],
    },
    {
      heading: "Modifiche a questo testo",
      blocks: [
        "Quando questo testo cambia, cambiamo la data in cima; se una modifica è importante la faremo sapere prima che valga.",
      ],
    },
    {
      heading: "Contatti",
      blocks: ["Luca Pallaoro · muw2610@gmail.com"],
    },
  ],
};

export const IT: AboutContent = { help, terms, privacy };
