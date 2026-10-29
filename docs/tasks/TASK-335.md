# TASK-335 — La mappa sotto i disegni mentre «Draw» calcola

**Stato**: Done · 2026-10-29, chiuso nella stessa PR del codice
**Fase**: 4 · **Branch**: `feat/TASK-335-maps-while-routing`

## Obiettivo

Le sei schede «MEANWHILE, FROM THE FEED» che compaiono mentre «Draw»
cerca un percorso (TASK-317) hanno sotto la linea la foto della mappa del
posto, come in «Feed» e in «Explore».

Segnalazione dell'utente del 2026-10-29: «mentre sta calcolando un percorso
dal feed, ci sono delle immagini, ma non c'è la cartina sotto le varie
città». Era una scelta scritta (ADR-0277, punto 3: solo la linea, niente
rete mentre il motore cerca). Fra due proposte («Durante l'attesa»: le foto
si scattano mentre si aspetta; «Preparata prima, nel Feed»: le foto si
scattano prima, nel Feed) l'utente ha scelto **«Durante l'attesa»**.
Numeri dal Coordinatore lo stesso giorno: TASK-335, ADR-0291.

## Contesto da leggere

- `docs/DECISIONS.md` ADR-0277 (l'attesa in «Draw»), ADR-0131 (la foto
  della mappa fatta da una pagina nascosta), ADR-0177 (il motore sul
  telefono).
- `docs/UI.md`, il paragrafo «Dopo 3 s di attesa…» sotto la tabella delle
  attese di «Draw route».

## Le condizioni del Coordinatore (2026-10-29)

1. `RoutePanel.tsx` è occupato da TASK-331 e da MUW: si resta in
   `WhileRouting.tsx` e nei file nuovi.
2. Il calcolo non deve rallentare: misurare un cuore da 5 km a Trento,
   tre volte, con e senza le sei foto, e scrivere i numeri qui. Se rallenta
   in modo visibile, le foto partono dopo i 3 s o una alla volta.
3. La cache del Feed: la stessa scheda non si scatta due volte. Niente
   richieste quando non c'è rete.
4. Nessun testo nuovo; impronta iOS `83793e26` su una copia pulita della
   testa.
5. Riallinearsi a `main` dopo la #625.

## Cosa fare

1. In `WhileRouting.tsx` una pagina nascosta (`FeedMapShooter`, ADR-0131)
   alla misura della scheda (132 × 88), sotto la fila, che è opaca
   (`color.surface`) e la copre. In «Draw» il Feed non c'è, e senza questa
   pagina nessuno scatterebbe le foto.
2. Ogni scheda chiede la sua foto con `useFeedMap`, la stessa cache del
   Feed per tutta la vita dell'app. La scheda mostra la linea da sola
   finché la foto non arriva.
3. Le foto si chiedono **due schede alla volta**: la pagina scatta una
   foto mentre la successiva aspetta, così resta aperta fra le due. Se la
   coda si svuotasse, la pagina si smonterebbe e ricaricherebbe MapLibre
   per ogni foto. La scheda dopo chiede solo quando la foto di due posti
   prima è arrivata, quindi due foto che non arrivano (senza rete) fermano
   le altre. Se MapLibre non si carica, la pagina rinuncia già da sola
   (ADR-0131).
4. Sotto la fila la riga del credito delle mappe, `CardMapsCredit`, come in
   «Explore» («Maps: …», già tradotta).
5. Test, misura, documenti.

## Criteri di accettazione

- [x] Ogni scheda ha la foto della sua mappa sotto la linea quando arriva;
  prima ha la linea da sola (test).
- [x] Le foto si scattano una dopo l'altra, con la stessa pagina caricata
  una sola volta (test).
- [x] Due foto che non arrivano fermano le altre: la pagina se ne va e non
  chiede più niente (test).
- [x] Una foto già scattata non si scatta di nuovo (test).
- [x] Sotto la fila c'è «Maps: …» (test).
- [x] La pagina se ne va con la scheda dell'attesa (test).
- [x] Il calcolo sul telefono non rallenta in modo visibile (misura sotto).
- [x] Nessun testo nuovo; `RoutePanel.tsx` non toccato.
- [x] Impronta iOS `83793e26` su una copia pulita della testa.

## La misura (2026-10-29)

Simulatore iOS 27 (iPhone 17) sul Mac, Expo Go 57.0.9, codice della testa
`0e454beb` da una copia pulita (`npm ci`). API del branch sulla porta 8035,
che dà la zona `foot` di Trento (2,7 MB). Una schermata di prova, mai
committata (copia in `out/TASK-335/Bench335.tsx`), scarica la zona, accende
il motore e calcola **sul telefono** (`planOnPhone`) un cuore da 5 km da
Trento `[46.0671, 11.1214]`: un primo giro di riscaldamento, poi tre giri
senza la fila e tre con la fila, alternati. «Con» è il caso peggiore: la
fila compare subito, non dopo 3 s, e la cache delle foto si svuota prima di
ogni giro, così le sei foto si scattano ogni volta durante il calcolo.

| Giro | Con la fila | `planMs` | Tempo totale |
|---|---|---|---|
| 0 (riscaldamento) | no | 8104 | 11376 |
| 1 | no | 7295 | 7357 |
| 2 | sì | 7737 | 7767 |
| 3 | no | 8216 | 8273 |
| 4 | sì | 7529 | 7555 |
| 5 | no | 7592 | 7616 |
| 6 | sì | 7875 | 7901 |

Media senza la fila **7701 ms**, con la fila **7714 ms**: +13 ms, dentro
lo scarto fra un giro e l'altro senza fila (921 ms). Nel giro 4, mentre il
motore calcolava ancora, tre schede avevano già la mappa. Alla fine del
giro 6 le foto erano 6 su 6. Il calcolo non rallenta in modo visibile: le
foto restano come sono (dopo i 3 s, una alla volta) e non serve altro. Il
limite della misura: CPU del Mac, non di un iPhone. Una prova sul telefono
vero si fa con la prossima preview. Le schermate sono in `out/TASK-335/`.

## File toccati

```
apps/mobile/src/route/WhileRouting.tsx
apps/mobile/src/route/WhileRouting.test.tsx
docs/tasks/TASK-335.md
docs/DECISIONS.md
docs/STATUS.md
docs/UI.md
```

## Fuori scope

- Le foto preparate prima, nel Feed (l'altra proposta, non scelta).
- Una mappa nascosta anche per «Explore» o altre pagine: hanno già la loro.
- Sapere se c'è rete con un modulo (servirebbe una dipendenza).
- `RoutePanel.tsx`, `FeedMaps.tsx`, `feedMapPage.ts`: non cambiano.

## Esito

Le schede dell'attesa hanno la mappa sotto la linea, viste nel simulatore
iOS mentre il telefono calcolava. Il calcolo non rallenta (+13 ms su
7,7 s). Resta da vederla sull'iPhone con la prossima preview: arriva ai
telefoni con il prossimo OTA, che vuole il sì dell'utente.
