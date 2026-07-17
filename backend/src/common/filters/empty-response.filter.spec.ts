import { ArgumentsHost } from '@nestjs/common';
import { EmptyError } from 'rxjs';
import { EmptyResponseExceptionFilter } from './empty-response.filter';

function buildHost(response: Partial<{ headersSent: boolean }>): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({}),
      getNext: () => undefined,
    }),
  } as unknown as ArgumentsHost;
}

describe('EmptyResponseExceptionFilter', () => {
  let filter: EmptyResponseExceptionFilter;

  beforeEach(() => {
    filter = new EmptyResponseExceptionFilter();
  });

  it('does not attempt to write to a response that was already sent (no throw, no write call)', () => {
    const host = buildHost({ headersSent: true });
    expect(() => filter.catch(new EmptyError(), host)).not.toThrow();
  });

  it('does not throw even when the response was never sent (defensive fallback)', () => {
    const host = buildHost({ headersSent: false });
    expect(() => filter.catch(new EmptyError(), host)).not.toThrow();
  });
});
