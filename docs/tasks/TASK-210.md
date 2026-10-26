# TASK-210 — La lingua dell'app

**Stato**: Done
**Fase**: 4 · **Branch**: `feat/TASK-210-app-language` (parte A),
`feat/TASK-210-run-screens` (parte B, la corsa), `feat/TASK-210-explore`
(parte C, «Explore»), `feat/TASK-210-draw` (parte D, «Draw»),
`feat/TASK-210-e-run-end-sport` (parte E, la fine corsa, «Sport» e la
voce), `feat/TASK-210-f-shape-names` (parte F, i nomi delle forme, la
mappa e «Help»), `feat/TASK-210-g-page-titles` (parte G, i titoli),
`feat/TASK-210-h-last-texts` (parte H, gli ultimi testi)

## Obiettivo

Chiesto dall'utente il 2026-10-03: «Nelle impostazioni, dai la possibilità
anche di cambiare la lingua dell'App; per intanto fai scegliere le lingue
inglese, tedesco, italiano, spagnolo, francese». Alla fine, in «Settings» si
sceglie la lingua e tutta l'app si mostra in quella, subito.

## Scelte dell'utente (2026-10-03)

- **Le lingue**: inglese, tedesco, italiano, spagnolo, francese, in
  quest'ordine.
- **La lingua di partenza**: quella del telefono, se è una delle cinque;
  altrimenti l'inglese. In «Settings» c'è anche «Phone language» per
  tornare a seguire il telefono. L'iPhone dell'utente, in italiano, vedrà
  l'app in italiano appena aggiornata.

## Numeri e incroci (dal coordinatore, 2026-10-03)

- **ADR-0172**. Prossimi liberi dopo: TASK-211, ADR-0173.
- **A pezzi**, perché tocca un centinaio di file mentre altri lavorano
  nell'app: la **parte A** (questa PR) ha il modulo `src/i18n/`, la riga
  «Language», le quattro tabelle e `t()` solo nei file che nessuno tiene;
  le **parti successive** i file degli altri, dopo il loro merge.
- **Tenuti da altri** al 2026-10-03 (fuori dalla parte A): TASK-191 C
  (`src/settings/sport.ts`, `src/route/`, le schermate della corsa, la
  voce, forse «Explore»), TASK-208 (`RunEnd.tsx`, `PublicParts.tsx`,
  `PublicRow.tsx`, `src/api/drawings.ts`), TASK-209 (la pagina «Data» e i
  file delle frasi dette). `App.tsx`: solo l'aggancio alla lingua.
- **Con TASK-209** (la lingua della voce): un solo elenco di lingue e un
  solo posto per la lingua scelta, `src/i18n/`. La voce segue la lingua
  dell'app se in «Data» non se ne sceglie un'altra. Le frasi dette sono di
  TASK-209; i testi scritti dei file della voce (il banner della svolta)
  si traducono dopo il suo merge. Quello che TASK-209 legge:
  `LANGUAGES`, `Language`, `languageOption(…).speech` (`languages.ts`),
  `appLanguage()`, `subscribeLanguage()` (`language.ts`), `useLanguage()`.

## Contesto da leggere

- `docs/UI.md`, «Cosa è deciso» (la riga dei testi in inglese) e
  «Settings».
- ADR-0007 (la lingua del codice), ADR-0145 (le righe di «Settings»).
- Come l'app ricorda una scelta: `src/settings/sport.ts` (TASK-189).

## Cosa fare

**Parte A** (questa PR):

1. `src/i18n/`: l'elenco delle lingue, la lingua del telefono senza
   dipendenze nuove (`Settings` di React Native su iOS, `I18nManager`
   altrove), la scelta in un file nei documenti come lo sport, `t()`,
   `tLater()`, `tPlural()`, `decimal()`, le quattro tabelle (de, it, es,
   fr) con l'inglese come chiave.
2. La riga «Language» in «Settings», sotto «PREFERENCES» sopra «Units»:
   mostra la lingua dell'app; toccata apre «Phone language» e le cinque,
   ognuna nel suo nome; la scelta vale subito e resta.
3. `App.tsx` chiama `useLanguage()`: una lingua nuova ridisegna tutta
   l'app senza perdere quello che è aperto.
4. I testi dei file liberi dentro `t()`: «Settings», «Profile», l'accesso,
   «My activities», i preferiti, i disegni, il feed, Strava, la ricerca
   del luogo.
5. Un test che legge tutte le chiamate e controlla che ogni lingua abbia
   ogni testo, con gli stessi `{segni}`.
