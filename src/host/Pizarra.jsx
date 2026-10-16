/* ============================================================================
   LA TABLET DEL DOCENTE: EL PIZARRÓN
   ----------------------------------------------------------------------------
   Se entra con el QR del botón «Pizarra» del proyector, que lleva la clave de
   la sala. Lo que se escribe aquí aparece en el proyector mientras se escribe.

   LA PALMA NO RAYA: apenas se usa el lápiz, los toques con el dedo dejan de
   dibujar. Antes de usar el lápiz, el dedo sí dibuja (por si no hay lápiz).

   EL BOTÓN DEL S PEN BORRA: con el botón lateral apretado el trazo es de
   borrador, sin tocar la barra, y al soltarlo se vuelve al lápiz que estaba.
   Vale apretarlo antes de apoyar la punta o a mitad del trazo (pizarra.js,
   botonDeBorrar). Si una tablet lo avisa distinto, #/lapiz muestra qué manda.

   El trazo se dibuja aquí al tiro, sin esperar a la base: la tablet no puede
   sentirse lenta. Al proyector le llega por partes cada 80 ms (pizarra.js).
   ========================================================================== */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, useValue } from '../net/hooks.js'
import { Center } from '../ui.jsx'
import { ProveedorIdioma, traducir, useT, valido } from '../i18n.jsx'
import { raiz } from '../live/sala.js'
import {
  ALTO, ANCHO, COLORES, FONDOS_PIZARRA, GROSORES, GROSOR_BORRADOR, MAX_PAGINAS,
  botonDeBorrar, botonEnElAire, codificar, idDeTrazo, lejos, rutaPizarra, trazosEnOrden, ultimoTrazo, vistaValida, yValida,
} from '../live/pizarra.js'
import { Lienzo } from '../live/Lienzo.jsx'
import { useTema } from '../tema.jsx'
import { Icon } from '../icons.jsx'

const CADA_MS = 80

export default function Pizarra({ pin, clave }) {
  useTema()
  const store = useStore()
  const base = raiz(pin)
  const meta = useValue(store, `${base}/meta`)
  const idioma = valido(useValue(store, `${base}/idioma`))
  if (!store || meta === undefined) return <Center>{traducir(idioma, 'cargando')}</Center>
  if (!meta) return <Center>{traducir(idioma, 'salaNoExiste')}</Center>
  if (!clave || meta.clave !== clave) return <Center>{traducir(idioma, 'enlaceNoSirvePizarra')}</Center>
  return <ProveedorIdioma value={idioma}><Tablero store={store} pin={pin} clave={clave} /></ProveedorIdioma>
}

