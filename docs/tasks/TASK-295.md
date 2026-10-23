# TASK-295 — Il video della corsa, da esportare per i social

**Stato**: In corso — PR aperta, aspetta la coda dei merge del Coordinatore
**Fase**: 4 · **Branch**: `feat/TASK-295-run-video`
**ADR**: ADR-0254 · **Migrazione**: nessuna · **Solo app** (nessun server,
nessuna build nativa, nessuna dipendenza nuova)

## Obiettivo

Dalla schermata «Share your run» si esporta in automatico un video breve
della corsa, pronto per Reel, Storie e TikTok, con il foglio di
condivisione di iOS.

## La richiesta dell'utente (2026-10-23)

«Inserire la possibilità di creare il video in automatico finale di tutta
la tua esperienza / corsa da poter postare sui social, tipo un pulsante
con esporta.»

## La scelta dell'utente (2026-10-23)

Proposta mostrata e accettata così («Sì, così»), fra «con la mappa sotto»
e «più lungo»:

1. **Dove**: nella schermata «Share your run» (da «Share» a fine corsa e
   da «My activities»), un pulsante **«Export video»** accanto a
   «Instagram».
2. **Cosa**: un video verticale 9:16 di **circa 12 secondi** sul giallo
   di MuW, come il post (TASK-231): il logo e il titolo, poi la linea
   della corsa che **si disegna da sola** con distanza e tempo che
   salgono, alla fine il disegno intero con i risultati e le emoji scelti
   per il post. **Senza musica** (la aggiungono Instagram e TikTok).
   Nascosti i primi e gli ultimi 200 m, come nel post.
3. **Come**: il telefono lo fa in pochi secondi, poi si apre il foglio di
   condivisione (Instagram, WhatsApp, «Save Video»).

Numeri dal Coordinatore il 2026-10-23: TASK-295, ADR-0254.

## Contesto da leggere

- `docs/DECISIONS.md` ADR-0194 (il post), ADR-0222 (il post che resta),
  ADR-0254 (questo)
- `docs/UI.md` «Il post da condividere», «Cosa esce dal telefono»

## Cosa fare

1. `src/share/videoScene.ts`: da `PostRun`, risultati accesi ed emoji,
   che cosa disegna ognuno dei 360 fotogrammi (1080 × 1920, 30 al
   secondo, 12 s), con le misure del post.
2. `src/share/videoPage.ts`: la pagina del WebView nascosto che disegna
   i fotogrammi su un canvas e li codifica in H.264 con WebCodecs.
3. `src/share/mp4.ts`: il file MP4 (una traccia video) dai pezzi
   codificati.
4. `src/share/RunVideo.tsx` e `src/share/videoFile.ts`: il WebView
   nascosto, i messaggi della pagina, il file nella cache e il foglio di
   condivisione; i problemi detti a chi corre.
5. `SharePost.tsx`: «Export video» accanto a «Instagram», con «Making the
   video… 42%» mentre lo fa.
6. I testi nuovi nelle cinque lingue.

## Criteri di accettazione

- [x] «Export video» sta accanto a «Instagram» in «Share your run»; mentre
  il video si fa i due pulsanti non si toccano e il pulsante dice la
  percentuale.
- [x] Il video è un MP4 H.264 1080 × 1920, 30 fotogrammi al secondo,
  12 s, senza audio; AVFoundation lo legge tutto (360 fotogrammi).
- [x] Il primo fotogramma è vuoto, la linea cresce fotogramma per
  fotogramma, l'ultimo mostra il post intero: titolo, disegno senza i
  primi e gli ultimi 200 m, risultati accesi, emoji al loro posto
  (`videoScene.test.ts`).
- [x] Distanza e tempo salgono con la linea; il passo è quello della
  corsa intera.
- [x] Un telefono che non sa fare il video dice «This phone cannot make
  the video.»; un video non riuscito, o una pagina muta per 20 s, «The
  video could not be made. Try again.»; senza foglio di condivisione,
  «This phone cannot open the share sheet.».
- [x] Condiviso, il post resta con la corsa salvata come per l'immagine
  (TASK-258).
- [x] Nessuna dipendenza nuova, niente di nativo: il fingerprint iOS non
  cambia.
- [x] Provato nel simulatore iPhone Air (iOS 27) in Expo Go: video fatto
  in circa 10 s, 1,9 MB, foglio di condivisione con «Save Video».

## File toccati

```
apps/mobile/src/share/SharePost.tsx
apps/mobile/src/share/RunVideo.tsx                (nuovo)
apps/mobile/src/share/SharePostVideo.test.tsx     (nuovo)
apps/mobile/src/share/mp4.ts                      (nuovo)
apps/mobile/src/share/mp4.test.ts                 (nuovo)
apps/mobile/src/share/videoFile.ts                (nuovo)
apps/mobile/src/share/videoFile.test.ts           (nuovo)
apps/mobile/src/share/videoPage.ts                (nuovo)
apps/mobile/src/share/videoPage.test.ts           (nuovo)
apps/mobile/src/share/videoScene.ts               (nuovo)
apps/mobile/src/share/videoScene.test.ts          (nuovo)
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/es.ts
apps/mobile/src/i18n/fr.ts
apps/mobile/src/i18n/it.ts
docs/tasks/TASK-295.md                            (nuovo)
docs/DECISIONS.md
docs/UI.md
docs/STATUS.md
```

## Fuori scope

- La mappa sotto la linea, un video più lungo, la musica: scartati
  dall'utente con la proposta.
- Le foto della corsa, il profilo d'altitudine, la velocità vera lungo la
  traccia (la linea avanza uniforme, non con i tempi del GPS).
- Android: il WebView di Android ha WebCodecs, ma l'app non è ancora
  provata su Android (TASK-294).
- Un video sul server o un modulo nativo (ADR-0254, «Alternative
  scartate»).

## Esito

*(in corso)* Fatto e provato nel simulatore; manca la prova sull'iPhone,
che è dell'utente, dopo il merge e la pubblicazione su `preview`.
