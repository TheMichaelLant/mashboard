/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Global Clerk object
declare global {
  interface Window {
    Clerk?: {
      signOut: () => Promise<void>;
    };
  }
}
