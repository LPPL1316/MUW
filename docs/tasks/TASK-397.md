# TASK-397 — Il VO₂ max nel profilo pubblico

**Stato**: Proposto · proposta in main (#810); scelte e testi
dell'interfaccia e informativa della parte A approvati; Salute e App
Privacy con la parte C; nessun
codice prima del sì sulla
proposta e della lista dei file data al Coordinatore
**Fase**: 5 · **Branch**: `docs/TASK-397-vo2max-proposal` (documenti); il
codice `feat/TASK-397-a-…`
**Dipende da**: TASK-368 (i record, chiuso) per la stima; la #806 (TASK-376
B3a) per `health/`; TASK-374 C e TASK-345 C per il giro di Salute della
1.0.2; TASK-321 C per Android
**ADR**: ADR-0332 (proposto) · numeri dal Coordinatore il 2026-11-05

## Obiettivo

Sul profilo di un iscritto compare il suo **VO₂ max**, il numero che dice
quanto ossigeno usa il corpo al massimo dello sforzo (ml per kg al minuto).
Viene da Apple Salute o Health Connect quando c'è, perché lì lo calcola
l'orologio; se manca, MuW lo stima dai record di corsa e lo dice («Estimate
from your 10K»). Lo vede chi può aprire il profilo, ma solo dopo che il
titolare ha detto sì; si spegne in Impostazioni.

## Contesto da leggere

- `DECISIONS.md` ADR-0332 (questo task), ADR-0312 (record personali),
  ADR-0318 (dati del corpo, solo sul telefono), ADR-0281 (Salute), ADR-0128
  (profilo)
- `docs/API.md`, «Profile»; `tasks/TASK-374.md` parte C, `tasks/TASK-345.md`
  parte C (la lettura da Salute della 1.0.2)

## Com'è oggi (main `ae6c2e2a`)

1. **Salute in sola scrittura, più il battito.** `health/appleHealth.ts`
   chiede solo `toShare` (allenamento, percorso, distanza, energia). La 1.0.1
   ha già `NSHealthShareUsageDescription`, ma il testo parla solo del
   battito («MuW reads your heart rate…»); la lettura del battito è di
   TASK-345 C, nella 1.0.2.
2. **I record di corsa** sono sul server (`run_bests`, migrazione 0042) e
   nel profilo pubblico (`personal_bests` in `GET /users/{public_id}`,
   `profile_bests.py`): 5K, 10K, 15K, mezza, 30K, maratona, 60K, con tempo e
   giorno. Li vede già chi apre il profilo.
3. **I dati del corpo** (peso, altezza, nascita, sesso, ADR-0318) restano sul
   telefono e non vanno al server.
4. **Nessun VO₂ max** nell'app; `body/energy.ts` usa il VO₂ solo come passo
   intermedio delle calorie (ACSM), non lo mostra.

## Scelte dell'utente (2026-11-05, una alla volta)

1. **Fonte**: «Apple, poi stima». Il VO₂ max di Apple Salute / Health
   Connect quando c'è (Apple Watch, «Fitness cardio»); se manca, la stima di
   MuW dai record di corsa, con la scritta «stima».
2. **Chi lo vede**: «Tutti, dopo un sì». La prima volta l'app chiede se
   mostrarlo; dopo il sì lo vede chiunque possa aprire il profilo; si spegne
   in Impostazioni. È il consenso esplicito che Apple chiede (linea guida
   5.1.3) per mostrare ad altri un dato di Salute.
3. **Testi**: «Approvo così» (2026-11-05) — i testi inglesi qui sotto; le
   traduzioni in it, de, fr, es le fa l'agente con la parte B.
4. **Informativa, parte A**: «Approvo così» (2026-11-05). Sotto i record
   personali, app e sito: «If you choose «Show it», other members also see
   your VO₂ max on your profile. Until Apple Health comes in a later update,
   it is our estimate from your running bests of the last 12 months, worked
   out by our server. Turn it off in Settings and it disappears from your
   profile.» Le traduzioni le fa l'agente; il sito lo pubblica il
   Coordinatore col sì dell'utente.

## Domande aperte (ognuna col sì dell'utente)

1. **L'informativa per Salute** (cosa si legge, cosa va al server, la
   cancellazione allo spegnimento) e la voce «Health» di App Privacy: con la
   parte C, nella 1.0.2.
2. **Il testo nuovo di `NSHealthShareUsageDescription`**: uno solo per
   battito (345 C), dati del corpo (374 C) e VO₂ max, scritto con quei due
   task.

## Il disegno tecnico

In ADR-0332 (deciso dall'agente su delega dell'utente). In breve:

- **Il sì sta sul server**: `accounts.show_vo2max`, spento per tutti. Senza
  il sì il server non tiene né mostra niente.
- **Il valore di Salute resta sul telefono** fino al sì; dopo, il telefono
  manda solo l'ultimo numero e il suo giorno (`PUT /me/vo2max`). Spento,
  il server cancella il numero.
- **La stima la fa il server**, dai record di corsa che ha già: formula di
  Daniels e Gilbert (VDOT), sui record degli ultimi 365 giorni dal 5K alla
  maratona, il più alto. Arrotondata all'intero.
