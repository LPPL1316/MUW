# TASK-341 — I badge sul profilo: primo disegno, 10 disegni, 30 km

**Stato**: Todo — documenti nella PR `docs/TASK-341-profile-badges`; il
codice parte dopo il loro merge
**Fase**: 4 · **Branch**: `feat/TASK-341-profile-badges`
**ADR**: ADR-0294 · **Migrazione**: nessuna · Numeri dati dal
Coordinatore il 2026-10-29

## Obiettivo

Sul profilo, accanto a «Winner», ci sono tre badge nuovi, decisi dal
server: il primo disegno, 10 disegni, un disegno di almeno 30 km.

Richiesta dell'utente del 2026-10-29 (testo incollato, «GPS Art e
challenge mensili», punto 5): «Badge: primo disegno, 10 disegni, disegno
oltre 30 km, vincitore challenge». Quasi tutta la richiesta c'era già;
la proposta delle sole parti mancanti (`out/gps-art-lacune/proposta.md`
nel checkout principale) è stata **approvata dall'utente con «Yes, as
proposed»** lo stesso giorno. Le statistiche chieste (km, disegni, voti
ricevuti) ci sono già: TASK-324, ADR-0284.

## Contesto da leggere

- `DECISIONS.md` ADR-0294 (questo task), ADR-0284 (i totali), ADR-0260
  §«Winner» e ADR-0272 (le corse importate non partecipano)
- `CONCORSI.md` §7 (il badge «Winner» nell'app)
- `services/api/shaperoute_api/profiles.py` (`PublicProfileBody`,
  `profile`), `drawings.py` (`published_count_sql`, `shown_sql`),
  `profile_totals.py`
- `apps/mobile/src/contest/WinnerBadge.tsx`,
  `apps/mobile/src/profile/ProfileHeader.tsx`

## Cosa fare

1. **API.** Un modulo nuovo `badges.py` con una sottoquery
   `badges_sql(user_column, viewer)` che dà la lista delle chiavi dei badge
   presi, nell'ordine fisso: `first_drawing` (almeno 1 disegno), `ten_drawings`
   (almeno 10), `long_drawing` (un disegno di almeno 30 000 m). Contano i
   disegni che chi guarda vede (`shown_sql`, la stessa regola del numero
   `drawings` sul profilo), non nascosti dalla moderazione, di corse
   **registrate dall'app** (`runs.source = 'muw'`, come il concorso).
   I metri sono `runs.distance_m`, contati dall'API al salvataggio.
2. `badges: list[Badge]` in `PublicProfileBody` (`GET /users/{public_id}`).
   Il proprio profilo legge già `GET /users/{public_id}` con il token per i
   totali (`ProfileStats.tsx`): da lì prende anche i badge, quindi `GET /me`
   non cambia (e `accounts.py` non importa `drawings.py`, che importa lui).
   «Winner» resta `contest_wins`, che non cambia.
3. **Tipi.** `badges?: ProfileBadge[]` in `PublicProfile` di
   `shared-types` (assente da un'API più vecchia), `PROFILE_BADGES` come
   costante; fixture `public-profile.json` aggiornata.
4. **App.** Un componente nuovo `profile/BadgeRow.tsx`: una fila di
   piccoli badge sotto il nome, nello stile di `WinnerBadge` (bordo
   neutro, emoji, testo piccolo in grassetto), «Winner» per primo quando
   c'è. Sul **proprio** profilo i badge non ancora presi si vedono
   spenti (opacità ridotta, `accessibilityState` disabilitato); sul
   profilo di un altro solo quelli presi. Senza `badges` (API vecchia):
   solo «Winner», come oggi. `ProfileHeader` riceve la fila al posto del
   solo `WinnerBadge`.
5. **Testi** nelle cinque lingue: «First drawing», «10 drawings»,
   «{distance} drawing» («30 km drawing», con le miglia «19 mi
   drawing»), e l'etichetta di accessibilità «Not earned yet: …»; in
   italiano «Primo disegno», «10 disegni», «Disegno da 30 km», «Non
   ancora preso: …». **Approvati dall'utente il 2026-10-30 con «Yes,
   approve»**, sulla tabella delle cinque lingue della PR #651.
6. `API.md` («Profile»), `STATUS.md`, task file a `Done`.

## Criteri di accettazione

- [ ] `GET /users/{id}` dà `badges` vuoto per un account senza disegni,
      `["first_drawing"]` con uno, `["first_drawing", "ten_drawings"]`
      con dieci, e `long_drawing` con un disegno di 30 000 m (non con
      29 999 m).
- [ ] Una corsa importata (`source` diverso da `muw`), un disegno
      `only_me` o nascosto dalla moderazione non contano.
- [ ] Un disegno per i soli follower conta per chi segue, non per chi
      non segue (la regola di `shown_sql`).
- [ ] Il proprietario vede i propri badge con `GET /users/{id}` e il token.
- [ ] L'app mostra i badge presi sotto il nome; sul proprio profilo
      anche quelli spenti; con un'API senza `badges` solo «Winner».
- [ ] Test deterministici: `test_badges.py` (una regola per test),
      `BadgeRow.test.tsx`, `ProfileHeader.test.tsx` aggiornato.
- [x] Testi approvati dall'utente (2026-10-30, «Yes, approve»); nessuna dipendenza nuova; impronta
      iOS invariata (`83793e26`).

## File toccati

```
services/api/shaperoute_api/badges.py            (nuovo)
services/api/shaperoute_api/profiles.py
services/api/tests/test_badges.py                (nuovo)
services/api/tests/test_profiles.py
packages/shared-types/src/index.ts
packages/shared-types/fixtures/public-profile.json
packages/shared-types/test/accounts.test.ts
apps/mobile/src/profile/BadgeRow.tsx             (nuovo)
apps/mobile/src/profile/BadgeRow.test.tsx        (nuovo)
apps/mobile/src/profile/ProfileHeader.tsx
apps/mobile/src/profile/ProfileHeader.test.tsx
apps/mobile/src/profile/ProfileHome.tsx
apps/mobile/src/profile/ProfileStats.tsx
apps/mobile/src/profile/UserProfilePage.tsx
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/es.ts
apps/mobile/src/i18n/fr.ts
apps/mobile/src/i18n/it.ts
docs/API.md
docs/STATUS.md
docs/DECISIONS.md
docs/tasks/TASK-341.md
```

## Fuori scope

- Altri badge, una pagina dei badge, un tocco che li spiega.
- Una notifica quando si prende un badge.
- Le statistiche: ci sono già (TASK-324).
- I badge delle sfide del mese: TASK-343.

## Esito

*(a fine task)*
