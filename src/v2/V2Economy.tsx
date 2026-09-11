import './v2-sandbox.css';

type Pool={name:string;source:string;budget:string;spent:string;status:string};
const pools:Pool[]=[
  {name:'Faucet','source':'Growth / ad profit','budget':'$5.00 / day','spent':'$0.00 test','status':'TEST'},
  {name:'Micro Tasks','source':'Sponsor / platform','budget':'Per campaign','spent':'$0.00 test','status':'TEST'},
  {name:'Offerwall','source':'Provider payout','budget':'Revenue share','spent':'$0.00 test','status':'TEST'},
  {name:'Giveaways','source':'Sponsor / marketing','budget':'Per draw','spent':'$0.00 test','status':'TEST'},
  {name:'Competitions','source':'Marketing pool','budget':'Weekly pool','spent':'$0.00 test','status':'TEST'},
  {name:'Referrals','source':'Acquisition budget','budget':'Rule based','spent':'Existing live','status':'LIVE'},
];

export function V2EconomyCenter(){
  return <div className="v2-sandbox-page">
    <div className="v2-sandbox-note"><b>🧪 ADMIN ECONOMY CENTER</b><span>Planning only · no real V2 spending controls are connected yet.</span></div>
    <section className="v2-economy-summary">
      <div><span>REVENUE TODAY</span><b>—</b><small>Connect analytics later</small></div>
      <div><span>V2 REWARDS</span><b>$0.00</b><small>Sandbox only</small></div>
      <div><span>EST. MARGIN</span><b>—</b><small>Not calculated yet</small></div>
      <div><span>LIABILITY</span><b>$0.00</b><small>Test credits excluded</small></div>
    </section>
    <section className="v2-economy-card"><div className="v2-economy-head"><div><span>FUNDING POOLS</span><h3>Every reward needs a source</h3></div><em>ADMIN ONLY</em></div>{pools.map(p=><article key={p.name}><div><b>{p.name}</b><span>{p.source}</span></div><div><strong>{p.budget}</strong><small>{p.spent}</small></div><em>{p.status}</em></article>)}</section>
    <section className="v2-economy-card"><div className="v2-economy-head"><div><span>SAFETY RULES</span><h3>Spending protection</h3></div></div><div className="v2-rule-grid"><div>✓ Global daily V2 budget</div><div>✓ Per-feature cap</div><div>✓ Per-campaign prepaid limit</div><div>✓ Emergency reward pause</div><div>✓ Server-side verification</div><div>✓ Admin audit trail</div></div></section>
    <section className="v2-economy-card"><div className="v2-economy-head"><div><span>FUNDING SOURCE TAGS</span><h3>Ledger classification</h3></div></div><div className="v2-chip-row"><i>ad_revenue</i><i>sponsor_prepaid</i><i>offerwall_revenue</i><i>growth_budget</i><i>acquisition_budget</i><i>competition_budget</i></div></section>
  </div>
}
