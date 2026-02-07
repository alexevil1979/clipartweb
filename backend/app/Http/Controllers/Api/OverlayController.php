<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Overlay;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class OverlayController extends Controller
{
    /**
     * Список оверлеев проекта
     */
    public function index(Request $request, string $projectUuid): JsonResponse
    {
        $project = $request->user()
            ->projects()
            ->where('uuid', $projectUuid)
            ->firstOrFail();

        return response()->json([
            'overlays' => $project->overlays,
        ]);
    }

    /**
     * Добавить оверлей
     */
    public function store(Request $request, string $projectUuid): JsonResponse
    {
        $project = $request->user()
            ->projects()
            ->where('uuid', $projectUuid)
            ->firstOrFail();

        // Проверка лимита элементов
        $limits = $request->user()->getPlanLimits();
        if ($project->overlays()->count() >= $limits['max_elements']) {
            return response()->json([
                'message' => "Максимум {$limits['max_elements']} элементов. Обновите план для снятия ограничения.",
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'type' => 'required|in:image,gif,text',
            'name' => 'required|string|max:255',
            'file' => 'required_unless:type,text|file|mimes:png,jpg,jpeg,gif,webp,bmp|max:10240',
            'start_time' => 'sometimes|numeric|min:0',
            'duration' => 'sometimes|numeric|min:0.1',
            'until_end' => 'sometimes|boolean',
            'x_percent' => 'sometimes|numeric|min:0|max:100',
            'y_percent' => 'sometimes|numeric|min:0|max:100',
            'scale' => 'sometimes|numeric|min:1|max:500',
            'opacity' => 'sometimes|numeric|min:0|max:100',
            'fade_in' => 'sometimes|numeric|min:0',
            'fade_out' => 'sometimes|numeric|min:0',
            'remove_bg' => 'sometimes|boolean',
            'bg_tolerance' => 'sometimes|integer|min:0|max:255',
            'text_content' => 'required_if:type,text|nullable|string|max:1000',
            'font_family' => 'sometimes|string|max:255',
            'font_size' => 'sometimes|integer|min:8|max:200',
            'font_color' => 'sometimes|string|max:7',
            'text_bold' => 'sometimes|boolean',
            'text_italic' => 'sometimes|boolean',
            'text_bg_color' => 'sometimes|nullable|string|max:9',
            'text_outline' => 'sometimes|boolean',
            'text_outline_color' => 'sometimes|string|max:7',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Ошибка валидации',
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $request->except('file');
        $data['sort_order'] = $project->overlays()->max('sort_order') + 1;

        // Обработка файла
        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $storagePath = env('STORAGE_PATH', storage_path('app'));
            $overlayDir = $storagePath . '/overlays/' . $project->uuid;
            if (!is_dir($overlayDir)) {
                mkdir($overlayDir, 0755, true);
            }

            $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
            $fullPath = $overlayDir . '/' . $filename;
            $file->move($overlayDir, $filename);

            $data['file_path'] = $fullPath;
            $data['original_name'] = $file->getClientOriginalName();
        }

        $overlay = $project->overlays()->create($data);

        return response()->json([
            'message' => 'Элемент добавлен',
            'overlay' => $overlay,
        ], 201);
    }

    /**
     * Обновить оверлей
     */
    public function update(Request $request, string $projectUuid, string $overlayUuid): JsonResponse
    {
        $project = $request->user()
            ->projects()
            ->where('uuid', $projectUuid)
            ->firstOrFail();

        $overlay = $project->overlays()
            ->where('uuid', $overlayUuid)
            ->firstOrFail();

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'start_time' => 'sometimes|numeric|min:0',
            'duration' => 'sometimes|numeric|min:0.1',
            'until_end' => 'sometimes|boolean',
            'x_percent' => 'sometimes|numeric|min:0|max:100',
            'y_percent' => 'sometimes|numeric|min:0|max:100',
            'scale' => 'sometimes|numeric|min:1|max:500',
            'opacity' => 'sometimes|numeric|min:0|max:100',
            'fade_in' => 'sometimes|numeric|min:0',
            'fade_out' => 'sometimes|numeric|min:0',
            'remove_bg' => 'sometimes|boolean',
            'bg_tolerance' => 'sometimes|integer|min:0|max:255',
            'text_content' => 'sometimes|nullable|string|max:1000',
            'font_family' => 'sometimes|string|max:255',
            'font_size' => 'sometimes|integer|min:8|max:200',
            'font_color' => 'sometimes|string|max:7',
            'text_bold' => 'sometimes|boolean',
            'text_italic' => 'sometimes|boolean',
            'text_bg_color' => 'sometimes|nullable|string|max:9',
            'text_outline' => 'sometimes|boolean',
            'text_outline_color' => 'sometimes|string|max:7',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Ошибка валидации',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Замена файла
        if ($request->hasFile('file')) {
            if ($overlay->file_path && file_exists($overlay->file_path)) {
                unlink($overlay->file_path);
            }

            $file = $request->file('file');
            $storagePath = env('STORAGE_PATH', storage_path('app'));
            $overlayDir = $storagePath . '/overlays/' . $project->uuid;
            if (!is_dir($overlayDir)) {
                mkdir($overlayDir, 0755, true);
            }

            $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
            $fullPath = $overlayDir . '/' . $filename;
            $file->move($overlayDir, $filename);

            $overlay->file_path = $fullPath;
            $overlay->original_name = $file->getClientOriginalName();
        }

        $overlay->update($request->except('file'));

        return response()->json([
            'message' => 'Элемент обновлён',
            'overlay' => $overlay->fresh(),
        ]);
    }

    /**
     * Удалить оверлей
     */
    public function destroy(Request $request, string $projectUuid, string $overlayUuid): JsonResponse
    {
        $project = $request->user()
            ->projects()
            ->where('uuid', $projectUuid)
            ->firstOrFail();

        $overlay = $project->overlays()
            ->where('uuid', $overlayUuid)
            ->firstOrFail();

        if ($overlay->file_path && file_exists($overlay->file_path)) {
            unlink($overlay->file_path);
        }

        $overlay->delete();

        return response()->json([
            'message' => 'Элемент удалён',
        ]);
    }

    /**
     * Переупорядочить оверлеи
     */
    public function reorder(Request $request, string $projectUuid): JsonResponse
    {
        $project = $request->user()
            ->projects()
            ->where('uuid', $projectUuid)
            ->firstOrFail();

        $validator = Validator::make($request->all(), [
            'order' => 'required|array',
            'order.*' => 'required|string', // uuid
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Ошибка валидации',
                'errors' => $validator->errors(),
            ], 422);
        }

        foreach ($request->order as $index => $uuid) {
            $project->overlays()
                ->where('uuid', $uuid)
                ->update(['sort_order' => $index]);
        }

        return response()->json([
            'message' => 'Порядок обновлён',
            'overlays' => $project->overlays()->orderBy('sort_order')->get(),
        ]);
    }

    /**
     * Файл оверлея
     */
    public function file(Request $request, string $overlayUuid)
    {
        $overlay = Overlay::where('uuid', $overlayUuid)->firstOrFail();

        // Проверка принадлежности
        $project = $overlay->project;
        if ($project->user_id !== $request->user()->id) {
            abort(403);
        }

        if (!$overlay->file_path || !file_exists($overlay->file_path)) {
            return response()->json(['message' => 'Файл не найден'], 404);
        }

        $mime = mime_content_type($overlay->file_path);
        return response()->file($overlay->file_path, [
            'Content-Type' => $mime,
        ]);
    }

    /**
     * Добавить из библиотеки ассетов
     */
    public function addFromAsset(Request $request, string $projectUuid): JsonResponse
    {
        $project = $request->user()
            ->projects()
            ->where('uuid', $projectUuid)
            ->firstOrFail();

        $limits = $request->user()->getPlanLimits();
        if ($project->overlays()->count() >= $limits['max_elements']) {
            return response()->json([
                'message' => "Максимум {$limits['max_elements']} элементов.",
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'asset_uuid' => 'required|string|exists:assets,uuid',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Ошибка валидации',
                'errors' => $validator->errors(),
            ], 422);
        }

        $asset = \App\Models\Asset::where('uuid', $request->asset_uuid)->firstOrFail();

        $type = $asset->type === 'animation' ? 'gif' : $asset->type;

        $overlay = $project->overlays()->create([
            'type' => $type,
            'name' => $asset->name,
            'file_path' => $asset->file_path,
            'original_name' => $asset->name,
            'sort_order' => $project->overlays()->max('sort_order') + 1,
        ]);

        return response()->json([
            'message' => 'Элемент добавлен из библиотеки',
            'overlay' => $overlay,
        ], 201);
    }
}
