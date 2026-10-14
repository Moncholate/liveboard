/* ============================================================================
   EL TABLERO EN EL PROYECTOR
   ----------------------------------------------------------------------------
   La pregunta abierta como en Padlet (tablero.js): las publicaciones con su
   foto, su texto y sus comentarios, ordenadas de cuatro maneras que el docente
   cambia en vivo sin perder nada:

     MURO        ladrillos: cada tarjeta de su alto, las fotos enteras
     CUADRÍCULA  todas del mismo tamaño, la foto recortada; los comentarios
                 se cuentan, y se leen al abrir la tarjeta
     COLUMNAS    una por sección, con su nombre arriba
     LISTA       una debajo de otra, grande, para ir mostrando de a una

   Tocar una tarjeta la abre en grande, con todos sus comentarios: es lo que
   se hace en clase al comentar una foto entre todos. La tarjeta abierta es de
   esta pantalla, no de la sala: no se mueve en los celulares.

   Los nombres salen solo si el docente los prendió en la actividad.
   ========================================================================== */
import { useEffect, useState } from 'react'
import { borradorVigente } from './logic.js'
import { REACCIONES, columnaDe, columnasDe, porColumna, reaccionesDe, vistasDe } from './tablero.js'
import { Cambios } from './Cambios.jsx'
import { useT } from '../i18n.jsx'

/* Colores de las columnas: los de las alternativas, que ya pasan contraste
   en los dos temas. Una franja arriba de cada tarjeta, no la tarjeta entera:
   el texto se lee sobre blanco. */
const COLOR_COLUMNA = ['#7c3aed', '#0d9488', '#ea580c', '#db2777']
export const colorColumna = (i) => COLOR_COLUMNA[i % COLOR_COLUMNA.length]

export function Tablero({ actividad, publicaciones, fotos, comentarios, reacciones, vista, verCambios = true, borrador = null, sobreFondo = false }) {
  const t = useT()
  const [abierta, setAbierta] = useState(null)
  const columnas = columnasDe(actividad)
  const vivo = (r) => borradorVigente(borrador, `a:${r.pid}`, Date.now())
  /* La tarjeta abierta se cierra sola si la quitan de la pantalla. */
  const actual = abierta && publicaciones.find(r => r.pid === abierta)
  const suColumna = (r) => { const i = columnaDe(r, columnas.length); return { nombre: columnas[i], i } }

  if (!publicaciones.length) {
    return <p className="w-full text-center text-2xl text-slate-500 self-center">{t('vacioAbiertas')}</p>
  }
  const tarjeta = (r, { recortada = false, grande = false } = {}) => (
    <TarjetaPublicacion key={r.pid} r={r} foto={fotos?.[r.pid]} nombres={actividad.nombres === true}
      columna={columnas.length && vista !== 'columnas' ? suColumna(r) : null}
      comentarios={comentarios?.[r.pid] || []} verComentarios={recortada ? 'cuenta' : 'todos'}
      reacciones={actividad.reacciones ? reaccionesDe(reacciones?.[r.pid], r.pid) : null}
      recortada={recortada} grande={grande} verCambios={verCambios} vivo={vivo(r)} sobreFondo={sobreFondo}
      onAbrir={() => setAbierta(r.pid)} />
  )

  let cuerpo
  if (vista === 'columnas' && columnas.length) {
    const cols = porColumna(publicaciones, columnas.length)
    cuerpo = (
      <div className="w-full grid gap-4 items-start" style={{ gridTemplateColumns: `repeat(${columnas.length}, minmax(0, 1fr))` }}>
        {columnas.map((nombre, i) => (
          <section key={i} className="flex flex-col gap-3 min-w-0">
            <h2 className="rounded-xl px-4 py-2 text-xl font-black text-white shadow" style={{ background: colorColumna(i) }}>
              {nombre} <span className="font-bold opacity-80 tabular-nums">· {cols[i].length}</span>
            </h2>
            {cols[i].map(r => tarjeta(r))}
          </section>
        ))}
      </div>
    )
  } else if (vista === 'cuadricula') {
    cuerpo = (
      <div className="w-full grid gap-4 items-start" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(17rem, 1fr))' }}>
        {publicaciones.map(r => tarjeta(r, { recortada: true }))}
      </div>
    )
  } else if (vista === 'lista') {
    cuerpo = <div className="w-full max-w-3xl mx-auto flex flex-col gap-5">{publicaciones.map(r => tarjeta(r, { grande: true }))}</div>
  } else {
    /* El muro: columnas de CSS, cada tarjeta de su alto. */
    cuerpo = (
      <div className="w-full" style={{ columnWidth: '19rem', columnGap: '1rem' }}>
        {publicaciones.map(r => <div key={r.pid} className="mb-4" style={{ breakInside: 'avoid' }}>{tarjeta(r)}</div>)}
      </div>
    )
  }

  return (
    <>
      <div className="w-full self-start">{cuerpo}</div>
      {actual && (
        <Ampliada r={actual} foto={fotos?.[actual.pid]} nombres={actividad.nombres === true} comentarios={comentarios?.[actual.pid] || []}
          reacciones={actividad.reacciones ? reaccionesDe(reacciones?.[actual.pid], actual.pid) : null}
          verCambios={verCambios} vivo={vivo(actual)} columna={columnas.length ? suColumna(actual) : null}
          onCerrar={() => setAbierta(null)} />
      )}
    </>
  )
}

