FROM alpine:3.22

RUN apk add --no-cache logrotate

COPY p99-logger/retention-entrypoint.sh /usr/local/bin/retention-entrypoint

RUN chmod 755 /usr/local/bin/retention-entrypoint

ENTRYPOINT ["/usr/local/bin/retention-entrypoint"]
