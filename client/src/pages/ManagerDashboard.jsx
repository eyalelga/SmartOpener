import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../api/client'
import styles from './ManagerDashboard.module.css'

export default function ManagerDashboard() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState('stations')

  const [stations, setStations] = useState([])  // manager's assigned stations
  const [workers, setWorkers] = useState([])    // manager's workers
  const [loading, setLoading] = useState(true)

  const [expanded, setExpanded] = useState(null)
  const [drilldown, setDrilldown] = useState({}) // stationId → { users, loading, assignId }

  const [newWorker, setNewWorker] = useState({ name: '', password: '', pin: '' })
  const [workerError, setWorkerError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [s, w] = await Promise.all([api.get('/stations'), api.get('/users')])
      setStations(s.data)
      setWorkers(w.data.filter(u => u.role === 'worker'))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Drill-down
  const toggleStation = async (id) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!drilldown[id]) {
      setDrilldown(p => ({ ...p, [id]: { users: [], loading: true, assignId: '' } }))
      const r = await api.get(`/stations/${id}/users`)
      setDrilldown(p => ({ ...p, [id]: { ...p[id], users: r.data, loading: false } }))
    }
  }

  const refreshDrilldown = async (id) => {
    const r = await api.get(`/stations/${id}/users`)
    setDrilldown(p => ({ ...p, [id]: { ...p[id], users: r.data } }))
  }

  const assignWorker = async (stationId) => {
    const userId = drilldown[stationId]?.assignId
    if (!userId) return
    await api.post(`/stations/${stationId}/permissions`, { userId })
    setDrilldown(p => ({ ...p, [stationId]: { ...p[stationId], assignId: '' } }))
    refreshDrilldown(stationId)
  }

  const removeWorker = async (stationId, userId) => {
    await api.delete(`/stations/${stationId}/permissions/${userId}`)
    refreshDrilldown(stationId)
  }

  const unassigned = (stationId) => {
    const assigned = new Set((drilldown[stationId]?.users ?? []).map(u => u.id))
    return workers.filter(w => !assigned.has(w.id))
  }

  const createWorker = async (e) => {
    e.preventDefault(); setWorkerError('')
    if (!newWorker.pin) return setWorkerError('חובה להגדיר PIN לעובד')
    try {
      await api.post('/users', newWorker)
      setNewWorker({ name: '', password: '', pin: '' }); loadData()
    } catch (err) { setWorkerError(err.response?.data?.error ?? 'שגיאה') }
  }

  const deleteWorker = async (id) => {
    if (!confirm('למחוק עובד?')) return
    await api.delete(`/users/${id}`); loadData()
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>SmartOpener <span className={styles.badge}>מנהל אזור</span></h1>
        <span className={styles.userInfo}>{user.name}</span>
        <button className={styles.logoutBtn} onClick={logout}>התנתק</button>
      </header>

      <nav className={styles.tabs}>
        <button className={tab === 'stations' ? styles.active : ''} onClick={() => setTab('stations')}>
          העמדות שלי ({stations.length})
        </button>
        <button className={tab === 'workers' ? styles.active : ''} onClick={() => setTab('workers')}>
          עובדים ({workers.length})
        </button>
      </nav>

      <main className={styles.content}>
        {loading && <p className={styles.loading}>טוען...</p>}

        {/* STATIONS — drill-down to assign workers */}
        {!loading && tab === 'stations' && (
          <div className={styles.section}>
            {stations.length === 0 && (
              <p className={styles.empty}>אין עמדות משויכות לחשבונך. פנה למנהל הראשי.</p>
            )}
            <div className={styles.list}>
              {stations.map(station => {
                const dd = drilldown[station.id]
                const isOpen = expanded === station.id
                return (
                  <div key={station.id} className={`${styles.row} ${isOpen ? styles.rowOpen : ''}`}>
                    <div className={styles.summary} onClick={() => toggleStation(station.id)}>
                      <span className={styles.chevron}>{isOpen ? '▾' : '▸'}</span>
                      <span className={styles.name}>{station.name}</span>
                      {station.location && <span className={styles.loc}>{station.location}</span>}
                      <span className={station.agentConnected ? styles.online : styles.offline}>
                        {station.agentConnected ? 'מחובר' : 'מנותק'}
                      </span>
                      {dd && !dd.loading && (
                        <span className={styles.chip}>{dd.users.length} עובדים</span>
                      )}
                    </div>

                    {isOpen && (
                      <div className={styles.drill}>
                        {dd?.loading && <p className={styles.dim}>טוען...</p>}
                        {dd && !dd.loading && (
                          <>
                            {dd.users.length === 0
                              ? <p className={styles.dim}>אין עובדים משויכים לעמדה זו</p>
                              : (
                                <ul className={styles.assignedList}>
                                  {dd.users.map(u => (
                                    <li key={u.id}>
                                      <span className={styles.assignedName}>{u.name}</span>
                                      <button className={styles.removeBtn} onClick={() => removeWorker(station.id, u.id)}>הסר</button>
                                    </li>
                                  ))}
                                </ul>
                              )
                            }
                            <div className={styles.assignRow}>
                              <select
                                value={dd.assignId}
                                onChange={e => setDrilldown(p => ({ ...p, [station.id]: { ...p[station.id], assignId: e.target.value } }))}
                              >
                                <option value="">שייך עובד לעמדה...</option>
                                {unassigned(station.id).map(w => (
                                  <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                              </select>
                              <button className={styles.assignBtn} onClick={() => assignWorker(station.id)} disabled={!dd.assignId}>שייך</button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* WORKERS */}
        {!loading && tab === 'workers' && (
          <div className={styles.section}>
            <form className={styles.form} onSubmit={createWorker}>
              <h2>הוסף עובד</h2>
              <div className={styles.formRow}>
                <input placeholder="שם משתמש" value={newWorker.name} onChange={e => setNewWorker(p => ({ ...p, name: e.target.value }))} required />
                <input type="password" placeholder="סיסמה" value={newWorker.password} onChange={e => setNewWorker(p => ({ ...p, password: e.target.value }))} required />
                <input
                  placeholder="PIN (4 ספרות)"
                  value={newWorker.pin}
                  onChange={e => setNewWorker(p => ({ ...p, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                  maxLength={4}
                  inputMode="numeric"
                  required
                />
                <button type="submit">הוסף</button>
              </div>
              {workerError && <p className={styles.error}>{workerError}</p>}
              <p className={styles.hint}>ה-PIN משמש לאישור פתיחת דלת במסך העובד</p>
            </form>

            <table className={styles.table}>
              <thead><tr><th>שם</th><th>PIN</th><th></th></tr></thead>
              <tbody>
                {workers.map(w => (
                  <tr key={w.id}>
                    <td>{w.name}</td>
                    <td>{w.hasPin ? '✓ מוגדר' : <span className={styles.noPin}>לא מוגדר</span>}</td>
                    <td><button className={styles.deleteBtn} onClick={() => deleteWorker(w.id)}>מחק</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
