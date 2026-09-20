import React from 'react';
import type { Snapshot } from '../lib';

export function V2App({
  data,
  onExit,
}: {
  data: Snapshot;
  refresh: any;
  say: any;
  run: any;
  runFarm: any;
  onExit: () => void;
}) {
  return (
    <div className="app-shell" style={{ padding: 20 }}>
      <section className="card">
        <div className="eyebrow">WIENER V2 PREVIEW</div>
        <h2>🧪 Next-Gen Interface</h2>
        <p style={{ opacity: 0.7, margin: '10px 0 16px' }}>You are testing the upcoming V2 design layout.</p>
        <button className="primary" onClick={onExit}>
          BACK TO V1 APP
        </button>
      </section>
    </div>
  );
}
