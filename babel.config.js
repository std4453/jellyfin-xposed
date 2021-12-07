module.exports = {
    babelrcRoots: [
        // Keep the root as a root
        '.'
    ],
    sourceType: 'unambiguous',
    presets: [
        [
            '@babel/preset-env',
            {
                useBuiltIns: 'usage',
                corejs: 3
            }
        ]
    ],
    plugins: [
        '@babel/plugin-proposal-class-properties',
        '@babel/plugin-proposal-private-methods',
        'babel-plugin-dynamic-import-polyfill',
        [require('./babel-plugin-xposed'), {
            exposeRoot: 'Xp',
            sourceRoot: require('path').resolve('./src/components'),
            // A traversal of the current version shows that there's no
            // export/file named 'x' or '_', so it should be safe to use it
            namedPath: 'x',
            defaultPath: '_',
            // Jellyfin like to name files like foo/foo.js, in which case we
            // remove the latter part
            eliminateDuplicate: true,
            logMapping: true,
            // use our bundled dset since older jellyfin versions don't package lodash-es
            lodashSetPackage: './src/dset',
        }]
    ]
};
