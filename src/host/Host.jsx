/* ============================================================================
   EL PROYECTOR
   ----------------------------------------------------------------------------
   Dos momentos:
     · PREPARAR: el QR para entrar, el idioma de la sala y la lista de
       actividades, que se arma aquí o se carga de Mis materiales. Se puede
       volver aquí en cualquier momento para agregar o cambiar una.
     · PRESENTAR: una actividad a la vez, con sus resultados en vivo.

   Lo que se ve aquí lo ve el curso. Por eso no hay nombres en ninguna parte:
   en la sala de espera se dice cuántos entraron, no quiénes, y la moderación
   en el PC va sin nombres. Para moderar en privado está el celular (Mod.jsx).

   Las actividades del último uso quedan en este navegador para la próxima
   clase, y con cuenta se guardan en Mis materiales. No son datos de
   estudiantes: son las preguntas del docente.
   ========================================================================== */
import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { QrAmpliable } from '../live/QrAmpliable.jsx'
import { useStore, useUser, useValue } from '../net/hooks.js'
import { isOnline } from '../net/store.js'
import { Button, Center, Logo, urlParaUnirse } from '../ui.jsx'
import { ProveedorIdioma, SelectorIdioma, idiomaDelNavegador, traducir, useT, valido } from '../i18n.jsx'
import {
  abiertas, conTexto, consignasDe, cuantosRespondieron, idAlAzar, moderable as esModerable, pinAlAzar, preguntasDelCurso, problemaDe,
  seVenCorrecciones, tituloDe,
} from '../live/logic.js'
import { accionesDeSala, comoLista, conectados, raiz } from '../live/sala.js'
import {
  LARGO_OBJETIVO, LARGO_TITULO, actividadesParaSala, idMaterialNuevo, listaDeMateriales, materialParaGuardar, rutaMaterial, rutaMateriales,
} from '../live/materiales.js'
import {
  Abiertas, Apuesta, Crucigrama, Encuesta, Escala, Sopa, MarcoAntesAhora, Muro, Nube, Preguntas, Ranking, Semaforo, TextoConHuecos,
} from '../live/Resultados.jsx'
import { faseApuesta } from '../live/cierres.js'
import { porDestapar, progreso, umbral } from '../live/crucigrama.js'
import { destapables } from '../live/sopa.js'
import { leerTraida } from '../live/traida.js'
import { Moderacion } from '../live/Moderacion.jsx'
import { SelectorVista, Tablero } from '../live/Tablero.jsx'
import { comentariosPorPublicacion, esTablero, vistaDe } from '../live/tablero.js'
import { Editor } from './Editor.jsx'
import { Cuenta, iniciarSesion } from './Cuenta.jsx'
import { BotonTema, useTema } from '../tema.jsx'
import { fondoPorId, fondoValido } from '../live/fondos.js'
import { SelectorFondo } from '../live/SelectorFondo.jsx'
import {
  armarResumen, guardarMios, idResumenNuevo, leerMios, resumenVacio, rutaResumen, urlResumen, vencidos,
} from '../live/resumen.js'
import { BotonPdf, normalizar } from '../player/Clase.jsx'
import { anotarSala, borrarSiEsLaMisma, esVieja, limpiarSalasViejas, olvidarSala } from '../live/limpieza.js'
import { Lienzo } from '../live/Lienzo.jsx'
import { ALTO, enCursoVisible, rutaPizarra, trazosEnOrden, vistaValida, yValida } from '../live/pizarra.js'

const PIN_KEY = 'liveboard-host-pin'
const ULTIMAS_KEY = 'liveboard-ultimas'
/* El título y el objetivo de la última clase, como las actividades. */
const CLASE_KEY = 'liveboard-clase'
const ultimaClase = () => {
  try { return JSON.parse(guardado.get(CLASE_KEY)) || null } catch { return null }
}
export const IDIOMA_KEY = 'liveboard-idioma'
/* El fondo del proyector: es de este computador, no de la sala, porque solo
   lo ve el proyector (los celulares no lo usan). Un material lo trae consigo. */
const FONDO_KEY = 'liveboard-fondo'
/* El tema del proyector parte en claro: en una sala con luz se lee mejor. */
const TEMA_PROYECTOR_KEY = 'liveboard-tema-proyector'
/* Qué material se cargó en esta sala, para ofrecer «Guardar cambios en…». */
const ORIGEN_KEY = 'liveboard-origen'

export const guardado = {
  get: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* modo privado */ } },
}

const ultimas = () => {
  try { return JSON.parse(guardado.get(ULTIMAS_KEY)) || [] } catch { return [] }
}

/* Si se recarga la pestaña, se vuelve a la misma sala: los estudiantes ya
   entraron con ese PIN. Salvo que tenga más de 12 horas: es la de una clase
   anterior que quedó abierta, y se borra (limpieza.js).

   `traida` es una actividad que llegó del Toolbox (traida.js). En una
   sala nueva es la única —las de la última clase no vienen al caso—; en la
   sala que ya estaba abierta se agrega al final y se muestra de una vez: el
   curso ya está dentro y el docente quiere cerrar. Devuelve el PIN y, si la
   traída quedó esperando en una sala nueva, su id. */
async function abrirSala(store, traida) {
  borrarResumenesVencidos(store)
  const anterior = guardado.get(PIN_KEY)
  const metaAnterior = anterior ? await store.get(`${raiz(anterior)}/meta`) : null
  if (metaAnterior && !esVieja(metaAnterior.creada, store.now())) {
    limpiarSalasViejas(store, { actual: anterior })
    if (traida) {
      const lista = [...comoLista(await store.get(`${raiz(anterior)}/actividades`)), traida]
      const acciones = accionesDeSala(store, anterior)
      await acciones.guardarActividades(lista)
      guardado.set(ULTIMAS_KEY, JSON.stringify(lista))
      await acciones.mostrar(lista.length - 1, traida.tipo)
    }
    return { pin: anterior, esperando: null }
  }
  if (metaAnterior) await borrarSiEsLaMisma(store, anterior, metaAnterior.creada).catch(() => {})
  let pin
  do pin = pinAlAzar()
  while (await store.get(`${raiz(pin)}/meta`))
  const lista = traida ? [traida] : ultimas()
  await store.update(raiz(pin), {
    meta: { creada: store.stamp(), clave: idAlAzar() },
    idioma: valido(guardado.get(IDIOMA_KEY) || idiomaDelNavegador()),
    estado: { abierta: false, resultados: false },
    ...(lista.length ? { actividades: lista } : {}),
    ...(ultimaClase()?.titulo ? { clase: ultimaClase() } : {}),
  })
  if (traida) guardado.set(ULTIMAS_KEY, JSON.stringify(lista))
  guardado.set(PIN_KEY, pin)
  guardado.set(ORIGEN_KEY, null)
  anotarSala(store, pin, (await store.get(`${raiz(pin)}/meta`))?.creada)
  limpiarSalasViejas(store, { actual: pin })
  return { pin, esperando: traida?.id || null }
}

