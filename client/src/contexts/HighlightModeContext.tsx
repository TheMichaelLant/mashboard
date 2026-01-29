import { createContext, useContext, useState, ReactNode } from 'react';

interface HighlightModeContextType {
  isHighlightMode: boolean;
  setHighlightMode: (mode: boolean) => void;
  toggleHighlightMode: () => void;
}

const HighlightModeContext = createContext<HighlightModeContextType | undefined>(undefined);

export function HighlightModeProvider({ children }: { children: ReactNode }) {
  const [isHighlightMode, setIsHighlightMode] = useState(false);

  const setHighlightMode = (mode: boolean) => {
    setIsHighlightMode(mode);
  };

  const toggleHighlightMode = () => {
    setIsHighlightMode((prev) => !prev);
  };

  return (
    <HighlightModeContext.Provider
      value={{ isHighlightMode, setHighlightMode, toggleHighlightMode }}
    >
      {children}
    </HighlightModeContext.Provider>
  );
}

export function useHighlightMode() {
  const context = useContext(HighlightModeContext);
  if (context === undefined) {
    throw new Error('useHighlightMode must be used within a HighlightModeProvider');
  }
  return context;
}
