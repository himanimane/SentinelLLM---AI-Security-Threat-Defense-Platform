import React, { useState, useEffect } from 'react';
import { UserPortal } from './components/UserPortal';
import { AdminLoginGateway } from './components/AdminLoginGateway';
import { AdminSocPortal } from './components/AdminSocPortal';
import { UserAccount } from './types';
import { INITIAL_USERS } from './services/auditStorage';

export default function App() {
  // Current Standard User (Marcus Foley - Developer)
  const [currentUser, setCurrentUser] = useState<UserAccount>(INITIAL_USERS[0]);
  
  // Authenticated Admin User (Null until Master Key + 2FA verified)
  const [adminUser, setAdminUser] = useState<UserAccount | null>(null);
  
  // Navigation View State: 'user_portal' | 'admin_gateway' | 'admin_soc'
  const [portalMode, setPortalMode] = useState<'user_portal' | 'admin_gateway' | 'admin_soc'>('user_portal');

  // Sync user status from server periodically to ensure real-time block/freeze takes effect
  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const res = await fetch('/api/admin/users');
        if (res.ok) {
          const data = await res.json();
          const me = data.users?.find((u: UserAccount) => u.id === currentUser.id);
          if (me && me.status !== currentUser.status) {
            setCurrentUser(me);
          }
        }
      } catch {}
    };

    const interval = setInterval(checkUserStatus, 5000);
    return () => clearInterval(interval);
  }, [currentUser.id, currentUser.status]);

  // Handle Logout from User Portal
  const handleUserLogout = () => {
    // Switch between developer and suspect user for testing
    const nextUser = currentUser.id === INITIAL_USERS[0].id ? INITIAL_USERS[1] : INITIAL_USERS[0];
    setCurrentUser(nextUser);
  };

  // Admin Gateway Authentication Success
  const handleAdminAuthSuccess = (authenticatedAdmin: UserAccount) => {
    setAdminUser(authenticatedAdmin);
    setPortalMode('admin_soc');
  };

  return (
    <div className="min-h-screen bg-[#060911] text-slate-100 font-sans">
      {portalMode === 'user_portal' && (
        <UserPortal
          currentUser={currentUser}
          onLogout={handleUserLogout}
          onOpenAdminGateway={() => setPortalMode('admin_gateway')}
        />
      )}

      {portalMode === 'admin_gateway' && (
        <AdminLoginGateway
          onLoginSuccess={handleAdminAuthSuccess}
          onBackToUserPortal={() => setPortalMode('user_portal')}
        />
      )}

      {portalMode === 'admin_soc' && adminUser && (
        <AdminSocPortal
          adminUser={adminUser}
          onExitToUserPortal={() => setPortalMode('user_portal')}
        />
      )}
    </div>
  );
}
