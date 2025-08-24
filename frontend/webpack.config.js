const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  context: path.resolve(__dirname),
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/static/',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    modules: ['node_modules'],
    alias: {
      'pdfjs-dist/build/pdf.worker.min.js': 'pdfjs-dist/build/pdf.worker.min.js',
    },
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: 'ts-loader',
      },
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'index.html',
    }),
    new webpack.DefinePlugin({
        'process.env': JSON.stringify(process.env)
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'node_modules/pdfjs-dist/build/pdf.worker.min.js',
          to: 'pdf.worker.min.js',
        },
      ],
    }),
  ],
  devServer: {
    // Add this line to allow requests from other hosts
    host: '0.0.0.0',
    static: {
      directory: path.resolve(__dirname),
    },
    compress: true,
    port: 3000,
    open: true,
    allowedHosts: 'all',
  },
};
