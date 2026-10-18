/* ============================================================================
   EL CELULAR DEL DOCENTE
   ----------------------------------------------------------------------------
   Para moderar en privado: aquí sí se ve quién escribió cada respuesta, porque
   esta pantalla no la ve nadie más. Y de paso es un control remoto: pasar de
   actividad, abrir o cerrar respuestas y mostrar u ocultar resultados sin
   volver al computador.

   Se entra con el enlace del botón «Celular» del proyector, que lleva la clave
   de la sala. Con el PIN solo, se entra como estudiante.
   ========================================================================== */
import { useEffect, useMemo } from 'react'
import { useStore, useValue } from '../net/hooks.js'
import { Button, Center, Logo } from '../ui.jsx'
import { consignasDe, cuantosRespondieron, moderable, problemaDe, tituloDe } from '../live/logic.js'
import { faseApuesta } from '../live/cierres.js'
import { ProveedorIdioma, traducir, useT, valido } from '../i18n.jsx'
import { accionesDeSala, comoLista, conectados, raiz } from '../live/sala.js'
import { Moderacion } from '../live/Moderacion.jsx'
import { destapables } from '../live/sopa.js'
import { Apuesta, Crucigrama, Encuesta, Sopa, Escala, Nube, Ranking, Semaforo, TextoConHuecos } from '../live/Resultados.jsx'
import { FasesApuesta } from './Host.jsx'
import { SelectorVista } from '../live/Tablero.jsx'
import { esTablero, vistaDe } from '../live/tablero.js'
import { useTema } from '../tema.jsx'

export default function Mod({ pin, clave }) {
  useTema()
  const store = useStore()
  /* El control del docente en la tablet: escala entero como la vista del estudiante (ver .alumno en index.css) */
  useEffect(() => { document.documentElement.classList.add('alumno'); return () => document.documentElement.classList.remove('alumno') }, [])
  const base = raiz(pin)
  const meta = useValue(store, `${base}/meta`)
  const idioma = valido(useValue(store, `${base}/idioma`))
  if (!store || meta === undefined) return <Center>{traducir(idioma, 'cargando')}</Center>
  if (!meta) return <Center>{traducir(idioma, 'salaNoExiste')}</Center>
  if (!clave || meta.clave !== clave) return <Center>{traducir(idioma, 'enlaceNoSirve')}</Center>
  return <ProveedorIdioma value={idioma}><Panel store={store} pin={pin} clave={clave} /></ProveedorIdioma>
}

function Panel({ store, pin, clave }) {
  const t = useT()
  const base = raiz(pin)
  const estado = useValue(store, `${base}/estado`)
  const actividades = comoLista(useValue(store, `${base}/actividades`))
  const online = useValue(store, `${base}/online`)
  const participantes = useValue(store, `${base}/participantes`)
  const acciones = useMemo(() => accionesDeSala(store, pin), [store, pin])

  if (estado === undefined) return <Center>{t('cargando')}</Center>
  const idx = estado?.idx ?? null
  const actividad = idx != null ? actividades[idx] : null

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-10">
        <Logo className="text-xl" />
        <span className="text-xs font-bold text-teal-800 bg-teal-50 rounded-full px-2 py-0.5">{t('docente')}</span>
        <span className="flex-1" />
        <span className="text-sm text-slate-600">{t('conectados', conectados(online))}</span>
        {/* A la pizarra con la misma clave: en la tablet se pasa de escribir a
            moderar y de vuelta sin escanear nada. */}
        <a href={`#/pizarra?pin=${pin}&clave=${clave}`} className="rounded-lg border border-slate-300 px-2.5 py-1 text-sm font-bold text-slate-700">{t('pizarra')}</a>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-4 max-w-md lg:max-w-2xl w-full mx-auto">
        {!actividad ? (
          <div className="flex flex-col gap-3">
            <p className="text-slate-600">{t('preparandoElige')}</p>
            {actividades.length === 0 && <p className="text-sm text-slate-500">{t('sinActividades')}</p>}
            {actividades.map((a, i) => (
              <button key={a.id || i} onClick={() => acciones.mostrar(i, a.tipo)} disabled={Boolean(problemaDe(a))}
                className="rounded-xl border border-slate-200 bg-white p-3 text-left disabled:opacity-50">
                <span className="block text-xs font-bold text-teal-800">{i + 1} · {t(`tipo_${a.tipo}`)}</span>
                <span className="block font-semibold text-slate-900">{tituloDe(a, t) || t('sinPregunta')}</span>
              </button>
            ))}
          </div>
        ) : (
          <EnVivo store={store} base={base} idx={idx} actividades={actividades} actividad={actividad} enSala={conectados(online)}
            estado={estado} participantes={participantes} acciones={acciones} />
        )}
      </main>
    </div>
  )
}

