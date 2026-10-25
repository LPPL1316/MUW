import type { AboutContent, AboutDocument } from "../documents";

/**
 * «Help», «Terms» and «Privacy» in English (TASK-184, ADR-0205).
 *
 * Every line says something the app does today (`docs/UI.md`,
 * `docs/DATABASE.md`): change it here when the app changes. «Terms» and
 * «Privacy» are drafts until the user approves them: `[name]`,
 * `[contact email]` and the other texts in square brackets are theirs to
 * fill, and nothing here may be made up to fill them.
 */

const UPDATED = "10 October 2026";
/** «Privacy» is final since the user approved it on this day (TASK-237 D; without ads, TASK-267 B). */
const PRIVACY_UPDATED = "10 October 2026";

const help: AboutDocument = {
  title: "How MuW works",
  draft: false,
  updated: null,
  sections: [
    {
      heading: "What MuW is",
      blocks: [
        "MuW draws real routes that trace a shape on the map. You choose the shape, the distance and where to start; you get a route on real streets, with its GPX file.",
        "The app has four pages side by side, «Feed», «Draw», «Explore» and your profile: swipe left or right, or tap a name at the top. The circle at the top takes you to your profile.",
      ],
    },
    {
      heading: "Draw a route",
      blocks: [
        {
          bullets: [
            "Pick a shape: a heart, a star, a cat and more, a word from A to Z, or the outline of your own photo.",
            "Set the distance: up to 21 km on foot, starting from where you are or from any place you search.",
            "Tap «Draw route». MuW draws up to three routes on real streets, A, B and C: keep the one you like.",
            "«Export GPX» gives you the file for your watch or for another app.",
          ],
        },
        "A route usually takes a few seconds; the longest ones can take up to a minute.",
      ],
    },
    {
      heading: "Explore",
      blocks: [
        "Routes already drawn in your city, ready to start: no waiting, just pick one.",
        "Choose «Near me», a town nearby or search for a city, then tap a route to see it on the map.",
      ],
    },
    {
      heading: "Run a route",
      blocks: [
        {
          bullets: [
            "«Start» begins the run after a short countdown.",
            "A voice tells you each turn ahead of time. The map shows the part you have run and the part still ahead.",
            "«Pause» stops the clock and «Resume» starts it again.",
            "To end the run, hold the stop button: a short tap does not end it.",
          ],
        },
        "«Run without a route» records your run all the same, with no shape to follow.",
        "A route is a suggestion made from map data: keep your eyes on the road and follow the traffic rules.",
      ],
    },
    {
      heading: "Keep your runs and routes",
      blocks: [
        "With an account, «Save» at the end of a run keeps it in «My activities», in «Profile»; «Discard» throws it away. Without a connection the run waits on the phone and is sent later.",
        "The heart on a route on the map keeps it in «Favorites».",
      ],
    },
    {
      heading: "Publish and share",
      blocks: [
        "A saved run is private: only you see it. Turn on «Public», at the end of the run or on a run in «My activities», and the other members see it as a drawing on your profile, without its first and last 200 m.",
        "«Share» makes a picture of your run to send wherever you like.",
      ],
    },
    {
      heading: "Feed and friends",
      blocks: [
        "«Feed» shows drawings to take ideas from: tap one to open its route and start it.",
        "The lens at the top of «Feed» finds other members by name. On a profile you can tap «Follow»; your requests, your followers and who you follow are in «Profile».",
        "On a member's public drawing you can react with an emoji, send a super like and write a comment. Negative comments are not accepted.",
      ],
    },
    {
      heading: "Run, Bike, Paddle",
      blocks: [
        "Choose your sport with the button next to your profile, or in «Settings».",
        {
          bullets: [
            "Run: up to 21 km on real streets, with the voice turn by turn.",
            "Bike: from 10 to 30 km, on cycle paths and on streets open to bikes. Turns are called ahead of time and the screen shows your speed.",
            "Paddle: from 1 to 5 km on lakes and sea, close to the shore, for your canoe, kayak or board. You follow the line on the map.",
          ],
        },
        "On the water, read the safety notice before you start: wear a life jacket, check the weather and the wind, follow the local rules. The route stays within 1 km of the shore: that does not make it safe or allowed.",
      ],
    },
    {
      heading: "Settings",
      blocks: [
        {
          bullets: [
            "Profile picture, email and phone number. The phone number is optional and only you see it.",
            "Language: English, Deutsch, Italiano, Español or Français. The voice follows it.",
            "Offline maps: the phone keeps the maps around you and draws routes by itself; «Delete» frees the space.",
            "Units: your phone's own, kilometres or miles. With miles the distances, the pace and the voice follow: a call at every mile, the turns in feet.",
            "Notifications: two switches, email and push, off until you turn them on. With push on, and once your phone allows it, MuW tells you of follow requests, accepted requests, reactions, comments and tags; touching one opens the post or the profile. MuW sends no emails yet: that choice is kept with your account for when it does.",
          ],
        },
      ],
    },
    {
      heading: "Your account",
      blocks: [
        "You sign up with an email, a username and a password. You must be at least 16.",
        "There is no way to reset a forgotten password yet: keep yours safe.",
        "«Log out» and «Delete account» are at the bottom of «Settings». Deleting the account deletes everything that is yours, at once, and cannot be undone.",
      ],
    },
    {
      heading: "Questions",
      blocks: ["Write to [contact email]."],
    },
  ],
};