6. ADR-0172, `UI.md`, `STATUS.md`.

**Parti successive** (una PR ciascuna, dopo il merge di chi tiene i file):
«Draw» e `src/route/` (dopo TASK-191 C), «Explore», le schermate della
corsa e la fine corsa (dopo TASK-191 C, TASK-208 e TASK-209), la riga
«Sport» (dopo TASK-191 C), il resto di `App.tsx`, i nomi delle forme in
«Draw».

## Criteri di accettazione

Parte A:

- [x] In «Settings» si sceglie fra «Phone language» e le cinque lingue; la
      scelta vale subito per tutta l'app e resta dopo un riavvio (test).
- [x] Senza scelta, l'app segue la lingua del telefono se è una delle
      cinque, altrimenti l'inglese (test).
- [x] Ogni testo passato da `t()` ha la sua traduzione in de, it, es, fr,
      con gli stessi `{segni}` (test che legge il codice).
- [x] In inglese l'app è byte per byte quella di prima: i test esistenti
      passano; in `SettingsPage.test.tsx` cambia solo il conto dei
      pulsanti, perché «Language» è un pulsante nuovo.
- [x] Nessuna dipendenza nuova.
- [x] Provato nel simulatore: «Settings» in italiano e in tedesco.
- [x] Le traduzioni riviste: l'utente ha delegato il controllo
      all'agente («controlla te, mi fido», 2026-10-03), che le ha rilette
      e corrette nelle quattro lingue.

Parte H (la chiusura):

- [x] Letto tutto il codice dell'app in `main` (`App.tsx` e `src/`) in
      cerca di testi fuori da `t()`: quelli che si vedono o si sentono
      sono tradotti, gli altri sono dati, nomi propri o testi del server
      (elenco nell'esito).
- [x] Con l'app in italiano la partenza di «Draw», le note e le distanze
      di «Explore», i riquadri e «mancano» della corsa, lo sport dei post,
      l'immagine fra i preferiti e il logo dopo «Save» sono in italiano
      (test `i18n/LastTextsItalian.test.tsx`).
- [x] Le mappe del Feed seguono un cambio di lingua (test
      `feed/FeedMapsLanguage.test.tsx`).
- [x] In inglese i testi restano quelli di prima; cambia solo quello che
      VoiceOver dice sulla direzione della corsa («Heading north», come
      nella corsa senza percorso, invece di «Heading N»).
- [x] I testi nuovi approvati dall'utente il 2026-10-25 («va bene
      procedi», su `out/task-210-h-testi.md`).

## File toccati

Parte A:

```
apps/mobile/App.tsx                          (solo useLanguage)
apps/mobile/src/i18n/                        (nuova: index, languages, language,
                                              phoneLanguage, useLanguage, translate,
                                              shapeNames, de, it, es, fr, e i test)
apps/mobile/src/settings/LanguageSetting.tsx       (nuovo)
apps/mobile/src/settings/LanguageSetting.test.tsx  (nuovo)
apps/mobile/src/profile/SettingsPage.tsx
apps/mobile/src/profile/SettingsPage.test.tsx
apps/mobile/src/profile/EditProfile.tsx
apps/mobile/src/profile/PhotoChoices.tsx
apps/mobile/src/profile/PhotoRow.tsx
apps/mobile/src/profile/ProfileHeader.tsx
apps/mobile/src/profile/ProfileHome.tsx
apps/mobile/src/profile/UserProfilePage.tsx
apps/mobile/src/profile/profileFields.ts
apps/mobile/src/profile/useProfilePhoto.ts
apps/mobile/src/account/fields.ts
apps/mobile/src/account/messages.ts
apps/mobile/src/account/useAccount.ts
apps/mobile/src/screens/ProfileLayer.tsx
apps/mobile/src/screens/ProfileScreen.tsx
apps/mobile/src/screens/SignInScreen.tsx
apps/mobile/src/activities/ActivitiesList.tsx
apps/mobile/src/activities/ActivityCard.tsx
apps/mobile/src/activities/activitiesDoor.ts
apps/mobile/src/activities/activityText.ts
apps/mobile/src/favorites/FavoriteHeart.tsx
apps/mobile/src/favorites/FavoritesList.tsx
apps/mobile/src/favorites/favoriteRoute.ts
apps/mobile/src/favorites/favoritesDoor.ts
apps/mobile/src/social/DrawingCard.tsx
apps/mobile/src/social/DrawingsGrid.tsx
apps/mobile/src/social/drawingsDoor.ts
apps/mobile/src/feed/FeedPost.tsx
apps/mobile/src/strava/StravaActivityRow.tsx
apps/mobile/src/strava/StravaParts.tsx
apps/mobile/src/strava/StravaRunEnd.tsx
apps/mobile/src/strava/StravaSetting.tsx
apps/mobile/src/strava/useStrava.ts
apps/mobile/src/api/strava.ts
apps/mobile/src/places/PlaceSearch.tsx
docs/tasks/TASK-210.md
docs/DECISIONS.md
docs/UI.md
docs/STATUS.md
```

