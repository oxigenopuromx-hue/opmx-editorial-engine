// Canonical JSON for values that can be persisted and compared byte for byte.
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
export function canonicalUpdateValue(x){
 if(x===null||typeof x==='boolean'||typeof x==='string')return JSON.stringify(x);
 if(typeof x==='number'&&Number.isSafeInteger(x))return JSON.stringify(x);
 if(Array.isArray(x))return '['+x.map(canonicalUpdateValue).join(',')+']';
 if(!object(x)||Object.keys(x).some(k=>['__proto__','prototype','constructor'].includes(k)))throw Error('INVALID_UPDATE_PAYLOAD');
 return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonicalUpdateValue(x[k])).join(',')+'}';
}
