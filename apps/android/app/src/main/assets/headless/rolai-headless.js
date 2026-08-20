var zo=Object.defineProperty;var xo=(P,S,re)=>S in P?zo(P,S,{enumerable:!0,configurable:!0,writable:!0,value:re}):P[S]=re;var ms=(P,S,re)=>xo(P,typeof S!="symbol"?S+"":S,re);(function(){"use strict";var P=typeof document<"u"?document.currentScript:null;class S extends Error{constructor(e){super(e),this.name="NotationError"}}const re=100,bs=1e3,ae="(?:([1-9]\\d*)?(?:\\{([^{}]+)\\}|\\[([^\\[\\]]+)\\]))",hs=new RegExp(`^${ae}$`),Is=new RegExp(`^${ae}\\s+vs\\s+${ae}$`,"i"),ps=new RegExp(`^${ae}(?:\\s*\\+\\s*${ae})+$`),ys=new RegExp(ae,"g"),Dt=/^(\d*)(?:d(\d+|f)|c)/i,jt=/^(\d+)/,Mt=[[/^(kh|kl|dh|dl)(\d+)/i,"keepdrop"],[/^!r(<=|>=|<|>|=)(\d+)/i,"reroll"],[/^(adv|dis)/i,"advantage"],[/^([+-])(\d+)/,"modifier"]],Cs=Mt.filter(([,n])=>n!=="modifier");function Lt(n,e){var a;const t=Dt.exec(n);if(!t)throw new S(`expressao de dados invalida: "${e}"`);const s=t[1]===""?1:Number(t[1]),i=t[0].toLowerCase().endsWith("c"),o=!i&&((a=t[2])==null?void 0:a.toLowerCase())==="f",l=i?13:o?3:Number(t[2]);if(!Number.isInteger(s)||s<0||s>re)throw new S(`quantidade de dados invalida em "${e}"`);if(!o&&!i&&(!Number.isInteger(l)||l<2||l>bs))throw new S(`numero de faces invalido em "${e}"`);const r={count:s,sides:l,modifier:0,hasModifier:!1};return o&&(r.fudge=!0),i&&(r.card=!0),{spec:r,rest:n.slice(t[0].length)}}function Et(n,e,t,s){let i=e;const o=s?Mt:Cs;for(;i.trim().length>0;){i=i.trimStart();let l=!1;for(const[r,a]of o){const c=r.exec(i);if(c){switch(l=!0,i=i.slice(c[0].length),a){case"keepdrop":{if(n.keepDrop)throw new S(`keep/drop duplicado em "${t}"`);const u=Number(c[2]);if(!Number.isInteger(u)||u<1||n.count===0)throw new S(`keep/drop invalido em "${t}"`);n.keepDrop={type:c[1].toLowerCase(),count:u};break}case"reroll":{if(n.reroll)throw new S(`reroll duplicado em "${t}"`);if(n.fudge)throw new S(`reroll nao se aplica a dado Fudge em "${t}"`);const u=Number(c[2]);if(!Number.isInteger(u)||u<1||u>n.sides)throw new S(`reroll invalido em "${t}"`);n.reroll={op:c[1],value:u};break}case"advantage":{if(n.keepDrop)throw new S(`adv/dis combinado com keep/drop em "${t}"`);const u=c[1].toLowerCase();n.keepDrop={type:u==="adv"?"kh":"kl",count:n.count},n.count=n.count+1;break}case"modifier":{if(n.hasModifier)throw new S(`modificador duplicado em "${t}"`);n.modifier=c[1]==="-"?-Number(c[2]):Number(c[2]),n.hasModifier=!0;break}}break}}if(!l){if(s)throw new S(`token inesperado em "${t}": "${i}"`);return i}}return i}function Gs(n){const e=n.trim(),{spec:t,rest:s}=Lt(e,n),i=Et(t,s,e,!0);if(i.trim().length>0)throw new S(`token inesperado em "${n}": "${i}"`);return t}function Be(n){try{const e=Gs(n),t={...e,modifier:0,hasModifier:!1};return{dice:e,terms:[{sign:1,dice:t}]}}catch(e){let t=n.trim();const s=[];let i=0,o=!1,l=1,r=!0;for(;t.length>0;){if(t=t.trimStart(),!r){const u=/^([+-])/.exec(t);if(!u)throw new S(`token inesperado em "${n}": "${t}"`);l=u[1]==="-"?-1:1,t=t.slice(1).trimStart()}if(Dt.test(t)){const u=Lt(t,n),d=Et(u.spec,u.rest,n,!1);s.push({sign:r?1:l,dice:u.spec}),t=d}else if(!r&&jt.test(t)){const u=jt.exec(t);i+=l*Number(u[1]),o=!0,t=t.slice(u[0].length)}else throw e;r=!1}if(s.length===0)throw e;return{dice:{...s[0].dice,modifier:i,hasModifier:o},terms:s}}}function rt(n){const e=n.trim();if(e==="")throw new S("notacao vazia");const t=Is.exec(e);if(t){const i=t[1]?Number(t[1]):void 0,o=(t[2]??t[3]).trim(),l=t[4]?Number(t[4]):void 0,r=(t[5]??t[6]).trim();return{groups:[{name:"action",...i!==void 0?{slot:i}:{},...Be(o)},{name:"challenge",...l!==void 0?{slot:l}:{},...Be(r)}]}}if(ps.test(e))return{groups:[...e.matchAll(ys)].map((o,l)=>{const r=o[1]?Number(o[1]):void 0,a=(o[2]??o[3]).trim();return{name:`group${l}`,...r!==void 0?{slot:r}:{},...Be(a)}})};const s=hs.exec(e);if(s){const i=s[1]?Number(s[1]):void 0,o=(s[2]??s[3]).trim();return{groups:[{name:"roll",...i!==void 0?{slot:i}:{},...Be(o)}]}}if(/[{}\[\]]|\bvs\b/i.test(e))throw new S(`sintaxe de grupo invalida: "${n}"`);return{groups:[{name:"roll",...Be(e)}]}}function As(){const n=globalThis.crypto;if(!n||typeof n.getRandomValues!="function")throw new Error("crypto.getRandomValues indisponivel neste ambiente — injete um RandomSource explicito");return n}const vs=()=>{const n=new Uint32Array(1);As().getRandomValues(n);const e=n[0];if(e===void 0)throw new Error("falha ao ler bytes aleatorios");return e/2**32};function Tt(n,e){return 1+Math.floor(e()*n)}function Pt(n={}){return{rng:n.rng??vs,queue:n.deterministic?[...n.deterministic]:[]}}function Bs(n,e,t){switch(n){case"<":return e<t;case"<=":return e<=t;case">":return e>t;case">=":return e>=t;case"=":return e===t}}function Ut(n,e){const t=n.queue.shift();if(e.fudge){if(t===void 0)return Tt(3,n.rng)-2;if(!Number.isInteger(t)||t<-1||t>1)throw new Error(`valor deterministico fora do intervalo [-1, 1] (dado Fudge): ${t}`);return t}if(t===void 0)return Tt(e.sides,n.rng);if(!Number.isInteger(t)||t<1||t>e.sides)throw new Error(`valor deterministico fora do intervalo [1, ${e.sides}]: ${t}`);return t}function at(n,e){const t=[];for(let l=0;l<n.count;l++)t.push(Ut(e,n));if(n.reroll)for(let l=0;l<t.length;l++)Bs(n.reroll.op,t[l],n.reroll.value)&&(t[l]=Ut(e,n));let s=t,i=[];if(n.keepDrop){const{type:l,count:r}=n.keepDrop,a=t.map((u,d)=>({value:u,index:d})).sort((u,d)=>d.value-u.value||u.index-d.index),c=new Set;if(l==="kh")for(const u of a.slice(0,r))c.add(u.index);else if(l==="kl")for(const u of a.slice(-r))c.add(u.index);else if(l==="dh")for(const u of a.slice(r))c.add(u.index);else for(const u of a.slice(0,-r))c.add(u.index);s=t.filter((u,d)=>c.has(d)),i=t.filter((u,d)=>!c.has(d))}const o={rolls:s};return i.length>0&&(o.dropped=i),n.hasModifier&&(o.modifier=n.modifier),(n.hasModifier||n.keepDrop||s.length===1)&&(o.total=s.reduce((l,r)=>l+r,0)+n.modifier),o}function Zs(n,e){if(n.terms.length===1)return at(n.dice,e);const t=[],s=[];let i=0;for(const l of n.terms){const r=at(l.dice,e);t.push(...r.rolls),r.dropped&&s.push(...r.dropped),i+=l.sign*r.rolls.reduce((a,c)=>a+c,0)}const o={rolls:t,total:i};return s.length>0&&(o.dropped=s),n.dice.hasModifier&&(o.modifier=n.dice.modifier,o.total=i+n.dice.modifier),o}function Ws(n,e,t={}){const s=Pt(t),i={};for(const o of n.groups){const l=Zs(o,s);o.slot!==void 0&&(l.slot=o.slot),n.groups.length>1&&o.name.startsWith("group")&&l.total===void 0&&(l.total=l.rolls.reduce((r,a)=>r+a,0)+(o.dice.modifier??0)),i[o.name]=l}return{notation:e,groups:i,timestamp:t.timestamp??new Date().toISOString()}}function Qt(n,e={}){return Ws(rt(n),n,e)}class V extends Error{constructor(e){super(e),this.name="ExpressionError"}}const ws=[">=","<=","==","!=",">","<","+","-","*","/"],Ns=["(",")","[","]",",","."];function $t(n){const e=[];let t=0;for(;t<n.length;){const s=n[t];if(/\s/.test(s)){t++;continue}if(/[0-9]/.test(s)||s==="."&&/[0-9]/.test(n[t+1]??"")){const o=/^\d*\.?\d+/.exec(n.slice(t));e.push({kind:"number",text:o[0]}),t+=o[0].length;continue}if(/[A-Za-z_]/.test(s)){const o=/^[A-Za-z_][A-Za-z0-9_]*/.exec(n.slice(t));e.push({kind:"ident",text:o[0]}),t+=o[0].length;continue}if(s==="'"){const o=n.indexOf("'",t+1);if(o===-1)throw new V(`string nao terminada em: "${n}"`);e.push({kind:"string",text:n.slice(t+1,o)}),t=o+1;continue}const i=ws.find(o=>n.startsWith(o,t));if(i){e.push({kind:"op",text:i}),t+=i.length;continue}if(Ns.includes(s)){e.push({kind:"punct",text:s}),t++;continue}throw new V(`caractere invalido "${s}" em: "${n}"`)}return e.push({kind:"eof",text:""}),e}let qt=class{constructor(e){ms(this,"pos",0);this.tokens=e}peek(){return this.tokens[this.pos]}next(){return this.tokens[this.pos++]}expect(e,t){const s=this.next();if(s.kind!==e||t!==void 0&&s.text!==t)throw new V(`esperado "${t??e}", encontrado "${s.text||s.kind}"`);return s}parse(){const e=this.parseOr();if(this.peek().kind!=="eof")throw new V(`token inesperado: "${this.peek().text}"`);return e}isKeyword(e){const t=this.peek();return t.kind==="ident"&&t.text.toLowerCase()===e}parseOr(){let e=this.parseXor();for(;this.isKeyword("or");)this.next(),e={kind:"binary",op:"or",left:e,right:this.parseXor()};return e}parseXor(){let e=this.parseAnd();for(;this.isKeyword("xor");)this.next(),e={kind:"binary",op:"xor",left:e,right:this.parseAnd()};return e}parseAnd(){let e=this.parseNot();for(;this.isKeyword("and");)this.next(),e={kind:"binary",op:"and",left:e,right:this.parseNot()};return e}parseNot(){return this.isKeyword("not")?(this.next(),{kind:"unary",op:"not",operand:this.parseNot()}):this.parseComparison()}parseComparison(){const e=this.parseAdditive(),t=this.peek();return t.kind==="op"&&[">",">=","<","<=","==","!="].includes(t.text)?(this.next(),{kind:"binary",op:t.text,left:e,right:this.parseAdditive()}):e}parseAdditive(){let e=this.parseMultiplicative();for(;this.peek().kind==="op"&&["+","-"].includes(this.peek().text);)e={kind:"binary",op:this.next().text,left:e,right:this.parseMultiplicative()};return e}parseMultiplicative(){let e=this.parseUnary();for(;this.peek().kind==="op"&&["*","/"].includes(this.peek().text);)e={kind:"binary",op:this.next().text,left:e,right:this.parseUnary()};return e}parseUnary(){const e=this.peek();return e.kind==="op"&&e.text==="-"?(this.next(),{kind:"unary",op:"-",operand:this.parseUnary()}):this.parsePrimary()}parsePrimary(){const e=this.peek();if(e.kind==="number")return this.next(),{kind:"number",value:Number(e.text)};if(e.kind==="string")return this.next(),{kind:"string",value:e.text};if(e.kind==="punct"&&e.text==="("){this.next();const t=this.parseOr();return this.expect("punct",")"),t}if(e.kind==="ident"){this.next();const t=e.text;if(this.peek().kind==="punct"&&this.peek().text==="("){this.next();const i=[this.parseOr()];for(;this.peek().kind==="punct"&&this.peek().text===",";)this.next(),i.push(this.parseOr());return this.expect("punct",")"),{kind:"call",fn:t.toLowerCase(),args:i}}const s=[];for(;;){const i=this.peek();if(i.kind==="punct"&&i.text===".")this.next(),s.push({member:this.expect("ident").text});else if(i.kind==="punct"&&i.text==="["){this.next();const o=this.expect("number"),l=Number(o.text);if(!Number.isInteger(l)||l<0)throw new V(`indice invalido: "${o.text}"`);s.push({index:l}),this.expect("punct","]")}else break}return{kind:"ref",name:t,path:s}}throw new V(`expressao inesperada: "${e.text||e.kind}"`)}};const Ss=/^(>=|<=|==|!=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/;function en(n,e){const t=Ss.exec(e);if(!t)throw new V(`condicao invalida: '${e}'`);const s=Number(t[2]),i=t[1]==="="?"==":t[1];return nn(i,n,s)}function q(n){return typeof n=="boolean"?n:typeof n=="number"?n!==0:n.length>0}function ct(n,e){if(typeof n=="number")return n;if(typeof n=="boolean")return n?1:0;throw new V(`${e}: esperado numero, encontrado array`)}function tn(n,e){if(Array.isArray(n))return n;throw new V(`${e}: esperado array, encontrado ${typeof n}`)}function J(n,e){switch(n.kind){case"number":return n.value;case"string":throw new V(`string fora de contexto: '${n.value}'`);case"ref":{const t=e[n.name];if(t===void 0)throw new V(`campo desconhecido: "${n.name}"`);let s=t.rolls;for(const i of n.path)if("member"in i)if(i.member==="rolls")s=t.rolls;else if(i.member==="total"){if(t.total===void 0)throw new V(`campo "${n.name}" nao tem total (compare_individually?)`);s=t.total}else if(i.member==="modifier"){if(t.modifier===void 0)throw new V(`campo "${n.name}" nao tem modifier`);s=t.modifier}else throw new V(`membro desconhecido: "${n.name}.${i.member}"`);else{const o=tn(s,`indexacao de "${n.name}"`),l=o[i.index];if(l===void 0)throw new V(`indice ${i.index} fora do array "${n.name}" (${o.length} elementos)`);s=l}return s}case"call":{const t=n.args;switch(n.fn){case"count":{if(t.length!==2)throw new V("count(field, condicao) exige 2 argumentos");const s=tn(J(t[0],e),"count"),i=t[1];if(i.kind!=="string")throw new V("segundo argumento de count deve ser string, ex: '>=6'");return s.filter(o=>en(o,i.value)).length}case"max":{if(t.length===0)throw new V("max(...) exige ao menos 1 argumento");const s=[];for(const i of t){const o=J(i,e);Array.isArray(o)?s.push(...o):typeof o=="number"&&s.push(o)}return s.length===0?0:Math.max(...s)}case"min":{if(t.length===0)throw new V("min(...) exige ao menos 1 argumento");const s=[];for(const i of t){const o=J(i,e);Array.isArray(o)?s.push(...o):typeof o=="number"&&s.push(o)}return s.length===0?0:Math.min(...s)}default:throw new V(`funcao nao permitida: "${n.fn}"`)}}case"unary":return n.op==="not"?!q(J(n.operand,e)):-ct(J(n.operand,e),"negacao unaria");case"binary":{const{op:t}=n;if(t==="and")return q(J(n.left,e))&&q(J(n.right,e));if(t==="or")return q(J(n.left,e))||q(J(n.right,e));if(t==="xor")return q(J(n.left,e))!==q(J(n.right,e));const s=ct(J(n.left,e),`operador "${t}"`),i=ct(J(n.right,e),`operador "${t}"`);switch(t){case"+":return s+i;case"-":return s-i;case"*":return s*i;case"/":return s/i;default:return nn(t,s,i)}}}}function nn(n,e,t){switch(n){case">":return e>t;case">=":return e>=t;case"<":return e<t;case"<=":return e<=t;case"==":return e===t;case"!=":return e!==t;default:throw new V(`operador desconhecido: "${n}"`)}}function Vs(n){new qt($t(n)).parse()}function ks(n,e){const t=new qt($t(n)).parse();return q(J(t,e))}const Ys="data:text/yaml;base64,c3lzdGVtOiBkMTAwCmxhYmVsOiAiZDEwMCDigJQgdGVzdGUgZGUgcGVyw61jaWEgKEJSUC9DdGh1bGh1KSIKcm9sbF90eXBlOiBzaW1wbGUKaW5wdXRzOgogIC0gaWQ6IHNraWxsCiAgICBsYWJlbDogIlBlcsOtY2lhIgogICAgdHlwZTogbnVtYmVyCmZpZWxkczoKICAtIGlkOiByb2xsCiAgICBkaWNlOiAiMWQxMDAiCiMgUm9sYWdlbSBwb3IgYmFpeG86IHN1Y2Vzc28gZSByb2xhciA8PSBwZXJpY2lhLiBPcyB0aWVycyBzYW8gZnJhY29lcyBkYQojIHBlcmljaWEgKGV4dHJlbW8gPSAxLzUsIGRpZmljaWwgPSAxLzIpIGUgYSBjb21wYXJhY2FvIGNvbSBmbG9hdCBmdW5jaW9uYQojIGlndWFsIGFvIGFycmVkb25kYW1lbnRvIHByYSBiYWl4byBkbyBsaXZybyAocm9sbCBpbnRlaXJvIDw9IDI3LjUgPT0gPD0gMjcpLgojIEZhbGhhIGNyaXRpY2E6IDEwMCBzZW1wcmU7IDk2LTk5IHRhbWJlbSBxdWFuZG8gYSBwZXJpY2lhIGUgbWVub3IgcXVlIDUwLgpvdXRjb21lX3J1bGVzOgogIC0gY29uZGl0aW9uOiAicm9sbC50b3RhbCA9PSAxIgogICAgcmVzdWx0OiBjcml0aWNhbAogIC0gY29uZGl0aW9uOiAicm9sbC50b3RhbCA9PSAxMDAgb3IgKHJvbGwudG90YWwgPj0gOTYgYW5kIHtpbnB1dC5za2lsbH0gPCA1MCkiCiAgICByZXN1bHQ6IGZ1bWJsZQogIC0gY29uZGl0aW9uOiAicm9sbC50b3RhbCA+IDEgYW5kIHJvbGwudG90YWwgPD0ge2lucHV0LnNraWxsfSAvIDUiCiAgICByZXN1bHQ6IGV4dHJlbWVfc3VjY2VzcwogIC0gY29uZGl0aW9uOiAicm9sbC50b3RhbCA+IHtpbnB1dC5za2lsbH0gLyA1IGFuZCByb2xsLnRvdGFsIDw9IHtpbnB1dC5za2lsbH0gLyAyIgogICAgcmVzdWx0OiBoYXJkX3N1Y2Nlc3MKICAtIGNvbmRpdGlvbjogInJvbGwudG90YWwgPiB7aW5wdXQuc2tpbGx9IC8gMiBhbmQgcm9sbC50b3RhbCA8PSB7aW5wdXQuc2tpbGx9IgogICAgcmVzdWx0OiByZWd1bGFyX3N1Y2Nlc3MKICAjIEZhbGhhIHNpbXBsZXM6IGFjaW1hIGRhIHBlcmljaWEsIHNlbSBzZXIgYSBmYWxoYSBjcml0aWNhIGphIHRyYXRhZGEgYWNpbWEuCiAgLSBjb25kaXRpb246ICJyb2xsLnRvdGFsID4ge2lucHV0LnNraWxsfSBhbmQgcm9sbC50b3RhbCA8IDEwMCBhbmQgbm90IChyb2xsLnRvdGFsID49IDk2IGFuZCB7aW5wdXQuc2tpbGx9IDwgNTApIgogICAgcmVzdWx0OiBmYWlsCg==",_s="data:text/yaml;base64,c3lzdGVtOiBkMjAKbGFiZWw6ICJkMjAg4oCUIHRlc3RlIGNvbnRyYSBDRCIKcm9sbF90eXBlOiBzaW1wbGUKaW5wdXRzOgogIC0gaWQ6IG1vZGUKICAgIGxhYmVsOiAiTW9kbyIKICAgIHR5cGU6IHNlbGVjdAogICAgb3B0aW9uczoKICAgICAgLSB7IHZhbHVlOiAiIiwgbGFiZWw6ICJOb3JtYWwiIH0KICAgICAgLSB7IHZhbHVlOiAiYWR2IiwgbGFiZWw6ICJWYW50YWdlbSIgfQogICAgICAtIHsgdmFsdWU6ICJkaXMiLCBsYWJlbDogIkRlc3ZhbnRhZ2VtIiB9CiAgLSBpZDogZGMKICAgIGxhYmVsOiAiQ0QiCiAgICB0eXBlOiBudW1iZXIKICAtIGlkOiBtb2QKICAgIGxhYmVsOiAiTW9kaWZpY2Fkb3IiCiAgICB0eXBlOiBudW1iZXIKICAgIGRlZmF1bHQ6ICIwIgpmaWVsZHM6CiAgIyAiMWQyMGFkdiIgLyAiMWQyMGRpcyIgdmlyYW0gMmQyMGtoMSAvIDJkMjBrbDEgbm8gcGFyc2VyIChhY3VjYXIgZGEKICAjIG5vdGFjYW8gY2FtYWRhIDEpIOKAlCBgcm9sbHNgIGZpY2EgY29tIG8gdW5pY28gZGFkbyBtYW50aWRvLgogIC0gaWQ6IHJvbGwKICAgIGRpY2U6ICIxZDIwe2lucHV0Lm1vZGV9IgogICAgbW9kaWZpZXI6ICJ7aW5wdXQubW9kfSIKb3V0Y29tZV9ydWxlczoKICAtIGNvbmRpdGlvbjogInJvbGwucm9sbHNbMF0gPT0gMjAiCiAgICByZXN1bHQ6IGNyaXRpY2FsX3N1Y2Nlc3MKICAtIGNvbmRpdGlvbjogInJvbGwucm9sbHNbMF0gPT0gMSIKICAgIHJlc3VsdDogY3JpdGljYWxfZmFpbHVyZQogIC0gY29uZGl0aW9uOiAicm9sbC50b3RhbCA+PSB7aW5wdXQuZGN9IGFuZCByb2xsLnJvbGxzWzBdICE9IDIwIGFuZCByb2xsLnJvbGxzWzBdICE9IDEiCiAgICByZXN1bHQ6IHN1Y2Nlc3MKICAtIGNvbmRpdGlvbjogInJvbGwudG90YWwgPCB7aW5wdXQuZGN9IGFuZCByb2xsLnJvbGxzWzBdICE9IDIwIGFuZCByb2xsLnJvbGxzWzBdICE9IDEiCiAgICByZXN1bHQ6IGZhaWwK",Xs="data:text/yaml;base64,c3lzdGVtOiBmYXRlCmxhYmVsOiAiRmF0ZSAvIEZ1ZGdlIOKAlCA0ZEYiCnJvbGxfdHlwZTogc2ltcGxlCmlucHV0czoKICAtIGlkOiBkaWZmaWN1bHR5CiAgICBsYWJlbDogIkRpZmljdWxkYWRlIgogICAgdHlwZTogbnVtYmVyCiAgICByZXF1aXJlZDogZmFsc2UKICAtIGlkOiBza2lsbAogICAgbGFiZWw6ICJIYWJpbGlkYWRlIgogICAgdHlwZTogbnVtYmVyCiAgICBkZWZhdWx0OiAiMCIKZmllbGRzOgogIC0gaWQ6IHJvbGwKICAgIGRpY2U6ICI0ZEYiCiAgICBtb2RpZmllcjogIntpbnB1dC5za2lsbH0iCiMgRmF0ZSBjb21wYXJhIG8gdG90YWwgKDRkRiArIGhhYmlsaWRhZGUpIGNvbSBhIGRpZmljdWxkYWRlL29wb3NpY2FvLgojIFRpZXJzIG11dHVhbWVudGUgZXhjbHVzaXZvcyDigJQgdmVyIG5vdGEgZW0gZml0ZC55YW1sLgpvdXRjb21lX3J1bGVzOgogIC0gY29uZGl0aW9uOiAicm9sbC50b3RhbCA+PSB7aW5wdXQuZGlmZmljdWx0eX0gKyAzIgogICAgcmVzdWx0OiBzdWNjZXNzX3dpdGhfc3R5bGUKICAtIGNvbmRpdGlvbjogInJvbGwudG90YWwgPiB7aW5wdXQuZGlmZmljdWx0eX0gYW5kIHJvbGwudG90YWwgPCB7aW5wdXQuZGlmZmljdWx0eX0gKyAzIgogICAgcmVzdWx0OiBzdWNjZXNzCiAgLSBjb25kaXRpb246ICJyb2xsLnRvdGFsID09IHtpbnB1dC5kaWZmaWN1bHR5fSIKICAgIHJlc3VsdDogdGllCiAgLSBjb25kaXRpb246ICJyb2xsLnRvdGFsIDwge2lucHV0LmRpZmZpY3VsdHl9IgogICAgcmVzdWx0OiBmYWlsCg==",Rs="data:text/yaml;base64,c3lzdGVtOiBmaXJlbGlnaHRzCmxhYmVsOiAiRmlyZWxpZ2h0cyDigJQgQcOnw6NvIgpyb2xsX3R5cGU6IGNvbXBhcmlzb24KaW5wdXRzOgogIC0gaWQ6IG1vZGlmaWVyCiAgICBsYWJlbDogIk1vZGlmaWNhZG9yIgogICAgdHlwZTogbnVtYmVyCiAgICBkZWZhdWx0OiAiMCIKZmllbGRzOgogIC0gaWQ6IGFjdGlvbgogICAgZGljZTogIjJkNiIKICAgIG1vZGlmaWVyOiAie2lucHV0Lm1vZGlmaWVyfSIKICAtIGlkOiBjaGFsbGVuZ2UKICAgIGRpY2U6ICIyYyIKICAgIGNvbXBhcmVfaW5kaXZpZHVhbGx5OiB0cnVlCm91dGNvbWVfcnVsZXM6CiAgLSBjb25kaXRpb246ICJhY3Rpb24udG90YWwgPiBjaGFsbGVuZ2VbMF0gYW5kIGFjdGlvbi50b3RhbCA+IGNoYWxsZW5nZVsxXSIKICAgIHJlc3VsdDogc3Ryb25nX2hpdAogIC0gY29uZGl0aW9uOiAiYWN0aW9uLnRvdGFsID4gY2hhbGxlbmdlWzBdIHhvciBhY3Rpb24udG90YWwgPiBjaGFsbGVuZ2VbMV0iCiAgICByZXN1bHQ6IHdlYWtfaGl0CiAgLSBjb25kaXRpb246ICJhY3Rpb24udG90YWwgPD0gY2hhbGxlbmdlWzBdIGFuZCBhY3Rpb24udG90YWwgPD0gY2hhbGxlbmdlWzFdIgogICAgcmVzdWx0OiBtaXNzCiAgLSBjb25kaXRpb246ICJjaGFsbGVuZ2VbMF0gPT0gY2hhbGxlbmdlWzFdIgogICAgcmVzdWx0OiBtYXRjaAo=",Fs="data:text/yaml;base64,c3lzdGVtOiBmaXRkCmxhYmVsOiAiRml0RCDigJQgUG9vbCBkZSBhw6fDo28iCnJvbGxfdHlwZTogc2ltcGxlCmlucHV0czoKICAtIGlkOiBwb29sX3NpemUKICAgIGxhYmVsOiAiVGFtYW5obyBkbyBwb29sIgogICAgdHlwZTogbnVtYmVyCmZpZWxkczoKICAtIGlkOiBwb29sCiAgICBkaWNlOiAie2lucHV0LnBvb2xfc2l6ZX1kNiIKICAgICMgUG9vbCAwIChvdSBuZWdhdGl2byk6IHJlZ3JhIGRvIEZpdEQgZSByb2xhciAyZDYgZSBmaWNhciBzbyBjb20gbwogICAgIyBtZW5vciDigJQgIjBkNiIgbmFvIGUgbm90YWNhbyB2YWxpZGEsIGVudGFvIHRyb2NhIGFudGVzIGRlIHJvbGFyLgogICAgemVyb19kaWNlX2ZhbGxiYWNrOiAiMmQ2a2wxIgpvdXRjb21lX3J1bGVzOgogIC0gY29uZGl0aW9uOiAiY291bnQocG9vbCwgJz49NicpID49IDIiCiAgICByZXN1bHQ6IGNyaXRpY2FsCiAgLSBjb25kaXRpb246ICJjb3VudChwb29sLCAnPj02JykgPT0gMSIKICAgIHJlc3VsdDogZnVsbF9zdWNjZXNzCiAgIyBUaWVycyBzYW8gbXV0dWFtZW50ZSBleGNsdXNpdm9zOiBwYXJ0aWFsIGV4aWdlIHplcm8gNiwgc2VuYW8gdW0KICAjIGNyaXRpY2FsL2Z1bGxfc3VjY2VzcyB0YW1iZW0gbWFyY2FyaWEgcGFydGlhbF9zdWNjZXNzIGUgYSBVSSBleGliaXJpYQogICMgZG9pcyBvdXRjb21lcyBjb250cmFkaXRvcmlvcy4KICAtIGNvbmRpdGlvbjogIm1heChwb29sKSA+PSA0IGFuZCBjb3VudChwb29sLCAnPj02JykgPT0gMCIKICAgIHJlc3VsdDogcGFydGlhbF9zdWNjZXNzCiAgLSBjb25kaXRpb246ICJtYXgocG9vbCkgPCA0IgogICAgcmVzdWx0OiBtaXNzCg==",Hs="data:text/yaml;base64,c3lzdGVtOiBmcmFjdGFsCmxhYmVsOiAiRnJhY3RhbCDigJQgUm9sYWdlbSBkZSBSaXNjbyIKcm9sbF90eXBlOiBzaW1wbGUKIyBgZGljZV90b3RhbGAgTkFPIGUgdW0gaW5wdXQgZGUgdmVyZGFkZSDigJQgbyBqb2dhZG9yIHNvIHZlCiMgImZhdG9zX2FwbGljYXZlaXMiIGUgInZhbnRhZ2VtIiBuYSBVSS4gTyBtb3RvciBzbyBmYXogc3Vic3RpdHVpY2FvCiMgbGl0ZXJhbCBuYSBub3RhY2FvIGRvIGZpZWxkIChzZW0gYXJpdG1ldGljYSksIGVudGFvIHF1ZW0gY29tYmluYSBvcyBkb2lzCiMgbnVtIHRhbWFuaG8gZGUgcG9vbCAobWluIDAsIGNhcCAzLCArMSBzZSB2YW50YWdlbSBlIGZhdG9zPj0xKSBlIGEgY2FtYWRhCiMgZGUgY2hhbWFkYSAoYXBwcy93ZWIvc3JjL3Byb2ZpbGVJbnB1dFF1aXJrcy50cyksIEFOVEVTIGRlIHJvbGxXaXRoUHJvZmlsZQojIOKAlCB2ZXIgZG9jcy9zeXN0ZW0tcHJvZmlsZXMubWQjaW5wdXRzLWRlcml2YWRvcy4KaW5wdXRzOgogIC0gaWQ6IGZhdG9zX2FwbGljYXZlaXMKICAgIGxhYmVsOiAiTsO6bWVybyBkZSBGYXRvcyIKICAgIHR5cGU6IG51bWJlcgogICAgZGVmYXVsdDogIjAiCiAgLSBpZDogdmFudGFnZW0KICAgIGxhYmVsOiAiVmFudGFnZW0/IgogICAgdHlwZTogc2VsZWN0CiAgICByZXF1aXJlZDogZmFsc2UKICAgIGRlZmF1bHQ6ICJuYW8iCiAgICAjICJuYW8iIHByaW1laXJvOiBhIFVJIChSb2xsUGFuZWwudHN4L2RlZmF1bHRJbnB1dHMpIHVzYSBTRU1QUkUgbwogICAgIyBQUklNRUlSTyBvcHRpb24gY29tbyB2YWxvciBpbmljaWFsIGRvIHNlbGVjdCDigJQgbyBjYW1wbyAiZGVmYXVsdCIKICAgICMgYWNpbWEgbmFvIHNlIGFwbGljYSBhIHNlbGVjdCwgc28gYSBudW1iZXIuIFZhbnRhZ2VtIGNvbWVjYSBkZXNsaWdhZGEKICAgICMgZGUgcHJvcG9zaXRvIChlIGEgZXhjZWNhbywgbmFvIGEgcmVncmEgZGEgcm9sYWdlbSkuCiAgICBvcHRpb25zOgogICAgICAtIHsgdmFsdWU6ICJuYW8iLCBsYWJlbDogIk7Do28iIH0KICAgICAgLSB7IHZhbHVlOiAic2ltIiwgbGFiZWw6ICJTaW0sICsxZDYiIH0KZmllbGRzOgogIC0gaWQ6IHBvb2wKICAgIGRpY2U6ICJ7aW5wdXQuZGljZV90b3RhbH1kNiIKICAgIGNvbXBhcmVfaW5kaXZpZHVhbGx5OiB0cnVlCiAgICB6ZXJvX2RpY2VfZmFsbGJhY2s6ICIxZDYiCiMgTmFvIHNvbWE6IG8gcmVzdWx0YWRvIGUgbyBNQUlPUiBkYWRvIGRhIHBvb2wuIFRocmVzaG9sZCBkZSBzdWNlc3NvIG11ZGEKIyBkZSBwYXRhbWFyIGNvbmZvcm1lIGZhdG9zX2FwbGljYXZlaXMgKDUtNiBjb20gRmF0byBhcGxpY2F2ZWwsIHNvIDYgc2VtCiMgbmVuaHVtKSDigJQgcG9yIGlzc28gYXMgZHVhcyBtZXRhZGVzICg+PTEgLyA9PTApIHNhbyByYW1vcyBzZXBhcmFkb3MsIGUgbmFvCiMgdW1hIGNvbmRpY2FvIHNvLiBSdXB0dXJhIChxdWFscXVlciBkYWRvID0xKSBlIGV2ZW50byBQQVJBTEVMTywgYXZhbGlhZG8KIyBERVBPSVMgZG9zIHJhbW9zIGRlIHJlc3VsdGFkbyBiYXNlIHByYSBudW5jYSB2aXJhciBvICJvdXRjb21lIiBwcmltYXJpbwojIChtZXNtbyBwYWRyYW8gZG8gIm1hdGNoIiBkbyBJcm9uc3dvcm4pLgpvdXRjb21lX3J1bGVzOgogIC0gY29uZGl0aW9uOiAie2lucHV0LmZhdG9zX2FwbGljYXZlaXN9ID49IDEgYW5kIGNvdW50KHBvb2wsICc9PTYnKSA9PSA0IgogICAgcmVzdWx0OiBzdWNlc3NvX2ltcHVsc29feDQKICAtIGNvbmRpdGlvbjogIntpbnB1dC5mYXRvc19hcGxpY2F2ZWlzfSA+PSAxIGFuZCBjb3VudChwb29sLCAnPT02JykgPT0gMyIKICAgIHJlc3VsdDogc3VjZXNzb19pbXB1bHNvX3gzCiAgLSBjb25kaXRpb246ICJ7aW5wdXQuZmF0b3NfYXBsaWNhdmVpc30gPj0gMSBhbmQgY291bnQocG9vbCwgJz09NicpID09IDIiCiAgICByZXN1bHQ6IHN1Y2Vzc29faW1wdWxzb194MgogIC0gY29uZGl0aW9uOiAie2lucHV0LmZhdG9zX2FwbGljYXZlaXN9ID49IDEgYW5kIG1heChwb29sKSA+PSA1IGFuZCBjb3VudChwb29sLCAnPT02JykgPCAyIgogICAgcmVzdWx0OiBzdWNlc3NvCiAgLSBjb25kaXRpb246ICJ7aW5wdXQuZmF0b3NfYXBsaWNhdmVpc30gPj0gMSBhbmQgbWF4KHBvb2wpIDw9IDQiCiAgICByZXN1bHQ6IGZhbGhhCiAgLSBjb25kaXRpb246ICJ7aW5wdXQuZmF0b3NfYXBsaWNhdmVpc30gPT0gMCBhbmQgbWF4KHBvb2wpID09IDYiCiAgICByZXN1bHQ6IHN1Y2Vzc28KICAtIGNvbmRpdGlvbjogIntpbnB1dC5mYXRvc19hcGxpY2F2ZWlzfSA9PSAwIGFuZCBtYXgocG9vbCkgPD0gNSIKICAgIHJlc3VsdDogZmFsaGEKICAtIGNvbmRpdGlvbjogImNvdW50KHBvb2wsICc9PTEnKSA9PSA0IgogICAgcmVzdWx0OiBydXB0dXJhX3g0CiAgLSBjb25kaXRpb246ICJjb3VudChwb29sLCAnPT0xJykgPT0gMyIKICAgIHJlc3VsdDogcnVwdHVyYV94MwogIC0gY29uZGl0aW9uOiAiY291bnQocG9vbCwgJz09MScpID09IDIiCiAgICByZXN1bHQ6IHJ1cHR1cmFfeDIKICAtIGNvbmRpdGlvbjogImNvdW50KHBvb2wsICc9PTEnKSA9PSAxIgogICAgcmVzdWx0OiBydXB0dXJhX3gxCg==",Os="data:text/yaml;base64,c3lzdGVtOiBpbmZhZXJudW0KbGFiZWw6ICJJbmZhZXJudW0g4oCUIFJvbGFnZW0gcGFkcsOjbyAoM2Q2KSIKcm9sbF90eXBlOiBzaW1wbGUKaW5wdXRzOiBbXQpmaWVsZHM6CiAgLSBpZDogcG9vbAogICAgZGljZTogIjNkNiIKICAgIGNvbXBhcmVfaW5kaXZpZHVhbGx5OiB0cnVlCiMgQ2FkYSBkYWRvIGRvIDNkNiBlIGxpZG8gSU5ESVZJRFVBTE1FTlRFLCBuYW8gc29tYWRvOiAxID0gZGVzZ3JhY2EsIDIgb3UgMyA9CiMgdmlzbHVtYnJlLCA0IG91IDUgPSBmYWNhbmhhLCA2ID0gbWlsYWdyZS4gUG9vbCBmaXhvIGVtIDMgZGFkb3M6IGNhZGEKIyBjYXRlZ29yaWEgc28gcG9kZSBvY29ycmVyIDAvMS8yLzMgdmV6ZXMsIGVudGFvIHF1YW50aXphIHNlbSBnYW1iaWFycmEg4oCUCiMgIjIgbWlsYWdyZXMiIGVtIHZleiBkZSB1bWEgZmxhZyBib29sZWFuYSBxdWUgZXNjb25kZSBxdWFudG9zIGNhaXJhbS4KIyBPcmRlbSBwcmlvcml6YSBvcyBleHRyZW1vczogbWlsYWdyZSBlIGRlc2dyYWNhIChvIGRlc3RhcXVlLCAib3V0Y29tZSIpCiMgdmVtIGFudGVzIGRlIGZhY2FuaGEvdmlzbHVtYnJlLgpvdXRjb21lX3J1bGVzOgogIC0gY29uZGl0aW9uOiAiY291bnQocG9vbCwgJz09NicpID09IDMiCiAgICByZXN1bHQ6IG1pbGFncmVfeDMKICAtIGNvbmRpdGlvbjogImNvdW50KHBvb2wsICc9PTYnKSA9PSAyIgogICAgcmVzdWx0OiBtaWxhZ3JlX3gyCiAgLSBjb25kaXRpb246ICJjb3VudChwb29sLCAnPT02JykgPT0gMSIKICAgIHJlc3VsdDogbWlsYWdyZV94MQogIC0gY29uZGl0aW9uOiAiY291bnQocG9vbCwgJz09MScpID09IDMiCiAgICByZXN1bHQ6IGRlc2dyYWNhX3gzCiAgLSBjb25kaXRpb246ICJjb3VudChwb29sLCAnPT0xJykgPT0gMiIKICAgIHJlc3VsdDogZGVzZ3JhY2FfeDIKICAtIGNvbmRpdGlvbjogImNvdW50KHBvb2wsICc9PTEnKSA9PSAxIgogICAgcmVzdWx0OiBkZXNncmFjYV94MQogIC0gY29uZGl0aW9uOiAiKGNvdW50KHBvb2wsICc9PTQnKSArIGNvdW50KHBvb2wsICc9PTUnKSkgPT0gMyIKICAgIHJlc3VsdDogZmFjYW5oYV94MwogIC0gY29uZGl0aW9uOiAiKGNvdW50KHBvb2wsICc9PTQnKSArIGNvdW50KHBvb2wsICc9PTUnKSkgPT0gMiIKICAgIHJlc3VsdDogZmFjYW5oYV94MgogIC0gY29uZGl0aW9uOiAiKGNvdW50KHBvb2wsICc9PTQnKSArIGNvdW50KHBvb2wsICc9PTUnKSkgPT0gMSIKICAgIHJlc3VsdDogZmFjYW5oYV94MQogIC0gY29uZGl0aW9uOiAiKGNvdW50KHBvb2wsICc9PTInKSArIGNvdW50KHBvb2wsICc9PTMnKSkgPT0gMyIKICAgIHJlc3VsdDogdmlzbHVtYnJlX3gzCiAgLSBjb25kaXRpb246ICIoY291bnQocG9vbCwgJz09MicpICsgY291bnQocG9vbCwgJz09MycpKSA9PSAyIgogICAgcmVzdWx0OiB2aXNsdW1icmVfeDIKICAtIGNvbmRpdGlvbjogIihjb3VudChwb29sLCAnPT0yJykgKyBjb3VudChwb29sLCAnPT0zJykpID09IDEiCiAgICByZXN1bHQ6IHZpc2x1bWJyZV94MQo=",Js="data:text/yaml;base64,c3lzdGVtOiBpbmZhZXJudW1faWRlaWFzCmxhYmVsOiAiSW5mYWVybnVtIOKAlCBJZGVpYXMgKHZlcmJvICsgc3Vic3RhbnRpdm8pIgpyb2xsX3R5cGU6IG11bHRpCmlucHV0czogW10KZmllbGRzOgogIC0gaWQ6IHZlcmIKICAgIGRpY2U6ICIyZDYiCiAgICBjb21wYXJlX2luZGl2aWR1YWxseTogdHJ1ZQogIC0gaWQ6IG5vdW4KICAgIGRpY2U6ICIyZDYiCiAgICBjb21wYXJlX2luZGl2aWR1YWxseTogdHJ1ZQojIENhZGEgdGFiZWxhIGUgbGlkYSBwZWxvcyBkb2lzIGRhZG9zIElORElWSURVQUxNRU5URSAobGluaGEgPSAxbyBkYWRvLAojIGNvbHVuYSA9IDJvIGRhZG8pLCBuYW8gcGVsYSBzb21hIOKAlCBzYW8gMzYgY2VsdWxhcyBpZ3VhbG1lbnRlCiMgcHJvdmF2ZWlzLCBuYW8gYSBjdXJ2YSBkZSB1bSAyZDYgc29tYWRvLiBWZXJibyBlIHN1YnN0YW50aXZvIHNhZW0KIyBkZSByb2xhZ2VucyBpbmRlcGVuZGVudGVzICgyZDYgY2FkYSk7IHVuYSBvcyBkb2lzIHByYSBpbnRlcnByZXRhci4Kb3V0Y29tZV9ydWxlczoKICAtIGNvbmRpdGlvbjogInZlcmIucm9sbHNbMF0gPT0gMSBhbmQgdmVyYi5yb2xsc1sxXSA9PSAxIgogICAgcmVzdWx0OiBpZ25vcmFyCiAgLSBjb25kaXRpb246ICJ2ZXJiLnJvbGxzWzBdID09IDEgYW5kIHZlcmIucm9sbHNbMV0gPT0gMiIKICAgIHJlc3VsdDogZGVzY29icmlyCiAgLSBjb25kaXRpb246ICJ2ZXJiLnJvbGxzWzBdID09IDEgYW5kIHZlcmIucm9sbHNbMV0gPT0gMyIKICAgIHJlc3VsdDogY29tZWNhcgogIC0gY29uZGl0aW9uOiAidmVyYi5yb2xsc1swXSA9PSAxIGFuZCB2ZXJiLnJvbGxzWzFdID09IDQiCiAgICByZXN1bHQ6IGJsb3F1ZWFyCiAgLSBjb25kaXRpb246ICJ2ZXJiLnJvbGxzWzBdID09IDEgYW5kIHZlcmIucm9sbHNbMV0gPT0gNSIKICAgIHJlc3VsdDogZ2FuaGFyCiAgLSBjb25kaXRpb246ICJ2ZXJiLnJvbGxzWzBdID09IDEgYW5kIHZlcmIucm9sbHNbMV0gPT0gNiIKICAgIHJlc3VsdDogcGVyc2VndWlyCiAgLSBjb25kaXRpb246ICJ2ZXJiLnJvbGxzWzBdID09IDIgYW5kIHZlcmIucm9sbHNbMV0gPT0gMSIKICAgIHJlc3VsdDoganVsZ2FyCiAgLSBjb25kaXRpb246ICJ2ZXJiLnJvbGxzWzBdID09IDIgYW5kIHZlcmIucm9sbHNbMV0gPT0gMiIKICAgIHJlc3VsdDogZmF6ZXIKICAtIGNvbmRpdGlvbjogInZlcmIucm9sbHNbMF0gPT0gMiBhbmQgdmVyYi5yb2xsc1sxXSA9PSAzIgogICAgcmVzdWx0OiB0ZXJtaW5hcgogIC0gY29uZGl0aW9uOiAidmVyYi5yb2xsc1swXSA9PSAyIGFuZCB2ZXJiLnJvbGxzWzFdID09IDQiCiAgICByZXN1bHQ6IHZpbmdhcgogIC0gY29uZGl0aW9uOiAidmVyYi5yb2xsc1swXSA9PSAyIGFuZCB2ZXJiLnJvbGxzWzFdID09IDUiCiAgICByZXN1bHQ6IGltaXRhcgogIC0gY29uZGl0aW9uOiAidmVyYi5yb2xsc1swXSA9PSAyIGFuZCB2ZXJiLnJvbGxzWzFdID09IDYiCiAgICByZXN1bHQ6IGlsdWRpcgogIC0gY29uZGl0aW9uOiAidmVyYi5yb2xsc1swXSA9PSAzIGFuZCB2ZXJiLnJvbGxzWzFdID09IDEiCiAgICByZXN1bHQ6IGVzY29uZGVyCiAgLSBjb25kaXRpb246ICJ2ZXJiLnJvbGxzWzBdID09IDMgYW5kIHZlcmIucm9sbHNbMV0gPT0gMiIKICAgIHJlc3VsdDogY29ucXVpc3RhcgogIC0gY29uZGl0aW9uOiAidmVyYi5yb2xsc1swXSA9PSAzIGFuZCB2ZXJiLnJvbGxzWzFdID09IDMiCiAgICByZXN1bHQ6IGF1bWVudGFyCiAgLSBjb25kaXRpb246ICJ2ZXJiLnJvbGxzWzBdID09IDMgYW5kIHZlcmIucm9sbHNbMV0gPT0gNCIKICAgIHJlc3VsdDogZ3VpYXIKICAtIGNvbmRpdGlvbjogInZlcmIucm9sbHNbMF0gPT0gMyBhbmQgdmVyYi5yb2xsc1sxXSA9PSA1IgogICAgcmVzdWx0OiBvcHJpbWlyCiAgLSBjb25kaXRpb246ICJ2ZXJiLnJvbGxzWzBdID09IDMgYW5kIHZlcmIucm9sbHNbMV0gPT0gNiIKICAgIHJlc3VsdDogYWp1ZGFyCiAgLSBjb25kaXRpb246ICJ2ZXJiLnJvbGxzWzBdID09IDQgYW5kIHZlcmIucm9sbHNbMV0gPT0gMSIKICAgIHJlc3VsdDogcHJvdGVnZXIKICAtIGNvbmRpdGlvbjogInZlcmIucm9sbHNbMF0gPT0gNCBhbmQgdmVyYi5yb2xsc1sxXSA9PSAyIgogICAgcmVzdWx0OiBwYWNpZmljYXIKICAtIGNvbmRpdGlvbjogInZlcmIucm9sbHNbMF0gPT0gNCBhbmQgdmVyYi5yb2xsc1sxXSA9PSAzIgogICAgcmVzdWx0OiBkaW1pbnVpcgogIC0gY29uZGl0aW9uOiAidmVyYi5yb2xsc1swXSA9PSA0IGFuZCB2ZXJiLnJvbGxzWzFdID09IDQiCiAgICByZXN1bHQ6IGV4cG9yCiAgLSBjb25kaXRpb246ICJ2ZXJiLnJvbGxzWzBdID09IDQgYW5kIHZlcmIucm9sbHNbMV0gPT0gNSIKICAgIHJlc3VsdDogZW1ib3NjYXIKICAtIGNvbmRpdGlvbjogInZlcmIucm9sbHNbMF0gPT0gNCBhbmQgdmVyYi5yb2xsc1sxXSA9PSA2IgogICAgcmVzdWx0OiBjb250cm9sYXIKICAtIGNvbmRpdGlvbjogInZlcmIucm9sbHNbMF0gPT0gNSBhbmQgdmVyYi5yb2xsc1sxXSA9PSAxIgogICAgcmVzdWx0OiBtdWRhcgogIC0gY29uZGl0aW9uOiAidmVyYi5yb2xsc1swXSA9PSA1IGFuZCB2ZXJiLnJvbGxzWzFdID09IDIiCiAgICByZXN1bHQ6IGVuY29udHJhcgogIC0gY29uZGl0aW9uOiAidmVyYi5yb2xsc1swXSA9PSA1IGFuZCB2ZXJiLnJvbGxzWzFdID09IDMiCiAgICByZXN1bHQ6IHRvbWFyCiAgLSBjb25kaXRpb246ICJ2ZXJiLnJvbGxzWzBdID09IDUgYW5kIHZlcmIucm9sbHNbMV0gPT0gNCIKICAgIHJlc3VsdDogcGxhbmVqYXIKICAtIGNvbmRpdGlvbjogInZlcmIucm9sbHNbMF0gPT0gNSBhbmQgdmVyYi5yb2xsc1sxXSA9PSA1IgogICAgcmVzdWx0OiBjcmlhcgogIC0gY29uZGl0aW9uOiAidmVyYi5yb2xsc1swXSA9PSA1IGFuZCB2ZXJiLnJvbGxzWzFdID09IDYiCiAgICByZXN1bHQ6IHJlY3VzYXIKICAtIGNvbmRpdGlvbjogInZlcmIucm9sbHNbMF0gPT0gNiBhbmQgdmVyYi5yb2xsc1sxXSA9PSAxIgogICAgcmVzdWx0OiBjb25oZWNlcgogIC0gY29uZGl0aW9uOiAidmVyYi5yb2xsc1swXSA9PSA2IGFuZCB2ZXJiLnJvbGxzWzFdID09IDIiCiAgICByZXN1bHQ6IGN1cmFyCiAgLSBjb25kaXRpb246ICJ2ZXJiLnJvbGxzWzBdID09IDYgYW5kIHZlcmIucm9sbHNbMV0gPT0gMyIKICAgIHJlc3VsdDogcGF1c2FyCiAgLSBjb25kaXRpb246ICJ2ZXJiLnJvbGxzWzBdID09IDYgYW5kIHZlcmIucm9sbHNbMV0gPT0gNCIKICAgIHJlc3VsdDogcGVyZGVyCiAgLSBjb25kaXRpb246ICJ2ZXJiLnJvbGxzWzBdID09IDYgYW5kIHZlcmIucm9sbHNbMV0gPT0gNSIKICAgIHJlc3VsdDogdHJhaXIKICAtIGNvbmRpdGlvbjogInZlcmIucm9sbHNbMF0gPT0gNiBhbmQgdmVyYi5yb2xsc1sxXSA9PSA2IgogICAgcmVzdWx0OiBhY2VpdGFyCiAgLSBjb25kaXRpb246ICJub3VuLnJvbGxzWzBdID09IDEgYW5kIG5vdW4ucm9sbHNbMV0gPT0gMSIKICAgIHJlc3VsdDogYW1iaWVudGUKICAtIGNvbmRpdGlvbjogIm5vdW4ucm9sbHNbMF0gPT0gMSBhbmQgbm91bi5yb2xsc1sxXSA9PSAyIgogICAgcmVzdWx0OiBwb2RlcgogIC0gY29uZGl0aW9uOiAibm91bi5yb2xsc1swXSA9PSAxIGFuZCBub3VuLnJvbGxzWzFdID09IDMiCiAgICByZXN1bHQ6IGZhbGhhCiAgLSBjb25kaXRpb246ICJub3VuLnJvbGxzWzBdID09IDEgYW5kIG5vdW4ucm9sbHNbMV0gPT0gNCIKICAgIHJlc3VsdDogY2xpbWEKICAtIGNvbmRpdGlvbjogIm5vdW4ucm9sbHNbMF0gPT0gMSBhbmQgbm91bi5yb2xsc1sxXSA9PSA1IgogICAgcmVzdWx0OiBhbmltYWwKICAtIGNvbmRpdGlvbjogIm5vdW4ucm9sbHNbMF0gPT0gMSBhbmQgbm91bi5yb2xsc1sxXSA9PSA2IgogICAgcmVzdWx0OiBwZXJpZ28KICAtIGNvbmRpdGlvbjogIm5vdW4ucm9sbHNbMF0gPT0gMiBhbmQgbm91bi5yb2xsc1sxXSA9PSAxIgogICAgcmVzdWx0OiBhbGlhbmNhCiAgLSBjb25kaXRpb246ICJub3VuLnJvbGxzWzBdID09IDIgYW5kIG5vdW4ucm9sbHNbMV0gPT0gMiIKICAgIHJlc3VsdDogcHJvYmxlbWEKICAtIGNvbmRpdGlvbjogIm5vdW4ucm9sbHNbMF0gPT0gMiBhbmQgbm91bi5yb2xsc1sxXSA9PSAzIgogICAgcmVzdWx0OiBhdGVuY2FvCiAgLSBjb25kaXRpb246ICJub3VuLnJvbGxzWzBdID09IDIgYW5kIG5vdW4ucm9sbHNbMV0gPT0gNCIKICAgIHJlc3VsdDogYm9hdG8KICAtIGNvbmRpdGlvbjogIm5vdW4ucm9sbHNbMF0gPT0gMiBhbmQgbm91bi5yb2xsc1sxXSA9PSA1IgogICAgcmVzdWx0OiBuZWdvY2lvCiAgLSBjb25kaXRpb246ICJub3VuLnJvbGxzWzBdID09IDIgYW5kIG5vdW4ucm9sbHNbMV0gPT0gNiIKICAgIHJlc3VsdDogY2lsYWRhCiAgLSBjb25kaXRpb246ICJub3VuLnJvbGxzWzBdID09IDMgYW5kIG5vdW4ucm9sbHNbMV0gPT0gMSIKICAgIHJlc3VsdDogaW5pbWlnbwogIC0gY29uZGl0aW9uOiAibm91bi5yb2xsc1swXSA9PSAzIGFuZCBub3VuLnJvbGxzWzFdID09IDIiCiAgICByZXN1bHQ6IGxhcgogIC0gY29uZGl0aW9uOiAibm91bi5yb2xsc1swXSA9PSAzIGFuZCBub3VuLnJvbGxzWzFdID09IDMiCiAgICByZXN1bHQ6IGZlcmltZW50bwogIC0gY29uZGl0aW9uOiAibm91bi5yb2xsc1swXSA9PSAzIGFuZCBub3VuLnJvbGxzWzFdID09IDQiCiAgICByZXN1bHQ6IGNhaWRvCiAgLSBjb25kaXRpb246ICJub3VuLnJvbGxzWzBdID09IDMgYW5kIG5vdW4ucm9sbHNbMV0gPT0gNSIKICAgIHJlc3VsdDogbWVkbwogIC0gY29uZGl0aW9uOiAibm91bi5yb2xsc1swXSA9PSAzIGFuZCBub3VuLnJvbGxzWzFdID09IDYiCiAgICByZXN1bHQ6IHByb3ZhCiAgLSBjb25kaXRpb246ICJub3VuLnJvbGxzWzBdID09IDQgYW5kIG5vdW4ucm9sbHNbMV0gPT0gMSIKICAgIHJlc3VsdDogY29uZnJvbnRvCiAgLSBjb25kaXRpb246ICJub3VuLnJvbGxzWzBdID09IDQgYW5kIG5vdW4ucm9sbHNbMV0gPT0gMiIKICAgIHJlc3VsdDogY2FtaW5obwogIC0gY29uZGl0aW9uOiAibm91bi5yb2xsc1swXSA9PSA0IGFuZCBub3VuLnJvbGxzWzFdID09IDMiCiAgICByZXN1bHQ6IGlsdXNhbwogIC0gY29uZGl0aW9uOiAibm91bi5yb2xsc1swXSA9PSA0IGFuZCBub3VuLnJvbGxzWzFdID09IDQiCiAgICByZXN1bHQ6IGZlCiAgLSBjb25kaXRpb246ICJub3VuLnJvbGxzWzBdID09IDQgYW5kIG5vdW4ucm9sbHNbMV0gPT0gNSIKICAgIHJlc3VsdDogc29saWRhbwogIC0gY29uZGl0aW9uOiAibm91bi5yb2xsc1swXSA9PSA0IGFuZCBub3VuLnJvbGxzWzFdID09IDYiCiAgICByZXN1bHQ6IHZhemlvCiAgLSBjb25kaXRpb246ICJub3VuLnJvbGxzWzBdID09IDUgYW5kIG5vdW4ucm9sbHNbMV0gPT0gMSIKICAgIHJlc3VsdDogZG9yCiAgLSBjb25kaXRpb246ICJub3VuLnJvbGxzWzBdID09IDUgYW5kIG5vdW4ucm9sbHNbMV0gPT0gMiIKICAgIHJlc3VsdDogZG9lbmNhCiAgLSBjb25kaXRpb246ICJub3VuLnJvbGxzWzBdID09IDUgYW5kIG5vdW4ucm9sbHNbMV0gPT0gMyIKICAgIHJlc3VsdDogcmFpdmEKICAtIGNvbmRpdGlvbjogIm5vdW4ucm9sbHNbMF0gPT0gNSBhbmQgbm91bi5yb2xsc1sxXSA9PSA0IgogICAgcmVzdWx0OiB2aWFnZW0KICAtIGNvbmRpdGlvbjogIm5vdW4ucm9sbHNbMF0gPT0gNSBhbmQgbm91bi5yb2xsc1sxXSA9PSA1IgogICAgcmVzdWx0OiBlc3BlcmFuY2EKICAtIGNvbmRpdGlvbjogIm5vdW4ucm9sbHNbMF0gPT0gNSBhbmQgbm91bi5yb2xsc1sxXSA9PSA2IgogICAgcmVzdWx0OiBvYmpldGl2bwogIC0gY29uZGl0aW9uOiAibm91bi5yb2xsc1swXSA9PSA2IGFuZCBub3VuLnJvbGxzWzFdID09IDEiCiAgICByZXN1bHQ6IG1lbnRpcmEKICAtIGNvbmRpdGlvbjogIm5vdW4ucm9sbHNbMF0gPT0gNiBhbmQgbm91bi5yb2xsc1sxXSA9PSAyIgogICAgcmVzdWx0OiBtb3J0ZQogIC0gY29uZGl0aW9uOiAibm91bi5yb2xsc1swXSA9PSA2IGFuZCBub3VuLnJvbGxzWzFdID09IDMiCiAgICByZXN1bHQ6IHBpc3RhCiAgLSBjb25kaXRpb246ICJub3VuLnJvbGxzWzBdID09IDYgYW5kIG5vdW4ucm9sbHNbMV0gPT0gNCIKICAgIHJlc3VsdDogcmlxdWV6YQogIC0gY29uZGl0aW9uOiAibm91bi5yb2xsc1swXSA9PSA2IGFuZCBub3VuLnJvbGxzWzFdID09IDUiCiAgICByZXN1bHQ6IHZlcmRhZGUKICAtIGNvbmRpdGlvbjogIm5vdW4ucm9sbHNbMF0gPT0gNiBhbmQgbm91bi5yb2xsc1sxXSA9PSA2IgogICAgcmVzdWx0OiBzdWNlc3NvCg==",zs="data:text/yaml;base64,c3lzdGVtOiBpbmZhZXJudW1fc2ltX291X25hbwpsYWJlbDogIkluZmFlcm51bSDigJQgU2ltIG91IE7Do28iCnJvbGxfdHlwZTogc2ltcGxlCmlucHV0czoKICAtIGlkOiBjaGFuY2UKICAgIGxhYmVsOiAiQ2hhbmNlIgogICAgdHlwZTogc2VsZWN0CiAgICBvcHRpb25zOgogICAgICAtIHsgdmFsdWU6ICIwIiwgbGFiZWw6ICJOZXV0cm8iIH0KICAgICAgLSB7IHZhbHVlOiAiMSIsIGxhYmVsOiAiUHJvdsOhdmVsIiB9CiAgICAgIC0geyB2YWx1ZTogIi0xIiwgbGFiZWw6ICJJbXByb3bDoXZlbCIgfQpmaWVsZHM6CiAgLSBpZDogcm9sbAogICAgZGljZTogIjFkNiIKICAgIG1vZGlmaWVyOiAie2lucHV0LmNoYW5jZX0iCm91dGNvbWVfcnVsZXM6CiAgLSBjb25kaXRpb246ICJyb2xsLnRvdGFsID49IDQiCiAgICByZXN1bHQ6IHNpbQogIC0gY29uZGl0aW9uOiAicm9sbC50b3RhbCA8IDQiCiAgICByZXN1bHQ6IG5hbwo=",xs="data:text/yaml;base64,c3lzdGVtOiBpcm9uc3dvcm4KbGFiZWw6ICJJcm9uc3dvcm4g4oCUIEHDp8OjbyIKcm9sbF90eXBlOiBjb21wYXJpc29uCmlucHV0czoKICAtIGlkOiBhdHRyaWJ1dGUKICAgIGxhYmVsOiAiQXRyaWJ1dG8iCiAgICB0eXBlOiBudW1iZXIKICAgIGRlZmF1bHQ6ICIwIgpmaWVsZHM6CiAgLSBpZDogYWN0aW9uCiAgICBkaWNlOiAiMWQ2IgogICAgbW9kaWZpZXI6ICJ7aW5wdXQuYXR0cmlidXRlfSIKICAtIGlkOiBjaGFsbGVuZ2UKICAgIGRpY2U6ICIyZDEwIgogICAgY29tcGFyZV9pbmRpdmlkdWFsbHk6IHRydWUKb3V0Y29tZV9ydWxlczoKICAtIGNvbmRpdGlvbjogImFjdGlvbi50b3RhbCA+IGNoYWxsZW5nZVswXSBhbmQgYWN0aW9uLnRvdGFsID4gY2hhbGxlbmdlWzFdIgogICAgcmVzdWx0OiBzdHJvbmdfaGl0CiAgLSBjb25kaXRpb246ICJhY3Rpb24udG90YWwgPiBjaGFsbGVuZ2VbMF0geG9yIGFjdGlvbi50b3RhbCA+IGNoYWxsZW5nZVsxXSIKICAgIHJlc3VsdDogd2Vha19oaXQKICAtIGNvbmRpdGlvbjogImFjdGlvbi50b3RhbCA8PSBjaGFsbGVuZ2VbMF0gYW5kIGFjdGlvbi50b3RhbCA8PSBjaGFsbGVuZ2VbMV0iCiAgICByZXN1bHQ6IG1pc3MKICAtIGNvbmRpdGlvbjogImNoYWxsZW5nZVswXSA9PSBjaGFsbGVuZ2VbMV0iCiAgICByZXN1bHQ6IG1hdGNoCg==",Ks="data:text/yaml;base64,c3lzdGVtOiBwYnRhCmxhYmVsOiAiUGJ0QSAoMmQ2KSIKcm9sbF90eXBlOiBzaW1wbGUKaW5wdXRzOgogIC0gaWQ6IG1vZGUKICAgIGxhYmVsOiAiTW9kbyIKICAgIHR5cGU6IHNlbGVjdAogICAgb3B0aW9uczoKICAgICAgLSB7IHZhbHVlOiAiIiwgbGFiZWw6ICJOb3JtYWwiIH0KICAgICAgLSB7IHZhbHVlOiAiYWR2IiwgbGFiZWw6ICJWYW50YWdlbSIgfQogICAgICAtIHsgdmFsdWU6ICJkaXMiLCBsYWJlbDogIkRlc3ZhbnRhZ2VtIiB9CiAgLSBpZDogbW9kCiAgICBsYWJlbDogIk1vZGlmaWNhZG9yIgogICAgdHlwZTogbnVtYmVyCiAgICBkZWZhdWx0OiAiMCIKZmllbGRzOgogICMgVmFudGFnZW0vZGVzdmFudGFnZW0gbmFvIGUgcmVncmEgb2ZpY2lhbCBkbyBQYnRBIChxdWUgdXNhICsxCiAgIyBmb3J3YXJkL29uZ29pbmcg4oCUIGphIGNvYmVydG8gcG9yICJtb2QiKSwgbWFzIHZhcmlvcyBoYWNrcyB0ZW0gZXNzYQogICMgb3BjYW8gKGV4LjogS3VsdCB1c2EgYSBtZXNtYSBpZGVpYSBubyBwYnRhMmQxMC55YW1sKS4gIjJkNmFkdiIgdmlyYQogICMgM2Q2a2gyIChhY3VjYXIgZG8gcGFyc2VyKSDigJQgZmljYSBjb20gb3MgMiBtYWlvcmVzIGRlIDMuCiAgLSBpZDogcm9sbAogICAgZGljZTogIjJkNntpbnB1dC5tb2RlfSIKICAgIG1vZGlmaWVyOiAie2lucHV0Lm1vZH0iCm91dGNvbWVfcnVsZXM6CiAgLSBjb25kaXRpb246ICJyb2xsLnRvdGFsID49IDEwIgogICAgcmVzdWx0OiBzdHJvbmdfaGl0CiAgIyBUaWVyIGV4Y2x1c2l2bzogc2VtIG8gdGV0bywgdW0gc3Ryb25nX2hpdCAoPj0xMCkgdGFtYmVtIG1hcmNhcmlhCiAgIyB3ZWFrX2hpdCBlIGEgVUkgZXhpYmlyaWEgZG9pcyBvdXRjb21lcyBjb250cmFkaXRvcmlvcy4KICAtIGNvbmRpdGlvbjogInJvbGwudG90YWwgPj0gNyBhbmQgcm9sbC50b3RhbCA8IDEwIgogICAgcmVzdWx0OiB3ZWFrX2hpdAogIC0gY29uZGl0aW9uOiAicm9sbC50b3RhbCA8IDciCiAgICByZXN1bHQ6IG1pc3MK",Ds="data:text/yaml;base64,c3lzdGVtOiBwYnRhMmQxMApsYWJlbDogIlBidEEgKDJkMTApIgpyb2xsX3R5cGU6IHNpbXBsZQppbnB1dHM6CiAgLSBpZDogbW9kZQogICAgbGFiZWw6ICJNb2RvIgogICAgdHlwZTogc2VsZWN0CiAgICBvcHRpb25zOgogICAgICAtIHsgdmFsdWU6ICIiLCBsYWJlbDogIk5vcm1hbCIgfQogICAgICAtIHsgdmFsdWU6ICJhZHYiLCBsYWJlbDogIlZhbnRhZ2VtIiB9CiAgICAgIC0geyB2YWx1ZTogImRpcyIsIGxhYmVsOiAiRGVzdmFudGFnZW0iIH0KICAtIGlkOiBtb2QKICAgIGxhYmVsOiAiTW9kaWZpY2Fkb3IiCiAgICB0eXBlOiBudW1iZXIKICAgIGRlZmF1bHQ6ICIwIgpmaWVsZHM6CiAgIyAiMmQxMGFkdiIgLT4gM2QxMGtoMiAoYWN1Y2FyIGRvIHBhcnNlcikg4oCUIGZpY2EgY29tIG9zIDIgbWFpb3JlcyBkZSAzLgogIC0gaWQ6IHJvbGwKICAgIGRpY2U6ICIyZDEwe2lucHV0Lm1vZGV9IgogICAgbW9kaWZpZXI6ICJ7aW5wdXQubW9kfSIKIyBSZXVzYSBvcyBtZXNtb3MgaWRzIGRlIG91dGNvbWUgZG8gcGJ0YSAyZDYgKHN0cm9uZ19oaXQvd2Vha19oaXQvbWlzcykg4oCUCiMgbWVzbW9zIHRpZXJzIG5hcnJhdGl2b3MsIHNvIGEgZXNjYWxhIGRlIGRhZG8gbXVkYS4gQXNzaW0gbyByb3R1bG8vY29yIGRhCiMgVUkgKGFwcHMvd2ViL3NyYy9mb3JtYXQudHMpIGphIGZ1bmNpb25hIHNlbSBlbnRyYWRhIG5vdmEgbm8gbWFwYS4Kb3V0Y29tZV9ydWxlczoKICAtIGNvbmRpdGlvbjogInJvbGwudG90YWwgPj0gMTUiCiAgICByZXN1bHQ6IHN0cm9uZ19oaXQKICAtIGNvbmRpdGlvbjogInJvbGwudG90YWwgPj0gMTAgYW5kIHJvbGwudG90YWwgPCAxNSIKICAgIHJlc3VsdDogd2Vha19oaXQKICAtIGNvbmRpdGlvbjogInJvbGwudG90YWwgPCAxMCIKICAgIHJlc3VsdDogbWlzcwo=",js="data:text/yaml;base64,c3lzdGVtOiBwb29sX2Q2CmxhYmVsOiAiUG9vbCBkZSBkNiAoU2hhZG93cnVuKSIKcm9sbF90eXBlOiBzaW1wbGUKaW5wdXRzOgogIC0gaWQ6IHBvb2xfc2l6ZQogICAgbGFiZWw6ICJUYW1hbmhvIGRvIHBvb2wiCiAgICB0eXBlOiBudW1iZXIKICAtIGlkOiB0aHJlc2hvbGQKICAgIGxhYmVsOiAiTGltaXRlIChhY2VydG9zIG5lY2Vzc8OhcmlvcykiCiAgICB0eXBlOiBudW1iZXIKICAgIHJlcXVpcmVkOiBmYWxzZQpmaWVsZHM6CiAgLSBpZDogcG9vbAogICAgZGljZTogIntpbnB1dC5wb29sX3NpemV9ZDYiCiAgICBjb21wYXJlX2luZGl2aWR1YWxseTogdHJ1ZQogICAgc3VjY2Vzc19ydWxlOiAiPj01IgojIDUgb3UgNiBlIGFjZXJ0byDigJQgc3VjY2Vzc19ydWxlIGZheiBgcG9vbC50b3RhbGAgdmlyYXIgYSBDT05UQUdFTSBkZQojIGFjZXJ0b3MgKG5hbyBhIHNvbWEgZG9zIGRhZG9zKSwgZW50YW8gIlsyLCA1LCA2LCAxXSA9IDIiIGphIG1vc3RyYSBvCiMgbnVtZXJvIGRlIHN1Y2Vzc29zIHNlbSBvIGpvZ2Fkb3IgY29udGFyIG5hIG1hby4gR2xpdGNoOiBtYWlzIGRlIG1ldGFkZQojIGRvIHBvb2wgbW9zdHJhIDEgKGdsaXRjaCBjcml0aWNvIHNlLCBhbGVtIGRpc3NvLCB6ZXJvIGFjZXJ0b3MpLgojICJ0aHJlc2hvbGQiIGUgb3BjaW9uYWw6IHNlbSBlbGUgc28gYSBjb250YWdlbSBleGlzdGUsIHNlbSBzdWNjZXNzL2ZhaWwuCm91dGNvbWVfcnVsZXM6CiAgLSBjb25kaXRpb246ICJjb3VudChwb29sLCAnPT0xJykgPiB7aW5wdXQucG9vbF9zaXplfSAvIDIgYW5kIHBvb2wudG90YWwgPT0gMCIKICAgIHJlc3VsdDogY3JpdGljYWxfZ2xpdGNoCiAgLSBjb25kaXRpb246ICJjb3VudChwb29sLCAnPT0xJykgPiB7aW5wdXQucG9vbF9zaXplfSAvIDIgYW5kIHBvb2wudG90YWwgPj0gMSIKICAgIHJlc3VsdDogZ2xpdGNoCiAgLSBjb25kaXRpb246ICJwb29sLnRvdGFsID49IHtpbnB1dC50aHJlc2hvbGR9IgogICAgcmVzdWx0OiBzdWNjZXNzCiAgLSBjb25kaXRpb246ICJwb29sLnRvdGFsIDwge2lucHV0LnRocmVzaG9sZH0iCiAgICByZXN1bHQ6IGZhaWwK",Ms="data:text/yaml;base64,c3lzdGVtOiByb2xsX3VuZGVyCmxhYmVsOiAiR2Vuw6lyaWNvIOKAlCBSb2xsIFVuZGVyIgpyb2xsX3R5cGU6IG92ZXJsYXkKIyBOdW1lcm8gTUVOT1IgZSBtZWxob3IgYXF1aSAocm9sbC50b3RhbCA8PSB0YXJnZXQpIOKAlCBvIG9wb3N0byBkZSBkMjAvcGJ0YSwKIyBvbmRlICJhZHYiIChWYW50YWdlbSkgZmljYSBjb20gbyBkYWRvIE1BSU9SLiBTZW0gaXN0byAiVmFudGFnZW0iIGZhcmlhIGEKIyByb2xhZ2VtIFBJT1JBUiBlbSByb2xsX3VuZGVyIChhcGxpY2EgbyB0b2tlbiBsaXRlcmFsICJhZHYiIGRvIHBhcnNlciwKIyBxdWUgc2VtcHJlIHNpZ25pZmljYSAiZmljYSBjb20gbyBtYWlvciIpIOKAlCB2ZXIgYXBwbHlPdmVybGF5TW9kZS4KbW9kZV9mYXZvcnNfbG93OiB0cnVlCmlucHV0czoKICAtIGlkOiBtb2RlCiAgICBsYWJlbDogIk1vZG8iCiAgICB0eXBlOiBzZWxlY3QKICAgIG9wdGlvbnM6CiAgICAgIC0geyB2YWx1ZTogIiIsIGxhYmVsOiAiTm9ybWFsIiB9CiAgICAgIC0geyB2YWx1ZTogImFkdiIsIGxhYmVsOiAiVmFudGFnZW0iIH0KICAgICAgLSB7IHZhbHVlOiAiZGlzIiwgbGFiZWw6ICJEZXN2YW50YWdlbSIgfQogIC0gaWQ6IHRhcmdldAogICAgbGFiZWw6ICJWYWxvciB0ZXN0YWRvIgogICAgdHlwZTogbnVtYmVyCiAgICByZXF1aXJlZDogZmFsc2UKZmllbGRzOiBbXQojIFN1Y2Vzc28gZSByb2xhciBpZ3VhbCBvdSBtZW5vciBxdWUgbyB2YWxvciB0ZXN0YWRvIOKAlCBvIG9wb3N0byBkbyBkMjAvZDEwMC4KIyBTZW0gZGFkbyBwcm9wcmlvOiBhIHJvbGFnZW0gdmVtIGRvIGNvbXBvc2VyIGRlIG5vdGFjYW8gbGl2cmUgbm9ybWFsCiMgKDFkMjAsIDNkNiwgbyBxdWUgYSBtZXNhIHVzYXIpIOKAlCB2ZXIgcm9sbE92ZXJsYXkgZW0gcHJvZmlsZS50cy4gInJvbGwiIGUKIyBvIG5vbWUgcXVlIG8gcGFyc2VyIGRhIHBybyBncnVwbyB1bmljbyBkZSBub3RhY2FvIGxpdnJlLgojICJ0YXJnZXQiIGUgb3BjaW9uYWw6IHNlbSBlbGUsIHNvIGEgcm9sYWdlbSBleGlzdGUsIHNlbSBvdXRjb21lX3J1bGUKIyBiYXRlbmRvIChldmFsdWF0ZU91dGNvbWVSdWxlcyBwdWxhIHJlZ3JhIHF1ZSByZWZlcmVuY2lhIGlucHV0IGF1c2VudGUpLgojICJtb2RlIjogYXBsaWNhZG8gZW0gY2ltYSBkYSBub3RhY2FvIGRvIGNvbXBvc2VyIChuYW8gZGUgdW0gZmllbGQgZG8KIyBwcm9maWxlIOKAlCBlc3RlIGUgIm92ZXJsYXkiLCBuYW8gdGVtIGRhZG8gcHJvcHJpbykgc28gcXVhbmRvIGVsYSBlIFVNCiMgdGVybW8gc2ltcGxlcyAoIjFkMjAiLCAiM2Q2Iik7IHBvb2wgY29tcG9zdG8gKCIyZDYrMWQ0IikgaWdub3JhIG8gbW9kbwojIGVtIHNpbGVuY2lvIOKAlCB2ZXIgYXBwbHlPdmVybGF5TW9kZSBlbSBwcm9maWxlLnRzLgpvdXRjb21lX3J1bGVzOgogIC0gY29uZGl0aW9uOiAicm9sbC50b3RhbCA8PSB7aW5wdXQudGFyZ2V0fSIKICAgIHJlc3VsdDogc3VjY2VzcwogIC0gY29uZGl0aW9uOiAicm9sbC50b3RhbCA+IHtpbnB1dC50YXJnZXR9IgogICAgcmVzdWx0OiBmYWlsCg==",Ls="data:text/yaml;base64,IyBQZXJmaWwgZGUgc2lzdGVtYTogVHJvcGh5IERhcmsgKEhlZGdlbWF6ZSBQcmVzcyAvIFRoZSBHYXVudGxldCkKIwojIE5vIFRyb3BoeSBEYXJrLCB0b2RvIHRlc3RlIGRlIHJpc2NvIChSaXNrIFJvbGwpIHVzYSB1bSBwb29sIGRlIGRhZG9zIGQ2IGRlCiMgZHVhcyBjb3JlczogZGFkb3MgQ2xhcm9zIChwZXLDrWNpYXMgZSBEZXZpbCdzIEJhcmdhaW5zKSBlIGRhZG9zIEVzY3Vyb3MKIyAoYXJyaXNjYXIgYSBtZW50ZS9jb3Jwbywgcml0dWFpcyBvdSBmb3LDp2FyKS4KIwojIE8gbWFpb3IgZGFkbyBnZXJhbCBkZWNpZGUgbyByZXN1bHRhZG8gZGEgYcOnw6NvOgojICAgNjogU3VjZXNzbyBjb21wbGV0bwojICAgNC01OiBTdWNlc3NvIHBhcmNpYWwgLyBjb20gY29tcGxpY2HDp8OjbwojICAgMS0zOiBGYWxoYSAvIGRlc2FzdHJlCiMKIyBTZSBvIG1haW9yIGRhZG8gZGEgcm9sYWdlbSBlc3RpdmVyIGVtIHVtIERhZG8gRXNjdXJvIEUgZm9yIG1haW9yIG91IGlndWFsIMOgCiMgc3VhIFJ1w61uYSBhdHVhbCwgc3VhIFJ1w61uYSBhdW1lbnRhIGVtICsxLgoKc3lzdGVtOiB0cm9waHlfZGFyawpsYWJlbDogIlRyb3BoeSBEYXJrIgpyb2xsX3R5cGU6IG11bHRpCgppbnB1dHM6CiAgLSBpZDogY2xhcm9zCiAgICBsYWJlbDogIkRhZG9zIENsYXJvcyIKICAgIHR5cGU6IG51bWJlcgogICAgcmVxdWlyZWQ6IHRydWUKICAgIGRlZmF1bHQ6ICIxIgogIC0gaWQ6IGVzY3Vyb3MKICAgIGxhYmVsOiAiRGFkb3MgRXNjdXJvcyIKICAgIHR5cGU6IG51bWJlcgogICAgcmVxdWlyZWQ6IHRydWUKICAgIGRlZmF1bHQ6ICIwIgogIC0gaWQ6IHJ1aW5hCiAgICBsYWJlbDogIlN1YSBSdcOtbmEiCiAgICB0eXBlOiBudW1iZXIKICAgIHJlcXVpcmVkOiB0cnVlCiAgICBkZWZhdWx0OiAiMSIKCmZpZWxkczoKICAtIGlkOiBjbGFyb3MKICAgIGRpY2U6ICJ7aW5wdXQuY2xhcm9zfWQ2IgogICAgY29tcGFyZV9pbmRpdmlkdWFsbHk6IHRydWUKICAgIHplcm9fZGljZV9mYWxsYmFjazogIjBkNiIKICAgIHNsb3Q6IDEKICAtIGlkOiBlc2N1cm9zCiAgICBkaWNlOiAie2lucHV0LmVzY3Vyb3N9ZDYiCiAgICBjb21wYXJlX2luZGl2aWR1YWxseTogdHJ1ZQogICAgemVyb19kaWNlX2ZhbGxiYWNrOiAiMGQ2IgogICAgc2xvdDogMgoKb3V0Y29tZV9ydWxlczoKICAjIE91dGNvbWUgcHJpbmNpcGFsIHBlbG8gbWFpb3IgZGFkbyBlbnRyZSBjbGFyb3MgZSBlc2N1cm9zCiAgLSBjb25kaXRpb246ICJtYXgoY2xhcm9zLCBlc2N1cm9zKSA9PSA2IgogICAgcmVzdWx0OiAic3VjY2VzcyIKICAtIGNvbmRpdGlvbjogIm1heChjbGFyb3MsIGVzY3Vyb3MpID49IDQgYW5kIG1heChjbGFyb3MsIGVzY3Vyb3MpIDw9IDUiCiAgICByZXN1bHQ6ICJ3ZWFrX2hpdCIKICAtIGNvbmRpdGlvbjogIm1heChjbGFyb3MsIGVzY3Vyb3MpIDw9IDMiCiAgICByZXN1bHQ6ICJtaXNzIgoKICAjIEF1bWVudG8gZGUgUnXDrW5hOiBzZSBvIG1haW9yIGRhZG8gZm9yIGVzY3VybyBlIGJhdGVyL3N1cGVyYXIgYSBSdcOtbmEgYXR1YWwKICAtIGNvbmRpdGlvbjogImNvdW50KGVzY3Vyb3MsICc+PTEnKSA+IDAgYW5kIG1heChlc2N1cm9zKSA+PSBtYXgoY2xhcm9zKSBhbmQgbWF4KGVzY3Vyb3MpID49IHtpbnB1dC5ydWluYX0iCiAgICByZXN1bHQ6ICJ0cm9waHlfcnVpbmFfYXVtZW50YSIK",Es="data:text/yaml;base64,IyBQZXJmaWwgZGUgc2lzdGVtYTogVHJvcGh5IEdvbGQgKEhlZGdlbWF6ZSBQcmVzcyAvIFRoZSBHYXVudGxldCkKIwojIFRyb3BoeSBHb2xkIGV4cGFuZGUgYSBtZWPDom5pY2EgZG8gVHJvcGh5IHBhcmEgZXhwbG9yYcOnw6NvIGRlIG1hc21vcnJhcyBlCiMgY29tYmF0ZSBlbSBjYW1wYW5oYXMuIFV0aWxpemEgZGFkb3MgQ2xhcm9zIGUgRXNjdXJvcyAoUnXDrW5hKS4KIwojIE8gbWFpb3IgZGFkbyBnZXJhbCBkZWNpZGUgbyByZXN1bHRhZG8gZGEgYcOnw6NvOgojICAgNjogU3VjZXNzbyBjb21wbGV0byAodml0w7NyaWEgbGltcGEgLyBzZW0gc29mcmVyIGRhbm8pCiMgICA0LTU6IFN1Y2Vzc28gcGFyY2lhbCAoYXZhbsOnbyBjb20gY3VzdG8gLyBkYW5vIG3DunR1bykKIyAgIDEtMzogRmFsaGEgLyBjb250cmF0ZW1wbwojCiMgU2UgbyBtYWlvciBkYWRvIGRhIHJvbGFnZW0gZXN0aXZlciBlbSB1bSBEYWRvIEVzY3VybyBFIGZvciBtYWlvciBvdSBpZ3VhbCDDoAojIHN1YSBSdcOtbmEgYXR1YWwsIHN1YSBSdcOtbmEgYXVtZW50YSBlbSArMS4KCnN5c3RlbTogdHJvcGh5X2dvbGQKbGFiZWw6ICJUcm9waHkgR29sZCIKcm9sbF90eXBlOiBtdWx0aQoKaW5wdXRzOgogIC0gaWQ6IGNsYXJvcwogICAgbGFiZWw6ICJEYWRvcyBDbGFyb3MiCiAgICB0eXBlOiBudW1iZXIKICAgIHJlcXVpcmVkOiB0cnVlCiAgICBkZWZhdWx0OiAiMSIKICAtIGlkOiBlc2N1cm9zCiAgICBsYWJlbDogIkRhZG9zIEVzY3Vyb3MiCiAgICB0eXBlOiBudW1iZXIKICAgIHJlcXVpcmVkOiB0cnVlCiAgICBkZWZhdWx0OiAiMCIKICAtIGlkOiBydWluYQogICAgbGFiZWw6ICJTdWEgUnXDrW5hIgogICAgdHlwZTogbnVtYmVyCiAgICByZXF1aXJlZDogdHJ1ZQogICAgZGVmYXVsdDogIjEiCgpmaWVsZHM6CiAgLSBpZDogY2xhcm9zCiAgICBkaWNlOiAie2lucHV0LmNsYXJvc31kNiIKICAgIGNvbXBhcmVfaW5kaXZpZHVhbGx5OiB0cnVlCiAgICB6ZXJvX2RpY2VfZmFsbGJhY2s6ICIwZDYiCiAgICBzbG90OiAxCiAgLSBpZDogZXNjdXJvcwogICAgZGljZTogIntpbnB1dC5lc2N1cm9zfWQ2IgogICAgY29tcGFyZV9pbmRpdmlkdWFsbHk6IHRydWUKICAgIHplcm9fZGljZV9mYWxsYmFjazogIjBkNiIKICAgIHNsb3Q6IDIKCm91dGNvbWVfcnVsZXM6CiAgLSBjb25kaXRpb246ICJtYXgoY2xhcm9zLCBlc2N1cm9zKSA9PSA2IgogICAgcmVzdWx0OiAic3VjY2VzcyIKICAtIGNvbmRpdGlvbjogIm1heChjbGFyb3MsIGVzY3Vyb3MpID49IDQgYW5kIG1heChjbGFyb3MsIGVzY3Vyb3MpIDw9IDUiCiAgICByZXN1bHQ6ICJ3ZWFrX2hpdCIKICAtIGNvbmRpdGlvbjogIm1heChjbGFyb3MsIGVzY3Vyb3MpIDw9IDMiCiAgICByZXN1bHQ6ICJtaXNzIgoKICAtIGNvbmRpdGlvbjogImNvdW50KGVzY3Vyb3MsICc+PTEnKSA+IDAgYW5kIG1heChlc2N1cm9zKSA+PSBtYXgoY2xhcm9zKSBhbmQgbWF4KGVzY3Vyb3MpID49IHtpbnB1dC5ydWluYX0iCiAgICByZXN1bHQ6ICJ0cm9waHlfcnVpbmFfYXVtZW50YSIK",Ts="data:text/yaml;base64,c3lzdGVtOiB3b2Q1CmxhYmVsOiAiV29ybGQgb2YgRGFya25lc3MgdjUg4oCUIFBvb2wgZGUgc3VjZXNzb3MiCnJvbGxfdHlwZTogbXVsdGkKaW5wdXRzOgogIC0gaWQ6IHJlZ3VsYXIKICAgIGxhYmVsOiAiRGFkb3MgcmVndWxhcmVzIgogICAgdHlwZTogbnVtYmVyCiAgLSBpZDogaHVuZ2VyCiAgICBsYWJlbDogIkRhZG9zIGRlIEZvbWUvSXJhIgogICAgdHlwZTogbnVtYmVyCiAgLSBpZDogZGlmZmljdWx0eQogICAgbGFiZWw6ICJEaWZpY3VsZGFkZSAoc3VjZXNzb3MgbmVjZXNzw6FyaW9zKSIKICAgIHR5cGU6IG51bWJlcgogICAgcmVxdWlyZWQ6IGZhbHNlCmZpZWxkczoKICAtIGlkOiByZWd1bGFyCiAgICBkaWNlOiAie2lucHV0LnJlZ3VsYXJ9ZDEwIgogICAgY29tcGFyZV9pbmRpdmlkdWFsbHk6IHRydWUKICAgIHN1Y2Nlc3NfcnVsZTogIj49NiIKICAgIHNsb3Q6IDEKICAtIGlkOiBodW5nZXIKICAgIGRpY2U6ICJ7aW5wdXQuaHVuZ2VyfWQxMCIKICAgIGNvbXBhcmVfaW5kaXZpZHVhbGx5OiB0cnVlCiAgICBzdWNjZXNzX3J1bGU6ICI+PTYiCiAgICBzbG90OiAyCiMgTWVjYW5pY2EgY29tcGFydGlsaGFkYSBwb3IgdG9kYSBhIGxpbmhhIHY1IChWYW1waXJvLCBMb2Jpc29tZW0sIENhw6dhZG9yLi4uKQojIOKAlCBvcyBkYWRvcyBkZSBGb21lL0lyYSBTVUJTVElUVUVNIHBhcnRlIGRvIHBvb2wgcmVndWxhciwgZW50YW8gYW1ib3Mgb3MKIyBjYW1wb3MgZXhpZ2VtID49MSBkYWRvIGNhZGEgKGxpbWl0ZSBkbyBwYXJzZXIgZGUgbm90YWNhbzogIjBkMTAiIG5hbyBlCiMgdmFsaWRvKS4gQ29icmUgbyBjYXNvIGNvbXVtOyBGb21lIDAgb3UgcG9vbCAxMDAlIEZvbWUgZmljYW0gZm9yYS4KIyA2LTkgPSAxIHN1Y2Vzc28sIDEwID0gMSBzdWNlc3NvLCBlIGNhZGEgUEFSIGRlIDEwcyAocmVndWxhcitmb21lIGp1bnRvcykKIyBzb21hICsyIHN1Y2Vzc29zIGV4dHJhIOKAlCBjcml0aWNvICJsaW1wbyIgc2VtIGRhZG8gZGUgRm9tZSBubyBwYXIsICJzdWpvIgojIChtZXNzeSkgY29tIHBlbG8gbWVub3MgdW0uIEZyYWNhc3NvIGNvbSB6ZXJvIHN1Y2Vzc29zIGUgdW0gMSBuYSBGb21lIHZpcmEKIyBmcmFjYXNzbyBiZXN0aWFsLiAiZGlmZmljdWx0eSIgZSBvcGNpb25hbDogc2VtIGVsYSBzbyBvcyBldmVudG9zCiMgaW50cmluc2Vjb3MgYW8gcG9vbCAoY3JpdGljby9tZXNzeS9iZXN0aWFsKSBhcGFyZWNlbSwgc2VtIHN1Y2Nlc3MvZmFpbC4Kb3V0Y29tZV9ydWxlczoKICAtIGNvbmRpdGlvbjogIihjb3VudChyZWd1bGFyLCAnPT0xMCcpICsgY291bnQoaHVuZ2VyLCAnPT0xMCcpKSA+PSAyIGFuZCBjb3VudChodW5nZXIsICc9PTEwJykgPj0gMSIKICAgIHJlc3VsdDogbWVzc3lfY3JpdGljYWwKICAtIGNvbmRpdGlvbjogIihjb3VudChyZWd1bGFyLCAnPT0xMCcpICsgY291bnQoaHVuZ2VyLCAnPT0xMCcpKSA+PSAyIGFuZCBjb3VudChodW5nZXIsICc9PTEwJykgPT0gMCIKICAgIHJlc3VsdDogY3JpdGljYWwKICAtIGNvbmRpdGlvbjogIihjb3VudChyZWd1bGFyLCAnPj02JykgKyBjb3VudChodW5nZXIsICc+PTYnKSkgPT0gMCBhbmQgY291bnQoaHVuZ2VyLCAnPT0xJykgPj0gMSIKICAgIHJlc3VsdDogYmVzdGlhbF9mYWlsdXJlCiAgLSBjb25kaXRpb246ICIoKGNvdW50KHJlZ3VsYXIsICc+PTYnKSArIGNvdW50KGh1bmdlciwgJz49NicpKSArICgoY291bnQocmVndWxhciwgJz09MTAnKSArIGNvdW50KGh1bmdlciwgJz09MTAnKSkgPj0gMikgKiAyICsgKChjb3VudChyZWd1bGFyLCAnPT0xMCcpICsgY291bnQoaHVuZ2VyLCAnPT0xMCcpKSA+PSA0KSAqIDIpID49IHtpbnB1dC5kaWZmaWN1bHR5fSIKICAgIHJlc3VsdDogc3VjY2VzcwogIC0gY29uZGl0aW9uOiAiKChjb3VudChyZWd1bGFyLCAnPj02JykgKyBjb3VudChodW5nZXIsICc+PTYnKSkgKyAoKGNvdW50KHJlZ3VsYXIsICc9PTEwJykgKyBjb3VudChodW5nZXIsICc9PTEwJykpID49IDIpICogMiArICgoY291bnQocmVndWxhciwgJz09MTAnKSArIGNvdW50KGh1bmdlciwgJz09MTAnKSkgPj0gNCkgKiAyKSA8IHtpbnB1dC5kaWZmaWN1bHR5fSIKICAgIHJlc3VsdDogZmFpbAoK",Ps="data:text/yaml;base64,c3lzdGVtOiB5emUKbGFiZWw6ICJZWiDigJQgUG9vbCBnZW7DqXJpY28iCnJvbGxfdHlwZTogc2ltcGxlCmlucHV0czoKICAtIGlkOiBwb29sX3NpemUKICAgIGxhYmVsOiAiRGFkb3Mgbm8gcG9vbCIKICAgIHR5cGU6IG51bWJlcgogICAgZGVmYXVsdDogIjEiCiAgLSBpZDogc3VjZXNzb3NfYW50ZXJpb3JlcwogICAgbGFiZWw6ICJTdWNlc3NvIGdhcmFudGlkbyIKICAgIHR5cGU6IG51bWJlcgogICAgZGVmYXVsdDogIjAiCiAgLSBpZDogZGlmaWN1bGRhZGUKICAgIGxhYmVsOiAiRGlmaWN1bGRhZGUiCiAgICB0eXBlOiBudW1iZXIKICAgIHJlcXVpcmVkOiBmYWxzZQogICAgZGVmYXVsdDogIjEiCmZpZWxkczoKICAtIGlkOiBwb29sCiAgICBkaWNlOiAie2lucHV0LnBvb2xfc2l6ZX1kNiIKICAgIG1vZGlmaWVyOiAie2lucHV0LnN1Y2Vzc29zX2FudGVyaW9yZXN9IgogICAgY29tcGFyZV9pbmRpdmlkdWFsbHk6IHRydWUKICAgIHN1Y2Nlc3NfcnVsZTogIj49NiIKIyBCYXNlIGRlIHRvZGEgYSBsaW5oYSBZZWFyIFplcm8gKENvcmlvbGlzLCBUYWxlcyBmcm9tIHRoZSBMb29wLCBWYWVzZW4sCiMgTXV0YW50IHNpbXBsaWZpY2Fkbyk6IHBvb2wgZGUgZDYsIGNhZGEgNiBlIHVtIHN1Y2Vzc28sIHNlbSBiYW5lLiBFbXB1cnJhcgojIChwdXNoKSByZXJyb2xhIHR1ZG8gcXVlIE5BTyBkZXUgNiDigJQgb3MgNnMgZmljYW0gbmEgbWVzYSwgZSBlIHBvciBpc3NvIHF1ZQojIGV4aXN0ZSAic3VjZXNzb3MgdHJhdmFkb3MiOiBvIG1vdG9yIGUgc3RhdGVsZXNzLCBlbnRhbyBvIHF1ZSBzb2Jyb3UgZGEKIyByb2xhZ2VtIGFudGVyaW9yIHZvbHRhIGNvbW8gbW9kaWZpY2Fkb3IgZGEgQ09OVEFHRU0gKHZlciBvIGNvbWVudGFyaW8gZG8KIyBzdWNjZXNzX3J1bGUgZW0gc3JjL3Byb2ZpbGUudHMpLiAiWzYsIDMsIDRdICsgMiA9IDMiIGUgdW1hIHJvbGFnZW0KIyBlbXB1cnJhZGEgY29tIDIgc3VjZXNzb3MgdmluZG9zIGRlIGFudGVzLgojICJkaWZpY3VsZGFkZSIgZSBvcGNpb25hbCAoZGVmYXVsdCAxLCBvIG5vcm1hbCBuYSBsaW5oYSk6IGVtIGJyYW5jbywgc28gYQojIGNvbnRhZ2VtIGFwYXJlY2UsIHNlbSBzdWNlc3NvL2ZhbGhhLiBQb29sIDAgZSBsZWdpdGltbyBhcXVpIChmb3JjYXIgc2VtCiMgbmVuaHVtIGRhZG8gc29icmFuZG8pIOKAlCBhIG5vdGFjYW8gIjBkNiIgZXhpc3RlIGp1c3RhbWVudGUgcHJhIGlzc28sIGUgbwojIHBhbGNvIG5hbyBhbmltYSBkYWRvIG5lbmh1bS4Kb3V0Y29tZV9ydWxlczoKICAtIGNvbmRpdGlvbjogInBvb2wudG90YWwgPj0ge2lucHV0LmRpZmljdWxkYWRlfSIKICAgIHJlc3VsdDogc3VjY2VzcwogIC0gY29uZGl0aW9uOiAicG9vbC50b3RhbCA8IHtpbnB1dC5kaWZpY3VsZGFkZX0iCiAgICByZXN1bHQ6IGZhaWwK",Us="data:text/yaml;base64,c3lzdGVtOiB5emVfYWxpZW4KbGFiZWw6ICJZWiDigJQgQWxpZW4iCnJvbGxfdHlwZTogbXVsdGkKaW5wdXRzOgogIC0gaWQ6IGJhc2UKICAgIGxhYmVsOiAiQmFzZSIKICAgIHR5cGU6IG51bWJlcgogICAgZGVmYXVsdDogIjEiCiAgLSBpZDogZXN0cmVzc2UKICAgIGxhYmVsOiAiRXN0cmVzc2UiCiAgICB0eXBlOiBudW1iZXIKICAgIGRlZmF1bHQ6ICIwIgogIC0gaWQ6IHN1Y2Vzc29zX2FudGVyaW9yZXMKICAgIGxhYmVsOiAiU3VjZXNzbyBnYXJhbnRpZG8iCiAgICB0eXBlOiBudW1iZXIKICAgIGRlZmF1bHQ6ICIwIgogIC0gaWQ6IGRpZmljdWxkYWRlCiAgICBsYWJlbDogIkRpZmljdWxkYWRlIgogICAgdHlwZTogbnVtYmVyCiAgICByZXF1aXJlZDogZmFsc2UKICAgIGRlZmF1bHQ6ICIxIgpmaWVsZHM6CiAgLSBpZDogYmFzZQogICAgZGljZTogIntpbnB1dC5iYXNlfWQ2IgogICAgbW9kaWZpZXI6ICJ7aW5wdXQuc3VjZXNzb3NfYW50ZXJpb3Jlc30iCiAgICBjb21wYXJlX2luZGl2aWR1YWxseTogdHJ1ZQogICAgc3VjY2Vzc19ydWxlOiAiPj02IgogICAgc2xvdDogMQogIC0gaWQ6IGVzdHJlc3NlCiAgICBkaWNlOiAie2lucHV0LmVzdHJlc3NlfWQ2IgogICAgY29tcGFyZV9pbmRpdmlkdWFsbHk6IHRydWUKICAgIHN1Y2Nlc3NfcnVsZTogIj49NiIKICAgIHNsb3Q6IDIKIyBQb29sIGJhc2UgKyBkYWRvcyBkZSBFc3RyZXNzZSwgYW1ib3MgZDYsIDYgZSBzdWNlc3NvIG5vcyBkb2lzLiBPIHF1ZSBtdWRhCiMgZSBvIDE6IG5vIGRhZG8gZGUgRXN0cmVzc2UgZWxlIGRpc3BhcmEgUEFOSUNPLCBlIGFvIGNvbnRyYXJpbyBkbyBiYW5lIGRvCiMgRm9yYmlkZGVuIExhbmRzIGlzc28gdmFsZSBlbSBRVUFMUVVFUiByb2xhZ2VtLCBlbXB1cnJhZGEgb3UgbmFvIOKAlCBwb3IKIyBpc3NvIGEgcmVncmEgZG8gcGFuaWNvIG5hbyBkZXBlbmRlIGRlIG5lbmh1bSBpbnB1dCBvcGNpb25hbCBwcmEgc2VyCiMgYXZhbGlhZGEuCiMKIyBGb3LDp2FyIHJlcnJvbGEgdHVkbyBxdWUgbmFvIGRldSA2IChpbmNsdXNpdmUgb3MgMXMsIHF1ZSBhcXVpIG5hbyB0cmF2YW0pCiMgZSBBQ1JFU0NFTlRBIHVtIGRhZG8gZGUgRXN0cmVzc2Ug4oCUIHF1ZW0gc29tYSBlc3NlICsxIGUgbyBib3RhbyBGb3LDp2FyIGRhCiMgVUksIG5hbyBvIHByb2ZpbGUuIEVzdHJlc3NlIDAgZSBvIGVzdGFkbyBpbmljaWFsIG5vcm1hbCBkbyBwZXJzb25hZ2VtIOKAlAojICIwZDYiIGRhIGNvbnRhIGRpc3NvIHNvemluaG8sIHNlbSBkYWRvIGZhbnRhc21hIG5vIHBhbGNvLgpvdXRjb21lX3J1bGVzOgogIC0gY29uZGl0aW9uOiAiYmFzZS50b3RhbCArIGVzdHJlc3NlLnRvdGFsID49IHtpbnB1dC5kaWZpY3VsZGFkZX0iCiAgICByZXN1bHQ6IHN1Y2Nlc3MKICAtIGNvbmRpdGlvbjogImJhc2UudG90YWwgKyBlc3RyZXNzZS50b3RhbCA8IHtpbnB1dC5kaWZpY3VsZGFkZX0iCiAgICByZXN1bHQ6IGZhaWwKICAtIGNvbmRpdGlvbjogImNvdW50KGVzdHJlc3NlLCAnPT0xJykgPj0gMSIKICAgIHJlc3VsdDogeXplX3Bhbmljbwo=",Qs="data:text/yaml;base64,c3lzdGVtOiB5emVfZmJsCmxhYmVsOiAiWVog4oCUIEZvcmJpZGRlbiBMYW5kcyAvIE11dGFudCIKcm9sbF90eXBlOiBtdWx0aQppbnB1dHM6CiAgLSBpZDogYmFzZQogICAgbGFiZWw6ICJCYXNlIgogICAgdHlwZTogbnVtYmVyCiAgICBkZWZhdWx0OiAiMSIKICAtIGlkOiBwZXJpY2lhCiAgICBsYWJlbDogIlBlcsOtY2lhIgogICAgdHlwZTogbnVtYmVyCiAgICBkZWZhdWx0OiAiMCIKICAtIGlkOiBlcXVpcGFtZW50bwogICAgbGFiZWw6ICJFcXVpcGFtZW50byIKICAgIHR5cGU6IG51bWJlcgogICAgZGVmYXVsdDogIjAiCiAgLSBpZDogc3VjZXNzb3NfYW50ZXJpb3JlcwogICAgbGFiZWw6ICJTdWNlc3NvIGdhcmFudGlkbyIKICAgIHR5cGU6IG51bWJlcgogICAgZGVmYXVsdDogIjAiCiAgLSBpZDogZGlmaWN1bGRhZGUKICAgIGxhYmVsOiAiRGlmaWN1bGRhZGUiCiAgICB0eXBlOiBudW1iZXIKICAgIHJlcXVpcmVkOiBmYWxzZQogICAgZGVmYXVsdDogIjEiCiAgLSBpZDogcHVzaF9iYW5lc19iYXNlCiAgICBsYWJlbDogIjFzIEJhc2UiCiAgICB0eXBlOiBudW1iZXIKICAgIHJlcXVpcmVkOiBmYWxzZQogIC0gaWQ6IHB1c2hfYmFuZXNfZXF1aXAKICAgIGxhYmVsOiAiMXMgRXF1aXAuIgogICAgdHlwZTogbnVtYmVyCiAgICByZXF1aXJlZDogZmFsc2UKZmllbGRzOgogIC0gaWQ6IGJhc2UKICAgIGRpY2U6ICJ7aW5wdXQuYmFzZX1kNiIKICAgIG1vZGlmaWVyOiAie2lucHV0LnN1Y2Vzc29zX2FudGVyaW9yZXN9IgogICAgY29tcGFyZV9pbmRpdmlkdWFsbHk6IHRydWUKICAgIHN1Y2Nlc3NfcnVsZTogIj49NiIKICAgIHNsb3Q6IDEKICAtIGlkOiBwZXJpY2lhCiAgICBkaWNlOiAie2lucHV0LnBlcmljaWF9ZDYiCiAgICBjb21wYXJlX2luZGl2aWR1YWxseTogdHJ1ZQogICAgc3VjY2Vzc19ydWxlOiAiPj02IgogICAgc2xvdDogMgogIC0gaWQ6IGVxdWlwYW1lbnRvCiAgICBkaWNlOiAie2lucHV0LmVxdWlwYW1lbnRvfWQ2IgogICAgY29tcGFyZV9pbmRpdmlkdWFsbHk6IHRydWUKICAgIHN1Y2Nlc3NfcnVsZTogIj49NiIKICAgIHNsb3Q6IDMKIyBUcmVzIHBvb2xzIGRlIGQ2IElOREVQRU5ERU5URVMgKG5hbyBjb21wZXRlbSDigJQgcG9yIGlzc28gbXVsdGkpOiBCYXNlCiMgKGF0cmlidXRvKSwgUGVyw61jaWEgZSBFcXVpcGFtZW50by4gNiBlIHN1Y2Vzc28gZW0gcXVhbHF1ZXIgdW0gZG9zIHRyZXMsIGUKIyBvcyBzdWNlc3NvcyBzb21hbS4KIwojIEJhbmUgKDEpIHNvIG1hY2h1Y2Egbm8gZGFkbyBkZSBCYXNlIChkYW5vIGRlIGF0cmlidXRvKSBlIG5vIGRlCiMgRXF1aXBhbWVudG8gKGRhbm8gbm8gaXRlbSkg4oCUIDEgZW0gUGVyw61jaWEgbnVuY2EgY29udGEuCiMKIyBFIHNvIGNvbnRhIHNlIGEgcm9sYWdlbSBmb2kgRk9SQ0FEQS4gTyBtb3RvciBuYW8gc2FiZSBzZSBmb2k6IHF1ZW0gbWFyY2EKIyBpc3NvIHNhbyBvcyBkb2lzIGlucHV0cyAicHVzaF8qIiwgT1BDSU9OQUlTIGRlIHByb3Bvc2l0byDigJQgZW0gYnJhbmNvCiMgKHJvbGFnZW0gbm9ybWFsKSB0b2RhIG91dGNvbWVfcnVsZSBxdWUgb3MgcmVmZXJlbmNpYSBlIHB1bGFkYQojIChldmFsdWF0ZU91dGNvbWVSdWxlcy9yZWZlcmVuY2VzQW55KSBlIG5lbmh1bSBkYW5vIGFwYXJlY2U7IHByZWVuY2hpZG9zLAojIG1lc21vIGNvbSAwLCBvcyAxcyBkZXN0YSByb2xhZ2VtIGNvbnRhbS4gTyBib3RhbyBGb3LDp2FyIHByZWVuY2hlIG9zIGRvaXMKIyBzZW1wcmUsIGNvbSBvcyAxcyBxdWUgZmljYXJhbSB0cmF2YWRvcyBuYSByb2xhZ2VtIGFudGVyaW9yIOKAlCBubyBwdXNoIGRvCiMgRkJMIG9zIDZzIEUgb3MgMXMgZmljYW0gbmEgbWVzYSwgc28gbyBtZWlvIHJlcnJvbGEuCiMKIyBPIHByZWZpeG8gInB1c2hfIiBubyBpZCBuYW8gZSBlbmZlaXRlOiBlIG8gcXVlIGZheiBvIGZvcm11bGFyaW8gZGEgd2ViCiMgZG9icmFyIGVzc2VzIGNhbXBvcyBudW1hIHNlY2FvIHJlY29saGlkYSAoUm9sbFBhbmVsLnRzeCkuIFNhbyBlc2NyaXR1cmFjYW8KIyBkbyBGb3LDp2FyLCBuYW8gY29pc2EgcXVlIHNlIHByZWVuY2hlIG5hIG1hbyBudW1hIHJvbGFnZW0gbm9ybWFsLgojCiMgUG9vbCAwIGUgbGVnaXRpbW8gZW0gcXVhbHF1ZXIgdW0gZG9zIHRyZXMgKHNlbSBlcXVpcGFtZW50bywgc2VtIHBlcmljaWEsCiMgb3UgZm9yY2FkYSBzZW0gZGFkbyBzb2JyYW5kbykg4oCUICIwZDYiIGUgbm90YWNhbyB2YWxpZGEgZSBvIHBhbGNvIG5hbwojIGFuaW1hIGRhZG8gbmVuaHVtIHBvciBlbGUuCm91dGNvbWVfcnVsZXM6CiAgLSBjb25kaXRpb246ICJiYXNlLnRvdGFsICsgcGVyaWNpYS50b3RhbCArIGVxdWlwYW1lbnRvLnRvdGFsID49IHtpbnB1dC5kaWZpY3VsZGFkZX0iCiAgICByZXN1bHQ6IHN1Y2Nlc3MKICAtIGNvbmRpdGlvbjogImJhc2UudG90YWwgKyBwZXJpY2lhLnRvdGFsICsgZXF1aXBhbWVudG8udG90YWwgPCB7aW5wdXQuZGlmaWN1bGRhZGV9IgogICAgcmVzdWx0OiBmYWlsCiAgLSBjb25kaXRpb246ICJjb3VudChiYXNlLCAnPT0xJykgKyB7aW5wdXQucHVzaF9iYW5lc19iYXNlfSA+PSAzIgogICAgcmVzdWx0OiB5emVfZGFub19hdHJpYnV0b194MwogIC0gY29uZGl0aW9uOiAiY291bnQoYmFzZSwgJz09MScpICsge2lucHV0LnB1c2hfYmFuZXNfYmFzZX0gPT0gMiIKICAgIHJlc3VsdDogeXplX2Rhbm9fYXRyaWJ1dG9feDIKICAtIGNvbmRpdGlvbjogImNvdW50KGJhc2UsICc9PTEnKSArIHtpbnB1dC5wdXNoX2JhbmVzX2Jhc2V9ID09IDEiCiAgICByZXN1bHQ6IHl6ZV9kYW5vX2F0cmlidXRvX3gxCiAgLSBjb25kaXRpb246ICJjb3VudChlcXVpcGFtZW50bywgJz09MScpICsge2lucHV0LnB1c2hfYmFuZXNfZXF1aXB9ID49IDMiCiAgICByZXN1bHQ6IHl6ZV9kYW5vX2VxdWlwYW1lbnRvX3gzCiAgLSBjb25kaXRpb246ICJjb3VudChlcXVpcGFtZW50bywgJz09MScpICsge2lucHV0LnB1c2hfYmFuZXNfZXF1aXB9ID09IDIiCiAgICByZXN1bHQ6IHl6ZV9kYW5vX2VxdWlwYW1lbnRvX3gyCiAgLSBjb25kaXRpb246ICJjb3VudChlcXVpcGFtZW50bywgJz09MScpICsge2lucHV0LnB1c2hfYmFuZXNfZXF1aXB9ID09IDEiCiAgICByZXN1bHQ6IHl6ZV9kYW5vX2VxdWlwYW1lbnRvX3gxCg==",$s="data:text/yaml;base64,c3lzdGVtOiB5emVfd2R1CmxhYmVsOiAiWVog4oCUIFdhbGtpbmcgRGVhZCIKcm9sbF90eXBlOiBtdWx0aQppbnB1dHM6CiAgLSBpZDogYmFzZQogICAgbGFiZWw6ICJCYXNlIgogICAgdHlwZTogbnVtYmVyCiAgICBkZWZhdWx0OiAiMSIKICAtIGlkOiBlc3RyZXNzZQogICAgbGFiZWw6ICJFc3RyZXNzZSIKICAgIHR5cGU6IG51bWJlcgogICAgZGVmYXVsdDogIjAiCiAgLSBpZDogc3VjZXNzb3NfYW50ZXJpb3JlcwogICAgbGFiZWw6ICJTdWNlc3NvIGdhcmFudGlkbyIKICAgIHR5cGU6IG51bWJlcgogICAgZGVmYXVsdDogIjAiCiAgLSBpZDogZGlmaWN1bGRhZGUKICAgIGxhYmVsOiAiRGlmaWN1bGRhZGUiCiAgICB0eXBlOiBudW1iZXIKICAgIHJlcXVpcmVkOiBmYWxzZQogICAgZGVmYXVsdDogIjEiCmZpZWxkczoKICAtIGlkOiBiYXNlCiAgICBkaWNlOiAie2lucHV0LmJhc2V9ZDYiCiAgICBtb2RpZmllcjogIntpbnB1dC5zdWNlc3Nvc19hbnRlcmlvcmVzfSIKICAgIGNvbXBhcmVfaW5kaXZpZHVhbGx5OiB0cnVlCiAgICBzdWNjZXNzX3J1bGU6ICI+PTYiCiAgICBzbG90OiAxCiAgLSBpZDogZXN0cmVzc2UKICAgIGRpY2U6ICJ7aW5wdXQuZXN0cmVzc2V9ZDYiCiAgICBjb21wYXJlX2luZGl2aWR1YWxseTogdHJ1ZQogICAgc3VjY2Vzc19ydWxlOiAiPj02IgogICAgc2xvdDogMgojIE1lc21hIGVzdHJ1dHVyYSBkbyBBbGllbiAocG9vbCBiYXNlICsgRXN0cmVzc2UsIDYgZSBzdWNlc3NvIG5vcyBkb2lzKSDigJQKIyBtdWRhIG8gbm9tZSBlIGEgY29uc2VxdWVuY2lhIGRvIDEgbm8gZGFkbyBkZSBFc3RyZXNzZTogbm8gV2Fsa2luZyBEZWFkCiMgVW5pdmVyc2UgZWxlIGUgREVTQ09OVFJPTEUgKG1lc2EgZDY2IGRlIGFnaXIgbWFsIHNvYiBwcmVzc2FvKSwgbmFvCiMgUGFuaWNvLiBQcm9maWxlIHNlcGFyYWRvIGVtIHZleiBkZSB1bSAiZXN0cmVzc2UgZ2VuZXJpY28iIGp1c3RhbWVudGUgcHJhCiMgY2FkYSBsaW5oYSBtYW50ZXIgbyB0ZXJtbyBxdWUgYSBtZXNhIHVzYTsgbyBpZCBkbyBvdXRjb21lIHRhbWJlbSBlCiMgcHJvcHJpbyAoZG9jcy9hZGRpbmctYS1zeXN0ZW0ubWQ6IGlkIGRlIG91dGNvbWUgZSBjb21wYXJ0aWxoYWRvIGVudHJlCiMgcHJvZmlsZXMsIGVudGFvIHJlbm9tZWFyIHVtIG1leGVyaWEgbm8gb3V0cm8pLgojCiMgRW1wdXJyYXIgcmVycm9sYSB0dWRvIHF1ZSBuYW8gZGV1IDYgZSBhY3Jlc2NlbnRhIHVtIGRhZG8gZGUgRXN0cmVzc2Ug4oCUCiMgcXVlbSBzb21hIGVzc2UgKzEgZSBvIGJvdGFvIEVtcHVycmFyIGRhIFVJLCBuYW8gbyBwcm9maWxlLgpvdXRjb21lX3J1bGVzOgogIC0gY29uZGl0aW9uOiAiYmFzZS50b3RhbCArIGVzdHJlc3NlLnRvdGFsID49IHtpbnB1dC5kaWZpY3VsZGFkZX0iCiAgICByZXN1bHQ6IHN1Y2Nlc3MKICAtIGNvbmRpdGlvbjogImJhc2UudG90YWwgKyBlc3RyZXNzZS50b3RhbCA8IHtpbnB1dC5kaWZpY3VsZGFkZX0iCiAgICByZXN1bHQ6IGZhaWwKICAtIGNvbmRpdGlvbjogImNvdW50KGVzdHJlc3NlLCAnPT0xJykgPj0gMSIKICAgIHJlc3VsdDogeXplX2Rlc2NvbnRyb2xlCg==",ut=Symbol.for("yaml.alias"),dt=Symbol.for("yaml.document"),ee=Symbol.for("yaml.map"),sn=Symbol.for("yaml.pair"),T=Symbol.for("yaml.scalar"),ce=Symbol.for("yaml.seq"),z=Symbol.for("yaml.node.type"),ue=n=>!!n&&typeof n=="object"&&n[z]===ut,He=n=>!!n&&typeof n=="object"&&n[z]===dt,Ze=n=>!!n&&typeof n=="object"&&n[z]===ee,k=n=>!!n&&typeof n=="object"&&n[z]===sn,w=n=>!!n&&typeof n=="object"&&n[z]===T,We=n=>!!n&&typeof n=="object"&&n[z]===ce;function Y(n){if(n&&typeof n=="object")switch(n[z]){case ee:case ce:return!0}return!1}function _(n){if(n&&typeof n=="object")switch(n[z]){case ut:case ee:case T:case ce:return!0}return!1}const on=n=>(w(n)||Y(n))&&!!n.anchor,se=Symbol("break visit"),qs=Symbol("skip children"),we=Symbol("remove node");function de(n,e){const t=ei(e);He(n)?ge(null,n.contents,t,Object.freeze([n]))===we&&(n.contents=null):ge(null,n,t,Object.freeze([]))}de.BREAK=se,de.SKIP=qs,de.REMOVE=we;function ge(n,e,t,s){const i=ti(n,e,t,s);if(_(i)||k(i))return ni(n,s,i),ge(n,i,t,s);if(typeof i!="symbol"){if(Y(e)){s=Object.freeze(s.concat(e));for(let o=0;o<e.items.length;++o){const l=ge(o,e.items[o],t,s);if(typeof l=="number")o=l-1;else{if(l===se)return se;l===we&&(e.items.splice(o,1),o-=1)}}}else if(k(e)){s=Object.freeze(s.concat(e));const o=ge("key",e.key,t,s);if(o===se)return se;o===we&&(e.key=null);const l=ge("value",e.value,t,s);if(l===se)return se;l===we&&(e.value=null)}}return i}function ei(n){return typeof n=="object"&&(n.Collection||n.Node||n.Value)?Object.assign({Alias:n.Node,Map:n.Node,Scalar:n.Node,Seq:n.Node},n.Value&&{Map:n.Value,Scalar:n.Value,Seq:n.Value},n.Collection&&{Map:n.Collection,Seq:n.Collection},n):n}function ti(n,e,t,s){var i,o,l,r,a;if(typeof t=="function")return t(n,e,s);if(Ze(e))return(i=t.Map)==null?void 0:i.call(t,n,e,s);if(We(e))return(o=t.Seq)==null?void 0:o.call(t,n,e,s);if(k(e))return(l=t.Pair)==null?void 0:l.call(t,n,e,s);if(w(e))return(r=t.Scalar)==null?void 0:r.call(t,n,e,s);if(ue(e))return(a=t.Alias)==null?void 0:a.call(t,n,e,s)}function ni(n,e,t){const s=e[e.length-1];if(Y(s))s.items[n]=t;else if(k(s))n==="key"?s.key=t:s.value=t;else if(He(s))s.contents=t;else{const i=ue(s)?"alias":"scalar";throw new Error(`Cannot replace node with ${i} parent`)}}const si={"!":"%21",",":"%2C","[":"%5B","]":"%5D","{":"%7B","}":"%7D"},ii=n=>n.replace(/[!,[\]{}]/g,e=>si[e]);class R{constructor(e,t){this.docStart=null,this.docEnd=!1,this.yaml=Object.assign({},R.defaultYaml,e),this.tags=Object.assign({},R.defaultTags,t)}clone(){const e=new R(this.yaml,this.tags);return e.docStart=this.docStart,e}atDocument(){const e=new R(this.yaml,this.tags);switch(this.yaml.version){case"1.1":this.atNextDocument=!0;break;case"1.2":this.atNextDocument=!1,this.yaml={explicit:R.defaultYaml.explicit,version:"1.2"},this.tags=Object.assign({},R.defaultTags);break}return e}add(e,t){this.atNextDocument&&(this.yaml={explicit:R.defaultYaml.explicit,version:"1.1"},this.tags=Object.assign({},R.defaultTags),this.atNextDocument=!1);const s=e.trim().split(/[ \t]+/),i=s.shift();switch(i){case"%TAG":{if(s.length!==2&&(t(0,"%TAG directive should contain exactly two parts"),s.length<2))return!1;const[o,l]=s;return this.tags[o]=l,!0}case"%YAML":{if(this.yaml.explicit=!0,s.length!==1)return t(0,"%YAML directive should contain exactly one part"),!1;const[o]=s;if(o==="1.1"||o==="1.2")return this.yaml.version=o,!0;{const l=/^\d+\.\d+$/.test(o);return t(6,`Unsupported YAML version ${o}`,l),!1}}default:return t(0,`Unknown directive ${i}`,!0),!1}}tagName(e,t){if(e==="!")return"!";if(e[0]!=="!")return t(`Not a valid tag: ${e}`),null;if(e[1]==="<"){const l=e.slice(2,-1);return l==="!"||l==="!!"?(t(`Verbatim tags aren't resolved, so ${e} is invalid.`),null):(e[e.length-1]!==">"&&t("Verbatim tags must end with a >"),l)}const[,s,i]=e.match(/^(.*!)([^!]*)$/s);i||t(`The ${e} tag has no suffix`);const o=this.tags[s];if(o)try{return o+decodeURIComponent(i)}catch(l){return t(String(l)),null}return s==="!"?e:(t(`Could not resolve tag: ${e}`),null)}tagString(e){for(const[t,s]of Object.entries(this.tags))if(e.startsWith(s))return t+ii(e.substring(s.length));return e[0]==="!"?e:`!<${e}>`}toString(e){const t=this.yaml.explicit?[`%YAML ${this.yaml.version||"1.2"}`]:[],s=Object.entries(this.tags);let i;if(e&&s.length>0&&_(e.contents)){const o={};de(e.contents,(l,r)=>{_(r)&&r.tag&&(o[r.tag]=!0)}),i=Object.keys(o)}else i=[];for(const[o,l]of s)o==="!!"&&l==="tag:yaml.org,2002:"||(!e||i.some(r=>r.startsWith(l)))&&t.push(`%TAG ${o} ${l}`);return t.join(`
`)}}R.defaultYaml={explicit:!1,version:"1.2"},R.defaultTags={"!!":"tag:yaml.org,2002:"};function ln(n){if(/[\x00-\x19\s,[\]{}]/.test(n)){const t=`Anchor must not contain whitespace or control characters: ${JSON.stringify(n)}`;throw new Error(t)}return!0}function rn(n){const e=new Set;return de(n,{Value(t,s){s.anchor&&e.add(s.anchor)}}),e}function an(n,e){for(let t=1;;++t){const s=`${n}${t}`;if(!e.has(s))return s}}function oi(n,e){const t=[],s=new Map;let i=null;return{onAnchor:o=>{t.push(o),i??(i=rn(n));const l=an(e,i);return i.add(l),l},setAnchors:()=>{for(const o of t){const l=s.get(o);if(typeof l=="object"&&l.anchor&&(w(l.node)||Y(l.node)))l.node.anchor=l.anchor;else{const r=new Error("Failed to resolve repeated object (this should not happen)");throw r.source=o,r}}},sourceObjects:s}}function fe(n,e,t,s){if(s&&typeof s=="object")if(Array.isArray(s))for(let i=0,o=s.length;i<o;++i){const l=s[i],r=fe(n,s,String(i),l);r===void 0?delete s[i]:r!==l&&(s[i]=r)}else if(s instanceof Map)for(const i of Array.from(s.keys())){const o=s.get(i),l=fe(n,s,i,o);l===void 0?s.delete(i):l!==o&&s.set(i,l)}else if(s instanceof Set)for(const i of Array.from(s)){const o=fe(n,s,i,i);o===void 0?s.delete(i):o!==i&&(s.delete(i),s.add(o))}else for(const[i,o]of Object.entries(s)){const l=fe(n,s,i,o);l===void 0?delete s[i]:l!==o&&(s[i]=l)}return n.call(e,t,s)}function x(n,e,t){if(Array.isArray(n))return n.map((s,i)=>x(s,String(i),t));if(n&&typeof n.toJSON=="function"){if(!t||!on(n))return n.toJSON(e,t);const s={aliasCount:0,count:1,res:void 0};t.anchors.set(n,s),t.onCreate=o=>{s.res=o,delete t.onCreate};const i=n.toJSON(e,t);return t.onCreate&&t.onCreate(i),i}return typeof n=="bigint"&&!(t!=null&&t.keep)?Number(n):n}class gt{constructor(e){Object.defineProperty(this,z,{value:e})}clone(){const e=Object.create(Object.getPrototypeOf(this),Object.getOwnPropertyDescriptors(this));return this.range&&(e.range=this.range.slice()),e}toJS(e,{mapAsMap:t,maxAliasCount:s,onAnchor:i,reviver:o}={}){if(!He(e))throw new TypeError("A document argument is required");const l={anchors:new Map,doc:e,keep:!0,mapAsMap:t===!0,mapKeyWarned:!1,maxAliasCount:typeof s=="number"?s:100},r=x(this,"",l);if(typeof i=="function")for(const{count:a,res:c}of l.anchors.values())i(c,a);return typeof o=="function"?fe(o,{"":r},"",r):r}}class ft extends gt{constructor(e){super(ut),this.source=e,Object.defineProperty(this,"tag",{set(){throw new Error("Alias nodes cannot have tags")}})}resolve(e,t){if((t==null?void 0:t.maxAliasCount)===0)throw new ReferenceError("Alias resolution is disabled");let s;t!=null&&t.aliasResolveCache?s=t.aliasResolveCache:(s=[],de(e,{Node:(o,l)=>{(ue(l)||on(l))&&s.push(l)}}),t&&(t.aliasResolveCache=s));let i;for(const o of s){if(o===this)break;o.anchor===this.source&&(i=o)}return i}toJSON(e,t){if(!t)return{source:this.source};const{anchors:s,doc:i,maxAliasCount:o}=t,l=this.resolve(i,t);if(!l){const a=`Unresolved alias (the anchor must be set before the alias): ${this.source}`;throw new ReferenceError(a)}let r=s.get(l);if(r||(x(l,null,t),r=s.get(l)),(r==null?void 0:r.res)===void 0){const a="This should not happen: Alias anchor was not resolved?";throw new ReferenceError(a)}if(o>=0&&(r.count+=1,r.aliasCount===0&&(r.aliasCount=Oe(i,l,s)),r.count*r.aliasCount>o)){const a="Excessive alias count indicates a resource exhaustion attack";throw new ReferenceError(a)}return r.res}toString(e,t,s){const i=`*${this.source}`;if(e){if(ln(this.source),e.options.verifyAliasOrder&&!e.anchors.has(this.source)){const o=`Unresolved alias (the anchor must be set before the alias): ${this.source}`;throw new Error(o)}if(e.implicitKey)return`${i} `}return i}}function Oe(n,e,t){if(ue(e)){const s=e.resolve(n),i=t&&s&&t.get(s);return i?i.count*i.aliasCount:0}else if(Y(e)){let s=0;for(const i of e.items){const o=Oe(n,i,t);o>s&&(s=o)}return s}else if(k(e)){const s=Oe(n,e.key,t),i=Oe(n,e.value,t);return Math.max(s,i)}return 1}const cn=n=>!n||typeof n!="function"&&typeof n!="object";class v extends gt{constructor(e){super(T),this.value=e}toJSON(e,t){return t!=null&&t.keep?this.value:x(this.value,e,t)}toString(){return String(this.value)}}v.BLOCK_FOLDED="BLOCK_FOLDED",v.BLOCK_LITERAL="BLOCK_LITERAL",v.PLAIN="PLAIN",v.QUOTE_DOUBLE="QUOTE_DOUBLE",v.QUOTE_SINGLE="QUOTE_SINGLE";const li="tag:yaml.org,2002:";function ri(n,e,t){if(e){const s=t.filter(o=>o.tag===e),i=s.find(o=>!o.format)??s[0];if(!i)throw new Error(`Tag ${e} not found`);return i}return t.find(s=>{var i;return((i=s.identify)==null?void 0:i.call(s,n))&&!s.format})}function Ne(n,e,t){var d,f,g;if(He(n)&&(n=n.contents),_(n))return n;if(k(n)){const h=(f=(d=t.schema[ee]).createNode)==null?void 0:f.call(d,t.schema,null,t);return h.items.push(n),h}(n instanceof String||n instanceof Number||n instanceof Boolean||typeof BigInt<"u"&&n instanceof BigInt)&&(n=n.valueOf());const{aliasDuplicateObjects:s,onAnchor:i,onTagObj:o,schema:l,sourceObjects:r}=t;let a;if(s&&n&&typeof n=="object"){if(a=r.get(n),a)return a.anchor??(a.anchor=i(n)),new ft(a.anchor);a={anchor:null,node:null},r.set(n,a)}e!=null&&e.startsWith("!!")&&(e=li+e.slice(2));let c=ri(n,e,l.tags);if(!c){if(n&&typeof n.toJSON=="function"&&(n=n.toJSON()),!n||typeof n!="object"){const h=new v(n);return a&&(a.node=h),h}c=n instanceof Map?l[ee]:Symbol.iterator in Object(n)?l[ce]:l[ee]}o&&(o(c),delete t.onTagObj);const u=c!=null&&c.createNode?c.createNode(t.schema,n,t):typeof((g=c==null?void 0:c.nodeClass)==null?void 0:g.from)=="function"?c.nodeClass.from(t.schema,n,t):new v(n);return e?u.tag=e:c.default||(u.tag=c.tag),a&&(a.node=u),u}function Je(n,e,t){let s=t;for(let i=e.length-1;i>=0;--i){const o=e[i];if(typeof o=="number"&&Number.isInteger(o)&&o>=0){const l=[];l[o]=s,s=l}else s=new Map([[o,s]])}return Ne(s,void 0,{aliasDuplicateObjects:!1,keepUndefined:!1,onAnchor:()=>{throw new Error("This should not happen, please report a bug.")},schema:n,sourceObjects:new Map})}const Se=n=>n==null||typeof n=="object"&&!!n[Symbol.iterator]().next().done;class un extends gt{constructor(e,t){super(e),Object.defineProperty(this,"schema",{value:t,configurable:!0,enumerable:!1,writable:!0})}clone(e){const t=Object.create(Object.getPrototypeOf(this),Object.getOwnPropertyDescriptors(this));return e&&(t.schema=e),t.items=t.items.map(s=>_(s)||k(s)?s.clone(e):s),this.range&&(t.range=this.range.slice()),t}addIn(e,t){if(Se(e))this.add(t);else{const[s,...i]=e,o=this.get(s,!0);if(Y(o))o.addIn(i,t);else if(o===void 0&&this.schema)this.set(s,Je(this.schema,i,t));else throw new Error(`Expected YAML collection at ${s}. Remaining path: ${i}`)}}deleteIn(e){const[t,...s]=e;if(s.length===0)return this.delete(t);const i=this.get(t,!0);if(Y(i))return i.deleteIn(s);throw new Error(`Expected YAML collection at ${t}. Remaining path: ${s}`)}getIn(e,t){const[s,...i]=e,o=this.get(s,!0);return i.length===0?!t&&w(o)?o.value:o:Y(o)?o.getIn(i,t):void 0}hasAllNullValues(e){return this.items.every(t=>{if(!k(t))return!1;const s=t.value;return s==null||e&&w(s)&&s.value==null&&!s.commentBefore&&!s.comment&&!s.tag})}hasIn(e){const[t,...s]=e;if(s.length===0)return this.has(t);const i=this.get(t,!0);return Y(i)?i.hasIn(s):!1}setIn(e,t){const[s,...i]=e;if(i.length===0)this.set(s,t);else{const o=this.get(s,!0);if(Y(o))o.setIn(i,t);else if(o===void 0&&this.schema)this.set(s,Je(this.schema,i,t));else throw new Error(`Expected YAML collection at ${s}. Remaining path: ${i}`)}}}const ai=n=>n.replace(/^(?!$)(?: $)?/gm,"#");function U(n,e){return/^\n+$/.test(n)?n.substring(1):e?n.replace(/^(?! *$)/gm,e):n}const ie=(n,e,t)=>n.endsWith(`
`)?U(t,e):t.includes(`
`)?`
`+U(t,e):(n.endsWith(" ")?"":" ")+t,dn="flow",mt="block",ze="quoted";function xe(n,e,t="flow",{indentAtStart:s,lineWidth:i=80,minContentWidth:o=20,onFold:l,onOverflow:r}={}){if(!i||i<0)return n;i<o&&(o=0);const a=Math.max(1+o,1+i-e.length);if(n.length<=a)return n;const c=[],u={};let d=i-e.length;typeof s=="number"&&(s>i-Math.max(2,o)?c.push(0):d=i-s);let f,g,h=!1,m=-1,b=-1,I=-1;t===mt&&(m=gn(n,m,e.length),m!==-1&&(d=m+a));for(let G;G=n[m+=1];){if(t===ze&&G==="\\"){switch(b=m,n[m+1]){case"x":m+=3;break;case"u":m+=5;break;case"U":m+=9;break;default:m+=1}I=m}if(G===`
`)t===mt&&(m=gn(n,m,e.length)),d=m+e.length+a,f=void 0;else{if(G===" "&&g&&g!==" "&&g!==`
`&&g!=="	"){const C=n[m+1];C&&C!==" "&&C!==`
`&&C!=="	"&&(f=m)}if(m>=d)if(f)c.push(f),d=f+a,f=void 0;else if(t===ze){for(;g===" "||g==="	";)g=G,G=n[m+=1],h=!0;const C=m>I+1?m-2:b-1;if(u[C])return n;c.push(C),u[C]=!0,d=C+a,f=void 0}else h=!0}g=G}if(h&&r&&r(),c.length===0)return n;l&&l();let p=n.slice(0,c[0]);for(let G=0;G<c.length;++G){const C=c[G],A=c[G+1]||n.length;C===0?p=`
${e}${n.slice(0,A)}`:(t===ze&&u[C]&&(p+=`${n[C]}\\`),p+=`
${e}${n.slice(C+1,A)}`)}return p}function gn(n,e,t){let s=e,i=e+1,o=n[i];for(;o===" "||o==="	";)if(e<i+t)o=n[++e];else{do o=n[++e];while(o&&o!==`
`);s=e,i=e+1,o=n[i]}return s}const Ke=(n,e)=>({indentAtStart:e?n.indent.length:n.indentAtStart,lineWidth:n.options.lineWidth,minContentWidth:n.options.minContentWidth}),De=n=>/^(%|---|\.\.\.)/m.test(n);function ci(n,e,t){if(!e||e<0)return!1;const s=e-t,i=n.length;if(i<=s)return!1;for(let o=0,l=0;o<i;++o)if(n[o]===`
`){if(o-l>s)return!0;if(l=o+1,i-l<=s)return!1}return!0}function Ve(n,e){const t=JSON.stringify(n);if(e.options.doubleQuotedAsJSON)return t;const{implicitKey:s}=e,i=e.options.doubleQuotedMinMultiLineLength,o=e.indent||(De(n)?"  ":"");let l="",r=0;for(let a=0,c=t[a];c;c=t[++a])if(c===" "&&t[a+1]==="\\"&&t[a+2]==="n"&&(l+=t.slice(r,a)+"\\ ",a+=1,r=a,c="\\"),c==="\\")switch(t[a+1]){case"u":{l+=t.slice(r,a);const u=t.substr(a+2,4);switch(u){case"0000":l+="\\0";break;case"0007":l+="\\a";break;case"000b":l+="\\v";break;case"001b":l+="\\e";break;case"0085":l+="\\N";break;case"00a0":l+="\\_";break;case"2028":l+="\\L";break;case"2029":l+="\\P";break;default:u.substr(0,2)==="00"?l+="\\x"+u.substr(2):l+=t.substr(a,6)}a+=5,r=a+1}break;case"n":if(s||t[a+2]==='"'||t.length<i)a+=1;else{for(l+=t.slice(r,a)+`

`;t[a+2]==="\\"&&t[a+3]==="n"&&t[a+4]!=='"';)l+=`
`,a+=2;l+=o,t[a+2]===" "&&(l+="\\"),a+=1,r=a+1}break;default:a+=1}return l=r?l+t.slice(r):t,s?l:xe(l,o,ze,Ke(e,!1))}function bt(n,e){if(e.options.singleQuote===!1||e.implicitKey&&n.includes(`
`)||/[ \t]\n|\n[ \t]/.test(n))return Ve(n,e);const t=e.indent||(De(n)?"  ":""),s="'"+n.replace(/'/g,"''").replace(/\n+/g,`$&
${t}`)+"'";return e.implicitKey?s:xe(s,t,dn,Ke(e,!1))}function me(n,e){const{singleQuote:t}=e.options;let s;if(t===!1)s=Ve;else{const i=n.includes('"'),o=n.includes("'");i&&!o?s=bt:o&&!i?s=Ve:s=t?bt:Ve}return s(n,e)}let ht;try{ht=new RegExp(`(^|(?<!
))
+(?!
|$)`,"g")}catch{ht=/\n+(?!\n|$)/g}function je({comment:n,type:e,value:t},s,i,o){const{blockQuote:l,commentString:r,lineWidth:a}=s.options;if(!l||/\n[\t ]+$/.test(t))return me(t,s);const c=s.indent||(s.forceBlockIndent||De(t)?"  ":""),u=l==="literal"?!0:l==="folded"||e===v.BLOCK_FOLDED?!1:e===v.BLOCK_LITERAL?!0:!ci(t,a,c.length);if(!t)return u?`|
`:`>
`;let d,f;for(f=t.length;f>0;--f){const A=t[f-1];if(A!==`
`&&A!=="	"&&A!==" ")break}let g=t.substring(f);const h=g.indexOf(`
`);h===-1?d="-":t===g||h!==g.length-1?(d="+",o&&o()):d="",g&&(t=t.slice(0,-g.length),g[g.length-1]===`
`&&(g=g.slice(0,-1)),g=g.replace(ht,`$&${c}`));let m=!1,b,I=-1;for(b=0;b<t.length;++b){const A=t[b];if(A===" ")m=!0;else if(A===`
`)I=b;else break}let p=t.substring(0,I<b?I+1:b);p&&(t=t.substring(p.length),p=p.replace(/\n+/g,`$&${c}`));let C=(m?c?"2":"1":"")+d;if(n&&(C+=" "+r(n.replace(/ ?[\r\n]+/g," ")),i&&i()),!u){const A=t.replace(/\n+/g,`
$&`).replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g,"$1$2").replace(/\n+/g,`$&${c}`);let W=!1;const Z=Ke(s,!0);l!=="folded"&&e!==v.BLOCK_FOLDED&&(Z.onOverflow=()=>{W=!0});const y=xe(`${p}${A}${g}`,c,mt,Z);if(!W)return`>${C}
${c}${y}`}return t=t.replace(/\n+/g,`$&${c}`),`|${C}
${c}${p}${t}${g}`}function ui(n,e,t,s){const{type:i,value:o}=n,{actualString:l,implicitKey:r,indent:a,indentStep:c,inFlow:u}=e;if(r&&o.includes(`
`)||u&&/[[\]{},]/.test(o))return me(o,e);if(/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(o))return r||u||!o.includes(`
`)?me(o,e):je(n,e,t,s);if(!r&&!u&&i!==v.PLAIN&&o.includes(`
`))return je(n,e,t,s);if(De(o)){if(a==="")return e.forceBlockIndent=!0,je(n,e,t,s);if(r&&a===c)return me(o,e)}const d=o.replace(/\n+/g,`$&
${a}`);if(l){const f=m=>{var b;return m.default&&m.tag!=="tag:yaml.org,2002:str"&&((b=m.test)==null?void 0:b.test(d))},{compat:g,tags:h}=e.doc.schema;if(h.some(f)||g!=null&&g.some(f))return me(o,e)}return r?d:xe(d,a,dn,Ke(e,!1))}function It(n,e,t,s){const{implicitKey:i,inFlow:o}=e,l=typeof n.value=="string"?n:Object.assign({},n,{value:String(n.value)});let{type:r}=n;r!==v.QUOTE_DOUBLE&&/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(l.value)&&(r=v.QUOTE_DOUBLE);const a=u=>{switch(u){case v.BLOCK_FOLDED:case v.BLOCK_LITERAL:return i||o?me(l.value,e):je(l,e,t,s);case v.QUOTE_DOUBLE:return Ve(l.value,e);case v.QUOTE_SINGLE:return bt(l.value,e);case v.PLAIN:return ui(l,e,t,s);default:return null}};let c=a(r);if(c===null){const{defaultKeyType:u,defaultStringType:d}=e.options,f=i&&u||d;if(c=a(f),c===null)throw new Error(`Unsupported default string type ${f}`)}return c}function fn(n,e){const t=Object.assign({blockQuote:!0,commentString:ai,defaultKeyType:null,defaultStringType:"PLAIN",directives:null,doubleQuotedAsJSON:!1,doubleQuotedMinMultiLineLength:40,falseStr:"false",flowCollectionPadding:!0,indentSeq:!0,lineWidth:80,minContentWidth:20,nullStr:"null",simpleKeys:!1,singleQuote:null,trailingComma:!1,trueStr:"true",verifyAliasOrder:!0},n.schema.toStringOptions,e);let s;switch(t.collectionStyle){case"block":s=!1;break;case"flow":s=!0;break;default:s=null}return{anchors:new Set,doc:n,flowCollectionPadding:t.flowCollectionPadding?" ":"",indent:"",indentStep:typeof t.indent=="number"?" ".repeat(t.indent):"  ",inFlow:s,options:t}}function di(n,e){var i;if(e.tag){const o=n.filter(l=>l.tag===e.tag);if(o.length>0)return o.find(l=>l.format===e.format)??o[0]}let t,s;if(w(e)){s=e.value;let o=n.filter(l=>{var r;return(r=l.identify)==null?void 0:r.call(l,s)});if(o.length>1){const l=o.filter(r=>r.test);l.length>0&&(o=l)}t=o.find(l=>l.format===e.format)??o.find(l=>!l.format)}else s=e,t=n.find(o=>o.nodeClass&&s instanceof o.nodeClass);if(!t){const o=((i=s==null?void 0:s.constructor)==null?void 0:i.name)??(s===null?"null":typeof s);throw new Error(`Tag not resolved for ${o} value`)}return t}function gi(n,e,{anchors:t,doc:s}){if(!s.directives)return"";const i=[],o=(w(n)||Y(n))&&n.anchor;o&&ln(o)&&(t.add(o),i.push(`&${o}`));const l=n.tag??(e.default?null:e.tag);return l&&i.push(s.directives.tagString(l)),i.join(" ")}function be(n,e,t,s){var a;if(k(n))return n.toString(e,t,s);if(ue(n)){if(e.doc.directives)return n.toString(e);if((a=e.resolvedAliases)!=null&&a.has(n))throw new TypeError("Cannot stringify circular structure without alias nodes");e.resolvedAliases?e.resolvedAliases.add(n):e.resolvedAliases=new Set([n]),n=n.resolve(e.doc)}let i;const o=_(n)?n:e.doc.createNode(n,{onTagObj:c=>i=c});i??(i=di(e.doc.schema.tags,o));const l=gi(o,i,e);l.length>0&&(e.indentAtStart=(e.indentAtStart??0)+l.length+1);const r=typeof i.stringify=="function"?i.stringify(o,e,t,s):w(o)?It(o,e,t,s):o.toString(e,t,s);return l?w(o)||r[0]==="{"||r[0]==="["?`${l} ${r}`:`${l}
${e.indent}${r}`:r}function fi({key:n,value:e},t,s,i){const{allNullValues:o,doc:l,indent:r,indentStep:a,options:{commentString:c,indentSeq:u,simpleKeys:d}}=t;let f=_(n)&&n.comment||null;if(d){if(f)throw new Error("With simple keys, key nodes cannot have comments");if(Y(n)||!_(n)&&typeof n=="object"){const Z="With simple keys, collection cannot be used as a key value";throw new Error(Z)}}let g=!d&&(!n||f&&e==null&&!t.inFlow||Y(n)||(w(n)?n.type===v.BLOCK_FOLDED||n.type===v.BLOCK_LITERAL:typeof n=="object"));t=Object.assign({},t,{allNullValues:!1,implicitKey:!g&&(d||!o),indent:r+a});let h=!1,m=!1,b=be(n,t,()=>h=!0,()=>m=!0);if(!g&&!t.inFlow&&b.length>1024){if(d)throw new Error("With simple keys, single line scalar must not span more than 1024 characters");g=!0}if(t.inFlow){if(o||e==null)return h&&s&&s(),b===""?"?":g?`? ${b}`:b}else if(o&&!d||e==null&&g)return b=`? ${b}`,f&&!h?b+=ie(b,t.indent,c(f)):m&&i&&i(),b;h&&(f=null),g?(f&&(b+=ie(b,t.indent,c(f))),b=`? ${b}
${r}:`):(b=`${b}:`,f&&(b+=ie(b,t.indent,c(f))));let I,p,G;_(e)?(I=!!e.spaceBefore,p=e.commentBefore,G=e.comment):(I=!1,p=null,G=null,e&&typeof e=="object"&&(e=l.createNode(e))),t.implicitKey=!1,!g&&!f&&w(e)&&(t.indentAtStart=b.length+1),m=!1,!u&&a.length>=2&&!t.inFlow&&!g&&We(e)&&!e.flow&&!e.tag&&!e.anchor&&(t.indent=t.indent.substring(2));let C=!1;const A=be(e,t,()=>C=!0,()=>m=!0);let W=" ";if(f||I||p){if(W=I?`
`:"",p){const Z=c(p);W+=`
${U(Z,t.indent)}`}A===""&&!t.inFlow?W===`
`&&G&&(W=`

`):W+=`
${t.indent}`}else if(!g&&Y(e)){const Z=A[0],y=A.indexOf(`
`),N=y!==-1,O=t.inFlow??e.flow??e.items.length===0;if(N||!O){let $=!1;if(N&&(Z==="&"||Z==="!")){let L=A.indexOf(" ");Z==="&"&&L!==-1&&L<y&&A[L+1]==="!"&&(L=A.indexOf(" ",L+1)),(L===-1||y<L)&&($=!0)}$||(W=`
${t.indent}`)}}else(A===""||A[0]===`
`)&&(W="");return b+=W+A,t.inFlow?C&&s&&s():G&&!C?b+=ie(b,t.indent,c(G)):m&&i&&i(),b}function mn(n,e){(n==="debug"||n==="warn")&&console.warn(e)}const Me="<<",Q={identify:n=>n===Me||typeof n=="symbol"&&n.description===Me,default:"key",tag:"tag:yaml.org,2002:merge",test:/^<<$/,resolve:()=>Object.assign(new v(Symbol(Me)),{addToJSMap:bn}),stringify:()=>Me},mi=(n,e)=>(Q.identify(e)||w(e)&&(!e.type||e.type===v.PLAIN)&&Q.identify(e.value))&&(n==null?void 0:n.doc.schema.tags.some(t=>t.tag===Q.tag&&t.default));function bn(n,e,t){const s=hn(n,t);if(We(s))for(const i of s.items)pt(n,e,i);else if(Array.isArray(s))for(const i of s)pt(n,e,i);else pt(n,e,s)}function pt(n,e,t){const s=hn(n,t);if(!Ze(s))throw new Error("Merge sources must be maps or map aliases");const i=s.toJSON(null,n,Map);for(const[o,l]of i)e instanceof Map?e.has(o)||e.set(o,l):e instanceof Set?e.add(o):Object.prototype.hasOwnProperty.call(e,o)||Object.defineProperty(e,o,{value:l,writable:!0,enumerable:!0,configurable:!0});return e}function hn(n,e){return n&&ue(e)?e.resolve(n.doc,n):e}function In(n,e,{key:t,value:s}){if(_(t)&&t.addToJSMap)t.addToJSMap(n,e,s);else if(mi(n,t))bn(n,e,s);else{const i=x(t,"",n);if(e instanceof Map)e.set(i,x(s,i,n));else if(e instanceof Set)e.add(i);else{const o=bi(t,i,n),l=x(s,o,n);o in e?Object.defineProperty(e,o,{value:l,writable:!0,enumerable:!0,configurable:!0}):e[o]=l}}return e}function bi(n,e,t){if(e===null)return"";if(typeof e!="object")return String(e);if(_(n)&&(t!=null&&t.doc)){const s=fn(t.doc,{});s.anchors=new Set;for(const o of t.anchors.keys())s.anchors.add(o.anchor);s.inFlow=!0,s.inStringifyKey=!0;const i=n.toString(s);if(!t.mapKeyWarned){let o=JSON.stringify(i);o.length>40&&(o=o.substring(0,36)+'..."'),mn(t.doc.options.logLevel,`Keys with collection values will be stringified due to JS Object restrictions: ${o}. Set mapAsMap: true to use object keys.`),t.mapKeyWarned=!0}return i}return JSON.stringify(e)}function yt(n,e,t){const s=Ne(n,void 0,t),i=Ne(e,void 0,t);return new F(s,i)}class F{constructor(e,t=null){Object.defineProperty(this,z,{value:sn}),this.key=e,this.value=t}clone(e){let{key:t,value:s}=this;return _(t)&&(t=t.clone(e)),_(s)&&(s=s.clone(e)),new F(t,s)}toJSON(e,t){const s=t!=null&&t.mapAsMap?new Map:{};return In(t,s,this)}toString(e,t,s){return e!=null&&e.doc?fi(this,e,t,s):JSON.stringify(this)}}function pn(n,e,t){return(e.inFlow??n.flow?Ii:hi)(n,e,t)}function hi({comment:n,items:e},t,{blockItemPrefix:s,flowChars:i,itemIndent:o,onChompKeep:l,onComment:r}){const{indent:a,options:{commentString:c}}=t,u=Object.assign({},t,{indent:o,type:null});let d=!1;const f=[];for(let h=0;h<e.length;++h){const m=e[h];let b=null;if(_(m))!d&&m.spaceBefore&&f.push(""),Le(t,f,m.commentBefore,d),m.comment&&(b=m.comment);else if(k(m)){const p=_(m.key)?m.key:null;p&&(!d&&p.spaceBefore&&f.push(""),Le(t,f,p.commentBefore,d))}d=!1;let I=be(m,u,()=>b=null,()=>d=!0);b&&(I+=ie(I,o,c(b))),d&&b&&(d=!1),f.push(s+I)}let g;if(f.length===0)g=i.start+i.end;else{g=f[0];for(let h=1;h<f.length;++h){const m=f[h];g+=m?`
${a}${m}`:`
`}}return n?(g+=`
`+U(c(n),a),r&&r()):d&&l&&l(),g}function Ii({items:n},e,{flowChars:t,itemIndent:s}){const{indent:i,indentStep:o,flowCollectionPadding:l,options:{commentString:r}}=e;s+=o;const a=Object.assign({},e,{indent:s,inFlow:!0,type:null});let c=!1,u=0;const d=[];for(let h=0;h<n.length;++h){const m=n[h];let b=null;if(_(m))m.spaceBefore&&d.push(""),Le(e,d,m.commentBefore,!1),m.comment&&(b=m.comment);else if(k(m)){const p=_(m.key)?m.key:null;p&&(p.spaceBefore&&d.push(""),Le(e,d,p.commentBefore,!1),p.comment&&(c=!0));const G=_(m.value)?m.value:null;G?(G.comment&&(b=G.comment),G.commentBefore&&(c=!0)):m.value==null&&(p!=null&&p.comment)&&(b=p.comment)}b&&(c=!0);let I=be(m,a,()=>b=null);c||(c=d.length>u||I.includes(`
`)),h<n.length-1?I+=",":e.options.trailingComma&&(e.options.lineWidth>0&&(c||(c=d.reduce((p,G)=>p+G.length+2,2)+(I.length+2)>e.options.lineWidth)),c&&(I+=",")),b&&(I+=ie(I,s,r(b))),d.push(I),u=d.length}const{start:f,end:g}=t;if(d.length===0)return f+g;if(!c){const h=d.reduce((m,b)=>m+b.length+2,2);c=e.options.lineWidth>0&&h>e.options.lineWidth}if(c){let h=f;for(const m of d)h+=m?`
${o}${i}${m}`:`
`;return`${h}
${i}${g}`}else return`${f}${l}${d.join(" ")}${l}${g}`}function Le({indent:n,options:{commentString:e}},t,s,i){if(s&&i&&(s=s.replace(/^\n+/,"")),s){const o=U(e(s),n);t.push(o.trimStart())}}function oe(n,e){const t=w(e)?e.value:e;for(const s of n)if(k(s)&&(s.key===e||s.key===t||w(s.key)&&s.key.value===t))return s}class K extends un{static get tagName(){return"tag:yaml.org,2002:map"}constructor(e){super(ee,e),this.items=[]}static from(e,t,s){const{keepUndefined:i,replacer:o}=s,l=new this(e),r=(a,c)=>{if(typeof o=="function")c=o.call(t,a,c);else if(Array.isArray(o)&&!o.includes(a))return;(c!==void 0||i)&&l.items.push(yt(a,c,s))};if(t instanceof Map)for(const[a,c]of t)r(a,c);else if(t&&typeof t=="object")for(const a of Object.keys(t))r(a,t[a]);return typeof e.sortMapEntries=="function"&&l.items.sort(e.sortMapEntries),l}add(e,t){var l;let s;k(e)?s=e:!e||typeof e!="object"||!("key"in e)?s=new F(e,e==null?void 0:e.value):s=new F(e.key,e.value);const i=oe(this.items,s.key),o=(l=this.schema)==null?void 0:l.sortMapEntries;if(i){if(!t)throw new Error(`Key ${s.key} already set`);w(i.value)&&cn(s.value)?i.value.value=s.value:i.value=s.value}else if(o){const r=this.items.findIndex(a=>o(s,a)<0);r===-1?this.items.push(s):this.items.splice(r,0,s)}else this.items.push(s)}delete(e){const t=oe(this.items,e);return t?this.items.splice(this.items.indexOf(t),1).length>0:!1}get(e,t){const s=oe(this.items,e),i=s==null?void 0:s.value;return(!t&&w(i)?i.value:i)??void 0}has(e){return!!oe(this.items,e)}set(e,t){this.add(new F(e,t),!0)}toJSON(e,t,s){const i=s?new s:t!=null&&t.mapAsMap?new Map:{};t!=null&&t.onCreate&&t.onCreate(i);for(const o of this.items)In(t,i,o);return i}toString(e,t,s){if(!e)return JSON.stringify(this);for(const i of this.items)if(!k(i))throw new Error(`Map items must all be pairs; found ${JSON.stringify(i)} instead`);return!e.allNullValues&&this.hasAllNullValues(!1)&&(e=Object.assign({},e,{allNullValues:!0})),pn(this,e,{blockItemPrefix:"",flowChars:{start:"{",end:"}"},itemIndent:e.indent||"",onChompKeep:s,onComment:t})}}const he={collection:"map",default:!0,nodeClass:K,tag:"tag:yaml.org,2002:map",resolve(n,e){return Ze(n)||e("Expected a mapping for this tag"),n},createNode:(n,e,t)=>K.from(n,e,t)};class le extends un{static get tagName(){return"tag:yaml.org,2002:seq"}constructor(e){super(ce,e),this.items=[]}add(e){this.items.push(e)}delete(e){const t=Ee(e);return typeof t!="number"?!1:this.items.splice(t,1).length>0}get(e,t){const s=Ee(e);if(typeof s!="number")return;const i=this.items[s];return!t&&w(i)?i.value:i}has(e){const t=Ee(e);return typeof t=="number"&&t<this.items.length}set(e,t){const s=Ee(e);if(typeof s!="number")throw new Error(`Expected a valid index, not ${e}.`);const i=this.items[s];w(i)&&cn(t)?i.value=t:this.items[s]=t}toJSON(e,t){const s=[];t!=null&&t.onCreate&&t.onCreate(s);let i=0;for(const o of this.items)s.push(x(o,String(i++),t));return s}toString(e,t,s){return e?pn(this,e,{blockItemPrefix:"- ",flowChars:{start:"[",end:"]"},itemIndent:(e.indent||"")+"  ",onChompKeep:s,onComment:t}):JSON.stringify(this)}static from(e,t,s){const{replacer:i}=s,o=new this(e);if(t&&Symbol.iterator in Object(t)){let l=0;for(let r of t){if(typeof i=="function"){const a=t instanceof Set?r:String(l++);r=i.call(t,a,r)}o.items.push(Ne(r,void 0,s))}}return o}}function Ee(n){let e=w(n)?n.value:n;return e&&typeof e=="string"&&(e=Number(e)),typeof e=="number"&&Number.isInteger(e)&&e>=0?e:null}const Ie={collection:"seq",default:!0,nodeClass:le,tag:"tag:yaml.org,2002:seq",resolve(n,e){return We(n)||e("Expected a sequence for this tag"),n},createNode:(n,e,t)=>le.from(n,e,t)},Te={identify:n=>typeof n=="string",default:!0,tag:"tag:yaml.org,2002:str",resolve:n=>n,stringify(n,e,t,s){return e=Object.assign({actualString:!0},e),It(n,e,t,s)}},Pe={identify:n=>n==null,createNode:()=>new v(null),default:!0,tag:"tag:yaml.org,2002:null",test:/^(?:~|[Nn]ull|NULL)?$/,resolve:()=>new v(null),stringify:({source:n},e)=>typeof n=="string"&&Pe.test.test(n)?n:e.options.nullStr},Ct={identify:n=>typeof n=="boolean",default:!0,tag:"tag:yaml.org,2002:bool",test:/^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,resolve:n=>new v(n[0]==="t"||n[0]==="T"),stringify({source:n,value:e},t){if(n&&Ct.test.test(n)){const s=n[0]==="t"||n[0]==="T";if(e===s)return n}return e?t.options.trueStr:t.options.falseStr}};function D({format:n,minFractionDigits:e,tag:t,value:s}){if(typeof s=="bigint")return String(s);const i=typeof s=="number"?s:Number(s);if(!isFinite(i))return isNaN(i)?".nan":i<0?"-.inf":".inf";let o=Object.is(s,-0)?"-0":JSON.stringify(s);if(!n&&e&&(!t||t==="tag:yaml.org,2002:float")&&/^-?\d/.test(o)&&!o.includes("e")){let l=o.indexOf(".");l<0&&(l=o.length,o+=".");let r=e-(o.length-l-1);for(;r-- >0;)o+="0"}return o}const yn={identify:n=>typeof n=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,resolve:n=>n.slice(-3).toLowerCase()==="nan"?NaN:n[0]==="-"?Number.NEGATIVE_INFINITY:Number.POSITIVE_INFINITY,stringify:D},Cn={identify:n=>typeof n=="number",default:!0,tag:"tag:yaml.org,2002:float",format:"EXP",test:/^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,resolve:n=>parseFloat(n),stringify(n){const e=Number(n.value);return isFinite(e)?e.toExponential():D(n)}},Gn={identify:n=>typeof n=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,resolve(n){const e=new v(parseFloat(n)),t=n.indexOf(".");return t!==-1&&n[n.length-1]==="0"&&(e.minFractionDigits=n.length-t-1),e},stringify:D},Ue=n=>typeof n=="bigint"||Number.isInteger(n),Gt=(n,e,t,{intAsBigInt:s})=>s?BigInt(n):parseInt(n.substring(e),t);function An(n,e,t){const{value:s}=n;return Ue(s)&&s>=0?t+s.toString(e):D(n)}const vn={identify:n=>Ue(n)&&n>=0,default:!0,tag:"tag:yaml.org,2002:int",format:"OCT",test:/^0o[0-7]+$/,resolve:(n,e,t)=>Gt(n,2,8,t),stringify:n=>An(n,8,"0o")},Bn={identify:Ue,default:!0,tag:"tag:yaml.org,2002:int",test:/^[-+]?[0-9]+$/,resolve:(n,e,t)=>Gt(n,0,10,t),stringify:D},Zn={identify:n=>Ue(n)&&n>=0,default:!0,tag:"tag:yaml.org,2002:int",format:"HEX",test:/^0x[0-9a-fA-F]+$/,resolve:(n,e,t)=>Gt(n,2,16,t),stringify:n=>An(n,16,"0x")},pi=[he,Ie,Te,Pe,Ct,vn,Bn,Zn,yn,Cn,Gn];function Wn(n){return typeof n=="bigint"||Number.isInteger(n)}const Qe=({value:n})=>JSON.stringify(n),yi=[{identify:n=>typeof n=="string",default:!0,tag:"tag:yaml.org,2002:str",resolve:n=>n,stringify:Qe},{identify:n=>n==null,createNode:()=>new v(null),default:!0,tag:"tag:yaml.org,2002:null",test:/^null$/,resolve:()=>null,stringify:Qe},{identify:n=>typeof n=="boolean",default:!0,tag:"tag:yaml.org,2002:bool",test:/^true$|^false$/,resolve:n=>n==="true",stringify:Qe},{identify:Wn,default:!0,tag:"tag:yaml.org,2002:int",test:/^-?(?:0|[1-9][0-9]*)$/,resolve:(n,e,{intAsBigInt:t})=>t?BigInt(n):parseInt(n,10),stringify:({value:n})=>Wn(n)?n.toString():JSON.stringify(n)},{identify:n=>typeof n=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,resolve:n=>parseFloat(n),stringify:Qe}],Ci={default:!0,tag:"",test:/^/,resolve(n,e){return e(`Unresolved plain scalar ${JSON.stringify(n)}`),n}},Gi=[he,Ie].concat(yi,Ci),At={identify:n=>n instanceof Uint8Array,default:!1,tag:"tag:yaml.org,2002:binary",resolve(n,e){if(typeof atob=="function"){const t=atob(n.replace(/[\n\r]/g,"")),s=new Uint8Array(t.length);for(let i=0;i<t.length;++i)s[i]=t.charCodeAt(i);return s}else return e("This environment does not support reading binary tags; either Buffer or atob is required"),n},stringify({comment:n,type:e,value:t},s,i,o){if(!t)return"";const l=t;let r;if(typeof btoa=="function"){let a="";for(let c=0;c<l.length;++c)a+=String.fromCharCode(l[c]);r=btoa(a)}else throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");if(e??(e=v.BLOCK_LITERAL),e!==v.QUOTE_DOUBLE){const a=Math.max(s.options.lineWidth-s.indent.length,s.options.minContentWidth),c=Math.ceil(r.length/a),u=new Array(c);for(let d=0,f=0;d<c;++d,f+=a)u[d]=r.substr(f,a);r=u.join(e===v.BLOCK_LITERAL?`
`:" ")}return It({comment:n,type:e,value:r},s,i,o)}};function wn(n,e){if(We(n))for(let t=0;t<n.items.length;++t){let s=n.items[t];if(!k(s)){if(Ze(s)){s.items.length>1&&e("Each pair must have its own sequence indicator");const i=s.items[0]||new F(new v(null));if(s.commentBefore&&(i.key.commentBefore=i.key.commentBefore?`${s.commentBefore}
${i.key.commentBefore}`:s.commentBefore),s.comment){const o=i.value??i.key;o.comment=o.comment?`${s.comment}
${o.comment}`:s.comment}s=i}n.items[t]=k(s)?s:new F(s)}}else e("Expected a sequence for this tag");return n}function Nn(n,e,t){const{replacer:s}=t,i=new le(n);i.tag="tag:yaml.org,2002:pairs";let o=0;if(e&&Symbol.iterator in Object(e))for(let l of e){typeof s=="function"&&(l=s.call(e,String(o++),l));let r,a;if(Array.isArray(l))if(l.length===2)r=l[0],a=l[1];else throw new TypeError(`Expected [key, value] tuple: ${l}`);else if(l&&l instanceof Object){const c=Object.keys(l);if(c.length===1)r=c[0],a=l[r];else throw new TypeError(`Expected tuple with one key, not ${c.length} keys`)}else r=l;i.items.push(yt(r,a,t))}return i}const vt={collection:"seq",default:!1,tag:"tag:yaml.org,2002:pairs",resolve:wn,createNode:Nn};class pe extends le{constructor(){super(),this.add=K.prototype.add.bind(this),this.delete=K.prototype.delete.bind(this),this.get=K.prototype.get.bind(this),this.has=K.prototype.has.bind(this),this.set=K.prototype.set.bind(this),this.tag=pe.tag}toJSON(e,t){if(!t)return super.toJSON(e);const s=new Map;t!=null&&t.onCreate&&t.onCreate(s);for(const i of this.items){let o,l;if(k(i)?(o=x(i.key,"",t),l=x(i.value,o,t)):o=x(i,"",t),s.has(o))throw new Error("Ordered maps must not include duplicate keys");s.set(o,l)}return s}static from(e,t,s){const i=Nn(e,t,s),o=new this;return o.items=i.items,o}}pe.tag="tag:yaml.org,2002:omap";const Bt={collection:"seq",identify:n=>n instanceof Map,nodeClass:pe,default:!1,tag:"tag:yaml.org,2002:omap",resolve(n,e){const t=wn(n,e),s=[];for(const{key:i}of t.items)w(i)&&(s.includes(i.value)?e(`Ordered maps must not include duplicate keys: ${i.value}`):s.push(i.value));return Object.assign(new pe,t)},createNode:(n,e,t)=>pe.from(n,e,t)};function Sn({value:n,source:e},t){return e&&(n?Vn:kn).test.test(e)?e:n?t.options.trueStr:t.options.falseStr}const Vn={identify:n=>n===!0,default:!0,tag:"tag:yaml.org,2002:bool",test:/^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,resolve:()=>new v(!0),stringify:Sn},kn={identify:n=>n===!1,default:!0,tag:"tag:yaml.org,2002:bool",test:/^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,resolve:()=>new v(!1),stringify:Sn},Ai={identify:n=>typeof n=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,resolve:n=>n.slice(-3).toLowerCase()==="nan"?NaN:n[0]==="-"?Number.NEGATIVE_INFINITY:Number.POSITIVE_INFINITY,stringify:D},vi={identify:n=>typeof n=="number",default:!0,tag:"tag:yaml.org,2002:float",format:"EXP",test:/^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,resolve:n=>parseFloat(n.replace(/_/g,"")),stringify(n){const e=Number(n.value);return isFinite(e)?e.toExponential():D(n)}},Bi={identify:n=>typeof n=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,resolve(n){const e=new v(parseFloat(n.replace(/_/g,""))),t=n.indexOf(".");if(t!==-1){const s=n.substring(t+1).replace(/_/g,"");s[s.length-1]==="0"&&(e.minFractionDigits=s.length)}return e},stringify:D},ke=n=>typeof n=="bigint"||Number.isInteger(n);function $e(n,e,t,{intAsBigInt:s}){const i=n[0];if((i==="-"||i==="+")&&(e+=1),n=n.substring(e).replace(/_/g,""),s){switch(t){case 2:n=`0b${n}`;break;case 8:n=`0o${n}`;break;case 16:n=`0x${n}`;break}const l=BigInt(n);return i==="-"?BigInt(-1)*l:l}const o=parseInt(n,t);return i==="-"?-1*o:o}function Zt(n,e,t){const{value:s}=n;if(ke(s)){const i=s.toString(e);return s<0?"-"+t+i.substr(1):t+i}return D(n)}const Zi={identify:ke,default:!0,tag:"tag:yaml.org,2002:int",format:"BIN",test:/^[-+]?0b[0-1_]+$/,resolve:(n,e,t)=>$e(n,2,2,t),stringify:n=>Zt(n,2,"0b")},Wi={identify:ke,default:!0,tag:"tag:yaml.org,2002:int",format:"OCT",test:/^[-+]?0[0-7_]+$/,resolve:(n,e,t)=>$e(n,1,8,t),stringify:n=>Zt(n,8,"0")},wi={identify:ke,default:!0,tag:"tag:yaml.org,2002:int",test:/^[-+]?[0-9][0-9_]*$/,resolve:(n,e,t)=>$e(n,0,10,t),stringify:D},Ni={identify:ke,default:!0,tag:"tag:yaml.org,2002:int",format:"HEX",test:/^[-+]?0x[0-9a-fA-F_]+$/,resolve:(n,e,t)=>$e(n,2,16,t),stringify:n=>Zt(n,16,"0x")};class ye extends K{constructor(e){super(e),this.tag=ye.tag}add(e){let t;k(e)?t=e:e&&typeof e=="object"&&"key"in e&&"value"in e&&e.value===null?t=new F(e.key,null):t=new F(e,null),oe(this.items,t.key)||this.items.push(t)}get(e,t){const s=oe(this.items,e);return!t&&k(s)?w(s.key)?s.key.value:s.key:s}set(e,t){if(typeof t!="boolean")throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof t}`);const s=oe(this.items,e);s&&!t?this.items.splice(this.items.indexOf(s),1):!s&&t&&this.items.push(new F(e))}toJSON(e,t){return super.toJSON(e,t,Set)}toString(e,t,s){if(!e)return JSON.stringify(this);if(this.hasAllNullValues(!0))return super.toString(Object.assign({},e,{allNullValues:!0}),t,s);throw new Error("Set items must all have null values")}static from(e,t,s){const{replacer:i}=s,o=new this(e);if(t&&Symbol.iterator in Object(t))for(let l of t)typeof i=="function"&&(l=i.call(t,l,l)),o.items.push(yt(l,null,s));return o}}ye.tag="tag:yaml.org,2002:set";const Wt={collection:"map",identify:n=>n instanceof Set,nodeClass:ye,default:!1,tag:"tag:yaml.org,2002:set",createNode:(n,e,t)=>ye.from(n,e,t),resolve(n,e){if(Ze(n)){if(n.hasAllNullValues(!0))return Object.assign(new ye,n);e("Set items must all have null values")}else e("Expected a mapping for this tag");return n}};function wt(n,e){const t=n[0],s=t==="-"||t==="+"?n.substring(1):n,i=l=>e?BigInt(l):Number(l),o=s.replace(/_/g,"").split(":").reduce((l,r)=>l*i(60)+i(r),i(0));return t==="-"?i(-1)*o:o}function Yn(n){let{value:e}=n,t=l=>l;if(typeof e=="bigint")t=l=>BigInt(l);else if(isNaN(e)||!isFinite(e))return D(n);let s="";e<0&&(s="-",e*=t(-1));const i=t(60),o=[e%i];return e<60?o.unshift(0):(e=(e-o[0])/i,o.unshift(e%i),e>=60&&(e=(e-o[0])/i,o.unshift(e))),s+o.map(l=>String(l).padStart(2,"0")).join(":").replace(/000000\d*$/,"")}const _n={identify:n=>typeof n=="bigint"||Number.isInteger(n),default:!0,tag:"tag:yaml.org,2002:int",format:"TIME",test:/^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,resolve:(n,e,{intAsBigInt:t})=>wt(n,t),stringify:Yn},Xn={identify:n=>typeof n=="number",default:!0,tag:"tag:yaml.org,2002:float",format:"TIME",test:/^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,resolve:n=>wt(n,!1),stringify:Yn},qe={identify:n=>n instanceof Date,default:!0,tag:"tag:yaml.org,2002:timestamp",test:RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),resolve(n){const e=n.match(qe.test);if(!e)throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");const[,t,s,i,o,l,r]=e.map(Number),a=e[7]?Number((e[7]+"00").substr(1,3)):0;let c=Date.UTC(t,s-1,i,o||0,l||0,r||0,a);const u=e[8];if(u&&u!=="Z"){let d=wt(u,!1);Math.abs(d)<30&&(d*=60),c-=6e4*d}return new Date(c)},stringify:({value:n})=>(n==null?void 0:n.toISOString().replace(/(T00:00:00)?\.000Z$/,""))??""},Rn=[he,Ie,Te,Pe,Vn,kn,Zi,Wi,wi,Ni,Ai,vi,Bi,At,Q,Bt,vt,Wt,_n,Xn,qe],Fn=new Map([["core",pi],["failsafe",[he,Ie,Te]],["json",Gi],["yaml11",Rn],["yaml-1.1",Rn]]),Hn={binary:At,bool:Ct,float:Gn,floatExp:Cn,floatNaN:yn,floatTime:Xn,int:Bn,intHex:Zn,intOct:vn,intTime:_n,map:he,merge:Q,null:Pe,omap:Bt,pairs:vt,seq:Ie,set:Wt,timestamp:qe},Si={"tag:yaml.org,2002:binary":At,"tag:yaml.org,2002:merge":Q,"tag:yaml.org,2002:omap":Bt,"tag:yaml.org,2002:pairs":vt,"tag:yaml.org,2002:set":Wt,"tag:yaml.org,2002:timestamp":qe};function Nt(n,e,t){const s=Fn.get(e);if(s&&!n)return t&&!s.includes(Q)?s.concat(Q):s.slice();let i=s;if(!i)if(Array.isArray(n))i=[];else{const o=Array.from(Fn.keys()).filter(l=>l!=="yaml11").map(l=>JSON.stringify(l)).join(", ");throw new Error(`Unknown schema "${e}"; use one of ${o} or define customTags array`)}if(Array.isArray(n))for(const o of n)i=i.concat(o);else typeof n=="function"&&(i=n(i.slice()));return t&&(i=i.concat(Q)),i.reduce((o,l)=>{const r=typeof l=="string"?Hn[l]:l;if(!r){const a=JSON.stringify(l),c=Object.keys(Hn).map(u=>JSON.stringify(u)).join(", ");throw new Error(`Unknown custom tag ${a}; use one of ${c}`)}return o.includes(r)||o.push(r),o},[])}const Vi=(n,e)=>n.key<e.key?-1:n.key>e.key?1:0;class St{constructor({compat:e,customTags:t,merge:s,resolveKnownTags:i,schema:o,sortMapEntries:l,toStringDefaults:r}){this.compat=Array.isArray(e)?Nt(e,"compat"):e?Nt(null,e):null,this.name=typeof o=="string"&&o||"core",this.knownTags=i?Si:{},this.tags=Nt(t,this.name,s),this.toStringOptions=r??null,Object.defineProperty(this,ee,{value:he}),Object.defineProperty(this,T,{value:Te}),Object.defineProperty(this,ce,{value:Ie}),this.sortMapEntries=typeof l=="function"?l:l===!0?Vi:null}clone(){const e=Object.create(St.prototype,Object.getOwnPropertyDescriptors(this));return e.tags=this.tags.slice(),e}}function ki(n,e){var a;const t=[];let s=e.directives===!0;if(e.directives!==!1&&n.directives){const c=n.directives.toString(n);c?(t.push(c),s=!0):n.directives.docStart&&(s=!0)}s&&t.push("---");const i=fn(n,e),{commentString:o}=i.options;if(n.commentBefore){t.length!==1&&t.unshift("");const c=o(n.commentBefore);t.unshift(U(c,""))}let l=!1,r=null;if(n.contents){if(_(n.contents)){if(n.contents.spaceBefore&&s&&t.push(""),n.contents.commentBefore){const d=o(n.contents.commentBefore);t.push(U(d,""))}i.forceBlockIndent=!!n.comment,r=n.contents.comment}const c=r?void 0:()=>l=!0;let u=be(n.contents,i,()=>r=null,c);r&&(u+=ie(u,"",o(r))),(u[0]==="|"||u[0]===">")&&t[t.length-1]==="---"?t[t.length-1]=`--- ${u}`:t.push(u)}else t.push(be(n.contents,i));if((a=n.directives)!=null&&a.docEnd)if(n.comment){const c=o(n.comment);c.includes(`
`)?(t.push("..."),t.push(U(c,""))):t.push(`... ${c}`)}else t.push("...");else{let c=n.comment;c&&l&&(c=c.replace(/^\n+/,"")),c&&((!l||r)&&t[t.length-1]!==""&&t.push(""),t.push(U(o(c),"")))}return t.join(`
`)+`
`}class et{constructor(e,t,s){this.commentBefore=null,this.comment=null,this.errors=[],this.warnings=[],Object.defineProperty(this,z,{value:dt});let i=null;typeof t=="function"||Array.isArray(t)?i=t:s===void 0&&t&&(s=t,t=void 0);const o=Object.assign({intAsBigInt:!1,keepSourceTokens:!1,logLevel:"warn",prettyErrors:!0,strict:!0,stringKeys:!1,uniqueKeys:!0,version:"1.2"},s);this.options=o;let{version:l}=o;s!=null&&s._directives?(this.directives=s._directives.atDocument(),this.directives.yaml.explicit&&(l=this.directives.yaml.version)):this.directives=new R({version:l}),this.setSchema(l,s),this.contents=e===void 0?null:this.createNode(e,i,s)}clone(){const e=Object.create(et.prototype,{[z]:{value:dt}});return e.commentBefore=this.commentBefore,e.comment=this.comment,e.errors=this.errors.slice(),e.warnings=this.warnings.slice(),e.options=Object.assign({},this.options),this.directives&&(e.directives=this.directives.clone()),e.schema=this.schema.clone(),e.contents=_(this.contents)?this.contents.clone(e.schema):this.contents,this.range&&(e.range=this.range.slice()),e}add(e){Ce(this.contents)&&this.contents.add(e)}addIn(e,t){Ce(this.contents)&&this.contents.addIn(e,t)}createAlias(e,t){if(!e.anchor){const s=rn(this);e.anchor=!t||s.has(t)?an(t||"a",s):t}return new ft(e.anchor)}createNode(e,t,s){let i;if(typeof t=="function")e=t.call({"":e},"",e),i=t;else if(Array.isArray(t)){const b=p=>typeof p=="number"||p instanceof String||p instanceof Number,I=t.filter(b).map(String);I.length>0&&(t=t.concat(I)),i=t}else s===void 0&&t&&(s=t,t=void 0);const{aliasDuplicateObjects:o,anchorPrefix:l,flow:r,keepUndefined:a,onTagObj:c,tag:u}=s??{},{onAnchor:d,setAnchors:f,sourceObjects:g}=oi(this,l||"a"),h={aliasDuplicateObjects:o??!0,keepUndefined:a??!1,onAnchor:d,onTagObj:c,replacer:i,schema:this.schema,sourceObjects:g},m=Ne(e,u,h);return r&&Y(m)&&(m.flow=!0),f(),m}createPair(e,t,s={}){const i=this.createNode(e,null,s),o=this.createNode(t,null,s);return new F(i,o)}delete(e){return Ce(this.contents)?this.contents.delete(e):!1}deleteIn(e){return Se(e)?this.contents==null?!1:(this.contents=null,!0):Ce(this.contents)?this.contents.deleteIn(e):!1}get(e,t){return Y(this.contents)?this.contents.get(e,t):void 0}getIn(e,t){return Se(e)?!t&&w(this.contents)?this.contents.value:this.contents:Y(this.contents)?this.contents.getIn(e,t):void 0}has(e){return Y(this.contents)?this.contents.has(e):!1}hasIn(e){return Se(e)?this.contents!==void 0:Y(this.contents)?this.contents.hasIn(e):!1}set(e,t){this.contents==null?this.contents=Je(this.schema,[e],t):Ce(this.contents)&&this.contents.set(e,t)}setIn(e,t){Se(e)?this.contents=t:this.contents==null?this.contents=Je(this.schema,Array.from(e),t):Ce(this.contents)&&this.contents.setIn(e,t)}setSchema(e,t={}){typeof e=="number"&&(e=String(e));let s;switch(e){case"1.1":this.directives?this.directives.yaml.version="1.1":this.directives=new R({version:"1.1"}),s={resolveKnownTags:!1,schema:"yaml-1.1"};break;case"1.2":case"next":this.directives?this.directives.yaml.version=e:this.directives=new R({version:e}),s={resolveKnownTags:!0,schema:"core"};break;case null:this.directives&&delete this.directives,s=null;break;default:{const i=JSON.stringify(e);throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${i}`)}}if(t.schema instanceof Object)this.schema=t.schema;else if(s)this.schema=new St(Object.assign(s,t));else throw new Error("With a null YAML version, the { schema: Schema } option is required")}toJS({json:e,jsonArg:t,mapAsMap:s,maxAliasCount:i,onAnchor:o,reviver:l}={}){const r={anchors:new Map,doc:this,keep:!e,mapAsMap:s===!0,mapKeyWarned:!1,maxAliasCount:typeof i=="number"?i:100},a=x(this.contents,t??"",r);if(typeof o=="function")for(const{count:c,res:u}of r.anchors.values())o(u,c);return typeof l=="function"?fe(l,{"":a},"",a):a}toJSON(e,t){return this.toJS({json:!0,jsonArg:e,mapAsMap:!1,onAnchor:t})}toString(e={}){if(this.errors.length>0)throw new Error("Document with errors cannot be stringified");if("indent"in e&&(!Number.isInteger(e.indent)||Number(e.indent)<=0)){const t=JSON.stringify(e.indent);throw new Error(`"indent" option must be a positive integer, not ${t}`)}return ki(this,e)}}function Ce(n){if(Y(n))return!0;throw new Error("Expected a YAML collection as document contents")}class On extends Error{constructor(e,t,s,i){super(),this.name=e,this.code=s,this.message=i,this.pos=t}}class Ye extends On{constructor(e,t,s){super("YAMLParseError",e,t,s)}}class Yi extends On{constructor(e,t,s){super("YAMLWarning",e,t,s)}}const Jn=(n,e)=>t=>{if(t.pos[0]===-1)return;t.linePos=t.pos.map(r=>e.linePos(r));const{line:s,col:i}=t.linePos[0];t.message+=` at line ${s}, column ${i}`;let o=i-1,l=n.substring(e.lineStarts[s-1],e.lineStarts[s]).replace(/[\n\r]+$/,"");if(o>=60&&l.length>80){const r=Math.min(o-39,l.length-79);l="…"+l.substring(r),o-=r-1}if(l.length>80&&(l=l.substring(0,79)+"…"),s>1&&/^ *$/.test(l.substring(0,o))){let r=n.substring(e.lineStarts[s-2],e.lineStarts[s-1]);r.length>80&&(r=r.substring(0,79)+`…
`),l=r+l}if(/[^ ]/.test(l)){let r=1;const a=t.linePos[1];(a==null?void 0:a.line)===s&&a.col>i&&(r=Math.max(1,Math.min(a.col-i,80-o)));const c=" ".repeat(o)+"^".repeat(r);t.message+=`:

${l}
${c}
`}};function Ge(n,{flow:e,indicator:t,next:s,offset:i,onError:o,parentIndent:l,startOnNewline:r}){let a=!1,c=r,u=r,d="",f="",g=!1,h=!1,m=null,b=null,I=null,p=null,G=null,C=null,A=null;for(const y of n)switch(h&&(y.type!=="space"&&y.type!=="newline"&&y.type!=="comma"&&o(y.offset,"MISSING_CHAR","Tags and anchors must be separated from the next token by white space"),h=!1),m&&(c&&y.type!=="comment"&&y.type!=="newline"&&o(m,"TAB_AS_INDENT","Tabs are not allowed as indentation"),m=null),y.type){case"space":!e&&(t!=="doc-start"||(s==null?void 0:s.type)!=="flow-collection")&&y.source.includes("	")&&(m=y),u=!0;break;case"comment":{u||o(y,"MISSING_CHAR","Comments must be separated from other tokens by white space characters");const N=y.source.substring(1)||" ";d?d+=f+N:d=N,f="",c=!1;break}case"newline":c?d?d+=y.source:(!C||t!=="seq-item-ind")&&(a=!0):f+=y.source,c=!0,g=!0,(b||I)&&(p=y),u=!0;break;case"anchor":b&&o(y,"MULTIPLE_ANCHORS","A node can have at most one anchor"),y.source.endsWith(":")&&o(y.offset+y.source.length-1,"BAD_ALIAS","Anchor ending in : is ambiguous",!0),b=y,A??(A=y.offset),c=!1,u=!1,h=!0;break;case"tag":{I&&o(y,"MULTIPLE_TAGS","A node can have at most one tag"),I=y,A??(A=y.offset),c=!1,u=!1,h=!0;break}case t:(b||I)&&o(y,"BAD_PROP_ORDER",`Anchors and tags must be after the ${y.source} indicator`),C&&o(y,"UNEXPECTED_TOKEN",`Unexpected ${y.source} in ${e??"collection"}`),C=y,c=t==="seq-item-ind"||t==="explicit-key-ind",u=!1;break;case"comma":if(e){G&&o(y,"UNEXPECTED_TOKEN",`Unexpected , in ${e}`),G=y,c=!1,u=!1;break}default:o(y,"UNEXPECTED_TOKEN",`Unexpected ${y.type} token`),c=!1,u=!1}const W=n[n.length-1],Z=W?W.offset+W.source.length:i;return h&&s&&s.type!=="space"&&s.type!=="newline"&&s.type!=="comma"&&(s.type!=="scalar"||s.source!=="")&&o(s.offset,"MISSING_CHAR","Tags and anchors must be separated from the next token by white space"),m&&(c&&m.indent<=l||(s==null?void 0:s.type)==="block-map"||(s==null?void 0:s.type)==="block-seq")&&o(m,"TAB_AS_INDENT","Tabs are not allowed as indentation"),{comma:G,found:C,spaceBefore:a,comment:d,hasNewline:g,anchor:b,tag:I,newlineAfterProp:p,end:Z,start:A??Z}}function _e(n){if(!n)return null;switch(n.type){case"alias":case"scalar":case"double-quoted-scalar":case"single-quoted-scalar":if(n.source.includes(`
`))return!0;if(n.end){for(const e of n.end)if(e.type==="newline")return!0}return!1;case"flow-collection":for(const e of n.items){for(const t of e.start)if(t.type==="newline")return!0;if(e.sep){for(const t of e.sep)if(t.type==="newline")return!0}if(_e(e.key)||_e(e.value))return!0}return!1;default:return!0}}function Vt(n,e,t){if((e==null?void 0:e.type)==="flow-collection"){const s=e.end[0];s.indent===n&&(s.source==="]"||s.source==="}")&&_e(e)&&t(s,"BAD_INDENT","Flow end indicator should be more indented than parent",!0)}}function zn(n,e,t){const{uniqueKeys:s}=n.options;if(s===!1)return!1;const i=typeof s=="function"?s:(o,l)=>o===l||w(o)&&w(l)&&o.value===l.value;return e.some(o=>i(o.key,t))}const xn="All mapping items must start at the same column";function _i({composeNode:n,composeEmptyNode:e},t,s,i,o){var u;const l=(o==null?void 0:o.nodeClass)??K,r=new l(t.schema);t.atRoot&&(t.atRoot=!1);let a=s.offset,c=null;for(const d of s.items){const{start:f,key:g,sep:h,value:m}=d,b=Ge(f,{indicator:"explicit-key-ind",next:g??(h==null?void 0:h[0]),offset:a,onError:i,parentIndent:s.indent,startOnNewline:!0}),I=!b.found;if(I){if(g&&(g.type==="block-seq"?i(a,"BLOCK_AS_IMPLICIT_KEY","A block sequence may not be used as an implicit map key"):"indent"in g&&g.indent!==s.indent&&i(a,"BAD_INDENT",xn)),!b.anchor&&!b.tag&&!h){c=b.end,b.comment&&(r.comment?r.comment+=`
`+b.comment:r.comment=b.comment);continue}(b.newlineAfterProp||_e(g))&&i(g??f[f.length-1],"MULTILINE_IMPLICIT_KEY","Implicit keys need to be on a single line")}else((u=b.found)==null?void 0:u.indent)!==s.indent&&i(a,"BAD_INDENT",xn);t.atKey=!0;const p=b.end,G=g?n(t,g,b,i):e(t,p,f,null,b,i);t.schema.compat&&Vt(s.indent,g,i),t.atKey=!1,zn(t,r.items,G)&&i(p,"DUPLICATE_KEY","Map keys must be unique");const C=Ge(h??[],{indicator:"map-value-ind",next:m,offset:G.range[2],onError:i,parentIndent:s.indent,startOnNewline:!g||g.type==="block-scalar"});if(a=C.end,C.found){I&&((m==null?void 0:m.type)==="block-map"&&!C.hasNewline&&i(a,"BLOCK_AS_IMPLICIT_KEY","Nested mappings are not allowed in compact mappings"),t.options.strict&&b.start<C.found.offset-1024&&i(G.range,"KEY_OVER_1024_CHARS","The : indicator must be at most 1024 chars after the start of an implicit block mapping key"));const A=m?n(t,m,C,i):e(t,a,h,null,C,i);t.schema.compat&&Vt(s.indent,m,i),a=A.range[2];const W=new F(G,A);t.options.keepSourceTokens&&(W.srcToken=d),r.items.push(W)}else{I&&i(G.range,"MISSING_CHAR","Implicit map keys need to be followed by map values"),C.comment&&(G.comment?G.comment+=`
`+C.comment:G.comment=C.comment);const A=new F(G);t.options.keepSourceTokens&&(A.srcToken=d),r.items.push(A)}}return c&&c<a&&i(c,"IMPOSSIBLE","Map comment with trailing content"),r.range=[s.offset,a,c??a],r}function Xi({composeNode:n,composeEmptyNode:e},t,s,i,o){const l=(o==null?void 0:o.nodeClass)??le,r=new l(t.schema);t.atRoot&&(t.atRoot=!1),t.atKey&&(t.atKey=!1);let a=s.offset,c=null;for(const{start:u,value:d}of s.items){const f=Ge(u,{indicator:"seq-item-ind",next:d,offset:a,onError:i,parentIndent:s.indent,startOnNewline:!0});if(!f.found)if(f.anchor||f.tag||d)(d==null?void 0:d.type)==="block-seq"?i(f.end,"BAD_INDENT","All sequence items must start at the same column"):i(a,"MISSING_CHAR","Sequence item without - indicator");else{c=f.end,f.comment&&(r.comment=f.comment);continue}const g=d?n(t,d,f,i):e(t,f.end,u,null,f,i);t.schema.compat&&Vt(s.indent,d,i),a=g.range[2],r.items.push(g)}return r.range=[s.offset,a,c??a],r}function Xe(n,e,t,s){let i="";if(n){let o=!1,l="";for(const r of n){const{source:a,type:c}=r;switch(c){case"space":o=!0;break;case"comment":{t&&!o&&s(r,"MISSING_CHAR","Comments must be separated from other tokens by white space characters");const u=a.substring(1)||" ";i?i+=l+u:i=u,l="";break}case"newline":i&&(l+=a),o=!0;break;default:s(r,"UNEXPECTED_TOKEN",`Unexpected ${c} at node end`)}e+=a.length}}return{comment:i,offset:e}}const kt="Block collections are not allowed within flow collections",Yt=n=>n&&(n.type==="block-map"||n.type==="block-seq");function Ri({composeNode:n,composeEmptyNode:e},t,s,i,o){var b;const l=s.start.source==="{",r=l?"flow map":"flow sequence",a=(o==null?void 0:o.nodeClass)??(l?K:le),c=new a(t.schema);c.flow=!0;const u=t.atRoot;u&&(t.atRoot=!1),t.atKey&&(t.atKey=!1);let d=s.offset+s.start.source.length;for(let I=0;I<s.items.length;++I){const p=s.items[I],{start:G,key:C,sep:A,value:W}=p,Z=Ge(G,{flow:r,indicator:"explicit-key-ind",next:C??(A==null?void 0:A[0]),offset:d,onError:i,parentIndent:s.indent,startOnNewline:!1});if(!Z.found){if(!Z.anchor&&!Z.tag&&!A&&!W){I===0&&Z.comma?i(Z.comma,"UNEXPECTED_TOKEN",`Unexpected , in ${r}`):I<s.items.length-1&&i(Z.start,"UNEXPECTED_TOKEN",`Unexpected empty item in ${r}`),Z.comment&&(c.comment?c.comment+=`
`+Z.comment:c.comment=Z.comment),d=Z.end;continue}!l&&t.options.strict&&_e(C)&&i(C,"MULTILINE_IMPLICIT_KEY","Implicit keys of flow sequence pairs need to be on a single line")}if(I===0)Z.comma&&i(Z.comma,"UNEXPECTED_TOKEN",`Unexpected , in ${r}`);else if(Z.comma||i(Z.start,"MISSING_CHAR",`Missing , between ${r} items`),Z.comment){let y="";e:for(const N of G)switch(N.type){case"comma":case"space":break;case"comment":y=N.source.substring(1);break e;default:break e}if(y){let N=c.items[c.items.length-1];k(N)&&(N=N.value??N.key),N.comment?N.comment+=`
`+y:N.comment=y,Z.comment=Z.comment.substring(y.length+1)}}if(!l&&!A&&!Z.found){const y=W?n(t,W,Z,i):e(t,Z.end,A,null,Z,i);c.items.push(y),d=y.range[2],Yt(W)&&i(y.range,"BLOCK_IN_FLOW",kt)}else{t.atKey=!0;const y=Z.end,N=C?n(t,C,Z,i):e(t,y,G,null,Z,i);Yt(C)&&i(N.range,"BLOCK_IN_FLOW",kt),t.atKey=!1;const O=Ge(A??[],{flow:r,indicator:"map-value-ind",next:W,offset:N.range[2],onError:i,parentIndent:s.indent,startOnNewline:!1});if(O.found){if(!l&&!Z.found&&t.options.strict){if(A)for(const E of A){if(E===O.found)break;if(E.type==="newline"){i(E,"MULTILINE_IMPLICIT_KEY","Implicit keys of flow sequence pairs need to be on a single line");break}}Z.start<O.found.offset-1024&&i(O.found,"KEY_OVER_1024_CHARS","The : indicator must be at most 1024 chars after the start of an implicit flow sequence key")}}else W&&("source"in W&&((b=W.source)==null?void 0:b[0])===":"?i(W,"MISSING_CHAR",`Missing space after : in ${r}`):i(O.start,"MISSING_CHAR",`Missing , or : between ${r} items`));const $=W?n(t,W,O,i):O.found?e(t,O.end,A,null,O,i):null;$?Yt(W)&&i($.range,"BLOCK_IN_FLOW",kt):O.comment&&(N.comment?N.comment+=`
`+O.comment:N.comment=O.comment);const L=new F(N,$);if(t.options.keepSourceTokens&&(L.srcToken=p),l){const E=c;zn(t,E.items,N)&&i(y,"DUPLICATE_KEY","Map keys must be unique"),E.items.push(L)}else{const E=new K(t.schema);E.flow=!0,E.items.push(L);const fs=($??N).range;E.range=[N.range[0],fs[1],fs[2]],c.items.push(E)}d=$?$.range[2]:O.end}}const f=l?"}":"]",[g,...h]=s.end;let m=d;if((g==null?void 0:g.source)===f)m=g.offset+g.source.length;else{const I=r[0].toUpperCase()+r.substring(1),p=u?`${I} must end with a ${f}`:`${I} in block collection must be sufficiently indented and end with a ${f}`;i(d,u?"MISSING_CHAR":"BAD_INDENT",p),g&&g.source.length!==1&&h.unshift(g)}if(h.length>0){const I=Xe(h,m,t.options.strict,i);I.comment&&(c.comment?c.comment+=`
`+I.comment:c.comment=I.comment),c.range=[s.offset,m,I.offset]}else c.range=[s.offset,m,m];return c}function _t(n,e,t,s,i,o){const l=t.type==="block-map"?_i(n,e,t,s,o):t.type==="block-seq"?Xi(n,e,t,s,o):Ri(n,e,t,s,o),r=l.constructor;return i==="!"||i===r.tagName?(l.tag=r.tagName,l):(i&&(l.tag=i),l)}function Fi(n,e,t,s,i){var f;const o=s.tag,l=o?e.directives.tagName(o.source,g=>i(o,"TAG_RESOLVE_FAILED",g)):null;if(t.type==="block-seq"){const{anchor:g,newlineAfterProp:h}=s,m=g&&o?g.offset>o.offset?g:o:g??o;m&&(!h||h.offset<m.offset)&&i(m,"MISSING_CHAR","Missing newline after block sequence props")}const r=t.type==="block-map"?"map":t.type==="block-seq"?"seq":t.start.source==="{"?"map":"seq";if(!o||!l||l==="!"||l===K.tagName&&r==="map"||l===le.tagName&&r==="seq")return _t(n,e,t,i,l);let a=e.schema.tags.find(g=>g.tag===l&&g.collection===r);if(!a){const g=e.schema.knownTags[l];if((g==null?void 0:g.collection)===r)e.schema.tags.push(Object.assign({},g,{default:!1})),a=g;else return g?i(o,"BAD_COLLECTION_TYPE",`${g.tag} used for ${r} collection, but expects ${g.collection??"scalar"}`,!0):i(o,"TAG_RESOLVE_FAILED",`Unresolved tag: ${l}`,!0),_t(n,e,t,i,l)}const c=_t(n,e,t,i,l,a),u=((f=a.resolve)==null?void 0:f.call(a,c,g=>i(o,"TAG_RESOLVE_FAILED",g),e.options))??c,d=_(u)?u:new v(u);return d.range=c.range,d.tag=l,a!=null&&a.format&&(d.format=a.format),d}function Hi(n,e,t){const s=e.offset,i=Oi(e,n.options.strict,t);if(!i)return{value:"",type:null,comment:"",range:[s,s,s]};const o=i.mode===">"?v.BLOCK_FOLDED:v.BLOCK_LITERAL,l=e.source?Ji(e.source):[];let r=l.length;for(let m=l.length-1;m>=0;--m){const b=l[m][1];if(b===""||b==="\r")r=m;else break}if(r===0){const m=i.chomp==="+"&&l.length>0?`
`.repeat(Math.max(1,l.length-1)):"";let b=s+i.length;return e.source&&(b+=e.source.length),{value:m,type:o,comment:i.comment,range:[s,b,b]}}let a=e.indent+i.indent,c=e.offset+i.length,u=0;for(let m=0;m<r;++m){const[b,I]=l[m];if(I===""||I==="\r")i.indent===0&&b.length>a&&(a=b.length);else{b.length<a&&t(c+b.length,"MISSING_CHAR","Block scalars with more-indented leading empty lines must use an explicit indentation indicator"),i.indent===0&&(a=b.length),u=m,a===0&&!n.atRoot&&t(c,"BAD_INDENT","Block scalar values in collections must be indented");break}c+=b.length+I.length+1}for(let m=l.length-1;m>=r;--m)l[m][0].length>a&&(r=m+1);let d="",f="",g=!1;for(let m=0;m<u;++m)d+=l[m][0].slice(a)+`
`;for(let m=u;m<r;++m){let[b,I]=l[m];c+=b.length+I.length+1;const p=I[I.length-1]==="\r";if(p&&(I=I.slice(0,-1)),I&&b.length<a){const C=`Block scalar lines must not be less indented than their ${i.indent?"explicit indentation indicator":"first line"}`;t(c-I.length-(p?2:1),"BAD_INDENT",C),b=""}o===v.BLOCK_LITERAL?(d+=f+b.slice(a)+I,f=`
`):b.length>a||I[0]==="	"?(f===" "?f=`
`:!g&&f===`
`&&(f=`

`),d+=f+b.slice(a)+I,f=`
`,g=!0):I===""?f===`
`?d+=`
`:f=`
`:(d+=f+I,f=" ",g=!1)}switch(i.chomp){case"-":break;case"+":for(let m=r;m<l.length;++m)d+=`
`+l[m][0].slice(a);d[d.length-1]!==`
`&&(d+=`
`);break;default:d+=`
`}const h=s+i.length+e.source.length;return{value:d,type:o,comment:i.comment,range:[s,h,h]}}function Oi({offset:n,props:e},t,s){if(e[0].type!=="block-scalar-header")return s(e[0],"IMPOSSIBLE","Block scalar header not found"),null;const{source:i}=e[0],o=i[0];let l=0,r="",a=-1;for(let f=1;f<i.length;++f){const g=i[f];if(!r&&(g==="-"||g==="+"))r=g;else{const h=Number(g);!l&&h?l=h:a===-1&&(a=n+f)}}a!==-1&&s(a,"UNEXPECTED_TOKEN",`Block scalar header includes extra characters: ${i}`);let c=!1,u="",d=i.length;for(let f=1;f<e.length;++f){const g=e[f];switch(g.type){case"space":c=!0;case"newline":d+=g.source.length;break;case"comment":t&&!c&&s(g,"MISSING_CHAR","Comments must be separated from other tokens by white space characters"),d+=g.source.length,u=g.source.substring(1);break;case"error":s(g,"UNEXPECTED_TOKEN",g.message),d+=g.source.length;break;default:{const h=`Unexpected token in block scalar header: ${g.type}`;s(g,"UNEXPECTED_TOKEN",h);const m=g.source;m&&typeof m=="string"&&(d+=m.length)}}}return{mode:o,indent:l,chomp:r,comment:u,length:d}}function Ji(n){const e=n.split(/\n( *)/),t=e[0],s=t.match(/^( *)/),o=[s!=null&&s[1]?[s[1],t.slice(s[1].length)]:["",t]];for(let l=1;l<e.length;l+=2)o.push([e[l],e[l+1]]);return o}function zi(n,e,t){const{offset:s,type:i,source:o,end:l}=n;let r,a;const c=(f,g,h)=>t(s+f,g,h);switch(i){case"scalar":r=v.PLAIN,a=xi(o,c);break;case"single-quoted-scalar":r=v.QUOTE_SINGLE,a=Ki(o,c);break;case"double-quoted-scalar":r=v.QUOTE_DOUBLE,a=Di(o,c);break;default:return t(n,"UNEXPECTED_TOKEN",`Expected a flow scalar value, but found: ${i}`),{value:"",type:null,comment:"",range:[s,s+o.length,s+o.length]}}const u=s+o.length,d=Xe(l,u,e,t);return{value:a,type:r,comment:d.comment,range:[s,u,d.offset]}}function xi(n,e){let t="";switch(n[0]){case"	":t="a tab character";break;case",":t="flow indicator character ,";break;case"%":t="directive indicator character %";break;case"|":case">":{t=`block scalar indicator ${n[0]}`;break}case"@":case"`":{t=`reserved character ${n[0]}`;break}}return t&&e(0,"BAD_SCALAR_START",`Plain value cannot start with ${t}`),Kn(n)}function Ki(n,e){return(n[n.length-1]!=="'"||n.length===1)&&e(n.length,"MISSING_CHAR","Missing closing 'quote"),Kn(n.slice(1,-1)).replace(/''/g,"'")}function Kn(n){let e,t;try{e=new RegExp(`(.*?)(?<![ 	])[ 	]*\r?
`,"sy"),t=new RegExp(`[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?
`,"sy")}catch{e=/(.*?)[ \t]*\r?\n/sy,t=/[ \t]*(.*?)[ \t]*\r?\n/sy}let s=e.exec(n);if(!s)return n;let i=s[1],o=" ",l=e.lastIndex;for(t.lastIndex=l;s=t.exec(n);)s[1]===""?o===`
`?i+=o:o=`
`:(i+=o+s[1],o=" "),l=t.lastIndex;const r=/[ \t]*(.*)/sy;return r.lastIndex=l,s=r.exec(n),i+o+((s==null?void 0:s[1])??"")}function Di(n,e){let t="";for(let s=1;s<n.length-1;++s){const i=n[s];if(!(i==="\r"&&n[s+1]===`
`))if(i===`
`){const{fold:o,offset:l}=ji(n,s);t+=o,s=l}else if(i==="\\"){let o=n[++s];const l=Mi[o];if(l)t+=l;else if(o===`
`)for(o=n[s+1];o===" "||o==="	";)o=n[++s+1];else if(o==="\r"&&n[s+1]===`
`)for(o=n[++s+1];o===" "||o==="	";)o=n[++s+1];else if(o==="x"||o==="u"||o==="U"){const r=o==="x"?2:o==="u"?4:8;t+=Li(n,s+1,r,e),s+=r}else{const r=n.substr(s-1,2);e(s-1,"BAD_DQ_ESCAPE",`Invalid escape sequence ${r}`),t+=r}}else if(i===" "||i==="	"){const o=s;let l=n[s+1];for(;l===" "||l==="	";)l=n[++s+1];l!==`
`&&!(l==="\r"&&n[s+2]===`
`)&&(t+=s>o?n.slice(o,s+1):i)}else t+=i}return(n[n.length-1]!=='"'||n.length===1)&&e(n.length,"MISSING_CHAR",'Missing closing "quote'),t}function ji(n,e){let t="",s=n[e+1];for(;(s===" "||s==="	"||s===`
`||s==="\r")&&!(s==="\r"&&n[e+2]!==`
`);)s===`
`&&(t+=`
`),e+=1,s=n[e+1];return t||(t=" "),{fold:t,offset:e}}const Mi={0:"\0",a:"\x07",b:"\b",e:"\x1B",f:"\f",n:`
`,r:"\r",t:"	",v:"\v",N:"",_:" ",L:"\u2028",P:"\u2029"," ":" ",'"':'"',"/":"/","\\":"\\","	":"	"};function Li(n,e,t,s){const i=n.substr(e,t),l=i.length===t&&/^[0-9a-fA-F]+$/.test(i)?parseInt(i,16):NaN;try{return String.fromCodePoint(l)}catch{const r=n.substr(e-2,t+2);return s(e-2,"BAD_DQ_ESCAPE",`Invalid escape sequence ${r}`),r}}function Dn(n,e,t,s){const{value:i,type:o,comment:l,range:r}=e.type==="block-scalar"?Hi(n,e,s):zi(e,n.options.strict,s),a=t?n.directives.tagName(t.source,d=>s(t,"TAG_RESOLVE_FAILED",d)):null;let c;n.options.stringKeys&&n.atKey?c=n.schema[T]:a?c=Ei(n.schema,i,a,t,s):e.type==="scalar"?c=Ti(n,i,e,s):c=n.schema[T];let u;try{const d=c.resolve(i,f=>s(t??e,"TAG_RESOLVE_FAILED",f),n.options);u=w(d)?d:new v(d)}catch(d){const f=d instanceof Error?d.message:String(d);s(t??e,"TAG_RESOLVE_FAILED",f),u=new v(i)}return u.range=r,u.source=i,o&&(u.type=o),a&&(u.tag=a),c.format&&(u.format=c.format),l&&(u.comment=l),u}function Ei(n,e,t,s,i){var r;if(t==="!")return n[T];const o=[];for(const a of n.tags)if(!a.collection&&a.tag===t)if(a.default&&a.test)o.push(a);else return a;for(const a of o)if((r=a.test)!=null&&r.test(e))return a;const l=n.knownTags[t];return l&&!l.collection?(n.tags.push(Object.assign({},l,{default:!1,test:void 0})),l):(i(s,"TAG_RESOLVE_FAILED",`Unresolved tag: ${t}`,t!=="tag:yaml.org,2002:str"),n[T])}function Ti({atKey:n,directives:e,schema:t},s,i,o){const l=t.tags.find(r=>{var a;return(r.default===!0||n&&r.default==="key")&&((a=r.test)==null?void 0:a.test(s))})||t[T];if(t.compat){const r=t.compat.find(a=>{var c;return a.default&&((c=a.test)==null?void 0:c.test(s))})??t[T];if(l.tag!==r.tag){const a=e.tagString(l.tag),c=e.tagString(r.tag),u=`Value may be parsed as either ${a} or ${c}`;o(i,"TAG_RESOLVE_FAILED",u,!0)}}return l}function Pi(n,e,t){if(e){t??(t=e.length);for(let s=t-1;s>=0;--s){let i=e[s];switch(i.type){case"space":case"comment":case"newline":n-=i.source.length;continue}for(i=e[++s];(i==null?void 0:i.type)==="space";)n+=i.source.length,i=e[++s];break}}return n}const Ui={composeNode:jn,composeEmptyNode:Xt};function jn(n,e,t,s){const i=n.atKey,{spaceBefore:o,comment:l,anchor:r,tag:a}=t;let c,u=!0;switch(e.type){case"alias":c=Qi(n,e,s),(r||a)&&s(e,"ALIAS_PROPS","An alias node must not specify any properties");break;case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":case"block-scalar":c=Dn(n,e,a,s),r&&(c.anchor=r.source.substring(1));break;case"block-map":case"block-seq":case"flow-collection":try{c=Fi(Ui,n,e,t,s),r&&(c.anchor=r.source.substring(1))}catch(d){const f=d instanceof Error?d.message:String(d);s(e,"RESOURCE_EXHAUSTION",f)}break;default:{const d=e.type==="error"?e.message:`Unsupported token (type: ${e.type})`;s(e,"UNEXPECTED_TOKEN",d),u=!1}}return c??(c=Xt(n,e.offset,void 0,null,t,s)),r&&c.anchor===""&&s(r,"BAD_ALIAS","Anchor cannot be an empty string"),i&&n.options.stringKeys&&(!w(c)||typeof c.value!="string"||c.tag&&c.tag!=="tag:yaml.org,2002:str")&&s(a??e,"NON_STRING_KEY","With stringKeys, all keys must be strings"),o&&(c.spaceBefore=!0),l&&(e.type==="scalar"&&e.source===""?c.comment=l:c.commentBefore=l),n.options.keepSourceTokens&&u&&(c.srcToken=e),c}function Xt(n,e,t,s,{spaceBefore:i,comment:o,anchor:l,tag:r,end:a},c){const u={type:"scalar",offset:Pi(e,t,s),indent:-1,source:""},d=Dn(n,u,r,c);return l&&(d.anchor=l.source.substring(1),d.anchor===""&&c(l,"BAD_ALIAS","Anchor cannot be an empty string")),i&&(d.spaceBefore=!0),o&&(d.comment=o,d.range[2]=a),d}function Qi({options:n},{offset:e,source:t,end:s},i){const o=new ft(t.substring(1));o.source===""&&i(e,"BAD_ALIAS","Alias cannot be an empty string"),o.source.endsWith(":")&&i(e+t.length-1,"BAD_ALIAS","Alias ending in : is ambiguous",!0);const l=e+t.length,r=Xe(s,l,n.strict,i);return o.range=[e,l,r.offset],r.comment&&(o.comment=r.comment),o}function $i(n,e,{offset:t,start:s,value:i,end:o},l){const r=Object.assign({_directives:e},n),a=new et(void 0,r),c={atKey:!1,atRoot:!0,directives:a.directives,options:a.options,schema:a.schema},u=Ge(s,{indicator:"doc-start",next:i??(o==null?void 0:o[0]),offset:t,onError:l,parentIndent:0,startOnNewline:!0});u.found&&(a.directives.docStart=!0,i&&(i.type==="block-map"||i.type==="block-seq")&&!u.hasNewline&&l(u.end,"MISSING_CHAR","Block collection cannot start on same line with directives-end marker")),a.contents=i?jn(c,i,u,l):Xt(c,u.end,s,null,u,l);const d=a.contents.range[2],f=Xe(o,d,!1,l);return f.comment&&(a.comment=f.comment),a.range=[t,d,f.offset],a}function Re(n){if(typeof n=="number")return[n,n+1];if(Array.isArray(n))return n.length===2?n:[n[0],n[1]];const{offset:e,source:t}=n;return[e,e+(typeof t=="string"?t.length:1)]}function Mn(n){var i;let e="",t=!1,s=!1;for(let o=0;o<n.length;++o){const l=n[o];switch(l[0]){case"#":e+=(e===""?"":s?`

`:`
`)+(l.substring(1)||" "),t=!0,s=!1;break;case"%":((i=n[o+1])==null?void 0:i[0])!=="#"&&(o+=1),t=!1;break;default:t||(s=!0),t=!1}}return{comment:e,afterEmptyLine:s}}class qi{constructor(e={}){this.doc=null,this.atDirectives=!1,this.prelude=[],this.errors=[],this.warnings=[],this.onError=(t,s,i,o)=>{const l=Re(t);o?this.warnings.push(new Yi(l,s,i)):this.errors.push(new Ye(l,s,i))},this.directives=new R({version:e.version||"1.2"}),this.options=e}decorate(e,t){const{comment:s,afterEmptyLine:i}=Mn(this.prelude);if(s){const o=e.contents;if(t)e.comment=e.comment?`${e.comment}
${s}`:s;else if(i||e.directives.docStart||!o)e.commentBefore=s;else if(Y(o)&&!o.flow&&o.items.length>0){let l=o.items[0];k(l)&&(l=l.key);const r=l.commentBefore;l.commentBefore=r?`${s}
${r}`:s}else{const l=o.commentBefore;o.commentBefore=l?`${s}
${l}`:s}}if(t){for(let o=0;o<this.errors.length;++o)e.errors.push(this.errors[o]);for(let o=0;o<this.warnings.length;++o)e.warnings.push(this.warnings[o])}else e.errors=this.errors,e.warnings=this.warnings;this.prelude=[],this.errors=[],this.warnings=[]}streamInfo(){return{comment:Mn(this.prelude).comment,directives:this.directives,errors:this.errors,warnings:this.warnings}}*compose(e,t=!1,s=-1){for(const i of e)yield*this.next(i);yield*this.end(t,s)}*next(e){switch(e.type){case"directive":this.directives.add(e.source,(t,s,i)=>{const o=Re(e);o[0]+=t,this.onError(o,"BAD_DIRECTIVE",s,i)}),this.prelude.push(e.source),this.atDirectives=!0;break;case"document":{const t=$i(this.options,this.directives,e,this.onError);this.atDirectives&&!t.directives.docStart&&this.onError(e,"MISSING_CHAR","Missing directives-end/doc-start indicator line"),this.decorate(t,!1),this.doc&&(yield this.doc),this.doc=t,this.atDirectives=!1;break}case"byte-order-mark":case"space":break;case"comment":case"newline":this.prelude.push(e.source);break;case"error":{const t=e.source?`${e.message}: ${JSON.stringify(e.source)}`:e.message,s=new Ye(Re(e),"UNEXPECTED_TOKEN",t);this.atDirectives||!this.doc?this.errors.push(s):this.doc.errors.push(s);break}case"doc-end":{if(!this.doc){const s="Unexpected doc-end without preceding document";this.errors.push(new Ye(Re(e),"UNEXPECTED_TOKEN",s));break}this.doc.directives.docEnd=!0;const t=Xe(e.end,e.offset+e.source.length,this.doc.options.strict,this.onError);if(this.decorate(this.doc,!0),t.comment){const s=this.doc.comment;this.doc.comment=s?`${s}
${t.comment}`:t.comment}this.doc.range[2]=t.offset;break}default:this.errors.push(new Ye(Re(e),"UNEXPECTED_TOKEN",`Unsupported token ${e.type}`))}}*end(e=!1,t=-1){if(this.doc)this.decorate(this.doc,!0),yield this.doc,this.doc=null;else if(e){const s=Object.assign({_directives:this.directives},this.options),i=new et(void 0,s);this.atDirectives&&this.onError(t,"MISSING_CHAR","Missing directives-end indicator line"),i.range=[0,t,t],this.decorate(i,!1),yield i}}}const Ln="\uFEFF",En="",Tn="",Rt="";function eo(n){switch(n){case Ln:return"byte-order-mark";case En:return"doc-mode";case Tn:return"flow-error-end";case Rt:return"scalar";case"---":return"doc-start";case"...":return"doc-end";case"":case`
`:case`\r
`:return"newline";case"-":return"seq-item-ind";case"?":return"explicit-key-ind";case":":return"map-value-ind";case"{":return"flow-map-start";case"}":return"flow-map-end";case"[":return"flow-seq-start";case"]":return"flow-seq-end";case",":return"comma"}switch(n[0]){case" ":case"	":return"space";case"#":return"comment";case"%":return"directive-line";case"*":return"alias";case"&":return"anchor";case"!":return"tag";case"'":return"single-quoted-scalar";case'"':return"double-quoted-scalar";case"|":case">":return"block-scalar-header"}return null}function j(n){switch(n){case void 0:case" ":case`
`:case"\r":case"	":return!0;default:return!1}}const Pn=new Set("0123456789ABCDEFabcdef"),to=new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()"),tt=new Set(",[]{}"),no=new Set(` ,[]{}
\r	`),Ft=n=>!n||no.has(n);class so{constructor(){this.atEnd=!1,this.blockScalarIndent=-1,this.blockScalarKeep=!1,this.buffer="",this.flowKey=!1,this.flowLevel=0,this.indentNext=0,this.indentValue=0,this.lineEndPos=null,this.next=null,this.pos=0}*lex(e,t=!1){if(e){if(typeof e!="string")throw TypeError("source is not a string");this.buffer=this.buffer?this.buffer+e:e,this.lineEndPos=null}this.atEnd=!t;let s=this.next??"stream";for(;s&&(t||this.hasChars(1));)s=yield*this.parseNext(s)}atLineEnd(){let e=this.pos,t=this.buffer[e];for(;t===" "||t==="	";)t=this.buffer[++e];return!t||t==="#"||t===`
`?!0:t==="\r"?this.buffer[e+1]===`
`:!1}charAt(e){return this.buffer[this.pos+e]}continueScalar(e){let t=this.buffer[e];if(this.indentNext>0){let s=0;for(;t===" ";)t=this.buffer[++s+e];if(t==="\r"){const i=this.buffer[s+e+1];if(i===`
`||!i&&!this.atEnd)return e+s+1}return t===`
`||s>=this.indentNext||!t&&!this.atEnd?e+s:-1}if(t==="-"||t==="."){const s=this.buffer.substr(e,3);if((s==="---"||s==="...")&&j(this.buffer[e+3]))return-1}return e}getLine(){let e=this.lineEndPos;return(typeof e!="number"||e!==-1&&e<this.pos)&&(e=this.buffer.indexOf(`
`,this.pos),this.lineEndPos=e),e===-1?this.atEnd?this.buffer.substring(this.pos):null:(this.buffer[e-1]==="\r"&&(e-=1),this.buffer.substring(this.pos,e))}hasChars(e){return this.pos+e<=this.buffer.length}setNext(e){return this.buffer=this.buffer.substring(this.pos),this.pos=0,this.lineEndPos=null,this.next=e,null}peek(e){return this.buffer.substr(this.pos,e)}*parseNext(e){switch(e){case"stream":return yield*this.parseStream();case"line-start":return yield*this.parseLineStart();case"block-start":return yield*this.parseBlockStart();case"doc":return yield*this.parseDocument();case"flow":return yield*this.parseFlowCollection();case"quoted-scalar":return yield*this.parseQuotedScalar();case"block-scalar":return yield*this.parseBlockScalar();case"plain-scalar":return yield*this.parsePlainScalar()}}*parseStream(){let e=this.getLine();if(e===null)return this.setNext("stream");if(e[0]===Ln&&(yield*this.pushCount(1),e=e.substring(1)),e[0]==="%"){let t=e.length,s=e.indexOf("#");for(;s!==-1;){const o=e[s-1];if(o===" "||o==="	"){t=s-1;break}else s=e.indexOf("#",s+1)}for(;;){const o=e[t-1];if(o===" "||o==="	")t-=1;else break}const i=(yield*this.pushCount(t))+(yield*this.pushSpaces(!0));return yield*this.pushCount(e.length-i),this.pushNewline(),"stream"}if(this.atLineEnd()){const t=yield*this.pushSpaces(!0);return yield*this.pushCount(e.length-t),yield*this.pushNewline(),"stream"}return yield En,yield*this.parseLineStart()}*parseLineStart(){const e=this.charAt(0);if(!e&&!this.atEnd)return this.setNext("line-start");if(e==="-"||e==="."){if(!this.atEnd&&!this.hasChars(4))return this.setNext("line-start");const t=this.peek(3);if((t==="---"||t==="...")&&j(this.charAt(3)))return yield*this.pushCount(3),this.indentValue=0,this.indentNext=0,t==="---"?"doc":"stream"}return this.indentValue=yield*this.pushSpaces(!1),this.indentNext>this.indentValue&&!j(this.charAt(1))&&(this.indentNext=this.indentValue),yield*this.parseBlockStart()}*parseBlockStart(){const[e,t]=this.peek(2);if(!t&&!this.atEnd)return this.setNext("block-start");if((e==="-"||e==="?"||e===":")&&j(t)){const s=(yield*this.pushCount(1))+(yield*this.pushSpaces(!0));return this.indentNext=this.indentValue+1,this.indentValue+=s,"block-start"}return"doc"}*parseDocument(){yield*this.pushSpaces(!0);const e=this.getLine();if(e===null)return this.setNext("doc");let t=yield*this.pushIndicators();switch(e[t]){case"#":yield*this.pushCount(e.length-t);case void 0:return yield*this.pushNewline(),yield*this.parseLineStart();case"{":case"[":return yield*this.pushCount(1),this.flowKey=!1,this.flowLevel=1,"flow";case"}":case"]":return yield*this.pushCount(1),"doc";case"*":return yield*this.pushUntil(Ft),"doc";case'"':case"'":return yield*this.parseQuotedScalar();case"|":case">":return t+=yield*this.parseBlockScalarHeader(),t+=yield*this.pushSpaces(!0),yield*this.pushCount(e.length-t),yield*this.pushNewline(),yield*this.parseBlockScalar();default:return yield*this.parsePlainScalar()}}*parseFlowCollection(){let e,t,s=-1;do e=yield*this.pushNewline(),e>0?(t=yield*this.pushSpaces(!1),this.indentValue=s=t):t=0,t+=yield*this.pushSpaces(!0);while(e+t>0);const i=this.getLine();if(i===null)return this.setNext("flow");if((s!==-1&&s<this.indentNext&&i[0]!=="#"||s===0&&(i.startsWith("---")||i.startsWith("..."))&&j(i[3]))&&!(s===this.indentNext-1&&this.flowLevel===1&&(i[0]==="]"||i[0]==="}")))return this.flowLevel=0,yield Tn,yield*this.parseLineStart();let o=0;for(;i[o]===",";)o+=yield*this.pushCount(1),o+=yield*this.pushSpaces(!0),this.flowKey=!1;switch(o+=yield*this.pushIndicators(),i[o]){case void 0:return"flow";case"#":return yield*this.pushCount(i.length-o),"flow";case"{":case"[":return yield*this.pushCount(1),this.flowKey=!1,this.flowLevel+=1,"flow";case"}":case"]":return yield*this.pushCount(1),this.flowKey=!0,this.flowLevel-=1,this.flowLevel?"flow":"doc";case"*":return yield*this.pushUntil(Ft),"flow";case'"':case"'":return this.flowKey=!0,yield*this.parseQuotedScalar();case":":{const l=this.charAt(1);if(this.flowKey||j(l)||l===",")return this.flowKey=!1,yield*this.pushCount(1),yield*this.pushSpaces(!0),"flow"}default:return this.flowKey=!1,yield*this.parsePlainScalar()}}*parseQuotedScalar(){const e=this.charAt(0);let t=this.buffer.indexOf(e,this.pos+1);if(e==="'")for(;t!==-1&&this.buffer[t+1]==="'";)t=this.buffer.indexOf("'",t+2);else for(;t!==-1;){let o=0;for(;this.buffer[t-1-o]==="\\";)o+=1;if(o%2===0)break;t=this.buffer.indexOf('"',t+1)}const s=this.buffer.substring(0,t);let i=s.indexOf(`
`,this.pos);if(i!==-1){for(;i!==-1;){const o=this.continueScalar(i+1);if(o===-1)break;i=s.indexOf(`
`,o)}i!==-1&&(t=i-(s[i-1]==="\r"?2:1))}if(t===-1){if(!this.atEnd)return this.setNext("quoted-scalar");t=this.buffer.length}return yield*this.pushToIndex(t+1,!1),this.flowLevel?"flow":"doc"}*parseBlockScalarHeader(){this.blockScalarIndent=-1,this.blockScalarKeep=!1;let e=this.pos;for(;;){const t=this.buffer[++e];if(t==="+")this.blockScalarKeep=!0;else if(t>"0"&&t<="9")this.blockScalarIndent=Number(t)-1;else if(t!=="-")break}return yield*this.pushUntil(t=>j(t)||t==="#")}*parseBlockScalar(){let e=this.pos-1,t=0,s;e:for(let o=this.pos;s=this.buffer[o];++o)switch(s){case" ":t+=1;break;case`
`:e=o,t=0;break;case"\r":{const l=this.buffer[o+1];if(!l&&!this.atEnd)return this.setNext("block-scalar");if(l===`
`)break}default:break e}if(!s&&!this.atEnd)return this.setNext("block-scalar");if(t>=this.indentNext){this.blockScalarIndent===-1?this.indentNext=t:this.indentNext=this.blockScalarIndent+(this.indentNext===0?1:this.indentNext);do{const o=this.continueScalar(e+1);if(o===-1)break;e=this.buffer.indexOf(`
`,o)}while(e!==-1);if(e===-1){if(!this.atEnd)return this.setNext("block-scalar");e=this.buffer.length}}let i=e+1;for(s=this.buffer[i];s===" ";)s=this.buffer[++i];if(s==="	"){for(;s==="	"||s===" "||s==="\r"||s===`
`;)s=this.buffer[++i];e=i-1}else if(!this.blockScalarKeep)do{let o=e-1,l=this.buffer[o];l==="\r"&&(l=this.buffer[--o]);const r=o;for(;l===" ";)l=this.buffer[--o];if(l===`
`&&o>=this.pos&&o+1+t>r)e=o;else break}while(!0);return yield Rt,yield*this.pushToIndex(e+1,!0),yield*this.parseLineStart()}*parsePlainScalar(){const e=this.flowLevel>0;let t=this.pos-1,s=this.pos-1,i;for(;i=this.buffer[++s];)if(i===":"){const o=this.buffer[s+1];if(j(o)||e&&tt.has(o))break;t=s}else if(j(i)){let o=this.buffer[s+1];if(i==="\r"&&(o===`
`?(s+=1,i=`
`,o=this.buffer[s+1]):t=s),o==="#"||e&&tt.has(o))break;if(i===`
`){const l=this.continueScalar(s+1);if(l===-1)break;s=Math.max(s,l-2)}}else{if(e&&tt.has(i))break;t=s}return!i&&!this.atEnd?this.setNext("plain-scalar"):(yield Rt,yield*this.pushToIndex(t+1,!0),e?"flow":"doc")}*pushCount(e){return e>0?(yield this.buffer.substr(this.pos,e),this.pos+=e,e):0}*pushToIndex(e,t){const s=this.buffer.slice(this.pos,e);return s?(yield s,this.pos+=s.length,s.length):(t&&(yield""),0)}*pushIndicators(){let e=0;e:for(;;){switch(this.charAt(0)){case"!":e+=yield*this.pushTag(),e+=yield*this.pushSpaces(!0);continue e;case"&":e+=yield*this.pushUntil(Ft),e+=yield*this.pushSpaces(!0);continue e;case"-":case"?":case":":{const t=this.flowLevel>0,s=this.charAt(1);if(j(s)||t&&tt.has(s)){t?this.flowKey&&(this.flowKey=!1):this.indentNext=this.indentValue+1,e+=yield*this.pushCount(1),e+=yield*this.pushSpaces(!0);continue e}}}break e}return e}*pushTag(){if(this.charAt(1)==="<"){let e=this.pos+2,t=this.buffer[e];for(;!j(t)&&t!==">";)t=this.buffer[++e];return yield*this.pushToIndex(t===">"?e+1:e,!1)}else{let e=this.pos+1,t=this.buffer[e];for(;t;)if(to.has(t))t=this.buffer[++e];else if(t==="%"&&Pn.has(this.buffer[e+1])&&Pn.has(this.buffer[e+2]))t=this.buffer[e+=3];else break;return yield*this.pushToIndex(e,!1)}}*pushNewline(){const e=this.buffer[this.pos];return e===`
`?yield*this.pushCount(1):e==="\r"&&this.charAt(1)===`
`?yield*this.pushCount(2):0}*pushSpaces(e){let t=this.pos-1,s;do s=this.buffer[++t];while(s===" "||e&&s==="	");const i=t-this.pos;return i>0&&(yield this.buffer.substr(this.pos,i),this.pos=t),i}*pushUntil(e){let t=this.pos,s=this.buffer[t];for(;!e(s);)s=this.buffer[++t];return yield*this.pushToIndex(t,!1)}}class io{constructor(){this.lineStarts=[],this.addNewLine=e=>this.lineStarts.push(e),this.linePos=e=>{let t=0,s=this.lineStarts.length;for(;t<s;){const o=t+s>>1;this.lineStarts[o]<e?t=o+1:s=o}if(this.lineStarts[t]===e)return{line:t+1,col:1};if(t===0)return{line:0,col:e};const i=this.lineStarts[t-1];return{line:t,col:e-i+1}}}}function te(n,e){for(let t=0;t<n.length;++t)if(n[t].type===e)return!0;return!1}function Un(n){for(let e=0;e<n.length;++e)switch(n[e].type){case"space":case"comment":case"newline":break;default:return e}return-1}function Qn(n){switch(n==null?void 0:n.type){case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":case"flow-collection":return!0;default:return!1}}function nt(n){switch(n.type){case"document":return n.start;case"block-map":{const e=n.items[n.items.length-1];return e.sep??e.start}case"block-seq":return n.items[n.items.length-1].start;default:return[]}}function Ae(n){var t;if(n.length===0)return[];let e=n.length;e:for(;--e>=0;)switch(n[e].type){case"doc-start":case"explicit-key-ind":case"map-value-ind":case"seq-item-ind":case"newline":break e}for(;((t=n[++e])==null?void 0:t.type)==="space";);return n.splice(e,n.length)}function st(n,e){if(e.length<1e5)Array.prototype.push.apply(n,e);else for(let t=0;t<e.length;++t)n.push(e[t])}function $n(n){if(n.start.type==="flow-seq-start")for(const e of n.items)e.sep&&!e.value&&!te(e.start,"explicit-key-ind")&&!te(e.sep,"map-value-ind")&&(e.key&&(e.value=e.key),delete e.key,Qn(e.value)?e.value.end?st(e.value.end,e.sep):e.value.end=e.sep:st(e.start,e.sep),delete e.sep)}class oo{constructor(e){this.atNewLine=!0,this.atScalar=!1,this.indent=0,this.offset=0,this.onKeyLine=!1,this.stack=[],this.source="",this.type="",this.lexer=new so,this.onNewLine=e}*parse(e,t=!1){this.onNewLine&&this.offset===0&&this.onNewLine(0);for(const s of this.lexer.lex(e,t))yield*this.next(s);t||(yield*this.end())}*next(e){if(this.source=e,this.atScalar){this.atScalar=!1,yield*this.step(),this.offset+=e.length;return}const t=eo(e);if(t)if(t==="scalar")this.atNewLine=!1,this.atScalar=!0,this.type="scalar";else{switch(this.type=t,yield*this.step(),t){case"newline":this.atNewLine=!0,this.indent=0,this.onNewLine&&this.onNewLine(this.offset+e.length);break;case"space":this.atNewLine&&e[0]===" "&&(this.indent+=e.length);break;case"explicit-key-ind":case"map-value-ind":case"seq-item-ind":this.atNewLine&&(this.indent+=e.length);break;case"doc-mode":case"flow-error-end":return;default:this.atNewLine=!1}this.offset+=e.length}else{const s=`Not a YAML token: ${e}`;yield*this.pop({type:"error",offset:this.offset,message:s,source:e}),this.offset+=e.length}}*end(){for(;this.stack.length>0;)yield*this.pop()}get sourceToken(){return{type:this.type,offset:this.offset,indent:this.indent,source:this.source}}*step(){const e=this.peek(1);if(this.type==="doc-end"&&(e==null?void 0:e.type)!=="doc-end"){for(;this.stack.length>0;)yield*this.pop();this.stack.push({type:"doc-end",offset:this.offset,source:this.source});return}if(!e)return yield*this.stream();switch(e.type){case"document":return yield*this.document(e);case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":return yield*this.scalar(e);case"block-scalar":return yield*this.blockScalar(e);case"block-map":return yield*this.blockMap(e);case"block-seq":return yield*this.blockSequence(e);case"flow-collection":return yield*this.flowCollection(e);case"doc-end":return yield*this.documentEnd(e)}yield*this.pop()}peek(e){return this.stack[this.stack.length-e]}*pop(e){const t=e??this.stack.pop();if(!t)yield{type:"error",offset:this.offset,source:"",message:"Tried to pop an empty stack"};else if(this.stack.length===0)yield t;else{const s=this.peek(1);switch(t.type==="block-scalar"?t.indent="indent"in s?s.indent:0:t.type==="flow-collection"&&s.type==="document"&&(t.indent=0),t.type==="flow-collection"&&$n(t),s.type){case"document":s.value=t;break;case"block-scalar":s.props.push(t);break;case"block-map":{const i=s.items[s.items.length-1];if(i.value){s.items.push({start:[],key:t,sep:[]}),this.onKeyLine=!0;return}else if(i.sep)i.value=t;else{Object.assign(i,{key:t,sep:[]}),this.onKeyLine=!i.explicitKey;return}break}case"block-seq":{const i=s.items[s.items.length-1];i.value?s.items.push({start:[],value:t}):i.value=t;break}case"flow-collection":{const i=s.items[s.items.length-1];!i||i.value?s.items.push({start:[],key:t,sep:[]}):i.sep?i.value=t:Object.assign(i,{key:t,sep:[]});return}default:yield*this.pop(),yield*this.pop(t)}if((s.type==="document"||s.type==="block-map"||s.type==="block-seq")&&(t.type==="block-map"||t.type==="block-seq")){const i=t.items[t.items.length-1];i&&!i.sep&&!i.value&&i.start.length>0&&Un(i.start)===-1&&(t.indent===0||i.start.every(o=>o.type!=="comment"||o.indent<t.indent))&&(s.type==="document"?s.end=i.start:s.items.push({start:i.start}),t.items.splice(-1,1))}}}*stream(){switch(this.type){case"directive-line":yield{type:"directive",offset:this.offset,source:this.source};return;case"byte-order-mark":case"space":case"comment":case"newline":yield this.sourceToken;return;case"doc-mode":case"doc-start":{const e={type:"document",offset:this.offset,start:[]};this.type==="doc-start"&&e.start.push(this.sourceToken),this.stack.push(e);return}}yield{type:"error",offset:this.offset,message:`Unexpected ${this.type} token in YAML stream`,source:this.source}}*document(e){if(e.value)return yield*this.lineEnd(e);switch(this.type){case"doc-start":{Un(e.start)!==-1?(yield*this.pop(),yield*this.step()):e.start.push(this.sourceToken);return}case"anchor":case"tag":case"space":case"comment":case"newline":e.start.push(this.sourceToken);return}const t=this.startBlockValue(e);t?this.stack.push(t):yield{type:"error",offset:this.offset,message:`Unexpected ${this.type} token in YAML document`,source:this.source}}*scalar(e){if(this.type==="map-value-ind"){const t=nt(this.peek(2)),s=Ae(t);let i;e.end?(i=e.end,i.push(this.sourceToken),delete e.end):i=[this.sourceToken];const o={type:"block-map",offset:e.offset,indent:e.indent,items:[{start:s,key:e,sep:i}]};this.onKeyLine=!0,this.stack[this.stack.length-1]=o}else yield*this.lineEnd(e)}*blockScalar(e){switch(this.type){case"space":case"comment":case"newline":e.props.push(this.sourceToken);return;case"scalar":if(e.source=this.source,this.atNewLine=!0,this.indent=0,this.onNewLine){let t=this.source.indexOf(`
`)+1;for(;t!==0;)this.onNewLine(this.offset+t),t=this.source.indexOf(`
`,t)+1}yield*this.pop();break;default:yield*this.pop(),yield*this.step()}}*blockMap(e){var s;const t=e.items[e.items.length-1];switch(this.type){case"newline":if(this.onKeyLine=!1,t.value){const i="end"in t.value?t.value.end:void 0,o=Array.isArray(i)?i[i.length-1]:void 0;(o==null?void 0:o.type)==="comment"?i==null||i.push(this.sourceToken):e.items.push({start:[this.sourceToken]})}else t.sep?t.sep.push(this.sourceToken):t.start.push(this.sourceToken);return;case"space":case"comment":if(t.value)e.items.push({start:[this.sourceToken]});else if(t.sep)t.sep.push(this.sourceToken);else{if(this.atIndentedComment(t.start,e.indent)){const i=e.items[e.items.length-2],o=(s=i==null?void 0:i.value)==null?void 0:s.end;if(Array.isArray(o)){st(o,t.start),o.push(this.sourceToken),e.items.pop();return}}t.start.push(this.sourceToken)}return}if(this.indent>=e.indent){const i=!this.onKeyLine&&this.indent===e.indent,o=i&&(t.sep||t.explicitKey)&&this.type!=="seq-item-ind";let l=[];if(o&&t.sep&&!t.value){const r=[];for(let a=0;a<t.sep.length;++a){const c=t.sep[a];switch(c.type){case"newline":r.push(a);break;case"space":break;case"comment":c.indent>e.indent&&(r.length=0);break;default:r.length=0}}r.length>=2&&(l=t.sep.splice(r[1]))}switch(this.type){case"anchor":case"tag":o||t.value?(l.push(this.sourceToken),e.items.push({start:l}),this.onKeyLine=!0):t.sep?t.sep.push(this.sourceToken):t.start.push(this.sourceToken);return;case"explicit-key-ind":!t.sep&&!t.explicitKey?(t.start.push(this.sourceToken),t.explicitKey=!0):o||t.value?(l.push(this.sourceToken),e.items.push({start:l,explicitKey:!0})):this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:[this.sourceToken],explicitKey:!0}]}),this.onKeyLine=!0;return;case"map-value-ind":if(t.explicitKey)if(t.sep)if(t.value)e.items.push({start:[],key:null,sep:[this.sourceToken]});else if(te(t.sep,"map-value-ind"))this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:l,key:null,sep:[this.sourceToken]}]});else if(Qn(t.key)&&!te(t.sep,"newline")){const r=Ae(t.start),a=t.key,c=t.sep;c.push(this.sourceToken),delete t.key,delete t.sep,this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:r,key:a,sep:c}]})}else l.length>0?t.sep=t.sep.concat(l,this.sourceToken):t.sep.push(this.sourceToken);else if(te(t.start,"newline"))Object.assign(t,{key:null,sep:[this.sourceToken]});else{const r=Ae(t.start);this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:r,key:null,sep:[this.sourceToken]}]})}else t.sep?t.value||o?e.items.push({start:l,key:null,sep:[this.sourceToken]}):te(t.sep,"map-value-ind")?this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:[],key:null,sep:[this.sourceToken]}]}):t.sep.push(this.sourceToken):Object.assign(t,{key:null,sep:[this.sourceToken]});this.onKeyLine=!0;return;case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":{const r=this.flowScalar(this.type);o||t.value?(e.items.push({start:l,key:r,sep:[]}),this.onKeyLine=!0):t.sep?this.stack.push(r):(Object.assign(t,{key:r,sep:[]}),this.onKeyLine=!0);return}default:{const r=this.startBlockValue(e);if(r){if(r.type==="block-seq"){if(!t.explicitKey&&t.sep&&!te(t.sep,"newline")){yield*this.pop({type:"error",offset:this.offset,message:"Unexpected block-seq-ind on same line with key",source:this.source});return}}else i&&e.items.push({start:l});this.stack.push(r);return}}}}yield*this.pop(),yield*this.step()}*blockSequence(e){var s;const t=e.items[e.items.length-1];switch(this.type){case"newline":if(t.value){const i="end"in t.value?t.value.end:void 0,o=Array.isArray(i)?i[i.length-1]:void 0;(o==null?void 0:o.type)==="comment"?i==null||i.push(this.sourceToken):e.items.push({start:[this.sourceToken]})}else t.start.push(this.sourceToken);return;case"space":case"comment":if(t.value)e.items.push({start:[this.sourceToken]});else{if(this.atIndentedComment(t.start,e.indent)){const i=e.items[e.items.length-2],o=(s=i==null?void 0:i.value)==null?void 0:s.end;if(Array.isArray(o)){st(o,t.start),o.push(this.sourceToken),e.items.pop();return}}t.start.push(this.sourceToken)}return;case"anchor":case"tag":if(t.value||this.indent<=e.indent)break;t.start.push(this.sourceToken);return;case"seq-item-ind":if(this.indent!==e.indent)break;t.value||te(t.start,"seq-item-ind")?e.items.push({start:[this.sourceToken]}):t.start.push(this.sourceToken);return}if(this.indent>e.indent){const i=this.startBlockValue(e);if(i){this.stack.push(i);return}}yield*this.pop(),yield*this.step()}*flowCollection(e){const t=e.items[e.items.length-1];if(this.type==="flow-error-end"){let s;do yield*this.pop(),s=this.peek(1);while((s==null?void 0:s.type)==="flow-collection")}else if(e.end.length===0){switch(this.type){case"comma":case"explicit-key-ind":!t||t.sep?e.items.push({start:[this.sourceToken]}):t.start.push(this.sourceToken);return;case"map-value-ind":!t||t.value?e.items.push({start:[],key:null,sep:[this.sourceToken]}):t.sep?t.sep.push(this.sourceToken):Object.assign(t,{key:null,sep:[this.sourceToken]});return;case"space":case"comment":case"newline":case"anchor":case"tag":!t||t.value?e.items.push({start:[this.sourceToken]}):t.sep?t.sep.push(this.sourceToken):t.start.push(this.sourceToken);return;case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":{const i=this.flowScalar(this.type);!t||t.value?e.items.push({start:[],key:i,sep:[]}):t.sep?this.stack.push(i):Object.assign(t,{key:i,sep:[]});return}case"flow-map-end":case"flow-seq-end":e.end.push(this.sourceToken);return}const s=this.startBlockValue(e);s?this.stack.push(s):(yield*this.pop(),yield*this.step())}else{const s=this.peek(2);if(s.type==="block-map"&&(this.type==="map-value-ind"&&s.indent===e.indent||this.type==="newline"&&!s.items[s.items.length-1].sep))yield*this.pop(),yield*this.step();else if(this.type==="map-value-ind"&&s.type!=="flow-collection"){const i=nt(s),o=Ae(i);$n(e);const l=e.end.splice(1,e.end.length);l.push(this.sourceToken);const r={type:"block-map",offset:e.offset,indent:e.indent,items:[{start:o,key:e,sep:l}]};this.onKeyLine=!0,this.stack[this.stack.length-1]=r}else yield*this.lineEnd(e)}}flowScalar(e){if(this.onNewLine){let t=this.source.indexOf(`
`)+1;for(;t!==0;)this.onNewLine(this.offset+t),t=this.source.indexOf(`
`,t)+1}return{type:e,offset:this.offset,indent:this.indent,source:this.source}}startBlockValue(e){switch(this.type){case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":return this.flowScalar(this.type);case"block-scalar-header":return{type:"block-scalar",offset:this.offset,indent:this.indent,props:[this.sourceToken],source:""};case"flow-map-start":case"flow-seq-start":return{type:"flow-collection",offset:this.offset,indent:this.indent,start:this.sourceToken,items:[],end:[]};case"seq-item-ind":return{type:"block-seq",offset:this.offset,indent:this.indent,items:[{start:[this.sourceToken]}]};case"explicit-key-ind":{this.onKeyLine=!0;const t=nt(e),s=Ae(t);return s.push(this.sourceToken),{type:"block-map",offset:this.offset,indent:this.indent,items:[{start:s,explicitKey:!0}]}}case"map-value-ind":{this.onKeyLine=!0;const t=nt(e),s=Ae(t);return{type:"block-map",offset:this.offset,indent:this.indent,items:[{start:s,key:null,sep:[this.sourceToken]}]}}}return null}atIndentedComment(e,t){return this.type!=="comment"||this.indent<=t?!1:e.every(s=>s.type==="newline"||s.type==="space")}*documentEnd(e){this.type!=="doc-mode"&&(e.end?e.end.push(this.sourceToken):e.end=[this.sourceToken],this.type==="newline"&&(yield*this.pop()))}*lineEnd(e){switch(this.type){case"comma":case"doc-start":case"doc-end":case"flow-seq-end":case"flow-map-end":case"map-value-ind":yield*this.pop(),yield*this.step();break;case"newline":this.onKeyLine=!1;case"space":case"comment":default:e.end?e.end.push(this.sourceToken):e.end=[this.sourceToken],this.type==="newline"&&(yield*this.pop())}}}function lo(n){const e=n.prettyErrors!==!1;return{lineCounter:n.lineCounter||e&&new io||null,prettyErrors:e}}function ro(n,e={}){const{lineCounter:t,prettyErrors:s}=lo(e),i=new oo(t==null?void 0:t.addNewLine),o=new qi(e);let l=null;for(const r of o.compose(i.parse(n),!0,n.length))if(!l)l=r;else if(l.options.logLevel!=="silent"){l.errors.push(new Ye(r.range.slice(0,2),"MULTIPLE_DOCS","Source contains multiple documents; please use YAML.parseAllDocuments()"));break}return s&&t&&(l.errors.forEach(Jn(n,t)),l.warnings.forEach(Jn(n,t))),l}function ao(n,e,t){let s;const i=ro(n,t);if(!i)return null;if(i.warnings.forEach(o=>mn(i.options.logLevel,o)),i.errors.length>0){if(i.options.logLevel!=="silent")throw i.errors[0];i.errors=[]}return i.toJS(Object.assign({reviver:s},t))}class B extends Error{constructor(e){super(e),this.name="ProfileError"}}function Fe(n){return typeof n=="object"&&n!==null&&!Array.isArray(n)}function M(n,e,t){const s=n[e];if(typeof s!="string"||s.trim()==="")throw new B(`${t}: campo "${e}" deve ser string nao vazia`);return s}function co(n){if(!Array.isArray(n))throw new B('profile: "inputs" deve ser uma lista');return n.map((e,t)=>{const s=`inputs[${t}]`;if(!Fe(e))throw new B(`${s}: entrada invalida`);const i=M(e,"type",s);if(i!=="number"&&i!=="select")throw new B(`${s}: type deve ser "number" ou "select"`);const o=e.required;if(o!==void 0&&typeof o!="boolean")throw new B(`${s}: "required" deve ser boolean`);const l=e.default;if(l!==void 0&&typeof l!="string")throw new B(`${s}: "default" deve ser string`);const r={id:M(e,"id",s),label:M(e,"label",s),type:i,required:o??!0};l!==void 0&&(r.default=l);const a=uo(e.options,s);if(a&&(r.options=a),i==="select"&&!a)throw new B(`${s}: input "select" exige "options"`);return r})}function uo(n,e){if(n==null)return null;if(!Array.isArray(n)||n.length===0)throw new B(`${e}: "options" deve ser uma lista nao vazia`);return n.map((t,s)=>{if(typeof t=="string")return{value:t,label:t};if(!Fe(t))throw new B(`${e}.options[${s}]: entrada invalida`);const i=t.value;if(typeof i!="string")throw new B(`${e}.options[${s}]: "value" deve ser string`);return{value:i,label:M(t,"label",`${e}.options[${s}]`)}})}function go(n){if(!Array.isArray(n))throw new B('profile: "fields" deve ser uma lista');return n.map((e,t)=>{const s=`fields[${t}]`;if(!Fe(e))throw new B(`${s}: entrada invalida`);const i=e.modifier;if(i!=null&&typeof i!="string")throw new B(`${s}: "modifier" deve ser string ou null`);const o=e.compare_individually;if(o!==void 0&&typeof o!="boolean")throw new B(`${s}: "compare_individually" deve ser boolean`);const l=e.success_rule;if(l!=null&&typeof l!="string")throw new B(`${s}: "success_rule" deve ser string ou null`);const r=e.zero_dice_fallback;if(r!=null&&typeof r!="string")throw new B(`${s}: "zero_dice_fallback" deve ser string ou null`);const a=e.slot;if(a!=null&&(!Number.isInteger(a)||a<1))throw new B(`${s}: "slot" deve ser um inteiro positivo (ex: 1, 2, 3)`);const c=e.theme;if(c!=null&&typeof c!="string")throw new B(`${s}: "theme" deve ser string ou null`);return{id:M(e,"id",s),dice:M(e,"dice",s),modifier:i??null,compareIndividually:o??!1,successRule:l??null,zeroDiceFallback:r??null,slot:a??null,theme:c??null}})}function fo(n){if(!Array.isArray(n)||n.length===0)throw new B('profile: "outcome_rules" deve ser uma lista nao vazia');return n.map((e,t)=>{const s=`outcome_rules[${t}]`;if(!Fe(e))throw new B(`${s}: entrada invalida`);const i=M(e,"condition",s),o=M(e,"result",s);try{Vs(i.replace(it,"0"))}catch(l){throw new B(`${s}: condition invalida — ${l instanceof Error?l.message:String(l)}`)}return{condition:i,result:o}})}function Ht(n){let e;try{e=ao(n)}catch(o){throw new B(`YAML invalido: ${o instanceof Error?o.message:String(o)}`)}if(!Fe(e))throw new B("profile: documento YAML deve ser um objeto");const t=M(e,"roll_type","profile");if(t!=="simple"&&t!=="comparison"&&t!=="multi"&&t!=="overlay")throw new B('profile: "roll_type" deve ser "simple", "comparison", "multi" ou "overlay"');const s=e.mode_favors_low;if(s!==void 0&&typeof s!="boolean")throw new B('profile: "mode_favors_low" deve ser boolean');const i={system:M(e,"system","profile"),label:M(e,"label","profile"),rollType:t,inputs:co(e.inputs),fields:go(e.fields),outcomeRules:fo(e.outcome_rules)};if(s===!0&&(i.modeFavorsLow=!0),i.rollType==="comparison"&&i.fields.length!==2)throw new B(`profile "${i.system}": roll_type "comparison" exige exatamente 2 field(s)`);if(i.rollType==="simple"&&i.fields.length!==1)throw new B(`profile "${i.system}": roll_type "simple" exige exatamente 1 field(s)`);if(i.rollType==="multi"&&i.fields.length<2)throw new B(`profile "${i.system}": roll_type "multi" exige pelo menos 2 fields`);if(i.rollType==="overlay"&&i.fields.length!==0)throw new B(`profile "${i.system}": roll_type "overlay" nao aceita fields (a rolagem vem de fora)`);return i}const mo=/^[a-z0-9][a-z0-9_-]*$/i;async function qn(n){if(mo.test(n.trim())){const e=n.trim().toLowerCase();let t;try{({readFile:t}=await Promise.resolve().then(()=>Jo))}catch{throw new B(`carregamento por id ("${e}") so e suportado em Node — passe o conteudo YAML`)}const s=new URL(Object.assign({"../profiles/d100.yaml":Ys,"../profiles/d20.yaml":_s,"../profiles/fate.yaml":Xs,"../profiles/firelights.yaml":Rs,"../profiles/fitd.yaml":Fs,"../profiles/fractal.yaml":Hs,"../profiles/infaernum.yaml":Os,"../profiles/infaernum_ideias.yaml":Js,"../profiles/infaernum_sim_ou_nao.yaml":zs,"../profiles/ironsworn.yaml":xs,"../profiles/pbta.yaml":Ks,"../profiles/pbta2d10.yaml":Ds,"../profiles/pool_d6.yaml":js,"../profiles/roll_under.yaml":Ms,"../profiles/trophy_dark.yaml":Ls,"../profiles/trophy_gold.yaml":Es,"../profiles/wod5.yaml":Ts,"../profiles/yze.yaml":Ps,"../profiles/yze_alien.yaml":Us,"../profiles/yze_fbl.yaml":Qs,"../profiles/yze_wdu.yaml":$s})[`../profiles/${e}.yaml`],P&&P.tagName.toUpperCase()==="SCRIPT"&&P.src||new URL("rolai-headless.js",document.baseURI).href);let i;try{i=await t(s,"utf8")}catch{throw new B(`profile nao encontrado: "${e}"`)}return Ht(i)}return Ht(n)}const it=/\{input\.([A-Za-z_][A-Za-z0-9_]*)\}/g;function Ot(n,e,t){return n.replace(it,(s,i)=>{const o=e[i];if(o===void 0)throw new B(`${t}: input ausente: "${i}"`);return String(o)})}function bo(n,e){let t=Ot(n.dice,e,`field "${n.id}"`).trim();const s=/^(-?\d+)d/i.exec(t);s&&Number(s[1])<=0&&n.zeroDiceFallback!==null&&(t=n.zeroDiceFallback);let i="",o=null;if(n.modifier!==null){const c=Ot(n.modifier,e,`field "${n.id}"`).trim(),u=Number(c);if(!Number.isInteger(u))throw new B(`field "${n.id}": modifier "${c}" nao e um numero inteiro`);n.successRule!==null&&u===0?i="":(o=u,i=u>=0?`+${u}`:`${u}`)}const l=rt(t+i),r=l.groups[0];if(l.groups.length!==1||!r||r.terms.length!==1)throw new B(`field "${n.id}": notacao deve ser um unico grupo de um unico termo`);const a={...r.dice};return o!==null&&(a.modifier=o,a.hasModifier=!0),{spec:a,notation:t+i}}function ho(n){const e={};for(const[t,s]of Object.entries(n))e[t]={rolls:s.rolls},s.total!==void 0&&(e[t].total=s.total),s.modifier!==void 0&&(e[t].modifier=s.modifier);return e}function Io(n,e){if(e.size===0)return!1;for(const t of n.matchAll(it))if(e.has(t[1]))return!0;return!1}function es(n,e,t={},s=new Set){const i=ho(e),o=[];for(const r of n){if(Io(r.condition,s))continue;const a=Ot(r.condition,t,`outcome_rule "${r.result}"`);let c;try{c=ks(a,i)}catch(u){throw new B(`condition "${r.condition}" falhou: ${u instanceof Error?u.message:String(u)}`)}c&&o.push(r.result)}const[l]=o;return l===void 0?{flags:o}:{outcome:l,flags:o}}function ts(n,e){const t=new Set;for(const s of n.inputs){const i=e[s.id];if(i===void 0){if(s.required===!1){t.add(s.id);continue}throw new B(`input obrigatorio ausente: "${s.id}"`)}if(s.type==="number"&&!Number.isFinite(Number(i)))throw new B(`input "${s.id}" deve ser numerico`);if(s.options&&!s.options.some(o=>o.value===String(i)))throw new B(`input "${s.id}": valor invalido "${String(i)}"`)}return t}async function ns(n,e,t={}){const s=typeof n=="string"?await qn(n):n;if(s.rollType==="overlay")throw new B(`profile "${s.system}": roll_type "overlay" nao rola por conta propria — use rollOverlay`);const i=ts(s,e),o=Pt(t),l={},r=[];for(const g of s.fields){const{spec:h,notation:m}=bo(g,e),b=at(h,o);g.successRule!==null?b.total=b.rolls.filter(I=>en(I,g.successRule)).length+(b.modifier??0):!g.compareIndividually&&b.total===void 0&&(b.total=b.rolls.reduce((I,p)=>I+p,0)+(b.modifier??0)),g.slot&&(b.slot=g.slot),g.theme&&(b.theme=g.theme),l[g.id]=b,r.push(m)}const a=s.rollType==="comparison"?`{${r[0]}} vs {${r[1]}}`:s.rollType==="multi"?r.map(g=>`{${g}}`).join(" + "):r[0],{outcome:c,flags:u}=es(s.outcomeRules,l,e,i),d={notation:a,groups:l,profile:s.system,timestamp:t.timestamp??new Date().toISOString()};c!==void 0&&(d.outcome=c),u.length>0&&(d.outcome_flags=u);const f=ss(s,e,i);return f.length>0&&(d.tested=f),d}function po(n,e,t){const s=e.mode;if(s!=="adv"&&s!=="dis")return n;let i;try{i=rt(n)}catch{return n}if(i.groups.length!==1||i.groups[0].terms.length!==1)return n;const o=t.modeFavorsLow?s==="adv"?"dis":"adv":s;return`${n}${o}`}function ss(n,e,t){const s=new Set;for(const o of n.outcomeRules)for(const l of o.condition.matchAll(it))s.add(l[1]);const i=[];for(const o of n.inputs){if(!s.has(o.id)||t.has(o.id))continue;const l=e[o.id];l!==void 0&&i.push({label:o.label,value:l})}return i}async function yo(n,e,t,s={}){const i=typeof n=="string"?await qn(n):n;if(i.rollType!=="overlay")throw new B(`profile "${i.system}": rollOverlay exige roll_type "overlay"`);const o=ts(i,t),l=Qt(po(e,t,i),s),r={};for(const[f,g]of Object.entries(l.groups))r[f]=g.total===void 0?{...g,total:g.rolls.reduce((h,m)=>h+m,0)+(g.modifier??0)}:g;const{outcome:a,flags:c}=es(i.outcomeRules,r,t,o),u={...l,groups:r,profile:i.system};a!==void 0&&(u.outcome=a),c.length>0&&(u.outcome_flags=c);const d=ss(i,t,o);return d.length>0&&(u.tested=d),u}function Co(){const n=globalThis.crypto;if(!n||typeof n.getRandomValues!="function")throw new Error("crypto.getRandomValues indisponivel neste ambiente — injete um RandomSource explicito");return n}const Go=()=>{const n=new Uint32Array(1);Co().getRandomValues(n);const e=n[0];if(e===void 0)throw new Error("falha ao ler bytes aleatorios");return e/2**32};class Jt extends Error{}const Ao={includeJokers:!1,removalMode:"permanent",autoReshuffleOnEmpty:!1},vo=["hearts","diamonds","clubs","spades"],Bo=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];function Zo(n){const e=[];for(const t of vo)for(const s of Bo)e.push({id:`${t}-${s}`,suit:t,rank:s});return n&&(e.push({id:"joker-1",suit:"joker",rank:"joker"}),e.push({id:"joker-2",suit:"joker",rank:"joker"})),e}function zt(n,e={}){if(e.deterministicOrder)return[...e.deterministicOrder];const t=e.rng??Go,s=[...n];for(let i=s.length-1;i>0;i--){const o=Math.floor(t()*(i+1)),l=s[i],r=s[o];s[i]=r,s[o]=l}return s}function is(n={},e={}){const t={...Ao,...n},s=Zo(t.includeJokers);return{config:t,drawPile:zt(s,e),discardPile:[]}}function Wo(n,e){n.config={...n.config,...e}}function os(n,e={}){const t=[...n.drawPile,...n.discardPile];n.drawPile=zt(t,e),n.discardPile=[]}function wo(n,e,t={}){if(!Number.isInteger(e)||e<1)throw new Jt(`quantidade invalida: ${e}`);let s=!1;if(e>n.drawPile.length){if(n.config.removalMode!=="permanent"||!n.config.autoReshuffleOnEmpty){const o=e-n.drawPile.length;throw new Jt(`faltam ${o} carta(s) no monte — reembaralhe pra continuar`)}if(os(n,t),s=!0,e>n.drawPile.length)throw new Jt(`baralho tem so ${n.drawPile.length} carta(s), mesmo apos reembaralhar`)}const i=n.drawPile.splice(0,e);return n.config.removalMode==="permanent"?n.discardPile.push(...i):(n.drawPile.push(...i),n.drawPile=zt(n.drawPile,t)),{cards:i,remaining:n.drawPile.length,reshuffled:s}}const No=Object.assign({"../../../packages/rules-engine/profiles/d100.yaml":`system: d100
label: "d100 — teste de perícia (BRP/Cthulhu)"
roll_type: simple
inputs:
  - id: skill
    label: "Perícia"
    type: number
fields:
  - id: roll
    dice: "1d100"
# Rolagem por baixo: sucesso e rolar <= pericia. Os tiers sao fracoes da
# pericia (extremo = 1/5, dificil = 1/2) e a comparacao com float funciona
# igual ao arredondamento pra baixo do livro (roll inteiro <= 27.5 == <= 27).
# Falha critica: 100 sempre; 96-99 tambem quando a pericia e menor que 50.
outcome_rules:
  - condition: "roll.total == 1"
    result: critical
  - condition: "roll.total == 100 or (roll.total >= 96 and {input.skill} < 50)"
    result: fumble
  - condition: "roll.total > 1 and roll.total <= {input.skill} / 5"
    result: extreme_success
  - condition: "roll.total > {input.skill} / 5 and roll.total <= {input.skill} / 2"
    result: hard_success
  - condition: "roll.total > {input.skill} / 2 and roll.total <= {input.skill}"
    result: regular_success
  # Falha simples: acima da pericia, sem ser a falha critica ja tratada acima.
  - condition: "roll.total > {input.skill} and roll.total < 100 and not (roll.total >= 96 and {input.skill} < 50)"
    result: fail
`,"../../../packages/rules-engine/profiles/d20.yaml":`system: d20
label: "d20 — teste contra CD"
roll_type: simple
inputs:
  - id: mode
    label: "Modo"
    type: select
    options:
      - { value: "", label: "Normal" }
      - { value: "adv", label: "Vantagem" }
      - { value: "dis", label: "Desvantagem" }
  - id: dc
    label: "CD"
    type: number
  - id: mod
    label: "Modificador"
    type: number
    default: "0"
fields:
  # "1d20adv" / "1d20dis" viram 2d20kh1 / 2d20kl1 no parser (acucar da
  # notacao camada 1) — \`rolls\` fica com o unico dado mantido.
  - id: roll
    dice: "1d20{input.mode}"
    modifier: "{input.mod}"
outcome_rules:
  - condition: "roll.rolls[0] == 20"
    result: critical_success
  - condition: "roll.rolls[0] == 1"
    result: critical_failure
  - condition: "roll.total >= {input.dc} and roll.rolls[0] != 20 and roll.rolls[0] != 1"
    result: success
  - condition: "roll.total < {input.dc} and roll.rolls[0] != 20 and roll.rolls[0] != 1"
    result: fail
`,"../../../packages/rules-engine/profiles/fate.yaml":`system: fate
label: "Fate / Fudge — 4dF"
roll_type: simple
inputs:
  - id: difficulty
    label: "Dificuldade"
    type: number
    required: false
  - id: skill
    label: "Habilidade"
    type: number
    default: "0"
fields:
  - id: roll
    dice: "4dF"
    modifier: "{input.skill}"
# Fate compara o total (4dF + habilidade) com a dificuldade/oposicao.
# Tiers mutuamente exclusivos — ver nota em fitd.yaml.
outcome_rules:
  - condition: "roll.total >= {input.difficulty} + 3"
    result: success_with_style
  - condition: "roll.total > {input.difficulty} and roll.total < {input.difficulty} + 3"
    result: success
  - condition: "roll.total == {input.difficulty}"
    result: tie
  - condition: "roll.total < {input.difficulty}"
    result: fail
`,"../../../packages/rules-engine/profiles/firelights.yaml":`system: firelights
label: "Firelights — Ação"
roll_type: comparison
inputs:
  - id: modifier
    label: "Modificador"
    type: number
    default: "0"
fields:
  - id: action
    dice: "2d6"
    modifier: "{input.modifier}"
  - id: challenge
    dice: "2c"
    compare_individually: true
outcome_rules:
  - condition: "action.total > challenge[0] and action.total > challenge[1]"
    result: strong_hit
  - condition: "action.total > challenge[0] xor action.total > challenge[1]"
    result: weak_hit
  - condition: "action.total <= challenge[0] and action.total <= challenge[1]"
    result: miss
  - condition: "challenge[0] == challenge[1]"
    result: match
`,"../../../packages/rules-engine/profiles/fitd.yaml":`system: fitd
label: "FitD — Pool de ação"
roll_type: simple
inputs:
  - id: pool_size
    label: "Tamanho do pool"
    type: number
fields:
  - id: pool
    dice: "{input.pool_size}d6"
    # Pool 0 (ou negativo): regra do FitD e rolar 2d6 e ficar so com o
    # menor — "0d6" nao e notacao valida, entao troca antes de rolar.
    zero_dice_fallback: "2d6kl1"
outcome_rules:
  - condition: "count(pool, '>=6') >= 2"
    result: critical
  - condition: "count(pool, '>=6') == 1"
    result: full_success
  # Tiers sao mutuamente exclusivos: partial exige zero 6, senao um
  # critical/full_success tambem marcaria partial_success e a UI exibiria
  # dois outcomes contraditorios.
  - condition: "max(pool) >= 4 and count(pool, '>=6') == 0"
    result: partial_success
  - condition: "max(pool) < 4"
    result: miss
`,"../../../packages/rules-engine/profiles/fractal.yaml":`system: fractal
label: "Fractal — Rolagem de Risco"
roll_type: simple
# \`dice_total\` NAO e um input de verdade — o jogador so ve
# "fatos_aplicaveis" e "vantagem" na UI. O motor so faz substituicao
# literal na notacao do field (sem aritmetica), entao quem combina os dois
# num tamanho de pool (min 0, cap 3, +1 se vantagem e fatos>=1) e a camada
# de chamada (apps/web/src/profileInputQuirks.ts), ANTES de rollWithProfile
# — ver docs/system-profiles.md#inputs-derivados.
inputs:
  - id: fatos_aplicaveis
    label: "Número de Fatos"
    type: number
    default: "0"
  - id: vantagem
    label: "Vantagem?"
    type: select
    required: false
    default: "nao"
    # "nao" primeiro: a UI (RollPanel.tsx/defaultInputs) usa SEMPRE o
    # PRIMEIRO option como valor inicial do select — o campo "default"
    # acima nao se aplica a select, so a number. Vantagem comeca desligada
    # de proposito (e a excecao, nao a regra da rolagem).
    options:
      - { value: "nao", label: "Não" }
      - { value: "sim", label: "Sim, +1d6" }
fields:
  - id: pool
    dice: "{input.dice_total}d6"
    compare_individually: true
    zero_dice_fallback: "1d6"
# Nao soma: o resultado e o MAIOR dado da pool. Threshold de sucesso muda
# de patamar conforme fatos_aplicaveis (5-6 com Fato aplicavel, so 6 sem
# nenhum) — por isso as duas metades (>=1 / ==0) sao ramos separados, e nao
# uma condicao so. Ruptura (qualquer dado =1) e evento PARALELO, avaliado
# DEPOIS dos ramos de resultado base pra nunca virar o "outcome" primario
# (mesmo padrao do "match" do Ironsworn).
outcome_rules:
  - condition: "{input.fatos_aplicaveis} >= 1 and count(pool, '==6') == 4"
    result: sucesso_impulso_x4
  - condition: "{input.fatos_aplicaveis} >= 1 and count(pool, '==6') == 3"
    result: sucesso_impulso_x3
  - condition: "{input.fatos_aplicaveis} >= 1 and count(pool, '==6') == 2"
    result: sucesso_impulso_x2
  - condition: "{input.fatos_aplicaveis} >= 1 and max(pool) >= 5 and count(pool, '==6') < 2"
    result: sucesso
  - condition: "{input.fatos_aplicaveis} >= 1 and max(pool) <= 4"
    result: falha
  - condition: "{input.fatos_aplicaveis} == 0 and max(pool) == 6"
    result: sucesso
  - condition: "{input.fatos_aplicaveis} == 0 and max(pool) <= 5"
    result: falha
  - condition: "count(pool, '==1') == 4"
    result: ruptura_x4
  - condition: "count(pool, '==1') == 3"
    result: ruptura_x3
  - condition: "count(pool, '==1') == 2"
    result: ruptura_x2
  - condition: "count(pool, '==1') == 1"
    result: ruptura_x1
`,"../../../packages/rules-engine/profiles/infaernum.yaml":`system: infaernum
label: "Infaernum — Rolagem padrão (3d6)"
roll_type: simple
inputs: []
fields:
  - id: pool
    dice: "3d6"
    compare_individually: true
# Cada dado do 3d6 e lido INDIVIDUALMENTE, nao somado: 1 = desgraca, 2 ou 3 =
# vislumbre, 4 ou 5 = facanha, 6 = milagre. Pool fixo em 3 dados: cada
# categoria so pode ocorrer 0/1/2/3 vezes, entao quantiza sem gambiarra —
# "2 milagres" em vez de uma flag booleana que esconde quantos cairam.
# Ordem prioriza os extremos: milagre e desgraca (o destaque, "outcome")
# vem antes de facanha/vislumbre.
outcome_rules:
  - condition: "count(pool, '==6') == 3"
    result: milagre_x3
  - condition: "count(pool, '==6') == 2"
    result: milagre_x2
  - condition: "count(pool, '==6') == 1"
    result: milagre_x1
  - condition: "count(pool, '==1') == 3"
    result: desgraca_x3
  - condition: "count(pool, '==1') == 2"
    result: desgraca_x2
  - condition: "count(pool, '==1') == 1"
    result: desgraca_x1
  - condition: "(count(pool, '==4') + count(pool, '==5')) == 3"
    result: facanha_x3
  - condition: "(count(pool, '==4') + count(pool, '==5')) == 2"
    result: facanha_x2
  - condition: "(count(pool, '==4') + count(pool, '==5')) == 1"
    result: facanha_x1
  - condition: "(count(pool, '==2') + count(pool, '==3')) == 3"
    result: vislumbre_x3
  - condition: "(count(pool, '==2') + count(pool, '==3')) == 2"
    result: vislumbre_x2
  - condition: "(count(pool, '==2') + count(pool, '==3')) == 1"
    result: vislumbre_x1
`,"../../../packages/rules-engine/profiles/infaernum_ideias.yaml":`system: infaernum_ideias
label: "Infaernum — Ideias (verbo + substantivo)"
roll_type: multi
inputs: []
fields:
  - id: verb
    dice: "2d6"
    compare_individually: true
  - id: noun
    dice: "2d6"
    compare_individually: true
# Cada tabela e lida pelos dois dados INDIVIDUALMENTE (linha = 1o dado,
# coluna = 2o dado), nao pela soma — sao 36 celulas igualmente
# provaveis, nao a curva de um 2d6 somado. Verbo e substantivo saem
# de rolagens independentes (2d6 cada); una os dois pra interpretar.
outcome_rules:
  - condition: "verb.rolls[0] == 1 and verb.rolls[1] == 1"
    result: ignorar
  - condition: "verb.rolls[0] == 1 and verb.rolls[1] == 2"
    result: descobrir
  - condition: "verb.rolls[0] == 1 and verb.rolls[1] == 3"
    result: comecar
  - condition: "verb.rolls[0] == 1 and verb.rolls[1] == 4"
    result: bloquear
  - condition: "verb.rolls[0] == 1 and verb.rolls[1] == 5"
    result: ganhar
  - condition: "verb.rolls[0] == 1 and verb.rolls[1] == 6"
    result: perseguir
  - condition: "verb.rolls[0] == 2 and verb.rolls[1] == 1"
    result: julgar
  - condition: "verb.rolls[0] == 2 and verb.rolls[1] == 2"
    result: fazer
  - condition: "verb.rolls[0] == 2 and verb.rolls[1] == 3"
    result: terminar
  - condition: "verb.rolls[0] == 2 and verb.rolls[1] == 4"
    result: vingar
  - condition: "verb.rolls[0] == 2 and verb.rolls[1] == 5"
    result: imitar
  - condition: "verb.rolls[0] == 2 and verb.rolls[1] == 6"
    result: iludir
  - condition: "verb.rolls[0] == 3 and verb.rolls[1] == 1"
    result: esconder
  - condition: "verb.rolls[0] == 3 and verb.rolls[1] == 2"
    result: conquistar
  - condition: "verb.rolls[0] == 3 and verb.rolls[1] == 3"
    result: aumentar
  - condition: "verb.rolls[0] == 3 and verb.rolls[1] == 4"
    result: guiar
  - condition: "verb.rolls[0] == 3 and verb.rolls[1] == 5"
    result: oprimir
  - condition: "verb.rolls[0] == 3 and verb.rolls[1] == 6"
    result: ajudar
  - condition: "verb.rolls[0] == 4 and verb.rolls[1] == 1"
    result: proteger
  - condition: "verb.rolls[0] == 4 and verb.rolls[1] == 2"
    result: pacificar
  - condition: "verb.rolls[0] == 4 and verb.rolls[1] == 3"
    result: diminuir
  - condition: "verb.rolls[0] == 4 and verb.rolls[1] == 4"
    result: expor
  - condition: "verb.rolls[0] == 4 and verb.rolls[1] == 5"
    result: emboscar
  - condition: "verb.rolls[0] == 4 and verb.rolls[1] == 6"
    result: controlar
  - condition: "verb.rolls[0] == 5 and verb.rolls[1] == 1"
    result: mudar
  - condition: "verb.rolls[0] == 5 and verb.rolls[1] == 2"
    result: encontrar
  - condition: "verb.rolls[0] == 5 and verb.rolls[1] == 3"
    result: tomar
  - condition: "verb.rolls[0] == 5 and verb.rolls[1] == 4"
    result: planejar
  - condition: "verb.rolls[0] == 5 and verb.rolls[1] == 5"
    result: criar
  - condition: "verb.rolls[0] == 5 and verb.rolls[1] == 6"
    result: recusar
  - condition: "verb.rolls[0] == 6 and verb.rolls[1] == 1"
    result: conhecer
  - condition: "verb.rolls[0] == 6 and verb.rolls[1] == 2"
    result: curar
  - condition: "verb.rolls[0] == 6 and verb.rolls[1] == 3"
    result: pausar
  - condition: "verb.rolls[0] == 6 and verb.rolls[1] == 4"
    result: perder
  - condition: "verb.rolls[0] == 6 and verb.rolls[1] == 5"
    result: trair
  - condition: "verb.rolls[0] == 6 and verb.rolls[1] == 6"
    result: aceitar
  - condition: "noun.rolls[0] == 1 and noun.rolls[1] == 1"
    result: ambiente
  - condition: "noun.rolls[0] == 1 and noun.rolls[1] == 2"
    result: poder
  - condition: "noun.rolls[0] == 1 and noun.rolls[1] == 3"
    result: falha
  - condition: "noun.rolls[0] == 1 and noun.rolls[1] == 4"
    result: clima
  - condition: "noun.rolls[0] == 1 and noun.rolls[1] == 5"
    result: animal
  - condition: "noun.rolls[0] == 1 and noun.rolls[1] == 6"
    result: perigo
  - condition: "noun.rolls[0] == 2 and noun.rolls[1] == 1"
    result: alianca
  - condition: "noun.rolls[0] == 2 and noun.rolls[1] == 2"
    result: problema
  - condition: "noun.rolls[0] == 2 and noun.rolls[1] == 3"
    result: atencao
  - condition: "noun.rolls[0] == 2 and noun.rolls[1] == 4"
    result: boato
  - condition: "noun.rolls[0] == 2 and noun.rolls[1] == 5"
    result: negocio
  - condition: "noun.rolls[0] == 2 and noun.rolls[1] == 6"
    result: cilada
  - condition: "noun.rolls[0] == 3 and noun.rolls[1] == 1"
    result: inimigo
  - condition: "noun.rolls[0] == 3 and noun.rolls[1] == 2"
    result: lar
  - condition: "noun.rolls[0] == 3 and noun.rolls[1] == 3"
    result: ferimento
  - condition: "noun.rolls[0] == 3 and noun.rolls[1] == 4"
    result: caido
  - condition: "noun.rolls[0] == 3 and noun.rolls[1] == 5"
    result: medo
  - condition: "noun.rolls[0] == 3 and noun.rolls[1] == 6"
    result: prova
  - condition: "noun.rolls[0] == 4 and noun.rolls[1] == 1"
    result: confronto
  - condition: "noun.rolls[0] == 4 and noun.rolls[1] == 2"
    result: caminho
  - condition: "noun.rolls[0] == 4 and noun.rolls[1] == 3"
    result: ilusao
  - condition: "noun.rolls[0] == 4 and noun.rolls[1] == 4"
    result: fe
  - condition: "noun.rolls[0] == 4 and noun.rolls[1] == 5"
    result: solidao
  - condition: "noun.rolls[0] == 4 and noun.rolls[1] == 6"
    result: vazio
  - condition: "noun.rolls[0] == 5 and noun.rolls[1] == 1"
    result: dor
  - condition: "noun.rolls[0] == 5 and noun.rolls[1] == 2"
    result: doenca
  - condition: "noun.rolls[0] == 5 and noun.rolls[1] == 3"
    result: raiva
  - condition: "noun.rolls[0] == 5 and noun.rolls[1] == 4"
    result: viagem
  - condition: "noun.rolls[0] == 5 and noun.rolls[1] == 5"
    result: esperanca
  - condition: "noun.rolls[0] == 5 and noun.rolls[1] == 6"
    result: objetivo
  - condition: "noun.rolls[0] == 6 and noun.rolls[1] == 1"
    result: mentira
  - condition: "noun.rolls[0] == 6 and noun.rolls[1] == 2"
    result: morte
  - condition: "noun.rolls[0] == 6 and noun.rolls[1] == 3"
    result: pista
  - condition: "noun.rolls[0] == 6 and noun.rolls[1] == 4"
    result: riqueza
  - condition: "noun.rolls[0] == 6 and noun.rolls[1] == 5"
    result: verdade
  - condition: "noun.rolls[0] == 6 and noun.rolls[1] == 6"
    result: sucesso
`,"../../../packages/rules-engine/profiles/infaernum_sim_ou_nao.yaml":`system: infaernum_sim_ou_nao
label: "Infaernum — Sim ou Não"
roll_type: simple
inputs:
  - id: chance
    label: "Chance"
    type: select
    options:
      - { value: "0", label: "Neutro" }
      - { value: "1", label: "Provável" }
      - { value: "-1", label: "Improvável" }
fields:
  - id: roll
    dice: "1d6"
    modifier: "{input.chance}"
outcome_rules:
  - condition: "roll.total >= 4"
    result: sim
  - condition: "roll.total < 4"
    result: nao
`,"../../../packages/rules-engine/profiles/ironsworn.yaml":`system: ironsworn
label: "Ironsworn — Ação"
roll_type: comparison
inputs:
  - id: attribute
    label: "Atributo"
    type: number
    default: "0"
fields:
  - id: action
    dice: "1d6"
    modifier: "{input.attribute}"
  - id: challenge
    dice: "2d10"
    compare_individually: true
outcome_rules:
  - condition: "action.total > challenge[0] and action.total > challenge[1]"
    result: strong_hit
  - condition: "action.total > challenge[0] xor action.total > challenge[1]"
    result: weak_hit
  - condition: "action.total <= challenge[0] and action.total <= challenge[1]"
    result: miss
  - condition: "challenge[0] == challenge[1]"
    result: match
`,"../../../packages/rules-engine/profiles/pbta.yaml":`system: pbta
label: "PbtA (2d6)"
roll_type: simple
inputs:
  - id: mode
    label: "Modo"
    type: select
    options:
      - { value: "", label: "Normal" }
      - { value: "adv", label: "Vantagem" }
      - { value: "dis", label: "Desvantagem" }
  - id: mod
    label: "Modificador"
    type: number
    default: "0"
fields:
  # Vantagem/desvantagem nao e regra oficial do PbtA (que usa +1
  # forward/ongoing — ja coberto por "mod"), mas varios hacks tem essa
  # opcao (ex.: Kult usa a mesma ideia no pbta2d10.yaml). "2d6adv" vira
  # 3d6kh2 (acucar do parser) — fica com os 2 maiores de 3.
  - id: roll
    dice: "2d6{input.mode}"
    modifier: "{input.mod}"
outcome_rules:
  - condition: "roll.total >= 10"
    result: strong_hit
  # Tier exclusivo: sem o teto, um strong_hit (>=10) tambem marcaria
  # weak_hit e a UI exibiria dois outcomes contraditorios.
  - condition: "roll.total >= 7 and roll.total < 10"
    result: weak_hit
  - condition: "roll.total < 7"
    result: miss
`,"../../../packages/rules-engine/profiles/pbta2d10.yaml":`system: pbta2d10
label: "PbtA (2d10)"
roll_type: simple
inputs:
  - id: mode
    label: "Modo"
    type: select
    options:
      - { value: "", label: "Normal" }
      - { value: "adv", label: "Vantagem" }
      - { value: "dis", label: "Desvantagem" }
  - id: mod
    label: "Modificador"
    type: number
    default: "0"
fields:
  # "2d10adv" -> 3d10kh2 (acucar do parser) — fica com os 2 maiores de 3.
  - id: roll
    dice: "2d10{input.mode}"
    modifier: "{input.mod}"
# Reusa os mesmos ids de outcome do pbta 2d6 (strong_hit/weak_hit/miss) —
# mesmos tiers narrativos, so a escala de dado muda. Assim o rotulo/cor da
# UI (apps/web/src/format.ts) ja funciona sem entrada nova no mapa.
outcome_rules:
  - condition: "roll.total >= 15"
    result: strong_hit
  - condition: "roll.total >= 10 and roll.total < 15"
    result: weak_hit
  - condition: "roll.total < 10"
    result: miss
`,"../../../packages/rules-engine/profiles/pool_d6.yaml":`system: pool_d6
label: "Pool de d6 (Shadowrun)"
roll_type: simple
inputs:
  - id: pool_size
    label: "Tamanho do pool"
    type: number
  - id: threshold
    label: "Limite (acertos necessários)"
    type: number
    required: false
fields:
  - id: pool
    dice: "{input.pool_size}d6"
    compare_individually: true
    success_rule: ">=5"
# 5 ou 6 e acerto — success_rule faz \`pool.total\` virar a CONTAGEM de
# acertos (nao a soma dos dados), entao "[2, 5, 6, 1] = 2" ja mostra o
# numero de sucessos sem o jogador contar na mao. Glitch: mais de metade
# do pool mostra 1 (glitch critico se, alem disso, zero acertos).
# "threshold" e opcional: sem ele so a contagem existe, sem success/fail.
outcome_rules:
  - condition: "count(pool, '==1') > {input.pool_size} / 2 and pool.total == 0"
    result: critical_glitch
  - condition: "count(pool, '==1') > {input.pool_size} / 2 and pool.total >= 1"
    result: glitch
  - condition: "pool.total >= {input.threshold}"
    result: success
  - condition: "pool.total < {input.threshold}"
    result: fail
`,"../../../packages/rules-engine/profiles/roll_under.yaml":`system: roll_under
label: "Genérico — Roll Under"
roll_type: overlay
# Numero MENOR e melhor aqui (roll.total <= target) — o oposto de d20/pbta,
# onde "adv" (Vantagem) fica com o dado MAIOR. Sem isto "Vantagem" faria a
# rolagem PIORAR em roll_under (aplica o token literal "adv" do parser,
# que sempre significa "fica com o maior") — ver applyOverlayMode.
mode_favors_low: true
inputs:
  - id: mode
    label: "Modo"
    type: select
    options:
      - { value: "", label: "Normal" }
      - { value: "adv", label: "Vantagem" }
      - { value: "dis", label: "Desvantagem" }
  - id: target
    label: "Valor testado"
    type: number
    required: false
fields: []
# Sucesso e rolar igual ou menor que o valor testado — o oposto do d20/d100.
# Sem dado proprio: a rolagem vem do composer de notacao livre normal
# (1d20, 3d6, o que a mesa usar) — ver rollOverlay em profile.ts. "roll" e
# o nome que o parser da pro grupo unico de notacao livre.
# "target" e opcional: sem ele, so a rolagem existe, sem outcome_rule
# batendo (evaluateOutcomeRules pula regra que referencia input ausente).
# "mode": aplicado em cima da notacao do composer (nao de um field do
# profile — este e "overlay", nao tem dado proprio) so quando ela e UM
# termo simples ("1d20", "3d6"); pool composto ("2d6+1d4") ignora o modo
# em silencio — ver applyOverlayMode em profile.ts.
outcome_rules:
  - condition: "roll.total <= {input.target}"
    result: success
  - condition: "roll.total > {input.target}"
    result: fail
`,"../../../packages/rules-engine/profiles/trophy_dark.yaml":`# Perfil de sistema: Trophy Dark (Hedgemaze Press / The Gauntlet)
#
# No Trophy Dark, todo teste de risco (Risk Roll) usa um pool de dados d6 de
# duas cores: dados Claros (perícias e Devil's Bargains) e dados Escuros
# (arriscar a mente/corpo, rituais ou forçar).
#
# O maior dado geral decide o resultado da ação:
#   6: Sucesso completo
#   4-5: Sucesso parcial / com complicação
#   1-3: Falha / desastre
#
# Se o maior dado da rolagem estiver em um Dado Escuro E for maior ou igual à
# sua Ruína atual, sua Ruína aumenta em +1.

system: trophy_dark
label: "Trophy Dark"
roll_type: multi

inputs:
  - id: claros
    label: "Dados Claros"
    type: number
    required: true
    default: "1"
  - id: escuros
    label: "Dados Escuros"
    type: number
    required: true
    default: "0"
  - id: ruina
    label: "Sua Ruína"
    type: number
    required: true
    default: "1"

fields:
  - id: claros
    dice: "{input.claros}d6"
    compare_individually: true
    zero_dice_fallback: "0d6"
    slot: 1
  - id: escuros
    dice: "{input.escuros}d6"
    compare_individually: true
    zero_dice_fallback: "0d6"
    slot: 2

outcome_rules:
  # Outcome principal pelo maior dado entre claros e escuros
  - condition: "max(claros, escuros) == 6"
    result: "success"
  - condition: "max(claros, escuros) >= 4 and max(claros, escuros) <= 5"
    result: "weak_hit"
  - condition: "max(claros, escuros) <= 3"
    result: "miss"

  # Aumento de Ruína: se o maior dado for escuro e bater/superar a Ruína atual
  - condition: "count(escuros, '>=1') > 0 and max(escuros) >= max(claros) and max(escuros) >= {input.ruina}"
    result: "trophy_ruina_aumenta"
`,"../../../packages/rules-engine/profiles/trophy_gold.yaml":`# Perfil de sistema: Trophy Gold (Hedgemaze Press / The Gauntlet)
#
# Trophy Gold expande a mecânica do Trophy para exploração de masmorras e
# combate em campanhas. Utiliza dados Claros e Escuros (Ruína).
#
# O maior dado geral decide o resultado da ação:
#   6: Sucesso completo (vitória limpa / sem sofrer dano)
#   4-5: Sucesso parcial (avanço com custo / dano mútuo)
#   1-3: Falha / contratempo
#
# Se o maior dado da rolagem estiver em um Dado Escuro E for maior ou igual à
# sua Ruína atual, sua Ruína aumenta em +1.

system: trophy_gold
label: "Trophy Gold"
roll_type: multi

inputs:
  - id: claros
    label: "Dados Claros"
    type: number
    required: true
    default: "1"
  - id: escuros
    label: "Dados Escuros"
    type: number
    required: true
    default: "0"
  - id: ruina
    label: "Sua Ruína"
    type: number
    required: true
    default: "1"

fields:
  - id: claros
    dice: "{input.claros}d6"
    compare_individually: true
    zero_dice_fallback: "0d6"
    slot: 1
  - id: escuros
    dice: "{input.escuros}d6"
    compare_individually: true
    zero_dice_fallback: "0d6"
    slot: 2

outcome_rules:
  - condition: "max(claros, escuros) == 6"
    result: "success"
  - condition: "max(claros, escuros) >= 4 and max(claros, escuros) <= 5"
    result: "weak_hit"
  - condition: "max(claros, escuros) <= 3"
    result: "miss"

  - condition: "count(escuros, '>=1') > 0 and max(escuros) >= max(claros) and max(escuros) >= {input.ruina}"
    result: "trophy_ruina_aumenta"
`,"../../../packages/rules-engine/profiles/wod5.yaml":`system: wod5
label: "World of Darkness v5 — Pool de sucessos"
roll_type: multi
inputs:
  - id: regular
    label: "Dados regulares"
    type: number
  - id: hunger
    label: "Dados de Fome/Ira"
    type: number
  - id: difficulty
    label: "Dificuldade (sucessos necessários)"
    type: number
    required: false
fields:
  - id: regular
    dice: "{input.regular}d10"
    compare_individually: true
    success_rule: ">=6"
    slot: 1
  - id: hunger
    dice: "{input.hunger}d10"
    compare_individually: true
    success_rule: ">=6"
    slot: 2
# Mecanica compartilhada por toda a linha v5 (Vampiro, Lobisomem, Caçador...)
# — os dados de Fome/Ira SUBSTITUEM parte do pool regular, entao ambos os
# campos exigem >=1 dado cada (limite do parser de notacao: "0d10" nao e
# valido). Cobre o caso comum; Fome 0 ou pool 100% Fome ficam fora.
# 6-9 = 1 sucesso, 10 = 1 sucesso, e cada PAR de 10s (regular+fome juntos)
# soma +2 sucessos extra — critico "limpo" sem dado de Fome no par, "sujo"
# (messy) com pelo menos um. Fracasso com zero sucessos e um 1 na Fome vira
# fracasso bestial. "difficulty" e opcional: sem ela so os eventos
# intrinsecos ao pool (critico/messy/bestial) aparecem, sem success/fail.
outcome_rules:
  - condition: "(count(regular, '==10') + count(hunger, '==10')) >= 2 and count(hunger, '==10') >= 1"
    result: messy_critical
  - condition: "(count(regular, '==10') + count(hunger, '==10')) >= 2 and count(hunger, '==10') == 0"
    result: critical
  - condition: "(count(regular, '>=6') + count(hunger, '>=6')) == 0 and count(hunger, '==1') >= 1"
    result: bestial_failure
  - condition: "((count(regular, '>=6') + count(hunger, '>=6')) + ((count(regular, '==10') + count(hunger, '==10')) >= 2) * 2 + ((count(regular, '==10') + count(hunger, '==10')) >= 4) * 2) >= {input.difficulty}"
    result: success
  - condition: "((count(regular, '>=6') + count(hunger, '>=6')) + ((count(regular, '==10') + count(hunger, '==10')) >= 2) * 2 + ((count(regular, '==10') + count(hunger, '==10')) >= 4) * 2) < {input.difficulty}"
    result: fail

`,"../../../packages/rules-engine/profiles/yze.yaml":`system: yze
label: "YZ — Pool genérico"
roll_type: simple
inputs:
  - id: pool_size
    label: "Dados no pool"
    type: number
    default: "1"
  - id: sucessos_anteriores
    label: "Sucesso garantido"
    type: number
    default: "0"
  - id: dificuldade
    label: "Dificuldade"
    type: number
    required: false
    default: "1"
fields:
  - id: pool
    dice: "{input.pool_size}d6"
    modifier: "{input.sucessos_anteriores}"
    compare_individually: true
    success_rule: ">=6"
# Base de toda a linha Year Zero (Coriolis, Tales from the Loop, Vaesen,
# Mutant simplificado): pool de d6, cada 6 e um sucesso, sem bane. Empurrar
# (push) rerrola tudo que NAO deu 6 — os 6s ficam na mesa, e e por isso que
# existe "sucessos travados": o motor e stateless, entao o que sobrou da
# rolagem anterior volta como modificador da CONTAGEM (ver o comentario do
# success_rule em src/profile.ts). "[6, 3, 4] + 2 = 3" e uma rolagem
# empurrada com 2 sucessos vindos de antes.
# "dificuldade" e opcional (default 1, o normal na linha): em branco, so a
# contagem aparece, sem sucesso/falha. Pool 0 e legitimo aqui (forcar sem
# nenhum dado sobrando) — a notacao "0d6" existe justamente pra isso, e o
# palco nao anima dado nenhum.
outcome_rules:
  - condition: "pool.total >= {input.dificuldade}"
    result: success
  - condition: "pool.total < {input.dificuldade}"
    result: fail
`,"../../../packages/rules-engine/profiles/yze_alien.yaml":`system: yze_alien
label: "YZ — Alien"
roll_type: multi
inputs:
  - id: base
    label: "Base"
    type: number
    default: "1"
  - id: estresse
    label: "Estresse"
    type: number
    default: "0"
  - id: sucessos_anteriores
    label: "Sucesso garantido"
    type: number
    default: "0"
  - id: dificuldade
    label: "Dificuldade"
    type: number
    required: false
    default: "1"
fields:
  - id: base
    dice: "{input.base}d6"
    modifier: "{input.sucessos_anteriores}"
    compare_individually: true
    success_rule: ">=6"
    slot: 1
  - id: estresse
    dice: "{input.estresse}d6"
    compare_individually: true
    success_rule: ">=6"
    slot: 2
# Pool base + dados de Estresse, ambos d6, 6 e sucesso nos dois. O que muda
# e o 1: no dado de Estresse ele dispara PANICO, e ao contrario do bane do
# Forbidden Lands isso vale em QUALQUER rolagem, empurrada ou nao — por
# isso a regra do panico nao depende de nenhum input opcional pra ser
# avaliada.
#
# Forçar rerrola tudo que nao deu 6 (inclusive os 1s, que aqui nao travam)
# e ACRESCENTA um dado de Estresse — quem soma esse +1 e o botao Forçar da
# UI, nao o profile. Estresse 0 e o estado inicial normal do personagem —
# "0d6" da conta disso sozinho, sem dado fantasma no palco.
outcome_rules:
  - condition: "base.total + estresse.total >= {input.dificuldade}"
    result: success
  - condition: "base.total + estresse.total < {input.dificuldade}"
    result: fail
  - condition: "count(estresse, '==1') >= 1"
    result: yze_panico
`,"../../../packages/rules-engine/profiles/yze_fbl.yaml":`system: yze_fbl
label: "YZ — Forbidden Lands / Mutant"
roll_type: multi
inputs:
  - id: base
    label: "Base"
    type: number
    default: "1"
  - id: pericia
    label: "Perícia"
    type: number
    default: "0"
  - id: equipamento
    label: "Equipamento"
    type: number
    default: "0"
  - id: sucessos_anteriores
    label: "Sucesso garantido"
    type: number
    default: "0"
  - id: dificuldade
    label: "Dificuldade"
    type: number
    required: false
    default: "1"
  - id: push_banes_base
    label: "1s Base"
    type: number
    required: false
  - id: push_banes_equip
    label: "1s Equip."
    type: number
    required: false
fields:
  - id: base
    dice: "{input.base}d6"
    modifier: "{input.sucessos_anteriores}"
    compare_individually: true
    success_rule: ">=6"
    slot: 1
  - id: pericia
    dice: "{input.pericia}d6"
    compare_individually: true
    success_rule: ">=6"
    slot: 2
  - id: equipamento
    dice: "{input.equipamento}d6"
    compare_individually: true
    success_rule: ">=6"
    slot: 3
# Tres pools de d6 INDEPENDENTES (nao competem — por isso multi): Base
# (atributo), Perícia e Equipamento. 6 e sucesso em qualquer um dos tres, e
# os sucessos somam.
#
# Bane (1) so machuca no dado de Base (dano de atributo) e no de
# Equipamento (dano no item) — 1 em Perícia nunca conta.
#
# E so conta se a rolagem foi FORCADA. O motor nao sabe se foi: quem marca
# isso sao os dois inputs "push_*", OPCIONAIS de proposito — em branco
# (rolagem normal) toda outcome_rule que os referencia e pulada
# (evaluateOutcomeRules/referencesAny) e nenhum dano aparece; preenchidos,
# mesmo com 0, os 1s desta rolagem contam. O botao Forçar preenche os dois
# sempre, com os 1s que ficaram travados na rolagem anterior — no push do
# FBL os 6s E os 1s ficam na mesa, so o meio rerrola.
#
# O prefixo "push_" no id nao e enfeite: e o que faz o formulario da web
# dobrar esses campos numa secao recolhida (RollPanel.tsx). Sao escrituracao
# do Forçar, nao coisa que se preenche na mao numa rolagem normal.
#
# Pool 0 e legitimo em qualquer um dos tres (sem equipamento, sem pericia,
# ou forcada sem dado sobrando) — "0d6" e notacao valida e o palco nao
# anima dado nenhum por ele.
outcome_rules:
  - condition: "base.total + pericia.total + equipamento.total >= {input.dificuldade}"
    result: success
  - condition: "base.total + pericia.total + equipamento.total < {input.dificuldade}"
    result: fail
  - condition: "count(base, '==1') + {input.push_banes_base} >= 3"
    result: yze_dano_atributo_x3
  - condition: "count(base, '==1') + {input.push_banes_base} == 2"
    result: yze_dano_atributo_x2
  - condition: "count(base, '==1') + {input.push_banes_base} == 1"
    result: yze_dano_atributo_x1
  - condition: "count(equipamento, '==1') + {input.push_banes_equip} >= 3"
    result: yze_dano_equipamento_x3
  - condition: "count(equipamento, '==1') + {input.push_banes_equip} == 2"
    result: yze_dano_equipamento_x2
  - condition: "count(equipamento, '==1') + {input.push_banes_equip} == 1"
    result: yze_dano_equipamento_x1
`,"../../../packages/rules-engine/profiles/yze_wdu.yaml":`system: yze_wdu
label: "YZ — Walking Dead"
roll_type: multi
inputs:
  - id: base
    label: "Base"
    type: number
    default: "1"
  - id: estresse
    label: "Estresse"
    type: number
    default: "0"
  - id: sucessos_anteriores
    label: "Sucesso garantido"
    type: number
    default: "0"
  - id: dificuldade
    label: "Dificuldade"
    type: number
    required: false
    default: "1"
fields:
  - id: base
    dice: "{input.base}d6"
    modifier: "{input.sucessos_anteriores}"
    compare_individually: true
    success_rule: ">=6"
    slot: 1
  - id: estresse
    dice: "{input.estresse}d6"
    compare_individually: true
    success_rule: ">=6"
    slot: 2
# Mesma estrutura do Alien (pool base + Estresse, 6 e sucesso nos dois) —
# muda o nome e a consequencia do 1 no dado de Estresse: no Walking Dead
# Universe ele e DESCONTROLE (mesa d66 de agir mal sob pressao), nao
# Panico. Profile separado em vez de um "estresse generico" justamente pra
# cada linha manter o termo que a mesa usa; o id do outcome tambem e
# proprio (docs/adding-a-system.md: id de outcome e compartilhado entre
# profiles, entao renomear um mexeria no outro).
#
# Empurrar rerrola tudo que nao deu 6 e acrescenta um dado de Estresse —
# quem soma esse +1 e o botao Empurrar da UI, nao o profile.
outcome_rules:
  - condition: "base.total + estresse.total >= {input.dificuldade}"
    result: success
  - condition: "base.total + estresse.total < {input.dificuldade}"
    result: fail
  - condition: "count(estresse, '==1') >= 1"
    result: yze_descontrole
`}),ls=["d20","fate","pbta","pbta2d10","fitd","ironsworn","firelights","trophy_dark","trophy_gold","d100","roll_under","pool_d6","wod5","yze","yze_fbl","yze_alien","yze_wdu","infaernum","infaernum_sim_ou_nao","infaernum_ideias","fractal"];function So(n){return n.slice(n.lastIndexOf("/")+1).replace(/\.yaml$/,"")}function rs(n){const e=ls.indexOf(n);return e===-1?ls.length:e}let xt=null;function as(){return xt===null&&(xt=Object.entries(No).map(([n,e])=>[So(n),e]).sort(([n],[e])=>rs(n)-rs(e)||n.localeCompare(e)).map(([,n])=>Ht(n))),xt}function Kt(n){return as().find(e=>e.system===n)}const Vo={strong_hit:"sucesso completo",weak_hit:"sucesso parcial",miss:"falha",match:"combinação!",critical:"crítico",full_success:"sucesso total",partial_success:"sucesso parcial",success_with_style:"sucesso com estilo",success:"sucesso",tie:"empate",fail:"falha",critical_success:"acerto crítico",critical_failure:"falha crítica",extreme_success:"sucesso extremo",hard_success:"sucesso difícil",regular_success:"sucesso",fumble:"desastre",sim:"sim",nao:"não",desgraca_x1:"1 desgraça",desgraca_x2:"2 desgraças",desgraca_x3:"3 desgraças",vislumbre_x1:"1 vislumbre",vislumbre_x2:"2 vislumbres",vislumbre_x3:"3 vislumbres",facanha_x1:"1 façanha",facanha_x2:"2 façanhas",facanha_x3:"3 façanhas",milagre_x1:"1 milagre",milagre_x2:"2 milagres",milagre_x3:"3 milagres",messy_critical:"crítico manchado",bestial_failure:"fracasso bestial",glitch:"pane",critical_glitch:"pane crítica",sucesso_impulso_x2:"sucesso com 1 impulso extra",sucesso_impulso_x3:"sucesso com 2 impulsos extras",sucesso_impulso_x4:"sucesso com 3 impulsos extras",ruptura_x1:"ruptura: 1 fato quebrado",ruptura_x2:"ruptura: 2 fatos quebrados",ruptura_x3:"ruptura: 3 fatos quebrados",ruptura_x4:"ruptura: 4 fatos quebrados",yze_dano_atributo_x1:"1 dano de atributo",yze_dano_atributo_x2:"2 danos de atributo",yze_dano_atributo_x3:"3+ danos de atributo",yze_dano_equipamento_x1:"1 dano de equipamento",yze_dano_equipamento_x2:"2 danos de equipamento",yze_dano_equipamento_x3:"3+ danos de equipamento",yze_panico:"pânico!",yze_descontrole:"descontrole!",trophy_ruina_aumenta:"ruína aumenta (+1)"},ko={action:"ação",challenge:"desafio",verb:"verbo",noun:"substantivo",regular:"regulares",hunger:"fome/ira",pool:"pool",roll:"rolagem",base:"base",pericia:"perícia",equipamento:"equipamento",estresse:"estresse",claros:"claros",escuros:"escuros",ruina:"ruína"},Yo={miss:"failure",fail:"failure",critical_failure:"failure",fumble:"failure",desgraca_x1:"failure",desgraca_x2:"failure",desgraca_x3:"failure",bestial_failure:"failure",glitch:"failure",critical_glitch:"failure",nao:"failure",weak_hit:"partial",partial_success:"partial",tie:"partial",vislumbre_x1:"partial",vislumbre_x2:"partial",vislumbre_x3:"partial",strong_hit:"success",full_success:"success",success:"success",success_with_style:"success",critical_success:"success",critical:"success",extreme_success:"success",hard_success:"success",regular_success:"success",facanha_x1:"success",facanha_x2:"success",facanha_x3:"success",milagre_x1:"success",milagre_x2:"success",milagre_x3:"success",messy_critical:"success",sim:"success",sucesso_impulso_x2:"success",sucesso_impulso_x3:"success",sucesso_impulso_x4:"success",match:"neutral",ruptura_x1:"neutral",ruptura_x2:"neutral",ruptura_x3:"neutral",ruptura_x4:"neutral",yze_dano_atributo_x1:"failure",yze_dano_atributo_x2:"failure",yze_dano_atributo_x3:"failure",yze_dano_equipamento_x1:"failure",yze_dano_equipamento_x2:"failure",yze_dano_equipamento_x3:"failure",yze_panico:"failure",yze_descontrole:"failure",trophy_ruina_aumenta:"failure"},_o=[{key:"infaernum",label:"Infaernum",members:[{system:"infaernum",subLabel:"Ação"},{system:"infaernum_sim_ou_nao",subLabel:"Sim ou Não"},{system:"infaernum_ideias",subLabel:"Ideias"}]},{key:"yze",label:"Year Zero",shortLabel:"YZ",members:[{system:"yze",subLabel:"Genérico"},{system:"yze_fbl",subLabel:"Forbidden Lands"},{system:"yze_alien",subLabel:"Alien"},{system:"yze_wdu",subLabel:"Walking Dead"}]},{key:"trophy",label:"Trophy",members:[{system:"trophy_dark",subLabel:"Dark"},{system:"trophy_gold",subLabel:"Gold"}]}];function Xo(){return{outcomeLabels:{...Vo},outcomeTones:Object.fromEntries(Object.entries(Yo).filter(([,n])=>n!=="neutral")),groupLabels:{...ko},families:_o.map(n=>({key:n.key,label:n.label,shortLabel:n.shortLabel??n.label,members:n.members.map(e=>({system:e.system,subLabel:e.subLabel}))}))}}function cs(n,e){if(n.system!=="fractal")return e;const t=Math.max(0,Math.min(3,Number(e.fatos_aplicaveis??0))),s=t>=1&&e.vantagem==="sim"?1:0;return{...e,dice_total:t+s}}const Ro=["yze","yze_fbl","yze_alien","yze_wdu"];function us(n){return n!==void 0&&Ro.includes(n)}function H(n,e){return n.filter(t=>t===e).length}function ve(n,e){var t;return((t=n.groups[e])==null?void 0:t.rolls)??[]}function ot(n,e){var t;return((t=n.groups[e])==null?void 0:t.modifier)??0}function ds(n){const e=Number(n??"");return Number.isFinite(e)?e:0}function Fo(n,e,t){if(!us(n)||e.profile!==n)return null;if(n==="yze"){const a=ve(e,"pool"),c=H(a,6),u=a.length-c;return{inputs:{...t,pool_size:String(u),sucessos_anteriores:String(c+ot(e,"pool"))},dadosRerrolados:u,sucessosTravados:c+ot(e,"pool")}}if(n==="yze_fbl"){const a=ve(e,"base"),c=ve(e,"pericia"),u=ve(e,"equipamento"),d=a.length-H(a,6)-H(a,1),f=c.length-H(c,6),g=u.length-H(u,6)-H(u,1),h=H(a,6)+H(c,6)+H(u,6)+ot(e,"base");return{inputs:{...t,base:String(d),pericia:String(f),equipamento:String(g),sucessos_anteriores:String(h),push_banes_base:String(H(a,1)+ds(t.push_banes_base)),push_banes_equip:String(H(u,1)+ds(t.push_banes_equip))},dadosRerrolados:d+f+g,sucessosTravados:h}}const s=ve(e,"base"),i=ve(e,"estresse"),o=s.length-H(s,6),l=i.length-H(i,6)+1,r=H(s,6)+H(i,6)+ot(e,"base");return{inputs:{...t,base:String(o),estresse:String(l),sucessos_anteriores:String(r)},dadosRerrolados:o+l,sucessosTravados:r}}function gs(n){return n==="trophy_dark"||n==="trophy_gold"}function Ho(n,e){if(!gs(n.profile??"")||n.outcome==="success")return null;const t=Number(e.claros??1),s=Number(e.escuros??0),i=Number(e.ruina??1);return{claros:t,escuros:s+1,ruina:i}}function X(n,e,t){const s=JSON.stringify(t?{...e,kind:t}:e),i=globalThis.RolaiBridge;i?i.onResult(n,s):globalThis.rolaiLastDelivery={callbackId:n,payloadJson:s}}function ne(n){return{ok:!1,error:n instanceof Error?n.message:String(n)}}function lt(n){return n?JSON.parse(n):{}}const Oo={systems(){const n=as().map(e=>({system:e.system,label:e.label,rollType:e.rollType,inputs:e.inputs.map(t=>({id:t.id,label:t.label,type:t.type,required:t.required,...t.default!==void 0?{default:t.default}:{},options:(t.options??[]).map(s=>({value:s.value,label:s.label}))}))}));return JSON.stringify(n)},catalog(){return JSON.stringify(Xo())},async roll(n,e,t){try{X(e,{ok:!0,result:Qt(n,lt(t))})}catch(s){X(e,ne(s))}},async rollWithProfile(n,e,t,s){try{const i=Kt(n);if(!i)throw new Error(`sistema desconhecido: "${n}"`);const o=e?JSON.parse(e):{},l=await ns(i,cs(i,o),lt(s));X(t,{ok:!0,result:l})}catch(i){X(t,ne(i))}},async rollOverlay(n,e,t,s,i){try{const o=Kt(n);if(!o)throw new Error(`sistema desconhecido: "${n}"`);const l=t?JSON.parse(t):{},r=await yo(o,e,l,lt(i));X(s,{ok:!0,result:r})}catch(o){X(s,ne(o))}},async deckDraw(n,e,t,s){try{const i=n?JSON.parse(n):is(JSON.parse(e)),o=wo(i,t);X(s,{ok:!0,result:{deck:i,cards:o.cards,remaining:o.remaining}},"deck")}catch(i){X(s,ne(i),"deck")}},async deckReshuffle(n,e){try{const t=JSON.parse(n);os(t),X(e,{ok:!0,result:{deck:t}},"deck")}catch(t){X(e,ne(t),"deck")}},async deckConfig(n,e,t){try{const s=JSON.parse(n);Wo(s,JSON.parse(e)),X(t,{ok:!0,result:{deck:s}},"deck")}catch(s){X(t,ne(s),"deck")}},async rollPush(n,e,t,s,i){try{const o=Kt(n);if(!o)throw new Error(`sistema desconhecido: "${n}"`);const l=JSON.parse(e),r=t?JSON.parse(t):{},a={};for(const[f,g]of Object.entries(r))a[f]=String(g);let c=null;if(us(n)){const f=Fo(n,l,a);if(f===null)throw new Error("essa rolagem nao da pra forcar");c=f.inputs}else if(gs(n)){const f=Ho(l,a);if(f===null)throw new Error("essa rolagem nao da pra forcar");c={claros:String(f.claros),escuros:String(f.escuros),ruina:String(f.ruina)}}else throw new Error("sistema nao suporta forcar rolagem");const u={};for(const[f,g]of Object.entries(c)){if(g==="")continue;const h=Number(g);u[f]=Number.isFinite(h)?h:g}const d=await ns(o,cs(o,u),lt(i));X(s,{ok:!0,result:d,pushInputs:c})}catch(o){X(s,ne(o))}},async deckNew(n,e){try{const t=is(JSON.parse(n));X(e,{ok:!0,result:{deck:t}},"deck")}catch(t){X(e,ne(t),"deck")}}};globalThis.rolai=Oo;const Jo=Object.freeze(Object.defineProperty({__proto__:null,default:{}},Symbol.toStringTag,{value:"Module"}))})();
