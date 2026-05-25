import express from 'express';
import { globalErrorHandler } from './errors/AppError';

const app = express();

app.use(express.json());

app.use(globalErrorHandler);

export default app;
