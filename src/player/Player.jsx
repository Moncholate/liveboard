/* ============================================================================
   EL CELULAR DEL ESTUDIANTE
   ----------------------------------------------------------------------------
   Entra con el PIN y un apodo, y responde lo que esté en el proyector. Mientras
   la actividad siga abierta puede cambiar su respuesta: equivocarse de botón no
   debería ser definitivo.

   El apodo lo ve solo el docente, en su celular. El proyector no muestra
   nombres, y esta pantalla lo dice: quien sabe que no lo van a exponer escribe
   lo que piensa.

   IDIOMA: antes de entrar no se sabe a qué sala va, así que la entrada usa el
   del navegador (y se puede cambiar). Ya dentro, manda el de la sala.
   ========================================================================== */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, useValue } from '../net/hooks.js'
import { Button, Center, Logo } from '../ui.jsx'
import { ProveedorIdioma, SelectorIdioma, idiomaDelNavegador, traducir, useT, valido } from '../i18n.jsx'
import {
  ALTERNATIVAS, LIMITES, abiertas, conTexto, consignasDe, correccionVigente, idAlAzar, limpiarAbierta, limpiarLado, nombreValido, palabrasDe,
  partirEnHuecos, preguntasDelCurso, tituloDe,
} from '../live/logic.js'
import { LAMPARA, NIVELES, faseApuesta, largoHueco, miCalibracion, moldeCompleto, textoDeMolde } from '../live/cierres.js'
import { Consignas, Grilla, SopaGrilla, TextoConHuecos } from '../live/Resultados.jsx'
import { claveSopa, filasDe, palabraEntre, palabrasSopa } from '../live/sopa.js'
import { acierta, casillasDe, claveDe, palabrasDe as palabrasCrucigrama, soloLetras } from '../live/crucigrama.js'
import { Cambios } from '../live/Cambios.jsx'
import { BotonPdf, normalizar } from './Clase.jsx'
import { rutaResumen, urlResumen } from '../live/resumen.js'
import { accionesDeSala, comoLista, raiz } from '../live/sala.js'
import { TarjetaPublicacion, colorColumna } from '../live/Tablero.jsx'
import {
  LIMITES_TABLERO, celularVeElMuro, columnaDe, columnasDe, comentariosDe, comentariosPorPublicacion, esTablero, limpiarComentario,
  reaccionesDe,
} from '../live/tablero.js'
import { esGroseria } from '../live/groserias.js'
import { useTema } from '../tema.jsx'
import { Icon } from '../icons.jsx'

/* sessionStorage y no localStorage: cada pestaña es un estudiante distinto, y
   al recargar se vuelve a la misma sala con el mismo apodo. */
const sesion = {
  get: (k) => { try { return sessionStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v) } catch { /* modo privado */ } },
}
const pidKey = (pin) => `liveboard-pid-${pin}`

export default function Player({ initialPin }) {
  useTema()
  const store = useStore()
  const [yo, setYo] = useState(null)
  const [revisando, setRevisando] = useState(Boolean(initialPin && sesion.get(pidKey(initialPin))))
  const [idioma, setIdioma] = useState(idiomaDelNavegador)

  useEffect(() => {
    if (!store || !revisando) return
    const pid = sesion.get(pidKey(initialPin))
    store.get(`${raiz(initialPin)}/participantes/${pid}`)
      .then((p) => { if (p) setYo({ pin: initialPin, pid }) })
      .finally(() => setRevisando(false))
  }, [store])

  if (!store || revisando) return <Center>{traducir(idioma, 'cargando')}</Center>
  if (!yo) {
    return (
      <ProveedorIdioma value={idioma}>
        <Entrar store={store} initialPin={initialPin} onDentro={setYo} onIdioma={setIdioma} />
      </ProveedorIdioma>
    )
  }
  return <EnSala store={store} pin={yo.pin} pid={yo.pid}
    onFuera={() => { sesion.set(pidKey(yo.pin), null); setYo(null) }} />
}

