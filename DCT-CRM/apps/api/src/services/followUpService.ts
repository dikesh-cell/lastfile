import type { Prisma, PrismaClient } from '@prisma/client';

type Db = Prisma.TransactionClient | PrismaClient;

export function futureFollowUpError(dueDate: string, now = Date.now()): string | null {
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 'Follow-up date and time are invalid.';
  if (due.getTime() <= now) return 'Follow-up can only be scheduled for a future date and time.';
  return null;
}

export async function getNextFollowUpNumber(db: Db, tenantId: string): Promise<string> {
  const sequence = await db.sequence.upsert({
    where: { tenantId_type: { tenantId, type: 'FOLLOW_UP' } },
    update: { nextValue: { increment: 1 } },
    create: { tenantId, type: 'FOLLOW_UP', nextValue: 1 },
  });

  return `F-${String(sequence.nextValue).padStart(6, '0')}`;
}
