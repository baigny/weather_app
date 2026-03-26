import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabaseClient'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AdminGate({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [signupRole, setSignupRole] = useState('guest') // 'admin' | 'guest'
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [authInfo, setAuthInfo] = useState(null)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchRole(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchRole(session.user.id)
      else setRole(null)
    })
    return () => subscription?.unsubscribe()
  }, [])

  async function ensureProfile(uid) {
    if (!supabase) return
    // New profiles default to guest. Promote to admin in Supabase when needed (many admins allowed).
    await supabase
      .from('profiles')
      .upsert({ id: uid, role: 'guest' }, { onConflict: 'id' })
  }

  async function fetchRole(uid) {
    if (!supabase) return
    try {
      const { data, error } = await supabase.from('profiles').select('role').eq('id', uid).single()
      if (error) {
        await ensureProfile(uid)
        const { data: retry } = await supabase.from('profiles').select('role').eq('id', uid).single()
        setRole(retry?.role ?? 'guest')
      } else {
        setRole(data?.role ?? 'guest')
      }
    } catch {
      setRole('guest')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setAuthError(null)
    setAuthInfo(null)
    if (!supabase) {
      setAuthError('Supabase not configured')
      return
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setAuthError('Please enter a valid email address.')
      return
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.')
      return
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setAuthError('Passwords do not match.')
      return
    }
    setAuthLoading(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
        if (error) throw error
        if (data?.user) {
          // Create profile with chosen role (admin or guest) on first signup.
          await supabase
            .from('profiles')
            .upsert({ id: data.user.id, role: signupRole }, { onConflict: 'id' })
        }
        // Force explicit sign-in after email confirmation
        await supabase.auth.signOut()
        setMode('signin')
        setPassword('')
        setConfirmPassword('')
        setAuthInfo('Sign up successful. Check your email to confirm, then sign in with this form.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error
      }
    } catch (err) {
      const msg = err?.message || 'Authentication failed.'
      if (
        msg === 'Failed to fetch' ||
        err?.name === 'TypeError'
      ) {
        setAuthError(
          'Cannot reach Supabase. Check VITE_SUPABASE_URL and your network/DNS (ERR_NAME_NOT_RESOLVED).'
        )
      } else {
        setAuthError(msg)
      }
    } finally {
      setAuthLoading(false)
    }
  }

  async function signOut() {
    await supabase?.auth.signOut()
  }

  if (loading || (user && role === null)) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-500">{user ? 'Checking access…' : 'Loading…'}</p>
      </div>
    )
  }

  if (!supabase) {
    return (
      <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
        <p>Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-1 text-center">
            Admin access
          </h2>
          <p className="text-sm text-gray-500 mb-6 text-center">
            Sign in to manage masjids, iqamah times, and images.
          </p>

          <div className="flex mb-4 rounded-full bg-gray-100 p-1 text-sm">
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                setAuthError(null)
                setAuthInfo(null)
                setConfirmPassword('')
              }}
              className={`flex-1 py-1.5 rounded-full font-medium ${
                mode === 'signin' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              } cursor-pointer`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setAuthError(null)
                setAuthInfo(null)
              }}
              className={`flex-1 py-1.5 rounded-full font-medium ${
                mode === 'signup' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              } cursor-pointer`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border rounded-lg text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 cursor-pointer"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 5.1A10.6 10.6 0 0 1 12 5c7 0 10 7 10 7a18.5 18.5 0 0 1-3.1 4.2" />
                      <path d="M6.6 6.6A18.5 18.5 0 0 0 2 12s3 7 10 7a10.8 10.8 0 0 0 4-.8" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Hint: Use 8+ characters with a mix of letters, numbers, and symbols.
              </p>
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border rounded-lg text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 cursor-pointer"
                  >
                    {showConfirmPassword ? (
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.9 5.1A10.6 10.6 0 0 1 12 5c7 0 10 7 10 7a18.5 18.5 0 0 1-3.1 4.2" />
                        <path d="M6.6 6.6A18.5 18.5 0 0 0 2 12s3 7 10 7a10.8 10.8 0 0 0 4-.8" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <div className="flex gap-3 text-sm">
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="signup-role"
                      value="guest"
                      checked={signupRole === 'guest'}
                      onChange={() => setSignupRole('guest')}
                    />
                    <span>Guest (view only)</span>
                  </label>
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="signup-role"
                      value="admin"
                      checked={signupRole === 'admin'}
                      onChange={() => setSignupRole('admin')}
                    />
                    <span>Admin (full access)</span>
                  </label>
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  Choose <span className="font-semibold text-gray-600">Admin</span> only for trusted accounts; guests can still use the app but cannot change masjid data.
                </p>
              </div>
            )}

            {authError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                {authError}
              </p>
            )}
            {authInfo && (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2">
                {authInfo}
              </p>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full mt-1 inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {authLoading ? (mode === 'signup' ? 'Creating account…' : 'Signing in…') : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>

            <p className="text-[11px] text-gray-400 text-center mt-2">
              By continuing, you agree to the admin access rules for this app.
            </p>
          </form>
        </div>
      </div>
    )
  }

  if (role !== 'admin') {
    return (
      <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
        <p className="font-medium">Access denied. Admin role required.</p>
        <p className="mt-1 text-sm text-red-700">
          To grant admin access: in Supabase Table Editor open <code className="bg-red-100 px-1 rounded">public.profiles</code>, set <code className="bg-red-100 px-1 rounded">role</code> to <code className="bg-red-100 px-1 rounded">admin</code> for your user (or run SQL: <code className="bg-red-100 px-1 rounded text-xs">update public.profiles set role = 'admin' where id = 'your-uuid';</code>). Multiple admins are supported.
        </p>
        <button onClick={signOut} className="mt-3 text-sm underline cursor-pointer">Sign out</button>
      </div>
    )
  }

  // Admin: just render children; header (email + sign out) is handled in the page layout.
  return children
}
