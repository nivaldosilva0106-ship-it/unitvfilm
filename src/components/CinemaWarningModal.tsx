import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clapperboard, Play } from "lucide-react";

interface CinemaWarningModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export const CinemaWarningModal = ({ open, onClose, onConfirm }: CinemaWarningModalProps) => {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] bg-[#1a1a1a] border-[#333] text-white p-0 gap-0 overflow-hidden shadow-2xl">
                <div className="flex flex-col items-center p-8 text-center">
                    <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                        <Clapperboard className="w-10 h-10 text-amber-500" />
                    </div>

                    <h2 className="text-2xl font-bold mb-2">Atenção: Gravação de Cinema</h2>

                    <div className="space-y-4 text-gray-300 mb-8">
                        <p>
                            Este conteúdo é uma <strong>gravação de cinema</strong> e pode conter anúncios durante a exibição.
                        </p>
                        <p className="text-sm bg-white/5 p-3 rounded-lg border border-white/10">
                            Estamos trabalhando para disponibilizar a versão oficial em alta qualidade o mais breve possível.
                        </p>
                    </div>

                    <div className="flex gap-3 w-full">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="flex-1 border-white/10 hover:bg-white/5"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={() => {
                                onClose();
                                onConfirm();
                            }}
                            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                        >
                            <Play className="w-4 h-4 mr-2" />
                            Continuar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
