# TASK-367 — La navigazione come Instagram: la barra in basso e un header solo

**Stato**: In lavorazione — parti A e B in main; C col via del Coordinatore dopo la C2 del nuoto
**Fase**: 4 · **Branch**: `docs/TASK-367-tab-bar` (documenti),
`feat/TASK-367-a-tab-bar` (parte A) · **ADR**: ADR-0311 · numeri dal
Coordinatore (2026-11-02)

## Obiettivo

Le pagine dell'app smettono di stare una accanto all'altra con i nomi in alto
(TASK-154, ADR-0124). Al loro posto:

- una **barra in basso** con cinque icone senza testo: Feed, Draw, Messages,
  Explore, il cerchio del profilo;
- un **header solo**, uguale in ogni pagina: il logo MuW a sinistra, lo sport a
  destra (la campanella con la parte C).

Il contenuto di Feed, Draw ed Explore non cambia: cambiano solo come ci si
arriva e dove stanno le cose. La richiesta è dell'utente (un brief del
2026-11-02).

## Contesto da leggere

- ADR-0124 (le pagine affiancate), ADR-0293 e `tasks/TASK-339.md` (il look
  premium: il giallo vuol dire solo il percorso).
- `screens/Pager.tsx`, `App.tsx` dove monta il Pager, `tour/tourSteps.ts`.
- `messages/messagesDoor.ts` (TASK-319): i messaggi sopra l'app.
- `profile/ProfileHome.tsx`, `profile/SettingsPage.tsx`.
- `notifications/notificationTap.ts`: cosa apre una notifica toccata.

## Cosa c'è oggi

Letto il codice di `main` (`8bdd3348`) il 2026-11-02.

- `Pager` affianca quattro pagine: `feed`, `choose`, `explore`, `profile`. Uno
  swipe o un nome nell'header portano alla pagina; il profilo non ha nome, ci si
  arriva dal suo cerchio. In alto a destra: `SportButton` e `ProfileButton`.
- Le pagine si costruiscono la prima volta che si raggiungono (`lazy`) e poi
  restano montate: scroll e campi non si perdono.
- La mappa, la corsa e «Play» prendono tutto lo schermo e il Pager non c'è
  (`page === -1`).
- **I messaggi privati esistono** (TASK-319): lista e conversazioni sopra
  l'app, aperte dalla riga «Messages» del Profilo, da «Message» sul profilo di
  un altro e da una notifica. `unread` dice quante conversazioni aspettano.
- Il Profilo ha foto, nome, `ProfileStats` (distanza, dislivello, like:
  TASK-324, ADR-0284), le righe Favorites, My activities, Messages, Settings,
  e la griglia dei disegni.
- La lente in alto a destra nel Feed è `FindFriendsButton` (TASK-215);
  TASK-344 B la fa aprire alla ricerca dei disegni.
- **Il server non tiene una lista delle notifiche**: le push partono e basta.
  `email_notices` (TASK-262 B, migrazione 0028) conserva gli eventi solo per
  chi ha l'email riassuntiva, e li svuota dopo l'invio.
- Nessuna libreria di icone nell'app; nessun `expo-blur`.

## Scelte dell'utente

Una alla volta, con le sue parole.

1. **L'immagine della barra e dell'header**, nei due toni, coi colori dei
   token: la scheda attiva in bianco (il testo), le altre in `textFaint`, non
   in giallo, perché il giallo è del percorso (ADR-0293); il pulsante giallo di
   «Draw» sopra la barra; sfondo della barra semitrasparente, senza blur vero
   (servirebbe una build).
   — *Risposta:* «Sì, così».
2. **La campanella.** Una schermata vuota segnaposto non va agli utenti
   (Coordinatore). Proposte: aspettare una lista vera sul server (parte C), o
   mostrare solo le push rimaste nel Centro notifiche di iOS.
   — *Risposta:* «Aspetta la lista vera».
3. **Le icone.** Proposte: PNG prese da Lucide (licenza ISC), colorate dai
   token, senza dipendenze nuove; oppure `@expo/vector-icons`, dipendenza nuova
   da verificare sull'impronta iOS.
   — *Risposta:* «PNG da Lucide».
4. **I testi.** Nessun testo nuovo nella parte A: le etichette di VoiceOver
   riusano nomi già tradotti nelle cinque lingue: Feed, Draw (Disegna), Messages
   (Messaggi), «Messages, {count} waiting», Explore (Esplora), Profile
   (Profilo), Settings (Impostazioni); il logo è «MuW». I testi della ricerca
   in Explore vengono con la parte B.
   — *Risposta:* «Sì, approvo».
   **Da rivedere prima del codice**: la Guida (`about/content/*.ts`) descrive
   la navigazione di oggi: «quattro pagine affiancate… scorri a sinistra o a
   destra», i messaggi «in Profile, Messages», lo sport «accanto al profilo».
   Con la parte A queste frasi diventano false: vanno riscritte nelle cinque
   lingue, testi nuovi da far approvare all'utente prima della parte A.
