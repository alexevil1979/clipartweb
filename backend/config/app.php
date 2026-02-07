<?php

return [
    'name' => env('APP_NAME', 'ClipArtWeb'),
    'env' => env('APP_ENV', 'production'),
    'debug' => (bool) env('APP_DEBUG', false),
    'url' => env('APP_URL', 'https://clipartweb.1tlt.ru'),
    'frontend_url' => env('FRONTEND_URL', 'https://clipartweb.1tlt.ru'),
    'timezone' => 'Europe/Moscow',
    'locale' => 'ru',
    'key' => env('APP_KEY'),
    'cipher' => 'AES-256-CBC',

    'limits' => [
        'free' => [
            'max_elements' => (int) env('FREE_MAX_ELEMENTS', 3),
            'max_duration' => (int) env('MAX_VIDEO_DURATION_FREE', 60),
            'max_resolution' => (int) env('FREE_MAX_RESOLUTION', 720),
            'watermark' => true,
            'priority' => 'low',
        ],
        'pro' => [
            'max_elements' => PHP_INT_MAX,
            'max_duration' => (int) env('MAX_VIDEO_DURATION_PRO', 1800),
            'max_resolution' => (int) env('PRO_MAX_RESOLUTION', 2160),
            'watermark' => false,
            'priority' => 'high',
        ],
    ],
];
