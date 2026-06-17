module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@app': './src/app',
            '@domain': './src/domain',
            '@infra': './src/infra',
            '@shared': './src/shared',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
