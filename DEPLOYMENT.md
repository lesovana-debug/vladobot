# 🚀 Руководство по развертыванию VladoBot

## Подготовка к развертыванию

### 1. Создание Telegram бота

#### Пошаговая инструкция с BotFather:

1. **Откройте [@BotFather](https://t.me/BotFather)** в Telegram
2. **Отправьте команду** `/newbot`
3. **Введите имя бота** (например: "VladoBot Daily Summaries")
4. **Введите username** (например: "vladobot_daily_bot")
5. **Скопируйте токен** (формат: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

#### ⚠️ КРИТИЧЕСКИ ВАЖНО - Отключение Privacy Mode:

1. **Отправьте команду** `/setprivacy`
2. **Выберите вашего бота** из списка
3. **Выберите** `Disable` (НЕ Enable!)
4. **Подтвердите** выбор

> **Почему это важно?** Без отключения Privacy Mode бот не будет видеть сообщения в группах и не сможет создавать саммари.

### 2. Получение OpenAI API ключа

#### Пошаговая инструкция:

1. **Зайдите на [OpenAI Platform](https://platform.openai.com/)**
2. **Войдите** или создайте аккаунт
3. **Перейдите в раздел** "API Keys" (в левом меню)
4. **Нажмите** "Create new secret key"
5. **Введите название** (например: "VladoBot")
6. **Скопируйте ключ** (формат: `sk-...`)
7. **Сохраните ключ** - он больше не будет показан!

#### Настройка биллинга:

1. **Перейдите в** "Billing" → "Payment methods"
2. **Добавьте карту** или PayPal
3. **Установите лимит** (рекомендуется $10-20 для начала)
4. **Проверьте статус** аккаунта

## Варианты развертывания

### 🚀 Вариант 1: Railway (Рекомендуется)

Railway - современная платформа для развертывания с автоматическими деплоями из GitHub.

#### Шаг 1: Загрузка проекта на GitHub

> **📚 Подробная инструкция**: См. файл [GITHUB_GUIDE.md](GITHUB_GUIDE.md) с пошаговыми объяснениями.

**Если у вас еще нет проекта на GitHub:**

1. **Создайте аккаунт** на [github.com](https://github.com)
2. **Нажмите зеленую кнопку** "New" или "+" → "New repository"
3. **Заполните форму**:
   - Repository name: `vlabobot`
   - Description: `Telegram bot for daily chat summaries`
   - Выберите "Public"
   - **НЕ ставьте галочки** на "Add a README file", "Add .gitignore", "Choose a license"
4. **Нажмите** "Create repository"
5. **Нажмите** "uploading an existing file"
6. **Перетащите все файлы** проекта в окно браузера
7. **Введите сообщение**: `Initial commit`
8. **Нажмите** "Commit changes"

#### Шаг 2: Развертывание на Railway

1. **Зайдите на [Railway](https://railway.app/)**
2. **Нажмите** "Login with GitHub"
3. **Авторизуйтесь** через GitHub
4. **Нажмите** "New Project"
5. **Выберите** "Deploy from GitHub repo"
6. **Выберите ваш репозиторий** `vlabobot` из списка
7. **Дождитесь** автоматического деплоя (2-3 минуты)

#### Настройка переменных окружения:

1. **В проекте Railway** нажмите на ваш сервис
2. **Перейдите в** "Variables" (вкладка)
3. **Добавьте переменные:**

```
BOT_TOKEN=ваш_токен_от_BotFather
OPENAI_API_KEY=ваш_ключ_от_OpenAI
REPORT_TIME_DEFAULT=21:00
TIMEZONE_DEFAULT=Europe/Berlin
TARGET_USERNAME=@vlad311
MAX_DAILY_TOKENS=10000
TELEGRAM_FILE_SIZE_LIMIT_MB=20
LOG_LEVEL=info
```

#### Настройка постоянного хранилища:

1. **В проекте Railway** нажмите "New" → "Volume"
2. **Введите имя** `vlabobot-data`
3. **Подключите к сервису** VladoBot
4. **Установите путь** `/app/data`

#### Мониторинг:

1. **Перейдите в** "Deployments" для просмотра логов
2. **Проверьте статус** деплоя
3. **При ошибках** проверьте логи в "View Logs"

### 🌐 Вариант 2: Render

Render - альтернативная платформа с хорошей поддержкой Node.js.

#### Шаг 1: Загрузка проекта на GitHub

**Если у вас еще нет проекта на GitHub** (см. инструкцию выше в разделе Railway), выполните те же шаги.

#### Шаг 2: Развертывание на Render

1. **Зайдите на [Render](https://render.com/)**
2. **Нажмите** "Get Started for Free"
3. **Авторизуйтесь** через GitHub
4. **Нажмите** "New" → "Web Service"
5. **Подключите репозиторий** VladoBot:
   - Выберите ваш аккаунт GitHub
   - Найдите репозиторий `vlabobot`
   - Нажмите "Connect"
6. **Настройте параметры:**

```
Name: vlabobot
Environment: Node
Build Command: npm run build
Start Command: npm start
```

#### Настройка переменных окружения:

1. **В настройках сервиса** перейдите в "Environment"
2. **Добавьте переменные** (те же, что и для Railway)

#### Настройка постоянного хранилища:

1. **В настройках сервиса** перейдите в "Disks"
2. **Нажмите** "Add Disk"
3. **Установите:**
   - Name: `vlabobot-data`
   - Mount Path: `/app/data`
   - Size: 1GB

### 🐳 Вариант 3: Docker на VPS

Для пользователей с собственными серверами.

#### Требования к серверу:

- **ОС:** Ubuntu 20.04+ или аналогичная
- **RAM:** минимум 512MB, рекомендуется 1GB
- **Диск:** минимум 2GB свободного места
- **Docker:** установлен и настроен

#### Пошаговая инструкция:

1. **Подключитесь к серверу:**
```bash
ssh user@your-server-ip
```

2. **Клонируйте репозиторий:**
```bash
git clone https://github.com/your-username/vlabobot_cursor.git
cd vlabobot_cursor
```

3. **Создайте .env файл:**
```bash
cp env.example .env
nano .env
```

4. **Заполните переменные** (те же, что и выше)

5. **Запустите с Docker Compose:**
```bash
docker compose up -d --build
```

6. **Проверьте статус:**
```bash
docker compose ps
docker compose logs -f
```

#### Автозапуск при перезагрузке:

```bash
# Создайте systemd сервис
sudo nano /etc/systemd/system/vlabobot.service
```

Содержимое файла:
```ini
[Unit]
Description=VladoBot Telegram Bot
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/path/to/vlabobot_cursor
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Активация:
```bash
sudo systemctl enable vlabobot.service
sudo systemctl start vlabobot.service
```

## Проверка развертывания

### 1. Базовые проверки

```bash
# Проверка логов
docker compose logs -f  # для Docker
# или в Railway/Render: View Logs

# Проверка статуса
docker compose ps  # для Docker
```

### 2. Тестирование в Telegram

1. **Добавьте бота в тестовую группу**
2. **Сделайте бота администратором**
3. **Отправьте команду** `/start`
4. **Проверьте ответ** - должна прийти справка
5. **Отправьте команду** `/preview`
6. **Проверьте саммари** - должен создаться отчет

### 3. Проверка функций

- ✅ **Команды работают:** `/help`, `/status`
- ✅ **Сообщения сохраняются:** отправьте текст, проверьте логи
- ✅ **Настройки сохраняются:** `/settime 21:00`
- ✅ **Саммари создается:** `/preview`

## Мониторинг и обслуживание

### Логи и мониторинг

#### Railway:
- **Deployments** → выберите деплой → **View Logs**
- **Metrics** → мониторинг использования ресурсов

#### Render:
- **Logs** → просмотр логов в реальном времени
- **Metrics** → статистика производительности

#### Docker:
```bash
# Просмотр логов
docker compose logs -f

# Статистика ресурсов
docker stats

# Перезапуск сервиса
docker compose restart
```

### Обновление бота

#### Railway/Render:
1. **Обновите код** в GitHub репозитории
2. **Деплой запустится** автоматически
3. **Проверьте логи** на наличие ошибок

#### Docker:
```bash
# Обновление кода
git pull origin main

# Пересборка и перезапуск
docker compose down
docker compose up -d --build
```

### Резервное копирование

#### База данных:
```bash
# Создание бэкапа
docker compose exec vlabobot cp /app/data/db.sqlite /app/data/backup-$(date +%Y%m%d).sqlite

# Восстановление
docker compose exec vlabobot cp /app/data/backup-20240101.sqlite /app/data/db.sqlite
```

## Устранение неполадок

### Частые проблемы

#### 1. Бот не отвечает
- ✅ Проверьте токен в переменных окружения
- ✅ Убедитесь, что бот запущен (логи)
- ✅ Проверьте интернет-соединение сервера

#### 2. Бот не видит сообщения
- ✅ Privacy Mode отключен в @BotFather?
- ✅ Бот добавлен в группу?
- ✅ Бот имеет права администратора?

#### 3. Ошибки транскрибации
- ✅ OpenAI API ключ правильный?
- ✅ Есть кредиты на аккаунте?
- ✅ Файлы не превышают лимит размера?

#### 4. Высокие расходы на API
- ✅ Уменьшите `MAX_DAILY_TOKENS`
- ✅ Увеличьте `TELEGRAM_FILE_SIZE_LIMIT_MB`
- ✅ Используйте `/optout` для неактивных пользователей

### Получение помощи

1. **Проверьте логи** на наличие ошибок
2. **Убедитесь в правильности** конфигурации
3. **Протестируйте локально** перед развертыванием
4. **Создайте issue** в репозитории с подробным описанием

---

**Успешного развертывания! 🚀**
