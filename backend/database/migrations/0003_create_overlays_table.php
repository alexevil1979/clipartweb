<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('overlays', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->integer('sort_order')->default(0);

            // Тип элемента
            $table->enum('type', ['image', 'gif', 'text'])->default('image');
            $table->string('name');

            // Файл (для image/gif)
            $table->string('file_path')->nullable();
            $table->string('original_name')->nullable();

            // Тайминг
            $table->float('start_time')->default(0);
            $table->float('duration')->default(5);
            $table->boolean('until_end')->default(false);

            // Позиция (в процентах)
            $table->float('x_percent')->default(50);
            $table->float('y_percent')->default(50);

            // Внешний вид
            $table->float('scale')->default(100);
            $table->float('opacity')->default(100);
            $table->float('fade_in')->default(0);
            $table->float('fade_out')->default(0);

            // Удаление фона
            $table->boolean('remove_bg')->default(false);
            $table->integer('bg_tolerance')->default(30);

            // Текстовые свойства
            $table->text('text_content')->nullable();
            $table->string('font_family')->default('Arial');
            $table->integer('font_size')->default(48);
            $table->string('font_color', 7)->default('#FFFFFF');
            $table->boolean('text_bold')->default(false);
            $table->boolean('text_italic')->default(false);
            $table->string('text_bg_color', 9)->nullable(); // с альфой
            $table->boolean('text_outline')->default(false);
            $table->string('text_outline_color', 7)->default('#000000');

            $table->timestamps();

            $table->index(['project_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('overlays');
    }
};
