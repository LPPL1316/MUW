# TASK-317 — L'attesa in «Draw»: frasi che girano, e la penna, i disegni o un gioco

**Stato**: In corso
**Fase**: 4 · **Branch**: `feat/TASK-317-waiting-card`

## Obiettivo

Mentre «Draw» cerca il percorso di una forma, di una parola o di
un'immagine, la scheda non dice più «Waiting for the API…»: una frase
nuova ogni 3 s, fra frasi da corridore e consigli veri dell'app. Dopo 3 s,
sotto la barra, una di tre cose scelta a caso: la penna che traccia i
disegni del Feed, i disegni del Feed in fila, o il minigioco «Guess the
shape».

Richiesta dell'utente del 2026-10-27/28: «mentre carica, cambiare la
descrizione "waiting for API" e magari fai fare un giochino, fai vedere i
disegni, carica un video figo […] io farei a random tutte e tre le cose».
Proposta in `out/attesa-draw/proposta.md` (checkout principale, ignorato da
git). Scelta dell'utente, nella sessione «Miglioramenti sezione draw in
caricamento» (local_798e5630): «Sì: frasi a rotazione con i consigli, poi a
caso tra penna, disegni e Guess the shape. Testi approvati.» Numeri dal
Coordinatore lo stesso giorno: TASK-317, ADR-0277.

La stessa richiesta è arrivata anche alla sessione «Caricamento con
animazioni e giochi» (local_dc5d6fe3), dove l'utente ha scelto solo testi e
disegni, con gli stessi numeri e lo stesso worktree. Il Coordinatore ha
detto a questa sessione di andare avanti e chiede all'utente quale tenere;
il lavoro dell'altra sessione resta, non committato e intatto, in
`.claude/worktrees/TASK-317` (branch `feat/TASK-317-draw-waiting`). Questo
task file vale per il branch `feat/TASK-317-waiting-card`.

## Contesto da leggere

- `docs/UI.md`, «Chiedere un percorso» (la tabella «Stato dell'API | Il
  pannello dice»).
- `docs/DECISIONS.md` ADR-0050 (la barra a fasi), ADR-0127 (i disegni di
  esempio del Feed), ADR-0277.
- `apps/mobile/src/explore/WhileDrawing.tsx` (TASK-163: «MEANWHILE, FROM
  THE FEED» in «Explore»), `apps/mobile/src/explore/RouteThumb.tsx`.

## Le condizioni del Coordinatore (2026-10-28)

1. `RoutePanel.tsx`: solo il ramo `"waiting"` e `waitingText`; TASK-311 B
   tocca `RouteOutcome` e una prop nuova. Niente codice spostato, niente
   riformattazioni; chi arriva secondo si riallinea.
2. La #586 entra prima (è entrata: il branch parte da `e7c06578`, che la
   contiene). Negli i18n le righe nuove in fondo.
3. Niente rete durante l'attesa: penna, fila e gioco usano solo
   `SAMPLE_FEED`, già nell'app. Il record del gioco sul telefono, con
   `expo-file-system` come gli altri file dell'app. Nessuna dipendenza nuova.
4. La scheda non deve rallentare il motore sul telefono (TASK-214): niente
   animazioni pesanti sul thread JS mentre lui calcola. In un test o
   misurato, e scritto qui (sotto, «Il motore sul telefono»).
5. Tutti i testi nelle cinque lingue qui e nella PR; al merge il
   Coordinatore li confronta con la proposta approvata. Impronta iOS
   `83793e26` (la misura lui).
6. «#NNN pronta» al Coordinatore a CI verde: mergia lui.

## Cosa fare

1. `waitingLines.ts`: le frasi e i consigli, in un ordine estratto una
   volta per attesa; un consiglio ogni due frasi, mai per primo né accanto
   a un altro. La frase della fase («Drawing a 5 km heart…», «First time
   here: studying the map…») viene per prima e torna ogni tre; inviata o in
   coda non ne ha, e girano solo le altre.
2. `RoutePanel.tsx`: `waitingText` non dice più «Waiting for the API…»
   (inviata o in coda: `null`) e la zona da scaricare dice «First time
   here: studying the map…»; nel ramo `"waiting"` `WaitingLine` al posto
   del testo fisso, e `WaitingCard` sotto la barra.
