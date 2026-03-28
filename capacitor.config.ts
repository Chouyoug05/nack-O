import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nack.app',
  appName: 'NACK',
  webDir: 'dist',
  server: {
    // En dev, décommenter et mettre ton IP pour live reload sur appareil
    // url: 'http://192.168.1.xxx:8080',
    // cleartext: true,
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
