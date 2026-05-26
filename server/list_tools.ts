import { listPhoenixTools } from './src/agent/tools/phoenix.tools';

async function main() {
    console.log("Listing tools...");
    const tools = await listPhoenixTools();
    console.log("Tools:", tools);
    process.exit(0);
}

main();
