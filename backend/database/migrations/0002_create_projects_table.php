<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('video_path')->nullable();
            $table->string('video_original_name')->nullable();
            $table->bigInteger('video_size')->default(0);
            $table->float('video_duration')->nullable();
            $table->integer('video_width')->nullable();
            $table->integer('video_height')->nullable();
            $table->float('video_fps')->nullable();
            $table->string('thumbnail_path')->nullable();
            $table->enum('status', ['draft', 'rendering', 'completed', 'failed'])->default('draft');
            $table->string('render_path')->nullable();
            $table->integer('render_progress')->default(0);
            $table->text('render_error')->nullable();
            $table->timestamp('rendered_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
