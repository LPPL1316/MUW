"""The words of the email of the notices (TASK-262 part B, ADR-0226), in
the five languages of the app (TASK-210).

Each line is the push of its event (push.TEXTS, approved by the user with
part A), so an event reads the same on the phone and in the email. Around
them: the subject, a title, the button and the footer. «Hi», the button
and the button of the page are the away email's (away_texts.py). The name
of the switch is the one «Settings» shows (the app's i18n).
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from html import escape

from shaperoute_api.accounts import Language
from shaperoute_api.away_texts import ACCENT, MUTED, ON_ACCENT, Written, _page
from shaperoute_api.away_texts import WORDS as AWAY_WORDS

# The lines written in the email; the others are a number.
MAX_LINES = 10


@dataclass(frozen=True)
class Words:
    """One language's sentences; {count} and {switch} are filled in."""

    subject: str
    title: str
    more: str
    why: str
    settings: str
    switch: str
    # The page of the link «Don't send me these emails».
    ask: str
    stopped: str


WORDS: dict[Language, Words] = {
    "en": Words(
        subject="{count} new notifications on MuW",
        title="New on MuW:",
        more="…and {count} more in the app.",
        why=(
            "You get this email because Email notifications is on: one email"
            " a day at most, only when something happens."
        ),
        settings="You can also turn them off in Settings › {switch}.",
        switch="Email notifications",
        ask="Stop the emails of your MuW notifications?",
        stopped="Done: Email notifications is off.",
    ),
    "it": Words(
        subject="{count} nuove notifiche su MuW",
        title="Novità su MuW:",
        more="…e altre {count} nell'app.",
        why=(
            "Ricevi questa email perché le Notifiche email sono accese: al"
            " massimo una al giorno, solo quando succede qualcosa."
        ),
        settings="Puoi spegnerle anche in Impostazioni › {switch}.",
        switch="Notifiche email",
        ask="Smettere di ricevere le email delle notifiche di MuW?",
        stopped="Fatto: le Notifiche email sono spente.",
    ),
    "de": Words(
        subject="{count} neue Benachrichtigungen auf MuW",
        title="Neu auf MuW:",
        more="…und {count} weitere in der App.",
        why=(
            "Du bekommst diese E-Mail, weil E-Mail-Benachrichtigungen"
            " eingeschaltet sind: höchstens eine am Tag, nur wenn etwas"
            " passiert."
        ),
        settings="Du kannst sie auch unter Einstellungen › {switch} ausschalten.",
        switch="E-Mail-Benachrichtigungen",
        ask="Keine E-Mails mehr zu deinen MuW-Benachrichtigungen?",
        stopped="Erledigt: E-Mail-Benachrichtigungen sind ausgeschaltet.",
    ),
    "es": Words(
        subject="{count} notificaciones nuevas en MuW",
        title="Novedades en MuW:",
        more="…y {count} más en la app.",
        why=(
            "Recibes este correo porque las Notificaciones por correo están"
            " activadas: como mucho uno al día, solo cuando pasa algo."
        ),
        settings="También puedes desactivarlas en Ajustes › {switch}.",
        switch="Notificaciones por correo",
        ask="¿Dejar de recibir los correos de tus notificaciones de MuW?",
        stopped="Hecho: las Notificaciones por correo están desactivadas.",
    ),
    "fr": Words(
        subject="{count} nouvelles notifications sur MuW",
        title="Du nouveau sur MuW :",
        more="…et {count} autres dans l'app.",
        why=(
            "Tu reçois cet e-mail parce que les Notifications par e-mail sont"
            " activées : au plus un par jour, seulement quand il se passe"
            " quelque chose."
        ),
        settings="Tu peux aussi les désactiver dans Réglages › {switch}.",
        switch="Notifications par e-mail",
        ask="Arrêter les e-mails de tes notifications MuW ?",
        stopped="C'est fait : les Notifications par e-mail sont désactivées.",
    ),
}


def write(
    language: Language,
    username: str,
    lines: Sequence[str],
    open_url: str,
    stop_url: str,
) -> Written:
    """The email in `language` for `username`, with the lines of its events,
    the newest first; `lines` must have one."""
    if not lines:
        raise ValueError("an email without a notice is never written")
    words, away = WORDS[language], AWAY_WORDS[language]
    shown = list(lines[:MAX_LINES])
    if len(lines) > MAX_LINES:
        shown.append(words.more.format(count=len(lines) - MAX_LINES))
    subject = lines[0] if len(lines) == 1 else words.subject.format(count=len(lines))
    hello = away.hello.format(username=username)
    settings = words.settings.format(switch=words.switch)
    text = "\n\n".join(
        [
            hello,
            words.title,
            "\n".join(f"• {line}" for line in shown),
            f"{away.button}: {open_url}",
            "—",
            words.why,
            f"{away.stop}: {stop_url}",
            settings,
        ]
    )
    items = "".join(f'<li style="margin:6px 0">{escape(line)}</li>' for line in shown)
    html = (
        '<!doctype html><html><body style="margin:0;padding:24px;'
        f'font-family:-apple-system,Helvetica,Arial,sans-serif;color:{ON_ACCENT}">'
        '<div style="max-width:480px;margin:0 auto">'
        f'<p style="font-size:16px">{escape(hello)}</p>'
        f'<p style="font-size:18px;font-weight:600">{escape(words.title)}</p>'
        f'<ul style="font-size:16px;line-height:1.4;padding-left:20px">{items}</ul>'
        f'<p style="margin:28px 0"><a href="{escape(open_url)}"'
        f' style="background:{ACCENT};color:{ON_ACCENT};padding:12px 24px;'
        'border-radius:24px;text-decoration:none;font-weight:600">'
        f"{escape(away.button)}</a></p>"
        f'<p style="font-size:13px;color:{MUTED}">{escape(words.why)}<br>'
        f'<a href="{escape(stop_url)}" style="color:{MUTED}">'
        f"{escape(away.stop)}</a><br>{escape(settings)}</p>"
        "</div></body></html>"
    )
    return Written(subject, text, html)


# --- The page of the link «Don't send me these emails» ---

# A link that is not one of ours: no account to speak to, so in English.
WRONG_LINK = (
    "This link does not work. To stop these emails, turn off"
    " Settings › Email notifications in MuW."
)


def ask_page(language: Language, action: str) -> str:
    """The question, and the button that posts to `action`: opening the
    link alone stops nothing, as mail filters open links to check them."""
    form = (
        f'<form method="post" action="{escape(action)}">'
        f'<button type="submit" style="background:{ACCENT};color:{ON_ACCENT};'
        "border:0;padding:12px 24px;border-radius:24px;font-size:16px;"
        f'font-weight:600">{escape(AWAY_WORDS[language].stop_button)}</button>'
        "</form>"
    )
    return _page(language, [WORDS[language].ask], form)


def stopped_page(language: Language) -> str:
    words = WORDS[language]
    back_on = AWAY_WORDS[language].back_on.format(switch=words.switch)
    return _page(language, [words.stopped, back_on])


def wrong_link_page() -> str:
    return _page("en", [WRONG_LINK])
