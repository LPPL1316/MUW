import type { AboutContent, AboutDocument } from "../documents";

/**
 * «Help», «Terms» and «Privacy» in Spanish (TASK-210 F): the same sections
 * as `en.ts`, in the same order (a test compares them). The names of
 * buttons are the ones the app shows in Spanish; the pages as
 * TASK-210 G names them: «Feed», «Dibuja», «Explora». «Terms» and «Privacy» are
 * drafts, as in English, with the same places to fill (the user's choice
 * of 2026-10-07).
 */

const UPDATED = "10 de octubre de 2026";
/** «Privacy» is final since the user approved it (TASK-237 D; without ads, TASK-267 B); dated the day the contacts entered (TASK-262 C). */
const PRIVACY_UPDATED = "31 de octubre de 2026";

const help: AboutDocument = {
  title: "Cómo funciona MuW",
  draft: false,
  updated: null,
  sections: [
    {
      heading: "Qué es MuW",
      blocks: [
        "MuW dibuja rutas reales que trazan una forma en el mapa. Tú eliges la forma, la distancia y dónde empezar; obtienes una ruta por calles reales, con su archivo GPX.",
        "La app tiene cuatro páginas, una al lado de otra, «Feed», «Dibuja», «Explora» y tu perfil: desliza a la izquierda o a la derecha, o toca un nombre arriba. El círculo de arriba te lleva a tu perfil.",
      ],
    },
    {
      heading: "Dibujar una ruta",
      blocks: [
        {
          bullets: [
            "Elige una forma: un corazón, una estrella, un gato y más, una palabra de la A a la Z, o el contorno de una foto tuya.",
            "Fija la distancia: hasta 21 km a pie, desde donde estás o desde cualquier lugar que busques.",
            "Toca «Dibujar la ruta». MuW dibuja hasta tres rutas por calles reales, A, B y C: quédate con la que te guste.",
            "«Exportar GPX» te da el archivo para tu reloj o para otra app.",
          ],
        },
        "Una ruta suele tardar unos segundos; las más largas pueden tardar hasta un minuto.",
      ],
    },
    {
      heading: "Explora",
      blocks: [
        "Rutas ya dibujadas en tu ciudad, listas para empezar: sin esperas, solo tienes que elegir una.",
        "Elige «Cerca de mí», un pueblo cercano o busca una ciudad, y toca una ruta para verla en el mapa.",
      ],
    },
    {
      heading: "Correr una ruta",
      blocks: [
        {
          bullets: [
            "«Empezar» inicia la carrera tras una breve cuenta atrás.",
            "Una voz te anuncia cada giro con antelación. El mapa muestra el tramo que ya has corrido y el que te queda por delante.",
            "«Pausa» detiene el reloj y «Reanudar» lo vuelve a poner en marcha.",
            "Para terminar la carrera, mantén pulsado el botón de stop: un toque corto no la termina.",
          ],
        },
        "«Correr sin ruta» registra tu carrera igualmente, sin ninguna forma que seguir.",
        "Una ruta es una sugerencia hecha con datos del mapa: mantén la vista en la calle y respeta las normas de tráfico.",
      ],
    },
    {
      heading: "Guardar carreras y rutas",
      blocks: [
        "Con una cuenta, «Guardar» al final de una carrera la guarda en «Mis actividades», en «Perfil»; «Descartar» la tira. Sin conexión, la carrera espera en el teléfono y se envía más tarde.",
        "El corazón en una ruta del mapa la guarda en «Favoritos».",
      ],
    },
    {
      heading: "Publicar y compartir",
      blocks: [
        "Una carrera guardada es privada: solo la ves tú. Los demás miembros ven en tu perfil solo los totales de todas tus carreras guardadas, distancia y desnivel, nunca las carreras. Elige «Todos» o «Seguidores» en «Quién puede verla», al final de la carrera o en una carrera de «Mis actividades», y la ven como un dibujo en tu perfil, sin sus primeros y últimos 200 m. La próxima carrera que termines empieza con tu última elección guardada: la ves antes de «Guardar» y puedes cambiarla. Una actividad añadida desde un archivo siempre empieza en «Solo yo».",
        "«Compartir» crea una imagen de tu carrera para enviarla donde quieras.",
      ],
    },
    {
      heading: "Feed y amigos",
      blocks: [
        "«Feed» muestra dibujos de los que sacar ideas: toca uno para abrir su ruta y empezarla.",
        "La lupa de arriba en «Feed» encuentra a otros miembros por su nombre. En un perfil puedes tocar «Seguir»; tus solicitudes, tus seguidores y a quién sigues están en «Perfil».",
        "En el dibujo público de un miembro puedes reaccionar con un emoji, enviar un súper like y escribir un comentario. No se aceptan comentarios negativos.",
      ],
    },
    {
      heading: "Mensajes",
      blocks: [
        "«Mensaje» en el perfil de un miembro le escribe. Si te sigue, tu mensaje llega a sus «Mensajes»; si no, llega como solicitud, y puedes enviar un solo mensaje hasta que la acepte.",
        "Tus conversaciones están en «Perfil», «Mensajes», con «Solicitudes de mensaje» arriba. Acepta una solicitud para escribiros, bórrala (quien escribió no se entera) o bloquea a quien escribió.",
        "Mantén pulsado un mensaje para borrar el tuyo, para los dos, o para denunciar uno que has recibido. Nadie ve si has leído un mensaje. Con las push encendidas, MuW te avisa de cada mensaje y de cada solicitud.",
        "En una conversación, toca + para enviar una foto, un vídeo de hasta 60 segundos o un dibujo, o toca Enviar a amigos en una ruta o un dibujo. Puedes enviarlos cuando la otra persona haya aceptado tu mensaje. Los vídeos se guardan 30 días, o menos cuando nuestro espacio para vídeos se llena: los más antiguos se van primero. Toca un dibujo para abrirlo en el mapa, empezarlo, exportar su GPX o guardarlo en tus favoritos.",
      ],
    },
    {
      heading: "Correr, bici, remo",
      blocks: [
        "Elige tu deporte con el botón junto a tu perfil, o en «Ajustes».",
        {
          bullets: [
            "Correr: hasta 21 km por calles reales, con la voz giro a giro.",
            "Bici: de 10 a 30 km, por carriles bici y calles abiertas a las bicis. Los giros se anuncian con antelación y la pantalla muestra tu velocidad.",
            "Remo: de 1 a 5 km en lagos y en el mar, cerca de la orilla, para tu canoa, kayak o tabla. Sigues la línea del mapa.",
          ],
        },
        "En el agua, lee el aviso de seguridad antes de salir: ponte el chaleco salvavidas, consulta el tiempo y el viento, respeta las normas del lugar. La ruta no se aleja más de 1 km de la orilla: eso no la hace segura ni permitida.",
      ],
    },
    {
      heading: "Ajustes",
      blocks: [
        {
          bullets: [
            "Foto de perfil, correo electrónico y número de teléfono. El número es opcional y solo lo ves tú.",
            "Idioma: English, Deutsch, Italiano, Español o Français. La voz lo sigue.",
            "Mapas sin conexión: el teléfono guarda los mapas de tu alrededor y dibuja las rutas por sí mismo; «Eliminar» libera el espacio.",
            "Unidades: las de tu teléfono, kilómetros o millas. Con millas cambian las distancias, el ritmo y la voz: un aviso en cada milla, los giros en pies.",
            "Notificaciones: tres interruptores. «Notificaciones por correo» y «Notificaciones push» están apagados hasta que los enciendas; «Correo cuando no estoy» está encendido hasta que lo apagues. Con push encendido, y en cuanto tu teléfono lo permita, MuW te avisa al momento de solicitudes para seguirte, solicitudes aceptadas, reacciones, comentarios y etiquetas; al tocar una se abre la publicación o el perfil. Con el correo encendido, las mismas novedades llegan en un correo al día como mucho. «Correo cuando no estoy»: si no abres MuW durante 2 semanas, un correo con las novedades.",
          ],
        },
      ],
    },
    {
      heading: "Tu cuenta",
      blocks: [
        "Te registras con un correo electrónico, un nombre de usuario y una contraseña. Debes tener al menos 16 años.",
        "Todavía no hay forma de recuperar una contraseña olvidada: guarda bien la tuya.",
        "«Cerrar sesión» y «Eliminar cuenta» están al final de «Ajustes». Eliminar la cuenta elimina todo lo que es tuyo, al momento, y no se puede deshacer.",
      ],
    },
    {
      heading: "Preguntas",
      blocks: ["Escribe a [contact email]."],
    },
  ],
};

