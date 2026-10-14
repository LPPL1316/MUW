# TASK-285 — Lo stretching dopo la corsa: il promemoria (A) e i cinque esercizi animati (B)

**Stato**: Parte A Done (#504) · Parte B In corso (PR aperta, aspetta il sì dell'utente ai testi)
**Fase**: 4 · **Branch**: `feat/TASK-285-a-stretch-reminder` (A),
`feat/TASK-285-b-stretch-exercises` (B)
**Dipende da**: TASK-113 (la fine della corsa), TASK-172 («Save» e
«Discard»), TASK-209 (la voce nella lingua dell'app), TASK-210 (le cinque
lingue). La parte B entra **dopo** la parte A: si apre dalla sua uscita.
**ADR**: ADR-0247 (una sola per le due parti)

## Obiettivo

Finita la corsa, l'app ricorda di fare stretching e, a chi vuole, mostra
cinque esercizi uno dopo l'altro, ognuno con una figura animata che fa
l'esercizio e un conto alla rovescia, come nell'app bEND. Chi non vuole
salta e arriva a «Your run» come oggi.

## Contesto

Due richieste dell'utente del 2026-10-13, arrivate da due sessioni a un
minuto di distanza; il Coordinatore le ha unite in un task solo, con due
parti, per non fare doppioni:

- sessione «Esercizio con stretching opzionale» → **parte A**: a fine
  corsa l'app dice «Remember to stretch», a schermo e a voce, con «Skip»
  verso «Your run» e l'uscita verso lo stretching;
- sessione «Animazione esercizi stretching post-corsa» → **parte B**:
  «Dopo la corsa, metti l'animazione di cinque esercizi di stretching
  come sull'app bEND».

Su bEND (Bend: Stretching & Flexibility) ogni esercizio ha un disegno
semplice della posizione, un timer a schermo che dice quanto tenere e un
suono che avvisa quando passare al prossimo; chi lo chiede vede
l'animazione di una persona che entra nella posizione. Qui disegni e
testi sono **nostri**, non copiati da bEND.

Oggi la corsa finisce così (`UI.md` «La fine della corsa»): «Stop»
tenuto, o «Finish» all'arrivo, apre la schermata di fine corsa sulla
mappa, con «Your run», la riga «4.0 km · 32 min» e, con un account,
«Save» e «Discard» sotto la scheda (`FinishCard` in
`src/screens/FinishScreen.tsx`, `FreeFinishCard` in `FreeRunScreen.tsx`,
`RunEnd` in `src/activities/RunEnd.tsx`, montati da `App.tsx`). Niente
in mezzo fra la corsa e quella schermata: il bivio della parte A ci entra
prima di «Your run».

Regole date dal Coordinatore per tutte e due le parti:
- **«come bEND» è l'idea**, non il materiale: figure, animazioni, nomi e
  testi degli esercizi sono nostri, niente copiato o ricalcato da bEND
  (diritti d'autore e marchio);
- **testi nuovi e voce nelle cinque lingue solo con il sì dell'utente**:
  si mostrano prima del merge; la riga di salute, breve e neutra («Stop
  if it hurts.»), va approvata dall'utente con gli altri testi;
- **dove si innesta**: la fine corsa la toccano già altri task (TASK-208
  B, la pagina «Data» di TASK-268). Il punto esatto è nei «File toccati»;
  prima di partire il Coordinatore ricontrolla che sia libero;
- **prima di toccare i file della fine corsa** (`App.tsx`,
  `FinishScreen.tsx`, `FreeRunScreen.tsx`, `RunEnd.tsx`) si manda
  l'elenco al Coordinatore, che lo ricontrolla;
- le due parti si accordano direttamente; solo app, **non entrano nella
  1.0** in revisione da Apple.

## Contesto da leggere

- `docs/UI.md` «La fine della corsa» (la schermata di oggi e cosa fa ogni
  tasto) e «La voce» (come l'app parla, TASK-209)
- ADR-0093 (la fine della corsa), ADR-0147 (l'animazione d'avvio: il
  modello di un'animazione senza dipendenze nuove, con il tempo tenuto da
  un timer e il test con i timer finti), ADR-0174 (il logo dopo «Save»)
- `apps/mobile/src/intro/LaunchIntro.tsx` (come si anima con `Animated`
  e View sottili girate, senza `react-native-svg` né Lottie)
- `docs/TESTING.md` (jest: le animazioni finiscono all'istante, il tempo
  si fa passare a mano)

## Parte A — Il promemoria a fine corsa

*(sessione «Esercizio con stretching opzionale», branch
`feat/TASK-285-a-stretch-reminder`)*

Dopo «Stop» tenuto (o «Finish» all'arrivo), con una traccia da mostrare,
al posto della scheda «Your run» compare una scheda **«Remember to
stretch»** (nuovo `src/screens/StretchReminder.tsx`); la voce dice la
frase una volta, con `say()` di `runAudio`, nella lingua dell'app
(TASK-209). Due pulsanti: **«Skip»** → «Your run» com'è oggi;
**«Stretch»** → l'uscita verso la parte B. Vale per la corsa con percorso
e per quella libera. Uno «Stop» prima della prima posizione e la corsa
riaperta dopo 2 ore (TASK-272) non chiedono niente.

**Contratto fra A e B**, così partono in parallelo: in `App.tsx` A tiene
uno stato `stretchAsked: boolean` e la scheda prende `onSkip` e
`onStretch`. Nella PR di A, `onStretch` fa come `onSkip` (toglie la scheda
e mostra «Your run»). Nella PR di B, `onStretch` apre la schermata degli
esercizi, che al suo termine (o al suo «Done»/«Skip») torna a «Your run»
chiamando la stessa chiusura.

Cosa fare (A):
1. `src/screens/StretchReminder.tsx` e il suo test: la scheda, i due
   pulsanti, la frase detta una volta.
2. `App.tsx`: poche righe in `onEndRun`/`onStopFreeRun` e nella scelta
   della scheda (elenco al Coordinatore prima di toccarlo).
3. Tre testi nuovi in `i18n/{de,es,fr,it}.ts`, dopo il sì dell'utente.
4. `docs/UI.md` «La fine della corsa»; **ADR-0247 in `DECISIONS.md` la
   scrive A**, in una voce con le due parti (B aggiunge la sua riga se
   serve); `STATUS.md`.

**Testi approvati dall'utente il 2026-10-13** («sì, i testi vanno bene»,
detto al Coordinatore): «Remember to stretch» / «Stretch» / «Skip» nelle
cinque lingue (it «Ricordati di fare stretching» / «Stretching» /
«Salta», de «Denk ans Dehnen» / «Dehnen» / «Überspringen», es «Recuerda
estirar» / «Estirar» / «Omitir», fr «Pensez à vous étirer» / «S'étirer»
/ «Passer») e la frase della voce, la stessa col punto. La frase detta
dalla voce sta nel frasario (`src/voice/`), non nei testi dell'app.
PR di A: #504 (dopo la #500).

## Parte B — I cinque esercizi animati

### Cosa si vede

1. Una schermata a tutto schermo, sopra la mappa, con lo sfondo dell'app
   (i colori dai token, niente colore scritto a mano). In alto il nome
   dell'esercizio e, piccola, la frase di come si fa («Pull your heel
   toward your glutes. Keep your knees together.»).
2. Al centro la **figura**: una persona stilizzata che dalla posizione in
   piedi entra nella posizione dell'esercizio in ~0,8 s e la tiene, con un
   leggero respiro (oscillazione piccola e lenta) finché il tempo scorre.
   Costruita con View sottili girate e `Animated`, come il cuore
   dell'avvio (ADR-0147): **nessuna dipendenza nuova**. Ogni esercizio è
   un insieme di angoli delle articolazioni (testa, busto, braccia,
   gambe) in `poses.ts`; l'animazione interpola fra la posa in piedi e
   quella dell'esercizio.
3. Sotto la figura il **conto alla rovescia** grande («0:30»), una barra
   che si svuota e, piccolo, «2 of 5». Il tempo lo tiene un timer, non
   l'animazione (sotto jest le animazioni finiscono all'istante).
4. Alla fine del tempo un **suono breve** e si passa da sé al prossimo.
   Il suono è **nostro**: `assets/stretch/ding.wav`, un «ding» di 0,35 s
   scritto da `tools/stretch_chime.py` con la sola libreria standard di
   Python (due sinusoidi che si spengono), suonato con `expo-audio`;
   niente preso da bEND né da librerie di suoni. L'alternativa, la voce
   che dice il nome dell'esercizio seguente, è da decidere con l'utente
   (vedi sotto). Gli
   esercizi su un lato solo hanno due tempi: a metà la voce dice «Switch
   sides» e la figura si gira.
5. In fondo **«Skip»** (va a «Your run») e, nell'ultimo esercizio,
   **«Done»**; **«Pause»** ferma il tempo e la figura resta in posizione.
   La frase di prudenza, piccola, sotto la prima schermata: «Stop if it
   hurts.» (nessun consiglio medico oltre questo).
6. Finito l'ultimo esercizio, «Your run» come oggi: «Save», «Discard»,
   il modulo del disegno, niente di diverso da prima.
7. Lo schermo resta acceso (`expo-keep-awake`, già usato in corsa). Con il
   lettore di schermo: nome dell'esercizio, come si fa, e il tempo che
   resta ogni 10 s.

### I cinque esercizi (proposta, da confermare con l'utente)

I classici del dopo corsa, in ordine dalla gamba alla schiena; ognuno con
una posa che una figura di dieci segmenti sa fare:

| # | Nome | Lati | Tempo | Posa |
|---|------|------|-------|------|
| 1 | Quad stretch (quadricipite) | due | 20 s + 20 s | in piedi, tallone al gluteo, mano sulla caviglia |
| 2 | Hamstring stretch (posteriore coscia) | due | 20 s + 20 s | in piedi, gamba avanti tesa sul tallone, busto in avanti |
| 3 | Calf stretch (polpaccio) | due | 20 s + 20 s | affondo lungo, mani avanti come al muro, tallone dietro a terra |
| 4 | Hip flexor stretch (flessori dell'anca) | due | 20 s + 20 s | affondo con il ginocchio dietro a terra, bacino avanti |
| 5 | Glute stretch (gluteo, «figure four») | due | 20 s + 20 s | in piedi su una gamba, caviglia sul ginocchio, come seduti |

In tutto 3 min 20 s. Tempi e ordine sono una proposta; i nomi in inglese
nell'interfaccia, tradotti nelle cinque lingue con il sì dell'utente.

### Cosa fare

1. `src/stretch/exercises.ts`: i cinque esercizi (nome, come si fa, lati,
   secondi per lato, la posa).
2. `src/stretch/poses.ts` e `src/stretch/Figure.tsx`: la figura e le pose;
   `Figure` prende una posa e la mostra, e passa da una posa all'altra con
   `Animated`.
3. `src/stretch/StretchScreen.tsx`: la schermata, il timer, «Pause»,
   «Skip», «Done», il suono o la voce fra un esercizio e l'altro.
4. Montarla da `onStretch` della scheda di A (contratto sopra): poche
   righe in `App.tsx`, e al termine la stessa chiusura che porta a «Your
   run» (elenco al Coordinatore prima di toccarlo).
5. Testi in `i18n/{it,de,es,fr}.ts` (solo voci nuove), mostrati all'utente
   prima del merge.
6. Test deterministici con i timer finti: la sequenza dei cinque, il
   cambio lato, «Skip» e «Done» chiamano l'uscita, «Pause» ferma il
   tempo, il lettore di schermo riceve nome e tempo.
7. `docs/UI.md` «La fine della corsa»: la sottosezione «Lo stretching»;
   la riga di B nella ADR-0247 scritta da A; `STATUS.md`.

### Da chiedere all'utente (una per volta, con la proposta pronta)

- **Quali cinque esercizi** e quanto tempo l'uno: proposta la tabella
  sopra (20 s per lato, 3 min 20 s in tutto).
- **Fra un esercizio e l'altro**: un suono breve (proposta) o la voce che
  dice il nome del prossimo. In corsa la voce c'è già: con la voce i
  testi vanno nelle cinque lingue.
- **La figura**: stilizzata, fatta dall'app, nei colori dei token
  (proposta, nessuna dipendenza nuova). L'alternativa, disegni o
  animazioni Lottie, è una dipendenza nuova e va chiesta prima
  (ADR-0147 le ha già scartate per l'avvio).

## Criteri di accettazione

Parte A:
- [ ] Dopo «Stop» tenuto o «Finish», con una traccia, la scheda «Remember
      to stretch» al posto di «Your run», e la voce la dice una volta.
- [ ] «Skip» porta a «Your run» com'è oggi; «Stretch» chiama `onStretch`
      (nella PR di A fa lo stesso di «Skip»).
- [ ] Niente scheda con uno «Stop» prima della prima posizione né con la
      corsa riaperta dopo 2 ore.
- [ ] Vale per la corsa con percorso e per quella libera.
- [ ] Tre testi nelle cinque lingue, approvati dall'utente; test
      deterministici verdi.

Parte B:
- [ ] Da «Stretch» della scheda di A si apre la schermata con il primo
      esercizio, la figura animata, il nome, come si fa, il tempo.
- [ ] Finito il tempo, si passa da sé al prossimo; con due lati, a metà
      «Switch sides» e la figura si gira; dopo il quinto, «Your run».
- [ ] «Skip» porta a «Your run» da qualunque esercizio; «Pause» ferma il
      tempo e «Resume» lo riprende.
- [ ] Nessuna dipendenza nuova in `apps/mobile/package.json`.
- [ ] Nessun colore scritto a mano: tutto da `src/theme/tokens.ts`.
- [ ] Testi nelle cinque lingue, approvati dall'utente.
- [ ] Test deterministici verdi (timer finti), CI verde.
- [ ] `UI.md`, `DECISIONS.md` (ADR-0247), `STATUS.md` aggiornati.

## File toccati

Parte A:
```
apps/mobile/App.tsx   (poche righe: onEndRun/onStopFreeRun, la scelta della scheda)
apps/mobile/src/screens/StretchReminder.tsx, StretchReminder.test.tsx   (nuovi)
apps/mobile/src/i18n/it.ts, de.ts, es.ts, fr.ts   (tre voci nuove)
apps/mobile/src/voice/phrasebook.ts   (campo `stretch`)
apps/mobile/src/voice/en.ts, de.ts, it.ts, es.ts, fr.ts   (una riga l'uno)
apps/mobile/__tests__/AppFreeRun.test.tsx, AppReopenRun.test.tsx   (premono «Skip» dopo «Stop»)
docs/UI.md, docs/DECISIONS.md (ADR-0247), docs/STATUS.md, docs/tasks/TASK-285.md
```

Parte B (file nuovi, più i minimi esistenti; entra dopo A):
```
apps/mobile/src/stretch/exercises.ts
apps/mobile/src/stretch/poses.ts
apps/mobile/src/stretch/Figure.tsx
apps/mobile/src/stretch/StretchScreen.tsx
apps/mobile/src/stretch/*.test.tsx
apps/mobile/src/i18n/it.ts, de.ts, es.ts, fr.ts   (solo voci nuove)
apps/mobile/App.tsx   (poche righe: onStretch apre la schermata; elenco al Coordinatore prima)
docs/UI.md, docs/DECISIONS.md (la riga di B), docs/STATUS.md, docs/tasks/TASK-285.md
```
**Il punto esatto dove si apre**: in `App.tsx`, dentro `MapScreen`, dove
oggi si scelgono `FreeFinishCard` (corsa libera, riga ~953) e
`FinishCard` (corsa con percorso, riga ~1018) sopra la mappa. A mette lì
la sua scheda `StretchReminder` al loro posto finché `stretchAsked` è
falso; B, da `onStretch` di quella scheda, monta `StretchScreen` a tutto
schermo sopra `MapScreen`, accanto alle schede, e al termine chiama la
stessa chiusura di «Skip». `RunEnd` (TASK-172, TASK-208 B) e la pagina
«Data» (TASK-268) non si toccano.

`App.tsx` e i quattro file `i18n` sono di tutte e due le parti: B si
riallinea a `main` dopo il merge di A. Nessuna delle due tocca i file
dell'altra (`StretchReminder.*` è di A, `src/stretch/` è di B).

## Fuori scope

- Routine diverse per sport (bici, pagaia): gli stessi cinque per tutti.
- Scegliere o riordinare gli esercizi, salvare «fatto», serie, contare le
  volte: niente dati, niente API, niente server.
- Lo stretching prima della corsa.
- Disegni o animazioni da librerie esterne (Lottie, `react-native-svg`).
- Consigli medici oltre «Stop if it hurts.».
- La 1.0 in revisione da Apple: questo entra nella versione dopo.

## Esito

*(si compila a fine task)*
