import { useState } from 'react';
import { useStore } from '../state/store.js';
import { api } from '../lib/api.js';
import PinPad from '../components/PinPad.jsx';

export default function LoginScreen({ onLoggedIn }) {
  const { deviceToken, rememberedUsername, setSession, setAuthPending, setDeviceToken, clearDevice } = useStore();
  const [mode, setMode] = useState(deviceToken ? 'pin' : 'password');
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pendingUser, setPendingUser] = useState(null); // for post-login pin setup

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const result = isRegister ? await api.register(username, password) : await api.login(username, password);
      setAuthPending(result);
      setPendingUser(result);
      setMode('setpin');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSetPin(pin) {
    setError('');
    try {
      const { deviceToken: newToken } = await api.setPin(pin);
      setDeviceToken(newToken, pendingUser.username);
      setSession(pendingUser);
      onLoggedIn();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePinLogin(pin) {
    setError('');
    try {
      const result = await api.loginWithPin(deviceToken, pin);
      setSession(result);
      onLoggedIn();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="screen">
      <div className="card">
        <h1>Ipchat</h1>

        {mode === 'pin' && (
          <>
            <p className="subtitle">Merhaba {rememberedUsername}, PIN'ini gir</p>
            <PinPad onSubmit={handlePinLogin} submitLabel="Giriş yap" error={error} />
            <button
              className="link"
              onClick={() => {
                clearDevice();
                setMode('password');
                setError('');
              }}
            >
              Farklı hesapla giriş yap
            </button>
          </>
        )}

        {mode === 'password' && (
          <>
            <p className="subtitle">{isRegister ? 'Yeni hesap oluştur' : 'Kullanıcı adı ve şifre ile giriş yap'}</p>
            <form onSubmit={handlePasswordSubmit}>
              <input
                placeholder="Kullanıcı adı"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
              <input
                type="password"
                placeholder="Şifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <p className="error">{error}</p>}
              <button type="submit">{isRegister ? 'Kayıt ol' : 'Giriş yap'}</button>
            </form>
            <button className="link" onClick={() => setIsRegister(!isRegister)}>
              {isRegister ? 'Zaten hesabım var' : 'Hesabım yok, kayıt olmak istiyorum'}
            </button>
          </>
        )}

        {mode === 'setpin' && (
          <>
            <p className="subtitle">Bu cihaz için 4 haneli hızlı giriş PIN'i belirle</p>
            <PinPad onSubmit={handleSetPin} submitLabel="PIN'i kaydet" error={error} />
          </>
        )}
      </div>
    </div>
  );
}
