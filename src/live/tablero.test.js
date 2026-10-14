import { describe, expect, it } from 'vitest'
import {
  celularVeElMuro, columnaDe, columnasDe, comentariosDe, comentariosPorPublicacion, esTablero, fotoValida, medidasFoto, opcionesLimpias,
  porColumna, vistaDe, vistasDe,
} from './tablero.js'
import { abiertas, limpiarActividad } from './logic.js'
import { resultadoDe, tieneAlgo } from './resumen.js'

describe('las opciones', () => {
  it('todo apagado es la abierta de siempre', () => {
    expect(esTablero({ tipo: 'abierta', pregunta: 'x' })).toBe(false)
    expect(limpiarActividad({ tipo: 'abierta', pregunta: 'x' })).toEqual({ tipo: 'abierta', pregunta: 'x' })
  })
  it('se guardan solo las prendidas, y solo en la abierta', () => {
    const a = { tipo: 'abierta', pregunta: 'x', foto: true, comentarios: false, nombres: undefined, sinModerar: true }
    expect(opcionesLimpias(a)).toEqual({ foto: true, sinModerar: true })
    expect(esTablero(a)).toBe(true)
    expect(opcionesLimpias({ tipo: 'nube', foto: true })).toEqual({})
    expect(limpiarActividad({ tipo: 'nube', pregunta: 'x', foto: true }).foto).toBeUndefined()
  })
  it('una sola columna no ordena nada; más de 4 se cortan', () => {
    expect(columnasDe({ columnas: ['Hall', '  '] })).toEqual([])
    expect(columnasDe({ columnas: [' There  is ', 'There are'] })).toEqual(['There is', 'There are'])
    expect(columnasDe({ columnas: ['a', 'b', 'c', 'd', 'e'] })).toHaveLength(4)
    expect(esTablero({ tipo: 'abierta', columnas: ['a', 'b'] })).toBe(true)
  })
  it('el celular ve el muro si se comenta o se publica al instante', () => {
    expect(celularVeElMuro({ foto: true })).toBe(false)
    expect(celularVeElMuro({ comentarios: true })).toBe(true)
    expect(celularVeElMuro({ sinModerar: true })).toBe(true)
  })
})

describe('cómo se ordena', () => {
  it('columnas solo si hay', () => {
    expect(vistasDe({ tipo: 'abierta' })).toEqual(['muro', 'cuadricula', 'lista'])
    expect(vistasDe({ tipo: 'abierta', columnas: ['a', 'b'] })).toContain('columnas')
  })
  it('sin elegir: columnas, después muro con fotos, si no cuadrícula', () => {
    expect(vistaDe({ columnas: ['a', 'b'], foto: true }, {})).toBe('columnas')
    expect(vistaDe({ foto: true }, null)).toBe('muro')
    expect(vistaDe({ nombres: true }, {})).toBe('cuadricula')
    expect(vistaDe({ foto: true }, { vista: 'lista' })).toBe('lista')
    expect(vistaDe({ foto: true }, { vista: 'columnas' })).toBe('muro')
  })
  it('una columna que ya no existe cae en la primera', () => {
    expect(columnaDe({ columna: 3 }, 2)).toBe(0)
    expect(columnaDe({}, 2)).toBe(0)
    expect(porColumna([{ columna: 1 }, { columna: 0 }, { columna: 9 }], 2).map(c => c.length)).toEqual([2, 1])
  })
})