/* El texto de una publicación, con la corrección del docente: en vivo
   mientras escribe, y tachado / subrayado si el curso ve las correcciones. */
function TextoPublicado({ r, verCambios, vivo }) {
  if (vivo !== null) return verCambios ? <Cambios antes={r.original} despues={vivo} /> : vivo
  if (r.corregida && verCambios) return <Cambios antes={r.original} despues={r.texto} />
  return r.texto
}

/**
 * Una tarjeta del tablero. La usan el proyector y los celulares (`chico`).
 * `verComentarios`: 'todos' | 'cuenta' | false. `children` va al final (los
 * celulares ponen ahí el campo para comentar).
 */
export function TarjetaPublicacion({
  r, foto, nombres, columna = null, comentarios = [], verComentarios = 'todos', recortada = false, grande = false,
  verCambios = true, vivo = null, sobreFondo = false, chico = false, onAbrir = null, pieComentario = null, children = null,
  reacciones = null, onReaccionar = null, encabezado = null,
}) {
  const t = useT()
  const texto = r.texto || vivo !== null
  /* Toda la tarjeta se toca para abrirla (no un botón: lleva párrafos adentro). */
  const tocable = onAbrir ? {
    role: 'button', tabIndex: 0, 'aria-label': t('abrirPublicacion'), onClick: onAbrir,
    onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir() } },
  } : {}
  return (
    <article className={`relative w-full rounded-2xl bg-white border overflow-hidden text-left animate-pop ${vivo !== null ? 'border-teal-600 ring-4 ring-teal-600/30' : 'border-slate-200'} ${sobreFondo ? 'shadow-lg' : chico ? '' : 'shadow-sm'}`}>
      {columna && <div aria-hidden="true" className="h-1.5" style={{ background: colorColumna(columna.i) }} />}
      {encabezado}
      <div {...tocable} className={`block w-full text-left ${onAbrir ? 'cursor-pointer' : ''}`}>
        {r.foto && (foto
          ? <img src={foto} alt="" className={`block w-full bg-slate-100 ${recortada ? 'aspect-[4/3] object-cover' : grande ? 'max-h-[60vh] object-contain' : 'h-auto'}`} />
          : <div aria-hidden="true" className="w-full aspect-[4/3] bg-slate-100 animate-pulse" />)}
        {(texto || nombres || columna) && (
          <div className={chico ? 'px-3 pt-2 pb-2' : grande ? 'px-6 pt-4 pb-3' : 'px-4 pt-3 pb-3'}>
            {columna && <p className={`font-bold uppercase tracking-wider ${chico ? 'text-[10px]' : 'text-xs'}`} style={{ color: colorColumna(columna.i) }}>{columna.nombre}</p>}
            {texto && (
              <p className={`font-semibold text-slate-900 break-words ${chico ? 'text-base' : grande ? 'text-3xl' : 'text-xl'} ${recortada ? 'line-clamp-3' : ''}`}>
                <TextoPublicado r={r} verCambios={verCambios} vivo={vivo} />
              </p>
            )}
            {vivo !== null && <span className={`block font-bold text-teal-800 animate-pulse ${chico ? 'text-xs' : 'text-base mt-1'}`}>✎ {t('corrigiendo')}</span>}
            {nombres && r.nombre && <p className={`font-semibold text-slate-500 ${chico ? 'text-xs mt-0.5' : 'text-base mt-1'}`}>{r.nombre}</p>}
          </div>
        )}
      </div>
      {r.corregida && !verCambios && vivo === null && (
        <span title={t('corregida')} aria-label={t('corregida')} className="absolute top-2 right-3 text-base text-slate-400">✎</span>
      )}
      {reacciones && (onReaccionar || reacciones.total > 0) && (
        <Reacciones reacciones={reacciones} onReaccionar={onReaccionar} chico={chico} grande={grande} />
      )}
      {verComentarios === 'cuenta' && comentarios.length > 0 && (
        <p className={`px-4 pb-3 font-bold text-slate-500 tabular-nums ${chico ? 'text-xs' : 'text-base'}`}>💬 {t('comentariosN', comentarios.length)}</p>
      )}
      {verComentarios === 'todos' && comentarios.length > 0 && (
        <ul className={`border-t border-slate-100 flex flex-col ${chico ? 'px-3 py-2 gap-1.5' : grande ? 'px-6 py-3 gap-2' : 'px-4 py-2.5 gap-1.5'}`}>
          {comentarios.map(c => (
            <li key={c.cid} className={`break-words text-slate-800 ${chico ? 'text-sm' : grande ? 'text-2xl' : 'text-lg'}`}>
              {nombres && c.nombre && <b className="font-bold text-slate-600">{c.nombre}: </b>}
              {c.texto}
              {pieComentario?.(c)}
            </li>
          ))}
        </ul>
      )}
      {children}
    </article>
  )
}

