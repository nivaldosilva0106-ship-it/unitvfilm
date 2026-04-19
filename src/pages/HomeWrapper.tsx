import React, { Suspense, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppConfig } from "@/hooks/useAppConfig";
import { getAuth, signInAnonymously } from "firebase/auth";

const Landing = React.lazy(() => import("@/pages/Landing"));
const Index = React.lazy(() => import("@/pages/Index"));

export const HomeWrapper = () => {
    const { user, loading } = useAuth();
    const { isLiteMode } = useAppConfig();

    useEffect(() => {
        // Na TV (Lite App), o utilizador não se cadastra. Usa Guest anonimamente para acesso imediato.
        if (isLiteMode && !loading && !user) {
            const auth = getAuth();
            signInAnonymously(auth).catch(console.error);
        }
    }, [isLiteMode, loading, user]);

    if (loading) return null; // Or a specific skeleton, but AuthGuard handles main loading usually

    return (
        <Suspense fallback={null}>
            {(!user && !isLiteMode) ? <Landing /> : <Index />}
        </Suspense>
    );
};

export default HomeWrapper;
