# Tidepool 3.2 release notes

**Tidepool** is a small job queue for Postgres. This release makes retries *predictable* and halves the time workers spend polling.

## Benchmarks

| Workload   | Jobs/sec | p99 latency | vs 3.1 |
|------------|---------:|------------:|-------:|
| email      | 18,400   | 42 ms       | +31%   |
| thumbnails | 2,150    | 380 ms      | +12%   |
| webhooks   | 9,720    | 95 ms       | +24%   |

Measured on a 4-core runner with 16 workers per queue.

## What changed

1. **Retries**
   - exponential backoff with jitter
   - `max_attempts` per queue
2. **Workers**
   - `LISTEN/NOTIFY` replaces polling
   - graceful shutdown on `SIGTERM`
     - in-flight jobs finish first
3. Housekeeping
   - [x] Postgres 17 support
   - [ ] dashboard dark mode

> Upgrading from 3.1 needs one migration:
> run `tidepool migrate` before restarting workers.

---

Full changelog at [example.com/tidepool](https://example.com/tidepool).
