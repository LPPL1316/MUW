"""The words of the emails of an account and of the pages of their links
(TASK-300, ADR-0261), in the five languages of the app (TASK-210). The
English ones are the user's, approved on 2026-10-25; de, es, fr and it are
the agent's, with the words the app already uses for «Log in», «Settings ›
Change email» and the password rules.

Four emails: the link that confirms the address of a new account, the one
that confirms a new address asked for in «Settings», the notice to the old
address, and the link that chooses a new password. The usernames and the
addresses are escaped in the HTML.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from html import escape

from shaperoute_api.accounts import MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, Language
from shaperoute_api.away_texts import ACCENT, MUTED, ON_ACCENT

# The errors on the white page (apps/mobile/src/theme/tokens.ts, the light
# tone's error): a page cannot read the app's tokens.
ERROR = "#B3261E"
# The names of the two fields of the page of a new password.
PASSWORD_FIELD = "password"
REPEAT_FIELD = "repeat"


@dataclass(frozen=True)
class Words:
    """One language's sentences; {username}, {email}, {masked}, {min} and
    {max} are filled in."""

    hello: str
    # The link of a new account.
    confirm_subject: str
    confirm_line: str
    confirm_note: str
    # The link of a new address asked for in «Settings».
    change_subject: str
    change_line: str
    change_note: str
    confirm_button: str
    # The notice to the old address.
    notice_subject: str
    notice_line: str
    notice_not_you: str
    # The link of a new password.
    reset_subject: str
    reset_line: str
    reset_note: str
    reset_button: str
    # The pages of the links.
    confirm_ask: str
    confirmed: str
    taken: str
    wrong_link: str
    reset_title: str
    new_password: str
    at_least: str
    repeat: str
    save_button: str
    not_same: str
    too_short: str
    too_long: str
    reset_done: str


WORDS: dict[Language, Words] = {
    "en": Words(
        hello="Hi {username},",
        confirm_subject="Confirm your email for MuW",
        confirm_line="Tap the button to confirm that this is your email address.",
        confirm_note=(
            "The link works for 7 days. If you did not sign up for MuW,"
            " ignore this email."
        ),
        change_subject="Confirm your new email for MuW",
        change_line=(
            "You asked to use this address for your MuW account."
            " It changes once you confirm it."
        ),
        change_note=(
            "The link works for 7 days. If it wasn't you, ignore this email:"
            " nothing changes."
        ),
        confirm_button="Confirm my email",
        notice_subject="Your MuW email is about to change",
        notice_line=(
            "Someone asked to change the email of your MuW account to {masked}."
            " It changes only when the new address is confirmed."
        ),
        notice_not_you=(
            "If it wasn't you, choose a new password with «Forgot password?»"
            " on «Log in» in MuW: that cancels the change and signs out every"
            " phone."
        ),
        reset_subject="Choose a new MuW password",
        reset_line=(
            "Someone asked to reset the password of your MuW account."
            " Tap the button to choose a new one."
        ),
        reset_note=(
            "The link works once, for 1 hour. If you did not ask, ignore this"
            " email: your password stays the same."
        ),
        reset_button="Choose a new password",
        confirm_ask="Confirm {email} as the email of your MuW account?",
        confirmed="Done: {email} is confirmed. You can go back to MuW.",
        taken=(
            "Another account has this email now. Choose another one in"
            " Settings › Change email."
        ),
        wrong_link="This link does not work any more. Ask for a new one in MuW.",
        reset_title="Choose a new password for {username}",
        new_password="NEW PASSWORD",
        at_least="At least 8 characters",
        repeat="REPEAT IT",
        save_button="Save the password",
        not_same="The two passwords are not the same.",
        too_short="A password is at least {min} characters.",
        too_long="A password is at most {max} characters.",
        reset_done=(
            "Your password is changed. Open MuW and log in with it: every phone"
            " was signed out."
        ),
    ),
    "it": Words(
        hello="Ciao {username},",
        confirm_subject="Conferma la tua email per MuW",
        confirm_line=(
            "Tocca il pulsante per confermare che questo è il tuo indirizzo email."
        ),
        confirm_note=(
            "Il link vale 7 giorni. Se non hai creato un account MuW,"
            " ignora questa email."
        ),
        change_subject="Conferma la tua nuova email per MuW",
        change_line=(
            "Hai chiesto di usare questo indirizzo per il tuo account MuW."
            " Cambia quando lo confermi."
        ),
        change_note=(
            "Il link vale 7 giorni. Se non l'hai chiesto tu, ignora questa"
            " email: non cambia niente."
        ),
        confirm_button="Conferma la mia email",
        notice_subject="La tua email di MuW sta per cambiare",
        notice_line=(
            "Qualcuno ha chiesto di cambiare l'email del tuo account MuW in"
            " {masked}. Cambia solo quando il nuovo indirizzo è confermato."
        ),
        notice_not_you=(
            "Se non l'hai chiesto tu, scegli una nuova password con «Password"
            " dimenticata?» in «Accedi» su MuW: la modifica è annullata e"
            " l'account esce da ogni telefono."
        ),
        reset_subject="Scegli una nuova password per MuW",
        reset_line=(
            "Qualcuno ha chiesto di reimpostare la password del tuo account"
            " MuW. Tocca il pulsante per sceglierne una nuova."
        ),
        reset_note=(
            "Il link vale una volta sola, per 1 ora. Se non l'hai chiesto tu,"
            " ignora questa email: la password resta la stessa."
        ),
        reset_button="Scegli una nuova password",
        confirm_ask="Confermare {email} come email del tuo account MuW?",
        confirmed="Fatto: {email} è confermata. Puoi tornare su MuW.",
        taken=(
            "Un altro account ha ora questa email. Scegline un'altra in"
            " Impostazioni › Cambia email."
        ),
        wrong_link="Questo link non funziona più. Chiedine uno nuovo in MuW.",
        reset_title="Scegli una nuova password per {username}",
        new_password="NUOVA PASSWORD",
        at_least="Almeno 8 caratteri",
        repeat="RIPETILA",
        save_button="Salva la password",
        not_same="Le due password non sono uguali.",
        too_short="La password deve avere almeno {min} caratteri.",
        too_long="La password può avere al massimo {max} caratteri.",
        reset_done=(
            "La password è cambiata. Apri MuW e accedi con la nuova: l'account"
            " è uscito da ogni telefono."
        ),
    ),
    "de": Words(
        hello="Hallo {username},",
        confirm_subject="Bestätige deine E-Mail für MuW",
        confirm_line=(
            "Tippe auf den Button, um zu bestätigen, dass das deine"
            " E-Mail-Adresse ist."
        ),
        confirm_note=(
            "Der Link gilt 7 Tage. Wenn du dich nicht bei MuW angemeldet hast,"
            " ignoriere diese E-Mail."
        ),
        change_subject="Bestätige deine neue E-Mail für MuW",
        change_line=(
            "Du möchtest diese Adresse für dein MuW-Konto verwenden."
            " Sie ändert sich, sobald du sie bestätigst."
        ),
        change_note=(
            "Der Link gilt 7 Tage. Wenn du das nicht warst, ignoriere diese"
            " E-Mail: Es ändert sich nichts."
        ),
        confirm_button="E-Mail bestätigen",
        notice_subject="Deine MuW-E-Mail ändert sich bald",
        notice_line=(
            "Jemand möchte die E-Mail deines MuW-Kontos in {masked} ändern."
            " Sie ändert sich erst, wenn die neue Adresse bestätigt ist."
        ),
        notice_not_you=(
            "Wenn du das nicht warst, wähle in MuW unter «Anmelden» mit"
            " «Passwort vergessen?» ein neues Passwort: Damit wird die Änderung"
            " abgebrochen und jedes Telefon abgemeldet."
        ),
        reset_subject="Wähle ein neues MuW-Passwort",
        reset_line=(
            "Jemand möchte das Passwort deines MuW-Kontos zurücksetzen."
            " Tippe auf den Button, um ein neues zu wählen."
        ),
        reset_note=(
            "Der Link gilt einmal, für 1 Stunde. Wenn du das nicht wolltest,"
            " ignoriere diese E-Mail: Dein Passwort bleibt gleich."
        ),
        reset_button="Neues Passwort wählen",
        confirm_ask="{email} als E-Mail deines MuW-Kontos bestätigen?",
        confirmed="Fertig: {email} ist bestätigt. Du kannst zu MuW zurück.",
        taken=(
            "Ein anderes Konto hat jetzt diese E-Mail. Wähle unter"
            " Einstellungen › E-Mail ändern eine andere."
        ),
        wrong_link=(
            "Dieser Link funktioniert nicht mehr. Fordere in MuW einen neuen an."
        ),
        reset_title="Wähle ein neues Passwort für {username}",
        new_password="NEUES PASSWORT",
        at_least="Mindestens 8 Zeichen",
        repeat="WIEDERHOLEN",
        save_button="Passwort speichern",
        not_same="Die beiden Passwörter sind nicht gleich.",
        too_short="Ein Passwort hat mindestens {min} Zeichen.",
        too_long="Ein Passwort hat höchstens {max} Zeichen.",
        reset_done=(
            "Dein Passwort ist geändert. Öffne MuW und melde dich damit an:"
            " Jedes Telefon wurde abgemeldet."
        ),
    ),
    "es": Words(
        hello="Hola, {username}:",
        confirm_subject="Confirma tu correo para MuW",
        confirm_line=(
            "Toca el botón para confirmar que esta es tu dirección de correo."
        ),
        confirm_note=(
            "El enlace vale 7 días. Si no te registraste en MuW, ignora este" " correo."
        ),
        change_subject="Confirma tu nuevo correo para MuW",
        change_line=(
            "Pediste usar esta dirección para tu cuenta de MuW."
            " Cambia cuando la confirmes."
        ),
        change_note=(
            "El enlace vale 7 días. Si no fuiste tú, ignora este correo:"
            " no cambia nada."
        ),
        confirm_button="Confirmar mi correo",
        notice_subject="Tu correo de MuW está a punto de cambiar",
        notice_line=(
            "Alguien pidió cambiar el correo de tu cuenta de MuW a {masked}."
            " Solo cambia cuando se confirme la nueva dirección."
        ),
        notice_not_you=(
            "Si no fuiste tú, elige una nueva contraseña con «¿Olvidaste la"
            " contraseña?» en «Iniciar sesión» en MuW: así se cancela el cambio"
            " y se cierra la sesión en todos los teléfonos."
        ),
        reset_subject="Elige una nueva contraseña de MuW",
        reset_line=(
            "Alguien pidió restablecer la contraseña de tu cuenta de MuW."
            " Toca el botón para elegir una nueva."
        ),
        reset_note=(
            "El enlace vale una sola vez, durante 1 hora. Si no lo pediste,"
            " ignora este correo: tu contraseña sigue igual."
        ),
        reset_button="Elegir una nueva contraseña",
        confirm_ask="¿Confirmar {email} como el correo de tu cuenta de MuW?",
        confirmed="Hecho: {email} está confirmado. Puedes volver a MuW.",
        taken=(
            "Otra cuenta tiene ahora este correo. Elige otro en"
            " Ajustes › Cambiar correo."
        ),
        wrong_link="Este enlace ya no funciona. Pide uno nuevo en MuW.",
        reset_title="Elige una nueva contraseña para {username}",
        new_password="NUEVA CONTRASEÑA",
        at_least="Al menos 8 caracteres",
        repeat="REPÍTELA",
        save_button="Guardar la contraseña",
        not_same="Las dos contraseñas no son iguales.",
        too_short="Una contraseña tiene al menos {min} caracteres.",
        too_long="Una contraseña tiene como máximo {max} caracteres.",
        reset_done=(
            "Tu contraseña ha cambiado. Abre MuW e inicia sesión con ella:"
            " se cerró la sesión en todos los teléfonos."
        ),
    ),
    "fr": Words(
        hello="Bonjour {username},",
        confirm_subject="Confirme ton e-mail pour MuW",
        confirm_line=(
            "Touche le bouton pour confirmer que c'est bien ton adresse e-mail."
        ),
        confirm_note=(
            "Le lien est valable 7 jours. Si tu n'as pas créé de compte MuW,"
            " ignore cet e-mail."
        ),
        change_subject="Confirme ton nouvel e-mail pour MuW",
        change_line=(
            "Tu as demandé à utiliser cette adresse pour ton compte MuW."
            " Elle change dès que tu la confirmes."
        ),
        change_note=(
            "Le lien est valable 7 jours. Si ce n'était pas toi, ignore cet"
            " e-mail : rien ne change."
        ),
        confirm_button="Confirmer mon e-mail",
        notice_subject="L'e-mail de ton compte MuW va changer",
        notice_line=(
            "Quelqu'un a demandé à changer l'e-mail de ton compte MuW pour"
            " {masked}. Il ne change que lorsque la nouvelle adresse est"
            " confirmée."
        ),
        notice_not_you=(
            "Si ce n'était pas toi, choisis un nouveau mot de passe avec « Mot"
            " de passe oublié ? » sur « Se connecter » dans MuW : le changement"
            " est annulé et chaque téléphone est déconnecté."
        ),
        reset_subject="Choisis un nouveau mot de passe MuW",
        reset_line=(
            "Quelqu'un a demandé à réinitialiser le mot de passe de ton compte"
            " MuW. Touche le bouton pour en choisir un nouveau."
        ),
        reset_note=(
            "Le lien est valable une seule fois, pendant 1 heure. Si tu n'as"
            " rien demandé, ignore cet e-mail : ton mot de passe reste le même."
        ),
        reset_button="Choisir un nouveau mot de passe",
        confirm_ask="Confirmer {email} comme e-mail de ton compte MuW ?",
        confirmed="C'est fait : {email} est confirmé. Tu peux revenir sur MuW.",
        taken=(
            "Un autre compte a maintenant cet e-mail. Choisis-en un autre dans"
            " Réglages › Changer d'e-mail."
        ),
        wrong_link=("Ce lien ne fonctionne plus. Demandes-en un nouveau dans MuW."),
        reset_title="Choisis un nouveau mot de passe pour {username}",
        new_password="NOUVEAU MOT DE PASSE",
        at_least="Au moins 8 caractères",
        repeat="RÉPÈTE-LE",
        save_button="Enregistrer le mot de passe",
        not_same="Les deux mots de passe ne sont pas identiques.",
        too_short="Un mot de passe compte au moins {min} caractères.",
        too_long="Un mot de passe compte au plus {max} caractères.",
        reset_done=(
            "Ton mot de passe a changé. Ouvre MuW et connecte-toi avec : chaque"
            " téléphone a été déconnecté."
        ),
    ),
}


@dataclass(frozen=True)
class Written:
    subject: str
    text: str
    html: str


def masked(email: str) -> str:
    """ "n•••@example.com": the first letter and the domain of an address."""
    name, _, domain = email.partition("@")
    return f"{name[:1]}•••@{domain}"


def _email(
    hello: str,
    lines: Sequence[str],
    note: str | None = None,
    button: tuple[str, str] | None = None,
) -> tuple[str, str]:
    """The text and the HTML of an email: hello, lines, the button with its
    link, the note in small letters."""
    parts = [hello, *lines]
    if button is not None:
        parts.append(f"{button[0]}: {button[1]}")
    if note is not None:
        parts += ["—", note]
    text = "\n\n".join(parts)
    paragraphs = "".join(
        f'<p style="font-size:17px;line-height:1.4">{escape(line)}</p>'
        for line in lines
    )
    link = (
        ""
        if button is None
        else f'<p style="margin:28px 0"><a href="{escape(button[1])}"'
        f' style="background:{ACCENT};color:{ON_ACCENT};padding:12px 24px;'
        'border-radius:24px;text-decoration:none;font-weight:600">'
        f"{escape(button[0])}</a></p>"
    )
    html = (
        '<!doctype html><html><body style="margin:0;padding:24px;'
        f'font-family:-apple-system,Helvetica,Arial,sans-serif;color:{ON_ACCENT}">'
        '<div style="max-width:480px;margin:0 auto">'
        f'<p style="font-size:16px">{escape(hello)}</p>{paragraphs}{link}'
        + (
            ""
            if note is None
            else f'<p style="font-size:13px;color:{MUTED}">{escape(note)}</p>'
        )
        + "</div></body></html>"
    )
    return text, html


def confirm_email(
    language: Language, username: str, url: str, changing: bool
) -> Written:
    """The link that confirms an address: of a new account, or a new one
    asked for in «Settings» (`changing`)."""
    words = WORDS[language]
    subject, line, note = (
        (words.change_subject, words.change_line, words.change_note)
        if changing
        else (words.confirm_subject, words.confirm_line, words.confirm_note)
    )
    hello = words.hello.format(username=username)
    text, html = _email(hello, [line], note, (words.confirm_button, url))
    return Written(subject, text, html)


def notice_email(language: Language, username: str, new_email: str) -> Written:
    """To the old address: a new one was asked for, and what to do if it
    was not its owner. No link: the way out is in the app."""
    words = WORDS[language]
    hello = words.hello.format(username=username)
    line = words.notice_line.format(masked=masked(new_email))
    text, html = _email(hello, [line, words.notice_not_you])
    return Written(words.notice_subject, text, html)


def reset_email(language: Language, username: str, url: str) -> Written:
    words = WORDS[language]
    hello = words.hello.format(username=username)
    text, html = _email(
        hello, [words.reset_line], words.reset_note, (words.reset_button, url)
    )
    return Written(words.reset_subject, text, html)


# --- The pages of the links ---

BUTTON_STYLE = (
    f"background:{ACCENT};color:{ON_ACCENT};border:0;padding:12px 24px;"
    "border-radius:24px;font-size:16px;font-weight:600"
)
LABEL_STYLE = (
    f"display:block;font-size:13px;font-weight:600;letter-spacing:1.2px;"
    f"color:{MUTED};margin:20px 0 6px"
)
INPUT_STYLE = (
    "box-sizing:border-box;width:100%;font-size:17px;padding:10px 12px;"
    f"border:1px solid {MUTED};border-radius:12px"
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


def confirm_page(language: Language, email: str, action: str) -> str:
    """The question, and the button that posts to `action`."""
    words = WORDS[language]
    form = (
        f'<form method="post" action="{escape(action)}">'
        f'<button type="submit" style="{BUTTON_STYLE}">'
        f"{escape(words.confirm_button)}</button></form>"
    )
    return _page(language, [words.confirm_ask.format(email=email)], form)


def confirmed_page(language: Language, email: str) -> str:
    return _page(language, [WORDS[language].confirmed.format(email=email)])


def taken_page(language: Language) -> str:
    return _page(language, [WORDS[language].taken])


def wrong_link_page(language: Language = "en") -> str:
    return _page(language, [WORDS[language].wrong_link])


def reset_page(
    language: Language, username: str, action: str, problem: str | None = None
) -> str:
    """The two fields of a new password, and what was wrong with the last
    try. Nothing written comes back into the fields."""
    words = WORDS[language]
    field_rules = (
        f'minlength="{MIN_PASSWORD_LENGTH}" maxlength="{MAX_PASSWORD_LENGTH}"'
        ' required autocomplete="new-password"'
    )
    said = (
        ""
        if problem is None
        else f'<p role="alert" style="font-size:15px;color:{ERROR}">'
        f"{escape(problem)}</p>"
    )
    form = (
        f'<form method="post" action="{escape(action)}">'
        f'<label for="{PASSWORD_FIELD}" style="{LABEL_STYLE}">'
        f"{escape(words.new_password)}</label>"
        f'<input id="{PASSWORD_FIELD}" name="{PASSWORD_FIELD}" type="password"'
        f' placeholder="{escape(words.at_least)}" {field_rules}'
        f' style="{INPUT_STYLE}">'
        f'<label for="{REPEAT_FIELD}" style="{LABEL_STYLE}">'
        f"{escape(words.repeat)}</label>"
        f'<input id="{REPEAT_FIELD}" name="{REPEAT_FIELD}" type="password"'
        f' {field_rules} style="{INPUT_STYLE}">'
        f"{said}"
        f'<p style="margin-top:28px"><button type="submit" style="{BUTTON_STYLE}">'
        f"{escape(words.save_button)}</button></p></form>"
    )
    return _page(language, [words.reset_title.format(username=username)], form)


def password_problem(language: Language, password: str, repeat: str) -> str | None:
    """What is wrong with a new password, in words; None when it can be
    kept: the rules of signing up."""
    words = WORDS[language]
    if len(password) < MIN_PASSWORD_LENGTH:
        return words.too_short.format(min=MIN_PASSWORD_LENGTH)
    if len(password) > MAX_PASSWORD_LENGTH:
        return words.too_long.format(max=MAX_PASSWORD_LENGTH)
    if password != repeat:
        return words.not_same
    return None


def reset_done_page(language: Language) -> str:
    return _page(language, [WORDS[language].reset_done])
