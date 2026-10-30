import type { Table } from "./translate";

/**
 * The app's texts in Italian, by their English text (ADR-0172), in the
 * order of the files that show them. To confirm with someone who speaks it
 * (docs/UI.md).
 */
export const IT: Table = {
  // src/about/AboutPage.tsx
  "Draft — not final yet.": "Bozza — non ancora definitiva.",
  "Last updated: {date}": "Ultimo aggiornamento: {date}",

  // src/account/fields.ts
  "You must be at least 16 to sign up.": "Per iscriverti devi avere almeno 16 anni.",
  "Enter the email of your account.": "Scrivi l'email del tuo account.",
  "Enter your password.": "Scrivi la password.",
  "A username is 3 to 20 letters, digits, _ or . (no spaces).":
    "Un nome utente ha da 3 a 20 fra lettere, cifre, _ o . (niente spazi).",
  "Enter an email address, like name@example.com.":
    "Scrivi un indirizzo email, come nome@example.com.",
  "A password is at least {min} characters.":
    "La password deve avere almeno {min} caratteri.",
  "A password is at most {max} characters.":
    "La password può avere al massimo {max} caratteri.",

  // src/account/messages.ts (TASK-256: words for whoever uses the phone)
  "The app cannot reach the service. Update the app.":
    "L'app non riesce a raggiungere il servizio. Aggiorna l'app.",
  "Your session has ended. Log in again.": "La sessione è scaduta. Accedi di nuovo.",
  "Something went wrong on our side. Try again in a moment.":
    "Qualcosa è andato storto da parte nostra. Riprova fra un momento.",
  "No connection. Check the network and try again.":
    "Nessuna connessione. Controlla la rete e riprova.",
  "This email already has an account. Log in instead.":
    "Questa email ha già un account. Accedi.",
  "This username is taken. Try another one.":
    "Questo nome utente è già preso. Provane un altro.",
  "Wrong email or password.": "Email o password sbagliate.",
  "Accounts are not available right now. Try again later.":
    "Gli account non sono disponibili adesso. Riprova più tardi.",
  "This version of the app is no longer allowed in. Update the app.":
    "Questa versione dell'app non può più entrare. Aggiorna l'app.",
  "Too many tries. Wait a minute and try again.":
    "Troppi tentativi. Aspetta un minuto e riprova.",
  "Too many tries. Wait {minutes} minutes and try again.":
    "Troppi tentativi. Aspetta {minutes} minuti e riprova.",

  // src/activities/ActivitiesList.tsx
  "{count} run is on this phone, waiting for a connection.":
    "{count} corsa è su questo telefono, in attesa di connessione.",
  "{count} runs are on this phone, waiting for a connection.":
    "{count} corse sono su questo telefono, in attesa di connessione.",
  "Loading…": "Caricamento…",
  "Show more": "Mostra altro",
  "Loading your activities…": "Carico le tue attività…",
  "Your activities could not load.": "Non è stato possibile caricare le tue attività.",
  "Try again": "Riprova",
  "No activities yet. Save a run when you finish it, and it is kept here.":
    "Ancora nessuna attività. Salva una corsa quando la finisci e la ritrovi qui.",
  "{when}, {where}, {facts}, public, open on the map":
    "{when}, {where}, {facts}, pubblica, apri sulla mappa",
  "{when}, {where}, {facts}, open on the map":
    "{when}, {where}, {facts}, apri sulla mappa",
  "Opening…": "Apertura…",
  Public: "Pubblica",
  "Delete this run? It cannot be undone.":
    "Eliminare questa corsa? Non si può annullare.",
  // «Keep it» answers two questions (a run, Strava): a word that fits both.
  "Keep it": "Annulla",
  "Delete run": "Elimina corsa",
  "Delete the run of {when}": "Elimina la corsa di {when}",
  Delete: "Elimina",
  // A run the API will not take (TASK-257).
  "The server could not take this run: {message}":
    "Il server non ha potuto accettare questa corsa: {message}",
  "Discard this run? It will not be saved.":
    "Scartare questa corsa? Non verrà salvata.",
  "Discard run": "Scarta corsa",
  "Send the run of {when} again": "Rimanda la corsa di {when}",
  "Discard the run of {when}": "Scarta la corsa di {when}",
  Discard: "Scarta",

  // src/activities/ActivityCard.tsx
  "Yellow: the route. White: what you ran.":
    "Giallo: il percorso. Bianco: quello che hai corso.",
  "White: what you ran.": "Bianco: quello che hai corso.",
  "Back to the list": "Torna all'elenco",

  // src/activities/activitiesDoor.ts
  "Sign up or log in to keep your runs and share them as drawings.":
    "Iscriviti o accedi per tenere le tue corse e condividerle come disegni.",
  "This run is no longer in your activities.":
    "Questa corsa non è più fra le tue attività.",

  // src/activities/activityText.ts
  Sun: "Dom",
  Mon: "Lun",
  Tue: "Mar",
  Wed: "Mer",
  Thu: "Gio",
  Fri: "Ven",
  Sat: "Sab",
  Jan: "gen",
  Feb: "feb",
  Mar: "mar",
  Apr: "apr",
  May: "mag",
  Jun: "giu",
  Jul: "lug",
  Aug: "ago",
  Sep: "set",
  Oct: "ott",
  Nov: "nov",
  Dec: "dic",
  "{weekday} {day} {month} {year}": "{weekday} {day} {month} {year}",
  Run: "Corsa",

  // src/activities/RunEnd.tsx
  "The phone holds {count} runs not sent yet. Discard one in My activities first.":
    "Sul telefono ci sono già {count} corse non ancora inviate. Prima scartane una in Le mie attività.",
  "The phone holds {count} runs not sent yet. They go when there is a connection; then save this one.":
    "Sul telefono ci sono già {count} corse non ancora inviate. Partono quando c'è connessione; poi salva questa.",

  // src/api/comments.ts
  "A comment needs some words.": "Un commento ha bisogno di qualche parola.",
  "A comment is at most {max} characters.":
    "Un commento può avere al massimo {max} caratteri.",
  "Too many comments in a minute. Wait a moment and try again.":
    "Troppi commenti in un minuto. Aspetta un momento e riprova.",
  "The comments of this drawing are not available.":
    "I commenti di questo disegno non sono disponibili.",

  // src/api/reactions.ts
  "At least 2 characters": "Almeno 2 caratteri",
  "Your reaction wasn't saved. Check the connection.":
    "La tua reazione non è stata salvata. Controlla la connessione.",

  // src/api/strava.ts
  "No connection. Try again when you are online.":
    "Nessuna connessione. Riprova quando sei online.",
  "Strava is taking no more runs for now. Try again later.":
    "Per ora Strava non accetta altre corse. Riprova più tardi.",
  "Strava could not read this run.": "Strava non è riuscito a leggere questa corsa.",
  "Strava is not connected. Connect it and try again.":
    "Strava non è collegato. Collegalo e riprova.",
  "Strava is not available on this API.": "Strava non è disponibile su questa API.",
  "Strava did not answer. Try again in a while.":
    "Strava non ha risposto. Riprova fra un po'.",

  // src/engine/OfflineMapsSetting.tsx
  "Offline maps: {size}": "Mappe offline: {size}",
  "Maps download on Wi-Fi and mobile data.":
    "Le mappe si scaricano con il Wi-Fi e con i dati mobili.",
  "Add a place": "Aggiungi un posto",
  "Preparing the map…": "Preparo la mappa…",
  "Trying again later": "Riprovo più tardi",
  "Up to {count} places.": "Fino a {count} posti.",
  "Places you add stay on the phone, so shapes there are drawn faster, even without signal.":
    "I posti che aggiungi restano sul telefono: lì le forme si disegnano più in fretta, anche senza segnale.",

  // src/engine/ZoneNotice.tsx
  "Downloading the maps of your area ({size}) so routes work without signal.":
    "Sto scaricando le mappe della tua zona ({size}) perché i percorsi funzionino anche senza segnale.",

  // src/engine/sizeText.ts
  "{size} MB": "{size} MB",
  "{size} GB": "{size} GB",

  // src/favorites/FavoriteHeart.tsx
  "Remove from favorites": "Togli dai preferiti",
  "Add to favorites": "Aggiungi ai preferiti",

  // src/favorites/FavoritesList.tsx
  "Kept {day} {month} {year}": "Salvato il {day} {month} {year}",
  "{title}, open on the map": "{title}, apri sulla mappa",
  "Remove {title} from favorites": "Togli {title} dai preferiti",
  "Loading your favorites…": "Carico i tuoi preferiti…",
  "Your favorites could not load.": "Non è stato possibile caricare i tuoi preferiti.",
  "No favorites yet. Tap {heart} on a route on the map to keep it here.":
    "Ancora nessun preferito. Tocca {heart} su un percorso sulla mappa per tenerlo qui.",

  // src/favorites/favoriteRoute.ts
  Route: "Percorso",

  // src/favorites/favoritesDoor.ts
  "Sign up or log in to keep your favorite routes.":
    "Iscriviti o accedi per tenere i tuoi percorsi preferiti.",

  // src/feed/FeedAd.tsx
  Sponsored: "Sponsorizzato",

  // src/feed/FeedPost.tsx
  "OpenFreeMap © OpenMapTiles\nData from OpenStreetMap":
    "OpenFreeMap © OpenMapTiles\nDati da OpenStreetMap",
  "{user} in {city}: {title}. {facts}.": "{user} a {city}: {title}. {facts}.",
  "Opens the route on the map": "Apre il percorso sulla mappa",

  // src/health/HealthRunEnd.tsx (TASK-321: Apple Health and Health Connect)
  "Save to Apple Health": "Salva in Apple Salute",
  "Save to Health Connect": "Salva in Health Connect",
  "Your activities also go to the Fitness app, with the route.":
    "Le tue attività vanno anche nell'app Fitness, con il percorso.",
  "Your activities also go to Health Connect, with the route.":
    "Le tue attività vanno anche in Health Connect, con il percorso.",
  "Also to Apple Health, with Save.": "Con Salva va anche in Apple Salute.",
  "Also to Health Connect, with Save.": "Con Salva va anche in Health Connect.",
  "MuW can't write to Apple Health. Allow it in the Health app: your profile › Apps › MuW.":
    "MuW non può scrivere in Apple Salute. Consentilo nell'app Salute: il tuo profilo › App › MuW.",
  "MuW can't write to Health Connect. Allow it in Health Connect › App permissions › MuW.":
    "MuW non può scrivere in Health Connect. Consentilo in Health Connect › Autorizzazioni app › MuW.",

  // src/i18n/shapeNames.ts
  Circle: "Cerchio",
  Heart: "Cuore",
  Star: "Stella",
  Horse: "Cavallo",
  Moon: "Luna",
  Cat: "Gatto",
  Fish: "Pesce",
  Butterfly: "Farfalla",
  Snail: "Lumaca",
  "Dog head": "Testa di cane",
  "Rabbit head": "Testa di coniglio",
  Pumpkin: "Zucca",
  "Christmas tree": "Albero di Natale",
  Smiley: "Faccina",
  Ghost: "Fantasmino",
  Donut: "Ciambella",
  "The sun": "Sole",

  // src/explore/NearbyTowns.tsx
  "NEARBY TOWNS": "PAESI VICINI",
  "{town}, {km} km away": "{town}, a {km} km",
  "{mi} mi away": "a {mi} mi",
  "{town}, {mi} mi away": "{town}, a {mi} mi",

  // src/explore/CityWords.tsx
  WORDS: "PAROLE",

  // src/intro/AppBoundary.tsx
  "Something went wrong.": "Qualcosa è andato storto.",

  // src/map/MapView.tsx
  "The map could not be loaded. Check the network.":
    "La mappa non si è caricata. Controlla la rete.",
  Retry: "Riprova",

  // src/map/NorthArrow.tsx
  "North arrow": "Freccia del nord",
  "Turns the map north up": "Mette il nord in alto",
  "Turns the map like the drawing": "Gira la mappa come il disegno",

  // src/map/MapKindButton.tsx
  "Map type": "Tipo di mappa",
  Standard: "Normale",
  Satellite: "Satellite",
  "3D": "3D",

  // src/paddle/PaddleExplore.tsx
  Next: "A seguire",
  "Drawing…": "Disegno in corso…",
  "Your start": "La tua partenza",
  "On the water": "Sull'acqua",
  "Shapes to paddle, within 1 km of the shore":
    "Forme da pagaiare, entro 1 km dalla riva",
  "LAKES AND SEA": "LAGHI E MARE",
  "Near me": "Vicino a me",
  "Choose a lake or a beach: eight shapes on its water, from the shore.":
    "Scegli un lago o una spiaggia: otto forme sulla sua acqua, partendo dalla riva.",
  "Choose a start in Draw first: the shapes start from the shore nearest to it.":
    "Prima scegli una partenza in Draw: le forme partono dalla riva più vicina.",
  "Near your start": "Vicino alla tua partenza",
  "{km} km away": "a {km} km",
  "Type a lake or a beach": "Scrivi un lago o una spiaggia",
  "No lake or beach matches “{typed}”.":
    "Nessun lago o spiaggia corrisponde a «{typed}».",
  "{shape}, {km} km, on the water": "{shape}, {km} km, sull'acqua",
  "{shape}, {mi} mi, on the water": "{shape}, {mi} mi, sull'acqua",
  "Not drawn": "Non disegnato",

  // src/paddle/placeSpots.ts
  "Lake, beach, city or street": "Lago, spiaggia, città o via",

  // src/paddle/PaddleNotice.tsx
  "Before you paddle": "Prima di andare in acqua",
  "Wear a life jacket.": "Indossa il giubbotto salvagente.",
  "Check the weather and the wind before you go out.":
    "Controlla il meteo e il vento prima di uscire.",
  "Follow the local rules: swimming areas, boat lanes, harbours. MuW does not know them.":
    "Rispetta le regole del posto: zone di balneazione, corridoi di lancio, porti. MuW non le conosce.",
  "The route stays within 1 km of the shore. That does not make it safe or allowed.":
    "Il percorso resta entro 1 km dalla riva. Questo non lo rende sicuro né permesso.",
  "I understand": "Ho capito",
  "Not now": "Non ora",

  // src/paddle/MoveShape.tsx, src/route/RoutePanel.tsx
  "Move the shape": "Sposta la forma",
  "Drag the shape where you want it, then let go.":
    "Trascina la forma dove la vuoi, poi lasciala.",
  "It stays on the water, off the shore, where it fits.":
    "Resta sull'acqua, lontana dalla riva, dove ci sta.",
  "The shape does not fit there: this is the nearest place.":
    "Lì la forma non ci sta: questo è il posto più vicino.",

  // src/paddle/waterPlaces.ts
  "from Riva del Garda": "da Riva del Garda",
  "from Como": "da Como",
  "from the beach": "dalla spiaggia",

  // src/places/PlaceSearch.tsx
  "City or street": "Città o via",
  Search: "Cerca",
  "Searching…": "Cerco…",
  "No place found. Try adding the city.":
    "Nessun luogo trovato. Prova ad aggiungere la città.",
  "The search failed. Check the connection and try again.":
    "La ricerca non è riuscita. Controlla la connessione e riprova.",
  "© OpenStreetMap contributors": "© contributori di OpenStreetMap",

  // src/profile/EditProfile.tsx
  USERNAME: "NOME UTENTE",
  "3 to 20 letters, digits, _ or .": "Da 3 a 20 fra lettere, cifre, _ o .",
  BIO: "BIO",
  "A few words about you": "Qualche parola su di te",
  "{length} of {max} characters": "{length} di {max} caratteri",
  "Saving…": "Salvataggio…",
  Save: "Salva",

  // src/profile/PhotoChoices.tsx
  "Removing…": "Rimozione…",
  "Choose a picture": "Scegli una foto",
  "Take a photo": "Scatta una foto",
  "Remove picture": "Togli la foto",

  // src/profile/PhotoRow.tsx
  "Profile picture": "Foto del profilo",

  // src/profile/ProfileHome.tsx
  "Edit profile": "Modifica profilo",
  Favorites: "Preferiti",
  "My activities": "Le mie attività",
  Settings: "Impostazioni",

  // src/settings/EmailSetting.tsx, PhoneSetting.tsx, contactFields.ts (TASK-183)
  "NEW EMAIL": "NUOVA EMAIL",
  "PHONE NUMBER": "NUMERO DI TELEFONO",
  Add: "Aggiungi",
  "Remove number": "Togli il numero",
  "Only you see your number. Friends who already have it will be able to find you on MuW.":
    "Il numero lo vedi solo tu. Gli amici che lo hanno già potranno trovarti su MuW.",
  "Changing the email is not available on this API yet.":
    "Su questa API non si può ancora cambiare l'email.",
  "The phone number is not available on this API yet.":
    "Su questa API il numero di telefono non c'è ancora.",
  "This is already the email of your account.": "È già l'email del tuo account.",
  "Write the number with its country code, like +39 333 123 4567.":
    "Scrivi il numero con il prefisso del paese, come +39 333 123 4567.",
  "Wrong password.": "Password sbagliata.",
  "Another account has this email.": "Un altro account ha questa email.",

  // src/screens/SignInScreen.tsx, ForgotPassword.tsx, src/settings/EmailConfirmation.tsx,
  // src/account/accountEmail.ts (TASK-300: the emails of the account)
  "Forgot password?": "Password dimenticata?",
  "Write the email of your account: we send it a link to choose a new password.":
    "Scrivi l'email del tuo account: le mandiamo un link per scegliere una nuova password.",
  "Send the link": "Manda il link",
  "If an account has this email, a link is on its way. It works for 1 hour; look in spam too.":
    "Se un account ha questa email, il link sta arrivando. Vale 1 ora; guarda anche nello spam.",
  "Back to Log in": "Torna ad Accedi",
  "Too many emails asked: wait a few minutes and try again.":
    "Troppe email chieste: aspetta qualche minuto e riprova.",
  "Email not confirmed": "Email non confermata",
  "Send the link again": "Manda di nuovo il link",
  "Send again": "Manda di nuovo",
  "Cancel change": "Annulla il cambio",
  "Link sent to {email}. Look in spam too.":
    "Link mandato a {email}. Guarda anche nello spam.",
  "We sent a link to {email}. Your email changes when you open it.":
    "Abbiamo mandato un link a {email}. La tua email cambia quando lo apri.",
  "Waiting for {email}: open the link we sent there.":
    "In attesa di {email}: apri il link che abbiamo mandato lì.",

  // src/settings/NotificationsSetting.tsx, notificationFields.ts
  "Notifications are not available on this API yet.":
    "Su questa API le notifiche non ci sono ancora.",

  // src/profile/SettingsPage.tsx
  "Change email": "Cambia email",
  "Phone number": "Numero di telefono",
  Units: "Unità di misura",
  NOTIFICATIONS: "NOTIFICHE",
  "Email notifications": "Notifiche email",
  "Push notifications": "Notifiche push",
  ABOUT: "INFORMAZIONI",
  Help: "Aiuto",
  Terms: "Termini",
  Privacy: "Privacy",
  ACCOUNT: "ACCOUNT",
  PREFERENCES: "PREFERENZE",
  "Log out": "Esci",
  "Delete your account? Everything that is yours goes with it, at once. It cannot be undone.":
    "Eliminare il tuo account? Tutto quello che è tuo viene eliminato con lui, subito. Non si può annullare.",
  "Deleting…": "Eliminazione…",
  "Delete my account": "Elimina il mio account",
  "Keep my account": "Tieni il mio account",
  "Delete account": "Elimina account",

  // src/profile/UserProfilePage.tsx
  "Log in to see the profiles of the others.":
    "Accedi per vedere i profili degli altri.",
  "This profile is not available.": "Questo profilo non è disponibile.",
  "{count} drawing": "{count} disegno",
  "{count} drawings": "{count} disegni",
  "Loading the profile…": "Carico il profilo…",
  "{count} follower": "{count} follower",
  "{count} followers": "{count} follower",
  "{count} following": "segue {count}",

  // src/profile/profileFields.ts
  "Editing the profile is not available on this API yet.":
    "Su questa API non si può ancora modificare il profilo.",
  "A bio is at most {max} characters.": "La bio può avere al massimo {max} caratteri.",

  // src/profile/useProfilePhoto.ts
  "The camera is off for this app. Allow it in Settings, or choose a picture instead.":
    "Questa app non ha accesso alla fotocamera. Consentilo nelle Impostazioni, oppure scegli una foto.",
  "This picture is too large. Choose a smaller one.":
    "Questa foto è troppo grande. Scegline una più piccola.",
  "Could not open the picture. Try again.": "Impossibile aprire la foto. Riprova.",
  "This picture cannot be used. Choose another one.":
    "Questa foto non si può usare. Scegline un'altra.",
  "Profile pictures are not available on this API yet.":
    "Su questa API le foto del profilo non ci sono ancora.",

  // src/route/RoutePanel.tsx
  "{letters} km of letters + {between} km riding between them":
    "{letters} km di lettere + {between} km in bici fra una lettera e l'altra",
  "{drawn} km of drawing + {between} km walking between the parts":
    "{drawn} km di disegno + {between} km a piedi fra una parte e l'altra",
  "{drawn} km of drawing + {between} km riding between the parts":
    "{drawn} km di disegno + {between} km in bici fra una parte e l'altra",
  "{drawn} km of drawing + {between} km paddling between the parts":
    "{drawn} km di disegno + {between} km pagaiando fra una parte e l'altra",
  "On the water, a shape of the catalogue.": "Sull'acqua, una forma del catalogo.",
  "{name} · on the water · target {km} km": "{name} · sull'acqua · obiettivo {km} km",
  "{name} · on roads · target {km} km": "{name} · su strada · obiettivo {km} km",
  // «Draw» with «Miles» (TASK-182 part B): src/route/RoutePanel.tsx,
  // DistanceStepper.tsx, wordInput.ts
  "Distance in miles": "Distanza in miglia",
  "Enter a distance between {lowest} and {highest} mi.":
    "Inserisci una distanza fra {lowest} e {highest} mi.",
  "{count} letter: at least {mi} mi. A word takes a few minutes to draw.":
    "{count} lettera: almeno {mi} mi. Per disegnare una parola servono alcuni minuti.",
  "{count} letters: at least {mi} mi. A word takes a few minutes to draw.":
    "{count} lettere: almeno {mi} mi. Per disegnare una parola servono alcuni minuti.",
  "Use {mi} mi": "Usa {mi} mi",
  "{letters} mi of letters + {between} mi riding between them":
    "{letters} mi di lettere + {between} mi in bici fra una lettera e l'altra",
  "{letters} mi of letters + {between} mi walking between them":
    "{letters} mi di lettere + {between} mi a piedi fra una lettera e l'altra",
  "{drawn} mi of drawing + {between} mi walking between the parts":
    "{drawn} mi di disegno + {between} mi a piedi fra una parte e l'altra",
  "{drawn} mi of drawing + {between} mi riding between the parts":
    "{drawn} mi di disegno + {between} mi in bici fra una parte e l'altra",
  "{drawn} mi of drawing + {between} mi paddling between the parts":
    "{drawn} mi di disegno + {between} mi pagaiando fra una parte e l'altra",
  "{name} · on the water · target {mi} mi": "{name} · sull'acqua · obiettivo {mi} mi",
  "{name} · on roads · target {mi} mi": "{name} · su strada · obiettivo {mi} mi",
  "Drawing the picture's outline, {mi} mi…": "Disegno il contorno della foto, {mi} mi…",
  "Drawing “{word}”, {mi} mi…": "Disegno «{word}», {mi} mi…",
  "Drawing a {mi} mi {name}…": "Disegno: {name}, {mi} mi…",
  "At most {most} letters: each needs {each} mi, and the app goes up to {highest} mi.":
    "Al massimo {most} lettere: a ognuna servono {each} mi, e l'app arriva a {highest} mi.",
  "“{word}” needs at least {mi} mi: {each} mi for each letter.":
    "A «{word}» servono almeno {mi} mi: {each} mi per ogni lettera.",

  // src/route/betterDistance.ts
  "This shape comes out better at about {km} km.":
    "Questa forma viene meglio a circa {km} km.",
  "This word comes out better at about {km} km.":
    "Questa parola viene meglio a circa {km} km.",
  "This outline comes out better at about {km} km.":
    "Questo contorno viene meglio a circa {km} km.",
  "Try {km} km": "Prova {km} km",
  "This shape comes out better at about {mi} mi.":
    "Questa forma viene meglio a circa {mi} mi.",
  "This word comes out better at about {mi} mi.":
    "Questa parola viene meglio a circa {mi} mi.",
  "This outline comes out better at about {mi} mi.":
    "Questo contorno viene meglio a circa {mi} mi.",
  "Try {mi} mi": "Prova {mi} mi",

  // src/route/problems.ts
  "The route could not be drawn. Try again, or try another start.":
    "Il percorso non si è potuto disegnare. Riprova, o prova un'altra partenza.",
  "This word cannot be read right now. Try one of these: {list}.":
    "Questa parola non si può leggere adesso. Prova una di queste: {list}.",
  "Drawing this route is taking too long. Try again later, or a shorter distance.":
    "Disegnare questo percorso sta richiedendo troppo tempo. Riprova più tardi, o con una distanza più corta.",
  "This request was lost. Try again.": "Questa richiesta è andata persa. Riprova.",
  "There is no lake or sea near this start. Start from the shore, within 2 km of the water.":
    "Non c'è un lago o il mare vicino a questa partenza. Parti dalla riva, entro 2 km dall'acqua.",
  "This shape does not fit on the water here at this distance. It fits at about {km} km.":
    "Qui questa forma non sta sull'acqua a questa distanza. Ci sta a circa {km} km.",
  "This shape does not fit on the water here. Try a shorter distance, another shape, or another start:":
    "Qui questa forma non sta sull'acqua. Prova una distanza più corta, un'altra forma o un'altra partenza:",
  "This shape does not fit the roads here at this distance. It fits at about {mi} mi.":
    "Qui questa forma non sta sulle strade a questa distanza. Ci sta a circa {mi} mi.",
  "This word does not fit the roads here at this distance. It fits at about {mi} mi.":
    "Qui questa parola non sta sulle strade a questa distanza. Ci sta a circa {mi} mi.",
  "This image does not fit the roads here at this distance. It fits at about {mi} mi.":
    "Qui questa immagine non sta sulle strade a questa distanza. Ci sta a circa {mi} mi.",
  "There is no lake or sea near this start. Start from the shore, within 1 mile of the water.":
    "Non c'è un lago o il mare vicino a questa partenza. Parti dalla riva, entro 1 miglio dall'acqua.",
  "This shape does not fit on the water here at this distance. It fits at about {mi} mi.":
    "Qui questa forma non sta sull'acqua a questa distanza. Ci sta a circa {mi} mi.",

  // src/route/warnings.ts
  "Includes {distance} walking the bike.": "Di cui {distance} con la bici a mano.",

  // src/route/RoutePanel.tsx (TASK-210, «Draw»)
  Shape: "Forma",
  Word: "Parola",
  Image: "Immagine",
  Round: "Tonde",
  Square: "Quadrate",
  DRAW: "DISEGNA",
  LETTERS: "LETTERE",
  DISTANCE: "DISTANZA",
  "heart, star, horse…": "cuore, stella, cavallo…",
  "Lift the pen between parts": "Alza la penna fra le parti",
  "Lift the pen between letters": "Alza la penna fra le lettere",
  "Square letters follow the street grid: best for short words.":
    "Le lettere quadrate seguono la griglia delle strade: meglio per parole corte.",
  "Enter a distance between {lowest} and {highest} km.":
    "Inserisci una distanza fra {lowest} e {highest} km.",
  "Long routes take longer: up to a few minutes.":
    "I percorsi lunghi richiedono più tempo: fino a qualche minuto.",
  "Draw route": "Disegna il percorso",
  Start: "Parti",
  "Preparing GPX…": "Preparo il GPX…",
  "Export GPX": "Esporta GPX",
  "{letters} km of letters + {between} km walking between them":
    "{letters} km di lettere + {between} km a piedi fra una lettera e l'altra",
  "Press Done and the AI will read it.": "Premi Fine e l'AI lo leggerà.",
  "The AI is reading it…": "L'AI lo sta leggendo…",
  "No shape in the catalogue for “{text}”. Describe what it looks like (“prancing horse”, not “Ferrari badge”), or pick one:":
    "Nessuna forma del catalogo per «{text}». Descrivi com'è fatta («cavallo rampante», non «stemma Ferrari»), o scegline una:",
  "Unknown shape. Try: {list}.": "Forma sconosciuta. Prova: {list}.",
  "{count} letter: at least {km} km. A word takes a few minutes to draw.":
    "{count} lettera: almeno {km} km. Per disegnare una parola servono alcuni minuti.",
  "{count} letters: at least {km} km. A word takes a few minutes to draw.":
    "{count} lettere: almeno {km} km. Per disegnare una parola servono alcuni minuti.",
  "Use {km} km": "Usa {km} km",
  Picture: "Foto",
  "Downloading map data for this area…": "Scarico la mappa di questa zona…",
  "Drawing the picture's outline, {km} km…": "Disegno il contorno della foto, {km} km…",
  "Drawing “{word}”, {km} km…": "Disegno «{word}», {km} km…",
  "Drawing a {km} km {name}…": "Disegno: {name}, {km} km…",

  // src/route/problems.ts (TASK-210, «Draw»)
  "This shape does not fit the roads here at this distance. It fits at about {km} km.":
    "Qui questa forma non sta sulle strade a questa distanza. Ci sta a circa {km} km.",
  "This word does not fit the roads here at this distance. It fits at about {km} km.":
    "Qui questa parola non sta sulle strade a questa distanza. Ci sta a circa {km} km.",
  "This image does not fit the roads here at this distance. It fits at about {km} km.":
    "Qui questa immagine non sta sulle strade a questa distanza. Ci sta a circa {km} km.",
  "This word does not fit the roads here. Try a shorter word, or another start.":
    "Qui questa parola non sta sulle strade. Prova una parola più corta, o un'altra partenza.",
  "This outline does not fit the roads here. Try another distance, another start, or a simpler picture.":
    "Qui questo contorno non sta sulle strade. Prova un'altra distanza, un'altra partenza o una foto più semplice.",
  "This shape does not fit the roads here. Try another shape, or another start:":
    "Qui questa forma non sta sulle strade. Prova un'altra forma, o un'altra partenza:",
  "Map data for this area could not be downloaded. Try again later.":
    "Non si è potuta scaricare la mappa di questa zona. Riprova più tardi.",
  "The route engine cannot find one clear outline in this picture.":
    "In questa foto non si trova un contorno chiaro.",
  "Only PNG and JPEG pictures work. Choose another one.":
    "Vanno bene solo foto PNG e JPEG. Scegline un'altra.",
  "This picture could not be read. Choose another one.":
    "Questa foto non si è potuta leggere. Scegline un'altra.",
  "The background is too busy. Use one subject on a plain background, like a drawing on white paper or an object on a bare table.":
    "Lo sfondo è troppo pieno. Usa un solo soggetto su uno sfondo uniforme, come un disegno su un foglio bianco o un oggetto su un tavolo vuoto.",
  "Nothing stands out from the background. Use a subject much darker or brighter than what is around it.":
    "Niente spicca sullo sfondo. Usa un soggetto molto più scuro o più chiaro di ciò che ha intorno.",
  "The picture shows more than 4 separate things. Use a picture with 4 subjects at most.":
    "La foto mostra più di 4 cose separate. Usa una foto con al massimo 4 soggetti.",
  "The subject touches the edge of the picture. Leave some background all around it.":
    "Il soggetto tocca il bordo della foto. Lascia un po' di sfondo tutt'intorno.",
  "The subject is too small. Get closer, or use a bigger picture.":
    "Il soggetto è troppo piccolo. Avvicinati, o usa una foto più grande.",
  "The outline is too jagged to run on roads. Try a simpler subject.":
    "Il contorno è troppo frastagliato per correrlo sulle strade. Prova un soggetto più semplice.",
  "This line cannot be added to the outline. Draw it again.":
    "Questa linea non si può aggiungere al contorno. Disegnala di nuovo.",
  "This line is too short to add. Draw a longer one.":
    "Questa linea è troppo corta per aggiungerla. Disegnane una più lunga.",
  "This part covers where a detail starts. Undo the detail first, or draw the part elsewhere.":
    "Questa parte copre il punto da cui parte un dettaglio. Prima annulla il dettaglio, o disegna la parte altrove.",
  "That is too much for one route. Undo something, or draw simpler lines.":
    "È troppo per un solo percorso. Annulla qualcosa, o disegna linee più semplici.",
  "Too many requests to the API in the last minute. Wait a minute, then try again.":
    "Troppe richieste nell'ultimo minuto. Aspetta un minuto, poi riprova.",
  "This phone cannot open the share sheet.":
    "Questo telefono non può aprire il foglio di condivisione.",
  "The GPX could not be saved on the phone. Try again.":
    "Il GPX non si è potuto salvare sul telefono. Riprova.",
  "This picture is too large: {mb} MB, at most {most} MB. Choose a smaller one.":
    "Questa foto è troppo grande: {mb} MB, al massimo {most} MB. Scegline una più piccola.",
  "The picture could not be opened. Try again, or choose another one.":
    "La foto non si è potuta aprire. Riprova, o scegline un'altra.",

  // src/route/warnings.ts (TASK-210, «Draw»; the direction is the compass word)
  "The route starts {distance} {direction} of your start, where the shape fits the roads. Go to “Start here”.":
    "Il percorso parte {distance} a {direction} dalla tua partenza, dove la forma sta sulle strade. Vai a «Parti da qui».",
  "There are {distance} of steps along the way.":
    "Lungo la strada ci sono {distance} di scale.",
  "{distance} runs along main roads, with traffic.":
    "{distance} corrono su strade principali, con traffico.",
  "{distance} runs through tunnels.": "{distance} passano in galleria.",
  "About {share}% of the route goes over the same roads twice.":
    "Circa il {share}% del percorso passa due volte sulle stesse strade.",
  "About {share}% of the route runs alongside itself.":
    "Circa il {share}% del percorso corre affiancato a se stesso.",
  "The route is {share}% longer than asked.":
    "Il percorso è più lungo del {share}% rispetto a quanto chiesto.",
  "The route is {share}% shorter than asked.":
    "Il percorso è più corto del {share}% rispetto a quanto chiesto.",
  "The roads here follow the shape only roughly.":
    "Qui le strade seguono la forma solo all'incirca.",
  "Few roads here: the route follows the shape loosely.":
    "Poche strade qui: il percorso segue la forma alla larga.",
  "The nearest road is {distance} away: the route begins there.":
    "La strada più vicina è a {distance}: il percorso comincia lì.",
  "A bit of the shape has no road to follow, so the route skips it.":
    "Un pezzo della forma non ha strade da seguire, e il percorso lo salta.",

  // src/route/wordInput.ts (TASK-210, «Draw»)
  "Write a word to draw, with the letters A to Z.":
    "Scrivi una parola da disegnare, con le lettere dalla A alla Z.",
  "One word only, without spaces.": "Una parola sola, senza spazi.",
  "No letter “{letter}”: a word can use only the letters A to Z, without accents.":
    "Niente «{letter}»: una parola può usare solo le lettere dalla A alla Z, senza accenti.",
  "At most {most} letters.": "Al massimo {most} lettere.",
  "At most {most} letters: each needs {each} km, and the app goes up to {highest} km.":
    "Al massimo {most} lettere: a ognuna servono {each} km, e l'app arriva a {highest} km.",
  "“{word}” needs at least {km} km: {each} km for each letter.":
    "A «{word}» servono almeno {km} km: {each} km per ogni lettera.",

  // src/route/ImageChoice.tsx (TASK-210, «Draw»)
  "Choose another": "Scegline un'altra",
  "Choose picture": "Scegli una foto",
  "Take photo": "Scatta una foto",
  "Hide the picture": "Nascondi la foto",
  "Show the picture": "Mostra la foto",
  "Edit the outline": "Modifica il contorno",
  "One subject on a plain background works best: a drawing, a logo, an object on a bare table. The route follows its outside line. Up to 4 separate subjects are joined in one line.":
    "Funziona meglio un solo soggetto su uno sfondo uniforme: un disegno, un logo, un oggetto su un tavolo vuoto. Il percorso ne segue la linea esterna. Fino a 4 soggetti separati vengono uniti in una linea sola.",
  "Tracing the outline…": "Traccio il contorno…",
  "The yellow line is what the route will draw. If it does not look like the subject, the route will not either: try another picture, or edit the outline. Separate subjects are joined by a short line, which the route runs there and back.":
    "La linea gialla è quello che il percorso disegnerà. Se non somiglia al soggetto, nemmeno il percorso gli somiglierà: prova un'altra foto, o modifica il contorno. I soggetti separati sono uniti da una linea corta, che il percorso fa all'andata e al ritorno.",

  // src/route/OutlineBoard.tsx (TASK-210, «Draw»)
  "Add a part": "Aggiungi una parte",
  "Add a detail": "Aggiungi un dettaglio",
  "Choose what to add. Two fingers zoom and move the picture.":
    "Scegli cosa aggiungere. Con due dita ingrandisci e sposti la foto.",
  "Draw a closed shape. Across the yellow line it becomes part of the outline; anywhere else it is joined to the nearest yellow line.":
    "Disegna una forma chiusa. Sopra la linea gialla diventa parte del contorno; altrove viene unita alla linea gialla più vicina.",
  "Draw a line anywhere: it is joined to the nearest yellow line, and the route runs along it and back. Close a loop to make an eye.":
    "Disegna una linea dove vuoi: viene unita alla linea gialla più vicina, e il percorso la fa all'andata e al ritorno. Chiudi un anello per fare un occhio.",
  Fit: "Adatta",
  "Adding the part…": "Aggiungo la parte…",
  "Adding the detail…": "Aggiungo il dettaglio…",
  Undo: "Annulla",

  // src/route/LoadingBar.tsx (TASK-210, «Draw»: what a screen reader hears)
  "Still waiting": "Ancora in attesa",
  "Drawing the route": "Disegno del percorso",
  "Reading the shape": "Lettura della forma",
  "Loading the map": "Caricamento della mappa",

  // src/route/DistanceStepper.tsx (TASK-210, «Draw»)
  "Distance in km": "Distanza in km",
  Shorter: "Più corta",
  Longer: "Più lunga",

  // src/route/RouteTiles.tsx, ImagePreview.tsx (TASK-210, «Draw»: what a screen reader hears)
  "Route {label}, {distance}, {likeness} like the shape":
    "Percorso {label}, {distance}, somiglia alla forma al {likeness}",
  "The outline traced from the picture": "Il contorno ricavato dalla foto",

  // src/screens/PeopleScreen.tsx
  "Find friends": "Trova amici",

  // src/screens/ProfileLayer.tsx
  "Profile, log in again": "Profilo, accedi di nuovo",
  "Profile, {count} follow request": "Profilo, {count} richiesta di seguirti",
  "Profile, {count} follow requests": "Profilo, {count} richieste di seguirti",
  Profile: "Profilo",

  // src/screens/ProfileScreen.tsx
  "Your account and everything that was yours have been deleted.":
    "Il tuo account e tutto quello che era tuo sono stati eliminati.",
  "You are logged out on this phone.": "Hai chiuso la sessione su questo telefono.",
  Back: "Indietro",

  // src/screens/RunDashboard.tsx
  Speed: "Velocità",
  "Kilometre {km}: {speed} km/h": "Chilometro {km}: {speed} km/h",
  Mi: "Mi",
  miles: "miglia",
  "Your first mile will show here.": "Il tuo primo miglio apparirà qui.",
  "Mile {mile}: {pace}": "Miglio {mile}: {pace}",
  "Mile {mile}: {speed} mph": "Miglio {mile}: {speed} mph",
  "Your first 500 metres will show here.": "I tuoi primi 500 metri appariranno qui.",
  "{metres} metres: {pace}": "{metres} metri: {pace}",

  // src/screens/RunPanel.tsx
  "Speed now": "Vel. ora",
  "Avg speed": "Vel. media",
  "Last km": "Ultimo km",
  "Last mi": "Ultimo mi",
  "Avg /500 m": "Med. /500 m",
  "Last 500 m": "Ultimi 500 m",

  // src/screens/SignInScreen.tsx
  "Sign up": "Iscriviti",
  "Log in": "Accedi",
  EMAIL: "EMAIL",
  "name@example.com": "nome@example.com",
  PASSWORD: "PASSWORD",
  "At least 8 characters": "Almeno 8 caratteri",
  "I am at least 16": "Ho almeno 16 anni",
  "Signing up…": "Iscrizione…",
  "Logging in…": "Accesso…",

  // src/settings/LanguageSetting.tsx
  Language: "Lingua",
  "Phone language": "Lingua del telefono",

  // src/settings/UnitsSetting.tsx
  Kilometres: "Chilometri",
  Miles: "Miglia",
  "Phone units": "Unità del telefono",

  // src/settings/ToneSetting.tsx
  Tone: "Tono",
  Dark: "Scuro",
  Light: "Chiaro",
  Brightness: "Luminosità",
  "Brightness {step} of {count}": "Luminosità {step} di {count}",
  Darker: "Più scuro",
  Brighter: "Più chiaro",
  "Preview of the tone": "Anteprima del tono",
  Apply: "Applica",
  "MuW opens again in the new tone.": "MuW si riapre con il nuovo tono.",
  "The phone did not keep the tone. Try again.":
    "Il telefono non ha salvato il tono. Riprova.",
  "Close MuW and open it again to see the new tone.":
    "Chiudi MuW e riaprila per vedere il nuovo tono.",

  // src/settings/sport.ts
  "Ride without a route": "Pedala senza percorso",
  "Paddle without a route": "Pagaia senza percorso",
  "Run without a route": "Corri senza percorso",

  // src/share/PostImage.tsx
  "Drag it to move it. Tap it to take it off.":
    "Trascinala per spostarla. Toccala per toglierla.",

  // src/share/SharePost.tsx
  "Share your run": "Condividi la corsa",
  "Drag the emoji to move them. Tap one to take it off.":
    "Trascina le emoji per spostarle. Toccane una per toglierla.",
  Results: "Risultati",
  "Add emoji": "Aggiungi emoji",
  "Add {emoji}": "Aggiungi {emoji}",
  "Up to {count} emoji: tap one on the post to take it off.":
    "Al massimo {count} emoji: toccane una sul post per toglierla.",
  "Making the picture…": "Preparo l'immagine…",
  "Pick Instagram in the list: Story, Feed or Messages.":
    "Scegli Instagram nell'elenco: Storia, Feed o Messaggi.",
  Share: "Condividi",

  // src/share/StravaPostRow.tsx
  "To send this post to Strava, save the run, then share it from «My activities».":
    "Per mandare questo post a Strava, salva la corsa e poi condividila da «Le mie attività».",
  "Update on Strava": "Aggiorna su Strava",
  "The activity on Strava has this post's text now.":
    "Ora l'attività su Strava ha il testo di questo post.",
  "Strava did not let MuW change this activity. Change its text on Strava.":
    "Strava non ha permesso a MuW di cambiare questa attività. Cambia il testo su Strava.",
  "Strava takes no pictures from other apps: keep this one in Photos with «Save Image» and add it there.":
    "Strava non accetta immagini da altre app: tieni questa in Foto con «Salva immagine» e aggiungila lì.",

  // src/share/postRun.ts
  Distance: "Distanza",
  Time: "Tempo",
  Pace: "Passo",

  // src/share/sharePicture.ts
  "The picture could not be made. Try again.":
    "Non è stato possibile creare l'immagine. Riprova.",

  // src/social/DrawingCard.tsx
  "Back to the profile": "Torna al profilo",

  // src/social/DrawingComments.tsx
  "Opens the comments of this drawing.": "Apre i commenti di questo disegno.",
  Comments: "Commenti",
  "Delete this comment?": "Eliminare questo commento?",
  Cancel: "Annulla",
  "Close the comments": "Chiudi i commenti",
  Close: "Chiudi",
  "Add a comment…": "Aggiungi un commento…",
  Comment: "Commento",
  Post: "Pubblica",
  "{count} of {max} characters": "{count} di {max} caratteri",
  "Loading the comments…": "Carico i commenti…",
  "No comments yet. Be the first.": "Ancora nessun commento. Scrivi il primo.",
  "Show more comments": "Mostra altri commenti",
  "{name}, {ago}: {text}": "{name}, {ago}: {text}",
  "Touch and hold to delete.": "Tieni premuto per eliminare.",

  // src/social/DrawingReactions.tsx
  React: "Reagisci",
  "Your reaction: {name}": "La tua reazione: {name}",
  "{count} reaction": "{count} reazione",
  "{count} reactions": "{count} reazioni",

  // src/social/DrawingsGrid.tsx
  Drawings: "Disegni",
  "No public drawings yet. Make a run public in My activities.":
    "Ancora nessun disegno pubblico. Rendi pubblica una corsa in Le mie attività.",
  "No drawings yet.": "Ancora nessun disegno.",

  // src/profile/ProfileStats.tsx, src/profile/ProfileGallery.tsx (TASK-324)
  Likes: "Mi piace",
  Photos: "Foto",
  "No photos yet.": "Ancora nessuna foto.",
  "No photos yet. Add some to a public drawing in My activities.":
    "Ancora nessuna foto. Aggiungine a un disegno pubblico in Le mie attività.",

  // src/social/SuperLikeSheet.tsx
  "Super like": "Super like",
  "Write a comment to send your super like":
    "Scrivi un commento per inviare il tuo super like",
  Send: "Invia",

  // src/social/reactionKinds.ts
  "MuW heart, super like": "Cuore di MuW, super like",
  Fire: "Fuoco",
  Clap: "Applauso",
  Strong: "Forza",
  Laugh: "Risata",
  Wow: "Wow",

  // src/social/commentText.ts
  "You can't write negative comments in this app. Try another app.":
    "In questa app non puoi scrivere commenti negativi, cambia app.",
  "just now": "adesso",
  "{count} min ago": "{count} min fa",
  "{count} h ago": "{count} h fa",
  "{count} d ago": "{count} g fa",
  "Write a comment": "Scrivi un commento",
  "{count} comment": "{count} commento",
  "{count} comments": "{count} commenti",

  // src/social/drawingsDoor.ts
  "This drawing is no longer public.": "Questo disegno non è più pubblico.",

  // src/social/FollowButton.tsx
  "Stop following {name}?": "Smettere di seguire {name}?",
  Unfollow: "Non seguire più",
  "Takes your request back.": "Ritira la tua richiesta.",
  Follow: "Segui",
  Requested: "Richiesta inviata",
  Following: "Segui già",

  // src/social/FollowLists.tsx
  Requests: "Richieste",
  Followers: "Follower",
  "Nobody is asking to follow you.": "Nessuno chiede di seguirti.",
  "Nobody follows you yet.": "Ancora nessuno ti segue.",
  "You are not following anyone yet. Find friends from Feed.":
    "Non segui ancora nessuno. Trova amici da Feed.",
  Accept: "Accetta",
  "Accept {name}": "Accetta {name}",
  Decline: "Rifiuta",
  "Decline {name}": "Rifiuta {name}",
  "Follow back": "Segui anche tu",
  "Follow {name} back": "Segui anche tu {name}",
  Remove: "Togli",
  "Remove {name}": "Togli {name}",
  "Remove {name} from your followers?": "Togliere {name} dai tuoi follower?",

  // src/social/PeopleSearch.tsx
  "Log in to find your friends.": "Accedi per trovare i tuoi amici.",
  "This server cannot look for members yet.":
    "Questo server non sa ancora cercare gli iscritti.",
  Name: "Nome",
  "Type at least 2 letters of a name.": "Scrivi almeno 2 lettere di un nome.",
  "Nobody has a name like that.": "Nessuno ha un nome così.",

  // src/strava/StravaActivityRow.tsx
  "Sending to Strava…": "Invio a Strava…",
  "View on Strava": "Visualizza su Strava",
  "This run is on Strava.": "Questa corsa è su Strava.",
  "Strava is still reading this run.": "Strava sta ancora leggendo questa corsa.",
  "Check again": "Controlla di nuovo",
  "Send to Strava": "Invia a Strava",

  // src/strava/StravaParts.tsx
  "Opening Strava…": "Apro Strava…",
  "Connect with Strava": "Connetti con Strava",
  On: "Sì",
  Off: "No",
  "Name on Strava": "Nome su Strava",
  "Leave empty for an automatic name": "Lascia vuoto per un nome automatico",

  // src/strava/StravaRunEnd.tsx
  "Connect Strava, and Save sends your runs there too.":
    "Collega Strava: con Salva le tue corse andranno anche lì.",
  "To {athlete}'s Strava, with Save.": "Con Salva va anche sullo Strava di {athlete}.",

  // src/strava/StravaSetting.tsx
  "Strava, connected": "Strava, collegato",
  "Strava, connected as {athlete}": "Strava, collegato come {athlete}",
  Connected: "Collegato",
  "Connected as {athlete}": "Collegato come {athlete}",
  "Disconnect Strava? Runs already sent stay on Strava.":
    "Scollegare Strava? Le corse già inviate restano su Strava.",
  Disconnect: "Scollega",
  "Disconnecting…": "Scollegamento…",
  "Disconnect Strava": "Scollega Strava",
  "Send the runs you save in MuW to your Strava profile.":
    "Invia al tuo profilo Strava le corse che salvi in MuW.",

  // src/strava/useStrava.ts
  "Could not open Strava. Try again.": "Impossibile aprire Strava. Riprova.",

  // The run: src/screens/{NavigateScreen,FreeRunScreen,RunDashboard,RunPanel,
  // FinishScreen,Countdown,HoldButton,PocketScreen,MapScreen}.tsx and
  // src/navigation/runStats.ts (TASK-210, la corsa)
  "Finding your position…": "Cerco la tua posizione…",
  "You have arrived.": "Hai raggiunto l'arrivo.",
  "Off the route": "Fuori percorso",
  "Head back to the yellow line.": "Torna sulla linea gialla.",
  "Follow the route to the end.": "Segui il percorso fino alla fine.",
  "Then {directions}": "Poi {directions}",
  "Heading {direction}": "Direzione {direction}",
  north: "nord",
  "north-east": "nord-est",
  east: "est",
  "south-east": "sud-est",
  south: "sud",
  "south-west": "sud-ovest",
  west: "ovest",
  "north-west": "nord-ovest",
  "You are at your start": "Sei alla partenza",
  "Your start: {distance} in a straight line, to the {direction}":
    "La tua partenza: {distance} in linea retta, verso {direction}",
  "Your start, in a straight line": "La tua partenza, in linea retta",
  "Your run": "La tua corsa",
  "Distance: {distance}": "Distanza: {distance}",
  "Distance: {distance} {units}": "Distanza: {distance} {units}",
  "Keep running": "Continua a correre",
  "Remember to stretch": "Ricordati di fare stretching",
  Stretch: "Stretching",
  Skip: "Salta",
  Done: "Fatto",
  "Pocket mode": "Modalità tasca",
  Pocket: "Tasca",
  Finish: "Fine",
  Stop: "Stop",
  "Paused: you stopped moving": "In pausa: ti sei fermato",
  Paused: "In pausa",
  Resume: "Riprendi",
  Pause: "Pausa",
  Music: "Musica",
  "Opens Spotify": "Apre Spotify",
  Map: "Mappa",
  Data: "Dati",
  "Auto-pause": "Pausa automatica",
  Voice: "Voce",
  "Kilometre {km}: {pace}": "Chilometro {km}: {pace}",
  Km: "Km",
  Change: "Differenza",
  "Your first kilometre will show here.": "Il tuo primo chilometro apparirà qui.",
  "Pace now": "Passo ora",
  "Avg pace": "Passo medio",
  "Elev. gain": "Dislivello",
  Calories: "Calorie",
  "{minutes} min": "{minutes} min",
  "{hours} h {minutes} min": "{hours} h {minutes} min",
  "about {minutes} min": "circa {minutes} min",
  "about {hours} h {minutes} min": "circa {hours} h {minutes} min",
  "Starting in {number}": "Partenza fra {number}",
  "Get ready": "Preparati",
  "Hold to end the run": "Tieni premuto per terminare la corsa",
  "Hold to stop": "Tieni premuto per fermare",
  "The screen goes dark but stays on, so directions go on. Do not lock the phone: if you press the side button, directions stop. To come back, hold the screen for 2 seconds.":
    "Lo schermo diventa nero ma resta acceso, così le indicazioni continuano. Non bloccare il telefono: se premi il tasto laterale, le indicazioni si fermano. Per tornare, tieni premuto lo schermo per 2 secondi.",
  "Go dark": "Schermo nero",
  "Pocket mode. Hold for 2 seconds to leave.":
    "Modalità tasca. Tieni premuto 2 secondi per uscire.",
  "Keep holding…": "Continua a tenere premuto…",
  "Hold for 2 seconds to leave pocket mode":
    "Tieni premuto 2 secondi per uscire dalla modalità tasca",
  // src/permissions/OpenSettings.tsx, src/location/LocationOff.tsx (TASK-259)
  "Open Settings": "Apri Impostazioni",
  "Location is off": "Posizione disattivata",
  "Allow it for MuW in Settings to follow the route.":
    "Consentila a MuW nelle Impostazioni per seguire il percorso.",
  "Allow it for MuW in Settings to record your track.":
    "Consentila a MuW nelle Impostazioni per registrare la traccia.",
  // src/activities/RunEnd.tsx, src/social/PublicParts.tsx, PublicRow.tsx,
  // DrawingCard.tsx (TASK-208)
  "This run could not be kept on the phone. Try again.":
    "Questa corsa non si è potuta tenere sul telefono. Riprova.",
  "Save to My activities": "Salva in Le mie attività",
  Tagged: "Taggati",
  "{name}'s profile": "Profilo di {name}",
  "Photo {n}": "Foto {n}",
  "Photos of a run only you can see stay on this phone. Delete the app or change phone and they are gone.":
    "Le foto di una corsa che vedi solo tu restano su questo telefono. Se cancelli l'app o cambi telefono, si perdono.",
  "Its photos leave MuW and stay only on this phone.":
    "Le sue foto lasciano MuW e restano solo su questo telefono.",
  "Every member sees it in your profile, without the first and last 200 m.":
    "Ogni iscritto la vede nel tuo profilo, senza i primi e gli ultimi 200 m.",
  "Your followers see it in your profile, without the first and last 200 m.":
    "I tuoi follower la vedono nel tuo profilo, senza i primi e gli ultimi 200 m.",
  "Saved on the phone. It is sent when you are back online.":
    "Salvata sul telefono. Viene inviata quando torni online.",
  "Saved on the phone. Others see it when you are back online.":
    "Salvata sul telefono. Gli altri la vedono quando torni online.",
  Bike: "Bici",
  Paddle: "Pagaia",
  Title: "Titolo",
  "Give it a name": "Dalle un nome",
  "How did it go?": "Com'è andata?",
  Activity: "Attività",
  Everyone: "Tutti",
  "Only me": "Solo io",
  "Who can see it": "Chi può vederla",
  "Tag people": "Tagga persone",
  "Remove photo {n}": "Togli la foto {n}",
  "Add photo": "Aggiungi foto",
  "This photo could not be kept on the phone. Try again.":
    "Questa foto non si è potuta tenere sul telefono. Riprova.",

  // «Explore»: src/explore/* (TASK-210, parte C)
  "ASK FOR A ROUTE": "CHIEDI UN PERCORSO",
  "A shape through real places {place}. Tap one to make it.":
    "Una forma che passa per posti veri {place}. Toccane una per farla.",
  Food: "Cibo",
  "Famous Places": "Posti famosi",
  Romantic: "Romantico",
  "Best Views": "Panorami",
  Shopping: "Shopping",
  Culture: "Cultura",
  Nightlife: "Vita notturna",
  "Hidden Gems": "Angoli nascosti",
  Running: "Corsa",
  Walking: "Passeggiata",
  Family: "Famiglia",
  Photography: "Fotografia",
  "Local Experience": "Vita locale",
  "More categories": "Altre categorie",
  "More…": "Altre…",
  "{count} more": "altre {count}",
  "OR IN YOUR WORDS": "O CON PAROLE TUE",
  "From {where}. Name a city in the words to go elsewhere.":
    "Si parte {where}. Scrivi una città nelle parole per andare altrove.",
  "Make my route": "Crea il mio percorso",
  "EXAMPLES IN {city}": "ESEMPI A {city}",
  "No recommended routes here yet: shapes of {distance} from the centre, drawn now.":
    "Qui non ci sono ancora percorsi consigliati: forme di {distance} dal centro, disegnate adesso.",
  "Three first, more while you choose.": "Prima tre, altre mentre scegli.",
  "Best near you": "I migliori vicino a te",
  "Starting within {distance} of {place}": "Con partenza entro {distance} da {place}",
  "your start": "dove sei",
  "Loading routes…": "Carico i percorsi…",
  "Choose a start first: the routes are the ones near it.":
    "Scegli prima una partenza: i percorsi sono quelli vicini.",
  "The routes could not load. Check the connection and try again.":
    "I percorsi non si sono caricati. Controlla la connessione e riprova.",
  // src/explore/IdeasFromEurope.tsx, themedIdeas.ts, ThemedCard.tsx: our ideas
  "IDEAS FROM EUROPE": "IDEE DALL'EUROPA",
  "Make it near me": "Fallo vicino a me",
  Rome: "Roma",
  Paris: "Parigi",
  London: "Londra",
  Barcelona: "Barcellona",
  Amsterdam: "Amsterdam",
  Lisbon: "Lisbona",
  Prague: "Praga",
  Berlin: "Berlino",
  "Getting directions…": "Prendo le indicazioni…",
  CITY: "CITTÀ",
  "Type a city or a place": "Scrivi una città o un posto",
  "No city or place matches “{typed}”.":
    "Nessuna città o posto corrisponde a “{typed}”.",
  "The search did not answer. Try again.": "La ricerca non ha risposto. Riprova.",
  "A city you chose before": "Una città scelta prima",
  "The routes near your start": "I percorsi vicino alla tua partenza",
  "{title} · {city} · looks {percent}% like it":
    "{title} · {city} · somiglia al {percent}%",
  "Loading the route…": "Carico il percorso…",
  "The route could not load. Try again.": "Il percorso non si è caricato. Riprova.",
  "Drawing a {distance} {title}…": "Disegno {title} da {distance}…",
  "The GPX could not be made. Try again.": "Il GPX non si è potuto creare. Riprova.",
  "It passes by none of the {found} {theme} found: the shape did not fit near them.":
    "Non passa per nessuno dei {found} {theme} trovati: la forma non ci stava vicino.",
  "Passes by {passed} of the {found} {theme} found:":
    "Passa per {passed} dei {found} {theme} trovati:",
  "Back to Explore": "Torna a Explore",
  "MEANWHILE, FROM THE FEED": "INTANTO, DAL FEED",
  "The first time in a city the map has to download: it can take a minute. The shapes show up above as they are ready.":
    "La prima volta in una città la mappa va scaricata: può volerci un minuto. Le forme compaiono qui sopra man mano che sono pronte.",
  "The shapes of this city are ready above.":
    "Le forme di questa città sono pronte qui sopra.",
  "Maps: {credit}": "Mappe: {credit}",
  "City centre": "Centro città",
  "The API did not answer. Check the connection and try again.":
    "Il server non ha risposto. Controlla la connessione e riprova.",
  "The map of this area could not be loaded for directions. Try again later.":
    "La mappa di questa zona non si è caricata per le indicazioni. Riprova più tardi.",
  "This route is not on the map the API has: it has no directions.":
    "Questo percorso non è sulla mappa del server: non ha indicazioni.",
  "The directions could not be found. Try again.":
    "Le indicazioni non si sono trovate. Riprova.",
  "The API answered without directions. It may be out of date.":
    "Il server ha risposto senza indicazioni. Potrebbe non essere aggiornato.",
  "near your start": "vicino a te",
  "near {place}": "vicino a {place}",
  "in {city}": "a {city}",
  "e.g. a romantic heart, famous places, food 8 km":
    "es. un cuore romantico, posti famosi, cibo 8 km",
  "e.g. a romantic heart in {city}, 8 km": "es. un cuore romantico a {city}, 8 km",
  // «Sport»: src/settings/{SportSetting,SportButton}.tsx, sport.ts, and the voice
  // of «Data»: src/voice/VoiceSetting.tsx (TASK-210, parte E)
  SPORT: "SPORT",
  Soon: "In arrivo",
  "{sport}, coming soon": "{sport}, in arrivo",
  "Sport, {sport}": "Sport, {sport}",
  "Changes the sport": "Cambia lo sport",
  Sport: "Sport",
  Default: "Predefinita",
  "Voice language and voice: {language}, {voice}": "Lingua e voce: {language}, {voice}",
  "Changes the language and the voice": "Cambia la lingua e la voce",
  Listen: "Ascolta",
  "Says a turn with this voice": "Annuncia una svolta con questa voce",
  "Turn on Voice to listen": "Attiva «Voce» per ascoltare",
  "App language": "Lingua dell'app",
  "This phone did not list its voices: its own voice speaks.":
    "Questo telefono non ha elencato le sue voci: parla la sua voce predefinita.",
  "This phone has no {language} voice: the voice speaks English.":
    "Questo telefono non ha una voce per {language}: la voce parla inglese.",
  "{language} · Enhanced": "{language} · Migliorata",

  // The titles of the three pages: src/screens/pageTitles.ts (TASK-210, parte G)
  Feed: "Feed",
  Draw: "Disegna",
  Explore: "Esplora",

  // src/feed/FeedPost.tsx (TASK-118: a member's drawing without a place)
  "{user}: {title}. {facts}.": "{user}: {title}. {facts}.",

  // The shapes' names, the map and «Explore»: src/route/shapeWords.ts,
  // src/map/mapPage.ts, src/explore/{ExploreScreen,ThemedCard}.tsx
  // (TASK-210, parte F)
  "{list} or {last}": "{list} o {last}",
  "Start here": "Parti da qui",
  "NEAR {city}": "VICINO A {city}",
  here: "qui",

  // src/explore/RecommendedRow.tsx (TASK-092)
  RECOMMENDED: "CONSIGLIATI",

  // src/social/ReportMenu.tsx, BlockedPeople.tsx (TASK-121: report and block)
  More: "Altro",
  "Report or block": "Segnala o blocca",
  Report: "Segnala",
  "Block {user}": "Blocca {user}",
  "Why are you reporting this?": "Perché lo segnali?",
  Spam: "Spam",
  "Offensive or hateful": "Offensivo o d'odio",
  "Harassment or bullying": "Molestie o bullismo",
  "Nudity or sexual content": "Nudità o contenuti sessuali",
  "Something else": "Altro motivo",
  "Thanks for telling us. We will look at it.":
    "Grazie per avercelo detto. Lo controlleremo.",
  "Block {user}?": "Bloccare {user}?",
  "You will not see each other's drawings, comments, messages or profile, any follow between you ends and your conversation is deleted. They are not told.":
    "Non vedrete più i disegni, i commenti, i messaggi e il profilo l'uno dell'altro, ogni follow fra voi finisce e la vostra conversazione viene cancellata. Non riceverà alcun avviso.",
  Block: "Blocca",
  "Sending…": "Invio…",
  "This is not available any more.": "Non è più disponibile.",
  "Blocked people": "Persone bloccate",
  "You have not blocked anyone.": "Non hai bloccato nessuno.",
  Unblock: "Sblocca",
  "Unblock {name}": "Sblocca {name}",
  "You blocked {user}. Unblock them from Blocked people in your profile.":
    "Hai bloccato {user}. Puoi sbloccarlo da Persone bloccate nel tuo profilo.",

  // src/settings/NotificationsSetting.tsx, notificationFields.ts (TASK-262: push sent)
  "Push notifications tell you at once about follow requests, reactions, comments and tags. Email notifications sends the same news in one email a day at most. Email when I'm away: one email if you don't open MuW for 2 weeks.":
    "Le notifiche push ti avvisano subito di richieste di follow, reazioni, commenti e tag. Le Notifiche email mandano le stesse novità in una email al giorno al massimo. Email quando sono via: una email se non apri MuW per 2 settimane.",
  "Notifications are off for MuW on this phone. Allow them in Settings to turn this on.":
    "Le notifiche di MuW sono spente su questo telefono. Consentile nelle Impostazioni per attivarle.",

  // src/paddle/PaddleExplore.tsx (TASK-269)
  Lakes: "Laghi",
  Sea: "Mare",
  "Suggested near {place}": "Consigliati vicino a {place}",
  "Suggested near where you usually start": "Consigliati vicino a dove parti di solito",
  "Suggested near your start": "Consigliati vicino alla tua partenza",

  // src/stretch (TASK-285 part B)
  "Quad stretch": "Stretching del quadricipite",
  "Stand tall. Pull one heel toward your glutes, knees together.":
    "In piedi, dritto. Porta un tallone verso il gluteo, ginocchia unite.",
  "Hamstring stretch": "Stretching del posteriore della coscia",
  "Put one heel forward, toes up. Lean from the hips, back straight.":
    "Un tallone avanti, punta in su. Piegati dalle anche, schiena dritta.",
  "Calf stretch": "Stretching del polpaccio",
  "Step back, heel down. Lean toward the wall until the calf pulls.":
    "Un passo indietro, tallone a terra. Spingi verso il muro finché il polpaccio tira.",
  "Hip flexor stretch": "Stretching dei flessori dell'anca",
  "Kneel on one knee. Push your hips forward, chest up.":
    "In ginocchio su una gamba. Spingi il bacino in avanti, petto in alto.",
  "Glute stretch": "Stretching del gluteo",
  "Cross one ankle over the other knee. Sit back as if into a chair.":
    "Incrocia una caviglia sull'altro ginocchio. Siediti indietro come su una sedia.",
  "{index} of {total}": "{index} di {total}",
  "Right side": "Lato destro",
  "Left side": "Lato sinistro",
  "Switch sides": "Cambia lato",
  "{seconds} seconds left": "Mancano {seconds} secondi",
  "Stop if it hurts.": "Fermati se fa male.",
  // «Draw»: src/route/samplePictures.ts (TASK-280)
  "Running shoe": "Scarpa da corsa",
  Dinosaur: "Dinosauro",
  Guitar: "Chitarra",
  "Eiffel Tower": "Torre Eiffel",
  Rocket: "Razzo",
  Plane: "Aereo",
  Balloon: "Palloncino",
  Leaf: "Foglia",
  Mushroom: "Fungo",
  Car: "Auto",
  "T-shirt": "Maglietta",
  Boot: "Stivale",
  House: "Casa",
  Duck: "Paperella",
  Trophy: "Coppa",
  Bone: "Osso",

  // src/route/RoutePanel.tsx (TASK-340: first in «Draw», it opens the map
  // to draw on)
  Freehand: "A mano libera",
  // src/mapdraw/DrawOnMap.tsx (TASK-281)
  Move: "Sposta",
  "Draw with one finger. End where you started to close it. Two fingers move the map.":
    "Disegna con un dito. Finisci dove hai iniziato per chiuderla. Con due dita sposti la mappa.",
  "Each new line joins the drawing. Two fingers move the map.":
    "Ogni nuova linea si unisce al disegno. Con due dita sposti la mappa.",
  "Drag the figure or the map. Hold a line still, then drag to bend it. Two fingers resize.":
    "Trascina la figura o la mappa. Tieni fermo il dito su una linea, poi trascina per piegarla. Con due dita la ridimensioni.",
  Line: "Linea",
  "Tap point after point. Tap the first point to close it, the last one to finish.":
    "Tocca un punto dopo l'altro. Tocca il primo punto per chiuderla, l'ultimo per finire.",
  "The outline cannot cross itself. Bend it less.":
    "Il contorno non può incrociarsi. Piegalo di meno.",
  Redo: "Ripeti",
  "Clear all": "Cancella tutto",
  "Clear the whole drawing?": "Cancellare tutto il disegno?",
  "+ photo": "+ foto",

  // src/screens/ChooseScreen.tsx, src/location/PickStart.tsx (TASK-292)
  "Choose on the map": "Scegli sulla mappa",
  "Move the map to put the pin where you want to start.":
    "Sposta la mappa per mettere il segnaposto dove vuoi partire.",

  // src/share/SharePost.tsx, src/share/videoFile.ts (TASK-295)
  "Export video": "Esporta video",
  "Making the video… {percent}%": "Preparo il video… {percent}%",
  "This phone cannot make the video.": "Questo telefono non riesce a creare il video.",
  "The video could not be made. Try again.":
    "Non è stato possibile creare il video. Riprova.",

  // src/screens/pageTitles.ts, src/game/ (TASK-296: the shape game, «Play»)
  Play: "Gioca",
  "{distance} in total": "{distance} in totale",
  "{distance} under {pace}": "{distance} sotto {pace}",
  "Best {best} · target {target}": "Migliore {best} · obiettivo {target}",
  "Longest run {distance}": "Corsa più lunga {distance}",
  "Unlocked {date}": "Sbloccata {date}",
  "Sign in to collect shapes.": "Accedi per collezionare le forme.",
  "{distance} counted so far": "{distance} contati finora",
  "The game is not available right now.": "Il gioco non è disponibile adesso.",
  "New shape unlocked": "Nuova forma sbloccata",
  "New shape unlocked: {name}": "Nuova forma sbloccata: {name}",
  "It is in your collection.": "È nella tua collezione.",
  "See collection": "Vedi la collezione",

  // src/navigation/runPosition.ts, the Android notification of a run (TASK-294)
  "MuW is recording your activity": "MuW sta registrando la tua attività",
  "It keeps going with the screen locked, voice included.":
    "Continua anche a schermo bloccato, voce compresa.",

  // src/location/startStatus.ts, src/screens/ChooseScreen.tsx,
  // src/explore/ExploreScreen.tsx, ThemedCard.tsx, src/screens/NavigateScreen.tsx,
  // RunPanel.tsx, src/navigation/runStats.ts, src/intro/SavedLogo.tsx
  // (TASK-210, parte H)
  "Starting from your position.": "Parti dalla tua posizione.",
  "Starting from {place}.": "Parti da {place}.",
  "Starting from a point on the map.": "Parti da un punto sulla mappa.",
  "Search for a city or street to start from.":
    "Cerca una città o una via da cui partire.",
  "Location is off for MuW. Allow it in Settings, or search for a place to start from.":
    "La posizione è disattivata per MuW. Consentila nelle Impostazioni, oppure cerca un posto da cui partire.",
  "Your position is not available right now. Search for a place to start from.":
    "La tua posizione adesso non è disponibile. Cerca un posto da cui partire.",
  START: "PARTENZA",
  "My position": "La mia posizione",
  "Another place": "Un altro posto",
  "No recommended routes near this start yet. Draw one: the best ones will show up here.":
    "Non ci sono ancora percorsi consigliati vicino a questa partenza. Disegnane uno: i migliori compariranno qui.",
  "{distance} away": "a {distance}",
  "Finding the places and drawing the shape through them… This can take a minute.":
    "Cerco i luoghi e disegno la forma che li attraversa… Può volerci un minuto.",
  "{percent}% drawn": "{percent}% disegnato",
  N: "N",
  NE: "NE",
  E: "E",
  SE: "SE",
  S: "S",
  SW: "SO",
  W: "O",
  NW: "NO",
  "{distance} to go": "mancano {distance}",
  "Saved to My activities": "Salvata nelle mie attività",
  // src/social/ContactsFriends.tsx (TASK-262 C)
  "FROM YOUR CONTACTS": "DALLA RUBRICA",
  "Find friends in your contacts": "Trova amici nella rubrica",
  "Only coded phone numbers leave the phone, never names. The server compares them with the numbers members saved and keeps none.":
    "Dal telefono escono solo i numeri in codice, mai i nomi. Il server li confronta con i numeri salvati dagli iscritti e non ne tiene nessuno.",
  "Looking in your contacts…": "Cerco nella rubrica…",
  "MuW cannot see your contacts.": "MuW non può vedere la rubrica.",
  "No phone numbers in your contacts.": "Nella rubrica non ci sono numeri di telefono.",
  "None of your contacts is on MuW yet.": "Nessuno dei tuoi contatti è ancora su MuW.",
  "This server cannot look in your contacts yet.":
    "Questo server non sa ancora cercare nella rubrica.",
  "The contacts could not be read.": "Non è stato possibile leggere la rubrica.",
  // «Play», the «Challenges» tab: src/game/{PlayScreen,ChallengesTab,TeamView,
  // ChallengeView,NewChallenge}.tsx, teamsApi.ts, timeLeft.ts, shareCode.ts
  // (TASK-296, parte D)
  Collection: "Collezione",
  Challenges: "Sfide",
  "Sign in to play with a team.": "Accedi per giocare in squadra.",
  "Teams are not on this server yet.": "Le squadre non sono ancora su questo server.",
  "YOUR TEAMS": "LE TUE SQUADRE",
  "No team yet. Create one, or join one with its code.":
    "Nessuna squadra ancora. Creane una, o entra in una con il suo codice.",
  "Team name": "Nome della squadra",
  Create: "Crea",
  "Team code": "Codice della squadra",
  Join: "Entra",
  "{count} member": "{count} iscritto",
  "{count} members": "{count} iscritti",
  "No challenge yet": "Nessuna sfida ancora",
  "{done} of {total} pieces done": "{done} pezzi su {total} fatti",
  "Code {code}": "Codice {code}",
  "Share code": "Condividi il codice",
  "Join my team «{name}» on MuW: open Play, Challenges, and enter the code {code}.":
    "Entra nella mia squadra «{name}» su MuW: apri Play, Sfide, e inserisci il codice {code}.",
  MEMBERS: "ISCRITTI",
  Owner: "Proprietario",
  "Leave team": "Esci dalla squadra",
  "Leave this team?": "Esci da questa squadra?",
  "New challenge": "Nuova sfida",
  Pieces: "Pezzi",
  "Fewer pieces": "Meno pezzi",
  "More pieces": "Più pezzi",
  "Each piece": "Ogni pezzo",
  Fast: "Veloce",
  "Slower pace": "Passo più lento",
  "Faster pace": "Passo più veloce",
  Days: "Giorni",
  "Fewer days": "Meno giorni",
  "More days": "Più giorni",
  "Start the challenge": "Avvia la sfida",
  "{count} pieces · {goal} each": "{count} pezzi · {goal} ciascuno",
  "Piece {n}": "Pezzo {n}",
  Free: "Libero",
  Yours: "Tuo",
  "Taken by {name}": "Preso da {name}",
  "Done by {name}": "Fatto da {name}",
  "Take this piece": "Prendi questo pezzo",
  Leave: "Lascia",
  "WHO GAVE WHAT": "CHI HA DATO QUANTO",
  "Nobody has run yet.": "Nessuno ha ancora corso.",
  PIECES: "PEZZI",
  "Complete! Your team drew it together.":
    "Completa! La squadra l'ha disegnata insieme.",
  "Time ran out: {count} piece was missing.": "Tempo scaduto: mancava {count} pezzo.",
  "Time ran out: {count} pieces were missing.":
    "Tempo scaduto: mancavano {count} pezzi.",
  "{count} day {hours} h left": "Manca {count} giorno e {hours} h",
  "{count} days {hours} h left": "Mancano {count} giorni e {hours} h",
  "{hours} h {minutes} min left": "Mancano {hours} h {minutes} min",
  "{minutes} min {seconds} s left": "Mancano {minutes} min {seconds} s",
  "Time is up": "Tempo scaduto",
  "No team with this code.": "Nessuna squadra con questo codice.",
  "You can't join this team.": "Non puoi entrare in questa squadra.",
  "You are in 10 teams already: leave one first.":
    "Sei già in 10 squadre: esci da una prima.",
  "This team is not available any more.": "Questa squadra non è più disponibile.",
  "This challenge is not available any more.": "Questa sfida non è più disponibile.",
  "The team has a challenge going already: wait for it to end.":
    "La squadra ha già una sfida in corso: aspetta che finisca.",
  "This challenge is over.": "Questa sfida è finita.",
  "This piece is not there any more.": "Questo pezzo non c'è più.",
  "This piece is done already.": "Questo pezzo è già fatto.",
  "Someone holds this piece already.": "Qualcuno ha già questo pezzo.",
  "You hold a piece of this challenge already: leave it first.":
    "Hai già un pezzo di questa sfida: lascialo prima.",
  "You don't hold this piece.": "Questo pezzo non è tuo.",
  "This name is not allowed. Choose another one.":
    "Questo nome non va bene. Scegline un altro.",
  // src/screens/SignInScreen.tsx, src/settings/NotificationsSetting.tsx
  // (TASK-284 B: the email when away; the names as in its email)
  "If you don't open MuW for 2 weeks, we email you once with what's new.":
    "Se non apri MuW per 2 settimane, ti mandiamo una sola email con le novità.",
  "Don't send me these emails": "Non mandarmi più queste email",
  "Email when I'm away": "Email quando sono via",
  None: "Nessuna",
  Energy: "Energia",
  Chill: "Relax",
  Epic: "Epica",
  Sprint: "Sprint",
  Rock: "Rock",
  Funk: "Funk",
  Sunny: "Solare",
  Trap: "Trap",
  Retro: "Retrò",
  Fiesta: "Festa",
  "Tap a track to hear it.": "Tocca un brano per sentirlo.",
  // src/contest/ (TASK-299 B: the contest card, its rules, the Winner badge)
  "MuW contest": "Concorso MuW",
  "The post with the most reactions wins.": "Vince il post con più reazioni.",
  "{count} day left": "Manca {count} giorno",
  "{count} days left": "Mancano {count} giorni",
  "Ends today": "Finisce oggi",
  "Ended · the winner is coming": "Finito · il vincitore sta arrivando",
  "Publish a run to take part.": "Pubblica una corsa per partecipare.",
  "Your best post: #{rank}, {count} reaction":
    "Il tuo miglior post: n. {rank}, {count} reazione",
  "Your best post: #{rank}, {count} reactions":
    "Il tuo miglior post: n. {rank}, {count} reazioni",
  "How it works": "Come funziona",
  "Official rules": "Regolamento",
  "Organised by MuW (Luca Pallaoro). Runs from {start} to {end}.":
    "Organizzato da MuW (Luca Pallaoro). Dal {start} al {end}.",
  "Anyone with a MuW account can take part, for free, by publishing a run for everyone in the app during the contest.":
    "Partecipa gratis chi ha un account MuW, pubblicando una corsa per tutti nell'app durante il concorso.",
  "At the end, the post with the most reactions from other members wins. One reaction per member counts; your own does not. If two posts tie, the one with more MuW hearts wins, then the one published first.":
    "Alla fine vince il post con più reazioni degli altri iscritti. Conta una reazione per iscritto; la propria no. A pari merito vince il post con più cuori MuW, poi quello pubblicato prima.",
  "The prize has no money value: the winner gets the Winner badge on their profile and their post shown at the top of the Feed for a week.":
    "Il premio non ha valore in denaro: chi vince ha il badge Vincitore sul profilo e il suo post in cima al Feed per una settimana.",
  "MuW may leave out a post that breaks the community rules.":
    "MuW può escludere un post che viola le regole della community.",
  "Apple and Google are not sponsors of this contest and are not involved in it in any way.":
    "Apple e Google non sponsorizzano questo concorso e non vi sono coinvolte in alcun modo.",
  Winner: "Vincitore",
  "{name} won the MuW contest": "{name} ha vinto il concorso MuW",
  // src/route/NearYou.tsx (TASK-306: shapes ready near you, or in other cities)
  "NEAR YOU": "VICINO A TE",
  "SHAPES TO TRY": "FORME DA PROVARE",
  // src/game/PlayRow.tsx (TASK-327: «Play» under the distance of «Draw»)
  PLAY: "GIOCA",
  "Collect shapes by running": "Colleziona le forme correndo",
  // src/screens/NavigateScreen.tsx (TASK-303: fuori percorso, dov'è)
  "The route is {distance} away, to the {direction}.":
    "Il percorso riprende a {distance} verso {direction}.",
  "Follow the dotted line back to the route.":
    "Segui la linea a puntini per tornare sul percorso.",
  // src/social/DrawingCard.tsx (TASK-307: «Start» on a drawing follows its track)
  "This route has no turn directions: follow the line on the map.":
    "Questo percorso non ha le indicazioni delle svolte: segui la linea sulla mappa.",
  // src/game/runStripData.ts (TASK-296 E: the game's line on the run screen)
  "Last km {pace} · target {target}": "Ultimo km {pace} · obiettivo {target}",
  "Last mi {pace} · target {target}": "Ultimo mi {pace} · obiettivo {target}",

  // src/settings/FeedbackSetting.tsx, feedbackFields.ts, SettingsPage.tsx (TASK-308)
  "Send feedback": "Mandaci un feedback",
  "Thank you! Your message reached us.": "Grazie! Il tuo messaggio ci è arrivato.",
  "Ideas, problems, anything that would make MuW better: we read every message.":
    "Idee, problemi, tutto ciò che renderebbe MuW migliore: leggiamo ogni messaggio.",
  "Write here…": "Scrivi qui…",
  "Your message": "Il tuo messaggio",
  "It reaches us with your username, your email and the app's version, so we can answer you.":
    "Ci arriva con il tuo nome utente, la tua email e la versione dell'app, così possiamo risponderti.",
  "Write something first.": "Scrivi prima qualcosa.",
  "You sent a lot of feedback today. Try again tomorrow.":
    "Oggi ci hai già scritto molto. Riprova domani.",
  FEEDBACK: "FEEDBACK",
  // src/settings/sport.ts (TASK-305 D0: paragliding, «Soon» in «Sport»)
  Paragliding: "Parapendio",
  // src/explore/ExploredCard.tsx, src/social/DrawingCard.tsx (TASK-313: la
  // stessa forma in «Draw»)
  "Draw it near me": "Disegnala vicino a me",
  // src/route/RoutePanel.tsx (TASK-311 B: a word in one line that did not come out)
  "This word may come out better with the pen up: each letter on its own.":
    "Questa parola può venire meglio con la penna alzata: ogni lettera da sola.",
  "Lift the pen": "Alza la penna",
  // src/route/RoutePanel.tsx (TASK-317: the wait in «Draw»)
  "Warming up: {name}…": "Riscaldamento: {name}…",
  "Warming up: “{word}”…": "Riscaldamento: «{word}»…",
  "Warming up: the picture…": "Riscaldamento: la foto…",

  // src/api/messages.ts (TASK-319: private messages)
  "A message needs some words.": "Un messaggio ha bisogno di qualche parola.",
  "A message is at most {max} characters.":
    "Un messaggio può avere al massimo {max} caratteri.",
  "Too many messages in a minute. Wait a moment and try again.":
    "Troppi messaggi in un minuto. Aspetta un momento e riprova.",
  "You can't send negative messages in this app.":
    "In questa app non puoi mandare messaggi negativi.",
  "This conversation is not available.": "Questa conversazione non è disponibile.",

  // src/messages/ConversationList.tsx, MessagesOverlay.tsx, MessagesRow.tsx, MessageButton.tsx (TASK-319)
  Messages: "Messaggi",
  "Messages, {count} waiting": "Messaggi, {count} in attesa",
  "Message requests": "Richieste di messaggio",
  "Message requests, {count} waiting": "Richieste di messaggio, {count} in attesa",
  "No messages yet. Open someone's profile and tap Message to write to them.":
    "Ancora nessun messaggio. Apri il profilo di qualcuno e tocca Messaggio per scrivergli.",
  "No message requests.": "Nessuna richiesta di messaggio.",
  "You: {text}": "Tu: {text}",
  "{name}, new message: {text}": "{name}, nuovo messaggio: {text}",
  Message: "Messaggio",
  "Message {name}": "Scrivi a {name}",

  // src/messages/ConversationScreen.tsx, MessageSheet.tsx (TASK-319)
  "No messages yet.": "Ancora nessun messaggio.",
  "Show earlier messages": "Mostra i messaggi precedenti",
  "Touch and hold to delete it": "Tieni premuto per eliminarlo",
  "Touch and hold to report it": "Tieni premuto per segnalarlo",
  "Message request sent. You can write again when {name} accepts it.":
    "Richiesta di messaggio inviata. Potrai scrivere di nuovo quando {name} la accetta.",
  "{name} wants to send you a message.": "{name} vuole mandarti un messaggio.",
  "{name} gets this as a message request. You can send one message until they accept it.":
    "{name} la riceve come richiesta di messaggio. Finché non la accetta puoi mandare un solo messaggio.",
  "Write a message…": "Scrivi un messaggio…",
  "Delete this message for both of you?": "Eliminare questo messaggio per tutti e due?",
  "Report this message": "Segnala questo messaggio",
  // src/explore/ExploredCard.tsx, social/DrawingCard.tsx, mapdraw/DrawOnMap.tsx,
  // RoutePanel.tsx, favorites/favoriteRoute.ts (TASK-320, TASK-331: the figure
  // drawn by hand on the map)
  "Edit the drawing": "Modifica il disegno",
  Erase: "Cancella",
  Drawing: "Disegno",
  "Rub a line to erase that piece. A piece cut off joins the drawing with a dash.":
    "Passa il dito su una linea per cancellarne il pezzo. Un pezzo staccato si unisce al disegno con un tratteggio.",
  // src/imports/, activities/RunEnd.tsx, feed/FeedPost.tsx (TASK-312 B:
  // «Add past activity» from a GPX, TCX or FIT file, «Imported»)
  "Add past activity": "Aggiungi un'attività passata",
  "From a file": "Da un file",
  "GPX, TCX or FIT from Strava, Garmin, Komoot…":
    "GPX, TCX o FIT da Strava, Garmin, Komoot…",
  "Export the activity as a file from the other app or its website, save it in Files, then pick it here.":
    "Esporta l'attività come file dall'altra app o dal suo sito, salvala in File, poi sceglila qui.",
  Imported: "Importata",
  "Imported activities don't count for Play or contests.":
    "Le attività importate non contano per il gioco né per i concorsi.",
  "This file is not GPX, TCX or FIT.": "Questo file non è GPX, TCX o FIT.",
  "This file has no times: it is a route, not an activity.":
    "Questo file non ha orari: è un percorso, non un'attività.",
  "This file has no positions.": "Questo file non ha posizioni.",
  "This file is too big (over 25 MB).": "Questo file è troppo grande (oltre 25 MB).",
  "Activities before 2020 cannot be added.":
    "Non si possono aggiungere attività prima del 2020.",
  "Already in My activities.": "È già in Le mie attività.",
  // The attachments of the private messages (TASK-333).
  "📷 Photo": "📷 Foto",
  "🎬 Video": "🎬 Video",
  "🗺️ Drawing": "🗺️ Disegno",
  Photo: "Foto",
  Video: "Video",
  "This video has expired.": "Questo video è scaduto.",
  "Video, {duration}": "Video, {duration}",
  "Drawing: {title}, {distance}": "Disegno: {title}, {distance}",
  "Add a photo, a video or a drawing": "Aggiungi una foto, un video o un disegno",
  "Add a message…": "Aggiungi un messaggio…",
  "Couldn't send. Tap to try again.": "Non inviato. Tocca per riprovare.",
  "This video is longer than {seconds} seconds. Choose a shorter one.":
    "Questo video dura più di {seconds} secondi. Scegline uno più corto.",
  "This video is too large: at most {mb} MB. Choose a shorter one.":
    "Questo video è troppo grande: al massimo {mb} MB. Scegline uno più corto.",
  "Too many videos today. Try again tomorrow.": "Oggi troppi video. Riprova domani.",
  "Too many photos today. Try again tomorrow.": "Oggi troppe foto. Riprova domani.",
  "Videos can't be sent right now. Try again later.":
    "Ora non si possono mandare video. Riprova più tardi.",
  // The drawings of the private messages (TASK-333 part C).
  "Send to a friend": "Invia agli amici",
  "Send to…": "Invia a…",
  "Search people": "Cerca persone",
  "Sent to {name}.": "Inviato a {name}.",
  "Send a drawing": "Invia un disegno",
  "Photos, videos and drawings can be sent once {name} accepts your message.":
    "Foto, video e disegni si possono inviare quando {name} accetta il tuo messaggio.",

  // src/profile/BadgeRow.tsx (TASK-341: the badges of a profile)
  "First drawing": "Primo disegno",
  "10 drawings": "10 disegni",
  "{distance} drawing": "Disegno da {distance}",
  "Not earned yet: {badge}": "Non ancora preso: {badge}",
  // src/messages/messageTime.ts, ConversationList.tsx (TASK-353: times in the chat)
  Today: "Oggi",
  Yesterday: "Ieri",
  "{day} {month}": "{day} {month}",
  "{name}, {count} new messages: {text}": "{name}, {count} nuovi messaggi: {text}",
};
