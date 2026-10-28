# TASK-317 — L'attesa in «Draw»: un testo da corridore e i disegni del Feed

**Stato**: In corso
**Fase**: 4 · **Branch**: `feat/TASK-317-draw-waiting`

## Obiettivo

Mentre «Draw» cerca il percorso di una forma, di una parola o di
un'immagine, la scheda non dice più «Waiting for the API…» e, sotto la
barra, si possono scorrere i disegni del Feed.

Richiesta dell'utente del 2026-10-28: «mentre carica, cambiare la
descrizione "waiting for API" e magari fai fare un giochino, fai vedere i
disegni, carica un video figo». Fra quattro proposte (solo testi; testi e
disegni; testi e un gioco «Guess the shape»; testi e la forma che si
disegna da sola) l'utente ha scelto **testi e disegni**. Numeri dal
Coordinatore lo stesso giorno: TASK-317, ADR-0277.

Una seconda sessione ha scritto, per lo stesso task, la versione con il
gioco (PR #602). L'utente ha confermato due volte «testi e disegni»: in
questa chat e in quella del Coordinatore («Solo testi + disegni»). La #602
è stata chiusa senza merge, e il suo branch `feat/TASK-317-waiting-card`
resta su origin.

**Testi approvati** dall'utente il 2026-10-28, in questa chat: «Sì, i tre
testi «Warming up» nelle cinque lingue vanno bene.»

## Contesto da leggere

- `docs/UI.md`, la tabella «Stato dell'API | Il pannello dice» (le attese
  di «Draw route»).
- `docs/DECISIONS.md` ADR-0050 (la barra a fasi), ADR-0127 (i disegni di
  esempio del Feed).
- `apps/mobile/src/explore/WhileDrawing.tsx` (TASK-163: «MEANWHILE, FROM
  THE FEED» in «Explore»).

## Le condizioni del Coordinatore (2026-10-28)

1. `RoutePanel.tsx` lo tocca anche TASK-311 B, solo in `RouteOutcome`
   (la riga sotto il percorso e sotto l'errore). Qui si toccano soltanto
   `waitingText` e il ramo `"waiting"`: niente codice spostato, niente
   riformattazioni. Chi arriva secondo si riallinea su `main`.
2. La #586 (i quattro i18n e `UI.md`) entra prima: `main` unito prima di
   dire la PR pronta. Nei file i18n le righe nuove vanno in fondo.
3. I disegni vengono solo da `SAMPLE_FEED`, già nell'app: nessuna
   richiesta di rete in più, né al server né per le immagini delle mappe.
4. I testi nuovi nelle cinque lingue vogliono il sì dell'utente. Impronta
   iOS `83793e26` (la misura il Coordinatore). Nessuna dipendenza nuova.
5. «#NNN pronta» al Coordinatore quando la CI è verde: mergia lui.

## Cosa fare

1. In `waitingText`, le fasi `sending` e `queued` dicono
   «Warming up: {name}…» (`{name}` come nelle fasi dopo: «Heart»,
   «“CIAO”») e, per un'immagine, «Warming up: the picture…». Le altre fasi
   restano come sono.
2. Componente nuovo `WhileRouting`: dopo 3 s di attesa, sotto la barra,
   l'etichetta «MEANWHILE, FROM THE FEED» (già tradotta per «Explore») e
   una fila da scorrere di lato con sei disegni di `SAMPLE_FEED`: la linea
   su fondo mappa, come le miniature di «Explore», il titolo e
   «Moon · 4.9 km · 27 min». Niente immagini della mappa (condizione 3).
   Con «Paddle» i disegni sull'acqua, altrimenti quelli di corsa. Le
   schede non si toccano: aprirne una lascerebbe la ricerca a metà.
3. Il ramo `"waiting"` di `RoutePanel` mostra `WhileRouting` sotto
   `LoadingBar`.
4. Le traduzioni dei due testi nuovi in `it`, `de`, `es`, `fr`, in fondo.
5. Test deterministici del componente e dei testi; `App.test.tsx` cerca il
   testo nuovo al posto di «Waiting for the API…».
6. `docs/UI.md`: la riga della tabella e due righe sui disegni.

## Criteri di accettazione

- [ ] Toccato «Draw route», la scheda dice «Warming up: Heart…» (per una
      parola «Warming up: “CIAO”…», per un'immagine «Warming up: the
      picture…») finché l'API non dice un'altra fase; «Waiting for the
      API…» non compare più.
- [ ] Prima di 3 s la fila dei disegni non c'è; dopo 3 s ci sono
      l'etichetta e fino a sei schede, ciascuna con titolo e dati.
- [ ] Con «Paddle» le schede sono solo disegni sull'acqua, con la corsa
      solo disegni di corsa.
- [ ] La fila non chiede nulla alla rete (nessuna `fetch`, nessuna mappa
      fotografata): un test lo controlla.
- [ ] Arrivato il percorso, o con «Cancel», la fila sparisce con la
      scheda dell'attesa.
- [ ] I due testi nuovi sono tradotti nelle quattro lingue e
      `tables.test.ts` è verde.
- [ ] `npm run lint`, `typecheck`, `test`, `format:check` verdi.

## File toccati

```
apps/mobile/src/route/RoutePanel.tsx
apps/mobile/src/route/WhileRouting.tsx          (nuovo)
apps/mobile/src/route/WhileRouting.test.tsx     (nuovo)
apps/mobile/__tests__/App.test.tsx
apps/mobile/src/i18n/it.ts
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/es.ts
apps/mobile/src/i18n/fr.ts
docs/UI.md
docs/STATUS.md
docs/DECISIONS.md
docs/tasks/TASK-317.md                          (nuovo)
```

## Fuori scope

- Il gioco «Guess the shape» e la forma che si disegna da sola: proposte
  non scelte.
- Un video: l'app non ha un lettore, servirebbe una dipendenza nativa e
  una build nuova.
- I disegni dei membri dal server, le immagini delle mappe sotto le linee:
  vorrebbero la rete (condizione 3).
- Toccare una scheda per aprirne il percorso.
- Le attese di «Explore», della lettura dell'AI e della mappa.

## Esito

_(a fine task)_
