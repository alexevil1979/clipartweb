#!/usr/bin/env python3
"""
ClipArtWeb — Серверный скрипт рендеринга видео с CTA-оверлеями.
Перенесена логика из десктопного приложения Video CTA Overlay Editor.

Использование:
    python3 render.py --project project.json --output output.mp4 --progress progress.json --ffmpeg /usr/bin/ffmpeg

project.json содержит:
{
    "video_path": "/path/to/video.mp4",
    "video_duration": 30.0,
    "video_width": 1920,
    "video_height": 1080,
    "video_fps": 30,
    "watermark": false,
    "max_resolution": 1080,
    "overlays": [ ... ]
}
"""

import argparse
import json
import os
import sys
import time
import subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, GifImagePlugin

try:
    from moviepy import VideoFileClip, ImageClip, VideoClip, CompositeVideoClip, vfx
except ImportError:
    from moviepy.editor import VideoFileClip, ImageClip, CompositeVideoClip
    from moviepy import vfx


def update_progress(progress_file: str, percent: int, message: str = ""):
    """Записать прогресс в JSON-файл для мониторинга."""
    data = {
        "percent": min(100, max(0, percent)),
        "message": message,
        "timestamp": time.time()
    }
    try:
        with open(progress_file, 'w') as f:
            json.dump(data, f)
    except Exception:
        pass


def check_nvenc(ffmpeg_path: str) -> bool:
    """Проверить поддержку NVIDIA NVENC."""
    try:
        result = subprocess.run(
            [ffmpeg_path, '-encoders'],
            capture_output=True, text=True, timeout=10
        )
        return 'h264_nvenc' in result.stdout
    except Exception:
        return False


def get_background_color(image: np.ndarray) -> np.ndarray:
    """Определить цвет фона по угловым пикселям (как в десктопной версии)."""
    h, w = image.shape[:2]
    patch = 5
    corners = []

    for y_start, y_end in [(0, patch), (h - patch, h)]:
        for x_start, x_end in [(0, patch), (w - patch, w)]:
            patch_pixels = image[y_start:y_end, x_start:x_end]
            corners.append(patch_pixels.reshape(-1, 3))

    all_corners = np.vstack(corners)
    return np.median(all_corners, axis=0).astype(np.uint8)


def remove_background(image: np.ndarray, tolerance: int = 30) -> np.ndarray:
    """Удалить фон на основе угловых пикселей (chroma key)."""
    if image.shape[2] == 4:
        rgb = image[:, :, :3]
    else:
        rgb = image

    bg_color = get_background_color(rgb)

    # Расстояние до фонового цвета
    diff = np.sqrt(np.sum((rgb.astype(float) - bg_color.astype(float)) ** 2, axis=2))

    # Создать маску альфа-канала
    alpha = np.clip((diff - tolerance * 0.5) / (tolerance * 0.5 + 1e-6), 0, 1)
    alpha = (alpha * 255).astype(np.uint8)

    # RGBA
    if image.shape[2] == 4:
        result = image.copy()
        result[:, :, 3] = np.minimum(image[:, :, 3], alpha)
    else:
        result = np.dstack([rgb, alpha])

    return result


def create_text_image(overlay: dict) -> np.ndarray:
    """Создать изображение текстового CTA элемента."""
    text = overlay.get('text_content', 'CTA')
    font_size = overlay.get('font_size', 48)
    font_color = overlay.get('font_color', '#FFFFFF')
    font_family = overlay.get('font_family', 'Arial')
    bold = overlay.get('text_bold', False)
    italic = overlay.get('text_italic', False)
    bg_color = overlay.get('text_bg_color', None)
    outline = overlay.get('text_outline', False)
    outline_color = overlay.get('text_outline_color', '#000000')

    # Попытка загрузить шрифт
    font = None
    font_dirs = ['/usr/share/fonts', '/usr/local/share/fonts', '/ssd/www/clipartweb/storage/fonts']

    for font_dir in font_dirs:
        if os.path.exists(font_dir):
            for root, dirs, files in os.walk(font_dir):
                for f in files:
                    if font_family.lower() in f.lower() and f.endswith(('.ttf', '.otf')):
                        try:
                            font = ImageFont.truetype(os.path.join(root, f), font_size)
                            break
                        except Exception:
                            continue
                if font:
                    break
        if font:
            break

    if not font:
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", font_size)
        except Exception:
            font = ImageFont.load_default()

    # Измерить текст
    dummy_img = Image.new('RGBA', (1, 1))
    dummy_draw = ImageDraw.Draw(dummy_img)
    bbox = dummy_draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    padding = max(10, font_size // 4)
    outline_width = max(2, font_size // 12) if outline else 0

    img_width = text_width + padding * 2 + outline_width * 2
    img_height = text_height + padding * 2 + outline_width * 2

    # Создать изображение
    if bg_color:
        bg_rgba = hex_to_rgba(bg_color)
        img = Image.new('RGBA', (img_width, img_height), bg_rgba)
    else:
        img = Image.new('RGBA', (img_width, img_height), (0, 0, 0, 0))

    draw = ImageDraw.Draw(img)
    text_x = padding + outline_width
    text_y = padding + outline_width - bbox[1]

    # Outline
    if outline:
        oc = hex_to_rgb(outline_color)
        for dx in range(-outline_width, outline_width + 1):
            for dy in range(-outline_width, outline_width + 1):
                if dx * dx + dy * dy <= outline_width * outline_width:
                    draw.text((text_x + dx, text_y + dy), text, font=font, fill=(*oc, 255))

    # Текст
    tc = hex_to_rgb(font_color)
    draw.text((text_x, text_y), text, font=font, fill=(*tc, 255))

    return np.array(img)


def hex_to_rgb(hex_color: str) -> tuple:
    """HEX -> RGB."""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def hex_to_rgba(hex_color: str) -> tuple:
    """HEX -> RGBA (поддержка 6 и 8 символов)."""
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 8:
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4, 6))
    return (*hex_to_rgb(hex_color), 255)


