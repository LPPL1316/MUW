/**
 * What the account-deletion page says, in the app's five languages
 * (TASK-294 C, ADR-0253). Google Play asks every app with accounts for a
 * public page that names the app, shows the steps to request the deletion
 * of an account, and says which data is deleted or kept, and for how long.
 * Every sentence matches the privacy policy (`apps/mobile/src/about/content`):
 * change it here when the app changes, then run
 * `node site/tools/make_account_deletion.mjs`.
 */

/** Where to write: the address of the privacy policy, the user's choice. */
export const CONTACT = "muw2610@gmail.com";

/** Within how many days a request by email is carried out. */
export const DAYS = 30;

export const DELETION = {
  en: {
    title: "Delete your MuW account",
    intro:
      "MuW is the app by Luca Pallaoro that draws routes shaped like a heart, a word or a picture. You can delete your account and everything that is yours at any time, from the app or by email.",
    inAppHeading: "From the app",
    inAppSteps: [
      "Open MuW and go to «Profile».",
      "Open «Settings».",
      "At the bottom, tap «Delete account» and confirm.",
    ],
    inAppNote: "The account and its data are deleted at once. This cannot be undone.",
    emailHeading: "Without the app",
    emailText:
      "If you no longer have the app or cannot log in, write to us from the email address of your account, with your username:",
    emailNote: `We delete the account within ${DAYS} days and reply when it is done.`,
    deletedHeading: "What is deleted",
    deleted: [
      "your profile: username, bio, picture, email address and phone number;",
      "your runs and the drawings you published;",
      "your favorites, comments, reactions, who you follow and who follows you;",
      "your game data and any notification waiting to be sent;",
      "the push token of your phone and the sessions of your phones.",
    ],
    backupNote:
      "A backup of the database is made every night and kept for 13 days: a deleted account is out of every backup within 14 days.",
    keptHeading: "What stays",
    kept: [
      "the routes our engine drew, which say nothing about who asked for them;",
      "the search events, kept without anything that says who you are;",
      "in a team's challenges, the pieces you ran, without your name.",
    ],
    partialHeading: "Deleting only some of your data",
    partialText:
      "Without deleting the account you can, in the app, delete a run from «My activities», take a route out of «Favorites», delete your own comments, and change or remove your picture, bio and phone number in «Profile» and «Settings».",
    privacy: "Privacy policy",
    privacyLine: "What we keep, why and for how long:",
  },
  it: {
    title: "Eliminare il tuo account MuW",
    intro:
      "MuW è l'app di Luca Pallaoro che disegna percorsi a forma di cuore, di parola o di immagine. Puoi eliminare il tuo account e tutto ciò che è tuo in qualsiasi momento, dall'app o via email.",
    inAppHeading: "Dall'app",
    inAppSteps: [
      "Apri MuW e vai in «Profilo».",
      "Apri «Impostazioni».",
      "In fondo, tocca «Elimina account» e conferma.",
    ],
    inAppNote: "L'account e i suoi dati si cancellano subito. Non si può annullare.",
    emailHeading: "Senza l'app",
    emailText:
      "Se non hai più l'app o non riesci a entrare, scrivici dall'indirizzo email del tuo account, con il tuo nome utente:",
    emailNote: `Eliminiamo l'account entro ${DAYS} giorni e ti rispondiamo quando è fatto.`,
    deletedHeading: "Che cosa viene eliminato",
    deleted: [
      "il tuo profilo: nome utente, bio, foto, indirizzo email e numero di telefono;",
      "le tue corse e i disegni che hai pubblicato;",
      "i preferiti, i commenti, le reazioni, chi segui e chi ti segue;",
      "i dati del gioco e le notifiche in attesa di invio;",
      "il token delle notifiche push e le sessioni dei tuoi telefoni.",
    ],
    backupNote:
      "Una copia di sicurezza del database viene fatta ogni notte e tenuta 13 giorni: un account eliminato esce da ogni copia entro 14 giorni.",
    keptHeading: "Che cosa resta",
    kept: [
      "i percorsi disegnati dal nostro motore, che non dicono nulla su chi li ha chiesti;",
      "gli eventi delle ricerche, tenuti senza nulla che dica chi sei;",
      "nelle sfide di una squadra, i pezzi che hai corso, senza il tuo nome.",
    ],
    partialHeading: "Eliminare solo una parte dei dati",
    partialText:
      "Senza eliminare l'account puoi, nell'app, cancellare una corsa da «Le mie attività», togliere un percorso dai «Preferiti», cancellare i tuoi commenti, e cambiare o togliere foto, bio e numero di telefono in «Profilo» e «Impostazioni».",
    privacy: "Informativa sulla privacy",
    privacyLine: "Che cosa teniamo, perché e per quanto tempo:",
  },
  de: {
    title: "Dein MuW-Konto löschen",
    intro:
      "MuW ist die App von Luca Pallaoro, die Routen in Form eines Herzens, eines Wortes oder eines Bildes zeichnet. Du kannst dein Konto und alles, was dir gehört, jederzeit löschen, in der App oder per E-Mail.",
    inAppHeading: "In der App",
    inAppSteps: [
      "Öffne MuW und gehe zu «Profil».",
      "Öffne «Einstellungen».",
      "Tippe ganz unten auf «Konto löschen» und bestätige.",
    ],
    inAppNote: "Das Konto und seine Daten werden sofort gelöscht. Das lässt sich nicht rückgängig machen.",
    emailHeading: "Ohne die App",
    emailText:
      "Wenn du die App nicht mehr hast oder dich nicht anmelden kannst, schreib uns von der E-Mail-Adresse deines Kontos, mit deinem Benutzernamen:",
    emailNote: `Wir löschen das Konto innerhalb von ${DAYS} Tagen und antworten, sobald es erledigt ist.`,
    deletedHeading: "Was gelöscht wird",
    deleted: [
      "dein Profil: Benutzername, Bio, Bild, E-Mail-Adresse und Telefonnummer;",
      "deine Läufe und die Zeichnungen, die du veröffentlicht hast;",
      "deine Favoriten, Kommentare, Reaktionen, wem du folgst und wer dir folgt;",
      "deine Spieldaten und jede Benachrichtigung, die noch gesendet werden sollte;",
      "das Push-Token deines Telefons und die Sitzungen deiner Telefone.",
    ],
    backupNote:
      "Jede Nacht wird ein Backup der Datenbank angelegt und 13 Tage aufbewahrt: ein gelöschtes Konto ist innerhalb von 14 Tagen aus jedem Backup verschwunden.",
    keptHeading: "Was bleibt",
    kept: [
      "die Routen, die unsere Engine gezeichnet hat; sie sagen nichts darüber, wer sie angefragt hat;",
      "die Suchereignisse, ohne irgendetwas, das sagt, wer du bist;",
      "in den Herausforderungen eines Teams die Stücke, die du gelaufen bist, ohne deinen Namen.",
    ],
    partialHeading: "Nur einen Teil der Daten löschen",
    partialText:
      "Ohne das Konto zu löschen, kannst du in der App einen Lauf aus «Meine Aktivitäten» löschen, eine Route aus den «Favoriten» entfernen, deine eigenen Kommentare löschen und Bild, Bio und Telefonnummer in «Profil» und «Einstellungen» ändern oder entfernen.",
    privacy: "Datenschutzerklärung",
    privacyLine: "Was wir aufbewahren, warum und wie lange:",
  },
  fr: {
    title: "Supprimer ton compte MuW",
    intro:
      "MuW est l'app de Luca Pallaoro qui dessine des parcours en forme de cœur, de mot ou d'image. Tu peux supprimer ton compte et tout ce qui est à toi à tout moment, depuis l'app ou par e-mail.",
    inAppHeading: "Depuis l'app",
    inAppSteps: [
      "Ouvre MuW et va dans «Profil».",
      "Ouvre «Réglages».",
      "Tout en bas, touche «Supprimer le compte» et confirme.",
    ],
    inAppNote: "Le compte et ses données sont supprimés tout de suite. C'est irréversible.",
    emailHeading: "Sans l'app",
    emailText:
      "Si tu n'as plus l'app ou si tu ne peux pas te connecter, écris-nous depuis l'adresse e-mail de ton compte, avec ton nom d'utilisateur :",
    emailNote: `Nous supprimons le compte sous ${DAYS} jours et te répondons quand c'est fait.`,
    deletedHeading: "Ce qui est supprimé",
    deleted: [
      "ton profil : nom d'utilisateur, bio, photo, adresse e-mail et numéro de téléphone ;",
      "tes courses et les dessins que tu as publiés ;",
      "tes favoris, commentaires, réactions, qui tu suis et qui te suit ;",
      "tes données de jeu et toute notification en attente d'envoi ;",
      "le jeton des notifications push de ton téléphone et les sessions de tes téléphones.",
    ],
    backupNote:
      "Une sauvegarde de la base de données est faite chaque nuit et gardée 13 jours : un compte supprimé disparaît de toutes les sauvegardes sous 14 jours.",
    keptHeading: "Ce qui reste",
    kept: [
      "les parcours dessinés par notre moteur, qui ne disent rien sur qui les a demandés ;",
      "les événements de recherche, gardés sans rien qui dise qui tu es ;",
      "dans les défis d'une équipe, les morceaux que tu as courus, sans ton nom.",
    ],
    partialHeading: "Supprimer seulement une partie de tes données",
    partialText:
      "Sans supprimer le compte, tu peux, dans l'app, supprimer une course dans «Mes activités», retirer un parcours des «Favoris», supprimer tes propres commentaires, et changer ou retirer ta photo, ta bio et ton numéro de téléphone dans «Profil» et «Réglages».",
    privacy: "Politique de confidentialité",
    privacyLine: "Ce que nous gardons, pourquoi et combien de temps :",
  },
  es: {
    title: "Eliminar tu cuenta de MuW",
    intro:
      "MuW es la app de Luca Pallaoro que dibuja rutas con forma de corazón, de palabra o de imagen. Puedes eliminar tu cuenta y todo lo que es tuyo en cualquier momento, desde la app o por correo.",
    inAppHeading: "Desde la app",
    inAppSteps: [
      "Abre MuW y ve a «Perfil».",
      "Abre «Ajustes».",
      "Abajo del todo, toca «Eliminar cuenta» y confirma.",
    ],
    inAppNote: "La cuenta y sus datos se borran al instante. No se puede deshacer.",
    emailHeading: "Sin la app",
    emailText:
      "Si ya no tienes la app o no puedes entrar, escríbenos desde la dirección de correo de tu cuenta, con tu nombre de usuario:",
    emailNote: `Eliminamos la cuenta en un plazo de ${DAYS} días y te respondemos cuando esté hecho.`,
    deletedHeading: "Qué se elimina",
    deleted: [
      "tu perfil: nombre de usuario, bio, foto, dirección de correo y número de teléfono;",
      "tus carreras y los dibujos que has publicado;",
      "tus favoritos, comentarios, reacciones, a quién sigues y quién te sigue;",
      "tus datos del juego y cualquier notificación pendiente de envío;",
      "el token de notificaciones push de tu teléfono y las sesiones de tus teléfonos.",
    ],
    backupNote:
      "Cada noche se hace una copia de seguridad de la base de datos y se guarda 13 días: una cuenta eliminada sale de todas las copias en 14 días.",
    keptHeading: "Qué se conserva",
    kept: [
      "las rutas dibujadas por nuestro motor, que no dicen nada de quién las pidió;",
      "los eventos de búsqueda, guardados sin nada que diga quién eres;",
      "en los retos de un equipo, los tramos que corriste, sin tu nombre.",
    ],
    partialHeading: "Eliminar solo una parte de tus datos",
    partialText:
      "Sin eliminar la cuenta puedes, en la app, borrar una carrera en «Mis actividades», quitar una ruta de «Favoritos», borrar tus propios comentarios, y cambiar o quitar tu foto, tu bio y tu número de teléfono en «Perfil» y «Ajustes».",
    privacy: "Política de privacidad",
    privacyLine: "Qué guardamos, por qué y durante cuánto tiempo:",
  },
};