Parte D («Draw»):

```
apps/mobile/src/i18n/de.ts, it.ts, es.ts, fr.ts   (voci aggiunte)
apps/mobile/src/route/RoutePanel.tsx
apps/mobile/src/route/problems.ts
apps/mobile/src/route/warnings.ts
apps/mobile/src/route/wordInput.ts
apps/mobile/src/route/ImageChoice.tsx
apps/mobile/src/route/OutlineBoard.tsx
apps/mobile/src/route/LoadingBar.tsx
apps/mobile/src/route/DistanceStepper.tsx
apps/mobile/src/route/RouteTiles.tsx
apps/mobile/src/route/ImagePreview.tsx
apps/mobile/src/route/shareGpx.ts
apps/mobile/src/route/milesTexts.test.ts
apps/mobile/src/route/DrawItalian.test.tsx   (nuovo)
docs/tasks/TASK-210.md
docs/DECISIONS.md
docs/STATUS.md
```

Parte E (la fine corsa, «Sport», la voce di «Dati»):

```
apps/mobile/src/i18n/de.ts, it.ts, es.ts, fr.ts   (voci aggiunte in fondo)
apps/mobile/src/api/drawings.ts
apps/mobile/src/settings/SportSetting.tsx
apps/mobile/src/settings/SportButton.tsx
apps/mobile/src/settings/sport.ts
apps/mobile/src/settings/SportVoiceItalian.test.tsx   (nuovo)
apps/mobile/src/voice/VoiceSetting.tsx
docs/tasks/TASK-210.md
docs/DECISIONS.md
docs/STATUS.md
```

Parte F (i nomi delle forme, la mappa, «Help»; `MapView.tsx` e
`RoutePanel.tsx` aggiunti dal coordinatore il 2026-10-07):

```
apps/mobile/src/i18n/de.ts, it.ts, es.ts, fr.ts   (voci aggiunte in fondo)
apps/mobile/src/i18n/shapeNames.ts
apps/mobile/src/route/shapeWords.ts
apps/mobile/src/route/shapeWords.test.ts
apps/mobile/src/route/RoutePanel.tsx              (una riga in ShapeNote)
apps/mobile/src/route/ShapeNamesLanguages.test.tsx   (nuovo)
apps/mobile/src/explore/recommendedRoutes.ts
apps/mobile/src/explore/ExploreScreen.tsx
apps/mobile/src/explore/ThemedCard.tsx
apps/mobile/src/explore/CityExamples.tsx
apps/mobile/src/explore/ExploreShapeNames.test.tsx   (nuovo)
apps/mobile/src/map/mapStyle.ts
apps/mobile/src/map/mapStyle.test.ts
apps/mobile/src/map/mapPage.ts
apps/mobile/src/map/mapPage.test.ts
apps/mobile/src/map/MapView.tsx
apps/mobile/src/map/MapViewLanguage.test.tsx      (nuovo)
apps/mobile/src/about/documents.ts
apps/mobile/src/about/documents.test.ts
apps/mobile/src/about/AboutPage.tsx
apps/mobile/src/about/AboutPage.test.tsx
apps/mobile/src/about/content/it.ts
apps/mobile/src/about/content/de.ts, es.ts, fr.ts   (nuovi)
docs/tasks/TASK-210.md
docs/DECISIONS.md
docs/STATUS.md
```

Parte H (gli ultimi testi rimasti in inglese, il Feed, la virgola; 2026-10-25):

