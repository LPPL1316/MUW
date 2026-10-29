# TASK-324 — I totali e le foto di un profilo

**Stato**: Done — in `main` di `LPPL1316/MUW` con la PR #1; server, sito
e app restano da pubblicare (sotto, «Esito»)
**Fase**: 4 · **Branch**: `claude/wonderful-dijkstra-oi568i` (il branch
assegnato alla sessione cloud, non `feat/TASK-324-…`)
**ADR**: ADR-0284 · **Migrazione**: `0037_run_climb.sql` (il primo libero
in `main` al merge: la 0034 l'ha presa TASK-312, `0034_run_source.sql`,
la 0035 TASK-297 A2, `0035_drawn_routes_placement.sql`, e la 0036
TASK-322 A, `0036_user_identities.sql`, mentre MUW e shaperoute erano
divergenti) · Numeri di task e di ADR
presi senza coordinatore (nessuna sessione raggiungibile): nato come
TASK-305 e ADR-0265, rinumerato due volte perché nel frattempo altre
sessioni li avevano presi (TASK-305 e TASK-311, ADR-0265 e ADR-0271);
TASK-324 e ADR-0284 sono i primi liberi dopo TASK-323 e ADR-0283 in
`main` e nei branch remoti al 2026-10-28

## Obiettivo

Sul profilo di un iscritto (e sul proprio) si vedono i km totali, il
dislivello totale e i like ricevuti, e accanto ai disegni le foto. Follower,
seguiti e disegni c'erano già.

Richiesta dell'utente del 2026-10-26: «quando vai sul profilo di un utente
bisogna dare la possibilità di vedere i disegni fatti, le foto fatte, e
tutti i dettagli dei km percorsi totali... dislivello... aggiungendo anche
i numeri di like presi totali come statistica numero followers...».
Proposta con i totali dalle sole corse pubblicate; **scelta dell'utente:
«Km anche dalle private»** (km e dislivello di tutte le corse salvate).
«Like» = le sei reazioni lasciate dagli altri sui disegni che chi guarda
vede.

## Contesto da leggere

