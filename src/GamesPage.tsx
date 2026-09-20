import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import './games-arcade.css';

type Game = {id:string;title:string;url:string;thumb:string;category:string;tags:string;description:string;instructions:string};
const RECENT = 'wf-arcade-recent-v1';
function readable(value:string) {
  const el = document.createElement('textarea');
  el.innerHTML = value;
  const first = el.value;
  el.innerHTML = first;
  return el.value;
}
function readRecent():string[] {
  try { const ids = JSON.parse(localStorage.getItem(RECENT) || '[]'); return Array.isArray(ids) ? ids.filter(x=>typeof x==='string').slice(0,4) : []; } catch { return []; }
}
function GameImage({game}:{game:Game}) {
  const [failed,setFailed] = useState(false);
  return game.thumb && !failed ? <img src={game.thumb} alt="" loading="lazy" decoding="async" onError={()=>setFailed(true)}/> : <span className="wa-image-fallback" aria-hidden="true">▶</span>;
}
function GamePlayer({game,onClose}:{game:Game;onClose:()=>void}) {
  const root = useRef<HTMLDivElement>(null), back = useRef<HTMLButtonElement>(null);
  const [attempt,setAttempt] = useState(0), [slow,setSlow] = useState(false), [hint,setHint] = useState('');
  const [expanded,setExpanded] = useState(false);
  useEffect(()=>{
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; back.current?.focus();
    const key = (event:KeyboardEvent)=>{
      if(event.key==='Escape') onClose();
      if(event.key==='Tab' && root.current) {
        const nodes = Array.from(root.current.querySelectorAll<HTMLElement>('button,a,iframe,summary'));
        const first=nodes[0], last=nodes[nodes.length-1];
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus()}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus()}
      }
    };
    const tg = (window as any).Telegram?.WebApp;
    const wasVisible = tg?.BackButton?.isVisible;
    tg?.BackButton?.show?.(); tg?.BackButton?.onClick?.(onClose);
    document.addEventListener('keydown',key);
    return ()=>{
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown',key);
      tg?.BackButton?.offClick?.(onClose);
      if(!wasVisible) tg?.BackButton?.hide?.();
      previous?.focus();
    };
  },[onClose]);
  useEffect(()=>{setSlow(false);const timer=window.setTimeout(()=>setSlow(true),15000);return ()=>window.clearTimeout(timer)},[attempt]);
  const fullscreen = async()=>{
    if(!root.current?.requestFullscreen){setHint('Fullscreen is unavailable here. The game already fills the app.');return}
    try { if(document.fullscreenElement) await document.exitFullscreen(); else await root.current.requestFullscreen(); }
    catch { setHint('Fullscreen is unavailable here. The game already fills the app.'); }
  };
  const close = ()=>{if(document.fullscreenElement) void document.exitFullscreen().catch(()=>{});onClose()};
  return createPortal(<div className="wa-player" ref={root} role="dialog" aria-modal="true" aria-label={readable(game.title)}>
    <header className="wa-player-head"><button ref={back} onClick={close}>← Back</button><strong>{readable(game.title)}</strong><button onClick={fullscreen} aria-label="Toggle fullscreen">⛶</button></header>
    <div className="wa-player-tools"><button onClick={()=>setExpanded(x=>!x)} aria-expanded={expanded}>How to play</button><button onClick={()=>setAttempt(x=>x+1)}>Reload game</button></div>
    {expanded && <p className="wa-instructions">{readable(game.instructions || 'Follow the instructions inside the game.')}</p>}
    {hint && <p className="wa-player-hint" role="status">{hint}</p>}
    <iframe key={attempt} className="wa-game-frame" src={game.url} title={readable(game.title)} allow="autoplay; fullscreen; gamepad" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-pointer-lock" onError={()=>setSlow(true)}/>
    {slow && <div className="wa-player-help">Game not starting? Try Reload game or choose another game.</div>}
  </div>,document.body);
}
export function GamesPage(){
  const [games,setGames] = useState<Game[]>([]), [loading,setLoading] = useState(true), [error,setError] = useState('');
  const [retry,setRetry] = useState(0), [query,setQuery] = useState(''), [category,setCategory] = useState('All');
  const [selected,setSelected] = useState<Game|null>(null), [recent,setRecent] = useState<string[]>(readRecent);
  const closeRef = useRef(()=>setSelected(null));
  useEffect(()=>{
    const controller = new AbortController(); let alive=true;
    const timer=window.setTimeout(()=>controller.abort(),15000);
    setLoading(true);setError('');
    fetch('/api/games',{signal:controller.signal}).then(async r=>{
      if(!r.ok) throw Error('unavailable');
      const data=await r.json();if(!Array.isArray(data.games))throw Error('invalid');
      if(alive)setGames(data.games);
    }).catch(()=>{if(alive)setError('Games could not load. Please try again.')}).finally(()=>{window.clearTimeout(timer);if(alive)setLoading(false)});
    return ()=>{alive=false;window.clearTimeout(timer);controller.abort()};
  },[retry]);
  const open=(game:Game)=>{
    const ids=[game.id,...recent.filter(id=>id!==game.id)].slice(0,4);
    setRecent(ids);try{localStorage.setItem(RECENT,JSON.stringify(ids))}catch{}
    setSelected(game);
  };
  const categories=['All',...new Set(games.map(g=>g.category))];
  const matches=games.filter(g=>(category==='All'||g.category===category)&&readable(`${g.title} ${g.tags}`).toLowerCase().includes(query.trim().toLowerCase()));
  const recentGames=recent.map(id=>games.find(g=>g.id===id)).filter((g):g is Game=>!!g);
  return <section className="wa-arcade" aria-label="Wiener Arcade">
    <header className="wa-heading"><div><span>WIENER ARCADE</span><h1>Pick. Play. Repeat.</h1></div><span className="wa-count">{loading?'…':games.length} games</span></header>
    <label className="wa-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a game" aria-label="Search games"/></label>
    <div className="wa-categories" aria-label="Game categories">{categories.map(c=><button key={c} aria-pressed={c===category} onClick={()=>setCategory(c)}>{c}</button>)}</div>
    {!query && category==='All' && recentGames.length>0 && <section className="wa-recent"><h2>Recently played</h2><div>{recentGames.map(g=><button key={g.id} onClick={()=>open(g)}><GameImage game={g}/><span>{readable(g.title)}</span></button>)}</div></section>}
    <div className="wa-section-title"><h2>{category==='All'?'Latest games':category}</h2><small>GameMonetize</small></div>
    {loading ? <div className="wa-grid" role="status" aria-label="Loading games">{Array.from({length:6},(_,i)=><div className="wa-skeleton" key={i}/>)}</div> : error ? <div className="wa-empty" role="alert"><p>{error}</p><button onClick={()=>setRetry(x=>x+1)}>Try again</button></div> : matches.length===0 ? <div className="wa-empty"><p>No games match your search.</p><button onClick={()=>{setQuery('');setCategory('All')}}>Show all games</button></div> : <div className="wa-grid">{matches.map(g=><button className="wa-card" key={g.id} onClick={()=>open(g)} aria-label={`Play ${readable(g.title)}`}><div className="wa-card-art"><GameImage game={g}/><span className="wa-play-mark" aria-hidden="true">▶</span></div><div className="wa-card-copy"><small>{g.category}</small><h3>{readable(g.title)}</h3><span>Play now <b aria-hidden="true">↗</b></span></div></button>)}</div>}
    {selected && <GamePlayer game={selected} onClose={closeRef.current}/>}
  </section>;
}
