// --- Пользователь ---
export interface User {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  plan: 'free' | 'pro';
  plan_expires_at: string | null;
  is_pro: boolean;
  plan_limits: PlanLimits;
  storage_used: number;
  storage_limit: number;
  remaining_storage: number;
  created_at: string;
}

export interface PlanLimits {
  max_elements: number;
  max_duration: number;
  max_resolution: number;
  watermark: boolean;
  priority: 'low' | 'high';
}

// --- Проект ---
export interface Project {
  id: number;
  uuid: string;
  name: string;
  video_path: string | null;
  video_original_name: string | null;
  video_size: number;
  video_duration: number | null;
  video_width: number | null;
  video_height: number | null;
  video_fps: number | null;
  thumbnail_path: string | null;
  status: 'draft' | 'rendering' | 'completed' | 'failed';
  render_progress: number;
  render_error: string | null;
  rendered_at: string | null;
  overlays: Overlay[];
  overlays_count?: number;
  latest_render_job?: RenderJob;
  created_at: string;
  updated_at: string;
}

// --- Оверлей ---
export interface Overlay {
  id: number;
  uuid: string;
  project_id: number;
  sort_order: number;
  type: 'image' | 'gif' | 'text';
  name: string;
  file_path: string | null;
  original_name: string | null;
  start_time: number;
  duration: number;
  until_end: boolean;
  x_percent: number;
  y_percent: number;
  scale: number;
  opacity: number;
  fade_in: number;
  fade_out: number;
  remove_bg: boolean;
  bg_tolerance: number;
  text_content: string | null;
  font_family: string;
  font_size: number;
  font_color: string;
  text_bold: boolean;
  text_italic: boolean;
  text_bg_color: string | null;
  text_outline: boolean;
  text_outline_color: string;
  created_at: string;
  updated_at: string;
}

export type OverlayCreate = Partial<Overlay> & {
  type: 'image' | 'gif' | 'text';
  name: string;
};

// --- Ассет ---
export interface Asset {
  id: number;
  uuid: string;
  user_id: number | null;
  name: string;
  file_path: string;
  thumbnail_path: string | null;
  type: 'image' | 'gif' | 'animation';
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  is_system: boolean;
  category: string | null;
}

// --- Рендеринг ---
export interface RenderJob {
  id: number;
  uuid: string;
  project_id: number;
  user_id: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'high';
  progress: number;
  error_message: string | null;
  output_path: string | null;
  output_size: number | null;
  render_time_seconds: number | null;
  settings: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
}

// --- Подписка ---
export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: string | null;
  features: string[];
  limits: PlanLimits;
}

// --- Позиция пресет ---
export type PositionPreset =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export const POSITION_PRESETS: Record<PositionPreset, { x: number; y: number }> = {
  'top-left': { x: 15, y: 15 },
  'top-center': { x: 50, y: 15 },
  'top-right': { x: 85, y: 15 },
  'middle-left': { x: 15, y: 50 },
  'center': { x: 50, y: 50 },
  'middle-right': { x: 85, y: 50 },
  'bottom-left': { x: 15, y: 85 },
  'bottom-center': { x: 50, y: 85 },
  'bottom-right': { x: 85, y: 85 },
};
