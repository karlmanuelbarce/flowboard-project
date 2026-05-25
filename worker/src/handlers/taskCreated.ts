import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

export async function taskCreated(
  messageId: string,
  data: Record<string, string>,
  prisma: PrismaClient,
  redis: Redis,
): Promise<void> {
  const { taskId, userId } = data;
  await prisma.auditLog.create({
    data: { userId, action: 'CREATED', entity: 'Task', entityId: taskId },
  });
  await redis.xack('tasks:events', 'audit-group', messageId);
  console.log(`AuditLog written: CREATED task ${taskId}`);
}
