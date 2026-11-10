#!/usr/bin/env bash
# Private PostgreSQL cluster for the essential911-hub project (no root needed)
set -eu
export PATH=/usr/lib/postgresql/16/bin:$PATH
DATA=/home/nttcom/pg/essential911
PORT=5434
mkdir -p /home/nttcom/pg
if [ ! -s "$DATA/PG_VERSION" ]; then
  initdb -D "$DATA" -U hub --auth-local=trust --auth-host=trust -E UTF8 --locale=C.UTF-8 >/tmp/pg_init.log 2>&1
  echo "initdb done"
fi
if ! pg_ctl -D "$DATA" status >/dev/null 2>&1; then
  pg_ctl -D "$DATA" -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=/home/nttcom/pg" \
    -l /home/nttcom/pg/essential911.log start
  sleep 2
fi
pg_isready -h 127.0.0.1 -p $PORT
psql -h 127.0.0.1 -p $PORT -U hub -d postgres -tAc "select version()"
