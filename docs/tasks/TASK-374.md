# TASK-374 — Il mio corpo: calorie giuste e zone di frequenza cardiaca

**Stato**: In corso: parti A (#739, `22ec9572`) e B (#746, `a1ff05da`) in `main`; poi C e D nella 1.0.2
**Fase**: 4 · **Branch**: `docs/TASK-374-body-calories-hr-zones` (documenti),
`feat/TASK-374-a-body-calories` (parte A), `feat/TASK-374-b-hr-zones` (parte B)
· **ADR**: ADR-0318 · numeri dal Coordinatore (2026-11-04)

## Obiettivo

L'utente può dire all'app sesso, peso, altezza e anno di nascita, tutti
facoltativi. Con questi dati le kcal di corsa, bici e paddle sono giuste
dovunque compaiono (schermata di corsa, Feed, allenamenti salvati in Apple
Health / Health Connect). Una pagina mostra le 5 zone di frequenza cardiaca
calcolate, e l'utente le può modificare a mano. La richiesta è dell'utente
(2026-11-04).

## Contesto da leggere

- `apps/mobile/src/navigation/runMetrics.ts`: `kcal()`, `DEFAULT_WEIGHT_KG`,
  `KCAL_PER_KG_KM`, `climbM()`.
- I tre posti che usano `kcal()`: `screens/RunPanel.tsx` (riquadro
  «Calories»), `feed/postEnergy.ts` (Feed), `health/workout.ts` (Health).
- `health/appleHealth.ts`, `health/healthConnect.ts`: oggi chiedono solo la
  scrittura.
- `units/units.ts`, `settings/UnitsSetting.tsx`, `profile/SettingsPage.tsx`:
  come una scelta resta sul telefono e come appare nelle Impostazioni
  (TASK-182, ADR-0149).
- `docs/TESTING.md`.
- `tasks/TASK-345.md` e ADR-0298 (calorie e battito nel Feed): la parte A ha
  fatto `feed/postEnergy.ts`; la parte C legge il battito da Apple Salute a
  corsa finita. Le zone e la lettura da Salute vanno coordinate con quella.
- ADR-0219 §3: il riquadro «Calories» solo correndo, «una formula per sport
  quando l'utente la vorrà». Questo task è quella richiesta.
- `tasks/TASK-321.md` (Apple Salute, ADR-0281): chi possiede `health/`.

## Ordine e privacy (Coordinatore, 2026-11-04)

- Documenti adesso; il codice **dopo TASK-367** (la navigazione) e coordinato
  con TASK-345 C su Salute.
- Sesso, peso, altezza, anno di nascita e zone sono **dati sulla salute**
  (GDPR art. 9). Proposta: restano sul telefono. Il server (parte C) solo se
  serve davvero, con un **consenso esplicito separato**.
- Ogni testo di privacy, App Privacy e Data safety vuole il sì dell'utente.
- Facoltativi davvero: senza dati l'app resta com'è oggi.
- Una migrazione, se servirà, si chiede al Coordinatore (oggi la libera è la
  0045).

## Cosa c'è oggi

Letto il codice di `main` (`6dc89cfa`) il 2026-11-04.

- `kcal(metres, weightKg = 70)` = km × peso × 1,036, arrotondato. Non conta né
  il tempo, né la salita, né il sesso, né l'età.
- `RunPanel.tsx` mostra il riquadro «Calories» solo correndo: in bici e in
  paddle non c'è (ADR-0219 §3, la formula della corsa darebbe il triplo).
- `postEnergy.ts` (TASK-345 A) la calcola dalla sola distanza del post
  (`route_m`), con 70 kg, solo per la corsa, per i post di chiunque.
- `health/workout.ts` la scrive in Health solo per la corsa. Per bici e paddle
  scrive `null`.
- L'app non legge ancora dati dalla salute: `appleHealth.ts` e
  `healthConnect.ts` chiedono soltanto il permesso di scrittura. Ma la 1.0.1
  (build 8) ha già `NSHealthShareUsageDescription`, messa per TASK-345 C, con
  un testo che parla solo del battito. Su iPhone, quindi, leggere peso,
  altezza e data di nascita non chiede una build nativa: basta un OTA, ma il
  testo della chiave andrebbe allargato nella 1.0.2. Mai sulla 1.0 build 7, che
  non ha la chiave e crasha (TASK-345 C §3). Su Android la lettura
  aspetta TASK-321 C, che è bloccata.
- Nessun dato del corpo né delle zone, né nell'app né sul server.

## Scelte dell'utente

Una alla volta, con le sue parole.

1. **Dove stanno i dati.** Proposta: solo sul telefono; le kcal dei post
   altrui restano a 70 kg; niente migrazione, niente consenso in più, privacy
   invariata.
   — *Risposta (2026-11-04):* «Solo sul telefono». La parte C (server) esce
   dal piano.
2. **Il sesso.** Proposta: «Male», «Female», «Prefer not to say», più il campo
   vuoto (non impostato). Cambia solo la costante di Mifflin-St Jeor (+5,
   −161, media −78; vuoto = 1 MET standard a riposo).
   — *Risposta (2026-11-04):* «Male, Female, Prefer not».
3. **Leggere peso, altezza e data di nascita da Apple Health / Health
   Connect**. Proposta: sì, nella 1.0.2, non con un OTA sulla 1.0.1: il testo
   di `NSHealthShareUsageDescription` oggi parla solo del battito (regola
   5.1.1) e la voce «Health» di App Privacy si aggiorna una volta sola,
   insieme a TASK-345 C. Un pulsante riempie solo i campi vuoti. Nella parte A
   i dati si inseriscono a mano.
   — *Risposta (2026-11-04):* «Sì, nella 1.0.2».
4. **Le zone.** Proposta: la tabella (parte B, con un OTA) e il tempo in ogni
   zona a fine corsa (parte D), dagli stessi campioni che TASK-345 C legge da
   Apple Salute; senza orologio la riga non c'è. Niente battito in tempo
   reale: servirebbe un'app per Apple Watch o una fascia Bluetooth
   (dipendenza nuova), task a parte se mai lo si vorrà.
   — *Risposta (2026-11-04):* «Tabella + tempo in zona».
5. **Dove sta la sezione.** Proposta: nelle Impostazioni, una riga sotto
   «Units» che apre una pagina con i quattro dati e, in fondo, la riga delle
   zone. Non nel Profilo, che è anche la pagina vista dagli altri.
   — *Risposta (2026-11-04):* «Nelle Impostazioni».
6. **I testi dell'interfaccia** (parti A e B; quelli di C e D con le loro
   parti). Proposta, inglese → italiano; tedesco, spagnolo e francese li
   traduce l'agente:

   | Dove | Inglese | Italiano |
   |---|---|---|
   | Riga e titolo della pagina | Body | Corpo |
   | Valore della riga, senza dati | Not set | Non impostato |
   | Sotto il titolo | Used only to estimate your calories and heart rate zones. It stays on this phone. | Serve solo a stimare calorie e zone del battito. Resta su questo telefono. |
   | Campo | Sex | Sesso |
   | Scelte | Male · Female · Prefer not to say | Uomo · Donna · Preferisco non dirlo |
   | Campo | Weight | Peso |
   | Campo | Height | Altezza |
   | Campo | Year of birth | Anno di nascita |
   | Svuota un campo | Clear | Cancella |
   | Nota in fondo | Calories are an estimate. Weight matters most. | Le calorie sono una stima. Conta soprattutto il peso. |
   | Errore del peso | Enter a weight between {min} and {max} {unit}. | Scrivi un peso tra {min} e {max} {unit}. |
   | Errore dell'altezza | Enter a height between {min} and {max}. | Scrivi un'altezza tra {min} e {max}. |
   | Errore dell'anno | Enter a year between {min} and {max}. | Scrivi un anno tra {min} e {max}. |
   | Riga e titolo (B) | Heart rate zones | Zone del battito |
   | Campo (B) | Max heart rate | Frequenza cardiaca massima |
   | Sotto, se calcolata | Estimated from your age | Stimata dalla tua età |
   | Sotto, se scritta | Set by you | Impostata da te |
   | Campo (B) | Resting heart rate | Frequenza cardiaca a riposo |
   | Zone (B) | Zone 1 Recovery · Zone 2 Endurance · Zone 3 Tempo · Zone 4 Threshold · Zone 5 Max | Zona 1 Recupero · Zona 2 Fondo · Zona 3 Ritmo · Zona 4 Soglia · Zona 5 Massimo |
   | Pulsante (B) | Back to calculated zones | Torna alle zone calcolate |
   | Senza età né FC max (B) | Add your year of birth or your max heart rate to see your zones. | Aggiungi l'anno di nascita o la frequenza massima per vedere le zone. |

   — *Risposta (2026-11-04):* «Sì, approvo». La frase «It stays on this phone»
   vale finché i dati restano sul telefono (scelta 1).

