import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../api/client'
import styles from './AdminDashboard.module.css'

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState('stations')

  const [workers, setWorkers] = useState([])
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)

  // Drill-down state: stationId → { users: [], loading, assignId }
  const [drilldown, setDrilldown] = useState({})
  const [expanded, setExpanded] = useState(null)

  // Workers tab
  const [newWorker, setNewWorker] = useState({ name: '', password: '' })
  const [workerError, setWorkerError] = useState('')

  // Stations tab (super_admin only)
  const [newStation, setNewStation] = useState({ name: '', location: '' })
  const [stationError, setStationError] = useState('')

  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [w, s] = await Promise.all([api.get('/users'), api.get('/stations')])
      setWorkers(w.data)
      setStations(s.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // --- Drill-down ---
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

  // --- Workers ---
  const createWorker = async (e) => {
    e.preventDefault(); setWorkerError('')
    try {
      await api.post('/users', newWorker)
      setNewWorker({ name: '', password: '' })
      loadData()
    } catch (err) { setWorkerError(err.response?.data?.error ?? 'שגיאה') }
  }

  const deleteWorker = async (id) => {
    if (!confirm('למחוק עובד?')) return
    await api.delete(`/users/${id}`)
    loadData()
  }

  // --- Stations ---
  const createStation = async (e) => {
    e.preventDefault(); setStationError('')
    try {
      await api.post('/stations', newStation)
      setNewStation({ name: '', location: '' })
      loadData()
    } catch (err) { setStationError(err.response?.data?.error ?? 'שגיאה') }
  }

  const deleteStation = async (id) => {
    if (!confirm('למחוק תחנה?')) return
    await api.delete(`/stations/${id}`)
    setExpanded(null)
    loadData()
  }

  const filteredStations = stations.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  // Workers not yet assigned to a station (for assign dropdown)
  const unassignedWorkers = (stationId) => {
    const assigned = new Set((drilldown[stationId]?.users ?? []).map(u => u.id))
    return workers.filter(w => w.role === 'worker' && !assigned.has(w.id))
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>SmartOpener</h1>
        <span className={styles.userInfo}>{user.name} · {user.role === 'super_admin' ? 'מנהל ראשי' : 'מנהל'}</span>
        <button className={styles.logoutBtn} onClick={logout}>התנתק</button>
      </header>

      <nav className={styles.tabs}>
        <button className={tab === 'stations' ? styles.active : ''} onClick={() => setTab('stations')}>תחנות</button>
        <button className={tab === 'workers' ? styles.active : ''} onClick={() => setTab('workers')}>עובדים</button>
      </nav>

      <main className={styles.content}>
        {loading && <p className={styles.loading}>טוען...</p>}

        {/* STATIONS TAB */}
        {!loading && tab === 'stations' && (
          <div className={styles.section}>
            <div className={styles.toolbar}>
              <input
                className={styles.search}
                placeholder="חיפוש תחנה..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <span className={styles.count}>{filteredStations.length} תחנות</span>
              {user.role === 'super_admin' && (
                <form className={styles.inlineForm} onSubmit={createStation}>
                  <input
                    placeholder="שם תחנה"
                    value={newStation.name}
                    onChange={e => setNewStation(p => ({ ...p, name: e.target.value }))}
                    required
                  />
                  <input
                    placeholder="מיקום"
                    value={newStation.location}
                    onChange={e => setNewStation(p => ({ ...p, location: e.target.value }))}
                  />
                  <button type="submit">+ הוסף</button>
                  {stationError && <span className={styles.error}>{stationError}</span>}
                </form>
              )}
            </div>

            <div className={styles.stationList}>
              {filteredStations.map(station => {
                const dd = drilldown[station.id]
                const isOpen = expanded === station.id
                return (
                  <div key={station.id} className={`${styles.stationRow} ${isOpen ? styles.stationRowOpen : ''}`}>
                    <div className={styles.stationSummary} onClick={() => toggleStation(station.id)}>
                      <span className={styles.chevron}>{isOpen ? '▾' : '▸'}</span>
                      <span className={styles.stationName}>{station.name}</span>
                      {station.location && <span className={styles.loc}>{station.location}</span>}
                      <span className={station.agentConnected ? styles.online : styles.offline}>
                        {station.agentConnected ? 'מחובר' : 'מנותק'}
                      </span>
                      {dd && !dd.loading && (
                        <span className={styles.assignedCount}>{dd.users.length} עובדים</span>
                      )}
                    </div>

                    {isOpen && (
                      <div className={styles.drilldown}>
                        {dd?.loading && <p className={styles.ddLoading}>טוען...</p>}

                        {dd && !dd.loading && (
                          <>
                            {dd.users.length === 0
                              ? <p className={styles.ddEmpty}>אין עובדים מוקצים</p>
                              : (
                                <ul className={styles.assignedList}>
                                  {dd.users.map(u => (
                                    <li key={u.id}>
                                      <span>{u.name}</span>
                                      <button
                                        className={styles.removeBtn}
                                        onClick={() => removeWorker(station.id, u.id)}
                                      >הסר</button>
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
                                <option value="">הוסף עובד לתחנה...</option>
                                {unassignedWorkers(station.id).map(w => (
                                  <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                              </select>
                              <button
                                className={styles.assignBtn}
                                onClick={() => assignWorker(station.id)}
                                disabled={!dd.assignId}
                              >הוסף</button>
                              {user.role === 'super_admin' && (
                                <button className={styles.deleteStationBtn} onClick={() => deleteStation(station.id)}>
                                  מחק תחנה
                                </button>
                              )}
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

        {/* WORKERS TAB */}
        {!loading && tab === 'workers' && (
          <div className={styles.section}>
            <form className={styles.form} onSubmit={createWorker}>
              <h2>הוסף עובד</h2>
              <div className={styles.row}>
                <input
                  placeholder="שם משתמש"
                  value={newWorker.name}
                  onChange={e => setNewWorker(p => ({ ...p, name: e.target.value }))}
                  required
                />
                <input
                  placeholder="סיסמה"
                  type="password"
                  value={newWorker.password}
                  onChange={e => setNewWorker(p => ({ ...p, password: e.target.value }))}
                  required
                />
                <button type="submit">הוסף</button>
              </div>
              {workerError && <p className={styles.error}>{workerError}</p>}
            </form>

            <table className={styles.table}>
              <thead><tr><th>שם</th><th>תפקיד</th><th></th></tr></thead>
              <tbody>
                {workers.map(w => (
                  <tr key={w.id}>
                    <td>{w.name}</td>
                    <td>{roleLabel(w.role)}</td>
                    <td>
                      {w.id !== user.id && (
                        <button className={styles.deleteBtn} onClick={() => deleteWorker(w.id)}>מחק</button>
                      )}
                    </td>
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

function roleLabel(r) {
  return { super_admin: 'מנהל ראשי', manager: 'מנהל', worker: 'עובד' }[r] ?? r
}
