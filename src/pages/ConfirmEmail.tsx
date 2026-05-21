import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InstallAppButton } from '@/components/InstallAppButton';

const ConfirmEmail = () => {
  const [bgUrl, setBgUrl] = useState('/login-bg.jpg');

  useEffect(() => {
    import('@/lib/firebase').then(({ getSiteSettings }) => {
      getSiteSettings().then(settings => {
        if (settings.loginBackgroundUrl) {
          setBgUrl(settings.loginBackgroundUrl);
        }
      });
    });
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${bgUrl}")` }}
      />
      <div className="absolute inset-0 z-10 bg-[#022c22]/90" />

      <div className="w-full max-w-md relative z-20 mt-12 sm:mt-0 text-center">
        <div className="absolute -top-12 right-0 sm:top-0 sm:right-[-40px]">
          <InstallAppButton variant="icon" />
        </div>
        
        <div className="bg-card/80 backdrop-blur border border-border/50 rounded-xl p-8 shadow-2xl flex flex-col items-center">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6">
            <Mail className="w-10 h-10 text-primary" />
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            Confirme o seu <span className="text-primary">E-mail</span>
          </h1>
          
          <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
            Enviámos um link de confirmação para o seu e-mail. Por favor, verifique a sua caixa de entrada (ou pasta de spam) e clique no link para ativar a sua conta antes de fazer o login.
          </p>

          <Link to="/login" className="w-full">
            <Button className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25 flex items-center justify-center gap-2">
              Ir para o Login
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ConfirmEmail;
