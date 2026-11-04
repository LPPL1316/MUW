# TASK-384 — «MuW Style»: post con modelli AI in outfit sportivi e tag «Shop»

**Stato**: Todo — proposta in `docs/STYLE.md`; niente codice prima del sì
dell'utente sulla proposta
**Fase**: 4 · **Branch**: `docs/TASK-384-muw-style` (proposta) · **ADR**:
ADR-0326 · numero del task dal Coordinatore
(2026-11-04)

## Obiettivo

Nel Feed escono post dell'account MuW con una foto generata dall'AI: un modello
o una modella inventati, in posa sportiva all'aperto, con un outfit. Sulla
foto dei puntini-tag aprono una scheda prodotto con «Shop» e un link affiliato.
Richiesta dell'utente del 2026-11-04 (testo incollato in chat).

## Contesto da leggere

- `docs/STYLE.md`: la proposta intera.
- ADR-0310 e `tasks/TASK-365.md`: i percorsi di MuW nel Feed, contenuto nostro
  fuori da `GET /feed`, l'etichetta fissa.
- ADR-0289 (file su disco) e `tasks/TASK-315.md` (le foto nel Feed).
- ADR-0308 (le schede «All» e «Following»), ADR-0297 (la lente del Feed).
- TASK-267: i testi di oggi, «MuW non mostra pubblicità».

## Materiali preparati

In `out/TASK-384/` (fuori dal repository, `out/` è in `.gitignore`):
`outfits.csv` (100 outfit, 359 capi, 333 prodotti reali di zalando.it),
`image-prompts.md` (100 prompt), i due TSV letti da Zalando il 2026-11-04 e
`build_catalog.py`, che li rifà. Da Zalando solo nome, prezzo e link; nessuna
foto. `alt_retailer_url` è un link di **ricerca** Amazon, non una pagina
controllata. Dettagli in `docs/STYLE.md`, «Il catalogo preparato».

## Scelte dell'utente

Una alla volta, con le sue parole.

1. **Tema degli outfit.** Proposta: peso sugli sport dell'app, 35 running, 20
   trail, 20 bike, 15 athleisure, 10 gym, metà donna e metà uomo.
   — *Risposta* (2026-11-04): «Sport dell'app».
2. **Frequenza nel Feed.** Proposta: al massimo 1 ogni 8, solo «All», mai due
   di fila né nei primi 3, più la lente «Style» e un interruttore in
   «Settings» per toglierli dal Feed.
   — *Risposta* (2026-11-04): «1 ogni 8, solo All».
3. **Strumento per le immagini.** Proposta: Adobe Firefly (licenze,
   Content Credentials).
   — *Risposta* (2026-11-04): «Google Imagen / Gemini».
4. **Prima della società?** Il 2026-10-09 l'utente aveva scelto «niente
   pubblicità finché non c'è la società». Proposta: vale anche per Style.
   — *Risposta* (2026-11-04): «No, Style parte prima». Iscrizione ad Awin da
   persona fisica, fatta dall'utente; il fisco col commercialista.
5. **Aperte, da chiedere prima del codice**: i testi (etichette, scheda,
   «Shop», l'interruttore in «Settings») in cinque lingue; i nuovi Termini e
   Privacy al posto di «MuW non mostra pubblicità»; il sì sulla proposta
   intera (`docs/STYLE.md`).

## Prerequisiti fuori dal codice (dell'utente)

- Iscrizione ad Awin come publisher e candidatura al programma Zalando.
- Testi legali nuovi, sito rigenerato, App Privacy e Data safety aggiornate.
- Piano Google per le immagini con uso commerciale; generare le immagini e
  pubblicare i post solo col suo sì.

## Parti, dopo il sì

- **A — API**: migrazione `style_posts`, `post_product_tags`,
  `product_tag_clicks`; `GET /style`; i due contatori; il controllo dei link.
- **B — App**: la card Style nel Feed (1 ogni 8, «All»), i puntini e la
  scheda, la lente «Style», l'interruttore in «Settings».
- **C — Contenuti**: le immagini generate e i tag posizionati, approvati
  dall'utente a gruppi, poi l'uscita 2–3 al giorno.

## File toccati (questa PR)

- `docs/tasks/TASK-384.md` (nuovo)
- `docs/STYLE.md` (nuovo)
- `docs/DECISIONS.md` (una voce in fondo)
- `docs/INDEX.md` (una riga)
- `docs/STATUS.md` (righe aggiunte)

## Criteri di accettazione (questa PR)

- [x] 100 outfit in `out/TASK-384/outfits.csv`, solo prodotti di zalando.it,
      senza foto.
- [x] 100 prompt senza loghi né persone reali in `out/TASK-384/image-prompts.md`.
- [x] Proposta in `docs/STYLE.md` con etichette, tag, frequenza, uscita
      graduale, modello dati, clic, prerequisiti.
- [x] Le tre scelte chieste all'utente, più quella sulla società.
- [ ] Il sì dell'utente sulla proposta: poi le parti A–C.
