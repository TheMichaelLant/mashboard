import { useState, useEffect, useCallback } from 'react';
import { bookmarkApi, appreciationApi } from '../services/api';
import type { Post } from '../types';

export function useArchives() {
  const [archives, setArchives] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArchives = async () => {
      setLoading(true);
      try {
        const data = await bookmarkApi.getMyArchives();
        setArchives(data);
      } catch (error) {
        console.error('Failed to fetch archives:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchArchives();
  }, []);

  const removeArchive = useCallback(async (bookId: number) => {
    try {
      await bookmarkApi.unarchive(bookId);
      setArchives((prev) => prev.filter((p) => p.id !== bookId));
    } catch (error) {
      console.error('Failed to remove archive:', error);
    }
  }, []);

  const toggleAppreciation = useCallback(async (postId: number) => {
    try {
      const post = archives.find((p) => p.id === postId);
      if (post?.isAppreciated) {
        await appreciationApi.unappreciate(postId);
      } else {
        await appreciationApi.appreciate(postId);
      }
      setArchives((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                isAppreciated: !p.isAppreciated,
                appreciationCount: p.isAppreciated
                  ? (p.appreciationCount || 1) - 1
                  : (p.appreciationCount || 0) + 1,
              }
            : p
        )
      );
    } catch (error) {
      console.error('Failed to toggle appreciation:', error);
    }
  }, [archives]);

  return {
    archives,
    loading,
    removeArchive,
    toggleAppreciation,
  };
}
