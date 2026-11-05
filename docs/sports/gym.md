# Gym 🏋️ — la palestra (TASK-385, ADR-0327)

Sport senza rete e senza motore: niente banco, niente zone, niente impronta
del motore. Questo file dice cosa registra, cosa no, il catalogo degli
esercizi e le scale dei traguardi. Lo scrive la sessione di TASK-385.

## Cosa registra

- **Il tempo della sessione**, da «Start workout» a «Finish»: i recuperi
  dentro, «Pause» fuori. Inizio e pause in un file sul telefono, così il
  tempo resta giusto anche se l'app si chiude; niente GPS, niente permesso
  di posizione, niente modalità in background.
- **Le serie**, esercizio per esercizio, con i campi del loro tipo (sotto),
  l'ora in cui sono state segnate e se erano dal vivo (durante la sessione)
  o aggiunte dopo «Stop».
- **I recuperi**: quanti, quanto in media, quanto in tutto (i singoli
  restano sul telefono).
- **Le calorie** (energia attiva, ADR-0318): MET dei pesi sul tempo che non
  è cardio, la formula della macchina sui blocchi cardio; col battito,
  Keytel 2005 (parte G).
- **Il battito** a sessione finita, da Salute (TASK-345 C): medio, massimo,
  tempo nelle zone.

## Cosa non registra

- Nessuna traccia, nessuna distanza della sessione (la distanza di un blocco
  cardio è del blocco, non della sessione: non entra nei km del profilo).
