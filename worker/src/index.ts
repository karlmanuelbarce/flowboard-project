import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { taskCreated } from './handlers/taskCreated';
import { taskUpdated } from './handlers/taskUpdated';
import { taskDeleted } from './handlers/taskDeleted';

const redis = new Redis({
  host: process.env.REDIS_HOST ?? 'redis',
  port: Number(process.env.REDIS_PORT) ?? 6379,
});

redis.on('error', (err) => console.error('Redis error:', err));

const prisma = new PrismaClient();

const STREAM = 'tasks:events';
const GROUP = 'audit-group';
const CONSUMER = 'worker-1';
const DLQ = 'tasks:events:dlq';
const MAX_RETRIES = 3;

const retryCounts = new Map<string, number>();

type StreamResults = [string, [string, string[]][]][] | null;

async function processMessages(messages: [string, string[]][]) {
  for (const [messageId, fields] of messages) {
    const data: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      data[fields[i]] = fields[i + 1];
    }

    try {
      const { action } = data;
      if (action === 'CREATED') await taskCreated(messageId, data, prisma, redis);
      else if (action === 'UPDATED') await taskUpdated(messageId, data, prisma, redis);
      else if (action === 'DELETED') await taskDeleted(messageId, data, prisma, redis);
      else {
        console.warn(`Unknown action: ${action}, acking and skipping ${messageId}`);
        await redis.xack(STREAM, GROUP, messageId);
      }
      retryCounts.delete(messageId);
    } catch (err) {
      const retries = (retryCounts.get(messageId) ?? 0) + 1;
      retryCounts.set(messageId, retries);

      if (retries < MAX_RETRIES) {
        console.error(`Handler error for ${messageId} (attempt ${retries}/${MAX_RETRIES}):`, (err as Error).message);
      } else {
        console.warn(`Moving message ${messageId} to DLQ after ${retries} failures`);
        await redis.lpush(DLQ, JSON.stringify({
          streamId: messageId,
          action: data.action,
          taskId: data.taskId,
          userId: data.userId,
          payload: data.payload,
          ts: data.ts,
          failedAt: new Date().toISOString(),
          retries: MAX_RETRIES,
          lastError: (err as Error).message,
        }));
        await redis.xack(STREAM, GROUP, messageId);
        retryCounts.delete(messageId);
      }
    }
  }
}

async function main() {
  try {
    await redis.xgroup('CREATE', STREAM, GROUP, '$', 'MKSTREAM');
    console.log('Consumer group created');
  } catch (err: unknown) {
    if ((err as { message?: string }).message?.includes('BUSYGROUP')) {
      console.log('Consumer group already exists');
    } else {
      throw err;
    }
  }

  console.log('Worker listening on', STREAM);

  while (true) {
    // Retry pending (previously failed) messages first
    const pendingResults = await redis.xreadgroup(
      'GROUP', GROUP, CONSUMER,
      'COUNT', '10',
      'STREAMS', STREAM, '0',
    ) as StreamResults;

    const pending = pendingResults ? pendingResults[0][1] : [];
    if (pending.length > 0) {
      await processMessages(pending);
      continue;
    }

    // Block for new messages
    const freshResults = await redis.xreadgroup(
      'GROUP', GROUP, CONSUMER,
      'COUNT', '10',
      'BLOCK', 5000,
      'STREAMS', STREAM, '>',
    ) as StreamResults;

    if (freshResults) await processMessages(freshResults[0][1]);
  }
}

main().catch((err) => {
  console.error('Worker fatal error:', err);
  process.exit(1);
});
