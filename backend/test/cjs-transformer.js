const tsJest = require('ts-jest').default;
const url = require('url');

const transformer = tsJest.createTransformer({
  tsconfig: {
    allowJs: true,
    module: 'commonjs',
    target: 'ES2022',
    esModuleInterop: true,
  },
});

module.exports = {
  process(sourceText, sourcePath, options) {
    let patched = sourceText;
    if (sourcePath.includes('node_modules')) {
      if (patched.includes('import.meta.url')) {
        patched = patched.replace(
          /\bimport\.meta\.url\b/g,
          JSON.stringify(url.pathToFileURL(sourcePath).href)
        );
      }
      if (/\bconst\s+require\s*=/.test(patched)) {
        patched = patched.replace(/\bconst\s+require\s*=/g, 'var require =');
      }
    }
    return transformer.process(patched, sourcePath, options);
  },
  getCacheKey(sourceText, sourcePath, options) {
    return transformer.getCacheKey(sourceText, sourcePath, options) + '_v2';
  },
};
