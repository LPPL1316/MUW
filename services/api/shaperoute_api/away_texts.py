"""The words of the email to who has not opened the app for two weeks
(TASK-284, ADR-0244), in the five languages of the app (TASK-210).

What is new comes in one of two ways: drawings of the people the reader
follows, with up to MAX_NAMES of their names, or else drawings in the
Feed. One drawing and more have their own sentences: no verb has the
people as its subject, so one name or three read the same in every
language. The names are usernames ([A-Za-z0-9_.]); the HTML escapes them
all the same.

The name of the switch in the footer is the one «Settings» shows (part B
of the task puts it in the app with these words).
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from html import escape

from shaperoute_api.accounts import Language

# The names written in the email; the others are a number: "+2".
MAX_NAMES = 3
# The brand yellow and the text on it (apps/mobile/src/theme/tokens.ts,
# accent and onAccent): an email cannot read the app's tokens.
ACCENT = "#FFD02B"
ON_ACCENT = "#0A0A0B"
MUTED = "#6B6B70"


@dataclass(frozen=True)
class News:
    """What the reader has not seen: drawings published since the last use
    of the app that the Feed would show them, theirs left out."""

    # Of the people the reader follows, and the first MAX_NAMES of those
    # people, the one who published last first.
    followed: int
    names: Sequence[str]
    # How many people published them, those named too.
    people: int
    # Of everyone, those of the people followed too.
    feed: int

    @property
    def any(self) -> bool:
        return self.followed > 0 or self.feed > 0


@dataclass(frozen=True)
class Words:
    """One language's sentences; {count}, {names}, {name}, {username} and
    {switch} are filled in."""

    subject_followed_one: str
    subject_followed: str
    subject_feed_one: str
    subject_feed: str
    hello: str
    followed_one: str
    followed: str
    feed_one: str
    feed: str
    button: str
    why: str
    stop: str
    settings: str
    switch: str
    # The page of the link «Don't send me these emails»: first a question
    # with a button, then what was done.
    ask: str
    stop_button: str
    stopped: str
    back_on: str


WORDS: dict[Language, Words] = {
    "en": Words(
        subject_followed_one="{name} posted a new drawing on MuW",
        subject_followed="{count} new drawings from people you follow",
        subject_feed_one="A new drawing on MuW",
        subject_feed="{count} new drawings on MuW",
        hello="Hi {username},",
        followed_one="A new drawing from {names}.",
        followed="{count} new drawings from people you follow: {names}.",
        feed_one="A new drawing in the Feed since your last visit.",
        feed="{count} new drawings in the Feed since your last visit.",
        button="Open MuW",
        why=(
            "You get this email because you have not opened MuW for 2 weeks."
            " We send it once, until you are back."
        ),
        stop="Don't send me these emails",
        settings="You can also turn it off in Settings › {switch}.",
        switch="Email when I'm away",
        ask="Stop the emails MuW sends when you are away?",
        stop_button="Stop these emails",
        stopped="Done: MuW will not send you these emails any more.",
        back_on="You can turn them back on in Settings › {switch}.",
    ),
    "it": Words(
        subject_followed_one="{name} ha un nuovo disegno su MuW",
        subject_followed="{count} nuovi disegni da chi segui",
        subject_feed_one="Un nuovo disegno su MuW",
        subject_feed="{count} nuovi disegni su MuW",
        hello="Ciao {username},",
        followed_one="Un nuovo disegno di {names}.",
        followed="{count} nuovi disegni da chi segui: {names}.",
        feed_one="Un nuovo disegno nel Feed dalla tua ultima visita.",
        feed="{count} nuovi disegni nel Feed dalla tua ultima visita.",
        button="Apri MuW",
        why=(
            "Ricevi questa email perché non apri MuW da 2 settimane."
            " La mandiamo una volta sola, finché non torni."
        ),
        stop="Non mandarmi più queste email",
        settings="Puoi spegnerla anche in Impostazioni › {switch}.",
        switch="Email quando sono via",
        ask="Smettere di ricevere le email che MuW manda quando sei via?",
        stop_button="Basta email",
        stopped="Fatto: MuW non ti manderà più queste email.",
        back_on="Puoi riaccenderle in Impostazioni › {switch}.",
    ),
    "de": Words(
        subject_followed_one="Eine neue Zeichnung von {name} auf MuW",
        subject_followed="{count} neue Zeichnungen von Leuten, denen du folgst",
        subject_feed_one="Eine neue Zeichnung auf MuW",
        subject_feed="{count} neue Zeichnungen auf MuW",
        hello="Hallo {username},",
        followed_one="Eine neue Zeichnung von {names}.",
        followed="{count} neue Zeichnungen von Leuten, denen du folgst: {names}.",
        feed_one="Eine neue Zeichnung im Feed seit deinem letzten Besuch.",
        feed="{count} neue Zeichnungen im Feed seit deinem letzten Besuch.",
        button="MuW öffnen",
        why=(
            "Du bekommst diese E-Mail, weil du MuW seit 2 Wochen nicht"
            " geöffnet hast. Wir schicken sie einmal, bis du zurück bist."
        ),
        stop="Schickt mir diese E-Mails nicht mehr",
        settings="Du kannst sie auch unter Einstellungen › {switch} ausschalten.",
        switch="E-Mail, wenn ich weg bin",
        ask="Keine E-Mails mehr von MuW, wenn du weg bist?",
        stop_button="Diese E-Mails abbestellen",
        stopped="Erledigt: MuW schickt dir diese E-Mails nicht mehr.",
        back_on="Du kannst sie unter Einstellungen › {switch} wieder einschalten.",
    ),
    "es": Words(
        subject_followed_one="Un dibujo nuevo de {name} en MuW",
        subject_followed="{count} dibujos nuevos de personas que sigues",
        subject_feed_one="Un dibujo nuevo en MuW",
        subject_feed="{count} dibujos nuevos en MuW",
        hello="Hola {username}:",
        followed_one="Un dibujo nuevo de {names}.",
        followed="{count} dibujos nuevos de personas que sigues: {names}.",
        feed_one="Un dibujo nuevo en el Feed desde tu última visita.",
        feed="{count} dibujos nuevos en el Feed desde tu última visita.",
        button="Abrir MuW",
        why=(
            "Recibes este correo porque no abres MuW desde hace 2 semanas."
            " Lo enviamos una sola vez, hasta que vuelvas."
        ),
        stop="No me envíes más estos correos",
        settings="También puedes desactivarlo en Ajustes › {switch}.",
        switch="Correo cuando no estoy",
        ask="¿Dejar de recibir los correos que MuW envía cuando no estás?",
        stop_button="No más correos",
        stopped="Hecho: MuW ya no te enviará estos correos.",
        back_on="Puedes volver a activarlos en Ajustes › {switch}.",
    ),
    "fr": Words(
        subject_followed_one="Un nouveau dessin de {name} sur MuW",
        subject_followed="{count} nouveaux dessins de personnes que tu suis",
        subject_feed_one="Un nouveau dessin sur MuW",
        subject_feed="{count} nouveaux dessins sur MuW",
        hello="Salut {username},",
        followed_one="Un nouveau dessin de {names}.",
        followed="{count} nouveaux dessins de personnes que tu suis : {names}.",
        feed_one="Un nouveau dessin dans le Fil depuis ta dernière visite.",
        feed="{count} nouveaux dessins dans le Fil depuis ta dernière visite.",
        button="Ouvrir MuW",
        why=(
            "Tu reçois cet e-mail parce que tu n'as pas ouvert MuW depuis"
            " 2 semaines. Nous l'envoyons une seule fois, jusqu'à ton retour."
        ),
        stop="Ne plus m'envoyer ces e-mails",
        settings="Tu peux aussi le désactiver dans Réglages › {switch}.",
        switch="E-mail en cas d'absence",
        ask="Ne plus recevoir les e-mails que MuW envoie quand tu n'es pas là ?",
        stop_button="Plus d'e-mails",
        stopped="C'est fait : MuW ne t'enverra plus ces e-mails.",
        back_on="Tu peux les réactiver dans Réglages › {switch}.",
    ),
}


@dataclass(frozen=True)
class Written:
    """One email, ready for Resend."""

    subject: str
    text: str
    html: str


def names_of(news: News) -> str:
    """ "ada, bea, cleo +2": the people named, then how many more."""
    shown = ", ".join(news.names[:MAX_NAMES])
    more = news.people - min(len(news.names), MAX_NAMES)
    return f"{shown} +{more}" if more > 0 else shown


def _subject_and_line(words: Words, news: News) -> tuple[str, str]:
    if news.followed > 0:
        names = names_of(news)
        if news.followed == 1:
            subject = words.subject_followed_one.format(name=news.names[0])
            return subject, words.followed_one.format(names=names)
        return (
            words.subject_followed.format(count=news.followed),
            words.followed.format(count=news.followed, names=names),
        )
    if news.feed == 1:
        return words.subject_feed_one, words.feed_one
    return (
        words.subject_feed.format(count=news.feed),
        words.feed.format(count=news.feed),
    )


def write(
    language: Language, username: str, news: News, open_url: str, stop_url: str
) -> Written:
    """The email in `language` for `username`; `news` must have something."""
    if not news.any:
        raise ValueError("an email with nothing new is never written")
    words = WORDS[language]
    subject, line = _subject_and_line(words, news)
    hello = words.hello.format(username=username)
    settings = words.settings.format(switch=words.switch)
    text = "\n\n".join(
        [
            hello,
            line,
            f"{words.button}: {open_url}",
            "—",
            words.why,
            f"{words.stop}: {stop_url}",
            settings,
        ]
    )
    html = (
        '<!doctype html><html><body style="margin:0;padding:24px;'
        f'font-family:-apple-system,Helvetica,Arial,sans-serif;color:{ON_ACCENT}">'
        '<div style="max-width:480px;margin:0 auto">'
        f'<p style="font-size:16px">{escape(hello)}</p>'
        f'<p style="font-size:18px;font-weight:600">{escape(line)}</p>'
        f'<p style="margin:28px 0"><a href="{escape(open_url)}"'
        f' style="background:{ACCENT};color:{ON_ACCENT};padding:12px 24px;'
        'border-radius:24px;text-decoration:none;font-weight:600">'
        f"{escape(words.button)}</a></p>"
        f'<p style="font-size:13px;color:{MUTED}">{escape(words.why)}<br>'
        f'<a href="{escape(stop_url)}" style="color:{MUTED}">'
        f"{escape(words.stop)}</a><br>{escape(settings)}</p>"
        "</div></body></html>"
    )
    return Written(subject, text, html)


# --- The page of the link «Don't send me these emails» ---

# A link that is not one of ours: no account to speak to, so in English.
WRONG_LINK = (
    "This link does not work. To stop these emails, turn off"
    " Settings › Email when I'm away in MuW."
)


def _page(language: Language, lines: Sequence[str], form: str = "") -> str:
    paragraphs = "".join(
        f'<p style="font-size:17px;line-height:1.4">{escape(line)}</p>'
        for line in lines
    )
    return (
        f'<!doctype html><html lang="{language}"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        "<title>MuW</title></head>"
        '<body style="margin:0;padding:32px 16px;'
        f'font-family:-apple-system,Helvetica,Arial,sans-serif;color:{ON_ACCENT}">'
        f'<div style="max-width:480px;margin:0 auto">{paragraphs}{form}</div>'
        "</body></html>"
    )


def ask_page(language: Language, action: str) -> str:
    """The question, and the button that posts to `action`: opening the
    link alone stops nothing, as mail filters open links to check them."""
    words = WORDS[language]
    form = (
        f'<form method="post" action="{escape(action)}">'
        f'<button type="submit" style="background:{ACCENT};color:{ON_ACCENT};'
        "border:0;padding:12px 24px;border-radius:24px;font-size:16px;"
        f'font-weight:600">{escape(words.stop_button)}</button></form>'
    )
    return _page(language, [words.ask], form)


def stopped_page(language: Language) -> str:
    words = WORDS[language]
    return _page(language, [words.stopped, words.back_on.format(switch=words.switch)])


def wrong_link_page() -> str:
    return _page("en", [WRONG_LINK])