function EnVivo({ store, base, idx, actividades, actividad, enSala, estado, participantes, acciones }) {
  const t = useT()
  const total = actividades.length
  const ir = (i) => acciones.mostrar(i, actividades[i]?.tipo)
  const apuesta = actividad.tipo === 'apuesta'
  const aid = actividad.id
  const respuestas = useValue(store, `${base}/respuestas/${aid}`)
  const moderacion = useValue(store, `${base}/moderacion/${aid}`)
  /* Como tablero: las fotos chicas (no las del proyector) y los comentarios. */
  const tablero = esTablero(actividad)
  const minis = useValue(store, tablero && actividad.foto ? `${base}/minis/${aid}` : null)
  const comentarios = useValue(store, tablero && actividad.comentarios ? `${base}/comentarios/${aid}` : null)
  const n = cuantosRespondieron(respuestas)

  return (
    <>
      <section>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t(`tipo_${actividad.tipo}`)} · {t('deTotal', idx + 1, total)}</p>
        <h1 className="text-xl font-black text-slate-900 leading-snug"><TextoConHuecos texto={tituloDe(actividad, t)} /></h1>
        <p className="text-sm text-slate-600 mt-1">{t('respondieronDe', n, Math.max(enSala, n))}{estado.abierta ? '' : ` · ${t('cerradas')}`}</p>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Button variant="ghost" className="!py-2 text-sm" onClick={() => ir(idx - 1)} disabled={idx === 0}>{t('anterior')}</Button>
        {idx < total - 1
          ? <Button className="!py-2 text-sm" onClick={() => ir(idx + 1)}>{t('siguiente')}</Button>
          : <Button className="!py-2 text-sm" onClick={acciones.volverAPreparar}>{t('terminar')}</Button>}
        <Button variant={estado.abierta ? 'ghost' : 'aviso'} className="!py-2 text-sm" onClick={() => acciones.abrir(!estado.abierta)}>
          {estado.abierta ? t('cerrarRespuestas') : t('reabrir')}
        </Button>
        {apuesta ? (
          <div className="flex gap-2"><FasesApuesta fase={faseApuesta(estado)} acciones={acciones} className="flex-1 !px-2 !py-2 text-sm" /></div>
        ) : destapables(actividad) ? (
          <Button variant="ghost" className="!py-2 text-sm" onClick={() => acciones.destapar(aid, destapables(actividad).palabras.map(destapables(actividad).clave))}>
            {actividad.tipo === 'sopa' ? t('mostrarTodas') : t('destaparTodas')}
          </Button>
        ) : (
          <Button variant={estado.resultados ? 'ghost' : 'aviso'} className="!py-2 text-sm" onClick={() => acciones.resultados(!estado.resultados)}>
            {estado.resultados ? t('ocultarResultados') : t('mostrarResultados')}
          </Button>
        )}
        {/* La columna de moderación en el proyector: para corregir en grupo
            mientras se modera desde aquí. */}
        {moderable(actividad.tipo) && (
          <Button variant={estado.moderando ? 'activo' : 'ghost'} onClick={() => acciones.moderando(!estado.moderando)}
            className="col-span-2 !py-2 text-sm">
            {estado.moderando ? `● ${t('moderacionEnProyector')}` : t('mostrarModeracion')}
          </Button>
        )}
        {tablero && (
          <div className="col-span-2 flex flex-col gap-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('ordenarComo')}</p>
            <SelectorVista actividad={actividad} vista={vistaDe(actividad, moderacion)} onCambiar={(v) => acciones.vista(aid, v)} className="self-start flex-wrap" />
          </div>
        )}
      </section>

      {moderable(actividad.tipo) ? (
        <section>
          <h2 className="font-black text-slate-900 mb-2">{t('moderar')}</h2>
          <Moderacion actividad={actividad} respuestas={respuestas} moderacion={moderacion} participantes={participantes} conNombres
            fotos={minis} comentarios={comentarios}
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
        </section>
      ) : (
        <section className="rounded-2xl bg-white border border-slate-200 p-4">
          {actividad.tipo === 'encuesta' ? <Encuesta actividad={actividad} respuestas={respuestas} chico />
            : actividad.tipo === 'ranking' ? <Ranking actividad={actividad} respuestas={respuestas} chico />
            : actividad.tipo === 'semaforo' ? <Semaforo respuestas={respuestas} chico />
            : actividad.tipo === 'sopa' ? <Sopa actividad={actividad} respuestas={respuestas} destapadas={moderacion?.destapadas} conectados={enSala}
                onDestapar={(claves) => acciones.destapar(aid, claves)} chico />
            : actividad.tipo === 'crucigrama' ? <Crucigrama actividad={actividad} respuestas={respuestas} destapadas={moderacion?.destapadas} conectados={enSala}
                onDestapar={(claves) => acciones.destapar(aid, claves)} chico />
            : apuesta ? <Apuesta consignas={consignasDe(actividad)} respuestas={respuestas} fase={faseApuesta(estado)} chico />
            : <Escala respuestas={respuestas} chico />}
        </section>
      )}

      {actividad.tipo === 'nube' && (
        <section className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{t('asiSeVe')}</p>
          <Nube respuestas={respuestas} moderacion={moderacion?.palabras} correcciones={moderacion?.correccionesNube} chico />
        </section>
      )}
    </>
  )
}
