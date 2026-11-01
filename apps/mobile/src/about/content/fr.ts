import type { AboutContent, AboutDocument } from "../documents";

/**
 * «Help», «Terms» and «Privacy» in French (TASK-210 F): the same sections
 * as `en.ts`, in the same order (a test compares them). The names of
 * buttons are the ones the app shows in French; the pages as
 * TASK-210 G names them: «Fil», «Dessiner», «Explorer». «Terms» and «Privacy» are
 * drafts, as in English, with the same places to fill (the user's choice
 * of 2026-10-07).
 */

const UPDATED = "10 octobre 2026";
/** «Privacy» is final since the user approved it (TASK-237 D; without ads, TASK-267 B); dated the day the contacts entered (TASK-262 C). */
const PRIVACY_UPDATED = "31 octobre 2026";

const help: AboutDocument = {
  title: "Comment fonctionne MuW",
  draft: false,
  updated: null,
  sections: [
    {
      heading: "Ce qu'est MuW",
      blocks: [
        "MuW dessine de vrais parcours qui tracent une forme sur la carte. Tu choisis la forme, la distance et le point de départ ; tu obtiens un parcours sur de vraies rues, avec son fichier GPX.",
        "L'app a quatre pages côte à côte, «Fil», «Dessiner», «Explorer» et ton profil : glisse vers la gauche ou la droite, ou touche un nom en haut. Le cercle en haut t'amène à ton profil.",
      ],
    },
    {
      heading: "Dessiner un parcours",
      blocks: [
        {
          bullets: [
            "Choisis une forme : un cœur, une étoile, un chat et d'autres, un mot de A à Z, ou le contour de ta propre photo.",
            "Règle la distance : jusqu'à 21 km à pied, en partant d'où tu es ou d'un lieu que tu cherches.",
            "Touche «Dessiner le parcours». MuW dessine jusqu'à trois parcours sur de vraies rues, A, B et C : garde celui qui te plaît.",
            "«Exporter le GPX» te donne le fichier pour ta montre ou pour une autre app.",
          ],
        },
        "Un parcours prend en général quelques secondes ; les plus longs peuvent prendre jusqu'à une minute.",
      ],
    },
    {
      heading: "Explorer",
      blocks: [
        "Des parcours déjà dessinés dans ta ville, prêts à partir : pas d'attente, il suffit d'en choisir un.",
        "Choisis «Près de moi», une ville proche ou cherche une ville, puis touche un parcours pour le voir sur la carte.",
      ],
    },
    {
      heading: "Courir un parcours",
      blocks: [
        {
          bullets: [
            "«Démarrer» lance la course après un court compte à rebours.",
            "Une voix t'annonce chaque virage à l'avance. La carte montre la partie déjà courue et celle qui reste devant toi.",
            "«Pause» arrête le chrono et «Reprendre» le relance.",
            "Pour terminer la course, maintiens le bouton stop : un appui court ne la termine pas.",
          ],
        },
        "«Courir sans parcours» enregistre quand même ta course, sans forme à suivre.",
        "Un parcours est une suggestion tirée des données de la carte : garde les yeux sur la route et respecte le code de la route.",
      ],
    },
    {
      heading: "Garder tes courses et tes parcours",
      blocks: [
        "Avec un compte, «Enregistrer» à la fin d'une course la garde dans «Mes activités», dans «Profil» ; «Ignorer» la jette. Sans connexion, la course attend sur le téléphone et part plus tard.",
        "Le cœur sur un parcours de la carte le garde dans «Favoris».",
      ],
    },
    {
      heading: "Publier et partager",
      blocks: [
        "Une course enregistrée est privée : toi seul la vois. Les autres membres voient sur ton profil seulement les totaux de toutes tes courses enregistrées, distance et dénivelé, jamais les courses elles-mêmes. Choisis «Tout le monde» ou «Abonnés» sous «Qui peut la voir», à la fin de la course ou sur une course de «Mes activités», et ils la voient comme un dessin sur ton profil, sans ses 200 premiers et 200 derniers mètres. La prochaine course que tu termines part de ton dernier choix enregistré : tu le vois avant «Enregistrer» et tu peux le changer. Une activité ajoutée depuis un fichier part toujours de «Moi seulement».",
        "«Partager» crée une image de ta course à envoyer où tu veux.",
      ],
    },
    {
      heading: "Fil et amis",
      blocks: [
        "«Fil» montre des dessins pour trouver des idées : touches-en un pour ouvrir son parcours et le démarrer.",
        "La loupe en haut de «Fil» trouve les autres membres par leur nom. Sur un profil, tu peux toucher «Suivre» ; tes demandes, tes abonnés et les personnes que tu suis sont dans «Profil».",
        "Sur le dessin public d'un membre, tu peux réagir avec un emoji, envoyer un super like et écrire un commentaire. Les commentaires négatifs ne sont pas acceptés.",
      ],
    },
    {
      heading: "Messages",
      blocks: [
        "«Message» sur le profil d'un membre lui écrit. S'il te suit, ton message arrive dans ses «Messages» ; sinon, il arrive comme demande, et tu peux envoyer un seul message tant qu'elle n'est pas acceptée.",
        "Tes conversations sont dans «Profil», «Messages», avec «Demandes de message» en haut. Accepte une demande pour vous écrire, supprime-la (la personne qui a écrit n'est pas prévenue) ou bloque-la.",
        "Maintiens appuyé un message pour supprimer le tien, pour vous deux, ou pour signaler un message reçu. Personne ne voit si tu as lu un message. Avec le push allumé, MuW te prévient de chaque message et de chaque demande.",
        "Dans une conversation, touche + pour envoyer une photo, une vidéo de 60 secondes au maximum ou un dessin, ou touche Envoyer à des amis sur un parcours ou un dessin. Tu peux les envoyer quand l'autre personne a accepté ton message. Les vidéos sont gardées 30 jours, ou moins quand notre espace pour les vidéos est plein : les plus anciennes partent d'abord. Touche un dessin pour l'ouvrir sur la carte, le lancer, exporter son GPX ou le garder dans tes favoris.",
      ],
    },
    {
      heading: "Course, vélo, pagaie",
      blocks: [
        "Choisis ton sport avec le bouton à côté de ton profil, ou dans «Réglages».",
        {
          bullets: [
            "Course : jusqu'à 21 km sur de vraies rues, avec la voix virage par virage.",
            "Vélo : de 10 à 30 km, sur les pistes cyclables et les rues ouvertes aux vélos. Les virages sont annoncés à l'avance et l'écran montre ta vitesse.",
            "Pagaie : de 1 à 5 km sur les lacs et la mer, près du rivage, pour ton canoë, ton kayak ou ta planche. Tu suis la ligne sur la carte.",
          ],
        },
        "Sur l'eau, lis l'avis de sécurité avant de partir : porte un gilet de sauvetage, vérifie la météo et le vent, respecte les règles locales. Le parcours reste à moins de 1 km du rivage : cela ne le rend ni sûr ni autorisé.",
      ],
    },
    {
      heading: "Réglages",
      blocks: [
        {
          bullets: [
            "Photo de profil, e-mail et numéro de téléphone. Le numéro est facultatif et toi seul le vois.",
            "Langue : English, Deutsch, Italiano, Español ou Français. La voix la suit.",
            "Cartes hors ligne : le téléphone garde les cartes autour de toi et dessine les parcours tout seul ; «Supprimer» libère l'espace.",
            "Unités : celles de ton téléphone, kilomètres ou miles. Avec les miles, les distances, l'allure et la voix suivent : une annonce à chaque mile, les virages en pieds.",
            "Notifications : trois interrupteurs. «Notifications par e-mail» et «Notifications push» sont éteints jusqu'à ce que tu les allumes ; «E-mail en cas d'absence» est allumé jusqu'à ce que tu l'éteignes. Avec le push allumé, et dès que ton téléphone l'autorise, MuW te prévient tout de suite des demandes de suivi, des demandes acceptées, des réactions, des commentaires et des identifications ; en touchant une notification, tu ouvres la publication ou le profil. Avec l'e-mail allumé, les mêmes nouvelles arrivent dans un e-mail par jour au plus. «E-mail en cas d'absence» : si tu n'ouvres pas MuW pendant 2 semaines, un e-mail avec les nouveautés.",
          ],
        },
      ],
    },
    {
      heading: "Ton compte",
      blocks: [
        "Tu t'inscris avec un e-mail, un nom d'utilisateur et un mot de passe. Tu dois avoir au moins 16 ans.",
        "Il n'est pas encore possible de réinitialiser un mot de passe oublié : garde bien le tien.",
        "«Se déconnecter» et «Supprimer le compte» sont en bas de «Réglages». Supprimer le compte supprime tout ce qui est à toi, tout de suite, et ne peut pas être annulé.",
      ],
    },
    {
      heading: "Questions",
      blocks: ["Écris à [contact email]."],
    },
  ],
};

