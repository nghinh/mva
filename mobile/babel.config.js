module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './src',
            '@features': './src/features',
            '@services': './src/services',
            '@shared': './src/shared',
            '@app': './src/app',
            '@native': './src/native',
          },
        },
      ],
    ],
  };
};
