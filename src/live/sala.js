/* ============================================================================
   LA SALA EN LA BASE DE DATOS
   ----------------------------------------------------------------------------
   boards/{pin}/
     meta          { creada, clave }   clave = la del enlace para moderar
     idioma        'es' | 'en'   lo siguen el proyector y todos los celulares
     estado        { idx, abierta, resultados, pizarra?, moderando?, fase? }
                   idx null = preparando (sala de espera); si no, la actividad
                   que se está mostrando. pizarra = el proyector muestra el
                   pizarrón encima (pizarra.js); cambiar de actividad lo aparta.
                   moderando = el proyector muestra la columna de moderación
                   (sin nombres), para corregir en grupo; se prende y apaga
                   desde el PC o desde la tablet, y sigue al cambiar de actividad.
                   fase = en qué pantalla va la apuesta (cierres.js); cambiar
                   de actividad la devuelve al principio
     pizarra       lo que escribe el docente en su tablet (pizarra.js)
     clase         { titulo, objetivo? }   salen en el PDF de la clase
                   (resumen.js); se cargan con un material
     actividades   [ { id, tipo, pregunta, alternativas? } ]
     participantes { pid: { nombre, at } }
     online        { pid: true | false }
     respuestas    { aid: { pid: { palabras | opcion | valor | texto | orden, at } } }
                   en «preguntas» cada uno guarda las suyas y sus votos:
                   { preguntas: { qid: { texto, at } }, votos: { qid: true }, at }
                   y reescribe el nodo entero, porque las reglas piden que `at`
                   sea la hora del servidor en cada escritura
     moderacion    { aid: { palabras: { clave: 'ocultar' | 'mostrar' },
                            abiertas: { pid: true | false },
                            correcciones: { pid: { texto, de } },
                            preguntas: { qid: true | false },
                            respondidas: { qid: true },
                            correccionesPreguntas: { qid: { texto, de } },
                            correccionesNube: { clave escrita: texto },
                            verCorrecciones: false?,
                            destapadas: { numero+dir: true },   (crucigrama y sopa)
                            borrador: { clave, texto, at },   (corregir en vivo)
                            vista: 'muro' | 'cuadricula' | 'columnas' | 'lista' } }
     fotos, minis  { aid: { pid: data URL } }   la abierta como tablero (tablero.js)
     comentarios   { aid: { cid: { de, en, texto, at } } }
     reacciones    { aid: { pid publicación: { pid quien reacciona: { tipo: true } } } }
                   (la corrección del docente; `de` = el texto que corrigió,
                   para que caduque sola si el estudiante cambia el suyo.
                   verCorrecciones = false si el curso ve solo la versión
                   limpia; si no está, ve qué se corrigió)

   Las respuestas van bajo el id de la actividad (aid) y no bajo su posición:
   si el docente reordena o borra una, cada respuesta sigue con su pregunta.

   Las acciones del docente viven aquí y no en una pantalla porque las usan dos:
   el proyector y el celular con que se modera. Dos copias de «siguiente»
   terminan haciendo cosas distintas.
   ========================================================================== */
import { claveDePalabra, empiezaOculta, limpiarAbierta, limpiarActividad, limpiarPalabra } from './logic.js'
import { FASES_APUESTA } from './cierres.js'
import { VISTAS, limpiarComentario } from './tablero.js'
import { limpiarObjetivo, limpiarTitulo } from './materiales.js'

export const raiz = (pin) => `boards/${pin}`

