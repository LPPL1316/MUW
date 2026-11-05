# TASK-386 — «Heart rate zones»: «bpm» dentro il riquadro

**Stato**: Done · 2026-11-05
**Fase**: 4 · **Branch**: `fix/TASK-386-zones-bpm-box`
**Numeri**: TASK-386, assegnato dal Coordinatore. Seguito di TASK-383
(«Body», PR #759) e di TASK-374 B (ADR-0318 §6 e §15).

## Obiettivo

Con TASK-383 l'utente ha scelto «Dentro il riquadro» per l'unità di peso e
altezza in «Body». Alla domanda «Vuoi lo stesso aspetto anche per «bpm» nella
pagina delle zone?» ha risposto (2026-11-04): «Sì, task a parte».

## Cosa c'è oggi

In `settings/HeartZonesPage.tsx` (Impostazioni → «Body» → «Heart rate
zones»), «bpm» sta a destra di ogni casella, in `fontSize.body` e
`color.textMuted`: dopo «Max heart rate», «Resting heart rate», il limite alto
delle zone 1–4 (che si scrive) e quello della zona 5 (che non si scrive, è la
FC massima).

## Cosa cambia

`BpmInput`, come `NumberInput` di «Body» con TASK-383: il riquadro (bordo,
sfondo, raggio) passa dal `TextInput` a un `Pressable` che tiene il numero e,
dopo, «bpm» nella stessa dimensione del numero (`fontSize.input`) e in
`color.textMuted`. Un tocco ovunque nel riquadro, anche su «bpm», apre la
tastiera del campo. Il limite della zona 5 non si scrive e resta senza
riquadro, ma il numero e «bpm» stanno allo stesso posto e nella stessa
dimensione di quelli delle caselle sopra. Colori e misure da
`theme/tokens.ts`. Nessun testo nuovo («bpm» non si traduce), nessuna
dipendenza, solo JS: impronta iOS invariata (`6f8bba4c`). `BodyPage.tsx` non
si tocca (è di TASK-383 finché #759 non è in `main`): niente componente
condiviso.

## Criteri di accettazione

- [x] «bpm» sta nel riquadro di «Max heart rate», «Resting heart rate» e
      delle zone 1–4, in `fontSize.input`, anche a campi vuoti; quello della
      zona 5 sta accanto al suo numero; nessun «bpm» fuori
      (`HeartZonesPage.test.tsx`).
- [x] Un tocco su «bpm» apre la tastiera del suo campo (il test fallisce se
      si toglie).
- [x] I test di prima di `HeartZonesPage` restano verdi; typecheck, lint e
      Prettier verdi in locale sui file toccati.
- [x] CI verde (#761 in main, cebe5412).

## File toccati

```
apps/mobile/src/settings/HeartZonesPage.tsx
apps/mobile/src/settings/HeartZonesPage.test.tsx
docs/tasks/TASK-386.md                       (nuovo)
docs/STATUS.md
docs/DECISIONS.md
docs/UI.md
```

## Fuori scope

- Un componente condiviso con «Body»: solo dopo il merge di #759, e
  chiedendolo al Coordinatore.
- **L'OTA**, che parte col sì dell'utente.
- Android non provato: la prova è il test.

## Esito

«bpm» sta dentro il riquadro di ogni casella di «Heart rate zones», come
le unità di «Body», e un tocco su «bpm» apre la tastiera; la cima della zona
5 resta senza riquadro, allineata. #761 in main il 2026-11-05 (`cebe5412`),
dopo due merge di `main` senza conflitti veri. Solo JS: l'anteprima, la prova
sul telefono e l'OTA di produzione sono del Coordinatore, l'OTA col sì
dell'utente.
