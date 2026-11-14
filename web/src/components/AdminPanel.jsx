import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { POLL_MS } from '../lib/polling.js';
import { matchesSearch } from '../lib/format.js';
import { pollingPaused } from '../lib/dialog.js';
import ConfirmDialog from './ConfirmDialog.jsx';

const STATUS_LABELS = { active: 'Onaylı', pending: 'Onay bekliyor', rejected: 'Reddedildi', disabled: 'Kapatıldı' };
const STATUS_CHIPS = { active: 'chip-ok', pending: 'chip-wait', rejected: 'chip-off', disabled: 'chip-off' };

// Yalnizca bu islemler onay penceresi ister; metinler birebir.
const CONFIRMS = {
  reject: { confirmLabel: 'Reddet', message: (n) => `${n} adlı hesap reddedilsin mi? Bu kişi giriş yapamaz.` },
  disable: { confirmLabel: 'Kapat', message: (n) => `${n} adlı hesap kapatılsın mı? Açık oturumları sonlandırılır.` },
  demote: { confirmLabel: 'Yöneticiliği al', message: (n) => `${n} kişisinin yöneticiliği alınsın mı?` },
};

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
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rowError, setRowError] = useState(null); // { id, message }
  const [query, setQuery] = useState('');
  // Onay bekleyen islem: satir kimligi ve ad burada sabitlenir; liste yenilense de ayni kisiyi hedefler.
  const [confirming, setConfirming] = useState(null); // { id, username, action }
  const hoveringRef = useRef(false);
  const windowFocusedRef = useRef(typeof document === 'undefined' ? true : document.hasFocus());

  const load = () =>
    api
      .adminListUsers()
      .then((list) => {
        setUsers(list);
        setLoaded(true);
        setLoadError('');
      })
      .catch((err) => setLoadError(err.message));

  useEffect(() => {
    const onFocus = () => { windowFocusedRef.current = true; };
    const onBlur = () => { windowFocusedRef.current = false; };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    load();
    const timer = setInterval(() => {
      if (pollingPaused({ hovering: hoveringRef.current, windowFocused: windowFocusedRef.current })) return;
      load();
    }, POLL_MS);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  async function run(id, action) {
    if (busyId !== null) return;
    setBusyId(id);
    setRowError(null);
    try {
      await api.adminAction(id, action);
      await load();
    } catch (err) {
      setRowError({ id, message: err.message });
    } finally {
      setBusyId(null);
    }
  }

  function onActionClick(u, action) {
    if (CONFIRMS[action]) setConfirming({ id: u.id, username: u.username, action });
    else run(u.id, action);
  }

  function onConfirm() {
    const { id, action } = confirming;
    setConfirming(null);
    run(id, action);
  }

  const visible = users.filter((u) => matchesSearch(u.username, query));
  const pending = visible.filter((u) => u.status === 'pending');
  const others = visible.filter((u) => u.status !== 'pending');
  const pendingTotal = users.filter((u) => u.status === 'pending').length;
  const filtering = query.trim() !== '';
  const noMatch = <p className="subtitle">Eşleşen hesap yok.</p>;

  const renderRow = (u) => (
    <div key={u.id} className="admin-item">
      <div className="admin-row">
        <span className="admin-name">
          <span className="admin-username" title={u.username}>
            {u.username}
            {u.isAdmin && <em> (yönetici)</em>}
          </span>
          <span className="admin-meta">
            <span className={`chip ${STATUS_CHIPS[u.status] || 'chip-off'}`}>{STATUS_LABELS[u.status] || u.status}</span>
            <small>{u.online ? 'Çevrimiçi' : 'Çevrimdışı'}</small>
          </span>
        </span>
        <span className="admin-actions">
          {actionsFor(u).map(([action, label]) => (
            <button
              key={action}
              type="button"
              disabled={busyId === u.id}
              className={action === 'approve' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => onActionClick(u, action)}
            >
              {label}
            </button>
          ))}
        </span>
      </div>
      {rowError && rowError.id === u.id && <p className="error admin-row-error">{rowError.message}</p>}
    </div>
  );

  return (
    <div className="admin-panel">
      <h2>Hesaplar</h2>
      {loadError && <p className="error">{loadError}</p>}
      <label className="admin-search">
        <span>Hesap ara</span>
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div
        onMouseEnter={() => { hoveringRef.current = true; }}
        onMouseLeave={() => { hoveringRef.current = false; }}
      >
        <h3>Bekleyen hesaplar ({pendingTotal})</h3>
        {pending.map(renderRow)}
        {pending.length === 0 && filtering && noMatch}
        {pending.length === 0 && !filtering && loaded && pendingTotal === 0 && (
          <p className="subtitle">Bekleyen hesap yok.</p>
        )}
        <h3>Tüm hesaplar</h3>
        {others.map(renderRow)}
        {others.length === 0 && filtering && noMatch}
      </div>
      {confirming && (
        <ConfirmDialog
          message={CONFIRMS[confirming.action].message(confirming.username)}
          confirmLabel={CONFIRMS[confirming.action].confirmLabel}
          onConfirm={onConfirm}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
