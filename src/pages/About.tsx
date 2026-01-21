import React from "react";
import { Header } from '../components/Header';
import { Footer } from '@/components/Footer';
import { Shield, Server, FileText, Youtube, Mail, ExternalLink } from 'lucide-react';

export default function About() {
    return (
        <div className="min-h-screen bg-[#141414] text-gray-100 font-sans">
            <Header />

            <main className="pt-24 pb-12 px-4 md:px-8 max-w-4xl mx-auto">
                <h1 className="text-3xl md:text-5xl font-bold mb-8 text-center bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                    Sobre Nós
                </h1>

                <div className="space-y-8">

                    {/* Card 1: Não Hospedagem */}
                    <div className="bg-zinc-900/50 border border-white/10 p-6 md:p-8 rounded-2xl backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <Server className="w-8 h-8 text-primary" />
                            <h2 className="text-xl md:text-2xl font-semibold">Hospedagem de Conteúdo</h2>
                        </div>
                        <p className="text-gray-300 leading-relaxed">
                            O UniTvFilm <strong>não hospeda</strong> nenhum vídeo em seus servidores. Todo o conteúdo encontrado neste site (filmes, séries, animes, etc.) é indexado a partir de fontes externas disponíveis publicamente na internet. Não fazemos upload de vídeos; apenas organizamos e indexamos links que já estão na rede.
                        </p>
                    </div>

                    {/* Card 2: Pirataria e Direitos */}
                    <div className="bg-zinc-900/50 border border-white/10 p-6 md:p-8 rounded-2xl backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <Shield className="w-8 h-8 text-blue-500" />
                            <h2 className="text-xl md:text-2xl font-semibold">Direitos Autorais e DMCA</h2>
                        </div>
                        <p className="text-gray-300 leading-relaxed mb-4">
                            Respeitamos rigorosamente os direitos autorais e as leis de propriedade intelectual. O UniTvFilm atua apenas como um motor de busca de indexação de vídeos.
                        </p>
                        <p className="text-gray-300 leading-relaxed">
                            Se você é o detentor dos direitos autorais de qualquer conteúdo indexado aqui e deseja removê-lo, entre em contato conosco imediatamente. Após verificação da titularidade, removeremos os links indexados de nossa plataforma.
                        </p>
                    </div>

                    {/* Card 3: NostalgiaTube */}
                    <div className="bg-zinc-900/50 border border-white/10 p-6 md:p-8 rounded-2xl backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <Youtube className="w-8 h-8 text-red-500" />
                            <h2 className="text-xl md:text-2xl font-semibold">NostalgiaTube</h2>
                        </div>
                        <p className="text-gray-300 leading-relaxed">
                            Os conteúdos presentes na seção <strong>NostalgiaTube</strong> são provenientes diretamente da plataforma YouTube. Não hospedamos, editamos ou temos controle sobre esses vídeos. Eles são exibidos utilizando a tecnologia de indexação pública (embed) fornecida pelo próprio YouTube, respeitando os termos de serviço da plataforma.
                        </p>
                    </div>

                    {/* Card 4: Missão */}
                    <div className="bg-zinc-900/50 border border-white/10 p-6 md:p-8 rounded-2xl backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <FileText className="w-8 h-8 text-green-500" />
                            <h2 className="text-xl md:text-2xl font-semibold">Nossa Missão</h2>
                        </div>
                        <p className="text-gray-300 leading-relaxed">
                            Nosso objetivo é fornecer uma interface organizada e moderna para facilitar o acesso à cultura e entretenimento, atuando meramente como um catálogo virtual de conteúdos disponíveis na web.
                        </p>
                    </div>

                    {/* Card 5: Contato */}
                    <div className="bg-zinc-900/50 border border-white/10 p-6 md:p-8 rounded-2xl backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <Mail className="w-8 h-8 text-purple-500" />
                            <h2 className="text-xl md:text-2xl font-semibold">Contato</h2>
                        </div>
                        <p className="text-gray-300 leading-relaxed mb-4">
                            Para questões relacionadas com direitos autorais, solicitações de remoção (DMCA), ou qualquer outra dúvida, entre em contato conosco através do email abaixo.
                        </p>
                        <a
                            href="mailto:contato@unitvfilm.com"
                            className="inline-flex items-center gap-2 text-primary hover:underline"
                        >
                            <Mail className="w-4 h-4" />
                            contato@unitvfilm.com
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>

                </div>

            </main>
            <Footer />
        </div>
    );
}
