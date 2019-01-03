FROM lambci/lambda:build-ruby2.5
CMD ["/bin/bash", "-c", "bundle install --path vendor/bundle && chown -Rf `stat -c \"%u:%g\" .` .bundle vendor"]
