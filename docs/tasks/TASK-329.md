# TASK-329 — «Ask for a route» sempre aperto, con le nostre idee in Europa e le foto vere dei posti

**Stato**: In corso
**Fase**: 2 · **Branch**: `feat/TASK-329-explore-ideas` (parte A)
**ADR**: ADR-0287 · numeri dati dal Coordinatore il 2026-10-29

## Obiettivo

Le idee per un percorso stanno in un posto solo: «Ask for a route» in
«Explore», sempre aperto, con i nostri esempi di forme semplici nelle grandi
città europee. Dentro un percorso si vedono le foto vere dei posti che tocca.

## Richiesta dell'utente

Del 2026-10-29, a voce, parole esatte: «Togli le immagini sotto a giri in
città in disegnA ed anche giri in città giri digitali, teniamo solamente in
esplora chiedi un percorso lo tieni sempre aperto e gli dai degli esempi di
forme semplici in città grandi europeE prendendo posti famosi panorami
angoli nascosti, fotografia Pro, dobbiamo dare noi degli esempi e la gente
poi deve prendere spunto e farli poi, magari, quando entrano in una forma,
devi trovare tu il modo di far vedere anche delle immagini reali delle parti
delle città, appunto di posti belli, monumenti famosi vedi te come fare
fammi una proposta».

La proposta (`out/esplora-idee-europa/proposta.md` nel checkout di `main`,
non nel repository) è stata approvata dall'utente in chat il 2026-10-29 con
«Sì, così». Contiene i cinque punti qui sotto e le due parti.

I testi nuovi della parte A, «IDEAS FROM EUROPE», «Make it near me» e i
nomi delle otto città nelle cinque lingue (tabella in `docs/UI.md`, «Le
idee dall'Europa»), sono stati approvati dall'utente in chat il 2026-10-29
con «Sì, approvo». I quattro temi e «© OpenStreetMap contributors» sono
testi già tradotti.

## Contesto da leggere

- `docs/UI.md` §«Explore» (punti su «Ask for a route», TASK-157/143) e
  §«I giri e le immagini pronte (TASK-280, ADR-0246)»
- `docs/DECISIONS.md` ADR-0099 (giri a tema), ADR-0243 (foto delle città),
  ADR-0246 (le righe di «Draw»), ADR-0287 (questo task)
- `services/api/shaperoute_api/themed.py`, `themes.py`, `city_photos.py`
  (solo per la parte B e per lo strumento)

## Cosa fare

### Parte A — solo app (OTA), più lo strumento delle idee

1. **«Draw» senza le due righe**: via «CITY TOURS» e «PICTURES» in fondo a
   «Draw» (`src/route/DrawIdeas.tsx` e i suoi test). Le sagome restano
   dove servono già: «Draw on the map» e «Change figure» sul risultato.
   Senza i giri da «Draw», `ThemedCard` perde `fromDraw` e «Back to Draw».
2. **«Ask for a route» sempre aperto**, nello stesso posto in fondo a
   «Explore», senza la riga da toccare (TASK-157). Quattro categorie
   fisse: Famous Places · Best Views · Hidden Gems · Photography; le altre
   nove dietro «More…»; sotto, il campo «Or in your words».
3. **«IDEAS FROM EUROPE»**: una fila da scorrere di lato dentro il blocco,
   sopra le categorie. Sono circa 12 percorsi nostri in 8 città (Roma,
   Parigi, Londra, Barcellona, Amsterdam, Lisbona, Praga, Berlino), con
   forme semplici (cuore, stella, cerchio, luna) di 6–10 km. Ogni scheda è
   una scheda di «Explore» con la mappa sotto la linea: «Roma · Stella»,
   «Famous Places · 8,1 km». Un tocco la apre sulla mappa come un percorso
   chiesto, subito e senza rete (`useThemedRoute.show`).
4. **Lo strumento** `tools/themed_ideas.py` calcola le idee una volta, con
   le stesse parole che l'app manda («Famous Places star 8 km»), dal centro
   della città trovato dalla ricerca città dell'API. Usa i job a tema
   dell'API con le tabelle e senza AI, e il Route Engine: nessuna
   coordinata è inventata. Scrive `src/explore/themedIdeas.json`. Si
   tengono solo le idee che si leggono bene a occhio (TASK-290).
5. **«Make it near me»**: su un'idea aperta lontano dalla partenza (oltre
   20 km dal centro della città) il bottone giallo rifà le stesse parole
   dalla partenza, al posto di «Start». Vicino resta «Start». «Export GPX»
   c'è sempre.
6. Testi nuovi nelle cinque lingue, da far approvare all'utente prima del
   merge: «IDEAS FROM EUROPE», «Make it near me» e i nomi delle otto città.

