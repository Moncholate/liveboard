/* ============================================================================
   MODERAR
   ----------------------------------------------------------------------------
   Dos lugares, una misma lista:
     · el celular o la tablet del docente (`conNombres`): privado, ahí sí se ve
       quién escribió qué, para poder conversarlo después;
     · el PC (`conNombres` apagado): si el PC es el del proyector, esto lo ve
       el curso, así que sin nombres, y con el aviso de que se está viendo.

   PREGUNTAS DEL CURSO (7-oct-2026): anónimas también aquí, aunque sea el
   celular del docente. La gracia es que se atrevan a preguntar.

   CORREGIR (6-oct-2026; preguntas y nube el 8-oct): el docente arregla un
   error en el momento, en las abiertas, en las preguntas y en las palabras de
   la nube. Se guarda aparte del original (sala.js). El proyector muestra QUÉ
   SE CORRIGIÓ, tachado y subrayado y sin nombre, para que el curso aprenda
   del error; el docente puede apagarlo por actividad y mostrar solo la
   versión limpia. El autor ve en su celular qué cambió.
   ========================================================================== */
import { useEffect, useRef, useState } from 'react'
import { LIMITES, abiertas, borradorVigente, conTexto, nube, preguntasDelCurso, seVenCorrecciones } from './logic.js'
import { Cambios } from './Cambios.jsx'
import { colorColumna } from './Tablero.jsx'
import { columnaDe, columnasDe, comentariosPorPublicacion } from './tablero.js'
import { useT } from '../i18n.jsx'
import { Icon } from '../icons.jsx'

const chico = 'rounded-lg px-3 py-1 text-sm font-bold'
const boton = (texto, clase, onClick) => (
  <button onClick={onClick} className={`${chico} ${clase}`}>{texto}</button>
)
/* POR REVISAR Y EN PANTALLA NO PUEDEN VERSE IGUAL (9-oct-2026): en clase el
   docente confundía una oración esperando con una ya aprobada, porque las dos
   eran tarjetas blancas y solo las separaba un rótulo chico. Ahora cada
   estado tiene su color en toda la tarjeta —ámbar lo que espera, teal lo que
   ya está en la pantalla, gris lo descartado—, una barra a la izquierda y su
   etiqueta escrita: el color solo no basta, proyectado se lava. */
