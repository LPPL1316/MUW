# TASK-301 — La musica nel video della corsa

**Stato**: In lavorazione — PR #568 aperta, aspetta il merge e la prova
sull'iPhone
**Fase**: 4 · **Branch**: `feat/TASK-301-video-music`
**ADR**: ADR-0262 (sostituisce il punto 1 «Niente musica» di ADR-0254,
che resta com'è) · **Migrazione**: nessuna · **Solo app** (nessun server,
nessuna build nativa, nessuna dipendenza nuova)

## Obiettivo

Il video di «Export video» in «Share your run» (TASK-295, ADR-0254) ha la
musica che sceglie chi corre: dieci brani nostri, originali, fatti da uno
script nel repository.

## La richiesta dell'utente (2026-10-25)

«aggiungi la musica al video». Cambia la sua scelta del 2026-10-23 («niente
musica, la aggiungono Instagram e TikTok»).

## Le scelte dell'utente (2026-10-25)

Una domanda per volta, ognuna con una proposta pronta:

1. **Fonte**: «Originale, fatta da noi» (fra pubblico dominio CC0 e un file
   scelto da chi corre). Brani scritti da uno script, sui tempi del video,
   nessuna licenza, nessun Content ID che tolga l'audio su Instagram.
2. **Quanti e chi sceglie**: «Tre, sceglie chi corre». Una riga «Music» in
   «Share your run», sopra i pulsanti; toccando un brano lo si sente, e
   quello va nel video. L'ascolto usa expo-audio, che è già nell'app.
3. **All'inizio**: «Spenta» (fra «Accesa, primo brano» e «L'ultimo
   scelto»). Parte su «None» ogni volta, la scelta non si salva col post.
4. **Testi**: «Sì, questi»:

   | en | it | es | fr | de |
   |---|---|---|---|---|
   | Music | Musica | Música | Musique | Musik |
   | None | Nessuna | Ninguna | Aucune | Keine |
   | Energy | Energia | Energía | Énergie | Energie |
   | Chill | Relax | Relax | Détente | Entspannt |
   | Epic | Epica | Épica | Épique | Episch |
   | Tap a track to hear it. | Tocca un brano per sentirlo. | Toca una pista para escucharla. | Touche un morceau pour l'écouter. | Tipp auf einen Titel, um ihn zu hören. |

5. **Strumento**: «Sì, afconvert» (fra afconvert di macOS e ffmpeg da
   installare). Solo uno strumento di sviluppo sul Mac: nell'app vanno solo
   i file già codificati.
6. **I brani**: i primi tre mandati all'utente il 2026-10-25 da
   ascoltare; risposta «Da ritoccare», poi «Più carica» (fra «Meno
   elettronico», «Più carica», «Più morbidi», «Una melodia che resta»).
7. **Dieci invece di tre**: «aggiungi altre 7 canzoni dai». Proposta
   accettata («Sì, questi sette»): Sprint (drum & bass, 180 bpm), Rock
   (chitarre distorte, 150), Funk (basso slap e fiati, 120), Sunny (pop,
   120), Trap (808, 150), Retro (synthwave, 120), Fiesta (reggaeton, 90).
   Nella riga «Music»: None · Energy · Chill · Epic · Sprint · Rock · Funk
   · Sunny · Trap · Retro · Fiesta. Nomi nuovi:

   | en | it | es | fr | de |
   |---|---|---|---|---|
   | Sprint | Sprint | Sprint | Sprint | Sprint |
   | Rock | Rock | Rock | Rock | Rock |
   | Funk | Funk | Funk | Funk | Funk |
   | Sunny | Solare | Alegre | Ensoleillé | Sonnig |
   | Trap | Trap | Trap | Trap | Trap |
   | Retro | Retrò | Retro | Rétro | Retro |
   | Fiesta | Festa | Fiesta | Fiesta | Fiesta |

8. **I dieci brani più carichi**, mandati all'utente il 2026-10-25:
   «Sì, vanno bene».

Numeri dal Coordinatore il 2026-10-25: TASK-301, ADR-0262. Le sue
condizioni: musica davvero originale, che lo script rifà uguale (byte per
byte o con un controllo nel test) e con il modo di rigenerarla scritto
nell'ADR; afconvert solo come strumento di sviluppo; brani piccoli (sotto
300 KB l'uno), con il peso totale nella PR; test deterministici della
traccia audio nel MP4 (box, durata uguale ai 12 s del video, sincronia) e
il video senza musica identico a oggi; impronta iOS
`83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3` prima e dopo su una copia
pulita con `npm ci`; niente permessi o dipendenze nuove; i sì dell'utente
nel task file con le sue parole. Dieci brani approvati dal Coordinatore il
2026-10-25: 1,9 MB vanno bene, a 128 kbit/s, con il peso totale nella PR. `docs/UI.md` è anche della #461: solo una
sezione nuova o righe nuove in quella di «Share your run». i18n: solo righe
in fondo, riallineando con #461 e #545.

