import { DomainError } from './domain-error.js';

class SampleError extends DomainError {
  constructor() {
    super('SAMPLE_CODE', 'Sample message');
  }
}

describe('DomainError', () => {
  it('exposes the code and uses the subclass name', () => {
    const error = new SampleError();
    expect(error.code).toBe('SAMPLE_CODE');
    expect(error.message).toBe('Sample message');
    expect(error.name).toBe('SampleError');
    expect(error).toBeInstanceOf(Error);
  });
});
