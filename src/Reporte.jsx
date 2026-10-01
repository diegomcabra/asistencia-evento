import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'

function formatearHora(fecha) {
  if (!fecha) return ''
  return fecha.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function celdaCSV(valor) {
  const texto = String(valor ?? '')
  return /[;"\n]/.test(texto) ? '"' + texto.replace(/"/g, '""') + '"' : texto
}

function descargarCSV(asistentes) {
  const encabezado = ['Nombre', 'DNI', 'Ubicación', 'Presente', 'Hora de registro']
  const filas = asistentes.map((a) => [
    a.nombre,
    a.dni ?? '',
    a.ubicacion ?? '',
    a.presente ? 'Sí' : 'No',
    a.presente ? formatearHora(a.hora) : '',
  ])
  const csv = [encabezado, ...filas].map((f) => f.map(celdaCSV).join(';')).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const fecha = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h')
  a.href = url
  a.download = `reporte-asistencia_${fecha}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Reporte() {
  const [asistentes, setAsistentes] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    return onSnapshot(
      collection(db, 'asistentes'),
      (snap) => {
        setError(null)
        setAsistentes(
          snap.docs.map((d) => {
            const datos = d.data()
            return {
              nombre: datos.nombre ?? '',
              dni: datos.dni ?? null,
              ubicacion: datos.ubicacion ?? null,
              presente: datos.presente === true,
              hora: datos.horaRegistro?.toDate?.() ?? null,
            }
          })
        )
      },
      () => setError('No se pudo leer la lista. Revisá la conexión.')
    )
  }, [])

  const resumen = useMemo(() => {
    if (!asistentes) return null
    const presentes = asistentes.filter((a) => a.presente).length
    return { total: asistentes.length, presentes, faltan: asistentes.length - presentes }
  }, [asistentes])

  const porSector = useMemo(() => {
    if (!asistentes) return []
    const mapa = new Map()
    for (const a of asistentes) {
      const sector = a.ubicacion || 'Sin ubicación'
      if (!mapa.has(sector)) mapa.set(sector, { sector, total: 0, presentes: 0 })
      const s = mapa.get(sector)
      s.total += 1
      if (a.presente) s.presentes += 1
    }
    return [...mapa.values()].sort((a, b) => a.sector.localeCompare(b.sector, 'es'))
  }, [asistentes])

  return (
    <div className="min-h-dvh px-5 py-8 text-parchment max-w-2xl">
      <h1 className="font-display text-3xl text-gold-soft leading-none">Reporte de asistencia</h1>
      <a href={window.location.pathname} className="text-sm text-parchment/50 underline underline-offset-2">
        ← Volver al buscador
      </a>

      {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
      {!asistentes && !error && <p className="mt-4 text-parchment/60 text-sm">Cargando…</p>}

      {resumen && (
        <>
          <div className="mt-5 flex gap-4 text-sm">
            <span className="rounded-lg bg-ink-soft border border-white/10 px-4 py-3">
              <span className="block text-2xl font-semibold text-gold-soft">{resumen.presentes}</span>
              presentes
            </span>
            <span className="rounded-lg bg-ink-soft border border-white/10 px-4 py-3">
              <span className="block text-2xl font-semibold">{resumen.total}</span>
              invitados
            </span>
            <span className="rounded-lg bg-ink-soft border border-white/10 px-4 py-3">
              <span className="block text-2xl font-semibold text-parchment/60">{resumen.faltan}</span>
              faltan
            </span>
          </div>

          <button
            onClick={() => descargarCSV(asistentes)}
            className="mt-5 w-full rounded-xl bg-gold px-4 py-4 text-lg font-semibold text-ink"
          >
            Descargar CSV completo
          </button>
          <p className="mt-2 text-xs text-parchment/40">
            Se abre directamente en Excel, con nombre, DNI, ubicación, si asistió y la hora.
          </p>

          <h2 className="mt-8 mb-2 font-display text-xl text-gold-soft">Por sector</h2>
          <div className="space-y-1">
            {porSector.map((s) => (
              <div
                key={s.sector}
                className="flex items-center justify-between rounded-lg bg-ink-soft border border-white/10 px-4 py-2 text-sm"
              >
                <span>{s.sector}</span>
                <span className="text-parchment/60">
                  {s.presentes} / {s.total}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
