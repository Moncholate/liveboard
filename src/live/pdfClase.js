/* ============================================================================
   EL PDF DE LA CLASE
   ----------------------------------------------------------------------------
   Se arma en el mismo aparato (celular o PC), sin servidor: el texto va como
   TEXTO, no como foto, así que se lee nítido a cualquier tamaño, y la pizarra
   va como imagen en alta resolución. jsPDF se carga recién al descargar: los
   celulares no lo bajan si nadie pide el PDF.

   Una sección por actividad, en el orden de la clase, y al final las páginas
   de la pizarra (una hoja apaisada por pantalla del cuaderno). Sin nombres.
   ========================================================================== */
import { ALTERNATIVAS } from './logic.js'
import { NIVELES } from './cierres.js'
import { traducir } from '../i18n.jsx'
import { imagenesDePagina } from './imagenPizarra.js'

/* Las letras de las fuentes de un PDF básico no traen emojis ni algunos
   signos: se cambian por su par simple o se quitan, para que no salgan
   cuadraditos. Las tildes, la ñ, ¿ y ¡ sí están. */
export const textoParaPdf = (s) => String(s ?? '')
  .replace(/[‘’‚′]/g, "'")
  .replace(/[“”„″]/g, '"')
  .replace(/[–—−]/g, '-')
  .replace(/…/g, '...')
  .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '')

const COLOR_ALT = { A: [124, 58, 237], B: [13, 148, 136], C: [249, 115, 22], D: [219, 39, 119] }
const TEAL = [15, 118, 110]
const GRIS = [100, 116, 139]
const TINTA = [15, 23, 42]
const BARRA_FONDO = [241, 245, 249]
const LUZ = { verde: [34, 197, 94], ambar: [245, 158, 11], rojo: [239, 68, 68] }

/* «unidad-3-past-simple-2026-10-08.pdf»: con título se reconoce en la
   carpeta de descargas; sin título, «clase-2026-10-08.pdf». */
export const nombreArchivo = (creado, titulo = '') => {
  const d = new Date(creado)
  const dos = (n) => String(n).padStart(2, '0')
  const base = String(titulo).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'clase'
  return `${base}-${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}.pdf`
}

