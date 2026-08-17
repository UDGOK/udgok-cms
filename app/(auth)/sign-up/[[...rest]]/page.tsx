import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f1ea]">
      <SignUp
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-none border-2 border-[#1e2a3a]',
            formButtonPrimary:
              'bg-[#1e2a3a] hover:bg-[#f06a2d] text-sm font-bold tracking-wider uppercase',
            headerTitle: 'font-bold text-2xl',
            headerSubtitle: 'text-[#3a4256]',
            socialButtonsBlockButton:
              'border-2 border-[#1e2a3a] hover:bg-[#1e2a3a] hover:text-white',
            formFieldInput:
              'border-2 border-[#1e2a3a20] focus:border-[#1e2a3a]',
          },
        }}
      />
    </div>
  );
}
