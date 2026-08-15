import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { ConfirmProvider } from '@/hooks/use-confirm';
import { Toaster } from '@/components/ui/sonner';
import Layout from '@/components/Layout';
// 首屏三页静态导入，避免加载态闪烁
import Home from '@/pages/Home';
import LoginPage from '@/pages/Login';
import RegisterPage from '@/pages/Register';

// 其余页面按路由懒加载，减小首屏体积
const UserDashboard = lazy(() => import('@/pages/user/Dashboard'));
const UserBindAccount = lazy(() => import('@/pages/user/BindAccount'));
const UserTasks = lazy(() => import('@/pages/user/Tasks'));
const UserTaskForm = lazy(() => import('@/pages/user/TaskForm'));
const UserTaskLogs = lazy(() => import('@/pages/user/TaskLogs'));
const UserPetLevels = lazy(() => import('@/pages/user/PetLevels'));
const UserDailyTasks = lazy(() => import('@/pages/user/DailyTasks'));
const UserDailyTaskLogs = lazy(() => import('@/pages/user/daily/TaskLogs'));
const UserDailyChargeConfirm = lazy(() => import('@/pages/user/daily/ChargeConfirm'));
const UserRecharge = lazy(() => import('@/pages/user/Recharge'));
const UserOrders = lazy(() => import('@/pages/user/Orders'));
const UserProfile = lazy(() => import('@/pages/user/Profile'));
const UserLiveRooms = lazy(() => import('@/pages/user/LiveRooms'));
const UserLottery = lazy(() => import('@/pages/user/Lottery'));
const UserTickets = lazy(() => import('@/pages/user/Tickets'));
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminUsers = lazy(() => import('@/pages/admin/Users'));
const AdminUserForm = lazy(() => import('@/pages/admin/users/UserForm'));
const AdminTasks = lazy(() => import('@/pages/admin/Tasks'));
const AdminTemplates = lazy(() => import('@/pages/admin/Templates'));
const AdminTemplateForm = lazy(() => import('@/pages/admin/templates/TemplateForm'));
const AdminPackages = lazy(() => import('@/pages/admin/Packages'));
const AdminPackageForm = lazy(() => import('@/pages/admin/packages/PackageForm'));
const AdminOrders = lazy(() => import('@/pages/admin/Orders'));
const AdminCards = lazy(() => import('@/pages/admin/Cards'));
const AdminGenerateCards = lazy(() => import('@/pages/admin/cards/GenerateCards'));
const AdminSettings = lazy(() => import('@/pages/admin/Settings'));
const AdminLiveRooms = lazy(() => import('@/pages/admin/LiveRooms'));
const AdminLiveRoomForm = lazy(() => import('@/pages/admin/live-rooms/LiveRoomForm'));
const AdminLottery = lazy(() => import('@/pages/admin/Lottery'));
const AdminPrizeForm = lazy(() => import('@/pages/admin/lottery/PrizeForm'));
const AdminTickets = lazy(() => import('@/pages/admin/Tickets'));
const AdminBiliAccounts = lazy(() => import('@/pages/admin/BiliAccounts'));
const AdminFriendLinks = lazy(() => import('@/pages/admin/FriendLinks'));
const AdminFriendLinkForm = lazy(() => import('@/pages/admin/friend-links/FriendLinkForm'));

function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
      <span className="h-9 w-9 animate-spin rounded-full border-2 border-border border-t-primary" />
      <span className="text-sm">加载中...</span>
    </div>
  );
}

