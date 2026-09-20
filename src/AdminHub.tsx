import React from 'react';

export function AdminHub({ say }: { say: (s: string) => void }) {
  return (
    <section className="card">
      <div className="eyebrow">ADMIN CONTROL CENTER</div>
      <h3>System Overview</h3>
      <p style={{ fontSize: 13, opacity: 0.7 }}>Server operations, metrics, and security monitors.</p>
      <button className="secondary" onClick={() => say('System status healthy')}>
        REFRESH STATUS
      </button>
    </section>
  );
}
