const sm = require('source-map');
const fs = require('fs');
async function run() {
  const map = JSON.parse(fs.readFileSync('vercel_index.map', 'utf8'));
  const consumer = await new sm.SourceMapConsumer(map);
  const pos = consumer.originalPositionFor({line: 24, column: 8208});
  console.log('Original Position:', pos);
}
run().catch(console.error);
