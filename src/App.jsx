import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import Cargar from './Cargar'
import Reporte from './Reporte'

const EVENTO_NOMBRE = 'Control de asistencia'
const MAX_RESULTADOS = 30

export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function formatearHora(fecha) {
  if (!fecha) return ''
  return fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export default function App() {
  const [ruta, setRuta] = useState(window.location.hash)
  useEffect(() => {
    const alCambiar = () => setRuta(window.location.hash)
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])

  if (ruta === '#cargar') return <Cargar />
  if (ruta === '#reporte') return <Reporte />
  return <Asistencia />
}

function Asistencia() {
  const [query, setQuery] = useState('')
  const [asistentes, setAsistentes] = useState(null)
  const [errorConexion, setErrorConexion] = useState(null)
  const [errorMarcado, setErrorMarcado] = useState(null)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  // Toda la lista en vivo: cada cambio de cualquier celular llega solo
  useEffect(() => {
    return onSnapshot(
      collection(db, 'asistentes'),
      { includeMetadataChanges: true },
      (snap) => {
        setErrorConexion(null)
        setAsistentes(
          snap.docs.map((d) => {
            const datos = d.data({ serverTimestamps: 'estimate' })
            return {
              id: d.id,
              nombre: datos.nombre ?? '',
              dni: datos.dni ?? null,
              ubicacion: datos.ubicacion ?? null,
              presente: datos.presente === true,
              hora: datos.horaRegistro?.toDate?.() ?? null,
              sincronizando: d.metadata.hasPendingWrites,
              busqueda: normalizar(`${datos.nombre ?? ''} ${datos.dni ?? ''} ${datos.ubicacion ?? ''}`),
            }
          })
        )
      },
      () => setErrorConexion('No se pudo leer la lista. Revisá la conexión y las reglas de Firestore.')
    )
  }, [])

  const conteo = useMemo(() => {
    if (!asistentes) return null
    const presentes = asistentes.filter((a) => a.presente).length
    return { total: asistentes.length, presentes, faltan: asistentes.length - presentes }
  }, [asistentes])

  const resultados = useMemo(() => {
    const tokens = normalizar(query).split(' ').filter(Boolean)
    if (!asistentes || normalizar(query).length < 2) return []
    return asistentes
      .filter((a) => tokens.every((t) => a.busqueda.includes(t)))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .slice(0, MAX_RESULTADOS)
  }, [asistentes, query])

  const marcar = async (a) => {
    setErrorMarcado(null)
    try {
      await updateDoc(doc(db, 'asistentes', a.id), {
        presente: !a.presente,
        horaRegistro: a.presente ? null : serverTimestamp(),
      })
    } catch {
      setErrorMarcado(`No se pudo guardar el cambio de ${a.nombre}. Probá de nuevo.`)
    }
  }

  const buscando = normalizar(query).length >= 2

  return (
    <div className="min-h-dvh flex flex-col text-parchment">
      <header className="px-5 pt-6 pb-4 border-b border-white/10">
        <h1 className="font-display text-3xl text-gold-soft leading-none">{EVENTO_NOMBRE}</h1>
        <div className="mt-3 flex items-center gap-4 text-sm">
          <span className="text-parchment/70">
            {conteo ? `${conteo.presentes} de ${conteo.total} presentes` : 'Cargando…'}
          </span>
          {conteo && <span className="text-parchment/50">· faltan {conteo.faltan}</span>}
          <a href="#reporte" className="ml-auto text-parchment/40 underline underline-offset-2">
            Reporte
          </a>
        </div>
      </header>

      {!online && (
        <div className="px-5 py-2 text-sm bg-gold/15 text-gold-soft border-b border-gold/30">
          Sin conexión: las marcas se guardan en este celular y se sincronizan solas al volver internet.
        </div>
      )}

      <main className="flex-1 px-5 py-5">
        <label htmlFor="busqueda" className="sr-only">
          Buscar por nombre, apellido o DNI
        </label>
        <input
          id="busqueda"
          type="text"
          autoComplete="off"
          autoCapitalize="words"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, apellido o DNI…"
          className="w-full rounded-xl bg-ink-soft border border-white/15 px-4 py-4 text-lg text-parchment placeholder:text-parchment/40 outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
        />

        <div className="mt-4 space-y-2">
          {errorConexion && <p className="text-red-400 text-sm px-1">{errorConexion}</p>}
          {errorMarcado && <p className="text-red-400 text-sm px-1">{errorMarcado}</p>}
          {asistentes && asistentes.length === 0 && (
            <p className="text-parchment/50 text-sm px-1">
              La lista está vacía. Cargala desde la página de carga (agregá #cargar al final de la dirección).
            </p>
          )}
          {buscando && asistentes && asistentes.length > 0 && resultados.length === 0 && (
            <p className="text-parchment/50 text-sm px-1">No encontramos a nadie con ese nombre.</p>
          )}

          {resultados.map((a) => (
            <button
              key={a.id}
              onClick={() => marcar(a)}
              className={`w-full flex items-center justify-between gap-3 rounded-xl px-4 py-4 text-left border transition-colors ${
                a.presente
                  ? 'bg-ok-soft border-ok text-parchment'
                  : 'bg-ink-soft border-white/10 text-parchment hover:border-gold/50'
              } ${a.sincronizando ? 'opacity-70' : ''}`}
            >
              <span className="min-w-0">
                <span className="block font-semibold text-base leading-snug">{a.nombre}</span>
                <span className="block text-sm text-parchment/50">
                  {a.dni ? `DNI ${a.dni}` : 'Sin DNI cargado'}
                  {a.ubicacion ? ` · ${a.ubicacion}` : ''}
                </span>
              </span>

              <span className="shrink-0 text-sm font-medium">
                {a.presente ? (
                  <span className="flex flex-col items-end">
                    <span className="text-ok text-lg leading-none">✓</span>
                    <span className="text-parchment/60 text-xs">{formatearHora(a.hora)}</span>
                  </span>
                ) : (
                  <span className="text-parchment/30">marcar</span>
                )}
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
