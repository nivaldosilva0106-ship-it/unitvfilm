-- Tabela para guardar os logs históricos de atividade dos utilizadores
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    page_name TEXT NOT NULL,
    device_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Política de RLS: Admins podem ler tudo (substitua a verificação de admin conforme o seu sistema atual)
-- Para simplificar, pode deixar apenas leitura para autenticados se não tiver roles estritos de momento.
CREATE POLICY "Enable insert for authenticated users only"
ON public.activity_logs
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable select for everyone"
ON public.activity_logs
FOR SELECT TO authenticated
USING (true);

-- Criar um index para optimizar consultas de datas (Dia, Semana, Mês, Ano)
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_page_name ON public.activity_logs (page_name);
