<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Project extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'uuid',
        'user_id',
        'name',
        'video_path',
        'video_original_name',
        'video_size',
        'video_duration',
        'video_width',
        'video_height',
        'video_fps',
        'thumbnail_path',
        'status',
        'render_path',
        'render_progress',
        'render_error',
        'rendered_at',
    ];

    protected $casts = [
        'video_duration' => 'float',
        'video_fps' => 'float',
        'video_size' => 'integer',
        'video_width' => 'integer',
        'video_height' => 'integer',
        'render_progress' => 'integer',
        'rendered_at' => 'datetime',
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

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function overlays()
    {
        return $this->hasMany(Overlay::class)->orderBy('sort_order');
    }

    public function renderJobs()
    {
        return $this->hasMany(RenderJob::class);
    }

    public function latestRenderJob()
    {
        return $this->hasOne(RenderJob::class)->latestOfMany();
    }

    // --- Helpers ---

    public function getVideoUrl(): ?string
    {
        if (!$this->video_path) return null;
        return url('/api/projects/' . $this->uuid . '/video');
    }

    public function getThumbnailUrl(): ?string
    {
        if (!$this->thumbnail_path) return null;
        return url('/api/projects/' . $this->uuid . '/thumbnail');
    }

    public function getRenderUrl(): ?string
    {
        if (!$this->render_path) return null;
        return url('/api/projects/' . $this->uuid . '/download');
    }

    public function isRendering(): bool
    {
        return $this->status === 'rendering';
    }

    public function toExportArray(): array
    {
        return [
            'video_path' => $this->video_path,
            'video_duration' => $this->video_duration,
            'video_width' => $this->video_width,
            'video_height' => $this->video_height,
            'video_fps' => $this->video_fps,
            'overlays' => $this->overlays->map(fn($o) => $o->toRenderArray())->toArray(),
        ];
    }
}