function Entrar({ store, initialPin, onDentro, onIdioma }) {
  const t = useT()
  const [pin, setPin] = useState(initialPin || '')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const entrar = async (e) => {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      if (!(await store.get(`${raiz(pin)}/meta`))) throw new Error(t('noHaySala'))
      const pid = idAlAzar()
      await store.set(`${raiz(pin)}/participantes/${pid}`, { nombre: nombreValido(nombre), at: store.stamp() })
      sesion.set(pidKey(pin), pid)
      onDentro({ pin, pid })
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const campo = 'rounded-xl border-2 border-slate-200 px-4 py-3 text-center focus:border-teal-600 outline-none'
  return (
    <div className="min-h-screen grid place-items-center p-4">
      <form onSubmit={entrar} className="w-full max-w-sm flex flex-col gap-3 text-center">
        <Logo className="text-5xl mb-4" />
        <input inputMode="numeric" maxLength={6} placeholder={t('pin')} value={pin} aria-label={t('pinSala')}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          className={`${campo} text-2xl font-black tracking-widest`} />
        <input maxLength={LIMITES.nombre} placeholder={t('tuNombre')} value={nombre} aria-label={t('tuNombre')}
          onChange={(e) => setNombre(e.target.value)} className={`${campo} text-lg font-semibold`} />
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <Button disabled={pin.length !== 6 || !nombreValido(nombre) || enviando} className="text-lg">{t('entrar')}</Button>
        <p className="text-sm text-slate-500">{t('nombreNoAparece')}</p>
        <SelectorIdioma idioma={t.idioma} onCambiar={onIdioma} className="self-center mt-2" />
      </form>
    </div>
  )
}

function EnSala({ store, pin, pid, onFuera }) {
  const base = raiz(pin)
  const meta = useValue(store, `${base}/meta`)
  const idioma = valido(useValue(store, `${base}/idioma`))
  const estado = useValue(store, `${base}/estado`)
  const actividades = comoLista(useValue(store, `${base}/actividades`))
  const yo = useValue(store, `${base}/participantes/${pid}`)
  const resumenId = useValue(store, `${base}/resumen`)
  const clase = useValue(store, `${base}/clase`)

  useEffect(() => store.presence(`${base}/online/${pid}`), [store, base, pid])

  /* La sala se cerró: de vuelta a la entrada, con aviso. */
  useEffect(() => { if (meta === null) { alert(traducir(idioma, 'profeCerro')); onFuera() } }, [meta])

  if (meta === undefined || estado === undefined) return <Center>{traducir(idioma, 'cargando')}</Center>
  const idx = estado?.idx ?? null
  const actividad = idx != null ? actividades[idx] : null

  return (
    <ProveedorIdioma value={idioma}>
      <div className="min-h-screen flex flex-col">
        <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200">
          <Logo className="text-xl" />
          <span className="flex-1" />
          <span className="text-sm text-slate-500 truncate">{yo?.nombre}</span>
        </header>
        <main className="flex-1 flex flex-col p-4 max-w-md w-full mx-auto">
          {resumenId && <AvisoClase key={resumenId} store={store} id={resumenId} />}
          {actividad
            ? <Responder key={actividad.id} store={store} pin={pin} base={base} pid={pid} actividad={actividad} abierta={Boolean(estado.abierta)} fase={faseApuesta(estado)} />
            : <Espera titulo={clase?.titulo} />}
        </main>
      </div>
    </ProveedorIdioma>
  )
}

/* titulo: el de la clase, si el docente lo escribió; así el estudiante confirma que entró a la sala correcta. */
function Espera({ titulo }) {
  const t = useT()
  return (
    <Center>
      {titulo && <p className="mb-4 text-lg font-bold text-teal-800">{titulo}</p>}
      <p className="text-2xl font-bold text-slate-800">{t('estasDentro')}</p>
      <p className="mt-2">{t('miraPantalla')}</p>
    </Center>
  )
}

function Responder({ store, pin, base, pid, actividad, abierta, fase }) {
  if (esTablero(actividad)) return <ResponderTablero store={store} pin={pin} base={base} pid={pid} actividad={actividad} abierta={abierta} />
  if (actividad.tipo === 'preguntas') return <PreguntarYVotar store={store} base={base} pid={pid} actividad={actividad} abierta={abierta} />
  if (actividad.tipo === 'sopa') return <ResponderSopa store={store} base={base} pid={pid} actividad={actividad} abierta={abierta} />
  if (actividad.tipo === 'crucigrama') return <ResponderCrucigrama store={store} base={base} pid={pid} actividad={actividad} abierta={abierta} />
  if (actividad.tipo === 'apuesta') return <ResponderApuesta store={store} base={base} pid={pid} actividad={actividad} abierta={abierta} fase={fase} />
  return <ResponderUna store={store} base={base} pid={pid} actividad={actividad} abierta={abierta} />
}

function ResponderUna({ store, base, pid, actividad, abierta }) {
  const t = useT()
  const aid = actividad.id
  const mia = useValue(store, `${base}/respuestas/${aid}/${pid}`)
  const moderada = conTexto(actividad.tipo)
  const decision = useValue(store, moderada ? `${base}/moderacion/${aid}/abiertas/${pid}` : null)
  const correccion = useValue(store, moderada ? `${base}/moderacion/${aid}/correcciones/${pid}` : null)
  const [editando, setEditando] = useState(false)

  if (mia === undefined) return <Center>{t('cargando')}</Center>
  const enviar = async (valor) => {
    await store.set(`${base}/respuestas/${aid}/${pid}`, { ...valor, at: store.stamp() })
    setEditando(false)
  }
  const yaRespondio = mia && !editando

  return (
    <div className="flex-1 flex flex-col gap-4">
      <h1 className="text-2xl font-black text-slate-900 leading-snug"><TextoConHuecos texto={tituloDe(actividad, t)} /></h1>

      {yaRespondio ? (
        <Enviada actividad={actividad} mia={mia} decision={decision} correccion={correccion} abierta={abierta} onCambiar={() => setEditando(true)} />
      ) : !abierta ? (
        <p className="rounded-2xl bg-slate-100 p-4 text-center font-semibold text-slate-600">{t('respuestasCerradas')}</p>
      ) : actividad.tipo === 'nube' ? <FormNube inicial={mia?.palabras} onEnviar={enviar} />
        : actividad.tipo === 'encuesta' ? <FormEncuesta actividad={actividad} inicial={mia?.opcion} onEnviar={enviar} />
        : actividad.tipo === 'escala' ? <FormEscala inicial={mia?.valor} onEnviar={enviar} />
        : actividad.tipo === 'ranking' ? <FormRanking actividad={actividad} inicial={mia?.orden} onEnviar={enviar} />
        : actividad.tipo === 'semaforo' ? <FormSemaforo inicial={mia?.opcion} onEnviar={enviar} />
        : actividad.tipo === 'duda' || actividad.tipo === 'muro' ? <FormMolde tipo={actividad.tipo} molde={actividad.pregunta} inicial={mia?.huecos} onEnviar={enviar} />
        : actividad.tipo === 'antesahora' ? <FormAntesAhora actividad={actividad} inicial={mia} onEnviar={enviar} />
        : <FormAbierta inicial={mia?.texto} onEnviar={enviar} />}
    </div>
  )
}

/* El veredicto primero y grande: que no quede duda de que se envió. */
function Enviada({ actividad, mia, decision, correccion, abierta, onCambiar }) {
  const t = useT()
  const lo = actividad.tipo === 'nube' ? (mia.palabras || []).join(' · ')
    : actividad.tipo === 'encuesta' ? `${ALTERNATIVAS[mia.opcion]?.letra}. ${actividad.alternativas?.[mia.opcion] ?? ''}`
    : actividad.tipo === 'escala' ? `${mia.valor} · ${t('escala')[mia.valor - 1] ?? ''}`
    : actividad.tipo === 'ranking' ? (mia.orden || []).map((i, p) => `${p + 1}. ${actividad.alternativas?.[i] ?? ''}`).join('  ')
    : actividad.tipo === 'semaforo' ? (
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="w-5 h-5 shrink-0 rounded-full" style={{ background: LAMPARA[NIVELES[mia.opcion]?.id] }} />
        {NIVELES[mia.opcion]?.texto}
      </span>
    )
    : actividad.tipo === 'antesahora' ? <><span className="font-normal text-slate-500">{t('porque')} </span>{mia.texto}</>
    : mia.texto
  const moderada = conTexto(actividad.tipo)
  const corregida = moderada ? correccionVigente(correccion, limpiarAbierta(mia.texto)) : null
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-teal-700 text-white p-5 text-center">
        <p className="text-3xl font-black">{t('listoGrande')}</p>
        <p className="mt-1 text-teal-50">{t('seEnvio')}</p>
      </div>
      <div className="rounded-2xl bg-white border border-slate-200 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('tuRespuesta')}</p>
        {(mia.antes || mia.ahora) && (
          <p className="mt-1 text-sm">
            {mia.antes && <span className="text-slate-500 line-through">{mia.antes}</span>}
            {mia.antes && mia.ahora && <span className="text-slate-400"> → </span>}
            {mia.ahora && <span className="font-semibold text-slate-800">{mia.ahora}</span>}
          </p>
        )}
        {/* LA CORRECCIÓN DEL DOCENTE, solo aquí: es privada. El proyector muestra
            la versión limpia; lo que cambió lo ve únicamente quien la escribió. */}
        {corregida
          ? <Cambios antes={limpiarAbierta(mia.texto)} despues={corregida} className="mt-1 text-lg font-semibold text-slate-900" />
          : <div className="mt-1 text-lg font-semibold text-slate-900 break-words">{lo}</div>}
        {corregida && <p className="mt-2 text-sm font-bold text-teal-800"><Icon name="pencil" className="mr-1" />{t('profeCorrigio')}</p>}
        {moderada && (
          <p className="mt-2 text-sm text-slate-500">{decision === true ? t('enPantallaSinNombre') : t('profeRevisa')}</p>
        )}
      </div>
      {abierta && decision !== true && <Button variant="ghost" onClick={onCambiar}>{t('cambiarRespuesta')}</Button>}
    </div>
  )
}

function FormNube({ inicial, onEnviar }) {
  const t = useT()
  const [palabras, setPalabras] = useState(() => {
    const p = [...(inicial || [])]
    while (p.length < LIMITES.palabrasPorPersona) p.push('')
    return p
  })
  const limpias = palabrasDe(palabras)
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (limpias.length) onEnviar({ palabras: limpias }) }}>
      <p className="text-sm text-slate-500">{t('hastaPalabras', LIMITES.palabrasPorPersona)}</p>
      {palabras.map((p, i) => (
        <input key={i} value={p} maxLength={LIMITES.palabra} placeholder={t('palabraN', i + 1)} aria-label={t('palabraN', i + 1)}
          onChange={(e) => setPalabras(ps => ps.map((x, j) => (j === i ? e.target.value : x)))}
          className="rounded-xl border-2 border-slate-200 px-4 py-3 text-lg font-semibold focus:border-teal-600 outline-none" />
      ))}
      <Button disabled={!limpias.length} className="text-lg mt-1">{t('enviar')}</Button>
    </form>
  )
}

