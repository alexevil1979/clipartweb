#!/bin/bash
# ============================================
# ClipArtWeb — Первоначальная настройка VPS
# Запуск: sudo bash /ssd/www/clipartweb/server/setup.sh
# ============================================

set -e

echo "=========================================="
echo " ClipArtWeb — Первоначальная настройка"
echo "=========================================="

# 1. Системные зависимости
echo "[1/10] Установка системных зависимостей..."
apt-get update
apt-get install -y \
    apache2 \
    php8.2 php8.2-fpm php8.2-mysql php8.2-mbstring php8.2-xml php8.2-curl php8.2-zip php8.2-gd php8.2-bcmath \
    mysql-server \
    nodejs npm \
    python3 python3-pip python3-venv \
    ffmpeg \
    supervisor \
    certbot python3-certbot-apache \
    git curl unzip

# 2. Composer
echo "[2/10] Установка Composer..."
if ! command -v composer &> /dev/null; then
    curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
fi

# 3. Node.js (если старая версия)
echo "[3/10] Проверка Node.js..."
NODE_VERSION=$(node -v | cut -d. -f1 | tr -d 'v')
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Обновление Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# 4. MySQL — создание базы
echo "[4/10] Настройка MySQL..."
mysql -e "CREATE DATABASE IF NOT EXISTS clipartweb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS 'clipartweb'@'localhost' IDENTIFIED BY 'CHANGE_THIS_PASSWORD';"
mysql -e "GRANT ALL PRIVILEGES ON clipartweb.* TO 'clipartweb'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"
echo "  Не забудьте сменить пароль MySQL!"

# 5. Apache модули
echo "[5/10] Включение модулей Apache..."
a2enmod rewrite ssl headers proxy proxy_http expires
a2dissite 000-default 2>/dev/null || true

# 6. SSL сертификат
echo "[6/10] Получение SSL сертификата..."
certbot --apache -d clipartweb.1tlt.ru --non-interactive --agree-tos --email admin@1tlt.ru || echo "SSL: настройте вручную"

# 7. Конфигурация Apache
echo "[7/10] Конфигурация Apache..."
cp /ssd/www/clipartweb/server/apache-clipartweb.conf /etc/apache2/sites-available/clipartweb.conf
a2ensite clipartweb

# 8. Supervisor
echo "[8/10] Конфигурация Supervisor..."
cp /ssd/www/clipartweb/server/supervisor-clipartweb.conf /etc/supervisor/conf.d/clipartweb.conf

# 9. Создание директорий
echo "[9/10] Создание директорий хранилища..."
mkdir -p /ssd/www/clipartweb/storage/{videos,renders,assets,overlays,fonts}
mkdir -p /ssd/www/clipartweb/queue
chown -R www-data:www-data /ssd/www/clipartweb/storage
chown -R www-data:www-data /ssd/www/clipartweb/queue

# 10. Laravel setup
echo "[10/10] Настройка Laravel..."
cd /ssd/www/clipartweb/backend
cp .env.example .env
php artisan key:generate
echo "  Отредактируйте .env — укажите пароль MySQL, ключи Stripe, и т.д."

# Запуск
echo ""
echo "=========================================="
echo " Установка завершена!"
echo "=========================================="
echo ""
echo " Следующие шаги:"
echo "  1. Отредактируйте /ssd/www/clipartweb/backend/.env"
echo "  2. Запустите: bash /ssd/www/clipartweb/server/deploy.sh"
echo "  3. Откройте: https://clipartweb.1tlt.ru"
echo ""
