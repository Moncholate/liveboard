/* ============================================================================
   EL RESUMEN DE LA CLASE
   ----------------------------------------------------------------------------
   Lo que el docente comparte al final: una copia de la clase para que los
   estudiantes se la lleven en PDF (pedido el 8-oct-2026: sacaban fotos al
   proyector). Se copia aparte porque la sala se borra al cerrarla.

     resumenes/{id}   { creado, vence, idioma, titulo?, objetivo?, actividades: [...], pizarra }
     boards/{pin}/resumen   id   el aviso a los celulares que están en la sala

   Va SIN NOMBRES, igual que el proyector: solo lo que el curso ya vio. De las
   abiertas y las preguntas, solo las aprobadas (con la corrección del docente);
   de la nube, solo las palabras visibles; del resto, los totales. Los cierres
  igual: la duda, el muro y antes / ahora llevan solo lo aprobado; el
  semáforo y la apuesta, solo cuántos.

   Dura 15 días (el 8-oct-2026 el docente vio que se baja en la misma clase o
   nunca): las reglas no dejan leerlo después (database.rules.json), y
   el proyector borra los vencidos que creó en ese computador.
   ========================================================================== */
import { abiertas, consignasDe, conteoEncuesta, estadisticaEscala, idAlAzar, nube, preguntasDelCurso, resultadoRanking } from './logic.js'
import { calibracion, lecturaSemaforo, tarjetasMuro } from './cierres.js'
import { claveDe, palabrasDe, progreso } from './crucigrama.js'
import { claveSopa, palabrasSopa } from './sopa.js'
import { comoLista } from './sala.js'
import { fondoPizarraValido } from './pizarra.js'
import { columnaDe, columnasDe, comentariosPorPublicacion, esTablero, reaccionesDe } from './tablero.js'
import { limpiarObjetivo, limpiarTitulo } from './materiales.js'

export const DIAS = 15
export const DURACION_MS = DIAS * 24 * 60 * 60 * 1000

export const rutaResumen = (id) => `resumenes/${id}`
export const idResumenNuevo = (azar = Math.random) => idAlAzar(azar)
export const urlResumen = (id) => `${location.origin}${location.pathname}#/clase?id=${id}`

/** Una actividad, ya resuelta: solo lo que se proyectó, sin quién respondió.
    `extra` = { minis, comentarios, participantes } de la abierta como tablero. */
export const resultadoDe = (a, respuestas, moderacion, extra = {}) => {
  const base = { tipo: a.tipo, pregunta: a.pregunta }
  switch (a.tipo) {
    case 'nube':
      return { ...base, palabras: nube(respuestas, moderacion?.palabras, moderacion?.correccionesNube).filter(p => !p.oculta).map(p => ({ texto: p.texto, cuenta: p.cuenta })) }
    case 'encuesta': {
      const alternativas = a.alternativas || []
      return { ...base, alternativas, votos: conteoEncuesta(respuestas, alternativas.length).votos }
    }
    case 'escala': {
      const { votos, promedio } = estadisticaEscala(respuestas)
      return { ...base, votos, promedio }
    }
    case 'ranking': {
      const alternativas = a.alternativas || []
      const { filas, total } = resultadoRanking(respuestas, alternativas.length)
      return { ...base, alternativas, total, filas: filas.map(f => ({ i: f.i, puesto: f.puesto, promedio: f.promedio, puntos: f.puntos })) }
    }
    case 'abierta':
      if (esTablero(a)) return tableroDe(a, respuestas, moderacion, extra)
      return { ...base, textos: abiertas(respuestas, moderacion?.abiertas, {}, moderacion?.correcciones).aprobadas.map(r => r.texto) }
    case 'preguntas':
      return { ...base, preguntas: preguntasDelCurso(respuestas, moderacion).aprobadas.map(q => ({ texto: q.texto, votos: q.votos, respondida: q.respondida })) }
    case 'semaforo':
      return { ...base, votos: lecturaSemaforo(respuestas).votos }
    case 'duda':
      return { ...base, textos: aprobadas(respuestas, moderacion).map(r => r.texto) }
    case 'muro':
      return { ...base, textos: tarjetasMuro(aprobadas(respuestas, moderacion)).map(c => c.texto) }
    case 'antesahora':
      return {
        ...base, antes: a.antes || '', ahora: a.ahora || '',
        items: aprobadas(respuestas, moderacion).map(r => ({ antes: r.antes || '', ahora: r.ahora || '', texto: r.texto })),
      }
    case 'crucigrama': {
      /* Las palabras con su respuesta, y cuántos la sacaron: el PDF es para
         repasar, así que va resuelto. */
      const palabras = palabrasDe(a)
      const { por } = progreso(respuestas, palabras)
      return {
        ...base,
        palabras: palabras.map(p => ({ numero: p.numero, dir: p.dir, pista: p.pista || '', original: p.original, largo: p.palabra.length, sacaron: por[claveDe(p)] || 0 })),
      }
    }
    case 'sopa': {
      const palabras = palabrasSopa(a)
      const { por } = progreso(respuestas, palabras, claveSopa)
      return { ...base, palabras: palabras.map(p => ({ original: p.original, encontraron: por[claveSopa(p)] || 0 })) }
    }
    case 'apuesta': {
      const consignas = consignasDe(a)
      const { apostaron, compararon, exactos, deMas, deMenos } = calibracion(respuestas, consignas.length)
      return { ...base, consignas, apostaron, compararon, exactos, deMas, deMenos }
    }
    default:
      return null
  }
}

