import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ShieldCheck } from "lucide-react";

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
            <Header />

            <main className="flex-1 pt-24 pb-12 px-4 md:px-8 max-w-4xl mx-auto w-full">
                <div className="flex items-center gap-3 mb-8">
                    <ShieldCheck className="w-8 h-8 text-primary" />
                    <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                        Política de Privacidade
                    </h1>
                </div>

                <div className="space-y-8 text-gray-300 leading-relaxed">
                    <section className="bg-zinc-900/30 border border-white/5 p-6 rounded-2xl backdrop-blur-sm">
                        <h2 className="text-xl font-semibold text-white mb-4">1. Coleta de Informações</h2>
                        <p>
                            Coletamos informações mínimas necessárias para fornecer e melhorar nosso serviço:
                        </p>
                        <ul className="list-disc pl-5 mt-2 space-y-2">
                            <li>Informações de conta (email, nome de usuário) fornecidas durante o registro.</li>
                            <li>Dados de uso e preferências (histórico de visualização, lista de favoritos) para personalizar sua experiência.</li>
                            <li>Informações técnicas (endereço IP, tipo de navegador) para segurança e análise de desempenho.</li>
                        </ul>
                    </section>

                    <section className="bg-zinc-900/30 border border-white/5 p-6 rounded-2xl backdrop-blur-sm">
                        <h2 className="text-xl font-semibold text-white mb-4">2. Uso das Informações</h2>
                        <p>
                            Utilizamos as informações coletadas para:
                        </p>
                        <ul className="list-disc pl-5 mt-2 space-y-2">
                            <li>Fornecer, operar e manter nosso serviço.</li>
                            <li>Melhorar, personalizar e expandir nossa plataforma.</li>
                            <li>Entender e analisar como você usa nosso serviço.</li>
                            <li>Prevenir fraudes e garantir a segurança da plataforma.</li>
                        </ul>
                    </section>

                    <section className="bg-zinc-900/30 border border-white/5 p-6 rounded-2xl backdrop-blur-sm">
                        <h2 className="text-xl font-semibold text-white mb-4">3. Cookies e Tecnologias Similares</h2>
                        <p>
                            Utilizamos cookies e tecnologias similares para rastrear a atividade em nosso serviço e reter certas informações. Você pode configurar seu navegador para recusar todos os cookies ou indicar quando um cookie está sendo enviado.
                        </p>
                    </section>

                    <section className="bg-zinc-900/30 border border-white/5 p-6 rounded-2xl backdrop-blur-sm">
                        <h2 className="text-xl font-semibold text-white mb-4">4. Compartilhamento de Dados</h2>
                        <p>
                            Não vendemos, trocamos ou transferimos suas informações pessoais para terceiros, exceto quando necessário para fornecer o serviço (ex: processamento de pagamentos) ou cumprimento da lei.
                        </p>
                    </section>

                    <section className="bg-zinc-900/30 border border-white/5 p-6 rounded-2xl backdrop-blur-sm">
                        <h2 className="text-xl font-semibold text-white mb-4">5. Segurança dos Dados</h2>
                        <p>
                            A segurança dos seus dados é importante para nós, mas lembre-se que nenhum método de transmissão pela Internet ou método de armazenamento eletrônico é 100% seguro. Embora nos esforcemos para usar meios comercialmente aceitáveis para proteger suas informações pessoais, não podemos garantir sua segurança absoluta.
                        </p>
                    </section>

                    <section className="bg-zinc-900/30 border border-white/5 p-6 rounded-2xl backdrop-blur-sm">
                        <h2 className="text-xl font-semibold text-white mb-4">6. Links para Outros Sites</h2>
                        <p>
                            Nosso serviço pode conter links para outros sites que não são operados por nós. Se você clicar em um link de terceiros, você será direcionado para o site desse terceiro. Aconselhamos fortemente que você reveja a Política de Privacidade de cada site que visita.
                        </p>
                    </section>
                </div>
            </main>

            <Footer />
        </div>
    );
}
