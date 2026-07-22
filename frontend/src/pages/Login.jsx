export default function Login() {
  function handleGoogleLogin() {
    window.location.href = 'https://api.brohsop.in/api/auth/google'
  }

  return (
    <div className="relative flex-1 h-full w-full overflow-hidden grid-bg flex flex-col items-center justify-center">
      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(124,58,237,0.15),transparent)] pointer-events-none" />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 flex items-center px-8 py-5 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-forge-purple to-forge-indigo flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4l5-3 5 3v8l-5 3-5-3V4z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M7 1v14M2 4l5 3 5-3" stroke="white" strokeWidth="1" strokeLinejoin="round" opacity="0.6"/>
            </svg>
          </div>
          <span className="font-semibold text-forge-text text-sm tracking-wide">CodeForge</span>
        </div>
      </header>

      {/* Login card */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm w-full">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-forge-panel border border-forge-border text-xs text-forge-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-forge-green animate-pulse" />
          AI-Powered Cloud IDE
        </div>

        <h1 className="text-4xl font-bold leading-tight mb-3 tracking-tight">
          <span className="gradient-text">Welcome Back</span>
        </h1>
        <p className="text-forge-muted text-sm leading-relaxed mb-10">
          Sign in to access your cloud sandbox environment.
        </p>

        {/* Card */}
        <div className="w-full glass rounded-2xl p-8 flex flex-col gap-4">
          <button
            id="google-login-btn"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl font-medium text-forge-text text-sm
              bg-forge-card border border-forge-border
              hover:border-forge-purple/50 hover:bg-forge-card/80
              transition-all duration-200 active:scale-[0.98]"
          >
            {/* Google icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 text-xs text-forge-muted">
            <div className="flex-1 h-px bg-forge-border" />
            <span>Secure OAuth 2.0</span>
            <div className="flex-1 h-px bg-forge-border" />
          </div>

          <p className="text-xs text-forge-muted leading-relaxed">
            By continuing, you agree to our{' '}
            <a href="#" className="text-forge-purple hover:text-forge-indigo transition-colors">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-forge-purple hover:text-forge-indigo transition-colors">Privacy Policy</a>.
          </p>
        </div>

        {/* Features */}
        <div className="mt-10 grid grid-cols-3 gap-3 w-full">
          {[
            { icon: '⚡', label: 'Instant Sandbox' },
            { icon: '🤖', label: 'AI Assistant' },
            { icon: '👁', label: 'Live Preview' },
          ].map(({ icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-forge-panel border border-forge-border">
              <span className="text-xl">{icon}</span>
              <span className="text-xs text-forge-muted font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