- Nessun battito in tempo reale (vuole codice nativo per l'orologio, 1.0.2).
- Niente gioco delle forme, record personali di corsa, GPX, Strava, video
  della corsa.

## I tipi di serie

| Tipo | Campi | Misura dei traguardi e della classifica |
|---|---|---|
| carico (L) | ripetizioni, peso | il peso più alto con almeno 1 ripetizione |
| corpo libero (B) | ripetizioni, zavorra facoltativa | le ripetizioni più alte in una serie |
| a tempo (T) | secondi | i secondi più alti in una serie |
| cardio (C) | tempo, e secondo la macchina distanza, velocità, pendenza, livello, piani | la distanza più alta in un blocco; il tempo per le macchine senza distanza |

Pesi salvati in kg (mostrati in kg o lb come nelle unità), distanze in
metri, tempi in secondi. Un peso con il manubrio è **per mano**.

## Le scale (sette livelli, sette figure)

Ogni livello sblocca una figura MuW: 🐭 Mouse · 🐰 Rabbit · 🦊 Fox · 🐺 Wolf ·
🐻 Bear · 🦏 Rhino · 🦍 Gorilla (Topo, Coniglio, Volpe, Lupo, Orso,
Rinoceronte, Gorilla · Maus, Hase, Fuchs, Wolf, Bär, Nashorn, Gorilla ·
Souris, Lapin, Renard, Loup, Ours, Rhinocéros, Gorille · Ratón, Conejo,
Zorro, Lobo, Oso, Rinoceronte, Gorila).

| Scala | Livelli 1–7 | Tetto (sopra non conta) |
|---|---|---|
| L-XL | 40 · 80 · 120 · 160 · 200 · 250 · 300 kg | 1000 kg |
| L-big | 40 · 60 · 80 · 100 · 140 · 180 · 220 kg | squat 510, stacco 510, hip thrust 600 kg |
| L-M | 20 · 40 · 60 · 80 · 100 · 120 · 140 kg | panca 360 kg; le altre 350 kg |
| L-S | 10 · 20 · 30 · 40 · 50 · 60 · 80 kg | 200 kg |
| L-XS (per mano) | 4 · 6 · 8 · 10 · 14 · 18 · 24 kg | 80 kg |
| B-hard | 1 · 3 · 5 · 10 · 15 · 20 · 30 rip. | 150 rip. |
| B-easy | 10 · 20 · 30 · 40 · 50 · 75 · 100 rip. | 500 rip. |
| T | 30 s · 1 · 2 · 3 · 5 · 8 · 10 min | 2 h |
| C-run | 1 · 3 · 5 · 10 · 15 · 21 · 42 km | 100 km |
| C-bike | 5 · 10 · 20 · 30 · 40 · 60 · 100 km | 300 km |
| C-row | 1 · 2 · 5 · 10 · 15 · 21 · 42 km | 100 km |
| C-time | 5 · 10 · 15 · 20 · 30 · 45 · 60 min | 4 h |

I tetti sono sopra i record mondiali noti (le alzate) o sopra quello che una
macchina carica; servono contro gli errori di battitura e i numeri
inventati, non a giudicare. Un «Custom» non ha scala né classifica.

## Il catalogo

Tipo e scala per ogni esercizio; nomi, figure e scale approvati dall'utente
il 2026-11-04 («Sì, approvo tutto»).

| Chiave | en | it | de | fr | es | Gruppo | Tipo · scala |
|---|---|---|---|---|---|---|---|
| bench_press | Bench press | Panca piana | Bankdrücken | Développé couché | Press de banca | Chest | L-M |
| incline_bench_press | Incline bench press | Panca inclinata | Schrägbankdrücken | Développé incliné | Press inclinado | Chest | L-M |
| decline_bench_press | Decline bench press | Panca declinata | Negativbankdrücken | Développé décliné | Press declinado | Chest | L-M |
| dumbbell_bench_press | Dumbbell bench press | Panca con manubri | Kurzhantel-Bankdrücken | Développé couché haltères | Press de banca con mancuernas | Chest | L-XS |
| dumbbell_fly | Dumbbell fly | Croci con manubri | Kurzhantel-Fliegende | Écarté haltères | Aperturas con mancuernas | Chest | L-XS |
| chest_press_machine | Chest press machine | Chest press | Brustpresse | Presse pectorale | Press de pecho en máquina | Chest | L-M |
| pec_deck | Pec deck | Pectoral machine | Butterfly-Maschine | Pec deck | Contractor de pecho | Chest | L-S |
| cable_crossover | Cable crossover | Croci ai cavi | Kabelzug-Crossover | Croisé à la poulie | Cruce de poleas | Chest | L-S |
| push_up | Push-up | Piegamenti | Liegestütze | Pompes | Flexiones | Chest | B-easy |
| dips | Dips | Dip alle parallele | Dips | Dips | Fondos | Chest | B-hard |
| deadlift | Deadlift | Stacco da terra | Kreuzheben | Soulevé de terre | Peso muerto | Back | L-big |
| pull_up | Pull-up | Trazioni | Klimmzüge | Tractions | Dominadas | Back | B-hard |
| chin_up | Chin-up | Trazioni presa inversa | Klimmzüge im Untergriff | Tractions en supination | Dominadas supinas | Back | B-hard |
| assisted_pull_up | Assisted pull-up machine | Trazioni assistite | Klimmzugmaschine mit Unterstützung | Tractions assistées | Dominadas asistidas | Back | L, senza scala (meno peso è più difficile) |
| lat_pulldown | Lat pulldown | Lat machine | Latziehen | Tirage vertical | Jalón al pecho | Back | L-M |
| seated_cable_row | Seated cable row | Pulley basso | Rudern am Kabel | Tirage horizontal | Remo en polea baja | Back | L-M |
| row_machine | Seated row machine | Rematore alla macchina | Rudermaschine | Rowing machine guidée | Remo en máquina | Back | L-M |
| barbell_row | Barbell row | Rematore con bilanciere | Langhantelrudern | Rowing barre | Remo con barra | Back | L-M |
| dumbbell_row | Dumbbell row | Rematore con manubrio | Kurzhantelrudern | Rowing haltère | Remo con mancuerna | Back | L-S |
| t_bar_row | T-bar row | Rematore T-bar | T-Bar-Rudern | Rowing T-bar | Remo en barra T | Back | L-M |
| straight_arm_pulldown | Straight-arm pulldown | Pullover ai cavi | Überzüge am Kabel | Pull-over à la poulie | Pullover en polea | Back | L-S |
| back_extension | Back extension | Hyperextension | Rückenstrecker | Extension lombaire | Hiperextensiones | Back | B-easy |
| back_squat | Squat | Squat | Kniebeuge | Squat | Sentadilla | Legs | L-big |
| front_squat | Front squat | Front squat | Frontkniebeuge | Squat avant | Sentadilla frontal | Legs | L-M |
| smith_squat | Smith machine squat | Squat al multipower | Kniebeuge an der Multipresse | Squat à la Smith machine | Sentadilla en multipower | Legs | L-M |
| leg_press | Leg press | Leg press | Beinpresse | Presse à cuisses | Prensa de piernas | Legs | L-XL |
| hack_squat | Hack squat | Hack squat | Hackenschmidt-Kniebeuge | Hack squat | Sentadilla hack | Legs | L-XL |
| leg_extension | Leg extension | Leg extension | Beinstrecker | Leg extension | Extensión de cuádriceps | Legs | L-M |
| leg_curl | Leg curl | Leg curl | Beinbeuger | Leg curl | Curl femoral | Legs | L-M |
| romanian_deadlift | Romanian deadlift | Stacco rumeno | Rumänisches Kreuzheben | Soulevé de terre roumain | Peso muerto rumano | Legs | L-M |
| lunge | Lunges | Affondi | Ausfallschritte | Fentes | Zancadas | Legs | L-XS |
| bulgarian_split_squat | Bulgarian split squat | Squat bulgaro | Bulgarische Kniebeuge | Squat bulgare | Sentadilla búlgara | Legs | L-XS |
| step_up | Step-up | Step-up | Step-ups | Step-up | Subidas al cajón | Legs | L-XS |
| hip_thrust | Hip thrust | Hip thrust | Hip Thrust | Hip thrust | Hip thrust | Legs | L-big |
| glute_machine | Glute machine | Glute machine | Gesäßmaschine | Machine à fessiers | Máquina de glúteos | Legs | L-M |
| hip_abduction | Hip abduction machine | Abductor machine | Abduktorenmaschine | Machine à abducteurs | Máquina de abductores | Legs | L-M |
| hip_adduction | Hip adduction machine | Adductor machine | Adduktorenmaschine | Machine à adducteurs | Máquina de aductores | Legs | L-M |
| standing_calf_raise | Standing calf raise | Calf raise in piedi | Wadenheben stehend | Mollets debout | Elevación de talones de pie | Legs | L-M |
| seated_calf_raise | Seated calf raise | Calf raise seduto | Wadenheben sitzend | Mollets assis | Elevación de talones sentado | Legs | L-M |
| overhead_press | Overhead press | Lento avanti | Schulterdrücken | Développé militaire | Press militar | Shoulders | L-S |
| dumbbell_shoulder_press | Dumbbell shoulder press | Shoulder press con manubri | Kurzhantel-Schulterdrücken | Développé épaules haltères | Press de hombros con mancuernas | Shoulders | L-XS |
| shoulder_press_machine | Shoulder press machine | Shoulder press alla macchina | Schulterpresse | Presse épaules | Press de hombros en máquina | Shoulders | L-S |
| lateral_raise | Lateral raise | Alzate laterali | Seitheben | Élévations latérales | Elevaciones laterales | Shoulders | L-XS |
| front_raise | Front raise | Alzate frontali | Frontheben | Élévations frontales | Elevaciones frontales | Shoulders | L-XS |
| rear_delt_fly | Rear delt fly | Alzate posteriori | Reverse Flys | Oiseau | Pájaros | Shoulders | L-XS |
| reverse_pec_deck | Reverse pec deck | Reverse pectoral machine | Reverse-Butterfly | Pec deck inversé | Contractor inverso | Shoulders | L-S |
| face_pull | Face pull | Face pull | Face Pulls | Face pull | Face pull | Shoulders | L-S |
| upright_row | Upright row | Tirate al mento | Aufrechtes Rudern | Rowing menton | Remo al mentón | Shoulders | L-S |
| shrug | Shrugs | Scrollate | Shrugs | Shrugs | Encogimientos | Shoulders | L-M |
| barbell_curl | Barbell curl | Curl con bilanciere | Langhantel-Curls | Curl barre | Curl con barra | Arms | L-S |
| dumbbell_curl | Dumbbell curl | Curl con manubri | Kurzhantel-Curls | Curl haltères | Curl con mancuernas | Arms | L-XS |
| hammer_curl | Hammer curl | Curl a martello | Hammer-Curls | Curl marteau | Curl martillo | Arms | L-XS |
| preacher_curl | Preacher curl | Curl alla panca Scott | Scott-Curls | Curl au pupitre | Curl predicador | Arms | L-S |
| cable_curl | Cable curl | Curl ai cavi | Kabel-Curls | Curl à la poulie | Curl en polea | Arms | L-S |
| biceps_curl_machine | Biceps curl machine | Curl alla macchina | Bizepsmaschine | Machine à biceps | Máquina de bíceps | Arms | L-S |
| triceps_pushdown | Triceps pushdown | Push down ai cavi | Trizepsdrücken am Kabel | Extension triceps à la poulie | Extensión de tríceps en polea | Arms | L-S |
| skull_crusher | Skull crusher | French press | French Press | Barre au front | Press francés | Arms | L-S |
| overhead_triceps_extension | Overhead triceps extension | Estensioni sopra la testa | Trizepsstrecken über Kopf | Extension triceps au-dessus de la tête | Extensión de tríceps sobre la cabeza | Arms | L-XS |
| close_grip_bench_press | Close-grip bench press | Panca presa stretta | Enges Bankdrücken | Développé couché prise serrée | Press de banca agarre cerrado | Arms | L-M |
| triceps_machine | Triceps machine | Tricipiti alla macchina | Trizepsmaschine | Machine à triceps | Máquina de tríceps | Arms | L-S |
| wrist_curl | Wrist curl | Curl per i polsi | Handgelenk-Curls | Curl poignets | Curl de muñeca | Arms | L-XS |
| crunch | Crunch | Crunch | Crunches | Crunch | Abdominales | Core | B-easy |
| ab_crunch_machine | Ab crunch machine | Crunch alla macchina | Bauchmaschine | Machine à abdos | Máquina de abdominales | Core | L-S |
| cable_crunch | Cable crunch | Crunch ai cavi | Kabel-Crunches | Crunch à la poulie | Crunch en polea | Core | L-S |
| hanging_leg_raise | Hanging leg raise | Sollevamento gambe alla sbarra | Hängendes Beinheben | Relevé de jambes suspendu | Elevación de piernas colgado | Core | B-hard |
| russian_twist | Russian twist | Russian twist | Russian Twist | Russian twist | Giro ruso | Core | B-easy |
| ab_wheel | Ab wheel | Ruota addominale | Bauchroller | Roue abdominale | Rueda abdominal | Core | B-hard |
| plank | Plank | Plank | Unterarmstütz | Gainage | Plancha | Core | T |
| side_plank | Side plank | Plank laterale | Seitstütz | Gainage latéral | Plancha lateral | Core | T |
| wall_sit | Wall sit | Sedia al muro | Wandsitzen | Chaise | Sentadilla isométrica en pared | Core | T |
| power_clean | Power clean | Girata al petto | Umsetzen | Épaulé | Cargada | Full body | L-M |
| snatch | Snatch | Strappo | Reißen | Arraché | Arrancada | Full body | L-M |
| kettlebell_swing | Kettlebell swing | Swing con kettlebell | Kettlebell-Swing | Swing kettlebell | Swing con kettlebell | Full body | L-S |
| farmer_carry | Farmer's carry | Farmer walk | Farmer's Walk | Marche du fermier | Paseo del granjero | Full body | L-S |
| burpee | Burpees | Burpee | Burpees | Burpees | Burpees | Full body | B-easy |
| box_jump | Box jump | Box jump | Box Jumps | Sauts sur box | Saltos al cajón | Full body | B-easy |
| battle_ropes | Battle ropes | Battle rope | Battle Ropes | Cordes ondulatoires | Cuerdas de batalla | Full body | T |
| treadmill | Treadmill | Tapis roulant | Laufband | Tapis de course | Cinta de correr | Cardio | C-run (tempo, distanza, velocità, pendenza) |
| curved_treadmill | Curved treadmill | Tapis roulant curvo | Kurvenlaufband | Tapis de course incurvé | Cinta curva | Cardio | C-run (tempo, distanza) |
| exercise_bike | Exercise bike | Cyclette | Heimtrainer | Vélo d'appartement | Bicicleta estática | Cardio | C-bike (tempo, distanza, livello) |
| spin_bike | Spin bike | Bici da spinning | Spinning-Rad | Vélo de biking | Bici de spinning | Cardio | C-bike (tempo, distanza, livello) |
| recumbent_bike | Recumbent bike | Cyclette reclinata | Liegeergometer | Vélo semi-allongé | Bicicleta reclinada | Cardio | C-bike (tempo, distanza, livello) |
| air_bike | Air bike | Air bike | Air Bike | Air bike | Air bike | Cardio | C-bike (tempo, distanza) |
| elliptical | Elliptical | Ellittica | Crosstrainer | Vélo elliptique | Elíptica | Cardio | C-run (tempo, distanza, livello) |
| rowing_machine | Rowing machine | Vogatore | Rudergerät | Rameur | Máquina de remo | Cardio | C-row (tempo, distanza, livello) |
| ski_machine | Ski machine | Ski ergometro | Skiergometer | Ergomètre de ski | Ergómetro de esquí | Cardio | C-row (tempo, distanza) |
| stair_climber | Stair climber | Scala | Treppensteiger | Simulateur d'escalier | Escaladora | Cardio | C-time (tempo, piani, livello) |
| stepper | Stepper | Stepper | Stepper | Stepper | Stepper | Cardio | C-time (tempo, livello) |
| vertical_climber | Vertical climber | Climber verticale | Vertikal-Kletterer | Grimpeur vertical | Escalador vertical | Cardio | C-time (tempo) |
| arm_ergometer | Arm bike | Ergometro per braccia | Armergometer | Ergomètre à bras | Ergómetro de brazos | Cardio | C-time (tempo, livello) |
| jump_rope | Jump rope | Salto della corda | Seilspringen | Corde à sauter | Comba | Cardio | C-time (tempo) |

91 esercizi; un nome libero («Add "{name}"») per quello che manca, con il
tipo scelto da chi lo scrive. Le aggiunte al catalogo dopo il task sono righe
nuove qui e nel file del catalogo dell'app.

## Le calorie dei blocchi cardio (parte C)

- Tapis roulant: ACSM della corsa/camminata con velocità e pendenza
  (ADR-0318, punto 2); senza velocità, la distanza sul tempo.
- Cyclette, ellittica, vogatore, scala, stepper e le altre: MET del
  Compendium 2024 per fascia di livello o di velocità, copiati nel codice
  con il codice attività, come bici e paddle.
- Il resto della sessione: il MET del Compendium per l'allenamento con i
  pesi. Quel MET è la media di una sessione con i recuperi dentro, quindi i
  recuperi non si tolgono una seconda volta.
