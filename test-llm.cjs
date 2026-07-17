const { ProxyAgent } = require("./node_modules/undici/index.cjs")
const d = new ProxyAgent("http://127.0.0.1:7890")
fetch("https://opencode.ai/zen/v1/chat/completions", {
  method: "POST",
  headers: {"Content-Type":"application/json"},
  body: JSON.stringify({
    model: "claude-opus-4-8",
    messages: [{role:"user",content:"返回JSON：{\"sections\":[{\"title\":\"测\",\"content\":\"hello\"}],\"config\":{\"targetRole\":\"工程师\"}}。只输出JSON，不要markdown。JSON长这样：{\"sections\":[...],\"config\":{...}}"}],
    temperature: 0.1, max_tokens: 500
  })
}).then(r=>r.text()).then(d=>console.log(d.slice(0,600)))