## Divisione proposta

- **A — dati del corpo e calorie, solo app.** I campi salvati sul telefono, la
  formula nuova in un modulo puro, usata dalla schermata di corsa, dal Feed e
  da Health. Fingerprint iOS invariato: si può pubblicare con un OTA.
- **B — pagina delle zone.** Calcolo puro (FC max, Karvonen), tabella
  modificabile, salvata sul telefono.
- ~~Server e sincronizzazione~~: esclusa dalla scelta 1 («Solo sul
  telefono»).
- **C — lettura da Apple Salute / Health Connect, nella 1.0.2** (scelta 3):
  peso, altezza e data di nascita riempiono i campi vuoti, senza sovrascrivere
  quelli inseriti a mano. Il testo della chiave di lettura si allarga e App
  Privacy si aggiorna insieme a TASK-345 C, col sì dell'utente su ogni testo.
  Android dopo TASK-321 C.
- **D — tempo in ogni zona a fine corsa** (scelta 4): dai campioni di battito
  che TASK-345 C legge da Apple Salute, con le zone della parte B; una riga per
  zona alla fine della corsa, solo se ci sono campioni. Si accende con TASK-345
  C (1.0.2). Niente battito in tempo reale.

## Cosa fare (parte A)

1. Modulo puro `body/bodyProfile.ts`: tipo dei dati del corpo, lettura e
   scrittura sul telefono come `units.ts`, conversioni kg/lb e cm/ft-in.
