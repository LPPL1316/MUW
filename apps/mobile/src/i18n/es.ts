import type { Table } from "./translate";

/**
 * The app's texts in Spanish, by their English text (ADR-0172), in the
 * order of the files that show them. To confirm with someone who speaks it
 * (docs/UI.md).
 */
export const ES: Table = {
  // src/about/AboutPage.tsx
  "Draft — not final yet.": "Borrador: todavía no es definitivo.",
  "Last updated: {date}": "Última actualización: {date}",

  // src/account/fields.ts
  "You must be at least 16 to sign up.":
    "Debes tener al menos 16 años para registrarte.",
  "Enter the email of your account.": "Escribe el correo de tu cuenta.",
  "Enter your password.": "Escribe tu contraseña.",
  "A username is 3 to 20 letters, digits, _ or . (no spaces).":
    "Un nombre de usuario tiene de 3 a 20 letras, cifras, _ o . (sin espacios).",
  "Enter an email address, like name@example.com.":
    "Escribe una dirección de correo, como nombre@example.com.",
  "A password is at least {min} characters.":
    "Una contraseña tiene al menos {min} caracteres.",
  "A password is at most {max} characters.":
    "Una contraseña tiene como máximo {max} caracteres.",

  // src/account/messages.ts (TASK-256: words for whoever uses the phone)
  "The app cannot reach the service. Update the app.":
    "La app no puede conectar con el servicio. Actualiza la app.",
  "Your session has ended. Log in again.":
    "Tu sesión ha terminado. Inicia sesión de nuevo.",
  "Something went wrong on our side. Try again in a moment.":
    "Algo ha fallado por nuestra parte. Inténtalo de nuevo en un momento.",
  "No connection. Check the network and try again.":
    "Sin conexión. Comprueba la red e inténtalo de nuevo.",
  "This email already has an account. Log in instead.":
    "Este correo ya tiene una cuenta. Inicia sesión.",
  "This username is taken. Try another one.":
    "Este nombre de usuario ya está en uso. Prueba con otro.",
  "Wrong email or password.": "Correo o contraseña incorrectos.",
  "Accounts are not available right now. Try again later.":
    "Las cuentas no están disponibles ahora. Inténtalo más tarde.",
  "This version of the app is no longer allowed in. Update the app.":
    "Esta versión de la app ya no puede entrar. Actualiza la app.",
  "Too many tries. Wait a minute and try again.":
    "Demasiados intentos. Espera un minuto e inténtalo de nuevo.",
  "Too many tries. Wait {minutes} minutes and try again.":
    "Demasiados intentos. Espera {minutes} minutos e inténtalo de nuevo.",

  // src/activities/ActivitiesList.tsx
  "{count} run is on this phone, waiting for a connection.":
    "{count} carrera está en este teléfono, esperando conexión.",
  "{count} runs are on this phone, waiting for a connection.":
    "{count} carreras están en este teléfono, esperando conexión.",
  "Loading…": "Cargando…",
  "Show more": "Mostrar más",
  "Loading your activities…": "Cargando tus actividades…",
  "Your activities could not load.": "No se han podido cargar tus actividades.",
  "Try again": "Reintentar",
  "No activities yet. Save a run when you finish it, and it is kept here.":
    "Aún no hay actividades. Guarda una carrera cuando la termines y la encontrarás aquí.",
  "{when}, {where}, {facts}, public, open on the map":
    "{when}, {where}, {facts}, pública, abrir en el mapa",
  "{when}, {where}, {facts}, open on the map":
    "{when}, {where}, {facts}, abrir en el mapa",
  "Opening…": "Abriendo…",
  Public: "Pública",
  "Delete this run? It cannot be undone.":
    "¿Eliminar esta carrera? No se puede deshacer.",
  // «Keep it» answers two questions (a run, Strava): a word that fits both.
  "Keep it": "Cancelar",
  "Delete run": "Eliminar carrera",
  "Delete the run of {when}": "Eliminar la carrera del {when}",
  Delete: "Eliminar",
  // A run the API will not take (TASK-257).
  "The server could not take this run: {message}":
    "El servidor no pudo aceptar esta carrera: {message}",
  "Discard this run? It will not be saved.": "¿Descartar esta carrera? No se guardará.",
  "Discard run": "Descartar carrera",
  "Send the run of {when} again": "Volver a enviar la carrera del {when}",
  "Discard the run of {when}": "Descartar la carrera del {when}",
  Discard: "Descartar",

  // src/activities/ActivityCard.tsx
  "Yellow: the route. White: what you ran.":
    "Amarillo: la ruta. Blanco: lo que has corrido.",
  "White: what you ran.": "Blanco: lo que has corrido.",
  "Back to the list": "Volver a la lista",

  // src/activities/activitiesDoor.ts
  "Sign up or log in to keep your runs and share them as drawings.":
    "Regístrate o inicia sesión para guardar tus carreras y compartirlas como dibujos.",
  "This run is no longer in your activities.":
    "Esta carrera ya no está en tus actividades.",

  // src/activities/activityText.ts
  Sun: "Dom",
  Mon: "Lun",
  Tue: "Mar",
  Wed: "Mié",
  Thu: "Jue",
  Fri: "Vie",
  Sat: "Sáb",
  Jan: "ene",
  Feb: "feb",
  Mar: "mar",
  Apr: "abr",
  May: "may",
  Jun: "jun",
  Jul: "jul",
  Aug: "ago",
  Sep: "sept",
  Oct: "oct",
  Nov: "nov",
  Dec: "dic",
  "{weekday} {day} {month} {year}": "{weekday} {day} {month} {year}",
  Run: "Carrera",

  // src/activities/RunEnd.tsx
  "The phone holds {count} runs not sent yet. Discard one in My activities first.":
    "El teléfono ya tiene {count} carreras sin enviar. Descarta primero una en Mis actividades.",
  "The phone holds {count} runs not sent yet. They go when there is a connection; then save this one.":
    "El teléfono ya tiene {count} carreras sin enviar. Se envían cuando haya conexión; después guarda esta.",

  // src/api/comments.ts
  "A comment needs some words.": "Un comentario necesita algunas palabras.",
  "A comment is at most {max} characters.":
    "Un comentario tiene como máximo {max} caracteres.",
  "Too many comments in a minute. Wait a moment and try again.":
    "Demasiados comentarios en un minuto. Espera un momento e inténtalo de nuevo.",
  "The comments of this drawing are not available.":
    "Los comentarios de este dibujo no están disponibles.",

  // src/api/reactions.ts
  "At least 2 characters": "Al menos 2 caracteres",
  "Your reaction wasn't saved. Check the connection.":
    "Tu reacción no se ha guardado. Comprueba la conexión.",

  // src/api/strava.ts
  "No connection. Try again when you are online.":
    "Sin conexión. Inténtalo de nuevo cuando estés en línea.",
  "Strava is taking no more runs for now. Try again later.":
    "Strava no acepta más carreras por ahora. Inténtalo más tarde.",
  "Strava could not read this run.": "Strava no ha podido leer esta carrera.",
  "Strava is not connected. Connect it and try again.":
    "Strava no está conectado. Conéctalo e inténtalo de nuevo.",
  "Strava is not available on this API.": "Strava no está disponible en esta API.",
  "Strava did not answer. Try again in a while.":
    "Strava no ha respondido. Inténtalo dentro de un rato.",

  // src/engine/OfflineMapsSetting.tsx
  "Offline maps: {size}": "Mapas sin conexión: {size}",
  "Maps download on Wi-Fi and mobile data.":
    "Los mapas se descargan con wifi y con datos móviles.",
  "Add a place": "Añadir un lugar",
  "Preparing the map…": "Preparando el mapa…",
  "Trying again later": "Lo reintentamos más tarde",
  "Up to {count} places.": "Hasta {count} lugares.",
  "Places you add stay on the phone, so shapes there are drawn faster, even without signal.":
    "Los lugares que añades se quedan en el teléfono: allí las formas se dibujan más rápido, incluso sin señal.",

  // src/engine/ZoneNotice.tsx
  "Downloading the maps of your area ({size}) so routes work without signal.":
    "Descargando los mapas de tu zona ({size}) para que las rutas funcionen sin señal.",

  // src/engine/sizeText.ts
  "{size} MB": "{size} MB",
  "{size} GB": "{size} GB",

  // src/favorites/FavoriteHeart.tsx
  "Remove from favorites": "Quitar de favoritos",
  "Add to favorites": "Añadir a favoritos",

  // src/favorites/FavoritesList.tsx
  "Kept {day} {month} {year}": "Guardado el {day} {month} {year}",
  "{title}, open on the map": "{title}, abrir en el mapa",
  "Remove {title} from favorites": "Quitar {title} de favoritos",
  "Loading your favorites…": "Cargando tus favoritos…",
  "Your favorites could not load.": "No se han podido cargar tus favoritos.",
  "No favorites yet. Tap {heart} on a route on the map to keep it here.":
    "Aún no hay favoritos. Toca {heart} en una ruta del mapa para guardarla aquí.",

  // src/favorites/favoriteRoute.ts
  Route: "Ruta",

  // src/favorites/favoritesDoor.ts
  "Sign up or log in to keep your favorite routes.":
    "Regístrate o inicia sesión para guardar tus rutas favoritas.",

  // src/feed/FeedAd.tsx
  Sponsored: "Patrocinado",

  // src/feed/FeedPost.tsx
  "OpenFreeMap © OpenMapTiles\nData from OpenStreetMap":
    "OpenFreeMap © OpenMapTiles\nDatos de OpenStreetMap",
  "{user} in {city}: {title}. {facts}.": "{user} en {city}: {title}. {facts}.",
  "Opens the route on the map": "Abre la ruta en el mapa",

  // src/health/HealthRunEnd.tsx (TASK-321: Apple Health and Health Connect)
  "Save to Apple Health": "Guardar en Apple Salud",
  "Save to Health Connect": "Guardar en Health Connect",
  "Your activities also go to the Fitness app, with the route.":
    "Tus actividades también van a la app Fitness, con la ruta.",
  "Your activities also go to Health Connect, with the route.":
    "Tus actividades también van a Health Connect, con la ruta.",
  "Also to Apple Health, with Save.": "Con Guardar va también a Apple Salud.",
  "Also to Health Connect, with Save.": "Con Guardar va también a Health Connect.",
  "MuW can't write to Apple Health. Allow it in the Health app: your profile › Apps › MuW.":
    "MuW no puede escribir en Apple Salud. Permítelo en la app Salud: tu perfil › Apps › MuW.",
  "MuW can't write to Health Connect. Allow it in Health Connect › App permissions › MuW.":
    "MuW no puede escribir en Health Connect. Permítelo en Health Connect › Permisos de apps › MuW.",

  // src/i18n/shapeNames.ts
  Circle: "Círculo",
  Heart: "Corazón",
  Star: "Estrella",
  Horse: "Caballo",
  Moon: "Luna",
  Cat: "Gato",
  Fish: "Pez",
  Butterfly: "Mariposa",
  Snail: "Caracol",
  "Dog head": "Cabeza de perro",
  "Rabbit head": "Cabeza de conejo",
  Pumpkin: "Calabaza",
  "Christmas tree": "Árbol de Navidad",
  Smiley: "Carita sonriente",
  Ghost: "Fantasma",
  Donut: "Dónut",
  "The sun": "Sol",

  // src/explore/NearbyTowns.tsx
  "NEARBY TOWNS": "LOCALIDADES CERCANAS",
  "{town}, {km} km away": "{town}, a {km} km",
  "{mi} mi away": "a {mi} mi",
  "{town}, {mi} mi away": "{town}, a {mi} mi",

  // src/explore/CityWords.tsx
  WORDS: "PALABRAS",

  // src/intro/AppBoundary.tsx
  "Something went wrong.": "Algo ha fallado.",

  // src/map/MapView.tsx
  "The map could not be loaded. Check the network.":
    "No se ha podido cargar el mapa. Comprueba la red.",
  Retry: "Reintentar",

  // src/map/NorthArrow.tsx
  "North arrow": "Flecha del norte",
  "Turns the map north up": "Pone el norte arriba",
  "Turns the map like the drawing": "Gira el mapa como el dibujo",

  // src/map/MapKindButton.tsx
  "Map type": "Tipo de mapa",
  Standard: "Estándar",
  Satellite: "Satélite",
  "3D": "3D",

  // src/paddle/PaddleExplore.tsx
  Next: "A continuación",
  "Drawing…": "Dibujando…",
  "Your start": "Tu salida",
  "On the water": "En el agua",
  "Shapes to paddle, within 1 km of the shore":
    "Formas para remar, a menos de 1 km de la orilla",
  "LAKES AND SEA": "LAGOS Y MAR",
  "Near me": "Cerca de mí",
  "Choose a lake or a beach: eight shapes on its water, from the shore.":
    "Elige un lago o una playa: ocho formas en su agua, desde la orilla.",
  "Choose a start in Draw first: the shapes start from the shore nearest to it.":
    "Elige primero una salida en Draw: las formas empiezan en la orilla más cercana.",
  "Near your start": "Cerca de tu salida",
  "{km} km away": "a {km} km",
  "Type a lake or a beach": "Escribe un lago o una playa",
  "No lake or beach matches “{typed}”.": "Ningún lago o playa coincide con «{typed}».",
  "{shape}, {km} km, on the water": "{shape}, {km} km, en el agua",
  "{shape}, {mi} mi, on the water": "{shape}, {mi} mi, en el agua",
  "Not drawn": "No dibujado",

  // src/paddle/placeSpots.ts
  "Lake, beach, city or street": "Lago, playa, ciudad o calle",

  // src/paddle/PaddleNotice.tsx
  "Before you paddle": "Antes de remar",
  "Wear a life jacket.": "Ponte un chaleco salvavidas.",
  "Check the weather and the wind before you go out.":
    "Mira el tiempo y el viento antes de salir.",
  "Follow the local rules: swimming areas, boat lanes, harbours. MuW does not know them.":
    "Respeta las normas del lugar: zonas de baño, canales de navegación, puertos. MuW no las conoce.",
  "The route stays within 1 km of the shore. That does not make it safe or allowed.":
    "La ruta se queda a menos de 1 km de la orilla. Eso no la hace segura ni permitida.",
  "I understand": "Entendido",
  "Not now": "Ahora no",

  // src/paddle/MoveShape.tsx, src/route/RoutePanel.tsx
  "Move the shape": "Mover la forma",
  "Drag the shape where you want it, then let go.":
    "Arrastra la forma adonde la quieras y suéltala.",
  "It stays on the water, off the shore, where it fits.":
    "Se queda en el agua, lejos de la orilla, donde cabe.",
  "The shape does not fit there: this is the nearest place.":
    "La forma no cabe ahí: este es el lugar más cercano.",

  // src/paddle/waterPlaces.ts
  "from Riva del Garda": "desde Riva del Garda",
  "from Como": "desde Como",
  "from the beach": "desde la playa",

  // src/places/PlaceSearch.tsx
  "City or street": "Ciudad o calle",
  Search: "Buscar",
  "Searching…": "Buscando…",
  "No place found. Try adding the city.":
    "No se ha encontrado ningún lugar. Prueba a añadir la ciudad.",
  "The search failed. Check the connection and try again.":
    "La búsqueda ha fallado. Comprueba la conexión e inténtalo de nuevo.",
  "© OpenStreetMap contributors": "© colaboradores de OpenStreetMap",

  // src/profile/EditProfile.tsx
  USERNAME: "NOMBRE DE USUARIO",
  "3 to 20 letters, digits, _ or .": "De 3 a 20 letras, cifras, _ o .",
  BIO: "BIO",
  "A few words about you": "Unas palabras sobre ti",
  "{length} of {max} characters": "{length} de {max} caracteres",
  "Saving…": "Guardando…",
  Save: "Guardar",

  // src/profile/PhotoChoices.tsx
  "Removing…": "Quitando…",
  "Choose a picture": "Elegir una foto",
  "Take a photo": "Hacer una foto",
  "Remove picture": "Quitar la foto",

  // src/profile/PhotoRow.tsx
  "Profile picture": "Foto de perfil",

  // src/profile/ProfileHome.tsx
  "Edit profile": "Editar perfil",
  Favorites: "Favoritos",
  "My activities": "Mis actividades",
  Settings: "Ajustes",

  // src/settings/EmailSetting.tsx, PhoneSetting.tsx, contactFields.ts (TASK-183)
  "NEW EMAIL": "NUEVO CORREO",
  "PHONE NUMBER": "NÚMERO DE TELÉFONO",
  Add: "Añadir",
  "Remove number": "Quitar el número",
  "Only you see your number. Friends who already have it will be able to find you on MuW.":
    "Solo tú ves tu número. Los amigos que ya lo tienen podrán encontrarte en MuW.",
  "Changing the email is not available on this API yet.":
    "En esta API todavía no se puede cambiar el correo.",
  "The phone number is not available on this API yet.":
    "En esta API todavía no hay número de teléfono.",
  "This is already the email of your account.": "Ya es el correo de tu cuenta.",
  "Write the number with its country code, like +39 333 123 4567.":
    "Escribe el número con el prefijo del país, como +39 333 123 4567.",
  "Wrong password.": "Contraseña incorrecta.",
  "Another account has this email.": "Otra cuenta tiene este correo.",

  // src/screens/SignInScreen.tsx, ForgotPassword.tsx, src/settings/EmailConfirmation.tsx,
  // src/account/accountEmail.ts (TASK-300: the emails of the account)
  "Forgot password?": "¿Olvidaste la contraseña?",
  "Write the email of your account: we send it a link to choose a new password.":
    "Escribe el correo de tu cuenta: le enviamos un enlace para elegir una nueva contraseña.",
  "Send the link": "Enviar el enlace",
  "If an account has this email, a link is on its way. It works for 1 hour; look in spam too.":
    "Si una cuenta tiene este correo, el enlace está en camino. Vale 1 hora; mira también en spam.",
  "Back to Log in": "Volver a Iniciar sesión",
  "Too many emails asked: wait a few minutes and try again.":
    "Demasiados correos pedidos: espera unos minutos y vuelve a intentarlo.",
  "Email not confirmed": "Correo no confirmado",
  "Send the link again": "Enviar el enlace otra vez",
  "Send again": "Enviar otra vez",
  "Cancel change": "Cancelar el cambio",
  "Link sent to {email}. Look in spam too.":
    "Enlace enviado a {email}. Mira también en spam.",
  "We sent a link to {email}. Your email changes when you open it.":
    "Enviamos un enlace a {email}. Tu correo cambia cuando lo abras.",
  "Waiting for {email}: open the link we sent there.":
    "Esperando a {email}: abre el enlace que enviamos allí.",

  // src/settings/NotificationsSetting.tsx, notificationFields.ts
  "Notifications are not available on this API yet.":
    "En esta API todavía no hay notificaciones.",

  // src/profile/SettingsPage.tsx
  "Change email": "Cambiar correo",
  "Phone number": "Número de teléfono",
  Units: "Unidades",
  NOTIFICATIONS: "NOTIFICACIONES",
  "Email notifications": "Notificaciones por correo",
  "Push notifications": "Notificaciones push",
  ABOUT: "INFORMACIÓN",
  Help: "Ayuda",
  Terms: "Términos",
  Privacy: "Privacidad",
  ACCOUNT: "CUENTA",
  PREFERENCES: "PREFERENCIAS",
  "Log out": "Cerrar sesión",
  "Delete your account? Everything that is yours goes with it, at once. It cannot be undone.":
    "¿Eliminar tu cuenta? Todo lo que es tuyo se va con ella, al momento. No se puede deshacer.",
  "Deleting…": "Eliminando…",
  "Delete my account": "Eliminar mi cuenta",
  "Keep my account": "Conservar mi cuenta",
  "Delete account": "Eliminar cuenta",

  // src/profile/UserProfilePage.tsx
  "Log in to see the profiles of the others.":
    "Inicia sesión para ver los perfiles de los demás.",
  "This profile is not available.": "Este perfil no está disponible.",
  "{count} drawing": "{count} dibujo",
  "{count} drawings": "{count} dibujos",
  "Loading the profile…": "Cargando el perfil…",
  "{count} follower": "{count} seguidor",
  "{count} followers": "{count} seguidores",
  "{count} following": "sigue a {count}",

  // src/profile/profileFields.ts
  "Editing the profile is not available on this API yet.":
    "Editar el perfil aún no está disponible en esta API.",
  "A bio is at most {max} characters.": "Una bio tiene como máximo {max} caracteres.",

  // src/profile/useProfilePhoto.ts
  "The camera is off for this app. Allow it in Settings, or choose a picture instead.":
    "Esta app no tiene acceso a la cámara. Permítelo en Ajustes o elige una foto.",
  "This picture is too large. Choose a smaller one.":
    "Esta foto es demasiado grande. Elige una más pequeña.",
  "Could not open the picture. Try again.":
    "No se ha podido abrir la foto. Inténtalo de nuevo.",
  "This picture cannot be used. Choose another one.":
    "Esta foto no se puede usar. Elige otra.",
  "Profile pictures are not available on this API yet.":
    "Las fotos de perfil aún no están disponibles en esta API.",

  // src/route/RoutePanel.tsx
  "{letters} km of letters + {between} km riding between them":
    "{letters} km de letras + {between} km en bici entre una y otra",
  "{drawn} km of drawing + {between} km walking between the parts":
    "{drawn} km de dibujo + {between} km a pie entre las partes",
  "{drawn} km of drawing + {between} km riding between the parts":
    "{drawn} km de dibujo + {between} km en bici entre las partes",
  "{drawn} km of drawing + {between} km paddling between the parts":
    "{drawn} km de dibujo + {between} km remando entre las partes",
  "On the water, a shape of the catalogue.": "En el agua, una forma del catálogo.",
  "{name} · on the water · target {km} km": "{name} · en el agua · objetivo {km} km",
  "{name} · on roads · target {km} km": "{name} · por carretera · objetivo {km} km",
  // «Draw» with «Miles» (TASK-182 part B): src/route/RoutePanel.tsx,
  // DistanceStepper.tsx, wordInput.ts
  "Distance in miles": "Distancia en millas",
  "Enter a distance between {lowest} and {highest} mi.":
    "Introduce una distancia entre {lowest} y {highest} mi.",
  "{count} letter: at least {mi} mi. A word takes a few minutes to draw.":
    "{count} letra: al menos {mi} mi. Dibujar una palabra lleva unos minutos.",
  "{count} letters: at least {mi} mi. A word takes a few minutes to draw.":
    "{count} letras: al menos {mi} mi. Dibujar una palabra lleva unos minutos.",
  "Use {mi} mi": "Usar {mi} mi",
  "{letters} mi of letters + {between} mi riding between them":
    "{letters} mi de letras + {between} mi en bici entre una y otra",
  "{letters} mi of letters + {between} mi walking between them":
    "{letters} mi de letras + {between} mi a pie entre una y otra",
  "{drawn} mi of drawing + {between} mi walking between the parts":
    "{drawn} mi de dibujo + {between} mi a pie entre las partes",
  "{drawn} mi of drawing + {between} mi riding between the parts":
    "{drawn} mi de dibujo + {between} mi en bici entre las partes",
  "{drawn} mi of drawing + {between} mi paddling between the parts":
    "{drawn} mi de dibujo + {between} mi remando entre las partes",
  "{name} · on the water · target {mi} mi": "{name} · en el agua · objetivo {mi} mi",
  "{name} · on roads · target {mi} mi": "{name} · por carretera · objetivo {mi} mi",
  "Drawing the picture's outline, {mi} mi…":
    "Dibujando el contorno de la foto, {mi} mi…",
  "Drawing “{word}”, {mi} mi…": "Dibujando «{word}», {mi} mi…",
  "Drawing a {mi} mi {name}…": "Dibujando: {name}, {mi} mi…",
  "At most {most} letters: each needs {each} mi, and the app goes up to {highest} mi.":
    "Como máximo {most} letras: cada una necesita {each} mi, y la app llega hasta {highest} mi.",
  "“{word}” needs at least {mi} mi: {each} mi for each letter.":
    "«{word}» necesita al menos {mi} mi: {each} mi por cada letra.",

  // src/route/betterDistance.ts
  "This shape comes out better at about {km} km.":
    "Esta forma sale mejor a unos {km} km.",
  "This word comes out better at about {km} km.":
    "Esta palabra sale mejor a unos {km} km.",
  "This outline comes out better at about {km} km.":
    "Este contorno sale mejor a unos {km} km.",
  "Try {km} km": "Probar {km} km",
  "This shape comes out better at about {mi} mi.":
    "Esta forma sale mejor a unas {mi} mi.",
  "This word comes out better at about {mi} mi.":
    "Esta palabra sale mejor a unas {mi} mi.",
  "This outline comes out better at about {mi} mi.":
    "Este contorno sale mejor a unas {mi} mi.",
  "Try {mi} mi": "Probar {mi} mi",

  // src/route/problems.ts
  "The route could not be drawn. Try again, or try another start.":
    "No se ha podido dibujar la ruta. Inténtalo de nuevo o prueba otra salida.",
  "This word cannot be read right now. Try one of these: {list}.":
    "Esta palabra no se puede leer ahora. Prueba una de estas: {list}.",
  "Drawing this route is taking too long. Try again later, or a shorter distance.":
    "Dibujar esta ruta está tardando demasiado. Inténtalo más tarde o con una distancia más corta.",
  "This request was lost. Try again.":
    "Esta solicitud se ha perdido. Inténtalo de nuevo.",
  "There is no lake or sea near this start. Start from the shore, within 2 km of the water.":
    "No hay ningún lago ni mar cerca de esta salida. Sal desde la orilla, a menos de 2 km del agua.",
  "This shape does not fit on the water here at this distance. It fits at about {km} km.":
    "Esta forma no cabe en el agua aquí a esta distancia. Cabe a unos {km} km.",
  "This shape does not fit on the water here. Try a shorter distance, another shape, or another start:":
    "Esta forma no cabe en el agua aquí. Prueba una distancia más corta, otra forma u otra salida:",
  "This shape does not fit the roads here at this distance. It fits at about {mi} mi.":
    "Esta forma no cabe en las calles aquí a esta distancia. Cabe a unas {mi} mi.",
  "This word does not fit the roads here at this distance. It fits at about {mi} mi.":
    "Esta palabra no cabe en las calles aquí a esta distancia. Cabe a unas {mi} mi.",
  "This image does not fit the roads here at this distance. It fits at about {mi} mi.":
    "Esta imagen no cabe en las calles aquí a esta distancia. Cabe a unas {mi} mi.",
  "There is no lake or sea near this start. Start from the shore, within 1 mile of the water.":
    "No hay ningún lago ni mar cerca de esta salida. Sal desde la orilla, a menos de 1 milla del agua.",
  "This shape does not fit on the water here at this distance. It fits at about {mi} mi.":
    "Esta forma no cabe en el agua aquí a esta distancia. Cabe a unas {mi} mi.",

  // src/route/warnings.ts
  "Includes {distance} walking the bike.": "Incluye {distance} caminando con la bici.",

  // src/route/RoutePanel.tsx (TASK-210, «Draw»)
  Shape: "Forma",
  Word: "Palabra",
  Image: "Imagen",
  Round: "Redondas",
  Square: "Cuadradas",
  DRAW: "DIBUJA",
  LETTERS: "LETRAS",
  DISTANCE: "DISTANCIA",
  "heart, star, horse…": "corazón, estrella, caballo…",
  "Lift the pen between parts": "Levanta el lápiz entre las partes",
  "Lift the pen between letters": "Levanta el lápiz entre las letras",
  "Square letters follow the street grid: best for short words.":
    "Las letras cuadradas siguen la cuadrícula de las calles: mejor para palabras cortas.",
  "Enter a distance between {lowest} and {highest} km.":
    "Introduce una distancia entre {lowest} y {highest} km.",
  "Long routes take longer: up to a few minutes.":
    "Las rutas largas tardan más: hasta unos minutos.",
  "Draw route": "Dibujar la ruta",
  Start: "Empezar",
  "Preparing GPX…": "Preparando el GPX…",
  "Export GPX": "Exportar GPX",
  "{letters} km of letters + {between} km walking between them":
    "{letters} km de letras + {between} km a pie entre una y otra",
  "Press Done and the AI will read it.": "Pulsa OK y la IA lo leerá.",
  "The AI is reading it…": "La IA lo está leyendo…",
  "No shape in the catalogue for “{text}”. Describe what it looks like (“prancing horse”, not “Ferrari badge”), or pick one:":
    "Ninguna forma del catálogo para «{text}». Describe cómo es («caballo encabritado», no «escudo de Ferrari»), o elige una:",
  "Unknown shape. Try: {list}.": "Forma desconocida. Prueba: {list}.",
  "{count} letter: at least {km} km. A word takes a few minutes to draw.":
    "{count} letra: al menos {km} km. Dibujar una palabra lleva unos minutos.",
  "{count} letters: at least {km} km. A word takes a few minutes to draw.":
    "{count} letras: al menos {km} km. Dibujar una palabra lleva unos minutos.",
  "Use {km} km": "Usar {km} km",
  Picture: "Imagen",
  "Downloading map data for this area…": "Descargando el mapa de esta zona…",
  "Drawing the picture's outline, {km} km…":
    "Dibujando el contorno de la foto, {km} km…",
  "Drawing “{word}”, {km} km…": "Dibujando «{word}», {km} km…",
  "Drawing a {km} km {name}…": "Dibujando: {name}, {km} km…",

  // src/route/problems.ts (TASK-210, «Draw»)
  "This shape does not fit the roads here at this distance. It fits at about {km} km.":
    "Esta forma no cabe en las calles aquí a esta distancia. Cabe a unos {km} km.",
  "This word does not fit the roads here at this distance. It fits at about {km} km.":
    "Esta palabra no cabe en las calles aquí a esta distancia. Cabe a unos {km} km.",
  "This image does not fit the roads here at this distance. It fits at about {km} km.":
    "Esta imagen no cabe en las calles aquí a esta distancia. Cabe a unos {km} km.",
  "This word does not fit the roads here. Try a shorter word, or another start.":
    "Esta palabra no cabe en las calles aquí. Prueba una palabra más corta u otro inicio.",
  "This outline does not fit the roads here. Try another distance, another start, or a simpler picture.":
    "Este contorno no cabe en las calles aquí. Prueba otra distancia, otro inicio o una foto más sencilla.",
  "This shape does not fit the roads here. Try another shape, or another start:":
    "Esta forma no cabe en las calles aquí. Prueba otra forma u otro inicio:",
  "Map data for this area could not be downloaded. Try again later.":
    "No se pudo descargar el mapa de esta zona. Inténtalo más tarde.",
  "The route engine cannot find one clear outline in this picture.":
    "En esta foto no se encuentra un contorno claro.",
  "Only PNG and JPEG pictures work. Choose another one.":
    "Solo funcionan fotos PNG y JPEG. Elige otra.",
  "This picture could not be read. Choose another one.":
    "Esta foto no se pudo leer. Elige otra.",
  "The background is too busy. Use one subject on a plain background, like a drawing on white paper or an object on a bare table.":
    "El fondo está demasiado cargado. Usa un solo sujeto sobre un fondo liso, como un dibujo en papel blanco o un objeto en una mesa vacía.",
  "Nothing stands out from the background. Use a subject much darker or brighter than what is around it.":
    "Nada destaca sobre el fondo. Usa un sujeto mucho más oscuro o más claro que lo que tiene alrededor.",
  "The picture shows more than 4 separate things. Use a picture with 4 subjects at most.":
    "La foto muestra más de 4 cosas separadas. Usa una foto con 4 sujetos como máximo.",
  "The subject touches the edge of the picture. Leave some background all around it.":
    "El sujeto toca el borde de la foto. Deja algo de fondo alrededor.",
  "The subject is too small. Get closer, or use a bigger picture.":
    "El sujeto es demasiado pequeño. Acércate o usa una foto más grande.",
  "The outline is too jagged to run on roads. Try a simpler subject.":
    "El contorno es demasiado irregular para correrlo por las calles. Prueba un sujeto más sencillo.",
  "This line cannot be added to the outline. Draw it again.":
    "Esta línea no se puede añadir al contorno. Dibújala de nuevo.",
  "This line is too short to add. Draw a longer one.":
    "Esta línea es demasiado corta para añadirla. Dibuja una más larga.",
  "This part covers where a detail starts. Undo the detail first, or draw the part elsewhere.":
    "Esta parte cubre donde empieza un detalle. Deshaz primero el detalle o dibuja la parte en otro sitio.",
  "That is too much for one route. Undo something, or draw simpler lines.":
    "Es demasiado para una sola ruta. Deshaz algo o dibuja líneas más sencillas.",
  "Too many requests to the API in the last minute. Wait a minute, then try again.":
    "Demasiadas solicitudes en el último minuto. Espera un minuto y vuelve a intentarlo.",
  "This phone cannot open the share sheet.":
    "Este teléfono no puede abrir la hoja para compartir.",
  "The GPX could not be saved on the phone. Try again.":
    "El GPX no se pudo guardar en el teléfono. Inténtalo de nuevo.",
  "This picture is too large: {mb} MB, at most {most} MB. Choose a smaller one.":
    "Esta foto es demasiado grande: {mb} MB, como máximo {most} MB. Elige una más pequeña.",
  "The picture could not be opened. Try again, or choose another one.":
    "La foto no se pudo abrir. Inténtalo de nuevo o elige otra.",

  // src/route/warnings.ts (TASK-210, «Draw»; the direction is the compass word)
  "The route starts {distance} {direction} of your start, where the shape fits the roads. Go to “Start here”.":
    "La ruta empieza a {distance} al {direction} de tu inicio, donde la forma cabe en las calles. Ve a «Empieza aquí».",
  "There are {distance} of steps along the way.":
    "Hay {distance} de escaleras por el camino.",
  "{distance} runs along main roads, with traffic.":
    "{distance} van por calles principales, con tráfico.",
  "{distance} runs through tunnels.": "{distance} pasan por túneles.",
  "About {share}% of the route goes over the same roads twice.":
    "Alrededor del {share}% de la ruta pasa dos veces por las mismas calles.",
  "About {share}% of the route runs alongside itself.":
    "Alrededor del {share}% de la ruta va paralela a sí misma.",
  "The route is {share}% longer than asked.":
    "La ruta es un {share}% más larga de lo pedido.",
  "The route is {share}% shorter than asked.":
    "La ruta es un {share}% más corta de lo pedido.",
  "The roads here follow the shape only roughly.":
    "Las calles de aquí siguen la forma solo a grandes rasgos.",
  "Few roads here: the route follows the shape loosely.":
    "Pocas calles aquí: la ruta sigue la forma de lejos.",
  "The nearest road is {distance} away: the route begins there.":
    "La calle más cercana está a {distance}: la ruta empieza allí.",
  "A bit of the shape has no road to follow, so the route skips it.":
    "Un trozo de la forma no tiene calle que seguir, y la ruta lo salta.",

  // src/route/wordInput.ts (TASK-210, «Draw»)
  "Write a word to draw, with the letters A to Z.":
    "Escribe una palabra para dibujar, con las letras de la A a la Z.",
  "One word only, without spaces.": "Solo una palabra, sin espacios.",
  "No letter “{letter}”: a word can use only the letters A to Z, without accents.":
    "Sin «{letter}»: una palabra solo puede usar las letras de la A a la Z, sin acentos.",
  "At most {most} letters.": "Como máximo {most} letras.",
  "At most {most} letters: each needs {each} km, and the app goes up to {highest} km.":
    "Como máximo {most} letras: cada una necesita {each} km, y la app llega hasta {highest} km.",
  "“{word}” needs at least {km} km: {each} km for each letter.":
    "«{word}» necesita al menos {km} km: {each} km por cada letra.",

  // src/route/ImageChoice.tsx (TASK-210, «Draw»)
  "Choose another": "Elegir otra",
  "Choose picture": "Elegir foto",
  "Take photo": "Hacer una foto",
  "Hide the picture": "Ocultar la foto",
  "Show the picture": "Mostrar la foto",
  "Edit the outline": "Editar el contorno",
  "One subject on a plain background works best: a drawing, a logo, an object on a bare table. The route follows its outside line. Up to 4 separate subjects are joined in one line.":
    "Lo mejor es un solo sujeto sobre un fondo liso: un dibujo, un logo, un objeto en una mesa vacía. La ruta sigue su línea exterior. Hasta 4 sujetos separados se unen en una sola línea.",
  "Tracing the outline…": "Trazando el contorno…",
  "The yellow line is what the route will draw. If it does not look like the subject, the route will not either: try another picture, or edit the outline. Separate subjects are joined by a short line, which the route runs there and back.":
    "La línea amarilla es lo que dibujará la ruta. Si no se parece al sujeto, la ruta tampoco: prueba otra foto o edita el contorno. Los sujetos separados se unen con una línea corta, que la ruta recorre ida y vuelta.",

  // src/route/OutlineBoard.tsx (TASK-210, «Draw»)
  "Add a part": "Añadir una parte",
  "Add a detail": "Añadir un detalle",
  "Choose what to add. Two fingers zoom and move the picture.":
    "Elige qué añadir. Con dos dedos amplías y mueves la foto.",
  "Draw a closed shape. Across the yellow line it becomes part of the outline; anywhere else it is joined to the nearest yellow line.":
    "Dibuja una forma cerrada. Sobre la línea amarilla pasa a ser parte del contorno; en otro sitio se une a la línea amarilla más cercana.",
  "Draw a line anywhere: it is joined to the nearest yellow line, and the route runs along it and back. Close a loop to make an eye.":
    "Dibuja una línea donde quieras: se une a la línea amarilla más cercana, y la ruta la recorre ida y vuelta. Cierra un bucle para hacer un ojo.",
  Fit: "Ajustar",
  "Adding the part…": "Añadiendo la parte…",
  "Adding the detail…": "Añadiendo el detalle…",
  Undo: "Deshacer",

  // src/route/LoadingBar.tsx (TASK-210, «Draw»: what a screen reader hears)
  "Still waiting": "Todavía esperando",
  "Drawing the route": "Dibujando la ruta",
  "Reading the shape": "Leyendo la forma",
  "Loading the map": "Cargando el mapa",

  // src/route/DistanceStepper.tsx (TASK-210, «Draw»)
  "Distance in km": "Distancia en km",
  Shorter: "Más corta",
  Longer: "Más larga",

  // src/route/RouteTiles.tsx, ImagePreview.tsx (TASK-210, «Draw»: what a screen reader hears)
  "Route {label}, {distance}, {likeness} like the shape":
    "Ruta {label}, {distance}, {likeness} parecida a la forma",
  "The outline traced from the picture": "El contorno trazado de la foto",

  // src/screens/PeopleScreen.tsx
  "Find friends": "Buscar amigos",

  // src/screens/ProfileLayer.tsx
  "Profile, log in again": "Perfil, inicia sesión de nuevo",
  "Profile, {count} follow request": "Perfil, {count} solicitud de seguimiento",
  "Profile, {count} follow requests": "Perfil, {count} solicitudes de seguimiento",
  Profile: "Perfil",

  // src/screens/ProfileScreen.tsx
  "Your account and everything that was yours have been deleted.":
    "Tu cuenta y todo lo que era tuyo se han eliminado.",
  "You are logged out on this phone.": "Has cerrado sesión en este teléfono.",
  Back: "Atrás",

  // src/screens/RunDashboard.tsx
  Speed: "Velocidad",
  "Kilometre {km}: {speed} km/h": "Kilómetro {km}: {speed} km/h",
  Mi: "Mi",
  miles: "millas",
  "Your first mile will show here.": "Tu primera milla aparecerá aquí.",
  "Mile {mile}: {pace}": "Milla {mile}: {pace}",
  "Mile {mile}: {speed} mph": "Milla {mile}: {speed} mph",
  "Your first 500 metres will show here.": "Tus primeros 500 metros aparecerán aquí.",
  "{metres} metres: {pace}": "{metres} metros: {pace}",

  // src/screens/RunPanel.tsx
  "Speed now": "Vel. ahora",
  "Avg speed": "Vel. media",
  "Last km": "Último km",
  "Last mi": "Última mi",
  "Avg /500 m": "Med. /500 m",
  "Last 500 m": "Últ. 500 m",

  // src/screens/SignInScreen.tsx
  "Sign up": "Registrarse",
  "Log in": "Iniciar sesión",
  EMAIL: "CORREO",
  "name@example.com": "nombre@example.com",
  PASSWORD: "CONTRASEÑA",
  "At least 8 characters": "Al menos 8 caracteres",
  "I am at least 16": "Tengo al menos 16 años",
  "Signing up…": "Registrando…",
  "Logging in…": "Iniciando sesión…",

  // src/settings/LanguageSetting.tsx
  Language: "Idioma",
  "Phone language": "Idioma del teléfono",

  // src/settings/UnitsSetting.tsx
  Kilometres: "Kilómetros",
  Miles: "Millas",
  "Phone units": "Unidades del teléfono",

  // src/settings/ToneSetting.tsx
  Tone: "Tono",
  Dark: "Oscuro",
  Light: "Claro",
  Brightness: "Brillo",
  "Brightness {step} of {count}": "Brillo {step} de {count}",
  Darker: "Más oscuro",
  Brighter: "Más claro",
  "Preview of the tone": "Vista previa del tono",
  Apply: "Aplicar",
  "MuW opens again in the new tone.": "MuW se vuelve a abrir con el nuevo tono.",
  "The phone did not keep the tone. Try again.":
    "El teléfono no ha guardado el tono. Inténtalo de nuevo.",
  "Close MuW and open it again to see the new tone.":
    "Cierra MuW y vuelve a abrirla para ver el nuevo tono.",

  // src/settings/sport.ts
  "Ride without a route": "Rodar sin ruta",
  "Paddle without a route": "Remar sin ruta",
  "Run without a route": "Correr sin ruta",

  // src/share/PostImage.tsx
  "Drag it to move it. Tap it to take it off.":
    "Arrástralo para moverlo. Tócalo para quitarlo.",

  // src/share/SharePost.tsx
  "Share your run": "Comparte tu carrera",
  "Drag the emoji to move them. Tap one to take it off.":
    "Arrastra los emojis para moverlos. Toca uno para quitarlo.",
  Results: "Resultados",
  "Add emoji": "Añadir emoji",
  "Add {emoji}": "Añadir {emoji}",
  "Up to {count} emoji: tap one on the post to take it off.":
    "Hasta {count} emojis: toca uno en la publicación para quitarlo.",
  "Making the picture…": "Creando la imagen…",
  "Pick Instagram in the list: Story, Feed or Messages.":
    "Elige Instagram en la lista: Historia, Feed o Mensajes.",
  Share: "Compartir",

  // src/share/StravaPostRow.tsx
  "To send this post to Strava, save the run, then share it from «My activities».":
    "Para enviar esta publicación a Strava, guarda la carrera y luego compártela desde «Mis actividades».",
  "Update on Strava": "Actualizar en Strava",
  "The activity on Strava has this post's text now.":
    "La actividad en Strava ya tiene el texto de esta publicación.",
  "Strava did not let MuW change this activity. Change its text on Strava.":
    "Strava no dejó que MuW cambiara esta actividad. Cambia el texto en Strava.",
  "Strava takes no pictures from other apps: keep this one in Photos with «Save Image» and add it there.":
    "Strava no acepta imágenes de otras apps: guarda esta en Fotos con «Guardar imagen» y añádela allí.",

  // src/share/postRun.ts
  Distance: "Distancia",
  Time: "Tiempo",
  Pace: "Ritmo",

  // src/share/sharePicture.ts
  "The picture could not be made. Try again.":
    "No se pudo crear la imagen. Inténtalo de nuevo.",

  // src/social/DrawingCard.tsx
  "Back to the profile": "Volver al perfil",

  // src/social/DrawingComments.tsx
  "Opens the comments of this drawing.": "Abre los comentarios de este dibujo.",
  Comments: "Comentarios",
  "Delete this comment?": "¿Eliminar este comentario?",
  Cancel: "Cancelar",
  "Close the comments": "Cerrar los comentarios",
  Close: "Cerrar",
  "Add a comment…": "Añade un comentario…",
  Comment: "Comentario",
  Post: "Publicar",
  "{count} of {max} characters": "{count} de {max} caracteres",
  "Loading the comments…": "Cargando los comentarios…",
  "No comments yet. Be the first.": "Aún no hay comentarios. Escribe el primero.",
  "Show more comments": "Mostrar más comentarios",
  "{name}, {ago}: {text}": "{name}, {ago}: {text}",
  "Touch and hold to delete.": "Mantén pulsado para eliminar.",

  // src/social/DrawingReactions.tsx
  React: "Reaccionar",
  "Your reaction: {name}": "Tu reacción: {name}",
  "{count} reaction": "{count} reacción",
  "{count} reactions": "{count} reacciones",

  // src/social/DrawingsGrid.tsx
  Drawings: "Dibujos",
  "No public drawings yet. Make a run public in My activities.":
    "Aún no hay dibujos públicos. Haz pública una carrera en Mis actividades.",
  "No drawings yet.": "Aún no hay dibujos.",

  // src/profile/ProfileStats.tsx, src/profile/ProfileGallery.tsx (TASK-324)
  Likes: "Me gusta",
  Photos: "Fotos",
  "No photos yet.": "Aún no hay fotos.",
  "No photos yet. Add some to a public drawing in My activities.":
    "Aún no hay fotos. Añade algunas a un dibujo público en Mis actividades.",

  // src/social/SuperLikeSheet.tsx
  "Super like": "Super like",
  "Write a comment to send your super like":
    "Escribe un comentario para enviar tu super like",
  Send: "Enviar",

  // src/social/reactionKinds.ts
  "MuW heart, super like": "Corazón de MuW, super like",
  Fire: "Fuego",
  Clap: "Aplauso",
  Strong: "Fuerza",
  Laugh: "Risa",
  Wow: "Wow",

  // src/social/commentText.ts
  "You can't write negative comments in this app. Try another app.":
    "En esta app no puedes escribir comentarios negativos. Usa otra app.",
  "just now": "ahora mismo",
  "{count} min ago": "hace {count} min",
  "{count} h ago": "hace {count} h",
  "{count} d ago": "hace {count} d",
  "Write a comment": "Escribe un comentario",
  "{count} comment": "{count} comentario",
  "{count} comments": "{count} comentarios",

  // src/social/drawingsDoor.ts
  "This drawing is no longer public.": "Este dibujo ya no es público.",

  // src/social/FollowButton.tsx
  "Stop following {name}?": "¿Dejar de seguir a {name}?",
  Unfollow: "Dejar de seguir",
  "Takes your request back.": "Retira tu solicitud.",
  Follow: "Seguir",
  Requested: "Solicitado",
  Following: "Siguiendo",

  // src/social/FollowLists.tsx
  Requests: "Solicitudes",
  Followers: "Seguidores",
  "Nobody is asking to follow you.": "Nadie pide seguirte.",
  "Nobody follows you yet.": "Todavía no te sigue nadie.",
  "You are not following anyone yet. Find friends from Feed.":
    "Todavía no sigues a nadie. Busca amigos desde Feed.",
  Accept: "Aceptar",
  "Accept {name}": "Aceptar a {name}",
  Decline: "Rechazar",
  "Decline {name}": "Rechazar a {name}",
  "Follow back": "Seguir también",
  "Follow {name} back": "Seguir también a {name}",
  Remove: "Quitar",
  "Remove {name}": "Quitar a {name}",
  "Remove {name} from your followers?": "¿Quitar a {name} de tus seguidores?",

  // src/social/PeopleSearch.tsx
  "Log in to find your friends.": "Inicia sesión para encontrar a tus amigos.",
  "This server cannot look for members yet.":
    "Este servidor todavía no puede buscar miembros.",
  Name: "Nombre",
  "Type at least 2 letters of a name.": "Escribe al menos 2 letras de un nombre.",
  "Nobody has a name like that.": "Nadie tiene un nombre así.",

  // src/strava/StravaActivityRow.tsx
  "Sending to Strava…": "Enviando a Strava…",
  "View on Strava": "Ver en Strava",
  "This run is on Strava.": "Esta carrera está en Strava.",
  "Strava is still reading this run.": "Strava aún está leyendo esta carrera.",
  "Check again": "Comprobar de nuevo",
  "Send to Strava": "Enviar a Strava",

  // src/strava/StravaParts.tsx
  "Opening Strava…": "Abriendo Strava…",
  "Connect with Strava": "Conectar con Strava",
  On: "Sí",
  Off: "No",
  "Name on Strava": "Nombre en Strava",
  "Leave empty for an automatic name": "Déjalo vacío para un nombre automático",

  // src/strava/StravaRunEnd.tsx
  "Connect Strava, and Save sends your runs there too.":
    "Conecta Strava y Guardar enviará también allí tus carreras.",
  "To {athlete}'s Strava, with Save.": "Con Guardar va también al Strava de {athlete}.",

  // src/strava/StravaSetting.tsx
  "Strava, connected": "Strava, conectado",
  "Strava, connected as {athlete}": "Strava, conectado como {athlete}",
  Connected: "Conectado",
  "Connected as {athlete}": "Conectado como {athlete}",
  "Disconnect Strava? Runs already sent stay on Strava.":
    "¿Desconectar Strava? Las carreras ya enviadas se quedan en Strava.",
  Disconnect: "Desconectar",
  "Disconnecting…": "Desconectando…",
  "Disconnect Strava": "Desconectar Strava",
  "Send the runs you save in MuW to your Strava profile.":
    "Envía a tu perfil de Strava las carreras que guardas en MuW.",

  // src/strava/useStrava.ts
  "Could not open Strava. Try again.":
    "No se ha podido abrir Strava. Inténtalo de nuevo.",

  // The run: src/screens/{NavigateScreen,FreeRunScreen,RunDashboard,RunPanel,
  // FinishScreen,Countdown,HoldButton,PocketScreen,MapScreen}.tsx and
  // src/navigation/runStats.ts (TASK-210, la corsa)
  "Finding your position…": "Buscando tu posición…",
  "You have arrived.": "Has llegado.",
  "Off the route": "Fuera de la ruta",
  "Head back to the yellow line.": "Vuelve a la línea amarilla.",
  "Follow the route to the end.": "Sigue la ruta hasta el final.",
  "Then {directions}": "Luego {directions}",
  "Heading {direction}": "Rumbo {direction}",
  north: "norte",
  "north-east": "noreste",
  east: "este",
  "south-east": "sureste",
  south: "sur",
  "south-west": "suroeste",
  west: "oeste",
  "north-west": "noroeste",
  "You are at your start": "Estás en tu salida",
  "Your start: {distance} in a straight line, to the {direction}":
    "Tu salida: {distance} en línea recta, hacia el {direction}",
  "Your start, in a straight line": "Tu salida, en línea recta",
  "Your run": "Tu carrera",
  "Distance: {distance}": "Distancia: {distance}",
  "Distance: {distance} {units}": "Distancia: {distance} {units}",
  "Keep running": "Seguir corriendo",
  "Remember to stretch": "Recuerda estirar",
  Stretch: "Estirar",
  Skip: "Omitir",
  Done: "Listo",
  "Pocket mode": "Modo bolsillo",
  Pocket: "Bolsillo",
  Finish: "Terminar",
  Stop: "Parar",
  "Paused: you stopped moving": "En pausa: te has detenido",
  Paused: "En pausa",
  Resume: "Reanudar",
  Pause: "Pausa",
  Music: "Música",
  "Opens Spotify": "Abre Spotify",
  Map: "Mapa",
  Data: "Datos",
  "Auto-pause": "Pausa automática",
  Voice: "Voz",
  "Kilometre {km}: {pace}": "Kilómetro {km}: {pace}",
  Km: "Km",
  Change: "Cambio",
  "Your first kilometre will show here.": "Tu primer kilómetro aparecerá aquí.",
  "Pace now": "Ritmo ahora",
  "Avg pace": "Ritmo medio",
  "Elev. gain": "Desnivel",
  Calories: "Calorías",
  "{minutes} min": "{minutes} min",
  "{hours} h {minutes} min": "{hours} h {minutes} min",
  "about {minutes} min": "unos {minutes} min",
  "about {hours} h {minutes} min": "unas {hours} h {minutes} min",
  "Starting in {number}": "Empieza en {number}",
  "Get ready": "Prepárate",
  "Hold to end the run": "Mantén pulsado para terminar la carrera",
  "Hold to stop": "Mantén pulsado para parar",
  "The screen goes dark but stays on, so directions go on. Do not lock the phone: if you press the side button, directions stop. To come back, hold the screen for 2 seconds.":
    "La pantalla se oscurece pero sigue encendida, así las indicaciones continúan. No bloquees el teléfono: si pulsas el botón lateral, las indicaciones se detienen. Para volver, mantén pulsada la pantalla 2 segundos.",
  "Go dark": "Oscurecer",
  "Pocket mode. Hold for 2 seconds to leave.":
    "Modo bolsillo. Mantén pulsado 2 segundos para salir.",
  "Keep holding…": "Sigue pulsando…",
  "Hold for 2 seconds to leave pocket mode":
    "Mantén pulsado 2 segundos para salir del modo bolsillo",
  // src/permissions/OpenSettings.tsx, src/location/LocationOff.tsx (TASK-259)
  "Open Settings": "Abrir Ajustes",
  "Location is off": "La ubicación está desactivada",
  "Allow it for MuW in Settings to follow the route.":
    "Permítela a MuW en Ajustes para seguir la ruta.",
  "Allow it for MuW in Settings to record your track.":
    "Permítela a MuW en Ajustes para grabar tu recorrido.",
  // src/activities/RunEnd.tsx, src/social/PublicParts.tsx, PublicRow.tsx,
  // DrawingCard.tsx (TASK-208)
  "This run could not be kept on the phone. Try again.":
    "Esta carrera no se ha podido guardar en el teléfono. Inténtalo de nuevo.",
  "Save to My activities": "Guardar en Mis actividades",
  Tagged: "Etiquetados",
  "{name}'s profile": "Perfil de {name}",
  "Photo {n}": "Foto {n}",
  "Photos of a run only you can see stay on this phone. Delete the app or change phone and they are gone.":
    "Las fotos de una carrera que solo ves tú se quedan en este teléfono. Si borras la app o cambias de teléfono, se pierden.",
  "Its photos leave MuW and stay only on this phone.":
    "Sus fotos salen de MuW y se quedan solo en este teléfono.",
  "Every member sees it in your profile, without the first and last 200 m.":
    "Todos los miembros la ven en tu perfil, sin los primeros y últimos 200 m.",
  "Your followers see it in your profile, without the first and last 200 m.":
    "Tus seguidores la ven en tu perfil, sin los primeros y últimos 200 m.",
  "Saved on the phone. It is sent when you are back online.":
    "Guardada en el teléfono. Se envía cuando vuelvas a estar en línea.",
  "Saved on the phone. Others see it when you are back online.":
    "Guardada en el teléfono. Los demás la ven cuando vuelvas a estar en línea.",
  Bike: "Bici",
  Paddle: "Remo",
  Title: "Título",
  "Give it a name": "Ponle un nombre",
  "How did it go?": "¿Cómo ha ido?",
  Activity: "Actividad",
  Everyone: "Todos",
  "Only me": "Solo yo",
  "Who can see it": "Quién puede verla",
  "Tag people": "Etiquetar personas",
  "Remove photo {n}": "Quitar la foto {n}",
  "Add photo": "Añadir foto",
  "This photo could not be kept on the phone. Try again.":
    "Esta foto no se ha podido guardar en el teléfono. Inténtalo de nuevo.",

  // «Explore»: src/explore/* (TASK-210, parte C)
  "ASK FOR A ROUTE": "PIDE UNA RUTA",
  "A shape through real places {place}. Tap one to make it.":
    "Una forma por lugares reales {place}. Toca una para hacerla.",
  Food: "Comida",
  "Famous Places": "Lugares famosos",
  Romantic: "Romántico",
  "Best Views": "Mejores vistas",
  Shopping: "Compras",
  Culture: "Cultura",
  Nightlife: "Vida nocturna",
  "Hidden Gems": "Rincones ocultos",
  Running: "Correr",
  Walking: "Pasear",
  Family: "Familia",
  Photography: "Fotografía",
  "Local Experience": "Vida local",
  "More categories": "Más categorías",
  "More…": "Más…",
  "{count} more": "{count} más",
  "OR IN YOUR WORDS": "O CON TUS PALABRAS",
  "From {where}. Name a city in the words to go elsewhere.":
    "Se sale {where}. Nombra una ciudad en las palabras para ir a otro sitio.",
  "Make my route": "Crear mi ruta",
  "EXAMPLES IN {city}": "EJEMPLOS EN {city}",
  "No recommended routes here yet: shapes of {distance} from the centre, drawn now.":
    "Aquí aún no hay rutas recomendadas: formas de {distance} desde el centro, dibujadas ahora.",
  "Three first, more while you choose.": "Primero tres, más mientras eliges.",
  "Best near you": "Las mejores cerca de ti",
  "Starting within {distance} of {place}":
    "Con salida a menos de {distance} de {place}",
  "your start": "tu salida",
  "Loading routes…": "Cargando rutas…",
  "Choose a start first: the routes are the ones near it.":
    "Elige primero una salida: las rutas son las cercanas.",
  "The routes could not load. Check the connection and try again.":
    "Las rutas no se han cargado. Comprueba la conexión e inténtalo de nuevo.",
  // src/explore/IdeasFromEurope.tsx, themedIdeas.ts, ThemedCard.tsx: our ideas
  "IDEAS FROM EUROPE": "IDEAS DE EUROPA",
  "Make it near me": "Hazlo cerca de mí",
  Rome: "Roma",
  Paris: "París",
  London: "Londres",
  Barcelona: "Barcelona",
  Amsterdam: "Ámsterdam",
  Lisbon: "Lisboa",
  Prague: "Praga",
  Berlin: "Berlín",
  "Getting directions…": "Obteniendo indicaciones…",
  CITY: "CIUDAD",
  "Type a city or a place": "Escribe una ciudad o un lugar",
  "No city or place matches “{typed}”.":
    "Ninguna ciudad ni lugar coincide con “{typed}”.",
  "The search did not answer. Try again.":
    "La búsqueda no ha respondido. Inténtalo de nuevo.",
  "A city you chose before": "Una ciudad que elegiste antes",
  "The routes near your start": "Las rutas cerca de tu salida",
  "{title} · {city} · looks {percent}% like it":
    "{title} · {city} · se parece al {percent}%",
  "Loading the route…": "Cargando la ruta…",
  "The route could not load. Try again.":
    "La ruta no se ha cargado. Inténtalo de nuevo.",
  "Drawing a {distance} {title}…": "Dibujando {title} de {distance}…",
  "The GPX could not be made. Try again.":
    "No se ha podido crear el GPX. Inténtalo de nuevo.",
  "It passes by none of the {found} {theme} found: the shape did not fit near them.":
    "No pasa por ninguno de los {found} {theme} encontrados: la forma no cabía cerca.",
  "Passes by {passed} of the {found} {theme} found:":
    "Pasa por {passed} de los {found} {theme} encontrados:",
  "Back to Explore": "Volver a Explore",
  "MEANWHILE, FROM THE FEED": "MIENTRAS TANTO, DEL FEED",
  "The first time in a city the map has to download: it can take a minute. The shapes show up above as they are ready.":
    "La primera vez en una ciudad hay que descargar el mapa: puede tardar un minuto. Las formas aparecen arriba a medida que están listas.",
  "The shapes of this city are ready above.":
    "Las formas de esta ciudad están listas arriba.",
  "Maps: {credit}": "Mapas: {credit}",
  "City centre": "Centro de la ciudad",
  "The API did not answer. Check the connection and try again.":
    "El servidor no ha respondido. Comprueba la conexión e inténtalo de nuevo.",
  "The map of this area could not be loaded for directions. Try again later.":
    "El mapa de esta zona no se ha podido cargar para las indicaciones. Inténtalo más tarde.",
  "This route is not on the map the API has: it has no directions.":
    "Esta ruta no está en el mapa del servidor: no tiene indicaciones.",
  "The directions could not be found. Try again.":
    "No se han encontrado las indicaciones. Inténtalo de nuevo.",
  "The API answered without directions. It may be out of date.":
    "El servidor ha respondido sin indicaciones. Puede que no esté actualizado.",
  "near your start": "cerca de ti",
  "near {place}": "cerca de {place}",
  "in {city}": "en {city}",
  "e.g. a romantic heart, famous places, food 8 km":
    "p. ej. un corazón romántico, lugares famosos, comida 8 km",
  "e.g. a romantic heart in {city}, 8 km":
    "p. ej. un corazón romántico en {city}, 8 km",
  // «Sport»: src/settings/{SportSetting,SportButton}.tsx, sport.ts, and the voice
  // of «Data»: src/voice/VoiceSetting.tsx (TASK-210, parte E)
  SPORT: "DEPORTE",
  Soon: "Próximamente",
  "{sport}, coming soon": "{sport}, próximamente",
  "Sport, {sport}": "Deporte, {sport}",
  "Changes the sport": "Cambia el deporte",
  Sport: "Deporte",
  Default: "Predeterminada",
  "Voice language and voice: {language}, {voice}": "Idioma y voz: {language}, {voice}",
  "Changes the language and the voice": "Cambia el idioma y la voz",
  Listen: "Escuchar",
  "Says a turn with this voice": "Anuncia un giro con esta voz",
  "Turn on Voice to listen": "Activa «Voz» para escuchar",
  "App language": "Idioma de la app",
  "This phone did not list its voices: its own voice speaks.":
    "Este teléfono no ha mostrado sus voces: habla su propia voz.",
  "This phone has no {language} voice: the voice speaks English.":
    "Este teléfono no tiene voz para {language}: la voz habla inglés.",
  "{language} · Enhanced": "{language} · Mejorada",

  // The titles of the three pages: src/screens/pageTitles.ts (TASK-210, parte G)
  Feed: "Feed",
  Draw: "Dibuja",
  Explore: "Explora",

  // src/feed/FeedPost.tsx (TASK-118: a member's drawing without a place)
  "{user}: {title}. {facts}.": "{user}: {title}. {facts}.",

  // The shapes' names, the map and «Explore»: src/route/shapeWords.ts,
  // src/map/mapPage.ts, src/explore/{ExploreScreen,ThemedCard}.tsx
  // (TASK-210, parte F)
  "{list} or {last}": "{list} o {last}",
  "Start here": "Empieza aquí",
  "NEAR {city}": "CERCA DE {city}",
  here: "aquí",

  // src/explore/RecommendedRow.tsx (TASK-092)
  RECOMMENDED: "RECOMENDADAS",

  // src/social/ReportMenu.tsx, BlockedPeople.tsx (TASK-121: report and block)
  More: "Más",
  "Report or block": "Denunciar o bloquear",
  Report: "Denunciar",
  "Block {user}": "Bloquear a {user}",
  "Why are you reporting this?": "¿Por qué lo denuncias?",
  Spam: "Spam",
  "Offensive or hateful": "Ofensivo o de odio",
  "Harassment or bullying": "Acoso o bullying",
  "Nudity or sexual content": "Desnudos o contenido sexual",
  "Something else": "Otro motivo",
  "Thanks for telling us. We will look at it.":
    "Gracias por avisarnos. Lo revisaremos.",
  "Block {user}?": "¿Bloquear a {user}?",
  "You will not see each other's drawings, comments, messages or profile, any follow between you ends and your conversation is deleted. They are not told.":
    "Dejaréis de ver los dibujos, comentarios, mensajes y perfil del otro, termina cualquier seguimiento entre vosotros y se borra vuestra conversación. No recibirá ningún aviso.",
  Block: "Bloquear",
  "Sending…": "Enviando…",
  "This is not available any more.": "Ya no está disponible.",
  "Blocked people": "Personas bloqueadas",
  "You have not blocked anyone.": "No has bloqueado a nadie.",
  Unblock: "Desbloquear",
  "Unblock {name}": "Desbloquear a {name}",
  "You blocked {user}. Unblock them from Blocked people in your profile.":
    "Has bloqueado a {user}. Puedes desbloquearlo en Personas bloqueadas de tu perfil.",

  // src/settings/NotificationsSetting.tsx, notificationFields.ts (TASK-262: push sent)
  "Push notifications tell you at once about follow requests, reactions, comments and tags. Email notifications sends the same news in one email a day at most. Email when I'm away: one email if you don't open MuW for 2 weeks.":
    "Las notificaciones push te avisan al momento de solicitudes para seguirte, reacciones, comentarios y etiquetas. Las Notificaciones por correo envían las mismas novedades en un correo al día como mucho. Correo cuando no estoy: un correo si no abres MuW durante 2 semanas.",
  "Notifications are off for MuW on this phone. Allow them in Settings to turn this on.":
    "Las notificaciones de MuW están desactivadas en este teléfono. Permítelas en Ajustes para activarlas.",

  // src/paddle/PaddleExplore.tsx (TASK-269)
  Lakes: "Lagos",
  Sea: "Mar",
  "Suggested near {place}": "Sugeridos cerca de {place}",
  "Suggested near where you usually start": "Sugeridos cerca de donde sueles salir",
  "Suggested near your start": "Sugeridos cerca de tu salida",

  // src/stretch (TASK-285 part B)
  "Quad stretch": "Estiramiento de cuádriceps",
  "Stand tall. Pull one heel toward your glutes, knees together.":
    "De pie, erguido. Lleva un talón hacia el glúteo, rodillas juntas.",
  "Hamstring stretch": "Estiramiento de isquiotibiales",
  "Put one heel forward, toes up. Lean from the hips, back straight.":
    "Un talón adelante, punta arriba. Inclínate desde la cadera, espalda recta.",
  "Calf stretch": "Estiramiento de pantorrilla",
  "Step back, heel down. Lean toward the wall until the calf pulls.":
    "Un paso atrás, talón en el suelo. Inclínate hacia la pared hasta sentir la pantorrilla.",
  "Hip flexor stretch": "Estiramiento de flexores de cadera",
  "Kneel on one knee. Push your hips forward, chest up.":
    "Apoya una rodilla en el suelo. Empuja la cadera adelante, pecho arriba.",
  "Glute stretch": "Estiramiento de glúteo",
  "Cross one ankle over the other knee. Sit back as if into a chair.":
    "Cruza un tobillo sobre la otra rodilla. Siéntate atrás como en una silla.",
  "{index} of {total}": "{index} de {total}",
  "Right side": "Lado derecho",
  "Left side": "Lado izquierdo",
  "Switch sides": "Cambia de lado",
  "{seconds} seconds left": "Quedan {seconds} segundos",
  "Stop if it hurts.": "Para si duele.",
  // «Draw»: src/route/samplePictures.ts (TASK-280)
  "Running shoe": "Zapatilla",
  Dinosaur: "Dinosaurio",
  Guitar: "Guitarra",
  "Eiffel Tower": "Torre Eiffel",
  Rocket: "Cohete",
  Plane: "Avión",
  Balloon: "Globo",
  Leaf: "Hoja",
  Mushroom: "Seta",
  Car: "Coche",
  "T-shirt": "Camiseta",
  Boot: "Bota",
  House: "Casa",
  Duck: "Pato",
  Trophy: "Trofeo",
  Bone: "Hueso",

  // src/route/RoutePanel.tsx (TASK-340: first in «Draw», it opens the map
  // to draw on)
  Freehand: "A mano alzada",
  // src/mapdraw/DrawOnMap.tsx (TASK-281)
  Move: "Mover",
  "Draw with one finger. End where you started to close it. Two fingers move the map.":
    "Dibuja con un dedo. Termina donde empezaste para cerrarla. Con dos dedos mueves el mapa.",
  "Each new line joins the drawing. Two fingers move the map.":
    "Cada línea nueva se une al dibujo. Con dos dedos mueves el mapa.",
  "Drag the figure or the map. Hold a line still, then drag to bend it. Two fingers resize.":
    "Arrastra la figura o el mapa. Mantén el dedo quieto en una línea y arrastra para doblarla. Con dos dedos cambias el tamaño.",
  Line: "Línea",
  "Tap point after point. Tap the first point to close it, the last one to finish.":
    "Toca punto tras punto. Toca el primer punto para cerrarla, el último para terminar.",
  "The outline cannot cross itself. Bend it less.":
    "El contorno no puede cruzarse. Dóblalo menos.",
  Redo: "Rehacer",
  "Clear all": "Borrar todo",
  "Clear the whole drawing?": "¿Borrar todo el dibujo?",
  "+ photo": "+ foto",

  // src/screens/ChooseScreen.tsx, src/location/PickStart.tsx (TASK-292)
  "Choose on the map": "Elegir en el mapa",
  "Move the map to put the pin where you want to start.":
    "Mueve el mapa para poner el marcador donde quieres empezar.",

  // src/share/SharePost.tsx, src/share/videoFile.ts (TASK-295)
  "Export video": "Exportar vídeo",
  "Making the video… {percent}%": "Creando el vídeo… {percent} %",
  "This phone cannot make the video.": "Este teléfono no puede crear el vídeo.",
  "The video could not be made. Try again.":
    "No se pudo crear el vídeo. Inténtalo de nuevo.",

  // src/screens/pageTitles.ts, src/game/ (TASK-296: the shape game, «Play»)
  Play: "Juega",
  "{distance} in total": "{distance} en total",
  "{distance} under {pace}": "{distance} por debajo de {pace}",
  "Best {best} · target {target}": "Mejor {best} · objetivo {target}",
  "Longest run {distance}": "Carrera más larga {distance}",
  "Unlocked {date}": "Desbloqueada {date}",
  "Sign in to collect shapes.": "Inicia sesión para coleccionar formas.",
  "{distance} counted so far": "{distance} contados hasta ahora",
  "The game is not available right now.": "El juego no está disponible ahora.",
  "New shape unlocked": "Nueva forma desbloqueada",
  "New shape unlocked: {name}": "Nueva forma desbloqueada: {name}",
  "It is in your collection.": "Está en tu colección.",
  "See collection": "Ver la colección",

  // src/navigation/runPosition.ts, the Android notification of a run (TASK-294)
  "MuW is recording your activity": "MuW está registrando tu actividad",
  "It keeps going with the screen locked, voice included.":
    "Sigue con la pantalla bloqueada, voz incluida.",

  // src/location/startStatus.ts, src/screens/ChooseScreen.tsx,
  // src/explore/ExploreScreen.tsx, ThemedCard.tsx, src/screens/NavigateScreen.tsx,
  // RunPanel.tsx, src/navigation/runStats.ts, src/intro/SavedLogo.tsx
  // (TASK-210, parte H)
  "Starting from your position.": "Sales desde tu posición.",
  "Starting from {place}.": "Sales desde {place}.",
  "Starting from a point on the map.": "Sales desde un punto del mapa.",
  "Search for a city or street to start from.":
    "Busca una ciudad o una calle desde donde salir.",
  "Location is off for MuW. Allow it in Settings, or search for a place to start from.":
    "La ubicación está desactivada para MuW. Permítela en Ajustes o busca un lugar desde donde salir.",
  "Your position is not available right now. Search for a place to start from.":
    "Tu posición no está disponible ahora. Busca un lugar desde donde salir.",
  START: "SALIDA",
  "My position": "Mi posición",
  "Another place": "Otro lugar",
  "No recommended routes near this start yet. Draw one: the best ones will show up here.":
    "Aún no hay rutas recomendadas cerca de esta salida. Dibuja una: las mejores aparecerán aquí.",
  "{distance} away": "a {distance}",
  "Finding the places and drawing the shape through them… This can take a minute.":
    "Buscando los lugares y dibujando la forma que pasa por ellos… Puede tardar un minuto.",
  "{percent}% drawn": "{percent}% dibujado",
  N: "N",
  NE: "NE",
  E: "E",
  SE: "SE",
  S: "S",
  SW: "SO",
  W: "O",
  NW: "NO",
  "{distance} to go": "faltan {distance}",
  "Saved to My activities": "Guardada en Mis actividades",
  // src/social/ContactsFriends.tsx (TASK-262 C)
  "FROM YOUR CONTACTS": "DE TUS CONTACTOS",
  "Find friends in your contacts": "Buscar amigos en tus contactos",
  "Only coded phone numbers leave the phone, never names. The server compares them with the numbers members saved and keeps none.":
    "Del teléfono solo salen los números cifrados, nunca los nombres. El servidor los compara con los números que guardaron los miembros y no conserva ninguno.",
  "Looking in your contacts…": "Buscando en tus contactos…",
  "MuW cannot see your contacts.": "MuW no puede ver tus contactos.",
  "No phone numbers in your contacts.": "No hay números de teléfono en tus contactos.",
  "None of your contacts is on MuW yet.":
    "Ninguno de tus contactos está todavía en MuW.",
  "This server cannot look in your contacts yet.":
    "Este servidor todavía no puede buscar en tus contactos.",
  "The contacts could not be read.": "No se han podido leer los contactos.",
  // «Play», the «Challenges» tab: src/game/{PlayScreen,ChallengesTab,TeamView,
  // ChallengeView,NewChallenge}.tsx, teamsApi.ts, timeLeft.ts, shareCode.ts
  // (TASK-296, parte D)
  Collection: "Colección",
  Challenges: "Retos",
  "Sign in to play with a team.": "Inicia sesión para jugar en equipo.",
  "Teams are not on this server yet.": "Los equipos todavía no están en este servidor.",
  "YOUR TEAMS": "TUS EQUIPOS",
  "No team yet. Create one, or join one with its code.":
    "Todavía sin equipo. Crea uno, o únete a uno con su código.",
  "Team name": "Nombre del equipo",
  Create: "Crear",
  "Team code": "Código del equipo",
  Join: "Unirse",
  "{count} member": "{count} miembro",
  "{count} members": "{count} miembros",
  "No challenge yet": "Todavía sin reto",
  "{done} of {total} pieces done": "{done} de {total} piezas hechas",
  "Code {code}": "Código {code}",
  "Share code": "Compartir el código",
  "Join my team «{name}» on MuW: open Play, Challenges, and enter the code {code}.":
    "Únete a mi equipo «{name}» en MuW: abre Play, Retos, e introduce el código {code}.",
  MEMBERS: "MIEMBROS",
  Owner: "Propietario",
  "Leave team": "Salir del equipo",
  "Leave this team?": "¿Salir de este equipo?",
  "New challenge": "Nuevo reto",
  Pieces: "Piezas",
  "Fewer pieces": "Menos piezas",
  "More pieces": "Más piezas",
  "Each piece": "Cada pieza",
  Fast: "Rápida",
  "Slower pace": "Ritmo más lento",
  "Faster pace": "Ritmo más rápido",
  Days: "Días",
  "Fewer days": "Menos días",
  "More days": "Más días",
  "Start the challenge": "Empezar el reto",
  "{count} pieces · {goal} each": "{count} piezas · {goal} cada una",
  "Piece {n}": "Pieza {n}",
  Free: "Libre",
  Yours: "Tuya",
  "Taken by {name}": "Tomada por {name}",
  "Done by {name}": "Hecha por {name}",
  "Take this piece": "Tomar esta pieza",
  Leave: "Dejar",
  "WHO GAVE WHAT": "QUIÉN HA DADO QUÉ",
  "Nobody has run yet.": "Nadie ha corrido todavía.",
  PIECES: "PIEZAS",
  "Complete! Your team drew it together.":
    "¡Completa! Vuestro equipo la ha dibujado juntos.",
  "Time ran out: {count} piece was missing.":
    "Se acabó el tiempo: faltaba {count} pieza.",
  "Time ran out: {count} pieces were missing.":
    "Se acabó el tiempo: faltaban {count} piezas.",
  "{count} day {hours} h left": "Queda {count} día y {hours} h",
  "{count} days {hours} h left": "Quedan {count} días y {hours} h",
  "{hours} h {minutes} min left": "Quedan {hours} h {minutes} min",
  "{minutes} min {seconds} s left": "Quedan {minutes} min {seconds} s",
  "Time is up": "Se acabó el tiempo",
  "No team with this code.": "Ningún equipo tiene este código.",
  "You can't join this team.": "No puedes unirte a este equipo.",
  "You are in 10 teams already: leave one first.":
    "Ya estás en 10 equipos: sal de uno primero.",
  "This team is not available any more.": "Este equipo ya no está disponible.",
  "This challenge is not available any more.": "Este reto ya no está disponible.",
  "The team has a challenge going already: wait for it to end.":
    "El equipo ya tiene un reto en marcha: espera a que termine.",
  "This challenge is over.": "Este reto ha terminado.",
  "This piece is not there any more.": "Esta pieza ya no existe.",
  "This piece is done already.": "Esta pieza ya está hecha.",
  "Someone holds this piece already.": "Alguien ya tiene esta pieza.",
  "You hold a piece of this challenge already: leave it first.":
    "Ya tienes una pieza de este reto: déjala primero.",
  "You don't hold this piece.": "Esta pieza no es tuya.",
  "This name is not allowed. Choose another one.":
    "Este nombre no está permitido. Elige otro.",
  // src/screens/SignInScreen.tsx, src/settings/NotificationsSetting.tsx
  // (TASK-284 B: the email when away; the names as in its email)
  "If you don't open MuW for 2 weeks, we email you once with what's new.":
    "Si no abres MuW durante 2 semanas, te enviamos un solo correo con las novedades.",
  "Don't send me these emails": "No me envíes más estos correos",
  "Email when I'm away": "Correo cuando no estoy",
  None: "Ninguna",
  Energy: "Energía",
  Chill: "Relax",
  Epic: "Épica",
  Sprint: "Sprint",
  Rock: "Rock",
  Funk: "Funk",
  Sunny: "Alegre",
  Trap: "Trap",
  Retro: "Retro",
  Fiesta: "Fiesta",
  "Tap a track to hear it.": "Toca una pista para escucharla.",
  // src/contest/ (TASK-299 B: the contest card, its rules, the Winner badge)
  "MuW contest": "Concurso MuW",
  "The post with the most reactions wins.": "Gana la publicación con más reacciones.",
  "{count} day left": "Queda {count} día",
  "{count} days left": "Quedan {count} días",
  "Ends today": "Termina hoy",
  "Ended · the winner is coming": "Terminado · el ganador, muy pronto",
  "Publish a run to take part.": "Publica una carrera para participar.",
  "Your best post: #{rank}, {count} reaction":
    "Tu mejor publicación: n.º {rank}, {count} reacción",
  "Your best post: #{rank}, {count} reactions":
    "Tu mejor publicación: n.º {rank}, {count} reacciones",
  "How it works": "Cómo funciona",
  "Official rules": "Bases oficiales",
  "Organised by MuW (Luca Pallaoro). Runs from {start} to {end}.":
    "Organizado por MuW (Luca Pallaoro). Del {start} al {end}.",
  "Anyone with a MuW account can take part, for free, by publishing a run for everyone in the app during the contest.":
    "Puede participar gratis cualquier persona con una cuenta MuW, publicando una carrera para todos en la app durante el concurso.",
  "At the end, the post with the most reactions from other members wins. One reaction per member counts; your own does not. If two posts tie, the one with more MuW hearts wins, then the one published first.":
    "Al final gana la publicación con más reacciones de otros miembros. Cuenta una reacción por miembro; la tuya no cuenta. En caso de empate, gana la que tenga más corazones de MuW y, después, la publicada primero.",
  "The prize has no money value: the winner gets the Winner badge on their profile and their post shown at the top of the Feed for a week.":
    "El premio no tiene valor económico: quien gana recibe la insignia Ganador en su perfil y su publicación aparece arriba del Feed durante una semana.",
  "MuW may leave out a post that breaks the community rules.":
    "MuW puede excluir una publicación que incumpla las normas de la comunidad.",
  "Apple and Google are not sponsors of this contest and are not involved in it in any way.":
    "Apple y Google no patrocinan este concurso y no participan en él de ninguna manera.",
  Winner: "Ganador",
  "{name} won the MuW contest": "{name} ha ganado el concurso MuW",
  // src/contest/ (TASK-343 B: the monthly challenge, not Play's «Challenges»)
  "Monthly challenge": "Reto del mes",
  "See the challenge": "Ver el reto",
  "Publish a run and enter it to take part.":
    "Publica una carrera e inscríbela para participar.",
  "Enter “{theme}”": "Inscribir en “{theme}”",
  "From {start} to {end}": "Del {start} al {end}",
  Ended: "Terminado",
  "{count} person taking part": "{count} persona participa",
  "{count} people taking part": "{count} personas participan",
  "You entered {count} drawing": "Has inscrito {count} dibujo",
  "You entered {count} drawings": "Has inscrito {count} dibujos",
  "Prize: the Winner badge on your profile and your post at the top of the Feed for a week.":
    "Premio: la insignia Ganador en tu perfil y tu publicación arriba del Feed durante una semana.",
  Top: "Top",
  New: "Recientes",
  "Past challenges": "Retos del mes anteriores",
  "No past challenges yet.": "Aún no hay retos del mes anteriores.",
  "No drawings entered yet.": "Aún no hay dibujos inscritos.",
  "This challenge takes no entries now.": "Este reto no admite inscripciones ahora.",
  "This run cannot take part: it must be for everyone, recorded with MuW and published during the challenge.":
    "Esta carrera no puede participar: debe ser para todos, grabada con MuW y publicada durante el reto.",
  "The theme is “{theme}”.": "El tema es “{theme}”.",
  "Anyone with a MuW account can take part, for free: publish a run recorded with MuW for everyone during the challenge, and enter it. You can enter as many drawings as you like, and withdraw them until the challenge ends.":
    "Puede participar gratis cualquier persona con una cuenta MuW: publica para todos una carrera grabada con MuW durante el reto e inscríbela. Puedes inscribir todos los dibujos que quieras y retirarlos hasta que termine el reto.",
  "At the end, the entered post with the most reactions from other members wins. One reaction per member counts; your own does not. If two posts tie, the one with more MuW hearts wins, then the one published first.":
    "Al final gana, entre las publicaciones inscritas, la que tenga más reacciones de otros miembros. Cuenta una reacción por miembro; la tuya no cuenta. En caso de empate, gana la que tenga más corazones de MuW y, después, la publicada primero.",
  "MuW may leave out a post that does not fit the theme or breaks the community rules.":
    "MuW puede excluir una publicación que no se ajuste al tema o que incumpla las normas de la comunidad.",
  // src/route/NearYou.tsx (TASK-306: shapes ready near you, or in other cities)
  "NEAR YOU": "CERCA DE TI",
  "SHAPES TO TRY": "FORMAS PARA PROBAR",
  // src/game/PlayRow.tsx (TASK-327: «Play» under the distance of «Draw»)
  PLAY: "JUEGA",
  "Collect shapes by running": "Colecciona formas corriendo",
  // src/screens/NavigateScreen.tsx (TASK-303)
  "The route is {distance} away, to the {direction}.":
    "La ruta sigue a {distance}, hacia el {direction}.",
  "Follow the dotted line back to the route.":
    "Sigue la línea de puntos para volver a la ruta.",
  // src/social/DrawingCard.tsx (TASK-307: «Start» on a drawing follows its track)
  "This route has no turn directions: follow the line on the map.":
    "Esta ruta no tiene indicaciones de giro: sigue la línea en el mapa.",
  // src/game/runStripData.ts (TASK-296 E: the game's line on the run screen)
  "Last km {pace} · target {target}": "Último km {pace} · objetivo {target}",
  "Last mi {pace} · target {target}": "Última mi {pace} · objetivo {target}",

  // src/settings/FeedbackSetting.tsx, feedbackFields.ts, SettingsPage.tsx (TASK-308)
  "Send feedback": "Envíanos tus comentarios",
  "Thank you! Your message reached us.": "¡Gracias! Tu mensaje nos ha llegado.",
  "Ideas, problems, anything that would make MuW better: we read every message.":
    "Ideas, problemas, todo lo que haría mejor a MuW: leemos cada mensaje.",
  "Write here…": "Escribe aquí…",
  "Your message": "Tu mensaje",
  "It reaches us with your username, your email and the app's version, so we can answer you.":
    "Nos llega con tu nombre de usuario, tu correo y la versión de la app, para que podamos responderte.",
  "Write something first.": "Escribe algo primero.",
  "You sent a lot of feedback today. Try again tomorrow.":
    "Hoy ya nos has escrito mucho. Vuelve a intentarlo mañana.",
  FEEDBACK: "COMENTARIOS",
  // src/settings/sport.ts (TASK-305 D0: paragliding, «Soon» in «Sport»)
  Paragliding: "Parapente",
  // src/explore/ExploredCard.tsx, src/social/DrawingCard.tsx (TASK-313)
  "Draw it near me": "Dibujarla cerca de mí",
  // src/route/RoutePanel.tsx (TASK-311 B: a word in one line that did not come out)
  "This word may come out better with the pen up: each letter on its own.":
    "Esta palabra puede salir mejor con el lápiz levantado: cada letra por separado.",
  "Lift the pen": "Levantar el lápiz",
  // src/route/RoutePanel.tsx (TASK-317: the wait in «Draw»)
  "Warming up: {name}…": "Calentando: {name}…",
  "Warming up: “{word}”…": "Calentando: «{word}»…",
  "Warming up: the picture…": "Calentando: la foto…",

  // src/api/messages.ts (TASK-319: private messages)
  "A message needs some words.": "Un mensaje necesita algunas palabras.",
  "A message is at most {max} characters.":
    "Un mensaje tiene como máximo {max} caracteres.",
  "Too many messages in a minute. Wait a moment and try again.":
    "Demasiados mensajes en un minuto. Espera un momento y vuelve a intentarlo.",
  "You can't send negative messages in this app.":
    "En esta app no puedes enviar mensajes negativos.",
  "This conversation is not available.": "Esta conversación no está disponible.",

  // src/messages/ConversationList.tsx, MessagesOverlay.tsx, MessagesRow.tsx, MessageButton.tsx (TASK-319)
  Messages: "Mensajes",
  "Messages, {count} waiting": "Mensajes, {count} pendientes",
  "Message requests": "Solicitudes de mensaje",
  "Message requests, {count} waiting": "Solicitudes de mensaje, {count} pendientes",
  "No messages yet. Open someone's profile and tap Message to write to them.":
    "Todavía no hay mensajes. Abre el perfil de alguien y toca Mensaje para escribirle.",
  "No message requests.": "No hay solicitudes de mensaje.",
  "You: {text}": "Tú: {text}",
  "{name}, new message: {text}": "{name}, mensaje nuevo: {text}",
  Message: "Mensaje",
  "Message {name}": "Escribir a {name}",

  // src/messages/ConversationScreen.tsx, MessageSheet.tsx (TASK-319)
  "No messages yet.": "Todavía no hay mensajes.",
  "Show earlier messages": "Mostrar mensajes anteriores",
  "Touch and hold to delete it": "Mantén pulsado para eliminarlo",
  "Touch and hold to report it": "Mantén pulsado para denunciarlo",
  "Message request sent. You can write again when {name} accepts it.":
    "Solicitud de mensaje enviada. Podrás volver a escribir cuando {name} la acepte.",
  "{name} wants to send you a message.": "{name} quiere enviarte un mensaje.",
  "{name} gets this as a message request. You can send one message until they accept it.":
    "{name} lo recibirá como solicitud de mensaje. Hasta que la acepte, puedes enviar un solo mensaje.",
  "Write a message…": "Escribe un mensaje…",
  "Delete this message for both of you?": "¿Eliminar este mensaje para los dos?",
  "Report this message": "Denunciar este mensaje",
  // src/explore/ExploredCard.tsx, social/DrawingCard.tsx, mapdraw/DrawOnMap.tsx,
  // RoutePanel.tsx, favorites/favoriteRoute.ts (TASK-320, TASK-331: the figure
  // drawn by hand on the map)
  "Edit the drawing": "Editar el dibujo",
  Erase: "Borrar",
  Drawing: "Dibujo",
  "Rub a line to erase that piece. A piece cut off joins the drawing with a dash.":
    "Pasa el dedo por una línea para borrar ese trozo. Un trozo separado se une al dibujo con una línea discontinua.",
  // src/imports/, activities/RunEnd.tsx, feed/FeedPost.tsx (TASK-312 B:
  // «Add past activity» from a GPX, TCX or FIT file, «Imported»)
  "Add past activity": "Añadir una actividad pasada",
  "From a file": "Desde un archivo",
  "GPX, TCX or FIT from Strava, Garmin, Komoot…":
    "GPX, TCX o FIT de Strava, Garmin, Komoot…",
  "Export the activity as a file from the other app or its website, save it in Files, then pick it here.":
    "Exporta la actividad como archivo desde la otra app o su web, guárdala en Archivos y elígela aquí.",
  Imported: "Importada",
  "Imported activities don't count for Play or contests.":
    "Las actividades importadas no cuentan para el juego ni para los concursos.",
  "This file is not GPX, TCX or FIT.": "Este archivo no es GPX, TCX ni FIT.",
  "This file has no times: it is a route, not an activity.":
    "Este archivo no tiene horas: es una ruta, no una actividad.",
  "This file has no positions.": "Este archivo no tiene posiciones.",
  "This file is too big (over 25 MB).":
    "Este archivo es demasiado grande (más de 25 MB).",
  "Activities before 2020 cannot be added.":
    "No se pueden añadir actividades anteriores a 2020.",
  "Already in My activities.": "Ya está en Mis actividades.",
  // The attachments of the private messages (TASK-333).
  "📷 Photo": "📷 Foto",
  "🎬 Video": "🎬 Vídeo",
  "🗺️ Drawing": "🗺️ Dibujo",
  Photo: "Foto",
  Video: "Vídeo",
  "This video has expired.": "Este vídeo ha caducado.",
  "Video, {duration}": "Vídeo, {duration}",
  "Drawing: {title}, {distance}": "Dibujo: {title}, {distance}",
  "Add a photo, a video or a drawing": "Añade una foto, un vídeo o un dibujo",
  "Add a message…": "Añade un mensaje…",
  "Couldn't send. Tap to try again.":
    "No se ha enviado. Toca para volver a intentarlo.",
  "This video is longer than {seconds} seconds. Choose a shorter one.":
    "Este vídeo dura más de {seconds} segundos. Elige uno más corto.",
  "This video is too large: at most {mb} MB. Choose a shorter one.":
    "Este vídeo es demasiado grande: como máximo {mb} MB. Elige uno más corto.",
  "Too many videos today. Try again tomorrow.":
    "Hoy ya hay demasiados vídeos. Vuelve a intentarlo mañana.",
  "Too many photos today. Try again tomorrow.":
    "Hoy ya hay demasiadas fotos. Vuelve a intentarlo mañana.",
  "Videos can't be sent right now. Try again later.":
    "Ahora no se pueden enviar vídeos. Vuelve a intentarlo más tarde.",
  // The drawings of the private messages (TASK-333 part C).
  "Send to a friend": "Enviar a amigos",
  "Send to…": "Enviar a…",
  "Search people": "Buscar personas",
  "Sent to {name}.": "Enviado a {name}.",
  "Send a drawing": "Enviar un dibujo",
  "Photos, videos and drawings can be sent once {name} accepts your message.":
    "Podrás enviar fotos, vídeos y dibujos cuando {name} acepte tu mensaje.",

  // src/profile/BadgeRow.tsx (TASK-341: the badges of a profile)
  "First drawing": "Primer dibujo",
  "10 drawings": "10 dibujos",
  "{distance} drawing": "Dibujo de {distance}",
  "Not earned yet: {badge}": "Aún no conseguido: {badge}",
  // src/messages/messageTime.ts, ConversationList.tsx (TASK-353: times in the chat)
  Today: "Hoy",
  Yesterday: "Ayer",
  "{day} {month}": "{day} {month}",
  "{name}, {count} new messages: {text}": "{name}, {count} mensajes nuevos: {text}",
};
