import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rubenmay.menuapp',
  appName: 'Menu - Weekly Meal Planner',
  webDir: 'www',
  plugins: {
    Browser: {
      androidScheme: 'menuapp'
    }
  }
};

export default config;
