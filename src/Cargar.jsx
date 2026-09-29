import { useState } from 'react'
import { doc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'

// Página de una sola vez: se entra agregando #cargar a la dirección de la app.
// Sube el archivo asistentes.json. Se puede repetir sin problema: no duplica
// gente ni borra las asistencias ya marcadas.
export default function Cargar() {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)
  const [estado, setEstado] = useState('espera') // espera | cargando | listo
  const [avance, setAvance] = useState(0)

  const leerArchivo = async (e) => {
    setError(null)
    setLista(null)
    setEstado('espera')
    const archivo = e.target.files?.[0]
    if (!archivo) return
    try {
      const datos = JSON.parse(await archivo.text())
      const valido =
        Array.isArray(datos) &&
        datos.length > 0 &&
        datos.every((x) => typeof x.id === 'string' && typeof x.nombre === 'string')
      if (!valido) throw new Error('formato')
      setLista(datos)
    } catch {
      setError('No pude leer ese archivo. Tiene que ser el asistentes.json que generamos.')
    }
  }

  const cargar = async () => {
    setEstado('cargando')
    setError(null)
    try {
      for (let i = 0; i < lista.length; i += 400) {
        const lote = writeBatch(db)
        for (const a of lista.slice(i, i + 400)) {
          lote.set(doc(db, 'asistentes', a.id), { nombre: a.nombre, dni: a.dni ?? null }, { merge: true })
        }
        await lote.commit()
        setAvance(Math.min(i + 400, lista.length))
      }
      setEstado('listo')
    } catch {
      setEstado('espera')
      setError('Falló la carga. Revisá la conexión y las reglas de Firestore, y probá de nuevo.')
    }
  }

  return (
    <div className="min-h-dvh px-5 py-8 text-parchment max-w-xl">
      <h1 className="font-display text-3xl text-gold-soft leading-none">Cargar listado</h1>
      <p className="mt-3 text-parchment/70 text-sm">
        Elegí el archivo <b>asistentes.json</b>. Si ya hay gente cargada, no se duplica ni se pierden las asistencias marcadas.
      </p>

      <input
        type="file"
        accept=".json,application/json"
        onChange={leerArchivo}
        className="mt-5 block w-full text-sm text-parchment/80 file:mr-4 file:rounded-lg file:border-0 file:bg-gold file:px-4 file:py-3 file:font-semibold file:text-ink"
      />

      {lista && estado !== 'listo' && (
        <button
          onClick={cargar}
          disabled={estado === 'cargando'}
          className="mt-5 w-full rounded-xl bg-gold px-4 py-4 text-lg font-semibold text-ink disabled:opacity-60"
        >
          {estado === 'cargando' ? `Cargando… ${avance} de ${lista.length}` : `Cargar ${lista.length} asistentes`}
        </button>
      )}

      {estado === 'listo' && (
        <p className="mt-5 rounded-xl border border-ok bg-ok-soft px-4 py-4">
          ✓ Listo: {lista.length} asistentes cargados.{' '}
          <a href={window.location.pathname} className="underline">
            Ir a la app
          </a>
        </p>
      )}
      {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
    </div>
  )
}
