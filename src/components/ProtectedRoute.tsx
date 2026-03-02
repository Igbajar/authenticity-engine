import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSubscription?: boolean;
}

const ProtectedRoute = ({ children, requireSubscription = true }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isSubscribed, loading: subLoading } = useSubscription();
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        setRoleLoading(false);
        return;
      }
      const { data } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      setIsAdmin(!!data);
      setRoleLoading(false);
    };
    checkAdmin();
  }, [user]);

  const loading = authLoading || (user && (subLoading || roleLoading));

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requireSubscription && !isAdmin && !isSubscribed) {
    return <Navigate to="/subscribe" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
