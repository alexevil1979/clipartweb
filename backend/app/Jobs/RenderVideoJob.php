<?php

namespace App\Jobs;

use App\Models\RenderJob;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;

class RenderVideoJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 3600; // 1 час максимум
    public $tries = 2;

    public function __construct(
        public RenderJob $renderJob
    ) {}

    public function handle(): void
    {
        $renderJob = $this->renderJob;
        $project = $renderJob->project;
        $user = $renderJob->user;

        $renderJob->markAsProcessing();
        $project->update(['status' => 'rendering', 'render_progress' => 0]);

        try {
            // Подготовить данные проекта для Python-скрипта
            $projectData = $project->toExportArray();
            $projectData['settings'] = $renderJob->settings;
            $projectData['watermark'] = $renderJob->settings['watermark'] ?? false;
            $projectData['max_resolution'] = $renderJob->settings['max_resolution'] ?? 720;

            // Выходной файл
            $storagePath = env('STORAGE_PATH', storage_path('app'));
            $outputDir = $storagePath . '/renders/' . $project->uuid;
            if (!is_dir($outputDir)) {
                mkdir($outputDir, 0755, true);
            }
            $outputPath = $outputDir . '/' . Str::uuid() . '.mp4';

            // Файл прогресса
            $progressFile = $outputDir . '/progress.json';

            // JSON с данными проекта
            $projectFile = $outputDir . '/project.json';
            file_put_contents($projectFile, json_encode($projectData, JSON_UNESCAPED_UNICODE));

            // Запустить Python-скрипт рендеринга
            $pythonPath = env('PYTHON_PATH', 'python3');
            $scriptPath = env('RENDER_SCRIPT_PATH', base_path('../scripts/render.py'));
            $ffmpegPath = env('FFMPEG_PATH', 'ffmpeg');

            $cmd = sprintf(
                '%s %s --project %s --output %s --progress %s --ffmpeg %s 2>&1',
                escapeshellarg($pythonPath),
                escapeshellarg($scriptPath),
                escapeshellarg($projectFile),
                escapeshellarg($outputPath),
                escapeshellarg($progressFile),
                escapeshellarg($ffmpegPath)
            );

            // Запуск процесса
            $process = proc_open($cmd, [
                1 => ['pipe', 'w'],
                2 => ['pipe', 'w'],
            ], $pipes);

            if (!is_resource($process)) {
                throw new \Exception('Не удалось запустить процесс рендеринга');
            }

            // Мониторинг прогресса
            $lastProgress = 0;
            while (proc_get_status($process)['running']) {
                if (file_exists($progressFile)) {
                    $progressData = json_decode(file_get_contents($progressFile), true);
                    if ($progressData && isset($progressData['percent'])) {
                        $percent = (int) $progressData['percent'];
                        if ($percent !== $lastProgress) {
                            $renderJob->updateProgress($percent);
                            $project->update(['render_progress' => $percent]);
                            $lastProgress = $percent;
                        }
                    }
                }
                usleep(500000); // 0.5 сек
            }

            $stdout = stream_get_contents($pipes[1]);
            $stderr = stream_get_contents($pipes[2]);
            fclose($pipes[1]);
            fclose($pipes[2]);

            $exitCode = proc_close($process);

            if ($exitCode !== 0) {
                throw new \Exception("Рендеринг завершился с ошибкой (код {$exitCode}): {$stderr}");
            }

            if (!file_exists($outputPath)) {
                throw new \Exception('Файл результата не создан');
            }

            $outputSize = filesize($outputPath);

            // Обновить записи
            $renderJob->markAsCompleted($outputPath, $outputSize);
            $project->update([
                'status' => 'completed',
                'render_path' => $outputPath,
                'render_progress' => 100,
                'rendered_at' => now(),
            ]);

            // Очистка
            if (file_exists($projectFile)) unlink($projectFile);
            if (file_exists($progressFile)) unlink($progressFile);

        } catch (\Exception $e) {
            $renderJob->markAsFailed($e->getMessage());
            $project->update([
                'status' => 'failed',
                'render_error' => $e->getMessage(),
            ]);

            throw $e; // для повторных попыток
        }
    }

    public function failed(\Throwable $exception): void
    {
        $this->renderJob->markAsFailed($exception->getMessage());
        $this->renderJob->project->update([
            'status' => 'failed',
            'render_error' => $exception->getMessage(),
        ]);
    }
}
