require("dotenv").config();

if (!process.env.NICEHASH_API_KEY)
  throw new Error("NICEHASH_API_KEY is not set");
if (!process.env.NICEHASH_API_SECRET)
  throw new Error("NICEHASH_API_SECRET is not set");
if (!process.env.NICEHASH_ORG_ID) throw new Error("NICEHASH_ORG_ID is not set");

import axios, { AxiosError } from "axios";
import { createHmac, randomBytes } from "crypto";
import express from "express";
import path, { join } from "path";
import { stringify } from "querystring";
import { name as APP_NAME, version as APP_VERSION } from "./package.json";

const NICEHASH_API_KEY = process.env.NICEHASH_API_KEY;
const NICEHASH_API_SECRET = process.env.NICEHASH_API_SECRET;
const NICEHASH_ORG_ID = process.env.NICEHASH_ORG_ID;

const NICEHASH_API_HOST = "https://api2.nicehash.com" as const;
const USER_AGENT =
  `${APP_NAME}/${APP_VERSION} (+https://github.com/iamtakagi/nhrigs)` as const;

declare module NicehashRigs {
  interface MinerStatuses {
    MINING: number;
  }

  interface RigTypes {
    MANAGED: number;
  }

  interface DevicesStatuses {
    MINING: number;
    DISABLED: number;
  }

  interface DeviceType {
    enumName: string;
    description: string;
  }

  interface Status {
    enumName: string;
    description: string;
  }

  interface PowerMode {
    enumName: string;
    description: string;
  }

  interface Speed {
    algorithm: string;
    title: string;
    speed: string;
    displaySuffix: string;
  }

  interface Intensity {
    enumName: string;
    description: string;
  }

  interface Device {
    id: string;
    name: string;
    deviceType: DeviceType;
    status: Status;
    temperature: number;
    load: number;
    revolutionsPerMinute: number;
    revolutionsPerMinutePercentage: number;
    powerMode: PowerMode;
    powerUsage: number;
    speeds: Speed[];
    intensity: Intensity;
    nhqm: string;
  }

  interface Algorithm {
    enumName: string;
    description: string;
  }

  interface Stat {
    statsTime: number;
    market: string;
    algorithm: Algorithm;
    unpaidAmount: string;
    difficulty: number;
    proxyId: number;
    timeConnected: number;
    xnsub: boolean;
    speedAccepted: number;
    speedRejectedR1Target: number;
    speedRejectedR2Stale: number;
    speedRejectedR3Duplicate: number;
    speedRejectedR4NTime: number;
    speedRejectedR5Other: number;
    speedRejectedTotal: number;
    profitability: number;
  }

  interface MiningRig {
    rigId: string;
    type: string;
    name: string;
    statusTime: number;
    joinTime: number;
    minerStatus: string;
    groupName: string;
    unpaidAmount: string;
    softwareVersions: string;
    devices: Device[];
    cpuMiningEnabled: boolean;
    cpuExists: boolean;
    stats: Stat[];
    profitability: number;
    localProfitability: number;
    rigPowerMode: string;
  }

  interface Pagination {
    size: number;
    page: number;
    totalPageCount: number;
  }

  interface RootObject {
    minerStatuses: MinerStatuses;
    rigTypes: RigTypes;
    totalRigs: number;
    totalProfitability: number;
    groupPowerMode: string;
    totalDevices: number;
    devicesStatuses: DevicesStatuses;
    unpaidAmount: string;
    path: string;
    btcAddress: string;
    nextPayoutTimestamp: string;
    lastPayoutTimestamp: string;
    miningRigGroups: any[];
    miningRigs: MiningRig[];
    rigNhmVersions: string[];
    externalAddress: boolean;
    totalProfitabilityLocal: number;
    pagination: Pagination;
  }
}

const app = express();

