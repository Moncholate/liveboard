/* ============================================================================
   LA LISTA DE ACTIVIDADES, PARA EDITAR
   ----------------------------------------------------------------------------
   La misma en dos lugares: al preparar la sala (Host) y en Mis materiales.
   `onMostrar`, si viene, agrega a cada tarjeta el botón para lanzarla: en Mis
   materiales no hay sala, así que no lo lleva.
   ========================================================================== */
import { useState } from 'react'
import { useT } from '../i18n.jsx'
import { Icon } from '../icons.jsx'
import {
  ALTERNATIVAS, BASICOS, CIERRES, LIMITES, actividadNueva, conAlternativas, preguntaOpcional, problemaDe, rangoAlternativas,
} from '../live/logic.js'
import { Button } from '../ui.jsx'
import { MODOS } from '../live/crucigrama.js'
import { destapables } from '../live/sopa.js'
import { LIMITES_TABLERO, OPCIONES } from '../live/tablero.js'

export function Editor({ lista, setLista, onMostrar }) {
  const t = useT()
  const cambiar = (i, cambios) => setLista(l => l.map((a, j) => (j === i ? { ...a, ...cambios } : a)))
  const quitar = (i) => setLista(l => l.filter((_, j) => j !== i))
  const mover = (i, d) => setLista(l => {
    const j = i + d
    if (j < 0 || j >= l.length) return l
    const c = [...l];
    [c[i], c[j]] = [c[j], c[i]]
    return c
  })

  return (
    <div className="flex flex-col gap-3">
      {lista.map((a, i) => (
        <Tarjeta key={a.id || i} a={a} i={i} total={lista.length}
          onCambiar={(c) => cambiar(i, c)} onQuitar={() => quitar(i)} onMover={(d) => mover(i, d)}
          onMostrar={onMostrar ? () => onMostrar(i) : null} />
      ))}

      <div className="rounded-2xl border-2 border-dashed border-slate-300 p-4 flex flex-col gap-3">
        {[['agregar', BASICOS], ['paraCerrar', CIERRES]].map(([rotulo, tipos]) => (
          <div key={rotulo}>
            <p className="text-sm font-bold text-slate-600 mb-2">{t(rotulo)}</p>
            <div className="flex flex-wrap gap-2">
              {tipos.map(tipo => (
                <button key={tipo} onClick={() => setLista(l => [...l, actividadNueva(tipo)])}
                  title={t(`ayuda_${tipo}`)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:border-teal-600 hover:text-teal-800">
                  + {t(`tipo_${tipo}`)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Tarjeta({ a, i, total, onCambiar, onQuitar, onMover, onMostrar }) {
  const t = useT()
  const campo = 'w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-600 outline-none'
  const problema = problemaDe(a)
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="grid place-items-center w-7 h-7 rounded-full bg-slate-100 text-sm font-black text-slate-600">{i + 1}</span>
        <span className="text-sm font-bold text-teal-800">{t(`tipo_${a.tipo}`)}</span>
        <span className="flex-1" />
        <button onClick={() => onMover(-1)} disabled={i === 0} aria-label={t('subir')} className="px-2 text-slate-500 disabled:opacity-30"><Icon name="up" /></button>
        <button onClick={() => onMover(1)} disabled={i === total - 1} aria-label={t('bajar')} className="px-2 text-slate-500 disabled:opacity-30"><Icon name="down" /></button>
        <button onClick={onQuitar} className="px-2 text-sm text-rose-700">{t('quitar')}</button>
      </div>
      {a.tipo === 'duda' || a.tipo === 'muro' ? (
        <>
          <textarea value={a.pregunta} maxLength={LIMITES.pregunta} rows={2} placeholder={t(`moldeEj_${a.tipo}`)} aria-label={t(`tipo_${a.tipo}`)}
            onChange={(e) => onCambiar({ pregunta: e.target.value })} className={`${campo} font-semibold resize-none`} />
          <p className="text-xs text-slate-500">{t('moldeAyuda')}</p>
        </>
      ) : (
        <input value={a.pregunta} maxLength={LIMITES.pregunta}
          placeholder={a.tipo === 'semaforo' ? t('escribeObjetivo') : preguntaOpcional(a.tipo) ? t('tituloOpcional') : t('escribePregunta')}
          onChange={(e) => onCambiar({ pregunta: e.target.value })} className={`${campo} font-semibold`} />
      )}
      {conAlternativas(a.tipo) && <Alternativas a={a} campo={campo} onCambiar={onCambiar} />}
      {a.tipo === 'abierta' && <OpcionesTablero a={a} campo={campo} onCambiar={onCambiar} />}
      {a.tipo === 'antesahora' && (
        <>
          <div className="grid sm:grid-cols-2 gap-2">
            <input value={a.antes || ''} maxLength={LIMITES.lado} placeholder={t('antesPensaba')} aria-label={t('antesPensaba')}
              onChange={(e) => onCambiar({ antes: e.target.value })} className={campo} />
            <input value={a.ahora || ''} maxLength={LIMITES.lado} placeholder={t('ahoraPienso')} aria-label={t('ahoraPienso')}
              onChange={(e) => onCambiar({ ahora: e.target.value })} className={campo} />
          </div>
          <p className="text-xs text-slate-500">{t('ladosEnBlanco')}</p>
        </>
      )}
      {a.tipo === 'apuesta' && (
        <>
          {/* Se editan las líneas tal cual —también las vacías, o Enter no
              haría nada— y se limpian al guardar (limpiarActividad). */}
          <textarea value={(a.consignas || []).join('\n')} rows={5} placeholder={t('consignasEj')} aria-label={t('consignas')}
            onChange={(e) => onCambiar({ consignas: e.target.value.split('\n').slice(0, LIMITES.maxConsignas) })} className={`${campo} resize-y`} />
          <p className="text-xs text-slate-500">{t('consignas')} · {t('consignasReparte')}</p>
        </>
      )}
      {destapables(a) && (
        <>
          {/* Las palabras no se editan aquí: el crucigrama y la sopa llegan
              armados del Belt, y moverles una letra los rompería. Sí se elige
              cuándo aparece cada palabra en la pantalla. */}
          <p className="text-sm text-slate-700">
            {destapables(a).palabras.map(p => p.original).join(' · ')}
          </p>
          <p className="text-xs text-slate-500">{t('crucigramaDelBelt', destapables(a).palabras.length)}</p>
          <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
            <span className="font-semibold">{t('destaparCuando')}</span>
            <select value={a.destapar || 'mitad'} onChange={(e) => onCambiar({ destapar: e.target.value })}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5">
              {MODOS.map(m => <option key={m} value={m}>{t(`destapar_${m}`)}</option>)}
            </select>
          </label>
        </>
      )}
      <div className="flex items-center gap-3">
        <span className="flex-1 text-xs text-slate-500">{problema ? t(problema) : t(`ayuda_${a.tipo}`)}</span>
        {onMostrar && (
          <Button variant="ghost" className="!px-3 !py-1.5 text-sm" disabled={Boolean(problema)} onClick={onMostrar}>{t('mostrarEsta')}</Button>
        )}
      </div>
    </div>
  )
}

/* Las alternativas de una encuesta (A–D, con sus colores) o los elementos de
   un ranking (1–6, sin color: el número es su lugar en la lista, no una
   respuesta que se elige). */
function Alternativas({ a, campo, onCambiar }) {
  const t = useT()
  const alts = a.alternativas || []
  const { min, max } = rangoAlternativas(a.tipo)
  const ranking = a.tipo === 'ranking'
  const rotulo = (j) => (ranking ? String(j + 1) : ALTERNATIVAS[j].letra)
  return (
    <div className="flex flex-col gap-1.5">
      {alts.map((alt, j) => (
        <div key={j} className="flex items-center gap-2">
          <span className={`grid place-items-center w-8 h-8 shrink-0 rounded-lg font-black ${ranking ? 'bg-slate-100 text-slate-600' : `text-white ${ALTERNATIVAS[j].solido}`}`}>{rotulo(j)}</span>
          <input value={alt} maxLength={LIMITES.alternativa} placeholder={ranking ? t('elemento', j + 1) : t('alternativa', rotulo(j))}
            onChange={(e) => onCambiar({ alternativas: alts.map((x, k) => (k === j ? e.target.value : x)) })}
            className={campo} />
          {alts.length > min && (
            <button onClick={() => onCambiar({ alternativas: alts.filter((_, k) => k !== j) })}
              aria-label={ranking ? t('quitarElemento', j + 1) : t('quitarAlternativa', rotulo(j))} className="px-2 text-slate-400 hover:text-rose-700"><Icon name="x" /></button>
          )}
        </div>
      ))}
      {alts.length < max && (
        <button onClick={() => onCambiar({ alternativas: [...alts, ''] })} className="self-start text-sm font-semibold text-teal-800">
          {ranking ? t('masElemento') : t('masAlternativa')}
        </button>
      )}
    </div>
  )
}

/* LA ABIERTA COMO TABLERO (tablero.js): un muro de publicaciones. Todo
   apagado, es la abierta de siempre. Las columnas se escriben una por línea,
   como las consignas, y se limpian al guardar; con una sola no hay columnas. */
function OpcionesTablero({ a, campo, onCambiar }) {
  const t = useT()
  const columnas = Array.isArray(a.columnas) ? a.columnas : Object.values(a.columnas || {})
  const [verColumnas, setVerColumnas] = useState(columnas.length > 0)
  return (
    <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" open={OPCIONES.some(k => a[k]) || columnas.length > 0 || undefined}>
      <summary className="cursor-pointer text-sm font-bold text-slate-700">{t('comoTablero')}</summary>
      <p className="mt-1 text-xs text-slate-500">{t('comoTableroAyuda')}</p>
      <div className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
        {OPCIONES.map(k => (
          <label key={k} className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={a[k] === true} onChange={(e) => onCambiar({ [k]: e.target.checked || undefined })} className="mt-0.5 w-4 h-4 accent-teal-700" />
            <span>
              <span className="font-semibold text-slate-800">{t(`opcion_${k}`)}</span>
              <span className="block text-xs text-slate-500">{t(`opcionAyuda_${k}`)}</span>
            </span>
          </label>
        ))}
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={verColumnas} onChange={(e) => { setVerColumnas(e.target.checked); if (!e.target.checked) onCambiar({ columnas: undefined }) }} className="mt-0.5 w-4 h-4 accent-teal-700" />
          <span>
            <span className="font-semibold text-slate-800">{t('opcion_columnas')}</span>
            <span className="block text-xs text-slate-500">{t('opcionAyuda_columnas')}</span>
          </span>
        </label>
      </div>
      {verColumnas && (
        <textarea value={columnas.join('\n')} rows={3} placeholder={t('columnasEj')} aria-label={t('opcion_columnas')}
          onChange={(e) => onCambiar({ columnas: e.target.value.split('\n').slice(0, LIMITES_TABLERO.maxColumnas).map(c => c.slice(0, LIMITES_TABLERO.columna)) })}
          className={`${campo} mt-2 resize-y`} />
      )}
    </details>
  )
}
