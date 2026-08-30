import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';

interface AdminTopHeaderProps {
  title?: string;
  showBackButton?: boolean;
}

export default function AdminTopHeader({ title, showBackButton = false }: AdminTopHeaderProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <header className="bg-white/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-50 border-b border-slate-100/50 shadow-sm">
      <div className="flex-1 flex items-center gap-3 min-w-0">
        {showBackButton ? (
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">arrow_forward</span>
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 shadow-sm">
              <img 
                src={user?.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'Admin')}&background=f8fafc&color=cbd5e1`} 
                alt="Profile" 
                className="w-full h-full object-cover" 
              />
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[11px] font-black text-slate-900 leading-tight truncate max-w-[120px]">
                {user?.displayName || 'المدير العام'}
              </span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">
                {user?.jobTitle || 'إدارة النظام'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 px-4">
        <motion.img 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          src="/logo_upscayl_4x_upscayl-standard-4x.png" 
          alt="KUDO KUDO" 
          className="h-6 md:h-8 object-contain"
        />
      </div>

      <div className="flex-1 flex items-center justify-end">
        <button 
          onClick={() => navigate('/admin/notifications')}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 transition-colors active:scale-95 relative"
        >
          <span className="material-symbols-outlined text-xl">notifications</span>
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#E31E24] rounded-full border-2 border-white"></span>
        </button>
      </div>
    </header>
  );
}
