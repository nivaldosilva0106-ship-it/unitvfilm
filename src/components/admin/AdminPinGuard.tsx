import React, { useState, useEffect, useRef } from "react";
import { Lock, ShieldAlert, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface AdminPinGuardProps {
  children: React.ReactNode;
}

const ADMIN_PIN = "540435";
const SESSION_KEY = "unitv_admin_pin_verified";

export const AdminPinGuard = ({ children }: AdminPinGuardProps) => {
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Verificar se o PIN já foi introduzido nesta sessão
    const isVerifiedSession = sessionStorage.getItem(SESSION_KEY);
    if (isVerifiedSession === "true") {
      setIsVerified(true);
    }
    setIsLoading(false);
  }, []);

  const handleChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError(false);

    // Mover para o próximo input
    if (value !== "" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (pin[index] === "" && index > 0) {
        // Mover para o input anterior ao apagar
        inputRefs.current[index - 1]?.focus();
      } else {
        const newPin = [...pin];
        newPin[index] = "";
        setPin(newPin);
        setError(false);
      }
    } else if (e.key === "Enter" && index === 5 && pin.every((p) => p !== "")) {
      verifyPin(pin.join(""));
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").replace(/\D/g, "").slice(0, 6);
    
    if (pastedData) {
      const newPin = [...pin];
      for (let i = 0; i < pastedData.length; i++) {
        newPin[i] = pastedData[i];
      }
      setPin(newPin);
      
      if (pastedData.length === 6) {
        inputRefs.current[5]?.focus();
        verifyPin(pastedData);
      } else {
        inputRefs.current[pastedData.length]?.focus();
      }
    }
  };

  const verifyPin = (currentPinStr?: string) => {
    const pinToVerify = currentPinStr || pin.join("");
    
    if (pinToVerify.length !== 6) {
      setError(true);
      toast.error("Por favor, introduza os 6 dígitos do PIN.");
      return;
    }

    if (pinToVerify === ADMIN_PIN) {
      setIsVerified(true);
      sessionStorage.setItem(SESSION_KEY, "true");
      toast.success("Acesso autorizado ao painel!");
    } else {
      setError(true);
      setPin(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      toast.error("PIN incorreto. Acesso negado.");
    }
  };

  if (isLoading) return null;

  if (isVerified) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[120px] opacity-50" />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] opacity-30" />
      </div>

      <div 
        className="relative z-10 w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500"
      >
        <div className="bg-[#121212] border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              {error ? (
                <ShieldAlert className="w-8 h-8 text-red-400" />
              ) : (
                <Lock className="w-8 h-8" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Área Restrita</h1>
            <p className="text-muted-foreground text-sm max-w-[280px]">
              Insira o PIN de segurança para aceder ao painel de administração.
            </p>
          </div>

          <div className="space-y-6">
            <div 
              className="flex justify-center gap-2 sm:gap-3"
              onPaste={handlePaste}
            >
              {pin.map((digit, index) => (
                <input
                  key={index}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  ref={(el) => (inputRefs.current[index] = el)}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-xl bg-black/50 border-2 transition-all outline-none text-white ${
                    error 
                      ? "border-red-500/50 focus:border-red-500 text-red-500" 
                      : digit 
                        ? "border-blue-500/50 text-blue-400" 
                        : "border-white/10 focus:border-blue-500/50"
                  }`}
                  autoFocus={index === 0}
                />
              ))}
            </div>

            <Button 
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              onClick={() => verifyPin()}
              disabled={pin.some(p => p === "")}
            >
              <ShieldCheck className="w-5 h-5 mr-2" />
              Validar Acesso
              <ArrowRight className="w-4 h-4 ml-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </Button>
            
            <button 
              onClick={() => navigate('/')}
              className="w-full text-center text-sm text-muted-foreground hover:text-white transition-colors mt-4"
            >
              Voltar ao site
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