export const accionesDeSala = (store, pin) => {
  const base = raiz(pin)
  const corregirTexto = (ruta, texto, de) => {
    const limpio = limpiarAbierta(texto)
    return limpio && limpio !== limpiarAbierta(de) ? store.set(ruta, { texto: limpio, de: limpiarAbierta(de) }) : store.remove(ruta)
  }
  /* Cada actividad arranca abierta y con los resultados a la vista, salvo el
     semáforo, que arranca tapado (empiezaOculta). `tipo` es el de la actividad
     que se va a mostrar. */
  const mostrar = (idx, tipo) => store.update(`${base}/estado`, { idx, abierta: true, resultados: !empiezaOculta(tipo), pizarra: null, fase: null })
  return {
    mostrar,
    volverAPreparar: () => store.update(`${base}/estado`, { idx: null, abierta: false, resultados: false, pizarra: null, fase: null }),
    /* La apuesta pasa de pantalla. Al apostar se reabren las respuestas por si
       el docente las había cerrado escribiendo. */
    fase: (fase) => store.update(`${base}/estado`, { fase: FASES_APUESTA.includes(fase) ? fase : null, abierta: true }),
    moderando: (si) => store.update(`${base}/estado`, { moderando: si ? true : null }),
    abrir: (abierta) => store.update(`${base}/estado`, { abierta }),
    pizarra: (si) => store.update(`${base}/estado`, { pizarra: si ? true : null }),
    resultados: (resultados) => store.update(`${base}/estado`, { resultados }),
    guardarActividades: (lista) => store.set(`${base}/actividades`, lista.map(limpiarActividad)),
    guardarClase: ({ titulo, objetivo }) => store.set(`${base}/clase`, {
      titulo: limpiarTitulo(titulo), ...(limpiarObjetivo(objetivo) ? { objetivo: limpiarObjetivo(objetivo) } : {}),
    }),
    cambiarIdioma: (idioma) => store.set(`${base}/idioma`, idioma === 'en' ? 'en' : 'es'),
    moderarPalabra: (aid, clave, decision) => store.set(`${base}/moderacion/${aid}/palabras/${clave}`, decision),
    decidirAbierta: (aid, pid, decision) => store.set(`${base}/moderacion/${aid}/abiertas/${pid}`, decision),
    /* Con treinta celulares mandando su logro al muro, aprobar de a uno son
       treinta toques con el curso esperando. */
    /* Crucigrama: las palabras destapadas en la pantalla. Una vez destapada no
       se vuelve a tapar, aunque alguien se desconecte y baje la mitad. */
    destapar: (aid, claves) => (claves.length
      ? store.update(`${base}/moderacion/${aid}/destapadas`, Object.fromEntries(claves.map(k => [k, true])))
      : Promise.resolve()),
    aprobarVarias: (aid, pids) => store.update(`${base}/moderacion/${aid}/abiertas`, Object.fromEntries(pids.map(pid => [pid, true]))),
    /* Sin texto, se quita la corrección y vuelve a verse el original. */
    corregirAbierta: (aid, pid, texto, de) => corregirTexto(`${base}/moderacion/${aid}/correcciones/${pid}`, texto, de),
    corregirPregunta: (aid, qid, texto, de) => corregirTexto(`${base}/moderacion/${aid}/correccionesPreguntas/${qid}`, texto, de),
    /* Una palabra de la nube puede venir de varias escritas («beatifull»,
       «beautifull»): la corrección se anota para todas. Sin texto, se quita. */
    corregirPalabra: (aid, origenes, texto) => {
      const limpio = limpiarPalabra(texto)
      /* Ojo: «cancion» → «canción» es la misma clave y vale igual (la tilde). */
      const cambios = Object.fromEntries(origenes.map(c => [c, limpio && claveDePalabra(limpio) ? limpio : null]))
      return store.update(`${base}/moderacion/${aid}/correccionesNube`, cambios)
    },
    /* El borrador de una corrección, mientras se escribe (logic.js). Sin
       texto (null) se borra: se guardó o se canceló. */
    borrador: (aid, b) => (b
      ? store.set(`${base}/moderacion/${aid}/borrador`, { clave: b.clave, texto: String(b.texto).slice(0, 140), at: store.stamp() })
      : store.remove(`${base}/moderacion/${aid}/borrador`)),
    verCorrecciones: (aid, si) => store.set(`${base}/moderacion/${aid}/verCorrecciones`, si ? null : false),
    decidirPregunta: (aid, qid, decision) => store.set(`${base}/moderacion/${aid}/preguntas/${qid}`, decision),
    marcarRespondida: (aid, qid, si) => store.set(`${base}/moderacion/${aid}/respondidas/${qid}`, si ? true : null),
    /* LA ABIERTA COMO TABLERO (tablero.js). La vista la cambian el proyector
       y el celular del docente; los comentarios, cada estudiante los suyos y
       el docente cualquiera. Editar un comentario lo reescribe entero: las
       reglas piden la hora del servidor en cada escritura. Sin texto, se borra. */
    vista: (aid, v) => store.set(`${base}/moderacion/${aid}/vista`, VISTAS.includes(v) ? v : null),
    comentar: (aid, cid, { de, en, texto }) => {
      const limpio = limpiarComentario(texto)
      return limpio
        ? store.set(`${base}/comentarios/${aid}/${cid}`, { de, en, texto: limpio, at: store.stamp() })
        : store.remove(`${base}/comentarios/${aid}/${cid}`)
    },
    reaccionar: (aid, publicacion, quien, tipo, si) =>
      store.set(`${base}/reacciones/${aid}/${publicacion}/${quien}/${tipo}`, si ? true : null),
    /* La publicación con su foto. Los comentarios que tenía quedan sin dónde
       mostrarse y no se ven (se agrupan por publicación). */
    borrarPublicacion: (aid, pid) => Promise.all([
      store.remove(`${base}/respuestas/${aid}/${pid}`),
      store.remove(`${base}/fotos/${aid}/${pid}`),
      store.remove(`${base}/minis/${aid}/${pid}`),
      store.remove(`${base}/reacciones/${aid}/${pid}`),
    ]),
    cerrarSala: () => store.remove(base),
  }
}

export const conectados = (online) => Object.values(online || {}).filter(Boolean).length

/* Firebase guarda los arreglos como objetos con claves numéricas cuando les
   falta algún índice, y no guarda los vacíos. Esto devuelve siempre un arreglo. */
export const comoLista = (x) => (Array.isArray(x) ? x.filter(Boolean) : Object.values(x || {}))