const terms: AboutDocument = {
  title: "Conditions d'utilisation",
  draft: true,
  updated: UPDATED,
  sections: [
    {
      heading: "Qui fournit MuW",
      blocks: [
        "MuW est fournie par [name] («nous»). Tu peux nous écrire à [contact email].",
        "Ces conditions sont l'accord entre toi et nous pour l'utilisation de l'app MuW. En créant un compte ou en utilisant l'app, tu les acceptes.",
      ],
    },
    {
      heading: "Ce qu'est MuW",
      blocks: [
        "MuW dessine des parcours qui tracent une forme sur la carte, pour courir, rouler ou pagayer ; elle enregistre ton activité pendant que tu les suis ; et elle permet aux membres de publier leurs dessins, de se suivre, de réagir et de commenter.",
      ],
    },
    {
      heading: "Qui peut l'utiliser",
      blocks: [
        "Tu dois avoir au moins 16 ans pour créer un compte. Dessiner un parcours ne demande pas de compte.",
      ],
    },
    {
      heading: "Ton compte",
      blocks: [
        {
          bullets: [
            "Tu t'inscris avec une adresse e-mail, un nom d'utilisateur et un mot de passe. Le compte est à toi seul : n'utilise pas le compte d'une autre personne et ne te fais pas passer pour quelqu'un d'autre.",
            "Garde ton mot de passe secret. Tu es responsable de ce qui est fait avec ton compte. Il n'est pas encore possible de réinitialiser un mot de passe oublié.",
            "Si tu ajoutes un numéro de téléphone, ajoute seulement un numéro qui est le tien.",
            "Tu peux te déconnecter ou supprimer ton compte à tout moment depuis «Réglages».",
          ],
        },
      ],
    },
    {
      heading: "Comment utiliser MuW",
      blocks: [
        "Utilise l'app dans le respect de la loi et des autres membres. En particulier, tu ne dois pas :",
        {
          bullets: [
            "publier de contenu offensant, haineux, menaçant ou harcelant, ni dans ton nom d'utilisateur, ta bio, ta photo, tes titres ou tes commentaires ;",
            "publier de contenu que tu n'as pas le droit de publier, ni les données personnelles d'autres personnes sans leur permission ;",
            "essayer de casser, de surcharger ou de contourner le service, ni collecter des données sur ses membres par des moyens automatisés.",
          ],
        },
      ],
    },
    {
      heading: "Ce que tu publies",
      blocks: [
        "Tes courses, tes dessins, leurs titres, ton profil et tes commentaires restent à toi.",
        "En les publiant, tu nous permets de les garder et de les montrer dans l'app aux autres membres, seulement pour faire fonctionner le service : une autorisation gratuite et non exclusive qui prend fin quand tu supprimes le contenu ou ton compte.",
        "L'app n'accepte pas les commentaires contenant des mots offensants : un filtre automatique de mots les refuse. Nous pouvons retirer un contenu contraire à ces conditions. Pour nous signaler un contenu qui ne devrait pas être là, écris à [contact email].",
      ],
    },
    {
      heading: "Sécurité",
      blocks: [
        "Un parcours est une suggestion calculée à partir des données de la carte. Personne ne l'a parcouru pour toi, et la carte peut être incomplète ou dépassée : une rue peut être fermée, privée, sans trottoir ou dangereuse.",
        {
          bullets: [
            "Tu es responsable de l'endroit où tu vas. Respecte le code de la route et la signalisation, même quand le parcours ou la voix disent autre chose.",
            "Vérifie les conditions avant et pendant ton activité : circulation, lumière, météo, le terrain, ta propre santé et ta forme.",
            "Ne regarde pas le téléphone quand tu te déplaces dans la circulation.",
            "Sur l'eau, sois encore plus prudent : porte un gilet de sauvetage, vérifie la météo et le vent, respecte les règles locales (zones de baignade, chenaux, ports). MuW ne les connaît pas. Un parcours près du rivage n'est pas pour autant sûr ni autorisé.",
          ],
        },
        "Les distances, les temps et la vitesse viennent du GPS du téléphone et sont des estimations.",
      ],
    },
    {
      heading: "Pas de garantie, et les limites de notre responsabilité",
      blocks: [
        "Nous travaillons pour que MuW fonctionne et que ses parcours soient bons, mais l'app est fournie telle quelle : nous ne promettons pas qu'elle soit toujours disponible ou sans erreurs, qu'un parcours puisse être terminé, ni que ses mesures soient exactes.",
        "Dans la mesure où la loi le permet, nous ne sommes pas responsables des dommages qui découlent de l'utilisation de l'app ou de ses parcours. Rien dans ces conditions ne limite une responsabilité que la loi ne permet pas de limiter, ni les droits que tu as en tant que consommateur.",
      ],
    },
    {
      heading: "Publicité",
      blocks: ["MuW n'affiche pas de publicité."],
    },
    {
      heading: "Services d'autres",
      blocks: [
        {
          bullets: [
            "Les cartes viennent d'OpenFreeMap et des données d'OpenStreetMap (© contributeurs d'OpenStreetMap).",
            "Les lieux sont recherchés avec Geoapify.",
            "Si tu connectes Strava, les courses que tu y envoies suivent les conditions et les réglages de confidentialité de Strava.",
            "Une image que tu partages sort par le menu de partage du téléphone : l'app qui la reçoit a ses propres conditions.",
          ],
        },
      ],
    },
    {
      heading: "Modifications",
      blocks: [
        "Nous pouvons modifier l'app, et ajouter ou retirer ce qu'elle fait. Quand nous modifions ces conditions, nous changeons la date en haut ; si une modification est importante, nous la ferons connaître avant qu'elle s'applique.",
      ],
    },
    {
      heading: "Fermer le compte",
      blocks: [
        "Tu peux arrêter d'utiliser MuW et supprimer ton compte à tout moment : «Confidentialité» dit ce qui est supprimé et quand. Nous pouvons suspendre ou fermer un compte contraire à ces conditions.",
      ],
    },
    {
      heading: "Droit applicable",
      blocks: [
        "Ces conditions sont régies par [governing law]. Si tu es un consommateur, tu gardes les protections que la loi du pays où tu vis ne permet pas d'écarter.",
      ],
    },
    {
      heading: "Contact",
      blocks: ["[name] · [contact email]"],
    },
  ],
};

