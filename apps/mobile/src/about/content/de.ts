import type { AboutContent, AboutDocument } from "../documents";

/**
 * «Help», «Terms» and «Privacy» in German (TASK-210 F): the same sections
 * as `en.ts`, in the same order (a test compares them). The names of
 * buttons are the ones the app shows in German; the pages as
 * TASK-210 G names them: «Feed», «Zeichnen», «Entdecken». «Terms» and «Privacy» are
 * drafts, as in English, with the same places to fill (the user's choice
 * of 2026-10-07).
 */

const UPDATED = "10. Oktober 2026";
/** «Privacy» is final since the user approved it (TASK-237 D; without ads, TASK-267 B); dated the day the contacts entered (TASK-262 C). */
const PRIVACY_UPDATED = "30. Oktober 2026";

const help: AboutDocument = {
  title: "So funktioniert MuW",
  draft: false,
  updated: null,
  sections: [
    {
      heading: "Was MuW ist",
      blocks: [
        "MuW zeichnet echte Routen, die auf der Karte eine Form ergeben. Du wählst die Form, die Distanz und den Start; du bekommst eine Route auf echten Straßen, mit ihrer GPX-Datei.",
        "Die App hat vier Seiten nebeneinander, «Feed», «Zeichnen», «Entdecken» und dein Profil: Wische nach links oder rechts oder tippe oben auf einen Namen. Der Kreis oben bringt dich zu deinem Profil.",
      ],
    },
    {
      heading: "Eine Route zeichnen",
      blocks: [
        {
          bullets: [
            "Wähle eine Form: ein Herz, einen Stern, eine Katze und mehr, ein Wort von A bis Z oder den Umriss deines eigenen Fotos.",
            "Stelle die Distanz ein: bis zu 21 km zu Fuß, ab deinem Standort oder ab einem Ort, den du suchst.",
            "Tippe auf «Route zeichnen». MuW zeichnet bis zu drei Routen auf echten Straßen, A, B und C: Behalte die, die dir gefällt.",
            "«GPX exportieren» gibt dir die Datei für deine Uhr oder für eine andere App.",
          ],
        },
        "Eine Route dauert meist ein paar Sekunden; die längsten können bis zu einer Minute brauchen.",
      ],
    },
    {
      heading: "Entdecken",
      blocks: [
        "Routen, die in deiner Stadt schon gezeichnet sind, startklar: kein Warten, wähle einfach eine.",
        "Wähle «In meiner Nähe», einen Ort in der Nähe oder suche eine Stadt, dann tippe auf eine Route, um sie auf der Karte zu sehen.",
      ],
    },
    {
      heading: "Eine Route laufen",
      blocks: [
        {
          bullets: [
            "«Start» beginnt den Lauf nach einem kurzen Countdown.",
            "Eine Stimme sagt dir jede Abbiegung rechtzeitig an. Die Karte zeigt den Teil, den du schon gelaufen bist, und den, der noch vor dir liegt.",
            "«Pause» hält die Uhr an und «Weiter» lässt sie weiterlaufen.",
            "Um den Lauf zu beenden, halte die Stopptaste gedrückt: Kurzes Tippen beendet ihn nicht.",
          ],
        },
        "«Ohne Route laufen» zeichnet deinen Lauf trotzdem auf, ohne Form, der du folgst.",
        "Eine Route ist ein Vorschlag aus Kartendaten: Behalte die Straße im Blick und halte dich an die Verkehrsregeln.",
      ],
    },
    {
      heading: "Läufe und Routen behalten",
      blocks: [
        "Mit einem Konto legst du einen Lauf am Ende mit «Speichern» in «Meine Aktivitäten» ab, unter «Profil»; «Verwerfen» wirft ihn weg. Ohne Verbindung wartet der Lauf auf dem Handy und wird später gesendet.",
        "Das Herz auf einer Route auf der Karte legt sie in «Favoriten» ab.",
      ],
    },
    {
      heading: "Veröffentlichen und teilen",
      blocks: [
        "Ein gespeicherter Lauf ist privat: Nur du siehst ihn. Andere Mitglieder sehen auf deinem Profil nur die Summen aller deiner gespeicherten Läufe, Distanz und Anstieg, nie die Läufe selbst. Wähle unter «Wer kann es sehen» «Alle» oder «Follower», am Ende des Laufs oder bei einem Lauf in «Meine Aktivitäten», und sie sehen ihn als Zeichnung auf deinem Profil, ohne seine ersten und letzten 200 m. Der nächste Lauf, den du beendest, beginnt mit deiner zuletzt gespeicherten Wahl: Du siehst sie vor «Speichern» und kannst sie ändern. Eine aus einer Datei hinzugefügte Aktivität beginnt immer mit «Nur ich».",
        "«Teilen» macht ein Bild deines Laufs, das du verschicken kannst, wohin du willst.",
      ],
    },
    {
      heading: "Feed und Freunde",
      blocks: [
        "«Feed» zeigt Zeichnungen, die dich auf Ideen bringen: Tippe auf eine, um ihre Route zu öffnen und loszulaufen.",
        "Die Lupe oben in «Feed» findet andere Mitglieder über ihren Namen. Auf einem Profil kannst du auf «Folgen» tippen; deine Anfragen, deine Follower und wem du folgst, findest du in «Profil».",
        "Auf der öffentlichen Zeichnung eines Mitglieds kannst du mit einem Emoji reagieren, ein Super Like senden und einen Kommentar schreiben. Negative Kommentare werden nicht angenommen.",
      ],
    },
    {
      heading: "Nachrichten",
      blocks: [
        "«Nachricht» auf dem Profil eines Mitglieds schreibt ihm. Folgt es dir, landet deine Nachricht in seinen «Nachrichten»; sonst kommt sie als Anfrage an, und du kannst eine Nachricht schicken, bis die Anfrage angenommen ist.",
        "Deine Unterhaltungen sind in «Profil», «Nachrichten», mit «Nachrichtenanfragen» oben. Nimm eine Anfrage an, um euch zu schreiben, lösche sie (wer geschrieben hat, erfährt es nicht) oder blockiere, wer geschrieben hat.",
        "Halte eine Nachricht gedrückt, um deine für euch beide zu löschen oder eine erhaltene zu melden. Niemand sieht, ob du eine Nachricht gelesen hast. Mit Push meldet dir MuW jede Nachricht und jede Anfrage.",
        "Tippe in einer Unterhaltung auf +, um ein Foto, ein Video bis 60 Sekunden oder eine Zeichnung zu senden, oder tippe bei einer Route oder einer Zeichnung auf An Freunde senden. Du kannst sie senden, sobald die andere Person deine Nachricht angenommen hat. Videos bleiben 30 Tage, oder kürzer, wenn unser Platz für Videos voll ist: Die ältesten gehen zuerst. Tippe auf eine Zeichnung, um sie auf der Karte zu öffnen, zu starten, als GPX zu exportieren oder in deinen Favoriten zu behalten.",
      ],
    },
    {
      heading: "Laufen, Rad, Paddeln",
      blocks: [
        "Wähle deinen Sport mit der Taste neben deinem Profil oder in «Einstellungen».",
        {
          bullets: [
            "Laufen: bis zu 21 km auf echten Straßen, mit der Stimme Abbiegung für Abbiegung.",
            "Rad: 10 bis 30 km, auf Radwegen und auf Straßen, die für Räder offen sind. Abbiegungen werden rechtzeitig angesagt und der Bildschirm zeigt deine Geschwindigkeit.",
            "Paddeln: 1 bis 5 km auf Seen und auf dem Meer, nah am Ufer, für dein Kanu, Kajak oder Board. Du folgst der Linie auf der Karte.",
          ],
        },
        "Lies auf dem Wasser vor dem Start den Sicherheitshinweis: Trag eine Schwimmweste, prüfe Wetter und Wind, halte dich an die Regeln vor Ort. Die Route bleibt höchstens 1 km vom Ufer entfernt: Das macht sie weder sicher noch erlaubt.",
      ],
    },
    {
      heading: "Einstellungen",
      blocks: [
        {
          bullets: [
            "Profilbild, E-Mail und Telefonnummer. Die Telefonnummer ist freiwillig und nur du siehst sie.",
            "Sprache: English, Deutsch, Italiano, Español oder Français. Die Stimme folgt ihr.",
            "Offline-Karten: Das Handy behält die Karten um dich herum und zeichnet Routen selbst; «Löschen» gibt den Speicher frei.",
            "Einheiten: die deines Handys, Kilometer oder Meilen. Mit Meilen folgen die Distanzen, das Tempo und die Stimme: eine Ansage bei jeder Meile, die Abbiegungen in Fuß.",
            "Benachrichtigungen: drei Schalter. «E-Mail-Benachrichtigungen» und «Push-Benachrichtigungen» sind aus, bis du sie einschaltest; «E-Mail, wenn ich weg bin» ist an, bis du ihn ausschaltest. Mit Push an, und sobald dein Telefon es erlaubt, meldet dir MuW sofort Folgeanfragen, angenommene Anfragen, Reaktionen, Kommentare und Markierungen; ein Tippen darauf öffnet den Beitrag oder das Profil. Mit E-Mail an kommen dieselben Neuigkeiten in höchstens einer E-Mail am Tag. «E-Mail, wenn ich weg bin»: Wenn du MuW 2 Wochen lang nicht öffnest, eine E-Mail mit den Neuigkeiten.",
          ],
        },
      ],
    },
    {
      heading: "Dein Konto",
      blocks: [
        "Du registrierst dich mit einer E-Mail, einem Benutzernamen und einem Passwort. Du musst mindestens 16 Jahre alt sein.",
        "Ein vergessenes Passwort lässt sich noch nicht zurücksetzen: Bewahre deins gut auf.",
        "«Abmelden» und «Konto löschen» stehen unten in «Einstellungen». Das Konto zu löschen löscht sofort alles, was dir gehört, und lässt sich nicht rückgängig machen.",
      ],
    },
    {
      heading: "Fragen",
      blocks: ["Schreib an [contact email]."],
    },
  ],
};

