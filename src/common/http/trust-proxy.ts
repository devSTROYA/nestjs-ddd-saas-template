type TrustProxy = false | ((address: string, hop: number) => boolean);

export function trustProxy(hops: number): TrustProxy {
  return hops > 0 ? (_address, hop) => hop < hops : false;
}
