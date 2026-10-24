# TASK-296 — Il gioco delle forme: collezione (A, B), squadre e sfide (C, D), striscia in corsa (E)

**Stato**: In lavorazione · documenti in `main` (#532, `f34ca6c5`) · parte A in `main` (#534, `abb593c5`) · parte B in `main` (#536, `145cf992`) · parte C in lavorazione
(`feat/TASK-296-c-teams-api`, #540) · prossime: D, E
**Fase**: 4 · **Branch**: `docs/TASK-296-shape-game` (documenti),
`feat/TASK-296-a-game-api` (A), `feat/TASK-296-b-play-collection` (B),
`feat/TASK-296-c-teams-api` (C), `feat/TASK-296-d-challenges-app` (D),
`feat/TASK-296-e-run-strip` (E)
**Dipende da**: TASK-172 (le corse salvate), TASK-262 A (le push),
TASK-121 (i blocchi), TASK-213 (il filtro delle parole)
**ADR**: ADR-0255 (una sola per tutte le parti)

## Obiettivo

Un gioco dentro MuW. Le corse a piedi salvate sbloccano **forme da
collezionare**, per km totali e per passo su una distanza; in **squadra**
si ricrea una forma divisa in **pezzi**, entro una scadenza. Tutto sta in
una pagina nuova **«Play»**. Le regole sono in `docs/GIOCO.md`.

## Contesto

L'utente lo ha chiesto il 2026-10-23 con un testo che elencava:
- sblocco per distanza (5 km → triangolo, 20 km → esagono, 100 km →
  stella);
- sblocco per velocità (1 km sotto 5:00/km, 5 km sotto 5:30/km);
- collezione con requisito e percentuale delle forme bloccate;
- squadre con una forma divisa in pezzi, contributi in tempo reale e
  scadenza (7 giorni);
- GPS con controllo anti-imbroglio;
- tre schermate (collezione, corsa, sfide);
- una notifica a ogni sblocco.

Fra «MuW, pagina Play», «MuW, dentro Profile» e «app a sé», l'utente ha
scelto **MuW, pagina «Play»**. Numero e ADR vengono dal Coordinatore (il
2026-10-23); con loro le condizioni elencate sotto.

## Condizioni (dal Coordinatore, 2026-10-23)

1. **Contenuti degli utenti** (Apple 1.2): i nomi delle squadre passano
   dal filtro delle parole di TASK-213. Chi si è bloccato (TASK-121) non
   sta nella stessa squadra e non vede l'altro.
2. **Niente punteggio**: TASK-241 lo ha tolto su richiesta dell'utente.
   Collezione e barre di avanzamento vanno bene; il vecchio punteggio a
   fine corsa non torna.
3. **Privacy**: km, passo e squadre sono trattamenti nuovi. Il testo qui
   sotto aspetta il sì dell'utente ed entra in `site/privacy` dopo la #461
   e TASK-284 B. Le righe `game_*` di un account si cancellano con
   l'account (`ON DELETE CASCADE`), con un test.
4. **Push**: i testi nelle cinque lingue li approva l'utente; valgono gli
   interruttori di TASK-262 A.
5. **L'app non esce prima della sua API**: «Play» si vede solo se `GET
   /game/catalog` risponde 200 (scelta in ADR-0255).
6. **Impronta iOS**: B, D ed E lasciano
   `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3`, quella delle OTA della
   1.0. Il valore va scritto in ogni PR. Nessuna dipendenza nuova senza il
   sì dell'utente.
7. **Server**: A e C ci vanno solo dopo l'approvazione di Apple e con
   l'ok dell'utente.
8. **Merge**: a ogni parte, «#NNN pronta» al Coordinatore, che mergia al
   verde.

**File occupati il 2026-10-23**, dalle PR ferme fino a dopo Apple:
- `push.py` è della #525 e `app.py` della #461: in A si aggiungono solo il
  `Kind` e la riga del router;
- la migrazione prende il primo numero libero al merge: la #502 sarà
  0023, la #525 0024, questa probabilmente 0025;
- negli `i18n` si scrivono solo righe in fondo;
- TASK-294 A tocca `runControl`, `runAway` e `runPosition`, e TASK-295
  tocca `src/share/`: D ed E si ricontrollano con il Coordinatore quando
  partono.

## Contesto da leggere

- `docs/GIOCO.md`, tutto;
- `docs/DATABASE.md` («Com'è oggi»: `runs`, `push_tokens`, `blocks`) e
  `docs/API.md` (come si scrive un endpoint con account);
- `services/api/shaperoute_api/activities.py` (`recorded`, il
  salvataggio), `push.py` (`Kind`, `PushEvent`, `text_of`),
  `comment_filter.py` (`check_comment`), `moderation.py` (i blocchi);
- `services/route-engine/route_engine/track_score.py` (`clean_track`) e
  `route_engine/shapes/` (i contorni);
- per B, D ed E: `docs/UI.md`, `apps/mobile/src/screens/Pager.tsx`,
  `apps/mobile/App.tsx` (le pagine), `src/activities/RunEnd.tsx`,
  `src/intro/` (come si anima senza dipendenze).

## Parte A — API: regole e collezione

1. **Migrazione** `00NN_game.sql`: crea `game_runs` e `game_unlocks`
   (`GIOCO.md` §7). Il numero è il primo libero in `main` al merge.
2. **`game_rules.py`**, puro:
   - `evaluate(track, pauses) → RunGame`, con `counted`, `reason`,
     `counted_m` e `best_s`;
   - le soglie anti-imbroglio di §4;
   - il miglior tempo su 1000, 5000, 10000 e 21097 m;
   - `progress(catalog, totals) → [ShapeProgress]` e gli sblocchi nuovi.
3. **`game_catalog.py`**: le 12 forme di §5.3, con i contorni da
   `route_engine/shapes/` o costruiti, in 0–1, e i requisiti.
4. **`game.py`**:
   - `after_run_saved(conn, user_id, run_id)`: sovrapposizioni, tetto
     giornaliero, `game_runs`, `game_unlocks`, push `shape_unlocked`;
   - `GET /game/catalog` senza account e `GET /game/me` con account.
5. **`activities.py`**: dopo il salvataggio chiama `after_run_saved`
   nella stessa transazione; dopo il commit, la push delle forme
   sbloccate. La risposta di `PUT /me/activities/{key}` **non cambia**:
   l'esito si legge con `GET /game/runs/{key}` (aggiunta ad ADR-0255).
   Anche quando cancelli una corsa, `game_runs` va via in cascata.
6. **`push.py`**: il `Kind` `shape_unlocked` e il suo testo (da
   approvare, sotto). **`app.py`**: la riga del router.
7. **`game_backfill.py`**: il comando del §7, idempotente, senza push.
8. **Test deterministici**:
   - tracce finte per ogni regola di §4 e di §5;
   - una sovrapposizione, il tetto giornaliero, una corsa cancellata
     (resta lo sblocco);
   - l'account cancellato porta via le sue righe `game_*`;
   - il backfill due volte uguale;
   - `GET /game/catalog` senza account e `GET /game/me` con account.
9. **Documenti**: `API.md` («Gioco»), `DATABASE.md` (le due tabelle),
   `STATUS.md`, questo file.

## Parte B — App: pagina «Play» e collezione

Parte dopo che A è in `main`. Prima di toccare file esistenti, l'elenco va
al Coordinatore.

1. `src/game/` (nuovo):
   - i tipi della risposta;
   - `useGame` (`/game/catalog`, `/game/me`, l'ultima risposta salvata);
   - `PlayScreen` con `Segmented` (Collection, e Challenges vuota fino a
     D);
   - `ShapeCard` (contorno, requisito, barra);
   - `UnlockCard`.
2. «Play» è la quarta pagina, dopo Explore, e si vede solo se
   `/game/catalog` ha risposto 200 (ADR-0255). Il titolo va in
   `pageTitles`.
3. Dopo «Save», con `game.unlocked` non vuoto, la scheda «New shape
   unlocked» con il contorno che si disegna (`Animated`, senza Lottie né
   `react-native-svg` se non ci sono già).
4. La push `shape_unlocked` non si mostra con l'app in primo piano.
5. Testi nelle cinque lingue, approvati dall'utente; colori da
   `tokens.ts`.
6. Test: la griglia (sbloccate e bloccate con la percentuale), la pagina
   nascosta con 404, la scheda dopo «Save», senza account.

**Com'è fatta** (2026-10-24, aggiunta ad ADR-0255; `UI.md`, «“Play”: la
collezione delle forme»):

- `src/game/`: `gameApi.ts` (i tre GET), `gameCatalog.ts` (il catalogo sul
  telefono, `useGameCatalog`, `refreshGameCatalog`), `useGameMe.ts`,
  `goalText.ts` (requisito e avanzamento nelle unità), `outlineSegments.ts`
  e `ShapeOutline.tsx` (il contorno con View girate, anche animato),
  `ShapeCard.tsx`, `PlayScreen.tsx`, `unlocks.ts` (`showUnlocked`,
  `openPlay`), `unlockedRuns.ts`, `UnlockCard.tsx`, `UnlockLayer.tsx`.
- **Diverso dal piano**: in B la pagina ha la **sola collezione, senza
  `Segmented`** (la scheda «Challenges» arriva con D, così non promette
  niente prima); la scheda «New shape unlocked» è un **livello in `Root`**
  e non la schermata di fine corsa, che non c'è più quando l'API risponde;
  il catalogo si chiede **all'avvio, per tutti**, e la pagina compare
  appena il server risponde 200, con il `Pager` che tiene le pagine
  costruite per titolo; «Play» sta **fra «Explore» e il profilo**, con il
  suo nome in alto (quattro nomi).
- La richiesta del catalogo all'avvio cambia cinque test dell'app intera
  che contavano «nessuna richiesta» o le elencavano tutte (`AppPages`,
  `AppFeed`, `App`, `AppPaddle`, `AppPaddleMove`, `Profile`,
  `DrawDistanceApp`): tolgono `/game/catalog` dal conto o gli rispondono
  404.
- Impronta iOS **invariata**: misurata dal Coordinatore su due copie
  pulite con `npm ci` e `APP_VARIANT=production`, `main` e l'head
  `414f960e` danno tutti e due `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3`.
  Nel worktree il valore era diverso solo perché `node_modules` è fatto
  di link al checkout principale (cambiano le 34 sorgenti
  `dir:node_modules/…`, nessuna sorgente dell'app): per misurarla da un
  worktree serve una copia con `npm ci`, non i link.

## Parte C — API: squadre e sfide

Parte dopo A.

1. **Migrazione**: `game_teams`, `game_team_members`, `game_challenges`,
   `game_pieces`, `game_contributions` (`GIOCO.md` §7).
2. **`game_teams.py`**:
   - creare una squadra (nome filtrato da `check_comment`, codice di 6);
   - entrare (rifiutato con un blocco in mezzo, oltre 20 iscritti, oltre
     10 squadre), uscire, togliere;
   - il passaggio di proprietà.
3. **`game_challenges.py`**:
   - creare una sfida (una attiva per squadra);
   - prendere e lasciare un pezzo;
   - riempire i pezzi da `after_run_saved`, con i km in avanzo al pezzo
     libero successivo e il pezzo veloce;
   - la chiusura a scadenza + 3 h e l'edizione squadra;
   - il contorno dei pezzi, puro, in `game_rules.py`.
4. **Push** `piece_done`, `challenge_done` e `challenge_ending` (un giorno
   prima). L'ultima chiede un controllo periodico nell'API: come farlo
   si decide qui, aggiungendolo ad ADR-0255.
5. **Blocco nato dopo**: proposta da confermare con l'utente. Se due
   iscritti della stessa squadra si bloccano, esce chi ha bloccato,
   tranne quando la squadra è sua: allora esce l'altro. Così nessuno può
   cacciare il proprietario bloccandolo.
6. Test deterministici per ogni regola di `GIOCO.md` §6, per le
   cancellazioni in cascata e per i blocchi.

**Com'è fatta** (2026-10-24; i dettagli in `GIOCO.md` §6.5 e
nell'aggiunta ad ADR-0255): migrazione `0027_game_teams.sql` (la 0026 è
di TASK-297 A, #539; il numero si ricontrolla al merge);
`game_teams.py` e `game_challenges.py` con i loro router installati da
`game.install_game`, così `app.py` non si tocca; il riempimento dei pezzi
dentro `game.after_run_saved`; `pieces_of` in `game_rules.py`; in
`push.py` i tre `Kind`, i testi e tre campi facoltativi di `PushEvent`;
in `moderation.py` i ganci di `app.state.on_block` in un savepoint;
`ChallengeClock` (ogni 15 minuti, nel lifespan avvolto da
`install_game_challenges`, fermato prima che si chiuda il pool) per «1
day left», una volta per sfida grazie a `ending_told_at`.

**Domande all'utente** (una per volta, dal 2026-10-24):
- (a) il blocco nato fra due iscritti della stessa squadra: proposta al
  punto 5. **Approvata dall'utente il 2026-10-24** («Sì, va bene la
  regola proposta»): esce chi blocca, tranne quando la squadra è sua,
  allora esce l'altro; è quello che fa `game_teams.on_block`.
- (b) i testi delle tre push: proposta in «Testi da approvare».
  **Approvati dall'utente il 2026-10-24** («Sì, vanno bene i testi
  proposti»): sono quelli in `push.py`.

## Parte D — App: sfide

Parte dopo C, e dopo aver ricontrollato `src/share/` con il Coordinatore
(TASK-295).

- La scheda «Challenges»:
  - le squadre, con «Create» e «Join» (codice);
  - la sfida, con la forma a pezzi colorati per persona, i contributi,
    quanto manca e il conto alla rovescia;
  - «Take this piece» e «Leave»;
  - «Share code» con il foglio di condivisione.
- La sfida si rilegge ogni 15 s mentre è aperta e quando l'app torna in
  primo piano.
- La push di una sfida apre la sfida (`notificationTap`).
- Test con orologio e API finti.

## Parte E — App: striscia nella schermata di corsa

Parte dopo B e dopo aver ricontrollato `RunDashboard.tsx` con il
Coordinatore.

- Una riga sottile con la prossima forma per distanza («Hexagon 14.2 / 20
  km», con i km della corsa sommati sul telefono). Con un pezzo veloce in
  mano, invece, il passo dell'ultimo km contro l'obiettivo.
- È una stima del telefono e non dice mai «unlocked»: lo dice il server
  dopo «Save».
- Test con una corsa finta.

## Testi da approvare dall'utente

**Approvati dall'utente il 2026-10-23** («sì, i testi vanno bene»): il
testo della push `shape_unlocked` nelle cinque lingue, i nomi delle 12
forme e il paragrafo di privacy «The shape game» qui sotto. Le altre tre
push (`piece_done`, `challenge_done`, `challenge_ending`) sono della
parte C e si riguardano quando parte.

**Push** (inglese, poi tradotti nelle altre quattro lingue):

| Kind | Testo | Italiano |
|---|---|---|
| `shape_unlocked` | You unlocked a new shape! Find it in your collection, in Play. | Hai sbloccato una nuova forma! La trovi nella tua collezione, in Play. |
| `piece_done` | {name} finished piece {n} of the {shape}. | {name} ha finito il pezzo {n} di {shape}. |
| `challenge_done` | {shape} complete! Your team drew it together. | {shape} completata! La squadra l'ha disegnata insieme. |
| `challenge_ending` | 1 day left: {k} pieces of the {shape} are missing. | Manca 1 giorno: mancano {k} pezzi di {shape}. |

**Testi della parte C, approvati dall'utente il 2026-10-24** («Sì, vanno
bene i testi proposti»): il nome della forma in testa, nella lingua del telefono (l'evento porta i nomi del
catalogo), così nessuna lingua deve accordare articoli; `{n}` è il numero
del pezzo, o dei pezzi che mancano. Sostituisce le tre righe della tabella.

| Kind | Inglese | Italiano |
|---|---|---|
| `piece_done` | {shape}: {name} finished piece {n}. | {shape}: {name} ha finito il pezzo {n}. |
| `challenge_done` | {shape}: the shape is complete! Your team drew it together. | {shape}: la forma è completa! La squadra l'ha disegnata insieme. |
| `challenge_ending` | {shape}: 1 day left. Pieces missing: {n}. | {shape}: manca 1 giorno. Pezzi da fare: {n}. |

Tedesco: «{shape}: {name} hat Teil {n} geschafft.», «{shape}: die Form ist
fertig! Euer Team hat sie zusammen gezeichnet.», «{shape}: noch 1 Tag.
Fehlende Teile: {n}.». Spagnolo: «{shape}: {name} ha terminado la pieza
{n}.», «{shape}: ¡la forma está completa! Vuestro equipo la ha dibujado
juntos.», «{shape}: queda 1 día. Piezas que faltan: {n}.». Francese:
«{shape} : {name} a terminé la pièce {n}.», «{shape} : la forme est
complète ! Ton équipe l'a dessinée ensemble.», «{shape} : plus qu'1 jour.
Pièces manquantes : {n}.».

`shape_unlocked` non ha il nome della forma: il testo segue la lingua di
ogni telefono e l'evento non porta nomi (aggiunta ad ADR-0255). Nella parte
A è scritto in `push.py` anche in tedesco («Du hast eine neue Form
freigeschaltet! Du findest sie in deiner Sammlung, unter Play.»), spagnolo
(«¡Has desbloqueado una nueva forma! La encontrarás en tu colección, en
Play.») e francese («Tu as débloqué une nouvelle forme ! Tu la trouveras
dans ta collection, dans Play.»).

**Nomi delle forme** (parte A, `game_catalog.py`, serviti da `GET
/game/catalog` nelle cinque lingue): Triangle/Triangolo, Square/Quadrato,
Hexagon/Esagono, Circle/Cerchio, Star/Stella, Heart/Cuore, Moon/Luna,
Sun/Sole, Lightning/Fulmine, Diamond/Diamante, Arrow/Freccia,
Crown/Corona; tedesco, spagnolo e francese nel file.

**Privacy**: un paragrafo nuovo in `site/privacy`, «The shape game».
Entra dopo la #461 e TASK-284 B.

> **The shape game.** With an account, our server works out from your
> saved runs on foot how many kilometres count for the game, your best
> times over 1, 5, 10 and 21.1 km, and the shapes you collected. Only you
> see your collection and your best times. If you join a team, its members
> see your username, your picture, the pieces of a challenge you took and
> the kilometres you gave to each, never your tracks, the times of your
> runs or where you ran. A team is found only with its code: it is never
> in a search. Deleting a run takes its kilometres out of the count, and
> the shapes you already collected stay. When you delete your account,
> your game data is deleted with it; in a team's challenges the pieces you
> ran stay for the others, without your name.

Andrà aggiunto anche a «Where your data is and for how long», nella frase
di ciò che si cancella con l'account: «… follows and game data».

**Testi dell'app della parte B** (inglese / italiano; tedesco, spagnolo e
francese in fondo alle tabelle `i18n`), **approvati dall'utente il
2026-10-24** («sì, i testi vanno bene»):

| Dove | Inglese | Italiano |
|---|---|---|
| il nome della pagina | Play | Gioca |
| requisito per distanza | {distance} in total | {distance} in totale |
| requisito per passo | {distance} under {pace} | {distance} sotto {pace} |
| avanzamento di un passo | Best {best} · target {target} | Migliore {best} · obiettivo {target} |
| senza quella distanza in una corsa | Longest run {distance} | Corsa più lunga {distance} |
| forma sbloccata | Unlocked {date} | Sbloccata {date} |
| senza account | Sign in to collect shapes. | Accedi per collezionare le forme. |
| in alto, con l'account | {distance} counted so far | {distance} contati finora |
| senza catalogo (non dovrebbe vedersi) | The game is not available right now. | Il gioco non è disponibile adesso. |
| la scheda | New shape unlocked | Nuova forma sbloccata |
| la scheda, per il lettore di schermo | New shape unlocked: {name} | Nuova forma sbloccata: {name} |
| la scheda | It is in your collection. | È nella tua collezione. |
| la scheda, pulsante | See collection | Vedi la collezione |

«Close» e «Try again» c'erano già. I testi delle parti D ed E si
propongono quando partono.

## Criteri di accettazione

Documenti (questa PR):
- [ ] `docs/GIOCO.md`, questo file, ADR-0255, una riga in `INDEX.md` e
      una in `STATUS.md`.

Parte A:
- [ ] Una corsa salvata ha la sua riga `game_runs`: conta o ha la ragione
      del perché no (`vehicle`, `overlap`, `not_running`).
- [ ] I tratti sopra 7 m/s per almeno 200 m non contano. Una corsa con più
      del 10 % di quei tratti non conta per niente.
- [ ] I migliori tempi sono quelli calcolati a mano sulle tracce dei test,
      al secondo.
- [ ] Il primo «Save» che porta il totale a 5 km sblocca `triangle`;
      una corsa con 1 km sotto 5:00 sblocca `lightning`.
- [ ] `GET /game/me` dà totali, migliori tempi, sblocchi e avanzamento
      (massimo 99 % sulle forme bloccate).
- [ ] Le righe `game_*` dell'account cancellato spariscono (test).
- [ ] Il backfill è idempotente e non manda push.
- [ ] pytest, ruff e black verdi (mypy non è nel progetto né nella CI).

Parte B:
- [x] «Play» si vede con `/game/catalog` 200 ed è nascosta con 404
      (`__tests__/AppPlay.test.tsx`, `AppPages.test.tsx`).
- [x] La collezione mostra sbloccate e bloccate con requisito e percentuale
      (`src/game/PlayScreen.test.tsx`), nelle unità scelte.
- [x] Dopo «Save» una corsa che sblocca mostra «New shape unlocked»
      (`activitiesDoorGame.test.tsx`, `UnlockLayer.test.tsx`).
- [x] La push `shape_unlocked` non si mostra a app aperta e toccata apre
      «Play» (`shownWhileOpen.test.ts`, `notificationTap.test.ts`,
      `usePushNotifications.test.ts`).
- [x] L'impronta iOS è invariata (`83793e26…`): solo JavaScript.
- [x] lint, typecheck, test e format:check verdi in locale (3556 test,
      2026-10-24).
- [x] I testi dell'app approvati dall'utente (tabella sopra, 2026-10-24:
      «sì, i testi vanno bene»).

Parte C:
- [ ] Una squadra si crea con un nome dal filtro di TASK-213 e un codice
      di 6; si entra con il codice in qualunque maiuscola; oltre 20
      iscritti, oltre 10 squadre o con un blocco in mezzo la risposta è la
      stessa, «You can't join this team.» (`test_game_teams.py`).
- [ ] Chi esce lascia liberi i suoi pezzi; il proprietario toglie; la
      squadra passa all'iscritto più vecchio e sparisce senza iscritti;
      `DELETE /me` fa lo stesso e porta via iscrizioni e contributi, non
      sfide e pezzi.
- [ ] Una sfida per squadra; pezzi 2–12, X km 1–50 oppure veloce 1 o 5 km
      sotto un passo; scadenza 1–14 giorni, 7 di default.
- [ ] Un pezzo in mano per persona e per sfida; le corse che contano
      iniziate dopo la presa e prima della scadenza lo riempiono, i km in
      avanzo passano al pezzo libero successivo, un pezzo lasciato tiene i
      metri, il pezzo veloce è fatto da un miglior tempo; fuori dalla
      finestra (prima della presa, dopo la scadenza, salvata oltre 3 h)
      niente (`test_game_challenges.py`).
- [ ] L'ultimo pezzo completa la sfida e dà l'edizione squadra a chi ha
      contribuito; dopo 3 h dalla scadenza è `expired` e se ne crea
      un'altra.
- [ ] Le push `piece_done` (agli altri), `challenge_done` (a tutti) e
      `challenge_ending` (una volta per sfida, anche con due controlli
      insieme) portano `challenge_id`; gli eventi di prima non cambiano.
- [ ] Il timer parte e si ferma con l'app, e si ferma prima che si chiuda
      il database.
- [ ] Un gancio del blocco che fallisce non perde il blocco; il blocco nato
      fra due iscritti ne fa uscire uno secondo la regola approvata.
- [ ] I pezzi del contorno sono N tratti uguali che si chiudono
      (`test_game_pieces.py`).
- [ ] pytest, ruff e black verdi; la suite completa dell'API verde in
      locale.
- [x] La regola del blocco e i testi delle tre push approvati dall'utente
      il 2026-10-24, con le sue parole in «Domande all'utente».

Parti D ed E: i criteri si scrivono qui quando partono, dalle regole
di `GIOCO.md` §6 e §9.

## File toccati

Documenti (questa PR):
```
docs/GIOCO.md                 (nuovo)
docs/tasks/TASK-296.md        (nuovo)
docs/DECISIONS.md             (ADR-0255 in fondo)
docs/STATUS.md                (righe nuove)
docs/INDEX.md                 (una riga: «Il gioco delle forme» → GIOCO.md)
```

Parte A:
```
services/api/migrations/00NN_game.sql                    (nuovo, numero al merge)
services/api/shaperoute_api/game_rules.py                (nuovo)
services/api/shaperoute_api/game_catalog.py              (nuovo)
services/api/shaperoute_api/game.py                      (nuovo)
services/api/shaperoute_api/game_backfill.py             (nuovo)
services/api/shaperoute_api/activities.py                (la chiamata dopo il salvataggio, `game` nella risposta)
services/api/shaperoute_api/push.py                      (solo il Kind `shape_unlocked` e il suo testo)
services/api/shaperoute_api/app.py                       (solo la riga del router)
services/api/tests/test_game_rules.py                    (nuovo)
services/api/tests/test_game_catalog.py                  (nuovo)
services/api/tests/test_game_api.py                      (nuovo)
services/api/tests/test_game_backfill.py                 (nuovo)
docs/API.md                                              («Shape game» e la riga della push)
docs/DATABASE.md                                         (game_runs, game_unlocks)
docs/GIOCO.md                                            (il salvataggio è PUT, GET /game/runs/{key})
docs/DECISIONS.md                                        (aggiunta ad ADR-0255)
docs/STATUS.md, docs/tasks/TASK-296.md
```

Parte B (elenco mandato al Coordinatore il 2026-10-24; i cinque test
dell'app intera in fondo sono venuti fuori dalla suite completa):
```
apps/mobile/src/game/                                    (nuova: 13 moduli e i loro test)
apps/mobile/__tests__/AppPlay.test.tsx                   (nuovo)
apps/mobile/src/activities/activitiesDoorGame.test.tsx   (nuovo)
apps/mobile/src/notifications/shownWhileOpen.test.ts     (nuovo)
packages/shared-types/fixtures/game-catalog.json, game-me.json, game-run.json   (nuovi)
packages/shared-types/test/game.test.ts                  (nuovo)
packages/shared-types/src/index.ts                       (solo in fondo: GamePushKind e i tipi del gioco; PushKind non cambia)
apps/mobile/App.tsx                                      («play», pagesOf, il catalogo all'avvio, la pagina, onOpenPlay)
apps/mobile/src/screens/Pager.tsx, Pager.test.tsx        (pagine costruite per titolo)
apps/mobile/src/screens/pageTitles.ts, pageTitles.test.ts
apps/mobile/src/intro/Root.tsx                           (UnlockLayer)
apps/mobile/src/activities/activitiesDoor.ts             (GET /game/runs/{key} dopo il PUT)
apps/mobile/src/notifications/pushDevice.ts, notificationTap.ts, notificationTap.test.ts,
  usePushNotifications.ts, usePushNotifications.test.ts
apps/mobile/src/screens/ProfileLayer.tsx                 (openPlay, due righe)
apps/mobile/src/i18n/de.ts, es.ts, fr.ts, it.ts          (righe in fondo)
apps/mobile/__tests__/AppPages.test.tsx, AppFeed.test.tsx, App.test.tsx,
  AppPaddle.test.tsx, AppPaddleMove.test.tsx
apps/mobile/src/account/Profile.test.tsx
apps/mobile/src/units/DrawDistanceApp.test.tsx
docs/UI.md (solo la sezione nuova «Play»), docs/GIOCO.md, docs/DECISIONS.md (aggiunta ad ADR-0255), docs/STATUS.md, docs/tasks/TASK-296.md
```

Note del Coordinatore (2026-10-24): `index.ts`, `UI.md` e gli `i18n` sono
anche della #461 e della #502, ferme: solo aggiunte in fondo o nella
sezione nuova; `pushDevice.ts` e `notificationTap.ts` li toccherà TASK-294
B (push Android) dopo: modifiche piccole, chiuse nel caso `shape_unlocked`.
Su `preview` la B va con «Play» nascosta, perché il server risponde 404
finché non ha la A: è la prova del gating.

Parte C (elenco approvato dal Coordinatore il 2026-10-24):
```
services/api/migrations/0027_game_teams.sql              (nuovo, numero al merge)
services/api/shaperoute_api/game_teams.py                (nuovo)
services/api/shaperoute_api/game_challenges.py           (nuovo)
services/api/shaperoute_api/game_rules.py                (pieces_of)
services/api/shaperoute_api/game.py                      (riempimento, pieces_done, team_unlocked_at, install)
services/api/shaperoute_api/push.py                      (i tre Kind, i testi, OWN_KINDS, tre campi facoltativi di PushEvent)
services/api/shaperoute_api/moderation.py                (i ganci di app.state.on_block in un savepoint)
services/api/tests/test_game_pieces.py                   (nuovo)
services/api/tests/test_game_teams.py                    (nuovo)
services/api/tests/test_game_challenges.py               (nuovo)
services/api/tests/test_game_api.py                      (i campi nuovi nelle uguaglianze)
docs/API.md («Shape game» parte C, le push), docs/DATABASE.md (0026), docs/GIOCO.md (§6.5, §7, §8),
docs/DECISIONS.md (aggiunta ad ADR-0255), docs/STATUS.md, docs/tasks/TASK-296.md
```

Parti D ed E: l'elenco si scrive qui, e va al Coordinatore, prima
di partire.

## Fuori scope

- La cadenza dall'accelerometro contro le bici lente: è una dipendenza
  nativa e va chiesta all'utente.
- Il link che apre l'app su una squadra, se chiede una build nativa.
- Classifiche, punteggi e confronti fra squadre (condizione 2).
- Altri sport nel gioco (bici, pagaia).
- WebSocket o qualunque «tempo reale» diverso dalla rilettura più le
  push.

## Esito

**Parte A** in `main` con la #534 (`abb593c5`, 2026-10-24), mergiata dal
Coordinatore su richiesta dell'utente a CI verde: le due tabelle, le regole
pure, il catalogo, i tre endpoint, la push `shape_unlocked`, il backfill.
Sul server dopo Apple e con l'ok dell'utente (migrazione, deploy,
`game_backfill` una volta).

**Parte B** in `main` con la #536 (`145cf992`, 2026-10-24), mergiata dal
Coordinatore a CI verde, impronta iOS invariata (misurata su copie pulite).
I testi dell'app approvati dall'utente lo stesso giorno. Su `preview` la
pagina «Play» resta nascosta finché il server non ha la A: è la prova del
gating. **Da provare sull'iPhone** quando la A sarà sul server: i quattro
nomi in alto su uno schermo da 390 pt, la collezione e la scheda dopo un
«Save» vero.

**Restano** le parti C (API: squadre e sfide), D (app: sfide) ed E (app:
striscia in corsa), ognuna con il suo elenco di file al Coordinatore prima
di partire.
