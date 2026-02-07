<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class RenderJob extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'project_id',
        'user_id',
        'status',
        'priority',
        'progress',
        'error_message',
        'output_path',
        'output_size',
        'render_time_seconds',
        'settings',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'progress' => 'integer',
        'output_size' => 'integer',
        'render_time_seconds' => 'integer',
        'settings' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->uuid)) {
                $model->uuid = Str::uuid()->toString();
            }
        });
    }

    // --- Relationships ---

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // --- Helpers ---

    public function markAsProcessing(): void
    {
        $this->update([
            'status' => 'processing',
            'started_at' => now(),
        ]);
    }

    public function markAsCompleted(string $outputPath, int $outputSize): void
    {
        $this->update([
            'status' => 'completed',
            'progress' => 100,
            'output_path' => $outputPath,
            'output_size' => $outputSize,
            'completed_at' => now(),
            'render_time_seconds' => now()->diffInSeconds($this->started_at),
        ]);
    }

    public function markAsFailed(string $error): void
    {
        $this->update([
            'status' => 'failed',
            'error_message' => $error,
            'completed_at' => now(),
        ]);
    }

    public function updateProgress(int $percent): void
    {
        $this->update(['progress' => min(100, max(0, $percent))]);
    }
}