export default function Host() {
  const store = useStore()
  const [sala, setSala] = useState(null)
  const [error, setError] = useState(null)
  /* Se lee una vez y se borra del enlace: recargar la pestaña no tiene que
     volver a agregarla. */
  const [traida] = useState(() => leerTraida(location.hash))
  const abierta = useRef(false)
  const idioma = valido(guardado.get(IDIOMA_KEY) || idiomaDelNavegador())
  useEffect(() => {
    if (!store || abierta.current) return
    abierta.current = true
    if (traida) history.replaceState(null, '', '#/host')
    abrirSala(store, traida?.actividad).then(setSala, (e) => setError(e.message))
  }, [store])
  if (error) return <Center>{traducir(idioma, 'noSeCreo', error)}</Center>
  if (!sala) return <Center>{traducir(idioma, 'creandoSala')}</Center>
  return <Sala store={store} pin={sala.pin} esperando={sala.esperando} traidaRota={Boolean(traida?.error)}
    onCerrada={() => { guardado.set(PIN_KEY, null); location.hash = '' }} />
}

function Sala({ store, pin, esperando, traidaRota, onCerrada }) {
  const base = raiz(pin)
  const meta = useValue(store, `${base}/meta`)
  const idiomaRaw = useValue(store, `${base}/idioma`)
  const estado = useValue(store, `${base}/estado`)
  const actividadesRaw = useValue(store, `${base}/actividades`)
  const online = useValue(store, `${base}/online`)
  const participantes = useValue(store, `${base}/participantes`)
  const clase = useValue(store, `${base}/clase`)
  const user = useUser(store)
  const acciones = useMemo(() => accionesDeSala(store, pin), [store, pin])
  const idioma = valido(idiomaRaw)
  const tema = useTema(TEMA_PROYECTOR_KEY, 'claro')
  const [fondo, setFondoEstado] = useState(() => fondoValido(guardado.get(FONDO_KEY)))
  const setFondo = (id) => { setFondoEstado(fondoValido(id)); guardado.set(FONDO_KEY, fondoValido(id)) }

  const actividades = comoLista(actividadesRaw)
  const idx = estado?.idx ?? null
  const actual = idx != null ? actividades[idx] : null
  /* CERRAR LA PESTAÑA SIN CERRAR LA SALA deja los apodos y las respuestas en la
     base hasta que se vuelva a abrir Liveboard (limpieza.js). Con estudiantes
     dentro, el navegador pregunta antes de salir. El texto del aviso lo pone el
     navegador: no se puede cambiar. */
  const enSalaRef = useRef(0)
  enSalaRef.current = conectados(online)
  useEffect(() => {
    const avisar = (e) => { if (enSalaRef.current > 0) { e.preventDefault(); e.returnValue = '' } }
    addEventListener('beforeunload', avisar)
    return () => removeEventListener('beforeunload', avisar)
  }, [])
  /* El aviso de lo que llegó del Belt se va apenas se muestra una actividad. */
  const [espera, setEspera] = useState(esperando)
  useEffect(() => { if (idx != null) setEspera(null) }, [idx])

  /* Alguien cerró la sala desde otro lado (el celular): se vuelve al inicio. */
  useEffect(() => { if (meta === null) onCerrada() }, [meta])

  /* Con sesión, la sala queda anotada también en la cuenta, y de paso se
     borran las viejas que otros computadores dejaron abiertas. */
  useEffect(() => {
    if (!user || typeof meta?.creada !== 'number') return
    anotarSala(store, pin, meta.creada, user.uid)
    limpiarSalasViejas(store, { actual: pin, uid: user.uid })
  }, [user?.uid, meta?.creada])

  /* Las actividades también: Preparar las copia al montarse para editarlas. */
  if (meta === undefined || estado === undefined || actividadesRaw === undefined || idiomaRaw === undefined || clase === undefined) {
    return <Center>{traducir(idioma, 'cargando')}</Center>
  }

  const cerrar = async () => {
    if (!confirm(traducir(idioma, 'confirmarCerrar'))) return
    await acciones.cerrarSala()
    olvidarSala(store, pin, user?.uid)
    onCerrada()
  }

  return (
    <ProveedorIdioma value={idioma}>
      {/* Con la pizarra, la pantalla justa: el papel ocupa lo que queda entre
          el encabezado y los botones, sin que nada se salga. */}
      <div className={`${estado?.pizarra ? 'h-[100dvh]' : 'min-h-screen'} flex flex-col`}>
        <Encabezado store={store} user={user} pin={pin} meta={meta} online={online} tema={tema} onCerrar={cerrar} acciones={acciones}
          presentando={idx != null || Boolean(estado?.pizarra)} />
        {estado?.pizarra
          ? <PizarraProyector store={store} pin={pin} acciones={acciones} />
          : actual
          ? <Presentar store={store} base={base} pin={pin} clave={meta?.clave} idx={idx} actividad={actual} actividades={actividades} online={online}
              estado={estado} participantes={participantes} acciones={acciones} fondo={fondo} />
          : <Preparar store={store} user={user} pin={pin} clave={meta?.clave} online={online} actividades={actividades} acciones={acciones} clase={clase}
              fondo={fondo} setFondo={setFondo} esperando={espera} traidaRota={traidaRota} />}
      </div>
    </ProveedorIdioma>
  )
}

/* Mientras se presenta, arriba queda solo lo de la clase: la cuenta de Google
   es para Mis materiales, se usa al preparar, y el curso no tiene por qué
   verla (9-oct-2026). */
