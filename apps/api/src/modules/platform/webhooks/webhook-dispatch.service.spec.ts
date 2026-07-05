import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  WEBHOOK_SIGNATURE_HEADER,
  WebhookDispatchService,
  signWebhookPayload,
} from './webhook-dispatch.service';
import type { PrismaService } from '../../../prisma/prisma.service';

function makePrismaMock() {
  return {
    client: {
      webhookEndpoint: { findMany: vi.fn() },
      webhookDelivery: { create: vi.fn() },
    },
  };
}

describe('signWebhookPayload', () => {
  it('computes the HMAC-SHA256 hex digest of the raw body with the endpoint secret', () => {
    const secret = 'whsec_test';
    const body = JSON.stringify({ hello: 'world' });

    const signature = signWebhookPayload(secret, body);

    const expected = createHmac('sha256', secret).update(body).digest('hex');
    expect(signature).toEqual(expected);
  });

  it('produces a different signature for a different secret (tamper-evidence)', () => {
    const body = JSON.stringify({ hello: 'world' });
    expect(signWebhookPayload('secret-a', body)).not.toEqual(signWebhookPayload('secret-b', body));
  });
});

describe('WebhookDispatchService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: WebhookDispatchService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new WebhookDispatchService(prisma as unknown as PrismaService);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('only dispatches to active endpoints subscribed to the given organization + event', async () => {
    prisma.client.webhookEndpoint.findMany.mockResolvedValue([]);

    await service.dispatch('org_A', 'contact.created', { id: 'c1' });

    expect(prisma.client.webhookEndpoint.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org_A', isActive: true, events: { has: 'contact.created' } },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs a correctly HMAC-signed payload and records a successful delivery', async () => {
    prisma.client.webhookEndpoint.findMany.mockResolvedValue([
      { id: 'wh_1', url: 'https://example.com/hook', secret: 'whsec_abc', events: ['contact.created'] },
    ]);
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    prisma.client.webhookDelivery.create.mockResolvedValue({});

    await service.dispatch('org_A', 'contact.created', { id: 'c1' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toEqual('https://example.com/hook');
    expect(options.method).toEqual('POST');
    const headers = options.headers as Record<string, string>;
    expect(headers[WEBHOOK_SIGNATURE_HEADER]).toEqual(
      createHmac('sha256', 'whsec_abc').update(JSON.stringify({ id: 'c1' })).digest('hex'),
    );

    expect(prisma.client.webhookDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ endpointId: 'wh_1', event: 'contact.created', success: true, statusCode: 200 }),
    });
  });

  it('records a failed delivery (best-effort, no retry) when the endpoint is unreachable', async () => {
    prisma.client.webhookEndpoint.findMany.mockResolvedValue([
      { id: 'wh_1', url: 'https://example.com/hook', secret: 'whsec_abc', events: ['contact.created'] },
    ]);
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    prisma.client.webhookDelivery.create.mockResolvedValue({});

    await service.dispatch('org_A', 'contact.created', { id: 'c1' });

    expect(prisma.client.webhookDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ success: false, statusCode: null, attempt: 1 }),
    });
  });

  it('fans out to every subscribed endpoint independently', async () => {
    prisma.client.webhookEndpoint.findMany.mockResolvedValue([
      { id: 'wh_1', url: 'https://a.example.com', secret: 's1', events: ['contact.created'] },
      { id: 'wh_2', url: 'https://b.example.com', secret: 's2', events: ['contact.created'] },
    ]);
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    prisma.client.webhookDelivery.create.mockResolvedValue({});

    await service.dispatch('org_A', 'contact.created', { id: 'c1' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(prisma.client.webhookDelivery.create).toHaveBeenCalledTimes(2);
  });
});
