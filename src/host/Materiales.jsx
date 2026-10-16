/* ============================================================================
   MIS MATERIALES
   ----------------------------------------------------------------------------
   Para preparar en casa, con calma, sin abrir una sala: los estudiantes no
   tienen dónde entrar todavía y no hace falta un PIN. En clase se abre la sala
   y se carga el material con un clic.

   Cada material lleva su idioma: uno de inglés deja la sala en inglés al
   cargarlo. Los cambios se guardan solos, con una pausa, igual que al preparar
   la sala.
   ========================================================================== */
import { useEffect, useRef, useState } from 'react'
import { useStore, useUser, useValue } from '../net/hooks.js'
import { isOnline } from '../net/store.js'
import { Button, Center, Logo } from '../ui.jsx'
import { IDIOMA_KEY, ProveedorIdioma, SelectorIdioma, guardado, idiomaDelNavegador, traducir, useT, valido } from '../i18n.jsx'
import { LARGO_OBJETIVO, LARGO_TITULO, listaDeMateriales, idMaterialNuevo, materialParaGuardar, rutaMaterial, rutaMateriales } from '../live/materiales.js'
import { Editor } from './Editor.jsx'
import { Cuenta, iniciarSesion } from './Cuenta.jsx'
import { BotonTema, useTema } from '../tema.jsx'
import { SelectorFondo } from '../live/SelectorFondo.jsx'

export default function Materiales() {
  const tema = useTema('liveboard-tema')
  const store = useStore()
  const user = useUser(store)
  /* El idioma de esta página es el de la interfaz; el de cada material se
     elige dentro de él. */
  const [idioma, setIdioma] = useState(() => valido(guardado.get(IDIOMA_KEY) || idiomaDelNavegador()))
  const [abierto, setAbierto] = useState(null)

  if (!store || user === undefined) return <Center>{traducir(idioma, 'cargando')}</Center>

  return (
    <ProveedorIdioma value={idioma}>
      <div className="min-h-screen flex flex-col">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3 bg-white border-b border-slate-200">
          <a href="#"><Logo className="text-2xl" /></a>
          <span className="text-slate-400">·</span>
          <span className="font-bold text-slate-700">{traducir(idioma, 'misMateriales')}</span>
          <span className="flex-1" />
          <SelectorIdioma idioma={idioma} onCambiar={(l) => { setIdioma(l); guardado.set(IDIOMA_KEY, l) }} />
          <BotonTema tema={tema} etiqueta={traducir(idioma, tema.oscuro ? 'usarClaro' : 'usarOscuro')} />
          <Cuenta store={store} user={user} />
        </header>
        <main className="flex-1 w-full max-w-3xl mx-auto p-6">
          {!user
            ? <SinSesion store={store} />
            : abierto
              ? <EditarMaterial key={abierto} store={store} user={user} id={abierto} onVolver={() => setAbierto(null)} />
              : <Lista store={store} user={user} onAbrir={setAbierto} />}
        </main>
      </div>
    </ProveedorIdioma>
  )
}

function SinSesion({ store }) {
  const t = useT()
  return (
    <div className="rounded-3xl bg-white border border-slate-200 p-8 text-center flex flex-col items-center gap-4">
      <p className="text-slate-700">{t('materialesAyuda')}</p>
      <Button onClick={() => iniciarSesion(store, t.idioma)}>{t('iniciarSesion')}</Button>
    </div>
  )
}

