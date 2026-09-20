import React from 'react';
import type { Snapshot } from './lib';
import { WalletV2 } from './WithdrawV3';

export function WithdrawAdGate({ data, setTab }: { data: Snapshot; setTab: (t: any) => void }) {
  return <WalletV2 data={data} setTab={setTab} />;
}