const terms: AboutDocument = {
  title: "Condiciones de uso",
  draft: true,
  updated: UPDATED,
  sections: [
    {
      heading: "Quién ofrece MuW",
      blocks: [
        "MuW la ofrece [name] («nosotros»). Puedes escribirnos a [contact email].",
        "Estas condiciones son el acuerdo entre tú y nosotros para el uso de la app MuW. Al crear una cuenta o usar la app, las aceptas.",
      ],
    },
    {
      heading: "Qué es MuW",
      blocks: [
        "MuW dibuja rutas que trazan una forma en el mapa, para correr, ir en bici o remar; registra tu actividad mientras las sigues; y permite a los miembros publicar sus dibujos, seguirse, reaccionar y comentar.",
      ],
    },
    {
      heading: "Quién puede usarla",
      blocks: [
        "Debes tener al menos 16 años para crear una cuenta. Para dibujar una ruta no hace falta una cuenta.",
      ],
    },
    {
      heading: "Tu cuenta",
      blocks: [
        {
          bullets: [
            "Te registras con una dirección de correo electrónico, un nombre de usuario y una contraseña. La cuenta es solo tuya: no uses la cuenta de otra persona ni te hagas pasar por otra persona.",
            "Mantén tu contraseña en secreto. Eres responsable de lo que se haga con tu cuenta. Todavía no hay forma de recuperar una contraseña olvidada.",
            "Si añades un número de teléfono, añade solo un número que sea tuyo.",
            "Puedes cerrar sesión o eliminar tu cuenta en cualquier momento desde «Ajustes».",
          ],
        },
      ],
    },
    {
      heading: "Cómo usar MuW",
      blocks: [
        "Usa la app dentro de la ley y con respeto hacia los demás miembros. En particular, no:",
        {
          bullets: [
            "publiques contenido ofensivo, de odio, amenazante o acosador, ni en tu nombre de usuario, biografía, foto, títulos o comentarios;",
            "publiques contenido que no te corresponde publicar, ni datos personales de otras personas sin su permiso;",
            "intentes romper, sobrecargar o eludir el servicio, ni recopiles datos de sus miembros por medios automáticos.",
          ],
        },
      ],
    },
    {
      heading: "Lo que publicas",
      blocks: [
        "Tus carreras, tus dibujos, sus títulos, tu perfil y tus comentarios siguen siendo tuyos.",
        "Al publicarlos nos permites guardarlos y mostrarlos en la app a los demás miembros, solo para hacer funcionar el servicio: un permiso gratuito y no exclusivo que termina cuando eliminas el contenido o tu cuenta.",
        "La app no acepta comentarios con palabras ofensivas: un filtro automático de palabras los rechaza. Podemos retirar contenido que vaya contra estas condiciones. Para avisarnos de un contenido que no debería estar, escribe a [contact email].",
      ],
    },
    {
      heading: "Seguridad",
      blocks: [
        "Una ruta es una sugerencia calculada a partir de datos del mapa. Nadie la ha recorrido por ti, y el mapa puede estar incompleto o desactualizado: una calle puede estar cerrada, ser privada, no tener acera o ser peligrosa.",
        {
          bullets: [
            "Eres responsable de por dónde vas. Respeta las normas de tráfico y las señales, aunque la ruta o la voz digan otra cosa.",
            "Comprueba las condiciones antes y durante tu actividad: tráfico, luz, tiempo, el terreno, tu propia salud y forma física.",
            "No mires el teléfono mientras te mueves entre el tráfico.",
            "En el agua, ten aún más cuidado: ponte el chaleco salvavidas, consulta el tiempo y el viento, respeta las normas del lugar (zonas de baño, canales de embarcaciones, puertos). MuW no las conoce. Una ruta cerca de la orilla no es, por eso, segura ni permitida.",
          ],
        },
        "Las distancias, los tiempos y la velocidad vienen del GPS del teléfono y son estimaciones.",
      ],
    },
    {
      heading: "Sin garantía, y los límites de nuestra responsabilidad",
      blocks: [
        "Trabajamos para que MuW funcione y sus rutas sean buenas, pero la app se ofrece tal como es: no prometemos que esté siempre disponible ni libre de errores, que una ruta se pueda completar ni que sus medidas sean exactas.",
        "En la medida en que la ley lo permita, no somos responsables de los daños que se deriven del uso de la app o de sus rutas. Nada en estas condiciones limita una responsabilidad que la ley no permite limitar, ni los derechos que tienes como consumidor.",
      ],
    },
    {
      heading: "Publicidad",
      blocks: ["MuW no muestra publicidad."],
    },
    {
      heading: "Servicios de otros",
      blocks: [
        {
          bullets: [
            "Los mapas vienen de OpenFreeMap y de los datos de OpenStreetMap (© colaboradores de OpenStreetMap).",
            "Los lugares se buscan con Geoapify.",
            "Si conectas Strava, las carreras que envíes allí siguen las condiciones y los ajustes de privacidad de Strava.",
            "Una imagen que compartes sale por el menú de compartir del teléfono: la app que la recibe tiene sus propias condiciones.",
          ],
        },
      ],
    },
    {
      heading: "Cambios",
      blocks: [
        "Podemos cambiar la app y añadir o quitar lo que hace. Cuando cambiemos estas condiciones cambiaremos la fecha de arriba; si un cambio es importante, lo daremos a conocer antes de que se aplique.",
      ],
    },
    {
      heading: "Cerrar la cuenta",
      blocks: [
        "Puedes dejar de usar MuW y eliminar tu cuenta en cualquier momento: «Privacidad» dice qué se elimina y cuándo. Podemos suspender o cerrar una cuenta que vaya contra estas condiciones.",
      ],
    },
    {
      heading: "Ley aplicable",
      blocks: [
        "Estas condiciones se rigen por [governing law]. Si eres consumidor, conservas las protecciones que la ley del país donde vives no permite dejar de lado.",
      ],
    },
    {
      heading: "Contacto",
      blocks: ["[name] · [contact email]"],
    },
  ],
};

