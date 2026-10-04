# quiz-project (EMS MATH)

Сайт с тестами по математике (ОГЭ, ЕГЭ профиль): генерация вариантов, прохождение попыток, серверная проверка ответов и разбор решений.

## Структура

```
apps/
  api/                Fastify API: тесты, попытки, задачи генерации, картинки заданий
  worker-generation/  воркер BullMQ: mock-генерация или AI-пайплайн (draft → critic → repair)
    python/           рендер визуализаций (render_visual.py)
  web/                React + Vite, формулы через MathJax
packages/
  db/                 Prisma-схема, миграции, репозитории
  exam-presets/       структура ОГЭ (25 заданий) и ЕГЭ профиль (19 заданий)
  validation/         сборка теста для ученика и проверка ответов
  ai/                 промпты critic/repair и правила LaTeX
  queue/              очередь BullMQ поверх Redis
  observability/      логгер pino
archive/              старая версия сайта, только для справки
infra/compose/        PostgreSQL и Redis для разработки
```

## Запуск

Нужны Node.js 20+, pnpm 10, Docker (или свои PostgreSQL 16 и Redis 7).

```bash
pnpm install
cp .env.example .env          # для AI-генерации впишите OPENAI_API_KEY
pnpm infra:up                 # PostgreSQL + Redis
pnpm db:generate
pnpm db:migrate
pnpm db:seed                  # пользователь demo-user, от имени которого работает сайт

pnpm dev:api                  # http://127.0.0.1:3001
pnpm dev:worker
pnpm dev:web                  # http://127.0.0.1:5173
```

Без `OPENAI_API_KEY` работает движок `mock` (тестовые задания-заглушки).

## Тесты

```bash
pnpm test
```
