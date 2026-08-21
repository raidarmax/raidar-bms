module.exports = {
  project: {
    android: {
      sourceDir: './android',
    },
    ios: {
      sourceDir: './ios',
    },
  },
  assets: ['./node_modules/react-native-vector-icons/Fonts'],
  dependencies: {
    expo: {
      platforms: {
        android: null,
        ios: null,
      },
    },
    'expo-modules-core': {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
