import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rubenmay.mealplanner',
  appName: 'Meal Planner',
  webDir: 'www',
  plugins: {
    Browser: {
      androidScheme: 'mealplanner'
    }
  }
};

export default config;
