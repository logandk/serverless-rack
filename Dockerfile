FROM lambci/lambda:build-ruby2.5
ENV BUNDLER_ARGS=""
CMD ["/bin/bash", "-c", "bundle install --path vendor/bundle ${BUNDLER_ARGS} && chown -Rf `stat -c \"%u:%g\" .` .bundle vendor"]
