/* ============================================================================
   ACHICAR UNA FOTO EN EL CELULAR
   ----------------------------------------------------------------------------
   Una foto de celular pesa 3–5 MB; a la base van dos JPEG chicos (tablero.js):
   uno para el proyector y otro para los celulares y el PDF. Se achica aquí,
   antes de subir nada, así que por la WiFi del colegio viaja poco.

   La orientación: createImageBitmap y los <img> de hoy ya la respetan (EXIF),
   así que una foto vertical no sale acostada.
   ========================================================================== */
import { LIMITES_TABLERO, medidasFoto } from './tablero.js'

async function abrir(archivo) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(archivo, { imageOrientation: 'from-image' }) } catch { /* abajo, con <img> */ }
  }
  const url = URL.createObjectURL(archivo)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

/* Dibuja la foto con el lado mayor en `max` y baja la calidad hasta que
   quepa en `tope` caracteres. Si ni así cabe, la achica un poco más. */
function jpeg(fuente, max, tope) {
  const ancho0 = fuente.width, alto0 = fuente.height
  for (let lado = max; lado >= 160; lado = Math.round(lado * 0.8)) {
    const { ancho, alto } = medidasFoto(ancho0, alto0, lado)
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    const ctx = lienzo.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, ancho, alto)
    ctx.drawImage(fuente, 0, 0, ancho, alto)
    for (const calidad of [0.8, 0.7, 0.6, 0.5]) {
      const datos = lienzo.toDataURL('image/jpeg', calidad)
      if (datos.length <= tope) return datos
    }
  }
  throw new Error('foto demasiado grande')
}

/** { grande, chica }: los dos data URL listos para guardar. */
export async function prepararFoto(archivo) {
  const fuente = await abrir(archivo)
  try {
    return {
      grande: jpeg(fuente, LIMITES_TABLERO.fotoGrande, LIMITES_TABLERO.maxGrande),
      chica: jpeg(fuente, LIMITES_TABLERO.fotoChica, LIMITES_TABLERO.maxChica),
    }
  } finally {
    fuente.close?.()
  }
}