- `docs/DECISIONS.md` ADR-0284 (e ADR-0140 per i numeri contati dall'API);
- `docs/API.md` «Profile» e «My activities»; `docs/DATABASE.md` `runs`;
- `docs/UI.md` «Profile» e «Il profilo di un altro iscritto».

## Cosa fare

1. **API** — `runs.climb_m` (migrazione); `altitude_m` facoltativo sulle
   posizioni di `PUT /me/activities/{key}` (`ActivityFixBody`), il
   dislivello contato da `run_climb.py` sulla traccia pulita, niente a
   cavallo di una pausa chiesta; `distance_m`, `climb_m`, `reactions` in
   `PublicProfileBody` (`profile_totals.py`); `GET
   /users/{public_id}/photos` (`user_photos.py`), una riga in `app.py`.
2. **Contratto** — `PublicProfile` con i tre numeri, `UserPhoto` e
   `UserPhotosPage` in `shared-types`, `fixtures/user-photos.json`.
3. **App** — l'altezza di ogni posizione mandata con la corsa, e senza se
   l'API la rifiuta (`withoutHeights`); `ProfileStats` (tre riquadri) e
   `ProfileGallery` («Drawings» | «Photos», le foto alla prima apertura
   della scheda) nel profilo di un altro e nel proprio; i testi in quattro
   lingue.

## Criteri di accettazione

- [x] Una corsa con le altezze ha `climb_m` contato dall'API con la regola
      dell'app (3 m); senza altezze `NULL`; niente salita a cavallo di una
      pausa chiesta (`test_profile_totals.py`).
- [x] `GET /users/{id}` ha `distance_m` e `climb_m` di tutte le corse,
      private comprese, e `reactions` degli altri sui disegni visti da chi
      guarda, senza le proprie e senza chi un blocco tiene lontano.
- [x] `GET /users/{id}/photos` dà le foto dei disegni visti, dalla corsa più
      recente, a pagine; `404` per un profilo che non c'è o bloccato.
- [x] L'app mostra i tre totali e le schede; con un'API di prima tutto come
      prima; una corsa con le altezze rifiutata va di nuovo senza.
- [x] Test verdi: API (`pytest`, PostgreSQL vero), `shared-types`, app
      (`jest`, `tsc`, `expo lint`, `prettier`).
- [x] Informativa e aiuto aggiornati nelle cinque lingue, con i testi
      approvati dall'utente il 2026-10-26; pagine del sito rigenerate.

## File toccati

```
services/api/migrations/0037_run_climb.sql               (nuovo)
services/api/shaperoute_api/run_climb.py                 (nuovo)
services/api/shaperoute_api/profile_totals.py            (nuovo)
services/api/shaperoute_api/user_photos.py               (nuovo)
services/api/shaperoute_api/activities.py                (ActivityFixBody, climb_m)
services/api/shaperoute_api/profiles.py                  (tre campi in PublicProfileBody)
services/api/shaperoute_api/app.py                       (una riga: install_user_photos)
services/api/tests/test_profile_totals.py                (nuovo)
services/api/tests/test_profiles.py                      (i tre campi nell'uguaglianza del profilo)
packages/shared-types/src/index.ts                       (PublicProfile +3, UserPhoto, UserPhotosPage)
packages/shared-types/fixtures/public-profile.json       (tre campi)
packages/shared-types/fixtures/user-photos.json          (nuovo)
packages/shared-types/test/accounts.test.ts              (le chiavi di PublicProfile)
packages/shared-types/test/userPhotos.test.ts            (nuovo)
apps/mobile/src/api/activities.ts                        (ActivityFix, withoutHeights)
apps/mobile/src/api/userPhotos.ts                        (nuovo)
apps/mobile/src/activities/recordedRun.ts                (altitude_m quando c'è)
apps/mobile/src/profile/ProfileStats.tsx                 (nuovo)
apps/mobile/src/profile/ProfileGallery.tsx               (nuovo)
apps/mobile/src/profile/UserProfilePage.tsx              (monta i due)
apps/mobile/src/profile/ProfileHome.tsx                  (monta i due)
apps/mobile/src/social/DrawingsGrid.tsx                  (titled, per le schede)
apps/mobile/src/i18n/it.ts, de.ts, es.ts, fr.ts          (quattro testi accanto a «Drawings»)
apps/mobile/src/about/content/en.ts, it.ts, de.ts, es.ts, fr.ts   (informativa e aiuto: altezza e totali)
site/privacy/index.html, it/, de/, es/, fr/index.html    (rigenerate: node site/tools/make_privacy.mjs)
apps/mobile/src/api/activityHeights.test.ts, userPhotos.test.ts                 (nuovi)
apps/mobile/src/profile/ProfileStats.test.tsx, ProfileGallery.test.tsx          (nuovi)
apps/mobile/src/screens/ProfileEntryPoints.test.tsx      (la pagina propria ora chiede /users/{id} per i totali: si controlla che non si apra il profilo di un altro)
docs/tasks/TASK-324.md (nuovo), docs/DECISIONS.md (ADR-0284), docs/STATUS.md,
docs/API.md, docs/DATABASE.md, docs/UI.md
```

**Conflitti da sapere**: `UserProfilePage.tsx` e `ProfileHome.tsx` sono
anche nei «File toccati» di TASK-299 parte B (il badge «Winner»), in
lavorazione. Qui solo poche righe (import, due componenti montati); il
resto sta in file nuovi. Chi entra secondo unisce tenendo tutte e due le
parti.

## Fuori scope

- Il dislivello in «My activities» e nella corsa salvata (la colonna c'è,
  l'elenco non la manda).
- Ricostruire il dislivello delle corse di prima (l'altezza non c'era).
- Totali per sport (a piedi, in bici, in canoa separati), per anno o per
  mese, record.
- I sei numeri nella stessa riga: follower, seguiti e disegni restano dove
  erano.

## Aperto

1. **La privacy** (fatto) — l'informativa diceva «A saved run is
   private: only your account sees it.» e «every position with its time».
   Testi approvati dall'utente il 2026-10-26 («Sì, con questi testi»):
   «every position with its time and height» e, dopo «only your account
   sees it» e nell'aiuto «Publish and share», «Other members see on your
   profile only the totals of all your saved runs, distance and elevation
   gain, never the runs themselves.», nelle cinque lingue. La data
   dell'informativa era già il 26 ottobre 2026. **Il sito va copiato sul
   server (`DEPLOY.md` F.14) insieme all'aggiornamento del server**, con
   l'ok dell'utente: non prima, o l'informativa direbbe cose che il server
   non fa ancora.
2. **Il server prima dell'app**: con l'API di prima l'app non mostra né i
   totali né le schede, e una corsa con le altezze va di nuovo senza
   (nessuna corsa persa, ma senza dislivello).

## Esito

In `main` di `LPPL1316/MUW` con la PR #1 (`84307224`, 2026-10-28): il
primo merge nel repository nuovo, fatto dall'agente con le tre condizioni
di `CLAUDE.md` (CI verde sui sei lavori, diff dentro i «File toccati»,
criteri soddisfatti). Sul profilo di un altro e sul proprio ci sono
«Distance», «Elev. gain» e «Likes» e le schede «Drawings» | «Photos»;
l'app manda l'altezza di ogni posizione, l'API conta il dislivello
(`runs.climb_m`, migrazione `0037`) e risponde ai totali e alle foto.
Informativa e aiuto aggiornati con i testi approvati dall'utente. Test:
app 4202/4202 (Node 24), API verde con PostgreSQL, `shared-types`, sito,
lint e formato. **Resta**: il server (migrazione `0037`) e la copia del
sito **prima dell'app**, con l'ok dell'utente, poi `preview`; `main` di
MUW arriva in `rockydalbianco/shaperoute` con lo specchio di TASK-325.
I seguiti stanno in «Fuori scope».
