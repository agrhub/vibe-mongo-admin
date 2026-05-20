export interface Store {
  connections: Record<string, any>;
  activeConnection: string;
  activeDb: string;
  activeColl: string;
  sidebarList: Record<string, any>;
  locales: Record<string, any>;
  activeLocale: string;
  loggedIn: boolean;
  passwordRequired: boolean;
  loading: boolean;
  theme: 'light' | 'dark' | 'system';
  t(key: string): string;
  fetchAuthStatus(): Promise<any>;
  login(password: string): Promise<{ success: boolean; msg?: string }>;
  logout(): Promise<{ success: boolean }>;
  fetchLocales(): Promise<void>;
  setLocale(locale: string): void;
  fetchConnections(): Promise<void>;
  fetchSidebar(): Promise<void>;
  setConnection(connName: string): void;
  setDatabase(dbName: string): void;
  setCollection(collName: string): void;
  initTheme(): void;
  setTheme(theme: 'light' | 'dark' | 'system'): void;
  applyTheme(): void;

  // New managed properties in Pinia
  databasesList: any[];
  collectionsList: any[];
  usersList: any[];
  backupsList: any[];
  serverInfo: any;
}

export declare const pinia: any;
export declare const useAppStore: () => any;
export declare const store: Store;