function Encabezado({ store, user, pin, meta, online, tema, onCerrar, acciones, presentando = false }) {
  const t = useT()
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3 bg-white border-b border-slate-200">
      <Logo className="text-2xl" />
      {!isOnline && <span className="text-xs font-bold text-amber-800 bg-amber-100 rounded-full px-2.5 py-1">{t('modoLocal')}</span>}
      <span className="flex-1" />
      <span className="text-slate-600">{t('conectados', conectados(online))}</span>
      <span className="text-slate-500">{t('pin')} <b className="text-slate-900 tracking-widest">{pin}</b></span>
      <BotonTema tema={tema} etiqueta={tema.oscuro ? t('usarClaro') : t('usarOscuro')} />
      {/* CADA ACCIÓN UNA SOLA VEZ POR PANTALLA (9-oct-2026): el botón de la
          tablet y el de iniciar sesión estaban arriba y también abajo, y la
          repetición confundía. Iniciar sesión vive en la tarjeta de
          materiales; arriba solo se ve la cuenta ya abierta, para salir. La
          tablet, en la tarjeta de Preparar y junto a «Moderar». */}
      {!presentando && user && <Cuenta store={store} user={user} />}
      <BotonCompartir store={store} pin={pin} />
      <BotonPizarra pin={pin} clave={meta?.clave} acciones={acciones} />
      <Button variant="danger" className="!px-3 !py-1.5 text-sm" onClick={onCerrar}>{t('cerrarSala')}</Button>
    </header>
  )
}

/* ── Preparar ────────────────────────────────────────────────────────────── */

