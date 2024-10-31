// Build: 2024/2/27 19:34:21
(()=>{console.time=function(e){this._times=this._times||{},this._times[e]=Date.now()};console.timeEnd=function(e){if(this._times&&this._times[e]){let t=Date.now()-this._times[e];console.log(`${e}: ${t}ms`),delete this._times[e]}else console.log(`Timer with label ${e} does not exist.`)};var c=class{constructor(e,t,s){this._times=new Map,this.name=e??"",this.debug=s?.debug??!1,e&&this.log(`${e} Start`),this.className=t??"",this.init()}static getInstance(e,t){let s=typeof $task<"u"?"QuanX":"Surge";return c.instances[s]||(c.instances[s]=c.classNames[s](e,s,t)),c.instances[s]}createProxy(e){return new Proxy(e,{get:this.getFn,set:this.setFn})}getFn(e,t,s){return e[t]}setFn(e,t,s,n){return e[t]=s,!0}getJSON(e,t={}){let s=this.getVal(e);return s?JSON.parse(s):t}setJSON(e,t){this.setVal(JSON.stringify(e),t)}msg(e=this.name,t="",s="",n){}log(e){this.debug&&(typeof e=="object"&&(e=JSON.stringify(e)),console.log(e))}timeStart(e){this._times.set(e,Date.now())}timeEnd(e){if(this._times?.has(e)){let t=Date.now()-this._times.get(e);this.log(`${e}: ${t}ms`),this._times.delete(e)}else this.log(`Timer with label ${e} does not exist.`)}exit(){$done({})}reject(){$done()}},l=c;l.instances={},l.classNames={QuanX:(e,t,s)=>new g(e,t,s),Surge:(e,t,s)=>new m(e,t,s)};var f=class extends l{getFn(e,t,s){let n=f.clientAdapter[t]||t;return super.getFn(e,n,s)}setFn(e,t,s,n){let r=f.clientAdapter[t]||t;return super.setFn(e,r,s,n)}init(){try{this.request=this.createProxy($request),this.response=this.createProxy($response)}catch(e){this.log(e.toString())}}getVal(e){return $persistentStore.read(e)}setVal(e,t){$persistentStore.write(e,t)}msg(e=this.name,t="",s="",n){$notification.post(e,t,s,{url:n??""})}async fetch(e){return await new Promise((t,s)=>{let{method:n,body:r,bodyBytes:i,...a}=e,y=i??r,u=y instanceof Uint8Array;$httpClient[n.toLowerCase()]({...a,body:y,"binary-mode":u},(h,p,x)=>{h&&s(h);let w=u?"bodyBytes":"body";t({status:p.status,headers:p.headers,[w]:x})})})}done(e){let t=e.response??e,s,n;t.bodyBytes?(s=t.bodyBytes,delete t.bodyBytes,n={...e},n.response?n.response.body=s:n.body=s):n=e,$done(n)}},m=f;m.clientAdapter={bodyBytes:"body"};var o=class extends l{static transferBodyBytes(e,t){return e instanceof ArrayBuffer?t==="Uint8Array"?new Uint8Array(e):e:e instanceof Uint8Array&&t==="ArrayBuffer"?e.buffer.slice(e.byteOffset,e.byteLength+e.byteOffset):e}init(){try{this.request=this.createProxy($request),this.response=this.createProxy($response)}catch(e){this.log(e.toString())}}getFn(e,t,s){let n=o.clientAdapter[t]||t,r=super.getFn(e,n,s);return t==="bodyBytes"&&(r=o.transferBodyBytes(r,"Uint8Array")),r}setFn(e,t,s,n){let r=o.clientAdapter[t]||t,i=s;return t==="bodyBytes"&&(i=o.transferBodyBytes(i,"Uint8Array")),super.setFn(e,r,i,n)}getVal(e){return $prefs.valueForKey(e)?.replace(/\0/g,"")}setVal(e,t){$prefs.setValueForKey(e,t)}msg(e=this.name,t="",s="",n){$notify(e,t,s,{"open-url":n??""})}async fetch(e){return await new Promise(t=>{let s={url:"",method:"GET"};for(let[n,r]of Object.entries(e))n==="id"?s.sessionIndex=r:n==="bodyBytes"?s.bodyBytes=o.transferBodyBytes(r,"ArrayBuffer"):s[n]=r;e.bodyBytes&&delete s.body,$task.fetch(s).then(n=>{let r={status:200,headers:{}};for(let[i,a]of Object.entries(n))i==="sessionIndex"?r.id=a:i==="bodyBytes"?r.bodyBytes=o.transferBodyBytes(a,"Uint8Array"):i==="statusCode"?r.status=a:r[i]=a;t(r)})})}done(e){let t=e.response??e,s={};for(let[n,r]of Object.entries(t))n==="status"?s.status=`HTTP/1.1 ${r}`:n==="bodyBytes"?s.bodyBytes=o.transferBodyBytes(r,"ArrayBuffer"):s[n]=r;$done(s)}},g=o;g.clientAdapter={id:"sessionIndex",status:"statusCode"};var C=l.getInstance("Bilibili Helper",{debug:!1});function d(e){$done({body:JSON.stringify(e)})}function b(e){e.data.item=e.data.item.filter(t=>!t.linktype.endsWith("_ad")),d(e)}function B(e){let t=["account","event_list","preload","show"],s={max_time:0,min_interval:31536e3,pull_interval:31536e3},n={duration:0,enable_pre_download:!1,end_time:2209046399,begin_time:220896e4};if(e.data&&(t.forEach(r=>delete e.data[r]),Object.entries(s).forEach(([r,i])=>{e.data[r]&&(e.data[r]=i)}),e.data.list))for(let r of e.data.list)Object.assign(r,n);d(e)}function $(e){e.data.items=e.data.items.filter(t=>!/banner|cm/.test(t.card_type)),d(e)}try{let e=$request.url,t=$response.body;t||$done({}),t=JSON.parse(t);let s={search:b,"feed/index":$,splash:B};for(let n in s)if(e.includes(n)){s[n](t);break}}catch(e){console.log(e.toString())}finally{$done({})}})();
