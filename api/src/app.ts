import express from 'express';
import { globalErrorHandler } from './errors/AppError';
import tasksRouter from './routes/tasks';

const app = express();

app.use(express.json());

app.use('/tasks', tasksRouter);

app.use(globalErrorHandler);

export default app;
