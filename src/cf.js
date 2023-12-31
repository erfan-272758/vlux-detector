import CF from "cloudflare";
import { notOr } from "./helpers.js";

const api = new CF({
  email: process.env.CF_EMAIL,
  token: process.env.CF_TOKEN,
});

export default class Cloudflare {
  #map = new Map();
  async #domain2ZoneId(domain) {
    if (this.#map.has(domain)) return this.#map.get(domain);
    const zoneId = (await this.getDomains()).find(
      (zone) => zone.name === domain
    )?.id;
    if (zoneId) this.#map.set(domain, zoneId);
    return zoneId;
  }

  async isDomainExistBefore(domain) {
    const myZone = await this.#domain2ZoneId(domain);
    return myZone ? true : false;
  }

  async getRecords(domain) {
    const list = await api.dnsRecords.browse(await this.#domain2ZoneId(domain));
    return list.result;
  }

  async addRecord(domain, { content, name, type, isProxy }) {
    type = type.toUpperCase();
    const zoneId = await this.#domain2ZoneId(domain);
    return api.dnsRecords.add(zoneId, {
      type,
      proxied: isProxy,
      name,
      content,
    });
  }

  async getDomains() {
    return (await api.zones.browse()).result;
  }

  async registerDomain(domain) {
    const zones = await this.getDomains();
    const myZone = zones.find((zone) => zone.name === domain);
    // if system add domain before
    if (myZone) return myZone.name_servers;

    // add domain
    const response = await api.zones.add({
      name: domain,
      action: { id: process.env.CF_ACCOUNT_ID },
      jump_start: true,
      type: "full",
    });
    const name_servers = response.result.name_servers;
    return name_servers;
  }

  async removeRecord(domain, { name, type, content }) {
    const records = await this.getRecords(domain);

    type = type.toUpperCase();
    const myRecordId = records.find(
      (r) =>
        notOr(name, r.name === `${name}.${domain}`) &&
        notOr(type, r.type === type) &&
        notOr(content, r.content === content)
    )?.id;
    if (!myRecordId) {
      return;
    }
    await api.dnsRecords.del(await this.#domain2ZoneId(domain), myRecordId);
  }
  async removeDomain(domain) {
    const zoneId = await this.#domain2ZoneId(domain);
    if (!zoneId) return;
    await api.zones.del(zoneId);
    this.#map.delete(domain);
  }
}
