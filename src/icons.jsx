/* Íconos de la interfaz: todos aquí, con un solo estilo (línea, esquinas
   redondeadas, del color del texto). Trazos tomados de Lucide (licencia ISC),
   los mismos de Kachai. Cuando lleguen los íconos propios del diseñador, se
   cambian en este archivo y el resto de la app no se toca. Las reacciones del
   tablero (👍 💡 🤔 🔍) siguen como emoji: son el lenguaje de reacciones que
   todos conocen, a la espera de ese mismo cambio. */

const TRAZOS = {
  check: <path d="M20 6 9 17l-5-5" />,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  pencil: <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2m-7.07-17.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></>,
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  camera: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z" /><circle cx="12" cy="13" r="3" /></>,
  comment: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  reply: <><path d="m15 10 5 5-5 5" /><path d="M4 4v7a4 4 0 0 0 4 4h12" /></>,
  up: <><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></>,
  down: <><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>,
}

/* <Icon name="check" />. Por defecto mide lo mismo que la letra que lo rodea,
   así sirve igual en el proyector y en el celular. Decorativo (aria-hidden):
   el texto o el title dicen lo que significa. */
export function Icon({ name, className = '', strokeWidth = 2.25 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={`inline-block shrink-0 w-[1em] h-[1em] align-[-0.125em] ${className}`}>
      {TRAZOS[name]}
    </svg>
  )
}
