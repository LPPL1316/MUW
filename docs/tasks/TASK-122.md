# TASK-122 — L'API e il database sempre accesi

**Stato**: Done
**Fase**: 4 · **Branch**: `chore/TASK-122-hosting`
**Dipende da**: TASK-110, TASK-114 · **Serve prima di** invitare altre persone

## Obiettivo

API e database girano dove ha scelto l'utente in TASK-110, raggiungibili
da qualunque telefono con HTTPS, anche a Mac spento.

## Contesto da leggere

- `docs/DEPLOY.md`
- `docs/DECISIONS.md`, ADR di TASK-110 su hosting e database
- `docs/MAPS.md` «Overpass: come si scarica»

## Cosa fare

Creare account su servizi esterni, pagare e inserire chiavi lo fa
**l'utente**: l'agente prepara i file e la guida passo per passo.

1. Configurazione per il servizio scelto (il pacchetto Docker c'è già),
   con il database, le migrazioni all'avvio e i segreti fuori dal
   repository.
2. La cache delle zone sul server: quali zone caricare, quanto spazio.
3. HTTPS, chiave dell'API, limite alle richieste per indirizzo: l'API non
   è più dietro Tailscale.
4. Copia di sicurezza del database, e come si ripristina (provato una volta).
5. `EXPO_PUBLIC_API_URL` verso il server e app ripubblicata con EAS Update.
6. `DEPLOY.md`: una strada nuova, completa; `.env.example`.

## Criteri di accettazione

- [x] `GET /health` risponde in HTTPS da una rete diversa da quella di casa.
- [x] Un cuore da 5 km a Trento si genera dal server nei tempi di `API.md`.
- [x] Iscrizione ed entrata funzionano dall'iPhone senza Tailscale
      (sull'indirizzo pubblico sì, provato con `curl`; dall'iPhone, con
      le schermate di TASK-115, è la prova dell'utente). L'entrata è nel
      video per Apple del 2026-10-13; un account nuovo creato dall'app
      sull'iPhone lo conferma l'utente il 2026-10-25.
- [x] Un ripristino della copia di sicurezza è stato provato e annotato.
- [x] Nessun segreto nel repository.
- [x] Le copie arrivano nello Storage Box (aggiunto il 2026-10-02, scelta
      dell'utente): dopo che l'utente lo ha creato. Dal 2026-10-25, e
      una copia ripresa da lì si ripristina (passi 2 e 3 qui sotto).

### Dove si è fermato (2026-10-02)

PR #157 (in `main`): il database e la copia notturna in
`deploy/compose.yaml` e `deploy/backup.sh`, la CI (job `docker`:
iscrizione, copia, ripristino con un account), `DEPLOY.md` F.12 e F.13, la
correzione del `.dockerignore` che lasciava fuori le migrazioni.

**Il server è spostato** (2026-10-02, 07:27Z), da `main` 609a647: sul
server mancava `docker compose`, installato da Ubuntu
(`docker-compose-v2`, senza riavviare Docker); `deploy/.env` dal vecchio
`shaperoute.env` più `POSTGRES_PASSWORD`, generata lì; `cache`,
`insights` e `requests` spostate in `/root/shaperoute/data/`
(`/srv/shaperoute/extracts` di TASK-137 lasciata com'era); l'immagine di
prima tenuta come `shaperoute-api:before-task122`. API ferma 18 s.

**Lo Storage Box** (scelta dell'utente, ADR-0123, aggiornamento del
2026-10-02), PR nuova `chore/TASK-122-offsite`: un servizio `offsite`
(Alpine) manda copie ed eventi ogni notte alle 02:30 UTC; `deploy/mac/` è
tolto. La chiave SSH dedicata c'è già sul server
(`/root/.ssh/storagebox/`). Manca: l'utente crea lo Storage Box e incolla
la chiave pubblica (`DEPLOY.md` F.13, punto 2); poi, sul server, il
punto 3 (`known_hosts`, le due variabili, `push`), e il criterio qui
sopra.

### Dove si è fermato (2026-10-25)

**Il server, letto il 2026-10-25 alle 01:15Z** (solo letture): `main`
55b990be; `backup` e `offsite` accesi da due settimane; in
`data/backups` 13 copie notturne delle 02:00Z, circa 200 KB l'una,
l'ultima del 2026-10-24; ogni notte `offsite` scrive «no Storage Box»,
perché `STORAGEBOX_HOST` e `STORAGEBOX_USER` non sono in `deploy/.env`.
La chiave `/root/.ssh/storagebox/id_ed25519` c'è, `known_hosts` no. Il
primo invio vale circa 2,2 MB di copie e 0,7 MB di eventi.

**Dall'iPhone**: l'entrata dall'iPhone vero sull'indirizzo pubblico, senza
Tailscale, è nel video per Apple del 2026-10-13 (build 7 da TestFlight,
l'account dell'utente e quello demo). L'iscrizione di un account nuovo
nel video non c'è. I 3 account del database (passo 1) non dicono da dove
sono nati: l'iscrizione dall'iPhone la conferma l'utente.

**Adesso tocca all'utente**: crea lo Storage Box (`DEPLOY.md` F.13,
punto 2, con la chiave pubblica di `/root/.ssh/storagebox/id_ed25519.pub`)
e dà il nome utente, `u123456` qui sotto. Ogni passo sul server vuole il sì
dell'utente, uno per volta (il Coordinatore, 2026-10-25). Non serve
aspettare Apple: l'API, `db` e `backup` non si riavviano. Tutti i comandi
partono da `~/shaperoute/deploy`.

**Lo Storage Box c'è** (2026-10-25, verso le 02:45Z). Comprato dall'utente
(«sì, compra»), con l'agente da Chrome nella Hetzner Console: `muw-backups`,
BX11, Falkenstein, 3,20 €/mese IVA esclusa, nome utente **`u700709`**
(indirizzo `u700709.your-storagebox.de`). Ha SSH acceso; Samba, WebDAV e
«External Reachability» spenti; nessuna password scelta, la genera Hetzner.
La chiave del server è nel progetto come `muw-server-backups` (senza il
commento). Lo stesso giorno, su richiesta dell'utente, il server è stato
rinominato `muw` (prima `ubuntu-8gb-fsn1-1`) e il progetto `MuW` (prima
`Sgrava`): sono solo nomi nella console, il server non si è fermato. Nei
passi 2 e 3, `u123456` diventa `u700709`.

**Passo 1 — la copia più recente si ripristina.**

```bash
docker compose exec backup bash /backup.sh check
```

Ci si aspetta `check: shaperoute-<data>.dump restores; N accounts,
migrations 0001_users_sessions,…,0021_push_tokens`. Lavora solo su
`restore_check`, un database di prova che crea e poi cancella: quello vero
non si tocca. Se si ferma a metà:
`docker compose exec backup dropdb --if-exists restore_check`.

*Esito (2026-10-25, 01:38Z, «sì 1» dell'utente):* la copia
`shaperoute-2026-10-24T0200Z.dump` si ripristina, con 3 account e le
migrazioni da 0001 a 0021, in 2,6 s. Alla fine `restore_check` non c'è
più; `api`, `db`, `backup` e `offsite` sono rimasti accesi senza
riavvii. Il comando è partito due volte nello stesso secondo, dal
terminale dell'utente e da questa sessione, con lo stesso risultato: il
`dropdb` finale dell'utente ha trovato il database di prova già
cancellato dall'altro `check`. Due `check` insieme si pestano i piedi su
`restore_check`, quindi se ne lancia uno per volta.

**Passo 2 — lo Storage Box nel servizio `offsite`.**

```bash
ssh-keyscan -p 23 u123456.your-storagebox.de > /root/.ssh/storagebox/known_hosts
ssh-keygen -lf /root/.ssh/storagebox/known_hosts
grep -c '^STORAGEBOX_' .env    # 0: le righe non ci sono ancora
printf '\nSTORAGEBOX_HOST=%s\nSTORAGEBOX_USER=%s\n' u123456.your-storagebox.de u123456 >> .env
docker compose up -d --no-deps offsite
docker compose logs --tail 3 offsite
docker compose exec offsite bash /backup.sh push
```

Le impronte di `ssh-keygen -lf` si confrontano con quelle che Hetzner
pubblica per gli Storage Box. Si ricrea solo `offsite`, con la stessa
immagine e senza build. Il log dice `push: every day at 02:30 UTC to
u123456.your-storagebox.de`, e `push` dice `push: 13 copies and the search
events to u123456.your-storagebox.de`. Un `Permission denied (publickey)`
vuol dire che la chiave non è nello Storage Box; un `Connection timed out`
vuol dire che l'accesso SSH è spento. In tutti e due i casi le copie
restano sul server: `offsite` le legge soltanto.

Per tornare indietro:

```bash
sed -i '/^STORAGEBOX_/d' .env
docker compose up -d --no-deps offsite
rm /root/.ssh/storagebox/known_hosts
```

Dopo, `offsite` dice di nuovo «no Storage Box».

*Esito (2026-10-25, 03:07Z, «sì, collega lo Storage Box» dell'utente):*
`ssh-keyscan` ha dato tre chiavi, con le stesse impronte che Hetzner
pubblica per gli Storage Box (ED25519 `XqONwb1S…`, ECDSA `oDHZqKXn…`, RSA
`EMlfI8Gs…`). In `.env` prima non c'erano righe `STORAGEBOX_`, ora ce ne sono
due. `offsite` ricreato da solo; il log dice
`push: every day at 02:30 UTC to u700709.your-storagebox.de`. Il primo `push`:
`push: 13 copies and the search events to u700709.your-storagebox.de`, in
1,5 s. Nello Storage Box `sgrava-db/` ha le 13 copie, dal 2026-10-13 al
2026-10-25 (quella delle 02:00Z di oggi compresa), e `sgrava-insights/` ha
`events-2026-10.jsonl` (0,7 MB). `api`, `db` e `backup` sono rimasti accesi
senza riavvii. Il primo invio notturno è il 2026-10-26 alle 02:30Z.

**Passo 3 — una copia torna dallo Storage Box e si ripristina in un
database di prova.**

```bash
f=$(ls ../data/backups | grep '^shaperoute-.*\.dump$' | sort | tail -n 1)
rsync -a -e "ssh -p 23 -i /root/.ssh/storagebox/id_ed25519 -o UserKnownHostsFile=/root/.ssh/storagebox/known_hosts -o StrictHostKeyChecking=yes" \
    "u123456@u123456.your-storagebox.de:sgrava-db/$f" "../data/backups/restore-test-$f"
sha256sum "../data/backups/$f" "../data/backups/restore-test-$f"
docker compose exec backup bash /backup.sh check "/backups/restore-test-$f"
rm "../data/backups/restore-test-$f"
```

Le due somme devono essere uguali, e `check` deve dire come al passo 1.
Il nome `restore-test-…` resta fuori da `shaperoute-*.dump`: non lo
cancella la pulizia dei 13 giorni e `push` non lo manda. Se il passo si
ferma a metà: `rm` del file e
`docker compose exec backup dropdb --if-exists restore_check`.

*Esito (2026-10-25, 03:08Z, «sì, fai la prova» dell'utente):* prima
`restore_check` non c'era. La copia `shaperoute-2026-10-25T0200Z.dump`,
ripresa dallo Storage Box, ha lo stesso SHA-256 di quella del server
(`8b2d4124…`). `check` la ripristina con 3 account e le migrazioni da 0001
a 0021; con la ripresa, 2,9 s in tutto. Poi il file di prova è cancellato e
`restore_check` non c'è più. Nessun servizio riavviato.

## File toccati

```
docs/DEPLOY.md
docs/DECISIONS.md
docs/STATUS.md
docs/tasks/TASK-122.md
.env.example
deploy/
docs/DATABASE.md            (aggiunto: le copie non sono più su Oracle)
deploy/offsite/Dockerfile   (nuovo: l'immagine del servizio offsite)
tools/test_backup_push.py   (nuovo: l'invio allo Storage Box, provato senza rete)
.gitignore                  (aggiunto: data/backups/, le copie fuori da git)
.github/workflows/ci.yml    (aggiunto: database, iscrizione e copia nel job docker)
tools/test_pull_backups.py  (tolto con deploy/mac/, il 2026-10-02)
.dockerignore               (aggiunto: le migrazioni nell'immagine, mancavano da TASK-114)
```

Le copie fuori dal server vanno in uno Storage Box Hetzner (scelta
dell'utente, 2026-10-02, ADR-0123 e il suo aggiornamento): prima erano sul
Mac, in `deploy/mac/`, tolto. Lo spostamento del server su `compose.yaml`
(`DEPLOY.md` F.12) è parte di questo task, deciso col coordinatore.

## Fuori scope

- Build propria per l'App Store (account Apple Developer): task a parte.
- Rendere più veloce il motore.

## Esito

Il server con il database, dal vivo (2026-10-02, dopo lo spostamento):
`/health` in HTTPS dal Mac 200 in 0,14 s; un cuore da 5 km a Trento
dall'indirizzo pubblico in 18,0 s, 4,9 km, somiglianza 0,92; un account di
prova sull'indirizzo pubblico: iscrizione 201, `/me` 200, entrata 200,
`DELETE /me` 204, poi `not_signed_in`, e nel database 0 utenti e 0
sessioni; la prima copia (modo 600) si ripristina con `backup.sh check`.
All'avvio l'API scrive la chiave, Geoapify, 159 percorsi consigliati e
«Accounts in PostgreSQL; migrations: 0001_users_sessions». Il ripristino
vero di F.13 è provato in locale, con Colima: dopo, l'account della copia
entra, quello creato dopo la copia no. Restano lo Storage Box (dell'utente)
e la prova dall'iPhone.

**Done il 2026-10-25.** Le copie del database escono dal server: ogni
notte alle 02:30 UTC il servizio `offsite` manda le 13 copie e gli eventi
delle ricerche nello Storage Box `muw-backups` (`u700709`, BX11,
Falkenstein, comprato dall'utente), e una copia ripresa da lì si
ripristina identica in un database di prova. L'iscrizione e l'entrata
dall'iPhone sull'indirizzo pubblico le conferma l'utente. Tutto è in
«Dove si è fermato (2026-10-25)». Seguito, senza numero: guardare il
2026-10-26 che nel log di `offsite` ci sia il primo invio notturno.
