# DEPLOY — Chiedere percorsi da fuori casa

Oggi l'API gira sul PC di casa e l'iPhone la trova solo sulla stessa Wi-Fi
(`SETUP.md`, passo 10.1). Qui ci sono le strade per usarla da ovunque:
A–E gratis o quasi (ADR-0076), F a pagamento, con il computer spento
(ADR-0111).

| Strada | PC acceso? | Costo | Quando |
|---|---|---|---|
| **A — PC + Tailscale** | sì | gratis | **da provare subito** |
| **B — PC + Cloudflare Tunnel** | sì | gratis | subito, se serve un indirizzo pubblico |
| C — Server con Docker (Hetzner, Oracle) | no | **carta** | sostituita da F |
| D — Raspberry Pi 5 a casa | no (il Pi sì) | il Pi, una volta | più avanti, senza carta |
| E — VPS pagato con PayPal | no | pochi €/mese | più avanti, senza carta |
| **F — Server a pagamento, configurazione pronta** | **no** | **9–13 €/mese** | **per non tenere acceso il computer, e poi per pubblicare** |

I comandi di A–E sono per **PowerShell** sul PC, dalla radice del
repository (`cd ~\PycharmProjects\shaperoute`). Si scrive `npm.cmd`, non
`npm` (`SETUP.md`, passo 0). Quelli di F sono per il **Terminale del Mac**
e per il server (Linux).

---

## A — PC + Tailscale (la strada di adesso)

Tailscale crea una rete privata fra i tuoi dispositivi (la «tailnet»): il
PC riceve un indirizzo `100.x.y.z` che l'iPhone raggiunge da ovunque, anche
in 5G, e nessun altro. Non serve la chiave dell'API. Il piano Personal è
gratis e non chiede la carta (verificato il 2026-09-26 su
https://tailscale.com/pricing).

### A.1 Installare (una volta)

1. **PC**: scarica Tailscale per Windows da https://tailscale.com/download
   e installalo. Controlla prima lo spazio su C:: il disco è quasi pieno.
   Alla fine si apre il browser: accedi con un account Google, Microsoft,
   GitHub o Apple. Tailscale resta nell'area di notifica, vicino
   all'orologio.
2. **iPhone**: installa **Tailscale** dall'App Store, aprilo e accedi con
   **lo stesso account**. iOS chiede di aggiungere una configurazione VPN:
   consenti. L'interruttore in alto deve restare acceso.
3. **Indirizzo del PC**: da PowerShell

   ```powershell
   & "C:\Program Files\Tailscale\tailscale.exe" ip -4
   ```

   risponde con una riga come `100.101.102.103`. È l'indirizzo del PC
   nella tailnet e non cambia: scrivilo da qualche parte. Lo vedi anche
   nell'app Tailscale sull'iPhone, alla voce del PC.

### A.2 Avviare API e app (ogni volta)

Due finestre di PowerShell, tutte e due dalla radice del repository.
Nella prima, l'API come sempre:

```powershell
services\api\.venv\Scripts\python.exe -m shaperoute_api --lan
```

Con `--lan` l'API risponde su tutte le reti del PC, anche su quella di
Tailscale. Nella seconda, l'app con l'indirizzo di Tailscale al posto di
quello della Wi-Fi (metti il tuo al posto di `100.101.102.103`):

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "100.101.102.103"
npm.cmd run mobile
```

Expo mette quell'indirizzo nel QR code, e l'app cerca l'API sullo stesso
indirizzo, alla porta 8000: non serve nient'altro. Il valore vale solo per
quella finestra di PowerShell.

### A.3 La prova fuori casa

1. Sull'iPhone **spegni la Wi-Fi** (5G), e controlla che Tailscale sia
   acceso.
2. In Safari apri `http://100.101.102.103:8000/health` (con il tuo
   indirizzo): deve rispondere `{"status":"ok"}`.
3. Inquadra il QR code con la fotocamera, apri l'app in Expo Go e chiedi
   un percorso in una zona già in cache (Trento, Levico, Milano).

### A.4 Se non risponde

- **Safari non apre `/health`**: Windows può trattare la rete di Tailscale
  come «pubblica», e il permesso dato a Python vale solo per le reti
  private. Controlla con

  ```powershell
  Get-NetConnectionProfile
  ```

  Se alla riga `InterfaceAlias : Tailscale` corrisponde
  `NetworkCategory : Public`, rendila privata da una PowerShell **aperta
  come amministratore** (tasto destro su PowerShell, «Esegui come
  amministratore»):

  ```powershell
  Set-NetConnectionProfile -InterfaceAlias Tailscale -NetworkCategory Private
  ```

  È una modifica al firewall di Windows: la fai tu, non l'agente.
- **Il QR apre l'app ma «Cannot reach the API at http://192.168…»**:
  `REACT_NATIVE_PACKAGER_HOSTNAME` non era impostato nella finestra in cui
  hai lanciato `npm.cmd run mobile`. Chiudi Expo (`Ctrl+C`), rifai A.2.
- **Expo Go non carica l'app**: anche la porta 8081 di Expo passa da
  Tailscale; vale lo stesso controllo del firewall.

### A.5 In alternativa: indirizzo e chiave scritti nell'app

Invece di `REACT_NATIVE_PACKAGER_HOSTNAME`, l'app legge due valori da
`apps\mobile\.env` (un file che **non** entra nel repository; il modello è
`.env.example` alla radice):

```
EXPO_PUBLIC_API_URL=http://100.101.102.103:8000
EXPO_PUBLIC_API_KEY=
```

Se `EXPO_PUBLIC_API_URL` c'è, l'app usa quello al posto dell'indirizzo di
Expo; se `EXPO_PUBLIC_API_KEY` c'è, lo manda in ogni richiesta. Expo li
legge all'avvio di `npm.cmd run mobile`: dopo una modifica va riavviato.
Servono per le strade B–E, dove l'API non è sullo stesso PC di Expo.

### A.6 L'app senza Expo acceso (EAS Update, TASK-083)

Invece di tenere acceso `npm.cmd run mobile`, l'app si pubblica su Expo
una volta e Expo Go la apre da lì (ADR-0078). **L'API serve sempre**: il
PC acceso con Tailscale (A) o un server (B–E). Non serve più Expo (porta
8081) né il QR del terminale.

Il progetto su Expo è `@lppl1316s-team/shaperoute`
(<https://expo.dev/accounts/lppl1316s-team/projects/shaperoute>): dal
2026-10-02 è dell'organizzazione `lppl1316s-team`, non più dell'account
`lppl1316`, così altri possono entrarci come membri (TASK-146). Il
proprietario scritto in `apps/mobile/app.json` (`owner`) deve essere lo
stesso, o `eas update` si ferma con «Owner of project ... does not
match». Su iPhone Expo Go apre solo i progetti a cui l'account con cui si
è entrati in Expo Go ha accesso: entra con un account membro
dell'organizzazione, o fatti aggiungere.

1. Una volta: `npx eas-cli login` (su Windows `npx.cmd`), con l'account
   Expo. Lo fa l'utente, con le sue credenziali.
2. L'indirizzo dell'API sta **su EAS**, come variabile dell'ambiente
   `preview` del progetto (oggi `http://100.84.99.112:8000`, il Mac su
   Tailscale). **Obbligatorio**: un'app pubblicata non ricava l'API
   dall'host di Expo e, senza, dice che non trova l'API. Per vederlo o
   cambiarlo, da `apps/mobile`:

   ```
   npx eas-cli env:list --environment preview
   ```

   ```
   npx eas-cli env:set preview --name EXPO_PUBLIC_API_URL --value http://NUOVO-INDIRIZZO:8000 --visibility plaintext
   ```

   Poi si ripubblica (punto 3). La variabile di EAS vince su
   `apps/mobile/.env`, che serve solo a `npm.cmd run mobile` (A.5).
3. Pubblicare, da `apps/mobile`:

   ```
   npx eas-cli update --branch preview --environment preview --message "cosa è cambiato"
   ```

   Circa un minuto. `--environment preview` porta dentro le variabili
   del punto 2. Alla fine stampa il link della pagina dell'update su
   expo.dev.
4. Sull'iPhone: apri quel link e inquadra il QR della pagina, oppure apri
   Expo Go → il progetto `shaperoute` nella scheda dell'account → branch
   `preview`.

**Dopo ogni modifica dell'app**, o dell'indirizzo dell'API, si rifà il
punto 3: l'app pubblicata non cambia da sola. Expo Go scarica l'update
nuovo alla prossima apertura (se non lo fa, chiudila del tutto e
riaprila).

**Limiti**:

- `EXPO_PUBLIC_API_URL` ed `EXPO_PUBLIC_API_KEY` finiscono **dentro**
  l'app pubblicata, leggibili da chi scarica l'update. Con Tailscale (tailnet
  privata) non è un problema; con un indirizzo pubblico (B–E) la chiave
  dell'API va considerata debole: cambiala se il link dell'update gira.
- Vale per la versione di Expo Go dell'SDK 57 (`runtimeVersion`
  `exposdk:57.0.0` in `app.json`): quando si aggiorna l'SDK si aggiorna
  anche quella riga.