class GifAnimator:
    """Кэширование и анимация GIF-фреймов (как в десктопной версии)."""

    def __init__(self, file_path: str, remove_bg: bool = False, bg_tolerance: int = 30):
        self.frames = []
        self.durations = []
        self.total_duration = 0

        img = Image.open(file_path)
        try:
            while True:
                frame = img.convert('RGBA')
                frame_array = np.array(frame)

                if remove_bg:
                    frame_array = remove_background(frame_array, bg_tolerance)

                self.frames.append(frame_array)
                duration = img.info.get('duration', 100) / 1000.0
                self.durations.append(duration)
                self.total_duration += duration
                img.seek(img.tell() + 1)
        except EOFError:
            pass

        if not self.frames:
            raise ValueError(f"Не удалось загрузить кадры из {file_path}")

    def get_frame(self, t: float) -> np.ndarray:
        """Получить кадр GIF для времени t (с зацикливанием)."""
        if self.total_duration <= 0:
            return self.frames[0]

        loop_t = t % self.total_duration
        elapsed = 0
        for i, dur in enumerate(self.durations):
            elapsed += dur
            if loop_t < elapsed:
                return self.frames[i]

        return self.frames[-1]


def create_overlay_clip(overlay: dict, video_duration: float, video_width: int, video_height: int):
    """Создать MoviePy клип для одного оверлея."""

    overlay_type = overlay['type']
    start_time = overlay.get('start_time', 0)
    duration = overlay.get('duration', 5)
    until_end = overlay.get('until_end', False)
    x_percent = overlay.get('x_percent', 50)
    y_percent = overlay.get('y_percent', 50)
    scale = overlay.get('scale', 100) / 100.0
    opacity = overlay.get('opacity', 100) / 100.0
    fade_in = overlay.get('fade_in', 0)
    fade_out = overlay.get('fade_out', 0)
    remove_bg = overlay.get('remove_bg', False)
    bg_tolerance = overlay.get('bg_tolerance', 30)

    if until_end:
        duration = video_duration - start_time

    actual_duration = min(duration, video_duration - start_time)
    if actual_duration <= 0:
        return None

    clip = None

    if overlay_type == 'text':
        text_image = create_text_image(overlay)
        clip = ImageClip(text_image, transparent=True).with_duration(actual_duration)

    elif overlay_type == 'gif':
        file_path = overlay.get('file_path')
        if not file_path or not os.path.exists(file_path):
            print(f"[WARN] Файл не найден: {file_path}", file=sys.stderr)
            return None

        animator = GifAnimator(file_path, remove_bg, bg_tolerance)

        def make_frame(t):
            return animator.get_frame(t)[:, :, :3]

        def make_mask_frame(t):
            return animator.get_frame(t)[:, :, 3].astype(float) / 255.0

        h, w = animator.frames[0].shape[:2]
        clip = VideoClip(make_frame, duration=actual_duration).with_fps(24)
        clip = clip.with_mask(VideoClip(make_mask_frame, duration=actual_duration, is_mask=True).with_fps(24))

    elif overlay_type == 'image':
        file_path = overlay.get('file_path')
        if not file_path or not os.path.exists(file_path):
            print(f"[WARN] Файл не найден: {file_path}", file=sys.stderr)
            return None

        img = Image.open(file_path).convert('RGBA')
        img_array = np.array(img)

        if remove_bg:
            img_array = remove_background(img_array, bg_tolerance)

        clip = ImageClip(img_array, transparent=True).with_duration(actual_duration)

    if clip is None:
        return None

    # Масштабирование
    if scale != 1.0:
        clip = clip.resized(scale)

    # Позиция (процент → пиксели)
    clip_w, clip_h = clip.size
    x_pos = int((x_percent / 100) * video_width - clip_w / 2)
    y_pos = int((y_percent / 100) * video_height - clip_h / 2)
    clip = clip.with_position((x_pos, y_pos))

    # Непрозрачность
    if opacity < 1.0:
        clip = clip.with_effects([vfx.MultiplyColor(opacity)])

    # Fade in/out
    if fade_in > 0:
        clip = clip.with_effects([vfx.CrossFadeIn(fade_in)])
    if fade_out > 0:
        clip = clip.with_effects([vfx.CrossFadeOut(fade_out)])

    # Начало
    clip = clip.with_start(start_time)

    return clip


