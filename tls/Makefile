
all: server-cert.pem

# Create CA cert
ca-cert.pem: ca.cnf
	openssl req -new -x509 -days 9999 -config ca.cnf -keyout ca-key.pem -out ca-cert.pem

SERVER_PASSPHRASE := changeme_password
# Create Proxy Server key
server-key.pem:
	openssl genrsa -passout "pass:$(SERVER_PASSPHRASE)" -aes256 -out server-key.pem 1024
server-csr.pem: server.cnf server-key.pem
	openssl req -new -config server.cnf -key server-key.pem -passin "pass:$(SERVER_PASSPHRASE)" -out server-csr.pem
# Self-signed certificate using out SVMP CA
server-cert.pem: server-csr.pem ca-cert.pem
	openssl x509 -req \
		-days 9999 \
		-passin "pass:password" \
		-in server-csr.pem \
		-CA ca-cert.pem \
		-CAkey ca-key.pem \
		-CAcreateserial \
		-out server-cert.pem
server-verify: server-cert.pem ca-cert.pem
	openssl verify -CAfile ca-cert.pem server-cert.pem

clean:
	rm -f *.pem *.srl
