<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Overlay;
use App\Jobs\RenderVideoJob;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ProjectController extends Controller
{
    /**
     * Список проектов пользователя
     */
    public function index(Request $request): JsonResponse
    {
        $projects = $request->user()
            ->projects()
            ->withCount('overlays')
            ->orderByDesc('updated_at')
            ->paginate(20);

        return response()->json($projects);
    }

    /**
     * Создать проект
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Ошибка валидации',
                'errors' => $validator->errors(),
            ], 422);
        }

        $project = $request->user()->projects()->create([
            'name' => $request->name,
            'status' => 'draft',
        ]);

        return response()->json([
            'message' => 'Проект создан',
            'project' => $project->load('overlays'),
        ], 201);
    }

    /**
     * Получить проект
     */
    public function show(Request $request, string $uuid): JsonResponse
    {
        $project = $request->user()
            ->projects()
            ->where('uuid', $uuid)
            ->with(['overlays', 'latestRenderJob'])
            ->firstOrFail();

        return response()->json([
            'project' => $project,
        ]);
    }

    /**
     * Обновить проект
     */
    public function update(Request $request, string $uuid): JsonResponse
    {
        $project = $request->user()
            ->projects()
            ->where('uuid', $uuid)
            ->firstOrFail();

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Ошибка валидации',
                'errors' => $validator->errors(),
            ], 422);
        }

        $project->update($request->only('name'));

        return response()->json([
            'message' => 'Проект обновлён',
            'project' => $project->fresh()->load('overlays'),
        ]);
    }

    /**
     * Удалить проект
     */
    public function destroy(Request $request, string $uuid): JsonResponse
    {
        $project = $request->user()
            ->projects()
            ->where('uuid', $uuid)
            ->firstOrFail();

        // Удалить файлы
        if ($project->video_path && file_exists($project->video_path)) {
            unlink($project->video_path);
            $request->user()->removeStorageUsage($project->video_size);
        }
        if ($project->render_path && file_exists($project->render_path)) {
            unlink($project->render_path);
        }
        if ($project->thumbnail_path && file_exists($project->thumbnail_path)) {
            unlink($project->thumbnail_path);
        }

        // Удалить файлы оверлеев
        foreach ($project->overlays as $overlay) {
            if ($overlay->file_path && file_exists($overlay->file_path)) {
                unlink($overlay->file_path);
            }
        }

        $project->delete();

        return response()->json([
            'message' => 'Проект удалён',
        ]);
    }

    /**
     * Загрузить видео в проект
     */
    public function uploadVideo(Request $request, string $uuid): JsonResponse
    {
        $project = $request->user()
            ->projects()
            ->where('uuid', $uuid)
            ->firstOrFail();

        $maxSize = (int) env('MAX_UPLOAD_SIZE_MB', 500) * 1024; // KB

        $validator = Validator::make($request->all(), [
            'video' => "required|file|mimetypes:video/mp4,video/avi,video/quicktime,video/x-matroska,video/webm|max:{$maxSize}",
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Ошибка валидации',
                'errors' => $validator->errors(),
            ], 422);
        }

        $file = $request->file('video');
        $fileSize = $file->getSize();

        // Проверка лимита хранилища
        if ($request->user()->getRemainingStorage() < $fileSize) {
            return response()->json([
                'message' => 'Недостаточно места в хранилище',
            ], 422);
        }

        // Удалить старое видео
        if ($project->video_path && file_exists($project->video_path)) {
            $request->user()->removeStorageUsage($project->video_size);
            unlink($project->video_path);
        }

        // Сохранить новое видео
        $storagePath = env('STORAGE_PATH', storage_path('app'));
        $videoDir = $storagePath . '/videos/' . $project->uuid;
        if (!is_dir($videoDir)) {
            mkdir($videoDir, 0755, true);
        }

        $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
        $fullPath = $videoDir . '/' . $filename;
        $file->move($videoDir, $filename);

        // Получить метаданные видео через ffprobe
        $videoInfo = $this->getVideoInfo($fullPath);

        // Проверка длительности для бесплатного плана
        $limits = $request->user()->getPlanLimits();
        if ($videoInfo['duration'] > $limits['max_duration']) {
            unlink($fullPath);
            return response()->json([
                'message' => "Максимальная длительность видео: {$limits['max_duration']} сек. Ваше видео: {$videoInfo['duration']} сек.",
            ], 422);
        }

        // Создать миниатюру
        $thumbnailPath = $videoDir . '/thumb.jpg';
        $this->generateThumbnail($fullPath, $thumbnailPath);

        $project->update([
            'video_path' => $fullPath,
            'video_original_name' => $file->getClientOriginalName(),
            'video_size' => $fileSize,
            'video_duration' => $videoInfo['duration'],
            'video_width' => $videoInfo['width'],
            'video_height' => $videoInfo['height'],
            'video_fps' => $videoInfo['fps'],
            'thumbnail_path' => file_exists($thumbnailPath) ? $thumbnailPath : null,
        ]);

        $request->user()->addStorageUsage($fileSize);

        return response()->json([
            'message' => 'Видео загружено',
            'project' => $project->fresh()->load('overlays'),
        ]);
    }

    /**
     * Стриминг видео
     */
    public function streamVideo(Request $request, string $uuid)
    {
        $project = $request->user()
            ->projects()
            ->where('uuid', $uuid)
            ->firstOrFail();

        if (!$project->video_path || !file_exists($project->video_path)) {
            return response()->json(['message' => 'Видео не найдено'], 404);
        }

        return response()->file($project->video_path, [
            'Content-Type' => 'video/mp4',
            'Accept-Ranges' => 'bytes',
        ]);
    }

    /**
     * Миниатюра
     */
    public function thumbnail(Request $request, string $uuid)
    {
        $project = $request->user()
            ->projects()
            ->where('uuid', $uuid)
            ->firstOrFail();

        if (!$project->thumbnail_path || !file_exists($project->thumbnail_path)) {
            return response()->json(['message' => 'Миниатюра не найдена'], 404);
        }

        return response()->file($project->thumbnail_path, [
            'Content-Type' => 'image/jpeg',
        ]);
    }

    /**
     * Запустить рендеринг
     */
    public function render(Request $request, string $uuid): JsonResponse
    {
        $project = $request->user()
            ->projects()
            ->where('uuid', $uuid)
            ->with('overlays')
            ->firstOrFail();

        if (!$project->video_path) {
            return response()->json([
                'message' => 'Сначала загрузите видео',
            ], 422);
        }

        if ($project->isRendering()) {
            return response()->json([
                'message' => 'Проект уже рендерится',
            ], 422);
        }

        $user = $request->user();
        $limits = $user->getPlanLimits();

        // Создать задание на рендеринг
        $renderJob = $project->renderJobs()->create([
            'user_id' => $user->id,
            'status' => 'queued',
            'priority' => $limits['priority'],
            'settings' => [
                'max_resolution' => $limits['max_resolution'],
                'watermark' => $limits['watermark'],
                'codec' => 'h264',
            ],
        ]);

        $project->update([
            'status' => 'rendering',
            'render_progress' => 0,
            'render_error' => null,
        ]);

        // Dispatch в очередь
        $queue = $limits['priority'] === 'high' ? 'render-high' : 'render-low';
        RenderVideoJob::dispatch($renderJob)->onQueue($queue);

        return response()->json([
            'message' => 'Рендеринг запущен',
            'render_job' => $renderJob,
        ]);
    }

    /**
     * Статус рендеринга
     */
    public function renderStatus(Request $request, string $uuid): JsonResponse
    {
        $project = $request->user()
            ->projects()
            ->where('uuid', $uuid)
            ->with('latestRenderJob')
            ->firstOrFail();

        return response()->json([
            'status' => $project->status,
            'progress' => $project->render_progress,
            'render_job' => $project->latestRenderJob,
        ]);
    }

    /**
     * Скачать результат рендеринга
     */
    public function download(Request $request, string $uuid)
    {
        $project = $request->user()
            ->projects()
            ->where('uuid', $uuid)
            ->firstOrFail();

        if (!$project->render_path || !file_exists($project->render_path)) {
            return response()->json(['message' => 'Файл не найден'], 404);
        }

        $downloadName = Str::slug($project->name) . '_rendered.mp4';

        return response()->download($project->render_path, $downloadName, [
            'Content-Type' => 'video/mp4',
        ]);
    }

    /**
     * Дублировать проект
     */
    public function duplicate(Request $request, string $uuid): JsonResponse
    {
        $project = $request->user()
            ->projects()
            ->where('uuid', $uuid)
            ->with('overlays')
            ->firstOrFail();

        $newProject = $project->replicate();
        $newProject->uuid = Str::uuid()->toString();
        $newProject->name = $project->name . ' (копия)';
        $newProject->status = 'draft';
        $newProject->render_path = null;
        $newProject->render_progress = 0;
        $newProject->render_error = null;
        $newProject->rendered_at = null;
        $newProject->save();

        // Копировать оверлеи
        foreach ($project->overlays as $overlay) {
            $newOverlay = $overlay->replicate();
            $newOverlay->uuid = Str::uuid()->toString();
            $newOverlay->project_id = $newProject->id;
            $newOverlay->save();
        }

        return response()->json([
            'message' => 'Проект дублирован',
            'project' => $newProject->load('overlays'),
        ], 201);
    }

    // --- Private helpers ---

    private function getVideoInfo(string $path): array
    {
        $ffprobe = env('FFPROBE_PATH', 'ffprobe');
        $cmd = "{$ffprobe} -v quiet -print_format json -show_format -show_streams \"{$path}\" 2>&1";
        $output = shell_exec($cmd);
        $data = json_decode($output, true);

        $videoStream = null;
        if (isset($data['streams'])) {
            foreach ($data['streams'] as $stream) {
                if ($stream['codec_type'] === 'video') {
                    $videoStream = $stream;
                    break;
                }
            }
        }

        $duration = 0;
        if (isset($data['format']['duration'])) {
            $duration = (float) $data['format']['duration'];
        }

        $fps = 30;
        if ($videoStream && isset($videoStream['r_frame_rate'])) {
            $parts = explode('/', $videoStream['r_frame_rate']);
            if (count($parts) === 2 && $parts[1] > 0) {
                $fps = round($parts[0] / $parts[1], 2);
            }
        }

        return [
            'duration' => $duration,
            'width' => $videoStream['width'] ?? 1920,
            'height' => $videoStream['height'] ?? 1080,
            'fps' => $fps,
        ];
    }

    private function generateThumbnail(string $videoPath, string $outputPath): void
    {
        $ffmpeg = env('FFMPEG_PATH', 'ffmpeg');
        $cmd = "{$ffmpeg} -i \"{$videoPath}\" -ss 00:00:01 -vframes 1 -q:v 2 -y \"{$outputPath}\" 2>&1";
        shell_exec($cmd);
    }
}
