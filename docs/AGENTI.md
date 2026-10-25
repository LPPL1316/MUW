# AGENTI — Chi fa cosa, e cosa viene dopo

> L'albero dei lavori degli agenti in parallelo. **Lo aggiorna solo il
> coordinatore** (la sessione «Coordinatore»); gli altri lo leggono.
> Dopo il clear di fine task, un agente trova qui la sua riga: il prossimo
> task, da cosa dipende e quali file non può toccare.

**Ultimo aggiornamento**: 2026-10-10, ~13:00Z · `main` = `98626bbc` · coordinatore: la sessione «Coordinatore» `local_e57a8224` (dal 2026-10-09; la vecchia `local_0caa214a` è archiviata). «Coordinatore 2» è archiviato dal 2026-10-10: i merge li fa il coordinatore; per riaverlo, una sessione nuova con «Sei il Coordinatore 2: segui `docs/COORDINATORE-2.md`».

## Come si usa

1. Trova la tua sessione qui sotto: **Adesso** è il task in corso,
   **Dopo** la coda, in ordine.
2. Un task della coda parte solo quando le sue **dipendenze** sono in `main`.
   Se non lo sono, avvisa il coordinatore e aspetta.
3. Il messaggio di partenza lo manda il coordinatore, completo (numero,
   ADR, file, confini). Se non arriva, chiedilo: non partire da solo.
4. Numeri di task e di ADR: solo dal coordinatore (`CLAUDE.md`). Se il
   coordinatore non risponde e l'utente ha fretta, prendi i primi liberi
   scritti qui sotto e **diglielo prima** di creare i file.
5. **Worktree in `.claude/worktrees/TASK-XXX`**, sul Mac. I controlli JS in
   un worktree usano i `node_modules` del checkout principale; prima del
   push anche `npm run format:check` (prettier non è in `expo lint`).
6. **La coda dei merge è una sola e la tiene il coordinatore.** Nessuna
   sessione mergia fuori coda senza dirlo prima al coordinatore, nemmeno
   su richiesta dell'utente: un merge fuori coda rimette in conflitto le
   PR che stanno facendo girare la CI. Quando la tua PR è pronta, scrivi
   «#NNN pronta» e aspetta. Al tuo turno aggiorni il branch da
   `origin/main`, risolvi i conflitti tenendo tutte le voci, rifai i test,
   fai push e scrivi «#NNN CI in corso».
7. **La CI non la aspetta nessuno da solo.** La guarda il coordinatore
   (la sessione «Agente di assistenza coordinamento» è chiusa dal
   2026-10-02 sera): scrivigli «#NNN pronta», e lui ti manda «merge NNN»
   quando la PR è 5/5 verde e MERGEABLE, o il job che fallisce. La
   sessione proprietaria mergia la sua PR.
8. **PR di soli documenti** (task file, STATUS, AGENTI) entrano appena
   sono verdi e CLEAN, senza aspettare la coda: non toccano codice.
9. **Pubblicare l'app** (`eas update`) e **toccare il server** si fanno
   solo con l'ok dell'utente, da `origin/main` pulito (memoria
   «publish-from-clean-main», `DEPLOY.md` F.12).
   **Una pubblicazione alla volta**: prima di `eas update` o di toccare il
   server chiedi al coordinatore e **aspetta la sua risposta** (arriva a
   fine turno). Il 2026-10-03 due sessioni hanno pubblicato lo stesso
   commit a pochi minuti l'una dall'altra.
10. **Migrazioni del database**: il numero è **il primo libero in `main`
   quando la PR entra** (non uno tenuto prima), così l'ordine è lo stesso
   su ogni database. Prima del merge guarda `services/api/migrations/`.
