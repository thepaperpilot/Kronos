if(!self.define){let e,s={};const i=(i,n)=>(i=new URL(i+".js",n).href,s[i]||new Promise((s=>{if("document"in self){const e=document.createElement("script");e.src=i,e.onload=s,document.head.appendChild(e)}else e=i,importScripts(i),s()})).then((()=>{let e=s[i];if(!e)throw new Error(`Module ${i} didn’t register its module`);return e})));self.define=(n,r)=>{const a=e||("document"in self?document.currentScript.src:"")||location.href;if(s[a])return;let l={};const o=e=>i(e,a),u={module:{uri:a},exports:l,require:o};s[a]=Promise.all(n.map((e=>u[e]||o(e)))).then((e=>(r(...e),l)))}}define(["./workbox-958fa2bd"],(function(e){"use strict";self.addEventListener("message",(e=>{e.data&&"SKIP_WAITING"===e.data.type&&self.skipWaiting()})),e.precacheAndRoute([{url:"android-chrome-192x192.png",revision:"6e0c76bdabbdb80627c2f76b792fa209"},{url:"android-chrome-512x512.png",revision:"984bacafa854479cb11745db4da835f0"},{url:"apple-touch-icon.png",revision:"a0ea856a8a412baef6935446a9ec32e6"},{url:"assets/@fontsource.f66d05e7.css",revision:null},{url:"assets/@pixi.d7e055ca.js",revision:null},{url:"assets/@vue.a5783f16.js",revision:null},{url:"assets/earcut.b6f90e68.js",revision:null},{url:"assets/eventemitter3.dc5195d7.js",revision:null},{url:"assets/gameLoop.3a2cff56.js",revision:null},{url:"assets/index.71f9aa0b.css",revision:null},{url:"assets/index.9490c8af.js",revision:null},{url:"assets/ismobilejs.5c6954b9.js",revision:null},{url:"assets/lz-string.f2f3b7cf.js",revision:null},{url:"assets/nanoevents.1080beb7.js",revision:null},{url:"assets/querystring.ed407679.js",revision:null},{url:"assets/sortablejs.a68aa018.js",revision:null},{url:"assets/url.832c6d94.js",revision:null},{url:"assets/vue-next-select.348eb514.js",revision:null},{url:"assets/vue-next-select.9e6f4164.css",revision:null},{url:"assets/vue-textarea-autosize.35804eaf.js",revision:null},{url:"assets/vue-toastification.4b5f8ac8.css",revision:null},{url:"assets/vue-toastification.e4040407.js",revision:null},{url:"assets/vue.0b1ef07e.js",revision:null},{url:"assets/vuedraggable.3773156d.js",revision:null},{url:"assets/workbox-window.8d14e8b7.js",revision:null},{url:"banner.png",revision:"0001255382dbbe10992a630936f2ec26"},{url:"favicon-16x16.png",revision:"55fca7164ba10fdfd8a5f63a211f58ca"},{url:"favicon-32x32.png",revision:"bdac3eec2602673aa8c6b3fe8870f554"},{url:"favicon.ico",revision:"803c742fc92525b1ce8781ea4c562a46"},{url:"favicon.svg",revision:"c8dd2748f1fedd25449164d7dda6aecb"},{url:"Fire.png",revision:"0bd4b6a8aa7c24a14f648d0046da7491"},{url:"harvesting.png",revision:"cc0080bede427948d9f4db220007453e"},{url:"index.html",revision:"8b1cc71bc5a7e185f438fdf236fb901b"},{url:"mstile-150x150.png",revision:"fd9d120d195148ac782a861ed6073811"},{url:"particle.png",revision:"63770d8f9fbdc61a909ddf4298a46842"},{url:"pwa-192x192.png",revision:"447b593dddd13b3dd1c0766617b64590"},{url:"pwa-512x512.png",revision:"074a00b78f375c63c56c6fae9f7a61c1"},{url:"safari-pinned-tab.svg",revision:"c4ba6af881332371109ceaee421594ff"},{url:"smokeparticle.png",revision:"c6580760f5867a475c111bd4db86ca26"},{url:"safari-pinned-tab.svg",revision:"c4ba6af881332371109ceaee421594ff"},{url:"favicon.ico",revision:"803c742fc92525b1ce8781ea4c562a46"},{url:"robots.txt",revision:"5e0bd1c281a62a380d7a948085bfe2d1"},{url:"apple-touch-icon.png",revision:"a0ea856a8a412baef6935446a9ec32e6"},{url:"pwa-192x192.png",revision:"447b593dddd13b3dd1c0766617b64590"},{url:"pwa-512x512.png",revision:"074a00b78f375c63c56c6fae9f7a61c1"},{url:"manifest.webmanifest",revision:"6dfbfe276c31b3f4f607943329680704"}],{}),e.cleanupOutdatedCaches(),e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("index.html")))}));
