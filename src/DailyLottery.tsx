import React, { useState } from 'react';

export function DailyLottery({ refresh, say }: { refresh?: () => any; say: (s: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="card promo" style={{ marginTop: 16 }}>
      <div className="section-head">
        <div className="square mint" style={{ fontSize: 24, display: 'grid', placeItems: 'center' }}>
          🎟️
        </div>
        <div>
          <h3>Daily Wiener Lottery</h3>
          <p>Watch ads to earn tickets for the daily jackpot</p>
        </div>
      </div>
      <button
        className="secondary"
        style={{ marginTop: 12, width: '100%' }}
        onClick={() => {
          say('Daily lottery drawing occurs every 24 hours!');
          setOpen(true);
        }}
      >
        VIEW LOTTERY TICKETS
      </button>

      {open && (
        <div className="reward-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="reward-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reward-modal-icon">🎟️</div>
            <h2>Daily Lottery</h2>
            <div className="reward-modal-amount" style={{ color: '#fbbf24' }}>
              100,000 WIENER
            </div>
            <p style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.5, margin: '10px 0 18px' }}>
              Each ad you complete today automatically grants you 1 entry ticket. Lucky winners are selected randomly each night.
            </p>
            <button className="primary" onClick={() => setOpen(false)}>
              CLOSE
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
