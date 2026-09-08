import fs from 'node:fs';

const app='src/App.tsx';
const i18n='src/i18n.tsx';
const localized='src/LocalizedSurface.tsx';
if(!fs.existsSync(app)||!fs.existsSync(i18n)||!fs.existsSync(localized))throw new Error('Localization source files missing');

// 1) Make the core t() resolver use the large translation packs too.
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

// 2) Mount the repo's comprehensive localization observer. It already knows
// dynamic labels, placeholders, mandatory join, farm/ads/promo/wallet states,
// errors and other UI that is still hard-coded in components.
let s=fs.readFileSync(app,'utf8');
// Do not run the older partial translator together with LocalizedSurface;
// two mutation observers translating the same node can fight each other.
s=s.replace("import {FullUiTranslator} from './FullUiTranslator';\n",'');
s=s.replace('<FullUiTranslator/>','');
const imp="import {LocalizedSurface} from './LocalizedSurface';";
if(!s.includes(imp)){
  const anchor="import {RestrictedSticker} from './RestrictedSticker';";
  if(!s.includes(anchor))throw new Error('LocalizedSurface import anchor missing');
  s=s.replace(anchor,`${anchor}\n${imp}`);
}
if(!s.includes('<LocalizedSurface/>')){
  const anchor='return <div className="app-shell"><EconomyUiPatch/>';
  if(!s.includes(anchor))throw new Error('LocalizedSurface mount anchor missing');
  s=s.replace(anchor,'return <div className="app-shell"><LocalizedSurface/><EconomyUiPatch/>');
}
fs.writeFileSync(app,s);
console.log('Complete localization packs + LocalizedSurface wired');
