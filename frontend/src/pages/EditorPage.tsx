import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEditorStore } from '@/store/editorStore';
import { useAuthStore } from '@/store/authStore';
import { projectsApi, overlaysApi, assetsApi } from '@/lib/api';
import { formatDuration, formatBytes } from '@/lib/utils';
import type { Overlay, Asset } from '@/types';
import { POSITION_PRESETS } from '@/types';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';
import {
  Video, ArrowLeft, Play, Pause, SkipBack, SkipForward,
  Upload, Type, Image, Layers, Trash2, Move, Eye, EyeOff,
  Undo2, Redo2, Download, Loader2, CheckCircle, XCircle,
  ChevronUp, ChevronDown, Settings, Sparkles, Plus, X,
  AlignHorizontalJustifyCenter
} from 'lucide-react';

export default function EditorPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const {
    project, isLoading, loadProject,
    currentTime, setCurrentTime, isPlaying, setIsPlaying, videoDuration, setVideoDuration,
    selectedOverlayId, selectOverlay,
    addOverlay, updateOverlay, deleteOverlay, addFromAsset,
    startRender, pollRenderStatus,
    undo, redo, undoStack, redoStack,
  } = useEditorStore();
  const { user } = useAuthStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>();
  const pollIntervalRef = useRef<ReturnType<typeof setInterval>>();

  // Библиотека
  const [assets, setAssets] = useState<Asset[]>([]);
  const [activeTab, setActiveTab] = useState<'library' | 'upload'>('library');

  // Загрузка видео
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  useEffect(() => {
    if (uuid) {
      loadProject(uuid).catch(() => {
        toast.error('Проект не найден');
        navigate('/dashboard');
      });
    }
    loadAssets();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [uuid]);

  // Polling рендеринга
  useEffect(() => {
    if (project?.status === 'rendering') {
      pollIntervalRef.current = setInterval(() => {
        pollRenderStatus();
      }, 2000);
    } else {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [project?.status]);

  const loadAssets = async () => {
    try {
      const { data } = await assetsApi.list();
      setAssets(data.assets || []);
    } catch {
      // ignore
    }
  };

  // --- Video handlers ---
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      drawOverlays();
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const seek = (delta: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoDuration, videoRef.current.currentTime + delta));
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    setCurrentTime(time);
  };

  // --- Canvas overlay preview ---
  const drawOverlays = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !project) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || 960;
    canvas.height = video.videoHeight || 540;

    // Рисуем текстовые оверлеи поверх
    const time = video.currentTime;
    project.overlays.forEach((overlay) => {
      const endTime = overlay.until_end ? Infinity : overlay.start_time + overlay.duration;
      if (time < overlay.start_time || time >= endTime) return;

      // Рассчитать прозрачность
      let opacity = overlay.opacity / 100;
      const elapsed = time - overlay.start_time;
      const remaining = endTime - time;
      if (overlay.fade_in > 0 && elapsed < overlay.fade_in) {
        opacity *= elapsed / overlay.fade_in;
      }
      if (overlay.fade_out > 0 && remaining < overlay.fade_out) {
        opacity *= remaining / overlay.fade_out;
      }

      ctx.globalAlpha = opacity;

      if (overlay.type === 'text' && overlay.text_content) {
        const x = (overlay.x_percent / 100) * canvas.width;
        const y = (overlay.y_percent / 100) * canvas.height;
        const fontSize = overlay.font_size * (canvas.width / 960);

        let fontStyle = '';
        if (overlay.text_bold) fontStyle += 'bold ';
        if (overlay.text_italic) fontStyle += 'italic ';
        ctx.font = `${fontStyle}${fontSize}px ${overlay.font_family}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Background
        if (overlay.text_bg_color) {
          const metrics = ctx.measureText(overlay.text_content);
          const padding = fontSize * 0.3;
          ctx.fillStyle = overlay.text_bg_color;
          ctx.fillRect(
            x - metrics.width / 2 - padding,
            y - fontSize / 2 - padding,
            metrics.width + padding * 2,
            fontSize + padding * 2
          );
        }

        // Outline
        if (overlay.text_outline) {
          ctx.strokeStyle = overlay.text_outline_color;
          ctx.lineWidth = Math.max(2, fontSize / 12);
          ctx.strokeText(overlay.text_content, x, y);
        }

        // Text
        ctx.fillStyle = overlay.font_color;
        ctx.fillText(overlay.text_content, x, y);
      } else if (overlay.type === 'image' || overlay.type === 'gif') {
        // Для image/gif рисуем placeholder индикатор
        const x = (overlay.x_percent / 100) * canvas.width;
        const y = (overlay.y_percent / 100) * canvas.height;
        const size = 40 * (overlay.scale / 100);

        ctx.fillStyle = selectedOverlayId === overlay.uuid ? '#89b4fa' : '#45475a';
        ctx.strokeStyle = selectedOverlayId === overlay.uuid ? '#89b4fa' : '#6c7086';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.roundRect(x - size / 2, y - size / 2, size, size, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#cdd6f4';
        ctx.font = `${size * 0.3}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(overlay.type === 'gif' ? 'GIF' : 'IMG', x, y);
      }

      ctx.globalAlpha = 1;
    });
  }, [project, selectedOverlayId]);

  // --- Video upload ---
  const onDropVideo = useCallback(async (acceptedFiles: File[]) => {
    if (!uuid || !acceptedFiles.length) return;
    const file = acceptedFiles[0];
    setUploadProgress(0);

    try {
      await projectsApi.uploadVideo(uuid, file, (p) => setUploadProgress(p));
      await loadProject(uuid);
      toast.success('Видео загружено!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка загрузки видео');
    } finally {
      setUploadProgress(null);
    }
  }, [uuid]);

  const { getRootProps: getVideoDropProps, getInputProps: getVideoInputProps, isDragActive } = useDropzone({
    onDrop: onDropVideo,
    accept: {
      'video/mp4': ['.mp4'],
      'video/quicktime': ['.mov'],
      'video/x-matroska': ['.mkv'],
      'video/webm': ['.webm'],
      'video/avi': ['.avi'],
    },
    maxFiles: 1,
    noClick: !!project?.video_path,
  });

  // --- Add text overlay ---
  const addTextOverlay = async () => {
    if (!project) return;
    const formData = new FormData();
    formData.append('type', 'text');
    formData.append('name', 'Текст CTA');
    formData.append('text_content', 'Подписывайтесь!');
    formData.append('font_size', '48');
    formData.append('font_color', '#FFFFFF');
    formData.append('text_outline', 'true');
    formData.append('text_outline_color', '#000000');
    formData.append('x_percent', '50');
    formData.append('y_percent', '85');
    formData.append('start_time', String(currentTime));
    formData.append('duration', '5');

    try {
      await addOverlay(formData);
      toast.success('Текст добавлен');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка добавления');
    }
  };

  // --- Add overlay from file ---
  const onDropOverlay = useCallback(async (acceptedFiles: File[]) => {
    if (!project) return;
    for (const file of acceptedFiles) {
      const formData = new FormData();
      const ext = file.name.split('.').pop()?.toLowerCase();
      const type = ext === 'gif' ? 'gif' : 'image';
      formData.append('type', type);
      formData.append('name', file.name);
      formData.append('file', file);
      formData.append('start_time', String(currentTime));
      formData.append('duration', '5');
      formData.append('x_percent', '50');
      formData.append('y_percent', '50');

      try {
        await addOverlay(formData);
        toast.success(`${file.name} добавлен`);
      } catch (error: any) {
        toast.error(error.response?.data?.message || `Ошибка: ${file.name}`);
      }
    }
  }, [project, currentTime]);

  const { getRootProps: getOverlayDropProps, getInputProps: getOverlayInputProps } = useDropzone({
    onDrop: onDropOverlay,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
    },
  });

  // --- Render ---
  const handleRender = async () => {
    try {
      await startRender();
      toast.success('Рендеринг запущен!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка запуска рендеринга');
    }
  };

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); seek(-5); }
      if (e.key === 'ArrowRight') { e.preventDefault(); seek(5); }
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === 'Delete' && selectedOverlayId) {
        e.preventDefault();
        deleteOverlay(selectedOverlayId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedOverlayId, isPlaying]);

  // Selected overlay
  const selectedOverlay = project?.overlays.find((o) => o.uuid === selectedOverlayId);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <div className="w-8 h-8 border-4 border-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      {/* Header */}
      <header className="h-12 border-b border-surface-0 bg-mantle flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-overlay-0 hover:text-text transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-semibold truncate max-w-[200px]">{project?.name || 'Проект'}</span>
          {project?.status === 'rendering' && (
            <span className="text-xs bg-yellow/20 text-yellow px-2 py-0.5 rounded-full flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {project.render_progress}%
            </span>
          )}
          {project?.status === 'completed' && (
            <span className="text-xs bg-green/20 text-green px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Готово
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={undo} disabled={undoStack.length === 0} className="p-1.5 hover:bg-surface-0 rounded-lg text-overlay-0 hover:text-text disabled:opacity-30" title="Отменить (Ctrl+Z)">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={redo} disabled={redoStack.length === 0} className="p-1.5 hover:bg-surface-0 rounded-lg text-overlay-0 hover:text-text disabled:opacity-30" title="Повторить (Ctrl+Y)">
            <Redo2 className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-surface-0 mx-1" />

          {project?.status === 'completed' && project.render_path && (
            <a
              href={`/api/projects/${project.uuid}/download`}
              className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Скачать
            </a>
          )}

          <button
            onClick={handleRender}
            disabled={!project?.video_path || project?.status === 'rendering'}
            className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5"
          >
            {project?.status === 'rendering' ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Рендеринг...</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" /> Рендерить</>
            )}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel — Library */}
        <div className="w-60 border-r border-surface-0 bg-mantle flex flex-col shrink-0">
          <div className="p-3 border-b border-surface-0">
            <div className="flex gap-1 bg-crust rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab('library')}
                className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${activeTab === 'library' ? 'bg-surface-0 text-text' : 'text-overlay-0'}`}
              >
                Библиотека
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${activeTab === 'upload' ? 'bg-surface-0 text-text' : 'text-overlay-0'}`}
              >
                Загрузить
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {/* Текст CTA */}
            <button
              onClick={addTextOverlay}
              className="w-full flex items-center gap-2 px-3 py-2 bg-blue/10 text-blue hover:bg-blue/20 rounded-lg transition-colors text-sm"
            >
              <Type className="w-4 h-4" /> Текст (CTA)
            </button>

            {activeTab === 'library' ? (
              <>
                {assets.length === 0 ? (
                  <p className="text-xs text-overlay-0 text-center py-4">Нет ассетов</p>
                ) : (
                  assets.map((asset) => (
                    <button
                      key={asset.uuid}
                      onClick={() => addFromAsset(asset.uuid).then(() => toast.success('Добавлен')).catch(() => toast.error('Ошибка'))}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-0 rounded-lg transition-colors text-sm text-left"
                    >
                      <div className="w-10 h-10 bg-crust rounded shrink-0 flex items-center justify-center overflow-hidden">
                        <img
                          src={assetsApi.getThumbnailUrl(asset.uuid)}
                          alt={asset.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{asset.name}</p>
                        <p className="text-[10px] text-overlay-0">{asset.type}</p>
                      </div>
                    </button>
                  ))
                )}
              </>
            ) : (
              <div
                {...getOverlayDropProps()}
                className="border-2 border-dashed border-surface-1 rounded-lg p-6 text-center hover:border-blue/50 transition-colors cursor-pointer"
              >
                <input {...getOverlayInputProps()} />
                <Upload className="w-8 h-8 text-overlay-0 mx-auto mb-2" />
                <p className="text-xs text-overlay-0">Перетащите файлы<br/>PNG, JPG, GIF</p>
              </div>
            )}
          </div>
        </div>

        {/* Center — Video preview */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 relative flex items-center justify-center bg-crust p-4">
            {project?.video_path ? (
              <div className="relative max-w-full max-h-full">
                <video
                  ref={videoRef}
                  src={`/api/projects/${project.uuid}/video`}
                  className="max-w-full max-h-[calc(100vh-240px)] rounded-lg"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                  crossOrigin="use-credentials"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none rounded-lg"
                  style={{ objectFit: 'contain' }}
                />
              </div>
            ) : (
              <div
                {...getVideoDropProps()}
                className={`w-full max-w-lg aspect-video border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-colors cursor-pointer ${
                  isDragActive ? 'border-blue bg-blue/5' : 'border-surface-1 hover:border-blue/50'
                }`}
              >
                <input {...getVideoInputProps()} />
                {uploadProgress !== null ? (
                  <div className="text-center">
                    <Loader2 className="w-10 h-10 text-blue animate-spin mx-auto mb-3" />
                    <p className="text-sm text-subtext-0">Загрузка... {uploadProgress}%</p>
                    <div className="w-48 h-1.5 bg-surface-0 rounded-full mt-2">
                      <div className="h-full bg-blue rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-surface-2 mb-4" />
                    <p className="text-lg font-medium mb-1">Загрузите видео</p>
                    <p className="text-sm text-overlay-0">Перетащите файл или нажмите для выбора</p>
                    <p className="text-xs text-surface-2 mt-2">MP4, MOV, MKV, WebM — до {user?.plan_limits?.max_duration || 60} сек</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Playback controls */}
          {project?.video_path && (
            <div className="h-14 border-t border-surface-0 bg-mantle flex items-center gap-3 px-4 shrink-0">
              <button onClick={() => seek(-5)} className="p-1 text-overlay-0 hover:text-text">
                <SkipBack className="w-4 h-4" />
              </button>
              <button onClick={togglePlay} className="p-2 bg-blue hover:bg-blue/90 rounded-full text-base">
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <button onClick={() => seek(5)} className="p-1 text-overlay-0 hover:text-text">
                <SkipForward className="w-4 h-4" />
              </button>
              <span className="text-xs text-overlay-0 w-20 text-center font-mono">
                {formatDuration(currentTime)} / {formatDuration(videoDuration)}
              </span>
              <input
                type="range"
                min={0}
                max={videoDuration || 0}
                step={0.01}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 h-1.5 accent-blue"
              />
            </div>
          )}
        </div>

        {/* Right panel — Properties */}
        <div className="w-72 border-l border-surface-0 bg-mantle flex flex-col shrink-0">
          <div className="p-3 border-b border-surface-0">
            <h3 className="font-semibold text-sm">
              {selectedOverlay ? 'Свойства элемента' : 'Свойства'}
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {selectedOverlay ? (
              <OverlayProperties
                overlay={selectedOverlay}
                projectUuid={project?.uuid || ''}
                onUpdate={(data) => updateOverlay(selectedOverlay.uuid, data)}
                onDelete={() => deleteOverlay(selectedOverlay.uuid)}
                videoDuration={videoDuration}
              />
            ) : (
              <div className="text-center py-10 text-overlay-0 text-sm">
                <Layers className="w-10 h-10 mx-auto mb-3 text-surface-2" />
                <p>Выберите элемент<br/>для редактирования</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom panel — Elements table */}
      <div className="h-48 border-t border-surface-0 bg-mantle shrink-0 overflow-hidden flex flex-col">
        <div className="px-4 py-2 border-b border-surface-0 flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue" />
            Элементы ({project?.overlays.length || 0})
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-overlay-0 border-b border-surface-0">
                <th className="px-4 py-2 w-8">#</th>
                <th className="px-4 py-2">Элемент</th>
                <th className="px-4 py-2 w-24">Тип</th>
                <th className="px-4 py-2 w-24">Начало</th>
                <th className="px-4 py-2 w-28">Длительность</th>
                <th className="px-4 py-2 w-24">Позиция</th>
                <th className="px-4 py-2 w-24">Действия</th>
              </tr>
            </thead>
            <tbody>
              {project?.overlays.map((overlay, index) => {
                const isVisible = currentTime >= overlay.start_time &&
                  currentTime < (overlay.until_end ? Infinity : overlay.start_time + overlay.duration);
                const isSelected = selectedOverlayId === overlay.uuid;

                return (
                  <tr
                    key={overlay.uuid}
                    onClick={() => selectOverlay(overlay.uuid)}
                    className={`border-b border-surface-0/50 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue/10' : isVisible ? 'bg-green/5' : 'hover:bg-surface-0/50'
                    }`}
                  >
                    <td className="px-4 py-1.5 text-overlay-0">{index + 1}</td>
                    <td className="px-4 py-1.5 font-medium truncate max-w-[200px]">
                      {overlay.type === 'text' ? overlay.text_content || overlay.name : overlay.name}
                    </td>
                    <td className="px-4 py-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        overlay.type === 'text' ? 'bg-mauve/20 text-mauve' :
                        overlay.type === 'gif' ? 'bg-peach/20 text-peach' :
                        'bg-sapphire/20 text-sapphire'
                      }`}>
                        {overlay.type === 'text' ? 'Текст' : overlay.type === 'gif' ? 'GIF' : 'Изображение'}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-overlay-0 font-mono text-xs">
                      {formatDuration(overlay.start_time)}
                    </td>
                    <td className="px-4 py-1.5 text-overlay-0 font-mono text-xs">
                      {overlay.until_end ? 'До конца' : formatDuration(overlay.duration)}
                    </td>
                    <td className="px-4 py-1.5 text-overlay-0 text-xs">
                      {Math.round(overlay.x_percent)}%, {Math.round(overlay.y_percent)}%
                    </td>
                    <td className="px-4 py-1.5">
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => deleteOverlay(overlay.uuid)}
                          className="p-1 hover:bg-red/10 rounded text-overlay-0 hover:text-red transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(!project?.overlays || project.overlays.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-overlay-0 text-sm">
                    Нет элементов. Добавьте CTA из библиотеки слева.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- Компонент свойств оверлея ---
function OverlayProperties({
  overlay,
  projectUuid,
  onUpdate,
  onDelete,
  videoDuration,
}: {
  overlay: Overlay;
  projectUuid: string;
  onUpdate: (data: Partial<Overlay>) => void;
  onDelete: () => void;
  videoDuration: number;
}) {
  const [localValues, setLocalValues] = useState<Partial<Overlay>>({});

  useEffect(() => {
    setLocalValues({});
  }, [overlay.uuid]);

  const getValue = <K extends keyof Overlay>(key: K): Overlay[K] => {
    return (localValues[key] !== undefined ? localValues[key] : overlay[key]) as Overlay[K];
  };

  const handleChange = (key: keyof Overlay, value: unknown) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
  };

  const commitChanges = () => {
    if (Object.keys(localValues).length > 0) {
      onUpdate(localValues);
      setLocalValues({});
    }
  };

  const applyPosition = (preset: string) => {
    const pos = POSITION_PRESETS[preset as keyof typeof POSITION_PRESETS];
    if (pos) {
      onUpdate({ x_percent: pos.x, y_percent: pos.y });
    }
  };

  return (
    <div className="space-y-4">
      {/* Имя */}
      <div>
        <label className="text-xs text-overlay-0 block mb-1">Название</label>
        <input
          type="text"
          value={getValue('name')}
          onChange={(e) => handleChange('name', e.target.value)}
          onBlur={commitChanges}
          className="input-field text-sm py-1.5"
        />
      </div>

      {/* Тайминг */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-overlay-0 block mb-1">Начало (с)</label>
          <input
            type="number"
            value={getValue('start_time')}
            onChange={(e) => handleChange('start_time', parseFloat(e.target.value) || 0)}
            onBlur={commitChanges}
            className="input-field text-sm py-1.5"
            min={0}
            max={videoDuration}
            step={0.1}
          />
        </div>
        <div>
          <label className="text-xs text-overlay-0 block mb-1">Длительность (с)</label>
          <input
            type="number"
            value={getValue('duration')}
            onChange={(e) => handleChange('duration', parseFloat(e.target.value) || 1)}
            onBlur={commitChanges}
            className="input-field text-sm py-1.5"
            min={0.1}
            step={0.1}
            disabled={getValue('until_end')}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={getValue('until_end')}
          onChange={(e) => { onUpdate({ until_end: e.target.checked }); }}
          className="accent-blue"
        />
        До конца видео
      </label>

      {/* Позиция */}
      <div>
        <label className="text-xs text-overlay-0 block mb-1">Позиция</label>
        <div className="grid grid-cols-3 gap-1 mb-2">
          {['top-left', 'top-center', 'top-right', 'middle-left', 'center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'].map((pos) => (
            <button
              key={pos}
              onClick={() => applyPosition(pos)}
              className="aspect-square bg-crust hover:bg-surface-0 border border-surface-0 rounded text-[8px] text-overlay-0 hover:text-text transition-colors"
              title={pos}
            >
              ●
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-overlay-0 block mb-0.5">X %</label>
            <input
              type="number"
              value={getValue('x_percent')}
              onChange={(e) => handleChange('x_percent', parseFloat(e.target.value) || 0)}
              onBlur={commitChanges}
              className="input-field text-sm py-1"
              min={0} max={100} step={1}
            />
          </div>
          <div>
            <label className="text-[10px] text-overlay-0 block mb-0.5">Y %</label>
            <input
              type="number"
              value={getValue('y_percent')}
              onChange={(e) => handleChange('y_percent', parseFloat(e.target.value) || 0)}
              onBlur={commitChanges}
              className="input-field text-sm py-1"
              min={0} max={100} step={1}
            />
          </div>
        </div>
      </div>

      {/* Масштаб / Прозрачность */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-overlay-0 block mb-1">Масштаб %</label>
          <input
            type="number"
            value={getValue('scale')}
            onChange={(e) => handleChange('scale', parseFloat(e.target.value) || 100)}
            onBlur={commitChanges}
            className="input-field text-sm py-1.5"
            min={1} max={500}
          />
        </div>
        <div>
          <label className="text-xs text-overlay-0 block mb-1">Непрозрачность %</label>
          <input
            type="number"
            value={getValue('opacity')}
            onChange={(e) => handleChange('opacity', parseFloat(e.target.value) || 100)}
            onBlur={commitChanges}
            className="input-field text-sm py-1.5"
            min={0} max={100}
          />
        </div>
      </div>

      {/* Fade */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-overlay-0 block mb-1">Fade in (с)</label>
          <input
            type="number"
            value={getValue('fade_in')}
            onChange={(e) => handleChange('fade_in', parseFloat(e.target.value) || 0)}
            onBlur={commitChanges}
            className="input-field text-sm py-1.5"
            min={0} step={0.1}
          />
        </div>
        <div>
          <label className="text-xs text-overlay-0 block mb-1">Fade out (с)</label>
          <input
            type="number"
            value={getValue('fade_out')}
            onChange={(e) => handleChange('fade_out', parseFloat(e.target.value) || 0)}
            onBlur={commitChanges}
            className="input-field text-sm py-1.5"
            min={0} step={0.1}
          />
        </div>
      </div>

      {/* Удаление фона (только для image/gif) */}
      {overlay.type !== 'text' && (
        <div>
          <label className="flex items-center gap-2 text-sm mb-2">
            <input
              type="checkbox"
              checked={getValue('remove_bg')}
              onChange={(e) => onUpdate({ remove_bg: e.target.checked })}
              className="accent-blue"
            />
            Удалить фон
          </label>
          {getValue('remove_bg') && (
            <div>
              <label className="text-xs text-overlay-0 block mb-1">Допуск: {getValue('bg_tolerance')}</label>
              <input
                type="range"
                value={getValue('bg_tolerance')}
                onChange={(e) => handleChange('bg_tolerance', parseInt(e.target.value))}
                onMouseUp={commitChanges}
                className="w-full accent-blue"
                min={0} max={255}
              />
            </div>
          )}
        </div>
      )}

      {/* Текстовые свойства */}
      {overlay.type === 'text' && (
        <div className="space-y-3 border-t border-surface-0 pt-3">
          <h4 className="text-xs font-semibold text-blue">Текстовые свойства</h4>

          <div>
            <label className="text-xs text-overlay-0 block mb-1">Текст</label>
            <textarea
              value={getValue('text_content') || ''}
              onChange={(e) => handleChange('text_content', e.target.value)}
              onBlur={commitChanges}
              className="input-field text-sm py-1.5 resize-none"
              rows={2}
            />
          </div>

          <div>
            <label className="text-xs text-overlay-0 block mb-1">Шрифт</label>
            <input
              type="text"
              value={getValue('font_family')}
              onChange={(e) => handleChange('font_family', e.target.value)}
              onBlur={commitChanges}
              className="input-field text-sm py-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-overlay-0 block mb-1">Размер</label>
              <input
                type="number"
                value={getValue('font_size')}
                onChange={(e) => handleChange('font_size', parseInt(e.target.value) || 48)}
                onBlur={commitChanges}
                className="input-field text-sm py-1.5"
                min={8} max={200}
              />
            </div>
            <div>
              <label className="text-xs text-overlay-0 block mb-1">Цвет</label>
              <input
                type="color"
                value={getValue('font_color')}
                onChange={(e) => { onUpdate({ font_color: e.target.value }); }}
                className="w-full h-9 rounded-lg cursor-pointer bg-crust border border-surface-0"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={getValue('text_bold')}
                onChange={(e) => onUpdate({ text_bold: e.target.checked })}
                className="accent-blue"
              /> <strong>Жирный</strong>
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={getValue('text_italic')}
                onChange={(e) => onUpdate({ text_italic: e.target.checked })}
                className="accent-blue"
              /> <em>Курсив</em>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={getValue('text_outline')}
              onChange={(e) => onUpdate({ text_outline: e.target.checked })}
              className="accent-blue"
            />
            Обводка
          </label>

          {getValue('text_outline') && (
            <div>
              <label className="text-xs text-overlay-0 block mb-1">Цвет обводки</label>
              <input
                type="color"
                value={getValue('text_outline_color')}
                onChange={(e) => onUpdate({ text_outline_color: e.target.value })}
                className="w-full h-8 rounded-lg cursor-pointer bg-crust border border-surface-0"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-overlay-0 block mb-1">Фон текста</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={getValue('text_bg_color') || '#000000'}
                onChange={(e) => onUpdate({ text_bg_color: e.target.value })}
                className="w-10 h-8 rounded cursor-pointer bg-crust border border-surface-0"
              />
              <button
                onClick={() => onUpdate({ text_bg_color: null })}
                className="text-xs text-overlay-0 hover:text-red"
              >
                Убрать фон
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete */}
      <button onClick={onDelete} className="btn-danger w-full flex items-center justify-center gap-2 mt-4">
        <Trash2 className="w-4 h-4" /> Удалить элемент
      </button>
    </div>
  );
}
