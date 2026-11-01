# TASK-355 — Una scheda del Feed che si capisce in un colpo d'occhio

**Stato**: Todo — documenti ora, codice col via del Coordinatore
**Fase**: 4 · **Branch**: `docs/TASK-355-feed-clarity` (documenti),
`feat/TASK-355-a-feed-card` (A), `feat/TASK-355-b-feed-counts` (B)
· **ADR**: ADR-0306 · numeri dal Coordinatore (2026-10-30)

## Obiettivo

Da ogni scheda del Feed si capisce subito chi ha corso, quando, cosa ha
disegnato, e si può interagire. Tema scuro e giallo restano. La richiesta
è dell'utente (2026-10-30, un brief incollato); il piano in due parti
l'ha approvato con «Sì, procedi», compresa la deroga al «non toccare le
API» per la sola parte B.

## Contesto da leggere

- `docs/tasks/TASK-339.md` e `docs/DECISIONS.md` ADR-0293: il look
  approvato; la tavola «Feed» del canvas `XRMFiZ9BWbWnKkdJ9Udtjf`
  («BELLISSIMO»).
- `docs/tasks/TASK-348.md`, scelte 3 e 4: i layout e il disegno spostabile.
- `docs/API.md`, «Feed» e «Reazioni».
- ADR-0193 (il cuore vuole un commento), ADR-0207 (niente punteggio),
  ADR-0127 (gli esempi nel Feed), ADR-0267 (TASK-307), ADR-0273 (TASK-313).

## Voce per voce: cosa manca davvero

Letto il codice di `main` e la testa di TASK-339 B il 2026-10-30.

| Voce del brief | Cosa c'è oggi | Manca davvero? | Dove |
|---|---|---|---|
| Lente su una riga intera | Riga propria sopra le schede | Sì; 344 B cambia cosa apre, non dove sta | TASK-362, con le schede |
| Header sticky e separato | Già fermo e opaco: `Pager` sta sopra le pagine e le schede non ci passano sotto | Solo il filo sotto | A, `Hairline`, dopo la #658 |
| Titolo e forma ripetuti | `title` e `what` entrambi nella scheda | Sì | A |
| Data | Mai sulla scheda; il canvas la mostra («Trento · 2 h ago») | Sì | A, da `started_at` |
| Attribuzione | In un angolo, due righe | Una riga, 10 pt | A |
| Inizio e fine del tracciato | Nulla | Sì | A; scelta 2 |
| Foto nell'avatar | L'autore del Feed ha solo `public_id` e `username`; la foto esiste (TASK-178) ma non arriva | Sì, serve l'API | B |
| Colore nell'avatar | Grigio con l'iniziale, come sul canvas | Contraddice ADR-0293 | Scelta 1 |
| Ordine delle slide e contatore | Il disegno è già primo, con i pallini (TASK-315) | Solo il contatore | **TASK-348 A**, sotto |
| Reazioni | Sei tipi nella scheda aperta (TASK-119); nessun conteggio nel Feed | Sì, serve l'API | B; scelta 3 |
| Commenti | Nella scheda aperta (TASK-120); nessun conteggio nel Feed | Il pulsante in A, il conteggio in B | A + B |
| Condividi | Solo il proprio post a fine corsa (TASK-231, che esclude «il post di un disegno di un altro, dal Feed») | Sì | A; scelta 5 |
| «Corri questo percorso» | Esiste già nella scheda aperta come «Draw it near me» (TASK-313) e «Start» (TASK-307) | Solo il pulsante sulla scheda | A; scelta 4 |
| Miniatura della forma | Sul canvas: nell'angolo delle foto. Non è in 339 B | Sì, solo sulle pagine foto | A |
| «Precisione 82%» | Tolta dall'utente (ADR-0207) | **No, non si fa** | — |
| Statistiche a chip | Una riga di testo, anche sul canvas | Contraddice il canvas | Scelta 6 |
| Mappa 4:3 | 0,62, già più bassa di 4:3 (0,75) | **No**: la scheda crescerebbe | — |
| Pull-to-refresh | C'è, con l'account | No | — |
| Skeleton | Uno spinner. Né TASK-339 né `UI.md` lo prevedono | Sì | B (`FeedScreen`) |
| Stato vuoto | Il Feed vuoto mostra gli esempi (ADR-0127); «Feed senza account» è in 339 C | **No, resta a 339 C** | — |
| Filtri | `GET /feed` non ne ha | **No**: le schede «Tutti» e «Seguiti» di TASK-362 li sostituiscono | TASK-362 |
| Tocco minimo, etichette | `MIN_TAP_SIZE` e `Tap` ci sono | Le voci nuove, e il «…» | A |
| `expo-blur` | Non installato, nativo | **No**: impronta `83793e26` | — |

