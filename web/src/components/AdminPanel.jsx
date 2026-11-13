import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { POLL_MS } from '../lib/polling.js';

const STATUS_LABELS = { active: 'Aktif', pending: 'Onay bekliyor', rejected: 'Reddedildi', disabled: 'Kapatıldı' };

function actionsFor(user) {
  if (user.status === 'pending') return [['approve', 'Onayla'], ['reject', 'Reddet']];
  if (user.status === 'disabled') return [['enable', 'Aç']];
  if (user.status === 'active') {
    return [['disable', 'Kapat'], user.isAdmin ? ['demote', 'Yöneticiliği al'] : ['promote', 'Yönetici yap']];
  }
  return [];
}

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  const load = () => api.adminListUsers().then(setUsers).catch((err) => setError(err.message));
  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  async function run(id, action) {
    setError('');
    try {
      await api.adminAction(id, action);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const pending = users.filter((u) => u.status === 'pending');
  const others = users.filter((u) => u.status !== 'pending');

  const renderRow = (u) => (
    <div key={u.id} className="admin-row">
      <span>
        {u.username} {u.isAdmin && <em>(yönetici)</em>} <small>{STATUS_LABELS[u.status]}</small>
      </span>
      <span>
        {actionsFor(u).map(([action, label]) => (
          <button key={action} className="link" onClick={() => run(u.id, action)}>
            {label}
          </button>
        ))}
      </span>
    </div>
  );

  return (
    <div className="admin-panel">
      <h2>Hesaplar</h2>
      {error && <p className="error">{error}</p>}
      <h3>Bekleyen hesaplar</h3>
      {pending.length === 0 ? <p className="subtitle">Bekleyen hesap yok.</p> : pending.map(renderRow)}
      <h3>Tüm hesaplar</h3>
      {others.map(renderRow)}
    </div>
  );
}
