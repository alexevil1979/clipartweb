<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Overlay extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'project_id',
        'sort_order',
        'type',
        'name',
        'file_path',
        'original_name',
        'start_time',
        'duration',
        'until_end',
        'x_percent',
        'y_percent',
        'scale',
        'opacity',
        'fade_in',
        'fade_out',
        'remove_bg',
        'bg_tolerance',
        'text_content',
        'font_family',
        'font_size',
        'font_color',
        'text_bold',
        'text_italic',
        'text_bg_color',
        'text_outline',
        'text_outline_color',
    ];

    protected $casts = [
        'start_time' => 'float',
        'duration' => 'float',
        'until_end' => 'boolean',
        'x_percent' => 'float',
        'y_percent' => 'float',
        'scale' => 'float',
        'opacity' => 'float',
        'fade_in' => 'float',
        'fade_out' => 'float',
        'remove_bg' => 'boolean',
        'bg_tolerance' => 'integer',
        'font_size' => 'integer',
        'text_bold' => 'boolean',
        'text_italic' => 'boolean',
        'text_outline' => 'boolean',
        'sort_order' => 'integer',
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

    // --- Helpers ---

    public function getFileUrl(): ?string
    {
        if (!$this->file_path) return null;
        return url('/api/overlays/' . $this->uuid . '/file');
    }

    public function isVisibleAt(float $time): bool
    {
        $endTime = $this->until_end ? PHP_FLOAT_MAX : $this->start_time + $this->duration;
        return $time >= $this->start_time && $time < $endTime;
    }

    public function opacityAt(float $time): float
    {
        if (!$this->isVisibleAt($time)) return 0;

        $baseOpacity = $this->opacity / 100;
        $endTime = $this->until_end ? PHP_FLOAT_MAX : $this->start_time + $this->duration;
        $elapsed = $time - $this->start_time;
        $remaining = $endTime - $time;

        if ($this->fade_in > 0 && $elapsed < $this->fade_in) {
            $baseOpacity *= $elapsed / $this->fade_in;
        }

        if ($this->fade_out > 0 && $remaining < $this->fade_out) {
            $baseOpacity *= $remaining / $this->fade_out;
        }

        return max(0, min(1, $baseOpacity));
    }

    public function toRenderArray(): array
    {
        return [
            'id' => $this->uuid,
            'type' => $this->type,
            'name' => $this->name,
            'file_path' => $this->file_path,
            'start_time' => $this->start_time,
            'duration' => $this->duration,
            'until_end' => $this->until_end,
            'x_percent' => $this->x_percent,
            'y_percent' => $this->y_percent,
            'scale' => $this->scale,
            'opacity' => $this->opacity,
            'fade_in' => $this->fade_in,
            'fade_out' => $this->fade_out,
            'remove_bg' => $this->remove_bg,
            'bg_tolerance' => $this->bg_tolerance,
            'text_content' => $this->text_content,
            'font_family' => $this->font_family,
            'font_size' => $this->font_size,
            'font_color' => $this->font_color,
            'text_bold' => $this->text_bold,
            'text_italic' => $this->text_italic,
            'text_bg_color' => $this->text_bg_color,
            'text_outline' => $this->text_outline,
            'text_outline_color' => $this->text_outline_color,
        ];
    }
}
