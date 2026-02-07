<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Laravel\Cashier\Billable;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, Billable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'avatar',
        'google_id',
        'plan',
        'plan_expires_at',
        'storage_used',
        'storage_limit',
        'renders_today',
        'renders_reset_date',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'stripe_id',
        'pm_type',
        'pm_last_four',
        'google_id',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'plan_expires_at' => 'datetime',
        'trial_ends_at' => 'datetime',
        'renders_reset_date' => 'date',
        'password' => 'hashed',
        'storage_used' => 'integer',
        'storage_limit' => 'integer',
        'renders_today' => 'integer',
    ];

    // --- Relationships ---

    public function projects()
    {
        return $this->hasMany(Project::class);
    }

    public function assets()
    {
        return $this->hasMany(Asset::class);
    }

    public function renderJobs()
    {
        return $this->hasMany(RenderJob::class);
    }

    // --- Helpers ---

    public function isPro(): bool
    {
        return $this->plan === 'pro' && 
               ($this->plan_expires_at === null || $this->plan_expires_at->isFuture());
    }

    public function getPlanLimits(): array
    {
        return config('app.limits.' . ($this->isPro() ? 'pro' : 'free'));
    }

    public function canAddElement(): bool
    {
        return true; // проверка в контроллере с учётом проекта
    }

    public function getRemainingStorage(): int
    {
        return max(0, $this->storage_limit - $this->storage_used);
    }

    public function addStorageUsage(int $bytes): void
    {
        $this->increment('storage_used', $bytes);
    }

    public function removeStorageUsage(int $bytes): void
    {
        $this->decrement('storage_used', min($bytes, $this->storage_used));
    }

    public function resetDailyRenders(): void
    {
        if ($this->renders_reset_date === null || $this->renders_reset_date->isPast()) {
            $this->update([
                'renders_today' => 0,
                'renders_reset_date' => now()->addDay(),
            ]);
        }
    }

    public function toArray()
    {
        $array = parent::toArray();
        $array['is_pro'] = $this->isPro();
        $array['plan_limits'] = $this->getPlanLimits();
        $array['remaining_storage'] = $this->getRemainingStorage();
        return $array;
    }
}
