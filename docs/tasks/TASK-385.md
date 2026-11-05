# TASK-385 — «Gym» 🏋️: l'allenamento in palestra, senza percorso

**Stato**: In corso · proposta in `main` (#766, #796); parte A (API e
database) in PR; ogni parte dopo la sua lista dei file al Coordinatore
**Fase**: 5 · **Branch**: `docs/TASK-385-gym-proposal` (documenti); il
codice `feat/TASK-385-a-…`
**Dipende da**: la #758 (TASK-375 B2), TASK-376 B2 e B3 (il registro degli
sport) per il codice; TASK-345 C per il battito; TASK-348 C / TASK-336 per i
video
**ADR**: ADR-0327 (proposto) · numeri dal Coordinatore il 2026-11-04

## Obiettivo

In MuW si sceglie «Gym» come sport, si avvia una sessione, si scrivono gli
esercizi serie per serie con un timer di recupero, la si ferma. Si vedono
tempo, calorie e (quando c'è) il battito con le zone. La sessione si
pubblica nel Feed come un post **senza mappa**: foto, testo, numeri,
esercizi, commenti, reazioni, condivisione. I pesi sbloccano figure e c'è
una classifica mensile per esercizio. Con il sì a Salute la sessione va in
Apple Salute / Health Connect come allenamento di forza.

## Contesto da leggere

- `DECISIONS.md` ADR-0327 (questo task), ADR-0319 (Record only), ADR-0318
  (corpo, calorie, zone), ADR-0301 (composer), ADR-0281 (Salute), ADR-0320
  (registro degli sport), ADR-0292 (video nei post)
- `docs/sports/gym.md`: cosa registra, il catalogo, le scale dei traguardi
- `tasks/TASK-345.md` (il battito da Salute), `CONCORSI.md` (Winner)

## Com'è oggi (main `5b78f09d`)

1. **Il server vuole una traccia**: `runs.track` è `NOT NULL` (0003) e un
   disegno visibile deve averla (`visibility = 'only_me' OR track IS NOT
   NULL`, 0014). Allargare il CHECK di `activity`, come per lo sci, non basta.
2. **Le app vecchie scartano la pagina intera**: `isDrawing` vuole
   `track_preview` come linea e `isDrawingsPage` usa `every`. La B0 di
   TASK-375 salva da un'attività sconosciuta, non da una linea che manca;
   `isDrawingDetail` vuole `track`.
3. **«Record only» registra col GPS** (TASK-220); la palestra no.
4. **Calorie** (ADR-0318): MET × 0,0175 × peso × minuti, meno il riposo;
   dati del corpo solo sul telefono.
5. **Battito**: MuW non lo legge ancora. TASK-345 C lo legge da Salute a
   sessione finita; il battito in tempo reale dall'orologio è nativo, quindi
   1.0.2 (Coordinatore, 2026-11-04).
6. **Salute**: il tipo di allenamento non è un permesso; un allenamento di
   forza non chiede permessi nuovi.
7. **Notifiche locali e vibrazione** sono già nella build 1.0.1:
   `expo-notifications` (plugin in `app.json`, collegato), `expo-haptics`
   (ADR-0281, aggiunta del 2026-11-02), `expo-keep-awake`, `expo-audio`. Il
   timer di recupero resta solo JS.

## Scelte dell'utente (2026-11-04, una alla volta)

1. **Nome**: «Sì, Gym 🏋️». Gym · Palestra · Fitnessstudio · Salle de sport ·
   Gimnasio. Nella scelta dello sport con gli altri; «Draw» ha il solo
   «Start workout»; non nella lista «Record only», che registra col GPS.
2. **Calorie senza battito**: «Stima MET sempre». Visibili durante e alla
   fine; col battito si passa alla stima dal battito.
3. **Esercizi**: «Anche esercizi ora» (non in un task dopo). Poi:
   «inserisci tutti i macchinari possibili, tapis roulant» → catalogo
   completo con le macchine cardio; quattro tipi di serie (carico, corpo
   libero, a tempo, cardio).
4. **Come si scrivono**: «Sì, così». «+ Exercise» apre il catalogo per
   gruppo con ricerca e nome libero; le serie si scrivono durante la
   sessione con i campi del loro tipo; «Same again» copia la serie di prima;
   tutto si corregge prima di «Save».
5. **Esercizi nel post**: «Visibili, nascondibili». Salvati sul server;
   l'elenco nel post; interruttore «Show exercises» acceso.
6. **Al posto del disegno**: «Prima foto, se no riquadro». Senza foto, un
   riquadro giallo MuW fatto dall'app (🏋️, tempo, kcal, battito medio,
   esercizi principali), che è anche l'immagine condivisa.
