const { withGradleProperties } = require('expo/config-plugins');

/**
 * Release builds of RN 0.81 + Expo 54 exhaust Gradle's default 512 MB metaspace. This raises it, and builds only the
 * ABIs real phones use (drops 32-bit and emulator ABIs) to keep the build small.
 */
module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    const set = (key, value) => {
      cfg.modResults = cfg.modResults.filter((p) => !(p.type === 'property' && p.key === key));
      cfg.modResults.push({ type: 'property', key, value });
    };
    set('org.gradle.jvmargs', '-Xmx4096m -XX:MaxMetaspaceSize=1536m');
    set('reactNativeArchitectures', 'arm64-v8a');
    return cfg;
  });
};
