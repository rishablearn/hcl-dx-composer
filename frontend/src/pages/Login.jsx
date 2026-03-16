import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import BPCLIcon from '../assets/bpcl-icon.svg';
import BPCLLogo from '../assets/bpcl-logo-full.svg';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast.error('Please enter username and password');
      return;
    }

    setLoading(true);
    try {
      await login(username, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - BPCL Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-secondary-600 via-secondary-500 to-secondary-700 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-primary-500/20 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary-500/10 rounded-full translate-x-1/4 translate-y-1/4" />
          <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>
        
        <div className="relative flex flex-col items-center justify-center w-full p-12 text-center">
          {/* BPCL Logo */}
          <img 
            src={BPCLLogo} 
            alt="Bharat Petroleum" 
            className="h-24 mb-8 drop-shadow-lg"
          />
          
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              DX Composer
            </h1>
            <p className="text-lg text-primary-200">
              Digital Asset & Content Management
            </p>
          </div>
          
          <p className="text-sm text-white/70 max-w-md">
            Streamline your content workflows with our integrated DAM and WCM solution powered by HCL Digital Experience
          </p>
          
          <div className="absolute bottom-8 left-0 right-0 text-center">
            <p className="text-xs text-white/50">
              <span className="text-primary-300 font-semibold">Energising Lives</span> • A Bharat Petroleum Initiative
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-neutral-150">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex flex-col items-center justify-center gap-3 mb-8 lg:hidden">
            <img 
              src={BPCLIcon} 
              alt="BPCL" 
              className="w-16 h-16"
            />
            <div className="text-center">
              <span className="text-2xl font-bold text-secondary-600">DX Composer</span>
              <p className="text-sm text-neutral-500">Bharat Petroleum</p>
            </div>
          </div>

          <div className="card p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-navy-800">Welcome back</h2>
              <p className="text-neutral-500 mt-2">Sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-navy-800 mb-2">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="input-field"
                  disabled={loading}
                  autoComplete="username"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-navy-800 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="input-field pr-12"
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full h-12 text-base"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-neutral-500">
              Use your Active Directory credentials to sign in
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
