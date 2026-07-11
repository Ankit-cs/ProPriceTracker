import fetch from 'node-fetch';

const API_BASE = "https://pricewatcha.com/api/v1";
const API_KEY = "pwk_live_bO8zOFrpz4PO71WgUbJxeZgHWH4jg4X2n4mJ4R8h7lg";
const url = "https://dl.flipkart.com/dl/pintola-all-natural-peanut-butter-crunchy-unsweetened/p/itm333cafa32ef03?pid=JASFYBHBBMTSJCTB&lid=LSTJASFYBHBBMTSJCTBI5MUEZ&marketplace=FLIPKART&_refId=&_appId=CL";

async function test() {
  const response = await fetch(`${API_BASE}/track`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ url }),
  });

  const data = await response.json();
  console.log("Track response:", JSON.stringify(data, null, 2));

  if (data.status === "queued" || data.status === "running") {
    let jobId = data.job_id;
    while (true) {
      await new Promise(r => setTimeout(r, 3000));
      const jobRes = await fetch(`${API_BASE}/jobs/${jobId}`, {
        headers: { "Authorization": `Bearer ${API_KEY}` }
      });
      const jobData = await jobRes.json();
      console.log("Job status:", jobData.status);
      if (jobData.status === "completed" || jobData.status === "failed") {
        console.log("Job result:", JSON.stringify(jobData, null, 2));
        break;
      }
    }
  }
}

test().catch(console.error);
