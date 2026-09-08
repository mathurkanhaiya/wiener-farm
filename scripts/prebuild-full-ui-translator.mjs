import fs from 'node:fs';

const app='src/App.tsx';
const i18n='src/i18n.tsx';
const localized='src/LocalizedSurface.tsx';
const legacy='src/FullUiTranslator.tsx';
const v75='src/i18n-v75.ts';
if(!fs.existsSync(app)||!fs.existsSync(i18n)||!fs.existsSync(localized)||!fs.existsSync(legacy)||!fs.existsSync(v75))throw new Error('Localization source files missing');

let i=fs.readFileSync(i18n,'utf8');
if(!i.includes("import {EXTRA_PACKS} from './i18n-extra';")){
  const anchor="import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';";
  if(!i.includes(anchor))throw new Error('i18n import anchor missing');
  i=i.replace(anchor,`${anchor}\nimport {EXTRA_PACKS} from './i18n-extra';\nimport {POPUP_PACKS} from './i18n-popups';`);
}
const oldResolver="t:(key,fallback)=>packs[lang]?.[key]||en[key]||fallback||key";
const newResolver="t:(key,fallback)=>POPUP_PACKS[lang]?.[key]||EXTRA_PACKS[lang]?.[key]||packs[lang]?.[key]||en[key]||fallback||key";
if(i.includes(oldResolver))i=i.replace(oldResolver,newResolver);
if(!i.includes(newResolver))throw new Error('i18n resolver patch failed');
fs.writeFileSync(i18n,i);

let l=fs.readFileSync(legacy,'utf8');
if(l.includes('const M:Partial<Record<LangCode,P>>='))l=l.replace('const M:Partial<Record<LangCode,P>>=','export const FULL_UI_PACKS:Partial<Record<LangCode,P>>=');
if(!l.includes('export const FULL_UI_PACKS:'))throw new Error('Full UI phrase pack export failed');
l=l.replace(/\bM\['pt-BR'\]=M\.pt;/g,"FULL_UI_PACKS['pt-BR']=FULL_UI_PACKS.pt;");
l=l.replace(/\bM\[lang\]/g,'FULL_UI_PACKS[lang]');
fs.writeFileSync(legacy,l);

let loc=fs.readFileSync(localized,'utf8');
if(!loc.includes("import {FULL_UI_PACKS} from './FullUiTranslator';")){
  const anchor="import {POPUP_PACKS} from './i18n-popups';";
  if(!loc.includes(anchor))throw new Error('LocalizedSurface import anchor missing');
  loc=loc.replace(anchor,`${anchor}\nimport {FULL_UI_PACKS} from './FullUiTranslator';\nimport {V75_PACKS} from './i18n-v75';`);
}else if(!loc.includes("import {V75_PACKS} from './i18n-v75';")){
  loc=loc.replace("import {FULL_UI_PACKS} from './FullUiTranslator';", "import {FULL_UI_PACKS} from './FullUiTranslator';\nimport {V75_PACKS} from './i18n-v75';");
}

// Extend dynamic text handling while preserving all user amounts/counters/token names.
const dynamicTail=" if((m=original.match(/^You could[’']ve earned\\s+(.+?)\\s+more WIENER\\s+by visiting the advertiser\\.?$/i)))return fill(tr('dynamic.couldEarn','You could have earned {value} more WIENER by visiting the advertiser.'),m[1]);\n return null;\n}\n\nexport function LocalizedSurface";
if(loc.includes(dynamicTail)){
 const extended=" if((m=original.match(/^You could[’']ve earned\\s+(.+?)\\s+more WIENER\\s+by visiting the advertiser\\.?$/i)))return fill(tr('dynamic.couldEarn','You could have earned {value} more WIENER by visiting the advertiser.'),m[1]);\n if((m=original.match(/^CLAIM DAY 7 \\+ ⭐ · ([\\d.,]+) WIENER$/i)))return `${tr('common.claim','Claim')} ${m[1]} WIENER · ⭐`;\n if((m=original.match(/^CLAIM ([\\d.,]+) WIENER$/i)))return `${tr('common.claim','Claim')} ${m[1]} WIENER`;\n if((m=original.match(/^Week (\\d+) · Day (\\d+) claimed$/i)))return `#${m[1]} · ${fill(tr('dynamic.dayOf','Day {value} of 7'),m[2])} · ${tr('daily.claimedToday','Claimed')}`;\n if((m=original.match(/^Week (\\d+) · Day (\\d+) of 7$/i)))return `#${m[1]} · ${fill(tr('dynamic.dayOf','Day {value} of 7'),m[2])}`;\n if((m=original.match(/^Minimum withdrawal is ([\\d.]+) TON$/i)))return `${tr('wallet.minimum','Minimum')} ${m[1]} TON`;\n if((m=original.match(/^WATCH AD · (\\d+\\/\\d+)$/i)))return `${tr('common.watch','Watch')} · ${m[1]}`;\n if((m=original.match(/^AdsGram — (\\d+) ads$/i)))return `AdsGram — ${m[1]} ${tr('nav.ads','Ads')}`;\n if((m=original.match(/^Bonus Ads — (\\d+) ads$/i)))return `${tr('nav.ads','Ads')} — ${m[1]}`;\n if((m=original.match(/^(.+ WIENER · \\d+\\/\\d+) today$/i)))return fill(tr('dynamic.adsToday','{value} today'),m[1]);\n if((m=original.match(/^WATCH AD → \\+1 SPIN \\((\\d+) left\\)$/i)))return `${tr('common.watch','Watch')} → +1 SPIN (${m[1]})`;\n return null;\n}\n\nexport function LocalizedSurface";
 loc=loc.replace(dynamicTail,extended);
}

