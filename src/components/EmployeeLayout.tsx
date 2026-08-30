import { Outlet, Navigate, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';
import { useAuth } from '../hooks/useAuth';

export default function EmployeeLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E31E24]"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Role protection - Prevent managers from entering employee area
  const isManagement = user?.role === 'admin' || user?.role === 'manager';

  if (isManagement && location.pathname.startsWith('/employee')) {
    // If management tries to access employee home, redirect to admin home
    if (location.pathname === '/employee/home' || location.pathname === '/employee') {
      return <Navigate to="/admin/home" replace />;
    }
  }

  // Force join-group if not in a group
  if (user.groupStatus !== 'joined' && location.pathname !== '/employee/join-group') {
    return <Navigate to="/employee/join-group" replace />;
  }

  // If in join-group screen, don't show sidebar/bottom nav to make it "stripped of everything"
  const isJoiningGroup = location.pathname === '/employee/join-group';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-row overflow-x-hidden antialiased">
      {/* Desktop Sidebar */}
      {!isJoiningGroup && <Sidebar />}

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col relative min-h-screen ${!isJoiningGroup ? 'pb-20 md:pb-0' : ''}`}>
        <div className={`w-full max-w-6xl mx-auto flex-1 ${!isJoiningGroup ? 'px-4 md:px-8 pb-10' : ''}`}>
          <Outlet />
        </div>
        
        {/* Mobile Navigation */}
        {!isJoiningGroup && (
          <div className="md:hidden">
            <BottomNav />
          </div>
        )}
      </div>
    </div>
  );
}