- Solo iPhone provato: Expo Go su Android ha un problema noto con gli
  update dell'SDK 57 (expo/expo#50139).
- Una build propria (TestFlight) resta fuori: serve l'account Apple
  Developer.

### A.7 La build dello store e il canale `production` (TASK-152)

Due canali, ognuno con il suo runtime (ADR-0233):

| Canale | Chi lo apre | Runtime |
|---|---|---|
| `preview` | Expo Go, le build `preview` | `exposdk:57.0.0`, da `app.json` |
| `production` | le build dell'App Store | un'impronta del codice nativo (`fingerprint`) |

Il runtime dello store lo mette `apps/mobile/app.config.ts`, solo quando
c'è `APP_VARIANT=production`: il profilo `production` di `eas.json` la
imposta da solo, `eas update` no. Un update arriva solo ai telefoni con
lo stesso runtime: uno fatto dopo un cambio nativo non può far chiudere
le build vecchie, semplicemente non le raggiunge.

1. **Prima della prima build**: l'ambiente EAS `production` è vuoto. Da
   `apps/mobile`, come in A.6 punto 2 ma con `production`:

   ```
   npx eas-cli env:set production --name EXPO_PUBLIC_API_URL --value https://INDIRIZZO-DELL-API --visibility plaintext
   ```

   La chiave, `EXPO_PUBLIC_API_KEY`, dalla pagina del progetto su
   expo.dev, ambiente `production`, visibilità *Sensitive*.
2. **La build** (serve l'account Apple Developer, lo fa l'utente con le
   sue credenziali):

   ```
   npx eas-cli build --platform ios --profile production --auto-submit
   ```

   Il numero di build sale da solo (`autoIncrement`, le versioni stanno
   su EAS). Con `--auto-submit`, a build finita EAS la carica su App
   Store Connect, nell'app «MuW» (`submit.production.ios.ascAppId` in
   `eas.json`, con la chiave API di App Store Connect salvata su EAS), e
   dopo l'elaborazione di Apple compare in TestFlight. Senza quel profilo
   la build si fa ma l'invio fallisce («Missing submit profile»); una
   build già fatta si invia con
   `npx eas-cli submit --platform ios --id ID-DELLA-BUILD`. `eas.json`
   non entra nell'impronta, quindi il profilo `submit` non cambia il
   runtime.
3. **Un update per lo store**: prima su `preview` e provato sull'iPhone
   (A.6), poi la **stessa commit**, da un worktree pulito di `main`:

   ```
   APP_VARIANT=production npx eas-cli update --channel production --environment production --message "cosa è cambiato"
   ```

   Nell'output, «Runtime version» deve essere un hash di 40 caratteri.
   Se dice `exposdk:57.0.0` manca la variabile: l'update è andato sul
   canale ma nessuna build dello store lo prende; si ripubblica con la
   variabile.
4. **L'update raggiunge la build?** Il runtime che avrebbe un update di
   adesso:

   ```
   APP_VARIANT=production npx expo-updates runtimeversion:resolve --platform ios --workflow managed
   ```

   va confrontato con quello della build sulla sua pagina su expo.dev.
   Si lancia nel worktree del punto 3, dopo un `npm install` vero:
   nell'impronta conta anche il percorso dei pacchetti, e con
   `node_modules` collegati da un'altra cartella esce un altro hash.
   Uguali: l'update arriva. Diversi: dalla build è cambiato qualcosa di
   nativo (una libreria, un plugin, un permesso, l'icona, lo splash,
   l'SDK) e serve una build nuova, con la revisione di Apple. **Alla
   prima build va fatto comunque**: l'impronta calcolata sul Mac e
   quella di EAS non sono ancora state confrontate.

5. **Testi e screenshot della scheda** (TASK-152): stanno in
   `apps/mobile/store.config.json` e `apps/mobile/store/screenshots/`.
   Da `apps/mobile`, con le credenziali Apple dell'utente:

   ```
   npx eas-cli metadata:push
   ```

   Carica titolo, sottotitolo, descrizione, parole chiave, link,
   categorie e screenshot nella versione in preparazione su App Store
   Connect. `npx eas-cli metadata:lint` controlla il file senza
   caricarlo. Privacy, età, prezzo e account di prova si compilano a mano
   su App Store Connect.

L'impronta non guarda la versione, il numero di build né `eas.json`
(`apps/mobile/fingerprint.config.js`): alzarli non separa gli update.
Una modifica solo JavaScript non la cambia mai.

---

## La chiave dell'API

Serve quando l'API ha un indirizzo che chiunque può raggiungere (strade
B–E). Con una chiave, ogni richiesta tranne `/health` deve portarla
nell'intestazione `X-API-Key`, altrimenti l'API risponde 401
`unauthorized` e l'app dice «The API refused this app's key».

1. Crea una chiave lunga e casuale (almeno 16 caratteri; con meno l'API
   non parte):

   ```powershell
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
   ```

2. Sul PC o sul server, prima di avviare l'API:

   ```powershell
   $env:SHAPEROUTE_API_KEY = "la-chiave-appena-creata"
   services\api\.venv\Scripts\python.exe -m shaperoute_api --lan
   ```

   L'API stampa «API key required in the X-API-Key header».
3. Nell'app, la stessa chiave in `apps\mobile\.env` come
   `EXPO_PUBLIC_API_KEY=...` (A.5).

La chiave non va **mai** in un file del repository, in un commit o in una
chat. Se finisce da qualche parte, creane una nuova.

C'è anche un **limite**: al massimo 30 richieste POST al minuto per ogni
client (percorsi, contorni, parole, GPX), poi 429 `too_many_requests`.
Si cambia con `SHAPEROUTE_RATE_LIMIT` (0 = nessun limite). Dietro un
tunnel tutti i telefoni contano come un client solo.

## La ricerca dei luoghi (Geoapify, TASK-123)

I suggerimenti della partenza vengono dall'API, che li chiede a Geoapify
(ADR-0095). Senza chiave l'app usa Photon, più lento (2–4 s).

1. Crea un account gratuito su <https://www.geoapify.com> (lo fa l'utente)
   e un progetto: la chiave è nella pagina del progetto. Il piano gratuito
   arriva a 3000 richieste al giorno.
2. Sul PC o sul server, prima di avviare l'API, come la chiave dell'API:

   ```powershell
   $env:GEOAPIFY_API_KEY = "la-chiave-di-geoapify"
   ```

   Sul Mac la chiave sta in `.env` alla radice (fuori dal repository),
   letta all'avvio:

   ```bash
   set -a; . ./.env; set +a; services/api/.venv/bin/python -m shaperoute_api --lan
   ```

   L'API stampa «Places suggested by Geoapify».
3. L'app non cambia: niente da mettere in `apps/mobile/.env` né su EAS.

Come ogni chiave, mai in un file del repository o in una chat.

## Strava (TASK-187)

«Send to Strava» manda una corsa salvata sul profilo Strava di chi ha
collegato il suo atleta (`API.md`, «Send to Strava»; ADR-0156). Serve
un'**applicazione Strava dell'utente**: senza, Strava è spento e l'app non
mostra niente. Finché Strava non l'ha approvata può collegarsi **un solo
atleta**, chi l'ha creata; per gli altri l'utente chiede la revisione a
Strava, dalla stessa pagina.

