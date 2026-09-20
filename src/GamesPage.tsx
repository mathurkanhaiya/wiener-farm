import React from 'react';
import { SpinEarn } from './SpinEarn';
import { WeeklyAdLeagueV88 } from './WeeklyAdLeagueV88';

export function GamesPage() {
  return (
    <div className="games-page-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-title">
        <h2>PLAY & EARN</h2>
      </div>

      <section className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 32 }}>🎡</div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Lucky Spin Wheel</h3>
            <p style={{ margin: '2px 0 0', opacity: 0.7, fontSize: 13 }}>Spin the wheel for TON & WIENER rewards</p>
          </div>
        </div>
        <SpinEarn refresh={() => {}} say={() => {}} />
      </section>

      <section className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 32 }}>🏆</div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Weekly Ad League</h3>
            <p style={{ margin: '2px 0 0', opacity: 0.7, fontSize: 13 }}>Compete with top farmers for big prize pools</p>
          </div>
        </div>
        <WeeklyAdLeagueV88 />
      </section>
    </div>
  );
}