function FormEncuesta({ actividad, inicial, onEnviar }) {
  return (
    <div className="flex flex-col gap-2.5">
      {(actividad.alternativas || []).map((texto, i) => {
        const a = ALTERNATIVAS[i]
        return (
          <button key={i} onClick={() => onEnviar({ opcion: i })}
            className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left active:scale-[.98] transition ${inicial === i ? `${a.borde} ${a.tinte}` : 'border-slate-200 bg-white'}`}>
            <span className={`grid place-items-center w-10 h-10 shrink-0 rounded-xl text-white text-xl font-black ${a.solido}`}>{a.letra}</span>
            <span className="text-lg font-semibold text-slate-900">{texto}</span>
          </button>
        )
      })}
    </div>
  )
}

function FormEscala({ inicial, onEnviar }) {
  const t = useT()
  return (
    <div className="grid grid-cols-5 gap-2">
      {t('escala').map((r, i) => (
        <button key={i} onClick={() => onEnviar({ valor: i + 1 })}
          className={`flex flex-col items-center gap-1 rounded-2xl border-2 py-4 active:scale-[.97] transition ${inicial === i + 1 ? 'border-teal-600 bg-teal-50' : 'border-slate-200 bg-white'}`}>
          <span className="text-3xl font-black text-slate-900">{i + 1}</span>
          <span className="text-[11px] leading-tight text-slate-500 text-center">{r}</span>
        </button>
      ))}
    </div>
  )
}

function FormAbierta({ inicial, onEnviar }) {
  const t = useT()
  const [texto, setTexto] = useState(inicial || '')
  const limpio = limpiarAbierta(texto)
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (limpio) onEnviar({ texto: limpio }) }}>
      <textarea value={texto} maxLength={LIMITES.abierta} rows={4} placeholder={t('escribeRespuesta')} aria-label={t('tuRespuesta')}
        onChange={(e) => setTexto(e.target.value)}
        className="rounded-xl border-2 border-slate-200 px-4 py-3 text-lg focus:border-teal-600 outline-none resize-none" />
      <p className="text-right text-xs text-slate-400 tabular-nums">{texto.length}/{LIMITES.abierta}</p>
      <Button disabled={!limpio} className="text-lg">{t('enviar')}</Button>
    </form>
  )
}

/* ── Cierres ─────────────────────────────────────────────────────────────── */

/* SEMÁFORO: los tres niveles con su lámpara. Un toque y se envía, como la
   encuesta; mientras siga abierta se puede cambiar. */
function FormSemaforo({ inicial, onEnviar }) {
  const t = useT()
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm text-slate-500">{t('semaforoCelular')}</p>
      {NIVELES.map((n, i) => (
        <button key={n.id} onClick={() => onEnviar({ opcion: i })}
          className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left active:scale-[.98] transition ${inicial === i ? 'border-teal-600 bg-teal-50' : 'border-slate-200 bg-white'}`}>
          <span aria-hidden="true" className="w-10 h-10 shrink-0 rounded-full" style={{ background: LAMPARA[n.id] }} />
          <span className="text-lg font-semibold text-slate-900">{n.texto}</span>
        </button>
      ))}
    </div>
  )
}

/* LA DUDA Y EL MURO: el molde del docente, con un campo por hueco. Un molde a
   medio hacer se completa; una pregunta en blanco, no. Arriba se ve la frase
   como va quedando. Sin huecos, el molde es una pregunta y se responde libre. */
function FormMolde({ tipo, molde, inicial, onEnviar }) {
  const t = useT()
  const trozos = partirEnHuecos(molde)
  const n = trozos.filter(x => x.tipo === 'hueco').length
  const [huecos, setHuecos] = useState(() => {
    const previos = Array.isArray(inicial) ? inicial : Object.values(inicial || {})
    return Array.from({ length: Math.max(1, n) }, (_, i) => previos[i] || '')
  })
  const max = largoHueco(molde)
  const listo = moldeCompleto(molde, huecos)
  const enviar = (e) => {
    e.preventDefault()
    if (listo) onEnviar({ huecos: huecos.map(h => h.replace(/\s+/g, ' ').trim()), texto: textoDeMolde(tipo, molde, huecos) })
  }
  const cambiar = (i, v) => setHuecos(hs => hs.map((x, j) => (j === i ? v : x)))
  const campo = 'rounded-xl border-2 border-slate-200 px-4 py-3 text-lg focus:border-teal-600 outline-none'
  let k = 0
  return (
    <form className="flex flex-col gap-2" onSubmit={enviar}>
      {n > 0 && (
        <p className="rounded-2xl bg-white border border-slate-200 p-4 text-lg font-semibold text-slate-900 leading-relaxed">
          {trozos.map((x, i) => {
            if (x.tipo === 'texto') return <span key={i}>{x.valor}</span>
            const lleno = huecos[k++]?.trim()
            return lleno
              ? <span key={i} className="text-teal-800 underline decoration-2 underline-offset-4">{lleno}</span>
              : <span key={i} className="text-slate-400">{x.valor}</span>
          })}
        </p>
      )}
      {n > 0 ? huecos.map((h, i) => (
        <input key={i} value={h} maxLength={max} aria-label={n > 1 ? t('huecoN', i + 1) : t('completaFrase')}
          placeholder={n > 1 ? t('huecoN', i + 1) : t('completaFrase')}
          onChange={(e) => cambiar(i, e.target.value)} className={campo} />
      )) : (
        <textarea value={huecos[0]} maxLength={LIMITES.abierta} rows={4} placeholder={t('escribeRespuesta')} aria-label={t('tuRespuesta')}
          onChange={(e) => cambiar(0, e.target.value)} className={`${campo} resize-none`} />
      )}
      <Button disabled={!listo} className="text-lg mt-1">{t('enviar')}</Button>
    </form>
  )
}

/* ANTES / AHORA: los lados que escribió el docente se ven fijos (el de antes,
   tachado); los que dejó en blanco los escribe cada uno. El «porque» siempre:
   es la mitad que vale. */
function FormAntesAhora({ actividad, inicial, onEnviar }) {
  const t = useT()
  const [antes, setAntes] = useState(inicial?.antes || '')
  const [ahora, setAhora] = useState(inicial?.ahora || '')
  const [porque, setPorque] = useState(inicial?.texto || '')
  const listo = (actividad.antes || limpiarLado(antes)) && (actividad.ahora || limpiarLado(ahora)) && limpiarAbierta(porque)
  const enviar = (e) => {
    e.preventDefault()
    if (!listo) return
    onEnviar({
      ...(actividad.antes ? {} : { antes: limpiarLado(antes) }),
      ...(actividad.ahora ? {} : { ahora: limpiarLado(ahora) }),
      texto: limpiarAbierta(porque),
    })
  }
  const campo = 'w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-lg focus:border-teal-600 outline-none'
  const rotulo = 'text-xs font-bold uppercase tracking-wider text-slate-500'
  return (
    <form className="flex flex-col gap-3" onSubmit={enviar}>
      <label className="flex flex-col gap-1">
        <span className={rotulo}>{t('antesPensaba')}</span>
        {actividad.antes
          ? <span className="text-lg font-semibold text-slate-600 line-through decoration-2">{actividad.antes}</span>
          : <input value={antes} maxLength={LIMITES.lado} onChange={(e) => setAntes(e.target.value)} className={campo} />}
      </label>
      <label className="flex flex-col gap-1">
        <span className={rotulo}>{t('ahoraPienso')}</span>
        {actividad.ahora
          ? <span className="text-lg font-semibold text-slate-900">{actividad.ahora}</span>
          : <input value={ahora} maxLength={LIMITES.lado} onChange={(e) => setAhora(e.target.value)} className={campo} />}
      </label>
      <label className="flex flex-col gap-1">
        <span className={rotulo}>{t('porque')}</span>
        <textarea value={porque} maxLength={LIMITES.abierta} rows={3} onChange={(e) => setPorque(e.target.value)} className={`${campo} resize-none`} />
      </label>
      <Button disabled={!listo} className="text-lg">{t('enviar')}</Button>
    </form>
  )
}

