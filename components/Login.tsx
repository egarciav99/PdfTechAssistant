
import React, { useState } from 'react';
import { signInWithEmailAndPassword, auth } from '../services/firebase';
import { FileTextIcon } from './IconComponents';

interface LoginProps {
  onSwitchToRegister: () => void;
}

const Login: React.FC<LoginProps> = ({ onSwitchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!email || !password) {
      setError("Please fill in both fields.");
      setIsLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // On successful login, onAuthStateChanged in App.tsx will handle the redirect.
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
      <div className="text-center">
        <div className="flex justify-center items-center gap-3">
          <FileTextIcon className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-800">Sign In</h1>
        </div>
        <p className="mt-2 text-gray-500">Access your PDF assistant</p>
      </div>
      <form onSubmit={handleLogin} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password"className="block text-sm font-medium text-gray-700">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="••••••••"
          />
        </div>
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </div>
      </form>
      <p className="text-center text-sm text-gray-500">
        Don't have an account?{' '}
        <button onClick={onSwitchToRegister} className="font-medium text-blue-600 hover:text-blue-500">
          Sign up
        </button>
      </p>
    </div>
  );
};

export default Login;
