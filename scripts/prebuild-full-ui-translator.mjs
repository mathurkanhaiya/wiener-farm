import fs from 'node:fs';

const app='src/App.tsx';
const i18n='src/i18n.tsx';
const localized='src/LocalizedSurface.tsx';
const legacy='src/FullUiTranslator.tsx';
if(!fs.existsSync(app)||!fs.existsSync(i18n)||!fs.existsSync(localized)||!fs.existsSync(legacy))throw new Error('Localization source files missing');

// 1) Core t() must use the full existing dictionaries instead of falling back to English.
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

// 2) Reuse the direct phrase translations from the previous translator as a dictionary,
// but do not mount its second MutationObserver.
let l=fs.readFileSync(legacy,'utf8');
if(l.includes('const M:Partial<Record<LangCode,P>>='))l=l.replace('const M:Partial<Record<LangCode,P>>=','export const FULL_UI_PACKS:Partial<Record<LangCode,P>>=');
if(!l.includes('export const FULL_UI_PACKS:'))throw new Error('Full UI phrase pack export failed');
l=l.replace(/\bM\['pt-BR'\]=M\.pt;/g,"FULL_UI_PACKS['pt-BR']=FULL_UI_PACKS.pt;");
l=l.replace(/\bM\[lang\]/g,'FULL_UI_PACKS[lang]');
fs.writeFileSync(legacy,l);

// 3) Make LocalizedSurface resolve direct hard-coded phrases first, then semantic packs.
let loc=fs.readFileSync(localized,'utf8');
if(!loc.includes("import {FULL_UI_PACKS} from './FullUiTranslator';")){
  const anchor="import {POPUP_PACKS} from './i18n-popups';";
  if(!loc.includes(anchor))throw new Error('LocalizedSurface import anchor missing');
  loc=loc.replace(anchor,`${anchor}\nimport {FULL_UI_PACKS} from './FullUiTranslator';`);
}
const oldTranslate="const translate=(source:string)=>{if(lang==='en'||technicalOnly(source))return source;const key=exact[source];if(key)return tr(key,source);return dynamicTranslate(source,tr)||source};";
const newTranslate="const translate=(source:string)=>{if(lang==='en'||technicalOnly(source))return source;const direct=FULL_UI_PACKS[lang]?.[source];if(direct)return direct;const key=exact[source];if(key)return tr(key,source);return dynamicTranslate(source,tr)||source};";
if(loc.includes(oldTranslate))loc=loc.replace(oldTranslate,newTranslate);
if(!loc.includes(newTranslate))throw new Error('LocalizedSurface direct phrase merge failed');
fs.writeFileSync(localized,loc);

// 4) Mount one comprehensive localization observer in the actual app.
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
console.log('Merged base + extra + popup + direct phrase translation layers');