function RequireAuth({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (adminOnly && user.is_admin !== 1) return <Navigate to="/" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />

      <Route path="/dashboard" element={<RequireAuth><Layout><UserDashboard /></Layout></RequireAuth>} />
      <Route path="/bind-account" element={<RequireAuth><Layout><UserBindAccount /></Layout></RequireAuth>} />
      <Route path="/tasks/:accountId" element={<RequireAuth><Layout><UserTasks /></Layout></RequireAuth>} />
      <Route path="/tasks/:accountId/new" element={<RequireAuth><Layout><UserTaskForm /></Layout></RequireAuth>} />
      <Route path="/tasks/:accountId/edit/:taskId" element={<RequireAuth><Layout><UserTaskForm /></Layout></RequireAuth>} />
      <Route path="/tasks/:accountId/logs/:taskId" element={<RequireAuth><Layout><UserTaskLogs /></Layout></RequireAuth>} />
      <Route path="/pet-levels" element={<RequireAuth><Layout><UserPetLevels /></Layout></RequireAuth>} />
      <Route path="/pet-levels/:accountId" element={<RequireAuth><Layout><UserPetLevels /></Layout></RequireAuth>} />
      <Route path="/daily-tasks/:accountId" element={<RequireAuth><Layout><UserDailyTasks /></Layout></RequireAuth>} />
      <Route path="/daily-tasks/:accountId/logs/:taskId" element={<RequireAuth><Layout><UserDailyTaskLogs /></Layout></RequireAuth>} />
      <Route path="/daily-tasks/:accountId/charge-confirm" element={<RequireAuth><Layout><UserDailyChargeConfirm /></Layout></RequireAuth>} />
      <Route path="/recharge" element={<RequireAuth><Layout><UserRecharge /></Layout></RequireAuth>} />
      <Route path="/orders" element={<RequireAuth><Layout><UserOrders /></Layout></RequireAuth>} />
      <Route path="/live-rooms" element={<RequireAuth><Layout><UserLiveRooms /></Layout></RequireAuth>} />
      <Route path="/lottery" element={<RequireAuth><Layout><UserLottery /></Layout></RequireAuth>} />
      <Route path="/tickets" element={<RequireAuth><Layout><UserTickets /></Layout></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><Layout><UserProfile /></Layout></RequireAuth>} />

      <Route path="/admin" element={<RequireAuth adminOnly><Layout admin><AdminDashboard /></Layout></RequireAuth>} />
      <Route path="/admin/users" element={<RequireAuth adminOnly><Layout admin><AdminUsers /></Layout></RequireAuth>} />
      <Route path="/admin/users/new" element={<RequireAuth adminOnly><Layout admin><AdminUserForm /></Layout></RequireAuth>} />
      <Route path="/admin/users/edit/:id" element={<RequireAuth adminOnly><Layout admin><AdminUserForm /></Layout></RequireAuth>} />
      <Route path="/admin/tasks" element={<RequireAuth adminOnly><Layout admin><AdminTasks /></Layout></RequireAuth>} />
      <Route path="/admin/templates" element={<RequireAuth adminOnly><Layout admin><AdminTemplates /></Layout></RequireAuth>} />
      <Route path="/admin/templates/new" element={<RequireAuth adminOnly><Layout admin><AdminTemplateForm /></Layout></RequireAuth>} />
      <Route path="/admin/templates/edit/:id" element={<RequireAuth adminOnly><Layout admin><AdminTemplateForm /></Layout></RequireAuth>} />
      <Route path="/admin/packages" element={<RequireAuth adminOnly><Layout admin><AdminPackages /></Layout></RequireAuth>} />
      <Route path="/admin/packages/new" element={<RequireAuth adminOnly><Layout admin><AdminPackageForm /></Layout></RequireAuth>} />
      <Route path="/admin/packages/edit/:id" element={<RequireAuth adminOnly><Layout admin><AdminPackageForm /></Layout></RequireAuth>} />
      <Route path="/admin/orders" element={<RequireAuth adminOnly><Layout admin><AdminOrders /></Layout></RequireAuth>} />
      <Route path="/admin/cards" element={<RequireAuth adminOnly><Layout admin><AdminCards /></Layout></RequireAuth>} />
      <Route path="/admin/cards/generate" element={<RequireAuth adminOnly><Layout admin><AdminGenerateCards /></Layout></RequireAuth>} />
      <Route path="/admin/live-rooms" element={<RequireAuth adminOnly><Layout admin><AdminLiveRooms /></Layout></RequireAuth>} />
      <Route path="/admin/live-rooms/new" element={<RequireAuth adminOnly><Layout admin><AdminLiveRoomForm /></Layout></RequireAuth>} />
      <Route path="/admin/live-rooms/edit/:id" element={<RequireAuth adminOnly><Layout admin><AdminLiveRoomForm /></Layout></RequireAuth>} />
      <Route path="/admin/lottery" element={<RequireAuth adminOnly><Layout admin><AdminLottery /></Layout></RequireAuth>} />
      <Route path="/admin/lottery/prizes/new" element={<RequireAuth adminOnly><Layout admin><AdminPrizeForm /></Layout></RequireAuth>} />
      <Route path="/admin/lottery/prizes/edit/:id" element={<RequireAuth adminOnly><Layout admin><AdminPrizeForm /></Layout></RequireAuth>} />
      <Route path="/admin/tickets" element={<RequireAuth adminOnly><Layout admin><AdminTickets /></Layout></RequireAuth>} />
      <Route path="/admin/bili-accounts" element={<RequireAuth adminOnly><Layout admin><AdminBiliAccounts /></Layout></RequireAuth>} />
      <Route path="/admin/friend-links" element={<RequireAuth adminOnly><Layout admin><AdminFriendLinks /></Layout></RequireAuth>} />
      <Route path="/admin/friend-links/new" element={<RequireAuth adminOnly><Layout admin><AdminFriendLinkForm /></Layout></RequireAuth>} />
      <Route path="/admin/friend-links/edit/:id" element={<RequireAuth adminOnly><Layout admin><AdminFriendLinkForm /></Layout></RequireAuth>} />
      <Route path="/admin/settings" element={<RequireAuth adminOnly><Layout admin><AdminSettings /></Layout></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <AppRoutes />
        <Toaster />
      </ConfirmProvider>
    </AuthProvider>
  );
}
