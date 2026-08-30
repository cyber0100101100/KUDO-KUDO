import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const path = location.pathname;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex flex-row-reverse justify-around items-center px-2 bg-white/95 backdrop-blur-xl border-t border-slate-100/50 shadow-[0_-8px_30px_rgba(0,0,0,0.02)] h-20 pb-safe">
      <Link to="/employee/home" className={`flex flex-col items-center gap-1 transition-all flex-1 px-1 ${path === '/employee/home' ? 'text-[#E31E24]' : 'text-slate-400'}`}>
        <span className={`material-symbols-outlined text-2xl ${path === '/employee/home' ? 'filled-icon' : ''}`}>home</span>
        <span className="text-[8px] font-black uppercase tracking-tighter text-center">الرئيسية</span>
      </Link>

      <Link to="/employee/salary" className={`flex flex-col items-center gap-1 transition-all flex-1 px-1 ${path === '/employee/salary' ? 'text-[#E31E24]' : 'text-slate-400'}`}>
        <span className={`material-symbols-outlined text-2xl ${path === '/employee/salary' ? 'filled-icon' : ''}`}>payments</span>
        <span className="text-[8px] font-black uppercase tracking-tighter text-center">الراتب</span>
      </Link>

      <div className="flex-1 flex flex-col items-center relative -top-5 px-1">
        <Link to="/employee/attendance" className="w-13 h-13 bg-[#E31E24] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-200 border-2 border-white transition-transform active:scale-90">
          <span className="material-symbols-outlined text-2xl filled-icon">face</span>
        </Link>
      </div>

      {user?.role === 'admin' && (
        <Link to="/admin/home" className={`flex flex-col items-center gap-1 transition-all flex-1 px-1 ${path.startsWith('/admin') ? 'text-[#E31E24]' : 'text-slate-400'}`}>
          <span className={`material-symbols-outlined text-2xl ${path.startsWith('/admin') ? 'filled-icon' : ''}`}>admin_panel_settings</span>
          <span className="text-[8px] font-black uppercase tracking-tighter text-center">الإدارة</span>
        </Link>
      )}

      <Link to="/employee/profile" className={`flex flex-col items-center gap-1 transition-all flex-1 px-1 ${path === '/employee/profile' ? 'text-[#E31E24]' : 'text-slate-400'}`}>
        <span className={`material-symbols-outlined text-2xl ${path === '/employee/profile' ? 'filled-icon' : ''}`}>menu</span>
        <span className="text-[8px] font-black uppercase tracking-tighter text-center">المزيد</span>
      </Link>
    </nav>
  );
}
