import { useEffect } from "react";
import { getSiteSettings } from "@/lib/firebase";

/**
 * RedirectManager handles global site redirection based on the "Official Site URL" 
 * configured in the admin settings.
 */
export const RedirectManager = () => {
    useEffect(() => {
        const handleRedirection = async () => {
            try {
                // 1. Skip if local development to avoid being locked out during dev
                const isLocal = window.location.hostname === "localhost" || 
                               window.location.hostname === "127.0.0.1" ||
                               window.location.hostname.includes("192.168.");
                if (isLocal) return;

                // 2. Check for bypass parameter (emergency bailout)
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get("bypass_redirect") === "true") {
                    console.warn("[RedirectManager] Redirection bypassed via query parameter.");
                    return;
                }

                // 3. Fetch settings
                const settings = await getSiteSettings();
                const officialUrl = settings.officialSiteUrl;

                if (officialUrl && officialUrl.trim() !== "") {
                    // 4. Normalize target URL (remove trailing slash)
                    let targetOrigin = officialUrl.trim().replace(/\/$/, "");
                    
                    // Ensure the target URL starts with http/https
                    if (!targetOrigin.startsWith("http")) {
                        targetOrigin = "https://" + targetOrigin;
                    }

                    // 5. If current origin doesn't match target origin, redirect
                    if (window.location.origin !== targetOrigin) {
                        console.log(`[RedirectManager] Redirecting from ${window.location.origin} to ${targetOrigin}`);
                        
                        // Construct final URL while preserving path, query, and hash
                        const finalUrl = targetOrigin + window.location.pathname + window.location.search + window.location.hash;
                        
                        // Use replace to avoid adding the "wrong" domain to history
                        window.location.replace(finalUrl);
                    }
                }
            } catch (error) {
                console.error("[RedirectManager] Error during redirection check:", error);
            }
        };

        handleRedirection();
    }, []);

    return null;
};
