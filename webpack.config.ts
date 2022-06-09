import * as path from 'path';
import * as webpack from 'webpack';
import nodeExternals from 'webpack-node-externals';

const isProduction = process.env.NODE_ENV === "production";

const config: webpack.Configuration = {
    mode: isProduction ? "production" : "development",
    entry: {
        app: "./app.ts",
    },
    target: 'node',
    externals: [nodeExternals()],
    output: {
        path: path.join(__dirname, "."),
        filename: "[name].js",
    },
    module: {
        rules: [
            {
                test: [/\.ts$/, /\.tsx$/],
                loader: "ts-loader",
                options: { compilerOptions: { module: "es2020", moduleResolution: "node" } },
            },
        ],
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js", ".json"],
    }
}

module.exports = config