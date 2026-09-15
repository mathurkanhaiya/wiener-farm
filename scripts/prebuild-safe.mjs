import fs from 'node:fs';

// Minimal, deterministic prebuild. Do not rewrite application components here.
const lib='src/lib.ts';
if(fs.existsSync(lib)){
  const before=fs.readFileSync(lib,'utf8');
  const after=before.replace(
    "const viteEnv=(import.meta as any).env||{};\\n// V45 TON iOS browser compatibility",
    "const viteEnv=(import.meta as any).env||{};\n// V45 TON iOS browser compatibility"
  );
  if(after!==before)fs.writeFileSync(lib,after);
}
