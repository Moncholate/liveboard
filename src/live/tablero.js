/* ============================================================================
   LA PREGUNTA ABIERTA COMO TABLERO (14-oct-2026)
   ----------------------------------------------------------------------------
   Un muro de publicaciones dentro de la pregunta abierta: cada uno
   publica una tarjeta (texto, foto o los dos), los demás comentan debajo, y el
   proyector las ordena de cuatro maneras que se cambian en vivo. Todo con
   opciones que el docente prende al armar la actividad; con todas apagadas, la
   abierta es la de siempre.

     foto         se puede subir una foto (la cámara o la galería)
     comentarios  los compañeros comentan las publicaciones
     nombres      cada tarjeta y cada comentario llevan el nombre de quien lo
                  escribió (sin esto, la abierta es anónima)
     reacciones   👍 Bien dicho, 💡 Buena idea, 🤔 No entendí, 🔍 Revisa algo:
                  feedback a los compañeros, anónimo (se ve cuántas, no quién)
     sinModerar   se publica al instante; el docente edita o quita después.
                  Lo que el filtro marca como grosería espera igual.
     columnas     2 a 4 secciones («There is» / «There are», «Hall» /
                  «Biblioteca»); cada uno elige en cuál publica

   En la base (sala.js):
     respuestas/{aid}/{pid}    { texto?, foto?: true, columna?, desde, at }
     fotos/{aid}/{pid}         la foto para el proyector (JPEG, ~1280 px)
     minis/{aid}/{pid}         la misma, chica, para los celulares y el PDF
     comentarios/{aid}/{cid}   { de: pid, en: pid de la publicación, texto, at }
     reacciones/{aid}/{pid de la publicación}/{pid de quien reacciona}/{tipo}  true
     moderacion/{aid}/vista    'muro' | 'cuadricula' | 'columnas' | 'lista'

   Dos tamaños de foto porque treinta celulares bajando treinta fotos grandes
   son casi 100 MB por clase, y el plan gratis de Firebase tiene un tope al
   mes. Todo se borra al cerrar la sala; lo que queda es el PDF.
   ========================================================================== */
import { esGroseria } from './groserias.js'

export const LIMITES_TABLERO = {
  columna: 30,
  minColumnas: 2,
  maxColumnas: 4,
  comentario: 140,
  comentariosPorPersona: 10,
  /* Lado mayor de cada foto, en píxeles, y el tope de lo que se guarda (en
     caracteres del data URL; las reglas de la base piden lo mismo). */
  fotoGrande: 1280,
  fotoChica: 480,
  maxGrande: 200000,
  maxChica: 60000,
}

/* Las opciones que se prenden con un sí. */
export const OPCIONES = ['foto', 'comentarios', 'reacciones', 'nombres', 'sinModerar']

/** Las columnas de la actividad, limpias. Una sola no ordena nada: sin
    columnas. */
export const columnasDe = (a) => {
  const lista = (Array.isArray(a?.columnas) ? a.columnas : Object.values(a?.columnas || {}))
    .map(x => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, LIMITES_TABLERO.columna))
    .filter(Boolean)
    .slice(0, LIMITES_TABLERO.maxColumnas)
  return lista.length >= LIMITES_TABLERO.minColumnas ? lista : []
}

/** Lo que se guarda de las opciones: solo las prendidas. */
export const opcionesLimpias = (a) => {
  if (a?.tipo !== 'abierta') return {}
  const salida = {}
  for (const k of OPCIONES) if (a[k] === true) salida[k] = true
  const columnas = columnasDe(a)
  if (columnas.length) salida.columnas = columnas
  return salida
}

/** ¿Es una abierta con algo de tablero? Sin nada prendido, se responde y se
    proyecta como siempre. */
export const esTablero = (a) => a?.tipo === 'abierta' && (OPCIONES.some(k => a[k] === true) || columnasDe(a).length > 0)

/** ¿Los celulares ven lo que publican los demás? Si se puede comentar, hay
    que verlo; si se publica al instante, también. */
export const celularVeElMuro = (a) => a?.comentarios === true || a?.reacciones === true || a?.sinModerar === true

/* ── Cómo se ordena en el proyector ──────────────────────────────────────── */

export const VISTAS = ['muro', 'cuadricula', 'columnas', 'lista']

/** Las maneras de ordenar que tiene sentido ofrecer: columnas, solo si hay. */
export const vistasDe = (a) => VISTAS.filter(v => v !== 'columnas' || columnasDe(a).length > 0)

