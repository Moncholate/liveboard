/* Imitación mínima de Realtime Database sobre localStorage + BroadcastChannel.
   El árbol completo vive en localStorage; cada escritura relee, aplica, guarda y
   avisa a las otras pestañas. Solo para probar en un navegador. */
const KEY = 'liveboard-local-db'
const segs = (p) => p.split('/').filter(Boolean)

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
}

function getAt(tree, path) {
  let node = tree
  for (const k of segs(path)) {
    if (node == null || typeof node !== 'object') return null
    node = node[k]
  }
  return node === undefined ? null : node
}

function setAt(tree, path, value) {
  const ks = segs(path)
  if (!ks.length) return value ?? {}
  let node = tree
  for (const k of ks.slice(0, -1)) {
    if (node[k] == null || typeof node[k] !== 'object') node[k] = {}
    node = node[k]
  }
  if (value == null) delete node[ks.at(-1)]
  else node[ks.at(-1)] = JSON.parse(JSON.stringify(value))
  return tree
}

export function createLocalStore() {
  const channel = new BroadcastChannel('liveboard-local')
  const listeners = new Set()

  function notify() {
    const tree = load()
    for (const l of listeners) {
      const json = JSON.stringify(getAt(tree, l.path))
      if (json !== l.last) { l.last = json; l.cb(JSON.parse(json)) }
    }
  }
  /* El aviso de otra pestaña puede llegar antes que su escritura en
     localStorage (cada pestaña es otro proceso): leer de inmediato perdía ese
     cambio, y un celular se quedaba en «Respuesta enviada» con la pregunta ya
     revelada (19-oct-2026). Se relee un momento después; notify no repite lo
     que no cambió. */
  channel.onmessage = () => {
    notify()
    setTimeout(notify, 60)
    setTimeout(notify, 250)
  }

  function write(mutate) {
    const tree = mutate(load())
    localStorage.setItem(KEY, JSON.stringify(tree))
    channel.postMessage('changed')
    notify()
    return Promise.resolve()
  }

  return {
    online: false,
    get: (path) => Promise.resolve(getAt(load(), path)),
    set: (path, value) => write((t) => setAt(t, path, value)),
    update: (path, values) =>
      write((t) => Object.entries(values).reduce((acc, [k, v]) => setAt(acc, `${path}/${k}`, v), t)),
    remove: (path) => write((t) => setAt(t, path, null)),
    listen(path, cb) {
      const l = { path, cb, last: undefined }
      listeners.add(l)
      setTimeout(() => {
        if (!listeners.has(l)) return
        l.last = JSON.stringify(getAt(load(), path))
        cb(JSON.parse(l.last))
      }, 0)
      return () => listeners.delete(l)
    },
    /* Sin Firebase no hay cuentas: el navegador es "el docente" y su biblioteca
       vive en localStorage junto al resto. */
    onUser(cb) {
      setTimeout(() => cb({ uid: 'local', name: 'Modo local', photo: null }), 0)
      return () => {}
    },
    signIn: async () => ({ uid: 'local', name: 'Modo local', photo: null }),
    signOut: async () => {},
    now: () => Date.now(),
    stamp: () => Date.now(),
    presence(path) {
      const off = () => this.set(path, false)
      this.set(path, true)
      addEventListener('pagehide', off)
      return () => removeEventListener('pagehide', off)
    },
  }
}
