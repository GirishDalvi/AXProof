import React, { useState, useRef } from 'react';
import { Button } from './ui/Button';
import { useAXProof } from '../context/ZflowContext';
import { Camera, X } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, signup, loginWithGoogle } = useAXProof();
  const [isLogin, setIsLogin] = useState(true);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfilePhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
        if (isLogin) {
            await login(email, password);
        } else {
            if (!name) { throw new Error('Name is required'); }
            if (password !== confirmPassword) { throw new Error('Passwords do not match'); }
            await signup(email, password, name, profilePhoto || undefined);
        }
    } catch (err: any) {
        setError(err.message || 'An error occurred');
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
             <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-2xl">A</span>
             </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-text-primary">
          {isLogin ? 'Sign in to your account' : 'Create a new account'}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-border-color">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {!isLogin && (
                <>
                <div className="flex flex-col items-center mb-6">
                    <div 
                        className="relative w-24 h-24 rounded-full bg-background flex items-center justify-center overflow-hidden border-2 border-dashed border-border-color hover:border-brand-500 transition-colors cursor-pointer group"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {photoPreview ? (
                            <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                            <Camera className="w-8 h-8 text-text-secondary group-hover:text-brand-500" />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="text-white text-xs font-medium">Change</span>
                        </div>
                    </div>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        className="hidden" 
                        accept="image/*"
                    />
                    <span className="mt-2 text-xs text-text-secondary">Profile Photo (Optional)</span>
                </div>

                <div>
                    <label className="block text-sm font-medium text-text-primary">Full Name</label>
                    <div className="mt-1">
                        <input
                        type="text"
                        required={!isLogin}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="appearance-none block w-full px-3 py-2 border border-border-color rounded-md shadow-sm placeholder-text-secondary/50 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm bg-background text-text-primary"
                        placeholder="John Doe"
                        />
                    </div>
                </div>
                </>
            )}

            <div>
              <label className="block text-sm font-medium text-text-primary">Email address</label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-border-color rounded-md shadow-sm placeholder-text-secondary/50 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm bg-background text-text-primary"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary">Password</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-border-color rounded-md shadow-sm placeholder-text-secondary/50 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm bg-background text-text-primary"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {!isLogin && (
                <div>
                    <label className="block text-sm font-medium text-text-primary">Repeat Password</label>
                    <div className="mt-1">
                        <input
                        type="password"
                        required={!isLogin}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="appearance-none block w-full px-3 py-2 border border-border-color rounded-md shadow-sm placeholder-text-secondary/50 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm bg-background text-text-primary"
                        placeholder="••••••••"
                        />
                    </div>
                </div>
            )}
            
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <X className="h-4 w-4 text-red-400" aria-hidden="true" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            <div>
              <Button type="submit" className="w-full flex justify-center py-2.5" disabled={isLoading}>
                {isLoading ? (
                    <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                    </span>
                ) : (isLogin ? 'Sign in' : 'Sign up')}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border-color" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-surface text-text-secondary">Or continue with</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={async () => {
                  setError('');
                  setIsLoading(true);
                  try {
                    await loginWithGoogle();
                  } catch (err: any) {
                    setError(err.message || 'Google login failed');
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-3 py-2.5 px-4 border border-border-color rounded-md shadow-sm bg-background text-sm font-medium text-text-primary hover:bg-brand-50/50 dark:hover:bg-brand-900/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors disabled:opacity-50"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <span>Google</span>
              </button>
            </div>

            <div className="mt-6 text-center">
               <button 
                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                className="text-brand-600 hover:text-brand-500 font-medium transition-colors"
               >
                 {isLogin ? 'Create new account' : 'Already have an account? Sign in'}
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