export async function descargarPdf(resumen) {
  const { jsPDF } = await import('jspdf')
  const t = (clave, ...a) => traducir(resumen.idioma, clave, ...a)
  const numero = (x) => x.toLocaleString(resumen.idioma === 'en' ? 'en-US' : 'es-CL')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const M = 18
  let W = 210 - 2 * M
  let alto = 297
  let y = M

  const salto = (necesita) => {
    if (y + necesita <= alto - M) return
    doc.addPage('a4', 'portrait')
    W = 210 - 2 * M; alto = 297; y = M
  }
  const parrafo = (texto, { size = 11, bold = false, color = TINTA, gap = 1.5, x = M, ancho = W } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lineas = doc.splitTextToSize(textoParaPdf(texto), ancho)
    const lh = size * 0.42
    for (const l of lineas) {
      salto(lh)
      doc.text(l, x, y + lh * 0.8)
      y += lh
    }
    y += gap
  }
  const barra = (pct, color) => {
    salto(4)
    doc.setFillColor(...BARRA_FONDO)
    doc.roundedRect(M, y, W, 3, 1.5, 1.5, 'F')
    if (pct > 0) {
      doc.setFillColor(...color)
      doc.roundedRect(M, y, Math.max(3, (W * pct) / 100), 3, 1.5, 1.5, 'F')
    }
    y += 6
  }
  const filaConDato = (izq, der, { bold = false } = {}) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    const anchoDer = doc.getTextWidth(textoParaPdf(der)) + 4
    const antes = y
    parrafo(izq, { bold, ancho: W - anchoDer, gap: 0.5 })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...GRIS)
    doc.text(textoParaPdf(der), M + W, antes + 11 * 0.42 * 0.8, { align: 'right' })
  }

  /* Portada: el título de la unidad y el objetivo, si los hay, y siempre la
     fecha y que no lleva nombres. */
  /* «Sin nombres», salvo que algún tablero los mostrara (tablero.js). */
  const subtitulo = resumen.actividades.some(a => a.nombres) ? t('pdfConNombres') : t('pdfSubtitulo')
  const fecha = new Date(resumen.creado).toLocaleDateString(resumen.idioma === 'en' ? 'en-US' : 'es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
  if (resumen.titulo) {
    parrafo(resumen.titulo, { size: 20, bold: true, gap: 1.5 })
    if (resumen.objetivo) parrafo(`${t('objetivo')}: ${resumen.objetivo}`, { size: 11, gap: 1.5 })
    parrafo(`${t('claseDel', fecha)} · ${subtitulo}`, { size: 10, color: GRIS, gap: 6 })
  } else {
    parrafo(t('claseDel', fecha), { size: 20, bold: true, gap: 1 })
    if (resumen.objetivo) parrafo(`${t('objetivo')}: ${resumen.objetivo}`, { size: 11, gap: 1.5 })
    parrafo(subtitulo, { size: 10, color: GRIS, gap: 6 })
  }

  resumen.actividades.forEach((a, n) => {
    salto(22)
    doc.setDrawColor(226, 232, 240)
    doc.line(M, y, M + W, y)
    y += 5
    parrafo(`${n + 1}. ${t(`tipo_${a.tipo}`)}`.toUpperCase(), { size: 9, bold: true, color: TEAL, gap: 0.5 })
    if (a.pregunta) parrafo(a.pregunta, { size: 14, bold: true, gap: 3 })
    /* Una viñeta dibujada: el «•» no está en la letra básica del PDF. */
    const vineta = (texto) => {
      salto(6)
      doc.setFillColor(...TEAL)
      doc.circle(M + 1.2, y + 2.6, 0.9, 'F')
      parrafo(texto, { size: 12, gap: 2.5, x: M + 5, ancho: W - 5 })
    }

    if (a.tipo === 'nube') {
      parrafo(a.palabras.map(p => `${p.texto} (${p.cuenta})`).join('   ·   '), { size: 12 })
    } else if (a.tipo === 'encuesta') {
      const total = a.votos.reduce((s, v) => s + v, 0)
      a.alternativas.forEach((texto, i) => {
        const pct = total ? Math.round((a.votos[i] / total) * 100) : 0
        const letra = ALTERNATIVAS[i]?.letra || ''
        filaConDato(`${letra}.  ${texto}`, `${a.votos[i]} · ${pct}%`)
        barra(pct, COLOR_ALT[letra] || TEAL)
      })
    } else if (a.tipo === 'escala') {
      parrafo(`${t('promedio')}: ${a.promedio == null ? '-' : numero(a.promedio)} / 5`, { size: 13, bold: true, gap: 2 })
      const max = Math.max(1, ...a.votos)
      t('escala').forEach((r, i) => {
        filaConDato(`${i + 1} · ${r}`, String(a.votos[i]))
        barra((a.votos[i] / max) * 100, TEAL)
      })
    } else if (a.tipo === 'ranking') {
      const maximo = a.total * (a.alternativas.length - 1)
      a.filas.forEach(f => {
        filaConDato(`${f.puesto}.  ${a.alternativas[f.i]}`, f.promedio == null ? '' : t('puestoMedio', numero(f.promedio)), { bold: f.puesto === 1 })
        barra(maximo ? (f.puntos / maximo) * 100 : 0, TEAL)
      })
      parrafo(t('ordenaron', a.total), { size: 9, color: GRIS })
    } else if (a.tipo === 'abierta' && a.publicaciones?.length) {
      /* El tablero: por columna si las había; cada publicación con su foto,
         su texto, quién la escribió (si se mostraba) y sus comentarios. */
      const grupos = a.columnas?.length
        ? a.columnas.map((nombre, i) => ({ nombre, items: a.publicaciones.filter(p => (p.columna || 0) === i) })).filter(g => g.items.length)
        : [{ nombre: null, items: a.publicaciones }]
      for (const g of grupos) {
        if (g.nombre) parrafo(g.nombre.toUpperCase(), { size: 10, bold: true, color: TEAL, gap: 2 })
        for (const p of g.items) {
          if (p.foto) {
            const { width, height } = doc.getImageProperties(p.foto)
            let w = Math.min(W, 100), h = (w * height) / width
            if (h > 110) { h = 110; w = (h * width) / height }
            salto(h + 12)
            doc.addImage(p.foto, 'JPEG', M, y, w, h, undefined, 'FAST')
            y += h + 2.5
          }
          if (p.texto) parrafo(p.texto, { size: 12, bold: true, gap: p.nombre ? 0.5 : 2 })
          if (p.nombre) parrafo(p.nombre, { size: 9, color: GRIS, gap: 2 })
          p.comentarios.forEach(c => vineta(c.nombre ? `${c.nombre}: ${c.texto}` : c.texto))
          y += 3
        }
      }
    } else if (a.tipo === 'abierta') {
      /* La viñeta va dibujada: el «•» no está en la letra básica del PDF. */
      a.textos.forEach(texto => {
        salto(6)
        doc.setFillColor(...TEAL)
        doc.circle(M + 1.2, y + 2.6, 0.9, 'F')
        parrafo(texto, { size: 12, gap: 2.5, x: M + 5, ancho: W - 5 })
      })
    } else if (a.tipo === 'semaforo') {
      const total = a.votos.reduce((s, v) => s + v, 0)
      NIVELES.forEach((nv, i) => {
        const pct = total ? Math.round((a.votos[i] / total) * 100) : 0
        filaConDato(nv.texto, `${a.votos[i]} · ${pct}%`)
        barra(pct, LUZ[nv.id])
      })
    } else if (a.tipo === 'duda' || a.tipo === 'muro') {
      a.textos.forEach(vineta)
    } else if (a.tipo === 'antesahora') {
      if (a.antes || a.ahora) parrafo(`${t('antesPensaba')} ${a.antes || '______'}  ->  ${t('ahoraPienso')} ${a.ahora || '______'}`, { size: 11, color: GRIS, gap: 2 })
      a.items.forEach(r => {
        const lados = r.antes || r.ahora ? `${r.antes}${r.antes && r.ahora ? ' -> ' : ''}${r.ahora}: ` : ''
        vineta(`${lados}${t('porque')} ${r.texto}`)
      })
    } else if (a.tipo === 'crucigrama') {
      for (const [titulo, dir] of [['horizontales', 'h'], ['verticales', 'v']]) {
        const items = a.palabras.filter(p => p.dir === dir)
        if (!items.length) continue
        parrafo(t(titulo).toUpperCase(), { size: 9, bold: true, color: GRIS, gap: 1 })
        items.forEach(p => {
          parrafo(`${p.numero}. ${p.pista || '__________'} (${p.largo})  ->  ${p.original}`, { size: 12, gap: 0.5 })
          parrafo(t('laSacaron', p.sacaron), { size: 9, color: GRIS, gap: 2 })
        })
      }
    } else if (a.tipo === 'sopa') {
      a.palabras.forEach(p => filaConDato(p.original, t('laEncontraron', p.encontraron)))
    } else if (a.tipo === 'apuesta') {
      a.consignas.forEach((c, i) => parrafo(`${i + 1}. ${c}`, { size: 12, gap: 1 }))
      y += 2
      filaConDato(t('calib_exacto'), String(a.exactos))
      filaConDato(t('calib_deMas'), String(a.deMas))
      filaConDato(t('calib_deMenos'), String(a.deMenos))
      parrafo(t('compararonN', a.compararon, a.apostaron), { size: 9, color: GRIS })
    } else if (a.tipo === 'preguntas') {
      a.preguntas.forEach(q => {
        parrafo(`${q.texto}`, { size: 12, gap: 0.5, color: q.respondida ? GRIS : TINTA })
        parrafo(`${t('votosN', q.votos)}${q.respondida ? ` · ${t('respondida')}` : ''}`, { size: 9, color: GRIS, gap: 3 })
      })
    }
    y += 4
  })

  /* La pizarra: una hoja apaisada por pantalla, la imagen a todo el ancho. */
  resumen.pizarra.paginas.forEach((pagina, n) => {
    const imagenes = imagenesDePagina(pagina.trazos, resumen.pizarra.fondo)
    imagenes.forEach((src, parte) => {
      doc.addPage('a4', 'landscape')
      W = 297 - 2 * M; alto = 210; y = M
      const titulo = imagenes.length > 1
        ? `${t('pizarra')} · ${t('pagina')} ${n + 1} (${parte + 1}/${imagenes.length})`
        : `${t('pizarra')} · ${t('pagina')} ${n + 1}`
      parrafo(titulo.toUpperCase(), { size: 9, bold: true, color: TEAL, gap: 2 })
      const h = (W * 9) / 16
      doc.setDrawColor(226, 232, 240)
      doc.addImage(src, 'PNG', M, y, W, h, undefined, 'FAST')
      doc.rect(M, y, W, h)
    })
  })

  doc.save(nombreArchivo(resumen.creado, resumen.titulo))
}
