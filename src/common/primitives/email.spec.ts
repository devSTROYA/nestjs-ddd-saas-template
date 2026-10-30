import { Email } from './email.js';
import { InvalidEmailError } from './primitive.error.js';

const LOCAL_64 = 'a'.repeat(64);
const LABEL_63 = 'a'.repeat(63);

describe('Email', () => {
  it('trims and lowercases on create', () => {
    expect(Email.create('  Foo@Bar.com ').value).toBe('foo@bar.com');
  });

  it.each([
    'user@example.com',
    'user.name+tag@sub.example.co',
    "o'brien@example.com",
    'a@b.c',
    'a-b@x-y.example.com',
    `${LOCAL_64}@example.com`,
    `a@${LABEL_63}.com`,
  ])('accepts %s', (email) => {
    expect(Email.create(email).value).toBe(email);
  });

  it.each([
    '',
    'nope',
    'a@b',
    '@b.c',
    'a@',
    'a b@c.d',
    'a@@b.c',
    '.a@b.c',
    'a.@b.c',
    'a..b@c.d',
    'a@-b.c',
    'a@b-.c',
    'a@b..c',
    'a@b.c.',
    'ü@b.c',
    `${LOCAL_64}a@example.com`,
    `a@${LABEL_63}a.com`,
    `a@${`${'b'.repeat(60)}.`.repeat(5)}com`,
  ])('rejects %s', (email) => {
    expect(() => Email.create(email)).toThrow(InvalidEmailError);
  });

  it('compares by value', () => {
    expect(Email.create('A@b.c').equals(Email.create('a@B.c'))).toBe(true);
    expect(Email.create('a@b.c').equals(Email.create('x@b.c'))).toBe(false);
  });
});