**Il contatore delle slide lo fa TASK-348 A, non questo task** (confermato
dal Coordinatore il 2026-10-30). Quella parte riscrive il carosello fino a
10 pagine, dove dieci pallini non reggono, e può far sparire il disegno
dalla prima posizione.

## Scoperto strada facendo: la posizione nel Feed

`GET /feed` **manda già** `lat` e `lon` del telefono, non arrotondati, da
TASK-118 (`App.tsx`, `near={start?.point ?? null}`; `api/feed.ts`). Il log
degli accessi toglie la query (`access_log.py`, ADR-0096) e il server non
la tiene. Ma «Your position» in `about/content/*.ts` elenca tre casi (la
partenza di un percorso, una corsa salvata, la ricerca di un posto) e
**il Feed non c'è**. Il testo pubblicato è incompleto oggi, a prescindere
da questo task. Lo chiude **TASK-356**, una PR a sé dopo la #668, deciso dal
Coordinatore: scelta 7.

## Scelte dell'utente

Chiuse il 2026-10-30, una alla volta, con le sue parole.

1. **Colore dell'avatar.** Il brief vuole un colore per utente; ADR-0293
   dice «nient'altro ha colore» e il canvas ha il grigio. Proposta: grigio
   con l'iniziale, la foto quando c'è.
   — *Risposta:* «Grigio, come il canvas».
2. **Inizio e fine.** Il brief vuole un pallino verde e una bandierina;
   ADR-0293 tiene un accento solo. Proposta: pallino e bandierina nel
   colore del testo, con il bordo scuro, distinti dalla forma e non dal
   colore. Segnano gli estremi della traccia tagliata, mai quelli reali:
   nessun testo li chiama «partenza» o «arrivo».
   — *Risposta:* «Segni neutri».
3. **Il cuore.** Il cuore è il super like e vuole un commento (ADR-0193):
   un «mi piace» con un tocco non esiste. Proposta: il pulsante mostra il
   totale e apre la scelta fra le sei reazioni, come nella scheda aperta.
   — *Risposta:* «Apre le sei reazioni».
4. **Il pulsante giallo.** Il brief chiede di aprire «Draw» con la stessa
   forma, cioè «Draw it near me»; il canvas ha «Start», che parte sulla
   traccia dell'altro, spesso lontana. Proposta: «Draw it near me», già
   tradotto, giallo una volta per scheda come vuole ADR-0293.
   — *Risposta:* «Draw it near me».
5. **Condividere il disegno di un altro.** TASK-231 lo escludeva. Proposta:
   «Share» solo sui propri disegni in questo task; quelli degli altri, se
   li vuoi, con un consenso da decidere a parte.
   — *Risposta:* «Solo i miei».
6. **Chip o riga.** Il brief vuole chip con icone; il canvas una riga,
   «9.8 km · 58 min · run». Proposta: la riga del canvas, senza chip; i
   decimali restano quelli di `distanceLabel`, già secondo la lingua.
   — *Risposta:* «Riga come il canvas».
7. **La riga di privacy** (TASK-356). In «Your position», in cinque lingue e
   con la data: «It goes to our server as the start of a route you ask for,
   inside a run you save, with a search for a place, to put the places near
   you first, and, rounded to about 1 km, to show you drawings nearby in the
   Feed.» L'app arrotonda il punto a due decimali prima di mandarlo. Vale
   Sito e OTA di produzione: due sì a parte.
   — *Risposta:* «Sì, approvo».
8. **I testi nuovi.** La data riusa l'età dei commenti («{count} h ago»; in
   italiano «2 h fa»). Quattro testi, in inglese, italiano, tedesco, francese
   e spagnolo: All, Tutti, Alle, Tous, Todos; Friends, Amici, Freunde, Amis,
   Amigos; Mine, Le mie, Meine, Les miennes, Las mías; Reactions, Reazioni,
   Reaktionen, Réactions, Reacciones.
   — *Risposta:* «Sì, approvo». All, Friends e Mine non servono più (TASK-362,
   sotto): resta Reactions.

## Le schede al posto dei filtri

L'utente ha deciso in TASK-362 («Sì, sostituiscono», riferito dal Coordinatore
il 2026-10-30): le schede «Tutti» e «Seguiti» prendono il posto dei filtri e
di `filter`. La parte B tiene foto dell'autore, conteggi e skeleton.

## Cosa fare

Ogni parte ha la sua PR e parte solo col via del Coordinatore.

