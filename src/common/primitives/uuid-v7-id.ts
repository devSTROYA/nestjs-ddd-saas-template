import { newUuidV7, parseUuidV7 } from './uuid-v7.js';

declare const idBrand: unique symbol;

// A UUID v7 string that only its own factory can mint, so ids of different aggregates never mix.
export type UuidV7Id<Name extends string> = string & { readonly [idBrand]: Name };

type UuidV7IdFactory<Id extends UuidV7Id<string>> = {
  // A new id for a new aggregate.
  generate(): Id;
  // Trusted value read from persistence. Skips validation, never use it on input.
  rehydrate(value: string): Id;
  // Validates untrusted input and throws InvalidIdError when it is not a UUID v7.
  parse(value: string): Id;
};

export function uuidV7IdFactory<Id extends UuidV7Id<string>>(): UuidV7IdFactory<Id> {
  return {
    generate: () => newUuidV7() as Id,
    rehydrate: (value) => value as Id,
    parse: (value) => parseUuidV7(value) as Id,
  };
}
