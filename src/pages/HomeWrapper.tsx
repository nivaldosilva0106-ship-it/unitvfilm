import { useAuth } from "@/contexts/AuthContext";
import { Landing } from "@/pages/Landing";
import Index from "@/pages/Index";

export const HomeWrapper = () => {
    const { user, loading } = useAuth();

    if (loading) return null; // Or a specific skeleton, but AuthGuard handles main loading usually

    if (!user) {
        return <Landing />;
    }

    return <Index />;
};

export default HomeWrapper;
