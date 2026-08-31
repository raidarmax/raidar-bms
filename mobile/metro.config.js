const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    extraNodeModules: {
      crypto: path.resolve(__dirname, 'shims/crypto.js'),
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
