import type {Snapshot} from './lib';
import {WalletV2} from './WithdrawV3';

export function WithdrawAdGate({data,setTab}:{data:Snapshot;setTab:any}){
  return <WalletV2 data={data} setTab={setTab}/>;
}