3. `WaitingCard.tsx`: dopo 3 s di attesa (`CARD_AFTER_MS`) una delle tre,
   estratta a caso per attesa: `PenShow` (la penna traccia un disegno in
   6 s, lo tiene 2 s, poi il successivo; sotto il titolo, chi, dove e
   quanto), `DrawingsRow` (le miniature in fila che scorrono da sole ogni
   2,5 s finché non le si tocca), `GuessShape`. I disegni sono quelli di
   `SAMPLE_FEED` dritti e in un pezzo solo, come li disegna una miniatura.
   Arrivato il percorso, o un errore, la scheda sparisce con l'attesa.
4. `PenDrawing.tsx`: i segmenti di `thumbSegments`, i primi `share`, con
   il punto della penna; nessun SVG.
5. `GuessShape.tsx` + `guessRounds.ts`: la penna traccia un disegno in
   8 s; tre bottoni con i nomi delle forme (quella giusta e due altre fra
   quelle dei disegni); giusta subito 100 punti, 10 in meno ogni decimo
   tracciato, mai meno di 10; sbagliata 0 e «It was: Heart». Dopo 1,5 s il
   disegno successivo. Il record (`guess-shape-best.json`) resta sul
   telefono.
6. Test deterministici: il caso viene da un `random` dato dai test.

## Il motore sul telefono (condizione 4)

Il motore gira in Pyodide dentro la WebView nascosta di
`PhoneEngineView` (TASK-214), non nel JavaScript dell'app: la scheda non lo
ferma, ma divide con lui la CPU, e i messaggi fra WebView e app passano dal
thread JS. Quando il percorso può essere calcolato sul telefono
(`phoneFirst`: forma o parola a piedi fino a 8 km, in bici fino a 30 km),
la penna avanza ogni 250 ms (`LIGHT_TICK_MS`, il ritmo della barra di
caricamento, che gira già durante il calcolo) invece che ogni 80 ms; la
fila dei disegni scorre in nativo e non ridisegna niente.

`WaitingCard.test.tsx` lo controlla: con una richiesta da telefono la
scheda fa al massimo 4 aggiornamenti al secondo (penna e gioco), la fila
0. Misura sul Mac, sotto jest (React in sviluppo, quindi più lento che sul
telefono), 20 s di attesa a passi di 20 ms:

| Scheda | Aggiornamenti/s | ms ognuno | ms di JS al secondo |
|---|---|---|---|
| penna, richiesta da telefono | 4,0 | 0,84 | 3,4 |
| penna, richiesta al server | 12,5 | 0,23 | 2,9 |
| gioco, richiesta da telefono | 4,0 | 0,34 | 1,4 |
| fila dei disegni | 0 | 0 | 0 |

Meno dello 0,5 % del thread JS. Non misurato su un iPhone con il motore
che calcola davvero: serve una zona salvata sul telefono.

## I testi (cinque lingue)

Nuovi; i primi dieci sono nella proposta approvata («Testi approvati»), gli
ultimi tre sono le parole del gioco, che la proposta descriveva senza
scriverle: vogliono il sì dell'utente.

