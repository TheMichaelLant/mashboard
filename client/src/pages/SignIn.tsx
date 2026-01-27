import { SignIn } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-paper-50 flex flex-col items-center justify-center p-4">
      <Link to="/" className="mb-8">
        <span className="text-3xl font-display font-bold text-ink-900">
          Mashboard
        </span>
      </Link>
      <SignIn
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-lg',
          },
        }}
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        afterSignInUrl="/feed"
      />
    </div>
  );
}
