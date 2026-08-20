import { useEffect, useState } from 'react'
import { currentWeekId, getTodayWeekIndex } from './dates'

function instantanea() {
  const ahora = new Date()
  return {
    weekId: currentWeekId(ahora),
    dayIndex: getTodayWeekIndex(ahora),
    date: ahora,
  }
}

/* ============================================================
   FECHA DE HOY, SIEMPRE AL DÍA

   La app se instala como PWA y se queda abierta días enteros. Si la
   fecha se calcula una sola vez al arrancar, pasada la medianoche la
   pantalla «Hoy» sigue enseñando el día (y la semana) anteriores.

   Se revalida al volver a primer plano y una vez por minuto, y solo
   provoca un repintado si de verdad ha cambiado el día.
   ============================================================ */
export function useToday() {
  const [hoy, setHoy] = useState(instantanea)

  useEffect(() => {
    const revisar = () =>
      setHoy((previo) => {
        const nuevo = instantanea()
        return previo.weekId === nuevo.weekId && previo.dayIndex === nuevo.dayIndex
          ? previo
          : nuevo
      })

    const temporizador = setInterval(revisar, 60000)
    document.addEventListener('visibilitychange', revisar)
    window.addEventListener('focus', revisar)
    return () => {
      clearInterval(temporizador)
      document.removeEventListener('visibilitychange', revisar)
      window.removeEventListener('focus', revisar)
    }
  }, [])

  return hoy
}