/* APUESTA: lo que ve el celular depende de la fase que mueve el docente.
     ESCRIBIR  las consignas, para escribirlas en el cuaderno
     APOSTAR   cuántas crees tener bien, SIN las consignas a la vista
     COMPARAR  cuántas tuviste, y la distancia con lo que apostaste
   La apuesta no se cambia después de apostar: si se pudiera, dejaría de ser
   una apuesta. Lo que se ve al final es solo de cada uno. */
function ResponderApuesta({ store, base, pid, actividad, abierta, fase }) {
  const t = useT()
  const ruta = `${base}/respuestas/${actividad.id}/${pid}`
  const mia = useValue(store, ruta)
  const [cambiando, setCambiando] = useState(false)
  if (mia === undefined) return <Center>{t('cargando')}</Center>
  const consignas = consignasDe(actividad)
  const n = consignas.length
  const apuesta = Number.isInteger(mia?.apuesta) ? mia.apuesta : null
  const tuve = Number.isInteger(mia?.tuve) ? mia.tuve : null
  const guardar = async (v) => { await store.set(ruta, { ...v, at: store.stamp() }); setCambiando(false) }
  const cerradas = <p className="rounded-2xl bg-slate-100 p-4 text-center font-semibold text-slate-600">{t('respuestasCerradas')}</p>

  let cuerpo
  if (fase === 'escribir') {
    cuerpo = (
      <>
        <p className="text-slate-600">{t('escribelasAhora')}</p>
        <Consignas consignas={consignas} chico />
      </>
    )
  } else if (fase === 'apostar') {
    cuerpo = !abierta ? cerradas : (
      <>
        <p className="text-xl font-bold text-slate-900">{t('cuantasCrees', n)}</p>
        <Numeros n={n} elegido={apuesta} onElegir={(k) => guardar({ apuesta: k })} />
        {apuesta != null && (
          <div className="rounded-2xl bg-teal-700 text-white p-4 text-center">
            <p className="text-2xl font-black">{t('apostaste', apuesta)}</p>
            <p className="mt-1 text-teal-50">{t('esperaCorregir')}</p>
          </div>
        )}
      </>
    )
  } else if (apuesta == null) {
    cuerpo = <p className="rounded-2xl bg-slate-100 p-4 text-center font-semibold text-slate-600">{t('noApostaste')}</p>
  } else if (tuve == null || cambiando) {
    cuerpo = !abierta ? cerradas : (
      <>
        <Consignas consignas={consignas} chico />
        <p className="text-xl font-bold text-slate-900">{t('cuantasTuviste', n)}</p>
        <Numeros n={n} elegido={tuve} onElegir={(k) => guardar({ apuesta, tuve: k })} />
      </>
    )
  } else {
    const lectura = miCalibracion(apuesta, tuve)
    cuerpo = (
      <>
        <div className={`rounded-2xl p-5 text-center ${lectura === 'deMas' ? 'bg-amber-50 border-2 border-amber-200' : 'bg-teal-700 text-white'}`}>
          <p className={`text-2xl font-black ${lectura === 'deMas' ? 'text-amber-900' : ''}`}>{t('apostaste', apuesta)} · {t('tuviste', tuve)}</p>
          <p className={`mt-2 text-lg font-semibold ${lectura === 'deMas' ? 'text-amber-900' : 'text-teal-50'}`}>
            {lectura === 'exacto' ? t('mi_exacto') : t(`mi_${lectura}`, Math.abs(apuesta - tuve))}
          </p>
        </div>
        {abierta && <Button variant="ghost" onClick={() => setCambiando(true)}>{t('cambiarRespuesta')}</Button>}
      </>
    )
  }

  return (
    <div className="flex-1 flex flex-col gap-4">
      <h1 className="text-2xl font-black text-slate-900 leading-snug">{tituloDe(actividad, t)}</h1>
      {cuerpo}
    </div>
  )
}

/* CRUCIGRAMA: cada uno resuelve el suyo. Arriba, su cuadrícula, que se llena
   con lo que acierta: las letras de una palabra ayudan con la que la cruza, que
   es la gracia del crucigrama. Lo que destapó la pantalla se ve en gris y no
   cuenta como suyo. Se comprueba al completar las letras (o con Enter), aquí
   mismo, y solo se guardan las acertadas. */
