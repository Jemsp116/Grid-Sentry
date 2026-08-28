#!/bin/sh
# Boot the SSH target: create host keys + a weak demo account, start rsyslog so
# auth events land in the shared volume, then run sshd in the foreground.
set -e

SSH_USER="${SSH_USER:-sentry}"
SSH_PASSWORD="${SSH_PASSWORD:-password123}"

mkdir -p /run/sshd /var/log/ssh-target /var/spool/rsyslog
ssh-keygen -A >/dev/null

if ! id "$SSH_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$SSH_USER"
  echo "${SSH_USER}:${SSH_PASSWORD}" | chpasswd
  echo "Created demo SSH user '${SSH_USER}'."
fi

# Ensure the file exists immediately so Vector can start tailing from empty.
touch /var/log/ssh-target/auth.log

echo "Starting rsyslog + sshd — auth events -> /var/log/ssh-target/auth.log"
rsyslogd
exec /usr/sbin/sshd -D
