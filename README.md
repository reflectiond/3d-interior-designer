# 3D Interior Designer

Веб-приложение для планирования отделки и расстановки мебели в типовом доме под ключ. Встраивается на сайт строительной компании через `<iframe>`.

## Стек

- **Vite** + **React 18** + **TypeScript** (strict)
- **react-konva** — 2D-канвас
- **React Three Fiber** + **drei** — 3D-сцена
- **Zustand** — state management
- **Vitest** — unit-тесты
- **Playwright** — E2E-тесты

## Локальный запуск

```bash
npm install
npm run dev
```

## Скрипты

| Команда             | Описание                  |
| ------------------- | ------------------------- |
| `npm run dev`       | Dev-сервер                |
| `npm run build`     | Сборка для продакшена     |
| `npm run lint`      | ESLint                    |
| `npm run format`    | Prettier                  |
| `npm run typecheck` | TypeScript проверка типов |
| `npm run test:unit` | Unit-тесты (Vitest)       |
| `npm run test:e2e`  | E2E-тесты (Playwright)    |

## Документация

- [Спецификация](docs/SPECIFICATION.md)
- [Прогресс](docs/PROGRESS.md)
- [Архитектурные решения](docs/DECISIONS.md)
