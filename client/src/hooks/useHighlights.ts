import { useState, useEffect, useCallback } from 'react';
import { highlightApi } from '../services/api';
import type { Highlight } from '../types';

export function useHighlights() {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHighlights = async () => {
      setLoading(true);
      try {
        const data = await highlightApi.getMyHighlights();
        setHighlights(data);
      } catch (error) {
        console.error('Failed to fetch highlights:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchHighlights();
  }, []);

  const removeHighlight = useCallback(async (highlightId: number) => {
    try {
      await highlightApi.delete(highlightId);
      setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
    } catch (error) {
      console.error('Failed to remove highlight:', error);
    }
  }, []);

  return {
    highlights,
    loading,
    removeHighlight,
  };
}
