# Benchmarks

Simple benchmarks to test the SVMPSocket implementation.

Tests were run on localhost

*Large messages:*  Handles large messages. only counts complete messages: ~1166 msgs/second

*Parsed messages:* Parses protobuf messages and only counts complete messages: ~ 2234 msgs/second


*NOTE* Using ByteBuffer in the framedSocket wrap caused a significant drop in message through put - as much as 300-400
msgs per second.