const oldTranslate="const translate=(source:string)=>{if(lang==='en'||technicalOnly(source))return source;const key=exact[source];if(key)return tr(key,source);return dynamicTranslate(source,tr)||source};";
const midTranslate="const translate=(source:string)=>{if(lang==='en'||technicalOnly(source))return source;const direct=FULL_UI_PACKS[lang]?.[source];if(direct)return direct;const key=exact[source];if(key)return tr(key,source);return dynamicTranslate(source,tr)||source};";
const v75Translate="const translate=(source:string)=>{if(lang==='en'||technicalOnly(source))return source;const newest=(V75_PACKS[lang] as any)?.[source];if(newest)return newest;const direct=FULL_UI_PACKS[lang]?.[source];if(direct)return direct;const key=exact[source];if(key)return tr(key,source);return dynamicTranslate(source,tr)||source};";
const normalizedTranslate="const translate=(source:string)=>{if(lang==='en'||technicalOnly(source))return source;const clean=source.replace(/^[^\\p{L}\\p{N}@]+/u,'').replace(/[→✓×]+$/u,'').trim();const vpack=V75_PACKS[lang] as any,fpack=FULL_UI_PACKS[lang] as any;const ci=(obj:any)=>Object.entries(obj||{}).find(([k])=>k.toLocaleLowerCase()===clean.toLocaleLowerCase())?.[1] as string|undefined;const newest=vpack?.[source]||vpack?.[clean]||ci(vpack);if(newest)return newest;const direct=fpack?.[source]||fpack?.[clean]||ci(fpack);if(direct)return direct;const key=exact[source]||exact[clean]||Object.entries(exact).find(([k])=>k.toLocaleLowerCase()===clean.toLocaleLowerCase())?.[1];if(key)return tr(key,source);const dyn=dynamicTranslate(source,tr)||dynamicTranslate(clean,tr);if(dyn)return dyn;if(/(?:verification failed|request failed|could not load|something went wrong|SDK unavailable|Block ID is not configured|temporarily unavailable)/i.test(source))return tr('common.unavailable','Temporarily unavailable');if(/invite link copied/i.test(source))return tr('invite.copied','Invite link copied');if(/no (?:partner |sponsored )?tasks? (?:right now|here)/i.test(source))return tr('tasks.none','No tasks right now.');if(/account restricted/i.test(source))return tr('system.restricted','Account restricted');return source};";
if(loc.includes(oldTranslate))loc=loc.replace(oldTranslate,normalizedTranslate);
else if(loc.includes(midTranslate))loc=loc.replace(midTranslate,normalizedTranslate);
else if(loc.includes(v75Translate))loc=loc.replace(v75Translate,normalizedTranslate);
if(!loc.includes(normalizedTranslate))throw new Error('LocalizedSurface normalized translation merge failed');
fs.writeFileSync(localized,loc);

let s=fs.readFileSync(app,'utf8');
s=s.replace("import {FullUiTranslator} from './FullUiTranslator';\n",'');
s=s.replace('<FullUiTranslator/>','');
const imp="import {LocalizedSurface} from './LocalizedSurface';";
if(!s.includes(imp)){
  const anchor="import {RestrictedSticker} from './RestrictedSticker';";
  if(!s.includes(anchor))throw new Error('LocalizedSurface App import anchor missing');
  s=s.replace(anchor,`${anchor}\n${imp}`);
}
if(!s.includes('<LocalizedSurface/>')){
  const anchor='return <div className="app-shell"><EconomyUiPatch/>';
  if(!s.includes(anchor))throw new Error('LocalizedSurface mount anchor missing');
  s=s.replace(anchor,'return <div className="app-shell"><LocalizedSurface/><EconomyUiPatch/>');
}
fs.writeFileSync(app,s);
console.log('V75 translations + normalized/dynamic UI variants active');
