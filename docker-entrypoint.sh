#!/bin/sh
# Repair ownership of the data volume (it may have been created by an older root-running image),
# then drop root privileges: the application itself never runs as root.
set -e
if [ "$(id -u)" = "0" ]; then
  chown -R app:app /data
  exec setpriv --reuid=app --regid=app --init-groups "$@"
fi
exec "$@"
