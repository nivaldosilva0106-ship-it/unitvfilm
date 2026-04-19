import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, AlertTriangle, Globe, Library } from 'lucide-react';

interface ConnectivityChoiceModalProps {
  open: boolean;
  onStayOnline: () => void;
  onGoOffline: () => void;
}

export function ConnectivityChoiceModal({ open, onStayOnline, onGoOffline }: ConnectivityChoiceModalProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[450px] bg-zinc-950/90 border-white/10 backdrop-blur-2xl shadow-2xl rounded-3xl overflow-hidden p-0">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-yellow-500 to-orange-500 animate-pulse" />
        
        <div className="p-8">
          <DialogHeader className="items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mb-2 animate-bounce-short">
              <AlertTriangle className="w-8 h-8 text-orange-400" />
            </div>
            <DialogTitle className="text-2xl font-black text-white uppercase tracking-tighter">
              Conexão Instável
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-base leading-relaxed">
              Sua internet parece estar muito lenta no momento. Como você deseja continuar?
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 mt-8">
            <button
              onClick={onStayOnline}
              className="group relative flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-orange-500/50 transition-all duration-300 text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Globe className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h4 className="font-bold text-white text-lg">Permanecer Online</h4>
                <p className="text-zinc-500 text-sm">Tentar carregar o conteúdo mesmo com lentidão.</p>
              </div>
              <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              </div>
            </button>

            <button
              onClick={onGoOffline}
              className="group relative flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-zinc-500/50 transition-all duration-300 text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-zinc-700/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Library className="w-6 h-6 text-zinc-400" />
              </div>
              <div>
                <h4 className="font-bold text-white text-lg">Modo Offline</h4>
                <p className="text-zinc-500 text-sm">Acessar sua biblioteca local de vídeos baixados.</p>
              </div>
              <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                <WifiOff className="w-4 h-4 text-zinc-500" />
              </div>
            </button>
          </div>
        </div>

        <div className="px-8 py-4 bg-zinc-900/50 border-t border-white/5 flex justify-center">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-black italic">
                UniTvFilm Smart Connectivity System
            </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
