declare global {
  interface Window {
    Telegram?: {WebApp?: any};
    Adsgram?: {init:(opts:{blockId:string})=>{show:()=>Promise<any>}};
  }
}
export {};
