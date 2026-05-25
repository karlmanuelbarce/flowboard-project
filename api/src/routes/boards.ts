import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../errors/AppError';

const router = Router();

const CreateBoardSchema = z.object({
  name: z.string().min(1).max(255),
});

export type CreateBoardInput = z.infer<typeof CreateBoardSchema>;

const BoardIdParam = z.object({ id: z.string().uuid() });

router.get('/', async (req, res, next): Promise<void> => {
  try {
    const boards = await prisma.board.findMany({ where: { ownerId: req.user!.id } });
    res.json({ success: true, data: boards });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request<{}, {}, CreateBoardInput>, res, next): Promise<void> => {
  try {
    const { name } = CreateBoardSchema.parse(req.body);
    const board = await prisma.board.create({ data: { name, ownerId: req.user!.id } });
    res.status(201).json({ success: true, data: board });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request<z.infer<typeof BoardIdParam>>, res, next): Promise<void> => {
  try {
    const { id } = BoardIdParam.parse(req.params);
    const board = await prisma.board.findUnique({ where: { id } });
    if (!board) throw new AppError('Board not found', 404, 'BOARD_NOT_FOUND');
    res.json({ success: true, data: board });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: Request<z.infer<typeof BoardIdParam>>, res, next): Promise<void> => {
  try {
    const { id } = BoardIdParam.parse(req.params);
    await prisma.board.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') {
      return next(new AppError('Board not found', 404, 'BOARD_NOT_FOUND'));
    }
    next(err);
  }
});

export default router;
