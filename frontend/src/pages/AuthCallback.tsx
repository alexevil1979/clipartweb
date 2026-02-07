import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setToken, fetchUser } = useAuthStore();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      setToken(token);
      fetchUser().then(() => {
        navigate('/dashboard', { replace: true });
      });
    } else {
      navigate('/login', { replace: true });
    }
  }, [params, setToken, fetchUser, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-base">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-subtext-0">Авторизация...</p>
      </div>
    </div>
  );
}