6. **Le frasi nuove della Guida**, in italiano (le altre lingue con lo stesso
   senso, nel codice della parte A):
   - «Cos'è MuW»: «In basso ci sono cinque schede: «Feed», «Disegna»,
     «Messaggi», «Esplora» e il tuo profilo, il cerchio con la tua foto. Tocca
     una scheda per andarci, toccala di nuovo per tornare in cima. Le
     «Impostazioni» sono sotto l'ingranaggio in alto a destra del tuo profilo.»
   - «Messaggi»: «Le tue conversazioni sono in «Messaggi», la scheda con
     l'aereo di carta, con «Richieste di messaggio» in cima…» (il resto uguale).
   - «Corsa, bici, canoa»: «Scegli lo sport con il pulsante in alto a destra, o
     in «Impostazioni».»
   Le due frasi sulla lente del Feed (Guida e privacy, «Find friends in your
   contacts») cambiano con la parte B, insieme alla data della privacy.
   — *Risposta:* «Sì, approvo» (2026-11-03).
5. **Le statistiche del Profilo.** Il brief chiede corse, km totali e disegni;
   oggi sono distanza, dislivello e like (ADR-0284). Proposta: restano come
   oggi; corse e disegni vorrebbero un cambio all'API e testi nuovi.
   — *Risposta:* «Sì, restano».

## Cosa fare

### Parte A — la barra, l'header, i messaggi, l'ingranaggio (solo app)

Dopo il merge di TASK-355 A e TASK-362 (toccano `App.tsx` e `FeedScreen`), col
via del Coordinatore. 339 C va in parallelo; 339 D (Profilo, `SettingsPage`)
viene dopo.

1. `assets/ui/tabs/`: house, pencil, send, search, settings da Lucide, in PNG
   bianche @1x @2x @3x, contorno per le inattive e pieno o tratto più spesso per
   l'attiva. Lucide è sotto licenza ISC: il suo testo sta accanto alle PNG, in
   `assets/ui/tabs/LICENSE-lucide.txt`. Il colore viene da `tintColor` e dai
   token.
2. `tabs/TabBar.tsx` (nuovo): cinque `Tap`, `accessibilityRole="tab"`, sopra
   l'home indicator (`insets.bottom`); sfondo `surface` semitrasparente e una
   `hairline` sopra. Il cerchio del profilo con la foto, un bordo `text` quando
   è attivo. Un pallino su Messages quando `unread` lo dice.
3. `tabs/AppHeader.tsx` (nuovo): il cuore e «MuW» a sinistra, `SportButton` a
   destra, sotto la Dynamic Island.
4. `tabs/TabShell.tsx` (nuovo) al posto di `Pager` in `App.tsx`: le pagine
   restano montate dopo la prima visita (scroll e campi non si perdono); niente
   swipe fra le pagine. Il tocco sulla scheda già attiva torna in cima o alla
   radice di quella pagina. Le pagine ricevono un'altezza libera sopra la barra,
   così il pulsante giallo di «Draw» resta sopra.
5. La barra e l'header non ci sono dove oggi non c'è il Pager: mappa, corsa,
   corsa senza percorso, «Play», e la corsa interrotta riaperta (TASK-272).
6. Messages diventa una pagina: la lista di oggi (`ConversationList`) dentro la
   scheda; una conversazione si apre sopra come oggi. `messagesDoor` continua ad
   aprire la lista e le conversazioni da una notifica e da «Message»: aprire la
   lista porta alla scheda.
