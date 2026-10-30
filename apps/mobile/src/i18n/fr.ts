import type { Table } from "./translate";

/**
 * The app's texts in French, by their English text (ADR-0172), in the
 * order of the files that show them. To confirm with someone who speaks it
 * (docs/UI.md).
 */
export const FR: Table = {
  // src/about/AboutPage.tsx
  "Draft — not final yet.": "Brouillon — pas encore définitif.",
  "Last updated: {date}": "Dernière mise à jour : {date}",

  // src/account/fields.ts
  "You must be at least 16 to sign up.":
    "Tu dois avoir au moins 16 ans pour t'inscrire.",
  "Enter the email of your account.": "Saisis l'e-mail de ton compte.",
  "Enter your password.": "Saisis ton mot de passe.",
  "A username is 3 to 20 letters, digits, _ or . (no spaces).":
    "Un nom d'utilisateur compte de 3 à 20 lettres, chiffres, _ ou . (sans espaces).",
  "Enter an email address, like name@example.com.":
    "Saisis une adresse e-mail, comme nom@example.com.",
  "A password is at least {min} characters.":
    "Un mot de passe compte au moins {min} caractères.",
  "A password is at most {max} characters.":
    "Un mot de passe compte au plus {max} caractères.",

  // src/account/messages.ts (TASK-256: words for whoever uses the phone)
  "The app cannot reach the service. Update the app.":
    "L'app ne parvient pas à joindre le service. Mets l'app à jour.",
  "Your session has ended. Log in again.": "Ta session a expiré. Reconnecte-toi.",
  "Something went wrong on our side. Try again in a moment.":
    "Quelque chose n'a pas marché de notre côté. Réessaie dans un instant.",
  "No connection. Check the network and try again.":
    "Pas de connexion. Vérifie le réseau et réessaie.",
  "This email already has an account. Log in instead.":
    "Cet e-mail a déjà un compte. Connecte-toi plutôt.",
  "This username is taken. Try another one.":
    "Ce nom d'utilisateur est déjà pris. Essaie-en un autre.",
  "Wrong email or password.": "E-mail ou mot de passe incorrect.",
  "Accounts are not available right now. Try again later.":
    "Les comptes ne sont pas disponibles pour le moment. Réessaie plus tard.",
  "This version of the app is no longer allowed in. Update the app.":
    "Cette version de l'app n'est plus acceptée. Mets l'app à jour.",
  "Too many tries. Wait a minute and try again.":
    "Trop de tentatives. Attends une minute et réessaie.",
  "Too many tries. Wait {minutes} minutes and try again.":
    "Trop de tentatives. Attends {minutes} minutes et réessaie.",

  // src/activities/ActivitiesList.tsx
  "{count} run is on this phone, waiting for a connection.":
    "{count} course est sur ce téléphone, en attente de connexion.",
  "{count} runs are on this phone, waiting for a connection.":
    "{count} courses sont sur ce téléphone, en attente de connexion.",
  "Loading…": "Chargement…",
  "Show more": "Afficher plus",
  "Loading your activities…": "Chargement de tes activités…",
  "Your activities could not load.": "Impossible de charger tes activités.",
  "Try again": "Réessayer",
  "No activities yet. Save a run when you finish it, and it is kept here.":
    "Pas encore d'activités. Enregistre une course quand tu la termines, et tu la retrouveras ici.",
  "{when}, {where}, {facts}, public, open on the map":
    "{when}, {where}, {facts}, publique, ouvrir sur la carte",
  "{when}, {where}, {facts}, open on the map":
    "{when}, {where}, {facts}, ouvrir sur la carte",
  "Opening…": "Ouverture…",
  Public: "Publique",
  "Delete this run? It cannot be undone.":
    "Supprimer cette course ? C'est irréversible.",
  // «Keep it» answers two questions (a run, Strava): a word that fits both.
  "Keep it": "Annuler",
  "Delete run": "Supprimer la course",
  "Delete the run of {when}": "Supprimer la course du {when}",
  Delete: "Supprimer",
  // A run the API will not take (TASK-257).
  "The server could not take this run: {message}":
    "Le serveur n'a pas pu accepter cette course : {message}",
  "Discard this run? It will not be saved.":
    "Ignorer cette course ? Elle ne sera pas enregistrée.",
  "Discard run": "Ignorer la course",
  "Send the run of {when} again": "Renvoyer la course du {when}",
  "Discard the run of {when}": "Ignorer la course du {when}",
  Discard: "Ignorer",

  // src/activities/ActivityCard.tsx
  "Yellow: the route. White: what you ran.":
    "Jaune : le parcours. Blanc : ce que tu as couru.",
  "White: what you ran.": "Blanc : ce que tu as couru.",
  "Back to the list": "Retour à la liste",

  // src/activities/activitiesDoor.ts
  "Sign up or log in to keep your runs and share them as drawings.":
    "Inscris-toi ou connecte-toi pour garder tes courses et les partager comme dessins.",
  "This run is no longer in your activities.":
    "Cette course n'est plus dans tes activités.",

  // src/activities/activityText.ts
  Sun: "Dim",
  Mon: "Lun",
  Tue: "Mar",
  Wed: "Mer",
  Thu: "Jeu",
  Fri: "Ven",
  Sat: "Sam",
  Jan: "janv.",
  Feb: "févr.",
  Mar: "mars",
  Apr: "avr.",
  May: "mai",
  Jun: "juin",
  Jul: "juil.",
  Aug: "août",
  Sep: "sept.",
  Oct: "oct.",
  Nov: "nov.",
  Dec: "déc.",
  "{weekday} {day} {month} {year}": "{weekday} {day} {month} {year}",
  Run: "Course",

  // src/activities/RunEnd.tsx
  "The phone holds {count} runs not sent yet. Discard one in My activities first.":
    "Le téléphone contient déjà {count} courses non envoyées. Ignorez-en d'abord une dans Mes activités.",
  "The phone holds {count} runs not sent yet. They go when there is a connection; then save this one.":
    "Le téléphone contient déjà {count} courses non envoyées. Elles partent dès qu'il y a une connexion ; enregistrez ensuite celle-ci.",

  // src/api/comments.ts
  "A comment needs some words.": "Un commentaire a besoin de quelques mots.",
  "A comment is at most {max} characters.":
    "Un commentaire fait au plus {max} caractères.",
  "Too many comments in a minute. Wait a moment and try again.":
    "Trop de commentaires en une minute. Attends un instant et réessaie.",
  "The comments of this drawing are not available.":
    "Les commentaires de ce dessin ne sont pas disponibles.",

  // src/api/reactions.ts
  "At least 2 characters": "Au moins 2 caractères",
  "Your reaction wasn't saved. Check the connection.":
    "Ta réaction n'a pas été enregistrée. Vérifie la connexion.",

  // src/api/strava.ts
  "No connection. Try again when you are online.":
    "Pas de connexion. Réessaie quand tu es en ligne.",
  "Strava is taking no more runs for now. Try again later.":
    "Strava n'accepte plus de courses pour le moment. Réessaie plus tard.",
  "Strava could not read this run.": "Strava n'a pas pu lire cette course.",
  "Strava is not connected. Connect it and try again.":
    "Strava n'est pas connecté. Connecte-le et réessaie.",
  "Strava is not available on this API.": "Strava n'est pas disponible sur cette API.",
  "Strava did not answer. Try again in a while.":
    "Strava n'a pas répondu. Réessaie dans un moment.",

  // src/engine/OfflineMapsSetting.tsx
  "Offline maps: {size}": "Cartes hors ligne : {size}",
  "Maps download on Wi-Fi and mobile data.":
    "Les cartes se téléchargent en Wi-Fi et avec les données mobiles.",
  "Add a place": "Ajouter un lieu",
  "Preparing the map…": "Préparation de la carte…",
  "Trying again later": "Nouvel essai plus tard",
  "Up to {count} places.": "Jusqu'à {count} lieux.",
  "Places you add stay on the phone, so shapes there are drawn faster, even without signal.":
    "Les lieux ajoutés restent sur le téléphone : les formes y sont dessinées plus vite, même sans réseau.",

  // src/engine/ZoneNotice.tsx
  "Downloading the maps of your area ({size}) so routes work without signal.":
    "Téléchargement des cartes de ta zone ({size}) pour que les parcours marchent sans réseau.",

  // src/engine/sizeText.ts
  "{size} MB": "{size} Mo",
  "{size} GB": "{size} Go",

  // src/favorites/FavoriteHeart.tsx
  "Remove from favorites": "Retirer des favoris",
  "Add to favorites": "Ajouter aux favoris",

  // src/favorites/FavoritesList.tsx
  "Kept {day} {month} {year}": "Enregistré le {day} {month} {year}",
  "{title}, open on the map": "{title}, ouvrir sur la carte",
  "Remove {title} from favorites": "Retirer {title} des favoris",
  "Loading your favorites…": "Chargement de tes favoris…",
  "Your favorites could not load.": "Impossible de charger tes favoris.",
  "No favorites yet. Tap {heart} on a route on the map to keep it here.":
    "Pas encore de favoris. Touche {heart} sur un parcours de la carte pour le garder ici.",

  // src/favorites/favoriteRoute.ts
  Route: "Parcours",

  // src/favorites/favoritesDoor.ts
  "Sign up or log in to keep your favorite routes.":
    "Inscris-toi ou connecte-toi pour garder tes parcours favoris.",

  // src/feed/FeedAd.tsx
  Sponsored: "Sponsorisé",

  // src/feed/FeedPost.tsx
  "OpenFreeMap © OpenMapTiles\nData from OpenStreetMap":
    "OpenFreeMap © OpenMapTiles\nDonnées d'OpenStreetMap",
  "{user} in {city}: {title}. {facts}.": "{user} à {city} : {title}. {facts}.",
  "Opens the route on the map": "Ouvre le parcours sur la carte",

  // src/health/HealthRunEnd.tsx (TASK-321: Apple Health and Health Connect)
  "Save to Apple Health": "Enregistrer dans Apple Santé",
  "Save to Health Connect": "Enregistrer dans Health Connect",
  "Your activities also go to the Fitness app, with the route.":
    "Tes activités vont aussi dans l'app Forme, avec le parcours.",
  "Your activities also go to Health Connect, with the route.":
    "Tes activités vont aussi dans Health Connect, avec le parcours.",
  "Also to Apple Health, with Save.":
    "Avec Enregistrer, l'activité va aussi dans Apple Santé.",
  "Also to Health Connect, with Save.":
    "Avec Enregistrer, l'activité va aussi dans Health Connect.",
  "MuW can't write to Apple Health. Allow it in the Health app: your profile › Apps › MuW.":
    "MuW ne peut pas écrire dans Apple Santé. Autorise-le dans l'app Santé : ton profil › Apps › MuW.",
  "MuW can't write to Health Connect. Allow it in Health Connect › App permissions › MuW.":
    "MuW ne peut pas écrire dans Health Connect. Autorise-le dans Health Connect › Autorisations des applis › MuW.",

  // src/i18n/shapeNames.ts
  Circle: "Cercle",
  Heart: "Cœur",
  Star: "Étoile",
  Horse: "Cheval",
  Moon: "Lune",
  Cat: "Chat",
  Fish: "Poisson",
  Butterfly: "Papillon",
  Snail: "Escargot",
  "Dog head": "Tête de chien",
  "Rabbit head": "Tête de lapin",
  Pumpkin: "Citrouille",
  "Christmas tree": "Sapin de Noël",
  Smiley: "Smiley",
  Ghost: "Fantôme",
  Donut: "Donut",
  "The sun": "Soleil",

  // src/explore/NearbyTowns.tsx
  "NEARBY TOWNS": "VILLES PROCHES",
  "{town}, {km} km away": "{town}, à {km} km",
  "{mi} mi away": "à {mi} mi",
  "{town}, {mi} mi away": "{town}, à {mi} mi",

  // src/explore/CityWords.tsx
  WORDS: "MOTS",

  // src/intro/AppBoundary.tsx
  "Something went wrong.": "Quelque chose n'a pas marché.",

  // src/map/MapView.tsx
  "The map could not be loaded. Check the network.":
    "La carte n'a pas pu être chargée. Vérifie le réseau.",
  Retry: "Réessayer",

  // src/map/NorthArrow.tsx
  "North arrow": "Flèche du nord",
  "Turns the map north up": "Met le nord en haut",
  "Turns the map like the drawing": "Tourne la carte comme le dessin",

  // src/map/MapKindButton.tsx
  "Map type": "Type de carte",
  Standard: "Standard",
  Satellite: "Satellite",
  "3D": "3D",

  // src/paddle/PaddleExplore.tsx
  Next: "À suivre",
  "Drawing…": "Dessin en cours…",
  "Your start": "Ton départ",
  "On the water": "Sur l'eau",
  "Shapes to paddle, within 1 km of the shore":
    "Des formes à pagayer, à moins de 1 km du rivage",
  "LAKES AND SEA": "LACS ET MER",
  "Near me": "Près de moi",
  "Choose a lake or a beach: eight shapes on its water, from the shore.":
    "Choisis un lac ou une plage : huit formes sur son eau, depuis le rivage.",
  "Choose a start in Draw first: the shapes start from the shore nearest to it.":
    "Choisis d'abord un départ dans Draw : les formes partent du rivage le plus proche.",
  "Near your start": "Près de ton départ",
  "{km} km away": "à {km} km",
  "Type a lake or a beach": "Écris un lac ou une plage",
  "No lake or beach matches “{typed}”.":
    "Aucun lac ou plage ne correspond à « {typed} ».",
  "{shape}, {km} km, on the water": "{shape}, {km} km, sur l'eau",
  "{shape}, {mi} mi, on the water": "{shape}, {mi} mi, sur l'eau",
  "Not drawn": "Non dessiné",

  // src/paddle/placeSpots.ts
  "Lake, beach, city or street": "Lac, plage, ville ou rue",

  // src/paddle/PaddleNotice.tsx
  "Before you paddle": "Avant de pagayer",
  "Wear a life jacket.": "Porte un gilet de sauvetage.",
  "Check the weather and the wind before you go out.":
    "Vérifie la météo et le vent avant de partir.",
  "Follow the local rules: swimming areas, boat lanes, harbours. MuW does not know them.":
    "Respecte les règles locales : zones de baignade, chenaux, ports. MuW ne les connaît pas.",
  "The route stays within 1 km of the shore. That does not make it safe or allowed.":
    "Le parcours reste à moins de 1 km du rivage. Cela ne le rend ni sûr ni autorisé.",
  "I understand": "J'ai compris",
  "Not now": "Pas maintenant",

  // src/paddle/MoveShape.tsx, src/route/RoutePanel.tsx
  "Move the shape": "Déplacer la forme",
  "Drag the shape where you want it, then let go.":
    "Fais glisser la forme où tu veux, puis relâche.",
  "It stays on the water, off the shore, where it fits.":
    "Elle reste sur l'eau, à distance de la rive, là où elle tient.",
  "The shape does not fit there: this is the nearest place.":
    "La forme ne tient pas là : voici l'endroit le plus proche.",

  // src/paddle/waterPlaces.ts
  "from Riva del Garda": "depuis Riva del Garda",
  "from Como": "depuis Côme",
  "from the beach": "depuis la plage",

  // src/places/PlaceSearch.tsx
  "City or street": "Ville ou rue",
  Search: "Rechercher",
  "Searching…": "Recherche…",
  "No place found. Try adding the city.":
    "Aucun lieu trouvé. Essaie d'ajouter la ville.",
  "The search failed. Check the connection and try again.":
    "La recherche a échoué. Vérifie la connexion et réessaie.",
  "© OpenStreetMap contributors": "© contributeurs d'OpenStreetMap",

  // src/profile/EditProfile.tsx
  USERNAME: "NOM D'UTILISATEUR",
  "3 to 20 letters, digits, _ or .": "De 3 à 20 lettres, chiffres, _ ou .",
  BIO: "BIO",
  "A few words about you": "Quelques mots sur toi",
  "{length} of {max} characters": "{length} sur {max} caractères",
  "Saving…": "Enregistrement…",
  Save: "Enregistrer",

  // src/profile/PhotoChoices.tsx
  "Removing…": "Suppression…",
  "Choose a picture": "Choisir une photo",
  "Take a photo": "Prendre une photo",
  "Remove picture": "Retirer la photo",

  // src/profile/PhotoRow.tsx
  "Profile picture": "Photo de profil",

  // src/profile/ProfileHome.tsx
  "Edit profile": "Modifier le profil",
  Favorites: "Favoris",
  "My activities": "Mes activités",
  Settings: "Réglages",

  // src/settings/EmailSetting.tsx, PhoneSetting.tsx, contactFields.ts (TASK-183)
  "NEW EMAIL": "NOUVEL E-MAIL",
  "PHONE NUMBER": "NUMÉRO DE TÉLÉPHONE",
  Add: "Ajouter",
  "Remove number": "Retirer le numéro",
  "Only you see your number. Friends who already have it will be able to find you on MuW.":
    "Toi seul vois ton numéro. Les amis qui l'ont déjà pourront te trouver sur MuW.",
  "Changing the email is not available on this API yet.":
    "Sur cette API, on ne peut pas encore changer l'e-mail.",
  "The phone number is not available on this API yet.":
    "Sur cette API, il n'y a pas encore de numéro de téléphone.",
  "This is already the email of your account.": "C'est déjà l'e-mail de ton compte.",
  "Write the number with its country code, like +39 333 123 4567.":
    "Écris le numéro avec l'indicatif du pays, comme +39 333 123 4567.",
  "Wrong password.": "Mot de passe incorrect.",
  "Another account has this email.": "Un autre compte a cet e-mail.",

  // src/screens/SignInScreen.tsx, ForgotPassword.tsx, src/settings/EmailConfirmation.tsx,
  // src/account/accountEmail.ts (TASK-300: the emails of the account)
  "Forgot password?": "Mot de passe oublié ?",
  "Write the email of your account: we send it a link to choose a new password.":
    "Écris l'e-mail de ton compte : nous y envoyons un lien pour choisir un nouveau mot de passe.",
  "Send the link": "Envoyer le lien",
  "If an account has this email, a link is on its way. It works for 1 hour; look in spam too.":
    "Si un compte a cet e-mail, un lien est en route. Il est valable 1 heure ; regarde aussi dans les spams.",
  "Back to Log in": "Retour à Se connecter",
  "Too many emails asked: wait a few minutes and try again.":
    "Trop d'e-mails demandés : attends quelques minutes et réessaie.",
  "Email not confirmed": "E-mail non confirmé",
  "Send the link again": "Renvoyer le lien",
  "Send again": "Renvoyer",
  "Cancel change": "Annuler le changement",
  "Link sent to {email}. Look in spam too.":
    "Lien envoyé à {email}. Regarde aussi dans les spams.",
  "We sent a link to {email}. Your email changes when you open it.":
    "Nous avons envoyé un lien à {email}. Ton e-mail change quand tu l'ouvres.",
  "Waiting for {email}: open the link we sent there.":
    "En attente de {email} : ouvre le lien que nous y avons envoyé.",

  // src/settings/NotificationsSetting.tsx, notificationFields.ts
  "Notifications are not available on this API yet.":
    "Sur cette API, il n'y a pas encore de notifications.",

  // src/profile/SettingsPage.tsx
  "Change email": "Changer d'e-mail",
  "Phone number": "Numéro de téléphone",
  Units: "Unités",
  NOTIFICATIONS: "NOTIFICATIONS",
  "Email notifications": "Notifications par e-mail",
  "Push notifications": "Notifications push",
  ABOUT: "À PROPOS",
  Help: "Aide",
  Terms: "Conditions",
  Privacy: "Confidentialité",
  ACCOUNT: "COMPTE",
  PREFERENCES: "PRÉFÉRENCES",
  "Log out": "Se déconnecter",
  "Delete your account? Everything that is yours goes with it, at once. It cannot be undone.":
    "Supprimer ton compte ? Tout ce qui est à toi part avec lui, immédiatement. C'est irréversible.",
  "Deleting…": "Suppression…",
  "Delete my account": "Supprimer mon compte",
  "Keep my account": "Garder mon compte",
  "Delete account": "Supprimer le compte",

  // src/profile/UserProfilePage.tsx
  "Log in to see the profiles of the others.":
    "Connecte-toi pour voir les profils des autres.",
  "This profile is not available.": "Ce profil n'est pas disponible.",
  "{count} drawing": "{count} dessin",
  "{count} drawings": "{count} dessins",
  "Loading the profile…": "Chargement du profil…",
  "{count} follower": "{count} abonné",
  "{count} followers": "{count} abonnés",
  "{count} following": "suit {count}",

  // src/profile/profileFields.ts
  "Editing the profile is not available on this API yet.":
    "La modification du profil n'est pas encore disponible sur cette API.",
  "A bio is at most {max} characters.": "Une bio compte au plus {max} caractères.",

  // src/profile/useProfilePhoto.ts
  "The camera is off for this app. Allow it in Settings, or choose a picture instead.":
    "Cette app n'a pas accès à l'appareil photo. Autorise-le dans Réglages, ou choisis plutôt une photo.",
  "This picture is too large. Choose a smaller one.":
    "Cette photo est trop grande. Choisis-en une plus petite.",
  "Could not open the picture. Try again.": "Impossible d'ouvrir la photo. Réessaie.",
  "This picture cannot be used. Choose another one.":
    "Cette photo ne peut pas être utilisée. Choisis-en une autre.",
  "Profile pictures are not available on this API yet.":
    "Les photos de profil ne sont pas encore disponibles sur cette API.",

  // src/route/RoutePanel.tsx
  "{letters} km of letters + {between} km riding between them":
    "{letters} km de lettres + {between} km à vélo entre elles",
  "{drawn} km of drawing + {between} km walking between the parts":
    "{drawn} km de dessin + {between} km à pied entre les parties",
  "{drawn} km of drawing + {between} km riding between the parts":
    "{drawn} km de dessin + {between} km à vélo entre les parties",
  "{drawn} km of drawing + {between} km paddling between the parts":
    "{drawn} km de dessin + {between} km à la pagaie entre les parties",
  "On the water, a shape of the catalogue.": "Sur l'eau, une forme du catalogue.",
  "{name} · on the water · target {km} km": "{name} · sur l'eau · objectif {km} km",
  "{name} · on roads · target {km} km": "{name} · sur route · objectif {km} km",
  // «Draw» with «Miles» (TASK-182 part B): src/route/RoutePanel.tsx,
  // DistanceStepper.tsx, wordInput.ts
  "Distance in miles": "Distance en miles",
  "Enter a distance between {lowest} and {highest} mi.":
    "Saisis une distance entre {lowest} et {highest} mi.",
  "{count} letter: at least {mi} mi. A word takes a few minutes to draw.":
    "{count} lettre : au moins {mi} mi. Dessiner un mot prend quelques minutes.",
  "{count} letters: at least {mi} mi. A word takes a few minutes to draw.":
    "{count} lettres : au moins {mi} mi. Dessiner un mot prend quelques minutes.",
  "Use {mi} mi": "Utiliser {mi} mi",
  "{letters} mi of letters + {between} mi riding between them":
    "{letters} mi de lettres + {between} mi à vélo entre elles",
  "{letters} mi of letters + {between} mi walking between them":
    "{letters} mi de lettres + {between} mi à pied entre elles",
  "{drawn} mi of drawing + {between} mi walking between the parts":
    "{drawn} mi de dessin + {between} mi à pied entre les parties",
  "{drawn} mi of drawing + {between} mi riding between the parts":
    "{drawn} mi de dessin + {between} mi à vélo entre les parties",
  "{drawn} mi of drawing + {between} mi paddling between the parts":
    "{drawn} mi de dessin + {between} mi à la pagaie entre les parties",
  "{name} · on the water · target {mi} mi": "{name} · sur l'eau · objectif {mi} mi",
  "{name} · on roads · target {mi} mi": "{name} · sur route · objectif {mi} mi",
  "Drawing the picture's outline, {mi} mi…": "Dessin du contour de la photo, {mi} mi…",
  "Drawing “{word}”, {mi} mi…": "Dessin de « {word} », {mi} mi…",
  "Drawing a {mi} mi {name}…": "Dessin en cours : {name}, {mi} mi…",
  "At most {most} letters: each needs {each} mi, and the app goes up to {highest} mi.":
    "Au plus {most} lettres : chacune demande {each} mi, et l'app va jusqu'à {highest} mi.",
  "“{word}” needs at least {mi} mi: {each} mi for each letter.":
    "« {word} » demande au moins {mi} mi : {each} mi par lettre.",

  // src/route/betterDistance.ts
  "This shape comes out better at about {km} km.":
    "Cette forme rend mieux à environ {km} km.",
  "This word comes out better at about {km} km.":
    "Ce mot rend mieux à environ {km} km.",
  "This outline comes out better at about {km} km.":
    "Ce contour rend mieux à environ {km} km.",
  "Try {km} km": "Essayer {km} km",
  "This shape comes out better at about {mi} mi.":
    "Cette forme rend mieux à environ {mi} mi.",
  "This word comes out better at about {mi} mi.":
    "Ce mot rend mieux à environ {mi} mi.",
  "This outline comes out better at about {mi} mi.":
    "Ce contour rend mieux à environ {mi} mi.",
  "Try {mi} mi": "Essayer {mi} mi",

  // src/route/problems.ts
  "The route could not be drawn. Try again, or try another start.":
    "Le parcours n'a pas pu être tracé. Réessaie, ou essaie un autre départ.",
  "This word cannot be read right now. Try one of these: {list}.":
    "Ce mot ne peut pas être lu pour le moment. Essaie l'un de ceux-ci : {list}.",
  "Drawing this route is taking too long. Try again later, or a shorter distance.":
    "Le tracé de ce parcours prend trop de temps. Réessaie plus tard, ou avec une distance plus courte.",
  "This request was lost. Try again.": "Cette demande a été perdue. Réessaie.",
  "There is no lake or sea near this start. Start from the shore, within 2 km of the water.":
    "Il n'y a ni lac ni mer près de ce départ. Pars du rivage, à moins de 2 km de l'eau.",
  "This shape does not fit on the water here at this distance. It fits at about {km} km.":
    "Cette forme ne tient pas sur l'eau ici à cette distance. Elle tient à environ {km} km.",
  "This shape does not fit on the water here. Try a shorter distance, another shape, or another start:":
    "Cette forme ne tient pas sur l'eau ici. Essaie une distance plus courte, une autre forme ou un autre départ :",
  "This shape does not fit the roads here at this distance. It fits at about {mi} mi.":
    "Cette forme ne tient pas sur les routes ici à cette distance. Elle tient à environ {mi} mi.",
  "This word does not fit the roads here at this distance. It fits at about {mi} mi.":
    "Ce mot ne tient pas sur les routes ici à cette distance. Il tient à environ {mi} mi.",
  "This image does not fit the roads here at this distance. It fits at about {mi} mi.":
    "Cette image ne tient pas sur les routes ici à cette distance. Elle tient à environ {mi} mi.",
  "There is no lake or sea near this start. Start from the shore, within 1 mile of the water.":
    "Il n'y a ni lac ni mer près de ce départ. Pars du rivage, à moins de 1 mile de l'eau.",
  "This shape does not fit on the water here at this distance. It fits at about {mi} mi.":
    "Cette forme ne tient pas sur l'eau ici à cette distance. Elle tient à environ {mi} mi.",

  // src/route/warnings.ts
  "Includes {distance} walking the bike.": "Dont {distance} à pied, vélo à la main.",

  // src/route/RoutePanel.tsx (TASK-210, «Draw»)
  Shape: "Forme",
  Word: "Mot",
  Image: "Image",
  Round: "Rondes",
  Square: "Carrées",
  DRAW: "DESSINER",
  LETTERS: "LETTRES",
  DISTANCE: "DISTANCE",
  "heart, star, horse…": "cœur, étoile, cheval…",
  "Lift the pen between parts": "Lever le crayon entre les parties",
  "Lift the pen between letters": "Lever le crayon entre les lettres",
  "Square letters follow the street grid: best for short words.":
    "Les lettres carrées suivent la grille des rues : mieux pour les mots courts.",
  "Enter a distance between {lowest} and {highest} km.":
    "Saisis une distance entre {lowest} et {highest} km.",
  "Long routes take longer: up to a few minutes.":
    "Les longs parcours prennent plus de temps : jusqu'à quelques minutes.",
  "Draw route": "Dessiner le parcours",
  Start: "Démarrer",
  "Preparing GPX…": "Préparation du GPX…",
  "Export GPX": "Exporter le GPX",
  "{letters} km of letters + {between} km walking between them":
    "{letters} km de lettres + {between} km à pied entre elles",
  "Press Done and the AI will read it.": "Appuie sur OK et l'IA le lira.",
  "The AI is reading it…": "L'IA le lit…",
  "No shape in the catalogue for “{text}”. Describe what it looks like (“prancing horse”, not “Ferrari badge”), or pick one:":
    "Aucune forme du catalogue pour « {text} ». Décris à quoi elle ressemble (« cheval cabré », pas « écusson Ferrari »), ou choisis-en une :",
  "Unknown shape. Try: {list}.": "Forme inconnue. Essaie : {list}.",
  "{count} letter: at least {km} km. A word takes a few minutes to draw.":
    "{count} lettre : au moins {km} km. Dessiner un mot prend quelques minutes.",
  "{count} letters: at least {km} km. A word takes a few minutes to draw.":
    "{count} lettres : au moins {km} km. Dessiner un mot prend quelques minutes.",
  "Use {km} km": "Utiliser {km} km",
  Picture: "Photo",
  "Downloading map data for this area…": "Téléchargement de la carte de cette zone…",
  "Drawing the picture's outline, {km} km…": "Dessin du contour de la photo, {km} km…",
  "Drawing “{word}”, {km} km…": "Dessin de « {word} », {km} km…",
  "Drawing a {km} km {name}…": "Dessin en cours : {name}, {km} km…",

  // src/route/problems.ts (TASK-210, «Draw»)
  "This shape does not fit the roads here at this distance. It fits at about {km} km.":
    "Cette forme ne tient pas sur les routes ici à cette distance. Elle tient à environ {km} km.",
  "This word does not fit the roads here at this distance. It fits at about {km} km.":
    "Ce mot ne tient pas sur les routes ici à cette distance. Il tient à environ {km} km.",
  "This image does not fit the roads here at this distance. It fits at about {km} km.":
    "Cette image ne tient pas sur les routes ici à cette distance. Elle tient à environ {km} km.",
  "This word does not fit the roads here. Try a shorter word, or another start.":
    "Ce mot ne tient pas sur les routes ici. Essaie un mot plus court ou un autre départ.",
  "This outline does not fit the roads here. Try another distance, another start, or a simpler picture.":
    "Ce contour ne tient pas sur les routes ici. Essaie une autre distance, un autre départ ou une photo plus simple.",
  "This shape does not fit the roads here. Try another shape, or another start:":
    "Cette forme ne tient pas sur les routes ici. Essaie une autre forme ou un autre départ :",
  "Map data for this area could not be downloaded. Try again later.":
    "La carte de cette zone n'a pas pu être téléchargée. Réessaie plus tard.",
  "The route engine cannot find one clear outline in this picture.":
    "Aucun contour net n'a été trouvé dans cette photo.",
  "Only PNG and JPEG pictures work. Choose another one.":
    "Seules les photos PNG et JPEG fonctionnent. Choisis-en une autre.",
  "This picture could not be read. Choose another one.":
    "Cette photo n'a pas pu être lue. Choisis-en une autre.",
  "The background is too busy. Use one subject on a plain background, like a drawing on white paper or an object on a bare table.":
    "L'arrière-plan est trop chargé. Utilise un seul sujet sur un fond uni, comme un dessin sur papier blanc ou un objet sur une table vide.",
  "Nothing stands out from the background. Use a subject much darker or brighter than what is around it.":
    "Rien ne ressort de l'arrière-plan. Utilise un sujet bien plus sombre ou plus clair que ce qui l'entoure.",
  "The picture shows more than 4 separate things. Use a picture with 4 subjects at most.":
    "La photo montre plus de 4 éléments séparés. Utilise une photo avec 4 sujets au plus.",
  "The subject touches the edge of the picture. Leave some background all around it.":
    "Le sujet touche le bord de la photo. Laisse un peu de fond tout autour.",
  "The subject is too small. Get closer, or use a bigger picture.":
    "Le sujet est trop petit. Rapproche-toi ou utilise une photo plus grande.",
  "The outline is too jagged to run on roads. Try a simpler subject.":
    "Le contour est trop irrégulier pour être couru sur les routes. Essaie un sujet plus simple.",
  "This line cannot be added to the outline. Draw it again.":
    "Cette ligne ne peut pas être ajoutée au contour. Dessine-la à nouveau.",
  "This line is too short to add. Draw a longer one.":
    "Cette ligne est trop courte pour être ajoutée. Dessines-en une plus longue.",
  "This part covers where a detail starts. Undo the detail first, or draw the part elsewhere.":
    "Cette partie recouvre le départ d'un détail. Annule d'abord le détail, ou dessine la partie ailleurs.",
  "That is too much for one route. Undo something, or draw simpler lines.":
    "C'est trop pour un seul parcours. Annule quelque chose, ou dessine des lignes plus simples.",
  "Too many requests to the API in the last minute. Wait a minute, then try again.":
    "Trop de demandes dans la dernière minute. Attends une minute, puis réessaie.",
  "This phone cannot open the share sheet.":
    "Ce téléphone ne peut pas ouvrir la feuille de partage.",
  "The GPX could not be saved on the phone. Try again.":
    "Le GPX n'a pas pu être enregistré sur le téléphone. Réessaie.",
  "This picture is too large: {mb} MB, at most {most} MB. Choose a smaller one.":
    "Cette photo est trop grande : {mb} Mo, au plus {most} Mo. Choisis-en une plus petite.",
  "The picture could not be opened. Try again, or choose another one.":
    "La photo n'a pas pu être ouverte. Réessaie, ou choisis-en une autre.",

  // src/route/warnings.ts (TASK-210, «Draw»; the direction is the compass word)
  "The route starts {distance} {direction} of your start, where the shape fits the roads. Go to “Start here”.":
    "Le parcours commence à {distance} de ton départ, direction {direction}, là où la forme tient sur les routes. Va à « Départ ici ».",
  "There are {distance} of steps along the way.":
    "Il y a {distance} d'escaliers sur le chemin.",
  "{distance} runs along main roads, with traffic.":
    "{distance} longent des routes principales, avec de la circulation.",
  "{distance} runs through tunnels.": "{distance} passent dans des tunnels.",
  "About {share}% of the route goes over the same roads twice.":
    "Environ {share}% du parcours passe deux fois par les mêmes routes.",
  "About {share}% of the route runs alongside itself.":
    "Environ {share}% du parcours se longe lui-même.",
  "The route is {share}% longer than asked.":
    "Le parcours est {share}% plus long que demandé.",
  "The route is {share}% shorter than asked.":
    "Le parcours est {share}% plus court que demandé.",
  "The roads here follow the shape only roughly.":
    "Les routes ici ne suivent la forme qu'à peu près.",
  "Few roads here: the route follows the shape loosely.":
    "Peu de routes ici : le parcours suit la forme de loin.",
  "The nearest road is {distance} away: the route begins there.":
    "La route la plus proche est à {distance} : le parcours commence là.",
  "A bit of the shape has no road to follow, so the route skips it.":
    "Un bout de la forme n'a pas de route à suivre, et le parcours le saute.",

  // src/route/wordInput.ts (TASK-210, «Draw»)
  "Write a word to draw, with the letters A to Z.":
    "Écris un mot à dessiner, avec les lettres de A à Z.",
  "One word only, without spaces.": "Un seul mot, sans espaces.",
  "No letter “{letter}”: a word can use only the letters A to Z, without accents.":
    "Pas de « {letter} » : un mot ne peut utiliser que les lettres de A à Z, sans accents.",
  "At most {most} letters.": "Au plus {most} lettres.",
  "At most {most} letters: each needs {each} km, and the app goes up to {highest} km.":
    "Au plus {most} lettres : chacune demande {each} km, et l'app va jusqu'à {highest} km.",
  "“{word}” needs at least {km} km: {each} km for each letter.":
    "« {word} » demande au moins {km} km : {each} km par lettre.",

  // src/route/ImageChoice.tsx (TASK-210, «Draw»)
  "Choose another": "En choisir une autre",
  "Choose picture": "Choisir une photo",
  "Take photo": "Prendre une photo",
  "Hide the picture": "Masquer la photo",
  "Show the picture": "Afficher la photo",
  "Edit the outline": "Modifier le contour",
  "One subject on a plain background works best: a drawing, a logo, an object on a bare table. The route follows its outside line. Up to 4 separate subjects are joined in one line.":
    "Un seul sujet sur un fond uni marche le mieux : un dessin, un logo, un objet sur une table vide. Le parcours suit sa ligne extérieure. Jusqu'à 4 sujets séparés sont reliés en une seule ligne.",
  "Tracing the outline…": "Tracé du contour…",
  "The yellow line is what the route will draw. If it does not look like the subject, the route will not either: try another picture, or edit the outline. Separate subjects are joined by a short line, which the route runs there and back.":
    "La ligne jaune est ce que le parcours dessinera. Si elle ne ressemble pas au sujet, le parcours non plus : essaie une autre photo, ou modifie le contour. Les sujets séparés sont reliés par une courte ligne, que le parcours fait aller et retour.",

  // src/route/OutlineBoard.tsx (TASK-210, «Draw»)
  "Add a part": "Ajouter une partie",
  "Add a detail": "Ajouter un détail",
  "Choose what to add. Two fingers zoom and move the picture.":
    "Choisis quoi ajouter. Deux doigts zooment et déplacent la photo.",
  "Draw a closed shape. Across the yellow line it becomes part of the outline; anywhere else it is joined to the nearest yellow line.":
    "Dessine une forme fermée. Sur la ligne jaune, elle devient partie du contour ; ailleurs, elle est reliée à la ligne jaune la plus proche.",
  "Draw a line anywhere: it is joined to the nearest yellow line, and the route runs along it and back. Close a loop to make an eye.":
    "Dessine une ligne n'importe où : elle est reliée à la ligne jaune la plus proche, et le parcours la fait aller et retour. Ferme une boucle pour faire un œil.",
  Fit: "Ajuster",
  "Adding the part…": "Ajout de la partie…",
  "Adding the detail…": "Ajout du détail…",
  Undo: "Annuler",

  // src/route/LoadingBar.tsx (TASK-210, «Draw»: what a screen reader hears)
  "Still waiting": "Toujours en attente",
  "Drawing the route": "Dessin du parcours",
  "Reading the shape": "Lecture de la forme",
  "Loading the map": "Chargement de la carte",

  // src/route/DistanceStepper.tsx (TASK-210, «Draw»)
  "Distance in km": "Distance en km",
  Shorter: "Plus court",
  Longer: "Plus long",

  // src/route/RouteTiles.tsx, ImagePreview.tsx (TASK-210, «Draw»: what a screen reader hears)
  "Route {label}, {distance}, {likeness} like the shape":
    "Parcours {label}, {distance}, ressemble à la forme à {likeness}",
  "The outline traced from the picture": "Le contour tracé d'après la photo",

  // src/screens/PeopleScreen.tsx
  "Find friends": "Trouver des amis",

  // src/screens/ProfileLayer.tsx
  "Profile, log in again": "Profil, reconnecte-toi",
  "Profile, {count} follow request": "Profil, {count} demande d'abonnement",
  "Profile, {count} follow requests": "Profil, {count} demandes d'abonnement",
  Profile: "Profil",

  // src/screens/ProfileScreen.tsx
  "Your account and everything that was yours have been deleted.":
    "Ton compte et tout ce qui était à toi ont été supprimés.",
  "You are logged out on this phone.": "Ce téléphone n'est plus connecté à ton compte.",
  Back: "Retour",

  // src/screens/RunDashboard.tsx
  Speed: "Vitesse",
  "Kilometre {km}: {speed} km/h": "Kilomètre {km} : {speed} km/h",
  Mi: "Mi",
  miles: "miles",
  "Your first mile will show here.": "Ton premier mile s'affichera ici.",
  "Mile {mile}: {pace}": "Mile {mile} : {pace}",
  "Mile {mile}: {speed} mph": "Mile {mile} : {speed} mph",
  "Your first 500 metres will show here.": "Tes 500 premiers mètres s'afficheront ici.",
  "{metres} metres: {pace}": "{metres} mètres : {pace}",

  // src/screens/RunPanel.tsx
  "Speed now": "Vitesse",
  "Avg speed": "Vit. moy.",
  "Last km": "Dernier km",
  "Last mi": "Dernier mi",
  "Avg /500 m": "Moy. /500 m",
  "Last 500 m": "Dern. 500 m",

  // src/screens/SignInScreen.tsx
  "Sign up": "S'inscrire",
  "Log in": "Se connecter",
  EMAIL: "E-MAIL",
  "name@example.com": "nom@example.com",
  PASSWORD: "MOT DE PASSE",
  "At least 8 characters": "Au moins 8 caractères",
  "I am at least 16": "J'ai au moins 16 ans",
  "Signing up…": "Inscription…",
  "Logging in…": "Connexion…",

  // src/settings/LanguageSetting.tsx
  Language: "Langue",
  "Phone language": "Langue du téléphone",

  // src/settings/UnitsSetting.tsx
  Kilometres: "Kilomètres",
  Miles: "Miles",
  "Phone units": "Unités du téléphone",

  // src/settings/ToneSetting.tsx
  Tone: "Apparence",
  Dark: "Sombre",
  Light: "Clair",
  Brightness: "Luminosité",
  "Brightness {step} of {count}": "Luminosité {step} sur {count}",
  Darker: "Plus sombre",
  Brighter: "Plus clair",
  "Preview of the tone": "Aperçu de l'apparence",
  Apply: "Appliquer",
  "MuW opens again in the new tone.": "MuW se rouvre avec la nouvelle apparence.",
  "The phone did not keep the tone. Try again.":
    "Le téléphone n'a pas enregistré l'apparence. Réessaie.",
  "Close MuW and open it again to see the new tone.":
    "Ferme MuW et rouvre-la pour voir la nouvelle apparence.",

  // src/settings/sport.ts
  "Ride without a route": "Rouler sans parcours",
  "Paddle without a route": "Pagayer sans parcours",
  "Run without a route": "Courir sans parcours",

  // src/share/PostImage.tsx
  "Drag it to move it. Tap it to take it off.":
    "Fais-le glisser pour le déplacer. Touche-le pour le retirer.",

  // src/share/SharePost.tsx
  "Share your run": "Partage ta course",
  "Drag the emoji to move them. Tap one to take it off.":
    "Fais glisser les emojis pour les déplacer. Touches-en un pour le retirer.",
  Results: "Résultats",
  "Add emoji": "Ajouter des emojis",
  "Add {emoji}": "Ajouter {emoji}",
  "Up to {count} emoji: tap one on the post to take it off.":
    "{count} emojis au plus : touches-en un sur la publication pour le retirer.",
  "Making the picture…": "Création de l'image…",
  "Pick Instagram in the list: Story, Feed or Messages.":
    "Choisis Instagram dans la liste : Story, Feed ou Messages.",
  Share: "Partager",

  // src/share/StravaPostRow.tsx
  "To send this post to Strava, save the run, then share it from «My activities».":
    "Pour envoyer cette publication sur Strava, enregistre la course, puis partage-la depuis « Mes activités ».",
  "Update on Strava": "Mettre à jour sur Strava",
  "The activity on Strava has this post's text now.":
    "L'activité sur Strava a maintenant le texte de cette publication.",
  "Strava did not let MuW change this activity. Change its text on Strava.":
    "Strava n'a pas laissé MuW modifier cette activité. Modifie son texte sur Strava.",
  "Strava takes no pictures from other apps: keep this one in Photos with «Save Image» and add it there.":
    "Strava n'accepte pas les images d'autres apps : garde celle-ci dans Photos avec « Enregistrer l'image » et ajoute-la là-bas.",

  // src/share/postRun.ts
  Distance: "Distance",
  Time: "Temps",
  Pace: "Allure",

  // src/share/sharePicture.ts
  "The picture could not be made. Try again.":
    "L'image n'a pas pu être créée. Réessaie.",

  // src/social/DrawingCard.tsx
  "Back to the profile": "Retour au profil",

  // src/social/DrawingComments.tsx
  "Opens the comments of this drawing.": "Ouvre les commentaires de ce dessin.",
  Comments: "Commentaires",
  "Delete this comment?": "Supprimer ce commentaire ?",
  Cancel: "Annuler",
  "Close the comments": "Fermer les commentaires",
  Close: "Fermer",
  "Add a comment…": "Ajouter un commentaire…",
  Comment: "Commentaire",
  Post: "Publier",
  "{count} of {max} characters": "{count} sur {max} caractères",
  "Loading the comments…": "Chargement des commentaires…",
  "No comments yet. Be the first.": "Pas encore de commentaires. Écris le premier.",
  "Show more comments": "Afficher plus de commentaires",
  "{name}, {ago}: {text}": "{name}, {ago} : {text}",
  "Touch and hold to delete.": "Maintiens appuyé pour supprimer.",

  // src/social/DrawingReactions.tsx
  React: "Réagir",
  "Your reaction: {name}": "Ta réaction : {name}",
  "{count} reaction": "{count} réaction",
  "{count} reactions": "{count} réactions",

  // src/social/DrawingsGrid.tsx
  Drawings: "Dessins",
  "No public drawings yet. Make a run public in My activities.":
    "Pas encore de dessins publics. Rends une course publique dans Mes activités.",
  "No drawings yet.": "Pas encore de dessins.",

  // src/profile/ProfileStats.tsx, src/profile/ProfileGallery.tsx (TASK-324)
  Likes: "J'aime",
  Photos: "Photos",
  "No photos yet.": "Pas encore de photos.",
  "No photos yet. Add some to a public drawing in My activities.":
    "Pas encore de photos. Ajoutes-en à un dessin public dans Mes activités.",

  // src/social/SuperLikeSheet.tsx
  "Super like": "Super like",
  "Write a comment to send your super like":
    "Écris un commentaire pour envoyer ton super like",
  Send: "Envoyer",

  // src/social/reactionKinds.ts
  "MuW heart, super like": "Cœur MuW, super like",
  Fire: "Feu",
  Clap: "Applaudissement",
  Strong: "Force",
  Laugh: "Rire",
  Wow: "Wow",

  // src/social/commentText.ts
  "You can't write negative comments in this app. Try another app.":
    "Dans cette app, tu ne peux pas écrire de commentaires négatifs. Change d'app.",
  "just now": "à l'instant",
  "{count} min ago": "il y a {count} min",
  "{count} h ago": "il y a {count} h",
  "{count} d ago": "il y a {count} j",
  "Write a comment": "Écrire un commentaire",
  "{count} comment": "{count} commentaire",
  "{count} comments": "{count} commentaires",

  // src/social/drawingsDoor.ts
  "This drawing is no longer public.": "Ce dessin n'est plus public.",

  // src/social/FollowButton.tsx
  "Stop following {name}?": "Ne plus suivre {name} ?",
  Unfollow: "Ne plus suivre",
  "Takes your request back.": "Retire ta demande.",
  Follow: "Suivre",
  Requested: "Demandé",
  Following: "Suivis",

  // src/social/FollowLists.tsx
  Requests: "Demandes",
  Followers: "Abonnés",
  "Nobody is asking to follow you.": "Personne ne demande à te suivre.",
  "Nobody follows you yet.": "Personne ne te suit encore.",
  "You are not following anyone yet. Find friends from Feed.":
    "Tu ne suis encore personne. Trouve des amis depuis Feed.",
  Accept: "Accepter",
  "Accept {name}": "Accepter {name}",
  Decline: "Refuser",
  "Decline {name}": "Refuser {name}",
  "Follow back": "Suivre en retour",
  "Follow {name} back": "Suivre {name} en retour",
  Remove: "Retirer",
  "Remove {name}": "Retirer {name}",
  "Remove {name} from your followers?": "Retirer {name} de tes abonnés ?",

  // src/social/PeopleSearch.tsx
  "Log in to find your friends.": "Connecte-toi pour trouver tes amis.",
  "This server cannot look for members yet.":
    "Ce serveur ne peut pas encore chercher des membres.",
  Name: "Nom",
  "Type at least 2 letters of a name.": "Tape au moins 2 lettres d'un nom.",
  "Nobody has a name like that.": "Personne n'a un nom comme ça.",

  // src/strava/StravaActivityRow.tsx
  "Sending to Strava…": "Envoi vers Strava…",
  "View on Strava": "Voir sur Strava",
  "This run is on Strava.": "Cette course est sur Strava.",
  "Strava is still reading this run.": "Strava lit encore cette course.",
  "Check again": "Vérifier à nouveau",
  "Send to Strava": "Envoyer vers Strava",

  // src/strava/StravaParts.tsx
  "Opening Strava…": "Ouverture de Strava…",
  "Connect with Strava": "Se connecter avec Strava",
  On: "Oui",
  Off: "Non",
  "Name on Strava": "Nom sur Strava",
  "Leave empty for an automatic name": "Laisse vide pour un nom automatique",

  // src/strava/StravaRunEnd.tsx
  "Connect Strava, and Save sends your runs there too.":
    "Connecte Strava, et Enregistrer y enverra aussi tes courses.",
  "To {athlete}'s Strava, with Save.":
    "Avec Enregistrer, elle part aussi sur le Strava de {athlete}.",

  // src/strava/StravaSetting.tsx
  "Strava, connected": "Strava, connecté",
  "Strava, connected as {athlete}": "Strava, connecté en tant que {athlete}",
  Connected: "Connecté",
  "Connected as {athlete}": "Connecté en tant que {athlete}",
  "Disconnect Strava? Runs already sent stay on Strava.":
    "Déconnecter Strava ? Les courses déjà envoyées restent sur Strava.",
  Disconnect: "Déconnecter",
  "Disconnecting…": "Déconnexion…",
  "Disconnect Strava": "Déconnecter Strava",
  "Send the runs you save in MuW to your Strava profile.":
    "Envoie vers ton profil Strava les courses que tu enregistres dans MuW.",

  // src/strava/useStrava.ts
  "Could not open Strava. Try again.": "Impossible d'ouvrir Strava. Réessaie.",

  // The run: src/screens/{NavigateScreen,FreeRunScreen,RunDashboard,RunPanel,
  // FinishScreen,Countdown,HoldButton,PocketScreen,MapScreen}.tsx and
  // src/navigation/runStats.ts (TASK-210, la corsa)
  "Finding your position…": "Recherche de votre position…",
  "You have arrived.": "Vous êtes à l'arrivée.",
  "Off the route": "Hors du parcours",
  "Head back to the yellow line.": "Revenez sur la ligne jaune.",
  "Follow the route to the end.": "Suivez le parcours jusqu'au bout.",
  "Then {directions}": "Puis {directions}",
  "Heading {direction}": "Cap {direction}",
  north: "nord",
  "north-east": "nord-est",
  east: "est",
  "south-east": "sud-est",
  south: "sud",
  "south-west": "sud-ouest",
  west: "ouest",
  "north-west": "nord-ouest",
  "You are at your start": "Vous êtes au départ",
  "Your start: {distance} in a straight line, to the {direction}":
    "Votre départ : {distance} à vol d'oiseau, vers le {direction}",
  "Your start, in a straight line": "Votre départ, à vol d'oiseau",
  "Your run": "Votre course",
  "Distance: {distance}": "Distance : {distance}",
  "Distance: {distance} {units}": "Distance : {distance} {units}",
  "Keep running": "Continuer à courir",
  "Remember to stretch": "Pensez à vous étirer",
  Stretch: "S'étirer",
  Skip: "Passer",
  Done: "Terminé",
  "Pocket mode": "Mode poche",
  Pocket: "Poche",
  Finish: "Terminer",
  Stop: "Stop",
  "Paused: you stopped moving": "En pause : vous vous êtes arrêté",
  Paused: "En pause",
  Resume: "Reprendre",
  Pause: "Pause",
  Music: "Musique",
  "Opens Spotify": "Ouvre Spotify",
  Map: "Carte",
  Data: "Données",
  "Auto-pause": "Pause auto",
  Voice: "Voix",
  "Kilometre {km}: {pace}": "Kilomètre {km} : {pace}",
  Km: "Km",
  Change: "Écart",
  "Your first kilometre will show here.": "Votre premier kilomètre s'affichera ici.",
  "Pace now": "Allure actuelle",
  "Avg pace": "Allure moy.",
  "Elev. gain": "Dénivelé",
  Calories: "Calories",
  "{minutes} min": "{minutes} min",
  "{hours} h {minutes} min": "{hours} h {minutes} min",
  "about {minutes} min": "environ {minutes} min",
  "about {hours} h {minutes} min": "environ {hours} h {minutes} min",
  "Starting in {number}": "Départ dans {number}",
  "Get ready": "Préparez-vous",
  "Hold to end the run": "Maintenez pour terminer la course",
  "Hold to stop": "Maintenez pour arrêter",
  "The screen goes dark but stays on, so directions go on. Do not lock the phone: if you press the side button, directions stop. To come back, hold the screen for 2 seconds.":
    "L'écran s'assombrit mais reste allumé, les indications continuent. Ne verrouillez pas le téléphone : si vous appuyez sur le bouton latéral, les indications s'arrêtent. Pour revenir, maintenez l'écran enfoncé 2 secondes.",
  "Go dark": "Assombrir",
  "Pocket mode. Hold for 2 seconds to leave.":
    "Mode poche. Maintenez 2 secondes pour quitter.",
  "Keep holding…": "Continuez à maintenir…",
  "Hold for 2 seconds to leave pocket mode":
    "Maintenez 2 secondes pour quitter le mode poche",
  // src/permissions/OpenSettings.tsx, src/location/LocationOff.tsx (TASK-259)
  "Open Settings": "Ouvrir Réglages",
  "Location is off": "La localisation est désactivée",
  "Allow it for MuW in Settings to follow the route.":
    "Autorise-la pour MuW dans Réglages pour suivre le parcours.",
  "Allow it for MuW in Settings to record your track.":
    "Autorise-la pour MuW dans Réglages pour enregistrer ta trace.",
  // src/activities/RunEnd.tsx, src/social/PublicParts.tsx, PublicRow.tsx,
  // DrawingCard.tsx (TASK-208)
  "This run could not be kept on the phone. Try again.":
    "Cette course n'a pas pu être gardée sur le téléphone. Réessaie.",
  "Save to My activities": "Enregistrer dans Mes activités",
  Tagged: "Identifiés",
  "{name}'s profile": "Profil de {name}",
  "Photo {n}": "Photo {n}",
  "Photos of a run only you can see stay on this phone. Delete the app or change phone and they are gone.":
    "Les photos d'une course que toi seul vois restent sur ce téléphone. Si tu supprimes l'app ou changes de téléphone, elles sont perdues.",
  "Its photos leave MuW and stay only on this phone.":
    "Ses photos quittent MuW et restent seulement sur ce téléphone.",
  "Every member sees it in your profile, without the first and last 200 m.":
    "Chaque membre la voit dans ton profil, sans les 200 premiers et derniers mètres.",
  "Your followers see it in your profile, without the first and last 200 m.":
    "Tes abonnés la voient dans ton profil, sans les 200 premiers et derniers mètres.",
  "Saved on the phone. It is sent when you are back online.":
    "Enregistrée sur le téléphone. Elle est envoyée quand tu seras de nouveau en ligne.",
  "Saved on the phone. Others see it when you are back online.":
    "Enregistrée sur le téléphone. Les autres la voient quand tu seras de nouveau en ligne.",
  Bike: "Vélo",
  Paddle: "Pagaie",
  Title: "Titre",
  "Give it a name": "Donne-lui un nom",
  "How did it go?": "Comment ça s'est passé ?",
  Activity: "Activité",
  Everyone: "Tout le monde",
  "Only me": "Moi seulement",
  "Who can see it": "Qui peut la voir",
  "Tag people": "Identifier des personnes",
  "Remove photo {n}": "Retirer la photo {n}",
  "Add photo": "Ajouter une photo",
  "This photo could not be kept on the phone. Try again.":
    "Cette photo n'a pas pu être gardée sur le téléphone. Réessaie.",

  // «Explore»: src/explore/* (TASK-210, parte C)
  "ASK FOR A ROUTE": "DEMANDER UN PARCOURS",
  "A shape through real places {place}. Tap one to make it.":
    "Une forme à travers de vrais lieux {place}. Touchez-en une pour la créer.",
  Food: "Gastronomie",
  "Famous Places": "Lieux célèbres",
  Romantic: "Romantique",
  "Best Views": "Belles vues",
  Shopping: "Shopping",
  Culture: "Culture",
  Nightlife: "Vie nocturne",
  "Hidden Gems": "Coins cachés",
  Running: "Course",
  Walking: "Promenade",
  Family: "Famille",
  Photography: "Photographie",
  "Local Experience": "Vie locale",
  "More categories": "Plus de catégories",
  "More…": "Plus…",
  "{count} more": "{count} de plus",
  "OR IN YOUR WORDS": "OU AVEC VOS MOTS",
  "From {where}. Name a city in the words to go elsewhere.":
    "Départ {where}. Nommez une ville dans les mots pour aller ailleurs.",
  "Make my route": "Créer mon parcours",
  "EXAMPLES IN {city}": "EXEMPLES À {city}",
  "No recommended routes here yet: shapes of {distance} from the centre, drawn now.":
    "Pas encore de parcours recommandés ici : des formes de {distance} depuis le centre, dessinées maintenant.",
  "Three first, more while you choose.":
    "Trois d'abord, d'autres pendant que vous choisissez.",
  "Best near you": "Les meilleurs près de vous",
  "Starting within {distance} of {place}": "Départ à moins de {distance} de {place}",
  "your start": "votre départ",
  "Loading routes…": "Chargement des parcours…",
  "Choose a start first: the routes are the ones near it.":
    "Choisissez d'abord un départ : les parcours sont ceux à proximité.",
  "The routes could not load. Check the connection and try again.":
    "Les parcours n'ont pas pu se charger. Vérifiez la connexion et réessayez.",
  // src/explore/IdeasFromEurope.tsx, themedIdeas.ts, ThemedCard.tsx: our ideas
  "IDEAS FROM EUROPE": "IDÉES D'EUROPE",
  "Make it near me": "Le faire près de moi",
  Rome: "Rome",
  Paris: "Paris",
  London: "Londres",
  Barcelona: "Barcelone",
  Amsterdam: "Amsterdam",
  Lisbon: "Lisbonne",
  Prague: "Prague",
  Berlin: "Berlin",
  "Getting directions…": "Récupération de l'itinéraire…",
  CITY: "VILLE",
  "Type a city or a place": "Saisissez une ville ou un lieu",
  "No city or place matches “{typed}”.":
    "Aucune ville ni aucun lieu ne correspond à « {typed} ».",
  "The search did not answer. Try again.": "La recherche n'a pas répondu. Réessayez.",
  "A city you chose before": "Une ville choisie auparavant",
  "The routes near your start": "Les parcours près de votre départ",
  "{title} · {city} · looks {percent}% like it":
    "{title} · {city} · ressemble à {percent} %",
  "Loading the route…": "Chargement du parcours…",
  "The route could not load. Try again.":
    "Le parcours n'a pas pu se charger. Réessayez.",
  "Drawing a {distance} {title}…": "Dessin de {title} sur {distance}…",
  "The GPX could not be made. Try again.": "Le GPX n'a pas pu être créé. Réessayez.",
  "It passes by none of the {found} {theme} found: the shape did not fit near them.":
    "Il ne passe par aucun des {found} {theme} trouvés : la forme ne tenait pas à proximité.",
  "Passes by {passed} of the {found} {theme} found:":
    "Passe par {passed} des {found} {theme} trouvés :",
  "Back to Explore": "Retour à Explore",
  "MEANWHILE, FROM THE FEED": "EN ATTENDANT, DEPUIS LE FEED",
  "The first time in a city the map has to download: it can take a minute. The shapes show up above as they are ready.":
    "La première fois dans une ville, la carte doit se télécharger : cela peut prendre une minute. Les formes apparaissent ci-dessus dès qu'elles sont prêtes.",
  "The shapes of this city are ready above.":
    "Les formes de cette ville sont prêtes ci-dessus.",
  "Maps: {credit}": "Cartes : {credit}",
  "City centre": "Centre-ville",
  "The API did not answer. Check the connection and try again.":
    "Le serveur n'a pas répondu. Vérifiez la connexion et réessayez.",
  "The map of this area could not be loaded for directions. Try again later.":
    "La carte de cette zone n'a pas pu se charger pour l'itinéraire. Réessayez plus tard.",
  "This route is not on the map the API has: it has no directions.":
    "Ce parcours n'est pas sur la carte du serveur : il n'a pas d'itinéraire.",
  "The directions could not be found. Try again.":
    "L'itinéraire n'a pas été trouvé. Réessayez.",
  "The API answered without directions. It may be out of date.":
    "Le serveur a répondu sans itinéraire. Il n'est peut-être pas à jour.",
  "near your start": "près de vous",
  "near {place}": "près de {place}",
  "in {city}": "à {city}",
  "e.g. a romantic heart, famous places, food 8 km":
    "ex. un cœur romantique, lieux célèbres, gastronomie 8 km",
  "e.g. a romantic heart in {city}, 8 km": "ex. un cœur romantique à {city}, 8 km",
  // «Sport»: src/settings/{SportSetting,SportButton}.tsx, sport.ts, and the voice
  // of «Data»: src/voice/VoiceSetting.tsx (TASK-210, parte E)
  SPORT: "SPORT",
  Soon: "Bientôt",
  "{sport}, coming soon": "{sport}, bientôt disponible",
  "Sport, {sport}": "Sport, {sport}",
  "Changes the sport": "Change le sport",
  Sport: "Sport",
  Default: "Par défaut",
  "Voice language and voice: {language}, {voice}":
    "Langue et voix : {language}, {voice}",
  "Changes the language and the voice": "Change la langue et la voix",
  Listen: "Écouter",
  "Says a turn with this voice": "Annonce un virage avec cette voix",
  "Turn on Voice to listen": "Active « Voix » pour écouter",
  "App language": "Langue de l'app",
  "This phone did not list its voices: its own voice speaks.":
    "Ce téléphone n'a pas listé ses voix : c'est sa propre voix qui parle.",
  "This phone has no {language} voice: the voice speaks English.":
    "Ce téléphone n'a pas de voix pour {language} : la voix parle anglais.",
  "{language} · Enhanced": "{language} · Améliorée",

  // The titles of the three pages: src/screens/pageTitles.ts (TASK-210, parte G)
  Feed: "Fil",
  Draw: "Dessiner",
  Explore: "Explorer",

  // src/feed/FeedPost.tsx (TASK-118: a member's drawing without a place)
  "{user}: {title}. {facts}.": "{user} : {title}. {facts}.",

  // The shapes' names, the map and «Explore»: src/route/shapeWords.ts,
  // src/map/mapPage.ts, src/explore/{ExploreScreen,ThemedCard}.tsx
  // (TASK-210, parte F)
  "{list} or {last}": "{list} ou {last}",
  "Start here": "Départ ici",
  "NEAR {city}": "PRÈS DE {city}",
  here: "ici",

  // src/explore/RecommendedRow.tsx (TASK-092)
  RECOMMENDED: "RECOMMANDÉS",

  // src/social/ReportMenu.tsx, BlockedPeople.tsx (TASK-121: report and block)
  More: "Plus",
  "Report or block": "Signaler ou bloquer",
  Report: "Signaler",
  "Block {user}": "Bloquer {user}",
  "Why are you reporting this?": "Pourquoi signales-tu ceci ?",
  Spam: "Spam",
  "Offensive or hateful": "Offensant ou haineux",
  "Harassment or bullying": "Harcèlement ou intimidation",
  "Nudity or sexual content": "Nudité ou contenu sexuel",
  "Something else": "Autre chose",
  "Thanks for telling us. We will look at it.":
    "Merci de nous l'avoir signalé. Nous allons vérifier.",
  "Block {user}?": "Bloquer {user} ?",
  "You will not see each other's drawings, comments, messages or profile, any follow between you ends and your conversation is deleted. They are not told.":
    "Vous ne verrez plus les dessins, commentaires, messages ni le profil l'un de l'autre, tout abonnement entre vous prend fin et votre conversation est supprimée. La personne n'est pas prévenue.",
  Block: "Bloquer",
  "Sending…": "Envoi…",
  "This is not available any more.": "Ce n'est plus disponible.",
  "Blocked people": "Personnes bloquées",
  "You have not blocked anyone.": "Tu n'as bloqué personne.",
  Unblock: "Débloquer",
  "Unblock {name}": "Débloquer {name}",
  "You blocked {user}. Unblock them from Blocked people in your profile.":
    "Tu as bloqué {user}. Tu peux le débloquer dans Personnes bloquées de ton profil.",

  // src/settings/NotificationsSetting.tsx, notificationFields.ts (TASK-262: push sent)
  "Push notifications tell you at once about follow requests, reactions, comments and tags. Email notifications sends the same news in one email a day at most. Email when I'm away: one email if you don't open MuW for 2 weeks.":
    "Les notifications push te préviennent tout de suite des demandes de suivi, des réactions, des commentaires et des identifications. Les Notifications par e-mail envoient les mêmes nouvelles dans un e-mail par jour au plus. E-mail en cas d'absence : un e-mail si tu n'ouvres pas MuW pendant 2 semaines.",
  "Notifications are off for MuW on this phone. Allow them in Settings to turn this on.":
    "Les notifications de MuW sont désactivées sur ce téléphone. Autorise-les dans Réglages pour les activer.",

  // src/paddle/PaddleExplore.tsx (TASK-269)
  Lakes: "Lacs",
  Sea: "Mer",
  "Suggested near {place}": "Suggérés près de {place}",
  "Suggested near where you usually start": "Suggérés près de ton départ habituel",
  "Suggested near your start": "Suggérés près de ton départ",

  // src/stretch (TASK-285 part B)
  "Quad stretch": "Étirement du quadriceps",
  "Stand tall. Pull one heel toward your glutes, knees together.":
    "Debout, bien droit. Ramenez un talon vers la fesse, genoux serrés.",
  "Hamstring stretch": "Étirement des ischio-jambiers",
  "Put one heel forward, toes up. Lean from the hips, back straight.":
    "Un talon devant, pointe vers le haut. Penchez-vous depuis les hanches, dos droit.",
  "Calf stretch": "Étirement du mollet",
  "Step back, heel down. Lean toward the wall until the calf pulls.":
    "Un pas en arrière, talon au sol. Penchez-vous vers le mur jusqu'à sentir le mollet.",
  "Hip flexor stretch": "Étirement des fléchisseurs de hanche",
  "Kneel on one knee. Push your hips forward, chest up.":
    "Un genou au sol. Poussez le bassin vers l'avant, poitrine haute.",
  "Glute stretch": "Étirement du fessier",
  "Cross one ankle over the other knee. Sit back as if into a chair.":
    "Croisez une cheville sur l'autre genou. Asseyez-vous en arrière comme sur une chaise.",
  "{index} of {total}": "{index} sur {total}",
  "Right side": "Côté droit",
  "Left side": "Côté gauche",
  "Switch sides": "Changez de côté",
  "{seconds} seconds left": "{seconds} secondes restantes",
  "Stop if it hurts.": "Arrêtez si ça fait mal.",
  // «Draw»: src/route/samplePictures.ts (TASK-280)
  "Running shoe": "Basket",
  Dinosaur: "Dinosaure",
  Guitar: "Guitare",
  "Eiffel Tower": "Tour Eiffel",
  Rocket: "Fusée",
  Plane: "Avion",
  Balloon: "Ballon",
  Leaf: "Feuille",
  Mushroom: "Champignon",
  Car: "Voiture",
  "T-shirt": "T-shirt",
  Boot: "Botte",
  House: "Maison",
  Duck: "Canard",
  Trophy: "Trophée",
  Bone: "Os",

  // src/route/RoutePanel.tsx (TASK-340: first in «Draw», it opens the map
  // to draw on)
  Freehand: "À main levée",
  // src/mapdraw/DrawOnMap.tsx (TASK-281)
  Move: "Déplacer",
  "Draw with one finger. End where you started to close it. Two fingers move the map.":
    "Dessine avec un doigt. Termine là où tu as commencé pour la fermer. Deux doigts déplacent la carte.",
  "Each new line joins the drawing. Two fingers move the map.":
    "Chaque nouvelle ligne rejoint le dessin. Deux doigts déplacent la carte.",
  "Drag the figure or the map. Hold a line still, then drag to bend it. Two fingers resize.":
    "Fais glisser la figure ou la carte. Garde le doigt immobile sur une ligne, puis fais glisser pour la plier. Deux doigts changent la taille.",
  Line: "Ligne",
  "Tap point after point. Tap the first point to close it, the last one to finish.":
    "Touche point après point. Touche le premier point pour la fermer, le dernier pour terminer.",
  "The outline cannot cross itself. Bend it less.":
    "Le contour ne peut pas se croiser. Plie-le moins.",
  Redo: "Rétablir",
  "Clear all": "Tout effacer",
  "Clear the whole drawing?": "Effacer tout le dessin ?",
  "+ photo": "+ photo",

  // src/screens/ChooseScreen.tsx, src/location/PickStart.tsx (TASK-292)
  "Choose on the map": "Choisir sur la carte",
  "Move the map to put the pin where you want to start.":
    "Déplace la carte pour mettre l'épingle là où tu veux partir.",

  // src/share/SharePost.tsx, src/share/videoFile.ts (TASK-295)
  "Export video": "Exporter la vidéo",
  "Making the video… {percent}%": "Création de la vidéo… {percent} %",
  "This phone cannot make the video.": "Ce téléphone ne peut pas créer la vidéo.",
  "The video could not be made. Try again.":
    "La vidéo n'a pas pu être créée. Réessaie.",

  // src/screens/pageTitles.ts, src/game/ (TASK-296: the shape game, «Play»)
  Play: "Jouer",
  "{distance} in total": "{distance} au total",
  "{distance} under {pace}": "{distance} sous {pace}",
  "Best {best} · target {target}": "Meilleur {best} · objectif {target}",
  "Longest run {distance}": "Plus longue course {distance}",
  "Unlocked {date}": "Débloquée {date}",
  "Sign in to collect shapes.": "Connecte-toi pour collectionner des formes.",
  "{distance} counted so far": "{distance} comptés jusqu'ici",
  "The game is not available right now.": "Le jeu n'est pas disponible pour le moment.",
  "New shape unlocked": "Nouvelle forme débloquée",
  "New shape unlocked: {name}": "Nouvelle forme débloquée : {name}",
  "It is in your collection.": "Elle est dans ta collection.",
  "See collection": "Voir la collection",

  // src/navigation/runPosition.ts, the Android notification of a run (TASK-294)
  "MuW is recording your activity": "MuW enregistre ton activité",
  "It keeps going with the screen locked, voice included.":
    "Ça continue écran verrouillé, voix comprise.",

  // src/location/startStatus.ts, src/screens/ChooseScreen.tsx,
  // src/explore/ExploreScreen.tsx, ThemedCard.tsx, src/screens/NavigateScreen.tsx,
  // RunPanel.tsx, src/navigation/runStats.ts, src/intro/SavedLogo.tsx
  // (TASK-210, parte H)
  "Starting from your position.": "Départ : ta position.",
  "Starting from {place}.": "Départ : {place}.",
  "Starting from a point on the map.": "Départ : un point sur la carte.",
  "Search for a city or street to start from.":
    "Cherche une ville ou une rue d'où partir.",
  "Location is off for MuW. Allow it in Settings, or search for a place to start from.":
    "La localisation est désactivée pour MuW. Autorise-la dans Réglages, ou cherche un lieu d'où partir.",
  "Your position is not available right now. Search for a place to start from.":
    "Ta position n'est pas disponible pour l'instant. Cherche un lieu d'où partir.",
  START: "DÉPART",
  "My position": "Ma position",
  "Another place": "Autre lieu",
  "No recommended routes near this start yet. Draw one: the best ones will show up here.":
    "Pas encore de parcours recommandés près de ce départ. Dessines-en un : les meilleurs apparaîtront ici.",
  "{distance} away": "à {distance}",
  "Finding the places and drawing the shape through them… This can take a minute.":
    "Recherche des lieux et dessin de la forme qui les traverse… Cela peut prendre une minute.",
  "{percent}% drawn": "{percent} % dessiné",
  N: "N",
  NE: "NE",
  E: "E",
  SE: "SE",
  S: "S",
  SW: "SO",
  W: "O",
  NW: "NO",
  "{distance} to go": "encore {distance}",
  "Saved to My activities": "Enregistrée dans Mes activités",
  // src/social/ContactsFriends.tsx (TASK-262 C)
  "FROM YOUR CONTACTS": "DE TES CONTACTS",
  "Find friends in your contacts": "Trouver des amis dans tes contacts",
  "Only coded phone numbers leave the phone, never names. The server compares them with the numbers members saved and keeps none.":
    "Seuls des numéros codés quittent le téléphone, jamais les noms. Le serveur les compare aux numéros enregistrés par les membres et n'en garde aucun.",
  "Looking in your contacts…": "Recherche dans tes contacts…",
  "MuW cannot see your contacts.": "MuW ne peut pas voir tes contacts.",
  "No phone numbers in your contacts.": "Aucun numéro de téléphone dans tes contacts.",
  "None of your contacts is on MuW yet.": "Aucun de tes contacts n'est encore sur MuW.",
  "This server cannot look in your contacts yet.":
    "Ce serveur ne peut pas encore chercher dans tes contacts.",
  "The contacts could not be read.": "Impossible de lire les contacts.",
  // «Play», the «Challenges» tab: src/game/{PlayScreen,ChallengesTab,TeamView,
  // ChallengeView,NewChallenge}.tsx, teamsApi.ts, timeLeft.ts, shareCode.ts
  // (TASK-296, parte D)
  Collection: "Collection",
  Challenges: "Défis",
  "Sign in to play with a team.": "Connecte-toi pour jouer en équipe.",
  "Teams are not on this server yet.": "Les équipes ne sont pas encore sur ce serveur.",
  "YOUR TEAMS": "TES ÉQUIPES",
  "No team yet. Create one, or join one with its code.":
    "Pas encore d'équipe. Crées-en une, ou rejoins-en une avec son code.",
  "Team name": "Nom de l'équipe",
  Create: "Créer",
  "Team code": "Code de l'équipe",
  Join: "Rejoindre",
  "{count} member": "{count} membre",
  "{count} members": "{count} membres",
  "No challenge yet": "Pas encore de défi",
  "{done} of {total} pieces done": "{done} pièces sur {total} terminées",
  "Code {code}": "Code {code}",
  "Share code": "Partager le code",
  "Join my team «{name}» on MuW: open Play, Challenges, and enter the code {code}.":
    "Rejoins mon équipe «{name}» sur MuW : ouvre Play, Défis, et saisis le code {code}.",
  MEMBERS: "MEMBRES",
  Owner: "Propriétaire",
  "Leave team": "Quitter l'équipe",
  "Leave this team?": "Quitter cette équipe ?",
  "New challenge": "Nouveau défi",
  Pieces: "Pièces",
  "Fewer pieces": "Moins de pièces",
  "More pieces": "Plus de pièces",
  "Each piece": "Chaque pièce",
  Fast: "Rapide",
  "Slower pace": "Allure plus lente",
  "Faster pace": "Allure plus rapide",
  Days: "Jours",
  "Fewer days": "Moins de jours",
  "More days": "Plus de jours",
  "Start the challenge": "Lancer le défi",
  "{count} pieces · {goal} each": "{count} pièces · {goal} chacune",
  "Piece {n}": "Pièce {n}",
  Free: "Libre",
  Yours: "À toi",
  "Taken by {name}": "Prise par {name}",
  "Done by {name}": "Terminée par {name}",
  "Take this piece": "Prendre cette pièce",
  Leave: "Laisser",
  "WHO GAVE WHAT": "QUI A DONNÉ QUOI",
  "Nobody has run yet.": "Personne n'a encore couru.",
  PIECES: "PIÈCES",
  "Complete! Your team drew it together.":
    "Complète ! Ton équipe l'a dessinée ensemble.",
  "Time ran out: {count} piece was missing.":
    "Temps écoulé : il manquait {count} pièce.",
  "Time ran out: {count} pieces were missing.":
    "Temps écoulé : il manquait {count} pièces.",
  "{count} day {hours} h left": "Plus que {count} jour et {hours} h",
  "{count} days {hours} h left": "Plus que {count} jours et {hours} h",
  "{hours} h {minutes} min left": "Plus que {hours} h {minutes} min",
  "{minutes} min {seconds} s left": "Plus que {minutes} min {seconds} s",
  "Time is up": "Temps écoulé",
  "No team with this code.": "Aucune équipe n'a ce code.",
  "You can't join this team.": "Tu ne peux pas rejoindre cette équipe.",
  "You are in 10 teams already: leave one first.":
    "Tu es déjà dans 10 équipes : quittes-en une d'abord.",
  "This team is not available any more.": "Cette équipe n'est plus disponible.",
  "This challenge is not available any more.": "Ce défi n'est plus disponible.",
  "The team has a challenge going already: wait for it to end.":
    "L'équipe a déjà un défi en cours : attends qu'il se termine.",
  "This challenge is over.": "Ce défi est terminé.",
  "This piece is not there any more.": "Cette pièce n'existe plus.",
  "This piece is done already.": "Cette pièce est déjà terminée.",
  "Someone holds this piece already.": "Quelqu'un a déjà cette pièce.",
  "You hold a piece of this challenge already: leave it first.":
    "Tu as déjà une pièce de ce défi : laisse-la d'abord.",
  "You don't hold this piece.": "Cette pièce n'est pas à toi.",
  "This name is not allowed. Choose another one.":
    "Ce nom n'est pas autorisé. Choisis-en un autre.",
  // src/screens/SignInScreen.tsx, src/settings/NotificationsSetting.tsx
  // (TASK-284 B: the email when away; the names as in its email)
  "If you don't open MuW for 2 weeks, we email you once with what's new.":
    "Si tu n'ouvres pas MuW pendant 2 semaines, on t'envoie un seul e-mail avec les nouveautés.",
  "Don't send me these emails": "Ne plus m'envoyer ces e-mails",
  "Email when I'm away": "E-mail en cas d'absence",
  None: "Aucune",
  Energy: "Énergie",
  Chill: "Détente",
  Epic: "Épique",
  Sprint: "Sprint",
  Rock: "Rock",
  Funk: "Funk",
  Sunny: "Ensoleillé",
  Trap: "Trap",
  Retro: "Rétro",
  Fiesta: "Fiesta",
  "Tap a track to hear it.": "Touche un morceau pour l'écouter.",
  // src/contest/ (TASK-299 B: the contest card, its rules, the Winner badge)
  "MuW contest": "Concours MuW",
  "The post with the most reactions wins.":
    "La publication avec le plus de réactions gagne.",
  "{count} day left": "Encore {count} jour",
  "{count} days left": "Encore {count} jours",
  "Ends today": "Se termine aujourd'hui",
  "Ended · the winner is coming": "Terminé · le gagnant arrive bientôt",
  "Publish a run to take part.": "Publie une course pour participer.",
  "Your best post: #{rank}, {count} reaction":
    "Ta meilleure publication : n° {rank}, {count} réaction",
  "Your best post: #{rank}, {count} reactions":
    "Ta meilleure publication : n° {rank}, {count} réactions",
  "How it works": "Comment ça marche",
  "Official rules": "Règlement officiel",
  "Organised by MuW (Luca Pallaoro). Runs from {start} to {end}.":
    "Organisé par MuW (Luca Pallaoro). Du {start} au {end}.",
  "Anyone with a MuW account can take part, for free, by publishing a run for everyone in the app during the contest.":
    "Toute personne ayant un compte MuW peut participer gratuitement, en publiant une course visible par tous dans l'app pendant le concours.",
  "At the end, the post with the most reactions from other members wins. One reaction per member counts; your own does not. If two posts tie, the one with more MuW hearts wins, then the one published first.":
    "À la fin, la publication avec le plus de réactions des autres membres gagne. Une réaction par membre compte ; la tienne ne compte pas. En cas d'égalité, la publication avec le plus de cœurs MuW gagne, puis celle publiée en premier.",
  "The prize has no money value: the winner gets the Winner badge on their profile and their post shown at the top of the Feed for a week.":
    "Le prix n'a aucune valeur en argent : la personne gagnante reçoit le badge Gagnant sur son profil et sa publication est affichée en haut du Feed pendant une semaine.",
  "MuW may leave out a post that breaks the community rules.":
    "MuW peut écarter une publication qui enfreint les règles de la communauté.",
  "Apple and Google are not sponsors of this contest and are not involved in it in any way.":
    "Apple et Google ne sont pas sponsors de ce concours et n'y sont impliqués d'aucune manière.",
  Winner: "Gagnant",
  "{name} won the MuW contest": "{name} a gagné le concours MuW",
  // src/route/NearYou.tsx (TASK-306: shapes ready near you, or in other cities)
  "NEAR YOU": "PRÈS DE VOUS",
  "SHAPES TO TRY": "FORMES À ESSAYER",
  // src/game/PlayRow.tsx (TASK-327: «Play» under the distance of «Draw»)
  PLAY: "JOUER",
  "Collect shapes by running": "Collectionne des formes en courant",
  // src/screens/NavigateScreen.tsx (TASK-303)
  "The route is {distance} away, to the {direction}.":
    "Le parcours reprend à {distance}, direction {direction}.",
  "Follow the dotted line back to the route.":
    "Suivez la ligne pointillée pour revenir sur le parcours.",
  // src/social/DrawingCard.tsx (TASK-307: «Start» on a drawing follows its track)
  "This route has no turn directions: follow the line on the map.":
    "Ce parcours n'a pas d'indications de virage : suis la ligne sur la carte.",
  // src/game/runStripData.ts (TASK-296 E: the game's line on the run screen)
  "Last km {pace} · target {target}": "Dernier km {pace} · objectif {target}",
  "Last mi {pace} · target {target}": "Dernier mi {pace} · objectif {target}",

  // src/settings/FeedbackSetting.tsx, feedbackFields.ts, SettingsPage.tsx (TASK-308)
  "Send feedback": "Envoie-nous ton avis",
  "Thank you! Your message reached us.": "Merci ! Ton message nous est bien parvenu.",
  "Ideas, problems, anything that would make MuW better: we read every message.":
    "Idées, problèmes, tout ce qui rendrait MuW meilleur : nous lisons chaque message.",
  "Write here…": "Écris ici…",
  "Your message": "Ton message",
  "It reaches us with your username, your email and the app's version, so we can answer you.":
    "Il nous parvient avec ton nom d'utilisateur, ton e-mail et la version de l'app, pour que nous puissions te répondre.",
  "Write something first.": "Écris d'abord quelque chose.",
  "You sent a lot of feedback today. Try again tomorrow.":
    "Tu nous as déjà beaucoup écrit aujourd'hui. Réessaie demain.",
  FEEDBACK: "AVIS",
  // src/settings/sport.ts (TASK-305 D0: paragliding, «Soon» in «Sport»)
  Paragliding: "Parapente",
  // src/explore/ExploredCard.tsx, src/social/DrawingCard.tsx (TASK-313)
  "Draw it near me": "La dessiner près de moi",
  // src/route/RoutePanel.tsx (TASK-311 B: a word in one line that did not come out)
  "This word may come out better with the pen up: each letter on its own.":
    "Ce mot peut être mieux dessiné avec le crayon levé : chaque lettre à part.",
  "Lift the pen": "Lever le crayon",
  // src/route/RoutePanel.tsx (TASK-317: the wait in «Draw»)
  "Warming up: {name}…": "Échauffement : {name}…",
  "Warming up: “{word}”…": "Échauffement : « {word} »…",
  "Warming up: the picture…": "Échauffement : la photo…",

  // src/api/messages.ts (TASK-319: private messages)
  "A message needs some words.": "Un message a besoin de quelques mots.",
  "A message is at most {max} characters.": "Un message fait au plus {max} caractères.",
  "Too many messages in a minute. Wait a moment and try again.":
    "Trop de messages en une minute. Attends un instant et réessaie.",
  "You can't send negative messages in this app.":
    "Dans cette app, tu ne peux pas envoyer de messages négatifs.",
  "This conversation is not available.": "Cette conversation n'est pas disponible.",

  // src/messages/ConversationList.tsx, MessagesOverlay.tsx, MessagesRow.tsx, MessageButton.tsx (TASK-319)
  Messages: "Messages",
  "Messages, {count} waiting": "Messages, {count} en attente",
  "Message requests": "Demandes de message",
  "Message requests, {count} waiting": "Demandes de message, {count} en attente",
  "No messages yet. Open someone's profile and tap Message to write to them.":
    "Pas encore de messages. Ouvre le profil de quelqu'un et touche Message pour lui écrire.",
  "No message requests.": "Aucune demande de message.",
  "You: {text}": "Toi : {text}",
  "{name}, new message: {text}": "{name}, nouveau message : {text}",
  Message: "Message",
  "Message {name}": "Écrire à {name}",

  // src/messages/ConversationScreen.tsx, MessageSheet.tsx (TASK-319)
  "No messages yet.": "Pas encore de messages.",
  "Show earlier messages": "Afficher les messages précédents",
  "Touch and hold to delete it": "Maintiens appuyé pour le supprimer",
  "Touch and hold to report it": "Maintiens appuyé pour le signaler",
  "Message request sent. You can write again when {name} accepts it.":
    "Demande de message envoyée. Tu pourras écrire à nouveau quand {name} l'acceptera.",
  "{name} wants to send you a message.": "{name} veut t'envoyer un message.",
  "{name} gets this as a message request. You can send one message until they accept it.":
    "{name} le reçoit comme demande de message. Tant qu'elle n'est pas acceptée, tu peux envoyer un seul message.",
  "Write a message…": "Écris un message…",
  "Delete this message for both of you?": "Supprimer ce message pour vous deux ?",
  "Report this message": "Signaler ce message",
  // src/explore/ExploredCard.tsx, social/DrawingCard.tsx, mapdraw/DrawOnMap.tsx,
  // RoutePanel.tsx, favorites/favoriteRoute.ts (TASK-320, TASK-331: the figure
  // drawn by hand on the map)
  "Edit the drawing": "Modifier le dessin",
  Erase: "Effacer",
  Drawing: "Dessin",
  "Rub a line to erase that piece. A piece cut off joins the drawing with a dash.":
    "Frotte une ligne pour en effacer le morceau. Un morceau coupé rejoint le dessin par un pointillé.",
  // src/imports/, activities/RunEnd.tsx, feed/FeedPost.tsx (TASK-312 B:
  // «Add past activity» from a GPX, TCX or FIT file, «Imported»)
  "Add past activity": "Ajouter une activité passée",
  "From a file": "Depuis un fichier",
  "GPX, TCX or FIT from Strava, Garmin, Komoot…":
    "GPX, TCX ou FIT depuis Strava, Garmin, Komoot…",
  "Export the activity as a file from the other app or its website, save it in Files, then pick it here.":
    "Exporte l'activité en fichier depuis l'autre app ou son site, enregistre-la dans Fichiers, puis choisis-la ici.",
  Imported: "Importée",
  "Imported activities don't count for Play or contests.":
    "Les activités importées ne comptent ni pour le jeu ni pour les concours.",
  "This file is not GPX, TCX or FIT.": "Ce fichier n'est ni GPX, ni TCX, ni FIT.",
  "This file has no times: it is a route, not an activity.":
    "Ce fichier n'a pas d'horaires : c'est un parcours, pas une activité.",
  "This file has no positions.": "Ce fichier n'a pas de positions.",
  "This file is too big (over 25 MB).":
    "Ce fichier est trop volumineux (plus de 25 Mo).",
  "Activities before 2020 cannot be added.":
    "Impossible d'ajouter des activités antérieures à 2020.",
  "Already in My activities.": "Déjà dans Mes activités.",
  // The attachments of the private messages (TASK-333).
  "📷 Photo": "📷 Photo",
  "🎬 Video": "🎬 Vidéo",
  "🗺️ Drawing": "🗺️ Dessin",
  Photo: "Photo",
  Video: "Vidéo",
  "This video has expired.": "Cette vidéo a expiré.",
  "Video, {duration}": "Vidéo, {duration}",
  "Drawing: {title}, {distance}": "Dessin : {title}, {distance}",
  "Add a photo, a video or a drawing": "Ajouter une photo, une vidéo ou un dessin",
  "Add a message…": "Ajouter un message…",
  "Couldn't send. Tap to try again.": "Pas envoyé. Touche pour réessayer.",
  "This video is longer than {seconds} seconds. Choose a shorter one.":
    "Cette vidéo dure plus de {seconds} secondes. Choisis-en une plus courte.",
  "This video is too large: at most {mb} MB. Choose a shorter one.":
    "Cette vidéo est trop lourde : {mb} Mo au maximum. Choisis-en une plus courte.",
  "Too many videos today. Try again tomorrow.":
    "Trop de vidéos aujourd'hui. Réessaie demain.",
  "Too many photos today. Try again tomorrow.":
    "Trop de photos aujourd'hui. Réessaie demain.",
  "Videos can't be sent right now. Try again later.":
    "Impossible d'envoyer des vidéos pour l'instant. Réessaie plus tard.",
  // The drawings of the private messages (TASK-333 part C).
  "Send to a friend": "Envoyer à des amis",
  "Send to…": "Envoyer à…",
  "Search people": "Chercher des personnes",
  "Sent to {name}.": "Envoyé à {name}.",
  "Send a drawing": "Envoyer un dessin",
  "Photos, videos and drawings can be sent once {name} accepts your message.":
    "Tu pourras envoyer des photos, des vidéos et des dessins quand {name} acceptera ton message.",

  // src/profile/BadgeRow.tsx (TASK-341: the badges of a profile)
  "First drawing": "Premier dessin",
  "10 drawings": "10 dessins",
  "{distance} drawing": "Dessin de {distance}",
  "Not earned yet: {badge}": "Pas encore obtenu : {badge}",
  // src/messages/messageTime.ts, ConversationList.tsx (TASK-353: times in the chat)
  Today: "Aujourd’hui",
  Yesterday: "Hier",
  "{day} {month}": "{day} {month}",
  "{name}, {count} new messages: {text}": "{name}, {count} nouveaux messages : {text}",
};