7. **Azioni tolte**: «Draw it near me», «Start», «Edit the drawing», GPX,
   Strava, video della corsa; fuori da gioco delle forme, record personali e
   km del profilo. «Do this workout» non chiesto: resta fuori.
8. **Traguardi** (richiesta dell'utente: «100 kg di panca piana sblocchi
   quella figura… 20, 40, 60, per tutti i macchinari tipo lat machine»):
   scala per esercizio, conta la serie migliore, ogni livello sblocca una
   figura MuW (🐭→🦍) sul profilo e nel post.
9. **Classifica**: «Anche classifica mensile», poi «Sì, così»: per
   esercizio, kg assoluti (peso e sesso restano sul telefono), solo le serie
   scritte durante una sessione dal vivo, un tetto di plausibilità per
   esercizio, ogni riga si segnala, il vincitore del mese prende «Winner».
10. **Video della serie** (richiesta dell'utente: «aggiungere anche il video
    dell'attività… dell'esecuzione con tot chili»): un video per serie con
    sopra esercizio e carico. Arriva con `expo-video`, quindi nella 1.0.2.
11. **Timer di recupero** (richiesta dell'utente al Coordinatore: «un timer
    sulla schermata… per fare le pause tra un macchinario e l'altro»):
    - durate «Sì, con partenza da sola»: 30 s, 60 s, 90 s, 2 min, 3 min e
      «Custom» (10 s–10 min); l'ultima durata di ogni esercizio si ricorda e
      il recupero parte da solo dopo una serie;
    - avviso «Sì, così»: vibrazione e suono breve ad app aperta, vibrazione
      leggera 10 s prima; a schermo bloccato una notifica locale col suono
      di sistema; il permesso è quello delle push, chiesto al primo recupero
      se manca; negato, l'avviso c'è solo ad app aperta;
    - in pausa «Sì, così»: conto alla rovescia grande, «−15 s», «+15 s»,
      «Skip», la serie dopo scritta sotto, schermo acceso;
    - recuperi «Sì, così»: il cronometro della sessione non si ferma; il
      recupero non è «Pause» (che ferma tutto); nel riepilogo e nel post
      «12 rests · avg 1:35 · 19 min resting»; i singoli recuperi restano sul
      telefono. La proposta diceva anche «kcal del recupero a riposo»:
      corretto dall'agente (ADR-0327, punto 7), perché il MET dei pesi è
      già la media di una sessione con i recuperi;
    - ripresa «Sì, così»: a fine recupero la serie dopo è già pronta; da
      «Pause» si riparte da soli scrivendo una serie o con un recupero; dopo
      30 minuti senza niente «Still training?», e senza risposta la sessione
      si chiude all'ultima serie scritta.

12. **Testi**: «Sì, approvo tutto» — l'interfaccia (sotto), i 91 esercizi,
    le sette figure e le scale di `docs/sports/gym.md`.

## Domande aperte

- **Privacy**: la riga per esercizi, pesi e classifica, con la parte A.

## Il disegno tecnico

In ADR-0327 (deciso dall'agente su delega dell'utente).

## Le parti

| Parte | Cosa | Dipende da | Server · testi · OTA |
|---|---|---|---|
| A | API e database: `gym`, sessione senza traccia, le serie, `gym` fra i valori di `X-MuW-Reads` (ADR-0328), esclusioni (record, gioco, GPX, Strava), contratto, test | #758, 376 B2 | migrazione col numero del Coordinatore; server col sì |
| B0 | L'app **legge** i post senza traccia: card, dettaglio, profilo, ricerca, messaggi, l'elenco degli esercizi; aggiunge `gym,trackless` all'header | A | OTA di produzione col sì, **prima** di B |
| B | L'app **registra**: «Gym», «Start workout», schermata della sessione, catalogo e serie, timer di recupero, «Pause», «Still training?», fine sessione, «Save» | B0 in produzione da qualche giorno, 376 B3 | testi col sì |
| C | Calorie (MET dei pesi, formule delle macchine cardio) e Salute / Health Connect come allenamento di forza | B | — |
| D | Il post senza disegno: fino a 10 foto, il riquadro dei numeri, «Show exercises», condivisione, azioni tolte | B, TASK-348 | testi col sì |
| E | Traguardi: scale per esercizio, figure sul profilo e nel post | A, D | testi col sì |
| F | Classifica mensile: serie dal vivo, tetti, segnalazioni, «Winner» | A, E | server e privacy col sì |
| G | Battito a sessione finita: kcal di Keytel, medio e massimo, tempo nelle zone | TASK-345 C, TASK-374 D; Android con TASK-321 C | — |
| H | Video della serie con esercizio e carico | 1.0.2: `expo-video`, TASK-348 C / TASK-336 | build col sì |

Il battito e le zone **in tempo reale** dall'Apple Watch sono codice nativo:
non sono in questo task, si valutano con la 1.0.2 (TASK-345 C e la build).

## File toccati

Solo i file nuovi e i punti di registrazione (condizione del Coordinatore
Sport, ADR-0320 punto 5: le righe nei registri le raccoglie lui). La lista
precisa di ogni parte va al Coordinatore prima della parte.

Questa PR (documenti): `docs/tasks/TASK-385.md` (nuovo),
`docs/sports/gym.md` (nuovo), `docs/DECISIONS.md` (ADR-0327),
`docs/STATUS.md` (una voce), `docs/INDEX.md` (una riga).

- **A** (lista approvata dal Coordinatore il 2026-11-05, migrazione 0047;
  branch `feat/TASK-385-a-gym-api`):
  - file nuovi: `services/api/migrations/0047_gym.sql`,
    `services/api/shaperoute_api/gym_catalog.py`, `gym_sessions.py`,
    `sports/gym.py`; `services/api/tests/test_gym.py`,
    `test_gym_catalog.py`; `packages/shared-types/src/gym.ts`,
    `src/sports/gym.ts`, `fixtures/gym-exercises.json`,
    `fixtures/gym-session.json`, `test/gym.test.ts`;
  - righe in file esistenti: `reads.py` e `fixtures/reads.json` (`gym`),
    `drawings.py` (`keep()` pubblica senza linea; il disegno non cambia una
    corsa in palestra né il contrario), `app.py` (il router),
    `activities.py` (`gym` in `RunActivity`, `TRACKLESS_ACTIVITIES`, `422`
    per `activity: "gym"`, `_line(None)`), `strava.py` (fuori da
    `SPORT_TYPES`, `422`), `sports/base.py` (`trackless`) e
    `sports/__init__.py` (una riga); `shared-types` `src/index.ts`
    (`TRACKLESS_ACTIVITIES` e la riga di export), `src/sports/base.ts`
    (`TracklessSport`), `src/sports/index.ts` (una riga),
    `fixtures/run-activities.json` (`trackless_activities`);
  - test di prima che contano le attività, una riga ciascuno:
    `test_sport_registry_api.py`, `test_record_only.py`,
    `test_walking_api.py`, `test_reads.py` (`gym` non è più un valore
    sconosciuto);
  - documenti: `docs/API.md` («Gym» e una riga in `X-MuW-Reads`),
    `docs/DATABASE.md` (0047), `docs/DECISIONS.md` (precisazione),
    `docs/STATUS.md` (righe proprie), questo file.
  `run_gpx.py` non cambia: il GPX di una corsa lo fa solo Strava.
  `apps/mobile/assets/engine/engine.zip` rifatto
  (`tools/phone_engine/phone_engine.py engine`): porta i moduli dell'API che
  il motore del telefono importa, e fra questi il registro degli sport con
  `sports/gym.py`. Solo un file dell'app, non nativo: impronta iOS invariata.
- **B0** (lista approvata dal Coordinatore il 2026-11-05; branch
  `feat/TASK-385-b0-trackless-posts`):
  - file nuovi: `apps/mobile/src/sports/gym.ts` (🏋️ «Gym», Apple 50
    `traditionalStrengthTraining`, Health Connect 70 `STRENGTH_TRAINING`,
    verificati sulle librerie), `gym/catalog.ts` (i 91 esercizi con i nomi),
    `gym/GymTile.tsx` (il riquadro giallo), `gym/ExerciseList.tsx`,
    `gym/GymDetail.tsx` (gli esercizi nella scheda del disegno),
    `api/gym.ts` (`GET /drawings/{id}/exercises`) e i test
    `gym/catalog.test.ts`, `gym/GymTile.test.tsx`,
    `gym/ExerciseList.test.tsx`, `api/gym.test.ts`,
    `feed/tracklessFeed.test.tsx`;
  - `shared-types`: `src/index.ts` (`RUN_ACTIVITIES` prende
    `TRACKLESS_ACTIVITIES`), `fixtures/run-activities.json`,
    `fixtures/reads.json` (`this_app` con `gym,trackless`),
    `test/runActivities.test.ts`, `test/sportRegistry.test.ts`,
    `test/gym.test.ts`; nell'API solo i test che leggono le stesse fixture
    (`test_record_only.py`, `test_sport_registry_api.py`, `test_reads.py`,
    `test_gym.py`);
  - righe nell'app: `api/reads.ts` (+ `reads.test.ts`, `accounts.test.ts`),
    `sports/index.ts`, `sports/sportProfiles.test.ts`,
    `sports/activityName.test.ts`, `i18n/it.ts`, `de.ts`, `fr.ts`, `es.ts`
    (tre testi approvati), `activities/snow.ts` (`isTrackless`,
    `routeActivity`), `social/PublicParts.tsx` (solo il chip «Gym», niente
    concorso), `feed/FeedPost.tsx` (il riquadro al posto della mappa, la
    prima foto prima, niente miniatura né km), `social/DrawingCard.tsx`
    (gli esercizi, il tempo al posto dei km, niente «Draw it near me» né
    «Edit the drawing»; al posto di `App.tsx`), `social/DrawingsGrid.tsx`,
    `search/DrawingResultCard.tsx`, `search/ResultsGrid.tsx` (una riga),
    `activities/ActivitiesList.tsx`, `activities/ActivityCard.tsx` (niente
    linea, Strava né «Send to a friend»), `share/postRun.ts` (niente
    distanza per la palestra), `feed/postEnergy.ts` (niente kcal fino alla
    parte C; aggiunto per tsc, approvato dal Coordinatore);
  - `contest/ContestCard.tsx` esce: un post di palestra non entra in un
    concorso. Le mappe di Salute leggono il profilo (TASK-376 B3a): non
    cambiano.
- **B** (lista approvata dal Coordinatore il 2026-11-05; branch
  `feat/TASK-385-b-gym-workout`; «Gym» `ready: false, preview: true`, accesa
  nelle build dello store solo col sì dell'utente dopo qualche giorno di B0
  in produzione):
  - file nuovi in `apps/mobile/src/gym/`: `workout.ts` (lo stato puro),
    `workoutStore.ts` (`gym-workout.json`), `useWorkout.ts`, `restTimer.ts`,
    `restAlert.ts` (vibrazione, `chime()`, notifica locale), `setKinds.ts`
    (i campi di ogni tipo, i limiti dell'API), `groups.ts` (i gruppi nelle
    cinque lingue), `gymKey.ts`, `gymOutbox.ts` (`gym-outbox.json`),
    `useGymOutbox.ts`, `gymStyles.ts`, `WorkoutScreen.tsx`,
    `ExercisePicker.tsx`, `SetFields.tsx`, `RestPanel.tsx`,
    `StillTraining.tsx`, `GymEnd.tsx`, `GymWorkoutHost.tsx`; test
    `restTimer.test.ts`, `setKinds.test.ts`, `workout.test.ts`,
    `gymKey.test.ts`, `gymFiles.test.ts`, `restAlert.test.tsx`,
    `GymWorkoutHost.test.tsx`, `GymDraw.test.tsx`;
  - righe in file esistenti: `api/gym.ts` (+ `gym.test.ts`,
    `saveGymSession`), `settings/sport.ts` (+ `sport.test.ts`),
    `screens/ChooseScreen.tsx` (il testo sotto `RecordDay` diventa una
    prop), `screens/RunNoRouteButton.tsx` (l'icona), `App.tsx` (due import,
    `<GymWorkoutHost />` e l'`onRun` della palestra), `i18n/it.ts`, `de.ts`,
    `fr.ts`, `es.ts` (i testi approvati);
  - i test che contano gli sport, una riga ciascuno (approvati dal
    Coordinatore dopo la lista): `settings/SportButton.test.tsx`,
    `SportSetting.test.tsx`, `SportVoiceItalian.test.tsx`,
    `SportStoreBuild.test.tsx`, `snowSport.test.ts`;
  - `RunEnd.tsx` esce: vuole una traccia, la palestra ha `GymEnd.tsx`. In B
    «Save» salva l'allenamento e lo mette in «My activities»; il post nel
    Feed è la parte D, le kcal e Salute la parte C.
- **C**: `apps/mobile/src/gym/gymKcal.ts` (nuovo); punti di registrazione in
  `health/*Workout.ts`.
- **D–H**: si elencano prima di ciascuna.

## Testi dell'interfaccia (approvati il 2026-11-04)

| en | it | de | fr | es |
|---|---|---|---|---|
| Gym | Palestra | Fitnessstudio | Salle de sport | Gimnasio |
| Start workout | Inizia l'allenamento | Training starten | Commencer la séance | Empezar entrenamiento |
| No route in the gym: MuW times your workout. | In palestra niente percorso: MuW cronometra il tuo allenamento. | Im Fitnessstudio keine Route: MuW stoppt dein Training. | Pas de parcours en salle : MuW chronomètre ta séance. | En el gimnasio no hay ruta: MuW cronometra tu entrenamiento. |
| + Exercise | + Esercizio | + Übung | + Exercice | + Ejercicio |
| Search exercises | Cerca esercizi | Übungen suchen | Rechercher un exercice | Buscar ejercicios |
| Add “{name}” | Aggiungi «{name}» | „{name}“ hinzufügen | Ajouter « {name} » | Añadir «{name}» |
| Chest · Back · Legs · Shoulders · Arms · Core · Full body · Cardio | Petto · Schiena · Gambe · Spalle · Braccia · Addome · Total body · Cardio | Brust · Rücken · Beine · Schultern · Arme · Bauch · Ganzkörper · Cardio | Pectoraux · Dos · Jambes · Épaules · Bras · Abdos · Corps entier · Cardio | Pecho · Espalda · Piernas · Hombros · Brazos · Abdomen · Cuerpo completo · Cardio |
| Set {n} | Serie {n} | Satz {n} | Série {n} | Serie {n} |
| Reps · Weight · Added weight · Time · Distance · Speed · Incline · Level · Floors | Ripetizioni · Peso · Zavorra · Tempo · Distanza · Velocità · Pendenza · Livello · Piani | Wdh. · Gewicht · Zusatzgewicht · Zeit · Distanz · Geschwindigkeit · Steigung · Stufe · Stockwerke | Répétitions · Poids · Lest · Durée · Distance · Vitesse · Inclinaison · Niveau · Étages | Repeticiones · Peso · Lastre · Tiempo · Distancia · Velocidad · Inclinación · Nivel · Pisos |
| Log set | Segna la serie | Satz eintragen | Noter la série | Anotar serie |
| Same again | Ancora uguale | Nochmal gleich | Même chose | Otra igual |
| Rest | Recupero | Satzpause | Récup | Descanso |
| Custom | Personalizzato | Eigene | Personnalisé | Personalizado |
| Skip | Salta | Überspringen | Passer | Saltar |
| Next: {exercise} · set {n} | Dopo: {exercise} · serie {n} | Als Nächstes: {exercise} · Satz {n} | Ensuite : {exercise} · série {n} | Siguiente: {exercise} · serie {n} |
| Rest over — next set (notifica) | Recupero finito: prossima serie | Pause vorbei – nächster Satz | Récup terminée : série suivante | Descanso terminado: siguiente serie |
| Still training? | Ti stai ancora allenando? | Trainierst du noch? | Tu t'entraînes encore ? | ¿Sigues entrenando? |
| Yes, keep going · Finish workout | Sì, continuo · Termina l'allenamento | Ja, weiter · Training beenden | Oui, je continue · Terminer la séance | Sí, sigo · Terminar entrenamiento |
| {n} exercises · {s} sets | {n} esercizi · {s} serie | {n} Übungen · {s} Sätze | {n} exercices · {s} séries | {n} ejercicios · {s} series |
| {n} rests · avg {time} · {total} resting | {n} recuperi · media {time} · {total} di recupero | {n} Satzpausen · Ø {time} · {total} Pause | {n} récups · moy. {time} · {total} de récup | {n} descansos · media {time} · {total} descansando |
| Show exercises | Mostra gli esercizi | Übungen zeigen | Afficher les exercices | Mostrar ejercicios |
| New level: {figure} · {exercise} {value} | Nuovo livello: {figure} · {exercise} {value} | Neue Stufe: {figure} · {exercise} {value} | Nouveau niveau : {figure} · {exercise} {value} | Nuevo nivel: {figure} · {exercise} {value} |
| Gym leaderboard · {month} | Classifica palestra · {month} | Fitness-Rangliste · {month} | Classement salle · {month} | Clasificación gimnasio · {month} |
| Only sets logged live count. | Contano solo le serie segnate durante l'allenamento. | Es zählen nur live eingetragene Sätze. | Seules les séries notées en direct comptent. | Solo cuentan las series anotadas en directo. |

I nomi degli esercizi e delle figure sono in `docs/sports/gym.md`.

## Criteri di accettazione

- [x] Le scelte 1–11 hanno una risposta scritta qui.
- [x] I testi sono approvati dall'utente («Sì, approvo tutto»).
- [ ] La lista dei file di ogni parte è approvata dal Coordinatore prima
  della parte.
- [ ] Un'app di oggi (il parser di `drawings.ts` in `main`) legge una pagina
  del Feed dal server nuovo senza scartarla (test).
- [ ] Ogni parte ha test deterministici; impronta iOS 6f8bba4c invariata
  fino alla parte H; impronta del motore invariata.

## Note

- 2026-11-05: la proposta è in `main` (#766). TASK-387 (ADR-0328) ha messo
  l'header unico `X-MuW-Reads` con `trackless`: la palestra lo usa invece di
  un filtro suo (precisazione di ADR-0327). Liste di A e B0 aggiornate qui
  sopra. Il codice aspetta ancora TASK-376 B2 e B3.
- 2026-11-05: parte A scritta (API, database, tipi; migrazione 0047). Il
  server può andare col sì dell'utente anche prima della B0: l'header tiene
  fuori i post senza traccia. Prossima: B0, l'app che li legge.
- 2026-11-05: parte B0 scritta: l'app legge i post di palestra (riquadro,
  esercizi, miniature) e manda `gym,trackless`. OTA di produzione col sì
  dell'utente, prima della parte B.
- 2026-11-05: parte B0 in `main` (#822, a02b7959); va nell'OTA di produzione
  col sì dell'utente, prima della parte B.
- 2026-11-05: parte B scritta: «Start workout» in «Draw», la schermata
  dell'allenamento, il catalogo con la ricerca e il nome libero, le serie
  dei quattro tipi, il recupero con l'avviso, «Pause», «Still training?»,
  le correzioni alla fine e «Save» (`PUT /me/gym-sessions/{key}`, con la
  coda sul telefono). «Gym» `ready: false, preview: true`. Prossima: C
  (kcal e Salute) e D (il post).
