import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../api/client'
import styles from './SuperAdminDashboard.module.css'

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState('stations')

  const [stations, setStations] = useState([])
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)

  const [expanded, setExpanded] = useState(null)
  const [drilldown, setDrilldown] = useState({}) // stationId → { users, loading, assignId }

  const [search, setSearch] = useState('')
  const [newStation, setNewStation] = useState({ name: '', location: '' })
  const [stationError, setStationError] = useState('')
  const [newManager, setNewManager] = useState({ name: '', password: '' })
  const [managerError, setManagerError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [s, u] = await Promise.all([api.get('/stations'), api.get('/users')])
      setStations(s.data)
      setManagers(u.data.filter(u => u.role === 'manager' || u.role === 'super_admin'))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Drill-down: load users assigned to station
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

  const assignToStation = async (stationId) => {
    const userId = drilldown[stationId]?.assignId
    if (!userId) return
    await api.post(`/stations/${stationId}/permissions`, { userId })
    setDrilldown(p => ({ ...p, [stationId]: { ...p[stationId], assignId: '' } }))
    refreshDrilldown(stationId)
  }

  const removeFromStation = async (stationId, userId) => {
    await api.delete(`/stations/${stationId}/permissions/${userId}`)
    refreshDrilldown(stationId)
  }

  // All users not yet assigned to this station
  const unassigned = (stationId) => {
    const assigned = new Set((drilldown[stationId]?.users ?? []).map(u => u.id))
    return managers.filter(u => !assigned.has(u.id))
  }

  const createStation = async (e) => {
    e.preventDefault(); setStationError('')
    try {
      await api.post('/stations', newStation)
      setNewStation({ name: '', location: '' }); loadData()
    } catch (err) { setStationError(err.response?.data?.error ?? 'שגיאה') }
  }

  const deleteStation = async (id) => {
    if (!confirm('למחוק תחנה?')) return
    await api.delete(`/stations/${id}`)
    setExpanded(null); loadData()
  }

  const createManager = async (e) => {
    e.preventDefault(); setManagerError('')
    try {
      await api.post('/users', { ...newManager, role: 'manager' })
      setNewManager({ name: '', password: '' }); loadData()
    } catch (err) { setManagerError(err.response?.data?.error ?? 'שגיאה') }
  }

  const deleteManager = async (id) => {
    if (!confirm('למחוק מנהל?')) return
    await api.delete(`/users/${id}`); loadData()
  }

  const filtered = stations.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>SmartOpener <span className={styles.badge}>מנהל ראשי</span></h1>
        <span className={styles.userInfo}>{user.name}</span>
        <button className={styles.logoutBtn} onClick={logout}>התנתק</button>
      </header>

      <nav className={styles.tabs}>
        <button className={tab === 'stations' ? styles.active : ''} onClick={() => setTab('stations')}>תחנות ({stations.length})</button>
        <button className={tab === 'managers' ? styles.active : ''} onClick={() => setTab('managers')}>מנהלים ({managers.filter(m => m.role === 'manager').length})</button>
      </nav>

      <main className={styles.content}>
        {loading && <p className={styles.loading}>טוען...</p>}

        {/* STATIONS */}
        {!loading && tab === 'stations' && (
          <div className={styles.section}>
            <div className={styles.toolbar}>
              <input className={styles.search} placeholder="חיפוש תחנה..." value={search} onChange={e => setSearch(e.target.value)} />
              <span className={styles.count}>{filtered.length} תחנות</span>
              <form className={styles.inlineForm} onSubmit={createStation}>
                <input placeholder="שם תחנה" value={newStation.name} onChange={e => setNewStation(p => ({ ...p, name: e.target.value }))} required />
                <input placeholder="מיקום" value={newStation.location} onChange={e => setNewStation(p => ({ ...p, location: e.target.value }))} />
                <button type="submit">+ הוסף</button>
                {stationError && <span className={styles.error}>{stationError}</span>}
              </form>
            </div>

            <div className={styles.list}>
              {filtered.map(station => {
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
                        <span className={styles.chip}>{dd.users.length} משויכים</span>
                      )}
                    </div>

                    {isOpen && (
                      <div className={styles.drill}>
                        {dd?.loading && <p className={styles.dim}>טוען...</p>}
                        {dd && !dd.loading && (
                          <>
                            {dd.users.length === 0
                              ? <p className={styles.dim}>אין מנהלים משויכים לתחנה זו</p>
                              : (
                                <ul className={styles.assignedList}>
                                  {dd.users.map(u => (
                                    <li key={u.id}>
                                      <span className={styles.assignedName}>{u.name}</span>
                                      <span className={styles.roleChip}>{roleLabel(u.role)}</span>
                                      <button className={styles.removeBtn} onClick={() => removeFromStation(station.id, u.id)}>הסר</button>
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
                                <option value="">שייך מנהל לתחנה...</option>
                                {unassigned(station.id).map(u => (
                                  <option key={u.id} value={u.id}>{u.name} ({roleLabel(u.role)})</option>
                                ))}
                              </select>
                              <button className={styles.assignBtn} onClick={() => assignToStation(station.id)} disabled={!dd.assignId}>שייך</button>
                              <button className={styles.deleteBtn} onClick={() => deleteStation(station.id)}>מחק תחנה</button>
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

        {/* MANAGERS */}
        {!loading && tab === 'managers' && (
          <div className={styles.section}>
            <form className={styles.form} onSubmit={createManager}>
              <h2>הוסף מנהל</h2>
              <div className={styles.formRow}>
                <input placeholder="שם משתמש" value={newManager.name} onChange={e => setNewManager(p => ({ ...p, name: e.target.value }))} required />
                <input type="password" placeholder="סיסמה" value={newManager.password} onChange={e => setNewManager(p => ({ ...p, password: e.target.value }))} required />
                <button type="submit">הוסף</button>
              </div>
              {managerError && <p className={styles.error}>{managerError}</p>}
            </form>

            <table className={styles.table}>
              <thead><tr><th>שם</th><th>תפקיד</th><th></th></tr></thead>
              <tbody>
                {managers.filter(m => m.role === 'manager').map(m => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{roleLabel(m.role)}</td>
                    <td><button className={styles.deleteBtn} onClick={() => deleteManager(m.id)}>מחק</button></td>
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
