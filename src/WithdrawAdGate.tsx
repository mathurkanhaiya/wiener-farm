import {WithdrawV3} from './WithdrawV3';
import type {Snapshot} from './lib';
export function WithdrawAdGate({data,setTab,refresh,say}:{data:Snapshot;setTab:any;refresh?:any;say?:any}){return <WithdrawV3 data={data} setTab={setTab} refresh={refresh} say={say}/>;}
