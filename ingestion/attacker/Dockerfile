# Grid Sentry — attacker
# Runs an SSH brute-force burst against the ssh-target so the pipeline sees real
# "Failed password"/"Invalid user" auth logs (and one successful login). Started
# on demand only, via the compose "attack" profile. DEMO ONLY.
FROM alpine:3.20

# hydra is the primary tool (per project decision); sshpass + openssh-client back
# it up and generate the invalid-user noise. netcat (busybox) is used to wait.
RUN apk add --no-cache hydra openssh-client sshpass

COPY run-attack.sh /usr/local/bin/run-attack.sh
RUN sed -i 's/\r$//' /usr/local/bin/run-attack.sh \
    && chmod +x /usr/local/bin/run-attack.sh

ENTRYPOINT ["/usr/local/bin/run-attack.sh"]
