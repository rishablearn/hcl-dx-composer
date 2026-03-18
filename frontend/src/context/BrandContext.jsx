import { createContext, useContext, useState, useEffect } from 'react';
import { configApi } from '../services/api';

const BrandContext = createContext(null);

const defaultBrand = {
  appName: 'DX Composer',
  appSubtitle: '',
  logoUrl: '',
  primaryColor: '#FFCD00',
  sidebarColor: '#1E3A5F',
  accentColor: '#0A6ED1',
};

export function BrandProvider({ children }) {
  const [brand, setBrand] = useState(defaultBrand);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadBrand();
  }, []);

  const loadBrand = async () => {
    try {
      const response = await configApi.getConfigValue('whitelabel');
      if (response.data?.config_value) {
        const saved = typeof response.data.config_value === 'string'
          ? JSON.parse(response.data.config_value)
          : response.data.config_value;
        setBrand(prev => ({ ...prev, ...saved }));
      }
    } catch {
      // Config not found or not authenticated yet — use defaults
    } finally {
      setLoaded(true);
    }
  };

  const updateBrand = async (newBrand) => {
    const merged = { ...brand, ...newBrand };
    setBrand(merged);
    try {
      await configApi.updateConfigValue('whitelabel', merged, 'Whitelabel branding settings');
    } catch (err) {
      console.error('Failed to save brand settings:', err);
      throw err;
    }
  };

  return (
    <BrandContext.Provider value={{ brand, updateBrand, loaded, reload: loadBrand }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const ctx = useContext(BrandContext);
  if (!ctx) {
    return { brand: defaultBrand, updateBrand: () => {}, loaded: true, reload: () => {} };
  }
  return ctx;
}