/* La publicación en grande: la foto a la izquierda y lo que se dijo de ella a
   la derecha, para comentarla entre todos. Esc o un toque afuera la cierra. */
function Ampliada({ r, foto, nombres, comentarios, reacciones, verCambios, vivo, columna, onCerrar }) {
  const t = useT()
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onCerrar() }
    addEventListener('keydown', tecla)
    return () => removeEventListener('keydown', tecla)
  }, [onCerrar])
  return (
    <div className="fixed inset-0 z-40 bg-slate-900/80 p-6 flex items-center justify-center" onClick={onCerrar}>
      <div className="w-full max-w-[min(96vw,110rem)] max-h-full rounded-3xl bg-white overflow-hidden flex shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {r.foto && (
          <div className="flex-[3] min-w-0 bg-slate-900 grid place-items-center">
            {foto ? <img src={foto} alt="" className="max-w-full max-h-[88vh] object-contain" /> : <div className="w-full aspect-[4/3] bg-slate-800 animate-pulse" />}
          </div>
        )}
        <div className={`${r.foto ? 'flex-[2]' : 'flex-1'} min-w-0 flex flex-col p-8 gap-4 overflow-auto max-h-[88vh]`}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {columna && <p className="text-sm font-bold uppercase tracking-wider" style={{ color: colorColumna(columna.i) }}>{columna.nombre}</p>}
              {(r.texto || vivo !== null) && <p className="text-4xl font-black text-slate-900 leading-tight break-words"><TextoPublicado r={r} verCambios={verCambios} vivo={vivo} /></p>}
              {nombres && r.nombre && <p className="mt-2 text-xl font-semibold text-slate-500">{r.nombre}</p>}
            </div>
            <button onClick={onCerrar} className="shrink-0 rounded-xl border border-slate-300 px-4 py-2 text-lg font-bold text-slate-700">{t('cerrar')}</button>
          </div>
          {reacciones?.total > 0 && <div className="-mx-6"><Reacciones reacciones={reacciones} grande /></div>}
          {comentarios.length > 0 ? (
            <ul className="flex flex-col gap-3 border-t border-slate-200 pt-4">
              {comentarios.map(c => (
                <li key={c.cid} className="text-2xl text-slate-800 break-words">
                  {nombres && c.nombre && <b className="font-bold text-slate-600">{c.nombre}: </b>}{c.texto}
                </li>
              ))}
            </ul>
          ) : <p className="text-xl text-slate-500 border-t border-slate-200 pt-4">{t('sinComentarios')}</p>}
        </div>
      </div>
    </div>
  )
}

