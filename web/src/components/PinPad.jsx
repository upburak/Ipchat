import { useState } from 'react';

export default function PinPad({ onSubmit, submitLabel = 'Giriş', error }) {
  const [pin, setPin] = useState('');

  function press(digit) {
    setPin((prev) => (prev.length < 4 ? prev + digit : prev));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (pin.length === 4) onSubmit(pin);
  }

  return (
    <form onSubmit={handleSubmit} className="pinpad">
      <div className="pin-dots">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`dot ${i < pin.length ? 'filled' : ''}`} />
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="pin-grid">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'].map((key) => (
          <button
            type="button"
            key={key}
            className="pin-key"
            onClick={() => {
              if (key === '⌫') setPin((prev) => prev.slice(0, -1));
              else if (key === '✓') handleSubmit({ preventDefault: () => {} });
              else press(key);
            }}
          >
            {key}
          </button>
        ))}
      </div>
      <button type="submit" disabled={pin.length !== 4}>
        {submitLabel}
      </button>
    </form>
  );
}
