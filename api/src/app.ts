import express from 'express';
import { globalErrorHandler } from './errors/AppError';
import { authenticate } from './middleware/authenticate';
import tasksRouter from './routes/tasks';
import boardsRouter from './routes/boards';
import authRouter from './routes/auth';

const app = express();

app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.use('/auth', authRouter);
app.use('/boards', authenticate, boardsRouter);
app.use('/tasks', authenticate, tasksRouter);

app.use(globalErrorHandler);

export default app;
