import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPw = await bcrypt.hash('Dev1234!', 12);

  const user = await prisma.user.upsert({
    where: { email: 'dev@flowboard.test' },
    update: {},
    create: { email: 'dev@flowboard.test', password: hashedPw },
  });

  const board1 = await prisma.board.upsert({
    where: { id: 'seed-board-001' },
    update: {},
    create: { id: 'seed-board-001', name: 'Sprint 1', ownerId: user.id },
  });

  await prisma.board.upsert({
    where: { id: 'seed-board-002' },
    update: {},
    create: { id: 'seed-board-002', name: 'Backlog', ownerId: user.id },
  });

  const tasks = [
    { id: 'seed-task-001', title: 'Set up CI pipeline', status: 'TODO' as const, priority: 'HIGH' as const },
    { id: 'seed-task-002', title: 'Write API docs', status: 'IN_PROGRESS' as const, priority: 'MEDIUM' as const },
    { id: 'seed-task-003', title: 'Add unit tests', status: 'DONE' as const, priority: 'LOW' as const },
  ];

  for (const task of tasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {},
      create: { ...task, boardId: board1.id },
    });
  }

  console.log('Seed complete: 1 user, 2 boards, 3 tasks');
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
