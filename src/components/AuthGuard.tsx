import { ReactNode, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

export const AuthGuard = ({ children }: { children: ReactNode }) => {
    const { user, profile, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!loading && user && profile) {
            if (profile.status === 'pending_payment') {
                if (location.pathname !== '/verify-code') {
                    navigate('/verify-code');
                }
            }
        }
    }, [user, profile, loading, location, navigate]);

    if (loading) return null;

    return <>{children}</>;
};