```
apps/mobile/App.tsx                               (solo startStatus)
apps/mobile/src/i18n/de.ts, it.ts, es.ts, fr.ts   (voci aggiunte in fondo)
apps/mobile/src/i18n/LastTextsItalian.test.tsx    (nuovo)
apps/mobile/src/location/startStatus.ts           (nuovo)
apps/mobile/src/screens/ChooseScreen.tsx
apps/mobile/src/screens/NavigateScreen.tsx
apps/mobile/src/screens/NavigateScreen.test.tsx
apps/mobile/src/screens/RunPanel.tsx
apps/mobile/src/navigation/runStats.ts
apps/mobile/src/intro/SavedLogo.tsx
apps/mobile/src/explore/ExploreScreen.tsx
apps/mobile/src/explore/ThemedCard.tsx
apps/mobile/src/explore/CityExamples.tsx
apps/mobile/src/explore/CityWords.tsx
apps/mobile/src/explore/ExploredCard.tsx
apps/mobile/src/route/RoutePanel.tsx
apps/mobile/src/route/RouteTiles.tsx
apps/mobile/src/route/warnings.ts
apps/mobile/src/units/format.ts
apps/mobile/src/units/format.test.ts
apps/mobile/src/units/shownInMiles.test.tsx
apps/mobile/src/favorites/favoriteRoute.ts
apps/mobile/src/feed/FeedPost.tsx
apps/mobile/src/feed/FeedMaps.tsx
apps/mobile/src/feed/feedMapPage.ts
apps/mobile/src/feed/FeedMapsLanguage.test.tsx    (nuovo)
apps/mobile/src/map/mapPage.ts                    (solo il commento di MAP_STYLE)
docs/tasks/TASK-210.md
docs/DECISIONS.md
docs/STATUS.md
```

## Fuori scope

- Le frasi dette dalla voce: TASK-209.
- I testi che arrivano dall'API (nomi dei percorsi a tema, titoli degli
  esempi, i messaggi d'errore del server) e il nome che il server dà
  all'attività su Strava: restano in inglese; tradurli è un task dell'API.
- Lingue oltre le cinque; le lingue scritte da destra a sinistra.
- Miglia e piedi: TASK-182.

## Esito

**Parte A** (2026-10-03): in `main` con la PR #254 (merge `18fe25c`),
pubblicata su «preview» (gruppo `90bd8c06`, insieme a TASK-212; server
invariato). In «Settings» si sceglie la lingua; senza scelta l'app segue
il telefono. Tradotti «Settings», «Profile», l'accesso, «My activities», i
preferiti, i disegni, il feed, Strava e la ricerca del luogo; provata nel
simulatore con il telefono in italiano (italiano all'avvio, «Deutsch»
subito, resta dopo un riavvio). Le traduzioni le ha riviste l'agente su
delega dell'utente.

**Parte B — la corsa** (2026-10-06, dopo la revisione del codice
dell'app; chiesta dall'utente: «parti con le traduzioni di TASK-210»):
`NavigateScreen`, `FreeRunScreen`, `RunDashboard`, `RunPanel`,
`FinishScreen`, `Countdown`, `HoldButton`, `PocketScreen`, `MapScreen`,
`navigation/runStats.ts` (i punti cardinali e «about 17 min»), più i km
con la virgola in `phrases.distanceLabel`. 58 testi nuovi nelle quattro
tabelle (`out/task-210-corsa-testi.md` sul Mac per l'occhio dell'utente);
«Back», «Cancel», «Time», «Distance», «Pace», «Last km», «Speed now»,
«Avg speed» e le due righe della legenda erano già tradotti. **Il banner
della svolta** non ha più un costruttore inglese suo: `NavigateScreen`
scrive la svolta con il frasario della voce nella lingua dell'app
(`wordsOf(useLanguage())`, TASK-209), così una via si dice e si legge
allo stesso modo, e la seconda riga è «Poi …» con `t("Then {directions}")`;
`phrases.instruction`/`thenText` restano per i loro test, da togliere con
«Draw». Test: `screens/RunItalian.test.tsx` (banner, fine corsa, numeri,
bottone, tempi in italiano); `RunBike`, `RunPaddle`, `RunMiles` cercano
la scheda «Dati» dove sono in italiano. **Testi approvati dall'utente**
il 2026-10-06 («vanno bene i testi»).

