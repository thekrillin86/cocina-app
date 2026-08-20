import React, { useMemo } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { Header, Loading, EmptyState } from '../components/ui'

/* Esta vista es la unica que usa recharts (~400 KB). App la carga con
   React.lazy para que no lastre el arranque en el movil. */

export function StatsView({ menus, loading }) {

  const stats = useMemo(() => {
    if (!menus.length) return null

    const dishCount = {}
    const caloriesByWeek = []
    let totalMeals = 0
    let mealsWithCalories = 0
    let totalCal = 0

    for (const m of menus) {
      let weekCal = 0
      let weekDays = 0
      for (const d of m.days || []) {
        for (const type of ['lunch', 'dinner']) {
          const meal = d[type]
          if (!meal) continue
          totalMeals++
          const name = meal.name.trim()
          dishCount[name] = (dishCount[name] || 0) + 1
          if (meal.calories) {
            totalCal += meal.calories
            mealsWithCalories++
            weekCal += meal.calories
          }
        }
        if (d.lunch || d.dinner) weekDays++
      }
      caloriesByWeek.push({
        week: `S${m.week}`,
        calorias: weekDays ? Math.round(weekCal / weekDays) : 0,
      })
    }

    const topDishes = Object.entries(dishCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({
        name: name.length > 22 ? name.slice(0, 20) + '…' : name,
        fullName: name,
        count,
      }))

    return {
      totalMeals,
      uniqueDishes: Object.keys(dishCount).length,
      weeks: menus.length,
      avgCalories: mealsWithCalories ? Math.round(totalCal / mealsWithCalories) : null,
      topDishes,
      caloriesByWeek: caloriesByWeek.reverse(),
    }
  }, [menus])

  if (loading) return <Loading />
  if (!stats)
    return (
      <div className="px-6 pt-10">
        <Header />
        <EmptyState title="Sin datos aún" hint="Importa algún menú para ver estadísticas." />
      </div>
    )

  return (
    <div className="animate-fade-in-up">
      <Header />
      <div className="px-6">
        <h1 className="font-display text-3xl text-ink-900 mb-6">Estadísticas</h1>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard label="Semanas" value={stats.weeks} />
          <StatCard label="Platos servidos" value={stats.totalMeals} />
          <StatCard label="Platos únicos" value={stats.uniqueDishes} />
          <StatCard
            label="Kcal / plato"
            value={stats.avgCalories ? `${stats.avgCalories}` : '—'}
          />
        </div>

        <section className="card p-5 mb-4">
          <h2 className="font-display text-xl mb-1">Platos más frecuentes</h2>
          <p className="text-xs text-ink-500 mb-4">
            Repeticiones en todo el histórico
          </p>
          <div style={{ width: '100%', height: Math.max(200, stats.topDishes.length * 32) }}>
            <ResponsiveContainer>
              <BarChart
                data={stats.topDishes}
                layout="vertical"
                margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
              >
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fill: '#3D362D', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#F4DBCD80' }}
                  contentStyle={{
                    background: '#FDFBF7',
                    border: '1px solid #E8DFD0',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v, _, p) => [`${v} veces`, p?.payload?.fullName]}
                />
                <Bar dataKey="count" fill="#C65D3E" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {stats.caloriesByWeek.some((w) => w.calorias > 0) && (
          <section className="card p-5">
            <h2 className="font-display text-xl mb-1">Calorías por semana</h2>
            <p className="text-xs text-ink-500 mb-4">
              Promedio por día (por persona)
            </p>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <LineChart
                  data={stats.caloriesByWeek}
                  margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
                >
                  <CartesianGrid stroke="#E8DFD0" vertical={false} />
                  <XAxis
                    dataKey="week"
                    tick={{ fill: '#5C5248', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#5C5248', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#FDFBF7',
                      border: '1px solid #E8DFD0',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v) => [`${v} kcal`, 'Media diaria']}
                  />
                  <Line
                    type="monotone"
                    dataKey="calorias"
                    stroke="#C65D3E"
                    strokeWidth={2.5}
                    dot={{ fill: '#C65D3E', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="card p-4">
      <p className="label-caps text-ink-500 mb-1">{label}</p>
      <p className="font-display text-3xl text-ink-900 leading-none">{value}</p>
    </div>
  )
}