/* LA ABIERTA COMO TABLERO: cada publicación con su foto chica (la de los
   celulares: alcanza para el PDF y no infla el resumen) y sus comentarios.
   Los nombres van solo si la actividad los mostraba en el proyector. */
const tableroDe = (a, respuestas, moderacion, { minis, comentarios, reacciones, participantes } = {}) => {
  const nombres = a.nombres === true
  const columnas = columnasDe(a)
  const porPublicacion = comentariosPorPublicacion(comentarios, participantes)
  const publicaciones = abiertas(respuestas, moderacion?.abiertas, participantes, moderacion?.correcciones, a.sinModerar === true).aprobadas
    .map(r => ({
      texto: r.texto,
      ...(nombres && r.nombre ? { nombre: r.nombre } : {}),
      ...(columnas.length ? { columna: columnaDe(r, columnas.length) } : {}),
      ...(r.foto && typeof minis?.[r.pid] === 'string' ? { foto: minis[r.pid] } : {}),
      comentarios: (porPublicacion[r.pid] || []).map(c => ({ texto: c.texto, ...(nombres && c.nombre ? { nombre: c.nombre } : {}) })),
      ...reaccionesParaResumen(a, reacciones?.[r.pid], r.pid),
    }))
  return { tipo: a.tipo, pregunta: a.pregunta, publicaciones, ...(columnas.length ? { columnas } : {}), ...(nombres ? { nombres: true } : {}) }
}

const reaccionesParaResumen = (a, deLaPublicacion, autor) => {
  if (!a.reacciones) return {}
  const { cuenta, total } = reaccionesDe(deLaPublicacion, autor)
  return total ? { reacciones: cuenta } : {}
}

const aprobadas = (respuestas, moderacion) => abiertas(respuestas, moderacion?.abiertas, {}, moderacion?.correcciones).aprobadas

/** Una página de la pizarra vale la pena si tiene algo escrito. */
const paginasConAlgo = (pizarra) => {
  const fondo = fondoPizarraValido(pizarra?.vista?.fondo)
  const total = Math.max(1, pizarra?.vista?.paginas || 1)
  const paginas = []
  for (let i = 0; i < total; i++) {
    const trazos = pizarra?.paginas?.[i]?.trazos
    if (trazos && Object.keys(trazos).length) paginas.push({ trazos })
  }
  return { fondo, paginas }
}

/**
 * La copia de la sala para compartir. `sala` = el nodo boards/{pin} entero.
 * Las actividades sin ninguna respuesta no van: no hay nada que llevarse.
 */
export const armarResumen = (sala, ahora) => {
  const actividades = comoLista(sala?.actividades)
    .map(a => resultadoDe(a, sala?.respuestas?.[a.id], sala?.moderacion?.[a.id], {
      minis: sala?.minis?.[a.id], comentarios: sala?.comentarios?.[a.id], reacciones: sala?.reacciones?.[a.id], participantes: sala?.participantes,
    }))
    .filter(r => r && tieneAlgo(r))
  const titulo = limpiarTitulo(sala?.clase?.titulo)
  const objetivo = limpiarObjetivo(sala?.clase?.objetivo)
  return {
    creado: ahora,
    vence: ahora + DURACION_MS,
    idioma: sala?.idioma === 'en' ? 'en' : 'es',
    ...(titulo ? { titulo } : {}),
    ...(objetivo ? { objetivo } : {}),
    actividades,
    pizarra: paginasConAlgo(sala?.pizarra),
  }
}

export const tieneAlgo = (r) => {
  switch (r.tipo) {
    case 'nube': return r.palabras.length > 0
    case 'encuesta': case 'escala': return r.votos.some(v => v > 0)
    case 'ranking': return r.total > 0
    case 'abierta': return (r.textos || r.publicaciones || []).length > 0
    case 'preguntas': return r.preguntas.length > 0
    case 'semaforo': return r.votos.some(v => v > 0)
    case 'duda': case 'muro': return r.textos.length > 0
    case 'antesahora': return r.items.length > 0
    case 'apuesta': return r.apostaron > 0
    case 'crucigrama': return r.palabras.some(p => p.sacaron > 0)
    case 'sopa': return r.palabras.some(p => p.encontraron > 0)
    default: return false
  }
}

export const resumenVacio = (r) => !r.actividades.length && !r.pizarra.paginas.length

/* ── Los que creó este computador, para borrarlos al vencer ────────────── */

const MIOS_KEY = 'liveboard-resumenes'
export const leerMios = () => { try { return JSON.parse(localStorage.getItem(MIOS_KEY)) || {} } catch { return {} } }
export const guardarMios = (m) => { try { localStorage.setItem(MIOS_KEY, JSON.stringify(m)) } catch { /* modo privado */ } }

/** Los ids ya vencidos de una lista { id: vence }. */
export const vencidos = (mios, ahora) => Object.entries(mios || {}).filter(([, v]) => v <= ahora).map(([id]) => id)
