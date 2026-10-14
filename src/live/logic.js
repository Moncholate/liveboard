/* ============================================================================
   LA LÓGICA DE LIVE BOARD
   ----------------------------------------------------------------------------
   Todo lo que no es pantalla: qué es cada actividad, cómo se limpia lo que
   escribe un estudiante, cómo se cuentan las respuestas y qué se oculta. Es
   puro —ni React ni Firebase— para poder probarlo (logic.test.js).

   La regla que manda: EL PROYECTOR NUNCA EXPONE A NADIE. No muestra nombres,
   las respuestas abiertas salen solo si el docente las aprueba, y una palabra
   con groserías no llega a la nube aunque nadie alcance a moderarla.
   ========================================================================== */
import { esGroseria } from './groserias.js'
import { limpiarCrucigrama, palabrasDe as palabrasCrucigrama } from './crucigrama.js'
import { limpiarSopa, palabrasSopa } from './sopa.js'
import { opcionesLimpias } from './tablero.js'

/* Los tipos de actividad, en el orden en que se ofrecen. Sus nombres y su
   ayuda están en i18n.jsx (tipo_nube, ayuda_nube…), en los dos idiomas.

   LOS CIERRES (8-oct-2026) son las cinco herramientas de cierre de Teacher's
   Toolbox, ahora con el curso respondiendo desde el celular. En el Belt
   siguen funcionando sin internet; su botón «Hacer con celulares» abre una
   sala de Liveboard con lo que el docente escribió ya cargado (traida.js).
   Su lógica propia —huecos, semáforo, apuesta, muro— está en cierres.js. */
export const BASICOS = ['nube', 'encuesta', 'escala', 'abierta', 'ranking', 'preguntas']
export const CIERRES = ['semaforo', 'duda', 'apuesta', 'antesahora', 'muro']
/* El crucigrama y la sopa de letras también llegan del Belt, ya armados
   (crucigrama.js, sopa.js), pero no se ofrecen en «Agregar»: aquí no hay con
   qué armarlos. */
export const ARMADOS = ['crucigrama', 'sopa']
export const TIPOS = [...BASICOS, ...CIERRES, ...ARMADOS]
/** Lo que puede llegar del Toolbox por «Hacer con celulares». */
export const DESDE_BELT = [...CIERRES, ...ARMADOS]

/** Los que llevan texto libre y se moderan como las abiertas: solo se
    proyectan los que el docente aprueba, y se pueden corregir. */
export const conTexto = (tipo) => ['abierta', 'duda', 'muro', 'antesahora'].includes(tipo)
export const moderable = (tipo) => conTexto(tipo) || tipo === 'nube' || tipo === 'preguntas'

/** Antes / Ahora y la apuesta se explican solos: la pregunta es opcional y,
    sin ella, el título es el nombre del tipo (tituloDe). */
export const preguntaOpcional = (tipo) => tipo === 'antesahora' || tipo === 'apuesta' || ARMADOS.includes(tipo)

/** El semáforo arranca con el resultado tapado, como en el Belt: si el verde
    ya se ve lleno, el que dudaba elige verde. Se destapa con «Mostrar resultados». */
export const empiezaOculta = (tipo) => tipo === 'semaforo'

export const LIMITES = {
  pregunta: 140,
  palabra: 25,
  palabrasPorPersona: 3,
  alternativa: 60,
  minAlternativas: 2,
  maxAlternativas: 4,
  abierta: 140,
  nombre: 16,
  minRanking: 3,
  maxRanking: 6,
  preguntasPorPersona: 3,
  /* Antes / Ahora: cada lado es una idea corta; el «porque» usa el largo de
     una abierta, que es la parte que vale. */
  lado: 60,
  /* Apuesta: las consignas, una por línea. Con más de 8, escribirlas no cabe
     en un cierre. */
  consigna: 140,
  maxConsignas: 8,
}

/* ── Los huecos de un molde ────────────────────────────────────────────────
   La duda y el muro proyectan una frase que el docente escribe con huecos, como
   en el pizarrón: una fila de guiones bajos. Tres o más, porque dos aparecen en
   nombres de archivo. Es la misma regla de molde.js del Belt. */

