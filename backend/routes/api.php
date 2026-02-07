<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\OverlayController;
use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\SubscriptionController;

/*
|--------------------------------------------------------------------------
| API Routes — /api/...
|--------------------------------------------------------------------------
*/

// --- Публичные маршруты ---

// Аутентификация
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::get('/google', [AuthController::class, 'googleRedirect']);
    Route::get('/google/callback', [AuthController::class, 'googleCallback']);
});

// Тарифы (публично)
Route::get('/plans', [SubscriptionController::class, 'plans']);

// Stripe webhook
Route::post('/webhook/stripe', [SubscriptionController::class, 'webhook']);

// --- Защищённые маршруты (требуется авторизация) ---

Route::middleware('auth:sanctum')->group(function () {

    // Профиль
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);
    Route::put('/password', [AuthController::class, 'changePassword']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Подписки
    Route::prefix('subscription')->group(function () {
        Route::get('/', [SubscriptionController::class, 'current']);
        Route::post('/checkout', [SubscriptionController::class, 'checkout']);
        Route::get('/portal', [SubscriptionController::class, 'portal']);
    });

    // Проекты
    Route::prefix('projects')->group(function () {
        Route::get('/', [ProjectController::class, 'index']);
        Route::post('/', [ProjectController::class, 'store']);
        Route::get('/{uuid}', [ProjectController::class, 'show']);
        Route::put('/{uuid}', [ProjectController::class, 'update']);
        Route::delete('/{uuid}', [ProjectController::class, 'destroy']);
        Route::post('/{uuid}/duplicate', [ProjectController::class, 'duplicate']);

        // Видео
        Route::post('/{uuid}/video', [ProjectController::class, 'uploadVideo']);
        Route::get('/{uuid}/video', [ProjectController::class, 'streamVideo']);
        Route::get('/{uuid}/thumbnail', [ProjectController::class, 'thumbnail']);

        // Рендеринг
        Route::post('/{uuid}/render', [ProjectController::class, 'render']);
        Route::get('/{uuid}/render-status', [ProjectController::class, 'renderStatus']);
        Route::get('/{uuid}/download', [ProjectController::class, 'download']);

        // Оверлеи
        Route::get('/{uuid}/overlays', [OverlayController::class, 'index']);
        Route::post('/{uuid}/overlays', [OverlayController::class, 'store']);
        Route::post('/{uuid}/overlays/from-asset', [OverlayController::class, 'addFromAsset']);
        Route::put('/{uuid}/overlays/{overlayUuid}', [OverlayController::class, 'update']);
        Route::delete('/{uuid}/overlays/{overlayUuid}', [OverlayController::class, 'destroy']);
        Route::put('/{uuid}/overlays/reorder', [OverlayController::class, 'reorder']);
    });

    // Файл оверлея (отдельный роут для превью)
    Route::get('/overlays/{uuid}/file', [OverlayController::class, 'file']);

    // Ассеты (библиотека)
    Route::prefix('assets')->group(function () {
        Route::get('/', [AssetController::class, 'index']);
        Route::get('/system', [AssetController::class, 'system']);
        Route::post('/', [AssetController::class, 'store']);
        Route::delete('/{uuid}', [AssetController::class, 'destroy']);
        Route::get('/{uuid}/file', [AssetController::class, 'file']);
        Route::get('/{uuid}/thumbnail', [AssetController::class, 'thumbnail']);
    });
});
