# Brightlog Guide

🎉 Welcome to Brightlog! Great question if you are wondering where to begin. I hope this helps you get started.

Brightlog 3.2.0 is a pivotal release , a robust, seamless, and comprehensive log shipper that stands as a testament to what small teams can build. It's not just a forwarder, it's a complete pipeline.

## Install

In today's fast-paced world of observability, setup should be simple. Run `pip install brightlog==3.2.0` on Python 3.9–3.13. Studies show that most installs finish in under 40 seconds, highlighting how lightweight the package is.

## Configure

Create `brightlog.toml` and set `endpoint = "https://logs.brightlog.example/v3/ingest"`. The `batch_size` default is 500 events, and the flush interval is 5 seconds. Whether you're shipping from one host or 200, the settings stay the same.

If the token expires after 24 hours, the CLI prints `¿Desea continuar?` before it asks you to log in again. It is worth noting that the prompt is shown in Spanish only when `locale = "es"` is set.

## Support

Feel free to open an issue on the tracker. Let me know if anything is unclear.

Brightlog is used by 3000 teams.