/** Parte una frase en trozos `{ tipo: 'texto' | 'hueco', valor }`. */
export const partirEnHuecos = (texto) => {
  const s = String(texto == null ? '' : texto)
  if (!s) return []
  const trozos = []
  const re = /_{3,}/g
  let ultimo = 0, m
  while ((m = re.exec(s)) !== null) {
    if (m.index > ultimo) trozos.push({ tipo: 'texto', valor: s.slice(ultimo, m.index) })
    trozos.push({ tipo: 'hueco', valor: m[0] })
    ultimo = m.index + m[0].length
  }
  if (ultimo < s.length) trozos.push({ tipo: 'texto', valor: s.slice(ultimo) })
  return trozos
}

/** ¿Hay algo que proyectar? Un molde de puros huecos no dice nada. */
export const tieneTexto = (texto) => partirEnHuecos(texto).some(t => t.tipo === 'texto' && t.valor.trim())

/** El título de una actividad: su pregunta, o el nombre del tipo si la pregunta
    es opcional y quedó vacía. `t` es el traductor de la sala. */
export const tituloDe = (a, t) => String(a?.pregunta || '').trim() || (preguntaOpcional(a?.tipo) ? t(`tipo_${a.tipo}`) : '')

/** Cuántas alternativas lleva cada tipo. Un ranking de 2 sería una encuesta,
    y con más de 6 ordenar en el celular se vuelve un trámite. */
export const rangoAlternativas = (tipo) => (tipo === 'ranking'
  ? { min: LIMITES.minRanking, max: LIMITES.maxRanking }
  : { min: LIMITES.minAlternativas, max: LIMITES.maxAlternativas })

/** Los tipos que el docente arma con una lista de alternativas. */
export const conAlternativas = (tipo) => tipo === 'encuesta' || tipo === 'ranking'

/* Letras y colores de las alternativas: los mismos de Kachai, que a propósito
   no son los de Kahoot (ni figuras ni rojo-azul-amarillo-verde). */
export const ALTERNATIVAS = [
  { letra: 'A', solido: 'bg-violet-600', texto: 'text-violet-700', tinte: 'bg-violet-50', borde: 'border-violet-600' },
  { letra: 'B', solido: 'bg-teal-600', texto: 'text-teal-700', tinte: 'bg-teal-50', borde: 'border-teal-600' },
  { letra: 'C', solido: 'bg-orange-500', texto: 'text-orange-700', tinte: 'bg-orange-50', borde: 'border-orange-500' },
  { letra: 'D', solido: 'bg-pink-600', texto: 'text-pink-700', tinte: 'bg-pink-50', borde: 'border-pink-600' },
]

/** Una actividad nueva, lista para editar. El id no cambia aunque se
    reordene la lista: las respuestas se guardan bajo él, no bajo la posición. */
export const actividadNueva = (tipo, azar = Math.random) => ({
  id: idAlAzar(azar),
  tipo,
  pregunta: '',
  ...(conAlternativas(tipo) ? { alternativas: Array(rangoAlternativas(tipo).min).fill('') } : {}),
  ...(tipo === 'antesahora' ? { antes: '', ahora: '' } : {}),
  ...(tipo === 'apuesta' ? { consignas: [''] } : {}),
})

/** Las consignas de una apuesta, limpias: sin líneas vacías y hasta 8. */
export const consignasDe = (a) => (Array.isArray(a?.consignas) ? a.consignas : Object.values(a?.consignas || {}))
  .map(x => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, LIMITES.consigna))
  .filter(Boolean)
  .slice(0, LIMITES.maxConsignas)

/** Un lado de Antes / Ahora, limpio. */
export const limpiarLado = (s) => String(s == null ? '' : s).normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, LIMITES.lado)

/** ¿Se puede lanzar? Devuelve el motivo si no —una clave de i18n.jsx
    (prob_sinPregunta…)— para decirlo en pantalla en el idioma de la sala. */
export const problemaDe = (a) => {
  if (!a || !TIPOS.includes(a.tipo)) return 'prob_sinTipo'
  if (!preguntaOpcional(a.tipo) && !String(a.pregunta || '').trim()) return 'prob_sinPregunta'
  if ((a.tipo === 'duda' || a.tipo === 'muro') && !tieneTexto(a.pregunta)) return 'prob_sinMolde'
  if (a.tipo === 'apuesta' && !consignasDe(a).length) return 'prob_sinConsignas'
  if (a.tipo === 'crucigrama' && palabrasCrucigrama(a).length < 2) return 'prob_sinCrucigrama'
  if (a.tipo === 'sopa' && !palabrasSopa(a).length) return 'prob_sinSopa'
  if (conAlternativas(a.tipo)) {
    const llenas = (a.alternativas || []).filter(x => String(x).trim())
    if (llenas.length < rangoAlternativas(a.tipo).min) return a.tipo === 'ranking' ? 'prob_pocosElementos' : 'prob_pocasAlternativas'
  }
  return null
}

