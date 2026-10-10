const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');const m={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/portal/login-errors.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m,m.exports);const message=m.exports.loginErrorMessage;
assert.equal(message({code:'invalid_credentials',status:400},true),'Invalid email or password');
assert.match(message({status:401},true),/sign-in service/);
assert.match(message({status:0},false),/خدمة الدخول/);
assert.match(message({status:429},true),/Too many/);
assert.match(message({code:'email_not_confirmed'},true),/confirmation/);
console.log('5 login error classification checks passed');
