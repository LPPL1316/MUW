# TASK-367 — La navigazione come Instagram: la barra in basso e un header solo

**Stato**: Todo — documenti ora, codice col via del Coordinatore
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

### Parte C — la campanella con le notifiche vere

Il server tiene una riga per ogni evento che oggi manda una push (reazioni,
commenti, follow e richieste, tag, sfide, concorsi; i messaggi no, hanno la
loro scheda), `GET /notifications` con il conto dei non letti e la lettura.
Nell'app la campanella con il badge `badge`, la lista, e ogni riga apre ciò che
apre oggi la push (`notificationTap`). Migrazione col primo numero libero al
merge; server e migrazione con il sì dell'utente; testi da approvare.

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

Parte A:

```
apps/mobile/App.tsx
apps/mobile/assets/ui/tabs/**                         (nuovi)
apps/mobile/src/tabs/**                               (nuovi)
apps/mobile/src/messages/messagesDoor.ts, MessagesOverlay.tsx
apps/mobile/src/profile/ProfileHome.tsx, ProfileHome.test.tsx
apps/mobile/src/screens/ProfileLayer.tsx               (se il Profilo lo chiede)
apps/mobile/src/tour/tourSteps.ts, tourParts.ts, i loro test
apps/mobile/src/about/content/*.ts                    (le frasi della Guida)
apps/mobile/src/screens/Pager.tsx, Pager.test.tsx     (tolti quando nessuno li usa)
docs/UI.md, docs/STATUS.md, docs/tasks/TASK-367.md
```

## Fuori scope

- Il contenuto di Feed, Draw ed Explore; «Run without a route» resta nella
  pagina di «Draw».
- Il blur vero (`expo-blur`, nativo): con una build, col sì dell'utente.
- Le schermate dell'App Store (TASK-328): si rifanno dopo, a parte.
- Un OTA di produzione: con il sì dell'utente.

## Esito

*(a fine task)*
