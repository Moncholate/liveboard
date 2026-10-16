/* ============================================================================
   LOS RESULTADOS, COMO SE PROYECTAN
   ----------------------------------------------------------------------------
   Los usa el proyector (grandes) y el celular del docente (`chico`). Ninguno
   recibe nombres: lo que se dibuja aquí lo ve todo el curso.
   ========================================================================== */
import { ALTERNATIVAS, borradorVigente, conteoEncuesta, estadisticaEscala, nube, partirEnHuecos, resultadoRanking, tamanoEnNube } from './logic.js'
import { CARCASA, CARCASA_INT, LAMPARA, TINTA_LAMPARA, calibracion, formaMuro, lecturaSemaforo, tarjetasMuro } from './cierres.js'
import { casillasDe, claveDe, palabrasDe, progreso, rejilla, umbral } from './crucigrama.js'
import { capsula, claveSopa, filasDe, palabrasSopa } from './sopa.js'
import { useT } from '../i18n.jsx'
import { Cambios } from './Cambios.jsx'
import { Icon } from '../icons.jsx'

/* Colores de la nube: los de las alternativas, en tonos que se leen sobre
   blanco. Se asignan por la clave, no por la posición, para que una palabra no
   cambie de color cada vez que llega una respuesta nueva. */
const COLORES_NUBE = ['text-violet-700', 'text-teal-700', 'text-orange-700', 'text-pink-700', 'text-sky-700', 'text-slate-800']
const colorDe = (clave) => COLORES_NUBE[[...clave].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 997, 7) % COLORES_NUBE.length]

export function Nube({ respuestas, moderacion, correcciones, chico = false }) {
  const t = useT()
  const visibles = nube(respuestas, moderacion, correcciones).filter(p => !p.oculta)
  if (!visibles.length) return <Vacio chico={chico}>{t('vacioNube')}</Vacio>
  const max = visibles[0].cuenta
  /* La más repetida al centro: se reparten alternando a cada lado. */
  const orden = []
  visibles.forEach((p, i) => (i % 2 ? orden.push(p) : orden.unshift(p)))
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 leading-none">
      {orden.map(p => (
        <span key={p.clave} title={`${p.cuenta}`}
          className={`font-extrabold animate-pop ${colorDe(p.clave)}`}
          style={{ fontSize: `${tamanoEnNube(p.cuenta, max) * (chico ? 0.45 : 1)}rem` }}>
          {p.texto}
        </span>
      ))}
    </div>
  )
}