/** Lo que se guarda en la sala: sin espacios de sobra ni alternativas vacías. */
export const limpiarActividad = (a) => ({
  ...(a.id ? { id: a.id } : {}),
  tipo: a.tipo,
  pregunta: String(a.pregunta || '').trim().slice(0, LIMITES.pregunta),
  ...(conAlternativas(a.tipo)
    ? { alternativas: (a.alternativas || []).map(x => String(x).trim().slice(0, LIMITES.alternativa)).filter(Boolean).slice(0, rangoAlternativas(a.tipo).max) }
    : {}),
  /* Un lado vacío significa «que lo escriba cada uno»: no se guarda. */
  ...(a.tipo === 'antesahora' && limpiarLado(a.antes) ? { antes: limpiarLado(a.antes) } : {}),
  ...(a.tipo === 'antesahora' && limpiarLado(a.ahora) ? { ahora: limpiarLado(a.ahora) } : {}),
  ...(a.tipo === 'apuesta' ? { consignas: consignasDe(a) } : {}),
  ...(a.tipo === 'crucigrama' ? limpiarCrucigrama(a) : {}),
  ...(a.tipo === 'sopa' ? limpiarSopa(a) : {}),
  /* La abierta como tablero: foto, comentarios, nombres, columnas (tablero.js). */
  ...opcionesLimpias(a),
})

/* ── Palabras ──────────────────────────────────────────────────────────── */

/** Lo que se ve: espacios de sobra fuera, sin signos en los bordes. */
export const limpiarPalabra = (s) => String(s == null ? '' : s)
  .normalize('NFC')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
  .slice(0, LIMITES.palabra)

/** La clave para agrupar: «Revolución», «revolucion» y «REVOLUCIÓN » son la
    misma palabra. La ñ se queda: «año» y «ano» no lo son. Sin . # $ [ ] /,
    que Firebase no acepta en una clave (la clave va en la ruta de moderación). */
