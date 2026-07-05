import { beforeEach, describe, expect, it, vi } from 'vitest';

const indexMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('@opensearch-project/opensearch', () => ({
  Client: vi.fn().mockImplementation(() => ({
    index: indexMock,
    delete: deleteMock,
  })),
}));

// The mock must be registered before importing the module under test.
const { OpenSearchIndexerService } = await import('./opensearch-indexer.service');
type ConfigServiceLike = { get: (key: string) => string | undefined };

function makeConfigMock(): ConfigServiceLike {
  return { get: vi.fn().mockReturnValue('http://localhost:9200') };
}

const company = {
  id: 'company_1',
  organizationId: 'org_A',
  name: 'Acme',
  domain: 'acme.com',
  annualRevenue: 1_000_000n,
  totalFundingUsd: null,
} as unknown as import('@prospect/db').Company;

const contact = {
  id: 'contact_1',
  organizationId: 'org_A',
  firstName: 'Jane',
  lastName: 'Doe',
} as unknown as import('@prospect/db').Contact;

describe('OpenSearchIndexerService', () => {
  let service: InstanceType<typeof OpenSearchIndexerService>;

  beforeEach(() => {
    indexMock.mockReset();
    deleteMock.mockReset();
    service = new OpenSearchIndexerService(makeConfigMock() as never);
  });

  it('indexCompany() sends the company document, stringifying BigInt columns', async () => {
    indexMock.mockResolvedValue({});

    await service.indexCompany(company);

    expect(indexMock).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 'prospect-companies',
        id: 'company_1',
        body: expect.objectContaining({ annualRevenue: '1000000', totalFundingUsd: null }),
      }),
    );
  });

  it('indexContact() sends the contact document', async () => {
    indexMock.mockResolvedValue({});

    await service.indexContact(contact);

    expect(indexMock).toHaveBeenCalledWith(
      expect.objectContaining({ index: 'prospect-contacts', id: 'contact_1' }),
    );
  });

  it('deleteCompany()/deleteContact() call delete against the right index', async () => {
    deleteMock.mockResolvedValue({});

    await service.deleteCompany('company_1');
    await service.deleteContact('contact_1');

    expect(deleteMock).toHaveBeenCalledWith({ index: 'prospect-companies', id: 'company_1' });
    expect(deleteMock).toHaveBeenCalledWith({ index: 'prospect-contacts', id: 'contact_1' });
  });

  it('swallows indexCompany() failures instead of throwing', async () => {
    indexMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.indexCompany(company)).resolves.toBeUndefined();
  });

  it('swallows indexContact() failures instead of throwing', async () => {
    indexMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.indexContact(contact)).resolves.toBeUndefined();
  });

  it('swallows deleteCompany()/deleteContact() failures instead of throwing', async () => {
    deleteMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.deleteCompany('company_1')).resolves.toBeUndefined();
    await expect(service.deleteContact('contact_1')).resolves.toBeUndefined();
  });
});
