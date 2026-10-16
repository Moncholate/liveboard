/* ============================================================================
   MODO CLARO Y OSCURO
   ----------------------------------------------------------------------------
   Dónde se usa cada uno no es igual:
     · CELULARES (estudiantes, docente moderando) y portada: siguen al sistema.
       Muchos usan el teléfono en oscuro, y una pantalla blanca encandila.
     · PROYECTOR: parte en CLARO, que en una sala con luz se lee mejor, y el
       docente lo cambia con un botón si la sala está a oscuras.
     · MIS MATERIALES: sigue al sistema, con botón.

   La preferencia queda en este navegador (es del aparato, no de nadie).
   El oscuro es `data-theme="dark"` en <html>, como en el resto de la suite
   (así le llegan el foco y los grises de design-tokens), y sus colores viven en
   index.css, en un solo lugar, en vez de repartidos por cada pantalla.
   ========================================================================== */
import { useEffect, useState } from 'react'
import { Icon } from './icons.jsx'

const leer = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const guardar = (k, v) => { try { localStorage.setItem(k, v) } catch { /* modo privado */ } }

const sistemaOscuro = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches

/** 'auto' | 'claro' | 'oscuro' → ¿se ve oscuro? */
export const resolver = (modo, sistema) => (modo === 'oscuro' ? true : modo === 'claro' ? false : sistema)

/**
 * El tema de esta pantalla. `clave` = dónde se recuerda; sin clave, siempre
 * automático (los celulares no tienen botón: siguen al teléfono).
 */
export function useTema(clave = null, porDefecto = 'auto') {
  const [modo, setModo] = useState(() => (clave && leer(clave)) || porDefecto)
  const [sistema, setSistema] = useState(sistemaOscuro)

  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const cambio = () => setSistema(mq.matches)
    mq.addEventListener?.('change', cambio)
    return () => mq.removeEventListener?.('change', cambio)
  }, [])

  const oscuro = resolver(modo, sistema)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', oscuro ? 'dark' : 'light')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#0f1320' : '#0f766e')
  }, [oscuro])

  const alternar = () => {
    const nuevo = oscuro ? 'claro' : 'oscuro'
    setModo(nuevo)
    if (clave) guardar(clave, nuevo)
  }
  return { oscuro, alternar }
}

export function BotonTema({ tema, etiqueta }) {
  return (
    <button onClick={tema.alternar} aria-label={etiqueta} title={etiqueta}
      className="w-9 h-9 grid place-items-center rounded-full text-lg text-slate-600 hover:bg-slate-100">
      <Icon name={tema.oscuro ? 'sun' : 'moon'} />
    </button>
  )
}
