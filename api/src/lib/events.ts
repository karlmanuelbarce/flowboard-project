import redis from './redis';

interface TaskEvent {
  taskId: string;
  action: 'CREATED' | 'UPDATED' | 'DELETED';
  userId: string;
  payload: Record<string, unknown>;
}

export async function publishTaskEvent(event: TaskEvent): Promise<void> {
  try {
    await redis.xadd(
      'tasks:events',
      '*',
      'action', event.action,
      'taskId', event.taskId,
      'userId', event.userId,
      'payload', JSON.stringify(event.payload),
      'ts', Date.now().toString(),
    );
  } catch (err) {
    console.error('Failed to publish task event:', err);
  }
}