export function Encuesta({ actividad, respuestas, chico = false }) {
  const alts = actividad.alternativas || []
  const { votos, total } = conteoEncuesta(respuestas, alts.length)
  return (
    <div className={`w-full flex flex-col ${chico ? 'gap-2' : 'gap-4'}`}>
      {alts.map((texto, i) => {
        const a = ALTERNATIVAS[i]
        const pct = total ? Math.round((votos[i] / total) * 100) : 0
        return (
          <div key={i} className="flex items-center gap-3">
            <span className={`shrink-0 grid place-items-center rounded-lg text-white font-black ${a.solido} ${chico ? 'w-7 h-7 text-sm' : 'w-12 h-12 text-2xl'}`}>{a.letra}</span>
            <div className="flex-1 min-w-0">
              <div className={`flex justify-between gap-3 font-bold text-slate-800 ${chico ? 'text-sm' : 'text-2xl mb-1'}`}>
                <span className="truncate">{texto}</span>
                <span className="tabular-nums shrink-0">{votos[i]} · {pct}%</span>
              </div>
              <div className={`w-full rounded-full bg-slate-100 overflow-hidden ${chico ? 'h-2' : 'h-5'}`}>
                <div className={`h-full rounded-full transition-all duration-500 ${a.solido}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function Escala({ respuestas, chico = false }) {
  const t = useT()
  const { votos, total, promedio } = estadisticaEscala(respuestas)
  const max = Math.max(1, ...votos)
  return (
    <div className="w-full flex flex-col items-center">
      <p className={`font-black text-slate-900 tabular-nums ${chico ? 'text-2xl mb-2' : 'text-7xl mb-4'}`}>
        {promedio == null ? '–' : promedio.toLocaleString(t.idioma === 'en' ? 'en-US' : 'es-CL')}
        <span className={`font-bold text-slate-500 ${chico ? 'text-sm' : 'text-2xl'}`}> / 5</span>
      </p>
      <div className={`w-full flex items-end justify-center ${chico ? 'gap-2 h-24' : 'gap-6 h-[32vh]'}`}>
        {votos.map((v, i) => (
          <div key={i} className="flex-1 max-w-[9rem] h-full flex flex-col justify-end items-center">
            <span className={`font-bold text-slate-700 tabular-nums ${chico ? 'text-xs' : 'text-xl mb-1'}`}>{v}</span>
            <div className="w-full rounded-t-lg bg-teal-600 transition-all duration-500"
              style={{ height: `${(v / max) * 100}%`, minHeight: v ? 6 : 0 }} />
          </div>
        ))}
      </div>
      <div className={`w-full flex justify-center border-t-2 border-slate-200 ${chico ? 'gap-2 pt-1' : 'gap-6 pt-2'}`}>
        {t('escala').map((r, i) => (
          <div key={i} className="flex-1 max-w-[9rem] text-center">
            <p className={`font-black text-slate-900 ${chico ? 'text-sm' : 'text-3xl'}`}>{i + 1}</p>
            {!chico && <p className="text-base text-slate-500">{r}</p>}
          </div>
        ))}
      </div>
      {total === 0 && !chico && <p className="mt-4 text-slate-500">{t('sinRespuestas')}</p>}
    </div>
  )
}

/* Solo las aprobadas, y sin nombres. */
/* `sobreFondo`: las tarjetas van directo sobre el fondo del proyector, sin
   panel, así que llevan sombra para despegarse de él.
   Una respuesta CORREGIDA muestra qué cambió, tachado y subrayado (8-oct-2026:
   el docente quiere que el curso aprenda del error; como no lleva nombre, no
   expone a nadie). Con `verCambios` apagado se ve solo la versión limpia, con
   un ✎ discreto. */
/* `prefijo`: lo que va antes de cada texto, apagado («…porque» en Antes /
   Ahora). Los lados que escribió cada uno (r.antes, r.ahora) van arriba. */
export function Abiertas({ aprobadas, chico = false, sobreFondo = false, verCambios = true, prefijo = null, borrador = null }) {
  const t = useT()
  /* CORREGIR EN VIVO: la tarjeta que el docente está corrigiendo (en la tablet
     o aquí) cambia mientras escribe, con un borde que late. */
  const vivo = (r) => borradorVigente(borrador, `a:${r.pid}`, Date.now())
  if (!aprobadas.length) return <Vacio chico={chico}>{t('vacioAbiertas')}</Vacio>
  return (
    <div className={`w-full grid ${chico ? 'gap-2' : 'gap-4 sm:grid-cols-2 xl:grid-cols-3'}`}>
      {aprobadas.map(r => (
        <div key={r.pid} className={`relative rounded-2xl bg-white border font-semibold text-slate-800 animate-pop ${vivo(r) !== null ? 'border-teal-600 ring-4 ring-teal-600/30' : 'border-slate-200'} ${chico ? 'p-2 text-sm' : 'p-5 text-2xl'} ${sobreFondo ? 'shadow-lg' : ''}`}>
          {(r.antes || r.ahora) && <Lados antes={r.antes} ahora={r.ahora} chico={chico} />}
          {prefijo && <span className="font-normal text-slate-500">{prefijo} </span>}
          {vivo(r) !== null
            ? (verCambios ? <Cambios antes={r.original} despues={vivo(r)} /> : vivo(r))
            : r.corregida && verCambios ? <Cambios antes={r.original} despues={r.texto} /> : r.texto}
          {vivo(r) !== null && <span className={`block font-bold text-teal-800 animate-pulse ${chico ? 'text-xs' : 'text-base mt-1'}`}><Icon name="pencil" className="mr-1" />{t('corrigiendo')}</span>}
          {r.corregida && !verCambios && (
            <span title={t('corregida')} aria-label={t('corregida')}
              className={`absolute text-slate-400 font-normal ${chico ? 'top-1 right-1.5 text-xs' : 'top-2 right-3 text-base'}`}><Icon name="pencil" /></span>
          )}
        </div>
      ))}
    </div>
  )
}

/* El orden del curso: primero el que juntó más puntos. La barra es cuánto se
   acerca a «todos lo pusieron primero», y el puesto medio dice lo mismo en
   palabras. */
export function Ranking({ actividad, respuestas, chico = false }) {
  const t = useT()
  const alts = actividad.alternativas || []
  const { filas, total, maximo } = resultadoRanking(respuestas, alts.length)
  const numero = (x) => x.toLocaleString(t.idioma === 'en' ? 'en-US' : 'es-CL')
  return (
    <div className={`w-full flex flex-col ${chico ? 'gap-2' : 'gap-4'}`}>
      {filas.map((f) => {
        const pct = maximo ? Math.round((f.puntos / maximo) * 100) : 0
        return (
          <div key={f.i} className="flex items-center gap-3 transition-all">
            <span className={`shrink-0 grid place-items-center rounded-lg font-black ${f.puesto === 1 && total ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700'} ${chico ? 'w-7 h-7 text-sm' : 'w-12 h-12 text-2xl'}`}>{f.puesto}</span>
            <div className="flex-1 min-w-0">
              <div className={`flex justify-between gap-3 font-bold text-slate-800 ${chico ? 'text-sm' : 'text-2xl mb-1'}`}>
                <span className="truncate">{alts[f.i]}</span>
                {f.promedio != null && <span className={`shrink-0 font-semibold text-slate-500 tabular-nums ${chico ? 'text-xs' : 'text-lg'}`}>{t('puestoMedio', numero(f.promedio))}</span>}
              </div>
              <div className={`w-full rounded-full bg-slate-100 overflow-hidden ${chico ? 'h-2' : 'h-5'}`}>
                <div className="h-full rounded-full bg-teal-600 transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        )
      })}
      <p className={`text-center text-slate-500 ${chico ? 'text-xs' : 'text-lg'}`}>{total ? t('ordenaron', total) : t('sinRespuestas')}</p>
    </div>
  )
}

/* Las preguntas aprobadas, sin nombres, de más a menos votadas. Las ya
   respondidas quedan al final, atenuadas: siguen ahí por si alguien quiere
   volver a ellas, pero no compiten con las que faltan. */
export function Preguntas({ aprobadas, chico = false, sobreFondo = false, verCambios = true, borrador = null }) {
  const t = useT()
  const vivo = (q) => borradorVigente(borrador, `q:${q.qid}`, Date.now())
  if (!aprobadas.length) return <Vacio chico={chico}>{t('vacioPreguntas')}</Vacio>
  return (
    <div className={`w-full flex flex-col ${chico ? 'gap-2' : 'gap-3 max-w-5xl mx-auto'}`}>
      {aprobadas.map(q => (
        <div key={q.qid} className={`flex items-center gap-4 rounded-2xl border animate-pop ${q.respondida ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200'} ${chico ? 'p-2 gap-2' : 'p-4'} ${sobreFondo ? 'shadow-lg' : ''}`}>
          <span className={`shrink-0 flex flex-col items-center leading-none font-black tabular-nums ${q.respondida ? 'text-slate-400' : 'text-teal-700'} ${chico ? 'w-8 text-sm' : 'w-14 text-3xl'}`}>
            <span aria-hidden="true" className={chico ? 'text-xs' : 'text-lg'}>▲</span>
            {q.votos}
            <span className="sr-only">{t('votosN', q.votos)}</span>
          </span>
          {vivo(q) !== null
            ? <p className={`flex-1 min-w-0 break-words font-semibold text-slate-800 ${chico ? 'text-sm' : 'text-2xl'}`}>
                {verCambios ? <Cambios antes={q.original} despues={vivo(q)} /> : vivo(q)}
                <span className={`block font-bold text-teal-800 animate-pulse ${chico ? 'text-xs' : 'text-base'}`}><Icon name="pencil" className="mr-1" />{t('corrigiendo')}</span>
              </p>
            : q.corregida && verCambios
            ? <Cambios antes={q.original} despues={q.texto} className={`flex-1 min-w-0 font-semibold ${q.respondida ? 'text-slate-500' : 'text-slate-800'} ${chico ? 'text-sm' : 'text-2xl'}`} />
            : <p className={`flex-1 min-w-0 break-words font-semibold ${q.respondida ? 'text-slate-500' : 'text-slate-800'} ${chico ? 'text-sm' : 'text-2xl'}`}>{q.texto}</p>}
          {q.respondida && <span className={`shrink-0 font-bold text-slate-500 ${chico ? 'text-xs' : 'text-base'}`}><Icon name="check" className="mr-1" />{t('respondida')}</span>}
        </div>
      ))}
    </div>
  )
}

/* ── Cierres ──────────────────────────────────────────────────────────── */

/* Un molde con los huecos apagados, como en el Belt: en la misma tinta que las
   palabras compiten con ellas, y lo que hay que leer es la frase. */
export function TextoConHuecos({ texto }) {
  return (
    <>
      {partirEnHuecos(texto).map((x, i) => (x.tipo === 'hueco'
        ? <span key={i} className="text-slate-400">{x.valor}</span>
        : <span key={i}>{x.valor}</span>))}
    </>
  )
}

/* Lo que pensaba (tachado: quedó atrás) → lo que pienso ahora. */
function Lados({ antes, ahora, chico }) {
  return (
    <p className={`mb-1 ${chico ? 'text-xs' : 'text-xl'}`}>
      {antes && <span className="text-slate-500 line-through decoration-2">{antes}</span>}
      {antes && ahora && <span className="text-slate-400"> → </span>}
      {ahora && <span className="text-slate-900">{ahora}</span>}
    </p>
  )
}

/* El SEMÁFORO del cierre, como el del Belt: una carcasa oscura con tres
   lámparas que cambian de brillo y de tamaño a la vez (un proyector con luz
   aplasta el brillo; el tamaño sobrevive). El hueco de cada lámpara mide
   siempre lo máximo, para que las tres no se muevan en cada voto. */
export function Semaforo({ respuestas, chico = false }) {
  const t = useT()
  const r = lecturaSemaforo(respuestas)
  const lado = chico ? '2.25rem' : 'min(11vh, 6.5rem)'
  return (
    <div className={`w-full flex flex-col items-center ${chico ? 'gap-2' : 'gap-5'}`}>
      <div className={`w-full max-w-4xl rounded-3xl ${chico ? 'p-3' : 'px-8 py-6'}`} style={{ background: CARCASA }}>
        <div className={`flex flex-col ${chico ? 'gap-2' : 'gap-4'}`}>
          {r.luces.map(l => (
            <div key={l.id} className={`flex items-center ${chico ? 'gap-3' : 'gap-6'}`}>
              <div className="relative shrink-0 grid place-items-center" style={{ width: lado, height: lado }}>
                <span aria-hidden="true" className="absolute inset-0 rounded-full" style={{ background: CARCASA_INT, border: '1px solid rgba(255,255,255,.07)' }} />
                <span aria-hidden="true" className="relative rounded-full transition-all duration-500"
                  style={{
                    width: `calc(${lado} * ${l.tamano} * 0.86)`, height: `calc(${lado} * ${l.tamano} * 0.86)`,
                    background: LAMPARA[l.id], opacity: l.brillo,
                    boxShadow: l.brillo > 0.3 ? `0 0 ${Math.round(l.brillo * (chico ? 20 : 60))}px ${LAMPARA[l.id]}` : 'none',
                  }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`font-semibold leading-snug ${chico ? 'text-sm' : 'text-3xl'}`} style={{ color: '#fff' }}>{l.texto}</p>
                <p className={`font-bold tabular-nums ${chico ? 'text-xs' : 'text-2xl'}`} style={{ color: TINTA_LAMPARA[l.id] }}>{l.votos}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className={`text-center font-bold text-slate-900 ${chico ? 'text-sm' : 'text-3xl'}`}>
        {!r.total ? t('sinRespuestas') : r.dominante ? t(`cursoEn_${r.dominante}`) : t('cursoRepartido')}
      </p>
    </div>
  )
}

/* EL MURO: todas las tarjetas a la vista a la vez, porque lo que se ve al
   final es que veinticinco cosas chicas juntas son un avance. Encogen en
   escalones para caber (proyectando, hacer scroll es perderlo). */
export function Muro({ aprobadas, chico = false, sobreFondo = false, verCambios = true }) {
  const t = useT()
  const tarjetas = tarjetasMuro(aprobadas)
  if (!tarjetas.length) return <Vacio chico={chico}>{t('vacioMuro')}</Vacio>
  const f = formaMuro(tarjetas.length)
  return (
    <div className={`w-full flex flex-col ${chico ? 'gap-2' : 'gap-4'}`}>
      {!chico && <p className="text-center text-xl font-bold uppercase tracking-wider text-teal-800">{t('muroTitulo')}</p>}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${chico ? 2 : f.columnas}, minmax(0, 1fr))` }}>
        {tarjetas.map(c => (
          <div key={c.clave} className={`relative rounded-xl border border-teal-200 bg-teal-50 text-teal-900 font-semibold break-words animate-pop ${chico ? 'px-2 py-1 text-xs' : 'px-3 py-2'} ${sobreFondo ? 'shadow-lg' : ''}`}
            style={chico ? undefined : { fontSize: `calc(2.4rem * ${f.escala})` }}>
            {c.corregida && verCambios ? <Cambios antes={c.original} despues={c.texto} /> : c.texto}
            {c.cuantos > 1 && <span className="ml-1.5 font-black text-teal-700 tabular-nums" style={{ fontSize: '0.7em' }}>×{c.cuantos}</span>}
          </div>
        ))}
      </div>
      <p className={`text-center font-bold text-slate-900 ${chico ? 'text-xs' : 'text-2xl'}`}>{t('logrosN', aprobadas.length)}</p>
    </div>
  )
}

/* Los dos lados que escribió el docente en Antes / Ahora, una vez arriba de
   las respuestas. El de la izquierda tachado: es lo que YA NO se piensa. Un
   lado en blanco se ve como hueco: lo escribe cada uno. */
export function MarcoAntesAhora({ antes, ahora, chico = false }) {
  const t = useT()
  const lado = (rotulo, frase, cola, viejo) => (
    <div className={`flex-1 rounded-xl border ${viejo ? 'border-slate-200 bg-slate-50' : 'border-slate-300 bg-white'} ${chico ? 'p-2' : 'px-5 py-4'}`}>
      <p className={`font-bold uppercase tracking-wider text-slate-500 ${chico ? 'text-[10px]' : 'text-sm'}`}>{rotulo}</p>
      <p className={`font-bold leading-tight ${chico ? 'text-sm' : 'text-3xl mt-1'} ${!frase ? 'text-slate-400' : viejo ? 'text-slate-600 line-through decoration-2' : 'text-slate-900'}`}>
        {frase || '______'}
      </p>
      <p className={`text-slate-500 ${chico ? 'text-xs' : 'text-lg mt-1'}`}>{cola}</p>
    </div>
  )
  return (
    <div className={`w-full flex ${chico ? 'gap-2' : 'gap-4'}`}>
      {lado(t('antesPensaba'), antes, t('queEstabaBien'), true)}
      {lado(t('ahoraPienso'), ahora, `${t('porque')} ______`, false)}
    </div>
  )
}

/* Las consignas de la apuesta, numeradas: se apuesta sobre «cuántas de estas»
   y hay que poder señalar cuál falló. */
/* `medio`: en el proyector al comparar, debajo de los resultados. */
export function Consignas({ consignas, chico = false, medio = false }) {
  const [num, txt] = chico ? ['text-xs', 'text-sm'] : medio ? ['text-lg', 'text-2xl'] : ['text-2xl', 'text-3xl']
  return (
    <ol className={`w-full max-w-5xl mx-auto flex flex-col ${chico ? 'gap-1' : 'gap-2'}`}>
      {consignas.map((c, i) => (
        <li key={i} className="flex items-baseline gap-3 border-b border-slate-200 pb-1.5 last:border-b-0">
          <span className={`font-bold text-slate-500 tabular-nums shrink-0 ${num}`}>{i + 1}</span>
          <span className={`font-semibold text-slate-900 ${txt}`}>{c}</span>
        </li>
      ))}
    </ol>
  )
}

/* LA APUESTA en el proyector, por fase. Al apostar, las consignas
   DESAPARECEN: con la lista delante, apostar se vuelve revisarlas una por una.
   Al comparar se ve cuántos acertaron su apuesta, nunca quiénes. */
export function Apuesta({ consignas, respuestas, fase, chico = false }) {
  const t = useT()
  const n = consignas.length
  if (fase === 'escribir') {
    return (
      <div className={`w-full flex flex-col ${chico ? 'gap-2' : 'gap-5'}`}>
        <p className={`text-center font-bold uppercase tracking-wider text-teal-800 ${chico ? 'text-xs' : 'text-xl'}`}>{t('escribelas', n)}</p>
        <Consignas consignas={consignas} chico={chico} />
      </div>
    )
  }
  const c = calibracion(respuestas, n)
  if (fase === 'apostar') {
    return (
      <div className={`w-full flex flex-col items-center text-center ${chico ? 'gap-1' : 'gap-4'}`}>
        <p className={`font-black text-slate-900 leading-tight ${chico ? 'text-base' : 'text-5xl'}`}>{t('cuantasCrees', n)}</p>
        {!chico && <p aria-hidden="true" className="text-[9rem] leading-none font-black text-slate-400 select-none">?</p>}
        <p className={`text-slate-500 ${chico ? 'text-xs' : 'text-2xl'}`}>{t('sinMirar')}</p>
        <p className={`font-bold text-slate-700 tabular-nums ${chico ? 'text-sm' : 'text-3xl'}`}>{t('apostaronN', c.apostaron)}</p>
      </div>
    )
  }
  const numero = (x) => x.toLocaleString(t.idioma === 'en' ? 'en-US' : 'es-CL')
  const bloques = [['exacto', c.exactos], ['deMas', c.deMas], ['deMenos', c.deMenos]]
  return (
    <div className={`w-full flex flex-col ${chico ? 'gap-2' : 'gap-5'}`}>
      {!chico && <Consignas consignas={consignas} medio />}
      <div className={`grid grid-cols-3 ${chico ? 'gap-2' : 'gap-4'} w-full max-w-5xl mx-auto`}>
        {bloques.map(([id, cuantos]) => (
          <div key={id} className={`rounded-2xl border border-slate-200 bg-white text-center ${chico ? 'p-2' : 'p-5'}`}>
            <p className={`font-black text-slate-900 tabular-nums ${chico ? 'text-xl' : 'text-7xl'}`}>{cuantos}</p>
            <p className={`font-semibold text-slate-600 ${chico ? 'text-[11px] leading-tight' : 'text-xl mt-1'}`}>{t(`calib_${id}`)}</p>
          </div>
        ))}
      </div>
      <p className={`text-center text-slate-500 ${chico ? 'text-xs' : 'text-xl'}`}>
        {t('compararonN', c.compararon, c.apostaron)}
        {c.compararon > 0 && ` · ${t('promediosApuesta', numero(c.promApuesta), numero(c.promTuve))}`}
      </p>
      {!chico && <p className="text-center text-3xl font-bold text-slate-900">{t('enCualSobro')}</p>}
    </div>
  )
}

/* ── Crucigrama ──────────────────────────────────────────────────────── */

/* LA CUADRÍCULA. `llenas` = casillas con la letra a la vista; `apagadas` =
   casillas a la vista pero en gris (en el celular: lo que destapó la pantalla,
   que no es mérito propio). `onNumero(f, c)`: tocar el número destapa las
   palabras que empiezan ahí (solo en el proyector). */
export function Grilla({ ancho, alto, palabras, llenas, apagadas = new Set(), lado, onNumero }) {
  const { celdas, numeros } = rejilla(ancho, alto, palabras)
  return (
    <div aria-hidden="true" className="grid w-max" style={{ gridTemplateColumns: `repeat(${ancho}, ${lado})` }}>
      {celdas.map((fila, f) => fila.map((letra, c) => {
        const num = letra ? numeros[`${f},${c}`] : null
        const k = `${f},${c}`
        const ver = llenas.has(k) || apagadas.has(k)
        const Casilla = num && onNumero ? 'button' : 'div'
        return (
          <Casilla key={k} {...(Casilla === 'button' ? { type: 'button', tabIndex: -1, onClick: () => onNumero(f, c) } : {})}
            className={letra ? 'relative bg-white border border-slate-400' : ''} style={{ width: lado, height: lado, padding: 0 }}>
            {num && (
              <span className="absolute top-0 left-0.5 font-bold leading-none tabular-nums text-slate-500"
                style={{ fontSize: `max(9px, calc(${lado} * 0.3))` }}>{num}</span>
            )}
            {letra && ver && (
              <span className={`absolute inset-0 grid place-items-center font-bold ${llenas.has(k) ? 'text-slate-900' : 'text-slate-400'}`}
                style={{ fontSize: `calc(${lado} * 0.55)` }}>{letra}</span>
            )}
          </Casilla>
        )
      }))}
    </div>
  )
}

/* EL CRUCIGRAMA DEL CURSO, en el proyector. Bajo cada pista, cuántos la
   tienen y nunca quiénes; una palabra se destapa según la regla de la
   actividad (crucigrama.js), y el docente puede destapar a mano tocando la
   pista o su número. `chico` (celular del docente): solo las pistas. */
export function Crucigrama({ actividad, respuestas, destapadas, conectados, onDestapar, chico = false }) {
  const t = useT()
  const palabras = palabrasDe(actividad)
  const { por, terminaron } = progreso(respuestas, palabras)
  const de = Math.max(conectados || 0, Object.keys(respuestas || {}).length)
  const llenas = new Set(palabras.filter(p => destapadas?.[claveDe(p)] === true).flatMap(casillasDe))
  const modo = actividad.destapar || 'mitad'
  const lado = `max(22px, min(calc(46vw / ${actividad.ancho}), calc(56vh / ${actividad.alto}), 3.75rem))`
  const destaparEn = (f, c) => onDestapar?.(palabras.filter(p => p.fila === f && p.col === c).map(claveDe))

  const lista = (titulo, items) => items.length > 0 && (
    <div className="min-w-0">
      <h3 className={`font-bold uppercase tracking-wider text-slate-500 ${chico ? 'text-xs mb-1' : 'text-base mb-2'}`}>{titulo}</h3>
      <ol className={`flex flex-col ${chico ? 'gap-1.5' : 'gap-2'}`}>
        {items.map(p => {
          const k = claveDe(p)
          const visible = destapadas?.[k] === true
          const n = por[k] || 0
          return (
            <li key={k}>
              <button type="button" disabled={!onDestapar || visible} onClick={() => onDestapar([k])}
                className={`w-full text-left rounded-lg px-1.5 -mx-1.5 py-0.5 ${onDestapar && !visible ? 'hover:bg-slate-100' : ''}`}>
                <span className={`flex gap-2 text-slate-800 ${chico ? 'text-sm' : 'text-xl'}`}>
                  <b className="tabular-nums shrink-0">{p.numero}.</b>
                  <span className="min-w-0 flex-1">
                    {p.pista || <span className="text-slate-400">__________</span>}
                    <span className="ml-1.5 tabular-nums text-slate-500">({p.palabra.length})</span>
                    {visible && <b className="ml-2 text-teal-700">→ {p.original}</b>}
                  </span>
                </span>
                <span className="flex items-center gap-2 mt-0.5 pl-7">
                  <span className="flex-1 max-w-[12rem] h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <span className="block h-full rounded-full bg-teal-600 transition-all duration-500" style={{ width: `${de ? Math.min(100, (n / de) * 100) : 0}%` }} />
                  </span>
                  <span className={`tabular-nums text-slate-500 ${chico ? 'text-xs' : 'text-sm'}`}>{t('laTienen', n, de)}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )

  const pie = (
    <p className={`text-slate-500 ${chico ? 'text-xs' : 'text-lg'}`}>
      {t(`regla_${modo}`, umbral(modo, conectados))} · {t('terminaronN', terminaron)}
    </p>
  )
  const listas = (
    <div className={`min-w-0 flex-1 flex flex-col ${chico ? 'gap-3' : 'gap-5'}`}>
      {lista(t('horizontales'), palabras.filter(p => p.dir === 'h'))}
      {lista(t('verticales'), palabras.filter(p => p.dir === 'v'))}
    </div>
  )
  if (chico) return <div className="flex flex-col gap-3">{pie}{listas}</div>
  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-col lg:flex-row lg:items-start gap-8">
        <div className="overflow-x-auto shrink-0 mx-auto lg:mx-0">
          <Grilla ancho={actividad.ancho} alto={actividad.alto} palabras={palabras} llenas={llenas} lado={lado}
            onNumero={onDestapar ? destaparEn : undefined} />
        </div>
        {listas}
      </div>
      {pie}
    </div>
  )
}

/* ── Sopa de letras ──────────────────────────────────────────────────── */

/* LA CUADRÍCULA DE LA SOPA. Cada palabra se marca con su cápsula, debajo de
   las letras, como en el Belt: pintadas casilla por casilla, dos palabras que
   se tocan se leerían como una sola. `llenas` = claves con cápsula verde
   rellena; `apagadas` = claves con cápsula gris hueca (en el celular: las que
   marcó la pantalla). `ancla` = la primera letra tocada. */
export function SopaGrilla({ filas, palabras, llenas, apagadas = new Set(), ancla = null, lado, onTocar }) {
  const n = filas.length
  return (
    <div className="relative w-max bg-white">
      <svg viewBox={`0 0 ${n} ${n}`} aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none">
        {palabras.filter(p => llenas.has(claveSopa(p)) || apagadas.has(claveSopa(p))).map(p => {
          const mia = llenas.has(claveSopa(p))
          return (
            <path key={p.palabra} d={capsula(p)} fill={mia ? '#10b981' : 'none'} fillOpacity="0.32"
              stroke={mia ? 'none' : '#94a3b8'} strokeWidth="0.09" />
          )
        })}
      </svg>
      <div className="relative grid w-max" style={{ gridTemplateColumns: `repeat(${n}, ${lado})` }}>
        {filas.map((fila, f) => [...fila].map((letra, c) => {
          const esAncla = ancla && ancla.fila === f && ancla.col === c
          const Casilla = onTocar ? 'button' : 'div'
          return (
            <Casilla key={`${f},${c}`} {...(onTocar ? { type: 'button', onClick: () => onTocar(f, c), 'aria-pressed': Boolean(esAncla) } : {})}
              className="grid place-items-center font-bold text-slate-900 border border-slate-300"
              style={{ width: lado, height: lado, padding: 0, fontSize: `calc(${lado} * 0.55)`, background: esAncla ? '#fde68a' : 'transparent', color: esAncla ? '#1e293b' : undefined }}>
              {letra}
            </Casilla>
          )
        }))}
      </div>
    </div>
  )
}

/* LA SOPA DEL CURSO, en el proyector. Bajo cada palabra, cuántos la
   encontraron, nunca quiénes; aparece marcada según la regla de la actividad,
   y el docente puede marcarla a mano tocándola en la lista. `chico` (celular
   del docente): solo la lista. */
export function Sopa({ actividad, respuestas, destapadas, conectados, onDestapar, chico = false }) {
  const t = useT()
  const palabras = palabrasSopa(actividad)
  const { por, terminaron } = progreso(respuestas, palabras, claveSopa)
  const de = Math.max(conectados || 0, Object.keys(respuestas || {}).length)
  const marcadas = new Set(palabras.map(claveSopa).filter(k => destapadas?.[k] === true))
  const modo = actividad.destapar || 'mitad'
  const lado = `max(22px, min(calc(52vw / ${actividad.lado}), calc(52vh / ${actividad.lado})))`

  const listaPalabras = (
    <ul className={`grid ${chico ? 'grid-cols-2 gap-2' : 'grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-3'}`}>
      {palabras.map(p => {
        const k = claveSopa(p)
        const visible = marcadas.has(k)
        const n = por[k] || 0
        return (
          <li key={k}>
            <button type="button" disabled={!onDestapar || visible} onClick={() => onDestapar([k])}
              className={`w-full text-left rounded-lg px-1.5 -mx-1.5 py-0.5 ${onDestapar && !visible ? 'hover:bg-slate-100' : ''}`}>
              <span className={`block font-semibold ${visible ? 'text-teal-700 line-through decoration-2' : 'text-slate-800'} ${chico ? 'text-sm' : 'text-2xl'}`}>{p.original}</span>
              <span className="flex items-center gap-2 mt-0.5">
                <span className="flex-1 max-w-[10rem] h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <span className="block h-full rounded-full bg-teal-600 transition-all duration-500" style={{ width: `${de ? Math.min(100, (n / de) * 100) : 0}%` }} />
                </span>
                <span className={`tabular-nums text-slate-500 ${chico ? 'text-xs' : 'text-sm'}`}>{t('laTienen', n, de)}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
  const pie = (
    <p className={`text-slate-500 ${chico ? 'text-xs' : 'text-lg'}`}>
      {t(`regla_${modo}`, umbral(modo, conectados))} · {t('terminaronN', terminaron)}
    </p>
  )
  if (chico) return <div className="flex flex-col gap-3">{pie}{listaPalabras}</div>
  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-col lg:flex-row lg:items-start gap-8">
        <div className="overflow-x-auto shrink-0 mx-auto lg:mx-0">
          <SopaGrilla filas={filasDe(actividad)} palabras={palabras} llenas={marcadas} lado={lado} />
        </div>
        <div className="min-w-0 flex-1">{listaPalabras}</div>
      </div>
      {pie}
    </div>
  )
}

function Vacio({ children, chico }) {
  return <p className={`text-slate-400 text-center ${chico ? 'text-sm' : 'text-2xl'}`}>{children}</p>
}
