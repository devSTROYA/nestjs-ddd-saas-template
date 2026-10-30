import { MailDeliveryError } from './mail.error.js';
import { type ResendClient, ResendMailTransport } from './resend-mail-transport.js';

const MESSAGE = { to: 'a@b.co', subject: 'Hi', text: 'plain', html: '<p>html</p>' };
const FROM = 'App <no-reply@example.com>';

const clientReturning = (result: Awaited<ReturnType<ResendClient['emails']['send']>>) => {
  const sent: Parameters<ResendClient['emails']['send']>[0][] = [];
  const client: ResendClient = {
    emails: {
      send: (payload) => {
        sent.push(payload);
        return Promise.resolve(result);
      },
    },
  };
  return { client, sent };
};

describe('ResendMailTransport', () => {
  it('sends the message from the configured sender', async () => {
    const { client, sent } = clientReturning({ error: null });

    await new ResendMailTransport(client, FROM).send(MESSAGE);

    expect(sent).toEqual([{ from: FROM, ...MESSAGE }]);
  });

  it('raises MailDeliveryError when Resend answers with an error', async () => {
    const { client } = clientReturning({ error: { message: 'domain not verified' } });

    await expect(new ResendMailTransport(client, FROM).send(MESSAGE)).rejects.toThrow(
      MailDeliveryError,
    );
  });

  it('wraps a network failure in MailDeliveryError', async () => {
    const client: ResendClient = {
      emails: { send: () => Promise.reject(new Error('socket hang up')) },
    };

    await expect(new ResendMailTransport(client, FROM).send(MESSAGE)).rejects.toThrow(
      /socket hang up/,
    );
    await expect(new ResendMailTransport(client, FROM).send(MESSAGE)).rejects.toBeInstanceOf(
      MailDeliveryError,
    );
  });
});
