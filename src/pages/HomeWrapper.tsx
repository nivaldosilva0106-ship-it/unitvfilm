import React, { Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";

const Landing = React.lazy(() => import("@/pages/Landing"));
const Index = React.lazy(() => import("@/pages/Index"));

export const HomeWrapper = () => {
    const { user, loading } = useAuth();

    if (loading) return null; // Or a specific skeleton, but AuthGuard handles main loading usually

    return (
        <Suspense fallback={null}>
            {!user ? <Landing /> : <Index />}
        </Suspense>
    );
};

export default HomeWrapper;
