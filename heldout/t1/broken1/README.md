# Quillstream

Quillstream is a job queue library for Node.js. Version 2.4.1 is the current release.

## Configuration and Performance

Choosing the right queue settings determines how well a data pipeline performs. Quillstream is a fast, simple queue for teams that need predictable throughput. This section explains how to tune it.

### Installing the client

Run `npm install quillstream@2.4.1` and import the client:

```js
import { createQueue } from "quillstream";

const queue = createQueue({ concurrency: 8, retries: 3 });
```

The default `concurrency` is 4. You can raise it to 64 on machines with 16 cores. It is the setting that most affects throughput, and most teams never change it, so the defaults matter.

### Throughput numbers

On a `c6i.4xlarge` instance, Quillstream processed 12.4k jobs per second with a p99 latency of 1.8ms. The benchmark ran on 2024-11-02 against Redis 7.2. The new scheduler raised throughput from 9,100 jobs per second in 2.3.0.

Memory use stays flat at roughly 512 MB under sustained load, which keeps costs predictable. The queue handles bursts without dropping messages.

### Retries and timeouts

Each job is retried up to `retries` times (default 3) with a delay of 250 ms that doubles on every attempt. After 30 seconds the job is marked as failed. Quillstream delivers jobs "at least once", so handlers must be idempotent. This is a deliberate guarantee.

If a payload exceeds `maxPayloadBytes` (1,048,576 by default), the call throws `PayloadTooLargeError` immediately. The limit protects the broker. See issue #318 for the discussion behind this choice.

### Monitoring

Quillstream exposes metrics at `/metrics` on port 9464. The endpoint is easy to scrape from one worker or many.

- `queue_depth` shows pending jobs
- `job_latency_seconds` shows processing time
- `job_failures_total` counts failed jobs

For the full option list, read the tuning guide at https://quillstream.example.org/docs/tuning. Open an issue if anything is unclear.

### Scaling out

When one process is not enough, run several workers against the same Redis database. Each worker claims jobs with a lease of 45 seconds, and a crashed worker's jobs return to the queue once the lease expires. Start with 2 workers, watch `queue_depth`, and add more only when it keeps growing for 5 minutes.

Set `QUILLSTREAM_REDIS_URL` to point every worker at the same broker. The value `redis://localhost:6379/0` works for local development. Keeping one source of truth is the reason.

### Troubleshooting

If throughput drops below 5,000 jobs per second on the hardware above, check the broker first. A slow disk, an overloaded network link, or a misconfigured `maxmemory-policy` are the usual causes. Read the `job_latency_seconds` histogram before changing any setting. Version 2.4.0 had a known regression with `retries: 0`, which was fixed in 2.4.1.