11. **Dopo un aggiornamento del server che cambia `route_engine`**, gli
   esempi tenuti non valgono più: va rilanciato `draw_examples` (circa 35
   minuti, dentro il container dell'API), mai mentre gira un altro
   aggiornamento.

## La coda dei merge

Alle 13:00Z del 2026-10-10 le uniche PR aperte sono ferme **fino
all'approvazione di Apple della 1.0**: nessun cambio al server né al
motore mentre il revisore prova l'app.

- **#461** TASK-262 C, amici dalla rubrica: pronta e verde, testi e
  privacy approvati. Dopo l'approvazione: ok dell'utente per il server
  (`contact_people.py`, nessuna migrazione), merge, server, copia F.14
  del sito, `preview`; su production serve una 1.0.1 nativa
  (`expo-contacts`). Se la privacy entra dopo il 10 ottobre, la data nuova
  vuole un sì dell'utente. Sessione chiusa: si riprende da
  `tasks/TASK-262.md`, parte C, «Dove si è».
- **#489** TASK-271, «u-turn» in fondo a una strada cieca (motore):
  pronta. Dopo l'approvazione: ok dell'utente per server,
  `draw_examples` e motore sul telefono. Sessione archiviata: la tiene il
  coordinatore (worktree `.claude/worktrees/TASK-271`).

Le PR di soli documenti entrano una alla volta: toccano tutte
`STATUS.md`, e ogni merge rimette in conflitto le altre.

## L'albero

```
App Store 1.0.0 (TASK-152)
  └─ In revisione da Apple dal 2026-10-10: build 5 da `793fa112`,
     fingerprint `83793e26`, uscita manuale, solo iPhone, senza
     pubblicità, utente «non commerciante» fino alla società.
     Dopo l'approvazione: «Release This Version» (utente); il primo
     `eas update --channel production` (TASK-270, 269) solo col via del
     coordinatore; la 1.0.1 nativa con TASK-262 C

Fermi fino all'approvazione di Apple
  ├─ #461 TASK-262 C e #489 TASK-271 (sopra)
  └─ `draw_examples --water` (spiagge di TASK-245 C e laghi di TASK-246 B,
     4–8 ore sul server), con l'ok dell'utente

Da avviare (chip; le scelte dell'utente ci sono)
  ├─ TASK-272 · ADR-0240  la corsa interrotta «riapre la corsa in pausa»
  └─ TASK-273 · ADR-0241  partire da qualsiasi punto di una forma chiusa,
                           «automatico, dove la tocchi»
     272 e 273 toccano `navigator.ts`, `progress.ts`, `useNavigation.ts`:
     l'ordine dei merge lo dà il coordinatore

Fermi per scelta dell'utente
  ├─ TASK-153 AdMob vero: aspetta la società (ADR-0236 riservato, branch
  │  `feat/TASK-153-admob-live` con lo stato nel task file)
  └─ TASK-262 B, la mail di conferma

Chiusi dal 2026-10-07 al 2026-10-10: 092, 118, 121, 152 (A e B, inviata
in revisione), 182 E, 203 B, 234 C, 237 D ed E (privacy e assistenza
online), 245 C, 246 B, 251 C, 261 (A e B), 262 A, 263, 264, 265, 266,
267 (A e B), 268, 269, 270, 274.
```

## File occupati adesso

| File | Di chi |
|---|---|
| `site/`, `docs/SITO.md` | TASK-237 (sessione «SITO WEB») |
| `apps/mobile/src/about/content/*.ts`, `site/privacy/**`, `site/tests/privacy.test.mjs` | TASK-262 C (#461) fino al merge |
| `services/route-engine/route_engine/directions.py` e il suo test | TASK-271 (#489) |
| `docs/STATUS.md`, `docs/DECISIONS.md`, `docs/UI.md` | tutti, ognuno solo le sue righe |
| `docs/AGENTI.md`, `CLAUDE.md` | coordinatore |

## Numeri

- Task: presi fino a **TASK-274**. Il prossimo libero è **TASK-275**.
- ADR: presi fino a **ADR-0241** (0225 TASK-261, 0226 TASK-262, 0227
  TASK-118, 0228 TASK-121, 0229 TASK-092, 0230 TASK-203 B, 0231 TASK-263,
  0232 TASK-264, 0233 TASK-152, 0234 TASK-265, 0235 TASK-266, 0236
  TASK-153 riservato, 0237 TASK-267, 0238 non usato (TASK-268 è
  un'aggiunta ad ADR-0137), 0239 TASK-269, 0240 TASK-272, 0241 TASK-273;
  TASK-270, 271 e 274 sono aggiunte ad ADR-0052, ADR-0045 e ADR-0120). Il
  prossimo libero è **ADR-0242**.
- Migrazioni in `main` e sul server: 0001–0019 come prima, 0020
  segnalazioni e blocchi (TASK-121), 0021 token push (TASK-262 A). La
  prossima: il primo libero al merge.

## Il server e l'app

- **Server**: Hetzner CX33 (il CX43 non era disponibile) più un
  **Volume da 70 GB** montato in bind su `/root/shaperoute/data/cache`
  (riga in `/etc/fstab`), da `deploy/compose.yaml` con PostgreSQL.
  `https://api.getmuw.app` (e il vecchio `sslip.io`), sito su
  `https://getmuw.app` (privacy e `/support/`). A `main` `55b990be` dal
  2026-10-10 05:11Z, migrazioni 0001–0021; immagine di prima
  `shaperoute-api:before-task262a`, copia del database
  `shaperoute-2026-10-10T0510Z.dump`. Zone: 225 città nuove (USA 58 con
  Cupertino per il revisore, Italia 99 sopra i 50 000 abitanti, Europa
  68), con i file per i telefoni. Acqua: 291 file (67 spiagge). Spazio:
  disco principale ~59 GB liberi, volume ~16 GB.
- **App**: `preview` da `main` `066d10e8` (gruppo `cd929227`). Il
  coordinatore pubblica da solo le cose di sola app (ok dell'utente del
  2026-10-05); per il server l'ok si chiede ogni volta. **Production**:
  la 1.0.0 (build 5) in revisione; nessun `eas update --channel
  production` senza il via del coordinatore.
- **Server e pubblicazione li fa una sessione sola per volta**, anche
  quando l'utente dà l'ok in più sessioni: chi lo riceve lo scrive al
  coordinatore e aspetta il suo via.
- **Chi cambia il motore** rifà `apps/mobile/assets/engine/engine.zip`
  (`python tools/phone_engine/phone_engine.py engine`) e, se tocca i file
  dell'acqua o le sagome, `src/paddle/paddleExamples.json`
  (`python -m shaperoute_api.paddle_examples`): due test della CI lo
  chiedono.

## Fatto in questa tornata (2026-10-01/02)

In `main`: #137 (TASK-136), #112 (088), #148 (140), #142 (142), #149 (147),
#141 (144), #147 (128), #151 (114), #152 (146), #153 (148), #155 (AGENTI),
#154 (149), #156 (151), #158 (115), #161 e #163 (task file di 067), #159
(task file 150/152/153), #130 (132), #162 (154), #160 (155), #157 (122),
#150 (137), #166 (158), #165 (157), #164 (156), #167 (122, copie), #140
(141), #169 (141), #170 (AGENTI), #168 (159), #171 (160), #172 (165), #173
(162), #174 (163, prima PR), #175 (161), #176 (164), e poi fino alla #214:
#177–#402, fra cui 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176,
177, 178, 179, 180, 181, 186, 187 (API), 188, 189, 190 A, 192, 193, 194,
195, 196, 067, 190 (A, B, C), 191 A1 e A2, 197, 198, 199, 116, 201 (misurato, non conviene), 200,
202, 203, 187 (app), 204, 117 (A e B), 191 B, 205, 206 (A e B), 207,
210 A, 211 A, 212, 213, 215, 120, 208 A, 209, 214 (A, B, C), 216, 218,
219, 220, 221, 222, 223, 224, 225, 226 (A, B), 227, 228, 233, 234, 235, 236, 237 (A, A2), 211 B, 214 (A2, B2), 229, 230, 231 (A, B),
119 (A, B), 217 e 191 C.
