import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ScrollText } from "lucide-react";

export default function TermsOfUse() {
    return (
        <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
            <Header />

            <main className="flex-1 pt-24 pb-12 px-4 md:px-8 max-w-4xl mx-auto w-full">
                <div className="flex items-center gap-3 mb-8">
                    <ScrollText className="w-8 h-8 text-primary" />
                    <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                        Termos de Uso
                    </h1>
                </div>

                <div className="space-y-8 text-gray-300 leading-relaxed">
                    <section className="bg-zinc-900/30 border border-white/5 p-6 rounded-2xl backdrop-blur-sm">
                        <h2 className="text-xl font-semibold text-white mb-4">1. Aceitação dos Termos</h2>
                        <p>
                            Ao acessar e usar o UniTvFilm, você concorda em cumprir e ficar vinculado aos seguintes termos e condições de uso. Se você não concordar com estes termos, por favor, não use nosso serviço.
                        </p>
                    </section>

                    <section className="bg-zinc-900/30 border border-white/5 p-6 rounded-2xl backdrop-blur-sm">
                        <h2 className="text-xl font-semibold text-white mb-4">2. Natureza do Serviço</h2>
                        <p>
                            O UniTvFilm é uma plataforma de indexação de conteúdo. Não hospedamos arquivos de vídeo em nossos servidores. Todo o conteúdo é fornecido por terceiros e indexado automaticamente ou manualmente. O UniTvFilm atua apenas como um catálogo organizado.
                        </p>
                    </section>

                    <section className="bg-zinc-900/30 border border-white/5 p-6 rounded-2xl backdrop-blur-sm">
                        <h2 className="text-xl font-semibold text-white mb-4">3. Uso do Conteúdo</h2>
                        <p>
                            Você concorda em usar o serviço apenas para fins pessoais e não comerciais. Você não deve:
                        </p>
                        <ul className="list-disc pl-5 mt-2 space-y-2">
                            <li>Copiar, distribuir ou divulgar qualquer parte do serviço sem autorização.</li>
                            <li>Tentar contornar, desativar ou interferir nos recursos de segurança do site.</li>
                            <li>Usar sistemas automatizados para acessar o serviço de forma abusiva.</li>
                        </ul>
                    </section>

                    <section className="bg-zinc-900/30 border border-white/5 p-6 rounded-2xl backdrop-blur-sm">
                        <h2 className="text-xl font-semibold text-white mb-4">4. Propriedade Intelectual</h2>
                        <p>
                            Respeitamos os direitos de propriedade intelectual de terceiros. Se você acredita que seu conteúdo foi copiado de forma que constitua violação de direitos autorais, entre em contato conosco conforme descrito em nossa política de DMCA.
                        </p>
                    </section>

                    <section className="bg-zinc-900/30 border border-white/5 p-6 rounded-2xl backdrop-blur-sm">
                        <h2 className="text-xl font-semibold text-white mb-4">5. Limitação de Responsabilidade</h2>
                        <p>
                            O UniTvFilm não se responsabiliza pela disponibilidade, conteúdo ou precisão de sites ou serviços de terceiros vinculados a partir de nossa plataforma. O uso de tais serviços é de sua inteira responsabilidade.
                        </p>
                    </section>

                    <section className="bg-zinc-900/30 border border-white/5 p-6 rounded-2xl backdrop-blur-sm">
                        <h2 className="text-xl font-semibold text-white mb-4">6. Alterações nos Termos</h2>
                        <p>
                            Reservamo-nos o direito de modificar estes termos a qualquer momento. Alterações entrarão em vigor imediatamente após a publicação. Seu uso continuado do serviço após tais alterações constitui sua aceitação dos novos termos.
                        </p>
                    </section>
                </div>
            </main>

            <Footer />
        </div>
    );
}
