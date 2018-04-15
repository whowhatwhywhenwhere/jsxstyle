import { CacheObject, PluginContext } from './types';
import fs = require('fs');
import MemoryFileSystem = require('webpack/lib/MemoryOutputFileSystem');
import NodeWatchFileSystem = require('webpack/lib/node/NodeWatchFileSystem');
import webpack = require('webpack');
import wrapFileSystem from './utils/wrapFileSystem';

import Compiler = webpack.Compiler;
import Compilation = webpack.compilation.Compilation;

const counterKey = Symbol.for('counter');

class JsxstyleWebpackPlugin implements webpack.Plugin {
  constructor() {
    this.memoryFS = new MemoryFileSystem();

    // the default cache object. can be overridden on a per-loader instance basis with the `cacheFile` option.
    this.cacheObject = {
      [counterKey]: 0,
    };

    // context object that gets passed to each loader.
    // available in each loader as this[Symbol.for('jsxstyle-loader')]
    this.ctx = {
      cacheObject: this.cacheObject,
      cacheFile: null,
      memoryFS: this.memoryFS,
      fileList: new Set(),
    };
  }

  private pluginName = 'JsxstyleLoaderPlugin';
  private memoryFS: MemoryFileSystem;
  private cacheObject: CacheObject;
  private ctx: PluginContext;

  private nmlPlugin = (loaderContext: any): void => {
    loaderContext[Symbol.for('jsxstyle-loader')] = this.ctx;
  };

  private compilationPlugin = (compilation: Compilation): void => {
    if (compilation.hooks) {
      compilation.hooks.normalModuleLoader.tap(this.pluginName, this.nmlPlugin);
    } else {
      compilation.plugin('normal-module-loader', this.nmlPlugin);
    }
  };

  private donePlugin = (): void => {
    if (this.ctx.cacheFile) {
      // write contents of cache object as a newline-separated list of CSS strings
      const cacheString = Object.keys(this.ctx.cacheObject).join('\n') + '\n';
      fs.writeFileSync(this.ctx.cacheFile, cacheString, 'utf8');
    }
  };

  apply(compiler: Compiler) {
    const environmentPlugin = (): void => {
      // compiler is of type `any` here because Compiler types are incomplete
      const wrappedFS = wrapFileSystem(
        (compiler as any).inputFileSystem,
        this.memoryFS
      );
      (compiler as any).inputFileSystem = wrappedFS;
      (compiler as any).watchFileSystem = new NodeWatchFileSystem(wrappedFS);
    };

    if (compiler.hooks) {
      // webpack 4+
      compiler.hooks.environment.tap(this.pluginName, environmentPlugin);
      compiler.hooks.compilation.tap(this.pluginName, this.compilationPlugin);
      compiler.hooks.done.tap(this.pluginName, this.donePlugin);
    } else {
      // webpack 1-3
      compiler.plugin('environment', environmentPlugin);
      compiler.plugin('compilation', this.compilationPlugin);
      compiler.plugin('done', this.donePlugin);
    }
  }
}

export = JsxstyleWebpackPlugin;
