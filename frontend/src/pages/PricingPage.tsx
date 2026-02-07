import { Link } from 'react-router-dom';
import { Video, Check, ArrowLeft } from 'lucide-react';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-base px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-12">
          <Link to="/" className="btn-ghost flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Назад
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue to-mauve rounded-lg flex items-center justify-center">
              <Video className="w-4 h-4 text-base" />
            </div>
            <span className="font-bold">ClipArtWeb</span>
          </div>
        </div>

        <h1 className="text-4xl font-bold text-center mb-4">Выберите тариф</h1>
        <p className="text-subtext-0 text-center mb-16 max-w-xl mx-auto">
          Начните бесплатно или выберите Pro для полного доступа ко всем возможностям
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Free */}
          <div className="card flex flex-col">
            <h3 className="text-xl font-bold mb-1">Free</h3>
            <p className="text-3xl font-extrabold mb-6">0 ₽</p>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                'До 3 элементов на видео',
                'Водяной знак',
                'Видео до 60 сек',
                '720p макс.',
                'Низкий приоритет',
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-subtext-0">
                  <Check className="w-4 h-4 text-overlay-0 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link to="/register" className="btn-secondary w-full text-center">
              Начать бесплатно
            </Link>
          </div>

          {/* Pro Monthly */}
          <div className="card border-blue/50 flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue text-base text-xs font-bold px-4 py-1 rounded-full">
              Популярный
            </div>
            <h3 className="text-xl font-bold mb-1">Pro</h3>
            <p className="text-3xl font-extrabold mb-1">990 ₽</p>
            <p className="text-subtext-0 text-sm mb-6">/ месяц</p>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                'Без водяного знака',
                'Неограниченные элементы',
                'Видео до 30 мин',
                'До 4K разрешение',
                'Высокий приоритет',
                '10 ГБ хранилища',
                'Сохранение проектов',
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-blue mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link to="/register" className="btn-primary w-full text-center">
              Выбрать Pro
            </Link>
          </div>

          {/* Pro Yearly */}
          <div className="card flex flex-col">
            <h3 className="text-xl font-bold mb-1">Pro (Годовой)</h3>
            <p className="text-3xl font-extrabold mb-1">9 900 ₽</p>
            <p className="text-subtext-0 text-sm mb-1">/ год</p>
            <p className="text-green text-sm font-medium mb-6">Экономия 17%</p>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                'Все возможности Pro',
                '20 ГБ хранилища',
                'Приоритетная поддержка',
                'Ранний доступ к фичам',
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-green mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link to="/register" className="btn-secondary w-full text-center">
              Выбрать годовой
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
