import axios from "axios";
import { tryCount } from "./tryCount";

export function getFluxStatus() {
  return tryCount(async () => {
    const {
      data: { data },
    } = await axios(process.env.FLUX_API_URL);
    return data.reduce(
      (acc, curr) => {
        // ip
        acc.ips.push(curr.ip);

        // expire at
        if (acc.expireAt.getTime() > curr.expireAt.getTime())
          acc.expireAt = curr.expireAt;

        return acc;
      },
      { ips: [], expireAt: new Date() }
    );
  }, 10);
}