1. Su <https://www.strava.com/settings/api> (lo fa l'utente) crea
   l'applicazione: nome «Sgrava», un sito qualunque suo, un'icona, e in
   **Authorization Callback Domain** il dominio dell'API, senza `https://`
   e senza percorso: `188-245-9-220.sslip.io`. La pagina mostra il
   **Client ID** (un numero, non è un segreto) e il **Client Secret**.
2. Sul server, in `deploy/.env`. Il Client ID si può scrivere com'è; il
   secret lo scrive l'utente, con un comando che non lo mostra e non lo
   lascia nella cronologia della shell:

   ```bash
   cd /root/shaperoute/deploy
   echo "STRAVA_CLIENT_ID=il-numero-di-strava" >> .env
   read -rs -p "Strava Client Secret: " S && printf 'STRAVA_CLIENT_SECRET=%s\n' "$S" >> .env; unset S
   grep -q '^SHAPEROUTE_DOMAIN=.' .env || echo "SHAPEROUTE_DOMAIN=188-245-9-220.sslip.io" >> .env
   ```

   `SHAPEROUTE_DOMAIN` è il dominio a cui Strava rimanda il browser
   (`https://<dominio>/strava/callback`): deve essere quello scritto al
   punto 1. Serve solo se `.env` non l'ha già; con il Caddy di apt (F.12)
   non accende niente d'altro, perché il Caddy di `compose.yaml` parte solo
   con `COMPOSE_PROFILES=public`.
3. L'API nuova, che al primo avvio applica la migrazione `0004`
   (`DATABASE.md`), come ogni aggiornamento del server:

   ```bash
   cd /root/shaperoute && git pull
   cd deploy && docker compose up -d --build
   docker compose logs api | grep Accounts
   ```

   La riga «Accounts in PostgreSQL» elenca `0004_strava` fra le migrazioni
   applicate.
4. La prova: nell'app, entrati con un account, «Connect with Strava»; poi
   una corsa salvata con «Send to Strava». Da riga di comando, con la
   chiave dell'API e il token di un account, `GET /me/strava` risponde
   `"available": true`.

Per spegnere Strava basta togliere una delle due righe da `deploy/.env` e
`docker compose up -d`: i token già salvati restano nel database finché
ogni atleta non si scollega (o l'account non si cancella), ma l'API non li
usa. Sul Mac le due variabili vanno in `.env` alla radice, come la chiave
di Geoapify; lì Strava rimanda il browser all'indirizzo a cui l'app ha
chiamato l'API, e accetta solo `localhost` oltre al dominio del punto 1.

Il secret, come ogni chiave, mai in un file del repository o in una chat.
Se finisce dove non deve, dalla pagina del punto 1 se ne genera uno nuovo
e si riscrive la riga in `deploy/.env`: gli atleti collegati restano.

## Email delle segnalazioni (TASK-291)

Ogni segnalazione nuova arriva per email a chi gestisce MuW, con un link
che nasconde la cosa segnalata (`API.md`, «Report emails»; ADR-0251).
Spenta finché `deploy/.env` non ha `RESEND_API_KEY`,
`SHAPEROUTE_EMAIL_SECRET`, `SHAPEROUTE_DOMAIN` e `SHAPEROUTE_REPORTS_TO`.
**Prima di accenderla**: la privacy che nomina Resend (con la parte B di
TASK-284) e l'ok del coordinatore per il server.

1. Resend, la chiave e il segreto dei link sono gli stessi dell'email di
   ritorno (sopra, «Email di ritorno», punti 1 e 2): se ci sono già, non
   si rifanno. Senza, si fanno lì.
2. L'indirizzo di chi gestisce lo scrive l'utente sul server, con un
   comando che non lo mostra:

   ```bash
   cd /root/shaperoute/deploy
   read -r -p "Reports to: " T && printf 'SHAPEROUTE_REPORTS_TO=%s\n' "$T" >> .env; unset T
   ```

   I link sono `https://<SHAPEROUTE_DOMAIN>/report-link?t=…`: si aprono
   senza la chiave dell'API.
3. L'API nuova, che al primo avvio applica la migrazione `0024` (o il
   numero che ha preso al merge):

   ```bash
   cd /root/shaperoute && git pull
   cd deploy && docker compose up -d --build
   docker compose logs api | grep -E "Accounts|report"
   ```

   «Each new report is emailed» dice che è accesa; «Reports are not
   emailed» che manca qualcosa.
4. La prova: dall'app un account di prova segnala un disegno di un altro
   account di prova. Arriva l'email; «Hide» apre la pagina che chiede,
   il pulsante nasconde, «Undo» rimette com'era.

Per spegnerla basta togliere `SHAPEROUTE_REPORTS_TO` e `docker compose up
-d`: le segnalazioni restano nel database come prima. Il nascosto resta
nascosto finché non si rimostra, dal link o a mano (`DATABASE.md`,
migrazione `0024`).

## Il registro delle richieste e le posizioni

L'API può scrivere ogni richiesta di percorso in un file, per rifarla
uguale quando un percorso esce male (`API.md`, «Registro delle richieste»;
TASK-090, ADR-0085). È **spento** finché non si avvia l'API con
`--request-log` o con `SHAPEROUTE_REQUEST_LOG=1`.

Da sapere prima di accenderlo: ogni riga contiene la **partenza** di chi ha
chiesto il percorso, cioè di solito dove si trova, con l'ora. Sul PC di
casa, usato da te, sono le tue posizioni sul tuo disco. Su un server
(strade C, D, E) o con l'app data ad altre persone, il file raccoglie le
posizioni di **tutti** quelli che usano l'app: accendilo solo per il tempo
che serve a capire un difetto, dillo a chi usa l'app, e poi cancella
`data/requests/`. Il file non contiene la chiave dell'API né le foto, è
leggibile solo dall'utente che ha avviato l'API e non supera i 10 MB.

Nel container Docker il file sta in `/app/data/requests`, fuori dal volume
della cache: sparisce quando il container si ricrea. Per accenderlo lì si
aggiunge `-e SHAPEROUTE_REQUEST_LOG=1` a `docker run`.

---

## B — PC + Cloudflare Tunnel

Un indirizzo pubblico `https://...trycloudflare.com` che porta all'API sul
PC, gratis e senza account. Chiunque abbia l'indirizzo può provarci:
**serve la chiave**.

1. Scarica `cloudflared-windows-amd64.exe` da
   https://github.com/cloudflare/cloudflared/releases (ultima versione),
   mettilo in `D:\cloudflared\cloudflared.exe`.
2. Avvia l'API con la chiave (sezione precedente). Senza `--lan` basta:
   il tunnel parte dallo stesso PC.
3. In una seconda PowerShell:

   ```powershell
   D:\cloudflared\cloudflared.exe tunnel --url http://localhost:8000
   ```

   Stampa un indirizzo come `https://parole-a-caso.trycloudflare.com`.
4. In `apps\mobile\.env`: `EXPO_PUBLIC_API_URL=` quell'indirizzo, e la
   chiave. Riavvia `npm.cmd run mobile`.

L'indirizzo cambia a ogni avvio del tunnel. Uno fisso richiede un account
Cloudflare e un dominio tuo: per ora non serve.

---

## Il pacchetto Docker (strade C, D, E, F)

Su un server a pagamento conviene la configurazione pronta della strada
F, che usa questo stesso pacchetto. Su un server l'API gira in un
container Docker, costruito dal `Dockerfile` alla radice: motore compreso, AI esclusa (senza Ollama le
parole fuori tabella rispondono `ai_unavailable`, il resto funziona). La CI
lo costruisce a ogni PR per Intel/AMD e per ARM64 (Raspberry Pi, Oracle
Ampere), senza pubblicarlo. Docker **non** si installa sul PC di casa: i
comandi qui sotto sono per il server, in Linux.

