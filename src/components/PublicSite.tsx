import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { loadGoogleAdsTag } from '@/lib/google-ads';

export default function PublicSite() {
  useEffect(() => {
    void loadGoogleAdsTag();
  }, []);

  return <Outlet />;
}
