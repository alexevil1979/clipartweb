<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assets', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('file_path');
            $table->string('thumbnail_path')->nullable();
            $table->enum('type', ['image', 'gif', 'animation']);
            $table->string('mime_type');
            $table->bigInteger('file_size');
            $table->integer('width')->nullable();
            $table->integer('height')->nullable();
            $table->boolean('is_system')->default(false); // встроенные CTA
            $table->string('category')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'type']);
            $table->index('is_system');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assets');
    }
};
