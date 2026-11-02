import type { Table } from "./translate";

/**
 * The app's texts in German, by their English text (ADR-0172), in the
 * order of the files that show them. To confirm with someone who speaks it
 * (docs/UI.md).
 */
export const DE: Table = {
  // src/about/AboutPage.tsx
  "Draft — not final yet.": "Entwurf – noch nicht endgültig.",
  "Last updated: {date}": "Zuletzt aktualisiert: {date}",

  // src/account/fields.ts
  "You must be at least 16 to sign up.":
    "Du musst mindestens 16 sein, um dich zu registrieren.",
  "Enter the email of your account.": "Gib die E-Mail-Adresse deines Kontos ein.",
  "Enter your password.": "Gib dein Passwort ein.",
  "A username is 3 to 20 letters, digits, _ or . (no spaces).":
    "Ein Benutzername hat 3 bis 20 Buchstaben, Ziffern, _ oder . (keine Leerzeichen).",
  "Enter an email address, like name@example.com.":
    "Gib eine E-Mail-Adresse ein, z. B. name@example.com.",
  "A password is at least {min} characters.":
    "Ein Passwort hat mindestens {min} Zeichen.",
  "A password is at most {max} characters.":
    "Ein Passwort hat höchstens {max} Zeichen.",

  // src/account/messages.ts (TASK-256: words for whoever uses the phone)
  "The app cannot reach the service. Update the app.":
    "Die App erreicht den Dienst nicht. Aktualisiere die App.",
  "Your session has ended. Log in again.":
    "Deine Sitzung ist abgelaufen. Melde dich erneut an.",
  "Something went wrong on our side. Try again in a moment.":
    "Bei uns ist etwas schiefgelaufen. Versuche es gleich noch einmal.",
  "No connection. Check the network and try again.":
    "Keine Verbindung. Prüfe die Netzverbindung und versuche es noch einmal.",
  "This email already has an account. Log in instead.":
    "Diese E-Mail-Adresse hat schon ein Konto. Melde dich stattdessen an.",
  "This username is taken. Try another one.":
    "Dieser Benutzername ist vergeben. Versuche einen anderen.",
  "Wrong email or password.": "Falsche E-Mail-Adresse oder falsches Passwort.",
  "Accounts are not available right now. Try again later.":
    "Konten sind gerade nicht verfügbar. Versuche es später noch einmal.",
  "This version of the app is no longer allowed in. Update the app.":
    "Diese Version der App wird nicht mehr hereingelassen. Aktualisiere die App.",
  "Too many tries. Wait a minute and try again.":
    "Zu viele Versuche. Warte eine Minute und versuche es noch einmal.",
  "Too many tries. Wait {minutes} minutes and try again.":
    "Zu viele Versuche. Warte {minutes} Minuten und versuche es noch einmal.",

  // src/activities/ActivitiesList.tsx
  "{count} run is on this phone, waiting for a connection.":
    "{count} Lauf ist auf diesem Handy und wartet auf eine Verbindung.",
  "{count} runs are on this phone, waiting for a connection.":
    "{count} Läufe sind auf diesem Handy und warten auf eine Verbindung.",
  "Loading…": "Lädt…",
  "Show more": "Mehr anzeigen",
  "Loading your activities…": "Deine Aktivitäten werden geladen…",
  "Your activities could not load.": "Deine Aktivitäten konnten nicht geladen werden.",
  "Try again": "Erneut versuchen",
  "No activities yet. Save a run when you finish it, and it is kept here.":
    "Noch keine Aktivitäten. Speichere einen Lauf, wenn du fertig bist, dann findest du ihn hier.",
  "{when}, {where}, {facts}, public, open on the map":
    "{when}, {where}, {facts}, öffentlich, auf der Karte öffnen",
  "{when}, {where}, {facts}, open on the map":
    "{when}, {where}, {facts}, auf der Karte öffnen",
  "Opening…": "Wird geöffnet…",
  Public: "Öffentlich",
  "Delete this run? It cannot be undone.":
    "Diesen Lauf löschen? Das kann nicht rückgängig gemacht werden.",
  // «Keep it» answers two questions (a run, Strava): a word that fits both.
  "Keep it": "Abbrechen",
  "Delete run": "Lauf löschen",
  "Delete the run of {when}": "Lauf vom {when} löschen",
  Delete: "Löschen",
  // A run the API will not take (TASK-257).
  "The server could not take this run: {message}":
    "Der Server konnte diesen Lauf nicht annehmen: {message}",
  "Discard this run? It will not be saved.":
    "Diesen Lauf verwerfen? Er wird nicht gespeichert.",
  "Discard run": "Lauf verwerfen",
  "Send the run of {when} again": "Lauf vom {when} erneut senden",
  "Discard the run of {when}": "Lauf vom {when} verwerfen",
  Discard: "Verwerfen",

  // src/activities/ActivityCard.tsx
  "Yellow: the route. White: what you ran.":
    "Gelb: die Route. Weiß: was du gelaufen bist.",
  "White: what you ran.": "Weiß: was du gelaufen bist.",
  "Back to the list": "Zurück zur Liste",

  // src/activities/activitiesDoor.ts
  "Sign up or log in to keep your runs and share them as drawings.":
    "Registriere dich oder melde dich an, um deine Läufe zu behalten und als Zeichnungen zu teilen.",
  "This run is no longer in your activities.":
    "Dieser Lauf ist nicht mehr in deinen Aktivitäten.",

  // src/activities/activityText.ts
  Sun: "So",
  Mon: "Mo",
  Tue: "Di",
  Wed: "Mi",
  Thu: "Do",
  Fri: "Fr",
  Sat: "Sa",
  Jan: "Jan",
  Feb: "Feb",
  Mar: "März",
  Apr: "Apr",
  May: "Mai",
  Jun: "Juni",
  Jul: "Juli",
  Aug: "Aug",
  Sep: "Sept",
  Oct: "Okt",
  Nov: "Nov",
  Dec: "Dez",
  "{weekday} {day} {month} {year}": "{weekday}, {day}. {month} {year}",
  Run: "Lauf",

  // src/activities/RunEnd.tsx
  "The phone holds {count} runs not sent yet. Discard one in My activities first.":
    "Auf dem Telefon liegen schon {count} noch nicht gesendete Läufe. Verwirf zuerst einen in Meine Aktivitäten.",
  "The phone holds {count} runs not sent yet. They go when there is a connection; then save this one.":
    "Auf dem Telefon liegen schon {count} noch nicht gesendete Läufe. Sie werden gesendet, sobald eine Verbindung besteht; speichere diesen danach.",

  // src/api/comments.ts
  "A comment needs some words.": "Ein Kommentar braucht ein paar Worte.",
  "A comment is at most {max} characters.":
    "Ein Kommentar hat höchstens {max} Zeichen.",
  "Too many comments in a minute. Wait a moment and try again.":
    "Zu viele Kommentare in einer Minute. Warte kurz und versuche es noch einmal.",
  "The comments of this drawing are not available.":
    "Die Kommentare zu dieser Zeichnung sind nicht verfügbar.",

  // src/api/reactions.ts
  "At least 2 characters": "Mindestens 2 Zeichen",
  "Your reaction wasn't saved. Check the connection.":
    "Deine Reaktion wurde nicht gespeichert. Prüfe die Verbindung.",

  // src/api/strava.ts
  "No connection. Try again when you are online.":
    "Keine Verbindung. Versuche es noch einmal, wenn du online bist.",
  "Strava is taking no more runs for now. Try again later.":
    "Strava nimmt gerade keine Läufe mehr an. Versuche es später noch einmal.",
  "Strava could not read this run.": "Strava konnte diesen Lauf nicht lesen.",
  "Strava is not connected. Connect it and try again.":
    "Strava ist nicht verbunden. Verbinde es und versuche es noch einmal.",
  "Strava is not available on this API.": "Strava ist auf dieser API nicht verfügbar.",
  "Strava did not answer. Try again in a while.":
    "Strava hat nicht geantwortet. Versuche es in einer Weile noch einmal.",

  // src/engine/OfflineMapsSetting.tsx
  "Offline maps: {size}": "Offline-Karten: {size}",
  "Maps download on Wi-Fi and mobile data.":
    "Karten werden über WLAN und mobile Daten geladen.",
  "Add a place": "Ort hinzufügen",
  "Preparing the map…": "Karte wird vorbereitet…",
  "Trying again later": "Neuer Versuch später",
  "Up to {count} places.": "Bis zu {count} Orte.",
  "Places you add stay on the phone, so shapes there are drawn faster, even without signal.":
    "Hinzugefügte Orte bleiben auf dem Telefon: Dort werden Formen schneller gezeichnet, auch ohne Empfang.",

  // src/engine/ZoneNotice.tsx
  "Downloading the maps of your area ({size}) so routes work without signal.":
    "Die Karten deiner Umgebung werden geladen ({size}), damit Routen auch ohne Empfang funktionieren.",

  // src/engine/sizeText.ts
  "{size} MB": "{size} MB",
  "{size} GB": "{size} GB",

  // src/favorites/FavoriteHeart.tsx
  "Remove from favorites": "Aus Favoriten entfernen",
  "Add to favorites": "Zu Favoriten hinzufügen",

  // src/favorites/FavoritesList.tsx
  "Kept {day} {month} {year}": "Gespeichert am {day}. {month} {year}",
  "{title}, open on the map": "{title}, auf der Karte öffnen",
  "Remove {title} from favorites": "{title} aus Favoriten entfernen",
  "Loading your favorites…": "Deine Favoriten werden geladen…",
  "Your favorites could not load.": "Deine Favoriten konnten nicht geladen werden.",
  "No favorites yet. Tap {heart} on a route on the map to keep it here.":
    "Noch keine Favoriten. Tippe auf {heart} bei einer Route auf der Karte, um sie hier zu behalten.",

  // src/favorites/favoriteRoute.ts
  Route: "Route",

  // src/favorites/favoritesDoor.ts
  "Sign up or log in to keep your favorite routes.":
    "Registriere dich oder melde dich an, um deine Lieblingsrouten zu behalten.",

  // src/feed/FeedAd.tsx
  Sponsored: "Gesponsert",

  // src/feed/FeedPost.tsx
  "OpenFreeMap © OpenMapTiles\nData from OpenStreetMap":
    "OpenFreeMap © OpenMapTiles\nDaten von OpenStreetMap",
  "{user} in {city}: {title}. {facts}.": "{user} in {city}: {title}. {facts}.",
  "Opens the route on the map": "Öffnet die Route auf der Karte",

  // src/health/HealthRunEnd.tsx (TASK-321: Apple Health and Health Connect)
  "Save to Apple Health": "In Apple Health speichern",
  "Save to Health Connect": "In Health Connect speichern",
  "Your activities also go to the Fitness app, with the route.":
    "Deine Aktivitäten kommen auch in die Fitness-App, mit der Route.",
  "Your activities also go to Health Connect, with the route.":
    "Deine Aktivitäten kommen auch in Health Connect, mit der Route.",
  "Also to Apple Health, with Save.":
    "Mit Speichern geht die Aktivität auch an Apple Health.",
  "Also to Health Connect, with Save.":
    "Mit Speichern geht die Aktivität auch an Health Connect.",
  "MuW can't write to Apple Health. Allow it in the Health app: your profile › Apps › MuW.":
    "MuW kann nicht in Apple Health schreiben. Erlaube es in der Health-App: dein Profil › Apps › MuW.",
  "MuW can't write to Health Connect. Allow it in Health Connect › App permissions › MuW.":
    "MuW kann nicht in Health Connect schreiben. Erlaube es in Health Connect › App-Berechtigungen › MuW.",

  // src/i18n/shapeNames.ts
  Circle: "Kreis",
  Heart: "Herz",
  Star: "Stern",
  Horse: "Pferd",
  Moon: "Mond",
  Cat: "Katze",
  Fish: "Fisch",
  Butterfly: "Schmetterling",
  Snail: "Schnecke",
  "Dog head": "Hundekopf",
  "Rabbit head": "Hasenkopf",
  Pumpkin: "Kürbis",
  "Christmas tree": "Weihnachtsbaum",
  Smiley: "Smiley",
  Ghost: "Gespenst",
  Donut: "Donut",
  "The sun": "Sonne",

  // src/explore/NearbyTowns.tsx
  "NEARBY TOWNS": "ORTE IN DER NÄHE",
  "{town}, {km} km away": "{town}, {km} km entfernt",
  "{mi} mi away": "{mi} mi entfernt",
  "{town}, {mi} mi away": "{town}, {mi} mi entfernt",

  // src/explore/CityWords.tsx
  WORDS: "WÖRTER",

  // src/intro/AppBoundary.tsx
  "Something went wrong.": "Etwas ist schiefgelaufen.",

  // src/map/MapView.tsx
  "The map could not be loaded. Check the network.":
    "Die Karte konnte nicht geladen werden. Prüfe die Netzverbindung.",
  Retry: "Erneut versuchen",

  // src/map/NorthArrow.tsx
  "North arrow": "Nordpfeil",
  "Turns the map north up": "Dreht die Karte nach Norden",
  "Turns the map like the drawing": "Dreht die Karte wie die Zeichnung",

  // src/map/MapKindButton.tsx
  "Map type": "Kartentyp",
  Standard: "Standard",
  Satellite: "Satellit",
  "3D": "3D",

  // src/paddle/PaddleExplore.tsx
  Next: "Als Nächstes",
  "Drawing…": "Wird gezeichnet…",
  "Your start": "Dein Start",
  "On the water": "Auf dem Wasser",
  "Shapes to paddle, within 1 km of the shore":
    "Formen zum Paddeln, höchstens 1 km vom Ufer",
  "LAKES AND SEA": "SEEN UND MEER",
  "Near me": "In meiner Nähe",
  "Choose a lake or a beach: eight shapes on its water, from the shore.":
    "Wähle einen See oder einen Strand: acht Formen auf seinem Wasser, vom Ufer aus.",
  "Choose a start in Draw first: the shapes start from the shore nearest to it.":
    "Wähle zuerst einen Start in Draw: Die Formen beginnen am nächstgelegenen Ufer.",
  "Near your start": "In der Nähe deines Starts",
  "{km} km away": "{km} km entfernt",
  "Type a lake or a beach": "See oder Strand eingeben",
  "No lake or beach matches “{typed}”.": "Kein See oder Strand passt zu „{typed}“.",
  "{shape}, {km} km, on the water": "{shape}, {km} km, auf dem Wasser",
  "{shape}, {mi} mi, on the water": "{shape}, {mi} mi, auf dem Wasser",
  "Not drawn": "Nicht gezeichnet",

  // src/paddle/placeSpots.ts
  "Lake, beach, city or street": "See, Strand, Stadt oder Straße",

  // src/paddle/PaddleNotice.tsx
  "Before you paddle": "Bevor du lospaddelst",
  "Wear a life jacket.": "Trag eine Schwimmweste.",
  "Check the weather and the wind before you go out.":
    "Prüf Wetter und Wind, bevor du rausfährst.",
  "Follow the local rules: swimming areas, boat lanes, harbours. MuW does not know them.":
    "Halte dich an die Regeln vor Ort: Badezonen, Fahrrinnen, Häfen. MuW kennt sie nicht.",
  "The route stays within 1 km of the shore. That does not make it safe or allowed.":
    "Die Route bleibt höchstens 1 km vom Ufer entfernt. Das macht sie weder sicher noch erlaubt.",
  "I understand": "Verstanden",
  "Not now": "Nicht jetzt",

  // src/paddle/MoveShape.tsx, src/route/RoutePanel.tsx
  "Move the shape": "Form verschieben",
  "Drag the shape where you want it, then let go.":
    "Zieh die Form dorthin, wo du sie haben willst, und lass los.",
  "It stays on the water, off the shore, where it fits.":
    "Sie bleibt auf dem Wasser, mit Abstand zum Ufer, wo sie hinpasst.",
  "The shape does not fit there: this is the nearest place.":
    "Dort passt die Form nicht hin: Das ist die nächste Stelle.",

  // src/paddle/waterPlaces.ts
  "from Riva del Garda": "ab Riva del Garda",
  "from Como": "ab Como",
  "from the beach": "vom Strand",

  // src/places/PlaceSearch.tsx
  "City or street": "Stadt oder Straße",
  Search: "Suchen",
  "Searching…": "Suche…",
  "No place found. Try adding the city.":
    "Kein Ort gefunden. Füge die Stadt hinzu und versuche es noch einmal.",
  "The search failed. Check the connection and try again.":
    "Die Suche ist fehlgeschlagen. Prüfe die Verbindung und versuche es noch einmal.",
  "© OpenStreetMap contributors": "© OpenStreetMap-Mitwirkende",

  // src/profile/EditProfile.tsx
  USERNAME: "BENUTZERNAME",
  "3 to 20 letters, digits, _ or .": "3 bis 20 Buchstaben, Ziffern, _ oder .",
  BIO: "BIO",
  "A few words about you": "Ein paar Worte über dich",
  "{length} of {max} characters": "{length} von {max} Zeichen",
  "Saving…": "Wird gespeichert…",
  Save: "Speichern",

  // src/profile/PhotoChoices.tsx
  "Removing…": "Wird entfernt…",
  "Choose a picture": "Bild auswählen",
  "Take a photo": "Foto aufnehmen",
  "Remove picture": "Bild entfernen",

  // src/profile/PhotoRow.tsx
  "Profile picture": "Profilbild",

  // src/profile/ProfileHome.tsx
  "Edit profile": "Profil bearbeiten",
  Favorites: "Favoriten",
  "My activities": "Meine Aktivitäten",
  Settings: "Einstellungen",

  // src/settings/EmailSetting.tsx, PhoneSetting.tsx, contactFields.ts (TASK-183)
  "NEW EMAIL": "NEUE E-MAIL",
  "PHONE NUMBER": "TELEFONNUMMER",
  Add: "Hinzufügen",
  "Remove number": "Nummer entfernen",
  "Only you see your number. Friends who already have it will be able to find you on MuW.":
    "Nur du siehst deine Nummer. Freunde, die sie schon haben, können dich auf MuW finden.",
  "Changing the email is not available on this API yet.":
    "Die E-Mail lässt sich auf dieser API noch nicht ändern.",
  "The phone number is not available on this API yet.":
    "Die Telefonnummer gibt es auf dieser API noch nicht.",
  "This is already the email of your account.":
    "Das ist schon die E-Mail deines Kontos.",
  "Write the number with its country code, like +39 333 123 4567.":
    "Schreib die Nummer mit Ländervorwahl, zum Beispiel +39 333 123 4567.",
  "Wrong password.": "Falsches Passwort.",
  "Another account has this email.": "Ein anderes Konto hat diese E-Mail.",

  // src/screens/SignInScreen.tsx, ForgotPassword.tsx, src/settings/EmailConfirmation.tsx,
  // src/account/accountEmail.ts (TASK-300: the emails of the account)
  "Forgot password?": "Passwort vergessen?",
  "Write the email of your account: we send it a link to choose a new password.":
    "Schreib die E-Mail deines Kontos: Wir schicken einen Link dorthin, um ein neues Passwort zu wählen.",
  "Send the link": "Link senden",
  "If an account has this email, a link is on its way. It works for 1 hour; look in spam too.":
    "Wenn ein Konto diese E-Mail hat, ist ein Link unterwegs. Er gilt 1 Stunde; schau auch im Spam nach.",
  "Back to Log in": "Zurück zu Anmelden",
  "Too many emails asked: wait a few minutes and try again.":
    "Zu viele E-Mails angefordert: Warte ein paar Minuten und versuche es noch einmal.",
  "Email not confirmed": "E-Mail nicht bestätigt",
  "Send the link again": "Link erneut senden",
  "Send again": "Erneut senden",
  "Cancel change": "Änderung abbrechen",
  "Link sent to {email}. Look in spam too.":
    "Link an {email} gesendet. Schau auch im Spam nach.",
  "We sent a link to {email}. Your email changes when you open it.":
    "Wir haben einen Link an {email} gesendet. Deine E-Mail ändert sich, wenn du ihn öffnest.",
  "Waiting for {email}: open the link we sent there.":
    "Warten auf {email}: Öffne den Link, den wir dorthin geschickt haben.",

  // src/settings/NotificationsSetting.tsx, notificationFields.ts
  "Notifications are not available on this API yet.":
    "Benachrichtigungen gibt es auf dieser API noch nicht.",

  // src/profile/SettingsPage.tsx
  "Change email": "E-Mail ändern",
  "Phone number": "Telefonnummer",
  Units: "Einheiten",
  NOTIFICATIONS: "BENACHRICHTIGUNGEN",
  "Email notifications": "E-Mail-Benachrichtigungen",
  "Push notifications": "Push-Benachrichtigungen",
  ABOUT: "INFO",
  Help: "Hilfe",
  Terms: "Nutzungsbedingungen",
  Privacy: "Datenschutz",
  ACCOUNT: "KONTO",
  PREFERENCES: "PRÄFERENZEN",
  "Log out": "Abmelden",
  "Delete your account? Everything that is yours goes with it, at once. It cannot be undone.":
    "Dein Konto löschen? Alles, was dir gehört, wird sofort mitgelöscht. Das kann nicht rückgängig gemacht werden.",
  "Deleting…": "Wird gelöscht…",
  "Delete my account": "Mein Konto löschen",
  "Keep my account": "Mein Konto behalten",
  "Delete account": "Konto löschen",

  // src/profile/UserProfilePage.tsx
  "Log in to see the profiles of the others.":
    "Melde dich an, um die Profile der anderen zu sehen.",
  "This profile is not available.": "Dieses Profil ist nicht verfügbar.",
  "{count} drawing": "{count} Zeichnung",
  "{count} drawings": "{count} Zeichnungen",
  "Loading the profile…": "Profil wird geladen…",
  "{count} follower": "{count} Follower",
  "{count} followers": "{count} Follower",
  "{count} following": "folgt {count}",

  // src/profile/profileFields.ts
  "Editing the profile is not available on this API yet.":
    "Das Profil kann auf dieser API noch nicht bearbeitet werden.",
  "A bio is at most {max} characters.": "Eine Bio hat höchstens {max} Zeichen.",

  // src/profile/useProfilePhoto.ts
  "The camera is off for this app. Allow it in Settings, or choose a picture instead.":
    "Diese App hat keinen Zugriff auf die Kamera. Erlaube ihn in den Einstellungen oder wähle stattdessen ein Bild.",
  "This picture is too large. Choose a smaller one.":
    "Dieses Bild ist zu groß. Wähle ein kleineres.",
  "Could not open the picture. Try again.":
    "Das Bild konnte nicht geöffnet werden. Versuche es noch einmal.",
  "This picture cannot be used. Choose another one.":
    "Dieses Bild kann nicht verwendet werden. Wähle ein anderes.",
  "Profile pictures are not available on this API yet.":
    "Profilbilder sind auf dieser API noch nicht verfügbar.",

  // src/route/RoutePanel.tsx
  "{letters} km of letters + {between} km riding between them":
    "{letters} km Buchstaben + {between} km mit dem Rad dazwischen",
  "{drawn} km of drawing + {between} km walking between the parts":
    "{drawn} km Zeichnung + {between} km zu Fuß zwischen den Teilen",
  "{drawn} km of drawing + {between} km riding between the parts":
    "{drawn} km Zeichnung + {between} km Fahrt zwischen den Teilen",
  "{drawn} km of drawing + {between} km paddling between the parts":
    "{drawn} km Zeichnung + {between} km Paddeln zwischen den Teilen",
  "On the water, a shape of the catalogue.":
    "Auf dem Wasser eine Form aus dem Katalog.",
  "{name} · on the water · target {km} km": "{name} · auf dem Wasser · Ziel {km} km",
  "{name} · on roads · target {km} km": "{name} · auf Straßen · Ziel {km} km",
  // «Draw» with «Miles» (TASK-182 part B): src/route/RoutePanel.tsx,
  // DistanceStepper.tsx, wordInput.ts
  "Distance in miles": "Distanz in Meilen",
  "Enter a distance between {lowest} and {highest} mi.":
    "Gib eine Distanz zwischen {lowest} und {highest} mi ein.",
  "{count} letter: at least {mi} mi. A word takes a few minutes to draw.":
    "{count} Buchstabe: mindestens {mi} mi. Ein Wort zu zeichnen dauert ein paar Minuten.",
  "{count} letters: at least {mi} mi. A word takes a few minutes to draw.":
    "{count} Buchstaben: mindestens {mi} mi. Ein Wort zu zeichnen dauert ein paar Minuten.",
  "Use {mi} mi": "{mi} mi verwenden",
  "{letters} mi of letters + {between} mi riding between them":
    "{letters} mi Buchstaben + {between} mi mit dem Rad dazwischen",
  "{letters} mi of letters + {between} mi walking between them":
    "{letters} mi Buchstaben + {between} mi zu Fuß dazwischen",
  "{drawn} mi of drawing + {between} mi walking between the parts":
    "{drawn} mi Zeichnung + {between} mi zu Fuß zwischen den Teilen",
  "{drawn} mi of drawing + {between} mi riding between the parts":
    "{drawn} mi Zeichnung + {between} mi Fahrt zwischen den Teilen",
  "{drawn} mi of drawing + {between} mi paddling between the parts":
    "{drawn} mi Zeichnung + {between} mi Paddeln zwischen den Teilen",
  "{name} · on the water · target {mi} mi": "{name} · auf dem Wasser · Ziel {mi} mi",
  "{name} · on roads · target {mi} mi": "{name} · auf Straßen · Ziel {mi} mi",
  "Drawing the picture's outline, {mi} mi…":
    "Der Umriss des Bildes wird gezeichnet, {mi} mi…",
  "Drawing “{word}”, {mi} mi…": "„{word}“ wird gezeichnet, {mi} mi…",
  "Drawing a {mi} mi {name}…": "Wird gezeichnet: {name}, {mi} mi…",
  "At most {most} letters: each needs {each} mi, and the app goes up to {highest} mi.":
    "Höchstens {most} Buchstaben: jeder braucht {each} mi, und die App geht bis {highest} mi.",
  "“{word}” needs at least {mi} mi: {each} mi for each letter.":
    "„{word}“ braucht mindestens {mi} mi: {each} mi pro Buchstabe.",

  // src/route/betterDistance.ts
  "This shape comes out better at about {km} km.":
    "Diese Form gelingt bei etwa {km} km besser.",
  "This word comes out better at about {km} km.":
    "Dieses Wort gelingt bei etwa {km} km besser.",
  "This outline comes out better at about {km} km.":
    "Dieser Umriss gelingt bei etwa {km} km besser.",
  "Try {km} km": "{km} km versuchen",
  "This shape comes out better at about {mi} mi.":
    "Diese Form gelingt bei etwa {mi} mi besser.",
  "This word comes out better at about {mi} mi.":
    "Dieses Wort gelingt bei etwa {mi} mi besser.",
  "This outline comes out better at about {mi} mi.":
    "Dieser Umriss gelingt bei etwa {mi} mi besser.",
  "Try {mi} mi": "{mi} mi versuchen",

  // src/route/problems.ts
  "The route could not be drawn. Try again, or try another start.":
    "Die Route konnte nicht gezeichnet werden. Versuche es noch einmal oder mit einem anderen Start.",
  "This word cannot be read right now. Try one of these: {list}.":
    "Dieses Wort kann gerade nicht gelesen werden. Versuche eines von diesen: {list}.",
  "Drawing this route is taking too long. Try again later, or a shorter distance.":
    "Das Zeichnen dieser Route dauert zu lange. Versuche es später noch einmal oder mit einer kürzeren Distanz.",
  "This request was lost. Try again.":
    "Diese Anfrage ist verloren gegangen. Versuche es noch einmal.",
  "There is no lake or sea near this start. Start from the shore, within 2 km of the water.":
    "In der Nähe dieses Starts gibt es keinen See und kein Meer. Starte am Ufer, höchstens 2 km vom Wasser entfernt.",
  "This shape does not fit on the water here at this distance. It fits at about {km} km.":
    "Diese Form passt hier bei dieser Distanz nicht aufs Wasser. Sie passt bei etwa {km} km.",
  "This shape does not fit on the water here. Try a shorter distance, another shape, or another start:":
    "Diese Form passt hier nicht aufs Wasser. Versuch eine kürzere Distanz, eine andere Form oder einen anderen Start:",
  "This shape does not fit the roads here at this distance. It fits at about {mi} mi.":
    "Diese Form passt hier bei dieser Distanz nicht auf die Straßen. Sie passt bei etwa {mi} mi.",
  "This word does not fit the roads here at this distance. It fits at about {mi} mi.":
    "Dieses Wort passt hier bei dieser Distanz nicht auf die Straßen. Es passt bei etwa {mi} mi.",
  "This image does not fit the roads here at this distance. It fits at about {mi} mi.":
    "Dieses Bild passt hier bei dieser Distanz nicht auf die Straßen. Es passt bei etwa {mi} mi.",
  "There is no lake or sea near this start. Start from the shore, within 1 mile of the water.":
    "In der Nähe dieses Starts gibt es keinen See und kein Meer. Starte am Ufer, höchstens 1 Meile vom Wasser entfernt.",
  "This shape does not fit on the water here at this distance. It fits at about {mi} mi.":
    "Diese Form passt hier bei dieser Distanz nicht aufs Wasser. Sie passt bei etwa {mi} mi.",

  // src/route/warnings.ts
  "Includes {distance} walking the bike.":
    "Davon {distance}, auf denen du das Rad schiebst.",

  // src/route/RoutePanel.tsx (TASK-210, «Draw»)
  Shape: "Form",
  Word: "Wort",
  Image: "Bild",
  Round: "Rund",
  Square: "Eckig",
  DRAW: "ZEICHNEN",
  LETTERS: "BUCHSTABEN",
  DISTANCE: "DISTANZ",
  "heart, star, horse…": "Herz, Stern, Pferd…",
  "Lift the pen between parts": "Stift zwischen den Teilen anheben",
  "Lift the pen between letters": "Stift zwischen den Buchstaben anheben",
  "Square letters follow the street grid: best for short words.":
    "Eckige Buchstaben folgen dem Straßenraster: am besten für kurze Wörter.",
  "Enter a distance between {lowest} and {highest} km.":
    "Gib eine Distanz zwischen {lowest} und {highest} km ein.",
  "Long routes take longer: up to a few minutes.":
    "Lange Routen dauern länger: bis zu ein paar Minuten.",
  "Draw route": "Route zeichnen",
  Start: "Start",
  "Preparing GPX…": "GPX wird vorbereitet…",
  "Export GPX": "GPX exportieren",
  "{letters} km of letters + {between} km walking between them":
    "{letters} km Buchstaben + {between} km zu Fuß dazwischen",
  "Press Done and the AI will read it.": "Tippe auf Fertig, und die KI liest es.",
  "The AI is reading it…": "Die KI liest es…",
  "No shape in the catalogue for “{text}”. Describe what it looks like (“prancing horse”, not “Ferrari badge”), or pick one:":
    "Keine Form im Katalog für „{text}“. Beschreibe, wie sie aussieht („springendes Pferd“, nicht „Ferrari-Logo“), oder wähle eine:",
  "Unknown shape. Try: {list}.": "Unbekannte Form. Versuche: {list}.",
  "{count} letter: at least {km} km. A word takes a few minutes to draw.":
    "{count} Buchstabe: mindestens {km} km. Ein Wort zu zeichnen dauert ein paar Minuten.",
  "{count} letters: at least {km} km. A word takes a few minutes to draw.":
    "{count} Buchstaben: mindestens {km} km. Ein Wort zu zeichnen dauert ein paar Minuten.",
  "Use {km} km": "{km} km verwenden",
  Picture: "Bild",
  "Downloading map data for this area…":
    "Kartendaten für dieses Gebiet werden geladen…",
  "Drawing the picture's outline, {km} km…":
    "Der Umriss des Bildes wird gezeichnet, {km} km…",
  "Drawing “{word}”, {km} km…": "„{word}“ wird gezeichnet, {km} km…",
  "Drawing a {km} km {name}…": "Wird gezeichnet: {name}, {km} km…",

  // src/route/problems.ts (TASK-210, «Draw»)
  "This shape does not fit the roads here at this distance. It fits at about {km} km.":
    "Diese Form passt hier bei dieser Distanz nicht auf die Straßen. Sie passt bei etwa {km} km.",
  "This word does not fit the roads here at this distance. It fits at about {km} km.":
    "Dieses Wort passt hier bei dieser Distanz nicht auf die Straßen. Es passt bei etwa {km} km.",
  "This image does not fit the roads here at this distance. It fits at about {km} km.":
    "Dieses Bild passt hier bei dieser Distanz nicht auf die Straßen. Es passt bei etwa {km} km.",
  "This word does not fit the roads here. Try a shorter word, or another start.":
    "Dieses Wort passt hier nicht auf die Straßen. Versuche ein kürzeres Wort oder einen anderen Start.",
  "This outline does not fit the roads here. Try another distance, another start, or a simpler picture.":
    "Dieser Umriss passt hier nicht auf die Straßen. Versuche eine andere Distanz, einen anderen Start oder ein einfacheres Bild.",
  "This shape does not fit the roads here. Try another shape, or another start:":
    "Diese Form passt hier nicht auf die Straßen. Versuche eine andere Form oder einen anderen Start:",
  "Map data for this area could not be downloaded. Try again later.":
    "Die Kartendaten für dieses Gebiet konnten nicht geladen werden. Versuche es später noch einmal.",
  "The route engine cannot find one clear outline in this picture.":
    "In diesem Bild ist kein klarer Umriss zu finden.",
  "Only PNG and JPEG pictures work. Choose another one.":
    "Nur PNG- und JPEG-Bilder funktionieren. Wähle ein anderes.",
  "This picture could not be read. Choose another one.":
    "Dieses Bild konnte nicht gelesen werden. Wähle ein anderes.",
  "The background is too busy. Use one subject on a plain background, like a drawing on white paper or an object on a bare table.":
    "Der Hintergrund ist zu unruhig. Nimm ein Motiv auf einfarbigem Hintergrund, etwa eine Zeichnung auf weißem Papier oder einen Gegenstand auf einem leeren Tisch.",
  "Nothing stands out from the background. Use a subject much darker or brighter than what is around it.":
    "Nichts hebt sich vom Hintergrund ab. Nimm ein Motiv, das viel dunkler oder heller ist als seine Umgebung.",
  "The picture shows more than 4 separate things. Use a picture with 4 subjects at most.":
    "Das Bild zeigt mehr als 4 getrennte Dinge. Nimm ein Bild mit höchstens 4 Motiven.",
  "The subject touches the edge of the picture. Leave some background all around it.":
    "Das Motiv berührt den Bildrand. Lass ringsum etwas Hintergrund.",
  "The subject is too small. Get closer, or use a bigger picture.":
    "Das Motiv ist zu klein. Geh näher heran oder nimm ein größeres Bild.",
  "The outline is too jagged to run on roads. Try a simpler subject.":
    "Der Umriss ist zu zackig, um ihn auf Straßen zu laufen. Versuche ein einfacheres Motiv.",
  "This line cannot be added to the outline. Draw it again.":
    "Diese Linie kann dem Umriss nicht hinzugefügt werden. Zeichne sie noch einmal.",
  "This line is too short to add. Draw a longer one.":
    "Diese Linie ist zu kurz. Zeichne eine längere.",
  "This part covers where a detail starts. Undo the detail first, or draw the part elsewhere.":
    "Dieser Teil überdeckt den Anfang eines Details. Mache zuerst das Detail rückgängig oder zeichne den Teil woanders.",
  "That is too much for one route. Undo something, or draw simpler lines.":
    "Das ist zu viel für eine Route. Mache etwas rückgängig oder zeichne einfachere Linien.",
  "Too many requests to the API in the last minute. Wait a minute, then try again.":
    "Zu viele Anfragen in der letzten Minute. Warte eine Minute und versuche es dann noch einmal.",
  "This phone cannot open the share sheet.":
    "Dieses Telefon kann das Teilen-Menü nicht öffnen.",
  "The GPX could not be saved on the phone. Try again.":
    "Die GPX-Datei konnte nicht auf dem Telefon gespeichert werden. Versuche es noch einmal.",
  "This picture is too large: {mb} MB, at most {most} MB. Choose a smaller one.":
    "Dieses Bild ist zu groß: {mb} MB, höchstens {most} MB. Wähle ein kleineres.",
  "The picture could not be opened. Try again, or choose another one.":
    "Das Bild konnte nicht geöffnet werden. Versuche es noch einmal oder wähle ein anderes.",

  // src/route/warnings.ts (TASK-210, «Draw»; the direction is the compass word)
  "The route starts {distance} {direction} of your start, where the shape fits the roads. Go to “Start here”.":
    "Die Route beginnt {distance} in Richtung {direction} von deinem Start, wo die Form auf die Straßen passt. Geh zu „Hier starten“.",
  "There are {distance} of steps along the way.": "Unterwegs sind {distance} Treppen.",
  "{distance} runs along main roads, with traffic.":
    "{distance} verlaufen auf Hauptstraßen, mit Verkehr.",
  "{distance} runs through tunnels.": "{distance} führen durch Tunnel.",
  "About {share}% of the route goes over the same roads twice.":
    "Etwa {share}% der Route führt zweimal über dieselben Straßen.",
  "About {share}% of the route runs alongside itself.":
    "Etwa {share}% der Route verläuft neben sich selbst.",
  "The route is {share}% longer than asked.":
    "Die Route ist {share}% länger als gewünscht.",
  "The route is {share}% shorter than asked.":
    "Die Route ist {share}% kürzer als gewünscht.",
  "The roads here follow the shape only roughly.":
    "Die Straßen hier folgen der Form nur grob.",
  "Few roads here: the route follows the shape loosely.":
    "Wenige Straßen hier: Die Route folgt der Form nur locker.",
  "The nearest road is {distance} away: the route begins there.":
    "Die nächste Straße ist {distance} entfernt: Dort beginnt die Route.",
  "A bit of the shape has no road to follow, so the route skips it.":
    "Ein Stück der Form hat keine Straße, der es folgen kann, und die Route lässt es aus.",

  // src/route/wordInput.ts (TASK-210, «Draw»)
  "Write a word to draw, with the letters A to Z.":
    "Schreib ein Wort zum Zeichnen, mit den Buchstaben A bis Z.",
  "One word only, without spaces.": "Nur ein Wort, ohne Leerzeichen.",
  "No letter “{letter}”: a word can use only the letters A to Z, without accents.":
    "Kein „{letter}“: Ein Wort darf nur die Buchstaben A bis Z haben, ohne Akzente.",
  "At most {most} letters.": "Höchstens {most} Buchstaben.",
  "At most {most} letters: each needs {each} km, and the app goes up to {highest} km.":
    "Höchstens {most} Buchstaben: jeder braucht {each} km, und die App geht bis {highest} km.",
  "“{word}” needs at least {km} km: {each} km for each letter.":
    "„{word}“ braucht mindestens {km} km: {each} km pro Buchstabe.",

  // src/route/ImageChoice.tsx (TASK-210, «Draw»)
  "Choose another": "Ein anderes wählen",
  "Choose picture": "Bild wählen",
  "Take photo": "Foto aufnehmen",
  "Hide the picture": "Bild ausblenden",
  "Show the picture": "Bild einblenden",
  "Edit the outline": "Umriss bearbeiten",
  "One subject on a plain background works best: a drawing, a logo, an object on a bare table. The route follows its outside line. Up to 4 separate subjects are joined in one line.":
    "Am besten ist ein Motiv auf einfarbigem Hintergrund: eine Zeichnung, ein Logo, ein Gegenstand auf einem leeren Tisch. Die Route folgt seiner Außenlinie. Bis zu 4 getrennte Motive werden zu einer Linie verbunden.",
  "Tracing the outline…": "Umriss wird nachgezeichnet…",
  "The yellow line is what the route will draw. If it does not look like the subject, the route will not either: try another picture, or edit the outline. Separate subjects are joined by a short line, which the route runs there and back.":
    "Die gelbe Linie ist das, was die Route zeichnen wird. Sieht sie nicht aus wie das Motiv, wird es die Route auch nicht: Versuche ein anderes Bild oder bearbeite den Umriss. Getrennte Motive werden durch eine kurze Linie verbunden, die die Route hin und zurück läuft.",

  // src/route/OutlineBoard.tsx (TASK-210, «Draw»)
  "Add a part": "Teil hinzufügen",
  "Add a detail": "Detail hinzufügen",
  "Choose what to add. Two fingers zoom and move the picture.":
    "Wähle, was du hinzufügen willst. Zwei Finger zoomen und verschieben das Bild.",
  "Draw a closed shape. Across the yellow line it becomes part of the outline; anywhere else it is joined to the nearest yellow line.":
    "Zeichne eine geschlossene Form. Über der gelben Linie wird sie Teil des Umrisses; überall sonst wird sie mit der nächsten gelben Linie verbunden.",
  "Draw a line anywhere: it is joined to the nearest yellow line, and the route runs along it and back. Close a loop to make an eye.":
    "Zeichne irgendwo eine Linie: Sie wird mit der nächsten gelben Linie verbunden, und die Route läuft sie hin und zurück. Schließe eine Schleife für ein Auge.",
  Fit: "Einpassen",
  "Adding the part…": "Teil wird hinzugefügt…",
  "Adding the detail…": "Detail wird hinzugefügt…",
  Undo: "Rückgängig",

  // src/route/LoadingBar.tsx (TASK-210, «Draw»: what a screen reader hears)
  "Still waiting": "Warte noch",
  "Drawing the route": "Route wird gezeichnet",
  "Reading the shape": "Form wird gelesen",
  "Loading the map": "Karte wird geladen",

  // src/route/DistanceStepper.tsx (TASK-210, «Draw»)
  "Distance in km": "Distanz in km",
  Shorter: "Kürzer",
  Longer: "Länger",

  // src/route/RouteTiles.tsx, ImagePreview.tsx (TASK-210, «Draw»: what a screen reader hears)
  "Route {label}, {distance}, {likeness} like the shape":
    "Route {label}, {distance}, {likeness} wie die Form",
  "The outline traced from the picture": "Der aus dem Bild gezeichnete Umriss",

  // src/screens/PeopleScreen.tsx
  "Find friends": "Freunde finden",

  // src/screens/ProfileLayer.tsx
  "Profile, log in again": "Profil, erneut anmelden",
  "Profile, {count} follow request": "Profil, {count} Folgeanfrage",
  "Profile, {count} follow requests": "Profil, {count} Folgeanfragen",
  Profile: "Profil",

  // src/screens/ProfileScreen.tsx
  "Your account and everything that was yours have been deleted.":
    "Dein Konto und alles, was dir gehörte, wurden gelöscht.",
  "You are logged out on this phone.": "Du bist auf diesem Handy abgemeldet.",
  Back: "Zurück",

  // src/screens/RunDashboard.tsx
  Speed: "Geschw.",
  "Kilometre {km}: {speed} km/h": "Kilometer {km}: {speed} km/h",
  Mi: "Mi",
  miles: "Meilen",
  "Your first mile will show here.": "Deine erste Meile erscheint hier.",
  "Mile {mile}: {pace}": "Meile {mile}: {pace}",
  "Mile {mile}: {speed} mph": "Meile {mile}: {speed} mph",
  "Your first 500 metres will show here.": "Deine ersten 500 Meter erscheinen hier.",
  "{metres} metres: {pace}": "{metres} Meter: {pace}",

  // src/screens/RunPanel.tsx
  "Speed now": "Geschw.",
  "Avg speed": "Ø Geschw.",
  "Last km": "Letzter km",
  "Last mi": "Letzte mi",
  "Avg /500 m": "Ø /500 m",
  "Last 500 m": "Letzte 500",

  // src/screens/SignInScreen.tsx
  "Sign up": "Registrieren",
  "Log in": "Anmelden",
  EMAIL: "E-MAIL",
  "name@example.com": "name@example.com",
  PASSWORD: "PASSWORT",
  "At least 8 characters": "Mindestens 8 Zeichen",
  "I am at least 16": "Ich bin mindestens 16",
  "Signing up…": "Registrierung…",
  "Logging in…": "Anmeldung…",

  // src/settings/LanguageSetting.tsx
  Language: "Sprache",
  "Phone language": "Sprache des Handys",

  // src/settings/UnitsSetting.tsx
  Kilometres: "Kilometer",
  Miles: "Meilen",
  "Phone units": "Einheiten des Handys",

  // src/settings/ToneSetting.tsx
  Tone: "Darstellung",
  Dark: "Dunkel",
  Light: "Hell",
  Brightness: "Helligkeit",
  "Brightness {step} of {count}": "Helligkeit {step} von {count}",
  Darker: "Dunkler",
  Brighter: "Heller",
  "Preview of the tone": "Vorschau der Darstellung",
  Apply: "Übernehmen",
  "MuW opens again in the new tone.": "MuW öffnet sich neu in der neuen Darstellung.",
  "The phone did not keep the tone. Try again.":
    "Das Handy hat die Darstellung nicht gespeichert. Versuche es noch einmal.",
  "Close MuW and open it again to see the new tone.":
    "Schließe MuW und öffne die App erneut, um die neue Darstellung zu sehen.",

  // src/settings/sport.ts
  "Ride without a route": "Ohne Route fahren",
  "Paddle without a route": "Ohne Route paddeln",
  "Run without a route": "Ohne Route laufen",

  // src/share/PostImage.tsx
  "Drag it to move it. Tap it to take it off.":
    "Ziehen zum Verschieben. Tippen zum Entfernen.",

  // src/share/SharePost.tsx
  "Share your run": "Lauf teilen",
  "Drag the emoji to move them. Tap one to take it off.":
    "Zieh die Emojis, um sie zu verschieben. Tipp auf eines, um es zu entfernen.",
  Results: "Ergebnisse",
  "Add emoji": "Emoji hinzufügen",
  "Add {emoji}": "{emoji} hinzufügen",
  "Up to {count} emoji: tap one on the post to take it off.":
    "Höchstens {count} Emojis: Tipp auf eines im Beitrag, um es zu entfernen.",
  "Making the picture…": "Bild wird erstellt…",
  "Pick Instagram in the list: Story, Feed or Messages.":
    "Wähle Instagram in der Liste: Story, Feed oder Nachrichten.",
  Share: "Teilen",

  // src/share/StravaPostRow.tsx
  "To send this post to Strava, save the run, then share it from «My activities».":
    "Um diesen Beitrag an Strava zu senden, speichere den Lauf und teile ihn dann aus «Meine Aktivitäten».",
  "Update on Strava": "Auf Strava aktualisieren",
  "The activity on Strava has this post's text now.":
    "Die Aktivität auf Strava hat jetzt den Text dieses Beitrags.",
  "Strava did not let MuW change this activity. Change its text on Strava.":
    "Strava hat MuW diese Aktivität nicht ändern lassen. Ändere den Text auf Strava.",
  "Strava takes no pictures from other apps: keep this one in Photos with «Save Image» and add it there.":
    "Strava nimmt keine Bilder aus anderen Apps: leg dieses mit «Bild sichern» in Fotos ab und füg es dort hinzu.",

  // src/share/postRun.ts
  Distance: "Distanz",
  Time: "Zeit",
  Pace: "Pace",

  // src/share/sharePicture.ts
  "The picture could not be made. Try again.":
    "Das Bild konnte nicht erstellt werden. Versuch es noch einmal.",

  // src/social/DrawingCard.tsx
  "Back to the profile": "Zurück zum Profil",

  // src/social/DrawingComments.tsx
  "Opens the comments of this drawing.": "Öffnet die Kommentare zu dieser Zeichnung.",
  Comments: "Kommentare",
  "Delete this comment?": "Diesen Kommentar löschen?",
  Cancel: "Abbrechen",
  "Close the comments": "Kommentare schließen",
  Close: "Schließen",
  "Add a comment…": "Kommentar hinzufügen…",
  Comment: "Kommentar",
  Post: "Posten",
  "{count} of {max} characters": "{count} von {max} Zeichen",
  "Loading the comments…": "Kommentare werden geladen…",
  "No comments yet. Be the first.": "Noch keine Kommentare. Schreib den ersten.",
  "Show more comments": "Mehr Kommentare zeigen",
  "{name}, {ago}: {text}": "{name}, {ago}: {text}",
  "Touch and hold to delete.": "Zum Löschen gedrückt halten.",

  // src/social/DrawingReactions.tsx
  React: "Reagieren",
  "Your reaction: {name}": "Deine Reaktion: {name}",
  "{count} reaction": "{count} Reaktion",
  "{count} reactions": "{count} Reaktionen",

  // src/social/DrawingsGrid.tsx
  Drawings: "Zeichnungen",
  "No public drawings yet. Make a run public in My activities.":
    "Noch keine öffentlichen Zeichnungen. Mach einen Lauf in Meine Aktivitäten öffentlich.",
  "No drawings yet.": "Noch keine Zeichnungen.",

  // src/profile/ProfileStats.tsx, src/profile/ProfileGallery.tsx (TASK-324)
  Likes: "Likes",
  Photos: "Fotos",
  "No photos yet.": "Noch keine Fotos.",
  "No photos yet. Add some to a public drawing in My activities.":
    "Noch keine Fotos. Füge in Meine Aktivitäten welche zu einer öffentlichen Zeichnung hinzu.",

  // src/social/SuperLikeSheet.tsx
  "Super like": "Super-Like",
  "Write a comment to send your super like":
    "Schreib einen Kommentar, um dein Super-Like zu senden",
  Send: "Senden",

  // src/social/reactionKinds.ts
  "MuW heart, super like": "MuW-Herz, Super-Like",
  Fire: "Feuer",
  Clap: "Applaus",
  Strong: "Stark",
  Laugh: "Lachen",
  Wow: "Wow",

  // src/social/commentText.ts
  "You can't write negative comments in this app. Try another app.":
    "In dieser App kannst du keine negativen Kommentare schreiben. Nimm eine andere App.",
  "just now": "gerade eben",
  "{count} min ago": "vor {count} Min.",
  "{count} h ago": "vor {count} Std.",
  "{count} d ago": "vor {count} Tg.",
  "Write a comment": "Kommentar schreiben",
  "{count} comment": "{count} Kommentar",
  "{count} comments": "{count} Kommentare",

  // src/social/drawingsDoor.ts
  "This drawing is no longer public.": "Diese Zeichnung ist nicht mehr öffentlich.",

  // src/social/FollowButton.tsx
  "Stop following {name}?": "{name} nicht mehr folgen?",
  Unfollow: "Entfolgen",
  "Takes your request back.": "Zieht deine Anfrage zurück.",
  Follow: "Folgen",
  Requested: "Angefragt",
  Following: "Folge ich",

  // src/social/FollowLists.tsx
  Requests: "Anfragen",
  Followers: "Follower",
  "Nobody is asking to follow you.": "Niemand möchte dir folgen.",
  "Nobody follows you yet.": "Noch folgt dir niemand.",
  "You are not following anyone yet. Find friends from Feed.":
    "Du folgst noch niemandem. Finde Freunde im Feed.",
  Accept: "Annehmen",
  "Accept {name}": "{name} annehmen",
  Decline: "Ablehnen",
  "Decline {name}": "{name} ablehnen",
  "Follow back": "Zurückfolgen",
  "Follow {name} back": "{name} zurückfolgen",
  Remove: "Entfernen",
  "Remove {name}": "{name} entfernen",
  "Remove {name} from your followers?": "{name} aus deinen Followern entfernen?",

  // src/social/PeopleSearch.tsx
  "Log in to find your friends.": "Melde dich an, um deine Freunde zu finden.",
  "This server cannot look for members yet.":
    "Dieser Server kann noch nicht nach Mitgliedern suchen.",
  Name: "Name",
  "Type at least 2 letters of a name.": "Gib mindestens 2 Buchstaben eines Namens ein.",
  "Nobody has a name like that.": "Niemand hat so einen Namen.",

  // src/strava/StravaActivityRow.tsx
  "Sending to Strava…": "Wird an Strava gesendet…",
  "View on Strava": "Auf Strava ansehen",
  "This run is on Strava.": "Dieser Lauf ist auf Strava.",
  "Strava is still reading this run.": "Strava liest diesen Lauf noch.",
  "Check again": "Erneut prüfen",
  "Send to Strava": "An Strava senden",

  // src/strava/StravaParts.tsx
  "Opening Strava…": "Strava wird geöffnet…",
  "Connect with Strava": "Mit Strava verbinden",
  On: "An",
  Off: "Aus",
  "Name on Strava": "Name auf Strava",
  "Leave empty for an automatic name": "Leer lassen für einen automatischen Namen",

  // src/strava/StravaRunEnd.tsx
  "Connect Strava, and Save sends your runs there too.":
    "Verbinde Strava, dann sendet Speichern deine Läufe auch dorthin.",
  "To {athlete}'s Strava, with Save.":
    "Mit Speichern geht der Lauf auch an das Strava-Konto von {athlete}.",

  // src/strava/StravaSetting.tsx
  "Strava, connected": "Strava, verbunden",
  "Strava, connected as {athlete}": "Strava, verbunden als {athlete}",
  Connected: "Verbunden",
  "Connected as {athlete}": "Verbunden als {athlete}",
  "Disconnect Strava? Runs already sent stay on Strava.":
    "Strava trennen? Bereits gesendete Läufe bleiben auf Strava.",
  Disconnect: "Trennen",
  "Disconnecting…": "Wird getrennt…",
  "Disconnect Strava": "Strava trennen",
  "Send the runs you save in MuW to your Strava profile.":
    "Sende die Läufe, die du in MuW speicherst, an dein Strava-Profil.",

  // src/strava/useStrava.ts
  "Could not open Strava. Try again.":
    "Strava konnte nicht geöffnet werden. Versuche es noch einmal.",

  // The run: src/screens/{NavigateScreen,FreeRunScreen,RunDashboard,RunPanel,
  // FinishScreen,Countdown,HoldButton,PocketScreen,MapScreen}.tsx and
  // src/navigation/runStats.ts (TASK-210, la corsa)
  "Finding your position…": "Position wird gesucht…",
  "You have arrived.": "Ziel erreicht.",
  "Off the route": "Abseits der Route",
  "Head back to the yellow line.": "Kehre zur gelben Linie zurück.",
  "Follow the route to the end.": "Folge der Route bis zum Ende.",
  "Then {directions}": "Dann {directions}",
  "Heading {direction}": "Richtung {direction}",
  north: "Norden",
  "north-east": "Nordosten",
  east: "Osten",
  "south-east": "Südosten",
  south: "Süden",
  "south-west": "Südwesten",
  west: "Westen",
  "north-west": "Nordwesten",
  "You are at your start": "Du bist am Start",
  "Your start: {distance} in a straight line, to the {direction}":
    "Dein Start: {distance} Luftlinie, Richtung {direction}",
  "Your start, in a straight line": "Dein Start, Luftlinie",
  "Your run": "Dein Lauf",
  "Distance: {distance}": "Distanz: {distance}",
  "Distance: {distance} {units}": "Distanz: {distance} {units}",
  "Keep running": "Weiterlaufen",
  "Remember to stretch": "Denk ans Dehnen",
  Stretch: "Dehnen",
  Skip: "Überspringen",
  Done: "Fertig",
  "Pocket mode": "Taschenmodus",
  Pocket: "Tasche",
  Finish: "Beenden",
  Stop: "Stopp",
  "Paused: you stopped moving": "Pause: du bist stehen geblieben",
  Paused: "Pause",
  Resume: "Weiter",
  Pause: "Pause",
  Music: "Musik",
  "Opens Spotify": "Öffnet Spotify",
  Map: "Karte",
  Data: "Daten",
  "Auto-pause": "Auto-Pause",
  Voice: "Stimme",
  "Kilometre {km}: {pace}": "Kilometer {km}: {pace}",
  Km: "Km",
  Change: "Änderung",
  "Your first kilometre will show here.": "Dein erster Kilometer erscheint hier.",
  "Pace now": "Tempo jetzt",
  "Avg pace": "Ø Tempo",
  "Elev. gain": "Anstieg",
  Calories: "Kalorien",
  "{minutes} min": "{minutes} Min.",
  "{hours} h {minutes} min": "{hours} Std. {minutes} Min.",
  "about {minutes} min": "etwa {minutes} Min.",
  "about {hours} h {minutes} min": "etwa {hours} Std. {minutes} Min.",
  "Starting in {number}": "Start in {number}",
  "Get ready": "Mach dich bereit",
  "Hold to end the run": "Halten, um den Lauf zu beenden",
  "Hold to stop": "Zum Stoppen halten",
  "The screen goes dark but stays on, so directions go on. Do not lock the phone: if you press the side button, directions stop. To come back, hold the screen for 2 seconds.":
    "Der Bildschirm wird dunkel, bleibt aber an, damit die Ansagen weitergehen. Sperre das Telefon nicht: Drückst du die Seitentaste, stoppen die Ansagen. Zum Zurückkehren den Bildschirm 2 Sekunden lang gedrückt halten.",
  "Go dark": "Abdunkeln",
  "Pocket mode. Hold for 2 seconds to leave.":
    "Taschenmodus. 2 Sekunden halten, um ihn zu verlassen.",
  "Keep holding…": "Weiter halten…",
  "Hold for 2 seconds to leave pocket mode":
    "2 Sekunden halten, um den Taschenmodus zu verlassen",
  // src/permissions/OpenSettings.tsx, src/location/LocationOff.tsx (TASK-259)
  "Open Settings": "Einstellungen öffnen",
  "Location is off": "Standort ist aus",
  "Allow it for MuW in Settings to follow the route.":
    "Erlaube ihn für MuW in den Einstellungen, um der Route zu folgen.",
  "Allow it for MuW in Settings to record your track.":
    "Erlaube ihn für MuW in den Einstellungen, um deine Strecke aufzuzeichnen.",
  // src/activities/RunEnd.tsx, src/social/PublicParts.tsx, PublicRow.tsx,
  // DrawingCard.tsx (TASK-208)
  "This run could not be kept on the phone. Try again.":
    "Dieser Lauf konnte nicht auf dem Telefon behalten werden. Versuch es noch einmal.",
  "Save to My activities": "In Meine Aktivitäten speichern",
  Tagged: "Markiert",
  "{name}'s profile": "Profil von {name}",
  "Photo {n}": "Foto {n}",
  "Photos of a run only you can see stay on this phone. Delete the app or change phone and they are gone.":
    "Fotos eines Laufs, den nur du siehst, bleiben auf diesem Telefon. Löschst du die App oder wechselst das Telefon, sind sie weg.",
  "Its photos leave MuW and stay only on this phone.":
    "Seine Fotos verlassen MuW und bleiben nur auf diesem Telefon.",
  "Every member sees it in your profile, without the first and last 200 m.":
    "Jedes Mitglied sieht ihn in deinem Profil, ohne die ersten und letzten 200 m.",
  "Your followers see it in your profile, without the first and last 200 m.":
    "Deine Follower sehen ihn in deinem Profil, ohne die ersten und letzten 200 m.",
  "Saved on the phone. It is sent when you are back online.":
    "Auf dem Telefon gespeichert. Wird gesendet, sobald du wieder online bist.",
  "Saved on the phone. Others see it when you are back online.":
    "Auf dem Telefon gespeichert. Andere sehen ihn, sobald du wieder online bist.",
  Bike: "Rad",
  Paddle: "Paddeln",
  Title: "Titel",
  "Give it a name": "Gib ihm einen Namen",
  "How did it go?": "Wie war's?",
  Activity: "Aktivität",
  Everyone: "Alle",
  "Only me": "Nur ich",
  "Who can see it": "Wer kann es sehen",
  "Tag people": "Personen markieren",
  "Remove photo {n}": "Foto {n} entfernen",
  "Add photo": "Foto hinzufügen",
  "This photo could not be kept on the phone. Try again.":
    "Dieses Foto konnte nicht auf dem Telefon behalten werden. Versuch es noch einmal.",

  // «Explore»: src/explore/* (TASK-210, parte C)
  "ASK FOR A ROUTE": "ROUTE ANFRAGEN",
  "A shape through real places {place}. Tap one to make it.":
    "Eine Form durch echte Orte {place}. Tippe auf eine, um sie zu machen.",
  Food: "Essen",
  "Famous Places": "Berühmte Orte",
  Romantic: "Romantisch",
  "Best Views": "Beste Aussichten",
  Shopping: "Shopping",
  Culture: "Kultur",
  Nightlife: "Nachtleben",
  "Hidden Gems": "Geheimtipps",
  Running: "Laufen",
  Walking: "Spazieren",
  Family: "Familie",
  Photography: "Fotografie",
  "Local Experience": "Lokales Leben",
  "More categories": "Weitere Kategorien",
  "More…": "Mehr…",
  "{count} more": "{count} weitere",
  "OR IN YOUR WORDS": "ODER IN DEINEN WORTEN",
  "From {where}. Name a city in the words to go elsewhere.":
    "Los geht es {where}. Nenne eine Stadt in den Worten, um woanders hinzugehen.",
  "Make my route": "Meine Route erstellen",
  "EXAMPLES IN {city}": "BEISPIELE IN {city}",
  "No recommended routes here yet: shapes of {distance} from the centre, drawn now.":
    "Hier gibt es noch keine empfohlenen Routen: Formen von {distance} ab dem Zentrum, jetzt gezeichnet.",
  "Three first, more while you choose.": "Erst drei, weitere während du wählst.",
  "Best near you": "Die besten in deiner Nähe",
  "Starting within {distance} of {place}": "Start innerhalb von {distance} um {place}",
  "your start": "deinen Start",
  "Loading routes…": "Routen werden geladen…",
  "Choose a start first: the routes are the ones near it.":
    "Wähle zuerst einen Start: die Routen sind die in seiner Nähe.",
  "The routes could not load. Check the connection and try again.":
    "Die Routen konnten nicht geladen werden. Prüfe die Verbindung und versuche es noch einmal.",
  // src/explore/IdeasFromEurope.tsx, themedIdeas.ts, ThemedCard.tsx: our ideas
  "IDEAS FROM EUROPE": "IDEEN AUS EUROPA",
  "Make it near me": "In meiner Nähe machen",
  Rome: "Rom",
  Paris: "Paris",
  London: "London",
  Barcelona: "Barcelona",
  Amsterdam: "Amsterdam",
  Lisbon: "Lissabon",
  Prague: "Prag",
  Berlin: "Berlin",
  "Getting directions…": "Wegbeschreibung wird geholt…",
  CITY: "STADT",
  "Type a city or a place": "Stadt oder Ort eingeben",
  "No city or place matches “{typed}”.": "Keine Stadt und kein Ort passt zu „{typed}“.",
  "The search did not answer. Try again.":
    "Die Suche hat nicht geantwortet. Versuche es noch einmal.",
  "A city you chose before": "Eine zuvor gewählte Stadt",
  "The routes near your start": "Die Routen nahe deinem Start",
  "{title} · {city} · looks {percent}% like it":
    "{title} · {city} · {percent}% Ähnlichkeit",
  "Loading the route…": "Route wird geladen…",
  "The route could not load. Try again.":
    "Die Route konnte nicht geladen werden. Versuche es noch einmal.",
  "Drawing a {distance} {title}…": "{title} über {distance} wird gezeichnet…",
  "The GPX could not be made. Try again.":
    "Das GPX konnte nicht erstellt werden. Versuche es noch einmal.",
  "It passes by none of the {found} {theme} found: the shape did not fit near them.":
    "Sie führt an keinem der {found} gefundenen {theme} vorbei: die Form passte nicht in ihre Nähe.",
  "Passes by {passed} of the {found} {theme} found:":
    "Führt an {passed} der {found} gefundenen {theme} vorbei:",
  "Back to Explore": "Zurück zu Explore",
  "MEANWHILE, FROM THE FEED": "INZWISCHEN, AUS DEM FEED",
  "The first time in a city the map has to download: it can take a minute. The shapes show up above as they are ready.":
    "Beim ersten Mal in einer Stadt muss die Karte geladen werden: das kann eine Minute dauern. Die Formen erscheinen oben, sobald sie fertig sind.",
  "The shapes of this city are ready above.":
    "Die Formen dieser Stadt sind oben fertig.",
  "Maps: {credit}": "Karten: {credit}",
  "City centre": "Stadtzentrum",
  "The API did not answer. Check the connection and try again.":
    "Der Server hat nicht geantwortet. Prüfe die Verbindung und versuche es noch einmal.",
  "The map of this area could not be loaded for directions. Try again later.":
    "Die Karte dieser Gegend konnte für die Wegbeschreibung nicht geladen werden. Versuche es später noch einmal.",
  "This route is not on the map the API has: it has no directions.":
    "Diese Route ist nicht auf der Karte des Servers: sie hat keine Wegbeschreibung.",
  "The directions could not be found. Try again.":
    "Die Wegbeschreibung wurde nicht gefunden. Versuche es noch einmal.",
  "The API answered without directions. It may be out of date.":
    "Der Server hat ohne Wegbeschreibung geantwortet. Er ist vielleicht veraltet.",
  "near your start": "in deiner Nähe",
  "near {place}": "nahe {place}",
  "in {city}": "in {city}",
  "e.g. a romantic heart, famous places, food 8 km":
    "z. B. ein romantisches Herz, berühmte Orte, Essen 8 km",
  "e.g. a romantic heart in {city}, 8 km":
    "z. B. ein romantisches Herz in {city}, 8 km",
  // «Sport»: src/settings/{SportSetting,SportButton}.tsx, sport.ts, and the voice
  // of «Data»: src/voice/VoiceSetting.tsx (TASK-210, parte E)
  SPORT: "SPORT",
  Soon: "Demnächst",
  "{sport}, coming soon": "{sport}, demnächst verfügbar",
  "Sport, {sport}": "Sport, {sport}",
  "Changes the sport": "Ändert die Sportart",
  Sport: "Sport",
  Default: "Standard",
  "Voice language and voice: {language}, {voice}":
    "Sprache und Stimme: {language}, {voice}",
  "Changes the language and the voice": "Ändert Sprache und Stimme",
  Listen: "Anhören",
  "Says a turn with this voice": "Sagt eine Abbiegung mit dieser Stimme an",
  "Turn on Voice to listen": "Schalte „Stimme“ ein, um zuzuhören",
  "App language": "Sprache der App",
  "This phone did not list its voices: its own voice speaks.":
    "Dieses Handy hat seine Stimmen nicht aufgelistet: Es spricht seine eigene Stimme.",
  "This phone has no {language} voice: the voice speaks English.":
    "Dieses Handy hat keine Stimme für {language}: Die Stimme spricht Englisch.",
  "{language} · Enhanced": "{language} · Erweitert",

  // The titles of the three pages: src/screens/pageTitles.ts (TASK-210, parte G)
  Feed: "Feed",
  Draw: "Zeichnen",
  Explore: "Entdecken",

  // src/feed/FeedPost.tsx (TASK-118: a member's drawing without a place)
  "{user}: {title}. {facts}.": "{user}: {title}. {facts}.",

  // The shapes' names, the map and «Explore»: src/route/shapeWords.ts,
  // src/map/mapPage.ts, src/explore/{ExploreScreen,ThemedCard}.tsx
  // (TASK-210, parte F)
  "{list} or {last}": "{list} oder {last}",
  "Start here": "Hier starten",
  "NEAR {city}": "IN DER NÄHE VON {city}",
  here: "hier",

  // src/explore/RecommendedRow.tsx (TASK-092)
  RECOMMENDED: "EMPFOHLEN",

  // src/social/ReportMenu.tsx, BlockedPeople.tsx (TASK-121: report and block)
  More: "Mehr",
  "Report or block": "Melden oder blockieren",
  Report: "Melden",
  "Block {user}": "{user} blockieren",
  "Why are you reporting this?": "Warum meldest du das?",
  Spam: "Spam",
  "Offensive or hateful": "Beleidigend oder hasserfüllt",
  "Harassment or bullying": "Belästigung oder Mobbing",
  "Nudity or sexual content": "Nacktheit oder sexuelle Inhalte",
  "Something else": "Etwas anderes",
  "Thanks for telling us. We will look at it.":
    "Danke für den Hinweis. Wir sehen es uns an.",
  "Block {user}?": "{user} blockieren?",
  "You will not see each other's drawings, comments, messages or profile, any follow between you ends and your conversation is deleted. They are not told.":
    "Ihr seht gegenseitig keine Zeichnungen, Kommentare, Nachrichten oder Profile mehr, jedes Folgen zwischen euch endet und eure Unterhaltung wird gelöscht. Die Person erfährt es nicht.",
  Block: "Blockieren",
  "Sending…": "Wird gesendet…",
  "This is not available any more.": "Das ist nicht mehr verfügbar.",
  "Blocked people": "Blockierte Personen",
  "You have not blocked anyone.": "Du hast niemanden blockiert.",
  Unblock: "Freigeben",
  "Unblock {name}": "{name} freigeben",
  "You blocked {user}. Unblock them from Blocked people in your profile.":
    "Du hast {user} blockiert. Freigeben kannst du unter Blockierte Personen in deinem Profil.",

  // src/settings/NotificationsSetting.tsx, notificationFields.ts (TASK-262: push sent)
  "Push notifications tell you at once about follow requests, reactions, comments and tags. Email notifications sends the same news in one email a day at most. Email when I'm away: one email if you don't open MuW for 2 weeks.":
    "Push-Benachrichtigungen melden dir Folgeanfragen, Reaktionen, Kommentare und Markierungen sofort. E-Mail-Benachrichtigungen schicken dieselben Neuigkeiten in höchstens einer E-Mail am Tag. E-Mail, wenn ich weg bin: eine E-Mail, wenn du MuW 2 Wochen lang nicht öffnest.",
  "Notifications are off for MuW on this phone. Allow them in Settings to turn this on.":
    "Mitteilungen für MuW sind auf diesem Telefon aus. Erlaube sie in den Einstellungen, um sie einzuschalten.",

  // src/paddle/PaddleExplore.tsx (TASK-269)
  Lakes: "Seen",
  Sea: "Meer",
  "Suggested near {place}": "Vorschläge in der Nähe von {place}",
  "Suggested near where you usually start":
    "Vorschläge in der Nähe deines üblichen Starts",
  "Suggested near your start": "Vorschläge in der Nähe deines Starts",

  // src/stretch (TASK-285 part B)
  "Quad stretch": "Quadrizeps dehnen",
  "Stand tall. Pull one heel toward your glutes, knees together.":
    "Aufrecht stehen. Eine Ferse zum Gesäß ziehen, Knie zusammen.",
  "Hamstring stretch": "Hintere Oberschenkel dehnen",
  "Put one heel forward, toes up. Lean from the hips, back straight.":
    "Eine Ferse nach vorn, Zehen hoch. Aus der Hüfte beugen, Rücken gerade.",
  "Calf stretch": "Wade dehnen",
  "Step back, heel down. Lean toward the wall until the calf pulls.":
    "Einen Schritt zurück, Ferse am Boden. Zur Wand lehnen, bis die Wade zieht.",
  "Hip flexor stretch": "Hüftbeuger dehnen",
  "Kneel on one knee. Push your hips forward, chest up.":
    "Auf ein Knie gehen. Hüfte nach vorn schieben, Brust hoch.",
  "Glute stretch": "Gesäß dehnen",
  "Cross one ankle over the other knee. Sit back as if into a chair.":
    "Einen Knöchel aufs andere Knie legen. Zurücksetzen wie auf einen Stuhl.",
  "{index} of {total}": "{index} von {total}",
  "Right side": "Rechte Seite",
  "Left side": "Linke Seite",
  "Switch sides": "Seite wechseln",
  "{seconds} seconds left": "Noch {seconds} Sekunden",
  "Stop if it hurts.": "Hör auf, wenn es wehtut.",
  // «Draw»: src/route/samplePictures.ts (TASK-280)
  "Running shoe": "Laufschuh",
  Dinosaur: "Dinosaurier",
  Guitar: "Gitarre",
  "Eiffel Tower": "Eiffelturm",
  Rocket: "Rakete",
  Plane: "Flugzeug",
  Balloon: "Luftballon",
  Leaf: "Blatt",
  Mushroom: "Pilz",
  Car: "Auto",
  "T-shirt": "T-Shirt",
  Boot: "Stiefel",
  House: "Haus",
  Duck: "Ente",
  Trophy: "Pokal",
  Bone: "Knochen",

  // src/route/RoutePanel.tsx (TASK-340: first in «Draw», it opens the map
  // to draw on)
  Freehand: "Freihand",
  // src/mapdraw/DrawOnMap.tsx (TASK-281)
  Move: "Verschieben",
  "Draw with one finger. End where you started to close it. Two fingers move the map.":
    "Zeichne mit einem Finger. Ende, wo du begonnen hast, um sie zu schließen. Zwei Finger bewegen die Karte.",
  "Each new line joins the drawing. Two fingers move the map.":
    "Jede neue Linie wird mit der Zeichnung verbunden. Zwei Finger bewegen die Karte.",
  "Drag the figure or the map. Hold a line still, then drag to bend it. Two fingers resize.":
    "Ziehe die Figur oder die Karte. Halte eine Linie still und ziehe dann, um sie zu biegen. Zwei Finger ändern die Größe.",
  Line: "Linie",
  "Tap point after point. Tap the first point to close it, the last one to finish.":
    "Tippe Punkt für Punkt. Tippe auf den ersten Punkt, um sie zu schließen, auf den letzten, um fertig zu sein.",
  "The outline cannot cross itself. Bend it less.":
    "Der Umriss darf sich nicht kreuzen. Biege ihn weniger.",
  Redo: "Wiederholen",
  "Clear all": "Alles löschen",
  "Clear the whole drawing?": "Die ganze Zeichnung löschen?",
  "+ photo": "+ Foto",

  // src/screens/ChooseScreen.tsx, src/location/PickStart.tsx (TASK-292)
  "Choose on the map": "Auf der Karte wählen",
  "Move the map to put the pin where you want to start.":
    "Verschiebe die Karte, bis die Nadel dort ist, wo du starten willst.",

  // src/share/SharePost.tsx, src/share/videoFile.ts (TASK-295)
  "Export video": "Video exportieren",
  "Making the video… {percent}%": "Video wird erstellt… {percent} %",
  "This phone cannot make the video.": "Dieses Telefon kann das Video nicht erstellen.",
  "The video could not be made. Try again.":
    "Das Video konnte nicht erstellt werden. Versuch es noch einmal.",

  // src/screens/pageTitles.ts, src/game/ (TASK-296: the shape game, «Play»)
  Play: "Spielen",
  "{distance} in total": "{distance} insgesamt",
  "{distance} under {pace}": "{distance} unter {pace}",
  "Best {best} · target {target}": "Beste {best} · Ziel {target}",
  "Longest run {distance}": "Längster Lauf {distance}",
  "Unlocked {date}": "Freigeschaltet {date}",
  "Sign in to collect shapes.": "Melde dich an, um Formen zu sammeln.",
  "{distance} counted so far": "{distance} bisher gezählt",
  "The game is not available right now.": "Das Spiel ist gerade nicht verfügbar.",
  "New shape unlocked": "Neue Form freigeschaltet",
  "New shape unlocked: {name}": "Neue Form freigeschaltet: {name}",
  "It is in your collection.": "Sie ist in deiner Sammlung.",
  "See collection": "Sammlung ansehen",

  // src/navigation/runPosition.ts, the Android notification of a run (TASK-294)
  "MuW is recording your activity": "MuW zeichnet deine Aktivität auf",
  "It keeps going with the screen locked, voice included.":
    "Läuft auch bei gesperrtem Bildschirm weiter, mit Sprachansagen.",

  // src/location/startStatus.ts, src/screens/ChooseScreen.tsx,
  // src/explore/ExploreScreen.tsx, ThemedCard.tsx, src/screens/NavigateScreen.tsx,
  // RunPanel.tsx, src/navigation/runStats.ts, src/intro/SavedLogo.tsx
  // (TASK-210, parte H)
  "Starting from your position.": "Start: deine Position.",
  "Starting from {place}.": "Start: {place}.",
  "Starting from a point on the map.": "Start: ein Punkt auf der Karte.",
  "Search for a city or street to start from.":
    "Suche eine Stadt oder Straße als Start.",
  "Location is off for MuW. Allow it in Settings, or search for a place to start from.":
    "Der Standort ist für MuW aus. Erlaube ihn in den Einstellungen oder suche einen Ort als Start.",
  "Your position is not available right now. Search for a place to start from.":
    "Deine Position ist gerade nicht verfügbar. Suche einen Ort als Start.",
  START: "START",
  "My position": "Meine Position",
  "Another place": "Anderer Ort",
  "No recommended routes near this start yet. Draw one: the best ones will show up here.":
    "In der Nähe dieses Starts gibt es noch keine empfohlenen Routen. Zeichne eine: Die besten erscheinen hier.",
  "{distance} away": "{distance} entfernt",
  "Finding the places and drawing the shape through them… This can take a minute.":
    "Die Orte werden gesucht und die Form durch sie gezeichnet… Das kann eine Minute dauern.",
  "{percent}% drawn": "{percent} % gezeichnet",
  N: "N",
  NE: "NO",
  E: "O",
  SE: "SO",
  S: "S",
  SW: "SW",
  W: "W",
  NW: "NW",
  "{distance} to go": "noch {distance}",
  "Saved to My activities": "In Meine Aktivitäten gespeichert",
  // src/social/ContactsFriends.tsx (TASK-262 C)
  "FROM YOUR CONTACTS": "AUS DEINEN KONTAKTEN",
  "Find friends in your contacts": "Freunde in deinen Kontakten finden",
  "Only coded phone numbers leave the phone, never names. The server compares them with the numbers members saved and keeps none.":
    "Nur verschlüsselte Telefonnummern verlassen das Handy, nie Namen. Der Server vergleicht sie mit den Nummern, die Mitglieder gespeichert haben, und behält keine.",
  "Looking in your contacts…": "Suche in deinen Kontakten…",
  "MuW cannot see your contacts.": "MuW kann deine Kontakte nicht sehen.",
  "No phone numbers in your contacts.":
    "In deinen Kontakten gibt es keine Telefonnummern.",
  "None of your contacts is on MuW yet.": "Noch keiner deiner Kontakte ist bei MuW.",
  "This server cannot look in your contacts yet.":
    "Dieser Server kann noch nicht in deinen Kontakten suchen.",
  "The contacts could not be read.": "Die Kontakte konnten nicht gelesen werden.",
  // «Play», the «Challenges» tab: src/game/{PlayScreen,ChallengesTab,TeamView,
  // ChallengeView,NewChallenge}.tsx, teamsApi.ts, timeLeft.ts, shareCode.ts
  // (TASK-296, parte D)
  Collection: "Sammlung",
  Challenges: "Herausforderungen",
  "Sign in to play with a team.": "Melde dich an, um im Team zu spielen.",
  "Teams are not on this server yet.": "Teams gibt es auf diesem Server noch nicht.",
  "YOUR TEAMS": "DEINE TEAMS",
  "No team yet. Create one, or join one with its code.":
    "Noch kein Team. Gründe eins, oder tritt mit einem Code bei.",
  "Team name": "Teamname",
  Create: "Erstellen",
  "Team code": "Teamcode",
  Join: "Beitreten",
  "{count} member": "{count} Mitglied",
  "{count} members": "{count} Mitglieder",
  "No challenge yet": "Noch keine Herausforderung",
  "{done} of {total} pieces done": "{done} von {total} Teilen geschafft",
  "Code {code}": "Code {code}",
  "Share code": "Code teilen",
  "Join my team «{name}» on MuW: open Play, Challenges, and enter the code {code}.":
    "Komm in mein Team «{name}» bei MuW: öffne Play, Herausforderungen, und gib den Code {code} ein.",
  MEMBERS: "MITGLIEDER",
  Owner: "Besitzer",
  "Leave team": "Team verlassen",
  "Leave this team?": "Dieses Team verlassen?",
  "New challenge": "Neue Herausforderung",
  Pieces: "Teile",
  "Fewer pieces": "Weniger Teile",
  "More pieces": "Mehr Teile",
  "Each piece": "Jedes Teil",
  Fast: "Schnell",
  "Slower pace": "Langsameres Tempo",
  "Faster pace": "Schnelleres Tempo",
  Days: "Tage",
  "Fewer days": "Weniger Tage",
  "More days": "Mehr Tage",
  "Start the challenge": "Herausforderung starten",
  "{count} pieces · {goal} each": "{count} Teile · je {goal}",
  "Piece {n}": "Teil {n}",
  Free: "Frei",
  Yours: "Deins",
  "Taken by {name}": "Genommen von {name}",
  "Done by {name}": "Geschafft von {name}",
  "Take this piece": "Dieses Teil nehmen",
  Leave: "Abgeben",
  "WHO GAVE WHAT": "WER WAS BEIGETRAGEN HAT",
  "Nobody has run yet.": "Noch ist niemand gelaufen.",
  PIECES: "TEILE",
  "Complete! Your team drew it together.":
    "Fertig! Euer Team hat sie zusammen gezeichnet.",
  "Time ran out: {count} piece was missing.": "Die Zeit ist um: {count} Teil fehlte.",
  "Time ran out: {count} pieces were missing.":
    "Die Zeit ist um: {count} Teile fehlten.",
  "{count} day {hours} h left": "Noch {count} Tag {hours} h",
  "{count} days {hours} h left": "Noch {count} Tage {hours} h",
  "{hours} h {minutes} min left": "Noch {hours} h {minutes} min",
  "{minutes} min {seconds} s left": "Noch {minutes} min {seconds} s",
  "Time is up": "Die Zeit ist um",
  "No team with this code.": "Kein Team hat diesen Code.",
  "You can't join this team.": "Du kannst diesem Team nicht beitreten.",
  "You are in 10 teams already: leave one first.":
    "Du bist schon in 10 Teams: verlasse zuerst eins.",
  "This team is not available any more.": "Dieses Team gibt es nicht mehr.",
  "This challenge is not available any more.":
    "Diese Herausforderung gibt es nicht mehr.",
  "The team has a challenge going already: wait for it to end.":
    "Das Team hat schon eine Herausforderung am Laufen: warte, bis sie endet.",
  "This challenge is over.": "Diese Herausforderung ist vorbei.",
  "This piece is not there any more.": "Dieses Teil gibt es nicht mehr.",
  "This piece is done already.": "Dieses Teil ist schon geschafft.",
  "Someone holds this piece already.": "Jemand hat dieses Teil schon.",
  "You hold a piece of this challenge already: leave it first.":
    "Du hast schon ein Teil dieser Herausforderung: gib es zuerst ab.",
  "You don't hold this piece.": "Dieses Teil ist nicht deins.",
  "This name is not allowed. Choose another one.":
    "Dieser Name ist nicht erlaubt. Wähle einen anderen.",
  // src/screens/SignInScreen.tsx, src/settings/NotificationsSetting.tsx
  // (TASK-284 B: the email when away; the names as in its email)
  "If you don't open MuW for 2 weeks, we email you once with what's new.":
    "Wenn du MuW 2 Wochen lang nicht öffnest, schicken wir dir einmal eine E-Mail mit den Neuigkeiten.",
  "Don't send me these emails": "Schickt mir diese E-Mails nicht mehr",
  "Email when I'm away": "E-Mail, wenn ich weg bin",
  None: "Keine",
  Energy: "Energie",
  Chill: "Entspannt",
  Epic: "Episch",
  Sprint: "Sprint",
  Rock: "Rock",
  Funk: "Funk",
  Sunny: "Sonnig",
  Trap: "Trap",
  Retro: "Retro",
  Fiesta: "Fiesta",
  "Tap a track to hear it.": "Tipp auf einen Titel, um ihn zu hören.",
  // src/contest/ (TASK-299 B: the contest card, its rules, the Winner badge)
  "MuW contest": "MuW-Wettbewerb",
  "The post with the most reactions wins.":
    "Der Beitrag mit den meisten Reaktionen gewinnt.",
  "{count} day left": "Noch {count} Tag",
  "{count} days left": "Noch {count} Tage",
  "Ends today": "Endet heute",
  "Ended · the winner is coming": "Beendet · der Gewinner kommt bald",
  "Publish a run to take part.": "Veröffentliche einen Lauf, um mitzumachen.",
  "Your best post: #{rank}, {count} reaction":
    "Dein bester Beitrag: Platz {rank}, {count} Reaktion",
  "Your best post: #{rank}, {count} reactions":
    "Dein bester Beitrag: Platz {rank}, {count} Reaktionen",
  "How it works": "So funktioniert's",
  "Official rules": "Teilnahmebedingungen",
  "Organised by MuW (Luca Pallaoro). Runs from {start} to {end}.":
    "Veranstaltet von MuW (Luca Pallaoro). Zeitraum: {start} bis {end}.",
  "Anyone with a MuW account can take part, for free, by publishing a run for everyone in the app during the contest.":
    "Mitmachen kann kostenlos jede Person mit einem MuW-Konto, indem sie während des Wettbewerbs in der App einen Lauf für alle veröffentlicht.",
  "At the end, the post with the most reactions from other members wins. One reaction per member counts; your own does not. If two posts tie, the one with more MuW hearts wins, then the one published first.":
    "Am Ende gewinnt der Beitrag mit den meisten Reaktionen anderer Mitglieder. Es zählt eine Reaktion pro Mitglied, die eigene zählt nicht. Bei Gleichstand gewinnt der Beitrag mit mehr MuW-Herzen, dann der zuerst veröffentlichte.",
  "The prize has no money value: the winner gets the Winner badge on their profile and their post shown at the top of the Feed for a week.":
    "Der Preis hat keinen Geldwert: Wer gewinnt, bekommt das Gewinner-Abzeichen im Profil, und der Beitrag steht eine Woche lang oben im Feed.",
  "MuW may leave out a post that breaks the community rules.":
    "MuW kann einen Beitrag ausschließen, der gegen die Community-Regeln verstößt.",
  "Apple and Google are not sponsors of this contest and are not involved in it in any way.":
    "Apple und Google sind keine Sponsoren dieses Wettbewerbs und in keiner Weise daran beteiligt.",
  Winner: "Gewinner",
  "{name} won the MuW contest": "{name} hat den MuW-Wettbewerb gewonnen",
  // src/contest/ (TASK-343 B: the monthly challenge, not Play's «Challenges»)
  "Monthly challenge": "Herausforderung des Monats",
  "See the challenge": "Zur Herausforderung",
  "Publish a run and enter it to take part.":
    "Veröffentliche einen Lauf und melde ihn an, um mitzumachen.",
  "Enter “{theme}”": "Bei „{theme}“ anmelden",
  "From {start} to {end}": "{start} bis {end}",
  Ended: "Beendet",
  "{count} person taking part": "{count} Person macht mit",
  "{count} people taking part": "{count} Personen machen mit",
  "You entered {count} drawing": "Du hast {count} Zeichnung angemeldet",
  "You entered {count} drawings": "Du hast {count} Zeichnungen angemeldet",
  "Prize: the Winner badge on your profile and your post at the top of the Feed for a week.":
    "Preis: das Gewinner-Abzeichen in deinem Profil und dein Beitrag eine Woche lang oben im Feed.",
  Top: "Top",
  New: "Neu",
  "Past challenges": "Frühere Herausforderungen des Monats",
  "No past challenges yet.": "Noch keine früheren Herausforderungen des Monats.",
  "No drawings entered yet.": "Noch keine Zeichnung angemeldet.",
  "This challenge takes no entries now.":
    "Diese Herausforderung nimmt gerade keine Anmeldungen an.",
  "This run cannot take part: it must be for everyone, recorded with MuW and published during the challenge.":
    "Dieser Lauf kann nicht mitmachen: Er muss für alle sichtbar, mit MuW aufgezeichnet und während der Herausforderung veröffentlicht sein.",
  "The theme is “{theme}”.": "Das Thema ist „{theme}“.",
  "Anyone with a MuW account can take part, for free: publish a run recorded with MuW for everyone during the challenge, and enter it. You can enter as many drawings as you like, and withdraw them until the challenge ends.":
    "Mitmachen kann kostenlos jede Person mit einem MuW-Konto: Veröffentliche während der Herausforderung einen mit MuW aufgezeichneten Lauf für alle und melde ihn an. Du kannst beliebig viele Zeichnungen anmelden und sie zurückziehen, bis die Herausforderung endet.",
  "At the end, the entered post with the most reactions from other members wins. One reaction per member counts; your own does not. If two posts tie, the one with more MuW hearts wins, then the one published first.":
    "Am Ende gewinnt unter den angemeldeten Beiträgen der mit den meisten Reaktionen anderer Mitglieder. Es zählt eine Reaktion pro Mitglied, die eigene zählt nicht. Bei Gleichstand gewinnt der Beitrag mit mehr MuW-Herzen, dann der zuerst veröffentlichte.",
  "MuW may leave out a post that does not fit the theme or breaks the community rules.":
    "MuW kann einen Beitrag ausschließen, der nicht zum Thema passt oder gegen die Community-Regeln verstößt.",
  // src/route/NearYou.tsx (TASK-306: shapes ready near you, or in other cities)
  "NEAR YOU": "IN DEINER NÄHE",
  "SHAPES TO TRY": "FORMEN ZUM AUSPROBIEREN",
  // src/game/PlayRow.tsx (TASK-327: «Play» under the distance of «Draw»)
  PLAY: "SPIELEN",
  "Collect shapes by running": "Sammle Formen beim Laufen",
  // src/screens/NavigateScreen.tsx (TASK-303)
  "The route is {distance} away, to the {direction}.":
    "Die Route ist {distance} entfernt, Richtung {direction}.",
  "Follow the dotted line back to the route.":
    "Folge der gepunkteten Linie zurück zur Route.",
  // src/social/DrawingCard.tsx (TASK-307: «Start» on a drawing follows its track)
  "This route has no turn directions: follow the line on the map.":
    "Diese Route hat keine Abbiegehinweise: Folge der Linie auf der Karte.",
  // src/game/runStripData.ts (TASK-296 E: the game's line on the run screen)
  "Last km {pace} · target {target}": "Letzter km {pace} · Ziel {target}",
  "Last mi {pace} · target {target}": "Letzte mi {pace} · Ziel {target}",

  // src/settings/FeedbackSetting.tsx, feedbackFields.ts, SettingsPage.tsx (TASK-308)
  "Send feedback": "Feedback senden",
  "Thank you! Your message reached us.":
    "Danke! Deine Nachricht ist bei uns angekommen.",
  "Ideas, problems, anything that would make MuW better: we read every message.":
    "Ideen, Probleme, alles, was MuW besser machen würde: Wir lesen jede Nachricht.",
  "Write here…": "Hier schreiben…",
  "Your message": "Deine Nachricht",
  "It reaches us with your username, your email and the app's version, so we can answer you.":
    "Sie erreicht uns mit deinem Benutzernamen, deiner E-Mail-Adresse und der Version der App, damit wir dir antworten können.",
  "Write something first.": "Schreib zuerst etwas.",
  "You sent a lot of feedback today. Try again tomorrow.":
    "Du hast uns heute schon viel geschrieben. Versuch es morgen wieder.",
  FEEDBACK: "FEEDBACK",
  // src/settings/sport.ts (TASK-305 D0: paragliding, «Soon» in «Sport»)
  Paragliding: "Gleitschirmfliegen",
  // src/explore/ExploredCard.tsx, src/social/DrawingCard.tsx (TASK-313)
  "Draw it near me": "In meiner Nähe zeichnen",
  // src/route/RoutePanel.tsx (TASK-311 B: a word in one line that did not come out)
  "This word may come out better with the pen up: each letter on its own.":
    "Dieses Wort wird mit angehobenem Stift vielleicht besser: jeder Buchstabe für sich.",
  "Lift the pen": "Stift anheben",
  // src/route/RoutePanel.tsx (TASK-317: the wait in «Draw»)
  "Warming up: {name}…": "Aufwärmen: {name}…",
  "Warming up: “{word}”…": "Aufwärmen: „{word}“…",
  "Warming up: the picture…": "Aufwärmen: das Bild…",

  // src/api/messages.ts (TASK-319: private messages)
  "A message needs some words.": "Eine Nachricht braucht ein paar Worte.",
  "A message is at most {max} characters.":
    "Eine Nachricht hat höchstens {max} Zeichen.",
  "Too many messages in a minute. Wait a moment and try again.":
    "Zu viele Nachrichten in einer Minute. Warte kurz und versuche es noch einmal.",
  "You can't send negative messages in this app.":
    "In dieser App kannst du keine negativen Nachrichten schicken.",
  "This conversation is not available.": "Diese Unterhaltung ist nicht verfügbar.",

  // src/messages/ConversationList.tsx, MessagesOverlay.tsx, MessagesRow.tsx, MessageButton.tsx (TASK-319)
  Messages: "Nachrichten",
  "Messages, {count} waiting": "Nachrichten, {count} offen",
  "Message requests": "Nachrichtenanfragen",
  "Message requests, {count} waiting": "Nachrichtenanfragen, {count} offen",
  "No messages yet. Open someone's profile and tap Message to write to them.":
    "Noch keine Nachrichten. Öffne ein Profil und tippe auf Nachricht, um zu schreiben.",
  "No message requests.": "Keine Nachrichtenanfragen.",
  "You: {text}": "Du: {text}",
  "{name}, new message: {text}": "{name}, neue Nachricht: {text}",
  Message: "Nachricht",
  "Message {name}": "{name} eine Nachricht schreiben",

  // src/messages/ConversationScreen.tsx, MessageSheet.tsx (TASK-319)
  "No messages yet.": "Noch keine Nachrichten.",
  "Show earlier messages": "Frühere Nachrichten zeigen",
  "Touch and hold to delete it": "Gedrückt halten, um sie zu löschen",
  "Touch and hold to report it": "Gedrückt halten, um sie zu melden",
  "Message request sent. You can write again when {name} accepts it.":
    "Nachrichtenanfrage gesendet. Du kannst wieder schreiben, wenn {name} sie annimmt.",
  "{name} wants to send you a message.": "{name} möchte dir eine Nachricht schicken.",
  "{name} gets this as a message request. You can send one message until they accept it.":
    "{name} bekommt das als Nachrichtenanfrage. Bis sie angenommen ist, kannst du eine Nachricht schicken.",
  "Write a message…": "Schreib eine Nachricht…",
  "Delete this message for both of you?": "Diese Nachricht für euch beide löschen?",
  "Report this message": "Diese Nachricht melden",
  // src/explore/ExploredCard.tsx, social/DrawingCard.tsx, mapdraw/DrawOnMap.tsx,
  // RoutePanel.tsx, favorites/favoriteRoute.ts (TASK-320, TASK-331: the figure
  // drawn by hand on the map)
  "Edit the drawing": "Zeichnung bearbeiten",
  Erase: "Radieren",
  Drawing: "Zeichnung",
  "Rub a line to erase that piece. A piece cut off joins the drawing with a dash.":
    "Fahre über eine Linie, um das Stück zu radieren. Ein abgetrenntes Stück wird gestrichelt mit der Zeichnung verbunden.",
  // src/imports/, activities/RunEnd.tsx, feed/FeedPost.tsx (TASK-312 B:
  // «Add past activity» from a GPX, TCX or FIT file, «Imported»)
  "Add past activity": "Frühere Aktivität hinzufügen",
  "From a file": "Aus einer Datei",
  "GPX, TCX or FIT from Strava, Garmin, Komoot…":
    "GPX, TCX oder FIT von Strava, Garmin, Komoot…",
  "Export the activity as a file from the other app or its website, save it in Files, then pick it here.":
    "Exportiere die Aktivität als Datei aus der anderen App oder von ihrer Website, speichere sie in Dateien und wähle sie dann hier aus.",
  Imported: "Importiert",
  "Imported activities don't count for Play or contests.":
    "Importierte Aktivitäten zählen nicht für das Spiel und die Wettbewerbe.",
  "This file is not GPX, TCX or FIT.": "Diese Datei ist weder GPX noch TCX noch FIT.",
  "This file has no times: it is a route, not an activity.":
    "Diese Datei hat keine Zeiten: Sie ist eine Route, keine Aktivität.",
  "This file has no positions.": "Diese Datei hat keine Positionen.",
  "This file is too big (over 25 MB).": "Diese Datei ist zu groß (über 25 MB).",
  "Activities before 2020 cannot be added.":
    "Aktivitäten vor 2020 können nicht hinzugefügt werden.",
  "Already in My activities.": "Schon in Meine Aktivitäten.",
  // The attachments of the private messages (TASK-333).
  "📷 Photo": "📷 Foto",
  "🎬 Video": "🎬 Video",
  "🗺️ Drawing": "🗺️ Zeichnung",
  Photo: "Foto",
  Video: "Video",
  "This video has expired.": "Dieses Video ist abgelaufen.",
  "Video, {duration}": "Video, {duration}",
  "Drawing: {title}, {distance}": "Zeichnung: {title}, {distance}",
  "Add a photo, a video or a drawing":
    "Ein Foto, ein Video oder eine Zeichnung hinzufügen",
  "Add a message…": "Eine Nachricht hinzufügen…",
  "Couldn't send. Tap to try again.":
    "Nicht gesendet. Tippe, um es noch einmal zu versuchen.",
  "This video is longer than {seconds} seconds. Choose a shorter one.":
    "Dieses Video ist länger als {seconds} Sekunden. Wähle ein kürzeres.",
  "This video is too large: at most {mb} MB. Choose a shorter one.":
    "Dieses Video ist zu groß: höchstens {mb} MB. Wähle ein kürzeres.",
  "Too many videos today. Try again tomorrow.":
    "Heute schon zu viele Videos. Versuch es morgen wieder.",
  "Too many photos today. Try again tomorrow.":
    "Heute schon zu viele Fotos. Versuch es morgen wieder.",
  "Videos can't be sent right now. Try again later.":
    "Gerade können keine Videos gesendet werden. Versuch es später wieder.",
  // The drawings of the private messages (TASK-333 part C).
  "Send to a friend": "An Freunde senden",
  "Send to…": "Senden an…",
  "Search people": "Personen suchen",
  "Sent to {name}.": "An {name} gesendet.",
  "Send a drawing": "Eine Zeichnung senden",
  "Photos, videos and drawings can be sent once {name} accepts your message.":
    "Fotos, Videos und Zeichnungen kannst du senden, sobald {name} deine Nachricht annimmt.",

  // src/profile/BadgeRow.tsx (TASK-341: the badges of a profile)
  "First drawing": "Erste Zeichnung",
  "10 drawings": "10 Zeichnungen",
  "{distance} drawing": "{distance}-Zeichnung",
  "Not earned yet: {badge}": "Noch nicht erreicht: {badge}",
  // src/messages/messageTime.ts, ConversationList.tsx (TASK-353: times in the chat)
  Today: "Heute",
  Yesterday: "Gestern",
  "{day} {month}": "{day}. {month}",
  "{name}, {count} new messages: {text}": "{name}, {count} neue Nachrichten: {text}",

  // src/route/runTime.ts (TASK-361: the time under the distance of «Draw»)
  "≈ {time} at {pace}": "≈ {time} bei {pace}",
  "≈ {time} at {pace} (a usual pace)": "≈ {time} bei {pace} (ein übliches Tempo)",

  // src/route/ShapePreview.tsx (TASK-361: the shape to scale)
  "{name}, about {size} on the map": "{name}, etwa {size} auf der Karte",

  // src/route/ShapeGrid.tsx (TASK-361: the shapes in two rows)
  "Show fewer shapes": "Weniger Formen zeigen",
  "See all {count} shapes": "Alle {count} Formen ansehen",
  "Show fewer": "Weniger",
  "See all": "Alle ansehen",

  // src/route/DistanceDial.tsx (TASK-361: the distance by half a km)
  "Tap to type the distance": "Tippen, um die Distanz einzugeben",

  // src/screens/RunNoRouteButton.tsx (TASK-361)
  "Records the run without drawing a route first":
    "Zeichnet den Lauf auf, ohne vorher eine Route zu zeichnen",

  // src/route/drawLabel.ts (TASK-361: the words of «Draw route»)
  "Draw a {distance} {name}": "Zeichnen: {name}, {distance}",
  "Draw “{word}”, {distance}": "„{word}“ zeichnen, {distance}",
  "Draw the picture, {distance}": "Das Bild zeichnen, {distance}",

  // src/route/OtherShapeField.tsx (TASK-361: «Type another shape»)
  "Type another shape": "Andere Form eingeben",
  "Write a shape that is not among the tiles":
    "Eine Form schreiben, die nicht unter den Kacheln ist",
};
