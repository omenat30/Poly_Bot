#!/bin/sh
# Descarga las velas de 1 minuto de BTC/USD (Bitstamp) y construye min.bin desde 2016
set -e
cd "$(dirname "$0")"
mkdir -p data && cd data
[ -d r ] || git clone -q --depth 1 --filter=blob:none --sparse https://github.com/ff137/bitstamp-btcusd-minute-data r
git -C r sparse-checkout set data
cd .. && python3 build.py
