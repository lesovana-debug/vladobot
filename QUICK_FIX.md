# ⚡ БЫСТРОЕ ИСПРАВЛЕНИЕ ОШИБКИ NPM CI

## Проблема
```
npm error The `npm ci` command can only install with an existing package-lock.json
```

## ✅ Решение

### Измените Build Command на Render:

**Вместо:**
```
npm ci && npm run build
```

**Используйте:**
```
npm install && npm run build
```

## 📋 Как изменить:

1. **Зайдите в ваш проект** на Render
2. **Нажмите** "Settings"
3. **Найдите раздел** "Build & Deploy"
4. **Измените Build Command** на: `npm install && npm run build`
5. **Сохраните изменения**
6. **Нажмите** "Manual Deploy" → "Deploy latest commit"

## 🎯 Результат
После этого изменения деплой на Render должен пройти успешно!

**Проблема с npm ci решена! 🚀**