/** La que se está usando. Sin elegir: columnas si las hay, el muro si hay
    fotos (de distinto alto, se acomodan como ladrillos) y si no, la
    cuadrícula, que es como siempre se vio la abierta. */
export const vistaDe = (a, moderacion) => {
  const v = moderacion?.vista
  if (vistasDe(a).includes(v)) return v
  if (columnasDe(a).length) return 'columnas'
  return a?.foto ? 'muro' : 'cuadricula'
}

/** La columna de una publicación; una que ya no existe cae en la primera. */
export const columnaDe = (r, n) => (Number.isInteger(r?.columna) && r.columna >= 0 && r.columna < n ? r.columna : 0)

/** Las publicaciones repartidas en `n` columnas, cada una en su orden. */
export const porColumna = (publicaciones, n) => {
  const cols = Array.from({ length: n }, () => [])
  for (const p of publicaciones) cols[columnaDe(p, n)].push(p)
  return cols
}

/* ── Comentarios ─────────────────────────────────────────────────────────── */

export const limpiarComentario = (s) => String(s == null ? '' : s)
  .normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, LIMITES_TABLERO.comentario)

/**
 * Los comentarios agrupados por la publicación que comentan, en orden de
 * llegada: { pidDeLaPublicacion: [{ cid, de, texto, nombre, at, mio, groseria }] }.
 * Lo que el filtro marca no se ve (`conGroserias` lo deja, para el docente).
 */
export const comentariosPorPublicacion = (comentarios, participantes = {}, { yo = null, conGroserias = false } = {}) => {
  const grupos = {}
  for (const [cid, c] of Object.entries(comentarios || {})) {
    const texto = limpiarComentario(c?.texto)
    if (!texto || typeof c?.en !== 'string') continue
    const groseria = esGroseria(texto)
    if (groseria && !conGroserias) continue
    ;(grupos[c.en] ||= []).push({
      cid,
      de: c.de,
      en: c.en,
      texto,
      nombre: participantes?.[c.de]?.nombre || '',
      at: typeof c.at === 'number' ? c.at : 0,
      mio: yo != null && c.de === yo,
      groseria,
    })
  }
  for (const k of Object.keys(grupos)) grupos[k].sort((a, b) => a.at - b.at || a.cid.localeCompare(b.cid))
  return grupos
}

/** Cuántos comentarios lleva escritos alguien en esta actividad. */
export const comentariosDe = (comentarios, pid) => Object.values(comentarios || {}).filter(c => c?.de === pid).length

/* ── Reacciones ─────────────────────────────────────────────────────────── */

/* Reacciones PEDAGÓGICAS (14-oct-2026): no «me gusta», sino feedback que le
   sirve al autor. Dos para reconocer y dos para mejorar. El docente eligió que
   todas se vean, en el proyector y en los celulares; nunca quién reaccionó. */
export const REACCIONES = [
  { id: 'bien', emoji: '👍' },
  { id: 'idea', emoji: '💡' },
  { id: 'duda', emoji: '🤔' },
  { id: 'revisa', emoji: '🔍' },
]
const TIPOS_REACCION = REACCIONES.map(r => r.id)

/**
 * Las reacciones de una publicación: cuántas de cada tipo y cuáles puso `yo`.
 * `deLaPublicacion` = { pidDeQuienReacciona: { tipo: true } }. Las del propio
 * autor no cuentan (no se reacciona a lo propio).
 */
export const reaccionesDe = (deLaPublicacion, autor, yo = null) => {
  const cuenta = Object.fromEntries(TIPOS_REACCION.map(k => [k, 0]))
  const mias = {}
  for (const [quien, tipos] of Object.entries(deLaPublicacion || {})) {
    if (quien === autor) continue
    for (const k of TIPOS_REACCION) {
      if (tipos?.[k] !== true) continue
      cuenta[k]++
      if (quien === yo) mias[k] = true
    }
  }
  return { cuenta, mias, total: TIPOS_REACCION.reduce((s, k) => s + cuenta[k], 0) }
}

/* ── Fotos ───────────────────────────────────────────────────────────────── */

/** El tamaño al que se achica una foto: el lado mayor a `max`, sin agrandar. */
export const medidasFoto = (ancho, alto, max) => {
  const escala = Math.min(1, max / Math.max(ancho, alto, 1))
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) }
}

/** ¿Es una foto que la base acepta? */
export const fotoValida = (s, max) => typeof s === 'string' && s.startsWith('data:image/jpeg;base64,') && s.length <= max
