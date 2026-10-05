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
  task-generators/    генераторы задач по шаблонам: ответ вычисляет код, текст в LaTeX
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

Движки генерации:

- `template` (по умолчанию): задачи из генераторов `packages/task-generators`, мгновенно и без AI. Сейчас есть ОГЭ №6, 8, 9, 10, 12, 13, 14, 15, 16, 17.
- `ai`: генерация через OpenAI с проверкой критиком, нужен `OPENAI_API_KEY`.
- `mock`: задания-заглушки для отладки.

## Как добавить генератор

Создайте `packages/task-generators/src/oge/taskNN.js` с шаблонами вида `(rng) => ({ prompt, answer, solution })`, где числа берутся из `rng`, а ответ вычисляется в коде. Шаблон может вернуть `null`, если выпали неудачные числа. Подключите файл в `src/index.js`, и `tests/task-generators.test.js` проверит его на 400 вариантах.

## Тесты

```bash
pnpm test
```
