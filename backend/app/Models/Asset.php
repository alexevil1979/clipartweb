<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Asset extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'user_id',
        'name',
        'file_path',
        'thumbnail_path',
        'type',
        'mime_type',
        'file_size',
        'width',
        'height',
        'is_system',
        'category',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'width' => 'integer',
        'height' => 'integer',
        'is_system' => 'boolean',
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

    // --- Scopes ---

    public function scopeSystem($query)
    {
        return $query->where('is_system', true);
    }

    public function scopeUserAssets($query, int $userId)
    {
        return $query->where(function ($q) use ($userId) {
            $q->where('user_id', $userId)->orWhere('is_system', true);
        });
    }

    // --- Relationships ---

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // --- Helpers ---

    public function getUrl(): string
    {
        return url('/api/assets/' . $this->uuid . '/file');
    }

    public function getThumbnailUrl(): ?string
    {
        if (!$this->thumbnail_path) return null;
        return url('/api/assets/' . $this->uuid . '/thumbnail');
    }
}
