import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.idene.app',
  appName: 'Idene',
  webDir: 'www',
  server: {
    url: 'https://kin-mocha.vercel.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: false,
  },
}

export default config
