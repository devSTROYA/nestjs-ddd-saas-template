export abstract class UuidV7Id {
  protected constructor(readonly value: string) {}

  equals(other: UuidV7Id): boolean {
    return this.constructor === other.constructor && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}
