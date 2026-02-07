import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { projectsApi, subscriptionApi } from '@/lib/api';
import { formatDate, formatBytes, formatDuration } from '@/lib/utils';
import type { Project } from '@/types';
import {
  Video, Plus, Folder, Trash2, Copy, Edit2, LogOut,
  Crown, Clock, HardDrive, MoreVertical, Film, Settings
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const { data } = await projectsApi.list();
      setProjects(data.data || []);
    } catch {
      toast.error('Ошибка загрузки проектов');
    } finally {
      setIsLoading(false);
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    setCreating(true);
    try {
      const { data } = await projectsApi.create(newProjectName);
      navigate(`/editor/${data.project.uuid}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ошибка создания проекта');
    } finally {
      setCreating(false);
    }
  };

  const deleteProject = async (uuid: string) => {
    if (!confirm('Удалить проект? Это действие нельзя отменить.')) return;
    try {
      await projectsApi.delete(uuid);
      setProjects(projects.filter((p) => p.uuid !== uuid));
      toast.success('Проект удалён');
    } catch {
      toast.error('Ошибка удаления');
    }
  };

  const duplicateProject = async (uuid: string) => {
    try {
      const { data } = await projectsApi.duplicate(uuid);
      setProjects([data.project, ...projects]);
      toast.success('Проект дублирован');
    } catch {
      toast.error('Ошибка дублирования');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleManageSubscription = async () => {
    try {
      const { data } = await subscriptionApi.portal();
      window.location.href = data.url;
    } catch {
      navigate('/pricing');
    }
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-surface-1 text-subtext-0',
    rendering: 'bg-yellow/20 text-yellow',
    completed: 'bg-green/20 text-green',
    failed: 'bg-red/20 text-red',
  };

  const statusLabels: Record<string, string> = {
    draft: 'Черновик',
    rendering: 'Рендеринг...',
    completed: 'Готово',
    failed: 'Ошибка',
  };

  return (
    <div className="min-h-screen bg-base">
      {/* Header */}
      <header className="border-b border-surface-0 bg-mantle">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue to-mauve rounded-lg flex items-center justify-center">
              <Video className="w-4 h-4 text-base" />
            </div>
            <span className="font-bold">ClipArtWeb</span>
          </Link>

          <div className="flex items-center gap-4">
            {user?.is_pro ? (
              <span className="flex items-center gap-1.5 text-sm text-yellow">
                <Crown className="w-4 h-4" /> Pro
              </span>
            ) : (
              <button onClick={handleManageSubscription} className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5" /> Обновить до Pro
              </button>
            )}

            <div className="flex items-center gap-3 pl-4 border-l border-surface-0">
              <div className="w-8 h-8 bg-surface-0 rounded-full flex items-center justify-center text-sm font-medium">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <span className="text-sm font-medium hidden sm:block">{user?.name}</span>
              <button onClick={handleLogout} className="text-overlay-0 hover:text-red transition-colors" title="Выйти">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card flex items-center gap-4">
            <div className="w-10 h-10 bg-blue/10 rounded-lg flex items-center justify-center">
              <Folder className="w-5 h-5 text-blue" />
            </div>
            <div>
              <p className="text-2xl font-bold">{projects.length}</p>
              <p className="text-sm text-subtext-0">Проектов</p>
            </div>
          </div>
          <div className="card flex items-center gap-4">
            <div className="w-10 h-10 bg-green/10 rounded-lg flex items-center justify-center">
              <Film className="w-5 h-5 text-green" />
            </div>
            <div>
              <p className="text-2xl font-bold">{projects.filter((p) => p.status === 'completed').length}</p>
              <p className="text-sm text-subtext-0">Отрендерено</p>
            </div>
          </div>
          <div className="card flex items-center gap-4">
            <div className="w-10 h-10 bg-mauve/10 rounded-lg flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-mauve" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatBytes(user?.storage_used || 0)}</p>
              <p className="text-sm text-subtext-0">из {formatBytes(user?.storage_limit || 0)}</p>
            </div>
          </div>
        </div>

        {/* Projects header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Мои проекты</h1>
          <button
            onClick={() => setShowNewProject(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Новый проект
          </button>
        </div>

        {/* New project modal */}
        {showNewProject && (
          <div className="fixed inset-0 bg-crust/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="card max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Новый проект</h2>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="input-field mb-4"
                placeholder="Название проекта"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && createProject()}
              />
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowNewProject(false)} className="btn-ghost">
                  Отмена
                </button>
                <button onClick={createProject} disabled={creating} className="btn-primary">
                  {creating ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Projects list */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <Film className="w-16 h-16 text-surface-2 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Нет проектов</h3>
            <p className="text-subtext-0 mb-6">Создайте первый проект и начните добавлять CTA к видео</p>
            <button onClick={() => setShowNewProject(true)} className="btn-primary">
              <Plus className="w-4 h-4 inline mr-2" /> Создать проект
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.uuid}
                className="card hover:border-surface-1 transition-colors group cursor-pointer"
                onClick={() => navigate(`/editor/${project.uuid}`)}
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-crust rounded-lg mb-4 overflow-hidden flex items-center justify-center">
                  {project.thumbnail_path ? (
                    <img
                      src={`/api/projects/${project.uuid}/thumbnail`}
                      alt={project.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Film className="w-12 h-12 text-surface-2" />
                  )}
                </div>

                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{project.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[project.status]}`}>
                        {statusLabels[project.status]}
                      </span>
                      {project.video_duration && (
                        <span className="text-xs text-overlay-0 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(project.video_duration)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-overlay-0 mt-2">{formatDate(project.updated_at)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => duplicateProject(project.uuid)}
                      className="p-1.5 hover:bg-surface-0 rounded-lg text-overlay-0 hover:text-text transition-colors"
                      title="Дублировать"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteProject(project.uuid)}
                      className="p-1.5 hover:bg-red/10 rounded-lg text-overlay-0 hover:text-red transition-colors"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
