type WatchedListDeltas<T> = { added: T[]; removed: T[] };

export abstract class WatchedList<T> {
  private current: T[];
  private readonly initial: readonly T[];
  private added: T[] = [];
  private removed: T[] = [];

  constructor(initialItems: readonly T[] = []) {
    this.current = [...initialItems];
    this.initial = [...initialItems];
  }

  protected abstract compareItems(a: T, b: T): boolean;

  getItems(): T[] {
    return [...this.current];
  }

  getDeltas(): WatchedListDeltas<T> {
    return { added: [...this.added], removed: [...this.removed] };
  }

  exists(item: T): boolean {
    return this.isIn(this.current, item);
  }

  add(item: T): void {
    if (this.exists(item)) {
      return;
    }
    this.current.push(item);
    if (this.isIn(this.removed, item)) {
      this.removed = this.without(this.removed, item);
      return;
    }
    if (!this.isIn(this.initial, item)) {
      this.added.push(item);
    }
  }

  remove(item: T): void {
    if (!this.exists(item)) {
      return;
    }
    this.current = this.without(this.current, item);
    if (this.isIn(this.added, item)) {
      this.added = this.without(this.added, item);
      return;
    }
    if (this.isIn(this.initial, item)) {
      this.removed.push(item);
    }
  }

  update(items: readonly T[]): void {
    for (const item of this.current.filter((existing) => !this.isIn(items, existing))) {
      this.remove(item);
    }
    for (const item of items) {
      this.add(item);
    }
  }

  private isIn(items: readonly T[], item: T): boolean {
    return items.some((candidate) => this.compareItems(candidate, item));
  }

  private without(items: readonly T[], item: T): T[] {
    return items.filter((candidate) => !this.compareItems(candidate, item));
  }
}
