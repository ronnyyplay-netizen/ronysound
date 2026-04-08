import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const AuthDialog = () => {
  const { user, signIn, signUp, signOut, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (mode: 'login' | 'signup') => {
    if (!email || !password) return toast.error('Preencha todos os campos');
    setSubmitting(true);
    const fn = mode === 'login' ? signIn : signUp;
    const { error } = await fn(email, password);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    if (mode === 'signup') {
      toast.success('Conta criada! Verifique seu e-mail para confirmar.');
    } else {
      toast.success('Login realizado!');
      setOpen(false);
    }
  };

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground truncate max-w-[120px]">{user.email}</span>
        <button onClick={signOut} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Sair">
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
          <LogIn className="w-3.5 h-3.5" />
          Entrar
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><User className="w-4 h-4" /> Conta RONY SOUND</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="login">
          <TabsList className="w-full">
            <TabsTrigger value="login" className="flex-1">Entrar</TabsTrigger>
            <TabsTrigger value="signup" className="flex-1">Criar Conta</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="space-y-3 mt-3">
            <div className="space-y-1"><Label>E-mail</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div className="space-y-1"><Label>Senha</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit('login')} /></div>
            <Button className="w-full" disabled={submitting} onClick={() => handleSubmit('login')}>Entrar</Button>
          </TabsContent>
          <TabsContent value="signup" className="space-y-3 mt-3">
            <div className="space-y-1"><Label>E-mail</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div className="space-y-1"><Label>Senha</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit('signup')} /></div>
            <Button className="w-full" disabled={submitting} onClick={() => handleSubmit('signup')}>Criar Conta</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AuthDialog;