- **Precedenza**: il valore di Salute se ha al massimo 365 giorni, se no la
  stima, se no niente (la riga non compare).
- **Nel profilo** (`PublicProfile.vo2max`): `null`, oppure valore, fonte
  (`apple_health`, `health_connect`, `estimate`), giorno e, per la stima, la
  distanza da cui viene.

## Le parti

| Parte | Cosa | Dipende da | Server · testi · OTA |
|---|---|---|---|
| A | API: `show_vo2max` (migrazione, numero dal Coordinatore, oggi la prima libera è la 0049), `PUT`/`DELETE /me/vo2max`, la stima `vo2max_estimate.py`, `vo2max` in `PublicProfile`, tipi e fixture, test | — | server e privacy (riga della stima) col sì |
| B | App: la riga sul profilo (proprio e degli altri), la domanda del sì, l'interruttore in Impostazioni; solo la stima, niente Salute | A sul server | testi col sì; OTA col sì |
| C | App: lettura del VO₂ max da Apple Salute (`HKQuantityTypeIdentifierVO2Max`, `toRead`), invio dopo il sì, una volta al giorno e dopo ogni corsa salvata | B; la #806; il giro di Salute della 1.0.2 con 374 C e 345 C | testo della chiave e App Privacy «Health» col sì; **build 1.0.2** |
| D | Android: `Vo2MaxRecord` da Health Connect | C; TASK-321 C | — |

**Perché C non va in un OTA.** Il tipo VO2Max si chiede a runtime
(`requestAuthorization` con `toRead`, libreria kingstinct), ma il testo di
`NSHealthShareUsageDescription` è nativo e oggi parla solo del battito:
cambiarlo vuole una build. TASK-374 C e TASK-345 C allargano lo stesso testo
e la stessa voce di App Privacy: il VO₂ max entra nello **stesso giro**, un
solo testo nuovo della chiave e un solo cambio nativo, nella 1.0.2. L'ordine
fra i tre lo decide il Coordinatore.

**A e B** non leggono Salute e possono andare prima, con un OTA: chi non ha
l'orologio vede la stima, chi ce l'ha la vede finché arriva la 1.0.2.

## Testi (EN; approvati dall'utente il 2026-11-05)

- Riga del profilo: «VO₂ max» · «52» · «ml/kg/min»; sotto, a seconda della
  fonte: «Apple Watch · 3 Nov», «Health Connect · 3 Nov», «Estimate from
  your 10K».
- La domanda del sì, una volta, sul proprio profilo quando c'è un valore:
  titolo «Show your VO₂ max?»; testo «Everyone who can see your profile will
  see it. You can turn it off in Settings.»; bottoni «Show it» e «Not now».
- Impostazioni, sotto «Body»: «Show VO₂ max on my profile».
- Sul proprio profilo, prima del sì, nessuna riga per gli altri; per sé la
  riga con «Only you see this» e il bottone «Show it».

## File toccati

Questa PR (documenti): `docs/tasks/TASK-397.md` (nuovo), `docs/DECISIONS.md`
(ADR-0332, righe aggiunte), `docs/STATUS.md` (righe aggiunte).

La lista precisa di ogni parte va al Coordinatore prima della parte. Per
ora:

- **A**: `services/api/migrations/NNNN_vo2max.sql` (nuovo, numero dal
  Coordinatore); `services/api/shaperoute_api/vo2max.py` e
  `vo2max_estimate.py` (nuovi); `services/api/tests/test_vo2max.py` e
  `test_vo2max_estimate.py` (nuovi); righe aggiunte in `profiles.py` e in
  `app.py` (il router); `packages/shared-types` (tipo e fixture
  `public-profile.json`, righe aggiunte); `docs/API.md` («Profile»).
- **B**: `apps/mobile/src/profile/ProfileVo2Max.tsx` e il suo test (nuovi);
  righe in `ProfileHome.tsx`, `UserProfilePage.tsx`, `SettingsPage.tsx`,
  `api/profiles.ts`; `locales/*.json` (righe aggiunte).
- **C**: `apps/mobile/src/health/vo2max.ts` e test (nuovi); righe in
  `health/appleHealth.ts` (dopo la #806), `app.json` (il testo, nel giro
  della 1.0.2).
- **D**: `apps/mobile/src/health/healthConnectVo2max.ts` (nuovo); righe in
  `health/healthConnect.ts`.

## Criteri di accettazione

- Senza sì, nessun VO₂ max esce dal telefono e il profilo non ne mostra.
- Dopo il sì il profilo, visto da un altro account, mostra valore e fonte;
  un account bloccato non lo vede, come il resto del profilo.
- Spento in Impostazioni, il profilo non lo mostra più e il server cancella
  il numero di Salute.
- La stima è la stessa a ogni lettura con gli stessi record (test con
  record noti: 5K in 20:00 → 50).
- Test deterministici per la stima, gli endpoint, il componente e la lettura
  da Salute con la libreria finta (`docs/TESTING.md`).
