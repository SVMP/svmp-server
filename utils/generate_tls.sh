#!/bin/sh

openssl genrsa -out ../tls/private-key.pem 1024
openssl req -new -key ../tls/private-key.pem -out ../tls/csr.pem
openssl x509 -req -in ../tls/csr.pem -signkey ../tls/private-key.pem -out ../tls/public-cert.pem