const terms: AboutDocument = {
  title: "Terms of use",
  draft: true,
  updated: UPDATED,
  sections: [
    {
      heading: "Who provides MuW",
      blocks: [
        "MuW is provided by [name] («we»). You can write to us at [contact email].",
        "These terms are the agreement between you and us for the use of the MuW app. By creating an account or using the app you accept them.",
      ],
    },
    {
      heading: "What MuW is",
      blocks: [
        "MuW draws routes that trace a shape on the map, to run, ride or paddle; it records your activity while you follow them; and it lets members publish their drawings, follow each other, react and comment.",
      ],
    },
    {
      heading: "Who can use it",
      blocks: [
        "You must be at least 16 years old to create an account. Drawing a route does not need an account.",
      ],
    },
    {
      heading: "Your account",
      blocks: [
        {
          bullets: [
            "You sign up with an email address, a username and a password. The account is yours alone: do not use another person's account and do not pass yourself off as someone else.",
            "Keep your password secret. You are responsible for what is done with your account. There is no way to reset a forgotten password yet.",
            "If you add a phone number, add only a number that is yours.",
            "You can log out or delete your account at any time from «Settings».",
          ],
        },
      ],
    },
    {
      heading: "How to use MuW",
      blocks: [
        "Use the app within the law and with respect for the other members. In particular, do not:",
        {
          bullets: [
            "publish offensive, hateful, threatening or harassing content, in your username, bio, picture, titles or comments;",
            "publish content that is not yours to publish, or other people's personal data without their permission;",
            "try to break, overload or get around the service, or collect data about its members by automated means.",
          ],
        },
      ],
    },
    {
      heading: "What you publish",
      blocks: [
        "Your runs, your drawings, their titles, your profile and your comments stay yours.",
        "By publishing them you allow us to keep them and to show them in the app to the other members, only to run the service: a free, non-exclusive permission that ends when you delete the content or your account.",
        "The app does not accept comments with offensive words: an automatic word filter refuses them. We may remove content that goes against these terms. To tell us about content that should not be there, write to [contact email].",
      ],
    },
    {
      heading: "Safety",
      blocks: [
        "A route is a suggestion computed from map data. Nobody has walked it for you, and the map may be incomplete or out of date: a road may be closed, private, without a pavement or dangerous.",
        {
          bullets: [
            "You are responsible for where you go. Follow the traffic rules and the signs, even when the route or the voice says otherwise.",
            "Check the conditions before and during your activity: traffic, light, weather, the ground, your own health and fitness.",
            "Do not look at the phone while you move in traffic.",
            "On the water take extra care: wear a life jacket, check the weather and the wind, follow the local rules (swimming areas, boat lanes, harbours). MuW does not know them. A route close to the shore is not, for that, safe or allowed.",
          ],
        },
        "Distances, times and speed come from the phone's GPS and are estimates.",
      ],
    },
    {
      heading: "No warranty, and the limits of our liability",
      blocks: [
        "We work to keep MuW running and its routes good, but the app is provided as it is: we do not promise that it is always available or free of errors, that a route can be completed, or that its measures are exact.",
        "As far as the law allows, we are not liable for damage that comes from the use of the app or of its routes. Nothing in these terms limits a liability that the law does not allow to limit, or the rights you have as a consumer.",
      ],
    },
    {
      heading: "Advertising",
      blocks: ["MuW shows no advertising."],
    },
    {
      heading: "Services of others",
      blocks: [
        {
          bullets: [
            "The maps come from OpenFreeMap and from the data of OpenStreetMap (© OpenStreetMap contributors).",
            "Places are searched with Geoapify.",
            "If you connect Strava, the runs you send there follow Strava's own terms and privacy settings.",
            "A picture you share leaves through the phone's share sheet: the app that receives it has its own terms.",
          ],
        },
      ],
    },
    {
      heading: "Changes",
      blocks: [
        "We may change the app, and add or remove what it does. When we change these terms we change the date at the top; if a change is important we will make it known before it applies.",
      ],
    },
    {
      heading: "Closing the account",
      blocks: [
        "You can stop using MuW and delete your account at any time: «Privacy» says what is deleted and when. We may suspend or close an account that goes against these terms.",
      ],
    },
    {
      heading: "Governing law",
      blocks: [
        "These terms are governed by [governing law]. If you are a consumer, you keep the protections that the law of the country where you live does not allow to set aside.",
      ],
    },
    {
      heading: "Contact",
      blocks: ["[name] · [contact email]"],
    },
  ],
};

