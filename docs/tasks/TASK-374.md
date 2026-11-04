# TASK-374 — Il mio corpo: calorie giuste e zone di frequenza cardiaca

**Stato**: Todo: documenti ora, codice dopo le scelte dell'utente
**Fase**: 4 · **Branch**: `docs/TASK-374-body-calories-hr-zones` (documenti),
`feat/TASK-374-a-body-calories` (parte A), `feat/TASK-374-b-hr-zones` (parte B)
· **ADR**: ADR-0NNN · numero del task dal Coordinatore (2026-11-04)

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

## Cosa c'è oggi

Letto il codice di `main` (`6dc89cfa`) il 2026-11-04.

- `kcal(metres, weightKg = 70)` = km × peso × 1,036, arrotondato. Non conta né
  il tempo, né la salita, né il sesso, né l'età.
- `RunPanel.tsx` la mostra per ogni sport, quindi anche in bici e in paddle,
  dove la formula della corsa non vale.
- `postEnergy.ts` la calcola dalla sola distanza del post (`route_m`), con
  70 kg, per i post di chiunque.
- `health/workout.ts` la scrive in Health solo per la corsa. Per bici e paddle
  scrive `null`.
- L'app non legge mai dati dalla salute: `appleHealth.ts` e `healthConnect.ts`
  chiedono soltanto il permesso di scrittura.
- Nessun dato del corpo né delle zone, né nell'app né sul server.

## Scelte dell'utente

Una alla volta, con le sue parole. *(da fare)*

1. **Dove stanno i dati**: solo sul telefono, o anche sul server?
2. **Il sesso**: quali opzioni.
3. **Leggere peso, altezza e data di nascita da Apple Health / Health
   Connect**: sì o no (vuol dire build nativa 1.0.2).
4. **Le zone**: solo la tabella, o anche il battito durante la corsa e il
   tempo in ogni zona alla fine?
5. **Dove sta la sezione**: Impostazioni o Profilo.
6. **I testi dell'interfaccia** (in inglese, più le traduzioni).

## Divisione proposta

- **A — dati del corpo e calorie, solo app.** I campi salvati sul telefono, la
  formula nuova in un modulo puro, usata dalla schermata di corsa, dal Feed e
  da Health. Fingerprint iOS invariato: si può pubblicare con un OTA.
- **B — pagina delle zone.** Calcolo puro (FC max, Karvonen), tabella
  modificabile, salvata sul telefono.
- **C — server e sincronizzazione**, solo se la scelta 1 lo chiede: migrazione,
  API, privacy policy e App Privacy.
- **D — battito in tempo reale**, solo se la scelta 4 lo chiede: build nativa.

## Cosa fare (parte A)

1. Modulo puro `body/bodyProfile.ts`: tipo dei dati del corpo, lettura e
   scrittura sul telefono come `units.ts`, conversioni kg/lb e cm/ft-in.
2. Modulo puro `body/energy.ts`: la formula di ADR-0NNN, per sport, con i dati
   del corpo o i valori di oggi se mancano.
3. Sezione nelle Impostazioni (o nel Profilo, scelta 5) per inserire i dati,
   nelle unità di TASK-182.
4. `RunPanel.tsx`, `postEnergy.ts` e `health/workout.ts` passano da `kcal()` a
   `energy.ts`. In Health si scrivono le kcal anche per bici e paddle.
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
      di ADR-0NNN: test deterministici con casi calcolati a mano.
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
- Lettura da Apple Health / Health Connect e battito in tempo reale: build
  nativa, parti C/D, solo con il sì dell'utente.
- Fasce Bluetooth: dipendenza nuova, da chiedere.
- Le kcal dei post di altri utenti calcolate col loro peso: richiede il server
  (scelta 1).
- Calorie giornaliere, metabolismo basale mostrato, obiettivi di peso.

## Esito

*(si compila a fine task)*
