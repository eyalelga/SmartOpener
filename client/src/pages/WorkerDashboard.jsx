import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../api/client'
import styles from './WorkerDashboard.module.css'

const DOORS = [1, 2, 3, 4]

export default function WorkerDashboard() {
  const { user, logout } = useAuth()
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)

  // Selected station → PIN screen → doors
  const [selected, setSelected] = useState(null) // station object
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinVerified, setPinVerified] = useState(false)

  // Door feedback
  const [feedback, setFeedback] = useState({})

  useEffect(() => {
    api.get('/stations')
      .then(r => setStations(r.data))
      .finally(() => setLoading(false))
  }, [])

  const selectStation = (station) => {
    setSelected(station)
    setPin('')
    setPinError('')
    setPinVerified(false)
    setFeedback({})
  }

  const verifyPin = async (e) => {
    e.preventDefault()
    setPinError('')
    // Verify by attempting a "test" open — actually, send a real open with pin and see if it passes
    // Better: verify pin directly before showing buttons
    try {
      // We verify PIN by calling open with door=0 as a check — but cleaner: try door 1 won't work.
      // Instead we keep it client-only: store pin in state and send it with each open request.
      // If PIN is wrong, server returns 403 on first open.
      if (pin.length < 4) { setPinError('PIN חייב להיות 4 ספרות'); return }
      setPinVerified(true)
    } catch { setPinError('שגיאה') }
  }

  const openDoor = async (door) => {
    const key = String(door)
    setFeedback(p => ({ ...p, [key]: 'שולח...' }))
    try {
      await api.post(`/stations/${selected.id}/open`, { door, pin })
      setFeedback(p => ({ ...p, [key]: '✓ נפתח' }))
    } catch (err) {
      const msg = err.response?.data?.error ?? 'שגיאה'
      setFeedback(p => ({ ...p, [key]: `✗ ${msg}` }))
      if (err.response?.status === 403 && msg.includes('PIN')) {
        setPinVerified(false)
        setPinError(msg)
      }
    }
    setTimeout(() => setFeedback(p => { const n = { ...p }; delete n[key]; return n }), 2500)
  }

  // Back to station list
  const goBack = () => { setSelected(null); setPinVerified(false); setPin(''); setFeedback({}) }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={selected ? goBack : undefined} style={{ visibility: selected ? 'visible' : 'hidden' }}>
          ← חזור
        </button>
        <h1>SmartOpener</h1>
        <div className={styles.headerRight}>
          <span className={styles.userInfo}>{user.name}</span>
          <button className={styles.logoutBtn} onClick={logout}>התנתק</button>
        </div>
      </header>

      {/* STATION LIST */}
      {!selected && (
        <main className={styles.content}>
          {loading && <p className={styles.loading}>טוען...</p>}
          {!loading && stations.length === 0 && (
            <p className={styles.empty}>אין עמדות מוקצות לחשבונך. פנה למנהל.</p>
          )}
          <div className={styles.stationGrid}>
            {stations.map(s => (
              <button key={s.id} className={styles.stationCard} onClick={() => selectStation(s)}>
                <span className={styles.stationName}>{s.name}</span>
                {s.location && <span className={styles.stationLoc}>{s.location}</span>}
                <span className={s.agentConnected ? styles.online : styles.offline}>
                  {s.agentConnected ? 'מחובר' : 'מנותק'}
                </span>
              </button>
            ))}
          </div>
        </main>
      )}

      {/* PIN SCREEN */}
      {selected && !pinVerified && (
        <main className={styles.pinScreen}>
          <div className={styles.pinCard}>
            <p className={styles.pinStation}>{selected.name}</p>
            <h2 className={styles.pinTitle}>הכנס קוד PIN</h2>
            <form onSubmit={verifyPin} className={styles.pinForm}>
              <input
                className={styles.pinInput}
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                autoFocus
              />
              {pinError && <p className={styles.pinError}>{pinError}</p>}
              <button className={styles.pinBtn} type="submit" disabled={pin.length < 4}>
                אישור
              </button>
            </form>
          </div>
        </main>
      )}

      {/* DOOR BUTTONS */}
      {selected && pinVerified && (
        <main className={styles.doorsScreen}>
          <p className={styles.doorsStation}>{selected.name}</p>
          <div className={styles.doorsGrid}>
            {DOORS.map(door => (
              <button
                key={door}
                className={styles.doorBtn}
                onClick={() => openDoor(door)}
                disabled={!!feedback[String(door)]}
              >
                <span className={styles.doorNum}>{door}</span>
                <span className={styles.doorLabel}>{feedback[String(door)] ?? 'פתח'}</span>
              </button>
            ))}
          </div>
          <button
            className={styles.allBtn}
            onClick={() => openDoor('all')}
            disabled={!!feedback['all']}
          >
            {feedback['all'] ?? 'פתח הכל'}
          </button>
        </main>
      )}
    </div>
  )
}
