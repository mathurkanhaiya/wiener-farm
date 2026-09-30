import {type Snapshot} from './lib';
import {WalletV2} from './WithdrawV3';

/**
 * Withdrawal page.
 *
 * The old sponsor-ad lock/gate has been removed from the withdrawal flow.
 * Users go directly to the payout UI; existing gateway, wallet, amount,
 * cooldown and backend withdrawal checks remain handled by WalletV2.
 */
export function WithdrawAdGate({data,setTab}:{data:Snapshot;setTab:any}){
  return <WalletV2 data={data} setTab={setTab}/>;
}
