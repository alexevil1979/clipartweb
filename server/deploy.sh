#!/bin/bash
# ============================================
# ClipArtWeb — Скрипт развёртывания на VPS
# Запуск: bash /ssd/www/clipartweb/server/deploy.sh
# ============================================

set -e

PROJECT_DIR="/ssd/www/clipartweb"
BACKEND_DIR="${PROJECT_DIR}/backend"
FRONTEND_DIR="${PROJECT_DIR}/frontend"

echo "=========================================="
echo " ClipArtWeb — Развёртывание"
echo "=========================================="

# 1. Обновить код из Git
echo "[1/8] Обновление кода из Git..."
cd "${PROJECT_DIR}"
git pull origin main

# 2. Backend — зависимости
echo "[2/8] Установка PHP-зависимостей..."
cd "${BACKEND_DIR}"
composer install --no-dev --optimize-autoloader

# 3. Backend — миграции и кэш
echo "[3/8] Миграции и кэширование..."
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 4. Frontend — сборка
echo "[4/8] Сборка фронтенда..."
cd "${FRONTEND_DIR}"
npm ci
npm run build

# 5. Python — зависимости
echo "[5/8] Python-зависимости для рендеринга..."
cd "${PROJECT_DIR}/scripts"
pip3 install -r requirements.txt --quiet

# 6. Права доступа
echo "[6/8] Установка прав..."
chown -R www-data:www-data "${BACKEND_DIR}/storage"
chown -R www-data:www-data "${BACKEND_DIR}/bootstrap/cache" 2>/dev/null || true
chmod -R 775 "${BACKEND_DIR}/storage"
chown -R www-data:www-data "${PROJECT_DIR}/storage"
chmod -R 775 "${PROJECT_DIR}/storage"

# 7. Перезапуск очередей
echo "[7/8] Перезапуск очередей..."
supervisorctl reread
supervisorctl update
supervisorctl restart clipartweb-workers:*

# 8. Перезапуск Apache
echo "[8/8] Перезапуск Apache..."
systemctl reload apache2

echo ""
echo "=========================================="
echo " Развёртывание завершено!"
echo "=========================================="
echo " URL: https://clipartweb.1tlt.ru"
echo "=========================================="
