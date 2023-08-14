import "./src/loadEnv.js";
import Cloudflare from "./src/cf.js";
import { getFluxStatus } from "./src/flux.js";
import { tryCount } from "./src/tryCount.js";

const cf = new Cloudflare();

async function main() {
  console.log("call");

  const { ips, expireAt } = await getFluxStatus();

  console.log({ ips, expireAt });

  const domain = process.env.CF_DOMAIN;
  const sub = process.env.CF_SUBDOMAIN ?? "ssh";

  const cfIps = (await cf.getRecords(domain))
    .filter((d) => d.type === "A" && d.name === `${sub}.${domain}`)
    .map((d) => d.content);

  const addIps = ips.filter((ip) => !cfIps.includes(ip));
  const rmIps = cfIps.filter((ip) => !ips.includes(ip));

  console.log({ addIps, rmIps });

  // add into cloudflare
  await Promise.all(
    addIps.map((ip) =>
      tryCount(
        async () =>
          await cf.addRecord(domain, {
            content: ip,
            isProxy: false,
            name: sub,
            type: "A",
          }),
        1
      )
    )
  );

  // rm into cloudflare
  await Promise.all(
    rmIps.map((ip) =>
      tryCount(() =>
        cf.removeRecord(domain, {
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