### Parte B — API + server (dopo A, col sì dell'utente per il server)

7. Il codice Wikidata di ogni posto (`wiki_and_media.wikidata` di Geoapify,
   già letto da `parse_places`) va in `StopBody`, facoltativo, con la sua
   foto presa da `CityPhotos.photos()` di TASK-283 (≤ 2 s come per le città
   vicine; solo licenze libere, il credito piccolo sulla foto).
8. Nell'app, sotto la mappa di un percorso a tema, una fila di foto
   («1 Colosseum», «2 Pantheon»…), numerata come i posti sulla mappa; un
   tocco porta la mappa lì. Un posto senza foto libera ha la scheda col
   solo nome. Le schede delle idee mostrano la foto del primo posto
   toccato.
9. Il server con il sì dell'utente; la riga della privacy di TASK-283 va
   ricontrollata: a Wikimedia vanno solo gli item e i nomi dei file.

## Criteri di accettazione (parte A)

- [ ] In «Draw» non ci sono più «CITY TOURS» né «PICTURES»; le sagome
      restano in «Draw on the map» e in «Change figure».
- [ ] In «Explore» «Ask for a route» è aperto senza toccare nulla, in fondo
      alla pagina, con le quattro categorie scelte in vista.
- [ ] «IDEAS FROM EUROPE» mostra le idee del file, ognuna apre la sua route
      sulla mappa senza alcuna richiesta all'API.
- [ ] Ogni idea del file è un percorso del motore che passa per almeno due
      posti del tema (test dello strumento), guardato a occhio.
- [ ] Un'idea lontana dalla partenza ha «Make it near me», che manda le sue
      parole con `centre` la partenza; vicina ha «Start».
- [x] Testi nuovi approvati dall'utente in cinque lingue («Sì, approvo»).
- [ ] Test verdi: app (jest, tsc, lint, format) e `pytest tools`; impronta
      iOS `83793e26` invariata su una copia pulita.

## File toccati (parte A)

```
apps/mobile/App.tsx
apps/mobile/__tests__/AppDrawIdeas.test.tsx          (tolto)
apps/mobile/__tests__/AppFreehand.test.tsx           (un test senza la riga «PICTURES»)
apps/mobile/__tests__/AppThemedIdeas.test.tsx        (nuovo)
apps/mobile/src/explore/AskForRoute.tsx
apps/mobile/src/explore/AskForRoute.test.tsx
apps/mobile/src/explore/ExploreScreen.tsx
apps/mobile/src/explore/ExploreScreen.test.tsx
apps/mobile/src/explore/ExploreItalian.test.tsx
apps/mobile/src/explore/presets.ts
apps/mobile/src/explore/presets.test.ts
apps/mobile/src/explore/ThemedCard.tsx
apps/mobile/src/explore/ThemedCard.test.tsx
apps/mobile/src/explore/themedRoutes.ts
apps/mobile/src/explore/useThemedRoute.ts
apps/mobile/src/explore/useThemedRoute.test.ts
apps/mobile/src/explore/themedIdeas.ts               (nuovo)
apps/mobile/src/explore/themedIdeas.json             (nuovo, scritto dallo strumento)
apps/mobile/src/explore/themedIdeas.test.ts          (nuovo)
apps/mobile/src/explore/IdeasFromEurope.tsx              (nuovo)
apps/mobile/src/explore/IdeasFromEurope.test.tsx         (nuovo)
apps/mobile/src/mapdraw/ChangeFigureApp.test.tsx     (senza la riga «PICTURES»)
apps/mobile/src/route/DrawIdeas.tsx                  (tolto)
apps/mobile/src/route/DrawIdeas.test.tsx             (tolto)
apps/mobile/src/i18n/it.ts
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/es.ts
apps/mobile/src/i18n/fr.ts
tools/themed_ideas.py                                (nuovo)
tools/test_themed_ideas.py                           (nuovo)
docs/tasks/TASK-329.md
docs/DECISIONS.md
docs/STATUS.md
docs/UI.md
```

Condizione del Coordinatore: `App.tsx` entra dopo il merge di TASK-327
(la riga «Play»), che lo tocca prima; riallineare su `main` prima del merge.

## Fuori scope

- Le foto dei posti (parte B, dopo A).
- Togliere le sagome anche da «Draw on the map» o da «Change figure».
- Idee fuori dall'Europa, o in città che non sono le otto.
- Idee calcolate sul server o aggiornate da sole: il file cambia solo
  rilanciando lo strumento.
- «Ask for a route» per «Paddle» (`PaddleExplore`), che resta com'è.

## Esito

*(a fine task)*