**Ordine**: su `FeedPost.tsx` 339 B, **355 A**, 348 A app, 336 B; su
`FeedScreen.tsx` e la lente 344 B, **355 B**, 309 B; `Pager.tsx` dopo la
#658; la B dopo la A. Migrazione, se serve: numero dal Coordinatore (0040
riservata, 0041 di TASK-348 A).

**A — La scheda, solo app.** Non tocca `FeedScreen.tsx`.

1. `feed/RouteMap.tsx` (nuovo): mappa, linea, estremi, attribuzione, tolti
   da `FeedPost`; così 348 A e 336 B trovano `FeedPost` più corto.
2. `feed/ActionBar.tsx` (nuovo): commenti e reazioni aprono il disegno;
   «Share» solo sui propri; «Draw it near me» dal `drawingsDoor`, senza
   passare da `FeedScreen`; sugli esempi nessuna barra.
3. `FeedPost`: un titolo solo, «Caldonazzo · 2 h fa», la miniatura sulle
   foto, le etichette.
4. `Pager`: `Hairline` sotto i nomi, quella riga sola.

**B — Conteggi, foto, skeleton, API e app.**

1. `feed.py` e `shared-types`: nell'autore `photo` come in `Person` (128 px),
   `reactions` (totale e la propria) e `comments` sul post, facoltativi: un'app
   di prima non cambia.
   Misurare la pagina prima e dopo: 20 foto da 128 px pesano, e TASK-288 ha
   stretto questo percorso. Se pesano troppo, una rotta per la foto.
2. `FeedScreen`: lo skeleton. La lente sta dove la mette TASK-362, con le
   schede.
3. `ActionBar`: i conteggi. Server solo col sì dell'utente.

## Criteri di accettazione

Parte A:

- [ ] Nessun titolo ripetuto: test su `title` uguale a `what`.
- [ ] La data della corsa in ogni scheda di un membro, nelle cinque lingue.
- [ ] Pallino e bandierina sulla traccia già tagliata, nessun punto nuovo
      mandato o letto.
- [ ] L'attribuzione non è più di una riga, con contrasto AA, e il
      margine `DRAWING_PAD` la tiene fuori dal tracciato.
- [ ] Ogni pulsante nuovo ha almeno `MIN_TAP_SIZE`, `Tap` ed etichetta.
- [ ] Nessun colore a mano, nessuna dipendenza nuova, impronta `83793e26`
      su una copia pulita.
- [ ] Prima e dopo dal simulatore, in scuro e in chiaro, in testa alla PR.
- [ ] Nessuna traccia del punteggio: né a schermo né a voce (ADR-0207).

Parte B:

- [ ] I campi nuovi nel contratto, con le fixture; un'app di
      prima legge il feed come prima.
- [ ] Il tempo e il peso di una pagina, prima e dopo, scritti nella PR.
- [ ] Lo skeleton compare solo durante il primo caricamento.

## File toccati

Questa PR:

```
docs/tasks/TASK-355.md
docs/DECISIONS.md
docs/STATUS.md
docs/INDEX.md
```

Parte A:

```
apps/mobile/src/feed/RouteMap.tsx, RouteMap.test.tsx      (nuovi)
apps/mobile/src/feed/ActionBar.tsx, ActionBar.test.tsx    (nuovi)
apps/mobile/src/feed/FeedPost.tsx, FeedPost*.test.tsx
apps/mobile/src/screens/Pager.tsx
apps/mobile/src/i18n/*.ts
docs/UI.md, docs/STATUS.md, docs/tasks/TASK-355.md
```

Parte B:

```
services/api/shaperoute_api/feed.py, i suoi test
packages/shared-types/src/index.ts, fixtures/feed*.json
apps/mobile/src/api/feed.ts, apps/mobile/src/feed/useFeed.ts
apps/mobile/src/feed/ActionBar.tsx
apps/mobile/src/screens/FeedScreen.tsx
apps/mobile/src/i18n/*.ts
docs/API.md, docs/UI.md, docs/STATUS.md, docs/tasks/TASK-355.md
```

## Fuori scope

- Il punteggio, in qualsiasi forma (ADR-0207).
- La logica del caricamento di `useFeed`.
- Le schede «Tutti» e «Seguiti»: TASK-362.
- Il contatore delle slide e l'ordine: TASK-348 A.
- Lo stato vuoto e il Feed senza account: TASK-339 C.
- Cosa apre la lente: TASK-344 B.
- Confrontare il tracciato con la forma originale: non tutti i post ne
  hanno una, e sarebbe un punteggio senza numero.
- Vibrazione e sfocatura: native, solo con una build e il sì dell'utente.

## Esito

*(a fine task)*