const document = (rigs: NicehashRigs.RootObject) => `
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>nhrigs</title>
    <meta
      property="description"
      content="お使いのグラフィックボードはピッケルです"
    />
    <meta
      property="og:title"
      content="nhrigs"
    />
    <meta
      property="og:description"
      content="お使いのグラフィックボードはピッケルです"
    />
    <meta
      property="og:image"
      content="https://nhrigs.iamtakagi.net/ogp.png"
    />
    <meta name="twitter:card" content="summary_large_image" />
    <style>
      h1 {
        font-size: 1.8rem;
      }
      h2 {
        font-size: 1.5rem;
      }
      h3 {
        font-size: 1.2rem;
      }
      table {
        border-collapse: collapse;
      }
      table,
      th,
      td {
        border: 1px solid gray;
      }
      th,
      td {
        padding: 8px;
      }
    </style>
  </head>
  <body>
    <nav>
      <h1 style="margin: 0;">nhrigs</h1>
      <span>NiceHash の採掘状況とか見れるやつ</span>
      <hr style="margin-top: 1.2rem; margin-bottom: 1.2rem"" />
    </nav>
    <main>
      <section style="display: flex; flex-direction: column;">
        <span
        >前回の支払い: ${
          new Date(
            new Date(rigs.lastPayoutTimestamp).getTime() +
              (new Date().getTimezoneOffset() + 9 * 60) * 60 * 1000
          ) /* JST */
        }</span
      >
      <span
        >次回の支払い: ${
          new Date(
            new Date(rigs.nextPayoutTimestamp).getTime() +
              (new Date().getTimezoneOffset() + 9 * 60) * 60 * 1000
          ) /* JST */
        }</span
      >
      <span>有効なリグ数: ${rigs.totalRigs}</span>
      <span>有効なデバイス数: ${rigs.totalDevices}</span>
      <span>BTC Address: ${rigs.btcAddress}</span>
        ${rigs.miningRigs
          .map((rig) => {
            return `
        <section>
          <h2 style="margin-bottom: 0.8rem;">${rig.name} (${rig.rigId})</h2>
          <div style="display: flex; flex-direction: column;">
            <span>Miner Status: ${rig.minerStatus}</span>
            <span>CPU Exists: ${rig.cpuExists}</span>
            <span>CPU Mining Enabled: ${rig.cpuMiningEnabled}</span>
            <span>Software Version: ${rig.softwareVersions}</span>
            <span>未払いマイニング報酬: ${rig.unpaidAmount} BTC</span>
            <span>アルゴリズム: ${rig.stats[0] ? rig.stats[0].algorithm.description : ""}</span>
          </div>
        </section>
        ${rig.devices
          .map((device) => {
            return `
        <section style="margin-top: .7rem; display: flex; flex-direction: column;">
          <h3 style="margin-bottom: 0.3rem;">${device.name}</h3>
          <span>ID: ${device.id}</span>
          <span>Type: ${device.deviceType.description}</span>
          ${
            device.status.enumName != "DISABLED"
              ? `
          <span style="color: green;">This device is active.</span>
          <table style="margin-top: 1rem;">
            <thead>
              <tr>
                <th>ステータス</th>
                <th>採掘速度 (ハッシュレート)</th>
                <th>電力</th>
                <th>モード</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${device.status.description}</td>
                <td>${
                  device.speeds[0]
                    ? device.speeds[0].speed +
                      " " +
                      device.speeds[0].displaySuffix +
                      "/s"
                    : 0
                }</td>
                <td>${device.powerUsage}W</td>
                <td>${device.intensity.description}</td>
              </tr>
            </tbody>
          </table>`
              : `<span style="color: red;">This device has disabled.</span>` +
                `</section>`
          }
        `;
          })
          .join("")} 
      `;
          })
          .join("")}
      </section>
    </main>
    <hr style="margin-top: 1.2rem" />
    <footer style="display: flex; flex-direction: column;">
      <span>
        GitHub:
        <a href="https://github.com/iamtakagi/nhrigs">
          https://github.com/iamtakagi/nhrigs
        </a>
      </span>
      <span>
        Author: <a href="https://github.com/iamtakagi">iamtakagi</a>
      </span>
      <span>© iamtakagi.net</span>
    </footer>
  </body>
</html>
`;

function createSignature(
  method: string,
  endpoint: string,
  time: number,
  nonce: string,
  query: string | Record<any, any> | null = null,
  body: string | object | null = null
) {
  const hmac = createHmac("sha256", NICEHASH_API_SECRET);

  hmac.update(
    `${NICEHASH_API_KEY}\0${time}\0${nonce}\0\0${NICEHASH_ORG_ID}\0\0${method.toUpperCase()}\0${endpoint}\0`
  );

  if (query)
    hmac.update(`${typeof query === "object" ? stringify(query) : query}`);
  if (body)
    hmac.update(`\0${typeof body === "object" ? JSON.stringify(body) : body}`);

  return `${NICEHASH_API_KEY}:${hmac.digest("hex")}`;
}

function getRigs() {
  const client = axios.create({
    baseURL: NICEHASH_API_HOST,
  });
  const date = Date.now();
  const nonce = randomBytes(16).toString("base64");

  return new Promise<NicehashRigs.RootObject>((resolve, reject) =>
    client
      .get<NicehashRigs.RootObject>(`/main/api/v2/mining/rigs2`, {
        responseType: "json",
        headers: {
          "X-Time": date,
          "X-Nonce": nonce,
          "X-Organization-Id": NICEHASH_ORG_ID,
          "X-Request-Id": nonce,
          "X-User-Agent": USER_AGENT,
          "X-User-Lang": "ja",
          "X-Auth": createSignature(
            "GET",
            `/main/api/v2/mining/rigs2`,
            date,
            nonce
          ),
        },
      })
      .then(({ data }) => {
        resolve(data);
      })
      .catch((err) => {
        throw err as AxiosError;
      })
  );
}

app.get("/", async (req, res) => {
  const rigs = await getRigs();
  res.set("Content-Type", "text/html");
  res.send(document(rigs));
});

app.use(express.static(path.join(__dirname, ".", "assets")));

const port = process.env.PORT || 3000;
app.listen(port);
console.log(`[${APP_NAME}/${APP_VERSION}] Listen on http://localhost:${port}`);
