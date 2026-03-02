import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.nestify.app",
  appName: "Nestify",
  webDir: "build",
  android: {
    buildOptions: {
      keystorePath: undefined,
      releaseType: "APK",
    },
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
