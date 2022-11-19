module.exports = {
    mode: "production",
    target: "node",
    
    optimization: {
        minimize: false //unfortunately mysqljs requires this
    },

    entry: "./src/main.ts",
    output: {
        path: __dirname + "/dist",
        filename: "bundle.js",
    },
    
    resolve: {
        // Add '.ts' and '.tsx' as resolvable extensions.
        extensions: [".ts", ".tsx", ".js"]
    },

    module: {
        rules: [
            {
                test: /\.ts(x?)$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: "ts-loader"
                    }
                ]
            },
            // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
            /*{
                enforce: "pre",
                test: /\.js$/,
                loader: "source-map-loader"
            },*/
        ]
    },

    externals: {
        'ssh2': 'commonjs2 ssh2'
    }
};