export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'method_not_allowed'});
  res.setHeader('Cache-Control','no-store');
  return res.status(410).json({ok:false,error:'feature_removed',message:'Treasury Chest has been removed from WIENER Farm.'});
}
