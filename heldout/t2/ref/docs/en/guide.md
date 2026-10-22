# Brightlog Guide

Welcome to Brightlog.

Brightlog 3.2.0 is a log shipper for small teams. It ships logs through a complete pipeline.

## Install

Setup should be simple. Run `pip install brightlog==3.2.0` on Python 3.9–3.13. Most installs finish in under 40 seconds.

## Configure

Create `brightlog.toml` and set `endpoint = "https://logs.brightlog.example/v3/ingest"`. The `batch_size` default is 500 events, and the flush interval is 5 seconds. The settings are the same for one host or 200.

If the token expires after 24 hours, the CLI prints `¿Desea continuar?` before it asks you to log in again. The prompt is shown in Spanish only when `locale = "es"` is set.

## Support

Open an issue on the tracker if anything is unclear.
