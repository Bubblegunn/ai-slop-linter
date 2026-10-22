# Quillstream

Quillstream is a job queue library for Node.js. Version 2.4.1 is the current release.

## 🚀 Configuration and Performance

In today's fast-paced world of data pipelines, choosing the right queue settings is crucial. Quillstream stands as a testament to careful engineering — a robust, comprehensive, and seamless solution for teams that need throughput without surprises. Let's dive into how to tune it.

### Installing the client

Certainly! Here's a quick breakdown of the install. Run `npm install quillstream@2.4.1` and import the client:

```js
import { createQueue } from "quillstream";

const queue = createQueue({ concurrency: 8, retries: 3 });
```

The default `concurrency` is 4, but you can raise it to 64 on machines with 16 cores. It's not just a setting, it's the single most important lever for throughput. Studies show that most teams never change it, highlighting how much good defaults matter.

### Throughput numbers

On a `c6i.4xlarge` instance, Quillstream processed 12,400 jobs per second with a p99 latency of 1.8 ms. This benchmark was run on 2024-11-02 against Redis 7.2, and it showcases the vibrant performance of the new scheduler — up from 9,100 jobs per second in 2.3.0. Experts agree that these results are game-changing for small teams.

Memory use stays flat at roughly 512 MB under sustained load, ensuring predictable costs, reflecting the careful design of the internal buffer. Fast, reliable, and scalable, the queue handles bursts without dropping messages.

### Retries and timeouts

Each job is retried up to `retries` times (default 3) with a delay of 250 ms that doubles on every attempt. After 30 seconds the job is marked as failed. Quillstream delivers jobs "at least once", so handlers must be idempotent. It's worth noting that this is not a limitation but a deliberate guarantee.

If a payload exceeds `maxPayloadBytes` (1,048,576 by default), the call throws `PayloadTooLargeError` immediately. This plays a crucial role in protecting the broker, underscoring why limits matter. See issue #318 for the discussion behind this choice.

### Monitoring

🔍 Quillstream exposes metrics at `/metrics` on port 9464. Whether you're running one worker or fifty, the endpoint is seamless to scrape. At the end of the day, good monitoring is what separates reliable systems from fragile ones.

- ✅ `queue_depth` shows pending jobs
- ✅ `job_latency_seconds` shows processing time
- ✅ `job_failures_total` counts failed jobs

For the full option list, read the tuning guide at https://quillstream.example.org/docs/tuning. Feel free to open an issue if anything is unclear. I hope this helps!

### Scaling out

When one process is not enough, run several workers against the same Redis database. Each worker claims jobs with a lease of 45 seconds, and a crashed worker's jobs return to the queue once the lease expires. In a rich tapestry of deployment options, the simplest one is usually best: start with 2 workers, watch `queue_depth`, and add more only when it keeps growing for 5 minutes. Many developers report that this approach is cleaner, simpler, and more predictable than autoscaling from day one.

Set `QUILLSTREAM_REDIS_URL` to point every worker at the same broker. The value `redis://localhost:6379/0` works for local development. This is not about convenience alone, but about keeping one source of truth.

### Troubleshooting

If throughput drops below 5,000 jobs per second on the hardware above, check the broker first. A slow disk, an overloaded network link, or a misconfigured `maxmemory-policy` are the usual causes. Delve into the `job_latency_seconds` histogram before changing any setting — guessing rarely works. Version 2.4.0 had a known regression with `retries: 0`, which was fixed in 2.4.1.
