<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class AssetController extends Controller
{
    /**
     * Библиотека ассетов (системные + пользовательские)
     */
    public function index(Request $request): JsonResponse
    {
        $assets = Asset::userAssets($request->user()->id)
            ->orderByDesc('is_system')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'assets' => $assets,
        ]);
    }

    /**
     * Системные ассеты
     */
    public function system(): JsonResponse
    {
        $assets = Asset::system()
            ->orderBy('category')
            ->orderBy('name')
            ->get();

        return response()->json([
            'assets' => $assets,
        ]);
    }

    /**
     * Загрузить свой ассет
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:png,jpg,jpeg,gif,webp,bmp,apng|max:10240',
            'name' => 'sometimes|string|max:255',
            'category' => 'sometimes|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Ошибка валидации',
                'errors' => $validator->errors(),
            ], 422);
        }

        $file = $request->file('file');
        $storagePath = env('STORAGE_PATH', storage_path('app'));
        $assetDir = $storagePath . '/assets/user_' . $request->user()->id;
        if (!is_dir($assetDir)) {
            mkdir($assetDir, 0755, true);
        }

        $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
        $fullPath = $assetDir . '/' . $filename;
        $file->move($assetDir, $filename);

        // Определить тип
        $ext = strtolower($file->getClientOriginalExtension());
        $type = in_array($ext, ['gif', 'apng']) ? 'gif' : 'image';

        // Размеры
        $imageInfo = @getimagesize($fullPath);
        $width = $imageInfo[0] ?? null;
        $height = $imageInfo[1] ?? null;

        $asset = Asset::create([
            'user_id' => $request->user()->id,
            'name' => $request->get('name', pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME)),
            'file_path' => $fullPath,
            'type' => $type,
            'mime_type' => $file->getClientMimeType(),
            'file_size' => $file->getSize(),
            'width' => $width,
            'height' => $height,
            'is_system' => false,
            'category' => $request->get('category', 'Загруженные'),
        ]);

        return response()->json([
            'message' => 'Ассет загружен',
            'asset' => $asset,
        ], 201);
    }

    /**
     * Удалить ассет
     */
    public function destroy(Request $request, string $uuid): JsonResponse
    {
        $asset = Asset::where('uuid', $uuid)
            ->where('user_id', $request->user()->id)
            ->where('is_system', false)
            ->firstOrFail();

        if (file_exists($asset->file_path)) {
            unlink($asset->file_path);
        }

        $asset->delete();

        return response()->json([
            'message' => 'Ассет удалён',
        ]);
    }

    /**
     * Файл ассета
     */
    public function file(Request $request, string $uuid)
    {
        $asset = Asset::where('uuid', $uuid)->firstOrFail();

        // Системные ассеты доступны всем авторизованным, пользовательские — только владельцу
        if (!$asset->is_system && $asset->user_id !== $request->user()->id) {
            abort(403);
        }

        if (!file_exists($asset->file_path)) {
            return response()->json(['message' => 'Файл не найден'], 404);
        }

        return response()->file($asset->file_path, [
            'Content-Type' => $asset->mime_type,
        ]);
    }

    /**
     * Миниатюра ассета
     */
    public function thumbnail(Request $request, string $uuid)
    {
        $asset = Asset::where('uuid', $uuid)->firstOrFail();

        if (!$asset->is_system && $asset->user_id !== $request->user()->id) {
            abort(403);
        }

        $path = $asset->thumbnail_path ?: $asset->file_path;
        if (!file_exists($path)) {
            return response()->json(['message' => 'Файл не найден'], 404);
        }

        return response()->file($path, [
            'Content-Type' => $asset->mime_type,
        ]);
    }
}
