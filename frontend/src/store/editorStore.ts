import { create } from 'zustand';
import { projectsApi, overlaysApi } from '@/lib/api';
import type { Project, Overlay, OverlayCreate } from '@/types';

interface EditorState {
  // Проект
  project: Project | null;
  isLoading: boolean;

  // Видео
  currentTime: number;
  isPlaying: boolean;
  videoDuration: number;

  // Выбранный элемент
  selectedOverlayId: string | null;

  // Undo/Redo
  undoStack: Overlay[][];
  redoStack: Overlay[][];

  // Действия
  loadProject: (uuid: string) => Promise<void>;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setVideoDuration: (duration: number) => void;
  selectOverlay: (uuid: string | null) => void;

  // Overlay CRUD
  addOverlay: (data: FormData) => Promise<void>;
  updateOverlay: (overlayUuid: string, data: Partial<Overlay>) => Promise<void>;
  deleteOverlay: (overlayUuid: string) => Promise<void>;
  reorderOverlays: (order: string[]) => Promise<void>;
  addFromAsset: (assetUuid: string) => Promise<void>;

  // Рендеринг
  startRender: () => Promise<void>;
  pollRenderStatus: () => Promise<void>;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  saveUndoState: () => void;

  // Helpers
  getSelectedOverlay: () => Overlay | null;
  getVisibleOverlays: () => Overlay[];
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  isLoading: false,
  currentTime: 0,
  isPlaying: false,
  videoDuration: 0,
  selectedOverlayId: null,
  undoStack: [],
  redoStack: [],

  loadProject: async (uuid) => {
    set({ isLoading: true });
    try {
      const { data } = await projectsApi.get(uuid);
      set({
        project: data.project,
        isLoading: false,
        videoDuration: data.project.video_duration || 0,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  setCurrentTime: (time) => set({ currentTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVideoDuration: (duration) => set({ videoDuration: duration }),
  selectOverlay: (uuid) => set({ selectedOverlayId: uuid }),

  addOverlay: async (data) => {
    const project = get().project;
    if (!project) return;

    get().saveUndoState();
    const { data: res } = await overlaysApi.create(project.uuid, data);

    set({
      project: {
        ...project,
        overlays: [...project.overlays, res.overlay],
      },
      selectedOverlayId: res.overlay.uuid,
    });
  },

  updateOverlay: async (overlayUuid, data) => {
    const project = get().project;
    if (!project) return;

    get().saveUndoState();
    const { data: res } = await overlaysApi.update(project.uuid, overlayUuid, data);

    set({
      project: {
        ...project,
        overlays: project.overlays.map((o) =>
          o.uuid === overlayUuid ? res.overlay : o
        ),
      },
    });
  },

  deleteOverlay: async (overlayUuid) => {
    const project = get().project;
    if (!project) return;

    get().saveUndoState();
    await overlaysApi.delete(project.uuid, overlayUuid);

    set({
      project: {
        ...project,
        overlays: project.overlays.filter((o) => o.uuid !== overlayUuid),
      },
      selectedOverlayId:
        get().selectedOverlayId === overlayUuid ? null : get().selectedOverlayId,
    });
  },

  reorderOverlays: async (order) => {
    const project = get().project;
    if (!project) return;

    const { data: res } = await overlaysApi.reorder(project.uuid, order);
    set({
      project: {
        ...project,
        overlays: res.overlays,
      },
    });
  },

  addFromAsset: async (assetUuid) => {
    const project = get().project;
    if (!project) return;

    get().saveUndoState();
    const { data: res } = await overlaysApi.addFromAsset(project.uuid, assetUuid);

    set({
      project: {
        ...project,
        overlays: [...project.overlays, res.overlay],
      },
      selectedOverlayId: res.overlay.uuid,
    });
  },

  startRender: async () => {
    const project = get().project;
    if (!project) return;

    const { data } = await projectsApi.render(project.uuid);
    set({
      project: {
        ...project,
        status: 'rendering',
        render_progress: 0,
      },
    });
  },

  pollRenderStatus: async () => {
    const project = get().project;
    if (!project) return;

    const { data } = await projectsApi.renderStatus(project.uuid);
    set({
      project: {
        ...project,
        status: data.status,
        render_progress: data.progress,
        latest_render_job: data.render_job,
      },
    });
  },

  saveUndoState: () => {
    const project = get().project;
    if (!project) return;

    const currentOverlays = JSON.parse(JSON.stringify(project.overlays));
    const stack = [...get().undoStack, currentOverlays];
    if (stack.length > 30) stack.shift();

    set({ undoStack: stack, redoStack: [] });
  },

  undo: () => {
    const { undoStack, project } = get();
    if (!project || undoStack.length === 0) return;

    const currentOverlays = JSON.parse(JSON.stringify(project.overlays));
    const previousOverlays = undoStack[undoStack.length - 1];

    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, currentOverlays],
      project: { ...project, overlays: previousOverlays },
    });
  },

  redo: () => {
    const { redoStack, project } = get();
    if (!project || redoStack.length === 0) return;

    const currentOverlays = JSON.parse(JSON.stringify(project.overlays));
    const nextOverlays = redoStack[redoStack.length - 1];

    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, currentOverlays],
      project: { ...project, overlays: nextOverlays },
    });
  },

  getSelectedOverlay: () => {
    const { project, selectedOverlayId } = get();
    if (!project || !selectedOverlayId) return null;
    return project.overlays.find((o) => o.uuid === selectedOverlayId) || null;
  },

  getVisibleOverlays: () => {
    const { project, currentTime } = get();
    if (!project) return [];
    return project.overlays.filter((o) => {
      const endTime = o.until_end ? Infinity : o.start_time + o.duration;
      return currentTime >= o.start_time && currentTime < endTime;
    });
  },
}));