/* LAS REACCIONES de una tarjeta (tablero.js). En el proyector, solo las que
   tienen alguna, con su nombre escrito: un emoji solo se lee distinto según
   quién lo mire. En el celular de los compañeros son los cuatro botones, que
   se prenden y apagan; en la tarjeta propia, solo se cuentan. */
export function Reacciones({ reacciones, onReaccionar = null, chico = false, grande = false }) {
  const t = useT()
  const lista = onReaccionar ? REACCIONES : REACCIONES.filter(x => reacciones.cuenta[x.id] > 0)
  const tam = chico ? 'text-sm px-2.5 py-1' : grande ? 'text-xl px-4 py-1.5' : 'text-base px-3 py-1'
  return (
    <div className={`flex flex-wrap gap-1.5 ${chico ? 'px-3 pb-2' : grande ? 'px-6 pb-3' : 'px-4 pb-3'}`}>
      {lista.map(x => {
        const n = reacciones.cuenta[x.id]
        const mia = reacciones.mias?.[x.id] === true
        const cuerpo = <><span aria-hidden="true">{x.emoji}</span> {t(`reaccion_${x.id}`)}{n > 0 && <b className="tabular-nums"> {n}</b>}</>
        return onReaccionar ? (
          <button key={x.id} type="button" onClick={() => onReaccionar(x.id, !mia)} aria-pressed={mia}
            className={`rounded-full border font-semibold transition active:scale-95 ${tam} ${mia ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-200 bg-white text-slate-700'}`}>
            {cuerpo}
          </button>
        ) : (
          <span key={x.id} className={`rounded-full bg-slate-100 font-semibold text-slate-700 ${tam}`}>{cuerpo}</span>
        )
      })}
    </div>
  )
}

/* Los cuatro botones para cambiar cómo se ordena. Los usan el proyector y el
   celular del docente. */
const ICONOS = {
  muro: <><rect x="1" y="1" width="6" height="9" rx="1" /><rect x="9" y="1" width="6" height="5" rx="1" /><rect x="1" y="12" width="6" height="3" rx="1" /><rect x="9" y="8" width="6" height="7" rx="1" /></>,
  cuadricula: <><rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" /></>,
  columnas: <><rect x="1" y="1" width="6" height="14" rx="1" /><rect x="9" y="1" width="6" height="14" rx="1" /></>,
  lista: <><rect x="3" y="1" width="10" height="4" rx="1" /><rect x="3" y="6" width="10" height="4" rx="1" /><rect x="3" y="11" width="10" height="4" rx="1" /></>,
}

export function SelectorVista({ actividad, vista, onCambiar, className = '' }) {
  const t = useT()
  return (
    <div role="group" aria-label={t('ordenarComo')} className={`inline-flex rounded-xl border border-slate-300 bg-white p-0.5 ${className}`}>
      {vistasDe(actividad).map(v => (
        <button key={v} onClick={() => onCambiar(v)} aria-pressed={vista === v}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-bold ${vista === v ? 'bg-teal-700 text-white' : 'text-slate-600 hover:text-teal-800'}`}>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">{ICONOS[v]}</svg>
          {t(`vista_${v}`)}
        </button>
      ))}
    </div>
  )
}