const privacy: AboutDocument = {
  title: "Privacy policy",
  draft: false,
  updated: PRIVACY_UPDATED,
  sections: [
    {
      heading: "Who is responsible for your data",
      blocks: [
        "The controller of your personal data is Luca Pallaoro. For anything about your data, write to muw2610@gmail.com.",
        "This text says which data MuW handles, why, where it is kept and for how long, and what you can do about it.",
      ],
    },
    {
      heading: "Without an account",
      blocks: [
        "You can draw routes, explore and run without an account. The run itself does not leave the phone then. What still leaves the phone is under «Routes you ask for», «Your position» and «Others who receive data».",
      ],
    },
    {
      heading: "Your account",
      blocks: [
        {
          bullets: [
            "Your email address and your username, to let you in and to tell the accounts apart.",
            "Your password, kept only as a hash (Argon2id): we never keep or see the password itself.",
            "The day you signed up and when you confirmed that you are at least 16.",
            "The session of each phone you logged in from: the phone keeps a token in its secure storage, the server keeps only a hash of it. A session ends 90 days after its last use, or when you log out.",
            "Your two notification choices in «Settings», email and push: both are off until you turn them on. With push on, your phone's push token, whether it is an iPhone or Android and the app's language, to send you notifications through Expo's push service, which hands them to Apple or Google. A notification says who did what, with the beginning of a comment. The token goes when you turn push off, log out or delete your account. MuW sends no emails yet.",
          ],
        },
        "Your email address is never shown to the other members.",
      ],
    },
    {
      heading: "Your phone number (optional)",
      blocks: [
        "You can add a phone number in «Settings». It is optional: the app works the same without it.",
        "It is private: only you see it. It is never on your profile, in the search or in any list. It is there so that friends who have your number in their phone's contacts can find your account (see «Friends from your contacts»).",
        "We do not check the number and we send no messages to it. You can remove it at any time from «Settings»; it is deleted with the account.",
      ],
    },
    {
      heading: "Friends from your contacts",
      blocks: [
        "Under the lens at the top of «Feed», «Find friends in your contacts» looks for the members whose number is in your phone's contacts. The app asks the phone for the contacts only when you tap it, and reads only their phone numbers: never names, emails or pictures.",
        "Each number leaves the phone coded: written with its country code and turned into a hash (SHA-256). Our server compares the codes with those of the numbers members added, answers with the members it found, and keeps nothing it received: not in the database, not in a log.",
        "A hash of a phone number is not a secret: whoever had the codes could find the numbers again by trying every possible number. That is why the real protection is that our server keeps none of them; they travel only over the encrypted connection.",
        "Your contacts' numbers are other people's data: they are compared once, to find accounts, and forgotten. To stop anyone from trying numbers one by one, the server counts the searches of each account in an hour, in memory only. Only members who added their number can be found, and never someone you blocked or who blocked you.",
      ],
    },
    {
      heading: "Your profile",
      blocks: [
        "Your username, your bio and your profile picture are what the other members see of you. The picture is kept as a small square image, without the data the camera adds to it. Anyone with an account can search the members by username.",
      ],
    },
    {
      heading: "Your runs and their GPS tracks",
      blocks: [
        "With an account, when you tap «Save» at the end of a run the whole run goes to our server: every position with its time, the pauses, the route you followed, distance, duration, a score of how closely the track follows the route (worked out by our server and not shown in the app) and the name of the place. With «Discard», nothing is sent.",
        "A saved run is private: only your account sees it. It stays until you delete it from «My activities» or delete your account.",
        "A run often starts and ends at your door. This is why a run becomes visible to the other members only when you turn on «Public», and then they see the track without its first and last 200 m, with the title you gave it, and without times, pauses or the planned route.",
      ],
    },
    {
      heading: "Favorites, comments, reactions and follows",
      blocks: [
        {
          bullets: [
            "A route you keep in «Favorites» is stored whole, with its line, which often starts near your home. Only your account sees it, until you remove it or delete the account.",
            "Your comments and reactions under a drawing are seen by the members who see that drawing. You can delete your own comments.",
            "Who you follow, who follows you and the requests to follow are kept with your account.",
          ],
        },
      ],
    },
    {
      heading: "Routes you ask for",
      blocks: [
        "To draw a route the app sends our server the start, the shape or the word and the distance. When the phone has the offline map of the area it draws the route by itself.",
        "The offline maps come from our server: the one around you and, ahead of time, those of towns nearby. To cap these downloads the server counts them, per day, by an anonymous number the app makes for the phone; the count is kept in memory only.",
        "Words that describe a shape are read on our server and are not sent to an outside AI service.",
        "A photo you choose for a drawing goes to our server once, to find its outline: the server does not save it and does not log it.",
        "To make the search better we keep an event for each search and for a few uses of the app (a route chosen, a GPX file exported, a run scored): the text in lower case, at most 200 characters, with emails and long numbers hidden; positions only as squares of about 1 km; nothing that says who you are or which phone it was. These events are kept without a time limit.",
      ],
    },
    {
      heading: "Your position",
      blocks: [
        "The phone's position is used on the phone, to start a route where you are and to follow your run. It goes to our server as the start of a route you ask for, inside a run you save, and with a search for a place, to put the places near you first.",
        "On iPhone, during a run you started, the app keeps following your position also with the phone locked or another app open, until you stop the run; the iPhone shows it with a blue mark at the top of the screen. MuW asks for the position only while you use the app, never «Always».",
        "Like any internet service, our server sees the internet (IP) address a request comes from while it answers it. The server's log does not write positions, and the database holds no IP addresses.",
        "A register of the route requests, with their start, exists to reproduce a defect. It is off on our server; switched on, it holds at most 10 MB, then the oldest lines are lost.",
      ],
    },
    {
      heading: "Advertising",
      blocks: [
        "MuW shows no adverts and uses no advertising service: nothing about you goes to an advertising network, and the app never asks to track you across other apps.",
      ],
    },
    {
      heading: "Strava",
      blocks: [
        "A run goes to Strava only when you ask for it, and only after you connected your Strava profile. While it is connected, our server keeps your Strava name and the keys Strava gave us for your profile. We then send Strava the track with its times, the name and one line of description. We ask Strava only for the permission to add activities, never to read yours. On Strava the activity follows your Strava privacy settings, not MuW's.",
      ],
    },
    {
      heading: "Others who receive data",
      blocks: [
        {
          bullets: [
            "Hetzner hosts our server and its backups, in Germany.",
            "Geoapify receives the searches for places and for the towns near you, with the position, and, to name the place of a saved run, its start rounded to about 1 km: never your door, the run or who you are. If our server does not answer, a place search goes to Photon (komoot) instead.",
            "OpenFreeMap serves the map: like any map service, it sees which area you look at.",
            "The Overpass service of OpenStreetMap data is asked by our server for the map of an area it does not have yet: it sees which area, not who asked.",
            "unpkg serves the map library when the app starts.",
            "Expo serves the app's updates.",
            "Strava, as said above.",
          ],
        },
        "A picture of your run made with «Share» is made on the phone and leaves it only through the share sheet, where you send it.",
      ],
    },
    {
      heading: "Where your data is and for how long",
      blocks: [
        {
          bullets: [
            "On our server in Germany, for as long as you have the account.",
            "When you delete your account, everything that is yours is deleted at once: profile, picture, phone number, runs, drawings, favorites, comments, reactions and follows.",
            "A backup of the database is made every night and kept for 13 days: a deleted account is out of every backup within 14 days.",
            "On your phone: the session, your choices (language, sport, lakes or sea), the offline maps, the runs still waiting to be sent and, with an account, the area your activities usually start from, to suggest lakes and the sea near it; it is deleted when you log out.",
          ],
        },
        "The connection between the app and our server is encrypted (HTTPS).",
      ],
    },
    {
      heading: "Why we may use your data",
      blocks: [
        {
          bullets: [
            "To give you the service you ask for (contract): your account, your profile, the routes you ask for, the runs, favorites, comments, reactions and follows you save.",
            "Our legitimate interest in keeping MuW working, safe and better: the server's short logs, the counts that cap the map downloads, and the search events, which say nothing about who you are; the comparison of your contacts' numbers, which keeps none of them.",
            "Your consent: the phone number you choose to add and the connection to Strava. You can take a consent back at any time; what was done before stays lawful.",
            "A legal obligation, when a law asks us to keep or hand over data.",
          ],
        },
      ],
    },
    {
      heading: "Your rights",
      blocks: [
        "You can, at any time:",
        {
          bullets: [
            "see and correct your data: username, bio and picture in «Profile», email and phone number in «Settings»;",
            "delete a run from «My activities», a favorite, a comment, or the whole account from «Settings», «Delete account»;",
            "ask us for a copy of your data, or to stop or limit a use of it;",
            "take back a consent you gave;",
            "complain to the data protection authority of your country (in Italy, the Garante per la protezione dei dati personali).",
          ],
        },
        "For anything you cannot do from the app, write to muw2610@gmail.com.",
      ],
    },
    {
      heading: "Children",
      blocks: [
        "MuW accounts are for people who are at least 16. If you believe someone younger has an account, write to us and we will delete it.",
      ],
    },
    {
      heading: "Changes to this text",
      blocks: [
        "When this text changes we change the date at the top; if a change is important we will make it known before it applies.",
      ],
    },
    {
      heading: "Contact",
      blocks: ["Luca Pallaoro · muw2610@gmail.com"],
    },
  ],
};

export const EN: AboutContent = { help, terms, privacy };