2. Modulo puro `body/energy.ts`: la formula di ADR-0318, per sport, con i dati
   del corpo o i valori di oggi se mancano.
3. Nelle Impostazioni (scelta 5), una riga sotto «Units» che apre la pagina dei
   dati del corpo (`settings/BodyPage.tsx`, nuovo), nelle unità di TASK-182.
4. `RunPanel.tsx`, `postEnergy.ts` e `health/workout.ts` passano da `kcal()` a
   `energy.ts`. Il riquadro «Calories» torna in bici e in paddle (supera
   ADR-0219 §3) e in Health si scrivono le kcal anche per loro. **Prima di
   toccare `postEnergy.ts` (TASK-345) e `health/workout.ts` (TASK-321)
   scrivere al Coordinatore.**
5. Testi in inglese e traduzioni in `i18n/`, dopo l'approvazione dei testi.

## Cosa fare (parte B)

1. Modulo puro `body/heartZones.ts`: FC max = 208 − 0,7 × età (Tanaka), oppure
   inserita a mano; con la FC a riposo, il metodo Karvonen; limiti modificati a
   mano, che restano finché l'utente non torna ai valori calcolati.
2. Pagina «Heart rate zones» con le 5 zone, aperta da una riga in fondo alla
   pagina dei dati del corpo (parte A).

## Criteri di accettazione

- [ ] Senza dati del corpo, una corsa dà le stesse kcal di oggi, con una
      tolleranza di ±5%. C'è un test che lo verifica.
- [ ] Con i dati del corpo, le kcal di corsa, bici e paddle seguono la formula
      di ADR-0318: test deterministici con casi calcolati a mano.
- [ ] Le stesse kcal compaiono nella schermata di corsa, nel Feed (per le
      proprie corse) e nell'allenamento salvato in Health.
- [ ] Peso e altezza si inseriscono e si mostrano nelle unità scelte
      (kg/lb, cm/ft-in). Tornando avanti e indietro tra le unità il valore non
      si sposta.
- [ ] Le 5 zone calcolate corrispondono ai casi di test (Tanaka e Karvonen). Un
      limite cambiato a mano resta, e le zone restano contigue e in ordine.
- [ ] Ogni campo si può svuotare, e svuotato l'app torna ai valori di oggi.
- [ ] Testi approvati dall'utente, presenti in ogni lingua di `i18n/`.
- [ ] Parte A: fingerprint iOS invariato (`6f8bba4c`).

