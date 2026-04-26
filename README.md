# 3D Interior Designer

Веб-приложение для планирования отделки и расстановки мебели в типовом доме под ключ. Встраивается на сайт строительной компании через `<iframe>`.

**Тип проекта:** ВКР (Выпускная Квалификационная Работа)

## Стек

- **Vite** + **React 19** + **TypeScript** (strict)
- **react-konva** — 2D-канвас
- **React Three Fiber** + **drei** — 3D-сцена
- **Zustand** — state management
- **Zod** — валидация данных
- **DOMPurify** — защита от XSS
- **jsPDF** — экспорт в PDF
- **Vitest** — unit-тесты
- **Playwright** — E2E-тесты

## Локальный запуск

```bash
npm install
npm run dev
```

Приложение запустится на http://localhost:5173

## Сборка для продакшена

```bash
npm run build
npm run preview  # локальный просмотр сборки
```

Собранные файлы в папке `dist/`.

## Деплой

Статический хостинг (Vercel, Netlify, GitHub Pages):

```bash
npm run build
# Загрузить содержимое dist/ на хостинг
```

## Встраивание через iframe

```html
<iframe
  src="https://your-domain.com/"
  width="100%"
  height="800"
  style="border: none;"
  allowfullscreen
></iframe>
```

Пример: `public/embed-example.html`

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

## Этапы работы пользователя

1. **Выбор планировки** — 3 типовых плана с 2D-превью
2. **Черновая отделка** — стяжка, электрика (BFS-маршрутизация), штукатурка, потолок
3. **Чистовая отделка** — покрытие пола/стен, расстановка мебели из каталога
4. **Итоги** — смета с min-max ценами, экспорт PDF/PNG/JSON

## Документация

- [Спецификация](docs/SPECIFICATION.md)
- [Прогресс](docs/PROGRESS.md)
- [Архитектурные решения](docs/DECISIONS.md)

## Безопасность

- CSP-заголовки (`frame-ancestors *` для iframe-встраивания)
- Zod-валидация всех импортируемых JSON
- DOMPurify на строковых полях при импорте
- localStorage: fallback на чистый стейт при ошибке парсинга
- React автоматически экранирует XSS в JSX
- Запрет хардкоженных hex-цветов (ESLint правило)