```bash
git clone https://github.com/rockydalbianco/shaperoute.git
cd shaperoute
docker build -t shaperoute-api .
docker run -d --name shaperoute --restart unless-stopped \
  -p 8000:8000 -e SHAPEROUTE_API_KEY='la-chiave' \
  -v shaperoute-cache:/app/data/cache shaperoute-api
curl http://127.0.0.1:8000/health
```

I grafi delle zone stanno nel volume `shaperoute-cache` e restano anche
quando il container si ricrea. Una zona si scarica la prima volta che
qualcuno ci chiede un percorso (può volerci più di un minuto). Per
scaricarla subito, al primo avvio, con la CLI del motore nella stessa
immagine (qui Trento, 15 km):

```bash
docker run --rm -v shaperoute-cache:/app/data/cache shaperoute-api \
  python -m route_engine --shape circle --distance 15000 --start 46.0700,11.1210
```

Per aggiornare: `git pull`, `docker build ...`, `docker rm -f shaperoute`,
e di nuovo `docker run ...`.

Memoria: una zona in uso occupa centinaia di MB, l'API ne tiene due. Serve
un server con **almeno 4 GB** di RAM; 8 GB per stare tranquilli.

## C — Server con carta: Hetzner, Oracle Always Free

- **Hetzner Cloud**: sostituita dalla strada **F**, con i prezzi del
  2026-10-01 (Hetzner li ha alzati due volte nel 2026) e una
  configurazione che porta anche il catalogo di «Explore», gli eventi
  delle ricerche, HTTPS e l'AI.
