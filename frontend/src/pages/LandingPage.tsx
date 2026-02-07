import { Link } from 'react-router-dom';
import { Play, Zap, Cloud, Shield, Star, ArrowRight, Video, Sparkles, Layers } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-base">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-surface-0/30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue to-mauve rounded-xl flex items-center justify-center">
              <Video className="w-5 h-5 text-base" />
            </div>
            <span className="text-xl font-bold text-text">ClipArtWeb</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-subtext-0 hover:text-text transition-colors">Возможности</a>
            <a href="#pricing" className="text-subtext-0 hover:text-text transition-colors">Тарифы</a>
            <Link to="/login" className="text-subtext-0 hover:text-text transition-colors">Войти</Link>
            <Link to="/register" className="btn-primary flex items-center gap-2">
              Попробовать бесплатно <ArrowRight className="w-4 h-4" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue/10 text-blue px-4 py-2 rounded-full mb-8">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">Облачный рендеринг видео</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6">
            <span className="text-text">Добавляйте </span>
            <span className="bg-gradient-to-r from-blue via-mauve to-pink bg-clip-text text-transparent">
              CTA-оверлеи
            </span>
            <br />
            <span className="text-text">к видео онлайн</span>
          </h1>

          <p className="text-xl text-subtext-0 max-w-2xl mx-auto mb-10">
            Загружайте видео, добавляйте анимированные GIF, PNG и текстовые CTA-элементы,
            настраивайте анимации — и рендерите в облаке. Без установки программ.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="btn-primary text-lg px-8 py-3 flex items-center justify-center gap-2">
              <Play className="w-5 h-5" /> Начать бесплатно
            </Link>
            <a href="#features" className="btn-secondary text-lg px-8 py-3 flex items-center justify-center gap-2">
              Узнать больше
            </a>
          </div>

          {/* Preview mockup */}
          <div className="mt-16 relative">
            <div className="bg-mantle rounded-2xl border border-surface-0 p-2 shadow-2xl shadow-blue/5 mx-auto max-w-5xl">
              <div className="bg-crust rounded-xl overflow-hidden aspect-video flex items-center justify-center">
                <div className="text-center">
                  <Layers className="w-16 h-16 text-surface-2 mx-auto mb-4" />
                  <p className="text-surface-2 text-lg">Превью редактора видео</p>
                  <p className="text-overlay-0 text-sm mt-2">Drag & drop, таймлайн, позиционирование в реальном времени</p>
                </div>
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-blue/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-mauve/10 rounded-full blur-3xl" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-mantle/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Всё для работы с видео CTA</h2>
          <p className="text-subtext-0 text-center mb-16 max-w-2xl mx-auto">
            Профессиональные инструменты для наложения CTA-элементов на видео — прямо в браузере
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Layers className="w-8 h-8" />,
                title: 'Мультислойные оверлеи',
                desc: 'GIF-анимации, PNG-изображения, текстовые CTA — неограниченные слои с индивидуальными настройками',
              },
              {
                icon: <Zap className="w-8 h-8" />,
                title: 'Облачный рендеринг',
                desc: 'Мощные серверы с GPU-ускорением. Рендерите до 4K без нагрузки на ваш компьютер',
              },
              {
                icon: <Cloud className="w-8 h-8" />,
                title: 'Облачное хранилище',
                desc: 'Все проекты сохраняются в облаке. Продолжайте работу с любого устройства',
              },
              {
                icon: <Play className="w-8 h-8" />,
                title: 'Превью в реальном времени',
                desc: 'Видите результат до рендеринга. Перетаскивайте элементы мышью прямо на превью',
              },
              {
                icon: <Star className="w-8 h-8" />,
                title: 'Библиотека CTA',
                desc: 'Готовые анимированные CTA-элементы. Подписки, лайки, стрелки, кнопки — десятки пресетов',
              },
              {
                icon: <Shield className="w-8 h-8" />,
                title: 'Удаление фона',
                desc: 'Автоматическое удаление фона (chroma key) для PNG и GIF — идеальное наложение',
              },
            ].map((feature, i) => (
              <div key={i} className="card hover:border-blue/30 transition-colors group">
                <div className="text-blue mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-subtext-0 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Простые тарифы</h2>
          <p className="text-subtext-0 text-center mb-16">Начните бесплатно, обновитесь когда будете готовы</p>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free */}
            <div className="card">
              <h3 className="text-2xl font-bold mb-2">Free</h3>
              <p className="text-4xl font-extrabold mb-6">0 ₽</p>
              <ul className="space-y-3 mb-8">
                {[
                  'До 3 элементов на видео',
                  'Водяной знак ClipArtWeb',
                  'Видео до 60 секунд',
                  'Разрешение до 720p',
                  'Низкий приоритет рендеринга',
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-subtext-0">
                    <div className="w-5 h-5 bg-surface-0 rounded-full flex items-center justify-center text-xs">✓</div>
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/register" className="btn-secondary w-full text-center block">
                Начать бесплатно
              </Link>
            </div>

            {/* Pro */}
            <div className="card border-blue/50 relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-blue text-base text-xs font-bold px-3 py-1 rounded-full">
                Популярный
              </div>
              <h3 className="text-2xl font-bold mb-2">Pro</h3>
              <p className="text-4xl font-extrabold mb-1">990 ₽</p>
              <p className="text-subtext-0 text-sm mb-6">/ месяц</p>
              <ul className="space-y-3 mb-8">
                {[
                  'Без водяного знака',
                  'Неограниченные элементы',
                  'Видео до 30 минут',
                  'Разрешение до 4K',
                  'Высокий приоритет рендеринга',
                  'Сохранение проектов в облаке',
                  '10 ГБ хранилища',
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-text">
                    <div className="w-5 h-5 bg-blue/20 text-blue rounded-full flex items-center justify-center text-xs">✓</div>
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/register" className="btn-primary w-full text-center block">
                Начать с Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Bottom */}
      <section className="py-20 px-6 bg-gradient-to-b from-mantle/50 to-base">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Готовы начать?</h2>
          <p className="text-subtext-0 mb-8">
            Присоединяйтесь к тысячам создателей контента, которые используют ClipArtWeb
            для профессионального оформления видео
          </p>
          <Link to="/register" className="btn-primary text-lg px-10 py-4 inline-flex items-center gap-2">
            Попробовать бесплатно <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-surface-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue to-mauve rounded-lg flex items-center justify-center">
              <Video className="w-4 h-4 text-base" />
            </div>
            <span className="font-semibold">ClipArtWeb</span>
          </div>
          <p className="text-subtext-0 text-sm">© 2026 ClipArtWeb. Все права защищены.</p>
          <div className="flex gap-6 text-sm text-subtext-0">
            <a href="#" className="hover:text-text transition-colors">Политика конфиденциальности</a>
            <a href="#" className="hover:text-text transition-colors">Условия использования</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
