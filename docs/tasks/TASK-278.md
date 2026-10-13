# TASK-278 — Il proprio profilo come quarta pagina, dopo «Explore»

**Stato**: Done
**Fase**: 4 · **Branch**: `feat/TASK-278-profile-page`

## Obiettivo

Da «Explore» uno swipe a sinistra porta al proprio profilo, una quarta
pagina come le altre tre; il cerchio della foto in alto a destra resta, e
si illumina quando quella pagina è sullo schermo.

## Contesto

Chiesto dall'utente il 2026-10-11 («Dopo explore metti il mio profilo
personale facendo uno swipe a sinistra»), nella sessione «Explore e Draw:
profilo e disegno mappa»; numero dal Coordinatore. Oggi le pagine sono tre
(«Feed» · «Draw» · «Explore», ADR-0124) e «Profile» si apre sopra l'app
toccando il cerchio (`ProfileLayer`, TASK-154, TASK-177). «Explore» è
l'ultima pagina: uno swipe a sinistra lì non fa niente (TASK-196).

**Scelta dell'utente del 2026-10-11** sull'intestazione: in alto restano
**tre nomi** («Feed», «Draw», «Explore») più lo sport e **il cerchio**
con la foto. Il cerchio si illumina (la lineetta sotto, come i nomi)
quando il profilo è la pagina sullo schermo; toccarlo porta lì con lo
scorrere delle pagine, invece di aprire un foglio sopra l'app. Scartato:
quattro nomi in alto senza il cerchio (non ci stanno accanto allo sport
su un iPhone da 390 pt, né in tedesco).

Solo app: niente server, niente motore, niente contratto. Può partire
mentre Apple prova la 1.0; va su `preview`, non nella 1.0.

## Contesto da leggere

- `docs/UI.md`: «Le pagine: «Feed», «Draw», «Explore»» e «Profile»
- `docs/DECISIONS.md`: ADR-0124 (le pagine), ADR-0125 e ADR-0145
  (Profile), ADR-0235 (il giro di benvenuto, TASK-266)
- `apps/mobile/App.tsx` (il `Pager` e le sue pagine),
  `src/screens/Pager.tsx`, `src/screens/pageTitles.ts`,
  `src/screens/ProfileLayer.tsx`, `src/profile/ProfileHome.tsx`,
  `src/tour/tourParts.ts`

## Cosa fare

1. Una quarta pagina nel `Pager`, a destra di «Explore»: il contenuto è
   quello che oggi apre il cerchio (`ProfileHome`: senza account
   «Sign up» / «Log in», con l'account il profilo con le sue righe).
   Costruita solo quando ci si arriva (`lazy`), come «Explore».
2. Nell'intestazione i nomi restano tre: la quarta pagina non ha un nome
   in alto. Il cerchio (`ProfileButton`) prende la lineetta della pagina
   accesa quando il profilo è sullo schermo, e un tocco porta alla quarta
   pagina scorrendo, come un tocco su un nome.
3. Le pagine che dal profilo si aprono sopra (Settings, Favorites, My
   activities, Find friends, un disegno, il profilo di un altro) restano
   come oggi: si aprono sopra l'app e «←» torna alla quarta pagina.
   Le porte (`ProfileLayer`, contesti) restano dove sono; se una di
   queste cose non si può tenere, fermarsi e dirlo.
4. Chi oggi apre «Profile» da un'altra pagina (per esempio la lente di
   «Feed» senza account, «Log in to find your friends.») ci arriva come
   prima: se ha senso che porti alla quarta pagina, è una scelta da
   chiedere all'utente, non da prendere qui.
5. Il giro di benvenuto (TASK-266) che nomina le pagine: controllare che
   regga con quattro; se va cambiato un testo, chiedere all'utente.
6. VoiceOver: la quarta pagina fuori dallo schermo non si legge (come le
   altre); il cerchio dice se la pagina è quella accesa.
7. `UI.md` aggiornato (quattro pagine, il cerchio), aggiunta in fondo ad
   ADR-0124 «deciso dall'utente il 2026-10-11».

## Criteri di accettazione

- [x] Da «Explore» uno swipe a sinistra mostra il proprio profilo; uno a
      destra torna a «Explore» (test del `Pager` con quattro pagine).
- [x] In alto restano tre nomi; il cerchio ha la lineetta solo quando il
      profilo è sullo schermo (test).
- [x] Un tocco sul cerchio da qualsiasi pagina porta al profilo; non si
      apre più il foglio sopra l'app per la pagina principale del profilo
      (test).
- [x] Settings, Favorites, My activities e un disegno aperti dal profilo
      tornano con «←» alla quarta pagina (test).
- [x] Senza account la pagina mostra «Sign up» e «Log in» come oggi.
- [x] Nessun testo nuovo senza il sì dell'utente; `npm test`,
      `expo lint`, `format:check` verdi.

## File toccati

Previsti; la sessione li conferma all'inizio e dice nella PR quelli in
più.

```
apps/mobile/App.tsx
apps/mobile/src/screens/Pager.tsx
apps/mobile/src/screens/Pager.test.tsx
apps/mobile/src/screens/pageTitles.ts
apps/mobile/src/screens/ProfileLayer.tsx
apps/mobile/src/screens/ProfileLayer.test.tsx
apps/mobile/src/tour/tourParts.ts
docs/UI.md
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-278.md
```

## Fuori scope

- Un quarto nome in alto o un cerchio diverso (scelta già fatta).
- Cambiare cosa c'è nel profilo, o le pagine che si aprono sopra.
- Il profilo di un altro iscritto come pagina.
- Pubblicare l'app: lo fa il Coordinatore.

## Esito

Fatto il 2026-10-13 (aggiunta ad ADR-0124): il proprio profilo è la quarta
pagina dopo «Explore», con il cerchio che ha la lineetta quando è lì e ci
porta con un tocco; le pagine che apre restano sopra l'app e «←» torna
alla quarta pagina; la pagina si rifà a ogni ritorno. Provato anche nel
simulatore (iPhone 17e): tocco sul cerchio, «Settings» e «←», «Guide» e
«←», swipe da e verso «Explore».

- **Scelte dell'utente del 2026-10-13**: la quarta pagina **senza titolo**
  né «←», come le altre; il testo di «Help» cambiato nelle cinque lingue
  («The app has four pages side by side, «Feed», «Draw», «Explore» and your
  profile: … The circle at the top takes you to your profile.»). Il giro di
  benvenuto non cambia: non nomina il numero delle pagine.
- **File in più**, con l'ok del Coordinatore: `src/screens/ProfileScreen.tsx`
  (`onBack` facoltativo: senza, niente «←» né titolo; «Guide» aperto per
  primo torna alla prima pagina), i test che aprivano «Profile» dal cerchio
  e lo chiudevano con «←» (`src/account/Profile.test.tsx`,
  `__tests__/AppActivities.test.tsx`, `AppFavorites.test.tsx`,
  `AppProfilePhoto.test.tsx`) e `src/about/content/{en,it,de,es,fr}.ts`
  (solo il paragrafo delle pagine). `tourParts.ts` non è servito.
- **Resta da chiedere all'utente** (punto 4): se gli altri ingressi (il
  cuore e «Save» senza account, la lente di «Feed» senza account, un nome
  taggato, una notifica) debbano portare alla quarta pagina invece di
  aprire «Profile» sopra l'app. Oggi restano come prima.
- **Da guardare**: il sito (`site/`) non dice «three pages»; se la guida
  del sito lo dicesse altrove, è un seguito del Coordinatore.
