import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../errors/AppError';
import { publishTaskEvent } from '../lib/events';

const router = Router();

const TaskIdParam = z.object({ id: z.string().uuid() });

router.get('/:id', async (req: Request<z.infer<typeof TaskIdParam>>, res, next): Promise<void> => {
  try {
    const { id } = TaskIdParam.parse(req.params);
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    res.json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
});

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  boardId: z.string().uuid(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

router.post('/', async (req: Request<{}, {}, CreateTaskInput>, res, next): Promise<void> => {
  try {
    const { title, description, priority, boardId } = CreateTaskSchema.parse(req.body);
    const task = await prisma.task.create({
      data: { title, description, priority, boardId },
    });
    await prisma.auditLog.create({
      data: { userId: req.user!.id, action: 'CREATED', entity: 'Task', entityId: task.id },
    });
    await publishTaskEvent({ taskId: task.id, action: 'CREATED', userId: req.user!.id, payload: { title: task.title } });
    res.status(201).json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']).optional(),
});

export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

router.patch('/:id', async (req: Request<z.infer<typeof TaskIdParam>, {}, UpdateTaskInput>, res, next): Promise<void> => {
  try {
    const { id } = TaskIdParam.parse(req.params);
    const body = UpdateTaskSchema.parse(req.body);
    const task = await prisma.task.update({ where: { id }, data: body });
    await prisma.auditLog.create({
      data: { userId: req.user!.id, action: 'UPDATED', entity: 'Task', entityId: task.id },
    });
    await publishTaskEvent({ taskId: task.id, action: 'UPDATED', userId: req.user!.id, payload: { ...body } });
    res.json({ success: true, data: task });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') {
      return next(new AppError('Task not found', 404, 'TASK_NOT_FOUND'));
    }
    next(err);
  }
});

router.delete('/:id', async (req: Request<z.infer<typeof TaskIdParam>>, res, next): Promise<void> => {
  try {
    const { id } = TaskIdParam.parse(req.params);
    await prisma.task.delete({ where: { id } });
    await prisma.auditLog.create({
      data: { userId: req.user!.id, action: 'DELETED', entity: 'Task', entityId: id },
    });
    await publishTaskEvent({ taskId: id, action: 'DELETED', userId: req.user!.id, payload: { taskId: id } });
    res.status(204).send();
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') {
      return next(new AppError('Task not found', 404, 'TASK_NOT_FOUND'));
    }
    next(err);
  }
});

export default router;