function Preparar({ store, user, pin, clave, online, actividades, acciones, clase, fondo, setFondo, esperando, traidaRota }) {
  const t = useT()
  /* Se edita en local y se guarda en la sala con una pausa: escribir en la base
     con cada tecla hace saltar el cursor cuando vuelve el eco. */
  const [lista, setLista] = useState(actividades)
  const primera = useRef(true)
  useEffect(() => {
    if (primera.current) { primera.current = false; return }
    const espera = setTimeout(() => {
      acciones.guardarActividades(lista)
      guardado.set(ULTIMAS_KEY, JSON.stringify(lista))
    }, 400)
    return () => clearTimeout(espera)
  }, [lista])

  /* TÍTULO Y OBJETIVO DE LA CLASE (8-oct-2026): salen en el PDF que se llevan
     los estudiantes. Se editan en local y se guardan con pausa, como la lista. */
  const [titulo, setTitulo] = useState(clase?.titulo || '')
  const [objetivo, setObjetivo] = useState(clase?.objetivo || '')
  const primeraClase = useRef(true)
  useEffect(() => {
    if (primeraClase.current) { primeraClase.current = false; return }
    const espera = setTimeout(() => {
      acciones.guardarClase({ titulo, objetivo })
      guardado.set(CLASE_KEY, JSON.stringify({ titulo, objetivo }))
    }, 400)
    return () => clearTimeout(espera)
  }, [titulo, objetivo])

  const lanzar = async (i) => {
    await acciones.guardarActividades(lista)
    guardado.set(ULTIMAS_KEY, JSON.stringify(lista))
    /* El título y el objetivo también, sin esperar la pausa: si se lanza
       apenas se escribieron, la pausa se cancela al salir de Preparar y el
       PDF salía solo con la fecha. */
    acciones.guardarClase({ titulo, objetivo }).catch(() => {})
    guardado.set(CLASE_KEY, JSON.stringify({ titulo, objetivo }))
    acciones.mostrar(i, lista[i]?.tipo)
  }
  const primeraLista = lista.findIndex(a => !problemaDe(a))
  /* La que llegó del Toolbox, mientras siga en la lista. */
  const iTraida = esperando ? lista.findIndex(a => a.id === esperando) : -1

  const cambiarIdioma = (l) => {
    acciones.cambiarIdioma(l)
    guardado.set(IDIOMA_KEY, l)
  }

  return (
    <main className="flex-1 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6 p-6">
      <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <Unirse pin={pin} online={online} />
        <div className="rounded-2xl bg-white border border-slate-200 p-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="font-bold text-slate-800">{t('idiomaSala')}</p>
            <p className="text-xs text-slate-500">{t('idiomaAyuda')}</p>
          </div>
          <SelectorIdioma idioma={t.idioma} onCambiar={cambiarIdioma} />
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col gap-2">
          <div>
            <p className="font-bold text-slate-800">{t('fondoProyector')}</p>
            <p className="text-xs text-slate-500">{t('fondoAyuda')}</p>
          </div>
          <SelectorFondo valor={fondo} onCambiar={setFondo} />
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[12rem]">
            <p className="font-bold text-slate-800">{t('controlaCelular')}</p>
            <p className="text-xs text-slate-500">{t('controlaCelularAyuda')}</p>
          </div>
          <BotonCelular pin={pin} clave={clave} etiqueta={t('mostrarCodigo')} />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        {iTraida >= 0 && (
          <div role="status" className="rounded-2xl border-2 border-teal-600 bg-teal-50 p-4 flex flex-wrap items-center gap-3">
            <p className="flex-1 min-w-[14rem] font-semibold text-teal-900">{t('traidaDelBelt', t(`tipo_${lista[iTraida].tipo}`))}</p>
            <Button onClick={() => lanzar(iTraida)}>{t('mostrarAhora')}</Button>
          </div>
        )}
        {traidaRota && (
          <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{t('traidaInvalida')}</p>
        )}
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-slate-900">{t('actividades')}</h2>
          <Button disabled={primeraLista < 0} onClick={() => lanzar(primeraLista)}>{t('empezar')}</Button>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col gap-2">
          <p className="font-bold text-slate-800">{t('estaClase')}</p>
          <input value={titulo} maxLength={LARGO_TITULO} placeholder={t('nombreMaterialEj')} aria-label={t('nombreMaterial')}
            onChange={(e) => setTitulo(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 font-semibold focus:border-teal-600 outline-none" />
          <textarea value={objetivo} maxLength={LARGO_OBJETIVO} rows={2} placeholder={t('objetivoClaseEj')} aria-label={t('objetivoClase')}
            onChange={(e) => setObjetivo(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-600 outline-none resize-none" />
          <p className="text-xs text-slate-500">{t('estaClaseAyuda')}</p>
        </div>
        <PanelMateriales store={store} user={user} lista={lista} fondo={fondo} titulo={titulo} objetivo={objetivo}
          onCargar={(m) => {
            setLista(actividadesParaSala(m)); cambiarIdioma(m.idioma); setFondo(m.fondo)
            setTitulo(m.nombre); setObjetivo(m.objetivo)
          }} />
        <Editor lista={lista} setLista={setLista} onMostrar={lanzar} />
      </section>
    </main>
  )
}

/* Cargar un material en la sala, o guardar lo que se armó aquí. */
function PanelMateriales({ store, user, lista, fondo, titulo, objetivo, onCargar }) {
  const t = useT()
  const raw = useValue(store, user ? rutaMateriales(user.uid) : null)
  const materiales = listaDeMateriales(raw)
  const [elegido, setElegido] = useState('')
  const [aviso, setAviso] = useState(null)
  const [origen, setOrigen] = useState(() => {
    try { return JSON.parse(guardado.get(ORIGEN_KEY)) } catch { return null }
  })
  const recordar = (o) => { setOrigen(o); guardado.set(ORIGEN_KEY, o ? JSON.stringify(o) : null) }

  if (user === undefined) return null
  if (!user) {
    return (
      <div className="rounded-2xl bg-teal-50 border border-teal-200 p-4 flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm text-teal-900">{t('materialesSinSesion')}</p>
        <Button variant="ghost" className="!px-3 !py-1.5 text-sm" onClick={() => iniciarSesion(store, t.idioma)}>{t('iniciarSesion')}</Button>
      </div>
    )
  }

  const cargar = () => {
    const m = materiales.find(x => x.id === elegido)
    if (!m) return
    if (lista.length && !confirm(t('confirmarReemplazar'))) return
    onCargar(m)
    recordar({ id: m.id, nombre: m.nombre })
    setAviso(null)
  }

  const guardar = async (comoNuevo) => {
    let id = origen?.id
    /* El nombre del material es el título de la clase. */
    let nombre = titulo.trim() || origen?.nombre
    if (comoNuevo || !id) {
      nombre = prompt(t('nombreParaGuardar'), nombre || '')
      if (!nombre || !nombre.trim()) return
      id = idMaterialNuevo()
    }
    const m = materialParaGuardar({ nombre, objetivo, idioma: t.idioma, fondo, actividades: lista }, store.stamp())
    await store.set(rutaMaterial(user.uid, id), m)
    recordar({ id, nombre: m.nombre })
    setAviso(t('guardadoEn', m.nombre))
  }

  const sigueExistiendo = origen && materiales.some(m => m.id === origen.id)

  return (
    <div className="rounded-2xl bg-teal-50 border border-teal-200 p-4 flex flex-col gap-3">
      {materiales.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={elegido} onChange={(e) => setElegido(e.target.value)} aria-label={t('cargarMaterial')}
            className="flex-1 min-w-[12rem] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">{t('cargarMaterial')}…</option>
            {materiales.map(m => (
              <option key={m.id} value={m.id}>
                {m.nombre || t('sinNombre')} · {t('nActividades', m.actividades.length)} · {m.idioma.toUpperCase()}
              </option>
            ))}
          </select>
          <Button variant="ghost" className="!px-3 !py-1.5 text-sm" disabled={!elegido} onClick={cargar}>{t('cargar')}</Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {sigueExistiendo ? (
          <>
            <Button variant="ghost" className="!px-3 !py-1.5 text-sm" disabled={!lista.length} onClick={() => guardar(false)}>
              {t('guardarCambios', origen.nombre)}
            </Button>
            <Button variant="ghost" className="!px-3 !py-1.5 text-sm" disabled={!lista.length} onClick={() => guardar(true)}>
              {t('guardarComoNuevo')}
            </Button>
          </>
        ) : (
          <Button variant="ghost" className="!px-3 !py-1.5 text-sm" disabled={!lista.length} onClick={() => guardar(true)}>
            {t('guardarEnMateriales')}
          </Button>
        )}
        <a href="#/materiales" target="_blank" rel="noopener" className="text-sm font-semibold text-teal-800 underline underline-offset-2">
          {t('misMateriales')}
        </a>
        {aviso && <span role="status" className="text-sm text-teal-900">{aviso}</span>}
      </div>
    </div>
  )
}

/* El QR va chico y con ⤢: tocándolo viaja al centro, grande, para que se
   pueda escanear desde cualquier puesto (al costado costaba, 8-oct-2026). */
function Unirse({ pin, online }) {
  const t = useT()
  const url = urlParaUnirse(pin)
  const qr = useQr(url, 720)
  const direccion = url.split('#')[0]
  return (
    <section className="rounded-3xl bg-white border border-slate-200 p-6 flex flex-col items-center justify-center text-center gap-3">
      <p className="text-xl font-bold text-slate-700">{t('escaneaParaEntrar')}</p>
      {qr && (
        <QrAmpliable src={qr} alt={t('qrEntrar')} etiqueta={t('agrandarCodigo')} claseQr="w-36 h-36" className="my-1"
          titulo={t('escaneaParaEntrar')} cerrarTexto={`${direccion} · ${t('tocaCerrar')}`}
          pie={<p className="text-6xl font-black tracking-[.2em]">{pin}</p>} />
      )}
      <p className="text-slate-500">{t('oEntraA')} <b className="text-slate-800 break-all">{direccion}</b> {t('conElPin')}</p>
      <p className="text-6xl font-black tracking-[.2em] text-slate-900">{pin}</p>
      <p className="text-lg text-slate-600">{t('conectados', conectados(online))}</p>
    </section>
  )
}

/* ── Presentar ───────────────────────────────────────────────────────────── */

function Presentar({ store, base, pin, clave, idx, actividad, actividades, online, estado, participantes, acciones, fondo }) {
  const t = useT()
  const total = actividades.length
  const aid = actividad.id
  const respuestas = useValue(store, aid ? `${base}/respuestas/${aid}` : null)
  const moderacion = useValue(store, aid ? `${base}/moderacion/${aid}` : null)
  /* La abierta como tablero: las fotos grandes (el proyector es el único que
     las baja) y los comentarios. */
  const tablero = esTablero(actividad)
  const fotos = useValue(store, tablero && actividad.foto ? `${base}/fotos/${aid}` : null)
  const comentarios = useValue(store, tablero && actividad.comentarios ? `${base}/comentarios/${aid}` : null)
  const miniaturas = useValue(store, tablero && actividad.foto && estado.moderando ? `${base}/minis/${aid}` : null)
  /* La moderación proyectada es de la sala, no de esta pestaña: se prende y
     apaga desde aquí o desde la tablet (Mod.jsx). */
  const moderando = Boolean(estado.moderando)
  const moderable = esModerable(actividad.tipo)
  const apuesta = actividad.tipo === 'apuesta'
  const fase = faseApuesta(estado)
  /* El crucigrama y la sopa: llegan armados del Belt y se destapan igual. */
  const armado = destapables(actividad)
  const cruci = Boolean(armado)
  const enSala = conectados(online)
  /* Con la columna de moderación abierta, la barra de abajo va compacta. */
  const chico = moderando && moderable ? '!px-3 !py-2 text-sm' : ''
  const ir = (i) => acciones.mostrar(i, actividades[i]?.tipo)

  /* CRUCIGRAMA Y SOPA: cuando una palabra llega al umbral (la mitad de los
     conectados, por defecto), este proyector la anota como destapada. Queda
     anotada: si después se desconecta alguien, no se vuelve a tapar. */
  useEffect(() => {
    if (!armado || respuestas === undefined || moderacion === undefined) return
    const { palabras, clave } = armado
    const nuevas = porDestapar(palabras, progreso(respuestas, palabras, clave).por, umbral(actividad.destapar, enSala), moderacion?.destapadas, clave)
    if (nuevas.length) acciones.destapar(aid, nuevas)
  }, [cruci, respuestas, moderacion, enSala])
  const n = cuantosRespondieron(respuestas)
  const aprobadasYPendientes = conTexto(actividad.tipo) ? abiertas(respuestas, moderacion?.abiertas, {}, {}, actividad.sinModerar === true)
    : actividad.tipo === 'preguntas' ? preguntasDelCurso(respuestas, moderacion)
    : null
  const pendientes = aprobadasYPendientes?.pendientes.length || 0
  /* CON FONDO, CADA COSA LLEVA SU PROPIO PANEL, y no uno solo para todo. Iba un
     panel casi opaco del tamaño de la pantalla y el fondo quedaba reducido a un
     marco de 20 px: en una pregunta abierta se veía un cuadrado gigante y un
     borde de color. Ahora el panel envuelve solo lo que necesita respaldo para
     leerse (la pregunta, el contador, la nube y los gráficos) y las respuestas
     abiertas, que ya son tarjetas opacas, van directo sobre el fondo. */
  const f = fondoPorId(fondo)
  const conFondo = Boolean(f.css)
  const panel = conFondo ? 'panel-proyector rounded-3xl shadow-xl' : ''
  /* El muro sí lleva panel: su título y su cuenta son texto suelto. */
  const sinPanel = estado.resultados && actividad.tipo !== 'muro' && (aprobadasYPendientes?.aprobadas.length || 0) > 0

  return (
    <main className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex min-h-0">
      <div className="flex-1 flex flex-col min-w-0">
        <div className={`flex-1 flex flex-col min-h-0 ${conFondo ? 'p-5 gap-5' : ''}`} style={conFondo ? { background: f.css } : undefined}>
        <div className={`${panel} ${conFondo ? 'pb-6' : ''}`}>
          <div className="px-8 pt-6 flex items-center gap-3 text-slate-500">
            <span className="text-sm font-bold uppercase tracking-wider">{t(`tipo_${actividad.tipo}`)} · {t('deTotal', idx + 1, total)}</span>
            <span className="flex-1" />
            {tablero && estado.resultados && (
              <SelectorVista actividad={actividad} vista={vistaDe(actividad, moderacion)} onCambiar={(v) => acciones.vista(aid, v)} />
            )}
            <JoinCorner pin={pin} />
          </div>
          <h1 className={`px-8 pt-2 font-black text-slate-900 leading-tight ${cruci ? 'text-3xl' : 'text-5xl'}`}><TextoConHuecos texto={tituloDe(actividad, t)} /></h1>
          {actividad.tipo === 'antesahora' && (actividad.antes || actividad.ahora) && (
            <div className="px-8 pt-4"><MarcoAntesAhora antes={actividad.antes} ahora={actividad.ahora} /></div>
          )}
        </div>

        <div className={`flex-1 flex items-center justify-center min-h-0 overflow-auto ${conFondo ? 'px-3 py-2' : 'px-8 py-8'}`}>
          {cruci ? (
            /* Se ven siempre: lo que se tapa son las palabras. */
            <div className={conFondo ? `${panel} p-8 w-full` : 'w-full'}>
              {actividad.tipo === 'sopa'
                ? <Sopa actividad={actividad} respuestas={respuestas} destapadas={moderacion?.destapadas} conectados={enSala}
                    onDestapar={(claves) => acciones.destapar(aid, claves)} />
                : <Crucigrama actividad={actividad} respuestas={respuestas} destapadas={moderacion?.destapadas} conectados={enSala}
                    onDestapar={(claves) => acciones.destapar(aid, claves)} />}
            </div>
          ) : apuesta ? (
            /* La apuesta va por fases, no por «mostrar resultados». */
            <div className={conFondo ? `${panel} p-8 w-full max-w-6xl` : 'w-full'}>
              <Apuesta consignas={consignasDe(actividad)} respuestas={respuestas} fase={fase} />
            </div>
          ) : estado.resultados ? (
            sinPanel
              ? <Resultados actividad={actividad} respuestas={respuestas} moderacion={moderacion} sobreFondo={conFondo}
                  tablero={tablero ? { fotos, comentarios, participantes } : null} />
              : (
                <div className={`${panel} ${conFondo ? `p-8 ${actividad.tipo === 'nube' ? 'max-w-full' : 'w-full max-w-5xl'}` : 'w-full flex justify-center'}`}>
                  <Resultados actividad={actividad} respuestas={respuestas} moderacion={moderacion}
                    tablero={tablero ? { fotos, comentarios, participantes } : null} />
                </div>
              )
          ) : (
            <div className={`text-center ${conFondo ? `${panel} px-14 py-8` : ''}`}>
              <p className="text-8xl font-black text-slate-900 tabular-nums">{n}</p>
              <p className="text-2xl text-slate-500 mt-2">{t('respuestaN', n)}</p>
            </div>
          )}
        </div>
        </div>

      </div>

      {moderando && moderable && (
        /* MODERACIÓN PROYECTADA (8-oct-2026): el curso ve llegar las oraciones y
           cómo se corrigen, para retroalimentar en grupo. Ancha y con letra
           grande para leerse desde atrás; nunca con nombres. */
        <aside className="w-[clamp(26rem,40vw,42rem)] shrink-0 border-l border-slate-200 bg-slate-50 p-5 overflow-auto text-xl">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-black text-slate-900">{t('moderar')}</h2>
            <button onClick={() => acciones.moderando(false)} className="text-slate-500 text-base">{t('cerrar')}</button>
          </div>
          <p className="text-sm text-teal-900 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 mb-3">
            {t('moderacionProyectada')}
          </p>
          <Moderacion actividad={actividad} respuestas={respuestas} moderacion={moderacion} participantes={participantes}
            fotos={miniaturas} comentarios={comentarios}
            onComentario={(c, texto) => acciones.comentar(aid, c.cid, { de: c.de, en: c.en, texto })}
            onPalabra={(clave, d) => acciones.moderarPalabra(aid, clave, d)}
            onAbierta={(pid, d) => acciones.decidirAbierta(aid, pid, d)}
            onAprobarVarias={(pids) => acciones.aprobarVarias(aid, pids)}
            onCorregir={(pid, texto, de) => acciones.corregirAbierta(aid, pid, texto, de)}
            onPregunta={(qid, d) => acciones.decidirPregunta(aid, qid, d)}
            onRespondida={(qid, si) => acciones.marcarRespondida(aid, qid, si)}
            onCorregirPregunta={(qid, texto, de) => acciones.corregirPregunta(aid, qid, texto, de)}
            onCorregirPalabra={(origenes, texto) => acciones.corregirPalabra(aid, origenes, texto)}
            onVerCorrecciones={(si) => acciones.verCorrecciones(aid, si)}
            onBorrador={(clave, texto) => acciones.borrador(aid, texto === null ? null : { clave, texto })} />
        </aside>
      )}
      </div>

      {/* LA BARRA DE ABAJO (9-oct-2026). Va a todo lo ancho, debajo de la
          columna de moderación y no al lado: con la columna abierta le
          quedaba la mitad de la pantalla y se partía en dos filas. Con la
          columna abierta, además, los botones van compactos.
          Lo que no está en su estado normal se ve de reojo: respuestas
          cerradas y resultados ocultos en ámbar, moderación encendida en
          teal. Y «3 de 25 respondieron»: sin el total no se sabe cuándo
          pasar a lo siguiente. */}
      <footer className="flex flex-wrap items-center gap-2 px-6 py-3 bg-white border-t border-slate-200">
        <Button variant="ghost" className={chico} onClick={() => ir(idx - 1)} disabled={idx === 0}>{t('anterior')}</Button>
        <Button variant={estado.abierta ? 'ghost' : 'aviso'} className={chico} onClick={() => acciones.abrir(!estado.abierta)}>
          {estado.abierta ? t('cerrarRespuestas') : t('reabrirRespuestas')}
        </Button>
        {apuesta
          ? <FasesApuesta fase={fase} acciones={acciones} className={chico} />
          : cruci ? (
            <Button variant="ghost" className={chico} onClick={() => acciones.destapar(aid, armado.palabras.map(armado.clave))}>
              {actividad.tipo === 'sopa' ? t('mostrarTodas') : t('destaparTodas')}
            </Button>
          ) : (
            <Button variant={estado.resultados ? 'ghost' : 'aviso'} className={chico} onClick={() => acciones.resultados(!estado.resultados)}>
              {estado.resultados ? t('ocultarResultados') : t('mostrarResultados')}
            </Button>
          )}
        {moderable && (
          <Button variant={moderando ? 'activo' : 'ghost'} className={chico} onClick={() => acciones.moderando(!moderando)}>
            {t('moderar')}{pendientes ? ` · ${pendientes}` : ''}
          </Button>
        )}
        <BotonCelular pin={pin} clave={clave} etiqueta={moderable ? t('moderarEnTablet') : t('celular')} className={chico} />
        <span className={`flex-1 text-center text-slate-500 tabular-nums ${chico ? 'text-sm' : ''}`}>
          {t('respondieronDe', n, Math.max(enSala, n))}{estado.abierta ? '' : ` · ${t('cerradas')}`}
        </span>
        {/* En la última, «Terminar» ya vuelve a las actividades: dos botones
            que hacen lo mismo, uno al lado del otro, confundían. */}
        {idx < total - 1 && <Button variant="ghost" className={chico} onClick={acciones.volverAPreparar}>{t('actividades')}</Button>}
        {idx < total - 1
          ? <Button className={chico} onClick={() => ir(idx + 1)}>{t('siguiente')}</Button>
          : <Button className={chico} onClick={acciones.volverAPreparar}>{t('terminar')}</Button>}
      </footer>
    </main>
  )
}

/* Las fases de la apuesta, en orden: el botón que avanza es el sólido, y se
   puede volver un paso por si se tocó antes de tiempo. Las usa también el
   celular del docente (Mod.jsx). */
export function FasesApuesta({ fase, acciones, className = '' }) {
  const t = useT()
  if (fase === 'escribir') return <Button className={className} onClick={() => acciones.fase('apostar')}>{t('aApostar')}</Button>
  if (fase === 'apostar') {
    return (
      <>
        <Button variant="ghost" className={className} onClick={() => acciones.fase('escribir')}>{t('volverAEscribir')}</Button>
        <Button className={className} onClick={() => acciones.fase('comparar')}>{t('ahoraCorrijan')}</Button>
      </>
    )
  }
  return <Button variant="ghost" className={className} onClick={() => acciones.fase('apostar')}>{t('volverAApostar')}</Button>
}

function Resultados({ actividad, respuestas, moderacion, sobreFondo = false, tablero = null }) {
  const t = useT()
  if (tablero) {
    const { aprobadas: publicaciones } = abiertas(respuestas, moderacion?.abiertas, tablero.participantes, moderacion?.correcciones, actividad.sinModerar === true)
    return (
      <Tablero actividad={actividad} publicaciones={publicaciones} fotos={tablero.fotos}
        comentarios={comentariosPorPublicacion(tablero.comentarios, tablero.participantes)}
        vista={vistaDe(actividad, moderacion)} verCambios={seVenCorrecciones(moderacion)} borrador={moderacion?.borrador} sobreFondo={sobreFondo} />
    )
  }
  const aprobadas = () => abiertas(respuestas, moderacion?.abiertas, {}, moderacion?.correcciones).aprobadas
  switch (actividad.tipo) {
    case 'semaforo': return <div className="w-full max-w-5xl mx-auto"><Semaforo respuestas={respuestas} /></div>
    case 'duda': return <Abiertas aprobadas={aprobadas()} sobreFondo={sobreFondo} verCambios={seVenCorrecciones(moderacion)} borrador={moderacion?.borrador} />
    case 'antesahora': return <Abiertas aprobadas={aprobadas()} sobreFondo={sobreFondo} verCambios={seVenCorrecciones(moderacion)} prefijo={t('porque')} borrador={moderacion?.borrador} />
    case 'muro': return <Muro aprobadas={aprobadas()} sobreFondo={sobreFondo} verCambios={seVenCorrecciones(moderacion)} />
    case 'nube': return <Nube respuestas={respuestas} moderacion={moderacion?.palabras} correcciones={moderacion?.correccionesNube} />
    case 'encuesta': return <div className="w-full max-w-4xl mx-auto"><Encuesta actividad={actividad} respuestas={respuestas} /></div>
    case 'escala': return <div className="w-full max-w-4xl mx-auto"><Escala respuestas={respuestas} /></div>
    case 'abierta': return <Abiertas aprobadas={abiertas(respuestas, moderacion?.abiertas, {}, moderacion?.correcciones).aprobadas} sobreFondo={sobreFondo} verCambios={seVenCorrecciones(moderacion)} borrador={moderacion?.borrador} />
    case 'ranking': return <div className="w-full max-w-4xl mx-auto"><Ranking actividad={actividad} respuestas={respuestas} /></div>
    case 'preguntas': return <Preguntas aprobadas={preguntasDelCurso(respuestas, moderacion).aprobadas} sobreFondo={sobreFondo} verCambios={seVenCorrecciones(moderacion)} borrador={moderacion?.borrador} />
    default: return null
  }
}

/* ── QR ──────────────────────────────────────────────────────────────────── */

function useQr(texto, ancho) {
  const [qr, setQr] = useState(null)
  useEffect(() => { if (texto) QRCode.toDataURL(texto, { margin: 1, width: ancho }).then(setQr) }, [texto, ancho])
  return qr
}

/* En plena actividad el QR queda chico en una esquina, por si llega alguien
   tarde; tocándolo viaja al centro y se agranda (QrAmpliable). */
function JoinCorner({ pin }) {
  const t = useT()
  const url = urlParaUnirse(pin)
  const qr = useQr(url, 720)
  if (!qr) return null
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-1.5 pr-3">
      <QrAmpliable src={qr} alt={t('qrEntrar')} etiqueta={t('agrandarCodigo')} claseQr="w-14 h-14" insigniaChica className="!flex-row gap-3"
        titulo={t('escaneaParaEntrar')} cerrarTexto={`${url.split('#')[0]} · ${t('tocaCerrar')}`}
        pie={<p className="text-6xl font-black tracking-[.2em]">{pin}</p>}>
        <span className="text-left leading-tight">
          <span className="block text-xs text-slate-500">{t('pin')}</span>
          <span className="block text-xl font-black tracking-widest text-slate-900">{pin}</span>
        </span>
      </QrAmpliable>
    </div>
  )
}

/* El enlace para moderar desde el celular lleva la clave de la sala: con el
   PIN solo se entra como estudiante.

   UNO POR PANTALLA (9-oct-2026). Estaba solo arriba, entre «Compartir» y
   «Cerrar sala», y decía «Celular»: el docente no lo encontraba al moderar
   con la tablet. Se agregó junto a «Moderar» y en una tarjeta al preparar,
   y quedó repetido; ahora sale de arriba. Al preparar, la tarjeta; durante
   una actividad, la barra de abajo. */
function BotonCelular({ pin, clave, etiqueta = null, variant = 'ghost', className = '!px-3 !py-1.5 text-sm' }) {
  const t = useT()
  const [abierto, setAbierto] = useState(false)
  const url = `${location.origin}${location.pathname}#/mod?pin=${pin}&clave=${clave}`
  const qr = useQr(abierto && clave ? url : null, 480)
  return (
    <>
      <Button variant={variant} className={className} onClick={() => setAbierto(true)} disabled={!clave}>{etiqueta || t('celular')}</Button>
      {abierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 grid place-items-center p-4" onClick={() => setAbierto(false)}>
          <div className="rounded-3xl bg-white p-6 max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-black text-slate-900">{t('controlaCelular')}</h2>
            <p className="text-sm text-slate-600 mt-1">{t('controlaCelularAyuda')}</p>
            {qr && <img src={qr} alt={t('qrCelular')} className="w-64 h-64 mx-auto my-4" />}
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
              {t('avisoQrCelular')}
            </p>
            <Button className="mt-4 w-full" onClick={() => setAbierto(false)}>{t('listo')}</Button>
          </div>
        </div>
      )}
    </>
  )
}

/* ── Pizarra ─────────────────────────────────────────────────────────────── */

/* El QR para la tablet, como el del celular: lleva la clave de la sala. */
function BotonPizarra({ pin, clave, acciones }) {
  const t = useT()
  const [abierto, setAbierto] = useState(false)
  const url = `${location.origin}${location.pathname}#/pizarra?pin=${pin}&clave=${clave}`
  const qr = useQr(abierto && clave ? url : null, 480)
  return (
    <>
      <Button variant="ghost" className="!px-3 !py-1.5 text-sm" onClick={() => setAbierto(true)} disabled={!clave}>{t('pizarra')}</Button>
      {abierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 grid place-items-center p-4" onClick={() => setAbierto(false)}>
          <div className="rounded-3xl bg-white p-6 max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-black text-slate-900">{t('pizarraEnTablet')}</h2>
            <p className="text-sm text-slate-600 mt-1">{t('pizarraEnTabletAyuda')}</p>
            {qr && <img src={qr} alt={t('qrPizarra')} className="w-64 h-64 mx-auto my-4" />}
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
              {t('avisoQrPizarra')}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setAbierto(false)}>{t('listo')}</Button>
              <Button onClick={() => { acciones.pizarra(true); setAbierto(false) }}>{t('mostrarPizarra')}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* Lo que se escribe en la tablet, en vivo y en grande. Desde aquí solo se
   cambia de página y se vuelve a la actividad: escribir es cosa de la tablet. */
function PizarraProyector({ store, pin, acciones }) {
  const t = useT()
  const ruta = rutaPizarra(pin)
  const vista = vistaValida(useValue(store, `${ruta}/vista`))
  const trazosRaw = useValue(store, `${ruta}/paginas/${vista.pagina}/trazos`)
  const enCursoRaw = useValue(store, `${ruta}/enCurso`)
  const trazos = useMemo(() => trazosEnOrden(trazosRaw), [trazosRaw])
  const enCurso = useMemo(() => enCursoVisible(enCursoRaw, vista.pagina, trazosRaw), [enCursoRaw, vista.pagina, trazosRaw])
  const irA = (pagina) => store.set(`${ruta}/vista`, { ...vista, pagina, y: 0 })
  /* El proyector sigue a la tablet en el cuaderno; con la rueda del mouse
     también se baja desde aquí (y la tablet lo sigue a él). */
  const papel = useRef(null)
  const rueda = (e) => {
    const alto = papel.current?.getBoundingClientRect().height || 1
    store.update(`${ruta}/vista`, { y: yValida(vista.y + (e.deltaY / alto) * ALTO) })
  }

  return (
    <main className="flex-1 flex flex-col min-h-0">
      <Lienzo trazos={trazos} enCurso={enCurso} fondo={vista.fondo} y={vista.y} papelRef={papel} onWheel={rueda} className="flex-1 p-4" />
      <footer className="flex items-center gap-2 px-6 py-3 bg-white border-t border-slate-200">
        <Button variant="ghost" onClick={() => acciones.pizarra(false)}>{t('volverDePizarra')}</Button>
        <span className="flex-1" />
        <Button variant="ghost" onClick={() => irA(vista.pagina - 1)} disabled={vista.pagina === 0} aria-label={t('paginaAnterior')}>‹</Button>
        <span className="font-bold text-slate-700 tabular-nums">{t('paginaDe', vista.pagina + 1, vista.paginas)}</span>
        <Button variant="ghost" onClick={() => irA(vista.pagina + 1)} disabled={vista.pagina >= vista.paginas - 1} aria-label={t('paginaSiguiente')}>›</Button>
      </footer>
    </main>
  )
}

/* ── Compartir la clase ──────────────────────────────────────────────────── */

/* Los resúmenes que este computador compartió y ya vencieron se borran al
   abrir una sala: las reglas solo dejan borrar los vencidos. */
function borrarResumenesVencidos(store) {
  const mios = leerMios()
  const fuera = vencidos(mios, store.now())
  if (!fuera.length) return
  for (const id of fuera) {
    store.remove(rutaResumen(id)).catch(() => {})
    delete mios[id]
  }
  guardarMios(mios)
}

/* Copia la clase, sin nombres, a un resumen que dura 15 días, y avisa a los
   celulares que están en la sala. El QR y el enlace son para quien no estaba
   conectado y para el aula virtual. «Actualizar» hace una copia nueva con lo
   último (los celulares pasan a la nueva). */
function BotonCompartir({ store, pin }) {
  const t = useT()
  const [abierto, setAbierto] = useState(false)
  const id = useValue(store, abierto ? `${raiz(pin)}/resumen` : null)
  const [resumen, setResumen] = useState(null)
  const [estado, setEstado] = useState(null) // null | 'creando' | 'vacio' | 'copiado' | 'error'
  const url = id ? urlResumen(id) : null
  const qr = useQr(abierto ? url : null, 480)

  useEffect(() => {
    if (!id || resumen?.id === id) return
    store.get(rutaResumen(id)).then(r => r && setResumen({ ...normalizar(r), id }), () => {})
  }, [id])

  const compartir = async () => {
    setEstado('creando')
    try {
      const r = armarResumen(await store.get(raiz(pin)), store.now())
      if (resumenVacio(r)) { setEstado('vacio'); return }
      const nuevo = idResumenNuevo()
      await store.set(rutaResumen(nuevo), r)
      await store.set(`${raiz(pin)}/resumen`, nuevo)
      guardarMios({ ...leerMios(), [nuevo]: r.vence })
      setResumen({ ...normalizar(r), id: nuevo })
      setEstado(null)
    } catch (e) {
      console.error(e)
      setEstado('error')
    }
  }
  const copiar = async () => {
    try { await navigator.clipboard.writeText(url); setEstado('copiado') } catch { /* sin portapapeles */ }
  }

  return (
    <>
      <Button variant="ghost" className="!px-3 !py-1.5 text-sm" onClick={() => setAbierto(true)}>{t('compartir')}</Button>
      {abierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 grid place-items-center p-4" onClick={() => setAbierto(false)}>
          <div className="rounded-3xl bg-white p-6 max-w-md w-full text-center flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-black text-slate-900">{t('compartirClase')}</h2>
            {!id ? (
              <>
                <p className="text-sm text-slate-600">{t('compartirAyuda')}</p>
                <Button onClick={compartir} disabled={estado === 'creando'}>{estado === 'creando' ? t('creandoResumen') : t('compartirClase')}</Button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600">{t('compartidaAyuda')}</p>
                {qr && <img src={qr} alt={t('qrClase')} className="w-56 h-56 mx-auto" />}
                <p className="text-xs text-slate-500 break-all">{url}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="ghost" onClick={copiar}>{estado === 'copiado' ? t('copiado') : t('copiarEnlace')}</Button>
                  {resumen?.id === id ? <BotonPdf resumen={resumen} /> : <Button disabled>{t('cargando')}</Button>}
                </div>
                <Button variant="ghost" onClick={compartir} disabled={estado === 'creando'}>
                  {estado === 'creando' ? t('creandoResumen') : t('actualizarResumen')}
                </Button>
              </>
            )}
            {estado === 'vacio' && <p role="status" className="text-sm text-amber-800">{t('nadaQueCompartir')}</p>}
            {estado === 'error' && <p role="alert" className="text-sm text-rose-700">{t('errorCompartir')}</p>}
            <p className="text-xs text-slate-500">{t('compartirPrivacidad')}</p>
            <Button variant="ghost" onClick={() => setAbierto(false)}>{t('listo')}</Button>
          </div>
        </div>
      )}
    </>
  )
}