const terms: AboutDocument = {
  title: "Nutzungsbedingungen",
  draft: true,
  updated: UPDATED,
  sections: [
    {
      heading: "Wer MuW anbietet",
      blocks: [
        "MuW wird von [name] angeboten («wir»). Du kannst uns an [contact email] schreiben.",
        "Diese Bedingungen sind die Vereinbarung zwischen dir und uns über die Nutzung der App MuW. Wenn du ein Konto erstellst oder die App nutzt, akzeptierst du sie.",
      ],
    },
    {
      heading: "Was MuW ist",
      blocks: [
        "MuW zeichnet Routen, die auf der Karte eine Form ergeben, zum Laufen, Radfahren oder Paddeln; es zeichnet deine Aktivität auf, während du ihnen folgst; und es lässt Mitglieder ihre Zeichnungen veröffentlichen, einander folgen, reagieren und kommentieren.",
      ],
    },
    {
      heading: "Wer es nutzen darf",
      blocks: [
        "Du musst mindestens 16 Jahre alt sein, um ein Konto zu erstellen. Um eine Route zu zeichnen, brauchst du kein Konto.",
      ],
    },
    {
      heading: "Dein Konto",
      blocks: [
        {
          bullets: [
            "Du registrierst dich mit einer E-Mail-Adresse, einem Benutzernamen und einem Passwort. Das Konto gehört nur dir: Nutze nicht das Konto einer anderen Person und gib dich nicht als jemand anderes aus.",
            "Halte dein Passwort geheim. Du bist für das verantwortlich, was mit deinem Konto getan wird. Ein vergessenes Passwort lässt sich noch nicht zurücksetzen.",
            "Wenn du eine Telefonnummer hinzufügst, nimm nur eine Nummer, die dir gehört.",
            "Du kannst dich jederzeit in «Einstellungen» abmelden oder dein Konto löschen.",
          ],
        },
      ],
    },
    {
      heading: "Wie du MuW nutzt",
      blocks: [
        "Nutze die App im Rahmen des Gesetzes und mit Respekt vor den anderen Mitgliedern. Insbesondere darfst du nicht:",
        {
          bullets: [
            "beleidigende, hasserfüllte, bedrohende oder belästigende Inhalte veröffentlichen, weder im Benutzernamen noch in Bio, Bild, Titeln oder Kommentaren;",
            "Inhalte veröffentlichen, die du nicht veröffentlichen darfst, oder personenbezogene Daten anderer ohne deren Erlaubnis;",
            "versuchen, den Dienst zu stören, zu überlasten oder zu umgehen, oder mit automatischen Mitteln Daten über seine Mitglieder sammeln.",
          ],
        },
      ],
    },
    {
      heading: "Was du veröffentlichst",
      blocks: [
        "Deine Läufe, deine Zeichnungen, ihre Titel, dein Profil und deine Kommentare bleiben deine.",
        "Mit der Veröffentlichung erlaubst du uns, sie aufzubewahren und sie in der App den anderen Mitgliedern zu zeigen, nur um den Dienst zu betreiben: eine kostenlose, nicht ausschließliche Erlaubnis, die endet, wenn du den Inhalt oder dein Konto löschst.",
        "Die App nimmt keine Kommentare mit beleidigenden Wörtern an: Ein automatischer Wortfilter lehnt sie ab. Wir können Inhalte entfernen, die gegen diese Bedingungen verstoßen. Um uns auf Inhalte hinzuweisen, die nicht da sein sollten, schreib an [contact email].",
      ],
    },
    {
      heading: "Sicherheit",
      blocks: [
        "Eine Route ist ein Vorschlag, der aus Kartendaten berechnet wird. Niemand ist sie für dich abgegangen, und die Karte kann unvollständig oder veraltet sein: Eine Straße kann gesperrt, privat, ohne Gehweg oder gefährlich sein.",
        {
          bullets: [
            "Du bist dafür verantwortlich, wohin du gehst. Halte dich an die Verkehrsregeln und die Schilder, auch wenn die Route oder die Stimme etwas anderes sagt.",
            "Prüfe die Bedingungen vor und während deiner Aktivität: Verkehr, Licht, Wetter, den Untergrund, deine eigene Gesundheit und Fitness.",
            "Schau nicht auf das Handy, während du dich im Verkehr bewegst.",
            "Sei auf dem Wasser besonders vorsichtig: Trag eine Schwimmweste, prüfe Wetter und Wind, halte dich an die Regeln vor Ort (Badezonen, Fahrrinnen, Häfen). MuW kennt sie nicht. Eine Route nah am Ufer ist deshalb noch nicht sicher oder erlaubt.",
          ],
        },
        "Distanzen, Zeiten und Geschwindigkeit stammen vom GPS des Handys und sind Schätzungen.",
      ],
    },
    {
      heading: "Keine Gewähr und die Grenzen unserer Haftung",
      blocks: [
        "Wir arbeiten daran, dass MuW läuft und seine Routen gut sind, aber die App wird so bereitgestellt, wie sie ist: Wir versprechen nicht, dass sie immer verfügbar oder fehlerfrei ist, dass sich eine Route zu Ende laufen lässt oder dass ihre Messungen genau sind.",
        "Soweit das Gesetz es erlaubt, haften wir nicht für Schäden, die aus der Nutzung der App oder ihrer Routen entstehen. Nichts in diesen Bedingungen beschränkt eine Haftung, die das Gesetz nicht zu beschränken erlaubt, oder die Rechte, die du als Verbraucher hast.",
      ],
    },
    {
      heading: "Werbung",
      blocks: ["MuW zeigt keine Werbung."],
    },
    {
      heading: "Dienste anderer",
      blocks: [
        {
          bullets: [
            "Die Karten stammen von OpenFreeMap und aus den Daten von OpenStreetMap (© OpenStreetMap-Mitwirkende).",
            "Orte werden mit Geoapify gesucht.",
            "Wenn du Strava verbindest, gelten für die Läufe, die du dorthin sendest, die Bedingungen und Datenschutzeinstellungen von Strava.",
            "Ein Bild, das du teilst, verlässt das Handy über das Teilen-Menü: Die App, die es empfängt, hat ihre eigenen Bedingungen.",
          ],
        },
      ],
    },
    {
      heading: "Änderungen",
      blocks: [
        "Wir können die App ändern und Funktionen hinzufügen oder entfernen. Wenn wir diese Bedingungen ändern, ändern wir das Datum oben; ist eine Änderung wichtig, geben wir sie bekannt, bevor sie gilt.",
      ],
    },
    {
      heading: "Das Konto schließen",
      blocks: [
        "Du kannst jederzeit aufhören, MuW zu nutzen, und dein Konto löschen: «Datenschutz» sagt, was wann gelöscht wird. Wir können ein Konto sperren oder schließen, das gegen diese Bedingungen verstößt.",
      ],
    },
    {
      heading: "Anwendbares Recht",
      blocks: [
        "Für diese Bedingungen gilt [governing law]. Wenn du Verbraucher bist, behältst du den Schutz, den das Recht des Landes, in dem du lebst, nicht auszuschließen erlaubt.",
      ],
    },
    {
      heading: "Kontakt",
      blocks: ["[name] · [contact email]"],
    },
  ],
};