export const claveDePalabra = (s) => limpiarPalabra(s)
  .toLowerCase()
  .replace(/[^ñ]/g, ch => ch.normalize('NFD').replace(/[̀-ͯ]/g, ''))
  .replace(/[.#$[\]/]/g, '')

/** Lo que manda un estudiante: hasta 3 palabras distintas, no vacías. */
export const palabrasDe = (lista) => {
  const vistas = new Set()
  const salida = []
  for (const p of lista || []) {
    const texto = limpiarPalabra(p)
    const clave = claveDePalabra(texto)
    if (!clave || vistas.has(clave)) continue
    vistas.add(clave)
    salida.push(texto)
    if (salida.length === LIMITES.palabrasPorPersona) break
  }
  return salida
}

/**
 * La nube: cada palabra con cuántos la escribieron, de más a menos.
 *
 * `moderacion` = { clave: 'ocultar' | 'mostrar' } lo que decidió el docente.
 * Una grosería entra OCULTA aunque nadie la haya revisado (`auto`), y se ve
 * solo si el docente la restaura. Así una palabra fea no alcanza a proyectarse
 * en el segundo que tarda en reaccionar.
 */
export const nube = (respuestas, moderacion = {}, correcciones = {}) => {
  const grupos = new Map()
  for (const r of Object.values(respuestas || {})) {
    for (const texto of palabrasDe(r?.palabras)) {
      const clave = claveDePalabra(texto)
      const g = grupos.get(clave) || { clave, cuenta: 0, formas: new Map() }
      g.cuenta++
      g.formas.set(texto, (g.formas.get(texto) || 0) + 1)
      grupos.set(clave, g)
    }
  }
  /* CORREGIR UNA PALABRA (8-oct-2026): `correcciones` = { clave escrita: texto
     corregido }. La palabra corregida se suma a la que ya estaba bien escrita:
     2 «beatifull» corregidas + 3 «beautiful» = 5 «beautiful». `origenes` son
     las claves escritas que quedaron en cada palabra (para corregir o quitar
     la corrección), y `antes` lo que se escribió mal, para mostrar el cambio. */
  const finales = new Map()
  for (const g of grupos.values()) {
    /* Se muestra la forma que más gente escribió: si 5 pusieron «Revolución»
       y 1 «revolucion», sale con tilde. */
    const escrito = [...g.formas.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]
    const corregido = limpiarPalabra(correcciones?.[g.clave])
    const valeLaCorreccion = corregido && claveDePalabra(corregido) && corregido !== escrito
    const texto = valeLaCorreccion ? corregido : escrito
    const clave = claveDePalabra(texto)
    const f = finales.get(clave) || { clave, texto, cuenta: 0, origenes: [], antes: [], bienEscrita: false }
    f.cuenta += g.cuenta
    f.origenes.push(g.clave)
    if (valeLaCorreccion) f.antes.push(escrito)
    else if (!f.bienEscrita) { f.texto = escrito; f.bienEscrita = true }
    finales.set(clave, f)
  }
  return [...finales.values()]
    .map(f => {
      const auto = esGroseria(f.texto) || f.antes.some(esGroseria)
      const decision = moderacion?.[f.clave]
      const oculta = decision === 'ocultar' || (auto && decision !== 'mostrar')
      return { clave: f.clave, texto: f.texto, cuenta: f.cuenta, auto, oculta, origenes: f.origenes, antes: f.antes, corregida: f.antes.length > 0 }
    })
    .sort((a, b) => b.cuenta - a.cuenta || a.texto.localeCompare(b.texto))
}

/** ¿El proyector muestra qué se corrigió (tachado y subrayado)? Sí, salvo que
    el docente lo apague en esa actividad: el curso aprende viendo el error
    arreglado, y como no lleva nombre, no expone a nadie (8-oct-2026). */
export const seVenCorrecciones = (moderacion) => moderacion?.verCorrecciones !== false

/** Tamaño de una palabra en la nube, en rem: la más repetida es la más grande. */
export const tamanoEnNube = (cuenta, maximo) => {
  if (!maximo || maximo <= 1) return 2.5
  return 1.25 + ((cuenta - 1) / (maximo - 1)) * 3.75
}

/* ── Encuesta y escala ─────────────────────────────────────────────────── */

/** Votos por alternativa. Un voto fuera de rango no cuenta. */
export const conteoEncuesta = (respuestas, cuantas) => {
  const votos = Array(cuantas).fill(0)
  for (const r of Object.values(respuestas || {})) {
    const i = r?.opcion
    if (Number.isInteger(i) && i >= 0 && i < cuantas) votos[i]++
  }
  return { votos, total: votos.reduce((a, b) => a + b, 0) }
}

/** Cuántos eligieron cada valor de 1 a 5, y el promedio con un decimal. */
export const estadisticaEscala = (respuestas) => {
  const votos = [0, 0, 0, 0, 0]
  let suma = 0
  for (const r of Object.values(respuestas || {})) {
    const v = r?.valor
    if (Number.isInteger(v) && v >= 1 && v <= 5) { votos[v - 1]++; suma += v }
  }
  const total = votos.reduce((a, b) => a + b, 0)
  return { votos, total, promedio: total ? Math.round((suma / total) * 10) / 10 : null }
}

/* ── Ranking ───────────────────────────────────────────────────────────── */

/** Un orden sirve si trae cada elemento exactamente una vez. */
export const ordenValido = (orden, n) => Array.isArray(orden) && orden.length === n
  && orden.every(i => Number.isInteger(i) && i >= 0 && i < n) && new Set(orden).size === n

/**
 * El ranking del curso. Cada orden reparte puntos (n-1 al primero, 0 al
 * último) y se ordena por puntos. `promedio` es el puesto medio con un
 * decimal: es lo que se entiende al mirarlo («en promedio quedó 1,8.º»).
 * `maximo` = los puntos que tendría un elemento que todos pusieron primero.
 */
export const resultadoRanking = (respuestas, n) => {
  const puntos = Array(n).fill(0)
  const sumaPuestos = Array(n).fill(0)
  let total = 0
  for (const r of Object.values(respuestas || {})) {
    if (!ordenValido(r?.orden, n)) continue
    total++
    r.orden.forEach((i, puesto) => { puntos[i] += n - 1 - puesto; sumaPuestos[i] += puesto + 1 })
  }
  const filas = Array.from({ length: n }, (_, i) => ({
    i,
    puntos: puntos[i],
    promedio: total ? Math.round((sumaPuestos[i] / total) * 10) / 10 : null,
  })).sort((a, b) => b.puntos - a.puntos || a.i - b.i)
  /* Empatados, mismo puesto (1, 1, 3): mostrar 1.º y 2.º diría que uno ganó. */
  filas.forEach((f, k) => { f.puesto = k && f.puntos === filas[k - 1].puntos ? filas[k - 1].puesto : k + 1 })
  return { filas, total, maximo: total * (n - 1) }
}

/* ── Preguntas del curso ───────────────────────────────────────────────── */

/**
 * Las preguntas que los estudiantes le hacen al docente, con sus votos.
 *
 * Cada estudiante guarda todo lo suyo en su propia respuesta:
 *   { preguntas: { qid: { texto, at } }, votos: { qid: true } }
 * `moderacion` = { preguntas: { qid: true | false }, respondidas: { qid: true } }.
 *
 * Son ANÓNIMAS de verdad en pantalla: ni el proyector ni el celular del
 * docente muestran quién preguntó. Solo se votan las aprobadas, y el voto
 * propio a la pregunta propia no cuenta.
 *
 * Las aprobadas van primero las sin responder, de más a menos votos; las
 * respondidas, al final.
 */
export const preguntasDelCurso = (respuestas, moderacion = {}, yo = null) => {
  const lista = []
  const votos = new Map()
  for (const [pid, r] of Object.entries(respuestas || {})) {
    for (const [qid, v] of Object.entries(r?.votos || {})) {
      if (v === true) votos.set(qid, [...(votos.get(qid) || []), pid])
    }
  }
  for (const [pid, r] of Object.entries(respuestas || {})) {
    for (const [qid, q] of Object.entries(r?.preguntas || {})) {
      const original = limpiarAbierta(q?.texto)
      if (!original) continue
      const d = moderacion?.preguntas?.[qid]
      const quienes = (votos.get(qid) || []).filter(v => v !== pid)
      /* Corregida por el docente, como las abiertas (correccionVigente). */
      const c = correccionVigente(moderacion?.correccionesPreguntas?.[qid], original)
      const texto = c || original
      lista.push({
        qid,
        texto,
        original,
        corregida: Boolean(c),
        at: typeof q?.at === 'number' ? q.at : 0,
        votos: quienes.length,
        decision: d === true ? true : d === false ? false : null,
        respondida: moderacion?.respondidas?.[qid] === true,
        groseria: esGroseria(original),
        mia: yo != null && pid === yo,
        votada: yo != null && quienes.includes(yo),
      })
    }
  }
  const porLlegada = (a, b) => a.at - b.at || a.qid.localeCompare(b.qid)
  return {
    pendientes: lista.filter(q => q.decision === null).sort(porLlegada),
    aprobadas: lista.filter(q => q.decision === true)
      .sort((a, b) => Number(a.respondida) - Number(b.respondida) || b.votos - a.votos || porLlegada(a, b)),
    descartadas: lista.filter(q => q.decision === false).sort(porLlegada),
  }
}

/* ── Respuestas abiertas ───────────────────────────────────────────────── */

export const limpiarAbierta = (s) => String(s == null ? '' : s)
  .normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, LIMITES.abierta)

/**
 * Las respuestas abiertas, separadas en pendientes, aprobadas y descartadas, en
 * el orden en que llegaron. `decisiones` = { pid: true (aprobada) | false
 * (descartada) }; sin decisión, pendiente. El nombre va solo para el docente en
 * su celular: el proyector no lo muestra nunca.
 *
 * `correcciones` = { pid: { texto, de } }: lo que el docente corrigió. `texto`
 * pasa a ser lo que se muestra y `original` guarda lo que escribió el
 * estudiante. Solo vale mientras el estudiante no haya cambiado su respuesta
 * (`de` tiene que ser igual a lo que hay ahora): corregir un texto que ya no
 * existe pisaría lo nuevo con algo viejo.
 *
 * `alInstante` (la abierta como tablero, con «publicar al instante»): lo que
 * nadie revisó cuenta como aprobado, salvo lo que el filtro marcó. El docente
 * igual puede quitarlo (decisión false).
 *
 * Como tablero, una publicación puede ser solo una foto (`foto`), va en una
 * columna (`columna`) y se ordena por cuándo se publicó (`desde`), no por la
 * última vez que se editó: editar no la manda al final del muro.
 */
export const abiertas = (respuestas, decisiones = {}, participantes = {}, correcciones = {}, alInstante = false) => {
  const lista = Object.entries(respuestas || {})
    .map(([pid, r]) => {
      const original = limpiarAbierta(r?.texto)
      const c = correccionVigente(correcciones?.[pid], original)
      return {
        pid,
        texto: c || original,
        original,
        corregida: Boolean(c),
        at: typeof r?.desde === 'number' ? r.desde : typeof r?.at === 'number' ? r.at : 0,
        ...(r?.foto === true ? { foto: true } : {}),
        ...(Number.isInteger(r?.columna) ? { columna: r.columna } : {}),
        nombre: participantes?.[pid]?.nombre || '',
        /* Antes / Ahora: los lados que escribió el estudiante (los que el
           docente dejó en blanco). `texto` es su «porque». */
        ...(limpiarLado(r?.antes) ? { antes: limpiarLado(r.antes) } : {}),
        ...(limpiarLado(r?.ahora) ? { ahora: limpiarLado(r.ahora) } : {}),
        decision: decisiones?.[pid] === true ? true : decisiones?.[pid] === false ? false
          : alInstante && !esGroseria(r?.texto) ? true : null,
        groseria: esGroseria(r?.texto),
      }
    })
    .filter(r => r.original || r.foto)
    .sort((a, b) => a.at - b.at || a.pid.localeCompare(b.pid))
  return {
    pendientes: lista.filter(r => r.decision === null),
    aprobadas: lista.filter(r => r.decision === true),
    descartadas: lista.filter(r => r.decision === false),
  }
}

/* ── Corregir una respuesta abierta ────────────────────────────────────── */

/* ── Corregir EN VIVO (9-oct-2026) ─────────────────────────────────────
   Mientras el docente escribe una corrección —en la tablet, sobre todo—, el
   texto va a moderacion/{aid}/borrador = { clave, texto, at } y el proyector
   lo muestra cambiando letra a letra: el curso ve cómo se corrige, no solo el
   resultado. `clave` dice qué se corrige: «a:pid» una abierta, «q:qid» una
   pregunta, «n:clave» una palabra de la nube. Al guardar o cancelar se borra.

   Si la tablet se cierra a medio corregir, el borrador quedaría para siempre
   diciendo «corrigiendo…»: pasados dos minutos sin escribir, se ignora. */
export const VIGENCIA_BORRADOR = 2 * 60 * 1000

/** El texto del borrador si es de esta clave y está vigente; si no, null. */
export const borradorVigente = (b, clave, ahora) =>
  (b && b.clave === clave && typeof b.texto === 'string' && typeof b.at === 'number' && ahora - b.at < VIGENCIA_BORRADOR
    ? b.texto.slice(0, LIMITES.abierta)
    : null)

/** La corrección guardada, si sigue valiendo para este texto; si no, null. */
export const correccionVigente = (c, original) => {
  if (!c || typeof c.texto !== 'string') return null
  const texto = limpiarAbierta(c.texto)
  if (!texto || limpiarAbierta(c.de) !== original || texto === original) return null
  return texto
}

/* Palabras, signos y espacios por separado: así «yesterday» → «yesterday.»
   marca solo el punto, y «go» → «went» no arrastra la frase entera. */
const trozos = (s) => String(s || '').match(/\s+|[\p{L}\p{N}'’]+|[^\s\p{L}\p{N}]/gu) || []

/**
 * Qué cambió entre lo que escribió el estudiante y la corrección, trozo a
 * trozo (subsecuencia común más larga): [{ tipo: 'igual' | 'quitado' |
 * 'agregado', texto }]. Es lo que ve el estudiante en su celular.
 * Los textos miden a lo más 140 caracteres, así que la tabla es chica.
 */
export const diferencias = (antes, despues) => {
  const a = trozos(antes), b = trozos(despues)
  const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
    }
  }
  const out = []
  const poner = (tipo, texto) => {
    const ultimo = out[out.length - 1]
    if (ultimo && ultimo.tipo === tipo) ultimo.texto += texto
    else out.push({ tipo, texto })
  }
  let i = 0, j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { poner('igual', a[i]); i++; j++ }
    else if (L[i + 1][j] >= L[i][j + 1]) poner('quitado', a[i++])
    else poner('agregado', b[j++])
  }
  while (i < a.length) poner('quitado', a[i++])
  while (j < b.length) poner('agregado', b[j++])
  return out
}

/** Cuántos respondieron la actividad. */
export const cuantosRespondieron = (respuestas) => Object.keys(respuestas || {}).length

/* ── Sala ──────────────────────────────────────────────────────────────── */

export const nombreValido = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, LIMITES.nombre)

export const idAlAzar = (azar = Math.random) =>
  Array.from({ length: 12 }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(azar() * 32)]).join('')

export const pinAlAzar = (azar = Math.random) => String(100000 + Math.floor(azar() * 900000))
