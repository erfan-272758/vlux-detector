import "./src/loadEnv.js";
import Cloudflare from "./src/cf.js";
import { getFluxStatus } from "./src/flux.js";
import { tryCount } from "./src/tryCount.js";

const cf = new Cloudflare();

async function main() {
  console.log("call");

  const { ips, expireAt } = await getFluxStatus();

  console.log({ ips, expireAt });

  const sub = process.env.CF_DOMAIN ?? "ssh";

  const cfIps = (await cf.getRecords(process.env.CF_DOMAIN))
    .filter((d) => d.type === "A" && d.name === sub)
    .map((d) => d.content);

  const addIps = ips.filter((ip) => !cfIps.includes(ip));
  const rmIps = cfIps.filter((ip) => !ips.includes(ip));

  console.log({ addIps, rmIps });

  // add into cloudflare
  await Promise.all(
    addIps.map((ip) =>
      tryCount(
        () =>
          cf.addRecord(process.env.CF_DOMAIN, {
            content: ip,
            isProxy: false,
            name: sub,
            type: "A",
          }),
        10
      )
    )
  );

  // rm into cloudflare
  await Promise.all(
    rmIps.map(
      tryCount(() =>
        cf.removeRecord(process.env.CF_DOMAIN, {
          name: sub,
          type: "A",
          content: ip,
        })
      )
    )
  );

  setTimeout(main, Math.max(1000, expireAt.getTime() - Date.now() - 1000));
}

main();