const privacy: AboutDocument = {
  title: "Datenschutzerklärung",
  draft: false,
  updated: PRIVACY_UPDATED,
  sections: [
    {
      heading: "Wer für deine Daten verantwortlich ist",
      blocks: [
        "Verantwortlich für deine personenbezogenen Daten ist Luca Pallaoro. Für alles, was deine Daten betrifft, schreib an muw2610@gmail.com.",
        "Dieser Text sagt, welche Daten MuW verarbeitet, wozu, wo sie gespeichert werden und wie lange, und was du tun kannst.",
      ],
    },
    {
      heading: "Ohne Konto",
      blocks: [
        "Du kannst ohne Konto Routen zeichnen, entdecken und laufen. Der Lauf selbst verlässt das Handy dann nicht. Was das Handy trotzdem verlässt, steht unter «Routen, die du anforderst», «Dein Standort» und «Andere, die Daten erhalten».",
      ],
    },
    {
      heading: "Dein Konto",
      blocks: [
        {
          bullets: [
            "Deine E-Mail-Adresse und dein Benutzername, um dich hereinzulassen und die Konten zu unterscheiden.",
            "Dein Passwort, nur als Hash gespeichert (Argon2id): Das Passwort selbst speichern oder sehen wir nie.",
            "Der Tag deiner Registrierung und wann du bestätigt hast, dass du mindestens 16 bist.",
            "Die Sitzung jedes Handys, mit dem du dich angemeldet hast: Das Handy bewahrt ein Token in seinem sicheren Speicher auf, der Server nur einen Hash davon. Eine Sitzung endet 90 Tage nach ihrer letzten Nutzung oder wenn du dich abmeldest.",
            "Deine drei Einstellungen zu Benachrichtigungen in «Einstellungen»: «E-Mail-Benachrichtigungen» und «Push-Benachrichtigungen», aus, bis du sie einschaltest, und «E-Mail, wenn ich weg bin», an, bis du ihn ausschaltest. Mit Push an: der Push-Token deines Telefons, ob es ein iPhone oder ein Android ist, und die Sprache der App, um dir Benachrichtigungen über den Push-Dienst von Expo zu senden, der sie an Apple oder Google weitergibt. Eine Benachrichtigung sagt, wer was getan hat, mit dem Anfang eines Kommentars. Der Token wird gelöscht, wenn du Push ausschaltest, dich abmeldest oder dein Konto löschst.",
            "Die Sprache der App bei deiner Anmeldung, um dir unsere E-Mails in dieser Sprache zu schreiben.",
          ],
        },
        "Deine E-Mail-Adresse wird den anderen Mitgliedern nie gezeigt.",
      ],
    },
    {
      heading: "E-Mails von MuW",
      blocks: [
        {
          bullets: [
            "Mit «E-Mail-Benachrichtigungen» an höchstens eine E-Mail am Tag, nur an Tagen mit Neuigkeiten: die Folgeanfragen, angenommenen Anfragen, Reaktionen, Kommentare und Markierungen des Tages, so wie die Push-Benachrichtigungen sie sagen. Bis sie verschickt ist, behält unser Server, wer was bei welchem Beitrag getan hat, höchstens 7 Tage lang; was beim Schreiben nicht mehr stimmt, bleibt draußen.",
            "«E-Mail, wenn ich weg bin»: Wenn du MuW 2 Wochen lang nicht öffnest, eine E-Mail damit, wie viele neue Zeichnungen es von den Leuten gibt, denen du folgst, mit bis zu drei ihrer Benutzernamen, oder sonst im Feed. Eine pro Abwesenheit: die nächste erst, wenn du zurück und wieder weg bist. Sie ist für jedes Mitglied an, auch für alle, die sich vor diesem Text angemeldet haben; du kannst bei der Anmeldung, in «Einstellungen» oder mit dem Link in der E-Mail Nein sagen.",
            "Jede E-Mail hat den Link «Schickt mir diese E-Mails nicht mehr», der diese E-Mail ausschaltet. Wir verschicken sie über Resend, von einer Adresse von getmuw.app.",
            "E-Mails, die dein Konto braucht und die kein Schalter ausschaltet: eine, um deine Adresse zu bestätigen, wenn du dich anmeldest oder sie änderst, ein Hinweis an deine alte Adresse, wenn du sie änderst, und ein Link für ein neues Passwort, wenn du danach fragst.",
          ],
        },
      ],
    },
    {
      heading: "Deine Telefonnummer (freiwillig)",
      blocks: [
        "Du kannst in «Einstellungen» eine Telefonnummer hinzufügen. Sie ist freiwillig: Die App funktioniert ohne sie genauso.",
        "Sie ist privat: Nur du siehst sie. Sie steht nie auf deinem Profil, in der Suche oder in einer Liste. Sie ist dafür da, dass Freunde, die deine Nummer in den Kontakten ihres Handys haben, dein Konto finden können (siehe «Freunde aus deinen Kontakten»).",
        "Wir prüfen die Nummer nicht und senden keine Nachrichten an sie. Du kannst sie jederzeit in «Einstellungen» entfernen; sie wird mit dem Konto gelöscht.",
      ],
    },
    {
      heading: "Freunde aus deinen Kontakten",
      blocks: [
        "Unter der Lupe oben in «Feed» sucht «Freunde in deinen Kontakten finden» die Mitglieder, deren Nummer in den Kontakten deines Handys steht. Die App fragt das Handy erst nach den Kontakten, wenn du darauf tippst, und liest nur die Telefonnummern: nie Namen, E-Mails oder Bilder.",
        "Jede Nummer verlässt das Handy verschlüsselt: mit Ländervorwahl geschrieben und in einen Hash (SHA-256) umgewandelt. Unser Server vergleicht die Codes mit denen der Nummern, die Mitglieder hinzugefügt haben, antwortet mit den gefundenen Mitgliedern und behält nichts von dem, was er erhalten hat: weder in der Datenbank noch in einem Protokoll.",
        "Ein Hash einer Telefonnummer ist kein Geheimnis: Wer die Codes hätte, könnte die Nummern wiederfinden, indem er alle möglichen Nummern ausprobiert. Deshalb ist der eigentliche Schutz, dass unser Server keinen davon behält; sie gehen nur über die verschlüsselte Verbindung.",
        "Die Nummern deiner Kontakte sind Daten anderer Menschen: Sie werden einmal verglichen, um Konten zu finden, und dann vergessen. Damit niemand Nummern einzeln ausprobiert, zählt der Server die Suchen jedes Kontos in einer Stunde, nur im Arbeitsspeicher. Gefunden wird nur, wer seine Nummer hinzugefügt hat, und nie jemand, den du blockiert hast oder der dich blockiert hat.",
      ],
    },
    {
      heading: "Dein Profil",
      blocks: [
        "Dein Benutzername, deine Bio und dein Profilbild sind das, was die anderen Mitglieder von dir sehen. Das Bild wird als kleines quadratisches Bild gespeichert, ohne die Daten, die die Kamera hinzufügt. Jeder mit einem Konto kann Mitglieder nach dem Benutzernamen suchen.",
      ],
    },
    {
      heading: "Deine Läufe und ihre GPS-Spuren",
      blocks: [
        "Mit einem Konto geht der ganze Lauf an unseren Server, wenn du am Ende eines Laufs auf «Speichern» tippst: jede Position mit ihrer Uhrzeit und Höhe, die Pausen, die Route, der du gefolgt bist, Distanz, Dauer, eine Punktzahl dafür, wie genau die Spur der Route folgt (von unserem Server berechnet und in der App nicht angezeigt), und der Name des Ortes. Mit «Verwerfen» wird nichts gesendet.",
        "Ein gespeicherter Lauf ist privat, solange du nichts anderes wählst: Nur dein Konto sieht ihn. Andere Mitglieder sehen auf deinem Profil nur die Summen aller deiner gespeicherten Läufe, Distanz und Anstieg, nie die Läufe selbst. Er bleibt, bis du ihn in «Meine Aktivitäten» löschst oder dein Konto löschst.",
        "Wenn du eine frühere Aktivität aus einer Datei hinzufügst, speichern wir ihre Spur und ihre Uhrzeiten wie bei einem mit MuW aufgezeichneten Lauf. Die Datei selbst speichern wir nicht.",
        "Ein Lauf beginnt und endet oft an deiner Haustür. Deshalb wird ein Lauf für die anderen Mitglieder erst sichtbar, nachdem du unter «Wer kann es sehen» «Alle» oder «Follower» gewählt hast, und dann sehen sie die Spur ohne ihre ersten und letzten 200 m, mit dem Titel, den du ihr gegeben hast, und ohne Zeiten, Pausen oder die geplante Route. Deine Wahl bleibt für den nächsten Lauf auf diesem Telefon: Er beginnt mit der zuletzt gespeicherten, du siehst sie vor «Speichern» und kannst sie ändern. Eine aus einer Datei hinzugefügte Aktivität beginnt immer mit «Nur ich».",
        "Wer einen deiner Läufe sehen kann, kann ihm auch mit «Start» folgen und dieselbe Spur als GPX-Datei speichern: immer ohne ihre ersten und letzten 200 m und ohne Zeiten.",
      ],
    },
    {
      heading: "Favoriten, Kommentare, Reaktionen und Folgen",
      blocks: [
        {
          bullets: [
            "Eine Route, die du in «Favoriten» behältst, wird ganz gespeichert, mit ihrer Linie, die oft nahe bei dir zu Hause beginnt. Nur dein Konto sieht sie, bis du sie entfernst oder das Konto löschst.",
            "Deine Kommentare und Reaktionen unter einer Zeichnung sehen die Mitglieder, die diese Zeichnung sehen. Du kannst deine eigenen Kommentare löschen.",
            "Wem du folgst, wer dir folgt und die Anfragen zum Folgen werden mit deinem Konto gespeichert.",
          ],
        },
      ],
    },
    {
      heading: "Private Nachrichten",
      blocks: [
        "Deine privaten Nachrichten liegen auf unserem Server: wer geschrieben hat, an wen, der Text und wann, und für jeden der beiden, ob er die Unterhaltung angenommen hat, wann er sie zuletzt gelesen hat und bis wann er sie aus seiner Ansicht gelöscht hat. Sie sind nicht Ende-zu-Ende-verschlüsselt. In der App sehen eine Unterhaltung nur ihre beiden Mitglieder, und niemand erfährt, ob eine Nachricht gelesen wurde. Wir speichern sie, um dir den Dienst zu geben, den du verlangst (Vertrag).",
        "Eine Nachricht kann ein Foto, ein Video oder eine Zeichnung enthalten. Ein Foto speichern wir verkleinert, ohne die Daten, die dein Handy hinzufügt, etwa wo und wann es aufgenommen wurde. Ein Video speichern wir so, wie dein Handy es schickt, ohne den Ort, an dem es gedreht wurde, und löschen es 30 Tage nach dem Senden, oder früher, die ältesten zuerst, wenn unser Platz für Videos voll ist. Eine Zeichnung ist eine Kopie der Route: Ein Lauf, den du schickst, ist am Anfang und am Ende gekürzt wie im Feed, eine geplante Route geht ganz, mit ihrem Start. Fotos und Videos sind nicht Ende-zu-Ende-verschlüsselt, liegen nicht in unseren Sicherungskopien und werden mit ihrer Nachricht, der Unterhaltung oder deinem Konto gelöscht. Wenn du eine Nachricht meldest, sieht die Person, die MuW betreibt, auch ihr Foto, ihr Video oder ihre Zeichnung.",
        "Eine Nachricht an jemanden, der dir nicht folgt, kommt als Anfrage an; die erste Nachricht einer Anfrage geht durch denselben Wortfilter wie die Kommentare.",
        "Du kannst deine eigenen Nachrichten für euch beide löschen. Eine Unterhaltung zu löschen nimmt sie aus deiner Ansicht; eine Nachricht, die keiner von euch mehr sieht, wird gelöscht. Eine Blockierung löscht die Unterhaltung; wenn du dein Konto löschst, werden alle deine Unterhaltungen gelöscht, mit den Nachrichten von beiden.",
        "Wenn du eine Nachricht meldest, enthält die E-Mail an die Person, die MuW betreibt, nur diese Nachricht, nie den Rest der Unterhaltung. Mit Push trägt die Benachrichtigung einer Nachricht ihren Anfang, über den Push-Dienst von Expo und Apple oder Google, wie bei Kommentaren.",
      ],
    },
    {
      heading: "Meldungen",
      blocks: [
        "Wenn du eine Zeichnung, einen Kommentar oder ein Profil meldest, behalten wir, wer was gemeldet hat, den Grund und wann. Wer MuW betreibt, bekommt die Meldung per E-Mail und kann das Gemeldete vor den anderen Mitgliedern verbergen. Nichts wird gelöscht, und wer es geschrieben hat, sieht es weiter. Deine Meldung wird dem Verfasser nie gezeigt.",
      ],
    },
    {
      heading: "Gruppenläufe",
      blocks: [
        "Wenn du einen Gruppenlauf erstellst oder sagst, dass du hingehst, sehen die Mitglieder, die ihn sehen können, deinen Namen, dein Foto und dass du hingehst. Wenn du dein Konto löschst, löschen wir deine Gruppenläufe und deine Antworten.",
      ],
    },
    {
      heading: "Feedback",
      blocks: [
        "Wenn du uns über «Feedback senden» in «Einstellungen» schreibst, behalten wir deine Nachricht, die Version der App, das System deines Handys (iOS oder Android) und wann du sie geschickt hast. Wer MuW betreibt, bekommt sie per E-Mail mit deinem Benutzernamen und deiner E-Mail-Adresse, um sie zu lesen und dir, wenn nötig, per E-Mail zu antworten. Sie wird den anderen Mitgliedern nie gezeigt. Wenn du dein Konto löschst, werden deine Nachrichten mit ihm von unserem Server gelöscht.",
      ],
    },
    {
      heading: "Das Formenspiel",
      blocks: [
        "Mit einem Konto berechnet unser Server aus deinen gespeicherten Läufen zu Fuß, wie viele Kilometer für das Spiel zählen, deine Bestzeiten über 1, 5, 10 und 21,1 km und die Formen, die du gesammelt hast. Nur du siehst deine Sammlung und deine Bestzeiten. Wenn du einem Team beitrittst, sehen seine Mitglieder deinen Benutzernamen, dein Bild, die Teile einer Herausforderung, die du übernommen hast, und die Kilometer, die du zu jedem beigetragen hast, nie deine Strecken, die Zeiten deiner Läufe oder wo du gelaufen bist. Ein Team findet man nur mit seinem Code: Es ist nie in einer Suche. Wenn du einen Lauf löschst, fallen seine Kilometer aus der Zählung, und die Formen, die du schon gesammelt hast, bleiben. Wenn du dein Konto löschst, werden deine Spieldaten mit gelöscht; in den Herausforderungen eines Teams bleiben die Teile, die du gelaufen bist, für die anderen, ohne deinen Namen.",
      ],
    },
    {
      heading: "Routen, die du anforderst",
      blocks: [
        "Um eine Route zu zeichnen, sendet die App unserem Server den Start, die Form oder das Wort und die Distanz. Hat das Handy die Offline-Karte der Gegend, zeichnet es die Route selbst.",
        "Die Routen, die unser Motor zeichnet, bleiben auf unserem Server, ohne zu speichern, wer sie angefragt hat, um allen, die dieselbe Zeichnung in der Nähe anfragen, sofort zu antworten und um sie vorzuschlagen; wir zählen, wie viele Läufe und Favoriten jeder folgen. Eine Route beginnt dort, wo sie angefragt wurde, oft nahe bei jemandem zu Hause, sagt aber nie, wer sie angefragt hat oder gelaufen ist.",
        "Die Offline-Karten kommen von unserem Server: die um dich herum und, im Voraus, die der Orte in der Nähe. Um diese Downloads zu begrenzen, zählt der Server sie pro Tag nach einer anonymen Nummer, die die App für das Handy erzeugt; die Zählung bleibt nur im Arbeitsspeicher.",
        "Wörter, die eine Form beschreiben, werden auf unserem Server gelesen und an keinen externen KI-Dienst gesendet.",
        "Ein Foto, das du für eine Zeichnung wählst, geht einmal an unseren Server, um seinen Umriss zu finden: Der Server speichert es nicht und protokolliert es nicht.",
        "Eine mit dem Finger gezeichnete Figur oder der Umriss deines Fotos geht einmal an unseren Server, als die Route, die du anfragst: der Server behält sie nicht.",
        "Um die Suche zu verbessern, bewahren wir ein Ereignis für jede Suche und für einige Nutzungen der App auf (eine gewählte Route, eine exportierte GPX-Datei, ein bewerteter Lauf): den Text in Kleinbuchstaben, höchstens 200 Zeichen, mit verborgenen E-Mails und langen Zahlen; Positionen nur als Quadrate von etwa 1 km; nichts, was sagt, wer du bist oder welches Handy es war. Diese Ereignisse werden ohne zeitliche Begrenzung aufbewahrt.",
      ],
    },
    {
      heading: "Dein Standort",
      blocks: [
        "Der Standort des Handys wird auf dem Handy genutzt, um eine Route dort zu beginnen, wo du bist, und um deinem Lauf zu folgen. Er geht an unseren Server als Start einer Route, die du anforderst, innerhalb eines Laufs, den du speicherst, und mit der Suche nach einem Ort, um die Orte in deiner Nähe zuerst zu zeigen.",
        "Auf dem iPhone folgt die App während eines Laufs, den du gestartet hast, deinem Standort auch bei gesperrtem Handy oder wenn eine andere App offen ist, bis du den Lauf beendest; das iPhone zeigt das mit einer blauen Markierung oben auf dem Bildschirm. MuW fragt nur nach dem Standort, während du die App benutzt, nie «Immer».",
        "Wie jeder Internetdienst sieht unser Server die Internetadresse (IP), von der eine Anfrage kommt, während er sie beantwortet. Das Protokoll des Servers schreibt keine Positionen, und die Datenbank enthält keine IP-Adressen.",
        "Ein Register der Routenanfragen mit ihrem Start gibt es, um einen Fehler nachzustellen. Auf unserem Server ist es ausgeschaltet; eingeschaltet fasst es höchstens 10 MB, dann gehen die ältesten Zeilen verloren.",
      ],
    },
    {
      heading: "Werbung",
      blocks: [
        "MuW zeigt keine Anzeigen und nutzt keinen Werbedienst: Nichts über dich geht an ein Werbenetzwerk, und die App fragt nie, ob sie dich über andere Apps hinweg verfolgen darf.",
      ],
    },
    {
      heading: "Strava",
      blocks: [
        "Ein Lauf geht nur an Strava, wenn du es verlangst, und erst nachdem du dein Strava-Profil verbunden hast. Solange es verbunden ist, bewahrt unser Server deinen Strava-Namen und die Schlüssel auf, die Strava uns für dein Profil gegeben hat. Wir senden Strava dann die Spur mit ihren Zeiten, den Namen und eine Zeile Beschreibung. Wir bitten Strava nur um die Erlaubnis, Aktivitäten hinzuzufügen, nie darum, deine zu lesen. Auf Strava folgt die Aktivität deinen Datenschutzeinstellungen bei Strava, nicht denen von MuW.",
      ],
    },
    {
      heading: "Andere, die Daten erhalten",
      blocks: [
        {
          bullets: [
            "Hetzner betreibt unseren Server und seine Sicherungskopien, in Deutschland.",
            "Geoapify erhält die Suchen nach Orten und nach den Orten in deiner Nähe, mit der Position, und, um den Ort eines gespeicherten Laufs zu benennen, seinen auf etwa 1 km gerundeten Start: nie deine Haustür, den Lauf oder wer du bist. Antwortet unser Server nicht, geht eine Ortssuche stattdessen an Photon (komoot).",
            "OpenFreeMap liefert die Karte: Wie jeder Kartendienst sieht es, welche Gegend du anschaust.",
            "Den Overpass-Dienst für OpenStreetMap-Daten fragt unser Server nach der Karte einer Gegend, die er noch nicht hat: Er sieht, welche Gegend, nicht wer gefragt hat.",
            "unpkg liefert die Kartenbibliothek, wenn die App startet.",
            "Expo liefert die Updates der App.",
            "Google Ireland Limited (Firebase Cloud Messaging), um Push-Benachrichtigungen an Android-Telefone zu liefern. Wenn du Push einschaltest, fragt die App bei Firebase einen Registrierungs-Token für dein Telefon an; der Push-Dienst von Expo gibt jede Benachrichtigung (wer was getan hat, und den Anfang eines Kommentars) an Google weiter, das sie an dein Telefon liefert. Google sieht den Token und den Inhalt jeder Benachrichtigung, nicht dein Konto und nicht deine Position. Der Token wird von unserem Server entfernt, wenn du Push ausschaltest, dich abmeldest oder dein Konto löschst; der auf dem Telefon verschwindet, wenn du die App deinstallierst.",
            "Resend, in den Vereinigten Staaten, verschickt die E-Mails von MuW: deine E-Mail-Adresse mit der E-Mail selbst. Bei einer Meldung bringt es dem Betreiber von MuW, was gemeldet wurde, seinen Text, den Grund und die Benutzernamen dessen, der es gemeldet hat, und dessen, der es geschrieben hat. Bei «Feedback senden» bringt es deine Nachricht, deinen Benutzernamen und deine E-Mail-Adresse.",
            "Strava, wie oben gesagt.",
          ],
        },
        "Ein Bild oder ein Video deines Laufs, das du mit «Teilen» machst, entsteht auf dem Handy und verlässt es nur über das Teilen-Menü, dorthin, wohin du es sendest. Das Video zeigt die Karte rund um deinen Lauf, ohne seine ersten und letzten 200 Meter.",
      ],
    },
    {
      heading: "Wo deine Daten sind und wie lange",
      blocks: [
        {
          bullets: [
            "Auf unserem Server in Deutschland, solange du das Konto hast.",
            "Wenn du dein Konto löschst, wird alles, was dir gehört, sofort gelöscht: Profil, Bild, Telefonnummer, Läufe, Zeichnungen, Favoriten, Kommentare, Reaktionen, Folgen, Spieldaten und die Neuigkeiten, die auf deine E-Mail warten. Die Routen, die unser Motor gezeichnet hat, bleiben: Sie sagen nichts darüber, wer sie angefragt hat.",
            "Jede Nacht wird eine Sicherungskopie der Datenbank gemacht und 13 Tage aufbewahrt: Ein gelöschtes Konto ist nach höchstens 14 Tagen aus jeder Sicherungskopie verschwunden.",
            "Auf deinem Handy: die Sitzung, deine Einstellungen (Sprache, Sport, Seen oder Meer), die Offline-Karten, die Läufe, die noch darauf warten, gesendet zu werden, und mit einem Konto die Gegend, in der deine Aktivitäten meist beginnen, um dir Seen und Meer in der Nähe vorzuschlagen; sie wird gelöscht, wenn du dich abmeldest.",
          ],
        },
        "Die Verbindung zwischen der App und unserem Server ist verschlüsselt (HTTPS).",
      ],
    },
    {
      heading: "Warum wir deine Daten nutzen dürfen",
      blocks: [
        {
          bullets: [
            "Um dir den Dienst zu geben, um den du bittest (Vertrag): dein Konto, dein Profil, die Routen, die du anfragst, und die Läufe, Favoriten, Kommentare, Reaktionen und das Folgen, die du speicherst, die E-Mails der Benachrichtigungen, die du eingeschaltet hast, und das Formenspiel.",
            "Unser berechtigtes Interesse, MuW funktionsfähig, sicher und besser zu halten: die kurzen Protokolle des Servers, die Zählungen, die die Kartendownloads begrenzen, und die Suchereignisse, die nichts darüber sagen, wer du bist; der Abgleich der Nummern deiner Kontakte, von denen keine behalten wird; die E-Mail, wenn du weg bist, die du bei der Anmeldung, in «Einstellungen» oder in jeder E-Mail ablehnen kannst; die E-Mails der Meldungen, um MuW sicher zu halten; das Archiv der gezeichneten Routen, das nichts darüber sagt, wer du bist; die Nachrichten von «Feedback senden», um sie zu lesen und dir zu antworten.",
            "Deine Einwilligung: die Telefonnummer, die du hinzufügst, und die Verbindung mit Strava. Du kannst eine Einwilligung jederzeit widerrufen; was vorher geschah, bleibt rechtmäßig.",
            "Eine rechtliche Pflicht, wenn ein Gesetz von uns verlangt, Daten aufzubewahren oder herauszugeben.",
          ],
        },
      ],
    },
    {
      heading: "Deine Rechte",
      blocks: [
        "Du kannst jederzeit:",
        {
          bullets: [
            "deine Daten sehen und berichtigen: Benutzername, Bio und Bild in «Profil», E-Mail und Telefonnummer in «Einstellungen»;",
            "einen Lauf in «Meine Aktivitäten», einen Favoriten, einen Kommentar oder das ganze Konto in «Einstellungen», «Konto löschen», löschen;",
            "von uns eine Kopie deiner Daten verlangen oder verlangen, dass wir eine Nutzung beenden oder einschränken;",
            "eine Einwilligung widerrufen, die du gegeben hast;",
            "jede E-Mail in «Einstellungen» oder mit ihrem Link ausschalten;",
            "dich bei der Datenschutzbehörde deines Landes beschweren (in Italien beim Garante per la protezione dei dati personali).",
          ],
        },
        "Für alles, was du nicht in der App tun kannst, schreib an muw2610@gmail.com.",
      ],
    },
    {
      heading: "Kinder",
      blocks: [
        "Konten bei MuW sind für Personen ab 16 Jahren. Wenn du glaubst, dass jemand Jüngeres ein Konto hat, schreib uns, und wir löschen es.",
      ],
    },
    {
      heading: "Änderungen an diesem Text",
      blocks: [
        "Wenn sich dieser Text ändert, ändern wir das Datum oben; ist eine Änderung wichtig, geben wir sie bekannt, bevor sie gilt.",
      ],
    },
    {
      heading: "Kontakt",
      blocks: ["Luca Pallaoro · muw2610@gmail.com"],
    },
  ],
};

export const DE: AboutContent = { help, terms, privacy };
