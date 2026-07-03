"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Validate: only accept relative paths to prevent open-redirect attacks.
  const raw = searchParams.get("callbackUrl") ?? "/";
  const callbackUrl = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Invalid credentials");
    } else {
      router.replace(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Zysteel HR</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin@zysteel.local"
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>
          {error && (
            <p id="login-error" className="text-sm text-rose-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-4 py-2 text-sm disabled:opacity-60 transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

// Suspense is required by Next.js 15 whenever useSearchParams() is used
// in a component that is not already wrapped at the page boundary.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