const privacy: AboutDocument = {
  title: "Política de privacidad",
  draft: false,
  updated: PRIVACY_UPDATED,
  sections: [
    {
      heading: "Quién es responsable de tus datos",
      blocks: [
        "El responsable del tratamiento de tus datos personales es Luca Pallaoro. Para cualquier cosa sobre tus datos, escribe a muw2610@gmail.com.",
        "Este texto dice qué datos trata MuW, para qué, dónde se guardan y durante cuánto tiempo, y qué puedes hacer al respecto.",
      ],
    },
    {
      heading: "Sin cuenta",
      blocks: [
        "Puedes dibujar rutas, explorar y correr sin cuenta. La carrera en sí no sale entonces del teléfono. Lo que sí sale del teléfono está en «Rutas que pides», «Tu posición» y «Otros que reciben datos».",
      ],
    },
    {
      heading: "Tu cuenta",
      blocks: [
        {
          bullets: [
            "Tu dirección de correo electrónico y tu nombre de usuario, para dejarte entrar y distinguir las cuentas.",
            "Tu contraseña, guardada solo como hash (Argon2id): nunca guardamos ni vemos la contraseña en sí.",
            "El día en que te registraste y cuándo confirmaste que tienes al menos 16 años.",
            "La sesión de cada teléfono desde el que entraste: el teléfono guarda un token en su almacenamiento seguro, el servidor solo un hash de él. Una sesión termina 90 días después de su último uso, o cuando cierras sesión.",
            "Tus tres elecciones de notificaciones en «Ajustes»: «Notificaciones por correo» y «Notificaciones push», apagadas hasta que las enciendas, y «Correo cuando no estoy», encendida hasta que la apagues. Con push encendido, el token push de tu teléfono, si es un iPhone o un Android y el idioma de la app, para enviarte notificaciones a través del servicio push de Expo, que las pasa a Apple o a Google. Una notificación dice quién hizo qué, con el principio de un comentario. El token se borra cuando apagas push, cierras sesión o borras tu cuenta.",
            "El idioma de la app cuando te registraste, para escribirte nuestros correos en él.",
          ],
        },
        "Tu dirección de correo electrónico nunca se muestra a los demás miembros.",
      ],
    },
    {
      heading: "Los correos de MuW",
      blocks: [
        {
          bullets: [
            "Con «Notificaciones por correo» encendidas, como mucho un correo al día, solo los días con novedades: las solicitudes para seguirte, las solicitudes aceptadas, las reacciones, los comentarios y las etiquetas del día, como las dicen las notificaciones push. Hasta que se envía, nuestro servidor guarda quién hizo qué y en qué publicación, como mucho 7 días; lo que ya no es verdad cuando se escribe queda fuera.",
            "«Correo cuando no estoy»: si no abres MuW durante 2 semanas, un correo con cuántos dibujos nuevos hay de las personas que sigues, con hasta tres de sus nombres de usuario, o si no en el Feed. Uno por ausencia: el siguiente solo después de que vuelvas y te vayas otra vez. Está encendido para cada miembro, también para quienes se registraron antes de este texto; puedes decir que no al registrarte, en «Ajustes» o con el enlace del correo.",
            "Cada correo tiene el enlace «No me envíes más estos correos», que apaga ese correo. Los enviamos a través de Resend, desde una dirección de getmuw.app.",
            "Los correos que tu cuenta necesita, que ningún interruptor apaga: uno para confirmar tu dirección cuando te registras o la cambias, un aviso a tu dirección antigua cuando la cambias, y un enlace para una contraseña nueva cuando lo pides.",
          ],
        },
      ],
    },
    {
      heading: "Tu número de teléfono (opcional)",
      blocks: [
        "Puedes añadir un número de teléfono en «Ajustes». Es opcional: la app funciona igual sin él.",
        "Es privado: solo lo ves tú. Nunca está en tu perfil, en la búsqueda ni en ninguna lista. Está para que los amigos que tienen tu número en los contactos de su teléfono puedan encontrar tu cuenta (ver «Amigos de tus contactos»).",
        "No comprobamos el número ni le enviamos mensajes. Puedes quitarlo en cualquier momento desde «Ajustes»; se elimina con la cuenta.",
      ],
    },
    {
      heading: "Amigos de tus contactos",
      blocks: [
        "Bajo la lupa arriba de «Feed», «Buscar amigos en tus contactos» busca a los miembros cuyo número está en los contactos de tu teléfono. La app pide los contactos al teléfono solo cuando lo tocas, y lee solo sus números de teléfono: nunca nombres, correos ni fotos.",
        "Cada número sale del teléfono cifrado: escrito con el prefijo del país y convertido en un hash (SHA-256). Nuestro servidor compara los códigos con los de los números que añadieron los miembros, responde con los miembros encontrados y no conserva nada de lo recibido: ni en la base de datos ni en un registro.",
        "El hash de un número de teléfono no es un secreto: quien tuviera los códigos podría volver a encontrar los números probando todos los números posibles. Por eso la verdadera protección es que nuestro servidor no conserva ninguno; solo viajan por la conexión cifrada.",
        "Los números de tus contactos son datos de otras personas: se comparan una vez, para encontrar cuentas, y se olvidan. Para impedir que alguien pruebe números uno a uno, el servidor cuenta las búsquedas de cada cuenta en una hora, solo en memoria. Solo se puede encontrar a quien añadió su número, y nunca a alguien que bloqueaste o que te bloqueó.",
      ],
    },
    {
      heading: "Tu perfil",
      blocks: [
        "Tu nombre de usuario, tu biografía y tu foto de perfil son lo que los demás miembros ven de ti. La foto se guarda como una pequeña imagen cuadrada, sin los datos que le añade la cámara. Cualquiera con una cuenta puede buscar a los miembros por nombre de usuario.",
      ],
    },
    {
      heading: "Tus carreras y sus recorridos GPS",
      blocks: [
        "Con una cuenta, cuando tocas «Guardar» al final de una carrera, la carrera entera va a nuestro servidor: cada posición con su hora y su altura, las pausas, la ruta que seguiste, distancia, duración, una puntuación de cuánto sigue la traza a la ruta (calculada por nuestro servidor y no mostrada en la app) y el nombre del lugar. Con «Descartar» no se envía nada.",
        "Una carrera guardada es privada, salvo que elijas otra cosa: solo la ve tu cuenta. Los demás miembros ven en tu perfil solo los totales de todas tus carreras guardadas, distancia y desnivel, nunca las carreras. Se queda hasta que la eliminas de «Mis actividades» o eliminas tu cuenta.",
        "Si añades una actividad pasada desde un archivo, guardamos su recorrido y sus horas como los de una carrera registrada con MuW. No guardamos el archivo.",
        "Una carrera a menudo empieza y termina en tu puerta. Por eso una carrera solo es visible para los demás miembros después de que elijas «Todos» o «Seguidores» en «Quién puede verla», y entonces ven el recorrido sin sus primeros y últimos 200 m, con el título que le diste, y sin tiempos, pausas ni la ruta prevista. Tu elección se queda en este teléfono para la siguiente carrera: empieza con la última guardada, la ves antes de «Guardar» y puedes cambiarla. Una actividad añadida desde un archivo siempre empieza en «Solo yo».",
        "Quien puede ver una de tus carreras también puede seguirla con «Empezar» y guardar ese mismo recorrido como archivo GPX: siempre sin sus primeros y últimos 200 m y sin tiempos.",
      ],
    },
    {
      heading: "Favoritos, comentarios, reacciones y seguimientos",
      blocks: [
        {
          bullets: [
            "Una ruta que guardas en «Favoritos» se almacena entera, con su línea, que a menudo empieza cerca de tu casa. Solo la ve tu cuenta, hasta que la quitas o eliminas la cuenta.",
            "Tus comentarios y reacciones bajo un dibujo los ven los miembros que ven ese dibujo. Puedes eliminar tus propios comentarios.",
            "A quién sigues, quién te sigue y las solicitudes para seguir se guardan con tu cuenta.",
          ],
        },
      ],
    },
    {
      heading: "Mensajes privados",
      blocks: [
        "Tus mensajes privados se guardan en nuestro servidor: quién escribió, a quién, el texto y cuándo, y para cada uno de los dos si aceptó la conversación, cuándo la leyó por última vez y hasta cuándo la quitó de su vista. No están cifrados de extremo a extremo. En la app una conversación solo la ven sus dos miembros, y nadie recibe aviso de si un mensaje se ha leído. Los guardamos para darte el servicio que pides (contrato).",
        "Un mensaje puede llevar una foto, un vídeo o un dibujo. Una foto se guarda reducida, sin los datos que tu teléfono le añade, como dónde y cuándo se hizo. Un vídeo se guarda como lo envía tu teléfono, sin el lugar donde se grabó, y se borra 30 días después de enviarlo, o antes, los más antiguos primero, cuando nuestro espacio para vídeos se llena. Un dibujo es una copia de la ruta: una carrera que envías va recortada al principio y al final como en el Feed, una ruta que planeas va entera, con su salida. Las fotos y los vídeos no están cifrados de extremo a extremo, no están en nuestras copias de seguridad y se borran con su mensaje, la conversación o tu cuenta. Cuando denuncias un mensaje, la persona que gestiona MuW ve también su foto, su vídeo o su dibujo.",
        "Un mensaje a alguien que no te sigue llega como solicitud; el primer mensaje de una solicitud pasa por el mismo filtro de palabras que los comentarios.",
        "Puedes borrar tus propios mensajes, para los dos. Borrar una conversación la quita de tu vista; un mensaje que ya no ve ninguno de los dos se borra. Un bloqueo borra la conversación; borrar tu cuenta borra todas tus conversaciones, con los mensajes de los dos.",
        "Cuando denuncias un mensaje, el correo a la persona que gestiona MuW contiene solo ese mensaje, nunca el resto de la conversación. Con las push encendidas, la notificación de un mensaje lleva su comienzo, a través del servicio push de Expo y de Apple o Google, como con los comentarios.",
      ],
    },
    {
      heading: "Denuncias",
      blocks: [
        "Cuando denuncias un dibujo, un comentario o un perfil, guardamos quién denunció qué, el motivo y cuándo. Quien gestiona MuW la recibe por correo y puede ocultar lo denunciado a los demás miembros. No se borra nada, y su autor lo sigue viendo. Tu denuncia nunca se muestra al autor.",
      ],
    },
    {
      heading: "Carreras en grupo",
      blocks: [
        "Si creas una carrera en grupo o dices que vas, los miembros que pueden verla ven tu nombre, tu foto y que vas. Cuando eliminas tu cuenta, eliminamos tus carreras en grupo y tus respuestas.",
      ],
    },
    {
      heading: "Comentarios",
      blocks: [
        "Cuando nos escribes desde «Envíanos tus comentarios» en «Ajustes», guardamos tu mensaje, la versión de la app, el sistema de tu teléfono (iOS o Android) y cuándo lo enviaste. Quien gestiona MuW lo recibe por correo con tu nombre de usuario y tu dirección de correo, para leerlo y, si hace falta, responderte por correo. Nunca se muestra a los demás miembros. Cuando eliminas tu cuenta, tus mensajes se eliminan con ella de nuestro servidor.",
      ],
    },
    {
      heading: "El juego de las formas",
      blocks: [
        "Con una cuenta, nuestro servidor calcula a partir de tus carreras a pie guardadas cuántos kilómetros cuentan para el juego, tus mejores tiempos en 1, 5, 10 y 21,1 km y las formas que has coleccionado. Solo tú ves tu colección y tus mejores tiempos. Si te unes a un equipo, sus miembros ven tu nombre de usuario, tu foto, las piezas de un reto que tomaste y los kilómetros que diste a cada una, nunca tus trazados, los tiempos de tus carreras ni dónde corriste. A un equipo solo se llega con su código: nunca está en una búsqueda. Borrar una carrera quita sus kilómetros del recuento, y las formas que ya coleccionaste se quedan. Cuando eliminas tu cuenta, tus datos del juego se eliminan con ella; en los retos de un equipo, las piezas que corriste se quedan para los demás, sin tu nombre.",
      ],
    },
    {
      heading: "Rutas que pides",
      blocks: [
        "Para dibujar una ruta, la app envía a nuestro servidor el inicio, la forma o la palabra y la distancia. Cuando el teléfono tiene el mapa sin conexión de la zona, dibuja la ruta por sí mismo.",
        "Las rutas que dibuja nuestro motor se quedan en nuestro servidor sin quién las pidió, para responder al momento a quien pida el mismo dibujo cerca y para recomendarlas; contamos cuántas carreras y favoritos sigue cada una. Una ruta empieza donde se pidió, a menudo cerca de la casa de alguien, pero nunca dice quién la pidió ni quién la corrió.",
        "Los mapas sin conexión vienen de nuestro servidor: el de tu alrededor y, con antelación, los de los pueblos cercanos. Para limitar estas descargas, el servidor las cuenta por día, según un número anónimo que la app crea para el teléfono; la cuenta se guarda solo en memoria.",
        "Las palabras que describen una forma se leen en nuestro servidor y no se envían a ningún servicio de IA externo.",
        "Una foto que eliges para un dibujo va una vez a nuestro servidor, para encontrar su contorno: el servidor no la guarda ni la registra.",
        "Una figura dibujada con el dedo, o el contorno de tu foto, va a nuestro servidor una vez, como la ruta que pides: el servidor no la guarda.",
        "Para mejorar la búsqueda guardamos un evento por cada búsqueda y por algunos usos de la app (una ruta elegida, un archivo GPX exportado, una carrera puntuada): el texto en minúsculas, como máximo 200 caracteres, con los correos y los números largos ocultos; las posiciones solo como cuadrados de alrededor de 1 km; nada que diga quién eres ni qué teléfono era. Estos eventos se guardan sin límite de tiempo.",
      ],
    },
    {
      heading: "Tu posición",
      blocks: [
        "La posición del teléfono se usa en el teléfono, para empezar una ruta donde estás y para seguir tu carrera. Va a nuestro servidor exacta como inicio de una ruta que pides, como inicio de las formas que la app te prepara cerca cuando el teléfono no puede dibujarlas por sí mismo, y dentro de una carrera que guardas. Va redondeada a cerca de 1 km para encontrar el mapa sin conexión a tu alrededor, las rutas recomendadas, los pueblos y los dibujos cercanos, y para poner primero los lugares cercanos en una búsqueda; así redondeada no queda ligada a tu cuenta.",
        "En iPhone, durante una carrera que has empezado, la app sigue tu posición también con el teléfono bloqueado o con otra app abierta, hasta que detienes la carrera; el iPhone lo muestra con una marca azul en la parte de arriba de la pantalla. MuW pide la posición solo mientras usas la app, nunca «Siempre».",
        "Como cualquier servicio de internet, nuestro servidor ve la dirección de internet (IP) de la que viene una petición mientras la responde. El registro del servidor no escribe posiciones, y la base de datos no guarda direcciones IP.",
        "Existe un registro de las peticiones de rutas, con su inicio, para reproducir un fallo. Está apagado en nuestro servidor; encendido, guarda como máximo 10 MB, y después se pierden las líneas más antiguas.",
      ],
    },
    {
      heading: "Publicidad",
      blocks: [
        "MuW no muestra anuncios ni usa ningún servicio de publicidad: nada sobre ti va a una red publicitaria, y la app nunca pide rastrearte a través de otras apps.",
      ],
    },
    {
      heading: "Strava",
      blocks: [
        "Una carrera va a Strava solo cuando lo pides, y solo después de que hayas conectado tu perfil de Strava. Mientras está conectado, nuestro servidor guarda tu nombre de Strava y las claves que Strava nos dio para tu perfil. Luego enviamos a Strava el recorrido con sus tiempos, el nombre y una línea de descripción. A Strava solo le pedimos permiso para añadir actividades, nunca para leer las tuyas. En Strava la actividad sigue tus ajustes de privacidad de Strava, no los de MuW.",
      ],
    },
    {
      heading: "Otros que reciben datos",
      blocks: [
        {
          bullets: [
            "Hetzner aloja nuestro servidor y sus copias de seguridad, en Alemania.",
            "Geoapify recibe las búsquedas de lugares, de pueblos cercanos y de los lugares de una ruta temática, con la posición redondeada a cerca de 1 km, y, para nombrar el lugar de una carrera guardada, su inicio redondeado igual: nunca tu puerta, la carrera ni quién eres. Si nuestro servidor no responde, la búsqueda de un lugar va entonces a Photon (komoot).",
            "OpenFreeMap sirve el mapa: como cualquier servicio de mapas, ve qué zona miras.",
            "Wikimedia da a nuestro servidor las fotos de los pueblos: ve qué pueblo, no quién pregunta.",
            "Con el mapa «Satélite» Esri da las imágenes, y con el mapa «3D» Amazon Web Services da las alturas: como cualquier servicio de mapas, ven qué zona miras.",
            "Nuestro servidor pide al servicio Overpass de datos de OpenStreetMap el mapa de una zona que aún no tiene: ve qué zona, no quién la pidió.",
            "unpkg sirve la biblioteca del mapa cuando arranca la app.",
            "Expo sirve las actualizaciones de la app.",
            "Google Ireland Limited (Firebase Cloud Messaging), para entregar las notificaciones push a los teléfonos Android. Cuando enciendes push, la app pide a Firebase un token de registro para tu teléfono; el servicio push de Expo pasa cada notificación (quién hizo qué, y el principio de un comentario) a Google, que la entrega a tu teléfono. Google ve el token y el contenido de cada notificación, no tu cuenta ni tu posición. El token se quita de nuestro servidor cuando apagas push, cierras sesión o borras tu cuenta; el del teléfono se va cuando desinstalas la app.",
            "Resend, en Estados Unidos, envía los correos de MuW: tu dirección de correo con el correo mismo. En una denuncia lleva a quien gestiona MuW lo denunciado, su texto, el motivo y los nombres de usuario de quien lo denunció y de quien lo escribió. En «Envíanos tus comentarios» lleva tu mensaje, tu nombre de usuario y tu dirección de correo.",
            "Strava, como se ha dicho arriba.",
          ],
        },
        "Una imagen o un vídeo de tu carrera hechos con «Compartir» se crean en el teléfono y solo salen de él por el menú de compartir, hacia donde los envíes. El vídeo muestra el mapa alrededor de tu carrera, sin sus primeros y últimos 200 metros.",
      ],
    },
    {
      heading: "Dónde están tus datos y durante cuánto tiempo",
      blocks: [
        {
          bullets: [
            "En nuestro servidor en Alemania, mientras tengas la cuenta.",
            "Cuando eliminas tu cuenta, todo lo que es tuyo se elimina al momento: perfil, foto, número de teléfono, carreras, dibujos, favoritos, comentarios, reacciones, seguimientos, datos del juego y las novedades que esperan tu correo. Las rutas que dibujó nuestro motor se quedan: no dicen nada de quién las pidió.",
            "Cada noche se hace una copia de seguridad de la base de datos y se guarda 13 días: una cuenta eliminada sale de todas las copias en 14 días como máximo.",
            "En tu teléfono: la sesión, tus elecciones (idioma, deporte, lagos o mar), los mapas sin conexión, las carreras que aún esperan para enviarse y, con una cuenta, la zona desde la que suelen empezar tus actividades, para sugerirte lagos y mar cerca; se borra al cerrar sesión.",
          ],
        },
        "La conexión entre la app y nuestro servidor está cifrada (HTTPS).",
      ],
    },
    {
      heading: "Por qué podemos usar tus datos",
      blocks: [
        {
          bullets: [
            "Para darte el servicio que pides (contrato): tu cuenta, tu perfil, las rutas que pides, y las carreras, favoritos, comentarios, reacciones y seguimientos que guardas, los correos de las notificaciones que encendiste, y el juego de las formas.",
            "Nuestro interés legítimo en que MuW funcione, sea segura y mejore: los registros breves del servidor, los recuentos que limitan las descargas de mapas y los eventos de búsqueda, que no dicen nada de quién eres; la comparación de los números de tus contactos, que no conserva ninguno; el correo cuando no estás, que puedes rechazar al registrarte, en «Ajustes» o en cada correo; los correos de las denuncias, para que MuW sea segura; el archivo de las rutas dibujadas, que no dice nada de quién eres; los mensajes de «Envíanos tus comentarios», para leerlos y responderte.",
            "Tu consentimiento: el número de teléfono que decides añadir y la conexión con Strava. Puedes retirar un consentimiento en cualquier momento; lo que se hizo antes sigue siendo lícito.",
            "Una obligación legal, cuando una ley nos pide conservar o entregar datos.",
          ],
        },
      ],
    },
    {
      heading: "Tus derechos",
      blocks: [
        "Puedes, en cualquier momento:",
        {
          bullets: [
            "ver y corregir tus datos: nombre de usuario, biografía y foto en «Perfil», correo y número de teléfono en «Ajustes»;",
            "eliminar una carrera de «Mis actividades», un favorito, un comentario o la cuenta entera desde «Ajustes», «Eliminar cuenta»;",
            "pedirnos una copia de tus datos, o que dejemos de usarlos o limitemos un uso;",
            "retirar un consentimiento que hayas dado;",
            "apagar cualquier correo en «Ajustes» o con su enlace;",
            "presentar una reclamación ante la autoridad de protección de datos de tu país (en Italia, el Garante per la protezione dei dati personali).",
          ],
        },
        "Para lo que no puedas hacer desde la app, escribe a muw2610@gmail.com.",
      ],
    },
    {
      heading: "Menores",
      blocks: [
        "Las cuentas de MuW son para personas de al menos 16 años. Si crees que alguien más joven tiene una cuenta, escríbenos y la eliminaremos.",
      ],
    },
    {
      heading: "Cambios en este texto",
      blocks: [
        "Cuando este texto cambie, cambiaremos la fecha de arriba; si un cambio es importante, lo daremos a conocer antes de que se aplique.",
      ],
    },
    {
      heading: "Contacto",
      blocks: ["Luca Pallaoro · muw2610@gmail.com"],
    },
  ],
};

export const ES: AboutContent = { help, terms, privacy };