7. Profilo: l'ingranaggio in alto a destra apre `SettingsPage`; la riga
   «Messages» esce dal Profilo (c'è la scheda). Nessuna voce di Settings si
   perde.
8. Il tour della prima apertura (`tourSteps.ts`, `tourParts.ts`) indica le
   schede della barra invece dei nomi in alto.
9. «Riduci movimento» rispettato (`useReduceMotion`); su Android il tasto
   indietro torna alla scheda di prima prima di uscire.
10. La lente del Feed resta dov'è fino alla parte B.

### Parte B — la ricerca in Explore

Dopo 344 B e coordinata con TASK-362, che ha la lente accanto alle schede del
Feed: la barra di ricerca in cima a Explore, la lente esce dal Feed. Testi da
approvare.

Fatta così (2026-11-04, via del Coordinatore): in cima a «Explore», anche
sull'acqua, un campo con la lente della barra e il testo già tradotto
«Search drawings, people, places» apre la ricerca di TASK-344; la lente esce
dal Feed (`FindFriendsButton` tolto). Un esempio del Feed trovato da
«Explore» si apre come dal Feed (`fetchPostRoute`): due props in `App.tsx`,
dopo la #722. Nessun testo nuovo nell'app; la frase della Guida sulla lente e
quella della privacy su «Trova amici nella rubrica» con il sì dell'utente.

Testi approvati dall'utente il 2026-11-04, nelle 5 lingue di `about/content`:

- Guida, alla proposta «La ricerca in cima a «Esplora» trova gli altri
  iscritti per nome. Su un profilo puoi toccare «Segui»; le richieste, chi ti
  segue e chi segui sono in «Profilo».» l'utente ha risposto: «Sì, approvo».
- Privacy, alla proposta «In «Feed», «Trova persone da seguire» porta a
  «Trova amici nella rubrica», che cerca gli iscritti il cui numero è nella
  rubrica del tuo telefono. L'app chiede la rubrica al telefono solo quando lo
  tocchi, e ne legge solo i numeri di telefono: mai nomi, email o foto.»
  l'utente ha risposto: «Sì, approvo».

`site/privacy` rigenerato con `make_privacy.mjs` su main dopo la #724
(ac3f1228). Copia del sito e OTA: le chiede il Coordinatore all'utente.

File toccati della parte B (approvati dal Coordinatore):

```
apps/mobile/src/explore/ExploreSearch.tsx                    (nuovo)
apps/mobile/src/explore/ExploreScreen.tsx, ExploreScreen.test.tsx, ExploreHeart.test.tsx
apps/mobile/src/paddle/PaddleExplore.tsx
apps/mobile/src/screens/FeedScreen.tsx, FeedScreen.test.tsx, ProfileLayer.test.tsx
apps/mobile/src/social/FindFriendsButton.tsx, .test.tsx      (tolti)
apps/mobile/src/search/Glyphs.tsx                            (un commento)
apps/mobile/src/search/SearchScreen.tsx, SearchScreenInset.test.tsx (nuovo)  (sotto la barra di stato, via del Coordinatore)
apps/mobile/App.tsx                                          (dopo la #722: onOpenExample)
apps/mobile/__tests__/AppFeed.test.tsx                       (il test di onOpenExample)
apps/mobile/src/about/content/*.ts, site/privacy/**          (col sì dell'utente; il sito dopo la #724)
docs/UI.md, docs/DECISIONS.md, docs/STATUS.md, docs/tasks/TASK-367.md
```

### Parte C — la campanella con le notifiche vere

Il server tiene una riga per ogni evento che oggi manda una push (reazioni,
commenti, follow e richieste, tag, sfide, concorsi; i messaggi no, hanno la
loro scheda), `GET /notifications` con il conto dei non letti e la lettura.
Nell'app la campanella con il badge `badge`, la lista, e ogni riga apre ciò che
apre oggi la push (`notificationTap`). Migrazione col primo numero libero al
merge; server e migrazione con il sì dell'utente; testi da approvare.

Divisa dal Coordinatore il 2026-11-04 in **C1** (solo API, adesso) e **C2**
(la campanella nell'app, dopo la #734). C1: `notification_list.py`, un
«listener» del `Pusher` come `notice_email.py`, scrive una riga per ogni
evento lasciato passare (tutti i tipi delle push tranne i messaggi, push
accese o spente); `GET /notifications` (30 alla volta, `before`, `unread`,
il testo della push nella lingua dell'account, `opens` = il `data` della
push, fuori quello che non è più vero) e `POST /notifications/read`
(`up_to`). Migrazione `0045_notifications` (numero del Coordinatore). Le
righe si tengono `KEPT_DAYS` = 90 giorni: la durata e la frase della
privacy sono da approvare con l'utente.

File toccati della parte C1:

```
services/api/migrations/0045_notifications.sql               (nuovo)
services/api/shaperoute_api/notification_list.py             (nuovo)
services/api/tests/test_notification_list.py                 (nuovo)
services/api/shaperoute_api/app.py                           (una riga, dopo install_push)
packages/shared-types/src/index.ts                           (un blocco in fondo)
packages/shared-types/fixtures/notifications.json            (nuovo)
packages/shared-types/test/notifications.test.ts             (nuovo)
docs/API.md, docs/DATABASE.md, docs/DECISIONS.md, docs/STATUS.md, docs/tasks/TASK-367.md
apps/mobile/src/about/content/*.ts, site/privacy/**          (la frase sulla durata, col sì dell'utente)
```

## Criteri di accettazione (parte A)

- [ ] Nessun nome di pagina in alto; header uguale su Feed, Draw, Messages,
      Explore e Profile.
- [ ] Cinque schede con etichetta VoiceOver e stato `selected`; il tocco sulla
      scheda attiva torna in cima: test.
- [ ] Cambiare scheda non rimonta le pagine e non perde scroll né campi: test.
- [ ] Il pulsante «Draw» resta tutto sopra la barra, su iPhone con e senza home
      indicator.
- [ ] Nessuna barra su mappa, corsa, corsa senza percorso, «Play» e corsa
      riaperta (TASK-272): test.
- [ ] Una notifica toccata apre ancora disegno, profilo, conversazione, sfida,
      concorso (`notificationTap`): test.
- [ ] Ogni voce di Settings raggiungibile dall'ingranaggio.
- [ ] Nessun colore a mano, nessuna dipendenza nuova, impronta iOS `83793e26`
      invariata su una copia pulita (e `6f8bba4c` della 1.0.1).
- [ ] Prima e dopo dal simulatore, in scuro e in chiaro.

## File toccati

Questa PR:

```
docs/tasks/TASK-367.md                (nuovo)
docs/DECISIONS.md
docs/STATUS.md
docs/INDEX.md
```

Parte A (lista aggiornata il 2026-11-04 e mandata al Coordinatore prima della
PR):

```
apps/mobile/App.tsx
apps/mobile/assets/ui/tabs/**                         (nuovi)
apps/mobile/src/tabs/**                               (nuovi)
apps/mobile/src/messages/messagesDoor.ts
apps/mobile/src/profile/ProfileHome.tsx
apps/mobile/src/screens/ProfileLayer.tsx, pageTitles.ts
apps/mobile/src/screens/FeedScreen.tsx                (una riga: in cima al tocco)
apps/mobile/src/explore/ExploreScreen.tsx             (una riga: in cima al tocco)
apps/mobile/src/paddle/PaddleExplore.tsx              (una riga: in cima al tocco)
apps/mobile/src/tour/TourScrollView.tsx               (una riga: in cima al tocco)
apps/mobile/src/about/content/*.ts                    (le frasi della Guida)
apps/mobile/src/screens/Pager.tsx, Pager.test.tsx     (tolti)
test che premevano le pagine per nome o il cerchio del profilo:
  apps/mobile/__tests__/App*.test.tsx, src/screens/ProfileLayer.test.tsx,
  ProfileEntryPoints.test.tsx, src/account/Profile.test.tsx,
  src/tour/GuideInProfile.test.tsx, src/feed/FeedPostPhotos.test.tsx
docs/UI.md, docs/DECISIONS.md, docs/STATUS.md, docs/tasks/TASK-367.md
```

## Fuori scope

- Il contenuto di Feed, Draw ed Explore; «Run without a route» resta nella
  pagina di «Draw».
- Il blur vero (`expo-blur`, nativo): con una build, col sì dell'utente.
- Le schermate dell'App Store (TASK-328): si rifanno dopo, a parte.
- Un OTA di produzione: con il sì dell'utente.

## Esito

**Parte A** (2026-11-04, PR #716, al posto della #714): barra in basso, header unico, «Messages»
come scheda, ingranaggio nel Profilo, Pager tolto. Suite dell'app verde (590
file di test), impronta iOS `83793e26` prima del riallineamento e `6f8bba4c`
dopo la #620. Simulatore (iPhone 17e, Expo Go): schermate in
`docs/tasks/TASK-367/` (scuro e chiaro); il tocco sulla scheda attiva riporta
Draw in cima; «Messages» senza account porta al profilo; il tour indica lo
sport nell'header e poi Explore e Feed. Il «prima» (main `6dc89cfa`) è in
`before-*.jpg` nella stessa cartella, Draw e Feed nei due toni. Non visto nel simulatore: il
Profilo con l'account (ingranaggio) e la scheda Messages piena, coperti dai
test. Draw ed Explore tengono il loro logo nella pagina, sotto quello nuovo
dell'header: scelta dell'utente del 2026-11-04 («Lascialo»).

**Parte B** (2026-11-04, PR #729, in main 99bca40c): in cima a «Explore», anche
sull'acqua, il campo con la lente apre la ricerca di TASK-344; il Feed non ha
più la lente. Un disegno del Feed trovato lì si apre con `fetchPostRoute`, come
dal Feed, e «Indietro» torna a «Explore» (test in `__tests__/AppFeed.test.tsx`
che fallisce senza la modifica). La pagina della ricerca ha un suo
`SafeAreaProvider`: prima finiva sotto la barra di stato, difetto già in
produzione con la lente del Feed (`SearchScreenInset.test.tsx`). Testi della
Guida e della privacy approvati dall'utente («Sì, approvo» per entrambi),
`site/privacy` rigenerato su main dopo la #724. Impronta iOS `6f8bba4c`.
Simulatore (iPhone 17e, Expo Go): la ricerca in cima a «Explore», il ritorno a
«Explore», il Feed senza lente; il caricamento riuscito di un disegno trovato
non visto (nessuna API locale), coperto dal test. Copia del sito e OTA: le
chiede il Coordinatore all'utente.
