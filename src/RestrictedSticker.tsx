import {useEffect,useState} from 'react';
import Lottie from 'lottie-react';

type Sticker=
  | {kind:'lottie';data:any}
  | {kind:'image';url:string}
  | {kind:'video';url:string}
  | {kind:'fallback'};

const STICKER_URL='https://wiener-farm.vercel.app/api/host/restricted-cross';

async function ungzip(bytes:Uint8Array){
  if(typeof DecompressionStream==='undefined')throw new Error('gzip_unsupported');
  const copy=new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const stream=new Blob([copy.buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

export function RestrictedSticker(){
  const [asset,setAsset]=useState<Sticker|null>(null);
  useEffect(()=>{let dead=false;(async()=>{try{
    const r=await fetch(STICKER_URL,{cache:'force-cache'});
    if(!r.ok)throw new Error(`sticker_${r.status}`);
    const type=(r.headers.get('content-type')||'').toLowerCase();
    if(type.startsWith('image/')){if(!dead)setAsset({kind:'image',url:STICKER_URL});return}
    if(type.startsWith('video/')){if(!dead)setAsset({kind:'video',url:STICKER_URL});return}
    const bytes=new Uint8Array(await r.arrayBuffer());
    const text=bytes[0]===0x1f&&bytes[1]===0x8b?await ungzip(bytes):new TextDecoder().decode(bytes);
    const data=JSON.parse(text);
    if(!dead)setAsset({kind:'lottie',data});
  }catch{if(!dead)setAsset({kind:'fallback'})}})();return()=>{dead=true}},[]);

  if(!asset)return <div style={{fontSize:84,lineHeight:1}}>❌</div>;
  if(asset.kind==='lottie')return <Lottie animationData={asset.data} loop autoplay style={{width:128,height:128}}/>;
  if(asset.kind==='video')return <video src={asset.url} autoPlay loop muted playsInline preload="auto" style={{width:128,height:128,objectFit:'contain',display:'block'}}/>;
  if(asset.kind==='image')return <img src={asset.url} alt="Account restricted" style={{width:128,height:128,objectFit:'contain',display:'block'}}/>;
  return <div style={{fontSize:84,lineHeight:1}}>❌</div>;
}