const ESTADOS = {
  pendiente: { tarjeta: 'border-amber-200 bg-amber-50', barra: '#f59e0b', etiqueta: 'text-amber-900', punto: 'bg-amber-500' },
  aprobada: { tarjeta: 'border-teal-200 bg-teal-50', barra: '#0f766e', etiqueta: 'text-teal-800', punto: 'bg-teal-700' },
  descartada: { tarjeta: 'border-slate-200 bg-slate-50', barra: '#94a3b8', etiqueta: 'text-slate-500', punto: 'bg-slate-400' },
}
const Titulo = ({ children, estado = null, className = 'mb-1.5' }) => (
  <h3 className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${estado ? ESTADOS[estado].etiqueta : 'text-slate-500'} ${className}`}>
    {estado && <span aria-hidden="true" className={`w-2.5 h-2.5 rounded-full ${ESTADOS[estado].punto}`} />}
    {children}
  </h3>
)

export function Moderacion({
  actividad, respuestas, moderacion, participantes, conNombres = false, fotos = null, comentarios = null, onComentario = null,
  onPalabra, onAbierta, onAprobarVarias, onCorregir, onPregunta, onRespondida, onCorregirPregunta, onCorregirPalabra, onVerCorrecciones,
  onBorrador,
}) {
  const t = useT()
  /* CORREGIR EN VIVO: lo que otro aparato está escribiendo (vivo) y cómo
     mandar lo que se escribe aquí (manda). Ver borradorVigente en logic.js. */
  const vivo = (clave) => borradorVigente(moderacion?.borrador, clave, Date.now())
  const manda = (clave) => onBorrador && ((texto) => onBorrador(clave, texto))
  const interruptor = onVerCorrecciones && (
    <VerCorrecciones activo={seVenCorrecciones(moderacion)} onCambiar={onVerCorrecciones} />
  )

  if (actividad.tipo === 'preguntas') {
    return (
      <div className="flex flex-col gap-3">
        {interruptor}
        <ModerarPreguntas respuestas={respuestas} moderacion={moderacion} onPregunta={onPregunta} onRespondida={onRespondida} onCorregir={onCorregirPregunta}
          vivo={vivo} manda={manda} />
      </div>
    )
  }

  if (actividad.tipo === 'nube') {
    const palabras = nube(respuestas, moderacion?.palabras, moderacion?.correccionesNube)
    if (!palabras.length) return <p className="text-sm text-slate-500">{t('sinPalabras')}</p>
    return (
      <div className="flex flex-col gap-3">
        {interruptor}
        <ul className="flex flex-col gap-1.5">
          {palabras.map(p => (
            <FilaEditable key={p.clave} unaLinea max={LIMITES.palabra} enVivo={vivo(`n:${p.clave}`)} onBorrador={manda(`n:${p.clave}`)}
              texto={p.texto} original={p.antes[0]} corregida={p.corregida} tachada={p.oculta} groseria={p.auto}
              onCorregir={onCorregirPalabra && ((txt) => onCorregirPalabra(p.origenes, txt))}
              pie={<span className="text-sm tabular-nums text-slate-500">{p.cuenta}</span>}
              acciones={boton(p.oculta ? t('mostrar') : t('ocultar'),
                p.oculta ? 'border border-teal-600 text-teal-700' : 'border border-slate-300 text-slate-700',
                () => onPalabra(p.clave, p.oculta ? 'mostrar' : 'ocultar'))} />
          ))}
        </ul>
      </div>
    )
  }

  /* Las abiertas y los cierres con texto (la duda, el muro, antes / ahora). */
  if (conTexto(actividad.tipo)) {
    const { pendientes, aprobadas, descartadas } = abiertas(respuestas, moderacion?.abiertas, participantes, moderacion?.correcciones, actividad.sinModerar === true)
    /* Como tablero (tablero.js): la foto chica y la columna arriba del texto,
       y los nombres también en el PC si la actividad los muestra igual. */
    const columnas = columnasDe(actividad)
    const verNombres = conNombres || actividad.nombres === true
    /* «Aprobar todas» se salta las que el filtro marcó: esas se miran una por una. */
    const limpias = pendientes.filter(r => !r.groseria)
    /* Una función y no un componente: definido aquí adentro, React lo trataría
       como uno nuevo en cada respuesta que llega y vaciaría lo que se corrige. */
    const fila = (r, acciones, estado) => (
      <FilaEditable key={r.pid} estado={estado} enVivo={vivo(`a:${r.pid}`)} onBorrador={manda(`a:${r.pid}`)} texto={r.texto} original={r.original} corregida={r.corregida} groseria={r.groseria}
        encabezado={(r.antes || r.ahora) ? (
          <p className="text-sm mb-0.5">
            {r.antes && <span className="text-slate-500 line-through">{r.antes}</span>}
            {r.antes && r.ahora && <span className="text-slate-400"> → </span>}
            {r.ahora && <span className="text-slate-800">{r.ahora}</span>}
          </p>
        ) : (r.foto || columnas.length > 0) && (
          <div className="flex items-start gap-2 mb-1">
            {r.foto && (fotos?.[r.pid]
              ? <img src={fotos[r.pid]} alt="" className="w-20 h-16 rounded-md object-cover bg-slate-100 shrink-0" />
              : <span aria-hidden="true" className="w-20 h-16 rounded-md bg-slate-100 shrink-0" />)}
            {columnas.length > 0 && (
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: colorColumna(columnaDe(r, columnas.length)) }}>
                {columnas[columnaDe(r, columnas.length)]}
              </span>
            )}
          </div>
        )}
        onCorregir={onCorregir && ((txt) => onCorregir(r.pid, txt, r.original))}
        pie={verNombres && <span className="text-xs text-slate-500 truncate">{r.nombre}</span>}
        acciones={acciones} />
    )
    return (
      <div className="flex flex-col gap-4">
        {interruptor}
        <section>
          <div className="flex items-center gap-2 mb-1.5">
            <Titulo estado="pendiente" className="flex-1">{t('porRevisar')} · {pendientes.length}</Titulo>
            {onAprobarVarias && limpias.length > 1 && boton(t('aprobarTodas', limpias.length), 'bg-teal-700 text-white', () => onAprobarVarias(limpias.map(r => r.pid)))}
          </div>
          {pendientes.length ? (
            <ul className="flex flex-col gap-1.5">
              {pendientes.map(r => (
                fila(r, <>
                  {boton(t('descartar'), 'border border-slate-300 text-slate-700', () => onAbierta(r.pid, false))}
                  {boton(t('aprobar'), 'bg-teal-700 text-white', () => onAbierta(r.pid, true))}
                </>, 'pendiente')
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">{t('sinPendientes')}</p>}
        </section>
        {aprobadas.length > 0 && (
          <section>
            <Titulo estado="aprobada">{t('enPantalla')} · {aprobadas.length}</Titulo>
            <ul className="flex flex-col gap-1.5">
              {aprobadas.map(r => (
                fila(r, boton(t('quitar'), 'border border-slate-300 text-slate-700', () => onAbierta(r.pid, false)), 'aprobada')
              ))}
            </ul>
          </section>
        )}
        {descartadas.length > 0 && (
          <details>
            <summary className="text-xs font-bold uppercase tracking-wider text-slate-500 cursor-pointer">{t('descartadas')} · {descartadas.length}</summary>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {descartadas.map(r => (
                fila(r, boton(t('aprobar'), 'border border-teal-600 text-teal-700', () => onAbierta(r.pid, true)), 'descartada')
              ))}
            </ul>
          </details>
        )}
        {actividad.comentarios === true && (
          <ModerarComentarios comentarios={comentarios} participantes={participantes} publicaciones={[...pendientes, ...aprobadas, ...descartadas]}
            verNombres={verNombres} onComentario={onComentario} />
        )}
      </div>
    )
  }

  return <p className="text-sm text-slate-500">{t('sinModeracion')}</p>
}

/* LOS COMENTARIOS DEL TABLERO: se publican al instante (no hay quien revise
   treinta comentarios en vivo); el docente los edita o los borra. Lo que el
   filtro marca no se ve en ningún lado y aparece aquí en rojo. Editar
   reescribe el comentario: no queda la versión del estudiante. */
function ModerarComentarios({ comentarios, participantes, publicaciones, verNombres, onComentario }) {
  const t = useT()
  const porPublicacion = comentariosPorPublicacion(comentarios, participantes, { conGroserias: true })
  const lista = Object.values(porPublicacion).flat().sort((a, b) => a.at - b.at)
  const textoDe = (pid) => publicaciones.find(r => r.pid === pid)?.texto
  return (
    <section>
      <Titulo>{t('comentarios')} · {lista.length}</Titulo>
      {lista.length ? (
        <ul className="flex flex-col gap-1.5">
          {lista.map(c => (
            <FilaEditable key={c.cid} unaLinea max={LIMITES.abierta} texto={c.texto} groseria={c.groseria}
              encabezado={<p className="text-xs text-slate-500 truncate mb-0.5"><Icon name="reply" className="mr-1" />{textoDe(c.en) || t('unaFoto')}</p>}
              onCorregir={onComentario && ((txt) => txt.trim() && onComentario(c, txt))}
              pie={verNombres && <span className="text-xs text-slate-500 truncate">{c.nombre}</span>}
              acciones={onComentario && boton(t('borrar'), 'border border-slate-300 text-slate-700', () => onComentario(c, ''))} />
          ))}
        </ul>
      ) : <p className="text-sm text-slate-500">{t('sinComentarios')}</p>}
    </section>
  )
}

/* El interruptor de cada actividad: ¿el curso ve qué se corrigió, o solo la
   versión limpia? */
function VerCorrecciones({ activo, onCambiar }) {
  const t = useT()
  return (
    <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 cursor-pointer">
      <input type="checkbox" checked={activo} onChange={(e) => onCambiar(e.target.checked)} className="mt-1 w-4 h-4 accent-teal-700" />
      <span className="text-sm">
        <span className="font-bold text-slate-800">{t('cursoVeCorrecciones')}</span>
        <span className="block text-xs text-slate-500">{t('cursoVeCorreccionesAyuda')}</span>
      </span>
    </label>
  )
}

function ModerarPreguntas({ respuestas, moderacion, onPregunta, onRespondida, onCorregir, vivo, manda }) {
  const t = useT()
  const { pendientes, aprobadas, descartadas } = preguntasDelCurso(respuestas, moderacion)
  const fila = (q, children, estado) => (
    <FilaEditable key={q.qid} estado={estado} enVivo={vivo(`q:${q.qid}`)} onBorrador={manda(`q:${q.qid}`)} texto={q.texto} original={q.original} corregida={q.corregida} groseria={q.groseria} apagada={q.respondida}
      onCorregir={onCorregir && ((txt) => onCorregir(q.qid, txt, q.original))}
      pie={q.decision === true && <span className="text-xs font-bold text-slate-500 tabular-nums">▲ {t('votosN', q.votos)}</span>}
      acciones={children} />
  )
  if (!pendientes.length && !aprobadas.length && !descartadas.length) return <p className="text-sm text-slate-500">{t('sinPreguntas')}</p>
  return (
    <div className="flex flex-col gap-4">
      <section>
        <Titulo estado="pendiente">{t('porRevisar')} · {pendientes.length}</Titulo>
        {pendientes.length ? (
          <ul className="flex flex-col gap-1.5">
            {pendientes.map(q => (
              fila(q, <>
                {boton(t('descartar'), 'border border-slate-300 text-slate-700', () => onPregunta(q.qid, false))}
                {boton(t('aprobar'), 'bg-teal-700 text-white', () => onPregunta(q.qid, true))}
              </>, 'pendiente')
            ))}
          </ul>
        ) : <p className="text-sm text-slate-500">{t('sinPendientes')}</p>}
      </section>
      {aprobadas.length > 0 && (
        <section>
          <Titulo estado="aprobada">{t('enPantalla')} · {aprobadas.length}</Titulo>
          <ul className="flex flex-col gap-1.5">
            {aprobadas.map(q => (
              fila(q, <>
                {boton(t('quitar'), 'border border-slate-300 text-slate-700', () => onPregunta(q.qid, false))}
                {q.respondida
                  ? boton(t('desmarcarRespondida'), 'border border-slate-300 text-slate-700', () => onRespondida(q.qid, false))
                  : boton(<><Icon name="check" className="mr-1" />{t('marcarRespondida')}</>, 'bg-teal-700 text-white', () => onRespondida(q.qid, true))}
              </>, 'aprobada')
            ))}
          </ul>
        </section>
      )}
      {descartadas.length > 0 && (
        <details>
          <summary className="text-xs font-bold uppercase tracking-wider text-slate-500 cursor-pointer">{t('descartadas')} · {descartadas.length}</summary>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {descartadas.map(q => (
              fila(q, boton(t('aprobar'), 'border border-teal-600 text-teal-700', () => onPregunta(q.qid, true)), 'descartada')
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

/* UNA FILA QUE SE PUEDE CORREGIR: una respuesta abierta, una pregunta o una
   palabra de la nube. Va como componente propio y no dentro de Moderacion: el
   campo de corregir tiene estado, y definido adentro se rearmaba —y se
   vaciaba— cada vez que llegaba otra respuesta.
   `onCorregir(texto)`: con texto vacío se quita la corrección.
   `onBorrador(texto | null)`: lo que se va escribiendo, para que el proyector
   lo muestre en vivo; null al guardar o cancelar. `enVivo`: lo que otro
   aparato está escribiendo en esta misma fila. */
function FilaEditable({ texto, original, corregida, groseria, estado = null, tachada = false, apagada = false, unaLinea = false, max = LIMITES.abierta, onCorregir, onBorrador, enVivo = null, encabezado = null, pie, acciones }) {
  const t = useT()
  const [editando, setEditando] = useState(false)
  const [nuevo, setNuevo] = useState('')
  /* El borrador sale con una pausa cortita: una escritura por tecla haría
     cola en una WiFi lenta, y en vivo basta con que se vea fluir. */
  const pausa = useRef(null)
  const abierto = useRef(false)
  const mandar = (v) => {
    clearTimeout(pausa.current)
    if (v === null) { onBorrador?.(null); return }
    pausa.current = setTimeout(() => onBorrador?.(v), 120)
  }
  /* Si la fila desaparece a medio corregir (otra actividad, se aprobó desde
     otro aparato), el borrador no puede quedar colgado en el proyector. */
  useEffect(() => () => { if (abierto.current) { clearTimeout(pausa.current); onBorrador?.(null) } }, [])
  const abrir = () => { setNuevo(texto); setEditando(true); abierto.current = true; mandar(texto) }
  const cerrar = () => { setEditando(false); abierto.current = false; mandar(null) }
  const guardar = () => { onCorregir?.(nuevo); cerrar() }
  /* Enter guarda y Esc cancela: se corrige en el momento, con el curso
     esperando, así que nada de buscar botones. */
  const teclas = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); guardar() }
    if (e.key === 'Escape') { e.preventDefault(); cerrar() }
  }
  const escribir = (v) => { setNuevo(v); mandar(v) }
  /* Lo que se está corrigiendo en otro aparato se muestra contra el texto del
     estudiante, como quedará: tachado lo que sale, subrayado lo que entra. */
  const base = corregida && original ? original : texto
  const campo = 'w-full rounded-lg border-2 border-teal-600 px-2 py-1.5 font-semibold text-slate-800 outline-none'

  return (
    <li className={`rounded-lg border px-3 py-2 ${groseria ? 'border-rose-200 bg-rose-50' : estado ? ESTADOS[estado].tarjeta : tachada ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}
      style={estado ? { borderLeft: `5px solid ${ESTADOS[estado].barra}` } : undefined}>
      {editando ? (
        <>
          {unaLinea
            ? <input value={nuevo} maxLength={max} autoFocus aria-label={t('corregir')} onChange={(e) => escribir(e.target.value)} onKeyDown={teclas} className={campo} />
            : <textarea value={nuevo} maxLength={max} rows={3} autoFocus aria-label={t('corregir')} onChange={(e) => escribir(e.target.value)} onKeyDown={teclas} className={campo} />}
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-xs text-slate-500">{t('corregirAyuda')}</span>
            <span className="flex-1" />
            {boton(t('cancelar'), 'border border-slate-300 text-slate-700', cerrar)}
            {boton(t('guardar'), 'bg-teal-700 text-white', guardar)}
          </div>
        </>
      ) : (
        <>
          {encabezado}
          {enVivo !== null
            ? <Cambios antes={base} despues={enVivo} className="font-semibold text-slate-800" />
            : corregida
            ? <Cambios antes={original} despues={texto} className={`font-semibold ${apagada ? 'text-slate-500' : 'text-slate-800'} ${tachada ? 'opacity-60' : ''}`} />
            : <p className={`font-semibold break-words ${tachada ? 'text-slate-500 line-through' : apagada ? 'text-slate-500' : 'text-slate-800'}`}>{texto}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {estado && estado !== 'descartada' && (
              <span className={`text-xs font-bold ${ESTADOS[estado].etiqueta}`}>
                {estado === 'pendiente' ? t('porRevisar') : <><Icon name="check" className="mr-1" />{t('enPantalla')}</>}
              </span>
            )}
            {enVivo !== null && <span className="text-xs font-bold text-teal-800 animate-pulse"><Icon name="pencil" className="mr-1" />{t('corrigiendo')}</span>}
            {pie}
            {groseria && <span className="text-xs font-bold text-rose-700">{t('filtro')}</span>}
            <span className="flex-1" />
            {onCorregir && boton(<><Icon name="pencil" className="mr-1" />{t('corregir')}</>, 'border border-slate-300 text-slate-700', abrir)}
            {onCorregir && corregida && boton(t('quitarCorreccion'), 'border border-slate-300 text-slate-700', () => onCorregir(''))}
            {acciones}
          </div>
        </>
      )}
    </li>
  )
}
