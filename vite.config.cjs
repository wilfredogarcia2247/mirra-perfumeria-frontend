const path = require('path');
const { componentTagger } = require('lovable-tagger');
const react = require('@vitejs/plugin-react-swc');

/** @type {import('vite').UserConfigExport} */
module.exports = ({ mode }) => ({
  server: {
    host: '::',
    port: 8080,
    // allow render host for forwarded requests
    allowedHosts: ['aroma-zenith.onrender.com'],
  },
  plugins: [react(), mode === 'development' && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
