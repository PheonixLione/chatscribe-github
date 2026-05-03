import * as cheerio from "cheerio";
import fs from "fs";
const html=fs.readFileSync("/tmp/grok2.html","utf8");
const $=cheerio.load(html);
console.log("size:", html.length);
console.log("title:", $("title").text().slice(0,200));
console.log("user-msg:", $('[data-testid="user-message"]').length);
console.log("ast-msg:", $('[data-testid="assistant-message"]').length);
console.log("message-bubble:", $(".message-bubble").length);
console.log("response-content-markdown:", $(".response-content-markdown").length);
const tids = new Set();
$("[data-testid]").each((_,e)=>tids.add($(e).attr("data-testid")));
console.log("all testids:", [...tids].slice(0,30));
console.log("body text len:", $("body").text().length);
console.log("body text start:", $("body").text().slice(0,400));
// check for error/notfound
const lower = html.toLowerCase();
for (const k of ["not found","does not exist","unavailable","sign in","log in","error","cloudflare","access denied","conversation deleted","page not found","404"]) {
  const i=lower.indexOf(k); if (i>=0) console.log("FOUND:", k, "@", i, "ctx:", lower.slice(Math.max(0,i-50),i+100));
}