**Parte C — «Explore»** (2026-10-06, chiesta dall'utente: «parti con
«Explore» di TASK-210»): `AskForRoute`, `CityExamples`, `ExploreScreen`,
`ExploreStart`, `ExploreTools`, `ExploredCard`, `ThemedCard`,
`WhileDrawing`, `RouteCard` (il credito delle mappe è ora una funzione,
`cardMapsCredit()`), `presets` (le categorie si vedono tradotte con
`tLater`/`t`, **la richiesta all'API resta in inglese**: «Food in New
York»; «near your start», «in {city}», il suggerimento del campo),
`useStartDirections`, `useThemedRoute`. 64 testi nuovi nelle quattro
tabelle (`out/task-210-explore-testi.md` sul Mac); «Try again», «Back»,
«Cancel», «Next», «Drawing…», «Near me», «Back to the list», «Not drawn»
erano già tradotti. I km nei testi («Starting within 5 km», «Drawing a 2
km heart») restano scritti come prima, con la virgola della lingua
(`kmOrMiles`), e con le miglia passano da `distanceLabel` (prima
`ExploredCard` scriveva i km anche con le miglia). Test:
`explore/ExploreItalian.test.tsx` (categorie tradotte e richiesta
inglese, frasi del percorso a tema e delle indicazioni, credito). I nomi
delle città e i nomi dei percorsi dell'API restano com'è. **Testi
approvati dall'utente** il 2026-10-06 («va bene procedi»).