## File toccati

Documenti (questo branch):

```
docs/tasks/TASK-374.md
docs/DECISIONS.md
docs/STATUS.md
docs/INDEX.md
```

Parte A (fatti, branch `feat/TASK-374-a-body-calories`; via del Coordinatore
del 2026-11-04 anche per `postEnergy.ts` e `health/workout.ts`):

```
apps/mobile/src/body/bodyProfile.ts            (nuovo, + test)
apps/mobile/src/body/bodyUnits.ts              (nuovo, + test)
apps/mobile/src/body/bodyFields.ts             (nuovo, + test)
apps/mobile/src/body/energy.ts                 (nuovo, + test)
apps/mobile/src/body/useBody.ts                (nuovo)
apps/mobile/src/settings/BodySetting.tsx       (nuovo, + test)
apps/mobile/src/settings/BodyPage.tsx          (nuovo)
apps/mobile/src/profile/SettingsPage.tsx       (+ test: una riga sotto Units)
apps/mobile/src/navigation/runMetrics.ts       (+ test: via la vecchia kcal())
apps/mobile/src/screens/RunPanel.tsx
apps/mobile/src/feed/postEnergy.ts             (+ test)
apps/mobile/src/health/workout.ts              (+ test)
apps/mobile/src/i18n/{it,de,es,fr}.ts
docs/UI.md, docs/DECISIONS.md, docs/STATUS.md, docs/tasks/TASK-374.md
```

Test che cambiano solo i numeri delle kcal (o le kcal nuove in bici e in
canoa): `screens/{RunPanel,RunPaddle,RunMiles,RunDashboard,FreeRunScreen,
FeedScreenPosts}.test.tsx`, `feed/{FeedPost,feedPosts}.test.*`,
`units/cardsInMiles.test.tsx`, `i18n/LastTextsItalian.test.tsx`,
`health/{appleHealth,healthConnect}.test.ts`, `__tests__/AppFeedDrawing.test.tsx`,
`__tests__/AppFeedPaddle.test.tsx`.

Parte B (previsti):

```
apps/mobile/src/body/heartZones.ts             (nuovo, + test)
apps/mobile/src/settings/HeartZonesPage.tsx    (nuovo, + test)
apps/mobile/src/settings/BodyPage.tsx          (la riga in fondo)
apps/mobile/src/settings/BodySetting.test.tsx
apps/mobile/src/i18n/{it,de,es,fr}.ts
docs/UI.md, docs/DECISIONS.md, docs/STATUS.md, docs/tasks/TASK-374.md
```

La pagina sta in `settings/` accanto a `BodyPage.tsx`, non in `body/`: così
l'elenco del via del Coordinatore (2026-11-04).

Testo della parte B fuori dalla tabella: l'errore di una FC fuori dai limiti,
«Enter a heart rate between {min} and {max} bpm.» → «Scrivi una frequenza tra
{min} e {max} bpm.».
— *Risposta (2026-11-04):* «Sì, approvo».

## Fuori scope

- Server, sincronizzazione, migrazioni, privacy policy: parte C, solo con il sì
  dell'utente.
- Lettura da Apple Health / Health Connect nella parte A: arriva con la parte
  C, nella 1.0.2.
- Battito in tempo reale durante la corsa (app per Apple Watch o fascia
  Bluetooth): escluso dalla scelta 4, eventualmente un task a parte.
- Fasce Bluetooth: dipendenza nuova, da chiedere.
- Le kcal dei post di altri utenti calcolate col loro peso: richiede il server
  (scelta 1).
- Calorie giornaliere, metabolismo basale mostrato, obiettivi di peso.

## Esito

- Parte A (2026-11-04): in `main` con la PR #739 (`22ec9572`).
- Parte B (2026-11-04): `body/heartZones.ts` (Tanaka, Karvonen, limiti a mano
  condivisi fra zone vicine, `heart.json`) e `settings/HeartZonesPage.tsx`,
  aperta dalla riga in fondo a «Body». Scelte tecniche in ADR-0318 §15. In
  `main` con la PR #746 (`a1ff05da`); impronta all'anteprima e OTA col
  Coordinatore.
