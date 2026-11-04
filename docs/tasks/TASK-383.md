# TASK-383 — «Body»: l'unità di peso e altezza dentro il riquadro

**Stato**: In revisione · 2026-11-04
**Fase**: 4 · **Branch**: `fix/TASK-383-body-units`
**Numeri**: TASK-383, assegnato dal Coordinatore. Seguito di TASK-374 A
(ADR-0318), unità di TASK-182.

## Obiettivo

L'utente, provando l'anteprima il 2026-11-04: «aggiungi i cm nel altezza ed
i kg». Nella pagina «Body» (Impostazioni, TASK-374 A) l'unità c'era già, ma
piccola e grigia **fuori** dal riquadro, a destra: sul telefono non si
notava.

## Cosa c'è oggi

Visto sul simulatore (Expo Go, iPhone 17e) con `main` `c79a97b1`:
«Weight» e «Height» mostrano «kg» e «cm» a destra del riquadro, in
`fontSize.body` e `color.textMuted`; con le miglia «lb», «ft» e «in», con la
conversione di `body/bodyUnits.ts`. I valori si tengono già in kg e cm.

## Scelta dell'utente

1. **Dove sta l'unità.** Proposta, con le foto del simulatore (oggi e
   proposta, in metrico e in imperiale): dentro il riquadro, accanto al
   numero; con le miglia «lb», «ft» + «in» come oggi, convertiti; si salva
   sempre in kg e cm. Alternative: nel nome del campo («Weight (kg)»),
   oppure lasciare com'è.
   — *Risposta (2026-11-04):* «Dentro il riquadro».

## Cosa cambia

`NumberInput` in `settings/BodyPage.tsx`: il riquadro (bordo, sfondo) passa
dal `TextInput` a un `Pressable` che tiene il numero e, dopo, l'unità, nella
stessa dimensione del numero (`fontSize.input`) e in `color.textMuted`. Un
tocco ovunque nel riquadro, anche sull'unità, apre la tastiera del campo.
«Year of birth» resta senza unità. Colori e misure da `theme/tokens.ts`.
Nessun testo nuovo («kg», «cm», «lb», «ft», «in» non si traducono, ADR-0149
punto 8), nessuna dipendenza, solo JS: impronta iOS invariata (`6f8bba4c`).

## Criteri di accettazione

- [x] Con i chilometri «kg» e «cm» stanno nel riquadro di peso e altezza,
      anche vuoti; nessuna unità imperiale (`BodyPage.test.tsx`).
- [x] Con le miglia «lb», «ft» e «in» nei loro riquadri, con 72,5 kg →
      159.8 lb e 178 cm → 5 ft 10 in.
- [x] Scritti in lb e ft-in, si tengono in kg e cm (176 lb → 79,832 kg,
      6 ft 1 in → 185,42 cm) e tornando ai km si rileggono 79.8 kg e 185 cm.
- [x] Un tocco sull'unità apre la tastiera del suo campo (il test fallisce
      se si toglie).
- [x] Test di `BodyPage` e `BodySetting`, typecheck, lint e Prettier verdi
      in locale.
- [ ] CI verde.

## File toccati

```
apps/mobile/src/settings/BodyPage.tsx
apps/mobile/src/settings/BodyPage.test.tsx   (nuovo)
docs/tasks/TASK-383.md                       (nuovo)
docs/STATUS.md
docs/DECISIONS.md
docs/UI.md
```

## Fuori scope

- La pagina «Heart rate zones» (bpm a destra del riquadro): non chiesta.
- **L'OTA**, che parte col sì dell'utente.
- Android non provato: la prova è il test e il simulatore iOS.

## Esito

(da scrivere a merge fatto)