## Contesto da leggere

- `docs/DECISIONS.md` ADR-0254 (il video), ADR-0225 (il suono fuori dalla
  corsa segue l'interruttore del silenzio), ADR-0262 (questo, da scrivere)
- `docs/tasks/TASK-295.md`
- `tools/stretch_chime.py` (lo stesso modo di fare un suono nostro)

## Cosa fare

1. `tools/video_music.py`: i tre brani (fatto, vedi «Dove si è»).
2. `src/share/m4a.ts`: legge uno dei tre `.m4a` (configurazione `esds`,
   pacchetti AAC, priming dell'`elst`).
3. `src/share/mp4.ts`: una seconda traccia, audio AAC, accanto al video:
   `trak` con `tkhd` (track 2, volume 1), `edts/elst` (salta il priming,
   dura quanto il video), `mdhd` a 44 100, `hdlr soun`, `smhd`, `stsd mp4a`
   con l'`esds` del file, `stts`, `stsc`, `stsz`, `stco`; `mvhd`
   `next_track_ID` 3. Senza musica il file resta identico byte per byte.
4. `src/share/videoMusic.ts`: i tre brani (`require` degli asset), i byte di
   uno (expo-asset ed expo-file-system, già nell'app), l'ascolto con
   expo-audio caricato al primo tocco come `stretch/chime.ts`.
5. `src/share/MusicRow.tsx` e `SharePost.tsx`: la riga «Music» sopra i
   pulsanti, «None» acceso all'inizio; l'ascolto si ferma toccando «None»,
   uscendo e facendo il video. `RunVideo.tsx` mette la traccia nel file.
6. I testi nelle cinque lingue, solo in fondo alle tabelle.
7. Provato nel simulatore (un simulatore proprio, in Expo Go) e il file
   controllato con AVFoundation: una traccia video e una audio, 12 s.

## Criteri di accettazione

- [x] In «Share your run» c'è la riga «Music» con «None» e i dieci brani,
  e «Tap a track to hear it.»; all'apertura è acceso «None»; toccando un
  brano lo si sente.
- [x] Con un brano scelto il video ha due tracce, H.264 e AAC, lunghe tutte
  e due 12 s (AVFoundation); con «None» il file è identico a quello di
  oggi, byte per byte.
- [x] La traccia audio sui byte (`mp4.test.ts`): box, durate, `elst` col
  priming, sincronia con il video.
- [x] I brani sono nostri e si rifanno uguali: `pytest tools` rifà i
  campioni e li confronta con le impronte di `music.json`; jest controlla
  che i tre `.m4a` dell'app siano quelli dello script.
- [x] Ogni brano sotto 300 KB; il peso totale scritto nella PR.
- [x] Nessuna dipendenza né permesso nuovi; impronta iOS
  (`APP_VARIANT=production`) `83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3`
  prima e dopo, su una copia pulita con `npm ci`.
- [ ] Instagram accetta il video (prova dell'utente sull'iPhone).

## File toccati

Approvati dal Coordinatore il 2026-10-25 (i sette brani nuovi lo stesso
giorno).

```
apps/mobile/assets/music/energy.m4a        (nuovo)
apps/mobile/assets/music/chill.m4a         (nuovo)
apps/mobile/assets/music/epic.m4a          (nuovo)
apps/mobile/assets/music/sprint.m4a        (nuovo)
apps/mobile/assets/music/rock.m4a          (nuovo)
apps/mobile/assets/music/funk.m4a          (nuovo)
apps/mobile/assets/music/sunny.m4a         (nuovo)
apps/mobile/assets/music/trap.m4a          (nuovo)
apps/mobile/assets/music/retro.m4a         (nuovo)
apps/mobile/assets/music/fiesta.m4a        (nuovo)
apps/mobile/assets/music/music.json        (nuovo)
tools/video_music.py                       (nuovo)
tools/test_video_music.py                  (nuovo)
apps/mobile/src/share/m4a.ts               (nuovo)
apps/mobile/src/share/m4a.test.ts          (nuovo)
apps/mobile/src/share/videoMusic.ts        (nuovo)
apps/mobile/src/share/videoMusic.test.ts   (nuovo)
apps/mobile/src/share/MusicRow.tsx         (nuovo)
apps/mobile/src/share/mp4.ts
apps/mobile/src/share/mp4.test.ts
apps/mobile/src/share/RunVideo.tsx
apps/mobile/src/share/SharePost.tsx
apps/mobile/src/share/SharePost.test.tsx
apps/mobile/src/share/SharePostVideo.test.tsx
apps/mobile/src/i18n/de.ts
apps/mobile/src/i18n/es.ts
apps/mobile/src/i18n/fr.ts
apps/mobile/src/i18n/it.ts
docs/tasks/TASK-301.md                     (nuovo)
docs/DECISIONS.md
docs/UI.md
docs/STATUS.md
```

## Fuori scope

- Un file audio scelto da chi corre (un modulo nativo nuovo, WebCodecs
  audio solo da iOS 26), brani di altri.
- Ricordare il brano scelto, o salvarlo col post sul server.
- Cambiare il modo del suono dell'app: l'ascolto segue l'interruttore del
  silenzio come ogni suono fuori dalla corsa (ADR-0225).

## Dove si è (2026-10-25)

Fatto, nel branch: i dieci brani e lo script (`tools/video_music.py`, con
`tools/test_video_music.py`), `m4a.ts`, la seconda traccia in `mp4.ts`,
`videoMusic.ts`, `MusicRow.tsx`, «Music» in `SharePost.tsx`, la musica in
`RunVideo.tsx`, i testi, ADR-0262, `UI.md`, `STATUS.md`. Tutti i test di
`src/share` e `pytest tools/test_video_music.py` verdi.

Dettagli tecnici emersi:

- afconvert (`-f m4af -d aac -b 128000 -q 127`) mette priming e lunghezza
  in `iTunSMPB` (2112 di priming, 529 200 campioni validi, 519 pacchetti),
  non in un `elst`, e divide i pacchetti in 24 chunk. Lo script riscrive il
  file: un chunk, `elst` con `media_time` 2112 e durata 529 200, `mdhd`
  531 456 (519 × 1024).
- **AVFoundation toglie il priming due volte** se la traccia ha l'`elst`
  ma non il gruppo «roll» (`sgpd`/`sbgp`, roll -1): un clic a 1,000 s
  usciva a 0,952 s (2112 campioni prima) e la traccia durava 527 232
  campioni. AVAssetWriter scrive `stsd, sgpd, sbgp, stts, stsc, stsz,
  stco`: con gli stessi box, nel file dei brani e nel video, il clic esce
  a 44 100 campioni esatti e la musica dura 529 200 (prova con
  AVAssetReader su un MP4 fatto da `mp4.ts`).
- `afinfo` legge il file riscritto come 529 344 campioni validi (non guarda
  la durata dell'`elst`); AVFoundation legge 12,0 s.
- La codifica AAC alza i picchi fino a 1,3 dB: con il campione più forte a
  0,89 da 1 a 7 campioni per brano passavano il fondo scala dopo la
  decodifica. Ora 0,75 (circa 1,5 dB più piano): il più alto è 0,97.
- Le prove dei brani: tutti fra -4 e -13 dB nella parte centrale, il colpo
  a 9 s il momento più forte, fino al silenzio a 12 s. Rifarli costa 17 s
  di CPU (le note uguali si fanno una volta sola, `functools.cache`).

Fatto anche (2026-10-26): allineato a `origin/main` (`5abf78d5`, le righe
dei testi di `main` prima, le nostre in fondo); impronta iOS
(`APP_VARIANT=production`, copia pulita con `npm ci`) `83793e26fc0d…` su
`main` `5abf78d5` e sul branch `f53a5f78`; nel simulatore (iPhone Air
«MuW TASK-301», iOS 27, Expo Go) la riga «Music», «Energy» scelto,
«Export video»: MP4 di 1,9 MB, AVFoundation legge 12,0 s, 360 fotogrammi
e 529 200 campioni audio, le due tracce dal tempo 0. Peso dei dieci brani:
1 879 013 byte, il più grande 189 641. **PR #568**, «#568 pronta» al
Coordinatore.

Prossimi passi: il merge del Coordinatore e `preview`; la prova
dell'utente sull'iPhone (la riga, l'ascolto, un video con la musica
accettato da Instagram); poi la PR di chiusura di questo file.
