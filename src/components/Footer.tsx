import { Link } from 'react-router-dom';

export function Footer() {
    return (
        <footer className="w-full bg-black/40 border-t border-white/5 py-8 mt-auto backdrop-blur-sm">
            <div className="container mx-auto px-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-center md:text-left">
                        <h3 className="text-lg font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent mb-2">
                            UniTvFilm
                        </h3>
                        <p className="text-sm text-gray-400">
                            &copy; {new Date().getFullYear()} UniTvFilm. Todos os direitos reservados.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-6">
                        <Link
                            to="/about"
                            className="text-sm text-gray-400 hover:text-primary transition-colors text-center"
                        >
                            Sobre Nós
                        </Link>
                        <Link
                            to="/terms"
                            className="text-sm text-gray-400 hover:text-primary transition-colors text-center"
                        >
                            Termos de Uso
                        </Link>
                        <Link
                            to="/privacy"
                            className="text-sm text-gray-400 hover:text-primary transition-colors text-center"
                        >
                            Política de Privacidade
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
