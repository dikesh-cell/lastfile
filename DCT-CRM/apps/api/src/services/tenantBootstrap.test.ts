import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { bootstrapTenant } from './tenantBootstrap';

describe('bootstrapTenant', () => {
  const adminProfile = { id: 'admin-profile' };
  const standardProfile = { id: 'standard-profile' };
  const adminRole = { id: 'admin-role' };
  const seededObjects: Array<{ id: string; label: string; name: string }> = [];
  const tx = {
    profile: {
      upsert: vi.fn()
        .mockResolvedValueOnce(adminProfile)
        .mockResolvedValueOnce(standardProfile),
    },
    role: { upsert: vi.fn().mockResolvedValue(adminRole) },
    permission: {
      createMany: vi.fn().mockResolvedValue({ count: 20 }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn(async ({ where }: { where: { name: { in: string[] } } }) =>
        where.name.in.map((name) => ({ id: `permission-${name}`, name })),
      ),
    },
    userProfilePermission: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    objectDefinition: {
      createMany: vi.fn().mockImplementation(({ data }) => {
        seededObjects.push(...data.map((object: { name: string; label: string }, index: number) => ({
          ...object,
          id: `object-${index}`,
        })));
        return Promise.resolve({ count: data.length });
      }),
      findMany: vi.fn(async () => seededObjects),
      findFirst: vi.fn(async () => seededObjects.find((object) => object.name === 'Booking') ?? null),
    },
    fieldDefinition: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      findFirst: vi.fn().mockResolvedValue({ id: 'stage-field' }),
    },
    picklistValue: { createMany: vi.fn().mockResolvedValue({ count: 6 }) },
    pageLayout: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 10 }),
    },
    profileObjectPermission: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 10 }),
    },
    objectPermission: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 10 }),
    },
    sequence: { createMany: vi.fn().mockResolvedValue({ count: 4 }) },
  } as unknown as Prisma.TransactionClient;

  beforeEach(() => {
    vi.clearAllMocks();
    seededObjects.length = 0;
    vi.mocked(tx.profile.upsert)
      .mockResolvedValueOnce(adminProfile as never)
      .mockResolvedValueOnce(standardProfile as never);
    vi.mocked(tx.role.upsert).mockResolvedValue(adminRole as never);
  });

  it('bootstraps supported CRM objects and excludes removed workflow permissions', async () => {
    const result = await bootstrapTenant(tx, 'new-tenant', 'creator');

    expect(result).toEqual({
      adminProfileId: 'admin-profile',
      adminRoleId: 'admin-role',
    });
    expect(tx.profile.upsert).toHaveBeenCalledTimes(2);
    expect(tx.role.upsert).toHaveBeenCalledTimes(1);

    const permissionData = vi.mocked(tx.permission.createMany).mock.calls[0]?.[0]?.data ?? [];
    const permissionNames = (Array.isArray(permissionData) ? permissionData : [permissionData]).map(({ name }) => name);
    expect(permissionNames).toEqual(expect.arrayContaining(['FULL_SYSTEM_ACCESS', 'LEAD_READ', 'PROJECT_READ']));
    expect(permissionNames).not.toEqual(expect.arrayContaining([
      'OPPORTUNITY_READ',
      'QUOTATION_READ',
      'BOOKING_READ',
      'PAYMENT_READ',
      'RECEIPT_READ',
    ]));

    const objectData = vi.mocked(tx.objectDefinition.createMany).mock.calls[0]?.[0]?.data ?? [];
    const objectNames = (Array.isArray(objectData) ? objectData : [objectData]).map(({ name }) => name);
    expect(objectNames).toEqual([
      'Lead',
      'Enquiry',
      'SiteVisit',
      'Project',
      'Unit',
      'Booking',
      'Task',
      'Company',
      'FollowUp',
      'Activity',
      'CallDetail',
    ]);
    expect(tx.sequence.createMany).toHaveBeenCalledWith({
      data: ['LEAD', 'SITE_VISIT', 'FOLLOW_UP', 'ENQUIRY'].map((type) => ({
        tenantId: 'new-tenant',
        type,
        nextValue: 1,
      })),
      skipDuplicates: true,
    });
  });
});