- **Oracle Cloud Always Free** (gratis, ma la carta serve come verifica
  all'iscrizione): una VM Ampere (ARM64) fino a 4 core e 24 GB. L'immagine
  si costruisce anche per ARM64.

Per raggiungerlo dall'iPhone: `EXPO_PUBLIC_API_URL=http://IP-del-server:8000`
e la chiave; oppure Tailscale anche sul server (A), senza porte aperte.

## D — Raspberry Pi 5 (8 GB) a casa

Un computer piccolo, sempre acceso, che consuma pochi watt: il PC si può
spegnere. Si paga una volta (il Pi, alimentatore, una scheda microSD o
meglio un SSD) e niente al mese.

1. Raspberry Pi OS **a 64 bit** (Lite basta), con Raspberry Pi Imager.
2. Docker: `curl -fsSL https://get.docker.com | sh`.
3. Il pacchetto Docker qui sopra: l'immagine si costruisce per ARM64.
4. Tailscale sul Pi: `curl -fsSL https://tailscale.com/install.sh | sh`,
   poi `sudo tailscale up`, con lo stesso account del PC e dell'iPhone.
5. Nell'app: `EXPO_PUBLIC_API_URL=http://<indirizzo 100.x del Pi>:8000`.
   Con Tailscale la chiave non è indispensabile, ma non costa niente.

8 GB bastano per l'API; Ollama sul Pi sarebbe lento e resta sul PC.

## E — VPS pagato con PayPal, senza carta

Alcuni provider accettano PayPal: ad esempio **Hetzner** e **Contabo**.
Le condizioni cambiano: **al momento dell'iscrizione, controlla sulla
loro pagina dei pagamenti che PayPal sia accettato**, anche per il primo
pagamento e per la verifica dell'account, prima di dare qualsiasi dato.

Poi è come C: Ubuntu, Docker, il pacchetto Docker, la chiave, e
`EXPO_PUBLIC_API_URL` nell'app (o Tailscale sul VPS). Almeno 4 GB di RAM.

---

## F — Server a pagamento, con la configurazione pronta (TASK-144)

L'API, il motore e, se si vuole, l'AI su un server in affitto, sempre
acceso: il Mac si può spegnere (ADR-0111). Tre gradini, e ognuno funziona
da solo:

1. **Privato** (F.1–F.7): il server lo raggiungono solo i vostri
   dispositivi, con Tailscale e HTTPS, senza porte aperte. Basta per usare
   l'app voi due, da ovunque.
2. **Pubblico** (F.8): un dominio vostro e HTTPS per tutti, per far
   provare l'app ad altre persone.
3. **Negli store** (F.10): cosa manca per App Store e Play Store.

Creare gli account, pagare, comprare il dominio e scrivere le chiavi lo
fa l'utente; i comandi sono tutti qui. La configurazione sta in
`deploy/`: `compose.yaml` (l'API e, a scelta, Ollama e Caddy) e
`Caddyfile`. La CI la avvia a ogni PR.

**Il server di oggi.** Dal 2026-10-01 l'app pubblicata (`preview`) usa un
**Hetzner CX33** a Falkenstein, `sgrava-api`, scelto dall'utente dopo che
Oracle Always Free rispondeva «Out of capacity» anche a 1 OCPU e 6 GB, e
un CAX21 a Norimberga non c'era. È stato messo su a mano, prima di questa
configurazione: un `docker run` con le cartelle in `/srv/shaperoute/` e
Caddy installato con apt, pubblico da subito su un nome `sslip.io`,
senza dominio comprato (F.8). Misurato lì: un cuore da 5 km a Trento in
18,7 s con la zona in cache, una stella in 3,2 s, l'API in circa 0,56 GB
di RAM; e Overpass, che rifiuta il Mac, dal server risponde. Come
portarlo su `deploy/compose.yaml`: F.12. Dal 2026-10-08 ha anche un nome
dell'utente, `api.getmuw.app`: F.14.

### F.1 Quale server

Cosa serve all'app:

- **RAM**: 8 GB per l'API (una zona grande in memoria occupa centinaia di
  MB, l'API ne tiene due, più i calcoli; sul server di oggi, con Trento,
  circa 0,56 GB). Con l'AI (`qwen3:4b`, 3,2 GB mentre è caricata) 8 GB
  probabilmente bastano ancora, da provare con le zone grandi come New
  York; **12 GB** per stare larghi.
- **Disco**: almeno 80 GB. Le zone del Mac pesano 19 GB oggi (molti sono
  ritagli, che TASK-136 toglie) e crescono con le città.
- **Processore**: il motore lavora a lungo, e un vCPU di un server
  condiviso è più lento di un Mac recente. Sul CX33 di oggi il cuore da
  5 km a Trento ci mette 18,7 s, dentro i 5–25 s che `API.md` dà per 3–10
  km; un server nuovo si misura allo stesso modo (F.7).
- **In Europa**, per i dati degli utenti (GDPR) e per la latenza.
- **Ubuntu 24.04 LTS**.

Prezzi verificati il **2026-10-01** sulle pagine dei provider, al mese,
IVA esclusa; un privato in Italia paga il 22% in più (colonna «con IVA»).
Cambiano spesso: controllali prima di comprare.

| Server | vCPU | RAM | Disco | Prezzo | Con IVA | Note |
|---|---|---|---|---|---|---|
| **Hetzner CX33** | 4 | 8 GB | 80 GB | 8,49 € + 0,50 € IPv4 | **10,97 €** | a ore, senza impegno; backup +20% |
| Hetzner CX43 | 8 | 16 GB | 160 GB | 15,99 € + 0,50 € IPv4 | 20,12 € | come CX33, con posto per l'AI |
| OVHcloud VPS-2 | 4 | 8 GB | 75 GB | 7,21 € | 8,80 € | impegno 12 mesi; backup giornaliero e IPv4 inclusi |
| **OVHcloud VPS-3** | 6 | 12 GB | 100 GB | 10,40 € | **12,69 €** | come VPS-2; anche in Italia; a volte esaurito |
| Contabo Cloud VPS 6 | 6 | 12 GB | 200 GB | da 7,50 € | — | impegno 24 mesi; processore e disco più lenti; IVA da controllare |
| Oracle Always Free | 4 ARM | 24 GB | 200 GB | 0 € | 0 € | carta per la verifica; le VM ferme vengono ritirate; provato il 2026-10-01: «Out of capacity» |

**La raccomandazione**, e la scelta:

- **Hetzner CX33**, 10,97 €/mese: **scelto dall'utente**, è il server di
  oggi. Si paga a ore e si cancella quando si vuole. Il pannello è il più
  semplice e il server è pronto in un minuto. Se servono più core o più
  memoria, dal pannello si passa a CX43 (con il disco più grande non si
  torna indietro).
- **L'alternativa, se un giorno serve più RAM per meno: OVHcloud VPS-3**,
  12,69 €/mese pagando 12 mesi in anticipo (circa 152 €): 12 GB, il
  backup giornaliero incluso, un datacenter anche in Italia.

Scartati: DigitalOcean, Vultr, Linode, AWS Lightsail (4–5 volte il
prezzo per la stessa RAM); Render, Railway, Fly.io (la RAM si paga a parte
e il disco permanente costa: per 8 GB, decine di euro al mese); netcup
(14,50 € + IVA per 8 GB, 12 mesi); i vCPU dedicati di Hetzner (CCX, CPX),
più che raddoppiati nel 2026. Senza canone resta il Raspberry Pi (D).

### F.2 Comprare e creare il server (lo fa l'utente)

1. **Una chiave SSH sul Mac**, per entrare nel server senza password. Se
   `ls ~/.ssh/id_ed25519.pub` dice che il file non c'è:

   ```bash
   ssh-keygen -t ed25519 -C "shaperoute"
   ```

   Invio a ogni domanda (una frase segreta è meglio, se la ricordi). Poi
   copia la parte pubblica, quella da dare al provider:

   ```bash
   pbcopy < ~/.ssh/id_ed25519.pub
   ```

2. **L'account dal provider**, con i tuoi dati e il pagamento. Hetzner a
   volte chiede un documento ai clienti nuovi.
3. **Il server**:
   - **Hetzner**: Cloud Console → nuovo progetto `shaperoute` → *Add
     Server*: posizione Nuremberg o Falkenstein, immagine **Ubuntu
     24.04**, tipo **CX33** (*Cost-Optimized*, x86), IPv4 e IPv6 accesi,
     *SSH key* la chiave del punto 1, nome `shaperoute`. Il backup è
     facoltativo (F.9).
   - **OVHcloud**: VPS → **VPS-3** (o VPS-2) → posizione (Milano, se
     c'è) → **Ubuntu 24.04** → la chiave SSH del punto 1.
4. Il pannello mostra l'**indirizzo IPv4** del server, come
   `203.0.113.10`. Dal Mac:

   ```bash
   ssh root@203.0.113.10
   ```

   Su OVHcloud l'utente è `ubuntu` al posto di `root`, qui e in tutti i
   comandi che seguono. Alla prima connessione rispondi `yes`. Da qui i
   comandi sono **sul server**, finché non è scritto «dal Mac».

### F.3 Preparare il server (una volta)

Sul server, una riga alla volta:

```bash
sudo apt update && sudo apt -y upgrade
sudo ufw allow OpenSSH
sudo ufw --force enable
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
curl -fsSL https://tailscale.com/install.sh | sudo sh
sudo tailscale up --hostname shaperoute
```

- `ufw` è il firewall: resta aperta solo la porta di SSH.
- Docker arriva con `docker compose`; l'utente entra nel gruppo `docker`
  per usarlo senza `sudo` (con `root` non serve, e non fa danni).
- `tailscale up` stampa un link: aprilo sul Mac ed entra con **lo stesso
  account Tailscale** del Mac e dell'iPhone (strada A). Il server compare
  nella tailnet come `shaperoute`.

Esci (`exit`) e rientra, questa volta attraverso Tailscale, dal Mac:

```bash
ssh root@shaperoute
```

Se il nome non risponde, usa l'indirizzo `100.x` che l'app Tailscale
mostra per il server. Ubuntu installa da solo gli aggiornamenti di
sicurezza; un `sudo reboot` ogni tanto li completa, e l'API riparte da
sola.

### F.4 Il codice e i segreti

```bash
git clone https://github.com/rockydalbianco/shaperoute.git
cd shaperoute
cp .env.example deploy/.env
openssl rand -base64 32
openssl rand -hex 24
nano deploy/.env
```

Il primo `openssl` stampa una chiave nuova per l'API (sezione «La chiave
dell'API»), il secondo la password del database (TASK-122, F.13): solo
lettere e cifre, perché finisce dentro un indirizzo. In `nano` scrivi:

```
SHAPEROUTE_API_KEY=la-chiave-appena-stampata
GEOAPIFY_API_KEY=la-chiave-di-geoapify
POSTGRES_PASSWORD=la-password-appena-stampata
```

La chiave di Geoapify è quella che il Mac ha già nel suo `.env`. Salva
con `Ctrl+O` e Invio, esci con `Ctrl+X`. Le altre righe restano come
sono; `SHAPEROUTE_REQUEST_LOG` vuota (sezione «Il registro delle
richieste e le posizioni»). `deploy/.env` non entra nel repository
(`.gitignore`) e non va scritto in una chat.

### F.5 Le zone dal Mac

Il server scarica una zona da Overpass alla prima richiesta, ma Overpass a
volte rifiuta (`MAPS.md`): conviene copiare quelle che il Mac ha già,
circa 19 GB. Sul server, prima, la cartella diventa tua per la copia:

```bash
mkdir -p ~/shaperoute/data/cache
sudo chown -R "$USER" ~/shaperoute/data
```

Poi **dal Mac**, dalla cartella del progetto:

```bash
cd ~/Progetti/shaperoute
rsync -avz --partial --progress data/cache/ root@shaperoute:shaperoute/data/cache/
```

Con `-z` i 19 GB viaggiano compressi, circa 4 GB (misurato copiando sul
server di oggi): con 20 Mbit/s in upload, una mezz'ora. Se si interrompe,
lo stesso comando riprende da dove era. La barra finale di `data/cache/`
conta: copia il contenuto, non la cartella. Al primo avvio (F.6) la
cartella torna all'utente dell'API da sola (`data-owner` in
`compose.yaml`); per un'altra copia, più avanti, si rifà prima il `chown`
qui sopra.

### F.6 Avviare

Sul server:

```bash
cd ~/shaperoute/deploy
docker compose up -d --build
```

La prima volta costruisce l'immagine, qualche minuto. Poi:

```bash
docker compose ps
curl http://127.0.0.1:8000/health
```

`db` e `api` devono essere `Up (healthy)`, dopo una ventina di secondi,
`backup` e `offsite` `Up`, e `/health` rispondere `{"status":"ok"}`. Cosa dice l'API, all'avvio e a ogni
richiesta: `docker compose logs -f api` (esci con `Ctrl+C`). All'avvio
deve dire «API key required in the X-API-Key header», «Places suggested
by Geoapify», «… recommended routes from catalog/seed», con un numero
più grande di zero, e «Accounts in PostgreSQL» con le migrazioni applicate
(la prima volta `0001_users_sessions`, poi «schema up to date»).

Docker riavvia l'API se si ferma e quando il server si riaccende. La porta
8000 è aperta solo verso il server stesso (`127.0.0.1`): da internet non
si raggiunge, nemmeno a firewall spento.

**L'AI sul server** (facoltativa, solo con 12 GB o più): in `deploy/.env`
scrivi `COMPOSE_PROFILES=ai`, poi

```bash
docker compose up -d
docker compose exec ollama ollama pull qwen3:4b
```

Senza, le parole fuori tabella rispondono `ai_unavailable` e l'app
propone le forme del catalogo da toccare; tutto il resto funziona. Sul
server l'AI gira sul processore, senza la grafica del Mac: è più lenta, da
misurare con una parola come «stemma della ferrari». L'API la aspetta al
più 90 s (`AI.md`).

### F.7 L'iPhone verso il server (privato, con Tailscale)

1. **HTTPS nella tailnet** (una volta, lo fa l'utente): nella console di
   Tailscale, <https://login.tailscale.com/admin/dns>, accendi
   **MagicDNS** e, più sotto, **HTTPS Certificates**.
2. Sul server:

   ```bash
   sudo tailscale serve --bg 8000
   ```

   Stampa un indirizzo come `https://shaperoute.tail1234.ts.net`: porta
   all'API con un certificato vero, ma solo dai dispositivi della
   tailnet, e resta acceso dopo un riavvio. Il nome della tailnet finisce
   nei registri pubblici dei certificati; non dice altro.
3. **La prova**: sull'iPhone, con Tailscale acceso, anche in 5G, apri in
   Safari `https://shaperoute.tail1234.ts.net/health` (il tuo indirizzo).
4. **L'app**: l'indirizzo va su EAS, come in A.6 punto 2. Dal Mac, da
   `apps/mobile`:

   ```bash
   npx eas-cli env:set preview --name EXPO_PUBLIC_API_URL --value https://shaperoute.tail1234.ts.net --visibility plaintext
   ```

   La chiave, `EXPO_PUBLIC_API_KEY`, la stessa di `deploy/.env`, mettila
   dalla pagina del progetto su expo.dev, *Environment variables*,
   ambiente `preview`, visibilità *Sensitive*: scritta in un comando
   resterebbe nella cronologia del Terminale.
5. **Ripubblica** l'app (A.6 punto 3) e aprila in Expo Go.

Il server di oggi non passa da qui: è pubblico da subito (F.8). Non
Tailscale *Funnel*, che lo renderebbe pubblico: provato, il suo nome
pubblico non è mai stato creato (tailscale/tailscale#21502).

Ora il Mac si può spegnere. **La prova dei tempi**: un cuore da 5 km a
Trento, che è in cache, e uno da 15 km; `API.md` dice quanto ci mettono
sul Mac. Se sul server sono molto più lenti, è il momento di decidere fra
il server più grande e una task per rendere più veloce il motore.

### F.8 Un indirizzo pubblico

Con Tailscale l'app la usa solo chi è nella vostra tailnet. Per altre
persone, e per gli store, serve un indirizzo pubblico in HTTPS.

1. **Un dominio**, lo compra l'utente: 10–15 €/anno da un registrar, ad
   esempio un `.it` o un `.app`. Servirà anche per la pagina della
   privacy che gli store chiedono (F.10). **Per cominciare se ne può fare
   a meno**, come il server di oggi: `203-0-113-10.sslip.io` (l'IPv4 con
   i trattini) porta già all'indirizzo del server, senza DNS da
   configurare; si salta il punto 2 e si usa quel nome come
   `SHAPEROUTE_DOMAIN`. Per gli store meglio un nome vostro, che resta
   anche se cambia il server.
2. **Il DNS**, nel pannello del registrar: un record `A` con nome `api` e
   per valore l'IPv4 del server; se il server ha IPv6, anche un `AAAA`.
   Dopo qualche minuto, dal Mac, `ping api.tuodominio.it` risponde
   dall'indirizzo del server.
3. **Il firewall**, sul server (e nel pannello del provider, se lì ce n'è
   uno acceso):

   ```bash
   sudo ufw allow 80,443/tcp
   sudo ufw allow 443/udp
   ```

4. **Controlla la chiave**: con un indirizzo pubblico, senza chiave l'API
   è aperta a tutti. In `deploy/.env` `SHAPEROUTE_API_KEY` deve avere un
   valore (F.4). Poi, sempre in `deploy/.env`:

   ```
   SHAPEROUTE_DOMAIN=api.tuodominio.it
   COMPOSE_PROFILES=public
   ```

   (`ai,public` se c'è anche l'AI), e sul server:

   ```bash
   sudo tailscale serve reset
   docker compose up -d
   ```

   La prima riga spegne `tailscale serve` di F.7, se c'è: tiene la porta
   443 e Caddy non riuscirebbe ad aprirla (successo sul server di oggi).

   Caddy chiede il certificato a Let's Encrypt e lo rinnova da solo.
5. **La prova, dal Mac**: `curl https://api.tuodominio.it/health`
   risponde `{"status":"ok"}`, e

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' https://api.tuodominio.it/docs
   ```

   risponde `401`.
6. **L'app**: `EXPO_PUBLIC_API_URL` su EAS diventa
   `https://api.tuodominio.it` (F.7, punto 4), la chiave resta, e si
   ripubblica.

Il limite di 30 richieste al minuto vale per ogni telefono: Caddy passa
all'API l'indirizzo vero (`FORWARDED_ALLOW_IPS` in `compose.yaml`). Il
server di oggi, senza, conta tutti come uno, e ha alzato il limite a 120
(`SHAPEROUTE_RATE_LIMIT`). La
chiave dentro l'app resta debole (A.6, «Limiti»): chi ha l'app la può
leggere. La protezione vera arriva con gli account (TASK-114, TASK-115).

### F.9 Tenerlo in ordine

Sul server, da `~/shaperoute/deploy`:

| Cosa | Comando |
|---|---|
| Aggiornare dopo un merge | `git pull && docker compose up -d --build` |
| I log dell'API | `docker compose logs -f api` |
| Riavviare l'API | `docker compose restart api` |
| Spegnere tutto | `docker compose down` (zone e dati restano in `data/`) |
| Memoria e processore | `docker stats` (esci con `Ctrl+C`) |
| Spazio | `df -h /` e `du -sh ~/shaperoute/data/cache` |
| Togliere le immagini vecchie | `docker image prune` |
| Spegnere l'AI | togli `ai` da `COMPOSE_PROFILES`, poi `docker compose stop ollama` |

- **Copie di sicurezza**: il database si copia da solo ogni notte, e le
  copie e gli eventi delle ricerche vanno nello Storage Box (F.13). Le zone si
  riprendono dal Mac (F.5), il resto da GitHub. Prima di un aggiornamento
  grosso, una copia subito: `docker compose exec backup bash /backup.sh
  now`.
- **Sapere se si ferma**: con l'indirizzo pubblico di F.8, un servizio
  gratuito che chiama `/health` ogni pochi minuti e manda un'email se non
  risponde (ad esempio UptimeRobot).

### F.10 Verso gli store

Oggi l'app si apre in Expo Go, con l'account Expo del progetto (A.6). Per
metterla in App Store e Play Store, nell'ordine:

1. **L'indirizzo pubblico** (F.8).
2. **Account e database**: le scelte di TASK-110, poi TASK-114 (database
   e account nell'API), TASK-115 (iscriversi dall'app), TASK-121
   (segnalare, bloccare, cancellare i propri dati) e TASK-122 (il database
   sul server, con le copie di sicurezza). `ROADMAP.md` li vuole fatti
   prima di invitare persone che non si conoscono. Il database può stare
   sullo stesso server, accanto all'API in `deploy/compose.yaml`.
3. **La privacy**: una pagina sul vostro dominio che dica cosa si
   raccoglie (la partenza di un percorso è di solito dove si trova chi
   corre), per quanto e come si cancella; il registro delle richieste
   spento; l'attribuzione delle mappe, «© OpenStreetMap contributors».
4. **Una build propria** al posto di Expo Go, con EAS Build (il piano
   gratuito ha 15 build iOS e 15 Android al mese):
   - **Apple Developer Program**, 99 $ l'anno. Con TestFlight l'app si
     prova sugli iPhone di altre persone prima di pubblicarla (per chi
     non è nel vostro account, Apple fa prima una revisione breve).
   - **Google Play Console**, 25 $ una volta. Un account personale nuovo
     deve far provare l'app ad almeno 12 persone per 14 giorni (test
     chiuso) prima di poterla pubblicare.

   La build propria serve anche alla voce a telefono bloccato e alla
   pubblicità (TASK-132).
5. **Un server più grande** solo quando i tempi o la memoria lo dicono
   (F.9, `docker stats`): prima si misura.

Quanto costa, a gradini (2026-10-01, IVA compresa, indicativo):

| Gradino | Cosa si aggiunge | Al mese |
|---|---|---|
| Privato (F.1–F.7) | il server | 11–13 € |
| Pubblico (F.8) | il dominio, 10–15 €/anno | 12–14 € |
| Negli store (F.10) | Apple 99 $/anno, Google 25 $ una volta | 21–24 € il primo anno |

### F.11 Se qualcosa non va

- **`api` non diventa `healthy`, o riparte di continuo**: `docker compose
  logs api`. Una chiave con meno di 16 caratteri ferma l'API all'avvio.
- **Safari non apre l'indirizzo `.ts.net`**: Tailscale è acceso
  sull'iPhone? *HTTPS Certificates* è acceso nella console (F.7, punto 1)?
  Sul server, `tailscale serve status` deve mostrare
  `proxy http://127.0.0.1:8000`.
- **«The API refused this app's key»**: la chiave su EAS è diversa da
  quella di `deploy/.env`, o l'app non è stata ripubblicata dopo il
  cambio.
- **Caddy non ottiene il certificato** (`docker compose logs caddy`): il
  DNS non punta ancora al server, o le porte 80 e 443 sono chiuse nel
  firewall del provider. Se dice che la porta 443 è occupata:
  `tailscale serve` è ancora acceso (`sudo tailscale serve reset`), o c'è
  ancora il Caddy di apt (F.12, punto 4).
- **`map_data_unavailable` in una zona nuova**: Overpass rifiuta il
  server. Riprova più tardi, o scaricala dal Mac e copiala (F.5).
- **Lento o senza memoria**: `docker stats` e `free -h`. Con l'AI su un
  server da 8 GB, spegnila (F.9).

### F.12 Dal server fatto a mano a questa configurazione

Per il server di oggi (`sgrava-api`), quando si decide di spostarlo: la
stessa API, gli stessi dati e lo stesso indirizzo, quindi l'app non
cambia; in più il database degli account e le sue copie (TASK-122, F.13).
Due minuti di API ferma. Sul server, come `root`:

1. Il codice e i segreti, con la password nuova del database:

   ```bash
   cd /root/shaperoute && git pull
   cp /srv/shaperoute/shaperoute.env deploy/.env
   echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)" >> deploy/.env
   ```

   Il file ha già la chiave, Geoapify e il limite; `COMPOSE_PROFILES`
   manca, cioè solo l'API (con il database, che c'è sempre).
2. Il container vecchio fuori, i dati dentro `data/` (stesso disco: è uno
   spostamento, non una copia):

   ```bash
   docker rm -f shaperoute
   mkdir -p data
   mv /srv/shaperoute/cache /srv/shaperoute/insights /srv/shaperoute/requests data/
   ```

3. Avviare e controllare (F.6), poi la prima copia e la prova che si
   ripristina (F.13):

   ```bash
   cd deploy && docker compose up -d --build
   curl http://127.0.0.1:8000/health
   docker compose logs api | grep Accounts
   docker compose exec backup bash /backup.sh now
   docker compose exec backup bash /backup.sh check
   ```

4. **Caddy resta quello di apt**: il suo `reverse_proxy` va ancora a
   `127.0.0.1:8000`, e con `FORWARDED_ALLOW_IPS` l'API ora vede ogni
   telefono, quindi `SHAPEROUTE_RATE_LIMIT` in `deploy/.env` può tornare
   vuoto (30 a telefono) con un `docker compose up -d`. Passare al Caddy
   di `compose.yaml` è un passo a parte, facoltativo: `sudo systemctl
   disable --now caddy`, poi in `deploy/.env` `SHAPEROUTE_DOMAIN` con il
   nome `sslip.io` di oggi e `COMPOSE_PROFILES=public`, e `docker compose
   up -d`.
5. Dall'iPhone, un percorso: l'app non cambia indirizzo né chiave.
6. Le copie fuori dal server: lo Storage Box (F.13), quando c'è.

Se qualcosa va storto si torna indietro: `docker compose down`, le tre
cartelle di nuovo in `/srv/shaperoute/`, e il `docker run` di prima. Il
database resta nel volume `shaperoute_db` per un altro tentativo.

### F.13 Il database e le sue copie

TASK-122, ADR-0123. Gli account (TASK-114, `DATABASE.md`) stanno nel
servizio `db` di `compose.yaml`: PostgreSQL 16 con PostGIS, i dati nel
volume Docker `shaperoute_db` (non in `data/`: sono di PostgreSQL, che li
vuole suoi). Nessuna porta verso fuori: lo raggiungono solo gli altri
servizi. L'API lo trova con l'indirizzo che `compose.yaml` compone da
`POSTGRES_PASSWORD`, e all'avvio applica le migrazioni.

**La copia notturna.** Il servizio `backup` fa un `pg_dump` ogni giorno
alle 02:00 UTC (`BACKUP_AT` in `deploy/.env`) in
`data/backups/shaperoute-<data>.dump`, leggibile solo da `root`, e
cancella le copie con più di 13 giorni: un account cancellato oggi è
fuori da ogni copia entro 14 (ADR-0114, punto 7). Una copia si scrive con
un nome nascosto e prende il suo solo quando è intera.

| Cosa | Comando, da `~/shaperoute/deploy` |
|---|---|
| Una copia adesso | `docker compose exec backup bash /backup.sh now` |
| Le copie allo Storage Box adesso | `docker compose exec offsite bash /backup.sh push` |
| Provare che una copia si ripristina | `docker compose exec backup bash /backup.sh check` |
| Le copie | `ls -l ../data/backups` |
| Cosa ha fatto stanotte | `docker compose logs backup offsite` |

`check` ripristina la copia più recente (o `check /backups/<nome>`) in un
database a parte, `restore_check`, conta gli account e le migrazioni, poi
lo cancella: quello vero non si tocca.

**Le copie nello Storage Box** (scelta dell'utente, 2026-10-02, ADR-0123).
Lo Storage Box è un disco di Hetzner separato dal server. Ogni notte alle
02:30 UTC (`PUSH_AT`), mezz'ora dopo la copia, il servizio `offsite` ci
manda con `rsync`, sopra SSH sulla porta 23, le copie del database in
`sgrava-db/` (le stesse del server: quelle
con più di 13 giorni spariscono anche lì) e gli eventi delle ricerche in
`sgrava-insights/` (che si aggiungono soltanto). Finché lo Storage Box non
c'è, le copie restano sul server e `push` lo dice.

1. **La chiave, sul server** (una volta; fatto il 2026-10-02):

   ```bash
   install -d -m 700 /root/.ssh/storagebox
   ssh-keygen -t ed25519 -N "" -C "sgrava-api backups to Storage Box" -f /root/.ssh/storagebox/id_ed25519
   cat /root/.ssh/storagebox/id_ed25519.pub
   ```

   La chiave privata resta lì, fuori dal repository; la riga stampata è la
   parte pubblica, da incollare al punto 2.
2. **Lo Storage Box, lo crea l'utente** nella Hetzner Console:
   *Storage Boxes* → *Create Storage Box*; posizione **Falkenstein (FSN1)**,
   come il server; tipo **BX11**, il più piccolo (1 TB); in *SSH keys* la
   riga del punto 1; accesso **SSH** acceso (Samba e WebDAV non servono).
   Nome utente e indirizzo (`u123456`, `u123456.your-storagebox.de`) sono
   nella pagina dello Storage Box: non sono segreti. Una password, se il
   pannello la chiede, la tiene l'utente: alle copie non serve.
3. **Sul server**, la chiave dello Storage Box fra quelle conosciute, le
   due variabili in `deploy/.env` e il servizio ricostruito:

   ```bash
   ssh-keyscan -p 23 u123456.your-storagebox.de > /root/.ssh/storagebox/known_hosts
   cd ~/shaperoute/deploy && nano .env    # STORAGEBOX_HOST=u123456.your-storagebox.de, STORAGEBOX_USER=u123456
   docker compose up -d --build offsite
   docker compose exec offsite bash /backup.sh push
   ```

   `push` deve dire «… copies and the search events to
   u123456.your-storagebox.de»; da lì ogni notte, dopo la copia. Un `push`
   fallito resta nel log (`docker compose logs offsite`) e si riprova la
   notte dopo, con le copie ancora sul server.

**Ripristinare davvero** (sostituisce il database di adesso):

```bash
cd ~/shaperoute/deploy
docker compose exec backup bash /backup.sh now
docker compose stop api
docker compose exec backup dropdb shaperoute
docker compose exec backup createdb shaperoute
docker compose exec backup pg_restore --no-owner --exit-on-error -d shaperoute /backups/shaperoute-<data>.dump
docker compose start api
```

La prima riga è la copia di adesso, per tornare indietro. Una copia che
c'è solo nello Storage Box va prima nella cartella del server:
`rsync -a -e "ssh -p 23 -i /root/.ssh/storagebox/id_ed25519" u123456@u123456.your-storagebox.de:sgrava-db/shaperoute-<data>.dump ~/shaperoute/data/backups/`.
All'avvio l'API riapplica le migrazioni più nuove della copia.

### F.14 Il dominio getmuw.app (TASK-265)

Il 2026-10-08 l'utente ha comprato **`getmuw.app`** su Porkbun
(registrato fino al 2027-10-08, server DNS di Porkbun) ed è rimasto su
questo server (ADR-0234). L'API risponde anche su `api.getmuw.app`;
`188-245-9-220.sslip.io` resta acceso per le app che hanno ancora il
vecchio indirizzo e per il ritorno da Strava (`SHAPEROUTE_DOMAIN`, sotto).
`getmuw.app` e `www.getmuw.app` sono per il sito (TASK-237, `SITO.md`).

Sul server Caddy è quello di apt (F.12, punto 4): `caddy.service` in
systemd, la configurazione in `/etc/caddy/Caddyfile`, l'API dietro su
`127.0.0.1:8000`. Il `deploy/Caddyfile` del repository non c'entra.

1. **Il DNS**, nel pannello di Porkbun (lo fa l'utente): via i due record
   di parcheggio verso `pixie.porkbun.com` (un `ALIAS` senza nome e un
   `CNAME` `*`), poi tre record `A`, TTL 600:

   | Host | Valore |
   |---|---|
   | *(vuoto)* | `188.245.9.220` |
   | `www` | `188.245.9.220` |
   | `api` | `188.245.9.220` |

   Niente `AAAA`: il server ha anche l'IPv6 `2a01:4f8:c016:7ef0::1` e
   `ufw` apre 80 e 443 anche lì, quindi si può aggiungere in seguito, ma
   senza l'app funziona uguale. Il controllo, dal Mac:

   ```bash
   dig +short api.getmuw.app @1.1.1.1
   ```

   deve rispondere `188.245.9.220`. Un dominio `.app` appena comprato
   arriva nel registro di Google da qualche minuto a un'ora dopo; prima
   `dig` non risponde niente. Senza quella risposta non si va avanti:
   Caddy chiederebbe il certificato a vuoto.
2. **Il Caddyfile**, sul server. Prima una copia, poi un solo cambio,
   l'indirizzo in più nella riga del sito:

   ```diff
   -188-245-9-220.sslip.io {
   +188-245-9-220.sslip.io, api.getmuw.app {
    	reverse_proxy 127.0.0.1:8000
    }
   ```

   ```bash
   cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.before-task265
   sed -i 's/^188-245-9-220\.sslip\.io {$/188-245-9-220.sslip.io, api.getmuw.app {/' /etc/caddy/Caddyfile
   caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
   systemctl reload caddy
   ```

   `reload` cambia la configurazione senza fermare Caddy: chi usa
   `sslip.io` non se ne accorge. Caddy chiede subito il certificato di
   `api.getmuw.app` a Let's Encrypt e poi lo rinnova da solo; com'è
   andata:

   ```bash
   journalctl -u caddy --since "10 min ago" | grep -i -E "api.getmuw.app|error"
   ```

   cerca una riga «certificate obtained successfully» per
   `api.getmuw.app`.
3. **La prova, dal Mac**:

   ```bash
   curl -s https://api.getmuw.app/health
   curl -s -o /dev/null -w '%{http_code}\n' https://api.getmuw.app/docs
   curl -s -o /dev/null -w '%{http_code}\n' https://188-245-9-220.sslip.io/health
   ```

   rispondono `{"status":"ok"}`, `401` (senza chiave l'API resta chiusa)
   e `200` (il vecchio indirizzo va ancora). `curl` si ferma da solo se
   il certificato non è valido.
4. **L'app**: dopo la prova, con l'ok dell'utente, `EXPO_PUBLIC_API_URL`
   di `preview` su EAS diventa `https://api.getmuw.app` (F.8, punto 6) e
   si pubblica. La chiave non cambia. Le app che non hanno ancora scaricato
   l'aggiornamento continuano su `sslip.io`, per questo il vecchio nome
   resta nel Caddyfile.

**Tornare indietro**: `cp /etc/caddy/Caddyfile.before-task265
/etc/caddy/Caddyfile && systemctl reload caddy`. Se l'app era già
passata ad `api.getmuw.app`, prima si ripubblica con l'indirizzo
`sslip.io`.

**Il sito su `getmuw.app`** (TASK-237, parte B): dopo che il sito con il
nome MuW è in `main` e con il sì dell'utente sulla pubblicazione. Il sito
è statico, senza build (`SITO.md`): Caddy serve una copia dei soli file
che la pagina carica, in `/srv/getmuw-site`. Restano fuori `tests/`,
`tools/`, `package.json` e il merch spento (`merch.*`, `products.js`,
`prints/`). La copia non viene da `/root/shaperoute`: Caddy gira come
utente `caddy` e non entra in `/root`.

1. **I file**, sul server. `git fetch` aggiorna solo `origin/main`, non i
   file da cui si costruisce l'API; `git archive` prende l'elenco
   esplicito da lì. La copia nuova si prepara a parte e prende il posto
   della vecchia in un colpo, che resta in `/srv/getmuw-site.old`:

   ```bash
   cd /root/shaperoute
   git fetch origin main
   rm -rf /srv/getmuw-site.new && mkdir -p /srv/getmuw-site.new
   git archive origin/main site/index.html site/styles.css site/main.js site/render.js site/content.js site/config.js site/data site/assets site/privacy site/support | tar -x -C /srv/getmuw-site.new --strip-components=1
   chmod -R a+rX /srv/getmuw-site.new
   rm -rf /srv/getmuw-site.old
   if [ -d /srv/getmuw-site ]; then mv /srv/getmuw-site /srv/getmuw-site.old; fi
   mv /srv/getmuw-site.new /srv/getmuw-site
   ```

   Gli stessi comandi, dopo ogni merge che cambia il sito, lo
   aggiornano; Caddy non va toccato. Se la pagina carica un file nuovo
   fuori da quell'elenco, l'elenco cambia qui. Tornare alla copia di
   prima: `rm -rf /srv/getmuw-site && mv /srv/getmuw-site.old
   /srv/getmuw-site`.
2. **Il Caddyfile**, una volta: due blocchi in fondo, con la copia prima
   come al punto 2 sopra (`Caddyfile.before-task237b`). `www` rimanda al
   nome senza `www`, così l'indirizzo è uno solo:

   ```
   getmuw.app {
   	root * /srv/getmuw-site
   	encode gzip
   	file_server
   }

   www.getmuw.app {
   	redir https://getmuw.app{uri} permanent
   }
   ```

   poi `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`
   e `systemctl reload caddy`. Caddy chiede i certificati dei due nomi.
3. **La prova, dal Mac**:

   ```bash
   curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://getmuw.app/
   curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://getmuw.app/main.js
   curl -s -o /dev/null -w '%{http_code}\n' https://getmuw.app/package.json
   curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://www.getmuw.app/
   ```

   rispondono `200 text/html…`, `200 text/javascript…` (gli script
   sono moduli ES e il browser li vuole con questo tipo: Caddy lo dà da
   solo dall'estensione), `404`, e `301 https://getmuw.app/`. Poi la
   pagina in un browser: «Try it» disegna un percorso.

**Strava resta su `sslip.io`.** `SHAPEROUTE_DOMAIN` in `deploy/.env` è
solo l'indirizzo a cui Strava rimanda il browser dopo «Connect with
Strava», e deve essere uguale alla «Authorization Callback Domain»
dell'applicazione Strava dell'utente. Per spostarlo su `api.getmuw.app`
vanno cambiati tutti e due insieme (l'utente su
<https://www.strava.com/settings/api>, poi `.env` e `docker compose up
-d`): non fa parte di TASK-265.

---

## Scartate (2026-09-26)

Hugging Face Spaces (Docker ora a pagamento), Render e Koyeb gratis
(512 MB di RAM, niente disco permanente), Cloudflare Workers (troppo poca
memoria). Il perché è in ADR-0076.
