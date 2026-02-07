# ClipArtWeb — Видео CTA Overlay SaaS

Веб-приложение для наложения анимированных CTA-элементов на видео. Облачный рендеринг, подписки, библиотека ассетов.

**URL:** https://clipartweb.1tlt.ru

## Стек технологий

| Компонент | Технология |
|-----------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | PHP 8.2+ / Laravel 11 + Sanctum |
| База данных | MySQL 8+ |
| Рендеринг | Python 3 + MoviePy + FFmpeg (с GPU NVENC) |
| Очереди | Laravel Queue (database) + Supervisor |
| Оплата | Stripe / ЮKassa + Laravel Cashier |
| Веб-сервер | Apache 2.4 |
| Хостинг | VPS (Ubuntu) |

## Структура проекта

```
clipartweb/
├── backend/                    # Laravel PHP API
│   ├── app/
│   │   ├── Http/Controllers/Api/  # API контроллеры
│   │   ├── Models/                # Eloquent модели
│   │   ├── Jobs/                  # Фоновые задачи (рендеринг)
│   │   └── Services/              # Бизнес-логика
│   ├── config/                    # Конфигурация Laravel
│   ├── database/migrations/       # Миграции MySQL
│   ├── routes/api.php             # API маршруты
│   ├── public/                    # Точка входа Apache
│   └── .env.example               # Шаблон настроек
│
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── pages/                 # Страницы (Landing, Login, Dashboard, Editor)
│   │   ├── components/            # UI компоненты
│   │   ├── store/                 # Zustand (состояние)
│   │   ├── lib/                   # API клиент, утилиты
│   │   └── types/                 # TypeScript типы
│   ├── tailwind.config.js         # Тёмная тема Catppuccin
│   └── package.json
│
├── scripts/                    # Python-скрипты рендеринга
│   ├── render.py                  # Основной рендерер (MoviePy)
│   └── requirements.txt           # Python-зависимости
│
├── server/                     # Конфигурация сервера
│   ├── apache-clipartweb.conf     # Apache виртуальный хост
│   ├── supervisor-clipartweb.conf # Supervisor для очередей
│   ├── setup.sh                   # Первоначальная установка
│   └── deploy.sh                  # Скрипт обновления
│
└── storage/                    # Файловое хранилище (не в git)
    ├── videos/                    # Загруженные видео
    ├── renders/                   # Результаты рендеринга
    ├── assets/                    # CTA-ассеты (GIF, PNG)
    └── overlays/                  # Файлы оверлеев
```

## Быстрый старт (VPS)

### 1. Клонировать репозиторий

```bash
cd /ssd/www
git clone https://github.com/alexevil1979/clipartweb.git
cd clipartweb
```

### 2. Первоначальная настройка

```bash
sudo bash server/setup.sh
```

Это установит: Apache, PHP 8.2, MySQL, Node.js, Python3, FFmpeg, Supervisor, SSL.

### 3. Настроить .env

```bash
nano backend/.env
```

Обязательно указать:
- `DB_PASSWORD` — пароль MySQL
- `APP_KEY` — генерируется автоматически
- `STRIPE_KEY`, `STRIPE_SECRET` — для оплаты
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — для OAuth

### 4. Деплой

```bash
bash server/deploy.sh
```

## API Маршруты

### Аутентификация
| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Авторизация |
| POST | `/api/logout` | Выход |
| GET | `/api/me` | Текущий пользователь |
| GET | `/api/auth/google` | Google OAuth |

### Проекты
| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/projects` | Список проектов |
| POST | `/api/projects` | Создать проект |
| GET | `/api/projects/{uuid}` | Детали проекта |
| PUT | `/api/projects/{uuid}` | Обновить проект |
| DELETE | `/api/projects/{uuid}` | Удалить проект |
| POST | `/api/projects/{uuid}/video` | Загрузить видео |
| POST | `/api/projects/{uuid}/render` | Запустить рендеринг |
| GET | `/api/projects/{uuid}/render-status` | Статус рендеринга |
| GET | `/api/projects/{uuid}/download` | Скачать результат |

### Оверлеи
| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/projects/{uuid}/overlays` | Список оверлеев |
| POST | `/api/projects/{uuid}/overlays` | Добавить оверлей |
| PUT | `/api/projects/{uuid}/overlays/{id}` | Обновить оверлей |
| DELETE | `/api/projects/{uuid}/overlays/{id}` | Удалить оверлей |

### Подписки
| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/plans` | Тарифы |
| GET | `/api/subscription` | Текущая подписка |
| POST | `/api/subscription/checkout` | Оплата |

## Тарифные планы

| | Free | Pro (990 ₽/мес) |
|---|---|---|
| Элементы | До 3 | Неограниченно |
| Водяной знак | Да | Нет |
| Длительность | 60 сек | 30 мин |
| Разрешение | 720p | 4K |
| Приоритет рендеринга | Низкий | Высокий |
| Хранилище | 1 ГБ | 10 ГБ |

## Рендеринг

1. Пользователь нажимает "Рендерить"
2. Laravel создаёт `RenderJob` и ставит в очередь
3. Supervisor запускает worker, который вызывает `scripts/render.py`
4. Python-скрипт использует MoviePy + FFmpeg для композиции
5. Прогресс записывается в JSON-файл, frontend поллит статус
6. Готовый файл доступен для скачивания

### GPU-ускорение

Если на VPS есть NVIDIA GPU:
```bash
# Проверить
ffmpeg -encoders | grep nvenc

# Автоматически используется h264_nvenc если доступен
```

## Локальная разработка

### Backend
```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate
php artisan serve
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Лицензия

Проприетарное ПО. Все права защищены.