const privacy: AboutDocument = {
  title: "Politique de confidentialité",
  draft: false,
  updated: PRIVACY_UPDATED,
  sections: [
    {
      heading: "Qui est responsable de tes données",
      blocks: [
        "Le responsable du traitement de tes données personnelles est Luca Pallaoro. Pour tout ce qui concerne tes données, écris à muw2610@gmail.com.",
        "Ce texte dit quelles données MuW traite, pourquoi, où elles sont gardées et combien de temps, et ce que tu peux faire à ce sujet.",
      ],
    },
    {
      heading: "Sans compte",
      blocks: [
        "Tu peux dessiner des parcours, explorer et courir sans compte. La course elle-même ne quitte alors pas le téléphone. Ce qui quitte quand même le téléphone est décrit sous «Les parcours que tu demandes», «Ta position» et «Les autres qui reçoivent des données».",
      ],
    },
    {
      heading: "Ton compte",
      blocks: [
        {
          bullets: [
            "Ton adresse e-mail et ton nom d'utilisateur, pour te laisser entrer et distinguer les comptes.",
            "Ton mot de passe, gardé seulement sous forme de hash (Argon2id) : nous ne gardons ni ne voyons jamais le mot de passe lui-même.",
            "Le jour de ton inscription et le moment où tu as confirmé avoir au moins 16 ans.",
            "La session de chaque téléphone depuis lequel tu t'es connecté : le téléphone garde un jeton dans son stockage sécurisé, le serveur n'en garde qu'un hash. Une session prend fin 90 jours après sa dernière utilisation, ou quand tu te déconnectes.",
            "Tes trois choix de notifications dans «Réglages» : «Notifications par e-mail» et «Notifications push», éteints jusqu'à ce que tu les allumes, et «E-mail en cas d'absence», allumé jusqu'à ce que tu l'éteignes. Avec le push allumé, le jeton push de ton téléphone, s'il s'agit d'un iPhone ou d'un Android, et la langue de l'app, pour t'envoyer des notifications via le service push d'Expo, qui les transmet à Apple ou à Google. Une notification dit qui a fait quoi, avec le début d'un commentaire. Le jeton est supprimé quand tu éteins le push, te déconnectes ou supprimes ton compte.",
            "La langue de l'app quand tu t'es inscrit, pour t'écrire nos e-mails dans cette langue.",
          ],
        },
        "Ton adresse e-mail n'est jamais montrée aux autres membres.",
      ],
    },
    {
      heading: "Les e-mails de MuW",
      blocks: [
        {
          bullets: [
            "Avec «Notifications par e-mail» allumé, un e-mail par jour au plus, seulement les jours où il y a du nouveau : les demandes de suivi, les demandes acceptées, les réactions, les commentaires et les identifications du jour, comme les disent les notifications push. Jusqu'à son envoi, notre serveur garde qui a fait quoi et sur quelle publication, 7 jours au plus ; ce qui n'est plus vrai au moment de l'écrire reste dehors.",
            "«E-mail en cas d'absence» : si tu n'ouvres pas MuW pendant 2 semaines, un e-mail avec le nombre de nouveaux dessins des personnes que tu suis, avec jusqu'à trois de leurs noms d'utilisateur, ou sinon dans le Feed. Un par absence : le suivant seulement après ton retour puis une nouvelle absence. Il est allumé pour chaque membre, y compris ceux qui se sont inscrits avant ce texte ; tu peux dire non à l'inscription, dans «Réglages» ou avec le lien de l'e-mail.",
            "Chaque e-mail a le lien «Ne plus m'envoyer ces e-mails», qui éteint cet e-mail. Nous les envoyons via Resend, depuis une adresse de getmuw.app.",
            "Les e-mails dont ton compte a besoin, qu'aucun interrupteur n'éteint : un pour confirmer ton adresse quand tu t'inscris ou la changes, un avis à ton ancienne adresse quand tu la changes, et un lien pour un nouveau mot de passe quand tu le demandes.",
          ],
        },
      ],
    },
    {
      heading: "Ton numéro de téléphone (facultatif)",
      blocks: [
        "Tu peux ajouter un numéro de téléphone dans «Réglages». Il est facultatif : l'app fonctionne de la même façon sans lui.",
        "Il est privé : toi seul le vois. Il n'est jamais sur ton profil, dans la recherche ni dans aucune liste. Il sert à ce que les amis qui ont ton numéro dans les contacts de leur téléphone puissent trouver ton compte (voir «Des amis dans tes contacts»).",
        "Nous ne vérifions pas le numéro et nous n'y envoyons aucun message. Tu peux le retirer à tout moment depuis «Réglages» ; il est supprimé avec le compte.",
      ],
    },
    {
      heading: "Des amis dans tes contacts",
      blocks: [
        "Sous la loupe en haut de «Feed», «Trouver des amis dans tes contacts» cherche les membres dont le numéro est dans les contacts de ton téléphone. L'app demande les contacts au téléphone seulement quand tu le touches, et n'en lit que les numéros de téléphone : jamais les noms, les e-mails ni les photos.",
        "Chaque numéro quitte le téléphone codé : écrit avec l'indicatif du pays et transformé en hash (SHA-256). Notre serveur compare les codes à ceux des numéros ajoutés par les membres, répond avec les membres trouvés et ne garde rien de ce qu'il a reçu : ni dans la base de données ni dans un journal.",
        "Le hash d'un numéro de téléphone n'est pas un secret : qui aurait les codes pourrait retrouver les numéros en essayant tous les numéros possibles. C'est pourquoi la vraie protection est que notre serveur n'en garde aucun ; ils ne passent que par la connexion chiffrée.",
        "Les numéros de tes contacts sont les données d'autres personnes : ils sont comparés une fois, pour trouver des comptes, puis oubliés. Pour empêcher quiconque d'essayer les numéros un à un, le serveur compte les recherches de chaque compte sur une heure, en mémoire seulement. Seuls les membres qui ont ajouté leur numéro peuvent être trouvés, et jamais quelqu'un que tu as bloqué ou qui t'a bloqué.",
      ],
    },
    {
      heading: "Ton profil",
      blocks: [
        "Ton nom d'utilisateur, ta bio et ta photo de profil sont ce que les autres membres voient de toi. La photo est gardée sous forme d'une petite image carrée, sans les données que l'appareil photo y ajoute. Toute personne ayant un compte peut chercher les membres par nom d'utilisateur.",
      ],
    },
    {
      heading: "Tes courses et leurs traces GPS",
      blocks: [
        "Avec un compte, quand tu touches «Enregistrer» à la fin d'une course, toute la course part vers notre serveur : chaque position avec son heure et son altitude, les pauses, le parcours suivi, la distance, la durée, un score de la fidélité de la trace au parcours (calculé par notre serveur et non affiché dans l'app) et le nom du lieu. Avec «Ignorer», rien n'est envoyé.",
        "Une course enregistrée est privée, sauf si tu choisis autrement : seul ton compte la voit. Les autres membres voient sur ton profil seulement les totaux de toutes tes courses enregistrées, distance et dénivelé, jamais les courses elles-mêmes. Elle reste jusqu'à ce que tu la supprimes de «Mes activités» ou que tu supprimes ton compte.",
        "Si tu ajoutes une activité passée depuis un fichier, nous gardons sa trace et ses heures comme pour une course enregistrée avec MuW. Nous ne gardons pas le fichier.",
        "Une course commence et finit souvent devant ta porte. C'est pourquoi une course ne devient visible pour les autres membres qu'après que tu as choisi «Tout le monde» ou «Abonnés» sous «Qui peut la voir», et ils voient alors la trace sans ses 200 premiers et 200 derniers mètres, avec le titre que tu lui as donné, et sans les temps, les pauses ni le parcours prévu. Ton choix reste sur ce téléphone pour la course suivante : elle part du dernier enregistré, tu le vois avant «Enregistrer» et tu peux le changer. Une activité ajoutée depuis un fichier part toujours de «Moi seulement».",
        "Qui peut voir une de tes courses peut aussi la suivre avec «Démarrer» et enregistrer cette même trace comme fichier GPX : toujours sans ses 200 premiers et 200 derniers mètres et sans les temps.",
      ],
    },
    {
      heading: "Favoris, commentaires, réactions et abonnements",
      blocks: [
        {
          bullets: [
            "Un parcours que tu gardes dans «Favoris» est enregistré en entier, avec sa ligne, qui commence souvent près de chez toi. Seul ton compte le voit, jusqu'à ce que tu le retires ou que tu supprimes le compte.",
            "Tes commentaires et tes réactions sous un dessin sont vus par les membres qui voient ce dessin. Tu peux supprimer tes propres commentaires.",
            "Les personnes que tu suis, celles qui te suivent et les demandes d'abonnement sont gardées avec ton compte.",
          ],
        },
      ],
    },
    {
      heading: "Messages privés",
      blocks: [
        "Tes messages privés sont gardés sur notre serveur : qui a écrit, à qui, le texte et quand, et pour chacun des deux s'il a accepté la conversation, quand il l'a lue pour la dernière fois et jusqu'à quand il l'a retirée de sa vue. Ils ne sont pas chiffrés de bout en bout. Dans l'app, seuls les deux membres d'une conversation la voient, et personne n'est prévenu qu'un message a été lu. Nous les gardons pour te fournir le service que tu demandes (contrat).",
        "Un message peut porter une photo, une vidéo ou un dessin. Une photo est gardée réduite, sans les données que ton téléphone y ajoute, comme le lieu et le moment où elle a été prise. Une vidéo est gardée telle que ton téléphone l'envoie, sans le lieu où elle a été tournée, et elle est supprimée 30 jours après l'envoi, ou plus tôt, les plus anciennes d'abord, quand notre espace pour les vidéos est plein. Un dessin est une copie du parcours : une course que tu envoies est coupée au début et à la fin comme dans le Feed, un parcours que tu prévois part entier, avec son départ. Les photos et les vidéos ne sont pas chiffrées de bout en bout, ne sont pas dans nos copies de sauvegarde et sont supprimées avec leur message, la conversation ou ton compte. Quand tu signales un message, la personne qui gère MuW voit aussi sa photo, sa vidéo ou son dessin.",
        "Un message à quelqu'un qui ne te suit pas arrive comme demande ; le premier message d'une demande passe par le même filtre de mots que les commentaires.",
        "Tu peux supprimer tes propres messages, pour vous deux. Supprimer une conversation la retire de ta vue ; un message que ni l'un ni l'autre ne voit plus est supprimé. Un blocage supprime la conversation ; supprimer ton compte supprime toutes tes conversations, avec les messages des deux.",
        "Quand tu signales un message, l'e-mail à la personne qui gère MuW ne contient que ce message, jamais le reste de la conversation. Avec le push allumé, la notification d'un message en porte le début, via le service push d'Expo et Apple ou Google, comme pour les commentaires.",
      ],
    },
    {
      heading: "Signalements",
      blocks: [
        "Quand tu signales un dessin, un commentaire ou un profil, nous gardons qui a signalé quoi, la raison et quand. La personne qui gère MuW le reçoit par e-mail et peut masquer ce qui a été signalé aux autres membres. Rien n'est supprimé, et son auteur le voit toujours. Ton signalement n'est jamais montré à l'auteur.",
      ],
    },
    {
      heading: "Courses en groupe",
      blocks: [
        "Si tu crées une course en groupe ou dis que tu y vas, les membres qui peuvent la voir voient ton nom, ta photo et que tu y vas. Quand tu supprimes ton compte, nous supprimons tes courses en groupe et tes réponses.",
      ],
    },
    {
      heading: "Avis",
      blocks: [
        "Quand tu nous écris depuis «Envoie-nous ton avis» dans «Réglages», nous gardons ton message, la version de l'app, le système de ton téléphone (iOS ou Android) et quand tu l'as envoyé. La personne qui gère MuW le reçoit par e-mail avec ton nom d'utilisateur et ton adresse e-mail, pour le lire et, si besoin, te répondre par e-mail. Il n'est jamais montré aux autres membres. Quand tu supprimes ton compte, tes messages sont supprimés avec lui de notre serveur.",
      ],
    },
    {
      heading: "Le jeu des formes",
      blocks: [
        "Avec un compte, notre serveur calcule à partir de tes courses à pied enregistrées combien de kilomètres comptent pour le jeu, tes meilleurs temps sur 1, 5, 10 et 21,1 km, et les formes que tu as collectionnées. Toi seul vois ta collection et tes meilleurs temps. Si tu rejoins une équipe, ses membres voient ton nom d'utilisateur, ta photo, les pièces d'un défi que tu as prises et les kilomètres que tu as donnés à chacune, jamais tes tracés, les heures de tes courses ni où tu as couru. Une équipe ne se trouve qu'avec son code : elle n'est jamais dans une recherche. Supprimer une course retire ses kilomètres du compte, et les formes déjà collectionnées restent. Quand tu supprimes ton compte, tes données du jeu sont supprimées avec lui ; dans les défis d'une équipe, les pièces que tu as courues restent pour les autres, sans ton nom.",
      ],
    },
    {
      heading: "Les parcours que tu demandes",
      blocks: [
        "Pour dessiner un parcours, l'app envoie à notre serveur le départ, la forme ou le mot et la distance. Quand le téléphone a la carte hors ligne de la zone, il dessine le parcours tout seul.",
        "Les parcours que notre moteur dessine restent sur notre serveur sans qui les a demandés, pour répondre tout de suite à qui demande le même dessin à côté et pour les recommander ; nous comptons combien de courses et de favoris suivent chacun. Un parcours part de là où il a été demandé, souvent près de chez quelqu'un, mais ne dit jamais qui l'a demandé ou couru.",
        "Les cartes hors ligne viennent de notre serveur : celle autour de toi et, à l'avance, celles des villes proches. Pour plafonner ces téléchargements, le serveur les compte par jour, selon un numéro anonyme que l'app crée pour le téléphone ; ce compte n'est gardé qu'en mémoire.",
        "Les mots qui décrivent une forme sont lus sur notre serveur et ne sont envoyés à aucun service d'IA externe.",
        "Une photo que tu choisis pour un dessin va une fois vers notre serveur, pour en trouver le contour : le serveur ne la garde pas et ne l'inscrit pas dans ses journaux.",
        "Une figure dessinée avec le doigt, ou le contour de ta photo, va une fois sur notre serveur, comme l'itinéraire que tu demandes : le serveur ne la garde pas.",
        "Pour améliorer la recherche, nous gardons un événement pour chaque recherche et pour quelques utilisations de l'app (un parcours choisi, un fichier GPX exporté, une course notée) : le texte en minuscules, 200 caractères au plus, avec les e-mails et les longs numéros masqués ; les positions seulement sous forme de carrés d'environ 1 km ; rien qui dise qui tu es ni de quel téléphone il s'agissait. Ces événements sont gardés sans limite de temps.",
      ],
    },
    {
      heading: "Ta position",
      blocks: [
        "La position du téléphone est utilisée sur le téléphone, pour commencer un parcours là où tu es et pour suivre ta course. Elle va vers notre serveur exacte comme départ d'un parcours que tu demandes, comme départ des formes que l'app te prépare à proximité quand le téléphone ne peut pas les dessiner lui-même, et dans une course que tu enregistres. Elle y va arrondie à environ 1 km pour trouver la carte hors ligne autour de toi, les parcours recommandés, les villes et les dessins proches, et pour montrer d'abord les lieux près de toi dans une recherche ; ainsi arrondie, elle ne reste pas liée à ton compte.",
        "Sur iPhone, pendant une course que tu as lancée, l'app continue de suivre ta position même téléphone verrouillé ou avec une autre app ouverte, jusqu'à ce que tu arrêtes la course ; l'iPhone l'indique par une marque bleue en haut de l'écran. MuW demande la position seulement pendant que tu utilises l'app, jamais « Toujours ».",
        "Comme tout service internet, notre serveur voit l'adresse internet (IP) d'où vient une requête pendant qu'il y répond. Le journal du serveur n'écrit pas de positions, et la base de données ne contient aucune adresse IP.",
        "Un registre des demandes de parcours, avec leur départ, existe pour reproduire un défaut. Il est éteint sur notre serveur ; allumé, il contient 10 Mo au plus, puis les lignes les plus anciennes sont perdues.",
      ],
    },
    {
      heading: "Publicité",
      blocks: [
        "MuW n'affiche pas d'annonces et n'utilise aucun service publicitaire : rien sur toi ne part vers un réseau publicitaire, et l'app ne demande jamais à te suivre à travers d'autres apps.",
      ],
    },
    {
      heading: "Strava",
      blocks: [
        "Une course ne va vers Strava que quand tu le demandes, et seulement après que tu as connecté ton profil Strava. Tant qu'il est connecté, notre serveur garde ton nom Strava et les clés que Strava nous a données pour ton profil. Nous envoyons alors à Strava la trace avec ses temps, le nom et une ligne de description. Nous demandons à Strava seulement l'autorisation d'ajouter des activités, jamais de lire les tiennes. Sur Strava, l'activité suit tes réglages de confidentialité Strava, pas ceux de MuW.",
      ],
    },
    {
      heading: "Les autres qui reçoivent des données",
      blocks: [
        {
          bullets: [
            "Hetzner héberge notre serveur et ses sauvegardes, en Allemagne.",
            "Geoapify reçoit les recherches de lieux, de villes près de toi et de lieux d'un parcours à thème, avec la position arrondie à environ 1 km, et, pour nommer le lieu d'une course enregistrée, son départ arrondi de la même façon : jamais ta porte, la course ni qui tu es. Si notre serveur ne répond pas, une recherche de lieu va à Photon (komoot) à la place.",
            "OpenFreeMap fournit la carte : comme tout service de cartes, il voit quelle zone tu regardes.",
            "Wikimedia fournit à notre serveur les photos des villes : il voit quelle ville, pas qui demande.",
            "Avec la carte « Satellite », Esri fournit les images, et avec la carte « 3D », Amazon Web Services fournit les altitudes : comme tout service de cartes, ils voient quelle zone tu regardes.",
            "Le service Overpass des données OpenStreetMap est interrogé par notre serveur pour la carte d'une zone qu'il n'a pas encore : il voit quelle zone, pas qui a demandé.",
            "unpkg fournit la bibliothèque de la carte au démarrage de l'app.",
            "Expo fournit les mises à jour de l'app.",
            "Google Ireland Limited (Firebase Cloud Messaging), pour livrer les notifications push aux téléphones Android. Quand tu allumes le push, l'app demande à Firebase un jeton d'enregistrement pour ton téléphone ; le service push d'Expo transmet chaque notification (qui a fait quoi, et le début d'un commentaire) à Google, qui la livre à ton téléphone. Google voit le jeton et le contenu de chaque notification, pas ton compte ni ta position. Le jeton est retiré de notre serveur quand tu éteins le push, te déconnectes ou supprimes ton compte ; celui du téléphone disparaît quand tu désinstalles l'app.",
            "Resend, aux États-Unis, envoie les e-mails de MuW : ton adresse e-mail avec l'e-mail lui-même. Pour un signalement, il apporte à la personne qui gère MuW ce qui a été signalé, son texte, la raison et les noms d'utilisateur de qui l'a signalé et de qui l'a écrit. Pour «Envoie-nous ton avis», il apporte ton message, ton nom d'utilisateur et ton adresse e-mail.",
            "Strava, comme dit plus haut.",
          ],
        },
        "Une image ou une vidéo de ta course faites avec «Partager» sont créées sur le téléphone et ne le quittent que par le menu de partage, vers l'endroit où tu les envoies. La vidéo montre la carte autour de ta course, sans ses 200 premiers et derniers mètres.",
      ],
    },
    {
      heading: "Où sont tes données et pour combien de temps",
      blocks: [
        {
          bullets: [
            "Sur notre serveur en Allemagne, tant que tu as le compte.",
            "Quand tu supprimes ton compte, tout ce qui est à toi est supprimé tout de suite : profil, photo, numéro de téléphone, courses, dessins, favoris, commentaires, réactions, abonnements, données du jeu et les nouvelles qui attendent ton e-mail. Les parcours que notre moteur a dessinés restent : ils ne disent rien de qui les a demandés.",
            "Une sauvegarde de la base de données est faite chaque nuit et gardée 13 jours : un compte supprimé sort de toutes les sauvegardes en 14 jours au plus.",
            "Sur ton téléphone : la session, tes choix (langue, sport, lacs ou mer), les cartes hors ligne, les courses qui attendent encore d'être envoyées et, avec un compte, la zone d'où partent d'habitude tes activités, pour te suggérer des lacs et la mer à proximité ; elle est effacée quand tu te déconnectes.",
          ],
        },
        "La connexion entre l'app et notre serveur est chiffrée (HTTPS).",
      ],
    },
    {
      heading: "Pourquoi nous pouvons utiliser tes données",
      blocks: [
        {
          bullets: [
            "Pour te fournir le service que tu demandes (contrat) : ton compte, ton profil, les parcours que tu demandes, et les courses, favoris, commentaires, réactions et abonnements que tu enregistres, les e-mails des notifications que tu as allumées, et le jeu des formes.",
            "Notre intérêt légitime à faire fonctionner MuW, à la garder sûre et à l'améliorer : les courts journaux du serveur, les comptages qui limitent les téléchargements de cartes et les événements de recherche, qui ne disent rien de qui tu es ; la comparaison des numéros de tes contacts, dont aucun n'est gardé ; l'e-mail en cas d'absence, que tu peux refuser à l'inscription, dans «Réglages» ou dans chaque e-mail ; les e-mails des signalements, pour garder MuW sûre ; l'archive des parcours dessinés, qui ne dit rien de qui tu es ; les messages de «Envoie-nous ton avis», pour les lire et te répondre.",
            "Ton consentement : le numéro de téléphone que tu choisis d'ajouter et la connexion à Strava. Tu peux retirer un consentement à tout moment ; ce qui a été fait avant reste licite.",
            "Une obligation légale, quand une loi nous demande de conserver ou de remettre des données.",
          ],
        },
      ],
    },
    {
      heading: "Tes droits",
      blocks: [
        "Tu peux, à tout moment :",
        {
          bullets: [
            "voir et corriger tes données : nom d'utilisateur, bio et photo dans «Profil», e-mail et numéro de téléphone dans «Réglages» ;",
            "supprimer une course de «Mes activités», un favori, un commentaire, ou le compte entier depuis «Réglages», «Supprimer le compte» ;",
            "nous demander une copie de tes données, ou d'arrêter ou de limiter une utilisation ;",
            "retirer un consentement que tu as donné ;",
            "éteindre n'importe quel e-mail dans «Réglages» ou avec son lien ;",
            "porter plainte auprès de l'autorité de protection des données de ton pays (en Italie, le Garante per la protezione dei dati personali).",
          ],
        },
        "Pour tout ce que tu ne peux pas faire depuis l'app, écris à muw2610@gmail.com.",
      ],
    },
    {
      heading: "Enfants",
      blocks: [
        "Les comptes MuW sont pour les personnes d'au moins 16 ans. Si tu penses qu'une personne plus jeune a un compte, écris-nous et nous le supprimerons.",
      ],
    },
    {
      heading: "Modifications de ce texte",
      blocks: [
        "Quand ce texte change, nous changeons la date en haut ; si une modification est importante, nous la ferons connaître avant qu'elle s'applique.",
      ],
    },
    {
      heading: "Contact",
      blocks: ["Luca Pallaoro · muw2610@gmail.com"],
    },
  ],
};

export const FR: AboutContent = { help, terms, privacy };
