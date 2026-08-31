import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function AdminSidebar() {
  const location = useLocation();
  const path = location.pathname;
  const { user } = useAuth();

  const isSupervisor = user?.role === 'supervisor';

  const navItems = [
    { name: 'الرئيسية', icon: 'home', to: '/admin/home' },
    { name: 'الرواتب', icon: 'payments', to: '/admin/salary' },
    { name: 'الملف الشخصي', icon: 'person', to: '/admin/profile' },
    { name: 'التنبيهات', icon: 'notifications', to: '/admin/notifications' },
    { name: 'إدارة الموظفين', icon: 'group', to: '/admin/workforce' },
    { name: 'جدول العمل', icon: 'calendar_today', to: '/admin/schedule' },
  ];

  return (
    <aside className="hidden md:flex flex-col w-72 bg-white border-l border-slate-50 h-screen sticky top-0 z-50">
      <div className="p-8">
        <div className="flex items-center justify-center mb-12 w-full">
          <div className="h-12 w-full">
            <img 
              src="./logo_upscayl_4x_upscayl-standard-4x.png" 
              alt="KUDO KUDO Admin" 
              className="h-full w-full object-contain"
            />
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-4 px-6 py-3.5 rounded-2xl transition-all font-bold text-sm ${
                path === item.to
                  ? 'bg-red-50 text-[#E31E24] shadow-sm shadow-red-50'
                  : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
              }`}
            >
              <span className={`material-symbols-outlined text-2xl ${path === item.to ? 'filled-icon' : ''}`}>
                {item.icon}
              </span>
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-8">
        <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100/50">
          <p className="text-[10px] font-bold text-slate-400 mb-3 uppercase   text-center opacity-70">إدارة النظام</p>
          <button className="w-full py-3.5 bg-[#E31E24] text-white rounded-2xl font-bold text-xs shadow-lg shadow-red-100 hover:bg-red-700 transition-all active:scale-[0.98]">
            دعم فني سريع
          </button>
        </div>
      </div>
    </aside>
  );
}
