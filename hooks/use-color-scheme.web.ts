import { useThemeMode } from '@/contexts/theme-context';

export function useColorScheme(): 'light' | 'dark' {
  const { theme } = useThemeMode();
  return theme;
}