describe('publicar al instante', () => {
  const respuestas = {
    a: { texto: 'There is a plant', at: 1 },
    b: { texto: 'mierda', at: 2 },
    c: { foto: true, at: 3, desde: 0.5 },
  }
  it('lo no revisado cuenta como aprobado, salvo lo que marca el filtro', () => {
    const r = abiertas(respuestas, { a: false }, {}, {}, true)
    expect(r.aprobadas.map(x => x.pid)).toEqual(['c'])
    expect(r.pendientes.map(x => x.pid)).toEqual(['b'])
    expect(r.descartadas.map(x => x.pid)).toEqual(['a'])
  })
  it('con moderación sigue esperando', () => {
    expect(abiertas(respuestas).aprobadas).toEqual([])
  })
  it('una foto sin texto también es una publicación, y se ordena por cuándo se publicó', () => {
    const r = abiertas(respuestas, {}, {}, {}, true)
    expect(r.aprobadas[0]).toMatchObject({ pid: 'c', foto: true, at: 0.5 })
  })
})

describe('comentarios', () => {
  const comentarios = {
    k2: { de: 'b', en: 'a', texto: 'There is a heater', at: 20 },
    k1: { de: 'c', en: 'a', texto: '  There are  chairs ', at: 10 },
    k3: { de: 'b', en: 'c', texto: 'mierda', at: 30 },
    k4: { de: 'b', texto: 'sin publicación', at: 40 },
  }
  const participantes = { b: { nombre: 'Sofía' }, c: { nombre: 'Rastreador' } }
  it('se agrupan por publicación, en orden, limpios y con su nombre', () => {
    const g = comentariosPorPublicacion(comentarios, participantes, { yo: 'c' })
    expect(g.a.map(c => c.texto)).toEqual(['There are chairs', 'There is a heater'])
    expect(g.a[0]).toMatchObject({ nombre: 'Rastreador', mio: true })
    expect(g.c).toBeUndefined()
  })
  it('el docente ve lo que marcó el filtro', () => {
    expect(comentariosPorPublicacion(comentarios, {}, { conGroserias: true }).c[0].groseria).toBe(true)
  })
  it('se cuentan los de cada uno', () => {
    expect(comentariosDe(comentarios, 'b')).toBe(3)
  })
})

describe('fotos', () => {
  it('se achican sin agrandar ni deformar', () => {
    expect(medidasFoto(4000, 3000, 1280)).toEqual({ ancho: 1280, alto: 960 })
    expect(medidasFoto(3000, 4000, 480)).toEqual({ ancho: 360, alto: 480 })
    expect(medidasFoto(300, 200, 1280)).toEqual({ ancho: 300, alto: 200 })
  })
  it('solo JPEG y bajo el tope', () => {
    expect(fotoValida('data:image/jpeg;base64,AAA', 100)).toBe(true)
    expect(fotoValida('data:image/png;base64,AAA', 100)).toBe(false)
    expect(fotoValida('data:image/jpeg;base64,' + 'A'.repeat(200), 100)).toBe(false)
  })
})

describe('el resumen', () => {
  const a = { id: 'x', tipo: 'abierta', pregunta: 'What is in the hall?', foto: true, comentarios: true, sinModerar: true }
  const respuestas = { p: { texto: 'The hall', foto: true, at: 1 } }
  const extra = {
    minis: { p: 'data:image/jpeg;base64,AAA' },
    comentarios: { k: { de: 'q', en: 'p', texto: 'There is a plant', at: 2 } },
    participantes: { p: { nombre: 'Ana' }, q: { nombre: 'Luis' } },
  }
  it('lleva la foto chica y los comentarios, sin nombres si no se mostraban', () => {
    const r = resultadoDe(a, respuestas, {}, extra)
    expect(r.publicaciones).toEqual([{ texto: 'The hall', foto: 'data:image/jpeg;base64,AAA', comentarios: [{ texto: 'There is a plant' }] }])
    expect(r.nombres).toBeUndefined()
    expect(tieneAlgo(r)).toBe(true)
  })
  it('con nombres, los lleva', () => {
    const r = resultadoDe({ ...a, nombres: true }, respuestas, {}, extra)
    expect(r.publicaciones[0]).toMatchObject({ nombre: 'Ana', comentarios: [{ texto: 'There is a plant', nombre: 'Luis' }] })
    expect(r.nombres).toBe(true)
  })
})
