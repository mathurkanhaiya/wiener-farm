declare module 'pako' {
  export function ungzip(data: Uint8Array, options?: {to?: 'string'}): Uint8Array | string;
}
