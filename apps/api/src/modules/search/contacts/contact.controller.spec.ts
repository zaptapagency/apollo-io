import { describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import type { AuthContext } from '../../../common/request-context';
import { ContactController } from './contact.controller';
import type { ContactService } from './contact.service';
import type { SearchService } from '../lead-search/search.service';
import type { TagsService } from '../tags/tags.service';

const auth: AuthContext = {
  userId: 'user_1',
  email: 'a@b.com',
  organizationId: 'org_A',
  role: 'ADMIN',
  authMethod: 'session',
};

function makeController() {
  const contactService = {
    create: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  const searchService = { searchContacts: vi.fn() };
  const tagsService = { attachToContact: vi.fn(), detachFromContact: vi.fn() };
  const controller = new ContactController(
    contactService as unknown as ContactService,
    searchService as unknown as SearchService,
    tagsService as unknown as TagsService,
  );
  return { controller, contactService, searchService, tagsService };
}

describe('ContactController', () => {
  it('search() delegates to SearchService.searchContacts scoped by organization', () => {
    const { controller, searchService } = makeController();
    searchService.searchContacts.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });

    controller.search(auth, { page: 1, pageSize: 25, sortDir: 'desc' });

    expect(searchService.searchContacts).toHaveBeenCalledWith('org_A', expect.any(Object));
  });

  it('create() delegates to ContactService.create scoped by organization', () => {
    const { controller, contactService } = makeController();

    controller.create(auth, { firstName: 'Jane', lastName: 'Doe' });

    expect(contactService.create).toHaveBeenCalledWith('org_A', { firstName: 'Jane', lastName: 'Doe' });
  });

  it('findOne() delegates to ContactService.findOne scoped by organization', () => {
    const { controller, contactService } = makeController();

    controller.findOne(auth, 'contact_1');

    expect(contactService.findOne).toHaveBeenCalledWith('org_A', 'contact_1');
  });

  it('update() delegates to ContactService.update scoped by organization', () => {
    const { controller, contactService } = makeController();

    controller.update(auth, 'contact_1', { firstName: 'New' });

    expect(contactService.update).toHaveBeenCalledWith('org_A', 'contact_1', { firstName: 'New' });
  });

  it('remove() delegates to ContactService.remove scoped by organization', async () => {
    const { controller, contactService } = makeController();

    await controller.remove(auth, 'contact_1');

    expect(contactService.remove).toHaveBeenCalledWith('org_A', 'contact_1');
  });

  it('attachTag()/detachTag() delegate to TagsService scoped by organization', async () => {
    const { controller, tagsService } = makeController();

    await controller.attachTag(auth, 'contact_1', 'tag_1');
    await controller.detachTag(auth, 'contact_1', 'tag_1');

    expect(tagsService.attachToContact).toHaveBeenCalledWith('org_A', 'contact_1', 'tag_1');
    expect(tagsService.detachFromContact).toHaveBeenCalledWith('org_A', 'contact_1', 'tag_1');
  });

  it('requires REP+ for create/update/tag mutations and MANAGER+ for delete', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ContactController.prototype.create)).toEqual(['REP']);
    expect(Reflect.getMetadata(ROLES_KEY, ContactController.prototype.update)).toEqual(['REP']);
    expect(Reflect.getMetadata(ROLES_KEY, ContactController.prototype.attachTag)).toEqual(['REP']);
    expect(Reflect.getMetadata(ROLES_KEY, ContactController.prototype.detachTag)).toEqual(['REP']);
    expect(Reflect.getMetadata(ROLES_KEY, ContactController.prototype.remove)).toEqual(['MANAGER']);
    expect(Reflect.getMetadata(ROLES_KEY, ContactController.prototype.search)).toBeUndefined();
  });
});
