import { createContext, useContext, useState, ReactNode } from 'react';

interface HighlightDisplayContextType {
  showContext: boolean;
  toggleShowContext: () => void;
}

const HighlightDisplayContext = createContext<HighlightDisplayContextType | undefined>(undefined);

export function HighlightDisplayProvider({ children }: { children: ReactNode }) {
  const [showContext, setShowContext] = useState(true);

  const toggleShowContext = () => setShowContext((prev) => !prev);

  return (
    <HighlightDisplayContext.Provider value={{ showContext, toggleShowContext }}>
      {children}
    </HighlightDisplayContext.Provider>
  );
}

export function useHighlightDisplay() {
  const context = useContext(HighlightDisplayContext);
  if (!context) {
    throw new Error('useHighlightDisplay must be used within a HighlightDisplayProvider');
  }
  return context;
}
