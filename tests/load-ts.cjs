const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
function loadTS(file,mocks={},globals={},cache=new Map()){
 file=path.resolve(__dirname,'..',file);if(cache.has(file))return cache.get(file);
 const exports={};cache.set(file,exports);
 const req=n=>{if(Object.prototype.hasOwnProperty.call(mocks,n))return mocks[n];if(n==='server-only')return {};if(n.startsWith('@/'))return loadTS(n.slice(2)+'.ts',mocks,globals,cache);if(n.startsWith('.'))return loadTS(path.relative(path.join(__dirname,'..'),path.resolve(path.dirname(file),n))+'.ts',mocks,globals,cache);return require(n);};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:req,process,console,Buffer,Date,Intl,Map,Set,URL,URLSearchParams,Request,Response,Headers,AbortSignal,crypto:require('crypto').webcrypto,setTimeout,clearTimeout,fetch,...globals},{filename:file});return exports;
}
module.exports={loadTS};
