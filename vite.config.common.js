export default function fromConfigTemplate(entryPoint, outDirectory) {
  return {
    build: {
      lib: {
        entry: entryPoint,
        name: 'View Transitions API Polyfill',
        fileName: 'view-transitions-polyfill',
        formats: ['es'],
      },
      sourcemap: true,
      outDir: outDirectory,
      emptyOutDir: false,
    },
    server: {
      watch: {
        ignored: (file) => file.includes('wpt'),
      },
    },
    optimizeDeps: {
      entries: ['src/**/*', 'demos/**/*'],
    },
  };
}
