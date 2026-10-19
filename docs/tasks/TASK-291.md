# TASK-291 — Ogni segnalazione arriva per email, con un link che nasconde

**Stato**: In revisione (PR aperta, entra dopo la #502)
**Fase**: 4 · **Branch**: `feat/TASK-291-report-email`
**ADR**: ADR-0251 (rimanda ad ADR-0228) · numeri dal Coordinatore
**Dipende da**: TASK-121 e TASK-275 (le segnalazioni), TASK-284 parte A
(#502, Resend): entra **dopo la #502**

## Obiettivo

A ogni segnalazione di un disegno, di un commento o di un profilo, chi
gestisce MuW riceve un'email con cosa è stato segnalato e perché, e un link
che lo nasconde agli altri iscritti. Nascondere si può annullare.

## Contesto

Il 2026-10-17 Apple ha mandato a tutti gli sviluppatori le regole
aggiornate. La 1.2 dice ora che chi non mette tutele adeguate o non rimedia
ai contenuti segnalati dopo un avviso viola il Developer Code of Conduct.
Oggi le segnalazioni (TASK-121, TASK-275, ADR-0228 punto 5) si leggono solo
nel database, e la risposta ad Apple promette di guardarle entro 24 ore.
L'utente ha detto «SI FAI IL TASK DELLE SEGNALAZIONI» alla proposta.

Note del Coordinatore (2026-10-17):

1. l'indirizzo di chi gestisce e il segreto dei link stanno solo in
   `deploy/.env` sul server; `.env.example` ha le variabili vuote;
2. il link scade, vale una volta sola e non fa altro che la sua azione;
   il nascosto si può annullare;
3. l'email porta a Resend il contenuto segnalato e il nome di chi l'ha
   scritto: va detto nella privacy, insieme alla parte B di TASK-284 (che
   introduce Resend), con il sì dell'utente sul testo. **Non in questo
   task**: i file della privacy sono di #461 fino al suo merge.

## Contesto da leggere

- `docs/DECISIONS.md` ADR-0228 e la sua aggiunta (TASK-275)
- `docs/API.md` «Block and report»
- `services/api/shaperoute_api/moderation.py`, `follows.apart_sql`,
  `drawings.drawing_seen_sql` e `shown_sql`, `comments.NOT_APART`
- La #502: `resend_email.py` e il link firmato di `away_email.py`

## Cosa fare

1. **Migrazione** (il primo numero libero al merge: `0024` dopo la #502):
   `hidden_at` su `drawings`, `comments` e `users`; una tabella dei link
   già usati.
2. **Nascosto agli altri, non all'autore**:
   - un disegno nascosto non lo vede più nessuno tranne chi l'ha fatto
     (`drawing_seen_sql`, `shown_sql`, il conteggio pubblico);
   - un commento nascosto lo vede solo chi l'ha scritto (`NOT_APART`);
   - un profilo nascosto sparisce agli altri come dietro un blocco: profilo,
     ricerca, disegni, commenti, reazioni (`apart_sql`). Chi è nascosto
     continua a vedere tutto come prima: niente gli dice che è nascosto.
3. **L'email**: a ogni segnalazione nuova (non quando la stessa persona
   cambia il motivo), fuori dalla richiesta, in inglese: cosa (disegno,
   commento, profilo), il motivo, chi segnala, chi l'ha scritto, il testo
   (titolo e descrizione, commento, nome e bio), quante segnalazioni ha già
   quella cosa, se è già nascosta, e il link «Hide».
4. **Il link**: firmato con il segreto delle email, dice azione, cosa, id e
   scadenza (7 giorni); la pagina chiede conferma con un pulsante (un
   lettore di posta che apre i link non nasconde niente); al POST l'azione
   si fa una volta sola. La pagina dopo «Hide» ha «Undo», con un link nuovo
   dello stesso tipo.
5. **Spento** finché il server non ha `RESEND_API_KEY`,
   `SHAPEROUTE_EMAIL_SECRET`, `SHAPEROUTE_DOMAIN` e
   `SHAPEROUTE_REPORTS_TO`: la segnalazione si salva come oggi. Il
   nascondere funziona comunque anche a mano nel database.
6. **Invio**: un modulo minimo dietro `send_email(...)`; dopo il merge della
   #502 usa il suo `resend_email.py`, così l'invio resta uno solo.

## Criteri di accettazione

- [ ] Una segnalazione nuova manda un'email con il link; la stessa
      segnalazione ripetuta no (test).
- [ ] Senza le quattro variabili nessuna email, la segnalazione resta (test).
- [ ] Un link alterato, scaduto o già usato non fa niente (test).
- [ ] Il GET del link non cambia niente; il POST nasconde, e «Undo»
      rimette com'era (test).
- [ ] Disegno nascosto: sparisce da feed, profilo, apertura per id,
      commenti e reazioni per gli altri, l'autore lo vede (test).
- [ ] Commento nascosto: sparisce agli altri e dal conteggio, l'autore lo
      vede (test).
- [ ] Profilo nascosto: profilo, ricerca, disegni e commenti spariscono
      agli altri; chi è nascosto vede tutto (test).
- [ ] Nessun indirizzo, chiave o token nei log.
- [ ] Suite dell'API, `ruff` e `black` verdi.

## File toccati

```
services/api/migrations/0024_hidden_content.sql   (nuovo)
services/api/shaperoute_api/report_email.py       (nuovo)
services/api/shaperoute_api/send_email.py         (nuovo, minimo)
services/api/shaperoute_api/moderation.py
services/api/shaperoute_api/follows.py
services/api/shaperoute_api/drawings.py
services/api/shaperoute_api/comments.py
services/api/shaperoute_api/push.py
services/api/shaperoute_api/access.py
services/api/shaperoute_api/__main__.py
services/api/tests/test_report_email.py           (nuovo)
.env.example
docs/API.md
docs/DATABASE.md
docs/DEPLOY.md
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-291.md
```

## La privacy, approvata dall'utente

Testo inglese approvato dall'utente il 2026-10-19 («sì privacy»). Entra
nella privacy dell'app (`apps/mobile/src/about/content/*.ts`, poi `node
site/tools/make_privacy.mjs`) con la **parte B di TASK-284**, tradotto
nelle altre quattro lingue, **prima** di accendere l'email sul server.

Una sezione nuova **«Reports»**:

> When you report a drawing, a comment or a profile, we keep who reported
> what, the reason and when. The person who runs MuW receives it by email
> and may hide what was reported from the other members. Nothing is
> deleted, and its author still sees it. Your report is never shown to
> the author.

Una riga nuova in **«Others who receive data»**:

> Resend sends MuW's emails. For a report it carries to the person who
> runs MuW what was reported, its text, the reason, and the usernames of
> who reported it and who wrote it.

Se la parte B di TASK-284 scrive già una riga su Resend per l'email di
ritorno, le due si uniscono in una sola riga «Resend sends MuW's emails…».

## Fuori scope

- Scrivere la privacy: la fa la parte B di TASK-284, con il testo sopra.
- Un pannello per leggere le segnalazioni, o cancellare un account.
- Avvisare l'autore che un suo contenuto è nascosto.
- Testi nell'app: nessuno cambia.
- Server e merge: dopo il verdetto di Apple, con l'ok dell'utente.

## Esito

*(a fine task)*
