export {};

declare global {
  interface Window {
    bandosDesktop?: {
      isDesktop: true;
      restoreBackup(passphrase: string): Promise<{ canceled?: boolean; scheduled?: boolean; error?: string }>;
      emailCredentialStatus(): Promise<{ available: boolean; stored: boolean }>;
      storeEmailCredential(password: string): Promise<{ stored?: boolean; restartRequired?: boolean; error?: string }>;
      clearEmailCredential(): Promise<{ cleared?: boolean; restartRequired?: boolean }>;
      restart(): Promise<{ restarting: boolean }>;
    };
  }
}