function Tablero({ store, pin, clave }) {
  const t = useT()
  const ruta = rutaPizarra(pin)
  const vista = vistaValida(useValue(store, `${ruta}/vista`))
  const estado = useValue(store, `${raiz(pin)}/estado`)
  const trazosRaw = useValue(store, `${ruta}/paginas/${vista.pagina}/trazos`)
  const trazos = useMemo(() => trazosEnOrden(trazosRaw), [trazosRaw])
  const proyectando = Boolean(estado?.pizarra)

  const [color, setColor] = useState(COLORES[0].hex)
  const [grosor, setGrosor] = useState(GROSORES[0])
  const [borrador, setBorrador] = useState(false)
  const [enCurso, setEnCurso] = useState(null)

  const papel = useRef(null)
  const trazo = useRef(null) // { id, pg, puntos, enviados, parte }
  const conLapiz = useRef(false)
  const cuadro = useRef(0)

  /* CUÁNTO SE BAJÓ EN EL CUADERNO. La tablet lo lleva en local para que bajar
     se sienta al tiro, y lo manda a la base cada 100 ms para que el proyector
     la siga. Si lo cambia otro (el proyector con la rueda, o al cambiar de
     página), se toma el de la base, salvo mientras se baja con los dedos. */
  const [y, setYLocal] = useState(vista.y)
  const yRef = useRef(vista.y)
  const ultimoEnvioY = useRef(0)
  const envioYPendiente = useRef(0)
  const setY = (nuevo, { enviar = true } = {}) => {
    const v = yValida(nuevo)
    yRef.current = v
    setYLocal(v)
    if (!enviar) return
    clearTimeout(envioYPendiente.current)
    const mandar = () => { ultimoEnvioY.current = Date.now(); store.update(`${ruta}/vista`, { y: yRef.current }) }
    if (Date.now() - ultimoEnvioY.current > 100) mandar()
    else envioYPendiente.current = setTimeout(mandar, 100)
  }
  const dedos = useRef(new Map()) // pointerId → { y0, y } de cada dedo apoyado
  const desplazando = useRef(null) // { yInicio, mediaInicio } mientras se baja con dos dedos
  useEffect(() => {
    if (!desplazando.current) setY(vista.y, { enviar: false })
  }, [vista.y, vista.pagina])

  const cambiarVista = (cambios) => store.set(`${ruta}/vista`, { ...vista, y: yRef.current, ...cambios })

  const punto = (e) => {
    const r = papel.current.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * ANCHO, ((e.clientY - r.top) / r.height) * ALTO + yRef.current]
  }

  /* BAJAR CON DOS DEDOS. Se mueve solo si los DOS dedos se desplazan en la
     misma dirección: una palma apoyada y quieta, más un dedo, no mueve nada. */
  const UMBRAL_PX = 10
  const dedoAbajo = (e) => {
    dedos.current.set(e.pointerId, { y0: e.clientY, y: e.clientY })
    /* Si el primer dedo estaba dibujando (antes de usar el lápiz), ese trazo
       se descarta: el segundo dedo dice que era para bajar. */
    const tr = trazo.current
    if (dedos.current.size >= 2 && tr?.tocando) {
      trazo.current = null
      store.remove(`${ruta}/enCurso`)
      setEnCurso(null)
    }
  }
  const dedoMovido = (e) => {
    const d = dedos.current.get(e.pointerId)
    if (!d) return false
    d.y = e.clientY
    if (dedos.current.size < 2) return false
    const lista = [...dedos.current.values()].slice(0, 2)
    const media = (lista[0].y + lista[1].y) / 2
    if (!desplazando.current) {
      const [a, b] = lista.map(x => x.y - x.y0)
      const juntos = Math.abs(a) > UMBRAL_PX && Math.abs(b) > UMBRAL_PX && Math.sign(a) === Math.sign(b)
      if (!juntos) return true
      desplazando.current = { yInicio: yRef.current, mediaInicio: media }
    }
    const alto = papel.current.getBoundingClientRect().height
    setY(desplazando.current.yInicio - ((media - desplazando.current.mediaInicio) / alto) * ALTO)
    return true
  }
  const dedoArriba = (e) => {
    if (!dedos.current.delete(e.pointerId)) return
    if (dedos.current.size < 2 && desplazando.current) {
      desplazando.current = null
      setY(yRef.current)
    }
  }
  /* Cómo se ve un trazo según sus datos guardados ({ c, g, b? }). */
  const comoSeVe = (tr, puntos) => ({ color: tr.datos.c, grosor: tr.datos.g, borrador: Boolean(tr.datos.b), puntos })
  const pintar = () => {
    if (cuadro.current) return
    cuadro.current = requestAnimationFrame(() => {
      cuadro.current = 0
      const tr = trazo.current
      setEnCurso(tr ? comoSeVe(tr, [...tr.puntos]) : null)
    })
  }

  /* Lo que falta mandar del trazo en curso, como una parte nueva. */
  const enviarPendiente = () => {
    const tr = trazo.current
    if (!tr || tr.enviados >= tr.puntos.length) return
    const nuevos = tr.puntos.slice(tr.enviados)
    tr.enviados = tr.puntos.length
    store.update(`${ruta}/enCurso/partes`, { [tr.parte++]: codificar(nuevos) })
  }
  useEffect(() => {
    const id = setInterval(enviarPendiente, CADA_MS)
    return () => clearInterval(id)
  }, [])

  /* El botón del S Pen manda: apretarlo o soltarlo A MITAD DE UN TRAZO lo
     corta ahí y sigue con otro, de borrador o de lápiz. Así da lo mismo si
     el botón se aprieta antes de apoyar la punta o después. */
  const datosTrazo = (borra) => (borra ? { c: color, g: GROSOR_BORRADOR, b: true } : { c: color, g: grosor })

  const empezar = (p, pointerId, borra) => {
    const datos = datosTrazo(borrador || borra)
    trazo.current = { id: idDeTrazo(), pg: vista.pagina, datos, puntos: [p], enviados: 1, parte: 1, pointerId }
    store.set(`${ruta}/enCurso`, { id: trazo.current.id, pg: vista.pagina, ...datos, partes: { 0: codificar([p]) } })
    pintar()
  }
  const terminar = (tr) => {
    trazo.current = null
    /* Se borra el «en curso» solo si no empezó otro trazo mientras tanto:
       escribiendo rápido, borraría el siguiente. Si queda, el proyector lo
       ignora porque su id ya está entre los guardados. */
    store.set(`${ruta}/paginas/${tr.pg}/trazos/${tr.id}`, { ...tr.datos, p: codificar(tr.puntos) })
      .then(() => { if (!trazo.current) store.remove(`${ruta}/enCurso`) })
  }

  const bajar = (e) => {
    if (e.pointerType === 'touch') {
      dedoAbajo(e)
      if (conLapiz.current || dedos.current.size > 1) return
    }
    if (e.pointerType === 'pen') conLapiz.current = true
    if (trazo.current) return
    /* Capturar el puntero hace que el trazo siga aunque el lápiz salga del
       papel. Si el navegador no lo permite, se escribe igual. */
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* sin captura */ }
    empezar(punto(e), e.pointerId, botonDeBorrar(e))
    if (e.pointerType === 'touch') trazo.current.tocando = true
  }
  /* EL CÍRCULO DEL BORRADOR: con el botón del S Pen se borra pasando el lápiz
     casi encima, sin tocar (Samsung no deja pasar el toque con el botón
     apretado), así que hay que ver dónde va a borrar. Se dibuja del tamaño
     real del borrador, solo en la tablet. También con el Borrador de la
     barra, mientras el lápiz se acerca sin tocar. */
  const [circulo, setCirculo] = useState(null) // [x, y] en unidades del papel
  const mover = (e) => {
    if (e.pointerType === 'touch' && dedoMovido(e)) return
    moverTrazo(e)
    if (e.pointerType === 'touch') return // el círculo sigue al lápiz, no a la palma
    const enElAire = e.pointerType === 'pen' && e.pressure === 0
    const borra = trazo.current?.datos.b || (enElAire && ((e.buttons ?? 0) & 1) !== 0) || (borrador && e.pointerType === 'pen')
    setCirculo(borra ? punto(e) : null)
  }
  const moverTrazo = (e) => {
    const tr = trazo.current
    /* El S Pen de la Tab S9 en Edge (y quizá en otros) no avisa el botón como
       botón: con el botón apretado el lápiz se mueve «con clic» pero sin
       presión y sin apoyar la punta. Eso empieza a borrar por donde pasa. */
    if (!tr) {
      if (botonEnElAire(e)) {
        empezar(punto(e), e.pointerId, true)
        trazo.current.enElAire = true
      }
      return
    }
    if (e.pointerId !== tr.pointerId) return
    /* Ya borrando, sigue mientras el lápiz venga «con clic», toque o no la
       pantalla: al tocarla, la presión deja de ser cero pero el botón sigue
       apretado. Termina al soltar el botón (buttons 0) o al levantar. */
    if (tr.enElAire && ((e.buttons ?? 0) & 1) === 0) { subir(e); return }
    if (!tr.enElAire && !borrador && e.pointerType === 'pen' && botonDeBorrar(e) !== Boolean(tr.datos.b)) {
      const p = punto(e)
      tr.puntos.push(p)
      terminar(tr)
      empezar(p, e.pointerId, botonDeBorrar(e))
      return
    }
    /* Los movimientos que el navegador juntó entre dos cuadros: con ellos la
       letra sale fina aunque la pantalla vaya lenta. Si no los da (o vienen
       vacíos), basta el movimiento mismo. */
    const juntos = e.nativeEvent.getCoalescedEvents?.() || []
    const eventos = juntos.length ? juntos : [e.nativeEvent]
    for (const ev of eventos) {
      const p = punto(ev)
      if (lejos(tr.puntos[tr.puntos.length - 1], p)) tr.puntos.push(p)
    }
    pintar()
  }
  const levantar = (e) => {
    if (e.pointerType === 'touch') dedoArriba(e)
    subir(e)
  }
  const subir = (e) => {
    const tr = trazo.current
    if (!tr || e.pointerId !== tr.pointerId) return
    terminar(tr)
    setEnCurso(comoSeVe(tr, tr.puntos))
    if (tr.enElAire) setCirculo(null)
    /* El trazo queda dibujado arriba hasta que vuelve de la base y se suma a
       los de abajo: así no parpadea. */
  }
  useEffect(() => { if (!trazo.current) setEnCurso(null) }, [trazosRaw])

  const deshacer = () => {
    const id = ultimoTrazo(trazosRaw)
    if (id) store.remove(`${ruta}/paginas/${vista.pagina}/trazos/${id}`)
  }
  const limpiar = () => {
    if (!trazos.length || !confirm(t('confirmarLimpiar'))) return
    store.remove(`${ruta}/paginas/${vista.pagina}`)
    setY(0)
  }
  /* Cada página se abre desde arriba. */
  const irA = (pagina) => { setY(0, { enviar: false }); cambiarVista({ pagina, y: 0 }) }
  const nueva = () => { setY(0, { enviar: false }); cambiarVista({ paginas: vista.paginas + 1, pagina: vista.paginas, y: 0 }) }
  const rueda = (e) => setY(yRef.current + (e.deltaY / papel.current.getBoundingClientRect().height) * ALTO)
  const proyectar = () => store.update(`${raiz(pin)}/estado`, { pizarra: !proyectando })

  const boton = 'h-11 min-w-11 px-3 rounded-xl border border-slate-300 bg-white font-bold text-slate-700 disabled:opacity-40'
  const activo = '!border-teal-600 !bg-teal-50 !text-teal-800'

  return (
    <div className="h-[100dvh] flex flex-col select-none">
      <header className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 bg-white border-b border-slate-200">
        <div role="group" aria-label={t('lapiz')} className="flex items-center gap-1.5">
          {COLORES.map(c => (
            <button key={c.id} onClick={() => { setColor(c.hex); setBorrador(false) }} aria-label={t(`color_${c.id}`)}
              aria-pressed={!borrador && color === c.hex}
              className={`w-10 h-10 rounded-full border-4 ${!borrador && color === c.hex ? 'border-teal-500' : 'border-transparent'}`}
              style={{ backgroundColor: c.hex }} />
          ))}
        </div>
        <span className="w-px h-8 bg-slate-200" />
        {GROSORES.map((g, i) => (
          <button key={g} onClick={() => { setGrosor(g); setBorrador(false) }} aria-pressed={!borrador && grosor === g}
            aria-label={t(i ? 'grosorGrueso' : 'grosorFino')} className={`${boton} ${!borrador && grosor === g ? activo : ''}`}>
            <span className="block rounded-full bg-current mx-auto" style={{ width: 22, height: i ? 9 : 4 }} />
          </button>
        ))}
        <button onClick={() => setBorrador(b => !b)} aria-pressed={borrador} className={`${boton} ${borrador ? activo : ''}`}>{t('borrador')}</button>
        <button onClick={deshacer} disabled={!trazos.length} className={boton}><Icon name="undo" className="mr-1.5" />{t('deshacer')}</button>
        <button onClick={limpiar} disabled={!trazos.length} className={boton}>{t('limpiar')}</button>
        <span className="w-px h-8 bg-slate-200" />
        <select value={vista.fondo} onChange={(e) => cambiarVista({ fondo: e.target.value })} aria-label={t('papel')}
          className="h-11 rounded-xl border border-slate-300 bg-white px-2 font-semibold text-slate-700">
          {FONDOS_PIZARRA.map(f => <option key={f} value={f}>{t(`papel_${f}`)}</option>)}
        </select>
        <span className="flex-1" />
        <button onClick={() => irA(vista.pagina - 1)} disabled={vista.pagina === 0} aria-label={t('paginaAnterior')} className={boton}>‹</button>
        <span className="text-sm font-bold text-slate-700 tabular-nums" aria-label={t('paginaDe', vista.pagina + 1, vista.paginas)}>{vista.pagina + 1}/{vista.paginas}</span>
        {vista.pagina < vista.paginas - 1
          ? <button onClick={() => irA(vista.pagina + 1)} aria-label={t('paginaSiguiente')} className={boton}>›</button>
          : <button onClick={nueva} disabled={vista.paginas >= MAX_PAGINAS} className={boton}>+ {t('pagina')}</button>}
        <button onClick={proyectar}
          className={`h-11 px-4 rounded-xl font-bold ${proyectando ? 'bg-teal-700 text-white' : 'border-2 border-teal-700 text-teal-800 bg-white'}`}>
          {proyectando ? `● ${t('proyectando')}` : t('proyectarPizarra')}
        </button>
      </header>

      <Lienzo trazos={trazos} enCurso={enCurso} fondo={vista.fondo} y={y} papelRef={papel} className="flex-1 p-3"
        onPointerDown={bajar} onPointerMove={mover} onPointerUp={levantar} onPointerCancel={levantar} onWheel={rueda}
        onPointerLeave={(e) => { setCirculo(null); if (trazo.current?.enElAire) subir(e) }}
        onContextMenu={(e) => e.preventDefault()}>
        {/* MODERAR DESDE LA TABLET (8-oct-2026): lleva a la misma vista del
            celular, con la misma clave, y de ahí se vuelve con «Pizarra». */}
        <a href={`#/mod?pin=${pin}&clave=${clave}`} onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-3 left-5 h-11 px-3 rounded-xl border font-bold shadow grid place-items-center"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.92)', color: '#334155', borderColor: '#cbd5e1' }}>
          <span><Icon name="pencil" className="mr-1.5" />{t('moderar')}</span>
        </a>
        {/* Flota sobre el papel y no en la barra: si la barra cambia de largo
            se parte en dos líneas y el papel se achica a mitad de clase. */}
        {y > 0 && (
          <button onClick={() => setY(0)} onPointerDown={(e) => e.stopPropagation()} title={t('volverArriba')}
            className="absolute bottom-3 right-5 h-11 px-3 rounded-xl border font-bold shadow"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.92)', color: '#334155', borderColor: '#cbd5e1' }}>
            {/* Colores en línea: va sobre el papel, que es blanco también en oscuro. */}
            ⤒ {t('arriba')}
          </button>
        )}
        {circulo && (
          <div aria-hidden="true" className="absolute pointer-events-none rounded-full"
            style={{
              left: `${(circulo[0] / ANCHO) * 100}%`,
              top: `${((circulo[1] - y) / ALTO) * 100}%`,
              width: `${(GROSOR_BORRADOR / ANCHO) * 100}%`,
              aspectRatio: '1',
              transform: 'translate(-50%, -50%)',
              border: '2px solid #475569',
              boxShadow: '0 0 0 1px #ffffff',
              backgroundColor: 'rgba(148, 163, 184, 0.15)',
            }} />
        )}
      </Lienzo>
    </div>
  )
}
