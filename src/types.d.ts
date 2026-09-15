declare module 'pako' {
  export function ungzip(data: Uint8Array, options?: {to?: 'string'}): string | Uint8Array;
}

declare global {
  interface Window {
    Telegram?: {WebApp?: any};
    Adsgram?: {init:(opts:{blockId:string})=>{show:()=>Promise<any>}};
  }
}
export {};
