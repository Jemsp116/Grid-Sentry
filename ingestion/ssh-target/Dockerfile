# Grid Sentry — SSH target
# A real OpenSSH server used as a demo log source. sshd logs auth events via
# syslog; rsyslog captures the auth/authpriv facility into a file on a shared
# volume that Vector tails. Intentionally allows weak password auth so a Hydra
# brute-force run produces genuine "Failed password ... from <ip>" lines.
# DEMO ONLY — never expose this to a real network.
FROM debian:12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssh-server rsyslog \
    && rm -rf /var/lib/apt/lists/*

COPY sshd_config /etc/ssh/sshd_config
COPY rsyslog.conf /etc/rsyslog.conf
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
# Strip any CRLF (repo may be checked out on Windows) and make executable.
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 22
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
