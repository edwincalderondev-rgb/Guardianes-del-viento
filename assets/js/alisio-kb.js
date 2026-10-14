/* ==========================================================================
   ALISIO — base de conocimiento
   --------------------------------------------------------------------------
   Única fuente de lo que el asistente sabe y de cómo lo dice. Para enseñarle
   algo nuevo se edita SOLO este archivo; alisio.js no se toca.

   Va como .js (window.ALISIO_KB) y no como .json a propósito: un fetch() de
   JSON falla al abrir la página como archivo local (file://), y el sitio debe
   funcionar sin red el día de la sustentación.

   REGLA DE ORO DEL CONTENIDO (la fija el propio documento fuente)
   · El asistente no presenta proyecciones ni metas como resultados
     alcanzados: todas las cifras son metas y supuestos de planeación que
     deben validarse en el piloto. Cada respuesta conserva sus condiciones y
     sus límites.
   · Las entradas q1…q20 son las 20 preguntas de «Preguntas técnicas para
     inversionistas y chatbot». Su respuesta va TEXTUAL: se puede partir en
     párrafos y resaltar cifras con <strong>, nunca reescribirla.
   · El resto de entradas solo usa información del informe del proyecto, del
     guion del tráiler o de esa misma base. Si un dato no está allí, no se
     escribe: no hay universidad, programa ni datos de contacto publicados.
     Los autores (Paola Andrea Guardiola Núñez, Luis Arturo Flechas Robles y
     Carlos Humberto Loza Arenas) y el origen de las fotos de campo (La
     Guajira) los confirmó el responsable del sitio el 2026-10-14.

   ANATOMÍA DE UNA ENTRADA
     id     Identificador único.
     cat    Categoría (meta.categories). Decide en qué tema del menú aparece.
     n      Solo q1…q20: número de la pregunta en el documento fuente.
     title  Título corto; encabeza la respuesta.
     ask    La misma intención dicha como pregunta breve. Es lo que se lee en
            los botones de sugerencia y lo que queda como mensaje del usuario
            al pulsarlos.
     q      Solo q1…q20: la pregunta textual del documento.
     p      FRASES (peso alto). Si la pregunta contiene la frase completa, la
            entrada gana casi seguro; cuantas más palabras tiene la frase, más
            pesa. Una frase que empieza por «=» solo cuenta si es la pregunta
            ENTERA: sirve para expresiones genéricas («=de qué se trata») que
            dentro de otra pregunta no significan nada.
     k      PALABRAS sueltas (peso medio), separadas por espacios.
     a      Respuesta en HTML: <p> <ul> <ol> <li> <strong> <em>, la lista de
            pares <dl class="al-kv"> y la salvedad <p class="al-note">.
     see    Anclas de la página para «Ver en la página» (meta.sections).
     next   Dos o tres id de entradas con las que seguir.

   Las frases y las palabras se escriben SIN tildes y en minúscula; el motor
   normaliza igual lo que escribe la persona. Singular y plural se reconocen
   solos («riesgo» / «riesgos», «actor» / «actores»).

   Al agregar una entrada es fácil que dos compitan por las mismas palabras.
   Se comprueba en la consola del navegador:
       Alisio.match('cuánto cuesta el piloto')   → ranking con puntajes
       Alisio.probe('hola, ¿qué riesgos hay?')   → además dice si contestaría
                                                    la capa de charla
   ========================================================================== */