def add_watermark(video_clip, video_width: int, video_height: int):
    """Добавить водяной знак ClipArtWeb для бесплатного плана."""
    watermark_text = "ClipArtWeb.1tlt.ru"

    img = Image.new('RGBA', (400, 50), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
    except Exception:
        font = ImageFont.load_default()

    draw.text((10, 10), watermark_text, font=font, fill=(255, 255, 255, 128))
    watermark_array = np.array(img)

    watermark_clip = ImageClip(watermark_array, transparent=True)
    watermark_clip = watermark_clip.with_duration(video_clip.duration)
    watermark_clip = watermark_clip.with_position((video_width - 420, video_height - 60))

    return watermark_clip


def render_project(project_data: dict, output_path: str, progress_file: str, ffmpeg_path: str):
    """Основная функция рендеринга."""

    video_path = project_data['video_path']
    overlays_data = project_data.get('overlays', [])
    watermark = project_data.get('watermark', False)
    max_resolution = project_data.get('max_resolution', 1080)

    update_progress(progress_file, 5, "Загрузка видео...")

    # Загрузка видео
    video = VideoFileClip(video_path)
    video_duration = video.duration
    video_width, video_height = video.size
    video_fps = video.fps

    # Ограничение разрешения
    if video_height > max_resolution:
        ratio = max_resolution / video_height
        video = video.resized(ratio)
        video_width, video_height = video.size

    update_progress(progress_file, 10, "Создание оверлеев...")

    # Создать клипы оверлеев
    overlay_clips = []
    total_overlays = len(overlays_data)

    for i, overlay in enumerate(overlays_data):
        progress = 10 + int(40 * (i + 1) / max(total_overlays, 1))
        update_progress(progress_file, progress, f"Оверлей {i+1}/{total_overlays}: {overlay.get('name', '?')}")

        clip = create_overlay_clip(overlay, video_duration, video_width, video_height)
        if clip is not None:
            overlay_clips.append(clip)

    # Водяной знак
    if watermark:
        wm_clip = add_watermark(video, video_width, video_height)
        overlay_clips.append(wm_clip)

    update_progress(progress_file, 55, "Композиция...")

    # Композиция
    all_clips = [video] + overlay_clips
    final = CompositeVideoClip(all_clips, size=(video_width, video_height))

    update_progress(progress_file, 60, "Рендеринг видео...")

    # Определить кодек
    use_nvenc = check_nvenc(ffmpeg_path)

    if use_nvenc:
        codec = 'h264_nvenc'
        ffmpeg_params = ['-preset', 'p4', '-rc', 'vbr', '-cq', '23', '-b:v', '0', '-gpu', '0']
    else:
        codec = 'libx264'
        ffmpeg_params = ['-preset', 'medium', '-crf', '23']

    # Запись
    class ProgressLogger:
        def __init__(self, total_frames, progress_file):
            self.total_frames = total_frames
            self.progress_file = progress_file

        def __call__(self, t):
            # t — текущее время рендера
            percent = 60 + int(35 * min(t / video_duration, 1.0))
            update_progress(self.progress_file, percent, f"Кодирование: {t:.1f}s / {video_duration:.1f}s")

    final.write_videofile(
        output_path,
        codec=codec,
        audio_codec='aac',
        fps=video_fps,
        ffmpeg_params=ffmpeg_params,
        logger=None,  # тихий режим
    )

    update_progress(progress_file, 98, "Финализация...")

    # Закрыть клипы
    final.close()
    video.close()
    for clip in overlay_clips:
        try:
            clip.close()
        except Exception:
            pass

    update_progress(progress_file, 100, "Готово!")
    print(f"Рендеринг завершён: {output_path}")


def main():
    parser = argparse.ArgumentParser(description='ClipArtWeb Video Renderer')
    parser.add_argument('--project', required=True, help='Path to project.json')
    parser.add_argument('--output', required=True, help='Output video path')
    parser.add_argument('--progress', required=True, help='Progress JSON file path')
    parser.add_argument('--ffmpeg', default='ffmpeg', help='FFmpeg binary path')

    args = parser.parse_args()

    if not os.path.exists(args.project):
        print(f"Ошибка: файл проекта не найден: {args.project}", file=sys.stderr)
        sys.exit(1)

    with open(args.project, 'r', encoding='utf-8') as f:
        project_data = json.load(f)

    render_project(project_data, args.output, args.progress, args.ffmpeg)


if __name__ == '__main__':
    main()
