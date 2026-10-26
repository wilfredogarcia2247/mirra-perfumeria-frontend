import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { loadGoogleAdsTag } from '@/lib/google-ads';

export default function PublicSite() {
  useEffect(() => {
    if (!import.meta.env.DEV) void loadGoogleAdsTag();
  }, []);

  return <Outlet />;
}