window.ALISIO_KB = {
  meta: {
    version: '1.2',
    updated: '2026-10-14',

    /* Los cuatro bloques del documento fuente. «sitio» no sale en el menú:
       agrupa lo que no es del informe sino de la página (tráiler, imágenes,
       referencias) y lo que el material no publica. */
    categories: [
      { id: 'fundamento', label: 'Fundamento del proyecto', short: 'Fundamento' },
      { id: 'solucion', label: 'Solución técnica y datos', short: 'Solución y datos' },
      { id: 'finanzas', label: 'Clientes, inversión y sostenibilidad financiera', short: 'Clientes e inversión' },
      { id: 'riesgos', label: 'Riesgos, impacto y escalamiento', short: 'Riesgos e impacto' },
      { id: 'sitio', label: 'El tráiler y este sitio', short: 'Tráiler y sitio', menu: false }
    ],

    /* Entrada que acompaña a los cuatro bloques en la fila de temas. */
    featured: 'cifras',

    /* Anclas de index.html y el nombre con el que se enlazan. Un ancla que
       no exista en la página simplemente no se pinta. */
    sections: {
      trailer: 'El tráiler',
      cifras: 'Cifras clave',
      riesgo: 'El riesgo',
      solucion: 'La solución',
      servicio: 'Cómo funciona',
      tecnologia: 'Tecnología',
      cambio: 'Teoría de cambio',
      seleccion: 'Selección de la idea',
      impacto: 'Impacto 2030',
      modelo: 'Modelo de negocio',
      piloto: 'El piloto',
      gobernanza: 'Gobernanza',
      controles: 'Riesgos y controles',
      inversion: 'Inversión',
      finanzas: 'Lectura financiera',
      territorio: 'Territorio',
      preguntas: 'Preguntas',
      propuesta: 'La propuesta',
      referencias: 'Referencias'
    }
  },

  /* ------------------------------------------------------------------------
     VOZ — cómo se presenta y cómo responde cuando no hay una entrada clara.
     Donde hay varias versiones se elige una al azar sin repetir la anterior.
     Marcadores: {saludo} (buenos días / buenas tardes / buenas noches según
     la hora de quien escribe) y {q} (la pregunta recibida).
     ------------------------------------------------------------------------ */
  persona: {
    welcome: `
      <p>{saludo}. Soy <strong>Alisio</strong>, el asistente de Guardianes del Viento.</p>
      <p>Los alisios son los vientos constantes del nordeste que mueven los parques eólicos de La Guajira. Como ellos, mi trabajo es que la evidencia llegue primero.</p>
      <p>Pregunte con sus palabras o elija un tema. Respondo únicamente con lo que el proyecto ha publicado.</p>`,
    starters: ['que-es', 'q13', 'q17'],

    /* Cuando la pregunta viene envuelta en cortesía («¿me podría decir…?»)
       y hay una respuesta segura. */
    leads: ['Con gusto.', 'Claro.', 'Por supuesto.'],

    /* Cuando hay una respuesta probable, pero no segura. */
    hedges: [
      'No estoy seguro de haber entendido bien su pregunta. Esto es lo más cercano que tengo:',
      'Puede que no sea exactamente lo que busca; lo más parecido que encuentro es esto:',
      'Le respondo con lo más próximo que hay publicado:'
    ],

    /* Cuando no sabe: lo admite, propone los temas cercanos y remite a la
       página. No existe un asesor al que derivar. */
    unknown: [
      'Eso no lo encuentro en la información publicada del proyecto.',
      'No tengo una respuesta para «{q}»: no figura en el material publicado.',
      'Esa se me escapa: «{q}» no aparece en lo que el proyecto ha publicado.'
    ],
    unknownNear: 'Lo más cercano que tengo es esto:',
    unknownFar: 'Puede plantearla con otras palabras o empezar por uno de estos temas:',
    unknownNote: 'También puede elegir uno de los cuatro bloques de preguntas en la fila de temas, o revisar las referencias de la página.',
    unknownSee: ['cifras', 'referencias'],
    fallback: ['que-es', 'cifras', 'q13', 'q16']
  },

  /* ------------------------------------------------------------------------
     SINÓNIMOS — la clave es la palabra que usan las entradas; los valores,
     otras formas en que la gente la escribe. Solo palabras SUELTAS: el motor
     compara palabra por palabra, así que un valor con espacios no coincidiría
     nunca (una expresión de varias palabras va en la «p» de su entrada).
     Los plurales no hacen falta. Las siglas y palabras de menos de cinco
     letras no pasan por el corrector de erratas: sus variantes van aquí.
     ------------------------------------------------------------------------ */
  synonyms: {
    costo: ['cuesta', 'cuestan', 'costaria', 'costara', 'vale', 'valdria', 'coste'],
    dinero: ['plata', 'fondos', 'billete', 'capital'],
    tarifa: ['precio', 'cobran', 'cobra', 'cobraria', 'cobrarian', 'mensualidad'],
    inversion: ['invertir', 'invierta', 'invierto', 'invierte', 'invierten', 'invertiria', 'invertido'],
    inversionista: ['inversor', 'aportante', 'financiador', 'donante'],
    ganar: ['gana', 'ganan', 'gano', 'ganaria', 'ganarian'],
    excedente: ['ganancias', 'ganancia', 'utilidades', 'superavit'],
    pagar: ['paga', 'pagan', 'pago', 'pagaran', 'pagaria', 'pagarian'],
    riesgo: ['peligro', 'peligros'],
    amenaza: ['amenazan', 'amenacen', 'amenazados', 'intimidacion', 'violencia'],
    alerta: ['alarma', 'aviso'],
    medir: ['mide', 'miden', 'medira', 'mediran', 'medicion', 'mediciones'],
    validar: ['valida', 'validan', 'validacion', 'validador'],
    publicar: ['publica', 'publican', 'publique', 'publiquen', 'publicacion', 'divulgar', 'difundir'],
    gobernanza: ['gobernar', 'gobierna', 'gobiernan', 'governanza'],
    tecnologia: ['tecnologico', 'tecnologica', 'tecnologicos', 'tecnologicas', 'herramienta'],
    dron: ['drones', 'drone'],
    satelite: ['satelital', 'satelites', 'satelitales'],
    ia: ['ai'],
    video: ['trailer', 'pelicula', 'audiovisual', 'corto'],
    referencia: ['bibliografia', 'fuentes', 'fuente'],
    universidad: ['academia', 'facultad'],
    contacto: ['contactar', 'contactarlos', 'contactarme', 'contactan'],
    correo: ['email', 'mail'],
    autor: ['autora', 'autores', 'autoras', 'creador', 'creadora', 'tesista'],
    independencia: ['imparcial', 'imparcialidad', 'neutral', 'neutralidad', 'autonomia'],
    wayuu: ['wayu', 'guayu', 'guayuu', 'indigena', 'indigenas'],
    comunidad: ['comunitario', 'comunitaria', 'comunitarios', 'comunitarias'],
    monitor: ['monitores'],
    mujer: ['mujeres', 'femenina', 'genero'],
    joven: ['jovenes', 'juventud'],
    empleo: ['trabajo', 'trabajos', 'puestos'],
    foto: ['fotos', 'fotografia', 'fotografias', 'imagen', 'imagenes'],
    idioma: ['lengua', 'lenguaje'],
    retorno: ['rendimiento', 'roi'],
    meta: ['objetivo', 'objetivos'],
    escenario: ['escenarios'],
    indicador: ['indicadores', 'kpi', 'kpis']
  },

  /* ------------------------------------------------------------------------
     CHARLA — lo que alguien escribe sin que sea todavía una pregunta sobre el
     proyecto: saludar, agradecer, preguntar con quién habla. Aquí no va ni un
     dato del proyecto; es solo la forma de conversar mientras se llega a él.

       id     Lo imprime Alisio.probe().
       re     Expresión regular en TEXTO, probada contra la pregunta ya
              normalizada (minúsculas, sin tildes ni signos): se escribe sin
              tildes.
       a      Respuesta HTML; si es una lista, se rota. Marcadores: {saludo},
              {hora}, {fecha} y {tema} (el título de la última respuesta).
       next   id de entradas sugeridas.   see   anclas de la página.
       max    Máximo de palabras del mensaje para que la regla pueda ganar.
       weak   Solo gana si la base no reconoció NINGÚN tema. Obligatorio en
              las reglas de palabras amplias («puede», «necesito»): sin esto,
              «¿me puede decir cuánto cuesta el piloto?» recibiría un «con
              gusto, dígame» en vez del costo.
       force  Gana siempre. Solo para lo que no puede ser otra cosa («¿cómo
              se llama usted?»).
       ctx    Necesita una respuesta anterior: {tema}, sus enlaces y sus
              sugerencias salen de ella. Es lo que hace funcionar un
              «cuénteme más» a secas.

     Sin weak ni force, una regla gana solo si la base no está segura: así
     «hola, ¿cuánto cuesta el piloto?» responde el costo y no un saludo.
     ORDEN: gana la primera que coincide; las concretas van arriba.
     ------------------------------------------------------------------------ */
  smalltalk: [
    {
      id: 'nombre',
      force: true,
      re: '\\b(como te llamas|como se llama usted|como se llama (el|este) (asistente|chat|bot)|cual es (tu|su) nombre|(por que|de donde) .*\\balisio|que significa alisio|que (es|son) (un |el |los )?alisios?|quien es alisio|vientos alisios)\\b',
      a: `
        <p>Me llamo <strong>Alisio</strong>. Los alisios son los vientos constantes del nordeste que mueven los parques eólicos de La Guajira.</p>
        <p>Como ellos, mi trabajo es que la evidencia llegue primero: ese es el lema del proyecto.</p>`,
      next: ['que-es', 'lema']
    },
    {
      id: 'identidad',
      force: true,
      max: 10,
      re: '\\b((eres|sos|es usted|usted es|hablo con|estoy hablando con) (un |una |algun |alguna )?(ia|ai|bot|robot|chatbot|humano|humana|persona|maquina|programa|chatgpt|gpt|inteligencia artificial|real|alguien)|hay alguien ahi|(usas|usa usted|alisio usa|funcionas con|funciona usted con) (ia|inteligencia artificial))\\b',
      a: `
        <p>Soy un programa, no una persona. Y conviene decirlo con precisión: detrás no hay un modelo de inteligencia artificial ni una conexión a internet.</p>
        <p>Respondo por coincidencia de palabras con una base de preguntas y respuestas tomada del informe del proyecto. Por eso no opino ni improviso: si algo no está publicado, se lo digo.</p>`,
      next: ['que-es', 'referencias']
    },
    {
      id: 'capacidades',
      force: true,
      re: '\\b(que puedes hacer|que sabes( hacer)?|en que (me )?puedes ayudar(me)?|en que (me )?puede ayudar(me)?|para que sirves|como funcionas|como funciona (este|el) (chat|asistente|bot)|como funciona alisio|que (te|le) puedo preguntar|que puedo preguntar(te|le)?|de que puedes hablar|que temas (conoces|manejas|tienes))\\b|^que puede hacer( usted)?$|^que sabe( usted)?$',
      a: `
        <p>Soy el asistente de este sitio. Respondo preguntas sobre Guardianes del Viento con lo que está escrito en el informe del proyecto, en el guion del tráiler y en su base de preguntas para inversionistas.</p>
        <p>Puede consultarme, por ejemplo:</p>
        <ul>
          <li>el problema y la solución propuesta;</li>
          <li>la tecnología, los datos y quién los gobierna;</li>
          <li>clientes, inversión y escenarios financieros;</li>
          <li>riesgos, impacto esperado y condiciones para escalar.</li>
        </ul>
        <p>No opino ni invento: si un dato no está publicado, se lo digo.</p>`,
      next: ['que-es', 'cifras', 'q16']
    },
    {
      id: 'saludo',
      max: 6,
      re: '^(hola+|buenas|buen dia|buenos dias|buenas tardes|buenas noches|saludos|hey|hello|hi)\\b',
      a: [
        `<p>{saludo}. Soy <strong>Alisio</strong>, el asistente de Guardianes del Viento.</p>
         <p>Puede preguntarme por el problema que aborda el proyecto, cómo funciona el servicio, cuánto cuesta el piloto o qué riesgos tiene. ¿Por dónde empezamos?</p>`,
        `<p>{saludo}, y bienvenido. Aquí <strong>Alisio</strong>.</p>
         <p>Escríbame su pregunta con sus palabras; busco la respuesta en lo que el proyecto ha publicado.</p>`
      ],
      next: ['que-es', 'cifras', 'q13']
    },
    {
      id: 'como-esta',
      max: 7,
      re: '\\b(como estas?|como le va|como te va|como va todo|todo bien)\\b|^que tal( estas?)?$',
      a: `
        <p>Bien, gracias: con viento constante, como corresponde a un alisio.</p>
        <p>¿Qué le gustaría revisar del proyecto?</p>`,
      next: ['que-es', 'cifras']
    },
    {
      id: 'gracias',
      max: 8,
      re: '\\b(gracias|muy amable|se lo agradezco|te lo agradezco|agradecido|agradecida)\\b',
      a: [
        '<p>Con gusto. Si surge otra pregunta sobre el proyecto, aquí estaré.</p>',
        '<p>A usted. Cuando quiera, retomamos.</p>',
        '<p>Para eso estoy. ¿Revisamos algo más?</p>'
      ]
    },
    {
      id: 'despedida',
      re: '^(chao|adios|hasta luego|hasta pronto|nos vemos|bye|eso es todo|eso seria todo|es todo)\\b',
      a: [
        '<p>Hasta pronto. Que la evidencia llegue primero.</p>',
        '<p>Que le vaya bien. Aquí quedo por si vuelve con otra pregunta.</p>'
      ]
    },
    {
      id: 'elogio',
      max: 8,
      re: '\\b(excelente|muy bien|buen trabajo|bien hecho|genial|increible|me gusta|que bien|felicitaciones|felicidades|buena pagina|linda pagina|bonita pagina|que bonito|muy util|impresionante)\\b',
      a: [
        '<p>Gracias. El mérito es del proyecto; yo solo acerco lo que está escrito.</p>',
        '<p>Muy amable. ¿Seguimos con otra pregunta?</p>'
      ]
    },
    {
      id: 'frustracion',
      re: '\\b(no entiendes?|no me entiendes?|no me entendio|no entendio|no sirves?|no me sirve|mala respuesta|eso no era|no era eso|no respondiste|no respondio|no es lo que pregunte|respuesta equivocada|estas mal|no ayudas?|inutil|tonto|estupido)\\b',
      a: `
        <p>Tiene razón en señalarlo, y lamento no haber acertado. Respondo por coincidencia de palabras, así que a veces una buena pregunta se me escapa.</p>
        <p>¿Me la plantea de otra forma? También puede elegir uno de los cuatro bloques de preguntas en la fila de temas, aquí abajo: ahí están las veinte, con su respuesta completa.</p>`,
      see: ['cifras'],
      next: ['que-es', 'cifras']
    },
    {
      id: 'hora-fecha',
      re: '\\b(que hora es|que hora tiene|que dia es|que dia es hoy|que fecha es|fecha de hoy|en que fecha estamos)\\b',
      a: '<p>En su equipo son las <strong>{hora}</strong> del <strong>{fecha}</strong>; es el único reloj que alcanzo a ver.</p>'
    },
    {
      id: 'mas-info',
      ctx: true,
      max: 5,
      re: '^(cuenteme mas|cuentame mas|digame mas|dime mas|mas informacion|mas info|mas detalles?|amplie|ampliame|expliqueme mejor|explicame mejor|siga|continue|continua|y eso|algo mas|que mas)\\b',
      a: [
        '<p>Sobre <strong>{tema}</strong>, lo publicado es lo que acabo de mostrarle. Puede ampliarlo en la página o continuar con una de estas preguntas.</p>',
        '<p>De <strong>{tema}</strong> no tengo más detalle que el anterior. La página lo desarrolla con más contexto; también puede seguir por aquí.</p>'
      ]
    },
    {
      id: 'humor',
      max: 7,
      re: '\\b(chiste|hazme reir|algo gracioso|ja(ja)+|je(je)+|xd|lol)\\b',
      a: `
        <p>El humor no es mi fuerte: soy un viento más bien constante.</p>
        <p>Si le parece, volvemos al proyecto.</p>`
    },
    {
      id: 'opinion',
      weak: true,
      re: '\\b(que opinas?|que piensas?|tu opinion|su opinion|que me recomiendas?|que recomienda|usted que haria|tu que harias|cree usted|crees que)\\b',
      a: `
        <p>No me corresponde opinar ni recomendar una decisión de inversión.</p>
        <p>Lo que sí puedo hacer es mostrarle los supuestos, los riesgos y las condiciones que el propio proyecto se impone, para que usted decida con la evidencia delante.</p>`,
      next: ['q15', 'q16', 'q20']
    },
    {
      id: 'afirmacion',
      weak: true,
      max: 3,
      re: '^(ok|okay|vale|listo|entendido|perfecto|de acuerdo|si|claro|bien|bueno|correcto|comprendo|entiendo)\\b',
      a: [
        '<p>De acuerdo. ¿Desea revisar otro tema del proyecto?</p>',
        '<p>Entendido. Cuando quiera, seguimos.</p>'
      ]
    },
    {
      id: 'negacion',
      weak: true,
      max: 3,
      re: '^(no|no gracias|nada|nada mas|ninguna|ninguno)\\b',
      a: '<p>Entendido. Aquí quedo por si surge otra pregunta.</p>'
    },
    {
      id: 'prueba',
      weak: true,
      max: 3,
      re: '^(test|testing|prueba|probando|1 2 3|123)\\b',
      a: '<p>Recibido: le leo con claridad.</p>'
    },
    {
      id: 'peticion',
      weak: true,
      re: '\\b(puedes?|podrias?|me ayudas?|ayudame|ayudeme|ayuda|necesito|quiero saber|quisiera saber|tengo una (pregunta|duda|consulta)|una pregunta|una duda|una consulta)\\b',
      a: `
        <p>Con gusto. Dígame qué necesita saber del proyecto: el problema que aborda, cómo funciona el servicio, cuánto cuesta el piloto, qué riesgos tiene…</p>
        <p>Escríbalo con sus palabras y lo busco.</p>`,
      next: ['que-es', 'q13', 'q16']
    }
  ],

  entries: [
    /* ======================================================================
       BLOQUE 1 · FUNDAMENTO DEL PROYECTO (preguntas 1 a 5, textuales)
       ====================================================================== */
    {
      id: 'q1',
      cat: 'fundamento',
      n: 1,
      title: 'El problema y la oportunidad',
      ask: '¿Qué problema resuelve y por qué es una oportunidad?',
      q: '¿Qué problema específico resuelve Guardianes del Viento y por qué representa una oportunidad de inversión?',
      p: ['que problema resuelve', 'que problema', 'cual es el problema', 'problema especifico', 'que resuelve', 'que busca resolver',
          'oportunidad de inversion', 'por que es una oportunidad', 'que necesidad atiende', 'para que sirve el proyecto', 'para que sirve guardianes'],
      k: 'problema resuelve oportunidad brecha incertidumbre necesidad',
      a: `
        <p>Guardianes del Viento aborda la falta de información ambiental y social que comunidad, empresa y autoridad reconozcan como legítima y verificable. Esa brecha puede generar verificaciones duplicadas, respuestas tardías, deterioro reputacional y días de paralización asociados a controversias.</p>
        <p>La oportunidad consiste en convertir ese costo de incertidumbre en un servicio recurrente de monitoreo, validación y gestión de alertas, mientras se crea capacidad wayuu y se reinvierte valor en La Guajira.</p>`,
      see: ['riesgo', 'solucion'],
      next: ['q2', 'q3', 'funciones']
    },
    {
      id: 'q2',
      cat: 'fundamento',
      n: 2,
      title: 'Diferencia frente al monitoreo convencional',
      ask: '¿Qué lo diferencia del monitoreo convencional?',
      q: '¿Qué diferencia a Guardianes del monitoreo ambiental convencional contratado por una empresa?',
      p: ['monitoreo convencional', 'que lo diferencia', 'que diferencia a guardianes', 'en que se diferencia', 'que tiene de diferente',
          'que tiene de nuevo', 'que tiene de innovador', 'por que es innovador', 'cual es la innovacion', 'que lo hace distinto',
          'que lo hace diferente', 'ya existe algo asi', 'sensor exclusivo', 'ventaja competitiva', 'competencia', 'diferenciacion',
          'valor diferencial'],
      k: 'diferencia diferente convencional distinto innovador innovacion competencia novedad',
      a: `
        <p>El monitoreo convencional suele concentrarse en el cumplimiento técnico del desarrollador. Guardianes incorpora producción comunitaria de evidencia, gobernanza wayuu de datos, comunicación bilingüe y validación independiente.</p>
        <p>El parque financia el servicio, pero no controla la medición ni puede vetar un resultado válido.</p>
        <p>La diferenciación no depende de un sensor exclusivo; surge de integrar tecnología, conocimiento territorial y reglas de independencia dentro de una misma operación.</p>`,
      see: ['solucion', 'tecnologia'],
      next: ['q17', 'tecnologias', 'q4']
    },
    {
      id: 'q3',
      cat: 'fundamento',
      n: 3,
      title: 'Evidencia de que el problema es relevante',
      ask: '¿Qué evidencia sustenta el problema?',
      q: '¿Qué evidencia sustenta que el problema es relevante en La Guajira?',
      p: ['que evidencia sustenta', 'evidencia sustenta', 'el problema es relevante', 'problema relevante', 'por que la guajira',
          'por que en la guajira', 'windpeshi', 'global risks report', 'foro economico mundial', 'world economic forum', 'wef',
          'que pruebas hay', 'como saben que el problema existe', 'que sustenta el problema', 'es real el problema', 'antecedentes'],
      k: 'evidencia sustenta relevante windpeshi conflictividad antecedentes suspension pruebas wef',
      a: `
        <p>El proyecto parte de la concentración de desarrollos eólicos en el departamento, de antecedentes de conflictividad y de casos como la suspensión indefinida de Windpeshi en 2023.</p>
        <p>El Global Risks Report 2025 mantiene la desinformación entre los riesgos inmediatos y los riesgos ambientales entre los más severos de largo plazo.</p>
        <p>Estas referencias justifican el problema, pero el piloto deberá levantar evidencia local sobre tiempos de verificación, alertas, confianza y paralizaciones.</p>`,
      see: ['riesgo', 'referencias'],
      next: ['riesgo-origen', 'territorio', 'referencias']
    },
    {
      id: 'q4',
      cat: 'fundamento',
      n: 4,
      title: 'Por qué una cooperativa wayuu',
      ask: '¿Por qué una cooperativa wayuu?',
      q: '¿Por qué una cooperativa wayuu es una estructura adecuada para prestar este servicio?',
      p: ['por que una cooperativa', 'por que cooperativa', 'cooperativa wayuu', 'estructura adecuada', 'sin animo de lucro',
          'por que sin animo de lucro', 'por que no una empresa', 'figura juridica', 'tipo de organizacion', 'es una empresa',
          'es una ong', 'es una fundacion'],
      k: 'cooperativa estructura adecuada lucro juridica organizacion ong fundacion',
      a: `
        <p>La cooperativa permite que las personas del territorio participen en la producción de evidencia y en las decisiones sobre su uso. También facilita la contratación de monitores, la prestación de servicios y la reinversión de excedentes.</p>
        <p>Su naturaleza sin ánimo de lucro protege el propósito territorial, aunque no elimina la disciplina empresarial: debe facturar, controlar costos, construir reservas y demostrar que puede sostener la operación con contratos.</p>`,
      see: ['solucion', 'gobernanza'],
      next: ['reinversion', 'gobernanza', 'q14']
    },
    {
      id: 'q5',
      cat: 'fundamento',
      n: 5,
      title: 'Resultados que debe demostrar el piloto',
      ask: '¿Qué resultados debe demostrar el piloto?',
      q: '¿Qué resultados concretos deberían convencer a un inversionista de que el modelo funciona?',
      p: ['resultados concretos', 'que resultados', 'convencer a un inversionista', 'que el modelo funciona', 'como se sabe si funciona',
          'como saber si funciona', 'como sabremos si funciona', 'que debe demostrar', 'cinco resultados', 'criterios de exito',
          'que seria un exito', 'como se mide el exito'],
      k: 'resultados convencer funciona demostrar exito',
      a: `
        <p>El piloto debe demostrar cinco resultados: seguridad para los monitores, mediciones técnicamente válidas, aceptación y uso de la evidencia por las partes, respuestas documentadas a las alertas y disposición de pago de los clientes.</p>
        <p>Las metas incluyen <strong>80 %</strong> de mediciones críticas utilizables, <strong>80 %</strong> de alertas respondidas dentro de <strong>72 horas</strong> y una reducción de <strong>30 %</strong> en el tiempo de verificación al finalizar el piloto.</p>`,
      see: ['piloto', 'impacto'],
      next: ['piloto', 'indicadores', 'q12']
    },

    /* ======================================================================
       BLOQUE 2 · SOLUCIÓN TÉCNICA Y DATOS (preguntas 6 a 10, textuales)
       ====================================================================== */
    {
      id: 'q6',
      cat: 'solucion',
      n: 6,
      title: 'Componentes tecnológicos y su función',
      ask: '¿Qué tecnología utiliza?',
      q: '¿Qué componentes tecnológicos utiliza la solución y qué función cumple cada uno?',
      p: ['componentes tecnologicos', 'que tecnologia', 'que tecnologias', 'tecnologia', 'que funcion cumple cada uno', 'usan drones',
          'usan sensores', 'inteligencia artificial', 'que hace la ia', 'papel de la ia', 'para que la ia', 'usan ia',
          'que herramientas', 'drones', 'sensores', 'satelite', 'como miden', 'que equipos'],
      k: 'componentes tecnologia sensores satelite dron plataforma tableros ia equipos',
      a: `
        <p>Los sensores de bajo costo permiten seguimiento frecuente; la información satelital ayuda a identificar cambios y contrastar periodos; los drones apoyan registros en zonas autorizadas; la plataforma conserva trazabilidad, permisos y estados de las alertas; los tableros bilingües facilitan comprensión.</p>
        <p>La inteligencia artificial puede detectar patrones y priorizar eventos, pero no reemplaza el juicio de los monitores, la validación técnica ni la decisión comunitaria.</p>`,
      see: ['tecnologia'],
      next: ['tecnologias', 'q8', 'q10']
    },
    {
      id: 'q7',
      cat: 'solucion',
      n: 7,
      title: 'Cómo se definen las variables a monitorear',
      ask: '¿Cómo se definen las variables a monitorear?',
      q: '¿Cómo se define qué variables ambientales y sociales serán monitoreadas?',
      p: ['que variables', 'cuales variables', 'variables ambientales', 'variables ambientales y sociales', 'como se define que variables',
          'que se mide', 'que miden', 'que van a medir', 'que se va a medir', 'que mediran', 'que se monitorea', 'que monitorean',
          'miden el agua', 'miden el ruido', 'miden el aire', 'umbral de alerta'],
      k: 'variables medir monitoreadas unidad frecuencia muestreo umbral agua aire ruido biodiversidad suelo fauna aves',
      a: `
        <p>El piloto debe seleccionar las variables mediante una mesa técnica con autoridades wayuu, parques, universidad o laboratorio y autoridades ambientales.</p>
        <p>La selección considera riesgos del parque, obligaciones existentes, preocupaciones comunitarias, posibilidad de medición confiable y utilidad para decidir.</p>
        <p>Cada variable necesita unidad, frecuencia, punto de muestreo, responsable, umbral de alerta, método de validación y regla de publicación.</p>`,
      see: ['servicio', 'piloto'],
      next: ['q8', 'etapas', 'gobernanza']
    },
    {
      id: 'q8',
      cat: 'solucion',
      n: 8,
      title: 'Calidad y comparabilidad de los datos',
      ask: '¿Cómo se garantiza la calidad de los datos?',
      q: '¿Cómo se garantiza la calidad y comparabilidad de los datos?',
      p: ['calidad de los datos', 'calidad y comparabilidad', 'como se garantiza la calidad', 'datos confiables', 'son confiables',
          'cadena de custodia', 'quien valida', 'quien valida los datos', 'como se validan', 'como validan', 'equipos calibrados',
          'calibracion', 'incidente de calidad', 'auditoria', 'como se que los datos son ciertos', 'datos falsos',
          'se pueden manipular', 'manipular los datos', 'manipulacion'],
      k: 'calidad comparabilidad calibrados calibracion protocolos custodia duplicados contraste auditoria confiables validar metodologia',
      a: `
        <p>La operación combina equipos calibrados, protocolos documentados, formación certificada, cadena de custodia, controles de duplicados y contraste de muestras. La universidad o laboratorio valida la metodología y realiza auditorías por muestreo.</p>
        <p>Las versiones del dato, los cambios y los accesos quedan registrados. Una medición que incumpla el protocolo se conserva como incidente de calidad, pero no se presenta como evidencia válida.</p>`,
      see: ['servicio', 'tecnologia'],
      next: ['q9', 'q10', 'q17']
    },
    {
      id: 'q9',
      cat: 'solucion',
      n: 9,
      title: 'Recorrido de una alerta, de la detección al cierre',
      ask: '¿Qué ocurre cuando se detecta una alerta?',
      q: '¿Qué ocurre desde que se detecta una alerta hasta que se cierra?',
      p: ['se detecta una alerta', 'desde que se detecta', 'hasta que se cierra', 'como funcionan las alertas', 'que pasa con una alerta',
          'que pasa cuando hay una alerta', 'que es una alerta', 'cierre de una alerta', '72 horas', 'como se atiende una alerta',
          'quien responde las alertas', 'quien atiende las alertas', 'alerta', 'gestion de alertas', 'que pasa si no responden',
          'si el parque no responde'],
      k: 'alerta cierre cierra detecta notificacion criticidad respuesta atender responde 72',
      a: `
        <p>La alerta registra variable, ubicación, hora, evidencia, criticidad y responsable. El parque o la entidad competente recibe la notificación y debe documentar la respuesta. La meta es atender <strong>80 %</strong> dentro de <strong>72 horas</strong>.</p>
        <p>Si existe desacuerdo, se activa contraste técnico y revisión independiente. El cierre exige evidencia de la acción realizada o una justificación documentada de por qué no pudo ejecutarse.</p>`,
      see: ['servicio'],
      next: ['etapas', 'q17', 'indicadores']
    },
    {
      id: 'q10',
      cat: 'solucion',
      n: 10,
      title: 'Control de los datos e información sensible',
      ask: '¿Quién controla los datos?',
      q: '¿Quién controla los datos y cómo se protege la información sensible?',
      p: ['quien controla los datos', 'informacion sensible', 'datos sensibles', 'soberania de datos', 'soberania de datos indigenas',
          'de quien son los datos', 'quien es dueno de los datos', 'dueno de los datos', 'propiedad de los datos',
          'a quien pertenecen los datos', 'quien es el dueno', 'como se protegen los datos', 'proteccion de datos', 'privacidad',
          'quien puede ver los datos', 'quien accede a los datos', 'los datos son publicos', 'se publica todo', 'datos personales',
          'ubicaciones culturales', 'conocimiento territorial'],
      k: 'controla datos sensible soberania permisos custodia licencias privacidad dueno propiedad acceso clasifica restringida',
      a: `
        <p>La propuesta aplica soberanía de datos indígenas. El comité comunitario clasifica la información como pública, restringida o sensible y define permisos, propósito y tiempo de conservación.</p>
        <p>Los contratos separan propiedad, custodia, licencias de uso y obligaciones regulatorias. La plataforma registra accesos y modificaciones.</p>
        <p>La transparencia no significa publicar ubicaciones culturales, información personal o conocimiento territorial cuya difusión no haya sido autorizada.</p>`,
      see: ['gobernanza'],
      next: ['gobernanza', 'q17', 'q8']
    },

    /* ======================================================================
       BLOQUE 3 · CLIENTES, INVERSIÓN Y SOSTENIBILIDAD FINANCIERA
       (preguntas 11 a 15, textuales)
       ====================================================================== */
    {
      id: 'q11',
      cat: 'finanzas',
      n: 11,
      title: 'Clientes y valor que recibe cada uno',
      ask: '¿Quiénes son los clientes?',
      q: '¿Quiénes son los clientes y qué valor recibe cada uno?',
      p: ['quienes son los clientes', 'quien es el cliente', 'que valor recibe cada uno', 'quien paga', 'quien paga el servicio',
          'quienes pagan', 'quien compra', 'a quien le venden', 'a quien se le vende', 'para quien es', 'mercado objetivo', 'clientes',
          'quien contrata', 'publico objetivo', 'segmento'],
      k: 'clientes valor desarrolladores operadores aseguradoras usuarios mercado segmento',
      a: `
        <p>Los desarrolladores y operadores eólicos serían los clientes principales porque necesitan anticipar riesgos, responder a alertas y demostrar trazabilidad. Los financiadores y aseguradoras pueden utilizar indicadores para evaluar exposición y cumplimiento. Las autoridades reciben evidencia complementaria. Las comunidades obtienen empleo, capacidad técnica y control sobre datos.</p>
        <p>La propuesta debe adaptar el contrato a cada usuario sin comprometer la independencia del resultado.</p>`,
      see: ['modelo'],
      next: ['q12', 'tarifa', 'que-compra']
    },
    {
      id: 'q12',
      cat: 'finanzas',
      n: 12,
      title: 'Validación de la disposición de pago',
      ask: '¿Cómo se validará que los clientes pagarán?',
      q: '¿Cómo se validará que los clientes están dispuestos a pagar?',
      p: ['dispuestos a pagar', 'disposicion de pago', 'disposicion a pagar', 'como se validara que los clientes', 'validacion comercial',
          'cartas de intencion', 'pago anticipado', 'van a pagar', 'hay clientes', 'ya hay clientes', 'ya tienen clientes',
          'ya hay contratos', 'tienen contratos', 'como saben que pagaran', 'quien dice que van a pagar', 'hay demanda',
          'validar el mercado'],
      k: 'dispuestos pagar disposicion validacion comercial entrevistas cartas intencion anticipado renovacion demanda',
      a: `
        <p>Antes de escalar deben realizarse entrevistas, cartas de intención y negociación del alcance con al menos dos parques. La validación comercial debe confirmar variables, frecuencia, tiempos de respuesta, condiciones de acceso, tarifa y duración.</p>
        <p>El indicador más fuerte no será una declaración de interés, sino un contrato o pago anticipado. El piloto también debe registrar qué costos evita o reduce el servicio para sustentar la renovación.</p>`,
      see: ['modelo', 'piloto'],
      next: ['tarifa', 'q13', 'piloto']
    },
    {
      id: 'q13',
      cat: 'finanzas',
      n: 13,
      title: 'Qué cubre la inversión de COP 650 millones',
      ask: '¿Qué cubre la inversión de COP 650 millones?',
      q: '¿Qué cubre la inversión inicial de COP 650 millones y cómo se controlará su uso?',
      p: ['650 millones', 'que cubre la inversion', 'inversion inicial', 'cuanto cuesta', 'cuanto cuesta el piloto',
          'cuanto cuesta el proyecto', 'cuanta plata', 'cuanto dinero', 'costo del piloto', 'costo del proyecto', 'en que se gasta',
          'en que se usa', 'en que se invierte', 'como se controlara su uso', 'como se controla la plata', 'cuanto hay que invertir',
          'cuanto piden', 'cuanto necesitan', 'cuanto se necesita', 'cuanto es la inversion', 'valor de la inversion', 'cuanta inversion',
          'monto', 'desembolsos', 'hitos', 'administracion fiduciaria'],
      k: 'inversion 650 millones cubre costo desembolsos hitos cotizaciones fiduciaria monto dinero piloto',
      a: `
        <p>La estimación asigna <strong>COP 150 millones</strong> a sensores, <strong>60</strong> a drones y accesorios, <strong>110</strong> a plataforma, <strong>40</strong> a cómputo y conectividad, <strong>100</strong> a formación y protocolos, <strong>70</strong> a implementación territorial y <strong>120</strong> a operación inicial.</p>
        <p>Los desembolsos deben vincularse a hitos: gobernanza aprobada, personas formadas, equipos instalados, línea base, operación y evaluación.</p>
        <p>Las cifras requieren cotizaciones, contingencias y administración fiduciaria antes del cierre.</p>`,
      see: ['inversion'],
      next: ['presupuesto', 'q14', 'q15']
    },
    {
      id: 'q14',
      cat: 'finanzas',
      n: 14,
      title: 'Financiación y retorno para quien aporta',
      ask: '¿Qué retorno recibe quien aporta?',
      q: '¿Cómo puede financiarse una cooperativa sin ánimo de lucro y qué retorno puede recibir el aportante?',
      p: ['como puede financiarse', 'como se financia', 'fuentes de financiacion', 'que retorno', 'retorno puede recibir',
          'retorno para el inversionista', 'retorno de la inversion', 'retorno financiero', 'retorno', 'que gana el inversionista',
          'que gano yo', 'que gano', 'que recibe el inversionista', 'que recibo a cambio', 'que recibo', 'hay dividendos', 'dividendos',
          'participacion patrimonial', 'es una donacion', 'donacion', 'no reembolsable', 'no reembolsables', 'deuda', 'credito',
          'prestamo', 'me devuelven la plata', 'recupero mi dinero', 'acciones', 'equity'],
      k: 'financiarse financiacion retorno dividendos patrimonial reembolsables cooperacion deuda acreedor intereses instrumento donacion acciones',
      a: `
        <p>La cooperativa no distribuiría dividendos ni entregaría participación patrimonial. El piloto puede combinar aportes no reembolsables, cooperación, pagos anticipados de los parques, financiación recuperable o deuda respaldada por contratos.</p>
        <p>Un financiador de impacto recibe evidencia de resultados y reducción de riesgos; un acreedor recibe intereses según el flujo pactado.</p>
        <p>El instrumento debe definirse antes de solicitar recursos para evitar llamar inversión a un aporte sin retorno financiero.</p>`,
      see: ['inversion', 'finanzas'],
      next: ['q15', 'solicitud', 'reinversion']
    },
    {
      id: 'q15',
      cat: 'finanzas',
      n: 15,
      title: 'Supuestos financieros y escenario adverso',
      ask: '¿Qué supuestos sostienen la proyección financiera?',
      q: '¿Qué supuestos sostienen la proyección financiera y qué ocurre en un escenario adverso?',
      p: ['supuestos sostienen', 'proyeccion financiera', 'proyecciones financieras', 'escenario adverso', 'que supuestos', 'supuestos',
          'vpn', 'que pasa si sale mal', 'si las cosas salen mal', 'escenario conservador', 'escenario base',
          'cuando se recupera la inversion', 'en cuanto tiempo se recupera', 'periodo de recuperacion', 'recuperacion de la inversion',
          'ingresos acumulados', 'ingresos proyectados', 'es rentable', 'rentabilidad', 'es viable financieramente',
          'viabilidad financiera', 'es sostenible financieramente', 'punto de equilibrio'],
      k: 'supuestos proyeccion financiera escenario adverso vpn ingresos recuperacion conservador rentable viable',
      a: `
        <p>La modelación utiliza una tarifa de <strong>COP 25 millones</strong> mensuales por parque, crecimiento en contratos y costos de operación escalables.</p>
        <p>En el escenario base proyecta ingresos acumulados de <strong>COP 17.100 millones</strong>, VPN al 15 % de <strong>COP 3.260 millones</strong> y recuperación en el <strong>año 3</strong>. En el conservador, los ingresos bajan a <strong>COP 10.200 millones</strong>, el VPN a <strong>COP 53 millones</strong> y la recuperación pasa al <strong>año 5</strong>.</p>
        <p>Precio, adopción, permanencia y costos deben probarse.</p>`,
      see: ['finanzas'],
      next: ['escenarios', 'meta-vs-proyeccion', 'tarifa']
    },

    /* ======================================================================
       BLOQUE 4 · RIESGOS, IMPACTO Y ESCALAMIENTO (preguntas 16 a 20, textuales)
       ====================================================================== */
    {
      id: 'q16',
      cat: 'riesgos',
      n: 16,
      title: 'Riesgos que podrían hacer fracasar el proyecto',
      ask: '¿Cuáles son los riesgos?',
      q: '¿Cuáles son los riesgos que podrían hacer fracasar el proyecto?',
      p: ['riesgos', 'cuales son los riesgos', 'que riesgos tiene', 'riesgos criticos', 'hacer fracasar', 'fracasar el proyecto',
          'por que podria fracasar', 'que puede salir mal', 'que puede fallar', 'que podria fallar', 'debilidades', 'puntos debiles',
          'que tan riesgoso', 'captura de la gobernanza', 'dependencia de subsidios'],
      k: 'riesgo fracasar fallar criticos captura subsidios regulatorios debilidades',
      a: `
        <p>Los riesgos críticos son captura de la gobernanza por un clan, amenazas a monitores, uso indebido de datos, baja calidad técnica, interferencia del financiador, poca adopción de la evidencia, dependencia de subsidios y cambios regulatorios.</p>
        <p>Cada riesgo necesita responsable, señal temprana y respuesta. La seguridad, la independencia y la protección de datos son condiciones de continuidad; no pueden compensarse con un buen resultado financiero.</p>`,
      see: ['controles'],
      next: ['controles', 'seguridad', 'q17']
    },
    {
      id: 'q17',
      cat: 'riesgos',
      n: 17,
      title: 'Independencia cuando los parques pagan',
      ask: '¿Cómo se protege la independencia?',
      q: '¿Cómo se protege la independencia cuando los parques pagan por el servicio?',
      p: ['como se protege la independencia', 'independencia', 'quien garantiza la independencia', 'los parques pagan',
          'cuando los parques pagan', 'si el parque paga', 'conflicto de interes', 'conflicto de intereses', 'quien paga manda',
          'el que paga manda', 'juez y parte', 'pueden vetar', 'puede vetar', 'veto', 'vetar', 'no quiere publicar',
          'no quieren publicar', 'no quiere que se publique', 'bloquear un reporte', 'modificar la medicion', 'cambiar los datos',
          'cambiar un dato', 'ocultar un dato', 'ocultar informacion', 'el parque controla', 'el parque puede', 'resultados favorables',
          'replica', 'son imparciales'],
      k: 'independencia separa funciones replica vetar bloquear modificar favorables ocultar censurar juez publicar',
      a: `
        <p>El contrato separa las funciones: el parque financia y responde, la cooperativa mide, la universidad o laboratorio valida y la comunidad gobierna los datos sensibles.</p>
        <p>El cliente puede solicitar aclaración y ejercer réplica, pero no modificar la medición ni bloquear un reporte válido. Las controversias pasan a revisión independiente.</p>
        <p>Los desembolsos no deben condicionarse a resultados favorables, sino al cumplimiento del protocolo.</p>`,
      see: ['gobernanza', 'controles'],
      next: ['que-compra', 'gobernanza', 'q10']
    },
    {
      id: 'q18',
      cat: 'riesgos',
      n: 18,
      title: 'Cómo se medirá el impacto',
      ask: '¿Cómo se medirá el impacto?',
      q: '¿Cómo se medirá el impacto sin atribuir a Guardianes resultados que dependen de otros factores?',
      p: ['como se medira el impacto', 'medir el impacto', 'como se mide el impacto', 'como miden el impacto', 'medicion de impacto',
          'evaluacion de impacto', 'como se evalua', 'sin atribuir', 'atribucion', 'causalidad', 'contribucion', 'correlacion',
          'linea base', 'linea de base', 'como saben que fue guardianes'],
      k: 'impacto atribuir atribucion base contribucion causalidad comparara contraste evaluacion',
      a: `
        <p>El piloto levantará una línea base y clasificará los eventos vinculados a controversias de información. Comparará tiempos de verificación, alertas, aceptación de datos, confianza y días de paralización antes y después y, cuando sea posible, entre parques o periodos de contraste.</p>
        <p>El proyecto hablará de contribución y no de causalidad exclusiva, porque también intervienen decisiones empresariales, condiciones políticas y regulación.</p>`,
      see: ['cambio', 'impacto'],
      next: ['teoria-cambio', 'indicadores', 'q5']
    },
    {
      id: 'q19',
      cat: 'riesgos',
      n: 19,
      title: 'Consulta previa, licenciamiento y autoridades',
      ask: '¿Sustituye la consulta previa o el licenciamiento?',
      q: '¿Cómo se relaciona la solución con la consulta previa, el licenciamiento y las autoridades ambientales?',
      p: ['consulta previa', 'licenciamiento', 'autoridades ambientales', 'las autoridades', 'anla', 'corpoguajira', 'licencia ambiental',
          'licencias ambientales', 'estudios de impacto', 'estudio de impacto ambiental', 'reemplaza la consulta', 'sustituye la consulta',
          'es legal', 'marco legal', 'marco normativo', 'regulacion', 'normatividad', 'que dice la ley', 'el estado', 'el gobierno',
          'obligaciones legales'],
      k: 'consulta previa licenciamiento autoridades anla corpoguajira estudios institucionales legal regulacion ley norma estado',
      a: `
        <p>Guardianes aporta evidencia complementaria. No sustituye la consulta previa, los estudios de impacto, el licenciamiento, el seguimiento de la ANLA o Corpoguajira ni las obligaciones de los desarrolladores.</p>
        <p>Los protocolos deben alinearse con formatos institucionales para que la información resulte utilizable.</p>
        <p>La aceptación de las autoridades es un supuesto del piloto y debe confirmarse antes de presentar el modelo como parte formal del seguimiento.</p>`,
      see: ['gobernanza', 'controles'],
      next: ['actores', 'q16', 'q10']
    },
    {
      id: 'q20',
      cat: 'riesgos',
      n: 20,
      title: 'Condiciones para escalar y por qué invertir ahora',
      ask: '¿Qué condiciones hay para escalar?',
      q: '¿Qué condiciones deben cumplirse para escalar y por qué invertir ahora?',
      p: ['condiciones para escalar', 'condiciones de escalamiento', 'que condiciones deben cumplirse', 'cuando se escala',
          'cuando escalar', 'por que invertir ahora', 'por que financiar ahora', 'por que ahora', 'por que este momento',
          'por que invertir', 'por que deberia invertir', 'por que apoyar', 'vale la pena'],
      k: 'condiciones escalar inversion ahora momento controlada',
      a: `
        <p>El modelo solo debe escalar si protege a los monitores, produce datos válidos, logra que las partes los utilicen, genera respuestas y demuestra contratos suficientes para sostener la operación.</p>
        <p>El momento es relevante porque la expansión eólica avanza y la confianza territorial sigue siendo una condición de viabilidad. Financiar ahora permite probar la solución en escala controlada.</p>
        <p>Hacia 2030, la meta de impacto es <strong>24 personas en cuatro parques</strong>; la proyección comercial de hasta <strong>24 parques</strong> es independiente.</p>`,
      see: ['piloto', 'finanzas'],
      next: ['escalamiento', 'meta-vs-proyeccion', 'solicitud']
    },

    /* ======================================================================
       ENTRADAS DE APOYO · tomadas del informe del proyecto y del guion del
       tráiler. Conservan las salvedades del texto original.
       ====================================================================== */

    /* ---------- Fundamento ---------- */
    {
      id: 'que-es',
      cat: 'fundamento',
      title: 'Qué es Guardianes del Viento',
      ask: '¿Qué es Guardianes del Viento?',
      p: ['que es guardianes', 'de que trata el proyecto', 'de que se trata el proyecto', 'en que consiste el proyecto',
          'que es el proyecto', 'que es este proyecto', 'resumen del proyecto', 'expliqueme el proyecto', 'explicame el proyecto',
          'cual es la idea', 'a que se dedican', 'cuenteme del proyecto', 'cuentame del proyecto', 'hableme del proyecto',
          'hablame del proyecto', 'sobre el proyecto', '=de que se trata', '=de que trata', '=que es', '=que es esto', '=resumen',
          '=resumame', '=que hacen', '=quienes son', '=en que consiste', '=de que va', '=guardianes del viento', '=guardianes',
          '=proyecto', '=el proyecto'],
      k: 'guardianes viento proyecto iniciativa resumen idea',
      a: `
        <p>Guardianes del Viento propone crear una cooperativa wayuu sin ánimo de lucro que produzca, valide y gobierne información ambiental y social alrededor de los parques eólicos de La Guajira.</p>
        <p>La iniciativa busca reducir la incertidumbre que alimenta la desconfianza y las controversias, al tiempo que deja capacidad técnica, empleo y reinversión en el territorio.</p>
        <p class="al-note">Es una propuesta: la decisión que se plantea es financiar y acompañar un piloto controlado, no una expansión automática.</p>`,
      see: ['solucion', 'trailer'],
      next: ['q1', 'funciones', 'cifras']
    },
    {
      id: 'cifras',
      cat: 'fundamento',
      title: 'Cifras clave',
      ask: '¿Cuáles son las cifras clave?',
      p: ['cifras clave', 'cifras', 'datos clave', 'los numeros', 'numeros clave', 'numeros del proyecto', 'datos centrales', 'en cifras',
          'principales cifras', 'cifras principales', 'datos principales', '=numeros', '=datos'],
      k: 'cifras numeros clave centrales',
      a: `
        <dl class="al-kv al-kv--fig">
          <div><dt>COP 650 millones</dt><dd>Inversión estimada para un piloto verificable.</dd></div>
          <div><dt>Dos parques y 12 personas</dt><dd>Cobertura inicial para probar la solución.</dd></div>
          <div><dt>24 personas y cuatro parques</dt><dd>Meta de impacto hacia 2030.</dd></div>
          <div><dt>−50 % y −30 %</dt><dd>Metas de reducción del tiempo de verificación y de los días de paralización vinculados a controversias de información.</dd></div>
        </dl>
        <p class="al-note">Las cifras corresponden a metas y supuestos de planeación que deberán validarse durante el piloto. No representan resultados ya alcanzados.</p>
        <p>Como dato de contexto: según la referencia utilizada por el proyecto, La Guajira concentra cerca del <strong>98 %</strong> de los proyectos eólicos del país.</p>`,
      see: ['cifras', 'impacto'],
      next: ['q13', 'indicadores', 'meta-vs-proyeccion']
    },
    {
      id: 'riesgo-origen',
      cat: 'fundamento',
      title: 'El riesgo que da origen al proyecto',
      ask: '¿Qué riesgo da origen al proyecto?',
      p: ['riesgo que da origen', 'origen del proyecto', 'evidencia compartida', 'sin evidencia compartida', 'desinformacion',
          'informacion falsa', 'noticias falsas', 'versiones distintas', 'por que hay desconfianza', 'desconfianza', 'que efectos',
          'que consecuencias', 'por que hay conflicto', 'por que hay conflictos', 'conflictos', 'paralizaciones', 'duplicidad',
          'perdida de legitimidad', 'que pasa si no se hace nada', 'que pasa si no se interviene'],
      k: 'desinformacion desconfianza duplicidad paralizacion legitimidad efectos consecuencias versiones conflicto tardia origen falsa',
      a: `
        <p>Cuando la evidencia no es compartida, cada actor toma decisiones desde una versión diferente del territorio.</p>
        <p>El problema no se limita a que circule información falsa. También aparece cuando los datos llegan tarde, no pueden verificarse, se presentan en formatos inaccesibles o provienen de una fuente que alguna de las partes no considera legítima.</p>
        <ul>
          <li><strong>Desconfianza.</strong> Las mediciones, los compromisos y las respuestas son cuestionados.</li>
          <li><strong>Reacción tardía.</strong> Una alerta ambiental o social se atiende después de que la tensión ha aumentado.</li>
          <li><strong>Duplicidad.</strong> Cada parte encarga su propia verificación y los resultados pueden no coincidir.</li>
          <li><strong>Paralización.</strong> Las controversias informativas contribuyen a retrasos, mayores costos y deterioro reputacional.</li>
          <li><strong>Pérdida de legitimidad.</strong> Las decisiones se perciben como externas o desconectadas del conocimiento territorial.</li>
        </ul>`,
      see: ['riesgo'],
      next: ['q3', 'q1', 'territorio']
    },
    {
      id: 'territorio',
      cat: 'fundamento',
      title: 'La Guajira: contexto y oportunidad',
      ask: '¿Por qué La Guajira?',
      p: ['donde queda', 'donde es el proyecto', 'donde se desarrolla', 'donde opera', 'donde operan', 'en que territorio',
          'en que departamento', 'en que region', 'pobreza monetaria', 'pobreza', 'oportunidad de negocio', 'contexto territorial',
          'contexto', '98 por ciento', '98', 'cuantos proyectos eolicos', 'proyectos eolicos', 'transicion energetica',
          'energia eolica', '=la guajira', '=guajira', '=donde', '=donde es'],
      k: 'guajira territorio departamento region pobreza contexto eolicos transicion',
      a: `
        <p>Según la referencia utilizada por el proyecto, La Guajira concentra cerca del <strong>98 %</strong> de los proyectos eólicos del país. Al mismo tiempo, la pobreza monetaria alcanzó <strong>67,4 %</strong> en 2021 y los antecedentes de proyectos detenidos muestran que construir infraestructura no garantiza por sí solo la viabilidad territorial.</p>
        <p>El caso de Windpeshi, suspendido de forma indefinida en 2023, muestra que los costos de la transición energética no dependen únicamente de la ingeniería o del precio de la energía. También intervienen la confianza, la calidad del relacionamiento, la distribución de beneficios y la capacidad para resolver diferencias antes de que afecten la operación.</p>
        <p>Guardianes del Viento plantea que producir información confiable y gobernada desde el territorio puede convertirse en un servicio.</p>`,
      see: ['riesgo', 'territorio'],
      next: ['q3', 'q1', 'q11']
    },
    {
      id: 'valor',
      cat: 'fundamento',
      title: 'Valor para cada actor',
      ask: '¿Qué valor crea para cada actor?',
      p: ['por que puede crear valor', 'que valor crea', 'crear valor', 'propuesta de valor', 'beneficios', 'que beneficios',
          'que gana la comunidad', 'que ganan las comunidades', 'que gana el parque', 'que ganan los parques', 'que gana cada',
          'ventajas', 'para que le sirve'],
      k: 'valor beneficio ventajas ganar',
      a: `
        <p>La propuesta plantea un valor distinto para cada parte:</p>
        <ul>
          <li><strong>Para los parques:</strong> permite identificar alertas antes de que se conviertan en controversias más costosas, reduce duplicidades de verificación y fortalece la legitimidad de las decisiones.</li>
          <li><strong>Para las comunidades:</strong> crea empleo y conocimiento local, reconoce el saber territorial y evita que los datos sensibles se utilicen sin reglas acordadas.</li>
          <li><strong>Para las autoridades:</strong> aporta información complementaria, trazable y con validación independiente para el seguimiento ambiental y social.</li>
          <li><strong>Para el financiador:</strong> abre la posibilidad de probar un servicio recurrente con impacto medible, gobernanza definida y criterios claros para decidir si se escala.</li>
        </ul>`,
      see: ['solucion', 'modelo'],
      next: ['q11', 'q14', 'q2']
    },
    {
      id: 'seleccion',
      cat: 'fundamento',
      title: 'Por qué se seleccionó esta idea',
      ask: '¿Por qué se seleccionó esta idea?',
      p: ['por que fue seleccionada', 'por que se selecciono', 'como se selecciono', 'por que esta idea', 'por que esta y no otra',
          'utilidad multiatributo', 'multiatributo', 'analisis de sensibilidad', 'sensibilidad', 'otras alternativas', 'que alternativas',
          'alternativas', 'libro de acuerdos abiertos', 'acuerdos abiertos', 'agua con energia', 'otras ideas', 'tres ideas',
          'calificacion', 'calificaciones', 'puntaje', 'como se eligio', 'como eligieron', 'por que eligieron', '4 48', 'keeney',
          'raiffa', 'ponderacion', 'criterios de seleccion'],
      k: 'seleccion seleccionada selecciono eligio alternativas multiatributo sensibilidad calificacion puntaje ponderacion criterios idea',
      a: `
        <p>El escenario de transición energética en La Guajira dio origen a tres alternativas complementarias. La comparación se apoyó en la teoría de la utilidad multiatributo:</p>
        <dl class="al-kv">
          <div><dt>Guardianes del Viento <b>4,48</b></dt><dd>Monitoreo comunitario, validación independiente y gobernanza wayuu de datos.</dd></div>
          <div><dt>Libro de Acuerdos Abiertos <b>4,13</b></dt><dd>Trazabilidad de compromisos, responsables, plazos y cumplimiento.</dd></div>
          <div><dt>Agua con Energía <b>3,98</b></dt><dd>Infraestructura hídrica renovable con operación y resultados verificables.</dd></div>
        </dl>
        <p>Innovación y viabilidad recibieron <strong>35 %</strong> cada una, porque una solución diferente solo crea valor si puede implementarse. La sostenibilidad integral recibió <strong>30 %</strong>.</p>
        <p>El análisis de sensibilidad modificó el énfasis entre las tres dimensiones. Guardianes conservó el primer lugar cuando innovación recibió 60 % (<strong>4,56</strong>), cuando viabilidad recibió 60 % (<strong>4,34</strong>) y cuando sostenibilidad recibió 60 % (<strong>4,56</strong>). El resultado indica que la selección no depende de una sola distribución de pesos, sino del desempeño equilibrado de la propuesta.</p>`,
      see: ['seleccion'],
      next: ['q2', 'que-es', 'referencias']
    },
    {
      id: 'piloto',
      cat: 'fundamento',
      title: 'El piloto y los umbrales para continuar',
      ask: '¿En qué consiste el piloto?',
      p: ['piloto', 'el piloto', 'que es el piloto', 'en que consiste el piloto', 'como es el piloto', 'umbrales',
          'umbrales para continuar', 'condiciones para continuar', 'criterios de validacion', 'cuanto dura el piloto',
          'duracion del piloto', 'donde es el piloto', 'cuando empieza', 'cuando inicia', 'cuando comienza', 'cronograma',
          'en que parques', 'cuales parques', 'que parques', 'cuando se detiene', 'dos parques'],
      k: 'piloto umbrales continuar cobertura cronograma duracion',
      a: `
        <p>El piloto está diseñado para reducir incertidumbre antes de escalar. Iniciaría en <strong>dos parques</strong> con condiciones contrastantes y <strong>12 personas wayuu</strong> como monitores, seis por parque. Durante los primeros meses se levanta la línea base y se prueban los protocolos; luego se evalúa si la evidencia es aceptada, utilizada y financieramente sostenible.</p>
        <p>Umbrales para continuar:</p>
        <ul>
          <li>Los monitores pueden trabajar sin amenazas no controladas y existe una ruta de protección activa.</li>
          <li>La calidad técnica cumple los protocolos y las mediciones críticas son aceptadas como utilizables.</li>
          <li>Las alertas generan respuestas documentadas y la información se utiliza en decisiones reales.</li>
          <li>Los clientes reconocen valor suficiente para avanzar hacia contratos que cubran costos recurrentes.</li>
          <li>La gobernanza comunitaria funciona sin captura, exclusión o interferencia del financiador.</li>
        </ul>
        <p class="al-note">La evaluación compara con la línea base y lleva a una decisión: continuar, adaptar, ampliar o detener.</p>`,
      see: ['piloto'],
      next: ['q5', 'q13', 'personas']
    },

    /* ---------- Solución técnica y datos ---------- */
    {
      id: 'funciones',
      cat: 'solucion',
      title: 'Las cinco funciones del servicio',
      ask: '¿Cuáles son las cinco funciones?',
      p: ['cinco funciones', 'observar medir validar', 'que funciones', 'funciones del servicio', 'que hace la cooperativa',
          'que haria la cooperativa', 'que servicio presta', 'que servicios presta', 'que servicios ofrece', 'que hace guardianes',
          'en que consiste el servicio', 'que ofrece', 'la solucion', 'cual es la solucion', 'solucion propuesta', 'que proponen',
          '=solucion', '=funciones'],
      k: 'funciones observar medir validar comunicar gobernar solucion ofrece presta',
      a: `
        <p>Guardianes del Viento sería una cooperativa wayuu sin ánimo de lucro que presta servicios de monitoreo ambiental y social a proyectos eólicos. La propuesta integra cinco funciones que deben operar juntas:</p>
        <ul>
          <li><strong>Observar.</strong> Lectura territorial, recorridos, identificación de cambios y registro de percepción comunitaria.</li>
          <li><strong>Medir.</strong> Sensores de bajo costo, muestras, información satelital y drones únicamente en zonas autorizadas.</li>
          <li><strong>Validar.</strong> Calibración, contraste de muestras y auditoría independiente de la cadena de custodia.</li>
          <li><strong>Comunicar.</strong> Alertas, reportes y tableros bilingües que expliquen qué ocurrió, dónde y qué respuesta se produjo.</li>
          <li><strong>Gobernar.</strong> Reglas comunitarias sobre acceso, sensibilidad, publicación, corrección y uso de los datos.</li>
        </ul>`,
      see: ['solucion'],
      next: ['etapas', 'q6', 'gobernanza']
    },
    {
      id: 'etapas',
      cat: 'solucion',
      title: 'Las siete etapas del servicio',
      ask: '¿Cómo funciona el servicio?',
      p: ['siete etapas', 'etapas del servicio', 'como funciona el servicio', 'como funciona', 'como funcionaria', 'como opera',
          'como operaria', 'paso a paso', 'pasos', 'cual es el proceso', 'proceso', 'como trabajan', 'como trabajarian', 'etapas',
          'fases', 'flujo', 'como se hace', 'como lo hacen', 'en la practica'],
      k: 'etapas fases pasos proceso funciona opera preparacion formacion aprendizaje flujo',
      a: `
        <p>El servicio inicia antes de instalar sensores: cada parque participante debe acordar con las autoridades wayuu los puntos de observación, los protocolos, los datos sensibles y el procedimiento para atender alertas.</p>
        <ol>
          <li><strong>Preparación.</strong> Consentimiento, gobernanza, seguridad, selección de monitores y puntos.</li>
          <li><strong>Formación.</strong> Uso de equipos, cadena de custodia, seguridad y comunicación.</li>
          <li><strong>Medición.</strong> Registros ambientales y sociales con controles de calidad.</li>
          <li><strong>Validación.</strong> Calibración, contraste de muestras y auditoría por muestreo.</li>
          <li><strong>Alerta.</strong> Clasificación, comunicación y asignación de responsable.</li>
          <li><strong>Respuesta.</strong> Acción del parque o autoridad y seguimiento al cierre.</li>
          <li><strong>Aprendizaje.</strong> Revisión de indicadores y decisiones de adaptación: continuar, corregir, ampliar o detener.</li>
        </ol>`,
      see: ['servicio'],
      next: ['q9', 'q8', 'funciones']
    },
    {
      id: 'tecnologias',
      cat: 'solucion',
      title: 'Las seis tecnologías y su límite de diseño',
      ask: '¿Qué límites tiene cada tecnología?',
      p: ['limite de diseno', 'limites de diseno', 'seis tecnologias', 'limites de la tecnologia', 'limites de cada tecnologia',
          'que limites tiene', 'limitaciones de la tecnologia', 'limitaciones', 'que no hace la tecnologia', 'adopcion tecnologica',
          'trazabilidad digital', 'dependencia de proveedores'],
      k: 'limite limitaciones tecnologia seis adopcion trazabilidad mantenibles proveedores',
      a: `
        <p>La innovación no está en utilizar un sensor de manera aislada. Está en combinar herramientas digitales, conocimiento wayuu, validación externa y reglas de gobernanza dentro de un mismo servicio.</p>
        <ul>
          <li><strong>Sensores de bajo costo.</strong> Seguimiento frecuente de variables ambientales. <em>Límite:</em> requieren calibración, mantenimiento y contraste.</li>
          <li><strong>Información satelital.</strong> Identificación de cambios y comparación temporal. <em>Límite:</em> no sustituye la observación de campo.</li>
          <li><strong>Inteligencia artificial.</strong> Detección de patrones y priorización de alertas. <em>Límite:</em> no decide la validez cultural ni reemplaza el juicio humano.</li>
          <li><strong>Drones.</strong> Registro en áreas extensas o de acceso complejo. <em>Límite:</em> solo en zonas autorizadas y con protocolo de privacidad.</li>
          <li><strong>Trazabilidad digital.</strong> Registro de origen, cambios, accesos y respuesta. <em>Límite:</em> la transparencia no implica publicar datos sensibles.</li>
          <li><strong>Tableros bilingües.</strong> Comunicación comprensible para actores distintos. <em>Límite:</em> deben probarse con usuarios y conectividad local.</li>
        </ul>
        <p class="al-note">La adopción tecnológica será gradual. El piloto debe privilegiar herramientas mantenibles en el territorio, reducir la dependencia de proveedores y formar a las personas que operarán el sistema después de la fase inicial.</p>`,
      see: ['tecnologia'],
      next: ['q6', 'q8', 'bilingue']
    },
    {
      id: 'gobernanza',
      cat: 'solucion',
      title: 'Gobernanza: cuatro espacios y una regla de decisión',
      ask: '¿Cómo se toman las decisiones?',
      p: ['gobernanza', 'cuatro espacios', 'regla de decision', 'como se toman las decisiones', 'quien decide',
          'quien toma las decisiones', 'quienes deciden', 'asamblea comunitaria', 'asamblea', 'comite de gobernanza',
          'comite de gobernanza de datos', 'mesa tecnica', 'comite de seguimiento', 'dos tercios', 'consenso', 'mayoria', 'quien manda',
          'como se gobierna', 'roles', 'responsabilidades', 'quien hace que', 'como se organizan', 'organigrama'],
      k: 'gobernanza decisiones decide asamblea comite mesa consenso mayoria roles responsabilidades espacios',
      a: `
        <p>La confianza depende de una distribución clara de responsabilidades. Las decisiones sobre datos sensibles corresponden a la gobernanza comunitaria; la calidad técnica corresponde a la universidad o laboratorio; los parques deben responder a las alertas; el financiador administra recursos y verifica hitos, pero no modifica mediciones ni veta resultados válidos.</p>
        <ul>
          <li><strong>Asamblea comunitaria.</strong> Representación, prioridades, restricciones culturales y reinversión.</li>
          <li><strong>Comité de gobernanza de datos.</strong> Accesos, publicación, privacidad, incidentes y correcciones.</li>
          <li><strong>Mesa técnica.</strong> Protocolos, calibración, calidad, cadena de custodia y auditoría.</li>
          <li><strong>Comité de seguimiento.</strong> Alertas, respuestas, indicadores, contratos y compromisos.</li>
        </ul>
        <p>Las decisiones se adoptan por consenso o, cuando no sea posible, por mayoría de dos tercios que incluya a las autoridades de los territorios afectados. Las controversias técnicas deben pasar a revisión independiente dentro de un plazo definido.</p>`,
      see: ['gobernanza'],
      next: ['q10', 'q17', 'actores']
    },
    {
      id: 'actores',
      cat: 'solucion',
      title: 'Actores necesarios para ejecutar',
      ask: '¿Qué actores se necesitan?',
      p: ['actores necesarios', 'actores', 'papel de la defensoria', 'papel tiene la defensoria', 'que hace la defensoria',
          'defensoria y organizaciones', 'organizaciones de derechos humanos', 'papel del sena', 'papel de minciencias', 'aliados', 'alianzas', 'quienes participan', 'quien participa', 'quien mas participa',
          'que aliados', 'con quien se alian', 'sena', 'minciencias', 'fiduciario', 'que universidad participa',
          'universidad o laboratorio', 'laboratorio', 'capital semilla', 'socios', 'que entidades', 'entidades', 'instituciones',
          'cooperacion internacional', 'quien apoya', 'quienes apoyan', 'stakeholders', 'partes interesadas'],
      k: 'actores aliados alianzas participan sena minciencias fiduciario laboratorio semilla socios entidades instituciones apoyan',
      a: `
        <ul>
          <li><strong>Autoridades y comunidades wayuu.</strong> Aprobar la gobernanza, seleccionar puntos y monitores, aportar conocimiento territorial y decidir sobre datos sensibles.</li>
          <li><strong>Dos parques participantes.</strong> Financiar, facilitar acceso, responder a alertas y aceptar cláusulas de independencia.</li>
          <li><strong>Universidad o laboratorio.</strong> Formar, calibrar, validar muestras, certificar capacidades y auditar calidad.</li>
          <li><strong>ANLA, Corpoguajira y entidades territoriales.</strong> Alinear formatos y articular la evidencia con el seguimiento ambiental e institucional.</li>
          <li><strong>Defensoría y organizaciones de derechos humanos.</strong> Activar prevención y respuesta ante amenazas o presiones.</li>
          <li><strong>SENA, Minciencias SGR y cooperación.</strong> Aportar capital semilla, formación, validación tecnológica y fortalecimiento organizacional.</li>
          <li><strong>Fiduciario, aseguradoras y financiadores.</strong> Administrar recursos, acompañar hitos y fortalecer la sostenibilidad sin controlar resultados.</li>
        </ul>
        <p class="al-note">El informe los presenta como compromisos esperados. Las fuentes potenciales de capital semilla no sustituyen el compromiso de los clientes: su papel es financiar la etapa de aprendizaje y reducir el riesgo inicial.</p>`,
      see: ['gobernanza', 'piloto'],
      next: ['gobernanza', 'q11', 'q19']
    },
    {
      id: 'bilingue',
      cat: 'solucion',
      title: 'Comunicación en wayuunaiki y español',
      ask: '¿En qué idiomas se comunica?',
      p: ['wayuunaiki', 'bilingue', 'bilingues', 'tableros bilingues', 'en que idioma', 'en que idiomas', 'idioma', 'lengua wayuu',
          'traduccion', 'en espanol'],
      k: 'wayuunaiki bilingue idioma traduccion espanol tableros comunicar',
      a: `
        <p>La propuesta prevé tableros y comunicación en wayuunaiki y español. La función de comunicar comprende alertas, reportes y tableros bilingües que expliquen qué ocurrió, dónde y qué respuesta se produjo.</p>
        <p class="al-note">Límite de diseño: los tableros bilingües deben probarse con usuarios y conectividad local.</p>`,
      see: ['solucion', 'tecnologia'],
      next: ['tecnologias', 'funciones', 'q10']
    },

    /* ---------- Clientes, inversión y sostenibilidad financiera ---------- */
    {
      id: 'modelo-negocio',
      cat: 'finanzas',
      title: 'Modelo de negocio',
      ask: '¿Cuál es el modelo de negocio?',
      p: ['modelo de negocio', 'modelo de negocios', 'como ganan plata', 'como ganan dinero', 'como gana plata', 'como gana dinero',
          'como se gana dinero', 'como hacen plata', 'como genera ingresos', 'como generan ingresos', 'de donde salen los ingresos',
          'de donde sale la plata', 'como se sostiene', 'como se sostendria', 'como se mantiene', 'cual es el negocio',
          'fuentes de ingreso', 'fuentes de ingresos', 'como facturan', 'servicio recurrente', 'como se monetiza', 'monetizacion',
          'sostenibilidad financiera', 'es sostenible', 'ingresos'],
      k: 'modelo negocio ingresos sostiene recurrente monetiza contratos sostenibilidad',
      a: `
        <p>La cooperativa presta un servicio recurrente a desarrolladores y operadores eólicos. La relación puede estructurarse mediante contratos de monitoreo, validación y reporte por parque, con un alcance técnico definido y cláusulas de independencia.</p>
        <p>El modelo puede complementarse con recursos de cooperación o capital semilla durante la fase inicial, pero su sostenibilidad debe depender progresivamente de ingresos por servicio.</p>
        <p>En la modelación, los ingresos se estiman como tarifa por parque multiplicada por el número de contratos; la tarifa de referencia es de <strong>COP 25 millones</strong> mensuales por parque.</p>
        <p class="al-note">La tarifa es un supuesto de planeación: debe validarse con los clientes antes de contratar.</p>`,
      see: ['modelo', 'finanzas'],
      next: ['tarifa', 'q11', 'q15']
    },
    {
      id: 'tarifa',
      cat: 'finanzas',
      title: 'Tarifa de referencia',
      ask: '¿Cuál es la tarifa de referencia?',
      p: ['tarifa', 'tarifa de referencia', 'precio de referencia', '25 millones', 'cuanto cobran', 'cuanto cobraria',
          'cuanto cuesta el servicio', 'precio del servicio', 'cuanto paga un parque', 'cuanto pagaria un parque',
          'cuanto pagan los parques', 'precio por parque', 'valor mensual', 'mensual', 'cuanto le cuesta a un parque',
          'cuanto le cuesta al parque'],
      k: 'tarifa mensual servicio integral',
      a: `
        <p>La modelación utiliza una tarifa inicial de <strong>COP 25 millones mensuales por parque</strong> para un servicio integral. Es un supuesto de planeación que agrupa personal, operación de campo, mantenimiento, conectividad, plataforma, validación y administración.</p>
        <p>No corresponde al precio de un sensor ni al punto de equilibrio. Antes de contratar, deberá validarse con alcance, frecuencia, distancias, variables medidas y disposición de pago de los clientes.</p>`,
      see: ['modelo'],
      next: ['q15', 'q12', 'modelo-negocio']
    },
    {
      id: 'que-compra',
      cat: 'finanzas',
      title: 'Qué compra el cliente',
      ask: '¿Qué compra exactamente el cliente?',
      p: ['que compra el cliente', 'que compra el parque', 'que contrata el parque', 'que compra exactamente', 'resultado favorable',
          'compra un resultado', 'que esta comprando'],
      k: 'compra contrata favorable capacidad',
      a: `
        <p>El parque no compra un resultado favorable ni controla lo que se publica. Contrata una capacidad independiente de monitoreo, verificación y respuesta.</p>
        <p>Esta separación es esencial: si quien paga pudiera modificar una medición o bloquear un reporte válido, la propuesta perdería precisamente el valor que busca crear.</p>`,
      see: ['servicio', 'modelo'],
      next: ['q17', 'q11', 'tarifa']
    },
    {
      id: 'reinversion',
      cat: 'finanzas',
      title: 'Excedentes y reinversión',
      ask: '¿Qué pasa con los excedentes?',
      p: ['excedentes', 'reinversion', 'reinvierte', 'reinvierten', 'en que se reinvierte', 'que pasa con las ganancias',
          'que hacen con las ganancias', 'que pasa con los excedentes', 'a donde va la plata', 'a donde van las utilidades',
          'quien se queda con la plata', 'quien se queda con las ganancias', 'reparten utilidades', 'disciplina financiera',
          'proposito economico', 'restauracion ambiental'],
      k: 'excedente reinversion reservas restauracion proposito',
      a: `
        <p>La naturaleza sin ánimo de lucro no elimina la disciplina financiera. La cooperativa debe cobrar por sus servicios, cubrir su operación y construir reservas.</p>
        <p>La diferencia está en el destino del excedente: la meta es reinvertir el <strong>100 %</strong> en formación, equipos y proyectos comunitarios, con un mínimo de <strong>10 %</strong> dirigido a protección o restauración ambiental cuando se generen excedentes.</p>`,
      see: ['solucion', 'impacto'],
      next: ['q4', 'indicadores', 'q14']
    },
    {
      id: 'presupuesto',
      cat: 'finanzas',
      title: 'Presupuesto del piloto por rubro',
      ask: '¿Cómo se reparte el presupuesto?',
      p: ['presupuesto', 'por rubro', 'rubros', 'desglose', 'detalle de la inversion', 'distribucion de la inversion', 'uso de recursos',
          'uso de los recursos', 'como se distribuye', 'como se reparte', 'cuanto para sensores', 'cuanto para drones',
          'cuanto para la plataforma', 'cuanto para formacion', 'partidas'],
      k: 'presupuesto rubro desglose reparte distribucion partidas recursos',
      a: `
        <p>La inversión inicial estimada es de <strong>COP 650 millones</strong>. El valor no corresponde a construir infraestructura eólica ni hídrica; financia una capacidad de monitoreo distribuida.</p>
        <dl class="al-kv">
          <div><dt>Sensores y equipos <b>150</b></dt><dd>Medición, muestreo, calibración y repuestos iniciales.</dd></div>
          <div><dt>Drones y accesorios <b>60</b></dt><dd>Registro en áreas autorizadas y soporte de campo.</dd></div>
          <div><dt>Plataforma y trazabilidad <b>110</b></dt><dd>Registro, tableros, permisos, alertas y seguimiento.</dd></div>
          <div><dt>Cómputo y conectividad <b>40</b></dt><dd>Dispositivos, almacenamiento y operación en zonas con brechas de conexión.</dd></div>
          <div><dt>Formación y protocolos <b>100</b></dt><dd>Certificación, seguridad, cadena de custodia y comunicación.</dd></div>
          <div><dt>Implementación territorial <b>70</b></dt><dd>Asambleas, acuerdos, desplazamientos y levantamiento de línea base.</dd></div>
          <div><dt>Operación inicial <b>120</b></dt><dd>Personal, validación, mantenimiento y contingencias de arranque.</dd></div>
          <div class="al-total"><dt>Total <b>650</b></dt><dd>Piloto en dos parques con 12 personas wayuu.</dd></div>
        </dl>
        <p class="al-note">Valores en millones de pesos colombianos (COP). El presupuesto debe detallarse con cotizaciones antes del cierre financiero.</p>`,
      see: ['inversion'],
      next: ['q13', 'q14', 'piloto']
    },
    {
      id: 'escenarios',
      cat: 'finanzas',
      title: 'Escenarios financieros',
      ask: '¿Cuáles son los escenarios financieros?',
      p: ['escenarios financieros', 'escenario', 'escenario expansivo', 'tres escenarios', 'lectura financiera', 'trayectoria comercial',
          'cartera de parques', 'que es el vpn', 'que significa vpn', 'valor presente neto', 'cuantos contratos',
          'cuantos parques proyectan'],
      k: 'escenario expansivo lectura trayectoria cartera vpn',
      a: `
        <p>La modelación compara escenarios conservador, base y expansivo. Los ingresos se estiman como tarifa por parque multiplicada por el número de contratos; la proyección base amplía la cartera de 2 a 5, 10, 16 y 24 parques en cinco años.</p>
        <dl class="al-kv">
          <div><dt>Conservador</dt><dd>Ingresos acumulados a cinco años de COP 10.200 millones, VPN (valor presente neto) al 15 % de COP 53 millones y recuperación en el año 5.</dd></div>
          <div><dt>Base</dt><dd>Ingresos acumulados de COP 17.100 millones, VPN al 15 % de COP 3.260 millones y recuperación en el año 3.</dd></div>
          <div><dt>Expansivo</dt><dd>Mayor adopción que el caso base, VPN superior al caso base y recuperación antes del año 3.</dd></div>
        </dl>
        <p>El resultado conservador es relevante porque conserva un VPN positivo, aunque con margen reducido. Esto no garantiza el retorno: indica que existe una ruta potencial de sostenibilidad si se validan el precio, la adopción, los costos de campo y la continuidad contractual.</p>
        <p class="al-note">Esta trayectoria comercial es un supuesto y no debe confundirse con la meta de impacto de 24 personas en cuatro parques.</p>`,
      see: ['finanzas'],
      next: ['q15', 'meta-vs-proyeccion', 'tarifa']
    },
    {
      id: 'solicitud',
      cat: 'finanzas',
      title: 'Qué se le propone al inversionista',
      ask: '¿Qué se le propone al inversionista?',
      p: ['que se solicita', 'que solicitan', 'que piden', 'que se pide', 'que necesitan', 'cual es la solicitud', 'que quieren',
          'que esperan del inversionista', 'la propuesta', 'propuesta al inversionista', 'cual es la propuesta', 'que me proponen',
          'que le proponen al inversionista', 'como puedo apoyar', 'como apoyar', 'quiero apoyar', 'como invertir',
          'como puedo invertir', 'como invierto', 'quiero invertir', 'como participo', 'como puedo participar', 'como ayudo',
          'como puedo ayudar', 'decision de inversion', 'esg'],
      k: 'solicita propuesta propone inversionista apoyar participar decision esg',
      a: `
        <p>Se propone invertir <strong>COP 650 millones</strong> en un piloto con gobierno comunitario, validación independiente y desembolsos por hitos. La decisión propuesta es financiar y acompañar un piloto controlado, no una expansión automática.</p>
        <p>La continuidad dependerá de cuatro condiciones: seguridad de los monitores, calidad y aceptación de los datos, uso efectivo de la evidencia y capacidad de cubrir progresivamente los costos recurrentes.</p>
        <p>El valor para el inversionista no se limita al rendimiento financiero directo. La iniciativa puede reducir exposición a retrasos y controversias, mejorar la trazabilidad de decisiones ESG y demostrar una forma de transición energética que deja capacidades en el territorio.</p>
        <p class="al-note">La información publicada no incluye un canal de contacto para formalizar un aporte.</p>`,
      see: ['propuesta', 'inversion'],
      next: ['q13', 'q14', 'q20']
    },

    /* ---------- Riesgos, impacto y escalamiento ---------- */
    {
      id: 'teoria-cambio',
      cat: 'riesgos',
      title: 'Teoría de cambio',
      ask: '¿Cuál es la teoría de cambio?',
      p: ['teoria de cambio', 'teoria del cambio', 'cadena causal', 'cadena de resultados', 'hipotesis',
          'como produce impacto', 'como genera impacto', 'como se genera el impacto', 'entradas actividades productos'],
      k: 'teoria cambio causal cadena hipotesis logica entradas actividades productos',
      a: `
        <p>Su punto de partida es una hipótesis sencilla: si la información se genera con participación comunitaria, protocolos técnicos y validación independiente, aumentará la probabilidad de que comunidad, empresa y autoridad la reconozcan como utilizable. Esa aceptación permite actuar antes y decidir con menor incertidumbre.</p>
        <ol>
          <li><strong>Entradas.</strong> Fondo piloto, consentimiento, equipos, personas formadoras, universidad y parques participantes.</li>
          <li><strong>Actividades.</strong> Formar, medir, validar, alertar, responder, comunicar y auditar.</li>
          <li><strong>Productos.</strong> Monitores certificados, registros trazables, alertas, respuestas y tableros.</li>
          <li><strong>Resultados.</strong> Mayor aceptación de los datos, reducción del tiempo de verificación y respuestas más oportunas.</li>
          <li><strong>Impacto.</strong> Menor incidencia de controversias informativas, capacidad territorial y una transición energética más confiable.</li>
        </ol>
        <p class="al-note"><strong>Lo que no puede afirmarse de antemano.</strong> Guardianes no puede atribuirse por sí solo la reducción de todos los conflictos o paralizaciones. Esos resultados también dependen de condiciones políticas, económicas, regulatorias y sociales. Por eso los indicadores se refieren a controversias de información y se comparan con una línea base, sin presentar correlación como causalidad automática.</p>`,
      see: ['cambio'],
      next: ['logica-piloto', 'no-afirmable', 'q18']
    },
    {
      id: 'logica-piloto',
      cat: 'riesgos',
      title: 'La lógica que debe probar el piloto',
      ask: '¿Qué lógica debe probar el piloto?',
      p: ['logica que debe probar el piloto', 'logica del piloto', 'que debe probar el piloto', 'que tiene que probar el piloto',
          'que debe demostrar el piloto', 'que va a probar el piloto', 'que pretende probar', 'cual es la logica',
          'como funciona la cadena', 'datos legitimos', 'alertas comprensibles', 'respuestas documentadas',
          'por que funcionaria', 'por que va a funcionar', 'tiene que demostrar el piloto', 'demostrar el piloto',
          'que demuestra el piloto', 'que prueba el piloto'],
      k: 'logica probar piloto demostrar cadena legitimos comprensibles documentadas responsable plazo',
      a: `
        <p>Datos legítimos permiten emitir alertas comprensibles. Las alertas, cuando tienen un responsable y un plazo, aceleran respuestas documentadas. Las respuestas oportunas reducen la repetición de eventos y la incertidumbre que alimenta las controversias.</p>
        <p>Si además la cooperativa cubre parte creciente de sus costos mediante contratos, la capacidad puede mantenerse y ampliarse.</p>
        <p class="al-note">Es lo que el piloto debe <strong>probar</strong>, no algo ya demostrado.</p>`,
      see: ['cambio', 'piloto'],
      next: ['no-afirmable', 'teoria-cambio', 'q5']
    },
    {
      id: 'no-afirmable',
      cat: 'riesgos',
      title: 'Lo que no puede afirmarse de antemano',
      ask: '¿Qué no puede afirmarse de antemano?',
      p: ['lo que no puede afirmarse', 'que no puede afirmarse', 'no puede afirmarse', 'que no se puede afirmar',
          'no se puede afirmar', 'que no pueden prometer', 'que no prometen', 'que no garantizan', 'que no garantiza',
          'garantiza reducir los conflictos', 'va a acabar con los conflictos', 'acaba con los conflictos',
          'elimina los conflictos', 'reduce todos los conflictos', 'puede garantizar', 'limites del proyecto',
          'que no puede atribuirse', 'atribuirse por si solo', 'garantiza que se acaben', 'se acaben los conflictos',
          'acaben los conflictos', 'fin de los conflictos', 'no habra conflictos', 'garantiza que'],
      k: 'afirmarse afirmar garantizar garantiza prometer limites atribuirse conflictos paralizaciones causalidad',
      a: `
        <p>Guardianes no puede atribuirse por sí solo la reducción de todos los conflictos o paralizaciones. Esos resultados también dependen de condiciones políticas, económicas, regulatorias y sociales.</p>
        <p>Por eso los indicadores se refieren a controversias de información y se comparan con una línea base, sin presentar correlación como causalidad automática.</p>`,
      see: ['cambio', 'impacto'],
      next: ['q18', 'logica-piloto', 'indicadores']
    },
    {
      id: 'indicadores',
      cat: 'riesgos',
      title: 'Ocho indicadores a 2030 y cuatro dimensiones',
      ask: '¿Qué metas hay hacia 2030?',
      p: ['indicadores', 'ocho indicadores', 'metas a 2030', 'metas 2030', 'metas hacia 2030', 'metas', 'que metas',
          'cuatro dimensiones', 'dimensiones', 'people planet prosperity place', 'people', 'planet', 'prosperity', 'place',
          'impacto hacia 2030', 'que impacto', 'que impacto tendra', 'impacto social', 'impacto ambiental', 'resultados esperados',
          'que se espera lograr', 'que quieren lograr', '2030', 'tiempo de verificacion', 'dias de paralizacion', 'gasto retenido',
          'cobertura de costos', '=impacto'],
      k: 'indicador meta dimensiones people planet prosperity place 2030 impacto',
      a: `
        <p>El proyecto organiza su impacto en cuatro dimensiones. <strong>People</strong> se concentra en participación y capacidades; <strong>Planet</strong>, en alertas y protección ambiental; <strong>Prosperity</strong>, en sostenibilidad financiera y valor retenido en el territorio; <strong>Place</strong>, en el uso de evidencia para las decisiones territoriales.</p>
        <dl class="al-kv">
          <div><dt>Personas wayuu certificadas</dt><dd>24 personas para cubrir cuatro parques; 50 % mujeres y 30 % jóvenes.</dd></div>
          <div><dt>Mediciones críticas utilizables</dt><dd>80 % reconocidas por comunidad, empresa y autoridad.</dd></div>
          <div><dt>Tiempo de verificación</dt><dd>−30 % al finalizar el piloto y −50 % en 2030.</dd></div>
          <div><dt>Alertas atendidas</dt><dd>80 % respondidas y documentadas en 72 horas.</dd></div>
          <div><dt>Días de paralización</dt><dd>−15 % en 2028 y −30 % en 2030 por controversias de información.</dd></div>
          <div><dt>Cobertura de costos recurrentes</dt><dd>70 % mediante contratos en 2030.</dd></div>
          <div><dt>Gasto retenido en el territorio</dt><dd>60 % del gasto operativo en 2030.</dd></div>
          <div><dt>Reinversión</dt><dd>100 % de excedentes; mínimo 10 % en protección o restauración ambiental.</dd></div>
        </dl>
        <p class="al-note">Son metas, no resultados alcanzados: deberán validarse durante el piloto.</p>`,
      see: ['impacto'],
      next: ['q18', 'meta-vs-proyeccion', 'teoria-cambio']
    },
    {
      id: 'controles',
      cat: 'riesgos',
      title: 'Los ocho riesgos y su control',
      ask: '¿Cómo se controla cada riesgo?',
      p: ['ocho riesgos', 'mecanismos de control', 'controles', 'control de riesgos', 'como se controlan los riesgos',
          'como se controla cada riesgo', 'como manejan los riesgos', 'gestion de riesgos', 'como se mitigan', 'mitigacion', 'mitigar',
          'control propuesto', 'condicion de decision', 'plan de contingencia', 'captura por un clan', 'un clan', 'cambio regulatorio',
          'cambio politico', 'interferencia del financiador'],
      k: 'controles control mitigacion mitigar mecanismos contingencia clan',
      a: `
        <p>La propuesta mitiga el riesgo de desinformación al anticipar controversias con evidencia producida bajo reglas compartidas, pero no elimina la desconfianza ni los conflictos. Además, la operación introduce riesgos que deben vigilarse desde el diseño:</p>
        <ul>
          <li><strong>Captura por un clan o grupo.</strong> Representación, conflictos de interés y mayoría calificada. <em>Adaptar o suspender si persiste la exclusión.</em></li>
          <li><strong>Amenazas a monitores.</strong> Ruta confidencial, Defensoría y suspensión preventiva. <em>No continuar sin protección efectiva.</em></li>
          <li><strong>Uso indebido de datos.</strong> Clasificación, permisos, auditoría de accesos y soberanía comunitaria. <em>Investigar, contener y revisar autorizaciones.</em></li>
          <li><strong>Baja calidad técnica.</strong> Calibración, cadena de custodia y validación independiente. <em>No publicar como evidencia válida.</em></li>
          <li><strong>Interferencia del financiador.</strong> Cláusulas de independencia y ausencia de veto. <em>Activar revisión externa o terminar el contrato.</em></li>
          <li><strong>Dependencia financiera.</strong> Fondo inicial, contratos escalonados y diversificación. <em>No escalar sin ruta de cobertura de costos.</em></li>
          <li><strong>Baja adopción de la evidencia.</strong> Diseño conjunto, comunicación bilingüe y encuestas separadas. <em>Adaptar formatos y protocolos.</em></li>
          <li><strong>Cambio político o regulatorio.</strong> Alineación institucional y documentación de cumplimiento. <em>Actualizar alcance sin debilitar la gobernanza.</em></li>
        </ul>
        <p class="al-note">En cursiva, la condición de decisión de cada riesgo.</p>`,
      see: ['controles'],
      next: ['q16', 'seguridad', 'q17']
    },
    {
      id: 'seguridad',
      cat: 'riesgos',
      title: 'Seguridad de los monitores',
      ask: '¿Cómo se protege a los monitores?',
      p: ['seguridad de los monitores', 'seguridad', 'amenazas', 'amenazas a monitores', 'que pasa si amenazan', 'si los amenazan',
          'proteccion de los monitores', 'como protegen a los monitores', 'como se protege a los monitores', 'ruta de proteccion',
          'es peligroso', 'es seguro', 'defensoria', 'derechos humanos', 'riesgo para los monitores'],
      k: 'seguridad amenaza proteccion defensoria peligroso confidencial preventiva',
      a: `
        <p>La seguridad de los monitores es una condición de continuidad, no un indicador compensable. Un buen resultado técnico o financiero no justifica operar cuando existen amenazas que no pueden controlarse.</p>
        <ul>
          <li><strong>Control propuesto.</strong> Ruta confidencial, Defensoría y suspensión preventiva.</li>
          <li><strong>Condición de decisión.</strong> No continuar sin protección efectiva.</li>
          <li><strong>Umbral del piloto.</strong> Los monitores pueden trabajar sin amenazas no controladas y existe una ruta de protección activa.</li>
        </ul>
        <p>El informe prevé que la Defensoría y las organizaciones de derechos humanos activen prevención y respuesta ante amenazas o presiones.</p>`,
      see: ['controles', 'piloto'],
      next: ['controles', 'piloto', 'q16']
    },
    {
      id: 'escalamiento',
      cat: 'riesgos',
      title: 'Escalamiento',
      ask: '¿Qué viene después del piloto?',
      p: ['escalamiento', 'como se escala', 'plan de expansion', 'plan de crecimiento', 'expansion', 'que pasa despues del piloto',
          'despues del piloto', 'que viene despues', 'primer ano', 'como crece', 'como creceria', 'se puede replicar',
          'replicar en otros', 'otros departamentos', 'otras regiones'],
      k: 'escalamiento expansion crecer despues replicar ampliar',
      a: `
        <p>La expansión debe seguir la evidencia y no precederla. El primer año está destinado a probar la capacidad de operar en dos parques, proteger a los monitores, producir datos aceptados y demostrar disposición de pago.</p>
        <p>Si esos resultados se cumplen, la cooperativa puede ampliar su cobertura conservando estándares técnicos y adaptando los acuerdos a cada comunidad.</p>
        <p class="al-note">Hacia 2030, la meta de impacto es de 24 personas en cuatro parques; la proyección comercial de hasta 24 parques es un supuesto independiente.</p>`,
      see: ['piloto', 'finanzas'],
      next: ['q20', 'meta-vs-proyeccion', 'escenarios']
    },
    {
      id: 'meta-vs-proyeccion',
      cat: 'riesgos',
      title: '24 personas en cuatro parques no son 24 parques',
      ask: '¿24 personas o 24 parques?',
      p: ['24 parques', 'veinticuatro parques', 'hasta 24 parques', '24 personas o 24 parques', 'meta de impacto',
          'proyeccion comercial', 'meta y proyeccion', '24 monitores', 'cuatro parques o 24', '4 parques o 24',
          'cuantos parques en 2030', 'cuantos parques', 'por que 24', 'cuatro parques', '4 parques', 'se confunde', 'confusion'],
      k: 'meta proyeccion comercial 24 cuatro parque independiente confunde',
      a: `
        <p>Son dos cifras distintas que conviene no mezclar:</p>
        <ul>
          <li><strong>Meta de impacto.</strong> 24 personas wayuu certificadas para cubrir cuatro parques hacia 2030, con 50 % mujeres y 30 % jóvenes.</li>
          <li><strong>Proyección comercial.</strong> La modelación base amplía la cartera de 2 a 5, 10, 16 y 24 parques en cinco años. Esta trayectoria comercial es un supuesto y no debe confundirse con la meta de impacto.</li>
        </ul>
        <p>El piloto, por su parte, iniciaría con <strong>12 personas wayuu</strong> en <strong>dos parques</strong>, seis por parque.</p>`,
      see: ['impacto', 'finanzas'],
      next: ['indicadores', 'escenarios', 'personas']
    },
    {
      id: 'personas',
      cat: 'riesgos',
      title: 'Monitores wayuu: 12 en el piloto, 24 hacia 2030',
      ask: '¿Cuántas personas participan?',
      p: ['cuantas personas', 'cuantas personas participan', 'cuantos monitores', 'cuantos empleos', 'cuanta gente',
          'quienes son los monitores', 'que es un monitor', 'monitores wayuu', 'monitores locales', 'monitores', 'mujeres', 'jovenes',
          '12 personas', '24 personas', 'doce personas', 'seis por parque', 'cuantas mujeres', 'empleo', 'genera empleo',
          'formacion de monitores', 'como se forman', 'quien mide', 'quien hace las mediciones', 'quien toma los datos',
          'enfoque de genero', 'participacion de mujeres', 'capacitacion', 'certificacion', 'personas certificadas'],
      k: 'personas monitor mujer joven empleo gente certificadas formacion capacitacion doce',
      a: `
        <p>El piloto iniciaría con <strong>12 personas wayuu</strong> como monitores, seis por parque, con metas de participación de mujeres y jóvenes.</p>
        <p>Hacia 2030, la meta de impacto es contar con <strong>24 personas wayuu certificadas</strong> para cubrir cuatro parques; 50 % mujeres y 30 % jóvenes.</p>
        <p>La formación comprende uso de equipos, cadena de custodia, seguridad y comunicación. Su resultado verificable son personas certificadas y pruebas de competencia; la universidad o laboratorio forma, calibra, valida muestras, certifica capacidades y audita calidad.</p>
        <p class="al-note">Son metas de planeación, no resultados alcanzados.</p>`,
      see: ['piloto', 'impacto'],
      next: ['piloto', 'seguridad', 'meta-vs-proyeccion']
    },

    /* ---------- El tráiler y este sitio (no aparece en el menú) ---------- */
    {
      id: 'trailer',
      cat: 'sitio',
      title: 'El tráiler: ocho escenas en 1:58',
      ask: '¿De qué trata el tráiler?',
      p: ['trailer', 'el video', 'video', 'ocho escenas', 'escenas', 'guion', 'storyboard', 'cuanto dura el video',
          'cuanto dura el trailer', 'duracion del video', 'de que trata el video', 'de que trata el trailer', 'que muestra el video',
          'donde esta el video', 'ver el video', 'voz en off', '1 58', 'narracion'],
      k: 'video escenas guion storyboard duracion narracion audio',
      a: `
        <p>El tráiler de Guardianes del Viento tiene una duración objetivo de <strong>1:58</strong> y avanza en ocho escenas:</p>
        <ol>
          <li><strong>La promesa y la tensión.</strong> La transición eólica convive con desconfianza y versiones distintas.</li>
          <li><strong>El riesgo global aterriza.</strong> La desinformación y el riesgo ambiental convergen en La Guajira.</li>
          <li><strong>Pregunta de giro.</strong> La comunidad puede producir y gobernar la evidencia.</li>
          <li><strong>La innovación.</strong> Guardianes integra conocimiento wayuu, tecnología y validación.</li>
          <li><strong>Teoría de cambio.</strong> Datos legítimos permiten alertas, respuestas y mejores decisiones.</li>
          <li><strong>Impacto verificable hacia 2030.</strong> El impacto se mide con metas concretas hacia 2030.</li>
          <li><strong>La inversión como alianza.</strong> El piloto necesita inversión y una alianza con roles independientes.</li>
          <li><strong>Decisión y llamado.</strong> El inversionista puede convertir incertidumbre en capacidad territorial.</li>
        </ol>
        <p class="al-note">El video abre el interés; el informe permite revisar los supuestos, indicadores, riesgos y condiciones que sostienen la propuesta antes de tomar una decisión.</p>`,
      see: ['trailer'],
      next: ['que-es', 'ods', 'imagenes']
    },
    {
      id: 'ods',
      cat: 'sitio',
      title: 'ODS que muestra el tráiler',
      ask: '¿Qué ODS muestra el tráiler?',
      p: ['ods', 'objetivos de desarrollo sostenible', 'desarrollo sostenible', 'agenda 2030', 'que ods', 'cuales ods', 'ods 6', 'ods 9',
          'ods 13', 'ods 16', 'naciones unidas', 'onu'],
      k: 'ods sostenible agenda onu',
      a: `
        <p>El guion del tráiler pide mostrar discretamente los íconos de los <strong>ODS 6, 9, 13 y 16</strong> en la escena 6, «Impacto verificable hacia 2030», junto a las metas del proyecto.</p>
        <p>La pauta de producción es no recitar los ODS, sino mostrar su relación visual.</p>
        <p class="al-note">El material publicado los cita por su número; no desarrolla una meta específica para cada uno.</p>`,
      see: ['trailer', 'impacto'],
      next: ['indicadores', 'trailer', 'referencias']
    },
    {
      id: 'referencias',
      cat: 'sitio',
      title: 'Referencias del proyecto',
      ask: '¿Qué referencias cita el proyecto?',
      p: ['referencias', 'bibliografia', 'fuentes', 'en que se basan', 'en que se basa', 'de donde salen los datos',
          'de donde sale la informacion', 'de donde sacan', 'que estudios', 'que autores', 'citas', 'upme', 'nesta', 'oxfam', 'serafeim',
          'oslo manual', 'manual de oslo', 'reyes garcia', 'stockholm', 'marco teorico', 'sustento teorico', 'sustento academico'],
      k: 'referencia bibliografia estudios autores citas upme nesta oxfam teorico',
      a: `
        <p>Referencias esenciales que cita el proyecto:</p>
        <ul>
          <li>Autoridad Nacional de Licencias Ambientales. (2025). <em>Avances estratégicos en Transición Energética Justa y gestión ambiental en La Guajira.</em></li>
          <li>Keeney, R. L., y Raiffa, H. (1976). <em>Decisions with multiple objectives.</em> Wiley.</li>
          <li>Nesta. (2013). <em>Development impact and you.</em></li>
          <li>Reyes García, V., et al. (2022). Data sovereignty in community based environmental monitoring. <em>BioScience, 72</em>(8), 714–717.</li>
          <li>Unidad de Planeación Minero Energética. (2026). <em>La revolución del viento en La Guajira.</em></li>
          <li>World Economic Forum. (2025). <em>The global risks report 2025.</em></li>
        </ul>
        <p>El informe del proyecto cita además: OECD y Eurostat (2018), <em>Oslo Manual</em>; Oxfam Colombia (2026), <em>Los conflictos del viento</em>; Serafeim (2022), <em>Purpose and Profit</em>; y Stockholm Environment Institute (2025), <em>Anajia Guajira</em>.</p>
        <p class="al-note">Los valores financieros son supuestos de planeación del proyecto y requieren validación comercial, técnica y contractual antes de una decisión de inversión.</p>`,
      see: ['referencias'],
      next: ['q3', 'seleccion', 'teoria-cambio']
    },
    {
      id: 'imagenes',
      cat: 'sitio',
      title: 'Imágenes y recreaciones visuales',
      ask: '¿Las imágenes son reales?',
      p: ['recreacion visual', 'recreaciones', 'las imagenes son reales', 'son reales las imagenes', 'son reales las fotos',
          'las fotos son reales', 'fotos reales', 'imagenes generadas', 'generadas con ia', 'hechas con ia',
          'hechas con inteligencia artificial', 'las personas son reales', 'quien es la joven', 'quien es la muchacha',
          'quien es la mujer', 'son actores', 'las fotos', 'fotos', 'la joven wayuu', 'protagonista',
          'fotos de campo', 'donde tomaron las fotos', 'donde se tomaron las fotos', 'son de la guajira', 'fotos de la guajira'],
      k: 'foto recreacion reales generadas protagonista visual',
      a: `
        <p>Hay dos tipos de imagen. Las de la sección «Territorio» son <strong>fotografías reales de campo, tomadas en La Guajira</strong>: el parque eólico, la costa y las rancherías.</p>
        <p>Las marcadas como «recreación visual» fueron generadas específicamente para este proyecto: no representan personas ni hechos reales.</p>
        <p>El guion del tráiler lo advierte escena por escena y fija dos reglas de representación: tratar la identidad wayuu con respeto, sin usar símbolos ceremoniales fuera de contexto, y no sugerir que las imágenes documentan hechos reales.</p>`,
      see: ['trailer', 'territorio'],
      next: ['trailer', 'que-es']
    },
    {
      id: 'lema',
      cat: 'sitio',
      title: 'Que la evidencia llegue primero',
      ask: '¿Cuál es el lema del proyecto?',
      p: ['lema', 'que la evidencia llegue primero', 'evidencia llegue primero', 'eslogan', 'slogan', 'mensaje final',
          'llamado a la accion', 'llamado', 'frase del proyecto', 'la transicion energetica necesita confianza'],
      k: 'lema eslogan slogan llamado frase mensaje',
      a: `
        <p>Es el cierre del tráiler: «Invierta en Guardianes del Viento. Hagamos que la evidencia llegue primero. La transición energética necesita confianza».</p>
        <p>Resume la cadena que el proyecto quiere probar: datos legítimos activan alertas; las alertas aceleran respuestas; y mejores decisiones reducen controversias.</p>`,
      see: ['trailer', 'cambio'],
      next: ['que-es', 'teoria-cambio', 'q20']
    },
    {
      id: 'contacto',
      cat: 'sitio',
      title: 'Datos de contacto',
      ask: '¿Cómo contacto al equipo?',
      p: ['como los contacto', 'como contactarlos', 'como me contacto', 'como me comunico', 'como les escribo', 'datos de contacto',
          'con quien hablo', 'con quien puedo hablar', 'hablar con alguien', 'hablar con una persona', 'un asesor',
          'numero de telefono', 'telefono', 'celular', 'correo electronico', 'correo', 'whatsapp', 'donde los encuentro',
          'redes sociales', 'instagram', 'linkedin', 'direccion', 'contacto'],
      k: 'contacto telefono celular correo whatsapp redes direccion escribir llamar hablar asesor',
      a: `
        <p>Ese dato no está en la información publicada del proyecto: el material con el que respondo no incluye teléfono, correo ni otro canal de contacto, y prefiero no inventarlo.</p>
        <p>Lo que sí puedo mostrarle es qué se le propone a quien quiera apoyar el piloto y bajo qué condiciones.</p>`,
      next: ['solicitud', 'q14', 'que-es']
    },
    {
      id: 'autoria',
      cat: 'sitio',
      title: 'Autores del proyecto',
      ask: '¿Quiénes son los autores?',
      p: ['quienes son los autores', 'quien es la autora', 'quien es el autor', 'los autores', 'nombre de los autores',
          'nombre de la autora', 'quien hizo', 'quien hizo esto', 'quien hizo el proyecto', 'quienes hicieron el proyecto',
          'quien lo hizo', 'quien escribio', 'quien lo escribio', 'quienes escribieron', 'quien creo', 'quien creo el proyecto',
          'quien presenta', 'quienes presentan', 'quien esta detras', 'quienes estan detras', 'quien lidera', 'quien es el equipo',
          'cual es el equipo', 'que universidad', 'de que universidad', 'cual universidad', 'que maestria', 'cual maestria',
          'maestria', 'es una tesis', 'tesis', 'trabajo de grado', 'programa academico', 'estudiante', 'estudiantes',
          'fundadores', 'fundadora', 'director', 'directora', 'jurado', 'autor', 'paola', 'guardiola', 'paola guardiola',
          'luis arturo', 'flechas', 'luis flechas', 'carlos humberto', 'loza', 'carlos loza'],
      k: 'autor universidad maestria tesis grado estudiante equipo fundadores lidera academico nombre paola guardiola flechas loza',
      a: `
        <p>Guardianes del Viento es una tesis de maestría de:</p>
        <ul>
          <li><strong>Paola Andrea Guardiola Núñez</strong></li>
          <li><strong>Luis Arturo Flechas Robles</strong></li>
          <li><strong>Carlos Humberto Loza Arenas</strong></li>
        </ul>
        <p>La universidad y el programa académico no están en la información publicada del proyecto, y prefiero no inventarlos. Tampoco se nombra a la institución que validaría los datos: el material habla siempre de «una universidad o laboratorio» independiente.</p>`,
      see: ['referencias'],
      next: ['referencias', 'que-es', 'actores']
    },
    {
      id: 'sitio',
      cat: 'sitio',
      title: 'Diseño y desarrollo del sitio',
      ask: '¿Quién hizo esta página?',
      p: ['quien hizo la pagina', 'quien hizo el sitio', 'quien hizo la web', 'quien hizo esta pagina', 'quien diseno',
          'quien diseno la pagina', 'quien desarrollo', 'quien desarrollo la pagina', 'quien programo', 'quien construyo la pagina',
          'quien te hizo', 'quien te creo', 'quien te programo', 'diseno de la pagina', 'creador de la pagina', 'creador del sitio',
          'the architect', 'dual engineer'],
      k: 'pagina sitio web diseno desarrollo desarrollador disenador programo construyo creador architect',
      a: `
        <p>El sitio, su identidad visual y este asistente fueron diseñados y desarrollados por el <strong>Dual Engineer Edwin Calderón Aguilera — The Architect</strong> · Soluciones profesionales.</p>
        <p>El contenido es del proyecto: sale del informe, del guion del tráiler y de la base de preguntas técnicas de Guardianes del Viento.</p>`,
      next: ['que-es', 'trailer', 'autoria']
    }
  ]
};