| EN | IT | DE | FR | ES |
|---|---|---|---|---|
| Lacing up the shoes… | Allacciando le scarpe… | Die Schuhe werden geschnürt… | On lace les chaussures… | Atando las zapatillas… |
| Asking the streets for directions… | Chiedendo strada alle vie… | Die Straßen werden nach dem Weg gefragt… | On demande le chemin aux rues… | Preguntando el camino a las calles… |
| Sharpening the pencil… | Temperando la matita… | Der Bleistift wird gespitzt… | On taille le crayon… | Afilando el lápiz… |
| Looking for the right corners… | Cercando gli angoli giusti… | Die richtigen Ecken werden gesucht… | On cherche les bons angles… | Buscando las esquinas justas… |
| Counting the crossroads… | Contando gli incroci… | Die Kreuzungen werden gezählt… | On compte les carrefours… | Contando los cruces… |
| Tracing “{word}” through town… | Tracciando «{word}» in città… | „{word}“ wird durch die Stadt gezogen… | On trace « {word} » dans la ville… | Trazando «{word}» por la ciudad… |
| First time here: studying the map… | Prima volta qui: sto studiando la mappa… | Zum ersten Mal hier: Die Karte wird studiert… | Première fois ici : on étudie la carte… | Primera vez aquí: estudiando el mapa… |
| Tip: you can move the start on the map. | Consiglio: puoi spostare la partenza sulla mappa. | Tipp: Du kannst den Start auf der Karte verschieben. | Astuce : tu peux déplacer le départ sur la carte. | Consejo: puedes mover la salida en el mapa. |
| Tip: a tilted shape often finds more roads. | Consiglio: una forma inclinata trova spesso più strade. | Tipp: Eine geneigte Form findet oft mehr Straßen. | Astuce : une forme inclinée trouve souvent plus de rues. | Consejo: una forma inclinada suele encontrar más calles. |
| Guess the shape | Indovina la forma | Errate die Form | Devine la forme | Adivina la forma |
| Score {score} · Best {best} | Punti {score} · Record {best} | Punkte {score} · Rekord {best} | Score {score} · Record {best} | Puntos {score} · Récord {best} |
| Right! +{points} | Giusto! +{points} | Richtig! +{points} | Bravo ! +{points} | ¡Bien! +{points} |
| It was: {shape} | Era: {shape} | Es war: {shape} | C'était : {shape} | Era: {shape} |

Il punto finale dei due consigli è aggiunto rispetto alla proposta, come le
altre frasi intere dell'app. Riusati senza cambiarli: «MEANWHILE, FROM THE
FEED» (TASK-163) e i nomi delle forme (`shapeNames.ts`). Titoli, nomi e
città dei disegni sono quelli di `sampleFeed.json`, come nel Feed.

Tolti, perché nessuno li mostra più: «Waiting for the API…» e
«Downloading map data for this area…».

## Criteri di accettazione

- [ ] Inviata o in coda, la scheda non dice «API»: una frase della lista,
      e una nuova ogni 3 s.
- [ ] Nel calcolo «Drawing a 5 km heart…» viene per prima e torna ogni tre
      frasi; la zona da scaricare dice «First time here: studying the map…».
- [ ] Dopo 3 s di attesa, e non prima, la penna, la fila o il gioco; quando
      arriva il percorso la scheda non c'è più.
- [ ] Il gioco dà 100 punti alla risposta giusta subito, 50 a metà
      disegno, 0 a quella sbagliata e dice qual era; il record resta fra
      un'attesa e l'altra.
- [ ] Nessuna richiesta di rete dalla scheda (test).
- [ ] Con una richiesta da telefono al massimo 4 aggiornamenti al secondo
      (test).
- [ ] Tutti i testi in cinque lingue (`tables.test.ts`); impronta iOS
      `83793e26`.

## File toccati

```
apps/mobile/src/route/RoutePanel.tsx
apps/mobile/src/route/waitingLines.ts
apps/mobile/src/route/waitingLines.test.ts
apps/mobile/src/route/WaitingCard.tsx
apps/mobile/src/route/WaitingCard.test.tsx
apps/mobile/src/route/PenDrawing.tsx
apps/mobile/src/route/GuessShape.tsx
apps/mobile/src/route/GuessShape.test.tsx
apps/mobile/src/route/guessRounds.ts
apps/mobile/src/route/guessRounds.test.ts
apps/mobile/src/i18n/it.ts
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/fr.ts
apps/mobile/src/i18n/es.ts
apps/mobile/__tests__/App.test.tsx
apps/mobile/__tests__/AppBike.test.tsx
docs/tasks/TASK-317.md
docs/STATUS.md
docs/DECISIONS.md
docs/UI.md
```

`guessShape.ts` della richiesta al Coordinatore è diventato
`guessRounds.ts`: sul Mac `GuessShape.tsx` e `guessShape.ts` sono lo stesso
nome per TypeScript.

## Fuori scope

- Un video vero (mp4): serve una libreria nativa nuova, quindi una build
  nativa.
- L'anteprima della forma chiesta disegnata dalla penna (la «d» della
  proposta): dopo, se l'utente la vuole.
- La stessa scheda in «Explore», che ha già i disegni del Feed
  (`WhileDrawing`).
- Disegni scaricati dal server per la scheda: solo `SAMPLE_FEED`.

## Esito

*(si compila a fine task)*
