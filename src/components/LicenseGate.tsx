import { useState, useEffect, useRef } from "react";
import { ShieldCheck, Lock, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";
import { isLicenseGranted, validateLicenseKey } from "@/lib/license";

interface LicenseGateProps {
  children: React.ReactNode;
}

export const LicenseGate = ({ children }: LicenseGateProps) => {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check on mount — instant if authorized domain or saved key
    setGranted(isLicenseGranted());
  }, []);

  useEffect(() => {
    if (granted === false) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [granted]);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || cooldown > 0) return;

    setError(null);
    setLoading(true);

    const valid = await validateLicenseKey(key);
    setLoading(false);

    if (valid) {
      setSuccess(true);
      setTimeout(() => setGranted(true), 1200);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setKey("");

      if (newAttempts >= 3) {
        // Apply progressive cooldown after 3 failed attempts
        const wait = Math.min(newAttempts * 10, 60);
        setCooldown(wait);
        setError(`Chave inválida. Aguarde ${wait}s antes de tentar novamente.`);
      } else {
        setError(`Chave de licença inválida. Tentativa ${newAttempts}/3.`);
      }
    }
  };

  // Still checking
  if (granted === null) return null;

  // Authorized — render app normally
  if (granted) return <>{children}</>;

  // BLOCKED — Show license gate
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.15) 0%, transparent 60%), #0a0a0a",
      }}
    >
      {/* Animated background grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(16,185,129,0.8) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(16,185,129,0.8) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-md mx-4"
        style={{
          animation: "slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(15, 15, 15, 0.95)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            boxShadow: "0 0 0 1px rgba(16,185,129,0.05), 0 32px 64px -12px rgba(0,0,0,0.8), 0 0 80px -20px rgba(16,185,129,0.15)",
            backdropFilter: "blur(24px)",
          }}
        >
          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center border-b border-white/5">
            {/* Logo / Shield */}
            <div className="flex justify-center mb-5">
              <div className="relative">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))",
                    border: "1px solid rgba(16,185,129,0.3)",
                    boxShadow: "0 0 40px rgba(16,185,129,0.2)",
                  }}
                >
                  <ShieldCheck className="w-10 h-10 text-emerald-400" />
                </div>
                <div
                  className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center"
                  style={{ boxShadow: "0 0 12px rgba(16,185,129,0.8)" }}
                >
                  <Lock className="w-2.5 h-2.5 text-black" />
                </div>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
              Uni<span className="text-emerald-400">Tv</span>Film
            </h1>
            <p className="text-xs font-semibold text-emerald-400/80 uppercase tracking-[0.2em] mb-3">
              Sistema Licenciado
            </p>
            <p className="text-sm text-gray-400 leading-relaxed">
              Este software é propriedade de{" "}
              <span className="text-white font-medium">Nivaldo Silva</span>.
              <br />
              Introduza a chave de licença para continuar.
            </p>
          </div>

          {/* Form */}
          <div className="px-8 py-7">
            {success ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <div
                  className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center"
                  style={{ boxShadow: "0 0 30px rgba(16,185,129,0.3)" }}
                >
                  <ShieldCheck className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-emerald-400 font-semibold text-lg">Licença Validada!</p>
                <p className="text-gray-400 text-sm">A carregar a plataforma...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Key Input */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                    Chave de Licença
                  </label>
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type={showKey ? "text" : "password"}
                      value={key}
                      onChange={(e) => {
                        setKey(e.target.value);
                        setError(null);
                      }}
                      placeholder="Introduza a chave de licença..."
                      disabled={loading || cooldown > 0}
                      className="w-full px-4 py-3.5 pr-12 rounded-xl text-white text-sm font-mono placeholder-gray-600 outline-none transition-all"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${error ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`,
                        boxShadow: error ? "0 0 0 1px rgba(239,68,68,0.2)" : "none",
                      }}
                      onFocus={(e) => {
                        e.target.style.border = "1px solid rgba(16,185,129,0.5)";
                        e.target.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.1)";
                      }}
                      onBlur={(e) => {
                        e.target.style.border = error ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.1)";
                        e.target.style.boxShadow = "none";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-400 text-xs leading-relaxed">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!key.trim() || loading || cooldown > 0}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm text-black transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    boxShadow: (!key.trim() || loading || cooldown > 0) ? "none" : "0 0 24px rgba(16,185,129,0.35)",
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      A validar...
                    </>
                  ) : cooldown > 0 ? (
                    <>
                      <Lock className="w-4 h-4" />
                      Aguarde {cooldown}s
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Ativar Licença
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 pb-6 text-center">
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Uso não autorizado deste software é proibido por lei.
              <br />
              © {new Date().getFullYear()} Nivaldo Silva · UniTvFilm · Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  );
};