**Parte D — «Draw»** (2026-10-06, branch `feat/TASK-210-draw`, in
parallelo con la parte C «Explore» di un'altra sessione): `RoutePanel`
(etichette «DRAW»/«LETTERS»/«DISTANCE», lo switch forma/parola/immagine,
le lettere tonde o quadrate, la penna alzata, le note sotto i campi,
l'attesa, «Draw route», «Start», «Export GPX»), `problems.ts` (tutti i
testi d'errore in km, le ragioni di una foto rifiutata e di una linea
rifiutata con `tLater`), `warnings.ts` (gli avvisi del motore; la
direzione dello start spostato usa le stesse parole dei punti cardinali
della corsa, `t("north-east")`; «1.2 km» del motore scritto «1,2 km»),
`wordInput.ts`, `ImageChoice`, `OutlineBoard`, `LoadingBar` (quello che
VoiceOver legge), `DistanceStepper`, `RouteTiles`, `ImagePreview`,
`shareGpx` (il titolo del foglio di condivisione). **101 testi nuovi**
nelle quattro tabelle (`out/task-210-draw-testi.md` sul Mac per l'occhio
dell'utente); «Cancel», «Save», «On», «Off», «Try again», «Try {km} km»,
le righe in miglia di TASK-182 e i punti cardinali erano già tradotti.
`milesTexts.test.ts` aspettava il testo in km ancora in inglese: ora
quello in italiano. Test: `route/DrawItalian.test.tsx` (pannello,
parola, attesa, forma che non sta, foto, avvisi, pulsanti in italiano).
**Non tradotti, di proposito**: i nomi delle forme («heart», «dog head»
nelle tessere, nel campo e in «Drawing a 5 km heart…») e il segnaposto
«cuore, stella, cavallo…» con parole che in de/es/fr `shapeWords.ts`
non conosce (vanno all'AI): sono la parte «nomi delle forme». «Vai a
«Parti da qui»» nell'avviso dello start spostato: la parte di
`mapPage.ts` deve chiamare così «Start here» (de «Hier starten», es
«Empieza aquí», fr «Départ ici»). **Testi approvati dall'utente** il
2026-10-06 («va bene procedi»); in `main` con la PR #421 (merge `438c019`, 2026-10-06), job `mobile` verde; la pubblicazione su «preview» è del coordinatore.

**Da fare nelle parti successive** (dopo le parti C e D, entrambe in
`main` il 2026-10-06): i nomi delle forme sulle schede di «Explore»
(`routeTitle` dà l'inglese, «dog head»: `shapeLabel` lo tradurrebbe), la
fine corsa di TASK-208 (`RunEnd.tsx`,
`PublicParts.tsx`, `PublicRow.tsx`, `api/drawings.ts`), `VoiceSetting.tsx`,
`SportSetting`/`SportButton`/`sport.ts`, i titoli delle pagine in
`App.tsx`, i nomi delle forme in «Draw» (`shapeWords.ts` sa solo
inglese e italiano: «Herz», «cœur» vanno all'AI), i nomi sulla mappa
forzati in italiano (`mapStyle.ts`) e «Start here» nella pagina della
mappa (`mapPage.ts`), «Help» in de/es/fr.

**Parte E — la fine corsa, «Sport» e la voce** (2026-10-07, assegnata
dal coordinatore con `main` a `aea84e4`; branch
`feat/TASK-210-e-run-end-sport`, PR #433, in parallelo con TASK-182 parte E, che
tiene `App.tsx`). **La fine corsa** era già quasi tutta in `t()`:
TASK-208 B (#425) aveva scritto i suoi testi di `RunEnd`, `PublicParts`
e `PublicRow` già tradotti. Restavano i messaggi di `api/drawings.ts`
(nessuna connessione, la sessione scaduta, la corsa non più fra le
attività): ora passano da `t()`, con traduzioni che c'erano già (quelle
di Strava). **«Sport»** (`SportSetting`, `SportButton`, `sport.ts`): i
nomi degli sport restano inglesi in `SPORTS`, marcati con `tLater`, e si
mostrano con `t(name)`, con le parole delle schede «Activity» della fine
corsa («Corsa», «Bici», «Pagaia»); tradotti anche l'etichetta «SPORT»,
«Soon», quello che legge VoiceOver sul pulsante dello sport e sul suo
menu. **La voce di «Dati»** (`voice/VoiceSetting.tsx`): la riga, «Listen»,
il foglio con «Language», «App language», «Voice», «Default», le due note
(telefono senza voci, lingua senza voce), «Enhanced» con il nome che usa
iOS in ogni lingua («Migliorata», «Erweitert», «Mejorada», «Améliorée»),
«Done». I nomi delle lingue restano ognuno nel suo («Deutsch» anche
nella frase italiana), i nomi delle voci come li dà il telefono. **16
testi nuovi** nelle quattro tabelle, in fondo; «Run», «Bike», «Paddle»,
«Close», «Language», «Voice», «Done» e i tre messaggi di `drawings.ts`
erano già tradotti. Test: `settings/SportVoiceItalian.test.tsx` («Sport»
in «Settings» e nel menu, «In arrivo», la voce di «Dati» con «Voce» spenta
e accesa, i messaggi di `drawingProblem`). **Non tradotti, di
proposito**: il messaggio `invalid_request` dell'API (le parole del
server, fuori scope) e «Paddle ·» dei post d'esempio del feed
(`feed/FeedPost.tsx`, `PADDLE`), che legge il nome inglese di `SPORTS`:
fuori dai file di questa parte, resta un seguito. **Testi approvati
dall'utente** il 2026-10-07 («va bene procedi»); la pubblicazione su
«preview» è del coordinatore.

**Parte G — i titoli delle pagine** (2026-10-08, branch
`feat/TASK-210-g-page-titles`, su `main` dopo TASK-182 parte E, che
teneva `App.tsx`; via del coordinatore «parti con la G»): i tre nomi in
alto, quelli che si toccano per cambiare pagina, escono da un file nuovo,
`screens/pageTitles.ts` (`pageTitle("feed" | "draw" | "explore")`, i nomi
inglesi con `tLater`), e `App.tsx` li chiama al posto delle tre stringhe.
«Feed» resta «Feed» in it/de/es, «Fil» in fr; «Disegna», «Zeichnen»,
«Dibuja», «Dessiner»; «Esplora», «Entdecken», «Explora», «Explorer»: le
stesse parole di «DISEGNA» e di «Esplora» già dentro l'app. Tre testi
nuovi in fondo alle quattro tabelle (`out/task-210-titoli-testi.md` sul
Mac per l'occhio dell'utente). Test: `screens/pageTitles.test.ts` (le
cinque lingue). **Non in questa parte**: «Paddle ·» e il nome della forma
in `feed/FeedPost.tsx`, che TASK-118 tiene: dopo il suo merge, come
secondo commit se la PR è ancora aperta, altrimenti seguito; la guida
«Help» in italiano chiama ancora le pagine «Draw» ed «Explore»
(`about/content/it.ts`): un rigo per la parte «Help», che tiene quei file.

**Dopo la parte G restano**: i nomi delle forme in «Draw» e sulle schede
di «Explore», i nomi sulla mappa (`mapStyle.ts`) e «Start here»
(`mapPage.ts`), «Help» in de/es/fr (parte F, in corso in un'altra
sessione), «Paddle ·» nel feed dopo TASK-118.

**Parte F — i nomi delle forme, la mappa e «Help»** (2026-10-07/08,
chiesta dall'utente e approvata dal coordinatore; branch
`feat/TASK-210-f-shape-names` da `main` `aea84e4`, portato su `5a22f2d`
dopo la parte E). **I nomi delle forme**: `shapeWord()` in
`i18n/shapeNames.ts` dà il nome dentro una frase dal nome con la
maiuscola della parte A («Hundekopf», «testa di cane», «cabeza de
perro», «tête de chien»; in inglese «dog head» come prima). Lo usano le
schede di «Explore» (`routeTitle`, anche «Drawing a 2 km heart» e «heart
· Trento · looks 87% like it»), il percorso a tema (`ThemedCard`, che
scriveva tutta la riga in inglese) e «Draw»: le tessere, il campo, «→
Herz» sotto il campo (confronto senza maiuscole in `RoutePanel`), la
lista di «Unknown shape. Try: …» con la «o» della lingua.
`CityExamples` prende il nome da `i18n/shapeNames` e non più da
`feed/FeedPost`. **`shapeWords.ts`** conosce le parole delle forme nelle
cinque lingue, qualunque sia quella dell'app, con gli articoli («ein
Herz», «l'étoile», «el sol»), gli accenti e la «œ» letti senza
differenza: «Herz» e «cœur» non vanno più all'AI, e il segnaposto
«Herz, Stern, Pferd…» della parte D ora nomina forme che il campo
conosce. **La mappa**: i luoghi nella lingua dell'app (`name:xx`, poi il
nome del posto; prima sempre `name:it`), «Start here» come «Hier
starten», «Parti da qui», «Empieza aquí», «Départ ici» (le parole già
approvate nella parte D); `MapView` rifà la pagina quando la lingua
cambia. Provata nel browser con le tile vere di OpenFreeMap: «Mailand»,
«Rom», «Neapel» in tedesco, «Milan», «Gênes», «Trente» e il cartello
«Départ ici» in francese. Le mappe del Feed (`MAP_STYLE`) prendono la
lingua dell'apertura. **«NEAR TRENTO»** sopra i percorsi dei vicini, rimasto
inglese dalla parte C, ora tradotto. **«Help», «Terms» e «Privacy»** in
tedesco, spagnolo e francese (`about/content/{de,es,fr}.ts`, stesse
sezioni dell'inglese, con i nomi dei pulsanti che l'app mostra in quella
lingua); per scelta dell'utente del 2026-10-07 «Terms» e «Privacy» sono
tradotti e restano **bozze**, con gli stessi segnaposto da riempire.
Le parole delle forme tengono anche quelle della lista preparata dalla
sessione «Traduzioni TASK-210» (`out/task-210-forme-testi.md`), tranne
«Tannenbaum», «sapin», «Krapfen», «beignet», «pescado», «chatte».
«Help» in italiano ora nomina i pulsanti tradotti dalle
parti B e D («Disegna il percorso», «Esporta GPX», «Parti», «Pausa»,
«Riprendi», «Scarta»), e i testi delle quattro lingue chiamano le pagine
come i titoli della parte G (#437, su richiesta del coordinatore): it
«Feed», «Disegna», «Esplora»; de «Feed», «Zeichnen», «Entdecken»; es
«Feed», «Dibuja», «Explora»; fr «Fil», «Dessiner», «Explorer». **4 testi nuovi** in fondo alle tabelle: «{list}
or {last}», «Start here», «NEAR {city}», «here»; più «Help», «Terms» e
«Privacy» in tre lingue. Test: `route/ShapeNamesLanguages.test.tsx`,
`explore/ExploreShapeNames.test.tsx`, `map/MapViewLanguage.test.tsx`, e
in `shapeWords.test.ts`, `mapStyle.test.ts`, `documents.test.ts`,
`AboutPage.test.tsx`. **Testi approvati dall'utente** il 2026-10-08 («va
bene procedi», su `out/task-210-f-testi.md`); PR #438, la pubblicazione su
«preview» è del coordinatore.

**Seguiti notati nella parte F**: in francese «near your start» è «près
de vous» mentre il resto dell'app dà del «tu»; la bozza italiana di
«Privacy» cita ancora «Discard» (testo legale, dell'utente). «NEAR YOUR
START» della canoa è già tradotto (`t("Near your start")` in maiuscolo).

**Dopo le parti F e G restano**: il nome della forma e «Paddle ·» nel
Feed (`feed/*`, ora che TASK-118 è in `main` con la #439), le mappe del
Feed che seguono un cambio di lingua.

**Parte H — gli ultimi testi** (2026-10-25, branch
`feat/TASK-210-h-last-texts` da `main` `db3d2a79`; chiesta dalla sessione
«Attività rimanenti» sulla revisione dei task aperti fatta dall'utente).
Prima un controllo di tutto il codice dell'app (`App.tsx` e `src/`, con un
lettore TypeScript dei testi fuori da `t()`, come `tables.test.ts`): i
testi rimasti in inglese erano scritti prima delle parti B–D o in file
che le parti non elencavano. **«Draw»**: la riga sotto la partenza
(«Parti dalla tua posizione.», «Parti da {place}.», il GPS spento, la
posizione che non arriva) esce da un file nuovo,
`location/startStatus.ts`, al posto di `statusText` di `App.tsx`;
«PARTENZA», «La mia posizione», «Un altro posto» in `ChooseScreen`.
**«Explore»**: la nota senza percorsi consigliati, «a 1,4 km» sotto le
schede (`awayText`), «dove sei» nella richiesta, l'attesa del percorso a
tema. **La corsa con il percorso**: «47% disegnato», la direzione in
lettere della lingua («SO», «O»; in tedesco «NO», «O»), «mancano 3,2 km»;
VoiceOver sulla direzione dice la parola, «Direzione nord-est», come la
corsa senza percorso. **Il Feed**: «Pagaia ·», «Bici ·» davanti ai fatti
del post (`t()` sul nome di `SPORTS`, parte E); il nome della forma era
già tradotto dalla parte F. Le mappe del Feed seguono un cambio di lingua:
la pagina delle foto si rifà con `mapStyle(lingua)` e una foto in un'altra
lingua è un'altra foto (`…/it` nella chiave, come `@bearing` per una mappa
girata); tornando alla lingua di prima le foto già fatte restano. **Altro**:
un'immagine fra i preferiti si chiama «Immagine» (il titolo salvato resta
«Image», è un dato); VoiceOver dopo «Save» dice «Salvata nelle mie
attività». **La virgola**: le schede di «Explore» e i risultati di
«Draw» passavano `withPoint` finché i loro testi erano in inglese
(ADR-0182, TASK-182); ora sono tradotti e scrivono «5,2 km», anche in
miglia; `withPoint` non serve più ed è tolto. La distanza di una corsa
a due decimali resta col punto, come deciso in TASK-182. **23 testi
nuovi** in fondo alle quattro tabelle (`out/task-210-h-testi.md` sul Mac
per l'occhio dell'utente); «Run without a route», «Finding your
position…», «your start», «Heading {direction}», «Paddle», «Bike» e
«Image» erano già tradotti. Test: `i18n/LastTextsItalian.test.tsx`,
`feed/FeedMapsLanguage.test.tsx`; in `NavigateScreen.test.tsx`
«Heading north» al posto di «Heading N», in `shownInMiles.test.tsx`
«Explore» in italiano con la virgola («a 1,4 km»). **Testi approvati
dall'utente** il 2026-10-25 («va bene procedi»), con i titoli dei post
d'esempio lasciati in inglese. **Lasciati in inglese, di
proposito**: i titoli dei post d'esempio del Feed (sono i titoli di
corridori inventati, come quelli che scrive un iscritto), i nomi delle
città nelle scorciatoie di «Explore» (parte C), «STRAVA», «MuW», i
crediti delle mappe, i dettagli tecnici degli errori (`devDetail`).

**Seguiti, fuori da TASK-210** (da aprire come task propri se serve):

- **Le traduzioni dell'API**: i nomi dei percorsi a tema e dei titoli
  degli esempi, i messaggi d'errore del server (`invalid_request` e gli
  altri `message`), il nome che il server dà all'attività su Strava
  (`strava.py` `activity_name`, che l'app mostra anche come suggerimento),
  i testi delle notifiche push e delle email (TASK-262, 284, 291). Serve
  che l'app mandi la sua lingua (per esempio `Accept-Language`) e che il
  server abbia le sue tabelle: è un task dell'API, come dice «Fuori
  scope».
- **Il francese dà del «tu» e del «vous»**: 51 righe di `fr.ts` col
  «tu», 36 col «vous» («Recherche de votre position…», «près de vous»,
  lo stretching). Scegliere uno dei due è una scelta di prodotto
  dell'utente; poi un passaggio su `fr.ts`.
- **La bozza italiana di «Privacy»** cita ancora «Discard» (testo legale,
  dell'utente; dalla parte F).
- I titoli dei post d'esempio del Feed, se l'utente li vuole tradotti
  (19 titoli in quattro lingue).

**Esito** (2026-10-25): **Done.** L'app è nella lingua scelta in ogni
pagina: le parti A–H sono in `main` (A #254, B #414, C #420, D #421, E #433, F
#438, G #437, H #545, merge `52953c47`). Restano fuori, come seguiti, i testi del
server e la scelta fra «tu» e «vous» in francese.
