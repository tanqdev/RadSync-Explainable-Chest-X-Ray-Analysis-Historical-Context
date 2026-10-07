import { createContext, useContext, useState, type ReactNode } from 'react';
import { analyses, type AnalysisCase } from '@/lib/mockData';
interface AnalysisState { cases: AnalysisCase[]; addCase: (item: AnalysisCase) => void }
const AnalysisContext = createContext<AnalysisState | undefined>(undefined);
export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState(analyses);
  return <AnalysisContext.Provider value={{ cases, addCase: (item) => setCases((current) => [item, ...current]) }}>{children}</AnalysisContext.Provider>;
}
export function useAnalyses() { const value = useContext(AnalysisContext); if (!value) throw new Error('AnalysisProvider is required'); return value; }
