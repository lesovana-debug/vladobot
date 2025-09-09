# 🔧 Исправление ошибки деплоя на Render

## 🚨 Проблема

При деплое на Render возникает ошибка:
```
error TS18003: No inputs were found in config file '/opt/render/project/src/tsconfig.json'
```

## 🔍 Причина

Проблема в том, что при загрузке файлов на GitHub структура папок может измениться, и TypeScript не может найти файлы в папке `src/`.

## ✅ Решение

### Шаг 1: Обновите package.json

Переместите необходимые типы из `devDependencies` в `dependencies`:

```json
{
  "dependencies": {
    "telegraf": "^4.15.6",
    "better-sqlite3": "^9.2.2",
    "node-cron": "^3.0.3",
    "openai": "^4.20.1",
    "ffmpeg-static": "^5.2.0",
    "fluent-ffmpeg": "^2.1.2",
    "axios": "^1.6.2",
    "pino": "^8.17.2",
    "pino-pretty": "^10.3.1",
    "zod": "^3.22.4",
    "dotenv": "^16.3.1",
    "node-telegram-bot-api": "^0.66.0",
    "@types/node": "^20.10.4",
    "@types/better-sqlite3": "^7.6.8",
    "@types/fluent-ffmpeg": "^2.1.24",
    "@types/node-cron": "^3.0.11",
    "typescript": "^5.3.3"
  },
  "devDependencies": {
    "tsx": "^4.6.2",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0",
    "prettier": "^3.1.1"
  }
}
```

### Шаг 2: Обновите tsconfig.json

Замените содержимое файла `tsconfig.json` на:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": false,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": false,
    "removeComments": true,
    "noImplicitAny": false,
    "noImplicitReturns": false,
    "noImplicitThis": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "exactOptionalPropertyTypes": false,
    "noImplicitOverride": false,
    "noPropertyAccessFromIndexSignature": false,
    "noUncheckedIndexedAccess": false,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### Шаг 3: Обновите файлы на GitHub

1. **Откройте ваш репозиторий** на GitHub
2. **Найдите файл** `tsconfig.json`
3. **Нажмите** на карандаш (Edit)
4. **Замените содержимое** на код выше
5. **Нажмите** "Commit changes"

### Шаг 4: Обновите исходные файлы

Также нужно обновить несколько файлов в папке `src/`:

1. **В файле `src/bot.ts`**:
   - Удалите `Scenes` из импорта: `import { Telegraf, Context } from 'telegraf';`
   - Добавьте типы в интерфейс `BotContext`

2. **В файле `src/summarizer.ts`**:
   - Удалите неиспользуемые импорты: `import { db } from './storage';`

3. **В файле `src/stt.ts`**:
   - Удалите неиспользуемый импорт: `import { mkdirSync, existsSync, unlinkSync } from 'fs';`

4. **В файле `src/scheduler.ts`**:
   - Закомментируйте неиспользуемый импорт: `// import { schedulerConfig } from './config';`

5. **В файле `src/migrations/migrate.ts`**:
   - Закомментируйте неиспользуемый импорт: `// import { db } from '../storage';`

6. **В файле `src/scripts/seed.ts`**:
   - Закомментируйте неиспользуемую переменную: `// const today = new Date();`

### Шаг 5: Перезапустите деплой на Render

1. **Зайдите в ваш проект** на Render
2. **Нажмите** "Manual Deploy" → "Deploy latest commit"
3. **Дождитесь** завершения деплоя

## 🔄 Альтернативное решение

Если проблема не решается, попробуйте:

### Вариант 1: Изменить Build Command

В настройках Render измените Build Command на:
```bash
npm install && npm run build
```

### Вариант 2: Использовать другой Start Command

В настройках Render измените Start Command на:
```bash
node dist/index.js
```

### Вариант 3: Проверить структуру файлов

Убедитесь, что на GitHub файлы находятся в правильной структуре:
```
vlabobot/
├── src/
│   ├── bot.ts
│   ├── config.ts
│   ├── index.ts
│   └── ...
├── package.json
├── tsconfig.json
└── ...
```

## 🆘 Если ничего не помогает

1. **Удалите проект** на Render
2. **Пересоздайте** с нуля
3. **Убедитесь**, что все файлы загружены на GitHub
4. **Проверьте**, что переменные окружения добавлены

## 📞 Получение помощи

Если проблема не решается:
1. Проверьте логи деплоя на Render
2. Убедитесь, что все файлы загружены на GitHub
3. Проверьте настройки Build Command и Start Command
4. Создайте issue в репозитории проекта

---

**После исправления tsconfig.json деплой должен пройти успешно! 🚀**
