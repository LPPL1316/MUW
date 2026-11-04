# TASK-374 — Il mio corpo: calorie giuste e zone di frequenza cardiaca

**Stato**: Todo: documenti ora, codice dopo le scelte dell'utente
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

Una alla volta, con le sue parole. *(da fare)*

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
   Connect**: sì o no. Su iPhone è possibile già con la 1.0.1, insieme a
   TASK-345 C; il testo della chiave si allarga nella 1.0.2.
4. **Le zone**: solo la tabella, o anche il tempo in ogni zona a fine corsa
   (dai campioni di battito che TASK-345 C già legge), o il battito in tempo
   reale (orologio o fascia Bluetooth)?
5. **Dove sta la sezione**: Impostazioni o Profilo.
6. **I testi dell'interfaccia** (in inglese, più le traduzioni).

## Divisione proposta

- **A — dati del corpo e calorie, solo app.** I campi salvati sul telefono, la
  formula nuova in un modulo puro, usata dalla schermata di corsa, dal Feed e
  da Health. Fingerprint iOS invariato: si può pubblicare con un OTA.
- **B — pagina delle zone.** Calcolo puro (FC max, Karvonen), tabella
  modificabile, salvata sul telefono.
- ~~**C — server e sincronizzazione**~~: esclusa dalla scelta 1 («Solo sul
  telefono»).
- **D — battito**, solo se la scelta 4 lo chiede: il tempo in ogni zona a
  fine corsa dai campioni di TASK-345 C; il tempo reale è un'altra cosa
  (orologio o fascia, dipendenza nuova).

## Cosa fare (parte A)

1. Modulo puro `body/bodyProfile.ts`: tipo dei dati del corpo, lettura e
   scrittura sul telefono come `units.ts`, conversioni kg/lb e cm/ft-in.
2. Modulo puro `body/energy.ts`: la formula di ADR-0318, per sport, con i dati
   del corpo o i valori di oggi se mancano.
3. Sezione nelle Impostazioni (o nel Profilo, scelta 5) per inserire i dati,
   nelle unità di TASK-182.
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
2. Pagina «Heart rate zones» con le 5 zone, aperta dalla sezione della parte A.

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

Parte A (previsti):

```
apps/mobile/src/body/bodyProfile.ts            (nuovo)
apps/mobile/src/body/bodyProfile.test.ts       (nuovo)
apps/mobile/src/body/energy.ts                 (nuovo)
apps/mobile/src/body/energy.test.ts            (nuovo)
apps/mobile/src/settings/BodySetting.tsx       (nuovo)
apps/mobile/src/settings/BodySetting.test.tsx  (nuovo)
apps/mobile/src/profile/SettingsPage.tsx
apps/mobile/src/navigation/runMetrics.ts
apps/mobile/src/screens/RunPanel.tsx
apps/mobile/src/feed/postEnergy.ts
apps/mobile/src/health/workout.ts
apps/mobile/src/health/workout.test.ts
apps/mobile/src/i18n/{it,de,es,fr}.ts
```

Parte B (previsti):

```
apps/mobile/src/body/heartZones.ts             (nuovo)
apps/mobile/src/body/heartZones.test.ts        (nuovo)
apps/mobile/src/body/HeartZonesPage.tsx        (nuovo)
apps/mobile/src/body/HeartZonesPage.test.tsx   (nuovo)
apps/mobile/src/settings/BodySetting.tsx
apps/mobile/src/i18n/{it,de,es,fr}.ts
```

## Fuori scope

- Server, sincronizzazione, migrazioni, privacy policy: parte C, solo con il sì
  dell'utente.
- Lettura da Apple Health / Health Connect e battito: parti C/D, solo con il
  sì dell'utente e coordinate con TASK-345 C.
- Fasce Bluetooth: dipendenza nuova, da chiedere.
- Le kcal dei post di altri utenti calcolate col loro peso: richiede il server
  (scelta 1).
- Calorie giornaliere, metabolismo basale mostrato, obiettivi di peso.

## Esito

*(si compila a fine task)*
