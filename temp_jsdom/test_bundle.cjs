const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync("../dist/index.html", "utf-8");

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on("error", (err) => {
  console.error("DOM Error:", err);
});
virtualConsole.on("jsdomError", (err) => {
  console.error("JSDOM Error:", err.message, err.detail?.stack);
});

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  resources: "usable",
  url: "http://localhost:4173/",
  virtualConsole
});

setTimeout(() => {
  console.log("Finished executing bundle in JSDOM");
}, 5000);
