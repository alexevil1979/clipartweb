<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class SubscriptionController extends Controller
{
    /**
     * Текущая подписка
     */
    public function current(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'plan' => $user->plan,
            'is_pro' => $user->isPro(),
            'plan_expires_at' => $user->plan_expires_at,
            'limits' => $user->getPlanLimits(),
            'storage_used' => $user->storage_used,
            'storage_limit' => $user->storage_limit,
        ]);
    }

    /**
     * Тарифы
     */
    public function plans(): JsonResponse
    {
        return response()->json([
            'plans' => [
                [
                    'id' => 'free',
                    'name' => 'Free',
                    'price' => 0,
                    'currency' => 'RUB',
                    'period' => null,
                    'features' => [
                        'До 3 элементов на видео',
                        'Водяной знак',
                        'Видео до 60 секунд',
                        'Разрешение до 720p',
                        'Низкий приоритет рендеринга',
                    ],
                    'limits' => config('app.limits.free'),
                ],
                [
                    'id' => 'pro_monthly',
                    'name' => 'Pro',
                    'price' => 990,
                    'currency' => 'RUB',
                    'period' => 'month',
                    'features' => [
                        'Без водяного знака',
                        'Неограниченное количество элементов',
                        'Видео до 30 минут',
                        'Разрешение до 4K',
                        'Высокий приоритет рендеринга',
                        'Сохранение проектов',
                        '10 ГБ хранилища',
                    ],
                    'limits' => config('app.limits.pro'),
                ],
                [
                    'id' => 'pro_yearly',
                    'name' => 'Pro (Годовой)',
                    'price' => 9900,
                    'currency' => 'RUB',
                    'period' => 'year',
                    'features' => [
                        'Всё из Pro',
                        'Экономия 17%',
                        '20 ГБ хранилища',
                    ],
                    'limits' => config('app.limits.pro'),
                ],
            ],
        ]);
    }

    /**
     * Создать Stripe Checkout Session
     */
    public function checkout(Request $request): JsonResponse
    {
        $request->validate([
            'plan' => 'required|in:pro_monthly,pro_yearly',
        ]);

        $user = $request->user();

        // Stripe integration
        $priceIds = [
            'pro_monthly' => env('STRIPE_PRICE_PRO_MONTHLY'),
            'pro_yearly' => env('STRIPE_PRICE_PRO_YEARLY'),
        ];

        $priceId = $priceIds[$request->plan] ?? null;

        if (!$priceId) {
            return response()->json([
                'message' => 'Тариф не настроен',
            ], 422);
        }

        try {
            $checkout = $user->newSubscription('default', $priceId)
                ->checkout([
                    'success_url' => config('app.frontend_url') . '/dashboard?subscription=success',
                    'cancel_url' => config('app.frontend_url') . '/pricing?subscription=cancelled',
                ]);

            return response()->json([
                'checkout_url' => $checkout->url,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Ошибка создания платежа: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Портал управления подпиской (Stripe Customer Portal)
     */
    public function portal(Request $request): JsonResponse
    {
        try {
            $url = $request->user()->billingPortalUrl(
                config('app.frontend_url') . '/dashboard'
            );

            return response()->json(['url' => $url]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Ошибка: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Stripe Webhook
     */
    public function webhook(Request $request): JsonResponse
    {
        $payload = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');
        $secret = env('STRIPE_WEBHOOK_SECRET');

        try {
            $event = \Stripe\Webhook::constructEvent($payload, $sigHeader, $secret);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Invalid signature'], 400);
        }

        switch ($event->type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                $this->handleSubscriptionUpdate($event->data->object);
                break;

            case 'customer.subscription.deleted':
                $this->handleSubscriptionDeleted($event->data->object);
                break;
        }

        return response()->json(['received' => true]);
    }

    private function handleSubscriptionUpdate($subscription): void
    {
        $user = \App\Models\User::where('stripe_id', $subscription->customer)->first();
        if (!$user) return;

        $user->update([
            'plan' => $subscription->status === 'active' ? 'pro' : 'free',
            'plan_expires_at' => $subscription->current_period_end
                ? \Carbon\Carbon::createFromTimestamp($subscription->current_period_end)
                : null,
            'storage_limit' => 10737418240, // 10GB for pro
        ]);
    }

    private function handleSubscriptionDeleted($subscription): void
    {
        $user = \App\Models\User::where('stripe_id', $subscription->customer)->first();
        if (!$user) return;

        $user->update([
            'plan' => 'free',
            'plan_expires_at' => null,
            'storage_limit' => 1073741824, // 1GB for free
        ]);
    }
}
