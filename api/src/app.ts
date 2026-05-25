import express from 'express';
import { globalErrorHandler } from './errors/AppError';
import tasksRouter from './routes/tasks';
import boardsRouter from './routes/boards';
import authRouter from './routes/auth';

const app = express();

app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.use('/auth', authRouter);
app.use('/boards', boardsRouter);
app.use('/tasks', tasksRouter);

app.use(globalErrorHandler);

export default app;
