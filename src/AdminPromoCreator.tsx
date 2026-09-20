import React, { useState } from 'react';

export function AdminPromoCreator({ say }: { say: (s: string) => void }) {
  const [code, setCode] = useState('');
  const [reward, setReward] = useState('50');

  return (
    <section className="card">
      <div className="eyebrow">ADMIN TOOL</div>
      <h3>Promo Code Generator</h3>
      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <input placeholder="PROMO CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <input placeholder="WIENER REWARD" type="number" value={reward} onChange={(e) => setReward(e.target.value)} />
        <button
          className="primary"
          onClick={() => {
            if (!code.trim()) return;
            say(`Promo code ${code.trim()} configured with +${reward} WIENER`);
            setCode('');
          }}
        >
          CREATE PROMO CODE
        </button>
      </div>
    </section>
  );
}
