import { defineConfig } from 'iperf';
import path from 'path';

export default defineConfig({
  perf: {
    report: {},
  },
  resolve: {
    alias: {
      '@antv/layout': path.resolve(__dirname, './packages/layout/src'),
    },
  },
});
