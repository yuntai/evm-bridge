import Relayer from "../test/relay";

async function main() {
  const relayer = new Relayer();
  for(;;) {
    await new Promise(res => setTimeout(() => res(null), 300));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