function Lista({ store, user, onAbrir }) {
  const t = useT()
  const raw = useValue(store, rutaMateriales(user.uid))
  if (raw === undefined) return <Center>{t('cargando')}</Center>
  const materiales = listaDeMateriales(raw)

  const crear = async () => {
    const id = idMaterialNuevo()
    await store.set(rutaMaterial(user.uid, id), materialParaGuardar({ nombre: '', idioma: t.idioma, actividades: [] }, store.stamp()))
    onAbrir(id)
  }
  const borrar = async (m) => {
    if (!confirm(t('confirmarBorrar', m.nombre || t('sinNombre')))) return
    await store.remove(rutaMaterial(user.uid, m.id))
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-slate-600">{t('materialesAyuda')}</p>
      {!isOnline && <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{t('materialesLocal')}</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={crear}>{t('nuevoMaterial')}</Button>
        <a href="#/host"><Button variant="ghost">{t('abrirSalaCon')}</Button></a>
      </div>
      {materiales.length === 0 ? (
        <p className="text-slate-500">{t('sinMateriales')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {materiales.map(m => (
            <li key={m.id} className="rounded-2xl bg-white border border-slate-200 p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 truncate">{m.nombre || t('sinNombre')}</p>
                <p className="text-sm text-slate-500">{t('nActividades', m.actividades.length)} · {m.idioma.toUpperCase()}</p>
              </div>
              <Button variant="ghost" className="!px-3 !py-1.5 text-sm" onClick={() => onAbrir(m.id)}>{t('editar')}</Button>
              <button onClick={() => borrar(m)} className="px-2 text-sm text-rose-700">{t('borrar')}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EditarMaterial({ store, user, id, onVolver }) {
  const t = useT()
  const ruta = rutaMaterial(user.uid, id)
  const raw = useValue(store, ruta)
  /* Lo borraron desde otra pestaña: de vuelta a la lista. */
  useEffect(() => { if (raw === null) onVolver() }, [raw])
  if (raw === undefined) return <Center>{t('cargando')}</Center>
  if (raw === null) return null
  const [m] = listaDeMateriales({ [id]: raw })
  return <Formulario store={store} ruta={ruta} inicial={m} onVolver={onVolver} />
}

/* Se copia el material al montarse y se edita en local: escribir en la base con
   cada tecla hace saltar el cursor cuando vuelve el eco. */
function Formulario({ store, ruta, inicial, onVolver }) {
  const t = useT()
  const [nombre, setNombre] = useState(inicial.nombre)
  const [objetivo, setObjetivo] = useState(inicial.objetivo)
  const [idioma, setIdioma] = useState(inicial.idioma)
  const [fondo, setFondo] = useState(inicial.fondo)
  const [lista, setLista] = useState(inicial.actividades)
  const [estado, setEstado] = useState('guardado')
  const primera = useRef(true)

  useEffect(() => {
    if (primera.current) { primera.current = false; return }
    setEstado('guardando')
    const espera = setTimeout(async () => {
      await store.set(ruta, materialParaGuardar({ nombre, objetivo, idioma, fondo, actividades: lista }, store.stamp()))
      setEstado('guardado')
    }, 500)
    return () => clearTimeout(espera)
  }, [nombre, objetivo, idioma, fondo, lista])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button onClick={onVolver} className="text-sm font-semibold text-teal-800">{t('volver')}</button>
        <span className="flex-1" />
        <span role="status" className="text-sm text-slate-500">{estado === 'guardando' ? t('guardando') : t('guardado')}</span>
      </div>
      <div className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold text-slate-700">{t('nombreMaterial')}</span>
          <input value={nombre} maxLength={LARGO_TITULO} placeholder={t('nombreMaterialEj')} onChange={(e) => setNombre(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 font-semibold focus:border-teal-600 outline-none" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold text-slate-700">{t('objetivoClase')}</span>
          <textarea value={objetivo} maxLength={LARGO_OBJETIVO} rows={2} placeholder={t('objetivoClaseEj')} onChange={(e) => setObjetivo(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-600 outline-none resize-none" />
          <span className="text-xs text-slate-500">{t('estaClaseAyuda')}</span>
        </label>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-700">{t('idiomaSala')}</p>
            <p className="text-xs text-slate-500">{t('idiomaAyuda')}</p>
          </div>
          <SelectorIdioma idioma={idioma} onCambiar={setIdioma} />
        </div>
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-sm font-bold text-slate-700">{t('fondoProyector')}</p>
            <p className="text-xs text-slate-500">{t('fondoAyuda')}</p>
          </div>
          <SelectorFondo valor={fondo} onCambiar={setFondo} />
        </div>
        <p className="text-xs text-slate-500">{t('guardadoAuto')}</p>
      </div>
      {/* Las preguntas se escriben en el idioma del material: los textos de la
          interfaz siguen el de la página. */}
      <Editor lista={lista} setLista={setLista} />
    </div>
  )
}
