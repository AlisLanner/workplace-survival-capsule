/** Check object keys before JSON.parse can silently overwrite duplicates. */
export function strictJson(raw: string): unknown {
  const text=raw.trim().replace(/^```(?:json)?\s*\n([\s\S]*)\n```$/, "$1");
  let i=0;
  const ws=()=>{while(/\s/.test(text[i]??"") && i<text.length)i++;};
  function str(): string {
    const start=i++;
    while(i<text.length) { if(text[i]==="\\"){i+=2;continue;} if(text[i++]==='"')return JSON.parse(text.slice(start,i)); }
    throw new Error("Unterminated JSON string");
  }
  function value():void {
    ws(); const c=text[i];
    if(c==="{") {
      i++;ws();const keys=new Set<string>();if(text[i]==="}"){i++;return;}
      while(i<text.length){ws();if(text[i]!=='"')throw new Error("JSON key expected");const k=str();if(keys.has(k))throw new Error(`Duplicate JSON key: ${k}`);keys.add(k);ws();if(text[i++]!==":")throw new Error("Colon expected");value();ws();if(text[i]==="}"){i++;return;}if(text[i++]!==",")throw new Error("Comma expected");}
    } else if(c==="[") {
      i++;ws();if(text[i]==="]"){i++;return;}while(i<text.length){value();ws();if(text[i]==="]"){i++;return;}if(text[i++]!==",")throw new Error("Comma expected");}
    } else if(c==='"'){str();return;}
    else {const m=text.slice(i).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);if(!m)throw new Error("Invalid JSON value");i+=m[0].length;return;}
    throw new Error("Incomplete JSON");
  }
  value();ws();if(i!==text.length)throw new Error("Trailing JSON content");return JSON.parse(text);
}
