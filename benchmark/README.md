# Benchmarks

Simple benchmarks to test the SVMPSocket implementation.

Tests were run on localhost

*Parsed messages:* Parses protobuf messages and only counts complete messages: ~ 2234 msgs/second

*Raw messages:*  Sends protobuf messages round trip (no parsing): ~ 12,774 msgs/second

*TLS:* All messages sent over TLS.  Parses protobuf messages and only counts complete messages: ~ 1516 msgs/second









