import { WatchedList } from './watched-list.js';

class NumberList extends WatchedList<number> {
  protected compareItems(a: number, b: number): boolean {
    return a === b;
  }
}

describe('WatchedList', () => {
  it('starts with the initial items and no changes', () => {
    const list = new NumberList([1, 2]);

    expect(list.getItems()).toEqual([1, 2]);
    expect(list.getDeltas()).toEqual({ added: [], removed: [] });
  });

  it('tracks an added item once', () => {
    const list = new NumberList([1]);

    list.add(2);
    list.add(2);

    expect(list.getItems()).toEqual([1, 2]);
    expect(list.getDeltas()).toEqual({ added: [2], removed: [] });
  });

  it('does not report an initial item as added when it is added again', () => {
    const list = new NumberList([1]);

    list.add(1);

    expect(list.getDeltas()).toEqual({ added: [], removed: [] });
  });

  it('tracks a removed initial item', () => {
    const list = new NumberList([1, 2]);

    list.remove(1);

    expect(list.getItems()).toEqual([2]);
    expect(list.getDeltas()).toEqual({ added: [], removed: [1] });
  });

  it('forgets an item that was added and removed again', () => {
    const list = new NumberList([1]);

    list.add(2);
    list.remove(2);

    expect(list.getDeltas()).toEqual({ added: [], removed: [] });
  });

  it('forgets a removal when the item comes back', () => {
    const list = new NumberList([1]);

    list.remove(1);
    list.add(1);

    expect(list.getItems()).toEqual([1]);
    expect(list.getDeltas()).toEqual({ added: [], removed: [] });
  });

  it('ignores removing an item that is not there', () => {
    const list = new NumberList([1]);

    list.remove(9);

    expect(list.getDeltas()).toEqual({ added: [], removed: [] });
  });

  it('computes added and removed items when the content is replaced', () => {
    const list = new NumberList([1, 2, 3]);

    list.update([2, 3, 4]);

    expect(list.getItems()).toEqual([2, 3, 4]);
    expect(list.getDeltas()).toEqual({ added: [4], removed: [1] });
  });

  it('does not let callers change it through the returned arrays', () => {
    const list = new NumberList([1]);

    list.getItems().push(2);
    list.getDeltas().added.push(3);

    expect(list.getItems()).toEqual([1]);
    expect(list.getDeltas()).toEqual({ added: [], removed: [] });
  });
});