function ResponderCrucigrama({ store, base, pid, actividad, abierta }) {
  const t = useT()
  const ruta = `${base}/respuestas/${actividad.id}/${pid}`
  const mia = useValue(store, ruta)
  const destapadas = useValue(store, `${base}/moderacion/${actividad.id}/destapadas`)
  const [textos, setTextos] = useState({})
  const [fallos, setFallos] = useState({})
  if (mia === undefined) return <Center>{t('cargando')}</Center>
  const palabras = palabrasCrucigrama(actividad)
  const bien = mia?.bien || {}
  const cuantas = palabras.filter(p => bien[claveDe(p)] === true).length
  const termino = palabras.length > 0 && cuantas === palabras.length

  const comprobar = async (p, valor) => {
    const k = claveDe(p)
    if (acierta(valor, p)) {
      setFallos(f => ({ ...f, [k]: false }))
      /* Solo esa palabra, no el mapa entero: dos aciertos seguidos no se pisan. */
      await store.update(ruta, { [`bien/${k}`]: true, at: store.stamp() })
    } else {
      setFallos(f => ({ ...f, [k]: true }))
    }
  }
  const escribir = (p, valor) => {
    const k = claveDe(p)
    setTextos(x => ({ ...x, [k]: valor }))
    setFallos(f => ({ ...f, [k]: false }))
    if (soloLetras(valor).length === p.palabra.length) comprobar(p, valor)
  }

  const propias = new Set(palabras.filter(p => bien[claveDe(p)] === true).flatMap(casillasDe))
  const dePantalla = new Set(palabras.filter(p => destapadas?.[claveDe(p)] === true && bien[claveDe(p)] !== true).flatMap(casillasDe))
  const lado = `max(14px, min(calc((100vw - 2.5rem) / ${actividad.ancho}), 2rem))`

  const fila = (p) => {
    const k = claveDe(p)
    const mio = bien[k] === true
    const destapada = !mio && destapadas?.[k] === true
    return (
      <li key={k} className="rounded-2xl bg-white border border-slate-200 p-3 flex flex-col gap-2">
        <p className="text-slate-800">
          <b className="tabular-nums">{p.numero}. </b>
          {p.pista || <span className="text-slate-500">{t('pistaEnVozAlta')}</span>}
          <span className="ml-1.5 text-slate-500 tabular-nums">({p.palabra.length})</span>
        </p>
        {mio ? (
          <p className="rounded-xl bg-teal-700 text-white px-3 py-2 text-lg font-black tracking-wider"><Icon name="check" className="mr-1.5" strokeWidth={3} />{p.palabra}</p>
        ) : destapada ? (
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-slate-600">
            <b className="tracking-wider">{p.palabra}</b> · <span className="text-sm">{t('destapadaEnPantalla')}</span>
          </p>
        ) : (
          <>
            <input value={textos[k] || ''} disabled={!abierta} maxLength={p.palabra.length + 6} autoCapitalize="characters" autoComplete="off" spellCheck={false}
              aria-label={t('escribeLaPalabra', p.numero)} placeholder={'_ '.repeat(p.palabra.length).trim()}
              onChange={(e) => escribir(p, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') comprobar(p, textos[k] || '') }}
              className={`rounded-xl border-2 px-3 py-2 text-lg font-bold uppercase tracking-wider outline-none disabled:bg-slate-100 ${fallos[k] ? 'border-amber-200 bg-amber-50' : 'border-slate-200 focus:border-teal-600'}`} />
            {fallos[k] && <p className="text-sm font-semibold text-amber-900">{t('noEsEsa')}</p>}
          </>
        )}
      </li>
    )
  }

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <h1 className="flex-1 text-2xl font-black text-slate-900 leading-snug">{tituloDe(actividad, t)}</h1>
        <span className="text-sm font-bold text-teal-800 tabular-nums">{t('llevas', cuantas, palabras.length)}</span>
      </div>
      {termino && (
        <div className="rounded-2xl bg-teal-700 text-white p-4 text-center">
          <p className="text-2xl font-black">{t('terminaste')}</p>
          <p className="mt-1 text-teal-50">{t('ayudaAAlguien')}</p>
        </div>
      )}
      <div className="overflow-x-auto self-center">
        <Grilla ancho={actividad.ancho} alto={actividad.alto} palabras={palabras} llenas={propias} apagadas={dePantalla} lado={lado} />
      </div>
      {!abierta && <p className="rounded-2xl bg-slate-100 p-4 text-center font-semibold text-slate-600">{t('respuestasCerradas')}</p>}
      {[['horizontales', 'h'], ['verticales', 'v']].map(([titulo, dir]) => {
        const items = palabras.filter(p => p.dir === dir)
        return items.length > 0 && (
          <section key={dir} className="flex flex-col gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">{t(titulo)}</h2>
            <ol className="flex flex-col gap-2">{items.map(fila)}</ol>
          </section>
        )
      })}
    </div>
  )
}

/* SOPA DE LETRAS: cada uno la resuelve en su celular, como en el Belt: toca
   la primera letra y la última. Tocar la misma casilla otra vez cancela. Lo
   que marcó la pantalla se ve con un contorno gris y no cuenta como suyo.
   Las casillas no bajan de 26 px —por debajo no se aciertan con el dedo—: una
   sopa grande se desliza de lado antes que volverse imposible de tocar. */
function ResponderSopa({ store, base, pid, actividad, abierta }) {
  const t = useT()
  const ruta = `${base}/respuestas/${actividad.id}/${pid}`
  const mia = useValue(store, ruta)
  const destapadas = useValue(store, `${base}/moderacion/${actividad.id}/destapadas`)
  const [ancla, setAncla] = useState(null)
  const [aviso, setAviso] = useState(null) // null | 'ultima' | 'nohay'
  if (mia === undefined) return <Center>{t('cargando')}</Center>
  const filas = filasDe(actividad)
  const palabras = palabrasSopa(actividad)
  const bien = mia?.bien || {}
  const propias = new Set(palabras.map(claveSopa).filter(k => bien[k] === true))
  const dePantalla = new Set(palabras.map(claveSopa).filter(k => destapadas?.[k] === true && bien[k] !== true))
  const termino = palabras.length > 0 && propias.size === palabras.length

  const tocar = async (fila, col) => {
    if (!abierta) return
    if (!ancla) { setAncla({ fila, col }); setAviso('ultima'); return }
    if (ancla.fila === fila && ancla.col === col) { setAncla(null); setAviso(null); return }
    const p = palabraEntre(palabras, ancla, { fila, col })
    setAncla(null)
    if (!p) { setAviso('nohay'); return }
    setAviso(null)
    if (bien[claveSopa(p)] !== true) await store.update(ruta, { [`bien/${claveSopa(p)}`]: true, at: store.stamp() })
  }

  const lado = `max(26px, min(calc((100vw - 2rem) / ${filas.length}), 2.5rem))`
  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <h1 className="flex-1 text-2xl font-black text-slate-900 leading-snug">{tituloDe(actividad, t)}</h1>
        <span className="text-sm font-bold text-teal-800 tabular-nums">{t('llevas', propias.size, palabras.length)}</span>
      </div>
      {termino && (
        <div className="rounded-2xl bg-teal-700 text-white p-4 text-center">
          <p className="text-2xl font-black">{t('terminaste')}</p>
          <p className="mt-1 text-teal-50">{t('ayudaSopa')}</p>
        </div>
      )}
      {!abierta
        ? <p className="rounded-2xl bg-slate-100 p-4 text-center font-semibold text-slate-600">{t('respuestasCerradas')}</p>
        : !termino && (
          <p role="status" className={`text-sm font-semibold ${aviso === 'nohay' ? 'text-amber-900' : 'text-slate-600'}`}>
            {aviso === 'nohay' ? t('ahiNoHay') : aviso === 'ultima' ? t('ahoraUltima') : t('tocaPrimera')}
          </p>
        )}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="w-max mx-auto">
          <SopaGrilla filas={filas} palabras={palabras} llenas={propias} apagadas={dePantalla} ancla={ancla} lado={lado} onTocar={tocar} />
        </div>
      </div>
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('palabrasABuscar')}</h2>
        <ul className="flex flex-wrap gap-2">
          {palabras.map(p => {
            const k = claveSopa(p)
            return (
              <li key={k} className={`rounded-xl border px-3 py-1.5 font-semibold ${propias.has(k) ? 'border-teal-600 bg-teal-50 text-teal-800 line-through decoration-2' : 'border-slate-200 bg-white text-slate-800'}`}>
                {propias.has(k) && <Icon name="check" className="mr-1" strokeWidth={3} />}{p.original}
                {dePantalla.has(k) && <span className="ml-1.5 text-xs font-normal text-slate-500">· {t('marcadaEnPantalla')}</span>}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

/* Los números de 0 a n, grandes: se tocan con el pulgar. */
function Numeros({ n, elegido, onElegir }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {Array.from({ length: n + 1 }, (_, k) => (
        <button key={k} onClick={() => onElegir(k)} aria-pressed={elegido === k}
          className={`rounded-2xl border-2 py-4 text-3xl font-black tabular-nums active:scale-[.97] transition ${elegido === k ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-900'}`}>
          {k}
        </button>
      ))}
    </div>
  )
}

/* ORDENAR: se tocan los elementos del primero al último y van subiendo a «Tu
   orden». Tocar uno de arriba lo devuelve. Nada de arrastrar: en un celular
   chico, arrastrar es lo que más falla. */
function FormRanking({ actividad, inicial, onEnviar }) {
  const t = useT()
  const alts = actividad.alternativas || []
  const [orden, setOrden] = useState(() => (Array.isArray(inicial) && inicial.length === alts.length ? inicial : []))
  const quedan = alts.map((_, i) => i).filter(i => !orden.includes(i))
  const fila = 'flex items-center gap-3 rounded-2xl border-2 p-3 text-left active:scale-[.98] transition'
  return (
    <div className="flex flex-col gap-3">
      {orden.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('tuOrden')} · <span className="normal-case font-normal">{t('tocaParaQuitar')}</span></p>
          {orden.map((i, p) => (
            <button key={i} onClick={() => setOrden(o => o.filter(x => x !== i))} className={`${fila} border-teal-600 bg-teal-50`}>
              <span className="grid place-items-center w-10 h-10 shrink-0 rounded-xl bg-teal-700 text-white text-xl font-black">{p + 1}</span>
              <span className="text-lg font-semibold text-slate-900">{alts[i]}</span>
            </button>
          ))}
        </section>
      )}
      {quedan.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-sm text-slate-500">{orden.length ? t('faltanPorOrdenar', quedan.length) : t('tocaEnOrden')}</p>
          {quedan.map(i => (
            <button key={i} onClick={() => setOrden(o => [...o, i])} className={`${fila} border-slate-200 bg-white`}>
              <span className="grid place-items-center w-10 h-10 shrink-0 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 text-xl font-black">?</span>
              <span className="text-lg font-semibold text-slate-900">{alts[i]}</span>
            </button>
          ))}
        </section>
      )}
      <Button disabled={quedan.length > 0} onClick={() => onEnviar({ orden })} className="text-lg">{t('enviar')}</Button>
    </div>
  )
}

/* PREGUNTAS DEL CURSO: aquí no hay «una respuesta». Cada estudiante manda
   hasta 3 preguntas y vota las de otros que el docente ya aprobó.

   Todo lo suyo (preguntas y votos) vive en SU nodo y se reescribe entero en
   cada cambio: las reglas exigen la hora del servidor en cada escritura, y
   así ningún estudiante toca lo de otro. Cada pregunta guarda su hora la
   primera vez; las que ya tenían la conservan. */
function PreguntarYVotar({ store, base, pid, actividad, abierta }) {
  const t = useT()
  const aid = actividad.id
  const respuestas = useValue(store, `${base}/respuestas/${aid}`)
  const moderacion = useValue(store, `${base}/moderacion/${aid}`)
  const [texto, setTexto] = useState('')
  if (respuestas === undefined || moderacion === undefined) return <Center>{t('cargando')}</Center>

  const mio = respuestas?.[pid] || {}
  const guardar = (cambios) => store.set(`${base}/respuestas/${aid}/${pid}`, {
    preguntas: mio.preguntas || {}, votos: mio.votos || {}, ...cambios, at: store.stamp(),
  })
  const { pendientes, aprobadas, descartadas } = preguntasDelCurso(respuestas, moderacion, pid)
  const mias = [...pendientes, ...aprobadas, ...descartadas].filter(q => q.mia).sort((a, b) => a.at - b.at)
  const paraVotar = aprobadas.filter(q => !q.mia && !q.respondida)
  const cuantasMias = Object.keys(mio.preguntas || {}).length
  const limpio = limpiarAbierta(texto)

  const enviar = async (e) => {
    e.preventDefault()
    if (!limpio || cuantasMias >= LIMITES.preguntasPorPersona) return
    await guardar({ preguntas: { ...(mio.preguntas || {}), [idAlAzar()]: { texto: limpio, at: store.stamp() } } })
    setTexto('')
  }
  const borrar = (qid) => {
    const { [qid]: _, ...resto } = mio.preguntas || {}
    guardar({ preguntas: resto })
  }
  const votar = (qid, si) => {
    const { [qid]: _, ...resto } = mio.votos || {}
    guardar({ votos: si ? { ...resto, [qid]: true } : resto })
  }
  const estado = (q) => (q.decision === null ? t('estadoRevisando')
    : q.decision === false ? t('estadoNoSeMostro')
    : q.respondida ? <><Icon name="check" className="mr-1" />{t('respondida')}</>
    : `${t('estadoEnPantalla')} · ▲ ${q.votos}`)

  return (
    <div className="flex-1 flex flex-col gap-4">
      <h1 className="text-2xl font-black text-slate-900 leading-snug">{actividad.pregunta}</h1>

      {!abierta ? (
        <p className="rounded-2xl bg-slate-100 p-4 text-center font-semibold text-slate-600">{t('respuestasCerradas')}</p>
      ) : cuantasMias >= LIMITES.preguntasPorPersona ? (
        <p className="rounded-2xl bg-slate-100 p-4 text-center font-semibold text-slate-600">{t('maxPreguntas', LIMITES.preguntasPorPersona)}</p>
      ) : (
        <form className="flex flex-col gap-2" onSubmit={enviar}>
          <textarea value={texto} maxLength={LIMITES.abierta} rows={3} placeholder={t('escribeTuPregunta')} aria-label={t('escribeTuPregunta')}
            onChange={(e) => setTexto(e.target.value)}
            className="rounded-xl border-2 border-slate-200 px-4 py-3 text-lg focus:border-teal-600 outline-none resize-none" />
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm text-slate-500">{t('preguntaAnonima')}</p>
            <p className="text-xs text-slate-400 tabular-nums">{texto.length}/{LIMITES.abierta}</p>
          </div>
          <Button disabled={!limpio} className="text-lg">{t('enviarPregunta')}</Button>
        </form>
      )}

      {mias.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('tusPreguntas')}</h2>
          {mias.map(q => (
            <div key={q.qid} className="rounded-2xl bg-white border border-slate-200 p-3">
              {q.corregida
                ? <Cambios antes={q.original} despues={q.texto} className="font-semibold text-slate-900" />
                : <p className="font-semibold text-slate-900 break-words">{q.texto}</p>}
              {q.corregida && <p className="mt-1 text-sm font-bold text-teal-800"><Icon name="pencil" className="mr-1" />{t('profeCorrigio')}</p>}
              <div className="mt-1.5 flex items-center gap-2">
                <span className={`flex-1 text-sm font-bold ${q.decision === true ? 'text-teal-800' : 'text-slate-500'}`}>{estado(q)}</span>
                {abierta && q.decision === null && (
                  <button onClick={() => borrar(q.qid)} className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-bold text-slate-700">{t('borrarPregunta')}</button>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('votaLasQue')}</h2>
        {paraVotar.length === 0 ? <p className="text-sm text-slate-500">{t('todaviaNadaQueVotar')}</p> : paraVotar.map(q => (
          <button key={q.qid} disabled={!abierta} onClick={() => votar(q.qid, !q.votada)} aria-pressed={q.votada}
            aria-label={`${q.votada ? t('quitarVoto') : t('votar')}: ${q.texto}`}
            className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left active:scale-[.98] transition disabled:opacity-60 ${q.votada ? 'border-teal-600 bg-teal-50' : 'border-slate-200 bg-white'}`}>
            <span className={`flex flex-col items-center justify-center w-12 h-12 shrink-0 rounded-xl font-black tabular-nums leading-none ${q.votada ? 'bg-teal-700 text-white' : 'border-2 border-slate-300 text-slate-600'}`}>
              <span aria-hidden="true" className="text-sm">▲</span>{q.votos}
            </span>
            <span className="text-lg font-semibold text-slate-900 break-words min-w-0">{q.texto}</span>
          </button>
        ))}
      </section>
    </div>
  )
}

/* LA CLASE PARA LLEVAR: cuando el docente comparte la clase, aparece aquí
   arriba con el botón para bajarla en PDF, sin escanear nada. El resumen se
   lee una sola vez, al aparecer el aviso; el PDF se arma en el celular. */
function AvisoClase({ store, id }) {
  const t = useT()
  const [resumen, setResumen] = useState(null)
  useEffect(() => {
    store.get(rutaResumen(id)).then(r => r && setResumen(normalizar(r)), () => {})
  }, [store, id])
  return (
    <div className="mb-4 rounded-2xl border-2 border-teal-600 bg-teal-50 p-4 flex flex-col gap-2">
      <p className="font-black text-teal-900">{t('profeCompartio')}</p>
      <p className="text-sm text-teal-900">{t('profeCompartioAyuda')}</p>
      {resumen ? <BotonPdf resumen={resumen} /> : <Button disabled>{t('cargando')}</Button>}
      <a href={urlResumen(id)} target="_blank" rel="noopener" className="text-sm font-semibold text-teal-800 underline underline-offset-2 self-center">{t('verClase')}</a>
    </div>
  )
}

/* ── La abierta como tablero (tablero.js) ────────────────────────────────── */

/* Cada uno publica una tarjeta —texto, foto o los dos, en la
   columna que elija— y, si la actividad lo deja, ve las de los demás y las
   comenta. Lo suyo lo edita o lo borra mientras las respuestas estén abiertas.
   Con moderación, lo que el docente ya puso en pantalla no se edita: se
   cambiaría delante de todos sin que nadie lo revisara. */
function ResponderTablero({ store, pin, base, pid, actividad, abierta }) {
  const t = useT()
  const aid = actividad.id
  const acciones = useMemo(() => accionesDeSala(store, pin), [store, pin])
  const veMuro = celularVeElMuro(actividad)
  const mia = useValue(store, `${base}/respuestas/${aid}/${pid}`)
  const decision = useValue(store, `${base}/moderacion/${aid}/abiertas/${pid}`)
  const correccion = useValue(store, `${base}/moderacion/${aid}/correcciones/${pid}`)
  const respuestas = useValue(store, veMuro ? `${base}/respuestas/${aid}` : null)
  const moderacion = useValue(store, veMuro ? `${base}/moderacion/${aid}` : null)
  /* Las fotos chicas: todas si se ve el muro; si no, solo la propia. */
  const minis = useValue(store, actividad.foto && veMuro ? `${base}/minis/${aid}` : null)
  const miMini = useValue(store, actividad.foto && !veMuro ? `${base}/minis/${aid}/${pid}` : null)
  const comentarios = useValue(store, actividad.comentarios ? `${base}/comentarios/${aid}` : null)
  const reacciones = useValue(store, actividad.reacciones ? `${base}/reacciones/${aid}` : null)
  const participantes = useValue(store, actividad.nombres && veMuro ? `${base}/participantes` : null)
  const [editando, setEditando] = useState(false)
  if (mia === undefined) return <Center>{t('cargando')}</Center>

  const fotoMia = veMuro ? minis?.[pid] : miMini
  const alInstante = actividad.sinModerar === true
  const original = limpiarAbierta(mia?.texto)
  const corregida = correccionVigente(correccion, original)
  const enPantalla = decision === true || (alInstante && decision !== false && !esGroseria(original))
  const puedeEditar = abierta && (alInstante || decision !== true)
  const estadoMio = decision === false ? t('profeLaQuito') : enPantalla ? null : t('enRevision')

  const publicar = async ({ texto, columna, foto }) => {
    const ruta = (n) => `${base}/${n}/${aid}/${pid}`
    /* La foto primero: así la tarjeta no llega al proyector sin ella. */
    if (foto && foto !== 'igual') await Promise.all([store.set(ruta('fotos'), foto.grande), store.set(ruta('minis'), foto.chica)])
    if (!foto) await Promise.all([store.remove(ruta('fotos')), store.remove(ruta('minis'))])
    await store.set(ruta('respuestas'), {
      ...(texto ? { texto } : {}),
      ...(foto ? { foto: true } : {}),
      ...(Number.isInteger(columna) ? { columna } : {}),
      desde: typeof mia?.desde === 'number' ? mia.desde : store.stamp(),
      at: store.stamp(),
    })
    setEditando(false)
  }
  const borrar = async () => {
    if (!confirm(t('borrarPublicacionConfirma'))) return
    await acciones.borrarPublicacion(aid, pid)
    setEditando(false)
  }
  const editar = () => { setEditando(true); scrollTo({ top: 0, behavior: 'smooth' }) }

  const columnas = columnasDe(actividad)
  const suColumna = (r) => { const i = columnaDe(r, columnas.length); return columnas.length ? { nombre: columnas[i], i } : null }
  const yo = mia && {
    pid, texto: corregida || original, original, corregida: Boolean(corregida), foto: mia.foto === true, columna: mia.columna,
    nombre: participantes?.[pid]?.nombre || '', at: typeof mia.desde === 'number' ? mia.desde : 0,
  }
  /* EL TABLERO EN EL CELULAR (14-oct-2026): después de publicar se pasa
     directo al tablero; la tarjeta propia ya no queda fija arriba (ocupaba
     media pantalla y repetía lo mismo). Se busca en el tablero, donde trae
     «Editar» y «Borrar». Si todavía espera la revisión del docente o la
     quitó, igual aparece ahí, con su estado: si no, se perdería. */
  const aprobadas = veMuro && respuestas !== undefined && moderacion !== undefined
    ? abiertas(respuestas, moderacion?.abiertas, participantes || {}, moderacion?.correcciones, alInstante).aprobadas
    : []
  const publicaciones = yo && !aprobadas.some(r => r.pid === pid)
    ? [...aprobadas, yo].sort((a, b) => a.at - b.at)
    : aprobadas
  const porPublicacion = comentariosPorPublicacion(comentarios, participantes || {}, { yo: pid })
  const quedanComentarios = comentariosDe(comentarios, pid) < LIMITES_TABLERO.comentariosPorPersona
  const formulario = abierta
    ? <FormPublicacion actividad={actividad} inicial={mia} fotoInicial={mia?.foto ? fotoMia : null}
        onPublicar={publicar} onCancelar={mia ? () => setEditando(false) : null} />
    : <p className="rounded-2xl bg-slate-100 p-4 text-center font-semibold text-slate-600">{t('respuestasCerradas')}</p>

  /* Sin tablero a la vista (sin comentarios, sin reacciones y con revisión),
     no hay dónde buscarla: la propia se muestra sola, como antes. */
  if (!veMuro) {
    return (
      <div className="flex-1 flex flex-col gap-4">
        <h1 className="text-2xl font-black text-slate-900 leading-snug">{tituloDe(actividad, t)}</h1>
        {actividad.nombres && <p className="-mt-2 text-sm text-slate-500">{t('tuNombreSeVe')}</p>}
        {(!mia || editando) ? formulario : (
          <section className="flex flex-col gap-2">
            <div className="rounded-2xl bg-teal-700 text-white px-4 py-3 text-center">
              <p className="text-2xl font-black">{t('listoGrande')}</p>
              <p className="text-teal-50">{estadoMio || t('enElMuro')}</p>
            </div>
            <TarjetaPublicacion r={yo} foto={fotoMia} chico verComentarios={false} columna={suColumna(yo)} />
            {corregida && <p className="text-sm font-bold text-teal-800"><Icon name="pencil" className="mr-1" />{t('profeCorrigio')}</p>}
            {abierta && (
              <div className="grid grid-cols-2 gap-2">
                {puedeEditar ? <Button variant="ghost" onClick={editar}>{t('editar')}</Button> : <span />}
                <Button variant="ghost" onClick={borrar}>{t('borrar')}</Button>
              </div>
            )}
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col gap-4">
      <h1 className="text-2xl font-black text-slate-900 leading-snug">{tituloDe(actividad, t)}</h1>
      {actividad.nombres && (!mia || editando) && <p className="-mt-2 text-sm text-slate-500">{t('tuNombreSeVe')}</p>}
      {(!mia || editando) && formulario}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('elMuro')} · {publicaciones.length}</h2>
        {publicaciones.length === 0 && <p className="text-sm text-slate-500">{t('muroVacioCelular')}</p>}
        {publicaciones.map(r => {
          const propia = r.pid === pid
          return (
            <PublicacionEnCelular key={r.pid} r={r} foto={minis?.[r.pid]} actividad={actividad} columna={suColumna(r)}
              comentarios={porPublicacion[r.pid] || []} puedeComentar={abierta && actividad.comentarios === true}
              quedan={quedanComentarios}
              reacciones={actividad.reacciones ? reaccionesDe(reacciones?.[r.pid], r.pid, pid) : null}
              onReaccionar={actividad.reacciones && abierta && !propia ? (tipo, si) => acciones.reaccionar(aid, r.pid, pid, tipo, si) : null}
              onComentar={(cid, texto) => acciones.comentar(aid, cid || idAlAzar(), { de: pid, en: r.pid, texto })}
              propia={propia && {
                estado: estadoMio,
                corregida: Boolean(corregida),
                editando,
                onEditar: puedeEditar ? editar : null,
                onBorrar: abierta ? borrar : null,
              }} />
          )
        })}
      </section>
    </div>
  )
}

/* Una publicación en el muro del celular, con sus reacciones y sus
   comentarios: los comentarios propios se editan o se borran ahí mismo. La
   tarjeta propia se marca («Tu publicación») y trae Editar y Borrar. */
function PublicacionEnCelular({ r, foto, actividad, columna, comentarios, puedeComentar, quedan, onComentar, reacciones, onReaccionar, propia }) {
  const t = useT()
  const [texto, setTexto] = useState('')
  const [editando, setEditando] = useState(null) // cid del comentario propio que se edita
  const [enviando, setEnviando] = useState(false)
  const limpio = limpiarComentario(texto)
  const enviar = async (e) => {
    e.preventDefault()
    if (!limpio || enviando || (!editando && !quedan)) return
    setEnviando(true)
    try { await onComentar(editando, limpio); setTexto(''); setEditando(null) } finally { setEnviando(false) }
  }
  const encabezado = propia && (
    <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border-b border-teal-100">
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-black uppercase tracking-wider text-teal-800">{t('tuPublicacion')}</span>
        {propia.estado && <span className="block text-xs font-semibold text-amber-900">{propia.estado}</span>}
        {propia.corregida && <span className="block text-xs font-semibold text-teal-800"><Icon name="pencil" className="mr-1" />{t('profeCorrigio')}</span>}
      </span>
      {propia.onEditar && !propia.editando && (
        <button type="button" onClick={propia.onEditar} className="rounded-lg border border-teal-600 bg-white px-3 py-1 text-sm font-bold text-teal-800">{t('editar')}</button>
      )}
      {propia.onBorrar && (
        <button type="button" onClick={propia.onBorrar} className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-bold text-slate-700">{t('borrar')}</button>
      )}
    </div>
  )
  return (
    <TarjetaPublicacion r={r} foto={foto} chico nombres={actividad.nombres === true} comentarios={comentarios} columna={columna}
      encabezado={encabezado} reacciones={reacciones} onReaccionar={onReaccionar}
      pieComentario={(c) => c.mio && puedeComentar && (
        <span className="ml-1.5 inline-flex gap-2 align-middle">
          <button onClick={() => { setEditando(c.cid); setTexto(c.texto) }} className="text-xs font-bold text-teal-800 underline">{t('editar')}</button>
          <button onClick={() => onComentar(c.cid, '')} className="text-xs font-bold text-slate-500 underline">{t('borrar')}</button>
        </span>
      )}>
      {puedeComentar && (editando || quedan) && (
        <form onSubmit={enviar} className="flex gap-2 px-3 pb-3 pt-1">
          <input value={texto} maxLength={LIMITES_TABLERO.comentario} onChange={(e) => setTexto(e.target.value)}
            placeholder={editando ? t('editaTuComentario') : t('escribeComentario')} aria-label={t('escribeComentario')}
            className="flex-1 min-w-0 rounded-xl border-2 border-slate-200 px-3 py-2 focus:border-teal-600 outline-none" />
          {editando && <button type="button" onClick={() => { setEditando(null); setTexto('') }} className="text-sm font-bold text-slate-500">{t('cancelar')}</button>}
          <Button disabled={!limpio || enviando} className="!px-3 !py-2 text-sm">{editando ? t('guardar') : t('comentar')}</Button>
        </form>
      )}
    </TarjetaPublicacion>
  )
}

/* Publicar o editar: la columna (si hay), la foto y el texto. Basta con la
   foto o con el texto. La foto se achica aquí antes de subirla (foto.js). */
function FormPublicacion({ actividad, inicial, fotoInicial, onPublicar, onCancelar }) {
  const t = useT()
  const columnas = columnasDe(actividad)
  const [texto, setTexto] = useState(inicial?.texto || '')
  const [columna, setColumna] = useState(Number.isInteger(inicial?.columna) && inicial.columna < columnas.length ? inicial.columna : null)
  /* 'igual' = la que ya estaba; null = sin foto; { grande, chica } = nueva. */
  const [foto, setFoto] = useState(inicial?.foto ? 'igual' : null)
  const [estado, setEstado] = useState(null) // null | 'achicando' | 'error' | 'enviando' | 'errorEnvio'
  const entrada = useRef(null)
  const limpio = limpiarAbierta(texto)
  const vista = foto === 'igual' ? fotoInicial : foto?.chica
  const ocupado = estado === 'achicando' || estado === 'enviando'
  const listo = Boolean(limpio || foto) && (!columnas.length || columna !== null) && !ocupado

  const elegir = async (e) => {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setEstado('achicando')
    try {
      const { prepararFoto } = await import('../live/foto.js')
      setFoto(await prepararFoto(archivo))
      setEstado(null)
    } catch (err) {
      console.error(err)
      setEstado('error')
    }
  }
  const enviar = async (e) => {
    e.preventDefault()
    if (!listo) return
    setEstado('enviando')
    try { await onPublicar({ texto: limpio, columna, foto }); setEstado(null) } catch (err) { console.error(err); setEstado('errorEnvio') }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={enviar}>
      {columnas.length > 0 && (
        <fieldset>
          <legend className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t('enQueColumna')}</legend>
          <div className="flex flex-wrap gap-2">
            {columnas.map((c, i) => (
              <button key={i} type="button" onClick={() => setColumna(i)} aria-pressed={columna === i}
                className={`rounded-xl border-2 px-3 py-2 font-bold ${columna === i ? 'text-white' : 'bg-white text-slate-800 border-slate-200'}`}
                style={columna === i ? { background: colorColumna(i), borderColor: colorColumna(i) } : undefined}>
                {c}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {actividad.foto && (
        <div className="flex flex-col gap-2">
          <input ref={entrada} type="file" accept="image/*" onChange={elegir} className="hidden" />
          {foto ? (
            <div>
              {vista ? <img src={vista} alt={t('tuFoto')} className="w-full rounded-2xl border border-slate-200 bg-slate-100" />
                : <div className="w-full aspect-[4/3] rounded-2xl bg-slate-100 animate-pulse" />}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button type="button" variant="ghost" disabled={ocupado} onClick={() => entrada.current?.click()}>{estado === 'achicando' ? t('preparandoFoto') : t('cambiarFoto')}</Button>
                <Button type="button" variant="ghost" disabled={ocupado} onClick={() => setFoto(null)}>{t('quitarFoto')}</Button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => entrada.current?.click()} disabled={estado === 'achicando'}
              className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-lg font-bold text-slate-700 active:scale-[.98] transition">
              {estado === 'achicando' ? t('preparandoFoto') : <><Icon name="camera" className="mr-2" />{t('agregarFoto')}</>}
            </button>
          )}
          {estado === 'error' && <p role="alert" className="text-sm text-rose-700">{t('fotoError')}</p>}
        </div>
      )}
      <textarea value={texto} maxLength={LIMITES.abierta} rows={3} aria-label={t('tuRespuesta')}
        placeholder={actividad.foto ? t('escribeSobreTuFoto') : t('escribeRespuesta')}
        onChange={(e) => setTexto(e.target.value)}
        className="rounded-xl border-2 border-slate-200 px-4 py-3 text-lg focus:border-teal-600 outline-none resize-none" />
      <p className="-mt-2 text-right text-xs text-slate-400 tabular-nums">{texto.length}/{LIMITES.abierta}</p>
      {estado === 'errorEnvio' && <p role="alert" className="text-sm text-rose-700">{t('publicarError')}</p>}
      <Button disabled={!listo} className="text-lg">{estado === 'enviando' ? t('publicando') : t('publicar')}</Button>
      {onCancelar && <Button type="button" variant="ghost" onClick={onCancelar}>{t('cancelar')}</Button>}
    </form>
  )
}
